import { ElementRef, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { User } from '@supabase/supabase-js';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CabinetZoneNode,
  hasReliableParametricRecipe,
  isStandaloneModularDrawerGroup,
  Material,
  ParametricCabinetConfig,
  Part,
  ProjectSettings
} from '../../models/melamine.models';
import { CabinetGeneratorService } from '../../services/cabinet-generator.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';
import { I18nService } from '../../services/i18n.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { PartGeometryService } from '../../services/part-geometry.service';
import { PaymentService } from '../../services/payment.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { ScenePickResult, SceneRaycastPickerService } from '../../services/scene-raycast-picker.service';
import { SupabaseService, SyncStatus } from '../../services/supabase.service';
import { TemplatesCatalogService } from '../../services/templates-catalog.service';
import { ThemeService } from '../../services/theme.service';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { Furniture3dViewerComponent } from '../furniture-3d-viewer/furniture-3d-viewer';
import { ModuleDesignerComponent } from './module-designer';

interface ViewerPieceEntry {
  part: Part;
  mesh: THREE.Object3D;
  originalPos: THREE.Vector3;
  explodedOffset: THREE.Vector3;
  isDoor?: boolean;
  isDrawer?: boolean;
  doorPivot?: THREE.Group;
  handleGroup?: THREE.Group;
  hingeGroup?: THREE.Group;
  slideGroup?: THREE.Group;
}

interface ViewerInternals {
  initThree: () => void;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  furnitureGroup: THREE.Group;
  selectionOutlineGroup: THREE.Group;
  zoneHighlightGroup: THREE.Group;
  dimensionGroup: THREE.Group;
  gizmoGroup: THREE.Group;
  drillGroup: THREE.Group;
  internalClearanceGroup: THREE.Group;
  rightPointerDownTime: number;
  rightPointerDragged: boolean;
  containerRef: () => ElementRef<HTMLElement> | undefined;
  canvasRef: () => ElementRef<HTMLCanvasElement> | undefined;
  pieceObjects: ViewerPieceEntry[];
  pieceObjectMap: Map<string, ViewerPieceEntry>;
  openTargetMap: Map<string, number>;
  openCurrentMap: Map<string, number>;
  buildFurnitureScene: (
    parts: Part[],
    selectedIds: string[],
    materials: Material[],
    isXRay: boolean,
    showDims: boolean
  ) => void;
  updateOpeningAnimations: (delta?: number) => boolean;
}

const MAT_WHITE: Material = {
  id: 'mat_white_h2a',
  name: 'Melamina Blanco Hito2A 15mm',
  thickness: 15,
  sheetLength: 2440,
  sheetWidth: 1830,
  sheetCost: 145000,
  hasGrain: false,
  colorHex: '#f8fafc',
  category: 'board'
};

const MAT_OAK: Material = {
  id: 'mat_oak_h2a',
  name: 'Melamina Roble Hito2A 18mm',
  thickness: 18,
  sheetLength: 2440,
  sheetWidth: 1830,
  sheetCost: 185000,
  hasGrain: true,
  colorHex: '#c29b68',
  category: 'board'
};

const MAT_ANTHRACITE: Material = {
  id: 'mat_anthracite_h2a',
  name: 'Melamina Antracita Hito2A 18mm',
  thickness: 18,
  sheetLength: 2440,
  sheetWidth: 1830,
  sheetCost: 192000,
  hasGrain: false,
  colorHex: '#27272a',
  category: 'board'
};

const MAT_MDF_BACK: Material = {
  id: 'mat_mdf_3',
  name: 'Fondo MDF Hito2A 3mm',
  thickness: 3,
  sheetLength: 2440,
  sheetWidth: 1830,
  sheetCost: 35000,
  hasGrain: false,
  colorHex: '#e4e4e7',
  family: 'mdf_back',
  category: 'mdf'
};

const TEST_MATERIALS: Material[] = [MAT_WHITE, MAT_OAK, MAT_ANTHRACITE, MAT_MDF_BACK];

const TEST_SETTINGS: ProjectSettings = {
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

function createPaymentStub(): Partial<PaymentService> {
  return {
    canAddModuleToScene: () => true,
    isWorkshopExportRestricted: signal(false),
    isCncExportRestricted: signal(false),
    openUpgradeModal: () => undefined
  };
}

function createDomRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({})
  } as DOMRect;
}

function buildMixedParametricConfig(): ParametricCabinetConfig {
  const zoneTree: CabinetZoneNode = {
    id: 'closet_mix_root',
    splitDirection: 'vertical',
    children: [
      {
        id: 'bay_shelves',
        splitDirection: 'none',
        sizeRatio: 1,
        content: {
          type: 'shelves',
          shelvesCount: 3,
          shelfSetbackMm: 20
        }
      },
      {
        id: 'bay_drawers',
        splitDirection: 'none',
        sizeRatio: 1,
        content: {
          type: 'drawers',
          drawers: {
            count: 2,
            frontMount: 'overlay',
            deductTopMm: 0,
            deductBottomMm: 0,
            deductLeftMm: 0,
            deductRightMm: 0,
            openingSystem: 'handle',
            slideType: 'telescopic',
            bottomType: 'grooved'
          }
        }
      },
      {
        id: 'bay_doors',
        splitDirection: 'none',
        sizeRatio: 1,
        content: {
          type: 'doors',
          doors: {
            opening: 'double',
            mount: 'overlay',
            hasHandle: true,
            handleType: 'bar_modern',
            handleFinish: 'brushed_steel',
            hingeType: 'straight'
          },
          hangingRodsCount: 1
        }
      }
    ]
  };

  return {
    code: 'CLOSET_H2A_MIX',
    name: 'Módulo Mixto Hito 2A',
    moduleType: 'closet',
    category: 'custom',
    width: 1800,
    height: 2100,
    depth: 600,
    structureThickness: 15,
    doorThickness: 15,
    backThickness: 3,
    backType: 'groove',
    hasBackPanel: true,
    shelvesCount: 0,
    doorOpening: 'none',
    hasHandle: true,
    handleType: 'bar_modern',
    handleFinish: 'brushed_steel',
    handlePosition: 'vertical',
    hingeType: 'straight',
    drawerSlideType: 'telescopic',
    structureMaterialId: MAT_WHITE.id,
    doorMaterialId: MAT_WHITE.id,
    backMaterialId: MAT_MDF_BACK.id,
    facadeGap: 3,
    baseType: 'plinth',
    hasPlinth: true,
    plinthHeight: 80,
    hasTopCover: true,
    topTieStrips: false,
    posX: 0,
    posY: 1050,
    posZ: 0,
    zoneTree
  };
}

