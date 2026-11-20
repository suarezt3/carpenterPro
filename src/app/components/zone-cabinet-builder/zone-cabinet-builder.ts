import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HugeiconsIconComponent, IconSvgObject } from '@hugeicons/angular';
import {
  Add01Icon,
  Alert02Icon,
  Archive01Icon,
  ArrowDataTransferHorizontalIcon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowReloadHorizontalIcon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Bookshelf01Icon,
  Cabinet01Icon,
  Cabinet02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CubeIcon,
  Delete02Icon,
  Exchange01Icon,
  InformationCircleIcon,
  KitchenUtensilsIcon,
  Layers01Icon,
  LayoutLinearIcon,
  LayoutUIcon,
  PaintBoardIcon,
  RulerIcon,
  SlidersHorizontalIcon,
  SquareIcon,
  TableIcon,
  Tick02Icon,
  Wardrobe01Icon
} from '@hugeicons/core-free-icons';
import {
  CabinetAppliancePreset,
  CabinetBaseType,
  CabinetDoorOpeningType,
  CabinetDoorPanelStyle,
  CabinetDrawerHeightDistribution,
  CabinetGolaFinish,
  CabinetInstallationType,
  CabinetLegStyle,
  CabinetOpeningSystem,
  CabinetRodFinish,
  CabinetShoeRackStopType,
  CabinetVitrinaFrameFinish,
  CabinetVitrinaGlassType,
  CabinetWallMountType,
  CabinetZoneApplianceNicheConfig,
  CabinetZoneContent,
  CabinetZoneDoorConfig,
  CabinetZoneDrawerConfig,
  CabinetZoneLayoutNode,
  CabinetZoneNode,
  CabinetZoneShoeRackConfig,
  DoorHandleVerticalPosition,
  HandleFinish,
  HandleType,
  HingeType,
  isCountertopMaterial,
  isStoneMaterial,
  Material,
  ParametricCabinetConfig,
  Part,
  SlideType,
  ZoneContentType
} from '../../models/melamine.models';
import {
  CabinetGeneratorService,
  computeZoneBoundsLayout,
  normalizeDrawerHeightsForSpan
} from '../../services/cabinet-generator.service';

export interface ZoneBreadcrumbItem {
  id: string;
  label: string;
}

export interface LabeledOption<T extends string> {
  id: T;
  label: string;
}

interface ZoneTreeSummary {
  shelvesCount: number;
  drawersCount: number;
  doorsCount: number;
  lastDoorOpening: ParametricCabinetConfig['doorOpening'];
  rodsCount: 0 | 1 | 2;
  hasHandle: boolean;
  handleType?: HandleType;
  handleFinish?: HandleFinish;
  handlePosition?: DoorHandleVerticalPosition;
  hingeType?: HingeType;
  drawerSlideType?: Exclude<SlideType, 'none'>;
  openingSystem?: CabinetOpeningSystem;
  fingerPullDeductMm?: number;
  golaFinish?: CabinetGolaFinish;
  hangingRodFinish?: CabinetRodFinish;
}

const VALID_ZONE_SLIDE_TYPES: ReadonlySet<Exclude<SlideType, 'none'>> = new Set([
  'telescopic',
  'soft_close',
  'telescopic_35',
  'undermount',
  'push_open'
]);

function resolveValidZoneSlideType(raw: string | undefined): Exclude<SlideType, 'none'> {
  if (raw && VALID_ZONE_SLIDE_TYPES.has(raw as Exclude<SlideType, 'none'>)) {
    return raw as Exclude<SlideType, 'none'>;
  }
  return 'telescopic';
}

function isPhysicalHandleType(ht: HandleType | undefined): boolean {
  return Boolean(
    ht &&
      ht !== 'none' &&
      ht !== 'push' &&
      ht !== 'push_open' &&
      ht !== 'gola' &&
      ht !== 'gola_less' &&
      ht !== 'finger_pull'
  );
}

function normalizeHandleVerticalPosition(
  pos: DoorHandleVerticalPosition | undefined
): 'top' | 'center' | 'bottom' {
  if (pos === 'top' || pos === 'bottom') return pos;
  return 'center';
}

function resolveOpeningSystemFromDoor(
  doors: CabinetZoneDoorConfig | undefined,
  fallbackHandle?: HandleType
): CabinetOpeningSystem {
  if (
    doors?.openingSystem === 'handle' ||
    doors?.openingSystem === 'push' ||
    doors?.openingSystem === 'finger_pull' ||
    doors?.openingSystem === 'gola'
  ) {
    return doors.openingSystem;
  }
  const ht = doors?.handleType ?? fallbackHandle;
  if (ht === 'gola' || ht === 'gola_less') return 'gola';
  if (ht === 'finger_pull') return 'finger_pull';
  if (ht === 'push' || ht === 'push_open' || ht === 'none') return 'push';
  if (doors && doors.hasHandle === false) return 'push';
  return 'handle';
}

function resolveOpeningSystemFromDrawer(
  drawers: CabinetZoneDrawerConfig | undefined
): CabinetOpeningSystem {
  if (
    drawers?.openingSystem === 'handle' ||
    drawers?.openingSystem === 'push' ||
    drawers?.openingSystem === 'finger_pull' ||
    drawers?.openingSystem === 'gola'
  ) {
    return drawers.openingSystem;
  }
  if (drawers?.slideType === 'push_open') return 'push';
  return 'handle';
}

const BOARD_THICKNESS_OPTIONS: readonly number[] = [15, 18, 19, 25];

const LEG_HEIGHT_PRESETS: readonly number[] = [100, 120, 150, 200];

const CABINET_LEG_STYLE_OPTIONS: readonly LabeledOption<CabinetLegStyle>[] = [
  { id: 'black_leveler', label: 'Niveladora Negra' },
  { id: 'cylindrical_inox', label: 'Cilíndrica Inox' },
  { id: 'scandinavian_wood', label: 'Nórdica Madera' },
  { id: 'hairpin_metal', label: 'Horquilla Metálica' }
];

const CABINET_WALL_MOUNT_OPTIONS: readonly LabeledOption<CabinetWallMountType>[] = [
  { id: 'french_cleat', label: 'Listón Francés (Corte 45°)' },
  { id: 'concealed_hanger', label: 'Colgadores Ocultos' },
  { id: 'direct_nailer', label: 'Amarres Traseros Directos' }
];

const CABINET_OPENING_SYSTEM_OPTIONS: readonly LabeledOption<CabinetOpeningSystem>[] = [
  { id: 'handle', label: 'Con Manija' },
  { id: 'push', label: 'Push-to-Open' },
  { id: 'finger_pull', label: 'Uñero (45°)' },
  { id: 'gola', label: 'Perfil Gola' }
];

const CABINET_GOLA_FINISH_OPTIONS: readonly LabeledOption<CabinetGolaFinish>[] = [
  { id: 'natural_aluminum', label: 'Aluminio Natural' },
  { id: 'matte_black', label: 'Negro Mate' },
  { id: 'white', label: 'Blanco' },
  { id: 'champagne', label: 'Champagne' }
];

const CABINET_ROD_FINISH_OPTIONS: readonly LabeledOption<CabinetRodFinish>[] = [
  { id: 'chrome', label: 'Cromado' },
  { id: 'matte_black', label: 'Negro Mate' },
  { id: 'gold', label: 'Dorado' }
];

const HANDLE_VERTICAL_POSITION_OPTIONS: readonly LabeledOption<'top' | 'center' | 'bottom'>[] = [
  { id: 'top', label: 'Superior' },
  { id: 'center', label: 'Centrada' },
  { id: 'bottom', label: 'Inferior' }
];

const CABINET_DOOR_OPENING_OPTIONS: readonly LabeledOption<CabinetDoorOpeningType>[] = [
  { id: 'left', label: 'Izq.' },
  { id: 'right', label: 'Der.' },
  { id: 'double', label: 'Doble' },
  { id: 'top', label: 'Abat. Sup.' },
  { id: 'bottom', label: 'Abat. Inf.' },
  { id: 'sliding', label: 'Corredizas' }
];

const CABINET_VITRINA_FRAME_OPTIONS: readonly LabeledOption<CabinetVitrinaFrameFinish>[] = [
  { id: 'matte_black', label: 'Negro Mate' },
  { id: 'natural_aluminum', label: 'Aluminio Natural' },
  { id: 'gold', label: 'Dorado' }
];

const CABINET_VITRINA_GLASS_OPTIONS: readonly LabeledOption<CabinetVitrinaGlassType>[] = [
  { id: 'clear', label: 'Transparente' },
  { id: 'bronze_smoked', label: 'Bronce / Ahumado' },
  { id: 'frosted', label: 'Esmerilado' }
];

interface AppliancePresetOption {
  id: CabinetAppliancePreset;
  label: string;
  widthMm: number;
  heightMm: number;
}

const CABINET_APPLIANCE_PRESET_OPTIONS: readonly AppliancePresetOption[] = [
  { id: 'oven_60', label: 'Horno 60cm (564×595)', widthMm: 564, heightMm: 595 },
  { id: 'microwave_60', label: 'Microondas 60cm (564×385)', widthMm: 564, heightMm: 385 },
  { id: 'custom', label: 'Medida Libre', widthMm: 564, heightMm: 595 }
];

const INTERNAL_DRAWER_OPENING_OPTIONS: readonly LabeledOption<'finger_pull' | 'handle' | 'push'>[] = [
  { id: 'finger_pull', label: 'Uñero' },
  { id: 'handle', label: 'Frente Liso' },
  { id: 'push', label: 'Push' }
];

function isHingedDoorOpening(opening: CabinetDoorOpeningType | undefined): boolean {
  return opening === 'left' || opening === 'right' || opening === 'double';
}

function isLiftDoorOpening(opening: CabinetDoorOpeningType | undefined): boolean {
  return opening === 'top' || opening === 'bottom';
}

function resolveHingeSpacerSides(opening: CabinetDoorOpeningType): {
  hingeSpacerLeft: boolean;
  hingeSpacerRight: boolean;
} {
  return {
    hingeSpacerLeft: opening === 'left' || opening === 'double',
    hingeSpacerRight: opening === 'right' || opening === 'double'
  };
}

const DEFAULT_DRAWER_CONFIG: CabinetZoneDrawerConfig = {
  count: 3,
  frontMount: 'overlay',
  deductTopMm: 0,
  deductBottomMm: 0,
  deductLeftMm: 0,
  deductRightMm: 0,
  openingSystem: 'handle',
  slideType: 'telescopic',
  bottomType: 'grooved',
  heightDistribution: 'equal'
};

const DEFAULT_DOOR_CONFIG: CabinetZoneDoorConfig = {
  opening: 'left',
  mount: 'overlay',
  hasHandle: true,
  openingSystem: 'handle',
  handleType: 'bar_modern',
  handleFinish: 'brushed_steel',
  handlePosition: 'center',
  panelStyle: 'melamine'
};

const DEFAULT_SHOE_RACK_CONFIG: CabinetZoneShoeRackConfig = {
  levelsCount: 4,
  angleDeg: 15,
  frontStopType: 'aluminum_profile'
};

const DEFAULT_APPLIANCE_NICHE_CONFIG: CabinetZoneApplianceNicheConfig = {
  preset: 'oven_60',
  cavityWidthMm: 564,
  cavityHeightMm: 595,
  openRearVentilation: true
};

function deepCloneDrawerConfig(dCfg: CabinetZoneDrawerConfig): CabinetZoneDrawerConfig {
  return {
    ...dCfg,
    ...(Array.isArray(dCfg.customHeightsMm)
      ? { customHeightsMm: [...dCfg.customHeightsMm] }
      : {})
  };
}

function deepCloneZoneContent(content: CabinetZoneContent): CabinetZoneContent {
  return {
    ...content,
    drawers: content.drawers ? deepCloneDrawerConfig(content.drawers) : undefined,
    internalDrawers: content.internalDrawers
      ? deepCloneDrawerConfig(content.internalDrawers)
      : undefined,
    doors: content.doors ? { ...content.doors } : undefined,
    shoeRack: content.shoeRack ? { ...content.shoeRack } : undefined,
    applianceNiche: content.applianceNiche ? { ...content.applianceNiche } : undefined
  };
}

function deepCloneZoneNode(node: CabinetZoneNode): CabinetZoneNode {
  return {
    id: node.id,
    splitDirection: node.splitDirection || 'none',
    ...(node.exactSizeMm !== undefined ? { exactSizeMm: node.exactSizeMm } : {}),
    ...(node.sizeRatio !== undefined ? { sizeRatio: node.sizeRatio } : {}),
    content: node.content
      ? deepCloneZoneContent(node.content)
      : node.splitDirection === 'none'
        ? { type: 'empty' }
        : undefined,
    children: Array.isArray(node.children)
      ? node.children.map(child => deepCloneZoneNode(child))
      : undefined
  };
}

function findZoneNodeById(root: CabinetZoneNode, targetId: string): CabinetZoneNode | null {
  if (root.id === targetId) return root;
  if (!root.children) return null;
  for (const child of root.children) {
    const found = findZoneNodeById(child, targetId);
    if (found) return found;
  }
  return null;
}

function findParentZoneNode(
  root: CabinetZoneNode,
  targetId: string,
  parent: CabinetZoneNode | null = null
): CabinetZoneNode | null {
  if (root.id === targetId) return parent;
  if (!root.children) return null;
  for (const child of root.children) {
    const found = findParentZoneNode(child, targetId, root);
    if (found) return found;
  }
  return null;
}

function findZonePath(root: CabinetZoneNode, targetId: string): ZoneBreadcrumbItem[] {
  const walk = (node: CabinetZoneNode, label: string): ZoneBreadcrumbItem[] | null => {
    const current: ZoneBreadcrumbItem = { id: node.id, label };
    if (node.id === targetId) {
      return [current];
    }
    if (!node.children || node.children.length === 0) {
      return null;
    }
    for (let i = 0; i < node.children.length; i++) {
      const childLabel =
        node.splitDirection === 'vertical'
          ? `Col. ${i + 1}`
          : node.splitDirection === 'horizontal'
            ? `Nivel ${i + 1}`
            : `Zona ${i + 1}`;
      const subPath = walk(node.children[i], childLabel);
      if (subPath) {
        return [current, ...subPath];
      }
    }
    return null;
  };
  return walk(root, 'Raíz') ?? [{ id: root.id, label: 'Raíz' }];
}

function findLayoutNodeById(
  root: CabinetZoneLayoutNode,
  targetId: string
): CabinetZoneLayoutNode | null {
  if (root.zoneId === targetId) return root;
  for (const child of root.children) {
    const found = findLayoutNodeById(child, targetId);
    if (found) return found;
  }
  return null;
}

function findParentLayoutNode(
  root: CabinetZoneLayoutNode,
  targetId: string,
  parent: CabinetZoneLayoutNode | null = null
): CabinetZoneLayoutNode | null {
  if (root.zoneId === targetId) return parent;
  for (const child of root.children) {
    const found = findParentLayoutNode(child, targetId, root);
    if (found) return found;
  }
  return null;
}

function updateZoneNodeInTree(
  root: CabinetZoneNode,
  targetId: string,
  updater: (node: CabinetZoneNode) => CabinetZoneNode
): CabinetZoneNode {
  if (root.id === targetId) {
    return updater(deepCloneZoneNode(root));
  }
  if (!root.children) {
    return root;
  }
  return {
    ...root,
    children: root.children.map(child => updateZoneNodeInTree(child, targetId, updater))
  };
}

