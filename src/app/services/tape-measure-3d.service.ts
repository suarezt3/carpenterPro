import { Injectable } from '@angular/core';
import * as THREE from 'three';

export const TAPE_MEASURE_RENDER_ORDER = 995;
export const CLICK_DRAG_THRESHOLD_PX = 5;
export const SNAP_CORNER_RADIUS_PX = 10;
export const SNAP_MIDPOINT_RADIUS_PX = 10;
export const SNAP_EDGE_RADIUS_PX = 12;
export const AXIS_LOCK_THRESHOLD_PX = 15;
export const AXIS_LOCK_THRESHOLD_MM = 25;

export const AXIS_COLORS = {
  x: 0xef4444,
  y: 0x10b981,
  z: 0x0284c7,
  direct: 0xd97706
} as const;

export const AXIS_CSS_COLORS = {
  x: '#EF4444',
  y: '#10B981',
  z: '#0284C7',
  direct: '#D97706'
} as const;

export const SNAP_COLORS = {
  corner: 0x10b981,
  midpoint: 0x0284c7,
  edge: 0xd97706,
  face: 0x0284c7
} as const;

export const SNAP_CSS_COLORS = {
  corner: '#10B981',
  midpoint: '#0284C7',
  edge: '#D97706',
  face: '#0284C7'
} as const;

export const SNAP_LABELS = {
  corner: 'Esquina',
  midpoint: 'Punto medio',
  edge: 'En arista',
  face: 'En cara'
} as const;

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export type MeasureAxisLock = 'x' | 'y' | 'z' | null;
export type MeasureProjectionMode = 'direct' | 'x' | 'y' | 'z';
export type SnapCandidateType = 'corner' | 'midpoint' | 'edge' | 'face';

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ClosestSurfaceHitResult {
  intersection: THREE.Intersection;
  object: THREE.Object3D;
  point: THREE.Vector3;
  distance: number;
  face: THREE.Face | null;
  objectName: string;
  worldNormal: THREE.Vector3 | null;
}

export interface StruckFaceEdge {
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  midpoint: THREE.Vector3;
  dir: THREE.Vector3;
  length: number;
}

export interface StruckFaceFeatures {
  worldNormal: THREE.Vector3;
  planeD: number;
  corners: THREE.Vector3[];
  edges: StruckFaceEdge[];
  isFallbackObb: boolean;
}

export interface MagneticSnapCandidate {
  worldPos: THREE.Vector3;
  type: SnapCandidateType;
  label: string;
  colorHex: number;
  colorCss: string;
  objectName: string;
  screenDistancePx: number;
  hitDistance: number;
  hitObject?: THREE.Object3D;
  edgeDir?: THREE.Vector3;
  edgeP1?: THREE.Vector3;
  edgeP2?: THREE.Vector3;
  faceNormal?: THREE.Vector3;
}

export interface PickSurfaceOptions {
  resolveObjectName?: (obj: THREE.Object3D) => string | null | undefined;
  hiddenPartIds?: ReadonlySet<string>;
}

export interface SnapSearchOptions extends PickSurfaceOptions {
  cornerRadiusPx?: number;
  midpointRadiusPx?: number;
  edgeRadiusPx?: number;
}

export interface PerpendicularProjectionOptions {
  mode?: MeasureProjectionMode;
  shiftPressed?: boolean;
  camera?: THREE.Camera | null;
  viewportRect?: ViewportRect | null;
  cursorClientX?: number;
  cursorClientY?: number;
  axisLockThresholdMm?: number;
  axisLockThresholdPx?: number;
}

export interface PerpendicularProjectionResult {
  pointB: Point3D;
  axisLock: MeasureAxisLock;
}

export interface SavedMeasurement {
  id: string;
  pointA: Point3D;
  pointB: Point3D;
  distanceMm: number;
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  axisLock: MeasureAxisLock;
}

export interface ScreenProjectionPoint {
  x: number;
  y: number;
  ndcZ: number;
  inFront: boolean;
  visible: boolean;
}

export interface ProjectedMeasurementBadge {
  id: string;
  x: number;
  y: number;
  visible: boolean;
  distanceMm: number;
  formattedDistance: string;
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  axisLock: MeasureAxisLock;
  colorCss: string;
  measurement: SavedMeasurement;
}

interface MaterialWithWireframe {
  wireframe?: boolean;
}

interface CoplanarTriangle {
  triIndex: number;
  indices: [number, number, number];
  keys: [string, string, string];
  center: THREE.Vector3;
}

interface BoundaryEdgeDraft {
  id: number;
  a: string;
  b: string;
  alive: boolean;
}

const HIGH_POLY_OBB_TRIANGLE_THRESHOLD = 600;
const COPLANAR_NORMAL_DOT_MIN = 0.99;
const COPLANAR_VERTEX_DIST_MAX_MM = 0.5;
const COLLINEAR_DOT_MIN = 0.999;
const COLLINEAR_LINE_DEV_MAX_MM = 0.25;
const VERTEX_QUANTIZE_SCALE = 100; // 0.01 mm
const SILHOUETTE_PROBE_RADII_PX = [1, 3, 6, 9, 12] as const;
const SILHOUETTE_PROBE_ANGLE_COUNT = 8;
const CAMERA_VISIBILITY_EPSILON_MM = 1.5;
const SNAP_RANK_TIE_PX = 1e-3;

const EXCLUDED_USER_DATA_FLAGS = [
  'isCota',
  'isAuxiliaryVisual',
  'isMeasurementVisual',
  'isMeasureVisual',
  'isGizmo',
  'isWallGizmo',
  'isApplianceGizmo',
  'isApplianceHandle',
  'isHelper',
  'isApplianceHitBox',
  'isBoxHelper',
  'isOutline',
  'isWireframe',
  'isFloorCircle',
  'isReferenceFloorCircle',
  'isShadow',
  'isFloorShadow',
  'isGrid',
  'isDimensionBadge',
  'isSnapGuide'
] as const;

let autoMeasurementCounter = 0;

function roundMm(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  return rounded === 0 ? 0 : rounded;
}

function roundPoint(pt: Point3D): Point3D {
  return {
    x: roundMm(pt.x),
    y: roundMm(pt.y),
    z: roundMm(pt.z)
  };
}

function quantizeVertexKey(v: THREE.Vector3): string {
  const qx = Math.round(v.x * VERTEX_QUANTIZE_SCALE);
  const qy = Math.round(v.y * VERTEX_QUANTIZE_SCALE);
  const qz = Math.round(v.z * VERTEX_QUANTIZE_SCALE);
  return `${qx},${qy},${qz}`;
}

function makeUndirectedEdgeKey(k1: string, k2: string): string {
  return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
}

function normalizeRootList(
  roots: THREE.Object3D | readonly (THREE.Object3D | null | undefined)[] | null | undefined
): THREE.Object3D[] {
  if (!roots) {
    return [];
  }
  if (Array.isArray(roots)) {
    const out: THREE.Object3D[] = [];
    for (const item of roots) {
      if (item) {
        out.push(item);
      }
    }
    return out;
  }
  return [roots as THREE.Object3D];
}

function isMeshInstance(obj: THREE.Object3D): obj is THREE.Mesh {
  return (
    obj instanceof THREE.Mesh &&
    !(obj instanceof THREE.Line) &&
    !(obj instanceof THREE.LineSegments) &&
    !(obj instanceof THREE.Points) &&
    !(obj instanceof THREE.Sprite) &&
    !(obj instanceof THREE.BoxHelper) &&
    !(obj instanceof THREE.Box3Helper)
  );
}

function isMaterialWireframe(mat: THREE.Material): boolean {
  return (
    'wireframe' in mat &&
    (mat as THREE.Material & MaterialWithWireframe).wireframe === true
  );
}

function isSolidVisibleMaterial(mat: THREE.Material | null | undefined): boolean {
  if (!mat || !mat.visible || isMaterialWireframe(mat)) {
    return false;
  }
  if (mat instanceof THREE.ShadowMaterial) {
    return false;
  }
  if (mat.transparent && mat.opacity <= 0.001) {
    return false;
  }
  return true;
}

function hasSolidMeshMaterial(mesh: THREE.Mesh): boolean {
  const mat = mesh.material;
  if (!mat) {
    return false;
  }
  if (Array.isArray(mat)) {
    return mat.length > 0 && mat.some((entry) => isSolidVisibleMaterial(entry));
  }
  return isSolidVisibleMaterial(mat);
}

