import { Injectable } from '@angular/core';
import { Part, Material } from '../models/melamine.models';

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
    const def = materials[0] || { id: 'mat_default', name: 'Melamina Blanca 18mm', thickness: 18 };
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
      partsCount: 24, // 6 piezas de mueble + (6 piezas x 3 gavetas) = 24 piezas de despiece
      previewColor: { top: '#b45309', body: '#f8fafc', front: '#f1f5f9', accent: '#64748b' },
      generateParts: (mats, offsetX = 0) => {
        const matBody = this.getMaterial(mats, 'blanco');
        const matTop = this.getMaterial(mats, 'roble');
        const matBottom = this.getMaterial(mats, 'mdf') || { id: 'mat_mdf_6', name: 'MDF 6mm', thickness: 6 };
        const t = matBody.thickness || 18;
        const width = 600;
        const height = 750;
        const depth = 500;
        const carcassInnerWidth = width - (2 * t); // 564 mm
        const carcassDepth = depth - 20; // 480 mm

        const carcassParts: Part[] = [
          // Tapa / Cubierta Superior
          {
            id: 'caj3_tapa_' + crypto.randomUUID().slice(0, 6),
            name: 'Cubierta Superior',
            length: width,
            width: depth,
            thickness: t,
            quantity: 1,
            materialId: matTop.id,
            materialName: matTop.name,
            grain: 'length',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            posX: offsetX,
            posY: height - (t / 2),
            posZ: 0,
            orientation: 'horizontal',
            componentRole: 'top'
          },
          // Lateral Izquierdo
          {
            id: 'caj3_lat_izq_' + crypto.randomUUID().slice(0, 6),
            name: 'Lateral Izquierdo',
            length: height - t,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX - (width / 2) + (t / 2),
            posY: (height - t) / 2,
            posZ: 10,
            orientation: 'vertical_yz',
            componentRole: 'side_left'
          },
          // Lateral Derecho
          {
            id: 'caj3_lat_der_' + crypto.randomUUID().slice(0, 6),
            name: 'Lateral Derecho',
            length: height - t,
            width: carcassDepth,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
            posX: offsetX + (width / 2) - (t / 2),
            posY: (height - t) / 2,
            posZ: 10,
            orientation: 'vertical_yz',
            componentRole: 'side_right'
          },
          // Piso Inferior
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
            posY: 70 + (t / 2), // Sobre zócalo de 70mm
            posZ: 10,
            orientation: 'horizontal',
            componentRole: 'bottom'
          },
          // Zócalo Frontal
          {
            id: 'caj3_zocalo_' + crypto.randomUUID().slice(0, 6),
            name: 'Zócalo Frontal',
            length: carcassInnerWidth,
            width: 70,
            thickness: t,
            quantity: 1,
            materialId: matBody.id,
            materialName: matBody.name,
            grain: 'length',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: 35,
            posZ: (carcassDepth / 2) - 15,
            orientation: 'vertical_xy',
            componentRole: 'plinth'
          },
          // Fondo Trasera MDF
          {
            id: 'caj3_fondo_mdf_' + crypto.randomUUID().slice(0, 6),
            name: 'Fondo Trasera MDF',
            length: carcassInnerWidth,
            width: height - t - 70,
            thickness: 6,
            quantity: 1,
            materialId: matBottom.id,
            materialName: matBottom.name,
            grain: 'none',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            posX: offsetX,
            posY: 70 + ((height - t - 70) / 2),
            posZ: - (carcassDepth / 2) + 5,
            orientation: 'vertical_xy',
            componentRole: 'back'
          }
        ];

        // 3 Cajones: Altura total útil para frentes = 750 - 70 (zócalo) - 18 (tapa) = 662 mm
        // 3 frentes de 216 mm con holgura de 3 mm entre frentes
        const frontWidth = width - 4; // 596 mm (2mm holgura a cada lado)
        const frontH = 216;
        const frontZ = (depth / 2) - (t / 2); // Enrasado con frente del mueble

        const y1 = 70 + (frontH / 2) + 2;        // Gaveta 1 (Inferior)
        const y2 = y1 + frontH + 4;              // Gaveta 2 (Media)
        const y3 = y2 + frontH + 4;              // Gaveta 3 (Superior)

        const drawer1Parts = this.generateDrawerBoxParts(
          'caj1', 'Cajón Inferior', frontWidth, frontH, carcassInnerWidth, carcassDepth,
          offsetX, y1, frontZ, matBody, matBody, matBottom, t
        );
        const drawer2Parts = this.generateDrawerBoxParts(
          'caj2', 'Cajón Medio', frontWidth, frontH, carcassInnerWidth, carcassDepth,
          offsetX, y2, frontZ, matBody, matBody, matBottom, t
        );
        const drawer3Parts = this.generateDrawerBoxParts(
          'caj3', 'Cajón Superior', frontWidth, frontH, carcassInnerWidth, carcassDepth,
          offsetX, y3, frontZ, matBody, matBody, matBottom, t
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
    }
  ];

  getCategories() {
    return [
      { id: 'all', label: 'Todas las Plantillas', icon: 'auto_stories', count: this.templates.length },
      { id: 'cajones', label: 'Cajoneras y Cajones', icon: 'table_rows', count: this.templates.filter(t => t.category === 'cajones').length },
      { id: 'cocina', label: 'Cocina', icon: 'countertops', count: this.templates.filter(t => t.category === 'cocina').length }
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