function summarizeZoneTree(root: CabinetZoneNode): ZoneTreeSummary {
  let shelvesCount = 0;
  let drawersCount = 0;
  let doorsCount = 0;
  let rodsCountNum = 0;
  const doorSummary: { lastOpening: ParametricCabinetConfig['doorOpening'] } = {
    lastOpening: 'none'
  };
  let hasHandle = false;
  let handleType: HandleType | undefined;
  let fallbackDoorHandleType: HandleType | undefined;
  let nonDoorHandleType: HandleType | undefined;
  let handleFinish: HandleFinish | undefined;
  let handlePosition: DoorHandleVerticalPosition | undefined;
  let hingeType: HingeType | undefined;
  let drawerSlideType: Exclude<SlideType, 'none'> | undefined;
  let openingSystem: CabinetOpeningSystem | undefined;
  let fingerPullDeductMm: number | undefined;
  let golaFinish: CabinetGolaFinish | undefined;
  let hangingRodFinish: CabinetRodFinish | undefined;

  const visit = (node: CabinetZoneNode) => {
    if (node.splitDirection === 'horizontal' && node.children && node.children.length > 1) {
      shelvesCount += node.children.length - 1;
    }

    const content = node.content;
    if (content) {
      if (content.type === 'shelves' && content.shelvesCount) {
        shelvesCount += Math.max(0, content.shelvesCount);
      } else if (content.type === 'drawers' && content.drawers) {
        drawersCount += Math.max(0, content.drawers.count);
        const dOpen = resolveOpeningSystemFromDrawer(content.drawers);
        if (!openingSystem) {
          openingSystem = dOpen;
        }
        if (dOpen === 'handle') {
          hasHandle = true;
        } else if (!nonDoorHandleType) {
          nonDoorHandleType =
            dOpen === 'push'
              ? 'push_open'
              : dOpen === 'gola'
                ? 'gola_less'
                : 'finger_pull';
        }
        if (
          dOpen === 'finger_pull' &&
          content.drawers.fingerPullDeductMm !== undefined &&
          fingerPullDeductMm === undefined
        ) {
          fingerPullDeductMm = content.drawers.fingerPullDeductMm;
        }
        if (dOpen === 'gola' && content.drawers.golaFinish && !golaFinish) {
          golaFinish = content.drawers.golaFinish;
        }
        if (!drawerSlideType && content.drawers.slideType) {
          drawerSlideType = resolveValidZoneSlideType(content.drawers.slideType);
        }
      } else if (content.type === 'doors' && content.doors) {
        if (content.doors.opening === 'double') {
          doorsCount += 2;
          doorSummary.lastOpening = 'double';
        } else if (content.doors.opening === 'sliding') {
          doorsCount += content.doors.slidingLeavesCount === 3 ? 3 : 2;
          doorSummary.lastOpening = 'sliding';
        } else {
          doorsCount += 1;
          doorSummary.lastOpening =
            content.doors.opening === 'right' ||
            content.doors.opening === 'top' ||
            content.doors.opening === 'bottom'
              ? content.doors.opening
              : 'left';
        }
        if (content.doors.opening !== 'sliding' && content.doors.hingeType && !hingeType) {
          hingeType = content.doors.hingeType;
        }
        if (content.internalDrawers && isHingedDoorOpening(content.doors.opening)) {
          drawersCount += Math.max(0, content.internalDrawers.count);
          if (!drawerSlideType && content.internalDrawers.slideType) {
            drawerSlideType = resolveValidZoneSlideType(content.internalDrawers.slideType);
          }
        }
        const doorOpen = resolveOpeningSystemFromDoor(content.doors);
        if (!openingSystem) {
          openingSystem = doorOpen;
        }
        if (
          doorOpen === 'handle' &&
          content.doors.hasHandle !== false &&
          isPhysicalHandleType(content.doors.handleType ?? 'bar_modern')
        ) {
          hasHandle = true;
          if (!handleType && content.doors.handleType) {
            handleType = content.doors.handleType;
          }
          if (!handlePosition && content.doors.handlePosition) {
            handlePosition = content.doors.handlePosition;
          }
        } else if (!fallbackDoorHandleType) {
          fallbackDoorHandleType =
            doorOpen === 'gola'
              ? 'gola_less'
              : doorOpen === 'finger_pull'
                ? 'finger_pull'
                : doorOpen === 'push'
                  ? content.doors.handleType === 'none'
                    ? 'none'
                    : 'push_open'
                  : content.doors.handleType || 'none';
        }
        if (
          doorOpen === 'finger_pull' &&
          content.doors.fingerPullDeductMm !== undefined &&
          fingerPullDeductMm === undefined
        ) {
          fingerPullDeductMm = content.doors.fingerPullDeductMm;
        }
        if (doorOpen === 'gola' && content.doors.golaFinish && !golaFinish) {
          golaFinish = content.doors.golaFinish;
        }
        if (!handleFinish && content.doors.handleFinish) {
          handleFinish = content.doors.handleFinish;
        }
        if (content.shelvesCount) {
          shelvesCount += Math.max(0, content.shelvesCount);
        }
        if (content.hangingRodsCount) {
          rodsCountNum += content.hangingRodsCount;
          if (content.hangingRodFinish && !hangingRodFinish) {
            hangingRodFinish = content.hangingRodFinish;
          }
        }
      } else if (content.type === 'hanging_rod' && content.hangingRodsCount) {
        rodsCountNum += content.hangingRodsCount;
        if (content.hangingRodFinish && !hangingRodFinish) {
          hangingRodFinish = content.hangingRodFinish;
        }
        if (content.hangingRodsCount === 2) {
          shelvesCount += 1;
        }
      }
    }

    if (node.children) {
      for (const ch of node.children) {
        visit(ch);
      }
    }
  };

  visit(root);

  const rodsCount: 0 | 1 | 2 = rodsCountNum >= 2 ? 2 : rodsCountNum === 1 ? 1 : 0;

  return {
    shelvesCount,
    drawersCount,
    doorsCount,
    lastDoorOpening:
      doorSummary.lastOpening === 'sliding'
        ? 'sliding'
        : doorsCount >= 2
          ? 'double'
          : doorsCount === 1
            ? doorSummary.lastOpening
            : 'none',
    rodsCount,
    hasHandle,
    handleType:
      handleType ??
      fallbackDoorHandleType ??
      (doorsCount === 0 && drawersCount > 0 && !hasHandle ? nonDoorHandleType : undefined),
    handleFinish,
    handlePosition,
    hingeType,
    drawerSlideType,
    openingSystem,
    fingerPullDeductMm,
    golaFinish,
    hangingRodFinish
  };
}

