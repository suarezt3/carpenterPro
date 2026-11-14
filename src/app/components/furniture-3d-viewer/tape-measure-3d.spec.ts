import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Furniture3dViewerComponent } from './furniture-3d-viewer';
import { PartGeometryService } from '../../services/part-geometry.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import {
  AXIS_COLORS,
  AXIS_CSS_COLORS,
  MagneticSnapCandidate,
  MeasureAxisLock,
  Point3D,
  SNAP_CSS_COLORS,
  SNAP_LABELS,
  TAPE_MEASURE_RENDER_ORDER,
  TapeMeasure3dService
} from '../../services/tape-measure-3d.service';
import { Material, Part } from '../../models/melamine.models';

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
  lastSnapIndicatorKey: string;
  isMarqueeSelecting: boolean;
  boundPointerDown: (e: PointerEvent) => void;
  boundPointerMove: (e: PointerEvent) => void;
  boundPointerUp: (e: PointerEvent) => void;
  initThree: () => void;
  updateRoomScene: (
    mode: 'module' | 'room',
    config: ReturnType<Furniture3dViewerComponent['roomConfig']>
  ) => void;
  buildFurnitureScene: (
    parts: Part[],
    selectedIds: string[],
    mats: Material[],
    isXRay: boolean,
    showDims: boolean
  ) => void;
  findMeasureSnapCandidateAt: (clientX: number, clientY: number) => MagneticSnapCandidate | null;
  updateMagneticSnapIndicator: (candidate: MagneticSnapCandidate | null) => void;
  updateProjectedMeasureBadges: () => void;
  resolveMeasurementPointB: (
    rawPoint: Point3D | THREE.Vector3,
    shiftPressed?: boolean,
    clientX?: number,
    clientY?: number
  ) => { pointB: Point3D; axisLock: MeasureAxisLock };
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
  internals.camera.position.set(0, 450, 1800);
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
  internals.controls.target.set(0, 300, 0);
  internals.controls.update();
  internals.camera.lookAt(internals.controls.target);
  internals.camera.updateMatrixWorld(true);

  internals.controls.addEventListener('change', () => {
    internals.updateProjectedMeasureBadges();
  });
  internals.controls.addEventListener('end', () => {
    internals.updateProjectedMeasureBadges();
  });

  internals.measureGroup.renderOrder = TAPE_MEASURE_RENDER_ORDER;
  internals.magneticSnapGroup.renderOrder = TAPE_MEASURE_RENDER_ORDER;

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
    length: 800,
    width: 400,
    thickness: 18,
    quantity: 1,
    materialId: 'mat-white',
    materialName: 'Melamina Blanca 18mm',
    grain: 'length',
    edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
    posX: 0,
    posY: 300,
    posZ: 0,
    orientation: 'horizontal',
    ...overrides
  };
}

function projectToClient(camera: THREE.Camera, pt: Point3D): { clientX: number; clientY: number } {
  camera.updateMatrixWorld(true);
  const v = new THREE.Vector3(pt.x, pt.y, pt.z).project(camera);
  return {
    clientX: ((v.x + 1) / 2) * VIEWPORT_RECT.width + VIEWPORT_RECT.left,
    clientY: ((-v.y + 1) / 2) * VIEWPORT_RECT.height + VIEWPORT_RECT.top
  };
}

function createPointerEvt(
  type: string,
  clientX: number,
  clientY: number,
  opts: Partial<PointerEventInit> = {}
): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: opts.buttons ?? (type === 'pointerdown' || type === 'pointermove' ? 1 : 0),
    clientX,
    clientY,
    ...opts
  });
}

