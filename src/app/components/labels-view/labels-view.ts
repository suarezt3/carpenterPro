import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  BookOpen01Icon,
  PrinterIcon,
  QrCodeIcon,
  Tag01Icon
} from '@hugeicons/core-free-icons';
import { ProjectStorageService } from '../../services/project-storage.service';
import { AssemblyGuideService } from '../../services/assembly-guide.service';
import { PaymentService } from '../../services/payment.service';
import { ThemeService } from '../../services/theme.service';
import {
  EdgeBandingType,
  GrainDirection,
  Material,
  Part,
  PartGroup,
  computePartCutDimensions,
  isStoneMaterial
} from '../../models/melamine.models';
import { MELAMINE_MATERIALS_CATALOG } from '../../data/melamine-catalog.data';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AssemblyGuideModalComponent } from '../assembly-guide-modal/assembly-guide-modal';

const MANUAL_ASSEMBLY_MODULE_ID = 'manual_custom_assembly';
const LABELS_PRINTING_BODY_CLASS = 'labels-printing';

/**
 * Segmento vertical determinista para el código de barras en CSS/HTML puro.
 */
export interface BarcodeBar {
  widthPx: number;
  gapPx: number;
}

/**
 * Material activo en al menos una pieza cortable/etiquetable del diseño.
 */
export interface UsedLabelMaterial {
  id: string;
  name: string;
  partsCount: number;
}

/**
 * Representa una etiqueta individual expandida por unidad física a cortar.
 */
export interface FlatPartLabel {
  trackId: string;
  part: Part;
  grain: GrainDirection;
  copyIndex: number;
  totalCopies: number;
  labelId: string;
  pieceCode?: string;
  moduleName: string;
  cutLength: number;
  cutWidth: number;
  technicalCutBadge: string | null;
  technicalRoleBadge?: string | null;
  barcodeBars: readonly BarcodeBar[];
}

/**
 * Resuelve la insignia técnica concisa exclusivamente para cortes angulares o biselados
 * (45° listón francés, uñero 45° o zapatero inclinado 15°/20°) en etiquetas de taller.
 */
export function resolvePartTechnicalCutBadge(part: Part): string | null {
  const nameLower = (part.name || '').toLowerCase();
  const notesLower = (part.notes || '').toLowerCase();
  const hw = part.hardwareConfig;

  const has45Bevel =
    part.bevelAngleDeg === 45 ||
    notesLower.includes('45°') ||
    notesLower.includes('45 deg') ||
    notesLower.includes('listón francés') ||
    notesLower.includes('liston frances');
  const hasFingerPull =
    notesLower.includes('uñero') ||
    notesLower.includes('unero') ||
    hw?.handleType === 'finger_pull' ||
    hw?.openingSystem === 'finger_pull' ||
    hw?.drawerOpeningSystem === 'finger_pull';

  let cutTag: string | null = null;
  if (has45Bevel && hasFingerPull) {
    cutTag = 'Corte a 45° · Uñero';
  } else if (has45Bevel) {
    if (part.bevelEdge) {
      cutTag = `Corte a 45° (${part.bevelEdge.toUpperCase()})`;
    } else if (notesLower.includes('listón francés') || notesLower.includes('liston frances')) {
      cutTag = 'Corte a 45° · Listón francés';
    } else {
      cutTag = 'Corte a 45°';
    }
  } else if (hasFingerPull) {
    cutTag = 'Corte a 45° · Uñero';
  }

  let shoeTag: string | null = null;
  if (
    typeof hw?.shoeRackAngleDeg === 'number' ||
    nameLower.includes('zapatero') ||
    notesLower.includes('zapatero')
  ) {
    const rotDeg = Math.max(
      Math.abs(part.rotationX || 0),
      Math.abs(part.rotationZ || 0)
    );
    const deg =
      hw?.shoeRackAngleDeg ?? (rotDeg === 15 || rotDeg === 20 ? rotDeg : null);
    shoeTag = deg ? `Zapatero (${deg}°)` : 'Zapatero';
  }

  if (cutTag && shoeTag) {
    return `${cutTag} · ${shoeTag}`;
  }
  return cutTag ?? shoeTag;
}

