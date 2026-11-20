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
  Archive01Icon,
  ArrowDataTransferHorizontalIcon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowReloadHorizontalIcon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Bookshelf01Icon,
  Cabinet01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CubeIcon,
  Delete02Icon,
  Exchange01Icon,
  InformationCircleIcon,
  Layers01Icon,
  LayoutLinearIcon,
  PaintBoardIcon,
  RulerIcon,
  SlidersHorizontalIcon,
  SquareIcon,
  TableIcon,
  Tick02Icon,
  Wardrobe01Icon
} from '@hugeicons/core-free-icons';
import {
  CabinetBaseType,
  CabinetZoneContent,
  CabinetZoneDoorConfig,
  CabinetZoneDrawerConfig,
  CabinetZoneLayoutNode,
  CabinetZoneNode,
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
  computeZoneBoundsLayout
} from '../../services/cabinet-generator.service';

export interface ZoneBreadcrumbItem {
  id: string;
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
  hingeType?: HingeType;
  drawerSlideType?: Exclude<SlideType, 'none'>;
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
      ht !== 'gola_less' &&
      ht !== 'finger_pull'
  );
}

const BOARD_THICKNESS_OPTIONS: readonly number[] = [15, 18, 19, 25];

const DEFAULT_DRAWER_CONFIG: CabinetZoneDrawerConfig = {
  count: 3,
  frontMount: 'overlay',
  deductTopMm: 0,
  deductBottomMm: 0,
  deductLeftMm: 0,
  deductRightMm: 0,
  openingSystem: 'handle',
  slideType: 'telescopic',
  bottomType: 'grooved'
};

const DEFAULT_DOOR_CONFIG: CabinetZoneDoorConfig = {
  opening: 'left',
  mount: 'overlay',
  hasHandle: true,
  handleType: 'bar_modern',
  handleFinish: 'brushed_steel'
};

