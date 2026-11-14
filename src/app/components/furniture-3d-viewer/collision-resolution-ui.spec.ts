import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Furniture3dViewerComponent } from './furniture-3d-viewer';
import { ProjectStorageService } from '../../services/project-storage.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { PartGeometryService } from '../../services/part-geometry.service';
import { CollisionFixOption, Material, Part } from '../../models/melamine.models';

interface ViewerTestInternals {
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
  activeSelectedIds: () => string[];
  boundPointerDown: (e: PointerEvent) => void;
  boundPointerMove: (e: PointerEvent) => void;
  boundPointerUp: (e: PointerEvent) => void;
  initThree: () => void;
  updateRoomScene: (mode: 'module' | 'room', config: ReturnType<Furniture3dViewerComponent['roomConfig']>) => void;
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
  const internals = viewer as unknown as ViewerTestInternals;
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
  internals.camera.position.set(1500, 1100, 1900);
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
  internals.controls.target.set(0, 480, 0);
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

  internals.updateRoomScene(viewer.workspaceMode(), viewer.roomConfig());
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
    Furniture3dViewerComponent.prototype as unknown as ViewerTestInternals,
    'initThree'
  ).mockImplementation(function (this: Furniture3dViewerComponent) {
    initHeadlessViewerThree(this);
  });
}

function makePart(overrides: Partial<Part> & { id: string; name: string }): Part {
  return {
    length: 600,
    width: 400,
    thickness: 15,
    quantity: 1,
    materialId: 'mat-1',
    materialName: 'Melamina Blanco 15mm',
    grain: 'length',
    edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
    posX: 0,
    posY: 7.5,
    posZ: 0,
    orientation: 'horizontal',
    ...overrides
  };
}

function buildCollidingTableParts(prefix = 'tbl'): {
  sideLeft: Part;
  sideRight: Part;
  topPanel: Part;
} {
  const sideLeft = makePart({
    id: `${prefix}-side-l`,
    name: 'LATERAL IZQUIERDO',
    componentRole: 'side_left',
    orientation: 'vertical_yz',
    length: 850,
    width: 600,
    thickness: 15,
    posX: -492.5,
    posY: 425,
    posZ: 0
  });
  const sideRight = makePart({
    id: `${prefix}-side-r`,
    name: 'LATERAL DERECHO',
    componentRole: 'side_right',
    orientation: 'vertical_yz',
    length: 850,
    width: 600,
    thickness: 15,
    posX: 492.5,
    posY: 425,
    posZ: 0
  });
  const topPanel = makePart({
    id: `${prefix}-top`,
    name: 'TAPA SUPERIOR',
    componentRole: 'top',
    orientation: 'horizontal',
    length: 1000,
    width: 600,
    thickness: 15,
    posX: 0,
    posY: 842.5, // minY = 835 -> invade 15 mm en ambos laterales de 850 mm
    posZ: 0
  });
  return { sideLeft, sideRight, topPanel };
}

function findButtonByText(root: HTMLElement, textSnippet: string): HTMLButtonElement | undefined {
  const buttons = Array.from(root.querySelectorAll('button'));
  return buttons.find(btn => (btn.textContent || '').includes(textSnippet));
}