/**
 * Resuelve la insignia de rol constructivo para piezas especiales en etiquetas de taller
 * (Regleta Paso Bisagra, Regleta de Ajuste, Repisa Fija/Móvil, Dintel/Refuerzo Nicho, Cajón Interno).
 */
export function resolvePartTechnicalRoleBadge(part: Part): string | null {
  const nameLower = (part.name || '').toLowerCase();
  const notesLower = (part.notes || '').toLowerCase();
  const hw = part.hardwareConfig;

  if (hw?.isHingeSpacer === true || nameLower.includes('paso bisagra')) {
    return 'Regleta Paso Bisagra';
  }
  if (
    hw?.isFillerStrip === true ||
    nameLower.includes('regleta de ajuste') ||
    nameLower.includes('regleta ajuste')
  ) {
    return 'Regleta de Ajuste';
  }
  if (
    typeof hw?.shoeRackAngleDeg === 'number' ||
    nameLower.includes('zapatero') ||
    notesLower.includes('zapatero')
  ) {
    return null;
  }
  if (
    nameLower.includes('nicho') ||
    nameLower.includes('dintel') ||
    (nameLower.includes('reforzado') && nameLower.includes('electrodom'))
  ) {
    return nameLower.includes('dintel') ? 'Dintel Nicho' : 'Refuerzo Nicho';
  }
  if (part.componentRole === 'shelf') {
    if (
      hw?.isStructuralFixedShelf === true ||
      hw?.isMovableShelf === false ||
      nameLower.includes('repisa fija') ||
      nameLower.includes('divisor colgado') ||
      notesLower.includes('fija')
    ) {
      return 'Repisa Fija';
    }
    if (
      hw?.isMovableShelf === true ||
      nameLower.includes('repisa móvil') ||
      nameLower.includes('repisa movil') ||
      nameLower.includes('entrepaño') ||
      nameLower.includes('entrepano') ||
      nameLower.includes('repisa')
    ) {
      return 'Repisa Móvil';
    }
  }
  if (hw?.isInternalDrawerFront === true) {
    return 'Cajón Interno';
  }
  return null;
}

interface GuidePartMeta {
  moduleOrder: number;
  moduleId: string;
  moduleName: string;
  pieceCode: string;
}

interface SortableLabelEntry {
  label: FlatPartLabel;
  moduleOrder: number;
  moduleSubOrder: number;
  pieceCode?: string;
  partIndex: number;
  copyIndex: number;
}

/**
 * Convierte un código de armado (ej. 'P1', 'P10') en entero positivo para ordenación numérica.
 */
export function parsePieceCodeNumber(code?: string): number {
  if (!code) {
    return Number.MAX_SAFE_INTEGER;
  }
  const digits = code.replace(/\D/g, '');
  if (!digits) {
    return Number.MAX_SAFE_INTEGER;
  }
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

/**
 * Formatea el tipo de tapacanto a su espesor nominal legible en milímetros o '-'.
 */
export function formatLabelEdgeValue(edge?: EdgeBandingType): string {
  if (edge === 'thin') {
    return '0.45';
  }
  if (edge === 'thick') {
    return '2.0';
  }
  return '-';
}

/**
 * Genera una secuencia determinista de barras verticales HTML/CSS basada en el código de etiqueta.
 */
export function buildLabelBarcodeBars(code: string): readonly BarcodeBar[] {
  const normalized = (code || 'ETQ-000').trim();
  const bars: BarcodeBar[] = [
    { widthPx: 2, gapPx: 1 },
    { widthPx: 1, gapPx: 2 }
  ];

  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let i = 0; i < 16; i++) {
    const charVal = normalized.charCodeAt(i % normalized.length);
    const mix = ((hash >>> ((i % 4) * 8)) ^ (charVal + i * 31)) & 0xff;
    bars.push({
      widthPx: (mix % 3) + 1,
      gapPx: ((mix >> 3) % 2) + 1
    });
  }

  bars.push({ widthPx: 1, gapPx: 1 }, { widthPx: 2, gapPx: 0 });
  return bars;
}

