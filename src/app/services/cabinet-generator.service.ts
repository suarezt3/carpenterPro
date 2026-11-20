import { inject, Injectable } from '@angular/core';
import {
  CabinetBaseType,
  CabinetGolaFinish,
  CabinetInstallationType,
  CabinetLegStyle,
  CabinetOpeningSystem,
  CabinetRodFinish,
  CabinetWallMountType,
  CabinetZoneContent,
  CabinetZoneDoorConfig,
  CabinetZoneDrawerConfig,
  CabinetZoneHighlightBox,
  CabinetZoneLayoutNode,
  CabinetZoneNode,
  ComponentRole,
  DoorHandleVerticalPosition,
  DrawerOpeningSystem,
  FurnitureModule,
  HandleFinish,
  HandleType,
  HingeType,
  isCountertopMaterial,
  isPartParametricGenerated,
  Material,
  ParametricCabinetConfig,
  Part,
  PartCornerCutConfig,
  PartGroup,
  PartHardwareConfig,
  SlideType
} from '../models/melamine.models';
import { PartGeometryService } from './part-geometry.service';
import type { FurnitureTemplate } from './templates-catalog.service';

interface ZoneCarcassFrame {
  w: number;
  h: number;
  d: number;
  t: number;
  doorT: number;
  backT: number;
  gap: number;
  installationType: CabinetInstallationType;
  wallMountType?: CabinetWallMountType;
  cleatPocket: number;
  preNailerMinZ: number;
  baseType: CabinetBaseType;
  plinthH: number;
  sideH: number;
  posX: number;
  posY: number;
  posZ: number;
  carcassDepth: number;
  carcassCenterZ: number;
  carcassBackZ: number;
  carcassFrontZ: number;
  bottomOfCarcassY: number;
  sideCenterY: number;
  topY: number;
  innerWidth: number;
  hasTopStructure: boolean;
  topTieStrips: boolean;
  includeBack: boolean;
  effectiveBackType: 'groove' | 'rebate' | 'overlay' | 'none';
  zoneMinZ: number;
  rootInnerMinY: number;
  rootInnerMaxY: number;
}

interface AutoZoneSignature {
  shelves: number;
  drawers: number;
  doorOpening: string;
  rods: number;
  plinth: boolean;
  tieStrips: boolean;
  moduleType: string;
  split: 'none' | 'horizontal' | 'vertical';
}

function deepCloneZoneNode(node: CabinetZoneNode): CabinetZoneNode {
  return {
    ...node,
    content: node.content
      ? {
          ...node.content,
          drawers: node.content.drawers ? { ...node.content.drawers } : undefined,
          doors: node.content.doors ? { ...node.content.doors } : undefined
        }
      : undefined,
    children: node.children ? node.children.map(child => deepCloneZoneNode(child)) : undefined
  };
}

const VALID_DRAWER_SLIDE_TYPES: ReadonlySet<Exclude<SlideType, 'none'>> = new Set([
  'telescopic',
  'soft_close',
  'telescopic_35',
  'undermount',
  'push_open'
]);

const VALID_HINGE_TYPES: ReadonlySet<HingeType> = new Set([
  'straight',
  'half_cranked',
  'full_cranked',
  'corner_45',
  'corner_165',
  'gas_piston',
  'none'
]);

function resolveValidDrawerSlideType(raw: string | undefined): Exclude<SlideType, 'none'> {
  if (raw && VALID_DRAWER_SLIDE_TYPES.has(raw as Exclude<SlideType, 'none'>)) {
    return raw as Exclude<SlideType, 'none'>;
  }
  return 'telescopic';
}

function resolveValidHingeType(raw: string | undefined): HingeType | undefined {
  if (raw && VALID_HINGE_TYPES.has(raw as HingeType)) {
    return raw as HingeType;
  }
  return undefined;
}

function isNonPhysicalHandleType(ht: HandleType | undefined): boolean {
  return (
    ht === 'none' ||
    ht === 'push' ||
    ht === 'push_open' ||
    ht === 'gola_less' ||
    ht === 'gola' ||
    ht === 'finger_pull'
  );
}

function resolveOpeningSystemFromHandle(
  handleType: HandleType | undefined,
  hasHandle?: boolean,
  slideType?: SlideType | string
): CabinetOpeningSystem {
  if (handleType === 'gola_less' || handleType === 'gola') {
    return 'gola';
  }
  if (handleType === 'finger_pull') {
    return 'finger_pull';
  }
  if (slideType === 'push_open' || handleType === 'push' || handleType === 'push_open') {
    return 'push';
  }
  if (hasHandle === false) {
    return 'push';
  }
  return 'handle';
}

function resolveGolaColorHex(finish: CabinetGolaFinish | undefined): string {
  switch (finish) {
    case 'matte_black':
      return '#18181b';
    case 'white':
      return '#f8fafc';
    case 'champagne':
      return '#d6c7a9';
    case 'natural_aluminum':
    default:
      return '#d4d4d8';
  }
}

function resolveGolaFinishLabel(finish: CabinetGolaFinish | undefined): string {
  switch (finish) {
    case 'matte_black':
      return 'Negro Mate';
    case 'white':
      return 'Blanco';
    case 'champagne':
      return 'Champagne';
    case 'natural_aluminum':
    default:
      return 'Aluminio Natural';
  }
}

function resolveRodStyleSpec(finish: CabinetRodFinish | undefined): {
  materialId: string;
  materialName: string;
  partNameBase: string;
  colorHex: string;
  finish: CabinetRodFinish;
} {
  switch (finish) {
    case 'matte_black':
      return {
        materialId: 'hw_rod_matte_black',
        materialName: 'Barra Colgadora Negro Mate',
        partNameBase: 'Barra Colgadora (Negro Mate)',
        colorHex: '#18181b',
        finish: 'matte_black'
      };
    case 'gold':
      return {
        materialId: 'hw_rod_gold',
        materialName: 'Barra Colgadora Dorada',
        partNameBase: 'Barra Colgadora (Dorada)',
        colorHex: '#d97706',
        finish: 'gold'
      };
    case 'chrome':
    default:
      return {
        materialId: 'hw_rod_chrome',
        materialName: 'Tubo Oval Cromado',
        partNameBase: 'Barra Colgadora (Cromada)',
        colorHex: '#94a3b8',
        finish: 'chrome'
      };
  }
}

function resolveLegStyleSpec(style: CabinetLegStyle | undefined): {
  style: CabinetLegStyle;
  materialId: string;
  materialName: string;
  partLabel: string;
  colorHex: string;
} {
  switch (style) {
    case 'black_leveler':
      return {
        style: 'black_leveler',
        materialId: 'hw_leg_black_leveler',
        materialName: 'Pata Niveladora Negra',
        partLabel: 'Pata Niveladora Negra',
        colorHex: '#18181b'
      };
    case 'scandinavian_wood':
      return {
        style: 'scandinavian_wood',
        materialId: 'hw_leg_scandinavian_wood',
        materialName: 'Pata Nórdica Madera',
        partLabel: 'Pata Nórdica Madera',
        colorHex: '#c29b68'
      };
    case 'hairpin_metal':
      return {
        style: 'hairpin_metal',
        materialId: 'hw_leg_hairpin_metal',
        materialName: 'Pata Horquilla Metálica',
        partLabel: 'Pata Horquilla Metálica',
        colorHex: '#27272a'
      };
    case 'cylindrical_inox':
    default:
      return {
        style: 'cylindrical_inox',
        materialId: 'hw_leg_inox',
        materialName: 'Pata Cilíndrica Inox',
        partLabel: 'Pata Cilíndrica Inox',
        colorHex: '#94a3b8'
      };
  }
}

function isCabinetLegPart(part: Part): boolean {
  const matId = part.materialId || '';
  const lowerName = (part.name || '').toLowerCase();
  return (
    part.componentRole === 'accessory' &&
    (Boolean(part.hardwareConfig?.legStyle) ||
      matId.startsWith('hw_leg_') ||
      lowerName.includes('pata'))
  );
}

function isCabinetRodPart(part: Part): boolean {
  if (isCabinetLegPart(part)) return false;
  const matId = part.materialId || '';
  const lowerName = (part.name || '').toLowerCase();
  const lowerNotes = (part.notes || '').toLowerCase();
  return (
    Boolean(part.hardwareConfig?.rodFinish) ||
    matId.startsWith('hw_rod_') ||
    lowerName.includes('tubo colgador') ||
    lowerName.includes('barra colgadora') ||
    lowerNotes.includes('colgado')
  );
}

function inferLegStyleFromPart(part: Part): CabinetLegStyle {
  if (part.hardwareConfig?.legStyle) {
    return part.hardwareConfig.legStyle;
  }
  const matId = part.materialId || '';
  const lower = (part.name || '').toLowerCase();
  if (matId === 'hw_leg_black_leveler' || lower.includes('niveladora negra')) {
    return 'black_leveler';
  }
  if (matId === 'hw_leg_scandinavian_wood' || lower.includes('nórdica') || lower.includes('nordica')) {
    return 'scandinavian_wood';
  }
  if (matId === 'hw_leg_hairpin_metal' || lower.includes('horquilla')) {
    return 'hairpin_metal';
  }
  return 'cylindrical_inox';
}

function inferRodFinishFromPart(part: Part): CabinetRodFinish {
  if (part.hardwareConfig?.rodFinish) {
    return part.hardwareConfig.rodFinish;
  }
  const matId = part.materialId || '';
  const lower = (part.name || '').toLowerCase();
  if (matId === 'hw_rod_matte_black' || lower.includes('negro mate')) {
    return 'matte_black';
  }
  if (matId === 'hw_rod_gold' || lower.includes('dorada') || lower.includes('dorado')) {
    return 'gold';
  }
  return 'chrome';
}

function isSlidingDoorPart(part: Part): boolean {
  const nameLower = (part.name || '').toLowerCase();
  const notesLower = (part.notes || '').toLowerCase();
  return (
    nameLower.includes('corrediz') ||
    notesLower.includes('corrediz') ||
    notesLower.includes('riel')
  );
}

function pickDominantString<T extends string>(values: readonly (T | undefined)[]): T | undefined {
  const counts = new Map<T, number>();
  let bestVal: T | undefined;
  let bestCount = 0;
  for (const val of values) {
    if (!val) continue;
    const next = (counts.get(val) ?? 0) + 1;
    counts.set(val, next);
    if (next > bestCount) {
      bestCount = next;
      bestVal = val;
    }
  }
  return bestVal;
}

function pickDominantNumber(values: readonly (number | undefined)[]): number | undefined {
  const counts = new Map<number, number>();
  let bestVal: number | undefined;
  let bestCount = 0;
  for (const val of values) {
    if (val === undefined || !Number.isFinite(val)) continue;
    const next = (counts.get(val) ?? 0) + 1;
    counts.set(val, next);
    if (next > bestCount) {
      bestCount = next;
      bestVal = val;
    }
  }
  return bestVal;
}

function resolvePartOpeningSystem(
  hw: PartHardwareConfig | undefined,
  slideTypeOverride?: string
): CabinetOpeningSystem | undefined {
  if (!hw) return undefined;
  const ht = hw.handleType;
  if (ht === 'gola_less' || ht === 'gola') return 'gola';
  if (ht === 'finger_pull') return 'finger_pull';
  if (ht === 'push' || ht === 'push_open' || slideTypeOverride === 'push_open') return 'push';
  if (ht && !isNonPhysicalHandleType(ht)) return 'handle';
  if (hw.openingSystem) return hw.openingSystem;
  if (hw.drawerOpeningSystem) return hw.drawerOpeningSystem;
  if (ht === 'none') return 'push';
  return undefined;
}

function computeChildZoneSpans(
  totalParentSpan: number,
  dividerThickness: number,
  children: readonly CabinetZoneNode[]
): number[] {
  const count = children.length;
  if (count === 0) return [];
  if (count === 1) return [Math.max(20, Math.round(totalParentSpan * 10) / 10)];

  const availableSpan = Math.max(20 * count, totalParentSpan - (count - 1) * dividerThickness);
  const fixedIndices: number[] = [];
  const flexIndices: number[] = [];

  for (let i = 0; i < count; i++) {
    const exact = Number(children[i].exactSizeMm);
    if (Number.isFinite(exact) && exact > 0) {
      fixedIndices.push(i);
    } else {
      flexIndices.push(i);
    }
  }

  const spans = new Array<number>(count).fill(0);
  let sumFixed = 0;
  for (const idx of fixedIndices) {
    const raw = Math.max(20, Number(children[idx].exactSizeMm));
    spans[idx] = raw;
    sumFixed += raw;
  }

  if (flexIndices.length === 0) {
    if (Math.abs(sumFixed - availableSpan) <= 0.1) {
      return spans.map(s => Math.round(s * 10) / 10);
    }
    const scale = availableSpan / Math.max(1, sumFixed);
    let running = 0;
    for (let i = 0; i < count - 1; i++) {
      spans[i] = Math.max(20, Math.round(spans[i] * scale * 10) / 10);
      running += spans[i];
    }
    spans[count - 1] = Math.max(20, Math.round((availableSpan - running) * 10) / 10);
    return spans;
  }

  const minFlexTotal = 20 * flexIndices.length;
  if (sumFixed > availableSpan - minFlexTotal && sumFixed > 0) {
    const maxFixedBudget = Math.max(20 * fixedIndices.length, availableSpan - minFlexTotal);
    const fixedScale = maxFixedBudget / sumFixed;
    sumFixed = 0;
    for (const idx of fixedIndices) {
      spans[idx] = Math.max(20, Math.round(spans[idx] * fixedScale * 10) / 10);
      sumFixed += spans[idx];
    }
  }

  const remainingForFlex = Math.max(minFlexTotal, availableSpan - sumFixed);
  let totalRatio = 0;
  for (const idx of flexIndices) {
    const ratio = Number(children[idx].sizeRatio);
    totalRatio += Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  }
  if (totalRatio <= 0) totalRatio = flexIndices.length;

  let flexRunning = 0;
  for (let k = 0; k < flexIndices.length - 1; k++) {
    const idx = flexIndices[k];
    const ratio = Number(children[idx].sizeRatio);
    const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
    const val = Math.max(20, Math.round((remainingForFlex * (safeRatio / totalRatio)) * 10) / 10);
    spans[idx] = val;
    flexRunning += val;
  }
  const lastFlexIdx = flexIndices[flexIndices.length - 1];
  spans[lastFlexIdx] = Math.max(20, Math.round((remainingForFlex - flexRunning) * 10) / 10);

  return spans;
}

/**
 * Calcula de forma pura y determinista el árbol de cotas 3D de todas las zonas de un módulo paramétrico.
 * Convención de orden:
 * - splitDirection === 'vertical': `children[0..n-1]` de izquierda (-X) a derecha (+X).
 * - splitDirection === 'horizontal': `children[0..n-1]` de arriba (+Y) hacia abajo (-Y).
 */
export function computeZoneBoundsLayout(config: ParametricCabinetConfig): CabinetZoneLayoutNode {
  const frame = resolveZoneCarcassFrame(config);
  const rootTree: CabinetZoneNode = config.zoneTree
    ? deepCloneZoneNode(config.zoneTree)
    : buildAutoZoneTreeFromConfig(config);

  const rootMinX = frame.posX - frame.w / 2 + frame.t;
  const rootMaxX = frame.posX + frame.w / 2 - frame.t;
  const rootMinY = frame.rootInnerMinY;
  const rootMaxY = frame.rootInnerMaxY;
  const rootCoverMinX = frame.posX - frame.w / 2 + frame.gap / 2;
  const rootCoverMaxX = frame.posX + frame.w / 2 - frame.gap / 2;
  const rootCoverMinY = frame.bottomOfCarcassY + frame.gap / 2;
  const rootCoverMaxY = frame.bottomOfCarcassY + frame.sideH - frame.gap / 2;

  const buildNode = (
    node: CabinetZoneNode,
    depth: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number,
    coverMinX: number,
    coverMaxX: number,
    coverMinY: number,
    coverMaxY: number
  ): CabinetZoneLayoutNode => {
    const hasSplit =
      node.splitDirection !== 'none' &&
      Array.isArray(node.children) &&
      node.children.length > 0;
    const hasInsetDoorOnNode =
      node.content?.type === 'doors' && node.content.doors?.mount === 'inset';
    const hasSlidingInsetOnNode =
      hasInsetDoorOnNode && node.content?.doors?.opening === 'sliding';
    const hasGolaInsetOnNode =
      hasInsetDoorOnNode &&
      (node.content?.doors?.openingSystem === 'gola' ||
        node.content?.doors?.handleType === 'gola_less' ||
        node.content?.doors?.handleType === 'gola');
    const childMaxZ = hasSlidingInsetOnNode
      ? Math.max(minZ + 40, maxZ - 2 * frame.doorT - 6)
      : hasGolaInsetOnNode
        ? Math.max(minZ + 40, maxZ - Math.max(frame.doorT + 2, 26))
        : hasInsetDoorOnNode
          ? Math.max(minZ + 40, maxZ - frame.doorT - 2)
          : maxZ;

    if (!hasSplit) {
      return {
        zoneId: node.id,
        splitDirection: 'none',
        isLeaf: true,
        depth,
        minX,
        maxX,
        minY,
        maxY,
        minZ,
        maxZ,
        innerWidth: Math.max(0, Math.round((maxX - minX) * 10) / 10),
        innerHeight: Math.max(0, Math.round((maxY - minY) * 10) / 10),
        innerDepth: Math.max(0, Math.round((maxZ - minZ) * 10) / 10),
        coverMinX,
        coverMaxX,
        coverMinY,
        coverMaxY,
        content: node.content,
        children: []
      };
    }

    const rawChildren = node.children ?? [];
    const childNodes: CabinetZoneLayoutNode[] = [];

    if (node.splitDirection === 'vertical') {
      const spans = computeChildZoneSpans(maxX - minX, frame.t, rawChildren);
      let cursorX = minX;
      for (let i = 0; i < rawChildren.length; i++) {
        const cMinX = cursorX;
        const cMaxX = i === rawChildren.length - 1 ? maxX : Math.min(maxX, cursorX + spans[i]);
        const cCoverMinX = i === 0 ? coverMinX : cMinX - frame.t / 2 + frame.gap / 2;
        const cCoverMaxX = i === rawChildren.length - 1 ? coverMaxX : cMaxX + frame.t / 2 - frame.gap / 2;

        childNodes.push(
          buildNode(
            rawChildren[i],
            depth + 1,
            cMinX,
            cMaxX,
            minY,
            maxY,
            minZ,
            childMaxZ,
            cCoverMinX,
            cCoverMaxX,
            coverMinY,
            coverMaxY
          )
        );
        cursorX = cMaxX + frame.t;
      }
    } else {
      // 'horizontal': top-to-bottom (children[0] = superior, children[n-1] = inferior)
      const spans = computeChildZoneSpans(maxY - minY, frame.t, rawChildren);
      let cursorY = maxY;
      for (let i = 0; i < rawChildren.length; i++) {
        const cMaxY = cursorY;
        const cMinY = i === rawChildren.length - 1 ? minY : Math.max(minY, cursorY - spans[i]);
        const cCoverMaxY = i === 0 ? coverMaxY : cMaxY + frame.t / 2 - frame.gap / 2;
        const cCoverMinY = i === rawChildren.length - 1 ? coverMinY : cMinY - frame.t / 2 + frame.gap / 2;

        childNodes.push(
          buildNode(
            rawChildren[i],
            depth + 1,
            minX,
            maxX,
            cMinY,
            cMaxY,
            minZ,
            childMaxZ,
            coverMinX,
            coverMaxX,
            cCoverMinY,
            cCoverMaxY
          )
        );
        cursorY = cMinY - frame.t;
      }
    }

    return {
      zoneId: node.id,
      splitDirection: node.splitDirection,
      isLeaf: false,
      depth,
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      innerWidth: Math.max(0, Math.round((maxX - minX) * 10) / 10),
      innerHeight: Math.max(0, Math.round((maxY - minY) * 10) / 10),
      innerDepth: Math.max(0, Math.round((maxZ - minZ) * 10) / 10),
      coverMinX,
      coverMaxX,
      coverMinY,
      coverMaxY,
      content: node.content,
      children: childNodes
    };
  };

  return buildNode(
    rootTree,
    0,
    rootMinX,
    rootMaxX,
    rootMinY,
    rootMaxY,
    frame.zoneMinZ,
    frame.carcassFrontZ,
    rootCoverMinX,
    rootCoverMaxX,
    rootCoverMinY,
    rootCoverMaxY
  );
}

function inspectZoneFrontProjection(node: CabinetZoneNode | undefined): {
  hasOverlayFront: boolean;
  hasSlidingOverlay: boolean;
} {
  if (!node) return { hasOverlayFront: false, hasSlidingOverlay: false };
  let hasOverlayFront = false;
  let hasSlidingOverlay = false;

  const visit = (cur: CabinetZoneNode) => {
    const c = cur.content;
    if (c?.type === 'doors' && c.doors) {
      if (c.doors.opening === 'sliding' && c.doors.mount !== 'inset') {
        hasSlidingOverlay = true;
        hasOverlayFront = true;
      } else if (c.doors.mount !== 'inset') {
        hasOverlayFront = true;
      }
    } else if (c?.type === 'drawers' && c.drawers) {
      if (c.drawers.frontMount !== 'inset') {
        hasOverlayFront = true;
      }
    }
    if (cur.children) {
      for (const ch of cur.children) {
        visit(ch);
      }
    }
  };

  visit(node);
  return { hasOverlayFront, hasSlidingOverlay };
}

export function resolveInstallationType(config: ParametricCabinetConfig): CabinetInstallationType {
  if (config.installationType === 'floor' || config.installationType === 'wall') {
    return config.installationType;
  }
  if (
    config.wallMountType === 'french_cleat' ||
    config.wallMountType === 'concealed_hanger' ||
    config.wallMountType === 'direct_nailer'
  ) {
    return 'wall';
  }
  const isWallCategory =
    config.moduleType === 'wall_cabinet' ||
    config.category === 'kitchen_wall' ||
    config.category === 'bathroom_wall';
  if (isWallCategory) {
    return 'wall';
  }
  if (
    config.baseType !== 'plinth' &&
    config.baseType !== 'legs' &&
    config.hasPlinth !== true &&
    ((config.elevationY !== undefined && Number(config.elevationY) > 0) ||
      config.moduleType === 'vanity')
  ) {
    return 'wall';
  }
  return 'floor';
}

function resolveCabinetBaseType(config: ParametricCabinetConfig): CabinetBaseType {
  if (resolveInstallationType(config) === 'wall') {
    return 'none';
  }
  if (config.baseType === 'none' || config.baseType === 'plinth' || config.baseType === 'legs') {
    return config.baseType;
  }
  if (config.hasPlinth === false) {
    return 'none';
  }
  if (config.hasPlinth === true) {
    return 'plinth';
  }
  if (config.plinthHeight === 0) {
    return 'none';
  }
  return 'plinth';
}