function isHitFaceMaterialValid(hit: THREE.Intersection): boolean {
  if (!(hit.object instanceof THREE.Mesh)) {
    return false;
  }
  const mat = hit.object.material;
  if (!Array.isArray(mat)) {
    return isSolidVisibleMaterial(mat);
  }
  const matIdx = hit.face?.materialIndex;
  if (typeof matIdx === 'number' && matIdx >= 0 && matIdx < mat.length) {
    return isSolidVisibleMaterial(mat[matIdx]);
  }
  return mat.some((entry) => isSolidVisibleMaterial(entry));
}

function readNamedField(value: unknown, field: string): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const prop = record[field];
  return typeof prop === 'string' && prop.trim().length > 0 ? prop : null;
}

function hasExcludedMetadataOrHiddenPart(
  obj: THREE.Object3D,
  hiddenPartIds?: ReadonlySet<string>
): boolean {
  if (
    !obj.visible ||
    obj instanceof THREE.BoxHelper ||
    obj instanceof THREE.Box3Helper ||
    obj instanceof THREE.GridHelper ||
    obj instanceof THREE.AxesHelper ||
    obj.name === 'raycast_hitbox'
  ) {
    return true;
  }

  const data = obj.userData as Record<string, unknown> | undefined;
  if (!data) {
    return false;
  }

  for (const flag of EXCLUDED_USER_DATA_FLAGS) {
    if (data[flag]) {
      return true;
    }
  }

  if (hiddenPartIds && hiddenPartIds.size > 0) {
    const partId = readNamedField(data['part'], 'id');
    if (partId && hiddenPartIds.has(partId)) {
      return true;
    }
    const parentPartId = data['parentPartId'];
    if (typeof parentPartId === 'string' && hiddenPartIds.has(parentPartId)) {
      return true;
    }
  }

  return false;
}

function isNodeExcluded(
  obj: THREE.Object3D,
  hiddenPartIds?: ReadonlySet<string>
): boolean {
  if (
    obj instanceof THREE.Line ||
    obj instanceof THREE.LineSegments ||
    obj instanceof THREE.Points ||
    obj instanceof THREE.Sprite
  ) {
    return true;
  }
  return hasExcludedMetadataOrHiddenPart(obj, hiddenPartIds);
}

function isAncestorChainSolidVisible(
  obj: THREE.Object3D,
  hiddenPartIds?: ReadonlySet<string>
): boolean {
  let curr: THREE.Object3D | null = obj;
  while (curr) {
    if (hasExcludedMetadataOrHiddenPart(curr, hiddenPartIds)) {
      return false;
    }
    curr = curr.parent;
  }
  return true;
}

function updateAncestorWorldMatrices(obj: THREE.Object3D): void {
  const ancestors: THREE.Object3D[] = [];
  let curr = obj.parent;
  while (curr) {
    ancestors.push(curr);
    curr = curr.parent;
  }
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const anc = ancestors[i];
    if (anc.matrixAutoUpdate) {
      anc.updateMatrix();
    }
    if (anc.parent) {
      anc.matrixWorld.multiplyMatrices(anc.parent.matrixWorld, anc.matrix);
    } else {
      anc.matrixWorld.copy(anc.matrix);
    }
  }
}

function collectSolidVisibleMeshes(
  roots: readonly THREE.Object3D[],
  hiddenPartIds?: ReadonlySet<string>
): THREE.Mesh[] {
  const collected: THREE.Mesh[] = [];
  const seen = new Set<THREE.Object3D>();
  const updatedRoots = new Set<THREE.Object3D>();

  for (const root of roots) {
    if (!updatedRoots.has(root)) {
      updatedRoots.add(root);
      updateAncestorWorldMatrices(root);
      root.updateMatrixWorld(true);
    }

    if (root.parent && !isAncestorChainSolidVisible(root.parent, hiddenPartIds)) {
      continue;
    }

    const stack: THREE.Object3D[] = [root];
    while (stack.length > 0) {
      const curr = stack.pop();
      if (!curr || isNodeExcluded(curr, hiddenPartIds)) {
        continue;
      }

      if (
        isMeshInstance(curr) &&
        curr.geometry &&
        hasSolidMeshMaterial(curr) &&
        !seen.has(curr)
      ) {
        if (!curr.geometry.boundingBox) {
          curr.geometry.computeBoundingBox();
        }
        if (!curr.geometry.boundingSphere) {
          curr.geometry.computeBoundingSphere();
        }
        seen.add(curr);
        collected.push(curr);
      }

      for (let i = curr.children.length - 1; i >= 0; i--) {
        stack.push(curr.children[i]);
      }
    }
  }

  return collected;
}

function resolveHitObjectName(
  obj: THREE.Object3D,
  customResolver?: (obj: THREE.Object3D) => string | null | undefined
): string {
  if (customResolver) {
    const resolved = customResolver(obj);
    if (typeof resolved === 'string' && resolved.trim().length > 0) {
      return resolved;
    }
  }

  let sawApplianceMarker = false;
  let curr: THREE.Object3D | null = obj;

  while (curr) {
    const data = curr.userData as Record<string, unknown> | undefined;
    if (data) {
      const partName = readNamedField(data['part'], 'name');
      if (partName) {
        return partName;
      }

      const appName = readNamedField(data['appliance'], 'name');
      if (appName) {
        return appName;
      }

      if (typeof data['applianceName'] === 'string' && data['applianceName'].trim().length > 0) {
        return data['applianceName'];
      }

      if (data['isWall'] || data['wallId'] || data['wallType']) {
        if (typeof data['wallName'] === 'string' && data['wallName'].trim().length > 0) {
          return data['wallName'];
        }
        return 'Muro';
      }

      if (data['isFloor']) {
        return 'Piso';
      }

      if (data['isReferenceGuide']) {
        return 'Guía de Referencia';
      }

      if (data['isAppliance'] || data['applianceId'] || data['appliance']) {
        sawApplianceMarker = true;
      }
    }
    curr = curr.parent;
  }

  return sawApplianceMarker ? 'Equipo' : 'Superficie 3D';
}

function computeStruckWorldNormal(
  mesh: THREE.Mesh,
  face: THREE.Face | null | undefined
): THREE.Vector3 | null {
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);

  if (face?.normal && face.normal.lengthSq() > 1e-10) {
    const worldNormal = face.normal.clone().applyMatrix3(normalMatrix);
    if (worldNormal.lengthSq() > 1e-10) {
      return worldNormal.normalize();
    }
  }

  const posAttr = mesh.geometry.getAttribute('position');
  if (face && posAttr) {
    const va = new THREE.Vector3().fromBufferAttribute(posAttr, face.a).applyMatrix4(mesh.matrixWorld);
    const vb = new THREE.Vector3().fromBufferAttribute(posAttr, face.b).applyMatrix4(mesh.matrixWorld);
    const vc = new THREE.Vector3().fromBufferAttribute(posAttr, face.c).applyMatrix4(mesh.matrixWorld);
    const computed = vb.sub(va).cross(vc.sub(va));
    if (computed.lengthSq() > 1e-10) {
      return computed.normalize();
    }
  }

  return null;
}

function buildEdgeObject(p1: THREE.Vector3, p2: THREE.Vector3): StruckFaceEdge | null {
  const delta = p2.clone().sub(p1);
  const length = delta.length();
  if (length <= 1e-4) {
    return null;
  }
  return {
    p1: p1.clone(),
    p2: p2.clone(),
    midpoint: p1.clone().add(p2).multiplyScalar(0.5),
    dir: delta.divideScalar(length),
    length
  };
}

