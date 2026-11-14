import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import * as THREE from 'three';
import {
  Furniture3dViewerComponent,
  DimensionBadgeUserData
} from './furniture-3d-viewer';

interface TestGizmoHitData {
  isGizmo: boolean;
  type: 'axis' | 'stretch' | 'corner_handle' | 'edge_handle';
  axis?: 'x' | 'y' | 'z';
  cursor?: string;
}

interface TestWallGizmoHitData {
  isWallGizmo: boolean;
  type: 'wall_move' | 'wall_stretch' | 'wall_stretch_height';
  gizmoType?: 'wall_move' | 'wall_stretch' | 'wall_stretch_height';
  axis?: 'x' | 'y' | 'z';
  wallTarget?: string;
  wallId?: string;
}
import {
  ApplianceItem,
  DEFAULT_ROOM_CONFIG,
  Material,
  Part,
  PartGroup,
  RoomConfiguration
} from '../../models/melamine.models';
import { ProjectStorageService } from '../../services/project-storage.service';
import { PartGeometryService } from '../../services/part-geometry.service';
import { SceneRaycastPickerService } from '../../services/scene-raycast-picker.service';

interface ViewerPieceEntry {
  part: Part;
  mesh: THREE.Mesh;
  originalPos: THREE.Vector3;
  explodedOffset: THREE.Vector3;
  isDoor?: boolean;
  isDrawer?: boolean;
  doorPivot?: THREE.Group;
}

interface ViewerTestInternals {
  ngZone: { run: (fn: () => void) => void };
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: {
    enabled: boolean;
    target: THREE.Vector3;
    getAzimuthalAngle: () => number;
    update: () => boolean;
    dispose: () => void;
  };
  raycaster: THREE.Raycaster;
  initThree: () => void;
  canvasRef: () => { nativeElement: HTMLCanvasElement };
  containerRef: () => { nativeElement: HTMLElement };
  furnitureGroup: THREE.Group;
  drillGroup: THREE.Group;
  gizmoGroup: THREE.Group;
  dimensionGroup: THREE.Group;
  roomGroup: THREE.Group;
  wallGizmoGroup: THREE.Group;
  appliancesGroup: THREE.Group;
  applianceGizmoGroup: THREE.Group;
  referenceGuideGroup: THREE.Group;
  pieceObjects: ViewerPieceEntry[];
  pieceObjectMap: Map<string, ViewerPieceEntry>;
  raycastablePieceMeshes: THREE.Mesh[];
  gizmoHitMeshes: THREE.Object3D[];
  wallGizmoHitMeshes: THREE.Object3D[];
  applianceHandleHitMeshes: THREE.Object3D[];
  editableDimensionSprites: THREE.Sprite[];
  isApplianceDragging: boolean;
  isReferenceGuideDragging: boolean;
  isDirectPieceDrag: boolean;
  isWallDragging: boolean;
  isWallGizmoDragging: boolean;
  isApplianceResizing: boolean;
  isDragging: boolean;
  lastHoverRaycastTime: number;
  rightPointerDownTime: number;
  rightPointerDragged: boolean;
  selectedWallType: { set: (val: string | null) => void; (): string | null };
  buildFurnitureScene: (
    parts: Part[],
    selectedIds: string[],
    materials: Material[],
    isXRay: boolean,
    showDims: boolean
  ) => void;
  updateRoomScene: (mode: 'module' | 'room', config: RoomConfiguration) => void;
  updateWallGizmo: (
    wallType: string | null,
    config: RoomConfiguration,
    mode: 'module' | 'room',
    liveOverrides?: Partial<RoomConfiguration>
  ) => void;
  updateAppliancesScene: (appls: ApplianceItem[], selectedId: string | null) => void;
  updateReferenceGuideScene: () => void;
  updateExplodedOffsets: (percent: number) => void;
  updateLiveWallTransform: (
    wallId: string,
    posX: number,
    posZ: number,
    wallHeight?: number
  ) => void;
  updateLiveWallGeometryAndGizmo: (
    activeWall: NonNullable<RoomConfiguration['walls']>[number],
    overrides: Partial<NonNullable<RoomConfiguration['walls']>[number]>
  ) => void;
  previewPartUpdatesInPlace: (
    partUpdates: { part: Part; updates: Partial<Part> }[],
    appUpdates?: { id: string; updates: Partial<ApplianceItem> }[],
    primaryAppUpdate?: { appliance: ApplianceItem; updates: Partial<ApplianceItem> } | null
  ) => void;
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: () => void;
  onContextMenu: (e: MouseEvent) => void;
  handleShiftClickSelection: (e: PointerEvent) => void;
}

