import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ElementRef } from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Furniture3dViewerComponent } from './furniture-3d-viewer';
import { ModuleDesignerComponent } from '../module-designer/module-designer';
import { PartsListComponent } from '../parts-list/parts-list';
import { CutOptimizerViewComponent } from '../cut-optimizer-view/cut-optimizer-view';
import { BudgetViewComponent } from '../budget-view/budget-view';
import { LabelsViewComponent } from '../labels-view/labels-view';
import { ProjectStorageService } from '../../services/project-storage.service';
import { PartGeometryService } from '../../services/part-geometry.service';
import { CutOptimizerService } from '../../services/cut-optimizer.service';
import { CurrencyExchangeService } from '../../services/currency-exchange.service';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ThemeService } from '../../services/theme.service';
import { PaymentService } from '../../services/payment.service';
import { AssemblyGuideService } from '../../services/assembly-guide.service';
import {
  DEFAULT_ROOM_CONFIG,
  Material,
  Part,
  RoomConfiguration,
  RoomWallInstance,
  WorkspaceMode,
  getMaxWallLengthForAngle,
  getResolvedRoomWalls,
  getWallHalfSpans,
  rescaleWallsToFloor
} from '../../models/melamine.models';

interface ViewerInternals {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  canvasRef: () => ElementRef<HTMLCanvasElement> | undefined;
  containerRef: () => ElementRef<HTMLDivElement> | undefined;
  furnitureGroup: THREE.Group;
  dimensionGroup: THREE.Group;
  internalClearanceGroup: THREE.Group;
  gizmoGroup: THREE.Group;
  measureGroup: THREE.Group;
  magneticSnapGroup: THREE.Group;
  drillGroup: THREE.Group;
  pushPullHighlightGroup: THREE.Group;
  rectPreviewGroup: THREE.Group;
  circlePreviewGroup: THREE.Group;
  freehandPreviewGroup: THREE.Group;
  roomGroup: THREE.Group;
  wallSnapGuideGroup: THREE.Group;
  legSnapGuideGroup: THREE.Group;
  wallGizmoGroup: THREE.Group;
  appliancesGroup: THREE.Group;
  applianceGizmoGroup: THREE.Group;
  referenceGuideGroup: THREE.Group;
  wallGizmoHitMeshes: THREE.Mesh[];
  isWallDragging: boolean;
  isWallGizmoDragging: boolean;
  activeWallStretchEndSign: 1 | -1;
  activeSelectedIds: () => string[];
  boundPointerDown: (e: PointerEvent) => void;
  boundPointerMove: (e: PointerEvent) => void;
  boundPointerUp: (e: PointerEvent) => void;
  initThree: () => void;
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e?: PointerEvent) => void;
  updateRoomScene: (mode: WorkspaceMode, config: RoomConfiguration) => void;
  updateWallGizmo: (
    wallType: string | null,
    config: RoomConfiguration,
    mode: WorkspaceMode,
    liveOverride?: Partial<RoomWallInstance>
  ) => void;
  buildFurnitureScene: (
    parts: Part[],
    selectedIds: string[],
    mats: Material[],
    isXRay: boolean,
    showDims: boolean
  ) => void;
}

const VIEWPORT_RECT: DOMRect = {
  left: 0,
  top: 0,
  width: 1000,
  height: 800,
  right: 1000,
  bottom: 800,
  x: 0,
  y: 0,
  toJSON: () => ({})
};

function initHeadlessViewerThree(viewer: Furniture3dViewerComponent): void {
  const internals = viewer as unknown as ViewerInternals;
  const canvas = internals.canvasRef()?.nativeElement;
  const container = internals.containerRef()?.nativeElement;
  if (!canvas || !container) return;

  Object.defineProperty(container, 'clientWidth', { value: VIEWPORT_RECT.width, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: VIEWPORT_RECT.height, configurable: true });
  canvas.getBoundingClientRect = () => VIEWPORT_RECT;
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();

  internals.scene = new THREE.Scene();
  internals.camera = new THREE.PerspectiveCamera(45, VIEWPORT_RECT.width / VIEWPORT_RECT.height, 1.5, 80000);
  internals.camera.position.set(1600, 2600, 3600);
  internals.renderer = {
    domElement: canvas,
    shadowMap: { enabled: false, type: THREE.PCFSoftShadowMap, needsUpdate: false },
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    render: vi.fn((sceneObj: THREE.Object3D) => {
      sceneObj?.updateMatrixWorld(true);
    }),
    dispose: vi.fn()
  } as unknown as THREE.WebGLRenderer;

  internals.controls = new OrbitControls(internals.camera, canvas);
  internals.controls.target.set(0, 1000, 0);
  internals.controls.update();

  internals.scene.add(
    internals.furnitureGroup,
    internals.dimensionGroup,
    internals.internalClearanceGroup,
    internals.gizmoGroup,
    internals.measureGroup,
    internals.magneticSnapGroup,
    internals.drillGroup,
    internals.pushPullHighlightGroup,
    internals.rectPreviewGroup,
    internals.circlePreviewGroup,
    internals.freehandPreviewGroup,
    internals.roomGroup,
    internals.wallSnapGuideGroup,
    internals.legSnapGuideGroup,
    internals.wallGizmoGroup,
    internals.appliancesGroup,
    internals.applianceGizmoGroup,
    internals.referenceGuideGroup
  );

  const initialMode = viewer.workspaceMode();
  const initialRoomCfg = viewer.roomConfig();
  viewer.selectedWallType.set(viewer.selectedWallId());
  internals.updateRoomScene(initialMode, initialRoomCfg);
  internals.updateWallGizmo(viewer.selectedWallType(), initialRoomCfg, initialMode);
  internals.buildFurnitureScene(
    viewer.parts(),
    internals.activeSelectedIds(),
    viewer.materials(),
    viewer.isXRay(),
    viewer.show3dDimensions()
  );
  internals.scene.updateMatrixWorld(true);

  canvas.addEventListener('pointerdown', internals.boundPointerDown);
  window.addEventListener('pointermove', internals.boundPointerMove);
  window.addEventListener('pointerup', internals.boundPointerUp);
  window.addEventListener('pointercancel', internals.boundPointerUp);
}

function spyHeadlessInitThree(): void {
  vi.spyOn(
    Furniture3dViewerComponent.prototype as unknown as ViewerInternals,
    'initThree'
  ).mockImplementation(function (this: Furniture3dViewerComponent) {
    initHeadlessViewerThree(this);
  });
}

