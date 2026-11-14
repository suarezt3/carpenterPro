import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { ApplianceItem, DrillHole, Part } from '../models/melamine.models';

export type ScenePickKind =
  | 'piece'
  | 'appliance'
  | 'wall'
  | 'reference_guide'
  | 'drill_hole';

export interface ScenePieceHitMeta {
  part: Part;
  isHandle?: boolean;
  isDoor?: boolean;
  isDrawer?: boolean;
  isDrillHole?: boolean;
  drillHole?: DrillHole;
}

export interface SceneApplianceHitMeta {
  app: ApplianceItem;
  rootGroup?: THREE.Object3D | null;
}

export interface ScenePickCandidate {
  kind: ScenePickKind;
  distance: number;
  object: THREE.Object3D;
  intersection: THREE.Intersection;
  part?: Part;
  isHandle?: boolean;
  appliance?: ApplianceItem;
  wallId?: string;
  drillHole?: DrillHole;
}

export interface ScenePickResult {
  closest: ScenePickCandidate | null;
  candidates: ScenePickCandidate[];
}

export interface SceneRaycastSources {
  pieces?: readonly THREE.Object3D[];
  appliancesRoot?: THREE.Object3D | null;
  wallsRoot?: THREE.Object3D | null;
  referenceGuideRoot?: THREE.Object3D | null;
  drillRoot?: THREE.Object3D | null;
  hiddenPartIds?: ReadonlySet<string>;
  enableApplianceBoxFallback?: boolean;
  resolvePartFromObject?: (
    obj: THREE.Object3D
  ) => Part | ScenePieceHitMeta | null | undefined;
  resolveApplianceFromObject?: (
    obj: THREE.Object3D
  ) => ApplianceItem | SceneApplianceHitMeta | null | undefined;
  resolveWallIdFromObject?: (obj: THREE.Object3D) => string | null | undefined;
  resolveDrillHoleFromObject?: (obj: THREE.Object3D) => DrillHole | null | undefined;
}

export interface RefreshPickableOptions {
  forceRecomputeBounds?: boolean;
}

interface MaterialWithWireframe {
  wireframe?: boolean;
}

interface ResolvedPartDetails {
  part?: Part;
  parentPartId?: string;
  isHandle: boolean;
  isDrillHole: boolean;
  drillHole?: DrillHole;
}

const EXCLUDED_USER_DATA_FLAGS = [
  'isBoxHelper',
  'isOutline',
  'isWireframe',
  'isFloorCircle',
  'isReferenceFloorCircle',
  'isShadow',
  'isFloorShadow',
  'isGrid',
  'isCota',
  'isDimensionBadge',
  'isMeasureVisual',
  'isSnapGuide',
  'isAuxiliaryVisual',
  'isApplianceHitBox'
] as const;

const PRIORITY_HANDLE_EXCLUDED_FLAGS = [
  'isBoxHelper',
  'isOutline',
  'isWireframe',
  'isFloorCircle',
  'isReferenceFloorCircle',
  'isShadow',
  'isFloorShadow',
  'isGrid',
  'isCota',
  'isDimensionBadge',
  'isMeasureVisual',
  'isSnapGuide',
  'isAuxiliaryVisual'
] as const;

/**
 * Motor unificado de raycasting 3D closest-first (menor distancia real a cámara gana).
 * Excluye de forma estricta helpers visuales, mallas ocultas, wireframes y hitboxes transparentes,
 * y ordena todos los candidatos sólidos de la escena en una única lista por `distance`.
 */
@Injectable({
  providedIn: 'root'
})
export class SceneRaycastPickerService {
  /**
   * Determina si un objeto es una malla sólida visible y seleccionable (no auxiliar ni oculta)
   * recorriendo toda su cadena de ancestros hasta `boundaryRoot` (o raíz de escena).
   */
  isSolidPickableMesh(
    obj: THREE.Object3D,
    boundaryRoot?: THREE.Object3D | null
  ): obj is THREE.Mesh {
    if (!this.isMeshInstance(obj)) {
      return false;
    }
    if (!obj.geometry || !this.hasValidMeshMaterial(obj, false)) {
      return false;
    }
    return this.isObjectChainPickable(obj, boundaryRoot, EXCLUDED_USER_DATA_FLAGS);
  }

