import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef, signal } from '@angular/core';
import { AssemblyGuideModalComponent } from './assembly-guide-modal';
import {
  AssemblyGuidePiece,
  AssemblyGuideService,
  AssemblyStep,
  ModuleAssemblyGuide
} from '../../services/assembly-guide.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { PaymentService } from '../../services/payment.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { PartGeometryService } from '../../services/part-geometry.service';
import { I18nService } from '../../services/i18n.service';
import {
  ComponentRole,
  DEFAULT_ROOM_CONFIG,
  MelamineProject,
  Part,
  PartEdges
} from '../../models/melamine.models';

const DEFAULT_EDGES: PartEdges = {
  l1: 'thin',
  l2: 'none',
  a1: 'none',
  a2: 'none'
};

function makePart(overrides: Partial<Part> & { id: string; name: string }): Part {
  return {
    length: 600,
    width: 300,
    thickness: 18,
    quantity: 1,
    materialId: 'mat-white',
    materialName: 'Melamina Blanca 18mm',
    grain: 'none',
    edges: { ...DEFAULT_EDGES },
    posX: 0,
    posY: 0,
    posZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    ...overrides
  };
}

interface MockPieceWorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  spanX: number;
  spanY: number;
  spanZ: number;
  cx: number;
  cy: number;
  cz: number;
}

type MockGuidePiece = AssemblyGuidePiece & {
  worldBounds: MockPieceWorldBounds;
  resolvedRole: ComponentRole;
};

type MockAssemblyStep = AssemblyStep & {
  cumulativePriorPartCodes: string[];
};

function computeMockBounds(part: Part): MockPieceWorldBounds {
  const orient = part.orientation ?? 'horizontal';
  let spanX = part.length;
  let spanY = part.thickness;
  let spanZ = part.width;
  if (orient === 'vertical_yz') {
    spanX = part.thickness;
    spanY = part.length;
    spanZ = part.width;
  } else if (orient === 'vertical_xy') {
    spanX = part.length;
    spanY = part.width;
    spanZ = part.thickness;
  }
  const cx = part.posX ?? 0;
  const cy = part.posY ?? 0;
  const cz = part.posZ ?? 0;
  return {
    minX: cx - spanX / 2,
    maxX: cx + spanX / 2,
    minY: cy - spanY / 2,
    maxY: cy + spanY / 2,
    minZ: cz - spanZ / 2,
    maxZ: cz + spanZ / 2,
    spanX,
    spanY,
    spanZ,
    cx,
    cy,
    cz
  };
}

function makePiece(
  code: string,
  part: Part
): AssemblyGuidePiece {
  const piece: MockGuidePiece = {
    partId: part.id,
    code,
    name: part.name,
    translatedName: part.name,
    length: part.length,
    width: part.width,
    thickness: part.thickness,
    quantity: part.quantity,
    materialName: part.materialName,
    edges: part.edges,
    componentRole: part.componentRole,
    part,
    worldBounds: computeMockBounds(part),
    resolvedRole: part.componentRole ?? 'free'
  };
  return piece;
}

/**
 * Fixture representativo: Alacena Sobre-Nevera 90cm (900 × 400 × 600 mm)
 * Incluye P1..P4 (Casco), P5 (Fondo Trasero Ranurado 868×398×3 horizontal),
 * P6 (Repisa Interna) y P7 (Puerta Abatible Superior).
 */
