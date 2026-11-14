import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { PartOrientation } from '../models/melamine.models';
import { PartWorldAABB } from './part-geometry.service';

export const DIMENSION_LINE_RENDER_ORDER = 950;
export const DIMENSION_SPRITE_RENDER_ORDER = 1000;

const EPSILON = 1e-4;
const DEFAULT_PIECE_TICK_HALF_LEN = 14;
const DEFAULT_BAY_TICK_HALF_LEN = 16;
const DEFAULT_WIDTH_TICK_HALF_LEN = 14;
const DEFAULT_ARROW_HEAD_LEN = 8;
const DEFAULT_ARROW_HEAD_HALF_WIDTH = 6;
const MIN_VERTICAL_BAY_MM = 10;
const MIN_HORIZONTAL_SPAN_MM = 40;
const MIN_STANDALONE_CLEARANCE_MM = 5;
const MIN_DRAWER_CLEARANCE_MM = 4;

export interface DimensionLineSegment {
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  midpoint: THREE.Vector3;
  tickSegments: THREE.Vector3[];
  witnessSegments: THREE.Vector3[];
}

export interface PieceDimensionInput {
  px: number;
  py: number;
  pz: number;
  sx: number;
  sy: number;
  sz: number;
  orientation?: PartOrientation;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  localLx?: number;
  localLy?: number;
  localLz?: number;
  tickHalfLength?: number;
}

export interface PieceDimensionLayout {
  lengthSegment: DimensionLineSegment;
  widthSegment: DimensionLineSegment;
}

export interface ModuleVerticalBayInput {
  yBottom: number;
  yTop: number;
  bottomFrontZ: number;
  topFrontZ: number;
  shelfFrontZ: number;
  bayMinX: number;
  bayMaxX: number;
  centerX: number;
  distance: number;
}

export interface ModuleVerticalBayAnchor {
  bayIndex: number;
  bay: ModuleVerticalBayInput;
  anchorX: number;
  anchorZ: number;
  segment: DimensionLineSegment;
}

export interface ModuleInternalClearancesInput {
  bays: ModuleVerticalBayInput[];
  leftInnerX: number | null;
  rightInnerX: number | null;
  leftSideFrontZ?: number | null;
  rightSideFrontZ?: number | null;
  bottomFrontZ?: number | null;
  floorTopY: number;
  moduleMinX: number;
  moduleMaxX: number;
  moduleMinY: number;
  moduleFrontZ: number;
  columnRefX?: number;
}

export interface ModuleInternalClearancesLayout {
  verticalBays: ModuleVerticalBayAnchor[];
  innerWidthSegment: DimensionLineSegment | null;
  innerWidth: number;
  outerBottomWidthSegment: DimensionLineSegment | null;
  outerBottomWidth: number;
}

export interface StandaloneClearanceInput {
  bounds: PartWorldAABB;
  topClearance: number | null;
  bottomClearance: number | null;
  leftClearance: number | null;
  rightClearance: number | null;
  topNeighborFrontZ?: number | null;
  bottomNeighborFrontZ?: number | null;
  leftNeighborFrontZ?: number | null;
  rightNeighborFrontZ?: number | null;
}

export interface StandaloneClearanceLayout {
  top: DimensionLineSegment | null;
  bottom: DimensionLineSegment | null;
  left: DimensionLineSegment | null;
  right: DimensionLineSegment | null;
}

export interface DrawerCavityClearanceInput {
  minY: number;
  maxY: number;
  innerWidth: number;
  centerX: number;
  centerZ: number;
  frontEdgeCoord: number;
  facingDirection: 'front' | 'back' | 'left' | 'right';
  drawerMinY: number;
  drawerMaxY: number;
}

export interface DrawerCavityClearanceLayout {
  refDepth: number;
  refX: number;
  refZ: number;
  topClearance: number;
  bottomClearance: number;
  topLine: DimensionLineSegment | null;
  bottomLine: DimensionLineSegment | null;
  widthLine: DimensionLineSegment | null;
  widthMidpoint: THREE.Vector3;
}

