import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { User } from '@supabase/supabase-js';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MELAMINE_MATERIALS_CATALOG } from '../../data/melamine-catalog.data';
import {
  CabinetZoneNode,
  ComponentRole,
  Material,
  ParametricCabinetConfig,
  Part,
  ProjectSettings
} from '../../models/melamine.models';
import { CabinetGeneratorService } from '../../services/cabinet-generator.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { CutOptimizerService } from '../../services/cut-optimizer.service';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';
import { I18nService } from '../../services/i18n.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { PartGeometryService, PartLocalDimensions } from '../../services/part-geometry.service';
import { PaymentService } from '../../services/payment.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { SupabaseService, SyncStatus } from '../../services/supabase.service';
import { TemplatesCatalogService } from '../../services/templates-catalog.service';
import { ThemeService } from '../../services/theme.service';
import { ProceduralTextureFactory } from '../../utils/procedural-textures';
import { Furniture3dViewerComponent } from '../furniture-3d-viewer/furniture-3d-viewer';
import { PartsListComponent } from '../parts-list/parts-list';
import { ModuleDesignerComponent } from './module-designer';

interface ViewerSceneInternals {
  initThree: () => void;
  scene: THREE.Scene;
  furnitureGroup: THREE.Group;
  zoneHighlightGroup: THREE.Group;
  pieceObjects: {
    part: Part;
    mesh: THREE.Object3D;
    isDoor: boolean;
    hingeSide?: 'left' | 'right' | 'top' | 'bottom';
    handleGroup?: THREE.Group;
    hingeGroup?: THREE.Group;
  }[];
  pieceObjectMap: Map<
    string,
    {
      part: Part;
      mesh: THREE.Object3D;
      isDoor: boolean;
      hingeSide?: 'left' | 'right' | 'top' | 'bottom';
      handleGroup?: THREE.Group;
      hingeGroup?: THREE.Group;
    }
  >;
  buildFurnitureScene: (
    parts: Part[],
    selectedIds: string[],
    materials: Material[],
    isXRay: boolean,
    showDims: boolean
  ) => void;
}

function getCatalogMaterial(id: string): Material {
  const found = MELAMINE_MATERIALS_CATALOG.find(m => m.id === id);
  if (!found) {
    throw new Error(`Material de catálogo faltante en test: ${id}`);
  }
  return { ...found };
}

const MAT_WOOD_ROBLE = getCatalogMaterial('mat_roble_18');
const MAT_SMOOTH_BLANCO = getCatalogMaterial('mat_blanco_18');
const MAT_SMOOTH_CUERO_VISON = getCatalogMaterial('mat_cuero_vison_18');
const MAT_MDF_3 = getCatalogMaterial('mat_mdf_3');

const HITO1_TEST_MATERIALS: Material[] = [
  MAT_WOOD_ROBLE,
  MAT_SMOOTH_BLANCO,
  MAT_SMOOTH_CUERO_VISON,
  MAT_MDF_3
];

const HITO1_TEST_SETTINGS: ProjectSettings = {
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

function buildClosetZoneConfig(): ParametricCabinetConfig {
  const zoneTree: CabinetZoneNode = {
    id: 'closet_root',
    splitDirection: 'vertical',
    children: [
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
            opening: 'left',
            mount: 'overlay',
            hasHandle: true,
            handleType: 'bar_modern',
            handleFinish: 'brushed_steel'
          }
        }
      }
    ]
  };

  return {
    code: 'CLOSET_H1',
    name: 'Closet Hito 1',
    moduleType: 'closet',
    category: 'custom',
    width: 1200,
    height: 2000,
    depth: 580,
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
    structureMaterialId: MAT_SMOOTH_BLANCO.id,
    doorMaterialId: MAT_SMOOTH_BLANCO.id,
    backMaterialId: MAT_MDF_3.id,
    facadeGap: 3,
    baseType: 'plinth',
    hasPlinth: true,
    plinthHeight: 80,
    hasTopCover: true,
    topTieStrips: false,
    posX: 0,
    posY: 1000,
    posZ: 0,
    zoneTree
  };
}

function computeLocalBoxInParentMesh(
  parentMesh: THREE.Object3D,
  childGroup: THREE.Object3D
): THREE.Box3 {
  parentMesh.updateMatrixWorld(true);
  const invParentMatrix = parentMesh.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  childGroup.traverse(node => {
    if (node instanceof THREE.Mesh && node.geometry) {
      node.geometry.computeBoundingBox();
      if (node.geometry.boundingBox) {
        const toParent = node.matrixWorld.clone().premultiply(invParentMatrix);
        const childBox = node.geometry.boundingBox.clone().applyMatrix4(toParent);
        box.union(childBox);
      }
    }
  });
  return box;
}

function getAxisCoord(
  attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  index: number,
  axis: 'x' | 'y' | 'z'
): number {
  return axis === 'x' ? attr.getX(index) : axis === 'y' ? attr.getY(index) : attr.getZ(index);
}

function getAxisSpan(localDims: PartLocalDimensions, axis: 'x' | 'y' | 'z'): number {
  return axis === 'x' ? localDims.sx : axis === 'y' ? localDims.sy : localDims.sz;
}