/**
 * Vista generadora de etiquetas técnicas imprimibles para taller.
 * Desglosa cada pieza cortable según su cantidad (`quantity`), sincroniza códigos de armado
 * `P1/P2/P3` desde `AssemblyGuideService` en orden numérico ascendente por módulo y
 * optimiza el formato compacto tipo sticker adhesivo para impresión multipágina A4.
 */
@Component({
  selector: 'app-labels-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, TranslatePipe, AssemblyGuideModalComponent],
  templateUrl: './labels-view.html',
  styleUrl: './labels-view.css'
})
export class LabelsViewComponent implements OnInit, OnDestroy {
  readonly themeService = inject(ThemeService);
  readonly paymentService = inject(PaymentService);
  private readonly projectService = inject(ProjectStorageService);
  private readonly assemblyGuideService = inject(AssemblyGuideService);
  private readonly doc = inject(DOCUMENT, { optional: true });

  // Iconos vectoriales de Hugeicons utilizados en la vista
  readonly icons = {
    qrCode: QrCodeIcon,
    print: PrinterIcon,
    tag: Tag01Icon,
    book: BookOpen01Icon
  };

  readonly showAssemblyGuideModal = signal<boolean>(false);
  readonly canGenerateAssemblyGuide = this.assemblyGuideService.canGenerateAssemblyGuide;

  // Signals conectados al estado global del proyecto
  readonly project = this.projectService.currentProject;
  readonly parts = this.projectService.partsList;
  readonly groups = this.projectService.groupsList;
  readonly materials = this.projectService.materialsList;

  // Filtros reactivos por módulo y material
  readonly selectedModuleFilter = signal<string>('all');
  readonly selectedMaterialFilter = signal<string>('all');
  readonly labelSize = signal<'standard' | 'compact'>('compact');

  /**
   * Piezas cortables y etiquetables del proyecto activo (excluye piedra y piezas excluidas de corte).
   */
  readonly labelableParts = computed<Part[]>(() => {
    const mats = this.materials();
    return this.parts().filter(part => this.isLabelablePart(part, mats));
  });

  /**
   * Materiales NO-piedra activos en al menos una pieza cortable del diseño actual,
   * preservando el orden del catálogo e incluyendo fallback para materiales personalizados.
   */
  readonly usedMaterials = computed<UsedLabelMaterial[]>(() => {
    const partsList = this.labelableParts();
    if (partsList.length === 0) {
      return [];
    }

    const allMaterials = this.materials();
    const countMap = new Map<string, { count: number; name: string }>();

    for (const part of partsList) {
      const matId = part.materialId;
      if (!matId) {
        continue;
      }
      const qty = Math.max(1, Number(part.quantity) || 1);
      const existing = countMap.get(matId);
      if (existing) {
        existing.count += qty;
      } else {
        countMap.set(matId, {
          count: qty,
          name: part.materialName || 'Material'
        });
      }
    }

    const used: UsedLabelMaterial[] = [];
    const addedIds = new Set<string>();

    for (const mat of allMaterials) {
      if (isStoneMaterial(mat)) {
        continue;
      }
      const info = countMap.get(mat.id);
      if (info && info.count > 0) {
        used.push({
          id: mat.id,
          name: mat.name,
          partsCount: info.count
        });
        addedIds.add(mat.id);
      }
    }

    for (const [matId, info] of countMap.entries()) {
      if (!addedIds.has(matId) && info.count > 0) {
        used.push({
          id: matId,
          name: info.name,
          partsCount: info.count
        });
      }
    }

    return used;
  });