function buildMidpoint(p1: THREE.Vector3, p2: THREE.Vector3): THREE.Vector3 {
  return p1.clone().add(p2).multiplyScalar(0.5);
}

function buildEndTickPair(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  axis: THREE.Vector3,
  halfLen: number
): THREE.Vector3[] {
  return [
    p1.clone().addScaledVector(axis, -halfLen),
    p1.clone().addScaledVector(axis, halfLen),
    p2.clone().addScaledVector(axis, -halfLen),
    p2.clone().addScaledVector(axis, halfLen)
  ];
}

function buildVerticalTicksWithArrows(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  tickHalfW: number,
  arrowH: number,
  arrowW: number
): THREE.Vector3[] {
  return [
    new THREE.Vector3(p1.x - tickHalfW, p1.y, p1.z),
    new THREE.Vector3(p1.x + tickHalfW, p1.y, p1.z),
    new THREE.Vector3(p1.x - arrowW, p1.y + arrowH, p1.z),
    p1.clone(),
    new THREE.Vector3(p1.x + arrowW, p1.y + arrowH, p1.z),
    p1.clone(),
    new THREE.Vector3(p2.x - tickHalfW, p2.y, p2.z),
    new THREE.Vector3(p2.x + tickHalfW, p2.y, p2.z),
    new THREE.Vector3(p2.x - arrowW, p2.y - arrowH, p2.z),
    p2.clone(),
    new THREE.Vector3(p2.x + arrowW, p2.y - arrowH, p2.z),
    p2.clone()
  ];
}

function buildHorizontalTicksWithArrows(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  tickHalfH: number,
  arrowH: number,
  arrowW: number
): THREE.Vector3[] {
  return [
    new THREE.Vector3(p1.x, p1.y - tickHalfH, p1.z),
    new THREE.Vector3(p1.x, p1.y + tickHalfH, p1.z),
    new THREE.Vector3(p1.x + arrowH, p1.y - arrowW, p1.z),
    p1.clone(),
    new THREE.Vector3(p1.x + arrowH, p1.y + arrowW, p1.z),
    p1.clone(),
    new THREE.Vector3(p2.x, p2.y - tickHalfH, p2.z),
    new THREE.Vector3(p2.x, p2.y + tickHalfH, p2.z),
    new THREE.Vector3(p2.x - arrowH, p2.y - arrowW, p2.z),
    p2.clone(),
    new THREE.Vector3(p2.x - arrowH, p2.y + arrowW, p2.z),
    p2.clone()
  ];
}

function resolveLateralFrontZ(input: ModuleInternalClearancesInput): {
  frontZ: number;
  witnessesForSpan: (leftX: number, rightX: number, y: number) => THREE.Vector3[];
} {
  const hasLeft = input.leftSideFrontZ !== null && input.leftSideFrontZ !== undefined;
  const hasRight = input.rightSideFrontZ !== null && input.rightSideFrontZ !== undefined;

  let frontZ: number;
  if (hasLeft && hasRight) {
    frontZ = Math.min(input.leftSideFrontZ!, input.rightSideFrontZ!);
  } else if (hasLeft) {
    frontZ = input.leftSideFrontZ!;
  } else if (hasRight) {
    frontZ = input.rightSideFrontZ!;
  } else {
    frontZ = input.moduleFrontZ;
  }

  return {
    frontZ,
    witnessesForSpan: (leftX: number, rightX: number, y: number): THREE.Vector3[] => {
      const witnesses: THREE.Vector3[] = [];
      if (hasLeft && Math.abs(input.leftSideFrontZ! - frontZ) > EPSILON) {
        witnesses.push(
          new THREE.Vector3(leftX, y, input.leftSideFrontZ!),
          new THREE.Vector3(leftX, y, frontZ)
        );
      }
      if (hasRight && Math.abs(input.rightSideFrontZ! - frontZ) > EPSILON) {
        witnesses.push(
          new THREE.Vector3(rightX, y, input.rightSideFrontZ!),
          new THREE.Vector3(rightX, y, frontZ)
        );
      }
      return witnesses;
    }
  };
}