function extractLocalObbFaceFeatures(
  mesh: THREE.Mesh,
  preferredNormal: THREE.Vector3 | null,
  hitPoint: THREE.Vector3
): StruckFaceFeatures | null {
  const geometry = mesh.geometry;
  if (!geometry.boundingBox) {
    geometry.computeBoundingBox();
  }
  const box = geometry.boundingBox;
  if (!box || box.isEmpty()) {
    return null;
  }

  const { min, max } = box;
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);

  const obbFaces: { localNormal: THREE.Vector3; localCorners: THREE.Vector3[] }[] = [
    {
      localNormal: new THREE.Vector3(1, 0, 0),
      localCorners: [
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(max.x, max.y, min.z),
        new THREE.Vector3(max.x, max.y, max.z),
        new THREE.Vector3(max.x, min.y, max.z)
      ]
    },
    {
      localNormal: new THREE.Vector3(-1, 0, 0),
      localCorners: [
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(min.x, min.y, max.z),
        new THREE.Vector3(min.x, max.y, max.z),
        new THREE.Vector3(min.x, max.y, min.z)
      ]
    },
    {
      localNormal: new THREE.Vector3(0, 1, 0),
      localCorners: [
        new THREE.Vector3(min.x, max.y, min.z),
        new THREE.Vector3(min.x, max.y, max.z),
        new THREE.Vector3(max.x, max.y, max.z),
        new THREE.Vector3(max.x, max.y, min.z)
      ]
    },
    {
      localNormal: new THREE.Vector3(0, -1, 0),
      localCorners: [
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(max.x, min.y, min.z),
        new THREE.Vector3(max.x, min.y, max.z),
        new THREE.Vector3(min.x, min.y, max.z)
      ]
    },
    {
      localNormal: new THREE.Vector3(0, 0, 1),
      localCorners: [
        new THREE.Vector3(min.x, min.y, max.z),
        new THREE.Vector3(max.x, min.y, max.z),
        new THREE.Vector3(max.x, max.y, max.z),
        new THREE.Vector3(min.x, max.y, max.z)
      ]
    },
    {
      localNormal: new THREE.Vector3(0, 0, -1),
      localCorners: [
        new THREE.Vector3(min.x, min.y, min.z),
        new THREE.Vector3(min.x, max.y, min.z),
        new THREE.Vector3(max.x, max.y, min.z),
        new THREE.Vector3(max.x, min.y, min.z)
      ]
    }
  ];

  let bestIndex = 0;
  let bestScore = -Infinity;
  const worldNormals: THREE.Vector3[] = [];

  for (let i = 0; i < obbFaces.length; i++) {
    const wNorm = obbFaces[i].localNormal.clone().applyMatrix3(normalMatrix);
    if (wNorm.lengthSq() > 1e-10) {
      wNorm.normalize();
    }
    worldNormals.push(wNorm);

    if (preferredNormal) {
      const dot = wNorm.dot(preferredNormal);
      if (dot > bestScore) {
        bestScore = dot;
        bestIndex = i;
      }
    } else {
      const sampleWorld = obbFaces[i].localCorners[0].clone().applyMatrix4(mesh.matrixWorld);
      const planeDist = Math.abs(new THREE.Plane().setFromNormalAndCoplanarPoint(wNorm, sampleWorld).distanceToPoint(hitPoint));
      const score = -planeDist;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
  }

  const chosenFace = obbFaces[bestIndex];
  const chosenNormal = worldNormals[bestIndex];
  const rawWorldCorners = chosenFace.localCorners.map((c) => c.clone().applyMatrix4(mesh.matrixWorld));

  const corners: THREE.Vector3[] = [];
  const cornerKeys = new Set<string>();
  for (const c of rawWorldCorners) {
    const key = quantizeVertexKey(c);
    if (!cornerKeys.has(key)) {
      cornerKeys.add(key);
      corners.push(c);
    }
  }

  const edges: StruckFaceEdge[] = [];
  for (let i = 0; i < rawWorldCorners.length; i++) {
    const edge = buildEdgeObject(rawWorldCorners[i], rawWorldCorners[(i + 1) % rawWorldCorners.length]);
    if (edge) {
      edges.push(edge);
    }
  }

  if (corners.length === 0 || edges.length === 0) {
    return null;
  }

  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(chosenNormal, corners[0]);
  return {
    worldNormal: chosenNormal,
    planeD: plane.constant,
    corners,
    edges,
    isFallbackObb: true
  };
}

function isolateConnectedCoplanarPatch(
  coplanarTris: readonly CoplanarTriangle[],
  struckFaceIndex: number | undefined,
  struckFace: THREE.Face | null | undefined,
  hitPoint: THREE.Vector3
): readonly CoplanarTriangle[] {
  if (coplanarTris.length <= 1) {
    return coplanarTris;
  }

  let seedIdx = -1;
  if (typeof struckFaceIndex === 'number') {
    seedIdx = coplanarTris.findIndex((t) => t.triIndex === struckFaceIndex);
  }
  if (seedIdx === -1 && struckFace) {
    seedIdx = coplanarTris.findIndex(
      (t) =>
        t.indices[0] === struckFace.a &&
        t.indices[1] === struckFace.b &&
        t.indices[2] === struckFace.c
    );
  }
  if (seedIdx === -1) {
    let minDistSq = Infinity;
    for (let i = 0; i < coplanarTris.length; i++) {
      const dSq = coplanarTris[i].center.distanceToSquared(hitPoint);
      if (dSq < minDistSq) {
        minDistSq = dSq;
        seedIdx = i;
      }
    }
  }

  if (seedIdx === -1) {
    return coplanarTris;
  }

  const vertexToTris = new Map<string, number[]>();
  for (let i = 0; i < coplanarTris.length; i++) {
    const tri = coplanarTris[i];
    for (const key of tri.keys) {
      const list = vertexToTris.get(key);
      if (list) {
        list.push(i);
      } else {
        vertexToTris.set(key, [i]);
      }
    }
  }

  const visited = new Set<number>([seedIdx]);
  const queue: number[] = [seedIdx];
  const component: CoplanarTriangle[] = [];

  while (queue.length > 0) {
    const idx = queue.shift()!;
    const tri = coplanarTris[idx];
    component.push(tri);

    for (const key of tri.keys) {
      const neighbors = vertexToTris.get(key);
      if (!neighbors) {
        continue;
      }
      for (const nIdx of neighbors) {
        if (!visited.has(nIdx)) {
          visited.add(nIdx);
          queue.push(nIdx);
        }
      }
    }
  }

  return component;
}

function mergeCollinearBoundaryEdges(
  boundaryEdges: readonly { k1: string; k2: string }[],
  vertexPositions: ReadonlyMap<string, THREE.Vector3>
): { edges: StruckFaceEdge[]; corners: THREE.Vector3[] } {
  const drafts: BoundaryEdgeDraft[] = boundaryEdges.map((edge, idx) => ({
    id: idx,
    a: edge.k1,
    b: edge.k2,
    alive: true
  }));

  const maxPasses = drafts.length;
  for (let pass = 0; pass < maxPasses; pass++) {
    const adj = new Map<string, number[]>();
    for (const draft of drafts) {
      if (!draft.alive) {
        continue;
      }
      const listA = adj.get(draft.a);
      if (listA) {
        listA.push(draft.id);
      } else {
        adj.set(draft.a, [draft.id]);
      }
      const listB = adj.get(draft.b);
      if (listB) {
        listB.push(draft.id);
      } else {
        adj.set(draft.b, [draft.id]);
      }
    }

    let merged = false;
    for (const [vKey, incidentIds] of adj.entries()) {
      if (incidentIds.length !== 2) {
        continue;
      }
      const e1 = drafts[incidentIds[0]];
      const e2 = drafts[incidentIds[1]];
      if (!e1.alive || !e2.alive) {
        continue;
      }

      const u = e1.a === vKey ? e1.b : e1.a;
      const w = e2.a === vKey ? e2.b : e2.a;
      if (u === w || u === vKey || w === vKey) {
        continue;
      }

      const pU = vertexPositions.get(u);
      const pV = vertexPositions.get(vKey);
      const pW = vertexPositions.get(w);
      if (!pU || !pV || !pW) {
        continue;
      }

      const dir1 = pV.clone().sub(pU);
      const dir2 = pW.clone().sub(pV);
      const len1 = dir1.length();
      const len2 = dir2.length();
      if (len1 <= 1e-4 || len2 <= 1e-4) {
        continue;
      }
      dir1.divideScalar(len1);
      dir2.divideScalar(len2);

      if (dir1.dot(dir2) <= COLLINEAR_DOT_MIN) {
        continue;
      }

      const dirUW = pW.clone().sub(pU);
      const lenUW = dirUW.length();
      if (lenUW <= 1e-4) {
        continue;
      }
      dirUW.divideScalar(lenUW);
      const perpDist = pV.clone().sub(pU).cross(dirUW).length();
      if (perpDist >= COLLINEAR_LINE_DEV_MAX_MM) {
        continue;
      }

      e1.alive = false;
      e2.alive = false;
      drafts.push({
        id: drafts.length,
        a: u,
        b: w,
        alive: true
      });
      merged = true;
      break;
    }

    if (!merged) {
      break;
    }
  }

  const finalEdges: StruckFaceEdge[] = [];
  const seenUndirected = new Set<string>();
  const cornerKeys = new Set<string>();
  const corners: THREE.Vector3[] = [];

  for (const draft of drafts) {
    if (!draft.alive) {
      continue;
    }
    const edgeKey = makeUndirectedEdgeKey(draft.a, draft.b);
    if (seenUndirected.has(edgeKey)) {
      continue;
    }
    const p1 = vertexPositions.get(draft.a);
    const p2 = vertexPositions.get(draft.b);
    if (!p1 || !p2) {
      continue;
    }
    const edgeObj = buildEdgeObject(p1, p2);
    if (!edgeObj) {
      continue;
    }
    seenUndirected.add(edgeKey);
    finalEdges.push(edgeObj);

    if (!cornerKeys.has(draft.a)) {
      cornerKeys.add(draft.a);
      corners.push(p1.clone());
    }
    if (!cornerKeys.has(draft.b)) {
      cornerKeys.add(draft.b);
      corners.push(p2.clone());
    }
  }

  return { edges: finalEdges, corners };
}

