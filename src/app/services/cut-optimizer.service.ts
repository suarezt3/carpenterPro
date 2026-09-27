import { Injectable } from '@angular/core';
import {
  CutLine,
  LeftoverScrap,
  Material,
  OptimizationResult,
  Part,
  PlacedPart,
  PlacedSheet,
  ProjectSettings
} from '../models/melamine.models';

interface FreeRect {
  x: number;
  y: number;
  length: number; // width in X
  width: number;  // height in Y
}

interface ExpandedPartItem {
  part: Part;
  copyIndex: number;
  length: number;
  width: number;
  grain: 'length' | 'width' | 'none';
}

@Injectable({
  providedIn: 'root'
})
export class CutOptimizerService {

  optimizeProject(
    parts: Part[],
    materials: Material[],
    settings: ProjectSettings
  ): OptimizationResult {
    // 1. Calcular metros lineales de tapacantos en todas las piezas
    let totalThinEdgeMeters = 0;
    let totalThickEdgeMeters = 0;

    for (const part of parts) {
      const q = part.quantity;
      const lMeters = (part.length / 1000) * q;
      const wMeters = (part.width / 1000) * q;

      if (part.edges.l1 === 'thin') totalThinEdgeMeters += lMeters;
      if (part.edges.l1 === 'thick') totalThickEdgeMeters += lMeters;

      if (part.edges.l2 === 'thin') totalThinEdgeMeters += lMeters;
      if (part.edges.l2 === 'thick') totalThickEdgeMeters += lMeters;

      if (part.edges.a1 === 'thin') totalThinEdgeMeters += wMeters;
      if (part.edges.a1 === 'thick') totalThickEdgeMeters += wMeters;

      if (part.edges.a2 === 'thin') totalThinEdgeMeters += wMeters;
      if (part.edges.a2 === 'thick') totalThickEdgeMeters += wMeters;
    }

    // 2. Agrupar piezas por material
    const placedSheets: PlacedSheet[] = [];
    const unplacedParts: Part[] = [];
    let totalCutMeters = 0;
    let totalAreaUsedM2 = 0;
    let totalAreaSheetsM2 = 0;
    let totalPartsPlaced = 0;
    let totalPartsCount = 0;

    // Obtener lista única de materiales usados en las piezas
    const usedMaterialIds = new Set(parts.map(p => p.materialId));

    for (const matId of usedMaterialIds) {
      const material = materials.find(m => m.id === matId) || {
        id: matId,
        name: 'Melamina Estándar',
        thickness: 18,
        sheetLength: 2440,
        sheetWidth: 1830,
        sheetCost: 45,
        hasGrain: false,
        colorHex: '#d4a373'
      };

      const matParts = parts.filter(p => p.materialId === matId);
      const itemsToPlace: ExpandedPartItem[] = [];

      for (const part of matParts) {
        totalPartsCount += part.quantity;
        for (let i = 0; i < part.quantity; i++) {
          itemsToPlace.push({
            part,
            copyIndex: i + 1,
            length: part.length,
            width: part.width,
            grain: part.grain
          });
        }
      }

      // Ordenar piezas: piezas más grandes primero (Heurística Best Fit Decreasing)
      // por área, luego por lado mayor
      itemsToPlace.sort((a, b) => {
        const areaA = a.length * a.width;
        const areaB = b.length * b.width;
        if (areaB !== areaA) return areaB - areaA;
        return Math.max(b.length, b.width) - Math.max(a.length, a.width);
      });

      // Optimizar colocación en tableros sucesivos hasta terminar
      let currentItems = [...itemsToPlace];
      let sheetNum = 1;

      while (currentItems.length > 0) {
        const sheetResult = this.packSingleSheet(
          sheetNum,
          material,
          currentItems,
          settings
        );

        if (sheetResult.placedParts.length === 0) {
          // No entra ninguna pieza más en un tablero nuevo (pieza excede tamaño del tablero)
          for (const item of currentItems) {
            unplacedParts.push(item.part);
          }
          break;
        }

        placedSheets.push(sheetResult);
        totalCutMeters += sheetResult.cutLengthMeters;
        totalAreaUsedM2 += sheetResult.usedAreaM2;
        totalAreaSheetsM2 += (material.sheetLength * material.sheetWidth) / 1_000_000;
        totalPartsPlaced += sheetResult.placedParts.length;

        // Remover piezas colocadas
        const placedIds = new Set(sheetResult.placedParts.map(p => `${p.part.id}_${p.copyIndex}`));
        currentItems = currentItems.filter(item => !placedIds.has(`${item.part.id}_${item.copyIndex}`));

        sheetNum++;
      }
    }

    const wasteAreaM2 = Math.max(0, totalAreaSheetsM2 - totalAreaUsedM2);
    const overallEfficiency = totalAreaSheetsM2 > 0
      ? (totalAreaUsedM2 / totalAreaSheetsM2) * 100
      : 0;

    return {
      sheets: placedSheets,
      totalSheetsUsed: placedSheets.length,
      totalPartsPlaced,
      totalPartsCount,
      unplacedParts,
      overallEfficiency: Number(overallEfficiency.toFixed(1)),
      totalAreaUsedM2: Number(totalAreaUsedM2.toFixed(2)),
      totalAreaSheetsM2: Number(totalAreaSheetsM2.toFixed(2)),
      wasteAreaM2: Number(wasteAreaM2.toFixed(2)),
      totalCutMeters: Number(totalCutMeters.toFixed(2)),
      thinEdgeMeters: Number(totalThinEdgeMeters.toFixed(2)),
      thickEdgeMeters: Number(totalThickEdgeMeters.toFixed(2))
    };
  }

