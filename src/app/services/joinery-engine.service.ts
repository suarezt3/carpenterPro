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

  // Computes precise 3D spatial bounding box of a piece
  getPartBounds(part: Part): Part3DBounds {
    const t = part.thickness || 18;
    const L = part.length;
    const W = part.width;

    let sx = L;
    let sy = t;
    let sz = W;

    const orient = part.orientation || 'horizontal';
    if (orient === 'vertical_yz') {
      sx = t;
      sy = L;
      sz = W;
    } else if (orient === 'vertical_xy') {
      const isDoor = part.componentRole === 'door' || part.name.toUpperCase().includes('PUERTA');
      const isDrawer = part.componentRole === 'drawer_front' || part.name.toUpperCase().includes('CAJÓN') || part.name.toUpperCase().includes('CAJON') || part.name.toUpperCase().includes('GAVETA');
      if (isDoor && L > W) {
        sx = W;
        sy = L;
        sz = t;
      } else if (isDrawer && W > L) {
        sx = W;
        sy = L;
        sz = t;
      } else {
        sx = L;
        sy = W;
        sz = t;
      }
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

  // --- COLLISION DETECTION ENGINE ---
  // Evaluates real-time 3D volumetric penetration between melamines (with 0.8mm clearance tolerance)
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

        // If penetration exceeds tolerance in ALL three axes simultaneously, they collide
        if (overlapX > tolerance && overlapY > tolerance && overlapZ > tolerance) {
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
  // Computes woodworking drilling patterns for screws 4x50, dowels 8x30, and hinge cups 35mm
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

    // 1. Compute Hinge Cup Drill Holes for Door Panels ONLY (Ø35mm) - Strictly exclude drawer fronts
    for (const b of boundsList) {
      const isDrawer = b.part.componentRole === 'drawer_front' ||
                       b.part.name.toUpperCase().includes('CAJON') ||
                       b.part.name.toUpperCase().includes('CAJÓN') ||
                       b.part.name.toUpperCase().includes('GAVETA') ||
                       b.part.id.includes('caj_ind_');
      const isDoor = !isDrawer && (
        b.part.componentRole === 'door' || 
        (b.part.name.toUpperCase().includes('PUERTA') && !b.part.name.toUpperCase().includes('CAJ'))
      );

      if (isDoor && b.sy >= 250) {
        const holes = this.generateDoorHingeHoles(b);
        for (const h of holes) {
          drillHolesByPart.get(b.part.id)?.push(h);
          allDrillHoles.push(h);
        }
      }
    }

    // 2. Compute Technical System 32 Slide Drill Holes on Cabinet Side Panels (at 37mm from front edge)
    for (const b of boundsList) {
      const isDrawer = b.part.componentRole === 'drawer_front' ||
                       b.part.name.toUpperCase().includes('CAJON') ||
                       b.part.name.toUpperCase().includes('CAJÓN') ||
                       b.part.name.toUpperCase().includes('GAVETA');
      if (isDrawer) {
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
    const slideY = drawer.py - (drawer.sy * 0.15); // Center height of drawer slide runner

    // Find flanking cabinet side panels or dividers in the same module / vicinity
    const verticalSides = allBounds.filter(b => 
      b.part.id !== drawer.part.id &&
      b.sx <= 32 && b.sy >= 150 && // Vertical panel
      drawer.py >= b.minY - 20 && drawer.py <= b.maxY + 20
    );

    // Left flank (closest vertical panel to left of drawer)
    const leftFlank = verticalSides
      .filter(b => b.maxX <= drawer.minX + 30 && b.maxX >= drawer.minX - 50)
      .sort((a, b) => b.maxX - a.maxX)[0];

    // Right flank (closest vertical panel to right of drawer)
    const rightFlank = verticalSides
      .filter(b => b.minX >= drawer.maxX - 30 && b.minX <= drawer.maxX + 50)
      .sort((a, b) => a.minX - b.minX)[0];

    const flanks = [
      { side: leftFlank, isLeft: true },
      { side: rightFlank, isLeft: false }
    ];

    for (const { side, isLeft } of flanks) {
      if (!side) continue;

      // Front edge of side panel in Z axis
      const frontEdgeZ = side.maxZ;
      const holePosX = isLeft ? side.maxX : side.minX;
      const normalAxis = 'x' as const;
      const direction = (isLeft ? -1 : 1) as (1 | -1);

      // System 32 hole spacing standard: 37mm setback from front edge, then 32, 64, 128, 192, 256 mm
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

  private generateDoorHingeHoles(b: Part3DBounds): DrillHole[] {
    const holes: DrillHole[] = [];
    const height = b.sy; // Door height

    // Hinges placed on left side of door (or right)
    const hingeOffsetX = b.minX + 22; // 22mm from edge (standard 35mm cup center)
    const marginY = Math.min(100, height * 0.15);

    const hingeYs = [
      b.minY + marginY,
      b.maxY - marginY
    ];

    if (height >= 950) {
      hingeYs.push(b.py); // 3rd intermediate hinge
    }

    for (let i = 0; i < hingeYs.length; i++) {
      const y = hingeYs[i];
      holes.push({
        id: `hinge_${b.part.id}_${i}`,
        type: 'hinge_35',
        diameter: 35,
        depth: 12.5,
        posX: hingeOffsetX,
        posY: y,
        posZ: b.maxZ, // Front face
        normalAxis: 'z',
        direction: 1,
        surfaceType: 'face',
        partId: b.part.id,
        partName: b.part.name,
        description: `Cazoleta bisagra Ø35mm x 12.5mm (a 22mm del borde)`
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
    // Exclude doors, drawer fronts, and non-structural decorative parts from carcass joint drilling
    const isMovable1 = b1.part.componentRole === 'door' || b1.part.componentRole === 'drawer_front' || 
                       b1.part.name.toUpperCase().includes('PUERTA') || b1.part.name.toUpperCase().includes('CAJON') ||
                       b1.part.name.toUpperCase().includes('CAJÓN') || b1.part.name.toUpperCase().includes('GAVETA') ||
                       b1.part.name.toUpperCase().includes('FRENTE');
    const isMovable2 = b2.part.componentRole === 'door' || b2.part.componentRole === 'drawer_front' || 
                       b2.part.name.toUpperCase().includes('PUERTA') || b2.part.name.toUpperCase().includes('CAJON') ||
                       b2.part.name.toUpperCase().includes('CAJÓN') || b2.part.name.toUpperCase().includes('GAVETA') ||
                       b2.part.name.toUpperCase().includes('FRENTE');
    if (isMovable1 || isMovable2) return;

    const contactTolerance = 3.0; // mm contact tolerance

    const overlapX = Math.min(b1.maxX, b2.maxX) - Math.max(b1.minX, b2.minX);
    const overlapZ = Math.min(b1.maxZ, b2.maxZ) - Math.max(b1.minZ, b2.minZ);

    if (overlapZ < 60) return;

    // --- CASE 1: X-JOINT (Vertical Side / Divider meeting Horizontal Shelf / Tie) ---
    // One piece has thickness along X (sx <= 32) and the other has thickness along Y (sy <= 32)
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

        this.distributeScrewAndDowelHoles(
          side,
          shelf,
          'x',
          contactX,
          contactY,
          minZ,
          maxZ,
          drillMap,
          allDrills
        );
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

        this.distributeScrewAndDowelHoles(
          side,
          shelf,
          'x',
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

    // --- CASE 2: Y-JOINT (Horizontal Top/Bottom Panel meeting Vertical Side or Divider) ---
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

  // Generates 4x50mm screws at 50mm from ends + 8x30mm dowels for alignment
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
      dowelZs.push((startZ + endZ) / 2); // 1 central dowel
    }

    // Screws (4x50mm)
    screwZs.forEach((z, idx) => {
      const posX = axis === 'x' ? contactAxisPos : contactCrossPos;
      const posY = axis === 'x' ? contactCrossPos : contactAxisPos;

      // 1. Passing Hole on passing panel (Ø4.5mm pasante con avellanado)
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

      // 2. Guide Hole on butting edge (Ø3.0mm x 40mm)
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

    // Dowels (8x30mm)
    dowelZs.forEach((z, idx) => {
      const posX = axis === 'x' ? contactAxisPos : contactCrossPos;
      const posY = axis === 'x' ? contactCrossPos : contactAxisPos;

      const dowelPassing: DrillHole = {
        id: `dowel_pass_${passing.part.id}_${butt.part.id}_${idx}`,
        type: 'dowel_8x30',
        diameter: 8.0,
        depth: 12.0, // 12mm depth into face
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
        depth: 20.0, // 20mm depth into edge
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
