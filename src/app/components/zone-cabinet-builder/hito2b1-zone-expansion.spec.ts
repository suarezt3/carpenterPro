import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { User } from '@supabase/supabase-js';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CabinetGolaFinish,
  CabinetLegStyle,
  CabinetRodFinish,
  Material,
  ParametricCabinetConfig,
  Part,
  PartGroup,
  ProjectSettings
} from '../../models/melamine.models';
import { AssemblyGuideService } from '../../services/assembly-guide.service';
import { CabinetGeneratorService } from '../../services/cabinet-generator.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
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
import { Furniture3dViewerComponent } from '../furniture-3d-viewer/furniture-3d-viewer';
import {
  LabelsViewComponent,
  resolvePartTechnicalCutBadge
} from '../labels-view/labels-view';
import { ModuleDesignerComponent } from '../module-designer/module-designer';
import { ZoneCabinetBuilderComponent } from './zone-cabinet-builder';

interface ViewerInitInternals {
  initThree: () => void;
}

interface ViewerPieceObjectEntry {
  part: Part;
  mesh: THREE.Mesh;
  handleGroup?: THREE.Group;
  slideGroup?: THREE.Group;
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

function computeGroupVerticalBounds(
  parts: Part[],
  joinery: JoineryEngineService
): { minY: number; maxY: number; centerX: number; centerZ: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const part of parts) {
    const b = joinery.getPartBounds(part);
    if (b.minX < minX) minX = b.minX;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxY > maxY) maxY = b.maxY;
    if (b.minZ < minZ) minZ = b.minZ;
    if (b.maxZ > maxZ) maxZ = b.maxZ;
  }
  return {
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2
  };
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