function createPointerEvent(type: string, clientX: number, clientY: number, button = 0): PointerEvent {
  if (typeof PointerEvent !== 'undefined') {
    return new PointerEvent(type, {
      clientX,
      clientY,
      button,
      buttons: type === 'pointerup' ? 0 : 1,
      pointerId: 1,
      bubbles: true,
      cancelable: true
    });
  }
  return new MouseEvent(type, {
    clientX,
    clientY,
    button,
    buttons: type === 'pointerup' ? 0 : 1,
    bubbles: true,
    cancelable: true
  }) as unknown as PointerEvent;
}

function projectToScreen(
  worldPos: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  rect: DOMRect = VIEWPORT_RECT
): { clientX: number; clientY: number } {
  camera.updateMatrixWorld(true);
  const projected = worldPos.clone().project(camera);
  return {
    clientX: rect.left + ((projected.x + 1) / 2) * rect.width,
    clientY: rect.top + ((-projected.y + 1) / 2) * rect.height
  };
}

function getWallWorldEndpoints(wall: Pick<RoomWallInstance, 'posX' | 'posZ' | 'length' | 'rotationY'>): {
  left: { x: number; z: number };
  right: { x: number; z: number };
  dir: { x: number; z: number };
} {
  const rotRad = -((wall.rotationY || 0) * Math.PI) / 180;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);
  const halfL = wall.length / 2;
  return {
    left: {
      x: wall.posX - halfL * cosR,
      z: wall.posZ + halfL * sinR
    },
    right: {
      x: wall.posX + halfL * cosR,
      z: wall.posZ - halfL * sinR
    },
    dir: {
      x: cosR,
      z: -sinR
    }
  };
}

function makeWall(overrides: Partial<RoomWallInstance> & { id: string }): RoomWallInstance {
  return {
    name: `Muro ${overrides.id}`,
    length: 1500,
    height: 2600,
    thickness: 150,
    posX: 0,
    posZ: 0,
    rotationY: 0,
    material: 'paint_warm_white',
    showSkirting: true,
    isLocked: false,
    isHidden: false,
    ...overrides
  };
}

function makeRoomConfig(walls: RoomWallInstance[], overrides?: Partial<RoomConfiguration>): RoomConfiguration {
  return {
    ...DEFAULT_ROOM_CONFIG,
    floorWidth: 5000,
    floorDepth: 5000,
    wallHeight: 2600,
    wallThickness: 150,
    showSkirting: true,
    isWallsLocked: false,
    walls,
    ...overrides
  };
}

