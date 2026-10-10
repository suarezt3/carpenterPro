import {
  Component,
  ElementRef,
  viewChild,
  input,
  output,
  signal,
  computed,
  ChangeDetectionStrategy,
  afterNextRender,
  effect,
  untracked,
  OnDestroy,
  inject
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  Part, 
  PartGroup,
  Material, 
  DrillHole, 
  CollisionRecord, 
  EdgeBandingType, 
  PartHardwareConfig,
  HandleType,
  HandleFinish,
  HingeType,
  SlideType,
  OpeningDirection
} from '../../models/melamine.models';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';

interface PieceMeshData {
  part: Part;
  mesh: THREE.Mesh;
  originalPos: THREE.Vector3;
  explodedOffset: THREE.Vector3;
  isDoor?: boolean;
  isDrawer?: boolean;
  doorPivot?: THREE.Group;
  hingeSide?: 'left' | 'right' | 'top' | 'bottom';
  doorLocalMeshPos?: THREE.Vector3;
  doorPivotOriginalPos?: THREE.Vector3;
  handleGroup?: THREE.Group;
  hingeGroup?: THREE.Group;
  slideGroup?: THREE.Group;
  slideAxis?: 'x' | 'y' | 'z';
  slideDir?: number;
}

interface GizmoHitData {
  isGizmo: boolean;
  type: 'axis' | 'handle';
  axis?: 'x' | 'y' | 'z';
  handleTarget?: 'length' | 'width';
  dir: number;
}

export interface ClearanceInfo {
  topClearance: number | null;
  bottomClearance: number | null;
  leftClearance: number | null;
  rightClearance: number | null;
  topNeighborName: string | null;
  bottomNeighborName: string | null;
  leftNeighborName: string | null;
  rightNeighborName: string | null;
}

@Component({
  selector: 'app-furniture-3d-viewer',
  imports: [],
  templateUrl: './furniture-3d-viewer.html',
  styleUrls: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block w-full h-full',
    '(window:keydown)': 'handleViewerKeyDown($event)'
  }
})
export class Furniture3dViewerComponent implements OnDestroy {
  private joineryEngine = inject(JoineryEngineService);
  readonly hardwareCatalog = inject(HardwareCatalogService);

  // Inputs
  parts = input<Part[]>([]);
  selectedPartId = input<string | null>(null);
  selectedPartIds = input<string[]>([]);
  partGroups = input<PartGroup[]>([]);
  materials = input<Material[]>([]);

  // Outputs
  partSelected = output<Part | null>();
  partsSelected = output<string[]>();
  partModified = output<{ part: Part; updates: Partial<Part> }>();
  multiplePartsModified = output<{ updates: { part: Part; updates: Partial<Part> }[] }>();
  partCreated = output<Partial<Part>>();
  partDeleted = output<string>();
  partDuplicated = output<Part>();
  dragStarted = output<void>();
  clearanceCalculated = output<ClearanceInfo | null>();
  collisionsDetected = output<CollisionRecord[]>();
  drillHolesUpdated = output<DrillHole[]>();
  groupUngroupRequested = output<string>();
  drawerWizardRequested = output<void>();
  groupRotationRequested = output<{ groupId: string; deltaAngle: 90 | -90 | 180 }>();
  groupDuplicationRequested = output<string>();
  hiddenPartsChanged = output<string[]>();

  // Canvas and Container refs
  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas3d');
  containerRef = viewChild<ElementRef<HTMLDivElement>>('container3d');

  // Interactive View States
  isOpenFrentes = signal<boolean>(false);
  isXRay = signal<boolean>(false);
  explodedPercent = signal<number>(0);
  show3dDimensions = signal<boolean>(true);
  showClearances = signal<boolean>(true);
  showDrillHoles = signal<boolean>(true);
  showHardware = signal<boolean>(true); // Visualizar tiradores, bisagras y correderas 3D
  isWhiteTheme = signal<boolean>(true); // Default to clean pure white studio background

  // Hardware visibility per group / per part
  readonly hiddenHardwareGroupIds = signal<Set<string>>(new Set<string>());
  readonly hiddenHardwarePartIds = signal<Set<string>>(new Set<string>());

  // CAD Palette & Push/Pull State
  readonly activeTool = signal<'select' | 'push_pull' | 'move' | 'measure' | 'rotate_90' | 'draw_rect'>('select');
  readonly pushPullDelta = signal<{ axisName: string; initialVal: number; currentVal: number; delta: number } | null>(null);
  readonly hoveredFaceInfo = signal<{ partName: string; faceLabel: string; dimLabel: string } | null>(null);
  readonly showViewsDropdown = signal<boolean>(false);
  readonly showExplodedSlider = signal<boolean>(false);
  readonly showGroupsFlyout = signal<boolean>(false);

  // Right-Click Context Menu State
  readonly contextMenuPos = signal<{ x: number; y: number } | null>(null);
  readonly contextMenuPart = signal<Part | null>(null);
  readonly showQuickMaterialPicker = signal<boolean>(false);
  readonly showRotateSubmenu = signal<boolean>(false);
  readonly showMovableRoleSubmenu = signal<boolean>(false);
  readonly showHandleSubmenu = signal<boolean>(false);
  readonly showHingeSubmenu = signal<boolean>(false);
  readonly showSlideSubmenu = signal<boolean>(false);

  // Hidden / Isolated Parts
  readonly hiddenPartIds = signal<Set<string>>(new Set());

  // Draw 3D Rectangle Tool State
  readonly isDrawingRect = signal<boolean>(false);
  readonly rectDrawDims = signal<{ length: number; width: number } | null>(null);
  private rectStartPoint: THREE.Vector3 | null = null;
  private rectCurrentPoint: THREE.Vector3 | null = null;
  private rectPreviewGroup = new THREE.Group();

  // Collisions & Joinery Signals
  readonly detectedCollisions = signal<CollisionRecord[]>([]);
  readonly allDrillHoles = signal<DrillHole[]>([]);

  // Precision Nudge & Magnetic Snapping
  readonly isMagneticSnap = signal<boolean>(true);
  readonly nudgeStep = signal<number>(1); // 1 mm default (toggleable to 10mm)

  // 3D Measurement Tape / Ruler tool
  readonly isMeasureMode = signal<boolean>(false);
  readonly isMeasurementPersistent = signal<boolean>(false);
  readonly measurePointA = signal<{ x: number; y: number; z: number } | null>(null);
  readonly measurePointB = signal<{ x: number; y: number; z: number } | null>(null);
  readonly hasActiveMeasurement = computed(() => !!this.measurePointA() && !!this.measurePointB());
  readonly measureDistance = computed(() => {
    const a = this.measurePointA();
    const b = this.measurePointB();
    if (!a || !b) return null;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return {
      total: Math.round(dist * 10) / 10,
      dx: Math.round(Math.abs(dx) * 10) / 10,
      dy: Math.round(Math.abs(dy) * 10) / 10,
      dz: Math.round(Math.abs(dz) * 10) / 10
    };
  });

  // Active Selected Part IDs set
  readonly activeSelectedIds = computed<string[]>(() => {
    const multi = this.selectedPartIds();
    if (multi && multi.length > 0) return multi;
    const single = this.selectedPartId();
    return single ? [single] : [];
  });

  // Current selected group (if active selection belongs to a group)
  readonly currentSelectedGroup = computed<PartGroup | null>(() => {
    const ids = this.activeSelectedIds();
    if (ids.length === 0) return null;
    const parts = this.parts();
    for (const id of ids) {
      const p = parts.find(x => x.id === id);
      if (p?.groupId) {
        const g = this.partGroups().find(group => group.id === p.groupId);
        if (g) return g;
      }
    }
    return null;
  });

  // Active Selected Parts list (ensures all parts of a selected group are included for rigid translation & movement)
  readonly selectedParts = computed<Part[]>(() => {
    const ids = this.activeSelectedIds();
    const parts = this.parts();
    const grp = this.currentSelectedGroup();
    if (grp) {
      return parts.filter(p => p.groupId === grp.id || ids.includes(p.id));
    }
    return parts.filter(p => ids.includes(p.id));
  });

  // Check if current selection has hardware capabilities
  readonly hasHardwareSelected = computed<boolean>(() => {
    if (this.currentSelectedGroup()) return true;
    const sel = this.selectedPart();
    if (!sel) return false;
    return sel.componentRole === 'door' || 
           sel.componentRole === 'drawer_front' || 
           !!sel.hardwareConfig?.isMovable || 
           sel.name.toUpperCase().includes('FRENTE');
  });

  // Check if hardware of currently selected group / part is visible
  readonly isSelectedHardwareVisible = computed<boolean>(() => {
    const grp = this.currentSelectedGroup();
    if (grp) {
      return !this.hiddenHardwareGroupIds().has(grp.id);
    }
    const sel = this.selectedPart();
    if (sel) {
      return !this.hiddenHardwarePartIds().has(sel.id);
    }
    return false;
  });

  // Active saved groups that contain existing parts in the project
  readonly activePartGroups = computed<PartGroup[]>(() => {
    const grps = this.partGroups();
    const parts = this.parts();
    return grps.filter(g => parts.some(p => p.groupId === g.id));
  });

  // Interactive 3D Doors & Drawers Open/Close State
  readonly isAllOpen = signal<boolean>(false);
  openTargetMap = new Map<string, number>();
  openCurrentMap = new Map<string, number>();

  isPartOpen(partId: string): boolean {
    return (this.openTargetMap.get(partId) || 0) > 0.5;
  }

  // Active Selected Part (primary)
  readonly selectedPart = computed(() => {
    const list = this.selectedParts();
    return list.length > 0 ? list[0] : null;
  });

  updateSelectedPartDimension(prop: 'length' | 'width' | 'thickness', rawVal: string | number) {
    const part = this.selectedPart();
    if (!part) return;
    const val = Number(rawVal);
    if (isNaN(val) || val <= 0) return;
    this.partModified.emit({
      part,
      updates: { [prop]: Math.round(val) }
    });
  }

  readonly isMultiSelect = computed(() => this.activeSelectedIds().length > 1);

  // Three.js Core
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private animationFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Scene Groups
  private furnitureGroup = new THREE.Group();
  private dimensionGroup = new THREE.Group();
  private gizmoGroup = new THREE.Group();
  private measureGroup = new THREE.Group();
  private magneticSnapGroup = new THREE.Group();
  private drillGroup = new THREE.Group();
  private pushPullHighlightGroup = new THREE.Group();
  private gridHelper: THREE.GridHelper | null = null;
  private floorMesh: THREE.Mesh | null = null;

  // Mesh & Raycast Tracking
  private pieceObjects: PieceMeshData[] = [];
  private gizmoHitMeshes: THREE.Mesh[] = [];
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  // Dragging State
  private isDragging = false;
  private activeGizmoHit: GizmoHitData | null = null;
  private isDirectPieceDrag = false;
  private directPieceDragThresholdPassed = false;
  private dragStartPointer = { x: 0, y: 0 };
  private dragInitialPart: Part | null = null;
  private dragInitialParts: Part[] = [];
  private dragPlane = new THREE.Plane();
  private dragPlaneIntersectionStart = new THREE.Vector3();

  // Right-Click vs Pan/Orbit Detection State
  private rightPointerDownPos: { x: number; y: number } | null = null;
  private rightPointerDownTime = 0;
  private rightPointerDragged = false;

  // Tape Measure Drag State (Clic y arrastrar para estirar y soltar para fijar cota)
  private isMeasuringDrag = false;

  // Push / Pull Tool Interactive State
  private isPushPulling = false;
  private pushPullData: {
    part: Part;
    targetDim: 'length' | 'width' | 'thickness';
    posAxis: 'posX' | 'posY' | 'posZ';
    dir: number;
    initialDim: number;
    initialPos: number;
    axisVector: THREE.Vector3;
    normalVector: THREE.Vector3;
    faceCenter: THREE.Vector3;
  } | null = null;

  constructor() {
    afterNextRender(() => {
      this.initThree();
    });

    // 1. Rebuild 3D geometry ONLY when pieces, materials, xRay, dims, drill holes, hardware or hidden parts change
    effect(() => {
      const parts = this.parts();
      const mats = this.materials();
      const xRay = this.isXRay();
      const showDims = this.show3dDimensions();
      this.showDrillHoles();
      this.showHardware();
      this.activeTool();
      this.hiddenPartIds();

      if (this.scene) {
        // Read activeSelectedIds untracked so selection changes don't destroy and rebuild the 3D scene!
        const selIds = untracked(() => this.activeSelectedIds());
        this.buildFurnitureScene(parts, selIds, mats, xRay, showDims);
        this.updateExplodedOffsets(this.explodedPercent());
      }
    });

    // 2. High-performance selection highlights & gizmo update WITHOUT rebuilding the 3D scene
    effect(() => {
      const selIds = this.activeSelectedIds();
      const mats = this.materials();
      const xRay = this.isXRay();

      if (this.scene && this.pieceObjects.length > 0) {
        this.updateSelectionHighlights(selIds, mats, xRay);
      }
    });

    // Handle exploded view slider
    effect(() => {
      const exp = this.explodedPercent();
      this.updateExplodedOffsets(exp);
    });
  }

  private initThree() {
    const canvas = this.canvasRef()?.nativeElement;
    const container = this.containerRef()?.nativeElement;
    if (!canvas || !container) return;

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 650;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.applyThemeColors();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 10, 15000);
    this.camera.position.set(1500, 1100, 1900);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxDistance = 9000;
    this.controls.minDistance = 150;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.08;
    this.controls.target.set(0, 480, 0);

    // 5. Lighting
    this.setupLighting();

    // 6. Floor Grid & Shadow Plane
    this.setupFloorGrid();

    // 7. Add Groups
    this.scene.add(this.furnitureGroup);
    this.scene.add(this.dimensionGroup);
    this.scene.add(this.gizmoGroup);
    this.scene.add(this.measureGroup);
    this.scene.add(this.magneticSnapGroup);
    this.scene.add(this.drillGroup);
    this.scene.add(this.pushPullHighlightGroup);
    this.scene.add(this.rectPreviewGroup);

    // Initial Scene Build
    this.buildFurnitureScene(
      this.parts(),
      this.activeSelectedIds(),
      this.materials(),
      this.isXRay(),
      this.show3dDimensions()
    );

    // 8. Animation Loop
    this.animate();