function deepCloneZoneNode(node: CabinetZoneNode): CabinetZoneNode {
  return {
    id: node.id,
    splitDirection: node.splitDirection || 'none',
    ...(node.exactSizeMm !== undefined ? { exactSizeMm: node.exactSizeMm } : {}),
    ...(node.sizeRatio !== undefined ? { sizeRatio: node.sizeRatio } : {}),
    content: node.content
      ? {
          ...node.content,
          drawers: node.content.drawers ? { ...node.content.drawers } : undefined,
          doors: node.content.doors ? { ...node.content.doors } : undefined
        }
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
  let lastDoorOpening: ParametricCabinetConfig['doorOpening'] = 'none';
  let hasHandle = false;
  let handleType: HandleType | undefined;
  let fallbackDoorHandleType: HandleType | undefined;
  let nonDoorHandleType: HandleType | undefined;
  let handleFinish: HandleFinish | undefined;
  let hingeType: HingeType | undefined;
  let drawerSlideType: Exclude<SlideType, 'none'> | undefined;

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
        if (content.drawers.openingSystem === 'handle') {
          hasHandle = true;
        } else if (!nonDoorHandleType) {
          nonDoorHandleType =
            content.drawers.openingSystem === 'push' ? 'push_open' : 'finger_pull';
        }
        if (!drawerSlideType && content.drawers.slideType) {
          drawerSlideType = resolveValidZoneSlideType(content.drawers.slideType);
        }
      } else if (content.type === 'doors' && content.doors) {
        if (content.doors.opening === 'double' || content.doors.opening === 'sliding') {
          doorsCount += 2;
          lastDoorOpening = 'double';
        } else {
          doorsCount += 1;
          lastDoorOpening = content.doors.opening === 'right' ? 'right' : 'left';
        }
        if (content.doors.opening !== 'sliding' && content.doors.hingeType && !hingeType) {
          hingeType = content.doors.hingeType;
        }
        if (content.doors.hasHandle && isPhysicalHandleType(content.doors.handleType ?? 'bar_modern')) {
          hasHandle = true;
          if (!handleType && content.doors.handleType) {
            handleType = content.doors.handleType;
          }
        } else if (!fallbackDoorHandleType) {
          fallbackDoorHandleType = content.doors.handleType || 'none';
        }
        if (!handleFinish && content.doors.handleFinish) {
          handleFinish = content.doors.handleFinish;
        }
        if (content.shelvesCount) {
          shelvesCount += Math.max(0, content.shelvesCount);
        }
        if (content.hangingRodsCount) {
          rodsCountNum += content.hangingRodsCount;
        }
      } else if (content.type === 'hanging_rod' && content.hangingRodsCount) {
        rodsCountNum += content.hangingRodsCount;
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
    lastDoorOpening: doorsCount >= 2 ? 'double' : doorsCount === 1 ? lastDoorOpening : 'none',
    rodsCount,
    hasHandle,
    handleType:
      handleType ??
      fallbackDoorHandleType ??
      (doorsCount === 0 && drawersCount > 0 && !hasHandle ? nonDoorHandleType : undefined),
    handleFinish,
    hingeType,
    drawerSlideType
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
    info: InformationCircleIcon
  };

  readonly thicknessOptions = BOARD_THICKNESS_OPTIONS;

  // Paso A — Estado del Casco Exterior
  readonly moduleName = signal<string>('Módulo a Medida');
  readonly width = signal<number>(800);
  readonly height = signal<number>(800);
  readonly depth = signal<number>(500);
  readonly structureThickness = signal<number>(15);
  readonly doorThickness = signal<number>(15);
  readonly backThickness = signal<number>(3);
  readonly baseType = signal<CabinetBaseType>('plinth');
  readonly plinthHeight = signal<number>(80);
  readonly backType = signal<'groove' | 'rebate' | 'overlay' | 'none'>('groove');
  readonly structureMaterialId = signal<string>('');
  readonly doorMaterialId = signal<string>('');
  readonly backMaterialId = signal<string>('');
  readonly useSameMaterialForDoors = signal<boolean>(true);
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
  private preservedElevationY: number | undefined;
  private preservedFacadeGap = 3;
  private preservedHasTopCover: boolean | undefined;
  private preservedTopTieStrips: boolean | undefined;
  private preservedSiphonCutout: ParametricCabinetConfig['siphonCutout'];
  private preservedCornerReturnWidth: number | undefined;
  private preservedHandlePosition: ParametricCabinetConfig['handlePosition'] = 'vertical';

  // Preferencias por defecto para tiradores, bisagras y correderas del módulo
  readonly moduleHandleType = signal<HandleType>('bar_modern');
  readonly moduleHandleFinish = signal<HandleFinish>('brushed_steel');
  readonly moduleHingeType = signal<HingeType | undefined>(undefined);
  readonly moduleDrawerSlideType = signal<Exclude<SlideType, 'none'>>('telescopic');

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

  readonly selectedStructureMaterial = computed<Material | null>(() => {
    const id = this.structureMaterialId();
    return this.boardMaterials().find(m => m.id === id) ?? this.boardMaterials()[0] ?? null;
  });

  readonly currentConfig = computed<ParametricCabinetConfig>(() => this.buildConfigSnapshot());

  readonly layoutRoot = computed<CabinetZoneLayoutNode>(() =>
    computeZoneBoundsLayout(this.currentConfig())
  );

  readonly selectedZoneNode = computed<CabinetZoneNode>(() => {
    const tree = this.zoneTree();
    return findZoneNodeById(tree, this.selectedZoneId()) ?? tree;
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
  }>(() => {
    const w = Math.max(150, this.width());
    const h = Math.max(150, this.height());
    const maxW = 304;
    const maxH = 228;
    const scale = Math.min(maxW / w, maxH / h);
    const widthPx = Math.max(116, Math.round(w * scale));
    const heightPx = Math.max(116, Math.round(h * scale));
    const boardPx = Math.max(4, Math.min(10, Math.round(this.structureThickness() * scale)));
    const rawBaseH = this.baseType() === 'none' ? 0 : Math.max(40, this.plinthHeight());
    const basePx = rawBaseH > 0 ? Math.max(10, Math.min(44, Math.round(rawBaseH * scale))) : 0;
    const hasTop = this.preservedHasTopCover !== false || Boolean(this.preservedTopTieStrips);
    return { widthPx, heightPx, boardPx, basePx, hasTop };
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
      this.preservedElevationY = undefined;
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
      this.baseType.set('plinth');
      this.plinthHeight.set(80);
      this.backType.set('groove');
      this.structureMaterialId.set(defaultMatId);
      this.doorMaterialId.set(defaultMatId);
      this.backMaterialId.set(defaultBackId);
      this.useSameMaterialForDoors.set(true);
      this.moduleHandleType.set('bar_modern');
      this.moduleHandleFinish.set('brushed_steel');
      this.moduleHingeType.set(undefined);
      this.moduleDrawerSlideType.set('telescopic');

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
    this.preservedElevationY = cfg.elevationY;
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
    this.backThickness.set(Number(cfg.backThickness) > 0 ? Number(cfg.backThickness) : 3);

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

    const resolvedBack: 'groove' | 'rebate' | 'overlay' | 'none' =
      cfg.hasBackPanel === false || cfg.backType === 'none'
        ? 'none'
        : cfg.backType || 'groove';
    this.backType.set(resolvedBack);

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
    this.moduleHingeType.set(initialSummary.hingeType ?? cfg.hingeType);
    this.moduleDrawerSlideType.set(
      initialSummary.drawerSlideType ?? resolveValidZoneSlideType(cfg.drawerSlideType)
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
    const curBase = this.baseType();
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
    const resolvedHingeType = summary.hingeType ?? this.moduleHingeType();
    const resolvedSlideType = summary.drawerSlideType ?? this.moduleDrawerSlideType();

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
      hasHandle: summary.hasHandle && isPhysicalHandleType(resolvedHandleType),
      handleType: resolvedHandleType,
      handleFinish: resolvedHandleFinish,
      handlePosition: this.preservedHandlePosition,
      ...(resolvedHingeType ? { hingeType: resolvedHingeType } : {}),
      structureMaterialId: mainMatId,
      doorMaterialId: doorMatId,
      backMaterialId: backMatId,
      facadeGap: this.preservedFacadeGap,
      baseType: curBase,
      hasPlinth: curBase === 'plinth',
      plinthHeight: curPlinthH,
      ...(posX !== undefined ? { posX } : {}),
      ...(posY !== undefined ? { posY } : {}),
      ...(posZ !== undefined ? { posZ } : {}),
      ...(this.preservedElevationY !== undefined ? { elevationY: this.preservedElevationY } : {}),
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
    }
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
          shelfSetbackMm: prev?.shelfSetbackMm ?? 15
        };
        break;
      case 'drawers': {
        const curSlide = this.moduleDrawerSlideType();
        const curHandle = this.moduleHandleType();
        const defaultOpeningSystem: CabinetZoneDrawerConfig['openingSystem'] =
          curSlide === 'push_open' ||
          curHandle === 'none' ||
          curHandle === 'push_open' ||
          curHandle === 'push'
            ? 'push'
            : curHandle === 'finger_pull' || curHandle === 'gola_less'
              ? 'finger_pull'
              : 'handle';
        nextContent = {
          type: 'drawers',
          drawers: prev?.drawers
            ? { ...prev.drawers }
            : {
                ...DEFAULT_DRAWER_CONFIG,
                slideType: defaultOpeningSystem === 'push' ? 'push_open' : curSlide,
                openingSystem: defaultOpeningSystem
              }
        };
        break;
      }
      case 'doors': {
        const defaultOpening: CabinetZoneDoorConfig['opening'] =
          layout.innerWidth >= 700 ? 'double' : 'left';
        const curHandle = this.moduleHandleType();
        const curHinge = this.moduleHingeType();
        nextContent = {
          type: 'doors',
          doors: prev?.doors
            ? { ...prev.doors }
            : {
                ...DEFAULT_DOOR_CONFIG,
                opening: defaultOpening,
                ...(curHinge ? { hingeType: curHinge } : {}),
                hasHandle: isPhysicalHandleType(curHandle),
                handleType: curHandle,
                handleFinish: this.moduleHandleFinish()
              },
          ...(prev?.shelvesCount ? { shelvesCount: prev.shelvesCount, shelfSetbackMm: prev.shelfSetbackMm ?? 20 } : {}),
          ...(prev?.hangingRodsCount ? { hangingRodsCount: prev.hangingRodsCount } : {})
        };
        break;
      }
      case 'hanging_rod':
        nextContent = {
          type: 'hanging_rod',
          hangingRodsCount: prev?.hangingRodsCount === 2 ? 2 : 1
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

  // Drawers Controls
  setDrawersCount(count: number): void {
    const clamped = clampNumber(Math.round(count), 1, 6);
    this.updateDrawersConfig({ count: clamped });
  }

  setDrawerFrontMount(frontMount: CabinetZoneDrawerConfig['frontMount']): void {
    this.updateDrawersConfig({ frontMount });
  }

  setDrawerOpeningSystem(openingSystem: CabinetZoneDrawerConfig['openingSystem']): void {
    const sel = this.selectedZoneNode();
    const curSlide = sel.content?.drawers?.slideType ?? this.moduleDrawerSlideType();
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
    this.updateDrawersConfig({ openingSystem, slideType: nextSlide });
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
    this.updateDoorsConfig({ opening });
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
      hasHandle,
      handleType: resolvedType
    });
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
        hangingRodsCount: rods === 0 ? undefined : rods
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
      handleFinish: this.moduleHandleFinish()
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
        hangingRodsCount: rodsCount
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
          ? {
              ...soleChild.content,
              drawers: soleChild.content.drawers ? { ...soleChild.content.drawers } : undefined,
              doors: soleChild.content.doors ? { ...soleChild.content.doors } : undefined
            }
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
    if (this.baseType() !== 'none') {
      const minBase = this.baseType() === 'legs' ? 50 : 40;
      this.plinthHeight.set(Math.round(clampNumber(this.plinthHeight(), minBase, 250)));
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
        return `${content.shelvesCount ?? 0} Rep.`;
      case 'drawers':
        return `${content.drawers?.count ?? 1} Caj.`;
      case 'doors':
        return `P. ${this.getDoorBadgeLabel(content.doors?.opening)}`;
      case 'hanging_rod':
        return content.hangingRodsCount === 2 ? '2 Barras' : '1 Barra';
      case 'empty':
      default:
        return 'Vacío';
    }
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
}
