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
  OnDestroy,
  inject
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Part, Material, DrillHole, CollisionRecord, EdgeBandingType } from '../../models/melamine.models';
import { JoineryEngineService } from '../../services/joinery-engine.service';

interface PieceMeshData {
  part: Part;
  mesh: THREE.Mesh;
  originalPos: THREE.Vector3;
  explodedOffset: THREE.Vector3;
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

  // Inputs
  parts = input<Part[]>([]);
  selectedPartId = input<string | null>(null);
  selectedPartIds = input<string[]>([]);
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
  isWhiteTheme = signal<boolean>(true); // Default to clean pure white studio background

  // SketchUp CAD Palette & Push/Pull State
  readonly activeTool = signal<'select' | 'push_pull' | 'move' | 'measure' | 'rotate_90' | 'draw_rect'>('select');
  readonly pushPullDelta = signal<{ axisName: string; initialVal: number; currentVal: number; delta: number } | null>(null);
  readonly hoveredFaceInfo = signal<{ partName: string; faceLabel: string; dimLabel: string } | null>(null);
  readonly showViewsDropdown = signal<boolean>(false);
  readonly showExplodedSlider = signal<boolean>(false);

  // Right-Click Context Menu State
  readonly contextMenuPos = signal<{ x: number; y: number } | null>(null);
  readonly contextMenuPart = signal<Part | null>(null);
  readonly showQuickMaterialPicker = signal<boolean>(false);
  readonly showRotateSubmenu = signal<boolean>(false);

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
  readonly measurePointA = signal<{ x: number; y: number; z: number } | null>(null);
  readonly measurePointB = signal<{ x: number; y: number; z: number } | null>(null);
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

  // Active Selected Parts list
  readonly selectedParts = computed<Part[]>(() => {
    const ids = this.activeSelectedIds();
    return this.parts().filter(p => ids.includes(p.id));
  });

  // Active Selected Part (primary)
  readonly selectedPart = computed(() => {
    const list = this.selectedParts();
    return list.length > 0 ? list[0] : null;
  });

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
  private dragStartPointer = { x: 0, y: 0 };
  private dragInitialPart: Part | null = null;
  private dragInitialParts: Part[] = [];
  private dragPlane = new THREE.Plane();
  private dragPlaneIntersectionStart = new THREE.Vector3();

  // Push / Pull Tool Interactive State
  private isPushPulling = false;
  private pushPullData: {
    part: Part;
    targetDim: 'length' | 'width';
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

    // Rebuild scene when pieces, selection, materials, xRay, or drill holes change
    effect(() => {
      const parts = this.parts();
      const selIds = this.activeSelectedIds();
      const mats = this.materials();
      const xRay = this.isXRay();
      const showDims = this.show3dDimensions();
      this.showDrillHoles();
      this.activeTool();
      this.hiddenPartIds();

      if (this.scene) {
        this.buildFurnitureScene(parts, selIds, mats, xRay, showDims);
        this.updateExplodedOffsets(this.explodedPercent());
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
    window.addEventListener('pointerup', () => this.onPointerUp());
    window.addEventListener('pointercancel', () => this.onPointerUp());
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

      const orient = part.orientation || 'horizontal';
      if (orient === 'vertical_yz') {
        sx = t;
        sy = L;
        sz = W;
      } else if (orient === 'vertical_xy') {
        sx = L;
        sy = W;
        sz = t;
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

      this.furnitureGroup.add(mesh);
      this.pieceObjects.push({
        part,
        mesh,
        originalPos: mesh.position.clone(),
        explodedOffset
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
      if (selectedDataList.length > 1 && (this.activeTool() === 'move' || this.activeTool() === 'select')) {
        // Multiple pieces selected (Group Assembly) -> Centered Group Translation Gizmo
        const centroid = this.calculateCentroid(selectedDataList.map(d => d.part));
        this.buildGroupGizmo(centroid.x, centroid.y, centroid.z);
      }
    }
  }

  // Create Interactive 3D Gizmo: Translation Arrows (X, Y, Z) and Edge Stretch Handles
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

    const arrowLength = 160;
    const coneRadius = 14;
    const coneHeight = 36;
    const cylRadius = 4;

    // Helper to build translation axis arrow
    const createAxisArrow = (
      dirVector: THREE.Vector3,
      colorHex: number,
      axis: 'x' | 'y' | 'z',
      dir: number
    ) => {
      const arrowGroup = new THREE.Group();

      // Shaft
      const shaftGeo = new THREE.CylinderGeometry(cylRadius, cylRadius, arrowLength, 12);
      shaftGeo.translate(0, arrowLength / 2, 0);
      const shaftMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        depthTest: false,
        transparent: true,
        opacity: 0.95
      });
      const shaft = new THREE.Mesh(shaftGeo, shaftMat);

      // Cone Head
      const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 16);
      coneGeo.translate(0, arrowLength + coneHeight / 2, 0);
      const coneMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        depthTest: false
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);

      // Hitbox for easy clicking
      const hitGeo = new THREE.CylinderGeometry(coneRadius * 1.5, coneRadius * 1.5, arrowLength + coneHeight, 8);
      hitGeo.translate(0, (arrowLength + coneHeight) / 2, 0);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);

      arrowGroup.add(shaft);
      arrowGroup.add(cone);
      arrowGroup.add(hitMesh);

      // Orient arrow towards direction
      arrowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVector);

