import { inject, Injectable } from '@angular/core';
import { Part, Material, ParametricCabinetConfig } from '../models/melamine.models';
import { CabinetGeneratorService } from './cabinet-generator.service';

export interface FurnitureTemplate {
  id: string;
  name: string;
  category: 'cajones' | 'cocina' | 'closets' | 'bano' | 'sala_tv' | 'oficina';
  categoryLabel: string;
  dimensions: { width: number; height: number; depth: number };
  description: string;
  icon: string;
  badge: string;
  partsCount: number;
  previewColor?: { top: string; body: string; front: string; accent?: string };
  isParametric?: boolean;
  parametricConfig?: Partial<ParametricCabinetConfig>;
  generateParts: (materials: Material[], offsetX?: number) => Part[];
}

@Injectable({
  providedIn: 'root'
})
export class TemplatesCatalogService {
  private cabinetGen = inject(CabinetGeneratorService);

  private getMaterial(materials: Material[], prefName: string): { id: string; name: string; thickness: number } {
    const found = materials.find(m => m.name.toLowerCase().includes(prefName.toLowerCase()));
    if (found) {
      return { id: found.id, name: found.name, thickness: found.thickness };
    }
    const def = materials[0] || { id: 'mat_default', name: 'Melamina Blanco Frost Mate', thickness: 15 };
    return { id: def.id, name: def.name, thickness: def.thickness };
  }

  /**
   * Generates a complete 5-piece internal drawer box with 1 external front plate.
   * STRICT JOINERY RULE: Only the front exterior plate is assigned `drawer_front` and hardware.
   * Internal parts (sides, back, inner-front, bottom) have `drawer_box` role and NO hardware,
   * preventing duplicate handles and slides.
   */
  private generateDrawerBoxParts(
    drawerIdPrefix: string,
    drawerName: string,
    frontWidth: number,
    frontHeight: number,
    carcassInnerWidth: number,
    availableDepth: number,
    posX: number,
    posY: number,
    posZ: number,
    matFront: { id: string; name: string; thickness: number },
    matBody: { id: string; name: string; thickness: number },
    matBottom: { id: string; name: string; thickness: number },
    t = 18
  ): Part[] {
    const standardLengths = [250, 300, 350, 400, 450, 500, 550, 600];
    const targetDepth = availableDepth - 35;
    const slideLength = standardLengths.filter(l => l <= targetDepth).pop() || 400;
    const boxHeight = Math.max(90, Math.min(Math.floor(frontHeight * 0.70), 180));
    const boxClearancePerSide = 12.7; // 1/2" side clearance for telescopic slides
    const boxOuterWidth = carcassInnerWidth - (boxClearancePerSide * 2);
    const boxInnerWidth = boxOuterWidth - (t * 2);
    const uid = crypto.randomUUID().slice(0, 6);

    return [
      // 1. Frente Exterior Decorativo (Front Facade)
      {
        id: `${drawerIdPrefix}_frente_${uid}`,
        name: `${drawerName} - Frente`,
        length: frontWidth,
        width: frontHeight,
        thickness: t,
        quantity: 1,
        materialId: matFront.id,
        materialName: matFront.name,
        grain: 'length',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX,
        posY,
        posZ,
        orientation: 'vertical_xy',
        componentRole: 'drawer_front',
        hardwareConfig: {
          isMovable: true,
          movableType: 'drawer',
          slideType: 'telescopic',
          handleType: 'bar_modern',
          handleFinish: 'brushed_steel',
          handlePosition: 'horizontal'
        }
      },
      // 2. Lateral Izquierdo de Cajón
      {
        id: `${drawerIdPrefix}_lat_izq_${uid}`,
        name: `${drawerName} - Lateral Izquierdo`,
        length: slideLength,
        width: boxHeight,
        thickness: t,
        quantity: 1,
        materialId: matBody.id,
        materialName: matBody.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: posX - (boxOuterWidth / 2) + (t / 2),
        posY: posY - ((frontHeight - boxHeight) * 0.15),
        posZ: posZ - (t / 2) - (slideLength / 2),
        orientation: 'vertical_yz',
        componentRole: 'drawer_box',
        hardwareConfig: {
          isMovable: false,
          movableType: 'none',
          slideType: 'none',
          handleType: 'none'
        }
      },
      // 3. Lateral Derecho de Cajón
      {
        id: `${drawerIdPrefix}_lat_der_${uid}`,
        name: `${drawerName} - Lateral Derecho`,
        length: slideLength,
        width: boxHeight,
        thickness: t,
        quantity: 1,
        materialId: matBody.id,
        materialName: matBody.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: posX + (boxOuterWidth / 2) - (t / 2),
        posY: posY - ((frontHeight - boxHeight) * 0.15),
        posZ: posZ - (t / 2) - (slideLength / 2),
        orientation: 'vertical_yz',
        componentRole: 'drawer_box',
        hardwareConfig: {
          isMovable: false,
          movableType: 'none',
          slideType: 'none',
          handleType: 'none'
        }
      },
      // 4. Trasera Interior de Cajón
      {
        id: `${drawerIdPrefix}_trasera_${uid}`,
        name: `${drawerName} - Trasera Interior`,
        length: boxInnerWidth,
        width: boxHeight,
        thickness: t,
        quantity: 1,
        materialId: matBody.id,
        materialName: matBody.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: posY - ((frontHeight - boxHeight) * 0.15),
        posZ: posZ - t - slideLength + (t / 2),
        orientation: 'vertical_xy',
        componentRole: 'drawer_box',
        hardwareConfig: {
          isMovable: false,
          movableType: 'none',
          slideType: 'none',
          handleType: 'none'
        }
      },
      // 5. Contrafrente / Frente Interior de Cajón
      {
        id: `${drawerIdPrefix}_frente_int_${uid}`,
        name: `${drawerName} - Contrafrente Interior`,
        length: boxInnerWidth,
        width: boxHeight,
        thickness: t,
        quantity: 1,
        materialId: matBody.id,
        materialName: matBody.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: posY - ((frontHeight - boxHeight) * 0.15),
        posZ: posZ - t - (t / 2),
        orientation: 'vertical_xy',
        componentRole: 'drawer_box',
        hardwareConfig: {
          isMovable: false,
          movableType: 'none',
          slideType: 'none',
          handleType: 'none'
        }
      },
      // 6. Fondo de Cajón (Tablero MDF)
      {
        id: `${drawerIdPrefix}_fondo_${uid}`,
        name: `${drawerName} - Fondo MDF`,
        length: boxOuterWidth - 10,
        width: slideLength - 10,
        thickness: 6,
        quantity: 1,
        materialId: matBottom.id,
        materialName: matBottom.name,
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: posY - (boxHeight / 2) + 8,
        posZ: posZ - (t / 2) - (slideLength / 2),
        orientation: 'horizontal',
        componentRole: 'drawer_box',
        hardwareConfig: {
          isMovable: false,
          movableType: 'none',
          slideType: 'none',
          handleType: 'none'
        }
      }
    ];
  }