function findButtonByText(container: HTMLElement, textSnippet: string): HTMLButtonElement | undefined {
  const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
  return buttons.find(b => (b.textContent ?? '').includes(textSnippet));
}

function collectMeshMaterialColorsHex(root: THREE.Object3D): number[] {
  const colors: number[] = [];
  root.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m instanceof THREE.MeshStandardMaterial) {
          colors.push(m.color.getHex());
        }
      }
    }
  });
  return colors;
}

describe('Hito 2A — Menú Contextual Paramétrico, Estilos Globales Sincronizados y Desagrupar Seguro', () => {
  let fixture: ComponentFixture<ModuleDesignerComponent>;
  let dialogFixture: ComponentFixture<ConfirmDialog>;
  let designer: ModuleDesignerComponent;
  let hostEl: HTMLElement;
  let dialogEl: HTMLElement;
  let projectService: ProjectStorageService;
  let cabinetGen: CabinetGeneratorService;
  let hardwareCatalog: HardwareCatalogService;
  let confirmService: ConfirmDialogService;
  let raycastPicker: SceneRaycastPickerService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as ViewerInternals,
      'initThree'
    ).mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [ModuleDesignerComponent, ConfirmDialog],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: createMockSupabase() },
        { provide: PaymentService, useValue: createPaymentStub() },
        ProjectStorageService,
        CabinetGeneratorService,
        PartGeometryService,
        HardwareCatalogService,
        JoineryEngineService,
        ConfirmDialogService,
        SceneRaycastPickerService,
        TemplatesCatalogService,
        ThemeService,
        I18nService
      ]
    }).compileComponents();

    TestBed.inject(I18nService).setLanguage('es');
    projectService = TestBed.inject(ProjectStorageService);
    cabinetGen = TestBed.inject(CabinetGeneratorService);
    hardwareCatalog = TestBed.inject(HardwareCatalogService);
    confirmService = TestBed.inject(ConfirmDialogService);
    raycastPicker = TestBed.inject(SceneRaycastPickerService);

    projectService.clearFurniture();
    projectService.updateProject(
      p => ({
        ...p,
        materials: TEST_MATERIALS.map(m => ({ ...m })),
        settings: { ...TEST_SETTINGS }
      }),
      false
    );

    fixture = TestBed.createComponent(ModuleDesignerComponent);
    dialogFixture = TestBed.createComponent(ConfirmDialog);
    designer = fixture.componentInstance;
    fixture.detectChanges();
    dialogFixture.detectChanges();
    hostEl = fixture.nativeElement as HTMLElement;
    dialogEl = dialogFixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    fixture?.destroy();
    dialogFixture?.destroy();
    projectService?.flushPendingStorageSave();
    vi.restoreAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  const attachHeadlessViewer = (rebuildScene = true): {
    viewer: Furniture3dViewerComponent;
    internals: ViewerInternals;
  } => {
    const viewer = designer.viewer3d()!;
    expect(viewer).toBeTruthy();
    const internals = viewer as unknown as ViewerInternals;

    if (!internals.scene) {
      internals.scene = new THREE.Scene();
      internals.scene.add(internals.furnitureGroup);
      internals.scene.add(internals.selectionOutlineGroup);
      internals.scene.add(internals.zoneHighlightGroup);
      internals.scene.add(internals.dimensionGroup);
      internals.scene.add(internals.gizmoGroup);
      internals.scene.add(internals.drillGroup);
      internals.scene.add(internals.internalClearanceGroup);
    }

    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 1, 10000);
    camera.position.set(0, 1050, 2600);
    camera.lookAt(0, 1050, 0);
    camera.updateMatrixWorld();
    internals.camera = camera;

    const containerEl = internals.containerRef()?.nativeElement;
    const canvasEl = internals.canvasRef()?.nativeElement;
    if (containerEl) {
      vi.spyOn(containerEl, 'getBoundingClientRect').mockReturnValue(createDomRect(0, 0, 1280, 800));
    }
    if (canvasEl) {
      vi.spyOn(canvasEl, 'getBoundingClientRect').mockReturnValue(createDomRect(0, 0, 1280, 800));
    }

    if (rebuildScene) {
      internals.buildFurnitureScene(
        designer.currentParts(),
        designer.selectedPartIds(),
        designer.allAvailableMaterials(),
        false,
        false
      );
    }

    return { viewer, internals };
  };

  const openContextMenuOnPart = (part: Part, clientX = 320, clientY = 260): HTMLElement => {
    const { viewer, internals } = attachHeadlessViewer(false);
    internals.rightPointerDownTime = Date.now();
    internals.rightPointerDragged = false;

    const hitObj = new THREE.Object3D();
    const pickResult: ScenePickResult = {
      closest: {
        kind: 'piece',
        distance: 150,
        object: hitObj,
        intersection: {
          distance: 150,
          point: new THREE.Vector3(),
          object: hitObj
        },
        part
      },
      candidates: []
    };
    const pickSpy = vi
      .spyOn(raycastPicker, 'pickClosestSceneCandidate')
      .mockReturnValue(pickResult);

    const mouseEvent = new MouseEvent('contextmenu', {
      clientX,
      clientY,
      button: 2,
      bubbles: true,
      cancelable: true
    });
    viewer.onContextMenu(mouseEvent);
    fixture.detectChanges();
    pickSpy.mockRestore();

    const menuEl = hostEl.querySelector('.cad-context-menu') as HTMLElement | null;
    expect(menuEl).not.toBeNull();
    return menuEl!;
  };

  const getInspectorText = (): string =>
    (hostEl.querySelector('.md-inspector-panel')?.textContent ?? '').replace(/\s+/g, ' ').trim();

  const normalizeText = (el: HTMLElement): string =>
    (el.textContent ?? '').replace(/\s+/g, ' ').trim();

  const flushMicrotasks = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    dialogFixture.detectChanges();
  };

  it('Test 1 (Identidad de Menú Contextual + Cero Inyectores Destructivos): onContextMenu sobre drawer_front, door y side_left abre en Módulo Completo sin inyectores de cajones/puertas ni Huecos / Vanos Libres', () => {
    const closet = cabinetGen.generateZoneCabinet(buildMixedParametricConfig(), TEST_MATERIALS);
    projectService.addParametricCabinet(closet);
    fixture.detectChanges();

    const moduleParts = projectService.partsList().filter(p => p.groupId === closet.group.id);
    const drawerFront = moduleParts.find(p => p.componentRole === 'drawer_front')!;
    const doorPart = moduleParts.find(p => p.componentRole === 'door')!;
    const sideLeft = moduleParts.find(p => p.componentRole === 'side_left')!;
    expect(drawerFront).toBeDefined();
    expect(doorPart).toBeDefined();
    expect(sideLeft).toBeDefined();

    attachHeadlessViewer(true);
    const { viewer } = attachHeadlessViewer(false);

    // Incluso si había una única pieza seleccionada previamente, clic derecho en módulo paramétrico debe abrir Módulo Completo
    designer.onPartsSelectedFrom3D([drawerFront.id]);
    designer.activeDockTab.set('piece');
    fixture.detectChanges();

    const targets: Part[] = [drawerFront, doorPart, sideLeft];
    for (const target of targets) {
      const menuEl = openContextMenuOnPart(target);
      const menuText = normalizeText(menuEl);

      expect(viewer.isContextMenuParametricModule()).toBe(true);
      expect(viewer.isContextMenuDrawerGroup()).toBe(false);
      expect(viewer.contextMenuMode()).toBe('group');

      // Pestañas y cabecera fija
      const leftTabBtn = findButtonByText(menuEl, 'Módulo Completo');
      const rightTabBtn = findButtonByText(menuEl, 'Solo Esta Pieza');
      expect(leftTabBtn).toBeDefined();
      expect(rightTabBtn).toBeDefined();
      expect(leftTabBtn!.className).toContain('bg-zinc-900');

      expect(menuText).toContain('Módulo Completo');
      expect(menuText).toContain('Solo Esta Pieza');
      expect(menuText).toContain('Módulo');
      expect(menuText).toContain('1800×2100×600');
      expect(menuText).toContain(`Pieza bajo cursor: ${target.name}`);

      // Prohibidos legacy
      expect(menuText).not.toContain('Cajón Completo');
      expect(menuText).not.toContain('Grupo Cajón');
      expect(menuText).not.toContain('Insertar Cajón(es) en este Hueco');
      expect(menuText).not.toContain('Auto-Fit');
      expect(menuText).not.toContain('Configuración de Puerta y Apertura');

      // Inspector derecho sin Huecos / Vanos Libres
      designer.activeDockTab.set('piece');
      fixture.detectChanges();
      const inspectorText = getInspectorText();
      expect(inspectorText).toContain('Editar Estructura del Módulo (Asistente)');
      expect(inspectorText).not.toContain('Huecos / Vanos Libres');
      expect(inspectorText).not.toContain('Configuración de Puerta y Apertura');

      viewer.closeContextMenu();
      fixture.detectChanges();
    }
  });

  it('Test 2 (Pestaña Solo Esta Pieza estricta en módulo paramétrico): restringe controles destructivos y anima un único cajón sin deslizar otros', () => {
    const closet = cabinetGen.generateZoneCabinet(buildMixedParametricConfig(), TEST_MATERIALS);
    projectService.addParametricCabinet(closet);
    fixture.detectChanges();

    const moduleParts = projectService.partsList().filter(p => p.groupId === closet.group.id);
    const drawerFronts = moduleParts.filter(p => p.componentRole === 'drawer_front');
    expect(drawerFronts.length).toBe(2);
    const drawer1Front = drawerFronts[0];
    const drawer2Front = drawerFronts[1];
    const doorPart = moduleParts.find(p => p.componentRole === 'door')!;
    const sideLeft = moduleParts.find(p => p.componentRole === 'side_left')!;

    const { viewer, internals } = attachHeadlessViewer(true);

    const assertProhibitedAbsent = (menuText: string): void => {
      expect(menuText).not.toContain('Rotación de Pieza 3D');
      expect(menuText).not.toContain('Al Suelo (Y=0)');
      expect(menuText).not.toContain('Centrar en X');
      expect(menuText).not.toContain('Duplicar Solo Esta Pieza');
      expect(menuText).not.toContain('Eliminar Pieza');
      expect(menuText).not.toContain('Convertir Pieza en');
      expect(menuText).not.toContain('Congelar Solo Esta Pieza');
      expect(menuText).not.toContain('Descongelar Solo Esta Pieza');
      expect(menuText).not.toContain('Todo el módulo');
    };

    const assertAllowedPresent = (menuEl: HTMLElement, menuText: string): void => {
      expect(menuText).toContain('Cambiar Material / Color solo de esta pieza');
      expect(menuText).toContain('Tapacantos');
      expect(findButtonByText(menuEl, 'L1')).toBeDefined();
      expect(findButtonByText(menuEl, 'L2')).toBeDefined();
      expect(findButtonByText(menuEl, 'A1')).toBeDefined();
      expect(findButtonByText(menuEl, 'A2')).toBeDefined();
      expect(menuText).toContain('Aislar Solo Esta Pieza');
      expect(menuText).toContain('Ocultar Pieza Temporalmente');
      expect(menuText).toContain(
        'Pieza vinculada al módulo paramétrico. Para cambiar medidas o quitar piezas usa Editar Estructura en Asistente o Desagrupa el módulo.'
      );
    };

    // 1) Sobre drawer_front (Cajón 1)
    let menuEl = openContextMenuOnPart(drawer1Front);
    findButtonByText(menuEl, 'Solo Esta Pieza')!.click();
    fixture.detectChanges();
    expect(viewer.contextMenuMode()).toBe('part');

    let menuText = normalizeText(menuEl);
    assertProhibitedAbsent(menuText);
    assertAllowedPresent(menuEl, menuText);
    const toggleDrawerBtn = findButtonByText(menuEl, 'Abrir / Cerrar solo este cajón en 3D');
    expect(toggleDrawerBtn).toBeDefined();

    // Animar cajón 1 no desliza cajón 2 ni puertas
    const d1EntryBefore = internals.pieceObjectMap.get(drawer1Front.id)!;
    const d2EntryBefore = internals.pieceObjectMap.get(drawer2Front.id)!;
    const d1StartZ = d1EntryBefore.originalPos.z;
    const d2StartZ = d2EntryBefore.originalPos.z;

    toggleDrawerBtn!.click();
    fixture.detectChanges();
    expect(internals.openTargetMap.get(drawer1Front.id)).toBe(1);
    expect(internals.openTargetMap.get(drawer2Front.id) ?? 0).toBe(0);
    expect(internals.openTargetMap.get(doorPart.id) ?? 0).toBe(0);

    for (let step = 0; step < 12; step++) {
      internals.updateOpeningAnimations(0.1);
    }
    expect(d1EntryBefore.mesh.position.z).toBeGreaterThan(d1StartZ + 250);
    expect(d2EntryBefore.mesh.position.z).toBeCloseTo(d2StartZ, 3);

    // Volver a cerrar cajón 1
    toggleDrawerBtn!.click();
    fixture.detectChanges();
    expect(internals.openTargetMap.get(drawer1Front.id)).toBe(0);

    // Cambiar material SOLO del frente del cajón 1 desde la pestaña Solo Esta Pieza
    findButtonByText(menuEl, 'Cambiar Material / Color solo de esta pieza')!.click();
    fixture.detectChanges();
    findButtonByText(menuEl, MAT_OAK.name)!.click();
    fixture.detectChanges();

    expect(projectService.partsList().find(p => p.id === drawer1Front.id)?.materialId).toBe(MAT_OAK.id);
    expect(projectService.partsList().find(p => p.id === drawer2Front.id)?.materialId).toBe(MAT_WHITE.id);
    expect(projectService.partsList().find(p => p.id === doorPart.id)?.materialId).toBe(MAT_WHITE.id);
    expect(projectService.partsList().find(p => p.id === sideLeft.id)?.materialId).toBe(MAT_WHITE.id);

    // 2) Sobre door
    menuEl = openContextMenuOnPart(doorPart);
    findButtonByText(menuEl, 'Solo Esta Pieza')!.click();
    fixture.detectChanges();
    expect(viewer.contextMenuMode()).toBe('part');
    menuText = normalizeText(menuEl);
    assertProhibitedAbsent(menuText);
    assertAllowedPresent(menuEl, menuText);

    const toggleDoorBtn = findButtonByText(menuEl, 'Abrir / Cerrar solo esta puerta en 3D');
    expect(toggleDoorBtn).toBeDefined();
    toggleDoorBtn!.click();
    fixture.detectChanges();
    expect(internals.openTargetMap.get(doorPart.id)).toBe(1);
    expect(internals.openTargetMap.get(drawer1Front.id) ?? 0).toBe(0);
    expect(internals.openTargetMap.get(drawer2Front.id) ?? 0).toBe(0);

    // Aislar solo esta pieza
    findButtonByText(menuEl, 'Aislar Solo Esta Pieza')!.click();
    fixture.detectChanges();
    expect(viewer.isolatedTarget()).toEqual({
      kind: 'part',
      id: doorPart.id,
      label: doorPart.name
    });
    expect(designer.hiddenPartIds().size).toBe(moduleParts.length - 1);
    expect(designer.hiddenPartIds().has(doorPart.id)).toBe(false);

    designer.showAllParts();
    fixture.detectChanges();
    expect(designer.hiddenPartIds().size).toBe(0);

    // 3) Sobre side_left: no muestra toggle abrir/cerrar, sí tapacantos y ocultar temporalmente
    menuEl = openContextMenuOnPart(sideLeft);
    findButtonByText(menuEl, 'Solo Esta Pieza')!.click();
    fixture.detectChanges();
    expect(viewer.contextMenuMode()).toBe('part');
    menuText = normalizeText(menuEl);
    assertProhibitedAbsent(menuText);
    assertAllowedPresent(menuEl, menuText);
    expect(menuText).not.toContain('Abrir / Cerrar solo esta puerta en 3D');
    expect(menuText).not.toContain('Abrir / Cerrar solo este cajón en 3D');

    const prevEdgeL1 = sideLeft.edges.l1;
    findButtonByText(menuEl, 'L1')!.click();
    fixture.detectChanges();
    const updatedSide = projectService.partsList().find(p => p.id === sideLeft.id)!;
    expect(updatedSide.edges.l1).not.toBe(prevEdgeL1);

    findButtonByText(menuEl, 'Ocultar Pieza Temporalmente')!.click();
    fixture.detectChanges();
    expect(designer.hiddenPartIds().has(sideLeft.id)).toBe(true);
    expect(designer.hiddenPartIds().size).toBe(1);
  });

  it('Test 3 (Estilos Globales Sincronizados con moduleConfig, Presupuesto y Reapertura del Asistente): aplica materiales, manijas y herrajes globales en tiempo real y los conserva al reabrir ZoneCabinetBuilder', () => {
    const closet = cabinetGen.generateZoneCabinet(buildMixedParametricConfig(), TEST_MATERIALS);
    projectService.addParametricCabinet(closet);
    fixture.detectChanges();

    const groupId = closet.group.id;
    const getGroup = () => projectService.groupsList().find(g => g.id === groupId)!;
    const getModuleParts = () => projectService.partsList().filter(p => p.groupId === groupId);
    const getDoors = () => getModuleParts().filter(p => p.componentRole === 'door');
    const getDrawerFronts = () => getModuleParts().filter(p => p.componentRole === 'drawer_front');

    const initialHardware = hardwareCatalog.computeRequiredHardwareList(projectService.partsList());
    expect(initialHardware.some(h => h.id === 'hw_correderas' && h.quantity === 2)).toBe(true);
    expect(initialHardware.some(h => h.id === 'hw_bisagra_35')).toBe(true);
    expect(initialHardware.some(h => h.id === 'hw_tiradores' && h.quantity === 4)).toBe(true);

    const { internals } = attachHeadlessViewer(true);

    // 1. Cambiar Material del Casco / Estructura desde menú contextual Módulo Completo
    let menuEl = openContextMenuOnPart(getDoors()[0]);
    findButtonByText(menuEl, 'Material del Casco / Estructura')!.click();
    fixture.detectChanges();
    findButtonByText(menuEl, MAT_OAK.name)!.click();
    fixture.detectChanges();

    expect(getGroup().parametricConfig?.structureMaterialId).toBe(MAT_OAK.id);
    const carcassParts = getModuleParts().filter(
      p => p.componentRole === 'side_left' || p.componentRole === 'side_right' || p.componentRole === 'top' || p.componentRole === 'bottom' || p.componentRole === 'shelf'
    );
    expect(carcassParts.every(p => p.materialId === MAT_OAK.id)).toBe(true);
    expect(getDoors().every(d => d.materialId === MAT_WHITE.id)).toBe(true);
    expect(getDrawerFronts().every(f => f.materialId === MAT_WHITE.id)).toBe(true);

    // 2. Cambiar Material de Frentes y Puertas desde menú contextual Módulo Completo
    menuEl = openContextMenuOnPart(getDrawerFronts()[0]);
    findButtonByText(menuEl, 'Material de Frentes y Puertas')!.click();
    fixture.detectChanges();
    findButtonByText(menuEl, MAT_ANTHRACITE.name)!.click();
    fixture.detectChanges();

    expect(getGroup().parametricConfig?.doorMaterialId).toBe(MAT_ANTHRACITE.id);
    expect(getDoors().every(d => d.materialId === MAT_ANTHRACITE.id)).toBe(true);
    expect(getDrawerFronts().every(f => f.materialId === MAT_ANTHRACITE.id)).toBe(true);
    expect(carcassParts.every(p => p.materialId === MAT_OAK.id)).toBe(true);

    // 3. Probar todas las Manijas y Acabados ('black', 'gold', 'white', 'brushed_steel' + 'bar_black' y 'knob_square')
    menuEl = openContextMenuOnPart(getDoors()[0]);
    findButtonByText(menuEl, 'Manijas / Tiradores del Módulo')!.click();
    fixture.detectChanges();

    // 3a) Acabado Negro + Tirador Barra Negro Slim ('bar_black')
    findButtonByText(menuEl, 'Negro')!.click();
    fixture.detectChanges();
    expect(getGroup().parametricConfig?.handleFinish).toBe('black');
    expect([...getDoors(), ...getDrawerFronts()].every(p => p.hardwareConfig?.handleFinish === 'black')).toBe(true);

    findButtonByText(menuEl, 'Tirador Barra Negro Slim')!.click();
    fixture.detectChanges();
    expect(getGroup().parametricConfig?.handleType).toBe('bar_black');
    expect(getGroup().parametricConfig?.handleFinish).toBe('black');
    expect(
      [...getDoors(), ...getDrawerFronts()].every(
        p => p.hardwareConfig?.handleType === 'bar_black' && p.hardwareConfig?.handleFinish === 'black'
      )
    ).toBe(true);

    // 3b) Acabados 'white', 'brushed_steel' y finalmente 'gold' + 'knob_square'
    menuEl = openContextMenuOnPart(getDrawerFronts()[0]);
    findButtonByText(menuEl, 'Manijas / Tiradores del Módulo')!.click();
    fixture.detectChanges();

    findButtonByText(menuEl, 'Blanco')!.click();
    fixture.detectChanges();
    expect(getGroup().parametricConfig?.handleFinish).toBe('white');
    expect([...getDoors(), ...getDrawerFronts()].every(p => p.hardwareConfig?.handleFinish === 'white')).toBe(true);

    findButtonByText(menuEl, 'Inox')!.click();
    fixture.detectChanges();
    expect(getGroup().parametricConfig?.handleFinish).toBe('brushed_steel');
    expect(
      [...getDoors(), ...getDrawerFronts()].every(p => p.hardwareConfig?.handleFinish === 'brushed_steel')
    ).toBe(true);

    findButtonByText(menuEl, 'Dorado')!.click();
    fixture.detectChanges();
    expect(getGroup().parametricConfig?.handleFinish).toBe('gold');
    expect([...getDoors(), ...getDrawerFronts()].every(p => p.hardwareConfig?.handleFinish === 'gold')).toBe(true);

    findButtonByText(menuEl, 'Pomo Cuadrado Geométrico')!.click();
    fixture.detectChanges();
    expect(getGroup().parametricConfig?.handleType).toBe('knob_square');
    expect(getGroup().parametricConfig?.handleFinish).toBe('gold');
    expect(
      [...getDoors(), ...getDrawerFronts()].every(
        p => p.hardwareConfig?.handleType === 'knob_square' && p.hardwareConfig?.handleFinish === 'gold'
      )
    ).toBe(true);

    // Verificar renderizado 3D con color dorado real (0xd97706) en tiradores de puertas y cajones
    internals.buildFurnitureScene(
      designer.currentParts(),
      designer.selectedPartIds(),
      designer.allAvailableMaterials(),
      false,
      false
    );
    const doorEntry = internals.pieceObjectMap.get(getDoors()[0].id)!;
    const drawerEntry = internals.pieceObjectMap.get(getDrawerFronts()[0].id)!;
    expect(doorEntry.handleGroup).toBeDefined();
    expect(drawerEntry.handleGroup).toBeDefined();
    expect(collectMeshMaterialColorsHex(doorEntry.handleGroup!)).toContain(
      hardwareCatalog.getFinishHexColor('gold')
    );
    expect(collectMeshMaterialColorsHex(drawerEntry.handleGroup!)).toContain(
      hardwareCatalog.getFinishHexColor('gold')
    );

    // 4. Herrajes Globales: Correderas ('soft_close' -> 'undermount') y Bisagras ('corner_165' -> 'half_cranked') + Presupuesto en vivo
    menuEl = openContextMenuOnPart(getDrawerFronts()[0]);
    findButtonByText(menuEl, 'Correderas del Módulo')!.click();
    fixture.detectChanges();
    findButtonByText(menuEl, 'Corredera Telescópica Cierre Suave (Soft-Close)')!.click();
    fixture.detectChanges();

    expect(getDrawerFronts().every(f => f.hardwareConfig?.slideType === 'soft_close')).toBe(true);
    expect(getGroup().parametricConfig?.drawerSlideType).toBe('soft_close');

    menuEl = openContextMenuOnPart(getDrawerFronts()[0]);
    findButtonByText(menuEl, 'Correderas del Módulo')!.click();
    fixture.detectChanges();
    findButtonByText(menuEl, 'Corredera Oculta Bajo Cajón (Tandem)')!.click();
    fixture.detectChanges();

    expect(getDrawerFronts().every(f => f.hardwareConfig?.slideType === 'undermount')).toBe(true);
    expect(getGroup().parametricConfig?.drawerSlideType).toBe('undermount');

    const hwAfterUndermount = hardwareCatalog.computeRequiredHardwareList(projectService.partsList());
    expect(hwAfterUndermount.some(h => h.id === 'hw_correderas')).toBe(false);
    expect(hwAfterUndermount.some(h => h.id === 'hw_correderas_oculta' && h.quantity === 2)).toBe(true);

    // Probar bisagra especial 165° y verificar impacto instantáneo en Presupuesto
    menuEl = openContextMenuOnPart(getDoors()[0]);
    findButtonByText(menuEl, 'Bisagras del Módulo')!.click();
    fixture.detectChanges();
    findButtonByText(menuEl, 'Bisagra Gran Apertura 165° (Rincón Ciego)')!.click();
    fixture.detectChanges();

    expect(getDoors().every(d => d.hardwareConfig?.hingeType === 'corner_165')).toBe(true);
    const hwAfter165 = hardwareCatalog.computeRequiredHardwareList(projectService.partsList());
    expect(hwAfter165.some(h => h.id === 'hw_bisagra_165' && h.quantity > 0)).toBe(true);
    expect(hwAfter165.some(h => h.id === 'hw_bisagra_35')).toBe(false);

    // Aplicar 'half_cranked' globalmente (vía menú contextual) y verificar presupuesto + móduloConfig
    menuEl = openContextMenuOnPart(getDoors()[0]);
    findButtonByText(menuEl, 'Bisagras del Módulo')!.click();
    fixture.detectChanges();
    findButtonByText(menuEl, 'Bisagra Semicodo (Semiparche)')!.click();
    fixture.detectChanges();

    expect(getDoors().every(d => d.hardwareConfig?.hingeType === 'half_cranked')).toBe(true);
    expect(getGroup().parametricConfig?.hingeType).toBe('half_cranked');
    const hwAfterHalfCranked = hardwareCatalog.computeRequiredHardwareList(projectService.partsList());
    expect(hwAfterHalfCranked.some(h => h.id === 'hw_bisagra_35' && h.quantity > 0)).toBe(true);

    // 5. Reconstrucción y reapertura en ZoneCabinetBuilderComponent manteniendo estilos intactos
    const reconstructed = cabinetGen.reconstructConfigFromParts(getModuleParts(), getGroup());
    expect(reconstructed.structureMaterialId).toBe(MAT_OAK.id);
    expect(reconstructed.doorMaterialId).toBe(MAT_ANTHRACITE.id);
    expect(reconstructed.handleType).toBe('knob_square');
    expect(reconstructed.handleFinish).toBe('gold');
    expect(reconstructed.hingeType).toBe('half_cranked');
    expect(reconstructed.drawerSlideType).toBe('undermount');

    designer.openZoneBuilderForExistingGroup(groupId);
    fixture.detectChanges();

    expect(designer.isZoneBuilderOpen()).toBe(true);
    const builder = designer.zoneBuilderRef()!;
    expect(builder).toBeTruthy();
    expect(builder.structureMaterialId()).toBe(MAT_OAK.id);
    expect(builder.doorMaterialId()).toBe(MAT_ANTHRACITE.id);
    expect(builder.moduleHandleType()).toBe('knob_square');
    expect(builder.moduleHandleFinish()).toBe('gold');
    expect(builder.moduleHingeType()).toBe('half_cranked');
    expect(builder.moduleDrawerSlideType()).toBe('undermount');

    const drawerZone = builder.zoneTree().children?.find(c => c.id === 'bay_drawers');
    const doorZone = builder.zoneTree().children?.find(c => c.id === 'bay_doors');
    expect(drawerZone?.content?.drawers?.slideType).toBe('undermount');
    expect(doorZone?.content?.doors?.hingeType).toBe('half_cranked');
    expect(doorZone?.content?.doors?.handleType).toBe('knob_square');
    expect(doorZone?.content?.doors?.handleFinish).toBe('gold');

    // Confirmar el Asistente sin alterar estilos y verificar que las piezas regeneradas los mantienen
    builder.confirmModule();
    fixture.detectChanges();
    expect(designer.isZoneBuilderOpen()).toBe(false);
    expect(getDoors().every(d =>
      d.materialId === MAT_ANTHRACITE.id &&
      d.hardwareConfig?.handleType === 'knob_square' &&
      d.hardwareConfig?.handleFinish === 'gold' &&
      d.hardwareConfig?.hingeType === 'half_cranked'
    )).toBe(true);
    expect(getDrawerFronts().every(f =>
      f.materialId === MAT_ANTHRACITE.id &&
      f.hardwareConfig?.handleType === 'knob_square' &&
      f.hardwareConfig?.handleFinish === 'gold' &&
      f.hardwareConfig?.slideType === 'undermount'
    )).toBe(true);
  });

  it('Test 4 (Modal 3 Botones y Flujo Seguro Desagrupar a Edición Libre -> Grupo Libre): valida Cancelar, Abrir en Asistente y Sí Desagrupar + reagrupación estricta como custom-group sin parametricConfig', async () => {
    const closet = cabinetGen.generateZoneCabinet(buildMixedParametricConfig(), TEST_MATERIALS);
    projectService.addParametricCabinet(closet);
    fixture.detectChanges();

    const originalGroupId = closet.group.id;
    const originalPartIds = projectService
      .partsList()
      .filter(p => p.groupId === originalGroupId)
      .map(p => p.id);

    designer.selectEntireGroup(originalGroupId);
    designer.activeDockTab.set('piece');
    fixture.detectChanges();
    expect(designer.selectionContextType()).toBe('parametric-module');
    expect(getInspectorText()).toContain('Desagrupar a Edición Libre');

    // Caso 1: 'cancel' -> mantiene intacto el parametric-module
    const askChoiceSpy = vi.spyOn(confirmService, 'askChoice');
    const cancelPromise = designer.ungroup(originalGroupId);
    dialogFixture.detectChanges();
    expect(askChoiceSpy).toHaveBeenCalledTimes(1);
    expect(normalizeText(dialogEl)).toContain('¿Desagrupar módulo a Edición Libre?');

    const cancelBtn = dialogEl.querySelector('[data-dialog-action="cancel"]') as HTMLButtonElement | null;
    const secondaryBtn = dialogEl.querySelector('[data-dialog-action="secondary"]') as HTMLButtonElement | null;
    const confirmBtn = dialogEl.querySelector('[data-dialog-action="confirm"]') as HTMLButtonElement | null;
    expect(cancelBtn).not.toBeNull();
    expect(secondaryBtn).not.toBeNull();
    expect(confirmBtn).not.toBeNull();
    expect(normalizeText(cancelBtn!)).toBe('Cancelar');
    expect(normalizeText(secondaryBtn!)).toContain('Abrir en Asistente');
    expect(normalizeText(confirmBtn!)).toContain('Sí, Desagrupar a Edición Libre');

    cancelBtn!.click();
    await flushMicrotasks();
    await cancelPromise;
    fixture.detectChanges();

    expect(projectService.groupsList().some(g => g.id === originalGroupId)).toBe(true);
    expect(designer.selectionContextType()).toBe('parametric-module');
    expect(designer.isZoneBuilderOpen()).toBe(false);
    expect(
      projectService
        .partsList()
        .filter(p => originalPartIds.includes(p.id))
        .every(p => p.groupId === originalGroupId && p.isParametricGenerated === true)
    ).toBe(true);

    // Caso 2: 'secondary' ('Abrir en Asistente') -> abre ZoneCabinetBuilder sin desagrupar
    const secondaryPromise = designer.ungroupSelected();
    dialogFixture.detectChanges();

    const secondaryActionBtn = dialogEl.querySelector(
      '[data-dialog-action="secondary"]'
    ) as HTMLButtonElement;
    secondaryActionBtn.click();
    await flushMicrotasks();
    await secondaryPromise;
    fixture.detectChanges();

    expect(projectService.groupsList().some(g => g.id === originalGroupId)).toBe(true);
    expect(designer.isZoneBuilderOpen()).toBe(true);
    expect(designer.zoneBuilderEditingGroupId()).toBe(originalGroupId);
    expect(
      hasReliableParametricRecipe(
        projectService.groupsList().find(g => g.id === originalGroupId),
        projectService.partsList().filter(p => p.groupId === originalGroupId)
      )
    ).toBe(true);

    designer.onZoneBuilderCancelled();
    fixture.detectChanges();
    expect(designer.isZoneBuilderOpen()).toBe(false);

    // Caso 3: 'confirm' ('Sí, Desagrupar a Edición Libre') -> desvincula a single-piece libre y reagrupar crea Grupo Libre ('custom-group')
    const confirmPromise = designer.ungroup(originalGroupId);
    dialogFixture.detectChanges();

    const confirmActionBtn = dialogEl.querySelector(
      '[data-dialog-action="confirm"]'
    ) as HTMLButtonElement;
    confirmActionBtn.click();
    await flushMicrotasks();
    await confirmPromise;
    fixture.detectChanges();

    expect(projectService.groupsList().some(g => g.id === originalGroupId)).toBe(false);
    const releasedParts = projectService.partsList().filter(p => originalPartIds.includes(p.id));
    expect(releasedParts.length).toBe(originalPartIds.length);
    for (const rp of releasedParts) {
      expect(rp.groupId).toBeUndefined();
      expect(rp.moduleId).toBeUndefined();
      expect(rp.zoneId).toBeUndefined();
      expect(rp.sourceParametricModuleId).toBeUndefined();
      expect(rp.sourceParametricGroupId).toBeUndefined();
      expect(rp.isParametricGenerated).toBe(false);
    }

    // Al seleccionar una sola pieza liberada pasa a single-piece libre (no estructurado)
    designer.onPartsSelectedFrom3D([releasedParts[0].id]);
    designer.activeDockTab.set('piece');
    fixture.detectChanges();
    expect(designer.selectionContextType()).toBe('single-piece');
    expect(designer.isSelectedPartStructuredMember()).toBe(false);
    expect(getInspectorText()).toContain('Disposición en el Mueble');

    // Volver a agrupar manualmente con createGroup -> estrictamente 'custom-group' ('Grupo Libre')
    designer.selectedPartIds.set(originalPartIds);
    designer.selectedPartId.set(originalPartIds[0]);
    designer.quickGroupSelectedParts();
    fixture.detectChanges();
    designer.newGroupNameInput.set('Grupo Libre Post Desagrupar');
    designer.confirmCreateGroup();
    fixture.detectChanges();

    const customGroup = projectService
      .groupsList()
      .find(g => g.name === 'Grupo Libre Post Desagrupar')!;
    expect(customGroup).toBeDefined();
    expect(customGroup.parametricConfig).toBeUndefined();

    const customGroupParts = projectService.partsList().filter(p => p.groupId === customGroup.id);
    expect(hasReliableParametricRecipe(customGroup, customGroupParts)).toBe(false);
    expect(isStandaloneModularDrawerGroup(customGroup, customGroupParts)).toBe(false);

    designer.selectEntireGroup(customGroup.id);
    designer.activeDockTab.set('piece');
    fixture.detectChanges();

    expect(designer.selectionContextType()).toBe('custom-group');
    expect(designer.selectionContextLabel()).toBe('Grupo Libre');

    const freeGroupInspector = getInspectorText();
    expect(freeGroupInspector).toContain('Grupo Libre');
    expect(freeGroupInspector).toContain('Material del Grupo');
    expect(freeGroupInspector).toContain('Inspección 3D');
    expect(freeGroupInspector).toContain('Posición 3D');
    expect(freeGroupInspector).not.toContain('Editar Estructura del Módulo (Asistente)');

    // Editable por material, posición, aislamiento y explosión
    expect(designer.showIsolateControl()).toBe(true);
    expect(designer.showExplodeControls()).toBe(true);

    designer.applyGroupMaterial(MAT_OAK.id, 'structure');
    fixture.detectChanges();
    expect(
      projectService
        .partsList()
        .find(p => p.groupId === customGroup.id && p.componentRole === 'side_left')?.materialId
    ).toBe(MAT_OAK.id);

    const sideBeforeMove = projectService
      .partsList()
      .find(p => p.groupId === customGroup.id && p.componentRole === 'side_left')!;
    const prevX = sideBeforeMove.posX ?? 0;
    projectService.moveGroup(customGroup.id, 120, 0, 0);
    fixture.detectChanges();
    expect(projectService.partsList().find(p => p.id === sideBeforeMove.id)?.posX).toBeCloseTo(
      prevX + 120,
      1
    );

    const { viewer } = attachHeadlessViewer(true);
    viewer.isolateGroupById(customGroup.id);
    fixture.detectChanges();
    expect(viewer.isolatedTarget()).toEqual({
      kind: 'group',
      id: customGroup.id,
      label: customGroup.name
    });
    designer.showAllParts();
    fixture.detectChanges();

    designer.toggleExplodedView3D();
    fixture.detectChanges();
    expect(designer.viewerExplodedPercent()).toBe(50);
    designer.resetExplodedView3D();
    fixture.detectChanges();
    expect(designer.viewerExplodedPercent()).toBe(0);

    // Bloqueo de reapertura en Asistente
    designer.openEditGroup(customGroup.id);
    designer.openZoneBuilderForExistingGroup(customGroup.id);
    fixture.detectChanges();
    expect(designer.isZoneBuilderOpen()).toBe(false);

    // Menú contextual 3D sobre el Grupo Libre muestra badge Grupo Libre y sin botón Asistente
    const customMenuEl = openContextMenuOnPart(
      projectService.partsList().find(p => p.groupId === customGroup.id && p.componentRole === 'side_left')!
    );
    const customMenuText = normalizeText(customMenuEl);
    expect(customMenuText).toContain('Grupo Libre');
    expect(customMenuText).not.toContain('Editar Estructura en Asistente');
    expect(customMenuText).not.toContain('Paramétrico');
  });
});
