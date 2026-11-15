import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChildren
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  BookOpen01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  CubeIcon,
  Layers01Icon,
  PrinterIcon,
  RulerIcon,
  Settings01Icon,
  ViewIcon
} from '@hugeicons/core-free-icons';
import {
  AssemblyGuidePiece,
  AssemblyGuideService,
  AssemblyHardwareItem,
  AssemblyStep,
  ModuleAssemblyGuide
} from '../../services/assembly-guide.service';
import { ComponentRole, MelamineProject, Part } from '../../models/melamine.models';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { PartGeometryService } from '../../services/part-geometry.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { PaymentService } from '../../services/payment.service';

export interface PieceAABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  spanX: number;
  spanY: number;
  spanZ: number;
  cx: number;
  cy: number;
  cz: number;
}

export interface PieceOBBGeometry {
  center: { x: number; y: number; z: number };
  halfSize: { x: number; y: number; z: number };
  axes: [
    { x: number; y: number; z: number },
    { x: number; y: number; z: number },
    { x: number; y: number; z: number }
  ];
  corners: { x: number; y: number; z: number }[];
}

export type StepPieceVisualState = 'prior' | 'current';

export interface StepRenderPieceItem {
  piece: AssemblyGuidePiece;
  state: StepPieceVisualState;
}

export type PartRenderStyle = 'exploded' | 'prior' | 'current' | 'highlighted';

export interface MarginalCalloutInput {
  id: string;
  code: string;
  label: string;
  anchorX: number;
  anchorY: number;
  highlighted?: boolean;
  codes?: string[];
  faceCenterX?: number;
  faceCenterY?: number;
  faceSpanW?: number;
  faceSpanH?: number;
  priority?: number;
}

export interface SilhouetteBounds2D {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface MarginalCalloutOptions {
  canvasWidth: number;
  canvasHeight: number;
  silhouetteBounds: SilhouetteBounds2D;
  outerMargin?: number;
  gutter?: number;
  pillHeight?: number;
  minGapY?: number;
  maxPillWidth?: number;
  minPillWidth?: number;
}

export interface CalloutRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface MarginalCalloutPlacement {
  id: string;
  code: string;
  label: string;
  side: 'left' | 'right' | 'face_stamp';
  columnTier: number;
  anchorX: number;
  anchorY: number;
  elbowX: number;
  elbowY: number;
  attachX: number;
  attachY: number;
  pillRect: CalloutRect;
  highlighted: boolean;
  codes: string[];
}

export interface MarginalCalloutLayoutResult {
  leftColumn: MarginalCalloutPlacement[];
  rightColumn: MarginalCalloutPlacement[];
  faceStamps: MarginalCalloutPlacement[];
  all: MarginalCalloutPlacement[];
  silhouetteBounds: SilhouetteBounds2D;
  pillHeight: number;
}

export interface AssemblyPieceGroupSummaryContract {
  key: string;
  label: string;
  role: ComponentRole;
  dimensionsText: string;
  quantity: number;
  codes: string[];
  representativeCode: string;
}

export interface AssemblyDrawerSubassemblyContract {
  id: string;
  label: string;
  repeatCount: number;
  dimensions: { width: number; height: number; depth: number };
  boxHeight: number;
  drawerUnitLabels: string[];
  representativeParts: AssemblyGuidePiece[];
  representativeFront?: AssemblyGuidePiece;
  allBoxPartCodes: string[];
  allFrontPartCodes: string[];
  allPartCodes: string[];
  railElevationsMm: number[];
  pieceGroupsSummary: AssemblyPieceGroupSummaryContract[];
}

export interface AssemblyExplodedGroupCalloutContract {
  id: string;
  label: string;
  sublabel: string;
  codes: string[];
  primaryCode: string;
  role: ComponentRole;
  kind: 'part' | 'drawer_unit' | 'group';
  drawerUnitIndex?: number;
}

export type AssemblyStepActionTypeContract =
  | AssemblyStep['actionType']
  | 'drawer_subassembly';

export type AssemblyStepRenderMode =
  | 'full_progress'
  | 'subassembly_zoom'
  | 'carcass_mount';

export type AssemblyGuidePieceContract = AssemblyGuidePiece & {
  worldBounds?: PieceAABB;
  resolvedRole?: ComponentRole;
  drawerClusterId?: string;
  drawerUnitIndex?: number;
};

export type AssemblyStepContract = Omit<AssemblyStep, 'actionType'> & {
  actionType: AssemblyStepActionTypeContract;
  cumulativePriorPartCodes?: string[];
  renderMode?: AssemblyStepRenderMode;
  subassemblyData?: AssemblyDrawerSubassemblyContract[];
  pieceGroupsSummary?: AssemblyPieceGroupSummaryContract[];
  compactCallouts?: AssemblyExplodedGroupCalloutContract[];
};

export type ModuleAssemblyGuideContract = ModuleAssemblyGuide & {
  drawerSubassemblies?: AssemblyDrawerSubassemblyContract[];
  explodedCalloutGroups?: AssemblyExplodedGroupCalloutContract[];
};

interface DrawerUnitCluster {
  id: string;
  unitIndex: number;
  pieces: AssemblyGuidePiece[];
  boxPieces: AssemblyGuidePiece[];
  frontPiece?: AssemblyGuidePiece;
  codes: string[];
  cx: number;
  cy: number;
  cz: number;
  minY: number;
  maxY: number;
}

interface IsoPoint {
  u: number;
  v: number;
}

interface PartRenderPalette {
  top: string;
  front: string;
  side: string;
  stroke: string;
  lineWidth: number;
}

interface ProjectedBox3D {
  piece: AssemblyGuidePiece;
  offset: { x: number; y: number; z: number };
  origCenter: { x: number; y: number; z: number };
  expCenter: { x: number; y: number; z: number };
  aabb: PieceAABB;
  obb: PieceOBBGeometry;
  depthKey: number;
  style?: PartRenderStyle;
}

const COS30 = 0.8660254;
const SIN30 = 0.5;

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a: CalloutRect, b: CalloutRect, tol = 0.5): boolean {
  return !(
    a.right <= b.left + tol ||
    b.right <= a.left + tol ||
    a.bottom <= b.top + tol ||
    b.bottom <= a.top + tol
  );
}

function layoutVerticalCenters(
  targetYs: number[],
  pillHeight: number,
  minGapY: number,
  availTop: number,
  availBottom: number
): number[] {
  const n = targetYs.length;
  if (n === 0) return [];

  const pitch = pillHeight + minGapY;
  const minCenter = availTop + pillHeight / 2;
  const maxCenter = Math.max(minCenter, availBottom - pillHeight / 2);

  if (n === 1) {
    return [clampNumber(targetYs[0], minCenter, maxCenter)];
  }

  const clampedTargets = targetYs.map(y => clampNumber(y, minCenter, maxCenter));
  const centers = [...clampedTargets];

  for (let i = 1; i < n; i++) {
    if (centers[i] < centers[i - 1] + pitch) {
      centers[i] = centers[i - 1] + pitch;
    }
  }

  if (centers[n - 1] > maxCenter) {
    centers[n - 1] = maxCenter;
    for (let i = n - 2; i >= 0; i--) {
      if (centers[i] > centers[i + 1] - pitch) {
        centers[i] = centers[i + 1] - pitch;
      }
    }
  }

  if (centers[0] < minCenter) {
    centers[0] = minCenter;
    for (let i = 1; i < n; i++) {
      if (centers[i] < centers[i - 1] + pitch) {
        centers[i] = centers[i - 1] + pitch;
      }
    }
  }

  // Centrar bloques contiguos respecto a sus anclas sin romper el paso mínimo
  for (let pass = 0; pass < 3; pass++) {
    let start = 0;
    while (start < n) {
      let end = start;
      while (end + 1 < n && centers[end + 1] - centers[end] <= pitch + 0.5) {
        end++;
      }

      let currentSum = 0;
      let targetSum = 0;
      for (let k = start; k <= end; k++) {
        currentSum += centers[k];
        targetSum += clampedTargets[k];
      }
      const blockCount = end - start + 1;
      let shift = (targetSum - currentSum) / blockCount;

      const minAllowedShift = start === 0
        ? minCenter - centers[start]
        : (centers[start - 1] + pitch) - centers[start];
      const maxAllowedShift = end === n - 1
        ? maxCenter - centers[end]
        : (centers[end + 1] - pitch) - centers[end];

      shift = clampNumber(shift, minAllowedShift, maxAllowedShift);
      if (Math.abs(shift) > 0.25) {
        for (let k = start; k <= end; k++) {
          centers[k] += shift;
        }
      }
      start = end + 1;
    }
  }

  return centers;
}

/**
 * Calcula un layout marginal CAD limpio sin cruces ni solapamientos.
 * Todas las llamadas de las columnas laterales quedan estrictamente fuera de la caja
 * delimitadora de la silueta proyectada (`pillRect.right <= silhouetteMinX - gutter` o
 * `pillRect.left >= silhouetteMaxX + gutter`).
 */
export function computeMarginalCallouts(
  inputs: MarginalCalloutInput[],
  options: MarginalCalloutOptions
): MarginalCalloutLayoutResult {
  const outerMargin = options.outerMargin ?? 10;
  const gutter = options.gutter ?? 16;
  const requestedPillHeight = clampNumber(options.pillHeight ?? 18, 15, 22);
  const minGapY = Math.max(4, options.minGapY ?? 4);
  const maxPillWidth = options.maxPillWidth ?? 164;
  const minPillWidth = options.minPillWidth ?? 56;
  const sil = options.silhouetteBounds;

  if (inputs.length === 0) {
    return {
      leftColumn: [],
      rightColumn: [],
      faceStamps: [],
      all: [],
      silhouetteBounds: sil,
      pillHeight: requestedPillHeight
    };
  }

  const silCenterX = (sil.minX + sil.maxX) / 2;
  const availTop = outerMargin;
  const availBottom = Math.max(outerMargin + requestedPillHeight, options.canvasHeight - outerMargin);
  const availHeight = Math.max(requestedPillHeight, availBottom - availTop);

  const leftColRight = sil.minX - gutter;
  const leftAvailW = Math.max(0, leftColRight - outerMargin);
  const rightColLeft = sil.maxX + gutter;
  const rightAvailW = Math.max(0, (options.canvasWidth - outerMargin) - rightColLeft);

  const canUseLeft = leftAvailW >= 24;
  const canUseRight = rightAvailW >= 24;

  const stdPitch = requestedPillHeight + minGapY;
  const stdCapPerTier = Math.max(1, Math.floor((availHeight + minGapY) / stdPitch));
  const compactPillHeight = Math.min(requestedPillHeight, 15);
  const compactPitch = compactPillHeight + minGapY;
  const compactCapPerTier = Math.max(1, Math.floor((availHeight + minGapY) / compactPitch));

  const singleTierSides = (canUseLeft ? 1 : 0) + (canUseRight ? 1 : 0);
  const stdTotalCap = stdCapPerTier * Math.max(1, singleTierSides);

  // En densidades extremas (> 24 o por encima de capacidad), extraer sellos en cara para tableros grandes
  const faceStamps: MarginalCalloutPlacement[] = [];
  let marginalInputs = [...inputs];

  if (marginalInputs.length > Math.max(24, stdTotalCap)) {
    const faceCandidates = marginalInputs
      .filter(item =>
        item.faceCenterX !== undefined &&
        item.faceCenterY !== undefined &&
        (item.faceSpanW ?? 0) >= 36 &&
        (item.faceSpanH ?? 0) >= 22
      )
      .sort((a, b) => ((b.faceSpanW ?? 0) * (b.faceSpanH ?? 0)) - ((a.faceSpanW ?? 0) * (a.faceSpanH ?? 0)));

    const stampedIds = new Set<string>();
    const stampW = 34;
    const stampH = 16;

    for (const candidate of faceCandidates) {
      if (marginalInputs.length - stampedIds.size <= stdTotalCap) {
        break;
      }
      const cx = candidate.faceCenterX!;
      const cy = candidate.faceCenterY!;
      const rect: CalloutRect = {
        left: Math.round(cx - stampW / 2),
        top: Math.round(cy - stampH / 2),
        right: Math.round(cx + stampW / 2),
        bottom: Math.round(cy + stampH / 2),
        width: stampW,
        height: stampH
      };
      const insideSilhouette =
        rect.left >= sil.minX + 4 &&
        rect.right <= sil.maxX - 4 &&
        rect.top >= sil.minY + 4 &&
        rect.bottom <= sil.maxY - 4;
      const overlapsOtherStamp = faceStamps.some(st => rectsOverlap(st.pillRect, rect, -4));
      if (insideSilhouette && !overlapsOtherStamp) {
        stampedIds.add(candidate.id);
        faceStamps.push({
          id: candidate.id,
          code: candidate.code,
          label: candidate.label,
          side: 'face_stamp',
          columnTier: 0,
          anchorX: cx,
          anchorY: cy,
          elbowX: cx,
          elbowY: cy,
          attachX: cx,
          attachY: cy,
          pillRect: rect,
          highlighted: Boolean(candidate.highlighted),
          codes: candidate.codes?.length ? [...candidate.codes] : [candidate.code]
        });
      }
    }

    if (stampedIds.size > 0) {
      marginalInputs = marginalInputs.filter(item => !stampedIds.has(item.id));
    }
  }

  const useCompact = marginalInputs.length > stdTotalCap;
  const effectivePillHeight = useCompact ? compactPillHeight : requestedPillHeight;
  const capPerTier = useCompact ? compactCapPerTier : stdCapPerTier;

  // Asignar lado izquierdo o derecho según anchorX respecto al centro de la silueta
  let leftItems: MarginalCalloutInput[] = [];
  let rightItems: MarginalCalloutInput[] = [];

  for (const item of marginalInputs) {
    if (!canUseLeft && canUseRight) {
      rightItems.push(item);
    } else if (!canUseRight && canUseLeft) {
      leftItems.push(item);
    } else if (item.anchorX <= silCenterX) {
      leftItems.push(item);
    } else {
      rightItems.push(item);
    }
  }

  // Balancear suavemente entre izquierda y derecha si un lado supera la capacidad de 1 columna
  if (canUseLeft && canUseRight) {
    if (leftItems.length > capPerTier && rightItems.length < capPerTier) {
      leftItems.sort((a, b) => b.anchorX - a.anchorX);
      while (leftItems.length > capPerTier && rightItems.length < capPerTier) {
        const moved = leftItems.shift();
        if (moved) rightItems.push(moved);
      }
    } else if (rightItems.length > capPerTier && leftItems.length < capPerTier) {
      rightItems.sort((a, b) => a.anchorX - b.anchorX);
      while (rightItems.length > capPerTier && leftItems.length < capPerTier) {
        const moved = rightItems.shift();
        if (moved) leftItems.push(moved);
      }
    }
  }

  // Orden estricto por anchorY ascendente dentro de cada columna para evitar cruces
  leftItems = leftItems.sort((a, b) => (a.anchorY - b.anchorY) || (a.anchorX - b.anchorX));
  rightItems = rightItems.sort((a, b) => (a.anchorY - b.anchorY) || (b.anchorX - a.anchorX));

  const placeSideColumn = (
    items: MarginalCalloutInput[],
    side: 'left' | 'right'
  ): MarginalCalloutPlacement[] => {
    if (items.length === 0) return [];

    const availW = side === 'left' ? leftAvailW : rightAvailW;
    const minTierW = Math.min(44, Math.max(24, availW));
    const maxTiersPossible = Math.max(1, Math.floor((availW + 6) / (minTierW + 6)));
    const neededTiers = Math.max(1, Math.ceil(items.length / capPerTier));
    const tierCount = Math.min(neededTiers, maxTiersPossible);

    const tierGapX = 6;
    const rawTierW = (availW - tierGapX * (tierCount - 1)) / tierCount;
    const minAllowedTierW = tierCount > 1 ? minTierW : minPillWidth;
    const tierWidth = clampNumber(rawTierW, Math.min(minAllowedTierW, availW), maxPillWidth);

    const tiers: MarginalCalloutInput[][] = Array.from({ length: tierCount }, () => []);
    if (tierCount === 1) {
      tiers[0] = items;
    } else {
      // Intercalar verticalmente para que los conectores del nivel exterior pasen entre los huecos
      items.forEach((item, idx) => {
        tiers[idx % tierCount].push(item);
      });
    }

    const placed: MarginalCalloutPlacement[] = [];

    for (let tierIdx = 0; tierIdx < tierCount; tierIdx++) {
      const tierItems = tiers[tierIdx];
      if (tierItems.length === 0) continue;

      const requiredSpan = tierItems.length * effectivePillHeight + Math.max(0, tierItems.length - 1) * minGapY;
      const tierPitchGap = requiredSpan <= availHeight
        ? minGapY
        : Math.max(2, Math.floor((availHeight - tierItems.length * effectivePillHeight) / Math.max(1, tierItems.length - 1)));
      const tierPillH = requiredSpan <= availHeight || tierItems.length <= 1
        ? effectivePillHeight
        : Math.max(12, Math.floor((availHeight - Math.max(0, tierItems.length - 1) * 3) / tierItems.length));
      const finalGapY = requiredSpan <= availHeight ? minGapY : Math.max(3, tierPitchGap);

      const centers = layoutVerticalCenters(
        tierItems.map(it => it.anchorY),
        tierPillH,
        finalGapY,
        availTop,
        availBottom
      );

      let colRight: number;
      let colLeft: number;
      if (side === 'left') {
        colRight = Math.round(leftColRight - tierIdx * (tierWidth + tierGapX));
        colLeft = Math.round(colRight - tierWidth);
        if (colLeft < outerMargin && tierIdx === 0 && tierCount === 1) {
          colLeft = Math.min(outerMargin, colRight - 24);
        }
      } else {
        colLeft = Math.round(rightColLeft + tierIdx * (tierWidth + tierGapX));
        colRight = Math.round(colLeft + tierWidth);
        const maxRight = options.canvasWidth - outerMargin;
        if (colRight > maxRight && tierIdx === 0 && tierCount === 1) {
          colRight = Math.max(colLeft + 24, maxRight);
        }
      }

      const rectWidth = Math.max(24, colRight - colLeft);

      tierItems.forEach((item, idx) => {
        const centerY = centers[idx];
        const top = Math.round(centerY - tierPillH / 2);
        const bottom = top + tierPillH;
        const attachX = side === 'left' ? colRight : colLeft;
        const attachY = top + tierPillH / 2;

        const stubBase = Math.min(12, Math.max(5, gutter * 0.48));
        const elbowX = side === 'left'
          ? Math.min(sil.minX - 3, colRight + stubBase + tierIdx * 2)
          : Math.max(sil.maxX + 3, colLeft - stubBase - tierIdx * 2);

        placed.push({
          id: item.id,
          code: item.code,
          label: item.label,
          side,
          columnTier: tierIdx,
          anchorX: item.anchorX,
          anchorY: item.anchorY,
          elbowX,
          elbowY: attachY,
          attachX,
          attachY,
          pillRect: {
            left: colLeft,
            top,
            right: colLeft + rectWidth,
            bottom,
            width: rectWidth,
            height: tierPillH
          },
          highlighted: Boolean(item.highlighted),
          codes: item.codes?.length ? [...item.codes] : [item.code]
        });
      });
    }

    return placed.sort((a, b) => (a.anchorY - b.anchorY) || (a.pillRect.top - b.pillRect.top));
  };

  const leftColumn = placeSideColumn(leftItems, 'left');
  const rightColumn = placeSideColumn(rightItems, 'right');

  return {
    leftColumn,
    rightColumn,
    faceStamps,
    all: [...leftColumn, ...rightColumn, ...faceStamps],
    silhouetteBounds: sil,
    pillHeight: effectivePillHeight
  };
}