function closestSegmentPointToRay(
  ray: THREE.Ray,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  hitPoint: THREE.Vector3
): THREE.Vector3 {
  const v = p2.clone().sub(p1);
  const c = v.lengthSq();
  if (c <= 1e-6) {
    return p1.clone();
  }

  const rayDir = ray.direction;
  const w0 = p1.clone().sub(ray.origin);
  const a = rayDir.lengthSq();
  const b = rayDir.dot(v);
  const d = rayDir.dot(w0);
  const e = v.dot(w0);
  const denom = a * c - b * b;

  let t: number;
  if (denom > 1e-6) {
    t = (b * d - a * e) / denom;
  } else {
    t = hitPoint.clone().sub(p1).dot(v) / c;
  }
  t = Math.max(0, Math.min(1, t));
  return p1.clone().addScaledVector(v, t);
}

/**
 * Determina si la distancia entre pointerdown y pointerup corresponde a un clic limpio
 * (`<= maxPx`) y no a un arrastre de cámara.
 */
export function isClickWithinThreshold(
  downX: number,
  downY: number,
  upX: number,
  upY: number,
  maxPx: number = CLICK_DRAG_THRESHOLD_PX
): boolean {
  if (
    !Number.isFinite(downX) ||
    !Number.isFinite(downY) ||
    !Number.isFinite(upX) ||
    !Number.isFinite(upY) ||
    !Number.isFinite(maxPx)
  ) {
    return false;
  }
  return Math.hypot(upX - downX, upY - downY) <= maxPx;
}

function normalizePickSurfaceOptions(
  optionsOrResolver?: PickSurfaceOptions | ((obj: THREE.Object3D) => string | null | undefined)
): PickSurfaceOptions {
  return typeof optionsOrResolver === 'function'
    ? { resolveObjectName: optionsOrResolver }
    : optionsOrResolver ?? {};
}

function pickClosestHitFromMeshes(
  raycaster: THREE.Raycaster,
  solidMeshes: THREE.Mesh[],
  options: PickSurfaceOptions
): ClosestSurfaceHitResult | null {
  if (solidMeshes.length === 0) {
    return null;
  }

  const hits = raycaster
    .intersectObjects(solidMeshes, false)
    .filter((hit) => isHitFaceMaterialValid(hit))
    .sort((a, b) => a.distance - b.distance);

  if (hits.length === 0) {
    return null;
  }

  const closest = hits[0];
  const worldNormal =
    closest.object instanceof THREE.Mesh
      ? computeStruckWorldNormal(closest.object, closest.face)
      : null;

  return {
    intersection: closest,
    object: closest.object,
    point: closest.point.clone(),
    distance: closest.distance,
    face: closest.face ?? null,
    objectName: resolveHitObjectName(closest.object, options.resolveObjectName),
    worldNormal
  };
}

/**
 * Ejecuta raycasting estricto sobre mallas sólidas visibles (ignorando helpers, líneas,
 * sprites, cotas, gizmos y hitboxes transparentes) y retorna únicamente `hits[0]`.
 */
export function pickClosestVisibleSurfaceHit(
  raycaster: THREE.Raycaster,
  solidRootObjects: THREE.Object3D | readonly (THREE.Object3D | null | undefined)[] | null | undefined,
  optionsOrResolver?: PickSurfaceOptions | ((obj: THREE.Object3D) => string | null | undefined)
): ClosestSurfaceHitResult | null {
  const roots = normalizeRootList(solidRootObjects);
  if (roots.length === 0) {
    return null;
  }

  const options = normalizePickSurfaceOptions(optionsOrResolver);
  const solidMeshes = collectSolidVisibleMeshes(roots, options.hiddenPartIds);
  return pickClosestHitFromMeshes(raycaster, solidMeshes, options);
}

/**
 * Extrae únicamente las esquinas y aristas exteriores visibles de la cara impactada (`hits[0]`),
 * eliminando diagonales internas de triangulación y fusionando aristas colineales contiguas.
 */
export function extractStruckFaceFeatures(
  hit: THREE.Intersection | ClosestSurfaceHitResult
): StruckFaceFeatures | null {
  const hitObject = hit.object;
  if (!(hitObject instanceof THREE.Mesh) || !hitObject.geometry) {
    return null;
  }

  hitObject.updateMatrixWorld(true);
  const geometry = hitObject.geometry;
  const posAttr = geometry.getAttribute('position');
  if (!posAttr || posAttr.count < 3) {
    return null;
  }

  const struckFace = hit.face ?? null;
  const rawFaceIndex =
    'intersection' in hit ? hit.intersection.faceIndex : hit.faceIndex;
  const struckFaceIndex = typeof rawFaceIndex === 'number' ? rawFaceIndex : undefined;
  const worldNormal = computeStruckWorldNormal(hitObject, struckFace);

  if (!worldNormal) {
    return extractLocalObbFaceFeatures(hitObject, null, hit.point);
  }

  const indexAttr = geometry.getIndex();
  const triCount = indexAttr
    ? Math.floor(indexAttr.count / 3)
    : Math.floor(posAttr.count / 3);

  if (triCount > HIGH_POLY_OBB_TRIANGLE_THRESHOLD) {
    return extractLocalObbFaceFeatures(hitObject, worldNormal, hit.point);
  }

  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(worldNormal, hit.point);
  const coplanarTris: CoplanarTriangle[] = [];
  const vertexPositions = new Map<string, THREE.Vector3>();
  const edgeVec1 = new THREE.Vector3();
  const edgeVec2 = new THREE.Vector3();

  for (let triIndex = 0; triIndex < triCount; triIndex++) {
    const i0 = triIndex * 3;
    const ia = indexAttr ? indexAttr.getX(i0) : i0;
    const ib = indexAttr ? indexAttr.getX(i0 + 1) : i0 + 1;
    const ic = indexAttr ? indexAttr.getX(i0 + 2) : i0 + 2;

    const wa = new THREE.Vector3().fromBufferAttribute(posAttr, ia).applyMatrix4(hitObject.matrixWorld);
    const wb = new THREE.Vector3().fromBufferAttribute(posAttr, ib).applyMatrix4(hitObject.matrixWorld);
    const wc = new THREE.Vector3().fromBufferAttribute(posAttr, ic).applyMatrix4(hitObject.matrixWorld);

    edgeVec1.subVectors(wb, wa);
    edgeVec2.subVectors(wc, wa);
    const triNormal = edgeVec1.clone().cross(edgeVec2);
    if (triNormal.lengthSq() <= 1e-10) {
      continue;
    }
    triNormal.normalize();

    if (triNormal.dot(worldNormal) <= COPLANAR_NORMAL_DOT_MIN) {
      continue;
    }
    if (
      Math.abs(plane.distanceToPoint(wa)) >= COPLANAR_VERTEX_DIST_MAX_MM ||
      Math.abs(plane.distanceToPoint(wb)) >= COPLANAR_VERTEX_DIST_MAX_MM ||
      Math.abs(plane.distanceToPoint(wc)) >= COPLANAR_VERTEX_DIST_MAX_MM
    ) {
      continue;
    }

    const kA = quantizeVertexKey(wa);
    const kB = quantizeVertexKey(wb);
    const kC = quantizeVertexKey(wc);
    if (!vertexPositions.has(kA)) vertexPositions.set(kA, wa);
    if (!vertexPositions.has(kB)) vertexPositions.set(kB, wb);
    if (!vertexPositions.has(kC)) vertexPositions.set(kC, wc);

    const center = wa.clone().add(wb).add(wc).multiplyScalar(1 / 3);
    coplanarTris.push({
      triIndex,
      indices: [ia, ib, ic],
      keys: [kA, kB, kC],
      center
    });
  }

  if (coplanarTris.length === 0) {
    return extractLocalObbFaceFeatures(hitObject, worldNormal, hit.point);
  }

  const patchTris = isolateConnectedCoplanarPatch(
    coplanarTris,
    struckFaceIndex,
    struckFace,
    hit.point
  );

  const edgeCounts = new Map<string, { k1: string; k2: string; count: number }>();
  for (const tri of patchTris) {
    const pairs: [string, string][] = [
      [tri.keys[0], tri.keys[1]],
      [tri.keys[1], tri.keys[2]],
      [tri.keys[2], tri.keys[0]]
    ];
    for (const [k1, k2] of pairs) {
      if (k1 === k2) {
        continue;
      }
      const edgeKey = makeUndirectedEdgeKey(k1, k2);
      const existing = edgeCounts.get(edgeKey);
      if (existing) {
        existing.count += 1;
      } else {
        edgeCounts.set(edgeKey, { k1, k2, count: 1 });
      }
    }
  }

  const boundaryEdges: { k1: string; k2: string }[] = [];
  for (const entry of edgeCounts.values()) {
    if (entry.count === 1) {
      boundaryEdges.push({ k1: entry.k1, k2: entry.k2 });
    }
  }

  if (boundaryEdges.length === 0) {
    return extractLocalObbFaceFeatures(hitObject, worldNormal, hit.point);
  }

  const merged = mergeCollinearBoundaryEdges(boundaryEdges, vertexPositions);
  if (merged.edges.length === 0 || merged.corners.length === 0) {
    return extractLocalObbFaceFeatures(hitObject, worldNormal, hit.point);
  }

  return {
    worldNormal,
    planeD: plane.constant,
    corners: merged.corners,
    edges: merged.edges,
    isFallbackObb: false
  };
}