  /**
   * Determina si un objeto es un collider/tirador válido de Prioridad 1 (gizmos),
   * respetando visibilidad en toda la cadena de ancestros y permitiendo materiales transparentes con opacity 0.
   */
  isPriorityHandleMesh(
    obj: THREE.Object3D,
    boundaryRoot?: THREE.Object3D | null
  ): obj is THREE.Mesh {
    if (!this.isMeshInstance(obj)) {
      return false;
    }
    if (!obj.geometry || !this.hasValidMeshMaterial(obj, true)) {
      return false;
    }
    return this.isObjectChainPickable(obj, boundaryRoot, PRIORITY_HANDLE_EXCLUDED_FLAGS);
  }

  /**
   * Actualiza `matrixWorld` de cada raíz y garantiza `geometry.boundingBox` y `geometry.boundingSphere`
   * en todas las mallas sólidas seleccionables (o las recalcula si `forceRecomputeBounds` es true).
   */
  refreshPickableMatricesAndBounds(
    roots: THREE.Object3D | readonly (THREE.Object3D | null | undefined)[] | null | undefined,
    forceOrOptions: boolean | RefreshPickableOptions = false
  ): void {
    const forceRecomputeBounds = typeof forceOrOptions === 'boolean'
      ? forceOrOptions
      : Boolean(forceOrOptions?.forceRecomputeBounds);

    const rootList = this.normalizeObjectList(roots);
    if (rootList.length === 0) {
      return;
    }

    const updatedRoots = new Set<THREE.Object3D>();
    const recomputedGeometries = new Set<THREE.BufferGeometry>();

    for (const root of rootList) {
      if (updatedRoots.has(root)) {
        continue;
      }
      updatedRoots.add(root);
      this.updateAncestorWorldMatrices(root);
      root.updateMatrixWorld(true);

      root.traverse((child) => {
        if (!this.isSolidPickableMesh(child, root)) {
          return;
        }
        const geo = child.geometry;
        if (!geo.boundingBox || (forceRecomputeBounds && !recomputedGeometries.has(geo))) {
          geo.computeBoundingBox();
        }
        if (!geo.boundingSphere || (forceRecomputeBounds && !recomputedGeometries.has(geo))) {
          geo.computeBoundingSphere();
        }
        if (forceRecomputeBounds) {
          recomputedGeometries.add(geo);
        }
      });
    }
  }

  /**
   * Intersecta únicamente mallas sólidas visibles y seleccionables bajo `root`,
   * filtrando hitboxes, wireframes, líneas, sprites y ancestros ocultos.
   */
  intersectPickableMeshes(
    raycaster: THREE.Raycaster,
    root: THREE.Object3D | readonly (THREE.Object3D | null | undefined)[] | null | undefined,
    recursive = true,
    boundaryRoot?: THREE.Object3D | null
  ): THREE.Intersection[] {
    const rootList = this.normalizeObjectList(root);
    if (rootList.length === 0) {
      return [];
    }

    this.refreshMatricesForRoots(rootList, false, boundaryRoot);
    const meshes = this.collectSolidMeshes(rootList, recursive, boundaryRoot, false);
    if (meshes.length === 0) {
      return [];
    }

    return this.intersectSortedValidMeshes(raycaster, meshes, false);
  }

  /**
   * Intersecta tiradores y colliders de gizmos de Prioridad 1 (`gizmoHitMeshes`, `wallGizmoHitMeshes`,
   * `applianceHandleHitMeshes`), respetando `visible === true` en ancestros mientras permite
   * colliders transparentes con `opacity === 0`.
   */
  intersectPriorityHandles(
    raycaster: THREE.Raycaster,
    objects: THREE.Object3D | readonly (THREE.Object3D | null | undefined)[] | null | undefined,
    recursive = true,
    boundaryRoot?: THREE.Object3D | null
  ): THREE.Intersection[] {
    const rootList = this.normalizeObjectList(objects);
    if (rootList.length === 0) {
      return [];
    }

    this.refreshMatricesForRoots(rootList, true, boundaryRoot);
    const handles = this.collectSolidMeshes(rootList, recursive, boundaryRoot, true);
    if (handles.length === 0) {
      return [];
    }

    return this.intersectSortedValidMeshes(raycaster, handles, true);
  }