function assertBroadFaceUVsAligned(
  geom: THREE.BufferGeometry,
  localDims: PartLocalDimensions
): void {
  const posAttr = geom.getAttribute('position');
  const normAttr = geom.getAttribute('normal');
  const uvAttr = geom.getAttribute('uv');
  expect(posAttr).toBeDefined();
  expect(normAttr).toBeDefined();
  expect(uvAttr).toBeDefined();
  expect(posAttr.count).toBeGreaterThan(0);

  const lenSpan = getAxisSpan(localDims, localDims.lengthLocalAxis);
  const widSpan = getAxisSpan(localDims, localDims.widthLocalAxis);

  let broadFaceVerticesChecked = 0;
  for (let i = 0; i < posAttr.count; i++) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    expect(Number.isFinite(u)).toBe(true);
    expect(Number.isFinite(v)).toBe(true);
    expect(u).toBeGreaterThanOrEqual(-1e-5);
    expect(u).toBeLessThanOrEqual(1 + 1e-5);
    expect(v).toBeGreaterThanOrEqual(-1e-5);
    expect(v).toBeLessThanOrEqual(1 + 1e-5);

    const nThk = Math.abs(getAxisCoord(normAttr, i, localDims.thicknessLocalAxis));
    if (nThk > 0.9) {
      broadFaceVerticesChecked++;
      const coordLen = getAxisCoord(posAttr, i, localDims.lengthLocalAxis);
      const coordWid = getAxisCoord(posAttr, i, localDims.widthLocalAxis);
      const expectedU = (coordLen + lenSpan / 2) / lenSpan;
      const expectedV = (coordWid + widSpan / 2) / widSpan;
      expect(u).toBeCloseTo(expectedU, 3);
      expect(v).toBeCloseTo(expectedV, 3);
    }
  }
  expect(broadFaceVerticesChecked).toBeGreaterThan(0);
}

