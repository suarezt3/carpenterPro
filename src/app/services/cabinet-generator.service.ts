import { inject, Injectable } from '@angular/core';
import {
  FurnitureModule,
  Material,
  Part,
  ParametricCabinetConfig,
  PartGroup,
  PartCornerCutConfig
} from '../models/melamine.models';
import { PartGeometryService } from './part-geometry.service';

@Injectable({
  providedIn: 'root'
})
export class CabinetGeneratorService {
  private readonly partGeometry = inject(PartGeometryService);

  /**
   * Generates a fully parametric furniture module (Kitchen Base, Wall Cabinet, Closet,
   * Vanity, Bookshelf, or Custom) with exact joinery calculations, door configurations
   * (none, left, right, double, lift-up), handles, and uniform/manual shelf distributions.
   */
  generateParametricCabinet(
    config: ParametricCabinetConfig, 
    materials: Material[]
  ): { module: FurnitureModule; parts: Part[]; group: PartGroup } {
    if (config.category === 'oven_base' || config.category === 'sink_base' || config.category === 'corner_base' || config.category === 'blind_corner_base' || config.category === 'oven_tower') {
      return this.generateSpecializedKitchenModule(config, materials);
    }
    if (config.moduleType === 'drawer_unit' || config.category === 'drawers' || config.category === 'cajones' || (config.drawersCount && config.drawersCount > 0 && config.moduleType !== 'wall_cabinet')) {
      return this.generateParametricDrawerUnit(config, materials);
    }

    const moduleId = config.id || `module_cab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const groupId = `group_cab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const groupName = config.name || `Módulo Paramétrico (${config.code || 'MOD001'})`;

    const mainMat = materials.find(m => m.id === config.structureMaterialId) || materials[0];
    const doorMat = materials.find(m => m.id === config.doorMaterialId) || mainMat;
    const backMat = materials.find(m => m.id === config.backMaterialId) || 
                    materials.find(m => m.thickness <= 6) || mainMat;

    const t = Number(config.structureThickness) || mainMat.thickness || 15;
    const doorT = Number(config.doorThickness) || doorMat.thickness || t;
    const backT = config.backThickness || 3;
    const w = config.width || 600;
    const h = config.height || 800;
    const d = config.depth || 320;
    const gap = config.facadeGap ?? 3;

    const doorOpening = config.doorOpening || 'left';
    const hasDoor = doorOpening !== 'none';

    // Carcass depth: if doors are present, carcass is recessed so doors sit flush with outer front
    const carcassDepth = hasDoor ? Math.max(80, d - doorT) : d;
    const innerWidth = Math.max(50, w - (2 * t));
    const innerHeight = Math.max(50, h - (2 * t));

    // Coordinate centers
    const hasPlinth = config.hasPlinth === true || (config.moduleType === 'base_cabinet' && config.hasPlinth !== false);
    const plinthH = hasPlinth ? (Number(config.plinthHeight) || 80) : 0;
    const sideH = Math.max(100, h - plinthH);

    // Coordinate centers
    const posX = config.posX ?? 0;
    
    // Default elevation (posY):
    let posY = config.posY;
    if (posY === undefined) {
      if (config.elevationY !== undefined) {
        posY = config.elevationY + (h / 2);
      } else if (config.moduleType === 'wall_cabinet') {
        posY = 1450 + (h / 2); // Alacena elevada
      } else if (config.moduleType === 'vanity') {
        posY = 450 + (h / 2); // Vanity flotante (base a 450 mm del suelo)
      } else {
        posY = h / 2; // Apoyado en el suelo (0 mm de elevación base)
      }
    }
    const posZ = config.posZ ?? 0;

    const carcassCenterZ = hasDoor ? posZ - (doorT / 2) : posZ;
    const carcassBackZ = carcassCenterZ - (carcassDepth / 2);
    const carcassFrontZ = carcassCenterZ + (carcassDepth / 2);
    const bottomOfCarcassY = posY - (h / 2) + plinthH;
    const sideCenterY = bottomOfCarcassY + (sideH / 2);
    const topY = bottomOfCarcassY + sideH - (t / 2);
    const parts: Part[] = [];

    // 1. Lateral Izquierdo
    parts.push({
      id: `${moduleId}_lat_izq_${Date.now()}`,
      name: 'Lateral Izquierdo',
      moduleId,
      moduleName: groupName,
      groupId,
      groupName,
      length: sideH,
      width: carcassDepth,
      thickness: t,
      quantity: 1,
      materialId: mainMat.id,
      materialName: mainMat.name,
      grain: mainMat.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
      posX: posX - (w / 2) + (t / 2),
      posY: sideCenterY,
      posZ: carcassCenterZ,
      orientation: 'vertical_yz',
      componentRole: 'side_left',
      notes: 'Lateral exterior izquierdo'
    });

    // 2. Lateral Derecho
    parts.push({
      id: `${moduleId}_lat_der_${Date.now()}`,
      name: 'Lateral Derecho',
      moduleId,
      moduleName: groupName,
      groupId,
      groupName,
      length: sideH,
      width: carcassDepth,
      thickness: t,
      quantity: 1,
      materialId: mainMat.id,
      materialName: mainMat.name,
      grain: mainMat.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'none' },
      posX: posX + (w / 2) - (t / 2),
      posY: sideCenterY,
      posZ: carcassCenterZ,
      orientation: 'vertical_yz',
      componentRole: 'side_right',
      notes: 'Lateral exterior derecho'
    });

    // 3. Techo Superior o Amarres Superiores (Tie Strips para muebles bajos con mesón)
    const topTieStrips = config.topTieStrips === true || (config.moduleType === 'base_cabinet' && config.hasTopCover === false);
    if (topTieStrips) {
      const tieWidth = 90;
      parts.push({
        id: `${moduleId}_tirante_front_${Date.now()}`,
        name: 'Amarre Superior Frontal',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: innerWidth,
        width: tieWidth,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: topY,
        posZ: carcassFrontZ - (tieWidth / 2),
        orientation: 'horizontal',
        componentRole: 'tie',
        notes: 'Amarre frontal superior para mesón'
      });
      parts.push({
        id: `${moduleId}_tirante_back_${Date.now()}`,
        name: 'Amarre Superior Trasero',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: innerWidth,
        width: tieWidth,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: topY,
        posZ: carcassBackZ + (tieWidth / 2),
        orientation: 'horizontal',
        componentRole: 'tie',
        notes: 'Amarre trasero superior para mesón'
      });
    } else if (config.hasTopCover !== false) {
      const topPart: Part = {
        id: `${moduleId}_techo_${Date.now()}`,
        name: 'Techo Superior',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: innerWidth,
        width: carcassDepth,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: topY,
        posZ: carcassCenterZ,
        orientation: 'horizontal',
        componentRole: 'top',
        notes: 'Tapa superior estructural'
      };
      if (config.siphonCutout?.enabled) {
        topPart.cornerCutConfig = {
          type: 'u_siphon_cutout',
          corner: 'back_left',
          cutX: config.siphonCutout.width || 200,
          cutY: config.siphonCutout.depth || 250
        };
      }
      parts.push(topPart);
    }

    // 4. Piso / Base Inferior
    parts.push({
      id: `${moduleId}_base_${Date.now()}`,
      name: 'Piso Inferior',
      moduleId,
      moduleName: groupName,
      groupId,
      groupName,
      length: innerWidth,
      width: carcassDepth,
      thickness: t,
      quantity: 1,
      materialId: mainMat.id,
      materialName: mainMat.name,
      grain: mainMat.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX,
      posY: bottomOfCarcassY + (t / 2),
      posZ: carcassCenterZ,
      orientation: 'horizontal',
      componentRole: 'bottom',
      notes: 'Base inferior estructural'
    });

    // 4.1 Zócalos perimetrales retranqueados
    if (hasPlinth && plinthH > 0) {
      const recess = 25;
      const plinthOuterW = Math.max(50, w - (2 * recess));
      const plinthOuterD = Math.max(50, carcassDepth - (2 * recess));
      const plinthInnerD = Math.max(50, plinthOuterD - (2 * t));
      const plinthCenterY = posY - (h / 2) + (plinthH / 2);

      parts.push({
        id: `${moduleId}_zocalo_f_${Date.now()}`,
        name: 'Zócalo Frontal',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: plinthOuterW,
        width: plinthH,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: plinthCenterY,
        posZ: carcassFrontZ - recess - (t / 2),
        orientation: 'vertical_xy',
        componentRole: 'plinth',
        notes: 'Zócalo frontal perimetral'
      });
      parts.push({
        id: `${moduleId}_zocalo_t_${Date.now()}`,
        name: 'Zócalo Trasero',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: plinthOuterW,
        width: plinthH,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: plinthCenterY,
        posZ: carcassBackZ + recess + (t / 2),
        orientation: 'vertical_xy',
        componentRole: 'plinth',
        notes: 'Zócalo trasero perimetral'
      });
      parts.push({
        id: `${moduleId}_zocalo_li_${Date.now()}`,
        name: 'Zócalo Lateral Izquierdo',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: plinthInnerD,
        width: plinthH,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: posX - (w / 2) + recess + (t / 2),
        posY: plinthCenterY,
        posZ: carcassCenterZ,
        orientation: 'vertical_yz',
        componentRole: 'plinth',
        notes: 'Zócalo lateral izquierdo perimetral'
      });
      parts.push({
        id: `${moduleId}_zocalo_ld_${Date.now()}`,
        name: 'Zócalo Lateral Derecho',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: plinthInnerD,
        width: plinthH,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: posX + (w / 2) - recess - (t / 2),
        posY: plinthCenterY,
        posZ: carcassCenterZ,
        orientation: 'vertical_yz',
        componentRole: 'plinth',
        notes: 'Zócalo lateral derecho perimetral'
      });
    }

    // 4.2 Tubos de colgado (Hanging Rods para closets)
    const rodsCount = config.hangingRodsCount ?? 0;
    if (rodsCount === 1) {
      parts.push({
        id: `${moduleId}_tubo_colgador_${Date.now()}`,
        name: 'Tubo Colgador Cromado',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: innerWidth,
        width: 25,
        thickness: 25,
        quantity: 1,
        materialId: 'hw_rod_chrome',
        materialName: 'Tubo Oval Cromado',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: topY - (t / 2) - 80,
        posZ: carcassCenterZ,
        orientation: 'horizontal',
        componentRole: 'free',
        shapeType: 'circle',
        diameter: 25,
        colorHex: '#94a3b8',
        notes: 'Tubo de colgado simple para perchas'
      });
    } else if (rodsCount === 2) {
      const midShelfY = bottomOfCarcassY + (sideH / 2);
      parts.push({
        id: `${moduleId}_repisa_colgado_${Date.now()}`,
        name: 'Entrepaño Divisor Colgado',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: Math.max(50, innerWidth - 2),
        width: Math.max(50, carcassDepth - (hasDoor ? 20 : 10)),
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: midShelfY,
        posZ: carcassCenterZ,
        orientation: 'horizontal',
        componentRole: 'shelf',
        notes: 'Divisor de colgado doble'
      });
      parts.push({
        id: `${moduleId}_tubo_sup_${Date.now()}`,
        name: 'Tubo Colgador Superior',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: innerWidth,
        width: 25,
        thickness: 25,
        quantity: 1,
        materialId: 'hw_rod_chrome',
        materialName: 'Tubo Oval Cromado',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: topY - (t / 2) - 70,
        posZ: carcassCenterZ,
        orientation: 'horizontal',
        componentRole: 'free',
        shapeType: 'circle',
        diameter: 25,
        colorHex: '#94a3b8',
        notes: 'Tubo de colgado nivel superior'
      });
      parts.push({
        id: `${moduleId}_tubo_inf_${Date.now()}`,
        name: 'Tubo Colgador Inferior',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: innerWidth,
        width: 25,
        thickness: 25,
        quantity: 1,
        materialId: 'hw_rod_chrome',
        materialName: 'Tubo Oval Cromado',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: midShelfY - 70,
        posZ: carcassCenterZ,
        orientation: 'horizontal',
        componentRole: 'free',
        shapeType: 'circle',
        diameter: 25,
        colorHex: '#94a3b8',
        notes: 'Tubo de colgado nivel inferior'
      });
    }

