import { Injectable } from '@angular/core';
import { FurnitureModule, HardwareItem, Material, Part, ParametricCabinetConfig, PartGroup } from '../models/melamine.models';

@Injectable({
  providedIn: 'root'
})
export class CabinetGeneratorService {

  generatePartsForModule(module: FurnitureModule, materials: Material[]): { parts: Part[], hardware: HardwareItem[] } {
    const parts: Part[] = [];
    const hardware: HardwareItem[] = [];

    const mainMat = materials.find(m => m.id === module.materialId) || materials[0];
    const backMat = materials.find(m => m.id === module.backMaterialId) || materials.find(m => m.thickness <= 6) || mainMat;

    const t = module.boardThickness; // 18 o 15 mm
    const w = module.width;
    const h = module.height;
    const d = module.depth;

    const plinth = module.hasPlinth ? module.plinthHeight : 0;
    const carcassHeight = h - plinth;
    const innerWidth = w - (2 * t);
    const innerDepth = d;

    const thinEdge = module.defaultThinEdge ? 'thin' : 'none';
    const doorEdge = module.defaultThickDoors ? 'thick' : thinEdge;

    if (module.type === 'base_cabinet') {
      // 1. Laterales (2 unidades)
      parts.push({
        id: crypto.randomUUID(),
        moduleId: module.id,
        moduleName: module.name,
        name: 'Lateral (Bajo)',
        length: carcassHeight,
        width: innerDepth,
        thickness: t,
        quantity: 2,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: thinEdge, l2: 'none', a1: 'none', a2: thinEdge }, // Canto frontal L1 y base a2
        notes: 'Laterales izq. y der.'
      });

      // 2. Piso (1 unidad)
      parts.push({
        id: crypto.randomUUID(),
        moduleId: module.id,
        moduleName: module.name,
        name: 'Piso Inferior',
        length: innerWidth,
        width: innerDepth,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: thinEdge, l2: 'none', a1: 'none', a2: 'none' }, // Canto frontal
        notes: 'Piso estructural'
      });