  /**
   * Expande las piezas filtradas en stickers individuales agrupados por módulo
   * (en orden de `AssemblyGuideService.guides()` / `groups()`, dejando piezas sueltas al final)
   * y ordenados numéricamente ascendente por `pieceCode` (`P1, P2, ..., P10`).
   */
  readonly flatLabels = computed<FlatPartLabel[]>(() => {
    let list = this.labelableParts();
    const mod = this.selectedModuleFilter();
    const mat = this.selectedMaterialFilter();
    const groups = this.groups();

    if (mod !== 'all') {
      const subGroupIds = new Set(
        groups
          .filter(g => g.hostGroupId === mod)
          .map(g => g.id)
      );
      list = list.filter(
        p =>
          p.groupId === mod ||
          p.moduleId === mod ||
          (p.groupId !== undefined && subGroupIds.has(p.groupId))
      );
    }

    if (mat !== 'all') {
      list = list.filter(p => p.materialId === mat);
    }

    if (list.length === 0) {
      return [];
    }

    const guides = this.assemblyGuideService.guides();
    const guidePartMap = new Map<string, GuidePartMeta>();
    const guideOrderByModuleId = new Map<string, number>();

    guides.forEach((guide, guideIndex) => {
      const isLooseGuide = guide.moduleId === MANUAL_ASSEMBLY_MODULE_ID;
      const moduleOrder = isLooseGuide ? Number.MAX_SAFE_INTEGER - 1 : guideIndex;
      if (!isLooseGuide) {
        guideOrderByModuleId.set(guide.moduleId, guideIndex);
      }
      for (const piece of guide.pieces) {
        guidePartMap.set(piece.partId, {
          moduleOrder,
          moduleId: guide.moduleId,
          moduleName: guide.moduleName,
          pieceCode: piece.code
        });
      }
    });

    const groupMap = new Map<string, PartGroup>();
    const groupIndexById = new Map<string, number>();
    groups.forEach((g, idx) => {
      groupMap.set(g.id, g);
      groupIndexById.set(g.id, idx);
    });

    const resolveHostGroupId = (groupId: string): string => {
      const grp = groupMap.get(groupId);
      if (
        grp &&
        (grp.type === 'drawer' || grp.type === 'door_set') &&
        grp.hostGroupId &&
        grp.hostGroupId !== 'floor' &&
        grp.hostGroupId !== grp.id &&
        groupMap.has(grp.hostGroupId)
      ) {
        return grp.hostGroupId;
      }
      return groupId;
    };

    const unknownGroupOrderMap = new Map<string, number>();
    const currentProj = this.project();
    const settings = currentProj.settings;
    const projectName = currentProj.name;
    const projectMaterials = this.materials();
    const entries: SortableLabelEntry[] = [];

    list.forEach((part, partIndex) => {
      const effectiveGrain = this.resolveEffectiveGrain(part, projectMaterials);
      const guideMeta = guidePartMap.get(part.id);
      const pieceCode =
        this.assemblyGuideService.getPieceCodeForPart(part.id) ||
        guideMeta?.pieceCode ||
        undefined;

      let moduleOrder: number;
      let moduleSubOrder = 0;
      let moduleName: string;

      if (guideMeta) {
        moduleOrder = guideMeta.moduleOrder;
        moduleName = guideMeta.moduleName || part.moduleName || part.groupName || projectName;
      } else {
        const rawGroupId = part.groupId || part.moduleId;
        if (rawGroupId) {
          const hostId = resolveHostGroupId(rawGroupId);
          const guideIdx = guideOrderByModuleId.get(hostId);
          const groupIdx = groupIndexById.get(hostId);
          if (guideIdx !== undefined) {
            moduleOrder = guideIdx;
            moduleName = groupMap.get(hostId)?.name || part.moduleName || part.groupName || projectName;
          } else if (groupIdx !== undefined) {
            moduleOrder = guides.length + groupIdx;
            moduleName = groupMap.get(hostId)?.name || part.moduleName || part.groupName || projectName;
          } else {
            let subIdx = unknownGroupOrderMap.get(rawGroupId);
            if (subIdx === undefined) {
              subIdx = unknownGroupOrderMap.size;
              unknownGroupOrderMap.set(rawGroupId, subIdx);
            }
            moduleOrder = guides.length + groups.length;
            moduleSubOrder = subIdx;
            moduleName = part.moduleName || part.groupName || projectName;
          }
        } else {
          moduleOrder = Number.MAX_SAFE_INTEGER;
          moduleName = part.moduleName || part.groupName || projectName;
        }
      }

      const cutDims = computePartCutDimensions(
        part,
        Boolean(settings?.subtractEdgeBandingFromCut),
        settings?.thinEdgeThickness ?? 0.45,
        settings?.thickEdgeThickness ?? 2.0
      );

      const cleanCode = part.id.replace(/^(part_|desk_)/i, '').slice(-5).toUpperCase();
      const totalCopies = Math.max(1, Number(part.quantity) || 1);

      for (let i = 1; i <= totalCopies; i++) {
        const labelId = `ETQ-${cleanCode}-${i}`;
        const barcodeSeed = pieceCode ? `${pieceCode}-${labelId}` : labelId;
        const technicalCutBadge = resolvePartTechnicalCutBadge(part);
        const technicalRoleBadge = resolvePartTechnicalRoleBadge(part);

        entries.push({
          label: {
            trackId: `${part.id}_copy_${i}`,
            part,
            grain: effectiveGrain,
            copyIndex: i,
            totalCopies,
            labelId,
            pieceCode,
            moduleName,
            cutLength: cutDims.cutLength,
            cutWidth: cutDims.cutWidth,
            technicalCutBadge,
            technicalRoleBadge,
            barcodeBars: buildLabelBarcodeBars(barcodeSeed)
          },
          moduleOrder,
          moduleSubOrder,
          pieceCode,
          partIndex,
          copyIndex: i
        });
      }
    });

    entries.sort((a, b) => {
      if (a.moduleOrder !== b.moduleOrder) {
        return a.moduleOrder - b.moduleOrder;
      }
      if (a.moduleSubOrder !== b.moduleSubOrder) {
        return a.moduleSubOrder - b.moduleSubOrder;
      }
      const codeA = parsePieceCodeNumber(a.pieceCode);
      const codeB = parsePieceCodeNumber(b.pieceCode);
      if (codeA !== codeB) {
        return codeA - codeB;
      }
      if (a.partIndex !== b.partIndex) {
        return a.partIndex - b.partIndex;
      }
      return a.copyIndex - b.copyIndex;
    });

    return entries.map(entry => entry.label);
  });