    // 5. Repisas / Entrepaños Interiores
    const includeBack = config.backType !== 'none' && config.hasBackPanel !== false;
    const shelves = config.shelvesCount ?? 0;
    if (shelves > 0) {
      const bottomY = bottomOfCarcassY + t;
      const innerAvailableH = Math.max(50, topY - bottomY);
      
      // Technical clearances: 20mm behind door facade and 22mm ahead of rear carcass/back groove
      const frontClearance = hasDoor ? 20 : 10;
      const rearClearance = includeBack ? 22 : 5;
      const shelfWidth = Math.max(50, carcassDepth - frontClearance - rearClearance);
      const shelfCenterZ = carcassBackZ + rearClearance + (shelfWidth / 2);
      const shelfLength = Math.max(50, innerWidth - 2); // 1mm holgura a cada lado para montaje limpio

      if (config.shelfDistribution === 'manual' && config.shelfManualOffsets && config.shelfManualOffsets.length === shelves) {
        // Altura manual por cada entrepaño
        config.shelfManualOffsets.forEach((offset, idx) => {
          const shelfY = bottomY + offset;
          parts.push({
            id: `${moduleId}_repisa_${idx + 1}_${Date.now()}`,
            name: `Entrepaño ${idx + 1}`,
            moduleId,
            moduleName: groupName,
            groupId,
            groupName,
            length: shelfLength,
            width: shelfWidth,
            thickness: t,
            quantity: 1,
            materialId: mainMat.id,
            materialName: mainMat.name,
            grain: mainMat.hasGrain ? 'length' : 'none',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX,
            posY: shelfY,
            posZ: shelfCenterZ,
            orientation: 'horizontal',
            componentRole: 'shelf',
            notes: `Entrepaño cota manual ${offset} mm`
          });
        });
      } else {
        // Distribución uniforme automática
        const stepY = innerAvailableH / (shelves + 1);
        for (let i = 1; i <= shelves; i++) {
          const shelfY = bottomY + (stepY * i);
          parts.push({
            id: `${moduleId}_repisa_${i}_${Date.now()}`,
            name: `Entrepaño ${i}`,
            moduleId,
            moduleName: groupName,
            groupId,
            groupName,
            length: shelfLength,
            width: shelfWidth,
            thickness: t,
            quantity: 1,
            materialId: mainMat.id,
            materialName: mainMat.name,
            grain: mainMat.hasGrain ? 'length' : 'none',
            edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
            posX,
            posY: shelfY,
            posZ: shelfCenterZ,
            orientation: 'horizontal',
            componentRole: 'shelf',
            notes: `Entrepaño regulable nivel ${i}`
          });
        }
      }
    }

    // 6. Fondo Trasero (MDF 3mm / Durolac)
    if (includeBack) {
      const isGroove = config.backType !== 'overlay';
      const backPosZ = isGroove 
        ? (carcassBackZ + 15 + (backT / 2)) 
        : (carcassBackZ - (backT / 2));
      const backLength = isGroove 
        ? Math.max(50, innerWidth - 2) 
        : Math.max(50, w - 4);
      const backHeight = isGroove 
        ? Math.max(50, sideH - 2) 
        : Math.max(50, sideH - 4);

      parts.push({
        id: `${moduleId}_fondo_${Date.now()}`,
        name: isGroove ? 'Fondo Trasero Ranurado' : 'Fondo Trasero Sobrepuesto',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: backLength,
        width: backHeight,
        thickness: backT,
        quantity: 1,
        materialId: backMat.id,
        materialName: backMat.name,
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: sideCenterY,
        posZ: backPosZ,
        orientation: 'vertical_xy',
        componentRole: 'back',
        notes: isGroove 
          ? `Fondo MDF ranurado a 15mm`
          : `Fondo MDF sobrepuesto clavado al dorso`
      });
    }

    // 7. Puerta(s) Frontal(es)
    const doorPosZ = carcassFrontZ + (doorT / 2);
    const hasHandle = config.hasHandle !== false;
    const hType = hasHandle ? (config.handleType || 'bar_modern') : 'none';
    const hFinish = config.handleFinish || 'brushed_steel';
    const isGasLift = doorOpening === 'top';
    const doorH = Math.max(80, sideH - gap);

    if (doorOpening === 'left' || doorOpening === 'right') {
      // 1 Puerta completa (Abre Izquierda o Derecha)
      parts.push({
        id: `${moduleId}_puerta_${Date.now()}`,
        name: `Puerta Frontal (Abre: ${doorOpening === 'left' ? 'Izquierda' : 'Derecha'})`,
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: w - gap,
        width: doorH,
        thickness: doorT,
        quantity: 1,
        materialId: doorMat.id,
        materialName: doorMat.name,
        grain: doorMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX,
        posY: sideCenterY,
        posZ: doorPosZ,
        orientation: 'vertical_xy',
        componentRole: 'door',
        notes: `Puerta abatible hacia ${doorOpening}`,
        hardwareConfig: {
          isMovable: true,
          movableType: 'door',
          openingDirection: doorOpening,
          hingeType: 'straight',
          handleType: hType,
          handleFinish: hFinish,
          handlePosition: config.handlePosition || 'vertical',
          isOpen: false
        }
      });
    } else if (doorOpening === 'double') {
      // 2 Puertas Dobles (Puerta Izquierda y Puerta Derecha)
      const doorW = Math.max(50, (w / 2) - (gap * 1.2));
      const leftDoorX = posX - (w / 4) + (gap / 4);
      const rightDoorX = posX + (w / 4) - (gap / 4);

      // Puerta Izquierda
      parts.push({
        id: `${moduleId}_puerta_izq_${Date.now()}`,
        name: 'Puerta Izquierda (Doble)',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: doorW,
        width: doorH,
        thickness: doorT,
        quantity: 1,
        materialId: doorMat.id,
        materialName: doorMat.name,
        grain: doorMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX: leftDoorX,
        posY: sideCenterY,
        posZ: doorPosZ,
        orientation: 'vertical_xy',
        componentRole: 'door',
        notes: 'Puerta izquierda abatible hacia afuera',
        hardwareConfig: {
          isMovable: true,
          movableType: 'door',
          openingDirection: 'left',
          hingeType: 'straight',
          handleType: hType,
          handleFinish: hFinish,
          handlePosition: config.handlePosition || 'vertical',
          isOpen: false
        }
      });

      // Puerta Derecha
      parts.push({
        id: `${moduleId}_puerta_der_${Date.now()}`,
        name: 'Puerta Derecha (Doble)',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: doorW,
        width: doorH,
        thickness: doorT,
        quantity: 1,
        materialId: doorMat.id,
        materialName: doorMat.name,
        grain: doorMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX: rightDoorX,
        posY: sideCenterY,
        posZ: doorPosZ,
        orientation: 'vertical_xy',
        componentRole: 'door',
        notes: 'Puerta derecha abatible hacia afuera',
        hardwareConfig: {
          isMovable: true,
          movableType: 'door',
          openingDirection: 'right',
          hingeType: 'straight',
          handleType: hType,
          handleFinish: hFinish,
          handlePosition: config.handlePosition || 'vertical',
          isOpen: false
        }
      });
    } else if (doorOpening === 'top' || isGasLift) {
      // 1 Puerta Elevable Superior (Pistón a Gas)
      parts.push({
        id: `${moduleId}_puerta_elev_${Date.now()}`,
        name: 'Puerta Elevable (Pistón Gas)',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: w - gap,
        width: doorH,
        thickness: doorT,
        quantity: 1,
        materialId: doorMat.id,
        materialName: doorMat.name,
        grain: doorMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX,
        posY: sideCenterY,
        posZ: doorPosZ,
        orientation: 'vertical_xy',
        componentRole: 'door',
        notes: 'Puerta elevable con pistón a gas',
        hardwareConfig: {
          isMovable: true,
          movableType: 'door',
          openingDirection: 'top',
          hingeType: 'gas_piston',
          handleType: hType,
          handleFinish: hFinish,
          handlePosition: 'horizontal',
          isOpen: false
        }
      });
    } else if (doorOpening === 'bottom') {
      // Puerta Abatible Inferior
      parts.push({
        id: `${moduleId}_puerta_abat_${Date.now()}`,
        name: 'Puerta Abatible Inferior',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: w - gap,
        width: doorH,
        thickness: doorT,
        quantity: 1,
        materialId: doorMat.id,
        materialName: doorMat.name,
        grain: doorMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX,
        posY: sideCenterY,
        posZ: doorPosZ,
        orientation: 'vertical_xy',
        componentRole: 'door',
        notes: 'Puerta abatible hacia abajo',
        hardwareConfig: {
          isMovable: true,
          movableType: 'door',
          openingDirection: 'bottom',
          hingeType: 'straight',
          handleType: hType,
          handleFinish: hFinish,
          handlePosition: 'horizontal',
          isOpen: false
        }
      });
    }

    const module: FurnitureModule = {
      id: moduleId,
      name: groupName,
      type: (config.moduleType === 'wall_cabinet' || config.moduleType === 'base_cabinet' || config.moduleType === 'tall_cabinet')
        ? config.moduleType 
        : 'base_cabinet',
      width: w,
      height: h,
      depth: d,
      boardThickness: t,
      backThickness: backT,
      backType: config.backType || 'groove',
      shelvesCount: shelves,
      doorsCount: doorOpening === 'none' ? 0 : (doorOpening === 'double' ? 2 : 1),
      doorsType: 'overlay',
      drawersCount: 0,
      hasPlinth: false,
      plinthHeight: 0,
      materialId: mainMat.id,
      backMaterialId: backMat.id,
      defaultThinEdge: true,
      defaultThickDoors: true
    };

    const group: PartGroup = {
      id: groupId,
      name: groupName,
      type: 'assembly',
      isOpen: false,
      parametricConfig: {
        ...config,
        drawersCount: 0,
        hangingRodsCount: (config.moduleType === 'closet' || config.category === 'closet' || config.environmentLine === 'closet') ? (config.hangingRodsCount || 0) : 0
      }
    };

