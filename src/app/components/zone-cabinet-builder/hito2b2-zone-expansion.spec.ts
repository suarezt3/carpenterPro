import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { User } from '@supabase/supabase-js';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Material,
  ParametricCabinetConfig,
  Part,
  ProjectSettings
} from '../../models/melamine.models';
import { AssemblyGuideService } from '../../services/assembly-guide.service';
import {
  CabinetGeneratorService,
  computeZoneBoundsLayout,
  splitBackPanelAroundHoles
} from '../../services/cabinet-generator.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { CurrencyExchangeService } from '../../services/currency-exchange.service';
import { CutOptimizerService } from '../../services/cut-optimizer.service';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';
import { I18nService } from '../../services/i18n.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { PartGeometryService } from '../../services/part-geometry.service';
import { PaymentService } from '../../services/payment.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { SupabaseService, SyncStatus } from '../../services/supabase.service';
import { TemplatesCatalogService } from '../../services/templates-catalog.service';
import { ThemeService } from '../../services/theme.service';
import { BudgetViewComponent } from '../budget-view/budget-view';
import { Furniture3dViewerComponent } from '../furniture-3d-viewer/furniture-3d-viewer';
import {
  LabelsViewComponent,
  resolvePartTechnicalCutBadge,
  resolvePartTechnicalRoleBadge
} from '../labels-view/labels-view';
import { ModuleDesignerComponent } from '../module-designer/module-designer';
import { PartsListComponent } from '../parts-list/parts-list';
import { ZoneCabinetBuilderComponent } from './zone-cabinet-builder';

interface ViewerInitInternals {
  initThree: () => void;
}

interface ViewerPieceObjectEntry {
  part: Part;
  mesh: THREE.Mesh;
  isDoor?: boolean;
  isSlidingDoor?: boolean;
  doorPivot?: THREE.Group;
  handleGroup?: THREE.Group;
  hingeGroup?: THREE.Group;
  slideGroup?: THREE.Group;
  slideAxis?: 'x' | 'y' | 'z';
  slideDir?: number;
}

interface ViewerSceneInternals {
  initThree: () => void;
  scene: THREE.Scene;
  furnitureGroup: THREE.Group;
  selectionOutlineGroup: THREE.Group;
  zoneHighlightGroup: THREE.Group;
  dimensionGroup: THREE.Group;
  gizmoGroup: THREE.Group;
  drillGroup: THREE.Group;
  internalClearanceGroup: THREE.Group;
  pieceObjects: ViewerPieceObjectEntry[];
  pieceObjectMap: Map<string, ViewerPieceObjectEntry>;
  buildFurnitureScene: (
    parts: Part[],
    selectedIds: string[],
    materials: Material[],
    isXRay: boolean,
    showDims: boolean
  ) => void;
}

const EXPANSION_MATERIALS: Material[] = [
  {
    id: 'mat_blanco_15',
    name: 'Melamina Blanco Mate 15mm',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 145000,
    hasGrain: false,
    colorHex: '#f8fafc',
    category: 'board'
  },
  {
    id: 'mat_roble_18',
    name: 'Melamina Roble Natural 18mm',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 185000,
    hasGrain: true,
    colorHex: '#c29b68',
    category: 'board'
  },
  {
    id: 'mat_mdf_3',
    name: 'Fondo MDF 3mm',
    thickness: 3,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 35000,
    hasGrain: false,
    colorHex: '#e4e4e7',
    family: 'mdf_back',
    category: 'mdf'
  }
];

const EXPANSION_SETTINGS: ProjectSettings = {
  sawKerf: 4,
  trimMargin: 10,
  defaultBoardThickness: 15,
  thinEdgeThickness: 0.45,
  thickEdgeThickness: 2.0,
  thinEdgeCostPerMeter: 1500,
  thickEdgeCostPerMeter: 3500,
  optimizationPreference: 'best_fit',
  currency: 'COP'
};

function createMockSupabase(): Partial<SupabaseService> {
  return {
    isAuthenticated: signal(false),
    isAuthLoading: signal(false),
    currentUser: signal<User | null>(null),
    userProfile: signal(null),
    cloudProjects: signal([]),
    syncStatus: signal<SyncStatus>('idle'),
    lastSyncTime: signal<Date | null>(null),
    signOut: vi.fn().mockResolvedValue(undefined),
    refreshProjects: vi.fn().mockResolvedValue([]),
    saveProject: vi.fn().mockResolvedValue(null)
  };
}

function attachHeadlessScene(viewer: Furniture3dViewerComponent): ViewerSceneInternals {
  const internals = viewer as unknown as ViewerSceneInternals;
  internals.scene = new THREE.Scene();
  internals.scene.add(internals.furnitureGroup);
  internals.scene.add(internals.selectionOutlineGroup);
  internals.scene.add(internals.zoneHighlightGroup);
  internals.scene.add(internals.dimensionGroup);
  internals.scene.add(internals.gizmoGroup);
  internals.scene.add(internals.drillGroup);
  internals.scene.add(internals.internalClearanceGroup);
  return internals;
}

function assertFinitePartsAndZeroCollisions(
  parts: Part[],
  joinery: JoineryEngineService
): void {
  expect(parts.length).toBeGreaterThan(0);
  for (const part of parts) {
    expect(Number.isFinite(part.length)).toBe(true);
    expect(Number.isFinite(part.width)).toBe(true);
    expect(Number.isFinite(part.thickness)).toBe(true);
    expect(Number.isFinite(part.posX ?? 0)).toBe(true);
    expect(Number.isFinite(part.posY ?? 0)).toBe(true);
    expect(Number.isFinite(part.posZ ?? 0)).toBe(true);
    expect(Number.isFinite(part.rotationX ?? 0)).toBe(true);
    expect(Number.isFinite(part.rotationY ?? 0)).toBe(true);
    expect(Number.isFinite(part.rotationZ ?? 0)).toBe(true);
    expect(part.length).toBeGreaterThan(0);
    expect(part.width).toBeGreaterThan(0);
    expect(part.thickness).toBeGreaterThan(0);
  }
  const physicalParts = parts.filter(
    p => !p.excludeFromCutlist || p.componentRole === 'accessory'
  );
  const directCols = joinery.detectCollisions(physicalParts);
  const analysisCols = joinery.calculateJoinery(physicalParts).collisions;
  expect(directCols.length).toBe(0);
  expect(analysisCols.length).toBe(0);
}

function computeGroupCenterX(
  parts: Part[],
  joinery: JoineryEngineService
): number {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const part of parts) {
    const b = joinery.getPartBounds(part);
    if (b.minX < minX) minX = b.minX;
    if (b.maxX > maxX) maxX = b.maxX;
  }
  return (minX + maxX) / 2;
}

function findButtonByExactText(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(
    btn => btn.textContent?.replace(/\s+/g, ' ').trim() === text
  ) as HTMLButtonElement | undefined;
}

function findButtonContainingText(root: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find(btn =>
    btn.textContent?.replace(/\s+/g, ' ').includes(text)
  ) as HTMLButtonElement | undefined;
}

function setInputAndDispatch(
  input: HTMLInputElement,
  value: string,
  eventType: 'input' | 'change' = 'change'
): void {
  input.value = value;
  input.dispatchEvent(new Event(eventType));
}

function createBaseCabinetConfig(
  overrides: Partial<ParametricCabinetConfig> = {}
): ParametricCabinetConfig {
  return {
    code: 'H2B2_TEST',
    name: 'Módulo Hito 2B-2',
    moduleType: 'custom',
    category: 'custom',
    width: 800,
    height: 800,
    depth: 560,
    structureThickness: 15,
    doorThickness: 15,
    backThickness: 3,
    backType: 'groove',
    hasBackPanel: true,
    shelvesCount: 0,
    doorOpening: 'none',
    structureMaterialId: 'mat_blanco_15',
    doorMaterialId: 'mat_blanco_15',
    backMaterialId: 'mat_mdf_3',
    handleType: 'bar_modern',
    handleFinish: 'brushed_steel',
    facadeGap: 3,
    installationType: 'floor',
    baseType: 'plinth',
    plinthHeight: 80,
    plinthRecessMm: 40,
    ...overrides
  };
}

