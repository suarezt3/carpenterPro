import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject
} from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Cancel01Icon,
  CheckListIcon,
  Compass01Icon,
  Download01Icon,
  Moon02Icon,
  PrinterIcon,
  RulerIcon,
  Sun01Icon,
  ViewIcon
} from '@hugeicons/core-free-icons';
import { Project, DrillHole } from '../../models/melamine.models';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { DxfExporterService } from '../../services/dxf-exporter.service';

/**
 * Representa una pieza proyectada ortográficamente en un plano 2D (Frontal, Lateral o Planta).
 */
export interface OrthoPiece2D {
  id: string;
  name: string;
  role?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  thickness: number;
  colorHex: string;
  isFrontFacing: boolean;
}

export interface DimensionLine2D {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  text: string;
  textX: number;
  textY: number;
  isHorizontal: boolean;
}

/**
 * Modal de Plano Técnico 2D de Fabricación.
 * Genera proyecciones ortográficas SVG acotadas (Alzada Frontal y Perfil Lateral)
 * y resume los mecanizados CNC de cada pieza para impresión o exportación DXF.
 */
@Component({
  selector: 'app-technical-sheet-modal',
  imports: [HugeiconsIconComponent],
  templateUrl: './technical-sheet-modal.html',
  styleUrl: './technical-sheet-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TechnicalSheetModalComponent {
  private readonly joineryEngine = inject(JoineryEngineService);
  private readonly dxfExporter = inject(DxfExporterService);

  // Iconos vectoriales de Hugeicons utilizados en la lámina técnica
  readonly icons = {
    blueprint: Compass01Icon,
    sun: Sun01Icon,
    moon: Moon02Icon,
    download: Download01Icon,
    print: PrinterIcon,
    close: Cancel01Icon,
    view: ViewIcon,
    ruler: RulerIcon,
    list: CheckListIcon
  };

  // Proyecto activo y evento de cierre del modal
  readonly project = input.required<Project>();
  readonly modalClose = output<void>();

  // Opciones interactivas de visualización del plano
  readonly showFrontView = signal<boolean>(true);
  readonly showSideView = signal<boolean>(true);
  readonly showTopView = signal<boolean>(true);
  readonly showDimensions = signal<boolean>(true);
  readonly showDrills = signal<boolean>(true);
  readonly isBlueprintDark = signal<boolean>(false);

  /**
   * Calcula en tiempo real todas las perforaciones y colisiones del proyecto usando JoineryEngineService.
   */
  readonly joineryData = computed(() => {
    return this.joineryEngine.calculateJoinery(this.project().parts);
  });

  readonly drillHoles = computed<DrillHole[]>(() => {
    return this.joineryData().allDrillHoles;
  });

  /**
   * Material estructural predominante REAL del proyecto (por área de piezas), con su espesor real
   * tomado de las piezas (no del catálogo), para que coincida con el modelador, optimizador y presupuesto.
   */
  readonly mainBoardInfo = computed<{ name: string; thickness: number }>(() => {
    const proj = this.project();
    const areaByKey = new Map<string, { matId: string; thickness: number; area: number }>();
    for (const p of proj.parts) {
      const t = Math.round((Number(p.thickness) || 0) * 10) / 10;
      if (t <= 8 || p.componentRole === 'countertop' || p.componentRole === 'backsplash') continue;
      const key = `${p.materialId}__${t}`;
      const area = (p.length * p.width * (p.quantity || 1));
      const prev = areaByKey.get(key);
      if (prev) prev.area += area;
      else areaByKey.set(key, { matId: p.materialId, thickness: t, area });
    }
    let best: { matId: string; thickness: number; area: number } | null = null;
    for (const v of areaByKey.values()) {
      if (!best || v.area > best.area) best = v;
    }
    if (!best) {
      return { name: proj.materials[0]?.name || 'Melamina', thickness: proj.materials[0]?.thickness || 18 };
    }
    const mat = proj.materials.find(m => m.id === best!.matId);
    return { name: mat?.name || 'Melamina', thickness: best.thickness };
  });

  /**
   * Calcula la caja envolvente total (Bounding Box 3D) del mueble completo en milímetros.
   */
  readonly bounds = computed(() => {
    const parts = this.project().parts;
    if (parts.length === 0) {
      return { minX: 0, maxX: 1000, minY: 0, maxY: 900, minZ: 0, maxZ: 600, width: 1000, height: 900, depth: 600 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const p of parts) {
      const b = this.joineryEngine.getPartBounds(p);
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxY > maxY) maxY = b.maxY;
      if (b.minZ < minZ) minZ = b.minZ;
      if (b.maxZ > maxZ) maxZ = b.maxZ;
    }

    return {
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      width: Math.round(maxX - minX),
      height: Math.round(maxY - minY),
      depth: Math.round(maxZ - minZ)
    };
  });

  /**
   * Proyección 2D de la Vista Frontal (Alzada: Eje X vs Eje Y invertido para SVG).
   */
  readonly frontPieces = computed<OrthoPiece2D[]>(() => {
    const parts = this.project().parts;
    const bTotal = this.bounds();

    return parts.map(p => {
      const b = this.joineryEngine.getPartBounds(p);
      return {
        id: p.id,
        name: p.name,
        role: p.componentRole,
        x: b.minX - bTotal.minX,
        y: bTotal.maxY - b.maxY,
        w: b.sx,
        h: b.sy,
        thickness: p.thickness || 18,
        colorHex: p.colorHex || '#d4d4d8',
        isFrontFacing: p.orientation === 'vertical_xy'
      };
    });
  });

  /**
   * Proyección 2D de la Vista Lateral (Perfil: Eje Z vs Eje Y invertido para SVG).
   */
  readonly sidePieces = computed<OrthoPiece2D[]>(() => {
    const parts = this.project().parts;
    const bTotal = this.bounds();

    return parts.map(p => {
      const b = this.joineryEngine.getPartBounds(p);
      return {
        id: p.id,
        name: p.name,
        role: p.componentRole,
        x: b.minZ - bTotal.minZ,
        y: bTotal.maxY - b.maxY,
        w: b.sz,
        h: b.sy,
        thickness: p.thickness || 18,
        colorHex: p.colorHex || '#d4d4d8',
        isFrontFacing: false
      };
    });
  });

  /**
   * Proyección 2D de la Vista Superior (Planta: Eje X vs Eje Z).
   */
  readonly topPieces = computed<OrthoPiece2D[]>(() => {
    const parts = this.project().parts;
    const bTotal = this.bounds();

    return parts.map(p => {
      const b = this.joineryEngine.getPartBounds(p);
      return {
        id: p.id,
        name: p.name,
        role: p.componentRole,
        x: b.minX - bTotal.minX,
        y: b.minZ - bTotal.minZ,
        w: b.sx,
        h: b.sz,
        thickness: p.thickness || 18,
        colorHex: p.colorHex || '#d4d4d8',
        isFrontFacing: false
      };
    });
  });

  /**
   * Líneas de cotas generales para la vista frontal.
   */
  readonly frontDimensions = computed<DimensionLine2D[]>(() => {
    const b = this.bounds();
    return [
      {
        x1: 0,
        y1: -35,
        x2: b.width,
        y2: -35,
        text: `${b.width} mm`,
        textX: b.width / 2,
        textY: -43,
        isHorizontal: true
      },
      {
        x1: -45,
        y1: 0,
        x2: -45,
        y2: b.height,
        text: `${b.height} mm`,
        textX: -55,
        textY: b.height / 2,
        isHorizontal: false
      }
    ];
  });

  /**
   * Abre el diálogo nativo de impresión del navegador para guardar o imprimir el plano en PDF.
   */
  printSheet() {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  /**
   * Descarga el archivo DXF R12 con todas las capas de corte y taladros CNC.
   */
  downloadDxf() {
    this.dxfExporter.exportProjectToDxf(this.project());
  }

  /**
   * Alterna entre el modo Papel Blanco de taller y el modo Blueprint CAD Oscuro.
   */
  toggleTheme() {
    this.isBlueprintDark.update(v => !v);
  }
}