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
  drawerClusterId?: string;
  drawerUnitIndex?: number;
}

export interface AssemblyPieceGroupSummary {
  key: string;
  label: string;
  role: ComponentRole;
  dimensionsText: string;
  quantity: number;
  codes: string[];
  representativeCode: string;
}

export interface AssemblyDrawerSubassembly {
  id: string;
  label: string;
  repeatCount: number;
  dimensions: { width: number; height: number; depth: number };
  boxHeight: number;
  drawerUnitLabels: string[];
  representativeParts: AssemblyGuidePiece[];
  representativeFront?: AssemblyGuidePiece;
  allBoxPartCodes: string[];
  allFrontPartCodes: string[];
  allPartCodes: string[];
  railElevationsMm: number[];
  pieceGroupsSummary: AssemblyPieceGroupSummary[];
}

export interface AssemblyExplodedGroupCallout {
  id: string;
  label: string;
  sublabel: string;
  codes: string[];
  primaryCode: string;
  role: ComponentRole;
  kind: 'part' | 'drawer_unit' | 'group';
  drawerUnitIndex?: number;
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
  | 'closet_rod'
  | 'wall_anchor'
  | 'gola_profile'
  | 'push_opener'
  | 'cabinet_leg'
  | 'sliding_kit'
  | 'compas_abatible'
  | 'vitrina_hardware'
  | 'shoe_stop';

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
  actionType: 'carcass' | 'back' | 'shelves' | 'drawer_subassembly' | 'drawers' | 'doors' | 'accessories';
  renderMode?: 'full_progress' | 'subassembly_zoom' | 'carcass_mount';
  partCodes: string[];
  cumulativePriorPartCodes: string[];
  parts: AssemblyGuidePiece[];
  hardware: AssemblyHardwareItem[];
  measurements?: AssemblyStepMeasurement[];
  subassemblyData?: AssemblyDrawerSubassembly[];
  pieceGroupsSummary?: AssemblyPieceGroupSummary[];
  compactCallouts?: AssemblyExplodedGroupCallout[];
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
  drawerSubassemblies?: AssemblyDrawerSubassembly[];
  explodedCalloutGroups?: AssemblyExplodedGroupCallout[];
}

interface DrawerPhysicalCluster {
  id: string;
  unitIndex: number;
  label: string;
  pieces: AssemblyGuidePiece[];
  boxPieces: AssemblyGuidePiece[];
  frontPiece?: AssemblyGuidePiece;
  boxHeight: number;
  dimensions: { width: number; height: number; depth: number };
  bottomDimA: number;
  bottomDimB: number;
  hasBottom: boolean;
  cx: number;
  cy: number;
  cz: number;
  railElevationMm: number;
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

    // 3. Detección de elementos funcionales (cajones, sub-ensambles, puertas, repisas, divisores, fondos)
    const sidePart = pieces.find(p => p.resolvedRole === 'side_left' || p.resolvedRole === 'side_right');
    const sideMinY = sidePart ? sidePart.worldBounds.minY : minY;
    const drawerClusters = this.clusterDrawerUnits(pieces, sideMinY);
    const drawerSubassemblies = this.buildDrawerSubassemblies(drawerClusters);
    const explodedCalloutGroups = this.buildExplodedCalloutGroups(pieces, drawerClusters);

    const drawersCount = this.detectDrawersCount(pieces, group, drawerClusters);
    const doorParts = pieces.filter(p => p.resolvedRole === 'door');
    const doorsCount = doorParts.reduce((sum, p) => sum + p.quantity, 0);
    const shelfParts = pieces.filter(p => p.resolvedRole === 'shelf');
    const shelvesCount = shelfParts.reduce((sum, p) => sum + p.quantity, 0);
    const dividerParts = pieces.filter(p => p.resolvedRole === 'divider');
    const dividersCount = dividerParts.reduce((sum, p) => sum + p.quantity, 0);
    const backParts = pieces.filter(p => {
      if (p.resolvedRole === 'back') return true;
      const nameLower = (p.name || '').toLowerCase();
      const isDrawerPart = p.resolvedRole.startsWith('drawer_') || nameLower.includes('caj');
      return !isDrawerPart && p.thickness <= 3 && p.worldBounds.spanX * p.worldBounds.spanY > 80000;
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
      drawerClusters,
      drawerSubassemblies,
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
      rawParts: parts,
      ...(drawerSubassemblies.length > 0 ? { drawerSubassemblies } : {}),
      ...(explodedCalloutGroups ? { explodedCalloutGroups } : {})
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
      accessory: 52,
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
  private detectDrawersCount(
    pieces: AssemblyGuidePiece[],
    group: PartGroup | null,
    drawerClusters?: DrawerPhysicalCluster[]
  ): number {
    const drawerFronts = pieces.filter(p => p.resolvedRole === 'drawer_front');
    const frontQtySum = drawerFronts.reduce((sum, p) => sum + p.quantity, 0);
    const clusterCount = drawerClusters?.length ?? 0;

    if (group?.parametricConfig?.drawersCount && group.parametricConfig.drawersCount > 0) {
      return Math.max(group.parametricConfig.drawersCount, clusterCount, frontQtySum);
    }
    if (clusterCount > 0) {
      return Math.max(clusterCount, frontQtySum);
    }
    if (drawerFronts.length > 0) {
      return frontQtySum;
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

  private isDrawerPiece(piece: AssemblyGuidePiece): boolean {
    if (
      piece.resolvedRole === 'drawer_front' ||
      piece.resolvedRole === 'drawer_box' ||
      piece.resolvedRole === 'drawer_lateral' ||
      piece.resolvedRole === 'drawer_bottom'
    ) {
      return true;
    }
    const nameLower = (piece.name || '').toLowerCase();
    return nameLower.includes('cajón') || nameLower.includes('cajon');
  }

  private isDrawerBottomPiece(piece: AssemblyGuidePiece): boolean {
    if (piece.resolvedRole === 'drawer_bottom') return true;
    if (piece.resolvedRole !== 'drawer_box') return false;
    const nameLower = (piece.name || '').toLowerCase();
    const wb = piece.worldBounds;
    const isThinHorizontal = piece.thickness <= 6 && wb.spanY <= 10 && wb.spanX > 30 && wb.spanZ > 30;
    return isThinHorizontal || (nameLower.includes('fondo') && wb.spanY <= 12);
  }

  private extractDrawerNameTag(piece: AssemblyGuidePiece): string | null {
    const candidates = [piece.name || '', piece.part.groupName || ''];
    for (const text of candidates) {
      const parenMatch = text.match(/\(([^)]*(?:caj[oó]n|gaveta)[^)]*)\)/i);
      if (parenMatch) {
        return parenMatch[1].trim().toLowerCase().replace(/\s+/g, ' ').replace(/ó/g, 'o');
      }
      const directMatch = text.match(
        /\b((?:caj[oó]n|gaveta)\s*(?:interno\s*)?(?:\d+|inferior|medio|superior))\b/i
      );
      if (directMatch) {
        return directMatch[1].trim().toLowerCase().replace(/\s+/g, ' ').replace(/ó/g, 'o');
      }
    }
    return null;
  }

  private mergeWorldBounds(items: AssemblyGuidePiece[]): AssemblyPieceWorldBounds {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const item of items) {
      const b = item.worldBounds;
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxY > maxY) maxY = b.maxY;
      if (b.minZ < minZ) minZ = b.minZ;
      if (b.maxZ > maxZ) maxZ = b.maxZ;
    }
    const spanX = Math.round((maxX - minX) * 100) / 100;
    const spanY = Math.round((maxY - minY) * 100) / 100;
    const spanZ = Math.round((maxZ - minZ) * 100) / 100;
    return {
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      spanX,
      spanY,
      spanZ,
      cx: Math.round(((minX + maxX) / 2) * 100) / 100,
      cy: Math.round(((minY + maxY) / 2) * 100) / 100,
      cz: Math.round(((minZ + maxZ) / 2) * 100) / 100
    };
  }

  private isNearXZ(a: AssemblyPieceWorldBounds, b: AssemblyPieceWorldBounds, tol: number): boolean {
    const gapX = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
    const gapZ = Math.max(0, Math.max(a.minZ, b.minZ) - Math.min(a.maxZ, b.maxZ));
    return gapX <= tol && gapZ <= tol;
  }

