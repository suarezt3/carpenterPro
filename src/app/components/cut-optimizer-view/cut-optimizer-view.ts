import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Add01Icon,
  Alert02Icon,
  ArrowDataTransferHorizontalIcon,
  ArrowDown01Icon,
  CheckListIcon,
  Clock01Icon,
  Compass01Icon,
  Download01Icon,
  Layers01Icon,
  Note01Icon,
  PrinterIcon,
  Settings01Icon,
  ViewIcon
} from '@hugeicons/core-free-icons';
import { ProjectStorageService } from '../../services/project-storage.service';
import { CutOptimizerService } from '../../services/cut-optimizer.service';
import { ThemeService } from '../../services/theme.service';
import { Material, OptimizationResult, PlacedPart, PlacedSheet } from '../../models/melamine.models';

/**
 * Vista interactiva del Optimizador de Corte 2D por Guillotina.
 * Renderiza el plano SVG de cada tablero comercial, numera la secuencia de cortes de sierra,
 * calcula la merma/retazos y exporta planos técnicos en PNG Ultra HD y PDF apaisado.
 */
@Component({
  selector: 'app-cut-optimizer-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent],
  templateUrl: './cut-optimizer-view.html',
  styleUrl: './cut-optimizer-view.css'
})
export class CutOptimizerViewComponent {
  readonly themeService = inject(ThemeService);
  private readonly projectService = inject(ProjectStorageService);
  private readonly optimizer = inject(CutOptimizerService);

  // Registro local de iconos vectoriales de Hugeicons
  readonly icons = {
    optimizer: Compass01Icon,
    print: PrinterIcon,
    loading: Clock01Icon,
    download: Download01Icon,
    chevronDown: ArrowDown01Icon,
    image: ViewIcon,
    pdf: Note01Icon,
    board: Layers01Icon,
    zoomIn: Add01Icon,
    zoomOut: ArrowDown01Icon,
    list: CheckListIcon,
    settings: Settings01Icon,
    swap: ArrowDataTransferHorizontalIcon,
    alert: Alert02Icon
  };

  // Signals sincronizados con el estado global del proyecto
  readonly project = this.projectService.currentProject;
  readonly parts = this.projectService.partsList;
  readonly materials = this.projectService.materialsList;
  readonly settings = this.projectService.projectSettings;

  // Estado local del visor de tableros, zoom y menú de exportación
  readonly selectedSheetIndex = signal<number>(0);
  readonly zoomLevel = signal<number>(1);
  readonly hoveredPart = signal<PlacedPart | null>(null);
  readonly isDownloadMenuOpen = signal<boolean>(false);
  readonly isExporting = signal<boolean>(false);

  /**
   * Calcula de forma reactiva la distribución óptima de todas las piezas en tableros
   * cada vez que cambian las piezas, materiales o parámetros de sierra (Kerf / Refilado).
   */
  readonly optimizationResult = computed<OptimizationResult>(() => {
    const parts = this.parts();
    const mats = this.materials();
    const set = this.settings();
    return this.optimizer.optimizeProject(parts, mats, set);
  });

  /**
   * Devuelve el tablero actualmente seleccionado en las pestañas.
   */
  readonly currentSheet = computed<PlacedSheet | null>(() => {
    const res = this.optimizationResult();
    const idx = this.selectedSheetIndex();
    if (res.sheets.length > 0) {
      return res.sheets[idx] || res.sheets[0];
    }
    return null;
  });

  selectSheet(index: number) {
    this.selectedSheetIndex.set(index);
    this.hoveredPart.set(null);
  }

  // --- CONFIGURACIÓN DE MEDIDAS DE TABLERO (por material + espesor real) ---

  readonly showSheetConfig = signal<boolean>(false);

  /** Formatos comerciales habituales de tablero (largo × ancho en mm). */
  readonly sheetSizePresets: { length: number; width: number; label: string }[] = [
    { length: 2440, width: 1830, label: '2440 × 1830' },
    { length: 2440, width: 2150, label: '2440 × 2150' },
    { length: 2500, width: 1830, label: '2500 × 1830' },
    { length: 2600, width: 1830, label: '2600 × 1830' },
    { length: 2750, width: 1830, label: '2750 × 1830' },
    { length: 2800, width: 2070, label: '2800 × 2070' },
    { length: 2440, width: 1220, label: '2440 × 1220' }
  ];

  /** Tipos de tablero que necesita el proyecto (material + espesor real de las piezas). */
  readonly sheetTypes = computed(() => this.optimizer.listSheetTypes(this.parts(), this.materials()));