function clampNumber(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Constructor paramétrico recursivo por zonas (Paso A: Caja Exterior + Paso B: Subdivisión 2D y Contenidos).
 */
@Component({
  selector: 'app-zone-cabinet-builder',
  standalone: true,
  imports: [NgTemplateOutlet, HugeiconsIconComponent],
  templateUrl: './zone-cabinet-builder.html',
  styleUrl: './zone-cabinet-builder.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ZoneCabinetBuilderComponent {
  private readonly cabinetGen = inject(CabinetGeneratorService);

  readonly initialConfig = input<ParametricCabinetConfig | null>(null);
  readonly materials = input<Material[]>([]);
  readonly editingGroupId = input<string | null>(null);
  readonly manualParts = input<Part[]>([]);

  readonly configLiveChange = output<ParametricCabinetConfig>();
  readonly highlightedZoneChange = output<string | null>();
  readonly confirmed = output<ParametricCabinetConfig>();
  readonly cancelled = output<void>();
  readonly removeManualPartRequested = output<string>();

  readonly icons: Record<string, IconSvgObject> = {
    cube: CubeIcon,
    layers: Layers01Icon,
    ruler: RulerIcon,
    palette: PaintBoardIcon,
    add: Add01Icon,
    remove: Cancel01Icon,
    undo: ArrowReloadHorizontalIcon,
    delete: Delete02Icon,
    confirm: CheckmarkCircle02Icon,
    tick: Tick02Icon,
    arrowUp: ArrowUp01Icon,
    arrowDown: ArrowDown01Icon,
    arrowLeft: ArrowLeft01Icon,
    arrowRight: ArrowRight01Icon,
    splitVertical: Exchange01Icon,
    splitHorizontal: TableIcon,
    sliding: ArrowDataTransferHorizontalIcon,
    empty: SquareIcon,
    shelves: Bookshelf01Icon,
    drawers: Archive01Icon,
    doors: Wardrobe01Icon,
    cabinet: Cabinet01Icon,
    hangingRod: LayoutLinearIcon,
    settings: SlidersHorizontalIcon,
    info: InformationCircleIcon,
    alert: Alert02Icon,
    appliance: KitchenUtensilsIcon,
    vent: ArrowReloadHorizontalIcon,
    shoeRack: Layers01Icon,
    fillerStrip: LayoutUIcon,
    anchor: ArrowUp01Icon,
    floorBase: Cabinet01Icon,
    wallMount: Cabinet02Icon
  };

  readonly thicknessOptions = BOARD_THICKNESS_OPTIONS;
  readonly legHeightPresets = LEG_HEIGHT_PRESETS;
  readonly legStyleOptions = CABINET_LEG_STYLE_OPTIONS;
  readonly wallMountOptions = CABINET_WALL_MOUNT_OPTIONS;
  readonly openingSystemOptions = CABINET_OPENING_SYSTEM_OPTIONS;
  readonly golaFinishOptions = CABINET_GOLA_FINISH_OPTIONS;
  readonly rodFinishOptions = CABINET_ROD_FINISH_OPTIONS;
  readonly handlePositionOptions = HANDLE_VERTICAL_POSITION_OPTIONS;
  readonly doorOpeningOptions = CABINET_DOOR_OPENING_OPTIONS;
  readonly vitrinaFrameOptions = CABINET_VITRINA_FRAME_OPTIONS;
  readonly vitrinaGlassOptions = CABINET_VITRINA_GLASS_OPTIONS;
  readonly appliancePresetOptions = CABINET_APPLIANCE_PRESET_OPTIONS;
  readonly internalDrawerOpeningOptions = INTERNAL_DRAWER_OPENING_OPTIONS;

  // Paso A — Estado del Casco Exterior y Montaje (Tarea 1, 2, 3)
  readonly moduleName = signal<string>('Módulo a Medida');
  readonly width = signal<number>(800);
  readonly height = signal<number>(800);
  readonly depth = signal<number>(500);
  readonly structureThickness = signal<number>(15);
  readonly doorThickness = signal<number>(15);
  readonly backThickness = signal<number>(3);
  readonly isCustomBackThickness = signal<boolean>(false);
  readonly installationType = signal<CabinetInstallationType>('floor');
  readonly wallMountType = signal<CabinetWallMountType>('french_cleat');
  readonly elevationY = signal<number>(1400);
  readonly frenchCleatHeightMm = signal<number>(80);
  readonly baseType = signal<CabinetBaseType>('plinth');
  readonly plinthHeight = signal<number>(80);
  readonly plinthRecessMm = signal<number>(40);
  readonly legStyle = signal<CabinetLegStyle>('cylindrical_inox');
  readonly backType = signal<'groove' | 'rebate' | 'overlay' | 'none'>('groove');
  readonly leftFillerStripEnabled = signal<boolean>(false);
  readonly leftFillerStripWidthMm = signal<number>(50);
  readonly rightFillerStripEnabled = signal<boolean>(false);
  readonly rightFillerStripWidthMm = signal<number>(50);
  readonly structureMaterialId = signal<string>('');
  readonly doorMaterialId = signal<string>('');
  readonly backMaterialId = signal<string>('');
  readonly useSameMaterialForDoors = signal<boolean>(true);
  readonly customizeVisibleSides = signal<boolean>(false);
  readonly visibleSideLeft = signal<boolean>(false);
  readonly visibleSideRight = signal<boolean>(false);
  readonly visibleTopCover = signal<boolean>(false);
  readonly visibleMaterialId = signal<string>('');
  readonly isPasoACollapsed = signal<boolean>(false);
  readonly isManualPartsExpanded = signal<boolean>(false);

  // Metadatos preservados de config inicial
  private preservedId: string | undefined;
  private preservedCode = 'ZON001';
  private preservedModuleType: ParametricCabinetConfig['moduleType'] = 'custom';
  private preservedCategory: ParametricCabinetConfig['category'] = 'custom';
  private preservedEnvironmentLine: ParametricCabinetConfig['environmentLine'];
  private readonly preservedPosX = signal<number | undefined>(undefined);
  private readonly preservedPosY = signal<number | undefined>(undefined);
  private readonly preservedPosZ = signal<number | undefined>(undefined);
  private preservedFacadeGap = 3;
  private preservedHasTopCover: boolean | undefined;
  private preservedTopTieStrips: boolean | undefined;
  private preservedSiphonCutout: ParametricCabinetConfig['siphonCutout'];
  private preservedCornerReturnWidth: number | undefined;
  private preservedHandlePosition: ParametricCabinetConfig['handlePosition'] = 'vertical';

  // Preferencias por defecto para tiradores, apertura, bisagras, correderas y barras
  readonly moduleHandleType = signal<HandleType>('bar_modern');
  readonly moduleHandleFinish = signal<HandleFinish>('brushed_steel');
  readonly moduleHandlePosition = signal<'top' | 'center' | 'bottom'>('center');
  readonly moduleHingeType = signal<HingeType | undefined>(undefined);
  readonly moduleDrawerSlideType = signal<Exclude<SlideType, 'none'>>('telescopic');
  readonly moduleOpeningSystem = signal<CabinetOpeningSystem>('handle');
  readonly moduleFingerPullDeductMm = signal<number>(26);
  readonly moduleGolaFinish = signal<CabinetGolaFinish>('natural_aluminum');
  readonly moduleHangingRodFinish = signal<CabinetRodFinish>('chrome');

  // Paso B — Árbol de Zonas, Selección e Historial
  readonly zoneTree = signal<CabinetZoneNode>({
    id: 'zone_root',
    splitDirection: 'none',
    content: { type: 'empty' }
  });
  readonly selectedZoneId = signal<string>('zone_root');
  readonly zoneHistory = signal<CabinetZoneNode[]>([]);

  private zoneUidCounter = 1;
  private lastEmittedConfig: ParametricCabinetConfig | null = null;

  /** Lista filtrada de tableros estructurales (excluye piedras/mesones y fondos delgados MDF). */
  readonly boardMaterials = computed<Material[]>(() => {
    const all = this.materials();
    const primary = all.filter(
      m =>
        !isStoneMaterial(m) &&
        !isCountertopMaterial(m) &&
        (m.thickness ?? 15) > 6 &&
        m.family !== 'mdf_back'
    );
    if (primary.length > 0) return primary;
    return all.filter(m => !isStoneMaterial(m) && !isCountertopMaterial(m));
  });

  /** Materiales aptos para trasera/fondo (MDF delgado primero, seguido de tableros no pétreos). */
  readonly backMaterials = computed<Material[]>(() => {
    const nonStone = this.materials().filter(
      m => !isStoneMaterial(m) && !isCountertopMaterial(m)
    );
    const thin = nonStone.filter(m => (m.thickness ?? 15) <= 6 || m.family === 'mdf_back');
    const boards = nonStone.filter(m => (m.thickness ?? 15) > 6 && m.family !== 'mdf_back');
    return [...thin, ...boards];
  });

  readonly selectedStructureMaterial = computed<Material | null>(() => {
    const id = this.structureMaterialId();
    return this.boardMaterials().find(m => m.id === id) ?? this.boardMaterials()[0] ?? null;
  });

  readonly selectedDoorMaterial = computed<Material | null>(() => {
    const id = this.useSameMaterialForDoors() ? this.structureMaterialId() : this.doorMaterialId();
    return this.boardMaterials().find(m => m.id === id) ?? this.selectedStructureMaterial();
  });

  readonly selectedVisibleMaterial = computed<Material | null>(() => {
    const id = this.visibleMaterialId() || this.structureMaterialId();
    return this.boardMaterials().find(m => m.id === id) ?? this.selectedStructureMaterial();
  });

  readonly selectedBackMaterial = computed<Material | null>(() => {
    const id = this.backMaterialId();
    return this.backMaterials().find(m => m.id === id) ?? this.backMaterials()[0] ?? null;
  });

  // Matriz estricta de visibilidad condicional (Tareas 1, 2 y 3)
  readonly showFloorBaseControls = computed<boolean>(() => this.installationType() === 'floor');
  readonly showWallMountControls = computed<boolean>(() => this.installationType() === 'wall');
  readonly showPlinthControls = computed<boolean>(
    () => this.installationType() === 'floor' && this.baseType() === 'plinth'
  );
  readonly showLegControls = computed<boolean>(
    () => this.installationType() === 'floor' && this.baseType() === 'legs'
  );
  readonly legsCountPreview = computed<number>(() => (this.width() > 1200 ? 6 : 4));
  readonly showFrenchCleatControls = computed<boolean>(
    () => this.installationType() === 'wall' && this.wallMountType() === 'french_cleat'
  );
  readonly showBackDetailsControls = computed<boolean>(() => this.backType() !== 'none');
  readonly showIndependentFrontMaterial = computed<boolean>(
    () => !this.useSameMaterialForDoors()
  );
  readonly showVisibleSidesControls = computed<boolean>(() => this.customizeVisibleSides());

  readonly currentConfig = computed<ParametricCabinetConfig>(() => this.buildConfigSnapshot());

  readonly layoutRoot = computed<CabinetZoneLayoutNode>(() =>
    computeZoneBoundsLayout(this.currentConfig())
  );

  readonly selectedZoneNode = computed<CabinetZoneNode>(() => {
    const tree = this.zoneTree();
    return findZoneNodeById(tree, this.selectedZoneId()) ?? tree;
  });

  readonly selectedDoorOpeningSystem = computed<CabinetOpeningSystem>(() => {
    const doors = this.selectedZoneNode().content?.doors;
    return doors
      ? resolveOpeningSystemFromDoor(doors, this.moduleHandleType())
      : this.moduleOpeningSystem();
  });

  readonly selectedDrawerOpeningSystem = computed<CabinetOpeningSystem>(() => {
    const drawers = this.selectedZoneNode().content?.drawers;
    return drawers ? resolveOpeningSystemFromDrawer(drawers) : this.moduleOpeningSystem();
  });

  readonly showDoorHandleControls = computed<boolean>(
    () =>
      this.selectedZoneNode().content?.type === 'doors' &&
      this.selectedDoorOpeningSystem() === 'handle'
  );
  readonly showDrawerHandleControls = computed<boolean>(
    () =>
      this.selectedZoneNode().content?.type === 'drawers' &&
      this.selectedDrawerOpeningSystem() === 'handle'
  );
  readonly showDoorFingerPullControls = computed<boolean>(
    () =>
      this.selectedZoneNode().content?.type === 'doors' &&
      this.selectedDoorOpeningSystem() === 'finger_pull'
  );
  readonly showDrawerFingerPullControls = computed<boolean>(
    () =>
      this.selectedZoneNode().content?.type === 'drawers' &&
      this.selectedDrawerOpeningSystem() === 'finger_pull'
  );
  readonly showFingerPullControls = computed<boolean>(
    () => this.showDoorFingerPullControls() || this.showDrawerFingerPullControls()
  );
  readonly showDoorGolaControls = computed<boolean>(
    () =>
      this.selectedZoneNode().content?.type === 'doors' &&
      this.selectedDoorOpeningSystem() === 'gola'
  );
  readonly showDrawerGolaControls = computed<boolean>(
    () =>
      this.selectedZoneNode().content?.type === 'drawers' &&
      this.selectedDrawerOpeningSystem() === 'gola'
  );
  readonly showGolaControls = computed<boolean>(
    () => this.showDoorGolaControls() || this.showDrawerGolaControls()
  );

  readonly selectedZoneHandlePosition = computed<'top' | 'center' | 'bottom'>(() => {
    const content = this.selectedZoneNode().content;
    if (content?.type === 'doors' && content.doors?.handlePosition) {
      return normalizeHandleVerticalPosition(content.doors.handlePosition);
    }
    return this.moduleHandlePosition();
  });

  readonly selectedZoneFingerPullDeductMm = computed<number>(() => {
    const content = this.selectedZoneNode().content;
    if (content?.type === 'doors' && content.doors?.fingerPullDeductMm !== undefined) {
      return content.doors.fingerPullDeductMm;
    }
    if (content?.type === 'drawers' && content.drawers?.fingerPullDeductMm !== undefined) {
      return content.drawers.fingerPullDeductMm;
    }
    return this.moduleFingerPullDeductMm();
  });

  readonly selectedZoneGolaFinish = computed<CabinetGolaFinish>(() => {
    const content = this.selectedZoneNode().content;
    if (content?.type === 'doors' && content.doors?.golaFinish) {
      return content.doors.golaFinish;
    }
    if (content?.type === 'drawers' && content.drawers?.golaFinish) {
      return content.drawers.golaFinish;
    }
    return this.moduleGolaFinish();
  });

  readonly selectedZoneHangingRodFinish = computed<CabinetRodFinish>(() => {
    return this.selectedZoneNode().content?.hangingRodFinish ?? this.moduleHangingRodFinish();
  });

  readonly selectedDoorConfig = computed<CabinetZoneDoorConfig | null>(() => {
    const c = this.selectedZoneNode().content;
    return c?.type === 'doors' && c.doors ? c.doors : null;
  });

  readonly isSelectedDoorHinged = computed<boolean>(() =>
    isHingedDoorOpening(this.selectedDoorConfig()?.opening)
  );

  readonly isSelectedDoorLift = computed<boolean>(() =>
    isLiftDoorOpening(this.selectedDoorConfig()?.opening)
  );

  readonly isSelectedDoorSliding = computed<boolean>(
    () => this.selectedDoorConfig()?.opening === 'sliding'
  );

  readonly isSelectedDoorVitrina = computed<boolean>(
    () => this.selectedDoorConfig()?.panelStyle === 'vitrina'
  );

  readonly showDoorHandlePositionSelector = computed<boolean>(
    () => this.showDoorHandleControls() && !this.isSelectedDoorLift()
  );

  readonly selectedZoneInternalDrawers = computed<CabinetZoneDrawerConfig | null>(() => {
    const c = this.selectedZoneNode().content;
    return c?.type === 'doors' && this.isSelectedDoorHinged() && c.internalDrawers
      ? c.internalDrawers
      : null;
  });

  readonly selectedDrawerHeightsMm = computed<number[]>(() => {
    const sel = this.selectedZoneNode();
    const dCfg = sel.content?.drawers;
    if (sel.content?.type !== 'drawers' || !dCfg) return [];
    return this.resolveNormalizedDrawerHeights(this.selectedLayoutNode(), dCfg, false);
  });

  readonly selectedDrawerMinSlotMm = computed<number>(() => {
    const sel = this.selectedZoneNode();
    const dCfg = sel.content?.drawers;
    if (sel.content?.type !== 'drawers' || !dCfg) return 90;
    const span = this.computeDrawerSpanMm(this.selectedLayoutNode(), dCfg, false);
    const count = clampNumber(Math.round(dCfg.count || 1), 1, 6);
    return Math.round(Math.min(90, span / count) * 10) / 10;
  });

  readonly selectedInternalDrawerHeightsMm = computed<number[]>(() => {
    const dCfg = this.selectedZoneInternalDrawers();
    if (!dCfg) return [];
    return this.resolveNormalizedDrawerHeights(this.selectedLayoutNode(), dCfg, true);
  });

  readonly selectedInternalDrawerMinSlotMm = computed<number>(() => {
    const dCfg = this.selectedZoneInternalDrawers();
    if (!dCfg) return 90;
    const span = this.computeDrawerSpanMm(this.selectedLayoutNode(), dCfg, true);
    const count = clampNumber(Math.round(dCfg.count || 1), 1, 6);
    return Math.round(Math.min(90, span / count) * 10) / 10;
  });

  readonly selectedZoneOuterWidthMm = computed<number>(() =>
    Math.round(this.selectedLayoutNode().innerWidth + 2 * this.structureThickness())
  );

  readonly canEnableSlidingInSelectedZone = computed<boolean>(
    () => this.selectedZoneOuterWidthMm() >= 900
  );

  readonly showHangingRodHeightWarning = computed<boolean>(() => {
    const content = this.selectedZoneNode().content;
    const rods = content?.hangingRodsCount ?? 0;
    return (
      (content?.type === 'hanging_rod' || content?.type === 'doors') &&
      rods === 2 &&
      this.selectedLayoutNode().innerHeight < 1500
    );
  });

  readonly showApplianceOverflowWarning = computed<boolean>(() => {
    const c = this.selectedZoneNode().content;
    if (c?.type !== 'appliance_niche' || !c.applianceNiche) return false;
    const layout = this.selectedLayoutNode();
    return (
      c.applianceNiche.cavityWidthMm > layout.innerWidth + 0.5 ||
      c.applianceNiche.cavityHeightMm > layout.innerHeight + 0.5
    );
  });

  readonly selectedParentZone = computed<CabinetZoneNode | null>(() =>
    findParentZoneNode(this.zoneTree(), this.selectedZoneNode().id)
  );

  readonly selectedLayoutNode = computed<CabinetZoneLayoutNode>(() => {
    const layout = this.layoutRoot();
    return findLayoutNodeById(layout, this.selectedZoneNode().id) ?? layout;
  });

  readonly selectedParentLayout = computed<CabinetZoneLayoutNode | null>(() =>
    findParentLayoutNode(this.layoutRoot(), this.selectedZoneNode().id)
  );

  readonly breadcrumbs = computed<ZoneBreadcrumbItem[]>(() =>
    findZonePath(this.zoneTree(), this.selectedZoneNode().id)
  );

  readonly selectedZoneSplitDirection = computed<'none' | 'horizontal' | 'vertical'>(
    () => this.selectedZoneNode().splitDirection
  );

  readonly selectedZoneDeleteAction = computed<'cleared_content' | 'removed_subzone' | 'noop'>(() => {
    const sel = this.selectedZoneNode();
    const hasContent = Boolean(sel.content && sel.content.type !== 'empty');
    const hasChildren =
      sel.splitDirection !== 'none' && Boolean(sel.children && sel.children.length > 0);
    if (hasContent || hasChildren) {
      return 'cleared_content';
    }
    const parent = this.selectedParentZone();
    if (parent && parent.children && parent.children.length > 1) {
      return 'removed_subzone';
    }
    return 'noop';
  });

  readonly selectedZoneExactBounds = computed<{
    hasParentSplit: boolean;
    axis: 'vertical' | 'horizontal' | null;
    currentSpanMm: number;
    isExactPinned: boolean;
    minMm: number;
    maxMm: number;
  }>(() => {
    const parent = this.selectedParentZone();
    const parentLayout = this.selectedParentLayout();
    const selLayout = this.selectedLayoutNode();
    const selNode = this.selectedZoneNode();
    if (
      !parent ||
      !parentLayout ||
      parent.splitDirection === 'none' ||
      !parent.children ||
      parent.children.length < 2
    ) {
      return {
        hasParentSplit: false,
        axis: null,
        currentSpanMm: Math.round(selLayout.innerWidth),
        isExactPinned: false,
        minMm: 20,
        maxMm: Math.round(selLayout.innerWidth)
      };
    }

    const axis = parent.splitDirection;
    const parentSpan = axis === 'vertical' ? parentLayout.innerWidth : parentLayout.innerHeight;
    const count = parent.children.length;
    const t = this.structureThickness();
    const availableSpan = Math.max(20 * count, parentSpan - (count - 1) * t);
    const maxMm = Math.max(20, Math.floor((availableSpan - 20 * (count - 1)) * 10) / 10);
    const computedSpan = axis === 'vertical' ? selLayout.innerWidth : selLayout.innerHeight;
    const isExactPinned =
      selNode.exactSizeMm !== undefined &&
      Number.isFinite(Number(selNode.exactSizeMm)) &&
      Number(selNode.exactSizeMm) > 0;

    return {
      hasParentSplit: true,
      axis,
      currentSpanMm: Math.round((isExactPinned ? Number(selNode.exactSizeMm) : computedSpan) * 10) / 10,
      isExactPinned,
      minMm: 20,
      maxMm
    };
  });

  readonly maxVerticalSplitCount = computed<number>(() => {
    const layout = this.selectedLayoutNode();
    const t = this.structureThickness();
    return Math.max(1, Math.floor((layout.innerWidth + t) / (35 + t)));
  });

  readonly maxHorizontalSplitCount = computed<number>(() => {
    const layout = this.selectedLayoutNode();
    const t = this.structureThickness();
    return Math.max(1, Math.floor((layout.innerHeight + t) / (35 + t)));
  });

  readonly schematicDisplay = computed<{
    widthPx: number;
    heightPx: number;
    boardPx: number;
    basePx: number;
    hasTop: boolean;
    leftFillerPx: number;
    rightFillerPx: number;
  }>(() => {
    const w = Math.max(150, this.width());
    const h = Math.max(150, this.height());
    const maxW = 288;
    const maxH = 228;
    const scale = Math.min(maxW / w, maxH / h);
    const widthPx = Math.max(116, Math.round(w * scale));
    const heightPx = Math.max(116, Math.round(h * scale));
    const boardPx = Math.max(4, Math.min(10, Math.round(this.structureThickness() * scale)));
    const rawBaseH =
      this.installationType() === 'wall' || this.baseType() === 'none'
        ? 0
        : Math.max(40, this.plinthHeight());
    const basePx = rawBaseH > 0 ? Math.max(10, Math.min(44, Math.round(rawBaseH * scale))) : 0;
    const hasTop = this.preservedHasTopCover !== false || Boolean(this.preservedTopTieStrips);
    const leftFillerPx = this.leftFillerStripEnabled()
      ? Math.max(6, Math.min(20, Math.round(this.leftFillerStripWidthMm() * scale)))
      : 0;
    const rightFillerPx = this.rightFillerStripEnabled()
      ? Math.max(6, Math.min(20, Math.round(this.rightFillerStripWidthMm() * scale)))
      : 0;
    return { widthPx, heightPx, boardPx, basePx, hasTop, leftFillerPx, rightFillerPx };
  });

  readonly totalLeafZonesCount = computed<number>(() => {
    const countLeaves = (node: CabinetZoneLayoutNode): number => {
      if (node.isLeaf || node.children.length === 0) return 1;
      return node.children.reduce((acc, ch) => acc + countLeaves(ch), 0);
    };
    return countLeaves(this.layoutRoot());
  });

  constructor() {
    effect(() => {
      const cfg = this.initialConfig();
      void this.editingGroupId();
      if (cfg && cfg === this.lastEmittedConfig) {
        return;
      }
      untracked(() => {
        this.hydrateFromInput(cfg);
      });
    });

    effect(() => {
      const boards = this.boardMaterials();
      const allMats = this.materials();
      if (allMats.length === 0) return;

      untracked(() => {
        const curMain = this.structureMaterialId();
        const hasValidMain = boards.some(m => m.id === curMain);
        if (!hasValidMain && boards.length > 0) {
          const preferred =
            boards.find(m => m.name.toLowerCase().includes('blanco')) ?? boards[0];
          this.structureMaterialId.set(preferred.id);
          if (this.useSameMaterialForDoors() || !this.doorMaterialId()) {
            this.doorMaterialId.set(preferred.id);
          }
          if (!this.visibleMaterialId()) {
            this.visibleMaterialId.set(preferred.id);
          }
        }
        if (!this.backMaterialId()) {
          const thinBack =
            allMats.find(
              m => !isStoneMaterial(m) && !isCountertopMaterial(m) && (m.thickness ?? 15) <= 6
            ) ?? boards[0];
          if (thinBack) {
            this.backMaterialId.set(thinBack.id);
          }
        }
      });
    });
  }

  private nextZoneId(): string {
    this.zoneUidCounter += 1;
    return `zone_${this.zoneUidCounter}_${Date.now().toString(36).slice(-4)}`;
  }

  private resolveDefaultBoardMaterialId(): string {
    const boards = this.boardMaterials();
    const preferred = boards.find(m => m.name.toLowerCase().includes('blanco')) ?? boards[0];
    return preferred?.id ?? '';
  }

  private resolveDefaultBackMaterialId(): string {
    const all = this.materials();
    const thinBack = all.find(
      m => !isStoneMaterial(m) && !isCountertopMaterial(m) && (m.thickness ?? 15) <= 6
    );
    return thinBack?.id ?? this.resolveDefaultBoardMaterialId();
  }

  private hydrateFromInput(cfg: ParametricCabinetConfig | null): void {
    this.lastEmittedConfig = null;
    this.zoneHistory.set([]);
    this.isManualPartsExpanded.set(false);

    if (!cfg) {
      const defaultMatId = this.resolveDefaultBoardMaterialId();
      const defaultBackId = this.resolveDefaultBackMaterialId();
      this.preservedId = undefined;
      this.preservedCode = 'ZON001';
      this.preservedModuleType = 'custom';
      this.preservedCategory = 'custom';
      this.preservedEnvironmentLine = undefined;
      this.preservedPosX.set(undefined);
      this.preservedPosY.set(undefined);
      this.preservedPosZ.set(undefined);
      this.preservedFacadeGap = 3;
      this.preservedHasTopCover = true;
      this.preservedTopTieStrips = false;
      this.preservedSiphonCutout = undefined;
      this.preservedCornerReturnWidth = undefined;
      this.preservedHandlePosition = 'vertical';

      this.moduleName.set('Módulo a Medida');
      this.width.set(800);
      this.height.set(800);
      this.depth.set(500);
      this.structureThickness.set(15);
      this.doorThickness.set(15);
      this.backThickness.set(3);
      this.isCustomBackThickness.set(false);
      this.installationType.set('floor');
      this.wallMountType.set('french_cleat');
      this.elevationY.set(1400);
      this.frenchCleatHeightMm.set(80);
      this.baseType.set('plinth');
      this.plinthHeight.set(80);
      this.plinthRecessMm.set(40);
      this.legStyle.set('cylindrical_inox');
      this.backType.set('groove');
      this.leftFillerStripEnabled.set(false);
      this.leftFillerStripWidthMm.set(50);
      this.rightFillerStripEnabled.set(false);
      this.rightFillerStripWidthMm.set(50);
      this.structureMaterialId.set(defaultMatId);
      this.doorMaterialId.set(defaultMatId);
      this.backMaterialId.set(defaultBackId);
      this.useSameMaterialForDoors.set(true);
      this.customizeVisibleSides.set(false);
      this.visibleSideLeft.set(false);
      this.visibleSideRight.set(false);
      this.visibleTopCover.set(false);
      this.visibleMaterialId.set(defaultMatId);
      this.moduleHandleType.set('bar_modern');
      this.moduleHandleFinish.set('brushed_steel');
      this.moduleHandlePosition.set('center');
      this.moduleHingeType.set(undefined);
      this.moduleDrawerSlideType.set('telescopic');
      this.moduleOpeningSystem.set('handle');
      this.moduleFingerPullDeductMm.set(26);
      this.moduleGolaFinish.set('natural_aluminum');
      this.moduleHangingRodFinish.set('chrome');

      const root: CabinetZoneNode = {
        id: 'zone_root',
        splitDirection: 'none',
        content: { type: 'empty' }
      };
      this.zoneTree.set(root);
      this.selectedZoneId.set(root.id);
      this.highlightedZoneChange.emit(root.id);
      return;
    }

    this.preservedId = cfg.id;
    this.preservedCode = cfg.code || 'ZON001';
    this.preservedModuleType = cfg.moduleType || 'custom';
    this.preservedCategory = cfg.category || 'custom';
    this.preservedEnvironmentLine = cfg.environmentLine;
    this.preservedPosX.set(cfg.posX);
    this.preservedPosY.set(cfg.posY);
    this.preservedPosZ.set(cfg.posZ);
    this.preservedFacadeGap = Number.isFinite(Number(cfg.facadeGap))
      ? Math.max(1, Number(cfg.facadeGap))
      : 3;
    this.preservedHasTopCover = cfg.hasTopCover;
    this.preservedTopTieStrips = cfg.topTieStrips;
    this.preservedSiphonCutout = cfg.siphonCutout ? { ...cfg.siphonCutout } : undefined;
    this.preservedCornerReturnWidth = cfg.cornerReturnWidth;
    this.preservedHandlePosition = cfg.handlePosition || 'vertical';

    this.moduleName.set(cfg.name || 'Módulo a Medida');
    this.width.set(clampNumber(Number(cfg.width) || 600, 150, 3600));
    this.height.set(clampNumber(Number(cfg.height) || 800, 150, 3000));
    this.depth.set(clampNumber(Number(cfg.depth) || 400, 120, 1200));

    const rawThick = Number(cfg.structureThickness) || 15;
    const validThick = BOARD_THICKNESS_OPTIONS.includes(rawThick) ? rawThick : 15;
    this.structureThickness.set(validThick);
    this.doorThickness.set(Number(cfg.doorThickness) || validThick);

    const rawBackThick = Number(cfg.backThickness) > 0 ? Number(cfg.backThickness) : 3;
    this.backThickness.set(clampNumber(rawBackThick, 2, 25));
    this.isCustomBackThickness.set(rawBackThick !== 3 && rawBackThick !== 9);

    const resolvedInstallation: CabinetInstallationType =
      cfg.installationType === 'wall' || cfg.installationType === 'floor'
        ? cfg.installationType
        : cfg.wallMountType !== undefined ||
            cfg.moduleType === 'wall_cabinet' ||
            cfg.category === 'kitchen_wall' ||
            cfg.category === 'bathroom_wall' ||
            (cfg.elevationY !== undefined && Number(cfg.elevationY) > 0)
          ? 'wall'
          : 'floor';
    this.installationType.set(resolvedInstallation);

    const resolvedWallMount: CabinetWallMountType =
      cfg.wallMountType === 'concealed_hanger' ||
      cfg.wallMountType === 'direct_nailer' ||
      cfg.wallMountType === 'french_cleat'
        ? cfg.wallMountType
        : 'french_cleat';
    this.wallMountType.set(resolvedWallMount);

    let resolvedElevY = 1400;
    if (
      cfg.elevationY !== undefined &&
      Number.isFinite(Number(cfg.elevationY)) &&
      (resolvedInstallation === 'wall' || Number(cfg.elevationY) > 0)
    ) {
      resolvedElevY = Math.round(clampNumber(Number(cfg.elevationY), 0, 2600));
    } else if (
      resolvedInstallation === 'wall' &&
      cfg.posY !== undefined &&
      Number.isFinite(Number(cfg.posY))
    ) {
      const inferred = Math.round(Number(cfg.posY) - (Number(cfg.height) || 800) / 2);
      if (inferred >= 0) {
        resolvedElevY = clampNumber(inferred, 0, 2600);
      }
    }
    this.elevationY.set(resolvedElevY);
    this.frenchCleatHeightMm.set(
      Math.round(clampNumber(Number(cfg.frenchCleatHeightMm) || 80, 60, 120))
    );

    const resolvedBase: CabinetBaseType =
      cfg.baseType === 'none' || cfg.baseType === 'plinth' || cfg.baseType === 'legs'
        ? cfg.baseType
        : cfg.hasPlinth === false || cfg.plinthHeight === 0
          ? 'none'
          : 'plinth';
    this.baseType.set(resolvedBase);
    this.plinthHeight.set(
      resolvedBase === 'legs'
        ? clampNumber(Number(cfg.plinthHeight) || 120, 50, 250)
        : clampNumber(Number(cfg.plinthHeight) || 80, 40, 250)
    );
    this.plinthRecessMm.set(
      cfg.plinthRecessMm !== undefined && Number.isFinite(Number(cfg.plinthRecessMm))
        ? Math.round(clampNumber(Number(cfg.plinthRecessMm), 0, 100))
        : 40
    );
    this.legStyle.set(
      cfg.legStyle === 'black_leveler' ||
        cfg.legStyle === 'cylindrical_inox' ||
        cfg.legStyle === 'scandinavian_wood' ||
        cfg.legStyle === 'hairpin_metal'
        ? cfg.legStyle
        : 'cylindrical_inox'
    );

    const resolvedBack: 'groove' | 'rebate' | 'overlay' | 'none' =
      cfg.hasBackPanel === false || cfg.backType === 'none'
        ? 'none'
        : cfg.backType || 'groove';
    this.backType.set(resolvedBack);

    this.leftFillerStripEnabled.set(Boolean(cfg.leftFillerStripEnabled));
    this.leftFillerStripWidthMm.set(
      Math.round(clampNumber(Number(cfg.leftFillerStripWidthMm) || 50, 30, 100))
    );
    this.rightFillerStripEnabled.set(Boolean(cfg.rightFillerStripEnabled));
    this.rightFillerStripWidthMm.set(
      Math.round(clampNumber(Number(cfg.rightFillerStripWidthMm) || 50, 30, 100))
    );

    const boards = this.boardMaterials();
    const fallbackBoardId = this.resolveDefaultBoardMaterialId();
    const structFound = boards.find(m => m.id === cfg.structureMaterialId);
    const validStructId = structFound ? structFound.id : fallbackBoardId;
    const doorFound = boards.find(m => m.id === cfg.doorMaterialId);
    const validDoorId = doorFound ? doorFound.id : validStructId;

    this.structureMaterialId.set(validStructId);
    this.doorMaterialId.set(validDoorId);
    this.useSameMaterialForDoors.set(validDoorId === validStructId);
    this.backMaterialId.set(cfg.backMaterialId || this.resolveDefaultBackMaterialId());

    this.customizeVisibleSides.set(Boolean(cfg.customizeVisibleSides));
    this.visibleSideLeft.set(Boolean(cfg.visibleSideLeft));
    this.visibleSideRight.set(Boolean(cfg.visibleSideRight));
    this.visibleTopCover.set(Boolean(cfg.visibleTopCover));
    const visibleFound = boards.find(m => m.id === cfg.visibleMaterialId);
    this.visibleMaterialId.set(visibleFound ? visibleFound.id : validStructId);

    let initialTree: CabinetZoneNode;
    if (cfg.zoneTree) {
      initialTree = deepCloneZoneNode(cfg.zoneTree);
    } else if (
      (cfg.shelvesCount ?? 0) > 0 ||
      (cfg.drawersCount ?? 0) > 0 ||
      (cfg.doorOpening && cfg.doorOpening !== 'none') ||
      (cfg.hangingRodsCount ?? 0) > 0 ||
      cfg.category === 'oven_base' ||
      cfg.category === 'oven_tower'
    ) {
      const hydrated = this.cabinetGen.hydrateZoneTreeFromConfig(cfg);
      initialTree = hydrated.zoneTree
        ? deepCloneZoneNode(hydrated.zoneTree)
        : { id: 'zone_root', splitDirection: 'none', content: { type: 'empty' } };
    } else {
      initialTree = {
        id: 'zone_root',
        splitDirection: 'none',
        content: { type: 'empty' }
      };
    }

    const initialSummary = summarizeZoneTree(initialTree);
    this.moduleHandleType.set(initialSummary.handleType ?? cfg.handleType ?? 'bar_modern');
    this.moduleHandleFinish.set(initialSummary.handleFinish ?? cfg.handleFinish ?? 'brushed_steel');
    this.moduleHandlePosition.set(
      normalizeHandleVerticalPosition(initialSummary.handlePosition ?? cfg.handlePosition)
    );
    this.moduleHingeType.set(initialSummary.hingeType ?? cfg.hingeType);
    this.moduleDrawerSlideType.set(
      initialSummary.drawerSlideType ?? resolveValidZoneSlideType(cfg.drawerSlideType)
    );
    this.moduleOpeningSystem.set(
      initialSummary.openingSystem ?? cfg.openingSystem ?? 'handle'
    );
    this.moduleFingerPullDeductMm.set(
      clampNumber(
        Number(initialSummary.fingerPullDeductMm ?? cfg.fingerPullDeductMm) || 26,
        15,
        35
      )
    );
    this.moduleGolaFinish.set(
      initialSummary.golaFinish ?? cfg.golaFinish ?? 'natural_aluminum'
    );
    this.moduleHangingRodFinish.set(
      initialSummary.hangingRodFinish ?? cfg.hangingRodFinish ?? 'chrome'
    );

    this.zoneTree.set(initialTree);
    const targetZone =
      cfg.highlightedZoneId && findZoneNodeById(initialTree, cfg.highlightedZoneId)
        ? cfg.highlightedZoneId
        : initialTree.id;
    this.selectedZoneId.set(targetZone);
    this.highlightedZoneChange.emit(targetZone);
  }

  private buildConfigSnapshot(): ParametricCabinetConfig {
    const tree = deepCloneZoneNode(this.zoneTree());
    const summary = summarizeZoneTree(tree);
    const curInstall = this.installationType();
    const isWall = curInstall === 'wall';
    const curBase: CabinetBaseType = isWall ? 'none' : this.baseType();
    const curBack = this.backType();
    const curPlinthH = curBase === 'none' ? 0 : this.plinthHeight();
    const mainMatId = this.structureMaterialId() || this.resolveDefaultBoardMaterialId();
    const doorMatId = this.useSameMaterialForDoors()
      ? mainMatId
      : this.doorMaterialId() || mainMatId;
    const backMatId = this.backMaterialId() || mainMatId;
    const selId = this.selectedZoneNode().id;
    const posX = this.preservedPosX();
    const posY = this.preservedPosY();
    const posZ = this.preservedPosZ();

    const resolvedHandleType = summary.handleType ?? this.moduleHandleType();
    const resolvedHandleFinish = summary.handleFinish ?? this.moduleHandleFinish();
    const resolvedHandlePosition = summary.handlePosition ?? this.preservedHandlePosition;
    const resolvedHingeType = summary.hingeType ?? this.moduleHingeType();
    const resolvedSlideType = summary.drawerSlideType ?? this.moduleDrawerSlideType();
    const resolvedOpeningSystem = summary.openingSystem ?? this.moduleOpeningSystem();
    const resolvedFingerPullDeduct =
      summary.fingerPullDeductMm ?? this.moduleFingerPullDeductMm();
    const resolvedGolaFinish = summary.golaFinish ?? this.moduleGolaFinish();
    const resolvedRodFinish = summary.hangingRodFinish ?? this.moduleHangingRodFinish();
    const customVisible = this.customizeVisibleSides();
    const resolvedVisibleMatId = customVisible
      ? this.visibleMaterialId() || mainMatId
      : undefined;

    return {
      ...(this.preservedId ? { id: this.preservedId } : {}),
      code: this.preservedCode,
      name: this.moduleName().trim() || 'Módulo a Medida',
      moduleType: this.preservedModuleType,
      category: this.preservedCategory,
      ...(this.preservedEnvironmentLine ? { environmentLine: this.preservedEnvironmentLine } : {}),
      width: clampNumber(this.width(), 150, 3600),
      height: clampNumber(this.height(), 150, 3000),
      depth: clampNumber(this.depth(), 120, 1200),
      structureThickness: this.structureThickness(),
      doorThickness: this.doorThickness(),
      backThickness: curBack === 'none' ? 0 : this.backThickness(),
      backType: curBack,
      hasBackPanel: curBack !== 'none',
      shelvesCount: summary.shelvesCount,
      drawersCount: summary.drawersCount,
      drawerSlideType: resolvedSlideType,
      doorOpening: summary.lastDoorOpening,
      hangingRodsCount: summary.rodsCount,
      hangingRodFinish: resolvedRodFinish,
      hasHandle: summary.hasHandle && isPhysicalHandleType(resolvedHandleType),
      handleType: resolvedHandleType,
      handleFinish: resolvedHandleFinish,
      handlePosition: resolvedHandlePosition,
      openingSystem: resolvedOpeningSystem,
      fingerPullDeductMm: resolvedFingerPullDeduct,
      golaFinish: resolvedGolaFinish,
      ...(resolvedHingeType ? { hingeType: resolvedHingeType } : {}),
      structureMaterialId: mainMatId,
      doorMaterialId: doorMatId,
      backMaterialId: backMatId,
      customizeVisibleSides: customVisible,
      visibleSideLeft: customVisible ? this.visibleSideLeft() : false,
      visibleSideRight: customVisible ? this.visibleSideRight() : false,
      visibleTopCover: customVisible ? this.visibleTopCover() : false,
      ...(resolvedVisibleMatId ? { visibleMaterialId: resolvedVisibleMatId } : {}),
      facadeGap: this.preservedFacadeGap,
      installationType: curInstall,
      ...(isWall ? { wallMountType: this.wallMountType() } : {}),
      ...(isWall && this.wallMountType() === 'french_cleat'
        ? { frenchCleatHeightMm: this.frenchCleatHeightMm() }
        : {}),
      elevationY: isWall ? Math.max(0, Math.round(this.elevationY())) : 0,
      baseType: curBase,
      hasPlinth: curBase === 'plinth',
      plinthHeight: curPlinthH,
      ...(curBase === 'plinth' ? { plinthRecessMm: this.plinthRecessMm() } : {}),
      ...(curBase === 'legs' ? { legStyle: this.legStyle() } : {}),
      leftFillerStripEnabled: this.leftFillerStripEnabled(),
      ...(this.leftFillerStripEnabled()
        ? { leftFillerStripWidthMm: Math.round(clampNumber(this.leftFillerStripWidthMm(), 30, 100)) }
        : {}),
      rightFillerStripEnabled: this.rightFillerStripEnabled(),
      ...(this.rightFillerStripEnabled()
        ? { rightFillerStripWidthMm: Math.round(clampNumber(this.rightFillerStripWidthMm(), 30, 100)) }
        : {}),
      ...(posX !== undefined ? { posX } : {}),
      ...(posY !== undefined ? { posY } : {}),
      ...(posZ !== undefined ? { posZ } : {}),
      ...(this.preservedHasTopCover !== undefined ? { hasTopCover: this.preservedHasTopCover } : {}),
      ...(this.preservedTopTieStrips !== undefined ? { topTieStrips: this.preservedTopTieStrips } : {}),
      ...(this.preservedSiphonCutout ? { siphonCutout: { ...this.preservedSiphonCutout } } : {}),
      ...(this.preservedCornerReturnWidth !== undefined
        ? { cornerReturnWidth: this.preservedCornerReturnWidth }
        : {}),
      zoneTree: tree,
      highlightedZoneId: selId || undefined
    };
  }

  private ensureExplicitZoneRoot(): void {
    const cur = this.zoneTree();
    if (!cur.id.startsWith('zone_auto_root__')) return;
    const oldRootId = cur.id;
    const updated = { ...deepCloneZoneNode(cur), id: 'zone_root' };
    this.zoneTree.set(updated);
    if (this.selectedZoneId() === oldRootId) {
      this.selectedZoneId.set('zone_root');
      this.highlightedZoneChange.emit('zone_root');
    }
  }

  private emitLiveConfig(): void {
    const snapshot = this.buildConfigSnapshot();
    this.lastEmittedConfig = snapshot;
    this.configLiveChange.emit(snapshot);
  }

  private commitZoneTreeMutation(
    nextTree: CabinetZoneNode,
    nextSelectedId?: string,
    forceEmitHighlight = false
  ): void {
    const prevTree = deepCloneZoneNode(this.zoneTree());
    const nextHistory = [...this.zoneHistory(), prevTree].slice(-40);
    this.zoneHistory.set(nextHistory);

    let normalized = deepCloneZoneNode(nextTree);
    let targetSelected = nextSelectedId ?? this.selectedZoneId();
    if (normalized.id.startsWith('zone_auto_root__')) {
      const oldId = normalized.id;
      normalized = { ...normalized, id: 'zone_root' };
      if (targetSelected === oldId) {
        targetSelected = 'zone_root';
      }
    }

    this.zoneTree.set(normalized);
    if (!findZoneNodeById(normalized, targetSelected)) {
      targetSelected = normalized.id;
    }
    const selectionChanged = targetSelected !== this.selectedZoneId();
    if (selectionChanged) {
      this.selectedZoneId.set(targetSelected);
    }
    if (selectionChanged || forceEmitHighlight) {
      this.highlightedZoneChange.emit(targetSelected);
    }
    this.emitLiveConfig();
  }

  /**
   * Actualiza de forma no destructiva la posición mundial (posX, posY, posZ) del módulo
   * tras un desplazamiento en la escena 3D sin reiniciar el árbol, historial ni selección
   * y sin re-emitir `configLiveChange`.
   */
  syncWorldPosition(posX: number, posY: number, posZ: number): void {
    if (Number.isFinite(posX)) {
      this.preservedPosX.set(posX);
    }
    if (Number.isFinite(posY)) {
      this.preservedPosY.set(posY);
    }
    if (Number.isFinite(posZ)) {
      this.preservedPosZ.set(posZ);
    }
  }

  // --- Paso A Handlers ---

  togglePasoACollapse(): void {
    this.isPasoACollapsed.update(v => !v);
  }

  onModuleNameInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    this.moduleName.set(inputEl.value);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  onDimensionInput(field: 'width' | 'height' | 'depth', event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    if (!Number.isFinite(parsed)) return;
    const min = field === 'depth' ? 120 : 150;
    const max = field === 'depth' ? 1200 : field === 'height' ? 3000 : 3600;
    if (parsed < min || parsed > max) return;

    if (field === 'width') this.width.set(Math.round(parsed));
    if (field === 'height') this.height.set(Math.round(parsed));
    if (field === 'depth') this.depth.set(Math.round(parsed));
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  onDimensionChange(field: 'width' | 'height' | 'depth', event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const min = field === 'depth' ? 120 : 150;
    const max = field === 'depth' ? 1200 : field === 'height' ? 3000 : 3600;
    const fallback = field === 'width' ? this.width() : field === 'height' ? this.height() : this.depth();
    const clamped = Math.round(clampNumber(Number.isFinite(parsed) ? parsed : fallback, min, max));

    if (field === 'width') this.width.set(clamped);
    if (field === 'height') this.height.set(clamped);
    if (field === 'depth') this.depth.set(clamped);
    inputEl.value = String(clamped);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  setStructureThickness(thickness: number): void {
    this.structureThickness.set(thickness);
    this.doorThickness.set(thickness);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  setInstallationType(nextType: CabinetInstallationType): void {
    this.installationType.set(nextType);
    if (nextType === 'wall' && (!Number.isFinite(this.elevationY()) || this.elevationY() < 0)) {
      this.elevationY.set(1400);
    }
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  setWallMountType(nextMount: CabinetWallMountType): void {
    this.wallMountType.set(nextMount);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  setElevationPreset(elevationMm: number): void {
    const clamped = Math.round(clampNumber(elevationMm, 0, 2600));
    this.elevationY.set(clamped);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  onElevationYInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2600) return;
    this.elevationY.set(Math.round(parsed));
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  onElevationYChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const clamped = Math.round(
      clampNumber(Number.isFinite(parsed) ? parsed : this.elevationY(), 0, 2600)
    );
    this.elevationY.set(clamped);
    inputEl.value = String(clamped);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  onFrenchCleatHeightInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    if (!Number.isFinite(parsed) || parsed < 60 || parsed > 120) return;
    this.frenchCleatHeightMm.set(Math.round(parsed));
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  onFrenchCleatHeightChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const clamped = Math.round(
      clampNumber(Number.isFinite(parsed) ? parsed : this.frenchCleatHeightMm(), 60, 120)
    );
    this.frenchCleatHeightMm.set(clamped);
    inputEl.value = String(clamped);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  setBaseType(nextBase: CabinetBaseType): void {
    this.baseType.set(nextBase);
    if (nextBase === 'plinth') {
      this.plinthHeight.set(clampNumber(this.plinthHeight() || 80, 40, 250));
    } else if (nextBase === 'legs') {
      this.plinthHeight.set(clampNumber(this.plinthHeight() < 50 ? 120 : this.plinthHeight(), 50, 250));
    }
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  setLegStyle(style: CabinetLegStyle): void {
    this.legStyle.set(style);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  setLegHeightPreset(heightMm: number): void {
    this.plinthHeight.set(Math.round(clampNumber(heightMm, 50, 250)));
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  onPlinthRecessInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return;
    this.plinthRecessMm.set(Math.round(parsed));
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  onPlinthRecessChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const clamped = Math.round(
      clampNumber(Number.isFinite(parsed) ? parsed : this.plinthRecessMm(), 0, 100)
    );
    this.plinthRecessMm.set(clamped);
    inputEl.value = String(clamped);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  onPlinthHeightInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    if (!Number.isFinite(parsed)) return;
    const min = this.baseType() === 'legs' ? 50 : 40;
    if (parsed < min || parsed > 250) return;
    this.plinthHeight.set(Math.round(parsed));
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  onPlinthHeightChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const min = this.baseType() === 'legs' ? 50 : 40;
    const clamped = Math.round(
      clampNumber(Number.isFinite(parsed) ? parsed : this.plinthHeight(), min, 250)
    );
    this.plinthHeight.set(clamped);
    inputEl.value = String(clamped);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  setBackType(nextBack: 'groove' | 'rebate' | 'overlay' | 'none'): void {
    this.backType.set(nextBack);
    if (nextBack !== 'none' && this.backThickness() <= 0) {
      this.backThickness.set(3);
      this.isCustomBackThickness.set(false);
    }
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  toggleFillerStrip(side: 'left' | 'right'): void {
    if (side === 'left') {
      this.leftFillerStripEnabled.update(v => !v);
    } else {
      this.rightFillerStripEnabled.update(v => !v);
    }
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  onFillerStripWidthInput(side: 'left' | 'right', event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    if (!Number.isFinite(parsed) || parsed < 30 || parsed > 100) return;
    const rounded = Math.round(parsed);
    if (side === 'left') {
      this.leftFillerStripWidthMm.set(rounded);
    } else {
      this.rightFillerStripWidthMm.set(rounded);
    }
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  onFillerStripWidthChange(side: 'left' | 'right', event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const fallback = side === 'left' ? this.leftFillerStripWidthMm() : this.rightFillerStripWidthMm();
    const clamped = Math.round(clampNumber(Number.isFinite(parsed) ? parsed : fallback, 30, 100));
    if (side === 'left') {
      this.leftFillerStripWidthMm.set(clamped);
    } else {
      this.rightFillerStripWidthMm.set(clamped);
    }
    inputEl.value = String(clamped);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  setBackThicknessPreset(thicknessMm: number): void {
    this.isCustomBackThickness.set(false);
    this.backThickness.set(clampNumber(thicknessMm, 2, 25));
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  enableCustomBackThickness(): void {
    this.isCustomBackThickness.set(true);
  }

  onBackThicknessInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    if (!Number.isFinite(parsed) || parsed < 2 || parsed > 25) return;
    this.backThickness.set(Math.round(parsed * 10) / 10);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  onBackThicknessChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const clamped = Math.round(
      clampNumber(Number.isFinite(parsed) ? parsed : this.backThickness(), 2, 25) * 10
    ) / 10;
    this.backThickness.set(clamped);
    inputEl.value = String(clamped);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  selectBackMaterial(event: Event): void {
    const selectEl = event.target as HTMLSelectElement;
    this.backMaterialId.set(selectEl.value);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  selectBaseMaterial(materialId: string): void {
    this.structureMaterialId.set(materialId);
    if (this.useSameMaterialForDoors()) {
      this.doorMaterialId.set(materialId);
    }
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  toggleUseSameMaterialForDoors(): void {
    const next = !this.useSameMaterialForDoors();
    this.useSameMaterialForDoors.set(next);
    if (next) {
      this.doorMaterialId.set(this.structureMaterialId());
    }
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  selectDoorMaterial(event: Event): void {
    const selectEl = event.target as HTMLSelectElement;
    this.doorMaterialId.set(selectEl.value);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  toggleCustomizeVisibleSides(): void {
    const next = !this.customizeVisibleSides();
    this.customizeVisibleSides.set(next);
    if (next && !this.visibleMaterialId()) {
      this.visibleMaterialId.set(
        (!this.useSameMaterialForDoors() && this.doorMaterialId()) || this.structureMaterialId()
      );
    }
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  toggleVisibleSide(side: 'left' | 'right' | 'top'): void {
    if (side === 'left') {
      this.visibleSideLeft.update(v => !v);
    } else if (side === 'right') {
      this.visibleSideRight.update(v => !v);
    } else {
      this.visibleTopCover.update(v => !v);
    }
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  selectVisibleMaterial(event: Event): void {
    const selectEl = event.target as HTMLSelectElement;
    this.visibleMaterialId.set(selectEl.value);
    this.ensureExplicitZoneRoot();
    this.emitLiveConfig();
  }

  // --- Paso B Selection & Navigation ---

  selectZone(zoneId: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const target = findZoneNodeById(this.zoneTree(), zoneId);
    const resolvedId = target ? target.id : this.zoneTree().id;
    if (resolvedId !== this.selectedZoneId()) {
      this.selectedZoneId.set(resolvedId);
      this.highlightedZoneChange.emit(resolvedId);
    }
  }

  onZoneSpaceKey(zoneId: string, event: Event): void {
    event.preventDefault();
    this.selectZone(zoneId, event);
  }

  selectParentZone(): void {
    const parent = this.selectedParentZone();
    if (parent) {
      this.selectZone(parent.id);
    }
  }

  // --- Paso B Subdivisions ---

  adjustSplit(axis: 'vertical' | 'horizontal', delta: 1 | -1): void {
    const sel = this.selectedZoneNode();
    const maxAllowed =
      axis === 'vertical' ? this.maxVerticalSplitCount() : this.maxHorizontalSplitCount();

    if (sel.splitDirection !== 'none' && sel.splitDirection !== axis) {
      return;
    }

    if (delta === 1) {
      if (sel.splitDirection === 'none') {
        if (maxAllowed < 2) return;
        const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
          ...node,
          splitDirection: axis,
          content: undefined,
          children: [
            { id: this.nextZoneId(), splitDirection: 'none', sizeRatio: 1, content: { type: 'empty' } },
            { id: this.nextZoneId(), splitDirection: 'none', sizeRatio: 1, content: { type: 'empty' } }
          ]
        }));
        this.commitZoneTreeMutation(nextTree, sel.id);
        return;
      }

      const curCount = sel.children?.length ?? 0;
      if (curCount >= maxAllowed) return;
      const layout = this.selectedLayoutNode();
      const parentSpan = axis === 'vertical' ? layout.innerWidth : layout.innerHeight;
      const t = this.structureThickness();
      const newAvail = Math.max(20 * (curCount + 1), parentSpan - curCount * t);

      const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => {
        const existing = (node.children ?? []).map(ch => deepCloneZoneNode(ch));
        const allFixed = existing.every(ch => Number(ch.exactSizeMm) > 0);
        if (allFixed && existing.length > 0) {
          const sumFixed = existing.reduce((sum, ch) => sum + Number(ch.exactSizeMm), 0);
          const maxBudgetForExisting = Math.max(20 * existing.length, newAvail - 40);
          if (sumFixed > maxBudgetForExisting) {
            const scale = maxBudgetForExisting / sumFixed;
            for (const ch of existing) {
              ch.exactSizeMm = Math.max(20, Math.round(Number(ch.exactSizeMm) * scale * 10) / 10);
            }
          }
        }
        existing.push({
          id: this.nextZoneId(),
          splitDirection: 'none',
          sizeRatio: 1,
          content: { type: 'empty' }
        });
        return {
          ...node,
          splitDirection: axis,
          children: existing
        };
      });
      this.commitZoneTreeMutation(nextTree, sel.id);
      return;
    }

    // delta === -1
    if (sel.splitDirection !== axis || !sel.children || sel.children.length === 0) {
      return;
    }

    if (sel.children.length <= 2) {
      const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
        ...node,
        splitDirection: 'none',
        children: undefined,
        content: { type: 'empty' }
      }));
      this.commitZoneTreeMutation(nextTree, sel.id);
      return;
    }

    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      children: (node.children ?? []).slice(0, -1)
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  // --- Paso B Exact Size ---

  onExactSizeInput(event: Event): void {
    const bounds = this.selectedZoneExactBounds();
    if (!bounds.hasParentSplit) return;
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    if (!Number.isFinite(parsed) || parsed < bounds.minMm || parsed > bounds.maxMm) return;
    this.applyExactSizeToSelected(parsed);
  }

  onExactSizeChange(event: Event): void {
    const bounds = this.selectedZoneExactBounds();
    if (!bounds.hasParentSplit) return;
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const clamped = Math.round(
      clampNumber(Number.isFinite(parsed) ? parsed : bounds.currentSpanMm, bounds.minMm, bounds.maxMm) * 10
    ) / 10;
    inputEl.value = String(clamped);
    this.applyExactSizeToSelected(clamped);
  }

  clearSelectedZoneExactSize(): void {
    const sel = this.selectedZoneNode();
    if (sel.exactSizeMm === undefined) return;
    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      exactSizeMm: undefined,
      sizeRatio: node.sizeRatio && node.sizeRatio > 0 ? node.sizeRatio : 1
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  private applyExactSizeToSelected(requestedMm: number): void {
    const parent = this.selectedParentZone();
    const parentLayout = this.selectedParentLayout();
    const sel = this.selectedZoneNode();
    if (!parent || !parentLayout || !parent.children || parent.children.length < 2) return;

    const count = parent.children.length;
    const t = this.structureThickness();
    const parentSpan =
      parent.splitDirection === 'vertical' ? parentLayout.innerWidth : parentLayout.innerHeight;
    const availableSpan = Math.max(20 * count, Math.round((parentSpan - (count - 1) * t) * 10) / 10);
    const maxForSelected = Math.max(20, Math.round((availableSpan - 20 * (count - 1)) * 10) / 10);
    const clamped = Math.round(clampNumber(requestedMm, 20, maxForSelected) * 10) / 10;

    const selectedIdx = parent.children.findIndex(ch => ch.id === sel.id);
    if (selectedIdx === -1) return;

    const nextTree = updateZoneNodeInTree(this.zoneTree(), parent.id, pNode => {
      const cloned = (pNode.children ?? []).map(ch => deepCloneZoneNode(ch));
      cloned[selectedIdx].exactSizeMm = clamped;
      cloned[selectedIdx].sizeRatio = undefined;

      const remainingBudget = Math.max(
        20 * (count - 1),
        Math.round((availableSpan - clamped) * 10) / 10
      );
      const otherIndices = cloned
        .map((_, idx) => idx)
        .filter(idx => idx !== selectedIdx);
      const otherFlex = otherIndices.filter(idx => !(Number(cloned[idx].exactSizeMm) > 0));
      let otherFixed = otherIndices.filter(idx => Number(cloned[idx].exactSizeMm) > 0);

      // Garantizar al menos un hermano proporcional para absorber exactamente el resto sin escalar la zona fijada
      if (otherFlex.length === 0 && otherIndices.length > 0) {
        const unpinIdx = otherIndices.find(idx => idx > selectedIdx) ?? otherIndices[otherIndices.length - 1];
        cloned[unpinIdx].exactSizeMm = undefined;
        cloned[unpinIdx].sizeRatio = 1;
        otherFlex.push(unpinIdx);
        otherFixed = otherFixed.filter(idx => idx !== unpinIdx);
      }

      if (otherFixed.length > 0) {
        const minFlexReserve = 20 * otherFlex.length;
        const maxFixedAllowed = Math.max(20 * otherFixed.length, remainingBudget - minFlexReserve);
        const sumOtherFixed = otherFixed.reduce(
          (acc, idx) => acc + Number(cloned[idx].exactSizeMm),
          0
        );
        if (sumOtherFixed > maxFixedAllowed && sumOtherFixed > 0) {
          const scale = maxFixedAllowed / sumOtherFixed;
          for (const idx of otherFixed) {
            cloned[idx].exactSizeMm = Math.max(
              20,
              Math.round(Number(cloned[idx].exactSizeMm) * scale * 10) / 10
            );
          }
        }
      }

      for (const idx of otherFlex) {
        if (!cloned[idx].sizeRatio || cloned[idx].sizeRatio! <= 0) {
          cloned[idx].sizeRatio = 1;
        }
      }

      return { ...pNode, children: cloned };
    });

    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  // --- Paso B Content Assignment ---

  setSelectedZoneContentType(contentType: ZoneContentType): void {
    const sel = this.selectedZoneNode();
    const layout = this.selectedLayoutNode();
    const prev = sel.content;

    if (sel.splitDirection !== 'none' && contentType !== 'empty' && contentType !== 'doors') {
      return;
    }

    let nextContent: CabinetZoneContent;
    switch (contentType) {
      case 'empty':
        nextContent = { type: 'empty' };
        break;
      case 'shelves':
        nextContent = {
          type: 'shelves',
          shelvesCount: prev?.shelvesCount && prev.shelvesCount > 0 ? prev.shelvesCount : 2,
          shelvesFixed: prev?.shelvesFixed ?? false,
          shelfSetbackMm: prev?.shelfSetbackMm ?? (prev?.shelvesFixed ? 0 : 18)
        };
        break;
      case 'drawers': {
        const curSlide = this.moduleDrawerSlideType();
        const curHandle = this.moduleHandleType();
        const defaultOpeningSystem: CabinetOpeningSystem =
          curSlide === 'push_open' ||
          curHandle === 'none' ||
          curHandle === 'push_open' ||
          curHandle === 'push'
            ? 'push'
            : curHandle === 'gola' || curHandle === 'gola_less'
              ? 'gola'
              : curHandle === 'finger_pull'
                ? 'finger_pull'
                : 'handle';
        const inheritedFromInternal =
          prev?.type === 'doors' && prev.internalDrawers ? prev.internalDrawers : undefined;
        nextContent = {
          type: 'drawers',
          drawers: prev?.drawers
            ? deepCloneDrawerConfig(prev.drawers)
            : inheritedFromInternal
              ? {
                  ...deepCloneDrawerConfig(inheritedFromInternal),
                  frontMount: 'overlay',
                  isInternal: false
                }
              : {
                  ...DEFAULT_DRAWER_CONFIG,
                  slideType: defaultOpeningSystem === 'push' ? 'push_open' : curSlide,
                  openingSystem: defaultOpeningSystem,
                  ...(defaultOpeningSystem === 'finger_pull'
                    ? { fingerPullDeductMm: this.moduleFingerPullDeductMm() }
                    : {}),
                  ...(defaultOpeningSystem === 'gola'
                    ? { golaFinish: this.moduleGolaFinish() }
                    : {})
                }
        };
        break;
      }
      case 'doors': {
        const defaultOpening: CabinetZoneDoorConfig['opening'] =
          layout.innerWidth >= 700 ? 'double' : 'left';
        const curHandle = this.moduleHandleType();
        const curHinge = this.moduleHingeType();
        const defaultDoorOpenSys: CabinetOpeningSystem =
          curHandle === 'gola' || curHandle === 'gola_less'
            ? 'gola'
            : curHandle === 'finger_pull'
              ? 'finger_pull'
              : curHandle === 'push' || curHandle === 'push_open' || curHandle === 'none'
                ? 'push'
                : 'handle';
        const nextDoors: CabinetZoneDoorConfig = prev?.doors
          ? { ...prev.doors }
          : {
              ...DEFAULT_DOOR_CONFIG,
              opening: defaultOpening,
              ...(curHinge ? { hingeType: curHinge } : {}),
              openingSystem: defaultDoorOpenSys,
              hasHandle: defaultDoorOpenSys === 'handle' && isPhysicalHandleType(curHandle),
              handleType: curHandle,
              handleFinish: this.moduleHandleFinish(),
              handlePosition: this.moduleHandlePosition(),
              ...(defaultDoorOpenSys === 'finger_pull'
                ? { fingerPullDeductMm: this.moduleFingerPullDeductMm() }
                : {}),
              ...(defaultDoorOpenSys === 'gola'
                ? { golaFinish: this.moduleGolaFinish() }
                : {})
            };
        nextContent = {
          type: 'doors',
          doors: nextDoors,
          ...(prev?.shelvesCount ? { shelvesCount: prev.shelvesCount, shelfSetbackMm: prev.shelfSetbackMm ?? 20 } : {}),
          ...(prev?.hangingRodsCount ? { hangingRodsCount: prev.hangingRodsCount } : {}),
          ...(prev?.hangingRodFinish ? { hangingRodFinish: prev.hangingRodFinish } : {}),
          ...(prev?.internalDrawers && isHingedDoorOpening(nextDoors.opening)
            ? { internalDrawers: deepCloneDrawerConfig(prev.internalDrawers) }
            : {})
        };
        break;
      }
      case 'hanging_rod':
        nextContent = {
          type: 'hanging_rod',
          hangingRodsCount: prev?.hangingRodsCount === 2 ? 2 : 1,
          hangingRodFinish: prev?.hangingRodFinish ?? this.moduleHangingRodFinish()
        };
        break;
      case 'shoe_rack':
        nextContent = {
          type: 'shoe_rack',
          shoeRack: prev?.shoeRack ? { ...prev.shoeRack } : { ...DEFAULT_SHOE_RACK_CONFIG }
        };
        break;
      case 'appliance_niche':
        nextContent = {
          type: 'appliance_niche',
          applianceNiche: prev?.applianceNiche
            ? { ...prev.applianceNiche }
            : { ...DEFAULT_APPLIANCE_NICHE_CONFIG }
        };
        break;
    }

    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      content: nextContent
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  // Shelves Controls
  setShelvesFixed(fixed: boolean): void {
    const sel = this.selectedZoneNode();
    const cur = sel.content;
    if (!cur || cur.type !== 'shelves') return;
    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      content: {
        ...(node.content ?? { type: 'shelves' }),
        shelvesFixed: fixed,
        shelfSetbackMm: fixed ? 0 : 18
      }
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  adjustShelvesCount(delta: 1 | -1): void {
    const sel = this.selectedZoneNode();
    const cur = sel.content;
    if (!cur || (cur.type !== 'shelves' && cur.type !== 'doors')) return;
    const minCount = cur.type === 'doors' ? 0 : 1;
    const nextCount = clampNumber((cur.shelvesCount ?? minCount) + delta, minCount, 8);
    if (nextCount === (cur.shelvesCount ?? 0)) return;

    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      content: {
        ...(node.content ?? { type: cur.type }),
        shelvesCount: nextCount,
        shelfSetbackMm: node.content?.shelfSetbackMm ?? (cur.type === 'doors' ? 20 : 15)
      }
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  onShelfSetbackInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 150) return;
    this.updateShelfSetback(Math.round(parsed));
  }

  onShelfSetbackChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const clamped = Math.round(clampNumber(Number.isFinite(parsed) ? parsed : 15, 0, 150));
    inputEl.value = String(clamped);
    this.updateShelfSetback(clamped);
  }

  private updateShelfSetback(setbackMm: number): void {
    const sel = this.selectedZoneNode();
    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      content: {
        ...(node.content ?? { type: 'shelves' }),
        shelfSetbackMm: setbackMm
      }
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  // Drawers & Shared Custom-Height Normalization Helpers
  private computeDrawerSpanMm(
    layout: CabinetZoneLayoutNode,
    dCfg: CabinetZoneDrawerConfig,
    isInternal: boolean
  ): number {
    const count = clampNumber(Math.round(dCfg.count || 1), 1, 6);
    const interGap = Math.max(2, this.preservedFacadeGap || 3);
    if (isInternal) {
      const totalSpanY = Math.max(30 * count, layout.innerHeight - 4);
      return Math.max(30 * count, Math.round((totalSpanY - interGap * (count - 1)) * 10) / 10);
    }

    const isInset = dCfg.frontMount === 'inset';
    const safeInsetPad = (val: number | undefined): number => {
      const n = Number(val);
      return Number.isFinite(n) && n > 0 ? Math.max(1.6, n) : 2;
    };
    const safeOverlayPad = (val: number | undefined): number => {
      const n = Number(val);
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const frontMinY = isInset
      ? layout.minY + safeInsetPad(dCfg.deductBottomMm)
      : layout.coverMinY + safeOverlayPad(dCfg.deductBottomMm);
    const frontMaxY = isInset
      ? layout.maxY - safeInsetPad(dCfg.deductTopMm)
      : layout.coverMaxY - safeOverlayPad(dCfg.deductTopMm);
    const totalSpanY = Math.max(30 * count, frontMaxY - frontMinY);
    const slotGap =
      dCfg.openingSystem === 'gola'
        ? Math.min(26, Math.max(interGap, Math.floor((totalSpanY - 30 * count) / count)))
        : interGap;
    const totalGapBudget =
      dCfg.openingSystem === 'gola' ? slotGap * count : interGap * (count - 1);
    return Math.max(30 * count, Math.round((totalSpanY - totalGapBudget) * 10) / 10);
  }

  private resolveNormalizedDrawerHeights(
    layout: CabinetZoneLayoutNode,
    dCfg: CabinetZoneDrawerConfig,
    isInternal: boolean
  ): number[] {
    const count = clampNumber(Math.round(dCfg.count || 1), 1, 6);
    const span = this.computeDrawerSpanMm(layout, dCfg, isInternal);
    if ((dCfg.heightDistribution ?? 'equal') !== 'custom') {
      return normalizeDrawerHeightsForSpan(span, count, undefined, 90);
    }
    return normalizeDrawerHeightsForSpan(span, count, dCfg.customHeightsMm, 90);
  }

  private computeAdjustedCustomDrawerHeights(
    layout: CabinetZoneLayoutNode,
    dCfg: CabinetZoneDrawerConfig,
    isInternal: boolean,
    editedIdx: number,
    requestedMm: number
  ): number[] {
    const count = clampNumber(Math.round(dCfg.count || 1), 1, 6);
    const span = this.computeDrawerSpanMm(layout, dCfg, isInternal);
    const current = this.resolveNormalizedDrawerHeights(layout, dCfg, isInternal);
    if (count <= 1 || editedIdx < 0 || editedIdx >= count) {
      return normalizeDrawerHeightsForSpan(span, count, current, 90);
    }

    const effectiveMin = Math.min(90, span / count);
    const maxForOne = Math.max(effectiveMin, span - effectiveMin * (count - 1));
    const pinnedVal = Math.round(clampNumber(requestedMm, effectiveMin, maxForOne) * 10) / 10;
    const remainingSpan = Math.max(
      effectiveMin * (count - 1),
      Math.round((span - pinnedVal) * 10) / 10
    );
    const otherHeights = current.filter((_, idx) => idx !== editedIdx);
    const adjustedOthers = normalizeDrawerHeightsForSpan(
      remainingSpan,
      count - 1,
      otherHeights,
      90
    );

    let cursor = 0;
    return Array.from({ length: count }, (_, idx) => {
      if (idx === editedIdx) return pinnedVal;
      return adjustedOthers[cursor++];
    });
  }

  private buildDrawerCountPatch(
    cur: CabinetZoneDrawerConfig,
    count: number,
    isInternal: boolean
  ): Partial<CabinetZoneDrawerConfig> {
    const clamped = clampNumber(Math.round(count), 1, 6);
    if ((cur.heightDistribution ?? 'equal') !== 'custom') {
      return { count: clamped };
    }
    const layout = this.selectedLayoutNode();
    const span = this.computeDrawerSpanMm(layout, { ...cur, count: clamped }, isInternal);
    return {
      count: clamped,
      customHeightsMm: normalizeDrawerHeightsForSpan(span, clamped, cur.customHeightsMm, 90)
    };
  }

  private buildDrawerDistributionPatch(
    cur: CabinetZoneDrawerConfig,
    distribution: CabinetDrawerHeightDistribution,
    isInternal: boolean
  ): Partial<CabinetZoneDrawerConfig> {
    if (distribution !== 'custom') {
      return { heightDistribution: 'equal', customHeightsMm: undefined };
    }
    const layout = this.selectedLayoutNode();
    const customHeights = this.resolveNormalizedDrawerHeights(
      layout,
      { ...cur, heightDistribution: 'equal' },
      isInternal
    );
    return {
      heightDistribution: 'custom',
      customHeightsMm: customHeights
    };
  }

  // Drawers Controls
  setDrawersCount(count: number): void {
    const cur = this.selectedZoneNode().content?.drawers ?? DEFAULT_DRAWER_CONFIG;
    this.updateDrawersConfig(this.buildDrawerCountPatch(cur, count, false));
  }

  setDrawerHeightDistribution(distribution: CabinetDrawerHeightDistribution): void {
    const cur = this.selectedZoneNode().content?.drawers ?? DEFAULT_DRAWER_CONFIG;
    this.updateDrawersConfig(this.buildDrawerDistributionPatch(cur, distribution, false));
  }

  onCustomDrawerHeightInput(index: number, event: Event): void {
    const cur = this.selectedZoneNode().content?.drawers;
    if (!cur) return;
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const minSlot = this.selectedDrawerMinSlotMm();
    const span = this.computeDrawerSpanMm(this.selectedLayoutNode(), cur, false);
    const count = clampNumber(Math.round(cur.count || 1), 1, 6);
    const maxForOne = Math.max(minSlot, span - minSlot * (count - 1));
    if (!Number.isFinite(parsed) || parsed < minSlot || parsed > maxForOne) return;
    const nextHeights = this.computeAdjustedCustomDrawerHeights(
      this.selectedLayoutNode(),
      cur,
      false,
      index,
      parsed
    );
    this.updateDrawersConfig({ heightDistribution: 'custom', customHeightsMm: nextHeights });
  }

  onCustomDrawerHeightChange(index: number, event: Event): void {
    const cur = this.selectedZoneNode().content?.drawers;
    if (!cur) return;
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const currentHeights = this.selectedDrawerHeightsMm();
    const fallback = currentHeights[index] ?? this.selectedDrawerMinSlotMm();
    const nextHeights = this.computeAdjustedCustomDrawerHeights(
      this.selectedLayoutNode(),
      cur,
      false,
      index,
      Number.isFinite(parsed) ? parsed : fallback
    );
    inputEl.value = String(nextHeights[index] ?? fallback);
    this.updateDrawersConfig({ heightDistribution: 'custom', customHeightsMm: nextHeights });
  }

  wrapDrawersBehindExternalDoor(): void {
    const sel = this.selectedZoneNode();
    const dCfg = sel.content?.drawers;
    if (sel.content?.type !== 'drawers' || !dCfg) return;
    const layout = this.selectedLayoutNode();
    const defaultOpening: CabinetDoorOpeningType = layout.innerWidth >= 700 ? 'double' : 'left';
    const curHandle = this.moduleHandleType();
    const curHinge = this.moduleHingeType();
    const defaultDoorOpenSys: CabinetOpeningSystem =
      curHandle === 'gola' || curHandle === 'gola_less'
        ? 'gola'
        : curHandle === 'finger_pull'
          ? 'finger_pull'
          : curHandle === 'push' || curHandle === 'push_open' || curHandle === 'none'
            ? 'push'
            : 'handle';

    const internalOpening: 'finger_pull' | 'handle' | 'push' =
      dCfg.openingSystem === 'push'
        ? 'push'
        : dCfg.openingSystem === 'finger_pull'
          ? 'finger_pull'
          : 'handle';
    const wrappedInternal: CabinetZoneDrawerConfig = {
      ...deepCloneDrawerConfig(dCfg),
      frontMount: 'inset',
      deductTopMm: 0,
      deductBottomMm: 0,
      deductLeftMm: 0,
      deductRightMm: 0,
      openingSystem: internalOpening,
      slideType:
        internalOpening === 'push'
          ? 'push_open'
          : dCfg.slideType === 'push_open'
            ? 'telescopic'
            : dCfg.slideType,
      isInternal: true,
      ...resolveHingeSpacerSides(defaultOpening),
      hingeSpacerWidthMm: clampNumber(Math.round(dCfg.hingeSpacerWidthMm ?? 30), 18, 60),
      internalSetbackMm: Math.max(20, Math.round(dCfg.internalSetbackMm ?? 22))
    };

    const nextDoors: CabinetZoneDoorConfig = {
      ...DEFAULT_DOOR_CONFIG,
      opening: defaultOpening,
      ...(curHinge && curHinge !== 'gas_piston' ? { hingeType: curHinge } : {}),
      openingSystem: defaultDoorOpenSys,
      hasHandle: defaultDoorOpenSys === 'handle' && isPhysicalHandleType(curHandle),
      handleType: curHandle,
      handleFinish: this.moduleHandleFinish(),
      handlePosition: this.moduleHandlePosition(),
      ...(defaultDoorOpenSys === 'finger_pull'
        ? { fingerPullDeductMm: this.moduleFingerPullDeductMm() }
        : {}),
      ...(defaultDoorOpenSys === 'gola' ? { golaFinish: this.moduleGolaFinish() } : {})
    };

    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      content: {
        type: 'doors',
        doors: nextDoors,
        internalDrawers: wrappedInternal
      }
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  setDrawerFrontMount(frontMount: CabinetZoneDrawerConfig['frontMount']): void {
    this.updateDrawersConfig({ frontMount });
  }

  setDrawerOpeningSystem(openingSystem: CabinetZoneDrawerConfig['openingSystem']): void {
    const sel = this.selectedZoneNode();
    const curDrawers = sel.content?.drawers;
    const curSlide = curDrawers?.slideType ?? this.moduleDrawerSlideType();
    const fallbackNonPush =
      this.moduleDrawerSlideType() !== 'push_open'
        ? this.moduleDrawerSlideType()
        : 'telescopic';
    const nextSlide: CabinetZoneDrawerConfig['slideType'] =
      openingSystem === 'push'
        ? 'push_open'
        : curSlide === 'push_open'
          ? fallbackNonPush
          : curSlide;
    if (openingSystem === 'handle' && !isPhysicalHandleType(this.moduleHandleType())) {
      this.moduleHandleType.set('bar_modern');
    }
    this.moduleDrawerSlideType.set(nextSlide);
    this.updateDrawersConfig({
      openingSystem,
      slideType: nextSlide,
      ...(openingSystem === 'finger_pull'
        ? {
            fingerPullDeductMm: clampNumber(
              curDrawers?.fingerPullDeductMm ?? this.moduleFingerPullDeductMm(),
              15,
              35
            )
          }
        : {}),
      ...(openingSystem === 'gola'
        ? { golaFinish: curDrawers?.golaFinish ?? this.moduleGolaFinish() }
        : {})
    });
  }

  setDrawerSlideType(slideType: CabinetZoneDrawerConfig['slideType']): void {
    const validSlide = resolveValidZoneSlideType(slideType);
    const sel = this.selectedZoneNode();
    const curOpen = sel.content?.drawers?.openingSystem ?? 'handle';
    const nextOpen: CabinetZoneDrawerConfig['openingSystem'] =
      validSlide === 'push_open'
        ? 'push'
        : curOpen === 'push'
          ? 'handle'
          : curOpen;
    this.moduleDrawerSlideType.set(validSlide);
    this.updateDrawersConfig({ slideType: validSlide, openingSystem: nextOpen });
  }

  setDrawerBottomType(bottomType: CabinetZoneDrawerConfig['bottomType']): void {
    this.updateDrawersConfig({ bottomType });
  }

  onDrawerDeductionInput(
    field: 'deductTopMm' | 'deductBottomMm' | 'deductLeftMm' | 'deductRightMm',
    event: Event
  ): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return;
    this.updateDrawersConfig({ [field]: Math.round(parsed * 10) / 10 });
  }

  onDrawerDeductionChange(
    field: 'deductTopMm' | 'deductBottomMm' | 'deductLeftMm' | 'deductRightMm',
    event: Event
  ): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const clamped = Math.round(clampNumber(Number.isFinite(parsed) ? parsed : 0, 0, 100) * 10) / 10;
    inputEl.value = String(clamped);
    this.updateDrawersConfig({ [field]: clamped });
  }

  private updateDrawersConfig(patch: Partial<CabinetZoneDrawerConfig>): void {
    const sel = this.selectedZoneNode();
    const base = sel.content?.drawers ?? DEFAULT_DRAWER_CONFIG;
    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      content: {
        type: 'drawers',
        drawers: {
          ...base,
          ...patch
        }
      }
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  // Doors Controls
  setDoorOpening(opening: CabinetZoneDoorConfig['opening']): void {
    const sel = this.selectedZoneNode();
    const curDoor = sel.content?.doors;
    const curHinge = curDoor?.hingeType;
    const patch: Partial<CabinetZoneDoorConfig> = { opening };

    if (opening === 'top') {
      patch.hingeType = 'gas_piston';
      patch.handlePosition = 'horizontal';
    } else if (opening === 'bottom') {
      patch.hingeType = curHinge === 'gas_piston' ? 'straight' : curHinge;
      patch.handlePosition = 'horizontal';
    } else if (opening === 'sliding') {
      patch.slidingLeavesCount = curDoor?.slidingLeavesCount === 3 ? 3 : 2;
      if (curHinge === 'gas_piston') {
        patch.hingeType = undefined;
      }
    } else {
      if (curHinge === 'gas_piston') {
        const modHinge = this.moduleHingeType();
        patch.hingeType = modHinge && modHinge !== 'gas_piston' ? modHinge : undefined;
      }
      if (curDoor?.handlePosition === 'horizontal') {
        patch.handlePosition = this.moduleHandlePosition();
      }
    }

    const baseDoors = curDoor ?? {
      ...DEFAULT_DOOR_CONFIG,
      ...(this.moduleHingeType() ? { hingeType: this.moduleHingeType() } : {}),
      hasHandle: isPhysicalHandleType(this.moduleHandleType()),
      handleType: this.moduleHandleType(),
      handleFinish: this.moduleHandleFinish(),
      handlePosition: this.moduleHandlePosition()
    };

    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => {
      const existingContent = node.content ?? { type: 'doors' };
      const existingInternal = existingContent.internalDrawers;
      return {
        ...node,
        content: {
          ...existingContent,
          type: 'doors',
          doors: {
            ...baseDoors,
            ...patch
          },
          internalDrawers:
            existingInternal && isHingedDoorOpening(opening)
              ? {
                  ...deepCloneDrawerConfig(existingInternal),
                  ...resolveHingeSpacerSides(opening)
                }
              : undefined
        }
      };
    });
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  setSlidingLeavesCount(leaves: 2 | 3): void {
    this.updateDoorsConfig({ slidingLeavesCount: leaves });
  }

  setDoorPanelStyle(panelStyle: CabinetDoorPanelStyle): void {
    const curDoor = this.selectedZoneNode().content?.doors;
    if (panelStyle === 'vitrina') {
      this.updateDoorsConfig({
        panelStyle: 'vitrina',
        vitrinaFrameFinish: curDoor?.vitrinaFrameFinish ?? 'matte_black',
        vitrinaGlassType: curDoor?.vitrinaGlassType ?? 'clear'
      });
      return;
    }
    this.updateDoorsConfig({ panelStyle: 'melamine' });
  }

  setVitrinaFrameFinish(finish: CabinetVitrinaFrameFinish): void {
    this.updateDoorsConfig({
      panelStyle: 'vitrina',
      vitrinaFrameFinish: finish
    });
  }

  setVitrinaGlassType(glassType: CabinetVitrinaGlassType): void {
    this.updateDoorsConfig({
      panelStyle: 'vitrina',
      vitrinaGlassType: glassType
    });
  }

  // Internal Drawers (Behind Hinged Doors)
  toggleInternalDrawers(): void {
    const sel = this.selectedZoneNode();
    const curContent = sel.content;
    if (curContent?.type !== 'doors' || !curContent.doors || !isHingedDoorOpening(curContent.doors.opening)) {
      return;
    }
    if (curContent.internalDrawers) {
      const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
        ...node,
        content: {
          ...(node.content ?? { type: 'doors' }),
          internalDrawers: undefined
        }
      }));
      this.commitZoneTreeMutation(nextTree, sel.id);
      return;
    }

    const opening = curContent.doors.opening;
    const defaultSlide =
      this.moduleDrawerSlideType() === 'push_open'
        ? 'telescopic'
        : this.moduleDrawerSlideType();
    const nextInternal: CabinetZoneDrawerConfig = {
      count: 3,
      frontMount: 'inset',
      deductTopMm: 0,
      deductBottomMm: 0,
      deductLeftMm: 0,
      deductRightMm: 0,
      openingSystem: 'finger_pull',
      fingerPullDeductMm: this.moduleFingerPullDeductMm(),
      slideType: defaultSlide,
      bottomType: 'grooved',
      heightDistribution: 'equal',
      isInternal: true,
      ...resolveHingeSpacerSides(opening),
      hingeSpacerWidthMm: 30,
      internalSetbackMm: 22
    };

    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      content: {
        ...(node.content ?? { type: 'doors' }),
        internalDrawers: nextInternal
      }
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  setInternalDrawersCount(count: number): void {
    const cur = this.selectedZoneInternalDrawers();
    if (!cur) return;
    this.updateInternalDrawersConfig(this.buildDrawerCountPatch(cur, count, true));
  }

  setInternalDrawerHeightDistribution(distribution: CabinetDrawerHeightDistribution): void {
    const cur = this.selectedZoneInternalDrawers();
    if (!cur) return;
    this.updateInternalDrawersConfig(this.buildDrawerDistributionPatch(cur, distribution, true));
  }

  onInternalDrawerCustomHeightInput(index: number, event: Event): void {
    const cur = this.selectedZoneInternalDrawers();
    if (!cur) return;
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const minSlot = this.selectedInternalDrawerMinSlotMm();
    const span = this.computeDrawerSpanMm(this.selectedLayoutNode(), cur, true);
    const count = clampNumber(Math.round(cur.count || 1), 1, 6);
    const maxForOne = Math.max(minSlot, span - minSlot * (count - 1));
    if (!Number.isFinite(parsed) || parsed < minSlot || parsed > maxForOne) return;
    const nextHeights = this.computeAdjustedCustomDrawerHeights(
      this.selectedLayoutNode(),
      cur,
      true,
      index,
      parsed
    );
    this.updateInternalDrawersConfig({ heightDistribution: 'custom', customHeightsMm: nextHeights });
  }

  onInternalDrawerCustomHeightChange(index: number, event: Event): void {
    const cur = this.selectedZoneInternalDrawers();
    if (!cur) return;
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const currentHeights = this.selectedInternalDrawerHeightsMm();
    const fallback = currentHeights[index] ?? this.selectedInternalDrawerMinSlotMm();
    const nextHeights = this.computeAdjustedCustomDrawerHeights(
      this.selectedLayoutNode(),
      cur,
      true,
      index,
      Number.isFinite(parsed) ? parsed : fallback
    );
    inputEl.value = String(nextHeights[index] ?? fallback);
    this.updateInternalDrawersConfig({ heightDistribution: 'custom', customHeightsMm: nextHeights });
  }

  setInternalDrawerOpeningSystem(openingSystem: 'finger_pull' | 'handle' | 'push'): void {
    const cur = this.selectedZoneInternalDrawers();
    if (!cur) return;
    const fallbackNonPush =
      this.moduleDrawerSlideType() !== 'push_open' ? this.moduleDrawerSlideType() : 'telescopic';
    const nextSlide: CabinetZoneDrawerConfig['slideType'] =
      openingSystem === 'push'
        ? 'push_open'
        : cur.slideType === 'push_open'
          ? fallbackNonPush
          : cur.slideType;
    this.updateInternalDrawersConfig({
      openingSystem,
      slideType: nextSlide,
      ...(openingSystem === 'finger_pull'
        ? {
            fingerPullDeductMm: clampNumber(
              cur.fingerPullDeductMm ?? this.moduleFingerPullDeductMm(),
              15,
              35
            )
          }
        : {})
    });
  }

  setInternalDrawerSlideType(slideType: CabinetZoneDrawerConfig['slideType']): void {
    const cur = this.selectedZoneInternalDrawers();
    if (!cur) return;
    const validSlide = resolveValidZoneSlideType(slideType);
    const nextOpen: 'finger_pull' | 'handle' | 'push' =
      validSlide === 'push_open'
        ? 'push'
        : cur.openingSystem === 'push'
          ? 'finger_pull'
          : cur.openingSystem === 'handle'
            ? 'handle'
            : 'finger_pull';
    this.updateInternalDrawersConfig({ slideType: validSlide, openingSystem: nextOpen });
  }

  onHingeSpacerWidthInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    if (!Number.isFinite(parsed) || parsed < 18 || parsed > 60) return;
    this.updateInternalDrawersConfig({ hingeSpacerWidthMm: Math.round(parsed) });
  }

  onHingeSpacerWidthChange(event: Event): void {
    const cur = this.selectedZoneInternalDrawers();
    if (!cur) return;
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const clamped = Math.round(
      clampNumber(Number.isFinite(parsed) ? parsed : (cur.hingeSpacerWidthMm ?? 30), 18, 60)
    );
    inputEl.value = String(clamped);
    this.updateInternalDrawersConfig({ hingeSpacerWidthMm: clamped });
  }

  onInternalSetbackInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    if (!Number.isFinite(parsed) || parsed < 20 || parsed > 120) return;
    this.updateInternalDrawersConfig({ internalSetbackMm: Math.round(parsed) });
  }

  onInternalSetbackChange(event: Event): void {
    const cur = this.selectedZoneInternalDrawers();
    if (!cur) return;
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const clamped = Math.round(
      clampNumber(Number.isFinite(parsed) ? parsed : (cur.internalSetbackMm ?? 22), 20, 120)
    );
    inputEl.value = String(clamped);
    this.updateInternalDrawersConfig({ internalSetbackMm: clamped });
  }

  private updateInternalDrawersConfig(patch: Partial<CabinetZoneDrawerConfig>): void {
    const sel = this.selectedZoneNode();
    const curContent = sel.content;
    const curDoors = curContent?.doors;
    const curInternal = curContent?.internalDrawers;
    if (curContent?.type !== 'doors' || !curDoors || !curInternal) return;
    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      content: {
        ...(node.content ?? { type: 'doors', doors: curDoors }),
        internalDrawers: {
          ...deepCloneDrawerConfig(curInternal),
          ...patch,
          frontMount: 'inset',
          isInternal: true,
          ...resolveHingeSpacerSides(curDoors.opening)
        }
      }
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  setDoorMount(mount: CabinetZoneDoorConfig['mount']): void {
    this.updateDoorsConfig({ mount });
  }

  setDoorHasHandle(hasHandle: boolean): void {
    const sel = this.selectedZoneNode();
    const curType = sel.content?.doors?.handleType;
    const modHandle = this.moduleHandleType();
    const resolvedType: HandleType = hasHandle
      ? isPhysicalHandleType(curType)
        ? curType!
        : isPhysicalHandleType(modHandle)
          ? modHandle
          : 'bar_modern'
      : 'none';
    if (hasHandle && !isPhysicalHandleType(modHandle)) {
      this.moduleHandleType.set(resolvedType);
    }
    this.updateDoorsConfig({
      openingSystem: hasHandle ? 'handle' : 'push',
      hasHandle,
      handleType: resolvedType
    });
  }

  setDoorOpeningSystem(openingSystem: CabinetOpeningSystem): void {
    const sel = this.selectedZoneNode();
    const curDoor = sel.content?.doors;
    if (openingSystem === 'handle') {
      const curType = curDoor?.handleType;
      const modType = this.moduleHandleType();
      const resolvedType: HandleType = isPhysicalHandleType(curType)
        ? curType!
        : isPhysicalHandleType(modType)
          ? modType
          : 'bar_modern';
      if (!isPhysicalHandleType(modType)) {
        this.moduleHandleType.set(resolvedType);
      }
      this.updateDoorsConfig({
        openingSystem: 'handle',
        hasHandle: true,
        handleType: resolvedType,
        handleFinish: curDoor?.handleFinish ?? this.moduleHandleFinish(),
        handlePosition: isLiftDoorOpening(curDoor?.opening)
          ? 'horizontal'
          : (curDoor?.handlePosition ?? this.moduleHandlePosition())
      });
      return;
    }

    if (openingSystem === 'push') {
      this.updateDoorsConfig({
        openingSystem: 'push',
        hasHandle: false,
        handleType: 'push_open'
      });
      return;
    }

    if (openingSystem === 'finger_pull') {
      const deduct = clampNumber(
        curDoor?.fingerPullDeductMm ?? this.moduleFingerPullDeductMm(),
        15,
        35
      );
      this.updateDoorsConfig({
        openingSystem: 'finger_pull',
        hasHandle: false,
        handleType: 'finger_pull',
        fingerPullDeductMm: deduct
      });
      return;
    }

    const golaFin = curDoor?.golaFinish ?? this.moduleGolaFinish();
    this.updateDoorsConfig({
      openingSystem: 'gola',
      hasHandle: false,
      handleType: 'gola_less',
      golaFinish: golaFin
    });
  }

  setZoneHandlePosition(position: 'top' | 'center' | 'bottom'): void {
    this.moduleHandlePosition.set(position);
    this.preservedHandlePosition = position;
    if (this.selectedZoneNode().content?.type === 'doors') {
      this.updateDoorsConfig({ handlePosition: position });
    } else {
      this.ensureExplicitZoneRoot();
      this.emitLiveConfig();
    }
  }

  onFingerPullDeductInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    if (!Number.isFinite(parsed) || parsed < 15 || parsed > 35) return;
    this.applyFingerPullDeduct(Math.round(parsed));
  }

  onFingerPullDeductChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const clamped = Math.round(
      clampNumber(Number.isFinite(parsed) ? parsed : this.selectedZoneFingerPullDeductMm(), 15, 35)
    );
    inputEl.value = String(clamped);
    this.applyFingerPullDeduct(clamped);
  }

  private applyFingerPullDeduct(deductMm: number): void {
    this.moduleFingerPullDeductMm.set(deductMm);
    const contentType = this.selectedZoneNode().content?.type;
    if (contentType === 'doors') {
      this.updateDoorsConfig({ fingerPullDeductMm: deductMm });
    } else if (contentType === 'drawers') {
      this.updateDrawersConfig({ fingerPullDeductMm: deductMm });
    } else {
      this.ensureExplicitZoneRoot();
      this.emitLiveConfig();
    }
  }

  setGolaFinish(finish: CabinetGolaFinish): void {
    this.moduleGolaFinish.set(finish);
    const contentType = this.selectedZoneNode().content?.type;
    if (contentType === 'doors') {
      this.updateDoorsConfig({ golaFinish: finish });
    } else if (contentType === 'drawers') {
      this.updateDrawersConfig({ golaFinish: finish });
    } else {
      this.ensureExplicitZoneRoot();
      this.emitLiveConfig();
    }
  }

  onGolaFinishChange(event: Event): void {
    const selectEl = event.target as HTMLSelectElement;
    this.setGolaFinish(selectEl.value as CabinetGolaFinish);
  }

  onDoorHandleTypeChange(event: Event): void {
    const selectEl = event.target as HTMLSelectElement;
    const handleType = selectEl.value as HandleType;
    this.moduleHandleType.set(handleType);
    if (this.selectedZoneNode().content?.type === 'doors') {
      this.updateDoorsConfig({ handleType, hasHandle: handleType !== 'none' });
    } else {
      this.ensureExplicitZoneRoot();
      this.emitLiveConfig();
    }
  }

  onDoorHandleFinishChange(event: Event): void {
    const selectEl = event.target as HTMLSelectElement;
    const handleFinish = selectEl.value as HandleFinish;
    this.moduleHandleFinish.set(handleFinish);
    if (this.selectedZoneNode().content?.type === 'doors') {
      this.updateDoorsConfig({ handleFinish });
    } else {
      this.ensureExplicitZoneRoot();
      this.emitLiveConfig();
    }
  }

  setInteriorHangingRodsForDoor(rods: 0 | 1 | 2): void {
    const sel = this.selectedZoneNode();
    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      content: {
        ...(node.content ?? { type: 'doors', doors: { ...DEFAULT_DOOR_CONFIG } }),
        hangingRodsCount: rods === 0 ? undefined : rods,
        ...(rods > 0
          ? { hangingRodFinish: node.content?.hangingRodFinish ?? this.moduleHangingRodFinish() }
          : {})
      }
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  private updateDoorsConfig(patch: Partial<CabinetZoneDoorConfig>): void {
    const sel = this.selectedZoneNode();
    const curHinge = this.moduleHingeType();
    const base = sel.content?.doors ?? {
      ...DEFAULT_DOOR_CONFIG,
      ...(curHinge ? { hingeType: curHinge } : {}),
      hasHandle: isPhysicalHandleType(this.moduleHandleType()),
      handleType: this.moduleHandleType(),
      handleFinish: this.moduleHandleFinish(),
      handlePosition: this.moduleHandlePosition()
    };
    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      content: {
        ...(node.content ?? { type: 'doors' }),
        type: 'doors',
        doors: {
          ...base,
          ...patch
        }
      }
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  // Hanging Rod Controls
  setHangingRodsCount(rodsCount: 1 | 2): void {
    const sel = this.selectedZoneNode();
    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      content: {
        type: 'hanging_rod',
        hangingRodsCount: rodsCount,
        hangingRodFinish: node.content?.hangingRodFinish ?? this.moduleHangingRodFinish()
      }
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  setHangingRodFinish(finish: CabinetRodFinish): void {
    this.moduleHangingRodFinish.set(finish);
    const sel = this.selectedZoneNode();
    const curContent = sel.content;
    if (!curContent || (curContent.type !== 'hanging_rod' && curContent.type !== 'doors')) {
      this.ensureExplicitZoneRoot();
      this.emitLiveConfig();
      return;
    }
    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      content: {
        ...(node.content ?? { type: curContent.type }),
        hangingRodFinish: finish
      }
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  // Shoe Rack Controls (Zapatero)
  adjustShoeRackLevels(delta: 1 | -1): void {
    const cur = this.selectedZoneNode().content?.shoeRack ?? DEFAULT_SHOE_RACK_CONFIG;
    this.setShoeRackLevels(cur.levelsCount + delta);
  }

  setShoeRackLevels(levelsCount: number): void {
    const clamped = clampNumber(Math.round(levelsCount), 2, 8);
    this.updateShoeRackConfig({ levelsCount: clamped });
  }

  setShoeRackAngle(angleDeg: 15 | 20): void {
    this.updateShoeRackConfig({ angleDeg });
  }

  setShoeRackFrontStopType(frontStopType: CabinetShoeRackStopType): void {
    this.updateShoeRackConfig({ frontStopType });
  }

  private updateShoeRackConfig(patch: Partial<CabinetZoneShoeRackConfig>): void {
    const sel = this.selectedZoneNode();
    const base = sel.content?.shoeRack ?? DEFAULT_SHOE_RACK_CONFIG;
    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      content: {
        type: 'shoe_rack',
        shoeRack: {
          ...base,
          ...patch
        }
      }
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  // Appliance Niche Controls (Nicho Electrodoméstico)
  setAppliancePreset(preset: CabinetAppliancePreset): void {
    const cur = this.selectedZoneNode().content?.applianceNiche ?? DEFAULT_APPLIANCE_NICHE_CONFIG;
    const presetMatch = CABINET_APPLIANCE_PRESET_OPTIONS.find(p => p.id === preset);
    if (preset === 'oven_60' || preset === 'microwave_60') {
      this.updateApplianceNicheConfig({
        preset,
        cavityWidthMm: presetMatch?.widthMm ?? 564,
        cavityHeightMm: presetMatch?.heightMm ?? (preset === 'microwave_60' ? 385 : 595)
      });
      return;
    }
    this.updateApplianceNicheConfig({
      preset: 'custom',
      cavityWidthMm: cur.cavityWidthMm,
      cavityHeightMm: cur.cavityHeightMm
    });
  }

  onApplianceDimensionInput(field: 'cavityWidthMm' | 'cavityHeightMm', event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const min = field === 'cavityWidthMm' ? 200 : 150;
    const max = field === 'cavityWidthMm' ? 2400 : 2000;
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) return;
    this.updateApplianceNicheConfig({
      preset: 'custom',
      [field]: Math.round(parsed)
    });
  }

  onApplianceDimensionChange(field: 'cavityWidthMm' | 'cavityHeightMm', event: Event): void {
    const cur = this.selectedZoneNode().content?.applianceNiche ?? DEFAULT_APPLIANCE_NICHE_CONFIG;
    const inputEl = event.target as HTMLInputElement;
    const parsed = Number(inputEl.value);
    const min = field === 'cavityWidthMm' ? 200 : 150;
    const max = field === 'cavityWidthMm' ? 2400 : 2000;
    const fallback = field === 'cavityWidthMm' ? cur.cavityWidthMm : cur.cavityHeightMm;
    const clamped = Math.round(clampNumber(Number.isFinite(parsed) ? parsed : fallback, min, max));
    inputEl.value = String(clamped);
    this.updateApplianceNicheConfig({
      preset: 'custom',
      [field]: clamped
    });
  }

  toggleApplianceRearVentilation(): void {
    const cur = this.selectedZoneNode().content?.applianceNiche ?? DEFAULT_APPLIANCE_NICHE_CONFIG;
    this.updateApplianceNicheConfig({
      openRearVentilation: !cur.openRearVentilation
    });
  }

  private updateApplianceNicheConfig(patch: Partial<CabinetZoneApplianceNicheConfig>): void {
    const sel = this.selectedZoneNode();
    const base = sel.content?.applianceNiche ?? DEFAULT_APPLIANCE_NICHE_CONFIG;
    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      ...node,
      content: {
        type: 'appliance_niche',
        applianceNiche: {
          ...base,
          ...patch
        }
      }
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  // --- Undo / Clear / Confirm / Cancel ---

  undoZoneStep(): void {
    const history = this.zoneHistory();
    if (history.length === 0) return;
    const previous = deepCloneZoneNode(history[history.length - 1]);
    this.zoneHistory.set(history.slice(0, -1));
    this.zoneTree.set(previous);

    const curSel = this.selectedZoneId();
    if (!findZoneNodeById(previous, curSel)) {
      this.selectedZoneId.set(previous.id);
      this.highlightedZoneChange.emit(previous.id);
    }
    this.emitLiveConfig();
  }

  clearSelectedZone(): void {
    const sel = this.selectedZoneNode();
    const nextTree = updateZoneNodeInTree(this.zoneTree(), sel.id, node => ({
      id: node.id,
      splitDirection: 'none',
      ...(node.exactSizeMm !== undefined ? { exactSizeMm: node.exactSizeMm } : {}),
      ...(node.sizeRatio !== undefined ? { sizeRatio: node.sizeRatio } : {}),
      content: { type: 'empty' }
    }));
    this.commitZoneTreeMutation(nextTree, sel.id);
  }

  /**
   * Manejo seguro de borrado de zona/contenido (tecla Supr o botón en la barra de zona):
   * - Caso A: Si la zona seleccionada tiene contenido no vacío o subdivisiones hijas,
   *   guarda snapshot en historial y la restablece como hoja vacía preservando su id/medida.
   * - Caso B: Si ya es una hoja vacía con padre dividido (> 1 hijos), guarda snapshot en historial,
   *   elimina la sub-zona rebalanceando las hermanas (o colapsa el padre si queda 1 sola hija).
   * - Caso C: Raíz vacía — nunca elimina el mueble completo y retorna `'noop'`.
   */
  handleDeleteKey(): 'cleared_content' | 'removed_subzone' | 'noop' {
    const tree = this.zoneTree();
    const sel = findZoneNodeById(tree, this.selectedZoneId());
    if (!sel) {
      return 'noop';
    }

    const hasContent = Boolean(sel.content && sel.content.type !== 'empty');
    const hasChildren =
      sel.splitDirection !== 'none' && Boolean(sel.children && sel.children.length > 0);

    if (hasContent || hasChildren) {
      const nextTree = updateZoneNodeInTree(tree, sel.id, node => ({
        id: node.id,
        splitDirection: 'none',
        ...(node.exactSizeMm !== undefined ? { exactSizeMm: node.exactSizeMm } : {}),
        ...(node.sizeRatio !== undefined ? { sizeRatio: node.sizeRatio } : {}),
        children: undefined,
        content: { type: 'empty' }
      }));
      this.commitZoneTreeMutation(nextTree, sel.id, true);
      return 'cleared_content';
    }

    const parent = findParentZoneNode(tree, sel.id);
    if (!parent || !parent.children || parent.children.length <= 1) {
      return 'noop';
    }

    const removedIdx = parent.children.findIndex(ch => ch.id === sel.id);
    if (removedIdx === -1) {
      return 'noop';
    }

    const remaining = parent.children
      .filter((_, idx) => idx !== removedIdx)
      .map(ch => deepCloneZoneNode(ch));

    if (remaining.length === 1) {
      const soleChild = remaining[0];
      const nextTree = updateZoneNodeInTree(tree, parent.id, pNode => ({
        id: pNode.id,
        splitDirection: soleChild.splitDirection || 'none',
        ...(pNode.exactSizeMm !== undefined ? { exactSizeMm: pNode.exactSizeMm } : {}),
        ...(pNode.sizeRatio !== undefined ? { sizeRatio: pNode.sizeRatio } : {}),
        content: soleChild.content
          ? deepCloneZoneContent(soleChild.content)
          : (soleChild.splitDirection || 'none') === 'none'
            ? { type: 'empty' }
            : undefined,
        children:
          Array.isArray(soleChild.children) && soleChild.children.length > 0
            ? soleChild.children.map(child => deepCloneZoneNode(child))
            : undefined
      }));
      this.commitZoneTreeMutation(nextTree, parent.id, true);
      return 'removed_subzone';
    }

    const parentLayout = findLayoutNodeById(this.layoutRoot(), parent.id);
    const parentSpan = parentLayout
      ? parent.splitDirection === 'vertical'
        ? parentLayout.innerWidth
        : parentLayout.innerHeight
      : 0;
    const t = this.structureThickness();
    const newCount = remaining.length;
    const newAvail =
      parentSpan > 0
        ? Math.max(20 * newCount, Math.round((parentSpan - (newCount - 1) * t) * 10) / 10)
        : 0;
    const adjacentIdx = Math.min(removedIdx, remaining.length - 1);
    const nextSelectedSiblingId = remaining[adjacentIdx].id;

    const nextTree = updateZoneNodeInTree(tree, parent.id, pNode => {
      const siblings = (pNode.children ?? [])
        .filter((_, idx) => idx !== removedIdx)
        .map(ch => deepCloneZoneNode(ch));

      const fixedIndices: number[] = [];
      const flexIndices: number[] = [];
      for (let i = 0; i < siblings.length; i++) {
        const exact = Number(siblings[i].exactSizeMm);
        if (Number.isFinite(exact) && exact > 0) {
          fixedIndices.push(i);
        } else {
          flexIndices.push(i);
        }
      }

      if (flexIndices.length === 0 && siblings.length > 0) {
        const releaseIdx = Math.min(removedIdx, siblings.length - 1);
        siblings[releaseIdx].exactSizeMm = undefined;
        siblings[releaseIdx].sizeRatio = 1;
        flexIndices.push(releaseIdx);
        const fixedPos = fixedIndices.indexOf(releaseIdx);
        if (fixedPos !== -1) {
          fixedIndices.splice(fixedPos, 1);
        }
      }

      if (fixedIndices.length > 0 && newAvail > 0) {
        const minFlexReserve = 20 * flexIndices.length;
        const maxFixedAllowed = Math.max(20 * fixedIndices.length, newAvail - minFlexReserve);
        const sumFixed = fixedIndices.reduce(
          (acc, idx) => acc + Number(siblings[idx].exactSizeMm),
          0
        );
        if (sumFixed > maxFixedAllowed && sumFixed > 0) {
          const scale = maxFixedAllowed / sumFixed;
          for (const idx of fixedIndices) {
            siblings[idx].exactSizeMm = Math.max(
              20,
              Math.round(Number(siblings[idx].exactSizeMm) * scale * 10) / 10
            );
          }
        }
      }

      for (const idx of flexIndices) {
        const ratio = Number(siblings[idx].sizeRatio);
        siblings[idx].exactSizeMm = undefined;
        siblings[idx].sizeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
      }

      return {
        ...pNode,
        children: siblings
      };
    });

    this.commitZoneTreeMutation(nextTree, nextSelectedSiblingId, true);
    return 'removed_subzone';
  }

  toggleManualPartsExpanded(): void {
    this.isManualPartsExpanded.update(v => !v);
  }

  requestRemoveManualPart(partId: string): void {
    if (!partId) return;
    this.removeManualPartRequested.emit(partId);
  }

  confirmModule(): void {
    this.width.set(Math.round(clampNumber(this.width(), 150, 3600)));
    this.height.set(Math.round(clampNumber(this.height(), 150, 3000)));
    this.depth.set(Math.round(clampNumber(this.depth(), 120, 1200)));
    if (this.installationType() === 'floor' && this.baseType() !== 'none') {
      const minBase = this.baseType() === 'legs' ? 50 : 40;
      this.plinthHeight.set(Math.round(clampNumber(this.plinthHeight(), minBase, 250)));
    }
    if (this.installationType() === 'wall') {
      this.elevationY.set(Math.round(clampNumber(this.elevationY(), 0, 2600)));
      this.frenchCleatHeightMm.set(Math.round(clampNumber(this.frenchCleatHeightMm(), 60, 120)));
    }
    this.ensureExplicitZoneRoot();
    const finalConfig = this.buildConfigSnapshot();
    this.lastEmittedConfig = finalConfig;
    this.confirmed.emit(finalConfig);
  }

  cancelBuilder(): void {
    this.cancelled.emit();
  }

  // --- Schematic Presentation Helpers ---

  getDoorBadgeLabel(opening: CabinetZoneDoorConfig['opening'] | undefined): string {
    switch (opening) {
      case 'right':
        return 'Der';
      case 'double':
        return 'Doble';
      case 'top':
        return 'Abat. Sup.';
      case 'bottom':
        return 'Abat. Inf.';
      case 'sliding':
        return 'Corr.';
      case 'left':
      default:
        return 'Izq';
    }
  }

  getNodeContentShortLabel(content: CabinetZoneContent | undefined): string {
    if (!content) return 'Vacío';
    switch (content.type) {
      case 'shelves':
        return `${content.shelvesCount ?? 0} Rep.${content.shelvesFixed ? ' Fija' : ''}`;
      case 'drawers':
        return `${content.drawers?.count ?? 1} Caj.`;
      case 'doors': {
        const badge = this.getDoorBadgeLabel(content.doors?.opening);
        const prefix = content.doors?.panelStyle === 'vitrina' ? 'Vitrina' : 'P.';
        const internalSuffix =
          content.internalDrawers && isHingedDoorOpening(content.doors?.opening)
            ? ` + ${content.internalDrawers.count}C`
            : '';
        return `${prefix} ${badge}${internalSuffix}`;
      }
      case 'hanging_rod':
        return content.hangingRodsCount === 2 ? '2 Barras' : '1 Barra';
      case 'shoe_rack':
        return `${content.shoeRack?.levelsCount ?? 4} Zap. ${content.shoeRack?.angleDeg ?? 15}°`;
      case 'appliance_niche':
        return content.applianceNiche?.preset === 'microwave_60'
          ? 'Nicho Micro'
          : content.applianceNiche?.preset === 'oven_60'
            ? 'Nicho Horno'
            : 'Nicho Eq.';
      case 'empty':
      default:
        return 'Vacío';
    }
  }

  getDrawerPreviewHeights(
    layoutNode: CabinetZoneLayoutNode,
    dCfg: CabinetZoneDrawerConfig | undefined,
    isInternal = false
  ): number[] {
    if (!dCfg) return [100];
    return this.resolveNormalizedDrawerHeights(layoutNode, dCfg, isInternal);
  }

  getVitrinaFrameHex(finish: CabinetVitrinaFrameFinish | undefined): string {
    switch (finish) {
      case 'natural_aluminum':
        return '#a1a1aa';
      case 'gold':
        return '#d97706';
      case 'matte_black':
      default:
        return '#18181b';
    }
  }

  getVitrinaGlassBg(glassType: CabinetVitrinaGlassType | undefined): string {
    switch (glassType) {
      case 'bronze_smoked':
        return 'rgba(120, 88, 56, 0.34)';
      case 'frosted':
        return 'rgba(228, 228, 231, 0.68)';
      case 'clear':
      default:
        return 'rgba(186, 230, 253, 0.28)';
    }
  }

  isDoorContentHinged(doors: CabinetZoneDoorConfig | undefined): boolean {
    return isHingedDoorOpening(doors?.opening);
  }

  getIndexArray(count: number | undefined): number[] {
    const safe = Math.max(0, Math.min(8, Math.floor(Number(count) || 0)));
    return Array.from({ length: safe }, (_, i) => i);
  }

  roundDimension(value: number): number {
    return Math.round(value);
  }

  formatPartMeasure(value: number): string {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    const rounded = Math.round(num * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  getMaterialPreviewColor(): string {
    return this.selectedStructureMaterial()?.colorHex || '#E4E4E7';
  }

  getLeftSidePreviewColor(): string {
    if (this.customizeVisibleSides() && this.visibleSideLeft()) {
      return this.selectedVisibleMaterial()?.colorHex || this.getMaterialPreviewColor();
    }
    return this.getMaterialPreviewColor();
  }

  getRightSidePreviewColor(): string {
    if (this.customizeVisibleSides() && this.visibleSideRight()) {
      return this.selectedVisibleMaterial()?.colorHex || this.getMaterialPreviewColor();
    }
    return this.getMaterialPreviewColor();
  }

  getTopCoverPreviewColor(): string {
    if (this.customizeVisibleSides() && this.visibleTopCover()) {
      return this.selectedVisibleMaterial()?.colorHex || this.getMaterialPreviewColor();
    }
    return this.getMaterialPreviewColor();
  }

  getFrontPreviewColor(): string {
    return this.selectedDoorMaterial()?.colorHex || this.getMaterialPreviewColor();
  }

  getDoorSchematicOpeningSystem(doors: CabinetZoneDoorConfig | undefined): CabinetOpeningSystem {
    return resolveOpeningSystemFromDoor(doors, this.moduleHandleType());
  }

  getDrawerSchematicOpeningSystem(drawers: CabinetZoneDrawerConfig | undefined): CabinetOpeningSystem {
    return resolveOpeningSystemFromDrawer(drawers);
  }

  getGolaFinishHex(finish: CabinetGolaFinish | undefined): string {
    switch (finish) {
      case 'matte_black':
        return '#18181b';
      case 'white':
        return '#f8fafc';
      case 'champagne':
        return '#d6c7a9';
      case 'natural_aluminum':
      default:
        return '#d4d4d8';
    }
  }

  getRodFinishHex(finish: CabinetRodFinish | undefined): string {
    switch (finish) {
      case 'matte_black':
        return '#18181b';
      case 'gold':
        return '#d97706';
      case 'chrome':
      default:
        return '#94a3b8';
    }
  }

  getHandleFinishHex(finish: HandleFinish | undefined): string {
    switch (finish) {
      case 'black':
        return '#18181b';
      case 'gold':
        return '#d97706';
      case 'white':
        return '#f8fafc';
      case 'chrome':
        return '#cbd5e1';
      case 'brushed_steel':
      default:
        return '#52525b';
    }
  }

  getWallMountShortLabel(): string {
    switch (this.wallMountType()) {
      case 'concealed_hanger':
        return 'Colgadores';
      case 'direct_nailer':
        return 'Amarres 80mm';
      case 'french_cleat':
      default:
        return 'Listón 45°';
    }
  }

  getLegStyleShortLabel(): string {
    switch (this.legStyle()) {
      case 'black_leveler':
        return 'Niveladora';
      case 'scandinavian_wood':
        return 'Nórdica';
      case 'hairpin_metal':
        return 'Horquilla';
      case 'cylindrical_inox':
      default:
        return 'Inox';
    }
  }

  getPlinthPreviewWidthPercent(): number {
    return 100 - Math.min(20, Math.max(4, Math.round(this.plinthRecessMm() / 5)));
  }

  getLegPreviewColor(): string {
    switch (this.legStyle()) {
      case 'black_leveler':
        return '#18181b';
      case 'scandinavian_wood':
        return '#c29b68';
      case 'hairpin_metal':
        return '#27272a';
      case 'cylindrical_inox':
      default:
        return '#94a3b8';
    }
  }
}