/**
 * Proyecta un punto 3D de mundo a coordenadas CSS 2D del viewport (`[0..width, 0..height]`).
 */
export function projectWorldPointToScreen(
  worldPoint: Point3D | THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number
): ScreenProjectionPoint {
  if (width <= 0 || height <= 0) {
    return { x: 0, y: 0, ndcZ: 2, inFront: false, visible: false };
  }

  camera.updateMatrixWorld();
  const worldVec =
    worldPoint instanceof THREE.Vector3
      ? worldPoint.clone()
      : new THREE.Vector3(worldPoint.x, worldPoint.y, worldPoint.z);

  let inCameraRange = true;
  if (camera instanceof THREE.PerspectiveCamera) {
    const camSpace = worldVec.clone().applyMatrix4(camera.matrixWorldInverse);
    if (camSpace.z > -camera.near || camSpace.z < -camera.far) {
      inCameraRange = false;
    }
  }

  const ndc = worldVec.clone().project(camera);
  const x = ((ndc.x + 1) * 0.5) * width;
  const y = ((-ndc.y + 1) * 0.5) * height;
  const inFront = inCameraRange && ndc.z >= -1 && ndc.z <= 1;
  const inBounds = x >= 0 && x <= width && y >= 0 && y <= height;

  return {
    x,
    y,
    ndcZ: ndc.z,
    inFront,
    visible: inFront && inBounds
  };
}

interface FaceSnapSource {
  object: THREE.Object3D;
  objectName: string;
  hitDistance: number;
  fallbackPoint: THREE.Vector3;
  features: StruckFaceFeatures;
  faceNormal: THREE.Vector3;
}

interface SnapRadiusConfig {
  cornerRadiusPx: number;
  midpointRadiusPx: number;
  edgeRadiusPx: number;
}

interface RankedSnapMatch {
  source: FaceSnapSource;
  worldPos: THREE.Vector3;
  distPx: number;
  edge?: StruckFaceEdge;
}

function setRaycasterFromClient(
  raycaster: THREE.Raycaster,
  clientX: number,
  clientY: number,
  viewportRect: ViewportRect,
  camera: THREE.Camera,
  ndcScratch: THREE.Vector2
): void {
  const ndcX = ((clientX - viewportRect.left) / viewportRect.width) * 2 - 1;
  const ndcY = -((clientY - viewportRect.top) / viewportRect.height) * 2 + 1;
  raycaster.setFromCamera(ndcScratch.set(ndcX, ndcY), camera);
}

function toClientScreenPoint(
  worldPt: THREE.Vector3,
  camera: THREE.Camera,
  viewportRect: ViewportRect
): { x: number; y: number; inFront: boolean } {
  const proj = projectWorldPointToScreen(worldPt, camera, viewportRect.width, viewportRect.height);
  return {
    x: viewportRect.left + proj.x,
    y: viewportRect.top + proj.y,
    inFront: proj.inFront
  };
}

function buildProbeOffsets(maxRadiusPx: number): { dx: number; dy: number }[] {
  if (!Number.isFinite(maxRadiusPx) || maxRadiusPx <= 0) {
    return [];
  }
  const radii: number[] = [];
  for (const r of SILHOUETTE_PROBE_RADII_PX) {
    if (r <= maxRadiusPx) {
      radii.push(r);
    }
  }
  if (radii.length === 0 || radii[radii.length - 1] < maxRadiusPx - 0.25) {
    radii.push(maxRadiusPx);
  }

  const offsets: { dx: number; dy: number }[] = [];
  for (const r of radii) {
    for (let i = 0; i < SILHOUETTE_PROBE_ANGLE_COUNT; i++) {
      const theta = (i * Math.PI * 2) / SILHOUETTE_PROBE_ANGLE_COUNT;
      offsets.push({
        dx: Math.cos(theta) * r,
        dy: Math.sin(theta) * r
      });
    }
  }
  return offsets;
}

function makeStruckFaceKey(hit: ClosestSurfaceHitResult): string {
  if (hit.worldNormal) {
    const n = hit.worldNormal;
    const planeD = -n.dot(hit.point);
    const nx = Math.round(n.x * 1000);
    const ny = Math.round(n.y * 1000);
    const nz = Math.round(n.z * 1000);
    const qd = Math.round(planeD * 10);
    return `${hit.object.uuid}|${nx},${ny},${nz}|${qd}`;
  }
  return `${hit.object.uuid}|obb|${hit.intersection.faceIndex ?? quantizeVertexKey(hit.point)}`;
}

function createFaceSnapSource(hit: ClosestSurfaceHitResult): FaceSnapSource | null {
  const features = extractStruckFaceFeatures(hit);
  if (!features) {
    return null;
  }
  return {
    object: hit.object,
    objectName: hit.objectName,
    hitDistance: hit.distance,
    fallbackPoint: hit.point.clone(),
    features,
    faceNormal: features.worldNormal.clone()
  };
}

function isPointVisibleFromCamera(
  worldPt: THREE.Vector3,
  camera: THREE.Camera,
  solidMeshes: THREE.Mesh[],
  options: PickSurfaceOptions,
  visRaycaster: THREE.Raycaster,
  ndcScratch: THREE.Vector2
): boolean {
  const ndc = worldPt.clone().project(camera);
  if (!Number.isFinite(ndc.x) || !Number.isFinite(ndc.y) || ndc.z < -1 || ndc.z > 1) {
    return false;
  }
  visRaycaster.setFromCamera(ndcScratch.set(ndc.x, ndc.y), camera);
  const distToPoint = visRaycaster.ray.origin.distanceTo(worldPt);
  const occluderHit = pickClosestHitFromMeshes(visRaycaster, solidMeshes, options);
  if (!occluderHit) {
    return true;
  }
  return occluderHit.distance >= distToPoint - CAMERA_VISIBILITY_EPSILON_MM;
}