/**
 * Configura un material de cota o flecha 3D como overlay sin profundidad
 * (`depthTest = false`, `depthWrite = false`) para evitar z-fighting sobre las aristas
 * físicas y garantiza un `renderOrder >= 950`.
 */
export function configureDimensionOverlayMaterial(
  mat: THREE.Material,
  renderOrder: number = DIMENSION_LINE_RENDER_ORDER
): number {
  let changed = false;
  if (mat.depthTest !== false) {
    mat.depthTest = false;
    changed = true;
  }
  if (mat.depthWrite !== false) {
    mat.depthWrite = false;
    changed = true;
  }
  if (changed) {
    mat.needsUpdate = true;
  }
  return Math.max(DIMENSION_LINE_RENDER_ORDER, renderOrder);
}

/**
 * Calcula los segmentos exactos arista-a-arista (`0.0 mm` de desplazamiento) para una pieza
 * individual, soportando cajas alineadas al mundo (AABB) y piezas rotadas con Euler `'XYZ'`.
 */
export function computePieceDimensionSegments(
  params: PieceDimensionInput
): PieceDimensionLayout {
  const orientation: PartOrientation = params.orientation ?? 'horizontal';
  const tickHalfLen = params.tickHalfLength ?? DEFAULT_PIECE_TICK_HALF_LEN;

  const rx = params.rotationX ?? 0;
  const ry = params.rotationY ?? 0;
  const rz = params.rotationZ ?? 0;
  const hasRotation =
    Math.abs(rx) > EPSILON || Math.abs(ry) > EPSILON || Math.abs(rz) > EPSILON;
  const hasLocalDims =
    params.localLx !== undefined &&
    params.localLy !== undefined &&
    params.localLz !== undefined &&
    params.localLx > 0 &&
    params.localLy > 0 &&
    params.localLz > 0;
  const useLocalRotated = hasRotation && hasLocalDims;

  const hx = useLocalRotated ? params.localLx! * 0.5 : params.sx * 0.5;
  const hy = useLocalRotated ? params.localLy! * 0.5 : params.sy * 0.5;
  const hz = useLocalRotated ? params.localLz! * 0.5 : params.sz * 0.5;

  const center = new THREE.Vector3(params.px, params.py, params.pz);
  const euler = useLocalRotated
    ? new THREE.Euler(
        THREE.MathUtils.degToRad(rx),
        THREE.MathUtils.degToRad(ry),
        THREE.MathUtils.degToRad(rz),
        'XYZ'
      )
    : null;

  const corner = (signX: -1 | 1, signY: -1 | 1, signZ: -1 | 1): THREE.Vector3 => {
    const v = new THREE.Vector3(signX * hx, signY * hy, signZ * hz);
    if (euler) {
      v.applyEuler(euler);
    }
    return v.add(center);
  };

  const axisX = new THREE.Vector3(1, 0, 0);
  const axisY = new THREE.Vector3(0, 1, 0);
  const axisZ = new THREE.Vector3(0, 0, 1);
  if (euler) {
    axisX.applyEuler(euler).normalize();
    axisY.applyEuler(euler).normalize();
    axisZ.applyEuler(euler).normalize();
  }

  if (orientation === 'vertical_yz') {
    const lenP1 = corner(1, -1, 1);
    const lenP2 = corner(1, 1, 1);
    const lengthSegment: DimensionLineSegment = {
      p1: lenP1,
      p2: lenP2,
      midpoint: buildMidpoint(lenP1, lenP2),
      tickSegments: buildEndTickPair(lenP1, lenP2, axisZ, tickHalfLen),
      witnessSegments: []
    };

    const widP1 = corner(1, 1, -1);
    const widP2 = corner(1, 1, 1);
    const widthSegment: DimensionLineSegment = {
      p1: widP1,
      p2: widP2,
      midpoint: buildMidpoint(widP1, widP2),
      tickSegments: buildEndTickPair(widP1, widP2, axisY, tickHalfLen),
      witnessSegments: []
    };

    return { lengthSegment, widthSegment };
  }

  const lenP1 = corner(-1, 1, 1);
  const lenP2 = corner(1, 1, 1);
  const lengthSegment: DimensionLineSegment = {
    p1: lenP1,
    p2: lenP2,
    midpoint: buildMidpoint(lenP1, lenP2),
    tickSegments: buildEndTickPair(lenP1, lenP2, axisY, tickHalfLen),
    witnessSegments: []
  };

  if (orientation === 'vertical_xy') {
    const widP1 = corner(1, -1, 1);
    const widP2 = corner(1, 1, 1);
    const widthSegment: DimensionLineSegment = {
      p1: widP1,
      p2: widP2,
      midpoint: buildMidpoint(widP1, widP2),
      tickSegments: buildEndTickPair(widP1, widP2, axisX, tickHalfLen),
      witnessSegments: []
    };

    return { lengthSegment, widthSegment };
  }

  const widP1 = corner(1, 1, -1);
  const widP2 = corner(1, 1, 1);
  const widthSegment: DimensionLineSegment = {
    p1: widP1,
    p2: widP2,
    midpoint: buildMidpoint(widP1, widP2),
    tickSegments: buildEndTickPair(widP1, widP2, axisY, tickHalfLen),
    witnessSegments: []
  };

  return { lengthSegment, widthSegment };
}

