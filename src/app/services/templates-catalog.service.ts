import { Injectable } from '@angular/core';
import { Part, Material, ParametricCabinetConfig } from '../models/melamine.models';

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

  private getMaterial(materials: Material[], prefName: string): { id: string; name: string; thickness: number } {
    const found = materials.find(m => m.name.toLowerCase().includes(prefName.toLowerCase()));
    if (found) {
      return { id: found.id, name: found.name, thickness: found.thickness };
    }
    const def = materials[0] || { id: 'mat_default', name: 'Melamina Blanco Frost Mate', thickness: 18 };
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
    frontCenterY: number,
    frontCenterZ: number,
    slotMinY: number,
    slotMaxY: number,
    matFront: { id: string; name: string; thickness: number },
    matBody: { id: string; name: string; thickness: number },
    matBottom: { id: string; name: string; thickness: number },
    t = 18
  ): Part[] {
    const standardLengths = [250, 300, 350, 400, 450, 500, 550, 600];
    const targetDepth = availableDepth - 25;
    const slideLength = standardLengths.filter(l => l <= targetDepth).pop() || 400;

    const bottomT = Math.min(6, matBottom.thickness || 3);
    const boxSideT = Math.min(t, 15);
    const availableSlotH = Math.max(60, slotMaxY - slotMinY);
    const boxHeight = Math.max(55, Math.min(180, availableSlotH - bottomT - 6));

    const boxClearancePerSide = 13; // 13mm side clearance per side for telescopic slides (26mm total)
    const boxOuterWidth = carcassInnerWidth - boxClearancePerSide * 2;
    const boxInnerWidth = boxOuterWidth - boxSideT * 2;

    const boxBottomCenterY = slotMinY + bottomT / 2;
    const boxSidesCenterY = slotMinY + bottomT + boxHeight / 2;

    // Box starts 2mm behind the back face of the front facade so there is zero overlap
    const boxFrontEdgeZ = frontCenterZ - t / 2 - 2;
    const boxCenterZ = boxFrontEdgeZ - slideLength / 2;
    const boxInnerFrontCenterZ = boxFrontEdgeZ - boxSideT / 2;
    const boxRearCenterZ = boxFrontEdgeZ - slideLength + boxSideT / 2;

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
        posY: frontCenterY,
        posZ: frontCenterZ,
        orientation: 'vertical_xy',
        componentRole: 'drawer_front',
        hardwareConfig: {
          isMovable: true,
          movableType: 'drawer',
          slideType: 'telescopic',
          slideClearancePerSide: boxClearancePerSide,
          slideLength,
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
        thickness: boxSideT,
        quantity: 1,
        materialId: matBody.id,
        materialName: matBody.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: posX - boxOuterWidth / 2 + boxSideT / 2,
        posY: boxSidesCenterY,
        posZ: boxCenterZ,
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
        thickness: boxSideT,
        quantity: 1,
        materialId: matBody.id,
        materialName: matBody.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: posX + boxOuterWidth / 2 - boxSideT / 2,
        posY: boxSidesCenterY,
        posZ: boxCenterZ,
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
        thickness: boxSideT,
        quantity: 1,
        materialId: matBody.id,
        materialName: matBody.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: boxSidesCenterY,
        posZ: boxRearCenterZ,
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
        thickness: boxSideT,
        quantity: 1,
        materialId: matBody.id,
        materialName: matBody.name,
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: boxSidesCenterY,
        posZ: boxInnerFrontCenterZ,
        orientation: 'vertical_xy',
        componentRole: 'drawer_box',
        hardwareConfig: {
          isMovable: false,
          movableType: 'none',
          slideType: 'none',
          handleType: 'none'
        }
      },
      // 6. Fondo de Cajón (Tablero MDF apoyado en la base de la caja sin solapar laterales)
      {
        id: `${drawerIdPrefix}_fondo_${uid}`,
        name: `${drawerName} - Fondo MDF`,
        length: boxOuterWidth,
        width: slideLength,
        thickness: bottomT,
        quantity: 1,
        materialId: matBottom.id,
        materialName: matBottom.name,
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: boxBottomCenterY,
        posZ: boxCenterZ,
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
   * The catalog templates include full parametric metadata and zero-overlap 3D assembly.
   */
  readonly templates: FurnitureTemplate[] = [
    // --- 1. CAJONERA DE 3 CAJONES ---
    {
      id: 'cajonera_3_cajones',
      name: 'Cajonera de 3 Cajones',
      category: 'cajones',
      categoryLabel: 'Cajoneras',
      dimensions: { width: 600, height: 750, depth: 500 },
      description: 'Cajonera modular de 3 gavetas con correderas telescópicas en costados, cajas interiores de 5 piezas sin solapamientos y tiradores centrados.',
      icon: 'table_rows',
      badge: '3 Cajones Paramétrica',
      partsCount: 24,
      previewColor: { top: '#b45309', body: '#f8fafc', front: '#f1f5f9', accent: '#64748b' },
      isParametric: true,
      parametricConfig: {
        code: 'CAJ3GAV001',
        name: 'Cajonera de 3 Cajones',
        moduleType: 'drawer_unit',
        category: 'drawer_unit',
        width: 600,
        height: 750,
        depth: 500,
        structureThickness: 18,
        doorThickness: 18,
        backThickness: 3,
        backType: 'groove',
        hasBackPanel: true,
        shelvesCount: 0,
        doorOpening: 'none',
        hasHandle: true,
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        handlePosition: 'horizontal',
        drawersCount: 3,
        drawerDistribution: 'uniform',
        slideType: 'telescopic',
        hasPlinth: true,
        plinthHeight: 70,
        facadeGap: 3
      },
      generateParts: (mats, offsetX = 0) => {
        const matBody = this.getMaterial(mats, 'blanco');
        const matTop = this.getMaterial(mats, 'roble');
        const matBottom = this.getMaterial(mats, 'durolac') || this.getMaterial(mats, 'mdf') || { id: 'mat_mdf_3', name: 'MDF Durolac Blanco', thickness: 3 };
        const t = matBody.thickness || 18;
        const backT = Math.min(6, matBottom.thickness || 3);
        const width = 600;
        const height = 750;
        const depth = 500;
        const plinthH = 70;
        const carcassInnerWidth = width - 2 * t; // 564 mm
        const carcassDepth = depth - t; // 482 mm
        const carcassCenterZ = -t / 2;
        const carcassBackZ = carcassCenterZ - carcassDepth / 2;
        const carcassFrontZ = carcassCenterZ + carcassDepth / 2;
        const innerH = height - plinthH - 2 * t;

        const carcassParts: Part[] = [
          // Lateral Izquierdo (Altura completa)
          {
            id: 'caj3_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'Lateral Izquierdo',
            length: height,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX - width / 2 + t / 2,
            posY: height / 2,
            posZ: carcassCenterZ,
            orientation: 'vertical_yz',
            componentRole: 'side_left'
          },
          // Lateral Derecho (Altura completa)
          {
            id: 'caj3_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'Lateral Derecho',
            length: height,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX + width / 2 - t / 2,
            posY: height / 2,
            posZ: carcassCenterZ,
            orientation: 'vertical_yz',
            componentRole: 'side_right'
          },
          // Techo / Tapa Superior (Entre laterales, sin solapar)
          {
            id: 'caj3_tapa_' + crypto.randomUUID().slice(0, 6),
            name: 'Techo Superior',
            length: carcassInnerWidth,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matTop.id,
            materialName: matTop.name,
            grain: 'length',
            edges: { l1: 'thick', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: height - t / 2,
            posZ: carcassCenterZ,
            orientation: 'horizontal',
            componentRole: 'top'
          },
          // Piso Inferior (Sobre zócalo de 70mm, entre laterales)
          {
            id: 'caj3_piso_' + crypto.randomUUID().slice(0, 6),
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
            posY: plinthH + t / 2,
            posZ: carcassCenterZ,
            orientation: 'horizontal',
            componentRole: 'bottom'
          },
          // Zócalo Frontal (Debajo del piso inferior, cero solapamiento)
          {
            id: 'caj3_zocalo_' + crypto.randomUUID().slice(0, 6),
            name: 'Zócalo Frontal',
            length: carcassInnerWidth,
            width: plinthH,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: plinthH / 2,
            posZ: carcassFrontZ - 15 - t / 2,
            orientation: 'vertical_xy',
            componentRole: 'plinth'
          },
          // Fondo Trasera MDF (Entre piso y techo, sin solapar)
          {
            id: 'caj3_fondo_mdf_' + crypto.randomUUID().slice(0, 6),
            name: 'Fondo Trasero MDF',
            length: carcassInnerWidth - 2,
            width: innerH - 2,
            thickness: backT,
            quantity: 1,
            materialId: matBottom.id,
            materialName: matBottom.name,
            grain: 'none',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: plinthH + t + innerH / 2,
            posZ: carcassBackZ + 15 + backT / 2,
            orientation: 'vertical_xy',
            componentRole: 'back'
          }
        ];

        // 3 Cajones uniformes cubriendo de zócalo (70mm) a tope (750mm):
        // Altura disponible de fachada = 750 - 70 - 3 = 677 mm -> 3 frentes de 223 mm con 3 mm de holgura
        const frontWidth = width - 4; // 596 mm
        const frontH = 223;
        const gap = 3;
        const frontCenterZ = carcassFrontZ + t / 2;
        const internalAvailableDepth = carcassDepth - 15 - backT;

        const b1 = plinthH + 1.5;
        const b2 = b1 + frontH + gap;
        const b3 = b2 + frontH + gap;

        const floorTopY = plinthH + t;
        const roofBottomY = height - t;

        const drawer1Parts = this.generateDrawerBoxParts(
          'caj1', 'Cajón 1', frontWidth, frontH, carcassInnerWidth, internalAvailableDepth,
          offsetX, b1 + frontH / 2, frontCenterZ,
          Math.max(floorTopY + 6, b1 + 8), b1 + frontH - 8,
          matBody, matBody, matBottom, t
        );
        const drawer2Parts = this.generateDrawerBoxParts(
          'caj2', 'Cajón 2', frontWidth, frontH, carcassInnerWidth, internalAvailableDepth,
          offsetX, b2 + frontH / 2, frontCenterZ,
          b2 + 8, b2 + frontH - 8,
          matBody, matBody, matBottom, t
        );
        const drawer3Parts = this.generateDrawerBoxParts(
          'caj3', 'Cajón 3', frontWidth, frontH, carcassInnerWidth, internalAvailableDepth,
          offsetX, b3 + frontH / 2, frontCenterZ,
          b3 + 8, Math.min(roofBottomY - 6, b3 + frontH - 8),
          matBody, matBody, matBottom, t
        );

        return [...carcassParts, ...drawer1Parts, ...drawer2Parts, ...drawer3Parts];
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
        code: 'MBAJ1P001',
        name: 'Módulo Bajo Cocina 1P',
        moduleType: 'base_cabinet',
        category: 'kitchen_base',
        width: 600,
        height: 850,
        depth: 600,
        structureThickness: 18,
        doorThickness: 18,
        backThickness: 3,
        backType: 'groove',
        hasBackPanel: true,
        shelvesCount: 1,
        doorOpening: 'left',
        hasHandle: true,
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        handlePosition: 'vertical',
        hasPlinth: true,
        plinthHeight: 100,
        facadeGap: 3
      },
      generateParts: (mats, offsetX = 0) => {
        const matBody = this.getMaterial(mats, 'blanco');
        const matDoor = this.getMaterial(mats, 'blanco');
        const matBottom = this.getMaterial(mats, 'mdf') || { id: 'mat_mdf_6', name: 'MDF 6mm', thickness: 6 };
        const t = matBody.thickness || 18;
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
        structureThickness: 18,
        doorThickness: 18,
        backThickness: 3,
        shelvesCount: 1,
        doorOpening: 'left',
        facadeGap: 3
      },
      generateParts: (mats, offsetX = 0) => {
        const matBody = this.getMaterial(mats, 'blanco');
        const matDoor = this.getMaterial(mats, 'roble') || matBody;
        const matBottom = this.getMaterial(mats, 'mdf') || { id: 'mat_mdf_3', name: 'MDF 3mm', thickness: 3 };
        const t = matBody.thickness || 18;
        const w = 600;
        const h = 800;
        const d = 320;
        const doorT = 18;
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
        const t = matBody.thickness || 18;
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
        const t = matBody.thickness || 18;
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
        halfW = (part.thickness || 18) / 2;
      }
      const rightEdge = (part.posX || 0) + halfW;
      if (rightEdge > maxX) maxX = rightEdge;
    }

    if (maxX === -Infinity) return 0;
    return Math.round(maxX + (templateWidth / 2) + 200); // 200 mm clearance between furniture
  }
}
