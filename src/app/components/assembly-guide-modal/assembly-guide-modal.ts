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
  Alert02Icon,
  ArrowDown01Icon,
  BookOpen01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  CubeIcon,
  Download01Icon,
  Layers01Icon,
  PrinterIcon,
  RulerIcon,
  Settings01Icon,
  Tag01Icon
} from '@hugeicons/core-free-icons';
import { AssemblyGuidePiece, AssemblyGuideService, AssemblyStep, ModuleAssemblyGuide } from '../../services/assembly-guide.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { ThemeService } from '../../services/theme.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { PaymentService } from '../../services/payment.service';

interface IsoPoint {
  u: number;
  v: number;
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
  readonly themeService = inject(ThemeService);
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

  // Catálogo de iconos vectoriales de Hugeicons
  readonly icons = {
    book: BookOpen01Icon,
    print: PrinterIcon,
    download: Download01Icon,
    close: Cancel01Icon,
    clock: Clock01Icon,
    ruler: RulerIcon,
    layers: Layers01Icon,
    check: CheckmarkCircle02Icon,
    cube: CubeIcon,
    tag: Tag01Icon,
    settings: Settings01Icon,
    alert: Alert02Icon,
    chevronDown: ArrowDown01Icon
  };

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
      // Encolar re-renderizado para el siguiente ciclo del microtask
      setTimeout(() => this.renderAllCanvases(), 50);
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