  /**
   * The catalog is restricted to the 2 refined initial templates requested by the user:
   * 1. Cajonera de 3 Cajones (3 gavetas con despiece de 5 piezas, 1 tirador por frente, correderas en costados)
   * 2. Módulo Bajo de Cocina con 1 Puerta y Repisa (módulo estándar de 600mm)
   */
  readonly templates: FurnitureTemplate[] = [
    // --- 1. CAJONERA DE 3 CAJONES ---
    {
      id: 'cajonera_3_cajones',
      name: 'Cajonera de 3 Cajones',
      category: 'cajones',
      categoryLabel: 'Cajoneras',
      dimensions: { width: 600, height: 750, depth: 500 },
      description: 'Cajonera independiente de 3 gavetas con correderas telescópicas en costados, cajas interiores de 5 piezas y tiradores centrados.',
      icon: 'table_rows',
      badge: '3 Cajones',
      partsCount: 27, // 9 piezas de mueble (tapa, 2 lados, piso, fondo, 4 zócalos) + (6 piezas x 3 gavetas) = 27 piezas
      previewColor: { top: '#b45309', body: '#f8fafc', front: '#f1f5f9', accent: '#64748b' },
      isParametric: true,
      parametricConfig: {
        category: 'drawers',
        moduleType: 'drawer_unit',
        name: 'Cajonera de 3 Cajones',
        width: 600,
        height: 750,
        depth: 500,
        structureThickness: 15,
        doorThickness: 15,
        drawersCount: 3,
        drawerSlideType: 'telescopic',
        drawerFrontType: 'overlay',
        hasPlinth: true,
        plinthHeight: 70,
        hasTopCover: true,
        hasBackPanel: true,
        backType: 'groove',
        hasHandle: true,
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        handlePosition: 'horizontal'
      },
      generateParts: (mats, offsetX = 0) => {
        const matBody = this.getMaterial(mats, 'blanco');
        const cfg: ParametricCabinetConfig = {
          code: 'CAJ3P',
          category: 'drawers',
          moduleType: 'drawer_unit',
          name: 'Cajonera de 3 Cajones',
          width: 600,
          height: 750,
          depth: 500,
          structureThickness: matBody.thickness || 15,
          doorThickness: 15,
          backThickness: 3,
          backType: 'groove',
          shelvesCount: 0,
          doorOpening: 'none',
          facadeGap: 3,
          structureMaterialId: matBody.id,
          doorMaterialId: matBody.id,
          backMaterialId: matBody.id,
          drawersCount: 3,
          drawerSlideType: 'telescopic',
          drawerFrontType: 'overlay',
          hasPlinth: true,
          plinthHeight: 70,
          hasTopCover: true,
          hasBackPanel: true,
          hasHandle: true,
          handleType: 'bar_modern',
          handleFinish: 'brushed_steel',
          handlePosition: 'horizontal',
          posX: offsetX,
          posY: 375,
          posZ: 0
        };
        return this.cabinetGen.generateParametricCabinet(cfg, mats).parts;
      }
    },

    // --- 2. MÓDULO BAJO DE COCINA CON 1 PUERTA Y REPISA ---
    {
      id: 'modulo_bajo_cocina_1_puerta',
      name: 'Módulo Bajo Cocina (1 Puerta y Repisa)',
      category: 'cocina',
      categoryLabel: 'Cocina',
      dimensions: { width: 600, height: 850, depth: 600 },
      description: 'Módulo estándar bajo de cocina de 600mm con zócalo de 100mm, puerta batiente con tirador metálico, bisagras de cazoleta de Ø35mm y repisa regulable.',
      icon: 'countertops',
      badge: 'Cocina Estándar',
      partsCount: 9,
      previewColor: { top: '#334155', body: '#ffffff', front: '#f8fafc', accent: '#0284c7' },
      isParametric: true,
      parametricConfig: {
        category: 'kitchen_base',
        moduleType: 'base_cabinet',
        name: 'Módulo Bajo Cocina (1 Puerta y Repisa)',
        width: 600,
        height: 850,
        depth: 600,
        structureThickness: 15,
        doorThickness: 15,
        doorOpening: 'left',
        shelvesCount: 1,
        hasHandle: true,
        handleType: 'bar_modern',
        hasBackPanel: true,
        hasPlinth: true,
        plinthHeight: 100
      },
      generateParts: (mats, offsetX = 0) => {
        const matBody = this.getMaterial(mats, 'blanco');
        const matDoor = this.getMaterial(mats, 'blanco');
        const matBottom = this.getMaterial(mats, 'mdf') || { id: 'mat_mdf_6', name: 'MDF 6mm', thickness: 6 };
        const t = matBody.thickness || 15;
        const width = 600;
        const height = 850;
        const depth = 600;
        const zocaloH = 100;
        const carcassDepth = depth - 20; // 580 mm
        const carcassInnerWidth = width - (2 * t); // 564 mm
        const carcassHeight = height - zocaloH; // 750 mm

        return [
          // Lateral Izquierdo
          {
            id: 'coc1_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'Lateral Izquierdo',
            length: carcassHeight,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX - (width / 2) + (t / 2),
            posY: zocaloH + (carcassHeight / 2),
            posZ: 0,
            orientation: 'vertical_yz',
            componentRole: 'side_left'
          },
          // Lateral Derecho
          {
            id: 'coc1_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'Lateral Derecho',
            length: carcassHeight,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX + (width / 2) - (t / 2),
            posY: zocaloH + (carcassHeight / 2),
            posZ: 0,
            orientation: 'vertical_yz',
            componentRole: 'side_right'
          },
          // Piso Inferior
          {
            id: 'coc1_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'Piso Inferior',
            length: carcassInnerWidth,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: zocaloH + (t / 2),
            posZ: 0,
            orientation: 'horizontal',
            componentRole: 'bottom'
          },
          // Zócalo Frontal
          {
            id: 'coc1_zocalo_' + crypto.randomUUID().slice(0, 6),
            name: 'Zócalo Frontal',
            length: carcassInnerWidth,
            width: zocaloH,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: zocaloH / 2,
            posZ: (carcassDepth / 2) - 30,
            orientation: 'vertical_xy',
            componentRole: 'plinth'
          },
          // Faja Superior Delantera (Travesaño de amarre)
          {
            id: 'coc1_faja_del_' + crypto.randomUUID().slice(0, 6),
            name: 'Faja Amarre Delantera',
            length: carcassInnerWidth,
            width: 80,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: height - (t / 2),
            posZ: (carcassDepth / 2) - 40,
            orientation: 'horizontal',
            componentRole: 'top'
          },
          // Faja Superior Trasera (Travesaño de amarre)
          {
            id: 'coc1_faja_tras_' + crypto.randomUUID().slice(0, 6),
            name: 'Faja Amarre Trasera',
            length: carcassInnerWidth,
            width: 80,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: height - (t / 2),
            posZ: - (carcassDepth / 2) + 40,
            orientation: 'horizontal',
            componentRole: 'top'
          },
          // Repisa Intermedia Regulable
          {
            id: 'coc1_repisa_' + crypto.randomUUID().slice(0, 6),
            name: 'Repisa Regulable',
            length: carcassInnerWidth - 2, // 562 mm (holgura técnica)
            width: carcassDepth - 30, // 550 mm
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: zocaloH + (carcassHeight / 2),
            posZ: 0,
            orientation: 'horizontal',
            componentRole: 'shelf'
          },
          // Fondo Trasera MDF
          {
            id: 'coc1_fondo_mdf_' + crypto.randomUUID().slice(0, 6),
            name: 'Fondo Trasera MDF',
            length: carcassInnerWidth,
            width: carcassHeight - t,
            thickness: 6,
            quantity: 1,
            materialId: matBottom.id,
            materialName: matBottom.name,
            grain: 'none',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: zocaloH + t + ((carcassHeight - t) / 2),
            posZ: - (carcassDepth / 2) + 5,
            orientation: 'vertical_xy',
            componentRole: 'back'
          },
          // Puerta Batiente Frontal (con 2 bisagras cazoleta Ø35mm y tirador vertical)
          {
            id: 'coc1_puerta_' + crypto.randomUUID().slice(0, 6),
            name: 'Puerta Batiente',
            length: width - 4, // 596 mm
            width: carcassHeight - 4, // 746 mm
            thickness: t,
            quantity: 1,
            materialId: matDoor.id,
            materialName: matDoor.name,
            grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX,
            posY: zocaloH + (carcassHeight / 2),
            posZ: (carcassDepth / 2) + (t / 2),
            orientation: 'vertical_xy',
            componentRole: 'door',
            hardwareConfig: {
              isMovable: true,
              movableType: 'door',
              openingDirection: 'left',
              hingeType: 'straight',
              handleType: 'bar_modern',
              handleFinish: 'brushed_steel',
              handlePosition: 'vertical'
            }
          }
        ];
      }
    },

    // --- 3. MÓDULO ALTO DE COCINA 1 PUERTA (PARAMÉTRICO MELAMINA PRO) ---
    {
      id: 'modulo_alto_cocina_1_puerta',
      name: 'Módulo Alto Cocina 1P (MAL1PU001)',
      category: 'cocina',
      categoryLabel: 'Cocinas',
      dimensions: { width: 600, height: 800, depth: 320 },
      description: 'Alacena superior de cocina 1 puerta batiente o elevable (pistón a gas). Medidas, repisas, espesores y sentido de apertura totalmente configurables.',
      icon: 'kitchen',
      badge: 'Alacena Dinámica',
      partsCount: 7,
      previewColor: { top: '#cbd5e1', body: '#ffffff', front: '#e2e8f0', accent: '#4f46e5' },
      isParametric: true,
      parametricConfig: {
        code: 'MAL1PU001',
        name: 'Módulo Alto 1 Puerta (MAL-1P)',
        moduleType: 'wall_cabinet',
        width: 600,
        height: 800,
        depth: 320,
        structureThickness: 15,
        doorThickness: 15,
        backThickness: 3,
        shelvesCount: 1,
        doorOpening: 'left',
        facadeGap: 3
      },
      generateParts: (mats, offsetX = 0) => {
        const matBody = this.getMaterial(mats, 'blanco');
        const matDoor = this.getMaterial(mats, 'roble') || matBody;
        const matBottom = this.getMaterial(mats, 'mdf') || { id: 'mat_mdf_3', name: 'MDF 3mm', thickness: 3 };
        const t = matBody.thickness || 15;
        const w = 600;
        const h = 800;
        const d = 320;
        const doorT = 15;
        const carcassDepth = d - doorT;
        const innerW = w - (2 * t);
        const posY = 1450 + (h / 2);
        const carcassCenterZ = -(doorT / 2);

        return [
          {
            id: 'alt1_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'Lateral Izquierdo',
            length: h,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX - (w / 2) + (t / 2),
            posY,
            posZ: carcassCenterZ,
            orientation: 'vertical_yz',
            componentRole: 'side_left'
          },
          {
            id: 'alt1_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'Lateral Derecho',
            length: h,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX + (w / 2) - (t / 2),
            posY,
            posZ: carcassCenterZ,
            orientation: 'vertical_yz',
            componentRole: 'side_right'
          },
          {
            id: 'alt1_techo_' + crypto.randomUUID().slice(0, 6),
            name: 'Techo Superior',
            length: innerW,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: posY + (h / 2) - (t / 2),
            posZ: carcassCenterZ,
            orientation: 'horizontal',
            componentRole: 'top'
          },
          {
            id: 'alt1_base_' + crypto.randomUUID().slice(0, 6),
            name: 'Piso Inferior',
            length: innerW,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: posY - (h / 2) + (t / 2),
            posZ: carcassCenterZ,
            orientation: 'horizontal',
            componentRole: 'bottom'
          },
          {
            id: 'alt1_repisa_' + crypto.randomUUID().slice(0, 6),
            name: 'Repisa Central',
            length: innerW - 2,
            width: carcassDepth - 15,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY,
            posZ: carcassCenterZ - 7.5,
            orientation: 'horizontal',
            componentRole: 'shelf'
          },
          {
            id: 'alt1_fondo_' + crypto.randomUUID().slice(0, 6),
            name: 'Fondo MDF 3mm',
            length: w - 4,
            width: h - 4,
            thickness: 3,
            quantity: 1,
            materialId: matBottom.id,
            materialName: matBottom.name,
            grain: 'none',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY,
            posZ: - (d / 2) + 1.5,
            orientation: 'vertical_xy',
            componentRole: 'back'
          },
          {
            id: 'alt1_puerta_' + crypto.randomUUID().slice(0, 6),
            name: 'Puerta Frontal (Alacena)',
            length: w - 3,
            width: h - 3,
            thickness: doorT,
            quantity: 1,
            materialId: matDoor.id,
            materialName: matDoor.name,
            grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX,
            posY,
            posZ: (d / 2) - (doorT / 2),
            orientation: 'vertical_xy',
            componentRole: 'door',
            hardwareConfig: {
              isMovable: true,
              movableType: 'door',
              openingDirection: 'left',
              hingeType: 'straight',
              handleType: 'bar_modern',
              handleFinish: 'brushed_steel',
              handlePosition: 'vertical'
            }
          }
        ];
      }
    },

    // --- 4. MÓDULO CLOSET ROPERO 1 PUERTA ---
    {
      id: 'closet_ropero_1_puerta',
      name: 'Módulo Closet Ropero (1 Puerta y Repisas)',
      category: 'closets',
      categoryLabel: 'Closets',
      dimensions: { width: 500, height: 1900, depth: 550 },
      description: 'Módulo vertical para armario o closet con puerta completa, 3 repisas interiores de guardado y zócalo de piso.',
      icon: 'door_sliding',
      badge: 'Ropero 1P',
      partsCount: 9,
      previewColor: { top: '#e2e8f0', body: '#ffffff', front: '#cbd5e1', accent: '#059669' },
      generateParts: (mats, offsetX = 0) => {
        const matBody = this.getMaterial(mats, 'blanco');
        const matDoor = this.getMaterial(mats, 'roble') || matBody;
        const matBottom = this.getMaterial(mats, 'mdf') || { id: 'mat_mdf_3', name: 'MDF 3mm', thickness: 3 };
        const t = matBody.thickness || 15;
        const w = 500;
        const h = 1900;
        const d = 550;
        const zocalo = 80;
        const carcassH = h - zocalo;
        const innerW = w - (2 * t);
        const carcassDepth = d - 20;

        return [
          {
            id: 'clo1_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'Lateral Izquierdo Closet',
            length: carcassH,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX - (w / 2) + (t / 2),
            posY: zocalo + (carcassH / 2),
            posZ: 0,
            orientation: 'vertical_yz',
            componentRole: 'side_left'
          },
          {
            id: 'clo1_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'Lateral Derecho Closet',
            length: carcassH,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX + (w / 2) - (t / 2),
            posY: zocalo + (carcassH / 2),
            posZ: 0,
            orientation: 'vertical_yz',
            componentRole: 'side_right'
          },
          {
            id: 'clo1_techo_' + crypto.randomUUID().slice(0, 6),
            name: 'Techo Closet',
            length: innerW,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: h - (t / 2),
            posZ: 0,
            orientation: 'horizontal',
            componentRole: 'top'
          },
          {
            id: 'clo1_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'Piso Closet',
            length: innerW,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: zocalo + (t / 2),
            posZ: 0,
            orientation: 'horizontal',
            componentRole: 'bottom'
          },
          {
            id: 'clo1_zocalo_' + crypto.randomUUID().slice(0, 6),
            name: 'Zócalo Frontal',
            length: innerW,
            width: zocalo,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: zocalo / 2,
            posZ: (carcassDepth / 2) - (t / 2),
            orientation: 'vertical_xy',
            componentRole: 'plinth'
          },
          {
            id: 'clo1_fondo_' + crypto.randomUUID().slice(0, 6),
            name: 'Fondo Trasero MDF',
            length: w - 4,
            width: carcassH - 4,
            thickness: 3,
            quantity: 1,
            materialId: matBottom.id,
            materialName: matBottom.name,
            grain: 'none',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: zocalo + (carcassH / 2),
            posZ: - (carcassDepth / 2) + 1.5,
            orientation: 'vertical_xy',
            componentRole: 'back'
          },
          {
            id: 'clo1_puerta_' + crypto.randomUUID().slice(0, 6),
            name: 'Puerta Closet (1900)',
            length: w - 4,
            width: carcassH - 4,
            thickness: t,
            quantity: 1,
            materialId: matDoor.id,
            materialName: matDoor.name,
            grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX,
            posY: zocalo + (carcassH / 2),
            posZ: (carcassDepth / 2) + (t / 2),
            orientation: 'vertical_xy',
            componentRole: 'door',
            hardwareConfig: {
              isMovable: true,
              movableType: 'door',
              openingDirection: 'left',
              hingeType: 'straight',
              handleType: 'bar_modern',
              handleFinish: 'black',
              handlePosition: 'vertical'
            }
          }
        ];
      }
    },

    // --- 5. VANITORY FLOTANTE DE BAÑO 1 PUERTA ---
    {
      id: 'vanitory_bano_1_puerta',
      name: 'Vanitory Flotante Baño (1 Puerta)',
      category: 'bano',
      categoryLabel: 'Baños',
      dimensions: { width: 500, height: 500, depth: 400 },
      description: 'Mueble suspendido para baño con puerta frontal abatible, espacio libre inferior y paso para desagüe.',
      icon: 'bathtub',
      badge: 'Baño Suspendido',
      partsCount: 6,
      previewColor: { top: '#0f766e', body: '#ffffff', front: '#ccfbf1', accent: '#0d9488' },
      generateParts: (mats, offsetX = 0) => {
        const matBody = this.getMaterial(mats, 'blanco');
        const matDoor = this.getMaterial(mats, 'blanco');
        const t = matBody.thickness || 15;
        const w = 500;
        const h = 500;
        const d = 400;
        const elev = 350; // Suspendido a 350mm del suelo
        const innerW = w - (2 * t);
        const carcassDepth = d - 20;

        return [
          {
            id: 'van1_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'Lateral Izquierdo Vanitory',
            length: h,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thick', l2: 'none', a1: 'thick', a2: 'thick' },
            posX: offsetX - (w / 2) + (t / 2),
            posY: elev + (h / 2),
            posZ: 0,
            orientation: 'vertical_yz',
            componentRole: 'side_left'
          },
          {
            id: 'van1_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'Lateral Derecho Vanitory',
            length: h,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thick', l2: 'none', a1: 'thick', a2: 'thick' },
            posX: offsetX + (w / 2) - (t / 2),
            posY: elev + (h / 2),
            posZ: 0,
            orientation: 'vertical_yz',
            componentRole: 'side_right'
          },
          {
            id: 'van1_piso_' + crypto.randomUUID().slice(0, 6),
            name: 'Piso Vanitory',
            length: innerW,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thick', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: elev + (t / 2),
            posZ: 0,
            orientation: 'horizontal',
            componentRole: 'bottom'
          },
          {
            id: 'van1_amarre_' + crypto.randomUUID().slice(0, 6),
            name: 'Amarre Trasero Pared',
            length: innerW,
            width: 100,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: elev + h - 50,
            posZ: - (carcassDepth / 2) + (t / 2),
            orientation: 'vertical_xy',
            componentRole: 'tie'
          },
          {
            id: 'van1_puerta_' + crypto.randomUUID().slice(0, 6),
            name: 'Puerta Vanitory',
            length: w - 4,
            width: h - 4,
            thickness: t,
            quantity: 1,
            materialId: matDoor.id,
            materialName: matDoor.name,
            grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX,
            posY: elev + (h / 2),
            posZ: (carcassDepth / 2) + (t / 2),
            orientation: 'vertical_xy',
            componentRole: 'door',
            hardwareConfig: {
              isMovable: true,
              movableType: 'door',
              openingDirection: 'left',
              hingeType: 'straight',
              handleType: 'bar_modern',
              handleFinish: 'chrome',
              handlePosition: 'vertical'
            }
          }
        ];
      }
    },

    // --- ESPECIALIZADOS DE COCINA REAL (CLICK-CUISINE PRO) ---
    {
      id: 'modulo_bajo_horno_60',
      name: 'Módulo Bajo para Horno Empotrado 60cm',
      category: 'cocina',
      categoryLabel: 'Cocinas',
      dimensions: { width: 600, height: 860, depth: 580 },
      description: 'Módulo bajo técnico con nicho ventilado de 595mm para horno empotrable, amarres superiores para estufa/inducción y gaveta abatible inferior para bandejas.',
      icon: 'microwave',
      badge: 'Nicho Horno 60cm',
      partsCount: 9,
      previewColor: { top: '#1e293b', body: '#f8fafc', front: '#e2e8f0', accent: '#f97316' },
      isParametric: true,
      parametricConfig: {
        code: 'MBH600',
        name: 'Módulo Bajo Horno 60cm',
        moduleType: 'base_cabinet',
        category: 'oven_base',
        width: 600,
        height: 860,
        depth: 580,
        structureThickness: 15,
        doorThickness: 15,
        backThickness: 3,
        backType: 'none',
        shelvesCount: 1,
        doorOpening: 'bottom',
        hasPlinth: true,
        plinthHeight: 80,
        hasHandle: true,
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3
      },
      generateParts: (mats, offsetX = 0) => {
        const matBody = this.getMaterial(mats, 'blanco');
        const cfg: ParametricCabinetConfig = {
          code: 'MBH600',
          name: 'Módulo Bajo Horno 60cm',
          moduleType: 'base_cabinet',
          category: 'oven_base',
          width: 600,
          height: 860,
          depth: 580,
          structureThickness: matBody.thickness || 15,
          doorThickness: 15,
          backThickness: 3,
          backType: 'none',
          shelvesCount: 1,
          doorOpening: 'bottom',
          structureMaterialId: matBody.id,
          doorMaterialId: matBody.id,
          backMaterialId: matBody.id,
          hasPlinth: true,
          plinthHeight: 80,
          hasHandle: true,
          handleType: 'bar_modern',
          handleFinish: 'brushed_steel',
          facadeGap: 3,
          posX: offsetX,
          posY: 430,
          posZ: 0
        };
        return this.cabinetGen.generateParametricCabinet(cfg, mats).parts;
      }
    },

    {
      id: 'modulo_bajo_lavaplatos_80',
      name: 'Módulo Bajo Lavaplatos 2 Puertas 80cm',
      category: 'cocina',
      categoryLabel: 'Cocinas',
      dimensions: { width: 800, height: 860, depth: 580 },
      description: 'Módulo húmedo bajo mesada sin tapa maciza superior (con fajas estructurales frontal y trasera) y respaldo libre para caída del pozo del lavaplatos y sifón.',
      icon: 'wash',
      badge: 'Zona Húmeda 80cm',
      partsCount: 9,
      previewColor: { top: '#0284c7', body: '#ffffff', front: '#f1f5f9', accent: '#38bdf8' },
      isParametric: true,
      parametricConfig: {
        code: 'MBL800',
        name: 'Módulo Bajo Lavaplatos 80cm',
        moduleType: 'base_cabinet',
        category: 'sink_base',
        width: 800,
        height: 860,
        depth: 580,
        structureThickness: 15,
        doorThickness: 15,
        backThickness: 3,
        backType: 'none',
        shelvesCount: 0,
        doorOpening: 'double',
        hasPlinth: true,
        plinthHeight: 80,
        hasHandle: true,
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3
      },
      generateParts: (mats, offsetX = 0) => {
        const matBody = this.getMaterial(mats, 'blanco');
        const cfg: ParametricCabinetConfig = {
          code: 'MBL800',
          name: 'Módulo Bajo Lavaplatos 80cm',
          moduleType: 'base_cabinet',
          category: 'sink_base',
          width: 800,
          height: 860,
          depth: 580,
          structureThickness: matBody.thickness || 15,
          doorThickness: 15,
          backThickness: 3,
          backType: 'none',
          shelvesCount: 0,
          doorOpening: 'double',
          structureMaterialId: matBody.id,
          doorMaterialId: matBody.id,
          backMaterialId: matBody.id,
          hasPlinth: true,
          plinthHeight: 80,
          hasHandle: true,
          handleType: 'bar_modern',
          handleFinish: 'brushed_steel',
          facadeGap: 3,
          posX: offsetX,
          posY: 430,
          posZ: 0
        };
        return this.cabinetGen.generateParametricCabinet(cfg, mats).parts;
      }
    },

    {
      id: 'modulo_bajo_esquinero_45',
      name: 'Módulo Bajo Esquinero Diagonal 45° (90x90cm)',
      category: 'cocina',
      categoryLabel: 'Cocinas',
      dimensions: { width: 900, height: 860, depth: 900 },
      description: 'Módulo esquinero en chaflán a 45° con piso, entrepaño y tapa superior recortados poligonalmente para cocinas en L o en U.',
      icon: 'rounded_corner',
      badge: 'Esquinero 45°',
      partsCount: 8,
      previewColor: { top: '#4f46e5', body: '#f8fafc', front: '#e0e7ff', accent: '#6366f1' },
      isParametric: true,
      parametricConfig: {
        code: 'MBE900',
        name: 'Módulo Esquinero Diagonal 45°',
        moduleType: 'base_cabinet',
        category: 'corner_base',
        width: 900,
        height: 860,
        depth: 900,
        structureThickness: 15,
        doorThickness: 15,
        backThickness: 3,
        backType: 'none',
        shelvesCount: 1,
        doorOpening: 'left',
        hasPlinth: true,
        plinthHeight: 80,
        hasHandle: true,
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3
      },
      generateParts: (mats, offsetX = 0) => {
        const matBody = this.getMaterial(mats, 'blanco');
        const cfg: ParametricCabinetConfig = {
          code: 'MBE900',
          name: 'Módulo Esquinero Diagonal 45°',
          moduleType: 'base_cabinet',
          category: 'corner_base',
          width: 900,
          height: 860,
          depth: 900,
          structureThickness: matBody.thickness || 15,
          doorThickness: 15,
          backThickness: 3,
          backType: 'none',
          shelvesCount: 1,
          doorOpening: 'left',
          structureMaterialId: matBody.id,
          doorMaterialId: matBody.id,
          backMaterialId: matBody.id,
          hasPlinth: true,
          plinthHeight: 80,
          hasHandle: true,
          handleType: 'bar_modern',
          handleFinish: 'brushed_steel',
          facadeGap: 3,
          posX: offsetX,
          posY: 430,
          posZ: 0
        };
        return this.cabinetGen.generateParametricCabinet(cfg, mats).parts;
      }
    },

    {
      id: 'torre_hornos_microondas_60',
      name: 'Torre Columna de Horno y Microondas 60x215cm',
      category: 'cocina',
      categoryLabel: 'Cocinas',
      dimensions: { width: 600, height: 2150, depth: 580 },
      description: 'Columna alta ergonómica con puerta inferior de despensa, nicho central para horno de 60cm, nicho para microondas empotrado y alacena superior elevable.',
      icon: 'kitchen',
      badge: 'Torre de Hornos',
      partsCount: 11,
      previewColor: { top: '#1e293b', body: '#f8fafc', front: '#cbd5e1', accent: '#ea580c' },
      isParametric: true,
      parametricConfig: {
        code: 'THM6021',
        name: 'Torre Horno + Microondas 60cm',
        moduleType: 'tall_cabinet',
        category: 'oven_tower',
        width: 600,
        height: 2150,
        depth: 580,
        structureThickness: 15,
        doorThickness: 15,
        backThickness: 3,
        backType: 'groove',
        shelvesCount: 3,
        doorOpening: 'left',
        hasPlinth: true,
        plinthHeight: 80,
        hasHandle: true,
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3
      },
      generateParts: (mats, offsetX = 0) => {
        const matBody = this.getMaterial(mats, 'blanco');
        const cfg: ParametricCabinetConfig = {
          code: 'THM6021',
          name: 'Torre Horno + Microondas 60cm',
          moduleType: 'tall_cabinet',
          category: 'oven_tower',
          width: 600,
          height: 2150,
          depth: 580,
          structureThickness: matBody.thickness || 15,
          doorThickness: 15,
          backThickness: 3,
          backType: 'groove',
          shelvesCount: 3,
          doorOpening: 'left',
          structureMaterialId: matBody.id,
          doorMaterialId: matBody.id,
          backMaterialId: matBody.id,
          hasPlinth: true,
          plinthHeight: 80,
          hasHandle: true,
          handleType: 'bar_modern',
          handleFinish: 'brushed_steel',
          facadeGap: 3,
          posX: offsetX,
          posY: 1075,
          posZ: 0
        };
        return this.cabinetGen.generateParametricCabinet(cfg, mats).parts;
      }
    }
  ];