describe('Furniture3dViewerComponent - Fase 5 Tape Measure 3D UX & Precision', () => {
  let fixture: ComponentFixture<Furniture3dViewerComponent>;
  let component: Furniture3dViewerComponent;
  let internals: ViewerTestInternals;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    spyHeadlessInitThree();
    TestBed.configureTestingModule({
      imports: [Furniture3dViewerComponent],
      providers: [ProjectStorageService, JoineryEngineService, PartGeometryService, TapeMeasure3dService]
    });

    fixture = TestBed.createComponent(Furniture3dViewerComponent);
    component = fixture.componentInstance;
    internals = component as unknown as ViewerTestInternals;
  });

  afterEach(() => {
    fixture.destroy();
    vi.restoreAllMocks();
  });

  function setupSceneParts(parts: Part[]): void {
    fixture.componentRef.setInput('parts', parts);
    fixture.detectChanges();
    TestBed.flushEffects();
    internals.scene.updateMatrixWorld(true);
  }

  function clickClient(clientX: number, clientY: number, shiftKey = false): void {
    const canvas = internals.canvasRef()!.nativeElement;
    canvas.dispatchEvent(createPointerEvt('pointerdown', clientX, clientY, { button: 0, shiftKey }));
    window.dispatchEvent(createPointerEvt('pointerup', clientX, clientY, { button: 0, buttons: 0, shiftKey }));
    fixture.detectChanges();
  }

  function clickWorldPoint(pt: Point3D, shiftKey = false): void {
    const { clientX, clientY } = projectToClient(internals.camera, pt);
    clickClient(clientX, clientY, shiftKey);
  }

  function buildSingleFrontPanel(): Part {
    // Panel vertical frontal XZ plane: centered at (0, 300, 0), length 800 (X: -400..400), width 600 (Y: 0..600), thickness 20 (Z: -10..10)
    return makePart({
      id: 'front-panel',
      name: 'TABLERO FRONTAL',
      length: 800,
      width: 600,
      thickness: 20,
      posX: 0,
      posY: 300,
      posZ: 0,
      orientation: 'vertical_xy'
    });
  }

  it('mantiene controls.enabled = true y conserva Punto A y medidas guardadas al arrastrar camara (> 5px)', () => {
    setupSceneParts([buildSingleFrontPanel()]);
    component.setActiveTool('measure');
    expect(component.isMeasureMode()).toBe(true);
    expect(internals.controls.enabled).toBe(true);

    // 1. Clic simple para colocar Punto A en esquina superior izquierda frontal (-400, 600, 10)
    clickWorldPoint({ x: -400, y: 600, z: 10 });
    expect(component.measurePointA()).toEqual({ x: -400, y: 600, z: 10 });
    expect(internals.controls.enabled).toBe(true);

    // 2. Simular arrastre largo (> 5px) para orbitar camara sin fijar Punto B
    const canvas = internals.canvasRef()!.nativeElement;
    const cornerPos = projectToClient(internals.camera, { x: 400, y: 600, z: 10 });
    canvas.dispatchEvent(createPointerEvt('pointerdown', cornerPos.clientX, cornerPos.clientY, { button: 0 }));
    expect(internals.controls.enabled).toBe(true);
    window.dispatchEvent(
      createPointerEvt('pointermove', cornerPos.clientX + 42, cornerPos.clientY + 18, { button: 0, buttons: 1 })
    );
    window.dispatchEvent(
      createPointerEvt('pointerup', cornerPos.clientX + 42, cornerPos.clientY + 18, { button: 0, buttons: 0 })
    );
    fixture.detectChanges();

    expect(component.measurePointA()).toEqual({ x: -400, y: 600, z: 10 });
    expect(component.savedMeasurements().length).toBe(0);
    expect(internals.controls.enabled).toBe(true);

    // 3. Finalizar medicion y repetir arrastre > 5px: no crea ni borra mediciones
    clickWorldPoint({ x: 400, y: 600, z: 10 });
    expect(component.savedMeasurements().length).toBe(1);
    expect(component.measurePointA()).toBeNull();

    canvas.dispatchEvent(createPointerEvt('pointerdown', 500, 400, { button: 0 }));
    window.dispatchEvent(createPointerEvt('pointerup', 530, 420, { button: 0, buttons: 0 }));
    fixture.detectChanges();

    expect(component.savedMeasurements().length).toBe(1);
    expect(component.measurePointA()).toBeNull();

    // 4. Shift + pointerdown en modo medir NO activa marquee box selection
    canvas.dispatchEvent(createPointerEvt('pointerdown', 480, 380, { button: 0, shiftKey: true }));
    expect(internals.isMarqueeSelecting).toBe(false);
    expect(component.marqueeBox()).toBeNull();
    expect(internals.controls.enabled).toBe(true);
    window.dispatchEvent(createPointerEvt('pointerup', 520, 410, { button: 0, buttons: 0, shiftKey: true }));
  });

  it('soporta 3 mediciones simultaneas visibles con badges 2D proyectados', () => {
    setupSceneParts([buildSingleFrontPanel()]);
    component.setActiveTool('measure');

    // Medida 1: Ancho superior X (-400, 600, 10) -> (400, 600, 10) = 800 mm
    clickWorldPoint({ x: -400, y: 600, z: 10 });
    clickWorldPoint({ x: 400, y: 600, z: 10 });

    // Medida 2: Alto izquierdo Y (-400, 0, 10) -> (-400, 600, 10) = 600 mm
    clickWorldPoint({ x: -400, y: 0, z: 10 });
    clickWorldPoint({ x: -400, y: 600, z: 10 });

    // Medida 3: Espesor Z (400, 600, 10) -> (400, 600, -10) = 20 mm (moviendo levemente camara para ver cara lateral)
    internals.camera.position.set(1200, 750, 1400);
    internals.camera.lookAt(internals.controls.target);
    internals.camera.updateMatrixWorld(true);
    clickWorldPoint({ x: 400, y: 600, z: 10 });
    clickWorldPoint({ x: 400, y: 600, z: -10 });

    expect(component.savedMeasurements().length).toBe(3);
    expect(component.measurePointA()).toBeNull();
    expect(component.measurePointB()).toBeNull();
    expect(component.projectedMeasureBadges().length).toBe(3);

    const domBadges = fixture.nativeElement.querySelectorAll('[data-measure-id]');
    expect(domBadges.length).toBe(3);
    expect(component.savedMeasurements()[0].distanceMm).toBe(800);
    expect(component.savedMeasurements()[1].distanceMm).toBe(600);
    expect(component.savedMeasurements()[2].distanceMm).toBe(20);
  });

  it('persiste savedMeasurements en 3D y 2D al salir del modo medir con setActiveTool o toggleMeasureMode', () => {
    setupSceneParts([buildSingleFrontPanel()]);
    component.setActiveTool('measure');

    clickWorldPoint({ x: -400, y: 600, z: 10 });
    clickWorldPoint({ x: 400, y: 600, z: 10 });
    clickWorldPoint({ x: -400, y: 0, z: 10 });
    clickWorldPoint({ x: -400, y: 600, z: 10 });

    // Iniciar 3er trazo activo (solo Punto A) y salir a Herramienta Seleccionar
    clickWorldPoint({ x: 400, y: 0, z: 10 });
    expect(component.measurePointA()).not.toBeNull();

    component.setActiveTool('select');
    fixture.detectChanges();

    expect(component.isMeasureMode()).toBe(false);
    expect(component.measurePointA()).toBeNull();
    expect(component.measurePointB()).toBeNull();
    expect(component.savedMeasurements().length).toBe(2);
    expect(internals.measureGroup.children.length).toBeGreaterThan(0);
    expect(component.projectedMeasureBadges().length).toBe(2);
    expect((fixture.nativeElement.textContent || '')).toContain('Limpiar medidas (2)');

    // Reactivar y desactivar con toggleMeasureMode manteniendo savedMeasurements intacto
    component.toggleMeasureMode();
    expect(component.isMeasureMode()).toBe(true);
    clickWorldPoint({ x: 400, y: 0, z: 10 });
    expect(component.measurePointA()).not.toBeNull();

    component.toggleMeasureMode();
    fixture.detectChanges();
    expect(component.isMeasureMode()).toBe(false);
    expect(component.measurePointA()).toBeNull();
    expect(component.savedMeasurements().length).toBe(2);
  });

  it('Esc y clic derecho limpio cancelan SOLO el trazo activo sin borrar savedMeasurements ni abrir menu contextual', () => {
    setupSceneParts([buildSingleFrontPanel()]);
    component.setActiveTool('measure');

    // Guardar 1 medicion
    clickWorldPoint({ x: -400, y: 600, z: 10 });
    clickWorldPoint({ x: 400, y: 600, z: 10 });
    expect(component.savedMeasurements().length).toBe(1);

    // 1. Iniciar trazo activo y cancelar con tecla Escape
    clickWorldPoint({ x: -400, y: 0, z: 10 });
    expect(component.measurePointA()).not.toBeNull();

    const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    component.handleViewerKeyDown(escEvent);
    fixture.detectChanges();

    expect(component.measurePointA()).toBeNull();
    expect(component.savedMeasurements().length).toBe(1);

    // Esc sin trazo activo tampoco borra savedMeasurements
    component.handleViewerKeyDown(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(component.savedMeasurements().length).toBe(1);

    // 2. Iniciar trazo activo y cancelar con Clic Derecho limpio sobre la pieza
    clickWorldPoint({ x: -400, y: 0, z: 10 });
    expect(component.measurePointA()).not.toBeNull();

    const canvas = internals.canvasRef()!.nativeElement;
    const container = internals.containerRef()!.nativeElement;
    const midScreen = projectToClient(internals.camera, { x: 0, y: 300, z: 10 });

    canvas.dispatchEvent(
      createPointerEvt('pointerdown', midScreen.clientX, midScreen.clientY, { button: 2, buttons: 2 })
    );
    window.dispatchEvent(
      createPointerEvt('pointerup', midScreen.clientX, midScreen.clientY, { button: 2, buttons: 0 })
    );
    container.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: midScreen.clientX,
        clientY: midScreen.clientY
      })
    );
    fixture.detectChanges();

    expect(component.measurePointA()).toBeNull();
    expect(component.savedMeasurements().length).toBe(1);
    expect(component.contextMenuPart()).toBeNull();
    expect(component.contextMenuPos()).toBeNull();

    // 3. Arrastre derecho > 5px (pan) NO cancela Punto A activo
    clickWorldPoint({ x: -400, y: 0, z: 10 });
    expect(component.measurePointA()).not.toBeNull();

    canvas.dispatchEvent(
      createPointerEvt('pointerdown', midScreen.clientX, midScreen.clientY, { button: 2, buttons: 2 })
    );
    window.dispatchEvent(
      createPointerEvt('pointermove', midScreen.clientX + 25, midScreen.clientY + 10, { button: 2, buttons: 2 })
    );
    window.dispatchEvent(
      createPointerEvt('pointerup', midScreen.clientX + 25, midScreen.clientY + 10, { button: 2, buttons: 0 })
    );
    fixture.detectChanges();

    expect(component.measurePointA()).not.toBeNull();
    expect(component.savedMeasurements().length).toBe(1);
  });

  it('elimina una sola medicion con boton X (removeMeasurement) y limpia todas con Limpiar medidas (clearAllMeasurements)', () => {
    setupSceneParts([buildSingleFrontPanel()]);
    component.setActiveTool('measure');

    clickWorldPoint({ x: -400, y: 600, z: 10 });
    clickWorldPoint({ x: 400, y: 600, z: 10 });
    clickWorldPoint({ x: -400, y: 0, z: 10 });
    clickWorldPoint({ x: -400, y: 600, z: 10 });
    clickWorldPoint({ x: 400, y: 0, z: 10 });
    clickWorldPoint({ x: 400, y: 600, z: 10 });
    fixture.detectChanges();

    const initialIds = component.savedMeasurements().map(m => m.id);
    expect(initialIds.length).toBe(3);

    const middleBadge = fixture.nativeElement.querySelector(`[data-measure-id="${initialIds[1]}"]`) as HTMLElement;
    expect(middleBadge).not.toBeNull();
    const deleteBtn = middleBadge.querySelector('button[aria-label="Eliminar medición"]') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();
    deleteBtn.click();
    fixture.detectChanges();

    expect(component.savedMeasurements().map(m => m.id)).toEqual([initialIds[0], initialIds[2]]);
    expect(component.projectedMeasureBadges().length).toBe(2);

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const clearAllBtn = buttons.find(b => (b.textContent || '').includes('Limpiar medidas'));
    expect(clearAllBtn).toBeDefined();
    clearAllBtn!.click();
    fixture.detectChanges();

    expect(component.savedMeasurements().length).toBe(0);
    expect(component.projectedMeasureBadges().length).toBe(0);
    expect(internals.measureGroup.children.length).toBe(0);
  });

  it('proyecta perpendicularmente Punto B con Shift, modos X/Y/Z y umbrales de 15px / 25mm', () => {
    setupSceneParts([buildSingleFrontPanel()]);
    component.setActiveTool('measure');

    // Punto A en esquina inferior izquierda (-400, 0, 10)
    clickWorldPoint({ x: -400, y: 0, z: 10 });
    const ptA = component.measurePointA()!;

    // 1. Con Shift presionado hacia esquina superior derecha (400, 600, 10): |dx|=800 > |dy|=600 -> eje X
    clickWorldPoint({ x: 400, y: 600, z: 10 }, true);
    const savedShift = component.savedMeasurements()[0];
    expect(savedShift.axisLock).toBe('x');
    expect(savedShift.pointB).toEqual({ x: 400, y: ptA.y, z: ptA.z });

    // 2. Umbral de 25 mm + 15 px sin Shift: fijar nuevo Punto A antes de evaluar resolveMeasurementPointB
    clickWorldPoint({ x: -400, y: 0, z: 10 });
    expect(component.measurePointA()).toEqual({ x: -400, y: 0, z: 10 });

    // 2a. Desfase <= 25 mm (dy = 18 mm) engancha ortogonalmente al eje X
    const nearAlignedMm = internals.resolveMeasurementPointB({ x: 120, y: 18, z: 10 }, false);
    expect(nearAlignedMm.axisLock).toBe('x');
    expect(nearAlignedMm.pointB).toEqual({ x: 120, y: 0, z: 10 });

    // 2b. Desfase > 25 mm (dy = 26 mm) pero <= 15 px en pantalla (~13.6 px) tambien engancha en X
    const nearPxScreen = projectToClient(internals.camera, { x: 120, y: 26, z: 10 });
    const nearAlignedPx = internals.resolveMeasurementPointB(
      { x: 120, y: 26, z: 10 },
      false,
      nearPxScreen.clientX,
      nearPxScreen.clientY
    );
    expect(nearAlignedPx.axisLock).toBe('x');
    expect(nearAlignedPx.pointB).toEqual({ x: 120, y: 0, z: 10 });

    // Cancelar trazo activo antes del paso 3 para no cerrar la medicion con el siguiente clic
    component.cancelActiveMeasurementTrace();
    expect(component.measurePointA()).toBeNull();

    // 3. Reproyeccion desde selector HUD (Directo -> Y)
    clickWorldPoint({ x: -400, y: 0, z: 10 });
    expect(component.measurePointA()).toEqual({ x: -400, y: 0, z: 10 });
    const diagScreen = projectToClient(internals.camera, { x: 400, y: 600, z: 10 });
    window.dispatchEvent(
      createPointerEvt('pointermove', diagScreen.clientX, diagScreen.clientY, { button: 0, buttons: 0 })
    );
    fixture.detectChanges();

    component.setMeasureProjectionMode('y');
    expect(component.activeInferredAxis()).toBe('y');
    expect(component.measurePointB()).toEqual({ x: -400, y: 600, z: 10 });
  });

  it('bloquea iman en aristas o caras traseras ocultas por un panel frontal solido (closest visible surface)', () => {
    const frontOccluder = makePart({
      id: 'front-occluder',
      name: 'PANEL FRONTAL',
      length: 900,
      width: 700,
      thickness: 20,
      posX: 0,
      posY: 350,
      posZ: 200,
      orientation: 'vertical_xy'
    });
    const rearTarget = makePart({
      id: 'rear-target',
      name: 'PANEL TRASERO',
      length: 400,
      width: 400,
      thickness: 20,
      posX: 0,
      posY: 350,
      posZ: -200,
      orientation: 'vertical_xy'
    });
    setupSceneParts([frontOccluder, rearTarget]);

    // Apuntar al centro donde detras (Z=-190) estan los bordes superiores/medios del panel trasero (X=-200..200, Y=150..550)
    // Rayo desde camara (0, 450, 1800) atraviesa cara solida de PANEL FRONTAL en Z=210 antes de tocar PANEL TRASERO
    const rearCornerBehindFront = projectToClient(internals.camera, { x: -200, y: 550, z: -190 });
    const cand = internals.findMeasureSnapCandidateAt(rearCornerBehindFront.clientX, rearCornerBehindFront.clientY);

    expect(cand).not.toBeNull();
    expect(cand!.objectName).toBe('PANEL FRONTAL');
    expect(cand!.worldPos.z).toBeGreaterThan(205);
  });

  it('configura depthTest=false, depthWrite=false, renderOrder=995 y etiquetas/colores exactos de snap e ejes', () => {
    setupSceneParts([buildSingleFrontPanel()]);
    component.setActiveTool('measure');

    // Medida eje X (#EF4444), eje Y (#10B981) y directa diagonal (#D97706)
    clickWorldPoint({ x: -400, y: 600, z: 10 });
    clickWorldPoint({ x: 400, y: 600, z: 10 });

    clickWorldPoint({ x: -400, y: 0, z: 10 });
    clickWorldPoint({ x: -400, y: 600, z: 10 });

    clickWorldPoint({ x: -400, y: 0, z: 10 });
    clickWorldPoint({ x: 400, y: 600, z: 10 });

    expect(component.savedMeasurements()[0].axisLock).toBe('x');
    expect(component.savedMeasurements()[1].axisLock).toBe('y');
    expect(component.savedMeasurements()[2].axisLock).toBeNull();

    expect(internals.measureGroup.renderOrder).toBe(TAPE_MEASURE_RENDER_ORDER);
    let materialCount = 0;
    internals.measureGroup.traverse(obj => {
      if (obj !== internals.measureGroup) {
        expect(obj.renderOrder).toBe(TAPE_MEASURE_RENDER_ORDER);
      }
      const meshOrLine = obj as THREE.Mesh | THREE.Line | THREE.Sprite;
      if ('material' in meshOrLine && meshOrLine.material) {
        const mats = Array.isArray(meshOrLine.material) ? meshOrLine.material : [meshOrLine.material];
        for (const m of mats) {
          materialCount++;
          expect(m.depthTest).toBe(false);
          expect(m.depthWrite).toBe(false);
        }
      }
    });
    expect(materialCount).toBeGreaterThan(0);

    // Verificar colores/etiquetas de snap indicator y propiedades renderOrder=995 + depthWrite=false + Inter sans
    const fontsUsed: string[] = [];
    const textsDrawn: string[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
      const mockCtx = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        textAlign: 'left',
        textBaseline: 'alphabetic',
        _font: '',
        set font(v: string) {
          this._font = v;
          fontsUsed.push(v);
        },
        get font() {
          return this._font;
        },
        beginPath: vi.fn(),
        roundRect: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn((text: string) => {
          textsDrawn.push(text);
        })
      };
      return mockCtx as unknown as CanvasRenderingContext2D;
    });

    // Snap real sobre esquina, punto medio, arista y cara
    const cornerScreen = projectToClient(internals.camera, { x: -400, y: 600, z: 10 });
    const cornerSnap = internals.findMeasureSnapCandidateAt(cornerScreen.clientX, cornerScreen.clientY);
    expect(cornerSnap?.type).toBe('corner');
    expect(cornerSnap?.label).toBe(SNAP_LABELS.corner);
    expect(cornerSnap?.colorCss).toBe(SNAP_CSS_COLORS.corner);

    const midScreen = projectToClient(internals.camera, { x: 0, y: 600, z: 10 });
    const midSnap = internals.findMeasureSnapCandidateAt(midScreen.clientX, midScreen.clientY);
    expect(midSnap?.type).toBe('midpoint');
    expect(midSnap?.label).toBe(SNAP_LABELS.midpoint);
    expect(midSnap?.colorCss).toBe(SNAP_CSS_COLORS.midpoint);

    const edgeScreen = projectToClient(internals.camera, { x: 180, y: 600, z: 10 });
    const edgeSnap = internals.findMeasureSnapCandidateAt(edgeScreen.clientX, edgeScreen.clientY);
    expect(edgeSnap?.type).toBe('edge');
    expect(edgeSnap?.label).toBe(SNAP_LABELS.edge);
    expect(edgeSnap?.colorCss).toBe(SNAP_CSS_COLORS.edge);

    const faceScreen = projectToClient(internals.camera, { x: 110, y: 310, z: 10 });
    const faceSnap = internals.findMeasureSnapCandidateAt(faceScreen.clientX, faceScreen.clientY);
    expect(faceSnap?.type).toBe('face');
    expect(faceSnap?.label).toBe(SNAP_LABELS.face);
    expect(faceSnap?.colorCss).toBe(SNAP_CSS_COLORS.face);

    for (const snapCand of [cornerSnap!, midSnap!, edgeSnap!, faceSnap!]) {
      internals.updateMagneticSnapIndicator(snapCand);
      expect(internals.magneticSnapGroup.renderOrder).toBe(TAPE_MEASURE_RENDER_ORDER);
      internals.magneticSnapGroup.traverse(obj => {
        if (obj !== internals.magneticSnapGroup) {
          expect(obj.renderOrder).toBe(TAPE_MEASURE_RENDER_ORDER);
        }
        const mObj = obj as THREE.Mesh | THREE.Line | THREE.Sprite;
        if ('material' in mObj && mObj.material) {
          const mats = Array.isArray(mObj.material) ? mObj.material : [mObj.material];
          for (const m of mats) {
            expect(m.depthTest).toBe(false);
            expect(m.depthWrite).toBe(false);
          }
        }
      });
    }

    expect(textsDrawn.some(t => t.startsWith('Esquina'))).toBe(true);
    expect(textsDrawn.some(t => t.startsWith('Punto medio'))).toBe(true);
    expect(textsDrawn.some(t => t.startsWith('En arista'))).toBe(true);
    expect(textsDrawn.some(t => t.startsWith('En cara'))).toBe(true);
    expect(fontsUsed.every(f => f.includes('Inter') && !f.toLowerCase().includes('monospace'))).toBe(true);

    // Constantes de color esperadas en ejes
    expect(AXIS_COLORS.x).toBe(0xef4444);
    expect(AXIS_COLORS.y).toBe(0x10b981);
    expect(AXIS_COLORS.z).toBe(0x0284c7);
    expect(AXIS_COLORS.direct).toBe(0xd97706);
    expect(AXIS_CSS_COLORS.z).toBe('#0284C7');
  });

  it('reproyecta badges 2D con precision < 0.5px durante orbita completa de 360 grados', () => {
    setupSceneParts([buildSingleFrontPanel()]);
    component.setActiveTool('measure');

    // Medida superior horizontal X: midpoint = (0, 600, 10)
    clickWorldPoint({ x: -400, y: 600, z: 10 });
    clickWorldPoint({ x: 400, y: 600, z: 10 });
    expect(component.savedMeasurements().length).toBe(1);

    const midpoint = new THREE.Vector3(0, 600, 10);
    const radius = 1900;

    for (let deg = 0; deg < 360; deg += 45) {
      const rad = (deg * Math.PI) / 180;
      internals.camera.position.set(Math.sin(rad) * radius, 700, Math.cos(rad) * radius);
      internals.controls.target.set(0, 300, 0);
      internals.controls.update();
      internals.camera.lookAt(internals.controls.target);
      internals.camera.updateMatrixWorld(true);
      internals.updateProjectedMeasureBadges();
      fixture.detectChanges();

      const badges = component.projectedMeasureBadges();
      expect(badges.length).toBe(1);
      const projected = midpoint.clone().project(internals.camera);
      const expectedX = ((projected.x + 1) / 2) * VIEWPORT_RECT.width;
      const expectedY = ((-projected.y + 1) / 2) * VIEWPORT_RECT.height;

      expect(badges[0].visible).toBe(true);
      expect(Math.abs(badges[0].x - expectedX)).toBeLessThan(0.5);
      expect(Math.abs(badges[0].y - expectedY)).toBeLessThan(0.5);

      const badgeEl = fixture.nativeElement.querySelector(`[data-measure-id="${badges[0].id}"]`) as HTMLElement;
      expect(badgeEl).not.toBeNull();
      expect(parseFloat(badgeEl.style.left)).toBeCloseTo(expectedX, 1);
      expect(parseFloat(badgeEl.style.top)).toBeCloseTo(expectedY, 1);
    }

    // Cuando el punto medio queda detras de la camara, el badge debe marcarse visible=false
    internals.camera.position.set(0, 600, 300);
    internals.controls.target.set(0, 600, 1000); // mirando hacia +Z lejos de midpoint Z=10
    internals.camera.lookAt(internals.controls.target);
    internals.camera.updateMatrixWorld(true);
    internals.updateProjectedMeasureBadges();
    fixture.detectChanges();

    expect(component.projectedMeasureBadges()[0].visible).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('[data-measure-id]').length).toBe(0);
  });
});