  printGuide(): void {
    if (this.paymentService.isWorkshopExportRestricted()) {
      this.paymentService.openUpgradeModal('workshop_export', 'pro');
      return;
    }
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  closeModal(): void {
    this.modalClose.emit();
  }

  // =========================================================================
  // MOTOR DE DIBUJO TÉCNICO ISOMÉTRICO 2D EN <CANVAS> HIGH-DPI
  // =========================================================================

  private renderAllCanvases(): void {
    if (typeof window === 'undefined') return;

    // 1. Renderizar diagramas generales explosivos numerados
    const explodedCanvases = this.canvasExplodedList();
    const guides = this.filteredGuides();

    explodedCanvases.forEach((canvasRef, index) => {
      const guide = guides[index];
      if (guide && canvasRef?.nativeElement) {
        this.renderExplodedDiagram(canvasRef.nativeElement, guide);
      }
    });

    // 2. Renderizar mini-diagramas por paso
    const stepCanvases = this.canvasStepList();
    stepCanvases.forEach(canvasRef => {
      const el = canvasRef.nativeElement;
      if (el) {
        const modId = el.getAttribute('data-module-id');
        const stepNum = Number(el.getAttribute('data-step-number'));
        const guide = guides.find(g => g.moduleId === modId);
        const step = guide?.steps.find(s => s.stepNumber === stepNum);
        if (guide && step) {
          this.renderStepMiniDiagram(el, guide, step);
        }
      }
    });
  }

  /**
   * Renderiza el diagrama general explosivo numerado con perspectiva isométrica Retina 2x.
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

    // Fondo blanco técnico
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Retícula técnica milimétrica suave
    this.drawTechnicalGrid(ctx, cssWidth, cssHeight);

    const pieces = guide.pieces;
    if (pieces.length === 0) {
      ctx.restore();
      return;
    }

    // Calcular límites 3D del módulo completo
    const { minX, maxX, minY, maxY, minZ, maxZ, cx, cy, cz } = this.calculateModuleBounds(pieces);
    const sizeX = maxX - minX || 600;
    const sizeY = maxY - minY || 800;
    const sizeZ = maxZ - minZ || 400;

    const explodeDist = Math.min(sizeX, sizeY, sizeZ) * 0.38 + 70;

    // Calcular cajas explotadas y puntos de proyección 2D
    const cos30 = 0.8660254;
    const sin30 = 0.5;

    const project = (x: number, y: number, z: number): IsoPoint => ({
      u: (x - z) * cos30,
      v: -y + (x + z) * sin30
    });

    interface ExplodedBox {
      piece: AssemblyGuidePiece;
      origCenter: { x: number; y: number; z: number };
      expCenter: { x: number; y: number; z: number };
      pMin: { x: number; y: number; z: number };
      pMax: { x: number; y: number; z: number };
      depthKey: number;
    }

    const boxes: ExplodedBox[] = [];
    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;

    for (const piece of pieces) {
      const p = piece.part;
      const b = this.getPartAABB(p);

      const px = (b.minX + b.maxX) / 2;
      const py = (b.minY + b.maxY) / 2;
      const pz = (b.minZ + b.maxZ) / 2;

      // Vector de explosión según rol y cuadrante espacial
      const offset = this.getExplodeOffset(piece.componentRole, px, py, pz, cx, cy, cz, explodeDist);

      const expMin = { x: b.minX + offset.x, y: b.minY + offset.y, z: b.minZ + offset.z };
      const expMax = { x: b.maxX + offset.x, y: b.maxY + offset.y, z: b.maxZ + offset.z };

      // Actualizar bounding box 2D proyectado
      const corners = this.getBoxCorners(expMin, expMax);
      for (const c of corners) {
        const pt = project(c.x, c.y, c.z);
        if (pt.u < minU) minU = pt.u;
        if (pt.u > maxU) maxU = pt.u;
        if (pt.v < minV) minV = pt.v;
        if (pt.v > maxV) maxV = pt.v;
      }

      const expCenter = { x: px + offset.x, y: py + offset.y, z: pz + offset.z };
      // Clave de profundidad isométrica para orden de pintor (atrás hacia adelante)
      const depthKey = (expCenter.x + expCenter.z) * 0.6 + expCenter.y * 0.4;

      boxes.push({
        piece,
        origCenter: { x: px, y: py, z: pz },
        expCenter,
        pMin: expMin,
        pMax: expMax,
        depthKey
      });
    }

    // Auto-escalar y centrar en el canvas
    const margin = 50;
    const availW = cssWidth - (margin * 2);
    const availH = cssHeight - (margin * 2);
    const rangeU = maxU - minU || 1;
    const rangeV = maxV - minV || 1;

    const scale = Math.min(availW / rangeU, availH / rangeV, 0.75);
    const offsetX = margin + (availW - (rangeU * scale)) / 2 - (minU * scale);
    const offsetY = margin + (availH - (rangeV * scale)) / 2 - (minV * scale);

    const toScreen = (pt: IsoPoint): IsoPoint => ({
      u: offsetX + (pt.u * scale),
      v: offsetY + (pt.v * scale)
    });

    // Ordenar piezas de fondo hacia frente
    boxes.sort((a, b) => a.depthKey - b.depthKey);

    // 1. Dibujar líneas de guía de explosión punteadas
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

      // Pequeño nodo en el origen
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(origScreen.u, origScreen.v, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Dibujar piezas 3D sombreadas en proyección isométrica
    for (const box of boxes) {
      this.drawIsometricBox(ctx, box.pMin, box.pMax, project, toScreen, false);
    }

    // 3. Dibujar círculos numerados con código de pieza (P1, P2, P3...) alejados radialmente
    const moduleCenterScreen = toScreen(project(cx, cy, cz));
    for (const box of boxes) {
      const centerScreen = toScreen(project(box.expCenter.x, box.expCenter.y, box.expCenter.z));
      this.drawNumberedCalloutBadge(ctx, centerScreen.u, centerScreen.v, box.piece.code, moduleCenterScreen.u, moduleCenterScreen.v);
    }

    ctx.restore();
  }

  /**
   * Renderiza el mini-diagrama del paso con piezas del paso resaltadas y flechas de dirección.
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

    // Fondo blanco técnico suave
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const pieces = guide.pieces;
    const stepPartCodes = new Set(step.partCodes);

    const { minX, maxX, minY, maxY, minZ, maxZ } = this.calculateModuleBounds(pieces);

    const cos30 = 0.8660254;
    const sin30 = 0.5;
    const project = (x: number, y: number, z: number): IsoPoint => ({
      u: (x - z) * cos30,
      v: -y + (x + z) * sin30
    });

    let minU = Infinity, maxU = -Infinity;
    let minV = Infinity, maxV = -Infinity;

    interface StepBox {
      piece: AssemblyGuidePiece;
      pMin: { x: number; y: number; z: number };
      pMax: { x: number; y: number; z: number };
      isCurrentStep: boolean;
      depthKey: number;
    }

    const boxes: StepBox[] = [];

    for (const piece of pieces) {
      const isCurrentStep = stepPartCodes.has(piece.code);
      const b = this.getPartAABB(piece.part);

      // Si es del paso actual o fue instalada antes, se incluye
      const pMin = { x: b.minX, y: b.minY, z: b.minZ };
      const pMax = { x: b.maxX, y: b.maxY, z: b.maxZ };

      const corners = this.getBoxCorners(pMin, pMax);
      for (const c of corners) {
        const pt = project(c.x, c.y, c.z);
        if (pt.u < minU) minU = pt.u;
        if (pt.u > maxU) maxU = pt.u;
        if (pt.v < minV) minV = pt.v;
        if (pt.v > maxV) maxV = pt.v;
      }

      const pCenter = { x: (pMin.x + pMax.x) / 2, y: (pMin.y + pMax.y) / 2, z: (pMin.z + pMax.z) / 2 };
      const depthKey = (pCenter.x + pCenter.z) * 0.6 + pCenter.y * 0.4;

      boxes.push({
        piece,
        pMin,
        pMax,
        isCurrentStep,
        depthKey
      });
    }

    const margin = 28;
    const availW = cssWidth - (margin * 2);
    const availH = cssHeight - (margin * 2);
    const rangeU = maxU - minU || 1;
    const rangeV = maxV - minV || 1;

    const scale = Math.min(availW / rangeU, availH / rangeV, 0.65);
    const offsetX = margin + (availW - (rangeU * scale)) / 2 - (minU * scale);
    const offsetY = margin + (availH - (rangeV * scale)) / 2 - (minV * scale);

    const toScreen = (pt: IsoPoint): IsoPoint => ({
      u: offsetX + (pt.u * scale),
      v: offsetY + (pt.v * scale)
    });

    boxes.sort((a, b) => a.depthKey - b.depthKey);

    // Dibujar primero las piezas ya existentes y luego las del paso con resalte
    for (const box of boxes) {
      this.drawIsometricBox(ctx, box.pMin, box.pMax, project, toScreen, box.isCurrentStep);
    }

    // Dibujar elementos técnicos específicos del paso (flechas de inserción, cotas, diagonales)
    this.drawStepTechnicalAnnotations(ctx, step, boxes, toScreen, project, cssWidth, cssHeight);

    ctx.restore();
  }

  /**
   * Dibuja una caja 3D en proyección isométrica con caras superior, frontal y lateral sombreadas.
   */
  private drawIsometricBox(
    ctx: CanvasRenderingContext2D,
    min: { x: number; y: number; z: number },
    max: { x: number; y: number; z: number },
    project: (x: number, y: number, z: number) => IsoPoint,
    toScreen: (pt: IsoPoint) => IsoPoint,
    highlight: boolean
  ): void {
    const v0 = toScreen(project(min.x, min.y, min.z));
    const v1 = toScreen(project(max.x, min.y, min.z));
    const v2 = toScreen(project(max.x, max.y, min.z));
    const v3 = toScreen(project(min.x, max.y, min.z));
    const v4 = toScreen(project(min.x, min.y, max.z));
    const v5 = toScreen(project(max.x, min.y, max.z));
    const v6 = toScreen(project(max.x, max.y, max.z));
    const v7 = toScreen(project(min.x, max.y, max.z));

    ctx.save();
    ctx.lineWidth = highlight ? 1.8 : 1.1;
    ctx.strokeStyle = highlight ? '#1d4ed8' : '#334155';
    ctx.lineJoin = 'round';

    // Cara Superior (+Y): v3 -> v2 -> v6 -> v7
    ctx.fillStyle = highlight ? '#dbeafe' : '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(v3.u, v3.v);
    ctx.lineTo(v2.u, v2.v);
    ctx.lineTo(v6.u, v6.v);
    ctx.lineTo(v7.u, v7.v);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cara Frontal (+Z): v4 -> v5 -> v6 -> v7
    ctx.fillStyle = highlight ? '#93c5fd' : '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(v4.u, v4.v);
    ctx.lineTo(v5.u, v5.v);
    ctx.lineTo(v6.u, v6.v);
    ctx.lineTo(v7.u, v7.v);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cara Lateral Derecha (+X): v1 -> v5 -> v6 -> v2
    ctx.fillStyle = highlight ? '#bfdbfe' : '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(v1.u, v1.v);
    ctx.lineTo(v5.u, v5.v);
    ctx.lineTo(v6.u, v6.v);
    ctx.lineTo(v2.u, v2.v);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Dibuja el círculo identificador de pieza (P1, P2...) con línea guía.
   * Si se especifican centerModuleX y centerModuleY, el badge se desplaza radialmente hacia afuera
   * del centro del mueble para evitar aglutinación y solapamientos.
   */
  private drawNumberedCalloutBadge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    code: string,
    centerModuleX?: number,
    centerModuleY?: number
  ): void {
    ctx.save();

    let dirX = -0.8;
    let dirY = -0.6;
    if (centerModuleX !== undefined && centerModuleY !== undefined) {
      const dx = x - centerModuleX;
      const dy = y - centerModuleY;
      const len = Math.hypot(dx, dy);
      if (len > 5) {
        dirX = dx / len;
        dirY = dy / len;
      }
    }

    const badgeDist = 28;
    const badgeX = Math.round(x + dirX * badgeDist);
    const badgeY = Math.round(y + dirY * badgeDist);

    // Línea guía desde la pieza hacia el badge
    ctx.beginPath();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.2;
    ctx.moveTo(x, y);
    ctx.lineTo(badgeX, badgeY);
    ctx.stroke();

    // Nodo indicador en el centro de la pieza
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Círculo del badge
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Texto con el código (ej. P1)
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(code, badgeX, badgeY);

    ctx.restore();
  }

  /**
   * Dibuja flechas, líneas de cota o símbolos técnicos explicativos según el tipo de paso.
   */
  private drawStepTechnicalAnnotations(
    ctx: CanvasRenderingContext2D,
    step: AssemblyStep,
    boxes: { piece: AssemblyGuidePiece; pMin: { x: number; y: number; z: number }; pMax: { x: number; y: number; z: number }; isCurrentStep: boolean }[],
    toScreen: (pt: IsoPoint) => IsoPoint,
    project: (x: number, y: number, z: number) => IsoPoint,
    width: number,
    height: number
  ): void {
    ctx.save();

    // Pastilla indicadora de paso en la esquina superior derecha del canvas
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(width - 64, 10, 54, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`PASO 0${step.stepNumber}`, width - 37, 20);

    const currentBoxes = boxes.filter(b => b.isCurrentStep);

    if (step.actionType === 'back') {
      // Paso 2: Escuadrado con verificación de diagonales cruzadas (D1 = D2 a 90°)
      if (currentBoxes.length > 0) {
        const box = currentBoxes[0];
        const p1 = toScreen(project(box.pMin.x, box.pMin.y, box.pMin.z));
        const p2 = toScreen(project(box.pMax.x, box.pMax.y, box.pMin.z));
        const p3 = toScreen(project(box.pMin.x, box.pMax.y, box.pMin.z));
        const p4 = toScreen(project(box.pMax.x, box.pMin.y, box.pMin.z));

        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5;

        // Diagonal 1
        ctx.beginPath();
        ctx.moveTo(p1.u, p1.v);
        ctx.lineTo(p2.u, p2.v);
        ctx.stroke();

        // Diagonal 2
        ctx.beginPath();
        ctx.moveTo(p3.u, p3.v);
        ctx.lineTo(p4.u, p4.v);
        ctx.stroke();

        // Insignia técnica D1 = D2 (90°)
        const midX = (p1.u + p2.u) / 2;
        const midY = (p1.v + p2.v) / 2;
        ctx.setLineDash([]);
        ctx.fillStyle = '#1e3a8a';
        ctx.beginPath();
        ctx.roundRect(midX - 40, midY - 11, 80, 22, 11);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('D1 = D2 (90°)', midX, midY);
      }
    } else if (step.actionType === 'shelves') {
      // Paso 3: Flechas descendentes de inserción de repisas
      for (const box of currentBoxes) {
        const cx = (box.pMin.x + box.pMax.x) / 2;
        const cy = box.pMax.y;
        const cz = (box.pMin.z + box.pMax.z) / 2;

        const topPt = toScreen(project(cx, cy + 80, cz));
        const botPt = toScreen(project(cx, cy + 10, cz));

        this.drawInsertionArrow(ctx, topPt.u, topPt.v, botPt.u, botPt.v, '#2563eb');
      }
    } else if (step.actionType === 'drawers') {
      // Paso 4: Flechas frontales deslizantes hacia afuera
      for (const box of currentBoxes) {
        if (box.piece.componentRole === 'drawer_front') {
          const cx = (box.pMin.x + box.pMax.x) / 2;
          const cy = (box.pMin.y + box.pMax.y) / 2;
          const cz = box.pMax.z;

          const startPt = toScreen(project(cx, cy, cz - 40));
          const endPt = toScreen(project(cx, cy, cz + 50));

          this.drawInsertionArrow(ctx, startPt.u, startPt.v, endPt.u, endPt.v, '#2563eb');
        }
      }
    } else if (step.actionType === 'doors') {
      // Paso 5: Indicador de apertura batiente y bisagras
      for (const box of currentBoxes) {
        const cx = (box.pMin.x + box.pMax.x) / 2;
        const cy = (box.pMin.y + box.pMax.y) / 2;
        const cz = box.pMax.z;

        const centerPt = toScreen(project(cx, cy, cz));
        // Círculo de bisagra
        ctx.fillStyle = '#f59e0b';
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(centerPt.u - 30, centerPt.v - 20, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerPt.u - 30, centerPt.v + 20, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Dibuja una flecha de inserción técnica sólida.
   */
  private drawInsertionArrow(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string
  ): void {
    const headLen = 9;
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.2;

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

  /**
   * Retícula técnica milimétrica tenue de fondo.
   */
  private drawTechnicalGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.strokeStyle = '#f1f5f9';
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

  /**
   * Calcula la caja envolvente 3D de todas las piezas de un mueble.
   */
  private calculateModuleBounds(pieces: AssemblyGuidePiece[]) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const p of pieces) {
      const b = this.getPartAABB(p.part);
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxY > maxY) maxY = b.maxY;
      if (b.minZ < minZ) minZ = b.minZ;
      if (b.maxZ > maxZ) maxZ = b.maxZ;
    }

    return {
      minX: Number.isFinite(minX) ? minX : 0,
      maxX: Number.isFinite(maxX) ? maxX : 600,
      minY: Number.isFinite(minY) ? minY : 0,
      maxY: Number.isFinite(maxY) ? maxY : 800,
      minZ: Number.isFinite(minZ) ? minZ : 0,
      maxZ: Number.isFinite(maxZ) ? maxZ : 400,
      cx: (minX + maxX) / 2 || 300,
      cy: (minY + maxY) / 2 || 400,
      cz: (minZ + maxZ) / 2 || 200
    };
  }

  /**
   * Obtiene la caja envolvente local/global de una pieza para el renderizado isométrico.
   */
  private getPartAABB(part: import('../../models/melamine.models').Part) {
    const px = part.posX ?? 0;
    const py = part.posY ?? 0;
    const pz = part.posZ ?? 0;

    let sx = part.length;
    let sy = part.width;
    let sz = part.thickness || 18;

    if (part.orientation === 'vertical_yz') {
      sx = part.thickness || 18;
      sy = part.length;
      sz = part.width;
    } else if (part.orientation === 'vertical_xy') {
      sx = part.width;
      sy = part.length;
      sz = part.thickness || 18;
    } else {
      sx = part.length;
      sy = part.thickness || 18;
      sz = part.width;
    }

    return {
      minX: px - (sx / 2),
      maxX: px + (sx / 2),
      minY: py - (sy / 2),
      maxY: py + (sy / 2),
      minZ: pz - (sz / 2),
      maxZ: pz + (sz / 2)
    };
  }

  private getBoxCorners(min: { x: number; y: number; z: number }, max: { x: number; y: number; z: number }) {
    return [
      { x: min.x, y: min.y, z: min.z },
      { x: max.x, y: min.y, z: min.z },
      { x: max.x, y: max.y, z: min.z },
      { x: min.x, y: max.y, z: min.z },
      { x: min.x, y: min.y, z: max.z },
      { x: max.x, y: min.y, z: max.z },
      { x: max.x, y: max.y, z: max.z },
      { x: min.x, y: max.y, z: max.z }
    ];
  }

  /**
   * Determina el desplazamiento de explosión según el rol y cuadrante geométrico.
   */
  private getExplodeOffset(
    role: string | undefined,
    px: number,
    py: number,
    pz: number,
    cx: number,
    cy: number,
    cz: number,
    dist: number
  ): { x: number; y: number; z: number } {
    let dx = 0, dy = 0, dz = 0;

    switch (role) {
      case 'side_left':
        dx = -dist * 1.05;
        break;
      case 'side_right':
        dx = dist * 1.05;
        break;
      case 'top':
        dy = dist * 0.9;
        break;
      case 'tie':
        dy = dist * 0.8;
        break;
      case 'bottom':
        dy = -dist * 0.4;
        break;
      case 'plinth':
        dy = -dist * 0.8;
        break;
      case 'back':
        dz = -dist * 1.25;
        break;
      case 'door':
        dz = dist * 1.4;
        dx = px > cx ? dist * 0.2 : -dist * 0.2;
        break;
      case 'drawer_front':
        dz = dist * 1.3;
        break;
      case 'drawer_box':
      case 'drawer_lateral':
        dz = dist * 0.9;
        break;
      case 'shelf':
        dy = py > cy ? dist * 0.25 : -dist * 0.25;
        break;
      case 'divider':
        dx = px > cx ? dist * 0.35 : -dist * 0.35;
        break;
      default:
        dx = px > cx ? dist * 0.3 : (px < cx ? -dist * 0.3 : 0);
        dy = py > cy ? dist * 0.3 : (py < cy ? -dist * 0.3 : 0);
        dz = pz > cz ? dist * 0.4 : (pz < cz ? -dist * 0.4 : 0);
        break;
    }

    return { x: dx, y: dy, z: dz };
  }
}