function createAlacenaSobreNeveraGuide(): ModuleAssemblyGuide {
  const p1 = makePiece('P1', makePart({
    id: 'p1-left',
    name: 'Lateral Izquierdo',
    length: 400,
    width: 600,
    thickness: 18,
    orientation: 'vertical_yz',
    componentRole: 'side_left',
    posX: -441,
    posY: 200,
    posZ: 0
  }));
  const p2 = makePiece('P2', makePart({
    id: 'p2-right',
    name: 'Lateral Derecho',
    length: 400,
    width: 600,
    thickness: 18,
    orientation: 'vertical_yz',
    componentRole: 'side_right',
    posX: 441,
    posY: 200,
    posZ: 0
  }));
  const p3 = makePiece('P3', makePart({
    id: 'p3-top',
    name: 'Techo Superior',
    length: 864,
    width: 600,
    thickness: 18,
    orientation: 'horizontal',
    componentRole: 'top',
    posX: 0,
    posY: 391,
    posZ: 0
  }));
  const p4 = makePiece('P4', makePart({
    id: 'p4-bottom',
    name: 'Base Inferior',
    length: 864,
    width: 600,
    thickness: 18,
    orientation: 'horizontal',
    componentRole: 'bottom',
    posX: 0,
    posY: 9,
    posZ: 0
  }));
  const p5 = makePiece('P5', makePart({
    id: 'p5-back',
    name: 'Fondo Trasero Ranurado',
    length: 868,
    width: 398,
    thickness: 3,
    materialId: 'mat-mdf3',
    materialName: 'MDF 3mm',
    orientation: 'vertical_xy',
    componentRole: 'back',
    posX: 0,
    posY: 200,
    posZ: -288.5
  }));
  const p6 = makePiece('P6', makePart({
    id: 'p6-shelf',
    name: 'Repisa Interna',
    length: 862,
    width: 560,
    thickness: 18,
    orientation: 'horizontal',
    componentRole: 'shelf',
    posX: 0,
    posY: 200,
    posZ: 10
  }));
  const p7 = makePiece('P7', makePart({
    id: 'p7-door',
    name: 'Puerta Abatible Superior',
    length: 896,
    width: 396,
    thickness: 18,
    orientation: 'vertical_xy',
    componentRole: 'door',
    posX: 0,
    posY: 200,
    posZ: 309,
    hardwareConfig: {
      isMovable: true,
      movableType: 'door',
      hingeType: 'gas_piston',
      openingDirection: 'top',
      handleType: 'bar_modern'
    }
  }));

  const pieces = [p1, p2, p3, p4, p5, p6, p7];

  const rawSteps: MockAssemblyStep[] = [
    {
      stepNumber: 1,
      titleKey: 'assemblyGuide.step1Title',
      defaultTitle: 'Paso 1 — Estructura Base y Costados (Casco)',
      descriptionKey: 'assemblyGuide.step1Desc',
      defaultDescription: 'Ensamble los costados con techo y base.',
      tips: ['Coloque 3 tornillos por unión.'],
      actionType: 'carcass',
      partCodes: ['P1', 'P2', 'P3', 'P4'],
      cumulativePriorPartCodes: [],
      parts: [p1, p2, p3, p4],
      hardware: [
        {
          id: 'screw_structural_50',
          name: 'assemblyGuide.hardwareStructuralScrews',
          codeName: 'Tornillo 4.0 × 50 mm',
          spec: '4.0 × 50 mm',
          quantity: 12,
          type: 'screw_structural',
          iconName: 'wrench'
        }
      ]
    },
    {
      stepNumber: 2,
      titleKey: 'assemblyGuide.step2Title',
      defaultTitle: 'Paso 2 — Escuadrado y Fijación del Fondo Trasero',
      descriptionKey: 'assemblyGuide.step2Desc',
      defaultDescription: 'Verifique diagonales D1 = D2 e inserte el fondo P5.',
      tips: ['Confirme escuadra a 90 grados.'],
      actionType: 'back',
      partCodes: ['P5'],
      cumulativePriorPartCodes: ['P1', 'P2', 'P3', 'P4'],
      parts: [p5],
      hardware: [
        {
          id: 'nail_back_panel',
          name: 'assemblyGuide.hardwareBackFasteners',
          codeName: 'Puntillas / Tornillos Fondo',
          spec: '3.0 × 15 mm',
          quantity: 18,
          type: 'nail_back',
          iconName: 'pin'
        }
      ]
    },
    {
      stepNumber: 3,
      titleKey: 'assemblyGuide.step3Title',
      defaultTitle: 'Paso 3 — Instalación de Repisas Internas',
      descriptionKey: 'assemblyGuide.step3Desc',
      defaultDescription: 'Inserte los pines de soporte y asiente la repisa P6.',
      tips: ['Verifique horizontalidad.'],
      actionType: 'shelves',
      partCodes: ['P6'],
      cumulativePriorPartCodes: ['P1', 'P2', 'P3', 'P4', 'P5'],
      parts: [p6],
      hardware: [
        {
          id: 'shelf_pins',
          name: 'assemblyGuide.hardwareShelfPins',
          codeName: 'Pines Ø 5 mm',
          spec: 'Ø 5 mm',
          quantity: 4,
          type: 'shelf_pin',
          iconName: 'layers'
        }
      ],
      measurements: [
        {
          label: 'P6 (Repisa Interna) — Altura Repisa',
          valueMm: 182
        }
      ]
    },
    {
      stepNumber: 4,
      titleKey: 'assemblyGuide.step5Title',
      defaultTitle: 'Paso 4 — Montaje de Bisagras, Puerta Abatible y Manija',
      descriptionKey: 'assemblyGuide.step5Desc',
      defaultDescription: 'Instale bisagras superiores, pistones a gas y la puerta P7.',
      tips: ['Calibre holgura perimetral de 3 mm.'],
      actionType: 'doors',
      partCodes: ['P7'],
      cumulativePriorPartCodes: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
      parts: [p7],
      hardware: [
        {
          id: 'cup_hinges',
          name: 'assemblyGuide.hardwareHinges',
          codeName: 'Bisagras Cazoleta 35 mm',
          spec: 'Ø 35 mm',
          quantity: 2,
          type: 'hinge',
          iconName: 'unfold'
        }
      ]
    }
  ];
  const steps: AssemblyStep[] = rawSteps;

  return {
    moduleId: 'mod-alacena-90',
    moduleName: 'Alacena Sobre-Nevera 90cm',
    moduleType: 'wall_cabinet',
    dimensions: { width: 900, height: 400, depth: 600 },
    totalPartsCount: 7,
    estimatedAssemblyTimeMinutes: 35,
    requiredTools: [
      'assemblyGuide.toolDrill',
      'assemblyGuide.toolTapeMeasure',
      'assemblyGuide.toolSquare',
      'assemblyGuide.toolRubberMallet'
    ],
    hardwareKit: [
      {
        id: 'screw_structural_50',
        name: 'assemblyGuide.hardwareStructuralScrews',
        codeName: 'Tornillo Soberbio 4.0 × 50 mm',
        spec: '4.0 × 50 mm',
        quantity: 12,
        type: 'screw_structural',
        iconName: 'wrench'
      },
      {
        id: 'cup_hinges',
        name: 'assemblyGuide.hardwareHinges',
        codeName: 'Bisagras Cazoleta 35 mm',
        spec: 'Cazoleta Ø 35 mm',
        quantity: 2,
        type: 'hinge',
        iconName: 'unfold'
      }
    ],
    pieces,
    steps,
    rawParts: pieces.map(p => p.part)
  };
}

