import { inject, Injectable } from '@angular/core';
import {
  Part,
  DrillHole,
  CollisionRecord,
  CollisionFixOption,
  CollisionResolutionPlan
} from '../models/melamine.models';
import { PartGeometryService } from './part-geometry.service';

type Axis3D = 'x' | 'y' | 'z';
type FixReasonKind = 'top_support' | 'align_side' | 'general';

interface AxisCandidate {
  axis: Axis3D;
  direction: 1 | -1;
  deltaMm: number;
  absDeltaMm: number;
  overlap: number;
}

export interface Part3DBounds {
  part: Part;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  sx: number;
  sy: number;
  sz: number;
  px: number;
  py: number;
  pz: number;
}

export interface JoineryAnalysis {
  drillHolesByPart: Map<string, DrillHole[]>;
  allDrillHoles: DrillHole[];
  collisions: CollisionRecord[];
}

@Injectable({
  providedIn: 'root'
})
export class JoineryEngineService {
  private readonly partGeometry = inject(PartGeometryService);

  // Caché en memoria WeakMap para evitar recalcular trigonometría Euler y AABB en piezas inmutadas
  private readonly boundsCache = new WeakMap<Part, { sig: string; bounds: Part3DBounds }>();

  // Caché reactiva de firma geométrica para retornar instantáneamente O(1) cuando solo cambian colores, cantos o capas
  private lastJoinerySignature = '';
  private lastJoineryResult: JoineryAnalysis | null = null;

  /**
   * Calcula las dimensiones locales (sx, sy, sz) antes de aplicar rotaciones Euler (rotationX/Y/Z).
   * Delega directamente en PartGeometryService como fuente única de verdad.
   */
  getPartLocalDimensions(part: Part): { sx: number; sy: number; sz: number } {
    const localDims = this.partGeometry.getLocalDimensions(part);
    return { sx: localDims.sx, sy: localDims.sy, sz: localDims.sz };
  }

  /**
   * Calcula la caja envolvente 3D exacta (sx, sy, sz y límites min/max) de una pieza en el espacio mundial,
   * incluyendo cualquier rotación personalizada (rotationX, rotationY, rotationZ).
   */
  getPartBounds(part: Part): Part3DBounds {
    const geomSig = `${part.length}|${part.width}|${part.thickness ?? 15}|${part.posX ?? 0}|${part.posY ?? ''}|${part.posZ ?? 0}|${part.orientation || 'h'}|${part.rotationX || 0}|${part.rotationY || 0}|${part.rotationZ || 0}|${part.componentRole || ''}|${part.shapeType || ''}|${part.radius || 0}|${part.diameter || 0}|${part.name}`;
    const cached = this.boundsCache.get(part);
    if (cached && cached.sig === geomSig) {
      return cached.bounds;
    }

    const aabb = this.partGeometry.getWorldAABB(part);
    const bounds: Part3DBounds = {
      part,
      minX: aabb.minX,
      maxX: aabb.maxX,
      minY: aabb.minY,
      maxY: aabb.maxY,
      minZ: aabb.minZ,
      maxZ: aabb.maxZ,
      sx: Math.round(aabb.sx * 100) / 100,
      sy: Math.round(aabb.sy * 100) / 100,
      sz: Math.round(aabb.sz * 100) / 100,
      px: aabb.px,
      py: aabb.py,
      pz: aabb.pz
    };
    this.boundsCache.set(part, { sig: geomSig, bounds });
    return bounds;
  }