  private packSingleSheet(
    sheetIndex: number,
    material: Material,
    items: ExpandedPartItem[],
    settings: ProjectSettings
  ): PlacedSheet {
    const kerf = settings.sawKerf;
    const margin = settings.trimMargin;

    // Área útil disponible después del refilado de fábrica
    const usableLength = material.sheetLength - (2 * margin);
    const usableWidth = material.sheetWidth - (2 * margin);

    const placedParts: PlacedPart[] = [];
    const cutLines: CutLine[] = [];
    let freeRects: FreeRect[] = [
      {
        x: margin,
        y: margin,
        length: usableLength,
        width: usableWidth
      }
    ];

    let cutStage = 1;
    let cutLengthMm = (margin > 0) ? (2 * material.sheetLength + 2 * material.sheetWidth) : 0; // perímetro de refilado

    // Crear lista de ítems restantes para este tablero
    const remainingItems = [...items];
    const placedIndices = new Set<number>();

    for (let i = 0; i < remainingItems.length; i++) {
      const item = remainingItems[i];

      // Determinar orientaciones permitidas según la veta
      const canRotate = item.grain === 'none';
      const orientations: { length: number; width: number; rotated: boolean }[] = [
        { length: item.length, width: item.width, rotated: false }
      ];

      if (canRotate && item.length !== item.width) {
        orientations.push({ length: item.width, width: item.length, rotated: true });
      }

      // Buscar el mejor espacio libre (Best Short Side Fit)
      let bestRectIndex = -1;
      let bestOrientation: { length: number; width: number; rotated: boolean } | null = null;
      let bestShortSideFit = Number.MAX_VALUE;
      let bestAreaFit = Number.MAX_VALUE;

      for (let rIdx = 0; rIdx < freeRects.length; rIdx++) {
        const rect = freeRects[rIdx];

        for (const orient of orientations) {
          if (orient.length <= rect.length && orient.width <= rect.width) {
            const leftoverX = rect.length - orient.length;
            const leftoverY = rect.width - orient.width;
            const shortSideFit = Math.min(leftoverX, leftoverY);
            const areaFit = (rect.length * rect.width) - (orient.length * orient.width);

            if (shortSideFit < bestShortSideFit || (shortSideFit === bestShortSideFit && areaFit < bestAreaFit)) {
              bestShortSideFit = shortSideFit;
              bestAreaFit = areaFit;
              bestRectIndex = rIdx;
              bestOrientation = orient;
            }
          }
        }
      }

      if (bestRectIndex >= 0 && bestOrientation) {
        const targetRect = freeRects[bestRectIndex];
        const placedX = targetRect.x;
        const placedY = targetRect.y;
        const placedL = bestOrientation.length;
        const placedW = bestOrientation.width;

        placedParts.push({
          part: item.part,
          copyIndex: item.copyIndex,
          x: placedX,
          y: placedY,
          length: placedL,
          width: placedW,
          rotated: bestOrientation.rotated,
          tag: `P${placedParts.length + 1}`
        });

        placedIndices.add(i);

        // Remover el rectángulo usado
        freeRects.splice(bestRectIndex, 1);

        // Generar líneas de corte y dos nuevos rectángulos guillotina
        // Corte tipo guillotina:
        const remX = targetRect.length - placedL - kerf;
        const remY = targetRect.width - placedW - kerf;

        // Decidir si cortar horizontal o vertical primero para minimizar fragmentación
        const splitHorizontally = (settings.optimizationPreference === 'guillotine_width')
          ? true
          : (settings.optimizationPreference === 'guillotine_length')
            ? false
            : (remX >= remY); // Best fit: dividir a favor del remanente mayor

        if (splitHorizontally) {
          // Corte horizontal continuo primero a lo largo de X
          if (remY > 0) {
            cutLines.push({
              x1: targetRect.x,
              y1: targetRect.y + placedW + (kerf / 2),
              x2: targetRect.x + targetRect.length,
              y2: targetRect.y + placedW + (kerf / 2),
              stage: cutStage++,
              orientation: 'horizontal'
            });
            cutLengthMm += targetRect.length;

            freeRects.push({
              x: targetRect.x,
              y: targetRect.y + placedW + kerf,
              length: targetRect.length,
              width: remY
            });
          }

          if (remX > 0) {
            cutLines.push({
              x1: targetRect.x + placedL + (kerf / 2),
              y1: targetRect.y,
              x2: targetRect.x + placedL + (kerf / 2),
              y2: targetRect.y + placedW,
              stage: cutStage++,
              orientation: 'vertical'
            });
            cutLengthMm += placedW;

            freeRects.push({
              x: targetRect.x + placedL + kerf,
              y: targetRect.y,
              length: remX,
              width: placedW
            });
          }
        } else {
          // Corte vertical continuo primero a lo largo de Y
          if (remX > 0) {
            cutLines.push({
              x1: targetRect.x + placedL + (kerf / 2),
              y1: targetRect.y,
              x2: targetRect.x + placedL + (kerf / 2),
              y2: targetRect.y + targetRect.width,
              stage: cutStage++,
              orientation: 'vertical'
            });
            cutLengthMm += targetRect.width;

            freeRects.push({
              x: targetRect.x + placedL + kerf,
              y: targetRect.y,
              length: remX,
              width: targetRect.width
            });
          }

          if (remY > 0) {
            cutLines.push({
              x1: targetRect.x,
              y1: targetRect.y + placedW + (kerf / 2),
              x2: targetRect.x + placedL,
              y2: targetRect.y + placedW + (kerf / 2),
              stage: cutStage++,
              orientation: 'horizontal'
            });
            cutLengthMm += placedL;

            freeRects.push({
              x: targetRect.x,
              y: targetRect.y + placedW + kerf,
              length: placedL,
              width: remY
            });
          }
        }

        // Limpiar rectángulos muy pequeños o menores que el kerf
        freeRects = freeRects.filter(r => r.length > kerf && r.width > kerf);
      }
    }

    // Calcular retazos aprovechables (sobrantes con área >= 0.05m² y lados >= 200mm)
    const leftovers: LeftoverScrap[] = freeRects.map((r, idx) => {
      const areaM2 = (r.length * r.width) / 1_000_000;
      const usable = r.length >= 250 && r.width >= 200 && areaM2 >= 0.06;
      return {
        id: `scrap_${sheetIndex}_${idx}`,
        x: r.x,
        y: r.y,
        length: r.length,
        width: r.width,
        areaM2: Number(areaM2.toFixed(3)),
        usable
      };
    });

    const totalSheetAreaM2 = (material.sheetLength * material.sheetWidth) / 1_000_000;
    const usedAreaM2 = placedParts.reduce((sum, p) => sum + ((p.length * p.width) / 1_000_000), 0);
    const wasteAreaM2 = Math.max(0, totalSheetAreaM2 - usedAreaM2);
    const efficiencyPercent = totalSheetAreaM2 > 0 ? (usedAreaM2 / totalSheetAreaM2) * 100 : 0;

    return {
      sheetIndex,
      material,
      length: material.sheetLength,
      width: material.sheetWidth,
      placedParts,
      cutLines,
      leftovers,
      usedAreaM2: Number(usedAreaM2.toFixed(3)),
      wasteAreaM2: Number(wasteAreaM2.toFixed(3)),
      efficiencyPercent: Number(efficiencyPercent.toFixed(1)),
      cutLengthMeters: Number((cutLengthMm / 1000).toFixed(2))
    };
  }
}
