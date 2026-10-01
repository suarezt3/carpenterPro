import { Injectable, inject } from '@angular/core';
import { Project, Part, DrillHole } from '../models/melamine.models';
import { JoineryEngineService } from './joinery-engine.service';

@Injectable({
  providedIn: 'root'
})
export class DxfExporterService {
  private joineryEngine = inject(JoineryEngineService);

  // Generates and triggers browser download of standard AutoCAD DXF R12/2000 file
  exportProjectToDxf(project: Project) {
    const dxfContent = this.generateDxfString(project);
    const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanName = project.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    a.download = `${cleanName}_despiece_cnc_mecanizado.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Builds standardized ASCII DXF text structure with layers, lines, circles and texts
  generateDxfString(project: Project): string {
    const joinery = this.joineryEngine.calculateJoinery(project.parts);
    const parts = project.parts;

    const lines: string[] = [];

    // --- HEADER SECTION ---
    lines.push('0', 'SECTION');
    lines.push('2', 'HEADER');
    lines.push('9', '$ACADVER');
    lines.push('1', 'AC1009'); // AutoCAD R12 (most universal format for CNC seccionadoras)
    lines.push('9', '$INSUNITS');
    lines.push('70', '4'); // 4 = Millimeters
    lines.push('0', 'ENDSEC');

    // --- TABLES & LAYERS SECTION ---
    lines.push('0', 'SECTION');
    lines.push('2', 'TABLES');
    lines.push('0', 'TABLE');
    lines.push('2', 'LAYER');
    lines.push('70', '5'); // 5 layers defined

    // Layer 1: PIEZAS_CONTORNO (White/Cyan - Cut Contours)
    this.addLayerDefinition(lines, 'PIEZAS_CONTORNO', 7); // Color 7 = White/Black
    // Layer 2: MECANIZADOS_PERFORACIONES (Red - Drilling Circles for CNC)
    this.addLayerDefinition(lines, 'MECANIZADOS_PERFORACIONES', 1); // Color 1 = Red
    // Layer 3: TAPACANTOS (Yellow - Edge Banding Indicators)
    this.addLayerDefinition(lines, 'TAPACANTOS', 2); // Color 2 = Yellow
    // Layer 4: TEXTOS_ETIQUETAS (Green - Piece Name & Data)
    this.addLayerDefinition(lines, 'TEXTOS_ETIQUETAS', 3); // Color 3 = Green
    // Layer 5: COTAS_MEDIDAS (Cyan - Dimension Guidelines)
    this.addLayerDefinition(lines, 'COTAS_MEDIDAS', 4); // Color 4 = Cyan

    lines.push('0', 'ENDTAB');
    lines.push('0', 'ENDSEC');

    // --- ENTITIES SECTION ---
    lines.push('0', 'SECTION');
    lines.push('2', 'ENTITIES');

    // Lay out pieces in an orderly 2D sheet grid (arranged left to right, top to bottom)
    let currentX = 50;
    let currentY = 50;
    let rowMaxHeight = 0;
    const maxRowWidth = 4000; // 4 meters max per line in CAD space
    const gap = 80; // 80mm gap between pieces

    for (const part of parts) {
      const L = part.length;
      const W = part.width;
      const holes = joinery.drillHolesByPart.get(part.id) || [];

      if (currentX + L > maxRowWidth && currentX > 100) {
        currentX = 50;
        currentY += rowMaxHeight + gap + 150; // New row
        rowMaxHeight = 0;
      }

      const pX = currentX;
      const pY = currentY;

      // 1. Draw Piece Cut Boundary (4 Lines) on Layer PIEZAS_CONTORNO
      this.addDxfLine(lines, 'PIEZAS_CONTORNO', pX, pY, pX + L, pY);
      this.addDxfLine(lines, 'PIEZAS_CONTORNO', pX + L, pY, pX + L, pY + W);
      this.addDxfLine(lines, 'PIEZAS_CONTORNO', pX + L, pY + W, pX, pY + W);
      this.addDxfLine(lines, 'PIEZAS_CONTORNO', pX, pY + W, pX, pY);

      // 2. Draw Edge Banding Indicators on Layer TAPACANTOS (offset lines)
      const edgeOffset = 8;
      if (part.edges.l1 !== 'none') {
        // Top edge (Y = pY + W)
        this.addDxfLine(lines, 'TAPACANTOS', pX, pY + W - edgeOffset, pX + L, pY + W - edgeOffset);
      }
      if (part.edges.l2 !== 'none') {
        // Bottom edge (Y = pY)
        this.addDxfLine(lines, 'TAPACANTOS', pX, pY + edgeOffset, pX + L, pY + edgeOffset);
      }
      if (part.edges.a1 !== 'none') {
        // Left edge (X = pX)
        this.addDxfLine(lines, 'TAPACANTOS', pX + edgeOffset, pY, pX + edgeOffset, pY + W);
      }
      if (part.edges.a2 !== 'none') {
        // Right edge (X = pX + L)
        this.addDxfLine(lines, 'TAPACANTOS', pX + L - edgeOffset, pY, pX + L - edgeOffset, pY + W);
      }

      // 3. Draw Drill Holes (Mecanizados) on Layer MECANIZADOS_PERFORACIONES
      this.addPartDrillHolesToDxf(lines, part, holes, pX, pY, L, W);

      // 4. Draw Piece Title & Technical Specs on Layer TEXTOS_ETIQUETAS
      const textX = pX + 15;
      const textY = pY + W / 2;
      const label1 = `${part.name} (${part.quantity}x)`;
      const label2 = `${L} x ${W} x ${part.thickness}mm | ${part.materialName}`;
      const label3 = `Veta: ${part.grain === 'length' ? 'Longitudinal' : part.grain === 'width' ? 'Transversal' : 'Sin Veta'}`;

      this.addDxfText(lines, 'TEXTOS_ETIQUETAS', textX, textY + 25, 18, label1);
      this.addDxfText(lines, 'TEXTOS_ETIQUETAS', textX, textY - 5, 12, label2);
      this.addDxfText(lines, 'TEXTOS_ETIQUETAS', textX, textY - 25, 10, label3);

      // Advance layout coordinate
      currentX += L + gap;
      if (W > rowMaxHeight) {
        rowMaxHeight = W;
      }
    }

    // --- END OF ENTITIES & FILE ---
    lines.push('0', 'ENDSEC');
    lines.push('0', 'EOF');

    return lines.join('\n');
  }

  private addLayerDefinition(lines: string[], name: string, colorNumber: number) {
    lines.push('0', 'LAYER');
    lines.push('2', name);
    lines.push('70', '0');
    lines.push('62', colorNumber.toString()); // Color
    lines.push('6', 'CONTINUOUS');
  }

  private addDxfLine(lines: string[], layer: string, x1: number, y1: number, x2: number, y2: number) {
    lines.push('0', 'LINE');
    lines.push('8', layer);
    lines.push('10', x1.toFixed(3)); // Start X
    lines.push('20', y1.toFixed(3)); // Start Y
    lines.push('30', '0.000');       // Start Z
    lines.push('11', x2.toFixed(3)); // End X
    lines.push('21', y2.toFixed(3)); // End Y
    lines.push('31', '0.000');       // End Z
  }

  private addDxfCircle(lines: string[], layer: string, cx: number, cy: number, radius: number) {
    lines.push('0', 'CIRCLE');
    lines.push('8', layer);
    lines.push('10', cx.toFixed(3)); // Center X
    lines.push('20', cy.toFixed(3)); // Center Y
    lines.push('30', '0.000');       // Center Z
    lines.push('40', radius.toFixed(3)); // Radius
  }

  private addDxfText(lines: string[], layer: string, x: number, y: number, height: number, text: string) {
    lines.push('0', 'TEXT');
    lines.push('8', layer);
    lines.push('10', x.toFixed(3));
    lines.push('20', y.toFixed(3));
    lines.push('30', '0.000');
    lines.push('40', height.toFixed(1));
    lines.push('1', text);
  }

  // Maps global 3D drill holes into 2D coordinates on the piece surface
  private addPartDrillHolesToDxf(
    lines: string[],
    part: Part,
    holes: DrillHole[],
    originX: number,
    originY: number,
    L: number,
    W: number
  ) {
    for (const h of holes) {
      const radius = h.diameter / 2;

      // Project onto the 2D plane of the piece
      let localX = L / 2;
      let localY = W / 2;

      if (h.type === 'hinge_35') {
        localX = 22; // 22mm from edge
        localY = Math.max(30, Math.min(W - 30, (h.posY % W)));
      } else {
        // Distribute based on posZ depth and relative position
        localX = Math.max(30, Math.min(L - 30, (h.posZ + 1000) % L));
        localY = Math.max(20, Math.min(W - 20, (h.posX + 1000) % W));
      }

      const cx = originX + localX;
      const cy = originY + localY;

      // 1. Draw Circle for Drill Hole
      this.addDxfCircle(lines, 'MECANIZADOS_PERFORACIONES', cx, cy, radius);

      // 2. Draw Center Mark Cross (+)
      const crossSize = Math.max(radius * 1.5, 6);
      this.addDxfLine(lines, 'MECANIZADOS_PERFORACIONES', cx - crossSize, cy, cx + crossSize, cy);
      this.addDxfLine(lines, 'MECANIZADOS_PERFORACIONES', cx, cy - crossSize, cx, cy + crossSize);
    }
  }
}