  /**
   * Evalúa todas las fuentes de escena (piezas, perforaciones, electrodomésticos, muros y guía espacial)
   * y retorna todos los candidatos sólidos ordenados estrictamente de menor a mayor distancia (`a.distance - b.distance`).
   */
  pickClosestSceneCandidate(
    raycaster: THREE.Raycaster,
    sources: SceneRaycastSources
  ): ScenePickResult {
    const allRoots: THREE.Object3D[] = [];
    if (sources.pieces) {
      for (const pieceRoot of sources.pieces) {
        if (pieceRoot) {
          allRoots.push(pieceRoot);
        }
      }
    }
    if (sources.drillRoot) {
      allRoots.push(sources.drillRoot);
    }
    if (sources.appliancesRoot) {
      allRoots.push(sources.appliancesRoot);
    }
    if (sources.wallsRoot) {
      allRoots.push(sources.wallsRoot);
    }
    if (sources.referenceGuideRoot) {
      allRoots.push(sources.referenceGuideRoot);
    }

    this.refreshPickableMatricesAndBounds(allRoots, false);

    const candidates: ScenePickCandidate[] = [];
    const seenPieceAndDrillMeshes = new Set<THREE.Object3D>();

    this.collectPieceCandidates(raycaster, sources, seenPieceAndDrillMeshes, candidates);
    this.collectDrillCandidates(raycaster, sources, seenPieceAndDrillMeshes, candidates);
    this.collectApplianceCandidates(raycaster, sources, candidates);
    this.collectWallCandidates(raycaster, sources, candidates);
    this.collectReferenceGuideCandidates(raycaster, sources, candidates);

    candidates.sort((a, b) => a.distance - b.distance);
    return {
      closest: candidates[0] ?? null,
      candidates
    };
  }

  private collectPieceCandidates(
    raycaster: THREE.Raycaster,
    sources: SceneRaycastSources,
    seenMeshes: Set<THREE.Object3D>,
    outCandidates: ScenePickCandidate[]
  ): void {
    const pieces = this.normalizeObjectList(sources.pieces);
    if (pieces.length === 0) {
      return;
    }

    const meshes = this.collectSolidMeshes(pieces, true, null, false, seenMeshes);
    if (meshes.length === 0) {
      return;
    }

    const hits = this.intersectSortedValidMeshes(raycaster, meshes, false);

    for (const hit of hits) {
      const resolved = this.resolvePartHit(hit.object, sources);
      if (!resolved) {
        continue;
      }
      if (this.isPartHidden(resolved.part, resolved.parentPartId, sources.hiddenPartIds)) {
        continue;
      }

      const kind: ScenePickKind = resolved.isDrillHole ? 'drill_hole' : 'piece';
      outCandidates.push({
        kind,
        distance: hit.distance,
        object: hit.object,
        intersection: hit,
        part: resolved.part,
        isHandle: resolved.isHandle ? true : undefined,
        drillHole: resolved.drillHole
      });
    }
  }

  private collectDrillCandidates(
    raycaster: THREE.Raycaster,
    sources: SceneRaycastSources,
    seenMeshes: Set<THREE.Object3D>,
    outCandidates: ScenePickCandidate[]
  ): void {
    const drillRoot = sources.drillRoot;
    if (!drillRoot || !this.isObjectChainPickable(drillRoot, null, EXCLUDED_USER_DATA_FLAGS)) {
      return;
    }

    const meshes = this.collectSolidMeshes([drillRoot], true, null, false, seenMeshes);
    if (meshes.length === 0) {
      return;
    }

    const hits = this.intersectSortedValidMeshes(raycaster, meshes, false);

    for (const hit of hits) {
      const resolved = this.resolvePartHit(hit.object, sources, drillRoot);
      const part = resolved?.part;
      const parentPartId = resolved?.parentPartId ?? this.readStringUserData(hit.object, 'parentPartId', drillRoot);
      if (this.isPartHidden(part, parentPartId, sources.hiddenPartIds)) {
        continue;
      }
      const drillHole = resolved?.drillHole ?? this.resolveDrillHole(hit.object, sources, drillRoot);

      outCandidates.push({
        kind: 'drill_hole',
        distance: hit.distance,
        object: hit.object,
        intersection: hit,
        part,
        drillHole
      });
    }
  }