function compareSnapRank(a: RankedSnapMatch, b: RankedSnapMatch): number {
  const diffPx = a.distPx - b.distPx;
  if (Math.abs(diffPx) > SNAP_RANK_TIE_PX) {
    return diffPx;
  }
  return a.source.hitDistance - b.source.hitDistance;
}

function pickBestVisibleMatch(
  matches: RankedSnapMatch[],
  requireVisibilityCheck: boolean,
  camera: THREE.Camera,
  solidMeshes: THREE.Mesh[],
  options: PickSurfaceOptions
): RankedSnapMatch | null {
  if (matches.length === 0) {
    return null;
  }
  matches.sort(compareSnapRank);
  if (!requireVisibilityCheck) {
    return matches[0];
  }

  const visRaycaster = new THREE.Raycaster();
  const ndcScratch = new THREE.Vector2();
  for (const match of matches) {
    if (isPointVisibleFromCamera(match.worldPos, camera, solidMeshes, options, visRaycaster, ndcScratch)) {
      return match;
    }
  }
  return null;
}

function buildSnapCandidateFromMatch(
  type: 'corner' | 'midpoint' | 'edge',
  match: RankedSnapMatch
): MagneticSnapCandidate {
  const candidate: MagneticSnapCandidate = {
    worldPos: match.worldPos.clone(),
    type,
    label: SNAP_LABELS[type],
    colorHex: SNAP_COLORS[type],
    colorCss: SNAP_CSS_COLORS[type],
    objectName: match.source.objectName,
    screenDistancePx: match.distPx,
    hitDistance: match.source.hitDistance,
    hitObject: match.source.object,
    faceNormal: match.source.faceNormal.clone()
  };

  if (match.edge) {
    candidate.edgeDir = match.edge.dir.clone();
    candidate.edgeP1 = match.edge.p1.clone();
    candidate.edgeP2 = match.edge.p2.clone();
  }

  return candidate;
}

function resolveSnapHierarchyFromSources(
  sources: readonly FaceSnapSource[],
  clientX: number,
  clientY: number,
  viewportRect: ViewportRect,
  camera: THREE.Camera,
  centerRay: THREE.Ray,
  radii: SnapRadiusConfig,
  solidMeshes: THREE.Mesh[],
  options: PickSurfaceOptions,
  requireVisibilityCheck: boolean
): MagneticSnapCandidate | null {
  if (sources.length === 0) {
    return null;
  }

  // Prioridad 1: Esquina <= 10px
  const cornerMatches: RankedSnapMatch[] = [];
  for (const source of sources) {
    for (const corner of source.features.corners) {
      const sp = toClientScreenPoint(corner, camera, viewportRect);
      if (!sp.inFront) {
        continue;
      }
      const distPx = Math.hypot(sp.x - clientX, sp.y - clientY);
      if (distPx <= radii.cornerRadiusPx) {
        cornerMatches.push({ source, worldPos: corner, distPx });
      }
    }
  }
  const bestCorner = pickBestVisibleMatch(
    cornerMatches,
    requireVisibilityCheck,
    camera,
    solidMeshes,
    options
  );
  if (bestCorner) {
    return buildSnapCandidateFromMatch('corner', bestCorner);
  }

  // Prioridad 2: Punto medio de arista <= 10px
  const midpointMatches: RankedSnapMatch[] = [];
  for (const source of sources) {
    for (const edge of source.features.edges) {
      const sp = toClientScreenPoint(edge.midpoint, camera, viewportRect);
      if (!sp.inFront) {
        continue;
      }
      const distPx = Math.hypot(sp.x - clientX, sp.y - clientY);
      if (distPx <= radii.midpointRadiusPx) {
        midpointMatches.push({ source, worldPos: edge.midpoint, distPx, edge });
      }
    }
  }
  const bestMidpoint = pickBestVisibleMatch(
    midpointMatches,
    requireVisibilityCheck,
    camera,
    solidMeshes,
    options
  );
  if (bestMidpoint) {
    return buildSnapCandidateFromMatch('midpoint', bestMidpoint);
  }

  // Prioridad 3: Deslizamiento continuo sobre arista <= 12px (sin saltar a esquinas)
  const edgeMatches: RankedSnapMatch[] = [];
  for (const source of sources) {
    for (const edge of source.features.edges) {
      const segPt = closestSegmentPointToRay(centerRay, edge.p1, edge.p2, source.fallbackPoint);
      const sp = toClientScreenPoint(segPt, camera, viewportRect);
      if (!sp.inFront) {
        continue;
      }
      const distPx = Math.hypot(sp.x - clientX, sp.y - clientY);
      if (distPx <= radii.edgeRadiusPx) {
        edgeMatches.push({ source, worldPos: segPt, distPx, edge });
      }
    }
  }
  const bestEdgeSlide = pickBestVisibleMatch(
    edgeMatches,
    requireVisibilityCheck,
    camera,
    solidMeshes,
    options
  );
  if (bestEdgeSlide) {
    return buildSnapCandidateFromMatch('edge', bestEdgeSlide);
  }

  return null;
}

function probeSilhouetteSnapSources(
  clientX: number,
  clientY: number,
  viewportRect: ViewportRect,
  camera: THREE.Camera,
  solidMeshes: THREE.Mesh[],
  options: PickSurfaceOptions,
  maxProbeRadiusPx: number
): FaceSnapSource[] {
  const minX = viewportRect.left;
  const maxX = viewportRect.left + viewportRect.width;
  const minY = viewportRect.top;
  const maxY = viewportRect.top + viewportRect.height;

  if (
    clientX < minX - maxProbeRadiusPx ||
    clientX > maxX + maxProbeRadiusPx ||
    clientY < minY - maxProbeRadiusPx ||
    clientY > maxY + maxProbeRadiusPx
  ) {
    return [];
  }

  const offsets = buildProbeOffsets(maxProbeRadiusPx);
  if (offsets.length === 0) {
    return [];
  }

  const probeRaycaster = new THREE.Raycaster();
  const ndcScratch = new THREE.Vector2();
  const seenProbeCoords = new Set<string>();
  const faceMap = new Map<string, FaceSnapSource>();

  for (const offset of offsets) {
    const probeX = Math.min(maxX, Math.max(minX, clientX + offset.dx));
    const probeY = Math.min(maxY, Math.max(minY, clientY + offset.dy));
    if (Math.hypot(probeX - clientX, probeY - clientY) < 0.25) {
      continue;
    }

    const coordKey = `${Math.round(probeX * 100)},${Math.round(probeY * 100)}`;
    if (seenProbeCoords.has(coordKey)) {
      continue;
    }
    seenProbeCoords.add(coordKey);

    setRaycasterFromClient(probeRaycaster, probeX, probeY, viewportRect, camera, ndcScratch);
    const probeHit = pickClosestHitFromMeshes(probeRaycaster, solidMeshes, options);
    if (!probeHit) {
      continue;
    }

    const faceKey = makeStruckFaceKey(probeHit);
    const existing = faceMap.get(faceKey);
    if (existing) {
      if (probeHit.distance < existing.hitDistance) {
        existing.hitDistance = probeHit.distance;
        existing.fallbackPoint = probeHit.point.clone();
      }
      continue;
    }

    const source = createFaceSnapSource(probeHit);
    if (source) {
      faceMap.set(faceKey, source);
    }
  }

  return Array.from(faceMap.values());
}

/**
 * Encuentra el candidato magnético de imán sobre la cara visible más cercana (`hits[0]`)
 * siguiendo estrictamente la jerarquía en pantalla:
 * 1) Esquina (`<= 10px`), 2) Punto medio (`<= 10px`), 3) En arista (`<= 12px`), 4) En cara (`> 12px`).
 * Cuando el rayo central roza el borde exterior de la silueta (`!hit`), sondea un micro-anillo
 * para resolver esquinas, puntos medios y aristas visibles no ocluidas dentro del radio magnético.
 */