function makePart(overrides: Partial<Part> & { id: string }): Part {
  return {
    name: `Pieza ${overrides.id}`,
    length: 600,
    width: 600,
    thickness: 18,
    quantity: 1,
    materialId: 'mat-white',
    materialName: 'Blanco 18mm',
    grain: 'length',
    edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
    posX: 0,
    posY: 400,
    posZ: 0,
    orientation: 'vertical_xy',
    componentRole: 'door',
    ...overrides
  };
}

function makeAppliance(overrides: Partial<ApplianceItem> & { id: string }): ApplianceItem {
  return {
    type: 'refrigerator',
    name: `Equipo ${overrides.id}`,
    width: 800,
    height: 1800,
    depth: 700,
    finish: 'stainless_steel',
    position: { x: 0, y: 0, z: -600 },
    rotation: 0,
    mountType: 'floor',
    price: 0,
    includeInBudget: false,
    ...overrides
  };
}

function createRoomWithFrontWall(
  wallOverrides: Partial<NonNullable<RoomConfiguration['walls']>[number]> = {}
): RoomConfiguration {
  return {
    ...DEFAULT_ROOM_CONFIG,
    showFloorGrid: true,
    walls: [
      {
        id: 'wall-front',
        name: 'Muro Frontal',
        length: 2000,
        height: 2400,
        thickness: 150,
        posX: 0,
        posZ: 900,
        rotationY: 0,
        showSkirting: false,
        ...wallOverrides
      }
    ]
  };
}

function projectToClient(
  worldPos: THREE.Vector3,
  camera: THREE.PerspectiveCamera
): { clientX: number; clientY: number } {
  camera.updateMatrixWorld(true);
  const ndc = worldPos.clone().project(camera);
  return {
    clientX: ((ndc.x + 1) / 2) * 800,
    clientY: ((1 - ndc.y) / 2) * 600
  };
}

function createPointerEvent(
  clientX: number,
  clientY: number,
  init: Partial<PointerEventInit> = {}
): PointerEvent {
  return {
    clientX,
    clientY,
    button: init.button ?? 0,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  } as unknown as PointerEvent;
}

function createMouseEvent(clientX: number, clientY: number): MouseEvent {
  return {
    clientX,
    clientY,
    button: 2,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  } as unknown as MouseEvent;
}