  private collectApplianceCandidates(
    raycaster: THREE.Raycaster,
    sources: SceneRaycastSources,
    outCandidates: ScenePickCandidate[]
  ): void {
    const root = sources.appliancesRoot;
    if (!root || !this.isObjectChainPickable(root, null, EXCLUDED_USER_DATA_FLAGS)) {
      return;
    }

    const meshes = this.collectSolidMeshes([root], true, null, false);
    const hitRootGroups = new Set<THREE.Object3D>();
    const hitApplianceIds = new Set<string>();

    if (meshes.length > 0) {
      const hits = this.intersectSortedValidMeshes(raycaster, meshes, false);

      for (const hit of hits) {
        const resolved = this.resolveApplianceHit(hit.object, root, sources);
        if (resolved === null) {
          continue;
        }
        if (resolved.appliance?.isHidden) {
          continue;
        }

        const directGroup = this.findDirectChildUnderRoot(hit.object, root);
        if (directGroup) {
          hitRootGroups.add(directGroup);
        }
        if (resolved.rootGroup) {
          hitRootGroups.add(resolved.rootGroup);
        }
        if (resolved.appliance?.id) {
          hitApplianceIds.add(resolved.appliance.id);
        }

        outCandidates.push({
          kind: 'appliance',
          distance: hit.distance,
          object: hit.object,
          intersection: hit,
          appliance: resolved.appliance
        });
      }
    }

    if (!sources.enableApplianceBoxFallback) {
      return;
    }

    const hitPoint = new THREE.Vector3();
    for (const child of root.children) {
      if (hitRootGroups.has(child)) {
        continue;
      }
      if (!this.isObjectChainPickable(child, root, EXCLUDED_USER_DATA_FLAGS)) {
        continue;
      }

      const resolved = this.resolveApplianceHit(child, root, sources);
      if (resolved === null) {
        continue;
      }
      if (resolved.appliance?.isHidden) {
        continue;
      }
      if (resolved.appliance?.id && hitApplianceIds.has(resolved.appliance.id)) {
        continue;
      }

      const box = this.computeSolidApplianceBox3(child, root, resolved.appliance);
      if (box.isEmpty() || box.containsPoint(raycaster.ray.origin)) {
        continue;
      }

      if (!raycaster.ray.intersectBox(box, hitPoint)) {
        continue;
      }

      const distance = raycaster.ray.origin.distanceTo(hitPoint);
      if (distance < raycaster.near || distance > raycaster.far) {
        continue;
      }

      const intersection: THREE.Intersection = {
        distance,
        point: hitPoint.clone(),
        object: child
      };

      outCandidates.push({
        kind: 'appliance',
        distance,
        object: child,
        intersection,
        appliance: resolved.appliance
      });
    }
  }

  private collectWallCandidates(
    raycaster: THREE.Raycaster,
    sources: SceneRaycastSources,
    outCandidates: ScenePickCandidate[]
  ): void {
    const wallsRoot = sources.wallsRoot;
    if (!wallsRoot || !this.isObjectChainPickable(wallsRoot, null, EXCLUDED_USER_DATA_FLAGS)) {
      return;
    }

    const meshes = this.collectSolidMeshes([wallsRoot], true, null, false);
    if (meshes.length === 0) {
      return;
    }

    const hasTaggedWalls =
      this.subtreeHasUserDataFlag(wallsRoot, 'isWall') ||
      this.subtreeHasUserDataFlag(wallsRoot, 'wallId') ||
      this.subtreeHasUserDataFlag(wallsRoot, 'wallType');

    const hits = this.intersectSortedValidMeshes(raycaster, meshes, false);

    for (const hit of hits) {
      if (this.hasAncestorUserDataFlag(hit.object, 'isFloor', wallsRoot)) {
        continue;
      }

      let wallId: string | undefined;
      if (sources.resolveWallIdFromObject) {
        const resolved = sources.resolveWallIdFromObject(hit.object);
        if (!resolved) {
          continue;
        }
        wallId = resolved;
      } else {
        wallId =
          this.readStringUserData(hit.object, 'wallId', wallsRoot) ??
          this.readStringUserData(hit.object, 'wallType', wallsRoot);
        const isTaggedWall = this.hasAncestorUserDataFlag(hit.object, 'isWall', wallsRoot);
        if (hasTaggedWalls && !wallId && !isTaggedWall) {
          continue;
        }
      }

      outCandidates.push({
        kind: 'wall',
        distance: hit.distance,
        object: hit.object,
        intersection: hit,
        wallId
      });
    }
  }

