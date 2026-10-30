import { Injectable } from '@angular/core';
import { Part, DrillHole, CollisionRecord } from '../models/melamine.models';

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
  // Caché en memoria WeakMap para evitar recalcular trigonometría Euler y AABB en piezas inmutadas
  private readonly boundsCache = new WeakMap<Part, { sig: string; bounds: Part3DBounds }>();

  // Caché reactiva de firma geométrica para retornar instantáneamente O(1) cuando solo cambian colores, cantos o capas
  private lastJoinerySignature = '';
  private lastJoineryResult: JoineryAnalysis | null = null;

  /**
   * Calcula las dimensiones locales (sx, sy, sz) antes de aplicar rotaciones Euler (rotationX/Y/Z).
   * Útil para construir el BoxGeometry(sx, sy, sz) en el visor 3D cuando el mesh aplica rotation.set(...) encima.
   */
  getPartLocalDimensions(part: Part): { sx: number; sy: number; sz: number } {
    const t = part.thickness || 15;
    const L = part.length;
    const W = part.width;

    let sx = L;
    let sy = t;
    let sz = W;

    const orient = part.orientation || 'horizontal';
    if (orient === 'vertical_yz') {
      const isPlinth =
        part.componentRole === 'plinth' ||
        part.name.toUpperCase().includes('ZOCALO') ||
        part.name.toUpperCase().includes('ZÓCALO');

      const isCabinetSide =
        !isPlinth &&
        (part.componentRole === 'side_left' ||
          part.componentRole === 'side_right' ||
          part.componentRole === 'divider' ||
          part.componentRole === 'door' ||
          part.componentRole === 'back' ||
          (part.name.toUpperCase().includes('LATERAL') &&
            !part.name.toUpperCase().includes('CAJ') &&
            part.componentRole !== 'drawer_box' &&
            part.componentRole !== 'drawer_lateral'));

      const isDrawerBoxSide =
        !isPlinth &&
        !isCabinetSide &&
        (part.componentRole === 'drawer_box' ||
          part.componentRole === 'drawer_lateral' ||
          (part.name.toUpperCase().includes('LATERAL') && part.name.toUpperCase().includes('CAJ')));

      const isBacksplash =
        part.componentRole === 'backsplash' ||
        part.name.toUpperCase().includes('SALPICADERO');

      if (isBacksplash) {
        sx = t;
        sy = Math.min(L, W);
        sz = Math.max(L, W);
      } else if ((isPlinth || isDrawerBoxSide) && L > W) {
        sx = t;
        sy = W;
        sz = L;
      } else {
        sx = t;
        sy = L;
        sz = W;
      }
    } else if (orient === 'vertical_xy') {
      sx = L;
      sy = W;
      sz = t;
    }

    return { sx, sy, sz };
  }

  /**
   * Calcula la caja envolvente 3D exacta (sx, sy, sz y límites min/max) de una pieza en el espacio mundial,
   * incluyendo cualquier rotación personalizada (rotationX, rotationY, rotationZ).
   * Es la única fuente de verdad compartida entre el motor de uniones, el almacenamiento y el visor 3D.
   */
  getPartBounds(part: Part): Part3DBounds {
    const geomSig = `${part.length}|${part.width}|${part.thickness ?? 15}|${part.posX ?? 0}|${part.posY ?? ''}|${part.posZ ?? 0}|${part.orientation || 'h'}|${part.rotationX || 0}|${part.rotationY || 0}|${part.rotationZ || 0}|${part.componentRole || ''}|${part.name}`;
    const cached = this.boundsCache.get(part);
    if (cached && cached.sig === geomSig) {
      return cached.bounds;
    }

    let { sx, sy, sz } = this.getPartLocalDimensions(part);

    const rx = ((part.rotationX || 0) * Math.PI) / 180;
    const ry = ((part.rotationY || 0) * Math.PI) / 180;
    const rz = ((part.rotationZ || 0) * Math.PI) / 180;

    if (Math.abs(rx) > 1e-4 || Math.abs(ry) > 1e-4 || Math.abs(rz) > 1e-4) {
      const cx = Math.cos(rx), srx = Math.sin(rx);
      const cy = Math.cos(ry), sry = Math.sin(ry);
      const cz = Math.cos(rz), srz = Math.sin(rz);

      // Matriz de rotación Euler 'XYZ' de Three.js
      const m00 = cy * cz;
      const m01 = -cy * srz;
      const m02 = sry;
      const m10 = srx * sry * cz + cx * srz;
      const m11 = -srx * sry * srz + cx * cz;
      const m12 = -srx * cy;
      const m20 = -cx * sry * cz + srx * srz;
      const m21 = cx * sry * srz + srx * cz;
      const m22 = cx * cy;

      const wsx = Math.abs(m00) * sx + Math.abs(m01) * sy + Math.abs(m02) * sz;
      const wsy = Math.abs(m10) * sx + Math.abs(m11) * sy + Math.abs(m12) * sz;
      const wsz = Math.abs(m20) * sx + Math.abs(m21) * sy + Math.abs(m22) * sz;

      sx = Math.round(wsx * 100) / 100;
      sy = Math.round(wsy * 100) / 100;
      sz = Math.round(wsz * 100) / 100;
    }

    const px = part.posX ?? 0;
    const py = part.posY ?? (sy / 2);
    const pz = part.posZ ?? 0;

    const bounds: Part3DBounds = {
      part,
      minX: px - sx / 2,
      maxX: px + sx / 2,
      minY: py - sy / 2,
      maxY: py + sy / 2,
      minZ: pz - sz / 2,
      maxZ: pz + sz / 2,
      sx,
      sy,
      sz,
      px,
      py,
      pz
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

  // --- COLLISION DETECTION ENGINE (Sweep-and-Prune Spatial AABB Optimization) ---
  detectCollisions(parts: Part[]): CollisionRecord[] {
    if (!parts || parts.length < 2) return [];
    const boundsList = parts.map(p => this.getPartBounds(p));
    return this.detectCollisionsFromBounds(boundsList);
  }

  private detectCollisionsFromBounds(boundsList: Part3DBounds[]): CollisionRecord[] {
    const collisions: CollisionRecord[] = [];
    if (boundsList.length < 2) return collisions;

    const tolerance = 0.8; // mm tolerance to ignore ideal flush contacts
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

          // Ranura de fondo de cajón MDF (encastre ranurado estándar de 4-8 mm)
          const isDrawerBottomJoint =
            ((b1.part.componentRole === 'drawer_box' && (b1.part.thickness || 0) <= 6) && b2.part.componentRole === 'drawer_box') ||
            ((b2.part.componentRole === 'drawer_box' && (b2.part.thickness || 0) <= 6) && b1.part.componentRole === 'drawer_box');
          if (isDrawerBottomJoint && (overlapX <= 12 || overlapZ <= 12) && overlapY <= 8) {
            continue;
          }

          const vol = overlapX * overlapY * overlapZ;
          collisions.push({
            partAId: b1.part.id,
            partAName: b1.part.name,
            partBId: b2.part.id,
            partBName: b2.part.name,
            overlapX: Math.round(overlapX * 10) / 10,
            overlapY: Math.round(overlapY * 10) / 10,
            overlapZ: Math.round(overlapZ * 10) / 10,
            overlapVolumeMm3: Math.round(vol)
          });
        }
      }
    }

    return collisions;
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
      signature += `${p.id}:${p.name}:${p.length}x${p.width}x${p.thickness ?? 15}@${p.posX ?? 0},${p.posY ?? ''},${p.posZ ?? 0}:${p.orientation || 'h'}:${p.rotationX || 0},${p.rotationY || 0},${p.rotationZ || 0}:${p.componentRole || ''}:${p.groupId || ''}:${p.moduleId || ''}:${p.excludeFromCutlist ? 1 : 0}:${p.hardwareConfig?.openingDirection || ''}:${p.hardwareConfig?.movableType || ''};`;
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

    // Filtrar solo costados/divisores estructurales reales del módulo (excluir puertas, frentes, fondos, cajones internos)
    const candidateSides = allBounds.filter(b => {
      if (b.part.id === drawer.part.id) return false;
      if (drawer.part.groupId && b.part.groupId && b.part.groupId !== drawer.part.groupId) return false;
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