describe('Hito 1 — Integración Real de Piezas Individuales, Inspección 3D, Puertas/Herrajes y Veta 90°', () => {
  let fixture: ComponentFixture<ModuleDesignerComponent>;
  let designer: ModuleDesignerComponent;
  let hostEl: HTMLElement;
  let projectService: ProjectStorageService;
  let partGeometry: PartGeometryService;
  let cabinetGen: CabinetGeneratorService;
  let hardwareCatalog: HardwareCatalogService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as ViewerSceneInternals,
      'initThree'
    ).mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [ModuleDesignerComponent],
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
        TemplatesCatalogService,
        ThemeService,
        I18nService
      ]
    }).compileComponents();

    TestBed.inject(I18nService).setLanguage('es');
    projectService = TestBed.inject(ProjectStorageService);
    partGeometry = TestBed.inject(PartGeometryService);
    cabinetGen = TestBed.inject(CabinetGeneratorService);
    hardwareCatalog = TestBed.inject(HardwareCatalogService);

    projectService.clearFurniture();
    projectService.updateProject(
      p => ({
        ...p,
        materials: HITO1_TEST_MATERIALS.map(m => ({ ...m })),
        settings: { ...HITO1_TEST_SETTINGS }
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
    ProceduralTextureFactory.clearCache();
    vi.restoreAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  const getInspectorEl = (): HTMLElement =>
    hostEl.querySelector('.md-inspector-panel') as HTMLElement;

  const getInspectorText = (): string => getInspectorEl()?.textContent ?? '';

  const findInspectorButtons = (label: string): HTMLButtonElement[] =>
    Array.from(getInspectorEl().querySelectorAll('button')).filter(b =>
      b.textContent?.includes(label)
    ) as HTMLButtonElement[];

  describe('TAREA 1: Unificación total de single-piece y miembros estructurados de grupo', () => {
    it('unifica Tablero Libre y piezas sueltas del catálogo (side_left, side_right, top, bottom, shelf, door) con inspector Pieza Individual 01..06', () => {
      const catalogRoles: ComponentRole[] = [
        'side_left',
        'side_right',
        'top',
        'bottom',
        'shelf',
        'door'
      ];

      const verifyUnifiedSinglePieceDom = (expectedPart: Part): void => {
        expect(expectedPart.groupId).toBeUndefined();
        expect(designer.selectionContextType()).toBe('single-piece');
        expect(designer.isSelectedPartStructuredMember()).toBe(false);

        const text = getInspectorText();
        expect(text).toContain('Pieza Individual');
        expect(text).toContain('Rol / Tipo:');
        expect(text).toContain('Tablero Estructural');
        expect(text).toContain('Puerta Izquierda');
        expect(text).toContain('Puerta Derecha');
        expect(text).toContain('Disposición en el Mueble:');
        expect(text).toContain('Horizontal');
        expect(text).toContain('Lateral (YZ)');
        expect(text).toContain('Frontal (XY)');
        expect(text).toContain('01 ·');
        expect(text).toContain('02 ·');
        expect(text).toContain('03 ·');
        expect(text).toContain('04 ·');
        expect(text).toContain('05 ·');
        expect(text).toContain('06 · Mecanizados de Ensamble');
        expect(text).toContain('Duplicar');
        expect(text).toContain('Ocultar');
        expect(text).toContain('Eliminar');
      };

      // 1. Tablero libre
      designer.addFreeBoard();
      fixture.detectChanges();
      const freeBoard = designer.selectedPart()!;
      expect(freeBoard).toBeTruthy();
      verifyUnifiedSinglePieceDom(freeBoard);

      // 2. Piezas sueltas del catálogo
      for (const role of catalogRoles) {
        projectService.clearFurniture();
        fixture.detectChanges();

        designer.addPieceFromCatalog(role);
        fixture.detectChanges();

        const created = designer.selectedPart()!;
        expect(created).toBeTruthy();
        expect(created.componentRole).toBe(role);
        verifyUnifiedSinglePieceDom(created);

        if (role === 'door') {
          const localDims = partGeometry.getLocalDimensions(created);
          const worldAabb = partGeometry.getWorldAABB(created);
          expect(created.orientation).toBe('vertical_xy');
          expect(created.rotationX ?? 0).toBe(0);
          expect(created.rotationY ?? 0).toBe(0);
          expect(created.rotationZ ?? 0).toBe(0);
          expect(created.posY).toBeGreaterThanOrEqual(localDims.sy / 2);
          expect(worldAabb.minY).toBeGreaterThanOrEqual(0);
          expect(created.hardwareConfig).toBeDefined();
          expect(created.hardwareConfig?.isMovable).toBe(true);
          expect(created.hardwareConfig?.movableType).toBe('door');
          expect(created.hardwareConfig?.openingDirection).toBe('left');
          expect(created.hardwareConfig?.hingeType).toBe('straight');
          expect(created.hardwareConfig?.hingeCount).toBeGreaterThanOrEqual(2);
          expect(created.hardwareConfig?.handleType).toBe('bar_modern');
          expect(created.hardwareConfig?.handlePosition).toBe('center');
          expect(designer.selectedPartRoleOrDoorMode()).toBe('door-left');
        }
      }
    });

    it('mantiene isSelectedPartStructuredMember() === true para puerta o frente de cajón perteneciente a un grupo (closet)', () => {
      const closet = cabinetGen.generateZoneCabinet(buildClosetZoneConfig(), HITO1_TEST_MATERIALS);
      projectService.addParametricCabinet(closet);
      fixture.detectChanges();

      const groupDoor = projectService
        .partsList()
        .find(p => p.groupId === closet.group.id && p.componentRole === 'door');
      const groupDrawerFront = projectService
        .partsList()
        .find(p => p.groupId === closet.group.id && p.componentRole === 'drawer_front');

      expect(groupDoor).toBeDefined();
      expect(groupDrawerFront).toBeDefined();

      designer.onPartsSelectedFrom3D([groupDoor!.id]);
      designer.activeDockTab.set('piece');
      fixture.detectChanges();
      expect(designer.selectionContextType()).toBe('single-piece');
      expect(designer.isSelectedPartStructuredMember()).toBe(true);
      expect(getInspectorText()).not.toContain('Disposición en el Mueble:');

      designer.onPartsSelectedFrom3D([groupDrawerFront!.id]);
      designer.activeDockTab.set('piece');
      fixture.detectChanges();
      expect(designer.selectionContextType()).toBe('single-piece');
      expect(designer.isSelectedPartStructuredMember()).toBe(true);
      expect(getInspectorText()).not.toContain('Disposición en el Mueble:');
    });
  });

  describe('TAREA 2: Visibilidad limpia de Inspección 3D (Aislar / Vista Explosiva)', () => {
    it('oculta Inspección 3D, botón Explosionar y Aislar Solo Esta Pieza cuando hay 1 sola pieza en escena', () => {
      designer.addFreeBoard();
      fixture.detectChanges();

      const singlePart = designer.selectedPart()!;
      expect(designer.currentParts().length).toBe(1);
      expect(designer.showIsolateControl()).toBe(false);
      expect(designer.showExplodeControls()).toBe(false);

      const inspectorText = getInspectorText();
      expect(inspectorText).not.toContain('Inspección 3D');
      expect(inspectorText).not.toContain('Aislar Pieza');
      expect(inspectorText).not.toContain('Explosionar Piezas');
      expect(inspectorText).not.toContain('Vista Explosiva 3D');

      const viewer = designer.viewer3d()!;
      expect(viewer).toBeTruthy();
      expect(viewer.canShowExplodedButton()).toBe(false);
      expect(hostEl.querySelector('[data-testid="cad-exploded-btn"]')).toBeNull();

      viewer.contextMenuPart.set(singlePart);
      viewer.contextMenuPos.set({ x: 100, y: 100 });
      fixture.detectChanges();

      const ctxMenu = hostEl.querySelector('.cad-context-menu') as HTMLElement;
      expect(ctxMenu).toBeTruthy();
      expect(ctxMenu.textContent).not.toContain('Aislar Solo Esta Pieza');
    });

    it('muestra Aislar Pieza pero oculta Explosionar Piezas y Vista Explosiva 3D cuando hay 2 piezas sueltas con 1 seleccionada', () => {
      designer.addFreeBoard();
      designer.addPieceFromCatalog('shelf');
      fixture.detectChanges();

      expect(designer.currentParts().length).toBe(2);
      expect(designer.selectionContextType()).toBe('single-piece');
      expect(designer.showIsolateControl()).toBe(true);
      expect(designer.showExplodeControls()).toBe(false);

      const inspectorText = getInspectorText();
      expect(inspectorText).toContain('Inspección 3D');
      expect(inspectorText).toContain('Aislar Pieza');
      expect(inspectorText).not.toContain('Explosionar Piezas');
      expect(inspectorText).not.toContain('Vista Explosiva 3D');
      expect(
        getInspectorEl().querySelector('input[aria-label="Porcentaje de vista explosiva 3D"]')
      ).toBeNull();

      const viewer = designer.viewer3d()!;
      expect(viewer.canShowExplodedButton()).toBe(false);
      viewer.contextMenuPart.set(designer.selectedPart()!);
      viewer.contextMenuPos.set({ x: 100, y: 100 });
      fixture.detectChanges();

      const ctxMenu = hostEl.querySelector('.cad-context-menu') as HTMLElement;
      expect(ctxMenu.textContent).toContain('Aislar Solo Esta Pieza');
    });

    it('muestra Aislar Módulo y controles de explosión cuando se selecciona un módulo grupal de >= 2 piezas', () => {
      const closet = cabinetGen.generateZoneCabinet(buildClosetZoneConfig(), HITO1_TEST_MATERIALS);
      projectService.addParametricCabinet(closet);
      fixture.detectChanges();

      designer.selectEntireGroup(closet.group.id);
      designer.activeDockTab.set('piece');
      fixture.detectChanges();

      expect(designer.selectionContextType()).toBe('parametric-module');
      expect(designer.showIsolateControl()).toBe(true);
      expect(designer.showExplodeControls()).toBe(true);

      const inspectorText = getInspectorText();
      expect(inspectorText).toContain('Inspección 3D');
      expect(inspectorText).toContain('Aislar Módulo');
      expect(inspectorText).toContain('Explosionar Piezas');
      expect(inspectorText).toContain('Vista Explosiva 3D');
      expect(
        getInspectorEl().querySelector('input[aria-label="Porcentaje de vista explosiva 3D"]')
      ).not.toBeNull();
    });
  });

  describe('TAREA 3: Eliminación cajón roto, conversión a Puerta Batiente, herrajes 3D/presupuesto y reversión', () => {
    it('elimina Convertir Pieza en Cajón Modular del inspector y Frente de Cajón Móvil del menú contextual 3D', () => {
      designer.addFreeBoard();
      fixture.detectChanges();

      const freePart = designer.selectedPart()!;
      expect(getInspectorText()).not.toContain('Convertir Pieza en Cajón Modular');

      const viewer = designer.viewer3d()!;
      viewer.contextMenuPart.set(freePart);
      viewer.contextMenuPos.set({ x: 100, y: 100 });
      viewer.showMovableRoleSubmenu.set(true);
      fixture.detectChanges();

      const ctxMenu = hostEl.querySelector('.cad-context-menu') as HTMLElement;
      expect(ctxMenu.textContent).not.toContain('Frente de Cajón Móvil');
      expect(ctxMenu.textContent).toContain('Puerta Batiente (Izquierda)');
      expect(ctxMenu.textContent).toContain('Puerta Batiente (Derecha)');
    });

    it('estrés: convierte tablero horizontal inclinado sobre el suelo a Puerta Izquierda (vía viewer y vía designer), cambia a Derecha, genera bisagras/tirador 3D y revierte a Tablero Estructural incluso con nombre PUERTA...', () => {
      const tiltedSeed: Part = {
        id: 'tilted_stress_board',
        name: 'Tablero Inclinado Estrés',
        length: 400,
        width: 720,
        thickness: 15,
        quantity: 1,
        materialId: MAT_WOOD_ROBLE.id,
        materialName: MAT_WOOD_ROBLE.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        posX: 0,
        posY: 7.5,
        posZ: 0,
        rotationX: 22,
        rotationY: 0,
        rotationZ: -15,
        orientation: 'horizontal',
        componentRole: 'free',
        isParametricGenerated: false
      };

      // Vía 1: conversión desde menú contextual 3D (viewer.setContextMenuPartMovable)
      projectService.addPart(tiltedSeed);
      designer.onPartsSelectedFrom3D([tiltedSeed.id]);
      designer.activeDockTab.set('piece');
      fixture.detectChanges();

      const embeddedViewer = designer.viewer3d()!;
      embeddedViewer.contextMenuPart.set(
        projectService.partsList().find(p => p.id === tiltedSeed.id)!
      );
      embeddedViewer.setContextMenuPartMovable('door', 'left');
      fixture.detectChanges();

      const doorFromViewer = projectService.partsList().find(p => p.id === tiltedSeed.id)!;
      const viewerDoorAabb = partGeometry.getWorldAABB(doorFromViewer);
      expect(doorFromViewer.componentRole).toBe('door');
      expect(doorFromViewer.orientation).toBe('vertical_xy');
      expect(doorFromViewer.rotationX ?? 0).toBe(0);
      expect(doorFromViewer.rotationZ ?? 0).toBe(0);
      expect(viewerDoorAabb.minY).toBeGreaterThanOrEqual(0);
      expect(doorFromViewer.hardwareConfig?.isMovable).toBe(true);
      expect(doorFromViewer.hardwareConfig?.movableType).toBe('door');
      expect(doorFromViewer.hardwareConfig?.openingDirection).toBe('left');

      // Vía 2: reiniciamos a tablero inclinado y convertimos vía inspector (designer.setSelectedPartRoleOrDoor)
      projectService.clearFurniture();
      projectService.addPart({ ...tiltedSeed });
      designer.onPartsSelectedFrom3D([tiltedSeed.id]);
      designer.activeDockTab.set('piece');
      fixture.detectChanges();

      designer.setSelectedPartRoleOrDoor('door-left');
      fixture.detectChanges();

      const doorLeft = projectService.partsList().find(p => p.id === tiltedSeed.id)!;
      const leftAabb = partGeometry.getWorldAABB(doorLeft);
      expect(doorLeft.componentRole).toBe('door');
      expect(doorLeft.orientation).toBe('vertical_xy');
      expect(doorLeft.rotationX ?? 0).toBe(0);
      expect(doorLeft.rotationZ ?? 0).toBe(0);
      expect(leftAabb.minY).toBeGreaterThanOrEqual(0);
      expect(doorLeft.hardwareConfig?.openingDirection).toBe('left');

      // Herrajes presupuestales para puerta izquierda
      const hwLeft = hardwareCatalog.computeRequiredHardwareList([doorLeft]);
      const hingeItemLeft = hwLeft.find(item => item.category === 'hinge');
      const handleItemLeft = hwLeft.find(item => item.category === 'handle');
      expect(hingeItemLeft).toBeDefined();
      expect(hingeItemLeft?.quantity).toBeGreaterThanOrEqual(2);
      expect(handleItemLeft).toBeDefined();
      expect(handleItemLeft?.quantity).toBe(1);

      // Construcción 3D real en Furniture3dViewerComponent: bisagras izquierda + tirador derecha + cup_vintage clamped
      const viewerFixture = TestBed.createComponent(Furniture3dViewerComponent);
      const standaloneViewer = viewerFixture.componentInstance;
      const viewerInternals = standaloneViewer as unknown as ViewerSceneInternals;
      viewerInternals.scene = new THREE.Scene();
      viewerInternals.scene.add(viewerInternals.furnitureGroup);
      viewerInternals.scene.add(viewerInternals.zoneHighlightGroup);

      viewerFixture.componentRef.setInput('parts', [doorLeft]);
      viewerFixture.componentRef.setInput('materials', HITO1_TEST_MATERIALS);
      viewerFixture.detectChanges();
      viewerInternals.buildFurnitureScene(
        [doorLeft],
        [doorLeft.id],
        HITO1_TEST_MATERIALS,
        false,
        false
      );

      const leftPieceData = viewerInternals.pieceObjectMap.get(doorLeft.id)!;
      expect(leftPieceData).toBeDefined();
      expect(leftPieceData.isDoor).toBe(true);
      expect(leftPieceData.hingeSide).toBe('left');
      expect(leftPieceData.hingeGroup).toBeDefined();
      expect(leftPieceData.handleGroup).toBeDefined();

      const leftHinges = leftPieceData.hingeGroup!.children.filter(
        c => c.name === 'internal_cup_hinge_35'
      );
      expect(leftHinges.length).toBeGreaterThanOrEqual(2);
      for (const h of leftHinges) {
        expect(h.position.x).toBeLessThan(0);
      }
      expect(leftPieceData.handleGroup!.position.x).toBeGreaterThan(0);

      const leftDims = partGeometry.getLocalDimensions(doorLeft);
      const leftHingeBox = computeLocalBoxInParentMesh(
        leftPieceData.mesh,
        leftPieceData.hingeGroup!
      );
      expect(leftHingeBox.max.z).toBeLessThanOrEqual(-leftDims.sz / 2 + 2.5);

      const leftHandleBox = computeLocalBoxInParentMesh(
        leftPieceData.mesh,
        leftPieceData.handleGroup!
      );
      expect(leftHandleBox.min.x).toBeGreaterThanOrEqual(-leftDims.sx / 2 - 0.1);
      expect(leftHandleBox.max.x).toBeLessThanOrEqual(leftDims.sx / 2 + 0.1);
      expect(leftHandleBox.min.y).toBeGreaterThanOrEqual(-leftDims.sy / 2 - 0.1);
      expect(leftHandleBox.max.y).toBeLessThanOrEqual(leftDims.sy / 2 + 0.1);

      // Cambio door-left -> door-right reposiciona bisagras al lado derecho y tirador a la izquierda
      designer.setSelectedPartRoleOrDoor('door-right');
      fixture.detectChanges();

      const doorRight = projectService.partsList().find(p => p.id === tiltedSeed.id)!;
      expect(doorRight.hardwareConfig?.openingDirection).toBe('right');

      viewerFixture.componentRef.setInput('parts', [doorRight]);
      viewerFixture.detectChanges();
      viewerInternals.buildFurnitureScene(
        [doorRight],
        [doorRight.id],
        HITO1_TEST_MATERIALS,
        false,
        false
      );

      const rightPieceData = viewerInternals.pieceObjectMap.get(doorRight.id)!;
      expect(rightPieceData.hingeSide).toBe('right');
      const rightHinges = rightPieceData.hingeGroup!.children.filter(
        c => c.name === 'internal_cup_hinge_35'
      );
      expect(rightHinges.length).toBeGreaterThanOrEqual(2);
      for (const h of rightHinges) {
        expect(h.position.x).toBeGreaterThan(0);
      }
      expect(rightPieceData.handleGroup!.position.x).toBeLessThan(0);

      // Estrés de tirador cup_vintage en puerta compacta: sin flotar (+sz/2) y clamped dentro del tablero
      const compactCupDoor: Part = {
        ...doorRight,
        id: 'compact_cup_door',
        length: 110,
        width: 90,
        thickness: 15,
        posY: 45,
        hardwareConfig: {
          ...doorRight.hardwareConfig!,
          handleType: 'cup_vintage',
          handlePosition: 'top',
          openingDirection: 'left'
        }
      };
      viewerFixture.componentRef.setInput('parts', [compactCupDoor]);
      viewerFixture.detectChanges();
      viewerInternals.buildFurnitureScene(
        [compactCupDoor],
        [],
        HITO1_TEST_MATERIALS,
        false,
        false
      );

      const compactData = viewerInternals.pieceObjectMap.get(compactCupDoor.id)!;
      const compactDims = partGeometry.getLocalDimensions(compactCupDoor);
      const compactHandleBox = computeLocalBoxInParentMesh(
        compactData.mesh,
        compactData.handleGroup!
      );
      expect(compactHandleBox.min.z).toBeGreaterThanOrEqual(compactDims.sz / 2 - 0.1);
      expect(compactHandleBox.min.z).toBeLessThanOrEqual(compactDims.sz / 2 + 0.5);
      expect(compactHandleBox.max.z).toBeGreaterThan(compactDims.sz / 2 + 1);
      expect(compactHandleBox.min.x).toBeGreaterThanOrEqual(-compactDims.sx / 2 - 0.1);
      expect(compactHandleBox.max.x).toBeLessThanOrEqual(compactDims.sx / 2 + 0.1);
      expect(compactHandleBox.min.y).toBeGreaterThanOrEqual(-compactDims.sy / 2 - 0.1);
      expect(compactHandleBox.max.y).toBeLessThanOrEqual(compactDims.sy / 2 + 0.1);

      // Reversión a Tablero Estructural ('free'): elimina hardwareConfig, sin herrajes 3D ni en lista de compra
      designer.setSelectedPartRoleOrDoor('free');
      fixture.detectChanges();

      const revertedPart = projectService.partsList().find(p => p.id === tiltedSeed.id)!;
      expect(revertedPart.componentRole).toBe('free');
      expect(revertedPart.hardwareConfig).toBeUndefined();
      expect('hardwareConfig' in revertedPart).toBe(false);
      expect(designer.isPartDoor(revertedPart)).toBe(false);
      expect(hardwareCatalog.computeRequiredHardwareList([revertedPart])).toEqual([]);

      // Incluso si el nombre conserva "PUERTA...", componentRole === 'free' impide herrajes 3D y de compra
      const freeWithDoorName: Part = {
        ...revertedPart,
        name: 'PUERTA DE PRUEBA REVERTIDA',
        componentRole: 'free'
      };
      projectService.updatePart(freeWithDoorName);
      fixture.detectChanges();

      const persistedDoorNameFree = projectService.partsList().find(p => p.id === tiltedSeed.id)!;
      expect(persistedDoorNameFree.componentRole).toBe('free');
      expect(persistedDoorNameFree.hardwareConfig).toBeUndefined();
      expect(designer.isPartDoor(persistedDoorNameFree)).toBe(false);
      expect(hardwareCatalog.computeRequiredHardwareList([persistedDoorNameFree])).toEqual([]);

      viewerFixture.componentRef.setInput('parts', [persistedDoorNameFree]);
      viewerFixture.detectChanges();
      viewerInternals.buildFurnitureScene(
        [persistedDoorNameFree],
        [],
        HITO1_TEST_MATERIALS,
        false,
        false
      );

      const freePieceData = viewerInternals.pieceObjectMap.get(persistedDoorNameFree.id)!;
      expect(freePieceData.isDoor).toBe(false);
      expect(freePieceData.hingeGroup).toBeUndefined();
      expect(freePieceData.handleGroup).toBeUndefined();

      viewerFixture.destroy();
    });
  });

  describe('TAREA 4: Veta 90° en 3D (UVs + Texturas) y bloqueo en materiales lisos', () => {
    it('alinea UVs en [0..1] con eje largo (U) y ancho (V) para buildAlignedBoxGeometry y buildExtrudedBoardGeometry en horizontal, vertical_xy y vertical_yz', () => {
      const orientations: {
        label: string;
        overrides: Partial<Part>;
      }[] = [
        {
          label: 'horizontal',
          overrides: { orientation: 'horizontal', componentRole: 'free', length: 800, width: 420 }
        },
        {
          label: 'vertical_xy',
          overrides: { orientation: 'vertical_xy', componentRole: 'door', length: 450, width: 720 }
        },
        {
          label: 'vertical_yz_lateral',
          overrides: {
            orientation: 'vertical_yz',
            componentRole: 'side_left',
            name: 'LATERAL IZQUIERDO',
            length: 850,
            width: 560
          }
        },
        {
          label: 'vertical_yz_plinth',
          overrides: {
            orientation: 'vertical_yz',
            componentRole: 'plinth',
            name: 'ZÓCALO LATERAL',
            length: 520,
            width: 90
          }
        }
      ];

      for (const scenario of orientations) {
        const basePart: Part = {
          id: `uv_${scenario.label}`,
          name: `Pieza ${scenario.label}`,
          length: 800,
          width: 400,
          thickness: 18,
          quantity: 1,
          materialId: MAT_WOOD_ROBLE.id,
          materialName: MAT_WOOD_ROBLE.name,
          grain: 'length',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          ...scenario.overrides
        };

        const localDims = partGeometry.getLocalDimensions(basePart);
        const boxGeom = partGeometry.buildAlignedBoxGeometry(basePart);
        assertBroadFaceUVsAligned(boxGeom, localDims);
        boxGeom.dispose();

        const extrudedPart: Part = {
          ...basePart,
          cornerCutConfig: {
            type: 'chamfer_corner',
            corner: 'front_right',
            cutX: 60,
            cutY: 60
          }
        };
        const extrudedGeom = partGeometry.buildExtrudedBoardGeometry(extrudedPart);
        assertBroadFaceUVsAligned(extrudedGeom, localDims);
        extrudedGeom.dispose();
      }
    });

    it('genera CanvasTexture válida en ProceduralTextureFactory.getBoardTexture para length, width y none en madera y materiales lisos (Cuero Visón / Blanco)', () => {
      const grains: ('length' | 'width' | 'none')[] = ['length', 'width', 'none'];
      const woodTextures: THREE.CanvasTexture[] = [];

      for (const grain of grains) {
        const woodTex = ProceduralTextureFactory.getBoardTexture(
          MAT_WOOD_ROBLE.colorHex,
          MAT_WOOD_ROBLE.textureType || 'wood',
          grain,
          false
        );
        const cueroTex = ProceduralTextureFactory.getBoardTexture(
          MAT_SMOOTH_CUERO_VISON.colorHex,
          MAT_SMOOTH_CUERO_VISON.textureType || 'linen',
          grain,
          false
        );
        const whiteTex = ProceduralTextureFactory.getBoardTexture(
          MAT_SMOOTH_BLANCO.colorHex,
          MAT_SMOOTH_BLANCO.textureType || 'solid',
          grain,
          false
        );

        expect(woodTex).toBeInstanceOf(THREE.CanvasTexture);
        expect(cueroTex).toBeInstanceOf(THREE.CanvasTexture);
        expect(whiteTex).toBeInstanceOf(THREE.CanvasTexture);
        woodTextures.push(woodTex);
      }

      expect(woodTextures[0]).not.toBe(woodTextures[1]);
      expect(woodTextures[1]).not.toBe(woodTextures[2]);
      expect(woodTextures[0]).not.toBe(woodTextures[2]);
    });

    it('bloquea veta en materiales lisos (!hasGrain: Cuero Visón y Blanco) en ModuleDesigner, ProjectStorageService, PartsList y Furniture3dViewer', () => {
      // 1. ModuleDesignerComponent: pieza en madera con veta 'length' -> cambiar a Cuero Visón y Blanco
      designer.addFreeBoard();
      fixture.detectChanges();
      const board = designer.selectedPart()!;
      expect(board.materialId).toBe(MAT_WOOD_ROBLE.id);
      expect(board.grain).toBe('length');
      expect(designer.selectedPartHasGrain()).toBe(true);

      designer.onMaterialChange(MAT_SMOOTH_CUERO_VISON.id);
      fixture.detectChanges();

      let updated = designer.selectedPart()!;
      expect(updated.materialId).toBe(MAT_SMOOTH_CUERO_VISON.id);
      expect(updated.grain).toBe('none');
      expect(designer.selectedPartHasGrain()).toBe(false);

      // Intentar cambiar veta programáticamente en material liso debe mantener 'none'
      designer.setSelectedPartGrain('length');
      designer.setSelectedPartGrain('width');
      fixture.detectChanges();
      expect(designer.selectedPart()!.grain).toBe('none');

      // Verificar UI/DOM de Dirección de la Veta bloqueada en material liso
      const longButtons = findInspectorButtons('A lo Largo');
      const widthButtons = findInspectorButtons('A lo Ancho');
      expect(longButtons.length).toBeGreaterThan(0);
      expect(widthButtons.length).toBeGreaterThan(0);
      expect(longButtons[0].disabled).toBe(true);
      expect(widthButtons[0].disabled).toBe(true);

      const inspectorText = getInspectorText();
      expect(inspectorText).toContain(
        'Define el sentido de las líneas de madera en 3D y si el Optimizador 2D puede rotar la pieza.'
      );
      expect(inspectorText).toContain(
        'Material liso: sin veta direccional (el optimizador rota la pieza para ahorrar tablero).'
      );

      // Volver a madera reactiva veta y botones; luego probar Blanco Frost
      designer.onMaterialChange(MAT_WOOD_ROBLE.id);
      fixture.detectChanges();
      expect(designer.selectedPartHasGrain()).toBe(true);
      expect(designer.selectedPart()!.grain).toBe('length');
      expect(findInspectorButtons('A lo Largo')[0].disabled).toBe(false);

      designer.onMaterialChange(MAT_SMOOTH_BLANCO.id);
      fixture.detectChanges();
      updated = designer.selectedPart()!;
      expect(updated.grain).toBe('none');
      expect(findInspectorButtons('A lo Largo')[0].disabled).toBe(true);
      expect(findInspectorButtons('A lo Ancho')[0].disabled).toBe(true);

      // 2. ProjectStorageService.updatePart: cambiar a material liso fuerza grain: 'none'
      projectService.updatePart({
        ...updated,
        materialId: MAT_WOOD_ROBLE.id,
        materialName: MAT_WOOD_ROBLE.name,
        grain: 'width'
      });
      const woodPersisted = projectService.partsList().find(p => p.id === board.id)!;
      expect(woodPersisted.grain).toBe('width');

      projectService.updatePart({
        ...woodPersisted,
        materialId: MAT_SMOOTH_CUERO_VISON.id,
        materialName: MAT_SMOOTH_CUERO_VISON.name
      });
      const smoothPersisted = projectService.partsList().find(p => p.id === board.id)!;
      expect(smoothPersisted.grain).toBe('none');

      // 3. PartsListComponent.toggleGrain: bloqueado en liso con toast, libre en madera
      const partsListFixture = TestBed.createComponent(PartsListComponent);
      const partsList = partsListFixture.componentInstance;
      partsListFixture.detectChanges();

      const partsListEl = partsListFixture.nativeElement as HTMLElement;
      const lockedBtn = partsListEl.querySelector(
        'button[data-grain-locked="true"]'
      ) as HTMLButtonElement | null;
      expect(lockedBtn).not.toBeNull();
      expect(lockedBtn?.getAttribute('aria-disabled')).toBe('true');

      partsList.toggleGrain({ ...smoothPersisted, grain: 'length' });
      partsListFixture.detectChanges();

      expect(projectService.partsList().find(p => p.id === board.id)?.grain).toBe('none');
      const toastEl = partsListEl.querySelector('[data-testid="parts-list-grain-toast"]');
      expect(toastEl?.textContent).toContain('Material liso sin veta direccional');

      // Verificar ciclo de veta en madera desde PartsListComponent
      projectService.updatePart({
        ...smoothPersisted,
        materialId: MAT_WOOD_ROBLE.id,
        materialName: MAT_WOOD_ROBLE.name,
        grain: 'length'
      });
      partsListFixture.detectChanges();
      partsList.toggleGrain(projectService.partsList().find(p => p.id === board.id)!);
      expect(projectService.partsList().find(p => p.id === board.id)?.grain).toBe('width');
      partsListFixture.destroy();

      // 4. Furniture3dViewerComponent.assignQuickMaterial: fuerza grain: 'none' al aplicar material liso
      const viewerFixture = TestBed.createComponent(Furniture3dViewerComponent);
      const viewer = viewerFixture.componentInstance;
      const woodPartForViewer: Part = {
        ...projectService.partsList().find(p => p.id === board.id)!,
        materialId: MAT_WOOD_ROBLE.id,
        materialName: MAT_WOOD_ROBLE.name,
        grain: 'length'
      };
      viewerFixture.componentRef.setInput('parts', [woodPartForViewer]);
      viewerFixture.componentRef.setInput('materials', HITO1_TEST_MATERIALS);
      viewerFixture.detectChanges();

      const emittedUpdates: Partial<Part>[] = [];
      const sub = viewer.partModified.subscribe(evt => emittedUpdates.push(evt.updates));

      viewer.contextMenuPart.set(woodPartForViewer);
      viewer.assignQuickMaterial(MAT_SMOOTH_CUERO_VISON.id, false);
      viewer.contextMenuPart.set(woodPartForViewer);
      viewer.assignQuickMaterial(MAT_SMOOTH_BLANCO.id, false);

      expect(emittedUpdates.length).toBe(2);
      expect(emittedUpdates[0].materialId).toBe(MAT_SMOOTH_CUERO_VISON.id);
      expect(emittedUpdates[0].grain).toBe('none');
      expect(emittedUpdates[1].materialId).toBe(MAT_SMOOTH_BLANCO.id);
      expect(emittedUpdates[1].grain).toBe('none');

      sub.unsubscribe();
      viewerFixture.destroy();
    });

    it('CutOptimizerService permite rotación libre con grain "none" o material liso, y bloquea rotación con "length"/"width" en material con veta', () => {
      const optimizer = TestBed.inject(CutOptimizerService);
      const anchorBoard: Part = {
        id: 'opt_anchor',
        name: 'Tablero Ancla',
        length: 1300,
        width: 1300,
        thickness: 18,
        quantity: 1,
        materialId: MAT_WOOD_ROBLE.id,
        materialName: MAT_WOOD_ROBLE.name,
        grain: 'length',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' }
      };
      // Esta segunda pieza (1200x700) solo cabe en el tablero #1 si rota 90° (700x1200 en el remanente derecho 1116x1300)
      const testPiece: Part = {
        id: 'opt_target',
        name: 'Pieza Prueba Rotación',
        length: 1200,
        width: 700,
        thickness: 18,
        quantity: 1,
        materialId: MAT_WOOD_ROBLE.id,
        materialName: MAT_WOOD_ROBLE.name,
        grain: 'length',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' }
      };

      // Caso A: Madera con veta 'length' -> rotación prohibida, requiere 2 tableros y rotated === false
      const resWoodLength = optimizer.optimizeProject(
        [anchorBoard, { ...testPiece, grain: 'length' }],
        HITO1_TEST_MATERIALS,
        HITO1_TEST_SETTINGS
      );
      expect(resWoodLength.totalSheetsUsed).toBe(2);
      const placedTargetLen = resWoodLength.sheets
        .flatMap(s => s.placedParts)
        .find(p => p.part.id === 'opt_target')!;
      expect(placedTargetLen.rotated).toBe(false);

      // Caso B: Madera con veta 'width' -> forzada a 90° (rotated === true), cabe en 1 tablero
      const resWoodWidth = optimizer.optimizeProject(
        [anchorBoard, { ...testPiece, grain: 'width' }],
        HITO1_TEST_MATERIALS,
        HITO1_TEST_SETTINGS
      );
      expect(resWoodWidth.totalSheetsUsed).toBe(1);
      const placedTargetWid = resWoodWidth.sheets[0].placedParts.find(
        p => p.part.id === 'opt_target'
      )!;
      expect(placedTargetWid.rotated).toBe(true);

      // Caso C: Madera con 'none' -> rotación libre 90°, cabe en 1 tablero
      const resWoodNone = optimizer.optimizeProject(
        [anchorBoard, { ...testPiece, grain: 'none' }],
        HITO1_TEST_MATERIALS,
        HITO1_TEST_SETTINGS
      );
      expect(resWoodNone.totalSheetsUsed).toBe(1);
      const placedTargetNone = resWoodNone.sheets[0].placedParts.find(
        p => p.part.id === 'opt_target'
      )!;
      expect(placedTargetNone.rotated).toBe(true);

      // Caso D: Material liso (!hasGrain: Cuero Visón) -> rotación libre siempre incluso con grain legado
      const resSmooth = optimizer.optimizeProject(
        [
          {
            ...anchorBoard,
            materialId: MAT_SMOOTH_CUERO_VISON.id,
            materialName: MAT_SMOOTH_CUERO_VISON.name
          },
          {
            ...testPiece,
            materialId: MAT_SMOOTH_CUERO_VISON.id,
            materialName: MAT_SMOOTH_CUERO_VISON.name,
            grain: 'length'
          }
        ],
        HITO1_TEST_MATERIALS,
        HITO1_TEST_SETTINGS
      );
      expect(resSmooth.totalSheetsUsed).toBe(1);
      const placedSmoothTarget = resSmooth.sheets[0].placedParts.find(
        p => p.part.id === 'opt_target'
      )!;
      expect(placedSmoothTarget.rotated).toBe(true);
    });
  });
});