  private collectReferenceGuideCandidates(
    raycaster: THREE.Raycaster,
    sources: SceneRaycastSources,
    outCandidates: ScenePickCandidate[]
  ): void {
    const guideRoot = sources.referenceGuideRoot;
    if (!guideRoot || !this.isObjectChainPickable(guideRoot, null, EXCLUDED_USER_DATA_FLAGS)) {
      return;
    }

    const meshes = this.collectSolidMeshes([guideRoot], true, null, false);
    if (meshes.length === 0) {
      return;
    }

    const hasGuideTags = this.subtreeHasUserDataFlag(guideRoot, 'isReferenceGuide');
    const hits = this.intersectSortedValidMeshes(raycaster, meshes, false);

    for (const hit of hits) {
      if (hasGuideTags && !this.hasAncestorUserDataFlag(hit.object, 'isReferenceGuide', guideRoot)) {
        continue;
      }

      outCandidates.push({
        kind: 'reference_guide',
        distance: hit.distance,
        object: hit.object,
        intersection: hit
      });
    }
  }

  private resolvePartHit(
    obj: THREE.Object3D,
    sources: SceneRaycastSources,
    boundaryRoot?: THREE.Object3D | null
  ): ResolvedPartDetails | null {
    const ancestorMeta = this.readPartMetaFromAncestors(obj, boundaryRoot);

    if (sources.resolvePartFromObject) {
      const custom = sources.resolvePartFromObject(obj);
      if (!custom) {
        return null;
      }
      if (this.isScenePieceHitMeta(custom)) {
        const drillHole =
          custom.drillHole ??
          ancestorMeta.drillHole ??
          this.resolveDrillHole(obj, sources, boundaryRoot);
        return {
          part: custom.part,
          parentPartId: ancestorMeta.parentPartId,
          isHandle: custom.isHandle ?? ancestorMeta.isHandle,
          isDrillHole: custom.isDrillHole ?? ancestorMeta.isDrillHole,
          drillHole
        };
      }
      return {
        part: custom,
        parentPartId: ancestorMeta.parentPartId,
        isHandle: ancestorMeta.isHandle,
        isDrillHole: ancestorMeta.isDrillHole,
        drillHole: ancestorMeta.drillHole ?? this.resolveDrillHole(obj, sources, boundaryRoot)
      };
    }

    return {
      ...ancestorMeta,
      drillHole: ancestorMeta.drillHole ?? this.resolveDrillHole(obj, sources, boundaryRoot)
    };
  }

  private readPartMetaFromAncestors(
    obj: THREE.Object3D,
    boundaryRoot?: THREE.Object3D | null
  ): ResolvedPartDetails {
    let curr: THREE.Object3D | null = obj;
    let isHandle = false;
    let isDrillHole = false;
    let part: Part | undefined;
    let parentPartId: string | undefined;
    let drillHole: DrillHole | undefined;

    while (curr) {
      const data = curr.userData as Record<string, unknown> | undefined;
      if (data) {
        if (data['isHandle']) {
          isHandle = true;
        }
        if (data['isDrillHole']) {
          isDrillHole = true;
        }
        if (!parentPartId && typeof data['parentPartId'] === 'string' && data['parentPartId'].length > 0) {
          parentPartId = data['parentPartId'];
        }
        if (!drillHole && this.isDrillHoleLike(data['drillHole'])) {
          drillHole = data['drillHole'];
        }
        if (!part && this.isPartLike(data['part'])) {
          part = data['part'];
          break;
        }
      }
      if (boundaryRoot && curr === boundaryRoot) {
        break;
      }
      curr = curr.parent;
    }

    return { part, parentPartId, isHandle, isDrillHole, drillHole };
  }

  private resolveDrillHole(
    obj: THREE.Object3D,
    sources: SceneRaycastSources,
    boundaryRoot?: THREE.Object3D | null
  ): DrillHole | undefined {
    if (sources.resolveDrillHoleFromObject) {
      return sources.resolveDrillHoleFromObject(obj) ?? undefined;
    }

    let curr: THREE.Object3D | null = obj;
    while (curr) {
      const data = curr.userData as Record<string, unknown> | undefined;
      if (data && this.isDrillHoleLike(data['drillHole'])) {
        return data['drillHole'];
      }
      if (boundaryRoot && curr === boundaryRoot) {
        break;
      }
      curr = curr.parent;
    }
    return undefined;
  }