    // 9. Resize Observer
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.onResize();
      });
      this.resizeObserver.observe(container);
    }

    // 10. Pointer Interactions (Selection, Gizmo Drag, Edge Handles)
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));
  }

  private applyThemeColors() {
    if (!this.scene) return;
    const isWhite = this.isWhiteTheme();

    if (isWhite) {
      // Clean pure studio white with soft contrast
      this.scene.background = new THREE.Color(0xfcfcfd);
      this.scene.fog = new THREE.FogExp2(0xfcfcfd, 0.00012);
      if (this.floorMesh) {
        (this.floorMesh.material as THREE.ShadowMaterial).opacity = 0.09;
      }
      if (this.gridHelper) {
        this.scene.remove(this.gridHelper);
        this.gridHelper = new THREE.GridHelper(5000, 50, 0x0284c7, 0xe2e8f0);
        this.gridHelper.position.y = 0;
        this.scene.add(this.gridHelper);
      }
    } else {
      // Dark CAD Mode
      this.scene.background = new THREE.Color(0x0e0e11);
      this.scene.fog = new THREE.FogExp2(0x0e0e11, 0.00035);
      if (this.floorMesh) {
        (this.floorMesh.material as THREE.ShadowMaterial).opacity = 0.35;
      }
      if (this.gridHelper) {
        this.scene.remove(this.gridHelper);
        this.gridHelper = new THREE.GridHelper(5000, 50, 0x06b6d4, 0x27272a);
        this.gridHelper.position.y = 0;
        this.scene.add(this.gridHelper);
      }
    }
  }

  toggleTheme() {
    this.isWhiteTheme.update(v => !v);
    this.applyThemeColors();
  }

  private setupLighting() {
    // Soft Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    // Warm Hemisphere Light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.7);
    this.scene.add(hemiLight);

    // Key Directional Light for Crisp Shadows
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(1600, 2600, 1800);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 200;
    keyLight.shadow.camera.far = 7000;
    const d = 2200;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0003;
    this.scene.add(keyLight);

    // Soft Side & Back Fill Lights
    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.65);
    fillLight.position.set(-1800, 1400, -1200);
    this.scene.add(fillLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 0.45);
    frontLight.position.set(0, 800, 2200);
    this.scene.add(frontLight);
  }

  private setupFloorGrid() {
    // Soft shadow receiver plane
    const floorGeo = new THREE.PlaneGeometry(8000, 8000);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.09 });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = -1;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    // Millimetric Grid Helper
    this.gridHelper = new THREE.GridHelper(5000, 50, 0x0284c7, 0xe2e8f0);
    this.gridHelper.position.y = 0;
    this.scene.add(this.gridHelper);
  }

  private calculateCentroid(parts: Part[]): { x: number; y: number; z: number } {
    if (parts.length === 0) return { x: 0, y: 0, z: 0 };
    let sumX = 0, sumY = 0, sumZ = 0;
    for (const p of parts) {
      const b = this.getPartBounds(p);
      sumX += b.px;
      sumY += b.py;
      sumZ += b.pz;
    }
    return {
      x: Math.round(sumX / parts.length),
      y: Math.round(sumY / parts.length),
      z: Math.round(sumZ / parts.length)
    };
  }

  private buildFurnitureScene(
    parts: Part[],
    selectedIds: string[],
    mats: Material[],
    xRay: boolean,
    showDims: boolean
  ) {
    // Clear previous furniture & dimensions & gizmo & drills
    while (this.furnitureGroup.children.length > 0) {
      const obj = this.furnitureGroup.children[0];
      this.furnitureGroup.remove(obj);
    }
    while (this.dimensionGroup.children.length > 0) {
      const obj = this.dimensionGroup.children[0];
      this.dimensionGroup.remove(obj);
    }
    while (this.gizmoGroup.children.length > 0) {
      const obj = this.gizmoGroup.children[0];
      this.gizmoGroup.remove(obj);
    }
    while (this.drillGroup.children.length > 0) {
      const obj = this.drillGroup.children[0];
      this.drillGroup.remove(obj);
    }
    this.pieceObjects = [];
    this.gizmoHitMeshes = [];

    // Preserve open animation states for existing parts (prevents jumping!)
    const prevOpenCurrent = new Map(this.openCurrentMap);
    const prevOpenTarget = new Map(this.openTargetMap);
    this.openCurrentMap.clear();
    this.openTargetMap.clear();
    for (const [id, val] of prevOpenTarget.entries()) {
      if (parts.some(p => p.id === id)) {
        this.openTargetMap.set(id, val);
        this.openCurrentMap.set(id, prevOpenCurrent.get(id) ?? val);
      }
    }
    const anyStillOpen = Array.from(this.openTargetMap.values()).some(v => v > 0.5);
    this.isAllOpen.set(anyStillOpen);

    if (!parts || parts.length === 0) {
      this.detectedCollisions.set([]);
      this.allDrillHoles.set([]);
      return;
    }

    // 1. Calculate Joinery & Collisions via JoineryEngineService
    const joinery = this.joineryEngine.calculateJoinery(parts);
    this.detectedCollisions.set(joinery.collisions);
    this.collisionsDetected.emit(joinery.collisions);
    this.allDrillHoles.set(joinery.allDrillHoles);
    this.drillHolesUpdated.emit(joinery.allDrillHoles);

    const collidingPartIds = new Set<string>();
    for (const c of joinery.collisions) {
      collidingPartIds.add(c.partAId);
      collidingPartIds.add(c.partBId);
    }

    const selectedDataList: { part: Part; px: number; py: number; pz: number; sx: number; sy: number; sz: number }[] = [];

    for (const part of parts) {
      if (this.hiddenPartIds().has(part.id)) {
        continue;
      }

      const t = part.thickness || 18;
      const L = part.length;
      const W = part.width;

      let sx = L;
      let sy = t;
      let sz = W;

      const isDrawerPart = !!part.groupId || 
        part.componentRole === 'drawer_front' || 
        part.componentRole === 'drawer_box' || 
        part.componentRole === 'drawer_lateral' || 
        part.name.toUpperCase().includes('CAJ') || 
        part.name.toUpperCase().includes('GAVET') ||
        part.id.includes('caj_');

      const orient = part.orientation || 'horizontal';
      if (orient === 'vertical_yz') {
        if (isDrawerPart) {
          // In vertical_yz for ANY drawer part: thickness along X, height in Y, width/depth along Z
          sx = t;
          sy = Math.min(L, W);
          sz = Math.max(L, W);
        } else {
          sx = t;
          sy = L;
          sz = W;
        }
      } else if (orient === 'vertical_xy') {
        const isDoor = (part.componentRole === 'door' || part.name.toUpperCase().includes('PUERTA')) && !isDrawerPart;
        if (isDrawerPart) {
          // In vertical_xy for ANY drawer part: width/depth along X, height in Y, thickness along Z
          sx = Math.max(L, W);
          sy = Math.min(L, W);
          sz = t;
        } else if (isDoor && L > W) {
          // En carpintería, la veta/largo de una puerta corre verticalmente (altura en Y) y el ancho en X
          sx = W;
          sy = L;
          sz = t;
        } else {
          sx = L;
          sy = W;
          sz = t;
        }
      }

      const px = part.posX ?? 0;
      const py = part.posY ?? (sy / 2);
      const pz = part.posZ ?? 0;

      const isSelected = selectedIds.includes(part.id);
      const isColliding = collidingPartIds.has(part.id);

      if (isSelected) {
        selectedDataList.push({ part, px, py, pz, sx, sy, sz });
      }

      // Geometry with bevel or box
      const geometry = new THREE.BoxGeometry(sx, sy, sz);
      const material = this.createPieceMaterial(part, isSelected, mats, xRay, isColliding);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(px, py, pz);
      mesh.castShadow = !xRay;
      mesh.receiveShadow = true;
      mesh.userData = { part, isPiece: true };

      // Edges geometry for crisp technical outline
      const edges = new THREE.EdgesGeometry(geometry);
      const edgeColor = isColliding ? 0xef4444 : (isSelected ? 0x0284c7 : (this.isWhiteTheme() ? 0x94a3b8 : 0x3f3f46));
      const edgeMat = new THREE.LineBasicMaterial({
        color: edgeColor,
        linewidth: isColliding ? 3 : (isSelected ? 3 : 1)
      });
      const edgeLines = new THREE.LineSegments(edges, edgeMat);
      mesh.add(edgeLines);

      // Exploded vector
      const explodedOffset = new THREE.Vector3(
        px * 0.45,
        (py - 400) * 0.4,
        pz * 0.45
      );

      const hw = part.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(part);
      const isDoor = (hw.movableType === 'door' || part.componentRole === 'door' || part.name.toUpperCase().includes('PUERTA')) &&
                     !part.name.toUpperCase().includes('CAJ');

      // Internal drawer box sub-parts (sides, back, inner-front, bottom)
      const isInternalBoxPart = part.componentRole === 'drawer_box' ||
                                part.name.toUpperCase().includes('LATERAL') ||
                                part.name.toUpperCase().includes('COSTADO') ||
                                part.name.toUpperCase().includes('TRASERA') ||
                                part.name.toUpperCase().includes('FONDO') ||
                                part.name.toUpperCase().includes('CONTRAFRENTE') ||
                                part.name.toUpperCase().includes('INTERIOR');

      // Drawer front facade: ONLY the front panel of the drawer
      const isDrawerFront = !isInternalBoxPart && (
        part.componentRole === 'drawer_front' ||
        (hw.movableType === 'drawer' && !isInternalBoxPart) ||
        (part.name.toUpperCase().includes('FRENTE') && (part.name.toUpperCase().includes('CAJ') || part.name.toUpperCase().includes('GAVET'))) ||
        ((part.name.toUpperCase().startsWith('CAJ') || part.name.toUpperCase().startsWith('GAVET')) && !isInternalBoxPart)
      );

      // isDrawer: includes both the front and internal parts or any grouped drawer piece
      const isPartInDrawerGroup = !!part.groupId;
      const isDrawer = !isDoor && (
        isPartInDrawerGroup ||
        isDrawerFront || (
        isInternalBoxPart && (
          part.name.toUpperCase().includes('CAJON') ||
          part.name.toUpperCase().includes('CAJÓN') ||
          part.name.toUpperCase().includes('GAVETA') ||
          part.id.includes('caj_') ||
          part.id.includes('gav_')
        )
      ));

      let doorPivot: THREE.Group | undefined;
      let hingeSide: 'left' | 'right' | 'top' | 'bottom' = hw.openingDirection || 'left';
      let doorLocalMeshPos: THREE.Vector3 | undefined;
      let doorPivotOriginalPos: THREE.Vector3 | undefined;
      let handleGroup: THREE.Group | undefined;
      let hingeGroup: THREE.Group | undefined;
      let slideGroup: THREE.Group | undefined;

      // Determine slide axis and direction according to drawer front facing orientation in 3D
      let drawerFacing: 'front' | 'right' | 'back' | 'left' = 'front';
      let slideAxis: 'x' | 'y' | 'z' = 'z';
      let slideDir = 1;
      if (isDrawer) {
        drawerFacing = this.getDrawerFacing(part, parts);
        if (drawerFacing === 'right') {
          slideAxis = 'x';
          slideDir = 1;
        } else if (drawerFacing === 'left') {
          slideAxis = 'x';
          slideDir = -1;
        } else if (drawerFacing === 'back') {
          slideAxis = 'z';
          slideDir = -1;
        } else {
          slideAxis = 'z';
          slideDir = 1;
        }
      }

      // Check selective hardware visibility for this piece / group
      const isHwHidden = (part.groupId && this.hiddenHardwareGroupIds().has(part.groupId)) ||
                         this.hiddenHardwarePartIds().has(part.id);
      const shouldRenderHardware = this.showHardware() && !isHwHidden;

      if (isDoor) {
        if (!hw.openingDirection) {
          if (part.name.toUpperCase().includes('BASCULANTE') || part.name.toUpperCase().includes('ELEVABLE')) {
            hingeSide = 'top';
          } else if (part.name.toUpperCase().includes('DER') || (part.posX || 0) > 0) {
            hingeSide = 'right';
          } else {
            hingeSide = 'left';
          }
        } else {
          hingeSide = hw.openingDirection;
        }

        doorPivot = new THREE.Group();
        if (hingeSide === 'top') {
          doorPivot.position.set(px, py + sy / 2, pz + sz / 2);
          mesh.position.set(0, -sy / 2, -sz / 2);
        } else if (hingeSide === 'bottom') {
          doorPivot.position.set(px, py - sy / 2, pz + sz / 2);
          mesh.position.set(0, sy / 2, -sz / 2);
        } else if (hingeSide === 'right') {
          doorPivot.position.set(px + sx / 2, py, pz + sz / 2);
          mesh.position.set(-sx / 2, 0, -sz / 2);
        } else {
          hingeSide = 'left';
          doorPivot.position.set(px - sx / 2, py, pz + sz / 2);
          mesh.position.set(sx / 2, 0, -sz / 2);
        }
        doorLocalMeshPos = mesh.position.clone();
        doorPivotOriginalPos = doorPivot.position.clone();
        doorPivot.add(mesh);

        // Hardware: 3D Handles & Concealed 35mm Hinges (selective)
        if (shouldRenderHardware) {
          handleGroup = this.createHandleMesh(part, hw, sx, sy, sz, true, hingeSide);
          if (handleGroup) mesh.add(handleGroup);
          hingeGroup = this.createHingesMesh(part, hw, sx, sy, sz, hingeSide);
          if (hingeGroup) mesh.add(hingeGroup);
        }

        // Apply preserved open rotation immediately so it doesn't jump
        const curOpen = this.openCurrentMap.get(part.id) || 0;
        if (curOpen > 0) {
          if (hingeSide === 'left') doorPivot.rotation.y = -curOpen * (Math.PI / 2.05);
          else if (hingeSide === 'right') doorPivot.rotation.y = curOpen * (Math.PI / 2.05);
          else if (hingeSide === 'top') doorPivot.rotation.x = curOpen * (Math.PI / 2.2);
          else if (hingeSide === 'bottom') doorPivot.rotation.x = -curOpen * (Math.PI / 2.2);
        }

        this.furnitureGroup.add(doorPivot);
        mesh.userData = { part, isPiece: true, isDoor: true };
      } else if (isDrawer) {
        mesh.position.set(px, py, pz);

        // Check if separate box sub-parts already exist in the project parts list for this drawer
        const hasSeparateBoxParts = parts.some(other =>
          other.id !== part.id && (
            (other.groupId && other.groupId === part.groupId) ||
            (
              (other.componentRole === 'drawer_box' ||
               other.name.toUpperCase().includes('GAVETA') || 
               other.name.toUpperCase().includes('CAJÓN') || 
               other.name.toUpperCase().includes('CAJON')) &&
              Math.abs((other.posY || 0) - (part.posY || 0)) < 150
            )
          )
        );

        // If it's a front plate without separate 3D box parts, attach complete 5-piece drawer box
        if (isDrawerFront && !hasSeparateBoxParts) {
          const drawerBoxMesh = this.createDrawerBoxMesh(part, sx, sy, sz, drawerFacing);
          if (drawerBoxMesh) mesh.add(drawerBoxMesh);
        }

        // Hardware: 3D Handles & Telescopic Runners ONLY ON THE FRONT FACADE (selective)
        if (isDrawerFront && shouldRenderHardware) {
          handleGroup = this.createHandleMesh(part, hw, sx, sy, sz, false, 'top', drawerFacing);
          if (handleGroup) mesh.add(handleGroup);
          slideGroup = this.createDrawerSlidesMesh(part, hw, sx, sy, sz, drawerFacing);
          if (slideGroup) mesh.add(slideGroup);
        }

        // Apply preserved open translation immediately
        const curOpen = this.openCurrentMap.get(part.id) || 0;
        if (curOpen > 0) {
          const maxSlide = 320;
          if (slideAxis === 'x') mesh.position.x += curOpen * maxSlide * slideDir;
          else mesh.position.z += curOpen * maxSlide * slideDir;
        }

        this.furnitureGroup.add(mesh);
        mesh.userData = { part, isPiece: true, isDrawer: true, isDrawerFront };
      } else {
        mesh.position.set(px, py, pz);
        this.furnitureGroup.add(mesh);
        mesh.userData = { part, isPiece: true };
      }

      this.pieceObjects.push({
        part,
        mesh,
        originalPos: new THREE.Vector3(px, py, pz),
        explodedOffset,
        isDoor,
        isDrawer,
        doorPivot,
        hingeSide,
        doorLocalMeshPos,
        doorPivotOriginalPos,
        handleGroup,
        hingeGroup,
        slideGroup,
        slideAxis,
        slideDir
      });
    }

    // 2. Render Drill Holes when toggle is enabled
    if (this.showDrillHoles() && joinery.allDrillHoles.length > 0) {
      this.renderDrillHolesVisuals(joinery.allDrillHoles);
    }

    // Single piece selected -> Full Gizmo (Translation arrows + Edge Stretch handles) and 3D dimensions & Clearances
    if (selectedDataList.length === 1) {
      const s = selectedDataList[0];
      if (showDims) {
        this.renderPieceDimensions(s.part, s.px, s.py, s.pz, s.sx, s.sy, s.sz);
      }
      if (this.showClearances()) {
        this.renderClearanceDimensions(s.part, parts);
      } else {
        this.clearanceCalculated.emit(null);
      }
      // Only display gizmos when tool is 'move' or 'select' (Push/Pull and Measure keep the canvas clear)
      if (this.activeTool() === 'move' || this.activeTool() === 'select') {
        this.buildGizmo(s.part, s.px, s.py, s.pz, s.sx, s.sy, s.sz);
      }
    } else {
      this.clearanceCalculated.emit(null);
      // Translation arrows for groups removed per user request (moved via direct mouse drag on parts)
    }
  }

  // Create Interactive 3D Gizmo: Edge Stretch Handles (Translation is done cleanly via direct mouse drag)
  private buildGizmo(
    part: Part,
    px: number,
    py: number,
    pz: number,
    sx: number,
    sy: number,
    sz: number
  ) {
    const group = new THREE.Group();
    group.position.set(px, py, pz);

    // Edge Stretch Handles (Tiradores de borde interactivos)
    // Cubos en los bordes para alargar o ensanchar la pieza arrastrando directamente
    const createStretchHandle = (
      pos: THREE.Vector3,
      colorHex: number,
      handleTarget: 'length' | 'width',
      dir: number
    ) => {
      const handleSize = 24;
      const geo = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.2,
        metalness: 0.3,
        emissive: colorHex,
        emissiveIntensity: 0.35,
        depthTest: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);

      // Outline
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, depthTest: false })
      );
      mesh.add(edge);

      const hitData: GizmoHitData = {
        isGizmo: true,
        type: 'handle',
        handleTarget,
        dir
      };
      mesh.userData = hitData;
      this.gizmoHitMeshes.push(mesh);
      return mesh;
    };

    // Determine dimensions orientation
    const orient = part.orientation || 'horizontal';

    if (orient === 'horizontal') {
      // Length along X, Width along Z
      const handleLPlus = createStretchHandle(new THREE.Vector3(sx / 2 + 16, 0, 0), 0x2563eb, 'length', 1);
      const handleLMinus = createStretchHandle(new THREE.Vector3(-sx / 2 - 16, 0, 0), 0x2563eb, 'length', -1);
      const handleWPlus = createStretchHandle(new THREE.Vector3(0, 0, sz / 2 + 16), 0xf59e0b, 'width', 1);
      const handleWMinus = createStretchHandle(new THREE.Vector3(0, 0, -sz / 2 - 16), 0xf59e0b, 'width', -1);

      group.add(handleLPlus, handleLMinus, handleWPlus, handleWMinus);
    } else if (orient === 'vertical_yz') {
      const isDrawerLateral = part.componentRole === 'drawer_box' ||
        part.componentRole === 'drawer_lateral' ||
        (part.name.toUpperCase().includes('LATERAL') && (part.name.toUpperCase().includes('CAJ') || !!part.groupId));
      if (isDrawerLateral && (part.length || 0) > (part.width || 0)) {
        // En lateral de cajón: Length es profundidad en eje Z, Width es altura en eje Y
        const handleLPlus = createStretchHandle(new THREE.Vector3(0, 0, sz / 2 + 16), 0x2563eb, 'length', 1);
        const handleLMinus = createStretchHandle(new THREE.Vector3(0, 0, -sz / 2 - 16), 0x2563eb, 'length', -1);
        const handleWPlus = createStretchHandle(new THREE.Vector3(0, sy / 2 + 16), 0xf59e0b, 'width', 1);
        const handleWMinus = createStretchHandle(new THREE.Vector3(0, -sy / 2 - 16), 0xf59e0b, 'width', -1);
        group.add(handleLPlus, handleLMinus, handleWPlus, handleWMinus);
      } else {
        // Length along Y (Height), Width along Z
        const handleLPlus = createStretchHandle(new THREE.Vector3(0, sy / 2 + 16, 0), 0x2563eb, 'length', 1);
        const handleLMinus = createStretchHandle(new THREE.Vector3(0, -sy / 2 - 16), 0x2563eb, 'length', -1);
        const handleWPlus = createStretchHandle(new THREE.Vector3(0, 0, sz / 2 + 16), 0xf59e0b, 'width', 1);
        const handleWMinus = createStretchHandle(new THREE.Vector3(0, 0, -sz / 2 - 16), 0xf59e0b, 'width', -1);
        group.add(handleLPlus, handleLMinus, handleWPlus, handleWMinus);
      }
    } else {
      // Frontal (XY): Length along X, Width along Y
      const handleLPlus = createStretchHandle(new THREE.Vector3(sx / 2 + 16, 0, 0), 0x2563eb, 'length', 1);
      const handleLMinus = createStretchHandle(new THREE.Vector3(-sx / 2 - 16, 0, 0), 0x2563eb, 'length', -1);
      const handleWPlus = createStretchHandle(new THREE.Vector3(0, sy / 2 + 16), 0xf59e0b, 'width', 1);
      const handleWMinus = createStretchHandle(new THREE.Vector3(0, -sy / 2 - 16), 0xf59e0b, 'width', -1);

      group.add(handleLPlus, handleLMinus, handleWPlus, handleWMinus);
    }

    group.renderOrder = 999;
    this.gizmoGroup.add(group);
  }

  // --- MAGNETIC SNAP ENGINE (IMÁN 3D PARA CINTA MÉTRICA) ---

  // Generates 8 Corner Vertices and 12 Edge Midpoints for any given part
  private getPartSnapPoints(part: Part): { pos: THREE.Vector3; type: 'corner' | 'midpoint'; partName: string }[] {
    const b = this.getPartBounds(part);
    const px = b.px;
    const py = b.py;
    const pz = b.pz;
    const hx = b.sx / 2;
    const hy = b.sy / 2;
    const hz = b.sz / 2;

    const points: { pos: THREE.Vector3; type: 'corner' | 'midpoint'; partName: string }[] = [];

    // 8 Corner Vertices (Esquinas)
    for (const dx of [-hx, hx]) {
      for (const dy of [-hy, hy]) {
        for (const dz of [-hz, hz]) {
          points.push({
            pos: new THREE.Vector3(px + dx, py + dy, pz + dz),
            type: 'corner',
            partName: part.name
          });
        }
      }
    }

    // 12 Edge Midpoints (Puntos medios de aristas)
    // 4 edges parallel to X
    for (const dy of [-hy, hy]) {
      for (const dz of [-hz, hz]) {
        points.push({
          pos: new THREE.Vector3(px, py + dy, pz + dz),
          type: 'midpoint',
          partName: part.name
        });
      }
    }
    // 4 edges parallel to Y
    for (const dx of [-hx, hx]) {
      for (const dz of [-hz, hz]) {
        points.push({
          pos: new THREE.Vector3(px + dx, py, pz + dz),
          type: 'midpoint',
          partName: part.name
        });
      }
    }
    // 4 edges parallel to Z
    for (const dx of [-hx, hx]) {
      for (const dy of [-hy, hy]) {
        points.push({
          pos: new THREE.Vector3(px + dx, py + dy, pz),
          type: 'midpoint',
          partName: part.name
        });
      }
    }

    return points;
  }

  // Finds nearest vertex corner or edge midpoint to projected screen mouse position with high CAD precision
  private findMagneticSnapCandidate(
    screenX: number,
    screenY: number,
    thresholdPx = 36
  ): { worldPos: THREE.Vector3; type: 'corner' | 'midpoint'; partName: string } | null {
    if (!this.camera || !this.canvasRef()?.nativeElement) return null;
    const canvas = this.canvasRef()!.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const visibleParts = this.parts().filter(p => !this.hiddenPartIds().has(p.id));

    let bestCandidate: { worldPos: THREE.Vector3; type: 'corner' | 'midpoint'; partName: string } | null = null;
    let minDistance = thresholdPx;
    const tempV = new THREE.Vector3();

    for (const part of visibleParts) {
      const snapPoints = this.getPartSnapPoints(part);
      for (const sp of snapPoints) {
        tempV.copy(sp.pos).project(this.camera);
        if (tempV.z > 1) continue; // Behind camera

        const pX = ((tempV.x + 1) / 2) * rect.width + rect.left;
        const pY = ((-tempV.y + 1) / 2) * rect.height + rect.top;

        const dist = Math.hypot(pX - screenX, pY - screenY);
        // Corners get a strong attraction bonus (0.65x) so outer edges lock firmly
        const effectiveDist = sp.type === 'corner' ? dist * 0.65 : dist;
        if (effectiveDist < minDistance) {
          minDistance = effectiveDist;
          bestCandidate = {
            worldPos: sp.pos.clone(),
            type: sp.type,
            partName: sp.partName
          };
        }
      }
    }

    // Secondary 3D Face Proximity Fallback:
    // If screen projection was just beyond threshold, check if mouse ray hits a part and snaps to its closest corner
    if (!bestCandidate) {
      const mouse = new THREE.Vector2(
        ((screenX - rect.left) / rect.width) * 2 - 1,
        -((screenY - rect.top) / rect.height) * 2 + 1
      );
      this.raycaster.setFromCamera(mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(
        this.pieceObjects.map(p => p.mesh),
        false
      );
      if (intersects.length > 0) {
        const hit = intersects[0];
        const hitPart = hit.object.userData?.['part'] as Part | undefined;
        if (hitPart) {
          const hitPt = hit.point;
          const snapPoints = this.getPartSnapPoints(hitPart);
          let closestPt: { pos: THREE.Vector3; type: 'corner' | 'midpoint'; partName: string } | null = null;
          let min3dDist = 45; // mm in 3D
          for (const sp of snapPoints) {
            const d = hitPt.distanceTo(sp.pos);
            const effD = sp.type === 'corner' ? d * 0.75 : d;
            if (effD < min3dDist) {
              min3dDist = effD;
              closestPt = sp;
            }
          }
          if (closestPt) {
            bestCandidate = {
              worldPos: closestPt.pos.clone(),
              type: closestPt.type,
              partName: closestPt.partName
            };
          }
        }
      }
    }

    return bestCandidate;
  }

  // Renders subtle CAD magnetic snapping indicator (crosshair & clean badge) on hovered vertex
  private updateMagneticSnapIndicator(
    candidate: { worldPos: THREE.Vector3; type: 'corner' | 'midpoint'; partName: string } | null
  ) {
    while (this.magneticSnapGroup.children.length > 0) {
      const obj = this.magneticSnapGroup.children[0];
      this.magneticSnapGroup.remove(obj);
    }

    if (!candidate) return;

    this.magneticSnapGroup.position.copy(candidate.worldPos);

    // 1. Subtle Precision Crosshair (Cruz sutil en el punto exacto)
    const crossSize = 5.0; // mm
    const crossPoints = [
      new THREE.Vector3(-crossSize, 0, 0), new THREE.Vector3(crossSize, 0, 0),
      new THREE.Vector3(0, -crossSize, 0), new THREE.Vector3(0, crossSize, 0),
      new THREE.Vector3(0, 0, -crossSize), new THREE.Vector3(0, 0, crossSize)
    ];
    const crossGeo = new THREE.BufferGeometry().setFromPoints(crossPoints);
    const crossMat = new THREE.LineBasicMaterial({
      color: candidate.type === 'corner' ? 0x10b981 : 0xf59e0b,
      depthTest: false,
      linewidth: 2
    });
    const crossLines = new THREE.LineSegments(crossGeo, crossMat);
    this.magneticSnapGroup.add(crossLines);

    // 2. High-precision Ring
    const ringGeo = new THREE.RingGeometry(4, 6, 16);
    const ringMat = new THREE.MeshBasicMaterial({
      color: candidate.type === 'corner' ? 0x10b981 : 0xf59e0b,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.95
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.quaternion.copy(this.camera.quaternion); // Billboard to face camera
    this.magneticSnapGroup.add(ring);

    // 3. Compact Label Sprite (No blocking the piece)
    const labelText = candidate.type === 'corner' ? `Esquina · ${candidate.partName}` : `Centro · ${candidate.partName}`;
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.beginPath();
      ctx.roundRect(0, 0, 240, 48, 10);
      ctx.fill();
      ctx.strokeStyle = candidate.type === 'corner' ? '#10b981' : '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, 120, 24);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(0, 16, 0);
    sprite.scale.set(60, 14, 1);
    this.magneticSnapGroup.add(sprite);
  }

  // Start a fresh measurement without resetting tool
  startNewMeasurement() {
    this.isMeasurementPersistent.set(false);
    this.measurePointA.set(null);
    this.measurePointB.set(null);
    while (this.measureGroup.children.length > 0) {
      const obj = this.measureGroup.children[0];
      this.measureGroup.remove(obj);
    }
    this.updateMagneticSnapIndicator(null);
  }

  // Render Interactive 3D Measurement Visuals with Fine CAD Arrowheads & Subtle Center Cross
  renderMeasurementVisuals() {
    while (this.measureGroup.children.length > 0) {
      const obj = this.measureGroup.children[0];
      this.measureGroup.remove(obj);
    }

    const a = this.measurePointA();
    const b = this.measurePointB();
    if (!a) return;

    // Helper 1: Subtle technical crosshair (cruz fina de 7mm en el vértice exacto)
    const createCadCrosshair = (pt: { x: number; y: number; z: number }, colorHex: number) => {
      const group = new THREE.Group();
      group.position.set(pt.x, pt.y, pt.z);

      const s = 4.0; // 8mm total span
      const pts = [
        new THREE.Vector3(-s, 0, 0), new THREE.Vector3(s, 0, 0),
        new THREE.Vector3(0, -s, 0), new THREE.Vector3(0, s, 0),
        new THREE.Vector3(0, 0, -s), new THREE.Vector3(0, 0, s)
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: colorHex, depthTest: false, linewidth: 2 });
      const lines = new THREE.LineSegments(geo, mat);
      group.add(lines);

      // Micro center dot (1mm) for pin-point registration
      const dotGeo = new THREE.SphereGeometry(1.2, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
      group.add(new THREE.Mesh(dotGeo, dotMat));

      return group;
    };

    // Helper 2: Slender CAD Arrowhead Cone touching the exact vertex with its apex
    const createCadArrow = (tipPos: { x: number; y: number; z: number }, dirPointingAtTip: THREE.Vector3, colorHex: number) => {
      const arrowLength = 12; // mm
      const arrowRadius = 2.4; // mm
      const coneGeo = new THREE.ConeGeometry(arrowRadius, arrowLength, 12);
      // In Three.js, cone apex is at (0, +height/2, 0).
      // Translate geometry so apex is at origin (0, 0, 0) and body extends along -Y:
      coneGeo.translate(0, -arrowLength / 2, 0);

      const coneMat = new THREE.MeshBasicMaterial({ color: colorHex, depthTest: false });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);

      // Rotate cone so that local +Y aligns with dirPointingAtTip:
      const defaultUp = new THREE.Vector3(0, 1, 0);
      const normDir = dirPointingAtTip.clone().normalize();
      coneMesh.quaternion.setFromUnitVectors(defaultUp, normDir);
      coneMesh.position.set(tipPos.x, tipPos.y, tipPos.z);

      return coneMesh;
    };

    // Initial state: only Point A is placed
    if (!b) {
      this.measureGroup.add(createCadCrosshair(a, 0xf59e0b));
      const anchorRingGeo = new THREE.RingGeometry(3, 5, 16);
      const anchorRingMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        depthTest: false,
        transparent: true,
        opacity: 0.85
      });
      const anchorRing = new THREE.Mesh(anchorRingGeo, anchorRingMat);
      anchorRing.position.set(a.x, a.y, a.z);
      anchorRing.quaternion.copy(this.camera.quaternion);
      this.measureGroup.add(anchorRing);
      return;
    }

    // Both Point A and Point B are defined:
    const vecAB = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
    const totalDist = vecAB.length();

    // Direction vectors pointing AT the endpoints
    const dirAtA = totalDist > 0.1
      ? new THREE.Vector3(a.x - b.x, a.y - b.y, a.z - b.z).normalize()
      : new THREE.Vector3(0, 1, 0);
    const dirAtB = dirAtA.clone().negate();

    // Endpoints CAD Arrows (Puntas de flecha finas en ambos lados)
    this.measureGroup.add(createCadArrow(a, dirAtA, 0xf59e0b));
    this.measureGroup.add(createCadCrosshair(a, 0x10b981));

    this.measureGroup.add(createCadArrow(b, dirAtB, 0xf59e0b));
    this.measureGroup.add(createCadCrosshair(b, 0x10b981));

    // Direct Euclidean CAD Measurement Line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a.x, a.y, a.z),
      new THREE.Vector3(b.x, b.y, b.z)
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      linewidth: 2,
      depthTest: false
    });
    const directLine = new THREE.Line(lineGeo, lineMat);
    this.measureGroup.add(directLine);

    // Subtle orthogonal delta projection lines
    if (Math.abs(b.x - a.x) > 4) {
      const geoX = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.x, a.y, a.z),
        new THREE.Vector3(b.x, a.y, a.z)
      ]);
      const matX = new THREE.LineDashedMaterial({ color: 0xef4444, dashSize: 12, gapSize: 8, depthTest: false });
      const lineX = new THREE.Line(geoX, matX);
      lineX.computeLineDistances();
      this.measureGroup.add(lineX);
    }

    if (Math.abs(b.y - a.y) > 4) {
      const geoY = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(b.x, a.y, a.z),
        new THREE.Vector3(b.x, b.y, a.z)
      ]);
      const matY = new THREE.LineDashedMaterial({ color: 0x10b981, dashSize: 12, gapSize: 8, depthTest: false });
      const lineY = new THREE.Line(geoY, matY);
      lineY.computeLineDistances();
      this.measureGroup.add(lineY);
    }

    if (Math.abs(b.z - a.z) > 4) {
      const geoZ = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(b.x, b.y, a.z),
        new THREE.Vector3(b.x, b.y, b.z)
      ]);
      const matZ = new THREE.LineDashedMaterial({ color: 0x3b82f6, dashSize: 12, gapSize: 8, depthTest: false });
      const lineZ = new THREE.Line(geoZ, matZ);
      lineZ.computeLineDistances();
      this.measureGroup.add(lineZ);
    }

    // Floating Midpoint Distance Badge (compact & non-intrusive)
    const mid = new THREE.Vector3(
      (a.x + b.x) / 2,
      (a.y + b.y) / 2 + 18,
      (a.z + b.z) / 2
    );
    const distInfo = this.measureDistance();
    if (distInfo) {
      const canvas = document.createElement('canvas');
      canvas.width = 180;
      canvas.height = 48;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.beginPath();
        ctx.roundRect(0, 0, 180, 48, 10);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${distInfo.total} mm`, 90, 24);
      }
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.copy(mid);
      sprite.scale.set(60, 16, 1);
      this.measureGroup.add(sprite);
    }
  }

  toggleDrillHoles() {
    this.showDrillHoles.update(v => !v);
  }

  toggleHardware() {
    const grp = this.currentSelectedGroup();
    if (grp) {
      this.hiddenHardwareGroupIds.update(set => {
        const next = new Set(set);
        if (next.has(grp.id)) {
          next.delete(grp.id);
        } else {
          next.add(grp.id);
        }
        return next;
      });
      return;
    }

    const sel = this.selectedPart();
    if (sel) {
      this.hiddenHardwarePartIds.update(set => {
        const next = new Set(set);
        if (next.has(sel.id)) {
          next.delete(sel.id);
        } else {
          next.add(sel.id);
        }
        return next;
      });
      return;
    }

    // Fallback global toggle
    this.showHardware.update(v => !v);
  }

  private updateSelectionHighlights(selectedIds: string[], mats: Material[], xRay: boolean) {
    const collidingPartIds = new Set<string>();
    for (const c of this.detectedCollisions()) {
      collidingPartIds.add(c.partAId);
      collidingPartIds.add(c.partBId);
    }

    const selectedDataList: { part: Part; px: number; py: number; pz: number; sx: number; sy: number; sz: number }[] = [];

    for (const item of this.pieceObjects) {
      const part = item.part;
      const isSelected = selectedIds.includes(part.id);
      const isColliding = collidingPartIds.has(part.id);

      // 1. Update mesh material highlight in place
      item.mesh.material = this.createPieceMaterial(part, isSelected, mats, xRay, isColliding);

      // 2. Update technical edge outline color
      for (const child of item.mesh.children) {
        if (child instanceof THREE.LineSegments) {
          const edgeColor = isColliding ? 0xef4444 : (isSelected ? 0x0284c7 : (this.isWhiteTheme() ? 0x94a3b8 : 0x3f3f46));
          (child.material as THREE.LineBasicMaterial).color.setHex(edgeColor);
          (child.material as THREE.LineBasicMaterial).linewidth = isSelected || isColliding ? 3 : 1;
        }
      }

      if (isSelected) {
        const t = part.thickness || 18;
        const L = part.length;
        const W = part.width;
        let sx = L; let sy = t; let sz = W;
        if (part.orientation === 'vertical_yz') {
          const isDrawerLateral = part.componentRole === 'drawer_box' ||
            part.componentRole === 'drawer_lateral' ||
            (part.name.toUpperCase().includes('LATERAL') && (part.name.toUpperCase().includes('CAJ') || !!part.groupId));
          if (isDrawerLateral && L > W) {
            sx = t; sy = W; sz = L;
          } else {
            sx = t; sy = L; sz = W;
          }
        } else if (part.orientation === 'vertical_xy') {
          const isDrawerBoxHead = part.componentRole === 'drawer_box' ||
            part.name.toUpperCase().includes('CONTRA') ||
            part.name.toUpperCase().includes('TRASERA');
          if (isDrawerBoxHead) {
            sx = L; sy = W; sz = t;
          } else if (item.isDoor && L > W) {
            sx = W; sy = L; sz = t;
          } else if (item.isDrawer && W > L) {
            sx = W; sy = L; sz = t;
          } else {
            sx = L; sy = W; sz = t;
          }
        }
        selectedDataList.push({
          part,
          px: item.originalPos.x,
          py: item.originalPos.y,
          pz: item.originalPos.z,
          sx, sy, sz
        });
      }
    }

    // Refresh CAD Gizmo & Dimension overlays only
    while (this.dimensionGroup.children.length > 0) {
      this.dimensionGroup.remove(this.dimensionGroup.children[0]);
    }
    while (this.gizmoGroup.children.length > 0) {
      this.gizmoGroup.remove(this.gizmoGroup.children[0]);
    }
    this.gizmoHitMeshes = [];

    if (selectedDataList.length === 1) {
      const s = selectedDataList[0];
      if (this.show3dDimensions()) {
        this.renderPieceDimensions(s.part, s.px, s.py, s.pz, s.sx, s.sy, s.sz);
      }
      if (this.showClearances()) {
        this.renderClearanceDimensions(s.part, this.parts());
      } else {
        this.clearanceCalculated.emit(null);
      }
      if (this.activeTool() === 'move' || this.activeTool() === 'select') {
        this.buildGizmo(s.part, s.px, s.py, s.pz, s.sx, s.sy, s.sz);
      }
    } else {
      this.clearanceCalculated.emit(null);
      // Group selection: translation arrows removed to eliminate visual clutter (moved via direct mouse drag)
    }
  }

  private getDrawerFacing(part: Part, parts: Part[]): 'front' | 'right' | 'back' | 'left' {
    // 1. Gather all parts that belong to the SAME drawer assembly:
    let drawerParts: Part[] = [];
    if (part.groupId) {
      drawerParts = parts.filter(p => p.groupId === part.groupId);
    } else {
      // Check for common drawer prefix in IDs (e.g., 'caj_ind_0_frente', 'caj_ind_0_lat_izq', etc.)
      const boxSubKeywords = ['_frente', '_lat_izq', '_lat_der', '_contrafrente', '_trasera', '_frente_int', '_fondo'];
      let prefix = '';
      for (const kw of boxSubKeywords) {
        if (part.id.includes(kw)) {
          prefix = part.id.split(kw)[0];
          break;
        }
      }
      if (!prefix && part.id.includes('caj_ind_')) {
        const match = part.id.match(/caj_ind_\d+/);
        if (match) prefix = match[0];
      }

      if (prefix) {
        drawerParts = parts.filter(p => p.id.startsWith(prefix) || p.id.includes(prefix));
      } else {
        // Fallback: parts within similar vertical height and drawer naming
        drawerParts = parts.filter(p =>
          (p.id === part.id) ||
          ((p.name.toUpperCase().includes('CAJ') || p.componentRole?.includes('drawer') || p.id.includes('caj_')) &&
           Math.abs((p.posY || 0) - (part.posY || 0)) < 150)
        );
      }
    }

    if (drawerParts.length === 0) {
      drawerParts = [part];
    }

    // 2. Find the FRONT plate of this drawer assembly
    const frontPart = drawerParts.find(p =>
      p.componentRole === 'drawer_front' ||
      p.id.includes('_frente') ||
      p.id.includes('_front') ||
      p.name.toUpperCase().includes('FRENTE')
    ) || (drawerParts.length === 1 ? drawerParts[0] : null);

    // 3. Compute centroid of the entire drawer assembly
    const minX = Math.min(...drawerParts.map(p => p.posX ?? 0));
    const maxX = Math.max(...drawerParts.map(p => p.posX ?? 0));
    const minZ = Math.min(...drawerParts.map(p => p.posZ ?? 0));
    const maxZ = Math.max(...drawerParts.map(p => p.posZ ?? 0));
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;

    if (frontPart) {
      const dx = (frontPart.posX ?? 0) - cx;
      const dz = (frontPart.posZ ?? 0) - cz;

      if (frontPart.orientation === 'vertical_yz') {
        // Front plate is parallel to YZ -> faces +X (right) or -X (left)
        return (Math.abs(dx) > 10 ? dx >= 0 : (frontPart.posX ?? 0) >= 0) ? 'right' : 'left';
      } else {
        // Front plate is parallel to XY -> faces +Z (front) or -Z (back)
        return (Math.abs(dz) > 10 ? dz >= 0 : (frontPart.posZ ?? 0) >= 0) ? 'front' : 'back';
      }
    }

    // If no distinct front plate found (e.g., custom group), look at lateral panels:
    const lateralPanels = drawerParts.filter(p =>
      p.name.toUpperCase().includes('LATERAL') || p.componentRole === 'drawer_lateral'
    );
    if (lateralPanels.length >= 2) {
      if (lateralPanels[0].orientation === 'vertical_xy') {
        return (cx >= 0) ? 'right' : 'left';
      }
      if (lateralPanels[0].orientation === 'vertical_yz') {
        return (cz >= 0) ? 'front' : 'back';
      }
    }

    if (part.orientation === 'vertical_yz') {
      return (part.posX ?? 0) >= 0 ? 'right' : 'left';
    }
    return (part.posZ ?? 0) >= 0 ? 'front' : 'back';
  }

  private createHandleMesh(
    part: Part,
    hw: PartHardwareConfig,
    sx: number,
    sy: number,
    sz: number,
    isDoor: boolean,
    hingeSide: 'left' | 'right' | 'top' | 'bottom',
    drawerFacing: 'front' | 'right' | 'back' | 'left' = 'front'
  ): THREE.Group {
    const group = new THREE.Group();
    const handleType = hw.handleType || 'bar_modern';
    if (handleType === 'none') return group;

    const hexColor = this.hardwareCatalog.getFinishHexColor(hw.handleFinish);
    const metalness = hw.handleFinish === 'black' ? 0.35 : 0.88;
    const roughness = hw.handleFinish === 'black' ? 0.4 : 0.2;

    const handleMat = new THREE.MeshStandardMaterial({
      color: hexColor,
      metalness,
      roughness
    });

    const standoffMat = new THREE.MeshStandardMaterial({
      color: hexColor,
      metalness,
      roughness
    });

    if (handleType === 'bar_modern' || handleType === 'bar_black') {
      const len = hw.handleLength || (handleType === 'bar_black' ? 192 : 160);
      const isBarBlack = handleType === 'bar_black';

      let barMesh: THREE.Mesh;
      if (isBarBlack) {
        barMesh = new THREE.Mesh(new THREE.BoxGeometry(10, len, 12), handleMat);
      } else {
        barMesh = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, len, 18), handleMat);
      }

      const standoff1 = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 25, 14), standoffMat);
      standoff1.rotation.x = Math.PI / 2;
      standoff1.position.set(0, len / 2 - 18, -12);

      const standoff2 = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 25, 14), standoffMat);
      standoff2.rotation.x = Math.PI / 2;
      standoff2.position.set(0, -len / 2 + 18, -12);

      group.add(barMesh);
      group.add(standoff1);
      group.add(standoff2);
    } else if (handleType === 'knob_round') {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 18, 16), standoffMat);
      stem.rotation.x = Math.PI / 2;
      stem.position.set(0, 0, -9);

      const head = new THREE.Mesh(new THREE.CylinderGeometry(14, 12, 9, 24), handleMat);
      head.rotation.x = Math.PI / 2;
      head.position.set(0, 0, 4);

      group.add(stem);
      group.add(head);
    } else if (handleType === 'knob_square') {
      const stem = new THREE.Mesh(new THREE.BoxGeometry(7, 7, 18), standoffMat);
      stem.position.set(0, 0, -9);

      const head = new THREE.Mesh(new THREE.BoxGeometry(22, 22, 8), handleMat);
      head.position.set(0, 0, 4);

      group.add(stem);
      group.add(head);
    } else if (handleType === 'profile_gola') {
      const isSideFacing = !isDoor && (drawerFacing === 'right' || drawerFacing === 'left');
      const width = isDoor ? Math.max(80, sx * 0.85) : Math.max(100, (isSideFacing ? sz : sx) - 24);
      const profile = new THREE.Mesh(new THREE.BoxGeometry(width, 18, 14), handleMat);
      group.add(profile);
    } else if (handleType === 'cup_vintage') {
      const cupBack = new THREE.Mesh(new THREE.BoxGeometry(96, 36, 4), handleMat);
      const cupFront = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 64, 16, 1, false, 0, Math.PI), handleMat);
      cupFront.rotation.z = Math.PI / 2;
      cupFront.position.set(0, -6, 10);
      group.add(cupBack);
      group.add(cupFront);
    }

    // Position handle on door or drawer face
    if (isDoor) {
      const margin = 45;
      if (hingeSide === 'left') {
        group.position.set(sx / 2 - margin, 0, sz / 2 + 15);
      } else if (hingeSide === 'right') {
        group.position.set(-sx / 2 + margin, 0, sz / 2 + 15);
      } else if (hingeSide === 'top') {
        group.rotation.z = Math.PI / 2;
        group.position.set(0, -sy / 2 + margin, sz / 2 + 15);
      } else if (hingeSide === 'bottom') {
        group.rotation.z = Math.PI / 2;
        group.position.set(0, sy / 2 - margin, sz / 2 + 15);
      }
    } else {
      // DRAWER HANDLE: Synchronized in all 4 rotational directions (0°, 90°, 180°, 270°)
      if (handleType === 'profile_gola') {
        if (drawerFacing === 'front') {
          group.position.set(0, sy / 2 - 9, sz / 2 + 7);
          group.rotation.set(0, 0, 0);
        } else if (drawerFacing === 'back') {
          group.position.set(0, sy / 2 - 9, -sz / 2 - 7);
          group.rotation.set(0, Math.PI, 0);
        } else if (drawerFacing === 'right') {
          group.position.set(sx / 2 + 7, sy / 2 - 9, 0);
          group.rotation.set(0, Math.PI / 2, 0);
        } else if (drawerFacing === 'left') {
          group.position.set(-sx / 2 - 7, sy / 2 - 9, 0);
          group.rotation.set(0, -Math.PI / 2, 0);
        }
      } else {
        const isBarOrCup = handleType !== 'knob_round' && handleType !== 'knob_square';

        if (drawerFacing === 'front') {
          // Faces +Z (0°): Front facade at +sz/2, bar horizontal along X
          group.position.set(0, 0, sz / 2 + 15);
          if (isBarOrCup) {
            group.rotation.set(0, 0, Math.PI / 2);
          } else {
            group.rotation.set(0, 0, 0);
          }
        } else if (drawerFacing === 'back') {
          // Faces -Z (180°): Front facade at -sz/2, bar horizontal along X
          group.position.set(0, 0, -sz / 2 - 15);
          if (isBarOrCup) {
            group.rotation.set(0, Math.PI, Math.PI / 2);
          } else {
            group.rotation.set(0, Math.PI, 0);
          }
        } else if (drawerFacing === 'right') {
          // Faces +X (90°): Front facade at +sx/2, bar horizontal along Z
          group.position.set(sx / 2 + 15, 0, 0);
          group.rotation.set(0, Math.PI / 2, 0);
          if (isBarOrCup) {
            group.rotateZ(Math.PI / 2);
          }
        } else if (drawerFacing === 'left') {
          // Faces -X (270°): Front facade at -sx/2, bar horizontal along Z
          group.position.set(-sx / 2 - 15, 0, 0);
          group.rotation.set(0, -Math.PI / 2, 0);
          if (isBarOrCup) {
            group.rotateZ(Math.PI / 2);
          }
        }
      }
    }

    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.userData = { isHandle: true, part, parentPartId: part.id };
      }
    });

    return group;
  }

  private createHingesMesh(
    part: Part,
    hw: PartHardwareConfig,
    sx: number,
    sy: number,
    sz: number,
    hingeSide: 'left' | 'right' | 'top' | 'bottom'
  ): THREE.Group {
    const group = new THREE.Group();
    if (hw.hingeType === 'none') return group;

    const hingeMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.85,
      roughness: 0.25
    });

    const isGasPiston = hw.hingeType === 'gas_piston' || hingeSide === 'top';

    if (isGasPiston) {
      const pistonOffsets = [-sx / 2 + 35, sx / 2 - 35];
      for (const ox of pistonOffsets) {
        const piston = new THREE.Group();
        const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 120, 16), hingeMat);
        const rod = new THREE.Mesh(
          new THREE.CylinderGeometry(4, 4, 100, 14),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 })
        );
        rod.position.y = -60;
        piston.add(cylinder);
        piston.add(rod);
        piston.position.set(ox, 0, -sz / 2 - 25);
        piston.rotation.x = -Math.PI / 4;
        group.add(piston);
      }
    } else {
      const hingeYPositions: number[] = [];
      const margin = 100;
      hingeYPositions.push(sy / 2 - margin);
      hingeYPositions.push(-sy / 2 + margin);
      if (sy > 1000) {
        hingeYPositions.push(0);
      }
      if (sy > 1700) {
        hingeYPositions.push(sy / 4);
      }

      const hingeX = hingeSide === 'left' ? -sx / 2 + 22.5 : sx / 2 - 22.5;

      for (const hy of hingeYPositions) {
        const singleHinge = new THREE.Group();

        const cup = new THREE.Mesh(new THREE.CylinderGeometry(17.5, 17.5, 12, 20), hingeMat);
        cup.rotation.x = Math.PI / 2;
        cup.position.set(0, 0, -sz / 2 + 6);
        singleHinge.add(cup);

        const arm = new THREE.Mesh(new THREE.BoxGeometry(18, 14, 45), hingeMat);
        const armOffsetX = hingeSide === 'left' ? -12 : 12;
        arm.position.set(armOffsetX, 0, -sz / 2 - 16);
        singleHinge.add(arm);

        singleHinge.position.set(hingeX, hy, 0);
        group.add(singleHinge);
      }
    }

    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.userData = { isHinge: true, part, parentPartId: part.id };
      }
    });

    return group;
  }

  private createDrawerBoxMesh(
    part: Part,
    sx: number,
    sy: number,
    sz: number,
    drawerFacing: 'front' | 'right' | 'back' | 'left' = 'front'
  ): THREE.Group {
    const boxGroup = new THREE.Group();
    const t = 15; // standard drawer box wall thickness 15mm
    const isSideFacing = drawerFacing === 'right' || drawerFacing === 'left';
    const frontWidth = isSideFacing ? sz : sx;
    const frontThickness = isSideFacing ? sx : sz;
    const frontHeight = sy;
    const availableDepth = Math.max(250, (part.width || 450) - 25);
    const standardLengths = [250, 300, 350, 400, 450, 500, 550, 600];
    const boxDepth = standardLengths.filter(l => l <= availableDepth).pop() || 350;
    const boxHeight = Math.max(80, Math.min(Math.floor(frontHeight * 0.72), 220));

    // Standard clearances: 12.7mm (1/2") telescopic slide per side + 18mm carcass side panels
    const carcassSideT = 18;
    const clearance = 12.7;
    const boxOuterWidth = Math.max(120, frontWidth - (2 * carcassSideT) - (2 * clearance));
    const boxInnerWidth = Math.max(80, boxOuterWidth - (2 * t));

    const boxMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc, // Clean melamine interior
      roughness: 0.65,
      metalness: 0.05
    });

    const bottomMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // MDF bottom board
      roughness: 0.7,
      metalness: 0.02
    });

    const edgeLineMat = new THREE.LineBasicMaterial({
      color: 0x94a3b8,
      linewidth: 1
    });

    const addBoxPart = (geometry: THREE.BoxGeometry, x: number, y: number, z: number, mat: THREE.Material) => {
      const pMesh = new THREE.Mesh(geometry, mat);
      pMesh.position.set(x, y, z);
      pMesh.castShadow = true;
      pMesh.receiveShadow = true;
      const edges = new THREE.EdgesGeometry(geometry);
      const lines = new THREE.LineSegments(edges, edgeLineMat);
      pMesh.add(lines);
      boxGroup.add(pMesh);
    };

    const centerY = - (frontHeight - boxHeight) * 0.15;
    const centerZ = - (frontThickness / 2) - (boxDepth / 2);

    // 1. Lateral Izquierdo de la gaveta
    addBoxPart(
      new THREE.BoxGeometry(t, boxHeight, boxDepth),
      - (boxOuterWidth / 2) + (t / 2),
      centerY,
      centerZ,
      boxMat
    );

    // 2. Lateral Derecho de la gaveta
    addBoxPart(
      new THREE.BoxGeometry(t, boxHeight, boxDepth),
      (boxOuterWidth / 2) - (t / 2),
      centerY,
      centerZ,
      boxMat
    );

    // 3. Trasera interior de la gaveta
    addBoxPart(
      new THREE.BoxGeometry(boxInnerWidth, boxHeight, t),
      0,
      centerY,
      - (frontThickness / 2) - boxDepth + (t / 2),
      boxMat
    );

    // 4. Frente Interior / Contrafrente de la gaveta
    addBoxPart(
      new THREE.BoxGeometry(boxInnerWidth, boxHeight, t),
      0,
      centerY,
      - (frontThickness / 2) - (t / 2),
      boxMat
    );

    // 5. Fondo de la gaveta (MDF 6mm)
    const bottomThickness = 6;
    addBoxPart(
      new THREE.BoxGeometry(boxOuterWidth - 8, bottomThickness, boxDepth - 8),
      0,
      centerY - (boxHeight / 2) + 8,
      centerZ,
      bottomMat
    );

    // Orient whole box according to drawer facing
    if (drawerFacing === 'back') {
      boxGroup.rotation.y = Math.PI;
    } else if (drawerFacing === 'right') {
      boxGroup.rotation.y = Math.PI / 2;
    } else if (drawerFacing === 'left') {
      boxGroup.rotation.y = -Math.PI / 2;
    }

    return boxGroup;
  }

  private createDrawerSlidesMesh(
    part: Part,
    hw: PartHardwareConfig,
    sx: number,
    sy: number,
    sz: number,
    drawerFacing: 'front' | 'right' | 'back' | 'left' = 'front'
  ): THREE.Group {
    const group = new THREE.Group();
    if (hw.slideType === 'none') return group;

    const slideType = hw.slideType || 'telescopic';

    // Commercial standard nominal lengths: 250, 300, 350, 400, 450, 500, 550, 600 mm
    const standardLengths = [250, 300, 350, 400, 450, 500, 550, 600];
    const availableDepth = Math.max(250, (part.width || 450) - 25);
    const nominalLength = standardLengths.filter(l => l <= availableDepth).pop() || 350;

    // Standard dimensions per slide type
    let railHeight = 45; // mm standard heavy duty
    let railThickness = 12.7; // 1/2" side gap per side
    if (slideType === 'telescopic_35') {
      railHeight = 35;
      railThickness = 12.5;
    } else if (slideType === 'undermount') {
      railHeight = 28;
      railThickness = 21; // under-mount bottom clearance
    }

    const slideSteelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.88,
      roughness: 0.22
    });

    const ballBearingMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.1
    });

    const damperMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Hydraulic blue damper
      metalness: 0.5,
      roughness: 0.3
    });

    const clipMat = new THREE.MeshStandardMaterial({
      color: 0xea580c, // Undermount front quick-release orange clip
      roughness: 0.35
    });

    const createSingleSlideAssembly = (isLeft: boolean): THREE.Group => {
      const slideAssembly = new THREE.Group();

      if (slideType === 'undermount') {
        // --- CORREDERA OCULTA BAJO CAJÓN (TANDEM) ---
        const mainTrack = new THREE.Mesh(
          new THREE.BoxGeometry(18, railHeight, nominalLength),
          slideSteelMat
        );
        mainTrack.position.set(0, 0, -nominalLength / 2);
        slideAssembly.add(mainTrack);

        // Front 3D quick-release locking catch
        const frontClip = new THREE.Mesh(
          new THREE.BoxGeometry(22, 14, 25),
          clipMat
        );
        frontClip.position.set(0, -railHeight / 2 + 7, -12.5);
        slideAssembly.add(frontClip);

        // Synchronizer pinion / rear damper
        const rearDamper = new THREE.Mesh(
          new THREE.BoxGeometry(14, 12, 45),
          damperMat
        );
        rearDamper.position.set(0, 0, -nominalLength + 25);
        slideAssembly.add(rearDamper);
      } else {
        // --- CORREDERA TELESCÓPICA (45mm, SOFT-CLOSE O 35mm) ---
        // 1. Carcase Outer Member (Stationary C-profile against internal side wall)
        const outerProfile = new THREE.Mesh(
          new THREE.BoxGeometry(4.5, railHeight, nominalLength),
          slideSteelMat
        );
        outerProfile.position.set(isLeft ? -3.5 : 3.5, 0, -nominalLength / 2);
        slideAssembly.add(outerProfile);

        // 2. Intermediate Ball-Bearing Carriage
        const intermediateProfile = new THREE.Mesh(
          new THREE.BoxGeometry(3.5, railHeight * 0.72, nominalLength * 0.9),
          ballBearingMat
        );
        intermediateProfile.position.set(0, 0, -nominalLength / 2 + 10);
        slideAssembly.add(intermediateProfile);

        // 3. Inner Drawer Member (Attached to drawer box)
        const innerProfile = new THREE.Mesh(
          new THREE.BoxGeometry(4.0, railHeight * 0.55, nominalLength * 0.85),
          slideSteelMat
        );
        innerProfile.position.set(isLeft ? 3.5 : -3.5, 0, -nominalLength / 2 + 15);
        slideAssembly.add(innerProfile);

        // System 32 stamped mounting hole visual dots on rail
        const holeGeo = new THREE.CylinderGeometry(2.2, 2.2, 5, 12);
        const holeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
        const holeSpacings = [37, 69, 101, 165, 229];
        for (const distFromFront of holeSpacings) {
          if (distFromFront < nominalLength - 30) {
            const dot = new THREE.Mesh(holeGeo, holeMat);
            dot.rotation.z = Math.PI / 2;
            dot.position.set(isLeft ? -3.5 : 3.5, 0, -distFromFront);
            slideAssembly.add(dot);
          }
        }

        // Soft-Close Hydraulic Piston & Spring Return Unit
        if (slideType === 'soft_close') {
          const piston = new THREE.Mesh(
            new THREE.CylinderGeometry(3.2, 3.2, 50, 12),
            damperMat
          );
          piston.rotation.x = Math.PI / 2;
          piston.position.set(isLeft ? -1 : 1, -railHeight * 0.2, -nominalLength + 35);
          slideAssembly.add(piston);

          const triggerCatch = new THREE.Mesh(
            new THREE.BoxGeometry(5, 10, 16),
            damperMat
          );
          triggerCatch.position.set(isLeft ? 1 : -1, railHeight * 0.2, -nominalLength + 55);
          slideAssembly.add(triggerCatch);
        }
      }

      return slideAssembly;
    };

    // Calculate positions relative to drawer lateral panels or carcass
    const allParts = this.parts();
    const px = part.posX ?? 0;
    const pz = part.posZ ?? 0;
    const isSideFacing = drawerFacing === 'right' || drawerFacing === 'left';

    // 1. Find lateral box panels belonging to this drawer:
    let drawerLatIzq: Part | undefined;
    let drawerLatDer: Part | undefined;

    if (part.groupId) {
      drawerLatIzq = allParts.find(p => p.groupId === part.groupId && (p.id.includes('lat_izq') || p.name.toUpperCase().includes('LATERAL IZQ')));
      drawerLatDer = allParts.find(p => p.groupId === part.groupId && (p.id.includes('lat_der') || p.name.toUpperCase().includes('LATERAL DER')));
    }

    if (!drawerLatIzq || !drawerLatDer) {
      const prefix = part.id.includes('_frente') ? part.id.split('_frente')[0] : (part.id.includes('_front') ? part.id.split('_front')[0] : '');
      if (prefix) {
        if (!drawerLatIzq) drawerLatIzq = allParts.find(p => p.id.startsWith(prefix) && (p.id.includes('lat_izq') || p.name.toUpperCase().includes('LATERAL IZQ')));
        if (!drawerLatDer) drawerLatDer = allParts.find(p => p.id.startsWith(prefix) && (p.id.includes('lat_der') || p.name.toUpperCase().includes('LATERAL DER')));
      }
    }

    let posY = -sy * 0.15;
    if (slideType === 'undermount') {
      posY = -sy / 2 + 14;
    }

    if (!isSideFacing) {
      // --- DRAWER FACES FRONT (+Z) OR BACK (-Z) ---
      // Front is in XY. Laterals have thickness along X.
      let leftX = 0;
      let rightX = 0;

      if (drawerLatIzq && drawerLatDer) {
        const x1 = drawerLatIzq.posX ?? 0;
        const x2 = drawerLatDer.posX ?? 0;
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const t1 = (x1 === minX ? drawerLatIzq : drawerLatDer).thickness || 15;
        const t2 = (x2 === maxX ? drawerLatDer : drawerLatIzq).thickness || 15;
        // Mount strictly to outside faces of lateral panels
        leftX = (minX - (t1 / 2) - px) - (railThickness / 2);
        rightX = (maxX + (t2 / 2) - px) + (railThickness / 2);
      } else {
        const boxHalfWidth = Math.max(50, (sx / 2) - 13);
        leftX = -boxHalfWidth - (railThickness / 2);
        rightX = boxHalfWidth + (railThickness / 2);
      }

      if (slideType === 'undermount') {
        leftX = (-sx / 2) + 28;
        rightX = (sx / 2) - 28;
      }

      if (drawerFacing === 'front') {
        // Faces +Z (0°): slides extend along -Z
        const posZ = -sz / 2 - 2;
        const leftSlide = createSingleSlideAssembly(true);
        leftSlide.position.set(leftX, posY, posZ);
        leftSlide.rotation.y = 0;

        const rightSlide = createSingleSlideAssembly(false);
        rightSlide.position.set(rightX, posY, posZ);
        rightSlide.rotation.y = 0;

        group.add(leftSlide);
        group.add(rightSlide);
      } else {
        // Faces -Z (180°): slides extend along +Z
        const posZ = sz / 2 + 2;
        const leftSlide = createSingleSlideAssembly(false);
        leftSlide.position.set(rightX, posY, posZ);
        leftSlide.rotation.y = Math.PI;

        const rightSlide = createSingleSlideAssembly(true);
        rightSlide.position.set(leftX, posY, posZ);
        rightSlide.rotation.y = Math.PI;

        group.add(leftSlide);
        group.add(rightSlide);
      }
    } else {
      // --- DRAWER FACES RIGHT (+X) OR LEFT (-X) ---
      // Front is in YZ (thickness in X, width in Z). Laterals have thickness along Z.
      let leftZ = 0;
      let rightZ = 0;

      if (drawerLatIzq && drawerLatDer) {
        const z1 = drawerLatIzq.posZ ?? 0;
        const z2 = drawerLatDer.posZ ?? 0;
        const minZ = Math.min(z1, z2);
        const maxZ = Math.max(z1, z2);
        const t1 = (z1 === minZ ? drawerLatIzq : drawerLatDer).thickness || 15;
        const t2 = (z2 === maxZ ? drawerLatDer : drawerLatIzq).thickness || 15;
        // Mount strictly to outside faces of lateral panels
        leftZ = (minZ - (t1 / 2) - pz) - (railThickness / 2);
        rightZ = (maxZ + (t2 / 2) - pz) + (railThickness / 2);
      } else {
        const boxHalfWidth = Math.max(50, (sz / 2) - 13);
        leftZ = -boxHalfWidth - (railThickness / 2);
        rightZ = boxHalfWidth + (railThickness / 2);
      }

      if (slideType === 'undermount') {
        leftZ = (-sz / 2) + 28;
        rightZ = (sz / 2) - 28;
      }

      if (drawerFacing === 'right') {
        // Faces +X (90°): slides start at -sx/2 - 2 and extend along -X (rotation.y = Math.PI / 2)
        const posX = -sx / 2 - 2;
        const leftSlide = createSingleSlideAssembly(false);
        leftSlide.position.set(posX, posY, leftZ);
        leftSlide.rotation.y = Math.PI / 2;

        const rightSlide = createSingleSlideAssembly(true);
        rightSlide.position.set(posX, posY, rightZ);
        rightSlide.rotation.y = Math.PI / 2;

        group.add(leftSlide);
        group.add(rightSlide);
      } else {
        // Faces -X (270°): slides start at +sx/2 + 2 and extend along +X (rotation.y = -Math.PI / 2)
        const posX = sx / 2 + 2;
        const leftSlide = createSingleSlideAssembly(true);
        leftSlide.position.set(posX, posY, rightZ);
        leftSlide.rotation.y = -Math.PI / 2;

        const rightSlide = createSingleSlideAssembly(false);
        rightSlide.position.set(posX, posY, leftZ);
        rightSlide.rotation.y = -Math.PI / 2;

        group.add(leftSlide);
        group.add(rightSlide);
      }
    }

    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.userData = { isSlide: true, part, parentPartId: part.id };
      }
    });

    return group;
  }

  private renderDrillHolesVisuals(holes: DrillHole[]) {
    for (const hole of holes) {
      const holeGroup = new THREE.Group();

      let color = 0x06b6d4; // Cyan for screws 4x50
      let cylRadius = Math.max(2.5, hole.diameter / 2);
      let cylHeight = Math.min(24, hole.depth);

      if (hole.type === 'dowel_8x30') {
        color = 0xf59e0b; // Amber for dowels 8x30
        cylRadius = 4.0;
        cylHeight = 16;
      } else if (hole.type === 'hinge_35') {
        color = 0xa855f7; // Purple for 35mm hinge cups
        cylRadius = 17.5;
        cylHeight = 12.5;
      } else if (hole.type === 'slide_system32') {
        color = 0x10b981; // Emerald green for System 32 slide drill holes
        cylRadius = 2.5;
        cylHeight = 11.5;
      } else if (hole.type === 'handle_hole_4') {
        color = 0x38bdf8; // Sky blue for handle holes
        cylRadius = 2.0;
        cylHeight = 18;
      }

      // 3D Drill Bore Cylinder
      const cylGeo = new THREE.CylinderGeometry(cylRadius, cylRadius, cylHeight, 20);
      const cylMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.25,
        metalness: 0.35,
        emissive: color,
        emissiveIntensity: 0.35,
        depthTest: true
      });
      const cylMesh = new THREE.Mesh(cylGeo, cylMat);

      // Orient cylinder based on normalAxis
      if (hole.normalAxis === 'x') {
        cylMesh.rotation.z = Math.PI / 2;
      } else if (hole.normalAxis === 'z') {
        cylMesh.rotation.x = Math.PI / 2;
      }

      holeGroup.add(cylMesh);

      // Technical entry ring for high-precision CAD look
      const ringGeo = new THREE.RingGeometry(cylRadius * 0.75, cylRadius * 1.15, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        side: THREE.DoubleSide,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      if (hole.normalAxis === 'x') {
        ringMesh.rotation.y = Math.PI / 2;
      } else if (hole.normalAxis === 'y') {
        ringMesh.rotation.x = Math.PI / 2;
      }
      holeGroup.add(ringMesh);

      const targetPieceItem = this.pieceObjects.find(p => p.part.id === hole.partId);
      cylMesh.userData = { isDrillHole: true, part: targetPieceItem?.part, parentPartId: hole.partId };
      ringMesh.userData = { isDrillHole: true, part: targetPieceItem?.part, parentPartId: hole.partId };

      // ATTACH HINGE BOREHOLES TO THE DOOR MESH SO THEY ROTATE IN SYNC!
      if (targetPieceItem?.doorPivot && hole.type === 'hinge_35') {
        const localPos = new THREE.Vector3(
          hole.posX - targetPieceItem.originalPos.x,
          hole.posY - targetPieceItem.originalPos.y,
          hole.posZ - targetPieceItem.originalPos.z
        );
        holeGroup.position.copy(localPos);
        targetPieceItem.mesh.add(holeGroup);
      } else {
        holeGroup.position.set(hole.posX, hole.posY, hole.posZ);
        this.drillGroup.add(holeGroup);
      }
    }
  }

  private createPieceMaterial(
    part: Part,
    isSelected: boolean,
    mats: Material[],
    xRay: boolean,
    isColliding = false
  ): THREE.Material {
    if (isColliding) {
      // Striking ruby red highlight for collided / penetrating pieces
      return new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x991b1b,
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.85,
        roughness: 0.25,
        metalness: 0.15
      });
    }

    if (isSelected) {
      // Technical Blueprint Cobalt Blue
      return new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        emissive: 0x1e3a8a,
        emissiveIntensity: 0.28,
        roughness: 0.32,
        metalness: 0.12
      });
    }

    // Material color resolution
    const assignedMat = mats.find(m => m.id === part.materialId);
    let colorHex = part.colorHex || assignedMat?.colorHex || '#b48a60';
    if (part.name.toLowerCase().includes('fondo') || part.thickness <= 4) {
      colorHex = '#e5e5e5';
    }

    if (xRay) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        transparent: true,
        opacity: 0.35,
        roughness: 0.4
      });
    }

    const texType = assignedMat?.textureType;
    let textureMap: THREE.CanvasTexture | null = null;
    if (typeof document !== 'undefined' && (texType === 'wood' || texType === 'stone')) {
      textureMap = this.getProceduralTexture(colorHex, texType);
    }

    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      map: textureMap,
      roughness: texType === 'wood' ? 0.65 : (texType === 'stone' ? 0.25 : 0.4),
      metalness: texType === 'stone' ? 0.1 : 0.05
    });
  }

  private textureCache = new Map<string, THREE.CanvasTexture>();

  private getProceduralTexture(colorHex: string, type: 'wood' | 'stone'): THREE.CanvasTexture {
    const key = `${type}_${colorHex}`;
    const cached = this.textureCache.get(key);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 256, 256);

    if (type === 'wood') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      for (let i = 0; i < 256; i += 6) {
        ctx.fillRect(0, i, 256, 1.5 + (i % 3));
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      for (let i = 3; i < 256; i += 8) {
        ctx.fillRect(0, i, 256, 1);
      }
    } else if (type === 'stone') {
      ctx.strokeStyle = colorHex.toLowerCase() === '#262626' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 30);
      ctx.bezierCurveTo(80, 100, 160, 40, 240, 180);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(30, 150);
      ctx.bezierCurveTo(110, 190, 180, 130, 230, 230);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    this.textureCache.set(key, tex);
    return tex;
  }

  // Draw 3D dimension lines and text sprites matching reference image
  private renderPieceDimensions(
    part: Part,
    px: number,
    py: number,
    pz: number,
    sx: number,
    sy: number,
    sz: number
  ) {
    const dimGroup = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({ color: 0x2563eb, linewidth: 2 });

    const offsetY = sy / 2 + 35;
    const offsetZ = sz / 2 + 25;

    // Horizontal dimension line along X
    const p1 = new THREE.Vector3(px - sx / 2, py + offsetY, pz + offsetZ);
    const p2 = new THREE.Vector3(px + sx / 2, py + offsetY, pz + offsetZ);

    const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const line = new THREE.Line(lineGeo, lineMat);
    dimGroup.add(line);

    const tickH = 15;
    const t1 = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p1.x, p1.y - tickH, p1.z),
        new THREE.Vector3(p1.x, p1.y + tickH, p1.z)
      ]),
      lineMat
    );
    const t2 = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(p2.x, p2.y - tickH, p2.z),
        new THREE.Vector3(p2.x, p2.y + tickH, p2.z)
      ]),
      lineMat
    );
    dimGroup.add(t1);
    dimGroup.add(t2);

    const lengthSprite = this.createTextSprite(`${part.length} mm`);
    lengthSprite.position.set((p1.x + p2.x) / 2, py + offsetY + 25, (p1.z + p2.z) / 2);
    dimGroup.add(lengthSprite);

    // Width / Depth dimension line
    const p3 = new THREE.Vector3(px + sx / 2 + 30, py, pz - sz / 2);
    const p4 = new THREE.Vector3(px + sx / 2 + 30, py, pz + sz / 2);
    const widthLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([p3, p4]),
      lineMat
    );
    dimGroup.add(widthLine);

    const widthSprite = this.createTextSprite(`${part.width} mm`);
    widthSprite.position.set(px + sx / 2 + 45, py + 20, (p3.z + p4.z) / 2);
    dimGroup.add(widthSprite);

    this.dimensionGroup.add(dimGroup);
  }

  // Generates 3D billboard sprite with high-res text
  private createTextSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      const r = 16;
      ctx.beginPath();
      ctx.moveTo(r, 4);
      ctx.lineTo(256 - r, 4);
      ctx.quadraticCurveTo(256 - 4, 4, 256 - 4, r);
      ctx.lineTo(256 - 4, 80 - r);
      ctx.quadraticCurveTo(256 - 4, 80 - 4, 256 - r, 80 - 4);
      ctx.lineTo(r, 80 - 4);
      ctx.quadraticCurveTo(4, 80 - 4, 4, 80 - r);
      ctx.lineTo(4, r);
      ctx.quadraticCurveTo(4, 4, r, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 42);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(130, 42, 1);
    return sprite;
  }

  // Generates Emerald Green 3D billboard sprite for Clearance Dimensions (Luz Libre)
  private createClearanceSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = 'rgba(6, 78, 59, 0.95)'; // emerald-900 glass
      ctx.strokeStyle = '#10b981'; // emerald-500
      ctx.lineWidth = 3.5;
      const r = 16;
      ctx.beginPath();
      ctx.moveTo(r, 4);
      ctx.lineTo(280 - r, 4);
      ctx.quadraticCurveTo(280 - 4, 4, 280 - 4, r);
      ctx.lineTo(280 - 4, 80 - r);
      ctx.quadraticCurveTo(280 - 4, 80 - 4, 280 - r, 80 - 4);
      ctx.lineTo(r, 80 - 4);
      ctx.quadraticCurveTo(4, 80 - 4, 4, 80 - r);
      ctx.lineTo(4, r);
      ctx.quadraticCurveTo(4, 4, r, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ecfdf5'; // emerald-50
      ctx.font = 'bold 30px ui-monospace, SFMono-Regular, Menlo, Monaco, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 140, 42);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(140, 42, 1);
    return sprite;
  }

  // Dynamic Clearance Computation: Real-time useful internal clearances between shelves/sides/roof/floor
  computeClearanceInfo(part: Part, allParts: Part[]): ClearanceInfo {
    const selBounds = this.getPartBounds(part);
    const others = allParts.filter(p => p.id !== part.id);

    let topClearance: number | null = null;
    let topNeighborName: string | null = null;
    let bottomClearance: number | null = null;
    let bottomNeighborName: string | null = null;
    let leftClearance: number | null = null;
    let leftNeighborName: string | null = null;
    let rightClearance: number | null = null;
    let rightNeighborName: string | null = null;

    let minTopGap = Infinity;
    let minBottomGap = Infinity;
    let minLeftGap = Infinity;
    let minRightGap = Infinity;

    for (const o of others) {
      const oBounds = this.getPartBounds(o);

      // Overlap in X and Z (for vertical clearances: above & below)
      const overlapX = Math.max(0, Math.min(selBounds.maxX, oBounds.maxX) - Math.max(selBounds.minX, oBounds.minX));
      const overlapZ = Math.max(0, Math.min(selBounds.maxZ, oBounds.maxZ) - Math.max(selBounds.minZ, oBounds.minZ));

      if (overlapX > 15 && overlapZ > 15) {
        // Element directly above
        if (oBounds.minY >= selBounds.maxY - 1) {
          const gap = oBounds.minY - selBounds.maxY;
          if (gap < minTopGap) {
            minTopGap = gap;
            topClearance = Math.round(gap);
            topNeighborName = o.name;
          }
        }
        // Element directly below
        if (oBounds.maxY <= selBounds.minY + 1) {
          const gap = selBounds.minY - oBounds.maxY;
          if (gap < minBottomGap) {
            minBottomGap = gap;
            bottomClearance = Math.round(gap);
            bottomNeighborName = o.name;
          }
        }
      }

      // Overlap in Y and Z (for horizontal clearances: left & right)
      const overlapY = Math.max(0, Math.min(selBounds.maxY, oBounds.maxY) - Math.max(selBounds.minY, oBounds.minY));
      if (overlapY > 15 && overlapZ > 15) {
        // Element to the left
        if (oBounds.maxX <= selBounds.minX + 1) {
          const gap = selBounds.minX - oBounds.maxX;
          if (gap < minLeftGap) {
            minLeftGap = gap;
            leftClearance = Math.round(gap);
            leftNeighborName = o.name;
          }
        }
        // Element to the right
        if (oBounds.minX >= selBounds.maxX - 1) {
          const gap = oBounds.minX - selBounds.maxX;
          if (gap < minRightGap) {
            minRightGap = gap;
            rightClearance = Math.round(gap);
            rightNeighborName = o.name;
          }
        }
      }
    }

    return {
      topClearance,
      bottomClearance,
      leftClearance,
      rightClearance,
      topNeighborName,
      bottomNeighborName,
      leftNeighborName,
      rightNeighborName
    };
  }

  // Draw 3D Technical Clearance Lines (Luz Libre)
  private renderClearanceDimensions(part: Part, allParts: Part[]) {
    const clr = this.computeClearanceInfo(part, allParts);
    this.clearanceCalculated.emit(clr);

    const selBounds = this.getPartBounds(part);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x10b981,
      dashSize: 14,
      gapSize: 7,
      linewidth: 2,
      depthTest: false
    });
    const tickMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2, depthTest: false });

    // Render Vertical Top Clearance Line
    if (clr.topClearance !== null && clr.topClearance > 5) {
      const topY = selBounds.maxY + clr.topClearance;
      const midY = (selBounds.maxY + topY) / 2;
      const x = selBounds.px;
      const z = selBounds.pz + selBounds.sz / 2 + 15;

      const p1 = new THREE.Vector3(x, selBounds.maxY, z);
      const p2 = new THREE.Vector3(x, topY, z);
      const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const dashedLine = new THREE.Line(geo, lineMat);
      dashedLine.computeLineDistances();
      this.dimensionGroup.add(dashedLine);

      // Arrow ticks
      const tickW = 18;
      const t1 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x - tickW, selBounds.maxY, z),
        new THREE.Vector3(x + tickW, selBounds.maxY, z)
      ]), tickMat);
      const t2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x - tickW, topY, z),
        new THREE.Vector3(x + tickW, topY, z)
      ]), tickMat);
      this.dimensionGroup.add(t1, t2);

      const sprite = this.createClearanceSprite(`↕ Luz: ${clr.topClearance} mm`);
      sprite.position.set(x, midY, z + 12);
      this.dimensionGroup.add(sprite);
    }

    // Render Vertical Bottom Clearance Line
    if (clr.bottomClearance !== null && clr.bottomClearance > 5) {
      const botY = selBounds.minY - clr.bottomClearance;
      const midY = (selBounds.minY + botY) / 2;
      const x = selBounds.px;
      const z = selBounds.pz + selBounds.sz / 2 + 15;

      const p1 = new THREE.Vector3(x, botY, z);
      const p2 = new THREE.Vector3(x, selBounds.minY, z);
      const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const dashedLine = new THREE.Line(geo, lineMat);
      dashedLine.computeLineDistances();
      this.dimensionGroup.add(dashedLine);

      const tickW = 18;
      const t1 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x - tickW, botY, z),
        new THREE.Vector3(x + tickW, botY, z)
      ]), tickMat);
      const t2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x - tickW, selBounds.minY, z),
        new THREE.Vector3(x + tickW, selBounds.minY, z)
      ]), tickMat);
      this.dimensionGroup.add(t1, t2);

      const sprite = this.createClearanceSprite(`↕ Luz: ${clr.bottomClearance} mm`);
      sprite.position.set(x, midY, z + 12);
      this.dimensionGroup.add(sprite);
    }

    // Render Horizontal Left Clearance Line
    if (clr.leftClearance !== null && clr.leftClearance > 5) {
      const leftX = selBounds.minX - clr.leftClearance;
      const midX = (selBounds.minX + leftX) / 2;
      const y = selBounds.py;
      const z = selBounds.pz + selBounds.sz / 2 + 15;

      const p1 = new THREE.Vector3(leftX, y, z);
      const p2 = new THREE.Vector3(selBounds.minX, y, z);
      const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const dashedLine = new THREE.Line(geo, lineMat);
      dashedLine.computeLineDistances();
      this.dimensionGroup.add(dashedLine);

      const sprite = this.createClearanceSprite(`↔ Luz: ${clr.leftClearance} mm`);
      sprite.position.set(midX, y + 25, z + 12);
      this.dimensionGroup.add(sprite);
    }

    // Render Horizontal Right Clearance Line
    if (clr.rightClearance !== null && clr.rightClearance > 5) {
      const rightX = selBounds.maxX + clr.rightClearance;
      const midX = (selBounds.maxX + rightX) / 2;
      const y = selBounds.py;
      const z = selBounds.pz + selBounds.sz / 2 + 15;

      const p1 = new THREE.Vector3(selBounds.maxX, y, z);
      const p2 = new THREE.Vector3(rightX, y, z);
      const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const dashedLine = new THREE.Line(geo, lineMat);
      dashedLine.computeLineDistances();
      this.dimensionGroup.add(dashedLine);

      const sprite = this.createClearanceSprite(`↔ Luz: ${clr.rightClearance} mm`);
      sprite.position.set(midX, y + 25, z + 12);
      this.dimensionGroup.add(sprite);
    }
  }

  toggleClearances() {
    this.showClearances.update(v => !v);
    this.buildFurnitureScene(
      this.parts(),
      this.activeSelectedIds(),
      this.materials(),
      this.isXRay(),
      this.show3dDimensions()
    );
  }

  private updateExplodedOffsets(percent: number) {
    const factor = percent / 100;
    for (const item of this.pieceObjects) {
      if (item.isDoor && item.doorPivot && item.doorPivotOriginalPos && item.doorLocalMeshPos) {
        const targetPivotPos = item.doorPivotOriginalPos
          .clone()
          .addScaledVector(item.explodedOffset, factor);
        item.doorPivot.position.copy(targetPivotPos);
        item.mesh.position.copy(item.doorLocalMeshPos);
      } else if (item.isDrawer) {
        const curOpen = this.openCurrentMap.get(item.part.id) || 0;
        const targetPos = item.originalPos
          .clone()
          .addScaledVector(item.explodedOffset, factor);
        targetPos.z += curOpen * 280;
        item.mesh.position.copy(targetPos);
      } else {
        const targetPos = item.originalPos
          .clone()
          .addScaledVector(item.explodedOffset, factor);
        item.mesh.position.copy(targetPos);
      }
    }
  }

  // Pointer Down: Detect clicks on Gizmo controls vs Pieces vs Empty space vs Measurement picking
  private onPointerDown(e: PointerEvent) {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.camera) return;

    // Close open context menu on canvas interaction
    if (this.contextMenuPos()) {
      this.closeContextMenu();
    }

    // Right-Click tracking: record down coordinates & time to distinguish stationary click from drag pan/orbit
    if (e.button === 2) {
      this.rightPointerDownPos = { x: e.clientX, y: e.clientY };
      this.rightPointerDownTime = Date.now();
      this.rightPointerDragged = false;
      return;
    }

    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 0. Measurement Tape drag mode (Point A -> Clic y arrastrar para estirar y soltar para fijar la cota)
    if (this.isMeasureMode()) {
      // If a measurement is already persistent and the user clicks/drags to orbit/inspect,
      // DO NOT clear or restart the measurement! Let OrbitControls handle it!
      if (this.isMeasurementPersistent()) {
        return;
      }

      const snapCand = this.findMagneticSnapCandidate(e.clientX, e.clientY, 36);
      let snapPt: { x: number; y: number; z: number } | null = null;

      if (snapCand) {
        snapPt = {
          x: Math.round(snapCand.worldPos.x),
          y: Math.max(0, Math.round(snapCand.worldPos.y)),
          z: Math.round(snapCand.worldPos.z)
        };
      } else {
        const measureIntersects = this.raycaster.intersectObjects(
          [...this.pieceObjects.map(p => p.mesh), ...(this.floorMesh ? [this.floorMesh] : [])],
          true
        );
        if (measureIntersects.length > 0) {
          const hit = measureIntersects[0];
          const pt = hit.point;
          const hitPart = hit.object.userData?.['part'] as Part | undefined;
          if (hitPart) {
            const snapPoints = this.getPartSnapPoints(hitPart);
            let closestCorner = null;
            let minCornerDist = 45; // mm in 3D
            for (const sp of snapPoints) {
              const d = pt.distanceTo(sp.pos);
              const effD = sp.type === 'corner' ? d * 0.75 : d;
              if (effD < minCornerDist) {
                minCornerDist = effD;
                closestCorner = sp;
              }
            }
            if (closestCorner) {
              snapPt = {
                x: Math.round(closestCorner.pos.x),
                y: Math.max(0, Math.round(closestCorner.pos.y)),
                z: Math.round(closestCorner.pos.z)
              };
            }
          }
          if (!snapPt) {
            snapPt = {
              x: Math.round(pt.x),
              y: Math.max(0, Math.round(pt.y)),
              z: Math.round(pt.z)
            };
          }
        }
      }

      if (snapPt) {
        this.measurePointA.set(snapPt);
        this.measurePointB.set(snapPt);
        this.isMeasuringDrag = true;
        this.isMeasurementPersistent.set(false);
        this.controls.enabled = false;
        this.renderMeasurementVisuals();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      return;
    }

    // 0.2. Draw 3D Rectangle Tool
    if (this.activeTool() === 'draw_rect') {
      const allFloorAndParts = [
        ...(this.floorMesh ? [this.floorMesh] : []),
        ...this.pieceObjects.map(p => p.mesh)
      ];
      const floorIntersects = this.raycaster.intersectObjects(allFloorAndParts, false);
      if (floorIntersects.length > 0) {
        const pt = floorIntersects[0].point;
        const snap = 10;
        this.rectStartPoint = new THREE.Vector3(
          Math.round(pt.x / snap) * snap,
          Math.round(pt.y),
          Math.round(pt.z / snap) * snap
        );
        this.rectCurrentPoint = this.rectStartPoint.clone();
        this.isDrawingRect.set(true);
        this.controls.enabled = false;
        canvas.style.cursor = 'crosshair';
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    // 0.3. Rotate 90° Tool
    if (this.activeTool() === 'rotate_90') {
      const intersects = this.raycaster.intersectObjects(
        this.pieceObjects.map(p => p.mesh),
        false
      );
      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const part = hit.userData['part'] as Part;
        if (part) {
          this.rotatePart90(part, 'y');
          this.partsSelected.emit([part.id]);
          this.partSelected.emit(part);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    }

    // 0.5. Push/Pull (Empujar / Tirar) Tool
    if (this.activeTool() === 'push_pull') {
      const intersects = this.raycaster.intersectObjects(
        this.pieceObjects.map(p => p.mesh),
        false
      );
      if (intersects.length > 0) {
        const hit = intersects[0];
        if (!hit.face) return;
        const mesh = hit.object as THREE.Mesh;
        const part = mesh.userData['part'] as Part;
        const faceNormal = hit.face.normal.clone();

        const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
        const worldNormal = faceNormal.clone().applyMatrix3(normalMatrix).normalize();

        const absX = Math.abs(worldNormal.x);
        const absY = Math.abs(worldNormal.y);
        const absZ = Math.abs(worldNormal.z);

        let axis: 'x' | 'y' | 'z' = 'x';
        let dir = 1;
        if (absY >= absX && absY >= absZ) {
          axis = 'y';
          dir = worldNormal.y > 0 ? 1 : -1;
        } else if (absX >= absY && absX >= absZ) {
          axis = 'x';
          dir = worldNormal.x > 0 ? 1 : -1;
        } else {
          axis = 'z';
          dir = worldNormal.z > 0 ? 1 : -1;
        }

        const orient = part.orientation || 'horizontal';
        let targetDim: 'length' | 'width' | 'thickness' = 'length';
        let posAxis: 'posX' | 'posY' | 'posZ' = 'posX';
        let axisName = 'Largo';

        if (orient === 'horizontal') {
          if (axis === 'x') {
            targetDim = 'length';
            posAxis = 'posX';
            axisName = 'Largo';
          } else if (axis === 'z') {
            targetDim = 'width';
            posAxis = 'posZ';
            axisName = 'Ancho';
          } else {
            // Y normal face is the top or bottom board face -> Thickness!
            targetDim = 'thickness';
            posAxis = 'posY';
            axisName = 'Espesor';
          }
        } else if (orient === 'vertical_yz') {
          if (axis === 'y') {
            targetDim = 'length';
            posAxis = 'posY';
            axisName = 'Alto';
          } else if (axis === 'z') {
            targetDim = 'width';
            posAxis = 'posZ';
            axisName = 'Fondo';
          } else {
            // X normal face is perpendicular to board plane -> Thickness!
            targetDim = 'thickness';
            posAxis = 'posX';
            axisName = 'Espesor';
          }
        } else {
          // vertical_xy
          if (axis === 'x') {
            targetDim = 'length';
            posAxis = 'posX';
            axisName = 'Largo';
          } else if (axis === 'y') {
            targetDim = 'width';
            posAxis = 'posY';
            axisName = 'Alto';
          } else {
            // Z normal face is perpendicular to board plane -> Thickness!
            targetDim = 'thickness';
            posAxis = 'posZ';
            axisName = 'Espesor';
          }
        }

        this.isPushPulling = true;
        this.controls.enabled = false;
        this.dragStarted.emit();

        // Select piece
        this.partsSelected.emit([part.id]);
        this.partSelected.emit(part);

        const initialDim = targetDim === 'thickness'
          ? (part.thickness || 18)
          : (targetDim === 'length' ? part.length : part.width);
        const initialPos = (part[posAxis] ?? 0);

        const axisVector = new THREE.Vector3();
        if (axis === 'x') axisVector.set(1, 0, 0);
        else if (axis === 'y') axisVector.set(0, 1, 0);
        else axisVector.set(0, 0, 1);

        this.pushPullData = {
          part: { ...part },
          targetDim,
          posAxis,
          dir,
          initialDim,
          initialPos,
          axisVector,
          normalVector: worldNormal,
          faceCenter: hit.point.clone()
        };

        const camDir = new THREE.Vector3();
        this.camera.getWorldDirection(camDir);
        this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), hit.point);

        const intersectPoint = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
          this.dragPlaneIntersectionStart.copy(intersectPoint);
        }

        this.pushPullDelta.set({
          axisName,
          initialVal: initialDim,
          currentVal: initialDim,
          delta: 0
        });

        canvas.style.cursor = 'grabbing';
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    // 1. Check if clicking on Gizmo translation arrow or stretch handle
    if (this.gizmoHitMeshes.length > 0) {
      const gizmoIntersects = this.raycaster.intersectObjects(this.gizmoHitMeshes, true);
      if (gizmoIntersects.length > 0) {
        const hit = gizmoIntersects[0].object;
        const hitData = hit.userData as GizmoHitData;
        const selParts = this.selectedParts();

        if (hitData && hitData.isGizmo && selParts.length > 0) {
          this.isDragging = true;
          this.activeGizmoHit = hitData;
          this.dragStartPointer = { x: e.clientX, y: e.clientY };
          this.dragInitialPart = { ...selParts[0] };
          this.dragInitialParts = selParts.map(p => ({ ...p }));

          // Notify parent to capture history snapshot before starting continuous drag
          this.dragStarted.emit();

          // Disable camera rotation while dragging gizmo
          this.controls.enabled = false;

          // Set up a raycasting plane facing the camera or orthogonal to axis
          const centroid = this.calculateCentroid(selParts);
          const piecePos = new THREE.Vector3(centroid.x, centroid.y, centroid.z);
          const camDir = new THREE.Vector3();
          this.camera.getWorldDirection(camDir);
          this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), piecePos);

          const intersectPoint = new THREE.Vector3();
          if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
            this.dragPlaneIntersectionStart.copy(intersectPoint);
          }

          canvas.style.cursor = 'grabbing';
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    }

    // 2. Normal Piece & Handle selection (with Shift-Click multi-selection)
    const targets: THREE.Object3D[] = [];
    for (const item of this.pieceObjects) {
      targets.push(item.mesh);
      if (item.doorPivot) targets.push(item.doorPivot);
    }
    targets.push(this.drillGroup);

    const intersects = this.raycaster.intersectObjects(targets, true);

    if (intersects.length > 0) {
      const topHit = intersects[0].object as THREE.Mesh;
      let part = topHit.userData['part'] as Part | undefined;
      let isDoor = topHit.userData['isDoor'];
      let isDrawer = topHit.userData['isDrawer'];
      let isHandle = topHit.userData['isHandle'];

      // Ascend parent hierarchy if hit was a handle sub-mesh or drill cylinder
      let currObj: THREE.Object3D | null = topHit;
      while (currObj && !part && currObj !== this.furnitureGroup && currObj !== this.scene) {
        if (currObj.userData?.['part']) {
          part = currObj.userData['part'];
          isDoor = isDoor || currObj.userData['isDoor'];
          isDrawer = isDrawer || currObj.userData['isDrawer'];
          isHandle = isHandle || currObj.userData['isHandle'];
          break;
        }
        currObj = currObj.parent;
      }

      if (part) {
        // Clicking a 3D handle toggles opening animation
        if (isHandle) {
          this.togglePartOpen(part.id);
        }
        if (e.shiftKey) {
          const cur = [...this.activeSelectedIds()];
          const idx = cur.indexOf(part.id);
          if (idx >= 0) {
            cur.splice(idx, 1);
          } else {
            cur.push(part.id);
          }
          this.partsSelected.emit(cur);
          if (cur.length === 0) {
            this.partSelected.emit(null);
          }
        } else {
          // If part belongs to a group (e.g. modular drawer), select the entire group for block translation!
          let partsToSelect: Part[] = [];
          if (part.groupId) {
            const groupParts = this.parts().filter(p => p.groupId === part.groupId);
            partsToSelect = groupParts.length > 0 ? groupParts : [part];
            this.partsSelected.emit(partsToSelect.map(p => p.id));
            this.partSelected.emit(part);
          } else {
            partsToSelect = [part];
            this.partsSelected.emit([part.id]);
            this.partSelected.emit(part);
          }

          // Direct Drag Support:
          // If user clicked with left mouse button on an interactive part/group (or Move/Select tool is active)
          // prepare direct dragging using a screen-facing plane passing through the hit point
          if (e.button === 0 && (this.activeTool() === 'select' || this.activeTool() === 'move') && !isHandle) {
            this.isDirectPieceDrag = true;
            this.directPieceDragThresholdPassed = false;
            this.dragStartPointer = { x: e.clientX, y: e.clientY };
            this.dragInitialPart = { ...part };
            this.dragInitialParts = partsToSelect.map(p => ({ ...p }));

            // Setup camera-facing plane through the hit intersection point
            const camDir = new THREE.Vector3();
            this.camera.getWorldDirection(camDir);
            const hitPoint = intersects[0].point.clone();
            this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), hitPoint);

            const intersectPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
              this.dragPlaneIntersectionStart.copy(intersectPoint);
            } else {
              this.dragPlaneIntersectionStart.copy(hitPoint);
            }
          }
        }
      }
    } else {
      // Clicked background -> deselect
      this.partsSelected.emit([]);
      this.partSelected.emit(null);
    }
  }

    // Pointer Move: Dragging Gizmo, Push/Pulling, Drawing Rect or Updating Hover Cursors
  private onPointerMove(e: PointerEvent) {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.camera) return;

    // Track right pointer drag to distinguish panning from stationary context menu click
    if (this.rightPointerDownPos) {
      const dist = Math.hypot(e.clientX - this.rightPointerDownPos.x, e.clientY - this.rightPointerDownPos.y);
      if (dist > 5) {
        this.rightPointerDragged = true;
      }
    }

    // 0.05. Measurement Tape Live Dragging & Magnetic Snapping
    if (this.isMeasureMode()) {
      const snapCand = this.findMagneticSnapCandidate(e.clientX, e.clientY, 36);
      this.updateMagneticSnapIndicator(snapCand);

      if (this.isMeasuringDrag && this.measurePointA()) {
        if (snapCand) {
          this.measurePointB.set({
            x: Math.round(snapCand.worldPos.x),
            y: Math.max(0, Math.round(snapCand.worldPos.y)),
            z: Math.round(snapCand.worldPos.z)
          });
        } else {
          const rect = canvas.getBoundingClientRect();
          this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          this.raycaster.setFromCamera(this.mouse, this.camera);

          const measureIntersects = this.raycaster.intersectObjects(
            [...this.pieceObjects.map(p => p.mesh), ...(this.floorMesh ? [this.floorMesh] : [])],
            true
          );
          if (measureIntersects.length > 0) {
            const hit = measureIntersects[0];
            const pt = hit.point;
            let resolvedPt = {
              x: Math.round(pt.x),
              y: Math.max(0, Math.round(pt.y)),
              z: Math.round(pt.z)
            };
            const hitPart = hit.object.userData?.['part'] as Part | undefined;
            if (hitPart) {
              const snapPoints = this.getPartSnapPoints(hitPart);
              let closest = null;
              let minDist = 45; // mm in 3D
              for (const sp of snapPoints) {
                const d = pt.distanceTo(sp.pos);
                const effD = sp.type === 'corner' ? d * 0.75 : d;
                if (effD < minDist) {
                  minDist = effD;
                  closest = sp;
                }
              }
              if (closest) {
                resolvedPt = {
                  x: Math.round(closest.pos.x),
                  y: Math.max(0, Math.round(closest.pos.y)),
                  z: Math.round(closest.pos.z)
                };
              }
            }
            this.measurePointB.set(resolvedPt);
          } else {
            const ptA = this.measurePointA()!;
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ptA.y);
            const intersectPt = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(plane, intersectPt)) {
              this.measurePointB.set({
                x: Math.round(intersectPt.x),
                y: Math.max(0, Math.round(intersectPt.y)),
                z: Math.round(intersectPt.z)
              });
            }
          }
        }
        this.renderMeasurementVisuals();
        return;
      }
    }

    // 0.1. Draw 3D Rectangle Live Preview
    if (this.isDrawingRect() && this.rectStartPoint) {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const drawPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.rectStartPoint.y);
      const intersectPt = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(drawPlane, intersectPt)) {
        const snap = 10;
        this.rectCurrentPoint = new THREE.Vector3(
          Math.round(intersectPt.x / snap) * snap,
          this.rectStartPoint.y,
          Math.round(intersectPt.z / snap) * snap
        );

        const L = Math.round(Math.abs(this.rectCurrentPoint.x - this.rectStartPoint.x));
        const W = Math.round(Math.abs(this.rectCurrentPoint.z - this.rectStartPoint.z));
        this.rectDrawDims.set({ length: L, width: W });
        this.renderRectPreview();
      }
      return;
    }

    // 0. Push/Pull Active Dragging
    if (this.isPushPulling && this.pushPullData) {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const currentIntersection = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.dragPlane, currentIntersection)) {
        const data = this.pushPullData;
        const deltaWorld = currentIntersection.clone().sub(this.dragPlaneIntersectionStart);
        const axisDisplacement = deltaWorld.dot(data.axisVector) * data.dir;
        const snap = 1; // 1 mm fine CAD precision
        const steppedDelta = Math.round(axisDisplacement / snap) * snap;

        const res = this.applyMagneticSnapToStretch(
          data.part,
          data.targetDim,
          data.posAxis,
          data.dir,
          steppedDelta
        );

        const updates: Partial<Part> = {};
        updates[data.targetDim] = res.dim;
        updates[data.posAxis] = res.pos;

        const axisName = data.targetDim === 'thickness'
          ? 'Espesor'
          : (data.targetDim === 'length' ? 'Largo' : 'Ancho');

        this.pushPullDelta.set({
          axisName,
          initialVal: data.initialDim,
          currentVal: res.dim,
          delta: res.dim - data.initialDim
        });

        // Update highlight plane to follow face
        const axisChar = (data.axisVector.x !== 0 ? 'x' : (data.axisVector.y !== 0 ? 'y' : 'z')) as 'x' | 'y' | 'z';
        this.renderPushPullFaceHighlight(
          { ...data.part, ...updates },
          axisChar,
          data.dir
        );

        this.partModified.emit({ part: data.part, updates });
      }
      return;
    }

    if (this.isDragging && this.activeGizmoHit && (this.dragInitialPart || this.dragInitialParts.length > 0)) {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const currentIntersection = new THREE.Vector3();

      if (this.raycaster.ray.intersectPlane(this.dragPlane, currentIntersection)) {
        const deltaWorld = currentIntersection.clone().sub(this.dragPlaneIntersectionStart);
        const hit = this.activeGizmoHit;
        const snap = 1; // 1 mm fine precision

        if (hit.type === 'axis') {
          if (this.dragInitialParts.length > 1) {
            // Group Translation for multiple selected pieces (drawer/cabinet)
            let delta = 0;
            if (hit.axis === 'x') {
              delta = Math.round(deltaWorld.x / snap) * snap;
            } else if (hit.axis === 'y') {
              delta = Math.round(deltaWorld.y / snap) * snap;
            } else if (hit.axis === 'z') {
              delta = Math.round(deltaWorld.z / snap) * snap;
            }

            const updatesList: { part: Part; updates: Partial<Part> }[] = [];
            for (const p of this.dragInitialParts) {
              const upd: Partial<Part> = {};
              if (hit.axis === 'x') {
                upd.posX = (p.posX ?? 0) + delta;
              } else if (hit.axis === 'y') {
                upd.posY = Math.max(0, (p.posY ?? 0) + delta);
              } else if (hit.axis === 'z') {
                upd.posZ = (p.posZ ?? 0) + delta;
              }
              updatesList.push({ part: p, updates: upd });
            }
            this.multiplePartsModified.emit({ updates: updatesList });
            if (updatesList.length > 0) {
              this.partModified.emit(updatesList[0]);
            }
          } else if (this.dragInitialPart) {
            // Single Part Axis Translation with magnetic face snapping
            const part = this.dragInitialPart;
            const updates: Partial<Part> = {};
            let targetPos = {
              x: (part.posX ?? 0),
              y: (part.posY ?? 0),
              z: (part.posZ ?? 0)
            };

            if (hit.axis === 'x') {
              const steppedDelta = Math.round(deltaWorld.x / snap) * snap;
              targetPos.x += steppedDelta;
              if (this.isMagneticSnap()) {
                targetPos = this.applyMagneticSnapToPosition(part, targetPos, 'x');
              }
              updates.posX = targetPos.x;
            } else if (hit.axis === 'y') {
              const steppedDelta = Math.round(deltaWorld.y / snap) * snap;
              targetPos.y = Math.max(0, targetPos.y + steppedDelta);
              if (this.isMagneticSnap()) {
                targetPos = this.applyMagneticSnapToPosition(part, targetPos, 'y');
              }
              updates.posY = targetPos.y;
            } else if (hit.axis === 'z') {
              const steppedDelta = Math.round(deltaWorld.z / snap) * snap;
              targetPos.z += steppedDelta;
              if (this.isMagneticSnap()) {
                targetPos = this.applyMagneticSnapToPosition(part, targetPos, 'z');
              }
              updates.posZ = targetPos.z;
            }

            this.partModified.emit({ part, updates });
          }
        } else if (hit.type === 'handle' && this.dragInitialPart) {
          // Edge Stretch Handle: Length or Width with magnetic snap to adjacent faces
          const part = this.dragInitialPart;
          const updates: Partial<Part> = {};
          const orient = part.orientation || 'horizontal';

          if (hit.handleTarget === 'length') {
            let axisDelta = 0;
            let posAxis: 'posX' | 'posY' | 'posZ' = 'posX';

            if (orient === 'horizontal' || orient === 'vertical_xy') {
              axisDelta = deltaWorld.x * hit.dir;
              posAxis = 'posX';
            } else {
              axisDelta = deltaWorld.y * hit.dir;
              posAxis = 'posY';
            }

            const steppedDelta = Math.round(axisDelta / snap) * snap;
            const res = this.applyMagneticSnapToStretch(part, 'length', posAxis, hit.dir, steppedDelta);
            updates.length = res.dim;
            updates[posAxis] = res.pos;

          } else if (hit.handleTarget === 'width') {
            let axisDelta = 0;
            let posAxis: 'posX' | 'posY' | 'posZ' = 'posZ';

            if (orient === 'horizontal' || orient === 'vertical_yz') {
              axisDelta = deltaWorld.z * hit.dir;
              posAxis = 'posZ';
            } else {
              axisDelta = deltaWorld.y * hit.dir;
              posAxis = 'posY';
            }

            const steppedDelta = Math.round(axisDelta / snap) * snap;
            const res = this.applyMagneticSnapToStretch(part, 'width', posAxis, hit.dir, steppedDelta);
            updates.width = res.dim;
            updates[posAxis] = res.pos;
          }

          this.partModified.emit({ part, updates });
        }
      }
      return;
    }

    // Direct Piece/Group Dragging (click & drag any piece surface)
    if (this.isDirectPieceDrag && (this.dragInitialPart || this.dragInitialParts.length > 0)) {
      const distFromStart = Math.hypot(e.clientX - this.dragStartPointer.x, e.clientY - this.dragStartPointer.y);
      if (!this.directPieceDragThresholdPassed && distFromStart > 4) {
        this.directPieceDragThresholdPassed = true;
        this.dragStarted.emit();
        this.controls.enabled = false;
        canvas.style.cursor = 'grabbing';
      }

      if (this.directPieceDragThresholdPassed) {
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const currentIntersection = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.dragPlane, currentIntersection)) {
          const deltaWorld = currentIntersection.clone().sub(this.dragPlaneIntersectionStart);
          const snap = 1; // 1 mm CAD precision
          const dx = Math.round(deltaWorld.x / snap) * snap;
          const dy = Math.round(deltaWorld.y / snap) * snap;
          const dz = Math.round(deltaWorld.z / snap) * snap;

          if (this.dragInitialParts.length > 1) {
            // Group Drag: translate all pieces in group together
            const updatesList: { part: Part; updates: Partial<Part> }[] = [];
            for (const p of this.dragInitialParts) {
              const upd: Partial<Part> = {
                posX: (p.posX ?? 0) + dx,
                posY: Math.max(0, (p.posY ?? 0) + dy),
                posZ: (p.posZ ?? 0) + dz
              };
              updatesList.push({ part: p, updates: upd });
            }
            this.multiplePartsModified.emit({ updates: updatesList });
            if (updatesList.length > 0) {
              this.partModified.emit(updatesList[0]);
            }
          } else if (this.dragInitialPart) {
            // Single Part Drag: translate piece with optional magnetic snapping
            const part = this.dragInitialPart;
            let targetPos = {
              x: (part.posX ?? 0) + dx,
              y: Math.max(0, (part.posY ?? 0) + dy),
              z: (part.posZ ?? 0) + dz
            };

            if (this.isMagneticSnap()) {
              targetPos = this.applyMagneticSnapToPosition(part, targetPos, 'x');
              targetPos = this.applyMagneticSnapToPosition(part, targetPos, 'y');
              targetPos = this.applyMagneticSnapToPosition(part, targetPos, 'z');
            }

            const updates: Partial<Part> = {
              posX: targetPos.x,
              posY: targetPos.y,
              posZ: targetPos.z
            };
            this.partModified.emit({ part, updates });
          }
        }
        return;
      }
    }

    // Hover cursor updates when not dragging
    if (this.activeTool() === 'push_pull') {
      this.updatePushPullHover(e);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.gizmoHitMeshes.length > 0) {
      const gizmoIntersects = this.raycaster.intersectObjects(this.gizmoHitMeshes, true);
      if (gizmoIntersects.length > 0) {
        const hit = gizmoIntersects[0].object.userData as GizmoHitData;
        if (hit.type === 'axis') {
          canvas.style.cursor = 'grab';
        } else {
          canvas.style.cursor = hit.handleTarget === 'length' ? 'ew-resize' : 'ns-resize';
        }
        return;
      }
    }

    const pieceIntersects = this.raycaster.intersectObjects(
      this.pieceObjects.map(p => p.mesh),
      false
    );
    if (pieceIntersects.length > 0) {
      const topObj = pieceIntersects[0].object;
      const topPart = topObj.userData?.['part'] as Part | undefined;
      const isSelected = topPart && this.activeSelectedIds().includes(topPart.id);
      if (this.activeTool() === 'move' || isSelected) {
        canvas.style.cursor = 'grab';
      } else {
        canvas.style.cursor = 'pointer';
      }
    } else {
      canvas.style.cursor = 'default';
    }
  }

  // Pointer Up: Release Dragging
  private onPointerUp(e?: PointerEvent) {
    if (this.isDrawingRect() && this.rectStartPoint && this.rectCurrentPoint) {
      const L = Math.round(Math.abs(this.rectCurrentPoint.x - this.rectStartPoint.x));
      const W = Math.round(Math.abs(this.rectCurrentPoint.z - this.rectStartPoint.z));

      if (L >= 60 && W >= 60) {
        const posX = Math.round((this.rectStartPoint.x + this.rectCurrentPoint.x) / 2);
        const posZ = Math.round((this.rectStartPoint.z + this.rectCurrentPoint.z) / 2);
        const posY = this.rectStartPoint.y + 7.5;

        this.partCreated.emit({
          name: `Pieza Dibujada ${this.parts().length + 1}`,
          length: L,
          width: W,
          thickness: 15,
          posX,
          posY,
          posZ,
          orientation: 'horizontal'
        });

        // Switch to Push/Pull so user can immediately pull it upwards if desired
        this.setActiveTool('push_pull');
      }

      this.isDrawingRect.set(false);
      this.rectStartPoint = null;
      this.rectCurrentPoint = null;
      this.rectDrawDims.set(null);
      this.clearRectPreview();
      this.controls.enabled = true;
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) canvas.style.cursor = 'default';
      return;
    }

    if (this.isMeasuringDrag) {
      this.isMeasuringDrag = false;
      this.controls.enabled = true;
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) canvas.style.cursor = 'default';

      // Final magnetic lock verification at release point
      if (e) {
        const snapEnd = this.findMagneticSnapCandidate(e.clientX, e.clientY, 40);
        if (snapEnd) {
          this.measurePointB.set({
            x: Math.round(snapEnd.worldPos.x),
            y: Math.max(0, Math.round(snapEnd.worldPos.y)),
            z: Math.round(snapEnd.worldPos.z)
          });
        }
      }

      const a = this.measurePointA();
      const b = this.measurePointB();
      if (a && b) {
        const dist = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
        if (dist >= 4) {
          // Measurement is complete and permanent in 3D scene!
          this.isMeasurementPersistent.set(true);
        }
      }
      this.renderMeasurementVisuals();
      this.updateMagneticSnapIndicator(null);
      return;
    }

    if (this.isPushPulling) {
      this.isPushPulling = false;
      this.pushPullData = null;
      this.controls.enabled = true;
      this.pushPullDelta.set(null);
      this.clearPushPullHighlight();
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) canvas.style.cursor = 'default';
    }

    if (this.isDirectPieceDrag) {
      this.isDirectPieceDrag = false;
      this.directPieceDragThresholdPassed = false;
      this.dragInitialPart = null;
      this.dragInitialParts = [];
      this.controls.enabled = true;
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) {
        canvas.style.cursor = 'default';
      }
    }

    if (this.isDragging) {
      this.isDragging = false;
      this.activeGizmoHit = null;
      this.dragInitialPart = null;
      this.controls.enabled = true;

      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) {
        canvas.style.cursor = 'default';
      }
    }
  }

  // --- CAD TOOLS & PUSH/PULL FACE RAYCASTING ---

  setActiveTool(tool: 'select' | 'push_pull' | 'move' | 'measure' | 'rotate_90' | 'draw_rect') {
    this.activeTool.set(tool);
    if (tool === 'measure') {
      this.isMeasureMode.set(true);
    } else {
      this.isMeasureMode.set(false);
      this.clearMeasure();
    }
    if (tool !== 'draw_rect') {
      this.clearRectPreview();
      this.isDrawingRect.set(false);
      this.rectStartPoint = null;
      this.rectCurrentPoint = null;
      this.rectDrawDims.set(null);
    }
    if (tool === 'rotate_90' && this.selectedPart()) {
      // If a part is already selected and user activates rotate, rotate it 90 deg immediately
      this.rotatePart90(this.selectedPart()!, 'y');
    }
    this.clearPushPullHighlight();
    this.hoveredFaceInfo.set(null);
    const canvas = this.canvasRef()?.nativeElement;
    if (canvas) {
      canvas.style.cursor = tool === 'draw_rect' ? 'crosshair' : 'default';
    }
  }

  private updatePushPullHover(e: PointerEvent) {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.camera || this.isPushPulling) return;

    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(
      this.pieceObjects.map(p => p.mesh),
      false
    );

    if (intersects.length === 0 || !intersects[0].face) {
      this.clearPushPullHighlight();
      this.hoveredFaceInfo.set(null);
      canvas.style.cursor = 'default';
      return;
    }

    const hit = intersects[0];
    if (!hit.face) return;
    const mesh = hit.object as THREE.Mesh;
    const part = mesh.userData['part'] as Part;
    const faceNormal = hit.face.normal.clone();

    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const worldNormal = faceNormal.clone().applyMatrix3(normalMatrix).normalize();

    const absX = Math.abs(worldNormal.x);
    const absY = Math.abs(worldNormal.y);
    const absZ = Math.abs(worldNormal.z);

    let axis: 'x' | 'y' | 'z' = 'x';
    let dir = 1;
    let faceLabel = '';
    let dimLabel = '';

    if (absY >= absX && absY >= absZ) {
      axis = 'y';
      dir = worldNormal.y > 0 ? 1 : -1;
      faceLabel = dir > 0 ? 'Cara Superior' : 'Cara Inferior';
    } else if (absX >= absY && absX >= absZ) {
      axis = 'x';
      dir = worldNormal.x > 0 ? 1 : -1;
      faceLabel = dir > 0 ? 'Cara Lateral Derecha' : 'Cara Lateral Izquierda';
    } else {
      axis = 'z';
      dir = worldNormal.z > 0 ? 1 : -1;
      faceLabel = dir > 0 ? 'Cara Frontal' : 'Cara Posterior';
    }

    const orient = part.orientation || 'horizontal';
    if (orient === 'horizontal') {
      if (axis === 'x') {
        dimLabel = `Largo (${part.length} mm)`;
      } else if (axis === 'z') {
        dimLabel = `Ancho (${part.width} mm)`;
      } else {
        dimLabel = `Espesor (${part.thickness} mm)`;
      }
    } else if (orient === 'vertical_yz') {
      if (axis === 'y') {
        dimLabel = `Alto (${part.length} mm)`;
      } else if (axis === 'z') {
        dimLabel = `Fondo (${part.width} mm)`;
      } else {
        dimLabel = `Espesor (${part.thickness} mm)`;
      }
    } else {
      if (axis === 'x') {
        dimLabel = `Largo (${part.length} mm)`;
      } else if (axis === 'y') {
        dimLabel = `Alto (${part.width} mm)`;
      } else {
        dimLabel = `Espesor (${part.thickness} mm)`;
      }
    }

    this.hoveredFaceInfo.set({
      partName: part.name,
      faceLabel,
      dimLabel
    });

    canvas.style.cursor = (axis === 'y') ? 'ns-resize' : 'ew-resize';
    this.renderPushPullFaceHighlight(part, axis, dir);
  }

  private renderPushPullFaceHighlight(part: Part, axis: 'x' | 'y' | 'z', dir: number) {
    this.clearPushPullHighlight();

    const bounds = this.getPartBounds(part);
    let planeW = 0;
    let planeH = 0;
    const center = new THREE.Vector3(bounds.px, bounds.py, bounds.pz);
    const rotation = new THREE.Euler();

    if (axis === 'x') {
      planeW = bounds.sz;
      planeH = bounds.sy;
      center.x += dir * (bounds.sx / 2 + 1.5);
      rotation.set(0, Math.PI / 2, 0);
    } else if (axis === 'y') {
      planeW = bounds.sx;
      planeH = bounds.sz;
      center.y += dir * (bounds.sy / 2 + 1.5);
      rotation.set(Math.PI / 2, 0, 0);
    } else {
      planeW = bounds.sx;
      planeH = bounds.sy;
      center.z += dir * (bounds.sz / 2 + 1.5);
      rotation.set(0, 0, 0);
    }

    const geo = new THREE.PlaneGeometry(planeW, planeH);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x0284c7, // Technical CAD cyan
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthTest: false
    });
    const faceMesh = new THREE.Mesh(geo, mat);
    faceMesh.position.copy(center);
    faceMesh.rotation.copy(rotation);

    const edges = new THREE.EdgesGeometry(geo);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b, // Amber border
      linewidth: 3,
      depthTest: false
    });
    const outline = new THREE.LineSegments(edges, edgeMat);
    outline.position.copy(center);
    outline.rotation.copy(rotation);

    this.pushPullHighlightGroup.add(faceMesh);
    this.pushPullHighlightGroup.add(outline);
  }

  private clearPushPullHighlight() {
    while (this.pushPullHighlightGroup.children.length > 0) {
      const obj = this.pushPullHighlightGroup.children[0];
      this.pushPullHighlightGroup.remove(obj);
    }
  }

  // --- 3D RECTANGLE PREVIEW METHODS ---

  private renderRectPreview() {
    this.clearRectPreview();
    if (!this.rectStartPoint || !this.rectCurrentPoint) return;

    const minX = Math.min(this.rectStartPoint.x, this.rectCurrentPoint.x);
    const maxX = Math.max(this.rectStartPoint.x, this.rectCurrentPoint.x);
    const minZ = Math.min(this.rectStartPoint.z, this.rectCurrentPoint.z);
    const maxZ = Math.max(this.rectStartPoint.z, this.rectCurrentPoint.z);

    const length = Math.max(20, maxX - minX);
    const width = Math.max(20, maxZ - minZ);
    const thickness = 15;

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const centerY = this.rectStartPoint.y + thickness / 2;

    const geom = new THREE.BoxGeometry(length, thickness, width);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.35,
      depthTest: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(centerX, centerY, centerZ);

    const edges = new THREE.EdgesGeometry(geom);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 2, depthTest: false });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    mesh.add(wireframe);

    this.rectPreviewGroup.add(mesh);
  }

  private clearRectPreview() {
    while (this.rectPreviewGroup.children.length > 0) {
      const obj = this.rectPreviewGroup.children[0];
      this.rectPreviewGroup.remove(obj);
    }
  }

  // --- RIGHT-CLICK CONTEXT MENU ACTIONS ---

  onContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    // Only open context menu on genuine stationary click, NEVER when mouse was dragged or held down to orbit/pan
    const duration = Date.now() - this.rightPointerDownTime;
    const wasDragged = this.rightPointerDragged;
    this.rightPointerDownPos = null;
    this.rightPointerDragged = false;

    if (wasDragged || duration > 300) {
      return;
    }

    const canvas = this.canvasRef()?.nativeElement;
    const container = this.containerRef()?.nativeElement;
    if (!canvas || !container || !this.camera) return;

    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const targets: THREE.Object3D[] = [];
    for (const item of this.pieceObjects) {
      targets.push(item.mesh);
      if (item.doorPivot) targets.push(item.doorPivot);
    }
    targets.push(this.drillGroup);

    const intersects = this.raycaster.intersectObjects(targets, true);

    const contRect = container.getBoundingClientRect();
    const posX = Math.max(10, Math.min(e.clientX - contRect.left, contRect.width - 250));
    const posY = Math.max(10, Math.min(e.clientY - contRect.top, contRect.height - 380));

    if (intersects.length > 0) {
      const topHit = intersects[0].object as THREE.Mesh;
      let part = topHit.userData['part'] as Part | undefined;

      let currObj: THREE.Object3D | null = topHit;
      while (currObj && !part && currObj !== this.furnitureGroup && currObj !== this.scene) {
        if (currObj.userData?.['part']) {
          part = currObj.userData['part'];
          break;
        }
        currObj = currObj.parent;
      }

      if (part) {
        this.contextMenuPart.set(part);
        this.contextMenuPos.set({ x: posX, y: posY });
        this.partsSelected.emit([part.id]);
        this.partSelected.emit(part);
        this.showQuickMaterialPicker.set(false);
        this.showRotateSubmenu.set(false);
        this.showMovableRoleSubmenu.set(false);
        this.showHandleSubmenu.set(false);
        this.showHingeSubmenu.set(false);
        this.showSlideSubmenu.set(false);
        return;
      }
    }

    // Clicked empty canvas space
    this.contextMenuPart.set(null);
    this.contextMenuPos.set({ x: posX, y: posY });
    this.showQuickMaterialPicker.set(false);
    this.showRotateSubmenu.set(false);
    this.showMovableRoleSubmenu.set(false);
    this.showHandleSubmenu.set(false);
    this.showHingeSubmenu.set(false);
    this.showSlideSubmenu.set(false);
  }

  closeContextMenu() {
    this.contextMenuPos.set(null);
    this.contextMenuPart.set(null);
    this.showQuickMaterialPicker.set(false);
    this.showRotateSubmenu.set(false);
    this.showMovableRoleSubmenu.set(false);
    this.showHandleSubmenu.set(false);
    this.showHingeSubmenu.set(false);
    this.showSlideSubmenu.set(false);
  }

  toggleRotateSubmenu() {
    this.showRotateSubmenu.update(v => !v);
    this.showQuickMaterialPicker.set(false);
    this.showMovableRoleSubmenu.set(false);
    this.showHandleSubmenu.set(false);
    this.showHingeSubmenu.set(false);
    this.showSlideSubmenu.set(false);
  }

  toggleQuickMaterialPicker() {
    this.showQuickMaterialPicker.update(v => !v);
    this.showRotateSubmenu.set(false);
    this.showMovableRoleSubmenu.set(false);
    this.showHandleSubmenu.set(false);
    this.showHingeSubmenu.set(false);
    this.showSlideSubmenu.set(false);
  }

  toggleMovableRoleSubmenu() {
    this.showMovableRoleSubmenu.update(v => !v);
    this.showRotateSubmenu.set(false);
    this.showQuickMaterialPicker.set(false);
    this.showHandleSubmenu.set(false);
    this.showHingeSubmenu.set(false);
    this.showSlideSubmenu.set(false);
  }

  toggleHandleSubmenu() {
    this.showHandleSubmenu.update(v => !v);
    this.showRotateSubmenu.set(false);
    this.showQuickMaterialPicker.set(false);
    this.showMovableRoleSubmenu.set(false);
    this.showHingeSubmenu.set(false);
    this.showSlideSubmenu.set(false);
  }

  toggleHingeSubmenu() {
    this.showHingeSubmenu.update(v => !v);
    this.showRotateSubmenu.set(false);
    this.showQuickMaterialPicker.set(false);
    this.showMovableRoleSubmenu.set(false);
    this.showHandleSubmenu.set(false);
    this.showSlideSubmenu.set(false);
  }

  toggleSlideSubmenu() {
    this.showSlideSubmenu.update(v => !v);
    this.showRotateSubmenu.set(false);
    this.showQuickMaterialPicker.set(false);
    this.showMovableRoleSubmenu.set(false);
    this.showHandleSubmenu.set(false);
    this.showHingeSubmenu.set(false);
  }

  setContextMenuPartMovable(role: 'door' | 'drawer_front' | 'shelf' | 'free', direction: OpeningDirection = 'left') {
    const part = this.contextMenuPart();
    if (!part) return;

    let hwConfig: PartHardwareConfig;
    if (role === 'door') {
      hwConfig = {
        ...(part.hardwareConfig || {}),
        isMovable: true,
        movableType: 'door',
        openingDirection: direction,
        hingeType: direction === 'top' ? 'gas_piston' : 'straight',
        handleType: part.hardwareConfig?.handleType || 'bar_modern',
        handleFinish: part.hardwareConfig?.handleFinish || 'brushed_steel'
      };
    } else if (role === 'drawer_front') {
      hwConfig = {
        ...(part.hardwareConfig || {}),
        isMovable: true,
        movableType: 'drawer',
        slideType: part.hardwareConfig?.slideType || 'telescopic',
        handleType: part.hardwareConfig?.handleType || 'bar_modern',
        handleFinish: part.hardwareConfig?.handleFinish || 'brushed_steel',
        handlePosition: 'horizontal'
      };
    } else {
      hwConfig = {
        ...(part.hardwareConfig || {}),
        isMovable: false,
        movableType: 'none',
        handleType: 'none',
        hingeType: 'none',
        slideType: 'none'
      };
    }

    const updates: Partial<Part> = {
      componentRole: role,
      hardwareConfig: hwConfig
    };

    this.partModified.emit({ part, updates });
    this.closeContextMenu();
  }

  setContextMenuPartHandle(handleType: HandleType, finish: HandleFinish = 'brushed_steel') {
    const part = this.contextMenuPart();
    if (!part) return;

    const hw: PartHardwareConfig = {
      ...(part.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(part)),
      handleType,
      handleFinish: finish
    };

    this.partModified.emit({ part, updates: { hardwareConfig: hw } });
    this.closeContextMenu();
  }

  setContextMenuPartHinge(hingeType: HingeType) {
    const part = this.contextMenuPart();
    if (!part) return;

    const hw: PartHardwareConfig = {
      ...(part.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(part)),
      hingeType
    };

    this.partModified.emit({ part, updates: { hardwareConfig: hw } });
    this.closeContextMenu();
  }

  setContextMenuPartSlide(slideType: SlideType) {
    const part = this.contextMenuPart();
    if (!part) return;

    const hw: PartHardwareConfig = {
      ...(part.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(part)),
      slideType
    };

    this.partModified.emit({ part, updates: { hardwareConfig: hw } });
    this.closeContextMenu();
  }

  toggleContextMenuAnimation() {
    const part = this.contextMenuPart();
    if (!part) return;
    this.togglePartOpen(part.id);
    this.closeContextMenu();
  }

  duplicateContextMenuPart() {
    const part = this.contextMenuPart();
    if (part) {
      this.partDuplicated.emit(part);
      this.closeContextMenu();
    }
  }

  rotatePart90(part: Part, axis: 'x' | 'y' | 'z' = 'y') {
    const updates: Partial<Part> = {};
    const currentOrient = part.orientation || 'horizontal';

    if (axis === 'y') {
      // Rotate around vertical Y: swap length and width
      updates.length = part.width;
      updates.width = part.length;
    } else if (axis === 'x') {
      // Pitch rotation: cycle between horizontal and vertical_xy
      if (currentOrient === 'horizontal') {
        updates.orientation = 'vertical_xy';
      } else if (currentOrient === 'vertical_xy') {
        updates.orientation = 'horizontal';
      } else {
        updates.orientation = 'horizontal';
      }
    } else if (axis === 'z') {
      // Roll rotation: cycle between horizontal and vertical_yz
      if (currentOrient === 'horizontal') {
        updates.orientation = 'vertical_yz';
      } else if (currentOrient === 'vertical_yz') {
        updates.orientation = 'horizontal';
      } else {
        updates.orientation = 'horizontal';
      }
    }

    this.partModified.emit({ part, updates });
    this.closeContextMenu();
  }

  alignContextMenuPart(type: 'floor' | 'centerX' | 'centerZ') {
    const part = this.contextMenuPart();
    if (!part) return;

    const t = part.thickness || 18;
    const L = part.length;
    const orientation = part.orientation || 'horizontal';
    let sy = t;
    if (orientation === 'vertical_yz') {
      const isDrawerLateral = part.componentRole === 'drawer_box' ||
        part.componentRole === 'drawer_lateral' ||
        (part.name.toUpperCase().includes('LATERAL') && (part.name.toUpperCase().includes('CAJ') || !!part.groupId));
      sy = (isDrawerLateral && L > part.width) ? part.width : L;
    } else if (orientation === 'vertical_xy') {
      sy = part.width;
    }

    const updates: Partial<Part> = {};
    if (type === 'floor') {
      updates.posY = sy / 2;
    } else if (type === 'centerX') {
      updates.posX = 0;
    } else if (type === 'centerZ') {
      updates.posZ = 0;
    }

    this.partModified.emit({ part, updates });
    this.closeContextMenu();
  }

  isolatePart(part: Part) {
    const allOther = new Set(this.parts().filter(p => p.id !== part.id).map(p => p.id));
    this.hiddenPartIds.set(allOther);
    this.hiddenPartsChanged.emit(Array.from(allOther));
    this.closeContextMenu();
  }

  hidePart(part: Part) {
    const next = new Set(this.hiddenPartIds());
    next.add(part.id);
    this.hiddenPartIds.set(next);
    this.hiddenPartsChanged.emit(Array.from(next));
    this.clearSelection();
    this.closeContextMenu();
  }

  hidePartById(partId: string) {
    const next = new Set(this.hiddenPartIds());
    next.add(partId);
    this.hiddenPartIds.set(next);
    this.hiddenPartsChanged.emit(Array.from(next));
    if (this.selectedPartId() === partId) {
      this.clearSelection();
    }
  }

  showPartById(partId: string) {
    const next = new Set(this.hiddenPartIds());
    next.delete(partId);
    this.hiddenPartIds.set(next);
    this.hiddenPartsChanged.emit(Array.from(next));
  }

  togglePartVisibility(partId: string) {
    const next = new Set(this.hiddenPartIds());
    if (next.has(partId)) {
      next.delete(partId);
    } else {
      next.add(partId);
      if (this.selectedPartId() === partId) {
        this.clearSelection();
      }
    }
    this.hiddenPartIds.set(next);
    this.hiddenPartsChanged.emit(Array.from(next));
  }

  hidePartsByIds(partIds: string[]) {
    const next = new Set(this.hiddenPartIds());
    for (const id of partIds) {
      next.add(id);
    }
    this.hiddenPartIds.set(next);
    this.hiddenPartsChanged.emit(Array.from(next));
    this.clearSelection();
  }

  showPartsByIds(partIds: string[]) {
    const next = new Set(this.hiddenPartIds());
    for (const id of partIds) {
      next.delete(id);
    }
    this.hiddenPartIds.set(next);
    this.hiddenPartsChanged.emit(Array.from(next));
  }

  setHiddenParts(ids: Set<string> | string[]) {
    const s = new Set(ids);
    this.hiddenPartIds.set(s);
    this.hiddenPartsChanged.emit(Array.from(s));
  }

  showAllParts() {
    this.hiddenPartIds.set(new Set());
    this.hiddenPartsChanged.emit([]);
    this.closeContextMenu();
  }

  assignQuickMaterial(matId: string) {
    const part = this.contextMenuPart();
    const mat = this.materials().find(m => m.id === matId);
    if (!part || !mat) return;

    this.partModified.emit({
      part,
      updates: {
        materialId: mat.id,
        materialName: mat.name
      }
    });
    this.closeContextMenu();
  }

  toggleEdgeBandingQuick(edgeKey: 'l1' | 'l2' | 'a1' | 'a2') {
    const part = this.contextMenuPart();
    if (!part) return;

    const cycle: Record<EdgeBandingType, EdgeBandingType> = {
      none: 'thin',
      thin: 'thick',
      thick: 'none'
    };
    const nextVal = cycle[part.edges[edgeKey]];
    const updatedEdges = { ...part.edges, [edgeKey]: nextVal };
    this.partModified.emit({
      part,
      updates: { edges: updatedEdges }
    });
    this.contextMenuPart.set({ ...part, edges: updatedEdges });
  }

  deleteContextMenuPart() {
    const part = this.contextMenuPart();
    if (part) {
      this.partDeleted.emit(part.id);
      this.closeContextMenu();
    }
  }

  // --- BOTTOM-RIGHT CORNER CAD MEASUREMENTS HUD METHODS ---

  updateSelectedDimension(dim: 'length' | 'width' | 'thickness', value: number) {
    const sel = this.selectedPart();
    if (!sel || isNaN(value) || value < 1) return;
    const val = Math.max(1, Math.round(value));
    this.partModified.emit({
      part: sel,
      updates: { [dim]: val }
    });
  }

  adjustSelectedDimension(dim: 'length' | 'width' | 'thickness', delta: number) {
    const sel = this.selectedPart();
    if (!sel) return;
    const cur = Number(sel[dim] || 0);
    const next = Math.max(1, Math.round(cur + delta));
    this.updateSelectedDimension(dim, next);
  }

  // --- PRECISION NUDGE & MAGNETIC SNAPPING METHODS ---

  setNudgeStep(step: number) {
    this.nudgeStep.set(step);
  }

  toggleMagneticSnap() {
    this.isMagneticSnap.update(v => !v);
  }

  toggleViewsDropdown() {
    this.showViewsDropdown.update(v => !v);
    if (this.showViewsDropdown()) {
      this.showGroupsFlyout.set(false);
      this.showExplodedSlider.set(false);
    }
  }

  closeViewsDropdown() {
    this.showViewsDropdown.set(false);
  }

  toggleExplodedSlider() {
    this.showExplodedSlider.update(v => !v);
    if (this.showExplodedSlider()) {
      this.showGroupsFlyout.set(false);
      this.showViewsDropdown.set(false);
    }
  }

  closeExplodedSlider() {
    this.showExplodedSlider.set(false);
  }

  resetExploded() {
    this.explodedPercent.set(0);
  }

  onExplodedSliderInput(e: Event) {
    const target = e.target as HTMLInputElement | null;
    if (target) {
      this.explodedPercent.set(Number(target.value));
    }
  }

  // --- CAJONES Y GRUPOS MODULARES EN CINTA IZQUIERDA ---

  toggleGroupsFlyout() {
    this.showGroupsFlyout.update(v => !v);
    if (this.showGroupsFlyout()) {
      this.closeViewsDropdown();
      this.closeExplodedSlider();
    }
  }

  closeGroupsFlyout() {
    this.showGroupsFlyout.set(false);
  }

  getPartsForGroup(groupId: string): Part[] {
    return this.parts().filter(p => p.groupId === groupId);
  }

  isGroupFullySelected(groupId: string): boolean {
    const grpParts = this.getPartsForGroup(groupId);
    if (grpParts.length === 0) return false;
    const active = this.activeSelectedIds();
    return grpParts.every(p => active.includes(p.id));
  }

  selectGroupInViewer(groupId: string, smoothFocus = true) {
    const grpParts = this.getPartsForGroup(groupId);
    const ids = grpParts.map(p => p.id);
    this.partsSelected.emit(ids);
    if (grpParts.length > 0) {
      this.partSelected.emit(grpParts[0]);
    }
    if (this.activeTool() !== 'move' && this.activeTool() !== 'select') {
      this.setActiveTool('move');
    }
    if (smoothFocus) {
      this.focusCameraOnGroup(groupId);
    }
  }

  focusCameraOnGroup(groupId: string) {
    if (!this.camera || !this.controls) return;
    const grpParts = this.getPartsForGroup(groupId);
    if (grpParts.length === 0) return;

    // Calculate bounding box center and size across all meshes in the group
    const box = new THREE.Box3();
    let hasValidMesh = false;
    for (const p of grpParts) {
      const pieceObj = this.pieceObjects.find(po => po.part.id === p.id);
      if (pieceObj && pieceObj.mesh) {
        box.expandByObject(pieceObj.mesh);
        hasValidMesh = true;
      }
    }

    // Fallback if meshes are not yet resolved
    if (!hasValidMesh || box.isEmpty()) {
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      for (const p of grpParts) {
        const px = p.posX ?? 0;
        const py = p.posY ?? 0;
        const pz = p.posZ ?? 0;
        const hl = (p.length || 200) / 2;
        const hw = (p.width || 200) / 2;
        minX = Math.min(minX, px - hl);
        maxX = Math.max(maxX, px + hl);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py + (p.thickness || 15));
        minZ = Math.min(minZ, pz - hw);
        maxZ = Math.max(maxZ, pz + hw);
      }
      box.min.set(minX, minY, minZ);
      box.max.set(maxX, maxY, maxZ);
    }

    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 400);

    // Target camera position maintaining current viewing angle or standard isometric distance
    const currentCamOffset = this.camera.position.clone().sub(this.controls.target);
    let desiredDir = currentCamOffset.clone().normalize();
    if (desiredDir.lengthSq() < 0.001) {
      desiredDir = new THREE.Vector3(1, 0.8, 1.2).normalize();
    }
    const focusDistance = Math.max(maxDim * 2.2, 900);
    const targetCamPos = center.clone().add(desiredDir.multiplyScalar(focusDistance));

    // Smooth animation over 400ms using requestAnimationFrame
    const startTarget = this.controls.target.clone();
    const startCamPos = this.camera.position.clone();
    const startTime = performance.now();
    const duration = 400; // ms

    const animateFocus = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      this.controls.target.lerpVectors(startTarget, center, ease);
      this.camera.position.lerpVectors(startCamPos, targetCamPos, ease);
      this.camera.lookAt(this.controls.target);
      this.controls.update();

      if (progress < 1) {
        requestAnimationFrame(animateFocus);
      }
    };

    requestAnimationFrame(animateFocus);
  }

  toggleGroupAnimation(groupId: string) {
    const grpParts = this.getPartsForGroup(groupId);
    if (grpParts.length > 0) {
      const cur = this.openTargetMap.get(grpParts[0].id) || 0;
      const next = cur > 0.5 ? 0 : 1;
      for (const gp of grpParts) {
        this.openTargetMap.set(gp.id, next);
      }
      for (const p of this.pieceObjects) {
        if (p.part.groupId === groupId) {
          this.openTargetMap.set(p.part.id, next);
        }
      }
    }
  }

  isGroupOpen(groupId: string): boolean {
    const grpParts = this.getPartsForGroup(groupId);
    if (grpParts.length === 0) return false;
    const val = this.openTargetMap.get(grpParts[0].id) || 0;
    return val > 0.5;
  }

  moveGroupStep(groupId: string, axis: 'x' | 'y' | 'z', delta: number) {
    const grpParts = this.getPartsForGroup(groupId);
    if (grpParts.length === 0) return;
    const updatesList: { part: Part; updates: Partial<Part> }[] = [];
    for (const p of grpParts) {
      const upd: Partial<Part> = {};
      if (axis === 'x') upd.posX = (p.posX ?? 0) + delta;
      if (axis === 'y') upd.posY = Math.max(0, (p.posY ?? 0) + delta);
      if (axis === 'z') upd.posZ = (p.posZ ?? 0) + delta;
      updatesList.push({ part: p, updates: upd });
    }
    this.multiplePartsModified.emit({ updates: updatesList });
    if (updatesList.length > 0) {
      this.partModified.emit(updatesList[0]);
    }
  }

  ungroupInViewer(groupId: string) {
    this.groupUngroupRequested.emit(groupId);
  }

  duplicateGroupInViewer(groupId: string) {
    this.groupDuplicationRequested.emit(groupId);
  }

  rotateGroupInViewer(groupId: string, angleDelta: 90 | -90 | 180 = 90) {
    this.groupRotationRequested.emit({ groupId, deltaAngle: angleDelta });
  }

  formatCoord(val?: number): number {
    return Math.round(val ?? 0);
  }

  // --- MULTI-SELECTION & MEASUREMENT CONTROLS ---

  selectAllParts() {
    const all = this.parts().map(p => p.id);
    this.partsSelected.emit(all);
    if (this.parts().length > 0) {
      this.partSelected.emit(this.parts()[0]);
    }
  }

  clearSelection() {
    this.partsSelected.emit([]);
    this.partSelected.emit(null);
  }

  toggleMeasureMode() {
    const next = !this.isMeasureMode();
    this.isMeasureMode.set(next);
    if (!next) {
      this.clearMeasure();
    }
  }

  clearMeasure() {
    this.isMeasurementPersistent.set(false);
    this.measurePointA.set(null);
    this.measurePointB.set(null);
    while (this.measureGroup.children.length > 0) {
      const obj = this.measureGroup.children[0];
      this.measureGroup.remove(obj);
    }
    this.updateMagneticSnapIndicator(null);
  }

  nudgePart(axis: 'x' | 'y' | 'z', delta: number) {
    const selList = this.selectedParts();
    if (selList.length === 0) return;

    this.dragStarted.emit();

    if (selList.length > 1) {
      const updatesList: { part: Part; updates: Partial<Part> }[] = [];
      for (const p of selList) {
        const upd: Partial<Part> = {};
        if (axis === 'x') upd.posX = (p.posX ?? 0) + delta;
        if (axis === 'y') upd.posY = Math.max(0, (p.posY ?? 0) + delta);
        if (axis === 'z') upd.posZ = (p.posZ ?? 0) + delta;
        updatesList.push({ part: p, updates: upd });
      }
      this.multiplePartsModified.emit({ updates: updatesList });
      if (updatesList.length > 0) {
        this.partModified.emit(updatesList[0]);
      }
      return;
    }

    const sel = selList[0];
    let targetPos = {
      x: sel.posX ?? 0,
      y: sel.posY ?? 0,
      z: sel.posZ ?? 0
    };

    targetPos[axis] += delta;
    if (axis === 'y') {
      targetPos.y = Math.max(0, targetPos.y);
    }

    if (this.isMagneticSnap()) {
      targetPos = this.applyMagneticSnapToPosition(sel, targetPos, axis);
    }

    const updates: Partial<Part> = {};
    if (axis === 'x') updates.posX = targetPos.x;
    if (axis === 'y') updates.posY = targetPos.y;
    if (axis === 'z') updates.posZ = targetPos.z;

    this.partModified.emit({ part: sel, updates });
  }

  handleViewerKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      this.setActiveTool('push_pull');
      return;
    }
    if (e.key === 'v' || e.key === 'V') {
      e.preventDefault();
      this.setActiveTool('select');
      return;
    }
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      this.setActiveTool('move');
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      const grp = this.currentSelectedGroup();
      if (grp) {
        e.preventDefault();
        this.groupRotationRequested.emit({ groupId: grp.id, deltaAngle: 90 });
        return;
      }
      const sel = this.selectedPart();
      if (sel) {
        e.preventDefault();
        if (sel.groupId) {
          this.groupRotationRequested.emit({ groupId: sel.groupId, deltaAngle: 90 });
        } else {
          this.rotatePart90(sel, 'y');
        }
        return;
      }
      e.preventDefault();
      this.setActiveTool('draw_rect');
      return;
    }
    if (e.key === 'q' || e.key === 'Q') {
      e.preventDefault();
      this.setActiveTool('rotate_90');
      return;
    }
    if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      this.setActiveTool('measure');
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.closeContextMenu();
      this.clearSelection();
      this.clearMeasure();
      this.clearPushPullHighlight();
      this.clearRectPreview();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const sel = this.selectedPart();
      const selIds = this.selectedPartIds();
      if (sel) {
        e.preventDefault();
        this.partDeleted.emit(sel.id);
        return;
      } else if (selIds.length > 0) {
        e.preventDefault();
        for (const id of selIds) {
          this.partDeleted.emit(id);
        }
        return;
      }
    }

    const sel = this.selectedPart();
    if (!sel) return;

    const step = e.shiftKey ? Math.max(10, this.nudgeStep() * 10) : this.nudgeStep();

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        this.nudgePart('x', -step);
        break;
      case 'ArrowRight':
        e.preventDefault();
        this.nudgePart('x', step);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (e.altKey) {
          this.nudgePart('y', step);
        } else {
          this.nudgePart('z', -step);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (e.altKey) {
          this.nudgePart('y', -step);
        } else {
          this.nudgePart('z', step);
        }
        break;
      case 'PageUp':
        e.preventDefault();
        this.nudgePart('y', step);
        break;
      case 'PageDown':
        e.preventDefault();
        this.nudgePart('y', -step);
        break;
      case 'w':
      case 'W':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.nudgePart('y', step);
        }
        break;
      case 's':
      case 'S':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.nudgePart('y', -step);
        }
        break;
    }
  }

  private getPartBounds(
    part: Part,
    customPos?: { x: number; y: number; z: number },
    customSize?: { length?: number; width?: number }
  ) {
    const t = part.thickness || 18;
    const L = customSize?.length ?? part.length;
    const W = customSize?.width ?? part.width;

    let sx = L;
    let sy = t;
    let sz = W;

    const orient = part.orientation || 'horizontal';
    if (orient === 'vertical_yz') {
      const isDrawerLateral = part.componentRole === 'drawer_box' ||
        part.componentRole === 'drawer_lateral' ||
        (part.name.toUpperCase().includes('LATERAL') && (part.name.toUpperCase().includes('CAJ') || !!part.groupId));
      if (isDrawerLateral && L > W) {
        sx = t;
        sy = W;
        sz = L;
      } else {
        sx = t;
        sy = L;
        sz = W;
      }
    } else if (orient === 'vertical_xy') {
      const isDoor = (part.componentRole === 'door' || part.name.toUpperCase().includes('PUERTA')) &&
        !part.name.toUpperCase().includes('CAJ');
      const isDrawerFront = part.componentRole === 'drawer_front';
      const isDrawerBoxHead = part.componentRole === 'drawer_box' ||
        part.name.toUpperCase().includes('CONTRA') ||
        part.name.toUpperCase().includes('TRASERA');
      if (isDrawerBoxHead) {
        sx = L;
        sy = W;
        sz = t;
      } else if (isDoor && L > W) {
        sx = W;
        sy = L;
        sz = t;
      } else if (isDrawerFront && W > L) {
        sx = W;
        sy = L;
        sz = t;
      } else {
        sx = L;
        sy = W;
        sz = t;
      }
    }

    const px = customPos?.x ?? (part.posX ?? 0);
    const py = customPos?.y ?? (part.posY ?? (sy / 2));
    const pz = customPos?.z ?? (part.posZ ?? 0);

    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;

    return {
      minX: px - hx,
      maxX: px + hx,
      minY: py - hy,
      maxY: py + hy,
      minZ: pz - hz,
      maxZ: pz + hz,
      sx,
      sy,
      sz,
      px,
      py,
      pz
    };
  }

  private applyMagneticSnapToPosition(
    movingPart: Part,
    proposedPos: { x: number; y: number; z: number },
    axis: 'x' | 'y' | 'z',
    threshold = 12
  ): { x: number; y: number; z: number } {
    const movingBounds = this.getPartBounds(movingPart, proposedPos);
    const otherParts = this.parts().filter(p => p.id !== movingPart.id);
    if (otherParts.length === 0) return proposedPos;

    let bestSnapPos: number | null = null;
    let minDistance = threshold;

    for (const other of otherParts) {
      const otherBounds = this.getPartBounds(other);

      if (axis === 'x') {
        const overlapY = movingBounds.minY < otherBounds.maxY + 60 && movingBounds.maxY > otherBounds.minY - 60;
        const overlapZ = movingBounds.minZ < otherBounds.maxZ + 60 && movingBounds.maxZ > otherBounds.minZ - 60;
        if (!overlapY || !overlapZ) continue;

        const hx = movingBounds.sx / 2;
        const candidates = [
          otherBounds.minX - hx,
          otherBounds.maxX + hx,
          otherBounds.minX + hx,
          otherBounds.maxX - hx
        ];

        for (const cand of candidates) {
          const dist = Math.abs(proposedPos.x - cand);
          if (dist < minDistance) {
            minDistance = dist;
            bestSnapPos = cand;
          }
        }
      } else if (axis === 'y') {
        const overlapX = movingBounds.minX < otherBounds.maxX + 60 && movingBounds.maxX > otherBounds.minX - 60;
        const overlapZ = movingBounds.minZ < otherBounds.maxZ + 60 && movingBounds.maxZ > otherBounds.minZ - 60;
        if (!overlapX || !overlapZ) continue;

        const hy = movingBounds.sy / 2;
        const candidates = [
          otherBounds.minY - hy,
          otherBounds.maxY + hy,
          otherBounds.minY + hy,
          otherBounds.maxY - hy
        ];

        for (const cand of candidates) {
          const dist = Math.abs(proposedPos.y - cand);
          if (dist < minDistance) {
            minDistance = dist;
            bestSnapPos = Math.max(hy, cand);
          }
        }
      } else if (axis === 'z') {
        const overlapX = movingBounds.minX < otherBounds.maxX + 60 && movingBounds.maxX > otherBounds.minX - 60;
        const overlapY = movingBounds.minY < otherBounds.maxY + 60 && movingBounds.maxY > otherBounds.minY - 60;
        if (!overlapX || !overlapY) continue;

        const hz = movingBounds.sz / 2;
        const candidates = [
          otherBounds.minZ - hz,
          otherBounds.maxZ + hz,
          otherBounds.minZ + hz,
          otherBounds.maxZ - hz
        ];

        for (const cand of candidates) {
          const dist = Math.abs(proposedPos.z - cand);
          if (dist < minDistance) {
            minDistance = dist;
            bestSnapPos = cand;
          }
        }
      }
    }

    if (bestSnapPos !== null) {
      const snapped = { ...proposedPos };
      snapped[axis] = Math.round(bestSnapPos * 10) / 10;
      return snapped;
    }

    return proposedPos;
  }

  private applyMagneticSnapToStretch(
    part: Part,
    targetDimension: 'length' | 'width' | 'thickness',
    posAxis: 'posX' | 'posY' | 'posZ',
    dir: number,
    steppedDelta: number,
    threshold = 12
  ): { dim: number; pos: number } {
    const initialPart = this.dragInitialPart || part;
    const initBounds = this.getPartBounds(initialPart);
    const initialDim = initialPart[targetDimension];
    const minAllowed = targetDimension === 'thickness' ? 3 : 50;
    const proposedDim = Math.max(minAllowed, initialDim + steppedDelta);
    const initialPos = initialPart[posAxis] ?? 0;

    const actualDelta = proposedDim - initialDim;
    let defPos = initialPos + (actualDelta / 2) * dir;
    if (posAxis === 'posY') {
      defPos = Math.max(proposedDim / 2, defPos);
    }

    if (!this.isMagneticSnap()) {
      return { dim: proposedDim, pos: defPos };
    }

    let anchoredFace = 0;
    let proposedMovingFace = 0;

    if (posAxis === 'posX') {
      if (dir === 1) {
        anchoredFace = initBounds.minX;
        proposedMovingFace = anchoredFace + proposedDim;
      } else {
        anchoredFace = initBounds.maxX;
        proposedMovingFace = anchoredFace - proposedDim;
      }
    } else if (posAxis === 'posY') {
      if (dir === 1) {
        anchoredFace = initBounds.minY;
        proposedMovingFace = anchoredFace + proposedDim;
      } else {
        anchoredFace = initBounds.maxY;
        proposedMovingFace = anchoredFace - proposedDim;
      }
    } else if (posAxis === 'posZ') {
      if (dir === 1) {
        anchoredFace = initBounds.minZ;
        proposedMovingFace = anchoredFace + proposedDim;
      } else {
        anchoredFace = initBounds.maxZ;
        proposedMovingFace = anchoredFace - proposedDim;
      }
    }

    const otherParts = this.parts().filter(p => p.id !== part.id);
    let bestCandidateFace: number | null = null;
    let minDistance = threshold;

    for (const other of otherParts) {
      const otherBounds = this.getPartBounds(other);

      if (posAxis === 'posX') {
        const overlapY = initBounds.minY < otherBounds.maxY + 60 && initBounds.maxY > otherBounds.minY - 60;
        const overlapZ = initBounds.minZ < otherBounds.maxZ + 60 && initBounds.maxZ > otherBounds.minZ - 60;
        if (!overlapY || !overlapZ) continue;

        for (const face of [otherBounds.minX, otherBounds.maxX]) {
          const dist = Math.abs(proposedMovingFace - face);
          if (dist < minDistance) {
            minDistance = dist;
            bestCandidateFace = face;
          }
        }
      } else if (posAxis === 'posY') {
        const overlapX = initBounds.minX < otherBounds.maxX + 60 && initBounds.maxX > otherBounds.minX - 60;
        const overlapZ = initBounds.minZ < otherBounds.maxZ + 60 && initBounds.maxZ > otherBounds.minZ - 60;
        if (!overlapX || !overlapZ) continue;

        for (const face of [otherBounds.minY, otherBounds.maxY]) {
          const dist = Math.abs(proposedMovingFace - face);
          if (dist < minDistance) {
            minDistance = dist;
            bestCandidateFace = face;
          }
        }
      } else if (posAxis === 'posZ') {
        const overlapX = initBounds.minX < otherBounds.maxX + 60 && initBounds.maxX > otherBounds.minX - 60;
        const overlapY = initBounds.minY < otherBounds.maxY + 60 && initBounds.maxY > otherBounds.minY - 60;
        if (!overlapX || !overlapY) continue;

        for (const face of [otherBounds.minZ, otherBounds.maxZ]) {
          const dist = Math.abs(proposedMovingFace - face);
          if (dist < minDistance) {
            minDistance = dist;
            bestCandidateFace = face;
          }
        }
      }
    }

    if (bestCandidateFace !== null) {
      let snappedDim = 0;
      if (dir === 1) {
        snappedDim = Math.round(bestCandidateFace - anchoredFace);
      } else {
        snappedDim = Math.round(anchoredFace - bestCandidateFace);
      }

      if (snappedDim >= minAllowed) {
        let snappedPos = anchoredFace + (snappedDim / 2) * dir;
        if (posAxis === 'posY') {
          snappedPos = Math.max(snappedDim / 2, snappedPos);
        }
        return { dim: snappedDim, pos: snappedPos };
      }
    }

    return { dim: proposedDim, pos: defPos };
  }

  // Camera preset controls
  setViewPreset(preset: 'iso' | 'front' | 'side' | 'top') {
    if (!this.camera || !this.controls) return;

    const target = this.controls.target.clone();
    const distance = 2200;

    switch (preset) {
      case 'iso':
        this.camera.position.set(target.x + 1400, target.y + 1100, target.z + 1800);
        break;
      case 'front':
        this.camera.position.set(target.x, target.y, target.z + distance);
        break;
      case 'side':
        this.camera.position.set(target.x + distance, target.y, target.z);
        break;
      case 'top':
        this.camera.position.set(target.x, target.y + distance, target.z + 1);
        break;
    }
    this.camera.lookAt(target);
    this.controls.update();
  }

  togglePartOpen(partId: string) {
    const cur = this.openTargetMap.get(partId) || 0;
    const next = cur > 0.5 ? 0 : 1;
    this.openTargetMap.set(partId, next);

    const targetPiece = this.pieceObjects.find(p => p.part.id === partId);
    if (targetPiece) {
      // 1. If part belongs to a PartGroup (e.g. modular drawer), synchronize ALL parts in that group
      if (targetPiece.part.groupId) {
        const gId = targetPiece.part.groupId;
        for (const p of this.pieceObjects) {
          if (p.part.groupId === gId) {
            this.openTargetMap.set(p.part.id, next);
          }
        }
      } else if (targetPiece.isDrawer) {
        const targetY = targetPiece.originalPos.y;
        const targetPart = targetPiece.part;

        // Extract drawer instance identifier prefix if present
        const boxSubKeywords = ['_frente', '_lat_izq', '_lat_der', '_contrafrente', '_trasera', '_frente_int', '_fondo'];
        let specificPrefix = '';
        for (const kw of boxSubKeywords) {
          if (targetPart.id.includes(kw)) {
            specificPrefix = targetPart.id.split(kw)[0];
            break;
          }
        }
        if (!specificPrefix && targetPart.id.includes('caj_ind_')) {
          const match = targetPart.id.match(/caj_ind_\d+/);
          if (match) specificPrefix = match[0];
        }

        // Synchronize ONLY sub-components that are part of the EXACT same physical drawer box
        for (const p of this.pieceObjects) {
          if (p.isDrawer && p.part.id !== partId) {
            // If a specific drawer prefix is identified, match that exact prefix
            if (specificPrefix && (p.part.id.startsWith(specificPrefix + '_') || p.part.id.includes(specificPrefix))) {
              this.openTargetMap.set(p.part.id, next);
              continue;
            }

            // Otherwise, match only if they are interior box sub-parts belonging to the same module and same Y level
            const isAnotherFront = (p.part.componentRole === 'drawer_front' || p.part.name.toUpperCase().includes('FRENTE'));
            const isAtSameElevation = Math.abs(p.originalPos.y - targetY) < 30;
            const isSameModule = !targetPart.moduleId || p.part.moduleId === targetPart.moduleId;

            // Never trigger a different drawer front or a drawer at a different height!
            if (!isAnotherFront && isAtSameElevation && isSameModule && !specificPrefix) {
              this.openTargetMap.set(p.part.id, next);
            }
          }
        }
      }
    }

    const allDoorsDrawers = this.pieceObjects.filter(p => p.isDoor || p.isDrawer);
    if (allDoorsDrawers.length > 0) {
      const allOpen = allDoorsDrawers.every(p => (this.openTargetMap.get(p.part.id) || 0) > 0.5);
      this.isAllOpen.set(allOpen);
    }
  }

  toggleAllDoorsAndDrawers() {
    const next = !this.isAllOpen();
    this.isAllOpen.set(next);
    for (const p of this.pieceObjects) {
      if (p.isDoor || p.isDrawer) {
        this.openTargetMap.set(p.part.id, next ? 1 : 0);
      }
    }
  }

  private clock = new THREE.Clock();

  private updateOpeningAnimations(delta = 0.016) {
    const lerpFactor = Math.min(1, delta * 9.5);
    for (const p of this.pieceObjects) {
      if (!p.isDoor && !p.isDrawer) continue;
      const tgt = this.openTargetMap.get(p.part.id) || 0;
      let cur = this.openCurrentMap.get(p.part.id) || 0;
      if (Math.abs(cur - tgt) > 0.001) {
        cur += (tgt - cur) * lerpFactor;
        this.openCurrentMap.set(p.part.id, cur);
      } else {
        cur = tgt;
        this.openCurrentMap.set(p.part.id, cur);
      }

      if (p.isDoor && p.doorPivot) {
        if (p.hingeSide === 'left') {
          p.doorPivot.rotation.y = -cur * (Math.PI / 2.05);
        } else if (p.hingeSide === 'right') {
          p.doorPivot.rotation.y = cur * (Math.PI / 2.05);
        } else if (p.hingeSide === 'top') {
          p.doorPivot.rotation.x = cur * (Math.PI / 2.2);
        } else if (p.hingeSide === 'bottom') {
          p.doorPivot.rotation.x = -cur * (Math.PI / 2.2);
        }
      } else if (p.isDrawer) {
        const expX = p.explodedOffset.x * (this.explodedPercent() / 100);
        const expY = p.explodedOffset.y * (this.explodedPercent() / 100);
        const expZ = p.explodedOffset.z * (this.explodedPercent() / 100);
        // Uniform smooth slide travel for all parts in the drawer (320mm)
        const maxSlide = 320;
        const axis = p.slideAxis || 'z';
        const dir = p.slideDir ?? 1;

        if (axis === 'x') {
          p.mesh.position.x = p.originalPos.x + expX + cur * maxSlide * dir;
          p.mesh.position.y = p.originalPos.y + expY;
          p.mesh.position.z = p.originalPos.z + expZ;
        } else if (axis === 'y') {
          p.mesh.position.x = p.originalPos.x + expX;
          p.mesh.position.y = p.originalPos.y + expY + cur * maxSlide * dir;
          p.mesh.position.z = p.originalPos.z + expZ;
        } else {
          p.mesh.position.x = p.originalPos.x + expX;
          p.mesh.position.y = p.originalPos.y + expY;
          p.mesh.position.z = p.originalPos.z + expZ + cur * maxSlide * dir;
        }
      }
    }
  }

  toggleOpenClose() {
    this.toggleAllDoorsAndDrawers();
  }

  toggleXRay() {
    this.isXRay.update(v => !v);
  }

  toggleDimensions() {
    this.show3dDimensions.update(v => !v);
  }

  resetCamera() {
    if (!this.controls || !this.camera) return;
    this.setViewPreset('iso');
  }

  private onResize() {
    const container = this.containerRef()?.nativeElement;
    if (!container || !this.renderer || !this.camera) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.updateOpeningAnimations(delta);
    if (this.controls) {
      this.controls.update();
    }
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  ngOnDestroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