function createMockProject(): MelamineProject {
  return {
    id: 'proj-rta-1',
    name: 'Cocina Integral Studio',
    clientName: 'Taller Norte',
    date: '2026-11-15',
    notes: '',
    settings: {
      sawKerf: 4,
      trimMargin: 10,
      defaultBoardThickness: 18,
      thinEdgeThickness: 0.45,
      thickEdgeThickness: 2.0,
      thinEdgeCostPerMeter: 1800,
      thickEdgeCostPerMeter: 4200,
      currency: 'COP',
      optimizationPreference: 'best_fit',
      subtractEdgeBandingFromCut: false
    },
    materials: [],
    modules: [],
    parts: [],
    hardware: [],
    laborCost: 0,
    laborType: 'percent',
    profitMarginPercent: 25,
    taxPercent: 19,
    updatedAt: '2026-11-15',
    roomConfig: { ...DEFAULT_ROOM_CONFIG }
  };
}

describe('AssemblyGuideModalComponent (RTA 3D OBB, Progressive Steps, Minimalist Studio & Multi-Page Print)', () => {
  let component: AssemblyGuideModalComponent;
  let componentRef: ComponentRef<AssemblyGuideModalComponent>;
  let fixture: ComponentFixture<AssemblyGuideModalComponent>;
  let guidesSignal: ReturnType<typeof signal<ModuleAssemblyGuide[]>>;
  let projectSignal: ReturnType<typeof signal<MelamineProject>>;
  let restrictedSignal: ReturnType<typeof signal<boolean>>;
  let openUpgradeModalSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const primaryGuide = createAlacenaSobreNeveraGuide();
    guidesSignal = signal<ModuleAssemblyGuide[]>([primaryGuide]);
    projectSignal = signal<MelamineProject>(createMockProject());
    restrictedSignal = signal<boolean>(false);
    openUpgradeModalSpy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [AssemblyGuideModalComponent],
      providers: [
        JoineryEngineService,
        PartGeometryService,
        I18nService,
        {
          provide: AssemblyGuideService,
          useValue: {
            guides: guidesSignal
          }
        },
        {
          provide: ProjectStorageService,
          useValue: {
            currentProject: projectSignal
          }
        },
        {
          provide: PaymentService,
          useValue: {
            isWorkshopExportRestricted: restrictedSignal,
            openUpgradeModal: openUpgradeModalSpy
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AssemblyGuideModalComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    document.querySelectorAll('.rta-print-iframe').forEach(el => el.remove());
  });

  describe('FASE 1: Orientación Espacial 3D Real (AABB + OBB) y Colisiones de Badges', () => {
    it('P5 Fondo Trasero Ranurado (868 x 398 x 3, vertical_xy) debe medir spanX === 868 y spanY === 398 (horizontal, nunca volteado)', () => {
      const guide = guidesSignal()[0];
      const p5 = guide.pieces.find(p => p.code === 'P5')!;
      const aabb = component.getPartAABB(p5.part);

      expect(aabb.spanX).toBe(868);
      expect(aabb.spanY).toBe(398);
      expect(aabb.spanZ).toBe(3);
      expect(aabb.spanX).toBeGreaterThan(aabb.spanY);

      const obb = component.getPieceOBB(p5.part);
      expect(obb.corners.length).toBe(8);
      const minX = Math.min(...obb.corners.map(c => c.x));
      const maxX = Math.max(...obb.corners.map(c => c.x));
      const minY = Math.min(...obb.corners.map(c => c.y));
      const maxY = Math.max(...obb.corners.map(c => c.y));
      expect(Math.round(maxX - minX)).toBe(868);
      expect(Math.round(maxY - minY)).toBe(398);
    });

    it('debe preservar la rotación 3D real en los 8 vértices OBB para piezas armadas manualmente con rotationY/rotationZ', () => {
      const rotatedBoard = makePart({
        id: 'manual-rot-1',
        name: 'Tablero Inclinado Manual',
        length: 600,
        width: 300,
        thickness: 18,
        orientation: 'horizontal',
        posX: 120,
        posY: 400,
        posZ: 50,
        rotationY: 45,
        rotationZ: 20
      });

      const obb = component.getPieceOBB(rotatedBoard);
      expect(obb.corners.length).toBe(8);
      // Los ejes del OBB deben ser unitarios y ortogonales pero ya NO canónicos
      expect(Math.abs(obb.axes[0].x)).toBeLessThan(0.95);
      expect(Math.abs(obb.axes[0].z)).toBeGreaterThan(0.3);

      // La distancia entre esquinas adyacentes a lo largo de length debe seguir siendo exactamente 600 mm
      const c0 = obb.corners[0];
      const c1 = obb.corners[1];
      const edgeLength = Math.hypot(c1.x - c0.x, c1.y - c0.y, c1.z - c0.z);
      expect(edgeLength).toBeCloseTo(600, 3);
    });

    it('el solucionador de colisiones debe separar callout badges solapados y mantenerlos dentro de márgenes de 24px', () => {
      const placements = component.resolveBadgeCollisions(
        [
          { code: 'P1', anchorX: 200, anchorY: 160 },
          { code: 'P2', anchorX: 202, anchorY: 161 },
          { code: 'P3', anchorX: 200, anchorY: 163 },
          { code: 'P4', anchorX: 199, anchorY: 159 }
        ],
        200,
        160,
        520,
        360,
        24
      );

      expect(placements.length).toBe(4);
      for (const p of placements) {
        expect(p.badgeX).toBeGreaterThanOrEqual(24);
        expect(p.badgeX).toBeLessThanOrEqual(520 - 24);
        expect(p.badgeY).toBeGreaterThanOrEqual(24);
        expect(p.badgeY).toBeLessThanOrEqual(360 - 24);
      }

      for (let i = 0; i < placements.length; i++) {
        for (let j = i + 1; j < placements.length; j++) {
          const dist = Math.hypot(
            placements[i].badgeX - placements[j].badgeX,
            placements[i].badgeY - placements[j].badgeY
          );
          expect(dist).toBeGreaterThanOrEqual(22);
        }
      }
    });

    it('el selector debe incluir claramente el conjunto completo cuando existen múltiples muebles en escena', () => {
      const secondGuide: ModuleAssemblyGuide = {
        ...createAlacenaSobreNeveraGuide(),
        moduleId: 'mod-manual-2',
        moduleName: 'Mueble Armado Manual'
      };
      guidesSignal.set([guidesSignal()[0], secondGuide]);
      fixture.detectChanges();

      const selectEl = fixture.nativeElement.querySelector('#moduleGuideSelect') as HTMLSelectElement;
      const firstOption = selectEl.options[0];
      expect(firstOption.value).toBe('all');
      expect(firstOption.textContent).toContain('Todos los Muebles / Conjunto Completo en Escena');
      expect(component.filteredGuides().length).toBe(2);

      component.selectedModuleId.set('mod-manual-2');
      fixture.detectChanges();
      expect(component.filteredGuides().length).toBe(1);
      expect(component.filteredGuides()[0].moduleName).toBe('Mueble Armado Manual');
    });
  });

  describe('FASE 2: Renderizado Progresivo Estricto por Paso (Cero Piezas Futuras)', () => {
    it('Paso 1 (Casco) debe incluir SOLO P1..P4 y jamás P5 (Fondo), P6 (Repisa) o P7 (Puerta)', () => {
      const guide = guidesSignal()[0];
      const step1 = guide.steps[0];
      const items = component.getStepRenderPieces(guide, step1);
      const codes = items.map(i => i.piece.code);

      expect(codes).toEqual(['P1', 'P2', 'P3', 'P4']);
      expect(items.every(i => i.state === 'current')).toBe(true);
      expect(codes).not.toContain('P5');
      expect(codes).not.toContain('P6');
      expect(codes).not.toContain('P7');
    });

    it('Paso 2 (Fondo) debe incluir P1..P4 como prior y P5 como current, jamás P6 o P7', () => {
      const guide = guidesSignal()[0];
      const step2 = guide.steps[1];
      const items = component.getStepRenderPieces(guide, step2);

      const priorCodes = items.filter(i => i.state === 'prior').map(i => i.piece.code);
      const currentCodes = items.filter(i => i.state === 'current').map(i => i.piece.code);

      expect(priorCodes).toEqual(['P1', 'P2', 'P3', 'P4']);
      expect(currentCodes).toEqual(['P5']);
      expect(items.map(i => i.piece.code)).not.toContain('P6');
      expect(items.map(i => i.piece.code)).not.toContain('P7');
    });

    it('debe respetar cumulativePriorPartCodes si viene provisto por el servicio', () => {
      const guide = guidesSignal()[0];
      const stepWithContract = {
        ...guide.steps[2],
        cumulativePriorPartCodes: ['P1', 'P2', 'P3', 'P4', 'P5']
      };
      const items = component.getStepRenderPieces(guide, stepWithContract);

      expect(items.filter(i => i.state === 'prior').map(i => i.piece.code)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
      expect(items.filter(i => i.state === 'current').map(i => i.piece.code)).toEqual(['P6']);
      expect(items.map(i => i.piece.code)).not.toContain('P7');
    });
  });

  describe('FASE 3: Tema Editorial Minimalist Studio Claro (Cero Dark Mode Forzado)', () => {
    it('el HTML renderizado no debe contener clases dark: ni fondos oscuros forzados ni SVG inline propios', () => {
      const rootEl = fixture.nativeElement as HTMLElement;
      const htmlString = rootEl.innerHTML;

      expect(htmlString).not.toContain('dark:');
      expect(htmlString).not.toContain('bg-zinc-950');
      expect(htmlString).not.toContain('purple-');
      expect(htmlString).not.toContain('violet-');

      const card = rootEl.querySelector('.assembly-guide-card') as HTMLElement;
      expect(card.className).toContain('bg-zinc-50');
      expect(card.className).toContain('text-zinc-900');

      const hwPill = rootEl.querySelector('.bg-sky-50.border-sky-200.text-sky-700');
      expect(hwPill).toBeTruthy();

      const inlineSvgsOutsideHugeicons = Array.from(rootEl.querySelectorAll('svg')).filter(
        svg => !svg.closest('hugeicons-icon')
      );
      expect(inlineSvgsOutsideHugeicons.length).toBe(0);
    });
  });

  describe('FASE 4: Documento Imprimible Multi-Página Completo (Cero Recorte 1/1)', () => {
    it('buildPrintableDocumentHtml debe generar CSS multi-página completo con todas las piezas P1..P7 y todos los pasos', () => {
      const guide = guidesSignal()[0];
      const explodedDataUrls = ['data:image/png;base64,EXPLODED_MOCK'];
      const stepDataUrls: Record<string, string> = {
        [`${guide.moduleId}::1`]: 'data:image/png;base64,STEP1_MOCK',
        [`${guide.moduleId}::2`]: 'data:image/png;base64,STEP2_MOCK',
        [`${guide.moduleId}::3`]: 'data:image/png;base64,STEP3_MOCK',
        [`${guide.moduleId}::4`]: 'data:image/png;base64,STEP4_MOCK'
      };

      const html = component.buildPrintableDocumentHtml(
        [guide],
        projectSignal(),
        explodedDataUrls,
        stepDataUrls
      );

      expect(html).toContain('@page { size: A4 portrait; margin: 12mm 14mm; }');
      expect(html).toContain('overflow: visible !important;');
      expect(html).toContain('max-height: none !important;');
      expect(html).toContain('table.parts-table thead {');
      expect(html).toContain('display: table-header-group;');
      expect(html).toContain('page-break-inside: avoid;');
      expect(html).toContain('.assembly-step-card');
      expect(html).toContain('background: #ffffff !important;');
      expect(html).not.toContain('dark:');

      // Todas las piezas P1..P7 deben aparecer en la tabla
      for (const code of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']) {
        expect(html).toContain(`>${code}<`);
      }
      expect(html).toContain('868 × 398 × 3');

      // Imagen explosiva + las 4 imágenes de paso + todos los pasos
      expect(html).toContain('data:image/png;base64,EXPLODED_MOCK');
      expect(html).toContain('data:image/png;base64,STEP1_MOCK');
      expect(html).toContain('data:image/png;base64,STEP4_MOCK');
      expect(html).toContain('Alacena Sobre-Nevera 90cm');
    });

    it('printGuide debe bloquear exportación si el plan está restringido y usar iframe aislado cuando está habilitado', () => {
      restrictedSignal.set(true);
      component.printGuide();
      expect(openUpgradeModalSpy).toHaveBeenCalledWith('workshop_export', 'pro');
      expect(document.querySelector('.rta-print-iframe')).toBeNull();

      restrictedSignal.set(false);
      component.printGuide();
      const iframe = document.querySelector('.rta-print-iframe') as HTMLIFrameElement | null;
      expect(iframe).not.toBeNull();
      expect(iframe?.contentDocument?.body.innerHTML).toContain('Alacena Sobre-Nevera 90cm');
      expect(iframe?.contentDocument?.body.innerHTML).toContain('P7');
    });
  });
});
