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

  /**
   * Calcula la caja envolvente 3D exacta (sx, sy, sz y límites min/max) de una pieza.
   * Es la única fuente de verdad compartida entre el motor de uniones, el almacenamiento y el visor 3D.
   */
  getPartBounds(part: Part): Part3DBounds {
    const t = part.thickness || 18;
    const L = part.length;
    const W = part.width;

    let sx = L;
    let sy = t;
    let sz = W;

    const orient = part.orientation || 'horizontal';
    if (orient === 'vertical_yz') {
      const isCabinetSide =
        part.componentRole === 'side_left' ||
        part.componentRole === 'side_right' ||
        part.componentRole === 'divider' ||
        part.componentRole === 'door' ||
        part.componentRole === 'back' ||
        (part.name.toUpperCase().includes('LATERAL') &&
          !part.name.toUpperCase().includes('CAJ') &&
          part.componentRole !== 'drawer_box' &&
          part.componentRole !== 'drawer_lateral');

      const isDrawerBoxSide =
        !isCabinetSide &&
        (part.componentRole === 'drawer_box' ||
          part.componentRole === 'drawer_lateral' ||
          (part.name.toUpperCase().includes('LATERAL') && part.name.toUpperCase().includes('CAJ')));

      if (isDrawerBoxSide && L > W) {
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

    const px = part.posX ?? 0;
    const py = part.posY ?? (sy / 2);
    const pz = part.posZ ?? 0;

    return {
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

    if (part.orientation === 'vertical_yz') {
      return dx >= 0 ? 'right' : 'left';
    }
    return dz >= 0 ? 'front' : 'back';
  }

  // --- COLLISION DETECTION ENGINE ---
  detectCollisions(parts: Part[]): CollisionRecord[] {
    const collisions: CollisionRecord[] = [];
    if (!parts || parts.length < 2) return collisions;

    const boundsList = parts.map(p => this.getPartBounds(p));
    const tolerance = 0.8; // mm tolerance to ignore ideal flush contacts

    for (let i = 0; i < boundsList.length; i++) {
      for (let j = i + 1; j < boundsList.length; j++) {
        const b1 = boundsList[i];
        const b2 = boundsList[j];

        const overlapX = Math.min(b1.maxX, b2.maxX) - Math.max(b1.minX, b2.minX);
        const overlapY = Math.min(b1.maxY, b2.maxY) - Math.max(b1.minY, b2.minY);
        const overlapZ = Math.min(b1.maxZ, b2.maxZ) - Math.max(b1.minZ, b2.minZ);

        if (overlapX > tolerance && overlapY > tolerance && overlapZ > tolerance) {
          const isBackJoint =
            (b1.part.componentRole === 'back' &&
              b2.part.componentRole &&
              ['side_left', 'side_right', 'top', 'bottom', 'shelf'].includes(b2.part.componentRole)) ||
            (b2.part.componentRole === 'back' &&
              b1.part.componentRole &&
              ['side_left', 'side_right', 'top', 'bottom', 'shelf'].includes(b1.part.componentRole));
          const sameGroup = b1.part.groupId && b1.part.groupId === b2.part.groupId;
          if (isBackJoint && sameGroup && (overlapX <= 12 || overlapY <= 12 || overlapZ <= 12)) {
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
    const drillHolesByPart = new Map<string, DrillHole[]>();
    const allDrillHoles: DrillHole[] = [];

    for (const p of parts) {
      drillHolesByPart.set(p.id, []);
    }

    if (!parts || parts.length === 0) {
      return { drillHolesByPart, allDrillHoles, collisions: [] };
    }

    const boundsList = parts.map(p => this.getPartBounds(p));
    const collisions = this.detectCollisions(parts);

    // 1. Compute Hinge Cup Drill Holes for Door Panels ONLY (Ø35mm)
    for (const b of boundsList) {
      const isDrawer =
        b.part.componentRole === 'drawer_front' ||
        b.part.name.toUpperCase().includes('CAJON') ||
        b.part.name.toUpperCase().includes('CAJÓN') ||
        b.part.name.toUpperCase().includes('GAVETA') ||
        b.part.id.includes('caj_ind_');
      const isDoor =
        !isDrawer &&
        (b.part.componentRole === 'door' ||
          (b.part.name.toUpperCase().includes('PUERTA') && !b.part.name.toUpperCase().includes('CAJ')));

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
      const isInternalBox =
        b.part.componentRole === 'drawer_box' ||
        b.part.name.toUpperCase().includes('LATERAL') ||
        b.part.name.toUpperCase().includes('COSTADO') ||
        b.part.name.toUpperCase().includes('TRASERA') ||
        b.part.name.toUpperCase().includes('FONDO') ||
        b.part.name.toUpperCase().includes('CONTRAFRENTE') ||
        b.part.name.toUpperCase().includes('INTERIOR');
      const isDrawerFront =
        !isInternalBox &&
        (b.part.componentRole === 'drawer_front' ||
          b.part.hardwareConfig?.movableType === 'drawer' ||
          (b.part.name.toUpperCase().includes('FRENTE') &&
            (b.part.name.toUpperCase().includes('CAJ') || b.part.name.toUpperCase().includes('GAVET'))) ||
          ((b.part.name.toUpperCase().startsWith('CAJ') || b.part.name.toUpperCase().startsWith('GAVET')) &&
            !isInternalBox));

      if (isDrawerFront) {
        const slideHoles = this.generateSlideSystem32Holes(b, boundsList);
        for (const h of slideHoles) {
          drillHolesByPart.get(h.partId)?.push(h);
          allDrillHoles.push(h);
        }
      }
    }

    // 3. Compute 90° Butt Joints between contacting pieces
    for (let i = 0; i < boundsList.length; i++) {
      for (let j = i + 1; j < boundsList.length; j++) {
        const b1 = boundsList[i];
        const b2 = boundsList[j];

        this.analyzeJointContact(b1, b2, drillHolesByPart, allDrillHoles);
      }
    }

    return {
      drillHolesByPart,
      allDrillHoles,
      collisions
    };
  }

  private generateSlideSystem32Holes(drawer: Part3DBounds, allBounds: Part3DBounds[]): DrillHole[] {
    const holes: DrillHole[] = [];
    const slideType = drawer.part.hardwareConfig?.slideType || 'telescopic';
    if (slideType === 'none') return holes;

    // Buscar el costado real de la caja del cajón para alinear las perforaciones Sistema 32 con el eje del riel
    const prefix = drawer.part.id.includes('_frente')
      ? drawer.part.id.split('_frente')[0]
      : drawer.part.id.includes('_front')
        ? drawer.part.id.split('_front')[0]
        : '';

    const matchingBoxSide = allBounds.find(b => {
      if (b.part.id === drawer.part.id) return false;
      const role = b.part.componentRole;
      if (role === 'side_left' || role === 'side_right' || role === 'divider') return false;
      if (prefix && b.part.id.startsWith(prefix) && (b.part.id.includes('lat_izq') || b.part.id.includes('lat_der'))) {
        return true;
      }
      return (
        (role === 'drawer_box' || role === 'drawer_lateral') &&
        b.part.orientation === 'vertical_yz' &&
        Math.abs(b.py - drawer.py) < Math.max(90, drawer.sy * 0.65) &&
        b.minX > drawer.minX &&
        b.maxX < drawer.maxX
      );
    });

    let slideY = matchingBoxSide ? matchingBoxSide.py : drawer.py - drawer.sy * 0.15;
    if (slideType === 'undermount') {
      slideY = matchingBoxSide ? matchingBoxSide.minY + 14 : drawer.minY + 14;
    }

    const verticalSides = allBounds.filter(
      b =>
        b.part.id !== drawer.part.id &&
        b.part.componentRole !== 'drawer_box' &&
        b.part.componentRole !== 'drawer_lateral' &&
        b.sx <= 32 &&
        b.sy >= 150 &&
        drawer.py >= b.minY - 20 &&
        drawer.py <= b.maxY + 20
    );

    const leftFlank = verticalSides
      .filter(b => b.maxX <= drawer.minX + 35 && b.maxX >= drawer.minX - 50)
      .sort((a, b) => b.maxX - a.maxX)[0];

    const rightFlank = verticalSides
      .filter(b => b.minX >= drawer.maxX - 35 && b.minX <= drawer.maxX + 50)
      .sort((a, b) => a.minX - b.minX)[0];

    const flanks = [
      { side: leftFlank, isLeft: true },
      { side: rightFlank, isLeft: false }
    ];

    for (const { side, isLeft } of flanks) {
      if (!side) continue;

      const frontEdgeZ = side.maxZ;
      const holePosX = isLeft ? side.maxX : side.minX;
      const normalAxis = 'x' as const;
      const direction = (isLeft ? -1 : 1) as 1 | -1;

      const spacings = [37, 69, 101, 165, 229, 293];
      const maxReachableDepth = side.sz - 40;

      for (let i = 0; i < spacings.length; i++) {
        const dist = spacings[i];
        if (dist > maxReachableDepth) break;

        const holeZ = frontEdgeZ - dist;
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

    const marginY = Math.min(100, height * 0.15);
    let hingeYs = [b.minY + marginY, b.maxY - marginY];

    if (hingeSide === 'top') {
      hingeYs = [b.maxY - 22];
    } else if (hingeSide === 'bottom') {
      hingeYs = [b.minY + 22];
    } else if (height >= 950) {
      hingeYs.push(b.py);
    }

    const sideText =
      hingeSide === 'right'
        ? 'derecho'
        : hingeSide === 'top'
          ? 'superior'
          : hingeSide === 'bottom'
            ? 'inferior'
            : 'izquierdo';

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

    const contactTolerance = 3.0;
    const overlapX = Math.min(b1.maxX, b2.maxX) - Math.max(b1.minX, b2.minX);
    const overlapZ = Math.min(b1.maxZ, b2.maxZ) - Math.max(b1.minZ, b2.minZ);

    if (overlapZ < 60) return;

    const isSide1 = b1.sx <= 32 && b1.sy >= 60;
    const isSide2 = b2.sx <= 32 && b2.sy >= 60;
    const isShelf1 = b1.sy <= 32 && b1.sx >= 60;
    const isShelf2 = b2.sy <= 32 && b2.sx >= 60;

    if (isSide1 && isShelf2) {
      const side = b1;
      const shelf = b2;
      const touchesLeft = Math.abs(shelf.minX - side.maxX) <= contactTolerance;
      const touchesRight = Math.abs(shelf.maxX - side.minX) <= contactTolerance;

      if (touchesLeft || touchesRight) {
        const contactX = touchesLeft ? side.maxX : side.minX;
        const contactY = Math.max(shelf.minY + 4, Math.min(shelf.maxY - 4, shelf.py));
        const minZ = Math.max(side.minZ, shelf.minZ);
        const maxZ = Math.min(side.maxZ, shelf.maxZ);

        this.distributeScrewAndDowelHoles(side, shelf, 'x', contactX, contactY, minZ, maxZ, drillMap, allDrills);
        return;
      }
    } else if (isSide2 && isShelf1) {
      const side = b2;
      const shelf = b1;
      const touchesLeft = Math.abs(shelf.minX - side.maxX) <= contactTolerance;
      const touchesRight = Math.abs(shelf.maxX - side.minX) <= contactTolerance;

      if (touchesLeft || touchesRight) {
        const contactX = touchesLeft ? side.maxX : side.minX;
        const contactY = Math.max(shelf.minY + 4, Math.min(shelf.maxY - 4, shelf.py));
        const minZ = Math.max(side.minZ, shelf.minZ);
        const maxZ = Math.min(side.maxZ, shelf.maxZ);

        this.distributeScrewAndDowelHoles(side, shelf, 'x', contactX, contactY, minZ, maxZ, drillMap, allDrills);
        return;
      }
    }

    if ((isShelf1 && isSide2) || (isShelf2 && isSide1)) {
      const horizontal = isShelf1 ? b1 : b2;
      const vertical = isShelf1 ? b2 : b1;

      const touchesTop = Math.abs(vertical.minY - horizontal.maxY) <= contactTolerance;
      const touchesBottom = Math.abs(vertical.maxY - horizontal.minY) <= contactTolerance;

      if ((touchesTop || touchesBottom) && overlapX >= 60) {
        const contactY = touchesTop ? horizontal.maxY : horizontal.minY;
        const contactX = Math.max(vertical.minX + 4, Math.min(vertical.maxX - 4, vertical.px));
        const minZ = Math.max(horizontal.minZ, vertical.minZ);
        const maxZ = Math.min(horizontal.maxZ, vertical.maxZ);

        this.distributeScrewAndDowelHoles(
          horizontal,
          vertical,
          'y',
          contactY,
          contactX,
          minZ,
          maxZ,
          drillMap,
          allDrills
        );
      }
    }
  }

  private distributeScrewAndDowelHoles(
    passing: Part3DBounds,
    butt: Part3DBounds,
    axis: 'x' | 'y',
    contactAxisPos: number,
    contactCrossPos: number,
    minZ: number,
    maxZ: number,
    drillMap: Map<string, DrillHole[]>,
    allDrills: DrillHole[]
  ) {
    const contactLen = maxZ - minZ;
    if (contactLen < 70) return;

    const startZ = minZ + Math.min(50, contactLen * 0.18);
    const endZ = maxZ - Math.min(50, contactLen * 0.18);

    const screwZs: number[] = [startZ, endZ];
    const dowelZs: number[] = [];

    if (contactLen >= 320) {
      const midZ = (startZ + endZ) / 2;
      screwZs.push(midZ);
      dowelZs.push((startZ + midZ) / 2);
      dowelZs.push((midZ + endZ) / 2);
    } else {
      dowelZs.push((startZ + endZ) / 2);
    }

    screwZs.forEach((z, idx) => {
      const posX = axis === 'x' ? contactAxisPos : contactCrossPos;
      const posY = axis === 'x' ? contactCrossPos : contactAxisPos;

      const passHole: DrillHole = {
        id: `screw_pass_${passing.part.id}_${butt.part.id}_${idx}`,
        type: 'screw_4x50',
        diameter: 4.5,
        depth: passing.part.thickness || 18,
        posX,
        posY,
        posZ: z,
        normalAxis: axis,
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
        posZ: z,
        normalAxis: axis,
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

    dowelZs.forEach((z, idx) => {
      const posX = axis === 'x' ? contactAxisPos : contactCrossPos;
      const posY = axis === 'x' ? contactCrossPos : contactAxisPos;

      const dowelPassing: DrillHole = {
        id: `dowel_pass_${passing.part.id}_${butt.part.id}_${idx}`,
        type: 'dowel_8x30',
        diameter: 8.0,
        depth: 12.0,
        posX,
        posY,
        posZ: z,
        normalAxis: axis,
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
        posZ: z,
        normalAxis: axis,
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