describe('Hito 2B-2 Expansión de Zonas, Puertas Especiales, Vitrina e Interiores', () => {
  let fixture: ComponentFixture<ModuleDesignerComponent>;
  let designer: ModuleDesignerComponent;
  let hostEl: HTMLElement;
  let projectService: ProjectStorageService;
  let cabinetGen: CabinetGeneratorService;
  let joineryEngine: JoineryEngineService;
  let hardwareCatalog: HardwareCatalogService;
  let cutOptimizer: CutOptimizerService;
  let assemblyGuide: AssemblyGuideService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as ViewerInitInternals,
      'initThree'
    ).mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [
        ModuleDesignerComponent,
        PartsListComponent,
        LabelsViewComponent,
        BudgetViewComponent
      ],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: createMockSupabase() },
        ProjectStorageService,
        TemplatesCatalogService,
        CabinetGeneratorService,
        ConfirmDialogService,
        CurrencyExchangeService,
        JoineryEngineService,
        PartGeometryService,
        HardwareCatalogService,
        CutOptimizerService,
        AssemblyGuideService,
        PaymentService,
        ThemeService,
        I18nService
      ]
    }).compileComponents();

    TestBed.inject(I18nService).setLanguage('es');
    projectService = TestBed.inject(ProjectStorageService);
    cabinetGen = TestBed.inject(CabinetGeneratorService);
    joineryEngine = TestBed.inject(JoineryEngineService);
    hardwareCatalog = TestBed.inject(HardwareCatalogService);
    cutOptimizer = TestBed.inject(CutOptimizerService);
    assemblyGuide = TestBed.inject(AssemblyGuideService);

    projectService.clearFurniture();
    projectService.updateProject(
      p => ({
        ...p,
        materials: [...EXPANSION_MATERIALS],
        settings: { ...EXPANSION_SETTINGS }
      }),
      false
    );

    fixture = TestBed.createComponent(ModuleDesignerComponent);
    designer = fixture.componentInstance;
    fixture.detectChanges();
    hostEl = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    fixture?.destroy();
    projectService?.flushPendingStorageSave();
    vi.restoreAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  function openZoneBuilder(): {
    builder: ZoneCabinetBuilderComponent;
    builderEl: HTMLElement;
    groupId: string;
  } {
    designer.openZoneBuilderNew();
    fixture.detectChanges();
    const groupId = designer.zoneBuilderEditingGroupId()!;
    const builder = designer.zoneBuilderRef()!;
    const builderEl = hostEl.querySelector('app-zone-cabinet-builder') as HTMLElement;
    expect(builder).toBeTruthy();
    expect(builderEl).toBeTruthy();
    return { builder, builderEl, groupId };
  }

  describe('Caso 1 — Cajoneras Avanzadas (Personalizadas, Internos + Regleta Paso Bisagra, Oculta vs Telescópica)', () => {
    it('debe configurar 3 cajones en modo Personalizadas (140, 280, 280 mm) respetando >= 90 mm, proporción con altura de zona, 0 NaN y 0 colisiones', () => {
      const { builder, builderEl, groupId } = openZoneBuilder();

      // Altura 789 mm con zócalo 80 mm y facadeGap 3 mm => vano frontal disponible = 700 mm exactos (140 + 280 + 280)
      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '800', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-height') as HTMLInputElement, '789', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-depth') as HTMLInputElement, '560', 'change');
      fixture.detectChanges();

      findButtonByExactText(builderEl, 'Cajonera')!.click();
      fixture.detectChanges();
      builder.setDrawersCount(3);
      fixture.detectChanges();

      findButtonByExactText(builderEl, 'Personalizadas')!.click();
      fixture.detectChanges();

      const hInput0 = builderEl.querySelector('#zcb-drawer-h-0') as HTMLInputElement | null;
      const hInput1 = builderEl.querySelector('#zcb-drawer-h-1') as HTMLInputElement | null;
      const hInput2 = builderEl.querySelector('#zcb-drawer-h-2') as HTMLInputElement | null;
      expect(hInput0).toBeTruthy();
      expect(hInput1).toBeTruthy();
      expect(hInput2).toBeTruthy();

      // Intentar bajar por debajo del mínimo técnico de 90 mm debe quedar acotado >= 90 mm
      setInputAndDispatch(hInput0!, '50', 'change');
      fixture.detectChanges();
      expect(builder.selectedDrawerHeightsMm()[0]).toBeGreaterThanOrEqual(90);

      // Asignar 140 mm al cajón superior -> los dos restantes quedan en 280 mm y 280 mm
      setInputAndDispatch(hInput0!, '140', 'change');
      fixture.detectChanges();
      expect(builder.selectedDrawerHeightsMm()).toEqual([140, 280, 280]);
      expect(Number(hInput0!.value)).toBe(140);
      expect(Number(hInput1!.value)).toBe(280);
      expect(Number(hInput2!.value)).toBe(280);

      const parts789 = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(parts789, joineryEngine);

      const fronts789 = parts789
        .filter(p => p.componentRole === 'drawer_front')
        .sort((a, b) => (b.posY ?? 0) - (a.posY ?? 0));
      expect(fronts789.length).toBe(3);
      expect(fronts789[0].width).toBeCloseTo(140, 1);
      expect(fronts789[1].width).toBeCloseTo(280, 1);
      expect(fronts789[2].width).toBeCloseTo(280, 1);
      expect(fronts789.every(f => f.width >= 90)).toBe(true);

      // Escalar la altura del mueble (+200 mm -> 989 mm) manteniendo customHeightsMm [140, 280, 280]
      setInputAndDispatch(builderEl.querySelector('#zcb-height') as HTMLInputElement, '989', 'change');
      fixture.detectChanges();

      const scaledHeights = builder.selectedDrawerHeightsMm();
      expect(scaledHeights.length).toBe(3);
      expect(scaledHeights.every(h => Number.isFinite(h) && h >= 90)).toBe(true);
      expect(scaledHeights.reduce((sum, h) => sum + h, 0)).toBeCloseTo(900, 1);
      expect(scaledHeights[0]).toBeLessThan(scaledHeights[1]);
      expect(scaledHeights[1]).toBeCloseTo(scaledHeights[2], 1);

      const genRes = cabinetGen.generateZoneCabinet(
        createBaseCabinetConfig({
          width: 800,
          height: 989,
          depth: 560,
          zoneTree: {
            id: 'z_custom_scaled',
            splitDirection: 'none',
            content: {
              type: 'drawers',
              drawers: {
                count: 3,
                frontMount: 'overlay',
                deductTopMm: 0,
                deductBottomMm: 0,
                deductLeftMm: 0,
                deductRightMm: 0,
                openingSystem: 'handle',
                slideType: 'telescopic',
                bottomType: 'grooved',
                heightDistribution: 'custom',
                customHeightsMm: [140, 280, 280]
              }
            }
          }
        }),
        EXPANSION_MATERIALS
      );
      assertFinitePartsAndZeroCollisions(genRes.parts, joineryEngine);
      const genFronts = genRes.parts
        .filter(p => p.componentRole === 'drawer_front')
        .sort((a, b) => (b.posY ?? 0) - (a.posY ?? 0));
      expect(genFronts.length).toBe(3);
      expect(genFronts[0].width).toBeCloseTo(scaledHeights[0], 1);
      expect(genFronts[1].width).toBeCloseTo(scaledHeights[1], 1);
      expect(genFronts[2].width).toBeCloseTo(scaledHeights[2], 1);
    }, 20000);

    it('debe soportar Cajonera Interna (Tras Puerta) y toggle Con Puerta Exterior con Regleta Paso Bisagra, retranqueo Z >= 20 mm, descuento de ancho, 0 colisiones y salida en Despiece/Etiquetas', () => {
      const { builder, builderEl, groupId } = openZoneBuilder();

      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '800', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-height') as HTMLInputElement, '900', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-depth') as HTMLInputElement, '580', 'change');
      fixture.detectChanges();

      // 1) Toggle 'Con Puerta Exterior' desde una zona de cajonera
      findButtonByExactText(builderEl, 'Cajonera')!.click();
      fixture.detectChanges();
      expect(findButtonByExactText(builderEl, 'Solapado (Overlay)')).toBeTruthy();

      findButtonContainingText(builderEl, 'Con Puerta Exterior')!.click();
      fixture.detectChanges();

      expect(builder.selectedZoneNode().content?.type).toBe('doors');
      expect(builder.selectedZoneInternalDrawers()).toBeTruthy();
      expect(builder.selectedZoneInternalDrawers()!.isInternal).toBe(true);
      expect(builder.selectedZoneInternalDrawers()!.frontMount).toBe('inset');
      // Controles de montaje exterior solapado de cajón quedan ocultos al pasar a internos
      expect(findButtonByExactText(builderEl, 'Solapado (Overlay)')).toBeUndefined();
      expect(builderEl.querySelector('#zcb-hinge-spacer-width')).toBeTruthy();
      expect(builderEl.querySelector('#zcb-internal-setback')).toBeTruthy();

      // 2) Flujo directo desde Puertas Batientes: activar/desactivar 'Cajonera Interna (Tras Puerta)'
      findButtonByExactText(builderEl, 'Izq.')!.click();
      fixture.detectChanges();
      const toggleInternalBtn = findButtonContainingText(builderEl, 'Cajonera Interna (Tras Puerta)')!;
      expect(toggleInternalBtn).toBeTruthy();
      expect(toggleInternalBtn.getAttribute('aria-pressed')).toBe('true');

      // Desactivar y reactivar via DOM
      toggleInternalBtn.click();
      fixture.detectChanges();
      expect(builder.selectedZoneInternalDrawers()).toBeNull();
      toggleInternalBtn.click();
      fixture.detectChanges();
      expect(builder.selectedZoneInternalDrawers()).toBeTruthy();
      expect(builder.selectedZoneInternalDrawers()!.hingeSpacerLeft).toBe(true);
      expect(builder.selectedZoneInternalDrawers()!.hingeSpacerRight).toBe(false);

      const leftDoorParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(leftDoorParts, joineryEngine);
      const leftSpacers = leftDoorParts.filter(p => p.hardwareConfig?.isHingeSpacer === true);
      expect(leftSpacers.length).toBe(1);
      expect(leftSpacers[0].name).toContain('Izquierda');
      expect(leftSpacers[0].length).toBe(30);

      // Cambiar apertura a Doble -> genera 2 regletas (izquierda + derecha) de 30 mm
      findButtonByExactText(builderEl, 'Doble')!.click();
      fixture.detectChanges();
      expect(builder.selectedZoneInternalDrawers()!.hingeSpacerLeft).toBe(true);
      expect(builder.selectedZoneInternalDrawers()!.hingeSpacerRight).toBe(true);

      const doubleParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(doubleParts, joineryEngine);
      const doubleSpacers = doubleParts.filter(p => p.hardwareConfig?.isHingeSpacer === true);
      expect(doubleSpacers.length).toBe(2);
      expect(doubleSpacers.every(sp => sp.length === 30)).toBe(true);

      // Verificar retranqueo Z detrás de las puertas (>= 20 mm)
      const doors = doubleParts.filter(p => p.componentRole === 'door');
      const internalFronts = doubleParts.filter(
        p => p.componentRole === 'drawer_front' && p.hardwareConfig?.isInternalDrawerFront === true
      );
      expect(doors.length).toBe(2);
      expect(internalFronts.length).toBe(3);

      const minDoorBackZ = Math.min(...doors.map(d => joineryEngine.getPartBounds(d).minZ));
      const maxInternalFrontZ = Math.max(
        ...internalFronts.map(f => joineryEngine.getPartBounds(f).maxZ)
      );
      expect(minDoorBackZ - maxInternalFrontZ).toBeGreaterThanOrEqual(20);

      // Verificar descuento de ancho en frente y caja respecto a cajonera interna sin regletas
      const noSpacerCfg = createBaseCabinetConfig({
        width: 800,
        height: 900,
        depth: 580,
        zoneTree: {
          id: 'z_int_nospacer',
          splitDirection: 'none',
          content: {
            type: 'doors',
            doors: {
              opening: 'double',
              mount: 'overlay',
              hasHandle: true,
              openingSystem: 'handle',
              handleType: 'bar_modern'
            },
            internalDrawers: {
              count: 3,
              frontMount: 'inset',
              deductTopMm: 0,
              deductBottomMm: 0,
              deductLeftMm: 0,
              deductRightMm: 0,
              openingSystem: 'finger_pull',
              slideType: 'telescopic',
              bottomType: 'grooved',
              isInternal: true,
              hingeSpacerLeft: false,
              hingeSpacerRight: false,
              internalSetbackMm: 22
            }
          }
        }
      });
      const noSpacerGen = cabinetGen.generateZoneCabinet(noSpacerCfg, EXPANSION_MATERIALS);
      const noSpacerFront = noSpacerGen.parts.find(p => p.componentRole === 'drawer_front')!;
      const noSpacerContrafrente = noSpacerGen.parts.find(
        p => p.componentRole === 'drawer_box' && p.name.includes('Contrafrente')
      )!;
      const doubleContrafrente = doubleParts.find(
        p => p.componentRole === 'drawer_box' && p.name.includes('Contrafrente')
      )!;
      expect(noSpacerFront.length - internalFronts[0].length).toBeCloseTo(60, 1);
      expect(noSpacerContrafrente.length - doubleContrafrente.length).toBeCloseTo(60, 1);

      // Verificar presencia en CutOptimizerService, PartsListComponent y LabelsViewComponent
      const cuttable = cutOptimizer.getCuttableParts(doubleParts, EXPANSION_MATERIALS);
      expect(cuttable.filter(p => p.hardwareConfig?.isHingeSpacer === true).length).toBe(2);
      expect(cuttable.filter(p => p.hardwareConfig?.isInternalDrawerFront === true).length).toBe(3);

      const optRes = cutOptimizer.optimizeProject(doubleParts, EXPANSION_MATERIALS, EXPANSION_SETTINGS);
      expect(optRes.unplacedParts.length).toBe(0);

      expect(resolvePartTechnicalRoleBadge(doubleSpacers[0])).toBe('Regleta Paso Bisagra');
      expect(resolvePartTechnicalRoleBadge(internalFronts[0])).toBe('Cajón Interno');
      expect(resolvePartTechnicalCutBadge(internalFronts[0])).toBe('Corte a 45° · Uñero');

      const partsListFixture = TestBed.createComponent(PartsListComponent);
      partsListFixture.detectChanges();
      const partsListComp = partsListFixture.componentInstance;
      expect(
        partsListComp.melamineParts().filter(p => p.hardwareConfig?.isHingeSpacer === true).length
      ).toBe(2);
      expect(partsListComp.resolvePartTechnicalRoleBadge(doubleSpacers[0])).toBe(
        'Regleta Paso Bisagra'
      );
      expect(partsListComp.resolvePartTechnicalRoleBadge(internalFronts[0])).toBe('Cajón Interno');
      partsListFixture.destroy();

      const labelsFixture = TestBed.createComponent(LabelsViewComponent);
      labelsFixture.detectChanges();
      const labelsComp = labelsFixture.componentInstance;
      const spacerLabels = labelsComp
        .flatLabels()
        .filter(lbl => lbl.technicalRoleBadge === 'Regleta Paso Bisagra');
      expect(spacerLabels.length).toBe(2);
      labelsFixture.destroy();
    }, 20000);

    it('debe comparar corredera telescópica (13 mm/lado) vs oculta bajo cajón (5 mm/lado y 14 mm inferior) en geometría de caja y presupuesto', () => {
      const { builder, builderEl, groupId } = openZoneBuilder();

      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '800', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-height') as HTMLInputElement, '820', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-depth') as HTMLInputElement, '560', 'change');
      fixture.detectChanges();

      findButtonByExactText(builderEl, 'Cajonera')!.click();
      fixture.detectChanges();
      builder.setDrawersCount(3);
      fixture.detectChanges();

      // 1) Telescópica (13mm/lado -> 26mm total)
      findButtonByExactText(builderEl, 'Telescópica (13mm/lado)')!.click();
      fixture.detectChanges();

      const teleParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(teleParts, joineryEngine);
      const teleLatIzq = teleParts.find(p => p.name.includes('Cajón Inferior - Lateral Izquierdo'))!;
      const teleLatDer = teleParts.find(p => p.name.includes('Cajón Inferior - Lateral Derecho'))!;
      const teleContrafrente = teleParts.find(
        p => p.name.includes('Cajón Inferior - Contrafrente')
      )!;
      const teleBottomBoard = teleParts.find(p => p.componentRole === 'bottom')!;
      const teleBoxSpanX =
        joineryEngine.getPartBounds(teleLatDer).maxX - joineryEngine.getPartBounds(teleLatIzq).minX;
      const teleBottomClearance =
        joineryEngine.getPartBounds(teleLatIzq).minY -
        joineryEngine.getPartBounds(teleBottomBoard).maxY;

      const teleHw = hardwareCatalog.computeRequiredHardwareList(teleParts);
      expect(teleHw.find(h => h.id === 'hw_correderas')?.quantity).toBe(3);
      expect(teleHw.find(h => h.id === 'hw_correderas_oculta')).toBeUndefined();

      // 2) Oculta Bajo Cajón (5mm/lado -> 10mm total, 14mm inferior)
      findButtonByExactText(builderEl, 'Oculta Bajo Cajón (Cierre Suave)')!.click();
      fixture.detectChanges();

      const underParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(underParts, joineryEngine);
      const underLatIzq = underParts.find(p => p.name.includes('Cajón Inferior - Lateral Izquierdo'))!;
      const underLatDer = underParts.find(p => p.name.includes('Cajón Inferior - Lateral Derecho'))!;
      const underContrafrente = underParts.find(
        p => p.name.includes('Cajón Inferior - Contrafrente')
      )!;
      const underBottomBoard = underParts.find(p => p.componentRole === 'bottom')!;
      const underBoxSpanX =
        joineryEngine.getPartBounds(underLatDer).maxX - joineryEngine.getPartBounds(underLatIzq).minX;
      const underBottomClearance =
        joineryEngine.getPartBounds(underLatIzq).minY -
        joineryEngine.getPartBounds(underBottomBoard).maxY;

      const innerW = 800 - 2 * 15; // 770 mm
      expect(teleBoxSpanX).toBeCloseTo(innerW - 26, 1);
      expect(underBoxSpanX).toBeCloseTo(innerW - 10, 1);
      expect(underContrafrente.length - teleContrafrente.length).toBeCloseTo(16, 1);
      expect(underBottomClearance).toBeGreaterThanOrEqual(14 - 0.1);
      expect(underBottomClearance).toBeGreaterThan(teleBottomClearance);

      const underHw = hardwareCatalog.computeRequiredHardwareList(underParts);
      expect(underHw.find(h => h.id === 'hw_correderas_oculta')?.quantity).toBe(3);
      expect(underHw.find(h => h.id === 'hw_correderas')).toBeUndefined();
    }, 15000);
  });

  describe('Caso 2 — Puertas Especiales y Vitrina (Exclusión Optimizador Melamina)', () => {
    it('debe soportar Abatible Superior (pistones a gas, oculta posición vertical manija) y Abatible Inferior (hw_compas_abatible)', () => {
      const { builderEl, groupId } = openZoneBuilder();
      const viewer = designer.viewer3d()!;
      const viewerInternals = attachHeadlessScene(viewer);

      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '800', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-height') as HTMLInputElement, '500', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-depth') as HTMLInputElement, '350', 'change');
      fixture.detectChanges();

      findButtonByExactText(builderEl, 'Puertas')!.click();
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Con Manija')!.click();
      fixture.detectChanges();
      expect(findButtonByExactText(builderEl, 'Superior')).toBeTruthy();

      // 1) Abatible Superior (opening: 'top')
      findButtonByExactText(builderEl, 'Abat. Sup.')!.click();
      fixture.detectChanges();

      // Oculta botones de posición vertical (Superior/Centrada/Inferior) en UI DOM
      expect(findButtonByExactText(builderEl, 'Superior')).toBeUndefined();
      expect(findButtonByExactText(builderEl, 'Centrada')).toBeUndefined();
      expect(findButtonByExactText(builderEl, 'Inferior')).toBeUndefined();
      expect(builderEl.textContent).toContain('2 pistones a gas');
      expect(builderEl.textContent).toContain('Manija horizontal fija en borde inferior');

      const topParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(topParts, joineryEngine);
      const topDoor = topParts.find(p => p.componentRole === 'door')!;
      expect(topDoor.hardwareConfig?.openingDirection).toBe('top');
      expect(topDoor.hardwareConfig?.hingeType).toBe('gas_piston');
      expect(topDoor.hardwareConfig?.handlePosition).toBe('horizontal');

      const topHw = hardwareCatalog.computeRequiredHardwareList(topParts);
      expect(topHw.find(h => h.id === 'hw_piston_gas')?.quantity).toBe(2);
      expect(topHw.find(h => h.id === 'hw_bisagra_35')?.quantity).toBeGreaterThanOrEqual(2);

      viewerInternals.buildFurnitureScene(topParts, [], EXPANSION_MATERIALS, false, false);
      const topDoorEntry = viewerInternals.pieceObjectMap.get(topDoor.id)!;
      expect(topDoorEntry).toBeDefined();
      expect(topDoorEntry.hingeGroup).toBeDefined();
      const cupHinges = topDoorEntry.hingeGroup!.children.filter(
        c => c.name === 'internal_cup_hinge_35'
      );
      expect(cupHinges.length).toBeGreaterThanOrEqual(2);
      expect(cupHinges.every(h => h.position.y > 0)).toBe(true);
      const pistonGroup = topDoorEntry.hingeGroup!.getObjectByName('door_pistons_pivot_space');
      expect(pistonGroup?.getObjectByName('piston_left')).toBeTruthy();
      expect(pistonGroup?.getObjectByName('piston_right')).toBeTruthy();
      expect(topDoorEntry.handleGroup?.position.y ?? 0).toBeLessThan(0);

      viewer.setDoorOpeningAngleDeg(topDoor.id, 80);
      expect(topDoorEntry.doorPivot?.rotation.x ?? 0).toBeLessThan(0);

      // 2) Abatible Inferior (opening: 'bottom')
      findButtonByExactText(builderEl, 'Abat. Inf.')!.click();
      fixture.detectChanges();
      expect(findButtonByExactText(builderEl, 'Superior')).toBeUndefined();
      expect(builderEl.textContent).toContain('Manija horizontal fija en borde superior');

      const botParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(botParts, joineryEngine);
      const botDoor = botParts.find(p => p.componentRole === 'door')!;
      expect(botDoor.hardwareConfig?.openingDirection).toBe('bottom');
      expect(botDoor.hardwareConfig?.handlePosition).toBe('horizontal');

      const botHw = hardwareCatalog.computeRequiredHardwareList(botParts);
      expect(botHw.find(h => h.id === 'hw_compas_abatible')?.quantity).toBe(2);
      expect(botHw.find(h => h.id === 'hw_bisagra_35')?.quantity).toBeGreaterThanOrEqual(2);

      viewerInternals.buildFurnitureScene(botParts, [], EXPANSION_MATERIALS, false, false);
      const botDoorEntry = viewerInternals.pieceObjectMap.get(botDoor.id)!;
      viewer.setDoorOpeningAngleDeg(botDoor.id, 80);
      expect(botDoorEntry.doorPivot?.rotation.x ?? 0).toBeGreaterThan(0);
    }, 15000);

    it('debe validar Puertas Corredizas (2 y 3 hojas >= 900 mm, regla UI < 900 mm, retranqueo >= 60 mm, sin bisagras, rieles 3D y kit en presupuesto)', () => {
      const { builder, builderEl, groupId } = openZoneBuilder();
      const viewer = designer.viewer3d()!;
      const viewerInternals = attachHeadlessScene(viewer);

      // Ancho < 900 mm -> botón Corredizas deshabilitado con regla UI
      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '800', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-height') as HTMLInputElement, '2000', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-depth') as HTMLInputElement, '600', 'change');
      fixture.detectChanges();

      findButtonByExactText(builderEl, 'Puertas')!.click();
      fixture.detectChanges();
      const slidingBtnNarrow = findButtonByExactText(builderEl, 'Corredizas')!;
      expect(slidingBtnNarrow.disabled).toBe(true);
      expect(builderEl.textContent).toContain('900 mm');

      // Subir ancho a 1800 mm (>= 900 mm) y añadir repisas interiores para validar retranqueo >= 60 mm
      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '1800', 'change');
      fixture.detectChanges();
      expect(findButtonByExactText(builderEl, 'Corredizas')!.disabled).toBe(false);

      findButtonByExactText(builderEl, 'Corredizas')!.click();
      fixture.detectChanges();
      builderEl.querySelector<HTMLButtonElement>('button[aria-label="Aumentar repisas interiores"]')!.click();
      builderEl.querySelector<HTMLButtonElement>('button[aria-label="Aumentar repisas interiores"]')!.click();
      fixture.detectChanges();

      expect(findButtonByExactText(builderEl, 'Solapada (Overlay)')).toBeUndefined();
      expect(builder.selectedZoneNode().content?.doors?.slidingLeavesCount).toBe(2);

      // 1) 2 hojas corredizas
      const parts2Leaves = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(parts2Leaves, joineryEngine);
      const doors2 = parts2Leaves.filter(p => p.componentRole === 'door');
      const rails2 = parts2Leaves.filter(
        p => p.componentRole === 'accessory' && p.materialId === 'hw_sliding_track'
      );
      const shelves2 = parts2Leaves.filter(p => p.componentRole === 'shelf');
      expect(doors2.length).toBe(2);
      expect(doors2.every(d => d.hardwareConfig?.hingeType === 'none')).toBe(true);
      expect(rails2.length).toBe(2);
      expect(rails2.some(r => r.name.includes('Riel Superior'))).toBe(true);
      expect(rails2.some(r => r.name.includes('Riel Inferior'))).toBe(true);

      const carcassFrontZ = Math.max(
        ...parts2Leaves
          .filter(p => p.componentRole === 'side_left' || p.componentRole === 'side_right')
          .map(s => joineryEngine.getPartBounds(s).maxZ)
      );
      const maxShelfZ = Math.max(...shelves2.map(s => joineryEngine.getPartBounds(s).maxZ));
      expect(carcassFrontZ - maxShelfZ).toBeGreaterThanOrEqual(60);

      const hw2 = hardwareCatalog.computeRequiredHardwareList(parts2Leaves);
      expect(hw2.find(h => h.id === 'hw_kit_closet')?.quantity).toBe(1);
      expect(hw2.find(h => h.id === 'hw_riel_corredizo')?.unit).toBe('metro');
      expect(hw2.find(h => h.id === 'hw_bisagra_35')).toBeUndefined();

      // 2) 3 hojas corredizas
      findButtonContainingText(builderEl, '3 Hojas')!.click();
      fixture.detectChanges();
      expect(builder.selectedZoneNode().content?.doors?.slidingLeavesCount).toBe(3);

      const parts3Leaves = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(parts3Leaves, joineryEngine);
      const doors3 = parts3Leaves.filter(p => p.componentRole === 'door');
      const rails3 = parts3Leaves.filter(
        p => p.componentRole === 'accessory' && p.materialId === 'hw_sliding_track'
      );
      expect(doors3.length).toBe(3);
      expect(doors3.every(d => d.hardwareConfig?.hingeType === 'none')).toBe(true);
      expect(doors3.every(d => d.hardwareConfig?.slidingLeavesCount === 3)).toBe(true);
      expect(rails3.length).toBe(2);

      const hw3 = hardwareCatalog.computeRequiredHardwareList(parts3Leaves);
      expect(hw3.find(h => h.id === 'hw_kit_closet')?.quantity).toBe(1);
      expect(hw3.find(h => h.id === 'hw_bisagra_35')).toBeUndefined();

      // Verificar en visor 3D headless: sin bisagras, traslación lineal en X al abrir
      viewerInternals.buildFurnitureScene(parts3Leaves, [], EXPANSION_MATERIALS, false, false);
      const sortedDoors = [...doors3].sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));
      const leftLeafEntry = viewerInternals.pieceObjectMap.get(sortedDoors[0].id)!;
      const rightLeafEntry = viewerInternals.pieceObjectMap.get(sortedDoors[2].id)!;
      expect(leftLeafEntry.isSlidingDoor).toBe(true);
      expect(leftLeafEntry.hingeGroup).toBeUndefined();

      const leftStartX = leftLeafEntry.mesh.position.x;
      const rightStartX = rightLeafEntry.mesh.position.x;
      viewer.setDoorOpeningAngleDeg(sortedDoors[0].id, 90);
      viewer.setDoorOpeningAngleDeg(sortedDoors[2].id, 90);
      expect(leftLeafEntry.mesh.position.x).toBeGreaterThan(leftStartX);
      expect(rightLeafEntry.mesh.position.x).toBeLessThan(rightStartX);
    }, 15000);

    it('debe excluir puertas Vitrina del CutOptimizerService, listarlas en la sección Vitrina de PartsListComponent sin tapacantos, sumar m² vidrio y ml aluminio y renderizar marco+vidrio translúcido en 3D', () => {
      const { builder, builderEl, groupId } = openZoneBuilder();
      const viewer = designer.viewer3d()!;
      const viewerInternals = attachHeadlessScene(viewer);

      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '1200', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-height') as HTMLInputElement, '1000', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-depth') as HTMLInputElement, '450', 'change');
      fixture.detectChanges();

      builderEl.querySelector<HTMLButtonElement>('button[aria-label="Agregar división vertical"]')!.click();
      fixture.detectChanges();
      const col1Id = builder.zoneTree().children![0].id;
      const col2Id = builder.zoneTree().children![1].id;

      // Columna 1: Vitrina Marco Negro Mate + Vidrio Bronce Ahumado
      builder.selectZone(col1Id);
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Puertas')!.click();
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Vitrina (Aluminio + Vidrio)')!.click();
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Negro Mate')!.click();
      findButtonByExactText(builderEl, 'Bronce / Ahumado')!.click();
      fixture.detectChanges();

      // Columna 2: Vitrina Marco Dorado + Vidrio Esmerilado
      builder.selectZone(col2Id);
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Puertas')!.click();
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Vitrina (Aluminio + Vidrio)')!.click();
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Dorado')!.click();
      findButtonByExactText(builderEl, 'Esmerilado')!.click();
      fixture.detectChanges();

      expect(builderEl.textContent).not.toContain('Hoja melamínica sólida con tapacanto perimetral');

      const allParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(allParts, joineryEngine);
      const vitrinaDoors = allParts.filter(p => p.hardwareConfig?.doorPanelStyle === 'vitrina');
      expect(vitrinaDoors.length).toBe(2);
      expect(vitrinaDoors.every(d => d.excludeFromCutlist === true)).toBe(true);
      expect(vitrinaDoors.every(d => d.materialId === 'vitrina_aluminio_vidrio')).toBe(true);

      // 1) Exclusión estricta de láminas de melamina en CutOptimizerService
      const cuttable = cutOptimizer.getCuttableParts(allParts, EXPANSION_MATERIALS);
      expect(cuttable.some(p => p.hardwareConfig?.doorPanelStyle === 'vitrina')).toBe(false);
      const sheetTypes = cutOptimizer.listSheetTypes(allParts, EXPANSION_MATERIALS);
      expect(sheetTypes.some(st => st.material.id === 'vitrina_aluminio_vidrio')).toBe(false);

      const optRes = cutOptimizer.optimizeProject(allParts, EXPANSION_MATERIALS, EXPANSION_SETTINGS);
      expect(optRes.unplacedParts.length).toBe(0);
      for (const sheet of optRes.sheets) {
        expect(
          sheet.placedParts.some(pp => pp.part.hardwareConfig?.doorPanelStyle === 'vitrina')
        ).toBe(false);
      }

      // 2) Sección dedicada en PartsListComponent sin controles de tapacanto ni veta
      const partsListFixture = TestBed.createComponent(PartsListComponent);
      partsListFixture.detectChanges();
      const partsListComp = partsListFixture.componentInstance;
      const partsListEl = partsListFixture.nativeElement as HTMLElement;

      expect(
        partsListComp.melamineParts().some(p => p.hardwareConfig?.doorPanelStyle === 'vitrina')
      ).toBe(false);
      expect(partsListComp.vitrinaParts().length).toBe(2);

      const vitrinaSection = partsListEl.querySelector(
        '[data-testid="parts-list-vitrina-section"]'
      ) as HTMLElement | null;
      expect(vitrinaSection).toBeTruthy();
      expect(vitrinaSection!.textContent).toContain('Puertas Vitrina (Marco Aluminio + Vidrio)');
      expect(vitrinaSection!.textContent).toContain('Negro Mate');
      expect(vitrinaSection!.textContent).toContain('Dorado');
      expect(vitrinaSection!.textContent).toContain('Bronce Humo 4mm');
      expect(vitrinaSection!.textContent).toContain('Esmerilado 4mm');
      expect(vitrinaSection!.textContent).toContain('m²');
      expect(vitrinaSection!.textContent).toContain('ml');
      expect(vitrinaSection!.querySelectorAll('button[title*="tapacanto"]').length).toBe(0);
      expect(vitrinaSection!.querySelectorAll('button[title*="veta"]').length).toBe(0);
      partsListFixture.destroy();

      // 3) Presupuesto en HardwareCatalogService (m² vidrio + metro aluminio) y BudgetViewComponent
      const hwList = hardwareCatalog.computeRequiredHardwareList(allParts);
      const doorMatte = vitrinaDoors.find(
        d => d.hardwareConfig?.vitrinaFrameFinish === 'matte_black'
      )!;
      const doorGold = vitrinaDoors.find(d => d.hardwareConfig?.vitrinaFrameFinish === 'gold')!;
      const expectedMatteM = Math.round(((2 * (doorMatte.length + doorMatte.width)) / 1000) * 100) / 100;
      const expectedGoldM = Math.round(((2 * (doorGold.length + doorGold.width)) / 1000) * 100) / 100;
      const expectedBronzeM2 = Math.round(((doorMatte.length * doorMatte.width) / 1_000_000) * 100) / 100;
      const expectedFrostedM2 = Math.round(((doorGold.length * doorGold.width) / 1_000_000) * 100) / 100;

      const itemMatte = hwList.find(h => h.id === 'hw_vitrina_marco_matte_black');
      const itemGold = hwList.find(h => h.id === 'hw_vitrina_marco_gold');
      const itemBronze = hwList.find(h => h.id === 'hw_vitrina_vidrio_bronze_smoked');
      const itemFrosted = hwList.find(h => h.id === 'hw_vitrina_vidrio_frosted');

      expect(itemMatte?.unit).toBe('metro');
      expect(itemMatte?.quantity).toBeCloseTo(expectedMatteM, 2);
      expect(itemGold?.unit).toBe('metro');
      expect(itemGold?.quantity).toBeCloseTo(expectedGoldM, 2);
      expect(itemBronze?.unit).toBe('m²');
      expect(itemBronze?.quantity).toBeCloseTo(expectedBronzeM2, 2);
      expect(itemFrosted?.unit).toBe('m²');
      expect(itemFrosted?.quantity).toBeCloseTo(expectedFrostedM2, 2);

      // Verificar también variante vidrio Transparente ('clear')
      const clearGen = cabinetGen.generateZoneCabinet(
        createBaseCabinetConfig({
          width: 600,
          height: 800,
          zoneTree: {
            id: 'z_vitrina_clear',
            splitDirection: 'none',
            content: {
              type: 'doors',
              doors: {
                opening: 'left',
                mount: 'overlay',
                hasHandle: true,
                panelStyle: 'vitrina',
                vitrinaFrameFinish: 'matte_black',
                vitrinaGlassType: 'clear'
              }
            }
          }
        }),
        EXPANSION_MATERIALS
      );
      const clearHw = hardwareCatalog.computeRequiredHardwareList(clearGen.parts);
      expect(clearHw.find(h => h.id === 'hw_vitrina_vidrio_clear')?.unit).toBe('m²');

      const budgetFixture = TestBed.createComponent(BudgetViewComponent);
      budgetFixture.detectChanges();
      const budgetComp = budgetFixture.componentInstance;
      expect(budgetComp.getHardwareQtyStep('m²')).toBe(0.01);
      expect(budgetComp.formatHardwareQuantity(itemBronze!)).toBe(expectedBronzeM2.toFixed(2));
      budgetFixture.destroy();

      // 4) Visor 3D headless: marco metálico (4 barras) + vidrio translúcido (clear, bronze_smoked, frosted)
      const clearDoorPart = clearGen.parts.find(p => p.componentRole === 'door')!;
      const clearDoorCheck: Part = { ...clearDoorPart, id: 'vitrina_clear_3d', posX: -900 };
      viewerInternals.buildFurnitureScene(
        [...allParts, clearDoorCheck],
        [],
        EXPANSION_MATERIALS,
        false,
        false
      );

      const matteEntry = viewerInternals.pieceObjectMap.get(doorMatte.id)!;
      const goldEntry = viewerInternals.pieceObjectMap.get(doorGold.id)!;
      const clearEntry = viewerInternals.pieceObjectMap.get(clearDoorCheck.id)!;

      const matteGlassMat = matteEntry.mesh.material as THREE.MeshStandardMaterial;
      const goldGlassMat = goldEntry.mesh.material as THREE.MeshStandardMaterial;
      const clearGlassMat = clearEntry.mesh.material as THREE.MeshStandardMaterial;

      expect(matteGlassMat.transparent).toBe(true);
      expect(matteGlassMat.depthWrite).toBe(false);
      expect(matteGlassMat.opacity).toBeCloseTo(0.48, 2);
      expect(goldGlassMat.transparent).toBe(true);
      expect(goldGlassMat.opacity).toBeCloseTo(0.68, 2);
      expect(goldGlassMat.roughness).toBeGreaterThan(0.5);
      expect(clearGlassMat.transparent).toBe(true);
      expect(clearGlassMat.opacity).toBeCloseTo(0.28, 2);

      const getFrameBars = (mesh: THREE.Mesh): THREE.Mesh[] =>
        mesh.children.filter(
          (ch): ch is THREE.Mesh =>
            ch instanceof THREE.Mesh && ch.userData?.['isVitrinaFrameBar'] === true
        );
      const matteBars = getFrameBars(matteEntry.mesh);
      const goldBars = getFrameBars(goldEntry.mesh);
      expect(matteBars.length).toBe(4);
      expect(goldBars.length).toBe(4);
      expect((matteBars[0].material as THREE.MeshStandardMaterial).color.getHexString()).toBe('18181b');
      expect((goldBars[0].material as THREE.MeshStandardMaterial).color.getHexString()).toBe('d97706');
    }, 20000);
  });

  describe('Caso 3 — Interiores Especiales y Regletas Laterales', () => {
    it('debe diferenciar Repisas Fijas (0 soportes en presupuesto) vs Repisas Móviles (4 soportes por repisa)', () => {
      const { builder, builderEl, groupId } = openZoneBuilder();

      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '800', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-height') as HTMLInputElement, '1200', 'change');
      fixture.detectChanges();

      findButtonByExactText(builderEl, 'Repisas Móviles')!.click();
      fixture.detectChanges();
      builderEl.querySelector<HTMLButtonElement>('button[aria-label="Aumentar repisas"]')!.click();
      fixture.detectChanges();

      // 1) Repisas Móviles (3 repisas -> 12 soportes)
      expect(builder.selectedZoneNode().content?.shelvesCount).toBe(3);
      expect(builder.selectedZoneNode().content?.shelvesFixed).toBe(false);
      expect(Number((builderEl.querySelector('#zcb-shelf-setback') as HTMLInputElement).value)).toBe(18);

      const movableParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(movableParts, joineryEngine);
      const movableShelves = movableParts.filter(p => p.componentRole === 'shelf');
      expect(movableShelves.length).toBe(3);
      expect(movableShelves.every(s => s.hardwareConfig?.isMovableShelf === true)).toBe(true);
      expect(resolvePartTechnicalRoleBadge(movableShelves[0])).toBe('Repisa Móvil');

      const movableHw = hardwareCatalog.computeRequiredHardwareList(movableParts);
      expect(movableHw.find(h => h.id === 'hw_soportes_repisa')?.quantity).toBe(12);

      // 2) Repisas Fijas (0 soportes en presupuesto y guía)
      findButtonByExactText(builderEl, 'Fija (Estructural)')!.click();
      fixture.detectChanges();
      expect(builder.selectedZoneNode().content?.shelvesFixed).toBe(true);
      expect(Number((builderEl.querySelector('#zcb-shelf-setback') as HTMLInputElement).value)).toBe(0);
      expect(findButtonByExactText(builderEl, 'Repisas Fijas')).toBeTruthy();

      const fixedParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(fixedParts, joineryEngine);
      const fixedShelves = fixedParts.filter(p => p.componentRole === 'shelf');
      expect(fixedShelves.length).toBe(3);
      expect(
        fixedShelves.every(
          s => s.hardwareConfig?.isStructuralFixedShelf === true && s.hardwareConfig?.isMovableShelf === false
        )
      ).toBe(true);
      expect(resolvePartTechnicalRoleBadge(fixedShelves[0])).toBe('Repisa Fija');

      const fixedHw = hardwareCatalog.computeRequiredHardwareList(fixedParts);
      expect(fixedHw.find(h => h.id === 'hw_soportes_repisa')).toBeUndefined();

      const guidesFixed = assemblyGuide.generateGuidesForProject(projectService.currentProject());
      expect(guidesFixed[0].hardwareKit.find(h => h.id === 'shelf_pins')).toBeUndefined();
    }, 15000);

    it('debe generar Zapatero (4 niveles a 15° y 20°, tope melamina y aluminio) con 0 NaN/colisiones, salida en Despiece/Optimizador/Etiquetas/Presupuesto y rotación 90° sin rotura', () => {
      const { builder, builderEl, groupId } = openZoneBuilder();

      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '800', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-height') as HTMLInputElement, '1200', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-depth') as HTMLInputElement, '500', 'change');
      fixture.detectChanges();

      findButtonByExactText(builderEl, 'Zapatero')!.click();
      fixture.detectChanges();
      expect(builder.selectedZoneNode().content?.shoeRack?.levelsCount).toBe(4);

      // 1) 15° + Tope Melamina
      findButtonByExactText(builderEl, '15°')!.click();
      findButtonByExactText(builderEl, 'Melamina')!.click();
      fixture.detectChanges();

      const parts15Mel = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(parts15Mel, joineryEngine);
      const shelves15 = parts15Mel.filter(
        p => p.componentRole === 'shelf' && p.hardwareConfig?.shoeRackAngleDeg === 15
      );
      const stops15Mel = parts15Mel.filter(
        p => p.componentRole === 'tie' && p.hardwareConfig?.shoeRackFrontStopType === 'melamine'
      );
      expect(shelves15.length).toBe(4);
      expect(stops15Mel.length).toBe(4);
      expect(shelves15.every(s => s.rotationX === -15)).toBe(true);
      expect(stops15Mel.every(st => st.rotationX === -15)).toBe(true);
      expect(resolvePartTechnicalCutBadge(shelves15[0])).toBe('Zapatero (15°)');

      const opt15Mel = cutOptimizer.optimizeProject(parts15Mel, EXPANSION_MATERIALS, EXPANSION_SETTINGS);
      expect(opt15Mel.unplacedParts.length).toBe(0);
      const hw15Mel = hardwareCatalog.computeRequiredHardwareList(parts15Mel);
      expect(hw15Mel.find(h => h.id === 'hw_tope_zapatero_aluminio')).toBeUndefined();
      expect(hw15Mel.find(h => h.id === 'hw_soportes_repisa')).toBeUndefined();

      // 2) 20° + Tope Perfil Aluminio
      findButtonByExactText(builderEl, '20°')!.click();
      findButtonByExactText(builderEl, 'Perfil Aluminio')!.click();
      fixture.detectChanges();

      const parts20Alu = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(parts20Alu, joineryEngine);
      const shelves20 = parts20Alu.filter(
        p => p.componentRole === 'shelf' && p.hardwareConfig?.shoeRackAngleDeg === 20
      );
      const stops20Alu = parts20Alu.filter(
        p =>
          p.componentRole === 'accessory' &&
          p.materialId === 'hw_shoe_stop_aluminum' &&
          p.hardwareConfig?.shoeRackFrontStopType === 'aluminum_profile'
      );
      expect(shelves20.length).toBe(4);
      expect(stops20Alu.length).toBe(4);
      expect(shelves20.every(s => s.rotationX === -20)).toBe(true);
      expect(stops20Alu.every(st => st.excludeFromCutlist === true)).toBe(true);
      expect(resolvePartTechnicalCutBadge(shelves20[0])).toBe('Zapatero (20°)');

      const hw20Alu = hardwareCatalog.computeRequiredHardwareList(parts20Alu);
      const aluItem = hw20Alu.find(h => h.id === 'hw_tope_zapatero_aluminio');
      expect(aluItem?.unit).toBe('metro');
      const expectedStopMeters =
        Math.round((stops20Alu.reduce((sum, s) => sum + s.length, 0) / 1000) * 100) / 100;
      expect(aluItem?.quantity).toBeCloseTo(expectedStopMeters, 2);

      const partsListFixture = TestBed.createComponent(PartsListComponent);
      partsListFixture.detectChanges();
      const partsListComp = partsListFixture.componentInstance;
      expect(
        partsListComp.melamineParts().filter(p => p.hardwareConfig?.shoeRackAngleDeg === 20).length
      ).toBe(4);
      expect(partsListComp.resolvePartTechnicalRoleBadge(shelves20[0])).toBe('Zapatero 20°');
      partsListFixture.destroy();

      const labelsFixture = TestBed.createComponent(LabelsViewComponent);
      labelsFixture.detectChanges();
      expect(
        labelsFixture.componentInstance.flatLabels().filter(l => l.technicalCutBadge === 'Zapatero (20°)')
          .length
      ).toBe(4);
      labelsFixture.destroy();

      // 3) Rotación 90° en ModuleDesignerComponent sin NaN ni colisiones
      designer.onGroupRotationRequested({ groupId, deltaAngle: 90 });
      fixture.detectChanges();
      expect(projectService.getGroupFacingDirection(groupId)).toBe('right');
      const rotatedParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(rotatedParts, joineryEngine);
      const rotatedShelves = rotatedParts.filter(
        p => p.componentRole === 'shelf' && p.hardwareConfig?.shoeRackAngleDeg === 20
      );
      expect(rotatedShelves.length).toBe(4);
      expect(rotatedShelves.every(s => Math.abs(s.rotationZ ?? 0) === 20)).toBe(true);
      expect(resolvePartTechnicalCutBadge(rotatedShelves[0])).toBe('Zapatero (20°)');
    }, 15000);

    it('debe generar Nicho Electrodoméstico (oven_60 564x595 y microwave_60 564x385) con entrepaño reforzado, recorte real del fondo trasero (splitBackPanelAroundHoles), paso de ventilación en guía y 0 colisiones', () => {
      // 1) Verificar helper puro splitBackPanelAroundHoles alrededor de un nicho centrado
      const splitRects = splitBackPanelAroundHoles(
        { minX: 0, maxX: 600, minY: 0, maxY: 2000 },
        [{ minX: 150, maxX: 450, minY: 700, maxY: 1300 }],
        25
      );
      expect(splitRects.length).toBe(4);
      for (const rect of splitRects) {
        const overlapsHoleX = rect.maxX > 150.5 && rect.minX < 449.5;
        const overlapsHoleY = rect.maxY > 700.5 && rect.minY < 1299.5;
        expect(overlapsHoleX && overlapsHoleY).toBe(false);
      }

      // 2) Mueble torre con Nicho en zona central (cajones abajo, nicho en medio, repisas arriba)
      const { builder, builderEl, groupId } = openZoneBuilder();
      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '600', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-height') as HTMLInputElement, '2000', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-depth') as HTMLInputElement, '580', 'change');
      fixture.detectChanges();

      builderEl
        .querySelector<HTMLButtonElement>('button[aria-label="Agregar división horizontal"]')!
        .click();
      fixture.detectChanges();
      const topZoneId = builder.zoneTree().children![0].id;
      const lowerZoneId = builder.zoneTree().children![1].id;

      builder.selectZone(topZoneId);
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Repisas Móviles')!.click();
      fixture.detectChanges();

      builder.selectZone(lowerZoneId);
      fixture.detectChanges();
      builderEl
        .querySelector<HTMLButtonElement>('button[aria-label="Agregar división horizontal"]')!
        .click();
      fixture.detectChanges();
      const nicheZoneId = builder.zoneTree().children![1].children![0].id;
      const bottomZoneId = builder.zoneTree().children![1].children![1].id;

      builder.selectZone(bottomZoneId);
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Cajonera')!.click();
      fixture.detectChanges();

      builder.selectZone(nicheZoneId);
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Nicho Equipo')!.click();
      fixture.detectChanges();

      // Horno 60cm (564 x 595) con ventilación trasera abierta
      findButtonContainingText(builderEl, 'Horno 60cm (564×595)')!.click();
      fixture.detectChanges();
      expect(Number((builderEl.querySelector('#zcb-niche-width') as HTMLInputElement).value)).toBe(564);
      expect(Number((builderEl.querySelector('#zcb-niche-height') as HTMLInputElement).value)).toBe(595);

      const ovenParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(ovenParts, joineryEngine);

      const reinforcedShelf = ovenParts.find(
        p =>
          p.name.includes('Entrepaño Reforzado Nicho Electrodoméstico') &&
          p.hardwareConfig?.isStructuralFixedShelf === true &&
          p.hardwareConfig?.isMovableShelf === false
      );
      expect(reinforcedShelf).toBeDefined();

      // Verificar apertura real del fondo trasero detrás del nicho
      const ovenLayout = computeZoneBoundsLayout(builder.currentConfig());
      const findNicheLayout = (n: ReturnType<typeof computeZoneBoundsLayout>): ReturnType<typeof computeZoneBoundsLayout> | null => {
        if (n.zoneId === nicheZoneId) return n;
        for (const ch of n.children) {
          const hit = findNicheLayout(ch);
          if (hit) return hit;
        }
        return null;
      };
      const nicheLayout = findNicheLayout(ovenLayout)!;
      expect(nicheLayout).toBeTruthy();

      const backPanelsOpen = ovenParts.filter(p => p.componentRole === 'back');
      expect(backPanelsOpen.length).toBeGreaterThanOrEqual(2);
      for (const bp of backPanelsOpen) {
        const b = joineryEngine.getPartBounds(bp);
        const overlapsY = b.maxY > nicheLayout.minY + 1 && b.minY < nicheLayout.maxY - 1;
        expect(overlapsY).toBe(false);
      }

      const guidesOven = assemblyGuide.generateGuidesForProject(projectService.currentProject());
      const stepBack = guidesOven[0].steps.find(s => s.actionType === 'back');
      const stepShelves = guidesOven[0].steps.find(s => s.actionType === 'shelves');
      expect(stepBack?.tips.some(t => t.includes('Ventilación Nicho Electrodoméstico'))).toBe(true);
      expect(stepShelves?.tips.some(t => t.includes('Nicho Electrodoméstico'))).toBe(true);

      // Cambiar a Microondas 60cm (564 x 385)
      findButtonContainingText(builderEl, 'Microondas 60cm (564×385)')!.click();
      fixture.detectChanges();
      expect(Number((builderEl.querySelector('#zcb-niche-width') as HTMLInputElement).value)).toBe(564);
      expect(Number((builderEl.querySelector('#zcb-niche-height') as HTMLInputElement).value)).toBe(385);

      const microParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(microParts, joineryEngine);
      expect(
        microParts.some(p => p.notes?.includes('564×385mm') && p.notes?.includes('Ventilación trasera abierta'))
      ).toBe(true);

      // Desactivar ventilación trasera -> fondo trasero vuelve a ser 1 panel continuo
      findButtonContainingText(builderEl, 'Ventilación Trasera Abierta')!.click();
      fixture.detectChanges();
      const closedBackParts = designer
        .currentParts()
        .filter(p => p.groupId === groupId && p.componentRole === 'back');
      expect(closedBackParts.length).toBe(1);
    }, 20000);

    it('debe mostrar advertencia sutil UI en Barra Colgadora doble cuando innerHeight < 1500 mm y sumar tubos + bridas en presupuesto', () => {
      const { builder, builderEl, groupId } = openZoneBuilder();

      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '900', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-height') as HTMLInputElement, '1400', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-depth') as HTMLInputElement, '600', 'change');
      fixture.detectChanges();

      findButtonByExactText(builderEl, 'Barra Colgadora')!.click();
      fixture.detectChanges();
      findButtonContainingText(builderEl, '2 Barras')!.click();
      fixture.detectChanges();

      expect(builder.showHangingRodHeightWarning()).toBe(true);
      expect(builderEl.textContent).toContain('menor a 1500 mm');

      const shortParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(shortParts, joineryEngine);
      const shortHw = hardwareCatalog.computeRequiredHardwareList(shortParts);
      expect(shortHw.find(h => h.id === 'hw_tubo_colgador')?.quantity).toBe(2);
      expect(shortHw.find(h => h.id === 'hw_bridas_tubo_colgador')?.quantity).toBe(4);

      // Subir altura a 1800 mm (innerHeight >= 1500 mm) -> desaparece advertencia
      setInputAndDispatch(builderEl.querySelector('#zcb-height') as HTMLInputElement, '1800', 'change');
      fixture.detectChanges();
      expect(builder.showHangingRodHeightWarning()).toBe(false);
      expect(builderEl.textContent).not.toContain('menor a 1500 mm');
    }, 15000);

    it('debe generar Regleta de Ajuste Izquierda/Derecha (50 mm) a ras del frente en Despiece/Optimizador/Presupuesto/Etiquetas y mantener estable centerX en ModuleDesignerComponent', () => {
      const { builder, builderEl, groupId } = openZoneBuilder();

      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '800', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-height') as HTMLInputElement, '800', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-depth') as HTMLInputElement, '500', 'change');
      fixture.detectChanges();

      findButtonByExactText(builderEl, 'Puertas')!.click();
      fixture.detectChanges();

      // Posicionar el mueble en X = 350 mm
      designer.updateSelectedGroupPosition('x', 350);
      fixture.detectChanges();

      const baselineParts = designer.currentParts().filter(p => p.groupId === groupId);
      const baselineCenterX = computeGroupCenterX(baselineParts, joineryEngine);
      const baselineLeftSideX = baselineParts.find(p => p.componentRole === 'side_left')!.posX!;
      const baselineRightSideX = baselineParts.find(p => p.componentRole === 'side_right')!.posX!;
      expect(baselineCenterX).toBeCloseTo(350, 1);

      // Activar SOLO Regleta de Ajuste Derecha (50 mm por defecto)
      findButtonByExactText(builderEl, 'Regleta de Ajuste Derecha')!.click();
      fixture.detectChanges();

      const rightFillerInput = builderEl.querySelector('#zcb-right-filler-width') as HTMLInputElement | null;
      expect(rightFillerInput).toBeTruthy();
      expect(Number(rightFillerInput!.value)).toBe(50);
      expect(builderEl.querySelector('[aria-label="Regleta lateral derecha"]')).toBeTruthy();

      const rightOnlyParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(rightOnlyParts, joineryEngine);

      const rightFiller = rightOnlyParts.find(
        p => p.hardwareConfig?.isFillerStrip === true && p.name.includes('Derecha')
      )!;
      expect(rightFiller).toBeDefined();
      expect(rightFiller.orientation).toBe('vertical_xy');
      expect(rightFiller.length).toBe(50);
      expect(rightFiller.excludeFromCutlist).toBe(false);

      // A ras del frente exterior (incluyendo frente de puerta solapada)
      const doorMaxZ = Math.max(
        ...rightOnlyParts
          .filter(p => p.componentRole === 'door')
          .map(d => joineryEngine.getPartBounds(d).maxZ)
      );
      const fillerBounds = joineryEngine.getPartBounds(rightFiller);
      expect(fillerBounds.maxZ).toBeCloseTo(doorMaxZ, 1);

      // Estabilidad del centerX del casco (sin desplazamiento lateral del mueble)
      const nonFillerAfterRight = rightOnlyParts.filter(p => !p.hardwareConfig?.isFillerStrip);
      expect(computeGroupCenterX(nonFillerAfterRight, joineryEngine)).toBeCloseTo(350, 1);
      expect(
        nonFillerAfterRight.find(p => p.componentRole === 'side_left')!.posX
      ).toBeCloseTo(baselineLeftSideX, 1);
      expect(
        nonFillerAfterRight.find(p => p.componentRole === 'side_right')!.posX
      ).toBeCloseTo(baselineRightSideX, 1);

      // Cambiar ancho con regleta derecha activa conserva centerX = 350 mm
      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '900', 'change');
      fixture.detectChanges();
      const nonFillerResized = designer
        .currentParts()
        .filter(p => p.groupId === groupId && !p.hardwareConfig?.isFillerStrip);
      expect(computeGroupCenterX(nonFillerResized, joineryEngine)).toBeCloseTo(350, 1);

      // Activar también Regleta de Ajuste Izquierda (50 mm)
      findButtonByExactText(builderEl, 'Regleta de Ajuste Izquierda')!.click();
      fixture.detectChanges();
      expect(builderEl.querySelector('[aria-label="Regleta lateral izquierda"]')).toBeTruthy();

      const bothFillerParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(bothFillerParts, joineryEngine);
      const fillers = bothFillerParts.filter(p => p.hardwareConfig?.isFillerStrip === true);
      expect(fillers.length).toBe(2);
      expect(fillers.every(f => f.length === 50)).toBe(true);
      expect(builder.currentConfig().leftFillerStripEnabled).toBe(true);
      expect(builder.currentConfig().rightFillerStripEnabled).toBe(true);

      // Presencia en Despiece, Optimizador, Presupuesto y Etiquetas
      const optFillers = cutOptimizer.optimizeProject(
        bothFillerParts,
        EXPANSION_MATERIALS,
        EXPANSION_SETTINGS
      );
      expect(optFillers.unplacedParts.length).toBe(0);
      expect(
        optFillers.sheets.some(s =>
          s.placedParts.some(pp => pp.part.hardwareConfig?.isFillerStrip === true)
        )
      ).toBe(true);

      const partsListFixture = TestBed.createComponent(PartsListComponent);
      partsListFixture.detectChanges();
      const partsListComp = partsListFixture.componentInstance;
      expect(
        partsListComp.melamineParts().filter(p => p.hardwareConfig?.isFillerStrip === true).length
      ).toBe(2);
      expect(partsListComp.resolvePartTechnicalRoleBadge(rightFiller)).toBe('Regleta Ajuste');
      partsListFixture.destroy();

      const budgetFixture = TestBed.createComponent(BudgetViewComponent);
      budgetFixture.detectChanges();
      expect(
        budgetFixture
          .componentInstance
          .optResult()
          .sheets.some(s => s.placedParts.some(pp => pp.part.hardwareConfig?.isFillerStrip === true))
      ).toBe(true);
      budgetFixture.destroy();

      expect(resolvePartTechnicalRoleBadge(rightFiller)).toBe('Regleta de Ajuste');
      const labelsFixture = TestBed.createComponent(LabelsViewComponent);
      labelsFixture.detectChanges();
      expect(
        labelsFixture.componentInstance.flatLabels().filter(l => l.technicalRoleBadge === 'Regleta de Ajuste')
          .length
      ).toBe(2);
      labelsFixture.destroy();
    }, 20000);
  });
});