function resolveZoneCarcassFrame(
  config: ParametricCabinetConfig,
  mainThicknessFallback = 15,
  doorThicknessFallback = 15,
  backThicknessFallback = 3
): ZoneCarcassFrame {
  const w = Math.max(150, Number(config.width) || 600);
  const h = Math.max(150, Number(config.height) || 800);
  const d = Math.max(120, Number(config.depth) || 400);
  const t = Math.max(9, Math.min(30, Number(config.structureThickness) || mainThicknessFallback));
  const doorT = Math.max(9, Math.min(30, Number(config.doorThickness) || doorThicknessFallback || t));
  const backT = Math.max(3, Number(config.backThickness) || backThicknessFallback);
  const gap = Number.isFinite(Number(config.facadeGap)) ? Math.max(1, Number(config.facadeGap)) : 3;

  const installationType = resolveInstallationType(config);
  const wallMountType: CabinetWallMountType | undefined =
    installationType === 'wall' ? (config.wallMountType ?? 'french_cleat') : undefined;
  const baseType = resolveCabinetBaseType(config);
  const plinthH =
    baseType === 'none'
      ? 0
      : baseType === 'legs'
        ? Math.max(50, Math.min(250, Number(config.plinthHeight) || 120))
        : Math.max(40, Math.min(250, Number(config.plinthHeight) || 80));

  const sideH = Math.max(80, h - plinthH);
  const posX = Number.isFinite(Number(config.posX)) ? Number(config.posX) : 0;
  const posZ = Number.isFinite(Number(config.posZ)) ? Number(config.posZ) : 0;

  let posY = config.posY;
  if (posY === undefined || !Number.isFinite(Number(posY))) {
    if (installationType === 'wall') {
      if (config.elevationY !== undefined && Number.isFinite(Number(config.elevationY))) {
        posY = Math.max(0, Number(config.elevationY)) + h / 2;
      } else if (config.moduleType === 'wall_cabinet') {
        posY = 1450 + h / 2;
      } else if (config.moduleType === 'vanity') {
        posY = 450 + h / 2;
      } else {
        posY = 1400 + h / 2;
      }
    } else {
      posY = h / 2;
    }
  } else {
    posY = Number(posY);
  }

  const frontProj = config.zoneTree
    ? inspectZoneFrontProjection(config.zoneTree)
    : {
        hasOverlayFront:
          (config.doorOpening && config.doorOpening !== 'none') ||
          ((config.drawersCount ?? 0) > 0 && config.drawerFrontType !== 'inset'),
        hasSlidingOverlay: false
      };

  const frontRecess = frontProj.hasSlidingOverlay
    ? 2 * doorT + 4
    : frontProj.hasOverlayFront
      ? doorT
      : 0;

  const carcassDepth = Math.max(80, d - frontRecess);
  const carcassCenterZ = posZ - frontRecess / 2;
  const carcassBackZ = carcassCenterZ - carcassDepth / 2;
  const carcassFrontZ = carcassCenterZ + carcassDepth / 2;

  const bottomOfCarcassY = posY - h / 2 + plinthH;
  const sideCenterY = bottomOfCarcassY + sideH / 2;
  const topY = bottomOfCarcassY + sideH - t / 2;
  const innerWidth = Math.max(40, w - 2 * t);

  const topTieStrips =
    config.topTieStrips === true ||
    (config.moduleType === 'base_cabinet' && config.hasTopCover === false);
  const hasTopStructure = topTieStrips || config.hasTopCover !== false;

  const includeBack = config.backType !== 'none' && config.hasBackPanel !== false;
  const effectiveBackType: 'groove' | 'rebate' | 'overlay' | 'none' = includeBack
    ? config.backType || 'groove'
    : 'none';

  const cleatPocket =
    installationType === 'wall' && wallMountType === 'french_cleat' ? t + 2 : 0;
  const backOriginZ = carcassBackZ + cleatPocket;

  let preNailerMinZ = backOriginZ + 2;
  if (effectiveBackType === 'groove') {
    preNailerMinZ = backOriginZ + 15 + backT + 2;
  } else if (effectiveBackType === 'rebate') {
    preNailerMinZ = backOriginZ + backT + 2;
  } else if (effectiveBackType === 'overlay' && cleatPocket > 0) {
    preNailerMinZ = backOriginZ + backT + 2;
  }

  let zoneMinZ = preNailerMinZ;
  if (installationType === 'wall' && wallMountType === 'direct_nailer') {
    zoneMinZ = preNailerMinZ + t + 2;
  } else if (installationType === 'wall' && wallMountType === 'concealed_hanger') {
    zoneMinZ = preNailerMinZ + 16;
  }
  zoneMinZ = Math.min(zoneMinZ, carcassFrontZ - 40);

  const rootInnerMinY = bottomOfCarcassY + t;
  const rootInnerMaxY = hasTopStructure ? bottomOfCarcassY + sideH - t : bottomOfCarcassY + sideH;

  return {
    w,
    h,
    d,
    t,
    doorT,
    backT,
    gap,
    installationType,
    wallMountType,
    cleatPocket,
    preNailerMinZ,
    baseType,
    plinthH,
    sideH,
    posX,
    posY,
    posZ,
    carcassDepth,
    carcassCenterZ,
    carcassBackZ,
    carcassFrontZ,
    bottomOfCarcassY,
    sideCenterY,
    topY,
    innerWidth,
    hasTopStructure,
    topTieStrips,
    includeBack,
    effectiveBackType,
    zoneMinZ,
    rootInnerMinY,
    rootInnerMaxY
  };
}

function buildAutoZoneSignature(sig: AutoZoneSignature): string {
  return `zone_auto_root__s${sig.shelves}_d${sig.drawers}_o${sig.doorOpening}_r${sig.rods}_p${sig.plinth ? 1 : 0}_t${sig.tieStrips ? 1 : 0}_m${sig.moduleType}_sp${sig.split}`;
}

function parseAutoZoneSignature(id: string): AutoZoneSignature | null {
  if (!id.startsWith('zone_auto_root__')) return null;
  const match = id.match(
    /^zone_auto_root__s(\d+)_d(\d+)_o([^_]+)_r(\d+)_p([01])_t([01])_m(.+)_sp(none|horizontal|vertical)$/
  );
  if (!match) return null;
  return {
    shelves: Number(match[1]),
    drawers: Number(match[2]),
    doorOpening: match[3],
    rods: Number(match[4]),
    plinth: match[5] === '1',
    tieStrips: match[6] === '1',
    moduleType: match[7],
    split: match[8] as 'none' | 'horizontal' | 'vertical'
  };
}

function buildAutoZoneTreeFromConfig(config: ParametricCabinetConfig): CabinetZoneNode {
  const isWall =
    config.moduleType === 'wall_cabinet' ||
    config.category === 'kitchen_wall' ||
    config.category === 'bathroom_wall';
  const isDrawerUnit =
    config.moduleType === 'drawer_unit' ||
    config.category === 'drawers' ||
    config.category === 'cajones';

  const drawersCount = isWall
    ? 0
    : Math.max(0, Math.min(6, Math.floor(Number(config.drawersCount) || (isDrawerUnit ? 3 : 0))));
  const shelvesCount = isDrawerUnit
    ? 0
    : Math.max(0, Math.min(8, Math.floor(Number(config.shelvesCount) || 0)));
  const rodsCount: 0 | 1 | 2 =
    config.hangingRodsCount === 2 ? 2 : config.hangingRodsCount === 1 ? 1 : 0;
  const doorOpening = isDrawerUnit ? 'none' : config.doorOpening || 'none';
  const hasPlinth = resolveCabinetBaseType(config) !== 'none';
  const tieStrips = Boolean(config.topTieStrips);

  // Torre de Horno + Microondas -> 4 zonas verticales ordenadas arriba -> abajo
  if (config.category === 'oven_tower') {
    const h = Math.max(400, Number(config.height) || 2150);
    const plinthH = hasPlinth ? Number(config.plinthHeight) || 80 : 0;
    const sideH = h - plinthH;
    const lowerZoneH = Math.max(480, Math.round(sideH * 0.32));
    const hasHandle = config.hasHandle !== false && config.handleType !== 'none';
    const sigId = buildAutoZoneSignature({
      shelves: shelvesCount,
      drawers: 0,
      doorOpening,
      rods: 0,
      plinth: hasPlinth,
      tieStrips,
      moduleType: config.moduleType,
      split: 'horizontal'
    });
    return {
      id: sigId,
      splitDirection: 'horizontal',
      children: [
        {
          id: 'zone_auto_tower_top',
          splitDirection: 'none',
          sizeRatio: 1,
          content: {
            type: 'doors',
            doors: {
              opening: doorOpening === 'double' ? 'double' : doorOpening === 'right' ? 'right' : 'left',
              mount: 'overlay',
              ...(config.hingeType ? { hingeType: config.hingeType } : {}),
              hasHandle,
              handleType: config.handleType || 'bar_modern',
              handleFinish: config.handleFinish || 'brushed_steel'
            }
          }
        },
        {
          id: 'zone_auto_tower_micro',
          splitDirection: 'none',
          exactSizeMm: 388,
          content: { type: 'empty' }
        },
        {
          id: 'zone_auto_tower_oven',
          splitDirection: 'none',
          exactSizeMm: 595,
          content: { type: 'empty' }
        },
        {
          id: 'zone_auto_tower_bottom',
          splitDirection: 'none',
          exactSizeMm: lowerZoneH,
          content: {
            type: 'doors',
            doors: {
              opening: doorOpening === 'double' ? 'double' : doorOpening === 'right' ? 'right' : 'left',
              mount: 'overlay',
              ...(config.hingeType ? { hingeType: config.hingeType } : {}),
              hasHandle,
              handleType: config.handleType || 'bar_modern',
              handleFinish: config.handleFinish || 'brushed_steel'
            }
          }
        }
      ]
    };
  }

  // Módulo Bajo Horno -> 2 zonas verticales: nicho de horno (arriba) + gaveta inferior (abajo)
  if (config.category === 'oven_base') {
    const hasHandle = config.hasHandle !== false && !isNonPhysicalHandleType(config.handleType);
    const resolvedOvenSlide = resolveValidDrawerSlideType(config.drawerSlideType);
    const ovenSlide: CabinetZoneDrawerConfig['slideType'] = hasHandle
      ? resolvedOvenSlide === 'push_open'
        ? 'telescopic'
        : resolvedOvenSlide
      : 'push_open';
    const sigId = buildAutoZoneSignature({
      shelves: shelvesCount,
      drawers: 0,
      doorOpening,
      rods: 0,
      plinth: hasPlinth,
      tieStrips,
      moduleType: config.moduleType,
      split: 'horizontal'
    });
    return {
      id: sigId,
      splitDirection: 'horizontal',
      children: [
        {
          id: 'zone_auto_oven_niche',
          splitDirection: 'none',
          exactSizeMm: 595,
          content: { type: 'empty' }
        },
        {
          id: 'zone_auto_oven_drawer',
          splitDirection: 'none',
          sizeRatio: 1,
          content: {
            type: 'drawers',
            drawers: {
              count: 1,
              frontMount: 'overlay',
              deductTopMm: 0,
              deductBottomMm: 0,
              deductLeftMm: 0,
              deductRightMm: 0,
              openingSystem: hasHandle ? 'handle' : 'push',
              slideType: ovenSlide,
              bottomType: 'grooved'
            }
          }
        }
      ]
    };
  }

  const sigId = buildAutoZoneSignature({
    shelves: shelvesCount,
    drawers: drawersCount,
    doorOpening,
    rods: rodsCount,
    plinth: hasPlinth,
    tieStrips,
    moduleType: config.moduleType,
    split: 'none'
  });

  if (drawersCount > 0) {
    const zoneSlide: CabinetZoneDrawerConfig['slideType'] = resolveValidDrawerSlideType(
      config.drawerSlideType
    );
    const openingSystem: CabinetZoneDrawerConfig['openingSystem'] =
      config.openingSystem === 'gola' || config.handleType === 'gola_less' || config.handleType === 'gola'
        ? 'gola'
        : zoneSlide === 'push_open' ||
            config.openingSystem === 'push' ||
            config.handleType === 'push' ||
            config.handleType === 'push_open'
          ? 'push'
          : config.openingSystem === 'finger_pull' || config.handleType === 'finger_pull'
            ? 'finger_pull'
            : config.hasHandle === false && !config.openingSystem
              ? 'push'
              : 'handle';
    return {
      id: sigId,
      splitDirection: 'none',
      content: {
        type: 'drawers',
        drawers: {
          count: drawersCount,
          frontMount: config.drawerFrontType === 'inset' ? 'inset' : 'overlay',
          deductTopMm: 0,
          deductBottomMm: 0,
          deductLeftMm: 0,
          deductRightMm: 0,
          openingSystem,
          ...(config.fingerPullDeductMm !== undefined ? { fingerPullDeductMm: config.fingerPullDeductMm } : {}),
          ...(config.golaFinish ? { golaFinish: config.golaFinish } : {}),
          slideType: zoneSlide,
          bottomType: 'grooved'
        }
      }
    };
  }

  const nonZeroRods: 1 | 2 | undefined = rodsCount === 2 ? 2 : rodsCount === 1 ? 1 : undefined;

  if (doorOpening !== 'none') {
    const doorOpeningSystem: CabinetOpeningSystem =
      config.openingSystem === 'gola' || config.handleType === 'gola_less' || config.handleType === 'gola'
        ? 'gola'
        : config.openingSystem === 'finger_pull' || config.handleType === 'finger_pull'
          ? 'finger_pull'
          : config.openingSystem === 'push' ||
              config.handleType === 'push' ||
              config.handleType === 'push_open'
            ? 'push'
            : config.hasHandle === false
              ? 'push'
              : 'handle';
    const hasHandle =
      doorOpeningSystem === 'handle' &&
      config.hasHandle !== false &&
      !isNonPhysicalHandleType(config.handleType);
    const mappedOpening: CabinetZoneDoorConfig['opening'] =
      doorOpening === 'double' ? 'double' : doorOpening === 'right' ? 'right' : 'left';
    const doorHandleType: HandleType = hasHandle
      ? config.handleType && !isNonPhysicalHandleType(config.handleType)
        ? config.handleType
        : 'bar_modern'
      : doorOpeningSystem === 'gola'
        ? 'gola_less'
        : doorOpeningSystem === 'finger_pull'
          ? 'finger_pull'
          : config.handleType === 'none'
            ? 'none'
            : 'push_open';
    return {
      id: sigId,
      splitDirection: 'none',
      content: {
        type: 'doors',
        doors: {
          opening: mappedOpening,
          mount: 'overlay',
          ...(config.hingeType ? { hingeType: config.hingeType } : {}),
          hasHandle,
          openingSystem: doorOpeningSystem,
          ...(config.fingerPullDeductMm !== undefined ? { fingerPullDeductMm: config.fingerPullDeductMm } : {}),
          ...(config.golaFinish ? { golaFinish: config.golaFinish } : {}),
          ...(config.handlePosition ? { handlePosition: config.handlePosition } : {}),
          handleType: doorHandleType,
          handleFinish: config.handleFinish || 'brushed_steel'
        },
        ...(shelvesCount > 0 ? { shelvesCount, shelfSetbackMm: 20 } : {}),
        ...(nonZeroRods ? { hangingRodsCount: nonZeroRods } : {}),
        ...(nonZeroRods && config.hangingRodFinish ? { hangingRodFinish: config.hangingRodFinish } : {})
      }
    };
  }

  if (nonZeroRods) {
    return {
      id: sigId,
      splitDirection: 'none',
      content: {
        type: 'hanging_rod',
        hangingRodsCount: nonZeroRods,
        ...(config.hangingRodFinish ? { hangingRodFinish: config.hangingRodFinish } : {}),
        ...(shelvesCount > 0 ? { shelvesCount, shelfSetbackMm: 10 } : {})
      }
    };
  }

  if (shelvesCount > 0) {
    return {
      id: sigId,
      splitDirection: 'none',
      content: {
        type: 'shelves',
        shelvesCount,
        shelfSetbackMm: 10
      }
    };
  }

  return {
    id: sigId,
    splitDirection: 'none',
    content: { type: 'empty' }
  };
}

@Injectable({
  providedIn: 'root'
})
export class CabinetGeneratorService {
  private readonly partGeometry = inject(PartGeometryService);

  private isZoneTreeMatchingAutoSignature(node: CabinetZoneNode, sig: AutoZoneSignature): boolean {
    if (node.splitDirection !== sig.split) return false;
    if (sig.split !== 'none') {
      if (!node.id.startsWith('zone_auto_root__') || !Array.isArray(node.children)) {
        return false;
      }
      if (node.children.length === 4 && node.children[1]?.id === 'zone_auto_tower_micro') {
        return (
          node.children[0]?.content?.type === 'doors' &&
          node.children[1]?.content?.type === 'empty' &&
          node.children[2]?.content?.type === 'empty' &&
          node.children[3]?.content?.type === 'doors'
        );
      }
      if (node.children.length === 2 && node.children[0]?.id === 'zone_auto_oven_niche') {
        return (
          node.children[0]?.content?.type === 'empty' &&
          node.children[1]?.content?.type === 'drawers'
        );
      }
      return node.children.every(ch => ch.id.startsWith('zone_auto_'));
    }
    const c = node.content;
    if (!c) return sig.drawers === 0 && sig.shelves === 0 && sig.doorOpening === 'none' && sig.rods === 0;
    if (sig.drawers > 0) {
      return c.type === 'drawers' && (c.drawers?.count ?? 0) === sig.drawers;
    }
    if (sig.doorOpening !== 'none') {
      const expectedOpening =
        sig.doorOpening === 'double' ? 'double' : sig.doorOpening === 'right' ? 'right' : 'left';
      return (
        c.type === 'doors' &&
        c.doors?.opening === expectedOpening &&
        (c.shelvesCount ?? 0) === sig.shelves &&
        (c.hangingRodsCount ?? 0) === sig.rods
      );
    }
    if (sig.rods > 0) {
      return c.type === 'hanging_rod' && (c.hangingRodsCount ?? 0) === sig.rods;
    }
    if (sig.shelves > 0) {
      return c.type === 'shelves' && (c.shelvesCount ?? 0) === sig.shelves;
    }
    return c.type === 'empty';
  }

  private hasFlatConfigDivergedFromSignature(
    config: ParametricCabinetConfig,
    sig: AutoZoneSignature
  ): boolean {
    const isDrawerUnit =
      config.moduleType === 'drawer_unit' ||
      config.category === 'drawers' ||
      config.category === 'cajones';
    const isWall =
      config.moduleType === 'wall_cabinet' ||
      config.category === 'kitchen_wall' ||
      config.category === 'bathroom_wall';
    const curDrawers = isWall
      ? 0
      : Math.max(0, Math.min(6, Math.floor(Number(config.drawersCount) || (isDrawerUnit ? 3 : 0))));
    const curShelves = isDrawerUnit
      ? 0
      : Math.max(0, Math.min(8, Math.floor(Number(config.shelvesCount) || 0)));
    const curDoor = isDrawerUnit ? 'none' : config.doorOpening || 'none';
    const curRods = config.hangingRodsCount === 2 ? 2 : config.hangingRodsCount === 1 ? 1 : 0;
    const curPlinth = config.hasPlinth !== false && resolveCabinetBaseType(config) !== 'none';
    const curTie = Boolean(config.topTieStrips);

    return (
      curDrawers !== sig.drawers ||
      curShelves !== sig.shelves ||
      curDoor !== sig.doorOpening ||
      curRods !== sig.rods ||
      curPlinth !== sig.plinth ||
      curTie !== sig.tieStrips ||
      config.moduleType !== sig.moduleType
    );
  }

  private shouldUseZoneEngine(config: ParametricCabinetConfig): boolean {
    const isSpecialized =
      config.category === 'oven_base' ||
      config.category === 'sink_base' ||
      config.category === 'corner_base' ||
      config.category === 'blind_corner_base' ||
      config.category === 'oven_tower';
    const hasExplicitHito2b1Options =
      config.installationType !== undefined ||
      config.wallMountType !== undefined ||
      config.legStyle !== undefined ||
      config.openingSystem !== undefined ||
      config.golaFinish !== undefined ||
      config.hangingRodFinish !== undefined ||
      config.customizeVisibleSides === true ||
      config.baseType === 'legs';

    if (!config.zoneTree) {
      return (
        hasExplicitHito2b1Options &&
        !isSpecialized &&
        config.doorOpening !== 'top' &&
        config.doorOpening !== 'bottom' &&
        !config.siphonCutout?.enabled
      );
    }
    const sig = parseAutoZoneSignature(config.zoneTree.id);
    if (!sig) {
      return true;
    }
    if (!this.isZoneTreeMatchingAutoSignature(config.zoneTree, sig)) {
      return true;
    }
    if (config.baseType === 'legs' || config.backType === 'rebate' || hasExplicitHito2b1Options) {
      if (!isSpecialized && config.doorOpening !== 'top' && config.doorOpening !== 'bottom' && !config.siphonCutout?.enabled) {
        return true;
      }
    }
    if (isSpecialized) {
      return false;
    }
    if (config.doorOpening === 'top' || config.doorOpening === 'bottom' || config.siphonCutout?.enabled) {
      return false;
    }
    if (this.hasFlatConfigDivergedFromSignature(config, sig)) {
      return false;
    }
    return true;
  }