  getCategories() {
    return [
      { id: 'all', label: 'Todas las Plantillas', icon: 'auto_stories', count: this.templates.length },
      { id: 'cocina', label: 'Cocinas', icon: 'kitchen', count: this.templates.filter(t => t.category === 'cocina').length },
      { id: 'closets', label: 'Closets y Armarios', icon: 'door_sliding', count: this.templates.filter(t => t.category === 'closets').length },
      { id: 'bano', label: 'Baños', icon: 'bathtub', count: this.templates.filter(t => t.category === 'bano').length },
      { id: 'cajones', label: 'Cajoneras y Gavetas', icon: 'table_rows', count: this.templates.filter(t => t.category === 'cajones').length }
    ];
  }

  getTemplateById(id: string): FurnitureTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }

  calculateTemplateOffset(existingParts: Part[], templateWidth: number): number {
    if (!existingParts || existingParts.length === 0) return 0;
    
    let maxX = -Infinity;
    for (const part of existingParts) {
      let halfW = 0;
      if (part.orientation === 'horizontal' || part.orientation === 'vertical_xy') {
        halfW = (part.length || 0) / 2;
      } else {
        halfW = (part.thickness || 15) / 2;
      }
      const rightEdge = (part.posX || 0) + halfW;
      if (rightEdge > maxX) maxX = rightEdge;
    }

    if (maxX === -Infinity) return 0;
    return Math.round(maxX + (templateWidth / 2) + 200); // 200 mm clearance between furniture
  }
}