      const gizmoData: GizmoHitData = {
        isGizmo: true,
        type: 'axis',
        axis,
        dir
      };
      hitMesh.userData = { ...gizmoData, parentArrow: arrowGroup };
      cone.userData = { ...gizmoData, parentArrow: arrowGroup };
      shaft.userData = { ...gizmoData, parentArrow: arrowGroup };

      this.gizmoHitMeshes.push(hitMesh, cone);
      return arrowGroup;
    };

    // 1. Translation Arrows:
    // X (Red / Bright Coral)
    const arrowX = createAxisArrow(new THREE.Vector3(1, 0, 0), 0xef4444, 'x', 1);
    group.add(arrowX);

    // Y (Green / Emerald)
    const arrowY = createAxisArrow(new THREE.Vector3(0, 1, 0), 0x10b981, 'y', 1);
    group.add(arrowY);

    // Z (Blue / Sky)
    const arrowZ = createAxisArrow(new THREE.Vector3(0, 0, 1), 0x3b82f6, 'z', 1);
    group.add(arrowZ);

    // 2. Edge Stretch Handles (Tiradores de borde interactivos)
    // Cubos/esferas en los bordes para alargar o ensanchar la pieza arrastrando directamente
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
      // Length along Y (Height), Width along Z
      const handleLPlus = createStretchHandle(new THREE.Vector3(0, sy / 2 + 16, 0), 0x2563eb, 'length', 1);
      const handleLMinus = createStretchHandle(new THREE.Vector3(0, -sy / 2 - 16, 0), 0x2563eb, 'length', -1);
      const handleWPlus = createStretchHandle(new THREE.Vector3(0, 0, sz / 2 + 16), 0xf59e0b, 'width', 1);
      const handleWMinus = createStretchHandle(new THREE.Vector3(0, 0, -sz / 2 - 16), 0xf59e0b, 'width', -1);

      group.add(handleLPlus, handleLMinus, handleWPlus, handleWMinus);
    } else {
      // Frontal (XY): Length along X, Width along Y
      const handleLPlus = createStretchHandle(new THREE.Vector3(sx / 2 + 16, 0, 0), 0x2563eb, 'length', 1);
      const handleLMinus = createStretchHandle(new THREE.Vector3(-sx / 2 - 16, 0, 0), 0x2563eb, 'length', -1);
      const handleWPlus = createStretchHandle(new THREE.Vector3(0, sy / 2 + 16, 0), 0xf59e0b, 'width', 1);
      const handleWMinus = createStretchHandle(new THREE.Vector3(0, -sy / 2 - 16, 0), 0xf59e0b, 'width', -1);

      group.add(handleLPlus, handleLMinus, handleWPlus, handleWMinus);
    }

    group.renderOrder = 999;
    this.gizmoGroup.add(group);
  }

  // Create Centered Translation Gizmo for Multiple Selected Pieces (Group/Drawer Assembly)
  private buildGroupGizmo(px: number, py: number, pz: number) {
    const group = new THREE.Group();
    group.position.set(px, py, pz);

    const arrowLength = 175;
    const coneRadius = 15;
    const coneHeight = 38;
    const cylRadius = 4.5;

    const createAxisArrow = (
      dirVector: THREE.Vector3,
      colorHex: number,
      axis: 'x' | 'y' | 'z',
      dir: number
    ) => {
      const arrowGroup = new THREE.Group();

      const shaftGeo = new THREE.CylinderGeometry(cylRadius, cylRadius, arrowLength, 12);
      shaftGeo.translate(0, arrowLength / 2, 0);
      const shaftMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        depthTest: false,
        transparent: true,
        opacity: 0.95
      });
      const shaft = new THREE.Mesh(shaftGeo, shaftMat);

      const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 16);
      coneGeo.translate(0, arrowLength + coneHeight / 2, 0);
      const coneMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        depthTest: false
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);

      const hitGeo = new THREE.CylinderGeometry(coneRadius * 1.6, coneRadius * 1.6, arrowLength + coneHeight, 8);
      hitGeo.translate(0, (arrowLength + coneHeight) / 2, 0);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);

      arrowGroup.add(shaft);
      arrowGroup.add(cone);
      arrowGroup.add(hitMesh);
      arrowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirVector);

      const gizmoData: GizmoHitData = {
        isGizmo: true,
        type: 'axis',
        axis,
        dir
      };
      hitMesh.userData = { ...gizmoData, parentArrow: arrowGroup };
      cone.userData = { ...gizmoData, parentArrow: arrowGroup };
      shaft.userData = { ...gizmoData, parentArrow: arrowGroup };

      this.gizmoHitMeshes.push(hitMesh, cone);
      return arrowGroup;
    };

    // Center Hub Marker showing grouped selection
    const hubGeo = new THREE.SphereGeometry(14, 16, 16);
    const hubMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      depthTest: false
    });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    group.add(hub);

    // 3 Translation Arrows (X, Y, Z)
    group.add(createAxisArrow(new THREE.Vector3(1, 0, 0), 0xef4444, 'x', 1));
    group.add(createAxisArrow(new THREE.Vector3(0, 1, 0), 0x10b981, 'y', 1));
    group.add(createAxisArrow(new THREE.Vector3(0, 0, 1), 0x3b82f6, 'z', 1));

    group.renderOrder = 999;
    this.gizmoGroup.add(group);
  }

  // Render Interactive 3D Measurement Visuals (Point A, Point B, Guide Lines & Dimensions)
  renderMeasurementVisuals() {
    while (this.measureGroup.children.length > 0) {
      const obj = this.measureGroup.children[0];
      this.measureGroup.remove(obj);
    }

    const a = this.measurePointA();
    const b = this.measurePointB();
    if (!a) return;

    const createMarker = (pt: { x: number; y: number; z: number }, colorHex: number, labelText: string) => {
      const markerGroup = new THREE.Group();
      markerGroup.position.set(pt.x, pt.y, pt.z);

      const sphereGeo = new THREE.SphereGeometry(14, 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({ color: colorHex, depthTest: false });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      markerGroup.add(sphere);

      const ringGeo = new THREE.RingGeometry(18, 22, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, depthTest: false });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      markerGroup.add(ring);

      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, 128, 64);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, 64, 32);
      }
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.position.set(0, 32, 0);
      sprite.scale.set(70, 35, 1);
      markerGroup.add(sprite);

      return markerGroup;
    };

    this.measureGroup.add(createMarker(a, 0xfacc15, 'A'));

    if (b) {
      this.measureGroup.add(createMarker(b, 0x38bdf8, 'B'));

      // Direct Euclidean Line between A and B
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.x, a.y, a.z),
        new THREE.Vector3(b.x, b.y, b.z)
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xfacc15,
        linewidth: 3,
        depthTest: false
      });
      const directLine = new THREE.Line(lineGeo, lineMat);
      this.measureGroup.add(directLine);

      // Delta X line (Horizontal red)
      if (Math.abs(b.x - a.x) > 2) {
        const geoX = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(a.x, a.y, a.z),
          new THREE.Vector3(b.x, a.y, a.z)
        ]);
        const matX = new THREE.LineDashedMaterial({ color: 0xef4444, dashSize: 15, gapSize: 10, depthTest: false });
        const lineX = new THREE.Line(geoX, matX);
        lineX.computeLineDistances();
        this.measureGroup.add(lineX);
      }

      // Delta Y line (Vertical green)
      if (Math.abs(b.y - a.y) > 2) {
        const geoY = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(b.x, a.y, a.z),
          new THREE.Vector3(b.x, b.y, a.z)
        ]);
        const matY = new THREE.LineDashedMaterial({ color: 0x10b981, dashSize: 15, gapSize: 10, depthTest: false });
        const lineY = new THREE.Line(geoY, matY);
        lineY.computeLineDistances();
        this.measureGroup.add(lineY);
      }

      // Delta Z line (Depth blue)
      if (Math.abs(b.z - a.z) > 2) {
        const geoZ = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(b.x, b.y, a.z),
          new THREE.Vector3(b.x, b.y, b.z)
        ]);
        const matZ = new THREE.LineDashedMaterial({ color: 0x3b82f6, dashSize: 15, gapSize: 10, depthTest: false });
        const lineZ = new THREE.Line(geoZ, matZ);
        lineZ.computeLineDistances();
        this.measureGroup.add(lineZ);
      }

      // Floating Midpoint Sprite with formatted distance
      const mid = new THREE.Vector3(
        (a.x + b.x) / 2,
        (a.y + b.y) / 2 + 35,
        (a.z + b.z) / 2
      );
      const dist = this.measureDistance();
      if (dist) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 80;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#09090b';
          ctx.beginPath();
          ctx.roundRect(0, 0, 256, 80, 16);
          ctx.fill();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 4;
          ctx.stroke();

          ctx.fillStyle = '#facc15';
          ctx.font = 'bold 36px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${dist.total} mm`, 128, 40);
        }
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.copy(mid);
        sprite.scale.set(160, 50, 1);
        this.measureGroup.add(sprite);
      }
    }
  }

  toggleDrillHoles() {
    this.showDrillHoles.update(v => !v);
  }

  private renderDrillHolesVisuals(holes: DrillHole[]) {
    for (const hole of holes) {
      const holeGroup = new THREE.Group();
      holeGroup.position.set(hole.posX, hole.posY, hole.posZ);

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
      }

      // 3D Drill Bore Cylinder
      const cylGeo = new THREE.CylinderGeometry(cylRadius, cylRadius, cylHeight, 16);
      const cylMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.25,
        metalness: 0.35,
        emissive: color,
        emissiveIntensity: 0.45,
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
      const ringGeo = new THREE.RingGeometry(cylRadius * 0.7, cylRadius * 1.15, 20);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        side: THREE.DoubleSide,
        depthTest: false
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      if (hole.normalAxis === 'x') {
        ringMesh.rotation.y = Math.PI / 2;
      } else if (hole.normalAxis === 'y') {
        ringMesh.rotation.x = Math.PI / 2;
      }
      holeGroup.add(ringMesh);

      this.drillGroup.add(holeGroup);
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

    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      roughness: assignedMat?.textureType === 'wood' ? 0.65 : 0.4,
      metalness: 0.05
    });
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
      const targetPos = item.originalPos
        .clone()
        .addScaledVector(item.explodedOffset, factor);
      item.mesh.position.copy(targetPos);
    }
  }

  // Pointer Down: Detect clicks on Gizmo controls vs Pieces vs Empty space vs Measurement picking
  private onPointerDown(e: PointerEvent) {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.camera) return;

    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 0. Measurement Tape picking mode (Point A -> Point B)
    if (this.isMeasureMode()) {
      const measureIntersects = this.raycaster.intersectObjects(
        [...this.pieceObjects.map(p => p.mesh), ...(this.floorMesh ? [this.floorMesh] : [])],
        true
      );
      if (measureIntersects.length > 0) {
        const pt = measureIntersects[0].point;
        const snapPt = {
          x: Math.round(pt.x),
          y: Math.max(0, Math.round(pt.y)),
          z: Math.round(pt.z)
        };

        if (!this.measurePointA()) {
          this.measurePointA.set(snapPt);
        } else if (this.measurePointA() && !this.measurePointB()) {
          this.measurePointB.set(snapPt);
        } else {
          this.measurePointA.set(snapPt);
          this.measurePointB.set(null);
        }
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
        let targetDim: 'length' | 'width' = 'length';
        let posAxis: 'posX' | 'posY' | 'posZ' = 'posX';

        if (orient === 'horizontal') {
          if (axis === 'x') {
            targetDim = 'length';
            posAxis = 'posX';
          } else if (axis === 'z') {
            targetDim = 'width';
            posAxis = 'posZ';
          } else {
            targetDim = 'length';
            posAxis = 'posY';
          }
        } else if (orient === 'vertical_yz') {
          if (axis === 'y') {
            targetDim = 'length';
            posAxis = 'posY';
          } else if (axis === 'z') {
            targetDim = 'width';
            posAxis = 'posZ';
          } else {
            targetDim = 'length';
            posAxis = 'posX';
          }
        } else {
          if (axis === 'x') {
            targetDim = 'length';
            posAxis = 'posX';
          } else if (axis === 'y') {
            targetDim = 'width';
            posAxis = 'posY';
          } else {
            targetDim = 'length';
            posAxis = 'posZ';
          }
        }

        this.isPushPulling = true;
        this.controls.enabled = false;
        this.dragStarted.emit();

        // Select piece
        this.partsSelected.emit([part.id]);
        this.partSelected.emit(part);

        const initialDim = targetDim === 'length' ? part.length : part.width;
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
          axisName: targetDim === 'length' ? 'Largo' : 'Ancho',
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

    // 2. Normal Piece selection (with Shift-Click multi-selection)
    const intersects = this.raycaster.intersectObjects(
      this.pieceObjects.map(p => p.mesh),
      false
    );

    if (intersects.length > 0) {
      const topHit = intersects[0].object as THREE.Mesh;
      const part = topHit.userData['part'] as Part;
      if (part) {
        if (e.shiftKey) {
          const cur = [...this.activeSelectedIds()];
          const idx = cur.indexOf(part.id);
          if (idx >= 0) {
            cur.splice(idx, 1);
          } else {
            cur.push(part.id);
          }
          this.partsSelected.emit(cur);
          const first = cur.length > 0 ? (this.parts().find(p => p.id === cur[0]) || null) : null;
          this.partSelected.emit(first);
        } else {
          this.partsSelected.emit([part.id]);
          this.partSelected.emit(part);
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

        this.pushPullDelta.set({
          axisName: data.targetDim === 'length' ? 'Largo' : 'Ancho',
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
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = 'default';
    }
  }

  // Pointer Up: Release Dragging
  private onPointerUp() {
    if (this.isDrawingRect() && this.rectStartPoint && this.rectCurrentPoint) {
      const L = Math.round(Math.abs(this.rectCurrentPoint.x - this.rectStartPoint.x));
      const W = Math.round(Math.abs(this.rectCurrentPoint.z - this.rectStartPoint.z));

      if (L >= 60 && W >= 60) {
        const posX = Math.round((this.rectStartPoint.x + this.rectCurrentPoint.x) / 2);
        const posZ = Math.round((this.rectStartPoint.z + this.rectCurrentPoint.z) / 2);
        const posY = this.rectStartPoint.y + 9;

        this.partCreated.emit({
          name: `Pieza Dibujada ${this.parts().length + 1}`,
          length: L,
          width: W,
          thickness: 18,
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

    if (this.isPushPulling) {
      this.isPushPulling = false;
      this.pushPullData = null;
      this.controls.enabled = true;
      this.pushPullDelta.set(null);
      this.clearPushPullHighlight();
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) canvas.style.cursor = 'default';
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

  // --- SKETCHUP CAD TOOLS & PUSH/PULL FACE RAYCASTING ---

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
    const thickness = 18;

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

    const canvas = this.canvasRef()?.nativeElement;
    const container = this.containerRef()?.nativeElement;
    if (!canvas || !container || !this.camera) return;

    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const visibleMeshes = this.pieceObjects.map(p => p.mesh);
    const intersects = this.raycaster.intersectObjects(visibleMeshes, false);

    const contRect = container.getBoundingClientRect();
    const posX = Math.max(10, Math.min(e.clientX - contRect.left, contRect.width - 240));
    const posY = Math.max(10, Math.min(e.clientY - contRect.top, contRect.height - 340));

    if (intersects.length > 0) {
      const topHit = intersects[0].object as THREE.Mesh;
      const part = topHit.userData['part'] as Part;
      if (part) {
        this.contextMenuPart.set(part);
        this.contextMenuPos.set({ x: posX, y: posY });
        this.partsSelected.emit([part.id]);
        this.partSelected.emit(part);
        this.showQuickMaterialPicker.set(false);
        this.showRotateSubmenu.set(false);
        return;
      }
    }

    // Clicked empty canvas space
    this.contextMenuPart.set(null);
    this.contextMenuPos.set({ x: posX, y: posY });
    this.showQuickMaterialPicker.set(false);
    this.showRotateSubmenu.set(false);
  }

  closeContextMenu() {
    this.contextMenuPos.set(null);
    this.contextMenuPart.set(null);
    this.showQuickMaterialPicker.set(false);
    this.showRotateSubmenu.set(false);
  }

  toggleRotateSubmenu() {
    this.showRotateSubmenu.update(v => !v);
    this.showQuickMaterialPicker.set(false);
  }

  toggleQuickMaterialPicker() {
    this.showQuickMaterialPicker.update(v => !v);
    this.showRotateSubmenu.set(false);
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
    if (orientation === 'vertical_yz') sy = L;
    else if (orientation === 'vertical_xy') sy = part.width;

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
    this.closeContextMenu();
  }

  hidePart(part: Part) {
    const next = new Set(this.hiddenPartIds());
    next.add(part.id);
    this.hiddenPartIds.set(next);
    this.clearSelection();
    this.closeContextMenu();
  }

  showAllParts() {
    this.hiddenPartIds.set(new Set());
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
        materialName: mat.name,
        thickness: mat.thickness
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

  // --- PRECISION NUDGE & MAGNETIC SNAPPING METHODS ---

  setNudgeStep(step: number) {
    this.nudgeStep.set(step);
  }

  toggleMagneticSnap() {
    this.isMagneticSnap.update(v => !v);
  }

  toggleViewsDropdown() {
    this.showViewsDropdown.update(v => !v);
  }

  closeViewsDropdown() {
    this.showViewsDropdown.set(false);
  }

  toggleExplodedSlider() {
    this.showExplodedSlider.update(v => !v);
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
    this.measurePointA.set(null);
    this.measurePointB.set(null);
    while (this.measureGroup.children.length > 0) {
      const obj = this.measureGroup.children[0];
      this.measureGroup.remove(obj);
    }
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
      sx = t;
      sy = L;
      sz = W;
    } else if (orient === 'vertical_xy') {
      sx = L;
      sy = W;
      sz = t;
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
    targetDimension: 'length' | 'width',
    posAxis: 'posX' | 'posY' | 'posZ',
    dir: number,
    steppedDelta: number,
    threshold = 12
  ): { dim: number; pos: number } {
    const initialPart = this.dragInitialPart || part;
    const initBounds = this.getPartBounds(initialPart);
    const initialDim = initialPart[targetDimension];
    const proposedDim = Math.max(50, initialDim + steppedDelta);
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

      if (snappedDim >= 50) {
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

  toggleOpenClose() {
    this.isOpenFrentes.update(v => !v);
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