  /**
   * Generates a fully parametric furniture module (Kitchen Base, Wall Cabinet, Closet,
   * Vanity, Bookshelf, or Custom) with exact joinery calculations, door configurations
   * (none, left, right, double, lift-up), handles, and uniform/manual shelf distributions.
   */
  generateParametricCabinet(
    config: ParametricCabinetConfig, 
    materials: Material[]
  ): { module: FurnitureModule; parts: Part[]; group: PartGroup } {
    if (this.shouldUseZoneEngine(config)) {
      return this.generateZoneCabinet(config, materials);
    }
    const cleanCfg: ParametricCabinetConfig = config.zoneTree
      ? { ...config, zoneTree: undefined }
      : config;

    if (cleanCfg.category === 'oven_base' || cleanCfg.category === 'sink_base' || cleanCfg.category === 'corner_base' || cleanCfg.category === 'blind_corner_base' || cleanCfg.category === 'oven_tower') {
      return this.generateSpecializedKitchenModule(cleanCfg, materials);
    }
    if (cleanCfg.moduleType === 'drawer_unit' || cleanCfg.category === 'drawers' || cleanCfg.category === 'cajones' || (cleanCfg.drawersCount && cleanCfg.drawersCount > 0 && cleanCfg.moduleType !== 'wall_cabinet')) {
      return this.generateParametricDrawerUnit(cleanCfg, materials);
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
    const hasHandle = config.hasHandle !== false && !isNonPhysicalHandleType(config.handleType);
    const hType: HandleType = hasHandle
      ? config.handleType || 'bar_modern'
      : config.handleType && isNonPhysicalHandleType(config.handleType)
        ? config.handleType
        : 'none';
    const hFinish = config.handleFinish || 'brushed_steel';
    const resolvedDoorHinge: HingeType = config.hingeType || 'straight';
    const resolvedLiftHinge: HingeType = config.hingeType || 'gas_piston';
    const doorHandlePos: DoorHandleVerticalPosition = hasHandle
      ? config.handlePosition || 'vertical'
      : 'none';
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
          hingeType: resolvedDoorHinge,
          handleType: hType,
          handleFinish: hFinish,
          handlePosition: doorHandlePos,
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
          hingeType: resolvedDoorHinge,
          handleType: hType,
          handleFinish: hFinish,
          handlePosition: doorHandlePos,
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
          hingeType: resolvedDoorHinge,
          handleType: hType,
          handleFinish: hFinish,
          handlePosition: doorHandlePos,
          isOpen: false
        }
      });
    } else if (doorOpening === 'top' || isGasLift) {
      // 1 Puerta Elevable Superior (Pistón a Gas)
      parts.push({
        id: `${moduleId}_puerta_elev_${Date.now()}`,
        name: 'PUERTA ABATIBLE SUPERIOR',
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
          hingeType: resolvedLiftHinge,
          handleType: hType,
          handleFinish: hFinish,
          handlePosition: hasHandle ? 'horizontal' : 'none',
          isOpen: false
        }
      });
    } else if (doorOpening === 'bottom') {
      // Puerta Abatible Inferior
      parts.push({
        id: `${moduleId}_puerta_abat_${Date.now()}`,
        name: 'PUERTA ABATIBLE INFERIOR',
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
          hingeType: resolvedDoorHinge,
          handleType: hType,
          handleFinish: hFinish,
          handlePosition: hasHandle ? 'horizontal' : 'none',
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

    const taggedParts: Part[] = parts.map(pt => ({ ...pt, isParametricGenerated: true }));
    return { module, parts: taggedParts, group };
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
    const slideType = resolveValidDrawerSlideType(config.drawerSlideType);
    const isOverlay = config.drawerFrontType !== 'inset';
    const includeBack = config.hasBackPanel !== false;
    const drawerOpening: DrawerOpeningSystem =
      slideType === 'push_open' || config.handleType === 'push' || config.handleType === 'push_open'
        ? 'push'
        : config.handleType === 'finger_pull' || config.handleType === 'gola_less'
          ? 'finger_pull'
          : config.hasHandle === false
            ? 'push'
            : 'handle';
    const hType: HandleType =
      drawerOpening === 'push'
        ? (config.handleType === 'none' ? 'none' : 'push_open')
        : drawerOpening === 'finger_pull'
          ? 'finger_pull'
          : config.handleType && !isNonPhysicalHandleType(config.handleType)
            ? config.handleType
            : 'bar_modern';
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
          drawerOpeningSystem: drawerOpening,
          frontMountType: isOverlay ? 'overlay' : 'inset',
          handleType: hType,
          handleFinish: hFinish,
          handlePosition: drawerOpening === 'handle' ? 'horizontal' : 'none',
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
      type: 'assembly',
      isOpen: false,
      parametricConfig: {
        ...config,
        id: config.id || moduleId,
        moduleType: 'drawer_unit',
        category: 'drawers',
        drawersCount,
        shelvesCount: 0,
        doorOpening: 'none',
        hangingRodsCount: 0
      }
    };

    const taggedParts: Part[] = parts.map(pt => ({ ...pt, isParametricGenerated: true }));
    return { module, parts: taggedParts, group };
  }

  private isValidBoardMaterialPart(part: Part): boolean {
    const matId = (part.materialId || '').trim();
    if (!matId) return false;
    const idLower = matId.toLowerCase();
    if (idLower.startsWith('mat_stone_') || idLower.startsWith('hw_')) return false;
    const nameLower = (part.materialName || '').toLowerCase().trim();
    if (
      nameLower.includes('cuarzo') ||
      nameLower.includes('mármol') ||
      nameLower.includes('marmol') ||
      nameLower.includes('granito') ||
      nameLower.includes('dekton') ||
      nameLower.includes('silestone') ||
      nameLower.includes('neolith') ||
      nameLower.includes('sinterizada') ||
      nameLower.includes('piedra') ||
      nameLower.includes('terrazzo') ||
      nameLower.includes('terrazo') ||
      nameLower.includes('(mesón)') ||
      nameLower.includes('(meson)')
    ) {
      return false;
    }
    return true;
  }

  private detectDominantBoardMaterialId(
    candidates: Part[],
    currentMatId?: string
  ): string | null {
    const counts = new Map<string, number>();
    const order: string[] = [];
    for (const part of candidates) {
      if (!this.isValidBoardMaterialPart(part)) continue;
      const matId = part.materialId.trim();
      if (!counts.has(matId)) {
        order.push(matId);
      }
      counts.set(matId, (counts.get(matId) ?? 0) + 1);
    }
    if (order.length === 0) return null;

    let bestId = order[0];
    let bestCount = counts.get(bestId) ?? 0;
    for (let i = 1; i < order.length; i++) {
      const matId = order[i];
      const cnt = counts.get(matId) ?? 0;
      if (cnt > bestCount) {
        bestId = matId;
        bestCount = cnt;
      } else if (cnt === bestCount && currentMatId && bestId === currentMatId && matId !== currentMatId) {
        bestId = matId;
      }
    }
    return bestId;
  }

  private detectIsRotated90(parametricParts: Part[], group?: PartGroup): boolean {
    const sidePart = parametricParts.find(
      p => p.componentRole === 'side_left' || p.componentRole === 'side_right'
    );
    if (sidePart?.orientation === 'vertical_xy') return true;
    if (sidePart?.orientation === 'vertical_yz') return false;
    const frontOrBack = parametricParts.find(
      p =>
        p.componentRole === 'door' ||
        p.componentRole === 'drawer_front' ||
        p.componentRole === 'back'
    );
    if (frontOrBack?.orientation === 'vertical_yz') return true;
    if (frontOrBack?.orientation === 'vertical_xy') return false;
    return group?.facingDirection === 'left' || group?.facingDirection === 'right';
  }

  private detectLiveOuterEnvelope(
    parametricParts: Part[],
    group: PartGroup
  ): {
    width: number;
    height: number;
    depth: number;
    posX: number;
    posY: number;
    posZ: number;
  } | null {
    const isLegPart = (p: Part): boolean => isCabinetLegPart(p);

    const positionedCarcass = parametricParts.filter(
      p =>
        (p.componentRole === 'side_left' ||
          p.componentRole === 'side_right' ||
          p.componentRole === 'top' ||
          p.componentRole === 'bottom' ||
          p.componentRole === 'tie' ||
          p.componentRole === 'plinth' ||
          isLegPart(p)) &&
        p.orientation !== undefined &&
        Number.isFinite(Number(p.posX)) &&
        Number.isFinite(Number(p.posY)) &&
        Number.isFinite(Number(p.posZ))
    );

    const hasLeft = positionedCarcass.some(p => p.componentRole === 'side_left');
    const hasRight = positionedCarcass.some(p => p.componentRole === 'side_right');
    const hasHorizSpan = positionedCarcass.some(
      p => p.componentRole === 'top' || p.componentRole === 'bottom' || p.componentRole === 'tie'
    );
    if (
      positionedCarcass.length < 2 ||
      !((hasLeft && hasRight) || ((hasLeft || hasRight) && hasHorizSpan))
    ) {
      return null;
    }

    const axisAlignedFronts = parametricParts.filter(
      p =>
        (p.componentRole === 'door' || p.componentRole === 'drawer_front') &&
        p.orientation !== undefined &&
        Number.isFinite(Number(p.posX)) &&
        Number.isFinite(Number(p.posY)) &&
        Number.isFinite(Number(p.posZ)) &&
        Math.abs((p.rotationY ?? 0) % 90) < 0.01
    );

    const envelopeParts = [...positionedCarcass, ...axisAlignedFronts];

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const part of envelopeParts) {
      const b = this.partGeometry.getWorldAABB(part);
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxY > maxY) maxY = b.maxY;
      if (b.minZ < minZ) minZ = b.minZ;
      if (b.maxZ > maxZ) maxZ = b.maxZ;
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(minZ)) {
      return null;
    }

    const worldSx = Math.round((maxX - minX) * 10) / 10;
    const worldSy = Math.round((maxY - minY) * 10) / 10;
    const worldSz = Math.round((maxZ - minZ) * 10) / 10;
    if (worldSx < 100 || worldSy < 100 || worldSz < 80) {
      return null;
    }

    const isRotated90 = this.detectIsRotated90(parametricParts, group);
    return {
      width: isRotated90 ? worldSz : worldSx,
      height: worldSy,
      depth: isRotated90 ? worldSx : worldSz,
      posX: Math.round(((minX + maxX) / 2) * 10) / 10,
      posY: Math.round(((minY + maxY) / 2) * 10) / 10,
      posZ: Math.round(((minZ + maxZ) / 2) * 10) / 10
    };
  }

  /**
   * Reconstruye una configuración paramétrica a partir de las piezas existentes de un grupo
   */
  reconstructConfigFromParts(parts: Part[], group: PartGroup): ParametricCabinetConfig {
    const filteredParametricParts = parts.filter(p => isPartParametricGenerated(p, parts));
    const parametricParts = filteredParametricParts.length > 0 ? filteredParametricParts : parts;
    const isCt =
      group.isCountertop ||
      parametricParts.some(p => p.componentRole === 'countertop' || p.componentRole === 'backsplash');

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

      const explicitInstallationType: CabinetInstallationType | undefined =
        raw.installationType === 'floor' || raw.installationType === 'wall'
          ? raw.installationType
          : undefined;
      const effectiveInstallation =
        explicitInstallationType ?? resolveInstallationType(raw as ParametricCabinetConfig);
      const isWallEffective = effectiveInstallation === 'wall';

      const resolvedBaseType: CabinetBaseType | undefined = isWallEffective
        ? 'none'
        : raw.baseType === 'none' || raw.baseType === 'plinth' || raw.baseType === 'legs'
          ? raw.baseType
          : undefined;
      const effectiveHasPlinth = isWallEffective
        ? false
        : resolvedBaseType
          ? resolvedBaseType === 'plinth'
          : raw.hasPlinth !== undefined
            ? Boolean(raw.hasPlinth)
            : true;
      const effectivePlinthH = isWallEffective
        ? 0
        : resolvedBaseType === 'legs'
          ? Math.max(50, Number(raw.plinthHeight) || 120)
          : resolvedBaseType === 'none'
            ? 0
            : effectiveHasPlinth
              ? Number(raw.plinthHeight) || 70
              : 0;

      const resolvedHingeType = resolveValidHingeType(raw.hingeType);
      const resolvedSlideType = resolveValidDrawerSlideType(raw.drawerSlideType);
      const resolvedHasHandle =
        raw.hasHandle !== undefined
          ? Boolean(raw.hasHandle) && !isNonPhysicalHandleType(raw.handleType)
          : !isNonPhysicalHandleType(raw.handleType);
      const validWallMountType: CabinetWallMountType | undefined =
        raw.wallMountType === 'french_cleat' ||
        raw.wallMountType === 'concealed_hanger' ||
        raw.wallMountType === 'direct_nailer'
          ? raw.wallMountType
          : undefined;
      const validLegStyle: CabinetLegStyle | undefined =
        raw.legStyle === 'black_leveler' ||
        raw.legStyle === 'cylindrical_inox' ||
        raw.legStyle === 'scandinavian_wood' ||
        raw.legStyle === 'hairpin_metal'
          ? raw.legStyle
          : undefined;
      const validOpeningSystem: CabinetOpeningSystem | undefined =
        raw.openingSystem === 'handle' ||
        raw.openingSystem === 'push' ||
        raw.openingSystem === 'finger_pull' ||
        raw.openingSystem === 'gola'
          ? raw.openingSystem
          : undefined;
      const validGolaFinish: CabinetGolaFinish | undefined =
        raw.golaFinish === 'natural_aluminum' ||
        raw.golaFinish === 'matte_black' ||
        raw.golaFinish === 'white' ||
        raw.golaFinish === 'champagne'
          ? raw.golaFinish
          : undefined;
      const validRodFinish: CabinetRodFinish | undefined =
        raw.hangingRodFinish === 'chrome' ||
        raw.hangingRodFinish === 'matte_black' ||
        raw.hangingRodFinish === 'gold'
          ? raw.hangingRodFinish
          : undefined;

      return {
        ...(raw.id ? { id: raw.id } : {}),
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
        hasHandle: resolvedHasHandle,
        handleType: raw.handleType || 'bar_modern',
        handleFinish: raw.handleFinish || 'brushed_steel',
        handlePosition: raw.handlePosition || 'vertical',
        ...(resolvedHingeType ? { hingeType: resolvedHingeType } : {}),
        structureMaterialId: raw.structureMaterialId || 'mat-1',
        doorMaterialId: raw.doorMaterialId || raw.structureMaterialId || 'mat-1',
        backMaterialId: raw.backMaterialId || raw.structureMaterialId || 'mat-1',
        facadeGap: Number(raw.facadeGap) || 3,
        posX: Number.isFinite(Number(raw.posX)) ? Number(raw.posX) : 0,
        posY: Number.isFinite(Number(raw.posY)) ? Number(raw.posY) : undefined,
        posZ: Number.isFinite(Number(raw.posZ)) ? Number(raw.posZ) : 0,
        drawersCount: resolvedDrawersCount,
        drawerSlideType: resolvedSlideType,
        drawerFrontType: raw.drawerFrontType || 'overlay',
        hasPlinth: effectiveHasPlinth,
        plinthHeight: effectivePlinthH,
        baseType: resolvedBaseType,
        topTieStrips: isWallEffective ? false : Boolean(raw.topTieStrips),
        hasTopCover: isWallEffective ? true : (raw.hasTopCover !== undefined ? Boolean(raw.hasTopCover) : true),
        hangingRodsCount: safeHangingRodsCount,
        siphonCutout: safeSiphonCutout,
        ...(explicitInstallationType ? { installationType: explicitInstallationType } : {}),
        ...(validWallMountType ? { wallMountType: validWallMountType } : {}),
        ...(raw.frenchCleatHeightMm !== undefined && Number.isFinite(Number(raw.frenchCleatHeightMm))
          ? { frenchCleatHeightMm: Math.max(60, Math.min(120, Math.round(Number(raw.frenchCleatHeightMm)))) }
          : {}),
        ...(raw.elevationY !== undefined && Number.isFinite(Number(raw.elevationY))
          ? { elevationY: Math.max(0, Number(raw.elevationY)) }
          : {}),
        ...(raw.plinthRecessMm !== undefined && Number.isFinite(Number(raw.plinthRecessMm))
          ? { plinthRecessMm: Math.max(0, Number(raw.plinthRecessMm)) }
          : {}),
        ...(validLegStyle ? { legStyle: validLegStyle } : {}),
        ...(validOpeningSystem ? { openingSystem: validOpeningSystem } : {}),
        ...(raw.fingerPullDeductMm !== undefined && Number.isFinite(Number(raw.fingerPullDeductMm))
          ? { fingerPullDeductMm: Math.max(10, Math.min(40, Math.round(Number(raw.fingerPullDeductMm)))) }
          : {}),
        ...(validGolaFinish ? { golaFinish: validGolaFinish } : {}),
        ...(validRodFinish ? { hangingRodFinish: validRodFinish } : {}),
        ...(raw.customizeVisibleSides !== undefined
          ? { customizeVisibleSides: Boolean(raw.customizeVisibleSides) }
          : {}),
        ...(raw.visibleSideLeft !== undefined ? { visibleSideLeft: Boolean(raw.visibleSideLeft) } : {}),
        ...(raw.visibleSideRight !== undefined ? { visibleSideRight: Boolean(raw.visibleSideRight) } : {}),
        ...(raw.visibleTopCover !== undefined ? { visibleTopCover: Boolean(raw.visibleTopCover) } : {}),
        ...(raw.visibleMaterialId ? { visibleMaterialId: raw.visibleMaterialId } : {}),
        zoneTree: raw.zoneTree ? deepCloneZoneNode(raw.zoneTree) : undefined,
        highlightedZoneId: raw.highlightedZoneId
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

    const drawerFronts = parametricParts.filter(p => p.componentRole === 'drawer_front');
    const drawerBoxes = parametricParts.filter(
      p =>
        p.componentRole === 'drawer_box' ||
        p.componentRole === 'drawer_lateral' ||
        p.componentRole === 'drawer_bottom'
    );
    const doorParts = parametricParts.filter(p => p.componentRole === 'door');
    const shelfParts = parametricParts.filter(p => p.componentRole === 'shelf');
    const backPart = parametricParts.find(p => p.componentRole === 'back');
    const legParts = parametricParts.filter(p => isCabinetLegPart(p));
    const rodParts = parametricParts.filter(p => isCabinetRodPart(p));
    const frenchCleatParts = parametricParts.filter(
      p =>
        p.componentRole === 'tie' &&
        (p.hardwareConfig?.wallMountType === 'french_cleat' ||
          (p.name || '').toLowerCase().includes('listón francés') ||
          (p.name || '').toLowerCase().includes('liston frances'))
    );
    const nailerParts = parametricParts.filter(
      p =>
        p.componentRole === 'tie' &&
        (p.hardwareConfig?.wallMountType === 'direct_nailer' ||
          (p.name || '').toLowerCase().includes('amarre trasero'))
    );
    const hangerParts = parametricParts.filter(
      p =>
        p.componentRole === 'accessory' &&
        (p.hardwareConfig?.wallMountType === 'concealed_hanger' ||
          p.materialId === 'hw_wall_concealed_hanger' ||
          (p.name || '').toLowerCase().includes('colgador oculto'))
    );
    const golaBarParts = parametricParts.filter(
      p =>
        p.componentRole === 'accessory' &&
        ((p.materialId || '').startsWith('hw_gola_') ||
          (p.name || '').toLowerCase().includes('perfil gola'))
    );
    const actualRodCount: 0 | 1 | 2 = rodParts.length >= 2 ? 2 : (rodParts.length === 1 ? 1 : 0);
    const actualDrawerCount = drawerFronts.length > 0
      ? drawerFronts.length
      : (drawerBoxes.length > 0 ? Math.max(1, Math.round(drawerBoxes.length / 5)) : 0);

    const carcassRoleOrder: readonly ComponentRole[] = ['side_left', 'side_right', 'top', 'bottom'];
    const carcassMaterialParts = carcassRoleOrder.flatMap(role =>
      parametricParts.filter(p => p.componentRole === role && this.isValidBoardMaterialPart(p))
    );
    const coreStructureFallbackParts = parametricParts.filter(
      p =>
        (p.componentRole === 'bottom' ||
          p.componentRole === 'divider' ||
          p.componentRole === 'shelf' ||
          p.componentRole === 'tie' ||
          p.componentRole === 'plinth') &&
        this.isValidBoardMaterialPart(p)
    );
    const frontMaterialParts = parametricParts.filter(
      p =>
        (p.componentRole === 'door' || p.componentRole === 'drawer_front') &&
        this.isValidBoardMaterialPart(p)
    );
    const liveEnvelope = this.detectLiveOuterEnvelope(parametricParts, group);

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
      } else if (doorParts.length === 1) {
        const dir = doorParts[0].hardwareConfig?.openingDirection;
        if (dir === 'left' || dir === 'right' || dir === 'top' || dir === 'bottom') {
          cfg.doorOpening = dir;
        } else if (cfg.doorOpening === 'none' || cfg.doorOpening === 'double') {
          cfg.doorOpening = 'left';
        }
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

      // 5. Sincronizar ediciones externas de materiales (estructura, caras visibles y frentes) antes de reabrir el asistente
      const customizedVisibleParts = cfg.customizeVisibleSides
        ? parametricParts.filter(
            p =>
              this.isValidBoardMaterialPart(p) &&
              ((cfg.visibleSideLeft && p.componentRole === 'side_left') ||
                (cfg.visibleSideRight && p.componentRole === 'side_right') ||
                (cfg.visibleTopCover && p.componentRole === 'top'))
          )
        : [];
      const structureCandidateParts = cfg.customizeVisibleSides
        ? carcassMaterialParts.filter(
            p =>
              !(cfg.visibleSideLeft && p.componentRole === 'side_left') &&
              !(cfg.visibleSideRight && p.componentRole === 'side_right') &&
              !(cfg.visibleTopCover && p.componentRole === 'top')
          )
        : carcassMaterialParts;
      const effectiveStructCandidates =
        structureCandidateParts.length > 0 ? structureCandidateParts : coreStructureFallbackParts;
      const liveStructureMatId = this.detectDominantBoardMaterialId(
        effectiveStructCandidates,
        cfg.structureMaterialId
      );
      if (liveStructureMatId && liveStructureMatId !== cfg.structureMaterialId) {
        cfg.structureMaterialId = liveStructureMatId;
      }
      if (cfg.customizeVisibleSides && customizedVisibleParts.length > 0) {
        const liveVisibleMatId = this.detectDominantBoardMaterialId(
          customizedVisibleParts,
          cfg.visibleMaterialId
        );
        if (liveVisibleMatId) {
          cfg.visibleMaterialId = liveVisibleMatId;
        }
      }
      const liveDoorMatId = this.detectDominantBoardMaterialId(
        frontMaterialParts,
        cfg.doorMaterialId
      );
      if (liveDoorMatId && liveDoorMatId !== cfg.doorMaterialId) {
        cfg.doorMaterialId = liveDoorMatId;
      }

      // 6. Sincronizar envolvente exterior (ancho, alto, profundidad) y centro real en mundo (posX, posY, posZ)
      if (liveEnvelope) {
        if (Math.abs(liveEnvelope.width - cfg.width) > 0.5) {
          cfg.width = Math.max(150, liveEnvelope.width);
        }
        if (Math.abs(liveEnvelope.height - cfg.height) > 0.5) {
          cfg.height = Math.max(150, liveEnvelope.height);
        }
        const hasDiagonalDoor = parametricParts.some(
          p => p.componentRole === 'door' && Math.abs((p.rotationY ?? 0) % 90) >= 0.01
        );
        const effectiveLiveDepth = hasDiagonalDoor
          ? Math.round((liveEnvelope.depth + cfg.doorThickness) * 10) / 10
          : liveEnvelope.depth;
        if (Math.abs(effectiveLiveDepth - cfg.depth) > 0.5) {
          cfg.depth = Math.max(120, effectiveLiveDepth);
        }
        if (cfg.posX === undefined || Math.abs(liveEnvelope.posX - cfg.posX) > 0.1) {
          cfg.posX = liveEnvelope.posX;
        }
        if (cfg.posY === undefined || Math.abs(liveEnvelope.posY - cfg.posY) > 0.1) {
          cfg.posY = liveEnvelope.posY;
        }
        if (cfg.posZ === undefined || Math.abs(liveEnvelope.posZ - cfg.posZ) > 0.1) {
          cfg.posZ = liveEnvelope.posZ;
        }
      }

      if (resolveInstallationType(cfg) === 'wall') {
        cfg.baseType = 'none';
        cfg.hasPlinth = false;
        cfg.plinthHeight = 0;
        if (frenchCleatParts.length > 0) {
          cfg.wallMountType = 'french_cleat';
          const cleatWidth = Number(frenchCleatParts[0]?.width);
          if (Number.isFinite(cleatWidth) && cleatWidth >= 60 && cleatWidth <= 120) {
            cfg.frenchCleatHeightMm = Math.round(cleatWidth);
          }
        } else if (hangerParts.length > 0) {
          cfg.wallMountType = 'concealed_hanger';
        } else if (nailerParts.length > 0) {
          cfg.wallMountType = 'direct_nailer';
        }
      } else {
        if (!cfg.baseType) {
          cfg.baseType = legParts.length > 0 ? 'legs' : resolveCabinetBaseType(cfg);
        }
        if (legParts.length > 0) {
          cfg.legStyle = inferLegStyleFromPart(legParts[0]);
        }
      }

      if (rodParts.length > 0) {
        cfg.hangingRodFinish = inferRodFinishFromPart(rodParts[0]);
      }

      // 7. Sincronizar estilos globales (manijas, acabados, sistemas de apertura, bisagras y correderas) con las piezas vivas y zoneTree
      const activeDoorParts = doorParts.filter(
        p => !(p.name || '').toUpperCase().includes('PANEL CIEGO')
      );
      const hingedDoorParts = activeDoorParts.filter(p => !isSlidingDoorPart(p));
      const handleCarrierParts = activeDoorParts.length > 0 ? activeDoorParts : drawerFronts;

      const liveHandleType =
        pickDominantString(handleCarrierParts.map(p => p.hardwareConfig?.handleType)) ??
        cfg.handleType;
      const liveHandleFinish =
        pickDominantString(handleCarrierParts.map(p => p.hardwareConfig?.handleFinish)) ??
        cfg.handleFinish;
      const liveHandlePosition =
        pickDominantString(activeDoorParts.map(p => p.hardwareConfig?.handlePosition)) ??
        cfg.handlePosition;
      const liveHingeType =
        pickDominantString(
          hingedDoorParts.map(p => resolveValidHingeType(p.hardwareConfig?.hingeType))
        ) ?? cfg.hingeType;
      const liveSlideType =
        pickDominantString(
          drawerFronts.map(p =>
            p.hardwareConfig?.slideType && p.hardwareConfig.slideType !== 'none'
              ? resolveValidDrawerSlideType(p.hardwareConfig.slideType)
              : undefined
          )
        ) ?? cfg.drawerSlideType;
      const liveOpeningSystem =
        pickDominantString(
          handleCarrierParts.map(p => resolvePartOpeningSystem(p.hardwareConfig, liveSlideType))
        ) ??
        cfg.openingSystem ??
        (golaBarParts.length > 0 ? 'gola' : undefined);
      const liveFingerPullDeduct =
        pickDominantNumber(handleCarrierParts.map(p => p.hardwareConfig?.fingerPullDeductMm)) ??
        cfg.fingerPullDeductMm;
      const liveGolaFinish =
        pickDominantString(
          [...handleCarrierParts, ...golaBarParts].map(p => p.hardwareConfig?.golaFinish)
        ) ?? cfg.golaFinish;

      cfg.handleType = liveHandleType;
      cfg.handleFinish = liveHandleFinish;
      if (liveHandlePosition) {
        cfg.handlePosition = liveHandlePosition;
      }
      cfg.hasHandle =
        !isNonPhysicalHandleType(liveHandleType) &&
        (!liveOpeningSystem || liveOpeningSystem === 'handle');
      if (liveOpeningSystem) {
        cfg.openingSystem = liveOpeningSystem;
      }
      if (liveFingerPullDeduct !== undefined) {
        cfg.fingerPullDeductMm = Math.max(10, Math.min(40, Math.round(liveFingerPullDeduct)));
      }
      if (liveGolaFinish) {
        cfg.golaFinish = liveGolaFinish;
      }
      if (liveHingeType) {
        cfg.hingeType = liveHingeType;
      }
      if (liveSlideType) {
        cfg.drawerSlideType = liveSlideType;
      }

      if (!cfg.zoneTree) {
        cfg.zoneTree = buildAutoZoneTreeFromConfig(cfg);
      } else {
        const syncZoneTreeStyles = (node: CabinetZoneNode): CabinetZoneNode => {
          let nextContent = node.content;
          if (nextContent?.type === 'doors' && nextContent.doors) {
            const matchedDoors = activeDoorParts.filter(p => p.zoneId === node.id);
            const refDoors = matchedDoors.length > 0 ? matchedDoors : activeDoorParts;
            const refHinged = refDoors.filter(p => !isSlidingDoorPart(p));
            const zoneHandleType =
              pickDominantString(refDoors.map(p => p.hardwareConfig?.handleType)) ??
              liveHandleType;
            const zoneHandleFinish =
              pickDominantString(refDoors.map(p => p.hardwareConfig?.handleFinish)) ??
              liveHandleFinish;
            const zoneHandlePosition =
              pickDominantString(refDoors.map(p => p.hardwareConfig?.handlePosition)) ??
              nextContent.doors.handlePosition ??
              liveHandlePosition;
            const zoneOpeningSystem =
              pickDominantString(refDoors.map(p => resolvePartOpeningSystem(p.hardwareConfig))) ??
              nextContent.doors.openingSystem ??
              liveOpeningSystem;
            const zoneFingerPullDeduct =
              pickDominantNumber(refDoors.map(p => p.hardwareConfig?.fingerPullDeductMm)) ??
              nextContent.doors.fingerPullDeductMm ??
              liveFingerPullDeduct;
            const zoneGolaFinish =
              pickDominantString(refDoors.map(p => p.hardwareConfig?.golaFinish)) ??
              nextContent.doors.golaFinish ??
              liveGolaFinish;
            const zoneHingeType =
              nextContent.doors.opening === 'sliding'
                ? 'none'
                : pickDominantString(
                    refHinged.map(p => resolveValidHingeType(p.hardwareConfig?.hingeType))
                  ) ??
                  liveHingeType ??
                  nextContent.doors.hingeType;
            const matchedRods = rodParts.filter(p => p.zoneId === node.id);
            const zoneRodFinish =
              matchedRods.length > 0
                ? inferRodFinishFromPart(matchedRods[0])
                : nextContent.hangingRodFinish ?? cfg.hangingRodFinish;
            nextContent = {
              ...nextContent,
              ...(zoneRodFinish && nextContent.hangingRodsCount ? { hangingRodFinish: zoneRodFinish } : {}),
              doors: {
                ...nextContent.doors,
                ...(zoneHingeType ? { hingeType: zoneHingeType } : {}),
                hasHandle:
                  !isNonPhysicalHandleType(zoneHandleType) &&
                  (!zoneOpeningSystem || zoneOpeningSystem === 'handle'),
                ...(zoneOpeningSystem ? { openingSystem: zoneOpeningSystem } : {}),
                ...(zoneFingerPullDeduct !== undefined
                  ? { fingerPullDeductMm: Math.max(10, Math.min(40, Math.round(zoneFingerPullDeduct))) }
                  : {}),
                ...(zoneGolaFinish ? { golaFinish: zoneGolaFinish } : {}),
                ...(zoneHandlePosition ? { handlePosition: zoneHandlePosition } : {}),
                handleType: zoneHandleType,
                handleFinish: zoneHandleFinish
              }
            };
          } else if (nextContent?.type === 'drawers' && nextContent.drawers) {
            const matchedDrawers = drawerFronts.filter(p => p.zoneId === node.id);
            const refDrawers = matchedDrawers.length > 0 ? matchedDrawers : drawerFronts;
            const zoneSlideType =
              pickDominantString(
                refDrawers.map(p =>
                  p.hardwareConfig?.slideType && p.hardwareConfig.slideType !== 'none'
                    ? resolveValidDrawerSlideType(p.hardwareConfig.slideType)
                    : undefined
                )
              ) ??
              liveSlideType ??
              nextContent.drawers.slideType;

            const explicitOpening = pickDominantString(
              refDrawers.map(p => p.hardwareConfig?.openingSystem ?? p.hardwareConfig?.drawerOpeningSystem)
            );
            const zoneDrawerHandle = pickDominantString(
              refDrawers.map(p => p.hardwareConfig?.handleType)
            );
            const resolvedFromPart = pickDominantString(
              refDrawers.map(p => resolvePartOpeningSystem(p.hardwareConfig, zoneSlideType))
            );
            let zoneOpening: CabinetZoneDrawerConfig['openingSystem'] =
              nextContent.drawers.openingSystem;
            if (zoneSlideType === 'push_open') {
              zoneOpening = 'push';
            } else if (resolvedFromPart) {
              zoneOpening = resolvedFromPart;
            } else if (explicitOpening) {
              zoneOpening =
                explicitOpening === 'push' &&
                zoneDrawerHandle &&
                !isNonPhysicalHandleType(zoneDrawerHandle)
                  ? 'handle'
                  : explicitOpening;
            } else if (
              zoneDrawerHandle === 'push' ||
              zoneDrawerHandle === 'push_open' ||
              zoneDrawerHandle === 'none'
            ) {
              zoneOpening = 'push';
            } else if (zoneDrawerHandle === 'gola_less' || zoneDrawerHandle === 'gola') {
              zoneOpening = 'gola';
            } else if (zoneDrawerHandle === 'finger_pull') {
              zoneOpening = 'finger_pull';
            } else if (refDrawers.length > 0) {
              zoneOpening = 'handle';
            }

            const zoneFingerPullDeduct =
              pickDominantNumber(refDrawers.map(p => p.hardwareConfig?.fingerPullDeductMm)) ??
              nextContent.drawers.fingerPullDeductMm ??
              liveFingerPullDeduct;
            const zoneGolaFinish =
              pickDominantString(refDrawers.map(p => p.hardwareConfig?.golaFinish)) ??
              nextContent.drawers.golaFinish ??
              liveGolaFinish;

            nextContent = {
              ...nextContent,
              drawers: {
                ...nextContent.drawers,
                slideType: zoneSlideType,
                openingSystem: zoneOpening,
                ...(zoneFingerPullDeduct !== undefined
                  ? { fingerPullDeductMm: Math.max(10, Math.min(40, Math.round(zoneFingerPullDeduct))) }
                  : {}),
                ...(zoneGolaFinish ? { golaFinish: zoneGolaFinish } : {})
              }
            };
          } else if (nextContent?.type === 'hanging_rod') {
            const matchedRods = rodParts.filter(p => p.zoneId === node.id);
            const zoneRodFinish =
              matchedRods.length > 0
                ? inferRodFinishFromPart(matchedRods[0])
                : nextContent.hangingRodFinish ?? cfg.hangingRodFinish;
            if (zoneRodFinish) {
              nextContent = {
                ...nextContent,
                hangingRodFinish: zoneRodFinish
              };
            }
          }

          return {
            ...node,
            ...(nextContent ? { content: nextContent } : {}),
            ...(node.children ? { children: node.children.map(syncZoneTreeStyles) } : {})
          };
        };

        cfg.zoneTree = syncZoneTreeStyles(cfg.zoneTree);
      }

      return cfg;
    }

    const sidePart = parametricParts.find(p => p.componentRole === 'side_left' || p.componentRole === 'side_right') || parametricParts[0];
    const topOrBottom = parametricParts.find(p => p.componentRole === 'top' || p.componentRole === 'bottom');
    const plinthPart = parametricParts.find(p => p.componentRole === 'plinth');
    const detectedBaseH = legParts.length > 0
      ? Math.max(50, Number(legParts[0]?.thickness) || 120)
      : plinthPart
        ? Math.max(40, Number(plinthPart.width) || 70)
        : 0;
    const detectedBaseType: CabinetBaseType = legParts.length > 0 ? 'legs' : plinthPart ? 'plinth' : 'none';

    const t = Number(sidePart?.thickness) || 15;
    const sideLocal = sidePart ? this.partGeometry.getLocalDimensions(sidePart) : null;
    const fallbackHeight = sideLocal ? sideLocal.sy + detectedBaseH : 800;
    const innerWidth = topOrBottom
      ? Number(sidePart?.orientation === 'vertical_xy' ? topOrBottom.width : topOrBottom.length) || 570
      : 570;
    const fallbackWidth = innerWidth + (2 * t);
    const doorT = doorParts.length > 0
      ? (Number(doorParts[0]?.thickness) || t)
      : (drawerFronts.length > 0 ? (Number(drawerFronts[0]?.thickness) || t) : t);
    const carcassDepth = sidePart && sideLocal
      ? (sidePart.orientation === 'vertical_xy' ? sideLocal.sx : sideLocal.sz)
      : 300;
    const fallbackDepth = carcassDepth + (doorParts.length > 0 || drawerFronts.length > 0 ? doorT : 0);

    const width = liveEnvelope ? liveEnvelope.width : fallbackWidth;
    const height = liveEnvelope ? liveEnvelope.height : fallbackHeight;
    const depth = liveEnvelope ? liveEnvelope.depth : fallbackDepth;
    const resolvedPosX = liveEnvelope ? liveEnvelope.posX : (Number(parametricParts[0]?.posX) || 0);
    const resolvedPosY = liveEnvelope
      ? liveEnvelope.posY
      : (sidePart?.posY !== undefined ? Number(sidePart.posY) : undefined);
    const resolvedPosZ = liveEnvelope ? liveEnvelope.posZ : (Number(parametricParts[0]?.posZ) || 0);
    const sideLeftPart = parametricParts.find(p => p.componentRole === 'side_left');
    const sideRightPart = parametricParts.find(p => p.componentRole === 'side_right');
    const topPart = parametricParts.find(p => p.componentRole === 'top');
    const bottomPart = parametricParts.find(p => p.componentRole === 'bottom');
    const validLeft = sideLeftPart && this.isValidBoardMaterialPart(sideLeftPart) ? sideLeftPart : undefined;
    const validRight = sideRightPart && this.isValidBoardMaterialPart(sideRightPart) ? sideRightPart : undefined;
    const validTop = topPart && this.isValidBoardMaterialPart(topPart) ? topPart : undefined;
    const validBottom = bottomPart && this.isValidBoardMaterialPart(bottomPart) ? bottomPart : undefined;
    const internalCoreCandidates = [
      ...(validBottom ? [validBottom] : []),
      ...coreStructureFallbackParts.filter(p => p.componentRole !== 'bottom')
    ];
    const coreMatId = this.detectDominantBoardMaterialId(internalCoreCandidates);
    const diffVisibleLeft = Boolean(validLeft && coreMatId && validLeft.materialId !== coreMatId);
    const diffVisibleRight = Boolean(validRight && coreMatId && validRight.materialId !== coreMatId);
    const diffVisibleTop = Boolean(validTop && coreMatId && validTop.materialId !== coreMatId);
    const detectedCustomizeVisible = diffVisibleLeft || diffVisibleRight || diffVisibleTop;
    const detectedVisibleMatId = detectedCustomizeVisible
      ? (diffVisibleLeft ? validLeft?.materialId : undefined) ||
        (diffVisibleRight ? validRight?.materialId : undefined) ||
        (diffVisibleTop ? validTop?.materialId : undefined)
      : undefined;

    const fallbackStructMatId =
      (detectedCustomizeVisible ? coreMatId : undefined) ||
      this.detectDominantBoardMaterialId(carcassMaterialParts) ||
      (sidePart && this.isValidBoardMaterialPart(sidePart) ? sidePart.materialId : 'mat-1');
    const fallbackDoorMatId =
      this.detectDominantBoardMaterialId(frontMaterialParts) || fallbackStructMatId;

    const detectedWallMountType: CabinetWallMountType | undefined =
      frenchCleatParts.length > 0
        ? 'french_cleat'
        : hangerParts.length > 0
          ? 'concealed_hanger'
          : nailerParts.length > 0
            ? 'direct_nailer'
            : undefined;
    const detectedCleatHeight =
      frenchCleatParts.length > 0 && Number.isFinite(Number(frenchCleatParts[0]?.width))
        ? Math.max(60, Math.min(120, Math.round(Number(frenchCleatParts[0].width))))
        : undefined;
    const detectedLegStyle: CabinetLegStyle | undefined =
      legParts.length > 0 ? inferLegStyleFromPart(legParts[0]) : undefined;
    const detectedRodFinish: CabinetRodFinish | undefined =
      rodParts.length > 0 ? inferRodFinishFromPart(rodParts[0]) : undefined;
    const detectedGolaFinish: CabinetGolaFinish | undefined =
      golaBarParts[0]?.hardwareConfig?.golaFinish;

    const isSpanZ =
      group.facingDirection === 'right' ||
      group.facingDirection === 'left' ||
      sidePart?.orientation === 'vertical_xy';
    const getSpanCoord = (p: Part): number => (isSpanZ ? (p.posZ ?? 0) : (p.posX ?? 0));

    const dividerParts = parametricParts
      .filter(p => p.componentRole === 'divider')
      .sort((a, b) => getSpanCoord(a) - getSpanCoord(b));

    // Solo reconstruir como cajonera pura (drawer_unit de 1 zona) si NO existen divisores,
    // puertas, entrepaños ni tubos colgadores; evita aplastar muebles multi-columna/mixtos.
    const isPureDrawerUnit =
      (drawerFronts.length > 0 || drawerBoxes.length > 0) &&
      dividerParts.length === 0 &&
      doorParts.length === 0 &&
      shelfParts.length === 0 &&
      rodParts.length === 0;

    if (isPureDrawerUnit) {
      const drawersCount = actualDrawerCount;
      const frontPart = drawerFronts[0];
      const hw = frontPart?.hardwareConfig;

      const drawerOpeningDetected =
        resolvePartOpeningSystem(hw, hw?.slideType) ??
        (golaBarParts.length > 0 ? 'gola' : undefined);
      const drawerCfg = normalizeConfig({
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
        drawerSlideType: resolveValidDrawerSlideType(hw?.slideType),
        drawerFrontType: hw?.frontMountType === 'inset' ? 'inset' : 'overlay',
        hasPlinth: detectedBaseType === 'plinth',
        plinthHeight: detectedBaseH,
        baseType: detectedBaseType,
        ...(detectedWallMountType ? { installationType: 'wall', wallMountType: detectedWallMountType } : {}),
        ...(detectedCleatHeight ? { frenchCleatHeightMm: detectedCleatHeight } : {}),
        ...(detectedLegStyle ? { legStyle: detectedLegStyle } : {}),
        ...(drawerOpeningDetected ? { openingSystem: drawerOpeningDetected } : {}),
        ...(hw?.fingerPullDeductMm !== undefined ? { fingerPullDeductMm: hw.fingerPullDeductMm } : {}),
        ...(hw?.golaFinish || detectedGolaFinish ? { golaFinish: hw?.golaFinish ?? detectedGolaFinish } : {}),
        ...(detectedCustomizeVisible
          ? {
              customizeVisibleSides: true,
              visibleSideLeft: diffVisibleLeft,
              visibleSideRight: diffVisibleRight,
              visibleTopCover: diffVisibleTop,
              visibleMaterialId: detectedVisibleMatId
            }
          : {}),
        hasHandle:
          !isNonPhysicalHandleType(hw?.handleType) &&
          (!drawerOpeningDetected || drawerOpeningDetected === 'handle'),
        handleType: hw?.handleType || 'bar_modern',
        handleFinish: hw?.handleFinish || 'brushed_steel',
        handlePosition: 'horizontal',
        structureMaterialId: fallbackStructMatId,
        doorMaterialId: fallbackDoorMatId,
        backMaterialId: backPart?.materialId || fallbackStructMatId,
        facadeGap: 3,
        posX: resolvedPosX,
        posY: resolvedPosY,
        posZ: resolvedPosZ
      });
      drawerCfg.zoneTree = buildAutoZoneTreeFromConfig(drawerCfg);
      return drawerCfg;
    }

    let doorOpening: ParametricCabinetConfig['doorOpening'] = 'none';
    if (doorParts.length >= 2) {
      doorOpening = 'double';
    } else if (doorParts.length === 1) {
      const hw = doorParts[0].hardwareConfig;
      const upperDoorName = (doorParts[0].name || '').toUpperCase();
      if (
        hw?.openingDirection === 'top' ||
        upperDoorName.includes('ABATIBLE SUPERIOR') ||
        upperDoorName.includes('ELEVABLE') ||
        upperDoorName.includes('PISTON') ||
        upperDoorName.includes('PISTÓN')
      ) {
        doorOpening = 'top';
      } else if (
        hw?.openingDirection === 'bottom' ||
        upperDoorName.includes('ABATIBLE INFERIOR')
      ) {
        doorOpening = 'bottom';
      } else if (
        hw?.openingDirection === 'right' ||
        upperDoorName.includes('DERECHA')
      ) {
        doorOpening = 'right';
      } else {
        doorOpening = 'left';
      }
    }

    const shelvesCount = Math.max(0, Math.min(8, Math.floor(Number(shelfParts.length) || 0)));
    const hangingRodsCount: 0 | 1 | 2 = actualRodCount;
    const isWallByPosition = parametricParts[0]?.name.toLowerCase().includes('alacena') || (sidePart?.posY !== undefined && sidePart.posY > 1000);

    const activeDoorsForStyle = doorParts.filter(
      p => !(p.name || '').toUpperCase().includes('PANEL CIEGO')
    );
    const hingedDoorsForStyle = activeDoorsForStyle.filter(p => !isSlidingDoorPart(p));
    const refFrontForStyle = activeDoorsForStyle[0] ?? drawerFronts[0];
    const detectedHingeStyle = pickDominantString(
      hingedDoorsForStyle.map(p => resolveValidHingeType(p.hardwareConfig?.hingeType))
    );
    const detectedSlideStyle = pickDominantString(
      drawerFronts.map(p =>
        p.hardwareConfig?.slideType && p.hardwareConfig.slideType !== 'none'
          ? resolveValidDrawerSlideType(p.hardwareConfig.slideType)
          : undefined
      )
    );

    const detectedOpeningSystem =
      resolvePartOpeningSystem(refFrontForStyle?.hardwareConfig, detectedSlideStyle) ??
      (golaBarParts.length > 0 ? 'gola' : undefined);
    const detectedFingerPullDeduct = refFrontForStyle?.hardwareConfig?.fingerPullDeductMm;
    const resolvedBaseGolaFinish = refFrontForStyle?.hardwareConfig?.golaFinish ?? detectedGolaFinish;

    const baseCfg = normalizeConfig({
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
      drawersCount: actualDrawerCount,
      ...(detectedSlideStyle ? { drawerSlideType: detectedSlideStyle } : {}),
      hangingRodsCount,
      hasPlinth: detectedBaseType === 'plinth',
      plinthHeight: detectedBaseH,
      baseType: detectedBaseType,
      ...(detectedWallMountType ? { installationType: 'wall', wallMountType: detectedWallMountType } : {}),
      ...(detectedCleatHeight ? { frenchCleatHeightMm: detectedCleatHeight } : {}),
      ...(detectedLegStyle ? { legStyle: detectedLegStyle } : {}),
      ...(detectedOpeningSystem ? { openingSystem: detectedOpeningSystem } : {}),
      ...(detectedFingerPullDeduct !== undefined ? { fingerPullDeductMm: detectedFingerPullDeduct } : {}),
      ...(resolvedBaseGolaFinish ? { golaFinish: resolvedBaseGolaFinish } : {}),
      ...(detectedRodFinish ? { hangingRodFinish: detectedRodFinish } : {}),
      ...(detectedCustomizeVisible
        ? {
            customizeVisibleSides: true,
            visibleSideLeft: diffVisibleLeft,
            visibleSideRight: diffVisibleRight,
            visibleTopCover: diffVisibleTop,
            visibleMaterialId: detectedVisibleMatId
          }
        : {}),
      hasHandle:
        !isNonPhysicalHandleType(refFrontForStyle?.hardwareConfig?.handleType) &&
        (!detectedOpeningSystem || detectedOpeningSystem === 'handle'),
      handleType: refFrontForStyle?.hardwareConfig?.handleType || 'bar_modern',
      handleFinish: refFrontForStyle?.hardwareConfig?.handleFinish || 'brushed_steel',
      handlePosition: refFrontForStyle?.hardwareConfig?.handlePosition || 'vertical',
      ...(detectedHingeStyle ? { hingeType: detectedHingeStyle } : {}),
      structureMaterialId: fallbackStructMatId,
      doorMaterialId: fallbackDoorMatId,
      backMaterialId: backPart?.materialId || fallbackStructMatId,
      facadeGap: 3,
      posX: resolvedPosX,
      posY: resolvedPosY,
      posZ: resolvedPosZ
    });

    const buildDrawerZoneContent = (count: number, sampleFront?: Part): CabinetZoneContent => {
      const hw = sampleFront?.hardwareConfig;
      const resolvedSlide: CabinetZoneDrawerConfig['slideType'] = resolveValidDrawerSlideType(
        hw?.slideType
      );
      const resolvedOpening: CabinetOpeningSystem =
        resolvePartOpeningSystem(hw, resolvedSlide) ??
        (golaBarParts.length > 0 ? 'gola' : 'handle');
      return {
        type: 'drawers',
        drawers: {
          count: Math.max(1, Math.min(6, count)),
          frontMount: hw?.frontMountType === 'inset' ? 'inset' : 'overlay',
          deductTopMm: 0,
          deductBottomMm: 0,
          deductLeftMm: 0,
          deductRightMm: 0,
          openingSystem: resolvedOpening,
          ...(hw?.fingerPullDeductMm !== undefined ? { fingerPullDeductMm: hw.fingerPullDeductMm } : {}),
          ...(hw?.golaFinish || resolvedBaseGolaFinish
            ? { golaFinish: hw?.golaFinish ?? resolvedBaseGolaFinish }
            : {}),
          slideType: resolvedSlide,
          bottomType: 'grooved'
        }
      };
    };

    const buildNonDrawerZoneContent = (
      bayDoors: Part[],
      bayShelvesCount: number,
      bayRodsCount: number,
      bayRodFinish?: CabinetRodFinish
    ): CabinetZoneContent => {
      if (bayDoors.length > 0) {
        const bayHinged = bayDoors.filter(d => !isSlidingDoorPart(d));
        const bayHinge = pickDominantString(
          bayHinged.map(d => resolveValidHingeType(d.hardwareConfig?.hingeType))
        );
        const bayDoorHw = bayDoors[0].hardwareConfig;
        const bayHandleType = bayDoorHw?.handleType || 'bar_modern';
        const bayOpening = resolvePartOpeningSystem(bayDoorHw);
        return {
          type: 'doors',
          doors: {
            opening:
              bayDoors.length >= 2
                ? 'double'
                : bayDoorHw?.openingDirection === 'right'
                  ? 'right'
                  : 'left',
            mount: bayDoorHw?.frontMountType === 'inset' ? 'inset' : 'overlay',
            ...(bayHinge ? { hingeType: bayHinge } : {}),
            hasHandle:
              !isNonPhysicalHandleType(bayHandleType) &&
              (!bayOpening || bayOpening === 'handle'),
            ...(bayOpening ? { openingSystem: bayOpening } : {}),
            ...(bayDoorHw?.fingerPullDeductMm !== undefined
              ? { fingerPullDeductMm: bayDoorHw.fingerPullDeductMm }
              : {}),
            ...(bayDoorHw?.golaFinish ? { golaFinish: bayDoorHw.golaFinish } : {}),
            ...(bayDoorHw?.handlePosition ? { handlePosition: bayDoorHw.handlePosition } : {}),
            handleType: bayHandleType,
            handleFinish: bayDoorHw?.handleFinish || 'brushed_steel'
          },
          ...(bayShelvesCount > 0 ? { shelvesCount: bayShelvesCount, shelfSetbackMm: 20 } : {}),
          ...(bayRodsCount > 0 ? { hangingRodsCount: bayRodsCount >= 2 ? 2 : 1 } : {}),
          ...(bayRodsCount > 0 && (bayRodFinish ?? detectedRodFinish)
            ? { hangingRodFinish: bayRodFinish ?? detectedRodFinish }
            : {})
        };
      }
      if (bayRodsCount > 0) {
        return {
          type: 'hanging_rod',
          hangingRodsCount: bayRodsCount >= 2 ? 2 : 1,
          ...(bayRodFinish ?? detectedRodFinish
            ? { hangingRodFinish: bayRodFinish ?? detectedRodFinish }
            : {})
        };
      }
      if (bayShelvesCount > 0) {
        return { type: 'shelves', shelvesCount: bayShelvesCount, shelfSetbackMm: 10 };
      }
      return { type: 'empty' };
    };

    const buildBayNode = (
      nodeId: string,
      bayW: number | undefined,
      bayDoors: Part[],
      bayShelvesParts: Part[],
      bayRodsParts: Part[],
      bayDrawerFronts: Part[],
      bayDrawerBoxes: Part[]
    ): CabinetZoneNode => {
      const bayDrawerCount =
        bayDrawerFronts.length > 0
          ? bayDrawerFronts.length
          : bayDrawerBoxes.length > 0
            ? Math.max(1, Math.round(bayDrawerBoxes.length / 5))
            : 0;
      const hasOtherContent =
        bayDoors.length > 0 || bayShelvesParts.length > 0 || bayRodsParts.length > 0;

      if (bayDrawerCount > 0 && hasOtherContent) {
        const drawerPartsAll = bayDrawerFronts.length > 0 ? bayDrawerFronts : bayDrawerBoxes;
        const avgDrawerY =
          drawerPartsAll.reduce((acc, pt) => acc + (pt.posY ?? 0), 0) /
          Math.max(1, drawerPartsAll.length);
        const nonSeparatorShelves = bayShelvesParts.filter(
          s => !(s.notes || '').toLowerCase().includes('divisor horizontal')
        );
        const otherPartsAll = [...bayDoors, ...bayRodsParts, ...nonSeparatorShelves];
        const refOtherParts = otherPartsAll.length > 0 ? otherPartsAll : bayShelvesParts;
        const avgOtherY =
          refOtherParts.reduce((acc, pt) => acc + (pt.posY ?? 0), 0) /
          Math.max(1, refOtherParts.length);

        const drawerChild: CabinetZoneNode = {
          id: `${nodeId}_drawers`,
          splitDirection: 'none',
          sizeRatio: 0.45,
          content: buildDrawerZoneContent(bayDrawerCount, bayDrawerFronts[0])
        };
        const otherChild: CabinetZoneNode = {
          id: `${nodeId}_upper`,
          splitDirection: 'none',
          sizeRatio: 0.55,
          content: buildNonDrawerZoneContent(
            bayDoors,
            nonSeparatorShelves.length,
            bayRodsParts.length,
            bayRodsParts[0] ? inferRodFinishFromPart(bayRodsParts[0]) : undefined
          )
        };
        // Convención splitDirection === 'horizontal': children[0] arriba (+Y), children[1] abajo (-Y)
        const children = avgDrawerY <= avgOtherY ? [otherChild, drawerChild] : [drawerChild, otherChild];
        return {
          id: nodeId,
          splitDirection: 'horizontal',
          ...(bayW !== undefined ? { exactSizeMm: bayW } : {}),
          children
        };
      }

      if (bayDrawerCount > 0) {
        return {
          id: nodeId,
          splitDirection: 'none',
          ...(bayW !== undefined ? { exactSizeMm: bayW } : {}),
          content: buildDrawerZoneContent(bayDrawerCount, bayDrawerFronts[0])
        };
      }

      return {
        id: nodeId,
        splitDirection: 'none',
        ...(bayW !== undefined ? { exactSizeMm: bayW } : {}),
        content: buildNonDrawerZoneContent(
          bayDoors,
          bayShelvesParts.length,
          bayRodsParts.length,
          bayRodsParts[0] ? inferRodFinishFromPart(bayRodsParts[0]) : undefined
        )
      };
    };

    if (dividerParts.length > 0 && sidePart) {
      const bayBoundaries: number[] = [];
      const centerSpan = isSpanZ ? (baseCfg.posZ ?? 0) : (baseCfg.posX ?? 0);
      const sideLeftPart = parametricParts.find(p => p.componentRole === 'side_left');
      const sideRightPart = parametricParts.find(p => p.componentRole === 'side_right');
      const rawSideA = sideLeftPart ? getSpanCoord(sideLeftPart) : centerSpan - width / 2 + t / 2;
      const rawSideB = sideRightPart ? getSpanCoord(sideRightPart) : centerSpan + width / 2 - t / 2;
      const minSpanSide = Math.min(rawSideA, rawSideB) + t / 2;
      const maxSpanSide = Math.max(rawSideA, rawSideB) - t / 2;
      bayBoundaries.push(minSpanSide);
      for (const div of dividerParts) {
        const divSpan = getSpanCoord(div);
        bayBoundaries.push(divSpan - t / 2, divSpan + t / 2);
      }
      bayBoundaries.push(maxSpanSide);

      const bayChildren: CabinetZoneNode[] = [];
      for (let bIdx = 0; bIdx + 1 < bayBoundaries.length; bIdx += 2) {
        const bMin = bayBoundaries[bIdx];
        const bMax = bayBoundaries[bIdx + 1];
        const bayW = Math.max(50, Math.round(bMax - bMin));
        const inBay = (p: Part): boolean => {
          const coord = getSpanCoord(p);
          return coord >= bMin - 2 && coord <= bMax + 2;
        };
        const bayDoors = doorParts.filter(inBay);
        const bayShelvesParts = shelfParts.filter(inBay);
        const bayRodsParts = rodParts.filter(inBay);
        const bayDrawerFronts = drawerFronts.filter(inBay);
        const bayDrawerBoxes = drawerBoxes.filter(inBay);

        bayChildren.push(
          buildBayNode(
            `zone_auto_bay_${bIdx / 2 + 1}`,
            bayW,
            bayDoors,
            bayShelvesParts,
            bayRodsParts,
            bayDrawerFronts,
            bayDrawerBoxes
          )
        );
      }

      baseCfg.zoneTree = {
        id: buildAutoZoneSignature({
          shelves: shelvesCount,
          drawers: actualDrawerCount,
          doorOpening,
          rods: hangingRodsCount,
          plinth: detectedBaseType !== 'none',
          tieStrips: false,
          moduleType: baseCfg.moduleType,
          split: 'vertical'
        }),
        splitDirection: 'vertical',
        children: bayChildren
      };
    } else if (actualDrawerCount > 0) {
      baseCfg.zoneTree = buildBayNode(
        buildAutoZoneSignature({
          shelves: shelvesCount,
          drawers: actualDrawerCount,
          doorOpening,
          rods: hangingRodsCount,
          plinth: detectedBaseType !== 'none',
          tieStrips: false,
          moduleType: baseCfg.moduleType,
          split: 'horizontal'
        }),
        undefined,
        doorParts,
        shelfParts,
        rodParts,
        drawerFronts,
        drawerBoxes
      );
    } else {
      baseCfg.zoneTree = buildAutoZoneTreeFromConfig(baseCfg);
    }

    return baseCfg;
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

  generateParametricCabinetParts(
    config: ParametricCabinetConfig,
    materials: Material[]
  ): { module: FurnitureModule; parts: Part[]; group: PartGroup } {
    return this.generateParametricCabinet(config, materials);
  }

  extractParametricConfigFromGroup(parts: Part[], group: PartGroup): ParametricCabinetConfig {
    return this.reconstructConfigFromParts(parts, group);
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
    const hasHandle = config.hasHandle !== false && !isNonPhysicalHandleType(config.handleType);
    const hType: HandleType = hasHandle
      ? config.handleType || 'bar_modern'
      : config.handleType && isNonPhysicalHandleType(config.handleType)
        ? config.handleType
        : 'none';
    const hFinish = config.handleFinish || 'brushed_steel';
    const resolvedDoorHinge: HingeType = config.hingeType || 'straight';
    const resolvedLiftHinge: HingeType = config.hingeType || 'gas_piston';

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
            hingeType: resolvedDoorHinge,
            handleType: hType,
            handleFinish: hFinish,
            handlePosition: hasHandle ? 'vertical' : 'none',
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
          hingeType: resolvedDoorHinge,
          handleType: hType,
          handleFinish: hFinish,
          handlePosition: hasHandle ? 'vertical' : 'none',
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
            hingeType: resolvedDoorHinge,
            handleType: hType,
            handleFinish: hFinish,
            handlePosition: hasHandle ? 'horizontal' : 'none',
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
            hingeType: resolvedDoorHinge,
            handleType: hType,
            handleFinish: hFinish,
            handlePosition: hasHandle ? 'vertical' : 'none',
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
            hingeType: resolvedDoorHinge,
            handleType: hType,
            handleFinish: hFinish,
            handlePosition: hasHandle ? 'vertical' : 'none',
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
            hingeType: resolvedDoorHinge,
            handleType: hType,
            handleFinish: hFinish,
            handlePosition: hasHandle ? 'vertical' : 'none',
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
            hingeType: resolvedLiftHinge,
            handleType: hType,
            handleFinish: hFinish,
            handlePosition: hasHandle ? 'horizontal' : 'none',
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

    const taggedParts: Part[] = parts.map(pt => ({ ...pt, isParametricGenerated: true }));
    return { module, parts: taggedParts, group };
  }

  /**
   * Calcula de forma determinista el árbol completo de cotas 3D de todas las zonas del mueble.
   * Orden en `splitDirection === 'vertical'`: izquierda (-X) -> derecha (+X).
   * Orden en `splitDirection === 'horizontal'`: arriba (+Y) -> abajo (-Y).
   */
  computeZoneBoundsLayout(config: ParametricCabinetConfig): CabinetZoneLayoutNode {
    return computeZoneBoundsLayout(config);
  }

  /**
   * Calcula las cajas envolventes 3D de resaltado por cada zona (`zoneId`) para la escena 3D.
   * Si se entregan `groupParts`, alinea automáticamente las cajas al centro y rotación real del módulo en escena.
   */
  computeZoneHighlightBoxes(
    config: ParametricCabinetConfig,
    groupParts?: Part[]
  ): Map<string, CabinetZoneHighlightBox> {
    const layout = computeZoneBoundsLayout(config);
    const frame = resolveZoneCarcassFrame(config);
    const map = new Map<string, CabinetZoneHighlightBox>();

    let facing: 'front' | 'right' | 'back' | 'left' = 'front';
    let offsetX = 0;
    let offsetY = 0;
    let offsetZ = 0;
    let pivotX = frame.posX;
    let pivotZ = frame.carcassCenterZ;
    let targetCx = frame.posX;
    let targetCz = frame.carcassCenterZ;

    if (groupParts && groupParts.length > 0) {
      const filteredParametric = groupParts.filter(p => isPartParametricGenerated(p, groupParts));
      const parametricParts = filteredParametric.length > 0 ? filteredParametric : groupParts;

      const carcassParts = parametricParts.filter(
        p =>
          p.componentRole === 'side_left' ||
          p.componentRole === 'side_right' ||
          p.componentRole === 'top' ||
          p.componentRole === 'bottom' ||
          p.componentRole === 'tie' ||
          p.componentRole === 'plinth' ||
          isCabinetLegPart(p)
      );
      const refParts = carcassParts.length > 0 ? carcassParts : parametricParts;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const p of refParts) {
        const b = this.partGeometry.getWorldAABB(p);
        if (b.minX < minX) minX = b.minX;
        if (b.maxX > maxX) maxX = b.maxX;
        if (b.minY < minY) minY = b.minY;
        if (b.maxY > maxY) maxY = b.maxY;
        if (b.minZ < minZ) minZ = b.minZ;
        if (b.maxZ > maxZ) maxZ = b.maxZ;
      }

      if (Number.isFinite(minX)) {
        targetCx = (minX + maxX) / 2;
        targetCz = (minZ + maxZ) / 2;
        const canonicalMinY = frame.posY - frame.h / 2;
        offsetY = minY - canonicalMinY;
        offsetX = targetCx - frame.posX;
        offsetZ = targetCz - frame.carcassCenterZ;
        pivotX = frame.posX;
        pivotZ = frame.carcassCenterZ;

        const sideLeft = parametricParts.find(p => p.componentRole === 'side_left');
        const backPart = parametricParts.find(p => p.componentRole === 'back');
        const frontPart = parametricParts.find(p => p.componentRole === 'door' || p.componentRole === 'drawer_front');

        if (sideLeft?.orientation === 'vertical_xy') {
          if (frontPart) {
            facing = (frontPart.posX ?? targetCx) >= targetCx ? 'right' : 'left';
          } else if (backPart) {
            facing = (backPart.posX ?? targetCx) <= targetCx ? 'right' : 'left';
          } else {
            facing = 'right';
          }
        } else if (backPart && (backPart.posZ ?? targetCz) > targetCz) {
          facing = 'back';
        } else if (frontPart && (frontPart.posZ ?? targetCz) < targetCz) {
          facing = 'back';
        }
      }
    }

    const transformPoint = (x: number, y: number, z: number): { x: number; y: number; z: number } => {
      const dx = x - pivotX;
      const dz = z - pivotZ;
      let rx = dx;
      let rz = dz;
      if (facing === 'right') {
        rx = dz;
        rz = -dx;
      } else if (facing === 'left') {
        rx = -dz;
        rz = dx;
      } else if (facing === 'back') {
        rx = -dx;
        rz = -dz;
      }
      return {
        x: Math.round((pivotX + rx + offsetX) * 10) / 10,
        y: Math.round((y + offsetY) * 10) / 10,
        z: Math.round((pivotZ + rz + offsetZ) * 10) / 10
      };
    };

    const collect = (node: CabinetZoneLayoutNode) => {
      const p1 = transformPoint(node.minX, node.minY, node.minZ);
      const p2 = transformPoint(node.maxX, node.maxY, node.maxZ);
      map.set(node.zoneId, {
        zoneId: node.zoneId,
        minX: Math.min(p1.x, p2.x),
        maxX: Math.max(p1.x, p2.x),
        minY: Math.min(p1.y, p2.y),
        maxY: Math.max(p1.y, p2.y),
        minZ: Math.min(p1.z, p2.z),
        maxZ: Math.max(p1.z, p2.z)
      });
      for (const ch of node.children) {
        collect(ch);
      }
    };

    collect(layout);
    return map;
  }

  /**
   * Hidrata un `zoneTree` editable y `baseType` a partir de cualquier configuración paramétrica plana.
   */
  hydrateZoneTreeFromConfig(cfg: ParametricCabinetConfig): ParametricCabinetConfig {
    if (cfg.zoneTree) {
      return {
        ...cfg,
        baseType: resolveCabinetBaseType(cfg),
        zoneTree: deepCloneZoneNode(cfg.zoneTree)
      };
    }
    const baseType = resolveCabinetBaseType(cfg);
    return {
      ...cfg,
      baseType,
      zoneTree: buildAutoZoneTreeFromConfig({ ...cfg, baseType })
    };
  }

  private alignHydratedTemplateDefaults(cfg: ParametricCabinetConfig): ParametricCabinetConfig {
    const installationType = resolveInstallationType(cfg);
    const baseType = installationType === 'wall' ? 'none' : resolveCabinetBaseType(cfg);
    const wallMountType: CabinetWallMountType | undefined =
      installationType === 'wall' ? (cfg.wallMountType ?? 'french_cleat') : undefined;
    const openingSystem: CabinetOpeningSystem =
      cfg.openingSystem ??
      resolveOpeningSystemFromHandle(cfg.handleType, cfg.hasHandle, cfg.drawerSlideType);

    return this.hydrateZoneTreeFromConfig({
      ...cfg,
      installationType,
      baseType,
      hasPlinth: baseType === 'plinth',
      plinthHeight: baseType === 'none' ? 0 : cfg.plinthHeight,
      ...(wallMountType ? { wallMountType } : {}),
      ...(wallMountType === 'french_cleat'
        ? { frenchCleatHeightMm: cfg.frenchCleatHeightMm ?? 80 }
        : {}),
      ...(installationType === 'floor' && baseType === 'plinth'
        ? { plinthRecessMm: cfg.plinthRecessMm ?? 40 }
        : {}),
      ...(installationType === 'floor' && baseType === 'legs'
        ? { legStyle: cfg.legStyle ?? 'cylindrical_inox' }
        : {}),
      openingSystem,
      ...(openingSystem === 'finger_pull'
        ? { fingerPullDeductMm: cfg.fingerPullDeductMm ?? 26 }
        : cfg.fingerPullDeductMm !== undefined
          ? { fingerPullDeductMm: cfg.fingerPullDeductMm }
          : {}),
      ...(openingSystem === 'gola'
        ? { golaFinish: cfg.golaFinish ?? 'natural_aluminum' }
        : cfg.golaFinish
          ? { golaFinish: cfg.golaFinish }
          : {}),
      ...(cfg.hangingRodsCount && cfg.hangingRodsCount > 0
        ? { hangingRodFinish: cfg.hangingRodFinish ?? 'chrome' }
        : cfg.hangingRodFinish
          ? { hangingRodFinish: cfg.hangingRodFinish }
          : {})
    });
  }

  /**
   * Hidrata una configuración paramétrica completa con `zoneTree` desde una plantilla del catálogo.
   */
  hydrateTemplateConfig(
    template: FurnitureTemplate,
    materials: Material[]
  ): ParametricCabinetConfig {
    const fallbackMat = materials.find(m => m.textureType !== 'stone' && m.thickness >= 12) ||
      materials[0] || {
        id: 'mat_default',
        name: 'Melamina Blanco Frost Mate',
        thickness: 15,
        sheetLength: 2440,
        sheetWidth: 1830,
        sheetCost: 185000,
        hasGrain: false,
        colorHex: '#f8fafc'
      };
    const backMat = materials.find(m => m.thickness <= 6) || fallbackMat;
    const whiteMat = materials.find(m => m.name.toLowerCase().includes('blanco') && m.thickness >= 12) || fallbackMat;

    if (template.parametricConfig) {
      const partial = template.parametricConfig;
      const w = Number(partial.width) || template.dimensions.width || 600;
      const h = Number(partial.height) || template.dimensions.height || 800;
      const d = Number(partial.depth) || template.dimensions.depth || 400;
      const baseCfg: ParametricCabinetConfig = {
        code: partial.code || template.id.toUpperCase().slice(0, 10),
        name: partial.name || template.name,
        moduleType: partial.moduleType || 'base_cabinet',
        category: partial.category || 'kitchen_base',
        environmentLine: partial.environmentLine || template.environmentLine,
        width: w,
        height: h,
        depth: d,
        structureThickness: Number(partial.structureThickness) || whiteMat.thickness || 15,
        doorThickness: Number(partial.doorThickness) || whiteMat.thickness || 15,
        backThickness: Number(partial.backThickness) || 3,
        backType: partial.backType || (partial.hasBackPanel === false ? 'none' : 'groove'),
        hasBackPanel: partial.hasBackPanel !== undefined ? partial.hasBackPanel : (partial.backType !== 'none'),
        shelvesCount: Number(partial.shelvesCount) || 0,
        shelfDistribution: partial.shelfDistribution || 'uniform',
        shelfManualOffsets: partial.shelfManualOffsets,
        doorOpening: partial.doorOpening || 'none',
        hasHandle: partial.hasHandle !== undefined ? partial.hasHandle : true,
        handleType: partial.handleType || 'bar_modern',
        handleFinish: partial.handleFinish || 'brushed_steel',
        handlePosition: partial.handlePosition || 'vertical',
        ...(partial.hingeType ? { hingeType: partial.hingeType } : {}),
        structureMaterialId: partial.structureMaterialId || whiteMat.id,
        doorMaterialId: partial.doorMaterialId || whiteMat.id,
        backMaterialId: partial.backMaterialId || backMat.id,
        facadeGap: partial.facadeGap ?? 3,
        drawersCount: partial.drawersCount,
        drawerSlideType: partial.drawerSlideType,
        drawerFrontType: partial.drawerFrontType,
        hasPlinth: partial.hasPlinth,
        plinthHeight: partial.plinthHeight,
        hasTopCover: partial.hasTopCover,
        topTieStrips: partial.topTieStrips,
        elevationY: partial.elevationY,
        siphonCutout: partial.siphonCutout,
        hangingRodsCount: partial.hangingRodsCount,
        cornerReturnWidth: partial.cornerReturnWidth,
        baseType: partial.baseType,
        ...(partial.installationType ? { installationType: partial.installationType } : {}),
        ...(partial.wallMountType ? { wallMountType: partial.wallMountType } : {}),
        ...(partial.frenchCleatHeightMm !== undefined ? { frenchCleatHeightMm: partial.frenchCleatHeightMm } : {}),
        ...(partial.plinthRecessMm !== undefined ? { plinthRecessMm: partial.plinthRecessMm } : {}),
        ...(partial.legStyle ? { legStyle: partial.legStyle } : {}),
        ...(partial.openingSystem ? { openingSystem: partial.openingSystem } : {}),
        ...(partial.fingerPullDeductMm !== undefined ? { fingerPullDeductMm: partial.fingerPullDeductMm } : {}),
        ...(partial.golaFinish ? { golaFinish: partial.golaFinish } : {}),
        ...(partial.hangingRodFinish ? { hangingRodFinish: partial.hangingRodFinish } : {}),
        ...(partial.customizeVisibleSides !== undefined
          ? { customizeVisibleSides: partial.customizeVisibleSides }
          : {}),
        ...(partial.visibleSideLeft !== undefined ? { visibleSideLeft: partial.visibleSideLeft } : {}),
        ...(partial.visibleSideRight !== undefined ? { visibleSideRight: partial.visibleSideRight } : {}),
        ...(partial.visibleTopCover !== undefined ? { visibleTopCover: partial.visibleTopCover } : {}),
        ...(partial.visibleMaterialId ? { visibleMaterialId: partial.visibleMaterialId } : {}),
        zoneTree: partial.zoneTree ? deepCloneZoneNode(partial.zoneTree) : undefined
      };
      return this.alignHydratedTemplateDefaults(baseCfg);
    }

    const parts = template.generateParts(materials.length > 0 ? materials : [whiteMat, backMat], 0);
    const dummyGroup: PartGroup = {
      id: `grp_${template.id}`,
      name: template.name,
      type: 'assembly'
    };
    const reconstructed = this.reconstructConfigFromParts(parts, dummyGroup);
    return this.alignHydratedTemplateDefaults({
      ...reconstructed,
      environmentLine: template.environmentLine,
      width: template.dimensions.width || reconstructed.width,
      height: template.dimensions.height || reconstructed.height,
      depth: template.dimensions.depth || reconstructed.depth
    });
  }

  /**
   * Hidrata un `ParametricCabinetConfig` con `zoneTree` a partir de piezas colocadas y/o plantilla origen.
   */
  hydrateConfigFromPartsOrTemplate(
    parts: Part[],
    group: PartGroup,
    template?: FurnitureTemplate,
    materials: Material[] = []
  ): ParametricCabinetConfig {
    if (group.parametricConfig) {
      const reconstructed = this.reconstructConfigFromParts(parts, group);
      return this.hydrateZoneTreeFromConfig(reconstructed);
    }
    if (template) {
      const fromTemplate = this.hydrateTemplateConfig(template, materials);
      const filtered = parts.filter(p => isPartParametricGenerated(p, parts));
      const refParts = filtered.length > 0 ? filtered : parts;
      const envelope = this.detectLiveOuterEnvelope(refParts, group);
      const sidePart =
        refParts.find(p => p.componentRole === 'side_left' || p.componentRole === 'side_right') ||
        refParts[0];
      return {
        ...fromTemplate,
        name: group.name || fromTemplate.name,
        posX: envelope
          ? envelope.posX
          : (Number.isFinite(Number(refParts[0]?.posX)) ? Number(refParts[0]?.posX) : fromTemplate.posX),
        posY: envelope
          ? envelope.posY
          : (sidePart?.posY !== undefined ? Number(sidePart.posY) : fromTemplate.posY),
        posZ: envelope
          ? envelope.posZ
          : (Number.isFinite(Number(refParts[0]?.posZ)) ? Number(refParts[0]?.posZ) : fromTemplate.posZ)
      };
    }
    return this.hydrateZoneTreeFromConfig(this.reconstructConfigFromParts(parts, group));
  }

  /**
   * Resume los componentes reales generados por una plantilla (piezas, puertas, cajones, repisas y tubos).
   */
  summarizeTemplateComponents(
    template: FurnitureTemplate,
    materials: Material[]
  ): {
    partsCount: number;
    doorsCount: number;
    drawersCount: number;
    shelvesCount: number;
    rodsCount: number;
  } {
    const parts = template.generateParts(materials, 0);
    let partsCount = 0;
    let doorsCount = 0;
    let drawersCount = 0;
    let shelvesCount = 0;
    let rodsCount = 0;

    for (const p of parts) {
      const qty = Math.max(1, Number(p.quantity) || 1);
      partsCount += qty;
      if (p.componentRole === 'door') {
        doorsCount += qty;
      } else if (p.componentRole === 'drawer_front') {
        drawersCount += qty;
      } else if (p.componentRole === 'shelf') {
        shelvesCount += qty;
      } else if (p.shapeType === 'circle' && isCabinetRodPart(p)) {
        rodsCount += qty;
      }
    }

    return {
      partsCount,
      doorsCount,
      drawersCount,
      shelvesCount,
      rodsCount
    };
  }

  /**
   * Motor Paramétrico Recursivo por Zonas:
   * - Paso A: Casco exterior (laterales, piso, techo/amarres, fondo ranurado/galce/sobrepuesto/sin fondo, zócalo o patas).
   * - Paso B: Subdivisión recursiva vertical (izquierda -> derecha) u horizontal (arriba -> abajo)
   *   con contenidos independientes por zona y cero colisiones físicas.
   */
  generateZoneCabinet(
    config: ParametricCabinetConfig,
    materials: Material[],
    options?: { groupId?: string; moduleId?: string }
  ): { module: FurnitureModule; parts: Part[]; group: PartGroup } {
    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 6);
    const moduleId = options?.moduleId || config.id || `module_zone_${stamp}_${rand}`;
    const groupId = options?.groupId || `group_zone_${stamp}_${rand}`;
    const groupName = config.name || `Módulo por Zonas (${config.code || 'ZON001'})`;

    const fallbackMat: Material = {
      id: 'mat_default',
      name: 'Melamina Blanco Frost Mate',
      thickness: 15,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 185000,
      hasGrain: false,
      colorHex: '#f8fafc',
      textureType: 'solid'
    };
    const mainMat =
      materials.find(m => m.id === config.structureMaterialId) ||
      materials.find(m => m.textureType !== 'stone' && m.thickness >= 12) ||
      materials[0] ||
      fallbackMat;
    const doorMat = materials.find(m => m.id === config.doorMaterialId) || mainMat;
    const backMat =
      materials.find(m => m.id === config.backMaterialId) ||
      materials.find(m => m.thickness <= 6) ||
      mainMat;
    const candidateVisibleMat =
      config.customizeVisibleSides && config.visibleMaterialId
        ? materials.find(m => m.id === config.visibleMaterialId)
        : undefined;
    const visibleMat =
      candidateVisibleMat && !isCountertopMaterial(candidateVisibleMat) && candidateVisibleMat.thickness > 6
        ? candidateVisibleMat
        : undefined;
    const sideLeftMat =
      config.customizeVisibleSides && config.visibleSideLeft && visibleMat ? visibleMat : mainMat;
    const sideRightMat =
      config.customizeVisibleSides && config.visibleSideRight && visibleMat ? visibleMat : mainMat;
    const topCoverMat =
      config.customizeVisibleSides && config.visibleTopCover && visibleMat ? visibleMat : mainMat;

    const effectiveTree: CabinetZoneNode = config.zoneTree
      ? deepCloneZoneNode(config.zoneTree)
      : buildAutoZoneTreeFromConfig(config);

    const effT = Math.max(9, Math.min(30, Number(config.structureThickness) || mainMat.thickness || 15));
    const effDoorT = Math.max(9, Math.min(30, Number(config.doorThickness) || doorMat.thickness || effT));
    const effBackT = Math.max(3, Number(config.backThickness) || (backMat.thickness <= 6 ? backMat.thickness : 3));

    const resolvedInstallType = resolveInstallationType(config);
    const resolvedWallMount: CabinetWallMountType | undefined =
      resolvedInstallType === 'wall' ? (config.wallMountType ?? 'french_cleat') : undefined;
    const effectiveConfig: ParametricCabinetConfig = {
      ...config,
      installationType: resolvedInstallType,
      ...(resolvedWallMount ? { wallMountType: resolvedWallMount } : {}),
      structureThickness: effT,
      doorThickness: effDoorT,
      backThickness: effBackT,
      baseType: resolveCabinetBaseType({ ...config, installationType: resolvedInstallType }),
      zoneTree: effectiveTree
    };

    const frame = resolveZoneCarcassFrame(effectiveConfig, effT, effDoorT, effBackT);
    const layout = computeZoneBoundsLayout(effectiveConfig);
    const parts: Part[] = [];
    let uidCounter = 1;
    const nextId = (slug: string): string => `${moduleId}_${slug}_${uidCounter++}_${stamp}`;

    const roundMm = (val: number): number => Math.round(val * 10) / 10;

    // --- PASO A: CASCO EXTERIOR ---
    // 1. Lateral Izquierdo y Derecho
    parts.push({
      id: nextId('lat_izq'),
      name: 'Lateral Izquierdo',
      moduleId,
      moduleName: groupName,
      groupId,
      groupName,
      length: roundMm(frame.sideH),
      width: roundMm(frame.carcassDepth),
      thickness: frame.t,
      quantity: 1,
      materialId: sideLeftMat.id,
      materialName: sideLeftMat.name,
      colorHex: sideLeftMat.colorHex,
      grain: sideLeftMat.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
      posX: roundMm(frame.posX - frame.w / 2 + frame.t / 2),
      posY: roundMm(frame.sideCenterY),
      posZ: roundMm(frame.carcassCenterZ),
      orientation: 'vertical_yz',
      componentRole: 'side_left',
      notes: 'Lateral exterior izquierdo'
    });

    parts.push({
      id: nextId('lat_der'),
      name: 'Lateral Derecho',
      moduleId,
      moduleName: groupName,
      groupId,
      groupName,
      length: roundMm(frame.sideH),
      width: roundMm(frame.carcassDepth),
      thickness: frame.t,
      quantity: 1,
      materialId: sideRightMat.id,
      materialName: sideRightMat.name,
      colorHex: sideRightMat.colorHex,
      grain: sideRightMat.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
      posX: roundMm(frame.posX + frame.w / 2 - frame.t / 2),
      posY: roundMm(frame.sideCenterY),
      posZ: roundMm(frame.carcassCenterZ),
      orientation: 'vertical_yz',
      componentRole: 'side_right',
      notes: 'Lateral exterior derecho'
    });

    // 2. Techo Superior o Amarres Superiores
    if (frame.topTieStrips) {
      const tieWidth = Math.min(90, Math.max(30, Math.floor((frame.carcassDepth - frame.cleatPocket) / 3)));
      parts.push({
        id: nextId('tirante_front'),
        name: 'Amarre Superior Frontal',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: roundMm(frame.innerWidth),
        width: tieWidth,
        thickness: frame.t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        colorHex: mainMat.colorHex,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: roundMm(frame.posX),
        posY: roundMm(frame.topY),
        posZ: roundMm(frame.carcassFrontZ - tieWidth / 2),
        orientation: 'horizontal',
        componentRole: 'tie',
        notes: 'Amarre frontal superior para mesón'
      });
      parts.push({
        id: nextId('tirante_back'),
        name: 'Amarre Superior Trasero',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: roundMm(frame.innerWidth),
        width: tieWidth,
        thickness: frame.t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        colorHex: mainMat.colorHex,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: roundMm(frame.posX),
        posY: roundMm(frame.topY),
        posZ: roundMm(frame.carcassBackZ + frame.cleatPocket + tieWidth / 2),
        orientation: 'horizontal',
        componentRole: 'tie',
        notes: 'Amarre trasero superior para mesón'
      });
    } else if (effectiveConfig.hasTopCover !== false) {
      const topPart: Part = {
        id: nextId('techo'),
        name: 'Techo Superior',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: roundMm(frame.innerWidth),
        width: roundMm(frame.carcassDepth),
        thickness: frame.t,
        quantity: 1,
        materialId: topCoverMat.id,
        materialName: topCoverMat.name,
        colorHex: topCoverMat.colorHex,
        grain: topCoverMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: roundMm(frame.posX),
        posY: roundMm(frame.topY),
        posZ: roundMm(frame.carcassCenterZ),
        orientation: 'horizontal',
        componentRole: 'top',
        notes: 'Tapa superior estructural'
      };
      if (effectiveConfig.siphonCutout?.enabled) {
        topPart.cornerCutConfig = {
          type: 'u_siphon_cutout',
          corner: 'back_left',
          cutX: effectiveConfig.siphonCutout.width || 200,
          cutY: effectiveConfig.siphonCutout.depth || 250
        };
      }
      parts.push(topPart);
    }

    // 3. Piso Inferior
    parts.push({
      id: nextId('base'),
      name: 'Piso Inferior',
      moduleId,
      moduleName: groupName,
      groupId,
      groupName,
      length: roundMm(frame.innerWidth),
      width: roundMm(frame.carcassDepth),
      thickness: frame.t,
      quantity: 1,
      materialId: mainMat.id,
      materialName: mainMat.name,
      colorHex: mainMat.colorHex,
      grain: mainMat.hasGrain ? 'length' : 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX: roundMm(frame.posX),
      posY: roundMm(frame.bottomOfCarcassY + frame.t / 2),
      posZ: roundMm(frame.carcassCenterZ),
      orientation: 'horizontal',
      componentRole: 'bottom',
      notes: 'Base inferior estructural'
    });

    // 4. Base Inferior: Zócalo Perimetral o Patas Cilíndricas / Niveladoras (solo en modo piso)
    if (frame.baseType === 'plinth' && frame.plinthH > 0) {
      const sideRecess = Math.min(25, Math.floor(frame.w / 8));
      const maxFrontRecess = Math.max(0, frame.carcassDepth - frame.t - 20);
      const rawFrontRecess =
        effectiveConfig.plinthRecessMm !== undefined &&
        Number.isFinite(Number(effectiveConfig.plinthRecessMm))
          ? Number(effectiveConfig.plinthRecessMm)
          : 40;
      const frontRecess = Math.max(0, Math.min(maxFrontRecess, rawFrontRecess));
      const plinthOuterW = Math.max(40, frame.w - 2 * sideRecess);
      const plinthCenterY = frame.posY - frame.h / 2 + frame.plinthH / 2;
      const frontPlinthPosZ = frame.carcassFrontZ - frontRecess - frame.t / 2;
      const frontPlinthBackEdgeZ = frame.carcassFrontZ - frontRecess - frame.t;

      parts.push({
        id: nextId('zocalo_f'),
        name: 'Zócalo Frontal',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: roundMm(plinthOuterW),
        width: roundMm(frame.plinthH),
        thickness: frame.t,
        quantity: 1,
        materialId: mainMat.id,
        materialName: mainMat.name,
        colorHex: mainMat.colorHex,
        grain: mainMat.hasGrain ? 'length' : 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: roundMm(frame.posX),
        posY: roundMm(plinthCenterY),
        posZ: roundMm(frontPlinthPosZ),
        orientation: 'vertical_xy',
        componentRole: 'plinth',
        notes: `Zócalo frontal perimetral (remetido ${Math.round(frontRecess)}mm)`
      });

      const availableBehindFront = frontPlinthBackEdgeZ - frame.carcassBackZ;
      if (availableBehindFront >= frame.t + 16) {
        const rearRecess = Math.min(
          Math.min(25, Math.floor(frame.carcassDepth / 6)),
          Math.max(0, availableBehindFront - frame.t - 10)
        );
        const rearPlinthPosZ = frame.carcassBackZ + rearRecess + frame.t / 2;
        const rearPlinthFrontEdgeZ = frame.carcassBackZ + rearRecess + frame.t;
        const plinthInnerD = Math.max(10, frontPlinthBackEdgeZ - rearPlinthFrontEdgeZ);
        const sidePlinthCenterZ = rearPlinthFrontEdgeZ + plinthInnerD / 2;

        parts.push({
          id: nextId('zocalo_t'),
          name: 'Zócalo Trasero',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: roundMm(plinthOuterW),
          width: roundMm(frame.plinthH),
          thickness: frame.t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          colorHex: mainMat.colorHex,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: roundMm(frame.posX),
          posY: roundMm(plinthCenterY),
          posZ: roundMm(rearPlinthPosZ),
          orientation: 'vertical_xy',
          componentRole: 'plinth',
          notes: 'Zócalo trasero perimetral'
        });
        parts.push({
          id: nextId('zocalo_li'),
          name: 'Zócalo Lateral Izquierdo',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: roundMm(plinthInnerD),
          width: roundMm(frame.plinthH),
          thickness: frame.t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          colorHex: mainMat.colorHex,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: roundMm(frame.posX - frame.w / 2 + sideRecess + frame.t / 2),
          posY: roundMm(plinthCenterY),
          posZ: roundMm(sidePlinthCenterZ),
          orientation: 'vertical_yz',
          componentRole: 'plinth',
          notes: 'Zócalo lateral izquierdo perimetral'
        });
        parts.push({
          id: nextId('zocalo_ld'),
          name: 'Zócalo Lateral Derecho',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: roundMm(plinthInnerD),
          width: roundMm(frame.plinthH),
          thickness: frame.t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          colorHex: mainMat.colorHex,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: roundMm(frame.posX + frame.w / 2 - sideRecess - frame.t / 2),
          posY: roundMm(plinthCenterY),
          posZ: roundMm(sidePlinthCenterZ),
          orientation: 'vertical_yz',
          componentRole: 'plinth',
          notes: 'Zócalo lateral derecho perimetral'
        });
      }
    } else if (frame.baseType === 'legs' && frame.plinthH > 0) {
      const legSpec = resolveLegStyleSpec(effectiveConfig.legStyle);
      const legDiameter = 36;
      const legRadius = legDiameter / 2;
      const insetX = Math.min(45, Math.max(legRadius + 4, frame.w * 0.12));
      const insetZ = Math.min(45, Math.max(legRadius + 4, frame.carcassDepth * 0.14));
      const legCenterY = frame.posY - frame.h / 2 + frame.plinthH / 2;

      const legOffsets: { label: string; x: number; z: number }[] = [
        { label: 'Frontal Izquierda', x: frame.posX - frame.w / 2 + insetX, z: frame.carcassFrontZ - insetZ },
        { label: 'Frontal Derecha', x: frame.posX + frame.w / 2 - insetX, z: frame.carcassFrontZ - insetZ },
        { label: 'Trasera Izquierda', x: frame.posX - frame.w / 2 + insetX, z: frame.carcassBackZ + insetZ },
        { label: 'Trasera Derecha', x: frame.posX + frame.w / 2 - insetX, z: frame.carcassBackZ + insetZ }
      ];
      if (frame.w > 1200) {
        legOffsets.push(
          { label: 'Frontal Central', x: frame.posX, z: frame.carcassFrontZ - insetZ },
          { label: 'Trasera Central', x: frame.posX, z: frame.carcassBackZ + insetZ }
        );
      }

      for (const leg of legOffsets) {
        parts.push({
          id: nextId('pata'),
          name: `${legSpec.partLabel} (${leg.label})`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: legDiameter,
          width: legDiameter,
          thickness: roundMm(frame.plinthH),
          quantity: 1,
          materialId: legSpec.materialId,
          materialName: legSpec.materialName,
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: roundMm(leg.x),
          posY: roundMm(legCenterY),
          posZ: roundMm(leg.z),
          orientation: 'vertical_xy',
          componentRole: 'accessory',
          shapeType: 'circle',
          radius: legRadius,
          diameter: legDiameter,
          colorHex: legSpec.colorHex,
          excludeFromCutlist: true,
          hardwareConfig: {
            isMovable: false,
            movableType: 'none',
            legStyle: legSpec.style
          },
          notes: `${legSpec.partLabel} ${frame.plinthH}mm para base de mueble`
        });
      }
    }

    // 5. Fondo Trasero (Groove / Rebate / Overlay / None)
    const innerH = Math.max(40, frame.rootInnerMaxY - frame.rootInnerMinY);
    const innerCenterY = frame.rootInnerMinY + innerH / 2;
    if (frame.effectiveBackType !== 'none') {
      const isOverlayBack = frame.effectiveBackType === 'overlay';
      const isRebateBack = frame.effectiveBackType === 'rebate';
      const backOriginZ = frame.carcassBackZ + frame.cleatPocket;

      const backPosZ = isOverlayBack
        ? frame.cleatPocket > 0
          ? backOriginZ + frame.backT / 2
          : frame.carcassBackZ - frame.backT / 2
        : isRebateBack
          ? backOriginZ + frame.backT / 2
          : backOriginZ + 15 + frame.backT / 2;

      const backLength =
        isOverlayBack && frame.cleatPocket === 0
          ? Math.max(40, frame.w - 4)
          : Math.max(40, frame.innerWidth - 2);
      const backHeight =
        isOverlayBack && frame.cleatPocket === 0
          ? Math.max(40, frame.sideH - 4)
          : Math.max(40, innerH - 2);
      const backPosY =
        isOverlayBack && frame.cleatPocket === 0 ? frame.sideCenterY : innerCenterY;

      parts.push({
        id: nextId('fondo'),
        name: isOverlayBack
          ? 'Fondo Trasero Sobrepuesto'
          : isRebateBack
            ? 'Fondo Trasero Rebajado (Galce)'
            : 'Fondo Trasero Ranurado',
        moduleId,
        moduleName: groupName,
        groupId,
        groupName,
        length: roundMm(backLength),
        width: roundMm(backHeight),
        thickness: frame.backT,
        quantity: 1,
        materialId: backMat.id,
        materialName: backMat.name,
        colorHex: backMat.colorHex,
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: roundMm(frame.posX),
        posY: roundMm(backPosY),
        posZ: roundMm(backPosZ),
        orientation: 'vertical_xy',
        componentRole: 'back',
        notes: isOverlayBack
          ? frame.cleatPocket > 0
            ? `Fondo MDF ${frame.backT}mm interior ante cámara de listón francés`
            : `Fondo MDF ${frame.backT}mm sobrepuesto clavado al dorso`
          : isRebateBack
            ? `Fondo MDF ${frame.backT}mm en galce/rebaje trasero`
            : `Fondo MDF ${frame.backT}mm ranurado a 15mm`
      });
    }

    // 5B. Sistema de Anclaje Mural (Modo Aéreo / Flotante)
    if (frame.installationType === 'wall') {
      if (frame.wallMountType === 'french_cleat') {
        const rawCleatH = Math.max(60, Math.min(120, Number(effectiveConfig.frenchCleatHeightMm) || 80));
        const effCleatH = Math.min(rawCleatH, Math.max(20, Math.floor((innerH - 6) / 2)));
        const cleatLen = Math.max(40, roundMm(frame.innerWidth - 2));
        const cleatZ = roundMm(frame.carcassBackZ + frame.t / 2);
        const cabinetCleatY = roundMm(frame.rootInnerMaxY - 1 - effCleatH / 2);
        const wallCleatY = roundMm(frame.rootInnerMaxY - 1 - effCleatH - 2 - effCleatH / 2);

        parts.push({
          id: nextId('liston_frances_mueble'),
          name: 'Listón Francés Mueble (Corte 45°)',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: cleatLen,
          width: roundMm(effCleatH),
          thickness: frame.t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          colorHex: mainMat.colorHex,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          bevelAngleDeg: 45,
          bevelEdge: 'l2',
          posX: roundMm(frame.posX),
          posY: cabinetCleatY,
          posZ: cleatZ,
          orientation: 'vertical_xy',
          componentRole: 'tie',
          hardwareConfig: {
            isMovable: false,
            movableType: 'none',
            wallMountType: 'french_cleat'
          },
          notes: 'Corte a 45° · Fijación al módulo'
        });

        parts.push({
          id: nextId('liston_frances_pared'),
          name: 'Listón Francés Pared (Corte 45°)',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: cleatLen,
          width: roundMm(effCleatH),
          thickness: frame.t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          colorHex: mainMat.colorHex,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          bevelAngleDeg: 45,
          bevelEdge: 'l1',
          posX: roundMm(frame.posX),
          posY: wallCleatY,
          posZ: cleatZ,
          orientation: 'vertical_xy',
          componentRole: 'tie',
          hardwareConfig: {
            isMovable: false,
            movableType: 'none',
            wallMountType: 'french_cleat'
          },
          notes: 'Corte a 45° · Anclaje a muro (espejo)'
        });
      } else if (frame.wallMountType === 'concealed_hanger') {
        const hangerW = Math.min(36, Math.max(16, Math.floor(frame.innerWidth / 4)));
        const hangerH = Math.min(55, Math.max(20, Math.floor(innerH - 8)));
        const hangerT = Math.min(14, Math.max(8, Math.floor(frame.carcassFrontZ - frame.preNailerMinZ - 4)));
        const hangerZ = roundMm(frame.preNailerMinZ + hangerT / 2);
        const hangerY = roundMm(frame.rootInnerMaxY - 2 - hangerH / 2);
        const leftHangerX = roundMm(frame.posX - frame.innerWidth / 2 + 2 + hangerW / 2);
        const rightHangerX = roundMm(frame.posX + frame.innerWidth / 2 - 2 - hangerW / 2);

        const hangers: { slug: string; name: string; x: number }[] = [
          { slug: 'colgador_izq', name: 'Colgador Oculto Izquierdo', x: leftHangerX },
          { slug: 'colgador_der', name: 'Colgador Oculto Derecho', x: rightHangerX }
        ];
        for (const hgr of hangers) {
          parts.push({
            id: nextId(hgr.slug),
            name: hgr.name,
            moduleId,
            moduleName: groupName,
            groupId,
            groupName,
            length: roundMm(hangerW),
            width: roundMm(hangerH),
            thickness: roundMm(hangerT),
            quantity: 1,
            materialId: 'hw_wall_concealed_hanger',
            materialName: 'Colgador Oculto Regulable',
            colorHex: '#52525b',
            grain: 'none',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            posX: hgr.x,
            posY: hangerY,
            posZ: hangerZ,
            orientation: 'vertical_xy',
            componentRole: 'accessory',
            excludeFromCutlist: true,
            includeInBudget: false,
            hardwareConfig: {
              isMovable: false,
              movableType: 'none',
              wallMountType: 'concealed_hanger'
            },
            notes: 'Colgador oculto regulable para platina mural'
          });
        }
      } else if (frame.wallMountType === 'direct_nailer') {
        const nailerH = Math.min(80, Math.max(20, Math.floor((innerH - 6) / 2)));
        const nailerLen = Math.max(40, roundMm(frame.innerWidth - 2));
        const nailerZ = roundMm(frame.preNailerMinZ + frame.t / 2);
        const upperNailerY = roundMm(frame.rootInnerMaxY - 1 - nailerH / 2);
        const lowerNailerY = roundMm(frame.rootInnerMinY + 1 + nailerH / 2);

        parts.push({
          id: nextId('amarre_muro_sup'),
          name: 'Amarre Trasero Superior (Muro)',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: nailerLen,
          width: roundMm(nailerH),
          thickness: frame.t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          colorHex: mainMat.colorHex,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: roundMm(frame.posX),
          posY: upperNailerY,
          posZ: nailerZ,
          orientation: 'vertical_xy',
          componentRole: 'tie',
          hardwareConfig: {
            isMovable: false,
            movableType: 'none',
            wallMountType: 'direct_nailer'
          },
          notes: 'Amarre trasero superior para atornillado directo al muro'
        });

        parts.push({
          id: nextId('amarre_muro_inf'),
          name: 'Amarre Trasero Inferior (Muro)',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          length: nailerLen,
          width: roundMm(nailerH),
          thickness: frame.t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          colorHex: mainMat.colorHex,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: roundMm(frame.posX),
          posY: lowerNailerY,
          posZ: nailerZ,
          orientation: 'vertical_xy',
          componentRole: 'tie',
          hardwareConfig: {
            isMovable: false,
            movableType: 'none',
            wallMountType: 'direct_nailer'
          },
          notes: 'Amarre trasero inferior para atornillado directo al muro'
        });
      }
    }

    // --- PASO B: SUBDIVISIÓN RECURSIVA Y CONTENIDOS POR ZONA ---
    let generatedDoorsCount = 0;
    let generatedDrawersCount = 0;
    let generatedShelvesCount = 0;
    let generatedRodsCount = 0;
    let lastDoorOpening: ParametricCabinetConfig['doorOpening'] = 'none';
    let lastDoorHingeType: HingeType | undefined = effectiveConfig.hingeType;
    let lastDrawerSlideType: Exclude<SlideType, 'none'> | undefined = effectiveConfig.drawerSlideType;

    const emitDoorContent = (
      node: CabinetZoneLayoutNode,
      doorCfg: CabinetZoneDoorConfig
    ) => {
      const isSliding = doorCfg.opening === 'sliding';
      const isInset = doorCfg.mount === 'inset';
      const dMinX = isInset ? node.minX + frame.gap / 2 : node.coverMinX;
      const dMaxX = isInset ? node.maxX - frame.gap / 2 : node.coverMaxX;
      const dMinY = isInset ? node.minY + frame.gap / 2 : node.coverMinY;
      const rawDMaxY = isInset ? node.maxY - frame.gap / 2 : node.coverMaxY;

      const doorOpeningSystem: CabinetOpeningSystem =
        doorCfg.openingSystem ??
        resolveOpeningSystemFromHandle(doorCfg.handleType, doorCfg.hasHandle);
      const rawDoorH = Math.max(40, roundMm(rawDMaxY - dMinY));
      let dMaxY = rawDMaxY;
      let fingerPullCut = 0;
      let golaChannelH = 0;
      let resolvedGolaFinish: CabinetGolaFinish | undefined;

      if (doorOpeningSystem === 'finger_pull') {
        const rawDeduct = doorCfg.fingerPullDeductMm ?? config.fingerPullDeductMm ?? 26;
        const clampedDeduct = Math.max(10, Math.min(40, Math.round(Number(rawDeduct) || 26)));
        fingerPullCut = Math.min(clampedDeduct, Math.max(0, rawDoorH - 40));
        dMaxY = rawDMaxY - fingerPullCut;
      } else if (doorOpeningSystem === 'gola') {
        resolvedGolaFinish = doorCfg.golaFinish ?? config.golaFinish ?? 'natural_aluminum';
        golaChannelH = Math.min(26, Math.max(0, rawDoorH - 40));
        dMaxY = rawDMaxY - golaChannelH;
      }

      const totalW = Math.max(40, roundMm(dMaxX - dMinX));
      const doorH = Math.max(40, roundMm(dMaxY - dMinY));
      const doorCenterX = roundMm((dMinX + dMaxX) / 2);
      const doorCenterY = roundMm((dMinY + dMaxY) / 2);

      const hasPhysicalHandle =
        doorOpeningSystem === 'handle' &&
        doorCfg.hasHandle !== false &&
        !isNonPhysicalHandleType(doorCfg.handleType);
      const resolvedHandleType: HandleType = hasPhysicalHandle
        ? doorCfg.handleType && !isNonPhysicalHandleType(doorCfg.handleType)
          ? doorCfg.handleType
          : config.handleType && !isNonPhysicalHandleType(config.handleType)
            ? config.handleType
            : 'bar_modern'
        : doorOpeningSystem === 'gola'
          ? 'gola_less'
          : doorOpeningSystem === 'finger_pull'
            ? 'finger_pull'
            : doorCfg.handleType === 'none'
              ? 'none'
              : 'push_open';
      const resolvedHandlePos: DoorHandleVerticalPosition = hasPhysicalHandle
        ? doorCfg.handlePosition || config.handlePosition || 'vertical'
        : 'none';
      const resolvedFinish: HandleFinish = doorCfg.handleFinish || config.handleFinish || 'brushed_steel';

      const emitGolaBar = (barW: number, barCenterX: number, barPosZ: number) => {
        if (doorOpeningSystem !== 'gola' || !resolvedGolaFinish || golaChannelH < 22) {
          return;
        }
        const finishLabel = resolveGolaFinishLabel(resolvedGolaFinish);
        parts.push({
          id: nextId('perfil_gola_puerta'),
          name: `Perfil Gola Horizontal (${finishLabel})`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          zoneId: node.zoneId,
          length: Math.max(40, roundMm(barW)),
          width: 24,
          thickness: 20,
          quantity: 1,
          materialId: `hw_gola_${resolvedGolaFinish}`,
          materialName: `Perfil Gola Aluminio (${finishLabel})`,
          colorHex: resolveGolaColorHex(resolvedGolaFinish),
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: roundMm(barCenterX),
          posY: roundMm(dMaxY + golaChannelH / 2),
          posZ: roundMm(barPosZ),
          orientation: 'horizontal',
          componentRole: 'accessory',
          excludeFromCutlist: true,
          includeInBudget: false,
          hardwareConfig: {
            isMovable: false,
            movableType: 'none',
            openingSystem: 'gola',
            handleType: 'gola_less',
            golaFinish: resolvedGolaFinish
          },
          notes: `Perfil Gola J horizontal ${Math.round(barW)}mm (${finishLabel})`
        });
      };

      const doorSystemTag =
        doorOpeningSystem === 'finger_pull' && fingerPullCut > 0
          ? ` · Corte a 45° uñero (-${fingerPullCut}mm)`
          : doorOpeningSystem === 'gola'
            ? ' · Sistema Gola'
            : doorOpeningSystem === 'push'
              ? ' · Push-to-Open'
              : '';

      if (isSliding) {
        const overlap = Math.min(25, Math.max(10, Math.round(totalW * 0.04)));
        const leafW = Math.max(40, roundMm(totalW / 2 + overlap / 2));
        const leftX = roundMm(dMinX + leafW / 2);
        const rightX = roundMm(dMaxX - leafW / 2);
        const rail1Z = isInset
          ? roundMm(frame.carcassFrontZ - frame.doorT / 2)
          : roundMm(frame.carcassFrontZ + frame.doorT / 2);
        const rail2Z = isInset
          ? roundMm(frame.carcassFrontZ - 1.5 * frame.doorT - 4)
          : roundMm(frame.carcassFrontZ + 1.5 * frame.doorT + 4);

        const slidingLeaves: { label: string; dir: 'left' | 'right'; x: number; z: number }[] = [
          { label: 'Puerta Corrediza Izquierda', dir: 'left', x: leftX, z: rail1Z },
          { label: 'Puerta Corrediza Derecha', dir: 'right', x: rightX, z: rail2Z }
        ];
        for (const leaf of slidingLeaves) {
          parts.push({
            id: nextId(`puerta_corr_${leaf.dir}`),
            name: leaf.label,
            moduleId,
            moduleName: groupName,
            groupId,
            groupName,
            zoneId: node.zoneId,
            length: leafW,
            width: doorH,
            thickness: frame.doorT,
            quantity: 1,
            materialId: doorMat.id,
            materialName: doorMat.name,
            colorHex: doorMat.colorHex,
            grain: doorMat.hasGrain ? 'length' : 'none',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            ...(doorOpeningSystem === 'finger_pull' ? { bevelAngleDeg: 45, bevelEdge: 'l2' as const } : {}),
            posX: leaf.x,
            posY: doorCenterY,
            posZ: leaf.z,
            orientation: 'vertical_xy',
            componentRole: 'door',
            notes: `Puerta corrediza ${isInset ? 'embutida' : 'exterior'} con riel superior/inferior${doorSystemTag}`,
            hardwareConfig: {
              isMovable: true,
              movableType: 'door',
              openingDirection: leaf.dir,
              hingeType: 'none',
              openingSystem: doorOpeningSystem,
              ...(doorOpeningSystem === 'finger_pull' ? { fingerPullDeductMm: fingerPullCut } : {}),
              ...(resolvedGolaFinish ? { golaFinish: resolvedGolaFinish } : {}),
              handleType: resolvedHandleType,
              handleFinish: resolvedFinish,
              handlePosition: resolvedHandlePos,
              isOpen: false
            }
          });
          generatedDoorsCount++;
        }
        emitGolaBar(totalW, doorCenterX, isInset ? frame.carcassFrontZ - 12 : frame.carcassFrontZ + 12.5);
        lastDoorOpening = 'double';
        return;
      }

      const hingeType: HingeType =
        doorCfg.hingeType || config.hingeType || (isInset ? 'full_cranked' : 'straight');
      lastDoorHingeType = hingeType;
      const doorPosZ = isInset
        ? roundMm(frame.carcassFrontZ - frame.doorT / 2)
        : roundMm(frame.carcassFrontZ + frame.doorT / 2);

      if (doorCfg.opening === 'double') {
        const leafW = Math.max(40, roundMm((totalW - frame.gap) / 2));
        const leftX = roundMm(dMinX + leafW / 2);
        const rightX = roundMm(dMaxX - leafW / 2);

        const leaves: { name: string; dir: 'left' | 'right'; x: number }[] = [
          { name: 'Puerta Izquierda (Doble)', dir: 'left', x: leftX },
          { name: 'Puerta Derecha (Doble)', dir: 'right', x: rightX }
        ];
        for (const lf of leaves) {
          parts.push({
            id: nextId(`puerta_${lf.dir}`),
            name: lf.name,
            moduleId,
            moduleName: groupName,
            groupId,
            groupName,
            zoneId: node.zoneId,
            length: leafW,
            width: doorH,
            thickness: frame.doorT,
            quantity: 1,
            materialId: doorMat.id,
            materialName: doorMat.name,
            colorHex: doorMat.colorHex,
            grain: doorMat.hasGrain ? 'length' : 'none',
            edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
            ...(doorOpeningSystem === 'finger_pull' ? { bevelAngleDeg: 45, bevelEdge: 'l2' as const } : {}),
            posX: lf.x,
            posY: doorCenterY,
            posZ: doorPosZ,
            orientation: 'vertical_xy',
            componentRole: 'door',
            notes: `Puerta ${lf.dir === 'left' ? 'izquierda' : 'derecha'} abatible ${isInset ? 'embutida' : 'solapada'}${doorSystemTag}`,
            hardwareConfig: {
              isMovable: true,
              movableType: 'door',
              openingDirection: lf.dir,
              hingeType,
              openingSystem: doorOpeningSystem,
              ...(doorOpeningSystem === 'finger_pull' ? { fingerPullDeductMm: fingerPullCut } : {}),
              ...(resolvedGolaFinish ? { golaFinish: resolvedGolaFinish } : {}),
              handleType: resolvedHandleType,
              handleFinish: resolvedFinish,
              handlePosition: resolvedHandlePos,
              isOpen: false
            }
          });
          generatedDoorsCount++;
        }
        emitGolaBar(totalW, doorCenterX, isInset ? frame.carcassFrontZ - 12 : frame.carcassFrontZ + 12.5);
        lastDoorOpening = 'double';
      } else {
        const dir: 'left' | 'right' = doorCfg.opening === 'right' ? 'right' : 'left';
        parts.push({
          id: nextId(`puerta_${dir}`),
          name: `Puerta Frontal (Abre: ${dir === 'left' ? 'Izquierda' : 'Derecha'})`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          zoneId: node.zoneId,
          length: totalW,
          width: doorH,
          thickness: frame.doorT,
          quantity: 1,
          materialId: doorMat.id,
          materialName: doorMat.name,
          colorHex: doorMat.colorHex,
          grain: doorMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          ...(doorOpeningSystem === 'finger_pull' ? { bevelAngleDeg: 45, bevelEdge: 'l2' as const } : {}),
          posX: doorCenterX,
          posY: doorCenterY,
          posZ: doorPosZ,
          orientation: 'vertical_xy',
          componentRole: 'door',
          notes: `Puerta abatible hacia ${dir} (${isInset ? 'embutida' : 'solapada'})${doorSystemTag}`,
          hardwareConfig: {
            isMovable: true,
            movableType: 'door',
            openingDirection: dir,
            hingeType,
            openingSystem: doorOpeningSystem,
            ...(doorOpeningSystem === 'finger_pull' ? { fingerPullDeductMm: fingerPullCut } : {}),
            ...(resolvedGolaFinish ? { golaFinish: resolvedGolaFinish } : {}),
            handleType: resolvedHandleType,
            handleFinish: resolvedFinish,
            handlePosition: resolvedHandlePos,
            isOpen: false
          }
        });
        emitGolaBar(totalW, doorCenterX, isInset ? frame.carcassFrontZ - 12 : frame.carcassFrontZ + 12.5);
        generatedDoorsCount++;
        lastDoorOpening = dir;
      }
    };

    const emitMovableShelves = (
      node: CabinetZoneLayoutNode,
      count: number,
      setbackMm: number,
      hasInsetFrontOnSelf: boolean,
      hasSlidingInsetOnSelf: boolean,
      hasGolaInsetOnSelf = false
    ) => {
      if (count <= 0) return;
      const rearGap = 2;
      const doorInsetClearance = hasSlidingInsetOnSelf
        ? Math.max(2 * frame.doorT + 14, hasGolaInsetOnSelf ? 26 : 0)
        : hasInsetFrontOnSelf
          ? Math.max(frame.doorT + 10, hasGolaInsetOnSelf ? 26 : 0)
          : 0;
      const effectiveSetback = Math.max(setbackMm, doorInsetClearance);
      const minZ = node.minZ + rearGap;
      const maxZ = Math.max(minZ + 30, node.maxZ - effectiveSetback);
      const shelfDepth = roundMm(maxZ - minZ);
      const shelfCenterZ = roundMm(minZ + shelfDepth / 2);
      const shelfLength = Math.max(20, roundMm(node.innerWidth - 2));
      const centerX = roundMm((node.minX + node.maxX) / 2);

      const safeCount = Math.min(count, Math.max(0, Math.floor((node.innerHeight - 20) / (frame.t + 16))));
      if (safeCount <= 0) return;

      const stepY = (node.maxY - node.minY) / (safeCount + 1);
      for (let i = 1; i <= safeCount; i++) {
        const shelfY = roundMm(node.minY + stepY * i);
        parts.push({
          id: nextId(`repisa_${i}`),
          name: `Repisa Móvil ${i}`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          zoneId: node.zoneId,
          length: shelfLength,
          width: shelfDepth,
          thickness: frame.t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          colorHex: mainMat.colorHex,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: centerX,
          posY: shelfY,
          posZ: shelfCenterZ,
          orientation: 'horizontal',
          componentRole: 'shelf',
          hardwareConfig: {
            isMovable: false,
            movableType: 'none',
            isMovableShelf: true
          },
          notes: `Repisa móvil regulable con soportes (remetida ${Math.round(effectiveSetback)}mm)`
        });
        generatedShelvesCount++;
      }
    };

    const emitHangingRods = (
      node: CabinetZoneLayoutNode,
      rodsCount: 1 | 2,
      hasInsetFrontOnSelf: boolean,
      hasSlidingInsetOnSelf: boolean,
      rodFinish?: CabinetRodFinish,
      hasGolaInsetOnSelf = false
    ) => {
      const rodSpec = resolveRodStyleSpec(rodFinish ?? effectiveConfig.hangingRodFinish);
      const doorInsetClearance = hasSlidingInsetOnSelf
        ? Math.max(2 * frame.doorT + 14, hasGolaInsetOnSelf ? 26 : 0)
        : hasInsetFrontOnSelf
          ? Math.max(frame.doorT + 10, hasGolaInsetOnSelf ? 26 : 0)
          : 0;
      const effMaxZ = Math.max(node.minZ + 40, node.maxZ - doorInsetClearance);
      const rodZ = roundMm((node.minZ + effMaxZ) / 2);
      const rodLen = Math.max(40, roundMm(node.innerWidth - 4));
      const centerX = roundMm((node.minX + node.maxX) / 2);

      if (rodsCount === 1) {
        const rodY = roundMm(Math.max(node.minY + 30, node.maxY - 80));
        parts.push({
          id: nextId('tubo_colgador'),
          name: rodSpec.partNameBase,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          zoneId: node.zoneId,
          length: rodLen,
          width: 25,
          thickness: 25,
          quantity: 1,
          materialId: rodSpec.materialId,
          materialName: rodSpec.materialName,
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: centerX,
          posY: rodY,
          posZ: rodZ,
          orientation: 'horizontal',
          componentRole: 'accessory',
          shapeType: 'circle',
          diameter: 25,
          colorHex: rodSpec.colorHex,
          excludeFromCutlist: true,
          hardwareConfig: {
            isMovable: false,
            movableType: 'none',
            rodFinish: rodSpec.finish
          },
          notes: `Barra de colgado simple para perchas (${rodSpec.materialName})`
        });
        generatedRodsCount++;
      } else {
        const midY = roundMm((node.minY + node.maxY) / 2);
        const shelfDepth = Math.max(40, roundMm(effMaxZ - node.minZ - 4));
        parts.push({
          id: nextId('repisa_colgado'),
          name: 'Entrepaño Divisor Colgado',
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          zoneId: node.zoneId,
          length: Math.max(30, roundMm(node.innerWidth - 2)),
          width: shelfDepth,
          thickness: frame.t,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          colorHex: mainMat.colorHex,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: centerX,
          posY: midY,
          posZ: roundMm(node.minZ + 2 + shelfDepth / 2),
          orientation: 'horizontal',
          componentRole: 'shelf',
          notes: 'Divisor fijo de colgado doble'
        });
        generatedShelvesCount++;

        const upperRodY = roundMm(Math.max(midY + frame.t / 2 + 25, node.maxY - 70));
        const lowerRodY = roundMm(Math.max(node.minY + 25, midY - frame.t / 2 - 70));

        parts.push({
          id: nextId('tubo_sup'),
          name: `${rodSpec.partNameBase} - Superior`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          zoneId: node.zoneId,
          length: rodLen,
          width: 25,
          thickness: 25,
          quantity: 1,
          materialId: rodSpec.materialId,
          materialName: rodSpec.materialName,
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: centerX,
          posY: upperRodY,
          posZ: rodZ,
          orientation: 'horizontal',
          componentRole: 'accessory',
          shapeType: 'circle',
          diameter: 25,
          colorHex: rodSpec.colorHex,
          excludeFromCutlist: true,
          hardwareConfig: {
            isMovable: false,
            movableType: 'none',
            rodFinish: rodSpec.finish
          },
          notes: `Barra de colgado nivel superior (${rodSpec.materialName})`
        });
        parts.push({
          id: nextId('tubo_inf'),
          name: `${rodSpec.partNameBase} - Inferior`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          zoneId: node.zoneId,
          length: rodLen,
          width: 25,
          thickness: 25,
          quantity: 1,
          materialId: rodSpec.materialId,
          materialName: rodSpec.materialName,
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: centerX,
          posY: lowerRodY,
          posZ: rodZ,
          orientation: 'horizontal',
          componentRole: 'accessory',
          shapeType: 'circle',
          diameter: 25,
          colorHex: rodSpec.colorHex,
          excludeFromCutlist: true,
          hardwareConfig: {
            isMovable: false,
            movableType: 'none',
            rodFinish: rodSpec.finish
          },
          notes: `Barra de colgado nivel inferior (${rodSpec.materialName})`
        });
        generatedRodsCount += 2;
      }
    };

    const emitDrawersContent = (
      node: CabinetZoneLayoutNode,
      dCfg: CabinetZoneDrawerConfig,
      hasAncestorDoors = false
    ) => {
      const count = Math.max(1, Math.min(6, Math.floor(Number(dCfg.count) || 1)));
      const isInset = dCfg.frontMount === 'inset';
      const useInsetBounds = isInset || hasAncestorDoors;
      const behindDoorGap = hasAncestorDoors ? 4 : 0;
      const interGap = Math.max(2, frame.gap);
      const openingSystem: CabinetOpeningSystem = dCfg.openingSystem || 'handle';
      const validZoneSlide = resolveValidDrawerSlideType(dCfg.slideType || config.drawerSlideType);
      const slideType: Exclude<SlideType, 'none'> =
        openingSystem === 'push' ? 'push_open' : validZoneSlide;
      lastDrawerSlideType = slideType;
      const bottomType = dCfg.bottomType === 'nailed' ? 'nailed' : 'grooved';

      const safeInsetPad = (val: number | undefined): number => {
        const n = Number(val);
        return Number.isFinite(n) && n > 0 ? Math.max(1.6, n) : 2;
      };
      const safeOverlayPad = (val: number | undefined): number => {
        const n = Number(val);
        return Number.isFinite(n) && n > 0 ? n : 0;
      };

      const frontMinX = useInsetBounds
        ? node.minX + safeInsetPad(dCfg.deductLeftMm)
        : node.coverMinX + safeOverlayPad(dCfg.deductLeftMm);
      const frontMaxX = useInsetBounds
        ? node.maxX - safeInsetPad(dCfg.deductRightMm)
        : node.coverMaxX - safeOverlayPad(dCfg.deductRightMm);
      const frontMinY = useInsetBounds
        ? node.minY + safeInsetPad(dCfg.deductBottomMm)
        : node.coverMinY + safeOverlayPad(dCfg.deductBottomMm);
      const frontMaxY = useInsetBounds
        ? node.maxY - safeInsetPad(dCfg.deductTopMm)
        : node.coverMaxY - safeOverlayPad(dCfg.deductTopMm);

      const frontWidth = Math.max(40, roundMm(frontMaxX - frontMinX));
      const frontCenterX = roundMm((frontMinX + frontMaxX) / 2);
      const totalSpanY = Math.max(30 * count, frontMaxY - frontMinY);

      const resolvedGolaFinish: CabinetGolaFinish | undefined =
        openingSystem === 'gola'
          ? (dCfg.golaFinish ?? config.golaFinish ?? 'natural_aluminum')
          : undefined;
      const slotGap =
        openingSystem === 'gola'
          ? Math.min(26, Math.max(interGap, Math.floor((totalSpanY - 30 * count) / count)))
          : interGap;
      const totalGapBudget = openingSystem === 'gola' ? slotGap * count : interGap * (count - 1);
      const availFrontH = Math.max(30 * count, totalSpanY - totalGapBudget);
      const nominalSlotH = Math.floor((availFrontH / count) * 10) / 10;

      const rawFingerPull = dCfg.fingerPullDeductMm ?? config.fingerPullDeductMm ?? 26;
      const clampedFingerPull = Math.max(10, Math.min(40, Math.round(Number(rawFingerPull) || 26)));
      const fingerPullCut =
        openingSystem === 'finger_pull'
          ? nominalSlotH > 75
            ? Math.min(clampedFingerPull, Math.max(0, Math.floor(nominalSlotH - 28)))
            : Math.min(clampedFingerPull, Math.max(0, Math.floor(nominalSlotH * 0.25)))
          : 0;
      const effFrontH = Math.max(28, roundMm(nominalSlotH - fingerPullCut));

      const recessFrontZ = node.maxZ - behindDoorGap;
      const frontCenterZ = useInsetBounds
        ? roundMm(recessFrontZ - frame.doorT / 2)
        : roundMm(recessFrontZ + frame.doorT / 2);
      const boxFrontZ = useInsetBounds
        ? roundMm(recessFrontZ - frame.doorT - 2)
        : roundMm(recessFrontZ - 2);

      const standardSlideLengths = [250, 300, 350, 400, 450, 500, 550, 600];
      const availBoxDepth = Math.max(40, boxFrontZ - node.minZ - 8);
      const slideLength =
        standardSlideLengths.filter(l => l <= availBoxDepth).pop() ||
        Math.max(40, Math.floor(availBoxDepth / 10) * 10);

      const sideClearance = slideType === 'undermount' ? 5 : 13;
      const boxWallT = Math.min(frame.t, 15);
      const boxOuterWidth = Math.max(45, roundMm(node.innerWidth - 2 * sideClearance));
      const boxInnerWidth = Math.max(20, roundMm(boxOuterWidth - 2 * boxWallT));
      const boxCenterX = roundMm((node.minX + node.maxX) / 2);

      const drawerHandleType: HandleType =
        openingSystem === 'push'
          ? config.handleType === 'none'
            ? 'none'
            : 'push_open'
          : openingSystem === 'gola'
            ? 'gola_less'
            : openingSystem === 'finger_pull'
              ? 'finger_pull'
              : config.handleType && !isNonPhysicalHandleType(config.handleType)
                ? config.handleType
                : 'bar_modern';
      const drawerHandleFinish: HandleFinish = config.handleFinish || 'brushed_steel';

      const mountTag = hasAncestorDoors
        ? 'Interior (bajo puerta)'
        : isInset
          ? 'Embutido'
          : 'Solapado';
      const openTag =
        openingSystem === 'push'
          ? 'Push-to-Open'
          : openingSystem === 'gola'
            ? 'Sistema Gola'
            : openingSystem === 'finger_pull'
              ? `Uñero Corte a 45° (-${fingerPullCut}mm)`
              : 'Con Tirador';
      const slideTag =
        slideType === 'undermount'
          ? 'Corredera Oculta'
          : slideType === 'push_open'
            ? 'Push-to-Open'
            : slideType === 'soft_close'
              ? 'Telescópica Cierre Suave'
              : slideType === 'telescopic_35'
                ? 'Telescópica 35mm'
                : 'Telescópica';

      for (let i = 0; i < count; i++) {
        const drawerIdx = i + 1;
        const drawerLabel =
          count === 3
            ? i === 0
              ? 'Cajón Inferior'
              : i === 1
                ? 'Cajón Medio'
                : 'Cajón Superior'
            : `Cajón ${drawerIdx}`;

        const frontBottomY = frontMinY + i * (nominalSlotH + slotGap);
        const frontTopY = frontBottomY + effFrontH;
        const frontCenterY = roundMm(frontBottomY + effFrontH / 2);

        // Frente Vista
        parts.push({
          id: nextId(`caj_${drawerIdx}_frente`),
          name: `${drawerLabel} - Frente Vista`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          zoneId: node.zoneId,
          length: frontWidth,
          width: effFrontH,
          thickness: frame.doorT,
          quantity: 1,
          materialId: doorMat.id,
          materialName: doorMat.name,
          colorHex: doorMat.colorHex,
          grain: doorMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          ...(openingSystem === 'finger_pull' && fingerPullCut > 0
            ? { bevelAngleDeg: 45, bevelEdge: 'l2' as const }
            : {}),
          posX: frontCenterX,
          posY: frontCenterY,
          posZ: frontCenterZ,
          orientation: 'vertical_xy',
          componentRole: 'drawer_front',
          hardwareConfig: {
            isMovable: true,
            movableType: 'drawer',
            slideType,
            slideLength,
            openingSystem,
            drawerOpeningSystem: openingSystem,
            ...(openingSystem === 'finger_pull' ? { fingerPullDeductMm: fingerPullCut } : {}),
            ...(resolvedGolaFinish ? { golaFinish: resolvedGolaFinish } : {}),
            frontMountType: dCfg.frontMount,
            handleType: drawerHandleType,
            handleFinish: drawerHandleFinish,
            handlePosition: openingSystem === 'handle' ? 'horizontal' : 'none',
            isOpen: false
          },
          notes: `Frente ${mountTag} · ${openTag} · ${slideTag} · Fondo ${bottomType === 'nailed' ? 'Clavado' : 'Ranurado'}`
        });
        generatedDrawersCount++;

        if (openingSystem === 'gola' && resolvedGolaFinish && slotGap >= 22) {
          const golaFinishLabel = resolveGolaFinishLabel(resolvedGolaFinish);
          parts.push({
            id: nextId(`perfil_gola_caj_${drawerIdx}`),
            name: `Perfil Gola Horizontal (${golaFinishLabel})`,
            moduleId,
            moduleName: groupName,
            groupId,
            groupName,
            zoneId: node.zoneId,
            length: frontWidth,
            width: 24,
            thickness: 20,
            quantity: 1,
            materialId: `hw_gola_${resolvedGolaFinish}`,
            materialName: `Perfil Gola Aluminio (${golaFinishLabel})`,
            colorHex: resolveGolaColorHex(resolvedGolaFinish),
            grain: 'none',
            edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
            posX: frontCenterX,
            posY: roundMm(frontTopY + slotGap / 2),
            posZ: useInsetBounds ? roundMm(recessFrontZ - 12) : roundMm(recessFrontZ + 12.5),
            orientation: 'horizontal',
            componentRole: 'accessory',
            excludeFromCutlist: true,
            includeInBudget: false,
            hardwareConfig: {
              isMovable: false,
              movableType: 'none',
              openingSystem: 'gola',
              handleType: 'gola_less',
              golaFinish: resolvedGolaFinish
            },
            notes: `Perfil Gola horizontal cajón ${drawerIdx} · ${frontWidth}mm (${golaFinishLabel})`
          });
        }

        // Ventana vertical segura dentro de la cavidad de zona para evitar colisiones
        const bottomPad = slideType === 'undermount' ? 14 : 5;
        const safeMinY = Math.max(frontBottomY + 3, node.minY + bottomPad);
        const safeMaxY = Math.min(frontTopY - 5, node.maxY - 5);
        const availBoxH = safeMaxY - safeMinY;
        if (availBoxH < 24) {
          continue;
        }

        const totalBoxSpanH = Math.min(
          Math.floor(availBoxH),
          Math.max(24, Math.floor(effFrontH * 0.7))
        );
        const boxBaseY = safeMinY + Math.min(4, Math.max(0, (availBoxH - totalBoxSpanH) * 0.2));

        const wallBottomY = bottomType === 'nailed' ? boxBaseY + frame.backT : boxBaseY;
        const wallH =
          bottomType === 'nailed'
            ? Math.max(18, roundMm(totalBoxSpanH - frame.backT))
            : roundMm(totalBoxSpanH);
        const wallCenterY = roundMm(wallBottomY + wallH / 2);
        const boxCenterZ = roundMm(boxFrontZ - slideLength / 2);

        // Lateral Izquierdo de Caja
        parts.push({
          id: nextId(`caj_${drawerIdx}_lat_izq`),
          name: `${drawerLabel} - Lateral Izquierdo`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          zoneId: node.zoneId,
          length: slideLength,
          width: wallH,
          thickness: boxWallT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          colorHex: mainMat.colorHex,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: roundMm(boxCenterX - boxOuterWidth / 2 + boxWallT / 2),
          posY: wallCenterY,
          posZ: boxCenterZ,
          orientation: 'vertical_yz',
          componentRole: 'drawer_box',
          notes: `Lateral cajón corredera ${slideLength}mm`
        });

        // Lateral Derecho de Caja
        parts.push({
          id: nextId(`caj_${drawerIdx}_lat_der`),
          name: `${drawerLabel} - Lateral Derecho`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          zoneId: node.zoneId,
          length: slideLength,
          width: wallH,
          thickness: boxWallT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          colorHex: mainMat.colorHex,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: roundMm(boxCenterX + boxOuterWidth / 2 - boxWallT / 2),
          posY: wallCenterY,
          posZ: boxCenterZ,
          orientation: 'vertical_yz',
          componentRole: 'drawer_box',
          notes: `Lateral cajón corredera ${slideLength}mm`
        });

        // Contrafrente Interior
        parts.push({
          id: nextId(`caj_${drawerIdx}_contrafrente`),
          name: `${drawerLabel} - Contrafrente Interior`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          zoneId: node.zoneId,
          length: boxInnerWidth,
          width: wallH,
          thickness: boxWallT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          colorHex: mainMat.colorHex,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: boxCenterX,
          posY: wallCenterY,
          posZ: roundMm(boxFrontZ - boxWallT / 2),
          orientation: 'vertical_xy',
          componentRole: 'drawer_box',
          notes: 'Frente interior atornillado al frente vista'
        });

        // Trasera Interior
        parts.push({
          id: nextId(`caj_${drawerIdx}_trasera`),
          name: `${drawerLabel} - Trasera Interior`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          zoneId: node.zoneId,
          length: boxInnerWidth,
          width: wallH,
          thickness: boxWallT,
          quantity: 1,
          materialId: mainMat.id,
          materialName: mainMat.name,
          colorHex: mainMat.colorHex,
          grain: mainMat.hasGrain ? 'length' : 'none',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: boxCenterX,
          posY: wallCenterY,
          posZ: roundMm(boxFrontZ - slideLength + boxWallT / 2),
          orientation: 'vertical_xy',
          componentRole: 'drawer_box',
          notes: 'Trasera de caja interior'
        });

        // Fondo MDF de Caja (Ranurado entre laterales o Clavado debajo)
        const isTopDrawer = i === count - 1;
        const bottomLength = bottomType === 'nailed' ? boxOuterWidth : boxInnerWidth;
        const bottomWidth =
          bottomType === 'nailed'
            ? slideLength
            : Math.max(20, roundMm(slideLength - 2 * boxWallT));
        const bottomCenterY =
          bottomType === 'nailed'
            ? roundMm(boxBaseY + frame.backT / 2)
            : roundMm(wallBottomY + Math.min(8, Math.floor(wallH * 0.25)) + frame.backT / 2);

        const drawerBottomPart: Part = {
          id: nextId(`caj_${drawerIdx}_fondo`),
          name: `${drawerLabel} - Fondo MDF`,
          moduleId,
          moduleName: groupName,
          groupId,
          groupName,
          zoneId: node.zoneId,
          length: bottomLength,
          width: bottomWidth,
          thickness: frame.backT,
          quantity: 1,
          materialId: backMat.id,
          materialName: backMat.name,
          colorHex: backMat.colorHex,
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: boxCenterX,
          posY: bottomCenterY,
          posZ: boxCenterZ,
          orientation: 'horizontal',
          componentRole: 'drawer_box',
          notes:
            bottomType === 'nailed'
              ? `Fondo de cajón MDF ${frame.backT}mm clavado por debajo`
              : `Fondo de cajón MDF ${frame.backT}mm ranurado`
        };

        if (isTopDrawer && effectiveConfig.siphonCutout?.enabled) {
          drawerBottomPart.cornerCutConfig = {
            type: 'u_siphon_cutout',
            corner: 'back_left',
            cutX: Math.min(Math.max(30, bottomLength - 40), effectiveConfig.siphonCutout.width || 180),
            cutY: Math.min(Math.max(30, bottomWidth - 20), effectiveConfig.siphonCutout.depth || 180)
          };
        }
        parts.push(drawerBottomPart);
      }
    };

    const traverseLayout = (node: CabinetZoneLayoutNode, hasAncestorDoors = false) => {
      if (!node.isLeaf && node.children.length > 0) {
        const hasInsetOnNode =
          node.content?.type === 'doors' && node.content.doors?.mount === 'inset';
        const hasSlidingInsetOnNode =
          hasInsetOnNode && node.content?.doors?.opening === 'sliding';
        const hasGolaInsetOnNode =
          hasInsetOnNode &&
          (node.content?.doors?.openingSystem ??
            resolveOpeningSystemFromHandle(
              node.content?.doors?.handleType,
              node.content?.doors?.hasHandle
            )) === 'gola';
        const insetDeduct = hasSlidingInsetOnNode
          ? Math.max(2 * frame.doorT + 6, hasGolaInsetOnNode ? 26 : 0)
          : hasInsetOnNode
            ? Math.max(frame.doorT + 2, hasGolaInsetOnNode ? 26 : 0)
            : 0;
        const dividerDepth = Math.max(
          30,
          roundMm((node.maxZ - insetDeduct) - node.minZ)
        );
        const dividerCenterZ = roundMm(node.minZ + dividerDepth / 2);

        if (node.splitDirection === 'vertical') {
          for (let i = 0; i < node.children.length - 1; i++) {
            const leftChild = node.children[i];
            parts.push({
              id: nextId(`divisor_v_${i + 1}`),
              name: `Divisor Vertical Zona ${i + 1}`,
              moduleId,
              moduleName: groupName,
              groupId,
              groupName,
              zoneId: node.zoneId,
              length: roundMm(node.innerHeight),
              width: dividerDepth,
              thickness: frame.t,
              quantity: 1,
              materialId: mainMat.id,
              materialName: mainMat.name,
              colorHex: mainMat.colorHex,
              grain: mainMat.hasGrain ? 'length' : 'none',
              edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
              posX: roundMm(leftChild.maxX + frame.t / 2),
              posY: roundMm((node.minY + node.maxY) / 2),
              posZ: dividerCenterZ,
              orientation: 'vertical_yz',
              componentRole: 'divider',
              notes: 'Divisor vertical estructural entre zonas'
            });
          }
        } else if (node.splitDirection === 'horizontal') {
          for (let i = 0; i < node.children.length - 1; i++) {
            const topChild = node.children[i];
            parts.push({
              id: nextId(`entrepano_fijo_${i + 1}`),
              name: `Entrepaño Fijo Zona ${i + 1}`,
              moduleId,
              moduleName: groupName,
              groupId,
              groupName,
              zoneId: node.zoneId,
              length: roundMm(node.innerWidth),
              width: dividerDepth,
              thickness: frame.t,
              quantity: 1,
              materialId: mainMat.id,
              materialName: mainMat.name,
              colorHex: mainMat.colorHex,
              grain: mainMat.hasGrain ? 'length' : 'none',
              edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
              posX: roundMm((node.minX + node.maxX) / 2),
              posY: roundMm(topChild.minY - frame.t / 2),
              posZ: dividerCenterZ,
              orientation: 'horizontal',
              componentRole: 'shelf',
              notes: 'Entrepaño fijo divisor horizontal de zona'
            });
            generatedShelvesCount++;
          }
        }

        const hasDoorsOnNode = node.content?.type === 'doors' && Boolean(node.content.doors);
        if (hasDoorsOnNode && node.content?.doors) {
          emitDoorContent(node, node.content.doors);
        }

        const nextAncestorDoors = hasAncestorDoors || hasDoorsOnNode;
        for (const ch of node.children) {
          traverseLayout(ch, nextAncestorDoors);
        }
        return;
      }

      const content = node.content;
      if (!content || content.type === 'empty') {
        return;
      }

      if (content.type === 'shelves') {
        const count = Math.max(0, Math.floor(Number(content.shelvesCount) || 0));
        const setback = Number.isFinite(Number(content.shelfSetbackMm))
          ? Number(content.shelfSetbackMm)
          : 15;
        emitMovableShelves(node, count, setback, false, false, false);
      } else if (content.type === 'hanging_rod') {
        const rods: 1 | 2 = content.hangingRodsCount === 2 ? 2 : 1;
        emitHangingRods(node, rods, false, false, content.hangingRodFinish, false);
        if ((content.shelvesCount ?? 0) > 0) {
          emitMovableShelves(
            node,
            Math.floor(Number(content.shelvesCount)),
            Number(content.shelfSetbackMm ?? 15),
            false,
            false,
            false
          );
        }
      } else if (content.type === 'drawers' && content.drawers) {
        emitDrawersContent(node, content.drawers, hasAncestorDoors);
      } else if (content.type === 'doors' && content.doors) {
        emitDoorContent(node, content.doors);
        const isInsetDoor = content.doors.mount === 'inset';
        const isSlidingInset = content.doors.opening === 'sliding' && isInsetDoor;
        const isGolaInset =
          isInsetDoor &&
          (content.doors.openingSystem ??
            resolveOpeningSystemFromHandle(
              content.doors.handleType,
              content.doors.hasHandle
            )) === 'gola';
        if ((content.shelvesCount ?? 0) > 0) {
          emitMovableShelves(
            node,
            Math.floor(Number(content.shelvesCount)),
            Number(content.shelfSetbackMm ?? 20),
            isInsetDoor,
            isSlidingInset,
            isGolaInset
          );
        }
        if ((content.hangingRodsCount ?? 0) > 0) {
          const rods: 1 | 2 = content.hangingRodsCount === 2 ? 2 : 1;
          emitHangingRods(
            node,
            rods,
            isInsetDoor,
            isSlidingInset,
            content.hangingRodFinish,
            isGolaInset
          );
        }
      }
    };

    traverseLayout(layout);

    const resolvedRods: 0 | 1 | 2 =
      generatedRodsCount >= 2 ? 2 : generatedRodsCount === 1 ? 1 : 0;

    const moduleTypeResolved: FurnitureModule['type'] =
      effectiveConfig.moduleType === 'wall_cabinet' ||
      effectiveConfig.moduleType === 'base_cabinet' ||
      effectiveConfig.moduleType === 'tall_cabinet' ||
      effectiveConfig.moduleType === 'drawer_unit'
        ? effectiveConfig.moduleType
        : 'base_cabinet';

    const module: FurnitureModule = {
      id: moduleId,
      name: groupName,
      type: moduleTypeResolved,
      width: frame.w,
      height: frame.h,
      depth: frame.d,
      boardThickness: frame.t,
      backThickness: frame.backT,
      backType: frame.effectiveBackType,
      shelvesCount: generatedShelvesCount,
      doorsCount: generatedDoorsCount,
      doorsType: 'overlay',
      drawersCount: generatedDrawersCount,
      hasPlinth: frame.baseType === 'plinth',
      plinthHeight: frame.plinthH,
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
        ...effectiveConfig,
        id: effectiveConfig.id || moduleId,
        installationType: frame.installationType,
        ...(frame.wallMountType ? { wallMountType: frame.wallMountType } : {}),
        baseType: frame.baseType,
        hasPlinth: frame.baseType === 'plinth',
        plinthHeight: frame.plinthH,
        ...(frame.baseType === 'legs'
          ? { legStyle: resolveLegStyleSpec(effectiveConfig.legStyle).style }
          : {}),
        shelvesCount: generatedShelvesCount,
        drawersCount: generatedDrawersCount,
        hangingRodsCount: resolvedRods,
        doorOpening:
          generatedDoorsCount >= 2
            ? 'double'
            : generatedDoorsCount === 1
              ? lastDoorOpening
              : 'none',
        ...(lastDoorHingeType ? { hingeType: lastDoorHingeType } : {}),
        ...(lastDrawerSlideType ? { drawerSlideType: lastDrawerSlideType } : {}),
        zoneTree: deepCloneZoneNode(effectiveTree)
      }
    };

    const taggedParts: Part[] = parts.map(pt => ({ ...pt, isParametricGenerated: true }));
    return { module, parts: taggedParts, group };
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