  /**
   * Agrupa piezas de cajón en instancias físicas individuales (drawer-unit-1..N)
   * combinando límites espaciales 3D reales y pistas nominales sin colapsar torres/columnas distintas.
   */
  private clusterDrawerUnits(pieces: AssemblyGuidePiece[], sideMinY: number): DrawerPhysicalCluster[] {
    const drawerPieces = pieces.filter(p => this.isDrawerPiece(p));
    if (drawerPieces.length === 0) return [];

    const pieceOrder = new Map<string, number>();
    pieces.forEach((p, idx) => pieceOrder.set(p.code, idx));

    const fronts = drawerPieces
      .filter(p => p.resolvedRole === 'drawer_front')
      .sort((a, b) => {
        const cyDiff = a.worldBounds.cy - b.worldBounds.cy;
        if (Math.abs(cyDiff) > 2) return cyDiff;
        const cxDiff = a.worldBounds.cx - b.worldBounds.cx;
        if (Math.abs(cxDiff) > 2) return cxDiff;
        return (pieceOrder.get(a.code) ?? 0) - (pieceOrder.get(b.code) ?? 0);
      });

    const boxCandidates = drawerPieces.filter(p => p.resolvedRole !== 'drawer_front');
    const isBottomFlag = boxCandidates.map(p => this.isDrawerBottomPiece(p));
    const tags = boxCandidates.map(p => this.extractDrawerNameTag(p));

    const parent = boxCandidates.map((_, i) => i);
    const findRoot = (x: number): number => {
      let cur = x;
      while (parent[cur] !== cur) {
        parent[cur] = parent[parent[cur]];
        cur = parent[cur];
      }
      return cur;
    };
    const unionRoots = (a: number, b: number): void => {
      const ra = findRoot(a);
      const rb = findRoot(b);
      if (ra !== rb) {
        parent[rb] = ra;
      }
    };

    const canPairBoxPieces = (i: number, j: number): boolean => {
      const a = boxCandidates[i];
      const b = boxCandidates[j];
      if (a.part.groupId && b.part.groupId && a.part.groupId !== b.part.groupId) {
        return false;
      }
      if (tags[i] && tags[j] && tags[i] !== tags[j]) {
        return false;
      }
      const wbA = a.worldBounds;
      const wbB = b.worldBounds;
      if (!this.isNearXZ(wbA, wbB, 12)) {
        return false;
      }

      const botA = isBottomFlag[i];
      const botB = isBottomFlag[j];
      if (!botA && !botB) {
        return (
          Math.abs(wbA.cy - wbB.cy) <= 15 &&
          Math.abs(wbA.minY - wbB.minY) <= 15 &&
          Math.abs(wbA.maxY - wbB.maxY) <= 15
        );
      }
      if (botA && botB) {
        return Math.abs(wbA.cy - wbB.cy) <= 8;
      }
      const bot = botA ? wbA : wbB;
      const wall = botA ? wbB : wbA;
      return (
        bot.minY >= wall.minY - 12 &&
        bot.maxY <= wall.maxY + 4 &&
        bot.minY <= wall.minY + Math.max(24, wall.spanY * 0.4)
      );
    };

    for (let i = 0; i < boxCandidates.length; i++) {
      for (let j = i + 1; j < boxCandidates.length; j++) {
        if (canPairBoxPieces(i, j)) {
          unionRoots(i, j);
        }
      }
    }

    interface RawCluster {
      boxPieces: AssemblyGuidePiece[];
      frontPiece?: AssemblyGuidePiece;
    }

    const boxBuckets = new Map<number, RawCluster>();
    for (let i = 0; i < boxCandidates.length; i++) {
      const root = findRoot(i);
      let bucket = boxBuckets.get(root);
      if (!bucket) {
        bucket = { boxPieces: [] };
        boxBuckets.set(root, bucket);
      }
      bucket.boxPieces.push(boxCandidates[i]);
    }

    const rawClusters: RawCluster[] = Array.from(boxBuckets.values());

    // Asociar cada frente de cajón al clúster de caja espacialmente correspondiente
    for (const front of fronts) {
      const frontTag = this.extractDrawerNameTag(front);
      let bestCluster: RawCluster | null = null;
      let bestScore = -Infinity;

      for (const candidate of rawClusters) {
        if (candidate.frontPiece || candidate.boxPieces.length === 0) continue;

        const hasGroupConflict = candidate.boxPieces.some(
          bp => bp.part.groupId && front.part.groupId && bp.part.groupId !== front.part.groupId
        );
        if (hasGroupConflict) continue;

        const clusterTags = new Set(
          candidate.boxPieces
            .map(bp => this.extractDrawerNameTag(bp))
            .filter((t): t is string => Boolean(t))
        );
        if (frontTag && clusterTags.size > 0 && !clusterTags.has(frontTag)) {
          continue;
        }

        const cb = this.mergeWorldBounds(candidate.boxPieces);
        if (!this.isNearXZ(front.worldBounds, cb, 45)) continue;

        const isWideX = front.worldBounds.spanX >= front.worldBounds.spanZ;
        const alignCenterDiff = isWideX
          ? Math.abs(front.worldBounds.cx - cb.cx)
          : Math.abs(front.worldBounds.cz - cb.cz);
        const alignLimit = Math.max(45, (isWideX ? cb.spanX : cb.spanZ) * 0.25);
        if (alignCenterDiff > alignLimit) continue;

        const overlapSpan = isWideX
          ? Math.max(0, Math.min(front.worldBounds.maxX, cb.maxX) - Math.max(front.worldBounds.minX, cb.minX))
          : Math.max(0, Math.min(front.worldBounds.maxZ, cb.maxZ) - Math.max(front.worldBounds.minZ, cb.minZ));
        const minExpectedSpan = Math.min(
          isWideX ? front.worldBounds.spanX : front.worldBounds.spanZ,
          isWideX ? cb.spanX : cb.spanZ
        );
        if (overlapSpan < minExpectedSpan * 0.5) continue;

        const vOverlap =
          Math.min(front.worldBounds.maxY, cb.maxY) - Math.max(front.worldBounds.minY, cb.minY);
        const cyDist = Math.abs(front.worldBounds.cy - cb.cy);
        const verticalMatches =
          vOverlap >= Math.min(20, cb.spanY * 0.3) ||
          (vOverlap >= -8 && cyDist <= Math.max(45, cb.spanY * 0.65));
        if (!verticalMatches) continue;

        const tagBonus = frontTag && clusterTags.has(frontTag) ? 10000 : 0;
        const xzDist = Math.hypot(front.worldBounds.cx - cb.cx, front.worldBounds.cz - cb.cz);
        const score = tagBonus + vOverlap * 10 - cyDist - xzDist * 0.05;
        if (score > bestScore) {
          bestScore = score;
          bestCluster = candidate;
        }
      }

      if (bestCluster) {
        bestCluster.frontPiece = front;
      } else {
        rawClusters.push({ boxPieces: [], frontPiece: front });
      }
    }

    const clusters: DrawerPhysicalCluster[] = rawClusters.map(rc => {
      const orderedBox = [...rc.boxPieces].sort(
        (a, b) => (pieceOrder.get(a.code) ?? 0) - (pieceOrder.get(b.code) ?? 0)
      );
      const allPieces = [...orderedBox, ...(rc.frontPiece ? [rc.frontPiece] : [])].sort(
        (a, b) => (pieceOrder.get(a.code) ?? 0) - (pieceOrder.get(b.code) ?? 0)
      );
      const refItems = orderedBox.length > 0 ? orderedBox : allPieces;
      const refBounds = this.mergeWorldBounds(refItems);

      const wallPieces = orderedBox.filter(p => !this.isDrawerBottomPiece(p));
      const boxHeight = wallPieces.length > 0
        ? Math.round(Math.max(...wallPieces.map(p => p.worldBounds.spanY)))
        : Math.round(refBounds.spanY);

      let isWideX: boolean;
      if (rc.frontPiece) {
        isWideX = rc.frontPiece.worldBounds.spanX >= rc.frontPiece.worldBounds.spanZ;
      } else {
        const hasYzWall = wallPieces.some(p => p.worldBounds.spanX <= 26 && p.worldBounds.spanZ > p.worldBounds.spanX * 2);
        const hasXyLateral = wallPieces.some(
          p =>
            p.worldBounds.spanZ <= 26 &&
            p.worldBounds.spanX > p.worldBounds.spanZ * 2 &&
            (p.name || '').toLowerCase().includes('lateral')
        );
        if (hasYzWall && !hasXyLateral) {
          isWideX = true;
        } else if (hasXyLateral && !hasYzWall) {
          isWideX = false;
        } else {
          isWideX = refBounds.spanX >= refBounds.spanZ;
        }
      }

      const width = Math.round(isWideX ? refBounds.spanX : refBounds.spanZ);
      const depth = Math.round(isWideX ? refBounds.spanZ : refBounds.spanX);
      const height = Math.round(refBounds.spanY);

      const bottomPiece = orderedBox.find(p => this.isDrawerBottomPiece(p));
      const bottomDimA = bottomPiece ? Math.round(Math.max(bottomPiece.length, bottomPiece.width)) : 0;
      const bottomDimB = bottomPiece ? Math.round(Math.min(bottomPiece.length, bottomPiece.width)) : 0;

      const railElevationMm = orderedBox.length > 0
        ? Math.max(40, Math.round(refBounds.cy - sideMinY))
        : Math.max(40, Math.round((rc.frontPiece!.worldBounds.minY - sideMinY) + 40));

      return {
        id: '',
        unitIndex: 0,
        label: '',
        pieces: allPieces,
        boxPieces: orderedBox,
        frontPiece: rc.frontPiece,
        boxHeight,
        dimensions: { width, height, depth },
        bottomDimA,
        bottomDimB,
        hasBottom: Boolean(bottomPiece),
        cx: refBounds.cx,
        cy: refBounds.cy,
        cz: refBounds.cz,
        railElevationMm
      };
    });

    clusters.sort((a, b) => {
      const cyDiff = a.cy - b.cy;
      if (Math.abs(cyDiff) > 2) return cyDiff;
      const cxDiff = a.cx - b.cx;
      if (Math.abs(cxDiff) > 2) return cxDiff;
      return a.cz - b.cz;
    });

    clusters.forEach((cluster, idx) => {
      const unitIndex = idx + 1;
      cluster.unitIndex = unitIndex;
      cluster.id = `drawer-unit-${unitIndex}`;
      cluster.label = `Cajón ${unitIndex}`;
      for (const piece of cluster.pieces) {
        piece.drawerClusterId = cluster.id;
        piece.drawerUnitIndex = unitIndex;
      }
    });

    return clusters;
  }

