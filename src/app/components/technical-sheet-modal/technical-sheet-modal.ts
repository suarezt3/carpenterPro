import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Project, DrillHole } from '../../models/melamine.models';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { DxfExporterService } from '../../services/dxf-exporter.service';

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

@Component({
  selector: 'app-technical-sheet-modal',
  imports: [CommonModule],
  templateUrl: './technical-sheet-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TechnicalSheetModalComponent {
  private joineryEngine = inject(JoineryEngineService);
  private dxfExporter = inject(DxfExporterService);

  // Inputs & Outputs
  project = input.required<Project>();
  modalClose = output<void>();

  // Interactive View Settings
  showFrontView = signal<boolean>(true);
  showSideView = signal<boolean>(true);
  showTopView = signal<boolean>(true);
  showDimensions = signal<boolean>(true);
  showDrills = signal<boolean>(true);
  isBlueprintDark = signal<boolean>(false); // Default to clean white workshop paper

  readonly joineryData = computed(() => {
    return this.joineryEngine.calculateJoinery(this.project().parts);
  });

  readonly drillHoles = computed<DrillHole[]>(() => {
    return this.joineryData().allDrillHoles;
  });

  // Calculate furniture overall dimensions
  readonly bounds = computed(() => {
    const parts = this.project().parts;
    if (parts.length === 0) {
      return { minX: 0, maxX: 1000, minY: 0, maxY: 900, minZ: 0, maxZ: 600, width: 1000, height: 900, depth: 600 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

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

  // Front View 2D Projected Rectangles
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
        y: bTotal.maxY - b.maxY, // SVG Y is inverted
        w: b.sx,
        h: b.sy,
        thickness: p.thickness || 18,
        colorHex: p.colorHex || '#d4d4d8',
        isFrontFacing: p.orientation === 'vertical_xy'
      };
    });
  });

  // Side View 2D Projected Rectangles (Profile: Z vs Y)
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

  // Top View 2D Projected Rectangles (Planta: X vs Z)
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

  // Front View Dimensions (Overall width, height, shelf heights)
  readonly frontDimensions = computed<DimensionLine2D[]>(() => {
    const b = this.bounds();
    const dims: DimensionLine2D[] = [];

    // Top Width Cota
    dims.push({
      x1: 0,
      y1: -35,
      x2: b.width,
      y2: -35,
      text: `${b.width} mm`,
      textX: b.width / 2,
      textY: -43,
      isHorizontal: true
    });

    // Left Height Cota
    dims.push({
      x1: -45,
      y1: 0,
      x2: -45,
      y2: b.height,
      text: `${b.height} mm`,
      textX: -55,
      textY: b.height / 2,
      isHorizontal: false
    });

    return dims;
  });

  printSheet() {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  downloadDxf() {
    this.dxfExporter.exportProjectToDxf(this.project());
  }

  toggleTheme() {
    this.isBlueprintDark.update(v => !v);
  }
}