  /** Cantidad de placas usadas por cada tipo de tablero en el resultado actual. */
  readonly sheetsCountByType = computed(() => {
    const map = new Map<string, number>();
    for (const s of this.optimizationResult().sheets) {
      map.set(s.material.id, (map.get(s.material.id) || 0) + 1);
    }
    return map;
  });

  /** Piezas que no caben en el tablero configurado (más grandes que la placa). */
  readonly unplacedPartsSummary = computed(() => {
    const res = this.optimizationResult();
    const seen = new Map<string, { name: string; length: number; width: number; thickness: number; count: number }>();
    for (const p of res.unplacedParts) {
      const prev = seen.get(p.id);
      if (prev) prev.count++;
      else seen.set(p.id, { name: p.name, length: p.length, width: p.width, thickness: p.thickness, count: 1 });
    }
    return Array.from(seen.values());
  });

  toggleSheetConfig() {
    this.showSheetConfig.update(v => !v);
  }

  onSheetDimensionChange(material: Material, prop: 'sheetLength' | 'sheetWidth', event: Event) {
    const target = event.target as HTMLInputElement | null;
    const val = Math.round(Number(target?.value) || 0);
    if (val < 300) {
      if (target) target.value = String(material[prop]);
      return;
    }
    this.projectService.updateMaterialSheetSpec(material, { [prop]: val });
    this.selectedSheetIndex.set(0);
  }

  applySheetPreset(material: Material, length: number, width: number) {
    this.projectService.updateMaterialSheetSpec(material, { sheetLength: length, sheetWidth: width });
    this.selectedSheetIndex.set(0);
  }

  swapSheetDimensions(material: Material) {
    this.projectService.updateMaterialSheetSpec(material, {
      sheetLength: material.sheetWidth,
      sheetWidth: material.sheetLength
    });
    this.selectedSheetIndex.set(0);
  }

  applySizeToAllSheets(length: number, width: number) {
    for (const st of this.sheetTypes()) {
      this.projectService.updateMaterialSheetSpec(st.material, { sheetLength: length, sheetWidth: width });
    }
    this.selectedSheetIndex.set(0);
  }

  zoomIn() {
    this.zoomLevel.update(z => Math.min(z + 0.25, 2.5));
  }

  zoomOut() {
    this.zoomLevel.update(z => Math.max(z - 0.25, 0.75));
  }

  resetZoom() {
    this.zoomLevel.set(1);
  }

  toggleDownloadMenu() {
    this.isDownloadMenuOpen.update(v => !v);
  }

  closeDownloadMenu() {
    this.isDownloadMenuOpen.set(false);
  }