describe('Furniture3dViewerComponent - Phase 2 Interactive Collision Resolution UI', () => {
  let fixture: ComponentFixture<Furniture3dViewerComponent>;
  let component: Furniture3dViewerComponent;
  let projectStorage: ProjectStorageService;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    spyHeadlessInitThree();
    TestBed.configureTestingModule({
      imports: [Furniture3dViewerComponent],
      providers: [ProjectStorageService, JoineryEngineService, PartGeometryService]
    });

    projectStorage = TestBed.inject(ProjectStorageService);
    fixture = TestBed.createComponent(Furniture3dViewerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  function syncSceneParts(parts: Part[], selectedIds: string[] = []): void {
    fixture.componentRef.setInput('parts', parts);
    fixture.componentRef.setInput('selectedPartIds', selectedIds);
    fixture.componentRef.setInput('selectedPartId', selectedIds[0] ?? null);
    fixture.detectChanges();
    TestBed.flushEffects();
  }

  it('debe calcular collisionPlans() reactivamente para mesa con TAPA SUPERIOR invadiendo ambos laterales (+15 mm)', () => {
    const { sideLeft, sideRight, topPanel } = buildCollidingTableParts();
    syncSceneParts([sideLeft, sideRight, topPanel]);

    expect(component.detectedCollisions().length).toBe(2);
    const plans = component.collisionPlans();
    expect(plans.length).toBe(2);

    for (const plan of plans) {
      expect(plan.canFix).toBe(true);
      expect(plan.primaryFix).not.toBeNull();
      expect(plan.primaryFix?.targetPartId).toBe(topPanel.id);
      expect(plan.primaryFix?.axis).toBe('y');
      expect(plan.primaryFix?.deltaMm).toBe(15);
      expect(plan.primaryFix?.buttonLabel).toBe('Corregir: Subir +15 mm');
      expect(plan.secondaryFix).not.toBeNull();
    }
  });

  it('debe renderizar el dropdown Minimalist Studio con Hugeicons puros, cero SVG inline y botón batch solo con >= 2 colisiones', () => {
    const { sideLeft, sideRight, topPanel } = buildCollidingTableParts();
    syncSceneParts([sideLeft, sideRight, topPanel]);

    const root = fixture.nativeElement as HTMLElement;
    const badgeBtn = findButtonByText(root, '2 solapamiento(s)');
    expect(badgeBtn).toBeTruthy();

    badgeBtn!.click();
    fixture.detectChanges();
    expect(component.showCollisionsDetail()).toBe(true);

    const text = root.textContent || '';
    expect(text).toContain('Interferencias detectadas');
    expect(text).toContain('Tolerancia 0.8mm');
    expect(text).toContain('Resolver Todos Automáticamente');
    expect(text).toContain('Ver en 3D');
    expect(text).toContain('Corregir: Subir +15 mm');

    // Validar que no haya SVGs inline fuera de <hugeicons-icon> ni estilos prohibidos en el panel de colisiones
    const collisionWrapper = badgeBtn!.parentElement as HTMLElement;
    const svgs = Array.from(collisionWrapper.querySelectorAll('svg'));
    for (const svg of svgs) {
      expect(svg.closest('hugeicons-icon')).not.toBeNull();
    }
    expect(collisionWrapper.querySelectorAll('hugeicons-icon').length).toBeGreaterThan(0);
    expect(collisionWrapper.querySelectorAll('.font-mono').length).toBe(0);
    expect(collisionWrapper.innerHTML).not.toMatch(/bg-gradient|purple-|violet-|fuchsia-|indigo-|pink-/);

    // Validar que los números de invasión usen .cad-collision-numeric
    const numericCells = collisionWrapper.querySelectorAll('.cad-collision-numeric');
    expect(numericCells.length).toBeGreaterThanOrEqual(4);

    // Con 1 sola colisión, el botón batch "Resolver Todos Automáticamente" NO debe renderizarse
    syncSceneParts([sideLeft, topPanel]);
    fixture.detectChanges();
    expect(findButtonByText(root, '1 solapamiento(s)')).toBeTruthy();
    expect(findButtonByText(root, 'Resolver Todos Automáticamente')).toBeUndefined();
  });

  it('onCollisionCardClick debe emitir partsSelected/partSelected solo con la pieza objetivo y enfocar la cámara 3D sobre ella', () => {
    const { sideLeft, sideRight, topPanel } = buildCollidingTableParts();
    syncSceneParts([sideLeft, sideRight, topPanel]);

    const partsSelectedCalls: string[][] = [];
    const partSelectedCalls: (Part | null)[] = [];
    component.partsSelected.subscribe(ids => partsSelectedCalls.push(ids));
    component.partSelected.subscribe(p => partSelectedCalls.push(p));

    const focusSpy = vi.spyOn(component, 'focusCameraOnPart');
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    let rafCount = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      if (rafCount++ < 3) {
        now += 500;
        cb(now);
      }
      return rafCount;
    });

    const root = fixture.nativeElement as HTMLElement;
    findButtonByText(root, '2 solapamiento(s)')?.click();
    fixture.detectChanges();

    const focusCardBtn = findButtonByText(root, 'Ver en 3D');
    expect(focusCardBtn).toBeTruthy();
    focusCardBtn!.click();

    expect(partsSelectedCalls[partsSelectedCalls.length - 1]).toEqual([topPanel.id]);
    expect(partSelectedCalls[partSelectedCalls.length - 1]?.id).toBe(topPanel.id);
    expect(focusSpy).toHaveBeenCalledWith(topPanel.id);

    const internals = component as unknown as ViewerTestInternals;
    expect(internals.controls.target.y).toBeCloseTo(topPanel.posY!, 1);

    // Verificar fallback con pieceObjects vacío usando partGeometry.getWorldAABB
    (component as unknown as { pieceObjects: unknown[] }).pieceObjects = [];
    const partGeom = TestBed.inject(PartGeometryService);
    const aabbSpy = vi.spyOn(partGeom, 'getWorldAABB');
    component.focusCameraOnPart(topPanel.id);
    expect(aabbSpy).toHaveBeenCalledWith(topPanel);

    // Al reflejar la selección desde el padre, la tarjeta activa debe resaltar en Azul Acero (border-sky-600)
    syncSceneParts([sideLeft, sideRight, topPanel], [topPanel.id]);
    expect(root.querySelector('.border-sky-600')).not.toBeNull();
  });

  it('applySingleCollisionFix vía ProjectStorageService debe subir TAPA SUPERIOR +15 mm, limpiar ambos solapamientos y soportar Undo', () => {
    const { sideLeft, sideRight, topPanel } = buildCollidingTableParts('proj');
    projectStorage.updateProject(
      p => ({
        ...p,
        parts: [sideLeft, sideRight, topPanel]
      }),
      false
    );
    projectStorage.clearHistory();

    syncSceneParts(projectStorage.partsList());
    expect(component.detectedCollisions().length).toBe(2);

    const root = fixture.nativeElement as HTMLElement;
    findButtonByText(root, '2 solapamiento(s)')?.click();
    fixture.detectChanges();

    const applySpy = vi.spyOn(projectStorage, 'applyCollisionFix');
    const fixBtn = findButtonByText(root, 'Corregir: Subir +15 mm');
    expect(fixBtn).toBeTruthy();
    fixBtn!.click();

    expect(applySpy).toHaveBeenCalledTimes(1);
    const updatedTop = projectStorage.partsList().find(p => p.id === topPanel.id);
    expect(updatedTop?.posY).toBe(857.5);

    syncSceneParts(projectStorage.partsList());
    expect(component.detectedCollisions().length).toBe(0);
    expect(component.collisionPlans().length).toBe(0);
    expect(findButtonByText(root, 'solapamiento(s)')).toBeUndefined();

    // Undo debe restaurar exactamente la posición inicial y los 2 solapamientos
    projectStorage.undo();
    syncSceneParts(projectStorage.partsList());
    const revertedTop = projectStorage.partsList().find(p => p.id === topPanel.id);
    expect(revertedTop?.posY).toBe(842.5);
    expect(component.detectedCollisions().length).toBe(2);
  });

  it('applySingleCollisionFix en modo standalone (sin piezas en ProjectStorage) debe guardar snapshot y emitir partModified con clamp >= 0', () => {
    const { sideLeft, sideRight, topPanel } = buildCollidingTableParts('standalone');
    syncSceneParts([sideLeft, sideRight, topPanel]);

    const snapshotSpy = vi.spyOn(projectStorage, 'pushSnapshot');
    const emittedModifications: { part: Part; updates: Partial<Part> }[] = [];
    component.partModified.subscribe(ev => emittedModifications.push(ev));

    const root = fixture.nativeElement as HTMLElement;
    findButtonByText(root, '2 solapamiento(s)')?.click();
    fixture.detectChanges();

    const fixBtn = findButtonByText(root, 'Corregir: Subir +15 mm');
    expect(fixBtn).toBeTruthy();
    fixBtn!.click();

    expect(snapshotSpy).toHaveBeenCalledTimes(1);
    expect(emittedModifications.length).toBe(1);
    expect(emittedModifications[0].part.id).toBe(topPanel.id);
    expect(emittedModifications[0].updates).toEqual({ posY: 857.5 });

    // Verificar clamp en Y >= 0 cuando un fix negativo empujaría la pieza bajo el suelo
    const floorFix: CollisionFixOption = {
      axis: 'y',
      direction: -1,
      deltaMm: -500,
      absDeltaMm: 500,
      targetPartId: sideLeft.id,
      targetPartName: sideLeft.name,
      anchorPartId: topPanel.id,
      anchorPartName: topPanel.name,
      buttonLabel: 'Bajar',
      shortReason: 'Test suelo',
      actionText: 'Test suelo'
    };
    component.applySingleCollisionFix(floorFix);
    expect(emittedModifications[1].updates.posY).toBe(425);
  });

  it('resolveAllDetectedCollisions debe resolver múltiples conflictos en cascada con 1 Undo atómico y soportar fallback standalone', () => {
    const { sideLeft, sideRight, topPanel } = buildCollidingTableParts('batch');
    const collidingShelf = makePart({
      id: 'batch-shelf',
      name: 'ENTREPAÑO',
      componentRole: 'shelf',
      orientation: 'horizontal',
      length: 960,
      width: 560,
      thickness: 15,
      posX: -15, // minX = -495 -> invade lateral izquierdo [-500, -485] por 10 mm; maxX = 465 < 485
      posY: 400,
      posZ: 0
    });

    projectStorage.updateProject(
      p => ({
        ...p,
        parts: [sideLeft, sideRight, topPanel, collidingShelf]
      }),
      false
    );
    projectStorage.clearHistory();

    syncSceneParts(projectStorage.partsList());
    expect(component.detectedCollisions().length).toBe(3);

    const root = fixture.nativeElement as HTMLElement;
    findButtonByText(root, '3 solapamiento(s)')?.click();
    fixture.detectChanges();

    const batchSpy = vi.spyOn(projectStorage, 'resolveAllProjectCollisions');
    const batchBtn = findButtonByText(root, 'Resolver Todos Automáticamente');
    expect(batchBtn).toBeTruthy();
    batchBtn!.click();

    expect(batchSpy).toHaveBeenCalledTimes(1);
    syncSceneParts(projectStorage.partsList());
    expect(component.detectedCollisions().length).toBe(0);

    // 1 solo Undo restaura las 3 interferencias previas
    projectStorage.undo();
    syncSceneParts(projectStorage.partsList());
    expect(component.detectedCollisions().length).toBe(3);

    // Fallback standalone cuando las piezas no existen en ProjectStorageService
    const standaloneSet = buildCollidingTableParts('isolated');
    syncSceneParts([standaloneSet.sideLeft, standaloneSet.sideRight, standaloneSet.topPanel]);
    const pushSpy = vi.spyOn(projectStorage, 'pushSnapshot');
    const multiEmits: { updates: { part: Part; updates: Partial<Part> }[] }[] = [];
    component.multiplePartsModified.subscribe(ev => multiEmits.push(ev));

    findButtonByText(root, '2 solapamiento(s)')?.click();
    fixture.detectChanges();
    findButtonByText(root, 'Resolver Todos Automáticamente')?.click();

    expect(pushSpy).toHaveBeenCalled();
    expect(multiEmits.length).toBe(1);
    expect(multiEmits[0].updates.some(u => u.part.id === standaloneSet.topPanel.id && u.updates.posY === 857.5)).toBe(true);
  });

  it('debe bloquear botones de corrección cuando ambas piezas tienen isLocked=true y mover la pieza libre si solo una está congelada', () => {
    const lockedLeft = makePart({
      id: 'lock-side-l',
      name: 'LATERAL IZQUIERDO',
      componentRole: 'side_left',
      orientation: 'vertical_yz',
      length: 850,
      width: 600,
      thickness: 15,
      posX: -492.5,
      posY: 425,
      posZ: 0,
      isLocked: true
    });
    const lockedTop = makePart({
      id: 'lock-top',
      name: 'TAPA SUPERIOR',
      componentRole: 'top',
      orientation: 'horizontal',
      length: 1000,
      width: 600,
      thickness: 15,
      posX: 0,
      posY: 842.5,
      posZ: 0,
      isLocked: true
    });

    syncSceneParts([lockedLeft, lockedTop]);
    expect(component.collisionPlans().length).toBe(1);
    expect(component.collisionPlans()[0].canFix).toBe(false);
    expect(component.collisionPlans()[0].primaryFix).toBeNull();

    const root = fixture.nativeElement as HTMLElement;
    findButtonByText(root, '1 solapamiento(s)')?.click();
    fixture.detectChanges();

    expect(root.textContent || '').toContain('Piezas congeladas: descongela al menos una para corregir');
    expect(findButtonByText(root, 'Corregir:')).toBeUndefined();

    // Si solo TAPA SUPERIOR está congelada y el lateral está desbloqueado, debe sugerir mover el lateral
    syncSceneParts([{ ...lockedLeft, isLocked: false }, lockedTop]);
    fixture.detectChanges();
    const mixedPlan = component.collisionPlans()[0];
    expect(mixedPlan.canFix).toBe(true);
    expect(mixedPlan.primaryFix?.targetPartId).toBe(lockedLeft.id);
  });
});
