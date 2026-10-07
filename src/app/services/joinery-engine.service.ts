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

    // 1. Compute Hinge Cup Drill Holes for Door Panels (Ø35mm)
    for (const b of boundsList) {
      const isDoor = b.part.componentRole === 'door' || 
                     b.part.name.toUpperCase().includes('PUERTA') || 
                     b.part.name.toUpperCase().includes('FRENTE');
      if (isDoor && b.sy >= 250) {
        const holes = this.generateDoorHingeHoles(b);
        for (const h of holes) {
          drillHolesByPart.get(b.part.id)?.push(h);
          allDrillHoles.push(h);
        }
      }
    }

    // 2. Compute 90° Butt Joints between contacting pieces
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
    const contactTolerance = 2.5; // mm contact tolerance

    // Check Case A: b1 face in X touches b2 edge in X
    // (e.g. vertical side b1 touching horizontal shelf b2 edge)
    const overlapZ = Math.min(b1.maxZ, b2.maxZ) - Math.max(b1.minZ, b2.minZ);
    const overlapX = Math.min(b1.maxX, b2.maxX) - Math.max(b1.minX, b2.minX);

    // X-Contact: shelf edge touches side face
    const leftTouch = Math.abs(b2.minX - b1.maxX) <= contactTolerance;
    const rightTouch = Math.abs(b2.maxX - b1.minX) <= contactTolerance;

    if ((leftTouch || rightTouch) && overlapZ >= 80) {
      // b1 is the passing panel (side), b2 is the butt panel (shelf)
      const passing = leftTouch ? b1 : b2;
      const butt = leftTouch ? b2 : b1;
      const contactX = leftTouch ? b1.maxX : b1.minX;
      const contactY = butt.py; // Mid-thickness of shelf

      this.distributeScrewAndDowelHoles(
        passing,
        butt,
        'x',
        contactX,
        contactY,
        Math.max(b1.minZ, b2.minZ),
        Math.min(b1.maxZ, b2.maxZ),
        drillMap,
        allDrills
      );
      return;
    }

    // Y-Contact: shelf face touches vertical divider top/bottom, or bottom panel touching side bottom
    const topTouch = Math.abs(b2.minY - b1.maxY) <= contactTolerance;
    const bottomTouch = Math.abs(b2.maxY - b1.minY) <= contactTolerance;

    if ((topTouch || bottomTouch) && overlapZ >= 80 && overlapX >= 80) {
      // Horizontal joint along Y
      const passing = topTouch ? b2 : b1;
      const butt = topTouch ? b1 : b2;
      const contactY = topTouch ? b1.maxY : b1.minY;
      const contactX = butt.px;

      this.distributeScrewAndDowelHoles(
        passing,
        butt,
        'y',
        contactX,
        contactY,
        Math.max(b1.minZ, b2.minZ),
        Math.min(b1.maxZ, b2.maxZ),
        drillMap,
        allDrills
      );
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