/**
 * Calcula la cota externa inferior de ancho total del módulo (`moduleMinX -> moduleMaxX`)
 * anclada sobre las esquinas físicas inferiores reales (`0.0 mm` de desplazamiento).
 */
export function computeOuterBottomWidthSegment(
  moduleMinX: number,
  moduleMaxX: number,
  moduleMinY: number,
  frontZ: number
): DimensionLineSegment | null {
  const span = moduleMaxX - moduleMinX;
  if (!Number.isFinite(span) || span <= MIN_HORIZONTAL_SPAN_MM) {
    return null;
  }

  const p1 = new THREE.Vector3(moduleMinX, moduleMinY, frontZ);
  const p2 = new THREE.Vector3(moduleMaxX, moduleMinY, frontZ);
  return {
    p1,
    p2,
    midpoint: buildMidpoint(p1, p2),
    tickSegments: buildHorizontalTicksWithArrows(
      p1,
      p2,
      DEFAULT_WIDTH_TICK_HALF_LEN,
      DEFAULT_ARROW_HEAD_LEN,
      DEFAULT_ARROW_HEAD_HALF_WIDTH
    ),
    witnessSegments: []
  };
}

/**
 * Calcula todas las cotas internas de un módulo (luces verticales entre piso/entrepaños/techo,
 * luz horizontal interna `Luz X` y ancho exterior inferior) ancladas al borde físico real
 * con líneas testigo perpendiculares de brecha cero para repisas remetidas.
 */