export function findClosestVisibleSnapCandidate(
  clientX: number,
  clientY: number,
  viewportRect: ViewportRect,
  camera: THREE.Camera,
  solidRootObjects: THREE.Object3D | readonly (THREE.Object3D | null | undefined)[] | null | undefined,
  options: SnapSearchOptions = {}
): MagneticSnapCandidate | null {
  if (viewportRect.width <= 0 || viewportRect.height <= 0) {
    return null;
  }

  const roots = normalizeRootList(solidRootObjects);
  if (roots.length === 0) {
    return null;
  }

  const solidMeshes = collectSolidVisibleMeshes(roots, options.hiddenPartIds);
  if (solidMeshes.length === 0) {
    return null;
  }

  camera.updateMatrixWorld();
  const raycaster = new THREE.Raycaster();
  const ndcScratch = new THREE.Vector2();
  setRaycasterFromClient(raycaster, clientX, clientY, viewportRect, camera, ndcScratch);

  const radii: SnapRadiusConfig = {
    cornerRadiusPx: options.cornerRadiusPx ?? SNAP_CORNER_RADIUS_PX,
    midpointRadiusPx: options.midpointRadiusPx ?? SNAP_MIDPOINT_RADIUS_PX,
    edgeRadiusPx: options.edgeRadiusPx ?? SNAP_EDGE_RADIUS_PX
  };

  const hit = pickClosestHitFromMeshes(raycaster, solidMeshes, options);
  if (!hit) {
    const maxProbeRadiusPx = Math.max(
      radii.cornerRadiusPx,
      radii.midpointRadiusPx,
      radii.edgeRadiusPx
    );
    const probedSources = probeSilhouetteSnapSources(
      clientX,
      clientY,
      viewportRect,
      camera,
      solidMeshes,
      options,
      maxProbeRadiusPx
    );
    return resolveSnapHierarchyFromSources(
      probedSources,
      clientX,
      clientY,
      viewportRect,
      camera,
      raycaster.ray,
      radii,
      solidMeshes,
      options,
      true
    );
  }

  const hitSource = createFaceSnapSource(hit);
  if (hitSource) {
    const snapped = resolveSnapHierarchyFromSources(
      [hitSource],
      clientX,
      clientY,
      viewportRect,
      camera,
      raycaster.ray,
      radii,
      solidMeshes,
      options,
      false
    );
    if (snapped) {
      return snapped;
    }
  }

  // Prioridad 4: Punto exacto sobre cara impactada (> 12px)
  const hitScreen = toClientScreenPoint(hit.point, camera, viewportRect);
  const faceDistPx = hitScreen.inFront ? Math.hypot(hitScreen.x - clientX, hitScreen.y - clientY) : 0;

  return {
    worldPos: hit.point.clone(),
    type: 'face',
    label: SNAP_LABELS.face,
    colorHex: SNAP_COLORS.face,
    colorCss: SNAP_CSS_COLORS.face,
    objectName: hit.objectName,
    screenDistancePx: faceDistPx,
    hitDistance: hit.distance,
    hitObject: hit.object,
    faceNormal: hitSource ? hitSource.faceNormal.clone() : hit.worldNormal?.clone()
  };
}

function projectAlongAxis(pointA: Point3D, rawPoint: Point3D, axis: 'x' | 'y' | 'z'): PerpendicularProjectionResult {
  if (axis === 'x') {
    return {
      pointB: { x: roundMm(rawPoint.x), y: roundMm(pointA.y), z: roundMm(pointA.z) },
      axisLock: 'x'
    };
  }
  if (axis === 'y') {
    return {
      pointB: { x: roundMm(pointA.x), y: roundMm(rawPoint.y), z: roundMm(pointA.z) },
      axisLock: 'y'
    };
  }
  return {
    pointB: { x: roundMm(pointA.x), y: roundMm(pointA.y), z: roundMm(rawPoint.z) },
    axisLock: 'z'
  };
}

function clipWorldSegmentInFrontOfCamera(
  aWorld: THREE.Vector3,
  bWorld: THREE.Vector3,
  camera: THREE.Camera
): THREE.Vector3 | null {
  if (!(camera instanceof THREE.PerspectiveCamera)) {
    return bWorld.clone();
  }

  const nearPlaneZ = -camera.near - 0.05;
  const aCam = aWorld.clone().applyMatrix4(camera.matrixWorldInverse);
  const bCam = bWorld.clone().applyMatrix4(camera.matrixWorldInverse);

  if (aCam.z > nearPlaneZ) {
    return null;
  }
  if (bCam.z <= nearPlaneZ) {
    return bWorld.clone();
  }

  const denom = bCam.z - aCam.z;
  if (Math.abs(denom) <= 1e-6) {
    return null;
  }
  const t = Math.max(0, Math.min(1, (nearPlaneZ - aCam.z) / denom));
  if (t <= 1e-4) {
    return null;
  }
  return aWorld.clone().lerp(bWorld, t);
}

/**
 * Resuelve la proyección ortogonal automática o forzada de `pointB` desde `pointA`,
 * soportando modo explícito (`'x' | 'y' | 'z'`), bloqueo con `Shift` y proximidad automática
 * (`<= 25 mm` de desviación lateral o `<= 15 px` al eje cardinal proyectado en pantalla).
 */
export function resolvePerpendicularPointB(
  pointA: Point3D,
  rawPoint: Point3D | THREE.Vector3,
  options: PerpendicularProjectionOptions = {}
): PerpendicularProjectionResult {
  const mode: MeasureProjectionMode = options.mode ?? 'direct';
  const shiftPressed = options.shiftPressed ?? false;
  const thresholdMm = options.axisLockThresholdMm ?? AXIS_LOCK_THRESHOLD_MM;
  const thresholdPx = options.axisLockThresholdPx ?? AXIS_LOCK_THRESHOLD_PX;

  const raw: Point3D = { x: rawPoint.x, y: rawPoint.y, z: rawPoint.z };

  if (mode === 'x' || mode === 'y' || mode === 'z') {
    return projectAlongAxis(pointA, raw, mode);
  }

  const dx = raw.x - pointA.x;
  const dy = raw.y - pointA.y;
  const dz = raw.z - pointA.z;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const absZ = Math.abs(dz);
  const totalDist = Math.hypot(dx, dy, dz);

  if (totalDist < 0.5) {
    return {
      pointB: roundPoint(raw),
      axisLock: null
    };
  }

  if (shiftPressed) {
    let dominant: 'x' | 'y' | 'z' = 'z';
    if (absX >= absY && absX >= absZ) {
      dominant = 'x';
    } else if (absY >= absX && absY >= absZ) {
      dominant = 'y';
    }
    return projectAlongAxis(pointA, raw, dominant);
  }

  // 1. Proximidad 3D a ejes cardinales (desviación lateral <= 25 mm)
  const axisEntries: {
    axis: 'x' | 'y' | 'z';
    delta: number;
    progress: number;
    lateralMm: number;
    unit: THREE.Vector3;
  }[] = [
    { axis: 'x', delta: dx, progress: absX, lateralMm: Math.hypot(dy, dz), unit: new THREE.Vector3(1, 0, 0) },
    { axis: 'y', delta: dy, progress: absY, lateralMm: Math.hypot(dx, dz), unit: new THREE.Vector3(0, 1, 0) },
    { axis: 'z', delta: dz, progress: absZ, lateralMm: Math.hypot(dx, dy), unit: new THREE.Vector3(0, 0, 1) }
  ];

  let bestMmAxis: 'x' | 'y' | 'z' | null = null;
  let bestMmLat = Infinity;
  for (const entry of axisEntries) {
    if (entry.progress >= 1 && entry.progress >= entry.lateralMm && entry.lateralMm <= thresholdMm) {
      if (entry.lateralMm < bestMmLat) {
        bestMmLat = entry.lateralMm;
        bestMmAxis = entry.axis;
      }
    }
  }
  if (bestMmAxis) {
    return projectAlongAxis(pointA, raw, bestMmAxis);
  }

  // 2. Proximidad en pantalla al eje cardinal proyectado desde pointA (<= 15 px)
  const camera = options.camera;
  const rect = options.viewportRect;
  if (camera && rect && rect.width > 0 && rect.height > 0) {
    camera.updateMatrixWorld();
    const projA = projectWorldPointToScreen(pointA, camera, rect.width, rect.height);
    if (projA.inFront) {
      const ax = rect.left + projA.x;
      const ay = rect.top + projA.y;

      let queryX = options.cursorClientX;
      let queryY = options.cursorClientY;
      if (typeof queryX !== 'number' || typeof queryY !== 'number') {
        const projRaw = projectWorldPointToScreen(raw, camera, rect.width, rect.height);
        if (projRaw.inFront) {
          queryX = rect.left + projRaw.x;
          queryY = rect.top + projRaw.y;
        }
      }

      if (typeof queryX === 'number' && typeof queryY === 'number') {
        const vecA = new THREE.Vector3(pointA.x, pointA.y, pointA.z);
        let bestPxAxis: 'x' | 'y' | 'z' | null = null;
        let bestPerpPx = Infinity;
        let bestTieLat = Infinity;

        for (const entry of axisEntries) {
          if (Math.abs(entry.delta) < 0.5) {
            continue;
          }
          const step = Math.max(25, entry.progress);
          const sign = entry.delta >= 0 ? 1 : -1;
          const sampleWorld = vecA.clone().addScaledVector(entry.unit, sign * step);
          const clippedWorld = clipWorldSegmentInFrontOfCamera(vecA, sampleWorld, camera);
          if (!clippedWorld) {
            continue;
          }

          const projS = projectWorldPointToScreen(clippedWorld, camera, rect.width, rect.height);
          if (!projS.inFront) {
            continue;
          }

          const sx = rect.left + projS.x;
          const sy = rect.top + projS.y;
          const dir2X = sx - ax;
          const dir2Y = sy - ay;
          const dir2Len = Math.hypot(dir2X, dir2Y);
          if (dir2Len < 1) {
            continue;
          }

          const ux = dir2X / dir2Len;
          const uy = dir2Y / dir2Len;
          const relX = queryX - ax;
          const relY = queryY - ay;
          const along = relX * ux + relY * uy;
          const perpPx = Math.abs(relX * uy - relY * ux);

          if (along > 4 && perpPx <= thresholdPx) {
            if (
              perpPx < bestPerpPx - 1e-4 ||
              (Math.abs(perpPx - bestPerpPx) <= 1e-4 && entry.lateralMm < bestTieLat)
            ) {
              bestPerpPx = perpPx;
              bestTieLat = entry.lateralMm;
              bestPxAxis = entry.axis;
            }
          }
        }

        if (bestPxAxis) {
          return projectAlongAxis(pointA, raw, bestPxAxis);
        }
      }
    }
  }

  return {
    pointB: roundPoint(raw),
    axisLock: null
  };
}