  /**
   * Restablece el zoom al 100% y abre el diálogo nativo de impresión del navegador.
   */
  printCurrentSheet() {
    this.closeDownloadMenu();
    this.resetZoom();
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.print();
      }, 150);
    }
  }

  /**
   * Exporta el diagrama SVG actual a una imagen PNG de alta definición (2800px)
   * incluyendo un membrete técnico superior con los datos del proyecto y aprovechamiento.
   */
  async downloadCurrentSheetAsPng() {
    this.closeDownloadMenu();
    if (typeof document === 'undefined') return;
    const sheet = this.currentSheet();
    if (!sheet) return;

    this.isExporting.set(true);
    try {
      const svgElement = document.getElementById('sheet-cut-diagram-svg') as SVGSVGElement | null;
      if (!svgElement) {
        throw new Error('Diagrama SVG no encontrado');
      }

      const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      const boardWidth = sheet.length;
      const boardHeight = sheet.width;

      const exportWidth = 2800;
      const exportHeight = Math.round((boardHeight / boardWidth) * exportWidth);

      svgClone.setAttribute('width', `${exportWidth}`);
      svgClone.setAttribute('height', `${exportHeight}`);

      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svgClone);

      if (!svgString.startsWith('<?xml')) {
        svgString = '<?xml version="1.0" standalone="no"?>\r\n' + svgString;
      }

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = e => reject(e);
        img.src = url;
      });

      const headerHeight = 160;
      const margin = 40;
      const totalCanvasWidth = exportWidth + (margin * 2);
      const totalCanvasHeight = exportHeight + headerHeight + (margin * 2);

      const canvas = document.createElement('canvas');
      canvas.width = totalCanvasWidth;
      canvas.height = totalCanvasHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No se pudo inicializar el contexto de Canvas 2D');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalCanvasWidth, totalCanvasHeight);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`PLANO DE CORTE OPTIMIZADO - TABLERO #${sheet.sheetIndex}`, margin, margin + 40);

      ctx.fillStyle = '#475569';
      ctx.font = '22px "Plus Jakarta Sans", sans-serif';
      const projName = this.project().name || 'Proyecto Cocina';
      ctx.fillText(`Proyecto: ${projName}  |  Material: ${sheet.material.name} (${sheet.material.thickness} mm)`, margin, margin + 76);

      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      const statsText = `Medidas: ${sheet.length} × ${sheet.width} mm  |  Aprovechamiento: ${sheet.efficiencyPercent}%  |  Piezas: ${sheet.placedParts.length}  |  Sierra: ${sheet.cutLengthMeters} ml  |  Merma: ${sheet.wasteAreaM2} m²`;
      ctx.fillText(statsText, margin, margin + 112);

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(margin, margin + 135);
      ctx.lineTo(totalCanvasWidth - margin, margin + 135);
      ctx.stroke();

      ctx.drawImage(img, margin, margin + headerHeight, exportWidth, exportHeight);

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 4;
      ctx.strokeRect(margin, margin + headerHeight, exportWidth, exportHeight);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px "Plus Jakarta Sans", sans-serif';
      const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
      ctx.fillText(`Generado con Piezo3D Studio • ${dateStr} • Patrón Guillotina (Escuadradora)`, margin, totalCanvasHeight - margin + 15);

      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      const safeMatName = sheet.material.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      downloadLink.download = `Plano_Corte_Tablero_${sheet.sheetIndex}_${safeMatName}.png`;
      downloadLink.href = pngUrl;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      console.error('Error al exportar PNG del tablero de corte:', err);
    } finally {
      this.isExporting.set(false);
    }
  }

  /**
   * Genera un documento técnico apaisado listo para imprimir o guardar como PDF en una sola página.
   */
  async downloadCurrentSheetAsPdf() {
    this.closeDownloadMenu();
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const sheet = this.currentSheet();
    if (!sheet) return;

    this.isExporting.set(true);
    try {
      const svgElement = document.getElementById('sheet-cut-diagram-svg') as SVGSVGElement | null;
      if (!svgElement) {
        throw new Error('Diagrama SVG no encontrado');
      }

      const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      svgClone.setAttribute('width', '100%');
      svgClone.setAttribute('height', '100%');

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgClone);

      const projName = this.project().name || 'Proyecto Cocina';
      const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        this.printCurrentSheet();
        return;
      }

      printWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Plano de Corte - Tablero #${sheet.sheetIndex} - ${projName}</title>
  <style>
    @page {
      size: landscape;
      margin: 8mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      background: #ffffff;
      color: #0f172a;
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 4mm;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .title-block h1 {
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
    }
    .title-block p {
      font-size: 9pt;
      color: #475569;
      margin-top: 2px;
    }
    .specs-block {
      text-align: right;
      font-size: 9pt;
      font-family: monospace;
      color: #0369a1;
      font-weight: bold;
    }
    .diagram-container {
      flex: 1;
      width: 100%;
      min-height: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #f8fafc;
      border: 1.5px solid #0f172a;
      border-radius: 4px;
      overflow: hidden;
    }
    .diagram-container svg {
      width: 99%;
      height: 99%;
      max-height: calc(100vh - 120px);
      object-fit: contain;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 6px;
      font-size: 8pt;
      color: #64748b;
    }
    @media print {
      body {
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-block">
      <h1>PLANO DE CORTE TÉCNICO • TABLERO #${sheet.sheetIndex}</h1>
      <p><strong>Proyecto:</strong> ${projName} &nbsp;|&nbsp; <strong>Material:</strong> ${sheet.material.name} (${sheet.material.thickness} mm) &nbsp;|&nbsp; <strong>Fecha:</strong> ${dateStr}</p>
    </div>
    <div class="specs-block">
      <div>Dimensión: ${sheet.length} × ${sheet.width} mm</div>
      <div>Aprovechamiento: ${sheet.efficiencyPercent}% (${sheet.placedParts.length} piezas) • Sierra: ${sheet.cutLengthMeters} ml</div>
    </div>
  </div>
  <div class="diagram-container">
    ${svgString}
  </div>
  <div class="footer">
    <span>Piezo3D Studio • Patrón de Guillotina para Escuadradora • Sierra Kerf: ${this.settings().sawKerf}mm • Refilado: ${this.settings().trimMargin}mm</span>
    <span>Página 1 de 1</span>
  </div>
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.print();
      }, 250);
    });
  </script>
</body>
</html>`);
      printWindow.document.close();
    } catch (err) {
      console.error('Error al exportar PDF del tablero de corte:', err);
    } finally {
      this.isExporting.set(false);
    }
  }
}