export function computeModuleInternalClearancesLayout(
  input: ModuleInternalClearancesInput
): ModuleInternalClearancesLayout {
  const verticalBays: ModuleVerticalBayAnchor[] = [];

  for (let bayIndex = 0; bayIndex < input.bays.length; bayIndex++) {
    const bay = input.bays[bayIndex];
    if (!Number.isFinite(bay.distance) || bay.distance < MIN_VERTICAL_BAY_MM) {
      continue;
    }
    if (bay.yTop <= bay.yBottom) {
      continue;
    }

    const minX = Math.min(bay.bayMinX, bay.bayMaxX);
    const maxX = Math.max(bay.bayMinX, bay.bayMaxX);
    const rawCenterX = Number.isFinite(bay.centerX)
      ? bay.centerX
      : (input.columnRefX ?? (minX + maxX) * 0.5);
    const anchorX = Math.max(minX, Math.min(maxX, rawCenterX));

    // Si una repisa está remetida dentro del sobre lateral, anclamos al plano frontal
    // de la superficie remetida para que ningún extremo flote en el aire.
    const minEnvelopeFrontZ = Math.min(bay.bottomFrontZ, bay.topFrontZ);
    const hasRecessedEdge = Math.abs(bay.bottomFrontZ - bay.topFrontZ) > EPSILON;
    const anchorZ = hasRecessedEdge
      ? Math.min(bay.shelfFrontZ, minEnvelopeFrontZ)
      : bay.shelfFrontZ;

    const p1 = new THREE.Vector3(anchorX, bay.yBottom, anchorZ);
    const p2 = new THREE.Vector3(anchorX, bay.yTop, anchorZ);

    const witnessSegments: THREE.Vector3[] = [];
    if (Math.abs(bay.bottomFrontZ - anchorZ) > EPSILON) {
      witnessSegments.push(
        new THREE.Vector3(anchorX, bay.yBottom, bay.bottomFrontZ),
        new THREE.Vector3(anchorX, bay.yBottom, anchorZ)
      );
    }
    if (Math.abs(bay.topFrontZ - anchorZ) > EPSILON) {
      witnessSegments.push(
        new THREE.Vector3(anchorX, bay.yTop, bay.topFrontZ),
        new THREE.Vector3(anchorX, bay.yTop, anchorZ)
      );
    }

    const baySpanX = maxX - minX;
    const tickHalfW = baySpanX > 0
      ? Math.min(DEFAULT_BAY_TICK_HALF_LEN, Math.max(4, baySpanX * 0.15))
      : DEFAULT_BAY_TICK_HALF_LEN;
    const arrowH = Math.min(DEFAULT_ARROW_HEAD_LEN, Math.max(2, (bay.yTop - bay.yBottom) * 0.2));
    const arrowW = Math.min(DEFAULT_ARROW_HEAD_HALF_WIDTH, Math.max(2, tickHalfW * 0.5));

    verticalBays.push({
      bayIndex,
      bay,
      anchorX,
      anchorZ,
      segment: {
        p1,
        p2,
        midpoint: buildMidpoint(p1, p2),
        tickSegments: buildVerticalTicksWithArrows(p1, p2, tickHalfW, arrowH, arrowW),
        witnessSegments
      }
    });
  }

  const lateralZ = resolveLateralFrontZ(input);
  let innerWidthSegment: DimensionLineSegment | null = null;
  let innerWidth = 0;

  if (input.leftInnerX !== null && input.rightInnerX !== null) {
    const rawInnerSpan = input.rightInnerX - input.leftInnerX;
    if (rawInnerSpan > MIN_HORIZONTAL_SPAN_MM) {
      innerWidth = Math.round(rawInnerSpan);
      const y = input.floorTopY > 0 ? input.floorTopY : input.moduleMinY;
      const p1 = new THREE.Vector3(input.leftInnerX, y, lateralZ.frontZ);
      const p2 = new THREE.Vector3(input.rightInnerX, y, lateralZ.frontZ);

      innerWidthSegment = {
        p1,
        p2,
        midpoint: buildMidpoint(p1, p2),
        tickSegments: buildHorizontalTicksWithArrows(
          p1,
          p2,
          DEFAULT_WIDTH_TICK_HALF_LEN,
          DEFAULT_ARROW_HEAD_LEN,
          DEFAULT_ARROW_HEAD_HALF_WIDTH
        ),
        witnessSegments: lateralZ.witnessesForSpan(input.leftInnerX, input.rightInnerX, y)
      };
    }
  }

  const outerFrontZ =
    input.leftSideFrontZ !== null && input.leftSideFrontZ !== undefined ||
    input.rightSideFrontZ !== null && input.rightSideFrontZ !== undefined
      ? lateralZ.frontZ
      : (input.bottomFrontZ ?? input.moduleFrontZ);
  const rawOuterSpan = input.moduleMaxX - input.moduleMinX;
  const outerBottomWidth =
    rawOuterSpan > MIN_HORIZONTAL_SPAN_MM ? Math.round(rawOuterSpan) : 0;
  const outerBottomWidthSegment = computeOuterBottomWidthSegment(
    input.moduleMinX,
    input.moduleMaxX,
    input.moduleMinY,
    outerFrontZ
  );

  return {
    verticalBays,
    innerWidthSegment,
    innerWidth,
    outerBottomWidthSegment,
    outerBottomWidth
  };
}