  private normalizeGroupPieceLabel(name: string, role: ComponentRole): string {
    let cleaned = (name || '')
      .replace(/\s*\([^)]*(?:caj[oó]n|gaveta)[^)]*\)\s*/gi, ' ')
      .replace(/^\s*(?:caj[oó]n|gaveta)\s*(?:\d+|inferior|medio|superior|[A-Z])\s*[-–:]\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (role === 'shelf' || role === 'divider' || role === 'tie' || role === 'free') {
      cleaned = cleaned.replace(/\s+#?\d{1,2}$/, '').trim();
    }

    return cleaned || name;
  }

  /**
   * Agrupa piezas equivalentes por rol, etiqueta normalizada y dimensiones en un resumen ×N.
   */
  private buildPieceGroupsSummary(pieces: AssemblyGuidePiece[]): AssemblyPieceGroupSummary[] {
    const groups = new Map<string, AssemblyPieceGroupSummary>();

    for (const piece of pieces) {
      const normalized = this.normalizeGroupPieceLabel(piece.name, piece.resolvedRole);
      const translatedLabel = this.i18n.translatePartName(normalized) || piece.translatedName || piece.name;
      const dimsText = `${piece.length}×${piece.width}×${piece.thickness}`;
      const key = `${piece.resolvedRole}::${normalized.toLowerCase()}::${dimsText}`;

      let existing = groups.get(key);
      if (!existing) {
        existing = {
          key,
          label: translatedLabel,
          role: piece.resolvedRole,
          dimensionsText: dimsText,
          quantity: 0,
          codes: [],
          representativeCode: piece.code
        };
        groups.set(key, existing);
      }

      existing.quantity += piece.quantity;
      existing.codes.push(piece.code);
    }

    return Array.from(groups.values());
  }

  /**
   * Consolida instancias físicas equivalentes de cajas de cajón en plantillas reutilizables (×N).
   */
  private buildDrawerSubassemblies(clusters: DrawerPhysicalCluster[]): AssemblyDrawerSubassembly[] {
    const boxClusters = clusters.filter(c => c.boxPieces.length > 0);
    if (boxClusters.length === 0) return [];

    interface SubassemblyBucket {
      anchor: DrawerPhysicalCluster;
      clusters: DrawerPhysicalCluster[];
    }

    const buckets: SubassemblyBucket[] = [];

    for (const cluster of boxClusters) {
      const match = buckets.find(b => {
        const ref = b.anchor;
        return (
          cluster.boxPieces.length === ref.boxPieces.length &&
          cluster.hasBottom === ref.hasBottom &&
          Math.abs(cluster.boxHeight - ref.boxHeight) <= 3 &&
          Math.abs(cluster.bottomDimA - ref.bottomDimA) <= 3 &&
          Math.abs(cluster.bottomDimB - ref.bottomDimB) <= 3 &&
          Math.abs(cluster.dimensions.width - ref.dimensions.width) <= 3 &&
          Math.abs(cluster.dimensions.depth - ref.dimensions.depth) <= 3
        );
      });

      if (match) {
        match.clusters.push(cluster);
      } else {
        buckets.push({ anchor: cluster, clusters: [cluster] });
      }
    }

    const heightCounts = new Map<number, number>();
    for (const bucket of buckets) {
      const h = Math.round(bucket.anchor.boxHeight);
      heightCounts.set(h, (heightCounts.get(h) ?? 0) + 1);
    }

    return buckets.map((bucket, idx) => {
      const ref = bucket.anchor;
      const hRounded = Math.round(ref.boxHeight);
      const hasDuplicateHeight = (heightCounts.get(hRounded) ?? 0) > 1;
      const label = hasDuplicateHeight
        ? `Cajón ${hRounded}mm · ${Math.round(ref.dimensions.width)}mm`
        : `Cajón ${hRounded}mm`;

      const allBoxPieces = bucket.clusters.flatMap(c => c.boxPieces);
      const allBoxPartCodes = allBoxPieces.map(p => p.code);
      const allFrontPartCodes = bucket.clusters.flatMap(c => (c.frontPiece ? [c.frontPiece.code] : []));
      const allPartCodes = bucket.clusters.flatMap(c => c.pieces.map(p => p.code));

      return {
        id: `drawer-subassembly-${idx + 1}`,
        label,
        repeatCount: bucket.clusters.length,
        dimensions: { ...ref.dimensions },
        boxHeight: ref.boxHeight,
        drawerUnitLabels: bucket.clusters.map(c => c.label),
        representativeParts: [...ref.boxPieces],
        ...(ref.frontPiece ? { representativeFront: ref.frontPiece } : {}),
        allBoxPartCodes,
        allFrontPartCodes,
        allPartCodes,
        railElevationsMm: bucket.clusters.map(c => c.railElevationMm),
        pieceGroupsSummary: this.buildPieceGroupsSummary(allBoxPieces)
      };
    });
  }

  private formatCompactCodeRange(codes: string[]): string {
    if (codes.length === 0) return '';
    const parsed = codes.map(code => {
      const match = /^P(\d+)$/i.exec(code.trim());
      return { code, num: match ? Number.parseInt(match[1], 10) : NaN };
    });

    if (parsed.some(item => Number.isNaN(item.num))) {
      return codes.join(', ');
    }

    parsed.sort((a, b) => a.num - b.num);
    const runs: string[] = [];
    let startIdx = 0;

    while (startIdx < parsed.length) {
      let endIdx = startIdx;
      while (endIdx + 1 < parsed.length && parsed[endIdx + 1].num === parsed[endIdx].num + 1) {
        endIdx++;
      }
      const len = endIdx - startIdx + 1;
      if (len >= 3) {
        runs.push(`${parsed[startIdx].code}–${parsed[endIdx].code}`);
      } else if (len === 2) {
        runs.push(`${parsed[startIdx].code}, ${parsed[endIdx].code}`);
      } else {
        runs.push(parsed[startIdx].code);
      }
      startIdx = endIdx + 1;
    }

    return runs.join(', ');
  }

  private formatDrawerCalloutSublabel(boxCodes: string[], frontCode?: string): string {
    const boxRange = this.formatCompactCodeRange(boxCodes);
    if (boxRange && frontCode) {
      return `${boxRange} · ${frontCode}`;
    }
    return boxRange || frontCode || '';
  }

  private buildDrawerUnitCallout(cluster: DrawerPhysicalCluster): AssemblyExplodedGroupCallout {
    const boxCodes = cluster.boxPieces.map(p => p.code);
    const frontCode = cluster.frontPiece?.code;
    const allUnitCodes = cluster.pieces.map(p => p.code);
    const primaryCode = frontCode ?? boxCodes[0] ?? cluster.pieces[0].code;

    return {
      id: cluster.id,
      label: cluster.label,
      sublabel: this.formatDrawerCalloutSublabel(boxCodes, frontCode),
      codes: allUnitCodes,
      primaryCode,
      role: cluster.frontPiece ? 'drawer_front' : 'drawer_box',
      kind: 'drawer_unit',
      drawerUnitIndex: cluster.unitIndex
    };
  }

  private buildExplodedCalloutGroups(
    pieces: AssemblyGuidePiece[],
    drawerClusters: DrawerPhysicalCluster[]
  ): AssemblyExplodedGroupCallout[] | undefined {
    if (drawerClusters.length < 2 && pieces.length <= 14) {
      return undefined;
    }

    const callouts: AssemblyExplodedGroupCallout[] = [];
    let emittedDrawerUnits = false;

    for (const piece of pieces) {
      if (piece.drawerClusterId) {
        if (!emittedDrawerUnits) {
          for (const cluster of drawerClusters) {
            callouts.push(this.buildDrawerUnitCallout(cluster));
          }
          emittedDrawerUnits = true;
        }
        continue;
      }

      callouts.push({
        id: `callout-part-${piece.code}`,
        label: piece.translatedName || piece.name,
        sublabel: `${piece.length}×${piece.width} mm`,
        codes: [piece.code],
        primaryCode: piece.code,
        role: piece.resolvedRole,
        kind: 'part'
      });
    }

    return callouts;
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

    // 3. Soportes / Pines de repisa móvil (4 por repisa móvil regulable; excluye fijas, nicho y zapateros)
    const movableShelvesCount = pieces
      .filter(p => {
        if (p.resolvedRole !== 'shelf') return false;
        const hc = p.part.hardwareConfig;
        if (hc?.isStructuralFixedShelf) return false;
        if (hc?.shoeRackAngleDeg !== undefined) return false;
        if (hc?.isMovableShelf === false) return false;
        if (hc?.isMovableShelf === true) return true;
        const lower = (p.name || '').toLowerCase();
        if (
          lower.includes('fija') ||
          lower.includes('fijo') ||
          lower.includes('zapatero') ||
          lower.includes('nicho') ||
          lower.includes('divisor')
        ) {
          return false;
        }
        return true;
      })
      .reduce((sum, p) => sum + p.quantity, 0);

    if (movableShelvesCount > 0) {
      const shelfPins = movableShelvesCount * 4;
      kit.push({
        id: 'shelf_pins',
        name: 'assemblyGuide.hardwareShelfPins',
        codeName: 'Soportes para Repisa Móvil',
        spec: 'Pin metálico niquelado Ø 5 mm',
        quantity: shelfPins,
        type: 'shelf_pin',
        iconName: 'layers',
        description: '4 soportes nivelados por cada repisa móvil regulable.'
      });
    }

    // 4. Juegos de correderas para cajones (telescópicas / ocultas cierre suave) + tornillos 3.5 x 15 mm
    const drawerFrontPieces = pieces.filter(p => p.resolvedRole === 'drawer_front');
    let slideScrews = 0;
    if (drawersCount > 0) {
      const slideLength = paramConfig?.depth
        ? Math.min(500, Math.max(250, Math.floor(paramConfig.depth / 50) * 50))
        : 450;
      const undermountFrontsCount = drawerFrontPieces
        .filter(
          df =>
            df.part.hardwareConfig?.slideType === 'undermount' ||
            (df.part.notes || '').toLowerCase().includes('oculta')
        )
        .reduce((sum, df) => sum + df.quantity, 0);
      const isGlobalUndermount =
        drawerFrontPieces.length === 0 && paramConfig?.drawerSlideType === 'undermount';
      const undermountCount = isGlobalUndermount
        ? drawersCount
        : Math.min(drawersCount, undermountFrontsCount);
      const telescopicCount = Math.max(0, drawersCount - undermountCount);

      if (telescopicCount > 0) {
        kit.push({
          id: 'telescopic_slides',
          name: 'assemblyGuide.hardwareSlides',
          codeName: 'Correderas Telescópicas',
          spec: `Par telescópico ${slideLength} mm (extensión total)`,
          quantity: telescopicCount,
          type: 'drawer_slide',
          iconName: 'sliders',
          description: '1 juego (izq + der) por cada cajón con holgura lateral 13 mm.'
        });
      }
      if (undermountCount > 0) {
        kit.push({
          id: 'undermount_slides',
          name: 'Correderas Ocultas Cierre Suave',
          codeName: 'Correderas Ocultas Cierre Suave',
          spec: `Par oculto bajo cajón ${slideLength} mm con clips 3D`,
          quantity: undermountCount,
          type: 'drawer_slide',
          iconName: 'sliders',
          description: '1 par oculto bajo cajón con desacople rápido y cierre amortiguado.'
        });
      }
      slideScrews = drawersCount * 8;
    }

    // 5. Bisagras cazoleta 35 mm + Pistones Hidráulicos + Compás Abatible Inferior + Sistema Corredizo + Vitrina
    const isGasPistonDoor = (dp: AssemblyGuidePiece): boolean => {
      const upperName = (dp.name || '').toUpperCase();
      return (
        dp.part.hardwareConfig?.hingeType === 'gas_piston' ||
        dp.part.hardwareConfig?.openingDirection === 'top' ||
        upperName.includes('ABATIBLE SUPERIOR') ||
        upperName.includes('ELEVABLE')
      );
    };
    const isBottomDoor = (dp: AssemblyGuidePiece): boolean => {
      const upperName = (dp.name || '').toUpperCase();
      return (
        dp.part.hardwareConfig?.openingDirection === 'bottom' ||
        upperName.includes('ABATIBLE INFERIOR')
      );
    };
    const isSlidingDoorPiece = (dp: AssemblyGuidePiece): boolean => {
      const lowerName = (dp.name || '').toLowerCase();
      const lowerNotes = (dp.part.notes || '').toLowerCase();
      return (
        lowerName.includes('corrediz') ||
        lowerNotes.includes('corrediz') ||
        dp.part.hardwareConfig?.slidingLeavesCount !== undefined
      );
    };

    const gasDoorQty = doorParts
      .filter(dp => !isSlidingDoorPiece(dp) && isGasPistonDoor(dp))
      .reduce((sum, dp) => sum + dp.quantity, 0);

    let compasCount = 0;
    let totalHinges = 0;
    let vitrinaDoorsCount = 0;
    let vitrinaPerimeterMm = 0;
    let vitrinaAreaM2 = 0;
    const slidingBays = new Set<string>();

    if (doorsCount > 0) {
      for (const dp of doorParts) {
        const isVitrina =
          dp.part.hardwareConfig?.doorPanelStyle === 'vitrina' ||
          dp.part.materialId === 'vitrina_aluminio_vidrio';
        if (isVitrina) {
          vitrinaDoorsCount += dp.quantity;
          vitrinaPerimeterMm += 2 * (dp.length + dp.width) * dp.quantity;
          vitrinaAreaM2 += ((dp.length * dp.width) / 1_000_000) * dp.quantity;
        }

        if (isSlidingDoorPiece(dp)) {
          const bayKey = dp.part.zoneId || dp.part.moduleId || dp.part.groupId || 'default';
          slidingBays.add(bayKey);
          continue;
        }

        const openingDir = dp.part.hardwareConfig?.openingDirection;
        const isHorizontalHinge =
          openingDir === 'top' ||
          isGasPistonDoor(dp) ||
          isBottomDoor(dp);
        const doorEdge = isHorizontalHinge
          ? Math.max(dp.worldBounds.spanX, dp.worldBounds.spanZ)
          : dp.worldBounds.spanY;

        if (isBottomDoor(dp)) {
          compasCount += (doorEdge >= 600 ? 2 : 1) * dp.quantity;
        }

        if (dp.part.hardwareConfig?.hingeType === 'none') {
          continue;
        }
        const hingesPerDoor = doorEdge >= 1600 ? 4 : doorEdge > 900 ? 3 : 2;
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

      if (compasCount > 0) {
        kit.push({
          id: 'compas_abatible',
          name: 'Compás / Retenedor Puerta Abatible Inferior',
          codeName: 'Compás / Retenedor Abatible Inferior',
          spec: 'Brazo retenedor con apertura amortiguada de retención horizontal',
          quantity: compasCount,
          type: 'compas_abatible',
          iconName: 'unfold',
          description: 'Limita la apertura y soporta el peso de puertas abatibles hacia abajo.'
        });
      }

      if (slidingBays.size > 0) {
        kit.push({
          id: 'sliding_closet_kit',
          name: 'Kit Sistema Corredizo + Rieles Aluminio',
          codeName: 'Kit Sistema Corredizo (Rieles Sup/Inf + Carros)',
          spec: 'Riel superior e inferior de aluminio + carros rodantes regulables',
          quantity: slidingBays.size,
          type: 'sliding_kit',
          iconName: 'sliders',
          description: 'Fijar riel superior e inferior nivelados antes de colgar las hojas corredizas.'
        });
      }

      if (vitrinaDoorsCount > 0) {
        const perimM = Math.max(0.1, Math.round((vitrinaPerimeterMm / 1000) * 100) / 100);
        const areaM2 = Math.max(0.01, Math.round(vitrinaAreaM2 * 100) / 100);
        kit.push({
          id: 'vitrina_hardware',
          name: 'Perfilería Aluminio + Vidrio Templado Vitrina',
          codeName: 'Marco Aluminio + Vidrio Templado Vitrina',
          spec: `${perimM} m de perfil perimetral · ${areaM2.toFixed(2)} m² de vidrio 4 mm`,
          quantity: vitrinaDoorsCount,
          type: 'vitrina_hardware',
          iconName: 'layers',
          description: 'Puerta vitrina armada con escuadras de aluminio y empaque perimetral.'
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

    // 7. Manijas / Tiradores con tornillos M4 (excluye Push, Uñero y Gola en puertas y cajones)
    const isPhysicalFront = (piece: AssemblyGuidePiece): boolean => {
      const hc = piece.part.hardwareConfig;
      if (hc?.isInternalDrawerFront) return false;
      if (hc?.handlePosition === 'none') return false;
      if (
        hc?.openingSystem === 'push' ||
        hc?.openingSystem === 'finger_pull' ||
        hc?.openingSystem === 'gola'
      ) {
        return false;
      }
      if (
        hc?.drawerOpeningSystem === 'push' ||
        hc?.drawerOpeningSystem === 'finger_pull' ||
        hc?.drawerOpeningSystem === 'gola'
      ) {
        return false;
      }
      if (hc?.handleType) {
        return (
          hc.handleType !== 'none' &&
          hc.handleType !== 'push' &&
          hc.handleType !== 'push_open' &&
          hc.handleType !== 'gola_less' &&
          hc.handleType !== 'gola' &&
          hc.handleType !== 'finger_pull'
        );
      }
      if (paramConfig?.hasHandle === false) return false;
      if (
        paramConfig?.openingSystem === 'push' ||
        paramConfig?.openingSystem === 'finger_pull' ||
        paramConfig?.openingSystem === 'gola'
      ) {
        return false;
      }
      if (
        paramConfig?.handleType === 'none' ||
        paramConfig?.handleType === 'push_open' ||
        paramConfig?.handleType === 'push' ||
        paramConfig?.handleType === 'gola_less' ||
        paramConfig?.handleType === 'gola' ||
        paramConfig?.handleType === 'finger_pull'
      ) {
        return false;
      }
      return true;
    };

    const physicalHandleDoors = doorParts
      .filter(isPhysicalFront)
      .reduce((sum, dp) => sum + dp.quantity, 0);

    const physicalHandleDrawers =
      drawerFrontPieces.length > 0
        ? drawerFrontPieces.filter(isPhysicalFront).reduce((sum, df) => sum + df.quantity, 0)
        : paramConfig?.hasHandle === false ||
            paramConfig?.openingSystem === 'push' ||
            paramConfig?.openingSystem === 'finger_pull' ||
            paramConfig?.openingSystem === 'gola' ||
            paramConfig?.drawerSlideType === 'push_open'
          ? 0
          : drawersCount;

    const totalHandles = physicalHandleDoors + physicalHandleDrawers;
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

    // 7b. Expulsores Push-to-Open para puertas
    const pushDoorsCount = doorParts
      .filter(dp => {
        const hc = dp.part.hardwareConfig;
        return (
          hc?.openingSystem === 'push' ||
          hc?.handleType === 'push' ||
          hc?.handleType === 'push_open'
        );
      })
      .reduce((sum, dp) => sum + dp.quantity, 0);
    if (pushDoorsCount > 0) {
      kit.push({
        id: 'push_door_pistons',
        name: 'Expulsores Push-to-Open Puerta',
        codeName: 'Espaciador / Expulsor Push-to-Open Puerta',
        spec: 'Expulsor por presión con pletina magnética',
        quantity: pushDoorsCount,
        type: 'push_opener',
        iconName: 'unfold',
        description: '1 expulsor en el canto opuesto a las bisagras por cada puerta push.'
      });
    }

    // 7c. Perfiles Gola Aluminio
    const golaPieces = pieces.filter(
      p =>
        p.resolvedRole === 'accessory' &&
        ((p.part.materialId || '').startsWith('hw_gola_') ||
          p.name.toLowerCase().includes('perfil gola') ||
          p.part.hardwareConfig?.handleType === 'gola_less')
    );
    if (golaPieces.length > 0) {
      const totalGolaMm = golaPieces.reduce(
        (sum, gp) => sum + Math.max(0, Number(gp.length) || 0) * gp.quantity,
        0
      );
      const totalMeters = Math.max(0.1, Math.round((totalGolaMm / 1000) * 100) / 100);
      kit.push({
        id: 'gola_profiles',
        name: 'Perfiles Gola Aluminio',
        codeName: 'Perfil Gola Horizontal',
        spec: `Perfil J aluminio · ${totalMeters} m (${Math.round(totalGolaMm)} mm)`,
        quantity: golaPieces.reduce((s, g) => s + g.quantity, 0),
        type: 'gola_profile',
        iconName: 'ruler',
        description: 'Perfil continuo embutido para apertura sin tiradores.'
      });
    }

    // 8. Barra / Tubo colgador para closets según acabado
    const isLegPiece = (p: AssemblyGuidePiece): boolean => {
      const n = p.name.toLowerCase();
      const matId = p.part.materialId || '';
      return (
        p.resolvedRole === 'accessory' &&
        (Boolean(p.part.hardwareConfig?.legStyle) ||
          matId.startsWith('hw_leg_') ||
          n.includes('pata'))
      );
    };
    const isConcealedHangerPiece = (p: AssemblyGuidePiece): boolean => {
      const n = p.name.toLowerCase();
      const matId = p.part.materialId || '';
      return (
        p.resolvedRole === 'accessory' &&
        (p.part.hardwareConfig?.wallMountType === 'concealed_hanger' ||
          matId === 'hw_wall_concealed_hanger' ||
          n.includes('colgador oculto'))
      );
    };
    const rodParts = pieces.filter(p => {
      if (isLegPiece(p) || isConcealedHangerPiece(p)) return false;
      if (p.part.hardwareConfig?.isFillerStrip || p.part.hardwareConfig?.isHingeSpacer) {
        return false;
      }
      const n = p.name.toLowerCase();
      const matId = p.part.materialId || '';
      if (
        matId === 'hw_sliding_track' ||
        matId === 'hw_shoe_stop_aluminum' ||
        matId.startsWith('hw_gola_')
      ) {
        return false;
      }
      return (
        Boolean(p.part.hardwareConfig?.rodFinish) ||
        matId.startsWith('hw_rod_') ||
        (p.part.shapeType === 'circle' && !n.includes('pata')) ||
        n.includes('tubo') ||
        n.includes('barra colgadora') ||
        n.includes('barra closet')
      );
    });
    const rodPartsCount = rodParts.reduce((s, p) => s + p.quantity, 0);
    const detectedRodFinish =
      rodParts[0]?.part.hardwareConfig?.rodFinish ??
      (rodParts[0]?.part.materialId === 'hw_rod_matte_black'
        ? 'matte_black'
        : rodParts[0]?.part.materialId === 'hw_rod_gold'
          ? 'gold'
          : undefined) ??
      paramConfig?.hangingRodFinish ??
      'chrome';
    const rodFinishLabel =
      detectedRodFinish === 'matte_black'
        ? 'Negro Mate'
        : detectedRodFinish === 'gold'
          ? 'Dorado'
          : 'Cromado';

    const hangingRods = Math.max(paramConfig?.hangingRodsCount || 0, rodPartsCount);
    if (hangingRods > 0) {
      kit.push({
        id: 'closet_hanging_rod',
        name: 'assemblyGuide.hardwareClosetRod',
        codeName: `Barra Colgadora (${rodFinishLabel}) + Bridas`,
        spec: `Barra ovalada acabado ${rodFinishLabel.toLowerCase()} + 2 bridas soporte`,
        quantity: hangingRods,
        type: 'closet_rod',
        iconName: 'ruler',
        description: 'Soporte de colgado para closet o ropero.'
      });
    }

    // 9. Anclaje Mural (Listón Francés / Amarre Trasero / Colgadores Ocultos)
    const concealedHangersQty = pieces
      .filter(isConcealedHangerPiece)
      .reduce((s, p) => s + p.quantity, 0);
    if (concealedHangersQty > 0) {
      kit.push({
        id: 'wall_concealed_hangers',
        name: 'Colgadores Ocultos Regulables',
        codeName: 'Juego de Colgadores Ocultos + Platinas Murales',
        spec: 'Par de colgadores ocultos regulables + platinas acero muro',
        quantity: Math.max(1, Math.ceil(concealedHangersQty / 2)),
        type: 'wall_anchor',
        iconName: 'wrench',
        description: 'Fijación oculta de alta carga para muebles aéreos y flotantes.'
      });
    }

    const hasWallTies = pieces.some(
      p =>
        p.resolvedRole === 'tie' &&
        (p.part.hardwareConfig?.wallMountType === 'french_cleat' ||
          p.part.hardwareConfig?.wallMountType === 'direct_nailer' ||
          p.name.toLowerCase().includes('listón francés') ||
          p.name.toLowerCase().includes('liston frances') ||
          p.name.toLowerCase().includes('amarre trasero'))
    );
    if (hasWallTies) {
      kit.push({
        id: 'wall_anchor_kit',
        name: 'Kit Chazos y Tornillos de Anclaje a Muro',
        codeName: 'Kit Chazos y Tornillos de Anclaje a Muro',
        spec: 'Chazos expansivos Ø8–10 mm + tirafondos estructurales',
        quantity: 1,
        type: 'wall_anchor',
        iconName: 'wrench',
        description: 'Anclaje seguro del listón francés pared o amarre trasero al muro.'
      });
    }

    // 10. Patas niveladoras / decorativas si el módulo las usa
    const legPiecesList = pieces.filter(isLegPiece);
    const totalLegsQty = legPiecesList.reduce((s, p) => s + p.quantity, 0);
    if (totalLegsQty > 0) {
      const sampleLeg = legPiecesList[0];
      kit.push({
        id: 'cabinet_legs',
        name: 'Patas Base del Mueble',
        codeName: sampleLeg?.part.materialName || 'Patas Niveladoras',
        spec: `${totalLegsQty} unidades con base regulable / platina`,
        quantity: totalLegsQty,
        type: 'cabinet_leg',
        iconName: 'sliders',
        description: 'Nivelar con nivel de burbuja antes de fijar al muro o entre módulos.'
      });
    }

    // 10b. Perfiles tope frontal aluminio para zapatero
    const aluminumShoeStopPieces = pieces.filter(
      p =>
        p.resolvedRole === 'accessory' &&
        (p.part.materialId === 'hw_shoe_stop_aluminum' ||
          p.name.toLowerCase().includes('tope frontal aluminio'))
    );
    if (aluminumShoeStopPieces.length > 0) {
      const totalStopMm = aluminumShoeStopPieces.reduce(
        (sum, sp) => sum + Math.max(0, Number(sp.length) || 0) * sp.quantity,
        0
      );
      const stopMeters = Math.max(0.1, Math.round((totalStopMm / 1000) * 100) / 100);
      kit.push({
        id: 'shoe_stop_aluminum',
        name: 'Perfil Tope Aluminio Zapatero',
        codeName: 'Perfil Tope Aluminio Zapatero',
        spec: `${stopMeters} m lineales (${Math.round(totalStopMm)} mm totales)`,
        quantity: aluminumShoeStopPieces.reduce((sum, sp) => sum + sp.quantity, 0),
        type: 'shoe_stop',
        iconName: 'ruler',
        description: 'Tope frontal metálico antideslizante para bandejas zapateras inclinadas.'
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
    drawerClusters: DrawerPhysicalCluster[];
    drawerSubassemblies: AssemblyDrawerSubassembly[];
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
      drawerClusters,
      drawerSubassemblies,
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
    const isStep3NicheOrShoeTie = (p: AssemblyGuidePiece): boolean => {
      if (p.part.hardwareConfig?.shoeRackAngleDeg !== undefined) return true;
      return (
        p.resolvedRole === 'tie' &&
        (Boolean(p.part.hardwareConfig?.isStructuralFixedShelf) ||
          p.name.toLowerCase().includes('nicho'))
      );
    };
    const rawCarcass = pieces.filter(
      p =>
        carcassRoles.has(p.resolvedRole) &&
        !p.part.hardwareConfig?.isFillerStrip &&
        !isStep3NicheOrShoeTie(p)
    );
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
      const wallAnchorHardware = hardwareKit.find(h => h.id === 'wall_anchor_kit');
      const hasFrenchCleatTies = step1Pieces.some(
        p =>
          p.part.hardwareConfig?.wallMountType === 'french_cleat' ||
          p.name.toLowerCase().includes('listón francés') ||
          p.name.toLowerCase().includes('liston frances')
      );
      const hasDirectNailerTies = step1Pieces.some(
        p =>
          p.part.hardwareConfig?.wallMountType === 'direct_nailer' ||
          p.name.toLowerCase().includes('amarre trasero')
      );
      const hasHingeSpacers = step1Pieces.some(
        p =>
          Boolean(p.part.hardwareConfig?.isHingeSpacer) ||
          p.name.toLowerCase().includes('regleta paso bisagra')
      );

      const step1Tips = [
        `Coloque ${screwsPerJoint} tornillos de 4.0 × 50 mm por cada unión estructural a 50 mm de los extremos.`,
        'Verifique que los bordes con tapacanto (L1/A1) queden mirando hacia el frente visto.',
        'Si el módulo incluye zócalo inferior, ensámblelo antes de elevar el mueble.'
      ];
      if (hasFrenchCleatTies) {
        step1Tips.push(
          'Listón Francés (Corte a 45°): Fije el listón del módulo arriba en el dorso con el bisel a 45° hacia adentro/abajo, y ancle su listón espejo nivelado al muro con chazos y tirafondos.'
        );
      }
      if (hasDirectNailerTies) {
        step1Tips.push(
          'Amarre Trasero Directo al Muro: Atornille los refuerzos traseros superior e inferior entre laterales y fíjelos directamente a la pared con chazos expansivos.'
        );
      }
      if (hasHingeSpacers) {
        step1Tips.push(
          'Regleta Paso Bisagra: Fije verticalmente las regletas de paso en el frente interior del vano para librar las cazoletas de la puerta antes de montar las correderas de la cajonera interna.'
        );
      }

      steps.push({
        stepNumber: stepNum++,
        titleKey: 'assemblyGuide.step1Title',
        defaultTitle: 'Paso 1 — Estructura Base y Costados (Casco)',
        descriptionKey: 'assemblyGuide.step1Desc',
        defaultDescription:
          'Coloque los laterales sobre una superficie limpia y plana. Una el piso inferior y los amarres superiores o techo a los laterales izquierdo y derecho. Asegúrese de que los bordes que cuentan con tapacanto queden alineados hacia la fachada frontal del mueble.',
        tips: step1Tips,
        actionType: 'carcass',
        partCodes: step1Pieces.map(p => p.code),
        cumulativePriorPartCodes: [],
        parts: step1Pieces,
        hardware: [
          ...(structuralScrewHardware
            ? [{ ...structuralScrewHardware, quantity: Math.min(structuralScrewHardware.quantity, 12) }]
            : []),
          ...(wallAnchorHardware ? [wallAnchorHardware] : [])
        ]
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
        const isDrawerPart = p.resolvedRole.startsWith('drawer_') || nameLower.includes('caj');
        return !isDrawerPart && p.thickness <= 3 && p.worldBounds.spanX * p.worldBounds.spanY > 80000;
      })
    );

    if (backPieces.length > 0) {
      const nailHardware = hardwareKit.find(h => h.id === 'nail_back_panel');
      const hasVentilatedNicheOpening =
        backPieces.length > 1 ||
        pieces.some(p => p.name.toLowerCase().includes('nicho'));
      const step2Tips = [
        'La verificación de diagonales cruzadas (D1 = D2) es indispensable para que los cajones y puertas cierren perfectamente sin rozar.',
        'Clave primero las 4 esquinas del fondo para bloquear la escuadra y luego complete el clavado perimetral cada 150 mm.'
      ];
      if (hasVentilatedNicheOpening) {
        step2Tips.push(
          'Ventilación Nicho Electrodoméstico: Deje abierto el vano trasero detrás del nicho para disipación térmica del equipo y paso del cableado.'
        );
      }

      steps.push({
        stepNumber: stepNum++,
        titleKey: 'assemblyGuide.step2Title',
        defaultTitle: 'Paso 2 — Escuadrado y Fijación del Fondo Trasero',
        descriptionKey: 'assemblyGuide.step2Desc',
        defaultDescription:
          'Recueste el casco boca abajo sobre el suelo. Mida con el flexómetro ambas diagonales cruzadas (D1 y D2); ambas deben medir exactamente lo mismo (tolerancia 0 mm) para garantizar que el mueble esté a 90°. Presente el tablero trasero de 3 mm y fíjelo con puntillas o tornillos cada 150 mm alrededor de todo el perímetro.',
        tips: step2Tips,
        actionType: 'back',
        partCodes: backPieces.map(p => p.code),
        cumulativePriorPartCodes: [],
        parts: backPieces,
        hardware: nailHardware ? [nailHardware] : []
      });
    }

    // =========================================================================
    // PASO 3: Instalación de Divisiones, Repisas, Zapateros y Nichos Interiores
    // =========================================================================
    const step3Pieces = markAssigned(
      pieces.filter(p => {
        if (assignedCodes.has(p.code)) return false;
        if (this.isDrawerPiece(p)) return false;
        if (p.resolvedRole === 'shelf' || p.resolvedRole === 'divider') return true;
        if (isStep3NicheOrShoeTie(p)) return true;
        return p.resolvedRole === 'free' && p.worldBounds.cz <= centerZ + 0.5;
      })
    );

    if (step3Pieces.length > 0) {
      const pinHardware = hardwareKit.find(h => h.id === 'shelf_pins');
      const shoeStopHardware = hardwareKit.find(h => h.id === 'shoe_stop_aluminum');
      const hasMovableShelf = step3Pieces.some(p => {
        if (p.resolvedRole !== 'shelf') return false;
        const hc = p.part.hardwareConfig;
        if (hc?.isStructuralFixedShelf || hc?.shoeRackAngleDeg !== undefined) return false;
        if (hc?.isMovableShelf === false) return false;
        return true;
      });
      const hasFixedShelf = step3Pieces.some(
        p =>
          p.resolvedRole === 'shelf' &&
          p.part.hardwareConfig?.isStructuralFixedShelf &&
          !p.name.toLowerCase().includes('nicho')
      );
      const shoeRackPiece = step3Pieces.find(
        p => p.part.hardwareConfig?.shoeRackAngleDeg !== undefined
      );
      const hasApplianceNiche = step3Pieces.some(p =>
        p.name.toLowerCase().includes('nicho')
      );

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

      const step3Tips = [
        'Verifique la horizontalidad de cada repisa con un nivel de mano antes de cargar peso.',
        'En repisas móviles, el borde frontal con tapacanto grueso o delgado siempre debe mirar hacia afuera.'
      ];
      if (hasFixedShelf) {
        step3Tips.push(
          'Repisas Fijas Estructurales: Atornille directamente desde los laterales o con minifix a tope (sin soportes móviles).'
        );
      }
      if (shoeRackPiece) {
        const angle = shoeRackPiece.part.hardwareConfig?.shoeRackAngleDeg ?? 15;
        step3Tips.push(
          `Zapatero Inclinado (${angle}°): Presente las bandejas inclinadas con ayuda de plantilla de ángulo y atornille el tope frontal antes del ajuste final.`
        );
      }
      if (hasApplianceNiche) {
        step3Tips.push(
          'Nicho Electrodoméstico: Fije el entrepaño inferior reforzado directamente a los costados con tornillos 4.0 × 50 mm y asegure la salida de ventilación trasera.'
        );
      }

      steps.push({
        stepNumber: stepNum++,
        titleKey: 'assemblyGuide.step3Title',
        defaultTitle: 'Paso 3 — Instalación de Divisiones y Repisas Internas',
        descriptionKey: 'assemblyGuide.step3Desc',
        defaultDescription:
          'Si el módulo posee divisores verticales, fíjelos primero a la base y techo mediante tornillos estructurales. Luego inserte los 4 soportes/pines cilíndricos a la misma altura en los orificios de ambos laterales y asiente con suavidad cada repisa móvil o fije las repisas estructurales, zapateros y nichos.',
        tips: step3Tips,
        actionType: 'shelves',
        partCodes: step3Pieces.map(p => p.code),
        cumulativePriorPartCodes: [],
        parts: step3Pieces,
        hardware: [
          ...(hasMovableShelf && pinHardware ? [pinHardware] : []),
          ...(shoeStopHardware ? [shoeStopHardware] : [])
        ],
        measurements: measurements.length > 0 ? measurements : undefined
      });
    }

    // =========================================================================
    // PASO 4: Fijación de Correderas y Armado de Cajones (Con división sub-ensamble si aplica)
    // =========================================================================
    const drawerPieces = markAssigned(pieces.filter(p => !assignedCodes.has(p.code) && this.isDrawerPiece(p)));

    if (drawersCount > 0 || drawerPieces.length > 0) {
      const effectiveDrawersCount = Math.max(1, drawersCount);
      const slideHardwareList = hardwareKit.filter(h => h.type === 'drawer_slide');
      const smallScrewHardware = hardwareKit.find(h => h.id === 'screw_hardware_15');
      const structuralScrewHardware = hardwareKit.find(h => h.id === 'screw_structural_50');
      const hasUndermountSlides =
        slideHardwareList.some(h => h.id === 'undermount_slides') ||
        drawerPieces.some(p => p.part.hardwareConfig?.slideType === 'undermount');
      const hasTelescopicSlides = slideHardwareList.some(h => h.id === 'telescopic_slides');
      const hasInternalDrawers = drawerPieces.some(
        p =>
          Boolean(p.part.hardwareConfig?.isInternalDrawerFront) ||
          p.name.toLowerCase().includes('cajón interno')
      );

      const sidePart = pieces.find(p => p.resolvedRole === 'side_left' || p.resolvedRole === 'side_right');
      const sideMinY = sidePart ? sidePart.worldBounds.minY : minY;

      const boxPieces = drawerPieces.filter(
        p =>
          p.resolvedRole === 'drawer_box' ||
          p.resolvedRole === 'drawer_lateral' ||
          p.resolvedRole === 'drawer_bottom'
      );
      const boxCodeSet = new Set(boxPieces.map(p => p.code));
      const mountPieces = drawerPieces.filter(p => !boxCodeSet.has(p.code));

      const shouldSplitDrawerSubassembly =
        effectiveDrawersCount >= 2 && drawerPieces.length > 8 && boxPieces.length > 0;

      if (shouldSplitDrawerSubassembly) {
        const totalBoxUnits = drawerSubassemblies.reduce((sum, s) => sum + s.repeatCount, 0);
        const summaryLabels = drawerSubassemblies
          .map(s => `${s.label} (ARMAR ×${s.repeatCount} JUEGOS IGUALES)`)
          .join(' · ');
        const subassemblyDesc =
          drawerSubassemblies.length <= 1
            ? `Arme sobre banco ${summaryLabels || `ARMAR ×${effectiveDrawersCount} JUEGOS IGUALES`} antes de montarlos en el casco. Una los laterales al contrafrente y trasera con tornillos estructurales 4.0 × 50 mm, verifique las diagonales a escuadra (90°) y asegure el fondo de 3 mm.`
            : `Arme en mesa de trabajo las ${totalBoxUnits} cajas repetidas agrupadas por medida (${summaryLabels}) antes de instalarlas en el casco. Ensamble laterales, contrafrente y trasera a escuadra y fije el fondo de 3 mm.`;

        steps.push({
          stepNumber: stepNum++,
          titleKey: 'assemblyGuide.stepDrawerSubassemblyTitle',
          defaultTitle: 'Paso 4A — Armado de Caja de Cajón Típica (Zoom Sub-ensamble)',
          descriptionKey: 'assemblyGuide.stepDrawerSubassemblyDesc',
          defaultDescription: subassemblyDesc,
          tips: [
            'Arme todas las cajas idénticas en serie sobre una superficie plana y verifique que ambas diagonales de cada caja midan exactamente lo mismo (escuadra 90°).',
            'Encaje o atornille el fondo de 3 mm para bloquear la escuadra antes de fijar el tramo móvil de la corredera.',
            'Reserve los frentes vistos exteriores para el siguiente paso de montaje en el casco y calibración de holguras.'
          ],
          actionType: 'drawer_subassembly',
          renderMode: 'subassembly_zoom',
          partCodes: boxPieces.map(p => p.code),
          cumulativePriorPartCodes: [],
          parts: boxPieces,
          subassemblyData: drawerSubassemblies,
          pieceGroupsSummary: this.buildPieceGroupsSummary(boxPieces),
          hardware: structuralScrewHardware
            ? [{ ...structuralScrewHardware, quantity: Math.max(8, effectiveDrawersCount * 8) }]
            : []
        });

        const mountMeasurements: AssemblyStepMeasurement[] = [];
        if (drawerClusters.length > 0) {
          for (const cluster of drawerClusters) {
            const frontRef = cluster.frontPiece ? ` (${cluster.frontPiece.code})` : '';
            mountMeasurements.push({
              label: `${cluster.label}${frontRef} — Eje Central Riel`,
              valueMm: cluster.railElevationMm,
              referenceText: 'Medido desde el canto inferior del lateral del mueble'
            });
          }
        } else {
          const plinthH = paramConfig?.plinthHeight || 70;
          const innerH = Math.max(300, params.height - plinthH - 36);
          const slotH = innerH / effectiveDrawersCount;
          for (let i = 0; i < effectiveDrawersCount; i++) {
            mountMeasurements.push({
              label: `Cajón ${i + 1} — Eje Central Riel`,
              valueMm: Math.max(40, Math.round(plinthH + 18 + 40 + i * slotH)),
              referenceText: 'Medido desde el canto inferior del lateral del mueble'
            });
          }
        }

        const mountGroupsSummary = this.buildPieceGroupsSummary(mountPieces);
        const hasRepeatedMountGroups = mountGroupsSummary.some(g => g.quantity > 1);
        const mountTips: string[] = [];
        if (hasTelescopicSlides || !hasUndermountSlides) {
          mountTips.push(
            'Deje una holgura libre de 13 mm a cada lado entre la caja del cajón y el costado interior del módulo (26 mm de descuento total).'
          );
        }
        if (hasUndermountSlides) {
          mountTips.push(
            'Correderas Ocultas Cierre Suave: Fije los clips de desacople bajo el fondo del cajón manteniendo 5 mm de holgura lateral y 14 mm bajo la base.'
          );
        }
        if (hasInternalDrawers) {
          mountTips.push(
            'Cajonera Interna tras Puerta: Instale las correderas sobre la cara interior de las regletas de bisagra manteniendo un remetido frontal mínimo de 22 mm.'
          );
        }
        mountTips.push(
          'Atornille los rieles en los agujeros rasgados para permitir micro-ajustes de nivelación antes del apriete final.',
          'Utilice separadores calibrados de 2 a 3 mm entre frentes vistos antes de atornillar definitivamente desde el interior.'
        );

        steps.push({
          stepNumber: stepNum++,
          titleKey: 'assemblyGuide.step4CarcassMountTitle',
          defaultTitle: 'Paso 4B — Fijación de Correderas y Montaje de Cajones',
          descriptionKey: 'assemblyGuide.step4CarcassMountDesc',
          defaultDescription:
            'Atornille los rieles fijos al costado interior o regleta del casco en las cotas de altura indicadas, acople las cajas ya armadas y fije los frentes manteniendo una luz uniforme de 2 a 3 mm.',
          tips: mountTips,
          actionType: 'drawers',
          renderMode: 'carcass_mount',
          partCodes: mountPieces.map(p => p.code),
          cumulativePriorPartCodes: [],
          parts: mountPieces,
          compactCallouts: drawerClusters.map(c => this.buildDrawerUnitCallout(c)),
          ...(mountPieces.length > 6 || hasRepeatedMountGroups
            ? { pieceGroupsSummary: mountGroupsSummary }
            : {}),
          hardware: [
            ...slideHardwareList,
            ...(smallScrewHardware ? [{ ...smallScrewHardware, quantity: effectiveDrawersCount * 8 }] : [])
          ],
          measurements: mountMeasurements
        });
      } else {
        // Calcular cotas exactas de riel telescópico desde la base inferior del lateral
        const measurements: AssemblyStepMeasurement[] = [];
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

        const hasDrawerGola = drawerPieces.some(
          p =>
            p.part.hardwareConfig?.openingSystem === 'gola' ||
            p.part.hardwareConfig?.drawerOpeningSystem === 'gola' ||
            p.part.hardwareConfig?.handleType === 'gola_less'
        );
        const hasDrawerFingerPull = drawerPieces.some(
          p =>
            p.part.hardwareConfig?.openingSystem === 'finger_pull' ||
            p.part.hardwareConfig?.drawerOpeningSystem === 'finger_pull' ||
            p.part.hardwareConfig?.handleType === 'finger_pull'
        );
        const hasDrawerPush = drawerPieces.some(
          p =>
            p.part.hardwareConfig?.openingSystem === 'push' ||
            p.part.hardwareConfig?.drawerOpeningSystem === 'push' ||
            p.part.hardwareConfig?.slideType === 'push_open'
        );

        const step4Tips = [
          'Cada cajón está conformado por 5 piezas: 2 costados de cajón, 1 contrafrente interior, 1 trasera interior, 1 fondo de 3 mm y 1 frente visto.'
        ];
        if (hasTelescopicSlides || !hasUndermountSlides) {
          step4Tips.push(
            'Deje una holgura libre de 13 mm a cada lado entre la caja del cajón y el costado interior del módulo (26 mm de descuento total).'
          );
        }
        if (hasUndermountSlides) {
          step4Tips.push(
            'Correderas Ocultas Cierre Suave: Deje 5 mm de holgura por lado y 14 mm bajo la base para montar los clips de desacople 3D.'
          );
        }
        if (hasInternalDrawers) {
          step4Tips.push(
            'Cajonera Interna tras Puerta: Fije los rieles sobre las regletas paso bisagra dejando al menos 22 mm de remetido frontal respecto al plano de la puerta.'
          );
        }
        step4Tips.push(
          'Atornille los rieles en los agujeros rasgados para permitir micro-ajustes de nivelación antes del apriete final.'
        );
        if (hasDrawerGola) {
          step4Tips.push(
            'Sistema Gola en Cajones: Verifique la luz de 26 mm sobre cada frente para encajar el perfil Gola horizontal continuo.'
          );
        }
        if (hasDrawerFingerPull) {
          step4Tips.push(
            'Uñero Corte a 45°: Oriente el bisel superior del frente vista hacia el interior para permitir la toma ergonómica de dedos.'
          );
        }
        if (hasDrawerPush) {
          step4Tips.push(
            'Correderas Push-to-Open: Ajuste la profundidad del riel para dejar 2–3 mm de recorrido de activación por presión.'
          );
        }

        steps.push({
          stepNumber: stepNum++,
          titleKey: 'assemblyGuide.step4Title',
          defaultTitle: 'Paso 4 — Fijación de Correderas y Armado de Cajones',
          descriptionKey: 'assemblyGuide.step4Desc',
          defaultDescription:
            'Atornille el tramo exterior de las correderas al costado del mueble o regleta en las cotas de altura indicadas. Ensamble las cajas de cajón uniendo los costados al frente y trasera con tornillos de ensamble, encaje el fondo de 3 mm en la ranura y acople los frentes.',
          tips: step4Tips,
          actionType: 'drawers',
          renderMode: 'full_progress',
          partCodes: drawerPieces.map(p => p.code),
          cumulativePriorPartCodes: [],
          parts: drawerPieces,
          hardware: [
            ...slideHardwareList,
            ...(smallScrewHardware ? [{ ...smallScrewHardware, quantity: effectiveDrawersCount * 8 }] : [])
          ],
          measurements
        });
      }
    }

    // =========================================================================
    // PASO 5: Montaje de Bisagras, Pistones, Puertas, Frentes y Piezas Exteriores
    // =========================================================================
    const step5Pieces = markAssigned(pieces.filter(p => !assignedCodes.has(p.code)));

    if (doorsCount > 0 || step5Pieces.length > 0) {
      const hingeHardware = hardwareKit.find(h => h.id === 'cup_hinges');
      const pistonHardware = hardwareKit.find(h => h.id === 'piston_gas_pair');
      const compasHardware = hardwareKit.find(h => h.id === 'compas_abatible');
      const slidingHardware = hardwareKit.find(h => h.id === 'sliding_closet_kit');
      const vitrinaHardware = hardwareKit.find(h => h.id === 'vitrina_hardware');
      const handleHardware = hardwareKit.find(h => h.id === 'handles_knobs');
      const smallScrewHardware = hardwareKit.find(h => h.id === 'screw_hardware_15');
      const pushDoorHardware = hardwareKit.find(h => h.id === 'push_door_pistons');
      const golaHardware = hardwareKit.find(h => h.id === 'gola_profiles');
      const concealedHangerHardware = hardwareKit.find(h => h.id === 'wall_concealed_hangers');
      const legsHardware = hardwareKit.find(h => h.id === 'cabinet_legs');
      const rodHardware = hardwareKit.find(h => h.id === 'closet_hanging_rod');

      const hasDoors = doorsCount > 0;
      const hasGola = Boolean(golaHardware);
      const hasFingerPullDoor = step5Pieces.some(
        p =>
          p.resolvedRole === 'door' &&
          (p.part.hardwareConfig?.openingSystem === 'finger_pull' ||
            p.part.hardwareConfig?.handleType === 'finger_pull')
      );
      const hasPushDoor = Boolean(pushDoorHardware);
      const hasConcealedHangers = Boolean(concealedHangerHardware);
      const hasLegs = Boolean(legsHardware);
      const hasFillerStrips = step5Pieces.some(p => Boolean(p.part.hardwareConfig?.isFillerStrip));

      const step5Tips: string[] = hasDoors
        ? [
            'Tornillo 1 (Frontal): Regula la separación lateral entre puertas (luz central de 2 a 3 mm).',
            'Tornillo 2 (Profundidad): Acerca o aleja la puerta del casco para que cierre al ras sin golpear.',
            'Tornillo 3 (Placa base): Ajusta la altura vertical de la puerta para nivelarla con los bordes superior e inferior.'
          ]
        : [
            'Asegure todos los accesorios, patas niveladoras, regletas de ajuste o colgadores antes de ubicar el módulo en su posición definitiva.'
          ];
      if (pistonHardware) {
        step5Tips.push(
          'Pistones a Gas: Instale las bases internas en ambos costados (15 mm hacia adentro, 120 mm bajo el techo) y enganche el brazo neumático en la cara interior de la puerta a 130 mm del borde superior para apertura asistida de 80°.'
        );
      }
      if (compasHardware) {
        step5Tips.push(
          'Compás Abatible Inferior: Fije primero las bisagras en el borde inferior y regule la tensión del compás lateral para una caída controlada a 90°.'
        );
      }
      if (slidingHardware) {
        step5Tips.push(
          'Puertas Corredizas: Atornille perfectamente nivelados el riel superior e inferior, cuelgue primero las hojas traseras y ajuste los excéntricos de altura en los carros.'
        );
      }
      if (vitrinaHardware) {
        step5Tips.push(
          'Puertas Vitrina Aluminio + Vidrio: Use bisagras específicas para perfil de aluminio y proteja los cantos del vidrio templado antes del ajuste final.'
        );
      }
      if (hasPushDoor) {
        step5Tips.push(
          'Expulsores Push-to-Open: Fije el cuerpo del expulsor frente al borde de apertura opuesto a las bisagras y regule la punta roscada para lograr 2 mm de presión.'
        );
      }
      if (hasFingerPullDoor) {
        step5Tips.push(
          'Uñero Corte a 45°: Revise que el canto superior biselado a 45° quede libre y con tapacanto sellado.'
        );
      }
      if (hasGola) {
        step5Tips.push(
          'Perfil Gola: Presente e inserte el perfil metálico horizontal en la luz de 26 mm asegurando fijación a escuadra en los laterales.'
        );
      }
      if (hasFillerStrips) {
        step5Tips.push(
          'Regletas de Ajuste a Muro: Cepille o ajuste la regleta lateral copiando el plomo real de la pared y fíjela desde el interior del casco hacia afuera sin perforar la cara vista.'
        );
      }
      if (hasConcealedHangers) {
        step5Tips.push(
          'Colgadores Ocultos: Atornille las cajas en las esquinas superiores interiores del casco y enganche sobre las platinas niveladas en el muro.'
        );
      }
      if (hasLegs) {
        step5Tips.push(
          'Patas del Mueble: Fije las platinas en la cara inferior del piso estructural y regule con nivel de burbuja una vez apoyado el módulo.'
        );
      }

      steps.push({
        stepNumber: stepNum++,
        titleKey: hasDoors ? 'assemblyGuide.step5Title' : 'assemblyGuide.step5HardwareTitle',
        defaultTitle: hasDoors
          ? 'Paso 5 — Montaje de Bisagras, Puertas y Complementos'
          : 'Paso 5 — Herrajes, Complementos y Montaje Final',
        descriptionKey: hasDoors ? 'assemblyGuide.step5Desc' : 'assemblyGuide.step5HardwareDesc',
        defaultDescription: hasDoors
          ? 'Inserte las cazoletas de 35 mm en las perforaciones de la puerta o fije los carros del sistema corredizo, cuelgue cada hoja y realice la calibración fina de luces (2–3 mm). Instale compases, pistones, tiradores y regletas de ajuste lateral.'
          : 'Fije los complementos de soporte, patas niveladoras, regletas de ajuste lateral, colgadores ocultos, barras colgadoras o perfiles indicados antes de instalar el módulo en su ubicación final.',
        tips: step5Tips,
        actionType: 'doors',
        partCodes: step5Pieces.map(p => p.code),
        cumulativePriorPartCodes: [],
        parts: step5Pieces,
        hardware: [
          ...(hingeHardware ? [hingeHardware] : []),
          ...(pistonHardware ? [pistonHardware] : []),
          ...(compasHardware ? [compasHardware] : []),
          ...(slidingHardware ? [slidingHardware] : []),
          ...(vitrinaHardware ? [vitrinaHardware] : []),
          ...(pushDoorHardware ? [pushDoorHardware] : []),
          ...(golaHardware ? [golaHardware] : []),
          ...(concealedHangerHardware ? [concealedHangerHardware] : []),
          ...(legsHardware ? [legsHardware] : []),
          ...(rodHardware ? [rodHardware] : []),
          ...(smallScrewHardware && hingeHardware ? [{ ...smallScrewHardware, quantity: hingeHardware.quantity * 4 }] : []),
          ...(handleHardware ? [handleHardware] : [])
        ]
      });
    }

    // Asignar códigos acumulados estrictamente previos (pasos 1 .. stepNumber - 1) y resumen en pasos densos
    const cumulativePrior: string[] = [];
    for (const step of steps) {
      step.cumulativePriorPartCodes = [...cumulativePrior];
      cumulativePrior.push(...step.partCodes);
      if (!step.pieceGroupsSummary && step.parts.length > 6) {
        step.pieceGroupsSummary = this.buildPieceGroupsSummary(step.parts);
      }
    }

    return steps;
  }
}