    return { module, parts, group };
  }

  private generateParametricDrawerUnit(
    config: ParametricCabinetConfig,
    materials: Material[]
  ): { module: FurnitureModule; parts: Part[]; group: PartGroup } {
    const moduleId = config.id || `module_caj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const groupId = `group_caj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const groupName = config.name || `Cajonera (${config.code || 'CAJ001'})`;

    const boardMats = materials.filter(m => m.textureType !== 'stone' && m.thickness >= 12 && m.thickness <= 25);
    const defaultBoardMat = boardMats[0] || materials[0];
    const rawMainMat = materials.find(m => m.id === config.structureMaterialId);
    const mainMat = (rawMainMat && rawMainMat.textureType !== 'stone') ? rawMainMat : defaultBoardMat;
    const rawFrontMat = materials.find(m => m.id === config.doorMaterialId);
    const frontMat = (rawFrontMat && rawFrontMat.textureType !== 'stone') ? rawFrontMat : mainMat;
    const backMat = materials.find(m => m.id === config.backMaterialId) ||
                    materials.find(m => m.thickness <= 6) ||
                    materials.find(m => m.name.toLowerCase().includes('mdf')) ||
                    { id: 'mat_mdf_3', name: 'MDF 3mm', thickness: 3 };

    const t = Math.max(12, Math.min(22, Number(config.structureThickness) || 15));
    const doorT = Math.max(12, Math.min(22, Number(config.doorThickness) || t));
    const backT = Math.max(3, Number(config.backThickness) || 3);
    const w = Math.max(300, Number(config.width) || 600);
    const h = Math.max(400, Number(config.height) || 750);
    const d = Math.max(300, Number(config.depth) || 500);
    const gap = config.facadeGap ?? 3;

    const drawersCount = Math.max(1, Math.min(6, Math.floor(Number(config.drawersCount) || 3)));
    const hasPlinth = config.hasPlinth !== false;
    const plinthH = hasPlinth ? (Number(config.plinthHeight) || 70) : 0;
    const slideType = config.drawerSlideType || 'telescopic';
    const isOverlay = config.drawerFrontType !== 'inset';
    const includeBack = config.hasBackPanel !== false;
    const hasHandle = config.hasHandle !== false;
    const hType = hasHandle ? (config.handleType || 'bar_modern') : 'none';
    const hFinish = config.handleFinish || 'brushed_steel';

    // Coordenadas del centro con soporte para altura libre flotante (elevationY)
    const elevationY = Number.isFinite(Number(config.elevationY)) ? Number(config.elevationY) : 0;
    const posX = Number.isFinite(Number(config.posX)) ? Number(config.posX) : 0;
    const posY = Number.isFinite(Number(config.posY)) ? Number(config.posY) : (elevationY + (h / 2));
    const posZ = Number.isFinite(Number(config.posZ)) ? Number(config.posZ) : 0;

    // Medidas del casco (carcass)
    const carcassDepth = isOverlay ? Math.max(200, d - doorT) : d;
    const carcassCenterZ = isOverlay ? (posZ - (doorT / 2)) : posZ;
    const carcassFrontZ = carcassCenterZ + (carcassDepth / 2);
    const carcassBackZ = carcassCenterZ - (carcassDepth / 2);

    const innerWidth = Math.max(50, w - (2 * t));
    const useTopTies = config.topTieStrips === true || config.hasTopCover === false;
    const sideH = useTopTies ? Math.max(100, h - plinthH) : Math.max(100, h - t - plinthH);
    const sideCenterY = posY - (h / 2) + plinthH + (sideH / 2);
    const topY = posY - (h / 2) + plinthH + sideH - (t / 2);

    const parts: Part[] = [];

    // 1. Cubierta Superior / Amarres de Mesón
    if (useTopTies) {
      const tieWidth = 90;
      parts.push({
        id: `${moduleId}_tirante_front_${Date.now()}`,
        name: 'Amarre Frontal Superior',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: innerWidth,
        width: tieWidth,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: topY,
        posZ: carcassFrontZ - (tieWidth / 2),
        orientation: 'horizontal',
        componentRole: 'tie',
        notes: 'Amarre frontal superior de cajonera para mesón'
      });
      parts.push({
        id: `${moduleId}_tirante_back_${Date.now()}`,
        name: 'Amarre Trasero Superior',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: innerWidth,
        width: tieWidth,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: topY,
        posZ: carcassBackZ + (tieWidth / 2),
        orientation: 'horizontal',
        componentRole: 'tie',
        notes: 'Amarre trasero superior de cajonera para mesón'
      });
    } else {
      const topPart: Part = {
        id: `${moduleId}_tapa_${Date.now()}`,
        name: 'Cubierta Superior',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: w,
        width: d,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX,
        posY: posY + (h / 2) - (t / 2),
        posZ,
        orientation: 'horizontal',
        componentRole: 'top',
        notes: 'Cubierta superior del mueble'
      };
      if (config.siphonCutout?.enabled) {
        topPart.cornerCutConfig = {
          type: 'u_siphon_cutout',
          corner: 'back_left',
          cutX: config.siphonCutout.width || 200,
          cutY: config.siphonCutout.depth || 250
        };
      }
      parts.push(topPart);
    }

    // 2. Lateral Izquierdo
    parts.push({
      id: `${moduleId}_lat_izq_${Date.now()}`,
      name: 'Lateral Izquierdo',
      moduleId,
      moduleName: groupName,
      groupId,
      groupName,
      length: sideH,
      width: carcassDepth,
      thickness: t,
      quantity: 1,
      materialId: mainMat.id,
      materialName: mainMat.name,
      grain: mainMat.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
      posX: posX - (w / 2) + (t / 2),
      posY: sideCenterY,
      posZ: carcassCenterZ,
      orientation: 'vertical_yz',
      componentRole: 'side_left',
      notes: 'Costado izquierdo de cajonera'
    });

    // 3. Lateral Derecho
    parts.push({
      id: `${moduleId}_lat_der_${Date.now()}`,
      name: 'Lateral Derecho',
      moduleId,
      moduleName: groupName,
      groupId,
      groupName,
      length: sideH,
      width: carcassDepth,
      thickness: t,
      quantity: 1,
      materialId: mainMat.id,
      materialName: mainMat.name,
      grain: mainMat.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
      posX: posX + (w / 2) - (t / 2),
      posY: sideCenterY,
      posZ: carcassCenterZ,
      orientation: 'vertical_yz',
      componentRole: 'side_right',
      notes: 'Costado derecho de cajonera'
    });

    // 4. Piso Inferior
    parts.push({
      id: `${moduleId}_piso_${Date.now()}`,
      name: 'Piso Inferior',
      moduleId,
      moduleName: groupName,
      groupId,
      groupName,
      length: innerWidth,
      width: carcassDepth,
      thickness: t,
      quantity: 1,
      materialId: mainMat.id,
      materialName: mainMat.name,
      grain: mainMat.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX,
      posY: posY - (h / 2) + plinthH + (t / 2),
      posZ: carcassCenterZ,
      orientation: 'horizontal',
      componentRole: 'bottom',
      notes: 'Base inferior estructural'
    });

    // 5. Base de Zócalo Perimetral Cerrada (4 lados: frontal, trasero y laterales con retranqueo uniforme)
    if (hasPlinth && plinthH > 0) {
      const recess = 25; // Retranqueo perimetral uniforme de 25mm en los 4 costados
      const plinthOuterW = Math.max(50, w - (2 * recess));
      const plinthOuterD = Math.max(50, carcassDepth - (2 * recess));
      const plinthInnerD = Math.max(50, plinthOuterD - (2 * t));
      const plinthCenterY = posY - (h / 2) + (plinthH / 2);

      // 5.1 Zócalo Frontal (Cubre el ancho completo del marco de zócalo para vista frontal continua)
      parts.push({
        id: `${moduleId}_zocalo_frontal_${Date.now()}`,
        name: 'Zócalo Frontal',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: plinthOuterW,
        width: plinthH,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: plinthCenterY,
        posZ: carcassCenterZ + (carcassDepth / 2) - recess - (t / 2),
        orientation: 'vertical_xy',
        componentRole: 'plinth',
        notes: 'Zócalo frontal perimetral'
      });

      // 5.2 Zócalo Trasero (Cierra el marco perimetral por detrás)
      parts.push({
        id: `${moduleId}_zocalo_trasero_${Date.now()}`,
        name: 'Zócalo Trasero',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: plinthOuterW,
        width: plinthH,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: plinthCenterY,
        posZ: carcassCenterZ - (carcassDepth / 2) + recess + (t / 2),
        orientation: 'vertical_xy',
        componentRole: 'plinth',
        notes: 'Zócalo trasero perimetral'
      });

      // 5.3 Zócalo Lateral Izquierdo (Encaja limpiamente entre frontal y trasero)
      parts.push({
        id: `${moduleId}_zocalo_lat_izq_${Date.now()}`,
        name: 'Zócalo Lateral Izquierdo',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: plinthInnerD,
        width: plinthH,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: posX - (w / 2) + recess + (t / 2),
        posY: plinthCenterY,
        posZ: carcassCenterZ,
        orientation: 'vertical_yz',
        componentRole: 'plinth',
        notes: 'Zócalo lateral izquierdo perimetral'
      });

      // 5.4 Zócalo Lateral Derecho (Encaja limpiamente entre frontal y trasero)
      parts.push({
        id: `${moduleId}_zocalo_lat_der_${Date.now()}`,
        name: 'Zócalo Lateral Derecho',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: plinthInnerD,
        width: plinthH,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: posX + (w / 2) - recess - (t / 2),
        posY: plinthCenterY,
        posZ: carcassCenterZ,
        orientation: 'vertical_yz',
        componentRole: 'plinth',
        notes: 'Zócalo lateral derecho perimetral'
      });
    }

    // 6. Fondo Trasera MDF
    if (includeBack) {
      const isGroove = config.backType !== 'overlay';
      const backPosZ = isGroove ? (carcassBackZ + 15 + (backT / 2)) : (carcassBackZ - (backT / 2));
      const backLength = isGroove ? Math.max(50, innerWidth - 2) : Math.max(50, w - 4);
      const backHeight = isGroove ? Math.max(50, sideH - 2) : Math.max(50, sideH);

      parts.push({
        id: `${moduleId}_fondo_mdf_${Date.now()}`,
        name: isGroove ? 'Fondo Trasero Ranurado' : 'Fondo Trasero Sobrepuesto',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: backLength,
        width: backHeight,
        thickness: backT,
        quantity: 1,
        materialId: backMat.id,
        materialName: backMat.name,
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: sideCenterY,
        posZ: backPosZ,
        orientation: 'vertical_xy',
        componentRole: 'back',
        notes: `Fondo MDF ${backT}mm`
      });
    }

    // 7. Generación de Gavetas / Cajones
    const carcassFloorTopY = posY - (h / 2) + plinthH + t;
    const carcassRoofBottomY = posY + (h / 2) - t;
    const frontStartBaseY = isOverlay ? (posY - (h / 2) + plinthH) : carcassFloorTopY;

    const availableFrontH = isOverlay
      ? (h - plinthH - t - (gap * (drawersCount + 1)))
      : (sideH - t - (gap * (drawersCount + 1)));

    const frontHeight = Math.max(60, Math.floor((availableFrontH / drawersCount) * 10) / 10);
    const frontWidth = isOverlay ? Math.max(100, w - (gap * 2)) : Math.max(100, innerWidth - (gap * 2));
    const frontCenterZ = isOverlay ? (posZ + (d / 2) - (doorT / 2)) : (carcassFrontZ - (doorT / 2));

    const standardLengths = [250, 300, 350, 400, 450, 500, 550, 600];
    const targetDepth = carcassDepth - 35;
    const slideLength = standardLengths.filter(l => l <= targetDepth).pop() || 350;

    const boxWallT = Math.min(t, 18);
    const boxClearancePerSide = 12.7; // 1/2" por lado para corredera
    const boxOuterWidth = innerWidth - (boxClearancePerSide * 2);
    const boxInnerWidth = boxOuterWidth - (2 * boxWallT);
    const targetBoxHeight = Math.max(60, Math.min(Math.floor(frontHeight * 0.68), 200));
    const boxFrontZ = frontCenterZ - (doorT / 2);

    for (let i = 0; i < drawersCount; i++) {
      const drawerIdx = i + 1; // 1 = Inferior, ..., N = Superior
      const drawerUid = `${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`;
      const drawerLabel = drawersCount === 3
        ? (i === 0 ? 'Cajón Inferior' : (i === 1 ? 'Cajón Medio' : 'Cajón Superior'))
        : `Cajón ${drawerIdx}`;

      const frontBottomY = frontStartBaseY + gap + (i * (frontHeight + gap));
      const frontTopY = frontBottomY + frontHeight;
      const frontCenterY = frontBottomY + (frontHeight / 2);

      // Ventana vertical segura detrás del frente para evitar colisión con Piso Inferior (i=0) y Cubierta Superior
      const minSafeBoxY = Math.max(frontBottomY + 6, carcassFloorTopY + 10);
      const maxSafeBoxY = Math.min(frontTopY - 8, carcassRoofBottomY - 8);
      const availBoxWindowH = Math.max(45, maxSafeBoxY - minSafeBoxY);
      const drawerBoxH = Math.max(45, Math.min(targetBoxHeight, Math.floor(availBoxWindowH)));
      const boxBottomY = minSafeBoxY + Math.min(6, Math.max(0, (availBoxWindowH - drawerBoxH) * 0.25));
      const boxCenterY = boxBottomY + (drawerBoxH / 2);

      // Frente Decorativo Exterior
      parts.push({
        id: `${moduleId}_caj_${drawerIdx}_frente_${drawerUid}`,
        name: `${drawerLabel} - Frente Vista`,
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: frontWidth,
        width: frontHeight,
        thickness: doorT,
        quantity: 1,
        materialId: frontMat.id,
        materialName: frontMat.name,
        grain: frontMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX,
        posY: frontCenterY,
        posZ: frontCenterZ,
        orientation: 'vertical_xy',
        componentRole: 'drawer_front',
        hardwareConfig: {
          isMovable: true,
          movableType: 'drawer',
          slideType,
          slideLength,
          handleType: hType,
          handleFinish: hFinish,
          handlePosition: 'horizontal',
          isOpen: false
        },
        notes: `Frente exterior ${drawerLabel}`
      });

      // Lateral Izquierdo de Caja
      parts.push({
        id: `${moduleId}_caj_${drawerIdx}_lat_izq_${drawerUid}`,
        name: `${drawerLabel} - Lateral Izquierdo`,
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: slideLength,
        width: drawerBoxH,
        thickness: boxWallT,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: posX - (boxOuterWidth / 2) + (boxWallT / 2),
        posY: boxCenterY,
        posZ: boxFrontZ - (slideLength / 2),
        orientation: 'vertical_yz',
        componentRole: 'drawer_box',
        notes: `Lateral cajón corredera ${slideLength}mm`
      });

      // Lateral Derecho de Caja
      parts.push({
        id: `${moduleId}_caj_${drawerIdx}_lat_der_${drawerUid}`,
        name: `${drawerLabel} - Lateral Derecho`,
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: slideLength,
        width: drawerBoxH,
        thickness: boxWallT,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: posX + (boxOuterWidth / 2) - (boxWallT / 2),
        posY: boxCenterY,
        posZ: boxFrontZ - (slideLength / 2),
        orientation: 'vertical_yz',
        componentRole: 'drawer_box',
        notes: `Lateral cajón corredera ${slideLength}mm`
      });

      // Contrafrente Interior de Caja (entre laterales)
      parts.push({
        id: `${moduleId}_caj_${drawerIdx}_contrafrente_${drawerUid}`,
        name: `${drawerLabel} - Contrafrente Interior`,
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: boxInnerWidth,
        width: drawerBoxH,
        thickness: boxWallT,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: boxCenterY,
        posZ: boxFrontZ - (boxWallT / 2),
        orientation: 'vertical_xy',
        componentRole: 'drawer_box',
        notes: 'Frente interior atornillado al frente vista'
      });

      // Trasera Interior de Caja (entre laterales)
      parts.push({
        id: `${moduleId}_caj_${drawerIdx}_trasera_${drawerUid}`,
        name: `${drawerLabel} - Trasera Interior`,
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: boxInnerWidth,
        width: drawerBoxH,
        thickness: boxWallT,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: boxCenterY,
        posZ: boxFrontZ - slideLength + (boxWallT / 2),
        orientation: 'vertical_xy',
        componentRole: 'drawer_box',
        notes: 'Trasera de caja interior'
      });

      // Fondo MDF de Caja
      const isTopDrawer = (i === drawersCount - 1);
      const drawerBottomPart: Part = {
        id: `${moduleId}_caj_${drawerIdx}_fondo_${drawerUid}`,
        name: `${drawerLabel} - Fondo MDF`,
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: boxInnerWidth,
        width: slideLength - (2 * boxWallT),
        thickness: backT,
        quantity: 1,
        materialId: backMat.id,
        materialName: backMat.name,
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: boxCenterY - (drawerBoxH / 2) + (backT / 2) + 8,
        posZ: boxFrontZ - (slideLength / 2),
        orientation: 'horizontal',
        componentRole: 'drawer_box',
        notes: (isTopDrawer && config.siphonCutout?.enabled)
          ? `Fondo de cajón MDF ${backT}mm con destaje en U para sifón`
          : `Fondo de cajón MDF ${backT}mm`
      };
      if (isTopDrawer && config.siphonCutout?.enabled) {
        drawerBottomPart.cornerCutConfig = {
          type: 'u_siphon_cutout',
          corner: 'back_left',
          cutX: Math.min(boxInnerWidth - 40, config.siphonCutout.width || 180),
          cutY: Math.min(slideLength - (2 * boxWallT) - 20, config.siphonCutout.depth || 180)
        };
      }
      parts.push(drawerBottomPart);
    }

    const module: FurnitureModule = {
      id: moduleId,
      name: groupName,
      type: 'base_cabinet',
      width: w,
      height: h,
      depth: d,
      boardThickness: t,
      backThickness: backT,
      backType: config.backType || 'groove',
      shelvesCount: 0,
      doorsCount: 0,
      doorsType: 'overlay',
      drawersCount,
      hasPlinth,
      plinthHeight: plinthH,
      materialId: mainMat.id,
      backMaterialId: backMat.id,
      defaultThinEdge: true,
      defaultThickDoors: true
    };

    const group: PartGroup = {
      id: groupId,
      name: groupName,
      type: 'drawer',
      isOpen: false,
      parametricConfig: {
        ...config,
        moduleType: 'drawer_unit',
        category: 'drawers',
        drawersCount,
        shelvesCount: 0,
        doorOpening: 'none',
        hangingRodsCount: 0
      }
    };

    return { module, parts, group };
  }

  /**
   * Reconstruye una configuración paramétrica a partir de las piezas existentes de un grupo
   */
  reconstructConfigFromParts(parts: Part[], group: PartGroup): ParametricCabinetConfig {
    const isCt = group.isCountertop || parts.some(p => p.componentRole === 'countertop' || p.componentRole === 'backsplash');

    const normalizeConfig = (raw: Partial<ParametricCabinetConfig>): ParametricCabinetConfig => {
      const safeWidth = Math.max(200, Number(raw.width) || 600);
      const safeHeight = Math.max(200, Number(raw.height) || 800);
      const safeDepth = Math.max(150, Number(raw.depth) || 350);
      const safeStructT = Math.max(9, Math.min(22, Number(raw.structureThickness) || 15));
      const safeDoorT = Math.max(9, Math.min(22, Number(raw.doorThickness) || safeStructT));
      const safeBackT = Math.max(3, Number(raw.backThickness) || 3);

      const isWallType = raw.moduleType === 'wall_cabinet' ||
        raw.category === 'kitchen_wall' ||
        raw.category === 'bathroom_wall' ||
        (raw.name && (
          raw.name.toLowerCase().includes('alacena') ||
          raw.name.toLowerCase().includes('aéreo') ||
          raw.name.toLowerCase().includes('aereo') ||
          raw.name.toLowerCase().includes('colgante') ||
          raw.name.toLowerCase().includes('botiquín') ||
          raw.name.toLowerCase().includes('botiquin')
        ));
      const isDrawerType = raw.moduleType === 'drawer_unit' || raw.category === 'drawers' || raw.category === 'cajones';
      const isClosetType = raw.moduleType === 'closet' ||
        raw.category === 'closet' ||
        raw.environmentLine === 'closet' ||
        (raw.name && (
          raw.name.toLowerCase().includes('closet') ||
          raw.name.toLowerCase().includes('ropero') ||
          raw.name.toLowerCase().includes('armario') ||
          raw.name.toLowerCase().includes('colgador')
        ));
      const isBathroomOrSink = !isWallType && !isClosetType && (
        raw.moduleType === 'vanity' ||
        raw.category === 'vanity' ||
        raw.category === 'sink_base' ||
        raw.environmentLine === 'bathroom' ||
        (raw.name && (
          raw.name.toLowerCase().includes('vanit') ||
          raw.name.toLowerCase().includes('lavamanos') ||
          raw.name.toLowerCase().includes('lavaplatos') ||
          raw.name.toLowerCase().includes('fregadero')
        )) ||
        (raw.code && (raw.code.toLowerCase().includes('sink') || raw.code.toLowerCase().includes('lav')))
      ) && !(
        raw.name && (raw.name.toLowerCase().includes('horno') || raw.name.toLowerCase().includes('isla'))
      );

      let resolvedDrawersCount = 0;
      if (isWallType) {
        resolvedDrawersCount = 0;
      } else if (isDrawerType) {
        resolvedDrawersCount = Math.max(1, Math.min(6, Math.floor(Number(raw.drawersCount) || 3)));
      } else if (raw.drawersCount !== undefined && Number(raw.drawersCount) > 0) {
        resolvedDrawersCount = Math.min(6, Math.floor(Number(raw.drawersCount)));
      } else {
        resolvedDrawersCount = 0;
      }

      const safeShelvesCount = isDrawerType
        ? 0
        : Math.max(0, Math.min(8, Math.floor(Number(raw.shelvesCount) || 0)));
      const innerH = Math.max(100, safeHeight - (2 * safeStructT));

      let validOffsets: number[] = [];
      if (safeShelvesCount > 0) {
        if (Array.isArray(raw.shelfManualOffsets) && raw.shelfManualOffsets.length === safeShelvesCount) {
          validOffsets = raw.shelfManualOffsets.map((v, i) => {
            const num = Number(v);
            if (!Number.isFinite(num) || num <= 0) {
              const gap = (innerH - (safeShelvesCount * safeStructT)) / (safeShelvesCount + 1);
              return Math.max(40, Math.round(gap * (i + 1) + (i * safeStructT)));
            }
            return Math.max(40, Math.min(innerH - 40, Math.round(num)));
          });
        } else {
          const gap = (innerH - (safeShelvesCount * safeStructT)) / (safeShelvesCount + 1);
          for (let i = 0; i < safeShelvesCount; i++) {
            const yFromBottom = Math.round(gap * (i + 1) + (i * safeStructT));
            validOffsets.push(Math.max(40, Math.min(innerH - 40, yFromBottom)));
          }
        }
      }

      const safeDoorOpening = isDrawerType ? 'none' : (raw.doorOpening || 'none');
      const safeHangingRodsCount: 0 | 1 | 2 = isClosetType
        ? (raw.hangingRodsCount === 1 ? 1 : raw.hangingRodsCount === 2 ? 2 : 0)
        : 0;

      const safeSiphonCutout = (isBathroomOrSink && raw.siphonCutout?.enabled)
        ? { enabled: true, width: Number(raw.siphonCutout.width) || 200, depth: Number(raw.siphonCutout.depth) || 250 }
        : { enabled: false, width: 200, depth: 250 };

      return {
        name: raw.name || group.name || 'Módulo Paramétrico',
        code: raw.code || ('MOD_' + group.id.slice(-4)),
        moduleType: raw.moduleType || 'base_cabinet',
        category: raw.category || 'kitchen_base',
        environmentLine: raw.environmentLine,
        width: safeWidth,
        height: safeHeight,
        depth: safeDepth,
        structureThickness: safeStructT,
        doorThickness: safeDoorT,
        backThickness: safeBackT,
        backType: raw.backType || 'groove',
        hasBackPanel: raw.hasBackPanel !== undefined ? Boolean(raw.hasBackPanel) : true,
        shelvesCount: safeShelvesCount,
        shelfDistribution: raw.shelfDistribution === 'manual' ? 'manual' : 'uniform',
        shelfManualOffsets: validOffsets,
        doorOpening: safeDoorOpening,
        hasHandle: raw.hasHandle !== undefined ? Boolean(raw.hasHandle) : true,
        handleType: raw.handleType || 'bar_modern',
        handleFinish: raw.handleFinish || 'brushed_steel',
        handlePosition: raw.handlePosition || 'vertical',
        structureMaterialId: raw.structureMaterialId || 'mat-1',
        doorMaterialId: raw.doorMaterialId || raw.structureMaterialId || 'mat-1',
        backMaterialId: raw.backMaterialId || raw.structureMaterialId || 'mat-1',
        facadeGap: Number(raw.facadeGap) || 3,
        posX: Number.isFinite(Number(raw.posX)) ? Number(raw.posX) : 0,
        posY: Number.isFinite(Number(raw.posY)) ? Number(raw.posY) : undefined,
        posZ: Number.isFinite(Number(raw.posZ)) ? Number(raw.posZ) : 0,
        drawersCount: resolvedDrawersCount,
        drawerSlideType: raw.drawerSlideType || 'telescopic',
        drawerFrontType: raw.drawerFrontType || 'overlay',
        hasPlinth: isWallType ? false : (raw.hasPlinth !== undefined ? Boolean(raw.hasPlinth) : true),
        plinthHeight: isWallType ? 0 : (Number(raw.plinthHeight) || 70),
        topTieStrips: isWallType ? false : Boolean(raw.topTieStrips),
        hasTopCover: isWallType ? true : (raw.hasTopCover !== undefined ? Boolean(raw.hasTopCover) : true),
        hangingRodsCount: safeHangingRodsCount,
        siphonCutout: safeSiphonCutout
      };
    };

    if (isCt) {
      return normalizeConfig({
        name: group.name || 'Mesón Monolítico',
        code: 'MES_' + group.id.slice(-4),
        moduleType: 'custom',
        category: 'custom',
        drawersCount: 0,
        shelvesCount: 0,
        doorOpening: 'none',
        hangingRodsCount: 0,
        hasPlinth: false,
        topTieStrips: false,
        hasTopCover: true
      });
    }

    const drawerFronts = parts.filter(p => p.componentRole === 'drawer_front');
    const drawerBoxes = parts.filter(p => p.componentRole === 'drawer_box');
    const doorParts = parts.filter(p => p.componentRole === 'door');
    const shelfParts = parts.filter(p => p.componentRole === 'shelf');
    const backPart = parts.find(p => p.componentRole === 'back');
    const rodParts = parts.filter(p => p.name.includes('Tubo Colgador') || p.notes?.includes('colgado') || p.materialId === 'hw_rod_chrome');
    const actualRodCount: 0 | 1 | 2 = rodParts.length >= 2 ? 2 : (rodParts.length === 1 ? 1 : 0);
    const actualDrawerCount = drawerFronts.length > 0
      ? drawerFronts.length
      : (drawerBoxes.length > 0 ? Math.max(1, Math.round(drawerBoxes.length / 5)) : 0);

    if (group.parametricConfig) {
      const cfg = normalizeConfig(group.parametricConfig);

      // Regla de Oro: Coherencia física 1:1 con las piezas reales en 3D y Despiece
      // 1. Cajones: si en 3D no hay piezas físicas de cajón, drawersCount DEBE ser 0 (incluso en drawer_unit).
      // Si hay piezas físicas de cajón, drawersCount DEBE reflejar exactamente la cantidad física.
      const isWall = cfg.moduleType === 'wall_cabinet' || cfg.category === 'kitchen_wall' || cfg.category === 'bathroom_wall';
      if (actualDrawerCount === 0 || isWall) {
        cfg.drawersCount = 0;
      } else {
        cfg.drawersCount = actualDrawerCount;
      }

      // 2. Puertas: si en 3D no hay puertas físicas, doorOpening DEBE ser 'none'.
      if (doorParts.length === 0) {
        cfg.doorOpening = 'none';
      } else if (doorParts.length === 1 && (cfg.doorOpening === 'none' || cfg.doorOpening === 'double')) {
        cfg.doorOpening = 'left';
      } else if (doorParts.length >= 2 && cfg.doorOpening !== 'double') {
        cfg.doorOpening = 'double';
      }

      // 3. Repisas: en cajonera pura es 0. En muebles de puertas/repisas, refleja la cantidad física real en 3D.
      if (cfg.moduleType === 'drawer_unit' || cfg.category === 'drawers' || cfg.category === 'cajones') {
        cfg.shelvesCount = 0;
      } else {
        cfg.shelvesCount = Math.min(8, shelfParts.length);
      }

      // 4. Barras Colgador: en muebles que no son closet o que no tienen tubos en 3D, es 0.
      const isCloset = cfg.moduleType === 'closet' || cfg.category === 'closet' || cfg.environmentLine === 'closet' ||
        (cfg.name && (cfg.name.toLowerCase().includes('closet') || cfg.name.toLowerCase().includes('ropero') || cfg.name.toLowerCase().includes('armario') || cfg.name.toLowerCase().includes('colgador')));
      if (!isCloset || actualRodCount === 0) {
        cfg.hangingRodsCount = 0;
      } else {
        cfg.hangingRodsCount = actualRodCount;
      }

      return cfg;
    }

    const sidePart = parts.find(p => p.componentRole === 'side_left' || p.componentRole === 'side_right') || parts[0];
    const topOrBottom = parts.find(p => p.componentRole === 'top' || p.componentRole === 'bottom');

    const t = Number(sidePart?.thickness) || 15;
    const sideLocal = sidePart ? this.partGeometry.getLocalDimensions(sidePart) : null;
    const height = sideLocal ? sideLocal.sy : 800;
    const innerWidth = topOrBottom
      ? Number(sidePart?.orientation === 'vertical_xy' ? topOrBottom.width : topOrBottom.length) || 570
      : 570;
    const width = innerWidth + (2 * t);
    const doorT = doorParts.length > 0
      ? (Number(doorParts[0]?.thickness) || t)
      : (drawerFronts.length > 0 ? (Number(drawerFronts[0]?.thickness) || t) : t);
    const carcassDepth = sidePart && sideLocal
      ? (sidePart.orientation === 'vertical_xy' ? sideLocal.sx : sideLocal.sz)
      : 300;
    const depth = carcassDepth + (doorParts.length > 0 || drawerFronts.length > 0 ? doorT : 0);

    // Caso de módulo con cajones (Cajonera)
    if (drawerFronts.length > 0 || drawerBoxes.length > 0) {
      const drawersCount = actualDrawerCount;
      const frontPart = drawerFronts[0];
      const hw = frontPart?.hardwareConfig;
      const plinthPart = parts.find(p => p.componentRole === 'plinth');

      return normalizeConfig({
        name: group.name || 'Cajonera Paramétrica',
        code: 'CAJ_' + group.id.slice(-4),
        moduleType: 'drawer_unit',
        category: 'drawers',
        width,
        height,
        depth,
        structureThickness: t,
        doorThickness: doorT,
        backThickness: Number(backPart?.thickness) || 3,
        backType: backPart ? 'groove' : 'none',
        hasBackPanel: !!backPart,
        shelvesCount: 0,
        doorOpening: 'none',
        drawersCount,
        drawerSlideType: (hw?.slideType && hw.slideType !== 'none') ? hw.slideType : 'telescopic',
        drawerFrontType: 'overlay',
        hasPlinth: !!plinthPart,
        plinthHeight: plinthPart ? Number(plinthPart.width || 70) : 0,
        hasHandle: hw?.handleType !== 'none',
        handleType: hw?.handleType || 'bar_modern',
        handleFinish: hw?.handleFinish || 'brushed_steel',
        handlePosition: 'horizontal',
        structureMaterialId: sidePart?.materialId || 'mat-1',
        doorMaterialId: frontPart?.materialId || sidePart?.materialId || 'mat-1',
        backMaterialId: backPart?.materialId || sidePart?.materialId || 'mat-1',
        facadeGap: 3,
        posX: Number(parts[0]?.posX) || 0,
        posY: sidePart?.posY !== undefined ? Number(sidePart.posY) : undefined,
        posZ: Number(parts[0]?.posZ) || 0
      });
    }

    let doorOpening: ParametricCabinetConfig['doorOpening'] = 'none';
    if (doorParts.length >= 2) {
      doorOpening = 'double';
    } else if (doorParts.length === 1) {
      const hw = doorParts[0].hardwareConfig;
      if (hw?.openingDirection === 'top') {
        doorOpening = 'top';
      } else if (hw?.openingDirection === 'right') {
        doorOpening = 'right';
      } else {
        doorOpening = 'left';
      }
    }

    const shelvesCount = Math.max(0, Math.min(8, Math.floor(Number(shelfParts.length) || 0)));
    const hangingRodsCount: 0 | 1 | 2 = actualRodCount;
    const isWallByPosition = parts[0]?.name.toLowerCase().includes('alacena') || (sidePart?.posY !== undefined && sidePart.posY > 1000);

    return normalizeConfig({
      name: group.name,
      code: 'MOD_' + group.id.slice(-4),
      moduleType: isWallByPosition ? 'wall_cabinet' : 'base_cabinet',
      category: isWallByPosition ? 'kitchen_wall' : 'kitchen_base',
      width,
      height,
      depth,
      structureThickness: t,
      doorThickness: doorT,
      backThickness: Number(backPart?.thickness) || 3,
      backType: backPart ? 'groove' : 'none',
      hasBackPanel: !!backPart,
      shelvesCount,
      shelfDistribution: 'uniform',
      doorOpening,
      drawersCount: 0,
      hangingRodsCount,
      hasHandle: doorParts[0]?.hardwareConfig?.handleType !== 'none',
      handleType: doorParts[0]?.hardwareConfig?.handleType || 'bar_modern',
      handleFinish: doorParts[0]?.hardwareConfig?.handleFinish || 'brushed_steel',
      handlePosition: doorParts[0]?.hardwareConfig?.handlePosition || 'vertical',
      structureMaterialId: sidePart?.materialId || 'mat-1',
      doorMaterialId: doorParts[0]?.materialId || sidePart?.materialId || 'mat-1',
      backMaterialId: backPart?.materialId || sidePart?.materialId || 'mat-1',
      facadeGap: 3,
      posX: Number(parts[0]?.posX) || 0,
      posY: sidePart?.posY !== undefined ? Number(sidePart.posY) : undefined,
      posZ: Number(parts[0]?.posZ) || 0
    });
  }

  /**
   * Alias de compatibilidad hacia atrás
   */
  generateParametricWallCabinet(
    config: ParametricCabinetConfig, 
    materials: Material[]
  ): { module: FurnitureModule; parts: Part[]; group: PartGroup } {
    return this.generateParametricCabinet(config, materials);
  }

  /**
   * Genera módulos especializados de cocina real:
   * - 'oven_base': Módulo bajo para horno empotrado con nicho de 595mm y gaveta/puerta inferior para latas.
   * - 'sink_base': Módulo bajo lavaplatos sin tapa maciza (con amarres superiores) y libre paso hidráulico.
   * - 'corner_base': Módulo bajo esquinero con chaflán diagonal a 45° para cocinas en L o en U.
   * - 'oven_tower': Torre columna para Horno + Microondas con alacena superior y puerta inferior.
   */
  private generateSpecializedKitchenModule(
    config: ParametricCabinetConfig,
    materials: Material[]
  ): { module: FurnitureModule; parts: Part[]; group: PartGroup } {
    const moduleId = config.id || `module_kpro_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const groupId = `group_kpro_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const groupName = config.name || `Módulo Cocina (${config.code || 'KPRO'})`;

    const mainMat = materials.find(m => m.id === config.structureMaterialId) || materials[0];
    const doorMat = materials.find(m => m.id === config.doorMaterialId) || mainMat;
    const backMat = materials.find(m => m.id === config.backMaterialId) ||
                    materials.find(m => m.thickness <= 6) || mainMat;

    const t = Math.max(12, Number(config.structureThickness) || 15);
    const doorT = Math.max(12, Number(config.doorThickness) || t);
    const backT = Math.max(3, Number(config.backThickness) || 3);
    const w = Math.max(300, Number(config.width) || 600);
    const h = Math.max(400, Number(config.height) || 860);
    const d = Math.max(300, Number(config.depth) || 580);
    const gap = config.facadeGap ?? 3;
    const hasPlinth = config.hasPlinth !== false;
    const plinthH = hasPlinth ? (Number(config.plinthHeight) || 80) : 0;
    const hasHandle = config.hasHandle !== false;
    const hType = hasHandle ? (config.handleType || 'bar_modern') : 'none';
    const hFinish = config.handleFinish || 'brushed_steel';

    const posX = Number.isFinite(Number(config.posX)) ? Number(config.posX) : 0;
    const posY = Number.isFinite(Number(config.posY)) ? Number(config.posY) : (h / 2);
    const posZ = Number.isFinite(Number(config.posZ)) ? Number(config.posZ) : 0;

    const carcassDepth = Math.max(200, d - doorT);
    const carcassCenterZ = posZ - (doorT / 2);
    const carcassFrontZ = carcassCenterZ + (carcassDepth / 2);
    const carcassBackZ = carcassCenterZ - (carcassDepth / 2);
    const doorPosZ = carcassFrontZ + (doorT / 2);

    const innerWidth = Math.max(80, w - (2 * t));
    const sideH = Math.max(200, h - plinthH);
    const bottomOfCarcassY = posY - (h / 2) + plinthH;
    const sideCenterY = bottomOfCarcassY + (sideH / 2);

    const parts: Part[] = [];

    // 1. Zócalo perimetral común (4 lados) para módulos rectangulares (corner_base genera su propio zócalo esquinero)
    if (hasPlinth && plinthH > 0 && config.category !== 'corner_base') {
      const recess = 25;
      const plinthOuterW = Math.max(50, w - (2 * recess));
      const plinthOuterD = Math.max(50, carcassDepth - (2 * recess));
      const plinthInnerD = Math.max(50, plinthOuterD - (2 * t));
      const plinthCenterY = posY - (h / 2) + (plinthH / 2);
      parts.push({
        id: `${moduleId}_zocalo_f_${Date.now()}`,
        name: 'Zócalo Frontal',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: plinthOuterW,
        width: plinthH,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: plinthCenterY,
        posZ: carcassFrontZ - recess - (t / 2),
        orientation: 'vertical_xy',
        componentRole: 'plinth',
        notes: 'Zócalo inferior retranqueado 25mm'
      });
      parts.push({
        id: `${moduleId}_zocalo_t_${Date.now()}`,
        name: 'Zócalo Trasero',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: plinthOuterW,
        width: plinthH,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: plinthCenterY,
        posZ: carcassBackZ + recess + (t / 2),
        orientation: 'vertical_xy',
        componentRole: 'plinth',
        notes: 'Zócalo trasero estructural'
      });
      parts.push({
        id: `${moduleId}_zocalo_li_${Date.now()}`,
        name: 'Zócalo Lateral Izquierdo',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: plinthInnerD,
        width: plinthH,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: posX - (w / 2) + recess + (t / 2),
        posY: plinthCenterY,
        posZ: carcassCenterZ,
        orientation: 'vertical_yz',
        componentRole: 'plinth',
        notes: 'Zócalo lateral izquierdo perimetral'
      });
      parts.push({
        id: `${moduleId}_zocalo_ld_${Date.now()}`,
        name: 'Zócalo Lateral Derecho',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: plinthInnerD,
        width: plinthH,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: posX + (w / 2) - recess - (t / 2),
        posY: plinthCenterY,
        posZ: carcassCenterZ,
        orientation: 'vertical_yz',
        componentRole: 'plinth',
        notes: 'Zócalo lateral derecho perimetral'
      });
    }

    if (config.category === 'corner_base') {
      // MÓDULO ESQUINERO EN L PENTAGONAL (900x900 mm con retornos de 580 mm)
      const returnD = Math.min(580, Math.max(300, w - 100));
      const cutX = Math.max(100, w - returnD);
      const cutY = Math.max(100, carcassDepth - returnD);

      const cornerConfig: PartCornerCutConfig = {
        type: 'chamfer_corner',
        corner: 'front_right',
        cutX: Math.max(50, cutX - t),
        cutY: Math.max(50, cutY - t)
      };
      const innerCornerW = Math.max(50, w - (2 * t));
      const innerCornerD = Math.max(50, carcassDepth - (2 * t));
      const contour = this.buildCornerCutContour(innerCornerW, innerCornerD, cornerConfig);

      // 1. Costado Izquierdo (apoyo a pared izquierda)
      parts.push({
        id: `${moduleId}_lat_izq_${Date.now()}`,
        name: 'Lateral Izquierdo Apoyo a Pared',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: sideH,
        width: carcassDepth,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
        posX: posX - (w / 2) + (t / 2),
        posY: sideCenterY,
        posZ: carcassCenterZ,
        orientation: 'vertical_yz',
        componentRole: 'side_left',
        notes: 'Costado profundo apoyo a pared'
      });

      // 2. Respaldo Trasero Estructural (apoyo a pared trasera)
      parts.push({
        id: `${moduleId}_respaldo_tras_${Date.now()}`,
        name: 'Respaldo Trasero Apoyo a Pared',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: Math.max(50, w - (2 * t)),
        width: sideH,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
        posX,
        posY: sideCenterY,
        posZ: carcassBackZ + (t / 2),
        orientation: 'vertical_xy',
        componentRole: 'back',
        notes: 'Respaldo estructural macizo apoyo a pared'
      });

      // 3. Costado Retorno Derecho (conecta con mueble contiguo de 580mm)
      parts.push({
        id: `${moduleId}_lat_der_ret_${Date.now()}`,
        name: 'Costado Retorno Derecho (580mm)',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: sideH,
        width: returnD,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
        posX: posX + (w / 2) - (t / 2),
        posY: sideCenterY,
        posZ: carcassBackZ + (returnD / 2),
        orientation: 'vertical_yz',
        componentRole: 'side_right',
        notes: 'Costado de retorno hacia hilera derecha'
      });

      // 4. Costado Retorno Frontal Izquierdo (conecta con hilera frontal)
      const frontReturnL = Math.max(50, returnD - t);
      parts.push({
        id: `${moduleId}_lat_front_ret_${Date.now()}`,
        name: 'Costado Retorno Frontal (580mm)',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: frontReturnL,
        width: sideH,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
        posX: posX - (w / 2) + t + (frontReturnL / 2),
        posY: sideCenterY,
        posZ: carcassFrontZ - (t / 2),
        orientation: 'vertical_xy',
        componentRole: 'side_left',
        notes: 'Costado de retorno hacia hilera frontal'
      });

      // 5. Piso, Techo y Entrepaño con chaflán diagonal 45°
      const levels: { role: 'bottom' | 'shelf' | 'top'; name: string; y: number }[] = [
        { role: 'bottom', name: 'Piso Esquinero Pentagonal 45°', y: bottomOfCarcassY + (t / 2) }
      ];
      const shelvesCount = config.shelvesCount !== undefined ? config.shelvesCount : 1;
      if (shelvesCount > 0) {
        const spacing = sideH / (shelvesCount + 1);
        for (let s = 1; s <= shelvesCount; s++) {
          levels.push({
            role: 'shelf',
            name: shelvesCount === 1 ? 'Entrepaño Interior Esquinero 45°' : `Entrepaño ${s} Esquinero 45°`,
            y: bottomOfCarcassY + (spacing * s)
          });
        }
      }
      const hasTopCover = config.hasTopCover !== false;
      const topTieStrips = config.topTieStrips === true;
      if (hasTopCover || topTieStrips) {
        levels.push({
          role: 'top',
          name: topTieStrips ? 'Amarres Superiores Pentagonales 45°' : 'Tapa Superior Esquinera 45°',
          y: bottomOfCarcassY + sideH - (t / 2)
        });
      }
      for (const lv of levels) {
        parts.push({
          id: `${moduleId}_${lv.role}_45_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          name: lv.name,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: innerCornerW,
          width: innerCornerD,
          thickness: t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
          posX,
          posY: lv.y,
          posZ: carcassCenterZ,
          orientation: 'horizontal',
          componentRole: lv.role,
          shapeType: 'freehand',
          contourPoints: contour,
          cornerCutConfig: cornerConfig,
          notes: `Pentagonal con chaflán 45° (${cutX}x${cutY} mm)`
        });
      }

      // 6. Puerta Diagonal Frontal a 45°
      const openLeftX = posX - (w / 2) + returnD;
      const openLeftZ = carcassFrontZ;
      const openRightX = posX + (w / 2) - t;
      const openRightZ = carcassBackZ + returnD;

      const openMidX = (openLeftX + openRightX) / 2;
      const openMidZ = (openLeftZ + openRightZ) / 2;
      const openSpan = Math.hypot(openRightX - openLeftX, openLeftZ - openRightZ);

      // Puerta con holgura perimetral milimétrica para evitar roce con costados de retorno
      const cornerDoorGap = Math.max(gap, 4);
      const diagDoorW = Math.max(240, Math.round(openSpan - (cornerDoorGap * 2)));
      const diagNormal = Math.SQRT1_2;
      const doorCenterX = openMidX + ((doorT / 2 + 1) * diagNormal);
      const doorCenterZ = openMidZ + ((doorT / 2 + 1) * diagNormal);

      const hasCornerDoor = config.doorOpening !== 'none';
      if (hasCornerDoor) {
        parts.push({
          id: `${moduleId}_puerta_diag_${Date.now()}`,
          name: 'Puerta Esquinera Diagonal 45°',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: diagDoorW,
          width: sideH - gap,
          thickness: doorT,
          quantity: 1,
          materialId: doorMat.id,
          materialName: doorMat.name,
          grain: doorMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX: doorCenterX,
          posY: sideCenterY,
          posZ: doorCenterZ,
          rotationY: 45,
          orientation: 'vertical_xy',
          componentRole: 'door',
          hardwareConfig: {
            isMovable: true,
            movableType: 'door',
            openingDirection: 'left',
            hingeType: 'straight',
            handleType: hType,
            handleFinish: hFinish,
            handlePosition: 'vertical',
            isOpen: false
          },
          notes: 'Puerta esquinera con bisagra angular 45°'
        });
      }

      // 7. Zócalos perimetrales alineados con la huella pentagonal a 45°
      if (hasPlinth && plinthH > 0) {
        const recess = 25;
        const plinthCenterY = posY - (h / 2) + (plinthH / 2);

        // Zócalo diagonal 45° centrado bajo la puerta y retranqueado
        const plinthRecess = 24;
        const zDiagCenterX = doorCenterX - (plinthRecess * diagNormal);
        const zDiagCenterZ = doorCenterZ - (plinthRecess * diagNormal);
        const zDiagL = Math.max(100, Math.round(openSpan - 60));

        // Extensión máxima de la caja del zócalo diagonal en los ejes X y Z
        const hxWorld = ((zDiagL + t) * diagNormal) / 2;
        const diagMinX = zDiagCenterX - hxWorld;
        const diagMinZ = zDiagCenterZ - hxWorld;

        // Zócalos de retorno ajustados milimétricamente para conectar al ras sin solapar la caja diagonal
        const zFrontStartX = posX - (w / 2) + recess;
        const zFrontEndX = Math.min(openLeftX, Math.floor(diagMinX - 1));
        const zFrontW = Math.max(50, zFrontEndX - zFrontStartX);

        parts.push({
          id: `${moduleId}_zocalo_ret_f_${Date.now()}`,
          name: 'Zócalo Retorno Frontal',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: zFrontW,
          width: plinthH,
          thickness: t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: zFrontStartX + (zFrontW / 2),
          posY: plinthCenterY,
          posZ: carcassFrontZ - recess - (t / 2),
          orientation: 'vertical_xy',
          componentRole: 'plinth',
          notes: 'Zócalo frontal esquinero retranqueado'
        });

        // Zócalo retorno derecho alineado simétricamente
        const zRightStartZ = carcassBackZ + recess;
        const zRightEndZ = Math.min(openRightZ, Math.floor(diagMinZ - 1));
        const zRightD = Math.max(50, zRightEndZ - zRightStartZ);

        parts.push({
          id: `${moduleId}_zocalo_ret_d_${Date.now()}`,
          name: 'Zócalo Retorno Derecho',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: zRightD,
          width: plinthH,
          thickness: t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: posX + (w / 2) - recess - (t / 2),
          posY: plinthCenterY,
          posZ: zRightStartZ + (zRightD / 2),
          orientation: 'vertical_yz',
          componentRole: 'plinth',
          notes: 'Zócalo derecho esquinero retranqueado'
        });

        parts.push({
          id: `${moduleId}_zocalo_diag_${Date.now()}`,
          name: 'Zócalo Diagonal 45°',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: zDiagL,
          width: plinthH,
          thickness: t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: zDiagCenterX,
          posY: plinthCenterY,
          posZ: zDiagCenterZ,
          rotationY: 45,
          orientation: 'vertical_xy',
          componentRole: 'plinth',
          notes: 'Zócalo chaflanado a 45° bajo la puerta'
        });
      }
    } else if (config.category === 'blind_corner_base') {
      // MÓDULO BAJO ESQUINERO RECTO CIEGO (1000x580 mm con Panel Ciego de 450 mm + Puerta Batiente)
      const blindW = Math.min(500, Math.max(350, Number(config.cornerReturnWidth) || 450));
      const accessDoorW = Math.max(250, w - blindW - (gap * 2));

      // Laterales estándar
      parts.push({
        id: `${moduleId}_lat_izq_${Date.now()}`,
        name: 'Lateral Izquierdo',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: sideH,
        width: carcassDepth,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
        posX: posX - (w / 2) + (t / 2),
        posY: sideCenterY,
        posZ: carcassCenterZ,
        orientation: 'vertical_yz',
        componentRole: 'side_left',
        notes: 'Costado izquierdo de módulo ciego'
      });
      parts.push({
        id: `${moduleId}_lat_der_${Date.now()}`,
        name: 'Lateral Derecho',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: sideH,
        width: carcassDepth,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
        posX: posX + (w / 2) - (t / 2),
        posY: sideCenterY,
        posZ: carcassCenterZ,
        orientation: 'vertical_yz',
        componentRole: 'side_right',
        notes: 'Costado derecho fondo de rincón'
      });

      // Piso inferior
      parts.push({
        id: `${moduleId}_piso_${Date.now()}`,
        name: 'Piso Inferior',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: innerWidth,
        width: carcassDepth,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: bottomOfCarcassY + (t / 2),
        posZ: carcassCenterZ,
        orientation: 'horizontal',
        componentRole: 'bottom',
        notes: 'Base inferior estructural'
      });

      // Amarres superiores
      const tieWidth = 90;
      parts.push({
        id: `${moduleId}_amarre_f_${Date.now()}`,
        name: 'Amarre Frontal Superior',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: innerWidth,
        width: tieWidth,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: bottomOfCarcassY + sideH - (t / 2),
        posZ: carcassFrontZ - (tieWidth / 2),
        orientation: 'horizontal',
        componentRole: 'tie',
        notes: 'Amarre frontal superior'
      });
      parts.push({
        id: `${moduleId}_amarre_t_${Date.now()}`,
        name: 'Amarre Trasero Superior',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: innerWidth,
        width: tieWidth,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: bottomOfCarcassY + sideH - (t / 2),
        posZ: carcassBackZ + (tieWidth / 2),
        orientation: 'horizontal',
        componentRole: 'tie',
        notes: 'Amarre trasero superior'
      });

      // Fondo trasero MDF
      if (config.hasBackPanel !== false) {
        parts.push({
          id: `${moduleId}_fondo_ciego_${Date.now()}`,
          name: 'Fondo Trasero Ranurado',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: Math.max(50, innerWidth - 2),
          width: Math.max(50, sideH - 2),
          thickness: backT,
          quantity: 1,
          materialId: backMat.id,
          materialName: backMat.name,
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX,
          posY: sideCenterY,
          posZ: carcassBackZ + 15 + (backT / 2),
          orientation: 'vertical_xy',
          componentRole: 'back',
          notes: `Fondo MDF ${backT}mm`
        });
      }

      // Panel Ciego Fijo (450 mm en el costado derecho)
      const blindPosX = posX + (w / 2) - (blindW / 2);
      parts.push({
        id: `${moduleId}_panel_ciego_${Date.now()}`,
        name: 'Panel Ciego Fijo de Rincón',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: blindW,
        width: sideH - gap,
        thickness: doorT,
        quantity: 1,
        materialId: doorMat.id,
        materialName: doorMat.name,
        grain: doorMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX: blindPosX,
        posY: sideCenterY,
        posZ: doorPosZ,
        orientation: 'vertical_xy',
        componentRole: 'door',
        notes: 'Panel ciego fijo de rincón para encuentro de mueble perpendicular'
      });

      // Puerta Batiente de Acceso (lado izquierdo)
      const doorPosX = posX - (w / 2) + (accessDoorW / 2) + gap;
      parts.push({
        id: `${moduleId}_puerta_acceso_${Date.now()}`,
        name: 'Puerta de Acceso a Rincón',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: accessDoorW,
        width: sideH - gap,
        thickness: doorT,
        quantity: 1,
        materialId: doorMat.id,
        materialName: doorMat.name,
        grain: doorMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX: doorPosX,
        posY: sideCenterY,
        posZ: doorPosZ,
        orientation: 'vertical_xy',
        componentRole: 'door',
        hardwareConfig: {
          isMovable: true,
          movableType: 'door',
          openingDirection: 'left',
          hingeType: 'straight',
          handleType: hType,
          handleFinish: hFinish,
          handlePosition: 'vertical',
          isOpen: false
        },
        notes: 'Puerta abatible para acceso al rincón ciego'
      });

      // Listón vertical estructural de cierre tras panel ciego
      parts.push({
        id: `${moduleId}_liston_cierre_${Date.now()}`,
        name: 'Listón de Cierre Interior',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: Math.max(50, sideH - (2 * t)),
        width: 70,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: posX + (w / 2) - blindW - (t / 2),
        posY: sideCenterY,
        posZ: carcassFrontZ - 35,
        orientation: 'vertical_yz',
        componentRole: 'tie',
        notes: 'Listón vertical para fijación de panel ciego y tope de puerta'
      });
    } else {
      // Laterales estándar para oven_base, sink_base y oven_tower
      parts.push({
        id: `${moduleId}_lat_izq_${Date.now()}`,
        name: 'Lateral Izquierdo',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: sideH,
        width: carcassDepth,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
        posX: posX - (w / 2) + (t / 2),
        posY: sideCenterY,
        posZ: carcassCenterZ,
        orientation: 'vertical_yz',
        componentRole: 'side_left',
        notes: 'Costado estructural izquierdo'
      });

      parts.push({
        id: `${moduleId}_lat_der_${Date.now()}`,
        name: 'Lateral Derecho',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: sideH,
        width: carcassDepth,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
        posX: posX + (w / 2) - (t / 2),
        posY: sideCenterY,
        posZ: carcassCenterZ,
        orientation: 'vertical_yz',
        componentRole: 'side_right',
        notes: 'Costado estructural derecho'
      });

      // Piso inferior
      parts.push({
        id: `${moduleId}_piso_${Date.now()}`,
        name: 'Piso Inferior',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: innerWidth,
        width: carcassDepth,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: bottomOfCarcassY + (t / 2),
        posZ: carcassCenterZ,
        orientation: 'horizontal',
        componentRole: 'bottom',
        notes: 'Base inferior estructural'
      });

      if (config.category === 'oven_base') {
        // MÓDULO BAJO PARA HORNO EMPOTRADO Y ESTUFA (Nicho 595mm + Cajón inferior para latas)
        // Los amarres superiores van verticales de canto (orientation: 'vertical_xy') para dejar la cavidad superior
        // completamente abierta y libre, permitiendo el encastre preciso de la estufa / parrilla sin colisiones.
        const tieH = 65;
        const topTieCenterY = bottomOfCarcassY + sideH - (tieH / 2);
        parts.push({
          id: `${moduleId}_amarre_sup_f_${Date.now()}`,
          name: 'Faja Superior Frontal (Bajo Estufa)',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: innerWidth,
          width: tieH,
          thickness: t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'thin', a1: 'none', a2: 'none' },
          posX,
          posY: topTieCenterY,
          posZ: carcassFrontZ - (t / 2),
          orientation: 'vertical_xy',
          componentRole: 'tie',
          notes: 'Amarre vertical de canto frontal (cubierta estética entre horno y estufa)'
        });
        parts.push({
          id: `${moduleId}_amarre_sup_t_${Date.now()}`,
          name: 'Amarre Superior Trasero (Anclaje)',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: innerWidth,
          width: tieH,
          thickness: t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'thin', a1: 'none', a2: 'none' },
          posX,
          posY: topTieCenterY,
          posZ: carcassBackZ + (t / 2),
          orientation: 'vertical_xy',
          componentRole: 'tie',
          notes: 'Amarre vertical de canto trasero para anclaje a pared sin obstruir paso de encastre'
        });

        // Bandeja soporte de horno (deja nicho libre de 595mm bajo la faja superior)
        const ovenNicheH = 595;
        const ovenShelfY = Math.max(bottomOfCarcassY + 110, bottomOfCarcassY + sideH - tieH - ovenNicheH - (t / 2));
        parts.push({
          id: `${moduleId}_bandeja_horno_${Date.now()}`,
          name: 'Bandeja Soporte de Horno (Reforzada)',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: innerWidth,
          width: carcassDepth - 25,
          thickness: t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thick', l2: 'none', a1: 'none', a2: 'none' },
          posX,
          posY: ovenShelfY,
          posZ: carcassCenterZ + 12.5,
          orientation: 'horizontal',
          componentRole: 'shelf',
          notes: 'Soporte estructural de horno empotrable (ventilación trasera 25mm)'
        });

        // Frente abatible/gaveta inferior para latas debajo del horno
        const lowerFrontH = Math.max(80, Math.round((ovenShelfY - (t / 2)) - bottomOfCarcassY - (gap * 2)));
        const lowerFrontCenterY = bottomOfCarcassY + gap + (lowerFrontH / 2);
        parts.push({
          id: `${moduleId}_frente_latas_${Date.now()}`,
          name: 'Frente Gaveta / Puerta Inferior Portabandejas',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: w - (gap * 2),
          width: lowerFrontH,
          thickness: doorT,
          quantity: 1,
          materialId: doorMat.id,
          materialName: doorMat.name,
          grain: doorMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX,
          posY: lowerFrontCenterY,
          posZ: doorPosZ,
          orientation: 'vertical_xy',
          componentRole: 'drawer_front',
          hardwareConfig: {
            isMovable: true,
            movableType: 'door',
            openingDirection: 'bottom',
            hingeType: 'straight',
            handleType: hType,
            handleFinish: hFinish,
            handlePosition: 'horizontal',
            isOpen: false
          },
          notes: 'Compartimento inferior para bandejas de horno'
        });

        // En módulo bajo horno empotrado, el nicho del horno debe permanecer completamente abierto por detrás
        // para ventilación de calor según norma técnica y libre paso de conexiones eléctricas/gas (backType: 'none').
        // Solo si el usuario solicita explícitamente fondo trasero (hasBackPanel === true && backType !== 'none'),
        // este se coloca EXCLUSIVAMENTE en el compartimento inferior de bandejas/cajón (debajo del estante del horno),
        // NUNCA en el nicho del horno ni solapándose con el amarre superior trasero.
        const wantsBackPanel = config.hasBackPanel === true && config.backType !== 'none';
        if (wantsBackPanel) {
          const lowerBackH = Math.max(40, Math.round((ovenShelfY - (t / 2)) - (bottomOfCarcassY + t)));
          const lowerBackCenterY = bottomOfCarcassY + t + (lowerBackH / 2);
          parts.push({
            id: `${moduleId}_fondo_inferior_${Date.now()}`,
            name: 'Fondo Trasero Compartimento Inferior',
            moduleId,
            moduleName: groupName,
            groupId,
            groupName,
            length: Math.max(50, innerWidth - 2),
            width: lowerBackH,
            thickness: backT,
            quantity: 1,
            materialId: backMat.id,
            materialName: backMat.name,
            grain: 'none',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            posX,
            posY: lowerBackCenterY,
            posZ: carcassBackZ + 10 + (backT / 2),
            orientation: 'vertical_xy',
            componentRole: 'back',
            notes: `Fondo MDF ${backT}mm para gaveta inferior (nicho de horno libre)`
          });
        }
      } else if (config.category === 'sink_base') {
        // MÓDULO BAJO LAVAPLATOS (Sin tapa maciza superior, con fajas verticales/horizontales para paso de pozo y sifón)
        const tieH = 95;
        const topTieY = bottomOfCarcassY + sideH - (tieH / 2);
        parts.push({
          id: `${moduleId}_faja_frontal_lvp_${Date.now()}`,
          name: 'Faja Frontal Falsa (Frente Pozo Lavaplatos)',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: innerWidth,
          width: tieH,
          thickness: t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'thin', a1: 'none', a2: 'none' },
          posX,
          posY: topTieY,
          posZ: carcassFrontZ - (t / 2),
          orientation: 'vertical_xy',
          componentRole: 'tie',
          notes: 'Amarre vertical frontal para rigidez bajo el pozo del lavaplatos'
        });
        parts.push({
          id: `${moduleId}_faja_trasera_lvp_${Date.now()}`,
          name: 'Amarre Trasero Superior (Paso Grifería)',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: innerWidth,
          width: tieH,
          thickness: t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'thin', a1: 'none', a2: 'none' },
          posX,
          posY: topTieY,
          posZ: carcassBackZ + (t / 2),
          orientation: 'vertical_xy',
          componentRole: 'tie',
          notes: 'Amarre trasero superior libre para desagüe y abastos'
        });

        // 2 Puertas batientes frontales
        const doorW = Math.max(100, (w / 2) - (gap * 1.2));
        const doorH = sideH - (gap * 2);
        const leftDoorX = posX - (w / 4) + (gap / 4);
        const rightDoorX = posX + (w / 4) - (gap / 4);

        parts.push({
          id: `${moduleId}_puerta_izq_lvp_${Date.now()}`,
          name: 'Puerta Izquierda Bajo Lavaplatos',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: doorW,
          width: doorH,
          thickness: doorT,
          quantity: 1,
          materialId: doorMat.id,
          materialName: doorMat.name,
          grain: doorMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX: leftDoorX,
          posY: sideCenterY,
          posZ: doorPosZ,
          orientation: 'vertical_xy',
          componentRole: 'door',
          hardwareConfig: {
            isMovable: true,
            movableType: 'door',
            openingDirection: 'left',
            hingeType: 'straight',
            handleType: hType,
            handleFinish: hFinish,
            handlePosition: 'vertical',
            isOpen: false
          },
          notes: 'Puerta izquierda módulo húmedo'
        });

        parts.push({
          id: `${moduleId}_puerta_der_lvp_${Date.now()}`,
          name: 'Puerta Derecha Bajo Lavaplatos',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: doorW,
          width: doorH,
          thickness: doorT,
          quantity: 1,
          materialId: doorMat.id,
          materialName: doorMat.name,
          grain: doorMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX: rightDoorX,
          posY: sideCenterY,
          posZ: doorPosZ,
          orientation: 'vertical_xy',
          componentRole: 'door',
          hardwareConfig: {
            isMovable: true,
            movableType: 'door',
            openingDirection: 'right',
            hingeType: 'straight',
            handleType: hType,
            handleFinish: hFinish,
            handlePosition: 'vertical',
            isOpen: false
          },
          notes: 'Puerta derecha módulo húmedo'
        });
      } else if (config.category === 'oven_tower') {
        // TORRE COLUMNA DE HORNO + MICROONDAS (Altura ~2150mm)
        // Techo superior
        parts.push({
          id: `${moduleId}_techo_torre_${Date.now()}`,
          name: 'Techo Superior Torre',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: innerWidth,
          width: carcassDepth,
          thickness: t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX,
          posY: bottomOfCarcassY + sideH - (t / 2),
          posZ: carcassCenterZ,
          orientation: 'horizontal',
          componentRole: 'top',
          notes: 'Tapa superior columna de hornos'
        });

        const lowerZoneH = Math.max(480, Math.round(sideH * 0.32));
        const ovenNicheH = 595;
        const microNicheH = 388;

        const ovenFloorY = bottomOfCarcassY + lowerZoneH + (t / 2);
        const microFloorY = ovenFloorY + (t / 2) + ovenNicheH + (t / 2);
        const upperFloorY = microFloorY + (t / 2) + microNicheH + (t / 2);

        const fixedShelves = [
          { name: 'Repisa Estructural Base Horno', y: ovenFloorY },
          { name: 'Repisa Estructural Base Microondas', y: microFloorY },
          { name: 'Repisa Estructural Techo Microondas', y: upperFloorY }
        ];
        for (const fs of fixedShelves) {
          parts.push({
            id: `${moduleId}_rep_fija_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            name: fs.name,
            moduleId,
            moduleName: groupName,
            groupId,
            groupName,
            length: innerWidth,
            width: carcassDepth - 35,
            thickness: t,
            quantity: 1,
            materialId: mainMat.id,
            materialName: mainMat.name,
            grain: mainMat.hasGrain ? 'length' : 'none',
            edges: { l1: 'thick', l2: 'none', a1: 'none', a2: 'none' },
            posX,
            posY: fs.y,
            posZ: carcassCenterZ + 17.5,
            orientation: 'horizontal',
            componentRole: 'shelf',
            notes: 'Entrepaño fijo con cámara trasera de ventilación (35mm)'
          });
        }

        // Puerta inferior de torre
        const botDoorH = Math.max(200, lowerZoneH - (gap * 2));
        parts.push({
          id: `${moduleId}_puerta_inf_torre_${Date.now()}`,
          name: 'Puerta Inferior Torre Despensa',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: w - (gap * 2),
          width: botDoorH,
          thickness: doorT,
          quantity: 1,
          materialId: doorMat.id,
          materialName: doorMat.name,
          grain: doorMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX,
          posY: bottomOfCarcassY + gap + (botDoorH / 2),
          posZ: doorPosZ,
          orientation: 'vertical_xy',
          componentRole: 'door',
          hardwareConfig: {
            isMovable: true,
            movableType: 'door',
            openingDirection: 'left',
            hingeType: 'straight',
            handleType: hType,
            handleFinish: hFinish,
            handlePosition: 'vertical',
            isOpen: false
          },
          notes: 'Puerta inferior columna de hornos'
        });

        // Puerta superior elevable de torre
        const topZoneBottomY = upperFloorY + (t / 2);
        const topCabinetTopY = bottomOfCarcassY + sideH;
        const topDoorH = Math.max(150, topCabinetTopY - topZoneBottomY - (gap * 2));
        parts.push({
          id: `${moduleId}_puerta_sup_torre_${Date.now()}`,
          name: 'Puerta Superior Alacena Torre',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: w - (gap * 2),
          width: topDoorH,
          thickness: doorT,
          quantity: 1,
          materialId: doorMat.id,
          materialName: doorMat.name,
          grain: doorMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX,
          posY: topZoneBottomY + gap + (topDoorH / 2),
          posZ: doorPosZ,
          orientation: 'vertical_xy',
          componentRole: 'door',
          hardwareConfig: {
            isMovable: true,
            movableType: 'door',
            openingDirection: 'top',
            hingeType: 'gas_piston',
            handleType: hType,
            handleFinish: hFinish,
            handlePosition: 'horizontal',
            isOpen: false
          },
          notes: 'Puerta superior sobre nicho de microondas'
        });

        // Fondo trasero en torre
        parts.push({
          id: `${moduleId}_fondo_torre_${Date.now()}`,
          name: 'Fondo Trasero Ranurado Torre',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: innerWidth - 2,
          width: sideH - (2 * t),
          thickness: backT,
          quantity: 1,
          materialId: backMat.id,
          materialName: backMat.name,
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX,
          posY: sideCenterY,
          posZ: carcassBackZ + 15 + (backT / 2),
          orientation: 'vertical_xy',
          componentRole: 'back',
          notes: 'Fondo MDF ranurado con rejilla de ventilación'
        });
      }
    }

    const module: FurnitureModule = {
      id: moduleId,
      name: groupName,
      type: config.category === 'oven_tower' ? 'tall_cabinet' : 'base_cabinet',
      width: w,
      height: h,
      depth: d,
      boardThickness: t,
      backThickness: backT,
      backType: (config.category === 'sink_base' || config.category === 'oven_base' || config.backType === 'none') ? 'none' : (config.backType || 'groove'),
      shelvesCount: config.shelvesCount || 1,
      doorsCount: config.category === 'sink_base' ? 2 : 1,
      doorsType: 'overlay',
      drawersCount: 0,
      hasPlinth,
      plinthHeight: plinthH,
      materialId: mainMat.id,
      backMaterialId: backMat.id,
      defaultThinEdge: true,
      defaultThickDoors: true
    };

    const group: PartGroup = {
      id: groupId,
      name: groupName,
      type: 'assembly',
      isOpen: false,
      parametricConfig: {
        ...config,
        drawersCount: 0,
        hangingRodsCount: 0
      }
    };

    return { module, parts, group };
  }

  /**
   * Construye el polígono 2D exacto (contourPoints en mm, origen inferior-izquierdo 0..length, 0..width)
   * a partir de la configuración paramétrica de corte especial (Chaflán, Diagonal, Destaje en L o Esquinas Redondeadas).
   */
  buildCornerCutContour(
    length: number,
    width: number,
    config: PartCornerCutConfig
  ): { x: number; y: number }[] {
    return this.partGeometry.buildCornerCutContour(length, width, config);
  }
}