/**
 * Calcula las cotas de luz libre para una pieza aislada (`top`, `bottom`, `left`, `right`)
 * ancladas directamente sobre su frente físico `bounds.maxZ` (`0.0 mm` de desplazamiento),
 * con líneas testigo en Z hacia vecinos de distinta profundidad.
 */
export function computeStandaloneClearanceSegments(
  input: StandaloneClearanceInput
): StandaloneClearanceLayout {
  const { bounds } = input;
  const vertZ = bounds.maxZ;
  const vertX = Math.max(bounds.minX, Math.min(bounds.maxX, bounds.px));
  const horizZ = bounds.maxZ;
  const horizY = Math.max(bounds.minY, Math.min(bounds.maxY, bounds.py));

  const tickHalfW = Math.min(18, Math.max(6, bounds.sx * 0.5));
  const tickHalfH = DEFAULT_WIDTH_TICK_HALF_LEN;

  let top: DimensionLineSegment | null = null;
  if (input.topClearance !== null && input.topClearance > MIN_STANDALONE_CLEARANCE_MM) {
    const topY = bounds.maxY + input.topClearance;
    const p1 = new THREE.Vector3(vertX, bounds.maxY, vertZ);
    const p2 = new THREE.Vector3(vertX, topY, vertZ);
    const witnessSegments: THREE.Vector3[] = [];
    if (
      input.topNeighborFrontZ !== null &&
      input.topNeighborFrontZ !== undefined &&
      Math.abs(input.topNeighborFrontZ - vertZ) > EPSILON
    ) {
      witnessSegments.push(
        new THREE.Vector3(vertX, topY, input.topNeighborFrontZ),
        new THREE.Vector3(vertX, topY, vertZ)
      );
    }
    top = {
      p1,
      p2,
      midpoint: buildMidpoint(p1, p2),
      tickSegments: buildEndTickPair(p1, p2, new THREE.Vector3(1, 0, 0), tickHalfW),
      witnessSegments
    };
  }

  let bottom: DimensionLineSegment | null = null;
  if (input.bottomClearance !== null && input.bottomClearance > MIN_STANDALONE_CLEARANCE_MM) {
    const botY = bounds.minY - input.bottomClearance;
    const p1 = new THREE.Vector3(vertX, botY, vertZ);
    const p2 = new THREE.Vector3(vertX, bounds.minY, vertZ);
    const witnessSegments: THREE.Vector3[] = [];
    if (
      input.bottomNeighborFrontZ !== null &&
      input.bottomNeighborFrontZ !== undefined &&
      Math.abs(input.bottomNeighborFrontZ - vertZ) > EPSILON
    ) {
      witnessSegments.push(
        new THREE.Vector3(vertX, botY, input.bottomNeighborFrontZ),
        new THREE.Vector3(vertX, botY, vertZ)
      );
    }
    bottom = {
      p1,
      p2,
      midpoint: buildMidpoint(p1, p2),
      tickSegments: buildEndTickPair(p1, p2, new THREE.Vector3(1, 0, 0), tickHalfW),
      witnessSegments
    };
  }

  let left: DimensionLineSegment | null = null;
  if (input.leftClearance !== null && input.leftClearance > MIN_STANDALONE_CLEARANCE_MM) {
    const leftX = bounds.minX - input.leftClearance;
    const p1 = new THREE.Vector3(leftX, horizY, horizZ);
    const p2 = new THREE.Vector3(bounds.minX, horizY, horizZ);
    const witnessSegments: THREE.Vector3[] = [];
    if (
      input.leftNeighborFrontZ !== null &&
      input.leftNeighborFrontZ !== undefined &&
      Math.abs(input.leftNeighborFrontZ - horizZ) > EPSILON
    ) {
      witnessSegments.push(
        new THREE.Vector3(leftX, horizY, input.leftNeighborFrontZ),
        new THREE.Vector3(leftX, horizY, horizZ)
      );
    }
    left = {
      p1,
      p2,
      midpoint: buildMidpoint(p1, p2),
      tickSegments: buildEndTickPair(p1, p2, new THREE.Vector3(0, 1, 0), tickHalfH),
      witnessSegments
    };
  }

  let right: DimensionLineSegment | null = null;
  if (input.rightClearance !== null && input.rightClearance > MIN_STANDALONE_CLEARANCE_MM) {
    const rightX = bounds.maxX + input.rightClearance;
    const p1 = new THREE.Vector3(bounds.maxX, horizY, horizZ);
    const p2 = new THREE.Vector3(rightX, horizY, horizZ);
    const witnessSegments: THREE.Vector3[] = [];
    if (
      input.rightNeighborFrontZ !== null &&
      input.rightNeighborFrontZ !== undefined &&
      Math.abs(input.rightNeighborFrontZ - horizZ) > EPSILON
    ) {
      witnessSegments.push(
        new THREE.Vector3(rightX, horizY, input.rightNeighborFrontZ),
        new THREE.Vector3(rightX, horizY, horizZ)
      );
    }
    right = {
      p1,
      p2,
      midpoint: buildMidpoint(p1, p2),
      tickSegments: buildEndTickPair(p1, p2, new THREE.Vector3(0, 1, 0), tickHalfH),
      witnessSegments
    };
  }

  return { top, bottom, left, right };
}