@Component({
  selector: 'app-assembly-guide-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, TranslatePipe],
  templateUrl: './assembly-guide-modal.html',
  styleUrl: './assembly-guide-modal.css'
})
export class AssemblyGuideModalComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly assemblyService = inject(AssemblyGuideService);
  private readonly projectStorage = inject(ProjectStorageService);
  private readonly joineryEngine = inject(JoineryEngineService);
  private readonly partGeometry = inject(PartGeometryService);
  readonly i18n = inject(I18nService);
  readonly paymentService = inject(PaymentService);

  readonly isOpen = input<boolean>(true);
  readonly selectedModuleIdInput = input<string | null>(null);
  readonly modalClose = output<void>();

  readonly canvasExplodedList = viewChildren<ElementRef<HTMLCanvasElement>>('explodedCanvas');
  readonly canvasStepList = viewChildren<ElementRef<HTMLCanvasElement>>('stepCanvas');

  // Filtro reactivo del módulo seleccionado
  readonly selectedModuleId = signal<string>('all');

  // Modo de vista del Diagrama General Explosivo: 'grouped' (limpio para complejos) | 'detailed' (todas las piezas)
  readonly explodedViewMode = signal<'grouped' | 'detailed'>('grouped');
  private readonly moduleExplodedModeOverrides = signal<Record<string, 'grouped' | 'detailed'>>({});

  // Selección de plantilla activa por paso en sub-ensambles zoom
  readonly selectedSubassemblyIndexByStep = signal<Record<string, number>>({});

  // Expandir/contraer listado completo de piezas individuales en pasos agrupados
  readonly expandedStepPiecesByKey = signal<Record<string, boolean>>({});

  // Estado interactivo Hover / Clic para resaltado en Azul Acero (#0284C7)
  readonly hoveredPartCodes = signal<string[]>([]);
  readonly pinnedPartCodes = signal<string[]>([]);
  private readonly hoveredSummary = signal<string>('');
  private readonly pinnedSummary = signal<string>('');
  private hoverOrigin: 'dom' | 'canvas' | null = null;

  readonly activeHighlightedCodes = computed<string[]>(() => {
    const hovered = this.hoveredPartCodes();
    if (hovered.length > 0) {
      return hovered;
    }
    return this.pinnedPartCodes();
  });

  readonly activeHighlightSummary = computed<string>(() => {
    const hovered = this.hoveredPartCodes();
    if (hovered.length > 0) {
      return this.hoveredSummary() || this.buildSummaryForCodes(hovered);
    }
    const pinned = this.pinnedPartCodes();
    if (pinned.length > 0) {
      return this.pinnedSummary() || this.buildSummaryForCodes(pinned);
    }
    return '';
  });

  // Metadatos globales del proyecto
  readonly project = this.projectStorage.currentProject;

  // Lista completa de guías de ensamble
  readonly allGuides = this.assemblyService.guides;

  // Guías filtradas según la selección del usuario
  readonly filteredGuides = computed<ModuleAssemblyGuide[]>(() => {
    const filterId = this.selectedModuleId();
    const list = this.allGuides();
    if (!filterId || filterId === 'all') {
      return list;
    }
    return list.filter(g => g.moduleId === filterId);
  });

  // Etiqueta descriptiva para inspección combinada de escena o mueble único
  readonly allModulesOptionLabel = computed<string>(() => {
    const count = this.allGuides().length;
    if (count > 1 && this.i18n.currentLang() === 'es') {
      return `Todos los Muebles / Conjunto Completo en Escena (${count})`;
    }
    return `${this.i18n.t('assemblyGuide.allModules')} (${count})`;
  });

  // Catálogo de iconos vectoriales de Hugeicons
  readonly icons = {
    book: BookOpen01Icon,
    print: PrinterIcon,
    close: Cancel01Icon,
    clock: Clock01Icon,
    ruler: RulerIcon,
    layers: Layers01Icon,
    check: CheckmarkCircle02Icon,
    cube: CubeIcon,
    settings: Settings01Icon,
    view: ViewIcon,
    chevronDown: ArrowDown01Icon,
    chevronUp: ArrowUp01Icon
  };

  private activePrintIframe: HTMLIFrameElement | null = null;
  private printCleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly canvasCalloutHitBoxes = new WeakMap<HTMLCanvasElement, MarginalCalloutPlacement[]>();

  constructor() {
    effect(() => {
      const inputId = this.selectedModuleIdInput();
      if (inputId) {
        this.selectedModuleId.set(inputId);
      }
    });

    effect(() => {
      this.filteredGuides();
      this.explodedViewMode();
      this.moduleExplodedModeOverrides();
      this.selectedSubassemblyIndexByStep();
      this.activeHighlightedCodes();
      this.scheduleCanvasRender(30);
    });
  }

  private readonly onBeforePrint = () => {
    this.renderAllCanvases();
  };

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.add('assembly-guide-open');
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeprint', this.onBeforePrint);
    }
  }

  ngOnDestroy(): void {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    this.cleanupPrintIframe();
    if (typeof document !== 'undefined') {
      document.body.classList.remove('assembly-guide-open');
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeprint', this.onBeforePrint);
    }
  }

  ngAfterViewInit(): void {
    this.renderAllCanvases();
  }

  private scheduleCanvasRender(delayMs = 20): void {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
    }
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      this.renderAllCanvases();
    }, delayMs);
  }

  onFilterChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    this.selectedModuleId.set(target?.value ?? 'all');
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  formatStepNumber(stepNumber: number): string {
    return String(stepNumber).padStart(2, '0');
  }

  formatStepDisplayNumber(
    guide: ModuleAssemblyGuide,
    step: AssemblyStep | AssemblyStepContract
  ): string {
    const stepContract = step as AssemblyStepContract;
    const steps = guide.steps as AssemblyStepContract[];
    let pairedMountOffset = 0;

    for (const s of steps) {
      if (s.stepNumber >= step.stepNumber) {
        break;
      }
      if (s.actionType === 'drawer_subassembly') {
        const nextIdx = steps.indexOf(s) + 1;
        if (nextIdx < steps.length && steps[nextIdx].renderMode === 'carcass_mount') {
          pairedMountOffset++;
        }
      }
    }

    if (stepContract.actionType === 'drawer_subassembly') {
      return `${String(Math.max(1, step.stepNumber - pairedMountOffset)).padStart(2, '0')}A`;
    }

    const stepIndex = steps.findIndex(s => s.stepNumber === step.stepNumber);
    if (
      stepContract.renderMode === 'carcass_mount' &&
      stepIndex > 0 &&
      steps[stepIndex - 1].actionType === 'drawer_subassembly'
    ) {
      const baseNum = Math.max(1, steps[stepIndex - 1].stepNumber - (pairedMountOffset - 1));
      return `${String(baseNum).padStart(2, '0')}B`;
    }

    const adjusted = Math.max(1, step.stepNumber - pairedMountOffset);
    return String(adjusted).padStart(2, '0');
  }

  getStepTitle(step: AssemblyStep | AssemblyStepContract): string {
    const translated = this.i18n.t(step.titleKey);
    if (!translated || translated === step.titleKey) {
      return step.defaultTitle;
    }
    return translated;
  }

  getStepDescription(step: AssemblyStep | AssemblyStepContract): string {
    const translated = this.i18n.t(step.descriptionKey);
    if (!translated || translated === step.descriptionKey) {
      return step.defaultDescription;
    }
    return translated;
  }

  closeModal(): void {
    this.modalClose.emit();
  }

  // =========================================================================
  // CONTROLES DE MODO EXPLOSIVO, SUB-ENSAMBLES Y RESALTADO INTERACTIVO
  // =========================================================================

  hasExplodedGroups(guide: ModuleAssemblyGuide): boolean {
    const contract = guide as ModuleAssemblyGuideContract;
    return (
      (Array.isArray(contract.explodedCalloutGroups) && contract.explodedCalloutGroups.length > 0) ||
      guide.pieces.length > 10 ||
      this.getDrawerUnitClusters(guide).length > 1
    );
  }

  getEffectiveExplodedViewMode(guide: ModuleAssemblyGuide): 'grouped' | 'detailed' {
    const override = this.moduleExplodedModeOverrides()[guide.moduleId];
    if (override) {
      return override;
    }
    const clusters = this.getDrawerUnitClusters(guide);
    const hasGroups = this.hasExplodedGroups(guide);
    if (guide.pieces.length <= 14 && clusters.length <= 1 && !hasGroups) {
      return 'detailed';
    }
    if (guide.pieces.length <= 14 && clusters.length <= 1) {
      return 'detailed';
    }
    return this.explodedViewMode();
  }

  setExplodedViewMode(mode: 'grouped' | 'detailed', moduleId?: string): void {
    this.explodedViewMode.set(mode);
    if (moduleId && this.filteredGuides().length > 1) {
      this.moduleExplodedModeOverrides.update(prev => ({ ...prev, [moduleId]: mode }));
    } else {
      this.moduleExplodedModeOverrides.set({});
    }
    this.scheduleCanvasRender(0);
  }

  getEffectiveStepRenderMode(step: AssemblyStep | AssemblyStepContract): AssemblyStepRenderMode {
    const contract = step as AssemblyStepContract;
    if (contract.renderMode) {
      return contract.renderMode;
    }
    if (contract.actionType === 'drawer_subassembly') {
      return 'subassembly_zoom';
    }
    return 'full_progress';
  }

  getStepSubassemblies(
    guide: ModuleAssemblyGuide,
    step: AssemblyStep | AssemblyStepContract
  ): AssemblyDrawerSubassemblyContract[] {
    const stepContract = step as AssemblyStepContract;
    if (Array.isArray(stepContract.subassemblyData) && stepContract.subassemblyData.length > 0) {
      return stepContract.subassemblyData;
    }
    const guideContract = guide as ModuleAssemblyGuideContract;
    if (Array.isArray(guideContract.drawerSubassemblies) && guideContract.drawerSubassemblies.length > 0) {
      return guideContract.drawerSubassemblies;
    }
    if (this.getEffectiveStepRenderMode(step) === 'subassembly_zoom') {
      return this.buildFallbackDrawerSubassemblies(guide, step.parts);
    }
    return [];
  }

  getSelectedSubassemblyIndex(moduleId: string, stepNumber: number, total: number): number {
    if (total <= 1) return 0;
    const key = this.getStepCanvasKey(moduleId, stepNumber);
    const current = this.selectedSubassemblyIndexByStep()[key] ?? 0;
    return clampNumber(current, 0, total - 1);
  }

  selectSubassemblyTemplate(moduleId: string, stepNumber: number, index: number): void {
    const key = this.getStepCanvasKey(moduleId, stepNumber);
    this.selectedSubassemblyIndexByStep.update(prev => ({ ...prev, [key]: index }));
    this.scheduleCanvasRender(0);
  }

  getStepPieceGroupsSummary(
    step: AssemblyStep | AssemblyStepContract
  ): AssemblyPieceGroupSummaryContract[] | null {
    const contract = step as AssemblyStepContract;
    if (Array.isArray(contract.pieceGroupsSummary) && contract.pieceGroupsSummary.length > 0) {
      return contract.pieceGroupsSummary;
    }
    if (step.parts.length > 8) {
      const grouped = this.buildFallbackPieceGroupsSummary(step.parts);
      if (grouped.length > 0 && grouped.length < step.parts.length) {
        return grouped;
      }
    }
    return null;
  }

  isStepPiecesExpanded(moduleId: string, stepNumber: number): boolean {
    return Boolean(this.expandedStepPiecesByKey()[this.getStepCanvasKey(moduleId, stepNumber)]);
  }

  toggleStepPiecesExpanded(moduleId: string, stepNumber: number): void {
    const key = this.getStepCanvasKey(moduleId, stepNumber);
    this.expandedStepPiecesByKey.update(prev => ({ ...prev, [key]: !prev[key] }));
  }

  isStepDenseDiagram(guide: ModuleAssemblyGuide, step: AssemblyStep | AssemblyStepContract): boolean {
    const mode = this.getEffectiveStepRenderMode(step);
    return mode === 'subassembly_zoom' || mode === 'carcass_mount' || step.parts.length > 8 || this.getDrawerUnitClusters(guide).length > 1;
  }

  onPartHoverStart(codes: string | string[], summary?: string, origin: 'dom' | 'canvas' = 'dom'): void {
    const normalized = this.normalizeCodeList(codes);
    if (normalized.length === 0) return;
    this.hoverOrigin = origin;
    this.hoveredPartCodes.set(normalized);
    this.hoveredSummary.set(summary || this.buildSummaryForCodes(normalized));
  }

  onPartHoverEnd(origin?: 'dom' | 'canvas'): void {
    if (origin && this.hoverOrigin && this.hoverOrigin !== origin) {
      return;
    }
    this.hoverOrigin = null;
    this.hoveredPartCodes.set([]);
    this.hoveredSummary.set('');
  }

  onPartTogglePin(codes: string | string[], summary?: string): void {
    const normalized = this.normalizeCodeList(codes);
    if (normalized.length === 0) return;

    const current = this.pinnedPartCodes();
    const isSame =
      current.length === normalized.length &&
      normalized.every((code, idx) => current[idx] === code);

    if (isSame) {
      this.pinnedPartCodes.set([]);
      this.pinnedSummary.set('');
    } else {
      this.pinnedPartCodes.set(normalized);
      this.pinnedSummary.set(summary || this.buildSummaryForCodes(normalized));
    }
  }

  clearPinnedParts(): void {
    this.pinnedPartCodes.set([]);
    this.pinnedSummary.set('');
    this.hoveredPartCodes.set([]);
    this.hoveredSummary.set('');
    this.hoverOrigin = null;
  }

  isCodeHighlighted(code: string): boolean {
    return this.activeHighlightedCodes().includes(code);
  }

  isAnyCodeHighlighted(codes: string[]): boolean {
    const active = this.activeHighlightedCodes();
    if (active.length === 0) return false;
    return codes.some(code => active.includes(code));
  }

  guideMatchesActiveHighlight(guide: ModuleAssemblyGuide): boolean {
    const active = this.activeHighlightedCodes();
    if (active.length === 0) return false;
    return guide.pieces.some(p => active.includes(p.code));
  }

  buildSinglePieceSummary(piece: AssemblyGuidePiece): string {
    const name = piece.translatedName || piece.name;
    return `${piece.code} · ${name} · ${piece.length}×${piece.width}×${piece.thickness} mm`;
  }

  buildGroupPieceSummary(group: AssemblyPieceGroupSummaryContract): string {
    const codeText = group.codes.length <= 3
      ? group.codes.join(', ')
      : `${group.codes[0]}–${group.codes[group.codes.length - 1]}`;
    return `${codeText} · ${group.label} · ${group.dimensionsText} mm · Grupo ×${group.quantity}`;
  }

  onCanvasMouseMove(event: MouseEvent): void {
    const canvas = event.currentTarget as HTMLCanvasElement | null;
    if (!canvas) return;
    const hit = this.findCalloutHit(canvas, event.clientX, event.clientY);
    if (hit) {
      canvas.style.cursor = 'pointer';
      const current = this.hoveredPartCodes();
      const same = current.length === hit.codes.length && hit.codes.every((c, i) => current[i] === c);
      if (!same) {
        this.onPartHoverStart(hit.codes, this.buildSummaryForCodes(hit.codes), 'canvas');
      }
    } else {
      canvas.style.cursor = 'crosshair';
      if (this.hoverOrigin === 'canvas') {
        this.onPartHoverEnd('canvas');
      }
    }
  }

  onCanvasMouseLeave(): void {
    if (this.hoverOrigin === 'canvas') {
      this.onPartHoverEnd('canvas');
    }
  }

  onCanvasClick(event: MouseEvent): void {
    const canvas = event.currentTarget as HTMLCanvasElement | null;
    if (!canvas) return;
    const hit = this.findCalloutHit(canvas, event.clientX, event.clientY);
    if (hit) {
      this.onPartTogglePin(hit.codes, this.buildSummaryForCodes(hit.codes));
    }
  }

  private findCalloutHit(
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number
  ): MarginalCalloutPlacement | null {
    const placements = this.canvasCalloutHitBoxes.get(canvas);
    if (!placements || placements.length === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const pad = 2;

    for (const p of placements) {
      const r = p.pillRect;
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) {
        return p;
      }
    }
    return null;
  }

  private normalizeCodeList(codes: string | string[]): string[] {
    const arr = Array.isArray(codes) ? codes : [codes];
    return Array.from(new Set(arr.filter(Boolean)));
  }

  private buildSummaryForCodes(codes: string[]): string {
    if (codes.length === 0) return '';
    const guides = this.filteredGuides();
    const matched: AssemblyGuidePiece[] = [];
    for (const g of guides) {
      for (const p of g.pieces) {
        if (codes.includes(p.code)) {
          matched.push(p);
        }
      }
    }
    if (matched.length === 1) {
      return this.buildSinglePieceSummary(matched[0]);
    }
    if (matched.length > 1) {
      const compact = this.formatCompactCodeRange(matched.map(m => m.code));
      return `${compact} · Grupo ×${matched.length}`;
    }
    return codes.join(', ');
  }

  // =========================================================================
  // FASE 4: EXPORTACIÓN E IMPRESIÓN MULTI-PÁGINA AISLADA (CERO RECORTE 1/1)
  // =========================================================================

  printGuide(): void {
    if (this.paymentService.isWorkshopExportRestricted()) {
      this.paymentService.openUpgradeModal('workshop_export', 'pro');
      return;
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const guides = this.filteredGuides();
    // Captura offscreen ignorando cualquier estado de hover/pin para máximo contraste en PDF
    const explodedDataUrls = this.captureExplodedDataUrlsForPrint(guides);
    const { stepDataUrls, subassemblyDataUrls } = this.captureStepDataUrlsForPrint(guides);
    const html = this.buildPrintableDocumentHtml(
      guides,
      this.project(),
      explodedDataUrls,
      stepDataUrls,
      subassemblyDataUrls
    );

    this.printHtmlInIsolatedIframe(html);
  }

  /**
   * Construye un documento HTML5 autónomo limpio para impresión multi-página A4 sin restricciones de modal.
   */
  public buildPrintableDocumentHtml(
    guides: ModuleAssemblyGuide[],
    project: MelamineProject | null | undefined,
    explodedDataUrls: string[] = [],
    stepDataUrls: Record<string, string> | string[] = {},
    subassemblyDataUrls: Record<string, { label: string; url: string }[]> = {}
  ): string {
    const projectTitle = this.escapeHtml(project?.name || 'Proyecto Piezo3D Studio');
    const clientLine = project?.clientName
      ? ` · ${this.escapeHtml(project.clientName)}`
      : '';

    let flatStepIndex = 0;
    const guideBlocks = guides.map((guide, gIdx) => {
      const explodedUrl = explodedDataUrls[gIdx] || '';
      const headerHtml = this.buildPrintableHeaderSection(guide, gIdx, guides.length, projectTitle, clientLine);
      const explodedHtml = this.buildPrintableExplodedSection(guide, explodedUrl);
      const partsTableHtml = this.buildPrintablePartsTableSection(guide);
      const hardwareHtml = this.buildPrintableHardwareSection(guide);
      const stepsHtml = this.buildPrintableStepsSection(
        guide,
        stepDataUrls,
        () => flatStepIndex++,
        subassemblyDataUrls
      );

      return `
        <article class="guide-document">
          ${headerHtml}
          ${explodedHtml}
          ${partsTableHtml}
          ${hardwareHtml}
          ${stepsHtml}
          <footer class="doc-footer">
            <span>${this.escapeHtml(this.i18n.t('assemblyGuide.qualityNote'))}</span>
            <span class="font-numeric">Piezo3D Studio · ${this.escapeHtml(guide.moduleName)}</span>
          </footer>
        </article>
      `;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="${this.escapeHtml(this.i18n.currentLang())}">
<head>
  <meta charset="utf-8" />
  <title>${this.escapeHtml(this.i18n.t('assemblyGuide.title'))} — ${projectTitle}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 14mm; }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
      position: static !important;
      background: #ffffff !important;
      color: #18181b !important;
      margin: 0 !important;
      padding: 0 !important;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11px;
      line-height: 1.45;
    }
    .font-numeric {
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;
      font-variant-numeric: tabular-nums;
    }
    .guide-document {
      display: block;
      width: 100%;
    }
    .guide-document:not(:last-child) {
      page-break-after: always;
      break-after: page;
    }
    .tech-header, .exploded-card, .hardware-card, .assembly-step-card {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .tech-header {
      background: #fafafa;
      border: 1px solid #e4e4e7;
      border-radius: 10px;
      padding: 14px 16px;
      margin-bottom: 14px;
    }
    .tech-header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      border-bottom: 1px solid #e4e4e7;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .eyebrow {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0284c7;
      display: block;
      margin-bottom: 2px;
    }
    .module-title {
      font-size: 18px;
      font-weight: 800;
      color: #18181b;
      margin: 0;
    }
    .project-subtitle {
      font-size: 10px;
      color: #52525b;
      margin: 2px 0 0;
    }
    .meta-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
    }
    .meta-pill {
      background: #ffffff;
      border: 1px solid #d4d4d8;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 10px;
      font-weight: 600;
      color: #18181b;
      white-space: nowrap;
    }
    .tools-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #52525b;
      margin: 0 0 6px;
    }
    .tools-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }
    .tool-chip {
      background: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 6px;
      padding: 5px 8px;
      font-size: 10px;
      color: #27272a;
    }
    .section-card {
      background: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 14px;
    }
    .section-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #e4e4e7;
      padding-bottom: 6px;
      margin-bottom: 10px;
    }
    .section-heading-left {
      display: flex;
      align-items: center;
      gap: 7px;
    }
    .accent-dot {
      width: 8px;
      height: 8px;
      border-radius: 9999px;
      background: #0284c7;
      display: inline-block;
    }
    .accent-dot.graphite {
      background: #18181b;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #18181b;
      margin: 0;
    }
    .section-subtitle {
      font-size: 9px;
      color: #71717a;
    }
    .diagram-frame {
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      background: #ffffff;
      padding: 6px;
      text-align: center;
    }
    .subassembly-frames {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .subassembly-caption {
      font-size: 9.5px;
      font-weight: 700;
      color: #18181b;
      text-align: left;
      margin: 0 0 4px;
    }
    .diagram-img {
      display: block;
      max-width: 100%;
      width: 100%;
      height: auto;
      max-height: 112mm;
      object-fit: contain;
      margin: 0 auto;
    }
    .step-diagram-img {
      display: block;
      max-width: 100%;
      width: 100%;
      height: auto;
      max-height: 62mm;
      object-fit: contain;
      margin: 0 auto;
    }
    .diagram-placeholder {
      padding: 20px;
      color: #71717a;
      font-size: 10px;
      background: #fafafa;
      border-radius: 6px;
    }
    .parts-table-section {
      background: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 10px;
      margin-bottom: 14px;
      overflow: visible;
    }
    .parts-table-header {
      background: #fafafa;
      border-bottom: 1px solid #e4e4e7;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    table.parts-table {
      width: 100%;
      border-collapse: collapse;
      break-inside: auto;
      page-break-inside: auto;
      font-size: 10px;
    }
    table.parts-table thead {
      display: table-header-group;
    }
    table.parts-table th {
      background: #f4f4f5;
      color: #52525b;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 6px 8px;
      border-bottom: 1px solid #e4e4e7;
      text-align: left;
    }
    table.parts-table th.center, table.parts-table td.center { text-align: center; }
    table.parts-table th.right, table.parts-table td.right { text-align: right; }
    table.parts-table tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    table.parts-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #f4f4f5;
      color: #18181b;
      vertical-align: middle;
    }
    .code-badge {
      display: inline-block;
      background: #18181b;
      color: #ffffff;
      border-radius: 4px;
      padding: 1px 6px;
      font-size: 9.5px;
      font-weight: 700;
    }
    .qty-badge {
      display: inline-block;
      background: #f0f9ff;
      color: #0369a1;
      border: 1px solid #bae6fd;
      border-radius: 4px;
      padding: 1px 5px;
      font-size: 9px;
      font-weight: 700;
    }
    .hardware-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .hardware-item {
      background: #fafafa;
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }
    .hardware-name {
      font-size: 10.5px;
      font-weight: 700;
      color: #18181b;
      margin: 0 0 2px;
    }
    .hardware-spec {
      font-size: 9.5px;
      color: #52525b;
      margin: 0;
    }
    .hardware-desc {
      font-size: 9px;
      color: #71717a;
      margin: 3px 0 0;
    }
    .hardware-qty-pill {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      color: #0369a1;
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }
    .steps-section-title {
      font-size: 13px;
      font-weight: 800;
      color: #18181b;
      margin: 0;
    }
    .assembly-step-card {
      background: #ffffff;
      border: 1px solid #d4d4d8;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 12px;
    }
    .step-header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      border-bottom: 1px solid #e4e4e7;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .step-number-box {
      min-width: 34px;
      height: 30px;
      padding: 0 6px;
      border-radius: 6px;
      background: #18181b;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12.5px;
      font-weight: 800;
      flex-shrink: 0;
    }
    .step-title {
      font-size: 12px;
      font-weight: 700;
      color: #18181b;
      margin: 0 0 2px;
    }
    .step-desc {
      font-size: 10px;
      color: #52525b;
      margin: 0;
    }
    .step-body {
      display: grid;
      grid-template-columns: 5fr 7fr;
      gap: 12px;
      align-items: start;
    }
    .step-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .detail-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #71717a;
      display: block;
      margin-bottom: 4px;
    }
    .chip-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .piece-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #fafafa;
      border: 1px solid #e4e4e7;
      border-radius: 5px;
      padding: 3px 6px;
      font-size: 9.5px;
      color: #18181b;
    }
    .hw-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 5px;
      padding: 3px 7px;
      font-size: 9.5px;
      font-weight: 600;
      color: #0369a1;
    }
    .measurements-box {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 7px;
      padding: 7px 9px;
    }
    .measurements-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #0369a1;
      margin: 0 0 5px;
    }
    .measurements-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 5px;
    }
    .measurement-row {
      background: #ffffff;
      border: 1px solid #e0f2fe;
      border-radius: 4px;
      padding: 3px 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      font-size: 9.5px;
    }
    .measurement-val {
      font-weight: 700;
      color: #0284c7;
      white-space: nowrap;
    }
    .tips-list {
      margin: 0;
      padding-left: 14px;
      font-size: 9.5px;
      color: #52525b;
    }
    .tips-list li {
      margin-bottom: 2px;
    }
    .doc-footer {
      border-top: 1px solid #e4e4e7;
      padding-top: 8px;
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #71717a;
    }
  </style>