describe('Furniture3dViewerComponent - Raycasting unificado por distancia mínima (strict hit.distance)', () => {
  let fixture: ComponentFixture<Furniture3dViewerComponent>;
  let component: Furniture3dViewerComponent;
  let internal: ViewerTestInternals;
  let mockCanvas: HTMLCanvasElement;
  let mockContainer: HTMLElement;

  let emittedPartsIds: string[][];
  let emittedSingleParts: (Part | null)[];
  let emittedPartMods: { part: Part; updates: Partial<Part> }[];
  let emittedAppliance: (ApplianceItem | null)[];
  let emittedApplianceIds: string[][];
  let emittedWalls: (string | null)[];

  const setupCameraAt = (pos: [number, number, number], target: [number, number, number] = [0, 500, 0]) => {
    internal.camera.position.set(pos[0], pos[1], pos[2]);
    internal.camera.lookAt(target[0], target[1], target[2]);
    internal.camera.updateProjectionMatrix();
    internal.camera.updateMatrixWorld(true);
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Furniture3dViewerComponent],
      providers: [ProjectStorageService, PartGeometryService, SceneRaycastPickerService]
    });

    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as ViewerTestInternals,
      'initThree'
    ).mockImplementation(() => {
      // Inicialización headless manejada en el beforeEach para evitar WebGLRenderer real en jsdom
    });

    fixture = TestBed.createComponent(Furniture3dViewerComponent);
    component = fixture.componentInstance;
    internal = component as unknown as ViewerTestInternals;

    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 800;
    mockCanvas.height = 600;
    Object.defineProperty(mockCanvas, 'getBoundingClientRect', {
      value: () =>
        ({
          left: 0,
          top: 0,
          width: 800,
          height: 600,
          right: 800,
          bottom: 600,
          x: 0,
          y: 0,
          toJSON: () => ({})
        }) as DOMRect
    });
    mockCanvas.setPointerCapture = vi.fn();
    mockCanvas.releasePointerCapture = vi.fn();

    mockContainer = document.createElement('div');
    Object.defineProperty(mockContainer, 'getBoundingClientRect', {
      value: () =>
        ({
          left: 0,
          top: 0,
          width: 800,
          height: 600,
          right: 800,
          bottom: 600,
          x: 0,
          y: 0,
          toJSON: () => ({})
        }) as DOMRect
    });

    internal.ngZone = { run: (fn: () => void) => fn() };
    internal.scene = new THREE.Scene();
    internal.scene.add(
      internal.furnitureGroup,
      internal.drillGroup,
      internal.gizmoGroup,
      internal.dimensionGroup,
      internal.roomGroup,
      internal.wallGizmoGroup,
      internal.appliancesGroup,
      internal.applianceGizmoGroup,
      internal.referenceGuideGroup
    );
    internal.camera = new THREE.PerspectiveCamera(45, 800 / 600, 1.5, 80000);
    setupCameraAt([0, 600, 2600], [0, 500, 0]);
    internal.renderer = {
      domElement: mockCanvas,
      shadowMap: { enabled: false, type: THREE.PCFSoftShadowMap, needsUpdate: false },
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn()
    } as unknown as THREE.WebGLRenderer;
    internal.controls = {
      enabled: true,
      target: new THREE.Vector3(0, 500, 0),
      getAzimuthalAngle: () => 0,
      update: () => false,
      dispose: vi.fn()
    };
    internal.canvasRef = () => ({ nativeElement: mockCanvas });
    internal.containerRef = () => ({ nativeElement: mockContainer });
    internal.lastHoverRaycastTime = 0;
    internal.rightPointerDownTime = Date.now();
    internal.rightPointerDragged = false;

    emittedPartsIds = [];
    emittedSingleParts = [];
    emittedPartMods = [];
    emittedAppliance = [];
    emittedApplianceIds = [];
    emittedWalls = [];

    component.partsSelected.subscribe(ids => emittedPartsIds.push(ids));
    component.partSelected.subscribe(p => emittedSingleParts.push(p));
    component.partModified.subscribe(mod => emittedPartMods.push(mod));
    component.applianceSelected.subscribe(a => emittedAppliance.push(a));
    component.appliancesSelected.subscribe(ids => emittedApplianceIds.push(ids));
    component.wallSelected.subscribe(w => emittedWalls.push(w));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fixture.destroy();
  });

  it('selecciona el tablero de melamina en primer plano cuando hay una nevera detrás en el mismo rayo (onPointerDown, hover, onContextMenu, Shift+Click y rotate_90)', () => {
    const frontBoard = makePart({
      id: 'board-front',
      name: 'Puerta Frontal',
      length: 500,
      width: 500,
      thickness: 18,
      posX: 0,
      posY: 600,
      posZ: 600,
      orientation: 'vertical_xy'
    });
    const backFridge = makeAppliance({
      id: 'fridge-back',
      name: 'Nevera Empotrada',
      width: 1100,
      height: 1800,
      depth: 700,
      position: { x: 0, y: 0, z: -200 }
    });

    fixture.componentRef.setInput('parts', [frontBoard]);
    fixture.componentRef.setInput('appliances', [backFridge]);
    fixture.componentRef.setInput('selectedApplianceId', backFridge.id);
    fixture.componentRef.setInput('selectedApplianceIds', [backFridge.id]);
    fixture.detectChanges();

    internal.buildFurnitureScene([frontBoard], [], [], false, false);
    internal.updateAppliancesScene([backFridge], backFridge.id);

    const centerPt = new THREE.Vector3(0, 600, 609);
    const { clientX, clientY } = projectToClient(centerPt, internal.camera);

    // 1. Hover debe reflejar la pieza en primer plano ('pointer' o 'grab' de pieza), sin errores
    internal.lastHoverRaycastTime = 0;
    component.activeTool.set('select');
    internal.onPointerMove(createPointerEvent(clientX, clientY));
    expect(mockCanvas.style.cursor).toBe('pointer');

    // 2. Clic izquierdo debe seleccionar el tablero frontal y limpiar la nevera que estaba detrás
    internal.onPointerDown(createPointerEvent(clientX, clientY));
    expect(emittedPartsIds.at(-1)).toEqual(['board-front']);
    expect(emittedSingleParts.at(-1)?.id).toBe('board-front');
    expect(emittedAppliance.at(-1)).toBeNull();
    expect(emittedApplianceIds.at(-1)).toEqual([]);
    expect(internal.isApplianceDragging).toBe(false);

    // 3. Clic derecho sobre el mismo rayo debe abrir menú contextual del tablero, NO del electrodoméstico
    internal.rightPointerDownTime = Date.now();
    internal.rightPointerDragged = false;
    component.onContextMenu(createMouseEvent(clientX, clientY));
    expect(component.contextMenuPart()?.id).toBe('board-front');
    expect(component.contextMenuAppliance()).toBeNull();

    // 4. Shift+Click alterna el tablero frontal y nunca la nevera detrás
    emittedPartsIds.length = 0;
    emittedApplianceIds.length = 0;
    fixture.componentRef.setInput('selectedPartIds', ['board-front']);
    fixture.componentRef.setInput('selectedPartId', 'board-front');
    fixture.componentRef.setInput('selectedApplianceIds', []);
    fixture.componentRef.setInput('selectedApplianceId', null);
    fixture.detectChanges();

    internal.handleShiftClickSelection(createPointerEvent(clientX, clientY, { shiftKey: true }));
    expect(emittedPartsIds.at(-1)).toEqual([]);
    expect(emittedSingleParts.at(-1)).toBeNull();
    expect(emittedApplianceIds.at(-1)).toEqual([]);

    // 5. Herramienta rotate_90 rota el tablero frontal a pesar de la nevera ocluida detrás
    component.activeTool.set('rotate_90');
    internal.onPointerDown(createPointerEvent(clientX, clientY));
    expect(emittedPartMods.length).toBe(1);
    expect(emittedPartMods[0].part.id).toBe('board-front');
  });

  it('impide que rotate_90 o onContextMenu atraviesen un electrodoméstico en primer plano hacia un tablero oculto detrás', () => {
    const backBoard = makePart({
      id: 'board-behind',
      name: 'Fondo Oculto',
      length: 500,
      width: 500,
      thickness: 18,
      posX: 0,
      posY: 600,
      posZ: -600,
      orientation: 'vertical_xy'
    });
    const frontFridge = makeAppliance({
      id: 'fridge-front',
      name: 'Nevera Delantera',
      width: 900,
      height: 1800,
      depth: 700,
      position: { x: 0, y: 0, z: 500 }
    });

    fixture.componentRef.setInput('parts', [backBoard]);
    fixture.componentRef.setInput('appliances', [frontFridge]);
    fixture.detectChanges();

    internal.buildFurnitureScene([backBoard], [], [], false, false);
    internal.updateAppliancesScene([frontFridge], null);

    const fridgeFrontPt = new THREE.Vector3(0, 600, 850);
    const { clientX, clientY } = projectToClient(fridgeFrontPt, internal.camera);

    // rotate_90 NO debe atravesar la nevera ni rotar el fondo oculto
    component.activeTool.set('rotate_90');
    internal.onPointerDown(createPointerEvent(clientX, clientY));
    expect(emittedPartMods.length).toBe(0);
    expect(internal.isApplianceDragging).toBe(false);

    // Clic normal sí selecciona la nevera delantera
    component.activeTool.set('select');
    internal.onPointerDown(createPointerEvent(clientX, clientY));
    expect(emittedAppliance.at(-1)?.id).toBe('fridge-front');
    expect(emittedApplianceIds.at(-1)).toEqual(['fridge-front']);
    expect(emittedPartsIds.at(-1)).toEqual([]);

    // Clic derecho abre el menú de la nevera delantera
    internal.rightPointerDownTime = Date.now();
    internal.rightPointerDragged = false;
    component.onContextMenu(createMouseEvent(clientX, clientY));
    expect(component.contextMenuAppliance()?.id).toBe('fridge-front');
    expect(component.contextMenuPart()).toBeNull();
  });

  it('selecciona y abre menú de la zona expuesta lateral del electrodoméstico detrás del tablero', () => {
    const narrowBoard = makePart({
      id: 'narrow-board',
      length: 400,
      width: 500,
      thickness: 18,
      posX: 0,
      posY: 600,
      posZ: 600,
      orientation: 'vertical_xy'
    });
    const wideFridge = makeAppliance({
      id: 'wide-fridge',
      width: 1400,
      height: 1800,
      depth: 700,
      position: { x: 0, y: 0, z: -200 }
    });

    fixture.componentRef.setInput('parts', [narrowBoard]);
    fixture.componentRef.setInput('appliances', [wideFridge]);
    fixture.detectChanges();

    internal.buildFurnitureScene([narrowBoard], [], [], false, false);
    internal.updateAppliancesScene([wideFridge], null);

    // Apuntar al lateral derecho expuesto de la nevera (x = 550 mm, fuera de [-200..+200])
    const exposedSidePt = new THREE.Vector3(550, 600, 150);
    const { clientX, clientY } = projectToClient(exposedSidePt, internal.camera);

    internal.lastHoverRaycastTime = 0;
    internal.onPointerMove(createPointerEvent(clientX, clientY));
    expect(mockCanvas.style.cursor).toBe('grab');

    internal.onPointerDown(createPointerEvent(clientX, clientY));
    expect(emittedAppliance.at(-1)?.id).toBe('wide-fridge');
    expect(emittedApplianceIds.at(-1)).toEqual(['wide-fridge']);
    expect(internal.isApplianceDragging).toBe(true);
  });

  it('respeta oclusión bidireccional muro vs tablero (muro delante gana sin emitir partsSelected; tablero delante gana al muro detrás)', () => {
    const occludedBoard = makePart({
      id: 'board-behind-wall',
      length: 600,
      width: 600,
      thickness: 18,
      posX: -400,
      posY: 600,
      posZ: 100,
      orientation: 'vertical_xy'
    });
    const foregroundBoard = makePart({
      id: 'board-in-front-of-wall',
      length: 600,
      width: 600,
      thickness: 18,
      posX: 400,
      posY: 600,
      posZ: 1300,
      orientation: 'vertical_xy'
    });
    const roomCfg = createRoomWithFrontWall({ posX: 0, posZ: 900 });

    fixture.componentRef.setInput('workspaceMode', 'room');
    fixture.componentRef.setInput('roomConfig', roomCfg);
    fixture.componentRef.setInput('parts', [occludedBoard, foregroundBoard]);
    fixture.detectChanges();

    internal.updateRoomScene('room', roomCfg);
    internal.buildFurnitureScene([occludedBoard, foregroundBoard], [], [], false, false);

    // Caso A: clic sobre el área donde el muro frontal (z=900) tapa al tablero (z=100)
    const wallPoint = new THREE.Vector3(-400, 600, 975);
    const wallCoords = projectToClient(wallPoint, internal.camera);

    // Hover sobre el muro marca cursor 'grab' de muro desbloqueado
    internal.lastHoverRaycastTime = 0;
    internal.onPointerMove(createPointerEvent(wallCoords.clientX, wallCoords.clientY));
    expect(mockCanvas.style.cursor).toBe('grab');

    internal.onPointerDown(createPointerEvent(wallCoords.clientX, wallCoords.clientY));
    expect(emittedWalls.at(-1)).toBe('wall-front');
    expect(emittedPartsIds.length).toBe(0);
    internal.onPointerUp();

    // Clic derecho sobre el muro NO abre menú del tablero oculto detrás
    internal.rightPointerDownTime = Date.now();
    internal.rightPointerDragged = false;
    component.onContextMenu(createMouseEvent(wallCoords.clientX, wallCoords.clientY));
    expect(component.contextMenuPart()).toBeNull();
    expect(component.contextMenuAppliance()).toBeNull();

    // Shift+Click sobre el muro NO agrega el tablero oculto detrás
    internal.handleShiftClickSelection(
      createPointerEvent(wallCoords.clientX, wallCoords.clientY, { shiftKey: true })
    );
    expect(emittedPartsIds.length).toBe(0);

    // Caso B: tablero en z=1300 delante del muro en z=900 gana sobre el muro detrás
    emittedWalls.length = 0;
    const frontBoardPoint = new THREE.Vector3(400, 600, 1309);
    const frontBoardCoords = projectToClient(frontBoardPoint, internal.camera);
    internal.onPointerDown(createPointerEvent(frontBoardCoords.clientX, frontBoardCoords.clientY));
    expect(emittedPartsIds.at(-1)).toEqual(['board-in-front-of-wall']);
    expect(emittedWalls.includes('wall-front')).toBe(false);
  });

  it('permite arrastrar la guía humana en primer plano e ignora elementos auxiliares (anillos de suelo, wireframes, hitbox GLB y grupos ocultos)', () => {
    const boardBehind = makePart({
      id: 'board-behind-aux',
      length: 900,
      width: 900,
      thickness: 18,
      posX: 0,
      posY: 450,
      posZ: -500,
      orientation: 'vertical_xy'
    });
    const selectedApp = makeAppliance({
      id: 'app-aux',
      width: 500,
      height: 500,
      depth: 500,
      position: { x: 800, y: 0, z: -200 }
    });

    fixture.componentRef.setInput('parts', [boardBehind]);
    fixture.componentRef.setInput('appliances', [selectedApp]);
    fixture.componentRef.setInput('selectedApplianceId', selectedApp.id);
    fixture.detectChanges();

    internal.buildFurnitureScene([boardBehind], [], [], false, false);
    internal.updateAppliancesScene([selectedApp], selectedApp.id);

    // Insertar malla auxiliar isFloorCircle, isOutline, isApplianceHitBox y grupo oculto justo delante del tablero
    const blockerGroup = new THREE.Group();
    const floorRingBlocker = new THREE.Mesh(
      new THREE.BoxGeometry(800, 800, 20),
      new THREE.MeshBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.4 })
    );
    floorRingBlocker.position.set(0, 450, 700);
    floorRingBlocker.userData = { isFloorCircle: true, isAuxiliaryVisual: true };
    blockerGroup.add(floorRingBlocker);

    const hitBoxMesh = new THREE.Mesh(
      new THREE.BoxGeometry(800, 800, 20),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    hitBoxMesh.position.set(0, 450, 750);
    hitBoxMesh.userData = { isApplianceHitBox: true, isAppliance: true, applianceId: selectedApp.id };
    blockerGroup.add(hitBoxMesh);
    internal.appliancesGroup.add(blockerGroup);

    const hiddenGroup = new THREE.Group();
    hiddenGroup.visible = false;
    const hiddenMesh = new THREE.Mesh(
      new THREE.BoxGeometry(800, 800, 20),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    hiddenMesh.position.set(0, 450, 800);
    hiddenMesh.userData = { part: makePart({ id: 'hidden-part' }), isPiece: true };
    hiddenGroup.add(hiddenMesh);
    internal.furnitureGroup.add(hiddenGroup);

    const boardPt = new THREE.Vector3(0, 450, -491);
    const { clientX, clientY } = projectToClient(boardPt, internal.camera);

    // Ninguno de los visuales auxiliares / hitbox / ocultos debe tapar al tablero detrás
    internal.onPointerDown(createPointerEvent(clientX, clientY));
    expect(emittedPartsIds.at(-1)).toEqual(['board-behind-aux']);

    // Ahora activar el maniquí guía de escala humana en primer plano (z=600)
    component.showReferenceGuide.set(true);
    component.referenceGuidePos.set({ x: 0, z: 600 });
    internal.updateReferenceGuideScene();

    setupCameraAt([0, 1050, 2200], [0, 900, 0]);
    const guideTorsoPt = new THREE.Vector3(0, 1050, 600);
    const guideCoords = projectToClient(guideTorsoPt, internal.camera);

    internal.onPointerDown(createPointerEvent(guideCoords.clientX, guideCoords.clientY));
    expect(component.isReferenceGuideSelected()).toBe(true);
    expect(internal.isReferenceGuideDragging).toBe(true);
  });

  it('da Prioridad 1 absoluta a gizmos visibles (piezas, muros con collider opacity:0, electrodomésticos y sprites de cota) e ignora gizmos con ancestro visible=false', () => {
    const frontBoard = makePart({
      id: 'solid-board',
      length: 600,
      width: 600,
      thickness: 18,
      posX: 0,
      posY: 500,
      posZ: 500,
      orientation: 'vertical_xy'
    });
    fixture.componentRef.setInput('parts', [frontBoard]);
    fixture.componentRef.setInput('selectedPartIds', ['solid-board']);
    fixture.componentRef.setInput('selectedPartId', 'solid-board');
    fixture.detectChanges();

    internal.buildFurnitureScene([frontBoard], ['solid-board'], [], false, false);

    // 1. Collider transparente opacity:0 de Wall Gizmo (Prioridad 1) detrás de malla sólida
    const roomCfg = createRoomWithFrontWall({ posZ: -800 });
    fixture.componentRef.setInput('workspaceMode', 'room');
    fixture.componentRef.setInput('roomConfig', roomCfg);
    fixture.detectChanges();
    internal.updateRoomScene('room', roomCfg);

    const wallCollider = new THREE.Mesh(
      new THREE.BoxGeometry(200, 200, 40),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    wallCollider.position.set(0, 500, 100); // Detrás del tablero en z=500, sigue siendo Prioridad 1!
    const wallHitData: TestWallGizmoHitData = {
      isWallGizmo: true,
      type: 'wall_move',
      gizmoType: 'wall_move',
      axis: 'x',
      wallTarget: 'wall-front',
      wallId: 'wall-front'
    };
    wallCollider.userData = wallHitData;
    const wallGizmoParent = new THREE.Group();
    wallGizmoParent.add(wallCollider);
    internal.wallGizmoGroup.add(wallGizmoParent);
    internal.wallGizmoHitMeshes = [wallCollider];

    const centerPt = new THREE.Vector3(0, 500, 500);
    const { clientX, clientY } = projectToClient(centerPt, internal.camera);

    internal.onPointerDown(createPointerEvent(clientX, clientY));
    expect(internal.isWallGizmoDragging).toBe(true);
    internal.isWallGizmoDragging = false;
    internal.controls.enabled = true;

    // Si el grupo padre del wall gizmo está oculto (visible = false), debe ignorarse y seleccionar el tablero
    wallGizmoParent.visible = false;
    internal.onPointerDown(createPointerEvent(clientX, clientY));
    expect(internal.isWallGizmoDragging).toBe(false);
    expect(emittedPartsIds.at(-1)).toEqual(['solid-board']);

    // 2. Gizmo de pieza (Priority 1) gana sobre tablero sólido
    internal.wallGizmoHitMeshes = [];
    const gizmoMesh = new THREE.Mesh(
      new THREE.BoxGeometry(120, 120, 40),
      new THREE.MeshBasicMaterial({ color: 0x0284c7 })
    );
    gizmoMesh.position.set(0, 500, 200);
    const gizmoData: TestGizmoHitData = {
      isGizmo: true,
      type: 'axis',
      axis: 'x',
      cursor: 'grab'
    };
    gizmoMesh.userData = gizmoData;
    internal.gizmoGroup.add(gizmoMesh);
    internal.gizmoHitMeshes = [gizmoMesh];

    internal.onPointerDown(createPointerEvent(clientX, clientY));
    expect(internal.isDragging).toBe(true);
    internal.isDragging = false;
    internal.gizmoHitMeshes = [];

    // 3. Sprite de cota editable (Priority 1) gana sobre tablero sólido
    const badgeMat = new THREE.SpriteMaterial({ color: 0xffffff });
    const badgeSprite = new THREE.Sprite(badgeMat);
    badgeSprite.position.set(0, 500, 600);
    badgeSprite.scale.set(300, 120, 1);
    const badgeData: DimensionBadgeUserData = {
      isDimensionBadge: true,
      badgeType: 'length',
      part: frontBoard,
      currentValue: 600,
      label: '600 mm'
    };
    badgeSprite.userData = badgeData;
    internal.dimensionGroup.add(badgeSprite);
    internal.dimensionGroup.updateMatrixWorld(true);
    internal.editableDimensionSprites = [badgeSprite];

    internal.onPointerDown(createPointerEvent(clientX, clientY));
    expect(component.inlineDimensionEditor()?.part.id).toBe('solid-board');
    internal.editableDimensionSprites = [];
    component.cancelInlineDimension();

    // 4. Tirador de electrodoméstico (Priority 1) gana sobre tablero sólido
    const appItem = makeAppliance({ id: 'app-resize', position: { x: 0, y: 0, z: 100 } });
    fixture.componentRef.setInput('appliances', [appItem]);
    fixture.detectChanges();

    const appHandle = new THREE.Mesh(
      new THREE.BoxGeometry(160, 160, 40),
      new THREE.MeshBasicMaterial({ color: 0x0284c7 })
    );
    appHandle.position.set(0, 500, 200);
    appHandle.userData = {
      isApplianceHandle: true,
      appliance: appItem,
      axis: 'x',
      direction: 1
    };
    internal.applianceGizmoGroup.add(appHandle);
    internal.applianceHandleHitMeshes = [appHandle];

    internal.onPointerDown(createPointerEvent(clientX, clientY));
    expect(internal.isApplianceResizing).toBe(true);
  });

  it('preserva selección indivisible de cajón modular y deselección de pieza aislada con Shift+Click', () => {
    const drawerGroup: PartGroup = {
      id: 'drawer-grp-1',
      name: 'Cajón Modular 1',
      type: 'drawer',
      templateId: 'modular_drawer'
    };
    const drawerFront = makePart({
      id: 'drawer-front',
      groupId: 'drawer-grp-1',
      componentRole: 'drawer_front',
      length: 500,
      width: 220,
      thickness: 18,
      posX: -350,
      posY: 400,
      posZ: 400
    });
    const drawerBottom = makePart({
      id: 'drawer-bottom',
      groupId: 'drawer-grp-1',
      componentRole: 'drawer_bottom',
      orientation: 'horizontal',
      length: 460,
      width: 400,
      thickness: 15,
      posX: -350,
      posY: 320,
      posZ: 200
    });

    const modGroup: PartGroup = {
      id: 'std-mod',
      name: 'Módulo Estándar',
      type: 'assembly'
    };
    const stdPartA = makePart({
      id: 'std-a',
      groupId: 'std-mod',
      length: 400,
      width: 600,
      thickness: 18,
      posX: 400,
      posY: 500,
      posZ: 400
    });
    const stdPartB = makePart({
      id: 'std-b',
      groupId: 'std-mod',
      length: 400,
      width: 600,
      thickness: 18,
      posX: 900,
      posY: 500,
      posZ: 400
    });

    fixture.componentRef.setInput('partGroups', [drawerGroup, modGroup]);
    fixture.componentRef.setInput('parts', [drawerFront, drawerBottom, stdPartA, stdPartB]);
    fixture.detectChanges();

    internal.buildFurnitureScene([drawerFront, drawerBottom, stdPartA, stdPartB], [], [], false, false);

    // 1. Shift+Click en un frente de cajón modular selecciona todo el cajón indivisibly
    const drawerPt = new THREE.Vector3(-350, 400, 409);
    const drawerCoords = projectToClient(drawerPt, internal.camera);
    internal.handleShiftClickSelection(
      createPointerEvent(drawerCoords.clientX, drawerCoords.clientY, { shiftKey: true })
    );
    expect(emittedPartsIds.at(-1)?.sort()).toEqual(['drawer-bottom', 'drawer-front']);

    // 2. Pieza estándar aislada (selectedPartIds = ['std-a']): Shift+Click la deselecciona limpiamente
    fixture.componentRef.setInput('selectedPartIds', ['std-a']);
    fixture.componentRef.setInput('selectedPartId', 'std-a');
    fixture.detectChanges();

    const stdAPt = new THREE.Vector3(400, 500, 409);
    const stdACoords = projectToClient(stdAPt, internal.camera);
    internal.handleShiftClickSelection(
      createPointerEvent(stdACoords.clientX, stdACoords.clientY, { shiftKey: true })
    );
    expect(emittedPartsIds.at(-1)).toEqual([]);
    expect(emittedSingleParts.at(-1)).toBeNull();
  });

  it('sincroniza matrixWorld y boundingBox/boundingSphere inmediatamente tras movimientos/redimensionados/explosión en vivo para raycasting inmediato', () => {
    const movableBoard = makePart({
      id: 'live-board',
      length: 300,
      width: 300,
      thickness: 18,
      posX: -500,
      posY: 500,
      posZ: 400,
      orientation: 'vertical_xy'
    });
    const roomCfg = createRoomWithFrontWall({ posX: 0, posZ: -400 });

    fixture.componentRef.setInput('workspaceMode', 'room');
    fixture.componentRef.setInput('roomConfig', roomCfg);
    fixture.componentRef.setInput('parts', [movableBoard]);
    fixture.detectChanges();

    internal.buildFurnitureScene([movableBoard], ['live-board'], [], false, false);
    internal.updateRoomScene('room', roomCfg);

    // Trasladar y ensanchar la pieza en vivo a posX=500, length=600 sin reconstruir la escena
    internal.previewPartUpdatesInPlace([
      { part: movableBoard, updates: { posX: 500, length: 600 } }
    ]);

    const newRightEdgePt = new THREE.Vector3(720, 500, 409);
    const newCoords = projectToClient(newRightEdgePt, internal.camera);
    internal.onPointerDown(createPointerEvent(newCoords.clientX, newCoords.clientY));
    expect(emittedPartsIds.at(-1)).toEqual(['live-board']);

    // La antigua posición x=-500 ya no debe interceptar la pieza
    emittedPartsIds.length = 0;
    const oldPosPt = new THREE.Vector3(-500, 500, 409);
    const oldCoords = projectToClient(oldPosPt, internal.camera);
    internal.onPointerDown(createPointerEvent(oldCoords.clientX, oldCoords.clientY));
    expect(emittedPartsIds.at(-1)).not.toEqual(['live-board']);

    // Trasladar y alargar el muro en vivo manteniendo z=-400 y verificar clic inmediato sobre la nueva extensión lateral
    const wallObj = roomCfg.walls![0];
    internal.updateLiveWallTransform(wallObj.id, 0, -400, 2400);
    internal.updateLiveWallGeometryAndGizmo(wallObj, { length: 3000, posX: 0, posZ: -400 });

    const newWallExtPt = new THREE.Vector3(1200, 600, -325);
    const wallExtCoords = projectToClient(newWallExtPt, internal.camera);
    internal.onPointerDown(createPointerEvent(wallExtCoords.clientX, wallExtCoords.clientY));
    expect(emittedWalls.at(-1)).toBe('wall-front');
    internal.onPointerUp();

    // Vista explotada actualiza matrices al instante
    emittedPartsIds.length = 0;
    const pieceEntry = internal.pieceObjectMap.get('live-board')!;
    pieceEntry.explodedOffset.set(0, 600, 0);
    internal.updateExplodedOffsets(100);
    const explodedPt = new THREE.Vector3(500, 1100, 409);
    const explodedCoords = projectToClient(explodedPt, internal.camera);
    internal.onPointerDown(createPointerEvent(explodedCoords.clientX, explodedCoords.clientY));
    expect(emittedPartsIds.at(-1)).toEqual(['live-board']);
  });
});