  /**
   * Determina hacia qué dirección cardinal ('front' | 'right' | 'back' | 'left')
   * mira una puerta o frente de cajón respecto al centro geométrico de su módulo o grupo.
   */
  getPartFacingDirection(part: Part, allParts: Part[]): 'front' | 'right' | 'back' | 'left' {
    let contextParts: Part[] = [];
    if (part.groupId) {
      contextParts = allParts.filter(p => p.groupId === part.groupId);
    } else if (part.moduleId) {
      contextParts = allParts.filter(p => p.moduleId === part.moduleId);
    }
    if (contextParts.length <= 1) {
      contextParts = allParts.length > 1 ? allParts : [part];
    }

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const p of contextParts) {
      const b = this.getPartBounds(p);
      if (b.minX < minX) minX = b.minX;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.minZ < minZ) minZ = b.minZ;
      if (b.maxZ > maxZ) maxZ = b.maxZ;
    }

    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const dx = (part.posX ?? 0) - cx;
    const dz = (part.posZ ?? 0) - cz;

    const bPart = this.getPartBounds(part);
    if (bPart.sx <= 36 && bPart.sz > bPart.sx) {
      return dx >= 0 ? 'right' : 'left';
    }
    if (bPart.sz <= 36 && bPart.sx > bPart.sz) {
      return dz >= 0 ? 'front' : 'back';
    }

    if (part.orientation === 'vertical_yz') {
      return dx >= 0 ? 'right' : 'left';
    }
    return dz >= 0 ? 'front' : 'back';
  }

  // --- COLLISION DETECTION ENGINE (Sweep-and-Prune Broadphase + OBB & 2D Polygon SAT Narrowphase) ---
  detectCollisions(parts: Part[]): CollisionRecord[] {
    if (!parts || parts.length < 2) return [];
    const boundsList = parts.map(p => this.getPartBounds(p));
    return this.detectCollisionsFromBounds(boundsList);
  }

  private detectCollisionsFromBounds(boundsList: Part3DBounds[]): CollisionRecord[] {
    const collisions: CollisionRecord[] = [];
    if (boundsList.length < 2) return collisions;

    const tolerance = 1.5; // mm tolerance to ignore flush assembly contacts and kerf tolerances
    // Ordenar copias de referencias por minX para poda espacial Sweep-and-Prune O(N log N)
    const sorted = [...boundsList].sort((a, b) => a.minX - b.minX);

    for (let i = 0; i < sorted.length; i++) {
      const b1 = sorted[i];
      const maxXLimit = b1.maxX - tolerance;

      for (let j = i + 1; j < sorted.length; j++) {
        const b2 = sorted[j];
        // Poda espacial temprana en eje X: ninguna pieza siguiente puede solaparse con b1
        if (b2.minX >= maxXLimit) {
          break;
        }

        // Filtro rápido AABB en ejes Y y Z antes de evaluar cadenas de texto o roles
        if (b2.minY >= b1.maxY - tolerance || b1.minY >= b2.maxY - tolerance) continue;
        if (b2.minZ >= b1.maxZ - tolerance || b1.minZ >= b2.maxZ - tolerance) continue;

        const overlapX = Math.min(b1.maxX, b2.maxX) - Math.max(b1.minX, b2.minX);
        const overlapY = Math.min(b1.maxY, b2.maxY) - Math.max(b1.minY, b2.minY);
        const overlapZ = Math.min(b1.maxZ, b2.maxZ) - Math.max(b1.minZ, b2.minZ);

        if (overlapX > tolerance && overlapY > tolerance && overlapZ > tolerance) {
          const isCtA =
            b1.part.componentRole === 'countertop' ||
            b1.part.componentRole === 'backsplash' ||
            b1.part.name.toUpperCase().includes('MESÓN') ||
            b1.part.name.toUpperCase().includes('MESON') ||
            b1.part.name.toUpperCase().includes('SALPICADERO');

          const isCtB =
            b2.part.componentRole === 'countertop' ||
            b2.part.componentRole === 'backsplash' ||
            b2.part.name.toUpperCase().includes('MESÓN') ||
            b2.part.name.toUpperCase().includes('MESON') ||
            b2.part.name.toUpperCase().includes('SALPICADERO');

          const sameGroup = !!(b1.part.groupId && b1.part.groupId === b2.part.groupId);

          // Excluir piezas de mesón y salpicaderos de cualquier cálculo o reporte de colisión
          if ((isCtA && isCtB) || ((isCtA || isCtB) && sameGroup)) {
            continue;
          }

          const isBackJoint =
            (b1.part.componentRole === 'back' &&
              b2.part.componentRole &&
              ['side_left', 'side_right', 'top', 'bottom', 'shelf', 'tie'].includes(b2.part.componentRole)) ||
            (b2.part.componentRole === 'back' &&
              b1.part.componentRole &&
              ['side_left', 'side_right', 'top', 'bottom', 'shelf', 'tie'].includes(b1.part.componentRole));
          if (isBackJoint && (sameGroup || !b1.part.groupId || !b2.part.groupId) && (overlapX <= 12 || overlapY <= 12 || overlapZ <= 12)) {
            continue;
          }

          // Excluir bloques 3D de correderas telescópicas (13 mm por lado) en contacto con laterales o cajón
          const nameA = b1.part.name.toUpperCase();
          const nameB = b2.part.name.toUpperCase();
          const isSlideA =
            nameA.includes('CORREDERA') ||
            nameA.includes('SLIDE') ||
            nameA.includes('RIEL TELESC');
          const isSlideB =
            nameB.includes('CORREDERA') ||
            nameB.includes('SLIDE') ||
            nameB.includes('RIEL TELESC');
          if (isSlideA || isSlideB) {
            continue;
          }

          // Ranura de fondo de cajón MDF (encastre ranurado estándar de 4-8 mm)
          const isDrawerBottomJoint =
            ((b1.part.componentRole === 'drawer_box' && (b1.part.thickness || 0) <= 6) && b2.part.componentRole === 'drawer_box') ||
            ((b2.part.componentRole === 'drawer_box' && (b2.part.thickness || 0) <= 6) && b1.part.componentRole === 'drawer_box');
          if (isDrawerBottomJoint && (overlapX <= 12 || overlapZ <= 12) && overlapY <= 8) {
            continue;
          }

          // Contacto al ras de frentes y cajas de cajón (overlay / inset) dentro de su vano
          const isDrawerPartA =
            b1.part.componentRole === 'drawer_front' ||
            b1.part.componentRole === 'drawer_box' ||
            b1.part.componentRole === 'drawer_bottom' ||
            b1.part.componentRole === 'drawer_lateral';
          const isDrawerPartB =
            b2.part.componentRole === 'drawer_front' ||
            b2.part.componentRole === 'drawer_box' ||
            b2.part.componentRole === 'drawer_bottom' ||
            b2.part.componentRole === 'drawer_lateral';
          if ((isDrawerPartA || isDrawerPartB) && Math.min(overlapX, overlapY, overlapZ) <= 1.5) {
            continue;
          }

          // Fase estrecha OBB SAT 3D + Polígonos 2D (elimina falsos positivos en piezas rotadas a 45° o con chaflán/destaje)
          const obbCheck = this.partGeometry.arePartsCollidingOBB(b1.part, b2.part, tolerance);
          if (!obbCheck.colliding) {
            continue;
          }

          collisions.push({
            partAId: b1.part.id,
            partAName: b1.part.name,
            partBId: b2.part.id,
            partBName: b2.part.name,
            overlapX: Math.round(overlapX * 10) / 10,
            overlapY: Math.round(overlapY * 10) / 10,
            overlapZ: Math.round(overlapZ * 10) / 10,
            overlapVolumeMm3: obbCheck.overlapVolume
          });
        }
      }
    }

    return collisions;
  }

  // --- COLLISION AUTO-SOLVER ENGINE (MTV + CARPENTRY HEURISTICS) ---

  /**
   * Calcula un plan de resolución accionable en 1 clic (opción principal y alternativa)
   * para cada colisión detectada usando MTV (Minimum Translation Vector) y reglas de carpintería.
   */
  buildCollisionResolutionPlans(
    parts: Part[],
    collisions?: CollisionRecord[]
  ): CollisionResolutionPlan[] {
    if (!parts || parts.length === 0) {
      return [];
    }

    const activeCollisions = collisions ?? this.detectCollisions(parts);
    if (activeCollisions.length === 0) {
      return [];
    }

    const partById = new Map<string, Part>();
    const indexById = new Map<string, number>();
    const boundsById = new Map<string, Part3DBounds>();

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      partById.set(p.id, p);
      indexById.set(p.id, i);
      boundsById.set(p.id, this.getPartBounds(p));
    }

    const degreeById = new Map<string, number>();
    const collisionsByPartId = new Map<string, CollisionRecord[]>();
    for (const col of activeCollisions) {
      degreeById.set(col.partAId, (degreeById.get(col.partAId) ?? 0) + 1);
      degreeById.set(col.partBId, (degreeById.get(col.partBId) ?? 0) + 1);

      const listA = collisionsByPartId.get(col.partAId) ?? [];
      listA.push(col);
      collisionsByPartId.set(col.partAId, listA);

      const listB = collisionsByPartId.get(col.partBId) ?? [];
      listB.push(col);
      collisionsByPartId.set(col.partBId, listB);
    }

    return activeCollisions.map(collision =>
      this.resolvePairPlan(
        collision,
        partById,
        indexById,
        boundsById,
        degreeById,
        collisionsByPartId
      )
    );
  }

  /**
   * Calcula las coordenadas actualizadas (`posX` / `posY` / `posZ`) para aplicar un `CollisionFixOption`
   * garantizando la restricción de piso (`minY >= 0`) y sin mutar la pieza original.
   */
  computePartUpdateForFix(part: Part, fix: CollisionFixOption): Partial<Part> | null {
    if (!part || part.isLocked) {
      return null;
    }

    const bounds = this.getPartBounds(part);
    const round2 = (v: number): number => Math.round(v * 100) / 100;

    if (fix.axis === 'x') {
      const baseX = part.posX ?? bounds.px;
      return { posX: round2(baseX + fix.deltaMm) };
    }

    if (fix.axis === 'z') {
      const baseZ = part.posZ ?? bounds.pz;
      return { posZ: round2(baseZ + fix.deltaMm) };
    }

    const baseY = part.posY ?? bounds.py;
    const minValidPosY = bounds.sy / 2;
    const rawPosY = Math.max(minValidPosY, baseY + fix.deltaMm);
    let roundedPosY = round2(rawPosY);
    if (roundedPosY < minValidPosY) {
      roundedPosY = Math.ceil(minValidPosY * 100) / 100;
    }
    return { posY: roundedPosY };
  }

  /**
   * Resuelve iterativamente las colisiones corregibles de la escena recomputando `detectCollisions`
   * en cada paso y previniendo ciclos de oscilación mediante firmas de coordenadas visitadas.
   */
  resolveAllCollisionsIteratively(parts: Part[]): {
    updatedParts: Part[];
    updates: { partId: string; updates: Partial<Part> }[];
    resolvedCount: number;
    stepsApplied: number;
    remainingCollisions: CollisionRecord[];
  } {
    if (!parts || parts.length < 2) {
      return {
        updatedParts: parts ? parts.map(p => ({ ...p })) : [],
        updates: [],
        resolvedCount: 0,
        stepsApplied: 0,
        remainingCollisions: []
      };
    }

    let workingParts = parts.map(p => ({ ...p }));
    const initialCollisions = this.detectCollisions(workingParts);
    const initialCount = initialCollisions.length;

    if (initialCount === 0) {
      return {
        updatedParts: workingParts,
        updates: [],
        resolvedCount: 0,
        stepsApplied: 0,
        remainingCollisions: []
      };
    }

    const maxSteps = Math.max(24, workingParts.length * 4);
    let stepsApplied = 0;
    const visitedPartStates = new Set<string>();
    const visitedSceneStates = new Set<string>();
    visitedSceneStates.add(this.buildSceneSignature(workingParts));

    let currentCollisions = initialCollisions;

    for (let step = 0; step < maxSteps; step++) {
      if (currentCollisions.length === 0) {
        break;
      }

      const plans = this.buildCollisionResolutionPlans(workingParts, currentCollisions);
      const fixablePlans = plans.filter(pl => pl.canFix && pl.primaryFix !== null);
      if (fixablePlans.length === 0) {
        break;
      }

      const partById = new Map<string, Part>(workingParts.map(p => [p.id, p]));
      const degreeById = new Map<string, number>();
      for (const col of currentCollisions) {
        degreeById.set(col.partAId, (degreeById.get(col.partAId) ?? 0) + 1);
        degreeById.set(col.partBId, (degreeById.get(col.partBId) ?? 0) + 1);
      }

      const isTopLiftFix = (fix: CollisionFixOption): number => {
        const part = partById.get(fix.targetPartId);
        return fix.axis === 'y' &&
          fix.direction === 1 &&
          part !== undefined &&
          this.partGeometry.getEffectiveOrientation(part) === 'horizontal'
          ? 1
          : 0;
      };

      const sortedPlans = [...fixablePlans].sort((a, b) => {
        const fixA = a.primaryFix!;
        const fixB = b.primaryFix!;
        const topDiff = isTopLiftFix(fixB) - isTopLiftFix(fixA);
        if (topDiff !== 0) return topDiff;

        const degA = degreeById.get(fixA.targetPartId) ?? 1;
        const degB = degreeById.get(fixB.targetPartId) ?? 1;
        if (degA !== degB) return degB - degA;

        return fixA.absDeltaMm - fixB.absDeltaMm;
      });

      const appliedStep = this.tryApplyBestIterativeStep(
        workingParts,
        sortedPlans,
        currentCollisions.length,
        partById,
        visitedPartStates,
        visitedSceneStates
      );

      if (!appliedStep) {
        break;
      }

      workingParts = appliedStep.nextParts;
      currentCollisions = appliedStep.nextCollisions;
      stepsApplied++;
    }

    const updates: { partId: string; updates: Partial<Part> }[] = [];
    for (let i = 0; i < parts.length; i++) {
      const orig = parts[i];
      const curr = workingParts[i];
      const deltaObj: Partial<Part> = {};
      if (curr.posX !== orig.posX) deltaObj.posX = curr.posX;
      if (curr.posY !== orig.posY) deltaObj.posY = curr.posY;
      if (curr.posZ !== orig.posZ) deltaObj.posZ = curr.posZ;
      if (Object.keys(deltaObj).length > 0) {
        updates.push({ partId: orig.id, updates: deltaObj });
      }
    }

    return {
      updatedParts: workingParts,
      updates,
      resolvedCount: Math.max(0, initialCount - currentCollisions.length),
      stepsApplied,
      remainingCollisions: currentCollisions
    };
  }

  private resolvePairPlan(
    collision: CollisionRecord,
    partById: Map<string, Part>,
    indexById: Map<string, number>,
    boundsById: Map<string, Part3DBounds>,
    degreeById: Map<string, number>,
    collisionsByPartId: Map<string, CollisionRecord[]>
  ): CollisionResolutionPlan {
    const partA = partById.get(collision.partAId);
    const partB = partById.get(collision.partBId);
    if (!partA || !partB) {
      return {
        collision,
        focusPartId: collision.partAId,
        primaryFix: null,
        secondaryFix: null,
        canFix: false
      };
    }

    const lockedA = Boolean(partA.isLocked);
    const lockedB = Boolean(partB.isLocked);
    if (lockedA && lockedB) {
      return {
        collision,
        focusPartId: partA.id,
        primaryFix: null,
        secondaryFix: null,
        canFix: false
      };
    }

    const bA = boundsById.get(partA.id)!;
    const bB = boundsById.get(partB.id)!;
    const overlaps = this.computeAxisOverlaps(bA, bB);

    let target: Part;
    let anchor: Part;
    let targetBounds: Part3DBounds;
    let anchorBounds: Part3DBounds;
    let primaryCandidate: AxisCandidate | null = null;
    let reasonKind: FixReasonKind = 'general';

    if (lockedA !== lockedB) {
      target = lockedA ? partB : partA;
      anchor = lockedA ? partA : partB;
      targetBounds = lockedA ? bB : bA;
      anchorBounds = lockedA ? bA : bB;
      primaryCandidate = this.pickMinimumValidCandidate(targetBounds, anchorBounds, overlaps);
    } else {
      const carpentryPick = this.pickCarpentryHorizVsVertCandidate(
        partA,
        partB,
        bA,
        bB,
        overlaps
      );

      if (carpentryPick) {
        target = carpentryPick.target;
        anchor = carpentryPick.anchor;
        targetBounds = carpentryPick.targetBounds;
        anchorBounds = carpentryPick.anchorBounds;
        primaryCandidate = carpentryPick.candidate;
        reasonKind = carpentryPick.reasonKind;
      } else {
        const pairChoice = this.pickGeneralTargetAndAnchor(
          partA,
          partB,
          bA,
          bB,
          overlaps,
          indexById,
          boundsById,
          degreeById,
          collisionsByPartId
        );
        target = pairChoice.target;
        anchor = pairChoice.anchor;
        targetBounds = pairChoice.targetBounds;
        anchorBounds = pairChoice.anchorBounds;
        primaryCandidate = this.pickMinimumValidCandidate(targetBounds, anchorBounds, overlaps);
      }
    }

    if (!primaryCandidate) {
      return {
        collision,
        focusPartId: partA.id,
        primaryFix: null,
        secondaryFix: null,
        canFix: false
      };
    }

    const primaryFix = this.buildFixOption(
      primaryCandidate,
      target,
      anchor,
      false,
      reasonKind
    );

    const secondaryCandidates: AxisCandidate[] = [];
    for (const axis of ['x', 'y', 'z'] as const) {
      if (axis === primaryCandidate.axis) continue;
      const axisOverlap = overlaps[axis];
      if (axisOverlap > 25) continue;
      const cand = this.createAxisCandidate(targetBounds, anchorBounds, axis, axisOverlap);
      if (cand && cand.absDeltaMm <= 50) {
        secondaryCandidates.push(cand);
      }
    }

    secondaryCandidates.sort(
      (a, b) => a.overlap - b.overlap || a.absDeltaMm - b.absDeltaMm
    );

    const secondaryFix =
      secondaryCandidates.length > 0
        ? this.buildFixOption(secondaryCandidates[0], target, anchor, true, 'general')
        : null;

    return {
      collision,
      focusPartId: primaryFix.targetPartId,
      primaryFix,
      secondaryFix,
      canFix: true
    };
  }

  private pickCarpentryHorizVsVertCandidate(
    partA: Part,
    partB: Part,
    bA: Part3DBounds,
    bB: Part3DBounds,
    overlaps: Record<Axis3D, number>
  ): {
    target: Part;
    anchor: Part;
    targetBounds: Part3DBounds;
    anchorBounds: Part3DBounds;
    candidate: AxisCandidate;
    reasonKind: FixReasonKind;
  } | null {
    const effA = this.partGeometry.getEffectiveOrientation(partA);
    const effB = this.partGeometry.getEffectiveOrientation(partB);
    const isHorizA = effA === 'horizontal';
    const isHorizB = effB === 'horizontal';
    if (isHorizA === isHorizB) {
      return null;
    }

    const pH = isHorizA ? partA : partB;
    const bH = isHorizA ? bA : bB;
    const pV = isHorizA ? partB : partA;
    const bV = isHorizA ? bB : bA;
    const effV = isHorizA ? effB : effA;

    const isNearTop =
      overlaps.y <= 30 && bH.maxY >= bV.maxY - 35 && bH.py >= bV.py;
    if (isNearTop) {
      const cand = this.createAxisCandidate(bH, bV, 'y', overlaps.y, 1);
      if (cand) {
        return {
          target: pH,
          anchor: pV,
          targetBounds: bH,
          anchorBounds: bV,
          candidate: cand,
          reasonKind: 'top_support'
        };
      }
    }

    const isIntermediate =
      bH.maxY < bV.maxY - 35 && bH.minY > bV.minY + 35;
    if (isIntermediate) {
      const candX = this.createAxisCandidate(bH, bV, 'x', overlaps.x);
      const candZ = this.createAxisCandidate(bH, bV, 'z', overlaps.z);
      const planar = [candX, candZ].filter((c): c is AxisCandidate => c !== null);
      if (planar.length > 0) {
        planar.sort(
          (a, b) => a.absDeltaMm - b.absDeltaMm || a.overlap - b.overlap
        );
        const best = planar[0];
        return {
          target: pH,
          anchor: pV,
          targetBounds: bH,
          anchorBounds: bV,
          candidate: best,
          reasonKind: best.axis === 'x' ? 'align_side' : 'general'
        };
      }
    }

    const isNearBottom = !isNearTop && bH.minY <= bV.minY + 35;
    if (isNearBottom) {
      if (overlaps.x <= 30 && overlaps.x <= overlaps.y) {
        const candX = this.createAxisCandidate(bH, bV, 'x', overlaps.x);
        if (candX) {
          return {
            target: pH,
            anchor: pV,
            targetBounds: bH,
            anchorBounds: bV,
            candidate: candX,
            reasonKind: 'align_side'
          };
        }
      }

      if (effV === 'vertical_xy' && overlaps.z <= 30 && overlaps.z < overlaps.y) {
        const candZ = this.createAxisCandidate(bH, bV, 'z', overlaps.z);
        if (candZ) {
          return {
            target: pH,
            anchor: pV,
            targetBounds: bH,
            anchorBounds: bV,
            candidate: candZ,
            reasonKind: 'general'
          };
        }
      }

      const liftVertFirst = bV.py >= bH.py;
      const higher = liftVertFirst ? pV : pH;
      const lower = liftVertFirst ? pH : pV;
      const bHigher = liftVertFirst ? bV : bH;
      const bLower = liftVertFirst ? bH : bV;
      const candUp = this.createAxisCandidate(bHigher, bLower, 'y', overlaps.y, 1);
      if (candUp) {
        return {
          target: higher,
          anchor: lower,
          targetBounds: bHigher,
          anchorBounds: bLower,
          candidate: candUp,
          reasonKind: 'top_support'
        };
      }
    }

    return null;
  }

  private pickGeneralTargetAndAnchor(
    partA: Part,
    partB: Part,
    bA: Part3DBounds,
    bB: Part3DBounds,
    overlaps: Record<Axis3D, number>,
    indexById: Map<string, number>,
    boundsById: Map<string, Part3DBounds>,
    degreeById: Map<string, number>,
    collisionsByPartId: Map<string, CollisionRecord[]>
  ): {
    target: Part;
    anchor: Part;
    targetBounds: Part3DBounds;
    anchorBounds: Part3DBounds;
  } {
    const groupedA = Boolean(partA.groupId);
    const groupedB = Boolean(partB.groupId);
    if (groupedA !== groupedB) {
      return groupedA
        ? { target: partB, anchor: partA, targetBounds: bB, anchorBounds: bA }
        : { target: partA, anchor: partB, targetBounds: bA, anchorBounds: bB };
    }

    const degA = degreeById.get(partA.id) ?? 1;
    const degB = degreeById.get(partB.id) ?? 1;
    if (degA !== degB) {
      const candA = this.pickMinimumValidCandidate(bA, bB, overlaps);
      const candB = this.pickMinimumValidCandidate(bB, bA, overlaps);
      const resolvedA = candA
        ? this.countResolvedCollisionsForMove(
            partA.id,
            bA,
            candA,
            collisionsByPartId.get(partA.id) ?? [],
            boundsById
          )
        : 0;
      const resolvedB = candB
        ? this.countResolvedCollisionsForMove(
            partB.id,
            bB,
            candB,
            collisionsByPartId.get(partB.id) ?? [],
            boundsById
          )
        : 0;

      if (degA > degB && resolvedA >= 2 && resolvedA >= resolvedB) {
        return { target: partA, anchor: partB, targetBounds: bA, anchorBounds: bB };
      }
      if (degB > degA && resolvedB >= 2 && resolvedB >= resolvedA) {
        return { target: partB, anchor: partA, targetBounds: bB, anchorBounds: bA };
      }
    }

    if (Math.abs(bA.py - bB.py) > 0.5) {
      return bA.py > bB.py
        ? { target: partA, anchor: partB, targetBounds: bA, anchorBounds: bB }
        : { target: partB, anchor: partA, targetBounds: bB, anchorBounds: bA };
    }

    const idxA = indexById.get(partA.id) ?? 0;
    const idxB = indexById.get(partB.id) ?? 0;
    return idxB > idxA
      ? { target: partB, anchor: partA, targetBounds: bB, anchorBounds: bA }
      : { target: partA, anchor: partB, targetBounds: bA, anchorBounds: bB };
  }

  private pickMinimumValidCandidate(
    targetBounds: Part3DBounds,
    anchorBounds: Part3DBounds,
    overlaps: Record<Axis3D, number>
  ): AxisCandidate | null {
    const candidates: AxisCandidate[] = [];
    for (const axis of ['x', 'y', 'z'] as const) {
      const cand = this.createAxisCandidate(
        targetBounds,
        anchorBounds,
        axis,
        overlaps[axis]
      );
      if (cand) {
        candidates.push(cand);
      }
    }
    if (candidates.length === 0) {
      return null;
    }
    candidates.sort(
      (a, b) => a.absDeltaMm - b.absDeltaMm || a.overlap - b.overlap
    );
    return candidates[0];
  }

  private createAxisCandidate(
    targetBounds: Part3DBounds,
    anchorBounds: Part3DBounds,
    axis: Axis3D,
    overlap: number,
    forcedDirection?: 1 | -1
  ): AxisCandidate | null {
    const tMin =
      axis === 'x' ? targetBounds.minX : axis === 'y' ? targetBounds.minY : targetBounds.minZ;
    const tMax =
      axis === 'x' ? targetBounds.maxX : axis === 'y' ? targetBounds.maxY : targetBounds.maxZ;
    const tCenter =
      axis === 'x' ? targetBounds.px : axis === 'y' ? targetBounds.py : targetBounds.pz;

    const aMin =
      axis === 'x' ? anchorBounds.minX : axis === 'y' ? anchorBounds.minY : anchorBounds.minZ;
    const aMax =
      axis === 'x' ? anchorBounds.maxX : axis === 'y' ? anchorBounds.maxY : anchorBounds.maxZ;
    const aCenter =
      axis === 'x' ? anchorBounds.px : axis === 'y' ? anchorBounds.py : anchorBounds.pz;

    const rawPlus = Math.max(0, aMax - tMin);
    let deltaPlus = Math.ceil(Math.max(0, rawPlus * 100 - 1e-9)) / 100;
    if (tMin + deltaPlus < aMax - 1e-6) {
      deltaPlus = Math.ceil(rawPlus * 100) / 100;
    }

    const rawMinus = Math.min(0, aMin - tMax);
    let absMinus = Math.ceil(Math.max(0, Math.abs(rawMinus) * 100 - 1e-9)) / 100;
    if (tMax - absMinus > aMin + 1e-6) {
      absMinus = Math.ceil(Math.abs(rawMinus) * 100) / 100;
    }
    const deltaMinus = -absMinus;

    const plusValid = axis !== 'y' || targetBounds.minY + deltaPlus >= -0.01;
    const minusValid = axis !== 'y' || targetBounds.minY + deltaMinus >= -0.01;

    if (forcedDirection === 1) {
      return plusValid
        ? { axis, direction: 1, deltaMm: deltaPlus, absDeltaMm: deltaPlus, overlap }
        : null;
    }
    if (forcedDirection === -1) {
      return minusValid
        ? { axis, direction: -1, deltaMm: deltaMinus, absDeltaMm: absMinus, overlap }
        : null;
    }

    if (!plusValid && !minusValid) {
      return null;
    }
    if (plusValid && !minusValid) {
      return { axis, direction: 1, deltaMm: deltaPlus, absDeltaMm: deltaPlus, overlap };
    }
    if (!plusValid && minusValid) {
      return { axis, direction: -1, deltaMm: deltaMinus, absDeltaMm: absMinus, overlap };
    }

    if (deltaPlus < absMinus - 1e-6) {
      return { axis, direction: 1, deltaMm: deltaPlus, absDeltaMm: deltaPlus, overlap };
    }
    if (absMinus < deltaPlus - 1e-6) {
      return { axis, direction: -1, deltaMm: deltaMinus, absDeltaMm: absMinus, overlap };
    }

    return tCenter >= aCenter
      ? { axis, direction: 1, deltaMm: deltaPlus, absDeltaMm: deltaPlus, overlap }
      : { axis, direction: -1, deltaMm: deltaMinus, absDeltaMm: absMinus, overlap };
  }

  private buildFixOption(
    candidate: AxisCandidate,
    target: Part,
    anchor: Part,
    isSecondary: boolean,
    reasonKind: FixReasonKind
  ): CollisionFixOption {
    const cleanDelta = Math.round(candidate.deltaMm * 100) / 100;
    const absDelta = Math.round(Math.abs(cleanDelta) * 100) / 100;
    const signed = cleanDelta >= 0 ? `+${absDelta}` : `-${absDelta}`;
    const shortAnchor = this.shortenPartName(anchor.name);

    let buttonLabel: string;
    if (isSecondary) {
      if (candidate.axis === 'x') {
        buttonLabel = 'Ajustar al lado (X)';
      } else if (candidate.axis === 'y') {
        buttonLabel =
          candidate.direction === 1
            ? `Subir +${absDelta} mm (Y)`
            : `Bajar -${absDelta} mm (Y)`;
      } else {
        buttonLabel = `Separar en Z (${signed} mm)`;
      }
    } else if (candidate.axis === 'y') {
      buttonLabel =
        candidate.direction === 1
          ? `Corregir: Subir +${absDelta} mm`
          : `Corregir: Bajar -${absDelta} mm`;
    } else if (candidate.axis === 'x') {
      buttonLabel = `Corregir: Mover X ${signed} mm`;
    } else {
      buttonLabel = `Corregir: Mover Z ${signed} mm`;
    }

    let shortReason: string;
    let actionText: string;

    if (isSecondary) {
      if (candidate.axis === 'x') {
        shortReason = `Alternativa: ajustar al lado de ${shortAnchor}`;
        actionText = `Desplazar ${target.name} en X ${signed} mm`;
      } else if (candidate.axis === 'y') {
        shortReason =
          candidate.direction === 1
            ? `Alternativa: apoyar sobre ${shortAnchor}`
            : `Alternativa: bajar bajo ${shortAnchor}`;
        actionText =
          candidate.direction === 1
            ? `Subir ${target.name} +${absDelta} mm`
            : `Bajar ${target.name} -${absDelta} mm`;
      } else {
        shortReason = `Alternativa: separar en profundidad de ${shortAnchor}`;
        actionText = `Desplazar ${target.name} en Z ${signed} mm`;
      }
    } else if (reasonKind === 'top_support' && candidate.axis === 'y' && candidate.direction === 1) {
      shortReason = `Sugerencia: apoyar sobre ${shortAnchor}`;
      actionText = `Subir ${target.name} +${absDelta} mm (Apoyar encima)`;
    } else if (reasonKind === 'align_side' && candidate.axis === 'x') {
      shortReason = 'Sugerencia: alinear al costado';
      actionText = `Desplazar en X ${signed} mm (Alinear al costado)`;
    } else if (candidate.axis === 'y') {
      shortReason =
        candidate.direction === 1
          ? `Sugerencia: apoyar sobre ${shortAnchor}`
          : `Sugerencia: bajar bajo ${shortAnchor}`;
      actionText =
        candidate.direction === 1
          ? `Subir ${target.name} +${absDelta} mm`
          : `Bajar ${target.name} -${absDelta} mm`;
    } else if (candidate.axis === 'x') {
      shortReason = `Sugerencia: separar de ${shortAnchor} en X`;
      actionText = `Desplazar ${target.name} en X ${signed} mm`;
    } else {
      shortReason = `Sugerencia: separar de ${shortAnchor} en Z`;
      actionText = `Desplazar ${target.name} en Z ${signed} mm`;
    }

    return {
      axis: candidate.axis,
      direction: candidate.direction,
      deltaMm: cleanDelta,
      absDeltaMm: absDelta,
      targetPartId: target.id,
      targetPartName: target.name,
      anchorPartId: anchor.id,
      anchorPartName: anchor.name,
      buttonLabel,
      shortReason,
      actionText
    };
  }

  private countResolvedCollisionsForMove(
    partId: string,
    originalBounds: Part3DBounds,
    candidate: AxisCandidate,
    partCollisions: CollisionRecord[],
    boundsById: Map<string, Part3DBounds>
  ): number {
    const shifted: Part3DBounds = {
      ...originalBounds,
      minX: originalBounds.minX + (candidate.axis === 'x' ? candidate.deltaMm : 0),
      maxX: originalBounds.maxX + (candidate.axis === 'x' ? candidate.deltaMm : 0),
      minY: originalBounds.minY + (candidate.axis === 'y' ? candidate.deltaMm : 0),
      maxY: originalBounds.maxY + (candidate.axis === 'y' ? candidate.deltaMm : 0),
      minZ: originalBounds.minZ + (candidate.axis === 'z' ? candidate.deltaMm : 0),
      maxZ: originalBounds.maxZ + (candidate.axis === 'z' ? candidate.deltaMm : 0)
    };

    let resolved = 0;
    const tolerance = 1.5;
    for (const col of partCollisions) {
      const otherId = col.partAId === partId ? col.partBId : col.partAId;
      const otherBounds = boundsById.get(otherId);
      if (!otherBounds) continue;

      const ox = Math.min(shifted.maxX, otherBounds.maxX) - Math.max(shifted.minX, otherBounds.minX);
      const oy = Math.min(shifted.maxY, otherBounds.maxY) - Math.max(shifted.minY, otherBounds.minY);
      const oz = Math.min(shifted.maxZ, otherBounds.maxZ) - Math.max(shifted.minZ, otherBounds.minZ);
      if (ox <= tolerance || oy <= tolerance || oz <= tolerance) {
        resolved++;
      }
    }
    return resolved;
  }

  private tryApplyBestIterativeStep(
    workingParts: Part[],
    sortedPlans: CollisionResolutionPlan[],
    currentCollisionCount: number,
    partById: Map<string, Part>,
    visitedPartStates: Set<string>,
    visitedSceneStates: Set<string>
  ): { nextParts: Part[]; nextCollisions: CollisionRecord[] } | null {
    interface StepResult {
      nextParts: Part[];
      nextCollisions: CollisionRecord[];
      prevSig: string;
      nextSig: string;
      sceneSig: string;
    }

    const evaluateCandidate = (fix: CollisionFixOption): { status: 'better' | 'neutral' | 'skip'; result?: StepResult } => {
      const targetPart = partById.get(fix.targetPartId);
      if (!targetPart || targetPart.isLocked) {
        return { status: 'skip' };
      }

      const updates = this.computePartUpdateForFix(targetPart, fix);
      if (!updates) {
        return { status: 'skip' };
      }

      const bounds = this.getPartBounds(targetPart);
      const prevSig = this.buildPartCoordSignature(
        targetPart.id,
        targetPart.posX ?? bounds.px,
        targetPart.posY ?? bounds.py,
        targetPart.posZ ?? bounds.pz
      );
      const nextSig = this.buildPartCoordSignature(
        targetPart.id,
        updates.posX ?? targetPart.posX ?? bounds.px,
        updates.posY ?? targetPart.posY ?? bounds.py,
        updates.posZ ?? targetPart.posZ ?? bounds.pz
      );

      if (prevSig === nextSig || visitedPartStates.has(nextSig)) {
        return { status: 'skip' };
      }

      const nextParts = workingParts.map(p =>
        p.id === targetPart.id ? { ...p, ...updates } : p
      );
      const sceneSig = this.buildSceneSignature(nextParts);
      if (visitedSceneStates.has(sceneSig)) {
        return { status: 'skip' };
      }

      const nextCollisions = this.detectCollisions(nextParts);
      if (nextCollisions.length < currentCollisionCount) {
        return {
          status: 'better',
          result: { nextParts, nextCollisions, prevSig, nextSig, sceneSig }
        };
      }
      if (nextCollisions.length === currentCollisionCount) {
        return {
          status: 'neutral',
          result: { nextParts, nextCollisions, prevSig, nextSig, sceneSig }
        };
      }
      return { status: 'skip' };
    };

    const commit = (res: StepResult): { nextParts: Part[]; nextCollisions: CollisionRecord[] } => {
      visitedPartStates.add(res.prevSig);
      visitedPartStates.add(res.nextSig);
      visitedSceneStates.add(res.sceneSig);
      return { nextParts: res.nextParts, nextCollisions: res.nextCollisions };
    };

    let bestNeutral: StepResult | null = null;

    // 1. Probar primaryFix / secondaryFix en orden de prioridad
    for (const plan of sortedPlans) {
      const fixes = [plan.primaryFix, plan.secondaryFix].filter(
        (f): f is CollisionFixOption => f !== null
      );
      for (const fix of fixes) {
        const evalRes = evaluateCandidate(fix);
        if (evalRes.status === 'better' && evalRes.result) {
          return commit(evalRes.result);
        }
        if (evalRes.status === 'neutral' && evalRes.result && !bestNeutral) {
          bestNeutral = evalRes.result;
        }
      }
    }

    // 2. Si ningún primary/secondary redujo el total (ej. cadena A(locked)-B-C), probar mover el socio desbloqueado
    for (const plan of sortedPlans) {
      if (!plan.primaryFix) continue;
      const anchorPart = partById.get(plan.primaryFix.anchorPartId);
      const targetPart = partById.get(plan.primaryFix.targetPartId);
      if (!anchorPart || !targetPart || anchorPart.isLocked) continue;

      const bAnchor = this.getPartBounds(anchorPart);
      const bTarget = this.getPartBounds(targetPart);
      const overlaps = this.computeAxisOverlaps(bAnchor, bTarget);

      const swappedCand = this.pickMinimumValidCandidate(bAnchor, bTarget, overlaps);
      if (!swappedCand) continue;
      const swappedFix = this.buildFixOption(swappedCand, anchorPart, targetPart, false, 'general');
      const evalRes = evaluateCandidate(swappedFix);
      if (evalRes.status === 'better' && evalRes.result) {
        return commit(evalRes.result);
      }
      if (evalRes.status === 'neutral' && evalRes.result && !bestNeutral) {
        bestNeutral = evalRes.result;
      }
    }

    return bestNeutral ? commit(bestNeutral) : null;
  }

  private computeAxisOverlaps(bA: Part3DBounds, bB: Part3DBounds): Record<Axis3D, number> {
    return {
      x: Math.max(0, Math.min(bA.maxX, bB.maxX) - Math.max(bA.minX, bB.minX)),
      y: Math.max(0, Math.min(bA.maxY, bB.maxY) - Math.max(bA.minY, bB.minY)),
      z: Math.max(0, Math.min(bA.maxZ, bB.maxZ) - Math.max(bA.minZ, bB.minZ))
    };
  }

  private buildPartCoordSignature(partId: string, x: number, y: number, z: number): string {
    const r = (v: number): number => Math.round(v * 100) / 100;
    return `${partId}:${r(x)},${r(y)},${r(z)}`;
  }

  private buildSceneSignature(parts: Part[]): string {
    const r = (v: number | undefined): string =>
      v === undefined ? '_' : String(Math.round(v * 100) / 100);
    return parts.map(p => `${p.id}@${r(p.posX)},${r(p.posY)},${r(p.posZ)}`).join('|');
  }

  private shortenPartName(name: string): string {
    const clean = (name || '').trim();
    if (clean.length <= 32) {
      return clean;
    }
    return `${clean.slice(0, 29).trimEnd()}...`;
  }

  // --- JOINERY & PARAMETRIC DRILLING ENGINE ---
  calculateJoinery(parts: Part[]): JoineryAnalysis {
    if (!parts || parts.length === 0) {
      return {
        drillHolesByPart: new Map<string, DrillHole[]>(),
        allDrillHoles: [],
        collisions: []
      };
    }

    // Construir firma geométrica rápida O(N): si solo cambiaron materiales, colores, cantos o capas, retornar en O(1)
    let signature = '';
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const cutSig = p.cornerCutConfig
        ? `${p.cornerCutConfig.type},${p.cornerCutConfig.corner},${p.cornerCutConfig.cutX},${p.cornerCutConfig.cutY}`
        : '';
      signature += `${p.id}:${p.name}:${p.length}x${p.width}x${p.thickness ?? 15}@${p.posX ?? 0},${p.posY ?? ''},${p.posZ ?? 0}:${p.orientation || 'h'}:${p.rotationX || 0},${p.rotationY || 0},${p.rotationZ || 0}:${p.componentRole || ''}:${p.groupId || ''}:${p.moduleId || ''}:${p.excludeFromCutlist ? 1 : 0}:${p.hardwareConfig?.openingDirection || ''}:${p.hardwareConfig?.movableType || ''}:${cutSig}:${p.contourPoints?.length || 0};`;
    }

    if (this.lastJoineryResult && this.lastJoinerySignature === signature) {
      return this.lastJoineryResult;
    }

    const drillHolesByPart = new Map<string, DrillHole[]>();
    const allDrillHoles: DrillHole[] = [];

    for (const p of parts) {
      drillHolesByPart.set(p.id, []);
    }

    const boundsList = parts.map(p => this.getPartBounds(p));
    const collisions = this.detectCollisionsFromBounds(boundsList);

    // 1. Compute Hinge Cup Drill Holes for Door Panels ONLY (Ø35mm)
    for (const b of boundsList) {
      const upperName = b.part.name.toUpperCase();
      const isDrawer =
        b.part.componentRole === 'drawer_front' ||
        upperName.includes('CAJON') ||
        upperName.includes('CAJÓN') ||
        upperName.includes('GAVETA') ||
        b.part.id.includes('caj_ind_');
      const isDoor =
        !isDrawer &&
        (b.part.componentRole === 'door' ||
          (upperName.includes('PUERTA') && !upperName.includes('CAJ')));

      if (isDoor && b.sy >= 250) {
        const holes = this.generateDoorHingeHoles(b, parts);
        for (const h of holes) {
          drillHolesByPart.get(b.part.id)?.push(h);
          allDrillHoles.push(h);
        }
      }
    }

    // 2. Compute Technical System 32 Slide Drill Holes on Cabinet Side Panels
    for (const b of boundsList) {
      const upperName = b.part.name.toUpperCase();
      const isInternalBox =
        b.part.componentRole === 'drawer_box' ||
        upperName.includes('LATERAL') ||
        upperName.includes('COSTADO') ||
        upperName.includes('TRASERA') ||
        upperName.includes('FONDO') ||
        upperName.includes('CONTRAFRENTE') ||
        upperName.includes('INTERIOR');
      const isDrawerFront =
        !isInternalBox &&
        (b.part.componentRole === 'drawer_front' ||
          b.part.hardwareConfig?.movableType === 'drawer' ||
          (upperName.includes('FRENTE') &&
            (upperName.includes('CAJ') || upperName.includes('GAVET'))) ||
          ((upperName.startsWith('CAJ') || upperName.startsWith('GAVET')) &&
            !isInternalBox));

      if (isDrawerFront) {
        const slideHoles = this.generateSlideSystem32Holes(b, boundsList, parts);
        for (const h of slideHoles) {
          drillHolesByPart.get(h.partId)?.push(h);
          allDrillHoles.push(h);
        }
      }
    }

    // 3. Compute 90° Butt Joints between contacting pieces using O(N) Pre-Filtering + Sweep-and-Prune AABB
    const contactTolerance = 3.0;
    const structuralBounds = boundsList
      .filter(b => {
        if ((b.part.thickness || 15) <= 8) return false;
        const role = b.part.componentRole;
        if (
          role === 'door' ||
          role === 'drawer_front' ||
          role === 'back' ||
          role === 'countertop' ||
          role === 'backsplash' ||
          b.part.excludeFromCutlist
        ) {
          return false;
        }
        const upperName = b.part.name.toUpperCase();
        if (
          upperName.includes('PUERTA') ||
          upperName.includes('CAJON') ||
          upperName.includes('CAJÓN') ||
          upperName.includes('GAVETA') ||
          upperName.includes('FRENTE')
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.minX - b.minX);

    for (let i = 0; i < structuralBounds.length; i++) {
      const b1 = structuralBounds[i];
      const maxXReach = b1.maxX + contactTolerance;

      for (let j = i + 1; j < structuralBounds.length; j++) {
        const b2 = structuralBounds[j];
        // Poda espacial Sweep-and-Prune en X: ninguna pieza posterior está a distancia de contacto con b1
        if (b2.minX > maxXReach) {
          break;
        }
        // Poda espacial rápida AABB en Y y Z antes de llamar a analyzeJointContact
        if (b2.minY > b1.maxY + contactTolerance || b1.minY > b2.maxY + contactTolerance) continue;
        if (b2.minZ > b1.maxZ + contactTolerance || b1.minZ > b2.maxZ + contactTolerance) continue;

        this.analyzeJointContact(b1, b2, drillHolesByPart, allDrillHoles);
      }
    }

    const result: JoineryAnalysis = {
      drillHolesByPart,
      allDrillHoles,
      collisions
    };
    this.lastJoinerySignature = signature;
    this.lastJoineryResult = result;
    return result;
  }

  private generateSlideSystem32Holes(drawer: Part3DBounds, allBounds: Part3DBounds[], allParts: Part[]): DrillHole[] {
    const holes: DrillHole[] = [];
    const slideY = drawer.py - drawer.sy * 0.15;
    const facing = this.getPartFacingDirection(drawer.part, allParts);

    const isModularDrawer =
      drawer.part.moduleId === 'cajon_independiente' ||
      (drawer.part.groupId || '').startsWith('drawer_grp_');

    // Filtrar solo costados/divisores estructurales reales del módulo (excluir puertas, frentes, fondos, cajones internos)
    const candidateSides = allBounds.filter(b => {
      if (b.part.id === drawer.part.id) return false;
      if (
        !isModularDrawer &&
        drawer.part.groupId &&
        b.part.groupId &&
        b.part.groupId !== drawer.part.groupId
      ) {
        return false;
      }
      const role = b.part.componentRole;
      if (
        role === 'door' ||
        role === 'drawer_front' ||
        role === 'drawer_box' ||
        role === 'drawer_lateral' ||
        role === 'back' ||
        role === 'plinth' ||
        (b.part.thickness || 15) <= 8
      ) {
        return false;
      }
      const upper = b.part.name.toUpperCase();
      if (
        upper.includes('FRENTE') ||
        upper.includes('PUERTA') ||
        upper.includes('FONDO') ||
        upper.includes('TRASERA') ||
        upper.includes('CONTRA') ||
        upper.includes('ZOCALO') ||
        upper.includes('ZÓCALO') ||
        ((upper.includes('CAJ') || upper.includes('GAVET')) && !upper.includes('LATERAL CAJONERA'))
      ) {
        return false;
      }
      return b.sy >= 150 && drawer.py >= b.minY - 20 && drawer.py <= b.maxY + 20;
    });

    const spacings = [37, 69, 101, 165, 229, 293];

    if (facing === 'front' || facing === 'back') {
      // Cajón se desliza en Z; los laterales del gabinete tienen espesor en X (b.sx <= 36)
      const verticalSides = candidateSides.filter(b => b.sx <= 36 && b.sz >= 150);

      const leftFlank = verticalSides
        .filter(b => b.maxX <= drawer.minX + 30 && b.maxX >= drawer.minX - 50)
        .sort((a, b) => b.maxX - a.maxX)[0];

      const rightFlank = verticalSides
        .filter(b => b.minX >= drawer.maxX - 30 && b.minX <= drawer.maxX + 50)
        .sort((a, b) => a.minX - b.minX)[0];

      const flanks = [
        { side: leftFlank, isMinSide: true },
        { side: rightFlank, isMinSide: false }
      ];

      for (const { side, isMinSide } of flanks) {
        if (!side) continue;

        const frontEdgeZ = facing === 'front' ? side.maxZ : side.minZ;
        const stepSign = facing === 'front' ? -1 : 1;
        const holePosX = isMinSide ? side.maxX : side.minX;
        const normalAxis = 'x' as const;
        const direction = (isMinSide ? -1 : 1) as 1 | -1;
        const maxReachableDepth = side.sz - 40;

        for (let i = 0; i < spacings.length; i++) {
          const dist = spacings[i];
          if (dist > maxReachableDepth) break;

          const holeZ = frontEdgeZ + stepSign * dist;
          holes.push({
            id: `slide_sys32_${side.part.id}_${drawer.part.id}_${i}`,
            type: 'slide_system32',
            diameter: 5,
            depth: 11.5,
            posX: holePosX,
            posY: slideY,
            posZ: holeZ,
            normalAxis,
            direction,
            surfaceType: 'face',
            partId: side.part.id,
            partName: side.part.name,
            targetPartId: drawer.part.id,
            targetPartName: drawer.part.name,
            description: `Perforación técnica corredera Sistema 32 Ø5x11.5mm (${dist}mm del borde frontal)`
          });
        }
      }
    } else {
      // Módulo rotado 90° ('left' o 'right'): el cajón se desliza en X; los laterales tienen espesor en Z (b.sz <= 36)
      const verticalSides = candidateSides.filter(b => b.sz <= 36 && b.sx >= 150);

      const minZFlank = verticalSides
        .filter(b => b.maxZ <= drawer.minZ + 30 && b.maxZ >= drawer.minZ - 50)
        .sort((a, b) => b.maxZ - a.maxZ)[0];

      const maxZFlank = verticalSides
        .filter(b => b.minZ >= drawer.maxZ - 30 && b.minZ <= drawer.maxZ + 50)
        .sort((a, b) => a.minZ - b.minZ)[0];

      const flanks = [
        { side: minZFlank, isMinSide: true },
        { side: maxZFlank, isMinSide: false }
      ];

      for (const { side, isMinSide } of flanks) {
        if (!side) continue;

        const frontEdgeX = facing === 'right' ? side.maxX : side.minX;
        const stepSign = facing === 'right' ? -1 : 1;
        const holePosZ = isMinSide ? side.maxZ : side.minZ;
        const normalAxis = 'z' as const;
        const direction = (isMinSide ? -1 : 1) as 1 | -1;
        const maxReachableDepth = side.sx - 40;

        for (let i = 0; i < spacings.length; i++) {
          const dist = spacings[i];
          if (dist > maxReachableDepth) break;

          const holeX = frontEdgeX + stepSign * dist;
          holes.push({
            id: `slide_sys32_${side.part.id}_${drawer.part.id}_${i}`,
            type: 'slide_system32',
            diameter: 5,
            depth: 11.5,
            posX: holeX,
            posY: slideY,
            posZ: holePosZ,
            normalAxis,
            direction,
            surfaceType: 'face',
            partId: side.part.id,
            partName: side.part.name,
            targetPartId: drawer.part.id,
            targetPartName: drawer.part.name,
            description: `Perforación técnica corredera Sistema 32 Ø5x11.5mm (${dist}mm del borde frontal)`
          });
        }
      }
    }

    return holes;
  }

  private generateDoorHingeHoles(b: Part3DBounds, allParts: Part[]): DrillHole[] {
    const holes: DrillHole[] = [];
    const height = b.sy;
    const facing = this.getPartFacingDirection(b.part, allParts);

    let hingeSide = b.part.hardwareConfig?.openingDirection;
    if (!hingeSide) {
      const nameUpper = b.part.name.toUpperCase();
      if (nameUpper.includes('BASCULANTE') || nameUpper.includes('ELEVABLE')) {
        hingeSide = 'top';
      } else if (nameUpper.includes('DER') || (b.part.posX || 0) > 0) {
        hingeSide = 'right';
      } else {
        hingeSide = 'left';
      }
    }

    const sideText =
      hingeSide === 'right'
        ? 'derecho'
        : hingeSide === 'top'
          ? 'superior'
          : hingeSide === 'bottom'
            ? 'inferior'
            : 'izquierdo';

    if (hingeSide === 'top' || hingeSide === 'bottom') {
      const y = hingeSide === 'top' ? b.maxY - 22 : b.minY + 22;
      const span = facing === 'front' || facing === 'back' ? b.sx : b.sz;
      const marginH = Math.min(100, span * 0.2);
      const offsets =
        facing === 'front' || facing === 'back'
          ? [b.minX + marginH, b.maxX - marginH]
          : [b.minZ + marginH, b.maxZ - marginH];

      offsets.forEach((coord, i) => {
        const posX = facing === 'front' || facing === 'back' ? coord : facing === 'right' ? b.maxX : b.minX;
        const posZ = facing === 'front' ? b.maxZ : facing === 'back' ? b.minZ : coord;
        const normalAxis: 'x' | 'z' = facing === 'front' || facing === 'back' ? 'z' : 'x';
        const direction: 1 | -1 = facing === 'front' || facing === 'right' ? 1 : -1;

        holes.push({
          id: `hinge_${b.part.id}_${i}`,
          type: 'hinge_35',
          diameter: 35,
          depth: 12.5,
          posX,
          posY: y,
          posZ,
          normalAxis,
          direction,
          surfaceType: 'face',
          partId: b.part.id,
          partName: b.part.name,
          description: `Cazoleta bisagra Ø35mm x 12.5mm (borde ${sideText})`
        });
      });
      return holes;
    }

    const marginY = Math.min(100, height * 0.15);
    const hingeYs = [b.minY + marginY, b.maxY - marginY];
    if (height >= 950) {
      hingeYs.push(b.py);
    }

    for (let i = 0; i < hingeYs.length; i++) {
      const y = hingeYs[i];
      let posX = b.px;
      let posZ = b.pz;
      let normalAxis: 'x' | 'z' = 'z';
      let direction: 1 | -1 = 1;

      if (facing === 'front') {
        normalAxis = 'z';
        direction = 1;
        posZ = b.maxZ;
        if (hingeSide === 'left') posX = b.minX + 22;
        else if (hingeSide === 'right') posX = b.maxX - 22;
      } else if (facing === 'back') {
        normalAxis = 'z';
        direction = -1;
        posZ = b.minZ;
        if (hingeSide === 'left') posX = b.maxX - 22;
        else if (hingeSide === 'right') posX = b.minX + 22;
      } else if (facing === 'right') {
        normalAxis = 'x';
        direction = 1;
        posX = b.maxX;
        if (hingeSide === 'left') posZ = b.maxZ - 22;
        else if (hingeSide === 'right') posZ = b.minZ + 22;
      } else {
        // 'left'
        normalAxis = 'x';
        direction = -1;
        posX = b.minX;
        if (hingeSide === 'left') posZ = b.minZ + 22;
        else if (hingeSide === 'right') posZ = b.maxZ - 22;
      }

      holes.push({
        id: `hinge_${b.part.id}_${i}`,
        type: 'hinge_35',
        diameter: 35,
        depth: 12.5,
        posX,
        posY: y,
        posZ,
        normalAxis,
        direction,
        surfaceType: 'face',
        partId: b.part.id,
        partName: b.part.name,
        description: `Cazoleta bisagra Ø35mm x 12.5mm (borde ${sideText})`
      });
    }

    return holes;
  }

  private analyzeJointContact(
    b1: Part3DBounds,
    b2: Part3DBounds,
    drillMap: Map<string, DrillHole[]>,
    allDrills: DrillHole[]
  ) {
    const isMovable1 =
      b1.part.componentRole === 'door' ||
      b1.part.componentRole === 'drawer_front' ||
      b1.part.name.toUpperCase().includes('PUERTA') ||
      b1.part.name.toUpperCase().includes('CAJON') ||
      b1.part.name.toUpperCase().includes('CAJÓN') ||
      b1.part.name.toUpperCase().includes('GAVETA') ||
      b1.part.name.toUpperCase().includes('FRENTE');
    const isMovable2 =
      b2.part.componentRole === 'door' ||
      b2.part.componentRole === 'drawer_front' ||
      b2.part.name.toUpperCase().includes('PUERTA') ||
      b2.part.name.toUpperCase().includes('CAJON') ||
      b2.part.name.toUpperCase().includes('CAJÓN') ||
      b2.part.name.toUpperCase().includes('GAVETA') ||
      b2.part.name.toUpperCase().includes('FRENTE');
    if (isMovable1 || isMovable2) return;

    // Ignorar fondos delgados (MDF 3-6mm) para tornillos/tarugos estructurales
    if ((b1.part.thickness || 15) <= 8 || (b2.part.thickness || 15) <= 8) return;
    if (b1.part.componentRole === 'back' || b2.part.componentRole === 'back') return;

    // Excluir mesones y salpicaderos de perforaciones CNC estructurales (minifix, espigas, tornillos)
    if (
      b1.part.componentRole === 'countertop' ||
      b1.part.componentRole === 'backsplash' ||
      b1.part.excludeFromCutlist ||
      b2.part.componentRole === 'countertop' ||
      b2.part.componentRole === 'backsplash' ||
      b2.part.excludeFromCutlist
    ) {
      return;
    }

    const contactTolerance = 3.0;
    const overlapX = Math.min(b1.maxX, b2.maxX) - Math.max(b1.minX, b2.minX);
    const overlapY = Math.min(b1.maxY, b2.maxY) - Math.max(b1.minY, b2.minY);
    const overlapZ = Math.min(b1.maxZ, b2.maxZ) - Math.max(b1.minZ, b2.minZ);

    const isSideYZ1 = b1.sx <= 36 && b1.sy >= 60 && b1.sz >= 60;
    const isSideYZ2 = b2.sx <= 36 && b2.sy >= 60 && b2.sz >= 60;
    const isSideXY1 = b1.sz <= 36 && b1.sy >= 60 && b1.sx >= 60;
    const isSideXY2 = b2.sz <= 36 && b2.sy >= 60 && b2.sx >= 60;
    const isShelf1 = b1.sy <= 36 && b1.sx >= 60 && b1.sz >= 60;
    const isShelf2 = b2.sy <= 36 && b2.sx >= 60 && b2.sz >= 60;

    // CASO A: Uniones con línea de contacto a lo largo del eje Z (módulo mirando a Frente/Atrás)
    if (overlapZ >= 60) {
      if ((isSideYZ1 && isShelf2) || (isSideYZ2 && isShelf1)) {
        const side = isSideYZ1 ? b1 : b2;
        const shelf = isSideYZ1 ? b2 : b1;
        const touchesLeft = Math.abs(shelf.minX - side.maxX) <= contactTolerance;
        const touchesRight = Math.abs(shelf.maxX - side.minX) <= contactTolerance;

        if ((touchesLeft || touchesRight) && overlapY >= 8) {
          const contactX = touchesLeft ? side.maxX : side.minX;
          const contactY = Math.max(shelf.minY + 4, Math.min(shelf.maxY - 4, shelf.py));
          const minZ = Math.max(side.minZ, shelf.minZ);
          const maxZ = Math.min(side.maxZ, shelf.maxZ);

          this.distributeScrewAndDowelHoles(
            side,
            shelf,
            'x',
            'z',
            contactX,
            contactY,
            minZ,
            maxZ,
            drillMap,
            allDrills
          );
          return;
        }
      }

      if ((isShelf1 && isSideYZ2) || (isShelf2 && isSideYZ1)) {
        const horizontal = isShelf1 ? b1 : b2;
        const vertical = isShelf1 ? b2 : b1;

        const touchesTop = Math.abs(vertical.minY - horizontal.maxY) <= contactTolerance;
        const touchesBottom = Math.abs(vertical.maxY - horizontal.minY) <= contactTolerance;

        if ((touchesTop || touchesBottom) && overlapX >= 8) {
          const contactY = touchesTop ? horizontal.maxY : horizontal.minY;
          const contactX = Math.max(vertical.minX + 4, Math.min(vertical.maxX - 4, vertical.px));
          const minZ = Math.max(horizontal.minZ, vertical.minZ);
          const maxZ = Math.min(horizontal.maxZ, vertical.maxZ);

          this.distributeScrewAndDowelHoles(
            horizontal,
            vertical,
            'y',
            'z',
            contactY,
            contactX,
            minZ,
            maxZ,
            drillMap,
            allDrills
          );
          return;
        }
      }
    }

    // CASO B: Uniones con línea de contacto a lo largo del eje X (módulo rotado 90° mirando a Izq/Der)
    if (overlapX >= 60) {
      if ((isSideXY1 && isShelf2) || (isSideXY2 && isShelf1)) {
        const side = isSideXY1 ? b1 : b2;
        const shelf = isSideXY1 ? b2 : b1;
        const touchesBack = Math.abs(shelf.minZ - side.maxZ) <= contactTolerance;
        const touchesFront = Math.abs(shelf.maxZ - side.minZ) <= contactTolerance;

        if ((touchesBack || touchesFront) && overlapY >= 8) {
          const contactZ = touchesBack ? side.maxZ : side.minZ;
          const contactY = Math.max(shelf.minY + 4, Math.min(shelf.maxY - 4, shelf.py));
          const minX = Math.max(side.minX, shelf.minX);
          const maxX = Math.min(side.maxX, shelf.maxX);

          this.distributeScrewAndDowelHoles(
            side,
            shelf,
            'z',
            'x',
            contactZ,
            contactY,
            minX,
            maxX,
            drillMap,
            allDrills
          );
          return;
        }
      }

      if ((isShelf1 && isSideXY2) || (isShelf2 && isSideXY1)) {
        const horizontal = isShelf1 ? b1 : b2;
        const vertical = isShelf1 ? b2 : b1;

        const touchesTop = Math.abs(vertical.minY - horizontal.maxY) <= contactTolerance;
        const touchesBottom = Math.abs(vertical.maxY - horizontal.minY) <= contactTolerance;

        if ((touchesTop || touchesBottom) && overlapZ >= 8) {
          const contactY = touchesTop ? horizontal.maxY : horizontal.minY;
          const contactZ = Math.max(vertical.minZ + 4, Math.min(vertical.maxZ - 4, vertical.pz));
          const minX = Math.max(horizontal.minX, vertical.minX);
          const maxX = Math.min(horizontal.maxX, vertical.maxX);

          this.distributeScrewAndDowelHoles(
            horizontal,
            vertical,
            'y',
            'x',
            contactY,
            contactZ,
            minX,
            maxX,
            drillMap,
            allDrills
          );
          return;
        }
      }
    }
  }

  private distributeScrewAndDowelHoles(
    passing: Part3DBounds,
    butt: Part3DBounds,
    normalAxis: 'x' | 'y' | 'z',
    lineAxis: 'z' | 'x',
    contactNormalPos: number,
    contactCrossPos: number,
    minLine: number,
    maxLine: number,
    drillMap: Map<string, DrillHole[]>,
    allDrills: DrillHole[]
  ) {
    const contactLen = maxLine - minLine;
    if (contactLen < 70) return;

    const startLine = minLine + Math.min(50, contactLen * 0.18);
    const endLine = maxLine - Math.min(50, contactLen * 0.18);

    const screwCoords: number[] = [startLine, endLine];
    const dowelCoords: number[] = [];

    if (contactLen >= 320) {
      const midLine = (startLine + endLine) / 2;
      screwCoords.push(midLine);
      dowelCoords.push((startLine + midLine) / 2);
      dowelCoords.push((midLine + endLine) / 2);
    } else {
      dowelCoords.push((startLine + endLine) / 2);
    }

    const resolveXYZ = (lineCoord: number): { posX: number; posY: number; posZ: number } => {
      if (lineAxis === 'z') {
        const posX = normalAxis === 'x' ? contactNormalPos : contactCrossPos;
        const posY = normalAxis === 'x' ? contactCrossPos : contactNormalPos;
        return { posX, posY, posZ: lineCoord };
      } else {
        // lineAxis === 'x'
        const posZ = normalAxis === 'z' ? contactNormalPos : contactCrossPos;
        const posY = normalAxis === 'z' ? contactCrossPos : contactNormalPos;
        return { posX: lineCoord, posY, posZ };
      }
    };

    screwCoords.forEach((lineCoord, idx) => {
      const { posX, posY, posZ } = resolveXYZ(lineCoord);

      const passHole: DrillHole = {
        id: `screw_pass_${passing.part.id}_${butt.part.id}_${idx}`,
        type: 'screw_4x50',
        diameter: 4.5,
        depth: passing.part.thickness || 15,
        posX,
        posY,
        posZ,
        normalAxis,
        direction: 1,
        surfaceType: 'face',
        partId: passing.part.id,
        partName: passing.part.name,
        targetPartId: butt.part.id,
        targetPartName: butt.part.name,
        description: `Taladro pasante Ø4.5mm con avellanador para tornillo soberbio 4x50 hacia ${butt.part.name}`
      };
      drillMap.get(passing.part.id)?.push(passHole);
      allDrills.push(passHole);

      const guideHole: DrillHole = {
        id: `screw_guide_${butt.part.id}_${passing.part.id}_${idx}`,
        type: 'screw_4x50',
        diameter: 3.0,
        depth: 40,
        posX,
        posY,
        posZ,
        normalAxis,
        direction: -1,
        surfaceType: 'edge',
        partId: butt.part.id,
        partName: butt.part.name,
        targetPartId: passing.part.id,
        targetPartName: passing.part.name,
        description: `Taladro guía Ø3.0mm x 40mm en canto para tornillo 4x50 desde ${passing.part.name}`
      };
      drillMap.get(butt.part.id)?.push(guideHole);
      allDrills.push(guideHole);
    });

    dowelCoords.forEach((lineCoord, idx) => {
      const { posX, posY, posZ } = resolveXYZ(lineCoord);

      const dowelPassing: DrillHole = {
        id: `dowel_pass_${passing.part.id}_${butt.part.id}_${idx}`,
        type: 'dowel_8x30',
        diameter: 8.0,
        depth: 12.0,
        posX,
        posY,
        posZ,
        normalAxis,
        direction: 1,
        surfaceType: 'face',
        partId: passing.part.id,
        partName: passing.part.name,
        targetPartId: butt.part.id,
        targetPartName: butt.part.name,
        description: `Orificio ciego Ø8.0mm x 12mm en cara para tarugo 8x30 hacia ${butt.part.name}`
      };
      drillMap.get(passing.part.id)?.push(dowelPassing);
      allDrills.push(dowelPassing);

      const dowelButt: DrillHole = {
        id: `dowel_edge_${butt.part.id}_${passing.part.id}_${idx}`,
        type: 'dowel_8x30',
        diameter: 8.0,
        depth: 20.0,
        posX,
        posY,
        posZ,
        normalAxis,
        direction: -1,
        surfaceType: 'edge',
        partId: butt.part.id,
        partName: butt.part.name,
        targetPartId: passing.part.id,
        targetPartName: passing.part.name,
        description: `Orificio ciego Ø8.0mm x 20mm en canto para tarugo 8x30 desde ${passing.part.name}`
      };
      drillMap.get(butt.part.id)?.push(dowelButt);
      allDrills.push(dowelButt);
    });
  }
}