describe('Sistema Completo de Muros Libres 3D (Fases 1-5)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // ESCENARIO 1: Creación y Resolución Libre
  // =========================================================================
  describe('1. Creación y Resolución Libre', () => {
    let fixture: ComponentFixture<ModuleDesignerComponent>;
    let component: ModuleDesignerComponent;
    let projectService: ProjectStorageService;

    beforeEach(async () => {
      spyHeadlessInitThree();
      await TestBed.configureTestingModule({
        imports: [ModuleDesignerComponent],
        providers: [ProjectStorageService]
      }).compileComponents();

      projectService = TestBed.inject(ProjectStorageService);
      fixture = TestBed.createComponent(ModuleDesignerComponent);
      component = fixture.componentInstance;
      projectService.setWorkspaceMode('room');
      fixture.detectChanges();
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('debe crear muros independientes desde addRoomWall(), botón inferior "+ Muro" y botón del panel lateral', () => {
      const initialCount = component.resolvedWalls().length;

      component.addRoomWall();
      fixture.detectChanges();
      expect(component.resolvedWalls().length).toBe(initialCount + 1);
      const firstId = component.selectedWall();
      expect(firstId).toMatch(/^wall_\d+$/);
      expect(component.roomDockSubTab()).toBe('wall');

      const host = fixture.nativeElement as HTMLElement;
      const addButtons = Array.from(host.querySelectorAll('button')).filter(btn =>
        btn.textContent?.includes('+ Muro')
      );
      expect(addButtons.length).toBeGreaterThanOrEqual(2);

      const bottomBtn = addButtons.find(btn =>
        btn.getAttribute('title')?.includes('Añadir un nuevo muro independiente')
      );
      expect(bottomBtn).toBeTruthy();
      bottomBtn!.click();
      fixture.detectChanges();

      expect(component.resolvedWalls().length).toBe(initialCount + 2);
      const secondId = component.selectedWall();
      expect(secondId).toMatch(/^wall_\d+$/);
      expect(secondId).not.toBe(firstId);

      const sidePanelBtn = Array.from(host.querySelectorAll('button')).find(
        btn => btn !== bottomBtn && btn.textContent?.includes('+ Muro')
      );
      expect(sidePanelBtn).toBeTruthy();
      sidePanelBtn!.click();
      fixture.detectChanges();

      expect(component.resolvedWalls().length).toBe(initialCount + 3);
    });

    it('getResolvedRoomWalls debe permitir posicionar libremente (posX, posZ) cualquier muro y rotarlo a 45°, 90° y ángulo arbitrario sin bloquearlo al perímetro', () => {
      const customWalls: RoomWallInstance[] = [
        makeWall({ id: 'main', name: 'Muro Principal', length: 2200, posX: 420, posZ: 180, rotationY: 45 }),
        makeWall({ id: 'side', name: 'Muro Lateral Izq', length: 1800, posX: -750, posZ: 310, rotationY: 90 }),
        makeWall({ id: 'right_side', name: 'Muro Lateral Der', length: 1600, posX: 980, posZ: -440, rotationY: 33.5 }),
        makeWall({ id: 'wall_free_1', name: 'Muro Divisorio', length: 1500, posX: -120, posZ: -350, rotationY: 135 })
      ];

      const resolved = getResolvedRoomWalls(makeRoomConfig(customWalls));
      expect(resolved.length).toBe(4);

      expect(resolved[0]).toMatchObject({ id: 'main', posX: 420, posZ: 180, rotationY: 45, length: 2200 });
      expect(resolved[1]).toMatchObject({ id: 'side', posX: -750, posZ: 310, rotationY: 90, length: 1800 });
      expect(resolved[2]).toMatchObject({ id: 'right_side', posX: 980, posZ: -440, rotationY: 33.5, length: 1600 });
      expect(resolved[3]).toMatchObject({ id: 'wall_free_1', posX: -120, posZ: -350, rotationY: 135, length: 1500 });
    });

    it('rescaleWallsToFloor debe escalar proporcionalmente y mantener todos los muros rotados y libres dentro de los límites del nuevo piso', () => {
      const walls: RoomWallInstance[] = [
        makeWall({ id: 'main', length: 5000, posX: 0, posZ: -2425, rotationY: 0 }),
        makeWall({ id: 'wall_diag', length: 2000, posX: 500, posZ: -400, rotationY: 45 }),
        makeWall({ id: 'wall_vert', length: 1800, posX: -1000, posZ: 600, rotationY: 90 }),
        makeWall({ id: 'wall_arb', length: 1600, posX: 1900, posZ: 1500, rotationY: 25 })
      ];

      const rescaled = rescaleWallsToFloor(walls, 5000, 5000, 3500, 3000, 150, 0, 0);
      expect(rescaled.length).toBe(4);

      const resMain = rescaled.find(w => w.id === 'main')!;
      expect(resMain.length).toBe(3500);
      expect(resMain.posZ).toBe(-1425);

      const resDiag = rescaled.find(w => w.id === 'wall_diag')!;
      expect(resDiag.rotationY).toBe(45);
      expect(resDiag.posX).toBeGreaterThan(0);
      expect(resDiag.posZ).toBeLessThan(0);

      for (const w of rescaled) {
        const maxLen = getMaxWallLengthForAngle(3500, 3000, w.thickness, w.rotationY);
        expect(w.length).toBeGreaterThanOrEqual(400);
        expect(w.length).toBeLessThanOrEqual(maxLen);
        const { halfSpanX, halfSpanZ } = getWallHalfSpans(w.length, w.thickness, w.rotationY);
        expect(Math.abs(w.posX) + halfSpanX).toBeLessThanOrEqual(1750 + 0.05);
        expect(Math.abs(w.posZ) + halfSpanZ).toBeLessThanOrEqual(1500 + 0.05);
      }
    });
  });

  // =========================================================================
  // HELPER DE VISOR 3D REAL CON PROYECCIÓN DE CÁMARA Y POINTER EVENTS
  // =========================================================================
  function createMountedViewer(
    walls: RoomWallInstance[],
    options?: {
      selectedWallId?: string | null;
      parts?: Part[];
      cameraPos?: [number, number, number];
      lookAt?: [number, number, number];
      roomOverrides?: Partial<RoomConfiguration>;
    }
  ): {
    fixture: ComponentFixture<Furniture3dViewerComponent>;
    component: Furniture3dViewerComponent;
    internals: ViewerInternals;
    canvas: HTMLCanvasElement;
    updateRoomWalls: (nextWalls: RoomWallInstance[]) => void;
    emittedRoomConfigs: (Partial<RoomConfiguration> & { recordHistory?: boolean })[];
    emittedWallSelections: (string | null)[];
    emittedPartSelections: (Part | null)[];
  } {
    spyHeadlessInitThree();
    TestBed.configureTestingModule({
      imports: [Furniture3dViewerComponent],
      providers: [ProjectStorageService, PartGeometryService]
    });

    const fixture = TestBed.createComponent(Furniture3dViewerComponent);
    const component = fixture.componentInstance;

    const initialConfig = makeRoomConfig(walls, options?.roomOverrides);
    fixture.componentRef.setInput('workspaceMode', 'room');
    fixture.componentRef.setInput('roomConfig', initialConfig);
    fixture.componentRef.setInput('selectedWallId', options?.selectedWallId ?? null);
    fixture.componentRef.setInput('parts', options?.parts ?? []);
    fixture.componentRef.setInput('materials', []);

    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;

    fixture.detectChanges();
    TestBed.flushEffects();

    const internals = component as unknown as ViewerInternals;
    if (options?.cameraPos) {
      internals.camera.position.set(...options.cameraPos);
    } else {
      internals.camera.position.set(1600, 2600, 3600);
    }
    const lookTarget = options?.lookAt ?? [0, 1000, 0];
    internals.controls.target.set(...lookTarget);
    internals.camera.aspect = VIEWPORT_RECT.width / VIEWPORT_RECT.height;
    internals.camera.updateProjectionMatrix();
    internals.camera.lookAt(...lookTarget);
    internals.camera.updateMatrixWorld(true);
    internals.controls.update();
    internals.scene.updateMatrixWorld(true);

    const emittedRoomConfigs: (Partial<RoomConfiguration> & { recordHistory?: boolean })[] = [];
    const emittedWallSelections: (string | null)[] = [];
    const emittedPartSelections: (Part | null)[] = [];

    component.roomConfigModified.subscribe(ev => emittedRoomConfigs.push(ev));
    component.wallSelected.subscribe(ev => emittedWallSelections.push(ev));
    component.partSelected.subscribe(ev => emittedPartSelections.push(ev));

    const updateRoomWalls = (nextWalls: RoomWallInstance[]) => {
      fixture.componentRef.setInput('roomConfig', makeRoomConfig(nextWalls, options?.roomOverrides));
      fixture.detectChanges();
      TestBed.flushEffects();
      internals.scene.updateMatrixWorld(true);
    };

    return {
      fixture,
      component,
      internals,
      canvas,
      updateRoomWalls,
      emittedRoomConfigs,
      emittedWallSelections,
      emittedPartSelections
    };
  }

  function findWallMesh(internals: ViewerInternals, wallId: string): THREE.Mesh {
    const found = internals.roomGroup.children.find(
      c => c.userData?.['isWall'] && (c.userData?.['wallId'] === wallId || c.userData?.['wallType'] === wallId)
    );
    expect(found).toBeDefined();
    return found as THREE.Mesh;
  }

  function findGizmoHandle(
    internals: ViewerInternals,
    predicate: (u: Record<string, unknown>) => boolean
  ): THREE.Mesh {
    const found = internals.wallGizmoHitMeshes.find(m => predicate(m.userData));
    expect(found).toBeDefined();
    return found!;
  }

  function dispatchDragSequence(
    canvas: HTMLCanvasElement,
    camera: THREE.PerspectiveCamera,
    startWorld: THREE.Vector3,
    intermediateWorldPoints: THREE.Vector3[],
    onAfterMove?: (stepIndex: number) => void
  ): void {
    const startScreen = projectToScreen(startWorld, camera);
    canvas.dispatchEvent(createPointerEvent('pointerdown', startScreen.clientX, startScreen.clientY, 0));

    intermediateWorldPoints.forEach((pt, idx) => {
      const moveScreen = projectToScreen(pt, camera);
      window.dispatchEvent(createPointerEvent('pointermove', moveScreen.clientX, moveScreen.clientY, 0));
      onAfterMove?.(idx);
    });

    const lastPt = intermediateWorldPoints[intermediateWorldPoints.length - 1] ?? startWorld;
    const upScreen = projectToScreen(lastPt, camera);
    window.dispatchEvent(createPointerEvent('pointerup', upScreen.clientX, upScreen.clientY, 0));
  }

  // =========================================================================
  // ESCENARIO 2: Selección, Prioridad de Raycast y Traslación Libre 3D
  // =========================================================================
  describe('2. Selección, Prioridad de Raycast y Traslación Libre 3D', () => {
    let viewerFixture: ComponentFixture<Furniture3dViewerComponent> | null = null;

    afterEach(() => {
      viewerFixture?.destroy();
      viewerFixture = null;
    });

    it('debe priorizar el muro más cercano cuando hay un mueble detrás en la línea de raycast', () => {
      const frontWall = makeWall({
        id: 'wall_front',
        name: 'Muro Frontal',
        length: 1600,
        height: 2400,
        thickness: 150,
        posX: 0,
        posZ: 400,
        rotationY: 0
      });
      const backCabinetPart: Part = {
        id: 'cab_behind_1',
        name: 'Módulo Trasero',
        length: 800,
        width: 500,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white',
        materialName: 'Blanco 18mm',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 1200,
        posZ: -500,
        orientation: 'vertical_xy'
      };

      const ctx = createMountedViewer([frontWall], {
        parts: [backCabinetPart],
        cameraPos: [0, 1200, 3200],
        lookAt: [0, 1200, 0]
      });
      viewerFixture = ctx.fixture;

      const wallClickWorld = new THREE.Vector3(0, 1200, 475);
      const screen = projectToScreen(wallClickWorld, ctx.internals.camera);
      ctx.canvas.dispatchEvent(createPointerEvent('pointerdown', screen.clientX, screen.clientY, 0));

      expect(ctx.emittedWallSelections).toContain('wall_front');
      expect(ctx.component.selectedWallType()).toBe('wall_front');
      expect(ctx.emittedPartSelections.length).toBe(0);
      expect(ctx.internals.isWallDragging).toBe(true);

      window.dispatchEvent(createPointerEvent('pointerup', screen.clientX, screen.clientY, 0));
      expect(ctx.internals.isWallDragging).toBe(false);
    });

    it('debe trasladar (posX, posZ) arrastrando el cuerpo del muro (isWallDragging) manteniendo base en Y=0 y emitiendo roomConfigModified', () => {
      const wall = makeWall({
        id: 'wall_drag_1',
        length: 1500,
        height: 2600,
        thickness: 150,
        posX: 0,
        posZ: 0,
        rotationY: 0
      });

      const ctx = createMountedViewer([wall], {
        cameraPos: [0, 3200, 3400],
        lookAt: [0, 1200, 0]
      });
      viewerFixture = ctx.fixture;

      const clickWorld = new THREE.Vector3(0, 1300, 75);
      const step1World = new THREE.Vector3(240, 1300, -105);
      const step2World = new THREE.Vector3(450, 1300, -245);

      const moveSnapshots: { x: number; y: number; z: number }[] = [];
      dispatchDragSequence(ctx.canvas, ctx.internals.camera, clickWorld, [step1World, step2World], () => {
        const mesh = findWallMesh(ctx.internals, 'wall_drag_1');
        moveSnapshots.push({ x: mesh.position.x, y: mesh.position.y, z: mesh.position.z });
      });

      expect(moveSnapshots.length).toBe(2);
      expect(moveSnapshots[0].x).toBeGreaterThan(200);
      expect(moveSnapshots[0].y).toBe(wall.height / 2);
      expect(moveSnapshots[1].x).toBe(450);
      expect(moveSnapshots[1].z).toBe(-320);
      expect(moveSnapshots[1].y).toBe(wall.height / 2);

      const mesh = findWallMesh(ctx.internals, 'wall_drag_1');
      mesh.updateMatrixWorld(true);
      const worldBox = new THREE.Box3().setFromObject(mesh);
      expect(Math.abs(worldBox.min.y)).toBeLessThan(0.05);

      expect(ctx.emittedRoomConfigs.length).toBe(1);
      const emitted = ctx.emittedRoomConfigs[0];
      expect(emitted.recordHistory).toBe(true);
      const updated = emitted.walls!.find(w => w.id === 'wall_drag_1')!;
      expect(updated.posX).toBe(450);
      expect(updated.posZ).toBe(-320);
    });

    it('debe trasladar solo el eje correspondiente al arrastrar las flechas X y Z del gizmo (wall_move) y emitir roomConfigModified', () => {
      const wall = makeWall({
        id: 'wall_gizmo_move',
        length: 1500,
        height: 2600,
        thickness: 150,
        posX: 100,
        posZ: -100,
        rotationY: 25
      });

      const ctx = createMountedViewer([wall], {
        selectedWallId: 'wall_gizmo_move',
        cameraPos: [1600, 3800, 3200],
        lookAt: [100, 1600, -100]
      });
      viewerFixture = ctx.fixture;

      // Arrastrar flecha X (wall_move axis='x')
      const arrowX = findGizmoHandle(
        ctx.internals,
        u => u['type'] === 'wall_move' && u['axis'] === 'x' && u['wallId'] === 'wall_gizmo_move'
      );
      const startXWorld = new THREE.Vector3();
      arrowX.getWorldPosition(startXWorld);
      const moveXWorld1 = startXWorld.clone().add(new THREE.Vector3(180, 0, 150));
      const moveXWorld2 = startXWorld.clone().add(new THREE.Vector3(360, 0, 290));

      dispatchDragSequence(ctx.canvas, ctx.internals.camera, startXWorld, [moveXWorld1, moveXWorld2], () => {
        const mesh = findWallMesh(ctx.internals, 'wall_gizmo_move');
        expect(mesh.position.y).toBe(wall.height / 2);
        expect(mesh.position.z).toBe(-100);
      });

      expect(ctx.emittedRoomConfigs.length).toBe(1);
      const afterXWalls = ctx.emittedRoomConfigs[0].walls!;
      const movedXWall = afterXWalls.find(w => w.id === 'wall_gizmo_move')!;
      expect(movedXWall.posX).toBe(460);
      expect(movedXWall.posZ).toBe(-100);
      expect(ctx.emittedRoomConfigs[0].recordHistory).toBe(true);

      // Sincronizar config y arrastrar flecha Z (wall_move axis='z')
      ctx.updateRoomWalls(afterXWalls);
      const arrowZ = findGizmoHandle(
        ctx.internals,
        u => u['type'] === 'wall_move' && u['axis'] === 'z' && u['wallId'] === 'wall_gizmo_move'
      );
      const startZWorld = new THREE.Vector3();
      arrowZ.getWorldPosition(startZWorld);
      const moveZWorld = startZWorld.clone().add(new THREE.Vector3(140, 0, 280));

      dispatchDragSequence(ctx.canvas, ctx.internals.camera, startZWorld, [moveZWorld], () => {
        const mesh = findWallMesh(ctx.internals, 'wall_gizmo_move');
        expect(mesh.position.x).toBe(460);
        expect(mesh.position.y).toBe(wall.height / 2);
      });

      expect(ctx.emittedRoomConfigs.length).toBe(2);
      const movedZWall = ctx.emittedRoomConfigs[1].walls!.find(w => w.id === 'wall_gizmo_move')!;
      expect(movedZWall.posX).toBe(460);
      expect(movedZWall.posZ).toBe(180);
      expect(ctx.emittedRoomConfigs[1].recordHistory).toBe(true);
    });
  });

  // =========================================================================
  // ESCENARIOS 3 & 4: Estiramiento Unilateral Derecho (endSign=1) e Izquierdo (endSign=-1)
  // =========================================================================
  describe('3 y 4. Estiramiento Unilateral (endSign = 1 y endSign = -1) a 0°, 45° y 90°', () => {
    let viewerFixture: ComponentFixture<Furniture3dViewerComponent> | null = null;

    afterEach(() => {
      viewerFixture?.destroy();
      viewerFixture = null;
    });

    for (const angle of [0, 45, 90]) {
      it(`endSign = 1 (tirador derecho) a ${angle}° debe extender 1500 -> 2100 dejando el extremo izquierdo 100% fijo (< 0.05 mm)`, () => {
        const initialWall = makeWall({
          id: `wall_stretch_r_${angle}`,
          length: 1500,
          height: 2600,
          thickness: 150,
          posX: 0,
          posZ: 0,
          rotationY: angle
        });

        const ctx = createMountedViewer([initialWall], {
          selectedWallId: initialWall.id,
          cameraPos: [2100, 3200, 3100],
          lookAt: [0, 1200, 0]
        });
        viewerFixture = ctx.fixture;

        const beforeEndpoints = getWallWorldEndpoints(initialWall);
        const rightHandle = findGizmoHandle(
          ctx.internals,
          u => u['type'] === 'wall_stretch' && u['endSign'] === 1 && u['wallId'] === initialWall.id
        );
        const handleStart = new THREE.Vector3();
        rightHandle.getWorldPosition(handleStart);

        const step1 = handleStart.clone().add(
          new THREE.Vector3(beforeEndpoints.dir.x * 250, 0, beforeEndpoints.dir.z * 250)
        );
        const step2 = handleStart.clone().add(
          new THREE.Vector3(beforeEndpoints.dir.x * 600, 0, beforeEndpoints.dir.z * 600)
        );

        let liveLeftAnchorDrift = 0;
        dispatchDragSequence(ctx.canvas, ctx.internals.camera, handleStart, [step1, step2], () => {
          const mesh = findWallMesh(ctx.internals, initialWall.id);
          const curLen = (mesh.userData['initialGeoLength'] as number) * mesh.scale.x;
          const liveEndpoints = getWallWorldEndpoints({
            posX: mesh.position.x,
            posZ: mesh.position.z,
            length: curLen,
            rotationY: angle
          });
          liveLeftAnchorDrift = Math.max(
            liveLeftAnchorDrift,
            Math.hypot(
              liveEndpoints.left.x - beforeEndpoints.left.x,
              liveEndpoints.left.z - beforeEndpoints.left.z
            )
          );
          expect(mesh.position.y).toBe(initialWall.height / 2);
        });

        expect(liveLeftAnchorDrift).toBeLessThan(0.05);
        expect(ctx.emittedRoomConfigs.length).toBe(1);

        const committed = ctx.emittedRoomConfigs[0].walls!.find(w => w.id === initialWall.id)!;
        expect(committed.length).toBe(2100);

        const resolvedAfter = getResolvedRoomWalls(makeRoomConfig(ctx.emittedRoomConfigs[0].walls!))
          .find(w => w.id === initialWall.id)!;
        const afterEndpoints = getWallWorldEndpoints(resolvedAfter);

        const leftDrift = Math.hypot(
          afterEndpoints.left.x - beforeEndpoints.left.x,
          afterEndpoints.left.z - beforeEndpoints.left.z
        );
        const rightGrowth = Math.hypot(
          afterEndpoints.right.x - beforeEndpoints.right.x,
          afterEndpoints.right.z - beforeEndpoints.right.z
        );
        expect(leftDrift).toBeLessThan(0.05);
        expect(Math.abs(rightGrowth - 600)).toBeLessThan(0.05);
      });

      it(`endSign = -1 (tirador izquierdo) a ${angle}° debe extender 1500 -> 2100 dejando el extremo derecho 100% fijo (< 0.05 mm)`, () => {
        const initialWall = makeWall({
          id: `wall_stretch_l_${angle}`,
          length: 1500,
          height: 2600,
          thickness: 150,
          posX: 0,
          posZ: 0,
          rotationY: angle
        });

        const ctx = createMountedViewer([initialWall], {
          selectedWallId: initialWall.id,
          cameraPos: [2100, 3200, 3100],
          lookAt: [0, 1200, 0]
        });
        viewerFixture = ctx.fixture;

        const beforeEndpoints = getWallWorldEndpoints(initialWall);
        const leftHandle = findGizmoHandle(
          ctx.internals,
          u => u['type'] === 'wall_stretch' && u['endSign'] === -1 && u['wallId'] === initialWall.id
        );
        const handleStart = new THREE.Vector3();
        leftHandle.getWorldPosition(handleStart);

        const step1 = handleStart.clone().add(
          new THREE.Vector3(-beforeEndpoints.dir.x * 300, 0, -beforeEndpoints.dir.z * 300)
        );
        const step2 = handleStart.clone().add(
          new THREE.Vector3(-beforeEndpoints.dir.x * 600, 0, -beforeEndpoints.dir.z * 600)
        );

        let liveRightAnchorDrift = 0;
        dispatchDragSequence(ctx.canvas, ctx.internals.camera, handleStart, [step1, step2], () => {
          const mesh = findWallMesh(ctx.internals, initialWall.id);
          const curLen = (mesh.userData['initialGeoLength'] as number) * mesh.scale.x;
          const liveEndpoints = getWallWorldEndpoints({
            posX: mesh.position.x,
            posZ: mesh.position.z,
            length: curLen,
            rotationY: angle
          });
          liveRightAnchorDrift = Math.max(
            liveRightAnchorDrift,
            Math.hypot(
              liveEndpoints.right.x - beforeEndpoints.right.x,
              liveEndpoints.right.z - beforeEndpoints.right.z
            )
          );
          expect(mesh.position.y).toBe(initialWall.height / 2);
        });

        expect(liveRightAnchorDrift).toBeLessThan(0.05);
        expect(ctx.emittedRoomConfigs.length).toBe(1);

        const committed = ctx.emittedRoomConfigs[0].walls!.find(w => w.id === initialWall.id)!;
        expect(committed.length).toBe(2100);

        const resolvedAfter = getResolvedRoomWalls(makeRoomConfig(ctx.emittedRoomConfigs[0].walls!))
          .find(w => w.id === initialWall.id)!;
        const afterEndpoints = getWallWorldEndpoints(resolvedAfter);

        const rightDrift = Math.hypot(
          afterEndpoints.right.x - beforeEndpoints.right.x,
          afterEndpoints.right.z - beforeEndpoints.right.z
        );
        const leftGrowth = Math.hypot(
          afterEndpoints.left.x - beforeEndpoints.left.x,
          afterEndpoints.left.z - beforeEndpoints.left.z
        );
        expect(rightDrift).toBeLessThan(0.05);
        expect(Math.abs(leftGrowth - 600)).toBeLessThan(0.05);
      });
    }
  });

  // =========================================================================
  // ESCENARIO 5: Estiramiento de Altura (wall_stretch_height)
  // =========================================================================
  describe('5. Estiramiento de Altura (wall_stretch_height)', () => {
    let viewerFixture: ComponentFixture<Furniture3dViewerComponent> | null = null;

    afterEach(() => {
      viewerFixture?.destroy();
      viewerFixture = null;
    });

    it('debe crecer exclusivamente hacia arriba manteniendo la base del muro y sus zócalos fijos en Y = 0', () => {
      const wall = makeWall({
        id: 'wall_height_1',
        length: 1800,
        height: 2600,
        thickness: 150,
        posX: 150,
        posZ: -200,
        rotationY: 30,
        showSkirting: true
      });

      const ctx = createMountedViewer([wall], {
        selectedWallId: 'wall_height_1',
        cameraPos: [150, 2600, 3400],
        lookAt: [150, 2200, -200]
      });
      viewerFixture = ctx.fixture;

      const topHandle = findGizmoHandle(
        ctx.internals,
        u => u['type'] === 'wall_stretch_height' && u['wallId'] === 'wall_height_1'
      );
      const handleStart = new THREE.Vector3();
      topHandle.getWorldPosition(handleStart);

      const moveUp1 = handleStart.clone().add(new THREE.Vector3(0, 220, 0));
      const moveUp2 = handleStart.clone().add(new THREE.Vector3(0, 500, 0));

      dispatchDragSequence(ctx.canvas, ctx.internals.camera, handleStart, [moveUp1, moveUp2], () => {
        const wallMesh = findWallMesh(ctx.internals, 'wall_height_1');
        wallMesh.updateMatrixWorld(true);

        const wallOwnBox = new THREE.Box3().setFromBufferAttribute(
          wallMesh.geometry.attributes['position'] as THREE.BufferAttribute
        );
        wallOwnBox.applyMatrix4(wallMesh.matrixWorld);
        expect(Math.abs(wallOwnBox.min.y)).toBeLessThan(0.05);

        const skirtings = wallMesh.children.filter(c => c.userData?.['isSkirting']) as THREE.Mesh[];
        expect(skirtings.length).toBe(2);
        for (const sk of skirtings) {
          const skBox = new THREE.Box3().setFromObject(sk);
          expect(Math.abs(skBox.min.y)).toBeLessThan(0.05);
          expect(Math.abs(skBox.max.y - 100)).toBeLessThan(0.05);
        }
      });

      const wallMesh = findWallMesh(ctx.internals, 'wall_height_1');
      wallMesh.updateMatrixWorld(true);
      const finalWallBox = new THREE.Box3().setFromBufferAttribute(
        wallMesh.geometry.attributes['position'] as THREE.BufferAttribute
      );
      finalWallBox.applyMatrix4(wallMesh.matrixWorld);
      expect(Math.abs(finalWallBox.min.y)).toBeLessThan(0.05);
      expect(Math.abs(finalWallBox.max.y - 3100)).toBeLessThan(0.05);

      expect(ctx.emittedRoomConfigs.length).toBe(1);
      expect(ctx.emittedRoomConfigs[0].recordHistory).toBe(true);
      const updated = ctx.emittedRoomConfigs[0].walls!.find(w => w.id === 'wall_height_1')!;
      expect(updated.height).toBe(3100);
    });
  });

  // =========================================================================
  // ESCENARIO 6: Sincronización Exacta del Contorno Azul (outlineLines) y Tiradores
  // =========================================================================
  describe('6. Sincronización Exacta del Contorno Azul (outlineLines) y Tiradores', () => {
    let viewerFixture: ComponentFixture<Furniture3dViewerComponent> | null = null;

    afterEach(() => {
      viewerFixture?.destroy();
      viewerFixture = null;
    });

    function assertGizmoMatchesWall(internals: ViewerInternals, expected: {
      id: string;
      length: number;
      height: number;
      thickness: number;
      posX: number;
      posZ: number;
      rotationY: number;
    }): void {
      const outlineLines = internals.wallGizmoGroup.children.find(
        c => c instanceof THREE.LineSegments
      ) as THREE.LineSegments | undefined;
      expect(outlineLines).toBeDefined();

      outlineLines!.geometry.computeBoundingBox();
      const size = new THREE.Vector3();
      outlineLines!.geometry.boundingBox!.getSize(size);

      expect(Math.abs(size.x - (expected.length + 6))).toBeLessThan(0.05);
      expect(Math.abs(size.y - (expected.height + 6))).toBeLessThan(0.05);
      expect(Math.abs(size.z - (expected.thickness + 6))).toBeLessThan(0.05);

      expect(Math.abs(outlineLines!.position.x - expected.posX)).toBeLessThan(0.05);
      expect(Math.abs(outlineLines!.position.y - expected.height / 2)).toBeLessThan(0.05);
      expect(Math.abs(outlineLines!.position.z - expected.posZ)).toBeLessThan(0.05);

      const expectedRotRad = -((expected.rotationY || 0) * Math.PI) / 180;
      expect(Math.abs(outlineLines!.rotation.y - expectedRotRad)).toBeLessThan(1e-5);

      // Verificar 2 tiradores laterales (endSign: 1 y -1) + tirador superior en los extremos reales
      const rightHandles = internals.wallGizmoHitMeshes.filter(
        m => m.userData?.['type'] === 'wall_stretch' && m.userData?.['endSign'] === 1 && m.userData?.['wallId'] === expected.id
      );
      const leftHandles = internals.wallGizmoHitMeshes.filter(
        m => m.userData?.['type'] === 'wall_stretch' && m.userData?.['endSign'] === -1 && m.userData?.['wallId'] === expected.id
      );
      const topHandles = internals.wallGizmoHitMeshes.filter(
        m => m.userData?.['type'] === 'wall_stretch_height' && m.userData?.['wallId'] === expected.id
      );

      expect(rightHandles.length).toBeGreaterThanOrEqual(1);
      expect(leftHandles.length).toBeGreaterThanOrEqual(1);
      expect(topHandles.length).toBeGreaterThanOrEqual(1);

      const endDist = expected.length / 2 + 36 / 2 + 10;
      const expectedRightX = expected.posX + endDist * Math.cos(expectedRotRad);
      const expectedRightZ = expected.posZ - endDist * Math.sin(expectedRotRad);
      const expectedLeftX = expected.posX - endDist * Math.cos(expectedRotRad);
      const expectedLeftZ = expected.posZ + endDist * Math.sin(expectedRotRad);

      expect(Math.hypot(rightHandles[0].position.x - expectedRightX, rightHandles[0].position.z - expectedRightZ)).toBeLessThan(0.05);
      expect(Math.abs(rightHandles[0].position.y - expected.height / 2)).toBeLessThan(0.05);

      expect(Math.hypot(leftHandles[0].position.x - expectedLeftX, leftHandles[0].position.z - expectedLeftZ)).toBeLessThan(0.05);
      expect(Math.abs(leftHandles[0].position.y - expected.height / 2)).toBeLessThan(0.05);

      expect(Math.abs(topHandles[0].position.x - expected.posX)).toBeLessThan(0.05);
      expect(Math.abs(topHandles[0].position.y - (expected.height + 36 / 2 + 8))).toBeLessThan(0.05);
      expect(Math.abs(topHandles[0].position.z - expected.posZ)).toBeLessThan(0.05);
    }

    it('debe sincronizar exactamente outlineLines y los 3 tiradores durante onPointerMove y tras onPointerUp en un muro rotado a 45°', () => {
      const wall = makeWall({
        id: 'wall_sync_45',
        length: 1400,
        height: 2400,
        thickness: 150,
        posX: 100,
        posZ: -100,
        rotationY: 45
      });

      const ctx = createMountedViewer([wall], {
        selectedWallId: 'wall_sync_45',
        cameraPos: [2000, 3200, 3200],
        lookAt: [100, 1200, -100]
      });
      viewerFixture = ctx.fixture;

      // Sincronización inicial
      assertGizmoMatchesWall(ctx.internals, wall);

      // Estiramiento derecho en vivo (+400 mm)
      const endpoints = getWallWorldEndpoints(wall);
      const rightHandle = findGizmoHandle(
        ctx.internals,
        u => u['type'] === 'wall_stretch' && u['endSign'] === 1 && u['wallId'] === 'wall_sync_45'
      );
      const startPos = new THREE.Vector3();
      rightHandle.getWorldPosition(startPos);

      const move1 = startPos.clone().add(new THREE.Vector3(endpoints.dir.x * 200, 0, endpoints.dir.z * 200));
      const move2 = startPos.clone().add(new THREE.Vector3(endpoints.dir.x * 400, 0, endpoints.dir.z * 400));

      dispatchDragSequence(ctx.canvas, ctx.internals.camera, startPos, [move1, move2], stepIdx => {
        const expectedDelta = stepIdx === 0 ? 200 : 400;
        const expectedLen = 1400 + expectedDelta;
        const rotRad = (-45 * Math.PI) / 180;
        const expX = Math.round((100 + (expectedDelta / 2) * Math.cos(rotRad)) * 100) / 100;
        const expZ = Math.round((-100 - (expectedDelta / 2) * Math.sin(rotRad)) * 100) / 100;

        assertGizmoMatchesWall(ctx.internals, {
          id: 'wall_sync_45',
          length: expectedLen,
          height: 2400,
          thickness: 150,
          posX: expX,
          posZ: expZ,
          rotationY: 45
        });
      });

      const committedWalls = ctx.emittedRoomConfigs[0].walls!;
      ctx.updateRoomWalls(committedWalls);
      const committedWall = committedWalls.find(w => w.id === 'wall_sync_45')!;
      assertGizmoMatchesWall(ctx.internals, committedWall);

      // Traslación libre en vivo (+300 X, +200 Z)
      const clickBody = new THREE.Vector3(committedWall.posX, committedWall.height / 2, committedWall.posZ);
      const moveBody = clickBody.clone().add(new THREE.Vector3(300, 0, 200));
      dispatchDragSequence(ctx.canvas, ctx.internals.camera, clickBody, [moveBody], () => {
        const liveMesh = findWallMesh(ctx.internals, 'wall_sync_45');
        expect(liveMesh.position.x).toBeGreaterThan(committedWall.posX + 200);
        expect(liveMesh.position.z).toBeGreaterThan(committedWall.posZ + 100);
        assertGizmoMatchesWall(ctx.internals, {
          ...committedWall,
          posX: liveMesh.position.x,
          posZ: liveMesh.position.z
        });
      });

      const committedAfterMove = ctx.emittedRoomConfigs[1].walls!;
      ctx.updateRoomWalls(committedAfterMove);
      assertGizmoMatchesWall(
        ctx.internals,
        committedAfterMove.find(w => w.id === 'wall_sync_45')!
      );
    });
  });

  // =========================================================================
  // ESCENARIO 7: Exclusión de Despiece / Presupuesto / Optimizador / Etiquetas y Persistencia JSON
  // =========================================================================
  describe('7. Exclusión de Despiece/Presupuesto/Optimizador/Etiquetas y Persistencia JSON', () => {
    let designerFixture: ComponentFixture<ModuleDesignerComponent>;
    let partsListFixture: ComponentFixture<PartsListComponent>;
    let optimizerFixture: ComponentFixture<CutOptimizerViewComponent>;
    let budgetFixture: ComponentFixture<BudgetViewComponent>;
    let labelsFixture: ComponentFixture<LabelsViewComponent>;
    let projectService: ProjectStorageService;
    let cutOptimizer: CutOptimizerService;

    beforeEach(async () => {
      spyHeadlessInitThree();
      await TestBed.configureTestingModule({
        imports: [
          ModuleDesignerComponent,
          PartsListComponent,
          CutOptimizerViewComponent,
          BudgetViewComponent,
          LabelsViewComponent
        ],
        providers: [
          ProjectStorageService,
          CutOptimizerService,
          CurrencyExchangeService,
          HardwareCatalogService,
          ConfirmDialogService,
          ThemeService,
          PaymentService,
          AssemblyGuideService
        ]
      }).compileComponents();

      projectService = TestBed.inject(ProjectStorageService);
      cutOptimizer = TestBed.inject(CutOptimizerService);

      designerFixture = TestBed.createComponent(ModuleDesignerComponent);
      partsListFixture = TestBed.createComponent(PartsListComponent);
      optimizerFixture = TestBed.createComponent(CutOptimizerViewComponent);
      budgetFixture = TestBed.createComponent(BudgetViewComponent);
      labelsFixture = TestBed.createComponent(LabelsViewComponent);

      designerFixture.detectChanges();
      partsListFixture.detectChanges();
      optimizerFixture.detectChanges();
      budgetFixture.detectChanges();
      labelsFixture.detectChanges();
    });

    afterEach(() => {
      designerFixture.destroy();
      partsListFixture.destroy();
      optimizerFixture.destroy();
      budgetFixture.destroy();
      labelsFixture.destroy();
    });

    it('añadir, mover, rotar (45°/90°) y estirar muros no debe agregar piezas a parts, PartsList, CutOptimizer, Budget ni Labels', () => {
      const designer = designerFixture.componentInstance;
      const partsList = partsListFixture.componentInstance;
      const optimizerView = optimizerFixture.componentInstance;
      const budgetView = budgetFixture.componentInstance;
      const labelsView = labelsFixture.componentInstance;

      const basePartsSnapshot = projectService.partsList().map(p => p.id);
      const baseCuttableCount = cutOptimizer.getCuttableParts(
        projectService.partsList(),
        projectService.materialsList()
      ).length;
      const baseOptPlacedCount = optimizerView.optimizationResult().totalPartsPlaced;
      const baseGrandTotal = budgetView.finalClientPrice();
      const baseLabelsCount = labelsView.flatLabels().length;

      // Operaciones completas sobre muros
      projectService.setWorkspaceMode('room');
      designer.addRoomWall();
      const newWallId = designer.selectedWall()!;
      expect(newWallId).toBeTruthy();

      designer.setWallPosX(newWallId, 420);
      designer.setWallPosZ(newWallId, -310);
      designer.setWallRotation(newWallId, 45);
      designer.rotateWall(newWallId, 45); // 90°
      designer.setWallLength(newWallId, 2150);
      designer.setWallHeight(newWallId, 3050);
      designer.setWallThickness(newWallId, 200);
      designer.duplicateWall(newWallId);

      designerFixture.detectChanges();
      partsListFixture.detectChanges();
      optimizerFixture.detectChanges();
      budgetFixture.detectChanges();
      labelsFixture.detectChanges();

      expect(projectService.partsList().map(p => p.id)).toEqual(basePartsSnapshot);
      expect(partsList.parts().map(p => p.id)).toEqual(basePartsSnapshot);
      expect(partsList.filteredParts().some(p => p.name.toLowerCase().includes('muro'))).toBe(false);
      expect(
        cutOptimizer.getCuttableParts(projectService.partsList(), projectService.materialsList()).length
      ).toBe(baseCuttableCount);
      expect(optimizerView.optimizationResult().totalPartsPlaced).toBe(baseOptPlacedCount);
      expect(budgetView.finalClientPrice()).toBe(baseGrandTotal);
      expect(labelsView.flatLabels().length).toBe(baseLabelsCount);
    });

    it('exportar e importar JSON en ProjectStorageService + getResolvedRoomWalls debe restaurar íntegramente posX, posZ, rotationY, length, height y thickness', () => {
      const designer = designerFixture.componentInstance;
      projectService.setWorkspaceMode('room');

      designer.addRoomWall();
      const customId = designer.selectedWall()!;
      designer.updateWallName(customId, 'Muro Isla 45°');
      designer.setWallThickness(customId, 200);
      designer.setWallLength(customId, 2100);
      designer.setWallHeight(customId, 2950);
      designer.setWallRotation(customId, 45);
      designer.setWallPosX(customId, 485);
      designer.setWallPosZ(customId, -365);

      designer.setWallRotation('main', 27.5);
      designer.setWallPosX('main', -250);
      designer.setWallPosZ('main', 140);

      const expectedBefore = getResolvedRoomWalls(projectService.roomConfig());
      const jsonExport = projectService.exportProjectAsJson();

      // Reiniciar proyecto a uno nuevo vacío para garantizar restauración real desde JSON
      projectService.createNewProject('Proyecto Temporal Vacío');
      expect(projectService.roomConfig().walls?.some(w => w.id === customId)).toBeFalsy();

      const importedOk = projectService.importProjectFromJson(jsonExport);
      expect(importedOk).toBe(true);

      const restoredWalls = getResolvedRoomWalls(projectService.roomConfig());
      expect(restoredWalls.length).toBe(expectedBefore.length);

      for (const expectedWall of expectedBefore) {
        const restored = restoredWalls.find(w => w.id === expectedWall.id)!;
        expect(restored).toBeDefined();
        expect(restored.name).toBe(expectedWall.name);
        expect(restored.posX).toBe(expectedWall.posX);
        expect(restored.posZ).toBe(expectedWall.posZ);
        expect(restored.rotationY).toBe(expectedWall.rotationY);
        expect(restored.length).toBe(expectedWall.length);
        expect(restored.height).toBe(expectedWall.height);
        expect(restored.thickness).toBe(expectedWall.thickness);
      }

      const restoredCustom = restoredWalls.find(w => w.id === customId)!;
      expect(restoredCustom).toMatchObject({
        name: 'Muro Isla 45°',
        posX: 485,
        posZ: -365,
        rotationY: 45,
        length: 2100,
        height: 2950,
        thickness: 200
      });
    });
  });
});
