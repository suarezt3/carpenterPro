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
  BookOpen01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  CubeIcon,
  Layers01Icon,
  PrinterIcon,
  RulerIcon,
  Settings01Icon
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

export interface BadgePlacement {
  code: string;
  anchorX: number;
  anchorY: number;
  badgeX: number;
  badgeY: number;
}

export type PartRenderStyle = 'exploded' | 'prior' | 'current';

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

type AssemblyGuidePieceContract = AssemblyGuidePiece & {
  worldBounds?: PieceAABB;
  resolvedRole?: ComponentRole;
};

type AssemblyStepContract = AssemblyStep & {
  cumulativePriorPartCodes?: string[];
};

const COS30 = 0.8660254;
const SIN30 = 0.5;

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
    settings: Settings01Icon
  };

  private activePrintIframe: HTMLIFrameElement | null = null;
  private printCleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Sincronizar input externo si se especifica un módulo concreto al abrir
    effect(() => {
      const inputId = this.selectedModuleIdInput();
      if (inputId) {
        this.selectedModuleId.set(inputId);
      }
    });

    // Re-dibujar diagramas cada vez que cambie el filtro o la lista de guías
    effect(() => {
      this.filteredGuides();
      if (this.renderTimer) {
        clearTimeout(this.renderTimer);
      }
      this.renderTimer = setTimeout(() => {
        this.renderTimer = null;
        this.renderAllCanvases();
      }, 50);
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

  closeModal(): void {
    this.modalClose.emit();
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

    // Asegurar que todos los diagramas canvas están recién renderizados antes de capturar
    this.renderAllCanvases();

    const guides = this.filteredGuides();
    const explodedDataUrls = this.captureExplodedDataUrls(guides);
    const stepDataUrls = this.captureStepDataUrls();
    const html = this.buildPrintableDocumentHtml(guides, this.project(), explodedDataUrls, stepDataUrls);

    this.printHtmlInIsolatedIframe(html);
  }

  /**
   * Construye un documento HTML5 autónomo limpio para impresión multi-página A4 sin restricciones de modal.
   */
  public buildPrintableDocumentHtml(
    guides: ModuleAssemblyGuide[],
    project: MelamineProject | null | undefined,
    explodedDataUrls: string[] = [],
    stepDataUrls: Record<string, string> | string[] = {}
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
      const stepsHtml = this.buildPrintableStepsSection(guide, stepDataUrls, () => flatStepIndex++);

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
      width: 30px;
      height: 30px;
      border-radius: 6px;
      background: #18181b;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
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
    nextFlatIndex: () => number
  ): string {
    const stepsHtml = guide.steps
      .map(step => {
        const flatIdx = nextFlatIndex();
        const stepKey = this.getStepCanvasKey(guide.moduleId, step.stepNumber);
        const stepImgUrl = Array.isArray(stepDataUrls)
          ? (stepDataUrls[flatIdx] || '')
          : (stepDataUrls[stepKey] || '');

        const imgHtml = stepImgUrl
          ? `<img class="step-diagram-img" src="${this.escapeAttr(stepImgUrl)}" alt="${this.escapeAttr(this.i18n.t(step.titleKey))}" />`
          : `<div class="diagram-placeholder">PASO ${this.formatStepNumber(step.stepNumber)}</div>`;

        const stepPiecesHtml = step.parts
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
              <div class="step-number-box font-numeric">${this.formatStepNumber(step.stepNumber)}</div>
              <div>
                <h3 class="step-title">${this.escapeHtml(this.i18n.t(step.titleKey) || step.defaultTitle)}</h3>
                <p class="step-desc">${this.escapeHtml(this.i18n.t(step.descriptionKey) || step.defaultDescription)}</p>
              </div>
            </div>
            <div class="step-body">
              <div class="diagram-frame">${imgHtml}</div>
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

  private captureExplodedDataUrls(guides: ModuleAssemblyGuide[]): string[] {
    const canvases = this.canvasExplodedList();
    return guides.map((_, idx) => {
      const el = canvases[idx]?.nativeElement;
      return el ? this.safeCanvasToDataUrl(el) : '';
    });
  }

  private captureStepDataUrls(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const ref of this.canvasStepList()) {
      const el = ref.nativeElement;
      if (!el) continue;
      const modId = el.getAttribute('data-module-id') || '';
      const stepNum = Number(el.getAttribute('data-step-number'));
      if (modId && Number.isFinite(stepNum)) {
        map[this.getStepCanvasKey(modId, stepNum)] = this.safeCanvasToDataUrl(el);
      }
    }
    return map;
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
  // FASES 1 & 2: MOTOR DE DIBUJO TÉCNICO ISOMÉTRICO 3D OBB EN <CANVAS>
  // =========================================================================

  /**
   * Calcula la caja envolvente 3D exacta usando JoineryEngineService (PartGeometryService).
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

  /**
   * Resuelve posiciones sin solapamiento para los círculos callout (P1, P2...) dentro de los márgenes.
   */
  public resolveBadgeCollisions(
    items: { code: string; anchorX: number; anchorY: number }[],
    centerScreenX: number,
    centerScreenY: number,
    canvasWidth: number,
    canvasHeight: number,
    margin = 24
  ): BadgePlacement[] {
    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
    const minX = Math.min(margin, canvasWidth / 2);
    const maxX = Math.max(minX, canvasWidth - margin);
    const minY = Math.min(margin, canvasHeight / 2);
    const maxY = Math.max(minY, canvasHeight - margin);

    const badgeDist = 30;
    const minBadgeSep = 28;
    const minAnchorSep = 18;

    const nodes = items.map((item, idx) => {
      const dx = item.anchorX - centerScreenX;
      const dy = item.anchorY - centerScreenY;
      const len = Math.hypot(dx, dy);
      const dirX = len > 5 ? dx / len : Math.cos(idx * 2.39996);
      const dirY = len > 5 ? dy / len : Math.sin(idx * 2.39996);
      const targetX = clamp(item.anchorX + dirX * badgeDist, minX, maxX);
      const targetY = clamp(item.anchorY + dirY * badgeDist, minY, maxY);
      return {
        code: item.code,
        anchorX: item.anchorX,
        anchorY: item.anchorY,
        targetX,
        targetY,
        badgeX: targetX,
        badgeY: targetY
      };
    });

    for (let iter = 0; iter < 48; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].badgeX - nodes[j].badgeX;
          const dy = nodes[i].badgeY - nodes[j].badgeY;
          const dist = Math.hypot(dx, dy);
          if (dist < minBadgeSep) {
            const nx = dist > 0.01 ? dx / dist : Math.cos((i + j + 1) * 1.618);
            const ny = dist > 0.01 ? dy / dist : Math.sin((i + j + 1) * 1.618);
            const push = (minBadgeSep - dist) * 0.52;
            nodes[i].badgeX += nx * push;
            nodes[i].badgeY += ny * push;
            nodes[j].badgeX -= nx * push;
            nodes[j].badgeY -= ny * push;
          }
        }
      }

      for (const node of nodes) {
        const adx = node.badgeX - node.anchorX;
        const ady = node.badgeY - node.anchorY;
        const adist = Math.hypot(adx, ady);
        if (adist < minAnchorSep && adist > 0.01) {
          const apush = (minAnchorSep - adist) * 0.35;
          node.badgeX += (adx / adist) * apush;
          node.badgeY += (ady / adist) * apush;
        }

        node.badgeX += (node.targetX - node.badgeX) * 0.12;
        node.badgeY += (node.targetY - node.badgeY) * 0.12;
        node.badgeX = clamp(node.badgeX, minX, maxX);
        node.badgeY = clamp(node.badgeY, minY, maxY);
      }
    }

    return nodes.map(n => ({
      code: n.code,
      anchorX: n.anchorX,
      anchorY: n.anchorY,
      badgeX: Math.round(n.badgeX),
      badgeY: Math.round(n.badgeY)
    }));
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
   * Renderiza el diagrama general explosivo numerado con OBB reales en perspectiva isométrica High-DPI.
   */
  private renderExplodedDiagram(canvas: HTMLCanvasElement, guide: ModuleAssemblyGuide): void {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 2) : 2;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(300, rect.width || 720);
    const cssHeight = Math.max(220, rect.height || 420);

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

    const modBounds = this.calculateModuleBounds(pieces);
    const sizeX = modBounds.maxX - modBounds.minX || 600;
    const sizeY = modBounds.maxY - modBounds.minY || 800;
    const sizeZ = modBounds.maxZ - modBounds.minZ || 400;
    const explodeDist = Math.min(sizeX, sizeY, sizeZ) * 0.38 + 75;

    const project = (x: number, y: number, z: number): IsoPoint => ({
      u: (x - z) * COS30,
      v: -y + (x + z) * SIN30
    });

    interface ExplodedBox {
      piece: AssemblyGuidePiece;
      offset: { x: number; y: number; z: number };
      origCenter: { x: number; y: number; z: number };
      expCenter: { x: number; y: number; z: number };
      aabb: PieceAABB;
      obb: PieceOBBGeometry;
      depthKey: number;
    }

    const rawBoxes: ExplodedBox[] = [];
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
      const offset = this.getExplodeOffset(role, b.cx, b.cy, b.cz, modBounds.cx, modBounds.cy, modBounds.cz, explodeDist);
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

    const margin = 54;
    const availW = cssWidth - margin * 2;
    const availH = cssHeight - margin * 2;
    const rangeU = maxU - minU || 1;
    const rangeV = maxV - minV || 1;

    const scale = Math.min(availW / rangeU, availH / rangeV, 0.72);
    const offsetX = margin + (availW - rangeU * scale) / 2 - minU * scale;
    const offsetY = margin + (availH - rangeV * scale) / 2 - minV * scale;

    const toScreen = (pt: IsoPoint): IsoPoint => ({
      u: offsetX + pt.u * scale,
      v: offsetY + pt.v * scale
    });

    const boxes = this.sortBoxesPainterOrder(rawBoxes);

    // 1. Guías punteadas sutiles (#94A3B8) desde centro original hacia centro explotado
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    for (const box of boxes) {
      const origScreen = toScreen(project(box.origCenter.x, box.origCenter.y, box.origCenter.z));
      const expScreen = toScreen(project(box.expCenter.x, box.expCenter.y, box.expCenter.z));

      ctx.beginPath();
      ctx.moveTo(origScreen.u, origScreen.v);
      ctx.lineTo(expScreen.u, expScreen.v);
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(origScreen.u, origScreen.v, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Dibujar piezas 3D proyectando sus 8 vértices OBB reales
    for (const box of boxes) {
      this.drawIsometricPart(ctx, box.piece.part, box.offset, project, toScreen, 'exploded');
    }

    // 3. Callouts P1..Pn resueltos sin solapamiento
    const moduleCenterScreen = toScreen(project(modBounds.cx, modBounds.cy, modBounds.cz));
    const badgeInputs = boxes.map(box => {
      const centerScreen = toScreen(project(box.expCenter.x, box.expCenter.y, box.expCenter.z));
      return {
        code: box.piece.code,
        anchorX: centerScreen.u,
        anchorY: centerScreen.v
      };
    });
    const placements = this.resolveBadgeCollisions(
      badgeInputs,
      moduleCenterScreen.u,
      moduleCenterScreen.v,
      cssWidth,
      cssHeight,
      24
    );
    for (const placement of placements) {
      this.drawCalloutBadge(ctx, placement);
    }

    ctx.restore();
  }

  /**
   * Renderiza el mini-diagrama progresivo del paso (cero piezas futuras) con flechas e insignias técnicas.
   */
  private renderStepMiniDiagram(
    canvas: HTMLCanvasElement,
    guide: ModuleAssemblyGuide,
    step: AssemblyStep
  ): void {
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 2) : 2;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(220, rect.width || 340);
    const cssHeight = Math.max(160, rect.height || 220);

    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const renderItems = this.getStepRenderPieces(guide, step);
    if (renderItems.length === 0) {
      ctx.restore();
      return;
    }

    const zeroOffset = { x: 0, y: 0, z: 0 };
    const project = (x: number, y: number, z: number): IsoPoint => ({
      u: (x - z) * COS30,
      v: -y + (x + z) * SIN30
    });

    interface StepBox {
      piece: AssemblyGuidePiece;
      state: StepPieceVisualState;
      aabb: PieceAABB;
      obb: PieceOBBGeometry;
      depthKey: number;
    }

    const rawBoxes: StepBox[] = [];
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
        aabb,
        obb,
        depthKey: obb.center.x + obb.center.y + obb.center.z
      });
    }

    const margin = 34;
    const availW = cssWidth - margin * 2;
    const availH = cssHeight - margin * 2;
    const rangeU = maxU - minU || 1;
    const rangeV = maxV - minV || 1;

    const scale = Math.min(availW / rangeU, availH / rangeV, 0.65);
    const offsetX = margin + (availW - rangeU * scale) / 2 - minU * scale;
    const offsetY = margin + (availH - rangeV * scale) / 2 - minV * scale;

    const toScreen = (pt: IsoPoint): IsoPoint => ({
      u: offsetX + pt.u * scale,
      v: offsetY + pt.v * scale
    });

    const boxes = this.sortBoxesPainterOrder(rawBoxes);

    // 1. Dibujar todas las piezas permitidas (prior en piedra neutra, current en Azul Acero)
    for (const box of boxes) {
      this.drawIsometricPart(ctx, box.piece.part, zeroOffset, project, toScreen, box.state);
    }

    // 2. Anotaciones técnicas del paso (flechas direccionales, escuadra D1=D2, bisagras/manijas)
    const currentBoxes = boxes.filter(b => b.state === 'current');
    const stepBounds = this.calculateModuleBounds(renderItems.map(r => r.piece));

    this.drawStepTechnicalAnnotations(ctx, step, currentBoxes, stepBounds, toScreen, project, cssWidth);

    // 3. Callouts no solapados para las piezas del paso actual
    const centerScreen = toScreen(project(stepBounds.cx, stepBounds.cy, stepBounds.cz));
    const badgeInputs = currentBoxes.map(box => {
      const pt = toScreen(project(box.obb.center.x, box.obb.center.y, box.obb.center.z));
      return {
        code: box.piece.code,
        anchorX: pt.u,
        anchorY: pt.v
      };
    });
    const placements = this.resolveBadgeCollisions(
      badgeInputs,
      centerScreen.u,
      centerScreen.v,
      cssWidth,
      cssHeight,
      20
    );
    for (const placement of placements) {
      this.drawCalloutBadge(ctx, placement);
    }

    ctx.restore();
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
    state: PartRenderStyle
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
      case 'current':
        return {
          top: '#e0f2fe',
          front: '#bae6fd',
          side: '#7dd3fc',
          stroke: '#0284c7',
          lineWidth: 1.8
        };
      case 'prior':
        return {
          top: '#f4f4f5',
          front: '#e4e4e7',
          side: '#d4d4d8',
          stroke: '#71717a',
          lineWidth: 1.1
        };
      case 'exploded':
      default:
        return {
          top: '#ffffff',
          front: '#f4f4f5',
          side: '#e4e4e7',
          stroke: '#3f3f46',
          lineWidth: 1.25
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

  private drawCalloutBadge(ctx: CanvasRenderingContext2D, placement: BadgePlacement): void {
    const { anchorX, anchorY, badgeX, badgeY, code } = placement;
    ctx.save();

    ctx.beginPath();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.2;
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(badgeX, badgeY);
    ctx.stroke();

    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#18181b';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(code, badgeX, badgeY);

    ctx.restore();
  }

  private drawStepTechnicalAnnotations(
    ctx: CanvasRenderingContext2D,
    step: AssemblyStep,
    currentBoxes: { piece: AssemblyGuidePiece; aabb: PieceAABB; obb: PieceOBBGeometry }[],
    stepBounds: PieceAABB,
    toScreen: (pt: IsoPoint) => IsoPoint,
    project: (x: number, y: number, z: number) => IsoPoint,
    width: number
  ): void {
    ctx.save();

    // Pastilla indicadora del paso en la esquina superior derecha
    const stepLabel = `PASO ${this.formatStepNumber(step.stepNumber)}`;
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.roundRect(width - 68, 10, 58, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stepLabel, width - 39, 20);

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
          const from = toScreen(project(c.x - 85, c.y, c.z));
          const to = toScreen(project(c.x - 16, c.y, c.z));
          this.drawInsertionArrow(ctx, from.u, from.v, to.u, to.v, '#0284c7');
        } else if (role === 'side_right') {
          const from = toScreen(project(c.x + 85, c.y, c.z));
          const to = toScreen(project(c.x + 16, c.y, c.z));
          this.drawInsertionArrow(ctx, from.u, from.v, to.u, to.v, '#0284c7');
        } else if (role === 'top' || role === 'tie') {
          const from = toScreen(project(c.x, c.y + 80, c.z));
          const to = toScreen(project(c.x, c.y + 16, c.z));
          this.drawInsertionArrow(ctx, from.u, from.v, to.u, to.v, '#0284c7');
        } else if (role === 'bottom' || role === 'plinth') {
          const from = toScreen(project(c.x, c.y - 70, c.z));
          const to = toScreen(project(c.x, c.y - 14, c.z));
          this.drawInsertionArrow(ctx, from.u, from.v, to.u, to.v, '#0284c7');
        }
      }
    } else if (step.actionType === 'back') {
      for (const box of currentBoxes) {
        const corners = box.obb.corners;
        // Plano medio de la cara trasera: diagonales entre vértices opuestos
        const d1a = toScreen(project((corners[0].x + corners[4].x) * 0.5, (corners[0].y + corners[4].y) * 0.5, (corners[0].z + corners[4].z) * 0.5));
        const d1b = toScreen(project((corners[2].x + corners[6].x) * 0.5, (corners[2].y + corners[6].y) * 0.5, (corners[2].z + corners[6].z) * 0.5));
        const d2a = toScreen(project((corners[3].x + corners[7].x) * 0.5, (corners[3].y + corners[7].y) * 0.5, (corners[3].z + corners[7].z) * 0.5));
        const d2b = toScreen(project((corners[1].x + corners[5].x) * 0.5, (corners[1].y + corners[5].y) * 0.5, (corners[1].z + corners[5].z) * 0.5));

        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5;

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
        ctx.beginPath();
        ctx.roundRect(midX - 42, midY - 11, 84, 22, 11);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('D1 = D2 (90°)', midX, midY);

        // Flecha direccional mostrando el ingreso del fondo hacia la ranura (+Z)
        const c = box.obb.center;
        const from = toScreen(project(c.x, c.y, c.z - 80));
        const to = toScreen(project(c.x, c.y, c.z - 12));
        this.drawInsertionArrow(ctx, from.u, from.v, to.u, to.v, '#0284c7');
      }
    } else if (step.actionType === 'shelves') {
      for (const box of currentBoxes) {
        const c = box.obb.center;
        const topY = box.aabb.maxY;
        const from = toScreen(project(c.x, topY + 75, c.z));
        const to = toScreen(project(c.x, topY + 10, c.z));
        this.drawInsertionArrow(ctx, from.u, from.v, to.u, to.v, '#0284c7');
      }
    } else if (step.actionType === 'drawers') {
      for (const box of currentBoxes) {
        const c = box.obb.center;
        const startPt = toScreen(project(c.x, c.y, box.aabb.maxZ - 35));
        const endPt = toScreen(project(c.x, c.y, box.aabb.maxZ + 55));
        this.drawInsertionArrow(ctx, startPt.u, startPt.v, endPt.u, endPt.v, '#0284c7');
      }
    } else if (step.actionType === 'doors') {
      for (const box of currentBoxes) {
        this.drawDoorHardwareMarkers(ctx, box.piece.part, box.obb, toScreen, project);
      }
    }

    ctx.restore();
  }

  /**
   * Dibuja bisagras, manija y flecha de montaje limpiamente sobre la cara frontal/borde del OBB de la puerta
   * (sin atravesar el tablero).
   */
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

    // Marcadores de bisagra en ámbar técnico con contorno grafito
    for (const spot of hingeSpots) {
      ctx.fillStyle = '#d97706';
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(spot.u, spot.v, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Manija estilizada en grafito sobre la cara exterior
    if (hw?.handleType !== 'none' && hw?.handleType !== 'push' && hw?.handleType !== 'push_open') {
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(handleA.u, handleA.v);
      ctx.lineTo(handleB.u, handleB.v);
      ctx.stroke();
    }

    // Flecha de acoplamiento hacia el casco
    const arrowFrom = toScreen(project(c.x + ax2.x * 75, c.y + ax2.y * 75, c.z + ax2.z * 75));
    const arrowTo = toScreen(project(c.x + ax2.x * (hz + 14), c.y + ax2.y * (hz + 14), c.z + ax2.z * (hz + 14)));
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
    const headLen = 8.5;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

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
   * Orden topológico de pintor para proyección isométrica (+1,+1,+1), evitando solapes como
   * puertas detrás de costados o repisas sobre el techo.
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