function findButtonInSectionByLabel(
  root: HTMLElement,
  sectionHeading: string,
  buttonText: string
): HTMLButtonElement | undefined {
  const headingSpan = Array.from(root.querySelectorAll('span')).find(
    s => s.textContent?.replace(/\s+/g, ' ').trim() === sectionHeading
  );
  const container = headingSpan?.parentElement;
  if (!container) return undefined;
  return Array.from(container.querySelectorAll('button')).find(
    b => b.textContent?.replace(/\s+/g, ' ').trim() === buttonText
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

function setSelectAndDispatch(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event('change'));
}

describe('Hito 2B-1 Expansión Paramétrica por Zonas: Piso/Aéreo, Sistemas de Apertura y Materiales Independientes', () => {
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
      imports: [ModuleDesignerComponent, LabelsViewComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: createMockSupabase() },
        ProjectStorageService,
        TemplatesCatalogService,
        CabinetGeneratorService,
        ConfirmDialogService,
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

  function openBuilderWithTwoDrawerColumns(): {
    builder: ZoneCabinetBuilderComponent;
    builderEl: HTMLElement;
    groupId: string;
    col1Id: string;
    col2Id: string;
  } {
    designer.openZoneBuilderNew();
    fixture.detectChanges();

    const groupId = designer.zoneBuilderEditingGroupId()!;
    const builder = designer.zoneBuilderRef()!;
    const builderEl = hostEl.querySelector('app-zone-cabinet-builder') as HTMLElement;
    expect(builder).toBeTruthy();
    expect(builderEl).toBeTruthy();

    setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '1000', 'change');
    setInputAndDispatch(builderEl.querySelector('#zcb-height') as HTMLInputElement, '820', 'change');
    setInputAndDispatch(builderEl.querySelector('#zcb-depth') as HTMLInputElement, '580', 'change');
    fixture.detectChanges();

    const addVertBtn = builderEl.querySelector(
      'button[aria-label="Agregar división vertical"]'
    ) as HTMLButtonElement;
    addVertBtn.click();
    fixture.detectChanges();

    const col1Id = builder.zoneTree().children![0].id;
    const col2Id = builder.zoneTree().children![1].id;

    builder.selectZone(col1Id);
    fixture.detectChanges();
    findButtonByExactText(builderEl, 'Cajonera')!.click();
    fixture.detectChanges();
    builder.setDrawersCount(3);
    fixture.detectChanges();

    builder.selectZone(col2Id);
    fixture.detectChanges();
    findButtonByExactText(builderEl, 'Cajonera')!.click();
    fixture.detectChanges();
    builder.setDrawersCount(2);
    fixture.detectChanges();

    return { builder, builderEl, groupId, col1Id, col2Id };
  }

  describe('Caso 1 — Transición Piso <-> Aéreo (Listón Francés 45°, Colgadores, Amarres, Patas 4 vs 6, Zócalo, Sin Base, Sin Fondo)', () => {
    it('debe transicionar piso <-> aéreo en ModuleDesignerComponent preservando ambas columnas de cajones, 0 colisiones, hardware y visibilidad DOM estricta', () => {
      const { builder, builderEl, groupId, col1Id, col2Id } = openBuilderWithTwoDrawerColumns();

      // Mover módulo en escena antes de la transición para verificar preservación de X, Z y facing
      designer.updateSelectedGroupPosition('x', 320);
      designer.updateSelectedGroupPosition('z', -180);
      fixture.detectChanges();

      const floorPartsBaseline = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(floorPartsBaseline, joineryEngine);
      const floorBounds = computeGroupVerticalBounds(floorPartsBaseline, joineryEngine);
      expect(floorBounds.minY).toBeCloseTo(0, 1);
      expect(floorBounds.centerX).toBeCloseTo(320, 1);
      expect(floorBounds.centerZ).toBeCloseTo(-180, 1);
      expect(projectService.getGroupFacingDirection(groupId)).toBe('front');

      // Baseline del fondo ranurado en modo piso (en coordenadas canónicas para comparar retranqueo exacto t + 2 mm)
      const canonicalFloorGen = cabinetGen.generateZoneCabinet(
        {
          ...builder.currentConfig(),
          posX: 0,
          posY: builder.height() / 2,
          posZ: 0
        },
        EXPANSION_MATERIALS
      );
      const floorCanonicalBack = canonicalFloorGen.parts.find(p => p.componentRole === 'back')!;
      expect(floorCanonicalBack).toBeDefined();

      // Verificar controles de Piso presentes y controles Aéreos ausentes en DOM inicial
      expect(builderEl.querySelector('#zcb-plinth-height')).toBeTruthy();
      expect(builderEl.querySelector('#zcb-plinth-recess')).toBeTruthy();
      expect(builderEl.querySelector('button[aria-label="Sin Base"]')).toBeTruthy();
      expect(builderEl.querySelector('#zcb-elevation-y')).toBeNull();
      expect(builderEl.querySelector('#zcb-cleat-height')).toBeNull();
      expect(findButtonContainingText(builderEl, 'Listón Francés')).toBeUndefined();

      // 1) Cambiar a Aéreo / Flotante via DOM ('floor' -> 'wall', french_cleat, elevationY = 1400, backType = 'groove')
      findButtonByExactText(builderEl, 'Aéreo / Flotante')!.click();
      fixture.detectChanges();

      expect(builder.installationType()).toBe('wall');
      expect(builder.wallMountType()).toBe('french_cleat');
      expect(builder.elevationY()).toBe(1400);
      expect(builder.backType()).toBe('groove');

      // Controles de piso desaparecen estrictamente del DOM; controles aéreos y Listón Francés aparecen
      expect(builderEl.querySelector('#zcb-plinth-height')).toBeNull();
      expect(builderEl.querySelector('#zcb-plinth-recess')).toBeNull();
      expect(builderEl.querySelector('button[aria-label="Sin Base"]')).toBeNull();
      expect(findButtonByExactText(builderEl, 'Zócalo de Melamina')).toBeUndefined();
      expect(findButtonByExactText(builderEl, 'Patas de Apoyo')).toBeUndefined();

      const elevationInput = builderEl.querySelector('#zcb-elevation-y') as HTMLInputElement | null;
      const cleatHeightInput = builderEl.querySelector('#zcb-cleat-height') as HTMLInputElement | null;
      expect(elevationInput).toBeTruthy();
      expect(Number(elevationInput!.value)).toBe(1400);
      expect(cleatHeightInput).toBeTruthy();
      expect(findButtonContainingText(builderEl, '300 mm')).toBeTruthy();
      expect(findButtonContainingText(builderEl, '1400 mm')).toBeTruthy();
      expect(findButtonContainingText(builderEl, 'Listón Francés (Corte 45°)')).toBeTruthy();
      expect(findButtonByExactText(builderEl, 'Colgadores Ocultos')).toBeTruthy();
      expect(findButtonByExactText(builderEl, 'Amarres Traseros Directos')).toBeTruthy();
      expect(builderEl.querySelector('.zcb-wall-elevation-pill')).toBeTruthy();
      expect(builderEl.querySelector('.zcb-cleat-marker')).toBeTruthy();

      // Verificar presets de elevación 300 mm -> 1400 mm sobre el host
      findButtonContainingText(builderEl, '300 mm')!.click();
      fixture.detectChanges();
      expect(builder.elevationY()).toBe(300);
      expect(
        computeGroupVerticalBounds(
          designer.currentParts().filter(p => p.groupId === groupId),
          joineryEngine
        ).minY
      ).toBeCloseTo(300, 1);

      findButtonContainingText(builderEl, '1400 mm')!.click();
      fixture.detectChanges();
      expect(builder.elevationY()).toBe(1400);

      // Verificar geometría en modo Listón Francés 45°
      const wallCleatParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(wallCleatParts, joineryEngine);

      expect(wallCleatParts.filter(p => p.componentRole === 'plinth').length).toBe(0);
      expect(
        wallCleatParts.filter(
          p => p.componentRole === 'accessory' && (p.materialId || '').startsWith('hw_leg')
        ).length
      ).toBe(0);

      const wallCleatBounds = computeGroupVerticalBounds(wallCleatParts, joineryEngine);
      expect(wallCleatBounds.minY).toBeCloseTo(1400, 1);
      expect(wallCleatBounds.maxY).toBeCloseTo(1400 + 820, 1);
      expect(wallCleatBounds.centerX).toBeCloseTo(320, 1);
      expect(wallCleatBounds.centerZ).toBeCloseTo(-180, 1);
      expect(projectService.getGroupFacingDirection(groupId)).toBe('front');

      // Verificar 2 piezas de Listón Francés 45° espejo y longitud interior (w - 2*t con holgura 2mm)
      const cleatMueble = wallCleatParts.find(
        p => p.name === 'Listón Francés Mueble (Corte 45°)'
      )!;
      const cleatPared = wallCleatParts.find(
        p => p.name === 'Listón Francés Pared (Corte 45°)'
      )!;
      expect(cleatMueble).toBeDefined();
      expect(cleatPared).toBeDefined();
      const expectedInnerW = 1000 - 2 * 15;
      expect(cleatMueble.length).toBe(expectedInnerW - 2);
      expect(cleatPared.length).toBe(expectedInnerW - 2);
      expect(cleatMueble.bevelAngleDeg).toBe(45);
      expect(cleatPared.bevelAngleDeg).toBe(45);
      expect(cleatMueble.bevelEdge).toBe('l2');
      expect(cleatPared.bevelEdge).toBe('l1');
      expect(cleatMueble.notes).toContain('Corte a 45°');
      expect(cleatPared.notes).toContain('Corte a 45°');

      // Verificar retranqueo del fondo por cámara de listón francés (t + 2 mm)
      const canonicalWallCleat = cabinetGen.generateZoneCabinet(
        {
          ...builder.currentConfig(),
          posX: 0,
          posY: 1400 + builder.height() / 2,
          posZ: 0
        },
        EXPANSION_MATERIALS
      );
      const wallCleatCanonicalBack = canonicalWallCleat.parts.find(
        p => p.componentRole === 'back'
      )!;
      expect(wallCleatCanonicalBack.posZ! - floorCanonicalBack.posZ!).toBeCloseTo(15 + 2, 1);

      // Ambas columnas de cajones preservadas (3 + 2 = 5 frentes)
      const frontsWallCleat = wallCleatParts.filter(p => p.componentRole === 'drawer_front');
      expect(frontsWallCleat.length).toBe(5);
      expect(frontsWallCleat.filter(p => p.zoneId === col1Id).length).toBe(3);
      expect(frontsWallCleat.filter(p => p.zoneId === col2Id).length).toBe(2);

      // Presupuesto de herrajes para Listón Francés
      const hwCleat = hardwareCatalog.computeRequiredHardwareList(wallCleatParts);
      expect(hwCleat.find(h => h.id === 'hw_wall_anchor_kit')?.quantity).toBe(1);
      expect(hwCleat.find(h => h.id.startsWith('hw_leg') || h.id === 'hw_patas_niveladoras')).toBeUndefined();

      // 2) Cambiar a Colgadores Ocultos via DOM
      findButtonByExactText(builderEl, 'Colgadores Ocultos')!.click();
      fixture.detectChanges();
      expect(builder.wallMountType()).toBe('concealed_hanger');
      expect(builderEl.querySelector('#zcb-cleat-height')).toBeNull();

      const hangerParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(hangerParts, joineryEngine);
      const hangers = hangerParts.filter(
        p =>
          p.componentRole === 'accessory' &&
          p.materialId === 'hw_wall_concealed_hanger' &&
          p.hardwareConfig?.wallMountType === 'concealed_hanger'
      );
      expect(hangers.length).toBe(2);
      expect(
        hangerParts.filter(p => p.name.includes('Listón Francés')).length
      ).toBe(0);
      expect(hangerParts.filter(p => p.componentRole === 'drawer_front').length).toBe(5);
      const hwHangers = hardwareCatalog.computeRequiredHardwareList(hangerParts);
      expect(hwHangers.find(h => h.id === 'hw_concealed_hanger_kit')?.quantity).toBe(1);
      expect(hwHangers.find(h => h.id === 'hw_wall_anchor_kit')).toBeUndefined();

      // 3) Cambiar a Amarres Traseros Directos via DOM
      findButtonByExactText(builderEl, 'Amarres Traseros Directos')!.click();
      fixture.detectChanges();
      expect(builder.wallMountType()).toBe('direct_nailer');
      expect(builderEl.querySelector('#zcb-cleat-height')).toBeNull();

      const nailerParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(nailerParts, joineryEngine);
      const nailers = nailerParts.filter(
        p =>
          p.componentRole === 'tie' &&
          p.hardwareConfig?.wallMountType === 'direct_nailer'
      );
      expect(nailers.length).toBe(2);
      expect(nailers.every(n => n.width === 80)).toBe(true);
      expect(nailerParts.filter(p => p.componentRole === 'drawer_front').length).toBe(5);
      const hwNailers = hardwareCatalog.computeRequiredHardwareList(nailerParts);
      expect(hwNailers.find(h => h.id === 'hw_wall_anchor_kit')?.quantity).toBe(1);
      expect(hwNailers.find(h => h.id === 'hw_concealed_hanger_kit')).toBeUndefined();

      // 4) Probar 'Sin fondo' (backType = 'none'): oculta espesor y material del fondo, genera 0 piezas back
      findButtonInSectionByLabel(builderEl, 'Fondo / Trasera', 'Sin fondo')!.click();
      fixture.detectChanges();
      expect(builder.backType()).toBe('none');
      expect(builder.showBackDetailsControls()).toBe(false);
      expect(builderEl.querySelector('#zcb-back-material')).toBeNull();
      expect(builderEl.querySelector('#zcb-back-thickness')).toBeNull();
      expect(
        Array.from(builderEl.querySelectorAll('span')).some(
          s => s.textContent?.trim() === 'Espesor de Fondo'
        )
      ).toBe(false);

      const noBackParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(noBackParts, joineryEngine);
      expect(noBackParts.filter(p => p.componentRole === 'back').length).toBe(0);

      // Restaurar fondo ranurado para continuar
      findButtonInSectionByLabel(builderEl, 'Fondo / Trasera', 'Ranurado')!.click();
      fixture.detectChanges();
      expect(builderEl.querySelector('#zcb-back-material')).toBeTruthy();

      // 5) Regresar 'wall' -> 'floor' (baseType = 'legs'): limpia elevación a Y = 0, elimina controles de muro, 4 patas <= 1200 y 6 patas > 1200
      findButtonByExactText(builderEl, 'De Piso')!.click();
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Patas de Apoyo')!.click();
      fixture.detectChanges();

      expect(builder.installationType()).toBe('floor');
      expect(builder.baseType()).toBe('legs');
      expect(builderEl.querySelector('#zcb-elevation-y')).toBeNull();
      expect(builderEl.querySelector('#zcb-cleat-height')).toBeNull();
      expect(builderEl.querySelector('.zcb-wall-elevation-pill')).toBeNull();
      expect(findButtonContainingText(builderEl, 'Listón Francés')).toBeUndefined();

      const floorLegs1000Parts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(floorLegs1000Parts, joineryEngine);
      const floorLegsBounds = computeGroupVerticalBounds(floorLegs1000Parts, joineryEngine);
      expect(floorLegsBounds.minY).toBeCloseTo(0, 1);
      expect(floorLegsBounds.centerX).toBeCloseTo(320, 1);
      expect(floorLegsBounds.centerZ).toBeCloseTo(-180, 1);
      expect(projectService.getGroupFacingDirection(groupId)).toBe('front');

      // 4 patas para ancho <= 1200 (1000mm y frontera exacta 1200mm)
      expect(builder.legsCountPreview()).toBe(4);
      expect(
        floorLegs1000Parts.filter(
          p => p.componentRole === 'accessory' && (p.materialId || '').startsWith('hw_leg')
        ).length
      ).toBe(4);

      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '1200', 'change');
      fixture.detectChanges();
      expect(builder.legsCountPreview()).toBe(4);
      expect(
        designer
          .currentParts()
          .filter(
            p =>
              p.groupId === groupId &&
              p.componentRole === 'accessory' &&
              (p.materialId || '').startsWith('hw_leg')
          ).length
      ).toBe(4);

      // 6 patas para ancho > 1200 (1400mm) en todos los estilos de pata
      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '1400', 'change');
      fixture.detectChanges();
      expect(builder.legsCountPreview()).toBe(6);

      const legStyleExpectations: {
        style: CabinetLegStyle;
        buttonLabel: string;
        partMaterialId: string;
        budgetId: string;
      }[] = [
        {
          style: 'black_leveler',
          buttonLabel: 'Niveladora Negra',
          partMaterialId: 'hw_leg_black_leveler',
          budgetId: 'hw_leg_black_leveler'
        },
        {
          style: 'cylindrical_inox',
          buttonLabel: 'Cilíndrica Inox',
          partMaterialId: 'hw_leg_inox',
          budgetId: 'hw_patas_niveladoras'
        },
        {
          style: 'scandinavian_wood',
          buttonLabel: 'Nórdica Madera',
          partMaterialId: 'hw_leg_scandinavian_wood',
          budgetId: 'hw_leg_scandinavian_wood'
        },
        {
          style: 'hairpin_metal',
          buttonLabel: 'Horquilla Metálica',
          partMaterialId: 'hw_leg_hairpin_metal',
          budgetId: 'hw_leg_hairpin_metal'
        }
      ];

      for (const spec of legStyleExpectations) {
        findButtonByExactText(builderEl, spec.buttonLabel)!.click();
        fixture.detectChanges();
        const styledParts = designer.currentParts().filter(p => p.groupId === groupId);
        assertFinitePartsAndZeroCollisions(styledParts, joineryEngine);
        const legs = styledParts.filter(
          p => p.componentRole === 'accessory' && p.hardwareConfig?.legStyle === spec.style
        );
        expect(legs.length).toBe(6);
        expect(legs.every(l => l.materialId === spec.partMaterialId)).toBe(true);

        const hwLegs = hardwareCatalog.computeRequiredHardwareList(styledParts);
        expect(hwLegs.find(h => h.id === spec.budgetId)?.quantity).toBe(6);
      }

      // Ambas columnas de cajones siguen intactas tras todo el ciclo
      const finalParts = designer.currentParts().filter(p => p.groupId === groupId);
      const finalFronts = finalParts.filter(p => p.componentRole === 'drawer_front');
      expect(finalFronts.length).toBe(5);
      expect(finalFronts.filter(p => p.zoneId === col1Id).length).toBe(3);
      expect(finalFronts.filter(p => p.zoneId === col2Id).length).toBe(2);

      // 6) Verificar Zócalo (altura + retiro frontal) y Sin Base
      findButtonByExactText(builderEl, 'Zócalo de Melamina')!.click();
      fixture.detectChanges();
      setInputAndDispatch(
        builderEl.querySelector('#zcb-plinth-height') as HTMLInputElement,
        '110',
        'change'
      );
      setInputAndDispatch(
        builderEl.querySelector('#zcb-plinth-recess') as HTMLInputElement,
        '55',
        'change'
      );
      fixture.detectChanges();

      const plinthParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(plinthParts, joineryEngine);
      const plinthPieces = plinthParts.filter(p => p.componentRole === 'plinth');
      expect(plinthPieces.length).toBe(4);
      expect(plinthPieces.every(p => p.width === 110)).toBe(true);
      expect(
        plinthPieces.find(p => p.name === 'Zócalo Frontal')?.notes
      ).toContain('remetido 55mm');
      expect(computeGroupVerticalBounds(plinthParts, joineryEngine).minY).toBeCloseTo(0, 1);

      builderEl.querySelector<HTMLButtonElement>('button[aria-label="Sin Base"]')!.click();
      fixture.detectChanges();
      const noBaseParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(noBaseParts, joineryEngine);
      expect(noBaseParts.filter(p => p.componentRole === 'plinth').length).toBe(0);
      expect(
        noBaseParts.filter(
          p => p.componentRole === 'accessory' && (p.materialId || '').startsWith('hw_leg')
        ).length
      ).toBe(0);
      expect(computeGroupVerticalBounds(noBaseParts, joineryEngine).minY).toBeCloseTo(0, 1);
    }, 20000);

    it('debe preservar rotación 90° (facing right), coordenadas X/Z y columnas de cajones al transicionar piso -> aéreo -> piso en ModuleDesignerComponent', () => {
      const { builderEl, groupId, col1Id, col2Id } = openBuilderWithTwoDrawerColumns();

      designer.updateSelectedGroupPosition('x', 420);
      designer.updateSelectedGroupPosition('z', -260);
      designer.onGroupRotationRequested({ groupId, deltaAngle: 90 });
      fixture.detectChanges();
      expect(projectService.getGroupFacingDirection(groupId)).toBe('right');

      findButtonByExactText(builderEl, 'Aéreo / Flotante')!.click();
      fixture.detectChanges();

      const wallParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(wallParts, joineryEngine);
      const wallBounds = computeGroupVerticalBounds(wallParts, joineryEngine);
      expect(wallBounds.minY).toBeCloseTo(1400, 1);
      expect(wallBounds.centerX).toBeCloseTo(420, 1);
      expect(wallBounds.centerZ).toBeCloseTo(-260, 1);
      expect(projectService.getGroupFacingDirection(groupId)).toBe('right');

      const rotatedCleat = wallParts.find(
        p => p.name === 'Listón Francés Mueble (Corte 45°)'
      )!;
      expect(rotatedCleat).toBeDefined();
      const cleatBounds = joineryEngine.getPartBounds(rotatedCleat);
      expect(cleatBounds.sz).toBeCloseTo(1000 - 2 * 15 - 2, 1);
      expect(cleatBounds.sy).toBeCloseTo(80, 1);

      findButtonByExactText(builderEl, 'De Piso')!.click();
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Patas de Apoyo')!.click();
      fixture.detectChanges();

      const floorParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(floorParts, joineryEngine);
      const floorBounds = computeGroupVerticalBounds(floorParts, joineryEngine);
      expect(floorBounds.minY).toBeCloseTo(0, 1);
      expect(floorBounds.centerX).toBeCloseTo(420, 1);
      expect(floorBounds.centerZ).toBeCloseTo(-260, 1);
      expect(projectService.getGroupFacingDirection(groupId)).toBe('right');
      expect(floorParts.filter(p => p.zoneId === col1Id && p.componentRole === 'drawer_front').length).toBe(3);
      expect(floorParts.filter(p => p.zoneId === col2Id && p.componentRole === 'drawer_front').length).toBe(2);
    }, 15000);
  });

  describe('Caso 2 — Congruencia de Sistemas de Apertura, Manijas y Barras Colgadoras', () => {
    it('debe alternar Puertas y Cajones entre handle -> gola -> push -> finger_pull con visibilidad DOM estricta, barras Gola 3D, presupuesto y acabado de barra colgadora', () => {
      designer.openZoneBuilderNew();
      fixture.detectChanges();

      const groupId = designer.zoneBuilderEditingGroupId()!;
      const builder = designer.zoneBuilderRef()!;
      const builderEl = hostEl.querySelector('app-zone-cabinet-builder') as HTMLElement;
      const viewer = designer.viewer3d()!;
      const viewerInternals = attachHeadlessScene(viewer);

      setInputAndDispatch(builderEl.querySelector('#zcb-width') as HTMLInputElement, '1000', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-height') as HTMLInputElement, '2000', 'change');
      setInputAndDispatch(builderEl.querySelector('#zcb-depth') as HTMLInputElement, '600', 'change');
      fixture.detectChanges();

      // Dividir en 2 columnas: Col 1 = Puertas Doble con 1 Barra Colgadora; Col 2 = 4 Cajones
      builderEl.querySelector<HTMLButtonElement>('button[aria-label="Agregar división vertical"]')!.click();
      fixture.detectChanges();
      const col1Id = builder.zoneTree().children![0].id;
      const col2Id = builder.zoneTree().children![1].id;

      builder.selectZone(col1Id);
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Puertas')!.click();
      fixture.detectChanges();
      builder.setDoorOpening('double');
      builder.setInteriorHangingRodsForDoor(1);
      fixture.detectChanges();

      builder.selectZone(col2Id);
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Cajonera')!.click();
      fixture.detectChanges();
      builder.setDrawersCount(4);
      fixture.detectChanges();

      const assertNoHandleDomControls = () => {
        expect(builderEl.querySelector('#zcb-handle-type')).toBeNull();
        expect(builderEl.querySelector('#zcb-handle-finish')).toBeNull();
        expect(builderEl.querySelector('#zcb-drawer-handle-type')).toBeNull();
        expect(builderEl.querySelector('#zcb-drawer-handle-finish')).toBeNull();
        expect(
          Array.from(builderEl.querySelectorAll('label')).some(l =>
            l.textContent?.includes('Modelo de Manija')
          )
        ).toBe(false);
        expect(
          Array.from(builderEl.querySelectorAll('span')).some(
            s => s.textContent?.trim() === 'Posición'
          )
        ).toBe(false);
        expect(
          Array.from(builderEl.querySelectorAll('button')).some(b =>
            ['Superior', 'Centrada', 'Inferior'].includes(b.textContent?.trim() || '')
          )
        ).toBe(false);
      };

      // --- 1) Con Manija ('handle') ---
      builder.selectZone(col1Id);
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Con Manija')!.click();
      fixture.detectChanges();
      expect(builderEl.querySelector('#zcb-handle-type')).toBeTruthy();
      expect(builderEl.querySelector('#zcb-handle-finish')).toBeTruthy();
      expect(findButtonByExactText(builderEl, 'Superior')).toBeTruthy();
      expect(findButtonByExactText(builderEl, 'Centrada')).toBeTruthy();
      expect(findButtonByExactText(builderEl, 'Inferior')).toBeTruthy();
      findButtonByExactText(builderEl, 'Inferior')!.click();
      fixture.detectChanges();
      expect(builder.selectedZoneHandlePosition()).toBe('bottom');

      builder.selectZone(col2Id);
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Con Manija')!.click();
      fixture.detectChanges();
      expect(builderEl.querySelector('#zcb-drawer-handle-type')).toBeTruthy();
      expect(builderEl.querySelector('#zcb-drawer-handle-finish')).toBeTruthy();
      expect(findButtonByExactText(builderEl, 'Centrada')).toBeTruthy();

      const handleParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(handleParts, joineryEngine);
      const handleHw = hardwareCatalog.computeRequiredHardwareList(handleParts);
      expect(handleHw.find(h => h.id === 'hw_tiradores')?.quantity).toBe(6); // 2 puertas + 4 cajones

      viewerInternals.buildFurnitureScene(handleParts, [], EXPANSION_MATERIALS, false, false);
      const handleDoorMeshes = viewerInternals.pieceObjects.filter(
        po => po.part.componentRole === 'door'
      );
      expect(handleDoorMeshes.length).toBe(2);
      expect(handleDoorMeshes.every(po => (po.handleGroup?.children.length ?? 0) > 0)).toBe(true);

      // --- 2) Perfil Gola ('gola') ---
      builder.selectZone(col1Id);
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Perfil Gola')!.click();
      fixture.detectChanges();
      assertNoHandleDomControls();
      const doorGolaSelect = builderEl.querySelector(
        '#zcb-door-gola-finish'
      ) as HTMLSelectElement | null;
      expect(doorGolaSelect).toBeTruthy();
      setSelectAndDispatch(doorGolaSelect!, 'matte_black');
      fixture.detectChanges();

      builder.selectZone(col2Id);
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Perfil Gola')!.click();
      fixture.detectChanges();
      assertNoHandleDomControls();
      const drawerGolaSelect = builderEl.querySelector(
        '#zcb-drawer-gola-finish'
      ) as HTMLSelectElement | null;
      expect(drawerGolaSelect).toBeTruthy();
      setSelectAndDispatch(drawerGolaSelect!, 'matte_black');
      fixture.detectChanges();

      const golaParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(golaParts, joineryEngine);

      // Verificar descuento de luz en puertas (26 mm respecto al modo manija) y barras Gola 3D
      const handleDoorHeight = handleParts.find(p => p.componentRole === 'door')!.width;
      const golaDoors = golaParts.filter(p => p.componentRole === 'door');
      expect(golaDoors.length).toBe(2);
      expect(handleDoorHeight - golaDoors[0].width).toBeCloseTo(26, 1);

      const golaBars = golaParts.filter(
        p =>
          p.componentRole === 'accessory' &&
          p.materialId === 'hw_gola_matte_black' &&
          p.hardwareConfig?.openingSystem === 'gola'
      );
      expect(golaBars.length).toBe(5); // 1 barra en puertas + 4 barras en cajones
      expect(golaBars.every(bar => bar.colorHex === '#18181b')).toBe(true);

      // Presupuesto: 0 tiradores físicos y cobro por metros lineales de Perfil Gola Negro Mate
      const golaHw = hardwareCatalog.computeRequiredHardwareList(golaParts);
      expect(golaHw.find(h => h.id === 'hw_tiradores')).toBeUndefined();
      const expectedGolaMeters =
        Math.round(
          (golaBars.reduce((sum, b) => sum + b.length * b.quantity, 0) / 1000) * 100
        ) / 100;
      const billedGola = golaHw.find(h => h.id === 'hw_gola_matte_black');
      expect(billedGola).toBeDefined();
      expect(billedGola?.unit).toBe('metro');
      expect(billedGola?.quantity).toBeCloseTo(expectedGolaMeters, 2);

      // Verificar en visor 3D headless: barras Gola renderizadas en negro mate y 0 manijas en puertas/cajones
      viewerInternals.buildFurnitureScene(golaParts, [], EXPANSION_MATERIALS, false, false);
      const viewerGolaBars = viewerInternals.pieceObjects.filter(
        po => po.part.materialId === 'hw_gola_matte_black'
      );
      expect(viewerGolaBars.length).toBe(5);
      for (const barObj of viewerGolaBars) {
        const mat = barObj.mesh.material as THREE.MeshStandardMaterial;
        expect(mat.color.getHexString()).toBe('18181b');
      }
      const golaFrontObjects = viewerInternals.pieceObjects.filter(
        po => po.part.componentRole === 'door' || po.part.componentRole === 'drawer_front'
      );
      expect(golaFrontObjects.every(po => (po.handleGroup?.children.length ?? 0) === 0)).toBe(true);

      // --- 3) Push-to-Open ('push') ---
      builder.selectZone(col1Id);
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Push-to-Open')!.click();
      fixture.detectChanges();
      assertNoHandleDomControls();
      expect(builderEl.querySelector('#zcb-door-gola-finish')).toBeNull();
      expect(builderEl.querySelector('#zcb-door-finger-pull-deduct')).toBeNull();

      builder.selectZone(col2Id);
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Push-to-Open')!.click();
      fixture.detectChanges();
      assertNoHandleDomControls();
      expect(builderEl.querySelector('#zcb-drawer-gola-finish')).toBeNull();
      expect(builderEl.querySelector('#zcb-drawer-finger-pull-deduct')).toBeNull();
      expect(builder.selectedZoneNode().content?.drawers?.slideType).toBe('push_open');

      const pushParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(pushParts, joineryEngine);
      expect(
        pushParts.filter(p => (p.materialId || '').startsWith('hw_gola_')).length
      ).toBe(0);

      const pushHw = hardwareCatalog.computeRequiredHardwareList(pushParts);
      expect(pushHw.find(h => h.id === 'hw_tiradores')).toBeUndefined();
      expect(pushHw.find(h => h.id === 'hw_push_door_piston')?.quantity).toBe(2);
      expect(pushHw.find(h => h.id === 'hw_correderas_push')?.quantity).toBe(4);

      const pushGuides = assemblyGuide.generateGuidesForProject(projectService.currentProject());
      expect(pushGuides[0].hardwareKit.find(h => h.id === 'handles_knobs')).toBeUndefined();
      expect(pushGuides[0].hardwareKit.find(h => h.id === 'push_door_pistons')?.quantity).toBe(2);

      // --- 4) Uñero 45° ('finger_pull') ---
      builder.selectZone(col1Id);
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Uñero (45°)')!.click();
      fixture.detectChanges();
      assertNoHandleDomControls();
      const doorFingerInput = builderEl.querySelector(
        '#zcb-door-finger-pull-deduct'
      ) as HTMLInputElement | null;
      expect(doorFingerInput).toBeTruthy();
      setInputAndDispatch(doorFingerInput!, '28', 'change');
      fixture.detectChanges();

      builder.selectZone(col2Id);
      fixture.detectChanges();
      findButtonByExactText(builderEl, 'Uñero (45°)')!.click();
      fixture.detectChanges();
      assertNoHandleDomControls();
      const drawerFingerInput = builderEl.querySelector(
        '#zcb-drawer-finger-pull-deduct'
      ) as HTMLInputElement | null;
      expect(drawerFingerInput).toBeTruthy();
      setInputAndDispatch(drawerFingerInput!, '24', 'change');
      fixture.detectChanges();

      const fingerPullParts = designer.currentParts().filter(p => p.groupId === groupId);
      assertFinitePartsAndZeroCollisions(fingerPullParts, joineryEngine);

      const fpDoors = fingerPullParts.filter(p => p.componentRole === 'door');
      expect(fpDoors.length).toBe(2);
      for (const fpDoor of fpDoors) {
        expect(handleDoorHeight - fpDoor.width).toBeCloseTo(28, 1);
        expect(fpDoor.bevelAngleDeg).toBe(45);
        expect(fpDoor.bevelEdge).toBe('l2');
        expect(fpDoor.hardwareConfig?.fingerPullDeductMm).toBe(28);
        expect(fpDoor.notes).toContain('Corte a 45° uñero');
      }

      const fpDrawers = fingerPullParts.filter(p => p.componentRole === 'drawer_front');
      expect(fpDrawers.length).toBe(4);
      for (const fpDrawer of fpDrawers) {
        expect(fpDrawer.bevelAngleDeg).toBe(45);
        expect(fpDrawer.bevelEdge).toBe('l2');
        expect(fpDrawer.hardwareConfig?.fingerPullDeductMm).toBe(24);
        expect(fpDrawer.notes).toContain('Uñero Corte a 45°');
      }

      const fpHw = hardwareCatalog.computeRequiredHardwareList(fingerPullParts);
      expect(fpHw.find(h => h.id === 'hw_tiradores')).toBeUndefined();
      expect(fpHw.find(h => h.id === 'hw_push_door_piston')).toBeUndefined();

      // --- 5) Acabado de Barra Colgadora (chrome, matte_black, gold) ---
      builder.selectZone(col1Id);
      fixture.detectChanges();

      const rodSpecs: {
        finish: CabinetRodFinish;
        buttonLabel: string;
        materialId: string;
        colorHex: string;
        budgetId: string;
      }[] = [
        {
          finish: 'chrome',
          buttonLabel: 'Cromado',
          materialId: 'hw_rod_chrome',
          colorHex: '#94a3b8',
          budgetId: 'hw_tubo_colgador'
        },
        {
          finish: 'matte_black',
          buttonLabel: 'Negro Mate',
          materialId: 'hw_rod_matte_black',
          colorHex: '#18181b',
          budgetId: 'hw_tubo_colgador_negro'
        },
        {
          finish: 'gold',
          buttonLabel: 'Dorado',
          materialId: 'hw_rod_gold',
          colorHex: '#d97706',
          budgetId: 'hw_tubo_colgador_dorado'
        }
      ];

      for (const rodSpec of rodSpecs) {
        findButtonByExactText(builderEl, rodSpec.buttonLabel)!.click();
        fixture.detectChanges();
        const currentParts = designer.currentParts().filter(p => p.groupId === groupId);
        assertFinitePartsAndZeroCollisions(currentParts, joineryEngine);
        const rodPart = currentParts.find(
          p => p.componentRole === 'accessory' && p.shapeType === 'circle'
        )!;
        expect(rodPart).toBeDefined();
        expect(rodPart.hardwareConfig?.rodFinish).toBe(rodSpec.finish);
        expect(rodPart.materialId).toBe(rodSpec.materialId);
        expect(rodPart.colorHex).toBe(rodSpec.colorHex);

        const rodHw = hardwareCatalog.computeRequiredHardwareList(currentParts);
        expect(rodHw.find(h => h.id === rodSpec.budgetId)?.quantity).toBe(1);
      }

      // Verificar también acabado Gola en todos los tonos configurables en el catálogo
      const golaFinishes: { finish: CabinetGolaFinish; budgetId: string }[] = [
        { finish: 'natural_aluminum', budgetId: 'hw_gola_natural_aluminum' },
        { finish: 'white', budgetId: 'hw_gola_white' },
        { finish: 'champagne', budgetId: 'hw_gola_champagne' }
      ];
      for (const gf of golaFinishes) {
        const gfRes = cabinetGen.generateZoneCabinet(
          {
            ...builder.currentConfig(),
            zoneTree: {
              id: 'zone_gola_check',
              splitDirection: 'none',
              content: {
                type: 'doors',
                doors: {
                  opening: 'left',
                  mount: 'overlay',
                  hasHandle: false,
                  openingSystem: 'gola',
                  golaFinish: gf.finish
                }
              }
            }
          },
          EXPANSION_MATERIALS
        );
        const gfHw = hardwareCatalog.computeRequiredHardwareList(gfRes.parts);
        expect(gfHw.find(h => h.id === gf.budgetId)?.unit).toBe('metro');
      }
    }, 20000);
  });

  describe('Caso 3 — Acabados y Materiales Independientes, Optimizador de Corte, Etiquetas 45° y Reconstrucción', () => {
    it('debe asignar materiales independientes (Casco Blanco 15mm, Frentes y Costado Derecho Roble 18mm, Fondo MDF 3mm), separar en CutOptimizerService, exponer Corte a 45° en LabelsViewComponent y hacer round-trip en reconstructConfigFromParts', () => {
      // Configurar Zona Builder standalone con Casco = Blanco 15mm, Frentes = Roble 18mm, Costado Derecho Visto = Roble 18mm, Fondo = MDF 3mm
      const zcbFixture = TestBed.createComponent(ZoneCabinetBuilderComponent);
      const zcb = zcbFixture.componentInstance;
      zcbFixture.componentRef.setInput('materials', EXPANSION_MATERIALS);
      zcbFixture.detectChanges();
      const zcbEl = zcbFixture.nativeElement as HTMLElement;

      // 1) Dimensiones y Espesor 15mm
      setInputAndDispatch(zcbEl.querySelector('#zcb-width') as HTMLInputElement, '1000', 'change');
      setInputAndDispatch(zcbEl.querySelector('#zcb-height') as HTMLInputElement, '900', 'change');
      setInputAndDispatch(zcbEl.querySelector('#zcb-depth') as HTMLInputElement, '560', 'change');
      findButtonByExactText(zcbEl, '15 mm')!.click();
      zcbFixture.detectChanges();

      // 2) Casco = Blanco 15mm
      findButtonContainingText(zcbEl, 'Melamina Blanco Mate 15mm')!.click();
      zcbFixture.detectChanges();
      expect(zcb.structureMaterialId()).toBe('mat_blanco_15');

      // 3) Desmarcar "Usar mismo material del casco" y elegir Roble 18mm para Frentes
      findButtonContainingText(zcbEl, 'Usar mismo material del casco')!.click();
      zcbFixture.detectChanges();
      expect(zcb.useSameMaterialForDoors()).toBe(false);
      const doorMatSelect = zcbEl.querySelector('#zcb-door-material') as HTMLSelectElement;
      expect(doorMatSelect).toBeTruthy();
      setSelectAndDispatch(doorMatSelect, 'mat_roble_18');
      zcbFixture.detectChanges();
      expect(zcb.doorMaterialId()).toBe('mat_roble_18');

      // 4) Activar "Personalizar costados y techo vistos", marcar SOLO Costado Derecho Visto con Roble 18mm
      findButtonContainingText(zcbEl, 'Personalizar costados y techo vistos')!.click();
      zcbFixture.detectChanges();
      expect(zcb.customizeVisibleSides()).toBe(true);
      findButtonContainingText(zcbEl, 'Costado Derecho Visto')!.click();
      zcbFixture.detectChanges();
      const visibleMatSelect = zcbEl.querySelector('#zcb-visible-material') as HTMLSelectElement;
      expect(visibleMatSelect).toBeTruthy();
      setSelectAndDispatch(visibleMatSelect, 'mat_roble_18');
      zcbFixture.detectChanges();
      expect(zcb.visibleSideRight()).toBe(true);
      expect(zcb.visibleSideLeft()).toBe(false);
      expect(zcb.visibleTopCover()).toBe(false);
      expect(zcb.visibleMaterialId()).toBe('mat_roble_18');

      // 5) Fondo = MDF 3mm
      const backMatSelect = zcbEl.querySelector('#zcb-back-material') as HTMLSelectElement;
      expect(backMatSelect).toBeTruthy();
      setSelectAndDispatch(backMatSelect, 'mat_mdf_3');
      zcbFixture.detectChanges();
      expect(zcb.backMaterialId()).toBe('mat_mdf_3');

      // 6) Subdividir en 2 columnas: Col 1 = Puerta Uñero 45° + 2 repisas; Col 2 = 2 Cajones
      zcbEl.querySelector<HTMLButtonElement>('button[aria-label="Agregar división vertical"]')!.click();
      zcbFixture.detectChanges();
      const col1Id = zcb.zoneTree().children![0].id;
      const col2Id = zcb.zoneTree().children![1].id;

      zcb.selectZone(col1Id);
      zcbFixture.detectChanges();
      findButtonByExactText(zcbEl, 'Puertas')!.click();
      zcbFixture.detectChanges();
      findButtonByExactText(zcbEl, 'Uñero (45°)')!.click();
      zcbFixture.detectChanges();
      zcbEl.querySelector<HTMLButtonElement>('button[aria-label="Aumentar repisas interiores"]')!.click();
      zcbEl.querySelector<HTMLButtonElement>('button[aria-label="Aumentar repisas interiores"]')!.click();
      zcbFixture.detectChanges();

      zcb.selectZone(col2Id);
      zcbFixture.detectChanges();
      findButtonByExactText(zcbEl, 'Cajonera')!.click();
      zcbFixture.detectChanges();
      zcb.setDrawersCount(2);
      zcbFixture.detectChanges();

      // Activar también montaje aéreo con Listón Francés 45° para validar ambos tipos de corte 45° y round-trip completo
      findButtonByExactText(zcbEl, 'Aéreo / Flotante')!.click();
      zcbFixture.detectChanges();

      // Generar piezas respetando espesor real de frente Roble 18mm cuando se configura doorThickness = 18
      const snapshotCfg: ParametricCabinetConfig = {
        ...zcb.currentConfig(),
        doorThickness: 18
      };
      const res = cabinetGen.generateZoneCabinet(snapshotCfg, EXPANSION_MATERIALS);
      assertFinitePartsAndZeroCollisions(res.parts, joineryEngine);

      // Verificar asignaciones de material por pieza
      const sideLeft = res.parts.find(p => p.componentRole === 'side_left')!;
      const sideRight = res.parts.find(p => p.componentRole === 'side_right')!;
      const topPart = res.parts.find(p => p.componentRole === 'top')!;
      const bottomPart = res.parts.find(p => p.componentRole === 'bottom')!;
      const dividerPart = res.parts.find(p => p.componentRole === 'divider')!;
      const shelfParts = res.parts.filter(p => p.componentRole === 'shelf');
      const drawerBoxWalls = res.parts.filter(
        p => p.componentRole === 'drawer_box' && p.thickness > 6
      );
      const drawerBoxBottoms = res.parts.filter(
        p => p.componentRole === 'drawer_box' && p.thickness <= 6
      );
      const doorParts = res.parts.filter(p => p.componentRole === 'door');
      const drawerFronts = res.parts.filter(p => p.componentRole === 'drawer_front');
      const backPart = res.parts.find(p => p.componentRole === 'back')!;

      expect(sideLeft.materialId).toBe('mat_blanco_15');
      expect(topPart.materialId).toBe('mat_blanco_15');
      expect(bottomPart.materialId).toBe('mat_blanco_15');
      expect(dividerPart.materialId).toBe('mat_blanco_15');
      expect(shelfParts.length).toBe(2);
      expect(shelfParts.every(s => s.materialId === 'mat_blanco_15')).toBe(true);
      expect(drawerBoxWalls.length).toBe(8);
      expect(drawerBoxWalls.every(w => w.materialId === 'mat_blanco_15')).toBe(true);

      expect(sideRight.materialId).toBe('mat_roble_18');
      expect(sideRight.thickness).toBe(15);

      expect(doorParts.length).toBe(1);
      expect(doorParts[0].materialId).toBe('mat_roble_18');
      expect(doorParts[0].thickness).toBe(18);
      expect(drawerFronts.length).toBe(2);
      expect(drawerFronts.every(df => df.materialId === 'mat_roble_18' && df.thickness === 18)).toBe(true);

      expect(backPart.materialId).toBe('mat_mdf_3');
      expect(backPart.thickness).toBe(3);
      expect(drawerBoxBottoms.length).toBe(2);
      expect(drawerBoxBottoms.every(db => db.materialId === 'mat_mdf_3' && db.thickness === 3)).toBe(true);

      // Verificar separación limpia por material y espesor en CutOptimizerService
      const sheetTypes = cutOptimizer.listSheetTypes(res.parts, EXPANSION_MATERIALS);
      expect(sheetTypes.length).toBe(4);
      const sheetIds = sheetTypes.map(st => st.material.id);
      expect(sheetIds).toContain('mat_blanco_15');
      expect(sheetIds).toContain('mat_roble_18__15mm');
      expect(sheetIds).toContain('mat_roble_18');
      expect(sheetIds).toContain('mat_mdf_3');

      const optResult = cutOptimizer.optimizeProject(
        res.parts,
        EXPANSION_MATERIALS,
        EXPANSION_SETTINGS
      );
      expect(optResult.unplacedParts.length).toBe(0);
      expect(optResult.totalPartsPlaced).toBe(optResult.totalPartsCount);
      for (const sheet of optResult.sheets) {
        const placedIds = new Set(sheet.placedParts.map(pp => pp.part.materialId));
        const placedThick = new Set(sheet.placedParts.map(pp => pp.part.thickness));
        expect(placedIds.size).toBe(1);
        expect(placedThick.size).toBe(1);
      }

      // Verificar LabelsViewComponent.resolvePartTechnicalCutBadge y badges renderizados en DOM
      const cleatMueble = res.parts.find(
        p => p.name === 'Listón Francés Mueble (Corte 45°)'
      )!;
      const cleatPared = res.parts.find(
        p => p.name === 'Listón Francés Pared (Corte 45°)'
      )!;
      expect(resolvePartTechnicalCutBadge(cleatMueble)).toBe('Corte a 45° (L2)');
      expect(resolvePartTechnicalCutBadge(cleatPared)).toBe('Corte a 45° (L1)');
      expect(resolvePartTechnicalCutBadge(doorParts[0])).toBe('Corte a 45° · Uñero');
      expect(resolvePartTechnicalCutBadge(sideLeft)).toBeNull();

      projectService.addParametricCabinet(res);
      const labelsFixture = TestBed.createComponent(LabelsViewComponent);
      labelsFixture.detectChanges();
      const labelsComp = labelsFixture.componentInstance;
      const labelsEl = labelsFixture.nativeElement as HTMLElement;

      const bevelLabels = labelsComp
        .flatLabels()
        .filter(lbl => lbl.technicalCutBadge !== null);
      expect(bevelLabels.length).toBe(3); // 2 listones franceses + 1 puerta uñero
      expect(bevelLabels.every(lbl => lbl.technicalCutBadge!.includes('Corte a 45°'))).toBe(true);

      const renderedBadges = Array.from(
        labelsEl.querySelectorAll('[data-testid="label-cut-badge"]')
      ).map(el => el.textContent?.trim());
      expect(renderedBadges.length).toBe(3);
      expect(renderedBadges.every(txt => txt?.includes('Corte a 45°'))).toBe(true);
      labelsFixture.destroy();

      // Verificar reconstructConfigFromParts (round-trip completo con parametricConfig y reconstrucción desde piezas crudas)
      const roundTripFull = cabinetGen.reconstructConfigFromParts(res.parts, res.group);
      expect(roundTripFull.installationType).toBe('wall');
      expect(roundTripFull.wallMountType).toBe('french_cleat');
      expect(roundTripFull.elevationY).toBe(1400);
      expect(roundTripFull.frenchCleatHeightMm).toBe(80);
      expect(roundTripFull.backType).toBe('groove');
      expect(roundTripFull.structureMaterialId).toBe('mat_blanco_15');
      expect(roundTripFull.doorMaterialId).toBe('mat_roble_18');
      expect(roundTripFull.backMaterialId).toBe('mat_mdf_3');
      expect(roundTripFull.customizeVisibleSides).toBe(true);
      expect(roundTripFull.visibleSideLeft).toBe(false);
      expect(roundTripFull.visibleSideRight).toBe(true);
      expect(roundTripFull.visibleTopCover).toBe(false);
      expect(roundTripFull.visibleMaterialId).toBe('mat_roble_18');
      expect(roundTripFull.openingSystem).toBe('finger_pull');
      expect(roundTripFull.fingerPullDeductMm).toBe(26);

      const rawGroupOnly: PartGroup = {
        id: res.group.id,
        name: res.group.name,
        type: 'assembly'
      };
      const roundTripFromParts = cabinetGen.reconstructConfigFromParts(res.parts, rawGroupOnly);
      expect(roundTripFromParts.installationType).toBe('wall');
      expect(roundTripFromParts.wallMountType).toBe('french_cleat');
      expect(roundTripFromParts.frenchCleatHeightMm).toBe(80);
      expect(roundTripFromParts.structureMaterialId).toBe('mat_blanco_15');
      expect(roundTripFromParts.doorMaterialId).toBe('mat_roble_18');
      expect(roundTripFromParts.backMaterialId).toBe('mat_mdf_3');
      expect(roundTripFromParts.customizeVisibleSides).toBe(true);
      expect(roundTripFromParts.visibleSideLeft).toBe(false);
      expect(roundTripFromParts.visibleSideRight).toBe(true);
      expect(roundTripFromParts.visibleTopCover).toBe(false);
      expect(roundTripFromParts.visibleMaterialId).toBe('mat_roble_18');
      expect(roundTripFromParts.openingSystem).toBe('finger_pull');

      // Verificar round-trip adicional para modo piso con patas, zócalo con retiro, Gola y acabado de barra colgadora
      const floorLegsConfig: ParametricCabinetConfig = {
        code: 'RT_LEGS',
        name: 'Módulo RoundTrip Patas',
        moduleType: 'base_cabinet',
        category: 'custom',
        width: 1400,
        height: 860,
        depth: 580,
        structureThickness: 15,
        doorThickness: 18,
        backThickness: 3,
        backType: 'groove',
        hasBackPanel: true,
        shelvesCount: 0,
        doorOpening: 'left',
        structureMaterialId: 'mat_blanco_15',
        doorMaterialId: 'mat_roble_18',
        backMaterialId: 'mat_mdf_3',
        handleType: 'gola_less',
        handleFinish: 'brushed_steel',
        facadeGap: 3,
        installationType: 'floor',
        baseType: 'legs',
        plinthHeight: 150,
        legStyle: 'scandinavian_wood',
        openingSystem: 'gola',
        golaFinish: 'champagne',
        hangingRodFinish: 'gold',
        zoneTree: {
          id: 'zone_root',
          splitDirection: 'none',
          content: {
            type: 'doors',
            doors: {
              opening: 'left',
              mount: 'overlay',
              hasHandle: false,
              openingSystem: 'gola',
              golaFinish: 'champagne'
            },
            hangingRodsCount: 1,
            hangingRodFinish: 'gold'
          }
        }
      };
      const legsGen = cabinetGen.generateZoneCabinet(floorLegsConfig, EXPANSION_MATERIALS);
      const rtLegsFull = cabinetGen.reconstructConfigFromParts(legsGen.parts, legsGen.group);
      expect(rtLegsFull.installationType).toBe('floor');
      expect(rtLegsFull.baseType).toBe('legs');
      expect(rtLegsFull.legStyle).toBe('scandinavian_wood');
      expect(rtLegsFull.plinthHeight).toBe(150);
      expect(rtLegsFull.openingSystem).toBe('gola');
      expect(rtLegsFull.golaFinish).toBe('champagne');
      expect(rtLegsFull.hangingRodFinish).toBe('gold');

      const rtLegsRaw = cabinetGen.reconstructConfigFromParts(legsGen.parts, {
        id: legsGen.group.id,
        name: legsGen.group.name,
        type: 'assembly'
      });
      expect(rtLegsRaw.baseType).toBe('legs');
      expect(rtLegsRaw.legStyle).toBe('scandinavian_wood');
      expect(rtLegsRaw.openingSystem).toBe('gola');
      expect(rtLegsRaw.golaFinish).toBe('champagne');
      expect(rtLegsRaw.hangingRodFinish).toBe('gold');

      zcbFixture.destroy();
    }, 15000);
  });
});