/**
 * Construye una medición persistente (`SavedMeasurement`) con deltas por eje
 * y distancia euclidiana total en milímetros con precisión de `0.1 mm`.
 */
export function buildSavedMeasurement(
  pointA: Point3D,
  pointB: Point3D,
  axisLock: MeasureAxisLock,
  id?: string
): SavedMeasurement {
  const cleanA = roundPoint(pointA);
  const cleanB = roundPoint(pointB);
  const deltaX = roundMm(Math.abs(cleanB.x - cleanA.x));
  const deltaY = roundMm(Math.abs(cleanB.y - cleanA.y));
  const deltaZ = roundMm(Math.abs(cleanB.z - cleanA.z));
  const distanceMm = roundMm(
    Math.hypot(cleanB.x - cleanA.x, cleanB.y - cleanA.y, cleanB.z - cleanA.z)
  );

  const resolvedId =
    typeof id === 'string' && id.trim().length > 0
      ? id
      : `measure_${++autoMeasurementCounter}`;

  return {
    id: resolvedId,
    pointA: cleanA,
    pointB: cleanB,
    distanceMm,
    deltaX,
    deltaY,
    deltaZ,
    axisLock
  };
}

/**
 * Proyecta los puntos medios de todas las mediciones guardadas a etiquetas 2D del viewport
 * con color semántico por eje y visibilidad exacta respecto al frustum de cámara.
 */
export function buildProjectedBadges(
  measurements: readonly SavedMeasurement[],
  camera: THREE.Camera,
  width: number,
  height: number
): ProjectedMeasurementBadge[] {
  const badges: ProjectedMeasurementBadge[] = [];
  for (const m of measurements) {
    const mid: Point3D = {
      x: (m.pointA.x + m.pointB.x) * 0.5,
      y: (m.pointA.y + m.pointB.y) * 0.5,
      z: (m.pointA.z + m.pointB.z) * 0.5
    };
    const proj = projectWorldPointToScreen(mid, camera, width, height);
    const colorCss =
      m.axisLock === 'x'
        ? AXIS_CSS_COLORS.x
        : m.axisLock === 'y'
          ? AXIS_CSS_COLORS.y
          : m.axisLock === 'z'
            ? AXIS_CSS_COLORS.z
            : AXIS_CSS_COLORS.direct;

    badges.push({
      id: m.id,
      x: proj.x,
      y: proj.y,
      visible: proj.visible,
      distanceMm: m.distanceMm,
      formattedDistance: `${m.distanceMm} mm`,
      deltaX: m.deltaX,
      deltaY: m.deltaY,
      deltaZ: m.deltaZ,
      axisLock: m.axisLock,
      colorCss,
      measurement: m
    });
  }
  return badges;
}

/**
 * Configura un material de la Cinta Métrica 3D como overlay sin profundidad
 * (`depthTest = false`, `depthWrite = false`) y retorna `renderOrder = 995`.
 */
export function configureMeasureOverlayMaterial(mat: THREE.Material): number {
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
  return TAPE_MEASURE_RENDER_ORDER;
}

/**
 * Motor matemático puro de Cinta Métrica 3D CAD: oclusión estricta sobre superficie más cercana,
 * extracción de aristas exteriores de la cara impactada, snapping jerárquico en pantalla,
 * proyección perpendicular automática y proyección 3D->2D de etiquetas.
 */
@Injectable({
  providedIn: 'root'
})
export class TapeMeasure3dService {
  isClickWithinThreshold(
    downX: number,
    downY: number,
    upX: number,
    upY: number,
    maxPx: number = CLICK_DRAG_THRESHOLD_PX
  ): boolean {
    return isClickWithinThreshold(downX, downY, upX, upY, maxPx);
  }

  pickClosestVisibleSurfaceHit(
    raycaster: THREE.Raycaster,
    solidRootObjects: THREE.Object3D | readonly (THREE.Object3D | null | undefined)[] | null | undefined,
    optionsOrResolver?: PickSurfaceOptions | ((obj: THREE.Object3D) => string | null | undefined)
  ): ClosestSurfaceHitResult | null {
    return pickClosestVisibleSurfaceHit(raycaster, solidRootObjects, optionsOrResolver);
  }

  extractStruckFaceFeatures(
    hit: THREE.Intersection | ClosestSurfaceHitResult
  ): StruckFaceFeatures | null {
    return extractStruckFaceFeatures(hit);
  }

  findClosestVisibleSnapCandidate(
    clientX: number,
    clientY: number,
    viewportRect: ViewportRect,
    camera: THREE.Camera,
    solidRootObjects: THREE.Object3D | readonly (THREE.Object3D | null | undefined)[] | null | undefined,
    options: SnapSearchOptions = {}
  ): MagneticSnapCandidate | null {
    return findClosestVisibleSnapCandidate(
      clientX,
      clientY,
      viewportRect,
      camera,
      solidRootObjects,
      options
    );
  }

  resolvePerpendicularPointB(
    pointA: Point3D,
    rawPoint: Point3D | THREE.Vector3,
    options: PerpendicularProjectionOptions = {}
  ): PerpendicularProjectionResult {
    return resolvePerpendicularPointB(pointA, rawPoint, options);
  }

  buildSavedMeasurement(
    pointA: Point3D,
    pointB: Point3D,
    axisLock: MeasureAxisLock,
    id?: string
  ): SavedMeasurement {
    return buildSavedMeasurement(pointA, pointB, axisLock, id);
  }

  projectWorldPointToScreen(
    worldPoint: Point3D | THREE.Vector3,
    camera: THREE.Camera,
    width: number,
    height: number
  ): ScreenProjectionPoint {
    return projectWorldPointToScreen(worldPoint, camera, width, height);
  }

  buildProjectedBadges(
    measurements: readonly SavedMeasurement[],
    camera: THREE.Camera,
    width: number,
    height: number
  ): ProjectedMeasurementBadge[] {
    return buildProjectedBadges(measurements, camera, width, height);
  }

  configureMeasureOverlayMaterial(mat: THREE.Material): number {
    return configureMeasureOverlayMaterial(mat);
  }
}
