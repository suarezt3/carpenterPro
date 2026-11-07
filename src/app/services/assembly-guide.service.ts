import { computed, inject, Injectable } from '@angular/core';
import {
  ComponentRole,
  Part,
  PartEdges,
  PartGroup,
  Project,
  isStoneMaterial,
  Material
} from '../models/melamine.models';
import { ProjectStorageService } from './project-storage.service';
import { JoineryEngineService } from './joinery-engine.service';
import { I18nService } from './i18n.service';

export interface AssemblyGuidePiece {
  partId: string;
  code: string; // ej. "P1", "P2", "P3"...
  name: string;
  translatedName: string;
  length: number;
  width: number;
  thickness: number;
  quantity: number;
  materialName: string;
  edges: PartEdges;
  componentRole?: ComponentRole;
  part: Part;
}

export type AssemblyHardwareType =
  | 'screw_structural'
  | 'nail_back'
  | 'shelf_pin'
  | 'drawer_slide'
  | 'screw_slide_hinge'
  | 'hinge'
  | 'handle'
  | 'closet_rod';

export interface AssemblyHardwareItem {
  id: string;
  name: string;
  codeName: string;
  spec: string;
  quantity: number;
  type: AssemblyHardwareType;
  iconName: string;
  description?: string;
}

export interface AssemblyStepMeasurement {
  label: string;
  valueMm: number;
  referenceText?: string;
}

export interface AssemblyStep {
  stepNumber: number;
  titleKey: string;
  defaultTitle: string;
  descriptionKey: string;
  defaultDescription: string;
  tips: string[];
  actionType: 'carcass' | 'back' | 'shelves' | 'drawers' | 'doors' | 'accessories';
  partCodes: string[];
  parts: AssemblyGuidePiece[];
  hardware: AssemblyHardwareItem[];
  measurements?: AssemblyStepMeasurement[];
}

export interface ModuleAssemblyGuide {
  moduleId: string;
  moduleName: string;
  moduleType?: string;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  totalPartsCount: number;
  estimatedAssemblyTimeMinutes: number;
  requiredTools: string[];
  hardwareKit: AssemblyHardwareItem[];
  pieces: AssemblyGuidePiece[];
  steps: AssemblyStep[];
  rawParts: Part[];
}

@Injectable({
  providedIn: 'root'
})
export class AssemblyGuideService {
  private readonly projectStorage = inject(ProjectStorageService);
  private readonly joineryEngine = inject(JoineryEngineService);
  private readonly i18n = inject(I18nService);

  /**
   * Signal reactivo que evalúa si el proyecto actual tiene muebles armables válidos.
   */
  readonly canGenerateAssemblyGuide = computed<boolean>(() => {
    const project = this.projectStorage.currentProject();
    if (!project || !project.parts || project.parts.length === 0) {
      return false;
    }
    const mats = project.materials || [];
    const validParts = project.parts.filter(p => {
      if (p.componentRole === 'countertop' || p.componentRole === 'backsplash') {
        return false;
      }
      const mat = mats.find(m => m.id === p.materialId);
      return !isStoneMaterial(mat);
    });
    return validParts.length > 0;
  });

  /**
   * Signal reactivo con las guías de armado completas calculadas para el proyecto activo.
   */
  readonly guides = computed<ModuleAssemblyGuide[]>(() => {
    const project = this.projectStorage.currentProject();
    if (!project) return [];
    return this.generateGuidesForProject(project);
  });

