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
  DestroyRef,
  NgZone,
  inject
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
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
  CubeIcon,
  Delete02Icon,
  Edit02Icon,
  InformationCircleIcon,
  Layers01Icon,
  LockIcon,
  Moon02Icon,
  PaintBoardIcon,
  RefreshIcon,
  RulerIcon,
  Settings01Icon,
  Sun01Icon,
  Tick02Icon,
  ViewIcon
} from '@hugeicons/core-free-icons';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  Part,
  PartGroup,
  Material,
  LayerVisibilityState,
  DrillHole,
  CollisionRecord,
  CollisionFixOption,
  CollisionResolutionPlan,
  EdgeBandingType,
  ComponentRole,
  GrainDirection,
  DoorHandleVerticalPosition,
  PartHardwareConfig,
  HandleType,
  HandleFinish,
  HingeType,
  SlideType,
  OpeningDirection,
  CabinetGolaFinish,
  CabinetLegStyle,
  CabinetRodFinish,
  CabinetVitrinaFrameFinish,
  CabinetVitrinaGlassType,
  WorkspaceMode,
  RoomConfiguration,
  RoomWallInstance,
  getResolvedRoomWalls,
  getWallHalfSpans,
  DEFAULT_ROOM_CONFIG,
  ApplianceItem,
  CabinetZoneHighlightBox,
  ModuleCavityInfo,
  ParametricDrawerConfig,
  hasReliableParametricRecipe,
  isStandaloneModularDrawerGroup,
  isCountertopMaterial
} from '../../models/melamine.models';
import { MELAMINE_MATERIALS_CATALOG } from '../../data/melamine-catalog.data';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import {
  CountertopCutoutHole,
  PartGeometryService,
  PartLocalDimensions,
  PartWorldAABB
} from '../../services/part-geometry.service';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';
import { ProceduralTextureFactory } from '../../utils/procedural-textures';
import { Appliance3dBuilderService } from '../../services/appliance-3d-builder.service';
import { GlbModelLoaderService } from '../../services/glb-model-loader.service';
import { SpatialReferenceGuideService } from '../../services/spatial-reference-guide.service';
import {
  ScenePickCandidate,
  ScenePieceHitMeta,
  SceneRaycastPickerService,
  SceneRaycastSources
} from '../../services/scene-raycast-picker.service';
import {
  ClearanceAxis,
  ClearanceBadgeType,
  computeClearanceReposition,
  DIMENSION_LINE_RENDER_ORDER,
  DIMENSION_SPRITE_RENDER_ORDER,
  DimensionAnchor3dService,
  DimensionLineSegment,
  EditableDimensionBadgeType,
  getBadgeClearanceAxis,
  ModuleVerticalBayInput,
  resolveClearanceAnchorAndMover
} from '../../services/dimension-anchor-3d.service';
import {
  AXIS_COLORS,
  CLICK_DRAG_THRESHOLD_PX,
  MagneticSnapCandidate,
  MeasureAxisLock,
  MeasureProjectionMode,
  Point3D,
  ProjectedMeasurementBadge,
  SNAP_COLORS,
  SNAP_CSS_COLORS,
  SNAP_LABELS,
  SavedMeasurement,
  TAPE_MEASURE_RENDER_ORDER,
  TapeMeasure3dService,
  ViewportRect
} from '../../services/tape-measure-3d.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import {
  ContainerBoundsRect,
  ContextMenuPositioningService,
  DEFAULT_CONTEXT_MENU_HEIGHT_PX,
  DEFAULT_CONTEXT_MENU_WIDTH_PX,
  SubmenuPlacement
} from '../../services/context-menu-positioning.service';

type HugeIconDef = typeof Compass01Icon;
const cadSvg = (paths: string[]): HugeIconDef =>
  paths.map((d, idx) => ['path', { d, key: `cad_${idx}` }]) as unknown as HugeIconDef;

export interface DoorPistonKinematicsEndpoint {
  aBase: THREE.Vector3;
  aLocal: THREE.Vector3;
  bLocal: THREE.Vector3;
  length: number;
}

export interface DoorPistonKinematicsResult {
  left: DoorPistonKinematicsEndpoint;
  right: DoorPistonKinematicsEndpoint;
  angleDeg: number;
  maxAngleDeg: number;
}

interface DoorCapableProjectStorage {
  configureDoorOpeningMode?: (
    partOrGroupId: string,
    mode: 'left' | 'right' | 'double' | 'top' | 'bottom'
  ) => Part[];
  getDoorConfigurationMode?: (
    partOrGroupId: string
  ) => 'left' | 'right' | 'double' | 'top' | 'bottom' | 'none';
  setDoorHandleVerticalPosition?: (
    partOrGroupId: string,
    position: 'top' | 'center' | 'bottom' | 'none'
  ) => void;
  findPairedDoorSibling?: (doorPart: Part) => Part | null;
}

interface PieceMeshData {
  part: Part;
  mesh: THREE.Mesh;
  originalPos: THREE.Vector3;
  halfHeightY: number;
  explodedOffset: THREE.Vector3;
  explosionGroupId?: string | null;
  currentFloorLiftY?: number;
  isDoor?: boolean;
  isSlidingDoor?: boolean;
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
  slideDistanceMm?: number;
}

interface ExplosionAABBStats {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  cx: number;
  cy: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
  count: number;
  facing: 'front' | 'right' | 'back' | 'left';
}

interface PreparedExplosionStatsEntry {
  part: Part;
  role: string;
  nameLow: string;
  baseBounds: PartWorldAABB;
  explosionGroupId: string | null;
}

interface PreparedExplosionRenderEntry extends PreparedExplosionStatsEntry {
  localDims: PartLocalDimensions;
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

interface WallGizmoHitData {
  isWallGizmo: boolean;
  type: 'wall_move' | 'wall_stretch' | 'wall_stretch_height';
  gizmoType?: 'wall_move' | 'wall_stretch' | 'wall_stretch_height';
  axis?: 'x' | 'y' | 'z';
  wallTarget?: string;
  wallId?: string;
  endSign?: 1 | -1;
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
  badgeType: EditableDimensionBadgeType;
  part: Part;
  currentValue: number;
  label: string;
  referenceY?: number;
  axis?: ClearanceAxis;
  anchorPart?: Part | null;
  moverPart?: Part | null;
  minSidePart?: Part | null;
  maxSidePart?: Part | null;
  syntheticMinFaceCoord?: number;
  syntheticMaxFaceCoord?: number;
  defaultMoverSide?: 'min' | 'max';
  moverMinLimitEdge?: number;
  moverMaxLimitEdge?: number;
  selectedPartId?: string | null;
  isModuleInternalBadge?: boolean;
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
  frontClearance?: number | null;
  backClearance?: number | null;
  frontNeighborName?: string | null;
  backNeighborName?: string | null;
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

export interface ExplodedPoint3D {
  x: number;
  y: number;
  z: number;
}

export interface FloorClampedExplodedPartLayout {
  partId: string;
  groupId: string | null;
  clusterKey: string;
  originalCenter: ExplodedPoint3D;
  explodedOffset: ExplodedPoint3D;
  explodedCenter: ExplodedPoint3D;
  halfHeightY: number;
  bottomY: number;
  floorLiftY: number;
}

interface ExplosionFloorClampInput {
  clusterKey: string;
  baseCenterY: number;
  halfHeightY: number;
  explodedOffsetY: number;
}

function getExplosionClusterKey(groupId: string | null | undefined): string {
  return groupId ? `group:${groupId}` : '__ungrouped__';
}

function resolveExplosionGroupIdPure(
  part: Part,
  partGroupMap: ReadonlyMap<string, PartGroup>,
  presentRawGroupIds: ReadonlySet<string>
): string | null {
  const rawGroupId = part.groupId || null;
  if (!rawGroupId) return null;
  const grp = partGroupMap.get(rawGroupId);
  if (grp && grp.type === 'drawer') {
    const hostId = grp.hostGroupId ?? grp.drawerConfig?.hostGroupId ?? grp.drawerConfig?.targetModuleId;
    if (hostId && presentRawGroupIds.has(hostId)) {
      return hostId;
    }
  }
  return rawGroupId;
}

function resolveExplosionGroupFacingPure(
  entries: readonly PreparedExplosionStatsEntry[],
  cx: number,
  cz: number,
  groupId: string | null,
  partGroupMap: ReadonlyMap<string, PartGroup>
): 'front' | 'right' | 'back' | 'left' {
  const explicitFacing = groupId ? partGroupMap.get(groupId)?.facingDirection : undefined;
  if (explicitFacing === 'front' || explicitFacing === 'right' || explicitFacing === 'back' || explicitFacing === 'left') {
    return explicitFacing;
  }

  const frontEntries = entries.filter(
    e => e.role === 'door' || e.role === 'drawer_front' || e.role === 'front'
  );
  if (frontEntries.length > 0) {
    let sumDx = 0;
    let sumDz = 0;
    for (const e of frontEntries) {
      sumDx += e.baseBounds.px - cx;
      sumDz += e.baseBounds.pz - cz;
    }
    const avgDx = sumDx / frontEntries.length;
    const avgDz = sumDz / frontEntries.length;
    if (Math.abs(avgDx) > 10 || Math.abs(avgDz) > 10) {
      if (Math.abs(avgDx) > Math.abs(avgDz)) {
        return avgDx >= 0 ? 'right' : 'left';
      }
      return avgDz >= 0 ? 'front' : 'back';
    }
  }

  const backEntries = entries.filter(e => e.role === 'back');
  if (backEntries.length > 0) {
    let sumDx = 0;
    let sumDz = 0;
    for (const e of backEntries) {
      sumDx += cx - e.baseBounds.px;
      sumDz += cz - e.baseBounds.pz;
    }
    const avgDx = sumDx / backEntries.length;
    const avgDz = sumDz / backEntries.length;
    if (Math.abs(avgDx) > 10 || Math.abs(avgDz) > 10) {
      if (Math.abs(avgDx) > Math.abs(avgDz)) {
        return avgDx >= 0 ? 'right' : 'left';
      }
      return avgDz >= 0 ? 'front' : 'back';
    }
  }

  const sideEntry = entries.find(e => e.role === 'side_left' || e.role === 'side_right');
  if (sideEntry && sideEntry.baseBounds.sx > sideEntry.baseBounds.sz) {
    return 'right';
  }
  return 'front';
}

function buildExplosionAABBStatsPure(
  entries: readonly PreparedExplosionStatsEntry[],
  groupId: string | null,
  partGroupMap: ReadonlyMap<string, PartGroup>
): ExplosionAABBStats {
  if (entries.length === 0) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      minZ: 0,
      maxZ: 0,
      cx: 0,
      cy: 400,
      cz: 0,
      sx: 0,
      sy: 0,
      sz: 0,
      count: 0,
      facing: 'front'
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const e of entries) {
    const b = e.baseBounds;
    if (b.minX < minX) minX = b.minX;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxY > maxY) maxY = b.maxY;
    if (b.minZ < minZ) minZ = b.minZ;
    if (b.maxZ > maxZ) maxZ = b.maxZ;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    cx,
    cy,
    cz,
    sx: Math.max(0, maxX - minX),
    sy: Math.max(0, maxY - minY),
    sz: Math.max(0, maxZ - minZ),
    count: entries.length,
    facing: resolveExplosionGroupFacingPure(entries, cx, cz, groupId, partGroupMap)
  };
}

function computeExplosionStatsPure(
  entries: readonly PreparedExplosionStatsEntry[],
  partGroupMap: ReadonlyMap<string, PartGroup>
): {
  sceneStats: ExplosionAABBStats;
  groupStatsMap: Map<string, ExplosionAABBStats>;
} {
  const grouped = new Map<string, PreparedExplosionStatsEntry[]>();
  for (const e of entries) {
    if (!e.explosionGroupId) continue;
    let list = grouped.get(e.explosionGroupId);
    if (!list) {
      list = [];
      grouped.set(e.explosionGroupId, list);
    }
    list.push(e);
  }

  const groupStatsMap = new Map<string, ExplosionAABBStats>();
  for (const [gid, list] of grouped.entries()) {
    groupStatsMap.set(gid, buildExplosionAABBStatsPure(list, gid, partGroupMap));
  }

  const sceneStats = buildExplosionAABBStatsPure(entries, null, partGroupMap);
  return { sceneStats, groupStatsMap };
}

function classifyPartExplodedMovableKind(
  part: Part,
  partGroupMap: ReadonlyMap<string, PartGroup>
): { isDoor: boolean; isDrawer: boolean } {
  const nameUpper = (part.name || '').toUpperCase();
  const role = part.componentRole;
  const explicitMovableType = part.hardwareConfig?.movableType;

  const detectedMovableType: 'door' | 'drawer' | 'none' = explicitMovableType
    ? explicitMovableType
    : role === 'door' || nameUpper.includes('PUERTA')
      ? 'door'
      : role === 'drawer_front' ||
          nameUpper.includes('CAJON') ||
          nameUpper.includes('CAJÓN') ||
          nameUpper.includes('GAVETA') ||
          part.id.includes('caj_ind_')
        ? 'drawer'
        : 'none';

  const isDoor =
    (detectedMovableType === 'door' || role === 'door' || nameUpper.includes('PUERTA')) &&
    !nameUpper.includes('CAJ');

  const isCarcassStructure =
    role === 'side_left' ||
    role === 'side_right' ||
    role === 'top' ||
    role === 'bottom' ||
    role === 'plinth' ||
    role === 'back' ||
    role === 'shelf';

  const isInternalBoxPart =
    !isCarcassStructure &&
    (role === 'drawer_box' ||
      (nameUpper.includes('CAJ') &&
        (nameUpper.includes('LATERAL') ||
          nameUpper.includes('COSTADO') ||
          nameUpper.includes('TRASERA') ||
          nameUpper.includes('FONDO') ||
          nameUpper.includes('CONTRAFRENTE') ||
          nameUpper.includes('INTERIOR'))));

  const isDrawerFront =
    !isCarcassStructure &&
    !isInternalBoxPart &&
    (role === 'drawer_front' ||
      (detectedMovableType === 'drawer' && !isInternalBoxPart) ||
      (nameUpper.includes('FRENTE') &&
        (nameUpper.includes('CAJ') || nameUpper.includes('GAVET'))) ||
      ((nameUpper.startsWith('CAJ') || nameUpper.startsWith('GAVET')) && !isInternalBoxPart));

  const isPartInDrawerGroup =
    Boolean(part.groupId) && partGroupMap.get(part.groupId as string)?.type === 'drawer';

  const isDrawer =
    !isCarcassStructure &&
    !isDoor &&
    (isPartInDrawerGroup || isDrawerFront || isInternalBoxPart);

  return { isDoor, isDrawer };
}

function computePartExplodedOffsetPure(
  part: Part,
  baseBounds: PartWorldAABB,
  isDoor: boolean,
  isDrawer: boolean,
  groupStats: ExplosionAABBStats | undefined,
  sceneStats: ExplosionAABBStats
): ExplodedPoint3D {
  const stats = groupStats && groupStats.count > 1 ? groupStats : sceneStats;
  if (stats.count <= 1) {
    return { x: 0, y: 0, z: 0 };
  }

  const dx = baseBounds.px - stats.cx;
  const dy = baseBounds.py - stats.cy;
  const dz = baseBounds.pz - stats.cz;

  let fx = 0;
  let fz = 1;
  let lx = 1;
  let lz = 0;
  if (stats.facing === 'back') {
    fx = 0;
    fz = -1;
    lx = 1;
    lz = 0;
  } else if (stats.facing === 'right') {
    fx = 1;
    fz = 0;
    lx = 0;
    lz = 1;
  } else if (stats.facing === 'left') {
    fx = -1;
    fz = 0;
    lx = 0;
    lz = 1;
  }

  const groupDepth = Math.max(200, Math.abs(fx) > 0.5 ? stats.sx : stats.sz);
  const curForward = dx * fx + dz * fz;
  const curLateral = dx * lx + dz * lz;
  const role = part.componentRole || 'free';
  const nameLow = (part.name || '').toLowerCase();
  const isPlinthOrLeg =
    role === 'plinth' ||
    part.materialId === 'hw_leg_inox' ||
    (part.materialId || '').startsWith('hw_leg') ||
    Boolean(part.hardwareConfig?.legStyle) ||
    (role !== 'bottom' &&
      role !== 'top' &&
      role !== 'tie' &&
      role !== 'countertop' &&
      role !== 'backsplash' &&
      (nameLow.includes('pata') || nameLow.includes('zócalo') || nameLow.includes('zocalo')));

  let dForward = curForward * 0.48;
  let dLateral = curLateral * 0.48;
  let dyOut = dy * 0.44;

  if (isDoor || role === 'door' || role === 'front') {
    dForward = Math.max(160, Math.min(280, groupDepth * 0.46)) + Math.max(0, curForward) * 0.35;
    dLateral = curLateral * 0.34;
    dyOut = dy * 0.25;
  } else if (role === 'drawer_front') {
    dForward = Math.max(175, Math.min(300, groupDepth * 0.48)) + Math.max(0, curForward) * 0.35;
    dLateral = curLateral * 0.3;
    dyOut = dy * 0.42;
  } else if (isDrawer || role === 'drawer_box' || role === 'drawer_lateral' || role === 'drawer_bottom') {
    const hasCarcass = stats.count > 4;
    if (hasCarcass) {
      dForward = Math.max(115, Math.min(220, groupDepth * 0.32)) + curForward * 0.25;
      dLateral = curLateral * 0.38;
      dyOut = dy * 0.42 + (role === 'drawer_bottom' ? -32 : 0);
    } else {
      dForward = curForward * 0.55;
      dLateral = curLateral * 0.55;
      dyOut = dy * 0.55 + (role === 'drawer_bottom' ? -30 : 0);
    }
  } else if (role === 'back') {
    dForward = -Math.max(130, Math.abs(curForward) * 0.65, Math.min(220, groupDepth * 0.38));
    dLateral = curLateral * 0.25;
    dyOut = dy * 0.2;
  } else if (role === 'side_left' || role === 'side_right') {
    const latSign = curLateral !== 0 ? Math.sign(curLateral) : role === 'side_left' ? -1 : 1;
    dLateral = latSign * Math.max(Math.abs(curLateral) * 0.48, 120);
    dForward = curForward * 0.18;
    dyOut = dy * 0.18;
  } else if (isPlinthOrLeg) {
    dyOut = Math.min(dy * 0.55, -135);
    dLateral = curLateral * 0.35;
    dForward = curForward * 0.35;
  } else if (role === 'shelf' || role === 'accessory') {
    dForward = Math.max(120, Math.min(220, groupDepth * 0.34)) + curForward * 0.25;
    dLateral = curLateral * 0.42;
    dyOut = dy * 0.36;
  } else if (role === 'divider') {
    dForward = Math.max(90, Math.min(180, groupDepth * 0.24)) + curForward * 0.22;
    dLateral = curLateral * 0.48;
    dyOut = dy * 0.24;
  } else if (role === 'top' || role === 'tie') {
    dyOut = Math.max(dy * 0.48, 105);
    dLateral = curLateral * 0.25;
    dForward = curForward * 0.25;
  } else if (role === 'countertop') {
    dyOut = Math.max(dy * 0.55, 160);
    dLateral = curLateral * 0.22;
    dForward = curForward * 0.22;
  } else if (role === 'backsplash') {
    dyOut = Math.max(dy * 0.55, 165);
    dForward = -Math.max(95, Math.abs(curForward) * 0.45);
    dLateral = curLateral * 0.22;
  } else if (role === 'bottom') {
    dyOut = Math.min(dy * 0.48, -105);
    dLateral = curLateral * 0.25;
    dForward = curForward * 0.25;
  }

  return {
    x: fx * dForward + lx * dLateral,
    y: dyOut,
    z: fz * dForward + lz * dLateral
  };
}

function computeExplosionClusterFloorLifts(
  items: readonly ExplosionFloorClampInput[],
  factor: number
): Map<string, number> {
  const lifts = new Map<string, number>();
  if (factor <= 0) {
    return lifts;
  }

  const clusterMinYMap = new Map<string, number>();
  for (const item of items) {
    const rawCenterY = item.baseCenterY + item.explodedOffsetY * factor;
    const rawBottomY = rawCenterY - item.halfHeightY;
    const prevMin = clusterMinYMap.get(item.clusterKey);
    if (prevMin === undefined || rawBottomY < prevMin) {
      clusterMinYMap.set(item.clusterKey, rawBottomY);
    }
  }

  for (const [clusterKey, clusterMinY] of clusterMinYMap.entries()) {
    lifts.set(clusterKey, clusterMinY < 0 ? Math.abs(clusterMinY) : 0);
  }
  return lifts;
}

/**
 * Fuente única de verdad (pura y compatible con JSDOM) para calcular el despiece explosivo 3D
 * con compensación de elevación sobre el plano de piso (`Y >= 0` para toda pieza en cada clúster).
 */
export function computeFloorClampedExplodedLayout(
  parts: readonly Part[],
  groups: readonly PartGroup[],
  percent: number,
  getPartWorldAABB: (part: Part) => PartWorldAABB
): FloorClampedExplodedPartLayout[] {
  if (!parts || parts.length === 0) {
    return [];
  }

  const factor = Math.max(0, Math.min(1, Number(percent) / 100 || 0));
  const partGroupMap = new Map<string, PartGroup>();
  for (const grp of groups || []) {
    partGroupMap.set(grp.id, grp);
  }

  const presentRawGroupIds = new Set<string>();
  const entries: PreparedExplosionStatsEntry[] = [];
  for (const part of parts) {
    if (part.groupId) {
      presentRawGroupIds.add(part.groupId);
    }
    entries.push({
      part,
      role: part.componentRole || 'free',
      nameLow: (part.name || '').toLowerCase(),
      baseBounds: getPartWorldAABB(part),
      explosionGroupId: part.groupId || null
    });
  }

  for (const entry of entries) {
    entry.explosionGroupId = resolveExplosionGroupIdPure(
      entry.part,
      partGroupMap,
      presentRawGroupIds
    );
  }

  const { sceneStats, groupStatsMap } = computeExplosionStatsPure(entries, partGroupMap);

  const rawItems = entries.map(entry => {
    const { isDoor, isDrawer } = classifyPartExplodedMovableKind(entry.part, partGroupMap);
    const groupStats = entry.explosionGroupId
      ? groupStatsMap.get(entry.explosionGroupId)
      : undefined;
    const explodedOffset = computePartExplodedOffsetPure(
      entry.part,
      entry.baseBounds,
      isDoor,
      isDrawer,
      groupStats,
      sceneStats
    );
    const clusterKey = getExplosionClusterKey(entry.explosionGroupId);
    const halfHeightY = entry.baseBounds.sy / 2;
    return {
      entry,
      clusterKey,
      halfHeightY,
      explodedOffset
    };
  });

  const clusterLifts = computeExplosionClusterFloorLifts(
    rawItems.map(item => ({
      clusterKey: item.clusterKey,
      baseCenterY: item.entry.baseBounds.py,
      halfHeightY: item.halfHeightY,
      explodedOffsetY: item.explodedOffset.y
    })),
    factor
  );

  return rawItems.map(item => {
    const b = item.entry.baseBounds;
    const originalCenter: ExplodedPoint3D = { x: b.px, y: b.py, z: b.pz };
    const floorLiftY = factor > 0 ? (clusterLifts.get(item.clusterKey) ?? 0) : 0;
    const explodedCenter: ExplodedPoint3D =
      factor === 0
        ? { x: b.px, y: b.py, z: b.pz }
        : {
            x: b.px + item.explodedOffset.x * factor,
            y: b.py + item.explodedOffset.y * factor + floorLiftY,
            z: b.pz + item.explodedOffset.z * factor
          };
    const bottomY = explodedCenter.y - item.halfHeightY;
    return {
      partId: item.entry.part.id,
      groupId: item.entry.part.groupId || null,
      clusterKey: item.clusterKey,
      originalCenter,
      explodedOffset: item.explodedOffset,
      explodedCenter,
      halfHeightY: item.halfHeightY,
      bottomY,
      floorLiftY
    };
  });
}

@Component({
  selector: 'app-furniture-3d-viewer',
  imports: [HugeiconsIconComponent, TranslatePipe, NgTemplateOutlet],
  templateUrl: './furniture-3d-viewer.html',
  styleUrl: './furniture-3d-viewer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block w-full h-full',
    '(window:keydown)': 'handleViewerKeyDown($event)',
    '(window:keyup)': 'handleViewerKeyUp($event)',
    '(window:resize)': 'onWindowResize()',
    '(document:pointerdown)': 'handleDocumentPointerDown($event)'
  }
})
export class Furniture3dViewerComponent implements OnDestroy {
  readonly i18n = inject(I18nService);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly projectStorage = inject(ProjectStorageService);
  private joineryEngine = inject(JoineryEngineService);
  private partGeometry = inject(PartGeometryService);
  readonly hardwareCatalog = inject(HardwareCatalogService);
  private appliance3dBuilder = inject(Appliance3dBuilderService);
  private glbModelLoader = inject(GlbModelLoaderService);
  private spatialGuideBuilder = inject(SpatialReferenceGuideService);
  private readonly sceneRaycastPicker = inject(SceneRaycastPickerService);
  private readonly dimensionAnchor = inject(DimensionAnchor3dService);
  private readonly tapeMeasure = inject(TapeMeasure3dService);
  private readonly contextMenuPositioning = inject(ContextMenuPositioningService);

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
    ]),
    explodedView: CubeIcon,
    reset: RefreshIcon,
    info: InformationCircleIcon,
    check: Tick02Icon
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
  private readonly boundPointerLeave = () => this.onCanvasPointerLeave();
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
  readonly manageHideInternally = input<boolean>(true);
  readonly highlightedZoneBox = input<CabinetZoneHighlightBox | null>(null);
  readonly isZoneBuilderActive = input<boolean>(false);
  readonly zoneBuilderGroupId = input<string | null>(null);

  // Outputs
  partSelected = output<Part | null>();
  partsSelected = output<string[]>();
  partModified = output<{ part: Part; updates: Partial<Part> }>();
  multiplePartsModified = output<{ updates: { part: Part; updates: Partial<Part> }[] }>();
  partCreated = output<Partial<Part>>();
  partDeleted = output<string>();
  partDuplicated = output<Part>();
  zoneDeleteRequested = output<void>();
  dragStarted = output<void>();
  clearanceCalculated = output<ClearanceInfo | null>();
  collisionsDetected = output<CollisionRecord[]>();
  drillHolesUpdated = output<DrillHole[]>();
  groupUngroupRequested = output<string>();
  drawerWizardRequested = output<void>();
  groupRotationRequested = output<{ groupId: string; deltaAngle: 90 | -90 | 180 }>();
  groupDuplicationRequested = output<string>();
  groupResizeRequested = output<{ groupId: string; prop: 'width' | 'height' | 'depth' | 'thickness'; value: number }>();
  editModuleRequested = output<string>();
  hiddenPartsChanged = output<string[]>();
  showAllRequested = output<void>();
  hideToggleRequested = output<void>();
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
    propType: EditableDimensionBadgeType;
    part: Part;
    label: string;
    referenceY?: number;
    axis?: ClearanceAxis;
    anchorPart?: Part | null;
    moverPart?: Part | null;
    minSidePart?: Part | null;
    maxSidePart?: Part | null;
    syntheticMinFaceCoord?: number;
    syntheticMaxFaceCoord?: number;
    defaultMoverSide?: 'min' | 'max';
    moverMinLimitEdge?: number;
    moverMaxLimitEdge?: number;
    selectedPartId?: string | null;
    isModuleInternalBadge?: boolean;
    worldPos: THREE.Vector3;
  } | null>(null);
  readonly hoveredDimensionTooltip = signal<string | null>(null);
  readonly clearanceWarningToast = signal<string | null>(null);
  private clearanceToastTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly explicitLowClearancePairKeys = new Set<string>();

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
    this.sceneRaycastPicker.refreshPickableMatricesAndBounds(this.referenceGuideGroup);
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
  readonly contextMenuSubmenuFlip = signal<SubmenuPlacement>({
    openLeft: false,
    openUp: false
  });
  readonly contextMenuMaxHeightPx = signal<number | null>(null);
  readonly contextMenuPanelRef = viewChild<ElementRef<HTMLElement>>('contextMenuPanel');
  readonly contextMenuBodyRef = viewChild<ElementRef<HTMLElement>>('contextMenuBody');
  private contextMenuRawCursor: { clientX: number; clientY: number } | null = null;
  private contextMenuRepositionRafId: number | null = null;
  readonly contextMenuPart = signal<Part | null>(null);
  readonly contextMenuAppliance = signal<ApplianceItem | null>(null);
  readonly contextMenuMode = signal<'group' | 'part'>('group');
  readonly showQuickMaterialPicker = signal<boolean>(false);
  readonly showStructureMaterialSubmenu = signal<boolean>(false);
  readonly showDoorMaterialSubmenu = signal<boolean>(false);
  readonly showRotateSubmenu = signal<boolean>(false);
  readonly showMovableRoleSubmenu = signal<boolean>(false);
  readonly showHandleSubmenu = signal<boolean>(false);
  readonly showHingeSubmenu = signal<boolean>(false);
  readonly showSlideSubmenu = signal<boolean>(false);
  readonly contextMenuHandleFinishOverride = signal<HandleFinish | null>(null);

  readonly contextMenuHandleFinishes: readonly {
    id: HandleFinish;
    label: string;
    title: string;
    swatchHex: string;
  }[] = [
    { id: 'brushed_steel', label: 'Inox', title: 'Acero Inox', swatchHex: '#a1a1aa' },
    { id: 'black', label: 'Negro', title: 'Negro Mate', swatchHex: '#18181b' },
    { id: 'gold', label: 'Dorado', title: 'Dorado Cepillado', swatchHex: '#d97706' },
    { id: 'white', label: 'Blanco', title: 'Blanco', swatchHex: '#ffffff' },
    { id: 'chrome', label: 'Cromo', title: 'Cromo', swatchHex: '#e4e4e7' }
  ];

  // Hidden / Isolated Parts & Appliances
  readonly hiddenPartIds = signal<Set<string>>(new Set());
  readonly internalHiddenApplianceIds = signal<Set<string>>(new Set());
  readonly isolatedTarget = signal<{ kind: 'group' | 'part'; id: string; label: string } | null>(null);
  readonly isolationToast = signal<string | null>(null);
  private isolationToastTimer: ReturnType<typeof setTimeout> | null = null;
  private prevApplianceHiddenInputMap = new Map<string, boolean>();
  readonly hiddenAppliancesCount = computed(
    () =>
      this.appliances().filter(
        a => Boolean(a.isHidden) || this.internalHiddenApplianceIds().has(a.id)
      ).length
  );
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
  readonly collisionPlans = computed<CollisionResolutionPlan[]>(() =>
    this.joineryEngine.buildCollisionResolutionPlans(this.parts(), this.detectedCollisions())
  );

  private updateDetectedCollisions(collisions: CollisionRecord[]): void {
    this.detectedCollisions.set(collisions);
    if (collisions.length === 0) {
      this.showCollisionsDetail.set(false);
    }
  }

  toggleCollisionsDetail() {
    this.showCollisionsDetail.update(v => !v);
  }

  /**
   * Selecciona únicamente la pieza protagonista del conflicto y enfoca la cámara sobre ella en 3D.
   */
  onCollisionCardClick(plan: CollisionResolutionPlan) {
    const targetId = plan.primaryFix?.targetPartId || plan.focusPartId || plan.collision.partAId;
    const part =
      this.parts().find(p => p.id === targetId) ||
      this.parts().find(p => p.id === plan.collision.partAId);
    if (!part) return;

    this.partsSelected.emit([part.id]);
    this.partSelected.emit(part);
    this.focusCameraOnPart(part.id);
  }

  /**
   * Aplica en 1 clic la corrección seleccionada sobre una colisión (vía ProjectStorageService con Undo o fallback standalone).
   */
  applySingleCollisionFix(fix: CollisionFixOption, event?: MouseEvent) {
    event?.stopPropagation();
    const isInProjectStore = this.projectStorage
      .currentProject()
      .parts.some(p => p.id === fix.targetPartId);

    if (isInProjectStore) {
      this.projectStorage.applyCollisionFix(fix);
      return;
    }

    const targetPart = this.parts().find(p => p.id === fix.targetPartId);
    if (!targetPart) return;

    const updates = this.joineryEngine.computePartUpdateForFix(targetPart, fix);
    if (!updates) return;

    this.projectStorage.pushSnapshot();
    this.partModified.emit({ part: targetPart, updates });
  }

  /**
   * Resuelve todas las interferencias activas en un único paso transaccional con soporte de Undo.
   */
  resolveAllDetectedCollisions(event?: MouseEvent) {
    event?.stopPropagation();
    const collisions = this.detectedCollisions();
    if (collisions.length === 0) return;

    const projectPartIds = new Set(this.projectStorage.currentProject().parts.map(p => p.id));
    const collidingIds = new Set<string>();
    for (const c of collisions) {
      collidingIds.add(c.partAId);
      collidingIds.add(c.partBId);
    }

    const allCollidingInStore =
      collidingIds.size > 0 && Array.from(collidingIds).every(id => projectPartIds.has(id));
    if (allCollidingInStore) {
      this.projectStorage.resolveAllProjectCollisions();
      return;
    }

    const sceneParts = this.parts();
    const res = this.joineryEngine.resolveAllCollisionsIteratively(sceneParts);
    if (res.updates.length === 0) return;

    const partById = new Map<string, Part>(sceneParts.map(p => [p.id, p]));
    const updatesList: { part: Part; updates: Partial<Part> }[] = [];
    for (const item of res.updates) {
      const part = partById.get(item.partId);
      if (part) {
        updatesList.push({ part, updates: item.updates });
      }
    }

    if (updatesList.length > 0) {
      this.projectStorage.pushSnapshot();
      this.multiplePartsModified.emit({ updates: updatesList });
    }
  }

  // Precision Nudge & Magnetic Snapping
  readonly isMagneticSnap = signal<boolean>(true);
  readonly nudgeStep = signal<number>(1); // 1 mm default (toggleable to 10mm)

  // 3D Measurement Tape / Ruler tool (Motor de Inferencias CAD + Fase 5 multi-cota persistente)
  readonly isMeasureMode = signal<boolean>(false);
  readonly measurePointA = signal<Point3D | null>(null);
  readonly measurePointB = signal<Point3D | null>(null);
  readonly measureProjectionMode = signal<MeasureProjectionMode>('direct');
  readonly activeInferredAxis = signal<MeasureAxisLock>(null);
  readonly isShiftPressed = signal<boolean>(false);
  readonly savedMeasurements = signal<SavedMeasurement[]>([]);
  readonly projectedMeasureBadges = signal<ProjectedMeasurementBadge[]>([]);
  readonly previewMeasureBadge = signal<ProjectedMeasurementBadge | null>(null);

  private measurePointerDownPos: { x: number; y: number } | null = null;
  private lastMeasurePointerClient: { x: number; y: number } | null = null;
  private lastRawMeasurePointB: Point3D | null = null;
  private suppressNextContextMenuForMeasureCancel = false;

  readonly hasActiveTrace = computed(() => !!this.measurePointA());
  readonly hasActiveMeasurement = computed(() => !!this.measurePointA() && !!this.measurePointB());
  readonly lastSavedMeasurement = computed(() => {
    const saved = this.savedMeasurements();
    return saved.length > 0 ? saved[saved.length - 1] : null;
  });
  readonly measureDistance = computed(() => {
    const a = this.measurePointA();
    const b = this.measurePointB();
    if (a && b) {
      let targetB: Point3D = b;
      const mode = this.measureProjectionMode();
      if (mode === 'x') {
        targetB = { x: b.x, y: a.y, z: a.z };
      } else if (mode === 'y') {
        targetB = { x: a.x, y: b.y, z: a.z };
      } else if (mode === 'z') {
        targetB = { x: a.x, y: a.y, z: b.z };
      }
      const dx = targetB.x - a.x;
      const dy = targetB.y - a.y;
      const dz = targetB.z - a.z;
      const dist = Math.hypot(dx, dy, dz);
      return {
        total: Math.round(dist * 10) / 10,
        dx: Math.round(Math.abs(dx) * 10) / 10,
        dy: Math.round(Math.abs(dy) * 10) / 10,
        dz: Math.round(Math.abs(dz) * 10) / 10
      };
    }
    const last = this.lastSavedMeasurement();
    if (!last) return null;
    return {
      total: last.distanceMm,
      dx: last.deltaX,
      dy: last.deltaY,
      dz: last.deltaZ
    };
  });

  // Active Selected Part IDs set
  readonly activeSelectedIds = computed<string[]>(() => {
    const multi = this.selectedPartIds();
    if (multi && multi.length > 0) return multi;
    const single = this.selectedPartId();
    return single ? [single] : [];
  });

  // Total active scene elements (parts + appliances) for clean inspection controls
  readonly totalSceneElementsCount = computed<number>(
    () => this.parts().length + this.appliances().length
  );

  // Vista Explosiva 3D: ocultar cuando hay < 2 piezas o 1 pieza suelta individual sin grupo/módulo (salvo >0% para apagar)
  readonly canShowExplodedButton = computed<boolean>(() => {
    if (this.explodedPercent() > 0) return true;
    const allParts = this.parts();
    if (allParts.length < 2) return false;
    const activeIds = this.activeSelectedIds();
    if (activeIds.length === 1) {
      const selPart = allParts.find(p => p.id === activeIds[0]);
      if (selPart && !selPart.groupId && !selPart.moduleId) {
        return false;
      }
    }
    return true;
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

  private computeGroupBounds(grp: PartGroup | null): {
    width: number;
    height: number;
    depth: number;
    thickness: number;
    count: number;
  } | null {
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
  }

  // Dimensiones globales del módulo o grupo seleccionado
  readonly currentSelectedGroupBounds = computed(() =>
    this.computeGroupBounds(this.currentSelectedGroup())
  );

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
  private openStateRevisionCounter = 0;
  private readonly openStateRevision = signal<number>(0);
  openTargetMap = new Map<string, number>();
  openCurrentMap = new Map<string, number>();
  readonly openProgressMap = this.openCurrentMap;

  private bumpOpenStateRevision(): void {
    this.openStateRevisionCounter += 1;
    this.openStateRevision.set(this.openStateRevisionCounter);
  }

  readonly isSmartOpenActive = computed<boolean>(() => {
    this.openStateRevision();
    const scope = this.resolveSmartOpenScope();
    if (scope.mode === 'global') {
      return this.isAllOpen();
    }
    return scope.parts.some(p => this.isPartTargetOpen(p));
  });

  isPartOpen(partId: string): boolean {
    this.openStateRevision();
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
      depthTest: false,
      depthWrite: false
    });
    this.dimensionAnchor.configureDimensionOverlayMaterial(mat, DIMENSION_LINE_RENDER_ORDER);
    mat.userData = { isShared: true };
    return mat;
  })();
  private readonly internalClearanceTickMat: THREE.LineBasicMaterial = (() => {
    const mat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      linewidth: 2,
      depthTest: false,
      depthWrite: false
    });
    this.dimensionAnchor.configureDimensionOverlayMaterial(mat, DIMENSION_LINE_RENDER_ORDER);
    mat.userData = { isShared: true };
    return mat;
  })();
  private gizmoGroup = new THREE.Group();
  private measureGroup = new THREE.Group();
  private magneticSnapGroup = new THREE.Group();
  private drillGroup = new THREE.Group();
  private pushPullHighlightGroup = new THREE.Group();
  private selectionOutlineGroup = new THREE.Group();
  private zoneHighlightGroup = new THREE.Group();
  private lastExplodedFactor = 0;
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
  private readonly scratchDoorLocalCenter = new THREE.Vector3();
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
  private readonly scratchDimWorldP1 = new THREE.Vector3();
  private readonly scratchDimWorldP2 = new THREE.Vector3();
  private readonly scratchDimParentOffset = new THREE.Vector3();

  private isDirectPieceDrag = false;
  private directPieceDragThresholdPassed = false;
  private dragStartPointer = { x: 0, y: 0 };
  private dragInitialPart: Part | null = null;
  private dragInitialParts: Part[] = [];
  private dragInitialHostedParts: Part[] = [];
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
  private activeWallGizmoHit: WallGizmoHitData | null = null;
  private activeWallStretchEndSign: 1 | -1 = 1;
  private wallHeightDragPlane = new THREE.Plane();
  private wallHeightDragStartPoint = new THREE.Vector3();
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
    this.destroyRef.onDestroy(() => {
      this.cancelContextMenuRepositionRaf();
    });

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
        this.updateExplodedOffsets(untracked(() => this.explodedPercent()));
        this.requestRender(10);
      } else {
        const visibleParts = parts.filter(p => !this.hiddenPartIds().has(p.id));
        const collisions = visibleParts.length >= 2 ? this.joineryEngine.detectCollisions(visibleParts) : [];
        this.updateDetectedCollisions(collisions);
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
        const activeOverride =
          (this.isWallDragging || this.isWallGizmoDragging) &&
          this.pendingWallUpdates &&
          this.pendingWallUpdates.wallId === wallType
            ? this.pendingWallUpdates.updates
            : undefined;
        this.updateWallGizmo(wallType, config, mode, activeOverride);
        this.requestRender(8);
      }
    });

    // 6. Update 3D Appliances when appliances, selectedApplianceId, selectedApplianceIds, layerVisibility or isolation change
    effect(() => {
      const appls = this.appliances();
      const selId = this.selectedApplianceId();
      this.selectedApplianceIds();
      this.layerVisibility();
      this.internalHiddenApplianceIds();
      if (this.scene) {
        this.updateAppliancesScene(appls, selId);
        this.requestRender(10);
      }
    });

    // 6b. Sincronizar estado interno de aislamiento cuando el padre elimina o vuelve visibles equipos
    effect(() => {
      const appls = this.appliances();
      untracked(() => {
        const currentIds = new Set(appls.map(a => a.id));
        const nextInternal = new Set(this.internalHiddenApplianceIds());
        let changed = false;

        for (const id of Array.from(nextInternal)) {
          if (!currentIds.has(id)) {
            nextInternal.delete(id);
            changed = true;
          }
        }

        const nextPrevMap = new Map<string, boolean>();
        for (const app of appls) {
          const wasHidden = this.prevApplianceHiddenInputMap.get(app.id) ?? false;
          const isHiddenNow = Boolean(app.isHidden);
          if (wasHidden && !isHiddenNow && nextInternal.has(app.id)) {
            nextInternal.delete(app.id);
            changed = true;
          }
          nextPrevMap.set(app.id, isHiddenNow);
        }
        this.prevApplianceHiddenInputMap = nextPrevMap;

        if (changed) {
          this.internalHiddenApplianceIds.set(nextInternal);
        }
      });
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
      void cfg.floorWidth;
      void cfg.floorDepth;
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
        if (this.isModularDrawerGroup(g.id)) {
          const ext = g.slideExtension !== undefined ? g.slideExtension : (g.isOpen ? 1 : 0);
          for (const p of this.pieceObjects) {
            if (p.part.groupId === g.id) {
              const prev = this.openTargetMap.get(p.part.id) ?? 0;
              if (Math.abs(prev - ext) > 0.005) {
                this.openTargetMap.set(p.part.id, ext);
                changed = true;
              }
            }
          }
        }
      }
      if (changed) {
        this.syncIsAllOpenSignal();
        this.bumpOpenStateRevision();
        this.requestRender(55);
      }
    });

    // 9. Resaltar en 3D la zona/compartimento activo del configurador por zonas
    effect(() => {
      const zoneBox = this.highlightedZoneBox();
      if (this.scene) {
        this.updateZoneHighlightScene(zoneBox);
        this.requestRender(6);
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
        this.updateProjectedMeasureBadges();
        if (this.inlineDimensionEditor()) {
          this.updateInlineEditorScreenPosition();
        }
        this.requestRender(8);
      });
      this.controls.addEventListener('end', () => {
        this.isCameraInteracting = false;
        this.updateAdaptiveCameraSpeeds();
        this.updateAdaptiveGizmoScale();
        this.updateProjectedMeasureBadges();
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
    this.dimensionGroup.renderOrder = DIMENSION_LINE_RENDER_ORDER;
    this.scene.add(this.dimensionGroup);
    this.internalClearanceGroup.renderOrder = DIMENSION_LINE_RENDER_ORDER;
    this.scene.add(this.internalClearanceGroup);
    this.scene.add(this.gizmoGroup);
    this.measureGroup.renderOrder = TAPE_MEASURE_RENDER_ORDER;
    this.magneticSnapGroup.renderOrder = TAPE_MEASURE_RENDER_ORDER;
    this.scene.add(this.measureGroup);
    this.scene.add(this.magneticSnapGroup);
    this.scene.add(this.drillGroup);
    this.scene.add(this.pushPullHighlightGroup);
    this.selectionOutlineGroup.renderOrder = 940;
    this.selectionOutlineGroup.visible = false;
    this.selectionOutlineGroup.userData = { isAuxiliaryVisual: true, isOutline: true };
    this.selectionOutlineGroup.raycast = () => {
      // Contorno de selección no seleccionable por raycasting
    };
    this.scene.add(this.selectionOutlineGroup);
    this.zoneHighlightGroup.renderOrder = 950;
    this.zoneHighlightGroup.raycast = () => {
      // Resaltado de zona no seleccionable por raycasting
    };
    this.scene.add(this.zoneHighlightGroup);
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
    this.updateExplodedOffsets(this.explodedPercent());
    this.updateZoneHighlightScene(this.highlightedZoneBox());

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
      canvas.addEventListener('pointerleave', this.boundPointerLeave);
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
    if (this.scene) {
      this.updateSelectionHighlights(this.activeSelectedIds(), this.materials(), this.isXRay());
    }
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
      const edgeColor = isColliding ? 0xef4444 : (isSelected ? 0x0284c7 : (isWhite ? 0x94a3b8 : 0x3f3f46));
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
    this.disposeGroup(this.selectionOutlineGroup);
    this.selectionOutlineGroup.visible = false;

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
    this.bumpOpenStateRevision();

    if (!parts || parts.length === 0) {
      this.updateDetectedCollisions([]);
      this.allDrillHoles.set([]);
      return;
    }

    // 1. Calculate Joinery & Collisions via JoineryEngineService
    const visiblePartsForJoinery = parts.filter(p => !this.hiddenPartIds().has(p.id));
    const joinery = this.joineryEngine.calculateJoinery(visiblePartsForJoinery);
    this.updateDetectedCollisions(joinery.collisions);
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

    const visibleRenderEntries: PreparedExplosionRenderEntry[] = [];
    const presentRawGroupIds = new Set<string>();
    for (const part of parts) {
      if (this.hiddenPartIds().has(part.id)) {
        continue;
      }

      // Filtro de capas y visibilidad de piezas
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
      if (part.groupId) {
        presentRawGroupIds.add(part.groupId);
      }
      visibleRenderEntries.push({
        part,
        role,
        nameLow,
        baseBounds,
        localDims,
        explosionGroupId: part.groupId || null
      });
    }

    const partGroupMap = new Map<string, PartGroup>();
    for (const grp of this.partGroups()) {
      partGroupMap.set(grp.id, grp);
    }
    for (const entry of visibleRenderEntries) {
      entry.explosionGroupId = this.resolveExplosionGroupId(entry.part, partGroupMap, presentRawGroupIds);
    }
    const { sceneStats, groupStatsMap } = this.computeExplosionStats(visibleRenderEntries, partGroupMap);

    for (const entry of visibleRenderEntries) {
      const { part, role, nameLow, baseBounds, localDims, explosionGroupId } = entry;
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

      // Geometry according to shapeType: circle/legs/rods, Gola channel, 45° beveled cleat, extruded board, or pooled box
      const { geometry, edges } = this.buildPartGeometryAndEdges(part, localDims, overlappingCutouts);

      const material = this.createPieceMaterial(part, isSelected, mats, xRay, isColliding);
      const mesh = new THREE.Mesh(geometry, material);

      mesh.position.set(px, py, pz);
      if (part.rotationX || part.rotationY || part.rotationZ) {
        const rx = THREE.MathUtils.degToRad(part.rotationX || 0);
        const ry = THREE.MathUtils.degToRad(part.rotationY || 0);
        const rz = THREE.MathUtils.degToRad(part.rotationZ || 0);
        mesh.rotation.set(rx, ry, rz, 'XYZ');
      }
      const isVitrinaDoor = this.isVitrinaDoorPart(part);
      mesh.castShadow = !xRay && !isVitrinaDoor;
      mesh.receiveShadow = !isVitrinaDoor;
      if (isVitrinaDoor) {
        mesh.renderOrder = 5;
      }
      mesh.userData = { part, isPiece: true };

      // Edges geometry for crisp technical outline (pooled geometry & shared material)
      const edgeMat = this.getSharedEdgeMaterial(isColliding, isSelected);
      const edgeLines = new THREE.LineSegments(edges, edgeMat);
      edgeLines.scale.setScalar(isSelected || isColliding ? 1.001 : 1);
      edgeLines.renderOrder = isSelected || isColliding ? 20 : 0;
      edgeLines.raycast = () => {
        // Contorno técnico no seleccionable por raycasting
      };
      edgeLines.userData = { isOutline: true, isAuxiliaryVisual: true };
      mesh.add(edgeLines);

      const hw = part.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(part);
      this.attachPartDetailVisuals(mesh, part, hw, localDims, xRay, isColliding);
      const isDoor =
        (!this.isExplicitNonDoorRole(part.componentRole) || part.hardwareConfig?.movableType === 'door') &&
        (hw.movableType === 'door' || part.componentRole === 'door' || part.name.toUpperCase().includes('PUERTA')) &&
        !part.name.toUpperCase().includes('CAJ');

      const isCarcassStructure =
        part.componentRole === 'side_left' ||
        part.componentRole === 'side_right' ||
        part.componentRole === 'top' ||
        part.componentRole === 'bottom' ||
        part.componentRole === 'divider' ||
        part.componentRole === 'tie' ||
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

      const isPartInDrawerGroup = !!part.groupId && this.isModularDrawerGroup(part.groupId);
      const isDrawer =
        !isCarcassStructure &&
        !isDoor &&
        (isPartInDrawerGroup ||
          isDrawerFront ||
          isInternalBoxPart);

      const groupStats = explosionGroupId ? groupStatsMap.get(explosionGroupId) : undefined;
      const explodedOffset = this.computePartExplodedOffset(
        part,
        baseBounds,
        isDoor,
        isDrawer,
        groupStats,
        sceneStats
      );

      const isSlidingDoor = isDoor && this.isSlidingDoorPart(part);
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
      let slideDistanceMm = 320;
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

      if (isDoor && isSlidingDoor) {
        doorFacing = this.joineryEngine.getPartFacingDirection(part, parts);
        const slidingKin = this.resolveSlidingDoorKinematics(part, parts, doorFacing, localDims);
        slideAxis = slidingKin.slideAxis;
        slideDir = slidingKin.slideDir;
        slideDistanceMm = slidingKin.slideDistanceMm;
        hingeSide = hw.openingDirection === 'right' ? 'right' : 'left';

        mesh.position.set(px, py, pz);
        if (shouldRenderHardware && vis.showHandles) {
          handleGroup = this.createHandleMesh(
            part,
            hw,
            localDims.sx,
            localDims.sy,
            localDims.sz,
            true,
            hingeSide,
            doorFacing
          );
          if (handleGroup) mesh.add(handleGroup);
        }

        const curOpen = this.openCurrentMap.get(part.id) || 0;
        if (curOpen > 0) {
          if (slideAxis === 'x') mesh.position.x += curOpen * slideDistanceMm * slideDir;
          else mesh.position.z += curOpen * slideDistanceMm * slideDir;
        }

        this.furnitureGroup.add(mesh);
        mesh.userData = { part, isPiece: true, isDoor: true, isSlidingDoor: true };
      } else if (isDoor) {
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
        this.applyDoorPivotRotation(doorPivot, hingeSide, doorFacing, curOpen, doorBaseRotation);

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
        halfHeightY: sy / 2,
        explodedOffset,
        explosionGroupId,
        currentFloorLiftY: 0,
        isDoor,
        isSlidingDoor,
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
        slideDir,
        slideDistanceMm
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

    this.updateSelectionOutlineGroup(selectedIds);

    this.sceneRaycastPicker.refreshPickableMatricesAndBounds(
      [this.furnitureGroup, this.drillGroup],
      { forceRecomputeBounds: true }
    );
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
    const clampedProgress = Math.max(0, Math.min(1, cur));
    const maxAngle =
      hingeSide === 'top' || hingeSide === 'bottom'
        ? (Math.PI * 80) / 180
        : Math.PI / 2;
    const angle = clampedProgress * maxAngle;

    if (hingeSide === 'left') {
      doorPivot.rotateY(-angle);
    } else if (hingeSide === 'right') {
      doorPivot.rotateY(angle);
    } else if (hingeSide === 'top') {
      doorPivot.rotateX(-angle);
    } else if (hingeSide === 'bottom') {
      doorPivot.rotateX(angle);
    }

    if (hingeSide === 'top' || hingeSide === 'bottom') {
      this.updateDoorPistonsForPivot(doorPivot, hingeSide, clampedProgress);
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
      halo.raycast = () => {
        // Deshabilitar raycast en el halo visual
      };
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

  private tFallback(key: string, fallback: string): string {
    const translated = this.i18n.t(key);
    return translated && translated !== key ? translated : fallback;
  }

  isClearanceBadgeType(propType: EditableDimensionBadgeType): boolean {
    return propType !== 'length' && propType !== 'width';
  }

  private buildClearancePairKey(
    axis: ClearanceAxis,
    idA?: string | null,
    idB?: string | null
  ): string {
    const [a, b] = [idA ?? 'none', idB ?? 'none'].sort();
    return `${axis}:${a}:${b}`;
  }

  showClearanceWarningToast(message: string) {
    if (this.clearanceToastTimer !== null) {
      clearTimeout(this.clearanceToastTimer);
      this.clearanceToastTimer = null;
    }
    this.ngZone.run(() => {
      this.clearanceWarningToast.set(message);
    });
    this.clearanceToastTimer = setTimeout(() => {
      this.clearanceToastTimer = null;
      this.ngZone.run(() => {
        this.clearanceWarningToast.set(null);
      });
    }, 3800);
  }

  dismissClearanceWarningToast() {
    if (this.clearanceToastTimer !== null) {
      clearTimeout(this.clearanceToastTimer);
      this.clearanceToastTimer = null;
    }
    this.ngZone.run(() => {
      this.clearanceWarningToast.set(null);
    });
  }

  private onCanvasPointerLeave() {
    const canvas = this.canvasRef()?.nativeElement;
    if (canvas && !this.isDragging && !this.activeGizmoHit) {
      canvas.style.cursor = this.isMeasureMode() ? 'crosshair' : 'grab';
    }
    this.setHoveredGizmoMesh(null);
    this.setHoveredDimensionSprite(null);
  }

  private setHoveredDimensionSprite(sprite: THREE.Sprite | null) {
    const badgeData = sprite?.userData as Partial<DimensionBadgeUserData> | undefined;
    const nextTooltip =
      sprite &&
      badgeData?.isDimensionBadge &&
      badgeData.badgeType &&
      this.isClearanceBadgeType(badgeData.badgeType)
        ? this.tFallback('designer.editClearanceHint', 'Clic para editar separación en mm')
        : null;
    if (this.hoveredDimensionTooltip() !== nextTooltip) {
      this.ngZone.run(() => {
        this.hoveredDimensionTooltip.set(nextTooltip);
      });
    }

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
      ring.raycast = () => {
        // Deshabilitar raycast en el anillo visual
      };
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
      halo.raycast = () => {
        // Deshabilitar raycast en el halo de esquina
      };
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

    // Verificar que otra pieza o volumen sólido en primer plano no esté ocultando este borde/esquina
    const hitDistToCam = this.camera.position.distanceTo(this.scratchBestHitWorld);
    const frontPick = this.sceneRaycastPicker.pickClosestSceneCandidate(
      this.raycaster,
      this.buildSceneRaycastSources()
    );
    const closestFront = frontPick.closest;
    if (closestFront && closestFront.distance < hitDistToCam - 25) {
      const isSameSelectedPart =
        (closestFront.kind === 'piece' || closestFront.kind === 'drill_hole') &&
        closestFront.part?.id === part.id;
      if (!isSameSelectedPart) {
        this.hideDynamicEdgeHandle();
        return null;
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
    this.updateProjectedMeasureBadges();
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

    // 2. Escalar y mantener visibles las etiquetas de medida (dimensionGroup) centradas/deslizadas sobre P1..P2
    for (const child of this.dimensionGroup.children) {
      if (child instanceof THREE.Sprite) {
        this.updateDimensionSpriteAdaptiveTransform(child, this.dimensionGroup.position);
      } else {
        this.scratchDimParentOffset.copy(this.dimensionGroup.position).add(child.position);
        for (const nested of child.children) {
          if (nested instanceof THREE.Sprite) {
            this.updateDimensionSpriteAdaptiveTransform(nested, this.scratchDimParentOffset);
          }
        }
      }
    }

    // 3. Escalar y alinear sobre P1..P2 las cotas de luz interna (internalClearanceGroup)
    for (const child of this.internalClearanceGroup.children) {
      if (child instanceof THREE.Sprite) {
        this.updateDimensionSpriteAdaptiveTransform(child, this.internalClearanceGroup.position);
      }
    }
    this.updateProjectedMeasureBadges();
  }

  private updateDimensionSpriteAdaptiveTransform(
    sprite: THREE.Sprite,
    parentWorldOffset: THREE.Vector3
  ): void {
    const u = sprite.userData;
    if (u?.['edgeP1'] && u?.['edgeP2'] && this.controls) {
      const p1 = u['edgeP1'] as THREE.Vector3;
      const p2 = u['edgeP2'] as THREE.Vector3;
      this.scratchDimWorldP1.copy(p1).add(parentWorldOffset);
      this.scratchDimWorldP2.copy(p2).add(parentWorldOffset);
      const alongWorldPos = this.dimensionAnchor.computeAlongSegmentLabelPosition(
        this.scratchDimWorldP1,
        this.scratchDimWorldP2,
        this.camera.position,
        this.controls.target
      );
      sprite.position.copy(alongWorldPos).sub(parentWorldOffset);
    }

    this.scratchGizmoWorldPos.copy(sprite.position).add(parentWorldOffset);
    const dist = this.camera.position.distanceTo(this.scratchGizmoWorldPos);
    const baseX = (u?.['baseScaleX'] as number | undefined) || 140;
    const baseY = (u?.['baseScaleY'] as number | undefined) || 38;
    const isHovered = Boolean(u?.['isHovered']);
    const sDim = Math.max(0.12, Math.min(1.45, dist / 1050)) * (isHovered ? 1.15 : 1.0);
    sprite.scale.set(baseX * sDim, baseY * sDim, 1);
  }

  // --- MAGNETIC SNAP ENGINE (MOTOR DE INFERENCIAS CAD) ---

  // Estructura universal de candidato de imán magnético
  private getMeasureViewportRect(): ViewportRect | null {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }
    const container = this.containerRef()?.nativeElement;
    const width = canvas.clientWidth || container?.clientWidth || 0;
    const height = canvas.clientHeight || container?.clientHeight || 0;
    if (width <= 0 || height <= 0) return null;
    return { left: rect.left, top: rect.top, width, height };
  }

  private getTapeMeasureSolidRoots(): THREE.Object3D[] {
    const roots: THREE.Object3D[] = [];
    if (this.furnitureGroup && this.furnitureGroup.visible && this.furnitureGroup.children.length > 0) {
      roots.push(this.furnitureGroup);
    }
    const vis = this.layerVisibility();
    if (
      vis.showAppliances &&
      this.appliancesGroup &&
      this.appliancesGroup.visible &&
      this.appliancesGroup.children.length > 0
    ) {
      roots.push(this.appliancesGroup);
    }
    if (
      this.workspaceMode() === 'room' &&
      this.roomGroup &&
      this.roomGroup.visible &&
      this.roomGroup.children.length > 0
    ) {
      roots.push(this.roomGroup);
    }
    if (this.floorMesh && this.floorMesh.visible) {
      roots.push(this.floorMesh);
    }
    return roots;
  }

  private resolveTapeMeasureObjectName(obj: THREE.Object3D): string | null {
    const pieceMeta = this.resolvePieceHitMeta(obj);
    if (pieceMeta?.part?.name) {
      return pieceMeta.part.name;
    }
    const resolvedApp = this.resolveApplianceFromObject(obj);
    if (resolvedApp?.app?.name) {
      return resolvedApp.app.name;
    }
    const wallId = this.resolveWallIdFromObject(obj);
    if (wallId) {
      const wall = getResolvedRoomWalls(this.roomConfig()).find(w => w.id === wallId);
      return wall?.name || 'Muro';
    }
    let curr: THREE.Object3D | null = obj;
    while (curr && curr !== this.scene) {
      const data = curr.userData;
      if (data?.['part']?.name) return String(data['part'].name);
      if (data?.['isWall']) return 'Muro';
      if (data?.['isFloor']) return 'Piso';
      curr = curr.parent;
    }
    return null;
  }

  private findMeasureSnapCandidateAt(clientX: number, clientY: number): MagneticSnapCandidate | null {
    if (!this.camera) return null;
    const viewportRect = this.getMeasureViewportRect();
    if (!viewportRect) return null;
    return this.tapeMeasure.findClosestVisibleSnapCandidate(
      clientX,
      clientY,
      viewportRect,
      this.camera,
      this.getTapeMeasureSolidRoots(),
      {
        hiddenPartIds: this.hiddenPartIds(),
        resolveObjectName: obj => this.resolveTapeMeasureObjectName(obj)
      }
    );
  }

  // Renders visual magnetic snap indicator differentiated by type (Corner, Midpoint, Edge, Face)
  private updateMagneticSnapIndicator(candidate: MagneticSnapCandidate | null) {
    if (!candidate) {
      if (this.magneticSnapGroup.children.length > 0) {
        this.disposeGroup(this.magneticSnapGroup);
        this.lastSnapIndicatorKey = '';
        this.requestRender(4);
      }
      return;
    }

    this.magneticSnapGroup.position.copy(candidate.worldPos);
    this.magneticSnapGroup.renderOrder = TAPE_MEASURE_RENDER_ORDER;
    const snapKey = `${candidate.type}_${candidate.objectName}`;

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

    const colorHex = candidate.colorHex ?? SNAP_COLORS[candidate.type];
    const colorCss = candidate.colorCss || SNAP_CSS_COLORS[candidate.type];
    const labelPrefix = candidate.label || SNAP_LABELS[candidate.type];

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
      depthWrite: false,
      linewidth: 2
    });
    this.tapeMeasure.configureMeasureOverlayMaterial(crossMat);
    const crossLines = new THREE.LineSegments(crossGeo, crossMat);
    crossLines.renderOrder = TAPE_MEASURE_RENDER_ORDER;
    crossLines.userData = { isMeasurementVisual: true, isAuxiliaryVisual: true };
    this.magneticSnapGroup.add(crossLines);

    // 2. Specialized Geometric Snapping Badge
    let badgeMesh: THREE.Mesh;
    if (candidate.type === 'corner') {
      const ringGeo = new THREE.RingGeometry(3.5, 5.5, 16);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.95
      });
      this.tapeMeasure.configureMeasureOverlayMaterial(ringMat);
      badgeMesh = new THREE.Mesh(ringGeo, ringMat);
      badgeMesh.quaternion.copy(this.camera.quaternion);
    } else if (candidate.type === 'midpoint') {
      const diamondGeo = new THREE.PlaneGeometry(6, 6);
      const diamondMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.95
      });
      this.tapeMeasure.configureMeasureOverlayMaterial(diamondMat);
      badgeMesh = new THREE.Mesh(diamondGeo, diamondMat);
      badgeMesh.quaternion.copy(this.camera.quaternion);
      badgeMesh.rotateZ(Math.PI / 4);
    } else if (candidate.type === 'edge') {
      const edgeGeo = new THREE.PlaneGeometry(5, 5);
      const edgeMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.95
      });
      this.tapeMeasure.configureMeasureOverlayMaterial(edgeMat);
      badgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
      badgeMesh.quaternion.copy(this.camera.quaternion);
      badgeMesh.rotateZ(Math.PI / 4);
    } else {
      const faceGeo = new THREE.RingGeometry(2.5, 4.0, 12);
      const faceMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.85
      });
      this.tapeMeasure.configureMeasureOverlayMaterial(faceMat);
      badgeMesh = new THREE.Mesh(faceGeo, faceMat);
      badgeMesh.quaternion.copy(this.camera.quaternion);
    }
    badgeMesh.renderOrder = TAPE_MEASURE_RENDER_ORDER;
    badgeMesh.userData = { isMeasurementVisual: true, isAuxiliaryVisual: true };
    this.magneticSnapGroup.add(badgeMesh);

    // 3. Compact Floating Label Sprite (Minimalist Studio + Inter --font-sans)
    const rawName = (candidate.objectName || '').trim();
    const shortName = rawName.length > 18 ? `${rawName.slice(0, 17)}…` : rawName;
    const labelText = shortName ? `${labelPrefix} · ${shortName}` : labelPrefix;
    const spriteMat = this.getCachedBadgeMaterial(
      `snap_label_ms_${colorCss}_${labelText}`,
      270,
      48,
      (ctx) => {
        ctx.fillStyle = 'rgba(24, 24, 27, 0.94)';
        ctx.beginPath();
        ctx.roundRect(0, 0, 270, 48, 10);
        ctx.fill();
        ctx.strokeStyle = colorCss;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 17px Inter, system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, 135, 24);
      },
      'measure'
    );
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(0, 16, 0);
    sprite.scale.set(66, 14, 1);
    sprite.renderOrder = TAPE_MEASURE_RENDER_ORDER;
    sprite.userData = { isMeasurementVisual: true, isAuxiliaryVisual: true };
    this.magneticSnapGroup.add(sprite);
    this.requestRender(4);
  }

  private resolveMeasureFallbackPlanePoint(clientX: number, clientY: number, ptA: Point3D): Point3D | null {
    const viewportRect = this.getMeasureViewportRect();
    if (!viewportRect || !this.camera) return null;

    this.mouse.x = ((clientX - viewportRect.left) / viewportRect.width) * 2 - 1;
    this.mouse.y = -((clientY - viewportRect.top) / viewportRect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const horizontalPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ptA.y);
    const intersectPt = new THREE.Vector3();
    if (
      Math.abs(this.raycaster.ray.direction.y) > 0.08 &&
      this.raycaster.ray.intersectPlane(horizontalPlane, intersectPt)
    ) {
      return { x: intersectPt.x, y: intersectPt.y, z: intersectPt.z };
    }

    const camNormal = new THREE.Vector3();
    this.camera.getWorldDirection(camNormal);
    const camPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      camNormal,
      new THREE.Vector3(ptA.x, ptA.y, ptA.z)
    );
    if (this.raycaster.ray.intersectPlane(camPlane, intersectPt)) {
      return { x: intersectPt.x, y: intersectPt.y, z: intersectPt.z };
    }
    return null;
  }

  // Resolves Point B applying orthogonal axis inference, perpendicular projection & 15px/25mm thresholds
  private resolveMeasurementPointB(
    rawPoint: Point3D | THREE.Vector3,
    shiftPressed = false,
    clientX?: number,
    clientY?: number
  ): { pointB: Point3D; axisLock: MeasureAxisLock } {
    const a = this.measurePointA();
    if (!a) {
      return {
        pointB: {
          x: Math.round(rawPoint.x),
          y: Math.max(0, Math.round(rawPoint.y)),
          z: Math.round(rawPoint.z)
        },
        axisLock: null
      };
    }

    const clientPos =
      clientX !== undefined && clientY !== undefined
        ? { x: clientX, y: clientY }
        : this.lastMeasurePointerClient;

    return this.tapeMeasure.resolvePerpendicularPointB(a, rawPoint, {
      mode: this.measureProjectionMode(),
      shiftPressed: shiftPressed || this.isShiftPressed(),
      camera: this.camera,
      viewportRect: this.getMeasureViewportRect(),
      cursorClientX: clientPos?.x,
      cursorClientY: clientPos?.y
    });
  }

  private reprojectActiveMeasurePreview(shiftOverride?: boolean): void {
    const a = this.measurePointA();
    const rawB = this.lastRawMeasurePointB ?? this.measurePointB();
    if (!a || !rawB) return;

    const resolved = this.resolveMeasurementPointB(rawB, shiftOverride ?? this.isShiftPressed());
    this.measurePointB.set(resolved.pointB);
    this.activeInferredAxis.set(resolved.axisLock);
    this.renderMeasurementVisuals();
    this.updateProjectedMeasureBadges();
  }

  // Permite conmutar la proyección visual de la cota desde el panel flotante
  setMeasureProjectionMode(mode: MeasureProjectionMode) {
    this.measureProjectionMode.set(mode);
    if (this.measurePointA() && (this.lastRawMeasurePointB || this.measurePointB())) {
      this.reprojectActiveMeasurePreview();
    }
  }

  // Start a fresh measurement without deleting saved measurements
  startNewMeasurement() {
    this.measureProjectionMode.set('direct');
    this.cancelActiveMeasurementTrace();
  }

  // Cancel ONLY the in-progress trace (preserves savedMeasurements)
  cancelActiveMeasurementTrace() {
    this.measurePointA.set(null);
    this.measurePointB.set(null);
    this.lastRawMeasurePointB = null;
    this.measurePointerDownPos = null;
    this.activeInferredAxis.set(null);
    if (this.previewMeasureBadge() !== null) {
      if (NgZone.isInAngularZone()) {
        this.previewMeasureBadge.set(null);
      } else {
        this.ngZone.run(() => this.previewMeasureBadge.set(null));
      }
    }
    this.updateMagneticSnapIndicator(null);
    this.renderMeasurementVisuals();
    this.updateProjectedMeasureBadges();
  }

  removeMeasurement(id: string) {
    this.savedMeasurements.update(list => list.filter(item => item.id !== id));
    this.renderMeasurementVisuals();
    this.updateProjectedMeasureBadges();
    this.requestRender(6);
  }

  clearAllMeasurements() {
    this.savedMeasurements.set([]);
    this.measurePointA.set(null);
    this.measurePointB.set(null);
    this.lastRawMeasurePointB = null;
    this.measurePointerDownPos = null;
    this.activeInferredAxis.set(null);
    this.projectedMeasureBadges.set([]);
    this.previewMeasureBadge.set(null);
    this.disposeGroup(this.measureGroup);
    this.updateMagneticSnapIndicator(null);
    this.requestRender(6);
  }

  private isProjectedBadgeListEqual(
    prev: readonly ProjectedMeasurementBadge[],
    next: readonly ProjectedMeasurementBadge[]
  ): boolean {
    if (prev.length !== next.length) return false;
    for (let i = 0; i < prev.length; i++) {
      const a = prev[i];
      const b = next[i];
      if (
        a.id !== b.id ||
        a.visible !== b.visible ||
        a.formattedDistance !== b.formattedDistance ||
        a.colorCss !== b.colorCss ||
        a.axisLock !== b.axisLock ||
        Math.abs(a.x - b.x) > 0.1 ||
        Math.abs(a.y - b.y) > 0.1
      ) {
        return false;
      }
    }
    return true;
  }

  private isProjectedBadgeEqual(
    a: ProjectedMeasurementBadge | null,
    b: ProjectedMeasurementBadge | null
  ): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return (
      a.id === b.id &&
      a.visible === b.visible &&
      a.formattedDistance === b.formattedDistance &&
      a.colorCss === b.colorCss &&
      a.axisLock === b.axisLock &&
      Math.abs(a.x - b.x) <= 0.1 &&
      Math.abs(a.y - b.y) <= 0.1
    );
  }

  updateProjectedMeasureBadges(): void {
    const saved = this.savedMeasurements();
    const activeA = this.measurePointA();
    const activeB = this.measurePointB();

    if (saved.length === 0 && (!activeA || !activeB)) {
      const hasSaved = this.projectedMeasureBadges().length > 0;
      const hasPreview = this.previewMeasureBadge() !== null;
      if (!hasSaved && !hasPreview) return;
      const clearFn = () => {
        if (hasSaved) this.projectedMeasureBadges.set([]);
        if (hasPreview) this.previewMeasureBadge.set(null);
      };
      if (NgZone.isInAngularZone()) {
        clearFn();
      } else {
        this.ngZone.run(clearFn);
      }
      return;
    }

    const viewportRect = this.getMeasureViewportRect();
    if (!this.camera || !viewportRect) return;

    const nextSavedBadges =
      saved.length > 0
        ? this.tapeMeasure.buildProjectedBadges(saved, this.camera, viewportRect.width, viewportRect.height)
        : [];

    let nextPreview: ProjectedMeasurementBadge | null = null;
    if (activeA && activeB) {
      let targetB = activeB;
      const mode = this.measureProjectionMode();
      let effectiveLock: MeasureAxisLock = this.activeInferredAxis();
      if (mode === 'x') {
        targetB = { x: activeB.x, y: activeA.y, z: activeA.z };
        effectiveLock = 'x';
      } else if (mode === 'y') {
        targetB = { x: activeA.x, y: activeB.y, z: activeA.z };
        effectiveLock = 'y';
      } else if (mode === 'z') {
        targetB = { x: activeA.x, y: activeA.y, z: activeB.z };
        effectiveLock = 'z';
      }
      const dist = Math.hypot(targetB.x - activeA.x, targetB.y - activeA.y, targetB.z - activeA.z);
      if (dist >= 0.5) {
        const previewSaved = this.tapeMeasure.buildSavedMeasurement(activeA, targetB, effectiveLock, '__preview__');
        nextPreview =
          this.tapeMeasure.buildProjectedBadges(
            [previewSaved],
            this.camera,
            viewportRect.width,
            viewportRect.height
          )[0] ?? null;
      }
    }

    const savedChanged = !this.isProjectedBadgeListEqual(this.projectedMeasureBadges(), nextSavedBadges);
    const previewChanged = !this.isProjectedBadgeEqual(this.previewMeasureBadge(), nextPreview);
    if (!savedChanged && !previewChanged) return;

    const applyUpdate = () => {
      if (savedChanged) this.projectedMeasureBadges.set(nextSavedBadges);
      if (previewChanged) this.previewMeasureBadge.set(nextPreview);
    };
    if (NgZone.isInAngularZone()) {
      applyUpdate();
    } else {
      this.ngZone.run(applyUpdate);
    }
  }

  private configureMeasureOverlayObject(obj: THREE.Object3D, mat?: THREE.Material): void {
    obj.renderOrder = TAPE_MEASURE_RENDER_ORDER;
    obj.userData = { ...obj.userData, isMeasurementVisual: true, isAuxiliaryVisual: true };
    if (mat) {
      this.tapeMeasure.configureMeasureOverlayMaterial(mat);
    }
  }

  private createCadCrosshair(pt: Point3D, colorHex: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(pt.x, pt.y, pt.z);
    this.configureMeasureOverlayObject(group);

    const s = 4.0;
    const pts = [
      new THREE.Vector3(-s, 0, 0), new THREE.Vector3(s, 0, 0),
      new THREE.Vector3(0, -s, 0), new THREE.Vector3(0, s, 0),
      new THREE.Vector3(0, 0, -s), new THREE.Vector3(0, 0, s)
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: colorHex, depthTest: false, depthWrite: false, linewidth: 2 });
    const lines = new THREE.LineSegments(geo, mat);
    this.configureMeasureOverlayObject(lines, mat);
    group.add(lines);

    const dotGeo = new THREE.SphereGeometry(1.2, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    this.configureMeasureOverlayObject(dot, dotMat);
    group.add(dot);

    return group;
  }

  private createCadArrow(tipPos: Point3D, dirPointingAtTip: THREE.Vector3, colorHex: number): THREE.Mesh {
    const arrowLength = 12; // mm
    const arrowRadius = 2.4; // mm
    const coneGeo = new THREE.ConeGeometry(arrowRadius, arrowLength, 12);
    coneGeo.translate(0, -arrowLength / 2, 0);

    const coneMat = new THREE.MeshBasicMaterial({ color: colorHex, depthTest: false, depthWrite: false });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);

    const defaultUp = new THREE.Vector3(0, 1, 0);
    const normDir = dirPointingAtTip.clone().normalize();
    coneMesh.quaternion.setFromUnitVectors(defaultUp, normDir);
    coneMesh.position.set(tipPos.x, tipPos.y, tipPos.z);
    this.configureMeasureOverlayObject(coneMesh, coneMat);

    return coneMesh;
  }

  private renderMeasurementSegmentVisuals(
    a: Point3D,
    b: Point3D,
    axisLock: MeasureAxisLock,
    showDeltaGuides: boolean
  ): void {
    const vecAB = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z);
    const totalDist = vecAB.length();
    const lineColor = axisLock ? AXIS_COLORS[axisLock] : AXIS_COLORS.direct;

    const dirAtA =
      totalDist > 0.1
        ? new THREE.Vector3(a.x - b.x, a.y - b.y, a.z - b.z).normalize()
        : new THREE.Vector3(0, 1, 0);
    const dirAtB = dirAtA.clone().negate();

    if (totalDist > 0.5) {
      this.measureGroup.add(this.createCadArrow(a, dirAtA, lineColor));
      this.measureGroup.add(this.createCadArrow(b, dirAtB, lineColor));
    }
    this.measureGroup.add(this.createCadCrosshair(a, 0x10b981));
    this.measureGroup.add(this.createCadCrosshair(b, 0x10b981));

    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a.x, a.y, a.z),
      new THREE.Vector3(b.x, b.y, b.z)
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: lineColor,
      linewidth: 2,
      depthTest: false,
      depthWrite: false
    });
    const directLine = new THREE.Line(lineGeo, lineMat);
    this.configureMeasureOverlayObject(directLine, lineMat);
    this.measureGroup.add(directLine);

    if (showDeltaGuides && axisLock === null) {
      const addDashedDelta = (pStart: THREE.Vector3, pEnd: THREE.Vector3, color: number) => {
        const g = new THREE.BufferGeometry().setFromPoints([pStart, pEnd]);
        const m = new THREE.LineDashedMaterial({
          color,
          dashSize: 12,
          gapSize: 8,
          depthTest: false,
          depthWrite: false
        });
        const l = new THREE.Line(g, m);
        l.computeLineDistances();
        this.configureMeasureOverlayObject(l, m);
        this.measureGroup.add(l);
      };

      if (Math.abs(b.x - a.x) > 4) {
        addDashedDelta(new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, a.y, a.z), AXIS_COLORS.x);
      }
      if (Math.abs(b.y - a.y) > 4) {
        addDashedDelta(new THREE.Vector3(b.x, a.y, a.z), new THREE.Vector3(b.x, b.y, a.z), AXIS_COLORS.y);
      }
      if (Math.abs(b.z - a.z) > 4) {
        addDashedDelta(new THREE.Vector3(b.x, b.y, a.z), new THREE.Vector3(b.x, b.y, b.z), AXIS_COLORS.z);
      }
    }
  }

  // Render Interactive 3D Measurement Visuals for all saved measurements + active trace
  renderMeasurementVisuals() {
    this.disposeGroup(this.measureGroup);
    this.measureGroup.renderOrder = TAPE_MEASURE_RENDER_ORDER;
    this.requestRender(6);

    for (const saved of this.savedMeasurements()) {
      this.renderMeasurementSegmentVisuals(saved.pointA, saved.pointB, saved.axisLock, saved.axisLock === null);
    }

    const a = this.measurePointA();
    if (!a) return;

    const b = this.measurePointB();
    if (!b) {
      this.measureGroup.add(this.createCadCrosshair(a, AXIS_COLORS.direct));
      const anchorRingGeo = new THREE.RingGeometry(3, 5, 16);
      const anchorRingMat = new THREE.MeshBasicMaterial({
        color: AXIS_COLORS.direct,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.85
      });
      const anchorRing = new THREE.Mesh(anchorRingGeo, anchorRingMat);
      anchorRing.position.set(a.x, a.y, a.z);
      if (this.camera) {
        anchorRing.quaternion.copy(this.camera.quaternion);
      }
      this.configureMeasureOverlayObject(anchorRing, anchorRingMat);
      this.measureGroup.add(anchorRing);
      return;
    }

    let targetB: Point3D = { ...b };
    const mode = this.measureProjectionMode();
    let effectiveAxisLock: MeasureAxisLock = this.activeInferredAxis();

    if (mode === 'x') {
      targetB = { x: b.x, y: a.y, z: a.z };
      effectiveAxisLock = 'x';
    } else if (mode === 'y') {
      targetB = { x: a.x, y: b.y, z: a.z };
      effectiveAxisLock = 'y';
    } else if (mode === 'z') {
      targetB = { x: a.x, y: a.y, z: b.z };
      effectiveAxisLock = 'z';
    }

    this.renderMeasurementSegmentVisuals(a, targetB, effectiveAxisLock, true);
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

    const latestPartsMap =
      !this.isDragging && !this.isDirectPieceDrag && !this.isApplianceDragging
        ? new Map(untracked(() => this.parts()).map(p => [p.id, p]))
        : null;

    const selectedDataList: { part: Part; px: number; py: number; pz: number; sx: number; sy: number; sz: number }[] = [];

    for (const item of this.pieceObjects) {
      if (latestPartsMap) {
        const freshPart = latestPartsMap.get(item.part.id);
        if (freshPart) {
          item.part = freshPart;
          item.mesh.userData['part'] = freshPart;
        }
      }
      const part = item.part;
      const isSelected = selectedIds.includes(part.id);
      const isColliding = collidingPartIds.has(part.id);

      // 1. Mantener siempre el color/textura auténtico de la melamina (solo advertencia roja si hay colisión)
      item.mesh.material = this.createPieceMaterial(part, isSelected, mats, xRay, isColliding);
      this.refreshPartDetailMaterials(item.mesh, xRay, isColliding);

      // 2. Actualizar contorno técnico CAD por aristas (Azul Acero #0284C7 en selección, Rojo en colisión)
      const edgeMat = this.getSharedEdgeMaterial(isColliding, isSelected);
      for (const child of item.mesh.children) {
        if (child instanceof THREE.LineSegments) {
          child.material = edgeMat;
          child.scale.setScalar(isSelected || isColliding ? 1.001 : 1);
          child.renderOrder = isSelected || isColliding ? 20 : 0;
        }
      }

      if (isSelected) {
        const t = part.thickness || 15;
        const L = part.length;
        const W = part.width;
        let sx = L; let sy = t; let sz = W;
        if (
          part.shapeType === 'circle' ||
          Math.abs(part.rotationX || 0) > 0.01 ||
          Math.abs(part.rotationY || 0) > 0.01 ||
          Math.abs(part.rotationZ || 0) > 0.01
        ) {
          const b = this.getPartBounds(part);
          sx = b.sx;
          sy = b.sy;
          sz = b.sz;
        } else if (part.orientation === 'vertical_yz') {
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
    this.updateSelectionOutlineGroup(selectedIds);
    this.requestRender(8);
  }

  /**
   * Construye el marco exterior CAD (bounding-box wireframe) no-raycasteable en Azul Acero (#0284C7)
   * cuando hay 2 o más piezas seleccionadas pertenecientes a un mismo módulo/grupo (`groupId`).
   */
  private updateSelectionOutlineGroup(selectedIds: string[], overrideExplodedFactor?: number): void {
    if (!this.scene) return;
    this.disposeGroup(this.selectionOutlineGroup);
    this.selectionOutlineGroup.position.set(0, 0, 0);
    this.selectionOutlineGroup.rotation.set(0, 0, 0);

    if (!selectedIds || selectedIds.length < 2) {
      this.selectionOutlineGroup.visible = false;
      return;
    }

    const selectedSet = new Set(selectedIds);
    const groupedItems = new Map<string, PieceMeshData[]>();
    for (const item of this.pieceObjects) {
      const gId = item.part.groupId;
      if (!gId || !selectedSet.has(item.part.id)) continue;
      const list = groupedItems.get(gId);
      if (list) {
        list.push(item);
      } else {
        groupedItems.set(gId, [item]);
      }
    }

    const allParts = this.parts();
    const coveredHostedGroupIds = new Set<string>();
    for (const [gId, items] of groupedItems.entries()) {
      const groupParts = allParts.filter(p => p.groupId === gId);
      if (groupParts.length === 0 || !groupParts.every(p => selectedSet.has(p.id))) continue;
      const hostedIds = this.getHostedGroupIdsForHostIds(new Set([gId]));
      if (hostedIds.size === 0) continue;
      const existingIds = new Set(items.map(i => i.part.id));
      for (const pieceItem of this.pieceObjects) {
        const pgId = pieceItem.part.groupId;
        if (pgId && hostedIds.has(pgId) && !existingIds.has(pieceItem.part.id)) {
          items.push(pieceItem);
          existingIds.add(pieceItem.part.id);
        }
      }
      for (const hId of hostedIds) {
        coveredHostedGroupIds.add(hId);
      }
    }

    const expFactor =
      overrideExplodedFactor !== undefined
        ? Math.max(0, Math.min(1, overrideExplodedFactor))
        : Math.max(0, Math.min(1, Number(untracked(() => this.explodedPercent())) / 100 || 0));
    let addedCount = 0;

    for (const [groupId, items] of groupedItems.entries()) {
      if (coveredHostedGroupIds.has(groupId)) continue;
      if (items.length < 2) continue;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;

      for (const item of items) {
        const b = this.getPartBounds(item.part);
        const floorLiftY = expFactor > 0 ? (item.currentFloorLiftY ?? 0) : 0;
        const ox = expFactor > 0 ? item.explodedOffset.x * expFactor : 0;
        const oy = expFactor > 0 ? item.explodedOffset.y * expFactor + floorLiftY : 0;
        const oz = expFactor > 0 ? item.explodedOffset.z * expFactor : 0;
        minX = Math.min(minX, b.minX + ox);
        maxX = Math.max(maxX, b.maxX + ox);
        minY = Math.min(minY, b.minY + oy);
        maxY = Math.max(maxY, b.maxY + oy);
        minZ = Math.min(minZ, b.minZ + oz);
        maxZ = Math.max(maxZ, b.maxZ + oz);
      }

      if (
        !Number.isFinite(minX) ||
        !Number.isFinite(maxX) ||
        !Number.isFinite(minY) ||
        !Number.isFinite(maxY) ||
        !Number.isFinite(minZ) ||
        !Number.isFinite(maxZ)
      ) {
        continue;
      }

      const sx = Math.max(1, maxX - minX);
      const sy = Math.max(1, maxY - minY);
      const sz = Math.max(1, maxZ - minZ);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const cz = (minZ + maxZ) / 2;

      const tmpBoxGeo = new THREE.BoxGeometry(sx + 2, sy + 2, sz + 2);
      const edgesGeo = new THREE.EdgesGeometry(tmpBoxGeo);
      tmpBoxGeo.dispose();

      const lineMat = new THREE.LineBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.92,
        depthWrite: false
      });
      const wireframe = new THREE.LineSegments(edgesGeo, lineMat);
      wireframe.position.set(cx, cy, cz);
      wireframe.renderOrder = 940;
      wireframe.userData = {
        isAuxiliaryVisual: true,
        isOutline: true,
        isSelectionGroupOutline: true,
        groupId
      };
      wireframe.raycast = () => {
        // Contorno exterior de módulo no seleccionable por raycasting
      };
      this.selectionOutlineGroup.add(wireframe);
      addedCount++;
    }

    this.selectionOutlineGroup.visible = addedCount > 0;
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
    const rawHandleType = hw.handleType || 'bar_modern';
    const handleType: HandleType = rawHandleType === 'handle' ? 'bar_modern' : rawHandleType;
    const openingSystem = hw.openingSystem || hw.drawerOpeningSystem;
    if (
      hw.isInternalDrawerFront ||
      hw.handlePosition === 'none' ||
      handleType === 'none' ||
      handleType === 'push' ||
      handleType === 'push_open' ||
      handleType === 'finger_pull' ||
      handleType === 'gola_less' ||
      handleType === 'gola' ||
      openingSystem === 'push' ||
      openingSystem === 'finger_pull' ||
      openingSystem === 'gola'
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

    if (handleType === 'bar_modern' || handleType === 'bar_black') {
      const requestedLen = hw.handleLength || (handleType === 'bar_black' ? 192 : 160);
      let maxBarSpan = 192;
      if (isDoor) {
        maxBarSpan =
          hingeSide === 'top' || hingeSide === 'bottom'
            ? Math.max(24, sx - 24)
            : Math.max(24, sy - 24);
      } else {
        const faceSpan = drawerFacing === 'left' || drawerFacing === 'right' ? sz : sx;
        maxBarSpan = Math.max(24, faceSpan - 24);
      }
      const len = Math.max(24, Math.min(requestedLen, maxBarSpan));
      const standoffInset = Math.min(18, len * 0.25);
      const isBarBlack = handleType === 'bar_black';
      const barMesh = isBarBlack
        ? new THREE.Mesh(new THREE.BoxGeometry(10, len, 12), handleMat)
        : new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, len, 18), handleMat);

      const standoff1 = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 24, 14), standoffMat);
      standoff1.rotation.x = Math.PI / 2;
      standoff1.position.set(0, len / 2 - standoffInset, -11);

      const standoff2 = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 24, 14), standoffMat);
      standoff2.rotation.x = Math.PI / 2;
      standoff2.position.set(0, -len / 2 + standoffInset, -11);

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
      const availW = isDoor || drawerFacing === 'front' || drawerFacing === 'back' ? sx : sz;
      const cupW = Math.min(96, Math.max(36, availW - 16));
      const cupH = Math.min(36, Math.max(20, sy - 12));
      const cupHoodW = Math.max(24, Math.round(cupW * (68 / 96)));
      const cupRadius = Math.min(16, Math.max(9, (cupH - 4) / 2));

      const cupBack = new THREE.Mesh(new THREE.BoxGeometry(cupW, cupH, 4), handleMat);
      // Apoyar la cara trasera de cupBack exactamente a ras sobre +sz/2 (z_local = -15 en grupo en sz/2 + 15)
      cupBack.position.set(0, 0, -13);
      const cupHood = new THREE.Mesh(
        new THREE.CylinderGeometry(cupRadius, cupRadius, cupHoodW, 20, 1, false, -Math.PI / 2, Math.PI),
        handleMat
      );
      cupHood.rotation.z = Math.PI / 2;
      cupHood.position.set(0, 0, -11);
      group.add(cupBack, cupHood);
    }

    // Posicionar tirador en puerta o cajón según las 4 direcciones cardinales
    if (isDoor) {
      const isVerticalBar = handleType === 'bar_modern' || handleType === 'bar_black';
      const exteriorFaceZ = sz / 2 + 15;
      const isVitrina = this.isVitrinaDoorPart(part);
      const vitrinaBarW = isVitrina ? this.computeVitrinaFrameBarWidth(sx, sy) : 0;
      group.rotation.set(0, 0, 0);

      if (hingeSide === 'top') {
        if (isVerticalBar) group.rotation.z = Math.PI / 2;
        const bottomMargin = isVitrina
          ? Math.min(sy / 2, Math.max(12, vitrinaBarW / 2))
          : sy >= 120
            ? 40
            : Math.max(20, sy * 0.25);
        group.position.set(0, -sy / 2 + bottomMargin, exteriorFaceZ);
      } else if (hingeSide === 'bottom') {
        if (isVerticalBar) group.rotation.z = Math.PI / 2;
        const topMargin = isVitrina
          ? Math.min(sy / 2, Math.max(12, vitrinaBarW / 2))
          : sy >= 120
            ? 40
            : Math.max(20, sy * 0.25);
        group.position.set(0, sy / 2 - topMargin, exteriorFaceZ);
      } else {
        const baseMarginX = isVitrina
          ? Math.min(sx / 2, Math.max(12, vitrinaBarW / 2))
          : sx >= 250
            ? 45
            : Math.max(22, sx * 0.15);
        const minEdgeClearanceX =
          handleType === 'cup_vintage'
            ? Math.min(sx / 2, Math.min(96, Math.max(36, sx - 16)) / 2 + 8)
            : baseMarginX;
        const marginX = Math.min(sx / 2, Math.max(baseMarginX, minEdgeClearanceX));
        const handleX = hingeSide === 'left' ? sx / 2 - marginX : -sx / 2 + marginX;

        const requestedLen = hw.handleLength || (handleType === 'bar_black' ? 192 : 160);
        const activeSpanY = isVerticalBar
          ? Math.max(24, Math.min(requestedLen, Math.max(24, sy - 24)))
          : handleType === 'cup_vintage'
            ? Math.min(36, Math.max(20, sy - 12))
            : 28;
        const desiredVertMargin = Math.min(120, Math.max(45, sy * 0.2));
        const vertMargin = Math.min(sy / 2, Math.max(desiredVertMargin, activeSpanY / 2 + 12));

        let handleY = 0;
        if (hw.handlePosition === 'top') {
          handleY = sy / 2 - vertMargin;
        } else if (hw.handlePosition === 'bottom') {
          handleY = -sy / 2 + vertMargin;
        }
        group.position.set(handleX, handleY, exteriorFaceZ);
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

  /**
   * Calcula las posiciones exactas de las bisagras cazoleta Ø 35mm a lo largo del borde abisagrado (L en mm):
   * - L <= 900 mm: 2 bisagras (a 100 mm de cada extremo)
   * - 901 <= L <= 1600 mm: 3 bisagras ([-L/2 + 100, 0, +L/2 - 100])
   * - L > 1600 mm: 4 bisagras distribuidas simétricamente
   */
  computeHingeOffsetsForLength(edgeLengthMm: number): number[] {
    if (edgeLengthMm <= 0) return [];
    const margin = edgeLengthMm < 240 ? Math.max(25, Math.min(100, edgeLengthMm * 0.25)) : 100;
    const start = -edgeLengthMm / 2 + margin;
    const end = edgeLengthMm / 2 - margin;

    if (edgeLengthMm <= 900) {
      return [start, end];
    }
    if (edgeLengthMm <= 1600) {
      return [start, 0, end];
    }
    const step = (end - start) / 3;
    return [
      start,
      Math.round((start + step) * 100) / 100,
      Math.round((start + 2 * step) * 100) / 100,
      end
    ];
  }

  /**
   * Calcula la cinemática 3D exacta (Punto A fijo en el lateral interno del mueble -> Punto B móvil en la cara interna de la puerta)
   * expresada en el sistema local de doorPivot (donde z = 0 es la cara interior de la puerta, z = +sz es la cara exterior, y z < 0 es el interior del mueble).
   * Garantiza matemáticamente que A_local.z <= 0 y B_local.z <= 0 para todo ángulo de 0° a 80° (cero perforación de la puerta).
   */
  computeDoorPistonKinematics(
    sx: number,
    sy: number,
    sz: number,
    hingeSide: 'top' | 'bottom',
    angleDeg: number
  ): DoorPistonKinematicsResult {
    const maxAngleDeg = 80;
    const clampedDeg = Math.max(0, Math.min(maxAngleDeg, angleDeg));
    const theta = THREE.MathUtils.degToRad(clampedDeg);

    const halfLateralClearance = Math.max(20, sx / 2 - 18 - 15);
    const absYA = Math.min(120, Math.max(60, sy * 0.35));
    const yA = hingeSide === 'top' ? -absYA : absYA;
    const zA = -45;

    const armR = Math.min(130, Math.max(65, sy * 0.38));
    const yB = hingeSide === 'top' ? -armR : armR;
    const zB = -4;

    const rotAxisAngle = hingeSide === 'top' ? -theta : theta;
    const invQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -rotAxisAngle
    );

    const buildEndpoint = (sideSign: -1 | 1): DoorPistonKinematicsEndpoint => {
      const xA = sideSign * halfLateralClearance;
      const aBase = new THREE.Vector3(xA, yA, zA);
      const aLocal = aBase.clone().applyQuaternion(invQuat);
      const bLocal = new THREE.Vector3(xA, yB, zB);
      return {
        aBase,
        aLocal,
        bLocal,
        length: bLocal.distanceTo(aLocal)
      };
    };

    return {
      left: buildEndpoint(-1),
      right: buildEndpoint(1),
      angleDeg: clampedDeg,
      maxAngleDeg
    };
  }

  private updateSinglePistonAssembly(
    pistonAssembly: THREE.Group,
    endpoint: DoorPistonKinematicsEndpoint
  ): void {
    const bracketA = pistonAssembly.getObjectByName('piston_bracket_a');
    const bracketB = pistonAssembly.getObjectByName('piston_bracket_b');
    const outerCylinder = pistonAssembly.getObjectByName('piston_outer_cylinder');
    const chromeRod = pistonAssembly.getObjectByName('piston_chrome_rod');

    const { aLocal, bLocal } = endpoint;
    const vec = bLocal.clone().sub(aLocal);
    const totalLen = Math.max(20, vec.length());
    const dir = vec.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

    if (bracketA) {
      bracketA.position.copy(aLocal);
      bracketA.quaternion.copy(quat);
    }
    if (bracketB) {
      bracketB.position.copy(bLocal);
    }

    const cylLen = totalLen * 0.58;
    const rodLen = totalLen * 0.55;

    if (outerCylinder) {
      outerCylinder.position.copy(aLocal).addScaledVector(dir, cylLen * 0.5);
      outerCylinder.quaternion.copy(quat);
      outerCylinder.scale.set(1, cylLen, 1);
    }
    if (chromeRod) {
      chromeRod.position.copy(bLocal).addScaledVector(dir, -rodLen * 0.5);
      chromeRod.quaternion.copy(quat);
      chromeRod.scale.set(1, rodLen, 1);
    }

    pistonAssembly.userData['aLocal'] = aLocal.clone();
    pistonAssembly.userData['bLocal'] = bLocal.clone();
    pistonAssembly.userData['pistonLength'] = totalLen;
  }

  private updateDoorPistonsForPivot(
    doorPivot: THREE.Group,
    hingeSide: 'top' | 'bottom',
    progress: number
  ): void {
    const pistonSpaceGroup = doorPivot.getObjectByName('door_pistons_pivot_space') as THREE.Group | undefined;
    if (!pistonSpaceGroup) return;

    const sx = (pistonSpaceGroup.userData['sx'] as number) || 600;
    const sy = (pistonSpaceGroup.userData['sy'] as number) || 400;
    const sz = (pistonSpaceGroup.userData['sz'] as number) || 18;
    const angleDeg = Math.max(0, Math.min(1, progress)) * 80;

    const kin = this.computeDoorPistonKinematics(sx, sy, sz, hingeSide, angleDeg);
    pistonSpaceGroup.userData['kinematics'] = kin;

    const leftPiston = pistonSpaceGroup.getObjectByName('piston_left') as THREE.Group | undefined;
    const rightPiston = pistonSpaceGroup.getObjectByName('piston_right') as THREE.Group | undefined;
    if (leftPiston) {
      this.updateSinglePistonAssembly(leftPiston, kin.left);
    }
    if (rightPiston) {
      this.updateSinglePistonAssembly(rightPiston, kin.right);
    }
  }

  private createHingesMesh(
    part: Part,
    hw: PartHardwareConfig,
    sx: number,
    sy: number,
    sz: number,
    hingeSide: 'left' | 'right' | 'top' | 'bottom',
    _doorFacing: 'front' | 'right' | 'back' | 'left' = 'front'
  ): THREE.Group {
    void _doorFacing;
    const group = new THREE.Group();
    if (hw.hingeType === 'none' || this.isSlidingDoorPart(part)) return group;

    const doorW = sx;
    const doorH = sy;
    const doorT = sz;
    const isVitrina = this.isVitrinaDoorPart(part);
    const vitrinaBarW = isVitrina ? this.computeVitrinaFrameBarWidth(doorW, doorH) : 0;

    // Acero cepillado / níquel realista (Minimalist Studio)
    const brushedSteelMat = this.getSharedMaterial(
      'hw_hinge_brushed_steel_35',
      () => new THREE.MeshStandardMaterial({
        color: 0x71717a,
        metalness: 0.7,
        roughness: 0.3
      })
    );
    const darkSteelAccentMat = this.getSharedMaterial(
      'hw_hinge_dark_steel_accent',
      () => new THREE.MeshStandardMaterial({
        color: 0x52525b,
        metalness: 0.7,
        roughness: 0.3
      })
    );
    const pistonCylinderMat = this.getSharedMaterial(
      'hw_piston_chamber_dark',
      () => new THREE.MeshStandardMaterial({
        color: 0x27272a,
        metalness: 0.6,
        roughness: 0.35
      })
    );
    const pistonRodMat = this.getSharedMaterial(
      'hw_piston_chrome_rod',
      () => new THREE.MeshStandardMaterial({
        color: 0xd4d4d8,
        metalness: 0.85,
        roughness: 0.2
      })
    );

    // 1. Bisagras internas de cazoleta Ø 35 mm en la cara trasera/interna (-sz / 2)
    // Estrictamente en el lado interior (-Z) sin asomar jamás por la cara exterior (+sz / 2)
    const isHorizontalHingeEdge = hingeSide === 'top' || hingeSide === 'bottom';
    const hingedEdgeLength = isHorizontalHingeEdge ? doorW : doorH;
    const hingeOffsets = this.computeHingeOffsetsForLength(hingedEdgeLength);

    const cupGeo = this.getSharedGeometry(
      'hw_hinge_cup_35_internal',
      () => new THREE.CylinderGeometry(17.5, 17.5, 4, 24)
    );
    const cupCoreGeo = this.getSharedGeometry(
      'hw_hinge_cup_core_internal',
      () => new THREE.CylinderGeometry(13.5, 13.5, 4.4, 20)
    );
    const neckVertGeo = this.getSharedGeometry(
      'hw_hinge_neck_vert',
      () => new THREE.BoxGeometry(14, 12, 16)
    );
    const neckHorizGeo = this.getSharedGeometry(
      'hw_hinge_neck_horiz',
      () => new THREE.BoxGeometry(12, 14, 16)
    );
    const plateVertGeo = this.getSharedGeometry(
      'hw_hinge_plate_vert',
      () => new THREE.BoxGeometry(14, 38, 22)
    );
    const plateHorizGeo = this.getSharedGeometry(
      'hw_hinge_plate_horiz',
      () => new THREE.BoxGeometry(38, 14, 22)
    );

    const cupLocalZ = -doorT / 2; // Centrada en la cara interna (-sz/2); su espesor de 4mm llega solo hasta -sz/2 + 2mm
    const neckLocalZ = -doorT / 2 - 8;
    const plateLocalZ = -doorT / 2 - 13; // Se extiende hacia el interior del mueble (-Z) hasta -sz/2 - 24mm

    for (const offset of hingeOffsets) {
      const singleHinge = new THREE.Group();
      singleHinge.name = 'internal_cup_hinge_35';

      const cup = new THREE.Mesh(cupGeo, brushedSteelMat);
      cup.rotation.x = Math.PI / 2;
      cup.position.set(0, 0, cupLocalZ);
      singleHinge.add(cup);

      const cupCore = new THREE.Mesh(cupCoreGeo, darkSteelAccentMat);
      cupCore.rotation.x = Math.PI / 2;
      cupCore.position.set(0, 0, cupLocalZ - 0.4);
      singleHinge.add(cupCore);

      if (hingeSide === 'left' || hingeSide === 'right') {
        const edgeSign = hingeSide === 'left' ? -1 : 1;
        const neck = new THREE.Mesh(neckVertGeo, brushedSteelMat);
        neck.position.set(edgeSign * 8, 0, neckLocalZ);
        singleHinge.add(neck);

        const plate = new THREE.Mesh(plateVertGeo, darkSteelAccentMat);
        plate.position.set(edgeSign * 12, 0, plateLocalZ);
        singleHinge.add(plate);

        const edgeInsetX = isVitrina
          ? Math.min(22, Math.max(10, vitrinaBarW * 0.5))
          : doorW >= 60
            ? 22
            : Math.max(8, doorW * 0.35);
        const hingeX = hingeSide === 'left' ? -doorW / 2 + edgeInsetX : doorW / 2 - edgeInsetX;
        singleHinge.position.set(hingeX, offset, 0);
      } else {
        const edgeSign = hingeSide === 'top' ? 1 : -1;
        const neck = new THREE.Mesh(neckHorizGeo, brushedSteelMat);
        neck.position.set(0, edgeSign * 8, neckLocalZ);
        singleHinge.add(neck);

        const plate = new THREE.Mesh(plateHorizGeo, darkSteelAccentMat);
        plate.position.set(0, edgeSign * 12, plateLocalZ);
        singleHinge.add(plate);

        const edgeInsetY = isVitrina
          ? Math.min(22, Math.max(10, vitrinaBarW * 0.5))
          : doorH >= 60
            ? 22
            : Math.max(8, doorH * 0.35);
        const hingeY = hingeSide === 'top' ? doorH / 2 - edgeInsetY : -doorH / 2 + edgeInsetY;
        singleHinge.position.set(offset, hingeY, 0);
      }

      group.add(singleHinge);
    }

    // 2. Pistones a gas / brazos articulados internos (Punto A -> Punto B) para puertas abatibles (top / bottom)
    const hasArticulatedPistons =
      hingeSide === 'top' || hingeSide === 'bottom' || hw.hingeType === 'gas_piston';
    if (hasArticulatedPistons) {
      const effectivePistonSide: 'top' | 'bottom' = hingeSide === 'bottom' ? 'bottom' : 'top';
      const pistonPivotSpaceGroup = new THREE.Group();
      pistonPivotSpaceGroup.name = 'door_pistons_pivot_space';
      pistonPivotSpaceGroup.userData = {
        isPistonSpaceGroup: true,
        sx: doorW,
        sy: doorH,
        sz: doorT,
        hingeSide: effectivePistonSide
      };

      // Posicionar el grupo en el origen del pivote de la puerta (borde superior/inferior interno)
      // para que sus coordenadas locales coincidan exactamente con doorPivot (z = 0 cara interna, z < 0 interior del gabinete)
      if (effectivePistonSide === 'top') {
        pistonPivotSpaceGroup.position.set(0, doorH / 2, -doorT / 2);
      } else {
        pistonPivotSpaceGroup.position.set(0, -doorH / 2, -doorT / 2);
      }

      const unitCylGeo = this.getSharedGeometry(
        'hw_piston_unit_cyl_7_5',
        () => new THREE.CylinderGeometry(7.5, 7.5, 1, 16)
      );
      const unitRodGeo = this.getSharedGeometry(
        'hw_piston_unit_rod_4',
        () => new THREE.CylinderGeometry(4, 4, 1, 14)
      );
      const jointBallGeo = this.getSharedGeometry(
        'hw_piston_joint_ball',
        () => new THREE.SphereGeometry(5.5, 12, 12)
      );
      const doorBracketPlateGeo = this.getSharedGeometry(
        'hw_piston_door_bracket',
        () => new THREE.BoxGeometry(14, 22, 4)
      );

      const createArticulatedPiston = (name: 'piston_left' | 'piston_right'): THREE.Group => {
        const pistonAssembly = new THREE.Group();
        pistonAssembly.name = name;

        const bracketA = new THREE.Mesh(jointBallGeo, darkSteelAccentMat);
        bracketA.name = 'piston_bracket_a';
        pistonAssembly.add(bracketA);

        const bracketBGroup = new THREE.Group();
        bracketBGroup.name = 'piston_bracket_b';
        const bracketBBall = new THREE.Mesh(jointBallGeo, darkSteelAccentMat);
        const bracketBPlate = new THREE.Mesh(doorBracketPlateGeo, brushedSteelMat);
        bracketBPlate.position.set(0, 0, 2);
        bracketBGroup.add(bracketBBall, bracketBPlate);
        pistonAssembly.add(bracketBGroup);

        const outerCylinder = new THREE.Mesh(unitCylGeo, pistonCylinderMat);
        outerCylinder.name = 'piston_outer_cylinder';
        pistonAssembly.add(outerCylinder);

        const chromeRod = new THREE.Mesh(unitRodGeo, pistonRodMat);
        chromeRod.name = 'piston_chrome_rod';
        pistonAssembly.add(chromeRod);

        return pistonAssembly;
      };

      const leftPiston = createArticulatedPiston('piston_left');
      const rightPiston = createArticulatedPiston('piston_right');
      pistonPivotSpaceGroup.add(leftPiston, rightPiston);

      const initialKin = this.computeDoorPistonKinematics(
        doorW,
        doorH,
        doorT,
        effectivePistonSide,
        0
      );
      pistonPivotSpaceGroup.userData['kinematics'] = initialKin;
      this.updateSinglePistonAssembly(leftPiston, initialKin.left);
      this.updateSinglePistonAssembly(rightPiston, initialKin.right);

      group.add(pistonPivotSpaceGroup);
    }

    group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.userData = {
          ...child.userData,
          isHinge: true,
          part,
          parentPartId: part.id
        };
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
      lines.userData = { isOutline: true, isAuxiliaryVisual: true };
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
      railHeight = 11;
      railThickness = 14; // sleek hidden track under drawer bottom
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
        color: 0x0284c7, // Hydraulic steel-blue damper
        metalness: 0.5,
        roughness: 0.3
      })
    );

    const clipMat = this.getSharedMaterial(
      'hw_slide_clip',
      () => new THREE.MeshStandardMaterial({
        color: 0x0284c7, // Undermount front quick-release steel-blue clip
        metalness: 0.35,
        roughness: 0.32
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
          this.getSharedGeometry(`hw_slide_um_${railHeight}_${nominalLength}`, () => new THREE.BoxGeometry(14, railHeight, nominalLength)),
          slideSteelMat
        );
        mainTrack.position.set(0, 0, -nominalLength / 2);
        slideAssembly.add(mainTrack);

        // Front 3D quick-release locking catch
        const frontClip = new THREE.Mesh(
          this.getSharedGeometry('hw_slide_um_clip', () => new THREE.BoxGeometry(18, 9, 20)),
          clipMat
        );
        frontClip.position.set(0, -railHeight / 2 + 4.5, -10);
        slideAssembly.add(frontClip);

        // Synchronizer pinion / rear damper
        const rearDamper = new THREE.Mesh(
          this.getSharedGeometry('hw_slide_um_damper', () => new THREE.BoxGeometry(10, 9, 40)),
          damperMat
        );
        rearDamper.position.set(0, 0, -nominalLength + 22);
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
      const refLat = drawerLatIzq || drawerLatDer;
      if (refLat) {
        const refBounds = this.partGeometry.getWorldAABB(refLat);
        const relBottomY = refBounds.minY - (part.posY ?? 0);
        posY = Math.max(-sy / 2 + railHeight / 2 + 1, Math.min(-railHeight / 2, relBottomY - railHeight / 2 - 0.5));
      } else {
        posY = -sy / 2 + 10;
      }
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
          if (slideType === 'undermount') {
            leftX = (minX + t1 / 2 - px) + 8;
            rightX = (maxX - t2 / 2 - px) - 8;
          } else {
            leftX = (minX - (t1 / 2) - px) - (railThickness / 2);
            rightX = (maxX + (t2 / 2) - px) + (railThickness / 2);
          }
        } else if (slideType === 'undermount') {
          leftX = (-sx / 2) + 34;
          rightX = (sx / 2) - 34;
        } else {
          const boxHalfWidth = Math.max(50, (sx / 2) - 13);
          leftX = -boxHalfWidth - (railThickness / 2);
          rightX = boxHalfWidth + (railThickness / 2);
        }
      } else if (slideType === 'undermount') {
        leftX = (-sx / 2) + 34;
        rightX = (sx / 2) - 34;
      } else {
        const boxHalfWidth = Math.max(50, (sx / 2) - 13);
        leftX = -boxHalfWidth - (railThickness / 2);
        rightX = boxHalfWidth + (railThickness / 2);
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
          if (slideType === 'undermount') {
            leftZ = (minZ + t1 / 2 - pz) + 8;
            rightZ = (maxZ - t2 / 2 - pz) - 8;
          } else {
            leftZ = (minZ - (t1 / 2) - pz) - (railThickness / 2);
            rightZ = (maxZ + (t2 / 2) - pz) + (railThickness / 2);
          }
        } else if (slideType === 'undermount') {
          leftZ = (-sz / 2) + 34;
          rightZ = (sz / 2) - 34;
        } else {
          const boxHalfWidth = Math.max(50, (sz / 2) - 13);
          leftZ = -boxHalfWidth - (railThickness / 2);
          rightZ = boxHalfWidth + (railThickness / 2);
        }
      } else if (slideType === 'undermount') {
        leftZ = (-sz / 2) + 34;
        rightZ = (sz / 2) - 34;
      } else {
        const boxHalfWidth = Math.max(50, (sz / 2) - 13);
        leftZ = -boxHalfWidth - (railThickness / 2);
        rightZ = boxHalfWidth + (railThickness / 2);
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
      if (hole.type === 'hinge_35') continue;
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

  private isFrenchCleatBevelPart(part: Part): boolean {
    if (
      part.componentRole === 'door' ||
      part.componentRole === 'drawer_front' ||
      part.componentRole === 'accessory'
    ) {
      return false;
    }
    if (part.bevelAngleDeg === 45) {
      return true;
    }
    const nameLow = (part.name || '').toLowerCase();
    return (
      part.componentRole === 'tie' &&
      (nameLow.includes('listón francés') || nameLow.includes('liston frances'))
    );
  }

  private isGolaAccessoryPart(part: Part): boolean {
    if (part.componentRole !== 'accessory') {
      return false;
    }
    const hw = part.hardwareConfig;
    const nameLow = (part.name || '').toLowerCase();
    return (
      hw?.handleType === 'gola_less' ||
      hw?.handleType === 'gola' ||
      hw?.openingSystem === 'gola' ||
      nameLow.includes('perfil gola') ||
      nameLow.includes('gola')
    );
  }

  private resolveGolaFinish(part: Part): CabinetGolaFinish {
    const explicit = part.hardwareConfig?.golaFinish;
    if (
      explicit === 'natural_aluminum' ||
      explicit === 'matte_black' ||
      explicit === 'white' ||
      explicit === 'champagne'
    ) {
      return explicit;
    }
    const matLow = (part.materialId || '').toLowerCase();
    const nameLow = (part.name || '').toLowerCase();
    if (matLow.includes('black') || nameLow.includes('negro')) return 'matte_black';
    if (matLow.includes('white') || nameLow.includes('blanco')) return 'white';
    if (matLow.includes('champagne') || nameLow.includes('champagne')) return 'champagne';
    return 'natural_aluminum';
  }

  private getGolaFinishSpec(finish: CabinetGolaFinish): {
    colorHex: string;
    metalness: number;
    roughness: number;
  } {
    switch (finish) {
      case 'matte_black':
        return { colorHex: '#18181b', metalness: 0.35, roughness: 0.45 };
      case 'white':
        return { colorHex: '#f8fafc', metalness: 0.18, roughness: 0.32 };
      case 'champagne':
        return { colorHex: '#d6c7a9', metalness: 0.82, roughness: 0.24 };
      case 'natural_aluminum':
      default:
        return { colorHex: '#d4d4d8', metalness: 0.86, roughness: 0.24 };
    }
  }

  private isConcealedHangerPart(part: Part): boolean {
    const nameLow = (part.name || '').toLowerCase();
    return (
      part.componentRole === 'accessory' &&
      (part.hardwareConfig?.wallMountType === 'concealed_hanger' ||
        nameLow.includes('colgador oculto'))
    );
  }

  private isHangingRodPart(part: Part): boolean {
    if (part.shapeType !== 'circle') {
      return false;
    }
    if ((part.orientation || 'horizontal') !== 'horizontal') {
      return false;
    }
    const nameLow = (part.name || '').toLowerCase();
    const matLow = (part.materialId || '').toLowerCase();
    return (
      Boolean(part.hardwareConfig?.rodFinish) ||
      matLow.startsWith('hw_rod') ||
      nameLow.includes('tubo') ||
      nameLow.includes('colgador') ||
      nameLow.includes('barra colgadora')
    );
  }

  private resolveHangingRodFinish(part: Part): CabinetRodFinish {
    const explicit = part.hardwareConfig?.rodFinish;
    if (explicit === 'chrome' || explicit === 'matte_black' || explicit === 'gold') {
      return explicit;
    }
    const matLow = (part.materialId || '').toLowerCase();
    const nameLow = (part.name || '').toLowerCase();
    if (matLow.includes('black') || nameLow.includes('negro')) return 'matte_black';
    if (matLow.includes('gold') || nameLow.includes('dorad') || nameLow.includes('oro')) return 'gold';
    return 'chrome';
  }

  private getHangingRodFinishSpec(finish: CabinetRodFinish): {
    colorHex: string;
    metalness: number;
    roughness: number;
  } {
    switch (finish) {
      case 'matte_black':
        return { colorHex: '#18181b', metalness: 0.3, roughness: 0.48 };
      case 'gold':
        return { colorHex: '#d97706', metalness: 0.85, roughness: 0.22 };
      case 'chrome':
      default:
        return { colorHex: '#cbd5e1', metalness: 0.92, roughness: 0.14 };
    }
  }

  private isCabinetLegPart(part: Part): boolean {
    if (part.shapeType !== 'circle') {
      return false;
    }
    if ((part.orientation || 'horizontal') !== 'vertical_xy') {
      return false;
    }
    const nameLow = (part.name || '').toLowerCase();
    const matLow = (part.materialId || '').toLowerCase();
    return (
      part.componentRole === 'accessory' ||
      Boolean(part.hardwareConfig?.legStyle) ||
      matLow.startsWith('hw_leg') ||
      nameLow.includes('pata')
    );
  }

  private resolveLegStyle(part: Part): CabinetLegStyle {
    const explicit = part.hardwareConfig?.legStyle;
    if (
      explicit === 'cylindrical_inox' ||
      explicit === 'black_leveler' ||
      explicit === 'scandinavian_wood' ||
      explicit === 'hairpin_metal'
    ) {
      return explicit;
    }
    const matLow = (part.materialId || '').toLowerCase();
    const nameLow = (part.name || '').toLowerCase();
    if (
      matLow.includes('black') ||
      matLow.includes('leveler') ||
      nameLow.includes('niveladora negra')
    ) {
      return 'black_leveler';
    }
    if (
      matLow.includes('wood') ||
      matLow.includes('scandinavian') ||
      nameLow.includes('nórdica') ||
      nameLow.includes('nordica') ||
      nameLow.includes('madera')
    ) {
      return 'scandinavian_wood';
    }
    if (matLow.includes('hairpin') || nameLow.includes('horquilla')) {
      return 'hairpin_metal';
    }
    return 'cylindrical_inox';
  }

  private isVitrinaDoorPart(part: Part): boolean {
    return (
      part.hardwareConfig?.doorPanelStyle === 'vitrina' ||
      part.materialId === 'vitrina_aluminio_vidrio'
    );
  }

  private resolveVitrinaFrameFinish(part: Part): CabinetVitrinaFrameFinish {
    const explicit = part.hardwareConfig?.vitrinaFrameFinish;
    if (explicit === 'matte_black' || explicit === 'natural_aluminum' || explicit === 'gold') {
      return explicit;
    }
    const nameLow = (part.materialName || part.name || '').toLowerCase();
    if (nameLow.includes('negro')) return 'matte_black';
    if (nameLow.includes('dorad') || nameLow.includes('oro')) return 'gold';
    return 'natural_aluminum';
  }

  private getVitrinaFrameFinishSpec(finish: CabinetVitrinaFrameFinish): {
    colorHex: string;
    metalness: number;
    roughness: number;
  } {
    switch (finish) {
      case 'matte_black':
        return { colorHex: '#18181b', metalness: 0.42, roughness: 0.42 };
      case 'gold':
        return { colorHex: '#d97706', metalness: 0.85, roughness: 0.22 };
      case 'natural_aluminum':
      default:
        return { colorHex: '#d4d4d8', metalness: 0.86, roughness: 0.24 };
    }
  }

  private resolveVitrinaGlassType(part: Part): CabinetVitrinaGlassType {
    const explicit = part.hardwareConfig?.vitrinaGlassType;
    if (explicit === 'clear' || explicit === 'bronze_smoked' || explicit === 'frosted') {
      return explicit;
    }
    const nameLow = (part.materialName || part.name || '').toLowerCase();
    if (nameLow.includes('bronce') || nameLow.includes('humo') || nameLow.includes('ahumado')) {
      return 'bronze_smoked';
    }
    if (
      nameLow.includes('esmeril') ||
      nameLow.includes('satin') ||
      nameLow.includes('opac') ||
      nameLow.includes('frost')
    ) {
      return 'frosted';
    }
    return 'clear';
  }

  private getVitrinaGlassSpec(glassType: CabinetVitrinaGlassType): {
    colorHex: string;
    opacity: number;
    roughness: number;
    metalness: number;
  } {
    switch (glassType) {
      case 'bronze_smoked':
        return { colorHex: '#6b4f3a', opacity: 0.48, roughness: 0.12, metalness: 0.15 };
      case 'frosted':
        return { colorHex: '#e2e8f0', opacity: 0.68, roughness: 0.72, metalness: 0.04 };
      case 'clear':
      default:
        return { colorHex: '#dbeafe', opacity: 0.28, roughness: 0.08, metalness: 0.14 };
    }
  }

  private computeVitrinaFrameBarWidth(faceW: number, faceH: number): number {
    const minSpan = Math.max(8, Math.min(faceW, faceH));
    return Math.min(38, Math.max(18, Math.round(minSpan * 0.085)), minSpan * 0.38);
  }

  private computeVitrinaDoorGeometrySpec(localDims: PartLocalDimensions): {
    glassSize: [number, number, number];
    bars: { size: [number, number, number]; pos: [number, number, number] }[];
  } {
    const sx = Math.max(4, localDims.sx);
    const sy = Math.max(4, localDims.sy);
    const sz = Math.max(4, localDims.sz);

    if (localDims.thicknessLocalAxis === 'x') {
      const barW = this.computeVitrinaFrameBarWidth(sz, sy);
      const glassT = Math.min(6, Math.max(4, sx * 0.3));
      const glassW = Math.max(4, sz - 2 * barW + 2);
      const glassH = Math.max(4, sy - 2 * barW + 2);
      const sideH = Math.max(2, sy - 2 * barW);
      return {
        glassSize: [glassT, glassH, glassW],
        bars: [
          { size: [sx, barW, sz], pos: [0, sy / 2 - barW / 2, 0] },
          { size: [sx, barW, sz], pos: [0, -sy / 2 + barW / 2, 0] },
          { size: [sx, sideH, barW], pos: [0, 0, -sz / 2 + barW / 2] },
          { size: [sx, sideH, barW], pos: [0, 0, sz / 2 - barW / 2] }
        ]
      };
    }

    if (localDims.thicknessLocalAxis === 'y') {
      const barW = this.computeVitrinaFrameBarWidth(sx, sz);
      const glassT = Math.min(6, Math.max(4, sy * 0.3));
      const glassW = Math.max(4, sx - 2 * barW + 2);
      const glassD = Math.max(4, sz - 2 * barW + 2);
      const sideD = Math.max(2, sz - 2 * barW);
      return {
        glassSize: [glassW, glassT, glassD],
        bars: [
          { size: [sx, sy, barW], pos: [0, 0, sz / 2 - barW / 2] },
          { size: [sx, sy, barW], pos: [0, 0, -sz / 2 + barW / 2] },
          { size: [barW, sy, sideD], pos: [-sx / 2 + barW / 2, 0, 0] },
          { size: [barW, sy, sideD], pos: [sx / 2 - barW / 2, 0, 0] }
        ]
      };
    }

    // Standard vertical_xy door (thickness along Z)
    const barW = this.computeVitrinaFrameBarWidth(sx, sy);
    const glassT = Math.min(6, Math.max(4, sz * 0.3));
    const glassW = Math.max(4, sx - 2 * barW + 2);
    const glassH = Math.max(4, sy - 2 * barW + 2);
    const sideH = Math.max(2, sy - 2 * barW);
    return {
      glassSize: [glassW, glassH, glassT],
      bars: [
        { size: [sx, barW, sz], pos: [0, sy / 2 - barW / 2, 0] },
        { size: [sx, barW, sz], pos: [0, -sy / 2 + barW / 2, 0] },
        { size: [barW, sideH, sz], pos: [-sx / 2 + barW / 2, 0, 0] },
        { size: [barW, sideH, sz], pos: [sx / 2 - barW / 2, 0, 0] }
      ]
    };
  }

  private isSlidingTrackRailPart(part: Part): boolean {
    if (part.componentRole !== 'accessory') {
      return false;
    }
    const nameLow = (part.name || '').toLowerCase();
    return (
      nameLow.includes('riel superior') ||
      nameLow.includes('riel inferior') ||
      nameLow.includes('sistema corredizo') ||
      (nameLow.includes('riel') && Boolean(part.hardwareConfig?.slidingLeavesCount))
    );
  }

  private isShoeRackAluminumStopperPart(part: Part): boolean {
    const nameLow = (part.name || '').toLowerCase();
    const matLow = (part.materialId || '').toLowerCase();
    return (
      (part.componentRole === 'accessory' || part.excludeFromCutlist === true) &&
      (part.hardwareConfig?.shoeRackFrontStopType === 'aluminum_profile' ||
        matLow.includes('aluminum') ||
        matLow.includes('aluminio') ||
        (nameLow.includes('tope') && nameLow.includes('zapatero') && nameLow.includes('aluminio')))
    );
  }

  private resolveSlidingDoorKinematics(
    part: Part,
    parts: readonly Part[],
    doorFacing: 'front' | 'right' | 'back' | 'left',
    localDims: PartLocalDimensions
  ): { slideAxis: 'x' | 'z'; slideDir: number; slideDistanceMm: number } {
    const slideAxis: 'x' | 'z' =
      doorFacing === 'right' || doorFacing === 'left' ? 'z' : 'x';
    const leafSpan = slideAxis === 'x' ? localDims.sx : localDims.sz;
    const slideDistanceMm = Math.max(80, Math.round(leafSpan * 0.82));

    const siblings = parts
      .filter(other => {
        if (!this.isSlidingDoorPart(other)) return false;
        if (part.groupId && other.groupId !== part.groupId) return false;
        if (part.zoneId && other.zoneId && other.zoneId !== part.zoneId) return false;
        return Math.abs((other.posY ?? 0) - (part.posY ?? 0)) <= 40;
      })
      .sort((a, b) => {
        const ca = slideAxis === 'x' ? (a.posX ?? 0) : (a.posZ ?? 0);
        const cb = slideAxis === 'x' ? (b.posX ?? 0) : (b.posZ ?? 0);
        return ca - cb || a.id.localeCompare(b.id);
      });

    if (siblings.length >= 2) {
      const idx = siblings.findIndex(s => s.id === part.id);
      if (idx !== -1) {
        const slideDir = idx === siblings.length - 1 ? -1 : 1;
        return { slideAxis, slideDir, slideDistanceMm };
      }
    }

    const slideDir = part.hardwareConfig?.openingDirection === 'right' ? -1 : 1;
    return { slideAxis, slideDir, slideDistanceMm };
  }

  private buildSlidingTrackGeometry(
    part: Part,
    localDims: PartLocalDimensions,
    tracksCount: 2 | 3
  ): THREE.BufferGeometry {
    const sx = Math.max(4, localDims.sx);
    const sy = Math.max(4, localDims.sy);
    const sz = Math.max(4, localDims.sz);
    const runsAlongZ = sz > sx * 1.25;
    const railLen = runsAlongZ ? sz : sx;
    const railDepth = runsAlongZ ? sx : sz;

    if (railLen <= 8 || sy <= 4 || railDepth <= 8) {
      return new THREE.BoxGeometry(sx, sy, sz);
    }

    const isUpper = (part.name || '').toLowerCase().includes('superior');
    const spineH = Math.max(1.8, Math.min(3.5, sy * 0.28));
    const finH = Math.max(1.5, sy - spineH);
    const finCount = tracksCount + 1;
    const finT = Math.max(1.4, Math.min(3.2, railDepth / (finCount * 2.8)));

    const spineRaw = new THREE.BoxGeometry(railLen, spineH, railDepth);
    spineRaw.translate(0, isUpper ? sy / 2 - spineH / 2 : -sy / 2 + spineH / 2, 0);

    const partsToMerge: THREE.BufferGeometry[] = [spineRaw.toNonIndexed()];
    spineRaw.dispose();

    const zStart = -railDepth / 2 + finT / 2;
    const zEnd = railDepth / 2 - finT / 2;
    const finCenterY = isUpper ? -sy / 2 + finH / 2 : sy / 2 - finH / 2;

    for (let i = 0; i < finCount; i++) {
      const tNorm = finCount > 1 ? i / (finCount - 1) : 0.5;
      const finZ = zStart + (zEnd - zStart) * tNorm;
      const finRaw = new THREE.BoxGeometry(railLen, finH, finT);
      finRaw.translate(0, finCenterY, finZ);
      partsToMerge.push(finRaw.toNonIndexed());
      finRaw.dispose();
    }

    const merged = mergeGeometries(partsToMerge, false);
    for (const g of partsToMerge) {
      g.dispose();
    }

    if (!merged) {
      return new THREE.BoxGeometry(sx, sy, sz);
    }
    if (runsAlongZ) {
      merged.rotateY(Math.PI / 2);
    }
    merged.computeVertexNormals();
    merged.computeBoundingBox();
    return merged;
  }

  private normalizeBoxLikeExtrudeUVs(
    geom: THREE.BufferGeometry,
    spanX: number,
    spanY: number,
    spanZ: number
  ): void {
    const posAttr = geom.getAttribute('position');
    const normAttr = geom.getAttribute('normal');
    const uvAttr = geom.getAttribute('uv');
    if (!posAttr || !uvAttr) {
      return;
    }
    const safeX = Math.max(1, spanX);
    const safeY = Math.max(1, spanY);
    const safeZ = Math.max(1, spanZ);

    for (let i = 0; i < posAttr.count; i++) {
      const px = posAttr.getX(i);
      const py = posAttr.getY(i);
      const pz = posAttr.getZ(i);
      const uX = (px + safeX / 2) / safeX;
      const vY = (py + safeY / 2) / safeY;
      const wZ = (pz + safeZ / 2) / safeZ;

      if (normAttr) {
        const ax = Math.abs(normAttr.getX(i));
        const ay = Math.abs(normAttr.getY(i));
        const az = Math.abs(normAttr.getZ(i));
        if (az >= ax && az >= ay) {
          uvAttr.setXY(i, uX, vY);
        } else if (ay >= ax) {
          uvAttr.setXY(i, uX, wZ);
        } else {
          uvAttr.setXY(i, wZ, vY);
        }
      } else {
        uvAttr.setXY(i, uX, vY);
      }
    }
    uvAttr.needsUpdate = true;
  }

  private buildBeveledCleatGeometry(part: Part): THREE.BufferGeometry {
    const L = Math.max(1, part.length || 1);
    const W = Math.max(1, part.width || 1);
    const t = Math.max(1, part.thickness || 18);
    const orient = part.orientation || 'vertical_xy';
    const nameLow = (part.name || '').toLowerCase();
    const bevelEdge: 'l1' | 'l2' | 'a1' | 'a2' =
      part.bevelEdge || (nameLow.includes('pared') ? 'l1' : 'l2');

    let extrudeGeom: THREE.ExtrudeGeometry;
    if (bevelEdge === 'a1' || bevelEdge === 'a2') {
      const bevelDrop = Math.min(t, Math.max(1, L * 0.45));
      const pts: THREE.Vector2[] =
        bevelEdge === 'a1'
          ? [
              new THREE.Vector2(-L / 2 + bevelDrop, -t / 2),
              new THREE.Vector2(L / 2, -t / 2),
              new THREE.Vector2(L / 2, t / 2),
              new THREE.Vector2(-L / 2, t / 2)
            ]
          : [
              new THREE.Vector2(-L / 2, -t / 2),
              new THREE.Vector2(L / 2 - bevelDrop, -t / 2),
              new THREE.Vector2(L / 2, t / 2),
              new THREE.Vector2(-L / 2, t / 2)
            ];
      if (THREE.ShapeUtils.isClockWise(pts)) {
        pts.reverse();
      }
      extrudeGeom = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
        depth: W,
        bevelEnabled: false
      });
      extrudeGeom.translate(0, 0, -W / 2);
      extrudeGeom.rotateX(-Math.PI / 2);
    } else {
      // Perfil 45° en el plano (Z, Y) extruido a lo largo del largo X (L):
      // - 'l1' (Pared): cara superior biselada a 45° bajando hacia el muro (-Z)
      // - 'l2' (Mueble): cara inferior biselada a 45° subiendo hacia el frente (+Z) para encajar en espejo
      const bevelDrop = Math.min(t, Math.max(1, W * 0.45));
      const pts: THREE.Vector2[] =
        bevelEdge === 'l1'
          ? [
              new THREE.Vector2(-t / 2, -W / 2),
              new THREE.Vector2(t / 2, -W / 2),
              new THREE.Vector2(t / 2, W / 2),
              new THREE.Vector2(-t / 2, W / 2 - bevelDrop)
            ]
          : [
              new THREE.Vector2(-t / 2, -W / 2),
              new THREE.Vector2(t / 2, -W / 2 + bevelDrop),
              new THREE.Vector2(t / 2, W / 2),
              new THREE.Vector2(-t / 2, W / 2)
            ];
      if (THREE.ShapeUtils.isClockWise(pts)) {
        pts.reverse();
      }
      extrudeGeom = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
        depth: L,
        bevelEnabled: false
      });
      extrudeGeom.translate(0, 0, -L / 2);
      extrudeGeom.rotateY(-Math.PI / 2);
    }

    if (orient === 'horizontal') {
      extrudeGeom.rotateX(Math.PI / 2);
    } else if (orient === 'vertical_yz') {
      if (this.partGeometry.isDepthLengthVerticalYZ(part)) {
        extrudeGeom.rotateY(Math.PI / 2);
      } else {
        extrudeGeom.rotateZ(Math.PI / 2);
        extrudeGeom.rotateY(Math.PI / 2);
      }
    }

    extrudeGeom.computeVertexNormals();
    const localDims = this.partGeometry.getLocalDimensions(part);
    this.normalizeBoxLikeExtrudeUVs(extrudeGeom, localDims.sx, localDims.sy, localDims.sz);
    extrudeGeom.computeBoundingBox();
    return extrudeGeom;
  }

  private buildGolaProfileGeometry(
    part: Part,
    localDims: PartLocalDimensions
  ): THREE.BufferGeometry {
    const sx = Math.max(4, localDims.sx);
    const sy = Math.max(4, localDims.sy);
    const sz = Math.max(4, localDims.sz);
    const isVertical = (part.orientation || 'horizontal') === 'vertical_xy' && sy > sx * 2;

    if (isVertical) {
      const wt = Math.max(1.2, Math.min(3.2, sx * 0.22, sz * 0.22));
      const lipW = Math.min(sx * 0.45, Math.max(wt * 1.4, wt * 2.2));
      const x0 = -sx / 2;
      const x1 = sx / 2;
      const z0 = -sz / 2;
      const z1 = sz / 2;
      const pts = [
        new THREE.Vector2(x0, z0),
        new THREE.Vector2(x1, z0),
        new THREE.Vector2(x1, z1),
        new THREE.Vector2(x1 - wt, z1),
        new THREE.Vector2(x1 - wt, z0 + wt),
        new THREE.Vector2(x0 + wt, z0 + wt),
        new THREE.Vector2(x0 + wt, z1 - wt),
        new THREE.Vector2(x0 + lipW, z1 - wt),
        new THREE.Vector2(x0 + lipW, z1),
        new THREE.Vector2(x0, z1)
      ];
      if (THREE.ShapeUtils.isClockWise(pts)) {
        pts.reverse();
      }
      const geom = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
        depth: sy,
        bevelEnabled: false
      });
      geom.translate(0, 0, -sy / 2);
      geom.rotateX(-Math.PI / 2);
      geom.computeVertexNormals();
      geom.computeBoundingBox();
      return geom;
    }

    const wt = Math.max(1.2, Math.min(3.2, sy * 0.22, sz * 0.22));
    const lipH = Math.min(sy * 0.45, Math.max(wt * 1.4, sy * 0.32));
    const z0 = -sz / 2;
    const z1 = sz / 2;
    const y0 = -sy / 2;
    const y1 = sy / 2;

    // Perfil metálico Gola en J/C abierto hacia el frente (+Z) para agarre ergonómico
    const pts = [
      new THREE.Vector2(z0, y0),
      new THREE.Vector2(z1, y0),
      new THREE.Vector2(z1, y0 + lipH),
      new THREE.Vector2(z1 - wt, y0 + lipH),
      new THREE.Vector2(z1 - wt, y0 + wt),
      new THREE.Vector2(z0 + wt, y0 + wt),
      new THREE.Vector2(z0 + wt, y1 - wt),
      new THREE.Vector2(z1, y1 - wt),
      new THREE.Vector2(z1, y1),
      new THREE.Vector2(z0, y1)
    ];
    if (THREE.ShapeUtils.isClockWise(pts)) {
      pts.reverse();
    }

    const geom = new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
      depth: sx,
      bevelEnabled: false
    });
    geom.translate(0, 0, -sx / 2);
    geom.rotateY(-Math.PI / 2);
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    return geom;
  }

  private buildHairpinLegGeometry(radius: number, legH: number): THREE.BufferGeometry {
    const safeH = Math.max(8, legH);
    const safeR = Math.max(6, radius);
    const plateH = Math.min(6, Math.max(2, safeH * 0.08));
    const plateSpan = safeR * 1.85;
    const rodR = Math.max(1.8, Math.min(4.0, safeR * 0.19));
    const rx = Math.max(rodR + 1, safeR - rodR);
    const rz = Math.max(rodR + 1, safeR - rodR);
    const topY = safeH / 2 - plateH;
    const botY = -safeH / 2 + rodR;

    const plateRaw = new THREE.BoxGeometry(plateSpan, plateH, plateSpan);
    plateRaw.translate(0, safeH / 2 - plateH / 2, 0);

    const curveFront = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-rx * 0.85, topY, rz * 0.72),
      new THREE.Vector3(-rx * 0.42, 0, rz * 0.35),
      new THREE.Vector3(-rx * 0.18, botY, 0),
      new THREE.Vector3(rx * 0.42, 0, rz * 0.35),
      new THREE.Vector3(rx * 0.85, topY, rz * 0.72)
    ]);
    const curveBack = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-rx * 0.85, topY, -rz * 0.72),
      new THREE.Vector3(-rx * 0.42, 0, -rz * 0.35),
      new THREE.Vector3(rx * 0.18, botY, 0),
      new THREE.Vector3(rx * 0.42, 0, -rz * 0.35),
      new THREE.Vector3(rx * 0.85, topY, -rz * 0.72)
    ]);

    const rod1Raw = new THREE.TubeGeometry(curveFront, 20, rodR, 8, false);
    const rod2Raw = new THREE.TubeGeometry(curveBack, 20, rodR, 8, false);

    const plateNonIdx = plateRaw.toNonIndexed();
    const rod1NonIdx = rod1Raw.toNonIndexed();
    const rod2NonIdx = rod2Raw.toNonIndexed();
    plateRaw.dispose();
    rod1Raw.dispose();
    rod2Raw.dispose();

    const merged = mergeGeometries([plateNonIdx, rod1NonIdx, rod2NonIdx], false);
    plateNonIdx.dispose();
    rod1NonIdx.dispose();
    rod2NonIdx.dispose();

    if (!merged) {
      return new THREE.CylinderGeometry(safeR * 0.45, safeR * 0.45, safeH, 16);
    }
    merged.computeVertexNormals();
    merged.computeBoundingBox();
    return merged;
  }

  private buildPartGeometryAndEdges(
    part: Part,
    localDims: PartLocalDimensions,
    overlappingCutouts: CountertopCutoutHole[] = []
  ): { geometry: THREE.BufferGeometry; edges: THREE.EdgesGeometry } {
    if (part.shapeType === 'circle') {
      const radius =
        part.radius ||
        (part.diameter ? part.diameter / 2 : Math.max(4, (part.width || part.length || 36) / 2));
      const orient = part.orientation || 'horizontal';

      if (orient === 'vertical_xy') {
        const legH = Math.max(1, part.thickness || 15);
        if (this.isCabinetLegPart(part)) {
          const legStyle = this.resolveLegStyle(part);
          const legKey = `piece_leg_${legStyle}_${radius}_${legH}`;
          const geometry = this.getSharedGeometry(legKey, () => {
            if (legStyle === 'hairpin_metal') {
              return this.buildHairpinLegGeometry(radius, legH);
            }
            if (legStyle === 'scandinavian_wood') {
              return new THREE.CylinderGeometry(radius * 0.92, radius * 0.5, legH, 28);
            }
            if (legStyle === 'black_leveler') {
              return new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, legH, 24);
            }
            return new THREE.CylinderGeometry(radius * 0.72, radius * 0.7, legH, 28);
          });
          const edgeAngle = legStyle === 'hairpin_metal' ? 32 : 25;
          const edges = this.getSharedGeometry(
            `${legKey}_edges`,
            () => new THREE.EdgesGeometry(geometry, edgeAngle)
          );
          return { geometry, edges };
        }

        const vertCylKey = `piece_cyl_vert_${radius}_${legH}`;
        const geometry = this.getSharedGeometry(
          vertCylKey,
          () => new THREE.CylinderGeometry(radius, radius, legH, 48)
        );
        const edges = this.getSharedGeometry(
          `${vertCylKey}_edges`,
          () => new THREE.EdgesGeometry(geometry)
        );
        return { geometry, edges };
      }

      const isHorizontalRod =
        this.isHangingRodPart(part) ||
        (Boolean(part.length) &&
          (part.length || 0) > Math.max(radius * 2 + 2, (part.thickness || 15) * 2) &&
          (part.width || 600) <= 60 &&
          (part.thickness || 15) <= 60);
      const cylHeight = isHorizontalRod
        ? Math.max(1, part.length || 400)
        : Math.max(1, part.thickness || 15);
      const cylKey = `piece_cyl_${radius}_${cylHeight}_${orient}_${isHorizontalRod ? 'rod' : 'disc'}`;
      const geometry = this.getSharedGeometry(cylKey, () => {
        const geo = new THREE.CylinderGeometry(radius, radius, cylHeight, 48);
        if (isHorizontalRod) {
          geo.rotateZ(Math.PI / 2);
        }
        return geo;
      });
      const edges = this.getSharedGeometry(
        `${cylKey}_edges`,
        () => new THREE.EdgesGeometry(geometry)
      );
      return { geometry, edges };
    }

    if (this.isVitrinaDoorPart(part)) {
      const vitrinaSpec = this.computeVitrinaDoorGeometrySpec(localDims);
      const [gx, gy, gz] = vitrinaSpec.glassSize;
      const glassKey = `piece_vitrina_glass_${gx}_${gy}_${gz}`;
      const geometry = this.getSharedGeometry(
        glassKey,
        () => new THREE.BoxGeometry(gx, gy, gz)
      );
      const edgesKey = `piece_vitrina_edges_${localDims.sx}_${localDims.sy}_${localDims.sz}`;
      const edges = this.getSharedGeometry(edgesKey, () => {
        const outerBox = new THREE.BoxGeometry(localDims.sx, localDims.sy, localDims.sz);
        const eg = new THREE.EdgesGeometry(outerBox);
        outerBox.dispose();
        return eg;
      });
      return { geometry, edges };
    }

    if (this.isSlidingTrackRailPart(part)) {
      const tracksCount: 2 | 3 = part.hardwareConfig?.slidingLeavesCount === 3 ? 3 : 2;
      const isUpper = (part.name || '').toLowerCase().includes('superior');
      const railKey = `piece_sliding_rail_${localDims.sx}_${localDims.sy}_${localDims.sz}_${tracksCount}_${isUpper ? 'up' : 'dn'}`;
      const geometry = this.getSharedGeometry(railKey, () =>
        this.buildSlidingTrackGeometry(part, localDims, tracksCount)
      );
      const edges = this.getSharedGeometry(
        `${railKey}_edges`,
        () => new THREE.EdgesGeometry(geometry, 18)
      );
      return { geometry, edges };
    }

    if (this.isGolaAccessoryPart(part)) {
      const golaKey = `piece_gola_${localDims.sx}_${localDims.sy}_${localDims.sz}_${part.orientation || 'horizontal'}`;
      const geometry = this.getSharedGeometry(golaKey, () =>
        this.buildGolaProfileGeometry(part, localDims)
      );
      const edges = this.getSharedGeometry(
        `${golaKey}_edges`,
        () => new THREE.EdgesGeometry(geometry, 15)
      );
      return { geometry, edges };
    }

    if (this.isFrenchCleatBevelPart(part)) {
      const bevelEdge = part.bevelEdge || ((part.name || '').toLowerCase().includes('pared') ? 'l1' : 'l2');
      const bevelKey = `piece_bevel45_${part.length}_${part.width}_${part.thickness}_${part.orientation || 'vertical_xy'}_${bevelEdge}`;
      const geometry = this.getSharedGeometry(bevelKey, () =>
        this.buildBeveledCleatGeometry(part)
      );
      const edges = this.getSharedGeometry(
        `${bevelKey}_edges`,
        () => new THREE.EdgesGeometry(geometry, 1)
      );
      return { geometry, edges };
    }

    if (
      part.cornerCutConfig ||
      (part.shapeType === 'freehand' && part.contourPoints && part.contourPoints.length >= 3) ||
      overlappingCutouts.length > 0
    ) {
      const geometry = this.partGeometry.buildExtrudedBoardGeometry(part, overlappingCutouts);
      const edges = new THREE.EdgesGeometry(geometry);
      return { geometry, edges };
    }

    const boxKey = `piece_box_${localDims.sx}_${localDims.sy}_${localDims.sz}_${localDims.lengthLocalAxis}_${localDims.widthLocalAxis}`;
    const geometry = this.getSharedGeometry(boxKey, () =>
      this.partGeometry.buildAlignedBoxGeometry(part)
    );
    const edges = this.getSharedGeometry(
      `${boxKey}_edges`,
      () => new THREE.EdgesGeometry(geometry)
    );
    return { geometry, edges };
  }

  private getDetailOverlayMaterial(
    baseKey: string,
    colorHex: string,
    metalness: number,
    roughness: number
  ): THREE.MeshStandardMaterial {
    return this.getSharedMaterial(`detail_${baseKey}`, () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        metalness,
        roughness,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      })
    );
  }

  private getXRayMaterial(colorHex: string): THREE.MeshStandardMaterial {
    return this.getSharedMaterial(`piece_xray_${colorHex}`, () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        transparent: true,
        opacity: 0.35,
        roughness: 0.4,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      })
    );
  }

  private getCollidingMaterial(): THREE.MeshStandardMaterial {
    return this.getSharedMaterial('piece_colliding', () =>
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x991b1b,
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.85,
        roughness: 0.25,
        metalness: 0.15,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      })
    );
  }

  private refreshPartDetailMaterials(
    mesh: THREE.Mesh,
    xRay: boolean,
    isColliding: boolean
  ): void {
    const collidingMat = isColliding ? this.getCollidingMaterial() : null;

    for (const child of mesh.children) {
      if (!child.userData?.['isPartDetailVisual'] || !(child instanceof THREE.Mesh)) {
        continue;
      }
      const baseMat = child.userData['baseMaterial'] as THREE.Material | undefined;
      if (collidingMat) {
        child.material = collidingMat;
      } else if (xRay) {
        const xRayColor = (child.userData['detailColor'] as string) || '#94a3b8';
        child.material = this.getXRayMaterial(xRayColor);
      } else if (baseMat) {
        child.material = baseMat;
      }
    }
  }

  private attachPartDetailVisuals(
    mesh: THREE.Mesh,
    part: Part,
    hw: PartHardwareConfig,
    localDims: PartLocalDimensions,
    xRay: boolean,
    isColliding: boolean
  ): void {
    const staleChildren = mesh.children.filter(c => Boolean(c.userData?.['isPartDetailVisual']));
    for (const stale of staleChildren) {
      mesh.remove(stale);
    }

    const addDetailMesh = (
      geo: THREE.BufferGeometry,
      matKey: string,
      colorHex: string,
      metalness: number,
      roughness: number,
      x: number,
      y: number,
      z: number,
      extraUserData: Record<string, unknown>
    ) => {
      const baseMat = this.getDetailOverlayMaterial(matKey, colorHex, metalness, roughness);
      const detail = new THREE.Mesh(geo, baseMat);
      detail.position.set(x, y, z);
      detail.castShadow = !xRay;
      detail.receiveShadow = true;
      detail.raycast = () => {
        // Detalle auxiliar no interceptable por raycasting separado
      };
      detail.userData = {
        isPartDetailVisual: true,
        isAuxiliaryVisual: true,
        baseMaterial: baseMat,
        detailColor: colorHex,
        ...extraUserData
      };
      mesh.add(detail);
    };

    if (this.isVitrinaDoorPart(part)) {
      const frameFinish = this.resolveVitrinaFrameFinish(part);
      const finishSpec = this.getVitrinaFrameFinishSpec(frameFinish);
      const vitrinaSpec = this.computeVitrinaDoorGeometrySpec(localDims);
      const baseMat = this.getDetailOverlayMaterial(
        `vitrina_frame_${frameFinish}`,
        finishSpec.colorHex,
        finishSpec.metalness,
        finishSpec.roughness
      );

      for (const bar of vitrinaSpec.bars) {
        const [bw, bh, bd] = bar.size;
        const [bx, by, bz] = bar.pos;
        const barGeo = this.getSharedGeometry(
          `vitrina_bar_${bw}_${bh}_${bd}`,
          () => new THREE.BoxGeometry(bw, bh, bd)
        );
        const barMesh = new THREE.Mesh(barGeo, baseMat);
        barMesh.position.set(bx, by, bz);
        barMesh.castShadow = !xRay;
        barMesh.receiveShadow = true;
        barMesh.userData = {
          isPartDetailVisual: true,
          isVitrinaFrameBar: true,
          part,
          parentPartId: part.id,
          baseMaterial: baseMat,
          detailColor: finishSpec.colorHex
        };
        mesh.add(barMesh);
      }

      if (xRay || isColliding) {
        this.refreshPartDetailMaterials(mesh, xRay, isColliding);
      }
      return;
    }

    if (this.isSlidingTrackRailPart(part)) {
      const tracksCount: 2 | 3 = hw.slidingLeavesCount === 3 ? 3 : 2;
      const sx = Math.max(4, localDims.sx);
      const sy = Math.max(4, localDims.sy);
      const sz = Math.max(4, localDims.sz);
      const runsAlongZ = sz > sx * 1.25;
      const railLen = runsAlongZ ? sz : sx;
      const railDepth = runsAlongZ ? sx : sz;
      const isUpper = (part.name || '').toLowerCase().includes('superior');
      const grooveY = isUpper ? -sy * 0.2 : sy * 0.2;
      const stripH = Math.max(1.2, Math.min(2.5, sy * 0.25));
      const stripT = Math.max(1.5, Math.min(3.0, (railDepth / tracksCount) * 0.26));

      for (let i = 0; i < tracksCount; i++) {
        const frac = (i + 0.5) / tracksCount - 0.5;
        const offset = frac * (railDepth * 0.72);
        const sw = runsAlongZ ? stripT : Math.max(4, railLen - 2);
        const sd = runsAlongZ ? Math.max(4, railLen - 2) : stripT;
        const stripGeo = this.getSharedGeometry(
          `sliding_track_runner_${sw}_${stripH}_${sd}`,
          () => new THREE.BoxGeometry(sw, stripH, sd)
        );
        addDetailMesh(
          stripGeo,
          'sliding_track_dark_runner',
          '#27272a',
          0.45,
          0.45,
          runsAlongZ ? offset : 0,
          grooveY,
          runsAlongZ ? 0 : offset,
          { isSlidingTrackDetail: true }
        );
      }

      if (xRay || isColliding) {
        this.refreshPartDetailMaterials(mesh, xRay, isColliding);
      }
      return;
    }

    if (this.isCabinetLegPart(part)) {
      const style = this.resolveLegStyle(part);
      const radius =
        part.radius ||
        (part.diameter ? part.diameter / 2 : Math.max(4, (part.width || part.length || 36) / 2));
      const legH = Math.max(1, part.thickness || 15);

      if (style === 'cylindrical_inox') {
        const flangeH = Math.min(8, Math.max(3, legH * 0.08));
        const flangeGeo = this.getSharedGeometry(
          `leg_detail_inox_flange_${radius}_${flangeH}`,
          () => new THREE.CylinderGeometry(radius, radius, flangeH, 28)
        );
        addDetailMesh(
          flangeGeo,
          'leg_inox_flange',
          '#cbd5e1',
          0.78,
          0.24,
          0,
          legH / 2 - flangeH / 2,
          0,
          { isLegDetail: true, legStyle: style }
        );

        const padH = Math.min(6, Math.max(2, legH * 0.06));
        const padGeo = this.getSharedGeometry(
          `leg_detail_inox_pad_${radius}_${padH}`,
          () => new THREE.CylinderGeometry(radius * 0.78, radius * 0.84, padH, 24)
        );
        addDetailMesh(
          padGeo,
          'leg_dark_pad',
          '#27272a',
          0.2,
          0.65,
          0,
          -legH / 2 + padH / 2,
          0,
          { isLegDetail: true, legStyle: style }
        );
      } else if (style === 'black_leveler') {
        const padH = Math.min(12, Math.max(4, legH * 0.14));
        const padGeo = this.getSharedGeometry(
          `leg_detail_black_pad_${radius}_${padH}`,
          () => new THREE.CylinderGeometry(radius, radius, padH, 24)
        );
        addDetailMesh(
          padGeo,
          'leg_black_pad',
          '#18181b',
          0.25,
          0.55,
          0,
          -legH / 2 + padH / 2,
          0,
          { isLegDetail: true, legStyle: style }
        );

        const plateH = Math.min(6, Math.max(2, legH * 0.07));
        const plateGeo = this.getSharedGeometry(
          `leg_detail_black_plate_${radius}_${plateH}`,
          () => new THREE.BoxGeometry(radius * 1.85, plateH, radius * 1.85)
        );
        addDetailMesh(
          plateGeo,
          'leg_black_plate',
          '#27272a',
          0.3,
          0.5,
          0,
          legH / 2 - plateH / 2,
          0,
          { isLegDetail: true, legStyle: style }
        );
      } else if (style === 'scandinavian_wood') {
        const ferruleH = Math.min(24, Math.max(6, legH * 0.22));
        const ferruleGeo = this.getSharedGeometry(
          `leg_detail_wood_ferrule_${radius}_${ferruleH}`,
          () => new THREE.CylinderGeometry(radius * 0.6, radius * 0.52, ferruleH, 24)
        );
        addDetailMesh(
          ferruleGeo,
          'leg_brass_ferrule',
          '#d97706',
          0.82,
          0.24,
          0,
          -legH / 2 + ferruleH / 2,
          0,
          { isLegDetail: true, legStyle: style }
        );

        const plateH = Math.min(5, Math.max(2, legH * 0.05));
        const plateGeo = this.getSharedGeometry(
          `leg_detail_wood_plate_${radius}_${plateH}`,
          () => new THREE.CylinderGeometry(radius * 0.98, radius * 0.98, plateH, 24)
        );
        addDetailMesh(
          plateGeo,
          'leg_dark_plate',
          '#27272a',
          0.6,
          0.35,
          0,
          legH / 2 - plateH / 2,
          0,
          { isLegDetail: true, legStyle: style }
        );
      }
      if (xRay || isColliding) {
        this.refreshPartDetailMaterials(mesh, xRay, isColliding);
      }
      return;
    }

    if (this.isConcealedHangerPart(part)) {
      const sx = Math.max(4, localDims.sx);
      const sy = Math.max(4, localDims.sy);
      const sz = Math.max(4, localDims.sz);
      const plateD = Math.min(2.5, sz * 0.2);
      const frontPlateGeo = this.getSharedGeometry(
        `hanger_front_plate_${sx}_${sy}_${plateD}`,
        () => new THREE.BoxGeometry(sx * 0.72, sy * 0.62, plateD)
      );
      addDetailMesh(
        frontPlateGeo,
        'hanger_dark_steel',
        '#3f3f46',
        0.65,
        0.32,
        0,
        0,
        sz / 2 - plateD / 2,
        { isConcealedHangerDetail: true }
      );

      const topFlangeH = Math.min(3, sy * 0.14);
      const topFlangeGeo = this.getSharedGeometry(
        `hanger_top_flange_${sx}_${topFlangeH}_${sz}`,
        () => new THREE.BoxGeometry(sx * 0.92, topFlangeH, sz * 0.88)
      );
      addDetailMesh(
        topFlangeGeo,
        'hanger_brushed_steel',
        '#cbd5e1',
        0.8,
        0.24,
        0,
        sy / 2 - topFlangeH / 2,
        0,
        { isConcealedHangerDetail: true }
      );

      if (xRay || isColliding) {
        this.refreshPartDetailMaterials(mesh, xRay, isColliding);
      }
      return;
    }

    const isFingerPullFront =
      (part.componentRole === 'door' || part.componentRole === 'drawer_front') &&
      (hw.handleType === 'finger_pull' ||
        hw.openingSystem === 'finger_pull' ||
        hw.drawerOpeningSystem === 'finger_pull');
    if (isFingerPullFront && localDims.sx > 12 && localDims.sy > 12 && localDims.sz > 4) {
      const bevelGroup = new THREE.Group();
      bevelGroup.userData = {
        isPartDetailVisual: true,
        isFingerPullBevelLine: true,
        isAuxiliaryVisual: true
      };
      const halfX = Math.max(2, localDims.sx / 2 - 2);
      const topY = localDims.sy / 2 + 0.35;
      const frontZ = localDims.sz / 2 + 0.35;
      const bevelInset = Math.min(5, localDims.sz * 0.35, localDims.sy * 0.15);

      const lineMat = this.getSharedMaterial('finger_pull_bevel_line_mat', () =>
        new THREE.LineBasicMaterial({
          color: 0x0284c7,
          transparent: true,
          opacity: 0.72
        })
      );
      const topChamferGeo = this.getSharedGeometry(
        `fp_bevel_top_${halfX}_${topY}_${frontZ}_${bevelInset}`,
        () =>
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-halfX, topY, frontZ - bevelInset),
            new THREE.Vector3(halfX, topY, frontZ - bevelInset)
          ])
      );
      const frontChamferGeo = this.getSharedGeometry(
        `fp_bevel_front_${halfX}_${topY}_${frontZ}_${bevelInset}`,
        () =>
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-halfX, topY - bevelInset, frontZ),
            new THREE.Vector3(halfX, topY - bevelInset, frontZ)
          ])
      );
      const topLine = new THREE.Line(topChamferGeo, lineMat);
      const frontLine = new THREE.Line(frontChamferGeo, lineMat);
      topLine.raycast = () => {
        // Línea de bisel uñero no seleccionable
      };
      frontLine.raycast = () => {
        // Línea de bisel uñero no seleccionable
      };
      bevelGroup.add(topLine, frontLine);
      mesh.add(bevelGroup);
    }
  }

  private createPieceMaterial(
    part: Part,
    isSelected: boolean,
    mats: Material[],
    xRay: boolean,
    isColliding = false
  ): THREE.Material {
    void isSelected;

    if (isColliding) {
      return this.getCollidingMaterial();
    }

    if (this.isVitrinaDoorPart(part)) {
      const glassType = this.resolveVitrinaGlassType(part);
      const spec = this.getVitrinaGlassSpec(glassType);
      const effectiveOpacity = xRay ? Math.min(0.28, spec.opacity) : spec.opacity;
      return this.getSharedMaterial(
        `piece_vitrina_glass_${glassType}_${xRay ? 'xray' : 'std'}`,
        () => new THREE.MeshStandardMaterial({
          color: new THREE.Color(spec.colorHex),
          transparent: true,
          opacity: effectiveOpacity,
          roughness: spec.roughness,
          metalness: spec.metalness,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1
        })
      );
    }

    if (this.isSlidingTrackRailPart(part)) {
      const railColor = '#a1a1aa';
      if (xRay) {
        return this.getXRayMaterial(railColor);
      }
      return this.getSharedMaterial(
        'piece_sliding_track_aluminum',
        () => new THREE.MeshStandardMaterial({
          color: new THREE.Color(railColor),
          metalness: 0.85,
          roughness: 0.24,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1
        })
      );
    }

    if (this.isShoeRackAluminumStopperPart(part)) {
      const stopColor = '#d4d4d8';
      if (xRay) {
        return this.getXRayMaterial(stopColor);
      }
      return this.getSharedMaterial(
        'piece_shoe_rack_satin_aluminum',
        () => new THREE.MeshStandardMaterial({
          color: new THREE.Color(stopColor),
          metalness: 0.84,
          roughness: 0.24,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1
        })
      );
    }

    if (this.isGolaAccessoryPart(part)) {
      const finish = this.resolveGolaFinish(part);
      const spec = this.getGolaFinishSpec(finish);
      if (xRay) {
        return this.getXRayMaterial(spec.colorHex);
      }
      return this.getSharedMaterial(
        `piece_gola_mat_${finish}`,
        () => new THREE.MeshStandardMaterial({
          color: new THREE.Color(spec.colorHex),
          metalness: spec.metalness,
          roughness: spec.roughness,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1
        })
      );
    }

    if (this.isHangingRodPart(part)) {
      const rodFinish = this.resolveHangingRodFinish(part);
      const spec = this.getHangingRodFinishSpec(rodFinish);
      if (xRay) {
        return this.getXRayMaterial(spec.colorHex);
      }
      return this.getSharedMaterial(
        `piece_rod_mat_${rodFinish}`,
        () => new THREE.MeshStandardMaterial({
          color: new THREE.Color(spec.colorHex),
          metalness: spec.metalness,
          roughness: spec.roughness,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1
        })
      );
    }

    if (this.isCabinetLegPart(part)) {
      const legStyle = this.resolveLegStyle(part);
      const legColorHex =
        legStyle === 'black_leveler'
          ? '#18181b'
          : legStyle === 'scandinavian_wood'
            ? '#c29b68'
            : legStyle === 'hairpin_metal'
              ? '#27272a'
              : '#94a3b8';
      if (xRay) {
        return this.getXRayMaterial(legColorHex);
      }
      if (legStyle === 'scandinavian_wood') {
        const isLowSpec = this.isPerformanceMode();
        return this.getSharedMaterial(
          `piece_leg_wood_${isLowSpec ? 'low' : 'hi'}`,
          () => {
            const textureMap =
              typeof document !== 'undefined'
                ? ProceduralTextureFactory.getBoardTexture('#c29b68', 'wood', 'length', isLowSpec)
                : null;
            return new THREE.MeshStandardMaterial({
              color: new THREE.Color('#c29b68'),
              map: textureMap,
              roughness: 0.6,
              metalness: 0.05,
              polygonOffset: true,
              polygonOffsetFactor: 1,
              polygonOffsetUnits: 1
            });
          }
        );
      }
      const metalness = legStyle === 'black_leveler' ? 0.25 : legStyle === 'hairpin_metal' ? 0.78 : 0.7;
      const roughness = legStyle === 'black_leveler' ? 0.55 : 0.28;
      return this.getSharedMaterial(
        `piece_leg_mat_${legStyle}`,
        () => new THREE.MeshStandardMaterial({
          color: new THREE.Color(legColorHex),
          metalness,
          roughness,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1
        })
      );
    }

    if (this.isConcealedHangerPart(part)) {
      const hangerColor = '#94a3b8';
      if (xRay) {
        return this.getXRayMaterial(hangerColor);
      }
      return this.getSharedMaterial(
        'piece_concealed_hanger_steel',
        () => new THREE.MeshStandardMaterial({
          color: new THREE.Color(hangerColor),
          metalness: 0.78,
          roughness: 0.28,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1
        })
      );
    }

    // Material color resolution (nunca teñir caras seleccionadas: conservar siempre el acabado real de melamina)
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
      return this.getXRayMaterial(colorHex);
    }

    const texType = assignedMat?.textureType || (assignedMat?.hasGrain ? 'wood' : 'solid');
    const hasGrain = Boolean(assignedMat?.hasGrain);
    const effectiveGrain: GrainDirection = hasGrain ? (part.grain || 'length') : 'none';
    const isLowSpec = this.isPerformanceMode();
    const cacheKey = `piece_std_${colorHex}_${texType}_${effectiveGrain}_${isLowSpec ? 'low' : 'hi'}`;
    return this.getSharedMaterial(
      cacheKey,
      () => {
        let textureMap: THREE.CanvasTexture | null = null;
        if (typeof document !== 'undefined' && texType !== 'solid') {
          textureMap = ProceduralTextureFactory.getBoardTexture(
            colorHex,
            texType,
            effectiveGrain,
            isLowSpec
          );
        }
        return new THREE.MeshStandardMaterial({
          color: new THREE.Color(colorHex),
          map: textureMap,
          roughness: texType === 'wood' ? 0.65 : (texType === 'stone' ? 0.25 : (texType === 'gloss' ? 0.08 : 0.4)),
          metalness: texType === 'stone' ? 0.1 : (texType === 'gloss' ? 0.15 : 0.05),
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1
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

  private appendDimensionSegmentVisuals(
    targetGroup: THREE.Group,
    segment: DimensionLineSegment,
    lineMat: THREE.Material,
    tickMat: THREE.Material,
    dashed = false
  ): void {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([segment.p1, segment.p2]);
    lineGeo.userData = { isCota: true, isAuxiliaryVisual: true };
    const line = new THREE.Line(lineGeo, lineMat);
    line.renderOrder = DIMENSION_LINE_RENDER_ORDER;
    line.userData = { isCota: true, isAuxiliaryVisual: true };
    if (dashed) {
      line.computeLineDistances();
    }
    targetGroup.add(line);

    if (segment.tickSegments.length >= 2) {
      const tickGeo = new THREE.BufferGeometry().setFromPoints(segment.tickSegments);
      tickGeo.userData = { isCota: true, isAuxiliaryVisual: true };
      const ticks = new THREE.LineSegments(tickGeo, tickMat);
      ticks.renderOrder = DIMENSION_LINE_RENDER_ORDER;
      ticks.userData = { isCota: true, isAuxiliaryVisual: true };
      targetGroup.add(ticks);
    }

    if (segment.witnessSegments.length >= 2) {
      const witnessGeo = new THREE.BufferGeometry().setFromPoints(segment.witnessSegments);
      witnessGeo.userData = { isCota: true, isAuxiliaryVisual: true };
      const witnesses = new THREE.LineSegments(witnessGeo, tickMat);
      witnesses.renderOrder = DIMENSION_LINE_RENDER_ORDER;
      witnesses.userData = { isCota: true, isAuxiliaryVisual: true };
      targetGroup.add(witnesses);
    }
  }

  private getCachedDimensionOverlayMaterial<T extends THREE.Material>(
    cacheKey: string,
    factory: () => T
  ): T {
    let mat = this.materialCache.get(cacheKey) as T | undefined;
    if (!mat) {
      mat = factory();
      mat.userData = { isShared: true };
      this.materialCache.set(cacheKey, mat);
    }
    this.dimensionAnchor.configureDimensionOverlayMaterial(mat, DIMENSION_LINE_RENDER_ORDER);
    return mat;
  }

  // Draw 3D dimension lines and text sprites anchored vertex-to-vertex (0.0 mm float)
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
    const lineMat = this.getCachedDimensionOverlayMaterial('dim_line_mat_blue', () =>
      new THREE.LineBasicMaterial({
        color: 0x2563eb,
        linewidth: 2,
        depthTest: false,
        depthWrite: false
      })
    );

    const localDims = this.partGeometry.getLocalDimensions(part);
    const layout = this.dimensionAnchor.computePieceDimensionSegments({
      px,
      py,
      pz,
      sx,
      sy,
      sz,
      orientation: part.orientation,
      rotationX: part.rotationX,
      rotationY: part.rotationY,
      rotationZ: part.rotationZ,
      localLx: localDims.sx,
      localLy: localDims.sy,
      localLz: localDims.sz
    });

    const isDepthLengthYZ =
      part.orientation === 'vertical_yz' && localDims.lengthLocalAxis === 'z';
    const lengthSegment = isDepthLengthYZ ? layout.widthSegment : layout.lengthSegment;
    const widthSegment = isDepthLengthYZ ? layout.lengthSegment : layout.widthSegment;

    this.appendDimensionSegmentVisuals(dimGroup, lengthSegment, lineMat, lineMat, false);
    this.appendDimensionSegmentVisuals(dimGroup, widthSegment, lineMat, lineMat, false);

    const zeroLabelOffset = new THREE.Vector3(0, 0, 0);

    const lengthSprite = this.createTextSprite(`${part.length} mm`);
    lengthSprite.position.copy(lengthSegment.midpoint);
    lengthSprite.renderOrder = DIMENSION_SPRITE_RENDER_ORDER;
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
      edgeP1: lengthSegment.p1.clone(),
      edgeP2: lengthSegment.p2.clone(),
      labelOffset: zeroLabelOffset.clone()
    };
    this.editableDimensionSprites.push(lengthSprite);
    dimGroup.add(lengthSprite);

    const widthSprite = this.createTextSprite(`${part.width} mm`);
    widthSprite.position.copy(widthSegment.midpoint);
    widthSprite.renderOrder = DIMENSION_SPRITE_RENDER_ORDER;
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
      edgeP1: widthSegment.p1.clone(),
      edgeP2: widthSegment.p2.clone(),
      labelOffset: zeroLabelOffset.clone()
    };
    this.editableDimensionSprites.push(widthSprite);
    dimGroup.add(widthSprite);

    this.dimensionGroup.add(dimGroup);
    this.dimensionGroup.updateMatrixWorld(true);
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
    const isWhite = this.isWhiteTheme();
    const accentColor = borderColor === '#10b981'
      ? (isWhite ? '#059669' : '#34d399')
      : (isWhite ? '#0284c7' : '#38bdf8');
    const textColor = isHovered
      ? accentColor
      : (isWhite ? '#18181b' : '#f8fafc');
    const haloColor = isWhite
      ? 'rgba(255, 255, 255, 0.96)'
      : 'rgba(24, 24, 27, 0.94)';

    // Tipografía CAD limpia flotando directamente sobre las líneas punteadas (sin caja/pastilla opaca)
    ctx.save();
    ctx.font = '700 38px "JetBrains Mono", "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textCenterX = (isHovered && showEditIndicator) ? width / 2 - 14 : width / 2;
    const textCenterY = height / 2 + 1;

    if (typeof ctx.strokeText === 'function') {
      ctx.strokeStyle = haloColor;
      ctx.lineWidth = 8;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(text, textCenterX, textCenterY);
    }

    ctx.fillStyle = textColor;
    ctx.fillText(text, textCenterX, textCenterY);

    const measuredW = typeof ctx.measureText === 'function'
      ? Math.min(width - (showEditIndicator ? 96 : 48), Math.max(96, Math.round(ctx.measureText(text).width)))
      : Math.min(width - 96, Math.max(100, text.length * 22));
    ctx.restore();

    // En hover, subrayado fino limpio e icono sutil de edición si aplica
    if (isHovered) {
      ctx.save();
      const underlineY = textCenterY + 24;
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(textCenterX - measuredW / 2, underlineY);
      ctx.lineTo(textCenterX + measuredW / 2, underlineY);
      ctx.stroke();

      if (showEditIndicator) {
        const px = width - 52;
        const py = height / 2 - 8;
        ctx.fillStyle = accentColor;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
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
      }
      ctx.restore();
    }
  }

  // Generates 3D billboard sprite with high-res text (cached in badgeSpriteCache LRU to avoid allocations and leaks)
  private createTextSprite(text: string): THREE.Sprite {
    const themeKey = this.isWhiteTheme() ? 'light' : 'dark';
    const idleMat = this.getCachedBadgeMaterial(`dim_sprite_hd_${themeKey}_${text}_idle`, 512, 136, (ctx) => {
      this.drawEnterprisePillBadge(ctx, 512, 136, text, '#3b82f6', false, true);
    });
    const hoverMat = this.getCachedBadgeMaterial(`dim_sprite_hd_${themeKey}_${text}_hover`, 512, 136, (ctx) => {
      this.drawEnterprisePillBadge(ctx, 512, 136, text, '#3b82f6', true, true);
    });

    const sprite = new THREE.Sprite(idleMat);
    sprite.scale.set(140, 38, 1);
    sprite.renderOrder = DIMENSION_SPRITE_RENDER_ORDER;
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
    drawFn: (ctx: CanvasRenderingContext2D) => void,
    overlayTarget: 'dimension' | 'measure' = 'dimension'
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
      depthTest: false,
      depthWrite: false
    });
    if (overlayTarget === 'measure') {
      this.tapeMeasure.configureMeasureOverlayMaterial(mat);
    } else {
      this.dimensionAnchor.configureDimensionOverlayMaterial(mat, DIMENSION_SPRITE_RENDER_ORDER);
    }
    mat.userData = { isShared: true };
    this.badgeSpriteCache.set(cacheKey, { texture, material: mat });
    return mat;
  }

  // Generates Emerald Green 3D billboard sprite for Clearance Dimensions (Luz Libre)
  private createClearanceSprite(text: string, isEditable = true): THREE.Sprite {
    const themeKey = this.isWhiteTheme() ? 'light' : 'dark';
    const idleMat = this.getCachedBadgeMaterial(`clearance_hd_${themeKey}_${text}_idle_${isEditable ? 'e' : 'r'}`, 512, 136, (ctx) => {
      this.drawEnterprisePillBadge(ctx, 512, 136, text, '#10b981', false, isEditable);
    });
    const hoverMat = isEditable
      ? this.getCachedBadgeMaterial(`clearance_hd_${themeKey}_${text}_hover`, 512, 136, (ctx) => {
          this.drawEnterprisePillBadge(ctx, 512, 136, text, '#10b981', true, true);
        })
      : idleMat;

    const sprite = new THREE.Sprite(idleMat);
    sprite.scale.set(140, 38, 1);
    sprite.renderOrder = DIMENSION_SPRITE_RENDER_ORDER;
    sprite.userData = {
      idleMaterial: idleMat,
      hoverMaterial: hoverMat
    };
    return sprite;
  }

  // Dynamic Clearance Computation: Real-time useful internal clearances between shelves/sides/roof/floor
  computeClearanceInfo(part: Part, allParts: Part[]): ClearanceInfo {
    return this.computeClearanceWithNeighborDepth(part, allParts).info;
  }

  private computeClearanceWithNeighborDepth(
    part: Part,
    allParts: Part[]
  ): {
    info: ClearanceInfo;
    topNeighborFrontZ: number | null;
    bottomNeighborFrontZ: number | null;
    leftNeighborFrontZ: number | null;
    rightNeighborFrontZ: number | null;
    topNeighborPart: Part | null;
    bottomNeighborPart: Part | null;
    leftNeighborPart: Part | null;
    rightNeighborPart: Part | null;
    frontNeighborPart: Part | null;
    backNeighborPart: Part | null;
    frontNeighborAnchorXY: { x: number; y: number } | null;
    backNeighborAnchorXY: { x: number; y: number } | null;
  } {
    const selBounds = this.getPartBounds(part);
    const others = allParts.filter(p => p.id !== part.id);

    let topClearance: number | null = null;
    let topNeighborName: string | null = null;
    let topNeighborFrontZ: number | null = null;
    let topNeighborPart: Part | null = null;
    let bottomClearance: number | null = null;
    let bottomNeighborName: string | null = null;
    let bottomNeighborFrontZ: number | null = null;
    let bottomNeighborPart: Part | null = null;
    let leftClearance: number | null = null;
    let leftNeighborName: string | null = null;
    let leftNeighborFrontZ: number | null = null;
    let leftNeighborPart: Part | null = null;
    let rightClearance: number | null = null;
    let rightNeighborName: string | null = null;
    let rightNeighborFrontZ: number | null = null;
    let rightNeighborPart: Part | null = null;
    let frontClearance: number | null = null;
    let frontNeighborName: string | null = null;
    let frontNeighborPart: Part | null = null;
    let frontNeighborAnchorXY: { x: number; y: number } | null = null;
    let backClearance: number | null = null;
    let backNeighborName: string | null = null;
    let backNeighborPart: Part | null = null;
    let backNeighborAnchorXY: { x: number; y: number } | null = null;

    let minTopGap = Infinity;
    let minBottomGap = Infinity;
    let minLeftGap = Infinity;
    let minRightGap = Infinity;
    let minFrontGap = Infinity;
    let minBackGap = Infinity;

    for (const o of others) {
      const oBounds = this.getPartBounds(o);

      const overlapMinX = Math.max(selBounds.minX, oBounds.minX);
      const overlapMaxX = Math.min(selBounds.maxX, oBounds.maxX);
      const overlapX = Math.max(0, overlapMaxX - overlapMinX);

      const overlapMinY = Math.max(selBounds.minY, oBounds.minY);
      const overlapMaxY = Math.min(selBounds.maxY, oBounds.maxY);
      const overlapY = Math.max(0, overlapMaxY - overlapMinY);

      const overlapZ = Math.max(0, Math.min(selBounds.maxZ, oBounds.maxZ) - Math.max(selBounds.minZ, oBounds.minZ));

      // Overlap in X and Z (for vertical clearances: above & below)
      if (overlapX > 15 && overlapZ > 15) {
        // Element directly above
        if (oBounds.minY >= selBounds.maxY - 1) {
          const gap = Math.max(0, oBounds.minY - selBounds.maxY);
          if (gap < minTopGap) {
            minTopGap = gap;
            topClearance = Math.round(gap);
            topNeighborName = o.name;
            topNeighborFrontZ = oBounds.maxZ;
            topNeighborPart = o;
          }
        }
        // Element directly below
        if (oBounds.maxY <= selBounds.minY + 1) {
          const gap = Math.max(0, selBounds.minY - oBounds.maxY);
          if (gap < minBottomGap) {
            minBottomGap = gap;
            bottomClearance = Math.round(gap);
            bottomNeighborName = o.name;
            bottomNeighborFrontZ = oBounds.maxZ;
            bottomNeighborPart = o;
          }
        }
      }

      // Overlap in Y and Z (for horizontal clearances: left & right)
      if (overlapY > 15 && overlapZ > 15) {
        // Element to the left
        if (oBounds.maxX <= selBounds.minX + 1) {
          const gap = Math.max(0, selBounds.minX - oBounds.maxX);
          if (gap < minLeftGap) {
            minLeftGap = gap;
            leftClearance = Math.round(gap);
            leftNeighborName = o.name;
            leftNeighborFrontZ = oBounds.maxZ;
            leftNeighborPart = o;
          }
        }
        // Element to the right
        if (oBounds.minX >= selBounds.maxX - 1) {
          const gap = Math.max(0, oBounds.minX - selBounds.maxX);
          if (gap < minRightGap) {
            minRightGap = gap;
            rightClearance = Math.round(gap);
            rightNeighborName = o.name;
            rightNeighborFrontZ = oBounds.maxZ;
            rightNeighborPart = o;
          }
        }
      }

      // Overlap in X and Y (for depth clearances: front & back)
      if (overlapX > 15 && overlapY > 15) {
        const anchorXY = {
          x: (overlapMinX + overlapMaxX) * 0.5,
          y: (overlapMinY + overlapMaxY) * 0.5
        };
        // Element in front (+Z)
        if (oBounds.minZ >= selBounds.maxZ - 1) {
          const gap = Math.max(0, oBounds.minZ - selBounds.maxZ);
          if (gap < minFrontGap) {
            minFrontGap = gap;
            frontClearance = Math.round(gap);
            frontNeighborName = o.name;
            frontNeighborPart = o;
            frontNeighborAnchorXY = anchorXY;
          }
        }
        // Element behind (-Z)
        if (oBounds.maxZ <= selBounds.minZ + 1) {
          const gap = Math.max(0, selBounds.minZ - oBounds.maxZ);
          if (gap < minBackGap) {
            minBackGap = gap;
            backClearance = Math.round(gap);
            backNeighborName = o.name;
            backNeighborPart = o;
            backNeighborAnchorXY = anchorXY;
          }
        }
      }
    }

    return {
      info: {
        topClearance,
        bottomClearance,
        leftClearance,
        rightClearance,
        topNeighborName,
        bottomNeighborName,
        leftNeighborName,
        rightNeighborName,
        frontClearance,
        backClearance,
        frontNeighborName,
        backNeighborName
      },
      topNeighborFrontZ,
      bottomNeighborFrontZ,
      leftNeighborFrontZ,
      rightNeighborFrontZ,
      topNeighborPart,
      bottomNeighborPart,
      leftNeighborPart,
      rightNeighborPart,
      frontNeighborPart,
      backNeighborPart,
      frontNeighborAnchorXY,
      backNeighborAnchorXY
    };
  }

  private isDrawerSubPartName(name: string | undefined): boolean {
    const uName = (name || '').toUpperCase();
    return (
      uName.includes('FONDO MDF') ||
      uName.includes('FRENTE CAJ') ||
      uName.includes('TRASERA CAJ') ||
      uName.includes('CONTRA-FRENTE') ||
      uName.includes('CONTRAFRENTE')
    );
  }

  private isDrawerSubPartRole(part: Part): boolean {
    return (
      part.componentRole === 'drawer_box' ||
      part.componentRole === 'drawer_front' ||
      part.componentRole === 'drawer_bottom' ||
      part.componentRole === 'drawer_lateral' ||
      this.isDrawerSubPartName(part.name)
    );
  }

  private isModularDrawerGroup(groupId: string | undefined): boolean {
    if (!groupId) return false;
    const grp = this.partGroups().find(g => g.id === groupId);
    const groupParts = this.parts().filter(p => p.groupId === groupId);
    if (hasReliableParametricRecipe(grp, groupParts)) {
      return false;
    }
    if (
      grp &&
      (grp.type === 'drawer' ||
        grp.subType === 'drawer' ||
        grp.templateId === 'modular_drawer' ||
        !!grp.drawerConfig)
    ) {
      return true;
    }
    if (groupParts.length === 0) return false;
    return groupParts.every(p => this.isDrawerSubPartRole(p));
  }

  private isModularDrawerPart(part: Part): boolean {
    if (!part) return false;
    if (this.isDrawerSubPartRole(part)) return true;
    return !!part.groupId && this.isModularDrawerGroup(part.groupId);
  }

  isInternalShelf(part: Part): boolean {
    if (this.isModularDrawerPart(part)) return false;
    return this.partGeometry.isInternalShelf(part);
  }

  isInternalDivider(part: Part): boolean {
    return this.partGeometry.isInternalDivider(part);
  }

  getShelfVerticalLimits(part: Part, overrideParts?: Part[]): {
    minAllowedY: number;
    maxAllowedY: number;
    belowTopY: number;
    aboveBottomY: number;
    centerSnapY: number;
  } {
    const minGap = 40; // mm espacio libre mínimo para evitar colisión
    const initBounds = this.getPartBounds(part);
    const halfThick = initBounds.sy / 2;

    const sourceParts = overrideParts ?? this.parts();
    const groupParts = part.groupId
      ? sourceParts.filter(p => p.groupId === part.groupId && p.id !== part.id)
      : sourceParts.filter(p => p.id !== part.id);

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
    const themeKey = this.isWhiteTheme() ? 'light' : 'dark';
    const idleMat = this.getCachedBadgeMaterial(`internal_clr_hd_${themeKey}_${text}_idle_${isEditable ? 'e' : 'r'}`, w, h, (ctx) => {
      this.drawEnterprisePillBadge(ctx, w, h, text, '#10b981', false, isEditable);
    });
    const hoverMat = isEditable
      ? this.getCachedBadgeMaterial(`internal_clr_hd_${themeKey}_${text}_hover`, w, h, (ctx) => {
          this.drawEnterprisePillBadge(ctx, w, h, text, '#10b981', true, true);
        })
      : idleMat;

    const sprite = new THREE.Sprite(idleMat);
    sprite.scale.set(isWide ? 155 : 140, 38, 1);
    sprite.renderOrder = DIMENSION_SPRITE_RENDER_ORDER;
    sprite.userData = {
      idleMaterial: idleMat,
      hoverMaterial: hoverMat
    };
    return sprite;
  }

  renderModuleInternalClearances(
    groupId: string,
    selectedOrDraggingPart?: Part,
    overridePosY?: number,
    overrideParts?: Part[]
  ) {
    this.disposeGroup(this.internalClearanceGroup);
    this.internalClearanceGroup.position.set(0, 0, 0);
    if (!this.showClearances()) return;
    if (this.isModularDrawerGroup(groupId)) return;

    const sourceParts = overrideParts ?? this.parts();
    const moduleParts = sourceParts.filter(
      p => p.groupId === groupId && !this.hiddenPartIds().has(p.id)
    );
    if (moduleParts.length < 2) return;

    const getEffectiveBounds = (p: Part): PartWorldAABB => {
      if (selectedOrDraggingPart && p.id === selectedOrDraggingPart.id && overridePosY !== undefined) {
        return this.getPartBounds(p, {
          x: p.posX ?? 0,
          y: overridePosY,
          z: p.posZ ?? 0
        });
      }
      return this.getPartBounds(p);
    };

    let moduleMinX = Infinity;
    let moduleMaxX = -Infinity;
    let moduleMinY = Infinity;
    let maxModuleZ = -Infinity;
    for (const p of moduleParts) {
      const b = getEffectiveBounds(p);
      if (b.minX < moduleMinX) moduleMinX = b.minX;
      if (b.maxX > moduleMaxX) moduleMaxX = b.maxX;
      if (b.minY < moduleMinY) moduleMinY = b.minY;
      if (b.maxZ > maxModuleZ) maxModuleZ = b.maxZ;
    }

    // 1. Piso / Base Inferior (excluyendo repisas internas)
    const bottomPart =
      moduleParts.find(p => p.componentRole === 'bottom') ||
      moduleParts
        .filter(p => p.orientation === 'horizontal' && !this.isInternalShelf(p) && p.componentRole !== 'top' && p.componentRole !== 'countertop')
        .sort((a, b) => (a.posY ?? 0) - (b.posY ?? 0))[0] ||
      null;
    const bottomBounds = bottomPart ? getEffectiveBounds(bottomPart) : null;
    const floorTopY = bottomBounds ? bottomBounds.maxY : 0;
    const bottomFrontZ = bottomBounds ? bottomBounds.maxZ : maxModuleZ;

    // 2. Techo / Tapa Superior (excluyendo repisas internas y zócalos)
    const topPart =
      moduleParts.find(p => p.componentRole === 'top') ||
      moduleParts
        .filter(p => p.orientation === 'horizontal' && !this.isInternalShelf(p) && p.componentRole !== 'bottom' && p.componentRole !== 'plinth')
        .sort((a, b) => (b.posY ?? 0) - (a.posY ?? 0))[0] ||
      null;
    let roofBottomY = Infinity;
    let roofFrontZ = maxModuleZ;
    let roofAnchorPart: Part | null = null;
    if (topPart && topPart.id !== bottomPart?.id) {
      const topBounds = getEffectiveBounds(topPart);
      roofBottomY = topBounds.minY;
      roofFrontZ = topBounds.maxZ;
      roofAnchorPart = topPart;
    } else {
      const ties = moduleParts.filter(p => p.componentRole === 'tie');
      if (ties.length > 0) {
        const tieEntries = ties
          .map(t => ({ part: t, bounds: getEffectiveBounds(t) }))
          .sort((a, b) => a.bounds.minY - b.bounds.minY);
        roofBottomY = tieEntries[0].bounds.minY;
        roofFrontZ = tieEntries[0].bounds.maxZ;
        roofAnchorPart = tieEntries[0].part;
      } else {
        const sidesFallback = moduleParts.filter(p => p.orientation === 'vertical_yz');
        if (sidesFallback.length > 0) {
          const sideBounds = sidesFallback.map(s => getEffectiveBounds(s));
          roofBottomY = Math.max(...sideBounds.map(s => s.maxY));
          roofFrontZ = Math.max(...sideBounds.map(s => s.maxZ));
        }
      }
    }

    // 3. Laterales Izquierdo y Derecho
    const sides = moduleParts.filter(p => p.orientation === 'vertical_yz');
    let leftInnerX: number | null = null;
    let rightInnerX: number | null = null;
    let leftSideFrontZ: number | null = null;
    let rightSideFrontZ: number | null = null;
    let leftSidePart: Part | null = null;
    let rightSidePart: Part | null = null;
    if (sides.length >= 2) {
      const sortedSides = [...sides].sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));
      leftSidePart = sortedSides[0];
      rightSidePart = sortedSides[sortedSides.length - 1];
      const leftSideBounds = getEffectiveBounds(leftSidePart);
      const rightSideBounds = getEffectiveBounds(rightSidePart);
      leftInnerX = leftSideBounds.maxX;
      rightInnerX = rightSideBounds.minX;
      leftSideFrontZ = leftSideBounds.maxZ;
      rightSideFrontZ = rightSideBounds.maxZ;
    } else {
      const sLeft = moduleParts.find(p => p.componentRole === 'side_left') ?? null;
      const sRight = moduleParts.find(p => p.componentRole === 'side_right') ?? null;
      if (sLeft) {
        leftSidePart = sLeft;
        const b = getEffectiveBounds(sLeft);
        leftInnerX = b.maxX;
        leftSideFrontZ = b.maxZ;
      }
      if (sRight) {
        rightSidePart = sRight;
        const b = getEffectiveBounds(sRight);
        rightInnerX = b.minX;
        rightSideFrontZ = b.maxZ;
      }
    }

    // 4. Repisas / Entrepaños Interiores
    const allShelves = moduleParts.filter(p => {
      if (bottomPart && p.id === bottomPart.id) return false;
      if (topPart && p.id === topPart.id) return false;
      return this.isInternalShelf(p);
    });

    // 5. Agrupación por columnas (bahías)
    const columns: {
      refX: number;
      frontZ: number;
      shelfBoundsList: { part: Part; bounds: PartWorldAABB }[];
    }[] = [];

    const isDraggingOrSelectedShelf = selectedOrDraggingPart && this.isInternalShelf(selectedOrDraggingPart);

    if (isDraggingOrSelectedShelf) {
      const activeRefBounds = getEffectiveBounds(selectedOrDraggingPart);
      const columnShelves = allShelves.filter(s => {
        const b = getEffectiveBounds(s);
        const overlapX = Math.max(0, Math.min(activeRefBounds.maxX, b.maxX) - Math.max(activeRefBounds.minX, b.minX));
        return overlapX > 15;
      });
      const sList = columnShelves.map(s => ({ part: s, bounds: getEffectiveBounds(s) }));
      sList.sort((a, b) => a.bounds.minY - b.bounds.minY);
      const refX = sList.length > 0 ? sList[0].bounds.px : (selectedOrDraggingPart.posX ?? 0);
      const frontZ = sList.length > 0 ? Math.max(...sList.map(s => s.bounds.maxZ)) : activeRefBounds.maxZ;
      columns.push({ refX, frontZ, shelfBoundsList: sList });
    } else {
      const remainingShelves = [...allShelves];
      while (remainingShelves.length > 0) {
        const first = remainingShelves.shift()!;
        const firstBounds = getEffectiveBounds(first);
        const colList = [first];
        for (let i = remainingShelves.length - 1; i >= 0; i--) {
          const cand = remainingShelves[i];
          const candBounds = getEffectiveBounds(cand);
          const overlapX = Math.max(0, Math.min(firstBounds.maxX, candBounds.maxX) - Math.max(firstBounds.minX, candBounds.minX));
          if (overlapX > 15) {
            colList.push(cand);
            remainingShelves.splice(i, 1);
          }
        }
        const sList = colList.map(s => ({ part: s, bounds: getEffectiveBounds(s) }));
        sList.sort((a, b) => a.bounds.minY - b.bounds.minY);
        const refX = sList[0].bounds.px;
        const frontZ = Math.max(...sList.map(s => s.bounds.maxZ));
        columns.push({ refX, frontZ, shelfBoundsList: sList });
      }

      if (columns.length === 0) {
        const refX =
          leftInnerX !== null && rightInnerX !== null
            ? (leftInnerX + rightInnerX) / 2
            : (bottomPart?.posX ?? 0);
        columns.push({ refX, frontZ: maxModuleZ, shelfBoundsList: [] });
      }
    }

    const moduleFrontZ =
      leftSideFrontZ !== null && rightSideFrontZ !== null
        ? Math.min(leftSideFrontZ, rightSideFrontZ)
        : (leftSideFrontZ ?? rightSideFrontZ ?? bottomFrontZ);

    interface BayMeta {
      targetPart: Part | null;
      badgeType: 'top_clearance' | 'bottom_clearance';
      label: string;
      minSidePart: Part | null;
      maxSidePart: Part | null;
      syntheticMinFaceCoord?: number;
      syntheticMaxFaceCoord?: number;
      defaultMoverSide: 'min' | 'max';
      isEditable: boolean;
    }

    const buildVerticalBayMeta = (
      minSidePart: Part | null,
      maxSidePart: Part | null,
      syntheticMinFaceCoord: number | undefined,
      syntheticMaxFaceCoord: number | undefined,
      defaultMoverSide: 'min' | 'max',
      labelOverride?: string
    ): BayMeta => {
      const resolved = resolveClearanceAnchorAndMover({
        axis: 'y',
        minSidePart,
        maxSidePart,
        selectedPartId: selectedOrDraggingPart?.id,
        defaultMoverSide
      });
      const fallbackTarget =
        defaultMoverSide === 'min' ? (minSidePart ?? maxSidePart) : (maxSidePart ?? minSidePart);
      const targetPart =
        resolved.status === 'ok' && resolved.moverPart ? resolved.moverPart : fallbackTarget;
      const effectiveSide = resolved.status === 'ok' && resolved.moverSide ? resolved.moverSide : defaultMoverSide;
      const badgeType: 'top_clearance' | 'bottom_clearance' =
        effectiveSide === 'min' ? 'top_clearance' : 'bottom_clearance';
      const label =
        labelOverride ??
        (badgeType === 'top_clearance'
          ? this.i18n.t('designer.upperClearance')
          : this.i18n.t('designer.lowerClearance'));

      return {
        targetPart,
        badgeType,
        label,
        minSidePart,
        maxSidePart,
        syntheticMinFaceCoord,
        syntheticMaxFaceCoord,
        defaultMoverSide,
        isEditable: Boolean(minSidePart || maxSidePart)
      };
    };

    // 6. Dibujo 3D de Cotas Verticales + Luz X ancladas arista-a-arista (0.0 mm float)
    const zeroLabelOffset = new THREE.Vector3(0, 0, 0);
    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      const col = columns[colIdx];
      const bayWidth = col.shelfBoundsList.length > 0
        ? col.shelfBoundsList[0].bounds.sx
        : (leftInnerX !== null && rightInnerX !== null ? Math.abs(rightInnerX - leftInnerX) : 400);
      const lateralOffset = Math.min(125, bayWidth * 0.24);
      const columnAnchorX = col.refX + lateralOffset;
      const shelfBoundsList = col.shelfBoundsList;

      const bays: ModuleVerticalBayInput[] = [];
      const bayMetas: BayMeta[] = [];

      if (shelfBoundsList.length === 0) {
        if (roofBottomY !== Infinity && roofBottomY >= floorTopY - 0.5) {
          bays.push({
            yBottom: floorTopY,
            yTop: roofBottomY,
            bottomFrontZ,
            topFrontZ: roofFrontZ,
            shelfFrontZ: Math.min(bottomFrontZ, roofFrontZ),
            bayMinX: leftInnerX ?? moduleMinX,
            bayMaxX: rightInnerX ?? moduleMaxX,
            centerX: columnAnchorX,
            distance: Math.max(0, Math.round(roofBottomY - floorTopY))
          });
          bayMetas.push(
            buildVerticalBayMeta(
              bottomPart,
              roofAnchorPart,
              bottomPart ? undefined : floorTopY,
              roofAnchorPart ? undefined : roofBottomY,
              'max',
              this.i18n.t('designer.freeClearance')
            )
          );
        }
      } else {
        const firstShelf = shelfBoundsList[0];
        bays.push({
          yBottom: floorTopY,
          yTop: firstShelf.bounds.minY,
          bottomFrontZ,
          topFrontZ: firstShelf.bounds.maxZ,
          shelfFrontZ: firstShelf.bounds.maxZ,
          bayMinX: firstShelf.bounds.minX,
          bayMaxX: firstShelf.bounds.maxX,
          centerX: columnAnchorX,
          distance: Math.max(0, Math.round(firstShelf.bounds.minY - floorTopY))
        });
        bayMetas.push(
          buildVerticalBayMeta(
            bottomPart,
            firstShelf.part,
            bottomPart ? undefined : floorTopY,
            undefined,
            'max'
          )
        );

        for (let i = 0; i < shelfBoundsList.length - 1; i++) {
          const lower = shelfBoundsList[i];
          const upper = shelfBoundsList[i + 1];

          const overlapMinX = Math.max(lower.bounds.minX, upper.bounds.minX);
          const overlapMaxX = Math.min(lower.bounds.maxX, upper.bounds.maxX);
          const bayMinX = overlapMinX < overlapMaxX ? overlapMinX : lower.bounds.minX;
          const bayMaxX = overlapMinX < overlapMaxX ? overlapMaxX : lower.bounds.maxX;

          bays.push({
            yBottom: lower.bounds.maxY,
            yTop: upper.bounds.minY,
            bottomFrontZ: lower.bounds.maxZ,
            topFrontZ: upper.bounds.maxZ,
            shelfFrontZ: Math.min(lower.bounds.maxZ, upper.bounds.maxZ),
            bayMinX,
            bayMaxX,
            centerX: columnAnchorX,
            distance: Math.max(0, Math.round(upper.bounds.minY - lower.bounds.maxY))
          });
          bayMetas.push(
            buildVerticalBayMeta(lower.part, upper.part, undefined, undefined, 'max')
          );
        }

        const lastShelf = shelfBoundsList[shelfBoundsList.length - 1];
        if (roofBottomY !== Infinity && roofBottomY >= lastShelf.bounds.maxY - 0.5) {
          bays.push({
            yBottom: lastShelf.bounds.maxY,
            yTop: roofBottomY,
            bottomFrontZ: lastShelf.bounds.maxZ,
            topFrontZ: roofFrontZ,
            shelfFrontZ: lastShelf.bounds.maxZ,
            bayMinX: lastShelf.bounds.minX,
            bayMaxX: lastShelf.bounds.maxX,
            centerX: columnAnchorX,
            distance: Math.max(0, Math.round(roofBottomY - lastShelf.bounds.maxY))
          });
          bayMetas.push(
            buildVerticalBayMeta(
              lastShelf.part,
              roofAnchorPart,
              undefined,
              roofAnchorPart ? undefined : roofBottomY,
              'min'
            )
          );
        }
      }

      const allowZeroBayIndices: number[] = [];
      for (let idx = 0; idx < bayMetas.length; idx++) {
        const meta = bayMetas[idx];
        const key = this.buildClearancePairKey('y', meta.minSidePart?.id, meta.maxSidePart?.id);
        if (this.explicitLowClearancePairKeys.has(key)) {
          allowZeroBayIndices.push(idx);
        }
      }
      const innerPairKey = this.buildClearancePairKey('x', leftSidePart?.id, rightSidePart?.id);
      const allowZeroInnerWidth = this.explicitLowClearancePairKeys.has(innerPairKey);

      const layout = this.dimensionAnchor.computeModuleInternalClearancesLayout({
        bays,
        leftInnerX: colIdx === 0 ? leftInnerX : null,
        rightInnerX: colIdx === 0 ? rightInnerX : null,
        leftSideFrontZ: colIdx === 0 ? leftSideFrontZ : null,
        rightSideFrontZ: colIdx === 0 ? rightSideFrontZ : null,
        bottomFrontZ,
        floorTopY,
        moduleMinX,
        moduleMaxX,
        moduleMinY,
        moduleFrontZ,
        columnRefX: columnAnchorX,
        allowZeroBayIndices,
        allowZeroInnerWidth
      });

      for (const bayAnchor of layout.verticalBays) {
        const meta = bayMetas[bayAnchor.bayIndex];
        this.appendDimensionSegmentVisuals(
          this.internalClearanceGroup,
          bayAnchor.segment,
          this.internalClearanceLineMat,
          this.internalClearanceTickMat,
          true
        );

        const isEditable = Boolean(meta?.isEditable && meta?.targetPart);
        const sprite = this.createInternalClearanceBadge(`↕ ${bayAnchor.bay.distance} mm`, false, isEditable);
        sprite.position.copy(bayAnchor.segment.midpoint);
        sprite.renderOrder = DIMENSION_SPRITE_RENDER_ORDER;
        sprite.userData = {
          ...sprite.userData,
          baseScaleX: 140,
          baseScaleY: 38,
          edgeP1: bayAnchor.segment.p1.clone(),
          edgeP2: bayAnchor.segment.p2.clone(),
          labelOffset: zeroLabelOffset.clone()
        };

        if (isEditable && meta?.targetPart) {
          const badgeUserData: DimensionBadgeUserData = {
            isDimensionBadge: true,
            badgeType: meta.badgeType,
            part: meta.targetPart,
            currentValue: bayAnchor.bay.distance,
            label: meta.label,
            referenceY: meta.badgeType === 'bottom_clearance' ? bayAnchor.bay.yBottom : bayAnchor.bay.yTop,
            axis: 'y',
            minSidePart: meta.minSidePart,
            maxSidePart: meta.maxSidePart,
            syntheticMinFaceCoord: meta.syntheticMinFaceCoord,
            syntheticMaxFaceCoord: meta.syntheticMaxFaceCoord,
            defaultMoverSide: meta.defaultMoverSide,
            selectedPartId: selectedOrDraggingPart?.id,
            isModuleInternalBadge: true,
            baseScaleX: 140,
            baseScaleY: 38
          };
          sprite.userData = {
            ...sprite.userData,
            ...badgeUserData
          };
          this.editableDimensionSprites.push(sprite);
        } else {
          sprite.userData = {
            ...sprite.userData,
            isCota: true,
            isAuxiliaryVisual: true
          };
        }
        this.internalClearanceGroup.add(sprite);
      }

      // 7. Cota Horizontal de Luz Interna (Ancho Útil) anclada de cara interior a cara interior sobre frontZ
      if (colIdx === 0 && layout.innerWidthSegment) {
        this.appendDimensionSegmentVisuals(
          this.internalClearanceGroup,
          layout.innerWidthSegment,
          this.internalClearanceLineMat,
          this.internalClearanceTickMat,
          true
        );

        const isHorizEditable = Boolean(leftSidePart || rightSidePart);
        const horizBadge = this.createInternalClearanceBadge(
          `↔ ${layout.innerWidth} mm`,
          true,
          isHorizEditable
        );
        horizBadge.position.copy(layout.innerWidthSegment.midpoint);
        horizBadge.renderOrder = DIMENSION_SPRITE_RENDER_ORDER;
        horizBadge.userData = {
          ...horizBadge.userData,
          isCota: true,
          isAuxiliaryVisual: true,
          baseScaleX: 155,
          baseScaleY: 38,
          edgeP1: layout.innerWidthSegment.p1.clone(),
          edgeP2: layout.innerWidthSegment.p2.clone(),
          labelOffset: zeroLabelOffset.clone()
        };

        if (isHorizEditable) {
          const resolvedX = resolveClearanceAnchorAndMover({
            axis: 'x',
            minSidePart: leftSidePart,
            maxSidePart: rightSidePart,
            selectedPartId: selectedOrDraggingPart?.id,
            defaultMoverSide: 'max'
          });
          const targetXPart =
            resolvedX.status === 'ok' && resolvedX.moverPart
              ? resolvedX.moverPart
              : (rightSidePart ?? leftSidePart!);
          const badgeUserData: DimensionBadgeUserData = {
            isDimensionBadge: true,
            badgeType: 'inner_width_clearance',
            part: targetXPart,
            currentValue: layout.innerWidth,
            label: this.tFallback('designer.innerWidthClearance', 'Luz Interna X'),
            axis: 'x',
            anchorPart: resolvedX.status === 'ok' ? resolvedX.anchorPart : leftSidePart,
            moverPart: resolvedX.status === 'ok' ? resolvedX.moverPart : rightSidePart,
            minSidePart: leftSidePart,
            maxSidePart: rightSidePart,
            syntheticMinFaceCoord: leftSidePart ? undefined : (leftInnerX ?? undefined),
            syntheticMaxFaceCoord: rightSidePart ? undefined : (rightInnerX ?? undefined),
            defaultMoverSide: 'max',
            selectedPartId: selectedOrDraggingPart?.id,
            isModuleInternalBadge: true,
            baseScaleX: 155,
            baseScaleY: 38
          };
          horizBadge.userData = {
            ...horizBadge.userData,
            ...badgeUserData
          };
          this.editableDimensionSprites.push(horizBadge);
        }

        this.internalClearanceGroup.add(horizBadge);
      }
    }

    this.internalClearanceGroup.updateMatrixWorld(true);
    this.updateAdaptiveGizmoScale();

    // 8. Sincronizar clearanceInfo al inspector si hay una pieza seleccionada y no se está arrastrando en vivo
    if (selectedOrDraggingPart && overridePosY === undefined) {
      const clr = this.computeClearanceInfo(selectedOrDraggingPart, sourceParts);
      this.clearanceCalculated.emit(clr);
    }
  }

  // Draw 3D Technical Clearance Lines (Luz Libre) anchored directly at bounds.maxZ (0.0 mm float)
  private renderClearanceDimensions(part: Part, allParts: Part[]) {
    const {
      info: clr,
      topNeighborFrontZ,
      bottomNeighborFrontZ,
      leftNeighborFrontZ,
      rightNeighborFrontZ,
      topNeighborPart,
      bottomNeighborPart,
      leftNeighborPart,
      rightNeighborPart,
      frontNeighborPart,
      backNeighborPart,
      frontNeighborAnchorXY,
      backNeighborAnchorXY
    } = this.computeClearanceWithNeighborDepth(part, allParts);
    this.clearanceCalculated.emit(clr);

    const selBounds = this.getPartBounds(part);
    const lineMat = this.getCachedDimensionOverlayMaterial('clearance_line_mat_green', () =>
      new THREE.LineDashedMaterial({
        color: 0x10b981,
        dashSize: 14,
        gapSize: 7,
        linewidth: 2,
        depthTest: false,
        depthWrite: false
      })
    );
    const tickMat = this.getCachedDimensionOverlayMaterial('clearance_tick_mat_green', () =>
      new THREE.LineBasicMaterial({
        color: 0x10b981,
        linewidth: 2,
        depthTest: false,
        depthWrite: false
      })
    );

    const allowZeroAxes = {
      top: this.explicitLowClearancePairKeys.has(this.buildClearancePairKey('y', part.id, topNeighborPart?.id)),
      bottom: this.explicitLowClearancePairKeys.has(this.buildClearancePairKey('y', bottomNeighborPart?.id, part.id)),
      left: this.explicitLowClearancePairKeys.has(this.buildClearancePairKey('x', leftNeighborPart?.id, part.id)),
      right: this.explicitLowClearancePairKeys.has(this.buildClearancePairKey('x', part.id, rightNeighborPart?.id)),
      front: this.explicitLowClearancePairKeys.has(this.buildClearancePairKey('z', part.id, frontNeighborPart?.id)),
      back: this.explicitLowClearancePairKeys.has(this.buildClearancePairKey('z', backNeighborPart?.id, part.id))
    };

    const layout = this.dimensionAnchor.computeStandaloneClearanceSegments({
      bounds: selBounds,
      topClearance: clr.topClearance,
      bottomClearance: clr.bottomClearance,
      leftClearance: clr.leftClearance,
      rightClearance: clr.rightClearance,
      frontClearance: clr.frontClearance ?? null,
      backClearance: clr.backClearance ?? null,
      topNeighborFrontZ,
      bottomNeighborFrontZ,
      leftNeighborFrontZ,
      rightNeighborFrontZ,
      frontNeighborAnchorXY,
      backNeighborAnchorXY,
      allowZeroAxes
    });

    const zeroLabelOffset = new THREE.Vector3(0, 0, 0);

    const appendStandaloneClearanceBadge = (cfg: {
      segment: DimensionLineSegment | null | undefined;
      clearanceMm: number | null | undefined;
      arrowPrefix: '↕' | '↔';
      badgeType: ClearanceBadgeType;
      label: string;
      axis: ClearanceAxis;
      minSidePart: Part | null;
      maxSidePart: Part | null;
      defaultMoverSide: 'min' | 'max';
      referenceY?: number;
    }) => {
      if (cfg.clearanceMm === null || cfg.clearanceMm === undefined || !cfg.segment) return;

      this.appendDimensionSegmentVisuals(this.dimensionGroup, cfg.segment, lineMat, tickMat, true);

      const sprite = this.createClearanceSprite(`${cfg.arrowPrefix} ${cfg.clearanceMm} mm`, true);
      sprite.position.copy(cfg.segment.midpoint);
      sprite.renderOrder = DIMENSION_SPRITE_RENDER_ORDER;

      const resolved = resolveClearanceAnchorAndMover({
        axis: cfg.axis,
        minSidePart: cfg.minSidePart,
        maxSidePart: cfg.maxSidePart,
        selectedPartId: part.id,
        defaultMoverSide: cfg.defaultMoverSide
      });

      const badgeData: DimensionBadgeUserData = {
        isDimensionBadge: true,
        badgeType: cfg.badgeType,
        part,
        currentValue: cfg.clearanceMm,
        label: cfg.label,
        referenceY: cfg.referenceY,
        axis: cfg.axis,
        anchorPart: resolved.status === 'ok' ? resolved.anchorPart : undefined,
        moverPart: resolved.status === 'ok' ? resolved.moverPart : undefined,
        minSidePart: cfg.minSidePart,
        maxSidePart: cfg.maxSidePart,
        defaultMoverSide: cfg.defaultMoverSide,
        selectedPartId: part.id,
        isModuleInternalBadge: false,
        baseScaleX: 140,
        baseScaleY: 38
      };
      sprite.userData = {
        ...sprite.userData,
        ...badgeData,
        edgeP1: cfg.segment.p1.clone(),
        edgeP2: cfg.segment.p2.clone(),
        labelOffset: zeroLabelOffset.clone()
      };
      this.editableDimensionSprites.push(sprite);
      this.dimensionGroup.add(sprite);
    };

    appendStandaloneClearanceBadge({
      segment: layout.top,
      clearanceMm: clr.topClearance,
      arrowPrefix: '↕',
      badgeType: 'top_clearance',
      label: this.i18n.t('designer.upperClearance'),
      axis: 'y',
      minSidePart: part,
      maxSidePart: topNeighborPart,
      defaultMoverSide: 'min',
      referenceY: layout.top?.p2.y
    });

    appendStandaloneClearanceBadge({
      segment: layout.bottom,
      clearanceMm: clr.bottomClearance,
      arrowPrefix: '↕',
      badgeType: 'bottom_clearance',
      label: this.i18n.t('designer.lowerClearance'),
      axis: 'y',
      minSidePart: bottomNeighborPart,
      maxSidePart: part,
      defaultMoverSide: 'max',
      referenceY: layout.bottom?.p1.y
    });

    appendStandaloneClearanceBadge({
      segment: layout.left,
      clearanceMm: clr.leftClearance,
      arrowPrefix: '↔',
      badgeType: 'left_clearance',
      label: this.tFallback('designer.leftClearance', 'Luz Izquierda'),
      axis: 'x',
      minSidePart: leftNeighborPart,
      maxSidePart: part,
      defaultMoverSide: 'max'
    });

    appendStandaloneClearanceBadge({
      segment: layout.right,
      clearanceMm: clr.rightClearance,
      arrowPrefix: '↔',
      badgeType: 'right_clearance',
      label: this.tFallback('designer.rightClearance', 'Luz Derecha'),
      axis: 'x',
      minSidePart: part,
      maxSidePart: rightNeighborPart,
      defaultMoverSide: 'min'
    });

    appendStandaloneClearanceBadge({
      segment: layout.front,
      clearanceMm: clr.frontClearance,
      arrowPrefix: '↔',
      badgeType: 'front_clearance',
      label: this.tFallback('designer.frontClearance', 'Luz Frontal'),
      axis: 'z',
      minSidePart: part,
      maxSidePart: frontNeighborPart,
      defaultMoverSide: 'max'
    });

    appendStandaloneClearanceBadge({
      segment: layout.back,
      clearanceMm: clr.backClearance,
      arrowPrefix: '↔',
      badgeType: 'back_clearance',
      label: this.tFallback('designer.backClearance', 'Luz Trasera'),
      axis: 'z',
      minSidePart: backNeighborPart,
      maxSidePart: part,
      defaultMoverSide: 'max'
    });

    this.dimensionGroup.updateMatrixWorld(true);
    this.updateAdaptiveGizmoScale();
  }

  // --- INLINE 3D DIMENSION EDITOR (Edición Directa con Clic sobre Cotas 3D) ---

  openInlineDimensionEditor(sprite: THREE.Sprite, data: DimensionBadgeUserData) {
    const worldPos = new THREE.Vector3();
    sprite.getWorldPosition(worldPos);
    const screenPos = this.projectWorldToScreen(worldPos);
    if (!screenPos) return;

    this.setHoveredDimensionSprite(null);
    this.ngZone.run(() => {
      this.inlineDimensionEditor.set({
        x: screenPos.x,
        y: screenPos.y,
        value: data.currentValue,
        propType: data.badgeType,
        part: data.part,
        label: data.label,
        referenceY: data.referenceY,
        axis: data.axis,
        anchorPart: data.anchorPart,
        moverPart: data.moverPart,
        minSidePart: data.minSidePart,
        maxSidePart: data.maxSidePart,
        syntheticMinFaceCoord: data.syntheticMinFaceCoord,
        syntheticMaxFaceCoord: data.syntheticMaxFaceCoord,
        defaultMoverSide: data.defaultMoverSide,
        moverMinLimitEdge: data.moverMinLimitEdge,
        moverMaxLimitEdge: data.moverMaxLimitEdge,
        selectedPartId: data.selectedPartId,
        isModuleInternalBadge: data.isModuleInternalBadge,
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

  handleDocumentPointerDown(e: PointerEvent) {
    if (!this.inlineDimensionEditor()) return;
    const target = e.target;
    const editorContainer = this.inlineEditorContainerRef()?.nativeElement;
    if (editorContainer && target instanceof Node && editorContainer.contains(target)) {
      return;
    }
    this.cancelInlineDimension();
  }

  confirmInlineDimension(rawValue: string) {
    const editor = this.inlineDimensionEditor();
    if (!editor) return;

    const cleanStr = String(rawValue || '').replace(/mm/gi, '').replace(',', '.').trim();
    const numVal = Math.round(Number(cleanStr));
    const isClearance = this.isClearanceBadgeType(editor.propType);
    if (!Number.isFinite(numVal) || (isClearance ? numVal < 0 : numVal <= 0)) {
      this.cancelInlineDimension();
      return;
    }

    const allParts = this.parts();
    const findFreshPart = (candidate?: Part | null): Part | null =>
      candidate ? (allParts.find(p => p.id === candidate.id) ?? candidate) : null;

    if (editor.propType === 'length' || editor.propType === 'width') {
      const currentPart = findFreshPart(editor.part) ?? editor.part;
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
        this.liveDragPartUpdates.delete(currentPart.id);
      } else {
        this.disposeGroup(this.dimensionGroup);
        if (this.show3dDimensions()) {
          const b = this.getPartBounds(updatedPart);
          this.renderPieceDimensions(updatedPart, b.px, b.py, b.pz, b.sx, b.sy, b.sz);
        }
      }
    } else {
      const axis: ClearanceAxis =
        editor.axis ?? getBadgeClearanceAxis(editor.propType as ClearanceBadgeType);

      let moverPart: Part | null = null;
      let updates: Partial<Part> | null = null;

      if (editor.minSidePart !== undefined || editor.maxSidePart !== undefined) {
        const minPart = findFreshPart(editor.minSidePart);
        const maxPart = findFreshPart(editor.maxSidePart);
        const minBounds = minPart ? this.getPartBounds(minPart) : null;
        const maxBounds = maxPart ? this.getPartBounds(maxPart) : null;

        const preliminary = resolveClearanceAnchorAndMover({
          axis,
          minSidePart: minPart,
          maxSidePart: maxPart,
          selectedPartId: editor.selectedPartId,
          defaultMoverSide: editor.defaultMoverSide
        });

        let moverMinLimitEdge = editor.moverMinLimitEdge;
        let moverMaxLimitEdge = editor.moverMaxLimitEdge;

        if (
          editor.isModuleInternalBadge &&
          axis === 'y' &&
          preliminary.status === 'ok' &&
          preliminary.moverPart &&
          this.isInternalShelf(preliminary.moverPart)
        ) {
          const shelfLimits = this.getShelfVerticalLimits(preliminary.moverPart, allParts);
          if (preliminary.moverSide === 'max') {
            moverMaxLimitEdge = shelfLimits.aboveBottomY;
          } else if (preliminary.moverSide === 'min') {
            moverMinLimitEdge = shelfLimits.belowTopY;
          }
        }

        const repo = computeClearanceReposition({
          axis,
          desiredGapMm: numVal,
          minSidePart: minPart,
          minSideBounds: minBounds,
          maxSidePart: maxPart,
          maxSideBounds: maxBounds,
          syntheticMinFaceCoord: editor.syntheticMinFaceCoord,
          syntheticMaxFaceCoord: editor.syntheticMaxFaceCoord,
          selectedPartId: editor.selectedPartId,
          defaultMoverSide: editor.defaultMoverSide,
          moverMinLimitEdge,
          moverMaxLimitEdge
        });

        if (repo.status === 'locked') {
          this.showClearanceWarningToast(
            this.tFallback(
              'designer.clearanceLockedWarning',
              'La pieza está bloqueada; desbloquéala para modificar esta luz'
            )
          );
          this.cancelInlineDimension();
          return;
        }

        if (repo.status !== 'ok' || !repo.moverPart || !repo.posProp || repo.newPosCoord === null) {
          this.cancelInlineDimension();
          return;
        }

        moverPart = repo.moverPart;
        updates = { [repo.posProp]: repo.newPosCoord };

        const pairKey = this.buildClearancePairKey(axis, minPart?.id, maxPart?.id);
        if ((repo.resultingGapMm ?? numVal) < 10) {
          this.explicitLowClearancePairKeys.add(pairKey);
        } else {
          this.explicitLowClearancePairKeys.delete(pairKey);
        }
      } else {
        // Respaldo compatible para invocación sintética de pruebas con editor.part y referenceY en Y
        const currentPart = findFreshPart(editor.part) ?? editor.part;
        if (currentPart.isLocked) {
          this.showClearanceWarningToast(
            this.tFallback(
              'designer.clearanceLockedWarning',
              'La pieza está bloqueada; desbloquéala para modificar esta luz'
            )
          );
          this.cancelInlineDimension();
          return;
        }

        const limits = this.getShelfVerticalLimits(currentPart, allParts);
        const initBounds = this.getPartBounds(currentPart);
        const halfThick = initBounds.sy / 2;

        let targetPosY: number;
        if (editor.referenceY !== undefined) {
          targetPosY =
            editor.propType === 'bottom_clearance'
              ? editor.referenceY + numVal + halfThick
              : editor.referenceY - numVal - halfThick;
        } else {
          targetPosY =
            editor.propType === 'bottom_clearance'
              ? limits.belowTopY + numVal + halfThick
              : limits.aboveBottomY - numVal - halfThick;
        }

        // Permitir 0 mm de luz sin salto mínimo de 5 mm, protegiendo suelo (minY >= 0) y vano sólido
        const minSafeY = Math.max(halfThick, limits.belowTopY + halfThick);
        const maxSafeY = limits.aboveBottomY - halfThick;
        const clampedPosY =
          minSafeY <= maxSafeY
            ? Math.max(minSafeY, Math.min(maxSafeY, Math.round(targetPosY * 100) / 100))
            : Math.max(halfThick, Math.round(targetPosY * 100) / 100);

        moverPart = currentPart;
        updates = { posY: clampedPosY };
      }

      if (!moverPart || !updates) {
        this.cancelInlineDimension();
        return;
      }

      const updatedPart: Part = {
        ...moverPart,
        ...updates
      };

      // 1 único snapshot en Undo/Redo y persistencia en ProjectStorageService
      this.projectStorage.updatePart(updatedPart, true);
      this.partModified.emit({ part: updatedPart, updates });

      if (this.pieceObjectMap.has(moverPart.id)) {
        this.previewPartUpdatesInPlace([{ part: moverPart, updates }]);
        this.liveDragPartUpdates.delete(moverPart.id);
      }

      const baseParts = allParts.some(p => p.id === updatedPart.id)
        ? allParts
        : this.parts();
      const updatedParts = baseParts.map(p => (p.id === updatedPart.id ? updatedPart : p));

      const visibleForJoinery = updatedParts.filter(p => !this.hiddenPartIds().has(p.id));
      const joinery = this.joineryEngine.calculateJoinery(visibleForJoinery);
      this.updateDetectedCollisions(joinery.collisions);
      this.collisionsDetected.emit(joinery.collisions);
      this.allDrillHoles.set(joinery.allDrillHoles);
      this.drillHolesUpdated.emit(joinery.allDrillHoles);

      const currentSelectedIds = this.activeSelectedIds();
      const singleSelectedFresh =
        currentSelectedIds.length === 1
          ? (updatedParts.find(p => p.id === currentSelectedIds[0]) ?? null)
          : null;
      const focusPart = singleSelectedFresh ?? updatedPart;
      const focusBounds = this.getPartBounds(focusPart);

      const clr = this.computeClearanceInfo(focusPart, updatedParts);
      this.clearanceCalculated.emit(clr);

      this.disposeGroup(this.dimensionGroup);
      if (this.show3dDimensions() && singleSelectedFresh) {
        this.renderPieceDimensions(
          focusPart,
          focusBounds.px,
          focusBounds.py,
          focusBounds.pz,
          focusBounds.sx,
          focusBounds.sy,
          focusBounds.sz
        );
      }

      if (this.showClearances()) {
        const groupTargetId = updatedPart.groupId ?? focusPart.groupId;
        if (
          groupTargetId &&
          (editor.isModuleInternalBadge ||
            this.isInternalShelf(focusPart) ||
            this.isInternalDivider(focusPart))
        ) {
          this.renderModuleInternalClearances(
            groupTargetId,
            singleSelectedFresh ?? undefined,
            undefined,
            updatedParts
          );
        } else {
          this.disposeGroup(this.internalClearanceGroup);
          this.renderClearanceDimensions(focusPart, updatedParts);
        }
      }

      if (
        (singleSelectedFresh || currentSelectedIds.length === 0) &&
        (this.activeTool() === 'move' || this.activeTool() === 'select')
      ) {
        this.buildGizmo(
          focusPart,
          focusBounds.px,
          focusBounds.py,
          focusBounds.pz,
          focusBounds.sx,
          focusBounds.sy,
          focusBounds.sz
        );
      }
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
    this.updateExplodedOffsets(untracked(() => this.explodedPercent()));
  }

  private resolveExplosionGroupId(
    part: Part,
    partGroupMap: Map<string, PartGroup>,
    presentRawGroupIds: Set<string>
  ): string | null {
    return resolveExplosionGroupIdPure(part, partGroupMap, presentRawGroupIds);
  }

  private computeExplosionStats(
    entries: PreparedExplosionRenderEntry[],
    partGroupMap: Map<string, PartGroup>
  ): {
    sceneStats: ExplosionAABBStats;
    groupStatsMap: Map<string, ExplosionAABBStats>;
  } {
    return computeExplosionStatsPure(entries, partGroupMap);
  }

  private computePartExplodedOffset(
    part: Part,
    baseBounds: PartWorldAABB,
    isDoor: boolean,
    isDrawer: boolean,
    groupStats: ExplosionAABBStats | undefined,
    sceneStats: ExplosionAABBStats
  ): THREE.Vector3 {
    const offset = computePartExplodedOffsetPure(
      part,
      baseBounds,
      isDoor,
      isDrawer,
      groupStats,
      sceneStats
    );
    return new THREE.Vector3(offset.x, offset.y, offset.z);
  }

  private getPieceExplosionClusterKey(item: PieceMeshData): string {
    const resolvedGroupId =
      item.explosionGroupId !== undefined ? item.explosionGroupId : (item.part.groupId || null);
    return getExplosionClusterKey(resolvedGroupId);
  }

  private getPieceBaseCenterY(item: PieceMeshData): number {
    if (item.isDoor && item.doorPivot && item.doorPivotOriginalPos && item.doorLocalMeshPos) {
      if (item.doorBaseRotation) {
        const rotatedLocal = this.scratchDoorLocalCenter
          .copy(item.doorLocalMeshPos)
          .applyEuler(item.doorBaseRotation);
        return item.doorPivotOriginalPos.y + rotatedLocal.y;
      }
      return item.doorPivotOriginalPos.y + item.doorLocalMeshPos.y;
    }
    return item.originalPos.y;
  }

  private getPieceHalfHeightY(item: PieceMeshData): number {
    if (typeof item.halfHeightY === 'number' && Number.isFinite(item.halfHeightY) && item.halfHeightY >= 0) {
      return item.halfHeightY;
    }
    return this.getPartBounds(item.part).sy / 2;
  }

  private updateZoneHighlightScene(box: CabinetZoneHighlightBox | null): void {
    if (!this.scene) return;
    const hadChildren = this.zoneHighlightGroup.children.length > 0;
    this.disposeGroup(this.zoneHighlightGroup);
    this.zoneHighlightGroup.position.set(0, 0, 0);
    this.zoneHighlightGroup.rotation.set(0, 0, 0);

    if (!box) {
      this.zoneHighlightGroup.visible = false;
      if (hadChildren) {
        this.requestRender(4);
      }
      return;
    }

    const { minX, maxX, minY, maxY, minZ, maxZ } = box;
    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxY) ||
      !Number.isFinite(minZ) ||
      !Number.isFinite(maxZ)
    ) {
      this.zoneHighlightGroup.visible = false;
      return;
    }

    const sx = Math.max(4, maxX - minX);
    const sy = Math.max(4, maxY - minY);
    const sz = Math.max(4, maxZ - minZ);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;

    const boxGeo = new THREE.BoxGeometry(sx, sy, sz);
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      depthWrite: false,
      depthTest: false
    });
    const fillMesh = new THREE.Mesh(boxGeo, fillMat);
    fillMesh.position.set(cx, cy, cz);
    fillMesh.renderOrder = 950;
    fillMesh.userData = {
      isAuxiliaryVisual: true,
      isBoxHelper: true,
      isZoneHighlight: true,
      zoneId: box.zoneId
    };
    fillMesh.raycast = () => {
      // No seleccionable por raycasting
    };

    const edgesGeo = new THREE.EdgesGeometry(boxGeo);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: false
    });
    const edgeLines = new THREE.LineSegments(edgesGeo, edgeMat);
    edgeLines.position.set(cx, cy, cz);
    edgeLines.renderOrder = 951;
    edgeLines.userData = {
      isAuxiliaryVisual: true,
      isOutline: true,
      isZoneHighlight: true,
      zoneId: box.zoneId
    };
    edgeLines.raycast = () => {
      // No seleccionable por raycasting
    };

    this.zoneHighlightGroup.visible = true;
    this.zoneHighlightGroup.userData = {
      isAuxiliaryVisual: true,
      isZoneHighlight: true,
      zoneId: box.zoneId
    };
    this.zoneHighlightGroup.add(fillMesh);
    this.zoneHighlightGroup.add(edgeLines);
  }

  private updateExplodedOffsets(percent: number) {
    const factor = Math.max(0, Math.min(1, Number(percent) / 100 || 0));

    let clusterLifts: Map<string, number> | null = null;
    if (factor > 0 && this.pieceObjects.length > 0) {
      const clampInputs: ExplosionFloorClampInput[] = this.pieceObjects.map(item => ({
        clusterKey: this.getPieceExplosionClusterKey(item),
        baseCenterY: this.getPieceBaseCenterY(item),
        halfHeightY: this.getPieceHalfHeightY(item),
        explodedOffsetY: item.explodedOffset.y
      }));
      clusterLifts = computeExplosionClusterFloorLifts(clampInputs, factor);
    }

    let anyFloorLiftChanged = false;

    for (const item of this.pieceObjects) {
      const prevLift = item.currentFloorLiftY ?? 0;
      const floorLiftY =
        factor > 0 && clusterLifts
          ? (clusterLifts.get(this.getPieceExplosionClusterKey(item)) ?? 0)
          : 0;

      if (Math.abs(floorLiftY - prevLift) > 1e-6) {
        anyFloorLiftChanged = true;
      }
      item.currentFloorLiftY = floorLiftY;

      const offsetX = factor > 0 ? item.explodedOffset.x * factor : 0;
      const offsetY = factor > 0 ? item.explodedOffset.y * factor + floorLiftY : 0;
      const offsetZ = factor > 0 ? item.explodedOffset.z * factor : 0;

      if (item.isDoor && item.doorPivot && item.doorPivotOriginalPos && item.doorLocalMeshPos) {
        if (factor === 0) {
          item.doorPivot.position.copy(item.doorPivotOriginalPos);
        } else {
          item.doorPivot.position.set(
            item.doorPivotOriginalPos.x + offsetX,
            item.doorPivotOriginalPos.y + offsetY,
            item.doorPivotOriginalPos.z + offsetZ
          );
        }
        item.mesh.position.copy(item.doorLocalMeshPos);
      } else if (item.isDrawer || (item.isDoor && item.isSlidingDoor)) {
        const curOpen = this.openCurrentMap.get(item.part.id) || 0;
        this.applyLinearSlideTransform(item, curOpen, factor);
      } else {
        if (factor === 0) {
          item.mesh.position.copy(item.originalPos);
        } else {
          item.mesh.position.set(
            item.originalPos.x + offsetX,
            item.originalPos.y + offsetY,
            item.originalPos.z + offsetZ
          );
        }
      }
    }

    if (factor !== this.lastExplodedFactor || anyFloorLiftChanged) {
      this.lastExplodedFactor = factor;
      this.updateSelectionOutlineGroup(untracked(() => this.activeSelectedIds()), factor);
    }
    this.sceneRaycastPicker.refreshPickableMatricesAndBounds(this.furnitureGroup);
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
   * Resuelve el ID del módulo anfitrión de un grupo (ej. cajón insertado en una cavidad),
   * ignorando referencias vacías o al suelo ('floor').
   */
  private resolveHostedParentGroupId(grp: PartGroup | undefined | null): string | null {
    if (!grp) return null;
    const rawHostId = grp.hostGroupId ?? grp.drawerConfig?.hostGroupId;
    if (rawHostId) {
      return rawHostId === 'floor' ? null : rawHostId;
    }
    if (
      !('hostGroupId' in grp) &&
      (!grp.drawerConfig || !('hostGroupId' in grp.drawerConfig)) &&
      grp.drawerConfig?.targetModuleId &&
      grp.drawerConfig.targetModuleId !== 'floor'
    ) {
      return grp.drawerConfig.targetModuleId;
    }
    return null;
  }

  /**
   * Obtiene todos los IDs de grupos alojados (directa o indirectamente) dentro de los módulos anfitriones dados.
   */
  private getHostedGroupIdsForHostIds(hostGroupIds: ReadonlySet<string>): Set<string> {
    const hostedIds = new Set<string>();
    if (hostGroupIds.size === 0) return hostedIds;
    const allGroups = this.partGroups();
    let added = true;
    while (added) {
      added = false;
      for (const grp of allGroups) {
        if (hostedIds.has(grp.id) || hostGroupIds.has(grp.id)) continue;
        const parentId = this.resolveHostedParentGroupId(grp);
        if (parentId && (hostGroupIds.has(parentId) || hostedIds.has(parentId))) {
          hostedIds.add(grp.id);
          added = true;
        }
      }
    }
    return hostedIds;
  }

  /**
   * Devuelve los IDs de grupo que tienen la totalidad de sus piezas incluidas en `draggedParts`.
   */
  private getFullyDraggedGroupIds(draggedParts: readonly Part[]): Set<string> {
    const draggedIds = new Set(draggedParts.map(p => p.id));
    const candidateGroupIds = new Set<string>();
    for (const p of draggedParts) {
      if (p.groupId) {
        candidateGroupIds.add(p.groupId);
      }
    }
    if (candidateGroupIds.size === 0) return candidateGroupIds;

    const allParts = this.parts();
    const fullGroupIds = new Set<string>();
    for (const gId of candidateGroupIds) {
      const groupParts = allParts.filter(p => p.groupId === gId);
      if (groupParts.length > 0 && groupParts.every(gp => draggedIds.has(gp.id))) {
        fullGroupIds.add(gId);
      }
    }
    return fullGroupIds;
  }

  /**
   * Recolecta copias de todas las piezas pertenecientes a grupos alojados dentro de `hostGroupIds`,
   * excluyendo opcionalmente las piezas ya incluidas en `excludedPartIds`.
   */
  private collectHostedPartsForGroupIds(
    hostGroupIds: ReadonlySet<string>,
    excludedPartIds?: ReadonlySet<string>
  ): Part[] {
    const hostedGroupIds = this.getHostedGroupIdsForHostIds(hostGroupIds);
    if (hostedGroupIds.size === 0) return [];
    return this.parts()
      .filter(
        p =>
          Boolean(p.groupId) &&
          hostedGroupIds.has(p.groupId as string) &&
          !(excludedPartIds && excludedPartIds.has(p.id))
      )
      .map(p => ({ ...p }));
  }

  /**
   * Recolecta piezas de cajones/grupos alojados cuyo módulo anfitrión está siendo arrastrado en bloque.
   */
  private collectHostedPartsForDraggedParts(draggedParts: readonly Part[]): Part[] {
    const fullGroupIds = this.getFullyDraggedGroupIds(draggedParts);
    if (fullGroupIds.size === 0) return [];
    const excludedIds = new Set(draggedParts.map(p => p.id));
    return this.collectHostedPartsForGroupIds(fullGroupIds, excludedIds);
  }

  private getCombinedDraggedParts(): Part[] {
    return this.dragInitialHostedParts.length > 0
      ? [...this.dragInitialParts, ...this.dragInitialHostedParts]
      : this.dragInitialParts;
  }

  private getPartsMinY(parts: readonly Part[]): number {
    let minY = Infinity;
    for (const p of parts) {
      const b = this.getPartBounds(p);
      if (b.minY < minY) minY = b.minY;
    }
    return minY;
  }

  private getExternalPartsForDrag(movingParts: readonly Part[]): Part[] {
    const movingIds = new Set(movingParts.map(p => p.id));
    return this.parts().filter(p => !movingIds.has(p.id));
  }

  private buildTranslatedPartUpdates(
    initialParts: readonly Part[],
    dx: number,
    dy: number,
    dz: number
  ): { part: Part; updates: Partial<Part> }[] {
    const updatesList: { part: Part; updates: Partial<Part> }[] = [];
    for (const p of initialParts) {
      const pBounds = this.getPartBounds(p);
      updatesList.push({
        part: p,
        updates: {
          posX: Math.round(((p.posX ?? 0) + dx) * 10) / 10,
          posY: Math.round(((p.posY ?? pBounds.sy / 2) + dy) * 10) / 10,
          posZ: Math.round(((p.posZ ?? 0) + dz) * 10) / 10
        }
      });
    }
    return updatesList;
  }

  private computeTranslatedBoundsForParts(
    parts: readonly Part[],
    dx: number,
    dy: number,
    dz: number
  ): { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number } {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of parts) {
      const pBounds = this.getPartBounds(p, {
        x: (p.posX ?? 0) + dx,
        y: (p.posY ?? 0) + dy,
        z: (p.posZ ?? 0) + dz
      });
      minX = Math.min(minX, pBounds.minX);
      maxX = Math.max(maxX, pBounds.maxX);
      minY = Math.min(minY, pBounds.minY);
      maxY = Math.max(maxY, pBounds.maxY);
      minZ = Math.min(minZ, pBounds.minZ);
      maxZ = Math.max(maxZ, pBounds.maxZ);
    }
    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  private applyWallAutoElevation(currentDy: number, initialGrpMinY: number): number {
    const firstPart = this.dragInitialParts[0];
    if (!firstPart?.groupId) return currentDy;
    const grp = this.partGroups().find(g => g.id === firstPart.groupId);
    const cat = grp?.parametricConfig?.category || grp?.parametricConfig?.moduleType;
    let autoElevation: number | null = null;
    if (cat === 'kitchen_wall' || cat === 'wall_cabinet') {
      autoElevation = 1450;
    } else if (cat === 'vanity') {
      autoElevation = 450;
    } else if (
      cat === 'kitchen_base' ||
      cat === 'base_cabinet' ||
      cat === 'closet' ||
      cat === 'oven_base' ||
      cat === 'sink_base'
    ) {
      autoElevation = 0;
    }
    if (autoElevation === null) return currentDy;
    const idealDy = autoElevation - initialGrpMinY;
    if (Math.abs(currentDy - idealDy) <= 90 || Math.abs(currentDy) < 25) {
      return idealDy;
    }
    return currentDy;
  }

  private isGroupDirectlyLocked(
    groupId: string,
    allGroups: readonly PartGroup[],
    allParts: readonly Part[]
  ): boolean {
    const grp = allGroups.find(g => g.id === groupId);
    if (grp?.isLocked) return true;
    return allParts.some(p => p.groupId === groupId && !!p.isLocked);
  }

  private hasDirectlyLockedAncestorHost(
    groupId: string,
    allGroups: readonly PartGroup[],
    allParts: readonly Part[]
  ): boolean {
    const visited = new Set<string>([groupId]);
    let currGrp = allGroups.find(g => g.id === groupId);
    let parentId = this.resolveHostedParentGroupId(currGrp);
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      if (this.isGroupDirectlyLocked(parentId, allGroups, allParts)) {
        return true;
      }
      currGrp = allGroups.find(g => g.id === parentId);
      parentId = this.resolveHostedParentGroupId(currGrp);
    }
    return false;
  }

  private isGroupOrRelatedLocked(groupId: string): boolean {
    const allGroups = this.partGroups();
    const allParts = this.parts();
    if (this.isGroupDirectlyLocked(groupId, allGroups, allParts)) {
      return true;
    }
    if (this.hasDirectlyLockedAncestorHost(groupId, allGroups, allParts)) {
      return true;
    }
    const hostedIds = this.getHostedGroupIdsForHostIds(new Set([groupId]));
    for (const hId of hostedIds) {
      if (this.isGroupDirectlyLocked(hId, allGroups, allParts)) {
        return true;
      }
    }
    return false;
  }

 /**
   * Verifica si una pieza está congelada directamente (part.isLocked)
   * o si pertenece a un cajón/módulo congelado (group.isLocked), a su anfitrión congelado o a un grupo alojado congelado.
   */
  isPartOrGroupLocked(part: Part | null | undefined): boolean {
    if (!part) return false;
    if (part.isLocked) return true;
    return Boolean(part.groupId && this.isGroupOrRelatedLocked(part.groupId));
  }

  isApplianceLocked(app: ApplianceItem | null | undefined): boolean {
    if (!app) return false;
    if (app.isLocked) return true;
    return Boolean(app.groupId && this.isGroupOrRelatedLocked(app.groupId));
  }

  private isObjectAndAncestorsVisible(obj: THREE.Object3D | null | undefined): boolean {
    let curr: THREE.Object3D | null | undefined = obj;
    while (curr) {
      if (!curr.visible) {
        return false;
      }
      curr = curr.parent;
    }
    return true;
  }

  private getRaycastPieceRoots(): THREE.Object3D[] {
    const roots: THREE.Object3D[] = [];
    for (const item of this.pieceObjects) {
      if (item.mesh) {
        roots.push(item.mesh);
      }
      if (item.doorPivot) {
        roots.push(item.doorPivot);
      }
    }
    return roots;
  }

  private resolvePieceHitMeta(obj: THREE.Object3D): ScenePieceHitMeta | null {
    let curr: THREE.Object3D | null = obj;
    let part: Part | undefined;
    let isHandle = false;
    let isDoor = false;
    let isDrawer = false;
    let isDrillHole = false;
    let drillHole: DrillHole | undefined;
    let parentPartId: string | undefined;

    while (curr && curr !== this.furnitureGroup && curr !== this.scene) {
      const data = curr.userData;
      if (data) {
        if (data['isHandle']) isHandle = true;
        if (data['isDoor']) isDoor = true;
        if (data['isDrawer']) isDrawer = true;
        if (data['isDrillHole']) isDrillHole = true;
        if (!drillHole && data['drillHole']) {
          drillHole = data['drillHole'] as DrillHole;
        }
        if (!parentPartId && typeof data['parentPartId'] === 'string') {
          parentPartId = data['parentPartId'];
        }
        if (!part && data['part']) {
          part = data['part'] as Part;
        }
      }
      curr = curr.parent;
    }

    if (!part && parentPartId) {
      part = this.pieceObjectMap.get(parentPartId)?.part;
    }

    if (!part) {
      return null;
    }

    const pieceData = this.pieceObjectMap.get(part.id);
    return {
      part,
      isHandle,
      isDoor: isDoor || Boolean(pieceData?.isDoor),
      isDrawer: isDrawer || Boolean(pieceData?.isDrawer),
      isDrillHole,
      drillHole
    };
  }

  private buildSceneRaycastSources(): SceneRaycastSources {
    const vis = this.layerVisibility();
    const hasRoomWalls =
      this.workspaceMode() === 'room' &&
      this.roomGroup.visible &&
      this.roomGroup.children.length > 0;
    const hasAppliances =
      vis.showAppliances &&
      this.appliancesGroup.visible &&
      this.appliancesGroup.children.length > 0;
    const hasReferenceGuide =
      this.showReferenceGuide() &&
      this.referenceGuideGroup.visible &&
      this.referenceGuideGroup.children.length > 0;
    const hasDrillHoles =
      this.drillGroup.visible &&
      this.drillGroup.children.length > 0;

    return {
      pieces: this.getRaycastPieceRoots(),
      appliancesRoot: hasAppliances ? this.appliancesGroup : null,
      wallsRoot: hasRoomWalls ? this.roomGroup : null,
      referenceGuideRoot: hasReferenceGuide ? this.referenceGuideGroup : null,
      drillRoot: hasDrillHoles ? this.drillGroup : null,
      hiddenPartIds: this.hiddenPartIds(),
      resolvePartFromObject: obj => this.resolvePieceHitMeta(obj),
      resolveApplianceFromObject: obj => this.resolveApplianceFromObject(obj),
      resolveWallIdFromObject: obj => this.resolveWallIdFromObject(obj)
    };
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
    const allParts = this.parts();
    const grpParts = allParts.filter(p => p.groupId === part.groupId);
    if (grpParts.length === 0) return;

    const currentlyLocked = this.isPartOrGroupLocked(part);
    const nextLocked = !currentlyLocked;

    if (!nextLocked && this.hasDirectlyLockedAncestorHost(part.groupId, this.partGroups(), allParts)) {
      this.showClearanceWarningToast('El módulo anfitrión está congelado; descongélalo primero.');
      this.closeContextMenu();
      return;
    }

    const hostedGroupIds = this.getHostedGroupIdsForHostIds(new Set([part.groupId]));
    const hostedParts = this.collectHostedPartsForGroupIds(
      new Set([part.groupId]),
      new Set(grpParts.map(p => p.id))
    );
    const targetParts = [...grpParts, ...hostedParts];

    if (!nextLocked) {
      const storeGroups = this.projectStorage.groupsList();
      const targetGroupIds = new Set<string>([part.groupId, ...hostedGroupIds]);
      for (const gId of targetGroupIds) {
        const storeGrp = storeGroups.find(g => g.id === gId);
        if (storeGrp?.isLocked) {
          this.projectStorage.updateGroup(gId, { isLocked: false });
        }
      }
    }

    const updatesList = targetParts.map(p => ({
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
      this.suppressNextContextMenuForMeasureCancel = false;
      this.rightPointerDownPos = { x: e.clientX, y: e.clientY };
      this.rightPointerDownTime = Date.now();
      this.rightPointerDragged = false;
      return;
    }

    // 0. Selección múltiple por ventana (Marquee Box Selection con tecla Shift presionada)
    // Desactiva OrbitControls para que la cámara no se mueva durante el arrastre de selección técnica
    if (e.button === 0 && e.shiftKey && !this.isMeasureMode()) {
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
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)
    ) {
      return;
    }
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 0. Measurement Tape Mode (Free Orbit + Click <= 5px threshold in pointerup)
    if (this.isMeasureMode()) {
      if (e.button === 0) {
        this.measurePointerDownPos = { x: e.clientX, y: e.clientY };
        this.lastMeasurePointerClient = { x: e.clientX, y: e.clientY };
      }
      // Keep OrbitControls enabled so user can freely orbit/zoom/pan at any point
      if (this.controls) {
        this.controls.enabled = true;
      }
      return;
    }

    // 0.3. Rotate 90° Tool
    if (this.activeTool() === 'rotate_90') {
      const pickResult = this.sceneRaycastPicker.pickClosestSceneCandidate(
        this.raycaster,
        this.buildSceneRaycastSources()
      );
      const closest = pickResult.closest;
      if (closest) {
        if ((closest.kind === 'piece' || closest.kind === 'drill_hole') && closest.part) {
          const part = closest.part;
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
        // Un objeto distinto en primer plano (electrodoméstico, muro o guía) bloquea piezas detrás
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    // 0.8 Check if clicking on Wall Gizmo (Axis translation arrow, Edge stretch handle or Top Height handle)
    if (this.workspaceMode() === 'room' && this.wallGizmoHitMeshes.length > 0) {
      const wallGizmoIntersects = this.sceneRaycastPicker.intersectPriorityHandles(
        this.raycaster,
        this.wallGizmoHitMeshes,
        true
      );
      if (wallGizmoIntersects.length > 0) {
        const hitObj = wallGizmoIntersects[0].object;
        const hitData = hitObj.userData as WallGizmoHitData;
        const gizmoType = hitData?.gizmoType || hitData?.type;
        const wallTarget = hitData?.wallTarget || hitData?.wallId;
        if (hitData && hitData.isWallGizmo && wallTarget && gizmoType) {
          const cfg = this.roomConfig();
          const targetWall = getResolvedRoomWalls(cfg).find(w => w.id === wallTarget);
          const isLocked = !targetWall || !!cfg.isWallsLocked || !!targetWall.isLocked || !!cfg.lockedWalls?.[wallTarget];
          if (isLocked || !targetWall) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          this.isWallGizmoDragging = true;
          this.activeWallGizmoHit = {
            ...hitData,
            type: gizmoType,
            gizmoType,
            wallTarget,
            wallId: wallTarget
          };
          this.activeWallTarget = wallTarget;
          this.activeWallStretchEndSign = hitData.endSign === -1 ? -1 : 1;
          this.dragStartPointer = { x: e.clientX, y: e.clientY };
          this.initialWallPosX = targetWall.posX;
          this.initialWallPosZ = targetWall.posZ;
          this.initialWallLength = targetWall.length;
          this.initialWallHeight = targetWall.height;
          this.pendingWallUpdates = null;

          if (gizmoType === 'wall_move') {
            this.dragPlane.set(new THREE.Vector3(0, 1, 0), -(targetWall.height + 120));
          } else if (gizmoType === 'wall_stretch') {
            this.dragPlane.set(new THREE.Vector3(0, 1, 0), -(targetWall.height / 2));
          } else if (gizmoType === 'wall_stretch_height') {
            const camDir = new THREE.Vector3();
            this.camera.getWorldDirection(camDir);
            camDir.y = 0;
            if (camDir.lengthSq() < 1e-6) {
              camDir.set(0, 0, -1);
            } else {
              camDir.normalize();
            }
            const topAnchor = new THREE.Vector3(
              this.initialWallPosX,
              this.initialWallHeight,
              this.initialWallPosZ
            );
            this.wallHeightDragPlane.setFromNormalAndCoplanarPoint(camDir.negate(), topAnchor);
            if (!this.raycaster.ray.intersectPlane(this.wallHeightDragPlane, this.wallHeightDragStartPoint)) {
              this.wallHeightDragStartPoint.copy(topAnchor);
            }
            this.dragPlane.set(new THREE.Vector3(0, 1, 0), -this.initialWallHeight);
          }

          const startHit = new THREE.Vector3();
          if (this.raycaster.ray.intersectPlane(this.dragPlane, startHit)) {
            this.dragPlaneIntersectionStart.copy(startHit);
          } else {
            const fallbackY = gizmoType === 'wall_move'
              ? targetWall.height + 120
              : gizmoType === 'wall_stretch'
                ? targetWall.height / 2
                : targetWall.height;
            this.dragPlaneIntersectionStart.set(targetWall.posX, fallbackY, targetWall.posZ);
          }
          this.controls.enabled = false;
          canvas.style.cursor = gizmoType === 'wall_stretch_height'
            ? 'ns-resize'
            : gizmoType === 'wall_stretch'
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
      const visibleDimSprites = this.editableDimensionSprites.filter(sprite =>
        this.isObjectAndAncestorsVisible(sprite)
      );
      const dimIntersects = visibleDimSprites.length > 0
        ? this.raycaster.intersectObjects(visibleDimSprites, false)
        : [];
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
      const gizmoIntersects = this.sceneRaycastPicker.intersectPriorityHandles(
        this.raycaster,
        this.gizmoHitMeshes,
        true
      );
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
        this.dragInitialHostedParts = this.collectHostedPartsForDraggedParts(this.dragInitialParts);

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
      const handleIntersects = this.sceneRaycastPicker.intersectPriorityHandles(
        this.raycaster,
        this.applianceHandleHitMeshes,
        true
      );
      if (handleIntersects.length > 0) {
        const hit = handleIntersects[0].object as THREE.Mesh;
        const handleData = hit.userData;
        if (handleData && handleData['isApplianceHandle']) {
          const handleApp = handleData['appliance'] as ApplianceItem | undefined;
          const freshApp = this.appliances().find(a => a.id === handleApp?.id) || handleApp;
          if (!freshApp) return;
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
          const handlePos = new THREE.Vector3();
          hit.getWorldPosition(handlePos);
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

    // 2. Unified closest-distance-wins Priority 2 scene picking (Pieces, Drill Holes, Appliances, Walls, Reference Guide)
    const scenePick = this.sceneRaycastPicker.pickClosestSceneCandidate(
      this.raycaster,
      this.buildSceneRaycastSources()
    );
    const closest = scenePick.closest;

    if (closest?.kind === 'appliance' && closest.appliance) {
      const targetApp = closest.appliance;
      if (e.shiftKey) {
        this.ngZone.run(() => this.handleShiftClickSelection(e, closest));
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const curPartIds = this.activeSelectedIds();
      const curAppIds = this.activeSelectedApplianceIds();
      const isPartOfActiveMulti =
        curAppIds.includes(targetApp.id) && (curPartIds.length > 0 || curAppIds.length > 1);

      this.ngZone.run(() => {
        this.isReferenceGuideSelected.set(false);
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
        this.dragInitialHostedParts = this.collectHostedPartsForDraggedParts(this.dragInitialParts);
        const relevantGroupIds = new Set(
          [...this.dragInitialParts, ...this.dragInitialHostedParts].map(p => p.groupId).filter(Boolean)
        );
        const activeApps = isPartOfActiveMulti
          ? this.appliances().filter(
              a =>
                a.id !== targetApp.id &&
                (curAppIds.includes(a.id) ||
                  (a.groupId && (a.groupId === targetApp.groupId || relevantGroupIds.has(a.groupId))))
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

    if (closest?.kind === 'reference_guide') {
      if (e.shiftKey) {
        this.ngZone.run(() => this.handleShiftClickSelection(e, closest));
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      this.ngZone.run(() => {
        this.isReferenceGuideSelected.set(true);
        if (this.selectedWallType() !== null) {
          this.selectedWallType.set(null);
          this.wallSelected.emit(null);
        }
        this.partSelected.emit(null);
        this.partsSelected.emit([]);
        this.applianceSelected.emit(null);
        if (this.activeSelectedApplianceIds().length > 0) {
          this.appliancesSelected.emit([]);
        }
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
    }

    if (closest?.kind === 'wall' && closest.wallId) {
      if (e.shiftKey) {
        this.ngZone.run(() => this.handleShiftClickSelection(e, closest));
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const wallId = closest.wallId;
      this.ngZone.run(() => {
        this.isReferenceGuideSelected.set(false);
        this.selectedWallType.set(wallId);
        this.wallSelected.emit(wallId);
      });
      const cfg = this.roomConfig();
      const targetWall = getResolvedRoomWalls(cfg).find(w => w.id === wallId);
      const isLocked =
        !targetWall || !!cfg.isWallsLocked || !!targetWall.isLocked || !!cfg.lockedWalls?.[wallId];
      const canDragTool = this.activeTool() === 'select' || this.activeTool() === 'move';
      if (e.button === 0 && canDragTool && !isLocked && targetWall) {
        this.isWallDragging = true;
        this.activeWallTarget = wallId;
        this.dragStartPointer = { x: e.clientX, y: e.clientY };
        this.initialWallPosX = targetWall.posX;
        this.initialWallPosZ = targetWall.posZ;
        this.initialWallLength = targetWall.length;
        this.initialWallHeight = targetWall.height;
        this.pendingWallUpdates = null;
        this.dragPlane.set(new THREE.Vector3(0, 1, 0), -closest.intersection.point.y);
        const startHit = new THREE.Vector3();
        if (this.raycaster.ray.intersectPlane(this.dragPlane, startHit)) {
          this.dragPlaneIntersectionStart.copy(startHit);
        } else {
          this.dragPlaneIntersectionStart.copy(closest.intersection.point);
        }
        this.controls.enabled = false;
        canvas.style.cursor = 'move';
        e.preventDefault();
        e.stopPropagation();
      } else {
        this.isWallDragging = false;
      }
      return;
    }

    if ((closest?.kind === 'piece' || closest?.kind === 'drill_hole') && closest.part) {
      const hitPart = closest.part;
      const hitMeta = this.resolvePieceHitMeta(closest.object);
      const isHandle = Boolean(closest.isHandle || hitMeta?.isHandle);
      const isModularDrawer = !!hitPart.groupId && this.isModularDrawerGroup(hitPart.groupId);

      if (isHandle) {
        this.isDragging = false;
        this.isDirectPieceDrag = false;
        this.directPieceDragThresholdPassed = false;
        this.activeGizmoHit = null;

        this.ngZone.run(() => {
          this.isReferenceGuideSelected.set(false);
          if (this.selectedWallType() !== null) {
            this.selectedWallType.set(null);
            this.wallSelected.emit(null);
          }
          if (this.selectedApplianceId() !== null || this.activeSelectedApplianceIds().length > 0) {
            this.applianceSelected.emit(null);
            this.appliancesSelected.emit([]);
          }

          this.togglePartOpen(hitPart.id);

          const curIds = this.activeSelectedIds();
          if (isModularDrawer && hitPart.groupId) {
            const drawerParts = this.parts().filter(p => p.groupId === hitPart.groupId);
            const targetIds = drawerParts.length > 0 ? drawerParts.map(p => p.id) : [hitPart.id];
            const alreadyFullDrawerSelected =
              targetIds.length > 0 &&
              targetIds.every(id => curIds.includes(id)) &&
              curIds.length === targetIds.length;
            if (!alreadyFullDrawerSelected) {
              this.partsSelected.emit(targetIds);
              this.partSelected.emit(hitPart);
            }
          } else if (!curIds.includes(hitPart.id)) {
            if (hitPart.groupId) {
              const groupParts = this.parts().filter(p => p.groupId === hitPart.groupId);
              const targetIds = groupParts.length > 0 ? groupParts.map(p => p.id) : [hitPart.id];
              this.partsSelected.emit(targetIds);
            } else {
              this.partsSelected.emit([hitPart.id]);
            }
            this.partSelected.emit(hitPart);
          }
        });
        return;
      }

      if (e.shiftKey) {
        this.ngZone.run(() => this.handleShiftClickSelection(e, closest));
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const now = Date.now();
      const isDoubleClickSamePart =
        now - this.lastPieceClickTime < 350 && this.lastClickedPartId === hitPart.id;
      this.lastPieceClickTime = now;
      this.lastClickedPartId = hitPart.id;

      let partsToSelect: Part[] = [];
      const curIds = this.activeSelectedIds();
      const isAlreadySingleIsolated = curIds.length === 1 && curIds[0] === hitPart.id;
      const isCountertopUnit =
        hitPart.componentRole === 'countertop' || hitPart.componentRole === 'backsplash';

      this.ngZone.run(() => {
        this.isReferenceGuideSelected.set(false);
        if (this.selectedWallType() !== null) {
          this.selectedWallType.set(null);
          this.wallSelected.emit(null);
        }
        const keepActiveMulti = curIds.includes(hitPart.id) && curIds.length > 1;
        if (
          !keepActiveMulti &&
          (this.selectedApplianceId() !== null || this.activeSelectedApplianceIds().length > 0)
        ) {
          this.applianceSelected.emit(null);
          this.appliancesSelected.emit([]);
        }

        if (isModularDrawer && hitPart.groupId) {
          // Cajón modular indivisible: cualquier clic (simple, re-clic o doble clic) sobre cualquiera de sus piezas selecciona todo el grupo
          const groupParts = this.parts().filter(p => p.groupId === hitPart.groupId);
          partsToSelect = groupParts.length > 0 ? groupParts : [hitPart];
          this.partsSelected.emit(partsToSelect.map(p => p.id));
          this.partSelected.emit(hitPart);
        } else if (curIds.includes(hitPart.id) && curIds.length > 1) {
          partsToSelect = this.parts().filter(p => curIds.includes(p.id));
          this.partsSelected.emit(curIds);
          this.partSelected.emit(hitPart);
        } else if (isCountertopUnit) {
          partsToSelect = [hitPart];
          this.partsSelected.emit([hitPart.id]);
          this.partSelected.emit(hitPart);
        } else if (hitPart.groupId) {
          const groupParts = this.parts().filter(p => p.groupId === hitPart.groupId);
          if (
            isDoubleClickSamePart ||
            isAlreadySingleIsolated ||
            this.isInternalShelf(hitPart) ||
            this.isInternalDivider(hitPart)
          ) {
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
      const anyLocked =
        this.isPartOrGroupLocked(hitPart) || partsToSelect.some(p => this.isPartOrGroupLocked(p));
      if (anyLocked) {
        this.isDirectPieceDrag = false;
        return;
      }

      if (
        e.button === 0 &&
        (this.activeTool() === 'select' || this.activeTool() === 'move') &&
        !isHandle
      ) {
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
        this.dragInitialHostedParts = this.collectHostedPartsForDraggedParts(this.dragInitialParts);

        // Capturar también los electrodomésticos seleccionados o vinculados a los módulos arrastrados
        const targetGroupIds = new Set(
          [...this.dragInitialParts, ...this.dragInitialHostedParts].map(p => p.groupId).filter(Boolean)
        );
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
        const hitPoint = closest.intersection.point.clone();

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
      return;
    }

    this.ngZone.run(() => {
      this.isReferenceGuideSelected.set(false);
      this.selectedWallType.set(null);
      this.wallSelected.emit(null);
      this.partsSelected.emit([]);
      this.partSelected.emit(null);
      this.applianceSelected.emit(null);
      this.appliancesSelected.emit([]);
    });
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

        const partUpdates: { part: Part; updates: Partial<Part> }[] =
          this.dragInitialParts.length > 0
            ? [
                ...this.buildTranslatedPartUpdates(this.dragInitialParts, appDeltaX, appDeltaY, appDeltaZ),
                ...this.buildTranslatedPartUpdates(this.dragInitialHostedParts, appDeltaX, appDeltaY, appDeltaZ)
              ]
            : [];

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
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const cfg = this.roomConfig();
      const allWalls = getResolvedRoomWalls(cfg);
      const activeWall = allWalls.find(w => w.id === this.activeWallTarget);
      if (!activeWall || activeWall.isLocked || cfg.isWallsLocked || cfg.lockedWalls?.[activeWall.id]) {
        this.isWallDragging = false;
        return;
      }

      const { deltaX, deltaZ } = this.getWallPlaneDeltaXZ(e);
      const moveX = Math.round(deltaX / 10) * 10;
      const moveZ = Math.round(deltaZ / 10) * 10;
      this.applyLiveWallTranslation(
        activeWall,
        cfg,
        allWalls,
        this.initialWallPosX + moveX,
        this.initialWallPosZ + moveZ
      );
      return;
    }

    // Direct Wall Gizmo Dragging (Axis Translation, Edge Stretch or Height Stretch)
    if (this.isWallGizmoDragging && this.activeWallGizmoHit) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      const hit = this.activeWallGizmoHit;
      const gizmoType = hit.gizmoType || hit.type;
      const wallTarget = hit.wallTarget || hit.wallId;
      const cfg = this.roomConfig();
      const allWalls = getResolvedRoomWalls(cfg);
      const activeWall = allWalls.find(w => w.id === wallTarget);
      if (!activeWall || activeWall.isLocked || cfg.isWallsLocked || cfg.lockedWalls?.[activeWall.id]) {
        this.isWallGizmoDragging = false;
        return;
      }

      const floorW = cfg.floorWidth || 5000;
      const floorD = cfg.floorDepth || 5000;

      if (gizmoType === 'wall_move') {
        const { deltaX, deltaZ } = this.getWallPlaneDeltaXZ(e);
        const moveX = Math.round(deltaX / 10) * 10;
        const moveZ = Math.round(deltaZ / 10) * 10;
        const candX = hit.axis === 'x' ? this.initialWallPosX + moveX : this.initialWallPosX;
        const candZ = hit.axis === 'z' ? this.initialWallPosZ + moveZ : this.initialWallPosZ;
        this.applyLiveWallTranslation(activeWall, cfg, allWalls, candX, candZ);
      } else if (gizmoType === 'wall_stretch') {
        const endSign: 1 | -1 = this.activeWallStretchEndSign;
        const rotRad = -((activeWall.rotationY || 0) * Math.PI) / 180;
        const cosR = Math.cos(rotRad);
        const sinR = Math.sin(rotRad);
        const { deltaX, deltaZ } = this.getWallPlaneDeltaXZ(e);
        const proj = (deltaX * cosR - deltaZ * sinR) * endSign;

        const anchorX = this.initialWallPosX - endSign * (this.initialWallLength / 2) * cosR;
        const anchorZ = this.initialWallPosZ + endSign * (this.initialWallLength / 2) * sinR;

        const dirX = endSign * cosR;
        const dirZ = -endSign * sinR;
        const wallThick = activeWall.thickness || cfg.wallThickness || 150;
        const halfThickX = Math.abs(sinR) * (wallThick / 2);
        const halfThickZ = Math.abs(cosR) * (wallThick / 2);
        const minFloorX = -(floorW / 2) + halfThickX;
        const maxFloorX = (floorW / 2) - halfThickX;
        const minFloorZ = -(floorD / 2) + halfThickZ;
        const maxFloorZ = (floorD / 2) - halfThickZ;

        let maxAllowableLength = Infinity;
        if (dirX > 1e-6) {
          maxAllowableLength = Math.min(maxAllowableLength, (maxFloorX - anchorX) / dirX);
        } else if (dirX < -1e-6) {
          maxAllowableLength = Math.min(maxAllowableLength, (minFloorX - anchorX) / dirX);
        }
        if (dirZ > 1e-6) {
          maxAllowableLength = Math.min(maxAllowableLength, (maxFloorZ - anchorZ) / dirZ);
        } else if (dirZ < -1e-6) {
          maxAllowableLength = Math.min(maxAllowableLength, (minFloorZ - anchorZ) / dirZ);
        }
        if (!Number.isFinite(maxAllowableLength)) {
          maxAllowableLength = Math.max(floorW, floorD);
        }
        maxAllowableLength = Math.max(400, Math.floor(maxAllowableLength + 1e-6));

        const stretch = Math.round(proj / 10) * 10;
        const nextL = Math.round(Math.max(400, Math.min(maxAllowableLength, this.initialWallLength + stretch)) * 100) / 100;
        const actualDeltaL = nextL - this.initialWallLength;
        const nextPosX = Math.round((this.initialWallPosX + endSign * (actualDeltaL / 2) * cosR) * 100) / 100;
        const nextPosZ = Math.round((this.initialWallPosZ - endSign * (actualDeltaL / 2) * sinR) * 100) / 100;

        this.pendingWallUpdates = {
          wallId: activeWall.id,
          updates: { length: nextL, posX: nextPosX, posZ: nextPosZ }
        };
        this.updateLiveWallGeometryAndGizmo(activeWall, {
          length: nextL,
          posX: nextPosX,
          posZ: nextPosZ
        });
        this.requestRender(2);
      } else if (gizmoType === 'wall_stretch_height') {
        let deltaY = 0;
        const canIntersectHeight = Math.abs(this.raycaster.ray.direction.dot(this.wallHeightDragPlane.normal)) > 0.05;
        if (canIntersectHeight && this.raycaster.ray.intersectPlane(this.wallHeightDragPlane, this.scratchCurrentIntersection)) {
          deltaY = this.scratchCurrentIntersection.y - this.wallHeightDragStartPoint.y;
        } else {
          deltaY = -(e.clientY - this.dragStartPointer.y) * 2.0;
        }
        const stretchY = Math.round(deltaY / 10) * 10;
        const nextH = Math.max(400, Math.min(4500, this.initialWallHeight + stretchY));

        this.pendingWallUpdates = { wallId: activeWall.id, updates: { height: nextH } };
        this.updateLiveWallGeometryAndGizmo(activeWall, { height: nextH });
        this.requestRender(2);
      }
      return;
    }

    // 0.05. Measurement Tape Closest-Surface Magnetic Snapping & Live Preview
    if (this.isMeasureMode()) {
      this.lastMeasurePointerClient = { x: e.clientX, y: e.clientY };

      const isOrbitDragging =
        (e.buttons & 2) !== 0 ||
        (!!this.measurePointerDownPos &&
          (e.buttons & 1) !== 0 &&
          !this.tapeMeasure.isClickWithinThreshold(
            this.measurePointerDownPos.x,
            this.measurePointerDownPos.y,
            e.clientX,
            e.clientY,
            CLICK_DRAG_THRESHOLD_PX
          ));

      if (isOrbitDragging) {
        this.updateMagneticSnapIndicator(null);
        return;
      }

      const snapCand = this.findMeasureSnapCandidateAt(e.clientX, e.clientY);
      this.updateMagneticSnapIndicator(snapCand);

      const activeA = this.measurePointA();
      if (activeA) {
        const rawPoint = snapCand
          ? { x: snapCand.worldPos.x, y: snapCand.worldPos.y, z: snapCand.worldPos.z }
          : this.resolveMeasureFallbackPlanePoint(e.clientX, e.clientY, activeA);

        if (rawPoint) {
          this.lastRawMeasurePointB = rawPoint;
          const resolved = this.resolveMeasurementPointB(rawPoint, e.shiftKey, e.clientX, e.clientY);
          const syncPreview = () => {
            this.measurePointB.set(resolved.pointB);
            this.activeInferredAxis.set(resolved.axisLock);
            this.renderMeasurementVisuals();
            this.updateProjectedMeasureBadges();
          };
          if (NgZone.isInAngularZone()) {
            syncPreview();
          } else {
            this.ngZone.run(syncPreview);
          }
        }
      }
      return;
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
          if (this.dragInitialParts.length > 1 || this.dragInitialHostedParts.length > 0) {
            const combinedDraggedParts = this.getCombinedDraggedParts();
            // Calcular cota inferior inicial del grupo completo (y sus cajones alojados) para no atravesar el piso (Y = 0)
            const initialGrpMinY = this.getPartsMinY(combinedDraggedParts);
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

            if (
              this.dragInitialHostedParts.length === 0 &&
              this.isMagneticSnap() &&
              this.trySmartFitDrawerGroupOnDrag(e, { dx: deltaX, dy: deltaY, dz: deltaZ })
            ) {
              return;
            }

            if (this.isMagneticSnap()) {
              const externalParts = this.getExternalPartsForDrag(combinedDraggedParts);
              if (externalParts.length > 0) {
                const groupSnap = this.calculateGroupMagneticSnap(
                  combinedDraggedParts,
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
                const wallBounds = this.computeTranslatedBoundsForParts(combinedDraggedParts, deltaX, deltaY, deltaZ);
                const wallSnap = this.calculateWallSnap(wallBounds, 45);

                if (hit.axis === 'z' && wallSnap.isSnappedZ) {
                  deltaZ += wallSnap.deltaZ;
                }
                if (hit.axis === 'x' && wallSnap.isSnappedX) {
                  deltaX += wallSnap.deltaX;
                }

                if (wallSnap.isSnappedX || wallSnap.isSnappedZ) {
                  this.lastSnappedWallResult = wallSnap;
                  deltaY = this.applyWallAutoElevation(deltaY, initialGrpMinY);
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

            const updatesList = this.buildTranslatedPartUpdates(this.dragInitialParts, deltaX, deltaY, deltaZ);
            const hostedUpdatesList = this.buildTranslatedPartUpdates(
              this.dragInitialHostedParts,
              deltaX,
              deltaY,
              deltaZ
            );

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
            this.previewPartUpdatesInPlace([...updatesList, ...hostedUpdatesList], appUpdatesList);
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

          if (this.dragInitialParts.length > 1 || this.dragInitialHostedParts.length > 0) {
            const combinedDraggedParts = this.getCombinedDraggedParts();
            // Calcular la base inferior más baja del grupo/módulo (y sus cajones alojados) para impedir que atraviese el suelo (Y = 0)
            const initialGrpMinY = this.getPartsMinY(combinedDraggedParts);
            const minAllowedDy = -initialGrpMinY;

            let effDx = dx;
            let effDy = Math.max(minAllowedDy, dy);
            let effDz = dz;

            if (
              this.dragInitialHostedParts.length === 0 &&
              this.isMagneticSnap() &&
              this.trySmartFitDrawerGroupOnDrag(e, { dx: effDx, dy: effDy, dz: effDz })
            ) {
              return;
            }

            if (this.isMagneticSnap()) {
              // 1. Imán inteligente entre este módulo/grupo y cualquier otra pieza o módulo externo
              const externalParts = this.getExternalPartsForDrag(combinedDraggedParts);
              let groupSnapped = false;
              if (externalParts.length > 0) {
                const groupSnap = this.calculateGroupMagneticSnap(
                  combinedDraggedParts,
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
                const wallBounds = this.computeTranslatedBoundsForParts(combinedDraggedParts, effDx, effDy, effDz);
                const wallSnap = this.calculateWallSnap(wallBounds, 45);

                if (wallSnap.isSnappedZ) {
                  effDz += wallSnap.deltaZ;
                }
                if (wallSnap.isSnappedX) {
                  effDx += wallSnap.deltaX;
                }

                if (wallSnap.isSnappedX || wallSnap.isSnappedZ) {
                  this.lastSnappedWallResult = wallSnap;
                  effDy = this.applyWallAutoElevation(effDy, initialGrpMinY);
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

            const updatesList = this.buildTranslatedPartUpdates(this.dragInitialParts, effDx, effDy, effDz);
            const hostedUpdatesList = this.buildTranslatedPartUpdates(
              this.dragInitialHostedParts,
              effDx,
              effDy,
              effDz
            );

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
            this.previewPartUpdatesInPlace([...updatesList, ...hostedUpdatesList], appUpdatesList);
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
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)
    ) {
      this.setHoveredDimensionSprite(null);
      return;
    }
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Hover feedback for 3D Editable Dimension Badges
    if (this.editableDimensionSprites.length > 0) {
      const visibleDimSprites = this.editableDimensionSprites.filter(sprite =>
        this.isObjectAndAncestorsVisible(sprite)
      );
      const dimIntersects = visibleDimSprites.length > 0
        ? this.raycaster.intersectObjects(visibleDimSprites, false)
        : [];
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
      const gizmoIntersects = this.sceneRaycastPicker.intersectPriorityHandles(
        this.raycaster,
        this.gizmoHitMeshes,
        true
      );
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
      const wallGizmoIntersects = this.sceneRaycastPicker.intersectPriorityHandles(
        this.raycaster,
        this.wallGizmoHitMeshes,
        true
      );
      if (wallGizmoIntersects.length > 0) {
        const hit = wallGizmoIntersects[0].object.userData as { type?: string; gizmoType?: string };
        const gType = hit.gizmoType || hit.type;
        if (gType === 'wall_stretch_height') {
          canvas.style.cursor = 'ns-resize';
        } else if (gType === 'wall_stretch') {
          canvas.style.cursor = 'ew-resize';
        } else {
          canvas.style.cursor = 'grab';
        }
        return;
      }
    }

    // Hover feedback for 3D appliance resize handles
    if (this.applianceHandleHitMeshes.length > 0) {
      const handleIntersects = this.sceneRaycastPicker.intersectPriorityHandles(
        this.raycaster,
        this.applianceHandleHitMeshes,
        true
      );
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

    // Unified closest-distance-wins Priority 2 hover feedback
    const scenePick = this.sceneRaycastPicker.pickClosestSceneCandidate(
      this.raycaster,
      this.buildSceneRaycastSources()
    );
    const closest = scenePick.closest;
    if (!closest) {
      canvas.style.cursor = 'default';
      return;
    }

    if (closest.kind === 'appliance') {
      canvas.style.cursor = this.isApplianceLocked(closest.appliance) ? 'pointer' : 'grab';
      return;
    }

    if (closest.kind === 'reference_guide') {
      canvas.style.cursor = 'grab';
      return;
    }

    if (closest.kind === 'wall') {
      const wId = closest.wallId;
      const cfg = this.roomConfig();
      const wall = wId ? getResolvedRoomWalls(cfg).find(w => w.id === wId) : undefined;
      const isLocked = !wall || !!cfg.isWallsLocked || !!wall.isLocked || !!cfg.lockedWalls?.[wall.id];
      canvas.style.cursor = isLocked ? 'pointer' : 'grab';
      return;
    }

    const topPart = closest.part;
    const isSelected = topPart && this.activeSelectedIds().includes(topPart.id);
    if (this.activeTool() === 'move' || isSelected) {
      canvas.style.cursor = 'grab';
    } else {
      canvas.style.cursor = 'pointer';
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
    let anyDimensionChanged = false;

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
      item.halfHeightY = b.sy / 2;

      if (item.doorPivot) {
        item.doorPivot.position.x += dx;
        item.doorPivot.position.y += dy;
        item.doorPivot.position.z += dz;
        if (item.doorPivotOriginalPos) {
          item.doorPivotOriginalPos.x += dx;
          item.doorPivotOriginalPos.y += dy;
          item.doorPivotOriginalPos.z += dz;
        }
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
        anyDimensionChanged = true;
        const localDims = this.partGeometry.getLocalDimensions(updatedPart);
        const { geometry: newBoxGeo, edges: newEdgesGeo } = this.buildPartGeometryAndEdges(
          updatedPart,
          localDims
        );

        item.mesh.geometry = newBoxGeo;
        for (const child of item.mesh.children) {
          if (child instanceof THREE.LineSegments && child.userData?.['isOutline']) {
            child.geometry = newEdgesGeo;
          }
        }
        const hw = updatedPart.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(updatedPart);
        const isCol = untracked(() => this.detectedCollisions()).some(
          c => c.partAId === updatedPart.id || c.partBId === updatedPart.id
        );
        this.attachPartDetailVisuals(
          item.mesh,
          updatedPart,
          hw,
          localDims,
          untracked(() => this.isXRay()),
          isCol
        );
        if (partUpdates.length === 1) {
          singleStretchedPart = { part: updatedPart, px: b.px, py: b.py, pz: b.pz, sx: b.sx, sy: b.sy, sz: b.sz };
        }
      } else if (partUpdates.length === 1) {
        singleMovedDelta = this.scratchSingleMovedDelta.set(dx, dy, dz);
      }

      if (
        entry.updates.grain !== undefined ||
        entry.updates.materialId !== undefined ||
        entry.updates.colorHex !== undefined
      ) {
        const isSel = untracked(() => this.activeSelectedIds()).includes(updatedPart.id);
        const isCol = untracked(() => this.detectedCollisions()).some(
          c => c.partAId === updatedPart.id || c.partBId === updatedPart.id
        );
        const xRayActive = untracked(() => this.isXRay());
        item.mesh.material = this.createPieceMaterial(
          updatedPart,
          isSel,
          untracked(() => this.materials()),
          xRayActive,
          isCol
        );
        this.refreshPartDetailMaterials(item.mesh, xRayActive, isCol);
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

    const activeExplodedPercent = untracked(() => this.explodedPercent());
    if (activeExplodedPercent > 0 && partUpdates.length > 0) {
      this.updateExplodedOffsets(activeExplodedPercent);
    }

    // Sincronizar marco CAD exterior de módulo seleccionado (`selectionOutlineGroup`) durante arrastre en vivo
    if (partUpdates.length > 0) {
      if (anyDimensionChanged || activeExplodedPercent > 0) {
        this.updateSelectionOutlineGroup(untracked(() => this.activeSelectedIds()));
      } else if (this.selectionOutlineGroup.children.length > 0) {
        const outlineGroupIds = new Set(
          this.selectionOutlineGroup.children
            .map(c => c.userData?.['groupId'] as string | undefined)
            .filter((id): id is string => Boolean(id))
        );
        const outlineEntry = partUpdates.find(
          entry => Boolean(entry.part.groupId) && outlineGroupIds.has(entry.part.groupId as string)
        );
        if (outlineEntry) {
          const initB = this.getPartBounds(outlineEntry.part);
          const nextB = this.getPartBounds({ ...outlineEntry.part, ...outlineEntry.updates });
          this.selectionOutlineGroup.position.set(
            nextB.px - initB.px,
            nextB.py - initB.py,
            nextB.pz - initB.pz
          );
          this.selectionOutlineGroup.updateMatrixWorld(true);
        }
      }

      // BUG 1.2: Acompañamiento en tiempo real del resaltado de zona (`zoneHighlightGroup`) al arrastrar el módulo
      const activeZoneGroupId = this.zoneBuilderGroupId();
      if (
        !anyDimensionChanged &&
        activeZoneGroupId &&
        this.zoneHighlightGroup.visible &&
        this.zoneHighlightGroup.children.length > 0
      ) {
        const zoneEntry = partUpdates.find(entry => entry.part.groupId === activeZoneGroupId);
        if (zoneEntry) {
          const initB = this.getPartBounds(zoneEntry.part);
          const nextB = this.getPartBounds({ ...zoneEntry.part, ...zoneEntry.updates });
          this.zoneHighlightGroup.position.set(
            nextB.px - initB.px,
            nextB.py - initB.py,
            nextB.pz - initB.pz
          );
          this.zoneHighlightGroup.updateMatrixWorld(true);
        }
      }
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

    const matricesToSync: THREE.Object3D[] = [];
    if (partUpdates.length > 0) {
      matricesToSync.push(this.furnitureGroup);
    }
    if (primaryAppUpdate || appUpdates.length > 0) {
      matricesToSync.push(this.appliancesGroup);
    }
    if (matricesToSync.length > 0) {
      this.sceneRaycastPicker.refreshPickableMatricesAndBounds(matricesToSync, {
        forceRecomputeBounds: anyDimensionChanged
      });
    }
    if (partUpdates.length > 0 && this.gizmoGroup.children.length > 0) {
      this.gizmoGroup.updateMatrixWorld(true);
    }
    if ((primaryAppUpdate || appUpdates.length > 0) && this.applianceGizmoGroup.children.length > 0) {
      this.applianceGizmoGroup.updateMatrixWorld(true);
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
    this.internalClearanceGroup.position.set(0, 0, 0);

    const layout = this.dimensionAnchor.computeDrawerCavitySegments({
      minY: cavity.minY,
      maxY: cavity.maxY,
      innerWidth: cavity.innerWidth,
      centerX: cavity.centerX,
      centerZ: cavity.centerZ,
      frontEdgeCoord: cavity.frontEdgeCoord,
      facingDirection: cavity.facingDirection,
      drawerMinY,
      drawerMaxY
    });
    const zeroLabelOffset = new THREE.Vector3(0, 0, 0);

    // Luz Superior
    if (layout.topLine) {
      this.appendDimensionSegmentVisuals(
        this.internalClearanceGroup,
        layout.topLine,
        this.internalClearanceLineMat,
        this.internalClearanceTickMat,
        true
      );
      const badge = this.createInternalClearanceBadge(`Luz Sup: ${layout.topClearance} mm`, false, false);
      badge.position.copy(layout.topLine.midpoint);
      badge.renderOrder = DIMENSION_SPRITE_RENDER_ORDER;
      badge.userData = {
        ...badge.userData,
        isCota: true,
        isAuxiliaryVisual: true,
        baseScaleX: 140,
        baseScaleY: 38,
        edgeP1: layout.topLine.p1.clone(),
        edgeP2: layout.topLine.p2.clone(),
        labelOffset: zeroLabelOffset.clone()
      };
      this.internalClearanceGroup.add(badge);
    }

    // Luz Inferior
    if (layout.bottomLine) {
      this.appendDimensionSegmentVisuals(
        this.internalClearanceGroup,
        layout.bottomLine,
        this.internalClearanceLineMat,
        this.internalClearanceTickMat,
        true
      );
      const badge = this.createInternalClearanceBadge(`Luz Inf: ${layout.bottomClearance} mm`, false, false);
      badge.position.copy(layout.bottomLine.midpoint);
      badge.renderOrder = DIMENSION_SPRITE_RENDER_ORDER;
      badge.userData = {
        ...badge.userData,
        isCota: true,
        isAuxiliaryVisual: true,
        baseScaleX: 140,
        baseScaleY: 38,
        edgeP1: layout.bottomLine.p1.clone(),
        edgeP2: layout.bottomLine.p2.clone(),
        labelOffset: zeroLabelOffset.clone()
      };
      this.internalClearanceGroup.add(badge);
    }

    // Cota y Etiqueta de Ancho de Hueco Auto-Encajado (0.0 mm offset sobre frontEdgeCoord)
    if (layout.widthLine) {
      this.appendDimensionSegmentVisuals(
        this.internalClearanceGroup,
        layout.widthLine,
        this.internalClearanceLineMat,
        this.internalClearanceTickMat,
        true
      );
    }
    const widthBadge = this.createInternalClearanceBadge(
      `Hueco: ${Math.round(cavity.innerWidth)} mm`,
      true,
      false
    );
    widthBadge.position.copy(layout.widthMidpoint);
    widthBadge.renderOrder = DIMENSION_SPRITE_RENDER_ORDER;
    widthBadge.userData = {
      ...widthBadge.userData,
      isCota: true,
      isAuxiliaryVisual: true,
      baseScaleX: 155,
      baseScaleY: 38,
      ...(layout.widthLine
        ? {
            edgeP1: layout.widthLine.p1.clone(),
            edgeP2: layout.widthLine.p2.clone(),
            labelOffset: zeroLabelOffset.clone()
          }
        : {})
    };
    this.internalClearanceGroup.add(widthBadge);

    this.internalClearanceGroup.updateMatrixWorld(true);
    this.updateAdaptiveGizmoScale();

    this.ngZone.run(() => {
      this.clearanceCalculated.emit({
        topClearance: layout.topClearance,
        bottomClearance: layout.bottomClearance,
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
    this.selectionOutlineGroup.position.set(0, 0, 0);
    this.zoneHighlightGroup.position.set(0, 0, 0);

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

    if (this.isMeasureMode()) {
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) canvas.style.cursor = 'crosshair';
      if (this.controls) {
        this.controls.enabled = true;
      }

      if (!e) {
        this.measurePointerDownPos = null;
        return;
      }

      if (e.button === 2) {
        if (this.measurePointA()) {
          const isStationaryRightClick = this.rightPointerDownPos
            ? this.tapeMeasure.isClickWithinThreshold(
                this.rightPointerDownPos.x,
                this.rightPointerDownPos.y,
                e.clientX,
                e.clientY,
                CLICK_DRAG_THRESHOLD_PX
              )
            : !this.rightPointerDragged;

          if (isStationaryRightClick) {
            this.suppressNextContextMenuForMeasureCancel = true;
            this.rightPointerDownPos = null;
            this.rightPointerDragged = false;
            const cancelFn = () => this.cancelActiveMeasurementTrace();
            if (NgZone.isInAngularZone()) {
              cancelFn();
            } else {
              this.ngZone.run(cancelFn);
            }
            e.preventDefault();
            e.stopPropagation();
          }
        }
        return;
      }

      if (e.button !== 0) {
        return;
      }

      const downPos = this.measurePointerDownPos;
      this.measurePointerDownPos = null;
      if (!downPos) {
        return;
      }

      const isClick = this.tapeMeasure.isClickWithinThreshold(
        downPos.x,
        downPos.y,
        e.clientX,
        e.clientY,
        CLICK_DRAG_THRESHOLD_PX
      );
      if (!isClick) {
        // Drag > 5px: camera orbit/pan gesture — preserve active Point A and all savedMeasurements
        return;
      }

      this.lastMeasurePointerClient = { x: e.clientX, y: e.clientY };
      const snapCand = this.findMeasureSnapCandidateAt(e.clientX, e.clientY);
      const activeA = this.measurePointA();

      const commitMeasureClick = () => {
        if (!activeA) {
          if (!snapCand) {
            this.updateMagneticSnapIndicator(null);
            return;
          }
          const ptA: Point3D = {
            x: Math.round(snapCand.worldPos.x),
            y: Math.round(snapCand.worldPos.y),
            z: Math.round(snapCand.worldPos.z)
          };
          this.measurePointA.set(ptA);
          this.measurePointB.set(null);
          this.lastRawMeasurePointB = null;
          this.activeInferredAxis.set(null);
          this.renderMeasurementVisuals();
          this.updateProjectedMeasureBadges();
          return;
        }

        const rawPoint: Point3D | null = snapCand
          ? { x: snapCand.worldPos.x, y: snapCand.worldPos.y, z: snapCand.worldPos.z }
          : (this.resolveMeasureFallbackPlanePoint(e.clientX, e.clientY, activeA) ??
            this.lastRawMeasurePointB ??
            this.measurePointB());

        if (!rawPoint) return;

        const resolved = this.resolveMeasurementPointB(rawPoint, e.shiftKey, e.clientX, e.clientY);
        const dist = Math.hypot(
          resolved.pointB.x - activeA.x,
          resolved.pointB.y - activeA.y,
          resolved.pointB.z - activeA.z
        );
        if (dist < 0.5) return;

        const saved = this.tapeMeasure.buildSavedMeasurement(activeA, resolved.pointB, resolved.axisLock);
        this.savedMeasurements.update(list => [...list, saved]);
        this.measurePointA.set(null);
        this.measurePointB.set(null);
        this.lastRawMeasurePointB = null;
        this.activeInferredAxis.set(null);
        this.updateMagneticSnapIndicator(null);
        this.renderMeasurementVisuals();
        this.updateProjectedMeasureBadges();
      };

      if (NgZone.isInAngularZone()) {
        commitMeasureClick();
      } else {
        this.ngZone.run(commitMeasureClick);
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
      this.selectionOutlineGroup.position.set(0, 0, 0);
      this.zoneHighlightGroup.position.set(0, 0, 0);
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
      this.dragInitialHostedParts = [];
      this.controls.enabled = true;
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) {
        canvas.style.cursor = 'default';
      }
    }

    if (this.isWallDragging || this.isWallGizmoDragging) {
      const committedUpdate = this.pendingWallUpdates;
      this.pendingWallUpdates = null;
      this.isWallDragging = false;
      this.isWallGizmoDragging = false;
      this.activeWallTarget = null;
      this.activeWallGizmoHit = null;
      this.activeWallStretchEndSign = 1;
      this.clearWallSnapGuides();
      this.controls.enabled = true;
      const canvas = this.canvasRef()?.nativeElement;
      if (canvas) canvas.style.cursor = 'default';

      if (committedUpdate) {
        const { wallId, updates } = committedUpdate;
        const cfg = this.roomConfig();
        const allWalls = getResolvedRoomWalls(cfg);
        const updatedWalls = allWalls.map(w => w.id === wallId ? { ...w, ...updates } : w);
        this.ngZone.run(() => {
          this.roomConfigModified.emit({ walls: updatedWalls, recordHistory: true });
        });
      }
    }

    if (this.isDragging) {
      this.commitLiveDragUpdates();
      this.selectionOutlineGroup.position.set(0, 0, 0);
      this.zoneHighlightGroup.position.set(0, 0, 0);
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
      this.dragInitialParts = [];
      this.dragInitialHostedParts = [];
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
      this.selectionOutlineGroup.position.set(0, 0, 0);
      this.zoneHighlightGroup.position.set(0, 0, 0);
      this.isApplianceDragging = false;
      this.draggingAppliance = null;
      this.dragInitialParts = [];
      this.dragInitialHostedParts = [];
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
      if (this.controls) {
        this.controls.enabled = true;
      }
    } else {
      this.isMeasureMode.set(false);
      this.cancelActiveMeasurementTrace();
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
      canvas.style.cursor = tool === 'measure' ? 'crosshair' : 'default';
    }
    this.requestRender(6);
  }

  private updatePushPullHover(e: PointerEvent) {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.camera || this.isPushPulling) return;

    const rect = canvas.getBoundingClientRect();
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)
    ) {
      return;
    }
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

  readonly isContextMenuParametricModule = computed<boolean>(() => {
    const grp = this.contextMenuGroup();
    if (!grp) return false;
    const grpParts = this.getPartsForGroup(grp.id);
    return hasReliableParametricRecipe(grp, grpParts);
  });

  readonly isContextMenuDrawerGroup = computed<boolean>(() => {
    const grp = this.contextMenuGroup();
    if (!grp) return false;
    if (this.isContextMenuParametricModule()) return false;
    const grpParts = this.getPartsForGroup(grp.id);
    return (
      grp.type === 'drawer' ||
      grp.subType === 'drawer' ||
      grp.templateId === 'modular_drawer' ||
      isStandaloneModularDrawerGroup(grp, grpParts)
    );
  });

  readonly contextMenuGroupBounds = computed(() =>
    this.computeGroupBounds(this.contextMenuGroup())
  );

  readonly contextMenuBoardMaterials = computed<Material[]>(() => {
    const inputMats = this.materials();
    const source = inputMats.length > 0 ? inputMats : MELAMINE_MATERIALS_CATALOG;
    const nonStone = source.filter(m => !isCountertopMaterial(m));
    const boardsOnly = nonStone.filter(
      m => m.family !== 'mdf_back' && m.category !== 'mdf'
    );
    return boardsOnly.length > 0 ? boardsOnly : nonStone;
  });

  private isBlindFixedPanelPart(part: Part): boolean {
    return (part.name || '').toUpperCase().includes('PANEL CIEGO');
  }

  private isSlidingDoorPart(part: Part): boolean {
    if (part.componentRole === 'accessory' || part.hardwareConfig?.movableType === 'none') {
      return false;
    }
    const nameUp = (part.name || '').toUpperCase();
    const idLower = (part.id || '').toLowerCase();
    const notesLow = (part.notes || '').toLowerCase();
    return (
      idLower.includes('puerta_corr_') ||
      nameUp.includes('CORREDIZA') ||
      notesLow.includes('corrediz') ||
      Boolean(part.hardwareConfig?.slidingLeavesCount)
    );
  }

  readonly contextMenuGroupHasDoors = computed<boolean>(() => {
    const grp = this.contextMenuGroup();
    if (!grp) return false;
    return this.getPartsForGroup(grp.id).some(
      p =>
        !this.isBlindFixedPanelPart(p) &&
        (p.componentRole === 'door' || p.hardwareConfig?.movableType === 'door')
    );
  });

  readonly contextMenuGroupHasHingedDoors = computed<boolean>(() => {
    const grp = this.contextMenuGroup();
    if (!grp) return false;
    return this.getPartsForGroup(grp.id).some(
      p =>
        !this.isBlindFixedPanelPart(p) &&
        (p.componentRole === 'door' || p.hardwareConfig?.movableType === 'door') &&
        !this.isSlidingDoorPart(p)
    );
  });

  readonly contextMenuGroupHasDrawers = computed<boolean>(() => {
    const grp = this.contextMenuGroup();
    if (!grp) return false;
    return this.getPartsForGroup(grp.id).some(
      p => p.componentRole === 'drawer_front' || p.hardwareConfig?.movableType === 'drawer'
    );
  });

  readonly contextMenuGroupHasMovableFronts = computed<boolean>(() => {
    return this.contextMenuGroupHasDoors() || this.contextMenuGroupHasDrawers();
  });

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
    return this.isContextMenuParametricModule();
  });

  readonly contextMenuCategory = computed<'drawer' | 'door' | 'structural'>(() => {
    const part = this.contextMenuPart();
    if (!part) return 'structural';

    if (this.isContextMenuDrawerGroup()) {
      return 'drawer';
    }

    const nameUpper = part.name.toUpperCase();
    const isCarcassStructuralRole = this.isCarcassStructurePart(part);
    const isDrawerPart =
      (!isCarcassStructuralRole || part.hardwareConfig?.movableType === 'drawer') &&
      (part.componentRole === 'drawer_front' ||
        part.componentRole === 'drawer_box' ||
        part.componentRole === 'drawer_lateral' ||
        part.componentRole === 'drawer_bottom' ||
        part.hardwareConfig?.movableType === 'drawer' ||
        nameUpper.includes('CAJON') ||
        nameUpper.includes('CAJÓN') ||
        nameUpper.includes('GAVETA') ||
        part.id.includes('caj_'));

    if (isDrawerPart) {
      return 'drawer';
    }

    const isDoorPart =
      (!this.isExplicitNonDoorRole(part.componentRole) || part.hardwareConfig?.movableType === 'door') &&
      (part.componentRole === 'door' ||
        part.hardwareConfig?.movableType === 'door' ||
        nameUpper.includes('PUERTA') ||
        nameUpper.includes('BASCULANTE') ||
        nameUpper.includes('ELEVABLE'));

    if (isDoorPart) {
      return 'door';
    }

    return 'structural';
  });

  readonly contextMenuPartIsAnimatableInSingleMode = computed<boolean>(() => {
    const part = this.contextMenuPart();
    if (!part) return false;
    const cat = this.contextMenuCategory();
    return cat === 'door' || cat === 'drawer';
  });

  /**
   * Si el usuario hizo clic derecho sobre un lateral, trasera o fondo de un cajón,
   * devuelve automáticamente la pieza del Frente Vista de ese cajón para aplicarle el tirador, corredera o apertura.
   */
  readonly contextMenuEffectiveFrontPart = computed<Part | null>(() => {
    const part = this.contextMenuPart();
    if (!part) return null;
    if (this.contextMenuCategory() !== 'drawer') return part;

    if (part.componentRole === 'drawer_front' || part.name.toUpperCase().includes('FRENTE')) {
      return part;
    }

    const allParts = this.parts();
    const specificPrefix = this.extractEmbeddedDrawerPrefix(part.id);
    if (specificPrefix) {
      const foundFront = allParts.find(
        p =>
          (!part.groupId || p.groupId === part.groupId) &&
          (p.id.startsWith(specificPrefix + '_') ||
            p.id.includes(specificPrefix + '_') ||
            p.id === specificPrefix) &&
          (p.componentRole === 'drawer_front' || p.id.includes('_frente'))
      );
      if (foundFront) return foundFront;
    }

    if (part.groupId && this.isContextMenuDrawerGroup()) {
      const groupFront = allParts.find(
        p =>
          p.groupId === part.groupId &&
          (p.componentRole === 'drawer_front' ||
            p.id.includes('_frente') ||
            p.name.toUpperCase().includes('FRENTE'))
      );
      if (groupFront) return groupFront;
    }

    return part;
  });

  onContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (this.suppressNextContextMenuForMeasureCancel) {
      this.suppressNextContextMenuForMeasureCancel = false;
      this.rightPointerDownPos = null;
      this.rightPointerDragged = false;
      return;
    }

    const duration = Date.now() - this.rightPointerDownTime;
    const wasDragged = this.rightPointerDragged;
    this.rightPointerDownPos = null;
    this.rightPointerDragged = false;
    if (wasDragged || duration > 300) {
      return;
    }

    if (this.isMeasureMode() && this.measurePointA()) {
      this.cancelActiveMeasurementTrace();
      return;
    }

    const canvas = this.canvasRef()?.nativeElement;
    const container = this.containerRef()?.nativeElement;
    if (!canvas || !container || !this.camera) return;

    const rect = canvas.getBoundingClientRect();

    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 1. Selección unificada por distancia mínima (el elemento en primer plano siempre prevalece)
    const scenePick = this.sceneRaycastPicker.pickClosestSceneCandidate(
      this.raycaster,
      this.buildSceneRaycastSources()
    );
    const closest = scenePick.closest;

    if (closest?.kind === 'appliance' && closest.appliance) {
      const foundApp = closest.appliance;
      this.isReferenceGuideSelected.set(false);
      if (this.selectedWallType() !== null) {
        this.selectedWallType.set(null);
        this.wallSelected.emit(null);
      }
      this.contextMenuAppliance.set(foundApp);
      this.contextMenuPart.set(null);
      this.applianceSelected.emit(foundApp);
      this.appliancesSelected.emit([foundApp.id]);
      this.partsSelected.emit([]);
      this.partSelected.emit(null);
      this.openContextMenuAtCursor(e.clientX, e.clientY);
      return;
    }

    if ((closest?.kind === 'piece' || closest?.kind === 'drill_hole') && closest.part) {
      const part = closest.part;
      this.isReferenceGuideSelected.set(false);
      if (this.selectedWallType() !== null) {
        this.selectedWallType.set(null);
        this.wallSelected.emit(null);
      }
      if (this.selectedApplianceId() !== null || this.activeSelectedApplianceIds().length > 0) {
        this.applianceSelected.emit(null);
        this.appliancesSelected.emit([]);
      }
      this.contextMenuAppliance.set(null);
      this.contextMenuPart.set(part);
      this.contextMenuHandleFinishOverride.set(null);

      const curIds = this.activeSelectedIds();
      const isAlreadySingleIsolated = curIds.length === 1 && curIds[0] === part.id;
      const grp = part.groupId ? (this.partGroups().find(g => g.id === part.groupId) || null) : null;
      const grpParts = part.groupId ? this.parts().filter(p => p.groupId === part.groupId) : [];
      const isParametric = !!grp && hasReliableParametricRecipe(grp, grpParts);
      const isModularDrawer = !!part.groupId && this.isModularDrawerGroup(part.groupId);

      if (part.groupId && (isParametric || isModularDrawer || !isAlreadySingleIsolated)) {
        if (grpParts.length > 1) {
          this.contextMenuMode.set('group');
          this.partsSelected.emit(grpParts.map(p => p.id));
          this.partSelected.emit(part);
          this.applyMaterialToWholeGroup.set(true);
        } else {
          this.contextMenuMode.set(grp ? 'group' : 'part');
          this.partsSelected.emit([part.id]);
          this.partSelected.emit(part);
          this.applyMaterialToWholeGroup.set(false);
        }
      } else {
        this.contextMenuMode.set('part');
        this.partsSelected.emit([part.id]);
        this.partSelected.emit(part);
        this.applyMaterialToWholeGroup.set(false);
      }

      this.openContextMenuAtCursor(e.clientX, e.clientY);
      return;
    }

    // Clicked empty canvas space (or non-part foreground blocker such as wall / reference guide)
    this.contextMenuAppliance.set(null);
    this.contextMenuPart.set(null);
    this.openContextMenuAtCursor(e.clientX, e.clientY);
  }

  /** Recalcula la posición del menú contextual usando las dimensiones medidas en el DOM. */
  repositionContextMenuToViewport(): void {
    if (!this.contextMenuPos() || !this.contextMenuRawCursor) {
      return;
    }
    const panelEl = this.contextMenuPanelRef()?.nativeElement;
    const rect = panelEl?.getBoundingClientRect();
    const measuredWidth = rect && rect.width > 0 ? rect.width : undefined;
    const measuredHeight = rect && rect.height > 0 ? rect.height : undefined;
    this.applySmartContextMenuPosition(
      this.contextMenuRawCursor.clientX,
      this.contextMenuRawCursor.clientY,
      measuredWidth,
      measuredHeight
    );
  }

  /** Programa un reajuste tras el próximo frame de renderizado para reflejar la altura real del menú. */
  scheduleContextMenuReposition(): void {
    if (!this.contextMenuPos() || !this.contextMenuRawCursor) {
      return;
    }
    this.cancelContextMenuRepositionRaf();
    if (typeof requestAnimationFrame !== 'function') {
      this.repositionContextMenuToViewport();
      return;
    }
    this.contextMenuRepositionRafId = requestAnimationFrame(() => {
      this.contextMenuRepositionRafId = null;
      this.repositionContextMenuToViewport();
    });
  }

  /** Reubica el menú contextual si está abierto cuando cambia el tamaño de la ventana. */
  onWindowResize(): void {
    if (!this.contextMenuPos()) {
      return;
    }
    this.repositionContextMenuToViewport();
    this.scheduleContextMenuReposition();
  }

  private cancelContextMenuRepositionRaf(): void {
    if (this.contextMenuRepositionRafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.contextMenuRepositionRafId);
    }
    this.contextMenuRepositionRafId = null;
  }

  private getViewportMetricsForContextMenu(): {
    viewportWidth: number;
    viewportHeight: number;
    containerRect: ContainerBoundsRect | null;
    rightPanelLeft: number | null;
  } {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const containerEl = this.containerRef()?.nativeElement;
    let containerRect: ContainerBoundsRect | null = null;
    if (containerEl) {
      const rect = containerEl.getBoundingClientRect();
      containerRect = {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    }
    const rightPanelLeft =
      typeof document !== 'undefined'
        ? this.contextMenuPositioning.findOpenRightPanelLeftPx(document)
        : null;
    return { viewportWidth, viewportHeight, containerRect, rightPanelLeft };
  }

  private applySmartContextMenuPosition(
    clientX: number,
    clientY: number,
    menuWidth?: number,
    menuHeight?: number
  ): void {
    const { viewportWidth, viewportHeight, containerRect, rightPanelLeft } =
      this.getViewportMetricsForContextMenu();
    const effectiveWidth =
      menuWidth != null && Number.isFinite(menuWidth) && menuWidth > 0
        ? menuWidth
        : DEFAULT_CONTEXT_MENU_WIDTH_PX;
    const effectiveHeight =
      menuHeight != null && Number.isFinite(menuHeight) && menuHeight > 0
        ? menuHeight
        : DEFAULT_CONTEXT_MENU_HEIGHT_PX;

    const smartPos = this.contextMenuPositioning.computeSmartContextMenuPosition({
      clientX,
      clientY,
      menuWidth: effectiveWidth,
      menuHeight: effectiveHeight,
      viewportWidth,
      viewportHeight,
      rightPanelLeft,
      containerRect
    });

    const renderedHeight = Math.min(effectiveHeight, smartPos.maxHeightPx);
    const submenuPlacement = this.contextMenuPositioning.computeSubmenuPlacement({
      menuRect: {
        left: smartPos.x,
        right: smartPos.x + effectiveWidth,
        top: smartPos.y,
        bottom: smartPos.y + renderedHeight
      },
      viewportWidth,
      viewportHeight,
      safeBottom: smartPos.safeBounds.bottom
    });

    this.contextMenuPos.set({ x: smartPos.x, y: smartPos.y });
    this.contextMenuMaxHeightPx.set(smartPos.maxHeightPx);
    this.contextMenuSubmenuFlip.set(submenuPlacement);
  }

  private resetContextMenuSubmenus(active?: typeof this.showRotateSubmenu): void {
    const submenus = [
      this.showQuickMaterialPicker,
      this.showStructureMaterialSubmenu,
      this.showDoorMaterialSubmenu,
      this.showRotateSubmenu,
      this.showMovableRoleSubmenu,
      this.showHandleSubmenu,
      this.showHingeSubmenu,
      this.showSlideSubmenu
    ];
    for (const submenu of submenus) {
      if (submenu !== active) {
        submenu.set(false);
      }
    }
  }

  private openContextMenuAtCursor(clientX: number, clientY: number): void {
    this.contextMenuRawCursor = { clientX, clientY };
    this.resetContextMenuSubmenus();
    this.applySmartContextMenuPosition(clientX, clientY);
    this.scheduleContextMenuReposition();
  }

  private toggleContextSubmenu(target: typeof this.showRotateSubmenu): void {
    target.update(v => !v);
    this.resetContextMenuSubmenus(target);
    if (this.contextMenuPos()) {
      this.repositionContextMenuToViewport();
      this.scheduleContextMenuReposition();
    }
  }

  closeContextMenu() {
    this.cancelContextMenuRepositionRaf();
    this.contextMenuRawCursor = null;
    this.contextMenuPos.set(null);
    this.contextMenuMaxHeightPx.set(null);
    this.contextMenuSubmenuFlip.set({ openLeft: false, openUp: false });
    this.contextMenuPart.set(null);
    this.contextMenuAppliance.set(null);
    this.contextMenuMode.set('group');
    this.contextMenuHandleFinishOverride.set(null);
    this.resetContextMenuSubmenus();
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
    this.toggleContextSubmenu(this.showRotateSubmenu);
  }

  toggleQuickMaterialPicker() {
    this.toggleContextSubmenu(this.showQuickMaterialPicker);
  }

  toggleStructureMaterialSubmenu() {
    this.toggleContextSubmenu(this.showStructureMaterialSubmenu);
  }

  toggleDoorMaterialSubmenu() {
    this.toggleContextSubmenu(this.showDoorMaterialSubmenu);
  }

  toggleMovableRoleSubmenu() {
    this.toggleContextSubmenu(this.showMovableRoleSubmenu);
  }

  toggleHandleSubmenu() {
    this.toggleContextSubmenu(this.showHandleSubmenu);
  }

  toggleHingeSubmenu() {
    this.toggleContextSubmenu(this.showHingeSubmenu);
  }

  toggleSlideSubmenu() {
    this.toggleContextSubmenu(this.showSlideSubmenu);
  }

  isAnimatablePart(part: Part | null): boolean {
    if (!part) return false;
    return this.contextMenuCategory() === 'drawer' || this.contextMenuCategory() === 'door';
  }

  setContextMenuPartMovable(role: 'door' | 'drawer_front' | 'shelf' | 'free', direction: OpeningDirection = 'left') {
    const part = this.contextMenuPart();
    if (!part) return;

    let updates: Partial<Part>;
    if (role === 'door') {
      const localDims = this.partGeometry.getLocalDimensions({
        ...part,
        componentRole: 'door',
        orientation: 'vertical_xy'
      });
      const minCenterY = Math.round((localDims.sy / 2) * 10) / 10;
      const nextPosY = Math.max(part.posY ?? 0, minCenterY);
      const hingeSpan = direction === 'top' || direction === 'bottom' ? localDims.sx : localDims.sy;
      const hingeCount = this.hardwareCatalog.computeHingeCountForDoor(hingeSpan);

      const wasDoor = part.componentRole === 'door' || part.hardwareConfig?.movableType === 'door';
      const prevHw = part.hardwareConfig;
      const handleType: HandleType =
        prevHw?.handleType && prevHw.handleType !== 'none'
          ? prevHw.handleType
          : 'bar_modern';
      const handleFinish: HandleFinish = prevHw?.handleFinish || 'brushed_steel';
      const handlePosition: DoorHandleVerticalPosition =
        wasDoor && prevHw?.handlePosition
          ? prevHw.handlePosition
          : prevHw?.handlePosition && prevHw.handlePosition !== 'none'
            ? prevHw.handlePosition
            : direction === 'top'
              ? 'bottom'
              : direction === 'bottom'
                ? 'top'
                : 'center';

      const hwConfig: PartHardwareConfig = {
        ...(prevHw || {}),
        isMovable: true,
        movableType: 'door',
        openingDirection: direction,
        hingeType:
          direction === 'top'
            ? 'gas_piston'
            : prevHw?.hingeType && prevHw.hingeType !== 'none'
              ? prevHw.hingeType
              : 'straight',
        hingeCount,
        handleType,
        handleFinish,
        handlePosition
      };

      const nameUp = (part.name || '').toUpperCase().trim();
      const shouldSetDoorName =
        !part.hasCustomName &&
        (!nameUp ||
          nameUp.startsWith('TABLERO') ||
          nameUp.startsWith('PIEZA') ||
          nameUp.includes('PUERTA') ||
          nameUp.includes('FRENTE') ||
          nameUp.includes('FONDO'));
      const doorName =
        direction === 'right'
          ? 'Puerta Derecha'
          : direction === 'top'
            ? 'Puerta Abatible Superior'
            : direction === 'bottom'
              ? 'Puerta Abatible Inferior'
              : 'Puerta Izquierda';

      updates = {
        componentRole: 'door',
        orientation: 'vertical_xy',
        rotationX: 0,
        rotationZ: 0,
        posY: nextPosY,
        hardwareConfig: hwConfig,
        ...(shouldSetDoorName ? { name: doorName } : {})
      };
    } else if (role === 'drawer_front') {
      const hwConfig: PartHardwareConfig = {
        ...(part.hardwareConfig || {}),
        isMovable: true,
        movableType: 'drawer',
        slideType: part.hardwareConfig?.slideType || 'telescopic',
        handleType: part.hardwareConfig?.handleType || 'bar_modern',
        handleFinish: part.hardwareConfig?.handleFinish || 'brushed_steel',
        handlePosition: 'horizontal'
      };
      updates = {
        componentRole: 'drawer_front',
        hardwareConfig: hwConfig
      };
    } else if (role === 'free') {
      this.openTargetMap.delete(part.id);
      this.openCurrentMap.delete(part.id);
      this.syncIsAllOpenSignal();
      this.bumpOpenStateRevision();

      const nameUp = (part.name || '').toUpperCase();
      const isDoorLikeName =
        nameUp.includes('PUERTA') ||
        nameUp.includes('BASCULANTE') ||
        nameUp.includes('ELEVABLE');

      updates = {
        componentRole: 'free',
        hardwareConfig: undefined,
        ...(isDoorLikeName ? { name: 'Tablero Estructural', hasCustomName: false } : {})
      };
    } else {
      this.openTargetMap.delete(part.id);
      this.openCurrentMap.delete(part.id);
      this.syncIsAllOpenSignal();
      this.bumpOpenStateRevision();

      const hwConfig: PartHardwareConfig = {
        ...(part.hardwareConfig || {}),
        isMovable: false,
        movableType: 'none',
        handleType: 'none',
        hingeType: 'none',
        slideType: 'none'
      };
      updates = {
        componentRole: role,
        hardwareConfig: hwConfig
      };
    }

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
      this.toggleDoorOrGroupOpen3D(part.id);
    }
    this.closeContextMenu();
  }

  toggleSinglePartOpenPreview(): void {
    const effectiveTarget = this.contextMenuEffectiveFrontPart() || this.contextMenuPart();
    if (!effectiveTarget) return;
    this.togglePartOpen(effectiveTarget.id);
  }

  getContextMenuGroupStructureMaterialId(grp: PartGroup): string | null {
    const firstStruct = this.getPartsForGroup(grp.id).find(
      p =>
        p.componentRole !== 'door' &&
        p.componentRole !== 'drawer_front' &&
        !(p.componentRole === 'back' && (p.thickness || 18) <= 6)
    );
    return grp.parametricConfig?.structureMaterialId || firstStruct?.materialId || null;
  }

  getContextMenuGroupDoorMaterialId(grp: PartGroup): string | null {
    const firstFront = this.getPartsForGroup(grp.id).find(
      p => p.componentRole === 'door' || p.componentRole === 'drawer_front'
    );
    return grp.parametricConfig?.doorMaterialId || firstFront?.materialId || null;
  }

  getContextMenuGroupHandleType(grp: PartGroup): HandleType {
    const firstFront = this.getPartsForGroup(grp.id).find(
      p => p.componentRole === 'door' || p.componentRole === 'drawer_front'
    );
    return (
      firstFront?.hardwareConfig?.handleType ||
      grp.parametricConfig?.handleType ||
      'bar_modern'
    );
  }

  getContextMenuGroupHandleFinish(grp: PartGroup): HandleFinish {
    const override = this.contextMenuHandleFinishOverride();
    if (override) return override;
    const firstFront = this.getPartsForGroup(grp.id).find(
      p => p.componentRole === 'door' || p.componentRole === 'drawer_front'
    );
    return (
      firstFront?.hardwareConfig?.handleFinish ||
      grp.parametricConfig?.handleFinish ||
      'brushed_steel'
    );
  }

  getContextMenuGroupHingeType(grp: PartGroup): HingeType {
    const firstHingedDoor = this.getPartsForGroup(grp.id).find(
      p =>
        !this.isBlindFixedPanelPart(p) &&
        (p.componentRole === 'door' || p.hardwareConfig?.movableType === 'door') &&
        !this.isSlidingDoorPart(p)
    );
    return (
      firstHingedDoor?.hardwareConfig?.hingeType ||
      grp.parametricConfig?.hingeType ||
      'straight'
    );
  }

  getContextMenuGroupSlideType(grp: PartGroup): SlideType {
    const firstDrawerFront = this.getPartsForGroup(grp.id).find(
      p => p.componentRole === 'drawer_front' || p.hardwareConfig?.movableType === 'drawer'
    );
    return (
      firstDrawerFront?.hardwareConfig?.slideType ||
      grp.parametricConfig?.drawerSlideType ||
      'telescopic'
    );
  }

  setContextMenuGroupMaterial(matId: string, target: 'structure' | 'doors') {
    const grp = this.contextMenuGroup();
    if (!grp) return;
    const existsInStore = this.projectStorage.groupsList().some(g => g.id === grp.id);
    if (existsInStore) {
      this.projectStorage.changeGroupMaterial(grp.id, matId, target);
    } else {
      const mat =
        this.materials().find(m => m.id === matId) ||
        MELAMINE_MATERIALS_CATALOG.find(m => m.id === matId);
      if (!mat) return;
      const grpParts = this.getPartsForGroup(grp.id);
      const updatesList: { part: Part; updates: Partial<Part> }[] = [];
      for (const p of grpParts) {
        const isFront = p.componentRole === 'door' || p.componentRole === 'drawer_front';
        const isBack = p.componentRole === 'back' && (p.thickness || 18) <= 6;
        if (isBack) continue;
        if (target === 'doors' && !isFront) continue;
        if (target === 'structure' && isFront) continue;
        updatesList.push({
          part: p,
          updates: {
            materialId: mat.id,
            materialName: mat.name,
            colorHex: mat.colorHex,
            grain: mat.hasGrain ? (p.grain === 'none' ? 'length' : p.grain) : 'none'
          }
        });
      }
      if (updatesList.length > 0) {
        this.multiplePartsModified.emit({ updates: updatesList });
      }
    }
    this.closeContextMenu();
  }

  setContextMenuGroupHandleFinish(finish: HandleFinish) {
    const grp = this.contextMenuGroup();
    if (!grp) return;
    this.contextMenuHandleFinishOverride.set(finish);
    const rawType = this.getContextMenuGroupHandleType(grp);
    const activeType: HandleType =
      rawType === 'none' ||
      rawType === 'push' ||
      rawType === 'push_open' ||
      rawType === 'finger_pull' ||
      rawType === 'gola' ||
      rawType === 'gola_less'
        ? 'bar_modern'
        : rawType;
    this.applyGroupGlobalHandlesFromContext(grp.id, activeType, finish);
  }

  setContextMenuGroupHandle(handleType: HandleType) {
    const grp = this.contextMenuGroup();
    if (!grp) return;
    const overrideFinish = this.contextMenuHandleFinishOverride();
    const finish: HandleFinish =
      overrideFinish ??
      (handleType === 'bar_black' ? 'black' : this.getContextMenuGroupHandleFinish(grp));
    this.applyGroupGlobalHandlesFromContext(grp.id, handleType, finish);
    this.closeContextMenu();
  }

  private applyGroupGlobalHandlesFromContext(
    groupId: string,
    handleType: HandleType,
    handleFinish: HandleFinish
  ): void {
    const existsInStore = this.projectStorage.groupsList().some(g => g.id === groupId);
    if (existsInStore) {
      this.projectStorage.applyGroupGlobalHandles(groupId, handleType, handleFinish);
      return;
    }
    const grpParts = this.getPartsForGroup(groupId);
    const updatesList: { part: Part; updates: Partial<Part> }[] = [];
    const openingSystem =
      handleType === 'none' || handleType === 'push' || handleType === 'push_open'
        ? 'push'
        : handleType === 'finger_pull'
          ? 'finger_pull'
          : handleType === 'gola' || handleType === 'gola_less'
            ? 'gola'
            : 'handle';
    for (const p of grpParts) {
      if (this.isBlindFixedPanelPart(p)) continue;
      if (p.componentRole !== 'door' && p.componentRole !== 'drawer_front') continue;
      const prevHw = p.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(p);
      const nextHw: PartHardwareConfig = {
        ...prevHw,
        handleType,
        handleFinish,
        ...(p.componentRole === 'drawer_front'
          ? { drawerOpeningSystem: openingSystem }
          : {
              handlePosition:
                handleType === 'none' ||
                handleType === 'push' ||
                handleType === 'push_open' ||
                handleType === 'finger_pull' ||
                handleType === 'gola' ||
                handleType === 'gola_less'
                  ? 'none'
                  : prevHw.handlePosition === 'none'
                    ? 'center'
                    : prevHw.handlePosition || 'center'
            })
      };
      updatesList.push({ part: p, updates: { hardwareConfig: nextHw } });
    }
    if (updatesList.length > 0) {
      this.multiplePartsModified.emit({ updates: updatesList });
    }
  }

  setContextMenuGroupHinge(hingeType: HingeType) {
    const grp = this.contextMenuGroup();
    if (!grp) return;
    const existsInStore = this.projectStorage.groupsList().some(g => g.id === grp.id);
    if (existsInStore) {
      this.projectStorage.applyGroupGlobalHinges(grp.id, hingeType);
    } else {
      const grpParts = this.getPartsForGroup(grp.id);
      const updatesList: { part: Part; updates: Partial<Part> }[] = [];
      for (const p of grpParts) {
        if (
          !this.isBlindFixedPanelPart(p) &&
          (p.componentRole === 'door' || p.hardwareConfig?.movableType === 'door') &&
          !this.isSlidingDoorPart(p)
        ) {
          const prevHw = p.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(p);
          updatesList.push({
            part: p,
            updates: { hardwareConfig: { ...prevHw, hingeType } }
          });
        }
      }
      if (updatesList.length > 0) {
        this.multiplePartsModified.emit({ updates: updatesList });
      }
    }
    this.closeContextMenu();
  }

  setContextMenuGroupSlide(slideType: SlideType) {
    const grp = this.contextMenuGroup();
    if (!grp) return;
    const existsInStore = this.projectStorage.groupsList().some(g => g.id === grp.id);
    if (existsInStore) {
      this.projectStorage.applyGroupGlobalSlides(grp.id, slideType);
    } else {
      const grpParts = this.getPartsForGroup(grp.id);
      const updatesList: { part: Part; updates: Partial<Part> }[] = [];
      for (const p of grpParts) {
        if (p.componentRole === 'drawer_front' || p.hardwareConfig?.movableType === 'drawer') {
          const prevHw = p.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(p);
          const nextOpening =
            slideType === 'push_open'
              ? 'push'
              : prevHw.drawerOpeningSystem === 'push'
                ? 'handle'
                : prevHw.drawerOpeningSystem;
          updatesList.push({
            part: p,
            updates: {
              hardwareConfig: {
                ...prevHw,
                slideType,
                ...(nextOpening ? { drawerOpeningSystem: nextOpening } : {})
              }
            }
          });
        }
      }
      if (updatesList.length > 0) {
        this.multiplePartsModified.emit({ updates: updatesList });
      }
    }
    this.closeContextMenu();
  }

  private static readonly EXPLICIT_NON_DOOR_ROLES: ReadonlySet<ComponentRole> = new Set<ComponentRole>([
    'free',
    'shelf',
    'top',
    'bottom',
    'side_left',
    'side_right',
    'divider',
    'back',
    'plinth',
    'tie',
    'countertop',
    'backsplash'
  ]);

  private isExplicitNonDoorRole(role?: ComponentRole): boolean {
    return Boolean(role && Furniture3dViewerComponent.EXPLICIT_NON_DOOR_ROLES.has(role));
  }

  private isDoorCandidatePart(p: Part | null | undefined): p is Part {
    if (!p) return false;
    if (this.isExplicitNonDoorRole(p.componentRole) && p.hardwareConfig?.movableType !== 'door') {
      return false;
    }
    const nameUp = (p.name || '').toUpperCase();
    return (
      !nameUp.includes('CAJ') &&
      (p.componentRole === 'door' ||
        p.hardwareConfig?.movableType === 'door' ||
        nameUp.includes('PUERTA'))
    );
  }

  private findPairedDoorSiblingForPart(doorPart: Part | null | undefined): Part | null {
    if (!doorPart || !this.isDoorCandidatePart(doorPart) || this.isSlidingDoorPart(doorPart)) {
      return null;
    }

    const storageCapable = this.projectStorage as unknown as DoorCapableProjectStorage;
    if (typeof storageCapable.findPairedDoorSibling === 'function') {
      const fromStorage = storageCapable.findPairedDoorSibling(doorPart);
      if (fromStorage && !this.isSlidingDoorPart(fromStorage)) return fromStorage;
    }

    const allParts = this.parts();
    const candidates = allParts.filter(
      other =>
        other.id !== doorPart.id &&
        this.isDoorCandidatePart(other) &&
        !this.isSlidingDoorPart(other) &&
        ((doorPart.groupId && other.groupId === doorPart.groupId) ||
          (doorPart.moduleId && other.moduleId === doorPart.moduleId) ||
          (!doorPart.groupId && !doorPart.moduleId && !other.groupId && !other.moduleId)) &&
        Math.abs((other.posY ?? 0) - (doorPart.posY ?? 0)) <= 20 &&
        Math.abs((other.posZ ?? 0) - (doorPart.posZ ?? 0)) <= 20 &&
        Math.abs((other.length || 0) - (doorPart.length || 0)) <= 20
    );

    return candidates.length > 0 ? candidates[0] : null;
  }

  private resolveTargetDoorsForId(partOrGroupId: string): Part[] {
    const allParts = this.parts();
    const directPart = allParts.find(p => p.id === partOrGroupId) ?? null;
    if (directPart && this.isDoorCandidatePart(directPart)) {
      const sibling = this.findPairedDoorSiblingForPart(directPart);
      return sibling ? [directPart, sibling] : [directPart];
    }

    const groupDoors = allParts.filter(
      p => (p.groupId === partOrGroupId || p.moduleId === partOrGroupId) && this.isDoorCandidatePart(p)
    );
    return groupDoors;
  }

  getDoorOpeningModeForPart(
    part: Part | null
  ): 'left' | 'right' | 'double' | 'top' | 'bottom' | 'none' {
    if (!part || !this.isDoorCandidatePart(part)) return 'none';

    const storageCapable = this.projectStorage as unknown as DoorCapableProjectStorage;
    if (typeof storageCapable.getDoorConfigurationMode === 'function') {
      const isInStore = this.projectStorage.currentProject().parts.some(p => p.id === part.id);
      if (isInStore) {
        const mode = storageCapable.getDoorConfigurationMode(part.id);
        if (mode && mode !== 'none') return mode;
      }
    }

    const sibling = this.findPairedDoorSiblingForPart(part);
    if (sibling) {
      return 'double';
    }

    const dir = part.hardwareConfig?.openingDirection;
    if (dir === 'left' || dir === 'right' || dir === 'top' || dir === 'bottom') {
      return dir;
    }

    const nameUp = (part.name || '').toUpperCase();
    if (nameUp.includes('BASCULANTE') || nameUp.includes('ELEVABLE') || nameUp.includes('SUPERIOR')) {
      return 'top';
    }
    if (nameUp.includes('INFERIOR')) {
      return 'bottom';
    }
    if (nameUp.includes('DER') || (part.posX || 0) > 0) {
      return 'right';
    }
    return 'left';
  }

  configureDoorModeFromViewer(
    partOrGroupId: string,
    mode: 'left' | 'right' | 'double' | 'top' | 'bottom'
  ): void {
    const storageCapable = this.projectStorage as unknown as DoorCapableProjectStorage;
    const storeParts = this.projectStorage.currentProject().parts;
    const existsInStore = storeParts.some(
      p => p.id === partOrGroupId || p.groupId === partOrGroupId || p.moduleId === partOrGroupId
    );

    if (existsInStore && typeof storageCapable.configureDoorOpeningMode === 'function') {
      const updatedDoors = storageCapable.configureDoorOpeningMode(partOrGroupId, mode);
      if (updatedDoors && updatedDoors.length > 0) {
        const freshPrimary =
          updatedDoors.find(d => d.id === partOrGroupId) || updatedDoors[0];
        if (this.contextMenuPart()) {
          this.contextMenuPart.set(freshPrimary);
        }
        this.requestRender(16);
        return;
      }
    }

    // Fallback autónomo cuando las piezas provienen de inputs locales o pruebas unitarias
    const targetDoors = this.resolveTargetDoorsForId(partOrGroupId);
    if (targetDoors.length === 0) return;

    const primaryDoor =
      targetDoors.find(d => d.id === partOrGroupId) || targetDoors[0];
    const siblingDoor =
      targetDoors.find(d => d.id !== primaryDoor.id) ||
      this.findPairedDoorSiblingForPart(primaryDoor);

    if (mode === 'double') {
      if (siblingDoor) {
        const sorted = [primaryDoor, siblingDoor].sort(
          (a, b) => (a.posX ?? 0) - (b.posX ?? 0)
        );
        const leftLeaf = sorted[0];
        const rightLeaf = sorted[1];

        const leftHw: PartHardwareConfig = {
          ...(leftLeaf.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(leftLeaf)),
          isMovable: true,
          movableType: 'door',
          openingDirection: 'left',
          hingeType: 'straight',
          handlePosition:
            leftLeaf.hardwareConfig?.handlePosition === 'top' ||
            leftLeaf.hardwareConfig?.handlePosition === 'bottom' ||
            leftLeaf.hardwareConfig?.handlePosition === 'none'
              ? leftLeaf.hardwareConfig.handlePosition
              : 'center'
        };
        const rightHw: PartHardwareConfig = {
          ...(rightLeaf.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(rightLeaf)),
          isMovable: true,
          movableType: 'door',
          openingDirection: 'right',
          hingeType: 'straight',
          handlePosition: leftHw.handlePosition
        };

        this.projectStorage.updatePart({ ...leftLeaf, hardwareConfig: leftHw }, true);
        this.projectStorage.updatePart({ ...rightLeaf, hardwareConfig: rightHw }, false);
        this.multiplePartsModified.emit({
          updates: [
            { part: leftLeaf, updates: { hardwareConfig: leftHw } },
            { part: rightLeaf, updates: { hardwareConfig: rightHw } }
          ]
        });
        if (this.contextMenuPart()?.id === leftLeaf.id) {
          this.contextMenuPart.set({ ...leftLeaf, hardwareConfig: leftHw });
        } else if (this.contextMenuPart()?.id === rightLeaf.id) {
          this.contextMenuPart.set({ ...rightLeaf, hardwareConfig: rightHw });
        }
      } else {
        const bounds = this.partGeometry.getWorldAABB(primaryDoor);
        const localDims = this.partGeometry.getLocalDimensions(primaryDoor);
        const totalSpanX = Math.max(160, bounds.sx);
        const gapMm = 3;
        const leafWidth = Math.max(75, Math.floor((totalSpanX - gapMm) / 2));
        const centerPosX = primaryDoor.posX ?? 0;
        const leftPosX = Math.round((centerPosX - (leafWidth / 2 + gapMm / 2)) * 10) / 10;
        const rightPosX = Math.round((centerPosX + (leafWidth / 2 + gapMm / 2)) * 10) / 10;

        const widthProp: 'width' | 'length' =
          localDims.lengthLocalAxis === 'x' ? 'length' : 'width';
        const baseHandlePos =
          primaryDoor.hardwareConfig?.handlePosition === 'top' ||
          primaryDoor.hardwareConfig?.handlePosition === 'bottom' ||
          primaryDoor.hardwareConfig?.handlePosition === 'none'
            ? primaryDoor.hardwareConfig.handlePosition
            : 'center';

        const leftHw: PartHardwareConfig = {
          ...(primaryDoor.hardwareConfig ||
            this.hardwareCatalog.getDefaultHardwareConfig(primaryDoor)),
          isMovable: true,
          movableType: 'door',
          openingDirection: 'left',
          hingeType: 'straight',
          handlePosition: baseHandlePos
        };
        const rightHw: PartHardwareConfig = {
          ...leftHw,
          openingDirection: 'right'
        };

        const leftUpdates: Partial<Part> = {
          name: 'Puerta Izquierda',
          [widthProp]: leafWidth,
          posX: leftPosX,
          hardwareConfig: leftHw
        };

        const updatedLeft: Part = {
          ...primaryDoor,
          ...leftUpdates
        };

        const newRightLeaf: Part = {
          ...primaryDoor,
          id: `${primaryDoor.id}_pair_der`,
          name: 'Puerta Derecha',
          [widthProp]: leafWidth,
          posX: rightPosX,
          hardwareConfig: rightHw
        };

        this.projectStorage.updatePart(updatedLeft, true);
        this.projectStorage.addPart(newRightLeaf);
        this.partModified.emit({ part: primaryDoor, updates: leftUpdates });
        this.partCreated.emit(newRightLeaf);
        if (this.contextMenuPart()) {
          this.contextMenuPart.set(updatedLeft);
        }
      }
      this.requestRender(16);
      return;
    }

    // Modo de 1 hoja ('left' | 'right' | 'top' | 'bottom')
    let mergedWidthUpdates: Partial<Part> = {};
    if (siblingDoor) {
      const b1 = this.partGeometry.getWorldAABB(primaryDoor);
      const b2 = this.partGeometry.getWorldAABB(siblingDoor);
      const minX = Math.min(b1.minX, b2.minX);
      const maxX = Math.max(b1.maxX, b2.maxX);
      const combinedSpanX = Math.round(maxX - minX);
      const centerPosX = Math.round(((minX + maxX) / 2) * 10) / 10;
      const localDims = this.partGeometry.getLocalDimensions(primaryDoor);
      const widthProp: 'width' | 'length' =
        localDims.lengthLocalAxis === 'x' ? 'length' : 'width';

      mergedWidthUpdates = {
        [widthProp]: combinedSpanX,
        posX: centerPosX
      };
      this.projectStorage.deletePart(siblingDoor.id);
      this.partDeleted.emit(siblingDoor.id);
    }

    const nextHandlePos: 'top' | 'center' | 'bottom' | 'none' =
      primaryDoor.hardwareConfig?.handlePosition === 'none'
        ? 'none'
        : mode === 'top'
          ? 'bottom'
          : mode === 'bottom'
            ? 'top'
            : primaryDoor.hardwareConfig?.handlePosition === 'top' ||
                primaryDoor.hardwareConfig?.handlePosition === 'bottom'
              ? primaryDoor.hardwareConfig.handlePosition
              : 'center';

    const nextHw: PartHardwareConfig = {
      ...(primaryDoor.hardwareConfig ||
        this.hardwareCatalog.getDefaultHardwareConfig(primaryDoor)),
      isMovable: true,
      movableType: 'door',
      openingDirection: mode,
      hingeType: mode === 'top' ? 'gas_piston' : 'straight',
      handlePosition: nextHandlePos
    };

    const nextName =
      mode === 'top'
        ? 'Puerta Abatible Superior'
        : mode === 'bottom'
          ? 'Puerta Abatible Inferior'
          : mode === 'right'
            ? 'Puerta Derecha'
            : 'Puerta Izquierda';

    const singleUpdates: Partial<Part> = {
      ...mergedWidthUpdates,
      name: nextName,
      componentRole: 'door',
      hardwareConfig: nextHw
    };

    const updatedSingle: Part = {
      ...primaryDoor,
      ...singleUpdates
    };

    this.projectStorage.updatePart(updatedSingle, true);
    this.partModified.emit({ part: primaryDoor, updates: singleUpdates });
    if (this.contextMenuPart()) {
      this.contextMenuPart.set(updatedSingle);
    }
    this.requestRender(16);
  }

  getDoorHandlePositionForPart(
    part: Part | null
  ): 'top' | 'center' | 'bottom' | 'none' {
    if (!part) return 'center';
    const hw = part.hardwareConfig;
    if (
      hw?.handlePosition === 'none' ||
      hw?.handleType === 'none' ||
      hw?.handleType === 'push' ||
      hw?.handleType === 'push_open' ||
      hw?.handleType === 'finger_pull' ||
      hw?.handleType === 'gola' ||
      hw?.handleType === 'gola_less'
    ) {
      return 'none';
    }
    if (hw?.handlePosition === 'top') return 'top';
    if (hw?.handlePosition === 'bottom') return 'bottom';
    if (hw?.openingDirection === 'top') return 'bottom';
    if (hw?.openingDirection === 'bottom') return 'top';
    return 'center';
  }

  setDoorHandlePositionFromViewer(
    partOrGroupId: string,
    pos: 'top' | 'center' | 'bottom' | 'none'
  ): void {
    const storageCapable = this.projectStorage as unknown as DoorCapableProjectStorage;
    const storeParts = this.projectStorage.currentProject().parts;
    const existsInStore = storeParts.some(
      p => p.id === partOrGroupId || p.groupId === partOrGroupId || p.moduleId === partOrGroupId
    );

    if (existsInStore && typeof storageCapable.setDoorHandleVerticalPosition === 'function') {
      storageCapable.setDoorHandleVerticalPosition(partOrGroupId, pos);
    }

    const targetDoors = this.resolveTargetDoorsForId(partOrGroupId);
    if (targetDoors.length === 0) return;

    const batchUpdates: { part: Part; updates: Partial<Part> }[] = [];
    for (const door of targetDoors) {
      const prevHw =
        door.hardwareConfig || this.hardwareCatalog.getDefaultHardwareConfig(door);
      const nextHandleType: HandleType =
        pos === 'none'
          ? 'push_open'
          : prevHw.handleType === 'none' ||
              prevHw.handleType === 'push' ||
              prevHw.handleType === 'push_open' ||
              prevHw.handleType === 'finger_pull' ||
              prevHw.handleType === 'gola' ||
              prevHw.handleType === 'gola_less'
            ? 'bar_modern'
            : prevHw.handleType || 'bar_modern';

      const nextHw: PartHardwareConfig = {
        ...prevHw,
        handlePosition: pos,
        handleType: nextHandleType
      };
      const updatedDoor: Part = { ...door, hardwareConfig: nextHw };
      if (!existsInStore || typeof storageCapable.setDoorHandleVerticalPosition !== 'function') {
        this.projectStorage.updatePart(updatedDoor, batchUpdates.length === 0);
      }
      batchUpdates.push({ part: door, updates: { hardwareConfig: nextHw } });
      if (this.contextMenuPart()?.id === door.id) {
        this.contextMenuPart.set(updatedDoor);
      }
    }

    if (batchUpdates.length === 1) {
      this.partModified.emit(batchUpdates[0]);
    } else if (batchUpdates.length > 1) {
      this.multiplePartsModified.emit({ updates: batchUpdates });
      this.partModified.emit(batchUpdates[0]);
    }
    this.requestRender(16);
  }

  getDoorMaxOpeningAngleDeg(partOrGroupId: string): number {
    const doors = this.resolveTargetDoorsForId(partOrGroupId);
    const primary = doors[0] ?? this.contextMenuPart();
    const dir = primary?.hardwareConfig?.openingDirection;
    return dir === 'top' || dir === 'bottom' ? 80 : 90;
  }

  setDoorOpeningAngleDeg(partOrGroupId: string, angleDeg: number): void {
    const targetDoors = this.resolveTargetDoorsForId(partOrGroupId);
    const doorIds =
      targetDoors.length > 0 ? targetDoors.map(d => d.id) : [partOrGroupId];

    for (const dId of doorIds) {
      const pieceItem = this.pieceObjectMap.get(dId);
      const dir =
        pieceItem?.hingeSide ||
        targetDoors.find(d => d.id === dId)?.hardwareConfig?.openingDirection ||
        'left';
      const maxDeg = dir === 'top' || dir === 'bottom' ? 80 : 90;
      const clampedDeg = Math.max(0, Math.min(maxDeg, Number(angleDeg) || 0));
      const progress = clampedDeg / maxDeg;

      this.openTargetMap.set(dId, progress);
      this.openCurrentMap.set(dId, progress);

      if (pieceItem?.isDoor && pieceItem.isSlidingDoor) {
        const expFactor = Math.max(0, Math.min(1, Number(this.explodedPercent()) / 100 || 0));
        this.applyLinearSlideTransform(pieceItem, progress, expFactor);
      } else if (pieceItem?.isDoor && pieceItem.doorPivot) {
        this.applyDoorPivotRotation(
          pieceItem.doorPivot,
          pieceItem.hingeSide || dir,
          pieceItem.doorFacing || 'front',
          progress,
          pieceItem.doorBaseRotation
        );
      }
    }

    if (this.furnitureGroup) {
      this.sceneRaycastPicker.refreshPickableMatricesAndBounds(this.furnitureGroup);
    }
    this.syncIsAllOpenSignal();
    this.bumpOpenStateRevision();
    this.requestRender(12);
  }

  getDoorOpeningAngleDeg(partOrGroupId: string): number {
    const targetDoors = this.resolveTargetDoorsForId(partOrGroupId);
    const refId = targetDoors[0]?.id ?? partOrGroupId;
    const pieceItem = this.pieceObjectMap.get(refId);
    const dir =
      pieceItem?.hingeSide ||
      targetDoors[0]?.hardwareConfig?.openingDirection ||
      'left';
    const maxDeg = dir === 'top' || dir === 'bottom' ? 80 : 90;
    const progress =
      this.openCurrentMap.get(refId) ?? this.openTargetMap.get(refId) ?? 0;
    return Math.round(Math.max(0, Math.min(1, progress)) * maxDeg);
  }

  toggleDoorOrGroupOpen3D(partOrGroupId: string): void {
    const targetDoors = this.resolveTargetDoorsForId(partOrGroupId);
    if (targetDoors.length > 0) {
      this.togglePartOpen(targetDoors[0].id);
      return;
    }
    this.togglePartOpen(partOrGroupId);
  }

  isDoorOrGroupOpen3D(partOrGroupId: string): boolean {
    this.openStateRevision();
    const targetDoors = this.resolveTargetDoorsForId(partOrGroupId);
    const refId = targetDoors[0]?.id ?? partOrGroupId;
    const cur = this.openTargetMap.get(refId) ?? this.openCurrentMap.get(refId) ?? 0;
    return cur > 0.05;
  }

  onDoorContextAngleSliderInput(partId: string, event: Event): void {
    const inputEl = event.target as HTMLInputElement | null;
    if (!inputEl) return;
    this.setDoorOpeningAngleDeg(partId, Number(inputEl.value));
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
    return !!grp && this.contextMenuMode() === 'group';
  });

  selectWholeGroupFromContext() {
    const grp = this.contextMenuGroup();
    const part = this.contextMenuPart();
    if (!grp) return;
    this.contextMenuMode.set('group');
    this.resetContextMenuSubmenus();
    const grpIds = this.parts().filter(p => p.groupId === grp.id).map(p => p.id);
    this.partsSelected.emit(grpIds);
    if (part) this.partSelected.emit(part);
    this.applyMaterialToWholeGroup.set(true);
    if (this.contextMenuPos()) {
      this.repositionContextMenuToViewport();
      this.scheduleContextMenuReposition();
    }
  }

  selectSinglePartFromContext() {
    const part = this.contextMenuPart();
    if (!part) return;
    this.contextMenuMode.set('part');
    this.resetContextMenuSubmenus();
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
    if (this.contextMenuPos()) {
      this.repositionContextMenuToViewport();
      this.scheduleContextMenuReposition();
    }
  }

  hideContextMenuGroup() {
    const grp = this.contextMenuGroup();
    if (!grp) return;
    const hostedGroupIds = this.getHostedGroupIdsForHostIds(new Set([grp.id]));
    const grpIds = this.parts()
      .filter(p => p.groupId === grp.id || (Boolean(p.groupId) && hostedGroupIds.has(p.groupId as string)))
      .map(p => p.id);
    this.hidePartsByIds(grpIds);
    this.closeContextMenu();
  }

  deleteContextMenuGroup() {
    const grp = this.contextMenuGroup();
    if (!grp) return;
    const activeZoneGroupId = this.zoneBuilderGroupId();
    if (this.isZoneBuilderActive() && activeZoneGroupId && grp.id === activeZoneGroupId) {
      this.zoneDeleteRequested.emit();
      this.closeContextMenu();
      return;
    }
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
    this.isolateGroupById(grp.id);
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

    const hostedParts = this.collectHostedPartsForDraggedParts(partsList);
    const effectivePartsList = hostedParts.length > 0 ? [...partsList, ...hostedParts] : partsList;

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const pt of effectivePartsList) {
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

    for (const pt of effectivePartsList) {
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
  private handleShiftClickSelection(
    e: PointerEvent,
    precomputedClosest?: ScenePickCandidate | null
  ) {
    let closest = precomputedClosest;
    if (closest === undefined) {
      const canvas = this.canvasRef()?.nativeElement;
      if (!canvas || !this.camera) return;
      const rect = canvas.getBoundingClientRect();

      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);

      closest = this.sceneRaycastPicker.pickClosestSceneCandidate(
        this.raycaster,
        this.buildSceneRaycastSources()
      ).closest;
    }

    if (!closest) {
      return;
    }

    // Muros o guía de referencia en primer plano bloquean la selección a través de ellos
    if (closest.kind === 'wall' || closest.kind === 'reference_guide') {
      return;
    }

    if (closest.kind === 'appliance' && closest.appliance) {
      const foundApp = closest.appliance;
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
      if (nextAppIds.length > 0) {
        const nextApp = nextAppIds.includes(foundApp.id)
          ? foundApp
          : (this.appliances().find(a => nextAppIds.includes(a.id)) || null);
        this.applianceSelected.emit(nextApp);
      } else {
        this.applianceSelected.emit(null);
      }
      return;
    }

    if ((closest.kind === 'piece' || closest.kind === 'drill_hole') && closest.part) {
      const part = closest.part;
      const curIds = new Set(this.activeSelectedIds());
      const curAppIds = new Set(this.activeSelectedApplianceIds());
      const isModularDrawer = !!part.groupId && this.isModularDrawerGroup(part.groupId);
      const isCountertopUnit = part.componentRole === 'countertop' || part.componentRole === 'backsplash';

      // Cajón modular: indivisible; módulo estándar: alterna módulo salvo si la pieza ya estaba aislada sola;
      // mesones y piezas sueltas: alternan individualmente.
      let partsToToggle: Part[];
      let appsToToggle: ApplianceItem[] = [];

      if (isModularDrawer && part.groupId) {
        const drawerParts = this.parts().filter(p => p.groupId === part.groupId);
        partsToToggle = drawerParts.length > 0 ? drawerParts : [part];
      } else if (part.groupId && !isCountertopUnit) {
        const groupParts = this.parts().filter(p => p.groupId === part.groupId);
        const isSingleIsolatedDeselect =
          curIds.size === 1 && curIds.has(part.id) && groupParts.length > 1;
        if (isSingleIsolatedDeselect) {
          partsToToggle = [part];
        } else {
          partsToToggle = groupParts.length > 0 ? groupParts : [part];
          appsToToggle = this.appliances().filter(a => a.groupId === part.groupId);
        }
      } else {
        partsToToggle = [part];
      }

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
        const nextFirst =
          !allInCur && updatedIds.includes(part.id)
            ? part
            : (this.parts().find(p => updatedIds.includes(p.id)) || null);
        this.partSelected.emit(nextFirst);
      } else {
        this.partSelected.emit(null);
      }
      if (updatedAppIds.length > 0 && appsToToggle.length > 0) {
        const nextFirstApp = this.appliances().find(a => updatedAppIds.includes(a.id)) || null;
        this.applianceSelected.emit(nextFirstApp);
      } else if (updatedAppIds.length === 0 && (appsToToggle.length > 0 || this.selectedApplianceId() !== null)) {
        this.applianceSelected.emit(null);
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
    this.dragInitialHostedParts = [];
    this.liveDragPartUpdates.clear();
    this.liveDragApplianceUpdates.clear();
    this.liveDragPrimaryApplianceUpdate = null;
    this.liveDraggedDrawerCavityFit = null;
    this.selectionOutlineGroup.position.set(0, 0, 0);
    this.zoneHighlightGroup.position.set(0, 0, 0);
    this.isWallDragging = false;
    this.activeWallTarget = null;
    this.isWallGizmoDragging = false;
    this.activeWallGizmoHit = null;
    this.activeWallStretchEndSign = 1;
    this.pendingWallUpdates = null;
    this.clearWallSnapGuides();
    this.isApplianceDragging = false;
    this.isApplianceResizing = false;
    this.draggingAppliance = null;
    this.measurePointerDownPos = null;
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

    // Si estamos en modo módulo/grupo completo, alinear todo el módulo en bloque (incluyendo cajones alojados)
    if (this.isContextMenuGroupMode() && part.groupId) {
      const grpParts = this.parts().filter(p => p.groupId === part.groupId);
      if (grpParts.length > 0) {
        const hostedParts = this.collectHostedPartsForGroupIds(
          new Set([part.groupId]),
          new Set(grpParts.map(p => p.id))
        );
        const allPartsToAlign = [...grpParts, ...hostedParts];
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        for (const p of allPartsToAlign) {
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

        const updatesList = allPartsToAlign.map(p => {
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

  private isApplianceVisuallyHidden(app: ApplianceItem): boolean {
    return Boolean(app.isHidden) || this.internalHiddenApplianceIds().has(app.id);
  }

  private showIsolationToast(message: string): void {
    if (this.isolationToastTimer !== null) {
      clearTimeout(this.isolationToastTimer);
      this.isolationToastTimer = null;
    }
    this.ngZone.run(() => {
      this.isolationToast.set(message);
    });
    this.isolationToastTimer = setTimeout(() => {
      this.isolationToastTimer = null;
      this.ngZone.run(() => {
        this.isolationToast.set(null);
      });
    }, 3200);
  }

  dismissIsolationToast(): void {
    if (this.isolationToastTimer !== null) {
      clearTimeout(this.isolationToastTimer);
      this.isolationToastTimer = null;
    }
    this.ngZone.run(() => {
      this.isolationToast.set(null);
    });
  }

  isolateGroupById(groupId: string): void {
    const cleanGroupId = (groupId || '').trim();
    if (!cleanGroupId) return;

    const keepGroupIds = new Set<string>([cleanGroupId]);
    for (const grp of this.partGroups()) {
      const hostId = grp.hostGroupId ?? grp.drawerConfig?.hostGroupId ?? grp.drawerConfig?.targetModuleId;
      if (hostId === cleanGroupId) {
        keepGroupIds.add(grp.id);
      }
    }

    const allParts = this.parts();
    const otherPartIds = allParts
      .filter(p => !p.groupId || !keepGroupIds.has(p.groupId))
      .map(p => p.id);
    this.hiddenPartIds.set(new Set(otherPartIds));
    this.hiddenPartsChanged.emit(otherPartIds);

    const allApps = this.appliances();
    const hiddenAppIds = new Set<string>();
    const appUpdates: { id: string; updates: Partial<ApplianceItem> }[] = [];
    for (const app of allApps) {
      const isLinked = Boolean(app.groupId && keepGroupIds.has(app.groupId));
      if (!isLinked) {
        hiddenAppIds.add(app.id);
      }
      if (Boolean(app.isHidden) !== !isLinked) {
        appUpdates.push({ id: app.id, updates: { isHidden: !isLinked } });
      }
    }
    this.internalHiddenApplianceIds.set(hiddenAppIds);
    if (appUpdates.length > 0) {
      this.multipleAppliancesModified.emit({ updates: appUpdates });
    }

    const groupObj = this.partGroups().find(g => g.id === cleanGroupId);
    const firstPart = allParts.find(p => p.groupId === cleanGroupId);
    const label = groupObj?.name || firstPart?.groupName || firstPart?.moduleName || 'Módulo';
    this.isolatedTarget.set({ kind: 'group', id: cleanGroupId, label });
    this.showIsolationToast(`Módulo aislado: ${label}`);
  }

  isolatePartById(partId: string): void {
    const cleanPartId = (partId || '').trim();
    if (!cleanPartId) return;

    const allParts = this.parts();
    const targetPart = allParts.find(p => p.id === cleanPartId) || null;
    const otherPartIds = allParts.filter(p => p.id !== cleanPartId).map(p => p.id);
    this.hiddenPartIds.set(new Set(otherPartIds));
    this.hiddenPartsChanged.emit(otherPartIds);

    const allApps = this.appliances();
    this.internalHiddenApplianceIds.set(new Set(allApps.map(a => a.id)));
    const appUpdates = allApps
      .filter(a => !a.isHidden)
      .map(a => ({ id: a.id, updates: { isHidden: true } }));
    if (appUpdates.length > 0) {
      this.multipleAppliancesModified.emit({ updates: appUpdates });
    }

    const label = targetPart?.name || 'Pieza';
    this.isolatedTarget.set({ kind: 'part', id: cleanPartId, label });
    this.showIsolationToast(`Pieza aislada: ${label}`);
  }

  isolatePart(part: Part) {
    this.isolatePartById(part.id);
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
    if (next.size === 0 && this.hiddenAppliancesCount() === 0) {
      this.isolatedTarget.set(null);
    }
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
    if (next.size === 0 && this.hiddenAppliancesCount() === 0) {
      this.isolatedTarget.set(null);
    }
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
    if (next.size === 0 && this.hiddenAppliancesCount() === 0) {
      this.isolatedTarget.set(null);
    }
  }

  setHiddenParts(ids: Set<string> | string[]) {
    const s = new Set(ids);
    this.hiddenPartIds.set(s);
    this.hiddenPartsChanged.emit(Array.from(s));
    if (s.size === 0 && this.hiddenAppliancesCount() === 0) {
      this.isolatedTarget.set(null);
    }
  }

  showAllParts() {
    this.hiddenPartIds.set(new Set());
    this.internalHiddenApplianceIds.set(new Set());
    this.isolatedTarget.set(null);
    const hiddenApps = this.appliances().filter(a => a.isHidden);
    if (hiddenApps.length > 0) {
      this.multipleAppliancesModified.emit({
        updates: hiddenApps.map(a => ({ id: a.id, updates: { isHidden: false } }))
      });
    }
    this.hiddenPartsChanged.emit([]);
    this.showAllRequested.emit();
    this.dismissIsolationToast();
    this.closeContextMenu();
  }

  toggleVisibilityFromToolbar(): void {
    this.hideToggleRequested.emit();
    if (this.manageHideInternally()) {
      this.applyInternalHideToggle();
    }
  }

  private applyInternalHideToggle(): boolean {
    const selectedIds = this.activeSelectedIds();
    if (selectedIds.length > 0) {
      this.hidePartsByIds(selectedIds);
      return true;
    }
    if (this.hiddenPartIds().size > 0) {
      this.showAllParts();
      return true;
    }
    return false;
  }

  assignQuickMaterial(matId: string, applyToWholeGroup = false) {
    const part = this.contextMenuPart();
    const mat =
      this.materials().find(m => m.id === matId) ||
      MELAMINE_MATERIALS_CATALOG.find(m => m.id === matId);
    if (!part || !mat) return;

    const resolveGrainForMaterial = (currentGrain: GrainDirection | undefined): GrainDirection => {
      if (!mat.hasGrain) return 'none';
      return currentGrain === 'width' ? 'width' : 'length';
    };

    if (applyToWholeGroup && part.groupId) {
      const grpParts = this.parts().filter(
        p => p.groupId === part.groupId && !(p.componentRole === 'back' && (p.thickness || 18) <= 6)
      );
      const updatesList = grpParts.map(p => ({
        part: p,
        updates: {
          materialId: mat.id,
          materialName: mat.name,
          colorHex: mat.colorHex,
          grain: resolveGrainForMaterial(p.grain)
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
        colorHex: mat.colorHex,
        grain: resolveGrainForMaterial(part.grain)
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
      const activeZoneGroupId = this.zoneBuilderGroupId();
      if (this.isZoneBuilderActive() && activeZoneGroupId && part.groupId === activeZoneGroupId) {
        this.zoneDeleteRequested.emit();
        this.closeContextMenu();
        return;
      }
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

  setExplodedPercent(percent: number): void {
    const numeric = Number(percent);
    const clamped = Number.isFinite(numeric)
      ? Math.max(0, Math.min(100, Math.round(numeric)))
      : 0;
    this.explodedPercent.set(clamped);
  }

  toggleExplodedView(defaultPercent = 50): void {
    this.setExplodedPercent(this.explodedPercent() > 0 ? 0 : defaultPercent);
  }

  resetExploded() {
    this.setExplodedPercent(0);
  }

  onExplodedSliderInput(e: Event) {
    const target = e.target as HTMLInputElement | null;
    if (target) {
      this.setExplodedPercent(Number(target.value));
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
    const hostedParts = this.collectHostedPartsForGroupIds(
      new Set([groupId]),
      new Set(grpParts.map(p => p.id))
    );

    const box = this.buildWorldBoxForParts([...grpParts, ...hostedParts]);
    this.focusCameraOnBox(box);
  }

  /**
   * Enfoca suavemente la cámara orbital sobre una pieza individual en el espacio 3D.
   */
  focusCameraOnPart(partId: string) {
    if (!this.camera || !this.controls) return;
    const part = this.parts().find(p => p.id === partId);
    if (!part) return;

    const box = this.buildWorldBoxForParts([part]);
    this.focusCameraOnBox(box);
  }

  private buildWorldBoxForParts(targetParts: Part[]): THREE.Box3 {
    const box = new THREE.Box3();
    let hasValidMesh = false;
    for (const p of targetParts) {
      const pieceObj = this.pieceObjects.find(po => po.part.id === p.id);
      if (pieceObj && pieceObj.mesh) {
        box.expandByObject(pieceObj.mesh);
        hasValidMesh = true;
      }
    }

    // Fallback if meshes are not yet resolved
    if (!hasValidMesh || box.isEmpty()) {
      for (const p of targetParts) {
        const aabb = this.partGeometry.getWorldAABB(p);
        box.expandByPoint(new THREE.Vector3(aabb.minX, aabb.minY, aabb.minZ));
        box.expandByPoint(new THREE.Vector3(aabb.maxX, aabb.maxY, aabb.maxZ));
      }
    }
    return box;
  }

  private focusCameraOnBox(box: THREE.Box3) {
    if (!this.camera || !this.controls || box.isEmpty()) return;

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
      if (!this.camera || !this.controls) return;
      const elapsed = time - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      this.controls.target.lerpVectors(startTarget, center, ease);
      this.camera.position.lerpVectors(startCamPos, targetCamPos, ease);
      this.camera.lookAt(this.controls.target);
      this.controls.update();
      this.updateProjectedMeasureBadges();
      this.requestRender(4);

      if (progress < 1) {
        requestAnimationFrame(animateFocus);
      }
    };

    requestAnimationFrame(animateFocus);
  }

  toggleGroupAnimation(groupId: string, forceOpen?: boolean) {
    const grpParts = this.getPartsForGroup(groupId);
    if (grpParts.length === 0) return;

    const grp = this.partGroups().find(g => g.id === groupId);
    const hostedGroupIds = this.getHostedGroupIdsForHostIds(new Set([groupId]));
    const hostedParts = this.parts().filter(
      p => Boolean(p.groupId) && hostedGroupIds.has(p.groupId as string)
    );
    const allScopeParts = [...grpParts, ...hostedParts];
    const movableParts = allScopeParts.filter(p => this.isMovableDoorOrDrawerPart(p));
    const checkTargets = movableParts.length > 0 ? movableParts : allScopeParts;

    const anyOpen = checkTargets.some(p => {
      const targetVal = this.openTargetMap.get(p.id);
      if (targetVal !== undefined) return targetVal > 0.5;
      if (grp && this.isModularDrawerGroup(groupId)) {
        const ext = grp.slideExtension !== undefined ? grp.slideExtension : (grp.isOpen ? 1 : 0);
        return ext > 0.5;
      }
      return false;
    });
    const next = forceOpen !== undefined ? (forceOpen ? 1 : 0) : (anyOpen ? 0 : 1);

    for (const gp of allScopeParts) {
      this.openTargetMap.set(gp.id, next);
    }
    for (const p of this.pieceObjects) {
      if (
        p.part.groupId === groupId ||
        (Boolean(p.part.groupId) && hostedGroupIds.has(p.part.groupId as string))
      ) {
        this.openTargetMap.set(p.part.id, next);
      }
    }
    if (this.isModularDrawerGroup(groupId)) {
      this.projectStorage.setGroupSlideExtension(groupId, next);
    }
    for (const hId of hostedGroupIds) {
      if (this.isModularDrawerGroup(hId)) {
        this.projectStorage.setGroupSlideExtension(hId, next);
      }
    }
    this.syncIsAllOpenSignal();
    this.bumpOpenStateRevision();
    this.requestRender(60);
  }

  isGroupOpen(groupId: string): boolean {
    this.openStateRevision();
    const grpParts = this.getPartsForGroup(groupId);
    if (grpParts.length === 0) return false;
    const hostedGroupIds = this.getHostedGroupIdsForHostIds(new Set([groupId]));
    const hostedParts = this.parts().filter(
      p => Boolean(p.groupId) && hostedGroupIds.has(p.groupId as string)
    );
    const allScopeParts = [...grpParts, ...hostedParts];
    const movableParts = allScopeParts.filter(p => this.isMovableDoorOrDrawerPart(p));
    const checkTargets = movableParts.length > 0 ? movableParts : [grpParts[0]];
    return checkTargets.some(p => (this.openTargetMap.get(p.id) || 0) > 0.5);
  }
moveGroupStep(groupId: string, axis: 'x' | 'y' | 'z', delta: number) {
    const grpParts = this.getPartsForGroup(groupId);
    if (grpParts.length === 0) return;
    const hostedParts = this.collectHostedPartsForGroupIds(
      new Set([groupId]),
      new Set(grpParts.map(p => p.id))
    );
    const allGroupParts = [...grpParts, ...hostedParts];

    let effDelta = delta;
    if (axis === 'y') {
      const grpMinY = this.getPartsMinY(allGroupParts);
      effDelta = Math.max(-grpMinY, delta);
    }

    const updatesList: { part: Part; updates: Partial<Part> }[] = [];
    for (const p of allGroupParts) {
      const b = this.getPartBounds(p);
      const upd: Partial<Part> = {};
      if (axis === 'x') upd.posX = Math.round(((p.posX ?? 0) + effDelta) * 10) / 10;
      if (axis === 'y') upd.posY = Math.round(((p.posY ?? b.sy / 2) + effDelta) * 10) / 10;
      if (axis === 'z') upd.posZ = Math.round(((p.posZ ?? 0) + effDelta) * 10) / 10;
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
    this.disposeGroup(this.selectionOutlineGroup);
    this.selectionOutlineGroup.visible = false;
    this.clearLegSnapGuides();
  }

  toggleMeasureMode() {
    const next = !this.isMeasureMode();
    this.isMeasureMode.set(next);
    if (next) {
      this.activeTool.set('measure');
      if (this.controls) {
        this.controls.enabled = true;
      }
    } else {
      if (this.activeTool() === 'measure') {
        this.activeTool.set('select');
      }
      this.cancelActiveMeasurementTrace();
    }
    const canvas = this.canvasRef()?.nativeElement;
    if (canvas) {
      canvas.style.cursor = next ? 'crosshair' : 'default';
    }
    this.requestRender(6);
  }

  clearMeasure() {
    this.clearAllMeasurements();
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

    const hostedParts = this.collectHostedPartsForDraggedParts(selList);
    const allMovedParts = hostedParts.length > 0 ? [...selList, ...hostedParts] : selList;

    this.dragStarted.emit();

    let effDelta = delta;
    if (axis === 'y') {
      let minY = Infinity;
      for (const p of allMovedParts) {
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

    if (allMovedParts.length > 1 || (allMovedParts.length > 0 && targetApps.length > 0) || targetApps.length > 1) {
      if (allMovedParts.length > 0) {
        const updatesList: { part: Part; updates: Partial<Part> }[] = [];
        for (const p of allMovedParts) {
          const b = this.getPartBounds(p);
          const upd: Partial<Part> = {};
          if (axis === 'x') upd.posX = Math.round(((p.posX ?? 0) + effDelta) * 10) / 10;
          if (axis === 'y') upd.posY = Math.round(((p.posY ?? b.sy / 2) + effDelta) * 10) / 10;
          if (axis === 'z') upd.posZ = Math.round(((p.posZ ?? 0) + effDelta) * 10) / 10;
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

  private readonly singleKeyToolActions: Record<string, () => void> = {
    m: () => this.setActiveTool('move'),
    q: () => this.setActiveTool('rotate_90'),
    s: () => this.toggleMagneticSnap(),
    t: () => this.setActiveTool('measure'),
    o: () => this.toggleSmartDoorsAndDrawers(),
    x: () => this.toggleXRay(),
    p: () => this.toggleDrillHoles(),
    d: () => this.toggleDimensions(),
    k: () => this.toggleClearances(),
    j: () => this.toggleHardware(),
    c: () => this.toggleGroupsFlyout(),
    i: () => this.toggleTheme(),
    g: () => this.toggleReferenceGuide(),
    z: () => this.resetCamera()
  };

  handleViewerKeyDown(e: KeyboardEvent) {
    if (this.isRenderingPaused) return;

    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        target.getAttribute?.('contenteditable') === 'true')
    ) {
      return;
    }

    if (e.key === 'Shift') {
      this.isShiftPressed.set(true);
      if (this.isMeasureMode() && this.measurePointA()) {
        this.reprojectActiveMeasurePreview(true);
      }
    }

    const hasModifier = e.ctrlKey || e.metaKey || e.altKey;
    const lowerKey = e.key.toLowerCase();

    // V o Barra Espaciadora: Herramienta Seleccionar
    if (!hasModifier && (lowerKey === 'v' || e.key === ' ' || e.code === 'Space')) {
      e.preventDefault();
      this.setActiveTool('select');
      return;
    }

    // R: Rotar 90° pieza, cajón, electrodoméstico o módulo seleccionado (si vacío, activa herramienta)
    if (!hasModifier && lowerKey === 'r') {
      const selParts = this.selectedParts();
      const selAppIds = this.activeSelectedApplianceIds();
      const targetApps = this.appliances().filter(a => selAppIds.includes(a.id));

      if (selParts.length === 0 && targetApps.length === 0) {
        e.preventDefault();
        this.setActiveTool('rotate_90');
        return;
      }
      return;
    }

    // H: Ocultar / Mostrar pieza o selección (solo si el visor gestiona el ocultamiento internamente)
    if (!hasModifier && lowerKey === 'h') {
      if (this.manageHideInternally()) {
        e.preventDefault();
        this.applyInternalHideToggle();
      }
      return;
    }

    const directAction = !hasModifier ? this.singleKeyToolActions[lowerKey] : undefined;
    if (directAction) {
      e.preventDefault();
      directAction();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.inlineDimensionEditor()) {
        this.cancelInlineDimension();
        return;
      }
      if (this.isMeasureMode() && this.measurePointA()) {
        this.cancelActiveMeasurementTrace();
        return;
      }
      this.closeContextMenu();
      this.clearSelection();
      this.cancelActiveMeasurementTrace();
      this.clearPushPullHighlight();
      this.clearRectPreview();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Del') {
      if (this.isZoneBuilderActive()) {
        e.preventDefault();
        this.zoneDeleteRequested.emit();
        return;
      }
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
        if (!hasModifier) {
          e.preventDefault();
          this.nudgePart('y', step);
        }
        break;
    }
  }

  handleViewerKeyUp(e: KeyboardEvent) {
    if (e.key === 'Shift') {
      this.isShiftPressed.set(false);
      if (this.isMeasureMode() && this.measurePointA()) {
        this.reprojectActiveMeasurePreview(false);
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

  private resolveWallIdFromObject(obj: THREE.Object3D): string | undefined {
    let curr: THREE.Object3D | null = obj;
    while (curr && curr !== this.roomGroup && curr !== this.scene) {
      if (curr.userData?.['isFloor'] || curr.userData?.['isGrid']) {
        return undefined;
      }
      const id = curr.userData?.['wallId'] || curr.userData?.['wallType'];
      if (typeof id === 'string' && id.length > 0) {
        return id;
      }
      curr = curr.parent;
    }
    return undefined;
  }

  private getWallPlaneDeltaXZ(e: PointerEvent): { deltaX: number; deltaZ: number } {
    const canIntersect = Math.abs(this.raycaster.ray.direction.y) > 0.03;
    if (canIntersect && this.raycaster.ray.intersectPlane(this.dragPlane, this.scratchCurrentIntersection)) {
      return {
        deltaX: this.scratchCurrentIntersection.x - this.dragPlaneIntersectionStart.x,
        deltaZ: this.scratchCurrentIntersection.z - this.dragPlaneIntersectionStart.z
      };
    }
    const dx = (e.clientX - this.dragStartPointer.x) * 1.5;
    const dy = (e.clientY - this.dragStartPointer.y) * 1.5;
    const camAngle = this.controls.getAzimuthalAngle();
    const sin = Math.sin(camAngle);
    const cos = Math.cos(camAngle);
    return {
      deltaX: dx * cos + dy * sin,
      deltaZ: -dx * sin + dy * cos
    };
  }

  private applyLiveWallTranslation(
    activeWall: RoomWallInstance,
    cfg: RoomConfiguration,
    allWalls: RoomWallInstance[],
    rawCandX: number,
    rawCandZ: number
  ) {
    const floorW = cfg.floorWidth || 5000;
    const floorD = cfg.floorDepth || 5000;
    const wallThick = activeWall.thickness || cfg.wallThickness || 150;
    const { halfSpanX, halfSpanZ } = getWallHalfSpans(activeWall.length, wallThick, activeWall.rotationY || 0);
    const minFloorX = -(floorW / 2) + halfSpanX;
    const maxFloorX = (floorW / 2) - halfSpanX;
    const minFloorZ = -(floorD / 2) + halfSpanZ;
    const maxFloorZ = (floorD / 2) - halfSpanZ;

    let candX = minFloorX <= maxFloorX ? Math.max(minFloorX, Math.min(maxFloorX, rawCandX)) : 0;
    let candZ = minFloorZ <= maxFloorZ ? Math.max(minFloorZ, Math.min(maxFloorZ, rawCandZ)) : 0;

    const snapRes = this.calculateWallToWallSnap(activeWall, candX, candZ, allWalls);
    if (snapRes.isSnapped) {
      candX = minFloorX <= maxFloorX ? Math.max(minFloorX, Math.min(maxFloorX, snapRes.snappedX)) : 0;
      candZ = minFloorZ <= maxFloorZ ? Math.max(minFloorZ, Math.min(maxFloorZ, snapRes.snappedZ)) : 0;
      this.renderWallToWallSnapGuide(snapRes);
    } else {
      this.clearWallSnapGuides();
    }

    candX = Math.round(candX);
    candZ = Math.round(candZ);

    this.updateLiveWallTransform(activeWall.id, candX, candZ, activeWall.height);
    this.pendingWallUpdates = { wallId: activeWall.id, updates: { posX: candX, posZ: candZ } };
    this.requestRender(2);
  }

  private updateLiveWallTransform(wallId: string, posX: number, posZ: number, wallHeight?: number) {
    const wallMesh = this.roomGroup.children.find(
      child => child.userData?.['isWall'] && (child.userData?.['wallId'] === wallId || child.userData?.['wallType'] === wallId)
    );
    if (wallMesh) {
      wallMesh.position.x = posX;
      if (wallHeight !== undefined) {
        wallMesh.position.y = wallHeight / 2;
      }
      wallMesh.position.z = posZ;
      wallMesh.updateMatrixWorld(true);

      if (this.selectedWallType() === wallId) {
        this.updateWallGizmo(wallId, this.roomConfig(), this.workspaceMode(), {
          posX,
          posZ,
          ...(wallHeight !== undefined ? { height: wallHeight } : {})
        });
      }
    }
  }

  private updateLiveWallGeometryAndGizmo(
    activeWall: RoomWallInstance,
    overrides: Partial<RoomWallInstance>
  ) {
    const wallMesh = this.roomGroup.children.find(
      child => child.userData?.['isWall'] && (child.userData?.['wallId'] === activeWall.id || child.userData?.['wallType'] === activeWall.id)
    ) as THREE.Mesh | undefined;
    if (wallMesh) {
      const baseL = (wallMesh.userData['initialGeoLength'] as number) || this.initialWallLength || activeWall.length;
      const baseH = (wallMesh.userData['initialGeoHeight'] as number) || this.initialWallHeight || activeWall.height;
      const nextL = overrides.length ?? activeWall.length;
      const nextH = overrides.height ?? activeWall.height;
      const nextPosX = overrides.posX ?? activeWall.posX;
      const nextPosZ = overrides.posZ ?? activeWall.posZ;

      const scaleX = baseL > 0 ? nextL / baseL : 1;
      const scaleY = baseH > 0 ? nextH / baseH : 1;
      wallMesh.scale.set(scaleX, scaleY, 1);
      wallMesh.position.set(nextPosX, nextH / 2, nextPosZ);

      const skirtingH = (wallMesh.userData['skirtingHeight'] as number) || 100;
      for (const child of wallMesh.children) {
        if (child.userData?.['isSkirting'] && scaleY > 0) {
          child.scale.set(1, 1 / scaleY, 1);
          child.position.y = -baseH / 2 + skirtingH / (2 * scaleY);
        }
      }
      wallMesh.updateMatrixWorld(true);
    }

    this.updateWallGizmo(activeWall.id, this.roomConfig(), this.workspaceMode(), overrides);
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

    const movingRot = (((movingWall.rotationY || 0) % 360) + 360) % 360;
    const isMovingHoriz = movingRot === 0 || movingRot === 180;
    const isMovingVert = movingRot === 90 || movingRot === 270;
    if (!isMovingHoriz && !isMovingVert) {
      return { isSnapped: false, snappedX: candX, snappedZ: candZ, guide: null };
    }

    const movingHalfL = movingWall.length / 2;
    const movingHalfT = movingWall.thickness / 2;

    const otherWalls = allWalls.filter(w => w.id !== movingWall.id && !w.isHidden);

    for (const other of otherWalls) {
      const otherRot = (((other.rotationY || 0) % 360) + 360) % 360;
      const isOtherHoriz = otherRot === 0 || otherRot === 180;
      const isOtherVert = otherRot === 90 || otherRot === 270;
      if (!isOtherHoriz && !isOtherVert) continue;

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
      const wallRot = (((wall.rotationY || 0) % 360) + 360) % 360;
      const isHoriz = wallRot === 0 || wallRot === 180;
      const isVert = wallRot === 90 || wallRot === 270;
      if (!isHoriz && !isVert) continue;

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
      ctx.font = 'bold 22px "Inter", -apple-system, sans-serif';
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
      ctx.font = 'bold 21px "Inter", -apple-system, sans-serif';
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
      ctx.font = 'bold 21px "Inter", -apple-system, sans-serif';
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
    this.updateProjectedMeasureBadges();
    this.projectStorage.saveCameraState(this.camera.position, this.controls.target, true);
    this.requestRender(12);
  }

  private isCarcassStructurePart(part: Part): boolean {
    return (
      part.componentRole === 'side_left' ||
      part.componentRole === 'side_right' ||
      part.componentRole === 'top' ||
      part.componentRole === 'bottom' ||
      part.componentRole === 'divider' ||
      part.componentRole === 'tie' ||
      part.componentRole === 'plinth' ||
      part.componentRole === 'back' ||
      part.componentRole === 'shelf' ||
      part.componentRole === 'countertop' ||
      part.componentRole === 'backsplash'
    );
  }

  private isMovableDoorPart(part: Part): boolean {
    const piece = this.pieceObjectMap.get(part.id);
    if (piece) return Boolean(piece.isDoor);
    if (this.isExplicitNonDoorRole(part.componentRole) && part.hardwareConfig?.movableType !== 'door') {
      return false;
    }
    const upperName = (part.name || '').toUpperCase();
    return (
      (part.hardwareConfig?.movableType === 'door' ||
        part.componentRole === 'door' ||
        upperName.includes('PUERTA')) &&
      !upperName.includes('CAJ')
    );
  }

  private isMovableDrawerPart(part: Part): boolean {
    const piece = this.pieceObjectMap.get(part.id);
    if (piece) return Boolean(piece.isDrawer);
    if (this.isCarcassStructurePart(part) || this.isMovableDoorPart(part)) {
      return false;
    }
    const upperName = (part.name || '').toUpperCase();
    const isInternalBoxPart =
      this.isDrawerSubPartRole(part) ||
      (upperName.includes('CAJ') &&
        (upperName.includes('LATERAL') ||
          upperName.includes('COSTADO') ||
          upperName.includes('TRASERA') ||
          upperName.includes('FONDO') ||
          upperName.includes('CONTRAFRENTE') ||
          upperName.includes('INTERIOR')));
    const isDrawerFront =
      part.hardwareConfig?.movableType === 'drawer' ||
      (upperName.includes('FRENTE') &&
        (upperName.includes('CAJ') || upperName.includes('GAVET'))) ||
      ((upperName.startsWith('CAJ') || upperName.startsWith('GAVET')) && !isInternalBoxPart);
    const isInModularDrawerGroup = !!part.groupId && this.isModularDrawerGroup(part.groupId);
    return isInModularDrawerGroup || isDrawerFront || isInternalBoxPart;
  }

  private isMovableDoorOrDrawerPart(part: Part): boolean {
    return this.isMovableDoorPart(part) || this.isMovableDrawerPart(part);
  }

  private isPartTargetOpen(part: Part): boolean {
    const mapVal = this.openTargetMap.get(part.id);
    if (mapVal !== undefined) {
      return mapVal > 0.5;
    }
    if (part.groupId && this.isModularDrawerGroup(part.groupId)) {
      const grp = this.partGroups().find(g => g.id === part.groupId);
      if (grp) {
        const ext = grp.slideExtension !== undefined ? grp.slideExtension : (grp.isOpen ? 1 : 0);
        return ext > 0.5;
      }
    }
    return false;
  }

  private extractEmbeddedDrawerPrefix(partId: string): string {
    const boxSubKeywords = ['_frente', '_lat_izq', '_lat_der', '_contrafrente', '_trasera', '_frente_int', '_fondo'];
    for (const kw of boxSubKeywords) {
      if (partId.includes(kw)) {
        return partId.split(kw)[0];
      }
    }
    if (partId.includes('caj_ind_')) {
      const match = partId.match(/caj_ind_\d+/);
      if (match) return match[0];
    }
    return '';
  }

  private syncIsAllOpenSignal(): void {
    const movables =
      this.pieceObjects.length > 0
        ? this.pieceObjects.filter(p => p.isDoor || p.isDrawer).map(p => p.part)
        : this.parts().filter(p => this.isMovableDoorOrDrawerPart(p));
    if (movables.length === 0) {
      this.isAllOpen.set(false);
      return;
    }
    this.isAllOpen.set(movables.every(p => this.isPartTargetOpen(p)));
  }

  private collectModuleMovables(moduleGroupIds: string[]): { parts: Part[]; groupIds: string[] } {
    const baseGroupIds = new Set(moduleGroupIds);
    const hostedDrawerGroupIds = new Set<string>();
    for (const grp of this.partGroups()) {
      const hostId = grp.hostGroupId ?? grp.drawerConfig?.hostGroupId ?? grp.drawerConfig?.targetModuleId;
      if (hostId && baseGroupIds.has(hostId) && this.isModularDrawerGroup(grp.id)) {
        hostedDrawerGroupIds.add(grp.id);
      }
    }

    const allTargetGroupIds = new Set<string>([...baseGroupIds, ...hostedDrawerGroupIds]);
    const matchedParts: Part[] = [];
    const seenPartIds = new Set<string>();

    for (const part of this.parts()) {
      const inModuleGroup = !!part.groupId && allTargetGroupIds.has(part.groupId);
      const inModuleId = !!part.moduleId && baseGroupIds.has(part.moduleId);
      if ((inModuleGroup || inModuleId) && this.isMovableDoorOrDrawerPart(part) && !seenPartIds.has(part.id)) {
        seenPartIds.add(part.id);
        matchedParts.push(part);
      }
    }

    return {
      parts: matchedParts,
      groupIds: Array.from(allTargetGroupIds)
    };
  }

  private resolveSmartOpenScope(): {
    mode: 'single' | 'module' | 'global';
    parts: Part[];
    representativePart?: Part;
    groupIds?: string[];
  } {
    const curGrp = this.currentSelectedGroup();
    const selParts = this.selectedParts();
    const allParts = this.parts();

    if (selParts.length === 0 && !curGrp) {
      return {
        mode: 'global',
        parts: allParts.filter(p => this.isMovableDoorOrDrawerPart(p))
      };
    }

    // Rule 1a: Whole selection belongs to a single modular drawer sub-group
    if (selParts.length > 0) {
      const groupIds = Array.from(new Set(selParts.map(p => p.groupId).filter((id): id is string => !!id)));
      if (groupIds.length === 1 && this.isModularDrawerGroup(groupIds[0])) {
        const drawerParts = allParts.filter(p => p.groupId === groupIds[0]);
        const rep =
          selParts.find(p => p.componentRole === 'drawer_front') ??
          drawerParts.find(p => p.componentRole === 'drawer_front') ??
          selParts[0];
        return {
          mode: 'single',
          representativePart: rep,
          parts: drawerParts.length > 0 ? drawerParts : selParts,
          groupIds: [groupIds[0]]
        };
      }
    }

    if (curGrp && this.isModularDrawerGroup(curGrp.id)) {
      const drawerParts = allParts.filter(p => p.groupId === curGrp.id);
      if (drawerParts.length > 0) {
        const rep = drawerParts.find(p => p.componentRole === 'drawer_front') ?? drawerParts[0];
        return {
          mode: 'single',
          representativePart: rep,
          parts: drawerParts,
          groupIds: [curGrp.id]
        };
      }
    }

    // Rule 1b: Single selected door or drawer piece (when not whole-module group selection)
    if (!curGrp && selParts.length === 1) {
      const single = selParts[0];
      if (this.isMovableDoorPart(single)) {
        const sibling = this.findPairedDoorSiblingForPart(single);
        return {
          mode: 'single',
          representativePart: single,
          parts: sibling ? [single, sibling] : [single]
        };
      }
      if (this.isMovableDrawerPart(single)) {
        const prefix = this.extractEmbeddedDrawerPrefix(single.id);
        const drawerUnitParts = prefix
          ? allParts.filter(
              p =>
                p.id === single.id ||
                ((!single.groupId || p.groupId === single.groupId) &&
                  (p.id.startsWith(`${prefix}_`) || p.id.includes(`${prefix}_`) || p.id === prefix))
            )
          : [single];
        return {
          mode: 'single',
          representativePart: single,
          parts: drawerUnitParts
        };
      }
      // Single non-movable carcass piece: try its parent module before falling back to global
      if (single.groupId) {
        const modScope = this.collectModuleMovables([single.groupId]);
        if (modScope.parts.length > 0) {
          return {
            mode: 'module',
            parts: modScope.parts,
            groupIds: modScope.groupIds
          };
        }
      }
      return {
        mode: 'global',
        parts: allParts.filter(p => this.isMovableDoorOrDrawerPart(p))
      };
    }

    // Rule 2: Full module group selected (non-modular-drawer)
    if (curGrp) {
      const modScope = this.collectModuleMovables([curGrp.id]);
      return {
        mode: 'module',
        parts: modScope.parts,
        groupIds: modScope.groupIds
      };
    }

    // Multi-part selection without active group: full module(s) if carcass/full group selected, otherwise selected movables
    const selectedIdSet = new Set(selParts.map(p => p.id));
    const involvedNonDrawerGroupIds = Array.from(
      new Set(selParts.map(p => p.groupId).filter((id): id is string => !!id && !this.isModularDrawerGroup(id)))
    );
    const hasCarcassOrFullGroup = involvedNonDrawerGroupIds.some(gId => {
      const groupParts = allParts.filter(p => p.groupId === gId);
      const allSelected = groupParts.length > 0 && groupParts.every(p => selectedIdSet.has(p.id));
      const hasCarcassSelected = selParts.some(p => p.groupId === gId && !this.isMovableDoorOrDrawerPart(p));
      return allSelected || hasCarcassSelected;
    });

    if (hasCarcassOrFullGroup && involvedNonDrawerGroupIds.length > 0) {
      const modScope = this.collectModuleMovables(involvedNonDrawerGroupIds);
      return {
        mode: 'module',
        parts: modScope.parts,
        groupIds: modScope.groupIds
      };
    }

    const selectedMovables = selParts.filter(p => this.isMovableDoorOrDrawerPart(p));
    if (selectedMovables.length > 0) {
      const expandedParts: Part[] = [...selectedMovables];
      const expandedIds = new Set(expandedParts.map(p => p.id));
      for (const m of selectedMovables) {
        if (this.isMovableDoorPart(m)) {
          const sibling = this.findPairedDoorSiblingForPart(m);
          if (sibling && !expandedIds.has(sibling.id)) {
            expandedIds.add(sibling.id);
            expandedParts.push(sibling);
          }
        } else if (m.groupId && this.isModularDrawerGroup(m.groupId)) {
          for (const gp of allParts) {
            if (gp.groupId === m.groupId && !expandedIds.has(gp.id)) {
              expandedIds.add(gp.id);
              expandedParts.push(gp);
            }
          }
        }
      }
      return {
        mode: 'module',
        parts: expandedParts,
        groupIds: Array.from(
          new Set(expandedParts.map(p => p.groupId).filter((id): id is string => !!id && this.isModularDrawerGroup(id)))
        )
      };
    }

    return {
      mode: 'global',
      parts: allParts.filter(p => this.isMovableDoorOrDrawerPart(p))
    };
  }

  toggleSmartDoorsAndDrawers(): void {
    const scope = this.resolveSmartOpenScope();

    if (scope.mode === 'global') {
      this.toggleAllDoorsAndDrawers();
      return;
    }

    if (scope.mode === 'single' && scope.representativePart) {
      this.togglePartOpen(scope.representativePart.id);
      return;
    }

    const moduleMovables = scope.parts;
    if (moduleMovables.length === 0) return;

    const anyOpen = moduleMovables.some(p => this.isPartTargetOpen(p));
    const next = anyOpen ? 0 : 1;
    const targetPartIds = new Set(moduleMovables.map(p => p.id));
    const touchedDrawerGroupIds = new Set<string>(scope.groupIds ?? []);

    for (const p of moduleMovables) {
      this.openTargetMap.set(p.id, next);
      if (p.groupId && this.isModularDrawerGroup(p.groupId)) {
        touchedDrawerGroupIds.add(p.groupId);
      }
    }
    for (const piece of this.pieceObjects) {
      if ((piece.isDoor || piece.isDrawer) && targetPartIds.has(piece.part.id)) {
        this.openTargetMap.set(piece.part.id, next);
      }
    }
    for (const gId of touchedDrawerGroupIds) {
      if (this.isModularDrawerGroup(gId)) {
        this.projectStorage.setGroupSlideExtension(gId, next);
      }
    }

    this.syncIsAllOpenSignal();
    this.bumpOpenStateRevision();
    this.requestRender(60);
  }

  togglePartOpen(partId: string) {
    const targetPiece = this.pieceObjects.find(p => p.part.id === partId);
    const targetPart = targetPiece?.part ?? this.parts().find(p => p.id === partId);

    let cur = this.openTargetMap.get(partId);
    if (cur === undefined && targetPart?.groupId && this.isModularDrawerGroup(targetPart.groupId)) {
      const grp = this.partGroups().find(g => g.id === targetPart.groupId);
      if (grp) {
        cur = grp.slideExtension !== undefined ? grp.slideExtension : (grp.isOpen ? 1 : 0);
      }
    }
    const next = (cur ?? 0) > 0.5 ? 0 : 1;
    this.openTargetMap.set(partId, next);

    if (targetPart) {
      // 0. If part is a door with a paired sibling (2 Puertas / Doble Hoja), synchronize both leaves together
      if (targetPiece?.isDoor || this.isDoorCandidatePart(targetPart)) {
        const siblingDoor = this.findPairedDoorSiblingForPart(targetPart);
        if (siblingDoor) {
          this.openTargetMap.set(siblingDoor.id, next);
        }
      }

      // 1. If part belongs to a modular drawer group, synchronize all parts in that drawer group AND persist in store
      const gId = targetPart.groupId;
      const isDedicatedDrawerGroup = !!gId && this.isModularDrawerGroup(gId);

      if (isDedicatedDrawerGroup && gId) {
        for (const gp of this.parts()) {
          if (gp.groupId === gId) {
            this.openTargetMap.set(gp.id, next);
          }
        }
        for (const p of this.pieceObjects) {
          if (p.part.groupId === gId) {
            this.openTargetMap.set(p.part.id, next);
          }
        }
        this.projectStorage.setGroupSlideExtension(gId, next);
      } else if (targetPiece?.isDrawer) {
        const targetY = targetPiece.originalPos.y;
        const specificPrefix = this.extractEmbeddedDrawerPrefix(targetPart.id);

        // Synchronize ONLY sub-components that are part of the EXACT same physical drawer box
        for (const p of this.pieceObjects) {
          if (p.isDrawer && p.part.id !== partId) {
            // If a specific drawer prefix is identified, match that exact prefix
            if (
              specificPrefix &&
              (!targetPart.groupId || p.part.groupId === targetPart.groupId) &&
              (p.part.id.startsWith(specificPrefix + '_') ||
                p.part.id.includes(specificPrefix + '_') ||
                p.part.id === specificPrefix)
            ) {
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
      } else if (this.isMovableDrawerPart(targetPart)) {
        const specificPrefix = this.extractEmbeddedDrawerPrefix(targetPart.id);
        if (specificPrefix) {
          for (const candidate of this.parts()) {
            if (
              candidate.id !== partId &&
              (!targetPart.groupId || candidate.groupId === targetPart.groupId) &&
              (candidate.id.startsWith(specificPrefix + '_') ||
                candidate.id.includes(specificPrefix + '_') ||
                candidate.id === specificPrefix)
            ) {
              this.openTargetMap.set(candidate.id, next);
            }
          }
        }
      }
    }

    this.syncIsAllOpenSignal();
    this.bumpOpenStateRevision();
    this.requestRender(60);
  }

  toggleAllDoorsAndDrawers() {
    const next = !this.isAllOpen();
    const targetVal = next ? 1 : 0;
    this.isAllOpen.set(next);

    const touchedModularDrawerGroupIds = new Set<string>();
    for (const p of this.pieceObjects) {
      if (p.isDoor || p.isDrawer) {
        this.openTargetMap.set(p.part.id, targetVal);
        if (p.part.groupId && this.isModularDrawerGroup(p.part.groupId)) {
          touchedModularDrawerGroupIds.add(p.part.groupId);
        }
      }
    }
    for (const part of this.parts()) {
      if (this.isMovableDoorOrDrawerPart(part)) {
        this.openTargetMap.set(part.id, targetVal);
        if (part.groupId && this.isModularDrawerGroup(part.groupId)) {
          touchedModularDrawerGroupIds.add(part.groupId);
        }
      }
    }
    for (const groupId of touchedModularDrawerGroupIds) {
      this.projectStorage.setGroupSlideExtension(groupId, targetVal);
    }

    this.bumpOpenStateRevision();
    this.requestRender(60);
  }

  private timer = new THREE.Timer();

  private applyLinearSlideTransform(
    item: PieceMeshData,
    curOpen: number,
    expFactor: number
  ): void {
    const expX = expFactor > 0 ? item.explodedOffset.x * expFactor : 0;
    const expY = expFactor > 0 ? item.explodedOffset.y * expFactor + (item.currentFloorLiftY ?? 0) : 0;
    const expZ = expFactor > 0 ? item.explodedOffset.z * expFactor : 0;
    const maxSlide = item.isSlidingDoor ? (item.slideDistanceMm ?? 320) : 320;
    const axis = item.slideAxis || (item.isSlidingDoor ? 'x' : 'z');
    const dir = item.slideDir ?? 1;

    item.mesh.position.set(
      item.originalPos.x + expX + (axis === 'x' ? curOpen * maxSlide * dir : 0),
      item.originalPos.y + expY + (axis === 'y' ? curOpen * maxSlide * dir : 0),
      item.originalPos.z + expZ + (axis === 'z' ? curOpen * maxSlide * dir : 0)
    );
  }

  private updateOpeningAnimations(delta = 0.016): boolean {
    let anyAnimating = false;
    let anyOpeningChanged = false;
    const lerpFactor = Math.min(1, delta * 9.5);
    const expFactor = Math.max(0, Math.min(1, Number(this.explodedPercent()) / 100 || 0));
    for (const p of this.pieceObjects) {
      if (!p.isDoor && !p.isDrawer) continue;
      const tgt = this.openTargetMap.get(p.part.id) || 0;
      let cur = this.openCurrentMap.get(p.part.id) || 0;
      if (Math.abs(cur - tgt) > 0.001) {
        cur += (tgt - cur) * lerpFactor;
        this.openCurrentMap.set(p.part.id, cur);
        anyAnimating = true;
        anyOpeningChanged = true;
      } else {
        if (cur !== tgt) {
          anyOpeningChanged = true;
        }
        cur = tgt;
        this.openCurrentMap.set(p.part.id, cur);
      }

      if (p.isDoor && p.isSlidingDoor) {
        this.applyLinearSlideTransform(p, cur, expFactor);
      } else if (p.isDoor && p.doorPivot) {
        this.applyDoorPivotRotation(p.doorPivot, p.hingeSide || 'left', p.doorFacing || 'front', cur, p.doorBaseRotation);
      } else if (p.isDrawer) {
        this.applyLinearSlideTransform(p, cur, expFactor);
      }
    }
    if (anyOpeningChanged) {
      this.sceneRaycastPicker.refreshPickableMatricesAndBounds(this.furnitureGroup);
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
    this.updateProjectedMeasureBadges();
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
        this.updateProjectedMeasureBadges();
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
      roomGrid.userData = { isGrid: true, isAuxiliaryVisual: true };
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

      const wallThickness = wall.thickness || config.wallThickness || 150;
      const wallGeo = new THREE.BoxGeometry(wall.length, wall.height, wallThickness);
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

      const hasSkirting = wall.showSkirting ?? showSkirting;
      const skirtingH = 100;
      const skirtingT = 16;
      wallMesh.userData = {
        isWall: true,
        wallId: wall.id,
        wallType: wall.id,
        initialGeoLength: wall.length,
        initialGeoHeight: wall.height,
        initialGeoThickness: wallThickness,
        ...(hasSkirting ? { skirtingHeight: skirtingH } : {})
      };
      this.roomGroup.add(wallMesh);

      // Zócalo / Rodapié inferior (Frontal y Trasero)
      if (hasSkirting) {
        // Zócalo frontal (+Z local)
        const frontSkirtingGeo = new THREE.BoxGeometry(wall.length, skirtingH, skirtingT);
        const frontSkirting = new THREE.Mesh(frontSkirtingGeo, skirtingMat);
        frontSkirting.position.set(0, -wall.height / 2 + skirtingH / 2, wallThickness / 2 + skirtingT / 2);
        frontSkirting.castShadow = true;
        frontSkirting.receiveShadow = true;
        frontSkirting.userData = {
          isWall: true,
          wallId: wall.id,
          wallType: wall.id,
          isSkirting: true,
          side: 'front'
        };
        wallMesh.add(frontSkirting);

        // Zócalo posterior (-Z local)
        const backSkirtingGeo = new THREE.BoxGeometry(wall.length, skirtingH, skirtingT);
        const backSkirting = new THREE.Mesh(backSkirtingGeo, skirtingMat);
        backSkirting.position.set(0, -wall.height / 2 + skirtingH / 2, -wallThickness / 2 - skirtingT / 2);
        backSkirting.castShadow = true;
        backSkirting.receiveShadow = true;
        backSkirting.userData = {
          isWall: true,
          wallId: wall.id,
          wallType: wall.id,
          isSkirting: true,
          side: 'back'
        };
        wallMesh.add(backSkirting);
      }
    }
    this.sceneRaycastPicker.refreshPickableMatricesAndBounds(this.roomGroup);
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
      this.updateProjectedMeasureBadges();
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
    mode: WorkspaceMode,
    liveOverride?: Partial<RoomWallInstance>
  ) {
    // Clear previous wall gizmos recursively
    this.disposeGroup(this.wallGizmoGroup);
    this.wallGizmoHitMeshes = [];

    if (mode !== 'room' || !wallType) {
      this.requestRender(4);
      return;
    }

    const walls = getResolvedRoomWalls(config);
    const baseWall = walls.find(w => w.id === wallType);
    if (!baseWall || baseWall.isHidden || config.hiddenWalls?.[wallType]) {
      this.requestRender(4);
      return;
    }

    const wall: RoomWallInstance = liveOverride ? { ...baseWall, ...liveOverride } : baseWall;
    const wallThickness = wall.thickness || config.wallThickness || 150;
    const rotRad = -((wall.rotationY || 0) * (Math.PI / 180));
    const posX = wall.posX;
    const posY = wall.height / 2;
    const posZ = wall.posZ;

    // 1. Highlight Outline Mesh around selected wall (Sky Blue)
    const outlineGeo = new THREE.BoxGeometry(wall.length + 6, wall.height + 6, wallThickness + 6);
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
    outlineLines.userData = { isOutline: true, isAuxiliaryVisual: true };
    this.wallGizmoGroup.add(outlineLines);

    // Si el muro está congelado / fijo, bloqueamos sus controles interactivos y mostramos únicamente el outline
    const isWallLocked = !!config.isWallsLocked || !!wall.isLocked || !!config.lockedWalls?.[wallType];
    if (isWallLocked) {
      this.wallGizmoGroup.updateMatrixWorld(true);
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

      const arrowUserData: WallGizmoHitData = {
        isWallGizmo: true,
        type: 'wall_move',
        gizmoType: 'wall_move',
        axis,
        wallTarget: wall.id,
        wallId: wall.id
      };
      shaft.userData = arrowUserData;
      shaft.renderOrder = 999;
      head.userData = arrowUserData;
      head.renderOrder = 999;
      arrowGroup.add(shaft, head);

      // Transparent raycastable hit collider (transparent: true, opacity: 0 — visible: false is ignored by Raycaster)
      const hitBoxGeo = new THREE.BoxGeometry(
        axis === 'x' ? arrowLen + arrowHeadLen + 24 : 56,
        56,
        axis === 'z' ? arrowLen + arrowHeadLen + 24 : 56
      );
      const hitMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const hitMesh = new THREE.Mesh(hitBoxGeo, hitMat);
      hitMesh.position.set(
        axis === 'x' ? (arrowLen + arrowHeadLen) / 2 : 0,
        0,
        axis === 'z' ? (arrowLen + arrowHeadLen) / 2 : 0
      );
      hitMesh.userData = arrowUserData;
      hitMesh.renderOrder = 999;
      arrowGroup.add(hitMesh);
      this.wallGizmoHitMeshes.push(shaft, head, hitMesh);

      return arrowGroup;
    };

    const gizmoAnchor = new THREE.Vector3(posX, wall.height + 120, posZ);
    const arrowX = createArrowMesh(0xef4444, 'x', gizmoAnchor);
    const arrowZ = createArrowMesh(0x0284c7, 'z', gizmoAnchor);
    this.wallGizmoGroup.add(arrowX, arrowZ);

    const handleSize = 36;
    const hitSize = handleSize + 36;
    const addCubeHandleWithCollider = (
      colorHex: number,
      emissiveIntensity: number,
      position: THREE.Vector3,
      rotationY: number,
      userData: WallGizmoHitData
    ) => {
      const handleGeo = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
      const handleMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity,
        roughness: 0.2,
        depthTest: false
      });
      const handleMesh = new THREE.Mesh(handleGeo, handleMat);
      const handleEdge = new THREE.LineSegments(
        new THREE.EdgesGeometry(handleGeo),
        new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, depthTest: false })
      );
      handleEdge.userData = { isOutline: true, isAuxiliaryVisual: true };
      handleMesh.add(handleEdge);
      handleMesh.position.copy(position);
      handleMesh.rotation.y = rotationY;
      handleMesh.userData = userData;
      handleMesh.renderOrder = 999;

      const hitGeo = new THREE.BoxGeometry(hitSize, hitSize, hitSize);
      const hitMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.copy(position);
      hitMesh.rotation.y = rotationY;
      hitMesh.userData = userData;
      hitMesh.renderOrder = 999;

      this.wallGizmoGroup.add(handleMesh, hitMesh);
      this.wallGizmoHitMeshes.push(handleMesh, hitMesh);
    };

    // 3. Dual Stretch Handles at both ends of the wall (+1 right, -1 left - Emerald)
    const endDist = wall.length / 2 + handleSize / 2 + 10;
    for (const endSign of [1, -1] as const) {
      const handleX = posX + endSign * endDist * Math.cos(rotRad);
      const handleZ = posZ - endSign * endDist * Math.sin(rotRad);
      addCubeHandleWithCollider(
        0x10b981,
        0.4,
        new THREE.Vector3(handleX, posY, handleZ),
        rotRad,
        {
          isWallGizmo: true,
          type: 'wall_stretch',
          gizmoType: 'wall_stretch',
          axis: 'x',
          endSign,
          wallTarget: wall.id,
          wallId: wall.id
        }
      );
    }

    // 4. Tirante 3D Superior de Altura (Cube handle - Amber / Eje Y)
    addCubeHandleWithCollider(
      0xf59e0b,
      0.45,
      new THREE.Vector3(posX, wall.height + handleSize / 2 + 8, posZ),
      0,
      {
        isWallGizmo: true,
        type: 'wall_stretch_height',
        gizmoType: 'wall_stretch_height',
        axis: 'y',
        wallTarget: wall.id,
        wallId: wall.id
      }
    );

    this.wallGizmoGroup.updateMatrixWorld(true);
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
    const activeAppIds = new Set(
      appls.filter(a => !this.isApplianceVisuallyHidden(a)).map(a => a.id)
    );
    for (const [id, grp] of this.applianceMeshMap.entries()) {
      if (!activeAppIds.has(id)) {
        this.appliancesGroup.remove(grp);
        this.disposeGroup(grp);
        this.applianceMeshMap.delete(id);
      }
    }

    // 3. Actualización diferencial por ID: sólo se reconstruye si cambian dimensiones o tipo
    for (const app of appls) {
      if (this.isApplianceVisuallyHidden(app)) continue;

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
        boxLines.userData = { isOutline: true, isAuxiliaryVisual: true };
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
        ringMesh.userData = { isFloorCircle: true, isAuxiliaryVisual: true };
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
          groundRing.userData = { isFloorCircle: true, isAuxiliaryVisual: true };
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
          plumbLine.userData = { isOutline: true, isAuxiliaryVisual: true };
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
          edges.userData = { isOutline: true, isAuxiliaryVisual: true };
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
    this.sceneRaycastPicker.refreshPickableMatricesAndBounds(this.appliancesGroup);
    this.applianceGizmoGroup.updateMatrixWorld(true);
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
          this.sceneRaycastPicker.refreshPickableMatricesAndBounds(glbGroup);
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
    if (
      group === this.dimensionGroup ||
      group === this.internalClearanceGroup ||
      group === this.selectionOutlineGroup ||
      group === this.zoneHighlightGroup
    ) {
      group.position.set(0, 0, 0);
      group.rotation.set(0, 0, 0);
    }
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
            if (this.hoveredDimensionTooltip() !== null) {
              this.ngZone.run(() => {
                this.hoveredDimensionTooltip.set(null);
              });
            }
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
      canvas.removeEventListener('pointerleave', this.boundPointerLeave);
      canvas.removeEventListener('wheel', this.boundCanvasWheel);
    }
    if (this.clearanceToastTimer !== null) {
      clearTimeout(this.clearanceToastTimer);
      this.clearanceToastTimer = null;
    }
    if (this.isolationToastTimer !== null) {
      clearTimeout(this.isolationToastTimer);
      this.isolationToastTimer = null;
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
    this.disposeGroup(this.selectionOutlineGroup);
    this.disposeGroup(this.zoneHighlightGroup);
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
