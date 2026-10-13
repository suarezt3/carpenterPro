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
   * Generates a fully parametric 1-Door Wall Cabinet (Alacena) with realistic joinery,
   * customizable door swing direction, internal shelves, and independent materials.
   */
  generateParametricWallCabinet(
    config: ParametricCabinetConfig, 
    materials: Material[]
  ): { module: FurnitureModule; parts: Part[]; group: PartGroup } {
    const moduleId = config.id || `module_cab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const groupId = `group_cab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const groupName = config.name || `Módulo Alto 1P (${config.code || 'MAL1PU001'})`;

    const mainMat = materials.find(m => m.id === config.structureMaterialId) || materials[0];
    const doorMat = materials.find(m => m.id === config.doorMaterialId) || mainMat;
    const backMat = materials.find(m => m.id === config.backMaterialId) || 
                    materials.find(m => m.thickness <= 6) || mainMat;

    const t = config.structureThickness || 18;
    const doorT = config.doorThickness || 18;
    const backT = config.backThickness || 3;
    const w = config.width || 600;
    const h = config.height || 800;
    const d = config.depth || 320;
    const gap = config.facadeGap ?? 3;

    // Coordinate centers
    const posX = config.posX ?? 0;
    // Standard wall cabinet height: elevation ~1450 mm from floor to bottom, so center Y = 1450 + h / 2
    const posY = config.posY ?? (1450 + h / 2);
    const posZ = config.posZ ?? 0;

    const carcassDepth = d - doorT;
    const innerWidth = w - (2 * t);
    const carcassCenterZ = posZ - (doorT / 2);

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
      edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
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

    // 5. Repisas Interiores
    const shelves = config.shelvesCount ?? 1;
    if (shelves > 0) {
      const bottomY = posY - (h / 2) + t;
      const topY = posY + (h / 2) - t;
      const stepY = (topY - bottomY) / (shelves + 1);

      for (let i = 1; i <= shelves; i++) {
        const shelfY = bottomY + (stepY * i);
        parts.push({
          id: `${moduleId}_repisa_${i}_${Date.now()}`,
          name: `Repisa Interior ${i}`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: innerWidth - 2, // 2mm de holgura de montaje
          width: carcassDepth - 15, // 15mm de retranqueo frontal para no chocar con bisagras y puerta
          thickness: t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX,
          posY: shelfY,
          posZ: carcassCenterZ - 7.5,
          orientation: 'horizontal',
          componentRole: 'shelf',
          notes: `Repisa regulable nivel ${i}`
        });
      }
    }

    // 6. Fondo Trasero (MDF 3mm)
    if (config.backType !== 'none') {
      parts.push({
        id: `${moduleId}_fondo_${Date.now()}`,
        name: 'Fondo Trasero MDF',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: w - 4,
        width: h - 4,
        thickness: backT,
        quantity: 1,
        materialId: backMat.id,
        materialName: backMat.name,
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX,
        posY,
        posZ: posZ - (d / 2) + (backT / 2),
        orientation: 'vertical_xy',
        componentRole: 'back',
        notes: 'Fondo MDF 3mm'
      });
    }

    // 7. Puerta Frontal con herrajes dinámicos
    const doorOpening = config.doorOpening || 'left';
    const isGasLift = doorOpening === 'top';
    const doorPosZ = posZ + (d / 2) - (doorT / 2);

    parts.push({
      id: `${moduleId}_puerta_${Date.now()}`,
      name: `Puerta Frontal (Abre: ${doorOpening})`,
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
      notes: `Puerta frontal abatible hacia ${doorOpening}`,
      hardwareConfig: {
        isMovable: true,
        movableType: 'door',
        openingDirection: doorOpening,
        hingeType: isGasLift ? 'gas_piston' : 'straight',
        handleType: config.handleType || 'bar_modern',
        handleFinish: config.handleFinish || 'brushed_steel',
        handlePosition: isGasLift ? 'horizontal' : 'vertical',
        isOpen: false
      }
    });

    const module: FurnitureModule = {
      id: moduleId,
      name: groupName,
      type: 'wall_cabinet',
      width: w,
      height: h,
      depth: d,
      boardThickness: t,
      backThickness: backT,
      backType: config.backType || 'groove',
      shelvesCount: shelves,
      doorsCount: 1,
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
      isOpen: false
    };

    return { module, parts, group };
  }
}