  /**
   * Mapa reactivo de PartId a Código de Pieza (P1, P2...) para vincular etiquetas de taller y despiece.
   */
  readonly pieceCodeMap = computed<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const guide of this.guides()) {
      for (const piece of guide.pieces) {
        map.set(piece.partId, piece.code);
      }
    }
    return map;
  });

  /**
   * Obtiene el código identificador (P1, P2...) correspondiente a una pieza específica.
   */
  getPieceCodeForPart(partId: string): string {
    return this.pieceCodeMap().get(partId) || '';
  }

  /**
   * Analiza el proyecto y genera las guías de ensamble para cada mueble.
   * Excluye mesones puros de piedra o melamina y agrupa piezas por módulo/grupo.
   */
  generateGuidesForProject(project: Project): ModuleAssemblyGuide[] {
    const materials = project.materials || [];
    const isStone = (matId: string, matName?: string): boolean => {
      const mat = materials.find(m => m.id === matId) || ({ id: matId, name: matName || '' } as Material);
      return isStoneMaterial(mat);
    };

    // Filtrar piezas armables (excluir mesones y salpicaderos de piedra)
    const armableParts = (project.parts || []).filter(p => {
      if (p.componentRole === 'countertop' || p.componentRole === 'backsplash') {
        return false;
      }
      if (isStone(p.materialId, p.materialName)) {
        return false;
      }
      return true;
    });

    if (armableParts.length === 0) {
      return [];
    }

    const groups = project.groups || [];
    const guides: ModuleAssemblyGuide[] = [];

    // Determinar qué grupos son módulos armables (excluir grupos de mesones puros)
    const armableGroups = groups.filter(g => {
      if (g.isCountertop) return false;
      const groupParts = armableParts.filter(p => p.groupId === g.id || p.moduleId === g.id);
      return groupParts.length > 0;
    });

    const processedPartIds = new Set<string>();

    for (const group of armableGroups) {
      const groupParts = armableParts.filter(p => p.groupId === group.id || p.moduleId === group.id);
      if (groupParts.length > 0) {
        groupParts.forEach(p => processedPartIds.add(p.id));
        const guide = this.buildModuleGuide(group.id, group.name, groupParts, group);
        if (guide) {
          guides.push(guide);
        }
      }
    }

    // Piezas que no tienen grupo o cuyo grupo no está en project.groups
    const orphanParts = armableParts.filter(p => !processedPartIds.has(p.id));
    if (orphanParts.length > 0) {
      // Subdividir por moduleId o nombre si existen, o agrupar en un mueble principal
      const modulesMap = new Map<string, { name: string; parts: Part[] }>();

      for (const part of orphanParts) {
        const key = part.moduleId || part.groupName || part.moduleName || 'default_module';
        const name = part.moduleName || part.groupName || project.name || 'Mueble Principal';
        if (!modulesMap.has(key)) {
          modulesMap.set(key, { name, parts: [] });
        }
        modulesMap.get(key)!.parts.push(part);
      }

      for (const [key, mod] of modulesMap.entries()) {
        const guide = this.buildModuleGuide(key, mod.name, mod.parts, null);
        if (guide) {
          guides.push(guide);
        }
      }
    }

    return guides;
  }

  /**
   * Construye la ficha técnica, despiece indexado, kit de herrajes y pasos secuenciales de un mueble.
   */
  private buildModuleGuide(
    moduleId: string,
    moduleName: string,
    parts: Part[],
    group: PartGroup | null
  ): ModuleAssemblyGuide | null {
    if (parts.length === 0) return null;

    // 1. Dimensiones exteriores totales y Bounding Box
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

    const calculatedWidth = Math.max(100, Math.round(maxX - minX));
    const calculatedHeight = Math.max(100, Math.round(maxY - minY));
    const calculatedDepth = Math.max(100, Math.round(maxZ - minZ));

    const paramConfig = group?.parametricConfig;
    const width = paramConfig?.width ? Math.round(paramConfig.width) : calculatedWidth;
    const height = paramConfig?.height ? Math.round(paramConfig.height) : calculatedHeight;
    const depth = paramConfig?.depth ? Math.round(paramConfig.depth) : calculatedDepth;

    // 2. Indexación ordenada de piezas P1, P2, P3...
    const sortedParts = this.sortPartsForAssembly(parts);
    const pieces: AssemblyGuidePiece[] = sortedParts.map((p, idx) => ({
      partId: p.id,
      code: `P${idx + 1}`,
      name: p.name,
      translatedName: this.i18n.translatePartName(p.name),
      length: Math.round(p.length),
      width: Math.round(p.width),
      thickness: Math.round(p.thickness || 18),
      quantity: Math.max(1, p.quantity || 1),
      materialName: p.materialName || 'Melamina',
      edges: p.edges || { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
      componentRole: p.componentRole,
      part: p
    }));

    const totalPartsCount = pieces.reduce((sum, p) => sum + p.quantity, 0);

    // 3. Detección de elementos funcionales (cajones, puertas, repisas, divisores, fondos)
    const drawersCount = this.detectDrawersCount(parts, group);
    const doorParts = pieces.filter(p => p.componentRole === 'door');
    const doorsCount = doorParts.reduce((sum, p) => sum + p.quantity, 0);
    const shelfParts = pieces.filter(p => p.componentRole === 'shelf');
    const shelvesCount = shelfParts.reduce((sum, p) => sum + p.quantity, 0);
    const dividerParts = pieces.filter(p => p.componentRole === 'divider');
    const dividersCount = dividerParts.reduce((sum, p) => sum + p.quantity, 0);
    const backParts = pieces.filter(p => p.componentRole === 'back' || (p.thickness <= 3 && p.length * p.width > 80000));
    const hasBack = backParts.length > 0;

    // 4. Tiempo estimado de armado
    let estMinutes = 20;
    estMinutes += drawersCount * 12;
    estMinutes += doorsCount * 6;
    estMinutes += (shelvesCount + dividersCount) * 3;
    estMinutes += Math.max(0, pieces.length - 4) * 1.5;
    const estimatedAssemblyTimeMinutes = Math.max(20, Math.ceil(estMinutes / 5) * 5);

    // 5. Herramientas requeridas
    const requiredTools = [
      'assemblyGuide.toolDrill',
      'assemblyGuide.toolTapeMeasure',
      'assemblyGuide.toolSquare',
      'assemblyGuide.toolRubberMallet'
    ];

    // 6. Cálculo exacto del Kit de Tornillería y Herrajes
    const screwsPerJoint = depth > 350 ? 3 : 2;
    const hardwareKit = this.calculateHardwareKit({
      width,
      height,
      depth,
      screwsPerJoint,
      drawersCount,
      doorsCount,
      doorParts,
      shelvesCount,
      dividersCount,
      hasBack,
      backParts,
      pieces,
      paramConfig
    });

    // 7. Pasos dinámicos de armado
    const steps = this.generateAssemblySteps({
      moduleId,
      moduleName,
      width,
      height,
      depth,
      screwsPerJoint,
      pieces,
      drawersCount,
      doorsCount,
      shelvesCount,
      dividersCount,
      hasBack,
      backParts,
      hardwareKit,
      minY,
      maxY,
      minZ,
      paramConfig
    });

    return {
      moduleId,
      moduleName,
      moduleType: paramConfig?.moduleType || group?.type || 'cabinet',
      dimensions: { width, height, depth },
      totalPartsCount,
      estimatedAssemblyTimeMinutes,
      requiredTools,
      hardwareKit,
      pieces,
      steps,
      rawParts: parts
    };
  }

  /**
   * Ordena lógicamente las piezas según su secuencia de ensamble:
   * 1. Casco y estructura (costados, piso, amarres, zócalos)
   * 2. Fondo trasero
   * 3. Divisiones y repisas fijas/móviles
   * 4. Componentes de cajones
   * 5. Puertas y frentes
   */
  private sortPartsForAssembly(parts: Part[]): Part[] {
    const rolePriority: Record<string, number> = {
      side_left: 10,
      side_right: 11,
      bottom: 12,
      plinth: 13,
      top: 14,
      tie: 15,
      back: 20,
      divider: 30,
      shelf: 31,
      drawer_box: 40,
      drawer_lateral: 41,
      drawer_front: 42,
      door: 50,
      front: 51,
      free: 60
    };

    return [...parts].sort((a, b) => {
      const pA = rolePriority[a.componentRole || 'free'] ?? 55;
      const pB = rolePriority[b.componentRole || 'free'] ?? 55;
      if (pA !== pB) return pA - pB;
      const areaDiff = (b.length * b.width) - (a.length * a.width);
      if (Math.abs(areaDiff) > 1) return areaDiff;
      return (a.name || '').localeCompare(b.name || '') || a.id.localeCompare(b.id);
    });
  }

  /**
   * Detecta la cantidad real de cajones en el módulo.
   */
  private detectDrawersCount(parts: Part[], group: PartGroup | null): number {
    if (group?.parametricConfig?.drawersCount && group.parametricConfig.drawersCount > 0) {
      return group.parametricConfig.drawersCount;
    }
    const drawerFronts = parts.filter(p => p.componentRole === 'drawer_front');
    if (drawerFronts.length > 0) {
      return drawerFronts.reduce((sum, p) => sum + p.quantity, 0);
    }
    const drawerGroups = new Set(
      parts
        .filter(p => p.componentRole?.startsWith('drawer_') || p.groupName?.toLowerCase().includes('cajón') || p.groupName?.toLowerCase().includes('cajon'))
        .map(p => p.groupId || p.groupName)
        .filter(Boolean)
    );
    if (drawerGroups.size > 0) {
      return drawerGroups.size;
    }
    return 0;
  }

  /**
   * Calcula el kit completo y exacto de tornillería y herrajes según las especificaciones técnicas.
   */
  private calculateHardwareKit(params: {
    width: number;
    height: number;
    depth: number;
    screwsPerJoint: number;
    drawersCount: number;
    doorsCount: number;
    doorParts: AssemblyGuidePiece[];
    shelvesCount: number;
    dividersCount: number;
    hasBack: boolean;
    backParts: AssemblyGuidePiece[];
    pieces: AssemblyGuidePiece[];
    paramConfig?: import('../models/melamine.models').ParametricCabinetConfig;
  }): AssemblyHardwareItem[] {
    const {
      width,
      height,
      depth,
      screwsPerJoint,
      drawersCount,
      doorsCount,
      doorParts,
      shelvesCount,
      dividersCount,
      hasBack,
      backParts,
      pieces,
      paramConfig
    } = params;

    const kit: AssemblyHardwareItem[] = [];

    // 1. Tornillos estructurales 4.0 x 50 mm (o Minifix + Tarugos)
    // - Piso contra 2 laterales: 2 uniones * screwsPerJoint
    // - Techo o Amarres superiores: 2 uniones * screwsPerJoint (si son 2 amarres, 4 uniones)
    // - Zócalos: 2 uniones * screwsPerJoint
    // - Repisas fijas / Divisores: 2 uniones * screwsPerJoint cada uno
    // - Cajas de cajones: 8 tornillos por cajón (4 esquinas * 2 tornillos)
    const hasTop = pieces.some(p => p.componentRole === 'top');
    const tieCount = pieces.filter(p => p.componentRole === 'tie').reduce((s, p) => s + p.quantity, 0);
    const plinthCount = pieces.filter(p => p.componentRole === 'plinth').reduce((s, p) => s + p.quantity, 0);

    let structuralJoints = 2; // Piso contra laterales
    if (hasTop) {
      structuralJoints += 2; // Techo completo
    } else if (tieCount > 0) {
      structuralJoints += Math.min(6, tieCount * 2); // Amarres
    } else {
      structuralJoints += 2; // Techo asumido
    }

    if (plinthCount > 0) {
      structuralJoints += plinthCount * 2;
    }
    if (dividersCount > 0) {
      structuralJoints += dividersCount * 2;
    }

    let structuralScrews = structuralJoints * screwsPerJoint;
    if (drawersCount > 0) {
      structuralScrews += drawersCount * 8; // Armado de las 4 esquinas de cada caja de cajón
    }
    // Asegurar mínimo técnico razonable
    structuralScrews = Math.max(8, structuralScrews);

    kit.push({
      id: 'screw_structural_50',
      name: 'assemblyGuide.hardwareStructuralScrews',
      codeName: 'Tornillo Soberbio 4.0 × 50 mm',
      spec: '4.0 × 50 mm (Punta Phillips / Pozidriv)',
      quantity: structuralScrews,
      type: 'screw_structural',
      iconName: 'wrench',
      description: `${screwsPerJoint} tornillos por unión estructural en paneles de 15/18 mm.`
    });

    // 2. Tornillos o puntillas para fondo trasero (3 mm) cada 150 mm
    if (hasBack) {
      let backPerimeterMm = 2 * (width + height);
      if (backParts.length > 0) {
        const bp = backParts[0];
        backPerimeterMm = 2 * (bp.length + bp.width);
      }
      const backFasteners = Math.max(14, Math.ceil(backPerimeterMm / 150));
      kit.push({
        id: 'nail_back_panel',
        name: 'assemblyGuide.hardwareBackFasteners',
        codeName: 'Puntillas / Tornillos para Fondo',
        spec: '3.0 × 15 mm con arandela o puntillas 3/4"',
        quantity: backFasteners,
        type: 'nail_back',
        iconName: 'pin',
        description: 'Colocación perimetral cada 150 mm para escuadrar el mueble.'
      });
    }

    // 3. Soportes / Pines de repisa móvil (4 por repisa interna)
    if (shelvesCount > 0) {
      const shelfPins = shelvesCount * 4;
      kit.push({
        id: 'shelf_pins',
        name: 'assemblyGuide.hardwareShelfPins',
        codeName: 'Soportes para Repisa Móvil',
        spec: 'Pin metálico niquelado Ø 5 mm',
        quantity: shelfPins,
        type: 'shelf_pin',
        iconName: 'layers',
        description: '4 soportes nivelados por cada repisa interior.'
      });
    }

    // 4. Juegos de correderas telescópicas para cajones + tornillos 3.5 x 15 mm
    let slideScrews = 0;
    if (drawersCount > 0) {
      const slideLength = paramConfig?.depth ? Math.min(500, Math.max(250, Math.floor(paramConfig.depth / 50) * 50)) : 450;
      kit.push({
        id: 'telescopic_slides',
        name: 'assemblyGuide.hardwareSlides',
        codeName: 'Correderas Telescópicas',
        spec: `Par telescópico ${slideLength} mm (extensión total)`,
        quantity: drawersCount,
        type: 'drawer_slide',
        iconName: 'sliders',
        description: '1 juego (izq + der) por cada cajón del mueble.'
      });
      slideScrews = drawersCount * 8; // 4 tornillos al lateral + 4 tornillos al cajón
    }

    // 5. Bisagras cazoleta 35 mm para puertas + tornillos 3.5 x 15 mm
    let totalHinges = 0;
    if (doorsCount > 0) {
      for (const dp of doorParts) {
        const doorH = Math.max(dp.length, dp.width);
        const hingesPerDoor = doorH >= 1600 ? 4 : (doorH >= 900 ? 3 : 2);
        totalHinges += hingesPerDoor * dp.quantity;
      }
      totalHinges = Math.max(2, totalHinges);

      kit.push({
        id: 'cup_hinges',
        name: 'assemblyGuide.hardwareHinges',
        codeName: 'Bisagras Cazoleta 35 mm',
        spec: 'Cazoleta Ø 35 mm con base regulable en 3 ejes',
        quantity: totalHinges,
        type: 'hinge',
        iconName: 'unfold',
        description: '2 a 3 bisagras por puerta según su altura.'
      });
    }

    // 6. Tornillos 3.5 x 15 mm para rieles y bases de bisagras
    const hingeScrews = totalHinges * 4;
    const totalSmallScrews = slideScrews + hingeScrews;
    if (totalSmallScrews > 0) {
      kit.push({
        id: 'screw_hardware_15',
        name: 'assemblyGuide.hardwareSlideScrews',
        codeName: 'Tornillos para Herrajes 3.5 × 15 mm',
        spec: '3.5 × 15 mm autorroscante cabeza avellanada',
        quantity: totalSmallScrews,
        type: 'screw_slide_hinge',
        iconName: 'wrench',
        description: 'Fijación de rieles correderos y placas base de bisagras.'
      });
    }

    // 7. Manijas / Tiradores con tornillos M4
    const totalHandles = doorsCount + drawersCount;
    if (totalHandles > 0) {
      kit.push({
        id: 'handles_knobs',
        name: 'assemblyGuide.hardwareHandles',
        codeName: 'Tiradores / Manijas',
        spec: 'Tirador ergonómico + tornillos milimétricos M4 × 22 mm',
        quantity: totalHandles,
        type: 'handle',
        iconName: 'tag',
        description: '1 tirador por cada puerta y frente de cajón.'
      });
    }

    // 8. Tubo colgador para closets si aplica (desde config paramétrica o piezas de tubo/barra)
    const rodPartsCount = pieces.filter(p =>
      p.part.shapeType === 'circle' ||
      p.name.toLowerCase().includes('tubo') ||
      p.name.toLowerCase().includes('colgador') ||
      p.name.toLowerCase().includes('barra closet')
    ).reduce((s, p) => s + p.quantity, 0);

    const hangingRods = Math.max(paramConfig?.hangingRodsCount || 0, rodPartsCount);
    if (hangingRods > 0) {
      kit.push({
        id: 'closet_hanging_rod',
        name: 'assemblyGuide.hardwareClosetRod',
        codeName: 'Tubo Colgador + Bridas Laterales',
        spec: 'Tubo ovalado cromado + 2 bridas soporte',
        quantity: hangingRods,
        type: 'closet_rod',
        iconName: 'ruler',
        description: 'Soporte de colgado para closet o ropero.'
      });
    }

    return kit;
  }

  /**
   * Genera los pasos secuenciales de armado ilustrado.
   */
  private generateAssemblySteps(params: {
    moduleId: string;
    moduleName: string;
    width: number;
    height: number;
    depth: number;
    screwsPerJoint: number;
    pieces: AssemblyGuidePiece[];
    drawersCount: number;
    doorsCount: number;
    shelvesCount: number;
    dividersCount: number;
    hasBack: boolean;
    backParts: AssemblyGuidePiece[];
    hardwareKit: AssemblyHardwareItem[];
    minY: number;
    maxY: number;
    minZ: number;
    paramConfig?: import('../models/melamine.models').ParametricCabinetConfig;
  }): AssemblyStep[] {
    const {
      screwsPerJoint,
      pieces,
      drawersCount,
      doorsCount,
      shelvesCount,
      dividersCount,
      hasBack,
      hardwareKit,
      minY,
      paramConfig
    } = params;

    const steps: AssemblyStep[] = [];
    let stepNum = 1;

    // =========================================================================
    // PASO 1: Estructura Base y Costados (Casco / Carcasa)
    // =========================================================================
    const carcassPieces = pieces.filter(p =>
      p.componentRole === 'side_left' ||
      p.componentRole === 'side_right' ||
      p.componentRole === 'bottom' ||
      p.componentRole === 'top' ||
      p.componentRole === 'tie' ||
      p.componentRole === 'plinth'
    );

    const step1Pieces = carcassPieces.length > 0
      ? carcassPieces
      : pieces.slice(0, Math.min(4, pieces.length));

    const structuralScrewHardware = hardwareKit.find(h => h.id === 'screw_structural_50');

    steps.push({
      stepNumber: stepNum++,
      titleKey: 'assemblyGuide.step1Title',
      defaultTitle: 'Paso 1 — Estructura Base y Costados (Casco)',
      descriptionKey: 'assemblyGuide.step1Desc',
      defaultDescription:
        'Coloque los laterales sobre una superficie limpia y plana. Una el piso inferior y los amarres superiores o techo a los laterales izquierdo y derecho. Asegúrese de que los bordes que cuentan con tapacanto queden alineados hacia la fachada frontal del mueble.',
      tips: [
        `Coloque ${screwsPerJoint} tornillos de 4.0 × 50 mm por cada unión estructural a 50 mm de los extremos.`,
        'Verifique que los bordes con tapacanto (L1/A1) queden mirando hacia el frente visto.',
        'Si el módulo incluye zócalo inferior, ensámblelo antes de elevar el mueble.'
      ],
      actionType: 'carcass',
      partCodes: step1Pieces.map(p => p.code),
      parts: step1Pieces,
      hardware: structuralScrewHardware ? [{ ...structuralScrewHardware, quantity: Math.min(structuralScrewHardware.quantity, 12) }] : []
    });

    // =========================================================================
    // PASO 2: Escuadrado y Fijación del Fondo Trasero (Solo si tiene fondo)
    // =========================================================================
    if (hasBack) {
      const backPieces = pieces.filter(p => p.componentRole === 'back' || (p.thickness <= 3 && p.length * p.width > 80000));
      const nailHardware = hardwareKit.find(h => h.id === 'nail_back_panel');

      steps.push({
        stepNumber: stepNum++,
        titleKey: 'assemblyGuide.step2Title',
        defaultTitle: 'Paso 2 — Escuadrado y Fijación del Fondo Trasero',
        descriptionKey: 'assemblyGuide.step2Desc',
        defaultDescription:
          'Recueste el casco boca abajo sobre el suelo. Mida con el flexómetro ambas diagonales cruzadas (D1 y D2); ambas deben medir exactamente lo mismo (tolerancia 0 mm) para garantizar que el mueble esté a 90°. Presente el tablero trasero de 3 mm y fíjelo con puntillas o tornillos cada 150 mm alrededor de todo el perímetro.',
        tips: [
          'La verificación de diagonales cruzadas (D1 = D2) es indispensable para que los cajones y puertas cierren perfectamente sin rozar.',
          'Clave primero las 4 esquinas del fondo para bloquear la escuadra y luego complete el clavado perimetral cada 150 mm.'
        ],
        actionType: 'back',
        partCodes: backPieces.map(p => p.code),
        parts: backPieces,
        hardware: nailHardware ? [nailHardware] : []
      });
    }

    // =========================================================================
    // PASO 3: Instalación de Divisiones y Repisas Internas (Si aplica)
    // =========================================================================
    if (shelvesCount > 0 || dividersCount > 0) {
      const shelfPieces = pieces.filter(p => p.componentRole === 'shelf' || p.componentRole === 'divider');
      const pinHardware = hardwareKit.find(h => h.id === 'shelf_pins');

      // Calcular cotas exactas en mm desde el piso interior y laterales
      const measurements: AssemblyStepMeasurement[] = [];
      const bottomPart = pieces.find(p => p.componentRole === 'bottom');
      const bottomThickness = bottomPart ? bottomPart.thickness : 18;
      const baseInteriorY = minY + bottomThickness;
      const leftSidePart = pieces.find(p => p.componentRole === 'side_left');
      const leftInnerX = leftSidePart ? this.joineryEngine.getPartBounds(leftSidePart.part).maxX : 0;

      let shelfIndex = 1;
      let dividerIndex = 1;
      for (const piece of shelfPieces) {
        if (piece.componentRole === 'shelf') {
          const b = this.joineryEngine.getPartBounds(piece.part);
          let heightFromBaseMm = Math.round(b.minY - baseInteriorY);
          if (paramConfig?.shelfManualOffsets && paramConfig.shelfManualOffsets[shelfIndex - 1]) {
            heightFromBaseMm = Math.round(paramConfig.shelfManualOffsets[shelfIndex - 1]);
          }
          if (heightFromBaseMm <= 0) {
            heightFromBaseMm = 250 * shelfIndex;
          }
          measurements.push({
            label: `${piece.code} (${piece.translatedName || piece.name}) — Altura Repisa`,
            valueMm: Math.max(50, heightFromBaseMm),
            referenceText: 'Altura libre desde el piso interior del mueble'
          });
          shelfIndex++;
        } else if (piece.componentRole === 'divider') {
          const b = this.joineryEngine.getPartBounds(piece.part);
          let distFromLeftMm = Math.round(b.minX - leftInnerX);
          if (distFromLeftMm <= 0) {
            distFromLeftMm = Math.round(params.width / (dividersCount + 1)) * dividerIndex;
          }
          measurements.push({
            label: `${piece.code} (${piece.translatedName || piece.name}) — Posición Divisor`,
            valueMm: Math.max(50, distFromLeftMm),
            referenceText: 'Distancia libre desde el lateral izquierdo interior'
          });
          dividerIndex++;
        }
      }

      steps.push({
        stepNumber: stepNum++,
        titleKey: 'assemblyGuide.step3Title',
        defaultTitle: 'Paso 3 — Instalación de Divisiones y Repisas Internas',
        descriptionKey: 'assemblyGuide.step3Desc',
        defaultDescription:
          'Si el módulo posee divisores verticales, fíjelos primero a la base y techo mediante tornillos estructurales. Luego inserte los 4 soportes/pines cilíndricos a la misma altura en los orificios de ambos laterales y asiente con suavidad cada repisa interna.',
        tips: [
          'Verifique la horizontalidad de cada repisa con un nivel de mano antes de cargar peso.',
          'En repisas móviles, el borde frontal con tapacanto grueso o delgado siempre debe mirar hacia afuera.'
        ],
        actionType: 'shelves',
        partCodes: shelfPieces.map(p => p.code),
        parts: shelfPieces,
        hardware: pinHardware ? [pinHardware] : [],
        measurements: measurements.length > 0 ? measurements : undefined
      });
    }

    // =========================================================================
    // PASO 4: Fijación de Correderas y Armado de Cajones (Solo si tiene cajones)
    // =========================================================================
    if (drawersCount > 0) {
      const drawerPieces = pieces.filter(p =>
        p.componentRole === 'drawer_front' ||
        p.componentRole === 'drawer_box' ||
        p.componentRole === 'drawer_lateral' ||
        p.name.toLowerCase().includes('cajón') ||
        p.name.toLowerCase().includes('cajon')
      );

      const slideHardware = hardwareKit.find(h => h.id === 'telescopic_slides');
      const smallScrewHardware = hardwareKit.find(h => h.id === 'screw_hardware_15');

      // Calcular cotas exactas de riel telescópico desde la base inferior del lateral
      const measurements: AssemblyStepMeasurement[] = [];
      const sidePart = pieces.find(p => p.componentRole === 'side_left' || p.componentRole === 'side_right');
      const sideMinY = sidePart ? this.joineryEngine.getPartBounds(sidePart.part).minY : minY;

      const drawerFronts = pieces
        .filter(p => p.componentRole === 'drawer_front')
        .sort((a, b) => {
          const bA = this.joineryEngine.getPartBounds(a.part);
          const bB = this.joineryEngine.getPartBounds(b.part);
          return bA.minY - bB.minY;
        });

      for (let i = 0; i < drawersCount; i++) {
        let railHeightMm: number;
        let drawerLabel: string;

        if (drawerFronts[i]) {
          const df = drawerFronts[i];
          const b = this.joineryEngine.getPartBounds(df.part);
          railHeightMm = Math.max(40, Math.round((b.minY - sideMinY) + 40));
          drawerLabel = `${df.code} (${df.name || 'Cajón'})`;
        } else {
          const plinthH = paramConfig?.plinthHeight || 70;
          const innerH = Math.max(300, params.height - plinthH - 36);
          const slotH = innerH / drawersCount;
          railHeightMm = Math.max(40, Math.round(plinthH + 18 + 40 + (i * slotH)));
          drawerLabel = `Cajón ${i + 1} (${i === 0 ? 'Inferior' : (i === drawersCount - 1 ? 'Superior' : 'Medio')})`;
        }

        measurements.push({
          label: `${drawerLabel} — Eje Central Riel`,
          valueMm: railHeightMm,
          referenceText: 'Medido desde el canto inferior del lateral del mueble'
        });
      }

      steps.push({
        stepNumber: stepNum++,
        titleKey: 'assemblyGuide.step4Title',
        defaultTitle: 'Paso 4 — Fijación de Correderas y Armado de Cajones',
        descriptionKey: 'assemblyGuide.step4Desc',
        defaultDescription:
          'Separe las correderas telescópicas presionando la pestaña plástica interior. Atornille el tramo exterior al costado del mueble en las cotas de altura indicadas. Ensamble las cajas de cajón uniendo los costados al frente y trasera con tornillos de ensamble, encaje el fondo de 3 mm en la ranura y fije el tramo móvil del riel a la caja.',
        tips: [
          'Cada cajón está conformado por 5 piezas: 2 costados de cajón, 1 contrafrente interior, 1 trasera interior, 1 fondo de 3 mm y 1 frente exterior visto decorativo.',
          'Deje una holgura libre de 13 mm a cada lado entre la caja del cajón y el costado interior del módulo (26 mm de descuento total).',
          'Atornille los rieles telescópicos en los agujeros rasgados para permitir micro-ajustes de nivelación antes del apriete final.'
        ],
        actionType: 'drawers',
        partCodes: drawerPieces.map(p => p.code),
        parts: drawerPieces,
        hardware: [
          ...(slideHardware ? [slideHardware] : []),
          ...(smallScrewHardware ? [{ ...smallScrewHardware, quantity: drawersCount * 8 }] : [])
        ],
        measurements
      });
    }

    // =========================================================================
    // PASO 5: Montaje de Bisagras, Puertas y Manijas (Solo si tiene puertas)
    // =========================================================================
    if (doorsCount > 0) {
      const doorPieces = pieces.filter(p => p.componentRole === 'door');
      const hingeHardware = hardwareKit.find(h => h.id === 'cup_hinges');
      const handleHardware = hardwareKit.find(h => h.id === 'handles_knobs');
      const smallScrewHardware = hardwareKit.find(h => h.id === 'screw_hardware_15');

      steps.push({
        stepNumber: stepNum++,
        titleKey: 'assemblyGuide.step5Title',
        defaultTitle: 'Paso 5 — Montaje de Bisagras, Puertas y Manijas',
        descriptionKey: 'assemblyGuide.step5Desc',
        defaultDescription:
          'Inserte las cazoletas de 35 mm en las perforaciones de la puerta y asegúrelas con tornillos de 3.5 × 15 mm. Fije las bases de bisagra a los laterales del mueble y enganche los brazos. Utilice los 3 tornillos excéntricos de regulación para alinear la holgura perimetral (3 mm) en profundidad, altura y lateral. Finalmente, instale las manijas o tiradores.',
        tips: [
          'Tornillo 1 (Frontal): Regula la separación lateral entre puertas (luz central de 2 a 3 mm).',
          'Tornillo 2 (Profundidad): Acerca o aleja la puerta del casco para que cierre al ras sin golpear.',
          'Tornillo 3 (Placa base): Ajusta la altura vertical de la puerta para nivelarla con los bordes superior e inferior.'
        ],
        actionType: 'doors',
        partCodes: doorPieces.map(p => p.code),
        parts: doorPieces,
        hardware: [
          ...(hingeHardware ? [hingeHardware] : []),
          ...(smallScrewHardware ? [{ ...smallScrewHardware, quantity: (hingeHardware?.quantity || 2) * 4 }] : []),
          ...(handleHardware ? [handleHardware] : [])
        ]
      });
    }

    return steps;
  }
}