</head>
<body>
  ${guideBlocks}
</body>
</html>`;
  }

  private buildPrintableHeaderSection(
    guide: ModuleAssemblyGuide,
    gIdx: number,
    totalGuides: number,
    projectTitle: string,
    clientLine: string
  ): string {
    const toolsHtml = guide.requiredTools
      .map(toolKey => `<div class="tool-chip">${this.escapeHtml(this.i18n.t(toolKey))}</div>`)
      .join('');

    return `
      <section class="tech-header">
        <div class="tech-header-top">
          <div>
            <span class="eyebrow">MANUAL RTA · MUEBLE ${gIdx + 1} DE ${totalGuides}</span>
            <h1 class="module-title">${this.escapeHtml(guide.moduleName)}</h1>
            <p class="project-subtitle">${projectTitle}${clientLine}</p>
          </div>
          <div class="meta-pills">
            <div class="meta-pill font-numeric">${guide.dimensions.width} × ${guide.dimensions.height} × ${guide.dimensions.depth} mm</div>
            <div class="meta-pill"><span class="font-numeric">${guide.totalPartsCount}</span> ${this.escapeHtml(this.i18n.t('assemblyGuide.qty'))}</div>
            <div class="meta-pill font-numeric">~${guide.estimatedAssemblyTimeMinutes} ${this.escapeHtml(this.i18n.t('assemblyGuide.minutes'))}</div>
          </div>
        </div>
        <p class="tools-title">${this.escapeHtml(this.i18n.t('assemblyGuide.requiredTools'))}</p>
        <div class="tools-grid">${toolsHtml}</div>
      </section>
    `;
  }

  private buildPrintableExplodedSection(guide: ModuleAssemblyGuide, explodedUrl: string): string {
    const diagramContent = explodedUrl
      ? `<img class="diagram-img" src="${this.escapeAttr(explodedUrl)}" alt="${this.escapeAttr(guide.moduleName)}" />`
      : `<div class="diagram-placeholder">${this.escapeHtml(this.i18n.t('assemblyGuide.explodedViewTitle'))}</div>`;

    return `
      <section class="section-card exploded-card">
        <div class="section-heading">
          <div class="section-heading-left">
            <span class="accent-dot"></span>
            <h2 class="section-title">${this.escapeHtml(this.i18n.t('assemblyGuide.explodedViewTitle'))}</h2>
          </div>
          <span class="section-subtitle">${this.escapeHtml(this.i18n.t('assemblyGuide.explodedViewSubtitle'))}</span>
        </div>
        <div class="diagram-frame">${diagramContent}</div>
      </section>
    `;
  }

  private buildPrintablePartsTableSection(guide: ModuleAssemblyGuide): string {
    const rowsHtml = guide.pieces
      .map(p => {
        const edgesText = `${p.edges.l1 !== 'none' ? 'L1' : '-'}/${p.edges.l2 !== 'none' ? 'L2' : '-'}/${p.edges.a1 !== 'none' ? 'A1' : '-'}/${p.edges.a2 !== 'none' ? 'A2' : '-'}`;
        return `
          <tr>
            <td class="center"><span class="code-badge font-numeric">${this.escapeHtml(p.code)}</span></td>
            <td><strong>${this.escapeHtml(p.translatedName || p.name)}</strong></td>
            <td class="right font-numeric">${p.length} × ${p.width} × ${p.thickness}</td>
            <td class="center font-numeric">${edgesText}</td>
            <td class="center font-numeric"><strong>${p.quantity}</strong></td>
            <td>${this.escapeHtml(p.materialName)}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <section class="parts-table-section">
        <div class="parts-table-header">
          <h2 class="section-title">${this.escapeHtml(this.i18n.t('assemblyGuide.partsTableTitle'))} (<span class="font-numeric">${guide.pieces.length}</span>)</h2>
          <span class="section-subtitle">L1/L2 = Largos · A1/A2 = Anchos</span>
        </div>
        <table class="parts-table">
          <thead>
            <tr>
              <th class="center">${this.escapeHtml(this.i18n.t('assemblyGuide.code'))}</th>
              <th>${this.escapeHtml(this.i18n.t('assemblyGuide.part'))}</th>
              <th class="right">${this.escapeHtml(this.i18n.t('assemblyGuide.dimensionsMm'))}</th>
              <th class="center">${this.escapeHtml(this.i18n.t('assemblyGuide.edges'))}</th>
              <th class="center">${this.escapeHtml(this.i18n.t('assemblyGuide.qty'))}</th>
              <th>${this.escapeHtml(this.i18n.t('assemblyGuide.material'))}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </section>
    `;
  }

  private buildPrintableHardwareSection(guide: ModuleAssemblyGuide): string {
    const itemsHtml = guide.hardwareKit
      .map((hw: AssemblyHardwareItem) => `
        <div class="hardware-item">
          <div>
            <p class="hardware-name">${this.escapeHtml(this.i18n.t(hw.name))}</p>
            <p class="hardware-spec font-numeric">${this.escapeHtml(hw.spec)}</p>
            ${hw.description ? `<p class="hardware-desc">${this.escapeHtml(hw.description)}</p>` : ''}
          </div>
          <span class="hardware-qty-pill font-numeric">×${hw.quantity}</span>
        </div>
      `)
      .join('');

    return `
      <section class="section-card hardware-card">
        <div class="section-heading">
          <div class="section-heading-left">
            <span class="accent-dot graphite"></span>
            <h2 class="section-title">${this.escapeHtml(this.i18n.t('assemblyGuide.hardwareKit'))}</h2>
          </div>
        </div>
        <div class="hardware-grid">${itemsHtml}</div>
      </section>
    `;
  }

  private buildPrintableStepsSection(
    guide: ModuleAssemblyGuide,
    stepDataUrls: Record<string, string> | string[],
    nextFlatIndex: () => number,
    subassemblyDataUrls: Record<string, { label: string; url: string }[]> = {}
  ): string {
    const stepsHtml = guide.steps
      .map(step => {
        const flatIdx = nextFlatIndex();
        const stepKey = this.getStepCanvasKey(guide.moduleId, step.stepNumber);
        const stepDisplayNum = this.formatStepDisplayNumber(guide, step);
        const stepTitle = this.getStepTitle(step);
        const stepDesc = this.getStepDescription(step);
        const multiTemplates = subassemblyDataUrls[stepKey];

        let visualHtml = '';
        if (Array.isArray(multiTemplates) && multiTemplates.length > 1) {
          visualHtml = `
            <div class="subassembly-frames">
              ${multiTemplates.map(tpl => `
                <div class="diagram-frame">
                  <p class="subassembly-caption">${this.escapeHtml(tpl.label)}</p>
                  ${tpl.url
                    ? `<img class="step-diagram-img" src="${this.escapeAttr(tpl.url)}" alt="${this.escapeAttr(tpl.label)}" />`
                    : `<div class="diagram-placeholder">${this.escapeHtml(tpl.label)}</div>`}
                </div>
              `).join('')}
            </div>
          `;
        } else {
          const stepImgUrl = Array.isArray(stepDataUrls)
            ? (stepDataUrls[flatIdx] || '')
            : (stepDataUrls[stepKey] || '');
          visualHtml = `
            <div class="diagram-frame">
              ${stepImgUrl
                ? `<img class="step-diagram-img" src="${this.escapeAttr(stepImgUrl)}" alt="${this.escapeAttr(stepTitle)}" />`
                : `<div class="diagram-placeholder">PASO ${this.escapeHtml(stepDisplayNum)}</div>`}
            </div>
          `;
        }

        const groupsSummary = this.getStepPieceGroupsSummary(step);
        const stepPiecesHtml = groupsSummary
          ? groupsSummary
              .map(grp => `
                <span class="piece-chip">
                  <span class="code-badge font-numeric">${this.escapeHtml(grp.codes.join(', '))}</span>
                  <span>${this.escapeHtml(grp.label)}</span>
                  <span class="font-numeric" style="color:#71717a;">(${this.escapeHtml(grp.dimensionsText)} mm)</span>
                  <span class="qty-badge font-numeric">×${grp.quantity}</span>
                </span>
              `)
              .join('')
          : step.parts
              .map(p => `
                <span class="piece-chip">
                  <span class="code-badge font-numeric">${this.escapeHtml(p.code)}</span>
                  <span>${this.escapeHtml(p.translatedName || p.name)}</span>
                  <span class="font-numeric" style="color:#71717a;">(${p.length}×${p.width}mm)</span>
                </span>
              `)
              .join('');

        const measurementsHtml = step.measurements && step.measurements.length > 0
          ? `
            <div class="measurements-box">
              <p class="measurements-title">${this.escapeHtml(this.i18n.t('assemblyGuide.measurements'))}</p>
              <div class="measurements-grid">
                ${step.measurements.map(m => `
                  <div class="measurement-row">
                    <span>${this.escapeHtml(m.label)}</span>
                    <span class="measurement-val font-numeric">${m.valueMm} mm</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `
          : '';

        const hardwareHtml = step.hardware.length > 0
          ? `
            <div>
              <span class="detail-label">${this.escapeHtml(this.i18n.t('assemblyGuide.hardwareUsed'))}</span>
              <div class="chip-wrap">
                ${step.hardware.map(h => `
                  <span class="hw-chip">
                    <span>${this.escapeHtml(this.i18n.t(h.name))}</span>
                    <strong class="font-numeric">×${h.quantity}</strong>
                  </span>
                `).join('')}
              </div>
            </div>
          `
          : '';

        const tipsHtml = step.tips.length > 0
          ? `<ul class="tips-list">${step.tips.map(tip => `<li>${this.escapeHtml(tip)}</li>`).join('')}</ul>`
          : '';

        return `
          <div class="assembly-step-card">
            <div class="step-header">
              <div class="step-number-box font-numeric">${this.escapeHtml(stepDisplayNum)}</div>
              <div>
                <h3 class="step-title">${this.escapeHtml(stepTitle)}</h3>
                <p class="step-desc">${this.escapeHtml(stepDesc)}</p>
              </div>
            </div>
            <div class="step-body">
              ${visualHtml}
              <div class="step-details">
                <div>
                  <span class="detail-label">${this.escapeHtml(this.i18n.t('assemblyGuide.piecesToInstall'))}</span>
                  <div class="chip-wrap">${stepPiecesHtml}</div>
                </div>
                ${measurementsHtml}
                ${hardwareHtml}
                ${tipsHtml}
              </div>
            </div>
          </div>
        `;
      })
      .join('\n');

    return `
      <section class="steps-section">
        <div class="section-heading">
          <div class="section-heading-left">
            <span class="accent-dot"></span>
            <h2 class="steps-section-title">${this.escapeHtml(this.i18n.t('assemblyGuide.stepsTitle'))}</h2>
          </div>
        </div>
        ${stepsHtml}
      </section>
    `;
  }

  private getStepCanvasKey(moduleId: string, stepNumber: number): string {
    return `${moduleId}::${stepNumber}`;
  }

  private captureExplodedDataUrlsForPrint(guides: ModuleAssemblyGuide[]): string[] {
    if (typeof document === 'undefined') return [];
    const liveCanvases = this.canvasExplodedList();
    const emptyHighlights = new Set<string>();

    return guides.map((guide, idx) => {
      const offscreen = document.createElement('canvas');
      this.renderExplodedDiagram(offscreen, guide, emptyHighlights, 920, 500);
      const url = this.safeCanvasToDataUrl(offscreen);
      if (url) return url;
      const liveEl = liveCanvases[idx]?.nativeElement;
      return liveEl ? this.safeCanvasToDataUrl(liveEl) : '';
    });
  }

  private captureStepDataUrlsForPrint(guides: ModuleAssemblyGuide[]): {
    stepDataUrls: Record<string, string>;
    subassemblyDataUrls: Record<string, { label: string; url: string }[]>;
  } {
    const stepDataUrls: Record<string, string> = {};
    const subassemblyDataUrls: Record<string, { label: string; url: string }[]> = {};
    if (typeof document === 'undefined') {
      return { stepDataUrls, subassemblyDataUrls };
    }

    const emptyHighlights = new Set<string>();

    for (const guide of guides) {
      for (const step of guide.steps) {
        const key = this.getStepCanvasKey(guide.moduleId, step.stepNumber);
        const mode = this.getEffectiveStepRenderMode(step);

        if (mode === 'subassembly_zoom') {
          const subs = this.getStepSubassemblies(guide, step);
          if (subs.length > 1) {
            const tplUrls: { label: string; url: string }[] = [];
            subs.forEach((sub, sIdx) => {
              const offscreen = document.createElement('canvas');
              this.renderStepMiniDiagram(offscreen, guide, step, emptyHighlights, sIdx, 480, 290);
              const url = this.safeCanvasToDataUrl(offscreen);
              tplUrls.push({ label: `${sub.label} (×${sub.repeatCount})`, url });
              if (sIdx === 0 && url) {
                stepDataUrls[key] = url;
              }
            });
            subassemblyDataUrls[key] = tplUrls;
            continue;
          }
        }

        const offscreen = document.createElement('canvas');
        this.renderStepMiniDiagram(offscreen, guide, step, emptyHighlights, undefined, 480, 290);
        const url = this.safeCanvasToDataUrl(offscreen);
        if (url) {
          stepDataUrls[key] = url;
        }
      }
    }

    // Respaldo con canvas montados si el offscreen no devolvió datos en entornos sintéticos
    for (const ref of this.canvasStepList()) {
      const el = ref.nativeElement;
      if (!el) continue;
      const modId = el.getAttribute('data-module-id') || '';
      const stepNum = Number(el.getAttribute('data-step-number'));
      if (modId && Number.isFinite(stepNum)) {
        const key = this.getStepCanvasKey(modId, stepNum);
        if (!stepDataUrls[key]) {
          stepDataUrls[key] = this.safeCanvasToDataUrl(el);
        }
      }
    }

    return { stepDataUrls, subassemblyDataUrls };
  }

  private safeCanvasToDataUrl(canvas: HTMLCanvasElement): string {
    try {
      const url = canvas.toDataURL('image/png');
      return url && url !== 'data:,' ? url : '';
    } catch {
      return '';
    }
  }

  private printHtmlInIsolatedIframe(html: string): void {
    this.cleanupPrintIframe();

    const iframe = document.createElement('iframe');
    iframe.className = 'rta-print-iframe';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.left = '-10000px';
    iframe.style.top = '0';
    iframe.style.width = '794px';
    iframe.style.height = '1123px';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';

    document.body.appendChild(iframe);
    this.activePrintIframe = iframe;

    const iframeDoc = iframe.contentDocument;
    const iframeWin = iframe.contentWindow;
    if (!iframeDoc || !iframeWin) {
      this.cleanupPrintIframe();
      window.print();
      return;
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    const triggerPrint = () => {
      if (this.activePrintIframe !== iframe) return;
      if (typeof iframeWin.print !== 'function') {
        this.cleanupPrintIframe();
        window.print();
        return;
      }

      const handleAfterPrint = () => this.cleanupPrintIframe();
      iframeWin.addEventListener('afterprint', handleAfterPrint, { once: true });
      this.printCleanupTimer = setTimeout(handleAfterPrint, 60000);

      iframeWin.focus();
      iframeWin.print();
    };

    const images = Array.from(iframeDoc.querySelectorAll('img'));
    const pendingImages = images.filter(img => !img.complete);

    const scheduleFramePrint = () => {
      if (typeof iframeWin.requestAnimationFrame === 'function') {
        iframeWin.requestAnimationFrame(() => {
          iframeWin.requestAnimationFrame(triggerPrint);
        });
      } else {
        setTimeout(triggerPrint, 30);
      }
    };

    if (pendingImages.length === 0) {
      scheduleFramePrint();
      return;
    }

    let remaining = pendingImages.length;
    const onImageDone = () => {
      remaining--;
      if (remaining <= 0) {
        scheduleFramePrint();
      }
    };
    for (const img of pendingImages) {
      img.addEventListener('load', onImageDone, { once: true });
      img.addEventListener('error', onImageDone, { once: true });
    }
  }

  private cleanupPrintIframe(): void {
    if (this.printCleanupTimer) {
      clearTimeout(this.printCleanupTimer);
      this.printCleanupTimer = null;
    }
    if (this.activePrintIframe) {
      this.activePrintIframe.remove();
      this.activePrintIframe = null;
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeAttr(value: string): string {
    return this.escapeHtml(value);
  }

  // =========================================================================
  // MOTOR DE DIBUJO TÉCNICO ISOMÉTRICO 3D OBB EN <CANVAS> CON LLAMADAS CAD
  // =========================================================================

  /**
   * Calcula la caja envolvente 3D exacta usando JoineryEngineService.
   */
  public getPartAABB(part: Part): PieceAABB {
    const b = this.joineryEngine.getPartBounds(part);
    const spanX = Math.round((b.maxX - b.minX) * 100) / 100;
    const spanY = Math.round((b.maxY - b.minY) * 100) / 100;
    const spanZ = Math.round((b.maxZ - b.minZ) * 100) / 100;
    return {
      minX: b.minX,
      maxX: b.maxX,
      minY: b.minY,
      maxY: b.maxY,
      minZ: b.minZ,
      maxZ: b.maxZ,
      spanX,
      spanY,
      spanZ,
      cx: (b.minX + b.maxX) / 2,
      cy: (b.minY + b.maxY) / 2,
      cz: (b.minZ + b.maxZ) / 2
    };
  }

  /**
   * Obtiene los 8 vértices 3D reales del Oriented Bounding Box (OBB) en espacio mundo + offset.
   */
  public getPieceOBB(
    part: Part,
    offset: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }
  ): PieceOBBGeometry {
    const normalizedPart = this.normalizePartForGeometry(part);
    const obb = this.partGeometry.getWorldOBB(normalizedPart);
    const center = {
      x: obb.center.x + offset.x,
      y: obb.center.y + offset.y,
      z: obb.center.z + offset.z
    };
    const hx = obb.halfSize.x;
    const hy = obb.halfSize.y;
    const hz = obb.halfSize.z;
    const [ax0, ax1, ax2] = obb.axes;

    const makeCorner = (s0: number, s1: number, s2: number) => ({
      x: center.x + s0 * hx * ax0.x + s1 * hy * ax1.x + s2 * hz * ax2.x,
      y: center.y + s0 * hx * ax0.y + s1 * hy * ax1.y + s2 * hz * ax2.y,
      z: center.z + s0 * hx * ax0.z + s1 * hy * ax1.z + s2 * hz * ax2.z
    });

    const corners = [
      makeCorner(-1, -1, -1),
      makeCorner(1, -1, -1),
      makeCorner(1, 1, -1),
      makeCorner(-1, 1, -1),
      makeCorner(-1, -1, 1),
      makeCorner(1, -1, 1),
      makeCorner(1, 1, 1),
      makeCorner(-1, 1, 1)
    ];

    return {
      center,
      halfSize: obb.halfSize,
      axes: obb.axes,
      corners
    };
  }

  /**
   * Filtra las piezas visibles para un paso: SOLO piezas instaladas en pasos anteriores ('prior')
   * y piezas del paso actual ('current'). Jamás incluye piezas de pasos futuros.
   */
  public getStepRenderPieces(guide: ModuleAssemblyGuide, step: AssemblyStep): StepRenderPieceItem[] {
    const currentCodes = new Set<string>(step.partCodes);
    for (const p of step.parts) {
      currentCodes.add(p.code);
    }

    const priorCodes = new Set<string>();
    const stepContract = step as AssemblyStepContract;

    if (Array.isArray(stepContract.cumulativePriorPartCodes)) {
      for (const code of stepContract.cumulativePriorPartCodes) {
        if (!currentCodes.has(code)) {
          priorCodes.add(code);
        }
      }
    } else {
      for (const s of guide.steps) {
        if (s.stepNumber < step.stepNumber) {
          for (const code of s.partCodes) {
            if (!currentCodes.has(code)) {
              priorCodes.add(code);
            }
          }
        }
      }
    }

    const result: StepRenderPieceItem[] = [];
    for (const piece of guide.pieces) {
      if (currentCodes.has(piece.code)) {
        result.push({ piece, state: 'current' });
      } else if (priorCodes.has(piece.code)) {
        result.push({ piece, state: 'prior' });
      }
    }
    return result;
  }

  private renderAllCanvases(): void {
    if (typeof window === 'undefined') return;

    const explodedCanvases = this.canvasExplodedList();
    const guides = this.filteredGuides();

    explodedCanvases.forEach((canvasRef, index) => {
      const guide = guides[index];
      if (guide && canvasRef?.nativeElement) {
        this.renderExplodedDiagram(canvasRef.nativeElement, guide);
      }
    });

    const stepCanvases = this.canvasStepList();
    stepCanvases.forEach(canvasRef => {
      const el = canvasRef.nativeElement;
      if (!el) return;
      const modId = el.getAttribute('data-module-id');
      const stepNum = Number(el.getAttribute('data-step-number'));
      const guide = guides.find(g => g.moduleId === modId);
      const step = guide?.steps.find(s => s.stepNumber === stepNum);
      if (guide && step) {
        this.renderStepMiniDiagram(el, guide, step);
      }
    });
  }

  /**
   * Renderiza el Diagrama General Explosivo con explosión panorámica para múltiples cajones,
   * columnas marginales CAD fuera de silueta y resaltado interactivo.
   */
  private renderExplodedDiagram(
    canvas: HTMLCanvasElement,
    guide: ModuleAssemblyGuide,
    highlightedCodesOverride?: Set<string>,
    explicitCssWidth?: number,
    explicitCssHeight?: number
  ): void {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 2) : 2;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = explicitCssWidth ?? Math.max(320, rect.width || 780);
    const cssHeight = explicitCssHeight ?? Math.max(240, rect.height || 440);

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    this.drawTechnicalGrid(ctx, cssWidth, cssHeight);

    const pieces = guide.pieces;
    if (pieces.length === 0) {
      ctx.restore();
      return;
    }

    const highlightSet = highlightedCodesOverride ?? new Set(this.activeHighlightedCodes());
    const hasRelevantHighlight = highlightSet.size > 0 && pieces.some(p => highlightSet.has(p.code));
    const viewMode = this.getEffectiveExplodedViewMode(guide);

    const modBounds = this.calculateModuleBounds(pieces);
    const sizeX = modBounds.maxX - modBounds.minX || 600;
    const sizeY = modBounds.maxY - modBounds.minY || 800;
    const sizeZ = modBounds.maxZ - modBounds.minZ || 400;
    const explodeDist = Math.min(sizeX, sizeY, sizeZ) * 0.36 + 70;

    const drawerClusters = this.getDrawerUnitClusters(guide);
    const isPanoramic = drawerClusters.length > 1 || pieces.length > 14;
    const drawerOffsetsByCode = isPanoramic
      ? this.computePanoramicDrawerOffsets(drawerClusters, modBounds, explodeDist)
      : new Map<string, { x: number; y: number; z: number }>();

    const project = (x: number, y: number, z: number): IsoPoint => ({
      u: (x - z) * COS30,
      v: -y + (x + z) * SIN30
    });

    const rawBoxes: ProjectedBox3D[] = [];
    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;

    for (const piece of pieces) {
      const b = this.getPieceBounds(piece);
      const role = this.resolvePieceRole(
        piece,
        b,
        modBounds.minX,
        modBounds.maxX,
        modBounds.minY,
        modBounds.maxY,
        modBounds.minZ,
        modBounds.maxZ
      );

      const panoramicOffset = drawerOffsetsByCode.get(piece.code);
      const offset = panoramicOffset
        ? panoramicOffset
        : this.getExplodeOffset(role, b.cx, b.cy, b.cz, modBounds.cx, modBounds.cy, modBounds.cz, explodeDist);

      const obb = this.getPieceOBB(piece.part, offset);

      for (const c of obb.corners) {
        const pt = project(c.x, c.y, c.z);
        if (pt.u < minU) minU = pt.u;
        if (pt.u > maxU) maxU = pt.u;
        if (pt.v < minV) minV = pt.v;
        if (pt.v > maxV) maxV = pt.v;
      }

      const expAABB: PieceAABB = {
        minX: b.minX + offset.x,
        maxX: b.maxX + offset.x,
        minY: b.minY + offset.y,
        maxY: b.maxY + offset.y,
        minZ: b.minZ + offset.z,
        maxZ: b.maxZ + offset.z,
        spanX: b.spanX,
        spanY: b.spanY,
        spanZ: b.spanZ,
        cx: b.cx + offset.x,
        cy: b.cy + offset.y,
        cz: b.cz + offset.z
      };

      rawBoxes.push({
        piece,
        offset,
        origCenter: { x: b.cx, y: b.cy, z: b.cz },
        expCenter: obb.center,
        aabb: expAABB,
        obb,
        depthKey: obb.center.x + obb.center.y + obb.center.z
      });
    }

    const sideMargin = Math.max(122, Math.min(200, Math.round(cssWidth * 0.22)));
    const topMargin = 38;
    const bottomMargin = 24;
    const availW = Math.max(80, cssWidth - sideMargin * 2);
    const availH = Math.max(80, cssHeight - topMargin - bottomMargin);
    const rangeU = maxU - minU || 1;
    const rangeV = maxV - minV || 1;

    const scale = Math.min(availW / rangeU, availH / rangeV, 0.72);
    const offsetX = sideMargin + (availW - rangeU * scale) / 2 - minU * scale;
    const offsetY = topMargin + (availH - rangeV * scale) / 2 - minV * scale;

    const toScreen = (pt: IsoPoint): IsoPoint => ({
      u: offsetX + pt.u * scale,
      v: offsetY + pt.v * scale
    });

    const boxes = this.sortBoxesPainterOrder(rawBoxes);
    const silhouetteBounds = this.computeProjectedSilhouetteBounds(boxes, project, toScreen);

    // 1. Guías punteadas sutiles (#94A3B8) desde centro original hacia centro explotado
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.9;
    for (const box of boxes) {
      const isHighlighted = highlightSet.has(box.piece.code);
      ctx.globalAlpha = hasRelevantHighlight ? (isHighlighted ? 0.95 : 0.16) : 0.85;
      const origScreen = toScreen(project(box.origCenter.x, box.origCenter.y, box.origCenter.z));
      const expScreen = toScreen(project(box.expCenter.x, box.expCenter.y, box.expCenter.z));

      ctx.beginPath();
      ctx.moveTo(origScreen.u, origScreen.v);
      ctx.lineTo(expScreen.u, expScreen.v);
      ctx.stroke();

      ctx.fillStyle = isHighlighted ? '#0284c7' : '#cbd5e1';
      ctx.beginPath();
      ctx.arc(origScreen.u, origScreen.v, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Dibujar piezas 3D proyectando sus 8 vértices OBB reales con atenuación interactiva
    for (const box of boxes) {
      const isHighlighted = highlightSet.has(box.piece.code);
      const alpha = hasRelevantHighlight ? (isHighlighted ? 1 : 0.24) : 1;
      const style: PartRenderStyle = isHighlighted ? 'highlighted' : 'exploded';
      this.drawIsometricPart(ctx, box.piece.part, box.offset, project, toScreen, style, alpha);
    }

    // 3. Llamadas CAD en Columnas Marginales (Por Grupos vs Todas las Piezas)
    const calloutInputs = this.buildExplodedCalloutInputs(
      guide,
      boxes,
      viewMode,
      highlightSet,
      project,
      toScreen
    );

    const layout = computeMarginalCallouts(calloutInputs, {
      canvasWidth: cssWidth,
      canvasHeight: cssHeight,
      silhouetteBounds,
      outerMargin: 10,
      gutter: 16,
      pillHeight: 18,
      minGapY: 4,
      maxPillWidth: Math.max(88, sideMargin - 28)
    });

    this.canvasCalloutHitBoxes.set(canvas, layout.all);
    this.drawMarginalCallouts(ctx, layout, hasRelevantHighlight);

    ctx.restore();
  }

  /**
   * Renderiza el mini-diagrama progresivo del paso o el modo Zoom de Sub-ensamble / Montaje de Correderas.
   */
  private renderStepMiniDiagram(
    canvas: HTMLCanvasElement,
    guide: ModuleAssemblyGuide,
    step: AssemblyStep | AssemblyStepContract,
    highlightedCodesOverride?: Set<string>,
    subassemblyIndexOverride?: number,
    explicitCssWidth?: number,
    explicitCssHeight?: number
  ): void {
    const mode = this.getEffectiveStepRenderMode(step);
    const highlightSet = highlightedCodesOverride ?? new Set(this.activeHighlightedCodes());

    if (mode === 'subassembly_zoom') {
      this.renderSubassemblyZoomDiagram(
        canvas,
        guide,
        step,
        highlightSet,
        subassemblyIndexOverride,
        explicitCssWidth,
        explicitCssHeight
      );
      return;
    }

    if (mode === 'carcass_mount') {
      this.renderCarcassMountDiagram(
        canvas,
        guide,
        step,
        highlightSet,
        explicitCssWidth,
        explicitCssHeight
      );
      return;
    }

    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 2) : 2;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = explicitCssWidth ?? Math.max(240, rect.width || 380);
    const cssHeight = explicitCssHeight ?? Math.max(170, rect.height || 235);

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const renderItems = this.getStepRenderPieces(guide, step as AssemblyStep);
    if (renderItems.length === 0) {
      ctx.restore();
      return;
    }

    const hasRelevantHighlight =
      highlightSet.size > 0 && renderItems.some(item => highlightSet.has(item.piece.code));

    const zeroOffset = { x: 0, y: 0, z: 0 };
    const project = (x: number, y: number, z: number): IsoPoint => ({
      u: (x - z) * COS30,
      v: -y + (x + z) * SIN30
    });

    const rawBoxes: (ProjectedBox3D & { state: StepPieceVisualState })[] = [];
    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;

    for (const item of renderItems) {
      const aabb = this.getPieceBounds(item.piece);
      const obb = this.getPieceOBB(item.piece.part, zeroOffset);

      for (const c of obb.corners) {
        const pt = project(c.x, c.y, c.z);
        if (pt.u < minU) minU = pt.u;
        if (pt.u > maxU) maxU = pt.u;
        if (pt.v < minV) minV = pt.v;
        if (pt.v > maxV) maxV = pt.v;
      }

      rawBoxes.push({
        piece: item.piece,
        state: item.state,
        offset: zeroOffset,
        origCenter: obb.center,
        expCenter: obb.center,
        aabb,
        obb,
        depthKey: obb.center.x + obb.center.y + obb.center.z
      });
    }

    const sideMargin = Math.max(82, Math.min(126, Math.round(cssWidth * 0.24)));
    const topMargin = 34;
    const bottomMargin = 20;
    const availW = Math.max(60, cssWidth - sideMargin * 2);
    const availH = Math.max(60, cssHeight - topMargin - bottomMargin);
    const rangeU = maxU - minU || 1;
    const rangeV = maxV - minV || 1;

    const scale = Math.min(availW / rangeU, availH / rangeV, 0.65);
    const offsetX = sideMargin + (availW - rangeU * scale) / 2 - minU * scale;
    const offsetY = topMargin + (availH - rangeV * scale) / 2 - minV * scale;

    const toScreen = (pt: IsoPoint): IsoPoint => ({
      u: offsetX + pt.u * scale,
      v: offsetY + pt.v * scale
    });

    const boxes = this.sortBoxesPainterOrder(rawBoxes);
    const silhouetteBounds = this.computeProjectedSilhouetteBounds(boxes, project, toScreen);

    // 1. Dibujar piezas permitidas (prior en piedra neutra, current en Azul Acero)
    for (const box of boxes) {
      const isHighlighted = highlightSet.has(box.piece.code);
      const alpha = hasRelevantHighlight ? (isHighlighted ? 1 : 0.24) : 1;
      const style: PartRenderStyle = isHighlighted ? 'highlighted' : box.state;
      this.drawIsometricPart(ctx, box.piece.part, zeroOffset, project, toScreen, style, alpha);
    }

    // 2. Anotaciones técnicas del paso
    const currentBoxes = boxes.filter(b => b.state === 'current');
    const stepBounds = this.calculateModuleBounds(renderItems.map(r => r.piece));
    this.drawStepTechnicalAnnotations(ctx, guide, step, currentBoxes, stepBounds, toScreen, project, cssWidth);

    // 3. Llamadas marginales limpias para las piezas actuales del paso
    const calloutInputs: MarginalCalloutInput[] = currentBoxes.map(box => {
      const pt = toScreen(project(box.obb.center.x, box.obb.center.y, box.obb.center.z));
      const faceMetric = this.estimateProjectedFaceMetric(box.obb, project, toScreen);
      return {
        id: box.piece.partId,
        code: box.piece.code,
        label: this.shortenPartLabel(box.piece),
        anchorX: pt.u,
        anchorY: pt.v,
        highlighted: highlightSet.has(box.piece.code),
        codes: [box.piece.code],
        ...faceMetric
      };
    });

    const layout = computeMarginalCallouts(calloutInputs, {
      canvasWidth: cssWidth,
      canvasHeight: cssHeight,
      silhouetteBounds,
      outerMargin: 8,
      gutter: 12,
      pillHeight: 16,
      minGapY: 4,
      maxPillWidth: Math.max(62, sideMargin - 20)
    });

    this.canvasCalloutHitBoxes.set(canvas, layout.all);
    this.drawMarginalCallouts(ctx, layout, hasRelevantHighlight);

    ctx.restore();
  }

  /**
   * Renderiza una única caja de cajón ampliada (zoom) y explosionada al centro con insignia `ARMAR ×N JUEGOS IGUALES`.
   */
  private renderSubassemblyZoomDiagram(
    canvas: HTMLCanvasElement,
    guide: ModuleAssemblyGuide,
    step: AssemblyStep | AssemblyStepContract,
    highlightSet: Set<string>,
    subassemblyIndexOverride?: number,
    explicitCssWidth?: number,
    explicitCssHeight?: number
  ): void {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 2) : 2;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = explicitCssWidth ?? Math.max(260, rect.width || 400);
    const cssHeight = explicitCssHeight ?? Math.max(210, rect.height || 255);

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    this.drawTechnicalGrid(ctx, cssWidth, cssHeight);

    const subs = this.getStepSubassemblies(guide, step);
    const activeIdx = subassemblyIndexOverride !== undefined
      ? clampNumber(subassemblyIndexOverride, 0, Math.max(0, subs.length - 1))
      : this.getSelectedSubassemblyIndex(guide.moduleId, step.stepNumber, subs.length);
    const activeSub = subs[activeIdx];
    const repParts = activeSub?.representativeParts?.length
      ? activeSub.representativeParts
      : step.parts.slice(0, 5);

    if (repParts.length === 0) {
      ctx.restore();
      return;
    }

    const boxBounds = this.calculateModuleBounds(repParts);
    const explodeX = Math.max(52, boxBounds.spanX * 0.16);
    const explodeY = Math.max(46, boxBounds.spanY * 0.48);
    const explodeZ = Math.max(52, boxBounds.spanZ * 0.18);

    const project = (x: number, y: number, z: number): IsoPoint => ({
      u: (x - z) * COS30,
      v: -y + (x + z) * SIN30
    });

    const rawBoxes: ProjectedBox3D[] = [];
    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;

    for (const piece of repParts) {
      const b = this.getPieceBounds(piece);
      const localRole = this.classifyDrawerBoxPart(piece, b, boxBounds);

      let dx = -boxBounds.cx;
      let dy = -boxBounds.cy;
      let dz = -boxBounds.cz;

      switch (localRole) {
        case 'bottom':
          dy -= explodeY;
          dz += explodeZ * 0.12;
          break;
        case 'side_left':
          dx -= explodeX;
          break;
        case 'side_right':
          dx += explodeX;
          break;
        case 'back':
          dz -= explodeZ;
          break;
        case 'front':
          dz += explodeZ;
          break;
      }

      const offset = { x: dx, y: dy, z: dz };
      const obb = this.getPieceOBB(piece.part, offset);
      for (const c of obb.corners) {
        const pt = project(c.x, c.y, c.z);
        if (pt.u < minU) minU = pt.u;
        if (pt.u > maxU) maxU = pt.u;
        if (pt.v < minV) minV = pt.v;
        if (pt.v > maxV) maxV = pt.v;
      }

      rawBoxes.push({
        piece,
        offset,
        origCenter: { x: b.cx - boxBounds.cx, y: b.cy - boxBounds.cy, z: b.cz - boxBounds.cz },
        expCenter: obb.center,
        aabb: {
          minX: b.minX + dx,
          maxX: b.maxX + dx,
          minY: b.minY + dy,
          maxY: b.maxY + dy,
          minZ: b.minZ + dz,
          maxZ: b.maxZ + dz,
          spanX: b.spanX,
          spanY: b.spanY,
          spanZ: b.spanZ,
          cx: b.cx + dx,
          cy: b.cy + dy,
          cz: b.cz + dz
        },
        obb,
        depthKey: obb.center.x + obb.center.y + obb.center.z
      });
    }

    const sideMargin = Math.max(92, Math.min(138, Math.round(cssWidth * 0.25)));
    const topMargin = 42;
    const bottomMargin = 22;
    const availW = Math.max(70, cssWidth - sideMargin * 2);
    const availH = Math.max(70, cssHeight - topMargin - bottomMargin);
    const rangeU = maxU - minU || 1;
    const rangeV = maxV - minV || 1;

    // Zoom amplio de sub-ensamble (hasta 1.45x) para ocupar limpiamente el centro del lienzo
    const scale = Math.min(availW / rangeU, availH / rangeV, 1.45);
    const offsetX = sideMargin + (availW - rangeU * scale) / 2 - minU * scale;
    const offsetY = topMargin + (availH - rangeV * scale) / 2 - minV * scale;

    const toScreen = (pt: IsoPoint): IsoPoint => ({
      u: offsetX + pt.u * scale,
      v: offsetY + pt.v * scale
    });

    const boxes = this.sortBoxesPainterOrder(rawBoxes);
    const silhouetteBounds = this.computeProjectedSilhouetteBounds(boxes, project, toScreen);

    // Verificar resaltado contra grupo equivalente o códigos directos de la caja representativa
    const hasRelevantHighlight =
      highlightSet.size > 0 &&
      (boxes.some(b => highlightSet.has(b.piece.code)) ||
        (activeSub ? activeSub.allBoxPartCodes.some(c => highlightSet.has(c)) : false));

    const isPieceHighlighted = (piece: AssemblyGuidePiece): boolean => {
      if (highlightSet.has(piece.code)) return true;
      if (!activeSub || highlightSet.size === 0) return false;
      // Si se resalta una pieza equivalente de otro cajón del mismo grupo, iluminar su análogo en la plantilla zoom
      const matchingGroup = activeSub.pieceGroupsSummary.find(
        grp => grp.representativeCode === piece.code || grp.codes.includes(piece.code)
      );
      return Boolean(matchingGroup && matchingGroup.codes.some(c => highlightSet.has(c)));
    };

    // Guías punteadas hacia el centro ensamblado de la caja
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    for (const box of boxes) {
      const origPt = toScreen(project(box.origCenter.x, box.origCenter.y, box.origCenter.z));
      const expPt = toScreen(project(box.expCenter.x, box.expCenter.y, box.expCenter.z));
      ctx.beginPath();
      ctx.moveTo(origPt.u, origPt.v);
      ctx.lineTo(expPt.u, expPt.v);
      ctx.stroke();
    }
    ctx.restore();

    for (const box of boxes) {
      const highlighted = isPieceHighlighted(box.piece);
      const alpha = hasRelevantHighlight ? (highlighted ? 1 : 0.24) : 1;
      const style: PartRenderStyle = highlighted ? 'highlighted' : 'current';
      this.drawIsometricPart(ctx, box.piece.part, box.offset, project, toScreen, style, alpha);
    }

    // Insignia superior izquierda: ARMAR ×N JUEGOS IGUALES
    const repeatCount = activeSub?.repeatCount ?? Math.max(1, this.getDrawerUnitClusters(guide).length);
    const repeatBadgeText = `ARMAR ×${repeatCount} JUEGOS IGUALES`;
    ctx.save();
    ctx.font = 'bold 9.5px "Inter", sans-serif';
    const badgeW = Math.min(cssWidth - 96, ctx.measureText(repeatBadgeText).width + 18);
    ctx.fillStyle = '#18181b';
    this.drawRoundedRectPath(ctx, 10, 10, badgeW, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(repeatBadgeText, 10 + badgeW / 2, 20);

    // Sub-etiqueta dimensional de la caja si hay medidas disponibles
    if (activeSub) {
      const dimLabel = `${activeSub.label} · ${activeSub.dimensions.width}×${activeSub.dimensions.depth}×${activeSub.boxHeight} mm`;
      ctx.font = '600 9px "JetBrains Mono", monospace';
      const dimW = Math.min(cssWidth - badgeW - 92, ctx.measureText(dimLabel).width + 12);
      if (dimW > 48) {
        ctx.fillStyle = '#f4f4f5';
        ctx.strokeStyle = '#d4d4d8';
        ctx.lineWidth = 1;
        this.drawRoundedRectPath(ctx, 10, 34, dimW, 17, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#3f3f46';
        ctx.textAlign = 'left';
        ctx.fillText(this.fitTextWithEllipsis(ctx, dimLabel, dimW - 10), 15, 42.5);
      }
    }

    // Pastilla PASO en la esquina superior derecha
    const stepLabel = `PASO ${this.formatStepDisplayNumber(guide, step)}`;
    ctx.fillStyle = '#18181b';
    this.drawRoundedRectPath(ctx, cssWidth - 72, 10, 62, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stepLabel, cssWidth - 41, 20);
    ctx.restore();

    // Llamadas CAD marginales de las piezas representativas del cajón
    const calloutInputs: MarginalCalloutInput[] = boxes.map(box => {
      const pt = toScreen(project(box.expCenter.x, box.expCenter.y, box.expCenter.z));
      const matchingGroup = activeSub?.pieceGroupsSummary.find(
        grp => grp.representativeCode === box.piece.code || grp.codes.includes(box.piece.code)
      );
      return {
        id: box.piece.partId,
        code: box.piece.code,
        label: this.shortenPartLabel(box.piece, true),
        anchorX: pt.u,
        anchorY: pt.v,
        highlighted: isPieceHighlighted(box.piece),
        codes: matchingGroup?.codes?.length ? matchingGroup.codes : [box.piece.code]
      };
    });

    const layout = computeMarginalCallouts(calloutInputs, {
      canvasWidth: cssWidth,
      canvasHeight: cssHeight,
      silhouetteBounds,
      outerMargin: 10,
      gutter: 12,
      pillHeight: 17,
      minGapY: 4,
      maxPillWidth: Math.max(76, sideMargin - 22)
    });

    this.canvasCalloutHitBoxes.set(canvas, layout.all);
    this.drawMarginalCallouts(ctx, layout, hasRelevantHighlight);

    ctx.restore();
  }

  /**
   * Renderiza el paso de montaje en casco (`carcass_mount`): casco neutro + cajones deslizándose
   * hacia adelante + líneas punteadas de cota real en mm + 1 llamada marginal por unidad de cajón.
   */
  private renderCarcassMountDiagram(
    canvas: HTMLCanvasElement,
    guide: ModuleAssemblyGuide,
    step: AssemblyStep | AssemblyStepContract,
    highlightSet: Set<string>,
    explicitCssWidth?: number,
    explicitCssHeight?: number
  ): void {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 2) : 2;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = explicitCssWidth ?? Math.max(260, rect.width || 400);
    const cssHeight = explicitCssHeight ?? Math.max(210, rect.height || 255);

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const renderItems = this.getStepRenderPieces(guide, step as AssemblyStep);
    if (renderItems.length === 0) {
      ctx.restore();
      return;
    }

    const clusters = this.getDrawerUnitClusters(guide);
    const drawerCodeToCluster = new Map<string, DrawerUnitCluster>();
    for (const cl of clusters) {
      for (const code of cl.codes) {
        drawerCodeToCluster.set(code, cl);
      }
    }

    const modBounds = this.calculateModuleBounds(renderItems.map(r => r.piece));
    const slidePullBase = Math.min(220, Math.max(95, modBounds.spanZ * 0.36));

    const project = (x: number, y: number, z: number): IsoPoint => ({
      u: (x - z) * COS30,
      v: -y + (x + z) * SIN30
    });

    const rawBoxes: (ProjectedBox3D & { isDrawer: boolean; unitIndex?: number })[] = [];
    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;

    for (const item of renderItems) {
      const b = this.getPieceBounds(item.piece);
      const cl = drawerCodeToCluster.get(item.piece.code);
      const isDrawer = Boolean(cl) || this.isDrawerPiece(item.piece);
      const unitIndex = cl?.unitIndex ?? 1;
      const pullZ = isDrawer ? slidePullBase + ((unitIndex - 1) % 2) * 32 : 0;
      const offset = { x: 0, y: 0, z: pullZ };
      const obb = this.getPieceOBB(item.piece.part, offset);

      for (const c of obb.corners) {
        const pt = project(c.x, c.y, c.z);
        if (pt.u < minU) minU = pt.u;
        if (pt.u > maxU) maxU = pt.u;
        if (pt.v < minV) minV = pt.v;
        if (pt.v > maxV) maxV = pt.v;
      }

      rawBoxes.push({
        piece: item.piece,
        isDrawer,
        unitIndex: cl?.unitIndex,
        offset,
        origCenter: { x: b.cx, y: b.cy, z: b.cz },
        expCenter: obb.center,
        aabb: {
          minX: b.minX,
          maxX: b.maxX,
          minY: b.minY,
          maxY: b.maxY,
          minZ: b.minZ + pullZ,
          maxZ: b.maxZ + pullZ,
          spanX: b.spanX,
          spanY: b.spanY,
          spanZ: b.spanZ,
          cx: b.cx,
          cy: b.cy,
          cz: b.cz + pullZ
        },
        obb,
        depthKey: obb.center.x + obb.center.y + obb.center.z
      });
    }

    const sideMargin = Math.max(90, Math.min(134, Math.round(cssWidth * 0.25)));
    const topMargin = 34;
    const bottomMargin = 20;
    const availW = Math.max(70, cssWidth - sideMargin * 2);
    const availH = Math.max(70, cssHeight - topMargin - bottomMargin);
    const rangeU = maxU - minU || 1;
    const rangeV = maxV - minV || 1;

    const scale = Math.min(availW / rangeU, availH / rangeV, 0.65);
    const offsetX = sideMargin + (availW - rangeU * scale) / 2 - minU * scale;
    const offsetY = topMargin + (availH - rangeV * scale) / 2 - minV * scale;

    const toScreen = (pt: IsoPoint): IsoPoint => ({
      u: offsetX + pt.u * scale,
      v: offsetY + pt.v * scale
    });

    const boxes = this.sortBoxesPainterOrder(rawBoxes);
    const silhouetteBounds = this.computeProjectedSilhouetteBounds(boxes, project, toScreen);
    const hasRelevantHighlight =
      highlightSet.size > 0 && boxes.some(b => highlightSet.has(b.piece.code));

    for (const box of boxes) {
      const isHighlighted = highlightSet.has(box.piece.code);
      const alpha = hasRelevantHighlight ? (isHighlighted ? 1 : 0.24) : 1;
      const style: PartRenderStyle = isHighlighted ? 'highlighted' : (box.isDrawer ? 'current' : 'prior');
      this.drawIsometricPart(ctx, box.piece.part, box.offset, project, toScreen, style, alpha);
    }

    // Líneas punteadas horizontales con cotas reales en mm para alturas de correderas
    const sidePiece = guide.pieces.find(p => (p.resolvedRole ?? p.componentRole) === 'side_left')
      ?? guide.pieces.find(p => (p.resolvedRole ?? p.componentRole) === 'side_right');
    const sideBounds = sidePiece ? this.getPieceBounds(sidePiece) : modBounds;
    const railElevations = this.extractRailElevationsForMount(step, clusters, sideBounds);

    ctx.save();
    for (const rail of railElevations) {
      const yWorld = rail.yWorld;
      const lineStart = toScreen(project(rail.sideX, yWorld, modBounds.minZ + 20));
      const lineEnd = toScreen(project(rail.sideX, yWorld, modBounds.maxZ + 32));

      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(lineStart.u, lineStart.v);
      ctx.lineTo(lineEnd.u, lineEnd.v);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(lineEnd.u, lineEnd.v, 2.3, 0, Math.PI * 2);
      ctx.fill();

      // Etiqueta compacta en mm sobre el extremo de la línea de riel
      const dimText = `${rail.valueMm}mm`;
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      const tagW = ctx.measureText(dimText).width + 8;
      const tagX = clampNumber(lineEnd.u - tagW / 2, silhouetteBounds.minX, silhouetteBounds.maxX - tagW);
      const tagY = lineEnd.v - 13;
      ctx.fillStyle = '#f0f9ff';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 0.9;
      this.drawRoundedRectPath(ctx, tagX, tagY, tagW, 13, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0369a1';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dimText, tagX + tagW / 2, tagY + 6.5);
    }

    // Pastilla PASO en la esquina superior derecha
    const stepLabel = `PASO ${this.formatStepDisplayNumber(guide, step)}`;
    ctx.fillStyle = '#18181b';
    this.drawRoundedRectPath(ctx, cssWidth - 72, 10, 62, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stepLabel, cssWidth - 41, 20);
    ctx.restore();

    // 1 llamada marginal por cajón (compactCallouts del servicio o clusters cliente)
    const stepContract = step as AssemblyStepContract;
    const compactCallouts = Array.isArray(stepContract.compactCallouts) && stepContract.compactCallouts.length > 0
      ? stepContract.compactCallouts
      : clusters.map(cl => ({
          id: cl.id,
          label: `Cajón ${cl.unitIndex}`,
          sublabel: cl.frontPiece?.code ?? this.formatCompactCodeRange(cl.codes),
          codes: cl.codes,
          primaryCode: cl.frontPiece?.code ?? cl.codes[0],
          role: 'drawer_front' as ComponentRole,
          kind: 'drawer_unit' as const,
          drawerUnitIndex: cl.unitIndex
        }));

    const calloutInputs: MarginalCalloutInput[] = [];
    for (const cc of compactCallouts) {
      const matchingBoxes = boxes.filter(b => cc.codes.includes(b.piece.code));
      if (matchingBoxes.length === 0) continue;
      const primaryBox = matchingBoxes.find(b => b.piece.code === cc.primaryCode) ?? matchingBoxes[0];
      const pt = toScreen(project(primaryBox.expCenter.x, primaryBox.expCenter.y, primaryBox.expCenter.z));
      calloutInputs.push({
        id: cc.id,
        code: cc.drawerUnitIndex ? `C${cc.drawerUnitIndex}` : cc.primaryCode,
        label: cc.sublabel ? `${cc.label} · ${cc.sublabel}` : cc.label,
        anchorX: pt.u,
        anchorY: pt.v,
        highlighted: cc.codes.some(c => highlightSet.has(c)),
        codes: cc.codes
      });
    }

    const layout = computeMarginalCallouts(calloutInputs, {
      canvasWidth: cssWidth,
      canvasHeight: cssHeight,
      silhouetteBounds,
      outerMargin: 8,
      gutter: 12,
      pillHeight: 16,
      minGapY: 4,
      maxPillWidth: Math.max(70, sideMargin - 20)
    });

    this.canvasCalloutHitBoxes.set(canvas, layout.all);
    this.drawMarginalCallouts(ctx, layout, hasRelevantHighlight);

    ctx.restore();
  }

  private extractRailElevationsForMount(
    step: AssemblyStep | AssemblyStepContract,
    clusters: DrawerUnitCluster[],
    sideBounds: PieceAABB
  ): { sideX: number; yWorld: number; valueMm: number }[] {
    const result: { sideX: number; yWorld: number; valueMm: number }[] = [];
    const measurements = step.measurements ?? [];

    if (clusters.length > 0) {
      clusters.forEach((cl, idx) => {
        const meas = measurements[idx];
        const valueMm = meas ? meas.valueMm : Math.max(40, Math.round(cl.cy - sideBounds.minY));
        const yWorld = sideBounds.minY + valueMm;
        const sideX = cl.cx <= sideBounds.cx ? sideBounds.maxX : sideBounds.minX;
        result.push({ sideX, yWorld, valueMm });
      });
      return result;
    }

    for (const m of measurements) {
      result.push({
        sideX: sideBounds.maxX,
        yWorld: sideBounds.minY + m.valueMm,
        valueMm: m.valueMm
      });
    }
    return result;
  }

  private buildExplodedCalloutInputs(
    guide: ModuleAssemblyGuide,
    boxes: ProjectedBox3D[],
    viewMode: 'grouped' | 'detailed',
    highlightSet: Set<string>,
    project: (x: number, y: number, z: number) => IsoPoint,
    toScreen: (pt: IsoPoint) => IsoPoint
  ): MarginalCalloutInput[] {
    const boxByCode = new Map<string, ProjectedBox3D>();
    for (const box of boxes) {
      boxByCode.set(box.piece.code, box);
    }

    if (viewMode === 'grouped') {
      const groups = this.getExplodedCalloutGroups(guide);
      if (groups.length > 0) {
        const inputs: MarginalCalloutInput[] = [];
        for (const grp of groups) {
          if (grp.kind === 'drawer_unit') {
            const unitBoxes = grp.codes
              .map(c => boxByCode.get(c))
              .filter((b): b is ProjectedBox3D => Boolean(b));
            if (unitBoxes.length === 0) continue;

            const avgX = unitBoxes.reduce((s, b) => s + b.expCenter.x, 0) / unitBoxes.length;
            const avgY = unitBoxes.reduce((s, b) => s + b.expCenter.y, 0) / unitBoxes.length;
            const avgZ = unitBoxes.reduce((s, b) => s + b.expCenter.z, 0) / unitBoxes.length;
            const anchorPt = toScreen(project(avgX, avgY, avgZ));
            const codeBadge = grp.drawerUnitIndex ? `C${grp.drawerUnitIndex}` : grp.primaryCode;
            const label = grp.sublabel ? `${grp.label} · ${grp.sublabel}` : grp.label;

            inputs.push({
              id: grp.id,
              code: codeBadge,
              label,
              anchorX: anchorPt.u,
              anchorY: anchorPt.v,
              highlighted: grp.codes.some(c => highlightSet.has(c)),
              codes: grp.codes
            });
          } else {
            const box = boxByCode.get(grp.primaryCode);
            if (!box) continue;
            const anchorPt = toScreen(project(box.expCenter.x, box.expCenter.y, box.expCenter.z));
            const faceMetric = this.estimateProjectedFaceMetric(box.obb, project, toScreen);
            inputs.push({
              id: grp.id,
              code: box.piece.code,
              label: this.shortenPartLabel(box.piece),
              anchorX: anchorPt.u,
              anchorY: anchorPt.v,
              highlighted: grp.codes.some(c => highlightSet.has(c)),
              codes: grp.codes,
              ...faceMetric
            });
          }
        }
        if (inputs.length > 0) {
          return inputs;
        }
      }
    }

    return boxes.map(box => {
      const anchorPt = toScreen(project(box.expCenter.x, box.expCenter.y, box.expCenter.z));
      const faceMetric = this.estimateProjectedFaceMetric(box.obb, project, toScreen);
      return {
        id: box.piece.partId,
        code: box.piece.code,
        label: this.shortenPartLabel(box.piece),
        anchorX: anchorPt.u,
        anchorY: anchorPt.v,
        highlighted: highlightSet.has(box.piece.code),
        codes: [box.piece.code],
        ...faceMetric
      };
    });
  }

  private drawMarginalCallouts(
    ctx: CanvasRenderingContext2D,
    layout: MarginalCalloutLayoutResult,
    hasRelevantHighlight: boolean
  ): void {
    // 1. Sellos sutiles dentro de caras planas grandes (si hay densidad extrema)
    for (const stamp of layout.faceStamps) {
      ctx.save();
      ctx.globalAlpha = hasRelevantHighlight ? (stamp.highlighted ? 1 : 0.25) : 0.92;
      const r = stamp.pillRect;
      ctx.fillStyle = stamp.highlighted ? '#f0f9ff' : '#ffffff';
      ctx.strokeStyle = stamp.highlighted ? '#0284c7' : '#a1a1aa';
      ctx.lineWidth = stamp.highlighted ? 1.3 : 1;
      this.drawRoundedRectPath(ctx, r.left, r.top, r.width, r.height, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = stamp.highlighted ? '#0369a1' : '#18181b';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stamp.code, r.left + r.width / 2, r.top + r.height / 2 + 0.5);
      ctx.restore();
    }

    // 2. Columnas marginales (dibujar primero normales y al final los resaltados encima)
    const marginalPlacements = [...layout.leftColumn, ...layout.rightColumn].sort(
      (a, b) => Number(a.highlighted) - Number(b.highlighted)
    );

    for (const p of marginalPlacements) {
      const r = p.pillRect;
      const isHighlighted = p.highlighted;

      ctx.save();
      ctx.globalAlpha = hasRelevantHighlight ? (isHighlighted ? 1 : 0.28) : 1;

      // Línea guía quebrada de 2 segmentos (attach -> elbow -> anchor)
      const strokeColor = isHighlighted ? '#0284c7' : '#64748b';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isHighlighted ? 1.5 : 0.9;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p.attachX, p.attachY);
      ctx.lineTo(p.elbowX, p.elbowY);
      ctx.lineTo(p.anchorX, p.anchorY);
      ctx.stroke();

      // Punto terminal r = 2.4px con halo blanco sutil para contraste sobre caras sombreadas
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.anchorX, p.anchorY, 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(p.anchorX, p.anchorY, 2.4, 0, Math.PI * 2);
      ctx.fill();

      // Rectángulo CAD estilizado
      const radius = 4;
      ctx.fillStyle = isHighlighted ? '#f0f9ff' : '#ffffff';
      ctx.strokeStyle = isHighlighted ? '#0284c7' : '#d4d4d8';
      ctx.lineWidth = isHighlighted ? 1.4 : 1;
      this.drawRoundedRectPath(ctx, r.left, r.top, r.width, r.height, radius);
      ctx.fill();
      ctx.stroke();

      const fontSizeCode = r.height <= 16 ? 8.5 : 9.5;
      const fontSizeLabel = r.height <= 16 ? 8.5 : 9.5;
      ctx.font = `bold ${fontSizeCode}px "JetBrains Mono", monospace`;
      const measuredCodeW = ctx.measureText(p.code).width + 9;
      const compactOnlyCode = r.width < 46;
      const codeBoxW = compactOnlyCode
        ? r.width
        : Math.min(Math.max(24, measuredCodeW), Math.round(r.width * 0.46));

      // Bloque izquierdo del código en Grafito (#18181B) o Azul Acero (#0284C7) si resaltado
      ctx.fillStyle = isHighlighted ? '#0284c7' : '#18181b';
      this.drawRoundedRectPath(
        ctx,
        r.left,
        r.top,
        codeBoxW,
        r.height,
        compactOnlyCode ? radius : [radius, 0, 0, radius]
      );
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.code, r.left + codeBoxW / 2, r.top + r.height / 2 + 0.5);

      if (!compactOnlyCode) {
        const maxLabelW = r.width - codeBoxW - 9;
        if (maxLabelW > 10) {
          ctx.font = `600 ${fontSizeLabel}px "Inter", sans-serif`;
          ctx.fillStyle = isHighlighted ? '#0369a1' : '#18181b';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          const text = this.fitTextWithEllipsis(ctx, p.label, maxLabelW);
          ctx.fillText(text, r.left + codeBoxW + 5, r.top + r.height / 2 + 0.5);
        }
      }

      ctx.restore();
    }
  }

  private fitTextWithEllipsis(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) {
      return text;
    }
    const ellipsis = '…';
    let trimmed = text;
    while (trimmed.length > 1 && ctx.measureText(trimmed + ellipsis).width > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    return trimmed + ellipsis;
  }

  private drawRoundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radii: number | [number, number, number, number]
  ): void {
    const [tl, tr, br, bl] = Array.isArray(radii)
      ? radii
      : [radii, radii, radii, radii];
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, [tl, tr, br, bl]);
      return;
    }
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl);
    ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  }

  private computeProjectedSilhouetteBounds(
    boxes: { obb: PieceOBBGeometry }[],
    project: (x: number, y: number, z: number) => IsoPoint,
    toScreen: (pt: IsoPoint) => IsoPoint
  ): SilhouetteBounds2D {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const box of boxes) {
      for (const c of box.obb.corners) {
        const sp = toScreen(project(c.x, c.y, c.z));
        if (sp.u < minX) minX = sp.u;
        if (sp.u > maxX) maxX = sp.u;
        if (sp.v < minY) minY = sp.v;
        if (sp.v > maxY) maxY = sp.v;
      }
    }

    if (!Number.isFinite(minX)) {
      return { minX: 120, maxX: 280, minY: 80, maxY: 240 };
    }
    return { minX, maxX, minY, maxY };
  }

  private estimateProjectedFaceMetric(
    obb: PieceOBBGeometry,
    project: (x: number, y: number, z: number) => IsoPoint,
    toScreen: (pt: IsoPoint) => IsoPoint
  ): {
    faceCenterX: number;
    faceCenterY: number;
    faceSpanW: number;
    faceSpanH: number;
  } {
    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;
    for (const c of obb.corners) {
      const sp = toScreen(project(c.x, c.y, c.z));
      if (sp.u < minU) minU = sp.u;
      if (sp.u > maxU) maxU = sp.u;
      if (sp.v < minV) minV = sp.v;
      if (sp.v > maxV) maxV = sp.v;
    }
    return {
      faceCenterX: (minU + maxU) / 2,
      faceCenterY: (minV + maxV) / 2,
      faceSpanW: Math.max(0, maxU - minU),
      faceSpanH: Math.max(0, maxV - minV)
    };
  }

  /**
   * Dibuja una pieza usando sus 8 vértices 3D reales del OBB (soporta rotaciones arbitrarias)
   * con proyección isométrica y orden de caras visibles hacia la cámara (+1, +1, +1).
   */
  private drawIsometricPart(
    ctx: CanvasRenderingContext2D,
    part: Part,
    offset: { x: number; y: number; z: number },
    project: (x: number, y: number, z: number) => IsoPoint,
    toScreen: (pt: IsoPoint) => IsoPoint,
    state: PartRenderStyle,
    alpha = 1
  ): PieceOBBGeometry {
    const obb = this.getPieceOBB(part, offset);
    const screenCorners = obb.corners.map(c => toScreen(project(c.x, c.y, c.z)));
    const [ax0, ax1, ax2] = obb.axes;
    const palette = this.getPartRenderPalette(state);

    const faces: { indices: [number, number, number, number]; normal: { x: number; y: number; z: number } }[] = [
      { indices: [3, 2, 6, 7], normal: ax1 },
      { indices: [0, 1, 5, 4], normal: { x: -ax1.x, y: -ax1.y, z: -ax1.z } },
      { indices: [4, 5, 6, 7], normal: ax2 },
      { indices: [0, 3, 2, 1], normal: { x: -ax2.x, y: -ax2.y, z: -ax2.z } },
      { indices: [1, 5, 6, 2], normal: ax0 },
      { indices: [0, 4, 7, 3], normal: { x: -ax0.x, y: -ax0.y, z: -ax0.z } }
    ];

    const visibleFaces = faces
      .map(face => {
        const dot = face.normal.x + face.normal.y + face.normal.z;
        const fc = face.indices.reduce(
          (acc, idx) => ({
            x: acc.x + obb.corners[idx].x * 0.25,
            y: acc.y + obb.corners[idx].y * 0.25,
            z: acc.z + obb.corners[idx].z * 0.25
          }),
          { x: 0, y: 0, z: 0 }
        );
        return { ...face, dot, depth: fc.x + fc.y + fc.z };
      })
      .filter(f => f.dot > 1e-4)
      .sort((a, b) => a.depth - b.depth);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = palette.lineWidth;
    ctx.strokeStyle = palette.stroke;
    ctx.lineJoin = 'round';

    for (const face of visibleFaces) {
      ctx.fillStyle = this.pickFaceShade(face.normal, palette);
      ctx.beginPath();
      const p0 = screenCorners[face.indices[0]];
      ctx.moveTo(p0.u, p0.v);
      for (let k = 1; k < 4; k++) {
        const pk = screenCorners[face.indices[k]];
        ctx.lineTo(pk.u, pk.v);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
    return obb;
  }

  private getPartRenderPalette(state: PartRenderStyle): PartRenderPalette {
    switch (state) {
      case 'highlighted':
        return {
          top: '#e0f2fe',
          front: '#bae6fd',
          side: '#7dd3fc',
          stroke: '#0284c7',
          lineWidth: 2.1
        };
      case 'current':
        return {
          top: '#e0f2fe',
          front: '#bae6fd',
          side: '#7dd3fc',
          stroke: '#0284c7',
          lineWidth: 1.75
        };
      case 'prior':
        return {
          top: '#f4f4f5',
          front: '#e4e4e7',
          side: '#d4d4d8',
          stroke: '#71717a',
          lineWidth: 1.05
        };
      case 'exploded':
      default:
        return {
          top: '#ffffff',
          front: '#f4f4f5',
          side: '#e4e4e7',
          stroke: '#3f3f46',
          lineWidth: 1.2
        };
    }
  }

  private pickFaceShade(
    normal: { x: number; y: number; z: number },
    palette: PartRenderPalette
  ): string {
    const absX = Math.abs(normal.x);
    const absY = Math.abs(normal.y);
    const absZ = Math.abs(normal.z);

    if (absY >= absX && absY >= absZ) {
      return normal.y >= 0 ? palette.top : palette.side;
    }
    if (normal.z >= normal.x) {
      return palette.front;
    }
    return palette.side;
  }

  private drawStepTechnicalAnnotations(
    ctx: CanvasRenderingContext2D,
    guide: ModuleAssemblyGuide,
    step: AssemblyStep | AssemblyStepContract,
    currentBoxes: { piece: AssemblyGuidePiece; aabb: PieceAABB; obb: PieceOBBGeometry }[],
    stepBounds: PieceAABB,
    toScreen: (pt: IsoPoint) => IsoPoint,
    project: (x: number, y: number, z: number) => IsoPoint,
    width: number
  ): void {
    ctx.save();

    const stepLabel = `PASO ${this.formatStepDisplayNumber(guide, step)}`;
    ctx.fillStyle = '#18181b';
    this.drawRoundedRectPath(ctx, width - 72, 10, 62, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stepLabel, width - 41, 20);

    if (step.actionType === 'carcass') {
      for (const box of currentBoxes) {
        const role = this.resolvePieceRole(
          box.piece,
          box.aabb,
          stepBounds.minX,
          stepBounds.maxX,
          stepBounds.minY,
          stepBounds.maxY,
          stepBounds.minZ,
          stepBounds.maxZ
        );
        const c = box.obb.center;
        if (role === 'side_left') {
          const from = toScreen(project(c.x - 62, c.y, c.z));
          const to = toScreen(project(c.x - 14, c.y, c.z));
          this.drawInsertionArrow(ctx, from.u, from.v, to.u, to.v, '#0284c7');
        } else if (role === 'side_right') {
          const from = toScreen(project(c.x + 62, c.y, c.z));
          const to = toScreen(project(c.x + 14, c.y, c.z));
          this.drawInsertionArrow(ctx, from.u, from.v, to.u, to.v, '#0284c7');
        } else if (role === 'top' || role === 'tie') {
          const from = toScreen(project(c.x, c.y + 62, c.z));
          const to = toScreen(project(c.x, c.y + 14, c.z));
          this.drawInsertionArrow(ctx, from.u, from.v, to.u, to.v, '#0284c7');
        } else if (role === 'bottom' || role === 'plinth') {
          const from = toScreen(project(c.x, c.y - 54, c.z));
          const to = toScreen(project(c.x, c.y - 12, c.z));
          this.drawInsertionArrow(ctx, from.u, from.v, to.u, to.v, '#0284c7');
        }
      }
    } else if (step.actionType === 'back') {
      for (const box of currentBoxes) {
        const corners = box.obb.corners;
        const d1a = toScreen(project((corners[0].x + corners[4].x) * 0.5, (corners[0].y + corners[4].y) * 0.5, (corners[0].z + corners[4].z) * 0.5));
        const d1b = toScreen(project((corners[2].x + corners[6].x) * 0.5, (corners[2].y + corners[6].y) * 0.5, (corners[2].z + corners[6].z) * 0.5));
        const d2a = toScreen(project((corners[3].x + corners[7].x) * 0.5, (corners[3].y + corners[7].y) * 0.5, (corners[3].z + corners[7].z) * 0.5));
        const d2b = toScreen(project((corners[1].x + corners[5].x) * 0.5, (corners[1].y + corners[5].y) * 0.5, (corners[1].z + corners[5].z) * 0.5));

        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.4;

        ctx.beginPath();
        ctx.moveTo(d1a.u, d1a.v);
        ctx.lineTo(d1b.u, d1b.v);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(d2a.u, d2a.v);
        ctx.lineTo(d2b.u, d2b.v);
        ctx.stroke();

        const midX = (d1a.u + d1b.u) / 2;
        const midY = (d1a.v + d1b.v) / 2;
        ctx.setLineDash([]);
        ctx.fillStyle = '#18181b';
        this.drawRoundedRectPath(ctx, midX - 42, midY - 11, 84, 22, 11);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('D1 = D2 (90°)', midX, midY);

        const c = box.obb.center;
        const from = toScreen(project(c.x, c.y, c.z - 64));
        const to = toScreen(project(c.x, c.y, c.z - 12));
        this.drawInsertionArrow(ctx, from.u, from.v, to.u, to.v, '#0284c7');
      }
    } else if (step.actionType === 'shelves') {
      for (const box of currentBoxes) {
        const c = box.obb.center;
        const topY = box.aabb.maxY;
        const from = toScreen(project(c.x, topY + 62, c.z));
        const to = toScreen(project(c.x, topY + 10, c.z));
        this.drawInsertionArrow(ctx, from.u, from.v, to.u, to.v, '#0284c7');
      }
    } else if (step.actionType === 'drawers') {
      for (const box of currentBoxes) {
        const c = box.obb.center;
        const startPt = toScreen(project(c.x, c.y, box.aabb.maxZ - 28));
        const endPt = toScreen(project(c.x, c.y, box.aabb.maxZ + 46));
        this.drawInsertionArrow(ctx, startPt.u, startPt.v, endPt.u, endPt.v, '#0284c7');
      }
    } else if (step.actionType === 'doors') {
      for (const box of currentBoxes) {
        this.drawDoorHardwareMarkers(ctx, box.piece.part, box.obb, toScreen, project);
      }
    }

    ctx.restore();
  }

  private drawDoorHardwareMarkers(
    ctx: CanvasRenderingContext2D,
    part: Part,
    obb: PieceOBBGeometry,
    toScreen: (pt: IsoPoint) => IsoPoint,
    project: (x: number, y: number, z: number) => IsoPoint
  ): void {
    const hw = part.hardwareConfig;
    const [ax0, ax1, ax2] = obb.axes;
    const hx = obb.halfSize.x;
    const hy = obb.halfSize.y;
    const hz = obb.halfSize.z;
    const c = obb.center;

    const pointOnDoor = (fx: number, fy: number, fz: number) =>
      toScreen(
        project(
          c.x + fx * hx * ax0.x + fy * hy * ax1.x + fz * hz * ax2.x,
          c.y + fx * hx * ax0.y + fy * hy * ax1.y + fz * hz * ax2.y,
          c.z + fx * hx * ax0.z + fy * hy * ax1.z + fz * hz * ax2.z
        )
      );

    let openDir = hw?.openingDirection;
    if (!openDir) {
      const upper = (part.name || '').toUpperCase();
      if (upper.includes('DERECH')) openDir = 'right';
      else if (upper.includes('ELEVABLE') || upper.includes('ABATIBLE SUP')) openDir = 'top';
      else if (upper.includes('ABATIBLE INF')) openDir = 'bottom';
      else openDir = 'left';
    }

    const hingeSpots: IsoPoint[] = [];
    let handleA: IsoPoint;
    let handleB: IsoPoint;

    if (openDir === 'top') {
      hingeSpots.push(pointOnDoor(-0.45, 0.78, 1.02), pointOnDoor(0.45, 0.78, 1.02));
      handleA = pointOnDoor(-0.22, -0.78, 1.04);
      handleB = pointOnDoor(0.22, -0.78, 1.04);
    } else if (openDir === 'bottom') {
      hingeSpots.push(pointOnDoor(-0.45, -0.78, 1.02), pointOnDoor(0.45, -0.78, 1.02));
      handleA = pointOnDoor(-0.22, 0.78, 1.04);
      handleB = pointOnDoor(0.22, 0.78, 1.04);
    } else if (openDir === 'right') {
      hingeSpots.push(pointOnDoor(0.82, 0.52, 1.02), pointOnDoor(0.82, -0.52, 1.02));
      handleA = pointOnDoor(-0.78, 0.18, 1.04);
      handleB = pointOnDoor(-0.78, -0.18, 1.04);
    } else {
      hingeSpots.push(pointOnDoor(-0.82, 0.52, 1.02), pointOnDoor(-0.82, -0.52, 1.02));
      handleA = pointOnDoor(0.78, 0.18, 1.04);
      handleB = pointOnDoor(0.78, -0.18, 1.04);
    }

    ctx.save();

    for (const spot of hingeSpots) {
      ctx.fillStyle = '#d97706';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(spot.u, spot.v, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (hw?.handleType !== 'none' && hw?.handleType !== 'push' && hw?.handleType !== 'push_open') {
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(handleA.u, handleA.v);
      ctx.lineTo(handleB.u, handleB.v);
      ctx.stroke();
    }

    const arrowFrom = toScreen(project(c.x + ax2.x * 62, c.y + ax2.y * 62, c.z + ax2.z * 62));
    const arrowTo = toScreen(project(c.x + ax2.x * (hz + 12), c.y + ax2.y * (hz + 12), c.z + ax2.z * (hz + 12)));
    this.drawInsertionArrow(ctx, arrowFrom.u, arrowFrom.v, arrowTo.u, arrowTo.v, '#0284c7');

    ctx.restore();
  }

  private drawInsertionArrow(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string
  ): void {
    const headLen = 8;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.9;

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  private drawTechnicalGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.strokeStyle = '#f4f4f5';
    ctx.lineWidth = 0.8;

    const gridSize = 24;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  // =========================================================================
  // CLUSTERIZACIÓN DE CAJONES, EXPLOSIÓN PANORÁMICA Y FALLBACKS DE CLIENTE
  // =========================================================================

  private isDrawerPiece(piece: AssemblyGuidePiece): boolean {
    const role = (piece as AssemblyGuidePieceContract).resolvedRole ?? piece.componentRole;
    if (
      role === 'drawer_front' ||
      role === 'drawer_box' ||
      role === 'drawer_lateral' ||
      role === 'drawer_bottom'
    ) {
      return true;
    }
    const lower = (piece.name || '').toLowerCase();
    return lower.includes('cajón') || lower.includes('cajon');
  }

  private getDrawerUnitClusters(guide: ModuleAssemblyGuide): DrawerUnitCluster[] {
    const drawerPieces = guide.pieces.filter(p => this.isDrawerPiece(p));
    if (drawerPieces.length === 0) return [];

    // 1. Si el servicio ya pobló drawerClusterId / drawerUnitIndex, respetarlos
    const preClustered = new Map<string, { unitIndex?: number; pieces: AssemblyGuidePiece[] }>();
    let hasServiceClusters = true;
    for (const p of drawerPieces) {
      const c = p as AssemblyGuidePieceContract;
      if (!c.drawerClusterId) {
        hasServiceClusters = false;
        break;
      }
      const bucket = preClustered.get(c.drawerClusterId) ?? { unitIndex: c.drawerUnitIndex, pieces: [] };
      bucket.pieces.push(p);
      preClustered.set(c.drawerClusterId, bucket);
    }

    if (hasServiceClusters && preClustered.size > 0) {
      const clusters: DrawerUnitCluster[] = [];
      let fallbackIdx = 1;
      for (const [id, data] of preClustered.entries()) {
        const bounds = this.calculateModuleBounds(data.pieces);
        const frontPiece = data.pieces.find(
          p => ((p as AssemblyGuidePieceContract).resolvedRole ?? p.componentRole) === 'drawer_front'
        );
        const boxPieces = data.pieces.filter(p => p !== frontPiece);
        clusters.push({
          id,
          unitIndex: data.unitIndex ?? fallbackIdx++,
          pieces: data.pieces,
          boxPieces,
          frontPiece,
          codes: data.pieces.map(p => p.code),
          cx: bounds.cx,
          cy: bounds.cy,
          cz: bounds.cz,
          minY: bounds.minY,
          maxY: bounds.maxY
        });
      }
      return clusters.sort((a, b) => a.unitIndex - b.unitIndex);
    }

    // 2. Clusterización espacial de fallback por coordenadas 3D (worldBounds)
    const fronts: AssemblyGuidePiece[] = [];
    const boxes: AssemblyGuidePiece[] = [];
    for (const p of drawerPieces) {
      const role = (p as AssemblyGuidePieceContract).resolvedRole ?? p.componentRole;
      const lower = (p.name || '').toLowerCase();
      if (role === 'drawer_front' || (lower.includes('frente') && !lower.includes('contrafrente') && !lower.includes('interior'))) {
        fronts.push(p);
      } else {
        boxes.push(p);
      }
    }

    interface TempCluster {
      pieces: AssemblyGuidePiece[];
      boxPieces: AssemblyGuidePiece[];
      frontPiece?: AssemblyGuidePiece;
      cx: number;
      cy: number;
      cz: number;
      minY: number;
      maxY: number;
    }

    const tempClusters: TempCluster[] = [];
    for (const bp of boxes) {
      const b = this.getPieceBounds(bp);
      let target = tempClusters.find(
        c => Math.abs(b.cx - c.cx) <= 95 && (Math.abs(b.cy - c.cy) <= 95 || (b.minY <= c.maxY + 18 && b.maxY >= c.minY - 18))
      );
      if (!target) {
        target = {
          pieces: [],
          boxPieces: [],
          cx: b.cx,
          cy: b.cy,
          cz: b.cz,
          minY: b.minY,
          maxY: b.maxY
        };
        tempClusters.push(target);
      }
      target.pieces.push(bp);
      target.boxPieces.push(bp);
      target.minY = Math.min(target.minY, b.minY);
      target.maxY = Math.max(target.maxY, b.maxY);
      const count = target.boxPieces.length;
      target.cx = ((target.cx * (count - 1)) + b.cx) / count;
      target.cy = ((target.cy * (count - 1)) + b.cy) / count;
      target.cz = ((target.cz * (count - 1)) + b.cz) / count;
    }

    for (const fp of fronts) {
      const fb = this.getPieceBounds(fp);
      let best: TempCluster | undefined;
      let bestDist = Infinity;
      for (const c of tempClusters) {
        if (c.frontPiece) continue;
        const dx = Math.abs(fb.cx - c.cx);
        const dy = Math.abs(fb.cy - c.cy);
        if (dx <= 120 && dy <= 110) {
          const dist = dx + dy * 1.4;
          if (dist < bestDist) {
            bestDist = dist;
            best = c;
          }
        }
      }
      if (best) {
        best.frontPiece = fp;
        best.pieces.push(fp);
      } else {
        tempClusters.push({
          pieces: [fp],
          boxPieces: [],
          frontPiece: fp,
          cx: fb.cx,
          cy: fb.cy,
          cz: fb.cz,
          minY: fb.minY,
          maxY: fb.maxY
        });
      }
    }

    tempClusters.sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));

    return tempClusters.map((c, idx) => ({
      id: `drawer-unit-${idx + 1}`,
      unitIndex: idx + 1,
      pieces: c.pieces,
      boxPieces: c.boxPieces,
      frontPiece: c.frontPiece,
      codes: c.pieces.map(p => p.code),
      cx: c.cx,
      cy: c.cy,
      cz: c.cz,
      minY: c.minY,
      maxY: c.maxY
    }));
  }

  private getExplodedCalloutGroups(guide: ModuleAssemblyGuide): AssemblyExplodedGroupCalloutContract[] {
    const contract = guide as ModuleAssemblyGuideContract;
    if (Array.isArray(contract.explodedCalloutGroups) && contract.explodedCalloutGroups.length > 0) {
      return contract.explodedCalloutGroups;
    }

    const clusters = this.getDrawerUnitClusters(guide);
    if (clusters.length <= 1 && guide.pieces.length <= 14) {
      return [];
    }

    const drawerCodes = new Set<string>();
    for (const cl of clusters) {
      for (const code of cl.codes) {
        drawerCodes.add(code);
      }
    }

    const groups: AssemblyExplodedGroupCalloutContract[] = [];
    for (const p of guide.pieces) {
      if (drawerCodes.has(p.code)) continue;
      groups.push({
        id: p.partId,
        label: this.shortenPartLabel(p),
        sublabel: '',
        codes: [p.code],
        primaryCode: p.code,
        role: (p as AssemblyGuidePieceContract).resolvedRole ?? p.componentRole ?? 'free',
        kind: 'part'
      });
    }

    for (const cl of clusters) {
      groups.push({
        id: cl.id,
        label: `Cajón ${cl.unitIndex}`,
        sublabel: this.formatCompactCodeRange(cl.codes),
        codes: cl.codes,
        primaryCode: cl.frontPiece?.code ?? cl.codes[0],
        role: 'drawer_box',
        kind: 'drawer_unit',
        drawerUnitIndex: cl.unitIndex
      });
    }

    return groups;
  }

  private computePanoramicDrawerOffsets(
    clusters: DrawerUnitCluster[],
    modBounds: PieceAABB,
    explodeDist: number
  ): Map<string, { x: number; y: number; z: number }> {
    const map = new Map<string, { x: number; y: number; z: number }>();
    if (clusters.length === 0) return map;

    // Agrupar por columnas horizontales (torre izq vs torre der si existen)
    const xCols: number[] = [];
    for (const cl of clusters) {
      if (!xCols.some(xc => Math.abs(xc - cl.cx) <= 120)) {
        xCols.push(cl.cx);
      }
    }
    xCols.sort((a, b) => a - b);

    const colBuckets = new Map<number, DrawerUnitCluster[]>();
    for (const cl of clusters) {
      let colIdx = 0;
      let bestDist = Infinity;
      xCols.forEach((xc, idx) => {
        const d = Math.abs(cl.cx - xc);
        if (d < bestDist) {
          bestDist = d;
          colIdx = idx;
        }
      });
      const list = colBuckets.get(colIdx) ?? [];
      list.push(cl);
      colBuckets.set(colIdx, list);
    }

    for (const [colIdx, list] of colBuckets.entries()) {
      list.sort((a, b) => a.cy - b.cy);
      const count = list.length;

      list.forEach((cl, rank) => {
        let dx: number;
        let dz: number;
        const dy = (rank - (count - 1) / 2) * 26;

        if (xCols.length > 1) {
          const sideSign = colIdx === 0 ? -1 : 1;
          dx = sideSign * explodeDist * 0.45 + (cl.cx - modBounds.cx) * 0.25;
          dz = explodeDist * (1.05 + rank * 0.24);
        } else {
          const altSign = count <= 2 ? 0 : (rank % 2 === 0 ? -1 : 1);
          dx = altSign * explodeDist * 0.36;
          dz = explodeDist * (1.02 + rank * 0.22);
        }

        for (const p of cl.pieces) {
          const role = (p as AssemblyGuidePieceContract).resolvedRole ?? p.componentRole;
          const isFront = role === 'drawer_front' || p === cl.frontPiece;
          map.set(p.code, {
            x: dx,
            y: dy,
            z: isFront ? dz + explodeDist * 0.28 : dz
          });
        }
      });
    }

    return map;
  }

  private buildFallbackDrawerSubassemblies(
    guide: ModuleAssemblyGuide,
    stepParts: AssemblyGuidePiece[]
  ): AssemblyDrawerSubassemblyContract[] {
    const clusters = this.getDrawerUnitClusters(guide).filter(cl =>
      cl.boxPieces.some(bp => stepParts.some(sp => sp.code === bp.code))
    );
    if (clusters.length === 0) return [];

    interface SignatureGroup {
      label: string;
      boxHeight: number;
      width: number;
      depth: number;
      clusters: DrawerUnitCluster[];
    }

    const groups = new Map<string, SignatureGroup>();
    for (const cl of clusters) {
      const boxParts = cl.boxPieces.length > 0 ? cl.boxPieces : cl.pieces;
      const b = this.calculateModuleBounds(boxParts);
      const boxH = Math.round(b.spanY);
      const w = Math.round(b.spanX);
      const d = Math.round(b.spanZ);
      const sig = `${Math.round(w / 4) * 4}x${Math.round(d / 4) * 4}x${Math.round(boxH / 4) * 4}`;
      const existing = groups.get(sig);
      if (existing) {
        existing.clusters.push(cl);
      } else {
        groups.set(sig, {
          label: `Cajón ${boxH}mm`,
          boxHeight: boxH,
          width: w,
          depth: d,
          clusters: [cl]
        });
      }
    }

    let idx = 1;
    const result: AssemblyDrawerSubassemblyContract[] = [];
    for (const [sig, grp] of groups.entries()) {
      const repCluster = grp.clusters[0];
      const repParts = repCluster.boxPieces.length > 0 ? repCluster.boxPieces : repCluster.pieces;
      const allBoxParts = grp.clusters.flatMap(c => (c.boxPieces.length > 0 ? c.boxPieces : c.pieces));
      result.push({
        id: `sub-${idx++}-${sig}`,
        label: grp.label,
        repeatCount: grp.clusters.length,
        dimensions: { width: grp.width, height: grp.boxHeight, depth: grp.depth },
        boxHeight: grp.boxHeight,
        drawerUnitLabels: grp.clusters.map(c => `Cajón ${c.unitIndex}`),
        representativeParts: repParts,
        representativeFront: repCluster.frontPiece,
        allBoxPartCodes: allBoxParts.map(p => p.code),
        allFrontPartCodes: grp.clusters.map(c => c.frontPiece?.code).filter((v): v is string => Boolean(v)),
        allPartCodes: grp.clusters.flatMap(c => c.codes),
        railElevationsMm: grp.clusters.map(c => Math.round(c.cy)),
        pieceGroupsSummary: this.buildFallbackPieceGroupsSummary(allBoxParts)
      });
    }

    return result;
  }

  private buildFallbackPieceGroupsSummary(parts: AssemblyGuidePiece[]): AssemblyPieceGroupSummaryContract[] {
    const groups = new Map<string, {
      label: string;
      role: ComponentRole;
      dimensionsText: string;
      codes: string[];
      quantity: number;
    }>();

    for (const p of parts) {
      const role = (p as AssemblyGuidePieceContract).resolvedRole ?? p.componentRole ?? 'free';
      const cleanLabel = this.stripDrawerInstancePrefix(p.translatedName || p.name);
      const dims = [p.length, p.width, p.thickness].map(v => Math.round(v)).sort((a, b) => b - a);
      const key = `${role}::${cleanLabel.toLowerCase()}::${dims.join('x')}`;
      const existing = groups.get(key);
      if (existing) {
        existing.codes.push(p.code);
        existing.quantity += Math.max(1, p.quantity || 1);
      } else {
        groups.set(key, {
          label: cleanLabel,
          role,
          dimensionsText: `${p.length}×${p.width}×${p.thickness}`,
          codes: [p.code],
          quantity: Math.max(1, p.quantity || 1)
        });
      }
    }

    return Array.from(groups.entries()).map(([key, g]) => ({
      key,
      label: g.label,
      role: g.role,
      dimensionsText: g.dimensionsText,
      quantity: g.quantity,
      codes: g.codes,
      representativeCode: g.codes[0]
    }));
  }

  private classifyDrawerBoxPart(
    piece: AssemblyGuidePiece,
    b: PieceAABB,
    boxBounds: PieceAABB
  ): 'bottom' | 'side_left' | 'side_right' | 'back' | 'front' {
    const role = (piece as AssemblyGuidePieceContract).resolvedRole ?? piece.componentRole;
    const lower = (piece.name || '').toLowerCase();
    if (role === 'drawer_bottom' || piece.thickness <= 6 || b.spanY <= 8 || lower.includes('fondo')) {
      return 'bottom';
    }
    if (b.spanX <= 28 && b.spanZ > b.spanX * 1.8) {
      return b.cx <= boxBounds.cx ? 'side_left' : 'side_right';
    }
    if (lower.includes('trasera')) return 'back';
    if (lower.includes('contrafrente') || lower.includes('frente')) return 'front';
    return b.cz <= boxBounds.cz ? 'back' : 'front';
  }

  private stripDrawerInstancePrefix(name: string): string {
    return name
      .replace(/^Caj[oó]n\s*\d+\s*[-–:]\s*/i, '')
      .replace(/\s*\(Caj[oó]n\s*\d+\)\s*$/i, '')
      .trim() || name;
  }

  private shortenPartLabel(piece: AssemblyGuidePiece, stripDrawerPrefix = false): string {
    let raw = piece.translatedName || piece.name;
    if (stripDrawerPrefix) {
      raw = this.stripDrawerInstancePrefix(raw);
    }
    return raw
      .replace(/Lateral Izquierdo( de Caja)?/gi, 'Lat. Izq')
      .replace(/Lateral Derecho( de Caja)?/gi, 'Lat. Der')
      .replace(/Contrafrente Interior/gi, 'Contrafrente')
      .replace(/Trasera Interior/gi, 'Trasera')
      .replace(/Fondo Trasero Ranurado/gi, 'Fondo Tras.')
      .replace(/Puerta Abatible Superior/gi, 'Puerta Sup.')
      .replace(/Puerta Abatible Inferior/gi, 'Puerta Inf.')
      .replace(/Frente de Caj[oó]n/gi, 'Frente')
      .replace(/Repisa Interna/gi, 'Repisa')
      .replace(/Base Inferior/gi, 'Base')
      .replace(/Techo Superior/gi, 'Techo')
      .trim();
  }

  private formatCompactCodeRange(codes: string[]): string {
    if (codes.length === 0) return '';
    if (codes.length === 1) return codes[0];

    const parsed = codes.map(code => {
      const match = /^([A-Za-z]+)(\d+)$/.exec(code.trim());
      return match
        ? { raw: code, prefix: match[1], num: Number(match[2]) }
        : { raw: code, prefix: '', num: NaN };
    });

    const parts: string[] = [];
    let i = 0;
    while (i < parsed.length) {
      const start = parsed[i];
      if (!start.prefix || Number.isNaN(start.num)) {
        parts.push(start.raw);
        i++;
        continue;
      }
      let endIdx = i;
      while (
        endIdx + 1 < parsed.length &&
        parsed[endIdx + 1].prefix === start.prefix &&
        parsed[endIdx + 1].num === parsed[endIdx].num + 1
      ) {
        endIdx++;
      }
      if (endIdx - i >= 2) {
        parts.push(`${start.raw}–${parsed[endIdx].raw}`);
      } else {
        for (let k = i; k <= endIdx; k++) {
          parts.push(parsed[k].raw);
        }
      }
      i = endIdx + 1;
    }

    return parts.join(', ');
  }

  private getPieceBounds(piece: AssemblyGuidePiece): PieceAABB {
    const contract = piece as AssemblyGuidePieceContract;
    if (contract.worldBounds && Number.isFinite(contract.worldBounds.spanX)) {
      return contract.worldBounds;
    }
    return this.getPartAABB(piece.part);
  }

  private calculateModuleBounds(pieces: AssemblyGuidePiece[]): PieceAABB {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const p of pieces) {
      const b = this.getPieceBounds(p);
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxY > maxY) maxY = b.maxY;
      if (b.minZ < minZ) minZ = b.minZ;
      if (b.maxZ > maxZ) maxZ = b.maxZ;
    }

    const rMinX = Number.isFinite(minX) ? minX : 0;
    const rMaxX = Number.isFinite(maxX) ? maxX : 600;
    const rMinY = Number.isFinite(minY) ? minY : 0;
    const rMaxY = Number.isFinite(maxY) ? maxY : 800;
    const rMinZ = Number.isFinite(minZ) ? minZ : 0;
    const rMaxZ = Number.isFinite(maxZ) ? maxZ : 400;

    return {
      minX: rMinX,
      maxX: rMaxX,
      minY: rMinY,
      maxY: rMaxY,
      minZ: rMinZ,
      maxZ: rMaxZ,
      spanX: rMaxX - rMinX,
      spanY: rMaxY - rMinY,
      spanZ: rMaxZ - rMinZ,
      cx: (rMinX + rMaxX) / 2,
      cy: (rMinY + rMaxY) / 2,
      cz: (rMinZ + rMaxZ) / 2
    };
  }

  private normalizePartForGeometry(part: Part): Part {
    if (part.orientation) {
      return part;
    }
    const upperName = (part.name || '').toUpperCase();
    const isDoorPart =
      part.componentRole === 'door' ||
      part.hardwareConfig?.movableType === 'door' ||
      (upperName.includes('PUERTA') && !upperName.includes('CAJ'));

    if (!isDoorPart) {
      return part;
    }

    const rotY = Math.abs((part.rotationY || 0) % 180);
    if (rotY === 90) {
      return {
        ...part,
        orientation: 'vertical_yz',
        rotationY: 0
      };
    }

    return {
      ...part,
      orientation: 'vertical_xy',
      length: part.width,
      width: part.length
    };
  }

  private resolvePieceRole(
    piece: AssemblyGuidePiece,
    b: PieceAABB,
    modMinX: number,
    modMaxX: number,
    modMinY: number,
    modMaxY: number,
    modMinZ: number,
    modMaxZ: number
  ): ComponentRole {
    const contract = piece as AssemblyGuidePieceContract;
    if (contract.resolvedRole && contract.resolvedRole !== 'free') {
      return contract.resolvedRole;
    }
    if (piece.componentRole && piece.componentRole !== 'free') {
      return piece.componentRole;
    }

    const isOrthogonalAngle = (deg?: number): boolean => {
      const rem = Math.abs(deg || 0) % 90;
      return rem < 1 || rem > 89;
    };
    if (
      !isOrthogonalAngle(piece.part.rotationX) ||
      !isOrthogonalAngle(piece.part.rotationY) ||
      !isOrthogonalAngle(piece.part.rotationZ)
    ) {
      return 'free';
    }

    const modD = Math.max(1, modMaxZ - modMinZ);
    if (b.spanZ <= 6 && b.spanX * b.spanY > 40000 && b.cz <= modMinZ + modD * 0.28) {
      return 'back';
    }
    if (b.spanZ <= 30 && b.cz >= modMinZ + modD * 0.72) {
      return (piece.name || '').toUpperCase().includes('CAJ') ? 'drawer_front' : 'door';
    }
    if (b.spanX <= 30 && b.spanY > b.spanX * 1.8) {
      if (b.minX <= modMinX + 25) return 'side_left';
      if (b.maxX >= modMaxX - 25) return 'side_right';
      return 'divider';
    }
    if (b.spanY <= 30) {
      if (b.minY <= modMinY + 25) return 'bottom';
      if (b.maxY >= modMaxY - 25) return 'top';
      return 'shelf';
    }
    return 'free';
  }

  /**
   * Orden topológico de pintor para proyección isométrica (+1,+1,+1).
   */
  private sortBoxesPainterOrder<T extends { aabb: PieceAABB; depthKey: number }>(items: T[]): T[] {
    const n = items.length;
    if (n <= 1) return [...items];

    const eps = 4;
    const adj: number[][] = Array.from({ length: n }, () => []);
    const inDegree = new Array<number>(n).fill(0);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = items[i].aabb;
        const b = items[j].aabb;
        const aBehindB =
          a.maxX <= b.minX + eps ||
          a.maxY <= b.minY + eps ||
          a.maxZ <= b.minZ + eps;
        const bBehindA =
          b.maxX <= a.minX + eps ||
          b.maxY <= a.minY + eps ||
          b.maxZ <= a.minZ + eps;

        if (aBehindB && !bBehindA) {
          adj[i].push(j);
          inDegree[j]++;
        } else if (bBehindA && !aBehindB) {
          adj[j].push(i);
          inDegree[i]++;
        }
      }
    }

    const ready: number[] = [];
    for (let i = 0; i < n; i++) {
      if (inDegree[i] === 0) ready.push(i);
    }

    const ordered: T[] = [];
    const visited = new Array<boolean>(n).fill(false);

    while (ready.length > 0) {
      ready.sort((ia, ib) => items[ia].depthKey - items[ib].depthKey);
      const curr = ready.shift()!;
      if (visited[curr]) continue;
      visited[curr] = true;
      ordered.push(items[curr]);

      for (const next of adj[curr]) {
        inDegree[next]--;
        if (inDegree[next] === 0 && !visited[next]) {
          ready.push(next);
        }
      }
    }

    if (ordered.length < n) {
      const remaining = items
        .filter((_, idx) => !visited[idx])
        .sort((a, b) => a.depthKey - b.depthKey);
      ordered.push(...remaining);
    }

    return ordered;
  }

  private getExplodeOffset(
    role: ComponentRole,
    px: number,
    py: number,
    pz: number,
    cx: number,
    cy: number,
    cz: number,
    dist: number
  ): { x: number; y: number; z: number } {
    switch (role) {
      case 'side_left':
        return { x: -dist * 1.15, y: 0, z: 0 };
      case 'side_right':
        return { x: dist * 1.15, y: 0, z: 0 };
      case 'top':
        return { x: 0, y: dist * 0.95, z: 0 };
      case 'tie':
        return { x: 0, y: dist * 0.85, z: pz > cz ? dist * 0.2 : -dist * 0.2 };
      case 'bottom':
        return { x: 0, y: -dist * 0.5, z: 0 };
      case 'plinth':
        return { x: 0, y: -dist * 0.95, z: pz > cz ? dist * 0.3 : -dist * 0.3 };
      case 'back':
        return { x: 0, y: 0, z: -dist * 1.35 };
      case 'door':
        return {
          x: px > cx + 5 ? dist * 0.22 : (px < cx - 5 ? -dist * 0.22 : 0),
          y: 0,
          z: dist * 1.45
        };
      case 'drawer_front':
        return { x: 0, y: 0, z: dist * 1.35 };
      case 'drawer_box':
      case 'drawer_lateral':
      case 'drawer_bottom':
        return {
          x: px > cx + 5 ? dist * 0.15 : (px < cx - 5 ? -dist * 0.15 : 0),
          y: 0,
          z: dist * 0.9
        };
      case 'shelf':
        return { x: 0, y: py > cy ? dist * 0.24 : -dist * 0.24, z: dist * 0.25 };
      case 'divider':
        return { x: px > cx ? dist * 0.35 : -dist * 0.35, y: 0, z: dist * 0.15 };
      default: {
        const vx = px - cx;
        const vy = py - cy;
        const vz = pz - cz;
        const len = Math.hypot(vx, vy, vz);
        if (len > 10) {
          return {
            x: (vx / len) * dist * 0.85,
            y: (vy / len) * dist * 0.85,
            z: (vz / len) * dist * 0.85
          };
        }
        return { x: 0, y: dist * 0.4, z: dist * 0.4 };
      }
    }
  }
}