      // 3. Fajas / Amarres superiores (2 unidades de 100mm de ancho para fijar cubierta)
      parts.push({
        id: crypto.randomUUID(),
        moduleId: module.id,
        moduleName: module.name,
        name: 'Amarres Sup. (Fajas)',
        length: innerWidth,
        width: 100,
        thickness: t,
        quantity: 2,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: thinEdge, l2: 'none', a1: 'none', a2: 'none' },
        notes: 'Amarre frontal y trasero'
      });

      // 4. Zócalo si aplica
      if (module.hasPlinth) {
        parts.push({
          id: crypto.randomUUID(),
          moduleId: module.id,
          moduleName: module.name,
          name: 'Zócalo Frontal',
          length: innerWidth,
          width: plinth,
          thickness: t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: thinEdge, l2: thinEdge, a1: 'none', a2: 'none' },
          notes: 'Zócalo de piso'
        });
      }

      // 5. Repisas ajustables
      if (module.shelvesCount > 0) {
        parts.push({
          id: crypto.randomUUID(),
          moduleId: module.id,
          moduleName: module.name,
          name: 'Repisa Regulable',
          length: innerWidth - 2, // 2mm de holgura para colocación
          width: innerDepth - 20, // 20mm de retroceso para no chocar con puerta
          thickness: t,
          quantity: module.shelvesCount,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: thinEdge, l2: 'none', a1: 'none', a2: 'none' },
          notes: 'Con retroceso frontal'
        });

        hardware.push({
          id: crypto.randomUUID(),
          name: 'Soportes de repisa (pitones metálicos)',
          category: 'support',
          unit: 'und',
          quantity: module.shelvesCount * 4,
          unitCost: 0.20
        });
      }

      // 6. Fondo (Back panel)
      if (module.backType !== 'none') {
        const backW = module.backType === 'groove' ? innerWidth + 14 : w - 4;
        const backH = module.backType === 'groove' ? carcassHeight - t + 7 : carcassHeight - 4;
        parts.push({
          id: crypto.randomUUID(),
          moduleId: module.id,
          moduleName: module.name,
          name: 'Fondo Trasero',
          length: backH,
          width: backW,
          thickness: backMat.thickness,
          quantity: 1,
          materialId: backMat.id,
          materialName: backMat.name,
          grain: backMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          notes: module.backType === 'groove' ? 'Ranurado a 15mm' : 'Sobrepuesto con clavos/tornillos'
        });
      }

      // Tornillos estructurales 4x50
      hardware.push({
        id: crypto.randomUUID(),
        name: 'Tornillos Spax 4x50mm (Carcasa)',
        category: 'screw',
        unit: 'und',
        quantity: 16,
        unitCost: 0.08
      });

    } else if (module.type === 'wall_cabinet') {
      // Alacena / Mueble aéreo
      parts.push({
        id: crypto.randomUUID(),
        moduleId: module.id,
        moduleName: module.name,
        name: 'Lateral (Alacena)',
        length: h,
        width: d,
        thickness: t,
        quantity: 2,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: thinEdge, l2: 'none', a1: thinEdge, a2: thinEdge },
        notes: 'Laterales colgados'
      });

      parts.push({
        id: crypto.randomUUID(),
        moduleId: module.id,
        moduleName: module.name,
        name: 'Piso / Techo',
        length: innerWidth,
        width: d,
        thickness: t,
        quantity: 2,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: thinEdge, l2: 'none', a1: 'none', a2: 'none' },
        notes: 'Superior e inferior'
      });

      if (module.shelvesCount > 0) {
        parts.push({
          id: crypto.randomUUID(),
          moduleId: module.id,
          moduleName: module.name,
          name: 'Repisa Regulable',
          length: innerWidth - 2,
          width: d - 15,
          thickness: t,
          quantity: module.shelvesCount,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: thinEdge, l2: 'none', a1: 'none', a2: 'none' },
          notes: 'Repisa móvil'
        });

        hardware.push({
          id: crypto.randomUUID(),
          name: 'Soportes de repisa niquelados',
          category: 'support',
          unit: 'und',
          quantity: module.shelvesCount * 4,
          unitCost: 0.20
        });
      }

      if (module.backType !== 'none') {
        const backW = module.backType === 'groove' ? innerWidth + 14 : w - 4;
        const backH = module.backType === 'groove' ? h - (2 * t) + 14 : h - 4;
        parts.push({
          id: crypto.randomUUID(),
          moduleId: module.id,
          moduleName: module.name,
          name: 'Fondo Trasero',
          length: backH,
          width: backW,
          thickness: backMat.thickness,
          quantity: 1,
          materialId: backMat.id,
          materialName: backMat.name,
          grain: backMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          notes: 'Fondo Alacena'
        });
      }

      hardware.push({
        id: crypto.randomUUID(),
        name: 'Colgadores ocultos para alacena (par)',
        category: 'accessory',
        unit: 'par',
        quantity: 1,
        unitCost: 4.50
      });

    } else if (module.type === 'tall_cabinet') {
      // Ropero / Columna alta
      parts.push({
        id: crypto.randomUUID(),
        moduleId: module.id,
        moduleName: module.name,
        name: 'Lateral Columna',
        length: carcassHeight,
        width: d,
        thickness: t,
        quantity: 2,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: thinEdge, l2: 'none', a1: thinEdge, a2: thinEdge },
        notes: 'Laterales altos'
      });

      parts.push({
        id: crypto.randomUUID(),
        moduleId: module.id,
        moduleName: module.name,
        name: 'Piso / Techo',
        length: innerWidth,
        width: d,
        thickness: t,
        quantity: 2,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: thinEdge, l2: 'none', a1: 'none', a2: 'none' },
        notes: 'Bases'
      });

      if (module.hasPlinth) {
        parts.push({
          id: crypto.randomUUID(),
          moduleId: module.id,
          moduleName: module.name,
          name: 'Zócalos (Frontal y Trasero)',
          length: innerWidth,
          width: plinth,
          thickness: t,
          quantity: 2,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: thinEdge, l2: 'none', a1: 'none', a2: 'none' },
          notes: 'Zócalos'
        });
      }

      if (module.shelvesCount > 0) {
        parts.push({
          id: crypto.randomUUID(),
          moduleId: module.id,
          moduleName: module.name,
          name: 'Estantes / Divisiones',
          length: innerWidth,
          width: d - 20,
          thickness: t,
          quantity: module.shelvesCount,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: thinEdge, l2: 'none', a1: 'none', a2: 'none' },
          notes: 'División horizontal'
        });
      }

      if (module.backType !== 'none') {
        parts.push({
          id: crypto.randomUUID(),
          moduleId: module.id,
          moduleName: module.name,
          name: 'Fondo Alto',
          length: carcassHeight - 4,
          width: w - 4,
          thickness: backMat.thickness,
          quantity: 1,
          materialId: backMat.id,
          materialName: backMat.name,
          grain: backMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          notes: 'Fondo ropero'
        });
      }
    } else if (module.type === 'drawer_unit') {
      // Cajonera dedicada
      parts.push({
        id: crypto.randomUUID(),
        moduleId: module.id,
        moduleName: module.name,
        name: 'Lateral Cajonera',
        length: carcassHeight,
        width: d,
        thickness: t,
        quantity: 2,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: thinEdge, l2: 'none', a1: 'none', a2: thinEdge },
        notes: 'Laterales cajonera'
      });

      parts.push({
        id: crypto.randomUUID(),
        moduleId: module.id,
        moduleName: module.name,
        name: 'Piso Inferior',
        length: innerWidth,
        width: d,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: thinEdge, l2: 'none', a1: 'none', a2: 'none' },
        notes: 'Piso'
      });

      parts.push({
        id: crypto.randomUUID(),
        moduleId: module.id,
        moduleName: module.name,
        name: 'Amarres Superiores',
        length: innerWidth,
        width: 100,
        thickness: t,
        quantity: 2,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: thinEdge, l2: 'none', a1: 'none', a2: 'none' },
        notes: 'Amarres superiores'
      });

      if (module.hasPlinth) {
        parts.push({
          id: crypto.randomUUID(),
          moduleId: module.id,
          moduleName: module.name,
          name: 'Zócalo Frontal',
          length: innerWidth,
          width: plinth,
          thickness: t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: thinEdge, l2: 'none', a1: 'none', a2: 'none' },
          notes: 'Zócalo'
        });
      }
    }

    // --- PUERTAS (si doorsCount > 0) ---
    if (module.doorsCount > 0) {
      const doorHeight = carcassHeight - 4; // 2mm luz superior, 2mm luz inferior
      let doorWidth = 0;

      if (module.doorsCount === 1) {
        doorWidth = w - 4; // 2mm luz en cada lado
      } else if (module.doorsCount === 2) {
        doorWidth = Math.floor((w - 6) / 2); // 2mm izq, 2mm der, 2mm centro
      }

      parts.push({
        id: crypto.randomUUID(),
        moduleId: module.id,
        moduleName: module.name,
        name: module.doorsCount === 1 ? 'Puerta Frontal' : 'Puerta (Par)',
        length: doorHeight,
        width: doorWidth,
        thickness: t,
        quantity: module.doorsCount,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: doorEdge, l2: doorEdge, a1: doorEdge, a2: doorEdge }, // Tapacanto en los 4 bordes
        notes: 'Puerta con cazoleta de 35mm a 100mm de extremos'
      });

      // Bisagras: 2 por puerta (3 si altura > 950mm)
      const hingesPerDoor = doorHeight > 950 ? 3 : 2;
      hardware.push({
        id: crypto.randomUUID(),
        name: 'Bisagra cierre suave 35mm (Codo 0)',
        category: 'hinge',
        unit: 'und',
        quantity: module.doorsCount * hingesPerDoor,
        unitCost: 1.80
      });

      // Tiradores
      hardware.push({
        id: crypto.randomUUID(),
        name: 'Tirador / Jalador para puerta',
        category: 'handle',
        unit: 'und',
        quantity: module.doorsCount,
        unitCost: 2.20
      });
    }

    // --- CAJONES (si drawersCount > 0) ---
    if (module.drawersCount > 0) {
      const n = module.drawersCount;
      const frontHeight = Math.floor((carcassHeight - (n * 3) - 2) / n);
      const frontWidth = w - 4; // cubriendo laterales con 2mm luz exterior

      // 1. Frentes de cajón vistos
      parts.push({
        id: crypto.randomUUID(),
        moduleId: module.id,
        moduleName: module.name,
        name: 'Frente de Cajón',
        length: frontWidth,
        width: frontHeight,
        thickness: t,
        quantity: n,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: doorEdge, l2: doorEdge, a1: doorEdge, a2: doorEdge },
        notes: 'Frente visto con 4 cantos enchapados'
      });

      // 2. Laterales de cajón (caja interior)
      // Largo según corredera estándar (ej. si fondo es 500, corredera es 450)
      const slideLength = this.getStandardSlideLength(d);
      const boxHeight = Math.min(Math.floor(frontHeight * 0.70), 200);

      parts.push({
        id: crypto.randomUUID(),
        moduleId: module.id,
        moduleName: module.name,
        name: 'Lateral de Cajón Interior',
        length: slideLength,
        width: boxHeight,
        thickness: t,
        quantity: n * 2,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: thinEdge, l2: 'none', a1: 'none', a2: 'none' },
        notes: `Cajón para corredera ${slideLength}mm`
      });

      // 3. Testeras (Frente y Contrafrente interior de la caja)
      // Luz estándar para correderas telescópicas: 26mm total (13mm cada lado)
      // Medida testera = innerWidth - 26mm - (2 * t)
      const boxBackWidth = innerWidth - 26 - (2 * t);
      parts.push({
        id: crypto.randomUUID(),
        moduleId: module.id,
        moduleName: module.name,
        name: 'Cabecera/Trasera de Cajón',
        length: boxBackWidth,
        width: boxHeight,
        thickness: t,
        quantity: n * 2,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: thinEdge, l2: 'none', a1: 'none', a2: 'none' },
        notes: 'Descuento telescópico 26mm'
      });

      // 4. Fondos de cajón (MDF 3mm ranurado o clavado)
      parts.push({
        id: crypto.randomUUID(),
        moduleId: module.id,
        moduleName: module.name,
        name: 'Fondo de Cajón',
        length: slideLength,
        width: boxBackWidth + (2 * t),
        thickness: backMat.thickness,
        quantity: n,
        materialId: backMat.id,
        materialName: backMat.name,
        grain: backMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        notes: 'Fondo MDF cajón'
      });

      // Herrajes de cajones:
      hardware.push({
        id: crypto.randomUUID(),
        name: `Correderas telescópicas pesadas ${slideLength}mm (par)`,
        category: 'slide',
        unit: 'par',
        quantity: n,
        unitCost: 5.50
      });

      hardware.push({
        id: crypto.randomUUID(),
        name: 'Tiradores / Jaladores de cajón',
        category: 'handle',
        unit: 'und',
        quantity: n,
        unitCost: 2.20
      });

      hardware.push({
        id: crypto.randomUUID(),
        name: 'Tornillos 3.5x15mm para correderas (bolsa x50)',
        category: 'screw',
        unit: 'caja',
        quantity: 1,
        unitCost: 2.00
      });
    }

    return { parts, hardware };
  }

  private getStandardSlideLength(cabinetDepth: number): number {
    const standardSizes = [250, 300, 350, 400, 450, 500, 550, 600];
    const available = cabinetDepth - 40; // Mínimo 40mm de seguridad
    let best = 250;
    for (const size of standardSizes) {
      if (size <= available) {
        best = size;
      }
    }
    return best;
  }

  /**
   * Generates a fully parametric furniture module (Drawer Unit / Cajonera, Kitchen Base, Wall Cabinet,
   * Closet, Vanity, Bookshelf, or Custom) with exact joinery calculations, 0-6 sliding drawers (5-piece
   * non-overlapping drawer boxes), door configurations, handles, plinths, and uniform/manual shelf distributions.
   */
  generateParametricCabinet(
    config: ParametricCabinetConfig,
    materials: Material[]
  ): { module: FurnitureModule; parts: Part[]; group: PartGroup } {
    const moduleId = config.id || `module_cab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const groupId = `group_cab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const groupName = config.name || `Módulo Paramétrico (${config.code || 'MOD001'})`;

    const mainMat = materials.find(m => m.id === config.structureMaterialId) || materials[0];
    const doorMat = materials.find(m => m.id === config.doorMaterialId) || mainMat;
    const backMat = materials.find(m => m.id === config.backMaterialId) ||
                    materials.find(m => m.thickness <= 6) || mainMat;

    const t = Math.max(9, Number(config.structureThickness) || 15);
    const doorT = Math.max(9, Number(config.doorThickness) || t);
    const backT = Math.max(3, Number(config.backThickness) || 3);
    const w = Math.max(200, Number(config.width) || 600);
    const h = Math.max(200, Number(config.height) || 800);
    const d = Math.max(150, Number(config.depth) || 450);
    const gap = config.facadeGap ?? 3;

    const doorOpening = config.doorOpening || 'none';
    const hasDoor = doorOpening !== 'none';
    const drawersCount = Math.max(0, Math.min(6, Math.floor(Number(config.drawersCount) || 0)));
    const hasFacade = hasDoor || drawersCount > 0;

    const hasPlinth = Boolean(config.hasPlinth) && config.moduleType !== 'wall_cabinet';
    const plinthH = hasPlinth ? Math.max(40, Math.min(250, Number(config.plinthHeight) || 80)) : 0;

    // Carcass depth: if doors or drawer fronts are present, carcass is recessed so fronts sit flush with outer depth
    const carcassDepth = hasFacade ? Math.max(120, d - doorT) : d;
    const innerWidth = Math.max(50, w - 2 * t);
    const innerHeight = Math.max(50, h - plinthH - 2 * t);

    // Coordinate centers
    const posX = config.posX ?? 0;

    // Default elevation (posY is the vertical center of the full height h):
    let posY = config.posY;
    if (posY === undefined) {
      if (config.moduleType === 'wall_cabinet') {
        posY = 1450 + h / 2; // Alacena elevada
      } else if (config.moduleType === 'vanity') {
        posY = 250 + h / 2; // Mueble suspendido baño
      } else {
        posY = h / 2; // Apoyado en el suelo
      }
    }
    const posZ = config.posZ ?? 0;

    const moduleBottomY = posY - h / 2;
    const moduleTopY = posY + h / 2;
    const floorPanelBottomY = moduleBottomY + plinthH;

    const carcassCenterZ = hasFacade ? posZ - doorT / 2 : posZ;
    const carcassBackZ = carcassCenterZ - carcassDepth / 2;
    const carcassFrontZ = carcassCenterZ + carcassDepth / 2;

    const includeBack = config.backType !== 'none' && config.hasBackPanel !== false;
    const isOverlayBack = config.backType === 'overlay';
    // Rear clearance inside carcass so internal parts (bottom, top, shelves, drawers) NEVER collide with the back panel
    const internalBackClearance = includeBack ? (isOverlayBack ? 0 : 15 + backT) : 0;
    const internalClearDepth = Math.max(80, carcassDepth - internalBackClearance);
    const internalFrontZ = carcassFrontZ;
    const internalBackZ = carcassBackZ + internalBackClearance;

    const parts: Part[] = [];

    // 1. Lateral Izquierdo (Altura completa h de piso a techo para estabilidad estructural)
    parts.push({
      id: `${moduleId}_lat_izq_${Date.now()}`,
      name: 'Lateral Izquierdo',
      moduleId,
      moduleName: groupName,
      groupId,
      groupName,
      length: h,
      width: carcassDepth,
      thickness: t,
      quantity: 1,
      materialId: mainMat.id,
      materialName: mainMat.name,
      grain: mainMat.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
      posX: posX - w / 2 + t / 2,
      posY,
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
      length: h,
      width: carcassDepth,
      thickness: t,
      quantity: 1,
      materialId: mainMat.id,
      materialName: mainMat.name,
      grain: mainMat.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
      posX: posX + w / 2 - t / 2,
      posY,
      posZ: carcassCenterZ,
      orientation: 'vertical_yz',
      componentRole: 'side_right',
      notes: 'Lateral exterior derecho'
    });

    // 3. Techo Superior (entre laterales, respetando ranura trasera si existe)
    const horizPanelDepth = carcassDepth;
    parts.push({
      id: `${moduleId}_techo_${Date.now()}`,
      name: 'Techo Superior',
      moduleId,
      moduleName: groupName,
      groupId,
      groupName,
      length: innerWidth,
      width: horizPanelDepth,
      thickness: t,
      quantity: 1,
      materialId: mainMat.id,
      materialName: mainMat.name,
      grain: mainMat.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX,
      posY: moduleTopY - t / 2,
      posZ: carcassCenterZ,
      orientation: 'horizontal',
      componentRole: 'top',
      notes: 'Tapa superior estructural entre laterales'
    });

    // 4. Piso / Base Inferior (sobre el zócalo si tiene zócalo)
    parts.push({
      id: `${moduleId}_base_${Date.now()}`,
      name: 'Piso Inferior',
      moduleId,
      moduleName: groupName,
      groupId,
      groupName,
      length: innerWidth,
      width: horizPanelDepth,
      thickness: t,
      quantity: 1,
      materialId: mainMat.id,
      materialName: mainMat.name,
      grain: mainMat.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX,
      posY: floorPanelBottomY + t / 2,
      posZ: carcassCenterZ,
      orientation: 'horizontal',
      componentRole: 'bottom',
      notes: 'Base inferior estructural entre laterales'
    });

    // 4b. Zócalo Frontal Inferior (si aplica, encajado exactamente debajo del piso inferior sin solapar)
    if (hasPlinth && plinthH > 0) {
      parts.push({
        id: `${moduleId}_zocalo_${Date.now()}`,
        name: 'Zócalo Frontal',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: innerWidth,
        width: plinthH,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: moduleBottomY + plinthH / 2,
        posZ: carcassFrontZ - 15 - t / 2,
        orientation: 'vertical_xy',
        componentRole: 'plinth',
        notes: `Zócalo frontal de ${plinthH} mm`
      });
    }

    // 5. Fondo Trasero (MDF 3mm / Durolac) - Colocado detrás del espacio interior libre sin tocar piso/techo
    if (includeBack) {
      const backPosZ = isOverlayBack
        ? carcassBackZ - backT / 2
        : carcassBackZ + 15 + backT / 2;
      const backLength = isOverlayBack
        ? Math.max(50, w - 4)
        : Math.max(50, innerWidth - 2);
      const backHeight = isOverlayBack
        ? Math.max(50, h - plinthH - 4)
        : Math.max(50, innerHeight - 2);
      const backPosY = floorPanelBottomY + t + innerHeight / 2;

      parts.push({
        id: `${moduleId}_fondo_${Date.now()}`,
        name: isOverlayBack ? 'Fondo Trasero Sobrepuesto' : 'Fondo Trasero MDF',
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
        posY: backPosY,
        posZ: backPosZ,
        orientation: 'vertical_xy',
        componentRole: 'back',
        notes: `Fondo MDF ${backT}mm (${backLength}×${backHeight} mm)`
      });
    }

    // Configuración de herrajes y frentes
    const facadeFrontCenterZ = carcassFrontZ + doorT / 2;
    const hasHandle = config.hasHandle !== false;
    const hType = hasHandle ? (config.handleType || 'bar_modern') : 'none';
    const hFinish = config.handleFinish || 'brushed_steel';
    const slideType = config.slideType || 'telescopic';

    // 6. Generación de Cajones Corredizos (0 a 6 cajones de 5 piezas cada uno, CERO solapamiento)
    const isTopDrawerInBase =
      drawersCount > 0 && hasDoor && config.moduleType !== 'drawer_unit' && config.category === 'kitchen_base';
    const totalAvailableFacadeH = Math.max(100, h - plinthH - gap);

    let drawersTotalFacadeSpan = 0;
    const drawerFrontHeights: number[] = [];

    if (drawersCount > 0) {
      const isFullDrawerUnit = !hasDoor || config.moduleType === 'drawer_unit' || config.category === 'drawer_unit';
      const totalDrawerGaps = Math.max(0, drawersCount - 1) * gap;
      const defaultUniformFrontH = isFullDrawerUnit
        ? Math.max(80, Math.floor((totalAvailableFacadeH - totalDrawerGaps) / drawersCount))
        : Math.max(100, Math.min(200, Math.floor(totalAvailableFacadeH / (drawersCount + 1))));

      for (let i = 0; i < drawersCount; i++) {
        const manualVal = config.drawerManualHeights?.[i];
        if (
          config.drawerDistribution === 'manual' &&
          manualVal !== undefined &&
          Number.isFinite(Number(manualVal)) &&
          Number(manualVal) >= 60
        ) {
          drawerFrontHeights.push(Math.round(Number(manualVal)));
        } else {
          drawerFrontHeights.push(defaultUniformFrontH);
        }
      }

      drawersTotalFacadeSpan =
        drawerFrontHeights.reduce((acc, v) => acc + v, 0) + Math.max(0, drawersCount - 1) * gap;

      // Medida estándar de corredera que cabe holgadamente en la profundidad libre interior
      const slideLength = this.getStandardSlideLength(internalClearDepth);

      // Ancho exterior de la caja del cajón descontando las correderas (26mm total = 13mm por lado)
      const slideClearanceTotal = slideType === 'undermount' ? 10 : 26;
      const boxOuterWidth = Math.max(100, innerWidth - slideClearanceTotal);
      const boxSideT = Math.min(t, 15); // Costados de cajón en 15mm (o menor) para ligereza
      const boxInnerWidth = Math.max(60, boxOuterWidth - 2 * boxSideT);
      const boxBottomT = backT;

      const frontCutWidth = Math.max(80, w - 4);

      // Posición inicial Y del frente de cajón 1:
      // Si es cajón superior en mueble bajo con puerta, se ubica arriba; de lo contrario, de abajo hacia arriba
      let currentFrontBottomY = isTopDrawerInBase
        ? moduleTopY - gap / 2 - drawersTotalFacadeSpan
        : floorPanelBottomY + gap / 2;

      for (let i = 0; i < drawersCount; i++) {
        const dIndex = i + 1;
        const dName = `Cajón ${dIndex}`;
        const frontH = drawerFrontHeights[i];
        const frontCenterY = currentFrontBottomY + frontH / 2;

        // Límites verticales interiores seguros para la caja del cajón (nunca tocar piso Inferior ni techo Superior)
        const slotMinY = Math.max(floorPanelBottomY + t + 6, currentFrontBottomY + 8);
        const slotMaxY = Math.min(moduleTopY - t - 6, currentFrontBottomY + frontH - 8);
        const availableSlotH = Math.max(55, slotMaxY - slotMinY);

        const boxH = Math.max(50, Math.min(240, availableSlotH - boxBottomT - 6));
        const boxBottomPanelY = slotMinY + boxBottomT / 2;
        const boxSidesCenterY = slotMinY + boxBottomT + boxH / 2;

        // Posición Z de la caja: empieza justo detrás del frente exterior (carcassFrontZ) hacia el fondo
        const boxFrontEdgeZ = internalFrontZ - 2; // 2mm de separación técnica respecto al frente exterior para cero colisión
        const boxCenterZ = boxFrontEdgeZ - slideLength / 2;
        const boxBackPlateCenterZ = boxFrontEdgeZ - slideLength + boxSideT / 2;
        const boxFrontPlateCenterZ = boxFrontEdgeZ - boxSideT / 2;

        const uid = `${moduleId}_caj${dIndex}_${Date.now()}`;

        // 6.1 Frente Exterior de Cajón (Única pieza del cajón con rol drawer_front y manija)
        parts.push({
          id: `${uid}_frente`,
          name: `${dName} - Frente`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: frontCutWidth,
          width: frontH,
          thickness: doorT,
          quantity: 1,
          materialId: doorMat.id,
          materialName: doorMat.name,
          grain: doorMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX,
          posY: frontCenterY,
          posZ: facadeFrontCenterZ,
          orientation: 'vertical_xy',
          componentRole: 'drawer_front',
          notes: `Tapa frontal exterior ${dName} (${frontCutWidth}×${frontH} mm)`,
          hardwareConfig: {
            isMovable: true,
            movableType: 'drawer',
            slideType,
            handleType: hType,
            handleFinish: hFinish,
            handlePosition: config.handlePosition || 'horizontal',
            isOpen: false
          }
        });

        // 6.2 Lateral Izquierdo de Caja de Cajón
        parts.push({
          id: `${uid}_lat_izq`,
          name: `${dName} - Lateral Izquierdo`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: slideLength,
          width: boxH,
          thickness: boxSideT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: posX - boxOuterWidth / 2 + boxSideT / 2,
          posY: boxSidesCenterY,
          posZ: boxCenterZ,
          orientation: 'vertical_yz',
          componentRole: 'drawer_box',
          notes: `Costado izq. ${dName} (Corredera ${slideLength}mm)`,
          hardwareConfig: {
            isMovable: false,
            movableType: 'none',
            slideType: 'none',
            handleType: 'none'
          }
        });

        // 6.3 Lateral Derecho de Caja de Cajón
        parts.push({
          id: `${uid}_lat_der`,
          name: `${dName} - Lateral Derecho`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: slideLength,
          width: boxH,
          thickness: boxSideT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: posX + boxOuterWidth / 2 - boxSideT / 2,
          posY: boxSidesCenterY,
          posZ: boxCenterZ,
          orientation: 'vertical_yz',
          componentRole: 'drawer_box',
          notes: `Costado der. ${dName} (Corredera ${slideLength}mm)`,
          hardwareConfig: {
            isMovable: false,
            movableType: 'none',
            slideType: 'none',
            handleType: 'none'
          }
        });

        // 6.4 Contrafrente Interior de Cajón (encajado entre ambos laterales del cajón)
        parts.push({
          id: `${uid}_frente_int`,
          name: `${dName} - Contrafrente Interior`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: boxInnerWidth,
          width: boxH,
          thickness: boxSideT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX,
          posY: boxSidesCenterY,
          posZ: boxFrontPlateCenterZ,
          orientation: 'vertical_xy',
          componentRole: 'drawer_box',
          notes: `Contrafrente interno ${dName}`,
          hardwareConfig: {
            isMovable: false,
            movableType: 'none',
            slideType: 'none',
            handleType: 'none'
          }
        });

        // 6.5 Trasera Interior de Cajón (encajada entre ambos laterales del cajón)
        parts.push({
          id: `${uid}_trasera`,
          name: `${dName} - Trasera Interior`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: boxInnerWidth,
          width: boxH,
          thickness: boxSideT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX,
          posY: boxSidesCenterY,
          posZ: boxBackPlateCenterZ,
          orientation: 'vertical_xy',
          componentRole: 'drawer_box',
          notes: `Trasera interna ${dName}`,
          hardwareConfig: {
            isMovable: false,
            movableType: 'none',
            slideType: 'none',
            handleType: 'none'
          }
        });

        // 6.6 Fondo MDF de Caja de Cajón (apoyado limpiamente en la base de la caja sin solapar los 4 lados)
        parts.push({
          id: `${uid}_fondo_caj`,
          name: `${dName} - Fondo MDF`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: boxOuterWidth,
          width: slideLength,
          thickness: boxBottomT,
          quantity: 1,
          materialId: backMat.id,
          materialName: backMat.name,
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX,
          posY: boxBottomPanelY,
          posZ: boxCenterZ,
          orientation: 'horizontal',
          componentRole: 'drawer_box',
          notes: `Fondo MDF ${boxBottomT}mm de ${dName}`,
          hardwareConfig: {
            isMovable: false,
            movableType: 'none',
            slideType: 'none',
            handleType: 'none'
          }
        });

        currentFrontBottomY += frontH + gap;
      }
    }

    // Calcular zona libre vertical para puertas y entrepaños (si conviven con cajones o si no hay cajones)
    const doorZoneBottomY = isTopDrawerInBase
      ? floorPanelBottomY
      : floorPanelBottomY + (drawersCount > 0 ? drawersTotalFacadeSpan + gap : 0);
    const doorZoneTopY = isTopDrawerInBase
      ? moduleTopY - (drawersCount > 0 ? drawersTotalFacadeSpan + gap : 0)
      : moduleTopY;
    const doorZoneHeight = Math.max(0, doorZoneTopY - doorZoneBottomY);
    const doorZoneCenterY = doorZoneBottomY + doorZoneHeight / 2;

    // 7. Repisas / Entrepaños Interiores (solo cuando no es cajonera cerrada pura)
    const shelves = config.moduleType === 'drawer_unit' ? 0 : (config.shelvesCount ?? 0);
    if (shelves > 0 && doorZoneHeight > 120) {
      const shelfZoneMinY = Math.max(floorPanelBottomY + t, doorZoneBottomY + t);
      const shelfZoneMaxY = Math.min(moduleTopY - t, doorZoneTopY - t);
      const innerAvailableH = Math.max(50, shelfZoneMaxY - shelfZoneMinY);

      const frontClearance = hasFacade ? 20 : 10;
      const shelfWidth = Math.max(50, internalClearDepth - frontClearance - 5);
      const shelfCenterZ = internalBackZ + 5 + shelfWidth / 2;
      const shelfLength = Math.max(50, innerWidth - 2); // 1mm holgura a cada lado

      if (
        config.shelfDistribution === 'manual' &&
        config.shelfManualOffsets &&
        config.shelfManualOffsets.length === shelves
      ) {
        config.shelfManualOffsets.forEach((offset, idx) => {
          const shelfY = Math.min(shelfZoneMaxY - 20, Math.max(shelfZoneMinY + 20, floorPanelBottomY + t + offset));
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
        const stepY = innerAvailableH / (shelves + 1);
        for (let i = 1; i <= shelves; i++) {
          const shelfY = shelfZoneMinY + stepY * i;
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

    // 8. Puerta(s) Frontal(es) (en el área libre de cajones)
    const isGasLift = doorOpening === 'top';
    const doorCutH = Math.max(80, doorZoneHeight - gap);

    if (hasDoor && config.moduleType !== 'drawer_unit' && doorZoneHeight >= 100) {
      if (doorOpening === 'left' || doorOpening === 'right') {
        parts.push({
          id: `${moduleId}_puerta_${Date.now()}`,
          name: `Puerta Frontal (Abre: ${doorOpening === 'left' ? 'Izquierda' : 'Derecha'})`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: w - gap,
          width: doorCutH,
          thickness: doorT,
          quantity: 1,
          materialId: doorMat.id,
          materialName: doorMat.name,
          grain: doorMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX,
          posY: doorZoneCenterY,
          posZ: facadeFrontCenterZ,
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
        const doorW = Math.max(50, w / 2 - gap * 1.2);
        const leftDoorX = posX - w / 4 + gap / 4;
        const rightDoorX = posX + w / 4 - gap / 4;

        parts.push({
          id: `${moduleId}_puerta_izq_${Date.now()}`,
          name: 'Puerta Izquierda (Doble)',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: doorW,
          width: doorCutH,
          thickness: doorT,
          quantity: 1,
          materialId: doorMat.id,
          materialName: doorMat.name,
          grain: doorMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX: leftDoorX,
          posY: doorZoneCenterY,
          posZ: facadeFrontCenterZ,
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

        parts.push({
          id: `${moduleId}_puerta_der_${Date.now()}`,
          name: 'Puerta Derecha (Doble)',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: doorW,
          width: doorCutH,
          thickness: doorT,
          quantity: 1,
          materialId: doorMat.id,
          materialName: doorMat.name,
          grain: doorMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX: rightDoorX,
          posY: doorZoneCenterY,
          posZ: facadeFrontCenterZ,
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
        parts.push({
          id: `${moduleId}_puerta_elev_${Date.now()}`,
          name: 'Puerta Elevable (Pistón Gas)',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: w - gap,
          width: doorCutH,
          thickness: doorT,
          quantity: 1,
          materialId: doorMat.id,
          materialName: doorMat.name,
          grain: doorMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX,
          posY: doorZoneCenterY,
          posZ: facadeFrontCenterZ,
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
        parts.push({
          id: `${moduleId}_puerta_abat_${Date.now()}`,
          name: 'Puerta Abatible Inferior',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: w - gap,
          width: doorCutH,
          thickness: doorT,
          quantity: 1,
          materialId: doorMat.id,
          materialName: doorMat.name,
          grain: doorMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX,
          posY: doorZoneCenterY,
          posZ: facadeFrontCenterZ,
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
    }

    const module: FurnitureModule = {
      id: moduleId,
      name: groupName,
      type:
        config.moduleType === 'wall_cabinet' ||
        config.moduleType === 'base_cabinet' ||
        config.moduleType === 'tall_cabinet' ||
        config.moduleType === 'drawer_unit'
          ? config.moduleType
          : 'base_cabinet',
      width: w,
      height: h,
      depth: d,
      boardThickness: t,
      backThickness: backT,
      backType: config.backType || 'groove',
      shelvesCount: shelves,
      doorsCount: doorOpening === 'none' ? 0 : doorOpening === 'double' ? 2 : 1,
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
      type: 'assembly',
      isOpen: false,
      parametricConfig: config
    };

    return { module, parts, group };
  }

  /**
   * Reconstruye una configuración paramétrica a partir de las piezas existentes de un grupo
   * (incluyendo cajoneras, número de cajones, alturas individuales de frentes, zócalo y puertas)
   */
  reconstructConfigFromParts(parts: Part[], group: PartGroup): ParametricCabinetConfig {
    const normalizeConfig = (raw: Partial<ParametricCabinetConfig>): ParametricCabinetConfig => {
      const safeWidth = Math.max(200, Number(raw.width) || 600);
      const safeHeight = Math.max(200, Number(raw.height) || 750);
      const safeDepth = Math.max(150, Number(raw.depth) || 450);
      const safeStructT = Math.max(9, Number(raw.structureThickness) || 15);
      const safeDoorT = Math.max(9, Number(raw.doorThickness) || safeStructT);
      const safeBackT = Math.max(3, Number(raw.backThickness) || 3);
      const safeShelvesCount = Math.max(0, Math.min(8, Math.floor(Number(raw.shelvesCount) || 0)));
      const safeDrawersCount = Math.max(0, Math.min(6, Math.floor(Number(raw.drawersCount) || 0)));
      const hasPlinth = Boolean(raw.hasPlinth);
      const plinthHeight = hasPlinth ? Math.max(40, Math.min(250, Number(raw.plinthHeight) || 80)) : 80;
      const innerH = Math.max(100, safeHeight - (hasPlinth ? plinthHeight : 0) - 2 * safeStructT);

      let validOffsets: number[] = [];
      if (safeShelvesCount > 0) {
        if (Array.isArray(raw.shelfManualOffsets) && raw.shelfManualOffsets.length === safeShelvesCount) {
          validOffsets = raw.shelfManualOffsets.map((v, i) => {
            const num = Number(v);
            if (!Number.isFinite(num) || num <= 0) {
              const gap = (innerH - safeShelvesCount * safeStructT) / (safeShelvesCount + 1);
              return Math.max(40, Math.round(gap * (i + 1) + i * safeStructT));
            }
            return Math.max(40, Math.min(innerH - 40, Math.round(num)));
          });
        } else {
          const gap = (innerH - safeShelvesCount * safeStructT) / (safeShelvesCount + 1);
          for (let i = 0; i < safeShelvesCount; i++) {
            const yFromBottom = Math.round(gap * (i + 1) + i * safeStructT);
            validOffsets.push(Math.max(40, Math.min(innerH - 40, yFromBottom)));
          }
        }
      }

      let validDrawerHeights: number[] | undefined;
      if (safeDrawersCount > 0 && Array.isArray(raw.drawerManualHeights) && raw.drawerManualHeights.length === safeDrawersCount) {
        validDrawerHeights = raw.drawerManualHeights.map(v => Math.max(60, Math.round(Number(v) || 180)));
      }

      const isPureDrawerUnit =
        raw.moduleType === 'drawer_unit' ||
        raw.category === 'drawer_unit' ||
        (safeDrawersCount > 0 && (!raw.doorOpening || raw.doorOpening === 'none'));

      return {
        name: raw.name || group.name || 'Módulo Paramétrico',
        code: raw.code || 'MOD_' + group.id.slice(-4),
        moduleType: isPureDrawerUnit ? 'drawer_unit' : (raw.moduleType || 'base_cabinet'),
        category: isPureDrawerUnit ? 'drawer_unit' : (raw.category || 'kitchen_base'),
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
        doorOpening: raw.doorOpening || 'none',
        hasHandle: raw.hasHandle !== undefined ? Boolean(raw.hasHandle) : true,
        handleType: raw.handleType || 'bar_modern',
        handleFinish: raw.handleFinish || 'brushed_steel',
        handlePosition: raw.handlePosition || (isPureDrawerUnit ? 'horizontal' : 'vertical'),
        drawersCount: safeDrawersCount,
        drawerDistribution: raw.drawerDistribution === 'manual' ? 'manual' : 'uniform',
        drawerManualHeights: validDrawerHeights,
        slideType: raw.slideType || 'telescopic',
        hasPlinth,
        plinthHeight,
        structureMaterialId: raw.structureMaterialId || 'mat-1',
        doorMaterialId: raw.doorMaterialId || raw.structureMaterialId || 'mat-1',
        backMaterialId: raw.backMaterialId || raw.structureMaterialId || 'mat-1',
        facadeGap: Number(raw.facadeGap) || 3,
        posX: Number.isFinite(Number(raw.posX)) ? Number(raw.posX) : 0,
        posY: Number.isFinite(Number(raw.posY)) ? Number(raw.posY) : undefined,
        posZ: Number.isFinite(Number(raw.posZ)) ? Number(raw.posZ) : 0
      };
    };

    if (group.parametricConfig) {
      return normalizeConfig(group.parametricConfig);
    }

    const sidePart = parts.find(p => p.componentRole === 'side_left' || p.componentRole === 'side_right') || parts[0];
    const topOrBottom = parts.find(p => p.componentRole === 'bottom' || p.componentRole === 'top');
    const doorParts = parts.filter(p => p.componentRole === 'door');
    const drawerFrontParts = parts
      .filter(p => p.componentRole === 'drawer_front')
      .sort((a, b) => (a.posY ?? 0) - (b.posY ?? 0));
    const shelfParts = parts.filter(p => p.componentRole === 'shelf');
    const backPart = parts.find(p => p.componentRole === 'back');
    const plinthPart = parts.find(p => p.componentRole === 'plinth');

    const t = Number(sidePart?.thickness) || 15;
    const rawSideLen = Number(sidePart?.length) || 750;
    const rawSideWid = Number(sidePart?.width) || 450;
    const height = sidePart ? Math.max(rawSideLen, rawSideWid) : 750;
    const innerWidth = Number(topOrBottom?.length) || 570;
    const width = topOrBottom && topOrBottom.length >= widthFromParts(parts) - 5
      ? topOrBottom.length
      : innerWidth + 2 * t;

    const frontSample = doorParts[0] || drawerFrontParts[0];
    const doorT = frontSample ? Number(frontSample.thickness) || 15 : t;
    const hasFacade = doorParts.length > 0 || drawerFrontParts.length > 0;
    const depth = (sidePart ? Math.min(rawSideLen, rawSideWid) : 450) + (hasFacade ? doorT : 0);

    let doorOpening: ParametricCabinetConfig['doorOpening'] = 'none';
    if (doorParts.length === 2) {
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

    const drawersCount = Math.max(0, Math.min(6, drawerFrontParts.length));
    const drawerHeights = drawerFrontParts.map(df => Math.round(Number(df.width) || 180));
    const allSameHeight =
      drawerHeights.length <= 1 ||
      drawerHeights.every(hVal => Math.abs(hVal - drawerHeights[0]) <= 3);

    const isDrawerUnit = drawersCount > 0 && doorOpening === 'none';
    const shelvesCount = Math.max(0, Math.min(8, Math.floor(Number(shelfParts.length) || 0)));

    return normalizeConfig({
      name: group.name,
      code: 'MOD_' + group.id.slice(-4),
      moduleType: isDrawerUnit ? 'drawer_unit' : 'base_cabinet',
      category: isDrawerUnit ? 'drawer_unit' : 'kitchen_base',
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
      hasHandle: frontSample?.hardwareConfig?.handleType !== 'none',
      handleType: frontSample?.hardwareConfig?.handleType || 'bar_modern',
      handleFinish: frontSample?.hardwareConfig?.handleFinish || 'brushed_steel',
      handlePosition: frontSample?.hardwareConfig?.handlePosition || (isDrawerUnit ? 'horizontal' : 'vertical'),
      drawersCount,
      drawerDistribution: allSameHeight ? 'uniform' : 'manual',
      drawerManualHeights: drawerHeights.length > 0 ? drawerHeights : undefined,
      slideType: (drawerFrontParts[0]?.hardwareConfig?.slideType === 'undermount' || drawerFrontParts[0]?.hardwareConfig?.slideType === 'roller')
        ? drawerFrontParts[0].hardwareConfig.slideType
        : 'telescopic',
      hasPlinth: !!plinthPart,
      plinthHeight: plinthPart ? Math.round(Number(plinthPart.width) || 80) : 80,
      structureMaterialId: sidePart?.materialId || 'mat-1',
      doorMaterialId: frontSample?.materialId || sidePart?.materialId || 'mat-1',
      backMaterialId: backPart?.materialId || sidePart?.materialId || 'mat-1',
      facadeGap: 3,
      posX: Number(topOrBottom?.posX ?? parts[0]?.posX) || 0,
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
}

function widthFromParts(parts: Part[]): number {
  const f = parts.find(p => p.componentRole === 'drawer_front' || p.componentRole === 'door');
  return f ? f.length + 4 : 600;
}