  private resolveApplianceHit(
    obj: THREE.Object3D,
    root: THREE.Object3D,
    sources: SceneRaycastSources
  ): { appliance?: ApplianceItem; rootGroup?: THREE.Object3D | null } | null {
    if (sources.resolveApplianceFromObject) {
      const custom = sources.resolveApplianceFromObject(obj);
      if (!custom) {
        return null;
      }
      if (this.isSceneApplianceHitMeta(custom)) {
        return { appliance: custom.app, rootGroup: custom.rootGroup };
      }
      return { appliance: custom };
    }

    let curr: THREE.Object3D | null = obj;
    let foundApp: ApplianceItem | undefined;
    let foundRoot: THREE.Object3D | null = null;

    while (curr && curr !== root.parent) {
      const data = curr.userData as Record<string, unknown> | undefined;
      if (data && !foundApp && this.isApplianceLike(data['appliance'])) {
        foundApp = data['appliance'];
      }
      if (curr.parent === root) {
        foundRoot = curr;
        if (foundApp) {
          break;
        }
      }
      if (curr === root) {
        break;
      }
      curr = curr.parent;
    }

    return { appliance: foundApp, rootGroup: foundRoot };
  }

  private computeSolidApplianceBox3(
    applianceGroup: THREE.Object3D,
    boundaryRoot: THREE.Object3D,
    appliance?: ApplianceItem
  ): THREE.Box3 {
    const groupBox = new THREE.Box3();
    const tempBox = new THREE.Box3();
    const solidMeshes = this.collectSolidMeshes([applianceGroup], true, boundaryRoot, false);

    for (const mesh of solidMeshes) {
      if (!mesh.geometry.boundingBox) {
        mesh.geometry.computeBoundingBox();
      }
      if (mesh.geometry.boundingBox) {
        tempBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
        groupBox.union(tempBox);
      }
    }

    if (
      groupBox.isEmpty() &&
      appliance &&
      appliance.width > 0 &&
      appliance.height > 0 &&
      appliance.depth > 0 &&
      !this.hasExcludedHitBoxDescendant(applianceGroup)
    ) {
      tempBox.set(
        new THREE.Vector3(-appliance.width / 2, 0, -appliance.depth / 2),
        new THREE.Vector3(appliance.width / 2, appliance.height, appliance.depth / 2)
      );
      tempBox.applyMatrix4(applianceGroup.matrixWorld);
      groupBox.copy(tempBox);
    }

    return groupBox;
  }

  private hasExcludedHitBoxDescendant(root: THREE.Object3D): boolean {
    let found = false;
    root.traverse((child) => {
      if (found) {
        return;
      }
      const data = child.userData as Record<string, unknown> | undefined;
      if (child.name === 'raycast_hitbox' || Boolean(data?.['isApplianceHitBox'])) {
        found = true;
      }
    });
    return found;
  }

  private isPartHidden(
    part: Part | undefined,
    parentPartId: string | undefined,
    hiddenPartIds?: ReadonlySet<string>
  ): boolean {
    if (!hiddenPartIds || hiddenPartIds.size === 0) {
      return false;
    }
    if (part && hiddenPartIds.has(part.id)) {
      return true;
    }
    if (parentPartId && hiddenPartIds.has(parentPartId)) {
      return true;
    }
    return false;
  }

  private collectSolidMeshes(
    roots: readonly THREE.Object3D[],
    recursive: boolean,
    boundaryRoot: THREE.Object3D | null | undefined,
    allowTransparentZero: boolean,
    seenMeshes = new Set<THREE.Object3D>()
  ): THREE.Mesh[] {
    const result: THREE.Mesh[] = [];
    const flags = allowTransparentZero ? PRIORITY_HANDLE_EXCLUDED_FLAGS : EXCLUDED_USER_DATA_FLAGS;

    for (const root of roots) {
      if (!recursive) {
        if (!this.isMeshInstance(root)) {
          continue;
        }
        const isPickable = allowTransparentZero
          ? this.isPriorityHandleMesh(root, boundaryRoot)
          : this.isSolidPickableMesh(root, boundaryRoot);
        if (isPickable && !seenMeshes.has(root)) {
          seenMeshes.add(root);
          result.push(root);
        }
        continue;
      }

      if (root.parent && root !== boundaryRoot) {
        if (!this.isObjectChainPickable(root.parent, boundaryRoot, flags)) {
          continue;
        }
      }

      const stack: THREE.Object3D[] = [root];
      while (stack.length > 0) {
        const curr = stack.pop();
        if (!curr || !curr.visible || this.isExcludedNode(curr, flags)) {
          continue;
        }

        if (
          this.isMeshInstance(curr) &&
          curr.geometry &&
          this.hasValidMeshMaterial(curr, allowTransparentZero) &&
          !seenMeshes.has(curr)
        ) {
          seenMeshes.add(curr);
          result.push(curr);
        }

        for (let i = curr.children.length - 1; i >= 0; i--) {
          stack.push(curr.children[i]);
        }
      }
    }

    return result;
  }