/**
 * Calcula las cotas de luz superior, inferior y ancho de hueco de un cajón modular
 * ancladas exactamente al plano frontal `frontEdgeCoord` (`0.0 mm` de desplazamiento).
 */
export function computeDrawerCavitySegments(
  input: DrawerCavityClearanceInput
): DrawerCavityClearanceLayout {
  const isWZ = input.facingDirection === 'right' || input.facingDirection === 'left';
  const refDepth = input.frontEdgeCoord;
  const refX = isWZ ? refDepth : input.centerX;
  const refZ = isWZ ? input.centerZ : refDepth;
  const planeTickAxis = isWZ ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);

  const bottomClearance = Math.max(0, Math.round(input.drawerMinY - input.minY));
  const topClearance = Math.max(0, Math.round(input.maxY - input.drawerMaxY));

  let topLine: DimensionLineSegment | null = null;
  if (topClearance >= MIN_DRAWER_CLEARANCE_MM && input.maxY > input.drawerMaxY) {
    const p1 = new THREE.Vector3(refX, input.drawerMaxY, refZ);
    const p2 = new THREE.Vector3(refX, input.maxY, refZ);
    topLine = {
      p1,
      p2,
      midpoint: buildMidpoint(p1, p2),
      tickSegments: buildEndTickPair(p1, p2, planeTickAxis, DEFAULT_WIDTH_TICK_HALF_LEN),
      witnessSegments: []
    };
  }

  let bottomLine: DimensionLineSegment | null = null;
  if (bottomClearance >= MIN_DRAWER_CLEARANCE_MM && input.drawerMinY > input.minY) {
    const p1 = new THREE.Vector3(refX, input.minY, refZ);
    const p2 = new THREE.Vector3(refX, input.drawerMinY, refZ);
    bottomLine = {
      p1,
      p2,
      midpoint: buildMidpoint(p1, p2),
      tickSegments: buildEndTickPair(p1, p2, planeTickAxis, DEFAULT_WIDTH_TICK_HALF_LEN),
      witnessSegments: []
    };
  }

  let widthLine: DimensionLineSegment | null = null;
  let widthMidpoint = new THREE.Vector3(refX, input.minY, refZ);
  if (input.innerWidth > 0) {
    const halfW = input.innerWidth * 0.5;
    const p1 = isWZ
      ? new THREE.Vector3(refDepth, input.minY, input.centerZ - halfW)
      : new THREE.Vector3(input.centerX - halfW, input.minY, refDepth);
    const p2 = isWZ
      ? new THREE.Vector3(refDepth, input.minY, input.centerZ + halfW)
      : new THREE.Vector3(input.centerX + halfW, input.minY, refDepth);
    widthMidpoint = buildMidpoint(p1, p2);
    widthLine = {
      p1,
      p2,
      midpoint: widthMidpoint.clone(),
      tickSegments: buildEndTickPair(p1, p2, new THREE.Vector3(0, 1, 0), DEFAULT_WIDTH_TICK_HALF_LEN),
      witnessSegments: []
    };
  }

  return {
    refDepth,
    refX,
    refZ,
    topClearance,
    bottomClearance,
    topLine,
    bottomLine,
    widthLine,
    widthMidpoint
  };
}

