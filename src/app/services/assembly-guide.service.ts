import { computed, inject, Injectable } from '@angular/core';
import {
  ComponentRole,
  Material,
  ParametricCabinetConfig,
  Part,
  PartEdges,
  PartGroup,
  Project,
  isStoneMaterial
} from '../models/melamine.models';
import { ProjectStorageService } from './project-storage.service';
import { JoineryEngineService } from './joinery-engine.service';
import { I18nService } from './i18n.service';

export interface AssemblyPieceWorldBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  spanX: number;
  spanY: number;
  spanZ: number;
  cx: number;
  cy: number;
  cz: number;
}

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
  resolvedRole: ComponentRole;
  worldBounds: AssemblyPieceWorldBounds;
  part: Part;
}

export type AssemblyHardwareType =
  | 'screw_structural'
  | 'nail_back'
  | 'shelf_pin'
  | 'drawer_slide'
  | 'screw_slide_hinge'
  | 'hinge'
  | 'gas_piston'
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
  cumulativePriorPartCodes: string[];
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
    const nonCountertopGroups = groups.filter(g => !g.isCountertop);
    const nonCountertopGroupIds = new Set(nonCountertopGroups.map(g => g.id));

    // Resolver grupo anfitrión si un subgrupo (ej. cajón modular) vive dentro de un mueble padre
    const resolveHostGroupId = (g: PartGroup): string => {
      if (
        (g.type === 'drawer' || g.type === 'door_set') &&
        g.hostGroupId &&
        g.hostGroupId !== 'floor' &&
        g.hostGroupId !== g.id &&
        nonCountertopGroupIds.has(g.hostGroupId)
      ) {
        return g.hostGroupId;
      }
      return g.id;
    };

    const groupedPartsMap = new Map<string, { group: PartGroup; parts: Part[] }>();
    for (const g of nonCountertopGroups) {
      const targetId = resolveHostGroupId(g);
      if (targetId === g.id && !groupedPartsMap.has(g.id)) {
        groupedPartsMap.set(g.id, { group: g, parts: [] });
      }
    }

    const processedPartIds = new Set<string>();

    for (const part of armableParts) {
      const matchedGroup = nonCountertopGroups.find(
        g =>
          part.groupId === g.id ||
          part.moduleId === g.id ||
          (g.partIds?.includes(part.id) ?? false)
      );
      if (matchedGroup) {
        const hostId = resolveHostGroupId(matchedGroup);
        const bucket = groupedPartsMap.get(hostId);
        if (bucket) {
          bucket.parts.push(part);
          processedPartIds.add(part.id);
        }
      }
    }

    const guides: ModuleAssemblyGuide[] = [];
    for (const { group, parts } of groupedPartsMap.values()) {
      if (parts.length > 0) {
        const guide = this.buildModuleGuide(group.id, group.name, parts, group);
        if (guide) {
          guides.push(guide);
        }
      }
    }

    // Piezas sueltas (armadas manualmente pieza a pieza) o cuyo grupo no está en project.groups
    const orphanParts = armableParts.filter(p => !processedPartIds.has(p.id));
    if (orphanParts.length > 0) {
      const modulesMap = new Map<string, { name: string; parts: Part[] }>();
      const manualAssemblyKey = 'manual_custom_assembly';
      const hasExistingGuides = guides.length > 0;

      for (const part of orphanParts) {
        let key: string;
        let name: string;

        if (part.moduleId) {
          key = `module:${part.moduleId}`;
          name = part.moduleName || part.groupName || 'Mueble Armado Manual';
        } else if (part.groupId) {
          key = `group:${part.groupId}`;
          name = part.groupName || part.moduleName || 'Mueble Armado Manual';
        } else {
          key = manualAssemblyKey;
          name = hasExistingGuides
            ? 'Mueble Armado Manual'
            : (project.name?.trim() || 'Mueble Personalizado');
        }

        let bucket = modulesMap.get(key);
        if (!bucket) {
          bucket = { name, parts: [] };
          modulesMap.set(key, bucket);
        }
        bucket.parts.push(part);
      }

      const manualBucket = modulesMap.get(manualAssemblyKey);
      if (manualBucket && modulesMap.size > 1 && !hasExistingGuides) {
        manualBucket.name = 'Mueble Armado Manual';
      }

      for (const [key, mod] of modulesMap.entries()) {
        mod.parts.forEach(p => processedPartIds.add(p.id));
        const resolvedId = key.startsWith('module:')
          ? key.slice('module:'.length)
          : key.startsWith('group:')
            ? key.slice('group:'.length)
            : key;
        const guide = this.buildModuleGuide(resolvedId, mod.name, mod.parts, null);
        if (guide) {
          guides.push(guide);
        }
      }
    }

    return guides;
  }

  /**
   * Convierte la caja envolvente 3D de una pieza en límites espaciales redondeados y centroide.
   */
  private toWorldBounds(part: Part): AssemblyPieceWorldBounds {
    const b = this.joineryEngine.getPartBounds(part);
    const minX = Math.round(b.minX * 100) / 100;
    const maxX = Math.round(b.maxX * 100) / 100;
    const minY = Math.round(b.minY * 100) / 100;
    const maxY = Math.round(b.maxY * 100) / 100;
    const minZ = Math.round(b.minZ * 100) / 100;
    const maxZ = Math.round(b.maxZ * 100) / 100;
    const spanX = Math.round((b.maxX - b.minX) * 100) / 100;
    const spanY = Math.round((b.maxY - b.minY) * 100) / 100;
    const spanZ = Math.round((b.maxZ - b.minZ) * 100) / 100;
    const cx = Math.round(((b.minX + b.maxX) / 2) * 100) / 100;
    const cy = Math.round(((b.minY + b.maxY) / 2) * 100) / 100;
    const cz = Math.round(((b.minZ + b.maxZ) / 2) * 100) / 100;
    return { minX, maxX, minY, maxY, minZ, maxZ, spanX, spanY, spanZ, cx, cy, cz };
  }

  /**
   * Clasifica determinísticamente el rol estructural o funcional de una pieza a partir de
   * su rol explícito (si es concreto) o de sus límites reales en 3D dentro del mueble.
   */
  resolveEffectiveRole(
    part: Part,
    b: AssemblyPieceWorldBounds,
    modMinX: number,
    modMaxX: number,
    modMinY: number,
    modMaxY: number,
    modMinZ: number,
    modMaxZ: number
  ): ComponentRole {
    if (part.componentRole && part.componentRole !== 'free') {
      return part.componentRole;
    }

    const nameUpper = (part.name || '').toUpperCase();
    // Tubos colgadores circulares se conservan como 'free' para no confundirlos con repisas
    if (part.shapeType === 'circle' && b.spanY <= 50 && b.spanZ <= 50) {
      return 'free';
    }

    // Piezas sin rol explícito inclinadas en ángulo oblicuo (no ortogonal a 90°) se conservan como 'free'
    const isOrthogonalAngle = (deg?: number): boolean => {
      const rem = Math.abs(deg || 0) % 90;
      return rem < 1 || rem > 89;
    };
    if (
      !isOrthogonalAngle(part.rotationX) ||
      !isOrthogonalAngle(part.rotationY) ||
      !isOrthogonalAngle(part.rotationZ)
    ) {
      return 'free';
    }

    const modWidth = Math.max(1, modMaxX - modMinX);
    const modHeight = Math.max(1, modMaxY - modMinY);
    const modDepth = Math.max(1, modMaxZ - modMinZ);

    // 1. Fondo trasero delgado en Z cerca de modMinZ
    if (
      b.spanZ <= 6 &&
      b.spanX * b.spanY > 50000 &&
      b.minZ <= modMinZ + Math.max(30, modDepth * 0.22) &&
      b.cz <= modMinZ + modDepth * 0.5
    ) {
      return 'back';
    }

    // 2. Panel frontal delgado vertical cerca de modMaxZ
    if (b.spanZ <= 26 && b.cz > modMinZ + modDepth * 0.72) {
      if (nameUpper.includes('CAJ')) {
        return 'drawer_front';
      }
      if (nameUpper.includes('ZOCALO') || nameUpper.includes('ZÓCALO')) {
        return 'plinth';
      }
      if (
        nameUpper.includes('MOLDUR') ||
        nameUpper.includes('LISTON') ||
        nameUpper.includes('LISTÓN') ||
        nameUpper.includes('CORNIS') ||
        nameUpper.includes('CENEFA') ||
        nameUpper.includes('APLIQUE')
      ) {
        return 'free';
      }
      return 'door';
    }

    // 3. Paneles verticales delgados en X (laterales izquierdo/derecho o divisores internos)
    if (b.spanX <= 26 && b.spanY > b.spanX * 2) {
      const sideTol = Math.max(30, modWidth * 0.08);
      if (b.minX <= modMinX + sideTol && b.cx < modMinX + modWidth * 0.35) {
        return 'side_left';
      }
      if (b.maxX >= modMaxX - sideTol && b.cx > modMaxX - modWidth * 0.35) {
        return 'side_right';
      }
      return 'divider';
    }

    // 4. Paneles horizontales delgados en Y (piso, techo, amarres o repisas)
    if (b.spanY <= 26) {
      const bottomTol = Math.max(30, modHeight * 0.14);
      const topTol = Math.max(30, modHeight * 0.08);
      if (b.minY <= modMinY + bottomTol && b.cy < modMinY + modHeight * 0.35) {
        return 'bottom';
      }
      if (b.maxY >= modMaxY - topTol && b.cy > modMinY + modHeight * 0.65) {
        if ((nameUpper.includes('AMARRE') || nameUpper.includes('TIRANTE')) && b.spanZ < modDepth * 0.35) {
          return 'tie';
        }
        return 'top';
      }
      return 'shelf';
    }

    return 'free';
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

    // 1. Dimensiones exteriores totales y Bounding Box 3D real por pieza
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    const boundsByPart = new Map<Part, AssemblyPieceWorldBounds>();
    for (const p of parts) {
      const wb = this.toWorldBounds(p);
      boundsByPart.set(p, wb);
      if (wb.minX < minX) minX = wb.minX;
      if (wb.maxX > maxX) maxX = wb.maxX;
      if (wb.minY < minY) minY = wb.minY;
      if (wb.maxY > maxY) maxY = wb.maxY;
      if (wb.minZ < minZ) minZ = wb.minZ;
      if (wb.maxZ > maxZ) maxZ = wb.maxZ;
    }

    const calculatedWidth = Math.max(100, Math.round(maxX - minX));
    const calculatedHeight = Math.max(100, Math.round(maxY - minY));
    const calculatedDepth = Math.max(100, Math.round(maxZ - minZ));

    const paramConfig = group?.parametricConfig;
    const width = paramConfig?.width ? Math.round(paramConfig.width) : calculatedWidth;
    const height = paramConfig?.height ? Math.round(paramConfig.height) : calculatedHeight;
    const depth = paramConfig?.depth ? Math.round(paramConfig.depth) : calculatedDepth;

    const roleByPart = new Map<Part, ComponentRole>();
    for (const p of parts) {
      const wb = boundsByPart.get(p) ?? this.toWorldBounds(p);
      roleByPart.set(p, this.resolveEffectiveRole(p, wb, minX, maxX, minY, maxY, minZ, maxZ));
    }
    const resolveRole = (p: Part): ComponentRole => roleByPart.get(p) ?? (p.componentRole || 'free');

    // 2. Indexación ordenada de piezas P1, P2, P3...
    const sortedParts = this.sortPartsForAssembly(parts, resolveRole, boundsByPart, (minZ + maxZ) / 2);
    const pieces: AssemblyGuidePiece[] = sortedParts.map((p, idx) => {
      const worldBounds = boundsByPart.get(p) ?? this.toWorldBounds(p);
      const resolvedRole = resolveRole(p);
      return {
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
        resolvedRole,
        worldBounds,
        part: p
      };
    });

    const totalPartsCount = pieces.reduce((sum, p) => sum + p.quantity, 0);

    // 3. Detección de elementos funcionales (cajones, puertas, repisas, divisores, fondos)
    const drawersCount = this.detectDrawersCount(pieces, group);
    const doorParts = pieces.filter(p => p.resolvedRole === 'door');
    const doorsCount = doorParts.reduce((sum, p) => sum + p.quantity, 0);
    const shelfParts = pieces.filter(p => p.resolvedRole === 'shelf');
    const shelvesCount = shelfParts.reduce((sum, p) => sum + p.quantity, 0);
    const dividerParts = pieces.filter(p => p.resolvedRole === 'divider');
    const dividersCount = dividerParts.reduce((sum, p) => sum + p.quantity, 0);
    const backParts = pieces.filter(p => {
      if (p.resolvedRole === 'back') return true;
      const nameLower = (p.name || '').toLowerCase();
      const isDrawerBottom = p.resolvedRole === 'drawer_bottom' || nameLower.includes('caj');
      return !isDrawerBottom && p.thickness <= 3 && p.worldBounds.spanX * p.worldBounds.spanY > 80000;
    });
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
      minX,
      minY,
      maxY,
      minZ,
      maxZ,
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
   * 3. Divisiones, repisas e insertos interiores
   * 4. Componentes de cajones
   * 5. Puertas, frentes y complementos exteriores
   */
  private sortPartsForAssembly(
    parts: Part[],
    resolveRole?: (part: Part) => ComponentRole,
    boundsMap?: Map<Part, AssemblyPieceWorldBounds>,
    moduleCenterZ?: number
  ): Part[] {
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
      drawer_bottom: 42,
      drawer_front: 43,
      door: 50,
      front: 51,
      free: 60
    };

    const localBounds = new Map<Part, AssemblyPieceWorldBounds>();
    const getBounds = (p: Part): AssemblyPieceWorldBounds => {
      const existing = boundsMap?.get(p) ?? localBounds.get(p);
      if (existing) return existing;
      const computedBounds = this.toWorldBounds(p);
      localBounds.set(p, computedBounds);
      return computedBounds;
    };

    const getPriority = (p: Part, wb: AssemblyPieceWorldBounds): number => {
      const role = resolveRole ? resolveRole(p) : (p.componentRole || 'free');
      if (role === 'free' && moduleCenterZ !== undefined) {
        return wb.cz <= moduleCenterZ + 0.5 ? 35 : 55;
      }
      return rolePriority[role] ?? 55;
    };

    return [...parts].sort((a, b) => {
      const bA = getBounds(a);
      const bB = getBounds(b);
      const pA = getPriority(a, bA);
      const pB = getPriority(b, bB);
      if (pA !== pB) return pA - pB;

      const minYDiff = bA.minY - bB.minY;
      if (Math.abs(minYDiff) > 0.5) return minYDiff;

      const minZDiff = bA.minZ - bB.minZ;
      if (Math.abs(minZDiff) > 0.5) return minZDiff;

      const areaDiff = (b.length * b.width) - (a.length * a.width);
      if (Math.abs(areaDiff) > 1) return areaDiff;

      return (a.name || '').localeCompare(b.name || '') || a.id.localeCompare(b.id);
    });
  }

  /**
   * Detecta la cantidad real de cajones en el módulo.
   */
  private detectDrawersCount(pieces: AssemblyGuidePiece[], group: PartGroup | null): number {
    if (group?.parametricConfig?.drawersCount && group.parametricConfig.drawersCount > 0) {
      return group.parametricConfig.drawersCount;
    }
    const drawerFronts = pieces.filter(p => p.resolvedRole === 'drawer_front');
    if (drawerFronts.length > 0) {
      return drawerFronts.reduce((sum, p) => sum + p.quantity, 0);
    }
    const drawerGroups = new Set(
      pieces
        .filter(
          p =>
            p.resolvedRole.startsWith('drawer_') ||
            p.part.groupName?.toLowerCase().includes('cajón') ||
            p.part.groupName?.toLowerCase().includes('cajon')
        )
        .map(p => p.part.groupId || p.part.groupName)
        .filter((v): v is string => Boolean(v))
    );
    if (drawerGroups.size > 0) {
      return drawerGroups.size;
    }
    const hasLooseDrawerParts = pieces.some(
      p =>
        p.resolvedRole.startsWith('drawer_') ||
        p.name.toLowerCase().includes('cajón') ||
        p.name.toLowerCase().includes('cajon')
    );
    return hasLooseDrawerParts ? 1 : 0;
  }

  /**
   * Calcula el kit completo y exacto de tornillería y herrajes según las especificaciones técnicas.
   */
  private calculateHardwareKit(params: {
    width: number;
    height: number;
    screwsPerJoint: number;
    drawersCount: number;
    doorsCount: number;
    doorParts: AssemblyGuidePiece[];
    shelvesCount: number;
    dividersCount: number;
    hasBack: boolean;
    backParts: AssemblyGuidePiece[];
    pieces: AssemblyGuidePiece[];
    paramConfig?: ParametricCabinetConfig;
  }): AssemblyHardwareItem[] {
    const {
      width,
      height,
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
    const hasTop = pieces.some(p => p.resolvedRole === 'top');
    const tieCount = pieces.filter(p => p.resolvedRole === 'tie').reduce((s, p) => s + p.quantity, 0);
    const plinthCount = pieces.filter(p => p.resolvedRole === 'plinth').reduce((s, p) => s + p.quantity, 0);

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
        backPerimeterMm = 2 * (bp.worldBounds.spanX + bp.worldBounds.spanY);
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
      slideScrews = drawersCount * 8;
    }

    // 5. Bisagras cazoleta 35 mm + Pistones Hidráulicos a Gas para Abatible Superior
    const isGasPistonDoor = (dp: AssemblyGuidePiece): boolean => {
      const upperName = (dp.name || '').toUpperCase();
      return (
        dp.part.hardwareConfig?.hingeType === 'gas_piston' ||
        dp.part.hardwareConfig?.openingDirection === 'top' ||
        upperName.includes('ABATIBLE SUPERIOR') ||
        upperName.includes('ELEVABLE')
      );
    };

    const gasDoorQty = doorParts
      .filter(isGasPistonDoor)
      .reduce((sum, dp) => sum + dp.quantity, 0);

    let totalHinges = 0;
    if (doorsCount > 0) {
      for (const dp of doorParts) {
        if (dp.part.hardwareConfig?.hingeType === 'none') {
          continue;
        }
        const openingDir = dp.part.hardwareConfig?.openingDirection;
        const upperName = (dp.name || '').toUpperCase();
        const isHorizontalHinge =
          openingDir === 'top' ||
          openingDir === 'bottom' ||
          isGasPistonDoor(dp) ||
          upperName.includes('ABATIBLE INFERIOR');
        const doorEdge = isHorizontalHinge
          ? Math.max(dp.worldBounds.spanX, dp.worldBounds.spanZ)
          : dp.worldBounds.spanY;
        const hingesPerDoor = doorEdge >= 1600 ? 4 : (doorEdge > 900 ? 3 : 2);
        totalHinges += hingesPerDoor * dp.quantity;
      }

      if (totalHinges > 0) {
        kit.push({
          id: 'cup_hinges',
          name: 'assemblyGuide.hardwareHinges',
          codeName: 'Bisagras Cazoleta 35 mm',
          spec: 'Cazoleta Ø 35 mm con base regulable en 3 ejes',
          quantity: totalHinges,
          type: 'hinge',
          iconName: 'unfold',
          description: '2 a 4 bisagras por puerta según la longitud del borde abisagrado.'
        });
      }

      if (gasDoorQty > 0) {
        kit.push({
          id: 'piston_gas_pair',
          name: 'Pistones Hidráulicos a Gas',
          codeName: 'Pistones Hidráulicos a Gas',
          spec: 'Brazo neumático 80N / 100N con herrajes internos',
          quantity: 2 * gasDoorQty,
          type: 'gas_piston',
          iconName: 'unfold',
          description: '2 pistones neumáticos a gas por cada puerta abatible superior.'
        });
      }
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
    const physicalHandleDoors = doorParts
      .filter(dp => {
        const hc = dp.part.hardwareConfig;
        if (hc?.handlePosition === 'none') return false;
        if (hc?.handleType) {
          return (
            hc.handleType !== 'none' &&
            hc.handleType !== 'push' &&
            hc.handleType !== 'push_open' &&
            hc.handleType !== 'gola_less'
          );
        }
        if (paramConfig?.hasHandle === false) return false;
        if (
          paramConfig?.handleType === 'none' ||
          paramConfig?.handleType === 'push_open' ||
          paramConfig?.handleType === 'push' ||
          paramConfig?.handleType === 'gola_less'
        ) {
          return false;
        }
        return true;
      })
      .reduce((sum, dp) => sum + dp.quantity, 0);

    const totalHandles = physicalHandleDoors + drawersCount;
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
   * Genera los pasos secuenciales de armado ilustrado asegurando cobertura total y disjunta
   * de todas las piezas (P1..Pn) y seguimiento acumulativo previo.
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
    minX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
    paramConfig?: ParametricCabinetConfig;
  }): AssemblyStep[] {
    const {
      screwsPerJoint,
      pieces,
      drawersCount,
      doorsCount,
      dividersCount,
      hardwareKit,
      minX,
      minY,
      minZ,
      maxZ,
      paramConfig
    } = params;

    const steps: AssemblyStep[] = [];
    let stepNum = 1;
    const centerZ = (minZ + maxZ) / 2;

    const assignedCodes = new Set<string>();
    const markAssigned = (list: AssemblyGuidePiece[]): AssemblyGuidePiece[] => {
      const unique: AssemblyGuidePiece[] = [];
      for (const item of list) {
        if (!assignedCodes.has(item.code)) {
          assignedCodes.add(item.code);
          unique.push(item);
        }
      }
      return unique;
    };

    // =========================================================================
    // PASO 1: Estructura Base y Costados (Casco / Carcasa)
    // =========================================================================
    const carcassRoles = new Set<ComponentRole>([
      'side_left',
      'side_right',
      'bottom',
      'top',
      'tie',
      'plinth'
    ]);
    const rawCarcass = pieces.filter(p => carcassRoles.has(p.resolvedRole));
    const hasAnyTypedNonCarcass = pieces.some(p => {
      const r = p.resolvedRole;
      return (
        r === 'back' ||
        r === 'shelf' ||
        r === 'divider' ||
        r === 'door' ||
        r === 'front' ||
        r.startsWith('drawer_')
      );
    });

    const step1Pieces = markAssigned(
      rawCarcass.length > 0
        ? rawCarcass
        : (!hasAnyTypedNonCarcass ? pieces : [])
    );

    if (step1Pieces.length > 0) {
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
        cumulativePriorPartCodes: [],
        parts: step1Pieces,
        hardware: structuralScrewHardware ? [{ ...structuralScrewHardware, quantity: Math.min(structuralScrewHardware.quantity, 12) }] : []
      });
    }

    // =========================================================================
    // PASO 2: Escuadrado y Fijación del Fondo Trasero (Solo si tiene fondo)
    // =========================================================================
    const backPieces = markAssigned(
      pieces.filter(p => {
        if (assignedCodes.has(p.code)) return false;
        if (p.resolvedRole === 'back') return true;
        const nameLower = (p.name || '').toLowerCase();
        const isDrawerBottom = p.resolvedRole === 'drawer_bottom' || nameLower.includes('caj');
        return !isDrawerBottom && p.thickness <= 3 && p.worldBounds.spanX * p.worldBounds.spanY > 80000;
      })
    );

    if (backPieces.length > 0) {
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
        cumulativePriorPartCodes: [],
        parts: backPieces,
        hardware: nailHardware ? [nailHardware] : []
      });
    }

    // =========================================================================
    // PASO 3: Instalación de Divisiones, Repisas e Insertos Interiores
    // =========================================================================
    const step3Pieces = markAssigned(
      pieces.filter(p => {
        if (assignedCodes.has(p.code)) return false;
        if (p.resolvedRole === 'shelf' || p.resolvedRole === 'divider') return true;
        return p.resolvedRole === 'free' && p.worldBounds.cz <= centerZ + 0.5;
      })
    );

    if (step3Pieces.length > 0) {
      const pinHardware = hardwareKit.find(h => h.id === 'shelf_pins');
      const hasShelves = step3Pieces.some(p => p.resolvedRole === 'shelf');

      // Calcular cotas exactas en mm desde el piso interior y laterales
      const measurements: AssemblyStepMeasurement[] = [];
      const bottomPart = pieces.find(p => p.resolvedRole === 'bottom');
      const baseInteriorY = bottomPart ? bottomPart.worldBounds.maxY : minY + 18;
      const leftSidePart = pieces.find(p => p.resolvedRole === 'side_left');
      const leftInnerX = leftSidePart ? leftSidePart.worldBounds.maxX : minX;

      let shelfIndex = 1;
      let dividerIndex = 1;
      for (const piece of step3Pieces) {
        if (piece.resolvedRole === 'shelf') {
          let heightFromBaseMm = Math.round(piece.worldBounds.minY - baseInteriorY);
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
        } else if (piece.resolvedRole === 'divider') {
          let distFromLeftMm = Math.round(piece.worldBounds.minX - leftInnerX);
          if (distFromLeftMm <= 0) {
            distFromLeftMm = Math.round(params.width / (Math.max(1, dividersCount) + 1)) * dividerIndex;
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
        partCodes: step3Pieces.map(p => p.code),
        cumulativePriorPartCodes: [],
        parts: step3Pieces,
        hardware: hasShelves && pinHardware ? [pinHardware] : [],
        measurements: measurements.length > 0 ? measurements : undefined
      });
    }

    // =========================================================================
    // PASO 4: Fijación de Correderas y Armado de Cajones (Solo si tiene cajones)
    // =========================================================================
    const drawerPieces = markAssigned(
      pieces.filter(p => {
        if (assignedCodes.has(p.code)) return false;
        if (
          p.resolvedRole === 'drawer_front' ||
          p.resolvedRole === 'drawer_box' ||
          p.resolvedRole === 'drawer_lateral' ||
          p.resolvedRole === 'drawer_bottom'
        ) {
          return true;
        }
        const nameLower = (p.name || '').toLowerCase();
        return nameLower.includes('cajón') || nameLower.includes('cajon');
      })
    );

    if (drawersCount > 0 || drawerPieces.length > 0) {
      const effectiveDrawersCount = Math.max(1, drawersCount);
      const slideHardware = hardwareKit.find(h => h.id === 'telescopic_slides');
      const smallScrewHardware = hardwareKit.find(h => h.id === 'screw_hardware_15');

      // Calcular cotas exactas de riel telescópico desde la base inferior del lateral
      const measurements: AssemblyStepMeasurement[] = [];
      const sidePart = pieces.find(p => p.resolvedRole === 'side_left' || p.resolvedRole === 'side_right');
      const sideMinY = sidePart ? sidePart.worldBounds.minY : minY;

      const drawerFronts = drawerPieces
        .filter(p => p.resolvedRole === 'drawer_front')
        .sort((a, b) => a.worldBounds.minY - b.worldBounds.minY);

      for (let i = 0; i < effectiveDrawersCount; i++) {
        let railHeightMm: number;
        let drawerLabel: string;

        if (drawerFronts[i]) {
          const df = drawerFronts[i];
          railHeightMm = Math.max(40, Math.round((df.worldBounds.minY - sideMinY) + 40));
          drawerLabel = `${df.code} (${df.name || 'Cajón'})`;
        } else {
          const plinthH = paramConfig?.plinthHeight || 70;
          const innerH = Math.max(300, params.height - plinthH - 36);
          const slotH = innerH / effectiveDrawersCount;
          railHeightMm = Math.max(40, Math.round(plinthH + 18 + 40 + (i * slotH)));
          drawerLabel = `Cajón ${i + 1} (${i === 0 ? 'Inferior' : (i === effectiveDrawersCount - 1 ? 'Superior' : 'Medio')})`;
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
        cumulativePriorPartCodes: [],
        parts: drawerPieces,
        hardware: [
          ...(slideHardware ? [slideHardware] : []),
          ...(smallScrewHardware ? [{ ...smallScrewHardware, quantity: effectiveDrawersCount * 8 }] : [])
        ],
        measurements
      });
    }

    // =========================================================================
    // PASO 5: Montaje de Bisagras, Pistones, Puertas, Frentes y Piezas Exteriores
    // =========================================================================
    const step5Pieces = markAssigned(pieces.filter(p => !assignedCodes.has(p.code)));

    if (doorsCount > 0 || step5Pieces.length > 0) {
      const hingeHardware = hardwareKit.find(h => h.id === 'cup_hinges');
      const pistonHardware = hardwareKit.find(h => h.id === 'piston_gas_pair');
      const handleHardware = hardwareKit.find(h => h.id === 'handles_knobs');
      const smallScrewHardware = hardwareKit.find(h => h.id === 'screw_hardware_15');

      const step5Tips = [
        'Tornillo 1 (Frontal): Regula la separación lateral entre puertas (luz central de 2 a 3 mm).',
        'Tornillo 2 (Profundidad): Acerca o aleja la puerta del casco para que cierre al ras sin golpear.',
        'Tornillo 3 (Placa base): Ajusta la altura vertical de la puerta para nivelarla con los bordes superior e inferior.'
      ];
      if (pistonHardware) {
        step5Tips.push(
          'Pistones a Gas: Instale las bases internas en ambos costados (15 mm hacia adentro, 120 mm bajo el techo) y enganche el brazo neumático en la cara interior de la puerta a 130 mm del borde superior para apertura asistida de 80°.'
        );
      }

      steps.push({
        stepNumber: stepNum++,
        titleKey: 'assemblyGuide.step5Title',
        defaultTitle: 'Paso 5 — Montaje de Bisagras, Puertas y Manijas',
        descriptionKey: 'assemblyGuide.step5Desc',
        defaultDescription:
          'Inserte las cazoletas de 35 mm en las perforaciones de la puerta y asegúrelas con tornillos de 3.5 × 15 mm. Fije las bases de bisagra a los laterales del mueble y enganche los brazos. Utilice los 3 tornillos excéntricos de regulación para alinear la holgura perimetral (3 mm) en profundidad, altura y lateral. Finalmente, instale las manijas o tiradores.',
        tips: step5Tips,
        actionType: 'doors',
        partCodes: step5Pieces.map(p => p.code),
        cumulativePriorPartCodes: [],
        parts: step5Pieces,
        hardware: [
          ...(hingeHardware ? [hingeHardware] : []),
          ...(pistonHardware ? [pistonHardware] : []),
          ...(smallScrewHardware && hingeHardware ? [{ ...smallScrewHardware, quantity: hingeHardware.quantity * 4 }] : []),
          ...(handleHardware ? [handleHardware] : [])
        ]
      });
    }

    // Asignar códigos acumulados estrictamente previos (pasos 1 .. stepNumber - 1)
    const cumulativePrior: string[] = [];
    for (const step of steps) {
      step.cumulativePriorPartCodes = [...cumulativePrior];
      cumulativePrior.push(...step.partCodes);
    }

    return steps;
  }
}