  private refreshMatricesForRoots(
    roots: readonly THREE.Object3D[],
    allowTransparentZero: boolean,
    boundaryRoot?: THREE.Object3D | null
  ): void {
    const updated = new Set<THREE.Object3D>();
    for (const root of roots) {
      if (updated.has(root)) {
        continue;
      }
      updated.add(root);
      this.updateAncestorWorldMatrices(root);
      root.updateMatrixWorld(true);
      root.traverse((child) => {
        if (!this.isMeshInstance(child)) {
          return;
        }
        const valid = allowTransparentZero
          ? this.isPriorityHandleMesh(child, boundaryRoot ?? root)
          : this.isSolidPickableMesh(child, boundaryRoot ?? root);
        if (!valid) {
          return;
        }
        if (!child.geometry.boundingBox) {
          child.geometry.computeBoundingBox();
        }
        if (!child.geometry.boundingSphere) {
          child.geometry.computeBoundingSphere();
        }
      });
    }
  }

  private updateAncestorWorldMatrices(obj: THREE.Object3D): void {
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

  private isObjectChainPickable(
    obj: THREE.Object3D,
    boundaryRoot: THREE.Object3D | null | undefined,
    flags: readonly string[]
  ): boolean {
    let curr: THREE.Object3D | null = obj;
    while (curr) {
      if (!curr.visible) {
        return false;
      }
      if (this.isExcludedNode(curr, flags)) {
        return false;
      }
      if (boundaryRoot && curr === boundaryRoot) {
        break;
      }
      curr = curr.parent;
    }
    return true;
  }

  private isExcludedNode(obj: THREE.Object3D, flags: readonly string[]): boolean {
    if (
      obj instanceof THREE.BoxHelper ||
      obj instanceof THREE.Box3Helper ||
      obj instanceof THREE.GridHelper ||
      obj instanceof THREE.AxesHelper
    ) {
      return true;
    }
    if (obj.name === 'raycast_hitbox') {
      return true;
    }
    const data = obj.userData as Record<string, unknown> | undefined;
    if (!data) {
      return false;
    }
    for (const flag of flags) {
      if (data[flag]) {
        return true;
      }
    }
    return false;
  }

  private isMeshInstance(obj: THREE.Object3D): obj is THREE.Mesh {
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

  private isMaterialWireframe(mat: THREE.Material): boolean {
    return (
      'wireframe' in mat &&
      (mat as THREE.Material & MaterialWithWireframe).wireframe === true
    );
  }

  private isSolidMaterial(
    mat: THREE.Material | null | undefined,
    allowTransparentZero: boolean
  ): boolean {
    if (!mat || !mat.visible || this.isMaterialWireframe(mat)) {
      return false;
    }
    if (mat instanceof THREE.ShadowMaterial) {
      return false;
    }
    if (!allowTransparentZero && mat.transparent && mat.opacity <= 0.001) {
      return false;
    }
    return true;
  }

  private hasValidMeshMaterial(mesh: THREE.Mesh, allowTransparentZero: boolean): boolean {
    const mat = mesh.material;
    if (!mat) {
      return false;
    }
    if (Array.isArray(mat)) {
      return mat.length > 0 && mat.some((entry) => this.isSolidMaterial(entry, allowTransparentZero));
    }
    return this.isSolidMaterial(mat, allowTransparentZero);
  }

  private intersectSortedValidMeshes(
    raycaster: THREE.Raycaster,
    meshes: readonly THREE.Object3D[],
    allowTransparentZero: boolean
  ): THREE.Intersection[] {
    if (meshes.length === 0) {
      return [];
    }

    const sortedValidHits = raycaster
      .intersectObjects([...meshes], false)
      .filter((hit) => this.isHitFaceMaterialValid(hit, allowTransparentZero))
      .sort((a, b) => a.distance - b.distance);

    // Three.js puede emitir múltiples intersecciones para un mismo THREE.Mesh (por ej., arista compartida
    // entre los dos triángulos de una cara BoxGeometry o caras frontal/trasera). Conservamos la más cercana por objeto.
    const seenObjects = new Set<THREE.Object3D>();
    const deduplicated: THREE.Intersection[] = [];
    for (const hit of sortedValidHits) {
      if (seenObjects.has(hit.object)) {
        continue;
      }
      seenObjects.add(hit.object);
      deduplicated.push(hit);
    }

    return deduplicated;
  }

  private isHitFaceMaterialValid(
    hit: THREE.Intersection,
    allowTransparentZero: boolean
  ): boolean {
    if (!(hit.object instanceof THREE.Mesh)) {
      return false;
    }
    const mat = hit.object.material;
    if (!Array.isArray(mat)) {
      return this.isSolidMaterial(mat, allowTransparentZero);
    }
    const matIdx = hit.face?.materialIndex;
    if (typeof matIdx === 'number' && matIdx >= 0 && matIdx < mat.length) {
      return this.isSolidMaterial(mat[matIdx], allowTransparentZero);
    }
    return mat.some((entry) => this.isSolidMaterial(entry, allowTransparentZero));
  }

  private normalizeObjectList(
    input: THREE.Object3D | readonly (THREE.Object3D | null | undefined)[] | null | undefined
  ): THREE.Object3D[] {
    if (!input) {
      return [];
    }
    if (Array.isArray(input)) {
      const list: THREE.Object3D[] = [];
      for (const item of input) {
        if (item) {
          list.push(item);
        }
      }
      return list;
    }
    return [input as THREE.Object3D];
  }

  private findDirectChildUnderRoot(
    obj: THREE.Object3D,
    root: THREE.Object3D
  ): THREE.Object3D | null {
    let curr: THREE.Object3D | null = obj;
    while (curr && curr.parent !== root) {
      curr = curr.parent;
    }
    return curr && curr.parent === root ? curr : null;
  }

  private subtreeHasUserDataFlag(root: THREE.Object3D, key: string): boolean {
    let found = false;
    root.traverse((child) => {
      if (found) {
        return;
      }
      const data = child.userData as Record<string, unknown> | undefined;
      if (data && Boolean(data[key])) {
        found = true;
      }
    });
    return found;
  }

  private hasAncestorUserDataFlag(
    obj: THREE.Object3D,
    key: string,
    boundaryRoot?: THREE.Object3D | null
  ): boolean {
    let curr: THREE.Object3D | null = obj;
    while (curr) {
      const data = curr.userData as Record<string, unknown> | undefined;
      if (data && Boolean(data[key])) {
        return true;
      }
      if (boundaryRoot && curr === boundaryRoot) {
        break;
      }
      curr = curr.parent;
    }
    return false;
  }

  private readStringUserData(
    obj: THREE.Object3D,
    key: string,
    boundaryRoot?: THREE.Object3D | null
  ): string | undefined {
    let curr: THREE.Object3D | null = obj;
    while (curr) {
      const data = curr.userData as Record<string, unknown> | undefined;
      const val = data?.[key];
      if (typeof val === 'string' && val.length > 0) {
        return val;
      }
      if (boundaryRoot && curr === boundaryRoot) {
        break;
      }
      curr = curr.parent;
    }
    return undefined;
  }

  private isScenePieceHitMeta(
    value: Part | ScenePieceHitMeta
  ): value is ScenePieceHitMeta {
    return typeof value === 'object' && value !== null && 'part' in value;
  }

  private isSceneApplianceHitMeta(
    value: ApplianceItem | SceneApplianceHitMeta
  ): value is SceneApplianceHitMeta {
    return typeof value === 'object' && value !== null && 'app' in value;
  }

  private isPartLike(value: unknown): value is Part {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { id?: unknown }).id === 'string' &&
      typeof (value as { name?: unknown }).name === 'string'
    );
  }

  private isApplianceLike(value: unknown): value is ApplianceItem {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { id?: unknown }).id === 'string' &&
      typeof (value as { type?: unknown }).type === 'string'
    );
  }

  private isDrillHoleLike(value: unknown): value is DrillHole {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { id?: unknown }).id === 'string' &&
      typeof (value as { partId?: unknown }).partId === 'string'
    );
  }
}