/**
 * Calcula la posición de una etiqueta 3D deslizándola estrictamente SOBRE el segmento `[p1, p2]`
 * durante un zoom cercano, manteniendo `0.0 mm` de deriva fuera de la arista al orbitar 360°.
 */
export function computeAlongSegmentLabelPosition(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  cameraPos: THREE.Vector3,
  focusTarget: THREE.Vector3,
  closeThreshold = 850
): THREE.Vector3 {
  const mid = buildMidpoint(p1, p2);
  const distToMid = cameraPos.distanceTo(mid);
  if (distToMid >= closeThreshold) {
    return mid;
  }

  const segDir = p2.clone().sub(p1);
  const segLenSq = segDir.lengthSq();
  if (segLenSq <= 1) {
    return mid;
  }

  const targetOffset = focusTarget.clone().sub(p1);
  const t = Math.max(0.12, Math.min(0.88, targetOffset.dot(segDir) / segLenSq));
  const blend = Math.max(0, Math.min(1, (closeThreshold - distToMid) / 500));
  const finalT = 0.5 + (t - 0.5) * blend;
  return new THREE.Vector3().lerpVectors(p1, p2, finalT);
}

/**
 * Motor geométrico puro de anclaje arista-a-arista (`offset = 0 mm`) para cotas 3D
 * de piezas individuales, módulos, luces libres y cajones modulares.
 */
@Injectable({
  providedIn: 'root'
})
export class DimensionAnchor3dService {
  configureDimensionOverlayMaterial(
    mat: THREE.Material,
    renderOrder: number = DIMENSION_LINE_RENDER_ORDER
  ): number {
    return configureDimensionOverlayMaterial(mat, renderOrder);
  }

  computePieceDimensionSegments(params: PieceDimensionInput): PieceDimensionLayout {
    return computePieceDimensionSegments(params);
  }

  computeOuterBottomWidthSegment(
    moduleMinX: number,
    moduleMaxX: number,
    moduleMinY: number,
    frontZ: number
  ): DimensionLineSegment | null {
    return computeOuterBottomWidthSegment(moduleMinX, moduleMaxX, moduleMinY, frontZ);
  }

  computeModuleInternalClearancesLayout(
    input: ModuleInternalClearancesInput
  ): ModuleInternalClearancesLayout {
    return computeModuleInternalClearancesLayout(input);
  }

  computeStandaloneClearanceSegments(
    input: StandaloneClearanceInput
  ): StandaloneClearanceLayout {
    return computeStandaloneClearanceSegments(input);
  }

  computeDrawerCavitySegments(
    input: DrawerCavityClearanceInput
  ): DrawerCavityClearanceLayout {
    return computeDrawerCavitySegments(input);
  }

  computeAlongSegmentLabelPosition(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    cameraPos: THREE.Vector3,
    focusTarget: THREE.Vector3,
    closeThreshold = 850
  ): THREE.Vector3 {
    return computeAlongSegmentLabelPosition(p1, p2, cameraPos, focusTarget, closeThreshold);
  }
}