  private readonly onBeforePrint = (): void => {
    this.setBodyPrintingClass(true);
  };

  constructor() {
    // Reinicia automáticamente los filtros activos si el material o módulo deja de existir en el proyecto
    effect(() => {
      const currentMat = this.selectedMaterialFilter();
      if (currentMat !== 'all') {
        const stillInUse = this.usedMaterials().some(m => m.id === currentMat);
        if (!stillInUse) {
          untracked(() => {
            this.selectedMaterialFilter.set('all');
          });
        }
      }

      const currentMod = this.selectedModuleFilter();
      if (currentMod !== 'all') {
        const groupExists = this.groups().some(g => g.id === currentMod);
        if (!groupExists) {
          untracked(() => {
            this.selectedModuleFilter.set('all');
          });
        }
      }
    });
  }

  ngOnInit(): void {
    this.setBodyPrintingClass(true);
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('beforeprint', this.onBeforePrint);
    }
  }

  ngOnDestroy(): void {
    this.setBodyPrintingClass(false);
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('beforeprint', this.onBeforePrint);
    }
  }

  openAssemblyGuideModal(): void {
    if (this.paymentService.isWorkshopExportRestricted()) {
      this.paymentService.openUpgradeModal('workshop_export', 'pro');
      return;
    }
    this.showAssemblyGuideModal.set(true);
  }

  closeAssemblyGuideModal(): void {
    this.showAssemblyGuideModal.set(false);
  }

  onModuleFilterChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    this.selectedModuleFilter.set(target?.value ?? 'all');
  }

  onMaterialFilterChange(event: Event): void {
    const target = event.target as HTMLSelectElement | null;
    this.selectedMaterialFilter.set(target?.value ?? 'all');
  }

  formatEdgeValue(edge?: EdgeBandingType): string {
    return formatLabelEdgeValue(edge);
  }

  edgeTextClass(edge?: EdgeBandingType, centered = false): string {
    const base = centered
      ? 'text-center font-mono tabular-nums text-[8px] leading-none'
      : 'font-mono tabular-nums text-[8px] leading-none';
    if (edge === 'thick') {
      return `${base} text-zinc-900 font-bold`;
    }
    if (edge === 'thin') {
      return `${base} text-sky-700 font-semibold`;
    }
    return `${base} text-zinc-400 font-normal`;
  }

  edgeBorderSideClass(side: 'top' | 'bottom' | 'left' | 'right', edge?: EdgeBandingType): string {
    const posMap: Record<'top' | 'bottom' | 'left' | 'right', string> = {
      top: 'absolute top-0 left-0 right-0 pointer-events-none',
      bottom: 'absolute bottom-0 left-0 right-0 pointer-events-none',
      left: 'absolute top-0 bottom-0 left-0 pointer-events-none',
      right: 'absolute top-0 bottom-0 right-0 pointer-events-none'
    };

    const borderPrefixMap: Record<'top' | 'bottom' | 'left' | 'right', string> = {
      top: 'border-t',
      bottom: 'border-b',
      left: 'border-l',
      right: 'border-r'
    };

    const prefix = borderPrefixMap[side];
    if (edge === 'thick') {
      return `${posMap[side]} ${prefix}-[3px] border-zinc-900`;
    }
    if (edge === 'thin') {
      return `${posMap[side]} ${prefix}-2 border-sky-600`;
    }
    return `${posMap[side]} ${prefix} border-dashed border-zinc-300`;
  }

  /**
   * Activa la clase de impresión multipágina en `body` y dispara la impresión nativa.
   */
  printLabels(): void {
    if (this.paymentService.isWorkshopExportRestricted()) {
      this.paymentService.openUpgradeModal('workshop_export', 'pro');
      return;
    }
    this.setBodyPrintingClass(true);
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  }

  private setBodyPrintingClass(active: boolean): void {
    const targetDoc = this.doc ?? (typeof document !== 'undefined' ? document : null);
    if (!targetDoc?.body) {
      return;
    }
    if (active) {
      targetDoc.body.classList.add(LABELS_PRINTING_BODY_CLASS);
    } else {
      targetDoc.body.classList.remove(LABELS_PRINTING_BODY_CLASS);
    }
  }

  private resolveEffectiveGrain(part: Part, mats: readonly Material[]): GrainDirection {
    const mat =
      mats.find(m => m.id === part.materialId) ??
      MELAMINE_MATERIALS_CATALOG.find(m => m.id === part.materialId);
    if (mat && !mat.hasGrain) {
      return 'none';
    }
    return part.grain || 'none';
  }

  private isLabelablePart(part: Part, mats: readonly Material[]): boolean {
    if (part.excludeFromCutlist === true) {
      return false;
    }
    const mat: Material =
      mats.find(m => m.id === part.materialId) ??
      MELAMINE_MATERIALS_CATALOG.find(m => m.id === part.materialId) ?? {
        id: part.materialId,
        name: part.materialName || '',
        thickness: part.thickness,
        sheetLength: 2440,
        sheetWidth: 1830,
        sheetCost: 0,
        hasGrain: part.grain !== 'none',
        colorHex: part.colorHex ?? '#ffffff'
      };
    return !isStoneMaterial(mat);
  }
}
