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
  NgZone,
  inject
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Add01Icon,
  Alert02Icon,
  Archive01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Compass01Icon,
  Delete02Icon,
  Edit02Icon,
  Layers01Icon,
  LockIcon,
  Moon02Icon,
  PaintBoardIcon,
  RulerIcon,
  Settings01Icon,
  Sun01Icon,
  ViewIcon
} from '@hugeicons/core-free-icons';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Part,
  PartGroup,
  Material,
  LayerVisibilityState,
  DrillHole,
  CollisionRecord,
  EdgeBandingType,
  PartHardwareConfig,
  HandleType,
  HandleFinish,
  HingeType,
  SlideType,
  OpeningDirection,
  WorkspaceMode,
  RoomConfiguration,
  RoomWallInstance,
  getResolvedRoomWalls,
  DEFAULT_ROOM_CONFIG,
  ApplianceItem,
  ModuleCavityInfo,
  ParametricDrawerConfig
} from '../../models/melamine.models';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { PartGeometryService, PartWorldAABB } from '../../services/part-geometry.service';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';
import { ProceduralTextureFactory } from '../../utils/procedural-textures';
import { Appliance3dBuilderService } from '../../services/appliance-3d-builder.service';
import { GlbModelLoaderService } from '../../services/glb-model-loader.service';
import { SpatialReferenceGuideService } from '../../services/spatial-reference-guide.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

type HugeIconDef = typeof Compass01Icon;
const cadSvg = (paths: string[]): HugeIconDef =>
  paths.map((d, idx) => ['path', { d, key: `cad_${idx}` }]) as unknown as HugeIconDef;

interface PieceMeshData {
  part: Part;
  mesh: THREE.Mesh;
  originalPos: THREE.Vector3;
  explodedOffset: THREE.Vector3;
  isDoor?: boolean;
  isDrawer?: boolean;
  doorPivot?: THREE.Group;
  doorBaseRotation?: THREE.Euler;
  hingeSide?: 'left' | 'right' | 'top' | 'bottom';
  doorFacing?: 'front' | 'right' | 'back' | 'left';
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
  type: 'axis' | 'handle' | 'corner_handle';
  axis?: 'x' | 'y' | 'z';
  handleTarget?: 'length' | 'width' | 'corner';
  dir: number;
  dirW?: number;
  lengthAxis?: 'x' | 'y' | 'z';
  widthAxis?: 'x' | 'y' | 'z';
  posAxisL?: 'posX' | 'posY' | 'posZ';
  posAxisW?: 'posX' | 'posY' | 'posZ';
  worldHitPos?: THREE.Vector3;
  cursor?: string;
}

interface PartStretchAxesConfig {
  lengthAxis: 'x' | 'y' | 'z';
  lengthPosAxis: 'posX' | 'posY' | 'posZ';
  widthAxis: 'x' | 'y' | 'z';
  widthPosAxis: 'posX' | 'posY' | 'posZ';
  thicknessAxis: 'x' | 'y' | 'z';
}

export interface DimensionBadgeUserData {
  isDimensionBadge: boolean;
  badgeType: 'length' | 'width' | 'top_clearance' | 'bottom_clearance';
  part: Part;
  currentValue: number;
  label: string;
  referenceY?: number;
  baseScaleX?: number;
  baseScaleY?: number;
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

export interface WallSnapResult {
  isSnappedX: boolean;
  isSnappedZ: boolean;
  correctedX: number;
  correctedZ: number;
  deltaX: number;
  deltaZ: number;
  snappedWallType?: 'main' | 'side' | 'right_side' | 'corner' | 'right_corner' | string;
  snappedWallId?: string;
  suggestedFacing?: 'front' | 'right' | 'back' | 'left';
  contactGuide?: {
    mainWallContact?: {
      xStart: number;
      xEnd: number;
      yMin: number;
      yMax: number;
      z: number;
    };
    sideWallContact?: {
      zStart: number;
      zEnd: number;
      yMin: number;
      yMax: number;
      x: number;
    };
    rightWallContact?: {
      zStart: number;
      zEnd: number;
      yMin: number;
      yMax: number;
      x: number;
    };
  };
}

export interface WallToWallSnapGuide {
  xStart: number;
  zStart: number;
  xEnd: number;
  zEnd: number;
  yMin: number;
  yMax: number;
}

@Component({
  selector: 'app-furniture-3d-viewer',
  imports: [HugeiconsIconComponent, TranslatePipe],
  templateUrl: './furniture-3d-viewer.html',
  styleUrl: './furniture-3d-viewer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block w-full h-full',
    '(window:keydown)': 'handleViewerKeyDown($event)',
    '(window:keyup)': 'handleViewerKeyUp($event)'
  }
})
export class Furniture3dViewerComponent implements OnDestroy {
  readonly i18n = inject(I18nService);
  private readonly ngZone = inject(NgZone);
  private readonly projectStorage = inject(ProjectStorageService);
  private joineryEngine = inject(JoineryEngineService);
  private partGeometry = inject(PartGeometryService);
  readonly hardwareCatalog = inject(HardwareCatalogService);
  private appliance3dBuilder = inject(Appliance3dBuilderService);
  private glbModelLoader = inject(GlbModelLoaderService);
  private spatialGuideBuilder = inject(SpatialReferenceGuideService);

  // Iconos vectoriales estilizados para la cinta de herramientas CAD y menús 3D
  readonly icons = {
    cursorSelect: cadSvg(['M4.5 3.5L19.5 10.5L12.5 13L10 20L4.5 3.5Z']),
    pushPull: cadSvg(['M14 4H20V10', 'M10 20H4V14', 'M20 4L13.5 10.5', 'M4 20L10.5 13.5']),
    moveAxes: cadSvg([
      'M12 3V21',
      'M3 12H21',
      'M9.5 5.5L12 3L14.5 5.5',
      'M9.5 18.5L12 21L14.5 18.5',
      'M5.5 9.5L3 12L5.5 14.5',
      'M18.5 9.5L21 12L18.5 14.5'
    ]),
    rotate90: cadSvg([
      'M20 11A8 8 0 1 0 17.6 16.6',
      'M20 6V11H15'
    ]),
    squareShape: cadSvg(['M4 4H20V20H4V4Z']),
    circleShape: cadSvg(['M21 12A9 9 0 1 1 3 12A9 9 0 0 1 21 12Z']),
    freehandWave: cadSvg(['M3.5 16.5C6.5 8.5 10 8.5 12 12.5C14 16.5 17.5 16.5 20.5 7.5']),
    ruler: RulerIcon,
    cncTarget: cadSvg([
      'M20 12A8 8 0 1 1 4 12A8 8 0 0 1 20 12Z',
      'M14.5 12A2.5 2.5 0 1 1 9.5 12A2.5 2.5 0 0 1 14.5 12Z'
    ]),
    dimensions3d: cadSvg([
      'M3 9H21',
      'M3 6V12',
      'M21 6V12',
      'M7 15H17',
      'M7 13V17',
      'M17 13V17'
    ]),
    clearanceVert: cadSvg([
      'M8.5 8.5L12 5L15.5 8.5',
      'M8.5 15.5L12 19L15.5 15.5',
      'M5 3H19',
      'M5 21H19'
    ]),
    eye: ViewIcon,
    eyeOff: cadSvg([
      'M3 3L21 21',
      'M10.6 10.6A2 2 0 0 0 13.4 13.4',
      'M9.9 5.1A10.5 10.5 0 0 1 12 5C17 5 20.5 9 21.5 12C21 13.4 20.1 14.9 18.8 16.1',
      'M6.2 6.2C4.4 7.5 3.1 9.5 2.5 12C3.5 15 7 19 12 19C13.8 19 15.4 18.5 16.8 17.6'
    ]),
    hardwareTool: cadSvg([
      'M14.7 6.3A1 1 0 0 0 14.7 7.7L16.3 9.3A1 1 0 0 0 17.7 9.3L20.7 6.3A5.5 5.5 0 0 1 13 13.5L6.5 20A2.1 2.1 0 0 1 3.5 17L10 10.5A5.5 5.5 0 0 1 17.2 2.8L14.7 6.3Z'
    ]),
    doorClosed: cadSvg([
      'M5 3H19V21H5V3Z',
      'M12 3V21',
      'M9.5 11.5V12.5',
      'M14.5 11.5V12.5'
    ]),
    doorOpen: cadSvg([
      'M5 3H19V21H5V3Z',
      'M12 3L17.5 5.5V18.5L12 21V3Z',
      'M9.5 11.5V12.5'
    ]),
    inbox: Archive01Icon,
    sun: Sun01Icon,
    moon: Moon02Icon,
    performanceBolt: cadSvg([
      'M13 2L4 14H11L9 22L20 10H13L13 2Z'
    ]),
    humanGuide: cadSvg([
      'M12 3.5A2.2 2.2 0 1 0 12 7.9A2.2 2.2 0 1 0 12 3.5Z',
      'M8.5 10.5C8.5 9.4 9.4 8.5 10.5 8.5H13.5C14.6 8.5 15.5 9.4 15.5 10.5V15H14V20.5H10V15H8.5V10.5Z'
    ]),
    cameraFocus: cadSvg([
      'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8',
      'M16 4H18.5A1.5 1.5 0 0 1 20 5.5V8',
      'M20 16V18.5A1.5 1.5 0 0 1 18.5 20H16',
      'M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16',
      'M14 12A2 2 0 1 1 10 12A2 2 0 0 1 14 12Z'
    ]),
    close: Cancel01Icon,
    add: Add01Icon,
    checkCircle: CheckmarkCircle02Icon,
    tune: Settings01Icon,
    copy: cadSvg([
      'M9 9H19V19H9V9Z',
      'M5 15H4V4H15V5'
    ]),
    unlink: cadSvg([
      'M10 14L14 10',
      'M7.5 16.5L5.5 18.5A3.5 3.5 0 0 1 5.5 13.5L7.5 11.5',
      'M16.5 7.5L18.5 5.5A3.5 3.5 0 0 1 18.5 10.5L16.5 12.5'
    ]),
    arrowUp: ArrowUp01Icon,
    arrowDown: ArrowDown01Icon,
    arrowLeft: ArrowLeft01Icon,
    arrowRight: ArrowRight01Icon,
    chevronUp: ArrowUp01Icon,
    chevronDown: ArrowDown01Icon,
    chevronRight: ArrowRight01Icon,
    warning: Alert02Icon,
    delete: Delete02Icon,
    lock: LockIcon,
    magnet: cadSvg(['M6 4V11A6 6 0 0 0 18 11V4', 'M6 8H9', 'M15 8H18']),
    layers: Layers01Icon,
    palette: PaintBoardIcon,
    edit: Edit02Icon,
    rotateRight: cadSvg([
      'M20 11A8 8 0 1 0 17.6 16.6',
      'M20 6V11H15'
    ]),
    link: cadSvg([
      'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
      'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'
    ]),
    appliance: cadSvg([
      'M6 3H18A1 1 0 0 1 19 4V20A1 1 0 0 1 18 21H6A1 1 0 0 1 5 20V4A1 1 0 0 1 6 3Z',
      'M5 10H19',
      'M8 6.5V7.5',
      'M8 13V16'
    ])
  };

  onSelectedDimensionInput(prop: 'length' | 'width' | 'thickness', event: Event) {
    const target = event.target as HTMLInputElement | null;
    if (target) {
      this.updateSelectedPartDimension(prop, target.value);
    }
  }

  // Referencias a los listeners del DOM para removerlos limpiamente en ngOnDestroy
  private readonly boundPointerDown = (e: PointerEvent) => this.onPointerDown(e);
  private readonly boundPointerMove = (e: PointerEvent) => this.onPointerMove(e);
  private readonly boundPointerUp = (e: PointerEvent) => this.onPointerUp(e);
  private readonly boundCanvasWheel = (e: WheelEvent) => this.onCanvasWheel(e);
  // Inputs
  parts = input<Part[]>([]);
  selectedPartId = input<string | null>(null);
  selectedPartIds = input<string[]>([]);
  partGroups = input<PartGroup[]>([]);
  materials = input<Material[]>([]);
  workspaceMode = input<WorkspaceMode>('module');
  roomConfig = input<RoomConfiguration>(DEFAULT_ROOM_CONFIG);
  selectedWallId = input<string | null>(null);
  appliances = input<ApplianceItem[]>([]);
  selectedApplianceId = input<string | null>(null);
  selectedApplianceIds = input<string[]>([]);
  defaultBoardThickness = input<number>(15);
  layerVisibility = input<LayerVisibilityState>({
    showCountertops: true,
    showFronts: true,
    showHandles: true,
    showPlinths: true,
    showAppliances: true
  });

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
  insertDrawerInCavityRequested = output<{ groupId: string; partId?: string }>();
  groupRotationRequested = output<{ groupId: string; deltaAngle: 90 | -90 | 180 }>();
  groupDuplicationRequested = output<string>();
  groupResizeRequested = output<{ groupId: string; prop: 'width' | 'height' | 'depth' | 'thickness'; value: number }>();
  editModuleRequested = output<string>();
  hiddenPartsChanged = output<string[]>();
  showAllRequested = output<void>();
  roomConfigModified = output<Partial<RoomConfiguration> & { recordHistory?: boolean }>();
  wallSelected = output<string | null>();
  readonly selectedWallType = signal<string | null>(null);
  applianceSelected = output<ApplianceItem | null>();
  appliancesSelected = output<string[]>();
  applianceModified = output<{ appliance: ApplianceItem; updates: Partial<ApplianceItem> }>();
  multipleAppliancesModified = output<{ updates: { id: string; updates: Partial<ApplianceItem> }[] }>();
  applianceDeleted = output<string>();
  applianceDuplicated = output<string>();

  // Canvas and Container refs
  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas3d');
  containerRef = viewChild<ElementRef<HTMLDivElement>>('container3d');
  inlineDimensionInputRef = viewChild<ElementRef<HTMLInputElement>>('inlineDimensionInput');
  inlineEditorContainerRef = viewChild<ElementRef<HTMLDivElement>>('inlineEditorContainer');

  // Inline 3D Dimension Editor state (Edición Directa al Clic sobre Cotas 3D)
  readonly inlineDimensionEditor = signal<{
    x: number;
    y: number;
    value: number;
    propType: 'length' | 'width' | 'top_clearance' | 'bottom_clearance';
    part: Part;
    label: string;
    referenceY?: number;
    worldPos: THREE.Vector3;
  } | null>(null);

  // Interactive View States
  isOpenFrentes = signal<boolean>(false);
  isXRay = signal<boolean>(false);
  explodedPercent = signal<number>(0);
  show3dDimensions = signal<boolean>(true);
  showClearances = signal<boolean>(true);
  showDrillHoles = signal<boolean>(true);
  showHardware = signal<boolean>(true); // Visualizar tiradores, bisagras y correderas 3D
  isWhiteTheme = signal<boolean>(true); // Default to clean pure white studio background

  showReferenceGuide = signal<boolean>(true);
  readonly isReferenceGuideSelected = signal<boolean>(false);
  readonly referenceGuidePos = signal<{ x: number; z: number }>({ x: -1150, z: 350 });
  private referenceGuideGroup = new THREE.Group();
  private isReferenceGuideDragging = false;
  private dragInitialGuidePos = { x: -1150, z: 350 };

  toggleReferenceGuide() {
    this.showReferenceGuide.update(v => !v);
    if (!this.showReferenceGuide()) {
      this.isReferenceGuideSelected.set(false);
    }
  }

  private updateReferenceGuideScene() {
    if (!this.scene) return;
    this.disposeGroup(this.referenceGuideGroup);
    if (!this.showReferenceGuide()) {
      this.referenceGuideGroup.visible = false;
      return;
    }
    this.referenceGuideGroup.visible = true;
    const cfg = this.roomConfig();
    const floorW = cfg.floorWidth || 5000;
    const floorD = cfg.floorDepth || 5000;
    const built = this.spatialGuideBuilder.buildGuideScene({
      figurePos: this.referenceGuidePos(),
      isSelected: this.isReferenceGuideSelected(),
      isWhiteTheme: this.isWhiteTheme(),
      width: floorW,
      depth: floorD
    });
    this.referenceGuideGroup.add(built);
  }

  // Hardware visibility per group / per part
  readonly hiddenHardwareGroupIds = signal<Set<string>>(new Set<string>());
  readonly hiddenHardwarePartIds = signal<Set<string>>(new Set<string>());

  // CAD Palette & Push/Pull State
  readonly activeTool = signal<'select' | 'move' | 'measure' | 'rotate_90'>('select');
  readonly pushPullDelta = signal<{ axisName: string; initialVal: number; currentVal: number; delta: number } | null>(null);
  readonly hoveredFaceInfo = signal<{ partName: string; faceLabel: string; dimLabel: string } | null>(null);
  readonly showViewsDropdown = signal<boolean>(false);
  readonly showExplodedSlider = signal<boolean>(false);
  readonly showGroupsFlyout = signal<boolean>(false);

  // Right-Click Context Menu State
  readonly contextMenuPos = signal<{ x: number; y: number } | null>(null);
  readonly contextMenuPart = signal<Part | null>(null);
  readonly contextMenuAppliance = signal<ApplianceItem | null>(null);
  readonly showQuickMaterialPicker = signal<boolean>(false);
  readonly showRotateSubmenu = signal<boolean>(false);
  readonly showMovableRoleSubmenu = signal<boolean>(false);
  readonly showHandleSubmenu = signal<boolean>(false);
  readonly showHingeSubmenu = signal<boolean>(false);
  readonly showSlideSubmenu = signal<boolean>(false);

  // Hidden / Isolated Parts & Appliances
  readonly hiddenPartIds = signal<Set<string>>(new Set());
  readonly hiddenAppliancesCount = computed(() => this.appliances().filter(a => a.isHidden).length);
  readonly totalHiddenCount = computed(() => this.hiddenPartIds().size + this.hiddenAppliancesCount());

  // Draw 3D Rectangle Tool State
  readonly isDrawingRect = signal<boolean>(false);
  readonly rectDrawDims = signal<{ length: number; width: number } | null>(null);
  private rectStartPoint: THREE.Vector3 | null = null;
  private rectCurrentPoint: THREE.Vector3 | null = null;
  private rectPreviewGroup = new THREE.Group();

  // Draw 3D Circle Tool State
  readonly isDrawingCircle = signal<boolean>(false);
  readonly circleDrawDims = signal<{ radius: number; diameter: number } | null>(null);
  private circleCenterPoint: THREE.Vector3 | null = null;
  private circleCurrentPoint: THREE.Vector3 | null = null;
  private circlePreviewGroup = new THREE.Group();

  // Draw Freehand (Mano Alzada) Tool State
  readonly isDrawingFreehand = signal<boolean>(false);
  readonly freehandStats = signal<{ pointCount: number; perimeter: number } | null>(null);
  private freehandPlaneY = 0;
  private freehandPoints: THREE.Vector3[] = [];
  private freehandPreviewGroup = new THREE.Group();

  // Collisions & Joinery Signals
  readonly detectedCollisions = signal<CollisionRecord[]>([]);
  readonly showCollisionsDetail = signal<boolean>(false);
  readonly allDrillHoles = signal<DrillHole[]>([]);

  toggleCollisionsDetail() {
    this.showCollisionsDetail.update(v => !v);
  }

  // Precision Nudge & Magnetic Snapping
  readonly isMagneticSnap = signal<boolean>(true);
  readonly nudgeStep = signal<number>(1); // 1 mm default (toggleable to 10mm)

  // 3D Measurement Tape / Ruler tool (Motor de Inferencias CAD)
  readonly isMeasureMode = signal<boolean>(false);
  readonly isMeasurementPersistent = signal<boolean>(false);
  readonly measurePointA = signal<{ x: number; y: number; z: number } | null>(null);
  readonly measurePointB = signal<{ x: number; y: number; z: number } | null>(null);
  readonly measureProjectionMode = signal<'direct' | 'x' | 'y' | 'z'>('direct');
  readonly activeInferredAxis = signal<'x' | 'y' | 'z' | null>(null);
  readonly isShiftPressed = signal<boolean>(false);

  private measurePointAEdgeDir: THREE.Vector3 | null = null;
  private measurePointerDownPos: { x: number; y: number } | null = null;
  private measurePointerDownTime = 0;

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

  // Ventana de selección múltiple por arrastre (Marquee Box Selection con Shift)
  readonly marqueeBox = signal<{ left: number; top: number; width: number; height: number } | null>(null);
  private isMarqueeSelecting = false;
  private marqueeStart = { x: 0, y: 0, clientX: 0, clientY: 0 };

  // Current selected group (activo cuando un ÚNICO módulo/grupo está seleccionado en su totalidad)
  readonly currentSelectedGroup = computed<PartGroup | null>(() => {
    const ids = this.activeSelectedIds();
    if (ids.length === 0) return null;
    const parts = this.parts();
    const selectedParts = parts.filter(p => ids.includes(p.id));
    const uniqueGroupIds = Array.from(new Set(selectedParts.map(p => p.groupId).filter(Boolean))) as string[];

    // Si hay más de un grupo seleccionado, NO es un único grupo (modo multiselección)
    if (uniqueGroupIds.length > 1) return null;

    if (uniqueGroupIds.length === 1) {
      const gId = uniqueGroupIds[0];
      const groupParts = parts.filter(p => p.groupId === gId);
      // Si el grupo tiene varias piezas y solo se seleccionó 1, es modo inspección de pieza individual
      if (ids.length === 1 && groupParts.length > 1) {
        return null;
      }
      return this.partGroups().find(group => group.id === gId) || null;
    }
    return null;
  });

  // Active Selected Appliance IDs set
  readonly activeSelectedApplianceIds = computed<string[]>(() => {
    const multi = this.selectedApplianceIds();
    if (multi && multi.length > 0) return multi;
    const single = this.selectedApplianceId();
    return single ? [single] : [];
  });

  // Información reactiva cuando se seleccionan 2 o más módulos o muebles con electrodomésticos a la vez
  readonly selectedMultiGroupsInfo = computed<{ groupCount: number; partCount: number; applianceCount: number } | null>(() => {
    const partIds = this.activeSelectedIds();
    const appIds = this.activeSelectedApplianceIds();
    const totalCount = partIds.length + appIds.length;
    if (totalCount <= 1) return null;

    const parts = this.parts().filter(p => partIds.includes(p.id));
    const uniqueGroupIds = new Set(parts.map(p => p.groupId).filter(Boolean));

    if (uniqueGroupIds.size > 1 || (partIds.length > 0 && appIds.length > 0) || appIds.length > 1) {
      return {
        groupCount: uniqueGroupIds.size,
        partCount: partIds.length,
        applianceCount: appIds.length
      };
    }
    return null;
  });

  // Grupo padre cuando se está inspeccionando una pieza individual perteneciente a un módulo/grupo
  readonly selectedPartParentGroup = computed<PartGroup | null>(() => {
    const sel = this.selectedPart();
    if (!sel?.groupId) return null;
    return this.partGroups().find(g => g.id === sel.groupId) || null;
  });

  // Dimensiones globales del módulo o grupo seleccionado
  readonly currentSelectedGroupBounds = computed<{
    width: number;
    height: number;
    depth: number;
    thickness: number;
    count: number;
  } | null>(() => {
    const grp = this.currentSelectedGroup();
    if (!grp) return null;
    const grpParts = this.parts().filter(p => p.groupId === grp.id);
    if (grpParts.length === 0) return null;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let structuralThickness = 15;
    for (const p of grpParts) {
      const b = this.joineryEngine.getPartBounds(p);
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxY > maxY) maxY = b.maxY;
      if (b.minZ < minZ) minZ = b.minZ;
      if (b.maxZ > maxZ) maxZ = b.maxZ;
      if ((p.thickness || 15) > 8 && p.componentRole !== 'back') {
        structuralThickness = p.thickness || 15;
      }
    }
    return {
      width: Math.round(maxX - minX),
      height: Math.round(maxY - minY),
      depth: Math.round(maxZ - minZ),
      thickness: structuralThickness,
      count: grpParts.length
    };
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
    const explicitId = this.selectedPartId();
    const list = this.selectedParts();
    if (explicitId) {
      const found = list.find(p => p.id === explicitId);
      if (found) return found;
    }
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

  onSelectedGroupDimensionChange(prop: 'width' | 'height' | 'depth' | 'thickness', event: Event) {
    const grp = this.currentSelectedGroup();
    const target = event.target as HTMLInputElement | null;
    if (!grp || !target) return;
    const val = Number(target.value);
    if (isNaN(val) || val <= 0) return;
    this.groupResizeRequested.emit({
      groupId: grp.id,
      prop,
      value: Math.round(val)
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
  private internalClearanceGroup = new THREE.Group();
  private readonly internalClearanceLineMat: THREE.LineDashedMaterial = (() => {
    const mat = new THREE.LineDashedMaterial({
      color: 0x10b981,
      dashSize: 14,
      gapSize: 7,
      linewidth: 2,
      depthTest: false
    });
    mat.userData = { isShared: true };
    return mat;
  })();
  private readonly internalClearanceTickMat: THREE.LineBasicMaterial = (() => {
    const mat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      linewidth: 2,
      depthTest: false
    });
    mat.userData = { isShared: true };
    return mat;
  })();
  private gizmoGroup = new THREE.Group();
  private measureGroup = new THREE.Group();
  private magneticSnapGroup = new THREE.Group();
  private drillGroup = new THREE.Group();
  private pushPullHighlightGroup = new THREE.Group();
  private gridHelper: THREE.GridHelper | null = null;
  private floorMesh: THREE.Mesh | null = null;
  private keyLightRef: THREE.DirectionalLight | null = null;
  private frontLightRef: THREE.DirectionalLight | null = null;

  // Modo de Rendimiento Adaptativo para PCs de Bajos Recursos / Gráficos Integrados (60 FPS)
  readonly isPerformanceMode = signal<boolean>(this.loadInitialPerformanceMode());

  private loadInitialPerformanceMode(): boolean {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage.getItem('melamipro_3d_performance_mode') === 'true';
    }
    return false;
  }

  /**
   * Calcula el devicePixelRatio óptimo:
   * - Modo Rendimiento (Bajo Recursos): 1.0x estricto (ahorra hasta 75% de carga de fragmentos en GPU).
   * - Modo Calidad Alta: limitado a máximo 1.5x para evitar sobrecarga 4x en pantallas Retina/2K/4K.
   */
  private getTargetPixelRatio(): number {
    if (this.isPerformanceMode()) {
      return 1;
    }
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return Math.min(dpr, 1.5);
  }
  private roomGroup = new THREE.Group();
  private wallSnapGuideGroup = new THREE.Group();
  private legSnapGuideGroup = new THREE.Group();
  private appliancesGroup = new THREE.Group();
  private applianceGizmoGroup = new THREE.Group();

  // Mesh & Raycast Tracking + GPU Performance Caches
  private pieceObjects: PieceMeshData[] = [];
  private pieceObjectMap = new Map<string, PieceMeshData>();
  private raycastablePieceMeshes: THREE.Mesh[] = [];
  private gizmoHitMeshes: THREE.Mesh[] = [];
  private editableDimensionSprites: THREE.Sprite[] = [];
  private hoveredGizmoMesh: THREE.Mesh | null = null;
  private hoveredDimensionSprite: THREE.Sprite | null = null;
  private scratchEditorProj = new THREE.Vector3();
  private scratchCamCheck = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private isCameraInteracting = false;
  private lastHoverRaycastTime = 0;
  private renderFramesRemaining = 60;
  private lastSnapIndicatorKey = '';
  private materialCache = new Map<string, THREE.Material>();
  private geometryPool = new Map<string, THREE.BufferGeometry>();
  private readonly boundVisibilityChange = () => {
    if (typeof document !== 'undefined' && !document.hidden && !this.isRenderingPaused) {
      this.requestRender(12);
    }
  };

  // Live In-Place Transform Buffers (evita reconstruir toda la escena 3D en cada píxel de pointermove)
  private liveDragPartUpdates = new Map<string, { part: Part; updates: Partial<Part> }>();
  private liveDragApplianceUpdates = new Map<string, { id: string; updates: Partial<ApplianceItem> }>();
  private liveDragPrimaryApplianceUpdate: { appliance: ApplianceItem; updates: Partial<ApplianceItem> } | null = null;

  // Firma reactiva ligera que solo cambia cuando se añade/mueve un lavaplatos ('sink') o estufa ('cooktop') que perfora mesones
  private readonly cutoutAppliancesSignature = computed(() => {
    const apps = this.appliances() || [];
    return apps
      .filter(a => !a.isHidden && (a.type === 'sink' || a.type === 'cooktop'))
      .map(a => `${a.id}:${Math.round(a.position.x)},${Math.round(a.position.y)},${Math.round(a.position.z)}:${a.width}x${a.depth}:${a.rotation || 0}`)
      .join('|');
  });

  /**
   * Solicita renderizar un número acotado de fotogramas bajo demanda (On-Demand Rendering)
   * cuando ocurre un cambio visual, movimiento de cámara o interacción.
   */
  requestRender(frames = 8) {
    this.renderFramesRemaining = Math.max(this.renderFramesRemaining, frames);
  }

  // Dragging State
  private isDragging = false;
  private activeGizmoHit: GizmoHitData | null = null;
  private dynamicEdgeHandleMesh: THREE.Mesh | null = null;
  private activeDynamicEdgeHit: GizmoHitData | null = null;

  // Vectores y objetos pre-alojados en memoria (Zero-Allocation en bucles calientes wheel / pointermove / rAF)
  private readonly scratchWheelMouse = new THREE.Vector2();
  private readonly scratchWheelDelta = new THREE.Vector3();
  private readonly scratchWheelCamForward = new THREE.Vector3();
  private readonly scratchWheelPlane = new THREE.Plane();
  private readonly scratchWheelPlaneHit = new THREE.Vector3();
  private readonly scratchGizmoWorldPos = new THREE.Vector3();
  private readonly scratchCurrentIntersection = new THREE.Vector3();
  private readonly scratchDeltaWorld = new THREE.Vector3();
  private readonly scratchSingleMovedDelta = new THREE.Vector3();
  private readonly scratchCamForward = new THREE.Vector3();
  private readonly scratchEdgeA = new THREE.Vector3();
  private readonly scratchEdgeB = new THREE.Vector3();
  private readonly scratchClippedA = new THREE.Vector3();
  private readonly scratchClippedB = new THREE.Vector3();
  private readonly scratchScreenA = new THREE.Vector3();
  private readonly scratchScreenB = new THREE.Vector3();
  private readonly scratchClosestWorld = new THREE.Vector3();
  private readonly scratchBestHitWorld = new THREE.Vector3();
  private readonly scratchSegDir = new THREE.Vector3();
  private readonly scratchW0 = new THREE.Vector3();

  private isDirectPieceDrag = false;
  private directPieceDragThresholdPassed = false;
  private dragStartPointer = { x: 0, y: 0 };
  private dragInitialPart: Part | null = null;
  private dragInitialParts: Part[] = [];
  private dragPlane = new THREE.Plane();
  private dragPlaneIntersectionStart = new THREE.Vector3();
  private isWallDragging = false;
  private activeWallTarget: string | null = null;
  private initialWallPosX = 0;
  private initialWallPosZ = 0;
  private initialWallOffsetX = 0;
  private initialWallOffsetZ = 0;
  private wallGizmoGroup = new THREE.Group();
  private wallGizmoHitMeshes: THREE.Mesh[] = [];
  private isWallGizmoDragging = false;
  private activeWallGizmoHit: {
    isWallGizmo: boolean;
    type: 'wall_move' | 'wall_stretch' | 'wall_stretch_height';
    axis?: 'x' | 'y' | 'z';
    wallTarget?: string;
  } | null = null;
  private initialWallLength = 0;
  private initialWallHeight = 0;
  private pendingWallUpdates: { wallId: string; updates: Partial<RoomWallInstance> } | null = null;
  private applianceMeshMap = new Map<string, THREE.Group>();
  private badgeSpriteCache = new Map<string, { texture: THREE.CanvasTexture; material: THREE.SpriteMaterial }>();
  private isRenderingPaused = false;
  private lastSnappedWallResult: WallSnapResult | null = null;

  public pauseRendering(): void {
    this.isRenderingPaused = true;
    this.cancelActiveInteractions();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public resumeRendering(): void {
    if (!this.isRenderingPaused && this.animationFrameId !== null) return;
    this.isRenderingPaused = false;
    this.ngZone.runOutsideAngular(() => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          if (!this.isRenderingPaused) {
            this.onResize();
            this.requestRender(8);
          }
        });
      }
      if (this.animationFrameId === null) {
        this.animate();
      }
    });
    this.requestRender(8);
  }

  // Appliance Direct Drag & 3D Resize State
  private isApplianceDragging = false;
  private isApplianceResizing = false;
  private draggingAppliance: ApplianceItem | null = null;
  private dragInitialAppliancePos = { x: 0, y: 0, z: 0 };
  private dragInitialApplianceDim = { width: 0, depth: 0, height: 0 };
  private activeApplianceHandle: { axis: 'x' | 'y' | 'z'; direction: 1 | -1 } | null = null;
  private applianceHandleHitMeshes: THREE.Mesh[] = [];
  private dragInitialSelectedAppliances: ApplianceItem[] = [];

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
      this.hiddenPartIds();
      this.layerVisibility();
      this.cutoutAppliancesSignature();

      if (this.scene) {
        // Read activeSelectedIds untracked so selection changes don't destroy and rebuild the 3D scene!
        const selIds = untracked(() => this.activeSelectedIds());
        this.buildFurnitureScene(parts, selIds, mats, xRay, showDims);
        this.updateExplodedOffsets(this.explodedPercent());
        this.requestRender(10);
      }
    });

    // 2. High-performance selection highlights & gizmo update WITHOUT rebuilding the 3D scene
    effect(() => {
      const selIds = this.activeSelectedIds();
      const mats = this.materials();
      const xRay = this.isXRay();
      this.activeTool();
      this.i18n.currentLang();

      if (this.scene && this.pieceObjects.length > 0) {
        this.updateSelectionHighlights(selIds, mats, xRay);
        this.requestRender(8);
      }
    });

    // Handle exploded view slider
    effect(() => {
      const exp = this.explodedPercent();
      this.updateExplodedOffsets(exp);
      this.requestRender(6);
    });

    // 4. Update architectural room scene when workspaceMode or roomConfig changes
    effect(() => {
      const mode = this.workspaceMode();
      const config = this.roomConfig();
      if (this.scene) {
        this.updateRoomScene(mode, config);
        this.requestRender(10);
      }
    });

    // 5. Update wall selection highlight & 3D Gizmo when selectedWallId, selectedWallType, roomConfig or workspaceMode changes
    effect(() => {
      const parentWallId = this.selectedWallId();
      untracked(() => {
        if (this.selectedWallType() !== parentWallId) {
          this.selectedWallType.set(parentWallId);
        }
      });
    });

    effect(() => {
      const wallType = this.selectedWallType();
      const config = this.roomConfig();
      const mode = this.workspaceMode();
      if (this.scene) {
        this.updateWallGizmo(wallType, config, mode);
        this.requestRender(8);
      }
    });

    // 6. Update 3D Appliances when appliances, selectedApplianceId, selectedApplianceIds or layerVisibility change
    effect(() => {
      const appls = this.appliances();
      const selId = this.selectedApplianceId();
      this.selectedApplianceIds();
      this.layerVisibility();
      if (this.scene) {
        this.updateAppliancesScene(appls, selId);
        this.requestRender(10);
      }
    });

    // 7. Actualizar Guía de Referencia Espacial, Escala Humana 3D y GridHelper al cambiar tamaño de escenario o idioma
    effect(() => {
      this.showReferenceGuide();
      this.referenceGuidePos();
      this.isReferenceGuideSelected();
      this.isWhiteTheme();
      this.i18n.currentLang();
      const cfg = this.roomConfig();
      // Track floorWidth and floorDepth for reactivity
      const _fw = cfg.floorWidth;
      const _fd = cfg.floorDepth;
      if (this.scene) {
        this.updateGridHelper();
        this.updateReferenceGuideScene();
        this.requestRender(8);
      }
    });

    // 8. Sincronizar apertura interactiva de Cajones Modulares (0% a 100%) desde el Inspector Contextual al visor 3D
    effect(() => {
      const groups = this.partGroups();
      this.parts();
      if (!this.scene || this.pieceObjects.length === 0) return;
      let changed = false;
      for (const g of groups) {
        if (g.type === 'drawer' || g.subType === 'drawer' || g.templateId === 'modular_drawer') {
          const ext = g.slideExtension !== undefined ? g.slideExtension : (g.isOpen ? 1 : 0);
          for (const p of this.pieceObjects) {
            if (p.part.groupId === g.id) {
              const prev = this.openTargetMap.get(p.part.id) ?? 0;
              const curAnim = this.openCurrentMap.get(p.part.id) ?? 0;
              if (Math.abs(prev - ext) > 0.005 || Math.abs(curAnim - ext) > 0.005) {
                this.openTargetMap.set(p.part.id, ext);
                changed = true;
              }
            }
          }
        }
      }
      if (changed) {
        this.requestRender(55);
      }
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

    // 2. Camera (near = 1.5 mm para permitir zoom cercano milimétrico a cantos y esquinas sin recortar geometría)
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1.5, 80000);
    const savedCam = this.projectStorage.lastCameraState();
    const initialMode = this.workspaceMode();
    const initialRoomCfg = this.roomConfig();
    if (savedCam && savedCam.position && savedCam.target) {
      this.camera.position.set(savedCam.position.x, savedCam.position.y, savedCam.position.z);
    } else if (initialMode === 'room') {
      const effW = initialRoomCfg.floorWidth || 5000;
      const effD = initialRoomCfg.floorDepth || 5000;
      const frameDist = Math.max(effW, effD) * 1.35;
      const tgtY = (initialRoomCfg.wallHeight || 2600) * 0.35;
      this.camera.position.set(frameDist * 0.45, tgtY + frameDist * 0.55, frameDist * 0.8);
    } else {
      this.camera.position.set(1500, 1100, 1900);
    }

    // 3. Renderer (con límite inteligente de devicePixelRatio <= 1.5x o 1.0x en Modo Rendimiento)
    const lowSpec = this.isPerformanceMode();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.getTargetPixelRatio());
    this.renderer.shadowMap.enabled = !lowSpec;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. OrbitControls (instanciado fuera de NgZone para que wheel/pointermove de cámara no disparen Change Detection)
    this.ngZone.runOutsideAngular(() => {
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.maxDistance = 45000;
      this.controls.minDistance = 5;
      this.controls.maxPolarAngle = Math.PI / 2 + 0.08;
      if (savedCam && savedCam.target) {
        this.controls.target.set(savedCam.target.x, savedCam.target.y, savedCam.target.z);
      } else if (initialMode === 'room') {
        this.controls.target.set(0, (initialRoomCfg.wallHeight || 2600) * 0.35, 0);
      } else {
        this.controls.target.set(0, 480, 0);
      }
      this.controls.update();
      this.updateAdaptiveCameraSpeeds();

      this.controls.addEventListener('start', () => {
        this.isCameraInteracting = true;
        this.hideDynamicEdgeHandle();
        this.setHoveredGizmoMesh(null);
        this.setHoveredDimensionSprite(null);
        this.updateAdaptiveCameraSpeeds();
        this.requestRender(12);
      });
      this.controls.addEventListener('change', () => {
        this.updateAdaptiveCameraSpeeds();
        this.updateAdaptiveGizmoScale();
        if (this.inlineDimensionEditor()) {
          this.updateInlineEditorScreenPosition();
        }
        this.requestRender(8);
      });
      this.controls.addEventListener('end', () => {
        this.isCameraInteracting = false;
        this.updateAdaptiveCameraSpeeds();
        this.updateAdaptiveGizmoScale();
        this.projectStorage.saveCameraState(this.camera.position, this.controls.target, true);
        this.requestRender(16);
      });
    });

    // 5. Lighting
    this.setupLighting();

    // 6. Floor Grid & Shadow Plane
    this.setupFloorGrid();

    // 7. Add Groups
    this.scene.add(this.furnitureGroup);
    this.scene.add(this.dimensionGroup);
    this.internalClearanceGroup.renderOrder = 999;
    this.scene.add(this.internalClearanceGroup);
    this.scene.add(this.gizmoGroup);
    this.scene.add(this.measureGroup);
    this.scene.add(this.magneticSnapGroup);
    this.scene.add(this.drillGroup);
    this.scene.add(this.pushPullHighlightGroup);
    this.scene.add(this.rectPreviewGroup);
    this.scene.add(this.circlePreviewGroup);
    this.scene.add(this.freehandPreviewGroup);
    this.scene.add(this.roomGroup);
    this.scene.add(this.wallSnapGuideGroup);
    this.scene.add(this.legSnapGuideGroup);
    this.scene.add(this.wallGizmoGroup);
    this.scene.add(this.appliancesGroup);
    this.scene.add(this.applianceGizmoGroup);
    this.scene.add(this.referenceGuideGroup);
    this.updateReferenceGuideScene();

    // Initial Appliances Setup
    this.updateAppliancesScene(this.appliances(), this.selectedApplianceId());

    // Initial Room Environment & Wall Gizmo Setup (rehidratación inmediata en modo Habitación 3D)
    this.selectedWallType.set(this.selectedWallId());
    this.updateRoomScene(initialMode, initialRoomCfg);
    this.updateWallGizmo(this.selectedWallType(), initialRoomCfg, initialMode);

    // Initial Scene Build
    this.buildFurnitureScene(
      this.parts(),
      this.activeSelectedIds(),
      this.materials(),
      this.isXRay(),
      this.show3dDimensions()
    );

    // 8, 9 y 10. Ejecutar el bucle WebGL y eventos continuos estrictamente fuera de NgZone
    // para no disparar ciclos innecesarios de detección de cambios en Angular
    this.ngZone.runOutsideAngular(() => {
      this.animate();

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.onResize();
        });
        this.resizeObserver.observe(container);
      }

      canvas.addEventListener('pointerdown', this.boundPointerDown);
      canvas.addEventListener('wheel', this.boundCanvasWheel, { passive: true });
      window.addEventListener('pointermove', this.boundPointerMove);
      window.addEventListener('pointerup', this.boundPointerUp);
      window.addEventListener('pointercancel', this.boundPointerUp);
      if (typeof document !== 'undefined') {
        this.timer.connect(document);
        document.addEventListener('visibilitychange', this.boundVisibilityChange);
      }
      this.updateAdaptiveGizmoScale();
    });
  }

  private applyThemeColors() {
    if (!this.scene) return;
    const isWhite = this.isWhiteTheme();
    const lowSpec = this.isPerformanceMode();

    if (isWhite) {
      // Architectural Daylight Grey with soft contrast - subtle atmospheric fog (omitted in Performance Mode)
      this.scene.background = new THREE.Color(0xeae8e1);
      this.scene.fog = lowSpec ? null : new THREE.FogExp2(0xeae8e1, 0.000025);
      if (this.floorMesh) {
        (this.floorMesh.material as THREE.ShadowMaterial).opacity = 0.08;
      }
      this.updateGridHelper();
    } else {
      // Dark CAD Mode - subtle atmospheric fog (omitted in Performance Mode)
      this.scene.background = new THREE.Color(0x0e0e11);
      this.scene.fog = lowSpec ? null : new THREE.FogExp2(0x0e0e11, 0.00006);
      if (this.floorMesh) {
        (this.floorMesh.material as THREE.ShadowMaterial).opacity = 0.35;
      }
      this.updateGridHelper();
    }
  }

  private updateGridHelper() {
    if (!this.scene) return;
    const cfg = this.roomConfig();
    const floorW = cfg.floorWidth || 5000;
    const floorD = cfg.floorDepth || 5000;
    const gridSpan = Math.max(floorW, floorD);
    const divisions = Math.max(10, Math.round(gridSpan / 100));

    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.geometry.dispose();
      if (Array.isArray(this.gridHelper.material)) {
        this.gridHelper.material.forEach(m => m.dispose());
      } else {
        this.gridHelper.material.dispose();
      }
      this.gridHelper = null;
    }

    if (this.isWhiteTheme()) {
      this.gridHelper = new THREE.GridHelper(gridSpan, divisions, 0xc4c0b8, 0xd6d3cd);
    } else {
      this.gridHelper = new THREE.GridHelper(gridSpan, divisions, 0x06b6d4, 0x27272a);
    }
    this.gridHelper.position.y = 0;
    this.gridHelper.visible = (this.workspaceMode() !== 'room');
    this.scene.add(this.gridHelper);
  }

  toggleTheme() {
    this.isWhiteTheme.update(v => !v);
    this.applyThemeColors();
    this.updateReferenceGuideScene();
    this.requestRender(8);
  }

  /**
   * Alterna entre el Modo Rendimiento (60 FPS para PCs de bajos recursos / gráficos integrados)
   * y el Modo de Calidad Alta (sombras suaves PCF en tiempo real y DPR hasta 1.5x).
   */
  togglePerformanceMode() {
    const next = !this.isPerformanceMode();
    this.isPerformanceMode.set(next);
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('melamipro_3d_performance_mode', next ? 'true' : 'false');
    }
    this.applyPerformanceProfile();
  }

  private applyPerformanceProfile() {
    if (!this.renderer || !this.scene) return;
    const lowSpec = this.isPerformanceMode();

    this.renderer.setPixelRatio(this.getTargetPixelRatio());
    this.renderer.shadowMap.enabled = !lowSpec;
    this.renderer.shadowMap.needsUpdate = true;

    if (this.keyLightRef) {
      this.keyLightRef.castShadow = !lowSpec;
    }
    if (this.frontLightRef) {
      this.frontLightRef.visible = !lowSpec;
    }
    if (this.floorMesh) {
      this.floorMesh.receiveShadow = !lowSpec;
      this.floorMesh.visible = !lowSpec && this.workspaceMode() !== 'room';
    }

    this.applyThemeColors();

    // Notificar a los materiales del grafo de escena para recompilar shaders con/sin mapa de sombras
    this.scene.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.material) {
        if (Array.isArray(obj.material)) {
          for (const m of obj.material) {
            if (m) m.needsUpdate = true;
          }
        } else {
          obj.material.needsUpdate = true;
        }
      }
    });

    this.requestRender(12);
  }

  private setupLighting() {
    const lowSpec = this.isPerformanceMode();

    // Soft Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    // Warm Hemisphere Light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.7);
    this.scene.add(hemiLight);

    // Key Directional Light for Crisp Shadows
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(1600, 2600, 1800);
    keyLight.castShadow = !lowSpec;
    keyLight.shadow.mapSize.width = 1536;
    keyLight.shadow.mapSize.height = 1536;
    keyLight.shadow.camera.near = 200;
    keyLight.shadow.camera.far = 7000;
    const d = 2200;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0003;
    this.keyLightRef = keyLight;
    this.scene.add(keyLight);

    // Soft Side & Back Fill Lights
    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.65);
    fillLight.position.set(-1800, 1400, -1200);
    this.scene.add(fillLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 0.45);
    frontLight.position.set(0, 800, 2200);
    frontLight.visible = !lowSpec;
    this.frontLightRef = frontLight;
    this.scene.add(frontLight);
  }

  private setupFloorGrid() {
    const lowSpec = this.isPerformanceMode();
    // Soft shadow receiver plane
    const floorGeo = new THREE.PlaneGeometry(8000, 8000);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.09 });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = -1;
    this.floorMesh.receiveShadow = !lowSpec;
    this.floorMesh.visible = !lowSpec && this.workspaceMode() !== 'room';
    this.scene.add(this.floorMesh);

    // Millimetric Grid Helper sincronizado con el espacio de trabajo
    this.updateGridHelper();
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
  /**
   * Obtiene o instancia una geometría compartida en caché (Geometry Pooling) marcada con `isShared: true`
   * para evitar duplicar buffers WebGL (VBOs) en piezas, herrajes o perforaciones CNC de iguales dimensiones.
   */
  private getSharedGeometry<T extends THREE.BufferGeometry>(key: string, factory: () => T): T {
    const existing = this.geometryPool.get(key) as T | undefined;
    if (existing) {
      return existing;
    }
    const created = factory();
    created.userData['isShared'] = true;
    this.geometryPool.set(key, created);
    return created;
  }

  /**
   * Obtiene o instancia un material compartido en caché (Material Pooling) marcado con `isShared: true`
   * para reutilizar shaders y estados WebGL entre piezas con la misma melamina, herrajes o contornos.
   */
  private getSharedMaterial<T extends THREE.Material>(key: string, factory: () => T): T {
    const existing = this.materialCache.get(key) as T | undefined;
    if (existing) {
      return existing;
    }
    const created = factory();
    created.userData['isShared'] = true;
    this.materialCache.set(key, created);
    return created;
  }

  private getSharedEdgeMaterial(isColliding: boolean, isSelected: boolean): THREE.LineBasicMaterial {
    const isWhite = this.isWhiteTheme();
    const key = isColliding
      ? 'edge_colliding'
      : isSelected
        ? 'edge_selected'
        : isWhite
          ? 'edge_default_light'
          : 'edge_default_dark';
    return this.getSharedMaterial(key, () => {
      const edgeColor = isColliding ? 0xef4444 : (isSelected ? 0x2563eb : (isWhite ? 0x94a3b8 : 0x3f3f46));
      return new THREE.LineBasicMaterial({
        color: edgeColor,
        linewidth: isColliding || isSelected ? 3 : 1
      });
    });
  }

  private buildFurnitureScene(
    parts: Part[],
    selectedIds: string[],
    mats: Material[],
    xRay: boolean,
    showDims: boolean
  ) {
    // Liberar explícitamente geometrías, materiales no compartidos y texturas temporales en GPU (VRAM)
    this.disposeGroup(this.furnitureGroup);
    this.disposeGroup(this.dimensionGroup);
    this.disposeGroup(this.gizmoGroup);
    this.disposeGroup(this.drillGroup);

    this.pieceObjects = [];
    this.pieceObjectMap.clear();
    this.raycastablePieceMeshes = [];
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
    const visiblePartsForJoinery = parts.filter(p => !this.hiddenPartIds().has(p.id));
    const joinery = this.joineryEngine.calculateJoinery(visiblePartsForJoinery);
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
    const vis = this.layerVisibility();
    const cutoutAppliances = (this.appliances() || []).filter(a => a.type === 'sink' || a.type === 'cooktop');

    for (const part of parts) {
      if (this.hiddenPartIds().has(part.id)) {
        continue;
      }

      // Filtro de capas estilo Click-Cuisine 2
      const role = part.componentRole || 'free';
      const nameLow = (part.name || '').toLowerCase();
      if (!vis.showCountertops && (role === 'countertop' || role === 'backsplash' || nameLow.includes('mesón') || nameLow.includes('meson') || nameLow.includes('salpicadero'))) {
        continue;
      }
      if (!vis.showFronts && (role === 'door' || role === 'drawer_front' || role === 'front' || nameLow.includes('puerta') || (nameLow.includes('frente') && !nameLow.includes('contrafrente')))) {
        continue;
      }
      if (!vis.showPlinths && (role === 'plinth' || nameLow.includes('zócalo') || nameLow.includes('zocalo'))) {
        continue;
      }

      const baseBounds = this.partGeometry.getWorldAABB(part);
      const localDims = this.partGeometry.getLocalDimensions(part);
      const sx = baseBounds.sx;
      const sy = baseBounds.sy;
      const sz = baseBounds.sz;
      const px = baseBounds.px;
      const py = baseBounds.py;
      const pz = baseBounds.pz;

      const isSelected = selectedIds.includes(part.id);
      const isColliding = collidingPartIds.has(part.id);

      if (isSelected) {
        selectedDataList.push({ part, px, py, pz, sx, sy, sz });
      }

      // Detectar si esta pieza horizontal es un mesón o cubierta que debe perforarse automáticamente
      // para alojar un lavaplatos ('sink') o una estufa de empotrar ('cooktop')
      const isHorizontalSurface = (part.orientation || 'horizontal') === 'horizontal';
      const isCountertopOrCover =
        isHorizontalSurface &&
        (role === 'countertop' ||
          role === 'top' ||
          nameLow.includes('mesón') ||
          nameLow.includes('meson') ||
          nameLow.includes('encimera') ||
          nameLow.includes('cubierta'));

      const partTopY = py + sy / 2;
      const overlappingCutouts: { localX: number; localZ: number; holeW: number; holeD: number }[] = [];

      if (isCountertopOrCover && cutoutAppliances.length > 0) {
        const rotYRad = THREE.MathUtils.degToRad(part.rotationY || 0);
        const cosY = Math.cos(-rotYRad);
        const sinY = Math.sin(-rotYRad);

        for (const app of cutoutAppliances) {
          // Verificar proximidad vertical entre el equipo y la superficie superior del mesón
          if (Math.abs(app.position.y - partTopY) > 180) continue;

          const dxWorld = app.position.x - px;
          const dzWorld = app.position.z - pz;
          const localX = dxWorld * cosY - dzWorld * sinY;
          const localZ = dxWorld * sinY + dzWorld * cosY;

          const appRot = ((app.rotation || 0) % 360 + 360) % 360;
          const appSpanX = appRot === 90 || appRot === 270 ? app.depth : app.width;
          const appSpanZ = appRot === 90 || appRot === 270 ? app.width : app.depth;

          // Margen perimetral de apoyo (24mm por lado para que el labio del lavaplatos o vidrio apoye en el mesón)
          const holeW = Math.max(80, appSpanX - 48);
          const holeD = Math.max(80, appSpanZ - 48);

          if (Math.abs(localX) < localDims.sx / 2 && Math.abs(localZ) < localDims.sz / 2) {
            overlappingCutouts.push({ localX, localZ, holeW, holeD });
          }
        }
      }

      // Geometry according to shapeType: circle, extruded board (cuts/cutouts), or pooled standard box
      let geometry: THREE.BufferGeometry;
      let edges: THREE.EdgesGeometry;
      if (part.shapeType === 'circle') {
        const radius = part.radius || (part.diameter ? part.diameter / 2 : Math.max(10, (part.width || 600) / 2));
        const cylHeight = (part.length && part.length > part.thickness) ? part.length : (part.thickness || 15);
        const orient = part.orientation || 'horizontal';
        const cylKey = `piece_cyl_${radius}_${cylHeight}_${orient}`;
        geometry = this.getSharedGeometry(cylKey, () => {
          const geo = new THREE.CylinderGeometry(radius, radius, cylHeight, 48);
          if (orient === 'horizontal') {
            geo.rotateZ(Math.PI / 2);
          }
          return geo;
        });
        edges = this.getSharedGeometry(`${cylKey}_edges`, () => new THREE.EdgesGeometry(geometry));
      } else if (
        part.cornerCutConfig ||
        (part.shapeType === 'freehand' && part.contourPoints && part.contourPoints.length >= 3) ||
        overlappingCutouts.length > 0
      ) {
        geometry = this.partGeometry.buildExtrudedBoardGeometry(part, overlappingCutouts);
        edges = new THREE.EdgesGeometry(geometry);
      } else {
        const boxKey = `piece_box_${localDims.sx}_${localDims.sy}_${localDims.sz}`;
        geometry = this.getSharedGeometry(boxKey, () => new THREE.BoxGeometry(localDims.sx, localDims.sy, localDims.sz));
        edges = this.getSharedGeometry(`${boxKey}_edges`, () => new THREE.EdgesGeometry(geometry));
      }

      const material = this.createPieceMaterial(part, isSelected, mats, xRay, isColliding);
      const mesh = new THREE.Mesh(geometry, material);

      mesh.position.set(px, py, pz);
      if (part.rotationX || part.rotationY || part.rotationZ) {
        const rx = THREE.MathUtils.degToRad(part.rotationX || 0);
        const ry = THREE.MathUtils.degToRad(part.rotationY || 0);
        const rz = THREE.MathUtils.degToRad(part.rotationZ || 0);
        mesh.rotation.set(rx, ry, rz, 'XYZ');
      }
      mesh.castShadow = !xRay;
      mesh.receiveShadow = true;
      mesh.userData = { part, isPiece: true };

      // Edges geometry for crisp technical outline (pooled geometry & shared material)
      const edgeMat = this.getSharedEdgeMaterial(isColliding, isSelected);
      const edgeLines = new THREE.LineSegments(edges, edgeMat);
      mesh.add(edgeLines);

      // Exploded vector
      const explodedOffset = new THREE.Vector3(
        px * 0.45,
        (py - 400) * 0.4,
        pz * 0.45
      );

      const hw = part.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(part);
      const isDoor =
        (hw.movableType === 'door' || part.componentRole === 'door' || part.name.toUpperCase().includes('PUERTA')) &&
        !part.name.toUpperCase().includes('CAJ');

      const isCarcassStructure =
        part.componentRole === 'side_left' ||
        part.componentRole === 'side_right' ||
        part.componentRole === 'top' ||
        part.componentRole === 'bottom' ||
        part.componentRole === 'plinth' ||
        part.componentRole === 'back' ||
        part.componentRole === 'shelf';

      const isInternalBoxPart =
        !isCarcassStructure &&
        (part.componentRole === 'drawer_box' ||
          (part.name.toUpperCase().includes('CAJ') &&
            (part.name.toUpperCase().includes('LATERAL') ||
              part.name.toUpperCase().includes('COSTADO') ||
              part.name.toUpperCase().includes('TRASERA') ||
              part.name.toUpperCase().includes('FONDO') ||
              part.name.toUpperCase().includes('CONTRAFRENTE') ||
              part.name.toUpperCase().includes('INTERIOR'))));

      const isDrawerFront =
        !isCarcassStructure &&
        !isInternalBoxPart &&
        (part.componentRole === 'drawer_front' ||
          (hw.movableType === 'drawer' && !isInternalBoxPart) ||
          (part.name.toUpperCase().includes('FRENTE') &&
            (part.name.toUpperCase().includes('CAJ') || part.name.toUpperCase().includes('GAVET'))) ||
          ((part.name.toUpperCase().startsWith('CAJ') || part.name.toUpperCase().startsWith('GAVET')) &&
            !isInternalBoxPart));

      const isPartInDrawerGroup = !!part.groupId && this.partGroups().some(g => g.id === part.groupId && g.type === 'drawer');
      const isDrawer =
        !isCarcassStructure &&
        !isDoor &&
        (isPartInDrawerGroup ||
          isDrawerFront ||
          isInternalBoxPart);

      let doorPivot: THREE.Group | undefined;
      let doorBaseRotation: THREE.Euler | undefined;
      let hingeSide: 'left' | 'right' | 'top' | 'bottom' = hw.openingDirection || 'left';
      let doorFacing: 'front' | 'right' | 'back' | 'left' = 'front';
      let doorLocalMeshPos: THREE.Vector3 | undefined;
      let doorPivotOriginalPos: THREE.Vector3 | undefined;
      let handleGroup: THREE.Group | undefined;
      let hingeGroup: THREE.Group | undefined;
      let slideGroup: THREE.Group | undefined;

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

      const isHwHidden =
        (part.groupId && this.hiddenHardwareGroupIds().has(part.groupId)) ||
        this.hiddenHardwarePartIds().has(part.id);
      const shouldRenderHardware = this.showHardware() && !isHwHidden;

      if (isDoor) {
        doorFacing = this.joineryEngine.getPartFacingDirection(part, parts);
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
        const doorDimX = localDims.sx;
        const doorDimY = localDims.sy;
        const doorDimZ = localDims.sz;

        const rx = THREE.MathUtils.degToRad(part.rotationX || 0);
        const ry = THREE.MathUtils.degToRad(part.rotationY || 0);
        const rz = THREE.MathUtils.degToRad(part.rotationZ || 0);
        doorBaseRotation = new THREE.Euler(rx, ry, rz, 'XYZ');
        const doorQuat = new THREE.Quaternion().setFromEuler(doorBaseRotation);

        const localHingeOffset = new THREE.Vector3();
        if (hingeSide === 'right') {
          localHingeOffset.set(doorDimX / 2, 0, -doorDimZ / 2);
        } else if (hingeSide === 'top') {
          localHingeOffset.set(0, doorDimY / 2, -doorDimZ / 2);
        } else if (hingeSide === 'bottom') {
          localHingeOffset.set(0, -doorDimY / 2, -doorDimZ / 2);
        } else {
          localHingeOffset.set(-doorDimX / 2, 0, -doorDimZ / 2);
        }

        const worldHingeOffset = localHingeOffset.clone().applyQuaternion(doorQuat);
        doorPivot.position.set(px + worldHingeOffset.x, py + worldHingeOffset.y, pz + worldHingeOffset.z);
        doorPivot.rotation.copy(doorBaseRotation);

        mesh.position.set(-localHingeOffset.x, -localHingeOffset.y, -localHingeOffset.z);
        mesh.rotation.set(0, 0, 0);

        doorLocalMeshPos = mesh.position.clone();
        doorPivotOriginalPos = doorPivot.position.clone();
        doorPivot.add(mesh);

        if (shouldRenderHardware) {
          if (vis.showHandles) {
            handleGroup = this.createHandleMesh(part, hw, doorDimX, doorDimY, doorDimZ, true, hingeSide, doorFacing);
            if (handleGroup) mesh.add(handleGroup);
          }

          hingeGroup = this.createHingesMesh(part, hw, doorDimX, doorDimY, doorDimZ, hingeSide, doorFacing);
          if (hingeGroup) mesh.add(hingeGroup);
        }

        const curOpen = this.openCurrentMap.get(part.id) || 0;
        if (curOpen > 0) {
          this.applyDoorPivotRotation(doorPivot, hingeSide, doorFacing, curOpen, doorBaseRotation);
        }

        this.furnitureGroup.add(doorPivot);
        mesh.userData = { part, isPiece: true, isDoor: true };
      } else if (isDrawer) {
        mesh.position.set(px, py, pz);

        const hasSeparateBoxParts = parts.some(
          other =>
            other.id !== part.id &&
            ((other.groupId && other.groupId === part.groupId) ||
              ((other.componentRole === 'drawer_box' ||
                other.name.toUpperCase().includes('GAVETA') ||
                other.name.toUpperCase().includes('CAJÓN') ||
                other.name.toUpperCase().includes('CAJON')) &&
                Math.abs((other.posY || 0) - (part.posY || 0)) < 150))
        );

        if (isDrawerFront && !hasSeparateBoxParts) {
          const drawerBoxMesh = this.createDrawerBoxMesh(part, sx, sy, sz, drawerFacing);
          if (drawerBoxMesh) mesh.add(drawerBoxMesh);
        }

        const isSlideHostForHeadlessDrawer =
          !isDrawerFront &&
          part.id.endsWith('_contrafrente') &&
          !parts.some(op => op.groupId === part.groupId && op.componentRole === 'drawer_front');

        if ((isDrawerFront || isSlideHostForHeadlessDrawer) && shouldRenderHardware) {
          if (isDrawerFront && vis.showHandles) {
            handleGroup = this.createHandleMesh(part, hw, localDims.sx, localDims.sy, localDims.sz, false, 'top', drawerFacing);
            if (handleGroup) mesh.add(handleGroup);
          }

          slideGroup = this.createDrawerSlidesMesh(part, hw, localDims.sx, localDims.sy, localDims.sz, drawerFacing);
          if (slideGroup) mesh.add(slideGroup);
        }

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

      const pieceData: PieceMeshData = {
        part,
        mesh,
        originalPos: new THREE.Vector3(px, py, pz),
        explodedOffset,
        isDoor,
        isDrawer,
        doorPivot,
        doorBaseRotation,
        hingeSide,
        doorFacing,
        doorLocalMeshPos,
        doorPivotOriginalPos,
        handleGroup,
        hingeGroup,
        slideGroup,
        slideAxis,
        slideDir
      };
      this.pieceObjects.push(pieceData);
      this.pieceObjectMap.set(part.id, pieceData);
      this.raycastablePieceMeshes.push(mesh);
    }

    // 2. Render Drill Holes when toggle is enabled
    if (this.showDrillHoles() && joinery.allDrillHoles.length > 0) {
      this.renderDrillHolesVisuals(joinery.allDrillHoles);
    }

    // Single piece selected -> Full Gizmo and 3D dimensions & Clearances
    if (selectedDataList.length === 1) {
      const s = selectedDataList[0];
      if (showDims) {
        this.renderPieceDimensions(s.part, s.px, s.py, s.pz, s.sx, s.sy, s.sz);
      }
      const clr = this.computeClearanceInfo(s.part, parts);
      this.clearanceCalculated.emit(clr);

      if (this.showClearances()) {
        if (s.part.groupId && (this.isInternalShelf(s.part) || this.isInternalDivider(s.part))) {
          this.renderModuleInternalClearances(s.part.groupId, s.part);
        } else {
          this.disposeGroup(this.internalClearanceGroup);
          this.renderClearanceDimensions(s.part, parts);
        }
      } else {
        this.disposeGroup(this.internalClearanceGroup);
      }
      if (this.activeTool() === 'move' || this.activeTool() === 'select') {
        this.buildGizmo(s.part, s.px, s.py, s.pz, s.sx, s.sy, s.sz);
      }
    } else if (selectedDataList.length > 1) {
      const groupIds = Array.from(new Set(selectedDataList.map(s => s.part.groupId).filter(Boolean))) as string[];
      if (groupIds.length === 1 && this.showClearances()) {
        this.renderModuleInternalClearances(groupIds[0]);
      } else {
        this.disposeGroup(this.internalClearanceGroup);
      }
      this.clearanceCalculated.emit(null);
    } else {
      this.disposeGroup(this.internalClearanceGroup);
      this.clearanceCalculated.emit(null);
    }
  }

  private applyDoorPivotRotation(
    doorPivot: THREE.Group,
    hingeSide: 'left' | 'right' | 'top' | 'bottom',
    doorFacing: 'front' | 'right' | 'back' | 'left',
    cur: number,
    baseRotation?: THREE.Euler
  ) {
    if (baseRotation) {
      doorPivot.rotation.copy(baseRotation);
    } else {
      doorPivot.rotation.set(0, 0, 0);
    }
    if (hingeSide === 'left') {
      doorPivot.rotateY(-cur * (Math.PI / 2.05));
    } else if (hingeSide === 'right') {
      doorPivot.rotateY(cur * (Math.PI / 2.05));
    } else if (hingeSide === 'top') {
      doorPivot.rotateX(-cur * (Math.PI / 2.2));
    } else if (hingeSide === 'bottom') {
      doorPivot.rotateX(cur * (Math.PI / 2.2));
    }
  }
  /**
   * Determina de forma exacta qué ejes globales ('x' | 'y' | 'z') y qué propiedades de posición
   * ('posX' | 'posY' | 'posZ') corresponden al Largo (length), Ancho (width) y Espesor (thickness) de la pieza.
   */
  private getPartStretchAxesConfig(part: Part): PartStretchAxesConfig {
    const stretchWorld = this.partGeometry.getStretchAxesInWorld(part);

    const getDominantAxis = (vec: THREE.Vector3): 'x' | 'y' | 'z' => {
      const ax = Math.abs(vec.x);
      const ay = Math.abs(vec.y);
      const az = Math.abs(vec.z);
      if (ax >= ay && ax >= az) return 'x';
      if (ay >= ax && ay >= az) return 'y';
      return 'z';
    };

    const lengthAxis = getDominantAxis(stretchWorld.lengthAxisWorld);
    const widthAxis = getDominantAxis(stretchWorld.widthAxisWorld);
    const thicknessAxis = getDominantAxis(stretchWorld.thicknessAxisWorld);

    const axisToPosProp: Record<'x' | 'y' | 'z', 'posX' | 'posY' | 'posZ'> = {
      x: 'posX',
      y: 'posY',
      z: 'posZ'
    };

    return {
      lengthAxis,
      lengthPosAxis: axisToPosProp[lengthAxis],
      widthAxis,
      widthPosAxis: axisToPosProp[widthAxis],
      thicknessAxis
    };
  }

  private getSharedGizmoMaterial(colorHex: number, isHovered = false): THREE.MeshStandardMaterial {
    const key = `gizmo_handle_mat_${colorHex}_${isHovered ? 'hover' : 'idle'}`;
    let mat = this.materialCache.get(key) as THREE.MeshStandardMaterial | undefined;
    if (!mat) {
      const color = new THREE.Color(colorHex);
      if (isHovered) {
        color.offsetHSL(0, 0.1, 0.16);
      }
      mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.15,
        metalness: 0.25,
        emissive: colorHex,
        emissiveIntensity: isHovered ? 0.75 : 0.38,
        depthTest: false
      });
      mat.userData = { isShared: true };
      this.materialCache.set(key, mat);
    }
    return mat;
  }

  private getSharedGizmoOutlineMaterial(): THREE.LineBasicMaterial {
    const key = 'gizmo_handle_outline_white';
    let mat = this.materialCache.get(key) as THREE.LineBasicMaterial | undefined;
    if (!mat) {
      mat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, depthTest: false });
      mat.userData = { isShared: true };
      this.materialCache.set(key, mat);
    }
    return mat;
  }

  private ensureDynamicEdgeHandle(isCorner = false, edgeAxis: 'x' | 'y' | 'z' = 'x'): THREE.Mesh {
    if (!this.dynamicEdgeHandleMesh) {
      const sphereGeo = this.getSharedGeometry('gizmo_corner_sphere_cad', () => new THREE.SphereGeometry(6.5, 24, 24));
      const mat = this.getSharedGizmoMaterial(0x06b6d4, false);
      const mesh = new THREE.Mesh(sphereGeo, mat);

      const haloGeo = this.getSharedGeometry('gizmo_corner_halo_cad', () => new THREE.TorusGeometry(8.2, 0.75, 8, 32));
      const outlineMat = this.getSharedGizmoOutlineMaterial();
      const halo = new THREE.Mesh(haloGeo, outlineMat);
      halo.name = 'dynamic_handle_halo';
      halo.raycast = () => {};
      mesh.add(halo);

      mesh.renderOrder = 1000;
      mesh.visible = false;
      this.dynamicEdgeHandleMesh = mesh;
    }

    const haloChild = this.dynamicEdgeHandleMesh.getObjectByName('dynamic_handle_halo') as THREE.Mesh | undefined;

    if (isCorner) {
      const sphereGeo = this.getSharedGeometry('gizmo_corner_sphere_cad', () => new THREE.SphereGeometry(6.5, 24, 24));
      this.dynamicEdgeHandleMesh.geometry = sphereGeo;
      this.dynamicEdgeHandleMesh.quaternion.identity();
      if (haloChild) {
        haloChild.geometry = this.getSharedGeometry('gizmo_corner_halo_cad', () => new THREE.TorusGeometry(8.2, 0.75, 8, 32));
        haloChild.rotation.set(0, 0, 0);
        haloChild.visible = true;
      }
    } else {
      const capsuleGeo = this.getSharedGeometry('gizmo_handle_capsule_bar', () => new THREE.CapsuleGeometry(4.2, 18, 8, 16));
      this.dynamicEdgeHandleMesh.geometry = capsuleGeo;
      const targetDir = new THREE.Vector3();
      targetDir[edgeAxis] = 1;
      this.dynamicEdgeHandleMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), targetDir);
      if (haloChild) {
        haloChild.geometry = this.getSharedGeometry('gizmo_handle_capsule_ring', () => new THREE.TorusGeometry(4.6, 0.65, 8, 24));
        haloChild.rotation.x = Math.PI / 2;
        haloChild.visible = true;
      }
    }

    if (this.dynamicEdgeHandleMesh.parent !== this.gizmoGroup) {
      this.gizmoGroup.add(this.dynamicEdgeHandleMesh);
    }
    return this.dynamicEdgeHandleMesh;
  }

  private hideDynamicEdgeHandle() {
    this.activeDynamicEdgeHit = null;
    if (this.dynamicEdgeHandleMesh && this.dynamicEdgeHandleMesh.visible) {
      this.dynamicEdgeHandleMesh.visible = false;
      this.dynamicEdgeHandleMesh.userData['isHovered'] = false;
      this.requestRender(4);
    }
  }

  private setHoveredGizmoMesh(mesh: THREE.Mesh | null) {
    if (this.hoveredGizmoMesh === mesh) return;

    if (this.hoveredGizmoMesh) {
      const prev = this.hoveredGizmoMesh;
      const colorHex = (prev.userData?.['colorHex'] as number) ?? 0x2563eb;
      prev.material = this.getSharedGizmoMaterial(colorHex, false);
      prev.userData['isHovered'] = false;
    }

    this.hoveredGizmoMesh = mesh;

    if (mesh) {
      const colorHex = (mesh.userData?.['colorHex'] as number) ?? 0x2563eb;
      mesh.material = this.getSharedGizmoMaterial(colorHex, true);
      mesh.userData['isHovered'] = true;
    }

    this.updateAdaptiveGizmoScale();
    this.requestRender(4);
  }

  private setHoveredDimensionSprite(sprite: THREE.Sprite | null) {
    if (this.hoveredDimensionSprite === sprite) return;

    if (this.hoveredDimensionSprite) {
      this.hoveredDimensionSprite.userData['isHovered'] = false;
      const idleMat = this.hoveredDimensionSprite.userData['idleMaterial'] as THREE.SpriteMaterial | undefined;
      if (idleMat) {
        this.hoveredDimensionSprite.material = idleMat;
      }
    }

    this.hoveredDimensionSprite = sprite;

    if (sprite) {
      sprite.userData['isHovered'] = true;
      const hoverMat = sprite.userData['hoverMaterial'] as THREE.SpriteMaterial | undefined;
      if (hoverMat) {
        sprite.material = hoverMat;
      }
    }

    this.updateAdaptiveGizmoScale();
    this.requestRender(4);
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
    // Si la pieza o su módulo están congelados, no mostrar tiradores de estiramiento 3D
    if (this.isPartOrGroupLocked(part)) {
      this.hideDynamicEdgeHandle();
      return;
    }

    const group = new THREE.Group();
    group.position.set(px, py, pz);

    const axesCfg = this.getPartStretchAxesConfig(part);
    const capsuleGeo = this.getSharedGeometry('gizmo_handle_capsule_bar', () => new THREE.CapsuleGeometry(4.2, 18, 8, 16));
    const ringGeo = this.getSharedGeometry('gizmo_handle_capsule_ring', () => new THREE.TorusGeometry(4.6, 0.65, 8, 24));
    const cornerSphereGeo = this.getSharedGeometry('gizmo_corner_sphere_cad', () => new THREE.SphereGeometry(6.5, 24, 24));
    const cornerHaloGeo = this.getSharedGeometry('gizmo_corner_halo_cad', () => new THREE.TorusGeometry(8.2, 0.75, 8, 32));
    const outlineMat = this.getSharedGizmoOutlineMaterial();

    // Edge Stretch Handles: Manipuladores CAD estilizados tipo cápsula/barra redondeada alineados al borde
    const createStretchHandle = (
      edgeCenterLocal: THREE.Vector3,
      offsetDir: THREE.Vector3,
      colorHex: number,
      handleTarget: 'length' | 'width',
      dir: number
    ) => {
      const mat = this.getSharedGizmoMaterial(colorHex, false);
      const mesh = new THREE.Mesh(capsuleGeo, mat);
      mesh.position.copy(edgeCenterLocal).addScaledVector(offsetDir, 16);

      // Orientación elegante a lo largo del borde de la pieza
      const edgeAxis = handleTarget === 'length' ? axesCfg.widthAxis : axesCfg.lengthAxis;
      const targetDir = new THREE.Vector3();
      targetDir[edgeAxis] = 1;
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), targetDir);

      // Anillo collarín central de calibración CAD
      const ring = new THREE.Mesh(ringGeo, outlineMat);
      ring.rotation.x = Math.PI / 2;
      ring.raycast = () => {};
      mesh.add(ring);

      const hitData: GizmoHitData = {
        isGizmo: true,
        type: 'handle',
        handleTarget,
        dir,
        lengthAxis: axesCfg.lengthAxis,
        widthAxis: axesCfg.widthAxis,
        posAxisL: axesCfg.lengthPosAxis,
        posAxisW: axesCfg.widthPosAxis
      };
      mesh.userData = {
        ...hitData,
        baseLocalPos: edgeCenterLocal,
        offsetDir,
        colorHex,
        edgeAxis
      };
      this.gizmoHitMeshes.push(mesh);
      return mesh;
    };

    const halfL = (axesCfg.lengthAxis === 'x' ? sx : axesCfg.lengthAxis === 'y' ? sy : sz) * 0.5;
    const halfW = (axesCfg.widthAxis === 'x' ? sx : axesCfg.widthAxis === 'y' ? sy : sz) * 0.5;

    // Corner Stretch Handles: Manipuladores CAD estilizados tipo esfera con anillo exterior para estiramiento en 2 ejes
    const createCornerHandle = (
      dirL: number,
      dirW: number,
      diagCursor: string
    ) => {
      const mat = this.getSharedGizmoMaterial(0x06b6d4, false); // Cyan técnico CAD
      const mesh = new THREE.Mesh(cornerSphereGeo, mat);
      const cornerPos = new THREE.Vector3();
      cornerPos[axesCfg.lengthAxis] = dirL * halfL;
      cornerPos[axesCfg.widthAxis] = dirW * halfW;
      mesh.position.copy(cornerPos);

      const halo = new THREE.Mesh(cornerHaloGeo, outlineMat);
      halo.rotation.x = Math.PI / 2;
      halo.raycast = () => {};
      mesh.add(halo);

      const hitData: GizmoHitData = {
        isGizmo: true,
        type: 'corner_handle',
        handleTarget: 'corner',
        dir: dirL,
        dirW,
        lengthAxis: axesCfg.lengthAxis,
        widthAxis: axesCfg.widthAxis,
        posAxisL: axesCfg.lengthPosAxis,
        posAxisW: axesCfg.widthPosAxis,
        cursor: diagCursor
      };
      mesh.userData = {
        ...hitData,
        baseLocalPos: cornerPos.clone(),
        colorHex: 0x06b6d4
      };
      this.gizmoHitMeshes.push(mesh);
      return mesh;
    };

    const posLPlus = new THREE.Vector3();
    posLPlus[axesCfg.lengthAxis] = halfL;
    const dirLPlus = new THREE.Vector3();
    dirLPlus[axesCfg.lengthAxis] = 1;

    const posLMinus = new THREE.Vector3();
    posLMinus[axesCfg.lengthAxis] = -halfL;
    const dirLMinus = new THREE.Vector3();
    dirLMinus[axesCfg.lengthAxis] = -1;

    const posWPlus = new THREE.Vector3();
    posWPlus[axesCfg.widthAxis] = halfW;
    const dirWPlus = new THREE.Vector3();
    dirWPlus[axesCfg.widthAxis] = 1;

    const posWMinus = new THREE.Vector3();
    posWMinus[axesCfg.widthAxis] = -halfW;
    const dirWMinus = new THREE.Vector3();
    dirWMinus[axesCfg.widthAxis] = -1;

    const handleLPlus = createStretchHandle(posLPlus, dirLPlus, 0x2563eb, 'length', 1);
    const handleLMinus = createStretchHandle(posLMinus, dirLMinus, 0x2563eb, 'length', -1);
    const handleWPlus = createStretchHandle(posWPlus, dirWPlus, 0xf59e0b, 'width', 1);
    const handleWMinus = createStretchHandle(posWMinus, dirWMinus, 0xf59e0b, 'width', -1);

    const cornerPP = createCornerHandle(1, 1, 'nwse-resize');
    const cornerPM = createCornerHandle(1, -1, 'nesw-resize');
    const cornerMP = createCornerHandle(-1, 1, 'nesw-resize');
    const cornerMM = createCornerHandle(-1, -1, 'nwse-resize');

    group.add(
      handleLPlus,
      handleLMinus,
      handleWPlus,
      handleWMinus,
      cornerPP,
      cornerPM,
      cornerMP,
      cornerMM
    );
    group.renderOrder = 999;
    this.gizmoGroup.add(group);

    // Garantizar que el indicador dinámico de esquinas/aristas esté vinculado al gizmoGroup
    const dynMesh = this.ensureDynamicEdgeHandle();
    if (!this.isDragging) {
      dynMesh.visible = false;
    }

    this.updateAdaptiveGizmoScale();
  }

  /**
   * Detección Matemática Ultra-Ligera (Zero-Allocation) de Esquinas (Vértices) y Aristas Perimetrales
   * sobre la pieza actualmente seleccionada. Permite estirar desde cualquier esquina o tramo continuo de borde
   * incluso en zoom extremo cercano donde los tiradores centrales quedan fuera de pantalla.
   */
  private detectSelectedPartEdgeOrCornerHover(clientX: number, clientY: number): GizmoHitData | null {
    const selParts = this.selectedParts();
    if (selParts.length !== 1) {
      this.hideDynamicEdgeHandle();
      return null;
    }
    const part = selParts[0];
    if (
      this.isPartOrGroupLocked(part) ||
      (this.activeTool() !== 'select' && this.activeTool() !== 'move') ||
      !this.camera ||
      !this.canvasRef()?.nativeElement
    ) {
      this.hideDynamicEdgeHandle();
      return null;
    }

    const canvas = this.canvasRef()!.nativeElement;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    this.mouse.x = (mx / rect.width) * 2 - 1;
    this.mouse.y = -(my / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    this.camera.getWorldDirection(this.scratchCamForward);

    const b = this.getPartBounds(part);
    const axesCfg = this.getPartStretchAxesConfig(part);

    const halfL = (axesCfg.lengthAxis === 'x' ? b.sx : axesCfg.lengthAxis === 'y' ? b.sy : b.sz) * 0.5;
    const halfW = (axesCfg.widthAxis === 'x' ? b.sx : axesCfg.widthAxis === 'y' ? b.sy : b.sz) * 0.5;
    const halfT = (axesCfg.thicknessAxis === 'x' ? b.sx : axesCfg.thicknessAxis === 'y' ? b.sy : b.sz) * 0.5;

    const setWorldPt = (cL: number, cW: number, cT: number, out: THREE.Vector3) => {
      out.set(b.px, b.py, b.pz);
      out[axesCfg.lengthAxis] += cL;
      out[axesCfg.widthAxis] += cW;
      out[axesCfg.thicknessAxis] += cT;
    };

    const nearPlaneDist = this.camera.near + 0.5;
    const projectClippedSegment = (pA: THREE.Vector3, pB: THREE.Vector3): boolean => {
      const dA =
        (pA.x - this.camera.position.x) * this.scratchCamForward.x +
        (pA.y - this.camera.position.y) * this.scratchCamForward.y +
        (pA.z - this.camera.position.z) * this.scratchCamForward.z;
      const dB =
        (pB.x - this.camera.position.x) * this.scratchCamForward.x +
        (pB.y - this.camera.position.y) * this.scratchCamForward.y +
        (pB.z - this.camera.position.z) * this.scratchCamForward.z;

      if (dA < nearPlaneDist && dB < nearPlaneDist) return false;

      this.scratchClippedA.copy(pA);
      this.scratchClippedB.copy(pB);

      if (dA < nearPlaneDist) {
        const t = (nearPlaneDist - dA) / (dB - dA);
        this.scratchClippedA.lerpVectors(pA, pB, t);
      } else if (dB < nearPlaneDist) {
        const t = (nearPlaneDist - dB) / (dA - dB);
        this.scratchClippedB.lerpVectors(pB, pA, t);
      }

      this.scratchScreenA.copy(this.scratchClippedA).project(this.camera);
      this.scratchScreenB.copy(this.scratchClippedB).project(this.camera);

      this.scratchScreenA.x = (this.scratchScreenA.x * 0.5 + 0.5) * rect.width;
      this.scratchScreenA.y = (-this.scratchScreenA.y * 0.5 + 0.5) * rect.height;
      this.scratchScreenB.x = (this.scratchScreenB.x * 0.5 + 0.5) * rect.width;
      this.scratchScreenB.y = (-this.scratchScreenB.y * 0.5 + 0.5) * rect.height;
      return true;
    };

    const distToScreenSegment = (px2d: number, py2d: number): number => {
      const ax = this.scratchScreenA.x;
      const ay = this.scratchScreenA.y;
      const bx = this.scratchScreenB.x;
      const by = this.scratchScreenB.y;
      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 0.0001) {
        return Math.hypot(px2d - ax, py2d - ay);
      }
      const t = Math.max(0, Math.min(1, ((px2d - ax) * dx + (py2d - ay) * dy) / lenSq));
      return Math.hypot(px2d - (ax + t * dx), py2d - (ay + t * dy));
    };

    // 1. Evaluar las 4 Esquinas (Vértices y aristas cortas de espesor en cada esquina)
    const cornerThresholdPx = 20;
    let bestCornerScore = Infinity;
    let bestCornerDirL = 1;
    let bestCornerDirW = 1;
    let foundCorner = false;

    const signs: (-1 | 1)[] = [-1, 1];
    for (const sL of signs) {
      for (const sW of signs) {
        setWorldPt(sL * halfL, sW * halfW, -halfT, this.scratchEdgeA);
        setWorldPt(sL * halfL, sW * halfW, halfT, this.scratchEdgeB);
        if (!projectClippedSegment(this.scratchEdgeA, this.scratchEdgeB)) continue;

        const dPx = distToScreenSegment(mx, my);
        if (dPx <= cornerThresholdPx) {
          this.raycaster.ray.distanceSqToSegment(this.scratchEdgeA, this.scratchEdgeB, undefined, this.scratchClosestWorld);
          const camDist = this.camera.position.distanceTo(this.scratchClosestWorld);
          const score = dPx + camDist * 0.0015;
          if (score < bestCornerScore) {
            bestCornerScore = score;
            bestCornerDirL = sL;
            bestCornerDirW = sW;
            this.scratchBestHitWorld.copy(this.scratchClosestWorld);
            foundCorner = true;
          }
        }
      }
    }

    // 2. Si no está sobre una esquina, evaluar los 8 tramos continuos de aristas perimetrales
    let bestEdgeScore = Infinity;
    let bestEdgeTarget: 'length' | 'width' = 'length';
    let bestEdgeDir: -1 | 1 = 1;
    let bestEdgeCursor = 'ew-resize';
    let foundEdge = false;

    if (!foundCorner) {
      const edgeThresholdPx = 15;

      // 4 aristas de borde +/- Length (recorren a lo largo de Width)
      for (const sL of signs) {
        for (const sT of signs) {
          setWorldPt(sL * halfL, -halfW, sT * halfT, this.scratchEdgeA);
          setWorldPt(sL * halfL, halfW, sT * halfT, this.scratchEdgeB);
          if (!projectClippedSegment(this.scratchEdgeA, this.scratchEdgeB)) continue;

          const dPx = distToScreenSegment(mx, my);
          if (dPx <= edgeThresholdPx) {
            this.raycaster.ray.distanceSqToSegment(this.scratchEdgeA, this.scratchEdgeB, undefined, this.scratchClosestWorld);
            const camDist = this.camera.position.distanceTo(this.scratchClosestWorld);
            const score = dPx + camDist * 0.002;
            if (score < bestEdgeScore) {
              bestEdgeScore = score;
              bestEdgeTarget = 'length';
              bestEdgeDir = sL;
              this.scratchBestHitWorld.copy(this.scratchClosestWorld);
              const edgeDx = Math.abs(this.scratchScreenB.x - this.scratchScreenA.x);
              const edgeDy = Math.abs(this.scratchScreenB.y - this.scratchScreenA.y);
              // El estiramiento es perpendicular a la arista
              bestEdgeCursor = edgeDy >= edgeDx ? 'ew-resize' : 'ns-resize';
              foundEdge = true;
            }
          }
        }
      }

      // 4 aristas de borde +/- Width (recorren a lo largo de Length)
      for (const sW of signs) {
        for (const sT of signs) {
          setWorldPt(-halfL, sW * halfW, sT * halfT, this.scratchEdgeA);
          setWorldPt(halfL, sW * halfW, sT * halfT, this.scratchEdgeB);
          if (!projectClippedSegment(this.scratchEdgeA, this.scratchEdgeB)) continue;

          const dPx = distToScreenSegment(mx, my);
          if (dPx <= edgeThresholdPx) {
            this.raycaster.ray.distanceSqToSegment(this.scratchEdgeA, this.scratchEdgeB, undefined, this.scratchClosestWorld);
            const camDist = this.camera.position.distanceTo(this.scratchClosestWorld);
            const score = dPx + camDist * 0.002;
            if (score < bestEdgeScore) {
              bestEdgeScore = score;
              bestEdgeTarget = 'width';
              bestEdgeDir = sW;
              this.scratchBestHitWorld.copy(this.scratchClosestWorld);
              const edgeDx = Math.abs(this.scratchScreenB.x - this.scratchScreenA.x);
              const edgeDy = Math.abs(this.scratchScreenB.y - this.scratchScreenA.y);
              bestEdgeCursor = edgeDy >= edgeDx ? 'ew-resize' : 'ns-resize';
              foundEdge = true;
            }
          }
        }
      }
    }

    if (!foundCorner && !foundEdge) {
      this.hideDynamicEdgeHandle();
      return null;
    }

    // Verificar que otra pieza no seleccionada no esté ocultando en primer plano este borde/esquina
    const hitDistToCam = this.camera.position.distanceTo(this.scratchBestHitWorld);
    if (this.raycastablePieceMeshes.length > 1) {
      const pieceHits = this.raycaster.intersectObjects(this.raycastablePieceMeshes, false);
      if (pieceHits.length > 0) {
        const frontPart = pieceHits[0].object.userData?.['part'] as Part | undefined;
        if (frontPart && frontPart.id !== part.id && pieceHits[0].distance < hitDistToCam - 25) {
          this.hideDynamicEdgeHandle();
          return null;
        }
      }
    }

    let hitResult: GizmoHitData;
    if (foundCorner) {
      const dynMesh = this.ensureDynamicEdgeHandle(true);
      dynMesh.position.copy(this.scratchBestHitWorld);
      dynMesh.visible = true;
      dynMesh.material = this.getSharedGizmoMaterial(0x06b6d4, true); // Cyan técnico brillante para vértices/esquinas
      dynMesh.userData['isHovered'] = true;
      dynMesh.userData['colorHex'] = 0x06b6d4;

      // Calcular orientación diagonal del cursor respecto al centro de la pieza en pantalla
      this.scratchScreenA.set(b.px, b.py, b.pz).project(this.camera);
      this.scratchScreenB.copy(this.scratchBestHitWorld).project(this.camera);
      const diagX = this.scratchScreenB.x - this.scratchScreenA.x;
      const diagY = -(this.scratchScreenB.y - this.scratchScreenA.y);
      const diagCursor = diagX * diagY >= 0 ? 'nwse-resize' : 'nesw-resize';

      hitResult = {
        isGizmo: true,
        type: 'corner_handle',
        handleTarget: 'corner',
        dir: bestCornerDirL,
        dirW: bestCornerDirW,
        lengthAxis: axesCfg.lengthAxis,
        widthAxis: axesCfg.widthAxis,
        posAxisL: axesCfg.lengthPosAxis,
        posAxisW: axesCfg.widthPosAxis,
        worldHitPos: this.scratchBestHitWorld.clone(),
        cursor: diagCursor
      };
    } else {
      const edgeTargetAxis = bestEdgeTarget === 'length' ? axesCfg.lengthAxis : axesCfg.widthAxis;
      const dynMesh = this.ensureDynamicEdgeHandle(false, edgeTargetAxis);
      dynMesh.position.copy(this.scratchBestHitWorld);
      dynMesh.visible = true;
      const colorHex = bestEdgeTarget === 'length' ? 0x2563eb : 0xf59e0b;
      dynMesh.material = this.getSharedGizmoMaterial(colorHex, true);
      dynMesh.userData['isHovered'] = true;
      dynMesh.userData['colorHex'] = colorHex;
      hitResult = {
        isGizmo: true,
        type: 'handle',
        handleTarget: bestEdgeTarget,
        dir: bestEdgeDir,
        lengthAxis: axesCfg.lengthAxis,
        widthAxis: axesCfg.widthAxis,
        posAxisL: axesCfg.lengthPosAxis,
        posAxisW: axesCfg.widthPosAxis,
        worldHitPos: this.scratchBestHitWorld.clone(),
        cursor: bestEdgeCursor
      };
    }

    this.activeDynamicEdgeHit = hitResult;
    this.updateAdaptiveGizmoScale();
    this.requestRender(4);
    return hitResult;
  }

  /**
   * Zoom Cercano Milimétrico (Zoom Dirigido al Cursor con Target Dolly):
   * Desplaza suavemente controls.target hacia el punto o esquina bajo el cursor al acercar la rueda,
   * eliminando el bloqueo prematuro de minDistance y permitiendo acercamientos a nivel de cantos y vértices.
   * Ejecutado estrictamente fuera de NgZone y sin instanciar vectores en memoria (Zero-Allocation).
   */
  private onCanvasWheel(e: WheelEvent) {
    if (this.isRenderingPaused || !this.controls || !this.controls.enabled || !this.camera) return;
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    this.scratchWheelMouse.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.scratchWheelMouse, this.camera);
    this.camera.getWorldDirection(this.scratchWheelCamForward);

    const camDist = this.camera.position.distanceTo(this.controls.target);

    if (e.deltaY < 0) {
      // Zoom In: dirigir hacia la esquina/arista/pieza bajo el cursor
      let hasHit = false;
      let hitDist = camDist;

      if (this.activeDynamicEdgeHit?.worldHitPos) {
        this.scratchWheelPlaneHit.copy(this.activeDynamicEdgeHit.worldHitPos);
        hitDist = this.camera.position.distanceTo(this.scratchWheelPlaneHit);
        hasHit = true;
      } else if (this.raycastablePieceMeshes.length > 0) {
        const hits = this.raycaster.intersectObjects(this.raycastablePieceMeshes, false);
        if (hits.length > 0) {
          this.scratchWheelPlaneHit.copy(hits[0].point);
          hitDist = hits[0].distance;
          hasHit = true;
        }
      }

      if (!hasHit) {
        const selParts = this.selectedParts();
        if (selParts.length === 1) {
          const b = this.getPartBounds(selParts[0]);
          this.scratchGizmoWorldPos.set(b.px, b.py, b.pz);
          this.scratchWheelPlane.setFromNormalAndCoplanarPoint(this.scratchWheelCamForward, this.scratchGizmoWorldPos);
        } else {
          this.scratchWheelPlane.setFromNormalAndCoplanarPoint(this.scratchWheelCamForward, this.controls.target);
        }
        if (this.raycaster.ray.intersectPlane(this.scratchWheelPlane, this.scratchWheelPlaneHit)) {
          hitDist = this.camera.position.distanceTo(this.scratchWheelPlaneHit);
          hasHit = true;
        }
      }

      if (hasHit) {
        this.scratchWheelDelta.subVectors(this.scratchWheelPlaneHit, this.controls.target);
        const lerpAlpha = camDist < 350 ? 0.26 : 0.14;
        this.controls.target.addScaledVector(this.scratchWheelDelta, lerpAlpha);
        this.camera.position.addScaledVector(this.scratchWheelDelta, lerpAlpha * 0.65);
      }

      // Target Dolly en rango cercano/macro para impedir que controls.target bloquee el avance de la cámara
      if (camDist < 220 || hitDist < 160) {
        const dollyStep = Math.min(Math.max(4, Math.min(camDist, hitDist) * 0.16), 36);
        this.controls.target.addScaledVector(this.raycaster.ray.direction, dollyStep * 0.55);
        if (hitDist > 8) {
          this.camera.position.addScaledVector(this.raycaster.ray.direction, dollyStep * 0.55);
        }
      }
    } else if (e.deltaY > 0) {
      // Zoom Out: asistencia suave al salir de zoom macro cercano (cuando camDist es muy pequeño)
      if (camDist < 240) {
        const backStep = Math.max(14, (240 - camDist) * 0.18);
        this.camera.position.addScaledVector(this.scratchWheelCamForward, -backStep);
      }
    }

    this.updateAdaptiveCameraSpeeds();
    this.updateAdaptiveGizmoScale();
    this.requestRender(10);
  }

  /**
   * Compensación Dinámica O(1) de panSpeed y rotateSpeed según la distancia de cámara al objetivo.
   * Garantiza un desplazamiento lateral/vertical (clic derecho) ágil en zoom macro cercano
   * y controlado en vistas panorámicas lejanas.
   */
  private updateAdaptiveCameraSpeeds() {
    if (!this.camera || !this.controls) return;
    const dist = Math.max(1, this.camera.position.distanceTo(this.controls.target));

    let effectivePanDist: number;
    if (dist < 480) {
      // Zoom cercano / macro: piso mínimo garantizado (280mm efectivos) para paneo fluido a lo largo de cantos y esquinas
      effectivePanDist = 280 + dist * 0.55;
    } else if (dist <= 3200) {
      // Zoom medio de trabajo: seguimiento natural 1:1
      effectivePanDist = 544 + (dist - 480) * 1.0;
    } else {
      // Zoom lejano de habitación: amortiguación progresiva para evitar saltos bruscos
      effectivePanDist = 3264 + (dist - 3200) * 0.55;
    }

    this.controls.panSpeed = effectivePanDist / dist;
    this.controls.rotateSpeed = dist < 240 ? Math.max(0.5, dist / 240) : 1.0;
  }

  /**
   * Escalado Visual Adaptativo O(1) para tiradores de agarre y etiquetas de cota 3D:
   * Mantiene el tamaño aparente en pantalla proporcional a la distancia de la cámara
   * y desliza las etiquetas de medida dentro del encuadre visible durante el zoom extremo cercano.
   */
  private updateAdaptiveGizmoScale() {
    if (!this.camera) return;

    // 1. Escalar tiradores de borde (4 centrales + 1 dinámico de esquina/arista)
    for (const groupChild of this.gizmoGroup.children) {
      if (groupChild instanceof THREE.Mesh) {
        if (groupChild.visible) {
          const dist = this.camera.position.distanceTo(groupChild.position);
          const isHovered = groupChild.userData?.['isHovered'] || this.isDragging;
          const scale = Math.max(0.06, Math.min(1.35, dist / 950)) * (isHovered ? 1.25 : 1.0);
          groupChild.scale.setScalar(scale);
        }
      } else if (groupChild instanceof THREE.Group) {
        for (const handle of groupChild.children) {
          if (handle instanceof THREE.Mesh) {
            handle.getWorldPosition(this.scratchGizmoWorldPos);
            const dist = this.camera.position.distanceTo(this.scratchGizmoWorldPos);
            const isHovered = handle.userData?.['isHovered'] || (this.isDragging && this.activeGizmoHit?.handleTarget === handle.userData?.['handleTarget'] && this.activeGizmoHit?.dir === handle.userData?.['dir']);
            const scale = Math.max(0.06, Math.min(1.4, dist / 950)) * (isHovered ? 1.25 : 1.0);
            handle.scale.setScalar(scale);

            const basePos = handle.userData?.['baseLocalPos'] as THREE.Vector3 | undefined;
            const offsetDir = handle.userData?.['offsetDir'] as THREE.Vector3 | undefined;
            if (basePos && offsetDir) {
              const dynamicOffset = 16 * Math.max(0.15, Math.min(1.2, dist / 950));
              handle.position.copy(basePos).addScaledVector(offsetDir, dynamicOffset);
            }
          }
        }
      }
    }

    // 2. Escalar y mantener visibles las etiquetas de medida (dimensionGroup) en zoom cercano
    for (const dimGroup of this.dimensionGroup.children) {
      for (const child of dimGroup.children) {
        if (child instanceof THREE.Sprite) {
          const u = child.userData;
          if (u?.['edgeP1'] && u?.['edgeP2'] && this.controls) {
            const p1 = u['edgeP1'] as THREE.Vector3;
            const p2 = u['edgeP2'] as THREE.Vector3;
            const midX = (p1.x + p2.x) * 0.5;
            const midY = (p1.y + p2.y) * 0.5;
            const midZ = (p1.z + p2.z) * 0.5;
            const distToMid = this.camera.position.distanceTo(
              this.scratchGizmoWorldPos.set(midX, midY, midZ)
            );

            if (distToMid < 850) {
              this.scratchSegDir.subVectors(p2, p1);
              const segLenSq = this.scratchSegDir.lengthSq();
              if (segLenSq > 1) {
                this.scratchW0.subVectors(this.controls.target, p1);
                const t = Math.max(0.12, Math.min(0.88, this.scratchW0.dot(this.scratchSegDir) / segLenSq));
                const blend = Math.max(0, Math.min(1, (850 - distToMid) / 500));
                const finalT = 0.5 + (t - 0.5) * blend;
                child.position.lerpVectors(p1, p2, finalT);
                if (u['labelOffset']) {
                  const off = u['labelOffset'] as THREE.Vector3;
                  const offScale = Math.max(0.25, Math.min(1.0, distToMid / 900));
                  child.position.addScaledVector(off, offScale);
                }
              }
            } else {
              child.position.set(midX, midY, midZ);
              if (u['labelOffset']) {
                child.position.add(u['labelOffset'] as THREE.Vector3);
              }
            }
          }

          const dist = this.camera.position.distanceTo(child.position);
          const baseX = child.userData?.['baseScaleX'] || 140;
          const baseY = child.userData?.['baseScaleY'] || 38;
          const isHovered = child.userData?.['isHovered'];
          const sDim = Math.max(0.12, Math.min(1.45, dist / 1050)) * (isHovered ? 1.15 : 1.0);
          child.scale.set(baseX * sDim, baseY * sDim, 1);
        }
      }
    }

    // 3. Escalar y mantener legibles las cotas de luz interna (internalClearanceGroup)
    for (const child of this.internalClearanceGroup.children) {
      if (child instanceof THREE.Sprite) {
        const dist = this.camera.position.distanceTo(child.position);
        const baseX = child.userData?.['baseScaleX'] || 140;
        const baseY = child.userData?.['baseScaleY'] || 38;
        const isHovered = child.userData?.['isHovered'];
        const sDim = Math.max(0.12, Math.min(1.45, dist / 1050)) * (isHovered ? 1.15 : 1.0);
        child.scale.set(baseX * sDim, baseY * sDim, 1);
      }
    }
  }

  // --- MAGNETIC SNAP ENGINE (MOTOR DE INFERENCIAS CAD) ---

  // Estructura universal de candidato de imán magnético
  private findMagneticSnapCandidate(
    screenX: number,
    screenY: number,
    thresholdPx = 30
  ): {
    worldPos: THREE.Vector3;
    type: 'corner' | 'midpoint' | 'edge' | 'face';
    objectName: string;
    edgeDir?: THREE.Vector3;
    edgeP1?: THREE.Vector3;
    edgeP2?: THREE.Vector3;
    faceNormal?: THREE.Vector3;
  } | null {
    if (!this.camera || !this.canvasRef()?.nativeElement) return null;
    const canvas = this.canvasRef()!.nativeElement;
    const rect = canvas.getBoundingClientRect();

    const mouse = new THREE.Vector2(
      ((screenX - rect.left) / rect.width) * 2 - 1,
      -((screenY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(mouse, this.camera);
    const rayOrigin = this.raycaster.ray.origin;
    const rayDir = this.raycaster.ray.direction;

    // 1. Recolección universal de aristas (12 segmentos por caja orientada)
    interface SceneEdgeSegment {
      p1: THREE.Vector3;
      p2: THREE.Vector3;
      objectName: string;
    }
    const segments: SceneEdgeSegment[] = [];
    const edgePairs: [number, number][] = [
      [0, 1], [2, 3], [4, 5], [6, 7], // Paralelas a eje local X
      [0, 2], [1, 3], [4, 6], [5, 7], // Paralelas a eje local Y
      [0, 4], [1, 5], [2, 6], [3, 7]  // Paralelas a eje local Z
    ];

    // 1.1. Piezas de melamina, cubiertas y mesones
    const visiblePieces = this.pieceObjects.filter(p => !this.hiddenPartIds().has(p.part.id));
    for (const item of visiblePieces) {
      const mesh = item.mesh;
      if (!mesh || !mesh.geometry) continue;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const min = mesh.geometry.boundingBox!.min;
      const max = mesh.geometry.boundingBox!.max;
      mesh.updateMatrixWorld(true);
      const m = mesh.matrixWorld;

      const corners = [
        new THREE.Vector3(min.x, min.y, min.z).applyMatrix4(m),
        new THREE.Vector3(max.x, min.y, min.z).applyMatrix4(m),
        new THREE.Vector3(min.x, max.y, min.z).applyMatrix4(m),
        new THREE.Vector3(max.x, max.y, min.z).applyMatrix4(m),
        new THREE.Vector3(min.x, min.y, max.z).applyMatrix4(m),
        new THREE.Vector3(max.x, min.y, max.z).applyMatrix4(m),
        new THREE.Vector3(min.x, max.y, max.z).applyMatrix4(m),
        new THREE.Vector3(max.x, max.y, max.z).applyMatrix4(m),
      ];

      for (const [i, j] of edgePairs) {
        segments.push({
          p1: corners[i],
          p2: corners[j],
          objectName: item.part.name
        });
      }
    }

    // 1.2. Electrodomésticos y equipamiento
    if (this.layerVisibility().showAppliances) {
      for (const app of this.appliances()) {
        if (app.isHidden) continue;
        const hW = (app.width || 600) / 2;
        const hH = (app.height || 850) / 2;
        const hD = (app.depth || 600) / 2;
        const cX = app.position?.x ?? 0;
        const cY = (app.position?.y ?? 0) + hH;
        const cZ = app.position?.z ?? 0;
        const rotY = -((app.rotation || 0) * (Math.PI / 180));
        const cosR = Math.cos(rotY);
        const sinR = Math.sin(rotY);

        const getRotPt = (lx: number, ly: number, lz: number) => {
          const rx = lx * cosR - lz * sinR;
          const rz = lx * sinR + lz * cosR;
          return new THREE.Vector3(cX + rx, cY + ly, cZ + rz);
        };
        const appCorners = [
          getRotPt(-hW, -hH, -hD),
          getRotPt( hW, -hH, -hD),
          getRotPt(-hW,  hH, -hD),
          getRotPt( hW,  hH, -hD),
          getRotPt(-hW, -hH,  hD),
          getRotPt( hW, -hH,  hD),
          getRotPt(-hW,  hH,  hD),
          getRotPt( hW,  hH,  hD),
        ];
        for (const [i, j] of edgePairs) {
          segments.push({
            p1: appCorners[i],
            p2: appCorners[j],
            objectName: app.name || 'Electrodoméstico'
          });
        }
      }
    }

    // 1.3. Muros arquitectónicos y suelo
    if (this.workspaceMode() === 'room') {
      const walls = getResolvedRoomWalls(this.roomConfig());
      for (const wall of walls) {
        if (wall.isHidden) continue;
        const hL = wall.length / 2;
        const hH = wall.height / 2;
        const hT = wall.thickness / 2;
        const cX = wall.posX;
        const cY = hH;
        const cZ = wall.posZ;
        const rotY = -((wall.rotationY || 0) * (Math.PI / 180));
        const cosR = Math.cos(rotY);
        const sinR = Math.sin(rotY);

        const getWallPt = (lx: number, ly: number, lz: number) => {
          const rx = lx * cosR - lz * sinR;
          const rz = lx * sinR + lz * cosR;
          return new THREE.Vector3(cX + rx, cY + ly, cZ + rz);
        };
        const wallCorners = [
          getWallPt(-hL, -hH, -hT),
          getWallPt( hL, -hH, -hT),
          getWallPt(-hL,  hH, -hT),
          getWallPt( hL,  hH, -hT),
          getWallPt(-hL, -hH,  hT),
          getWallPt( hL, -hH,  hT),
          getWallPt(-hL,  hH,  hT),
          getWallPt( hL,  hH,  hT),
        ];
        for (const [i, j] of edgePairs) {
          segments.push({
            p1: wallCorners[i],
            p2: wallCorners[j],
            objectName: wall.name || 'Muro'
          });
        }
      }

      // Bordes del piso arquitectónico
      const cfg = this.roomConfig();
      const hFW = (cfg.floorWidth || 5000) / 2;
      const hFD = (cfg.floorDepth || 5000) / 2;
      const floorCorners = [
        new THREE.Vector3(-hFW, 0, -hFD),
        new THREE.Vector3( hFW, 0, -hFD),
        new THREE.Vector3( hFW, 0,  hFD),
        new THREE.Vector3(-hFW, 0,  hFD)
      ];
      segments.push({ p1: floorCorners[0], p2: floorCorners[1], objectName: 'Borde Piso' });
      segments.push({ p1: floorCorners[1], p2: floorCorners[2], objectName: 'Borde Piso' });
      segments.push({ p1: floorCorners[2], p2: floorCorners[3], objectName: 'Borde Piso' });
      segments.push({ p1: floorCorners[3], p2: floorCorners[0], objectName: 'Borde Piso' });
    }

    // 2. Evaluación del punto más cercano sobre aristas continuas
    const tempProj = new THREE.Vector3();
    let bestEdgeCandidate: {
      worldPos: THREE.Vector3;
      type: 'corner' | 'midpoint' | 'edge' | 'face';
      objectName: string;
      edgeDir?: THREE.Vector3;
      edgeP1?: THREE.Vector3;
      edgeP2?: THREE.Vector3;
      faceNormal?: THREE.Vector3;
    } | null = null;
    let minScore = thresholdPx;

    for (const seg of segments) {
      const p1 = seg.p1;
      const p2 = seg.p2;

      // Descarte rápido si ambos extremos están detrás de la cámara
      tempProj.copy(p1).project(this.camera);
      const z1 = tempProj.z;
      tempProj.copy(p2).project(this.camera);
      const z2 = tempProj.z;
      if (z1 > 1 && z2 > 1) continue;

      const v = new THREE.Vector3().subVectors(p2, p1);
      const segLenSq = v.lengthSq();
      if (segLenSq < 1) continue;

      // Algoritmo analítico de distancia mínima Rayo 3D -> Segmento de Arista
      const w0 = new THREE.Vector3().subVectors(p1, rayOrigin);
      const a = 1; // rayDir es normalizado
      const b = rayDir.dot(v);
      const c = segLenSq;
      const d = rayDir.dot(w0);
      const e = v.dot(w0);
      const denom = a * c - b * b;

      let t = 0;
      if (denom > 1e-6) {
        t = (a * e - b * d) / denom;
      }
      t = Math.max(0, Math.min(1, t));

      const segPt = p1.clone().addScaledVector(v, t);
      tempProj.copy(segPt).project(this.camera);
      if (tempProj.z > 1) continue;

      const segScreenX = ((tempProj.x + 1) / 2) * rect.width + rect.left;
      const segScreenY = ((-tempProj.y + 1) / 2) * rect.height + rect.top;
      const screenDist = Math.hypot(segScreenX - screenX, segScreenY - screenY);

      if (screenDist > thresholdPx) continue;

      // Proyección de extremos y punto medio para jerarquía de imán
      tempProj.copy(p1).project(this.camera);
      const d1 = Math.hypot(
        ((tempProj.x + 1) / 2) * rect.width + rect.left - screenX,
        ((-tempProj.y + 1) / 2) * rect.height + rect.top - screenY
      );

      tempProj.copy(p2).project(this.camera);
      const d2 = Math.hypot(
        ((tempProj.x + 1) / 2) * rect.width + rect.left - screenX,
        ((-tempProj.y + 1) / 2) * rect.height + rect.top - screenY
      );

      const midPt = p1.clone().add(p2).multiplyScalar(0.5);
      tempProj.copy(midPt).project(this.camera);
      const dMid = Math.hypot(
        ((tempProj.x + 1) / 2) * rect.width + rect.left - screenX,
        ((-tempProj.y + 1) / 2) * rect.height + rect.top - screenY
      );

      let candType: 'corner' | 'midpoint' | 'edge' = 'edge';
      let candPos = segPt;
      let score = screenDist;

      // Jerarquía: Vértice Esquina (1) > Punto Medio (2) > En la Arista (3)
      if (d1 < 16 || d2 < 16 || t < 0.03 || t > 0.97) {
        candType = 'corner';
        candPos = d1 <= d2 ? p1.clone() : p2.clone();
        score = Math.min(d1, d2) * 0.55;
      } else if (dMid < 14 || Math.abs(t - 0.5) < 0.04) {
        candType = 'midpoint';
        candPos = midPt;
        score = dMid * 0.75;
      } else {
        candType = 'edge';
        candPos = segPt;
        score = screenDist;
      }

      if (score < minScore) {
        minScore = score;
        bestEdgeCandidate = {
          worldPos: candPos,
          type: candType,
          objectName: seg.objectName,
          edgeDir: v.clone().normalize(),
          edgeP1: p1.clone(),
          edgeP2: p2.clone()
        };
      }
    }

    if (bestEdgeCandidate) {
      return bestEdgeCandidate;
    }

    // 3. Fallback en la cara (Superficie 3D cuando el cursor está lejos de las aristas)
    const faceCandidates: THREE.Object3D[] = [
      ...this.raycastablePieceMeshes,
      ...this.appliancesGroup.children,
      ...this.roomGroup.children,
      ...(this.floorMesh ? [this.floorMesh] : [])
    ];
    const intersects = this.raycaster.intersectObjects(faceCandidates, true);
    if (intersects.length > 0) {
      const hit = intersects[0];
      let objName = 'Superficie 3D';
      if (hit.object.userData?.['part']) {
        objName = hit.object.userData['part'].name;
      } else if (hit.object.userData?.['appliance'] || hit.object.userData?.['applianceId']) {
        const resolved = this.resolveApplianceFromObject(hit.object);
        objName = resolved?.app.name || 'Equipo';
      } else if (hit.object.userData?.['isWall']) {
        objName = 'Muro';
      } else if (hit.object.userData?.['isFloor']) {
        objName = 'Piso';
      }

      return {
        worldPos: hit.point.clone(),
        type: 'face',
        objectName: objName,
        faceNormal: hit.face?.normal
      };
    }

    return null;
  }

  // Renders visual magnetic snap indicator differentiated by type (Corner, Midpoint, Edge, Face)
  private updateMagneticSnapIndicator(
    candidate: {
      worldPos: THREE.Vector3;
      type: 'corner' | 'midpoint' | 'edge' | 'face';
      objectName: string;
      edgeDir?: THREE.Vector3;
    } | null
  ) {
    if (!candidate) {
      if (this.magneticSnapGroup.children.length > 0) {
        this.disposeGroup(this.magneticSnapGroup);
        this.lastSnapIndicatorKey = '';
        this.requestRender(4);
      }
      return;
    }

    this.magneticSnapGroup.position.copy(candidate.worldPos);
    const snapKey = `${candidate.type}_${candidate.objectName}`;

    // If the snap badge type and object name haven't changed, simply update orientation & position without recreating CanvasTexture
    if (snapKey === this.lastSnapIndicatorKey && this.magneticSnapGroup.children.length > 0) {
      for (const child of this.magneticSnapGroup.children) {
        if (child instanceof THREE.Mesh) {
          child.quaternion.copy(this.camera.quaternion);
          if (candidate.type === 'midpoint' || candidate.type === 'edge') {
            child.rotateZ(Math.PI / 4);
          }
        }
      }
      this.requestRender(4);
      return;
    }

    this.disposeGroup(this.magneticSnapGroup);
    this.lastSnapIndicatorKey = snapKey;

    let colorHex = 0x10b981; // Green for Corner
    let colorCss = '#10b981';
    let labelPrefix = 'Esquina';

    if (candidate.type === 'midpoint') {
      colorHex = 0x06b6d4; // Cyan for Midpoint
      colorCss = '#06b6d4';
      labelPrefix = 'Punto Medio';
    } else if (candidate.type === 'edge') {
      colorHex = 0xf59e0b; // Amber for On Edge
      colorCss = '#f59e0b';
      labelPrefix = 'En la Arista';
    } else if (candidate.type === 'face') {
      colorHex = 0x3b82f6; // Blue for Face
      colorCss = '#3b82f6';
      labelPrefix = 'En la Cara';
    }

    // 1. Technical Precision Crosshair
    const crossSize = 5.0; // mm
    const crossPoints = [
      new THREE.Vector3(-crossSize, 0, 0), new THREE.Vector3(crossSize, 0, 0),
      new THREE.Vector3(0, -crossSize, 0), new THREE.Vector3(0, crossSize, 0),
      new THREE.Vector3(0, 0, -crossSize), new THREE.Vector3(0, 0, crossSize)
    ];
    const crossGeo = new THREE.BufferGeometry().setFromPoints(crossPoints);
    const crossMat = new THREE.LineBasicMaterial({
      color: colorHex,
      depthTest: false,
      linewidth: 2
    });
    this.magneticSnapGroup.add(new THREE.LineSegments(crossGeo, crossMat));

    // 2. Specialized Geometric Snapping Badge
    if (candidate.type === 'corner') {
      // Circular Ring for Vertices
      const ringGeo = new THREE.RingGeometry(3.5, 5.5, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        depthTest: false,
        transparent: true,
        opacity: 0.95
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.quaternion.copy(this.camera.quaternion);
      this.magneticSnapGroup.add(ring);
    } else if (candidate.type === 'midpoint') {
      // Cyan Diamond for Midpoints
      const diamondGeo = new THREE.PlaneGeometry(6, 6);
      const diamondMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        depthTest: false,
        transparent: true,
        opacity: 0.95
      });
      const diamond = new THREE.Mesh(diamondGeo, diamondMat);
      diamond.quaternion.copy(this.camera.quaternion);
      diamond.rotateZ(Math.PI / 4);
      this.magneticSnapGroup.add(diamond);
    } else if (candidate.type === 'edge') {
      // Amber Solid Diamond/Square attached to the edge wire
      const edgeGeo = new THREE.PlaneGeometry(5, 5);
      const edgeMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        depthTest: false,
        transparent: true,
        opacity: 0.95
      });
      const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
      edgeMesh.quaternion.copy(this.camera.quaternion);
      edgeMesh.rotateZ(Math.PI / 4);
      this.magneticSnapGroup.add(edgeMesh);
    } else {
      // Small Circle for Surface Face
      const faceGeo = new THREE.RingGeometry(2.5, 4.0, 12);
      const faceMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        depthTest: false,
        transparent: true,
        opacity: 0.85
      });
      const faceMesh = new THREE.Mesh(faceGeo, faceMat);
      faceMesh.quaternion.copy(this.camera.quaternion);
      this.magneticSnapGroup.add(faceMesh);
    }

    // 3. Compact Floating Label Sprite
    const labelText = `${labelPrefix} · ${candidate.objectName}`;
    const spriteMat = this.getCachedBadgeMaterial(`snap_label_${colorCss}_${labelText}`, 250, 48, (ctx) => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.beginPath();
      ctx.roundRect(0, 0, 250, 48, 10);
      ctx.fill();
      ctx.strokeStyle = colorCss;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, 125, 24);
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(0, 16, 0);
    sprite.scale.set(62, 14, 1);
    this.magneticSnapGroup.add(sprite);
    this.requestRender(4);
  }

  // Resolves Point B applying orthogonal axis inference, perpendicular edge projection and HUD modes
  private resolveMeasurementPointB(
    candidate: {
      worldPos: THREE.Vector3;
      type: 'corner' | 'midpoint' | 'edge' | 'face';
      objectName: string;
      edgeDir?: THREE.Vector3;
      edgeP1?: THREE.Vector3;
      edgeP2?: THREE.Vector3;
    },
    shiftPressed = false
  ): { x: number; y: number; z: number } {
    const a = this.measurePointA();
    if (!a) {
      return {
        x: Math.round(candidate.worldPos.x),
        y: Math.max(0, Math.round(candidate.worldPos.y)),
        z: Math.round(candidate.worldPos.z)
      };
    }

    const raw = candidate.worldPos;
    const mode = this.measureProjectionMode();

    // 1. Modo Forzado desde el panel HUD (ΔX, ΔY, ΔZ)
    if (mode === 'x') {
      this.activeInferredAxis.set('x');
      return { x: Math.round(raw.x), y: Math.round(a.y), z: Math.round(a.z) };
    }
    if (mode === 'y') {
      this.activeInferredAxis.set('y');
      return { x: Math.round(a.x), y: Math.max(0, Math.round(raw.y)), z: Math.round(a.z) };
    }
    if (mode === 'z') {
      this.activeInferredAxis.set('z');
      return { x: Math.round(a.x), y: Math.round(a.y), z: Math.round(raw.z) };
    }

    // 2. Inferencia interactiva en modo Directo 3D
    const dx = raw.x - a.x;
    const dy = raw.y - a.y;
    const dz = raw.z - a.z;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const absZ = Math.abs(dz);
    const dist = Math.hypot(dx, dy, dz);

    if (dist < 4) {
      this.activeInferredAxis.set(null);
      return { x: Math.round(raw.x), y: Math.max(0, Math.round(raw.y)), z: Math.round(raw.z) };
    }

    // 2.1. Bloqueo de eje ortogonal con tecla Shift presionada
    if (shiftPressed || this.isShiftPressed()) {
      if (absX >= absY && absX >= absZ) {
        this.activeInferredAxis.set('x');
        return { x: Math.round(raw.x), y: Math.round(a.y), z: Math.round(a.z) };
      } else if (absY >= absX && absY >= absZ) {
        this.activeInferredAxis.set('y');
        return { x: Math.round(a.x), y: Math.max(0, Math.round(raw.y)), z: Math.round(a.z) };
      } else {
        this.activeInferredAxis.set('z');
        return { x: Math.round(a.x), y: Math.round(a.y), z: Math.round(raw.z) };
      }
    }

    // 2.2. Inferencia y enganche magnético a ejes principales (umbral angular <= ~23°)
    if (dist > 12) {
      if (absX / dist > 0.92) {
        this.activeInferredAxis.set('x');
        return { x: Math.round(raw.x), y: Math.round(a.y), z: Math.round(a.z) };
      }
      if (absY / dist > 0.92) {
        this.activeInferredAxis.set('y');
        return { x: Math.round(a.x), y: Math.max(0, Math.round(raw.y)), z: Math.round(a.z) };
      }
      if (absZ / dist > 0.92) {
        this.activeInferredAxis.set('z');
        return { x: Math.round(a.x), y: Math.round(a.y), z: Math.round(raw.z) };
      }
    }

    // 2.3. Inferencia Perpendicular Automática entre aristas paralelas (ej. filo mesón a frente cajón)
    if (this.measurePointAEdgeDir && candidate.edgeDir) {
      const dot = Math.abs(this.measurePointAEdgeDir.dot(candidate.edgeDir));
      if (dot > 0.96 && candidate.edgeP1) {
        const uB = candidate.edgeDir;
        const b0 = candidate.edgeP1;
        const tPerp = (new THREE.Vector3(a.x - b0.x, a.y - b0.y, a.z - b0.z)).dot(uB);
        const perpPt = b0.clone().addScaledVector(uB, tPerp);

        const segLen = candidate.edgeP1.distanceTo(candidate.edgeP2 || candidate.edgeP1);
        if (tPerp >= -15 && tPerp <= segLen + 15) {
          this.activeInferredAxis.set(null);
          return {
            x: Math.round(perpPt.x),
            y: Math.max(0, Math.round(perpPt.y)),
            z: Math.round(perpPt.z)
          };
        }
      }
    }

    this.activeInferredAxis.set(null);
    return {
      x: Math.round(raw.x),
      y: Math.max(0, Math.round(raw.y)),
      z: Math.round(raw.z)
    };
  }

  // Permite conmutar la proyección visual de la cota desde el panel flotante
  setMeasureProjectionMode(mode: 'direct' | 'x' | 'y' | 'z') {
    this.measureProjectionMode.set(mode);
    if (this.measurePointA() && this.measurePointB()) {
      this.renderMeasurementVisuals();
    }
  }

  // Start a fresh measurement without resetting tool
  startNewMeasurement() {
    this.isMeasurementPersistent.set(false);
    this.measurePointA.set(null);
    this.measurePointB.set(null);
    this.measurePointAEdgeDir = null;
    this.activeInferredAxis.set(null);
    this.measureProjectionMode.set('direct');
    this.disposeGroup(this.measureGroup);
    this.updateMagneticSnapIndicator(null);
    this.requestRender(6);
  }

  // Render Interactive 3D Measurement Visuals with Fine CAD Arrowheads & Subtle Center Cross
  renderMeasurementVisuals() {
    this.disposeGroup(this.measureGroup);
    this.requestRender(6);

    const a = this.measurePointA();
    const b = this.measurePointB();
    if (!a) return;

    // Helper 1: Technical CAD Crosshair
    const createCadCrosshair = (pt: { x: number; y: number; z: number }, colorHex: number) => {
      const group = new THREE.Group();
      group.position.set(pt.x, pt.y, pt.z);

      const s = 4.0;
      const pts = [
        new THREE.Vector3(-s, 0, 0), new THREE.Vector3(s, 0, 0),
        new THREE.Vector3(0, -s, 0), new THREE.Vector3(0, s, 0),
        new THREE.Vector3(0, 0, -s), new THREE.Vector3(0, 0, s)
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: colorHex, depthTest: false, linewidth: 2 });
      group.add(new THREE.LineSegments(geo, mat));

      const dotGeo = new THREE.SphereGeometry(1.2, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
      group.add(new THREE.Mesh(dotGeo, dotMat));

      return group;
    };

    // Helper 2: Slender CAD Arrowhead Cone
    const createCadArrow = (tipPos: { x: number; y: number; z: number }, dirPointingAtTip: THREE.Vector3, colorHex: number) => {
      const arrowLength = 12; // mm
      const arrowRadius = 2.4; // mm
      const coneGeo = new THREE.ConeGeometry(arrowRadius, arrowLength, 12);
      coneGeo.translate(0, -arrowLength / 2, 0);

      const coneMat = new THREE.MeshBasicMaterial({ color: colorHex, depthTest: false });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);

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

    // Both Point A and Point B are defined
    let targetB = { ...b };
    const mode = this.measureProjectionMode();
    const inferredAxis = this.activeInferredAxis();

    if (mode === 'x') {
      targetB = { x: b.x, y: a.y, z: a.z };
    } else if (mode === 'y') {
      targetB = { x: a.x, y: b.y, z: a.z };
    } else if (mode === 'z') {
      targetB = { x: a.x, y: a.y, z: b.z };
    }

    const vecAB = new THREE.Vector3(targetB.x - a.x, targetB.y - a.y, targetB.z - a.z);
    const totalDist = vecAB.length();

    let lineColor = 0xf59e0b; // Amber default
    let axisLabel: 'x' | 'y' | 'z' | null = null;

    if (mode === 'x' || (mode === 'direct' && inferredAxis === 'x')) {
      lineColor = 0xef4444; // Rojo Eje X
      axisLabel = 'x';
    } else if (mode === 'y' || (mode === 'direct' && inferredAxis === 'y')) {
      lineColor = 0x10b981; // Verde Eje Y
      axisLabel = 'y';
    } else if (mode === 'z' || (mode === 'direct' && inferredAxis === 'z')) {
      lineColor = 0x3b82f6; // Azul Eje Z
      axisLabel = 'z';
    }

    // Direction vectors pointing AT the endpoints
    const dirAtA = totalDist > 0.1
      ? new THREE.Vector3(a.x - targetB.x, a.y - targetB.y, a.z - targetB.z).normalize()
      : new THREE.Vector3(0, 1, 0);
    const dirAtB = dirAtA.clone().negate();

    // Endpoints CAD Arrows
    this.measureGroup.add(createCadArrow(a, dirAtA, lineColor));
    this.measureGroup.add(createCadCrosshair(a, 0x10b981));

    this.measureGroup.add(createCadArrow(targetB, dirAtB, lineColor));
    this.measureGroup.add(createCadCrosshair(targetB, 0x10b981));

    // Direct Measurement Line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a.x, a.y, a.z),
      new THREE.Vector3(targetB.x, targetB.y, targetB.z)
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: lineColor,
      linewidth: 2,
      depthTest: false
    });
    const directLine = new THREE.Line(lineGeo, lineMat);
    this.measureGroup.add(directLine);

    // Subtle orthogonal delta projection lines in direct mode
    if (mode === 'direct' && !axisLabel) {
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
    }

    // Floating Midpoint Distance Badge
    const mid = new THREE.Vector3(
      (a.x + targetB.x) / 2,
      (a.y + targetB.y) / 2 + 18,
      (a.z + targetB.z) / 2
    );
    const distInfo = this.measureDistance();
    if (distInfo) {
      let badgeText = `${distInfo.total} mm`;
      let strokeColor = '#f59e0b';
      let textColor = '#fbbf24';

      if (axisLabel === 'x') {
        badgeText = `X: ${distInfo.dx} mm`;
        strokeColor = '#ef4444';
        textColor = '#fca5a5';
      } else if (axisLabel === 'y') {
        badgeText = `Y: ${distInfo.dy} mm`;
        strokeColor = '#10b981';
        textColor = '#6ee7b7';
      } else if (axisLabel === 'z') {
        badgeText = `Z: ${distInfo.dz} mm`;
        strokeColor = '#3b82f6';
        textColor = '#93c5fd';
      }

      const spriteMat = this.getCachedBadgeMaterial(`measure_${strokeColor}_${badgeText}`, 200, 48, (ctx) => {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.beginPath();
        ctx.roundRect(0, 0, 200, 48, 10);
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, 100, 24);
      });
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

      // 2. Update technical edge outline color using pooled material
      const edgeMat = this.getSharedEdgeMaterial(isColliding, isSelected);
      for (const child of item.mesh.children) {
        if (child instanceof THREE.LineSegments) {
          child.material = edgeMat;
        }
      }

      if (isSelected) {
        const t = part.thickness || 15;
        const L = part.length;
        const W = part.width;
        let sx = L; let sy = t; let sz = W;
        if (part.orientation === 'vertical_yz') {
          const isBacksplash = part.componentRole === 'backsplash' ||
                                part.name.toUpperCase().includes('SALPICADERO');
          const isPlinth = !isBacksplash && (part.componentRole === 'plinth' ||
                                part.name.toUpperCase().includes('ZOCALO') ||
                                part.name.toUpperCase().includes('ZÓCALO'));
          const isCabinetSide = !isBacksplash && !isPlinth && (part.componentRole === 'side_left' || 
                                part.componentRole === 'side_right' ||
                                (part.name.toUpperCase().includes('LATERAL') && 
                                 !part.name.toUpperCase().includes('CAJ') && 
                                 part.componentRole !== 'drawer_box' && 
                                 part.componentRole !== 'drawer_lateral'));
          const isDrawerLateral = !isBacksplash && !isCabinetSide && (
            part.componentRole === 'drawer_box' ||
            part.componentRole === 'drawer_lateral' ||
            (part.name.toUpperCase().includes('LATERAL') && (part.name.toUpperCase().includes('CAJ') || (!!part.groupId && this.partGroups().some(g => g.id === part.groupId && g.type === 'drawer'))))
          );
          if (isBacksplash) {
            sx = t; sy = Math.min(L, W); sz = Math.max(L, W);
          } else if (isDrawerLateral || (isPlinth && L > W)) {
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
          } else if (part.componentRole === 'door') {
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

    // Refresh CAD Gizmo & Dimension overlays only (properly disposing GPU resources)
    this.disposeGroup(this.dimensionGroup);
    this.disposeGroup(this.gizmoGroup);
    this.gizmoHitMeshes = [];

    if (selectedDataList.length === 1) {
      const s = selectedDataList[0];
      if (this.show3dDimensions()) {
        this.renderPieceDimensions(s.part, s.px, s.py, s.pz, s.sx, s.sy, s.sz);
      }
      const clr = this.computeClearanceInfo(s.part, this.parts());
      this.clearanceCalculated.emit(clr);

      if (this.showClearances()) {
        if (s.part.groupId && (this.isInternalShelf(s.part) || this.isInternalDivider(s.part))) {
          this.renderModuleInternalClearances(s.part.groupId, s.part);
        } else {
          this.disposeGroup(this.internalClearanceGroup);
          this.renderClearanceDimensions(s.part, this.parts());
        }
      } else {
        this.disposeGroup(this.internalClearanceGroup);
      }
      if (this.activeTool() === 'move' || this.activeTool() === 'select') {
        this.buildGizmo(s.part, s.px, s.py, s.pz, s.sx, s.sy, s.sz);
      }
    } else if (selectedDataList.length > 1) {
      const groupIds = Array.from(new Set(selectedDataList.map(s => s.part.groupId).filter(Boolean))) as string[];
      if (groupIds.length === 1 && this.showClearances()) {
        this.renderModuleInternalClearances(groupIds[0]);
      } else {
        this.disposeGroup(this.internalClearanceGroup);
      }
      this.clearanceCalculated.emit(null);
    } else {
      this.disposeGroup(this.internalClearanceGroup);
      this.clearanceCalculated.emit(null);
    }
    this.requestRender(8);
  }

  private getDrawerFacing(part: Part, parts: Part[]): 'front' | 'right' | 'back' | 'left' {
    // 1. Gather all parts that belong to the SAME drawer assembly:
    let drawerParts: Part[] = [];
    if (part.groupId && this.partGroups().some(g => g.id === part.groupId && g.type === 'drawer')) {
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
    if (
      handleType === 'none' ||
      handleType === 'push' ||
      handleType === 'push_open' ||
      handleType === 'finger_pull' ||
      handleType === 'gola_less'
    ) {
      return group;
    }

    const effectiveFinish: HandleFinish =
      hw.handleFinish || (handleType === 'bar_black' ? 'black' : 'brushed_steel');
    const hexColor = this.hardwareCatalog.getFinishHexColor(effectiveFinish);
    const metalness = effectiveFinish === 'black' ? 0.35 : 0.88;
    const roughness = effectiveFinish === 'black' ? 0.4 : 0.2;

    const handleMat = this.getSharedMaterial(
      `hw_handle_${effectiveFinish}`,
      () => new THREE.MeshStandardMaterial({
        color: hexColor,
        metalness,
        roughness
      })
    );
    const standoffMat = handleMat;

    const isSideFacing = drawerFacing === 'right' || drawerFacing === 'left';

    if (handleType === 'bar_modern' || handleType === 'bar_black') {
      const len = hw.handleLength || (handleType === 'bar_black' ? 192 : 160);
      const isBarBlack = handleType === 'bar_black';
      const barMesh = isBarBlack
        ? new THREE.Mesh(new THREE.BoxGeometry(10, len, 12), handleMat)
        : new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, len, 18), handleMat);

      const standoff1 = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 25, 14), standoffMat);
      standoff1.rotation.x = Math.PI / 2;
      standoff1.position.set(0, len / 2 - 18, -12);

      const standoff2 = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 25, 14), standoffMat);
      standoff2.rotation.x = Math.PI / 2;
      standoff2.position.set(0, -len / 2 + 18, -12);

      group.add(barMesh, standoff1, standoff2);
    } else if (handleType === 'knob_round') {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 18, 16), standoffMat);
      stem.rotation.x = Math.PI / 2;
      stem.position.set(0, 0, -9);

      const head = new THREE.Mesh(new THREE.CylinderGeometry(15, 13, 10, 24), handleMat);
      head.rotation.x = Math.PI / 2;
      head.position.set(0, 0, 4);

      group.add(stem, head);
    } else if (handleType === 'knob_square') {
      const stem = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 18), standoffMat);
      stem.position.set(0, 0, -9);

      const head = new THREE.Mesh(new THREE.BoxGeometry(24, 24, 9), handleMat);
      head.position.set(0, 0, 4);

      group.add(stem, head);

    } else if (handleType === 'cup_vintage') {
      const cupBack = new THREE.Mesh(new THREE.BoxGeometry(96, 36, 4), handleMat);
      cupBack.position.set(0, 0, -10);
      const cupHood = new THREE.Mesh(
        new THREE.CylinderGeometry(16, 16, 68, 20, 1, false, 0, Math.PI),
        handleMat
      );
      cupHood.rotation.z = Math.PI / 2;
      cupHood.position.set(0, 0, -8);
      group.add(cupBack, cupHood);
    }

    // Posicionar tirador en puerta o cajón según las 4 direcciones cardinales
    if (isDoor) {
      const margin = 45;
      const isVerticalBar = handleType === 'bar_modern' || handleType === 'bar_black';
      group.rotation.set(0, 0, 0);
      if (hingeSide === 'left') {
        group.position.set(sx / 2 - margin, 0, sz / 2 + 15);
      } else if (hingeSide === 'right') {
        group.position.set(-sx / 2 + margin, 0, sz / 2 + 15);
      } else if (hingeSide === 'top') {
        if (isVerticalBar) group.rotation.z = Math.PI / 2;
        group.position.set(0, -sy / 2 + margin, sz / 2 + 15);
      } else {
        if (isVerticalBar) group.rotation.z = Math.PI / 2;
        group.position.set(0, sy / 2 - margin, sz / 2 + 15);
      }
    } else {
      // Tirador de Cajón en coordenadas locales del frente según las 4 orientaciones cardinales
      const isVerticalBar = handleType === 'bar_modern' || handleType === 'bar_black';
      const barRoll = isVerticalBar ? Math.PI / 2 : 0;
      if (drawerFacing === 'right') {
        group.position.set(sx / 2 + 15, 0, 0);
        group.rotation.set(0, Math.PI / 2, barRoll, 'YXZ');
      } else if (drawerFacing === 'left') {
        group.position.set(-sx / 2 - 15, 0, 0);
        group.rotation.set(0, -Math.PI / 2, barRoll, 'YXZ');
      } else if (drawerFacing === 'back') {
        group.position.set(0, 0, -sz / 2 - 15);
        group.rotation.set(0, Math.PI, barRoll, 'YXZ');
      } else {
        group.position.set(0, 0, sz / 2 + 15);
        group.rotation.set(0, 0, barRoll, 'YXZ');
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
    hingeSide: 'left' | 'right' | 'top' | 'bottom',
    doorFacing: 'front' | 'right' | 'back' | 'left' = 'front'
  ): THREE.Group {
    const group = new THREE.Group();
    if (hw.hingeType === 'none') return group;

    const doorW = sx;
    const doorT = sz;

    const hingeMat = this.getSharedMaterial(
      'hw_hinge_steel',
      () => new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.85,
        roughness: 0.25
      })
    );
    const pistonRodMat = this.getSharedMaterial(
      'hw_piston_rod',
      () => new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 })
    );

    const isGasPiston = hw.hingeType === 'gas_piston' || hingeSide === 'top';
    if (isGasPiston) {
      const cylGeo = this.getSharedGeometry('hw_piston_cyl', () => new THREE.CylinderGeometry(7, 7, 120, 16));
      const rodGeo = this.getSharedGeometry('hw_piston_rod', () => new THREE.CylinderGeometry(4, 4, 100, 14));
      const pistonOffsets = [-doorW / 2 + 35, doorW / 2 - 35];
      for (const ox of pistonOffsets) {
        const piston = new THREE.Group();
        const cylinder = new THREE.Mesh(cylGeo, hingeMat);
        const rod = new THREE.Mesh(rodGeo, pistonRodMat);
        rod.position.y = -60;
        piston.add(cylinder);
        piston.add(rod);
        piston.position.set(ox, 0, -doorT / 2 - 25);
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

      const cupGeo = this.getSharedGeometry('hw_hinge_cup', () => new THREE.CylinderGeometry(17.5, 17.5, 12, 20));
      const armGeo = this.getSharedGeometry('hw_hinge_arm', () => new THREE.BoxGeometry(18, 14, 45));
      const hingeX = hingeSide === 'left' ? -doorW / 2 + 22.5 : doorW / 2 - 22.5;
      for (const hy of hingeYPositions) {
        const singleHinge = new THREE.Group();
        const cup = new THREE.Mesh(cupGeo, hingeMat);
        cup.rotation.x = Math.PI / 2;
        cup.position.set(0, 0, -doorT / 2 + 6);
        singleHinge.add(cup);

        const arm = new THREE.Mesh(armGeo, hingeMat);
        const armOffsetX = hingeSide === 'left' ? -12 : 12;
        arm.position.set(armOffsetX, 0, -doorT / 2 - 16);
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
  /**
   * Obtiene la longitud nominal comercial exacta de las correderas o caja de cajón
   * evitando que sobresalgan por detrás del mueble al girar el módulo.
   */
  private getDrawerNominalSlideLength(
    part: Part,
    hw: PartHardwareConfig,
    drawerFacing: 'front' | 'right' | 'back' | 'left' = 'front'
  ): number {
    const standardLengths = [250, 300, 350, 400, 450, 500, 550, 600];

    // 1. Configuración explícita en el herraje
    if (hw.slideLength && hw.slideLength >= 200) {
      return hw.slideLength;
    }

    // 2. Definición en el grupo de cajón
    if (part.groupId) {
      const grp = this.partGroups().find(g => g.id === part.groupId);
      if (grp?.slideLength && grp.slideLength >= 200) {
        return grp.slideLength;
      }
    }

    const allParts = this.parts();

    // 3. A partir de los paneles laterales de la caja del cajón
    const isDrawerLateral = (p: Part) =>
      p.id !== part.id &&
      p.componentRole !== 'side_left' &&
      p.componentRole !== 'side_right' &&
      (p.componentRole === 'drawer_box' ||
       p.componentRole === 'drawer_lateral' ||
       (p.name.toUpperCase().includes('LATERAL') && p.name.toUpperCase().includes('CAJ')));

    let latPart: Part | undefined;
    if (part.groupId) {
      latPart = allParts.find(p => p.groupId === part.groupId && isDrawerLateral(p) && Math.abs((p.posY || 0) - (part.posY || 0)) < 150);
      if (!latPart) {
        latPart = allParts.find(p => p.groupId === part.groupId && isDrawerLateral(p));
      }
    }
    if (!latPart) {
      const prefix = part.id.includes('_frente') ? part.id.split('_frente')[0] : (part.id.includes('_front') ? part.id.split('_front')[0] : '');
      if (prefix) {
        latPart = allParts.find(p => p.id.startsWith(prefix) && isDrawerLateral(p));
      }
    }
    if (!latPart) {
      latPart = allParts.find(p =>
        isDrawerLateral(p) && Math.abs((p.posY || 0) - (part.posY || 0)) < 150
      );
    }

    if (latPart) {
      const latDepth = Math.max(latPart.length || 0, latPart.width || 0);
      if (latDepth >= 200) {
        const matched = standardLengths.filter(l => l <= latDepth).pop();
        return matched || latDepth;
      }
    }

    // 4. Calcular según la profundidad real del casco/módulo (nunca part.width del frente)
    const isFacingX = drawerFacing === 'right' || drawerFacing === 'left';
    const contextParts = part.moduleId 
      ? allParts.filter(p => p.moduleId === part.moduleId)
      : (part.groupId ? allParts.filter(p => p.groupId === part.groupId) : allParts);

    let carcassDepth = 500;
    const sides = contextParts.filter(p => 
      p.componentRole === 'side_left' || p.componentRole === 'side_right' ||
      (p.name.toUpperCase().includes('LATERAL') && !p.name.toUpperCase().includes('CAJ'))
    );
    if (sides.length > 0) {
      const sideBounds = this.joineryEngine.getPartBounds(sides[0]);
      carcassDepth = isFacingX ? sideBounds.sx : sideBounds.sz;
    } else {
      let minVal = Infinity, maxVal = -Infinity;
      for (const p of contextParts) {
        const b = this.joineryEngine.getPartBounds(p);
        if (isFacingX) {
          if (b.minX < minVal) minVal = b.minX;
          if (b.maxX > maxVal) maxVal = b.maxX;
        } else {
          if (b.minZ < minVal) minVal = b.minZ;
          if (b.maxZ > maxVal) maxVal = b.maxZ;
        }
      }
      if (Number.isFinite(minVal) && Number.isFinite(maxVal) && maxVal > minVal) {
        carcassDepth = maxVal - minVal;
      }
    }

    const availableDepth = Math.max(200, carcassDepth - 35);
    return standardLengths.filter(l => l <= availableDepth).pop() || 350;
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
    const boxDepth = this.getDrawerNominalSlideLength(part, part.hardwareConfig || {}, drawerFacing);
    const boxHeight = Math.max(80, Math.min(Math.floor(frontHeight * 0.72), 220));

    // Standard clearances: 12.7mm (1/2") telescopic slide per side + 18mm carcass side panels
    const carcassSideT = 18;
    const clearance = 12.7;
    const boxOuterWidth = Math.max(120, frontWidth - (2 * carcassSideT) - (2 * clearance));
    const boxInnerWidth = Math.max(80, boxOuterWidth - (2 * t));

    const boxMat = this.getSharedMaterial(
      'hw_drawer_box',
      () => new THREE.MeshStandardMaterial({
        color: 0xf8fafc, // Clean melamine interior
        roughness: 0.65,
        metalness: 0.05
      })
    );

    const bottomMat = this.getSharedMaterial(
      'hw_drawer_bottom',
      () => new THREE.MeshStandardMaterial({
        color: 0xe2e8f0, // MDF bottom board
        roughness: 0.7,
        metalness: 0.02
      })
    );

    const edgeLineMat = this.getSharedMaterial(
      'hw_drawer_edge',
      () => new THREE.LineBasicMaterial({
        color: 0x94a3b8,
        linewidth: 1
      })
    );

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
    const nominalLength = this.getDrawerNominalSlideLength(part, hw, drawerFacing);

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

    const slideSteelMat = this.getSharedMaterial(
      'hw_slide_steel',
      () => new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.88,
        roughness: 0.22
      })
    );

    const ballBearingMat = this.getSharedMaterial(
      'hw_slide_bearing',
      () => new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.95,
        roughness: 0.1
      })
    );

    const damperMat = this.getSharedMaterial(
      'hw_slide_damper',
      () => new THREE.MeshStandardMaterial({
        color: 0x0284c7, // Hydraulic blue damper
        metalness: 0.5,
        roughness: 0.3
      })
    );

    const clipMat = this.getSharedMaterial(
      'hw_slide_clip',
      () => new THREE.MeshStandardMaterial({
        color: 0xea580c, // Undermount front quick-release orange clip
        roughness: 0.35
      })
    );

    const holeGeo = this.getSharedGeometry('hw_slide_hole_geo', () => new THREE.CylinderGeometry(2.2, 2.2, 5, 12));
    const holeMat = this.getSharedMaterial('hw_slide_hole_mat', () => new THREE.MeshBasicMaterial({ color: 0x1e293b }));
    const pistonGeo = this.getSharedGeometry('hw_slide_piston_geo', () => new THREE.CylinderGeometry(3.2, 3.2, 50, 12));
    const triggerGeo = this.getSharedGeometry('hw_slide_trigger_geo', () => new THREE.BoxGeometry(5, 10, 16));

    const createSingleSlideAssembly = (isLeft: boolean): THREE.Group => {
      const slideAssembly = new THREE.Group();

      if (slideType === 'undermount') {
        // --- CORREDERA OCULTA BAJO CAJÓN (TANDEM) ---
        const mainTrack = new THREE.Mesh(
          this.getSharedGeometry(`hw_slide_um_${railHeight}_${nominalLength}`, () => new THREE.BoxGeometry(18, railHeight, nominalLength)),
          slideSteelMat
        );
        mainTrack.position.set(0, 0, -nominalLength / 2);
        slideAssembly.add(mainTrack);

        // Front 3D quick-release locking catch
        const frontClip = new THREE.Mesh(
          this.getSharedGeometry('hw_slide_um_clip', () => new THREE.BoxGeometry(22, 14, 25)),
          clipMat
        );
        frontClip.position.set(0, -railHeight / 2 + 7, -12.5);
        slideAssembly.add(frontClip);

        // Synchronizer pinion / rear damper
        const rearDamper = new THREE.Mesh(
          this.getSharedGeometry('hw_slide_um_damper', () => new THREE.BoxGeometry(14, 12, 45)),
          damperMat
        );
        rearDamper.position.set(0, 0, -nominalLength + 25);
        slideAssembly.add(rearDamper);
      } else {
        // --- CORREDERA TELESCÓPICA (45mm, SOFT-CLOSE O 35mm) ---
        // 1. Carcase Outer Member (Stationary C-profile against internal side wall)
        const outerProfile = new THREE.Mesh(
          this.getSharedGeometry(`hw_slide_outer_${railHeight}_${nominalLength}`, () => new THREE.BoxGeometry(4.5, railHeight, nominalLength)),
          slideSteelMat
        );
        outerProfile.position.set(isLeft ? -3.5 : 3.5, 0, -nominalLength / 2);
        slideAssembly.add(outerProfile);

        // 2. Intermediate Ball-Bearing Carriage
        const intermediateProfile = new THREE.Mesh(
          this.getSharedGeometry(`hw_slide_mid_${railHeight}_${nominalLength}`, () => new THREE.BoxGeometry(3.5, railHeight * 0.72, nominalLength * 0.9)),
          ballBearingMat
        );
        intermediateProfile.position.set(0, 0, -nominalLength / 2 + 10);
        slideAssembly.add(intermediateProfile);

        // 3. Inner Drawer Member (Attached to drawer box)
        const innerProfile = new THREE.Mesh(
          this.getSharedGeometry(`hw_slide_inner_${railHeight}_${nominalLength}`, () => new THREE.BoxGeometry(4.0, railHeight * 0.55, nominalLength * 0.85)),
          slideSteelMat
        );
        innerProfile.position.set(isLeft ? 3.5 : -3.5, 0, -nominalLength / 2 + 15);
        slideAssembly.add(innerProfile);

        // System 32 stamped mounting hole visual dots on rail
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
          const piston = new THREE.Mesh(pistonGeo, damperMat);
          piston.rotation.x = Math.PI / 2;
          piston.position.set(isLeft ? -1 : 1, -railHeight * 0.2, -nominalLength + 35);
          slideAssembly.add(piston);

          const triggerCatch = new THREE.Mesh(triggerGeo, damperMat);
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

    const isDrawerLateral = (p: Part) =>
      p.id !== part.id &&
      p.componentRole !== 'side_left' &&
      p.componentRole !== 'side_right' &&
      (p.componentRole === 'drawer_box' ||
       p.componentRole === 'drawer_lateral' ||
       (p.name.toUpperCase().includes('LATERAL') && p.name.toUpperCase().includes('CAJ')));

    if (part.groupId) {
      drawerLatIzq = allParts.find(p => p.groupId === part.groupId && isDrawerLateral(p) && (p.id.includes('lat_izq') || p.name.toUpperCase().includes('IZQ')) && Math.abs((p.posY || 0) - (part.posY || 0)) < 150);
      if (!drawerLatIzq) {
        drawerLatIzq = allParts.find(p => p.groupId === part.groupId && isDrawerLateral(p) && (p.id.includes('lat_izq') || p.name.toUpperCase().includes('IZQ')));
      }
      drawerLatDer = allParts.find(p => p.groupId === part.groupId && isDrawerLateral(p) && (p.id.includes('lat_der') || p.name.toUpperCase().includes('DER')) && Math.abs((p.posY || 0) - (part.posY || 0)) < 150);
      if (!drawerLatDer) {
        drawerLatDer = allParts.find(p => p.groupId === part.groupId && isDrawerLateral(p) && (p.id.includes('lat_der') || p.name.toUpperCase().includes('DER')));
      }
    }

    if (!drawerLatIzq || !drawerLatDer) {
      const prefix = part.id.includes('_frente') ? part.id.split('_frente')[0] : (part.id.includes('_front') ? part.id.split('_front')[0] : '');
      if (prefix) {
        if (!drawerLatIzq) drawerLatIzq = allParts.find(p => p.id.startsWith(prefix) && isDrawerLateral(p) && (p.id.includes('lat_izq') || p.name.toUpperCase().includes('IZQ')));
        if (!drawerLatDer) drawerLatDer = allParts.find(p => p.id.startsWith(prefix) && isDrawerLateral(p) && (p.id.includes('lat_der') || p.name.toUpperCase().includes('DER')));
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
        
        // Guard against matching exterior carcass walls: drawer box laterals must be inside front span
        const maxExpectedSpan = (sx / 2) + 36;
        if (Math.abs(minX - px) <= maxExpectedSpan && Math.abs(maxX - px) <= maxExpectedSpan) {
          leftX = (minX - (t1 / 2) - px) - (railThickness / 2);
          rightX = (maxX + (t2 / 2) - px) + (railThickness / 2);
        } else {
          const boxHalfWidth = Math.max(50, (sx / 2) - 13);
          leftX = -boxHalfWidth - (railThickness / 2);
          rightX = boxHalfWidth + (railThickness / 2);
        }
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
        // Guard against matching exterior carcass walls: drawer box laterals must be inside front span
        const maxExpectedSpan = (sz / 2) + 36;
        if (Math.abs(minZ - pz) <= maxExpectedSpan && Math.abs(maxZ - pz) <= maxExpectedSpan) {
          leftZ = (minZ - (t1 / 2) - pz) - (railThickness / 2);
          rightZ = (maxZ + (t2 / 2) - pz) + (railThickness / 2);
        } else {
          const boxHalfWidth = Math.max(50, (sz / 2) - 13);
          leftZ = -boxHalfWidth - (railThickness / 2);
          rightZ = boxHalfWidth + (railThickness / 2);
        }
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
    const ringMat = this.getSharedMaterial(
      'drill_ring_mat',
      () => new THREE.MeshBasicMaterial({
        color: 0x0f172a,
        side: THREE.DoubleSide,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
      })
    );

    for (const hole of holes) {
      if (this.hiddenPartIds().has(hole.partId)) continue;
      const targetPieceItem = this.pieceObjectMap.get(hole.partId);
      if (!targetPieceItem) continue;

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

      // 3D Drill Bore Cylinder (Pooled Geometry + Pooled Material)
      const cylGeo = this.getSharedGeometry(
        `drill_cyl_${cylRadius}_${cylHeight}`,
        () => new THREE.CylinderGeometry(cylRadius, cylRadius, cylHeight, 16)
      );
      const cylMat = this.getSharedMaterial(
        `drill_mat_${color}`,
        () => new THREE.MeshStandardMaterial({
          color,
          roughness: 0.25,
          metalness: 0.35,
          emissive: color,
          emissiveIntensity: 0.35,
          depthTest: true
        })
      );
      const cylMesh = new THREE.Mesh(cylGeo, cylMat);

      // Orient cylinder based on normalAxis
      if (hole.normalAxis === 'x') {
        cylMesh.rotation.z = Math.PI / 2;
      } else if (hole.normalAxis === 'z') {
        cylMesh.rotation.x = Math.PI / 2;
      }
      holeGroup.add(cylMesh);

      // Technical entry ring for high-precision CAD look (Pooled Geometry)
      const ringGeo = this.getSharedGeometry(
        `drill_ring_${cylRadius}`,
        () => new THREE.RingGeometry(cylRadius * 0.75, cylRadius * 1.15, 20)
      );
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      if (hole.normalAxis === 'x') {
        ringMesh.rotation.y = Math.PI / 2;
      } else if (hole.normalAxis === 'y') {
        ringMesh.rotation.x = Math.PI / 2;
      }
      holeGroup.add(ringMesh);

      cylMesh.userData = { isDrillHole: true, part: targetPieceItem.part, parentPartId: hole.partId };
      ringMesh.userData = { isDrillHole: true, part: targetPieceItem.part, parentPartId: hole.partId };

      // Anclar todos los mecanizados (cazoletas, tornillos, tarugos, correderas Sistema 32)
      // directamente al mesh de su pieza para que roten, se trasladen y se animen solidariamente con ella
      const localPos = new THREE.Vector3(
        hole.posX - targetPieceItem.originalPos.x,
        hole.posY - targetPieceItem.originalPos.y,
        hole.posZ - targetPieceItem.originalPos.z
      );
      const hasMeshRot =
        Math.abs(targetPieceItem.mesh.rotation.x) > 1e-4 ||
        Math.abs(targetPieceItem.mesh.rotation.y) > 1e-4 ||
        Math.abs(targetPieceItem.mesh.rotation.z) > 1e-4;
      if (hasMeshRot) {
        const invQuat = targetPieceItem.mesh.quaternion.clone().invert();
        localPos.applyQuaternion(invQuat);
        holeGroup.quaternion.premultiply(invQuat);
      }
      holeGroup.position.copy(localPos);
      targetPieceItem.mesh.add(holeGroup);
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
      return this.getSharedMaterial(
        'piece_colliding',
        () => new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0x991b1b,
          emissiveIntensity: 0.55,
          transparent: true,
          opacity: 0.85,
          roughness: 0.25,
          metalness: 0.15
        })
      );
    }

    if (isSelected) {
      return this.getSharedMaterial(
        'piece_selected',
        () => new THREE.MeshStandardMaterial({
          color: 0x3b82f6,
          emissive: 0x1d4ed8,
          emissiveIntensity: 0.22,
          roughness: 0.38,
          metalness: 0.08
        })
      );
    }

    // Material color resolution
    const assignedMat = mats.find(m => m.id === part.materialId);
    let colorHex = assignedMat?.colorHex || part.colorHex || '#b48a60';
    const isBackOrDrawerBottom = !this.isCountertopPartOrGroup(part) &&
      (part.componentRole === 'back' ||
        part.thickness <= 4 ||
        ((part.name.toLowerCase().includes('fondo') || part.name.toLowerCase().includes('trasera')) &&
          !part.name.toLowerCase().includes('salpicadero') &&
          part.componentRole !== 'countertop' &&
          part.componentRole !== 'backsplash'));
    if (isBackOrDrawerBottom && !assignedMat?.colorHex) {
      colorHex = '#e5e5e5';
    }

    if (xRay) {
      return this.getSharedMaterial(
        `piece_xray_${colorHex}`,
        () => new THREE.MeshStandardMaterial({
          color: new THREE.Color(colorHex),
          transparent: true,
          opacity: 0.35,
          roughness: 0.4
        })
      );
    }

    const texType = assignedMat?.textureType || 'solid';
    const grain = part.grain || 'length';
    const isLowSpec = this.isPerformanceMode();
    const cacheKey = `piece_std_${colorHex}_${texType}_${grain}_${isLowSpec ? 'low' : 'hi'}`;
    return this.getSharedMaterial(
      cacheKey,
      () => {
        let textureMap: THREE.CanvasTexture | null = null;
        if (typeof document !== 'undefined' && texType !== 'solid') {
          textureMap = ProceduralTextureFactory.getBoardTexture(
            colorHex,
            texType,
            grain,
            isLowSpec
          );
        }
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color(colorHex),
          map: textureMap,
          roughness: texType === 'wood' ? 0.65 : (texType === 'stone' ? 0.25 : (texType === 'gloss' ? 0.08 : 0.4)),
          metalness: texType === 'stone' ? 0.1 : (texType === 'gloss' ? 0.15 : 0.05)
        });
      }
    );
  }

  private textureCache = new Map<string, THREE.CanvasTexture>();

  private getProceduralTexture(
    colorHex: string,
    type: 'wood' | 'linen' | 'gloss' | 'stone' | 'wpc' | 'subtle' = 'wood',
    grain: 'length' | 'width' | 'none' = 'length'
  ): THREE.CanvasTexture {
    return ProceduralTextureFactory.getBoardTexture(colorHex, type, grain, this.isPerformanceMode());
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
    let lineMat = this.materialCache.get('dim_line_mat_blue') as THREE.LineBasicMaterial | undefined;
    if (!lineMat) {
      lineMat = new THREE.LineBasicMaterial({ color: 0x2563eb, linewidth: 2 });
      lineMat.userData = { isShared: true };
      this.materialCache.set('dim_line_mat_blue', lineMat);
    }

    const offsetY = sy / 2 + 35;
    const offsetZ = sz / 2 + 25;

    // Horizontal dimension line along X (or vertical along Y for vertical_yz pieces)
    const isVertYZ = part.orientation === 'vertical_yz';
    const p1 = isVertYZ
      ? new THREE.Vector3(px + sx / 2 + 24, py - sy / 2, pz + sz / 2 + 20)
      : new THREE.Vector3(px - sx / 2, py + offsetY, pz + offsetZ);
    const p2 = isVertYZ
      ? new THREE.Vector3(px + sx / 2 + 24, py + sy / 2, pz + sz / 2 + 20)
      : new THREE.Vector3(px + sx / 2, py + offsetY, pz + offsetZ);

    const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const line = new THREE.Line(lineGeo, lineMat);
    dimGroup.add(line);

    const tickH = 15;
    const t1 = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        isVertYZ
          ? [new THREE.Vector3(p1.x, p1.y, p1.z - tickH), new THREE.Vector3(p1.x, p1.y, p1.z + tickH)]
          : [new THREE.Vector3(p1.x, p1.y - tickH, p1.z), new THREE.Vector3(p1.x, p1.y + tickH, p1.z)]
      ),
      lineMat
    );
    const t2 = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        isVertYZ
          ? [new THREE.Vector3(p2.x, p2.y, p2.z - tickH), new THREE.Vector3(p2.x, p2.y, p2.z + tickH)]
          : [new THREE.Vector3(p2.x, p2.y - tickH, p2.z), new THREE.Vector3(p2.x, p2.y + tickH, p2.z)]
      ),
      lineMat
    );
    dimGroup.add(t1);
    dimGroup.add(t2);

    const lengthLabelOffset = isVertYZ ? new THREE.Vector3(18, 0, 18) : new THREE.Vector3(0, 25, 0);
    const lengthSprite = this.createTextSprite(`${part.length} mm`);
    lengthSprite.position.set(
      (p1.x + p2.x) / 2 + lengthLabelOffset.x,
      (p1.y + p2.y) / 2 + lengthLabelOffset.y,
      (p1.z + p2.z) / 2 + lengthLabelOffset.z
    );
    const lengthUserData: DimensionBadgeUserData = {
      isDimensionBadge: true,
      badgeType: 'length',
      part,
      currentValue: part.length,
      label: this.i18n.t('optimizer.lengthLabel'),
      baseScaleX: 140,
      baseScaleY: 38
    };
    lengthSprite.userData = {
      ...lengthSprite.userData,
      ...lengthUserData,
      edgeP1: p1,
      edgeP2: p2,
      labelOffset: lengthLabelOffset
    };
    this.editableDimensionSprites.push(lengthSprite);
    dimGroup.add(lengthSprite);

    // Width / Depth dimension line
    const p3 = new THREE.Vector3(px + sx / 2 + 30, py, pz - sz / 2);
    const p4 = new THREE.Vector3(px + sx / 2 + 30, py, pz + sz / 2);
    const widthLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([p3, p4]),
      lineMat
    );
    dimGroup.add(widthLine);

    const widthLabelOffset = new THREE.Vector3(15, 20, 0);
    const widthSprite = this.createTextSprite(`${part.width} mm`);
    widthSprite.position.set(px + sx / 2 + 45, py + 20, (p3.z + p4.z) / 2);
    const widthUserData: DimensionBadgeUserData = {
      isDimensionBadge: true,
      badgeType: 'width',
      part,
      currentValue: part.width,
      label: this.i18n.t('inspector.width'),
      baseScaleX: 140,
      baseScaleY: 38
    };
    widthSprite.userData = {
      ...widthSprite.userData,
      ...widthUserData,
      edgeP1: p3,
      edgeP2: p4,
      labelOffset: widthLabelOffset
    };
    this.editableDimensionSprites.push(widthSprite);
    dimGroup.add(widthSprite);

    this.dimensionGroup.add(dimGroup);
    this.updateAdaptiveGizmoScale();
  }

  /**
   * Renderizado Nitidez Retina (High-DPI Canvas Texture) para etiquetas de cota 3D:
   * Diseño Enterprise de Alto Contraste (#0f172a / 92% opacidad) con borde nítido,
   * tipografía protagonista e indicador sutil de edición directa.
   */
  private drawEnterprisePillBadge(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    text: string,
    borderColor: string,
    isHovered = false,
    showEditIndicator = true
  ) {
    const x = 6;
    const y = 6;
    const w = width - 12;
    const h = height - 12;
    const r = 24;

    const baseBorderColor = isHovered
      ? (borderColor === '#10b981' ? '#34d399' : '#60a5fa')
      : borderColor;

    // Fondo gris pizarra oscuro enterprise de alto contraste (#0f172a, 92-98% opacidad)
    ctx.save();
    ctx.fillStyle = isHovered ? 'rgba(15, 23, 42, 0.98)' : 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = baseBorderColor;
    ctx.lineWidth = isHovered ? 6 : 5; // 2.5px aparente en escala retina
    if (isHovered) {
      ctx.shadowColor = baseBorderColor;
      ctx.shadowBlur = 10;
    }

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Número grande protagonista en negrita con sombra suave
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textCenterX = showEditIndicator ? width / 2 - 14 : width / 2;
    ctx.fillText(text, textCenterX, height / 2 + 1);
    ctx.restore();

    // Indicador sutil de cota clicable/editable (mini icono vector de edición)
    if (showEditIndicator) {
      ctx.save();
      ctx.strokeStyle = baseBorderColor;
      ctx.fillStyle = baseBorderColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const px = width - 52;
      const py = height / 2 - 8;
      ctx.beginPath();
      ctx.moveTo(px, py + 12);
      ctx.lineTo(px + 12, py);
      ctx.lineTo(px + 16, py + 4);
      ctx.lineTo(px + 4, py + 16);
      ctx.closePath();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(px, py + 12);
      ctx.lineTo(px - 3, py + 18);
      ctx.lineTo(px + 4, py + 16);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Generates 3D billboard sprite with high-res text (cached in badgeSpriteCache LRU to avoid allocations and leaks)
  private createTextSprite(text: string): THREE.Sprite {
    const idleMat = this.getCachedBadgeMaterial(`dim_sprite_hd_${text}_idle`, 512, 136, (ctx) => {
      this.drawEnterprisePillBadge(ctx, 512, 136, text, '#3b82f6', false, true);
    });
    const hoverMat = this.getCachedBadgeMaterial(`dim_sprite_hd_${text}_hover`, 512, 136, (ctx) => {
      this.drawEnterprisePillBadge(ctx, 512, 136, text, '#3b82f6', true, true);
    });

    const sprite = new THREE.Sprite(idleMat);
    sprite.scale.set(140, 38, 1);
    sprite.renderOrder = 1000;
    sprite.userData = {
      idleMaterial: idleMat,
      hoverMaterial: hoverMat
    };
    return sprite;
  }

  private getCachedBadgeMaterial(
    cacheKey: string,
    width: number,
    height: number,
    drawFn: (ctx: CanvasRenderingContext2D) => void
  ): THREE.SpriteMaterial {
    const existing = this.badgeSpriteCache.get(cacheKey);
    if (existing) {
      this.badgeSpriteCache.delete(cacheKey);
      this.badgeSpriteCache.set(cacheKey, existing);
      return existing.material;
    }

    if (this.badgeSpriteCache.size >= 256) {
      const oldestKey = this.badgeSpriteCache.keys().next().value;
      if (oldestKey) {
        const item = this.badgeSpriteCache.get(oldestKey);
        item?.texture.dispose();
        item?.material.dispose();
        this.badgeSpriteCache.delete(oldestKey);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawFn(ctx);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    texture.userData = { isShared: true };
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    mat.userData = { isShared: true };
    this.badgeSpriteCache.set(cacheKey, { texture, material: mat });
    return mat;
  }

  // Generates Emerald Green 3D billboard sprite for Clearance Dimensions (Luz Libre)
  private createClearanceSprite(text: string, isEditable = true): THREE.Sprite {
    const idleMat = this.getCachedBadgeMaterial(`clearance_hd_${text}_idle_${isEditable ? 'e' : 'r'}`, 512, 136, (ctx) => {
      this.drawEnterprisePillBadge(ctx, 512, 136, text, '#10b981', false, isEditable);
    });
    const hoverMat = isEditable
      ? this.getCachedBadgeMaterial(`clearance_hd_${text}_hover`, 512, 136, (ctx) => {
          this.drawEnterprisePillBadge(ctx, 512, 136, text, '#10b981', true, true);
        })
      : idleMat;

    const sprite = new THREE.Sprite(idleMat);
    sprite.scale.set(140, 38, 1);
    sprite.renderOrder = 1000;
    sprite.userData = {
      idleMaterial: idleMat,
      hoverMaterial: hoverMat
    };
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

  isInternalShelf(part: Part): boolean {
    return this.partGeometry.isInternalShelf(part);
  }

  isInternalDivider(part: Part): boolean {
    return this.partGeometry.isInternalDivider(part);
  }

  getShelfVerticalLimits(part: Part): {
    minAllowedY: number;
    maxAllowedY: number;
    belowTopY: number;
    aboveBottomY: number;
    centerSnapY: number;
  } {
    const minGap = 40; // mm espacio libre mínimo para evitar colisión
    const initBounds = this.getPartBounds(part);
    const halfThick = initBounds.sy / 2;

    const groupParts = part.groupId
      ? this.parts().filter(p => p.groupId === part.groupId && p.id !== part.id)
      : this.parts().filter(p => p.id !== part.id);

    let belowTopY = -Infinity;
    let aboveBottomY = Infinity;

    for (const o of groupParts) {
      const oBounds = this.getPartBounds(o);
      const overlapX = Math.max(0, Math.min(initBounds.maxX, oBounds.maxX) - Math.max(initBounds.minX, oBounds.minX));
      const overlapZ = Math.max(0, Math.min(initBounds.maxZ, oBounds.maxZ) - Math.max(initBounds.minZ, oBounds.minZ));

      if (overlapX > 15 && overlapZ > 15) {
        if (oBounds.minY >= initBounds.maxY - 1 && oBounds.minY < aboveBottomY) {
          aboveBottomY = oBounds.minY;
        }
        if (oBounds.maxY <= initBounds.minY + 1 && oBounds.maxY > belowTopY) {
          belowTopY = oBounds.maxY;
        }
      }
    }

    if (aboveBottomY === Infinity) {
      const topPart = groupParts.find(p => p.componentRole === 'top' || p.componentRole === 'tie');
      if (topPart) {
        aboveBottomY = this.getPartBounds(topPart).minY;
      } else {
        const sides = groupParts.filter(p => p.orientation === 'vertical_yz');
        if (sides.length > 0) {
          aboveBottomY = Math.max(...sides.map(s => this.getPartBounds(s).maxY));
        } else {
          aboveBottomY = (part.posY ?? 0) + 1200;
        }
      }
    }

    if (belowTopY === -Infinity) {
      const bottomPart = groupParts.find(p => p.componentRole === 'bottom');
      if (bottomPart) {
        belowTopY = this.getPartBounds(bottomPart).maxY;
      } else {
        belowTopY = 0;
      }
    }

    let minAllowedY = belowTopY + minGap + halfThick;
    let maxAllowedY = aboveBottomY - minGap - halfThick;

    if (minAllowedY > maxAllowedY) {
      const tightMid = (belowTopY + aboveBottomY) / 2;
      minAllowedY = tightMid - 5;
      maxAllowedY = tightMid + 5;
    }

    const centerSnapY = Math.round((belowTopY + aboveBottomY) / 2);

    return {
      minAllowedY: Math.round(minAllowedY),
      maxAllowedY: Math.round(maxAllowedY),
      belowTopY: Math.round(belowTopY),
      aboveBottomY: Math.round(aboveBottomY),
      centerSnapY
    };
  }

  getDividerHorizontalLimits(part: Part): {
    minAllowedX: number;
    maxAllowedX: number;
    leftMaxX: number;
    rightMinX: number;
    centerSnapX: number;
  } {
    const minGap = 40;
    const initBounds = this.getPartBounds(part);
    const halfThickX = initBounds.sx / 2;

    const groupParts = this.parts().filter(p => p.groupId === part.groupId && p.id !== part.id);

    let leftMaxX = -Infinity;
    let rightMinX = Infinity;

    for (const o of groupParts) {
      const oBounds = this.getPartBounds(o);
      const overlapY = Math.max(0, Math.min(initBounds.maxY, oBounds.maxY) - Math.max(initBounds.minY, oBounds.minY));
      const overlapZ = Math.max(0, Math.min(initBounds.maxZ, oBounds.maxZ) - Math.max(initBounds.minZ, oBounds.minZ));

      if (overlapY > 15 && overlapZ > 15) {
        if (oBounds.maxX <= initBounds.minX + 1 && oBounds.maxX > leftMaxX) {
          leftMaxX = oBounds.maxX;
        }
        if (oBounds.minX >= initBounds.maxX - 1 && oBounds.minX < rightMinX) {
          rightMinX = oBounds.minX;
        }
      }
    }

    if (leftMaxX === -Infinity) {
      const sLeft = groupParts.find(p => p.componentRole === 'side_left');
      leftMaxX = sLeft ? this.getPartBounds(sLeft).maxX : (part.posX ?? 0) - 500;
    }
    if (rightMinX === Infinity) {
      const sRight = groupParts.find(p => p.componentRole === 'side_right');
      rightMinX = sRight ? this.getPartBounds(sRight).minX : (part.posX ?? 0) + 500;
    }

    let minAllowedX = leftMaxX + minGap + halfThickX;
    let maxAllowedX = rightMinX - minGap - halfThickX;

    if (minAllowedX > maxAllowedX) {
      const tightMid = (leftMaxX + rightMinX) / 2;
      minAllowedX = tightMid - 5;
      maxAllowedX = tightMid + 5;
    }

    const centerSnapX = Math.round((leftMaxX + rightMinX) / 2);

    return {
      minAllowedX: Math.round(minAllowedX),
      maxAllowedX: Math.round(maxAllowedX),
      leftMaxX: Math.round(leftMaxX),
      rightMinX: Math.round(rightMinX),
      centerSnapX
    };
  }

  private createInternalClearanceBadge(text: string, isWide = false, isEditable = true): THREE.Sprite {
    const w = 512;
    const h = 136;
    const idleMat = this.getCachedBadgeMaterial(`internal_clr_hd_${text}_idle_${isEditable ? 'e' : 'r'}`, w, h, (ctx) => {
      this.drawEnterprisePillBadge(ctx, w, h, text, '#10b981', false, isEditable);
    });
    const hoverMat = isEditable
      ? this.getCachedBadgeMaterial(`internal_clr_hd_${text}_hover`, w, h, (ctx) => {
          this.drawEnterprisePillBadge(ctx, w, h, text, '#10b981', true, true);
        })
      : idleMat;

    const sprite = new THREE.Sprite(idleMat);
    sprite.scale.set(isWide ? 155 : 140, 38, 1);
    sprite.renderOrder = 1000;
    sprite.userData = {
      idleMaterial: idleMat,
      hoverMaterial: hoverMat
    };
    return sprite;
  }

  renderModuleInternalClearances(
    groupId: string,
    selectedOrDraggingPart?: Part,
    overridePosY?: number
  ) {
    this.disposeGroup(this.internalClearanceGroup);
    if (!this.showClearances()) return;

    const moduleParts = this.parts().filter(
      p => p.groupId === groupId && !this.hiddenPartIds().has(p.id)
    );
    if (moduleParts.length < 2) return;

    // 1. Piso / Base Inferior (excluyendo repisas internas)
    const bottomPart =
      moduleParts.find(p => p.componentRole === 'bottom') ||
      moduleParts
        .filter(p => p.orientation === 'horizontal' && !this.isInternalShelf(p) && p.componentRole !== 'top' && p.componentRole !== 'countertop')
        .sort((a, b) => (a.posY ?? 0) - (b.posY ?? 0))[0];
    const floorTopY = bottomPart ? this.getPartBounds(bottomPart).maxY : 0;

    // 2. Techo / Tapa Superior (excluyendo repisas internas y zócalos)
    const topPart =
      moduleParts.find(p => p.componentRole === 'top') ||
      moduleParts
        .filter(p => p.orientation === 'horizontal' && !this.isInternalShelf(p) && p.componentRole !== 'bottom' && p.componentRole !== 'plinth')
        .sort((a, b) => (b.posY ?? 0) - (a.posY ?? 0))[0];
    let roofBottomY = topPart && topPart.id !== bottomPart?.id ? this.getPartBounds(topPart).minY : Infinity;
    if (roofBottomY === Infinity) {
      const ties = moduleParts.filter(p => p.componentRole === 'tie');
      if (ties.length > 0) {
        roofBottomY = Math.min(...ties.map(t => this.getPartBounds(t).minY));
      } else {
        const sides = moduleParts.filter(p => p.orientation === 'vertical_yz');
        if (sides.length > 0) {
          roofBottomY = Math.max(...sides.map(s => this.getPartBounds(s).maxY));
        }
      }
    }

    // 3. Laterales Izquierdo y Derecho
    const sides = moduleParts.filter(p => p.orientation === 'vertical_yz');
    let leftInnerX: number | null = null;
    let rightInnerX: number | null = null;
    if (sides.length >= 2) {
      const sortedSides = [...sides].sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));
      leftInnerX = this.getPartBounds(sortedSides[0]).maxX;
      rightInnerX = this.getPartBounds(sortedSides[sortedSides.length - 1]).minX;
    } else {
      const sLeft = moduleParts.find(p => p.componentRole === 'side_left');
      const sRight = moduleParts.find(p => p.componentRole === 'side_right');
      if (sLeft) leftInnerX = this.getPartBounds(sLeft).maxX;
      if (sRight) rightInnerX = this.getPartBounds(sRight).minX;
    }

    // 4. Repisas / Entrepaños Interiores
    const allShelves = moduleParts.filter(p => {
      if (bottomPart && p.id === bottomPart.id) return false;
      if (topPart && p.id === topPart.id) return false;
      return this.isInternalShelf(p);
    });

    // 5. Agrupación por columnas (bahías)
    const columns: Array<{
      refX: number;
      frontZ: number;
      shelfBoundsList: Array<{ part: Part; bounds: PartWorldAABB }>;
    }> = [];

    const isDraggingOrSelectedShelf = selectedOrDraggingPart && this.isInternalShelf(selectedOrDraggingPart);

    if (isDraggingOrSelectedShelf) {
      const activeRefBounds = this.getPartBounds(selectedOrDraggingPart);
      const columnShelves = allShelves.filter(s => {
        const b = this.getPartBounds(s);
        const overlapX = Math.max(0, Math.min(activeRefBounds.maxX, b.maxX) - Math.max(activeRefBounds.minX, b.minX));
        return overlapX > 15;
      });
      const sList = columnShelves.map(s => {
        if (s.id === selectedOrDraggingPart.id && overridePosY !== undefined) {
          return {
            part: s,
            bounds: this.getPartBounds(s, {
              x: s.posX ?? 0,
              y: overridePosY,
              z: s.posZ ?? 0
            })
          };
        }
        return { part: s, bounds: this.getPartBounds(s) };
      });
      sList.sort((a, b) => a.bounds.minY - b.bounds.minY);
      const refX = sList.length > 0 ? sList[0].bounds.px : (selectedOrDraggingPart.posX ?? 0);
      const frontZ = sList.length > 0 ? Math.max(...sList.map(s => s.bounds.maxZ)) : (selectedOrDraggingPart.posZ ?? 0);
      columns.push({ refX, frontZ, shelfBoundsList: sList });
    } else {
      const remainingShelves = [...allShelves];
      while (remainingShelves.length > 0) {
        const first = remainingShelves.shift()!;
        const firstBounds = this.getPartBounds(first);
        const colList = [first];
        for (let i = remainingShelves.length - 1; i >= 0; i--) {
          const cand = remainingShelves[i];
          const candBounds = this.getPartBounds(cand);
          const overlapX = Math.max(0, Math.min(firstBounds.maxX, candBounds.maxX) - Math.max(firstBounds.minX, candBounds.minX));
          if (overlapX > 15) {
            colList.push(cand);
            remainingShelves.splice(i, 1);
          }
        }
        const sList = colList.map(s => ({ part: s, bounds: this.getPartBounds(s) }));
        sList.sort((a, b) => a.bounds.minY - b.bounds.minY);
        const refX = sList[0].bounds.px;
        const frontZ = Math.max(...sList.map(s => s.bounds.maxZ));
        columns.push({ refX, frontZ, shelfBoundsList: sList });
      }

      if (columns.length === 0) {
        let refX = 0;
        let frontZ = 0;
        if (leftInnerX !== null && rightInnerX !== null) {
          refX = (leftInnerX + rightInnerX) / 2;
          frontZ = Math.max(...moduleParts.map(p => this.getPartBounds(p).maxZ));
        } else {
          refX = bottomPart?.posX ?? 0;
          frontZ = Math.max(...moduleParts.map(p => this.getPartBounds(p).maxZ));
        }
        columns.push({ refX, frontZ, shelfBoundsList: [] });
      }
    }

    const maxModuleZ = Math.max(...moduleParts.map(p => this.getPartBounds(p).maxZ));

    // 6. Dibujo 3D de Cotas Verticales Limpias con Anti-Solapamiento y Sprites HD
    for (const col of columns) {
      const bayWidth = col.shelfBoundsList.length > 0
        ? col.shelfBoundsList[0].bounds.sx
        : (leftInnerX !== null && rightInnerX !== null ? Math.abs(rightInnerX - leftInnerX) : 400);
      const lateralOffset = Math.max(35, Math.min(110, bayWidth * 0.20));
      const refX = col.refX + lateralOffset;
      const refZ = Math.max(col.frontZ, maxModuleZ) + 26;
      const shelfBoundsList = col.shelfBoundsList;

      interface VerticalBay {
        yBottom: number;
        yTop: number;
        distance: number;
        targetPart: Part | null;
        badgeType: 'top_clearance' | 'bottom_clearance';
        label: string;
      }
      const bays: VerticalBay[] = [];

      if (shelfBoundsList.length === 0) {
        if (roofBottomY !== Infinity && roofBottomY > floorTopY) {
          bays.push({
            yBottom: floorTopY,
            yTop: roofBottomY,
            distance: Math.round(roofBottomY - floorTopY),
            targetPart: null,
            badgeType: 'bottom_clearance',
            label: this.i18n.t('designer.freeClearance')
          });
        }
      } else {
        const shelf0 = shelfBoundsList[0].part;
        bays.push({
          yBottom: floorTopY,
          yTop: shelfBoundsList[0].bounds.minY,
          distance: Math.round(shelfBoundsList[0].bounds.minY - floorTopY),
          targetPart: shelf0,
          badgeType: 'bottom_clearance',
          label: this.i18n.t('designer.lowerClearance')
        });

        for (let i = 0; i < shelfBoundsList.length - 1; i++) {
          const yB = shelfBoundsList[i].bounds.maxY;
          const yT = shelfBoundsList[i + 1].bounds.minY;
          const lowerShelf = shelfBoundsList[i].part;
          const upperShelf = shelfBoundsList[i + 1].part;

          let targetPart = upperShelf;
          let badgeType: 'top_clearance' | 'bottom_clearance' = 'bottom_clearance';
          let label = this.i18n.t('designer.lowerClearance');

          if (selectedOrDraggingPart && selectedOrDraggingPart.id === lowerShelf.id) {
            targetPart = lowerShelf;
            badgeType = 'top_clearance';
            label = this.i18n.t('designer.upperClearance');
          }

          bays.push({
            yBottom: yB,
            yTop: yT,
            distance: Math.round(yT - yB),
            targetPart,
            badgeType,
            label
          });
        }

        if (roofBottomY !== Infinity && roofBottomY > shelfBoundsList[shelfBoundsList.length - 1].bounds.maxY) {
          const lastShelf = shelfBoundsList[shelfBoundsList.length - 1].part;
          const lastY = shelfBoundsList[shelfBoundsList.length - 1].bounds.maxY;
          bays.push({
            yBottom: lastY,
            yTop: roofBottomY,
            distance: Math.round(roofBottomY - lastY),
            targetPart: lastShelf,
            badgeType: 'top_clearance',
            label: this.i18n.t('designer.upperClearance')
          });
        }
      }

      for (const bay of bays) {
        if (bay.distance < 10) continue;

        const p1 = new THREE.Vector3(refX, bay.yBottom, refZ);
        const p2 = new THREE.Vector3(refX, bay.yTop, refZ);
        const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const dashedLine = new THREE.Line(geo, this.internalClearanceLineMat);
        dashedLine.computeLineDistances();
        this.internalClearanceGroup.add(dashedLine);

        const tickW = 16;
        const arrowH = 8;
        const arrowW = 6;

        // LineSegments con pares de vértices limpios (sin diagonales espurias)
        const tBotPts = [
          new THREE.Vector3(refX - tickW, bay.yBottom, refZ),
          new THREE.Vector3(refX + tickW, bay.yBottom, refZ),
          new THREE.Vector3(refX - arrowW, bay.yBottom + arrowH, refZ),
          new THREE.Vector3(refX, bay.yBottom, refZ),
          new THREE.Vector3(refX + arrowW, bay.yBottom + arrowH, refZ),
          new THREE.Vector3(refX, bay.yBottom, refZ)
        ];
        const tBot = new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(tBotPts),
          this.internalClearanceTickMat
        );

        const tTopPts = [
          new THREE.Vector3(refX - tickW, bay.yTop, refZ),
          new THREE.Vector3(refX + tickW, bay.yTop, refZ),
          new THREE.Vector3(refX - arrowW, bay.yTop - arrowH, refZ),
          new THREE.Vector3(refX, bay.yTop, refZ),
          new THREE.Vector3(refX + arrowW, bay.yTop - arrowH, refZ),
          new THREE.Vector3(refX, bay.yTop, refZ)
        ];
        const tTop = new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(tTopPts),
          this.internalClearanceTickMat
        );
        this.internalClearanceGroup.add(tBot, tTop);

        const sprite = this.createInternalClearanceBadge(`↕ ${bay.distance} mm`, false, true);
        const midY = (bay.yBottom + bay.yTop) / 2;
        sprite.position.set(refX, midY, refZ + 12);
        if (bay.targetPart) {
          const badgeUserData: DimensionBadgeUserData = {
            isDimensionBadge: true,
            badgeType: bay.badgeType,
            part: bay.targetPart,
            currentValue: bay.distance,
            label: bay.label,
            referenceY: bay.badgeType === 'bottom_clearance' ? bay.yBottom : bay.yTop,
            baseScaleX: 140,
            baseScaleY: 38
          };
          sprite.userData = {
            ...sprite.userData,
            ...badgeUserData
          };
          this.editableDimensionSprites.push(sprite);
        }
        this.internalClearanceGroup.add(sprite);
      }
    }

    // 7. Cota Horizontal de Luz Interna (Ancho Útil) Limpia
    if (leftInnerX !== null && rightInnerX !== null) {
      const innerWidth = Math.round(rightInnerX - leftInnerX);
      if (innerWidth > 40) {
        const maxZ = Math.max(...moduleParts.map(p => this.getPartBounds(p).maxZ));
        const refZ = maxZ + 26;
        const yLine = floorTopY + 28;
        const pLeft = new THREE.Vector3(leftInnerX, yLine, refZ);
        const pRight = new THREE.Vector3(rightInnerX, yLine, refZ);
        const horizGeo = new THREE.BufferGeometry().setFromPoints([pLeft, pRight]);
        const horizLine = new THREE.Line(horizGeo, this.internalClearanceLineMat);
        horizLine.computeLineDistances();
        this.internalClearanceGroup.add(horizLine);

        const tickH = 14;
        const arrowW = 6;
        const arrowH = 8;
        const tLPts = [
          new THREE.Vector3(leftInnerX, yLine - tickH, refZ),
          new THREE.Vector3(leftInnerX, yLine + tickH, refZ),
          new THREE.Vector3(leftInnerX + arrowH, yLine - arrowW, refZ),
          new THREE.Vector3(leftInnerX, yLine, refZ),
          new THREE.Vector3(leftInnerX + arrowH, yLine + arrowW, refZ),
          new THREE.Vector3(leftInnerX, yLine, refZ)
        ];
        const tL = new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(tLPts),
          this.internalClearanceTickMat
        );

        const tRPts = [
          new THREE.Vector3(rightInnerX, yLine - tickH, refZ),
          new THREE.Vector3(rightInnerX, yLine + tickH, refZ),
          new THREE.Vector3(rightInnerX - arrowH, yLine - arrowW, refZ),
          new THREE.Vector3(rightInnerX, yLine, refZ),
          new THREE.Vector3(rightInnerX - arrowH, yLine + arrowW, refZ),
          new THREE.Vector3(rightInnerX, yLine, refZ)
        ];
        const tR = new THREE.LineSegments(
          new THREE.BufferGeometry().setFromPoints(tRPts),
          this.internalClearanceTickMat
        );
        this.internalClearanceGroup.add(tL, tR);

        const midX = (leftInnerX + rightInnerX) / 2;
        const horizBadge = this.createInternalClearanceBadge(`↔ ${innerWidth} mm`, true, false);
        horizBadge.position.set(midX, yLine + 22, refZ + 12);
        this.internalClearanceGroup.add(horizBadge);
      }
    }

    // 8. Sincronizar clearanceInfo al inspector si hay una pieza seleccionada y no se está arrastrando en vivo
    if (selectedOrDraggingPart && overridePosY === undefined) {
      const clr = this.computeClearanceInfo(selectedOrDraggingPart, this.parts());
      this.clearanceCalculated.emit(clr);
    }
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
    const lateralOffset = Math.max(30, Math.min(100, selBounds.sx * 0.20));

    // Render Vertical Top Clearance Line
    if (clr.topClearance !== null && clr.topClearance > 5) {
      const topY = selBounds.maxY + clr.topClearance;
      const midY = (selBounds.maxY + topY) / 2;
      const x = selBounds.px + lateralOffset;
      const z = selBounds.pz + selBounds.sz / 2 + 28;

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

      const sprite = this.createClearanceSprite(`↕ ${clr.topClearance} mm`);
      sprite.position.set(x, midY, z + 12);
      const badgeData: DimensionBadgeUserData = {
        isDimensionBadge: true,
        badgeType: 'top_clearance',
        part,
        currentValue: clr.topClearance,
        label: this.i18n.t('designer.upperClearance'),
        referenceY: topY,
        baseScaleX: 140,
        baseScaleY: 38
      };
      sprite.userData = {
        ...sprite.userData,
        ...badgeData
      };
      this.editableDimensionSprites.push(sprite);
      this.dimensionGroup.add(sprite);
    }

    // Render Vertical Bottom Clearance Line
    if (clr.bottomClearance !== null && clr.bottomClearance > 5) {
      const botY = selBounds.minY - clr.bottomClearance;
      const midY = (selBounds.minY + botY) / 2;
      const x = selBounds.px + lateralOffset;
      const z = selBounds.pz + selBounds.sz / 2 + 28;

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

      const sprite = this.createClearanceSprite(`↕ ${clr.bottomClearance} mm`);
      sprite.position.set(x, midY, z + 12);
      const badgeData: DimensionBadgeUserData = {
        isDimensionBadge: true,
        badgeType: 'bottom_clearance',
        part,
        currentValue: clr.bottomClearance,
        label: this.i18n.t('designer.lowerClearance'),
        referenceY: botY,
        baseScaleX: 140,
        baseScaleY: 38
      };
      sprite.userData = {
        ...sprite.userData,
        ...badgeData
      };
      this.editableDimensionSprites.push(sprite);
      this.dimensionGroup.add(sprite);
    }

    // Render Horizontal Left Clearance Line
    if (clr.leftClearance !== null && clr.leftClearance > 5) {
      const leftX = selBounds.minX - clr.leftClearance;
      const midX = (selBounds.minX + leftX) / 2;
      const y = selBounds.py;
      const z = selBounds.pz + selBounds.sz / 2 + 28;

      const p1 = new THREE.Vector3(leftX, y, z);
      const p2 = new THREE.Vector3(selBounds.minX, y, z);
      const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const dashedLine = new THREE.Line(geo, lineMat);
      dashedLine.computeLineDistances();
      this.dimensionGroup.add(dashedLine);

      const sprite = this.createClearanceSprite(`↔ ${clr.leftClearance} mm`, false);
      sprite.position.set(midX, y + 25, z + 12);
      sprite.userData = {
        ...sprite.userData,
        baseScaleX: 140,
        baseScaleY: 38
      };
      this.dimensionGroup.add(sprite);
    }

    // Render Horizontal Right Clearance Line
    if (clr.rightClearance !== null && clr.rightClearance > 5) {
      const rightX = selBounds.maxX + clr.rightClearance;
      const midX = (selBounds.maxX + rightX) / 2;
      const y = selBounds.py;
      const z = selBounds.pz + selBounds.sz / 2 + 28;

      const p1 = new THREE.Vector3(selBounds.maxX, y, z);
      const p2 = new THREE.Vector3(rightX, y, z);
      const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const dashedLine = new THREE.Line(geo, lineMat);
      dashedLine.computeLineDistances();
      this.dimensionGroup.add(dashedLine);

      const sprite = this.createClearanceSprite(`↔ ${clr.rightClearance} mm`, false);
      sprite.position.set(midX, y + 25, z + 12);
      sprite.userData = {
        ...sprite.userData,
        baseScaleX: 140,
        baseScaleY: 38
      };
      this.dimensionGroup.add(sprite);
    }
  }

  // --- INLINE 3D DIMENSION EDITOR (Edición Directa con Clic sobre Cotas 3D) ---

  openInlineDimensionEditor(sprite: THREE.Sprite, data: DimensionBadgeUserData) {
    const worldPos = new THREE.Vector3();
    sprite.getWorldPosition(worldPos);
    const screenPos = this.projectWorldToScreen(worldPos);
    if (!screenPos) return;

    this.ngZone.run(() => {
      this.inlineDimensionEditor.set({
        x: screenPos.x,
        y: screenPos.y,
        value: data.currentValue,
        propType: data.badgeType,
        part: data.part,
        label: data.label,
        referenceY: data.referenceY,
        worldPos: worldPos.clone()
      });
    });

    setTimeout(() => {
      const input = this.inlineDimensionInputRef()?.nativeElement;
      if (input) {
        input.focus();
        input.select();
      }
    }, 40);
  }

  cancelInlineDimension() {
    this.ngZone.run(() => {
      this.inlineDimensionEditor.set(null);
    });
    if (this.controls) {
      this.controls.enabled = true;
    }
  }

  confirmInlineDimension(rawValue: string) {
    const editor = this.inlineDimensionEditor();
    if (!editor) return;

    const cleanStr = String(rawValue || '').replace(/mm/gi, '').replace(',', '.').trim();
    const numVal = Math.round(Number(cleanStr));
    if (isNaN(numVal) || numVal <= 0) {
      this.cancelInlineDimension();
      return;
    }

    const part = editor.part;
    const currentPart = this.parts().find(p => p.id === part.id) || part;

    if (editor.propType === 'length' || editor.propType === 'width') {
      const prop = editor.propType;
      const updatedPart: Part = {
        ...currentPart,
        [prop]: numVal
      };
      // 1 único snapshot en Undo/Redo y persistencia en ProjectStorageService
      this.projectStorage.updatePart(updatedPart, true);
      this.partModified.emit({ part: updatedPart, updates: { [prop]: numVal } });

      if (this.pieceObjectMap.has(currentPart.id)) {
        this.previewPartUpdatesInPlace([{ part: currentPart, updates: { [prop]: numVal } }]);
      } else {
        this.disposeGroup(this.dimensionGroup);
        if (this.show3dDimensions()) {
          const b = this.getPartBounds(updatedPart);
          this.renderPieceDimensions(updatedPart, b.px, b.py, b.pz, b.sx, b.sy, b.sz);
        }
      }
    } else if (editor.propType === 'bottom_clearance' || editor.propType === 'top_clearance') {
      const limits = this.getShelfVerticalLimits(currentPart);
      const initBounds = this.getPartBounds(currentPart);
      const halfThick = initBounds.sy / 2;

      let targetPosY: number;
      if (editor.referenceY !== undefined) {
        if (editor.propType === 'bottom_clearance') {
          // Distancia libre exacta respecto al borde superior de la pieza inferior
          targetPosY = editor.referenceY + numVal + halfThick;
        } else {
          // Distancia libre exacta respecto al borde inferior de la pieza superior
          targetPosY = editor.referenceY - numVal - halfThick;
        }
      } else {
        if (editor.propType === 'bottom_clearance') {
          targetPosY = limits.belowTopY + numVal + halfThick;
        } else {
          targetPosY = limits.aboveBottomY - numVal - halfThick;
        }
      }

      // Clamping físico que evita colisión contra paneles adyacentes manteniendo al menos 5 mm
      const minSafeY = limits.belowTopY + 5 + halfThick;
      const maxSafeY = limits.aboveBottomY - 5 - halfThick;
      const clampedPosY = minSafeY <= maxSafeY
        ? Math.max(minSafeY, Math.min(maxSafeY, Math.round(targetPosY)))
        : Math.round(targetPosY);

      const updatedPart: Part = {
        ...currentPart,
        posY: clampedPosY
      };

      // 1 único snapshot en Undo/Redo y persistencia en ProjectStorageService
      this.projectStorage.updatePart(updatedPart, true);
      this.partModified.emit({ part: updatedPart, updates: { posY: clampedPosY } });

      if (this.pieceObjectMap.has(currentPart.id)) {
        this.previewPartUpdatesInPlace([{ part: currentPart, updates: { posY: clampedPosY } }]);
      }

      // Actualización inmediata 3D de cotas y gizmo
      const updatedParts = this.parts().map(p => p.id === updatedPart.id ? updatedPart : p);
      const clr = this.computeClearanceInfo(updatedPart, updatedParts);
      this.clearanceCalculated.emit(clr);

      if (this.showClearances()) {
        if (updatedPart.groupId && (this.isInternalShelf(updatedPart) || this.isInternalDivider(updatedPart))) {
          this.renderModuleInternalClearances(updatedPart.groupId, updatedPart);
        } else {
          this.disposeGroup(this.internalClearanceGroup);
          this.renderClearanceDimensions(updatedPart, updatedParts);
        }
      }
      this.buildGizmo(
        updatedPart,
        updatedPart.posX ?? 0,
        clampedPosY,
        updatedPart.posZ ?? 0,
        initBounds.sx,
        initBounds.sy,
        initBounds.sz
      );
    }

    this.cancelInlineDimension();
    this.requestRender(16);
  }

  private projectWorldToScreen(worldPos: THREE.Vector3): { x: number; y: number } | null {
    if (!this.camera || !this.canvasRef()?.nativeElement) return null;
    const canvas = this.canvasRef()!.nativeElement;
    const rect = canvas.getBoundingClientRect();

    // Verificación estricta en espacio de cámara para descartar puntos detrás del plano near
    this.scratchCamCheck.copy(worldPos).applyMatrix4(this.camera.matrixWorldInverse);
    if (this.scratchCamCheck.z > -this.camera.near) return null;

    this.scratchEditorProj.copy(worldPos).project(this.camera);
    if (this.scratchEditorProj.z > 1) return null;
    return {
      x: (this.scratchEditorProj.x * 0.5 + 0.5) * rect.width,
      y: (-this.scratchEditorProj.y * 0.5 + 0.5) * rect.height
    };
  }

  private updateInlineEditorScreenPosition() {
    const editor = this.inlineDimensionEditor();
    if (!editor) return;
    const screenPos = this.projectWorldToScreen(editor.worldPos);
    if (!screenPos) {
      this.cancelInlineDimension();
      return;
    }
    const container = this.inlineEditorContainerRef()?.nativeElement;
    if (container) {
      container.style.left = `${screenPos.x}px`;
      container.style.top = `${screenPos.y}px`;
    }
  }

  toggleClearances() {
    this.showClearances.update(v => !v);
    if (!this.showClearances()) {
      this.disposeGroup(this.internalClearanceGroup);
    }
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
        const axis = item.slideAxis || 'z';
        const dir = item.slideDir || 1;
        const maxSlide = 320;
        targetPos[axis] += curOpen * maxSlide * dir;
        item.mesh.position.copy(targetPos);
      } else {
        const targetPos = item.originalPos
          .clone()
          .addScaledVector(item.explodedOffset, factor);
        item.mesh.position.copy(targetPos);
      }
    }
  }

  /**
   * Determina si una pieza o su grupo corresponde a un mesón, encimera o salpicadero 3D.
   */
  isCountertopPartOrGroup(part: Part | null | undefined): boolean {
    if (!part) return false;
    if (part.componentRole === 'countertop' || part.componentRole === 'backsplash') return true;
    const nameUpper = (part.name || '').toUpperCase();
    if (
      nameUpper.includes('MESÓN') ||
      nameUpper.includes('MESON') ||
      nameUpper.includes('ENCIMERA') ||
      nameUpper.includes('SALPICADERO') ||
      nameUpper.includes('ISLA CASCADA') ||
      nameUpper.includes('CASCADA')
    ) {
      return true;
    }
    if (part.groupId) {
      const grp = this.partGroups().find(g => g.id === part.groupId);
      if (grp?.isCountertop) return true;
      const grpNameUpper = (grp?.name || '').toUpperCase();
      if (
        grpNameUpper.includes('MESÓN') ||
        grpNameUpper.includes('MESON') ||
        grpNameUpper.includes('ENCIMERA') ||
        grpNameUpper.includes('ISLA CASCADA')
      ) {
        return true;
      }
      return this.parts().some(p =>
        p.groupId === part.groupId &&
        (p.componentRole === 'countertop' ||
          p.componentRole === 'backsplash' ||
          (p.name || '').toUpperCase().includes('MESÓN') ||
          (p.name || '').toUpperCase().includes('MESON'))
      );
    }
    return false;
  }

 /**
   * Verifica si una pieza está congelada directamente (part.isLocked)
   * o si pertenece a un cajón/módulo congelado (group.isLocked) o si alguna pieza de su grupo está congelada.
   */
  isPartOrGroupLocked(part: Part | null | undefined): boolean {
    if (!part) return false;
    if (part.isLocked) return true;
    if (part.groupId) {
      const grp = this.partGroups().find(g => g.id === part.groupId);
      if (grp?.isLocked) return true;
      return this.parts().some(p => p.groupId === part.groupId && !!p.isLocked);
    }
    return false;
  }

  isApplianceLocked(app: ApplianceItem | null | undefined): boolean {
    if (!app) return false;
    if (app.isLocked) return true;
    if (app.groupId) {
      const grp = this.partGroups().find(g => g.id === app.groupId);
      if (grp?.isLocked) return true;
      return this.parts().some(p => p.groupId === app.groupId && !!p.isLocked);
    }
    return false;
  }

  /**
   * Resuelve con precisión atómica el ApplianceItem actualizado y su grupo raíz de Three.js
   * a partir de cualquier malla hija o grupo interceptado por raycasting.
   */
  private resolveApplianceFromObject(startObj: THREE.Object3D | null): { app: ApplianceItem; rootGroup: THREE.Object3D | null } | null {
    let hitObj: THREE.Object3D | null = startObj;
    let foundAppId: string | null = null;
    let foundApp: ApplianceItem | null = null;
    let appRootGroup: THREE.Object3D | null = null;

    while (hitObj && hitObj !== this.appliancesGroup && hitObj !== this.scene) {
      if (hitObj.userData?.['applianceId']) {
        foundAppId = hitObj.userData['applianceId'];
      }
      if (hitObj.userData?.['appliance']?.id) {
        foundAppId = hitObj.userData['appliance'].id;
      }
      if (hitObj.parent === this.appliancesGroup) {
        appRootGroup = hitObj;
        break;
      }
      hitObj = hitObj.parent;
    }

    if (!foundAppId && appRootGroup?.userData?.['applianceId']) {
      foundAppId = appRootGroup.userData['applianceId'];
    }
    if (!foundAppId && appRootGroup?.userData?.['appliance']?.id) {
      foundAppId = appRootGroup.userData['appliance'].id;
    }

    if (foundAppId) {
      foundApp = this.appliances().find(a => a.id === foundAppId) || null;
    }
    if (!foundApp && appRootGroup?.userData?.['appliance']) {
      foundApp = appRootGroup.userData['appliance'];
    }

    if (!foundApp) return null;

    // Obtener la posición física real actual de la malla 3D en la escena para prevenir cualquier salto
    const currentMeshPos = appRootGroup ? appRootGroup.position : null;
    const isMountedSink = foundApp.type === 'sink' && ((foundApp.mountType === 'countertop' && foundApp.position.y > 60) || foundApp.position.y >= 350);
    const isMountedCooktop = foundApp.type === 'cooktop' && ((foundApp.mountType === 'countertop' && foundApp.position.y > 60) || foundApp.position.y >= 350);
    const resolvedY = (currentMeshPos !== null && !isMountedSink && !isMountedCooktop)
      ? Math.round(currentMeshPos.y)
      : (currentMeshPos !== null && isMountedSink)
        ? Math.round(currentMeshPos.y + foundApp.height - 8)
        : (currentMeshPos !== null && isMountedCooktop)
          ? Math.round(currentMeshPos.y + foundApp.height - 14)
          : foundApp.position.y;

    const targetApp: ApplianceItem = {
      ...foundApp,
      position: {
        x: currentMeshPos !== null ? Math.round(currentMeshPos.x) : foundApp.position.x,
        y: resolvedY,
        z: currentMeshPos !== null ? Math.round(currentMeshPos.z) : foundApp.position.z
      },
      rotation: appRootGroup ? Math.round(THREE.MathUtils.radToDeg(appRootGroup.rotation.y)) : (foundApp.rotation || 0)
    };

    return { app: targetApp, rootGroup: appRootGroup };
  }

  /**
   * Congela o descongela únicamente la pieza actual desde el menú contextual.
   */
  togglePartLockFromContext() {
    const part = this.contextMenuPart();
    if (!part) return;
    const nextLocked = !part.isLocked;
    this.partModified.emit({ part, updates: { isLocked: nextLocked } });
    this.closeContextMenu();
  }

  /**
   * Congela o descongela todas las piezas de un cajón o módulo completo en bloque.
   */
  toggleGroupLockFromContext() {
    const part = this.contextMenuPart();
    if (!part?.groupId) return;
    const grpParts = this.parts().filter(p => p.groupId === part.groupId);
    if (grpParts.length === 0) return;

    const currentlyLocked = this.isPartOrGroupLocked(part);
    const nextLocked = !currentlyLocked;
    const updatesList = grpParts.map(p => ({
      part: p,
      updates: { isLocked: nextLocked }
    }));
    this.multiplePartsModified.emit({ updates: updatesList });
    if (updatesList.length > 0) {
      this.partModified.emit(updatesList[0]);
    }
    this.closeContextMenu();
  }

  private lastPieceClickTime = 0;
  private lastClickedPartId: string | null = null;

  // Pointer Down: Detect clicks on Gizmo controls vs Pieces vs Empty space vs Measurement picking
  private onPointerDown(e: PointerEvent) {
    const canvas = this.canvasRef()?.nativeElement;
    if (this.isRenderingPaused || !canvas || !this.camera) return;

    // Close open context menu on canvas interaction
    if (this.contextMenuPos()) {
      this.closeContextMenu();
    }

    if (this.inlineDimensionEditor() && e.button !== 0) {
      this.cancelInlineDimension();
    }

    // Right-Click tracking: record down coordinates & time to distinguish stationary click from drag pan/orbit
    if (e.button === 2) {
      this.rightPointerDownPos = { x: e.clientX, y: e.clientY };
      this.rightPointerDownTime = Date.now();
      this.rightPointerDragged = false;
      return;
    }

    // 0. Selección múltiple por ventana (Marquee Box Selection con tecla Shift presionada)
    // Desactiva OrbitControls para que la cámara no se mueva durante el arrastre de selección técnica
    if (e.button === 0 && e.shiftKey) {
      const canvasBounds = canvas.getBoundingClientRect();
      this.isMarqueeSelecting = true;
      this.marqueeStart = {
        x: e.clientX - canvasBounds.left,
        y: e.clientY - canvasBounds.top,
        clientX: e.clientX,
        clientY: e.clientY
      };
      this.marqueeBox.set(null);
      this.controls.enabled = false;
      return;
    }

    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 0. Measurement Tape 2-Click & Drag Mode (Motor de Inferencias CAD)
    if (this.isMeasureMode()) {
      if (e.button !== 0) return; // Solo responder a clic primario

      const snapCand = this.findMagneticSnapCandidate(e.clientX, e.clientY, 32);

      // Si la cota anterior ya estaba finalizada y el usuario hace clic sobre un punto de imán:
      if (this.isMeasurementPersistent()) {
        if (snapCand) {
          this.startNewMeasurement();
          const pt = {
            x: Math.round(snapCand.worldPos.x),
            y: Math.round(snapCand.worldPos.y),
            z: Math.round(snapCand.worldPos.z)
          };
          this.measurePointA.set(pt);
          this.measurePointB.set(pt);
          this.measurePointAEdgeDir = snapCand.edgeDir ? snapCand.edgeDir.clone() : null;
          this.measurePointerDownPos = { x: e.clientX, y: e.clientY };
          this.measurePointerDownTime = performance.now();
          this.isMeasuringDrag = true;
          this.controls.enabled = false;
          this.renderMeasurementVisuals();
          e.preventDefault();
          e.stopPropagation();
          return;
        } else {
          // Si hace clic en el vacío, permitir orbitar la cámara libremente
          return;
        }
      }

      // Si el Punto A no ha sido fijado todavía (Primer clic):
      if (!this.measurePointA()) {
        if (snapCand) {
          const pt = {
            x: Math.round(snapCand.worldPos.x),
            y: Math.round(snapCand.worldPos.y),
            z: Math.round(snapCand.worldPos.z)
          };
          this.measurePointA.set(pt);
          this.measurePointB.set(pt);
          this.measurePointAEdgeDir = snapCand.edgeDir ? snapCand.edgeDir.clone() : null;
          this.measurePointerDownPos = { x: e.clientX, y: e.clientY };
          this.measurePointerDownTime = performance.now();
          this.isMeasuringDrag = true;
          this.controls.enabled = false;
          this.renderMeasurementVisuals();
          e.preventDefault();
          e.stopPropagation();
          return;
        } else {
          // Clic en vacío: permitir rotación / órbita de cámara
          return;
        }
      }

      // Si el Punto A YA está fijado (Segundo clic en modo 2-Clicks de precisión CAD):
      if (this.measurePointA() && !this.isMeasurementPersistent()) {
        if (snapCand) {
          const resolvedB = this.resolveMeasurementPointB(snapCand, e.shiftKey);
          this.measurePointB.set(resolvedB);
          this.isMeasurementPersistent.set(true);
          this.isMeasuringDrag = false;
          this.controls.enabled = true;
          this.renderMeasurementVisuals();
          this.updateMagneticSnapIndicator(null);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    }

    // 0.3. Rotate 90° Tool
    if (this.activeTool() === 'rotate_90') {
      const intersects = this.raycaster.intersectObjects(
        this.raycastablePieceMeshes,
        false
      );
      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const part = hit.userData['part'] as Part;
        if (part) {
          this.ngZone.run(() => {
            if (this.isPartOrGroupLocked(part)) {
              this.partsSelected.emit([part.id]);
              this.partSelected.emit(part);
              canvas.style.cursor = 'not-allowed';
              return;
            }
            const curIds = this.activeSelectedIds();
            const isSingleIsolated = curIds.length === 1 && curIds[0] === part.id;
            if (part.groupId && (!isSingleIsolated || this.isCountertopPartOrGroup(part))) {
              const grpParts = this.parts().filter(p => p.groupId === part.groupId);
              if (grpParts.length > 1) {
                this.groupRotationRequested.emit({ groupId: part.groupId, deltaAngle: 90 });
                this.partsSelected.emit(grpParts.map(p => p.id));
                this.partSelected.emit(part);
                return;
              }
            }
            this.rotatePart90(part, 'y');
            this.partsSelected.emit([part.id]);
            this.partSelected.emit(part);
          });
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    }

    // 0.8 Check if clicking on Wall Gizmo (Axis translation arrow, Edge stretch handle or Top Height handle)
    if (this.workspaceMode() === 'room' && this.wallGizmoHitMeshes.length > 0) {
      const wallGizmoIntersects = this.raycaster.intersectObjects(this.wallGizmoHitMeshes, true);
      if (wallGizmoIntersects.length > 0) {
        const hitObj = wallGizmoIntersects[0].object;
        const hitData = hitObj.userData as {
          isWallGizmo: boolean;
          type: 'wall_move' | 'wall_stretch' | 'wall_stretch_height';
          axis?: 'x' | 'y' | 'z';
          wallTarget?: string;
        };
        if (hitData && hitData.isWallGizmo && hitData.wallTarget) {
          const cfg = this.roomConfig();
          const targetWall = getResolvedRoomWalls(cfg).find(w => w.id === hitData.wallTarget);
          const isLocked = !targetWall || !!cfg.isWallsLocked || !!targetWall.isLocked || !!cfg.lockedWalls?.[hitData.wallTarget];
          if (isLocked || !targetWall) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          this.isWallGizmoDragging = true;
          this.activeWallGizmoHit = hitData;
          this.activeWallTarget = hitData.wallTarget;
          this.dragStartPointer = { x: e.clientX, y: e.clientY };
          this.initialWallPosX = targetWall.posX;
          this.initialWallPosZ = targetWall.posZ;
          this.initialWallLength = targetWall.length;
          this.initialWallHeight = targetWall.height;
          this.dragPlane.set(new THREE.Vector3(0, 1, 0), 0);
          const startHit = new THREE.Vector3();
          if (this.raycaster.ray.intersectPlane(this.dragPlane, startHit)) {
            this.dragPlaneIntersectionStart.copy(startHit);
          } else {
            this.dragPlaneIntersectionStart.set(targetWall.posX, 0, targetWall.posZ);
          }
          this.controls.enabled = false;
          canvas.style.cursor = hitData.type === 'wall_stretch_height'
            ? 'ns-resize'
            : hitData.type === 'wall_stretch'
              ? 'ew-resize'
              : 'grabbing';
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    }

    // 0.9 Check if clicking on an Editable 3D Dimension Badge (Clearance or Part Dimension)
    if (e.button === 0 && this.editableDimensionSprites.length > 0) {
      const dimIntersects = this.raycaster.intersectObjects(this.editableDimensionSprites, false);
      if (dimIntersects.length > 0) {
        const hitSprite = dimIntersects[0].object as THREE.Sprite;
        const badgeData = hitSprite.userData as DimensionBadgeUserData;
        if (badgeData && badgeData.isDimensionBadge) {
          if (this.controls) {
            this.controls.enabled = false;
          }
          this.openInlineDimensionEditor(hitSprite, badgeData);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    }

    // Cancel open inline dimension editor when interacting with other 3D scene elements
    if (this.inlineDimensionEditor()) {
      this.cancelInlineDimension();
    }

    // 1. Check if clicking on Gizmo stretch handle or directly on a Corner (Vertex) / Continuous Edge (Arista) of the selected piece
    let matchedGizmoHit: GizmoHitData | null = null;
    if (this.gizmoHitMeshes.length > 0) {
      const gizmoIntersects = this.raycaster.intersectObjects(this.gizmoHitMeshes, true);
      if (gizmoIntersects.length > 0) {
        const hitObj = gizmoIntersects[0].object;
        const rawHit = hitObj.userData as GizmoHitData;
        if (rawHit && rawHit.isGizmo) {
          hitObj.getWorldPosition(this.scratchGizmoWorldPos);
          matchedGizmoHit = {
            ...rawHit,
            worldHitPos: this.scratchGizmoWorldPos.clone()
          };
        }
      }
    }
    if (!matchedGizmoHit) {
      matchedGizmoHit = this.detectSelectedPartEdgeOrCornerHover(e.clientX, e.clientY);
    }

    if (matchedGizmoHit) {
      const selParts = this.selectedParts();
      if (selParts.length > 0) {
        if (selParts.some(p => this.isPartOrGroupLocked(p))) {
          canvas.style.cursor = 'not-allowed';
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        this.isDragging = true;
        this.liveDragPartUpdates.clear();
        this.liveDragApplianceUpdates.clear();
        this.activeGizmoHit = matchedGizmoHit;
        this.dragStartPointer = { x: e.clientX, y: e.clientY };
        this.dragInitialPart = { ...selParts[0] };
        this.dragInitialParts = selParts.map(p => ({ ...p }));

        this.ngZone.run(() => this.dragStarted.emit());
        this.controls.enabled = false;

        // Anclar el plano de arrastre exactamente en el punto de la esquina o borde clickeado (precisión 1:1 en zoom macro)
        if (matchedGizmoHit.worldHitPos) {
          this.scratchGizmoWorldPos.copy(matchedGizmoHit.worldHitPos);
        } else {
          const centroid = this.calculateCentroid(selParts);
          this.scratchGizmoWorldPos.set(centroid.x, centroid.y, centroid.z);
        }
        this.camera.getWorldDirection(this.scratchCamForward);
        this.dragPlane.setFromNormalAndCoplanarPoint(this.scratchCamForward.negate(), this.scratchGizmoWorldPos);

        if (this.raycaster.ray.intersectPlane(this.dragPlane, this.scratchCurrentIntersection)) {
          this.dragPlaneIntersectionStart.copy(this.scratchCurrentIntersection);
        } else {
          this.dragPlaneIntersectionStart.copy(this.scratchGizmoWorldPos);
        }

        canvas.style.cursor = matchedGizmoHit.cursor || 'grabbing';
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    // 1.3 Check if clicking on an Appliance Resize Handle (3D Face Handles)
    if (this.applianceHandleHitMeshes.length > 0) {
      const handleIntersects = this.raycaster.intersectObjects(this.applianceHandleHitMeshes, true);
      if (handleIntersects.length > 0) {
        const hit = handleIntersects[0].object as THREE.Mesh;
        const handleData = hit.userData;
        if (handleData && handleData['isApplianceHandle']) {
          const freshApp = this.appliances().find(a => a.id === handleData['appliance']?.id) || handleData['appliance'];
          this.isApplianceResizing = true;
          this.liveDragPrimaryApplianceUpdate = null;
          this.draggingAppliance = freshApp;
          this.activeApplianceHandle = {
            axis: handleData['axis'],
            direction: handleData['direction']
          };
          this.dragInitialAppliancePos = { ...freshApp.position };
          this.dragInitialApplianceDim = {
            width: freshApp.width,
            height: freshApp.height,
            depth: freshApp.depth
          };
          this.dragStartPointer = { x: e.clientX, y: e.clientY };
          this.ngZone.run(() => this.dragStarted.emit());
          this.controls.enabled = false;

          const camDir = new THREE.Vector3();
          this.camera.getWorldDirection(camDir);
          const handlePos = hit.position.clone();
          this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), handlePos);

          const intersectPoint = new THREE.Vector3();
          if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
            this.dragPlaneIntersectionStart.copy(intersectPoint);
          } else {
            this.dragPlaneIntersectionStart.copy(handlePos);
          }

          canvas.style.cursor = 'crosshair';
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    }

    // 1.5 Check if clicking on an Appliance in 3D (Select & Free Mouse Drag)
    if (this.appliancesGroup.children.length > 0) {
      const appIntersects = this.raycaster.intersectObjects(this.appliancesGroup.children, true);
      if (appIntersects.length > 0) {
        const resolved = this.resolveApplianceFromObject(appIntersects[0].object);
        if (resolved) {
          const targetApp = resolved.app;
          if (e.shiftKey) {
            this.ngZone.run(() => this.handleShiftClickSelection(e));
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          const curPartIds = this.activeSelectedIds();
          const curAppIds = this.activeSelectedApplianceIds();
          const isPartOfActiveMulti = curAppIds.includes(targetApp.id) && (curPartIds.length > 0 || curAppIds.length > 1);

          this.ngZone.run(() => {
            this.applianceSelected.emit(targetApp);
            if (!isPartOfActiveMulti) {
              this.appliancesSelected.emit([targetApp.id]);
              this.partsSelected.emit([]);
              this.partSelected.emit(null);
            }
            this.selectedWallType.set(null);
            this.wallSelected.emit(null);
          });

          if (e.button === 0 && !this.isApplianceLocked(targetApp)) {
            this.isApplianceDragging = true;
            this.liveDragPartUpdates.clear();
            this.liveDragApplianceUpdates.clear();
            this.liveDragPrimaryApplianceUpdate = null;
            this.draggingAppliance = { ...targetApp };
            this.dragInitialAppliancePos = { ...targetApp.position };
            this.dragStartPointer = { x: e.clientX, y: e.clientY };
            this.ngZone.run(() => this.dragStarted.emit());
            this.controls.enabled = false;

            // Almacenar las piezas y equipos que deben desplazarse junto a este electrodoméstico SOLO si es multiselección activa
            const activeParts = isPartOfActiveMulti && targetApp.groupId
              ? this.parts().filter(p => p.groupId === targetApp.groupId)
              : (isPartOfActiveMulti ? this.selectedParts() : []);
            this.dragInitialParts = activeParts.map(p => ({ ...p }));
            const relevantGroupIds = new Set(activeParts.map(p => p.groupId).filter(Boolean));
            const activeApps = isPartOfActiveMulti
              ? this.appliances().filter(
                  a => a.id !== targetApp.id && (curAppIds.includes(a.id) || (a.groupId && (a.groupId === targetApp.groupId || relevantGroupIds.has(a.groupId))))
                )
              : [];
            this.dragInitialSelectedAppliances = activeApps.map(a => ({ ...a, position: { ...a.position } }));

            const camDir = new THREE.Vector3();
            this.camera.getWorldDirection(camDir);
            const appCenterPos = new THREE.Vector3(
              targetApp.position.x,
              targetApp.position.y + targetApp.height / 2,
              targetApp.position.z
            );
            this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), appCenterPos);

            const intersectPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
              this.dragPlaneIntersectionStart.copy(intersectPoint);
            } else {
              this.dragPlaneIntersectionStart.copy(appCenterPos);
            }

            canvas.style.cursor = 'grabbing';
          }

          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }
    }

    // 1.8. Selección y arrastre libre en el suelo del Maniquí de Escala y Guía de Frente
    if (this.showReferenceGuide() && this.referenceGuideGroup.children.length > 0) {
      const guideIntersects = this.raycaster.intersectObjects(this.referenceGuideGroup.children, true);
      const hitGuide = guideIntersects.find(h => h.object.userData?.['isReferenceGuide']);
      if (hitGuide) {
        this.ngZone.run(() => {
          this.isReferenceGuideSelected.set(true);
          this.partSelected.emit(null);
          this.partsSelected.emit([]);
          this.applianceSelected.emit(null);
        });

        if (e.button === 0) {
          this.isReferenceGuideDragging = true;
          this.dragInitialGuidePos = { ...this.referenceGuidePos() };
          this.controls.enabled = false;
          this.dragPlane.set(new THREE.Vector3(0, 1, 0), 0);
          const intersectPt = new THREE.Vector3();
          if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPt)) {
            this.dragPlaneIntersectionStart.copy(intersectPt);
          }
          canvas.style.cursor = 'grabbing';
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      } else {
        this.isReferenceGuideSelected.set(false);
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
        const hitPart = part;
        if (isHandle) {
          this.ngZone.run(() => this.togglePartOpen(hitPart.id));
        }
        if (e.shiftKey) {
          this.ngZone.run(() => {
            const cur = [...this.activeSelectedIds()];
            const idx = cur.indexOf(hitPart.id);
            if (idx >= 0) {
              cur.splice(idx, 1);
            } else {
              cur.push(hitPart.id);
            }
            this.partsSelected.emit(cur);
            if (cur.length === 0) {
              this.partSelected.emit(null);
            }
          });
        } else {
          const now = Date.now();
          const isDoubleClickSamePart =
            now - this.lastPieceClickTime < 350 && this.lastClickedPartId === hitPart.id;
          this.lastPieceClickTime = now;
          this.lastClickedPartId = hitPart.id;

          let partsToSelect: Part[] = [];
          const curIds = this.activeSelectedIds();
          const isAlreadySingleIsolated = curIds.length === 1 && curIds[0] === hitPart.id;
          const isCountertopUnit = hitPart.componentRole === 'countertop' || hitPart.componentRole === 'backsplash';

          this.ngZone.run(() => {
            if (curIds.includes(hitPart.id) && curIds.length > 1) {
              partsToSelect = this.parts().filter(p => curIds.includes(p.id));
              this.partsSelected.emit(curIds);
              this.partSelected.emit(hitPart);
            } else if (isCountertopUnit) {
              partsToSelect = [hitPart];
              this.partsSelected.emit([hitPart.id]);
              this.partSelected.emit(hitPart);
            } else if (hitPart.groupId) {
              const groupParts = this.parts().filter(p => p.groupId === hitPart.groupId);
              if (isDoubleClickSamePart || isAlreadySingleIsolated || this.isInternalShelf(hitPart) || this.isInternalDivider(hitPart)) {
                partsToSelect = [hitPart];
                if (this.isInternalShelf(hitPart) && !e.altKey && !e.shiftKey) {
                  const cavity = this.partGeometry.getModuleCavityCenter(hitPart, this.parts());
                  if (cavity) {
                    const isOffX = Math.abs((hitPart.posX ?? 0) - cavity.x) > 1.5;
                    const isOffZ = Math.abs((hitPart.posZ ?? 0) - cavity.z) > 1.5;
                    if (isOffX || isOffZ) {
                      hitPart.posX = cavity.x;
                      hitPart.posZ = cavity.z;
                      this.projectStorage.updatePart({ ...hitPart, posX: cavity.x, posZ: cavity.z });
                    }
                  }
                }
              } else {
                partsToSelect = groupParts.length > 0 ? groupParts : [hitPart];
              }
              this.partsSelected.emit(partsToSelect.map(p => p.id));
              this.partSelected.emit(hitPart);
            } else {
              partsToSelect = [hitPart];
              this.partsSelected.emit([hitPart.id]);
              this.partSelected.emit(hitPart);
            }
          });

          // Si la pieza o alguna pieza del grupo seleccionado está CONGELADA (isLocked),
          // permitimos seleccionarla pero NO iniciamos el arrastre con el mouse (isDirectPieceDrag = false)
          const anyLocked = this.isPartOrGroupLocked(hitPart) || partsToSelect.some(p => this.isPartOrGroupLocked(p));
          if (anyLocked) {
            this.isDirectPieceDrag = false;
            return;
          }

          if (e.button === 0 && (this.activeTool() === 'select' || this.activeTool() === 'move') && !isHandle) {
            this.isDirectPieceDrag = true;
            this.directPieceDragThresholdPassed = false;
            this.liveDragPartUpdates.clear();
            this.liveDragApplianceUpdates.clear();
            this.dragStartPointer = { x: e.clientX, y: e.clientY };
            this.dragInitialPart = { ...hitPart };

            // Si es mesón o salpicadero, al arrastrar con el mouse se mueve todo el conjunto de placas y salpicaderos en bloque
            if (isCountertopUnit && hitPart.groupId) {
              const allCtParts = this.parts().filter(p => p.groupId === hitPart.groupId);
              this.dragInitialParts = allCtParts.map(p => ({ ...p }));
            } else {
              this.dragInitialParts = partsToSelect.map(p => ({ ...p }));
            }

            // Capturar también los electrodomésticos seleccionados o vinculados a los módulos arrastrados
            const targetGroupIds = new Set(partsToSelect.map(p => p.groupId).filter(Boolean));
            const curAppIds = new Set(this.activeSelectedApplianceIds());
            const linkedApps = this.appliances().filter(
              a => curAppIds.has(a.id) || (a.groupId && targetGroupIds.has(a.groupId))
            );
            this.dragInitialSelectedAppliances = linkedApps.map(a => ({
              ...a,
              position: { ...a.position }
            }));

            const camDir = new THREE.Vector3();
            this.camera.getWorldDirection(camDir);
            const hitPoint = intersects[0].point.clone();

            if (this.isInternalShelf(hitPart) && !e.altKey && !e.shiftKey) {
              const absY = Math.abs(camDir.y);
              if (absY > 0.85) {
                this.camera.getWorldDirection(camDir);
                this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), hitPoint);
              } else {
                camDir.y = 0;
                camDir.normalize();
                const coplanarPt = new THREE.Vector3(hitPart.posX ?? 0, hitPart.posY ?? 0, hitPart.posZ ?? 0);
                this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), coplanarPt);
              }
            } else if (this.isInternalDivider(hitPart) && !e.altKey && !e.shiftKey) {
              const coplanarPt = new THREE.Vector3(hitPart.posX ?? 0, hitPart.posY ?? 0, hitPart.posZ ?? 0);
              this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), coplanarPt);
            } else {
              this.dragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), hitPoint);
            }

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
      if (this.workspaceMode() === 'room') {
        const roomHits = this.raycaster.intersectObjects(this.roomGroup.children, true);
        const wallHit = roomHits.find(h => h.object.userData?.['isWall']);
        if (wallHit) {
          const wallId = (wallHit.object.userData['wallId'] || wallHit.object.userData['wallType']) as string;
          this.ngZone.run(() => {
            this.selectedWallType.set(wallId);
            this.wallSelected.emit(wallId);
          });
          const cfg = this.roomConfig();
          const targetWall = getResolvedRoomWalls(cfg).find(w => w.id === wallId);
          const isLocked = !targetWall || !!cfg.isWallsLocked || !!targetWall.isLocked || !!cfg.lockedWalls?.[wallId];
          if (!isLocked && targetWall) {
            this.isWallDragging = true;
            this.activeWallTarget = wallId;
            this.dragStartPointer = { x: e.clientX, y: e.clientY };
            this.initialWallPosX = targetWall.posX;
            this.initialWallPosZ = targetWall.posZ;
            this.dragPlane.set(new THREE.Vector3(0, 1, 0), 0);
            const startHit = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(this.dragPlane, startHit)) {
              this.dragPlaneIntersectionStart.copy(startHit);
            } else {
              this.dragPlaneIntersectionStart.set(targetWall.posX, 0, targetWall.posZ);
            }
            this.controls.enabled = false;
            if (canvas) canvas.style.cursor = 'move';
          } else {
            this.isWallDragging = false;
          }
          return;
        }
      }
      this.ngZone.run(() => {
        this.selectedWallType.set(null);
        this.wallSelected.emit(null);
        this.partsSelected.emit([]);
        this.partSelected.emit(null);
        this.applianceSelected.emit(null);
      });
    }
  }

    // Pointer Move: Dragging Gizmo, Push/Pulling, Drawing Rect or Updating Hover Cursors
  private onPointerMove(e: PointerEvent) {
    const canvas = this.canvasRef()?.nativeElement;
    if (this.isRenderingPaused || !canvas || !this.camera) return;

    // Si estamos en modo de selección múltiple por ventana (Shift + arrastre)
    if (this.isMarqueeSelecting) {
      const canvasBounds = canvas.getBoundingClientRect();
      const curX = e.clientX - canvasBounds.left;
      const curY = e.clientY - canvasBounds.top;
      const dist = Math.hypot(e.clientX - this.marqueeStart.clientX, e.clientY - this.marqueeStart.clientY);
      if (dist > 5) {
        this.marqueeBox.set({
          left: Math.min(this.marqueeStart.x, curX),
          top: Math.min(this.marqueeStart.y, curY),
          width: Math.abs(curX - this.marqueeStart.x),
          height: Math.abs(curY - this.marqueeStart.y)
        });
        canvas.style.cursor = 'crosshair';
      }
      return;
    }

    // Track right pointer drag to distinguish panning from stationary context menu click
    if (this.rightPointerDownPos) {
      const dist = Math.hypot(e.clientX - this.rightPointerDownPos.x, e.clientY - this.rightPointerDownPos.y);
      if (dist > 5) {
        this.rightPointerDragged = true;
      }
    }

    // Arrastre en el suelo del Maniquí de Escala Humana y Guía de Frente
 if (this.isReferenceGuideDragging) {
   const rect = canvas.getBoundingClientRect();
   this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
   this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
   this.raycaster.setFromCamera(this.mouse, this.camera);

   const currentIntersect = new THREE.Vector3();
   if (this.raycaster.ray.intersectPlane(this.dragPlane, currentIntersect)) {
     const deltaWorld = currentIntersect.clone().sub(this.dragPlaneIntersectionStart);
     const snap = 10;
     const newX = Math.round((this.dragInitialGuidePos.x + deltaWorld.x) / snap) * snap;
     const newZ = Math.round((this.dragInitialGuidePos.z + deltaWorld.z) / snap) * snap;
     this.referenceGuidePos.set({ x: newX, z: newZ });
   }
   return;
 }

    // Direct Appliance 3D Face Handle Resizing (Tiradores interactivos en las caras de la caja 3D)
    if (this.isApplianceResizing && this.draggingAppliance && this.activeApplianceHandle) {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const currentIntersect = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.dragPlane, currentIntersect)) {
        const deltaWorld = currentIntersect.clone().sub(this.dragPlaneIntersectionStart);
        const { axis, direction } = this.activeApplianceHandle;
        const initialDim = this.dragInitialApplianceDim;
        const initialPos = this.dragInitialAppliancePos;
        const updates: Partial<ApplianceItem> = {};

        if (axis === 'x') {
          const delta = deltaWorld.x * direction;
          const nextW = Math.max(200, Math.min(2500, Math.round(initialDim.width + delta)));
          const actualDeltaW = nextW - initialDim.width;
          updates.width = nextW;
          updates.position = {
            ...initialPos,
            x: Math.round(initialPos.x + (actualDeltaW / 2) * direction)
          };
        } else if (axis === 'y') {
          const delta = deltaWorld.y * direction;
          const nextH = Math.max(100, Math.min(2500, Math.round(initialDim.height + delta)));
          updates.height = nextH;
          // Al tirar hacia arriba del tirador superior, la base queda anclada
          updates.position = {
            ...initialPos
          };
        } else if (axis === 'z') {
          const delta = deltaWorld.z * direction;
          const nextD = Math.max(150, Math.min(1500, Math.round(initialDim.depth + delta)));
          const actualDeltaD = nextD - initialDim.depth;
          updates.depth = nextD;
          updates.position = {
            ...initialPos,
            z: Math.round(initialPos.z + (actualDeltaD / 2) * direction)
          };
        }

        this.ngZone.run(() => {
          this.applianceModified.emit({
            appliance: this.draggingAppliance!,
            updates
          });
        });
      }
      return;
    }

    // Direct Appliance Free Dragging with Smart Contact Magnet (Arrastre plano con imán automático a pisos, mesadas y paredes)
    if (this.isApplianceDragging && this.draggingAppliance) {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const currentIntersect = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(this.dragPlane, currentIntersect)) {
        const deltaWorld = currentIntersect.clone().sub(this.dragPlaneIntersectionStart);
        const app = this.draggingAppliance;
        const initialPos = this.dragInitialAppliancePos;
        const rawX = Math.round(initialPos.x + deltaWorld.x);
        const rawY = Math.max(0, Math.round(initialPos.y + deltaWorld.y));
        const rawZ = Math.round(initialPos.z + deltaWorld.z);

        let newX = rawX;
        let newY = rawY;
        let newZ = rawZ;

        // --- CONTACT MAGNET (Imán dinámico: adherir al aproximarse y soltar al alejarse) ---
        const parts = this.parts();
        const rot = ((app.rotation || 0) % 360 + 360) % 360;
        const isRotated90 = rot === 90 || rot === 270;
        const appDimX = isRotated90 ? (app.depth || 600) : (app.width || 600);
        const appDimZ = isRotated90 ? (app.width || 600) : (app.depth || 600);
        const halfAppW = appDimX / 2;
        const halfAppD = appDimZ / 2;

        // 1. Detección de mesada o pieza horizontal bajo la huella (X, Z) del equipo
        let hasCountertopUnderneath = false;
        let highestCountertopY = 0;

        for (const p of parts) {
          if (p.orientation === 'horizontal') {
            const pX = p.posX ?? 0;
            const pZ = p.posZ ?? 0;
            const pHalfL = (p.length || 0) / 2;
            const pHalfW = (p.width || 0) / 2;
            const pTopY = (p.posY ?? 0) + (p.thickness || 18) / 2;

            // Coincidencia en el plano horizontal XZ (con margen de aproximación de 40mm)
            const overlapX = (newX - halfAppW < pX + pHalfL + 40) && (newX + halfAppW > pX - pHalfL - 40);
            const overlapZ = (newZ - halfAppD < pZ + pHalfW + 40) && (newZ + halfAppD > pZ - pHalfW - 40);

            if (overlapX && overlapZ && pTopY > highestCountertopY) {
              highestCountertopY = pTopY;
              hasCountertopUnderneath = true;
            }
          }
        }

        // Adherencia suave a mesadas y pisos con desenganche natural al alejar el ratón
        if (hasCountertopUnderneath && Math.abs(rawY - highestCountertopY) <= 130) {
          newY = highestCountertopY;
        } else if (rawY <= 110) {
          newY = 0; // Adherencia limpia al suelo si está a menos de 110mm de la base
        } else {
          newY = rawY; // Elevación vertical libre hacia arriba o hacia abajo con el ratón
        }

        // 2 & 3. Imán inteligente de paredes (Muro posterior y muro en L con umbral fino de 30 mm y guía visual)
        if (this.isMagneticSnap()) {
          const appMinX = rawX - halfAppW;
          const appMaxX = rawX + halfAppW;
          const appMinZ = rawZ - halfAppD;
          const appMaxZ = rawZ + halfAppD;
          const appMinY = newY;
          const appMaxY = newY + (app.height || 850);

          const wallSnap = this.calculateWallSnap({
            minX: appMinX,
            maxX: appMaxX,
            minY: appMinY,
            maxY: appMaxY,
            minZ: appMinZ,
            maxZ: appMaxZ
          }, 30);

          if (wallSnap.isSnappedZ) {
            newZ = Math.round(rawZ + wallSnap.deltaZ);
          }
          if (wallSnap.isSnappedX) {
            newX = Math.round(rawX + wallSnap.deltaX);
          }

          if (wallSnap.isSnappedX || wallSnap.isSnappedZ) {
            this.renderWallSnapGuides(wallSnap);
          } else {
            this.clearWallSnapGuides();
          }
        } else {
          this.clearWallSnapGuides();
        }

        const appDeltaX = newX - initialPos.x;
        const appDeltaY = newY - initialPos.y;
        const appDeltaZ = newZ - initialPos.z;

        const partUpdates: { part: Part; updates: Partial<Part> }[] = [];
        if (this.dragInitialParts.length > 0) {
          for (const p of this.dragInitialParts) {
            const b = this.getPartBounds(p);
            partUpdates.push({
              part: p,
              updates: {
                posX: Math.round((p.posX ?? 0) + appDeltaX),
                posY: Math.round((p.posY ?? b.sy / 2) + appDeltaY),
                posZ: Math.round((p.posZ ?? 0) + appDeltaZ)
              }
            });
          }
        }

        const appUpdates: { id: string; updates: Partial<ApplianceItem> }[] = [];
        if (this.dragInitialSelectedAppliances.length > 0) {
          for (const a of this.dragInitialSelectedAppliances) {
            appUpdates.push({
              id: a.id,
              updates: {
                position: {
                  x: Math.round(a.position.x + appDeltaX),
                  y: Math.max(0, Math.round(a.position.y + appDeltaY)),
                  z: Math.round(a.position.z + appDeltaZ)
                }
              }
            });
          }
        }

        const primaryAppUpdates: Partial<ApplianceItem> = {
          position: { x: newX, y: newY, z: newZ }
        };
        if (app.groupId && this.dragInitialParts.length === 0) {
          primaryAppUpdates.groupId = undefined;
        }

        this.previewPartUpdatesInPlace(partUpdates, appUpdates, {
          appliance: app,
          updates: primaryAppUpdates
        });
      }
      return;
    }

    // Direct Room Wall Dragging (X / Z translation)
    if (this.isWallDragging && this.activeWallTarget) {
      const cfg = this.roomConfig();
      const allWalls = getResolvedRoomWalls(cfg);
      const activeWall = allWalls.find(w => w.id === this.activeWallTarget);
      if (!activeWall || activeWall.isLocked || cfg.isWallsLocked || cfg.lockedWalls?.[activeWall.id]) {
        this.isWallDragging = false;
        return;
      }

      let moveX = 0;
      let moveZ = 0;
      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.scratchCurrentIntersection)) {
        const deltaX = this.scratchCurrentIntersection.x - this.dragPlaneIntersectionStart.x;
        const deltaZ = this.scratchCurrentIntersection.z - this.dragPlaneIntersectionStart.z;
        moveX = Math.round(deltaX / 50) * 50;
        moveZ = Math.round(deltaZ / 50) * 50;
      } else {
        const dx = (e.clientX - this.dragStartPointer.x) * 1.5;
        const dy = (e.clientY - this.dragStartPointer.y) * 1.5;
        const camAngle = this.controls.getAzimuthalAngle();
        const sin = Math.sin(camAngle);
        const cos = Math.cos(camAngle);
        moveX = Math.round((dx * cos + dy * sin) / 50) * 50;
        moveZ = Math.round((-dx * sin + dy * cos) / 50) * 50;
      }

      let candX = this.initialWallPosX + moveX;
      let candZ = this.initialWallPosZ + moveZ;

      // Clamping dentro del piso de la habitación
      const floorW = cfg.floorWidth || 5000;
      const floorD = cfg.floorDepth || 5000;
      const isHoriz = activeWall.rotationY === 0 || activeWall.rotationY === 180;
      const halfSpanX = isHoriz ? activeWall.length / 2 : activeWall.thickness / 2;
      const halfSpanZ = isHoriz ? activeWall.thickness / 2 : activeWall.length / 2;
      const minFloorX = -(floorW / 2) + halfSpanX;
      const maxFloorX = (floorW / 2) - halfSpanX;
      const minFloorZ = -(floorD / 2) + halfSpanZ;
      const maxFloorZ = (floorD / 2) - halfSpanZ;

      candX = Math.max(minFloorX, Math.min(maxFloorX, candX));
      candZ = Math.max(minFloorZ, Math.min(maxFloorZ, candZ));

      // Imán Muro a Muro (Wall-to-Wall Snap)
      const snapRes = this.calculateWallToWallSnap(activeWall, candX, candZ, allWalls);
      if (snapRes.isSnapped) {
        candX = snapRes.snappedX;
        candZ = snapRes.snappedZ;
        this.renderWallToWallSnapGuide(snapRes);
      } else {
        this.clearWallSnapGuides();
      }

      this.updateLiveWallTransform(activeWall.id, candX, candZ);
      this.pendingWallUpdates = { wallId: activeWall.id, updates: { posX: candX, posZ: candZ } };
      this.requestRender(2);
      return;
    }

    // Direct Wall Gizmo Dragging (Axis Translation, Edge Stretch or Height Stretch)
    if (this.isWallGizmoDragging && this.activeWallGizmoHit) {
      const hit = this.activeWallGizmoHit;
      const cfg = this.roomConfig();
      const allWalls = getResolvedRoomWalls(cfg);
      const activeWall = allWalls.find(w => w.id === hit.wallTarget);
      if (!activeWall || activeWall.isLocked || cfg.isWallsLocked || cfg.lockedWalls?.[activeWall.id]) {
        this.isWallGizmoDragging = false;
        return;
      }

      const dx = (e.clientX - this.dragStartPointer.x) * 1.5;
      const dy = (e.clientY - this.dragStartPointer.y) * 1.5;
      const camAngle = this.controls.getAzimuthalAngle();
      const sin = Math.sin(camAngle);
      const cos = Math.cos(camAngle);

      const floorW = cfg.floorWidth || 5000;
      const floorD = cfg.floorDepth || 5000;

      if (hit.type === 'wall_move') {
        let moveX = 0;
        let moveZ = 0;
        if (this.raycaster.ray.intersectPlane(this.dragPlane, this.scratchCurrentIntersection)) {
          const deltaX = this.scratchCurrentIntersection.x - this.dragPlaneIntersectionStart.x;
          const deltaZ = this.scratchCurrentIntersection.z - this.dragPlaneIntersectionStart.z;
          moveX = Math.round(deltaX / 50) * 50;
          moveZ = Math.round(deltaZ / 50) * 50;
        } else {
          moveX = Math.round((dx * cos + dy * sin) / 50) * 50;
          moveZ = Math.round((-dx * sin + dy * cos) / 50) * 50;
        }

        let candX = activeWall.posX;
        let candZ = activeWall.posZ;
        if (hit.axis === 'x') {
          candX = this.initialWallPosX + moveX;
        } else {
          candZ = this.initialWallPosZ + moveZ;
        }

        const isHoriz = activeWall.rotationY === 0 || activeWall.rotationY === 180;
        const halfSpanX = isHoriz ? activeWall.length / 2 : activeWall.thickness / 2;
        const halfSpanZ = isHoriz ? activeWall.thickness / 2 : activeWall.length / 2;
        candX = Math.max(-(floorW / 2) + halfSpanX, Math.min((floorW / 2) - halfSpanX, candX));
        candZ = Math.max(-(floorD / 2) + halfSpanZ, Math.min((floorD / 2) - halfSpanZ, candZ));

        const snapRes = this.calculateWallToWallSnap(activeWall, candX, candZ, allWalls);
        if (snapRes.isSnapped) {
          candX = snapRes.snappedX;
          candZ = snapRes.snappedZ;
          this.renderWallToWallSnapGuide(snapRes);
        } else {
          this.clearWallSnapGuides();
        }

        this.updateLiveWallTransform(activeWall.id, candX, candZ);
        this.pendingWallUpdates = { wallId: activeWall.id, updates: { posX: candX, posZ: candZ } };
        this.requestRender(2);
      } else if (hit.type === 'wall_stretch') {
        const rotRad = -((activeWall.rotationY || 0) * (Math.PI / 180));
        const worldDx = dx * cos + dy * sin;
        const worldDz = -dx * sin + dy * cos;
        const proj = worldDx * Math.cos(rotRad) - worldDz * Math.sin(rotRad);
        const stretch = Math.round(proj / 50) * 50;
        const maxLen = Math.max(floorW, floorD);
        const nextL = Math.max(400, Math.min(maxLen, this.initialWallLength + stretch));
        const wallMesh = this.roomGroup.children.find(
          c => c.userData?.['isWall'] && (c.userData?.['wallId'] === activeWall.id || c.userData?.['wallType'] === activeWall.id)
        );
        if (wallMesh && this.initialWallLength > 0) {
          wallMesh.scale.x = nextL / this.initialWallLength;
        }
        this.pendingWallUpdates = { wallId: activeWall.id, updates: { length: nextL } };
        this.requestRender(2);
      } else if (hit.type === 'wall_stretch_height') {
        const vertDy = -(e.clientY - this.dragStartPointer.y) * 2.0;
        const stretchY = Math.round(vertDy / 10) * 10;
        const nextH = Math.max(400, Math.min(4500, this.initialWallHeight + stretchY));
        const wallMesh = this.roomGroup.children.find(
          c => c.userData?.['isWall'] && (c.userData?.['wallId'] === activeWall.id || c.userData?.['wallType'] === activeWall.id)
        );
        if (wallMesh && this.initialWallHeight > 0) {
          wallMesh.scale.y = nextH / this.initialWallHeight;
          wallMesh.position.y = nextH / 2;
        }
        this.pendingWallUpdates = { wallId: activeWall.id, updates: { height: nextH } };
        this.requestRender(2);
      }
      return;
    }

    // 0.05. Measurement Tape Live Dragging, 2-Click Preview & Magnetic Snapping
    if (this.isMeasureMode()) {
      if (!this.isMeasurementPersistent()) {
        const snapCand = this.findMagneticSnapCandidate(e.clientX, e.clientY, 32);
        this.updateMagneticSnapIndicator(snapCand);

        if (this.measurePointA()) {
          if (snapCand) {
            const resolvedB = this.resolveMeasurementPointB(snapCand, e.shiftKey);
            this.measurePointB.set(resolvedB);
          } else {
            const ptA = this.measurePointA()!;
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ptA.y);
            const intersectPt = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(plane, intersectPt)) {
              const fallbackCand = {
                worldPos: intersectPt,
                type: 'face' as const,
                objectName: 'Plano Horizontal'
              };
              const resolvedB = this.resolveMeasurementPointB(fallbackCand, e.shiftKey);
              this.measurePointB.set(resolvedB);
            }
          }
          this.renderMeasurementVisuals();
          return;
        }
      }
    }

    if (this.isDragging && this.activeGizmoHit && (this.dragInitialPart || this.dragInitialParts.length > 0)) {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.scratchCurrentIntersection)) {
        const deltaWorld = this.scratchDeltaWorld.subVectors(this.scratchCurrentIntersection, this.dragPlaneIntersectionStart);
        const hit = this.activeGizmoHit;
        const snap = 1; // 1 mm fine precision

        if (hit.type === 'axis') {
          if (this.dragInitialParts.length > 1) {
            // Calcular cota inferior inicial del grupo completo para no atravesar el piso (Y = 0)
            let initialGrpMinY = Infinity;
            for (const p of this.dragInitialParts) {
              const b = this.getPartBounds(p);
              if (b.minY < initialGrpMinY) initialGrpMinY = b.minY;
            }
            const minAllowedDy = -initialGrpMinY;

            let deltaX = 0;
            let deltaY = 0;
            let deltaZ = 0;

            if (hit.axis === 'x') {
              deltaX = Math.round(deltaWorld.x / snap) * snap;
            } else if (hit.axis === 'y') {
              deltaY = Math.max(minAllowedDy, Math.round(deltaWorld.y / snap) * snap);
            } else if (hit.axis === 'z') {
              deltaZ = Math.round(deltaWorld.z / snap) * snap;
            }

            if (this.isMagneticSnap() && this.trySmartFitDrawerGroupOnDrag(e, { dx: deltaX, dy: deltaY, dz: deltaZ })) {
              return;
            }

            if (this.isMagneticSnap()) {
              const externalParts = this.parts().filter(p => !this.dragInitialParts.some(dp => dp.id === p.id));
              if (externalParts.length > 0) {
                const groupSnap = this.calculateGroupMagneticSnap(
                  this.dragInitialParts,
                  externalParts,
                  { effDx: deltaX, effDy: deltaY, effDz: deltaZ },
                  38
                );
                if (groupSnap.isSnapped && groupSnap.snappedPair) {
                  if (hit.axis === 'x' && groupSnap.snappedX) deltaX = groupSnap.effDx;
                  if (hit.axis === 'y' && groupSnap.snappedY) deltaY = Math.max(minAllowedDy, groupSnap.effDy);
                  if (hit.axis === 'z' && groupSnap.snappedZ) deltaZ = groupSnap.effDz;
                  this.renderPartSnapGuides(
                    groupSnap.snappedPair.moving,
                    groupSnap.snappedPair.target,
                    groupSnap.snappedPair.snapFace,
                    groupSnap.snappedPair.axis,
                    groupSnap.snappedPair.pos
                  );
                } else {
                  this.clearPartSnapGuides();
                }
              }

              if ((hit.axis === 'x' || hit.axis === 'z') && this.workspaceMode() === 'room') {
                let grpMinX = Infinity, grpMaxX = -Infinity;
                let grpMinY = Infinity, grpMaxY = -Infinity;
                let grpMinZ = Infinity, grpMaxZ = -Infinity;

                for (const p of this.dragInitialParts) {
                  const pBounds = this.getPartBounds(p, {
                    x: (p.posX ?? 0) + deltaX,
                    y: (p.posY ?? 0) + deltaY,
                    z: (p.posZ ?? 0) + deltaZ
                  });
                  grpMinX = Math.min(grpMinX, pBounds.minX);
                  grpMaxX = Math.max(grpMaxX, pBounds.maxX);
                  grpMinY = Math.min(grpMinY, pBounds.minY);
                  grpMaxY = Math.max(grpMaxY, pBounds.maxY);
                  grpMinZ = Math.min(grpMinZ, pBounds.minZ);
                  grpMaxZ = Math.max(grpMaxZ, pBounds.maxZ);
                }

                const wallSnap = this.calculateWallSnap({
                  minX: grpMinX,
                  maxX: grpMaxX,
                  minY: grpMinY,
                  maxY: grpMaxY,
                  minZ: grpMinZ,
                  maxZ: grpMaxZ
                }, 45);

                if (hit.axis === 'z' && wallSnap.isSnappedZ) {
                  deltaZ += wallSnap.deltaZ;
                }
                if (hit.axis === 'x' && wallSnap.isSnappedX) {
                  deltaX += wallSnap.deltaX;
                }

                if (wallSnap.isSnappedX || wallSnap.isSnappedZ) {
                  this.lastSnappedWallResult = wallSnap;

                  // Auto-elevación inteligente por tipo de módulo contra la pared
                  const firstPart = this.dragInitialParts[0];
                  const grp = this.partGroups().find(g => g.id === firstPart.groupId);
                  const cat = grp?.parametricConfig?.category || grp?.parametricConfig?.moduleType;
                  let autoElevation: number | null = null;
                  if (cat === 'kitchen_wall' || cat === 'wall_cabinet') {
                    autoElevation = 1450;
                  } else if (cat === 'vanity') {
                    autoElevation = 450;
                  } else if (cat === 'kitchen_base' || cat === 'base_cabinet' || cat === 'closet' || cat === 'oven_base' || cat === 'sink_base') {
                    autoElevation = 0;
                  }

                  if (autoElevation !== null) {
                    const idealDy = autoElevation - initialGrpMinY;
                    if (Math.abs(deltaY - idealDy) <= 90 || Math.abs(deltaY) < 25) {
                      deltaY = idealDy;
                    }
                  }

                  this.renderWallSnapGuides(wallSnap);
                } else {
                  this.lastSnappedWallResult = null;
                  this.clearWallSnapGuides();
                }
              } else if (hit.axis === 'y') {
                const horizontalParts = this.dragInitialParts
                  .filter(p => p.orientation === 'horizontal')
                  .sort((a, b) => (a.posY ?? 0) - (b.posY ?? 0));
                const lowestPart = horizontalParts.length > 0 ? horizontalParts[0] : this.dragInitialParts[0];

                if (lowestPart) {
                  const testPos = {
                    x: (lowestPart.posX ?? 0) + deltaX,
                    y: (lowestPart.posY ?? 0) + deltaY,
                    z: (lowestPart.posZ ?? 0) + deltaZ
                  };
                  const legSnap = this.applyTableLegSnap(lowestPart, testPos);
                  if (legSnap.isSnapped && legSnap.snappedLeg) {
                    deltaY = Math.max(minAllowedDy, legSnap.pos.y - (lowestPart.posY ?? 0));
                    this.renderLegSnapGuides(legSnap.snappedLeg, lowestPart, legSnap.legTopY, legSnap.pos);
                  } else {
                    this.clearLegSnapGuides();
                  }
                }
              }
            } else {
              this.clearWallSnapGuides();
              this.clearLegSnapGuides();
              this.clearPartSnapGuides();
            }

            // Imán suave al suelo (Y = 0) y bloqueo estricto para no hundirse
            if (initialGrpMinY + deltaY < 18) {
              deltaY = minAllowedDy;
            }

            const updatesList: { part: Part; updates: Partial<Part> }[] = [];
            for (const p of this.dragInitialParts) {
              const pBounds = this.getPartBounds(p);
              const upd: Partial<Part> = {
                posX: Math.round((p.posX ?? 0) + deltaX),
                posY: Math.round((p.posY ?? pBounds.sy / 2) + deltaY),
                posZ: Math.round((p.posZ ?? 0) + deltaZ)
              };
              updatesList.push({ part: p, updates: upd });
            }

            const appUpdatesList: { id: string; updates: Partial<ApplianceItem> }[] = [];
            if (this.dragInitialSelectedAppliances.length > 0) {
              for (const a of this.dragInitialSelectedAppliances) {
                appUpdatesList.push({
                  id: a.id,
                  updates: {
                    position: {
                      x: Math.round(a.position.x + deltaX),
                      y: Math.max(0, Math.round(a.position.y + deltaY)),
                      z: Math.round(a.position.z + deltaZ)
                    }
                  }
                });
              }
            }
            this.previewPartUpdatesInPlace(updatesList, appUpdatesList);
          } else if (this.dragInitialPart) {
            const part = this.dragInitialPart;
            const initBounds = this.getPartBounds(part);
            const minPosY = initBounds.sy / 2;
            const updates: Partial<Part> = {};
            const targetPos = {
              x: part.posX ?? 0,
              y: Math.max(minPosY, part.posY ?? minPosY),
              z: part.posZ ?? 0
            };

            if (hit.axis === 'x') {
              const steppedDelta = Math.round(deltaWorld.x / snap) * snap;
              targetPos.x += steppedDelta;
              if (this.isMagneticSnap()) {
                const snapRes = this.applyMagneticSnapToPosition(part, targetPos, 'x', 38);
                targetPos.x = snapRes.pos.x;
                if (snapRes.isSnapped && snapRes.snappedPart) {
                  this.renderPartSnapGuides(part, snapRes.snappedPart, snapRes.snapFace, 'x', targetPos);
                } else {
                  this.clearPartSnapGuides();
                }

                const legSnap = this.applyTableLegSnap(part, targetPos, 'any', 30);
                if (legSnap.isSnapped && legSnap.snappedLeg) {
                  targetPos.x = legSnap.pos.x;
                  this.renderLegSnapGuides(legSnap.snappedLeg, part, legSnap.legTopY, targetPos);
                } else {
                  this.clearLegSnapGuides();
                }

                if (this.workspaceMode() === 'room') {
                  const pBounds = this.getPartBounds(part, targetPos);
                  const wallSnap = this.calculateWallSnap(pBounds, 45);
                  if (wallSnap.isSnappedX) {
                    targetPos.x += wallSnap.deltaX;
                    this.renderWallSnapGuides(wallSnap);
                  } else {
                    this.clearWallSnapGuides();
                  }
                } else {
                  this.clearWallSnapGuides();
                }
              } else {
                this.clearWallSnapGuides();
                this.clearLegSnapGuides();
                this.clearPartSnapGuides();
              }
              if (this.isInternalDivider(part) && !e.altKey && !e.shiftKey) {
                const limits = this.getDividerHorizontalLimits(part);
                if (Math.abs(targetPos.x - limits.centerSnapX) <= 15) {
                  targetPos.x = limits.centerSnapX;
                }
                targetPos.x = Math.max(limits.minAllowedX, Math.min(limits.maxAllowedX, targetPos.x));
              }
              updates.posX = Math.round(targetPos.x);
            } else if (hit.axis === 'y') {
              const steppedDelta = Math.round(deltaWorld.y / snap) * snap;
              targetPos.y = Math.max(minPosY, targetPos.y + steppedDelta);
              if (this.isInternalShelf(part) && !e.altKey) {
                const limits = this.getShelfVerticalLimits(part);
                if (Math.abs(targetPos.y - limits.centerSnapY) <= 15) {
                  targetPos.y = limits.centerSnapY;
                }
                targetPos.y = Math.max(limits.minAllowedY, Math.min(limits.maxAllowedY, targetPos.y));
                const cavity = this.partGeometry.getModuleCavityCenter(part, this.parts());
                if (cavity) {
                  targetPos.x = cavity.x;
                  targetPos.z = cavity.z;
                  updates.posX = cavity.x;
                  updates.posZ = cavity.z;
                }
                if (part.groupId) {
                  this.renderModuleInternalClearances(part.groupId, part, targetPos.y);
                }
              } else if (this.isInternalDivider(part) && !e.altKey) {
                targetPos.y = part.posY ?? minPosY;
              } else if (this.isMagneticSnap()) {
                const yDir: 'up' | 'down' | 'any' = steppedDelta > 1 ? 'up' : steppedDelta < -1 ? 'down' : 'any';
                let isLegSnapped = false;
                let isPartSnapped = false;

                if (yDir !== 'up') {
                  const legSnap = this.applyTableLegSnap(part, targetPos, yDir, 30);
                  if (legSnap.isSnapped && legSnap.snappedLeg) {
                    targetPos.y = Math.max(minPosY, legSnap.pos.y);
                    this.renderLegSnapGuides(legSnap.snappedLeg, part, legSnap.legTopY, targetPos);
                    isLegSnapped = true;
                    this.clearPartSnapGuides();
                  }
                }

                if (!isLegSnapped) {
                  const snapRes = this.applyMagneticSnapToPosition(part, targetPos, 'y', 38, [], yDir);
                  if (snapRes.isSnapped && snapRes.snappedPart) {
                    targetPos.y = Math.max(minPosY, snapRes.pos.y);
                    this.renderPartSnapGuides(part, snapRes.snappedPart, snapRes.snapFace, 'y', targetPos);
                    isPartSnapped = true;
                  }
                  this.clearLegSnapGuides();
                }

                if (!isLegSnapped && !isPartSnapped) {
                  if (targetPos.y - minPosY <= 18) {
                    targetPos.y = minPosY;
                  }
                  this.clearLegSnapGuides();
                  this.clearPartSnapGuides();
                }
              } else {
                this.clearLegSnapGuides();
                this.clearPartSnapGuides();
              }
              updates.posY = Math.round(Math.max(minPosY, targetPos.y));
              this.clearWallSnapGuides();
            } else if (hit.axis === 'z') {
              const steppedDelta = Math.round(deltaWorld.z / snap) * snap;
              targetPos.z += steppedDelta;
              if (this.isMagneticSnap()) {
                const snapRes = this.applyMagneticSnapToPosition(part, targetPos, 'z', 38);
                targetPos.z = snapRes.pos.z;
                if (snapRes.isSnapped && snapRes.snappedPart) {
                  this.renderPartSnapGuides(part, snapRes.snappedPart, snapRes.snapFace, 'z', targetPos);
                } else {
                  this.clearPartSnapGuides();
                }

                const legSnap = this.applyTableLegSnap(part, targetPos, 'any', 30);
                if (legSnap.isSnapped && legSnap.snappedLeg) {
                  targetPos.z = legSnap.pos.z;
                  this.renderLegSnapGuides(legSnap.snappedLeg, part, legSnap.legTopY, targetPos);
                } else {
                  this.clearLegSnapGuides();
                }

                if (this.workspaceMode() === 'room') {
                  const pBounds = this.getPartBounds(part, targetPos);
                  const wallSnap = this.calculateWallSnap(pBounds, 45);
                  if (wallSnap.isSnappedZ) {
                    targetPos.z += wallSnap.deltaZ;
                    this.renderWallSnapGuides(wallSnap);
                  } else {
                    this.clearWallSnapGuides();
                  }
                } else {
                  this.clearWallSnapGuides();
                }
              } else {
                this.clearWallSnapGuides();
                this.clearLegSnapGuides();
                this.clearPartSnapGuides();
              }
              updates.posZ = Math.round(targetPos.z);
            }

            this.previewPartUpdatesInPlace([{ part, updates }]);
          }
        } else if ((hit.type === 'handle' || hit.type === 'corner_handle') && this.dragInitialPart) {
          // Estiramiento directo desde Arista Continua (handle) o Esquina/Vértice (corner_handle)
          const part = this.dragInitialPart;
          const updates: Partial<Part> = {};
          const axesCfg = this.getPartStretchAxesConfig(part);

          if (hit.type === 'corner_handle') {
            const axisL = hit.lengthAxis || axesCfg.lengthAxis;
            const posAxisL = hit.posAxisL || axesCfg.lengthPosAxis;
            const axisW = hit.widthAxis || axesCfg.widthAxis;
            const posAxisW = hit.posAxisW || axesCfg.widthPosAxis;
            const dirL = hit.dir;
            const dirW = hit.dirW ?? 1;

            const rawDeltaL = deltaWorld[axisL] * dirL;
            const rawDeltaW = deltaWorld[axisW] * dirW;

            let steppedDeltaL = Math.round(rawDeltaL / snap) * snap;
            let steppedDeltaW = Math.round(rawDeltaW / snap) * snap;

            // Zona muerta inteligente: si el usuario estira desde una esquina en línea recta sobre un eje,
            // evita la deriva accidental de 1-2 mm en el eje perpendicular
            if (Math.abs(rawDeltaL) > 5 && Math.abs(rawDeltaW) < 3) {
              steppedDeltaW = 0;
            } else if (Math.abs(rawDeltaW) > 5 && Math.abs(rawDeltaL) < 3) {
              steppedDeltaL = 0;
            }

            const resL = this.applyMagneticSnapToStretch(part, 'length', posAxisL, dirL, steppedDeltaL);
            const resW = this.applyMagneticSnapToStretch(part, 'width', posAxisW, dirW, steppedDeltaW);

            updates.length = resL.dim;
            updates[posAxisL] = resL.pos;
            updates.width = resW.dim;
            updates[posAxisW] = resW.pos;

            if (this.dynamicEdgeHandleMesh && hit.worldHitPos) {
              this.dynamicEdgeHandleMesh.visible = true;
              this.dynamicEdgeHandleMesh.position.copy(hit.worldHitPos);
              this.dynamicEdgeHandleMesh.position[axisL] += (resL.dim - part.length) * dirL;
              this.dynamicEdgeHandleMesh.position[axisW] += (resW.dim - part.width) * dirW;
            }

            if (resL.isSnapped && resL.snappedPart && resL.snapFace !== null && resL.snapFace !== undefined) {
              const previewPart = { ...part, ...updates };
              this.renderPartSnapGuides(previewPart, resL.snappedPart, resL.snapFace, axisL, {
                x: previewPart.posX ?? 0,
                y: previewPart.posY ?? 0,
                z: previewPart.posZ ?? 0
              });
            } else if (resW.isSnapped && resW.snappedPart && resW.snapFace !== null && resW.snapFace !== undefined) {
              const previewPart = { ...part, ...updates };
              this.renderPartSnapGuides(previewPart, resW.snappedPart, resW.snapFace, axisW, {
                x: previewPart.posX ?? 0,
                y: previewPart.posY ?? 0,
                z: previewPart.posZ ?? 0
              });
            } else {
              this.clearPartSnapGuides();
            }
          } else if (hit.handleTarget === 'length') {
            const axis = hit.lengthAxis || axesCfg.lengthAxis;
            const posAxis = hit.posAxisL || axesCfg.lengthPosAxis;
            const axisDelta = deltaWorld[axis] * hit.dir;
            const steppedDelta = Math.round(axisDelta / snap) * snap;
            const res = this.applyMagneticSnapToStretch(part, 'length', posAxis, hit.dir, steppedDelta);
            updates.length = res.dim;
            updates[posAxis] = res.pos;

            if (this.dynamicEdgeHandleMesh && hit.worldHitPos) {
              this.dynamicEdgeHandleMesh.visible = true;
              this.dynamicEdgeHandleMesh.position.copy(hit.worldHitPos);
              this.dynamicEdgeHandleMesh.position[axis] += (res.dim - part.length) * hit.dir;
            }

            if (res.isSnapped && res.snappedPart && res.snapFace !== null && res.snapFace !== undefined) {
              const previewPart = { ...part, ...updates };
              this.renderPartSnapGuides(previewPart, res.snappedPart, res.snapFace, axis, {
                x: previewPart.posX ?? 0,
                y: previewPart.posY ?? 0,
                z: previewPart.posZ ?? 0
              });
            } else {
              this.clearPartSnapGuides();
            }
          } else if (hit.handleTarget === 'width') {
            const axis = hit.widthAxis || axesCfg.widthAxis;
            const posAxis = hit.posAxisW || axesCfg.widthPosAxis;
            const axisDelta = deltaWorld[axis] * hit.dir;
            const steppedDelta = Math.round(axisDelta / snap) * snap;
            const res = this.applyMagneticSnapToStretch(part, 'width', posAxis, hit.dir, steppedDelta);
            updates.width = res.dim;
            updates[posAxis] = res.pos;

            if (this.dynamicEdgeHandleMesh && hit.worldHitPos) {
              this.dynamicEdgeHandleMesh.visible = true;
              this.dynamicEdgeHandleMesh.position.copy(hit.worldHitPos);
              this.dynamicEdgeHandleMesh.position[axis] += (res.dim - part.width) * hit.dir;
            }

            if (res.isSnapped && res.snappedPart && res.snapFace !== null && res.snapFace !== undefined) {
              const previewPart = { ...part, ...updates };
              this.renderPartSnapGuides(previewPart, res.snappedPart, res.snapFace, axis, {
                x: previewPart.posX ?? 0,
                y: previewPart.posY ?? 0,
                z: previewPart.posZ ?? 0
              });
            } else {
              this.clearPartSnapGuides();
            }
          }

          this.previewPartUpdatesInPlace([{ part, updates }]);
        }
      }
      return;
    }

    // Direct Piece/Group Dragging (click & drag any piece or module surface)
    if (this.isDirectPieceDrag && (this.dragInitialPart || this.dragInitialParts.length > 0)) {
      const distFromStart = Math.hypot(e.clientX - this.dragStartPointer.x, e.clientY - this.dragStartPointer.y);
      if (!this.directPieceDragThresholdPassed && distFromStart > 4) {
        this.directPieceDragThresholdPassed = true;
        this.ngZone.run(() => this.dragStarted.emit());
        this.controls.enabled = false;
        canvas.style.cursor = 'grabbing';
      }

      if (this.directPieceDragThresholdPassed) {
        const rect = canvas.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const hasPlaneHit = !!this.raycaster.ray.intersectPlane(this.dragPlane, this.scratchCurrentIntersection);
        const isInternalRailPiece = !!(
          this.dragInitialPart &&
          (this.isInternalShelf(this.dragInitialPart) || this.isInternalDivider(this.dragInitialPart)) &&
          !e.altKey &&
          !e.shiftKey
        );

        if (hasPlaneHit || isInternalRailPiece) {
          const deltaWorld = hasPlaneHit
            ? this.scratchDeltaWorld.subVectors(this.scratchCurrentIntersection, this.dragPlaneIntersectionStart)
            : this.scratchDeltaWorld.set(0, 0, 0);
          const snap = 1; // 1 mm CAD precision
          const dx = Math.round(deltaWorld.x / snap) * snap;
          const dy = Math.round(deltaWorld.y / snap) * snap;
          const dz = Math.round(deltaWorld.z / snap) * snap;

          if (this.dragInitialParts.length > 1) {
            // Calcular la base inferior más baja del grupo/módulo para impedir que atraviese el suelo (Y = 0)
            let initialGrpMinY = Infinity;
            for (const p of this.dragInitialParts) {
              const b = this.getPartBounds(p);
              if (b.minY < initialGrpMinY) initialGrpMinY = b.minY;
            }
            const minAllowedDy = -initialGrpMinY;

            let effDx = dx;
            let effDy = Math.max(minAllowedDy, dy);
            let effDz = dz;

            if (this.isMagneticSnap() && this.trySmartFitDrawerGroupOnDrag(e, { dx: effDx, dy: effDy, dz: effDz })) {
              return;
            }

            if (this.isMagneticSnap()) {
              // 1. Imán inteligente entre este módulo/grupo y cualquier otra pieza o módulo externo
              const externalParts = this.parts().filter(p => !this.dragInitialParts.some(dp => dp.id === p.id));
              let groupSnapped = false;
              if (externalParts.length > 0) {
                const groupSnap = this.calculateGroupMagneticSnap(
                  this.dragInitialParts,
                  externalParts,
                  { effDx, effDy, effDz },
                  38
                );
                if (groupSnap.isSnapped && groupSnap.snappedPair) {
                  effDx = groupSnap.effDx;
                  effDy = Math.max(minAllowedDy, groupSnap.effDy);
                  effDz = groupSnap.effDz;
                  groupSnapped = true;
                  this.renderPartSnapGuides(
                    groupSnap.snappedPair.moving,
                    groupSnap.snappedPair.target,
                    groupSnap.snappedPair.snapFace,
                    groupSnap.snappedPair.axis,
                    groupSnap.snappedPair.pos
                  );
                } else {
                  this.clearPartSnapGuides();
                }
              } else {
                this.clearPartSnapGuides();
              }

              // 2. Imán sobre patas de mesa (si existen)
              const horizontalParts = this.dragInitialParts
                .filter(p => p.orientation === 'horizontal')
                .sort((a, b) => (a.posY ?? 0) - (b.posY ?? 0));
              const lowestPart = horizontalParts.length > 0 ? horizontalParts[0] : this.dragInitialParts[0];

              if (lowestPart) {
                const testPos = {
                  x: (lowestPart.posX ?? 0) + effDx,
                  y: (lowestPart.posY ?? 0) + effDy,
                  z: (lowestPart.posZ ?? 0) + effDz
                };
                const legSnap = this.applyTableLegSnap(lowestPart, testPos, dy > 1 ? 'up' : dy < -1 ? 'down' : 'any', 30);
                if (legSnap.isSnapped && legSnap.snappedLeg) {
                  effDy = Math.max(minAllowedDy, legSnap.pos.y - (lowestPart.posY ?? 0));
                  if (legSnap.pos.x !== testPos.x) effDx = legSnap.pos.x - (lowestPart.posX ?? 0);
                  if (legSnap.pos.z !== testPos.z) effDz = legSnap.pos.z - (lowestPart.posZ ?? 0);
                  this.renderLegSnapGuides(legSnap.snappedLeg, lowestPart, legSnap.legTopY, legSnap.pos);
                  if (groupSnapped) this.clearPartSnapGuides();
                } else if (!groupSnapped) {
                  this.clearLegSnapGuides();
                }
              }

              // 3. Imán inteligente a paredes (SOLO activo en Modo Habitación 3D)
              if (this.workspaceMode() === 'room') {
                let grpMinX = Infinity, grpMaxX = -Infinity;
                let grpMinY = Infinity, grpMaxY = -Infinity;
                let grpMinZ = Infinity, grpMaxZ = -Infinity;

                for (const p of this.dragInitialParts) {
                  const pBounds = this.getPartBounds(p, {
                    x: (p.posX ?? 0) + effDx,
                    y: (p.posY ?? 0) + effDy,
                    z: (p.posZ ?? 0) + effDz
                  });
                  grpMinX = Math.min(grpMinX, pBounds.minX);
                  grpMaxX = Math.max(grpMaxX, pBounds.maxX);
                  grpMinY = Math.min(grpMinY, pBounds.minY);
                  grpMaxY = Math.max(grpMaxY, pBounds.maxY);
                  grpMinZ = Math.min(grpMinZ, pBounds.minZ);
                  grpMaxZ = Math.max(grpMaxZ, pBounds.maxZ);
                }

                const wallSnap = this.calculateWallSnap({
                  minX: grpMinX,
                  maxX: grpMaxX,
                  minY: grpMinY,
                  maxY: grpMaxY,
                  minZ: grpMinZ,
                  maxZ: grpMaxZ
                }, 45);

                if (wallSnap.isSnappedZ) {
                  effDz += wallSnap.deltaZ;
                }
                if (wallSnap.isSnappedX) {
                  effDx += wallSnap.deltaX;
                }

                if (wallSnap.isSnappedX || wallSnap.isSnappedZ) {
                  this.lastSnappedWallResult = wallSnap;

                  // Auto-elevación inteligente por tipo de módulo contra la pared
                  const firstPart = this.dragInitialParts[0];
                  const grp = this.partGroups().find(g => g.id === firstPart.groupId);
                  const cat = grp?.parametricConfig?.category || grp?.parametricConfig?.moduleType;
                  let autoElevation: number | null = null;
                  if (cat === 'kitchen_wall' || cat === 'wall_cabinet') {
                    autoElevation = 1450;
                  } else if (cat === 'vanity') {
                    autoElevation = 450;
                  } else if (cat === 'kitchen_base' || cat === 'base_cabinet' || cat === 'closet' || cat === 'oven_base' || cat === 'sink_base') {
                    autoElevation = 0;
                  }

                  if (autoElevation !== null) {
                    const idealDy = autoElevation - initialGrpMinY;
                    if (Math.abs(effDy - idealDy) <= 90 || Math.abs(effDy) < 25) {
                      effDy = idealDy;
                    }
                  }

                  this.renderWallSnapGuides(wallSnap);
                } else {
                  this.lastSnappedWallResult = null;
                  this.clearWallSnapGuides();
                }
              } else {
                this.clearWallSnapGuides();
              }

              // Imán suave al suelo (Y = 0) si está a menos de 18mm del piso
              if (initialGrpMinY + effDy <= 18) {
                effDy = minAllowedDy;
              }
            } else {
              this.clearWallSnapGuides();
              this.clearLegSnapGuides();
              this.clearPartSnapGuides();
            }

            // Bloqueo absoluto de piso en bloque (preserva el ensamble interno del módulo)
            effDy = Math.max(minAllowedDy, effDy);

            const updatesList: { part: Part; updates: Partial<Part> }[] = [];
            for (const p of this.dragInitialParts) {
              const pBounds = this.getPartBounds(p);
              const upd: Partial<Part> = {
                posX: Math.round((p.posX ?? 0) + effDx),
                posY: Math.round((p.posY ?? pBounds.sy / 2) + effDy),
                posZ: Math.round((p.posZ ?? 0) + effDz)
              };
              updatesList.push({ part: p, updates: upd });
            }

            const appUpdatesList: { id: string; updates: Partial<ApplianceItem> }[] = [];
            if (this.dragInitialSelectedAppliances.length > 0) {
              for (const a of this.dragInitialSelectedAppliances) {
                appUpdatesList.push({
                  id: a.id,
                  updates: {
                    position: {
                      x: Math.round(a.position.x + effDx),
                      y: Math.max(0, Math.round(a.position.y + effDy)),
                      z: Math.round(a.position.z + effDz)
                    }
                  }
                });
              }
            }
            this.previewPartUpdatesInPlace(updatesList, appUpdatesList);
          } else if (this.dragInitialPart) {
            // Arrastre de Pieza Individual con bloqueo estricto de suelo (minY >= 0) e imán entre piezas y muros
            const part = this.dragInitialPart;
            const isShelf = this.isInternalShelf(part);
            const isDivider = this.isInternalDivider(part);

            const dxScreen = Math.abs(e.clientX - this.dragStartPointer.x);
            const dyScreen = Math.abs(e.clientY - this.dragStartPointer.y);
            const isEscaped = e.altKey || (e.shiftKey && dxScreen > 15) || (dxScreen > 45 && dxScreen > dyScreen * 1.8);

            if (isShelf && !isEscaped) {
              let candY = part.posY ?? 0;
              if (hasPlaneHit) {
                const deltaY = this.scratchCurrentIntersection.y - this.dragPlaneIntersectionStart.y;
                candY = (part.posY ?? 0) + deltaY;
              } else {
                const dyFallback = -(e.clientY - this.dragStartPointer.y) * 1.5;
                candY = (part.posY ?? 0) + dyFallback;
              }

              const limits = this.getShelfVerticalLimits(part);
              const step = e.shiftKey ? 1 : 5;
              if (Math.abs(candY - limits.centerSnapY) <= 15) {
                candY = limits.centerSnapY;
              } else {
                candY = Math.round(candY / step) * step;
              }
              candY = Math.max(limits.minAllowedY, Math.min(limits.maxAllowedY, candY));

              const cavity = this.partGeometry.getModuleCavityCenter(part, this.parts());
              const targetPos = {
                x: cavity ? cavity.x : (part.posX ?? 0),
                y: Math.round(candY),
                z: cavity ? cavity.z : (part.posZ ?? 0)
              };

              const updates: Partial<Part> = {
                posX: targetPos.x,
                posY: targetPos.y,
                posZ: targetPos.z
              };

              this.clearPartSnapGuides();
              this.clearLegSnapGuides();
              this.clearWallSnapGuides();

              this.previewPartUpdatesInPlace([{ part, updates }]);
              this.renderModuleInternalClearances(part.groupId!, part, targetPos.y);
              this.requestRender(2);
              return;
            }

            if (isDivider && !isEscaped) {
              let candX = part.posX ?? 0;
              if (hasPlaneHit) {
                const deltaX = this.scratchCurrentIntersection.x - this.dragPlaneIntersectionStart.x;
                candX = (part.posX ?? 0) + deltaX;
              } else {
                const dxFallback = (e.clientX - this.dragStartPointer.x) * 1.5;
                candX = (part.posX ?? 0) + dxFallback;
              }

              const limits = this.getDividerHorizontalLimits(part);
              const step = e.shiftKey ? 1 : 5;
              if (Math.abs(candX - limits.centerSnapX) <= 15) {
                candX = limits.centerSnapX;
              } else {
                candX = Math.round(candX / step) * step;
              }
              candX = Math.max(limits.minAllowedX, Math.min(limits.maxAllowedX, candX));

              const targetPos = {
                x: Math.round(candX),
                y: part.posY ?? 0,
                z: part.posZ ?? 0
              };

              const updates: Partial<Part> = {
                posX: targetPos.x,
                posY: targetPos.y,
                posZ: targetPos.z
              };

              this.clearPartSnapGuides();
              this.clearLegSnapGuides();
              this.clearWallSnapGuides();

              this.previewPartUpdatesInPlace([{ part, updates }]);
              this.renderModuleInternalClearances(part.groupId!);
              this.requestRender(2);
              return;
            }

            const initBounds = this.getPartBounds(part);
            const minPosY = initBounds.sy / 2;

            const targetPos = {
              x: (part.posX ?? 0) + dx,
              y: Math.max(minPosY, (part.posY ?? minPosY) + dy),
              z: (part.posZ ?? 0) + dz
            };

            if (this.isMagneticSnap()) {
              const yDir: 'up' | 'down' | 'any' = dy > 1 ? 'up' : dy < -1 ? 'down' : 'any';

              const snapResX = this.applyMagneticSnapToPosition(part, targetPos, 'x', 38);
              targetPos.x = snapResX.pos.x;

              const snapResZ = this.applyMagneticSnapToPosition(part, targetPos, 'z', 38);
              targetPos.z = snapResZ.pos.z;

              let snappedYPart: Part | null = null;
              let snappedYFace: number | null = null;
              let isSnappedY = false;
              let isLegSnapped = false;
              let snappedLegItem: ApplianceItem | null = null;
              let legTopElevation = 0;

              if (yDir !== 'up') {
                const legSnap = this.applyTableLegSnap(part, targetPos, yDir, 30);
                if (legSnap.isSnapped && legSnap.snappedLeg) {
                  targetPos.y = Math.max(minPosY, legSnap.pos.y);
                  isLegSnapped = true;
                  snappedLegItem = legSnap.snappedLeg;
                  legTopElevation = legSnap.legTopY;
                }
              }

              if (!isLegSnapped) {
                const snapResY = this.applyMagneticSnapToPosition(part, targetPos, 'y', 38, [], yDir);
                if (snapResY.isSnapped && snapResY.snappedPart) {
                  targetPos.y = Math.max(minPosY, snapResY.pos.y);
                  snappedYPart = snapResY.snappedPart;
                  snappedYFace = snapResY.snapFace;
                  isSnappedY = true;
                } else if (targetPos.y - minPosY <= 18) {
                  targetPos.y = minPosY;
                }
              }

              // Guías visuales de contacto magnético entre piezas o patas
              if (isLegSnapped && snappedLegItem) {
                this.renderLegSnapGuides(snappedLegItem, part, legTopElevation, targetPos);
                this.clearPartSnapGuides();
              } else {
                this.clearLegSnapGuides();
                if (snapResX.isSnapped && snapResX.snappedPart) {
                  this.renderPartSnapGuides(part, snapResX.snappedPart, snapResX.snapFace, 'x', targetPos);
                } else if (snapResZ.isSnapped && snapResZ.snappedPart) {
                  this.renderPartSnapGuides(part, snapResZ.snappedPart, snapResZ.snapFace, 'z', targetPos);
                } else if (isSnappedY && snappedYPart) {
                  this.renderPartSnapGuides(part, snappedYPart, snappedYFace, 'y', targetPos);
                } else {
                  this.clearPartSnapGuides();
                }
              }

              // Imán de paredes (SOLO activo en Modo Habitación 3D)
              if (this.workspaceMode() === 'room') {
                const partBounds = this.getPartBounds(part, targetPos);
                const wallSnap = this.calculateWallSnap(partBounds, 45);
                if (wallSnap.isSnappedZ) {
                  targetPos.z += wallSnap.deltaZ;
                }
                if (wallSnap.isSnappedX) {
                  targetPos.x += wallSnap.deltaX;
                }
                if (wallSnap.isSnappedX || wallSnap.isSnappedZ) {
                  this.renderWallSnapGuides(wallSnap);
                } else {
                  this.clearWallSnapGuides();
                }
              } else {
                this.clearWallSnapGuides();
              }
            } else {
              this.clearWallSnapGuides();
              this.clearLegSnapGuides();
              this.clearPartSnapGuides();
            }

            // Garantía final de no sobrepasar el suelo (minY >= 0)
            targetPos.y = Math.max(minPosY, targetPos.y);

            const updates: Partial<Part> = {
              posX: Math.round(targetPos.x),
              posY: Math.round(targetPos.y),
              posZ: Math.round(targetPos.z)
            };
            this.previewPartUpdatesInPlace([{ part, updates }]);
          }
        }
        return;
      }
    }

    // Skip hover raycasting while orbiting/panning the camera or if throttled (<15ms / ~60Hz)
    if (this.isCameraInteracting) return;
    const nowPerf = performance.now();
    if (nowPerf - this.lastHoverRaycastTime < 15) return;
    this.lastHoverRaycastTime = nowPerf;

    // Hover cursor updates when not dragging

    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Hover feedback for 3D Editable Dimension Badges
    if (this.editableDimensionSprites.length > 0) {
      const dimIntersects = this.raycaster.intersectObjects(this.editableDimensionSprites, false);
      if (dimIntersects.length > 0) {
        this.setHoveredGizmoMesh(null);
        this.hideDynamicEdgeHandle();
        this.setHoveredDimensionSprite(dimIntersects[0].object as THREE.Sprite);
        canvas.style.cursor = 'pointer';
        return;
      }
    }
    this.setHoveredDimensionSprite(null);

    if (this.gizmoHitMeshes.length > 0) {
      const gizmoIntersects = this.raycaster.intersectObjects(this.gizmoHitMeshes, true);
      if (gizmoIntersects.length > 0) {
        this.hideDynamicEdgeHandle();
        const hitMesh = gizmoIntersects[0].object as THREE.Mesh;
        this.setHoveredGizmoMesh(hitMesh);
        const hit = hitMesh.userData as GizmoHitData;
        if (hit.type === 'axis') {
          canvas.style.cursor = 'grab';
        } else if (hit.cursor) {
          canvas.style.cursor = hit.cursor;
        } else {
          canvas.style.cursor = hit.handleTarget === 'length' ? 'ew-resize' : 'ns-resize';
        }
        return;
      }
    }
    this.setHoveredGizmoMesh(null);

    // Detección matemática de esquinas (vértices) y cualquier tramo continuo de arista de la pieza seleccionada
    const edgeOrCornerHit = this.detectSelectedPartEdgeOrCornerHover(e.clientX, e.clientY);
    if (edgeOrCornerHit) {
      canvas.style.cursor = edgeOrCornerHit.cursor || 'ew-resize';
      return;
    }

    // Hover feedback for 3D Wall Gizmo (Move, Length, Height)
    if (this.workspaceMode() === 'room' && this.wallGizmoHitMeshes.length > 0) {
      const wallGizmoIntersects = this.raycaster.intersectObjects(this.wallGizmoHitMeshes, true);
      if (wallGizmoIntersects.length > 0) {
        const hit = wallGizmoIntersects[0].object.userData as { type?: string };
        if (hit.type === 'wall_stretch_height') {
          canvas.style.cursor = 'ns-resize';
        } else if (hit.type === 'wall_stretch') {
          canvas.style.cursor = 'ew-resize';
        } else {
          canvas.style.cursor = 'grab';
        }
        return;
      }
    }

    // Hover feedback for 3D appliance resize handles
    if (this.applianceHandleHitMeshes.length > 0) {
      const handleIntersects = this.raycaster.intersectObjects(this.applianceHandleHitMeshes, true);
      if (handleIntersects.length > 0) {
        const hit = handleIntersects[0].object.userData;
        if (hit && hit['axis'] === 'x') {
          canvas.style.cursor = 'ew-resize';
        } else if (hit && hit['axis'] === 'y') {
          canvas.style.cursor = 'ns-resize';
        } else {
          canvas.style.cursor = 'nwse-resize';
        }
        return;
      }
    }

    // Hover feedback for appliances
    if (this.appliancesGroup.children.length > 0) {
      const appIntersects = this.raycaster.intersectObjects(this.appliancesGroup.children, true);
      if (appIntersects.length > 0) {
        canvas.style.cursor = 'grab';
        return;
      }
    }

    const pieceIntersects = this.raycaster.intersectObjects(
      this.raycastablePieceMeshes,
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

  /**
   * Actualiza matrices de posición y escala en tiempo real (60 FPS) durante el arrastre o estiramiento
   * sin reconstruir la escena 3D completa ni serializar el proyecto en cada píxel de movimiento.
   */
  private previewPartUpdatesInPlace(
    partUpdates: { part: Part; updates: Partial<Part> }[],
    appUpdates: { id: string; updates: Partial<ApplianceItem> }[] = [],
    primaryAppUpdate: { appliance: ApplianceItem; updates: Partial<ApplianceItem> } | null = null
  ) {
    let singleMovedDelta: THREE.Vector3 | null = null;
    let singleStretchedPart: { part: Part; px: number; py: number; pz: number; sx: number; sy: number; sz: number } | null = null;

    for (const entry of partUpdates) {
      this.liveDragPartUpdates.set(entry.part.id, entry);
      const item = this.pieceObjectMap.get(entry.part.id);
      if (!item) continue;

      const updatedPart: Part = { ...item.part, ...entry.updates };
      item.part = updatedPart;
      item.mesh.userData['part'] = updatedPart;

      const b = this.getPartBounds(updatedPart);
      const dx = b.px - item.originalPos.x;
      const dy = b.py - item.originalPos.y;
      const dz = b.pz - item.originalPos.z;
      item.originalPos.set(b.px, b.py, b.pz);

      if (item.doorPivot) {
        item.doorPivot.position.x += dx;
        item.doorPivot.position.y += dy;
        item.doorPivot.position.z += dz;
      } else {
        item.mesh.position.x += dx;
        item.mesh.position.y += dy;
        item.mesh.position.z += dz;
      }

      const isDimensionChanged =
        entry.updates.length !== undefined ||
        entry.updates.width !== undefined ||
        entry.updates.thickness !== undefined ||
        entry.updates.orientation !== undefined;

      if (isDimensionChanged) {
        const localDims = this.partGeometry.getLocalDimensions(updatedPart);
        let newBoxGeo: THREE.BufferGeometry;
        let newEdgesGeo: THREE.EdgesGeometry;

        if (updatedPart.cornerCutConfig || (updatedPart.shapeType === 'freehand' && updatedPart.contourPoints && updatedPart.contourPoints.length >= 3)) {
          newBoxGeo = this.partGeometry.buildExtrudedBoardGeometry(updatedPart);
          newEdgesGeo = new THREE.EdgesGeometry(newBoxGeo);
        } else if (updatedPart.shapeType === 'circle') {
          const radius = updatedPart.radius || (updatedPart.diameter ? updatedPart.diameter / 2 : Math.max(10, (updatedPart.width || 600) / 2));
          const cylHeight = (updatedPart.length && updatedPart.length > updatedPart.thickness) ? updatedPart.length : (updatedPart.thickness || 15);
          const cylKey = `piece_cyl_${radius}_${cylHeight}`;
          newBoxGeo = this.getSharedGeometry(cylKey, () => new THREE.CylinderGeometry(radius, radius, cylHeight, 48));
          newEdgesGeo = this.getSharedGeometry(`${cylKey}_edges`, () => new THREE.EdgesGeometry(newBoxGeo));
        } else {
          const newGeoKey = `piece_box_${localDims.sx}_${localDims.sy}_${localDims.sz}`;
          newBoxGeo = this.getSharedGeometry(newGeoKey, () => new THREE.BoxGeometry(localDims.sx, localDims.sy, localDims.sz));
          newEdgesGeo = this.getSharedGeometry(`${newGeoKey}_edges`, () => new THREE.EdgesGeometry(newBoxGeo));
        }

        item.mesh.geometry = newBoxGeo;
        for (const child of item.mesh.children) {
          if (child instanceof THREE.LineSegments) {
            child.geometry = newEdgesGeo;
          }
        }
        if (partUpdates.length === 1) {
          singleStretchedPart = { part: updatedPart, px: b.px, py: b.py, pz: b.pz, sx: b.sx, sy: b.sy, sz: b.sz };
        }
      } else if (partUpdates.length === 1) {
        singleMovedDelta = this.scratchSingleMovedDelta.set(dx, dy, dz);
      }
    }

    if (singleStretchedPart) {
      const dynWasVisible = !!this.dynamicEdgeHandleMesh?.visible;
      if (dynWasVisible && this.dynamicEdgeHandleMesh) {
        this.scratchClosestWorld.copy(this.dynamicEdgeHandleMesh.position);
      }
      this.disposeGroup(this.dimensionGroup);
      this.disposeGroup(this.gizmoGroup);
      this.gizmoHitMeshes = [];
      if (this.show3dDimensions()) {
        this.renderPieceDimensions(
          singleStretchedPart.part,
          singleStretchedPart.px,
          singleStretchedPart.py,
          singleStretchedPart.pz,
          singleStretchedPart.sx,
          singleStretchedPart.sy,
          singleStretchedPart.sz
        );
      }
      if (this.activeTool() === 'move' || this.activeTool() === 'select') {
        this.buildGizmo(
          singleStretchedPart.part,
          singleStretchedPart.px,
          singleStretchedPart.py,
          singleStretchedPart.pz,
          singleStretchedPart.sx,
          singleStretchedPart.sy,
          singleStretchedPart.sz
        );
        if (dynWasVisible && this.dynamicEdgeHandleMesh) {
          this.dynamicEdgeHandleMesh.position.copy(this.scratchClosestWorld);
          this.dynamicEdgeHandleMesh.visible = true;
          this.updateAdaptiveGizmoScale();
        }
      }
    } else if (singleMovedDelta) {
      for (const child of this.gizmoGroup.children) {
        child.position.add(singleMovedDelta);
      }
      for (const child of this.dimensionGroup.children) {
        child.position.add(singleMovedDelta);
      }
      if (partUpdates.length === 1 && !this.isInternalShelf(partUpdates[0].part)) {
        this.internalClearanceGroup.position.add(singleMovedDelta);
      }
    } else if (partUpdates.length > 1 && this.internalClearanceGroup.children.length > 0) {
      const first = partUpdates[0];
      const dx = (first.updates.posX ?? first.part.posX ?? 0) - (first.part.posX ?? 0);
      const dy = (first.updates.posY ?? first.part.posY ?? 0) - (first.part.posY ?? 0);
      const dz = (first.updates.posZ ?? first.part.posZ ?? 0) - (first.part.posZ ?? 0);
      this.internalClearanceGroup.position.set(dx, dy, dz);
    }

    if (primaryAppUpdate) {
      this.liveDragPrimaryApplianceUpdate = primaryAppUpdate;
      const newPos = primaryAppUpdate.updates.position;
      if (newPos) {
        const app = primaryAppUpdate.appliance;
        const visualBaseY =
          app.type === 'sink' && newPos.y >= 500
            ? newPos.y - app.height + 8
            : (app.type === 'cooktop' && newPos.y >= 500)
              ? newPos.y - app.height + 14
              : newPos.y;
        for (const child of this.appliancesGroup.children) {
          const cId = child.userData?.['appliance']?.id || child.userData?.['applianceId'];
          if (cId === app.id) {
            const dx = newPos.x - child.position.x;
            const dy = visualBaseY - child.position.y;
            const dz = newPos.z - child.position.z;
            child.position.set(newPos.x, visualBaseY, newPos.z);
            const updatedApp = { ...app, ...primaryAppUpdate.updates };
            if ('groupId' in primaryAppUpdate.updates && primaryAppUpdate.updates.groupId === undefined) {
              delete updatedApp.groupId;
            }
            child.userData['appliance'] = updatedApp;
            child.userData['applianceId'] = app.id;
            child.traverse(c => {
              if (c !== child && 'appliance' in c.userData) {
                delete c.userData['appliance'];
              }
            });
            for (const gChild of this.applianceGizmoGroup.children) {
              gChild.position.x += dx;
              gChild.position.y += dy;
              gChild.position.z += dz;
            }
            break;
          }
        }
      }
    }

    for (const appUpd of appUpdates) {
      this.liveDragApplianceUpdates.set(appUpd.id, appUpd);
      const newPos = appUpd.updates.position;
      if (newPos) {
        for (const child of this.appliancesGroup.children) {
          const cId = child.userData?.['appliance']?.id || child.userData?.['applianceId'];
          if (cId === appUpd.id) {
            const childApp = (child.userData?.['appliance'] as ApplianceItem | undefined) ||
              this.appliances().find(a => a.id === appUpd.id);
            const visualBaseY =
              childApp && childApp.type === 'sink' && newPos.y >= 500
                ? newPos.y - childApp.height + 8
                : (childApp && childApp.type === 'cooktop' && newPos.y >= 500)
                  ? newPos.y - childApp.height + 14
                  : newPos.y;
            child.position.set(newPos.x, visualBaseY, newPos.z);
            if (childApp) {
              const updatedApp = { ...childApp, ...appUpd.updates };
              if ('groupId' in appUpd.updates && appUpd.updates.groupId === undefined) {
                delete updatedApp.groupId;
              }
              child.userData['appliance'] = updatedApp;
              child.userData['applianceId'] = appUpd.id;
              child.traverse(c => {
                if (c !== child && 'appliance' in c.userData) {
                  delete c.userData['appliance'];
                }
              });
            }
            break;
          }
        }
      }
    }

    this.requestRender(4);
  }

  private liveDraggedDrawerCavityFit: {
    groupId: string;
    config: ParametricDrawerConfig;
  } | null = null;

  private clearLiveDraggedDrawerCavityFit() {
    if (!this.liveDraggedDrawerCavityFit) return;
    this.liveDraggedDrawerCavityFit = null;
    this.disposeGroup(this.internalClearanceGroup);
    if (this.dragInitialParts.length > 0) {
      const restoreList = this.dragInitialParts.map(initPart => ({
        part: initPart,
        updates: {
          length: initPart.length,
          width: initPart.width,
          thickness: initPart.thickness,
          orientation: initPart.orientation,
          posX: initPart.posX,
          posY: initPart.posY,
          posZ: initPart.posZ,
          notes: initPart.notes,
          hardwareConfig: initPart.hardwareConfig
        }
      }));
      this.previewPartUpdatesInPlace(restoreList);
    }
  }

  /**
   * Auto-Encaje Inteligente ("Smart Cavity Fit") al arrastrar un Cajón Modular en el visor 3D:
   * - Si el cursor/cajón entra en la cavidad de un mueble existente, auto-centra y auto-redimensiona
   *   instantáneamente sus piezas al anchoInterno y profundidad útil del hueco, adoptando la rotación
   *   del módulo receptor y deslizando verticalmente (posY) con cotas en vivo de Luz Superior y Luz Inferior.
   */
  private trySmartFitDrawerGroupOnDrag(
    e: PointerEvent,
    proposedDelta: { dx: number; dy: number; dz: number }
  ): boolean {
    if (e.altKey || this.dragInitialParts.length < 2) {
      this.clearLiveDraggedDrawerCavityFit();
      return false;
    }

    const groupId = this.dragInitialParts[0]?.groupId;
    if (!groupId || !this.dragInitialParts.every(p => p.groupId === groupId)) {
      this.clearLiveDraggedDrawerCavityFit();
      return false;
    }

    const grp = this.partGroups().find(g => g.id === groupId);
    const isModularDrawer =
      !!grp &&
      (grp.type === 'drawer' || grp.subType === 'drawer' || grp.templateId === 'modular_drawer');
    if (!isModularDrawer || !grp) {
      this.clearLiveDraggedDrawerCavityFit();
      return false;
    }

    const allCavities = this.partGeometry.detectAllSceneCavities(this.parts(), this.partGroups());
    if (allCavities.length === 0) {
      this.clearLiveDraggedDrawerCavityFit();
      return false;
    }

    let initMinX = Infinity, initMaxX = -Infinity;
    let initMinY = Infinity, initMaxY = -Infinity;
    let initMinZ = Infinity, initMaxZ = -Infinity;
    for (const p of this.dragInitialParts) {
      const b = this.getPartBounds(p);
      if (b.minX < initMinX) initMinX = b.minX;
      if (b.maxX > initMaxX) initMaxX = b.maxX;
      if (b.minY < initMinY) initMinY = b.minY;
      if (b.maxY > initMaxY) initMaxY = b.maxY;
      if (b.minZ < initMinZ) initMinZ = b.minZ;
      if (b.maxZ > initMaxZ) initMaxZ = b.maxZ;
    }

    const initCenterX = (initMinX + initMaxX) / 2;
    const initCenterZ = (initMinZ + initMaxZ) / 2;
    const initVisualH = Math.max(60, initMaxY - initMinY);

    const candCenterX = initCenterX + proposedDelta.dx;
    const candMinY = initMinY + proposedDelta.dy;
    const candCenterZ = initCenterZ + proposedDelta.dz;

    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    camDir.y = 0;
    if (camDir.lengthSq() < 1e-4) camDir.set(0, 0, -1);
    camDir.normalize();

    let matchedCavity: ModuleCavityInfo | null = null;
    let bestHitY: number | null = null;
    let bestScore = Infinity;

    for (const cav of allCavities) {
      const isWZ = cav.facingDirection === 'right' || cav.facingDirection === 'left';
      const cavPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        camDir,
        new THREE.Vector3(cav.centerX, (cav.minY + cav.maxY) / 2, cav.centerZ)
      );
      const rayHit = new THREE.Vector3();
      const hasRayHit = !!this.raycaster.ray.intersectPlane(cavPlane, rayHit);

      const raySpanDist = hasRayHit
        ? isWZ
          ? Math.abs(rayHit.z - cav.centerZ)
          : Math.abs(rayHit.x - cav.centerX)
        : Infinity;
      const rayInside =
        hasRayHit &&
        raySpanDist <= cav.innerWidth / 2 + 55 &&
        rayHit.y >= cav.minY - 50 &&
        rayHit.y <= cav.maxY + 50;

      const planeSpanDist = isWZ
        ? Math.abs(candCenterZ - cav.centerZ)
        : Math.abs(candCenterX - cav.centerX);
      const planeDepthDist = isWZ
        ? Math.abs(candCenterX - cav.centerX)
        : Math.abs(candCenterZ - cav.centerZ);
      const planeInside =
        planeSpanDist <= cav.innerWidth / 2 + 55 &&
        planeDepthDist <= cav.internalDepth / 2 + 95 &&
        candMinY >= cav.minY - 65 &&
        candMinY <= cav.maxY + 65;

      if (rayInside || planeInside) {
        const score = Math.min(raySpanDist, planeSpanDist);
        if (score < bestScore) {
          bestScore = score;
          matchedCavity = cav;
          bestHitY = hasRayHit ? rayHit.y - initVisualH / 2 : candMinY;
        }
      }
    }

    if (!matchedCavity) {
      this.clearLiveDraggedDrawerCavityFit();
      return false;
    }

    const baseCfg = this.projectStorage.getModularDrawerConfig(groupId);
    if (!baseCfg) {
      this.clearLiveDraggedDrawerCavityFit();
      return false;
    }

    const frontMountType = baseCfg.frontMountType ?? 'overlay';
    const ft = baseCfg.frontThickness || baseCfg.boxThickness || 15;
    const optimalSlide = this.partGeometry.getOptimalCommercialSlideLength(
      matchedCavity.internalDepth,
      frontMountType,
      ft
    );

    const minAllowedY = matchedCavity.minY + 2;
    const maxAllowedY = Math.max(minAllowedY, matchedCavity.maxY - initVisualH - 2);
    let targetBaseY = Math.round(bestHitY ?? candMinY);

    // Imán suave a la base del vano y al centro vertical del vano
    const midAllowedY = Math.round((minAllowedY + maxAllowedY) / 2);
    if (Math.abs(targetBaseY - minAllowedY) <= 14) {
      targetBaseY = Math.round(minAllowedY);
    } else if (Math.abs(targetBaseY - midAllowedY) <= 12) {
      targetBaseY = midAllowedY;
    }
    targetBaseY = Math.max(Math.round(minAllowedY), Math.min(Math.round(maxAllowedY), targetBaseY));

    const { parts: rebuiltParts, normalizedConfig } = this.projectStorage.buildModularDrawerParts(
      groupId,
      grp.name,
      {
        ...baseCfg,
        outerWidth: matchedCavity.innerWidth,
        slideLength: optimalSlide,
        sideThickness: matchedCavity.leftSideThickness,
        posX: matchedCavity.centerX,
        posY: targetBaseY,
        posZ: matchedCavity.centerZ,
        facingDirection: matchedCavity.facingDirection,
        frontEdgeCoord: matchedCavity.frontEdgeCoord,
        hostGroupId: matchedCavity.groupId,
        hostCavityId: matchedCavity.id
      }
    );

    const updatesList: { part: Part; updates: Partial<Part> }[] = [];
    for (const initPart of this.dragInitialParts) {
      const rebuilt =
        rebuiltParts.find(rp => rp.id === initPart.id) ||
        rebuiltParts.find(rp => rp.componentRole === initPart.componentRole && rp.name === initPart.name);
      if (!rebuilt) continue;
      updatesList.push({
        part: initPart,
        updates: {
          length: rebuilt.length,
          width: rebuilt.width,
          thickness: rebuilt.thickness,
          orientation: rebuilt.orientation,
          posX: rebuilt.posX,
          posY: rebuilt.posY,
          posZ: rebuilt.posZ,
          notes: rebuilt.notes,
          hardwareConfig: rebuilt.hardwareConfig
        }
      });
    }

    if (updatesList.length === 0) {
      this.clearLiveDraggedDrawerCavityFit();
      return false;
    }

    this.liveDraggedDrawerCavityFit = { groupId, config: normalizedConfig };
    this.clearPartSnapGuides();
    this.clearWallSnapGuides();
    this.clearLegSnapGuides();

    this.previewPartUpdatesInPlace(updatesList);
    this.renderDrawerCavityClearances(matchedCavity, targetBaseY, targetBaseY + initVisualH);
    this.internalClearanceGroup.position.set(0, 0, 0);
    this.requestRender(2);
    return true;
  }

  /**
   * Renderiza en vivo las cotas técnicas de Luz Superior y Luz Inferior mientras se desliza
   * un Cajón Modular por el riel vertical de un hueco en el visor 3D.
   */
  private renderDrawerCavityClearances(
    cavity: ModuleCavityInfo,
    drawerMinY: number,
    drawerMaxY: number
  ) {
    this.disposeGroup(this.internalClearanceGroup);

    const bottomClr = Math.max(0, Math.round(drawerMinY - cavity.minY));
    const topClr = Math.max(0, Math.round(cavity.maxY - drawerMaxY));

    const isWZ = cavity.facingDirection === 'right' || cavity.facingDirection === 'left';
    const dirSign = cavity.facingDirection === 'front' || cavity.facingDirection === 'right' ? 1 : -1;
    const refDepth = cavity.frontEdgeCoord + dirSign * 26;
    const refX = isWZ ? refDepth : cavity.centerX;
    const refZ = isWZ ? cavity.centerZ : refDepth;

    // Luz Superior
    if (topClr >= 4) {
      const p1 = new THREE.Vector3(refX, drawerMaxY, refZ);
      const p2 = new THREE.Vector3(refX, cavity.maxY, refZ);
      const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const line = new THREE.Line(lineGeo, this.internalClearanceLineMat);
      line.computeLineDistances();
      this.internalClearanceGroup.add(line);

      const midY = (drawerMaxY + cavity.maxY) / 2;
      const badge = this.createInternalClearanceBadge(`Luz Sup: ${topClr} mm`, false, false);
      badge.position.set(refX, midY, refZ + (isWZ ? 0 : dirSign * 10));
      this.internalClearanceGroup.add(badge);
    }

    // Luz Inferior
    if (bottomClr >= 4) {
      const p1 = new THREE.Vector3(refX, cavity.minY, refZ);
      const p2 = new THREE.Vector3(refX, drawerMinY, refZ);
      const lineGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const line = new THREE.Line(lineGeo, this.internalClearanceLineMat);
      line.computeLineDistances();
      this.internalClearanceGroup.add(line);

      const midY = (cavity.minY + drawerMinY) / 2;
      const badge = this.createInternalClearanceBadge(`Luz Inf: ${bottomClr} mm`, false, false);
      badge.position.set(refX, midY, refZ + (isWZ ? 0 : dirSign * 10));
      this.internalClearanceGroup.add(badge);
    }

    // Etiqueta de Ancho de Hueco Auto-Encajado
    const widthBadge = this.createInternalClearanceBadge(
      `Hueco: ${Math.round(cavity.innerWidth)} mm`,
      true,
      false
    );
    widthBadge.position.set(refX, cavity.minY + 18, refZ + (isWZ ? 0 : dirSign * 14));
    this.internalClearanceGroup.add(widthBadge);

    this.ngZone.run(() => {
      this.clearanceCalculated.emit({
        topClearance: topClr,
        bottomClearance: bottomClr,
        leftClearance: 0,
        rightClearance: 0,
        topNeighborName: cavity.moduleName,
        bottomNeighborName: cavity.moduleName,
        leftNeighborName: 'Lateral Izq',
        rightNeighborName: 'Lateral Der'
      });
    });
  }

  /**
   * Consolida en la zona de Angular los cambios acumulados tras finalizar un arrastre 3D (`pointerup`).
   */
  private commitLiveDragUpdates() {
    const hasPartUpdates = this.liveDragPartUpdates.size > 0;
    const hasAppUpdates = this.liveDragApplianceUpdates.size > 0;
    const primaryApp = this.liveDragPrimaryApplianceUpdate;
    const drawerFit = this.liveDraggedDrawerCavityFit;

    if (!hasPartUpdates && !hasAppUpdates && !primaryApp && !drawerFit) return;

    const partUpdatesList = Array.from(this.liveDragPartUpdates.values());
    const appUpdatesList = Array.from(this.liveDragApplianceUpdates.values());

    this.liveDragPartUpdates.clear();
    this.liveDragApplianceUpdates.clear();
    this.liveDragPrimaryApplianceUpdate = null;
    this.liveDraggedDrawerCavityFit = null;
    this.internalClearanceGroup.position.set(0, 0, 0);

    this.ngZone.run(() => {
      if (primaryApp) {
        this.applianceModified.emit(primaryApp);
      }
      if (partUpdatesList.length > 1) {
        this.multiplePartsModified.emit({ updates: partUpdatesList });
        this.partModified.emit(partUpdatesList[0]);
      } else if (partUpdatesList.length === 1) {
        this.partModified.emit(partUpdatesList[0]);
      }
      if (drawerFit) {
        this.projectStorage.updateGroup(drawerFit.groupId, {
          slideLength: drawerFit.config.slideLength,
          facingDirection: drawerFit.config.facingDirection,
          drawerConfig: drawerFit.config,
          hostGroupId: drawerFit.config.hostGroupId,
          hostCavityId: drawerFit.config.hostCavityId
        });
      } else if (partUpdatesList.length > 1) {
        const draggedGroupId = partUpdatesList[0]?.part.groupId;
        if (
          draggedGroupId &&
          partUpdatesList.every(u => u.part.groupId === draggedGroupId) &&
          this.partGroups().some(
            g =>
              g.id === draggedGroupId &&
              (g.type === 'drawer' || g.subType === 'drawer' || g.templateId === 'modular_drawer')
          )
        ) {
          const syncedCfg = this.projectStorage.getModularDrawerConfig(draggedGroupId);
          if (syncedCfg) {
            this.projectStorage.updateGroup(draggedGroupId, {
              drawerConfig: syncedCfg,
              hostGroupId: syncedCfg.hostGroupId,
              hostCavityId: syncedCfg.hostCavityId
            });
          }
        }
      }
      if (partUpdatesList.length === 1) {
        const singlePart = partUpdatesList[0].part;
        const updatedPart: Part = { ...singlePart, ...partUpdatesList[0].updates };
        const updatedParts = this.parts().map(p => p.id === updatedPart.id ? updatedPart : p);
        const clr = this.computeClearanceInfo(updatedPart, updatedParts);
        this.clearanceCalculated.emit(clr);
      }
      if (appUpdatesList.length > 0) {
        this.multipleAppliancesModified.emit({ updates: appUpdatesList });
      }
    });
  }

  // Pointer Up: Release Dragging
  private onPointerUp(e?: PointerEvent) {
    if (this.isRenderingPaused) return;
    // Si estábamos en modo de Selección por Ventana (Marquee Box Selection con Shift)
    if (this.isMarqueeSelecting) {
      this.isMarqueeSelecting = false;
      this.controls.enabled = true;
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) canvas.style.cursor = 'default';

      const currentBox = this.marqueeBox();
      this.marqueeBox.set(null);

      const clientX = e ? e.clientX : this.marqueeStart.clientX;
      const clientY = e ? e.clientY : this.marqueeStart.clientY;
      const dragDist = Math.hypot(clientX - this.marqueeStart.clientX, clientY - this.marqueeStart.clientY);

      this.ngZone.run(() => {
        if (dragDist >= 6 && currentBox) {
          this.performMarqueeSelection(currentBox);
        } else if (e) {
          this.handleShiftClickSelection(e);
        }
      });
      return;
    }

    if (this.isMeasuringDrag) {
      this.isMeasuringDrag = false;
      this.controls.enabled = true;
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) canvas.style.cursor = 'crosshair';

      const distMoved = this.measurePointerDownPos && e
        ? Math.hypot(e.clientX - this.measurePointerDownPos.x, e.clientY - this.measurePointerDownPos.y)
        : 0;

      if (distMoved > 8 && e) {
        // Gesto de Arrastre: resolver Punto B y fijar medición persistente
        const snapEnd = this.findMagneticSnapCandidate(e.clientX, e.clientY, 36);
        if (snapEnd) {
          const resolvedB = this.resolveMeasurementPointB(snapEnd, e.shiftKey);
          this.measurePointB.set(resolvedB);
        }

        const a = this.measurePointA();
        const b = this.measurePointB();
        if (a && b) {
          const dist = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
          if (dist >= 3) {
            this.isMeasurementPersistent.set(true);
            this.updateMagneticSnapIndicator(null);
          }
        }
        this.renderMeasurementVisuals();
      } else {
        // Clic simple: El Punto A queda fijado firmemente y la cámara queda libre para orbitar/inspeccionar antes del segundo clic
      }
      return;
    }

    if (this.isPushPulling) {
      this.commitLiveDragUpdates();
      this.isPushPulling = false;
      this.pushPullData = null;
      this.controls.enabled = true;
      this.pushPullDelta.set(null);
      this.clearPushPullHighlight();
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) canvas.style.cursor = 'default';
    }

    if (this.isDirectPieceDrag) {
      this.commitLiveDragUpdates();
      if (this.lastSnappedWallResult?.suggestedFacing && this.dragInitialParts.length > 0) {
        const firstPart = this.dragInitialParts[0];
        const gId = firstPart.groupId;
        if (gId) {
          const grp = this.partGroups().find(g => g.id === gId);
          if (grp && !grp.isLocked && grp.facingDirection !== this.lastSnappedWallResult.suggestedFacing) {
            this.projectStorage.setGroupFacingDirection(gId, this.lastSnappedWallResult.suggestedFacing);
          }
        }
      }
      this.lastSnappedWallResult = null;
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

    if (this.isWallDragging || this.isWallGizmoDragging) {
      if (this.pendingWallUpdates) {
        const { wallId, updates } = this.pendingWallUpdates;
        const wallMesh = this.roomGroup.children.find(
          c => c.userData?.['isWall'] && (c.userData?.['wallId'] === wallId || c.userData?.['wallType'] === wallId)
        );
        if (wallMesh) {
          wallMesh.scale.set(1, 1, 1);
        }
        const cfg = this.roomConfig();
        const allWalls = getResolvedRoomWalls(cfg);
        const updatedWalls = allWalls.map(w => w.id === wallId ? { ...w, ...updates } : w);
        this.ngZone.run(() => {
          this.roomConfigModified.emit({ walls: updatedWalls, recordHistory: true });
        });
        this.pendingWallUpdates = null;
      }
      this.isWallDragging = false;
      this.isWallGizmoDragging = false;
      this.activeWallTarget = null;
      this.activeWallGizmoHit = null;
      this.clearWallSnapGuides();
      this.controls.enabled = true;
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) canvas.style.cursor = 'default';
    }

    if (this.isDragging) {
      this.commitLiveDragUpdates();
      if (this.lastSnappedWallResult?.suggestedFacing && this.dragInitialParts.length > 0) {
        const firstPart = this.dragInitialParts[0];
        const gId = firstPart.groupId;
        if (gId) {
          const grp = this.partGroups().find(g => g.id === gId);
          if (grp && !grp.isLocked && grp.facingDirection !== this.lastSnappedWallResult.suggestedFacing) {
            this.projectStorage.setGroupFacingDirection(gId, this.lastSnappedWallResult.suggestedFacing);
          }
        }
      }
      this.lastSnappedWallResult = null;
      this.isDragging = false;
      this.activeGizmoHit = null;
      this.dragInitialPart = null;
      this.hideDynamicEdgeHandle();
      this.controls.enabled = true;

      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) {
        canvas.style.cursor = 'default';
      }
    }

    if (this.isReferenceGuideDragging) {
      this.isReferenceGuideDragging = false;
      this.controls.enabled = true;
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) canvas.style.cursor = 'default';
    }

    if (this.isApplianceDragging) {
      this.commitLiveDragUpdates();
      this.isApplianceDragging = false;
      this.draggingAppliance = null;
      this.controls.enabled = true;
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) canvas.style.cursor = 'default';
    }

    if (this.isApplianceResizing) {
      this.isApplianceResizing = false;
      this.draggingAppliance = null;
      this.activeApplianceHandle = null;
      this.controls.enabled = true;
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) canvas.style.cursor = 'default';
    }

    this.clearWallSnapGuides();
    this.clearLegSnapGuides();
    this.clearPartSnapGuides();
    if (this.controls && !this.inlineDimensionEditor()) {
      this.controls.enabled = true;
    }
  }

  // --- CAD TOOLS & PUSH/PULL FACE RAYCASTING ---

  setActiveTool(tool: 'select' | 'move' | 'measure' | 'rotate_90') {
    this.activeTool.set(tool);
    if (tool === 'measure') {
      this.isMeasureMode.set(true);
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) canvas.style.cursor = 'crosshair';
    } else {
      this.isMeasureMode.set(false);
      this.clearMeasure();
    }
    if (tool === 'rotate_90') {
      const grp = this.currentSelectedGroup();
      if (grp) {
        this.groupRotationRequested.emit({ groupId: grp.id, deltaAngle: 90 });
      } else if (this.selectedPart()) {
        const sel = this.selectedPart()!;
        if (sel.groupId && this.isCountertopPartOrGroup(sel)) {
          this.groupRotationRequested.emit({ groupId: sel.groupId, deltaAngle: 90 });
        } else {
          this.rotatePart90(sel, 'y');
        }
      }
    }
    this.clearPushPullHighlight();
    this.hoveredFaceInfo.set(null);
    const canvas = this.canvasRef()?.nativeElement;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
    this.requestRender(6);
  }

  private updatePushPullHover(e: PointerEvent) {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.camera || this.isPushPulling) return;

    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(
      this.raycastablePieceMeshes,
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
      const isBacksplash = part.componentRole === 'backsplash' || part.name.toUpperCase().includes('SALPICADERO');
      if (axis === 'y') {
        dimLabel = `Alto (${isBacksplash ? part.width : part.length} mm)`;
      } else if (axis === 'z') {
        dimLabel = `${isBacksplash ? 'Largo' : 'Fondo'} (${isBacksplash ? part.length : part.width} mm)`;
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
    this.requestRender(4);
  }

  private clearPushPullHighlight() {
    if (this.pushPullHighlightGroup.children.length > 0) {
      this.disposeGroup(this.pushPullHighlightGroup);
      this.requestRender(4);
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
    this.requestRender(4);
  }

  private clearRectPreview() {
    if (this.rectPreviewGroup.children.length > 0) {
      this.disposeGroup(this.rectPreviewGroup);
      this.requestRender(4);
    }
  }

  // --- 3D CIRCLE PREVIEW METHODS ---

  private renderCirclePreview() {
    this.clearCirclePreview();
    if (!this.circleCenterPoint || !this.circleCurrentPoint) return;

    const dx = this.circleCurrentPoint.x - this.circleCenterPoint.x;
    const dz = this.circleCurrentPoint.z - this.circleCenterPoint.z;
    const radius = Math.max(20, Math.round(Math.sqrt(dx * dx + dz * dz)));
    const thickness = 15;
    const centerY = this.circleCenterPoint.y + thickness / 2;

    const geom = new THREE.CylinderGeometry(radius, radius, thickness, 48);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.35,
      depthTest: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(this.circleCenterPoint.x, centerY, this.circleCenterPoint.z);

    const edges = new THREE.EdgesGeometry(geom);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 2, depthTest: false });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    mesh.add(wireframe);

    // Dynamic radius guide line from center to current point
    const lineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(dx, 0, dz)
    ]);
    const radiusLine = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0x0369a1, linewidth: 3, depthTest: false }));
    mesh.add(radiusLine);

    this.circlePreviewGroup.add(mesh);
    this.requestRender(4);
  }

  private clearCirclePreview() {
    if (this.circlePreviewGroup.children.length > 0) {
      this.disposeGroup(this.circlePreviewGroup);
      this.requestRender(4);
    }
  }

  // --- 3D FREEHAND (DIBUJO LIBRE) PREVIEW METHODS ---

  private renderFreehandPreview() {
    this.clearFreehandPreview();
    if (this.freehandPoints.length < 2) return;

    const linePoints = this.freehandPoints.map(p => new THREE.Vector3(p.x, p.y + 2, p.z));
    const lineGeom = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 3, depthTest: false });
    const line = new THREE.Line(lineGeom, lineMat);
    this.freehandPreviewGroup.add(line);

    // Start point marker (dot)
    const dotGeom = new THREE.SphereGeometry(6, 16, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false });
    const dotMesh = new THREE.Mesh(dotGeom, dotMat);
    dotMesh.position.copy(linePoints[0]);
    this.freehandPreviewGroup.add(dotMesh);
    this.requestRender(4);
  }

  private clearFreehandPreview() {
    if (this.freehandPreviewGroup.children.length > 0) {
      this.disposeGroup(this.freehandPreviewGroup);
      this.requestRender(4);
    }
  }

  // Chaikin-like polygon smoothing / decimation helper for freehand contours
  private smoothPolygonPoints(rawPoints: { x: number; y: number }[]): { x: number; y: number }[] {
    if (rawPoints.length < 4) return rawPoints;

    // 1. Decimate points closer than 15mm to eliminate jitter
    const minDistance = 15;
    const filtered: { x: number; y: number }[] = [rawPoints[0]];
    for (let i = 1; i < rawPoints.length; i++) {
      const prev = filtered[filtered.length - 1];
      const cur = rawPoints[i];
      const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y);
      if (dist >= minDistance) {
        filtered.push(cur);
      }
    }

    if (filtered.length < 4) return filtered;

    // 2. Chaikin algorithm smoothing iteration
    const smoothed: { x: number; y: number }[] = [];
    const len = filtered.length;
    for (let i = 0; i < len; i++) {
      const p0 = filtered[i];
      const p1 = filtered[(i + 1) % len];
      smoothed.push({
        x: Math.round((0.75 * p0.x + 0.25 * p1.x) * 10) / 10,
        y: Math.round((0.75 * p0.y + 0.25 * p1.y) * 10) / 10
      });
      smoothed.push({
        x: Math.round((0.25 * p0.x + 0.75 * p1.x) * 10) / 10,
        y: Math.round((0.25 * p0.y + 0.75 * p1.y) * 10) / 10
      });
    }

    return smoothed;
  }

  // --- RIGHT-CLICK CONTEXT MENU ACTIONS ---
  readonly applyMaterialToWholeGroup = signal<boolean>(false);

  readonly contextMenuGroup = computed<PartGroup | null>(() => {
    const part = this.contextMenuPart();
    if (!part?.groupId) return null;
    return this.partGroups().find(g => g.id === part.groupId) || null;
  });

  readonly isContextMenuDrawerGroup = computed<boolean>(() => {
    const grp = this.contextMenuGroup();
    if (!grp) return false;
    return grp.type === 'drawer' || grp.subType === 'drawer' || grp.templateId === 'modular_drawer';
  });

  requestInsertDrawerInContextCavity() {
    const part = this.contextMenuPart();
    if (!part?.groupId) return;
    const grpId = part.groupId;
    const prtId = part.id;
    this.closeContextMenu();
    this.insertDrawerInCavityRequested.emit({ groupId: grpId, partId: prtId });
  }

  readonly isContextMenuCountertopGroup = computed<boolean>(() => {
    const grp = this.contextMenuGroup();
    if (!grp) return false;
    const grpParts = this.getPartsForGroup(grp.id);
    const hasCt = grpParts.some(p => p.componentRole === 'countertop' || p.componentRole === 'backsplash');
    const hasSides = grpParts.some(p => p.componentRole === 'side_left' || p.componentRole === 'side_right');
    return hasCt && !hasSides;
  });

  readonly contextMenuIntegratedAppliances = computed<ApplianceItem[]>(() => {
    const grp = this.contextMenuGroup();
    if (!grp) return [];
    return this.appliances().filter(a => a.groupId === grp.id);
  });

  readonly isContextMenuModuleWithAppliance = computed<boolean>(() => {
    return this.contextMenuIntegratedAppliances().length > 0;
  });

  readonly isContextMenuCabinetModule = computed<boolean>(() => {
    const grp = this.contextMenuGroup();
    return (
      !!grp &&
      !this.isContextMenuDrawerGroup() &&
      !this.isContextMenuCountertopGroup() &&
      !this.isContextMenuModuleWithAppliance()
    );
  });

  readonly contextMenuCategory = computed<'drawer' | 'door' | 'structural'>(() => {
    const part = this.contextMenuPart();
    if (!part) return 'structural';

    if (this.isContextMenuDrawerGroup()) {
      return 'drawer';
    }

    const nameUpper = part.name.toUpperCase();
    const isDrawerPart =
      part.componentRole === 'drawer_front' ||
      part.componentRole === 'drawer_box' ||
      part.componentRole === 'drawer_lateral' ||
      part.hardwareConfig?.movableType === 'drawer' ||
      nameUpper.includes('CAJON') ||
      nameUpper.includes('CAJÓN') ||
      nameUpper.includes('GAVETA') ||
      part.id.includes('caj_');

    if (isDrawerPart) {
      return 'drawer';
    }

    const isDoorPart =
      part.componentRole === 'door' ||
      part.hardwareConfig?.movableType === 'door' ||
      nameUpper.includes('PUERTA') ||
      nameUpper.includes('BASCULANTE') ||
      nameUpper.includes('ELEVABLE');

    if (isDoorPart) {
      return 'door';
    }

    return 'structural';
  });

  /**
   * Si el usuario hizo clic derecho sobre un lateral, trasera o fondo de un cajón,
   * devuelve automáticamente la pieza del Frente Vista de ese cajón para aplicarle el tirador o corredera.
   */
  readonly contextMenuEffectiveFrontPart = computed<Part | null>(() => {
    const part = this.contextMenuPart();
    if (!part) return null;
    if (this.contextMenuCategory() !== 'drawer') return part;

    if (part.componentRole === 'drawer_front' || part.name.toUpperCase().includes('FRENTE')) {
      return part;
    }

    const allParts = this.parts();
    if (part.groupId) {
      const groupFront = allParts.find(
        p =>
          p.groupId === part.groupId &&
          (p.componentRole === 'drawer_front' ||
            p.id.includes('_frente') ||
            p.name.toUpperCase().includes('FRENTE'))
      );
      if (groupFront) return groupFront;
    }

    const boxSubKeywords = ['_lat_izq', '_lat_der', '_contrafrente', '_trasera', '_frente_int', '_fondo'];
    for (const kw of boxSubKeywords) {
      if (part.id.includes(kw)) {
        const prefix = part.id.split(kw)[0];
        const foundFront = allParts.find(
          p => p.id.startsWith(prefix) && (p.componentRole === 'drawer_front' || p.id.includes('_frente'))
        );
        if (foundFront) return foundFront;
      }
    }

    return part;
  });

  onContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

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
    const contRect = container.getBoundingClientRect();
    const posX = Math.max(10, Math.min(e.clientX - contRect.left, contRect.width - 265));
    const posY = Math.max(10, Math.min(e.clientY - contRect.top, contRect.height - 390));

    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. Probar primero si el clic derecho fue sobre un electrodoméstico
    if (this.layerVisibility().showAppliances && this.appliancesGroup.children.length > 0) {
      const appIntersects = this.raycaster.intersectObjects(this.appliancesGroup.children, true);
      if (appIntersects.length > 0) {
        const resolved = this.resolveApplianceFromObject(appIntersects[0].object);
        if (resolved) {
          const foundApp = resolved.app;
          this.contextMenuAppliance.set(foundApp);
          this.contextMenuPart.set(null);
          this.contextMenuPos.set({ x: posX, y: posY });
          this.applianceSelected.emit(foundApp);
          this.appliancesSelected.emit([foundApp.id]);
          this.partsSelected.emit([]);
          this.partSelected.emit(null);

          this.showQuickMaterialPicker.set(false);
          this.showRotateSubmenu.set(false);
          this.showMovableRoleSubmenu.set(false);
          this.showHandleSubmenu.set(false);
          this.showHingeSubmenu.set(false);
          this.showSlideSubmenu.set(false);
          return;
        }
      }
    }

    const targets: THREE.Object3D[] = [];
    for (const item of this.pieceObjects) {
      targets.push(item.mesh);
      if (item.doorPivot) targets.push(item.doorPivot);
    }

    const intersects = this.raycaster.intersectObjects(targets, true);

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
        this.contextMenuAppliance.set(null);
        this.contextMenuPart.set(part);
        this.contextMenuPos.set({ x: posX, y: posY });

        const curIds = this.activeSelectedIds();
        const isAlreadySingleIsolated = curIds.length === 1 && curIds[0] === part.id;
        if (part.groupId && !isAlreadySingleIsolated) {
          const grpParts = this.parts().filter(p => p.groupId === part!.groupId);
          if (grpParts.length > 1) {
            this.partsSelected.emit(grpParts.map(p => p.id));
            this.partSelected.emit(part);
            this.applyMaterialToWholeGroup.set(true);
          } else {
            this.partsSelected.emit([part.id]);
            this.partSelected.emit(part);
            this.applyMaterialToWholeGroup.set(false);
          }
        } else {
          this.partsSelected.emit([part.id]);
          this.partSelected.emit(part);
          this.applyMaterialToWholeGroup.set(false);
        }

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
    this.contextMenuAppliance.set(null);
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
    this.contextMenuAppliance.set(null);
    this.showQuickMaterialPicker.set(false);
    this.showRotateSubmenu.set(false);
    this.showMovableRoleSubmenu.set(false);
    this.showHandleSubmenu.set(false);
    this.showHingeSubmenu.set(false);
    this.showSlideSubmenu.set(false);
  }

  onContextMenuApplianceDimChange(app: ApplianceItem, prop: 'width' | 'depth' | 'height', val: number | string) {
    const num = Number(val);
    if (isNaN(num) || num <= 0) return;
    const rounded = Math.round(num);
    this.applianceModified.emit({
      appliance: app,
      updates: { [prop]: rounded }
    });
    this.contextMenuAppliance.update(cur => cur ? { ...cur, [prop]: rounded } : null);
  }

  rotateContextMenuAppliance(app: ApplianceItem, deltaAngle = 90) {
    const nextRot = (((app.rotation || 0) + deltaAngle) % 360 + 360) % 360;
    this.applianceModified.emit({
      appliance: app,
      updates: { rotation: nextRot }
    });
    this.contextMenuAppliance.update(cur => cur ? { ...cur, rotation: nextRot } : null);
  }

  duplicateContextMenuAppliance(app: ApplianceItem) {
    this.applianceDuplicated.emit(app.id);
    this.closeContextMenu();
  }

  deleteContextMenuAppliance(app: ApplianceItem) {
    this.applianceDeleted.emit(app.id);
    this.closeContextMenu();
  }

  toggleContextMenuApplianceLink(app: ApplianceItem) {
    const newGroupId = app.groupId ? undefined : (this.currentSelectedGroup()?.id || undefined);
    this.applianceModified.emit({
      appliance: app,
      updates: { groupId: newGroupId }
    });
    this.contextMenuAppliance.update(cur => cur ? { ...cur, groupId: newGroupId } : null);
  }

  toggleContextMenuApplianceLock(app: ApplianceItem) {
    const nextLocked = !app.isLocked;
    this.applianceModified.emit({
      appliance: app,
      updates: { isLocked: nextLocked }
    });
    this.contextMenuAppliance.update(cur => cur ? { ...cur, isLocked: nextLocked } : null);
  }

  hideContextMenuAppliance(app: ApplianceItem) {
    this.applianceModified.emit({
      appliance: app,
      updates: { isHidden: true }
    });
    this.closeContextMenu();
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

  isAnimatablePart(part: Part | null): boolean {
    if (!part) return false;
    return this.contextMenuCategory() === 'drawer' || this.contextMenuCategory() === 'door';
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

  setContextMenuPartHandle(handleType: HandleType, finish?: HandleFinish) {
    const targetPart = this.contextMenuEffectiveFrontPart() || this.contextMenuPart();
    if (!targetPart) return;

    const resolvedFinish: HandleFinish =
      finish ||
      (handleType === 'bar_black'
        ? 'black'
        : targetPart.hardwareConfig?.handleFinish || 'brushed_steel');

    const hw: PartHardwareConfig = {
      ...(targetPart.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(targetPart)),
      handleType,
      handleFinish: resolvedFinish
    };
    this.partModified.emit({ part: targetPart, updates: { hardwareConfig: hw } });
    this.closeContextMenu();
  }

  setContextMenuPartHandleFinish(finish: HandleFinish) {
    const targetPart = this.contextMenuEffectiveFrontPart() || this.contextMenuPart();
    if (!targetPart) return;
    const hw: PartHardwareConfig = {
      ...(targetPart.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(targetPart)),
      handleType: targetPart.hardwareConfig?.handleType || 'bar_modern',
      handleFinish: finish
    };
    this.partModified.emit({ part: targetPart, updates: { hardwareConfig: hw } });
    this.contextMenuPart.set({ ...targetPart, hardwareConfig: hw });
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
    const targetPart = this.contextMenuEffectiveFrontPart() || this.contextMenuPart();
    if (!targetPart) return;
    const hw: PartHardwareConfig = {
      ...(targetPart.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(targetPart)),
      slideType
    };
    this.partModified.emit({ part: targetPart, updates: { hardwareConfig: hw } });
    this.closeContextMenu();
  }

  toggleContextMenuAnimation() {
    const part = this.contextMenuEffectiveFrontPart() || this.contextMenuPart();
    if (!part) return;
    if (part.groupId && this.isContextMenuDrawerGroup()) {
      this.toggleGroupAnimation(part.groupId);
    } else {
      this.togglePartOpen(part.id);
    }
    this.closeContextMenu();
  }

  duplicateContextMenuPart() {
    const part = this.contextMenuPart();
    if (part) {
      this.partDuplicated.emit(part);
      this.closeContextMenu();
    }
  }

  readonly isContextMenuGroupMode = computed<boolean>(() => {
    const grp = this.contextMenuGroup();
    return !!grp && this.activeSelectedIds().length > 1;
  });

  selectWholeGroupFromContext() {
    const grp = this.contextMenuGroup();
    const part = this.contextMenuPart();
    if (!grp) return;
    const grpIds = this.parts().filter(p => p.groupId === grp.id).map(p => p.id);
    this.partsSelected.emit(grpIds);
    if (part) this.partSelected.emit(part);
    this.applyMaterialToWholeGroup.set(true);
  }

  selectSinglePartFromContext() {
    const part = this.contextMenuPart();
    if (!part) return;
    if (part.groupId && this.isInternalShelf(part)) {
      const cavity = this.partGeometry.getModuleCavityCenter(part, this.parts());
      if (cavity) {
        const isOffX = Math.abs((part.posX ?? 0) - cavity.x) > 1.5;
        const isOffZ = Math.abs((part.posZ ?? 0) - cavity.z) > 1.5;
        if (isOffX || isOffZ) {
          part.posX = cavity.x;
          part.posZ = cavity.z;
          this.projectStorage.updatePart({ ...part, posX: cavity.x, posZ: cavity.z });
        }
      }
    }
    this.partsSelected.emit([part.id]);
    this.partSelected.emit(part);
    this.applyMaterialToWholeGroup.set(false);
  }

  hideContextMenuGroup() {
    const grp = this.contextMenuGroup();
    if (!grp) return;
    const grpIds = this.parts().filter(p => p.groupId === grp.id).map(p => p.id);
    this.hidePartsByIds(grpIds);
    this.closeContextMenu();
  }

  deleteContextMenuGroup() {
    const grp = this.contextMenuGroup();
    if (!grp) return;
    const grpIds = this.parts().filter(p => p.groupId === grp.id).map(p => p.id);
    for (const id of grpIds) {
      this.partDeleted.emit(id);
    }
    this.closeContextMenu();
  }

  ungroupFromContext() {
    const grp = this.contextMenuGroup();
    if (!grp) return;
    this.groupUngroupRequested.emit(grp.id);
    this.closeContextMenu();
  }

  duplicateContextMenuGroup() {
    const grp = this.contextMenuGroup();
    if (grp) {
      this.groupDuplicationRequested.emit(grp.id);
      this.closeContextMenu();
    }
  }

  rotateContextMenuGroup90() {
    const grp = this.contextMenuGroup();
    if (grp) {
      this.groupRotationRequested.emit({ groupId: grp.id, deltaAngle: 90 });
      this.closeContextMenu();
    }
  }

  isolateContextMenuGroup() {
    const grp = this.contextMenuGroup();
    if (!grp) return;
    const otherIds = new Set(this.parts().filter(p => p.groupId !== grp.id).map(p => p.id));
    this.hiddenPartIds.set(otherIds);
    this.hiddenPartsChanged.emit(Array.from(otherIds));
    this.closeContextMenu();
  }

  rotatePart90(part: Part, axis: 'x' | 'y' | 'z' = 'y') {
    const oldBounds = this.joineryEngine.getPartBounds(part);
    const updates: Partial<Part> = {
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0
    };
    const currentOrient = part.orientation || 'horizontal';

    if (axis === 'y') {
      if (part.shapeType !== 'circle') {
        if (currentOrient === 'horizontal') {
          updates.orientation = 'horizontal';
          updates.length = part.width;
          updates.width = part.length;
        } else if (currentOrient === 'vertical_xy') {
          updates.orientation = 'vertical_yz';
          const horizontalSpan = oldBounds.sx;
          const verticalHeight = oldBounds.sy;

          const isPlinth =
            part.componentRole === 'plinth' ||
            part.name.toUpperCase().includes('ZOCALO') ||
            part.name.toUpperCase().includes('ZÓCALO');
          const isCabinetSide =
            !isPlinth &&
            (part.componentRole === 'side_left' ||
              part.componentRole === 'side_right' ||
              part.componentRole === 'divider' ||
              part.componentRole === 'door' ||
              part.componentRole === 'back' ||
              (part.name.toUpperCase().includes('LATERAL') &&
                !ptIncludesDrawer(part)));
          const isDrawerBoxSide =
            !isPlinth &&
            !isCabinetSide &&
            ptIncludesDrawer(part);

          if (isDrawerBoxSide || (isPlinth && horizontalSpan > verticalHeight)) {
            updates.length = horizontalSpan;
            updates.width = verticalHeight;
          } else {
            updates.length = verticalHeight;
            updates.width = horizontalSpan;
          }
        } else if (currentOrient === 'vertical_yz') {
          updates.orientation = 'vertical_xy';
          updates.length = oldBounds.sz;
          updates.width = oldBounds.sy;
        }
      }
    } else if (axis === 'x') {
      if (part.shapeType !== 'circle') {
        updates.orientation = currentOrient === 'horizontal' ? 'vertical_xy' : 'horizontal';
      }
    } else if (axis === 'z') {
      if (part.shapeType !== 'circle') {
        updates.orientation = currentOrient === 'horizontal' ? 'vertical_yz' : 'horizontal';
      }
    }
    this.partModified.emit({ part, updates });
    this.closeContextMenu();

    function ptIncludesDrawer(p: Part): boolean {
      return (
        p.componentRole === 'drawer_box' ||
        p.componentRole === 'drawer_lateral' ||
        (p.name.toUpperCase().includes('LATERAL') && p.name.toUpperCase().includes('CAJ'))
      );
    }
  }

  /**
   * Rota en bloque 90° todas las piezas, módulos y electrodomésticos actualmente seleccionados alrededor de su centroide común.
   */
  rotateMultipleParts90(partsList: Part[], angleDelta: 90 | -90 | 180 = 90, appliancesList: ApplianceItem[] = []) {
    if (partsList.length === 0 && appliancesList.length === 0) return;
    if (partsList.some(p => this.isPartOrGroupLocked(p))) return;

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const pt of partsList) {
      const b = this.joineryEngine.getPartBounds(pt);
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minZ < minZ) minZ = b.minZ;
      if (b.maxZ > maxZ) maxZ = b.maxZ;
    }
    for (const app of appliancesList) {
      const halfW = (app.width || 600) / 2;
      const halfD = (app.depth || 600) / 2;
      const appMinX = app.position.x - halfW;
      const appMaxX = app.position.x + halfW;
      const appMinZ = app.position.z - halfD;
      const appMaxZ = app.position.z + halfD;
      if (appMinX < minX) minX = appMinX;
      if (appMaxX > maxX) maxX = appMaxX;
      if (appMinZ < minZ) minZ = appMinZ;
      if (appMaxZ > maxZ) maxZ = appMaxZ;
    }

    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;

    const updatesList: { part: Part; updates: Partial<Part> }[] = [];

    for (const pt of partsList) {
      const oldBounds = this.joineryEngine.getPartBounds(pt);
      const dx = oldBounds.px - cx;
      const dz = oldBounds.pz - cz;
      let newDx = dx;
      let newDz = dz;

      if (angleDelta === 90) {
        newDx = dz;
        newDz = -dx;
      } else if (angleDelta === -90) {
        newDx = -dz;
        newDz = dx;
      } else if (angleDelta === 180) {
        newDx = -dx;
        newDz = -dz;
      }

      const newPosX = Math.round((cx + newDx) * 10) / 10;
      const newPosZ = Math.round((cz + newDz) * 10) / 10;

      const currentOrient = pt.orientation || 'horizontal';
      let newOrientation = currentOrient;
      let newLength = pt.length;
      let newWidth = pt.width;

      if (Math.abs(angleDelta) === 90) {
        if (currentOrient === 'horizontal') {
          newLength = pt.width;
          newWidth = pt.length;
        } else if (currentOrient === 'vertical_xy') {
          newOrientation = 'vertical_yz';
          newLength = pt.length;
          newWidth = pt.width;
        } else if (currentOrient === 'vertical_yz') {
          newOrientation = 'vertical_xy';
          newLength = pt.length;
          newWidth = pt.width;
        }
      }

      updatesList.push({
        part: pt,
        updates: {
          posX: newPosX,
          posZ: newPosZ,
          length: newLength,
          width: newWidth,
          orientation: newOrientation
        }
      });
    }

    if (updatesList.length > 0) {
      this.multiplePartsModified.emit({ updates: updatesList });
    }

    if (appliancesList.length > 0) {
      const appUpdatesList: { id: string; updates: Partial<ApplianceItem> }[] = [];
      for (const app of appliancesList) {
        const dx = app.position.x - cx;
        const dz = app.position.z - cz;
        let newDx = dx;
        let newDz = dz;

        if (angleDelta === 90) {
          newDx = dz;
          newDz = -dx;
        } else if (angleDelta === -90) {
          newDx = -dz;
          newDz = dx;
        } else if (angleDelta === 180) {
          newDx = -dx;
          newDz = -dz;
        }

        const newPosX = Math.round((cx + newDx) * 10) / 10;
        const newPosZ = Math.round((cz + newDz) * 10) / 10;
        const newRot = (((app.rotation || 0) + angleDelta) % 360 + 360) % 360;

        appUpdatesList.push({
          id: app.id,
          updates: {
            position: {
              ...app.position,
              x: newPosX,
              z: newPosZ
            },
            rotation: newRot
          }
        });
      }
      this.multipleAppliancesModified.emit({ updates: appUpdatesList });
    }
  }

  /**
   * Ejecuta la selección múltiple por ventana (Marquee Box Selection con Shift)
   * Proyecta en pantalla todas las piezas y electrodomésticos, seleccionando los módulos completos alcanzados.
   */
  private performMarqueeSelection(box: { left: number; top: number; width: number; height: number }) {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.camera) return;
    const canvasBounds = canvas.getBoundingClientRect();
    const w = canvasBounds.width;
    const h = canvasBounds.height;

    const boxMinX = box.left;
    const boxMaxX = box.left + box.width;
    const boxMinY = box.top;
    const boxMaxY = box.top + box.height;

    const matchedPartIds = new Set<string>();
    const matchedApplianceIds = new Set<string>();

    for (const item of this.pieceObjects) {
      const mesh = item.mesh;
      const part = mesh.userData?.['part'] as Part | undefined;
      if (!part) continue;

      const bbox = new THREE.Box3().setFromObject(mesh);
      if (bbox.isEmpty()) continue;

      const pts = [
        new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
        new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
        new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.min.z),
        new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
        new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
        new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
        new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.min.z),
        new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z)
      ];

      let minSx = Infinity, maxSx = -Infinity;
      let minSy = Infinity, maxSy = -Infinity;
      let anyInFront = false;

      for (const pt of pts) {
        const pProj = pt.clone().project(this.camera);
        if (pProj.z < 1) {
          anyInFront = true;
          const sx = ((pProj.x + 1) / 2) * w;
          const sy = ((-pProj.y + 1) / 2) * h;
          if (sx < minSx) minSx = sx;
          if (sx > maxSx) maxSx = sx;
          if (sy < minSy) minSy = sy;
          if (sy > maxSy) maxSy = sy;
        }
      }

      if (anyInFront) {
        const overlaps = !(
          maxSx < boxMinX ||
          minSx > boxMaxX ||
          maxSy < boxMinY ||
          minSy > boxMaxY
        );
        if (overlaps) {
          matchedPartIds.add(part.id);
        }
      }

      const center = bbox.getCenter(new THREE.Vector3());
      const cProj = center.project(this.camera);
      if (cProj.z < 1) {
        const csx = ((cProj.x + 1) / 2) * w;
        const csy = ((-cProj.y + 1) / 2) * h;
        if (csx >= boxMinX && csx <= boxMaxX && csy >= boxMinY && csy <= boxMaxY) {
          matchedPartIds.add(part.id);
        }
      }
    }

    // Intersección de electrodomésticos en 3D
    if (this.layerVisibility().showAppliances) {
      for (const appGroup of this.appliancesGroup.children) {
        const appId = appGroup.userData?.['applianceId'] || appGroup.userData?.['appliance']?.id;
        const app: ApplianceItem | undefined = (appId ? this.appliances().find(a => a.id === appId) : null) || appGroup.userData?.['appliance'];
        if (!app) continue;

        const bbox = new THREE.Box3().setFromObject(appGroup);
        if (bbox.isEmpty()) continue;

        const pts = [
          new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z),
          new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.max.z),
          new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.min.z),
          new THREE.Vector3(bbox.min.x, bbox.max.y, bbox.max.z),
          new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.min.z),
          new THREE.Vector3(bbox.max.x, bbox.min.y, bbox.max.z),
          new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.min.z),
          new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z)
        ];

        let minSx = Infinity, maxSx = -Infinity;
        let minSy = Infinity, maxSy = -Infinity;
        let anyInFront = false;

        for (const pt of pts) {
          const pProj = pt.clone().project(this.camera);
          if (pProj.z < 1) {
            anyInFront = true;
            const sx = ((pProj.x + 1) / 2) * w;
            const sy = ((-pProj.y + 1) / 2) * h;
            if (sx < minSx) minSx = sx;
            if (sx > maxSx) maxSx = sx;
            if (sy < minSy) minSy = sy;
            if (sy > maxSy) maxSy = sy;
          }
        }

        if (anyInFront) {
          const overlaps = !(
            maxSx < boxMinX ||
            minSx > boxMaxX ||
            maxSy < boxMinY ||
            minSy > boxMaxY
          );
          if (overlaps) {
            matchedApplianceIds.add(app.id);
          }
        }

        const center = bbox.getCenter(new THREE.Vector3());
        const cProj = center.project(this.camera);
        if (cProj.z < 1) {
          const csx = ((cProj.x + 1) / 2) * w;
          const csy = ((-cProj.y + 1) / 2) * h;
          if (csx >= boxMinX && csx <= boxMaxX && csy >= boxMinY && csy <= boxMaxY) {
            matchedApplianceIds.add(app.id);
          }
        }
      }
    }

    if (matchedPartIds.size === 0 && matchedApplianceIds.size === 0) {
      return;
    }

    // Incorporar todos los módulos completos alcanzados para garantizar integridad constructiva
    const allParts = this.parts();
    const allAppliances = this.appliances();
    const finalSelectedIds = new Set<string>();
    const finalSelectedApplianceIds = new Set<string>(matchedApplianceIds);

    for (const partId of matchedPartIds) {
      const p = allParts.find(x => x.id === partId);
      if (p?.groupId) {
        const grpParts = allParts.filter(x => x.groupId === p.groupId);
        for (const gp of grpParts) {
          finalSelectedIds.add(gp.id);
        }
        for (const app of allAppliances) {
          if (app.groupId === p.groupId) {
            finalSelectedApplianceIds.add(app.id);
          }
        }
      } else {
        finalSelectedIds.add(partId);
      }
    }

    // Si algún electrodoméstico seleccionado tiene groupId, incorporar las piezas de su módulo
    for (const appId of matchedApplianceIds) {
      const app = allAppliances.find(a => a.id === appId);
      if (app?.groupId) {
        const grpParts = allParts.filter(x => x.groupId === app.groupId);
        for (const gp of grpParts) {
          finalSelectedIds.add(gp.id);
        }
      }
    }

    const idsArray = Array.from(finalSelectedIds);
    const appIdsArray = Array.from(finalSelectedApplianceIds);

    this.partsSelected.emit(idsArray);
    this.appliancesSelected.emit(appIdsArray);

    if (idsArray.length > 0) {
      const firstPart = allParts.find(x => idsArray.includes(x.id));
      this.partSelected.emit(firstPart || null);
    } else {
      this.partSelected.emit(null);
    }

    if (appIdsArray.length === 1 && idsArray.length === 0) {
      const singleApp = allAppliances.find(a => a.id === appIdsArray[0]);
      this.applianceSelected.emit(singleApp || null);
    } else if (appIdsArray.length === 0) {
      this.applianceSelected.emit(null);
    }
  }

  /**
   * Gestiona el clic simple con Shift (Shift-Click) para alternar piezas, módulos o electrodomésticos en la selección.
   */
  private handleShiftClickSelection(e: PointerEvent) {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.camera) return;
    const rect = canvas.getBoundingClientRect();

    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. Probar primero si se hizo Shift+Clic sobre un electrodoméstico
    if (this.layerVisibility().showAppliances && this.appliancesGroup.children.length > 0) {
      const appIntersects = this.raycaster.intersectObjects(this.appliancesGroup.children, true);
      if (appIntersects.length > 0) {
        const resolved = this.resolveApplianceFromObject(appIntersects[0].object);
        if (resolved) {
          const foundApp = resolved.app;
          const curAppIds = new Set(this.activeSelectedApplianceIds());
          const curPartIds = new Set(this.activeSelectedIds());

          if (foundApp.groupId) {
            const gParts = this.parts().filter(p => p.groupId === foundApp.groupId);
            const gApps = this.appliances().filter(a => a.groupId === foundApp.groupId);
            const allInCur = gApps.every(a => curAppIds.has(a.id)) && gParts.every(p => curPartIds.has(p.id));
            if (allInCur) {
              for (const a of gApps) curAppIds.delete(a.id);
              for (const p of gParts) curPartIds.delete(p.id);
            } else {
              for (const a of gApps) curAppIds.add(a.id);
              for (const p of gParts) curPartIds.add(p.id);
            }
          } else {
            if (curAppIds.has(foundApp.id)) {
              curAppIds.delete(foundApp.id);
            } else {
              curAppIds.add(foundApp.id);
            }
          }

          const nextPartIds = Array.from(curPartIds);
          const nextAppIds = Array.from(curAppIds);
          this.partsSelected.emit(nextPartIds);
          this.appliancesSelected.emit(nextAppIds);
          if (nextPartIds.length > 0) {
            const firstP = this.parts().find(p => nextPartIds.includes(p.id));
            this.partSelected.emit(firstP || null);
          } else {
            this.partSelected.emit(null);
          }
          return;
        }
      }
    }

    // 2. Probar si se hizo Shift+Clic sobre una pieza de melamina
    const targets: THREE.Object3D[] = this.pieceObjects.map(p => p.mesh);
    const intersects = this.raycaster.intersectObjects(targets, true);

    if (intersects.length > 0) {
      let currObj: THREE.Object3D | null = intersects[0].object;
      let part: Part | undefined;
      while (currObj && !part && currObj !== this.furnitureGroup) {
        if (currObj.userData?.['part']) {
          part = currObj.userData['part'];
          break;
        }
        currObj = currObj.parent;
      }

      if (part) {
        const curIds = new Set(this.activeSelectedIds());
        const curAppIds = new Set(this.activeSelectedApplianceIds());

        // Si la pieza pertenece a un módulo estándar, alternamos el módulo completo y sus equipos.
        // Si es una pieza de mesón (agrupada o desagrupada), permitimos alternar cada tramo/pieza individualmente con Shift+Clic.
        const isCountertopUnit = part.componentRole === 'countertop' || part.componentRole === 'backsplash';
        const partsToToggle = (part.groupId && !isCountertopUnit)
          ? this.parts().filter(p => p.groupId === part.groupId)
          : [part];
        const appsToToggle = (part.groupId && !isCountertopUnit)
          ? this.appliances().filter(a => a.groupId === part.groupId)
          : [];

        const allInCur = partsToToggle.every(p => curIds.has(p.id));
        if (allInCur) {
          for (const p of partsToToggle) curIds.delete(p.id);
          for (const a of appsToToggle) curAppIds.delete(a.id);
        } else {
          for (const p of partsToToggle) curIds.add(p.id);
          for (const a of appsToToggle) curAppIds.add(a.id);
        }

        const updatedIds = Array.from(curIds);
        const updatedAppIds = Array.from(curAppIds);
        this.partsSelected.emit(updatedIds);
        this.appliancesSelected.emit(updatedAppIds);
        if (updatedIds.length > 0) {
          const nextFirst = this.parts().find(p => updatedIds.includes(p.id));
          this.partSelected.emit(nextFirst || null);
        } else {
          this.partSelected.emit(null);
        }
      }
    }
  }

  cancelActiveInteractions() {
    this.isDragging = false;
    this.activeGizmoHit = null;
    this.isDirectPieceDrag = false;
    this.directPieceDragThresholdPassed = false;
    this.dragInitialPart = null;
    this.dragInitialParts = [];
    this.isWallDragging = false;
    this.activeWallTarget = null;
    this.isWallGizmoDragging = false;
    this.activeWallGizmoHit = null;
    this.clearWallSnapGuides();
    this.isApplianceDragging = false;
    this.isApplianceResizing = false;
    this.draggingAppliance = null;
    this.isMeasuringDrag = false;
    this.closeContextMenu();
    this.showGroupsFlyout.set(false);
    if (this.controls) {
      this.controls.enabled = true;
    }
  }

  onEditModuleFromContext(groupId: string, event?: Event) {
    event?.stopPropagation();
    this.cancelActiveInteractions();
    this.editModuleRequested.emit(groupId);
  }

  rotatePart3dAngle(part: Part, axis: 'x' | 'y' | 'z', delta: number) {
    const prop = axis === 'x' ? 'rotationX' : axis === 'y' ? 'rotationY' : 'rotationZ';
    const current = part[prop] || 0;
    const next = (((current + delta) % 360) + 360) % 360;
    this.partModified.emit({ part, updates: { [prop]: next } });
  }

  resetPartRotation(part: Part) {
    this.partModified.emit({
      part,
      updates: { rotationX: 0, rotationY: 0, rotationZ: 0 }
    });
    this.closeContextMenu();
  }

  alignContextMenuPart(type: 'floor' | 'centerX' | 'centerZ') {
    const part = this.contextMenuPart();
    if (!part) return;

    // Si estamos en modo módulo/grupo completo, alinear todo el módulo en bloque
    if (this.isContextMenuGroupMode() && part.groupId) {
      const grpParts = this.parts().filter(p => p.groupId === part.groupId);
      if (grpParts.length > 0) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        for (const p of grpParts) {
          const b = this.joineryEngine.getPartBounds(p);
          if (b.minX < minX) minX = b.minX;
          if (b.maxX > maxX) maxX = b.maxX;
          if (b.minY < minY) minY = b.minY;
          if (b.minZ < minZ) minZ = b.minZ;
          if (b.maxZ > maxZ) maxZ = b.maxZ;
        }
        const dx = type === 'centerX' ? -((minX + maxX) / 2) : 0;
        const dy = type === 'floor' ? -minY : 0;
        const dz = type === 'centerZ' ? -((minZ + maxZ) / 2) : 0;

        const updatesList = grpParts.map(p => {
          const b = this.joineryEngine.getPartBounds(p);
          const upd: Partial<Part> = {};
          if (type === 'centerX') upd.posX = Math.round(((p.posX ?? 0) + dx) * 10) / 10;
          if (type === 'floor') upd.posY = Math.round(((p.posY ?? b.sy / 2) + dy) * 10) / 10;
          if (type === 'centerZ') upd.posZ = Math.round(((p.posZ ?? 0) + dz) * 10) / 10;
          return { part: p, updates: upd };
        });
        this.multiplePartsModified.emit({ updates: updatesList });
        if (updatesList.length > 0) {
          this.partModified.emit(updatesList[0]);
        }
        this.closeContextMenu();
        return;
      }
    }

    const bounds = this.joineryEngine.getPartBounds(part);
    const sy = bounds.sy;

    const updates: Partial<Part> = {};
    if (type === 'floor') {
      updates.posY = Math.round(sy / 2);
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
    this.showAllRequested.emit();
    this.closeContextMenu();
  }

  assignQuickMaterial(matId: string, applyToWholeGroup = false) {
    const part = this.contextMenuPart();
    const mat = this.materials().find(m => m.id === matId);
    if (!part || !mat) return;

    if (applyToWholeGroup && part.groupId) {
      const grpParts = this.parts().filter(
        p => p.groupId === part.groupId && !(p.componentRole === 'back' && (p.thickness || 18) <= 6)
      );
      const updatesList = grpParts.map(p => ({
        part: p,
        updates: {
          materialId: mat.id,
          materialName: mat.name,
          colorHex: mat.colorHex
        }
      }));
      this.multiplePartsModified.emit({ updates: updatesList });
      if (updatesList.length > 0) {
        this.partModified.emit(updatesList[0]);
      }
      this.closeContextMenu();
      return;
    }

    this.partModified.emit({
      part,
      updates: {
        materialId: mat.id,
        materialName: mat.name,
        colorHex: mat.colorHex
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
      const movableObj = this.pieceObjects.find(po => po.part.groupId === groupId && (po.isDoor || po.isDrawer));
      const refId = movableObj ? movableObj.part.id : grpParts[0].id;
      const cur = this.openTargetMap.get(refId) || 0;
      const next = cur > 0.5 ? 0 : 1;
      for (const gp of grpParts) {
        this.openTargetMap.set(gp.id, next);
      }
      for (const p of this.pieceObjects) {
        if (p.part.groupId === groupId) {
          this.openTargetMap.set(p.part.id, next);
        }
      }
      this.requestRender(60);
    }
  }

  isGroupOpen(groupId: string): boolean {
    const grpParts = this.getPartsForGroup(groupId);
    if (grpParts.length === 0) return false;
    const movableObj = this.pieceObjects.find(po => po.part.groupId === groupId && (po.isDoor || po.isDrawer));
    const refId = movableObj ? movableObj.part.id : grpParts[0].id;
    const val = this.openTargetMap.get(refId) || 0;
    return val > 0.5;
  }
moveGroupStep(groupId: string, axis: 'x' | 'y' | 'z', delta: number) {
    const grpParts = this.getPartsForGroup(groupId);
    if (grpParts.length === 0) return;

    let effDelta = delta;
    if (axis === 'y') {
      let grpMinY = Infinity;
      for (const p of grpParts) {
        const b = this.getPartBounds(p);
        if (b.minY < grpMinY) grpMinY = b.minY;
      }
      effDelta = Math.max(-grpMinY, delta);
    }

    const updatesList: { part: Part; updates: Partial<Part> }[] = [];
    for (const p of grpParts) {
      const b = this.getPartBounds(p);
      const upd: Partial<Part> = {};
      if (axis === 'x') upd.posX = Math.round((p.posX ?? 0) + effDelta);
      if (axis === 'y') upd.posY = Math.round((p.posY ?? b.sy / 2) + effDelta);
      if (axis === 'z') upd.posZ = Math.round((p.posZ ?? 0) + effDelta);
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
    this.clearLegSnapGuides();
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
    const selAppIds = this.activeSelectedApplianceIds();
    const targetApps = this.appliances().filter(a => selAppIds.includes(a.id));

    if (selList.length === 0 && targetApps.length === 0) return;

    // Si alguna de las piezas o equipos seleccionados está congelado, bloquear el movimiento por teclado
    if (selList.some(p => this.isPartOrGroupLocked(p)) || targetApps.some(a => this.isApplianceLocked(a))) {
      return;
    }

    this.dragStarted.emit();

    let effDelta = delta;
    if (axis === 'y') {
      let minY = Infinity;
      for (const p of selList) {
        const b = this.getPartBounds(p);
        if (b.minY < minY) minY = b.minY;
      }
      for (const a of targetApps) {
        const appBottom = a.position.y;
        if (appBottom < minY) minY = appBottom;
      }
      if (minY !== Infinity) {
        effDelta = Math.max(-minY, delta);
      }
    }

    if (selList.length > 1 || (selList.length > 0 && targetApps.length > 0) || targetApps.length > 1) {
      if (selList.length > 0) {
        const updatesList: { part: Part; updates: Partial<Part> }[] = [];
        for (const p of selList) {
          const b = this.getPartBounds(p);
          const upd: Partial<Part> = {};
          if (axis === 'x') upd.posX = Math.round((p.posX ?? 0) + effDelta);
          if (axis === 'y') upd.posY = Math.round((p.posY ?? b.sy / 2) + effDelta);
          if (axis === 'z') upd.posZ = Math.round((p.posZ ?? 0) + effDelta);
          updatesList.push({ part: p, updates: upd });
        }
        this.multiplePartsModified.emit({ updates: updatesList });
        if (updatesList.length > 0) {
          this.partModified.emit(updatesList[0]);
        }
      }

      if (targetApps.length > 0) {
        const appUpdatesList: { id: string; updates: Partial<ApplianceItem> }[] = [];
        for (const a of targetApps) {
          const newPos = { ...a.position };
          if (axis === 'x') newPos.x = Math.round(a.position.x + effDelta);
          if (axis === 'y') newPos.y = Math.max(0, Math.round(a.position.y + effDelta));
          if (axis === 'z') newPos.z = Math.round(a.position.z + effDelta);
          appUpdatesList.push({
            id: a.id,
            updates: { position: newPos }
          });
        }
        this.multipleAppliancesModified.emit({ updates: appUpdatesList });
      }
      return;
    }

    // Only 1 item selected: either 1 part or 1 appliance
    if (targetApps.length === 1 && selList.length === 0) {
      const a = targetApps[0];
      const newPos = { ...a.position };
      if (axis === 'x') newPos.x = Math.round(a.position.x + effDelta);
      if (axis === 'y') newPos.y = Math.max(0, Math.round(a.position.y + effDelta));
      if (axis === 'z') newPos.z = Math.round(a.position.z + effDelta);
      this.applianceModified.emit({ appliance: a, updates: { position: newPos } });
      return;
    }

    const sel = selList[0];
    const bounds = this.getPartBounds(sel);
    const minPosY = bounds.sy / 2;

    let targetPos = {
      x: sel.posX ?? 0,
      y: Math.max(minPosY, sel.posY ?? minPosY),
      z: sel.posZ ?? 0
    };
    targetPos[axis] += delta;
    if (axis === 'y') {
      targetPos.y = Math.max(minPosY, targetPos.y);
    }

    if (this.isMagneticSnap()) {
      const snapRes = this.applyMagneticSnapToPosition(
        sel,
        targetPos,
        axis,
        25,
        [],
        axis === 'y' ? (delta > 0 ? 'up' : 'down') : 'any'
      );
      targetPos = snapRes.pos;
      targetPos.y = Math.max(minPosY, targetPos.y);

      if (axis === 'y') {
        if (delta <= 0) {
          const legSnap = this.applyTableLegSnap(sel, targetPos, 'down', 25);
          if (legSnap.isSnapped) {
            targetPos = legSnap.pos;
          }
        }
      } else {
        const legSnap = this.applyTableLegSnap(sel, targetPos, 'any', 25);
        if (legSnap.isSnapped) {
          targetPos = legSnap.pos;
        }
      }
    }

    targetPos.y = Math.max(minPosY, targetPos.y);

    const updates: Partial<Part> = {};
    if (axis === 'x') updates.posX = Math.round(targetPos.x);
    if (axis === 'y') updates.posY = Math.round(targetPos.y);
    if (axis === 'z') updates.posZ = Math.round(targetPos.z);

    this.partModified.emit({ part: sel, updates });
  }

  handleViewerKeyDown(e: KeyboardEvent) {
    if (this.isRenderingPaused) return;

    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    if (e.key === 'Shift') {
      this.isShiftPressed.set(true);
      if (this.isMeasureMode() && this.measurePointA() && !this.isMeasurementPersistent()) {
        this.renderMeasurementVisuals();
      }
    }

    // V o Barra Espaciadora: Herramienta Seleccionar
    if (e.key === 'v' || e.key === 'V' || e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      this.setActiveTool('select');
      return;
    }
    // M: Mover (Gizmo 3D)
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      this.setActiveTool('move');
      return;
    }
    // R: Rotar 90° pieza, cajón, electrodoméstico o módulo seleccionado
    if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'r' || e.key === 'R')) {
      const selParts = this.selectedParts();
      const selAppIds = this.activeSelectedApplianceIds();
      const targetApps = this.appliances().filter(a => selAppIds.includes(a.id));

      // Si no hay nada seleccionado, activar herramienta interactiva de giro en el visor
      if (selParts.length === 0 && targetApps.length === 0) {
        e.preventDefault();
        this.setActiveTool('rotate_90');
        return;
      }
      // Cuando hay elementos seleccionados, la rotación rígida en bloque se ejecuta canónicamente mediante rotateSelectedGroup en ModuleDesigner
      return;
    }
    // Q: Herramienta Rotar 90° con transportador
    if (e.key === 'q' || e.key === 'Q') {
      e.preventDefault();
      this.setActiveTool('rotate_90');
      return;
    }
    // T: Cinta Métrica 3D
    if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      this.setActiveTool('measure');
      return;
    }
    // Z: Centrar y reiniciar cámara (sin Ctrl/Meta/Alt para no colisionar con Deshacer)
    if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      this.resetCamera();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.inlineDimensionEditor()) {
        this.cancelInlineDimension();
        return;
      }
      this.closeContextMenu();
      this.clearSelection();
      this.clearMeasure();
      this.clearPushPullHighlight();
      this.clearRectPreview();
      return;
    }

    if (e.key === 'g' || e.key === 'G') {
      e.preventDefault();
      this.toggleReferenceGuide();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Del') {
      if (this.isReferenceGuideSelected()) {
        e.preventDefault();
        this.showReferenceGuide.set(false);
        this.isReferenceGuideSelected.set(false);
        return;
      }
      const selAppIds = this.activeSelectedApplianceIds();
      const sel = this.selectedPart();
      const selIds = this.selectedPartIds();

      if (selAppIds.length > 0 || selIds.length > 0 || sel) {
        e.preventDefault();
        for (const appId of selAppIds) {
          this.applianceDeleted.emit(appId);
        }
        if (selIds.length > 1) {
          for (const id of selIds) {
            this.partDeleted.emit(id);
          }
        } else if (sel) {
          this.partDeleted.emit(sel.id);
        }
        return;
      }
    }

    const hasParts = (this.selectedParts().length > 0);
    const hasApps = (this.activeSelectedApplianceIds().length > 0);
    if (!hasParts && !hasApps) return;

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

  handleViewerKeyUp(e: KeyboardEvent) {
    if (e.key === 'Shift') {
      this.isShiftPressed.set(false);
      if (this.isMeasureMode() && this.measurePointA() && !this.isMeasurementPersistent()) {
        this.renderMeasurementVisuals();
      }
    }
  }

  private getPartBounds(
    part: Part,
    customPos?: { x: number; y: number; z: number },
    customSize?: { length?: number; width?: number }
  ) {
    const targetPart: Part = customSize
      ? { ...part, length: customSize.length ?? part.length, width: customSize.width ?? part.width }
      : part;
    return this.partGeometry.getWorldAABB(targetPart, customPos);
  }

private applyMagneticSnapToPosition(
    movingPart: Part,
    proposedPos: { x: number; y: number; z: number },
    axis: 'x' | 'y' | 'z',
    threshold = 38,
    excludedPartIds: string[] = [],
    direction: 'up' | 'down' | 'any' = 'any'
  ): { pos: { x: number; y: number; z: number }; isSnapped: boolean; snappedPart: Part | null; snapFace: number | null } {
    const movingBounds = this.getPartBounds(movingPart, proposedPos);
    const otherParts = this.parts().filter(
      p => p.id !== movingPart.id && !excludedPartIds.includes(p.id) && !this.hiddenPartIds().has(p.id)
    );
    if (otherParts.length === 0) {
      return { pos: proposedPos, isSnapped: false, snappedPart: null, snapFace: null };
    }

    let bestSnapPos: number | null = null;
    let bestOtherPart: Part | null = null;
    let bestFace: number | null = null;
    let minDistance = threshold;
    const catchment = 120; // Margen de proximidad en los ejes perpendiculares para activar el imán

    for (const other of otherParts) {
      const otherBounds = this.getPartBounds(other);

      if (axis === 'x') {
        const overlapY = movingBounds.minY <= otherBounds.maxY + catchment && movingBounds.maxY >= otherBounds.minY - catchment;
        const overlapZ = movingBounds.minZ <= otherBounds.maxZ + catchment && movingBounds.maxZ >= otherBounds.minZ - catchment;
        if (!overlapY || !overlapZ) continue;

        const hx = movingBounds.sx / 2;
        const candidates = [
          { val: otherBounds.minX - hx, face: otherBounds.minX },
          { val: otherBounds.maxX + hx, face: otherBounds.maxX },
          { val: otherBounds.minX + hx, face: otherBounds.minX },
          { val: otherBounds.maxX - hx, face: otherBounds.maxX },
          { val: (otherBounds.minX + otherBounds.maxX) / 2, face: (otherBounds.minX + otherBounds.maxX) / 2 }
        ];

        for (const cand of candidates) {
          const dist = Math.abs(proposedPos.x - cand.val);
          if (dist < minDistance) {
            minDistance = dist;
            bestSnapPos = cand.val;
            bestOtherPart = other;
            bestFace = cand.face;
          }
        }
      } else if (axis === 'y') {
        const overlapX = movingBounds.minX <= otherBounds.maxX + catchment && movingBounds.maxX >= otherBounds.minX - catchment;
        const overlapZ = movingBounds.minZ <= otherBounds.maxZ + catchment && movingBounds.maxZ >= otherBounds.minZ - catchment;
        if (!overlapX || !overlapZ) continue;

        const hy = movingBounds.sy / 2;
        const currentY = movingPart.posY ?? hy;
        const candidates = [
          { val: otherBounds.maxY + hy, face: otherBounds.maxY }, // Apoyar encima de otra pieza
          { val: otherBounds.minY - hy, face: otherBounds.minY }, // Pegar debajo de tapa/cubierta
          { val: otherBounds.minY + hy, face: otherBounds.minY }, // Enrasar bases inferiores
          { val: otherBounds.maxY - hy, face: otherBounds.maxY }  // Enrasar bordes superiores
        ];

        for (const cand of candidates) {
          if (cand.val < hy) continue; // Nunca permitir un snap que hunda la pieza bajo el suelo (Y < 0)
          if (direction === 'up' && cand.val < currentY - threshold) continue;
          if (direction === 'down' && cand.val > currentY + threshold) continue;

          const dist = Math.abs(proposedPos.y - cand.val);
          if (dist < minDistance) {
            minDistance = dist;
            bestSnapPos = Math.max(hy, cand.val);
            bestOtherPart = other;
            bestFace = cand.face;
          }
        }
      } else if (axis === 'z') {
        const overlapX = movingBounds.minX <= otherBounds.maxX + catchment && movingBounds.maxX >= otherBounds.minX - catchment;
        const overlapY = movingBounds.minY <= otherBounds.maxY + catchment && movingBounds.maxY >= otherBounds.minY - catchment;
        if (!overlapX || !overlapY) continue;

        const hz = movingBounds.sz / 2;
        const candidates = [
          { val: otherBounds.minZ - hz, face: otherBounds.minZ },
          { val: otherBounds.maxZ + hz, face: otherBounds.maxZ },
          { val: otherBounds.minZ + hz, face: otherBounds.minZ },
          { val: otherBounds.maxZ - hz, face: otherBounds.maxZ },
          { val: (otherBounds.minZ + otherBounds.maxZ) / 2, face: (otherBounds.minZ + otherBounds.maxZ) / 2 }
        ];

        for (const cand of candidates) {
          const dist = Math.abs(proposedPos.z - cand.val);
          if (dist < minDistance) {
            minDistance = dist;
            bestSnapPos = cand.val;
            bestOtherPart = other;
            bestFace = cand.face;
          }
        }
      }
    }

    if (bestSnapPos !== null) {
      const snapped = { ...proposedPos };
      snapped[axis] = Math.round(bestSnapPos * 10) / 10;
      return { pos: snapped, isSnapped: true, snappedPart: bestOtherPart, snapFace: bestFace };
    }

    return { pos: proposedPos, isSnapped: false, snappedPart: null, snapFace: null };
  }

  private updateSingleWall(wallId: string, updates: Partial<RoomWallInstance>) {
    const config = this.roomConfig();
    const currentWalls = getResolvedRoomWalls(config);
    const existing = currentWalls.find(w => w.id === wallId);
    if (!existing) return;

    const hasChanged = Object.entries(updates).some(
      ([k, v]) => v !== undefined && (existing as unknown as Record<string, unknown>)[k] !== v
    );
    if (!hasChanged) return;

    const updatedWalls = currentWalls.map(w => {
      if (w.id === wallId) {
        return { ...w, ...updates };
      }
      return w;
    });
    this.ngZone.run(() => {
      this.roomConfigModified.emit({ walls: updatedWalls });
    });
  }

  private updateLiveWallTransform(wallId: string, posX: number, posZ: number) {
    const wallMesh = this.roomGroup.children.find(
      child => child.userData?.['isWall'] && (child.userData?.['wallId'] === wallId || child.userData?.['wallType'] === wallId)
    );
    if (wallMesh) {
      const dx = posX - wallMesh.position.x;
      const dz = posZ - wallMesh.position.z;
      wallMesh.position.x = posX;
      wallMesh.position.z = posZ;

      if (this.selectedWallType() === wallId) {
        for (const child of this.wallGizmoGroup.children) {
          child.position.x += dx;
          child.position.z += dz;
        }
      }
    }
  }

  private calculateWallToWallSnap(
    movingWall: RoomWallInstance,
    candX: number,
    candZ: number,
    allWalls: RoomWallInstance[],
    threshold = 45
  ): {
    isSnapped: boolean;
    snappedX: number;
    snappedZ: number;
    guide?: WallToWallSnapGuide | null;
  } {
    let bestDist = threshold;
    let snappedX = candX;
    let snappedZ = candZ;
    let isSnapped = false;
    let snapGuide: WallToWallSnapGuide | null = null;

    const isMovingHoriz = movingWall.rotationY === 0 || movingWall.rotationY === 180;
    const movingHalfL = movingWall.length / 2;
    const movingHalfT = movingWall.thickness / 2;

    const otherWalls = allWalls.filter(w => w.id !== movingWall.id && !w.isHidden);

    for (const other of otherWalls) {
      const isOtherHoriz = other.rotationY === 0 || other.rotationY === 180;
      const otherHalfL = other.length / 2;
      const otherHalfT = other.thickness / 2;

      if (isMovingHoriz && !isOtherHoriz) {
        // Muro activo es horizontal (eje X), el otro es vertical (eje Z)
        const otherFaceLeft = other.posX - otherHalfT;
        const otherFaceRight = other.posX + otherHalfT;

        const leftEnd = candX - movingHalfL;
        const rightEnd = candX + movingHalfL;

        const inOtherZSpan = candZ >= other.posZ - otherHalfL - 100 && candZ <= other.posZ + otherHalfL + 100;

        if (inOtherZSpan) {
          const distLRight = Math.abs(leftEnd - otherFaceRight);
          if (distLRight <= bestDist) {
            bestDist = distLRight;
            snappedX = otherFaceRight + movingHalfL;
            isSnapped = true;
            snapGuide = {
              xStart: otherFaceRight,
              zStart: candZ - movingHalfT,
              xEnd: otherFaceRight,
              zEnd: candZ + movingHalfT,
              yMin: 0,
              yMax: Math.min(movingWall.height, other.height)
            };
          }
          const distRLeft = Math.abs(rightEnd - otherFaceLeft);
          if (distRLeft <= bestDist) {
            bestDist = distRLeft;
            snappedX = otherFaceLeft - movingHalfL;
            isSnapped = true;
            snapGuide = {
              xStart: otherFaceLeft,
              zStart: candZ - movingHalfT,
              xEnd: otherFaceLeft,
              zEnd: candZ + movingHalfT,
              yMin: 0,
              yMax: Math.min(movingWall.height, other.height)
            };
          }
        }

        const movingFaceFront = candZ + movingHalfT;
        const movingFaceBack = candZ - movingHalfT;
        const otherEndBack = other.posZ - otherHalfL;
        const otherEndFront = other.posZ + otherHalfL;

        if (Math.abs(candX - other.posX) <= movingHalfL + otherHalfT + 50) {
          const distFrontEnd = Math.abs(movingFaceFront - otherEndBack);
          if (distFrontEnd <= bestDist) {
            bestDist = distFrontEnd;
            snappedZ = otherEndBack - movingHalfT;
            isSnapped = true;
          }
          const distBackEnd = Math.abs(movingFaceBack - otherEndFront);
          if (distBackEnd <= bestDist) {
            bestDist = distBackEnd;
            snappedZ = otherEndFront + movingHalfT;
            isSnapped = true;
          }
        }
      } else if (!isMovingHoriz && isOtherHoriz) {
        // Muro activo es vertical (eje Z), el otro es horizontal (eje X)
        const otherFaceBack = other.posZ - otherHalfT;
        const otherFaceFront = other.posZ + otherHalfT;

        const backEnd = candZ - movingHalfL;
        const frontEnd = candZ + movingHalfL;

        const inOtherXSpan = candX >= other.posX - otherHalfL - 100 && candX <= other.posX + otherHalfL + 100;

        if (inOtherXSpan) {
          const distBackFront = Math.abs(backEnd - otherFaceFront);
          if (distBackFront <= bestDist) {
            bestDist = distBackFront;
            snappedZ = otherFaceFront + movingHalfL;
            isSnapped = true;
            snapGuide = {
              xStart: candX - movingHalfT,
              zStart: otherFaceFront,
              xEnd: candX + movingHalfT,
              zEnd: otherFaceFront,
              yMin: 0,
              yMax: Math.min(movingWall.height, other.height)
            };
          }
          const distFrontBack = Math.abs(frontEnd - otherFaceBack);
          if (distFrontBack <= bestDist) {
            bestDist = distFrontBack;
            snappedZ = otherFaceBack - movingHalfL;
            isSnapped = true;
            snapGuide = {
              xStart: candX - movingHalfT,
              zStart: otherFaceBack,
              xEnd: candX + movingHalfT,
              zEnd: otherFaceBack,
              yMin: 0,
              yMax: Math.min(movingWall.height, other.height)
            };
          }
        }
      } else if (isMovingHoriz && isOtherHoriz) {
        // Ambos paralelos horizontales (eje X)
        const distZ = Math.abs(candZ - other.posZ);
        if (distZ <= bestDist) {
          bestDist = distZ;
          snappedZ = other.posZ;
          isSnapped = true;
        }
        const distLeftRight = Math.abs((candX - movingHalfL) - (other.posX + otherHalfL));
        if (distLeftRight <= bestDist) {
          bestDist = distLeftRight;
          snappedX = other.posX + otherHalfL + movingHalfL;
          isSnapped = true;
        }
        const distRightLeft = Math.abs((candX + movingHalfL) - (other.posX - otherHalfL));
        if (distRightLeft <= bestDist) {
          bestDist = distRightLeft;
          snappedX = other.posX - otherHalfL - movingHalfL;
          isSnapped = true;
        }
      } else {
        // Ambos paralelos verticales (eje Z)
        const distX = Math.abs(candX - other.posX);
        if (distX <= bestDist) {
          bestDist = distX;
          snappedX = other.posX;
          isSnapped = true;
        }
        const distBackFront = Math.abs((candZ - movingHalfL) - (other.posZ + otherHalfL));
        if (distBackFront <= bestDist) {
          bestDist = distBackFront;
          snappedZ = other.posZ + otherHalfL + movingHalfL;
          isSnapped = true;
        }
        const distFrontBack = Math.abs((candZ + movingHalfL) - (other.posZ - otherHalfL));
        if (distFrontBack <= bestDist) {
          bestDist = distFrontBack;
          snappedZ = other.posZ - otherHalfL - movingHalfL;
          isSnapped = true;
        }
      }
    }

    return {
      isSnapped,
      snappedX,
      snappedZ,
      guide: snapGuide
    };
  }

  private renderWallToWallSnapGuide(snapRes: { isSnapped: boolean; guide?: WallToWallSnapGuide | null }) {
    this.clearWallSnapGuides();
    if (!snapRes.isSnapped) return;

    const laserMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4, // Cyan
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false
    });

    if (snapRes.guide) {
      const g = snapRes.guide;
      const dx = Math.abs(g.xEnd - g.xStart);
      const dz = Math.abs(g.zEnd - g.zStart);
      const dy = Math.max(50, g.yMax - g.yMin);
      const planeGeo = new THREE.PlaneGeometry(Math.max(20, Math.hypot(dx, dz)), dy);
      const planeMesh = new THREE.Mesh(planeGeo, laserMat);
      planeMesh.position.set(
        (g.xStart + g.xEnd) / 2,
        (g.yMin + g.yMax) / 2,
        (g.zStart + g.zEnd) / 2
      );
      if (dx > dz) {
        planeMesh.rotation.y = 0;
      } else {
        planeMesh.rotation.y = Math.PI / 2;
      }
      planeMesh.renderOrder = 999;
      this.wallSnapGuideGroup.add(planeMesh);
    }

    const badgeSprite = this.createWallSnapBadge('🧲 Unión de Muros · 0 mm');
    if (badgeSprite && snapRes.guide) {
      badgeSprite.position.set(
        (snapRes.guide.xStart + snapRes.guide.xEnd) / 2,
        Math.min(2600, snapRes.guide.yMax + 80),
        (snapRes.guide.zStart + snapRes.guide.zEnd) / 2
      );
      this.wallSnapGuideGroup.add(badgeSprite);
    }
  }

  private calculateWallSnap(
    bounds: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      minZ: number;
      maxZ: number;
    },
    threshold = 45
  ): WallSnapResult {
    // El imán de paredes solo actúa en Modo Habitación 3D
    if (this.workspaceMode() !== 'room') {
      return {
        isSnappedX: false,
        isSnappedZ: false,
        correctedX: bounds.minX,
        correctedZ: bounds.minZ,
        deltaX: 0,
        deltaZ: 0
      };
    }

    const config = this.roomConfig();
    const walls = getResolvedRoomWalls(config).filter(w => !w.isHidden);

    let deltaX = 0;
    let deltaZ = 0;
    let isSnappedX = false;
    let isSnappedZ = false;
    let minCandidateDistZ = threshold + 1;
    let minCandidateDistX = threshold + 1;
    let contactZInfo: {
      xStart: number;
      xEnd: number;
      yMin: number;
      yMax: number;
      z: number;
    } | null = null;
    let contactXInfo: {
      zStart: number;
      zEnd: number;
      yMin: number;
      yMax: number;
      x: number;
    } | null = null;
    let snappedWallId: string | undefined = undefined;
    let suggestedFacing: 'front' | 'right' | 'back' | 'left' | undefined = undefined;

    for (const wall of walls) {
      const isHoriz = wall.rotationY === 0 || wall.rotationY === 180;
      const halfL = wall.length / 2;
      const halfT = wall.thickness / 2;

      if (isHoriz) {
        // Muro horizontal a lo largo de X
        const wallMinX = wall.posX - halfL;
        const wallMaxX = wall.posX + halfL;
        const inSpan = bounds.maxX >= wallMinX - 150 && bounds.minX <= wallMaxX + 150;
        if (inSpan) {
          // Cara Frontal (+Z)
          const frontZ = wall.posZ + halfT;
          const distFront = bounds.minZ - frontZ;
          if (distFront <= threshold && distFront >= -(wall.thickness + 250)) {
            const absD = Math.abs(distFront);
            if (absD < minCandidateDistZ) {
              minCandidateDistZ = absD;
              deltaZ = frontZ - bounds.minZ;
              isSnappedZ = true;
              snappedWallId = wall.id;
              suggestedFacing = 'front';
              contactZInfo = {
                xStart: Math.max(wallMinX, bounds.minX),
                xEnd: Math.min(wallMaxX, bounds.maxX),
                yMin: Math.max(0, bounds.minY),
                yMax: Math.max(bounds.minY + 20, bounds.maxY),
                z: frontZ + 0.8
              };
            }
          }

          // Cara Posterior (-Z)
          const rearZ = wall.posZ - halfT;
          const distRear = rearZ - bounds.maxZ;
          if (distRear <= threshold && distRear >= -(wall.thickness + 250)) {
            const absD = Math.abs(distRear);
            if (absD < minCandidateDistZ) {
              minCandidateDistZ = absD;
              deltaZ = rearZ - bounds.maxZ;
              isSnappedZ = true;
              snappedWallId = wall.id;
              suggestedFacing = 'back';
              contactZInfo = {
                xStart: Math.max(wallMinX, bounds.minX),
                xEnd: Math.min(wallMaxX, bounds.maxX),
                yMin: Math.max(0, bounds.minY),
                yMax: Math.max(bounds.minY + 20, bounds.maxY),
                z: rearZ - 0.8
              };
            }
          }
        }
      } else {
        // Muro vertical a lo largo de Z
        const wallMinZ = wall.posZ - halfL;
        const wallMaxZ = wall.posZ + halfL;
        const inSpan = bounds.maxZ >= wallMinZ - 150 && bounds.minZ <= wallMaxZ + 150;
        if (inSpan) {
          // Cara Derecha (+X)
          const rightX = wall.posX + halfT;
          const distRight = bounds.minX - rightX;
          if (distRight <= threshold && distRight >= -(wall.thickness + 250)) {
            const absD = Math.abs(distRight);
            if (absD < minCandidateDistX) {
              minCandidateDistX = absD;
              deltaX = rightX - bounds.minX;
              isSnappedX = true;
              snappedWallId = wall.id;
              suggestedFacing = 'right';
              contactXInfo = {
                zStart: Math.max(wallMinZ, bounds.minZ),
                zEnd: Math.min(wallMaxZ, bounds.maxZ),
                yMin: Math.max(0, bounds.minY),
                yMax: Math.max(bounds.minY + 20, bounds.maxY),
                x: rightX + 0.8
              };
            }
          }

          // Cara Izquierda (-X)
          const leftX = wall.posX - halfT;
          const distLeft = leftX - bounds.maxX;
          if (distLeft <= threshold && distLeft >= -(wall.thickness + 250)) {
            const absD = Math.abs(distLeft);
            if (absD < minCandidateDistX) {
              minCandidateDistX = absD;
              deltaX = leftX - bounds.maxX;
              isSnappedX = true;
              snappedWallId = wall.id;
              suggestedFacing = 'left';
              contactXInfo = {
                zStart: Math.max(wallMinZ, bounds.minZ),
                zEnd: Math.min(wallMaxZ, bounds.maxZ),
                yMin: Math.max(0, bounds.minY),
                yMax: Math.max(bounds.minY + 20, bounds.maxY),
                x: leftX - 0.8
              };
            }
          }
        }
      }
    }

    const res: WallSnapResult = {
      isSnappedX,
      isSnappedZ,
      correctedX: bounds.minX + deltaX,
      correctedZ: bounds.minZ + deltaZ,
      deltaX,
      deltaZ,
      snappedWallType: (isSnappedX && isSnappedZ) ? 'corner' : isSnappedZ ? 'main' : isSnappedX ? 'side' : undefined,
      snappedWallId,
      suggestedFacing
    };

    if (isSnappedX || isSnappedZ) {
      res.contactGuide = {};
      if (contactZInfo) {
        res.contactGuide.mainWallContact = {
          ...contactZInfo,
          xStart: contactZInfo.xStart + deltaX,
          xEnd: contactZInfo.xEnd + deltaX
        };
      }
      if (contactXInfo) {
        res.contactGuide.sideWallContact = {
          ...contactXInfo,
          zStart: contactXInfo.zStart + deltaZ,
          zEnd: contactXInfo.zEnd + deltaZ
        };
      }
    }

    return res;
  }

  private clearWallSnapGuides() {
    while (this.wallSnapGuideGroup.children.length > 0) {
      const obj = this.wallSnapGuideGroup.children[0];
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry) obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      } else if (obj instanceof THREE.Sprite) {
        if (obj.material.map && !obj.material.map.userData?.['isShared']) obj.material.map.dispose();
        if (obj.material && !obj.material.userData?.['isShared']) obj.material.dispose();
      }
      this.wallSnapGuideGroup.remove(obj);
    }
  }

  private renderWallSnapGuides(snapResult: WallSnapResult) {
    this.clearWallSnapGuides();
    if (!snapResult.contactGuide) return;

    const { mainWallContact, sideWallContact } = snapResult.contactGuide;

    const laserMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.95
    });

    const washMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    if (mainWallContact) {
      const { xStart, xEnd, yMin, yMax, z } = mainWallContact;
      const width = Math.max(10, xEnd - xStart);
      const height = Math.max(10, yMax - yMin);
      const centerX = (xStart + xEnd) / 2;
      const centerY = (yMin + yMax) / 2;

      const washGeo = new THREE.PlaneGeometry(width, height);
      const washMesh = new THREE.Mesh(washGeo, washMat);
      washMesh.position.set(centerX, centerY, z);
      this.wallSnapGuideGroup.add(washMesh);

      const lineT = 3.5;
      const topSeamGeo = new THREE.BoxGeometry(width, lineT, 1.5);
      const topSeam = new THREE.Mesh(topSeamGeo, laserMat);
      topSeam.position.set(centerX, yMax, z + 0.3);
      this.wallSnapGuideGroup.add(topSeam);

      const bottomSeamGeo = new THREE.BoxGeometry(width, lineT, 1.5);
      const bottomSeam = new THREE.Mesh(bottomSeamGeo, laserMat);
      bottomSeam.position.set(centerX, yMin, z + 0.3);
      this.wallSnapGuideGroup.add(bottomSeam);

      const labelText = sideWallContact ? '🧲 Muros en Escuadra · 0 mm' : '🧲 Muro Posterior · 0 mm';
      const badgeSprite = this.createWallSnapBadge(labelText);
      badgeSprite.position.set(centerX, Math.min(2500, yMax + 75), z + 1.2);
      this.wallSnapGuideGroup.add(badgeSprite);
    }

    if (sideWallContact) {
      const { zStart, zEnd, yMin, yMax, x } = sideWallContact;
      const depth = Math.max(10, zEnd - zStart);
      const height = Math.max(10, yMax - yMin);
      const centerZ = (zStart + zEnd) / 2;
      const centerY = (yMin + yMax) / 2;

      const washGeo = new THREE.PlaneGeometry(depth, height);
      const washMesh = new THREE.Mesh(washGeo, washMat);
      washMesh.rotation.y = Math.PI / 2;
      washMesh.position.set(x, centerY, centerZ);
      this.wallSnapGuideGroup.add(washMesh);

      const lineT = 3.5;
      const topSeamGeo = new THREE.BoxGeometry(1.5, lineT, depth);
      const topSeam = new THREE.Mesh(topSeamGeo, laserMat);
      topSeam.position.set(x + 0.3, yMax, centerZ);
      this.wallSnapGuideGroup.add(topSeam);

      const bottomSeamGeo = new THREE.BoxGeometry(1.5, lineT, depth);
      const bottomSeam = new THREE.Mesh(bottomSeamGeo, laserMat);
      bottomSeam.position.set(x + 0.3, yMin, centerZ);
      this.wallSnapGuideGroup.add(bottomSeam);

      if (!mainWallContact) {
        const badgeSprite = this.createWallSnapBadge('🧲 Muro Lateral Izquierdo · 0 mm');
        badgeSprite.position.set(x + 1.2, Math.min(2500, yMax + 75), centerZ);
        this.wallSnapGuideGroup.add(badgeSprite);
      }
    }

    const { rightWallContact } = snapResult.contactGuide;
    if (rightWallContact) {
      const { zStart, zEnd, yMin, yMax, x } = rightWallContact;
      const depth = Math.max(10, zEnd - zStart);
      const height = Math.max(10, yMax - yMin);
      const centerZ = (zStart + zEnd) / 2;
      const centerY = (yMin + yMax) / 2;

      const washGeo = new THREE.PlaneGeometry(depth, height);
      const washMesh = new THREE.Mesh(washGeo, washMat);
      washMesh.rotation.y = -Math.PI / 2;
      washMesh.position.set(x, centerY, centerZ);
      this.wallSnapGuideGroup.add(washMesh);

      const lineT = 3.5;
      const topSeamGeo = new THREE.BoxGeometry(1.5, lineT, depth);
      const topSeam = new THREE.Mesh(topSeamGeo, laserMat);
      topSeam.position.set(x - 0.3, yMax, centerZ);
      this.wallSnapGuideGroup.add(topSeam);

      const bottomSeamGeo = new THREE.BoxGeometry(1.5, lineT, depth);
      const bottomSeam = new THREE.Mesh(bottomSeamGeo, laserMat);
      bottomSeam.position.set(x - 0.3, yMin, centerZ);
      this.wallSnapGuideGroup.add(bottomSeam);

      if (!mainWallContact) {
        const badgeSprite = this.createWallSnapBadge('🧲 Muro Lateral Derecho U · 0 mm');
        badgeSprite.position.set(x - 1.2, Math.min(2500, yMax + 75), centerZ);
        this.wallSnapGuideGroup.add(badgeSprite);
      }
    }
  }

  private createWallSnapBadge(text: string): THREE.Sprite {
    const mat = this.getCachedBadgeMaterial(`wall_snap_${text}`, 400, 76, (ctx) => {
      ctx.clearRect(0, 0, 400, 76);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(8, 8, 400 - 16, 76 - 16, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 200, 38);
    });

    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(300, 57, 1);
    return sprite;
  }

  // --- SMART MAGNETIC SNAP & SUPPORT OVER TABLE LEGS ---
  private applyTableLegSnap(
    part: Part,
    proposedPos: { x: number; y: number; z: number },
    direction: 'up' | 'down' | 'any' = 'any',
    threshold = 25
  ): { pos: { x: number; y: number; z: number }; isSnapped: boolean; snappedLeg: ApplianceItem | null; legTopY: number } {
    const defaultRes = { pos: proposedPos, isSnapped: false, snappedLeg: null, legTopY: 0 };
    if (!this.isMagneticSnap()) return defaultRes;

    const legs = this.appliances().filter(a => a.type === 'table_leg' || a.type === 'table_legs_set');
    if (legs.length === 0) return defaultRes;

    const movingBounds = this.getPartBounds(part, proposedPos);
    const movingHalfH = movingBounds.sy / 2;
    const proposedMinY = proposedPos.y - movingHalfH;

    for (const leg of legs) {
      const legBaseY = leg.position.y ?? 0;
      const legHeight = leg.height || 720;
      const legTopY = legBaseY + legHeight;

      const distFromTop = proposedMinY - legTopY;
      if (direction === 'up' && distFromTop > 2) {
        continue;
      }

      const rot = ((leg.rotation || 0) % 360 + 360) % 360;
      const isRot90 = rot === 90 || rot === 270;
      const legDimX = isRot90 ? (leg.depth || 600) : (leg.width || 600);
      const legDimZ = isRot90 ? (leg.width || 600) : (leg.depth || 600);

      const halfW = legDimX / 2;
      const halfD = legDimZ / 2;
      const legMinX = (leg.position.x ?? 0) - halfW;
      const legMaxX = (leg.position.x ?? 0) + halfW;
      const legMinZ = (leg.position.z ?? 0) - halfD;
      const legMaxZ = (leg.position.z ?? 0) + halfD;

      const catchment = 60;
      const overlapX = movingBounds.minX <= legMaxX + catchment && movingBounds.maxX >= legMinX - catchment;
      const overlapZ = movingBounds.minZ <= legMaxZ + catchment && movingBounds.maxZ >= legMinZ - catchment;

      if (!overlapX || !overlapZ) continue;

      const isApproachingAbove = distFromTop >= 0 && distFromTop <= threshold;
      const isAttemptingToSink = distFromTop < 0 && distFromTop >= -threshold && direction !== 'up';

      if (isApproachingAbove || isAttemptingToSink) {
        const snappedY = legTopY + movingHalfH;
        let snappedX = proposedPos.x;
        let snappedZ = proposedPos.z;

        if (Math.abs(proposedPos.x - leg.position.x) <= 25) {
          snappedX = leg.position.x;
        }
        if (Math.abs(proposedPos.z - leg.position.z) <= 25) {
          snappedZ = leg.position.z;
        }

        return {
          pos: { x: snappedX, y: snappedY, z: snappedZ },
          isSnapped: true,
          snappedLeg: leg,
          legTopY
        };
      }
    }

    return defaultRes;
  }

  private clearLegSnapGuides() {
    while (this.legSnapGuideGroup.children.length > 0) {
      const obj = this.legSnapGuideGroup.children[0];
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry) obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      } else if (obj instanceof THREE.LineSegments) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) obj.material.dispose();
      } else if (obj instanceof THREE.Sprite) {
        if (obj.material.map && !obj.material.map.userData?.['isShared']) obj.material.map.dispose();
        if (obj.material && !obj.material.userData?.['isShared']) obj.material.dispose();
      }
      this.legSnapGuideGroup.remove(obj);
    }
  }

  private renderLegSnapGuides(leg: ApplianceItem, part: Part, legTopY: number, targetPos: { x: number; y: number; z: number }) {
    this.clearLegSnapGuides();

    const partBounds = this.getPartBounds(part, targetPos);
    const rot = ((leg.rotation || 0) % 360 + 360) % 360;
    const isRot90 = rot === 90 || rot === 270;
    const legDimX = isRot90 ? (leg.depth || 600) : (leg.width || 600);
    const legDimZ = isRot90 ? (leg.width || 600) : (leg.depth || 600);

    const minX = Math.max(partBounds.minX, leg.position.x - legDimX / 2);
    const maxX = Math.min(partBounds.maxX, leg.position.x + legDimX / 2);
    const minZ = Math.max(partBounds.minZ, leg.position.z - legDimZ / 2);
    const maxZ = Math.min(partBounds.maxZ, leg.position.z + legDimZ / 2);

    const contactW = Math.max(80, maxX - minX);
    const contactD = Math.max(80, maxZ - minZ);
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const washGeo = new THREE.PlaneGeometry(contactW, contactD);
    const washMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const washMesh = new THREE.Mesh(washGeo, washMat);
    washMesh.rotation.x = -Math.PI / 2;
    washMesh.position.set(centerX, legTopY + 0.6, centerZ);
    this.legSnapGuideGroup.add(washMesh);

    const boxGeo = new THREE.BoxGeometry(contactW, 3, contactD);
    const edgeLinesGeo = new THREE.EdgesGeometry(boxGeo);
    const laserMat = new THREE.LineBasicMaterial({
      color: 0x34d399,
      linewidth: 3,
      depthTest: false
    });
    const perimeterLines = new THREE.LineSegments(edgeLinesGeo, laserMat);
    perimeterLines.position.set(centerX, legTopY + 0.8, centerZ);
    this.legSnapGuideGroup.add(perimeterLines);

    const badgeText = `🧲 Apoyo en Patas de Mesa · Cota Superior (${legTopY} mm)`;
    const badgeSprite = this.createLegSnapBadge(badgeText);
    badgeSprite.position.set(centerX, Math.max(legTopY + 80, partBounds.maxY + 60), centerZ);
    this.legSnapGuideGroup.add(badgeSprite);
  }

  private createLegSnapBadge(text: string): THREE.Sprite {
    const mat = this.getCachedBadgeMaterial(`leg_snap_${text}`, 460, 76, (ctx) => {
      ctx.clearRect(0, 0, 460, 76);
      ctx.fillStyle = 'rgba(6, 78, 59, 0.95)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(8, 8, 460 - 16, 76 - 16, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#6ee7b7';
      ctx.font = 'bold 21px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 230, 38);
    });

    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(340, 56, 1);
    return sprite;
  }

  private clearPartSnapGuides() {
    while (this.magneticSnapGroup.children.length > 0) {
      const obj = this.magneticSnapGroup.children[0];
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry) obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      } else if (obj instanceof THREE.LineSegments) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) obj.material.dispose();
      } else if (obj instanceof THREE.Sprite) {
        if (obj.material.map && !obj.material.map.userData?.['isShared']) obj.material.map.dispose();
        if (obj.material && !obj.material.userData?.['isShared']) obj.material.dispose();
      }
      this.magneticSnapGroup.remove(obj);
    }
  }

  private renderPartSnapGuides(
    movingPart: Part,
    targetPart: Part,
    snapFace: number | null,
    axis: 'x' | 'y' | 'z',
    movingPos: { x: number; y: number; z: number }
  ) {
    this.clearPartSnapGuides();

    const movingBounds = this.getPartBounds(movingPart, movingPos);
    const targetBounds = this.getPartBounds(targetPart);

    const laserMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 3,
      depthTest: false
    });

    const washMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    let centerX = (movingBounds.minX + movingBounds.maxX) / 2;
    let centerY = (movingBounds.minY + movingBounds.maxY) / 2;
    let centerZ = (movingBounds.minZ + movingBounds.maxZ) / 2;
    let width = 60;
    let height = 60;
    let depth = 60;

    if (axis === 'y') {
      const minX = Math.max(movingBounds.minX, targetBounds.minX);
      const maxX = Math.min(movingBounds.maxX, targetBounds.maxX);
      const minZ = Math.max(movingBounds.minZ, targetBounds.minZ);
      const maxZ = Math.min(movingBounds.maxZ, targetBounds.maxZ);
      width = Math.max(60, maxX - minX);
      depth = Math.max(60, maxZ - minZ);
      centerX = (minX + maxX) / 2;
      centerZ = (minZ + maxZ) / 2;
      centerY = snapFace ?? movingBounds.minY;

      const washGeo = new THREE.PlaneGeometry(width, depth);
      const washMesh = new THREE.Mesh(washGeo, washMat);
      washMesh.rotation.x = -Math.PI / 2;
      washMesh.position.set(centerX, centerY, centerZ);
      this.magneticSnapGroup.add(washMesh);

      const boxGeo = new THREE.BoxGeometry(width, 3, depth);
      const edges = new THREE.EdgesGeometry(boxGeo);
      const perimeterLines = new THREE.LineSegments(edges, laserMat);
      perimeterLines.position.set(centerX, centerY, centerZ);
      this.magneticSnapGroup.add(perimeterLines);
    } else if (axis === 'x') {
      const minY = Math.max(movingBounds.minY, targetBounds.minY);
      const maxY = Math.min(movingBounds.maxY, targetBounds.maxY);
      const minZ = Math.max(movingBounds.minZ, targetBounds.minZ);
      const maxZ = Math.min(movingBounds.maxZ, targetBounds.maxZ);
      height = Math.max(60, maxY - minY);
      depth = Math.max(60, maxZ - minZ);
      centerY = (minY + maxY) / 2;
      centerZ = (minZ + maxZ) / 2;
      centerX = snapFace ?? movingBounds.minX;

      const washGeo = new THREE.PlaneGeometry(depth, height);
      const washMesh = new THREE.Mesh(washGeo, washMat);
      washMesh.rotation.y = Math.PI / 2;
      washMesh.position.set(centerX, centerY, centerZ);
      this.magneticSnapGroup.add(washMesh);

      const boxGeo = new THREE.BoxGeometry(3, height, depth);
      const edges = new THREE.EdgesGeometry(boxGeo);
      const perimeterLines = new THREE.LineSegments(edges, laserMat);
      perimeterLines.position.set(centerX, centerY, centerZ);
      this.magneticSnapGroup.add(perimeterLines);
    } else {
      const minX = Math.max(movingBounds.minX, targetBounds.minX);
      const maxX = Math.min(movingBounds.maxX, targetBounds.maxX);
      const minY = Math.max(movingBounds.minY, targetBounds.minY);
      const maxY = Math.min(movingBounds.maxY, targetBounds.maxY);
      width = Math.max(60, maxX - minX);
      height = Math.max(60, maxY - minY);
      centerX = (minX + maxX) / 2;
      centerY = (minY + maxY) / 2;
      centerZ = snapFace ?? movingBounds.minZ;

      const washGeo = new THREE.PlaneGeometry(width, height);
      const washMesh = new THREE.Mesh(washGeo, washMat);
      washMesh.position.set(centerX, centerY, centerZ);
      this.magneticSnapGroup.add(washMesh);

      const boxGeo = new THREE.BoxGeometry(width, height, 3);
      const edges = new THREE.EdgesGeometry(boxGeo);
      const perimeterLines = new THREE.LineSegments(edges, laserMat);
      perimeterLines.position.set(centerX, centerY, centerZ);
      this.magneticSnapGroup.add(perimeterLines);
    }

    const targetLabel = targetPart.groupName || targetPart.moduleName || targetPart.name || 'Pieza';
    const badgeText = `🧲 Imán: ${targetLabel} · Contacto 0 mm`;
    const badgeSprite = this.createPartSnapBadge(badgeText);
    badgeSprite.position.set(centerX, Math.max(centerY + 70, movingBounds.maxY + 50), centerZ);
    this.magneticSnapGroup.add(badgeSprite);
  }

  private createPartSnapBadge(text: string): THREE.Sprite {
    const mat = this.getCachedBadgeMaterial(`part_snap_${text}`, 460, 76, (ctx) => {
      ctx.clearRect(0, 0, 460, 76);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(8, 8, 460 - 16, 76 - 16, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 21px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 230, 38);
    });

    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(340, 56, 1);
    return sprite;
  }

  /**
   * Calcula el imán magnético entre la caja envolvente exterior de un módulo/grupo arrastrado
   * y otros módulos o piezas externas, permitiendo adosar muebles lado a lado, alinearlos al fondo
   * o apilarlos verticalmente sin deformar el conjunto ni hundirlo bajo el suelo (Y = 0).
   */
  private calculateGroupMagneticSnap(
    groupParts: Part[],
    externalParts: Part[],
    deltas: { effDx: number; effDy: number; effDz: number },
    threshold = 38
  ): {
    effDx: number;
    effDy: number;
    effDz: number;
    snappedX: boolean;
    snappedY: boolean;
    snappedZ: boolean;
    isSnapped: boolean;
    snappedPair: { moving: Part; target: Part; snapFace: number; axis: 'x' | 'y' | 'z'; pos: { x: number; y: number; z: number } } | null;
  } {
    let resDx = deltas.effDx;
    let resDy = deltas.effDy;
    let resDz = deltas.effDz;
    let snappedX = false;
    let snappedY = false;
    let snappedZ = false;
    let snappedPair: { moving: Part; target: Part; snapFace: number; axis: 'x' | 'y' | 'z'; pos: { x: number; y: number; z: number } } | null = null;

    // 1. Calcular la caja envolvente inicial y propuesta del grupo en movimiento
    let initGrpMinX = Infinity, initGrpMaxX = -Infinity;
    let initGrpMinY = Infinity, initGrpMaxY = -Infinity;
    let initGrpMinZ = Infinity, initGrpMaxZ = -Infinity;

    for (const gp of groupParts) {
      const b = this.getPartBounds(gp);
      initGrpMinX = Math.min(initGrpMinX, b.minX);
      initGrpMaxX = Math.max(initGrpMaxX, b.maxX);
      initGrpMinY = Math.min(initGrpMinY, b.minY);
      initGrpMaxY = Math.max(initGrpMaxY, b.maxY);
      initGrpMinZ = Math.min(initGrpMinZ, b.minZ);
      initGrpMaxZ = Math.max(initGrpMaxZ, b.maxZ);
    }

    const propMinX = initGrpMinX + deltas.effDx;
    const propMaxX = initGrpMaxX + deltas.effDx;
    const propMinY = initGrpMinY + deltas.effDy;
    const propMaxY = initGrpMaxY + deltas.effDy;
    const propMinZ = initGrpMinZ + deltas.effDz;
    const propMaxZ = initGrpMaxZ + deltas.effDz;

    // 2. Construir objetivos externos: cajas envolventes por cada grupo externo + piezas sueltas
    const visibleExternals = externalParts.filter(ep => !this.hiddenPartIds().has(ep.id));
    const targetBoxes: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number; repPart: Part }[] = [];

    const externalGroupsMap = new Map<string, Part[]>();
    for (const ep of visibleExternals) {
      if (ep.groupId) {
        const list = externalGroupsMap.get(ep.groupId) || [];
        list.push(ep);
        externalGroupsMap.set(ep.groupId, list);
      } else {
        const eb = this.getPartBounds(ep);
        targetBoxes.push({ ...eb, repPart: ep });
      }
    }

    for (const [, gParts] of externalGroupsMap.entries()) {
      let gMinX = Infinity, gMaxX = -Infinity;
      let gMinY = Infinity, gMaxY = -Infinity;
      let gMinZ = Infinity, gMaxZ = -Infinity;
      for (const p of gParts) {
        const b = this.getPartBounds(p);
        gMinX = Math.min(gMinX, b.minX);
        gMaxX = Math.max(gMaxX, b.maxX);
        gMinY = Math.min(gMinY, b.minY);
        gMaxY = Math.max(gMaxY, b.maxY);
        gMinZ = Math.min(gMinZ, b.minZ);
        gMaxZ = Math.max(gMaxZ, b.maxZ);
      }
      targetBoxes.push({
        minX: gMinX,
        maxX: gMaxX,
        minY: gMinY,
        maxY: gMaxY,
        minZ: gMinZ,
        maxZ: gMaxZ,
        repPart: gParts[0]
      });
    }

    let bestDistX = threshold;
    let bestDistY = threshold;
    let bestDistZ = threshold;
    const catchment = 140;
    const repMovingPart = groupParts[0];

    for (const ext of targetBoxes) {
      const overlapX = propMinX <= ext.maxX + catchment && propMaxX >= ext.minX - catchment;
      const overlapY = propMinY <= ext.maxY + catchment && propMaxY >= ext.minY - catchment;
      const overlapZ = propMinZ <= ext.maxZ + catchment && propMaxZ >= ext.minZ - catchment;

      // --- EJE X (Adosar módulos lado a lado o enrasar laterales) ---
      if (overlapY && overlapZ) {
        const xCandidates = [
          { corr: ext.maxX - propMinX, face: ext.maxX }, // Lateral izq toca lateral der externo
          { corr: ext.minX - propMaxX, face: ext.minX }, // Lateral der toca lateral izq externo
          { corr: ext.minX - propMinX, face: ext.minX }, // Enrasar caras izquierdas
          { corr: ext.maxX - propMaxX, face: ext.maxX }  // Enrasar caras derechas
        ];
        for (const cand of xCandidates) {
          const dist = Math.abs(cand.corr);
          if (dist < bestDistX) {
            bestDistX = dist;
            resDx = Math.round(deltas.effDx + cand.corr);
            snappedX = true;
            snappedPair = {
              moving: repMovingPart,
              target: ext.repPart,
              snapFace: cand.face,
              axis: 'x',
              pos: {
                x: (repMovingPart.posX ?? 0) + resDx,
                y: (repMovingPart.posY ?? 0) + resDy,
                z: (repMovingPart.posZ ?? 0) + resDz
              }
            };
          }
        }
      }

      // --- EJE Z (Alinear espaldas/frentes o adosar en profundidad) ---
      if (overlapX && overlapY) {
        const zCandidates = [
          { corr: ext.minZ - propMinZ, face: ext.minZ }, // Enrasar fondos traseros
          { corr: ext.maxZ - propMaxZ, face: ext.maxZ }, // Enrasar frentes
          { corr: ext.maxZ - propMinZ, face: ext.maxZ }, // Fondo toca frente externo
          { corr: ext.minZ - propMaxZ, face: ext.minZ }  // Frente toca fondo externo
        ];
        for (const cand of zCandidates) {
          const dist = Math.abs(cand.corr);
          if (dist < bestDistZ) {
            bestDistZ = dist;
            resDz = Math.round(deltas.effDz + cand.corr);
            snappedZ = true;
            if (!snappedX) {
              snappedPair = {
                moving: repMovingPart,
                target: ext.repPart,
                snapFace: cand.face,
                axis: 'z',
                pos: {
                  x: (repMovingPart.posX ?? 0) + resDx,
                  y: (repMovingPart.posY ?? 0) + resDy,
                  z: (repMovingPart.posZ ?? 0) + resDz
                }
              };
            }
          }
        }
      }

      // --- EJE Y (Apilar módulos verticalmente o nivelar alturas) ---
      if (overlapX && overlapZ) {
        const yCandidates = [
          { corr: ext.maxY - propMinY, face: ext.maxY }, // Apoyar base sobre techo de otro módulo
          { corr: ext.minY - propMaxY, face: ext.minY }, // Tocar con techo la base de módulo superior
          { corr: ext.maxY - propMaxY, face: ext.maxY }, // Nivelar techos (ej. alacenas aéreas)
          { corr: ext.minY - propMinY, face: ext.minY }  // Nivelar bases
        ];
        for (const cand of yCandidates) {
          const candidateNewMinY = initGrpMinY + deltas.effDy + cand.corr;
          if (candidateNewMinY < -0.5) continue; // Nunca permitir que el imán hunda el módulo bajo el suelo
          const dist = Math.abs(cand.corr);
          if (dist < bestDistY) {
            bestDistY = dist;
            resDy = Math.round(deltas.effDy + cand.corr);
            snappedY = true;
            if (!snappedX && !snappedZ) {
              snappedPair = {
                moving: repMovingPart,
                target: ext.repPart,
                snapFace: cand.face,
                axis: 'y',
                pos: {
                  x: (repMovingPart.posX ?? 0) + resDx,
                  y: (repMovingPart.posY ?? 0) + resDy,
                  z: (repMovingPart.posZ ?? 0) + resDz
                }
              };
            }
          }
        }
      }
    }

    // Garantizar que el delta Y nunca hunda la base del módulo por debajo de Y = 0
    const minAllowedDy = -initGrpMinY;
    resDy = Math.max(minAllowedDy, resDy);

    return {
      effDx: resDx,
      effDy: resDy,
      effDz: resDz,
      snappedX,
      snappedY,
      snappedZ,
      isSnapped: snappedX || snappedY || snappedZ,
      snappedPair
    };
  }

  private applyMagneticSnapToStretch(
    part: Part,
    targetDimension: 'length' | 'width' | 'thickness',
    posAxis: 'posX' | 'posY' | 'posZ',
    dir: number,
    steppedDelta: number,
    threshold = 14
  ): { dim: number; pos: number; isSnapped?: boolean; snappedPart?: Part | null; snapFace?: number | null } {
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
      return { dim: proposedDim, pos: defPos, isSnapped: false, snappedPart: null, snapFace: null };
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
    let bestCandidatePart: Part | null = null;
    let bestScore = threshold;

    for (const other of otherParts) {
      const otherBounds = this.getPartBounds(other);

      if (posAxis === 'posX') {
        const nearY = initBounds.minY < otherBounds.maxY + 450 && initBounds.maxY > otherBounds.minY - 450;
        const nearZ = initBounds.minZ < otherBounds.maxZ + 450 && initBounds.maxZ > otherBounds.minZ - 450;
        if (!nearY || !nearZ) continue;
        const directTouch = initBounds.minY < otherBounds.maxY + 60 && initBounds.maxY > otherBounds.minY - 60 &&
                            initBounds.minZ < otherBounds.maxZ + 60 && initBounds.maxZ > otherBounds.minZ - 60;

        for (const face of [otherBounds.minX, otherBounds.maxX]) {
          const dist = Math.abs(proposedMovingFace - face);
          const score = directTouch ? dist : dist + 1.5;
          if (dist < threshold && score < bestScore) {
            bestScore = score;
            bestCandidateFace = face;
            bestCandidatePart = other;
          }
        }
      } else if (posAxis === 'posY') {
        const nearX = initBounds.minX < otherBounds.maxX + 450 && initBounds.maxX > otherBounds.minX - 450;
        const nearZ = initBounds.minZ < otherBounds.maxZ + 450 && initBounds.maxZ > otherBounds.minZ - 450;
        if (!nearX || !nearZ) continue;
        const directTouch = initBounds.minX < otherBounds.maxX + 60 && initBounds.maxX > otherBounds.minX - 60 &&
                            initBounds.minZ < otherBounds.maxZ + 60 && initBounds.maxZ > otherBounds.minZ - 60;

        for (const face of [otherBounds.minY, otherBounds.maxY]) {
          const dist = Math.abs(proposedMovingFace - face);
          const score = directTouch ? dist : dist + 1.5;
          if (dist < threshold && score < bestScore) {
            bestScore = score;
            bestCandidateFace = face;
            bestCandidatePart = other;
          }
        }
      } else if (posAxis === 'posZ') {
        const nearX = initBounds.minX < otherBounds.maxX + 450 && initBounds.maxX > otherBounds.minX - 450;
        const nearY = initBounds.minY < otherBounds.maxY + 450 && initBounds.maxY > otherBounds.minY - 450;
        if (!nearX || !nearY) continue;
        const directTouch = initBounds.minX < otherBounds.maxX + 60 && initBounds.maxX > otherBounds.minX - 60 &&
                            initBounds.minY < otherBounds.maxY + 60 && initBounds.maxY > otherBounds.minY - 60;

        for (const face of [otherBounds.minZ, otherBounds.maxZ]) {
          const dist = Math.abs(proposedMovingFace - face);
          const score = directTouch ? dist : dist + 1.5;
          if (dist < threshold && score < bestScore) {
            bestScore = score;
            bestCandidateFace = face;
            bestCandidatePart = other;
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
        return {
          dim: snappedDim,
          pos: snappedPos,
          isSnapped: true,
          snappedPart: bestCandidatePart,
          snapFace: bestCandidateFace
        };
      }
    }

    return { dim: proposedDim, pos: defPos, isSnapped: false, snappedPart: null, snapFace: null };
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
    this.projectStorage.saveCameraState(this.camera.position, this.controls.target, true);
    this.requestRender(12);
  }

  togglePartOpen(partId: string) {
    const cur = this.openTargetMap.get(partId) || 0;
    const next = cur > 0.5 ? 0 : 1;
    this.openTargetMap.set(partId, next);

    const targetPiece = this.pieceObjects.find(p => p.part.id === partId);
    if (targetPiece) {
      // 1. If part belongs to an explicit modular drawer sub-group, synchronize parts in that drawer group only
      const isDedicatedDrawerGroup = !!targetPiece.part.groupId &&
        this.partGroups().some(g => g.id === targetPiece.part.groupId && g.type === 'drawer');

      if (isDedicatedDrawerGroup) {
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
    this.requestRender(60);
  }

  toggleAllDoorsAndDrawers() {
    const next = !this.isAllOpen();
    this.isAllOpen.set(next);
    for (const p of this.pieceObjects) {
      if (p.isDoor || p.isDrawer) {
        this.openTargetMap.set(p.part.id, next ? 1 : 0);
      }
    }
    this.requestRender(60);
  }

  private timer = new THREE.Timer();

  private updateOpeningAnimations(delta = 0.016): boolean {
    let anyAnimating = false;
    const lerpFactor = Math.min(1, delta * 9.5);
    for (const p of this.pieceObjects) {
      if (!p.isDoor && !p.isDrawer) continue;
      const tgt = this.openTargetMap.get(p.part.id) || 0;
      let cur = this.openCurrentMap.get(p.part.id) || 0;
      if (Math.abs(cur - tgt) > 0.001) {
        cur += (tgt - cur) * lerpFactor;
        this.openCurrentMap.set(p.part.id, cur);
        anyAnimating = true;
      } else {
        cur = tgt;
        this.openCurrentMap.set(p.part.id, cur);
      }

      if (p.isDoor && p.doorPivot) {
        this.applyDoorPivotRotation(p.doorPivot, p.hingeSide || 'left', p.doorFacing || 'front', cur, p.doorBaseRotation);
      } else if (p.isDrawer) {
        const expX = p.explodedOffset.x * (this.explodedPercent() / 100);
        const expY = p.explodedOffset.y * (this.explodedPercent() / 100);
        const expZ = p.explodedOffset.z * (this.explodedPercent() / 100);
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
    return anyAnimating;
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
    if (width <= 0 || height <= 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.getTargetPixelRatio());
    this.renderer.setSize(width, height);
    this.requestRender(8);
  }

  private animate(timestamp?: number) {
    if (this.isRenderingPaused) {
      return;
    }
    this.animationFrameId = requestAnimationFrame((ts) => this.animate(ts));

    // Pausar renderizado WebGL si la pestaña del navegador está en segundo plano
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }

    const container = this.containerRef()?.nativeElement;
    if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) {
      return;
    }

    this.timer.update(timestamp);
    const delta = Math.min(this.timer.getDelta(), 0.1);
    const isAnimatingOpenings = this.updateOpeningAnimations(delta);
    const controlsChanged = this.controls ? this.controls.update() : false;

    if (isAnimatingOpenings || controlsChanged || this.renderFramesRemaining > 0) {
      if (this.renderFramesRemaining > 0) {
        this.renderFramesRemaining--;
      }
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    }
  }

  // ==========================================
  // ENTORNO ARQUITECTÓNICO (HABITACIÓN 3D / COCINA)
  // ==========================================

  private updateRoomScene(mode: WorkspaceMode, config: RoomConfiguration) {
    if (!this.scene) return;

    if (mode !== 'room') {
      this.roomGroup.visible = false;
      if (this.floorMesh) this.floorMesh.visible = !this.isPerformanceMode();
      if (this.gridHelper) this.gridHelper.visible = true;
      this.requestRender(4);
      return;
    }

    this.roomGroup.visible = true;
    if (this.floorMesh) this.floorMesh.visible = false;
    if (this.gridHelper) this.gridHelper.visible = false;

    // Limpiar recursivamente geometrías y mallas anteriores del entorno (incluyendo zócalos hijos)
    this.disposeGroup(this.roomGroup);

    const {
      floorWidth,
      floorDepth,
      floorMaterial,
      showFloorGrid,
      showSkirting
    } = config;

    const effectiveFloorWidth = floorWidth || 5000;
    const effectiveFloorDepth = floorDepth || 5000;

    // 1. PISO ARQUITECTÓNICO TEXTURIZADO
    const floorGeo = new THREE.PlaneGeometry(effectiveFloorWidth, effectiveFloorDepth);
    const floorMat = ProceduralTextureFactory.getFloorMaterial(floorMaterial, effectiveFloorWidth, effectiveFloorDepth);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.5, 0);
    floor.receiveShadow = true;
    floor.userData = { isFloor: true };
    this.roomGroup.add(floor);

    // Rejilla técnica milimétrica superpuesta sobre el piso (si está activa)
    if (showFloorGrid) {
      const gridSpan = Math.max(effectiveFloorWidth, effectiveFloorDepth);
      const divisions = Math.max(10, Math.round(gridSpan / 500));
      const roomGrid = new THREE.GridHelper(gridSpan, divisions, 0x0284c7, 0x64748b);
      roomGrid.position.set(0, 0.2, 0);
      if (roomGrid.material instanceof THREE.Material) {
        roomGrid.material.opacity = 0.22;
        roomGrid.material.transparent = true;
      }
      this.roomGroup.add(roomGrid);
    }

    // 2. MUROS INDEPENDIENTES Y DIVISORIOS
    const resolvedWalls = getResolvedRoomWalls(config);
    const skirtingMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.25,
      metalness: 0.05
    });

    for (const wall of resolvedWalls) {
      if (wall.isHidden) continue;

      const wallGeo = new THREE.BoxGeometry(wall.length, wall.height, wall.thickness);
      const wallMat = ProceduralTextureFactory.getWallMaterial(
        wall.material || config.wallMaterial,
        wall.length,
        wall.height
      );
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      const rotRad = -((wall.rotationY || 0) * (Math.PI / 180));
      wallMesh.rotation.y = rotRad;
      wallMesh.position.set(wall.posX, wall.height / 2, wall.posZ);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      wallMesh.userData = { isWall: true, wallId: wall.id, wallType: wall.id };
      this.roomGroup.add(wallMesh);

      // Zócalo / Rodapié inferior (Frontal y Trasero)
      const hasSkirting = wall.showSkirting ?? showSkirting;
      if (hasSkirting) {
        const skirtingH = 100;
        const skirtingT = 16;

        // Zócalo frontal (+Z local)
        const frontSkirtingGeo = new THREE.BoxGeometry(wall.length, skirtingH, skirtingT);
        const frontSkirting = new THREE.Mesh(frontSkirtingGeo, skirtingMat);
        frontSkirting.position.set(0, -wall.height / 2 + skirtingH / 2, wall.thickness / 2 + skirtingT / 2);
        frontSkirting.castShadow = true;
        frontSkirting.receiveShadow = true;
        wallMesh.add(frontSkirting);

        // Zócalo posterior (-Z local)
        const backSkirtingGeo = new THREE.BoxGeometry(wall.length, skirtingH, skirtingT);
        const backSkirting = new THREE.Mesh(backSkirtingGeo, skirtingMat);
        backSkirting.position.set(0, -wall.height / 2 + skirtingH / 2, -wall.thickness / 2 - skirtingT / 2);
        backSkirting.castShadow = true;
        backSkirting.receiveShadow = true;
        wallMesh.add(backSkirting);
      }
    }
    this.requestRender(8);
  }

  frameRoomView() {
    if (!this.camera || !this.controls) return;
    const config = this.roomConfig();
    const effectiveFloorWidth = config.floorWidth || 5000;
    const effectiveFloorDepth = config.floorDepth || 5000;
    const frameDistance = Math.max(effectiveFloorWidth, effectiveFloorDepth) * 1.35;

    const targetX = 0;
    const targetY = (config.wallHeight || 2600) * 0.35;
    const targetZ = 0;

    const startTarget = this.controls.target.clone();
    const startCamPos = this.camera.position.clone();
    const targetCenter = new THREE.Vector3(targetX, targetY, targetZ);
    const targetCamPos = new THREE.Vector3(
      targetX + frameDistance * 0.45,
      targetY + frameDistance * 0.55,
      targetZ + frameDistance * 0.8
    );

    const startTime = performance.now();
    const duration = 500; // ms

    const animateTransition = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      this.controls.target.lerpVectors(startTarget, targetCenter, ease);
      this.camera.position.lerpVectors(startCamPos, targetCamPos, ease);
      this.controls.update();
      this.requestRender(4);

      if (progress < 1) {
        requestAnimationFrame(animateTransition);
      } else {
        this.projectStorage.saveCameraState(this.camera.position, this.controls.target, true);
      }
    };

    requestAnimationFrame(animateTransition);
  }

  // --- WALL SELECTION HIGHLIGHT & 3D GIZMO ---

  private updateWallGizmo(
    wallType: string | null,
    config: RoomConfiguration,
    mode: WorkspaceMode
  ) {
    // Clear previous wall gizmos recursively
    this.disposeGroup(this.wallGizmoGroup);
    this.wallGizmoHitMeshes = [];

    if (mode !== 'room' || !wallType) {
      this.requestRender(4);
      return;
    }

    const walls = getResolvedRoomWalls(config);
    const wall = walls.find(w => w.id === wallType);
    if (!wall || wall.isHidden || config.hiddenWalls?.[wallType]) {
      this.requestRender(4);
      return;
    }

    const rotRad = -((wall.rotationY || 0) * (Math.PI / 180));
    const posX = wall.posX;
    const posY = wall.height / 2;
    const posZ = wall.posZ;

    // 1. Highlight Outline Mesh around selected wall (Sky Blue)
    const outlineGeo = new THREE.BoxGeometry(wall.length + 8, wall.height + 8, wall.thickness + 8);
    const edgesGeo = new THREE.EdgesGeometry(outlineGeo);
    outlineGeo.dispose();
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 3,
      depthTest: false
    });
    const outlineLines = new THREE.LineSegments(edgesGeo, lineMat);
    outlineLines.position.set(posX, posY, posZ);
    outlineLines.rotation.y = rotRad;
    outlineLines.renderOrder = 998;
    this.wallGizmoGroup.add(outlineLines);

    // Si el muro está congelado / fijo, bloqueamos sus controles interactivos y mostramos únicamente el outline
    const isWallLocked = !!config.isWallsLocked || !!wall.isLocked || !!config.lockedWalls?.[wallType];
    if (isWallLocked) {
      this.requestRender(4);
      return;
    }

    // 2. Gizmo: Translation Arrows in X (Lateral) and Z (Depth)
    const arrowLen = 220;
    const arrowRadius = 14;
    const arrowHeadLen = 60;
    const arrowHeadRadius = 26;

    const createArrowMesh = (
      colorHex: number,
      axis: 'x' | 'z',
      origin: THREE.Vector3
    ) => {
      const arrowGroup = new THREE.Group();
      arrowGroup.position.copy(origin);

      const shaftGeo = new THREE.CylinderGeometry(arrowRadius, arrowRadius, arrowLen, 16);
      const headGeo = new THREE.ConeGeometry(arrowHeadRadius, arrowHeadLen, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.45,
        roughness: 0.2,
        depthTest: false
      });

      const shaft = new THREE.Mesh(shaftGeo, mat);
      const head = new THREE.Mesh(headGeo, mat);

      if (axis === 'x') {
        shaft.rotation.z = -Math.PI / 2;
        shaft.position.x = arrowLen / 2;
        head.rotation.z = -Math.PI / 2;
        head.position.x = arrowLen + arrowHeadLen / 2;
      } else {
        shaft.rotation.x = Math.PI / 2;
        shaft.position.z = arrowLen / 2;
        head.rotation.x = Math.PI / 2;
        head.position.z = arrowLen + arrowHeadLen / 2;
      }

      arrowGroup.add(shaft, head);

      // Hit collider box
      const hitBoxGeo = new THREE.BoxGeometry(
        axis === 'x' ? arrowLen + arrowHeadLen : 40,
        40,
        axis === 'z' ? arrowLen + arrowHeadLen : 40
      );
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      const hitMesh = new THREE.Mesh(hitBoxGeo, hitMat);
      hitMesh.position.set(
        axis === 'x' ? (arrowLen + arrowHeadLen) / 2 : 0,
        0,
        axis === 'z' ? (arrowLen + arrowHeadLen) / 2 : 0
      );
      hitMesh.userData = {
        isWallGizmo: true,
        type: 'wall_move',
        axis,
        wallTarget: wall.id
      };
      arrowGroup.add(hitMesh);
      this.wallGizmoHitMeshes.push(hitMesh);

      return arrowGroup;
    };

    const gizmoAnchor = new THREE.Vector3(posX, wall.height + 120, posZ);
    const arrowX = createArrowMesh(0xef4444, 'x', gizmoAnchor);
    const arrowZ = createArrowMesh(0x0284c7, 'z', gizmoAnchor);
    this.wallGizmoGroup.add(arrowX, arrowZ);

    // 3. Stretch Handle at free end of wall (Cube handle - Emerald)
    const handleSize = 36;
    const handleGeo = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.4,
      roughness: 0.2,
      depthTest: false
    });
    const handleMesh = new THREE.Mesh(handleGeo, handleMat);
    const handleEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(handleGeo),
      new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, depthTest: false })
    );
    handleMesh.add(handleEdge);

    const endDist = wall.length / 2 + handleSize / 2 + 10;
    const handleX = posX + endDist * Math.cos(rotRad);
    const handleZ = posZ - endDist * Math.sin(rotRad);
    handleMesh.position.set(handleX, posY, handleZ);
    handleMesh.rotation.y = rotRad;

    handleMesh.userData = {
      isWallGizmo: true,
      type: 'wall_stretch',
      axis: 'x',
      wallTarget: wall.id
    };
    handleMesh.renderOrder = 999;
    this.wallGizmoGroup.add(handleMesh);
    this.wallGizmoHitMeshes.push(handleMesh);

    // 4. Tirante 3D Superior de Altura (Cube handle - Amber / Eje Y)
    const topHandleGeo = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
    const topHandleMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.45,
      roughness: 0.2,
      depthTest: false
    });
    const topHandleMesh = new THREE.Mesh(topHandleGeo, topHandleMat);
    const topHandleEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(topHandleGeo),
      new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, depthTest: false })
    );
    topHandleMesh.add(topHandleEdge);
    topHandleMesh.position.set(
      posX,
      wall.height + handleSize / 2 + 8,
      posZ
    );
    topHandleMesh.userData = {
      isWallGizmo: true,
      type: 'wall_stretch_height',
      axis: 'y',
      wallTarget: wall.id
    };
    topHandleMesh.renderOrder = 999;
    this.wallGizmoGroup.add(topHandleMesh);
    this.wallGizmoHitMeshes.push(topHandleMesh);
    this.requestRender(8);
  }

  // ==========================================
  // GESTIÓN Y RENDERIZADO 3D DE ELECTRODOMÉSTICOS
  // ==========================================

  private updateAppliancesScene(appls: ApplianceItem[], selectedId: string | null) {
    if (!this.scene) return;

    // 1. Limpiar gizmos anteriores de electrodomésticos
    this.disposeGroup(this.applianceGizmoGroup);
    this.applianceHandleHitMeshes = [];
    const showAppls = this.layerVisibility().showAppliances;
    this.appliancesGroup.visible = showAppls;
    this.applianceGizmoGroup.visible = showAppls;
    if (!showAppls) {
      this.disposeGroup(this.appliancesGroup);
      this.applianceMeshMap.clear();
      this.requestRender(4);
      return;
    }

    // 2. Retirar electrodomésticos eliminados u ocultos
    const activeAppIds = new Set(appls.filter(a => !a.isHidden).map(a => a.id));
    for (const [id, grp] of this.applianceMeshMap.entries()) {
      if (!activeAppIds.has(id)) {
        this.appliancesGroup.remove(grp);
        this.disposeGroup(grp);
        this.applianceMeshMap.delete(id);
      }
    }

    // 3. Actualización diferencial por ID: sólo se reconstruye si cambian dimensiones o tipo
    for (const app of appls) {
      if (app.isHidden) continue;

      const isMountedSink = app.type === 'sink' && ((app.mountType === 'countertop' && app.position.y > 60) || app.position.y >= 350);
      const isMountedCooktop = app.type === 'cooktop' && ((app.mountType === 'countertop' && app.position.y > 60) || app.position.y >= 350);
      const visualBaseY =
        isMountedSink
          ? app.position.y - app.height + 8
          : isMountedCooktop
            ? app.position.y - app.height + 14
            : app.position.y;

      let appGroup = this.applianceMeshMap.get(app.id);
      const prevApp = appGroup?.userData?.['appliance'] as ApplianceItem | undefined;

      const needsRebuild = !appGroup || !prevApp ||
        prevApp.type !== app.type ||
        prevApp.width !== app.width ||
        prevApp.height !== app.height ||
        prevApp.depth !== app.depth ||
        prevApp.finish !== app.finish ||
        prevApp.mountType !== app.mountType ||
        prevApp.glbModel !== app.glbModel ||
        prevApp.modelRotationFix !== app.modelRotationFix ||
        prevApp.modelOffset?.x !== app.modelOffset?.x ||
        prevApp.modelOffset?.y !== app.modelOffset?.y ||
        prevApp.modelOffset?.z !== app.modelOffset?.z;

      if (needsRebuild || !appGroup) {
        if (appGroup) {
          this.appliancesGroup.remove(appGroup);
          this.disposeGroup(appGroup);
        }
        appGroup = this.buildApplianceGroupWithGlb(app, visualBaseY);
        this.appliancesGroup.add(appGroup);
        this.applianceMeshMap.set(app.id, appGroup);
      }

      if (!appGroup) continue;

      const isActivelyDragged = this.isApplianceDragging && (this.draggingAppliance?.id === app.id || this.liveDragApplianceUpdates.has(app.id));
      if (!isActivelyDragged) {
        appGroup.position.set(app.position.x, visualBaseY, app.position.z);
        appGroup.rotation.y = THREE.MathUtils.degToRad(app.rotation || 0);
      }
      appGroup.userData = { ...(appGroup.userData || {}), appliance: app, applianceId: app.id };
      appGroup.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.userData = { ...(child.userData || {}), isAppliance: true, applianceId: app.id };
          if ('appliance' in child.userData) {
            delete child.userData['appliance'];
          }
        }
      });

      // Si es el electrodoméstico seleccionado (individual o en multiselección), dibujar contorno técnico, aro de suelo y tiradores 3D
      const isSelected = app.id === selectedId || this.activeSelectedApplianceIds().includes(app.id);
      if (isSelected) {
        const rotRad = THREE.MathUtils.degToRad(app.rotation || 0);

        // Marco de alambre técnico azul cobalto
        const boxGeo = new THREE.BoxGeometry(app.width + 6, app.height + 6, app.depth + 6);
        const edgesGeo = new THREE.EdgesGeometry(boxGeo);
        boxGeo.dispose();
        const lineMat = new THREE.LineBasicMaterial({
          color: 0x0284c7, // sky-600
          linewidth: 2,
          depthTest: false
        });
        const boxLines = new THREE.LineSegments(edgesGeo, lineMat);
        boxLines.position.set(app.position.x, visualBaseY + app.height / 2, app.position.z);
        boxLines.rotation.y = rotRad;
        this.applianceGizmoGroup.add(boxLines);

        // Anillo de proyección en el plano de apoyo
        const haloRadius = Math.max(app.width, app.depth) * 0.48;
        const ringGeo = new THREE.RingGeometry(haloRadius - 15, haloRadius, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x0284c7,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.4,
          depthTest: false
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.set(app.position.x, Math.max(1, app.position.y + 1), app.position.z);
        this.applianceGizmoGroup.add(ringMesh);

        // Si el equipo está elevado sobre el suelo, dibujar proyección en el piso y línea plomada vertical
        if (app.position.y > 30) {
          const groundRingMat = new THREE.MeshBasicMaterial({
            color: 0x64748b,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.28,
            depthTest: false
          });
          const groundRing = new THREE.Mesh(ringGeo, groundRingMat);
          groundRing.rotation.x = -Math.PI / 2;
          groundRing.position.set(app.position.x, 1, app.position.z);
          this.applianceGizmoGroup.add(groundRing);

          // Línea plomada vertical que conecta la base del equipo al piso
          const plumbPoints = [
            new THREE.Vector3(app.position.x, 1, app.position.z),
            new THREE.Vector3(app.position.x, app.position.y, app.position.z)
          ];
          const plumbGeo = new THREE.BufferGeometry().setFromPoints(plumbPoints);
          const plumbMat = new THREE.LineDashedMaterial({
            color: 0x0284c7,
            dashSize: 25,
            gapSize: 15,
            depthTest: false
          });
          const plumbLine = new THREE.Line(plumbGeo, plumbMat);
          plumbLine.computeLineDistances();
          this.applianceGizmoGroup.add(plumbLine);
        }

        // Tiradores interactivos 3D en las caras de la caja envolvente (Face Handles para Ancho, Alto, Profundidad)
        const handleParent = new THREE.Group();
        handleParent.position.set(app.position.x, app.position.y, app.position.z);
        handleParent.rotation.y = rotRad;
        this.applianceGizmoGroup.add(handleParent);

        const handleSize = 34;
        const handleGeo = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
        const handleEdgeGeo = new THREE.EdgesGeometry(handleGeo);

        const addHandle = (
          axis: 'x' | 'y' | 'z',
          direction: 1 | -1,
          localX: number,
          localY: number,
          localZ: number,
          color: number
        ) => {
          const mat = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.45,
            roughness: 0.15,
            metalness: 0.2,
            depthTest: false
          });
          const mesh = new THREE.Mesh(handleGeo, mat);
          const edges = new THREE.LineSegments(
            handleEdgeGeo,
            new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, depthTest: false })
          );
          mesh.add(edges);
          mesh.position.set(localX, localY, localZ);
          mesh.renderOrder = 999;
          mesh.userData = {
            isApplianceHandle: true,
            appliance: app,
            axis,
            direction
          };
          handleParent.add(mesh);
          this.applianceHandleHitMeshes.push(mesh);
        };

        const halfW = app.width / 2;
        const halfH = app.height / 2;
        const halfD = app.depth / 2;

        // Tiradores laterales de Ancho (Rojos en caras X)
        addHandle('x', 1, halfW + 18, halfH, 0, 0xef4444);
        addHandle('x', -1, -halfW - 18, halfH, 0, 0xef4444);

        // Tirador superior de Altura (Esmeralda en cara Y)
        addHandle('y', 1, 0, app.height + 18, 0, 0x10b981);

        // Tiradores frontales y traseros de Profundidad (Celeste/Azul en caras Z)
        addHandle('z', 1, 0, halfH, halfD + 18, 0x0284c7);
        addHandle('z', -1, 0, halfH, -halfD - 18, 0x0284c7);
      }
    }
    this.requestRender(8);
  }

  /**
   * Adherencia inteligente (imán de contacto) a piso, mesada o pared
   */
  snapApplianceToContact(appliance: ApplianceItem, target: 'floor' | 'countertop' | 'wall' | 'auto') {
    const parts = this.parts();
    const config = this.roomConfig();
    const newX = appliance.position.x;
    let newY = appliance.position.y;
    let newZ = appliance.position.z;

    const actualTarget = target === 'auto' ? appliance.mountType : target;

    if (actualTarget === 'floor') {
      newY = 0;
    } else if (actualTarget === 'countertop') {
      // Buscar la mesada o pieza horizontal más alta en la cocina/módulo
      let highestY = 0;
      for (const p of parts) {
        if (p.orientation === 'horizontal') {
          const top = (p.posY || 0) + (p.thickness || 15) / 2;
          if (top > highestY) {
            highestY = top;
          }
        }
      }
      newY = highestY > 0 ? highestY : 880;
    } else if (actualTarget === 'wall') {
      // Ajustar cara posterior contra el muro principal
      const wallBackZ = (config.wallOffsetZ || 0) + (config.wallThickness || 150) / 2 + (appliance.depth / 2);
      newZ = wallBackZ;
      if (appliance.type === 'hood') {
        newY = 1500; // Altura estándar ergonómica de extracción
      }
    } else if (actualTarget === 'built_in') {
      // En torre o nicho de mueble
      newZ = (appliance.depth / 2);
    }

    this.applianceModified.emit({
      appliance,
      updates: {
        position: { x: Math.round(newX), y: Math.round(newY), z: Math.round(newZ) }
      }
    });
  }

  /**
   * Libera recursivamente las geometrías y materiales de un grupo de Three.js en la GPU (VRAM),
   * preservando aquellos marcados como compartidos en caché (userData.isShared).
   */

  /**
   * Construye el grupo de Three.js para un electrodoméstico o mueble de referencia,
   * utilizando el modelo .glb con caché inteligente si está configurado, o fallback procedural.
   */
  private buildApplianceGroupWithGlb(app: ApplianceItem, visualBaseY: number): THREE.Group {
    if (app.glbModel) {
      const cached = this.glbModelLoader.getCachedApplianceGroup(app);
      if (cached) {
        return cached;
      }

      // Placeholder procedural instantáneo mientras se descarga el .glb
      const placeholder = this.appliance3dBuilder.buildApplianceGroup(app);

      this.glbModelLoader.loadAndBuildAppliance(app).then((glbGroup) => {
        if (!glbGroup) return;

        const current = this.applianceMeshMap.get(app.id);
        if (current && this.appliancesGroup.children.includes(current)) {
          this.appliancesGroup.remove(current);
          this.disposeGroup(current);

          glbGroup.position.set(app.position.x, visualBaseY, app.position.z);
          glbGroup.rotation.y = THREE.MathUtils.degToRad(app.rotation || 0);
          glbGroup.userData = { ...(glbGroup.userData || {}), appliance: app, applianceId: app.id };

          this.appliancesGroup.add(glbGroup);
          this.applianceMeshMap.set(app.id, glbGroup);
          this.requestRender(8);
        }
      }).catch(() => {
        // En caso de fallo o archivo ausente, se conserva el grupo procedural sin afectar la app
      });

      return placeholder;
    }

    return this.appliance3dBuilder.buildApplianceGroup(app);
  }

  private disposeGroup(group: THREE.Group) {
    if (!group) return;
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse(obj => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments || obj instanceof THREE.Line) {
          if (this.hoveredGizmoMesh === obj) {
            this.hoveredGizmoMesh = null;
          }
          if (obj.geometry && !obj.geometry.userData?.['isShared']) {
            obj.geometry.dispose();
          }
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              for (const m of obj.material) {
                if (m && !m.userData?.['isShared']) {
                  m.dispose();
                }
              }
            } else if (!obj.material.userData?.['isShared']) {
              obj.material.dispose();
            }
          }
        } else if (obj instanceof THREE.Sprite) {
          if (this.hoveredDimensionSprite === obj) {
            this.hoveredDimensionSprite = null;
          }
          const idx = this.editableDimensionSprites.indexOf(obj as THREE.Sprite);
          if (idx !== -1) {
            this.editableDimensionSprites.splice(idx, 1);
          }
          if (obj.material.map && !obj.material.map.userData?.['isShared']) {
            obj.material.map.dispose();
          }
          if (!obj.material.userData?.['isShared']) {
            obj.material.dispose();
          }
        }
      });
    }
  }

  /**
   * Limpia el bucle requestAnimationFrame, desconecta el ResizeObserver,
   * remueve los listeners globales de window y libera la memoria WebGL al destruir el componente.
   */
  ngOnDestroy() {
    if (this.camera && this.controls) {
      this.projectStorage.saveCameraState(this.camera.position, this.controls.target, true);
    }
    this.projectStorage.flushPendingStorageSave();

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    const canvas = this.canvasRef()?.nativeElement;
    if (canvas) {
      canvas.removeEventListener('pointerdown', this.boundPointerDown);
      canvas.removeEventListener('wheel', this.boundCanvasWheel);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', this.boundPointerMove);
      window.removeEventListener('pointerup', this.boundPointerUp);
      window.removeEventListener('pointercancel', this.boundPointerUp);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibilityChange);
    }

    this.disposeGroup(this.furnitureGroup);
    this.disposeGroup(this.dimensionGroup);
    this.disposeGroup(this.internalClearanceGroup);
    this.disposeGroup(this.gizmoGroup);
    this.disposeGroup(this.drillGroup);
    this.disposeGroup(this.roomGroup);
    this.disposeGroup(this.wallGizmoGroup);
    this.disposeGroup(this.appliancesGroup);
    this.disposeGroup(this.applianceGizmoGroup);
    this.disposeGroup(this.referenceGuideGroup);
    this.disposeGroup(this.measureGroup);
    this.disposeGroup(this.magneticSnapGroup);
    this.disposeGroup(this.pushPullHighlightGroup);
    this.disposeGroup(this.rectPreviewGroup);
    this.disposeGroup(this.circlePreviewGroup);
    this.disposeGroup(this.freehandPreviewGroup);

    this.clearWallSnapGuides();
    this.clearLegSnapGuides();
    this.clearPartSnapGuides();

    for (const geo of this.geometryPool.values()) {
      geo.dispose();
    }
    this.geometryPool.clear();

    for (const mat of this.materialCache.values()) {
      mat.dispose();
    }
    this.materialCache.clear();

    for (const tex of this.textureCache.values()) {
      tex.dispose();
    }
    this.textureCache.clear();

    for (const b of this.badgeSpriteCache.values()) {
      b.texture.dispose();
      b.material.dispose();
    }
    this.badgeSpriteCache.clear();
    this.applianceMeshMap.clear();

    if (this.controls) {
      this.controls.dispose();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    this.timer.dispose();
  }
}
