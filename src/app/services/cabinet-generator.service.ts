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
  /**
   * Generates a fully parametric furniture module (Kitchen Base, Wall Cabinet, Closet,
   * Vanity, Bookshelf, or Custom) with exact joinery calculations, door configurations
   * (none, left, right, double, lift-up), handles, and uniform/manual shelf distributions.
   */
  generateParametricCabinet(
    config: ParametricCabinetConfig, 
    materials: Material[]
  ): { module: FurnitureModule; parts: Part[]; group: PartGroup } {
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

    const t = config.structureThickness || 15;
    const doorT = config.doorThickness || 15;
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
    const posX = config.posX ?? 0;
    
    // Default elevation (posY):
    let posY = config.posY;
    if (posY === undefined) {
      if (config.moduleType === 'wall_cabinet') {
        posY = 1450 + (h / 2); // Alacena elevada
      } else if (config.moduleType === 'vanity') {
        posY = 250 + (h / 2); // Mueble suspendido baño
      } else {
        posY = h / 2; // Apoyado en el suelo
      }
    }
    const posZ = config.posZ ?? 0;

    const carcassCenterZ = hasDoor ? posZ - (doorT / 2) : posZ;
    const carcassBackZ = carcassCenterZ - (carcassDepth / 2);
    const carcassFrontZ = carcassCenterZ + (carcassDepth / 2);
    const parts: Part[] = [];

    // 1. Lateral Izquierdo
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
      posX: posX - (w / 2) + (t / 2),
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
      edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'none' },
      posX: posX + (w / 2) - (t / 2),
      posY,
      posZ: carcassCenterZ,
      orientation: 'vertical_yz',
      componentRole: 'side_right',
      notes: 'Lateral exterior derecho'
    });

    // 3. Techo Superior
    parts.push({
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
      posY: posY + (h / 2) - (t / 2),
      posZ: carcassCenterZ,
      orientation: 'horizontal',
      componentRole: 'top',
      notes: 'Tapa superior estructural'
    });

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
      posY: posY - (h / 2) + (t / 2),
      posZ: carcassCenterZ,
      orientation: 'horizontal',
      componentRole: 'bottom',
      notes: 'Base inferior estructural'
    });

    // 5. Repisas / Entrepaños Interiores
    const includeBack = config.backType !== 'none' && config.hasBackPanel !== false;
    const shelves = config.shelvesCount ?? 0;
    if (shelves > 0) {
      const bottomY = posY - (h / 2) + t;
      const topY = posY + (h / 2) - t;
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
        ? Math.max(50, innerHeight - 2) 
        : Math.max(50, h - 4);

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
        posY,
        posZ: backPosZ,
        orientation: 'vertical_xy',
        componentRole: 'back',
        notes: isGroove 
          ? `Fondo MDF ranurado a 15mm (medida corte con espigas: ${innerWidth + 14}x${innerHeight + 14} mm)`
          : `Fondo MDF sobrepuesto clavado al dorso (${w - 4}x${h - 4} mm)`
      });
    }

    // 7. Puerta(s) Frontal(es)
    const doorPosZ = carcassFrontZ + (doorT / 2);
    const hasHandle = config.hasHandle !== false;
    const hType = hasHandle ? (config.handleType || 'bar_modern') : 'none';
    const hFinish = config.handleFinish || 'brushed_steel';
    const isGasLift = doorOpening === 'top';

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
        width: h - gap,
        thickness: doorT,
        quantity: 1,
        materialId: doorMat.id,
        materialName: doorMat.name,
        grain: doorMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX,
        posY,
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
        width: h - gap,
        thickness: doorT,
        quantity: 1,
        materialId: doorMat.id,
        materialName: doorMat.name,
        grain: doorMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX: leftDoorX,
        posY,
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
        width: h - gap,
        thickness: doorT,
        quantity: 1,
        materialId: doorMat.id,
        materialName: doorMat.name,
        grain: doorMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX: rightDoorX,
        posY,
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
        width: h - gap,
        thickness: doorT,
        quantity: 1,
        materialId: doorMat.id,
        materialName: doorMat.name,
        grain: doorMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX,
        posY,
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
        width: h - gap,
        thickness: doorT,
        quantity: 1,
        materialId: doorMat.id,
        materialName: doorMat.name,
        grain: doorMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX,
        posY,
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
      parametricConfig: config
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

    const mainMat = materials.find(m => m.id === config.structureMaterialId) || materials[0];
    const frontMat = materials.find(m => m.id === config.doorMaterialId) || mainMat;
    const backMat = materials.find(m => m.id === config.backMaterialId) ||
                    materials.find(m => m.thickness <= 6) ||
                    materials.find(m => m.name.toLowerCase().includes('mdf')) ||
                    { id: 'mat_mdf_3', name: 'MDF 3mm', thickness: 3 };

    const t = Math.max(12, Number(config.structureThickness) || 18);
    const doorT = Math.max(12, Number(config.doorThickness) || t);
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

    // Coordenadas del centro
    const posX = Number.isFinite(Number(config.posX)) ? Number(config.posX) : 0;
    const posY = Number.isFinite(Number(config.posY)) ? Number(config.posY) : (h / 2);
    const posZ = Number.isFinite(Number(config.posZ)) ? Number(config.posZ) : 0;

    // Medidas del casco (carcass)
    const carcassDepth = isOverlay ? Math.max(200, d - doorT) : d;
    const carcassCenterZ = isOverlay ? (posZ - (doorT / 2)) : posZ;
    const carcassFrontZ = carcassCenterZ + (carcassDepth / 2);
    const carcassBackZ = carcassCenterZ - (carcassDepth / 2);

    const innerWidth = Math.max(50, w - (2 * t));
    const sideH = Math.max(100, h - t - plinthH);
    const sideCenterY = posY - (h / 2) + plinthH + (sideH / 2);

    const parts: Part[] = [];

    // 1. Cubierta Superior / Tapa (cubre todo el ancho y fondo del mueble)
    parts.push({
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
    });

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
    const availableFrontH = isOverlay
      ? (h - plinthH - t - (gap * (drawersCount + 1)))
      : (sideH - t - (gap * (drawersCount + 1)));

    const frontHeight = Math.max(60, Math.floor((availableFrontH / drawersCount) * 10) / 10);
    const frontWidth = isOverlay ? Math.max(100, w - (gap * 2)) : Math.max(100, innerWidth - (gap * 2));
    const frontCenterZ = isOverlay ? (posZ + (d / 2) - (doorT / 2)) : (carcassFrontZ - (doorT / 2));

    const standardLengths = [250, 300, 350, 400, 450, 500, 550, 600];
    const targetDepth = carcassDepth - 35;
    const slideLength = standardLengths.filter(l => l <= targetDepth).pop() || 350;

    const boxClearancePerSide = 12.7; // 1/2" por lado
    const boxOuterWidth = innerWidth - (boxClearancePerSide * 2);
    const boxInnerWidth = boxOuterWidth - (2 * t);
    const boxHeight = Math.max(70, Math.min(Math.floor(frontHeight * 0.72), 220));
    const boxFrontZ = frontCenterZ - (doorT / 2);

    for (let i = 0; i < drawersCount; i++) {
      const drawerIdx = i + 1; // 1 = Inferior, ..., N = Superior
      const drawerUid = `${Date.now()}_${i}_${Math.random().toString(36).substring(2, 5)}`;
      const drawerLabel = drawersCount === 3
        ? (i === 0 ? 'Cajón Inferior' : (i === 1 ? 'Cajón Medio' : 'Cajón Superior'))
        : `Cajón ${drawerIdx}`;

      const frontBottomY = (posY - (h / 2) + plinthH) + gap + (i * (frontHeight + gap));
      const frontCenterY = frontBottomY + (frontHeight / 2);
      const boxCenterY = frontCenterY - ((frontHeight - boxHeight) * 0.12);

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
        width: boxHeight,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: posX - (boxOuterWidth / 2) + (t / 2),
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
        width: boxHeight,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: posX + (boxOuterWidth / 2) - (t / 2),
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
        width: boxHeight,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: boxCenterY,
        posZ: boxFrontZ - (t / 2),
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
        width: boxHeight,
        thickness: t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: boxCenterY,
        posZ: boxFrontZ - slideLength + (t / 2),
        orientation: 'vertical_xy',
        componentRole: 'drawer_box',
        notes: 'Trasera de caja interior'
      });

      // Fondo MDF de Caja
      parts.push({
        id: `${moduleId}_caj_${drawerIdx}_fondo_${drawerUid}`,
        name: `${drawerLabel} - Fondo MDF`,
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: boxInnerWidth,
        width: slideLength - (2 * t),
        thickness: backT,
        quantity: 1,
        materialId: backMat.id,
        materialName: backMat.name,
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY: boxCenterY - (boxHeight / 2) + (backT / 2) + 8,
        posZ: boxFrontZ - (slideLength / 2),
        orientation: 'horizontal',
        componentRole: 'drawer_box',
        notes: `Fondo de cajón MDF ${backT}mm`
      });
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
      type: 'assembly',
      isOpen: false,
      parametricConfig: config
    };

    return { module, parts, group };
  }

  /**
   * Reconstruye una configuración paramétrica a partir de las piezas existentes de un grupo
   */
  reconstructConfigFromParts(parts: Part[], group: PartGroup): ParametricCabinetConfig {
    const normalizeConfig = (raw: Partial<ParametricCabinetConfig>): ParametricCabinetConfig => {
      const safeWidth = Math.max(200, Number(raw.width) || 600);
      const safeHeight = Math.max(200, Number(raw.height) || 800);
      const safeDepth = Math.max(150, Number(raw.depth) || 350);
      const safeStructT = Math.max(9, Number(raw.structureThickness) || 15);
      const safeDoorT = Math.max(9, Number(raw.doorThickness) || safeStructT);
      const safeBackT = Math.max(3, Number(raw.backThickness) || 3);
      const safeShelvesCount = Math.max(0, Math.min(8, Math.floor(Number(raw.shelvesCount) || 0)));
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

      return {
        name: raw.name || group.name || 'Módulo Paramétrico',
        code: raw.code || ('MOD_' + group.id.slice(-4)),
        moduleType: raw.moduleType || 'base_cabinet',
        category: raw.category || 'kitchen_base',
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
        handlePosition: raw.handlePosition || 'vertical',
        structureMaterialId: raw.structureMaterialId || 'mat-1',
        doorMaterialId: raw.doorMaterialId || raw.structureMaterialId || 'mat-1',
        backMaterialId: raw.backMaterialId || raw.structureMaterialId || 'mat-1',
        facadeGap: Number(raw.facadeGap) || 3,
        posX: Number.isFinite(Number(raw.posX)) ? Number(raw.posX) : 0,
        posY: Number.isFinite(Number(raw.posY)) ? Number(raw.posY) : undefined,
        posZ: Number.isFinite(Number(raw.posZ)) ? Number(raw.posZ) : 0,
        drawersCount: Math.max(1, Math.min(6, Math.floor(Number(raw.drawersCount) || 3))),
        drawerSlideType: raw.drawerSlideType || 'telescopic',
        drawerFrontType: raw.drawerFrontType || 'overlay',
        hasPlinth: raw.hasPlinth !== undefined ? Boolean(raw.hasPlinth) : true,
        plinthHeight: Number(raw.plinthHeight) || 70
      };
    };

    if (group.parametricConfig) {
      return normalizeConfig(group.parametricConfig);
    }

    const sidePart = parts.find(p => p.componentRole === 'side_left' || p.componentRole === 'side_right') || parts[0];
    const topOrBottom = parts.find(p => p.componentRole === 'top' || p.componentRole === 'bottom');
    const doorParts = parts.filter(p => p.componentRole === 'door');
    const drawerFronts = parts.filter(p => p.componentRole === 'drawer_front');
    const shelfParts = parts.filter(p => p.componentRole === 'shelf');
    const backPart = parts.find(p => p.componentRole === 'back');

    const t = Number(sidePart?.thickness) || 15;
    const rawSideLen = Number(sidePart?.length) || 800;
    const rawSideWid = Number(sidePart?.width) || 300;
    const height = sidePart ? (rawSideLen > rawSideWid ? rawSideLen : rawSideWid) : 800;
    const innerWidth = Number(topOrBottom?.length) || 570;
    const width = innerWidth + (2 * t);
    const doorT = doorParts.length > 0
      ? (Number(doorParts[0]?.thickness) || 15)
      : (drawerFronts.length > 0 ? (Number(drawerFronts[0]?.thickness) || t) : t);
    const depth = (sidePart ? (rawSideLen > rawSideWid ? rawSideWid : rawSideLen) : 300) + (doorParts.length > 0 || drawerFronts.length > 0 ? doorT : 0);

    // Caso de módulo con cajones (Cajonera)
    if (drawerFronts.length > 0 || parts.some(p => p.componentRole === 'drawer_box')) {
      const drawersCount = drawerFronts.length || 3;
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

    const shelvesCount = Math.max(0, Math.min(8, Math.floor(Number(shelfParts.length) || 0)));

    return normalizeConfig({
      name: group.name,
      code: 'MOD_' + group.id.slice(-4),
      moduleType: 'base_cabinet',
      category: 'kitchen_base',
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
}

