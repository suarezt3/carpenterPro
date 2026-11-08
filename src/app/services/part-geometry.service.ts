import { Injectable } from '@angular/core';
import * as THREE from 'three';
import {
  DrawerFrontMountType,
  ModuleCavityInfo,
  Part,
  PartCornerCutConfig,
  PartGroup
} from '../models/melamine.models';

export interface PartLocalDimensions {
  sx: number;
  sy: number;
  sz: number;
  lengthLocalAxis: 'x' | 'y' | 'z';
  widthLocalAxis: 'x' | 'y' | 'z';
  thicknessLocalAxis: 'x' | 'y' | 'z';
}

export interface PartStretchAxesWorld {
  lengthAxisWorld: THREE.Vector3;
  widthAxisWorld: THREE.Vector3;
  thicknessAxisWorld: THREE.Vector3;
  localDims: PartLocalDimensions;
}

export interface PartWorldOBB {
  part: Part;
  center: { x: number; y: number; z: number };
  halfSize: { x: number; y: number; z: number };
  axes: [
    { x: number; y: number; z: number },
    { x: number; y: number; z: number },
    { x: number; y: number; z: number }
  ];
  localDims: PartLocalDimensions;
}

export interface PartWorldAABB {
  part: Part;
  px: number;
  py: number;
  pz: number;
  sx: number;
  sy: number;
  sz: number;
  localSx: number;
  localSy: number;
  localSz: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface CountertopCutoutHole {
  localX: number;
  localZ: number;
  holeW: number;
  holeD: number;
}

/**
 * Fuente única de verdad para la geometría local, ejes de estiramiento 3D,
 * cajas orientadas (OBB), cajas envolventes (AABB), extrusión de tableros con
 * cortes especiales y detección exacta de colisiones.
 */
@Injectable({
  providedIn: 'root'
})
export class PartGeometryService {
  // Objetos scratch reutilizables para evitar asignaciones de memoria en bucles de 60 FPS
  private readonly scratchEuler = new THREE.Euler(0, 0, 0, 'XYZ');
  private readonly scratchQuat = new THREE.Quaternion();
  private readonly scratchAxisX = new THREE.Vector3();
  private readonly scratchAxisY = new THREE.Vector3();
  private readonly scratchAxisZ = new THREE.Vector3();

  /**
   * Determina de forma puramente determinista por rol (sin heurísticas dinámicas L > W)
   * si una pieza en orientación `vertical_yz` mapea su `length` al eje Z (profundidad)
   * y su `width` al eje Y (altura), como ocurre en zócalos laterales, costados de cajón y salpicaderos laterales.
   */
  isDepthLengthVerticalYZ(part: Part): boolean {
    if ((part.orientation || 'horizontal') !== 'vertical_yz') {
      return false;
    }
    const role = part.componentRole;
    if (
      role === 'plinth' ||
      role === 'drawer_box' ||
      role === 'drawer_lateral' ||
      role === 'backsplash'
    ) {
      return true;
    }
    if (
      role === 'side_left' ||
      role === 'side_right' ||
      role === 'divider' ||
      role === 'door' ||
      role === 'drawer_front' ||
      role === 'back' ||
      role === 'top' ||
      role === 'bottom' ||
      role === 'shelf' ||
      role === 'countertop' ||
      role === 'tie'
    ) {
      return false;
    }
    // Fallback determinista por nombre únicamente para piezas antiguas sin componentRole explícito
    const nameUpper = (part.name || '').toUpperCase();
    return (
      nameUpper.includes('SALPICADERO') ||
      nameUpper.includes('ZOCALO') ||
      nameUpper.includes('ZÓCALO') ||
      (nameUpper.includes('LATERAL') && nameUpper.includes('CAJ'))
    );
  }

  /**
   * Calcula las dimensiones locales exactas (sx, sy, sz) antes de aplicar rotaciones Euler (rx, ry, rz)
   * y el eje local al que corresponde cada dimensión paramétrica (length, width, thickness).
   */
  getLocalDimensions(part: Part): PartLocalDimensions {
    const t = Math.max(1, part.thickness || 18);
    const l = Math.max(1, part.length || 1);
    const w = Math.max(1, part.width || 1);
    const orient = part.orientation || 'horizontal';

    if (orient === 'horizontal') {
      return {
        sx: l,
        sy: t,
        sz: w,
        lengthLocalAxis: 'x',
        widthLocalAxis: 'z',
        thicknessLocalAxis: 'y'
      };
    }

    if (orient === 'vertical_xy') {
      return {
        sx: l,
        sy: w,
        sz: t,
        lengthLocalAxis: 'x',
        widthLocalAxis: 'y',
        thicknessLocalAxis: 'z'
      };
    }

    // vertical_yz
    if (this.isDepthLengthVerticalYZ(part)) {
      return {
        sx: t,
        sy: w,
        sz: l,
        lengthLocalAxis: 'z',
        widthLocalAxis: 'y',
        thicknessLocalAxis: 'x'
      };
    }

    return {
      sx: t,
      sy: l,
      sz: w,
      lengthLocalAxis: 'y',
      widthLocalAxis: 'z',
      thicknessLocalAxis: 'x'
    };
  }

  /**
   * Calcula los vectores unitarios en espacio mundo correspondientes a `length`, `width` y `thickness`,
   * aplicando las rotaciones Euler de la pieza (`rotationX`, `rotationY`, `rotationZ`).
   * Acepta un contenedor `out` pre-alojado para cero asignaciones en `pointermove`.
   */
  getStretchAxesInWorld(part: Part, out?: PartStretchAxesWorld): PartStretchAxesWorld {
    const localDims = this.getLocalDimensions(part);
    const rx = THREE.MathUtils.degToRad(part.rotationX || 0);
    const ry = THREE.MathUtils.degToRad(part.rotationY || 0);
    const rz = THREE.MathUtils.degToRad(part.rotationZ || 0);

    this.scratchEuler.set(rx, ry, rz, 'XYZ');
    this.scratchQuat.setFromEuler(this.scratchEuler);

    const target: PartStretchAxesWorld = out ?? {
      lengthAxisWorld: new THREE.Vector3(),
      widthAxisWorld: new THREE.Vector3(),
      thicknessAxisWorld: new THREE.Vector3(),
      localDims
    };
    target.localDims = localDims;

    this.setCanonicalAxis(target.lengthAxisWorld, localDims.lengthLocalAxis).applyQuaternion(this.scratchQuat).normalize();
    this.setCanonicalAxis(target.widthAxisWorld, localDims.widthLocalAxis).applyQuaternion(this.scratchQuat).normalize();
    this.setCanonicalAxis(target.thicknessAxisWorld, localDims.thicknessLocalAxis).applyQuaternion(this.scratchQuat).normalize();

    return target;
  }

  /**
   * Devuelve la Caja Orientada (Oriented Bounding Box - OBB) exacta en espacio mundo.
   */
  getWorldOBB(
    part: Part,
    overridePos?: { x?: number; y?: number; z?: number }
  ): PartWorldOBB {
    const localDims = this.getLocalDimensions(part);
    const hx = localDims.sx / 2;
    const hy = localDims.sy / 2;
    const hz = localDims.sz / 2;

    const rx = THREE.MathUtils.degToRad(part.rotationX || 0);
    const ry = THREE.MathUtils.degToRad(part.rotationY || 0);
    const rz = THREE.MathUtils.degToRad(part.rotationZ || 0);

    this.scratchEuler.set(rx, ry, rz, 'XYZ');
    this.scratchQuat.setFromEuler(this.scratchEuler);

    this.scratchAxisX.set(1, 0, 0).applyQuaternion(this.scratchQuat);
    this.scratchAxisY.set(0, 1, 0).applyQuaternion(this.scratchQuat);
    this.scratchAxisZ.set(0, 0, 1).applyQuaternion(this.scratchQuat);

    const worldHalfY =
      Math.abs(this.scratchAxisX.y) * hx +
      Math.abs(this.scratchAxisY.y) * hy +
      Math.abs(this.scratchAxisZ.y) * hz;

    const px = overridePos?.x ?? part.posX ?? 0;
    const py = overridePos?.y ?? part.posY ?? worldHalfY;
    const pz = overridePos?.z ?? part.posZ ?? 0;

    return {
      part,
      center: { x: px, y: py, z: pz },
      halfSize: { x: hx, y: hy, z: hz },
      axes: [
        { x: this.scratchAxisX.x, y: this.scratchAxisX.y, z: this.scratchAxisX.z },
        { x: this.scratchAxisY.x, y: this.scratchAxisY.y, z: this.scratchAxisY.z },
        { x: this.scratchAxisZ.x, y: this.scratchAxisZ.y, z: this.scratchAxisZ.z }
      ],
      localDims
    };
  }

  /**
   * Devuelve la Caja Envolvente Alineada a los Ejes del Mundo (World AABB) exacta,
   * considerando tanto la orientación como cualquier rotación Euler arbitraria (0°, 45°, 90°, 180°).
   */
  getWorldAABB(
    part: Part,
    overridePos?: { x?: number; y?: number; z?: number }
  ): PartWorldAABB {
    const localDims = this.getLocalDimensions(part);

    if (part.shapeType === 'circle') {
      const r = part.radius || (part.diameter ? part.diameter / 2 : Math.max(10, (part.width || 600) / 2));
      const h = part.thickness || 18;
      const sx = r * 2;
      const sy = h;
      const sz = r * 2;
      const px = overridePos?.x ?? part.posX ?? 0;
      const py = overridePos?.y ?? part.posY ?? sy / 2;
      const pz = overridePos?.z ?? part.posZ ?? 0;
      return {
        part,
        px,
        py,
        pz,
        sx,
        sy,
        sz,
        localSx: sx,
        localSy: sy,
        localSz: sz,
        minX: px - sx / 2,
        maxX: px + sx / 2,
        minY: py - sy / 2,
        maxY: py + sy / 2,
        minZ: pz - sz / 2,
        maxZ: pz + sz / 2
      };
    }

    const hx = localDims.sx / 2;
    const hy = localDims.sy / 2;
    const hz = localDims.sz / 2;

    const rx = part.rotationX || 0;
    const ry = part.rotationY || 0;
    const rz = part.rotationZ || 0;

    let worldHalfX = hx;
    let worldHalfY = hy;
    let worldHalfZ = hz;

    if (rx !== 0 || ry !== 0 || rz !== 0) {
      this.scratchEuler.set(
        THREE.MathUtils.degToRad(rx),
        THREE.MathUtils.degToRad(ry),
        THREE.MathUtils.degToRad(rz),
        'XYZ'
      );
      this.scratchQuat.setFromEuler(this.scratchEuler);
      this.scratchAxisX.set(1, 0, 0).applyQuaternion(this.scratchQuat);
      this.scratchAxisY.set(0, 1, 0).applyQuaternion(this.scratchQuat);
      this.scratchAxisZ.set(0, 0, 1).applyQuaternion(this.scratchQuat);

      worldHalfX =
        Math.abs(this.scratchAxisX.x) * hx +
        Math.abs(this.scratchAxisY.x) * hy +
        Math.abs(this.scratchAxisZ.x) * hz;
      worldHalfY =
        Math.abs(this.scratchAxisX.y) * hx +
        Math.abs(this.scratchAxisY.y) * hy +
        Math.abs(this.scratchAxisZ.y) * hz;
      worldHalfZ =
        Math.abs(this.scratchAxisX.z) * hx +
        Math.abs(this.scratchAxisY.z) * hy +
        Math.abs(this.scratchAxisZ.z) * hz;
    }

    const sx = worldHalfX * 2;
    const sy = worldHalfY * 2;
    const sz = worldHalfZ * 2;

    const px = overridePos?.x ?? part.posX ?? 0;
    const py = overridePos?.y ?? part.posY ?? worldHalfY;
    const pz = overridePos?.z ?? part.posZ ?? 0;

    return {
      part,
      px,
      py,
      pz,
      sx,
      sy,
      sz,
      localSx: localDims.sx,
      localSy: localDims.sy,
      localSz: localDims.sz,
      minX: px - worldHalfX,
      maxX: px + worldHalfX,
      minY: py - worldHalfY,
      maxY: py + worldHalfY,
      minZ: pz - worldHalfZ,
      maxZ: pz + worldHalfZ
    };
  }

  /**
   * Construye el polígono 2D exacto (contourPoints en mm, origen x: 0..length de izq a der,
   * y: 0..width desde el frente +Z hacia el fondo -Z) para cortes especiales de tablero.
   */
  buildCornerCutContour(
    length: number,
    width: number,
    config: PartCornerCutConfig
  ): { x: number; y: number }[] {
    const L = Math.max(50, Number(length) || 600);
    const W = Math.max(50, Number(width) || 600);
    const cx = Math.max(15, Math.min(L * 0.75, Number(config.cutX) || 150));
    const cy = Math.max(15, Math.min(W * 0.75, Number(config.cutY) || 150));
    const corner = config.corner || 'front_right';

    if (config.type === 'chamfer_corner') {
      if (corner === 'front_right') {
        return [
          { x: 0, y: 0 },
          { x: L - cx, y: 0 },
          { x: L, y: cy },
          { x: L, y: W },
          { x: 0, y: W }
        ];
      }
      if (corner === 'front_left') {
        return [
          { x: cx, y: 0 },
          { x: L, y: 0 },
          { x: L, y: W },
          { x: 0, y: W },
          { x: 0, y: cy }
        ];
      }
      if (corner === 'back_right') {
        return [
          { x: 0, y: 0 },
          { x: L, y: 0 },
          { x: L, y: W - cy },
          { x: L - cx, y: W },
          { x: 0, y: W }
        ];
      }
      if (corner === 'back_left') {
        return [
          { x: 0, y: 0 },
          { x: L, y: 0 },
          { x: L, y: W },
          { x: cx, y: W },
          { x: 0, y: W - cy }
        ];
      }
      if (corner === 'both_front') {
        return [
          { x: cx, y: 0 },
          { x: L - cx, y: 0 },
          { x: L, y: cy },
          { x: L, y: W },
          { x: 0, y: W },
          { x: 0, y: cy }
        ];
      }
      return [
        { x: cx, y: 0 },
        { x: L - cx, y: 0 },
        { x: L, y: cy },
        { x: L, y: W - cy },
        { x: L - cx, y: W },
        { x: cx, y: W },
        { x: 0, y: W - cy },
        { x: 0, y: cy }
      ];
    }

    if (config.type === 'diagonal_side') {
      if (corner === 'front_left' || corner === 'back_left') {
        return [
          { x: cx, y: 0 },
          { x: L, y: 0 },
          { x: L, y: W },
          { x: 0, y: W }
        ];
      }
      return [
        { x: 0, y: 0 },
        { x: L - cx, y: 0 },
        { x: L, y: W },
        { x: 0, y: W }
      ];
    }

    if (config.type === 'notch_l') {
      if (corner === 'front_right') {
        return [
          { x: 0, y: 0 },
          { x: L - cx, y: 0 },
          { x: L - cx, y: cy },
          { x: L, y: cy },
          { x: L, y: W },
          { x: 0, y: W }
        ];
      }
      if (corner === 'front_left') {
        return [
          { x: cx, y: 0 },
          { x: L, y: 0 },
          { x: L, y: W },
          { x: 0, y: W },
          { x: 0, y: cy },
          { x: cx, y: cy }
        ];
      }
      if (corner === 'back_left') {
        return [
          { x: 0, y: 0 },
          { x: L, y: 0 },
          { x: L, y: W },
          { x: cx, y: W },
          { x: cx, y: W - cy },
          { x: 0, y: W - cy }
        ];
      }
      return [
        { x: 0, y: 0 },
        { x: L, y: 0 },
        { x: L, y: W - cy },
        { x: L - cx, y: W - cy },
        { x: L - cx, y: W },
        { x: 0, y: W }
      ];
    }

    if (config.type === 'rounded_corners') {
      const r = Math.max(15, Math.min(L * 0.45, W * 0.45, cx));
      const steps = 6;
      const pts: { x: number; y: number }[] = [];
      const addArc = (centerX: number, centerY: number, startAngle: number, endAngle: number) => {
        for (let i = 0; i <= steps; i++) {
          const a = startAngle + ((endAngle - startAngle) * i) / steps;
          pts.push({
            x: Math.round((centerX + Math.cos(a) * r) * 10) / 10,
            y: Math.round((centerY + Math.sin(a) * r) * 10) / 10
          });
        }
      };

      const roundFL = corner === 'front_left' || corner === 'both_front' || corner === 'all';
      const roundFR = corner === 'front_right' || corner === 'both_front' || corner === 'all';
      const roundBR = corner === 'back_right' || corner === 'all';
      const roundBL = corner === 'back_left' || corner === 'all';

      if (roundFL) addArc(r, r, Math.PI, Math.PI * 1.5);
      else pts.push({ x: 0, y: 0 });

      if (roundFR) addArc(L - r, r, Math.PI * 1.5, Math.PI * 2);
      else pts.push({ x: L, y: 0 });

      if (roundBR) addArc(L - r, W - r, 0, Math.PI * 0.5);
      else pts.push({ x: L, y: W });

      if (roundBL) addArc(r, W - r, Math.PI * 0.5, Math.PI);
      else pts.push({ x: 0, y: W });

      return pts;
    }

    if (config.type === 'u_siphon_cutout') {
      const sx = Math.max(20, Math.min(L - 40, Number(config.cutX) || 200));
      const sy = Math.max(20, Math.min(W - 20, Number(config.cutY) || 250));
      const xLeft = (L - sx) / 2;
      const xRight = (L + sx) / 2;
      return [
        { x: 0, y: 0 },
        { x: L, y: 0 },
        { x: L, y: W },
        { x: xRight, y: W },
        { x: xRight, y: W - sy },
        { x: xLeft, y: W - sy },
        { x: xLeft, y: W },
        { x: 0, y: W }
      ];
    }

    return [
      { x: 0, y: 0 },
      { x: L, y: 0 },
      { x: L, y: W },
      { x: 0, y: W }
    ];
  }

  /**
   * Construye la geometría 3D extruida de un tablero con cortes especiales (`cornerCutConfig` / `contourPoints`)
   * y/o perforaciones booleanas (`cutouts` de lavaplatos o estufas).
   *
   * Garantías geométricas:
   * 1. Siempre extruye con `depth: part.thickness` (jamás `localDims.sy`, evitando bloques de 720 mm de espesor).
   * 2. Alinea `y = 0` del contorno al frente `+Z` y `y = W` al fondo `-Z` (corrigiendo inversión frente/fondo).
   * 3. Rota canónicamente según `part.orientation` (`horizontal`, `vertical_xy`, `vertical_yz`) centrando el origen en (0,0,0).
   */
  buildExtrudedBoardGeometry(
    part: Part,
    cutouts: CountertopCutoutHole[] = []
  ): THREE.BufferGeometry {
    const t = Math.max(1, part.thickness || 18);
    const L = Math.max(1, part.length || 1);
    const W = Math.max(1, part.width || 1);
    const orient = part.orientation || 'horizontal';

    const contour2D = this.getCenteredContour2D(part, L, W);
    if (THREE.ShapeUtils.isClockWise(contour2D)) {
      contour2D.reverse();
    }

    const shape = new THREE.Shape(contour2D);

    // Perforaciones booleanas 2D para mesones horizontales (lavaplatos / cubiertas de cocción)
    if (orient === 'horizontal' && cutouts.length > 0) {
      const halfL = L / 2;
      const halfW = W / 2;
      for (const hole of cutouts) {
        const hx0 = Math.max(-halfL + 15, hole.localX - hole.holeW / 2);
        const hx1 = Math.min(halfL - 15, hole.localX + hole.holeW / 2);
        const hz0 = Math.max(-halfW + 15, hole.localZ - hole.holeD / 2);
        const hz1 = Math.min(halfW - 15, hole.localZ + hole.holeD / 2);
        if (hx1 - hx0 > 40 && hz1 - hz0 > 40) {
          // Sentido horario (CW) para agujeros internos respecto al contorno exterior CCW
          const holePts = [
            new THREE.Vector2(hx0, hz0),
            new THREE.Vector2(hx0, hz1),
            new THREE.Vector2(hx1, hz1),
            new THREE.Vector2(hx1, hz0)
          ];
          const holePath = new THREE.Path(holePts);
          holePath.closePath();
          shape.holes.push(holePath);
        }
      }
    }

    const extrudeGeom = new THREE.ExtrudeGeometry(shape, {
      depth: t,
      bevelEnabled: false
    });

    // Centrar espesor de extrusión en [-t/2, +t/2]
    extrudeGeom.translate(0, 0, -t / 2);

    if (orient === 'horizontal') {
      // (u, v, z) -> (u, -z, v): X in [-L/2, +L/2], Y in [-t/2, +t/2], Z = v in [-W/2, +W/2] (frente en +Z)
      extrudeGeom.rotateX(Math.PI / 2);
    } else if (orient === 'vertical_yz') {
      if (this.isDepthLengthVerticalYZ(part)) {
        // (u, v, z) -> (-z, v, u): X in [-t/2, +t/2], Y = v in [-W/2, +W/2], Z = u in [-L/2, +L/2]
        extrudeGeom.rotateY(-Math.PI / 2);
      } else {
        // (u, v, z) -> (z, u, v): X in [-t/2, +t/2], Y = u in [-L/2, +L/2], Z = v in [-W/2, +W/2] (frente en +Z)
        extrudeGeom.rotateZ(Math.PI / 2);
        extrudeGeom.rotateY(Math.PI / 2);
      }
    }
    // Para vertical_xy: (u, v, z) ya está en X in [-L/2, +L/2], Y in [-W/2, +W/2], Z in [-t/2, +t/2]

    extrudeGeom.computeVertexNormals();
    extrudeGeom.computeBoundingBox();
    return extrudeGeom;
  }

  /**
   * Evalúa si dos piezas se interpenetran físicamente más allá de `toleranceMm`,
   * usando:
   * 1. Filtro rápido AABB en espacio mundo.
   * 2. Teorema de Ejes Separadores (SAT 3D sobre OBB) para piezas rotadas a cualquier ángulo (ej. 45°).
   * 3. Refinamiento exacto por triangulación 2D en el plano XZ cuando alguna pieza horizontal posee
   *    cortes especiales (`cornerCutConfig` / `contourPoints`), evitando falsos positivos en destajes en L o chaflanes.
   */
  arePartsCollidingOBB(
    partA: Part,
    partB: Part,
    toleranceMm = 1.5,
    precomputedA?: PartWorldAABB,
    precomputedB?: PartWorldAABB
  ): { colliding: boolean; overlapVolume: number; penetrationMm: number } {
    const aabbA = precomputedA ?? this.getWorldAABB(partA);
    const aabbB = precomputedB ?? this.getWorldAABB(partB);

    const aabbOverlapX = Math.min(aabbA.maxX, aabbB.maxX) - Math.max(aabbA.minX, aabbB.minX);
    const aabbOverlapY = Math.min(aabbA.maxY, aabbB.maxY) - Math.max(aabbA.minY, aabbB.minY);
    const aabbOverlapZ = Math.min(aabbA.maxZ, aabbB.maxZ) - Math.max(aabbA.minZ, aabbB.minZ);

    if (
      aabbOverlapX <= toleranceMm ||
      aabbOverlapY <= toleranceMm ||
      aabbOverlapZ <= toleranceMm
    ) {
      return { colliding: false, overlapVolume: 0, penetrationMm: 0 };
    }

    const obbA = this.getWorldOBB(partA);
    const obbB = this.getWorldOBB(partB);

    const dx = obbB.center.x - obbA.center.x;
    const dy = obbB.center.y - obbA.center.y;
    const dz = obbB.center.z - obbA.center.z;

    const axesToTest: { x: number; y: number; z: number }[] = [
      obbA.axes[0],
      obbA.axes[1],
      obbA.axes[2],
      obbB.axes[0],
      obbB.axes[1],
      obbB.axes[2]
    ];

    // Productos cruz entre aristas de A y aristas de B (9 ejes adicionales del SAT 3D completo)
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const ax = obbA.axes[i];
        const bx = obbB.axes[j];
        const cx = ax.y * bx.z - ax.z * bx.y;
        const cy = ax.z * bx.x - ax.x * bx.z;
        const cz = ax.x * bx.y - ax.y * bx.x;
        const len = Math.hypot(cx, cy, cz);
        if (len > 1e-4) {
          axesToTest.push({ x: cx / len, y: cy / len, z: cz / len });
        }
      }
    }

    let minPenetration = Infinity;
    for (const axis of axesToTest) {
      const rA =
        obbA.halfSize.x * Math.abs(this.dot3(obbA.axes[0], axis)) +
        obbA.halfSize.y * Math.abs(this.dot3(obbA.axes[1], axis)) +
        obbA.halfSize.z * Math.abs(this.dot3(obbA.axes[2], axis));
      const rB =
        obbB.halfSize.x * Math.abs(this.dot3(obbB.axes[0], axis)) +
        obbB.halfSize.y * Math.abs(this.dot3(obbB.axes[1], axis)) +
        obbB.halfSize.z * Math.abs(this.dot3(obbB.axes[2], axis));

      const dist = Math.abs(dx * axis.x + dy * axis.y + dz * axis.z);
      const pen = rA + rB - dist;
      if (pen <= toleranceMm) {
        return { colliding: false, overlapVolume: 0, penetrationMm: 0 };
      }
      if (pen < minPenetration) {
        minPenetration = pen;
      }
    }

    // Refinamiento poligonal 2D XZ si alguna pieza tiene corte especial (chaflán, diagonal o destaje en L)
    if (this.hasCustomContour(partA) || this.hasCustomContour(partB)) {
      const trisA = this.getWorldXZTriangles(partA, obbA);
      const trisB = this.getWorldXZTriangles(partB, obbB);
      if (trisA && trisB) {
        let maxPairPen = 0;
        for (const tA of trisA) {
          for (const tB of trisB) {
            const pen2d = this.convexPolygonPenetration2D(tA, tB);
            if (pen2d > maxPairPen) {
              maxPairPen = pen2d;
            }
          }
        }
        if (maxPairPen <= toleranceMm) {
          return { colliding: false, overlapVolume: 0, penetrationMm: 0 };
        }
        minPenetration = Math.min(minPenetration, maxPairPen);
      }
    }

    const approxVolume = Math.round(
      Math.min(
        aabbOverlapX * aabbOverlapY * aabbOverlapZ,
        obbA.localDims.sx * obbA.localDims.sy * obbA.localDims.sz,
        obbB.localDims.sx * obbB.localDims.sy * obbB.localDims.sz
      )
    );

    return {
      colliding: true,
      overlapVolume: Math.max(1, approxVolume),
      penetrationMm: Math.round(minPenetration * 10) / 10
    };
  }

  hasCustomContour(part: Part): boolean {
    return (
      (!!part.cornerCutConfig && part.cornerCutConfig.type !== 'none') ||
      (part.shapeType === 'freehand' && !!part.contourPoints && part.contourPoints.length >= 3)
    );
  }

  private getCenteredContour2D(part: Part, L: number, W: number): THREE.Vector2[] {
    if (part.cornerCutConfig && part.cornerCutConfig.type !== 'none') {
      const rawPts = this.buildCornerCutContour(L, W, part.cornerCutConfig);
      return rawPts.map(pt => new THREE.Vector2(pt.x - L / 2, W / 2 - pt.y));
    }

    if (part.shapeType === 'freehand' && part.contourPoints && part.contourPoints.length >= 3) {
      const pts = part.contourPoints;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const pt of pts) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }

      // Convención [0..L, 0..W] con y=0 en frente (+Z) y y=W en fondo (-Z)
      if (minX >= -1 && minY >= -1) {
        return pts.map(pt => new THREE.Vector2(pt.x - L / 2, W / 2 - pt.y));
      }

      // Compatibilidad con contornos antiguos ya centrados alrededor de (0, 0)
      const midX = (minX + maxX) / 2;
      const midY = (minY + maxY) / 2;
      return pts.map(pt => new THREE.Vector2(pt.x - midX, -(pt.y - midY)));
    }

    const halfL = L / 2;
    const halfW = W / 2;
    return [
      new THREE.Vector2(-halfL, -halfW),
      new THREE.Vector2(halfL, -halfW),
      new THREE.Vector2(halfL, halfW),
      new THREE.Vector2(-halfL, halfW)
    ];
  }

  private getWorldXZTriangles(
    part: Part,
    obb: PartWorldOBB
  ): { x: number; z: number }[][] | null {
    if ((part.rotationX || 0) !== 0 || (part.rotationZ || 0) !== 0) {
      return null;
    }

    const ry = THREE.MathUtils.degToRad(part.rotationY || 0);
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);
    const cx = obb.center.x;
    const cz = obb.center.z;

    const toWorldXZ = (lx: number, lz: number): { x: number; z: number } => ({
      // Rotación Euler Y en Three.js: worldX = cx + lx*cos(ry) + lz*sin(ry), worldZ = cz - lx*sin(ry) + lz*cos(ry)
      x: cx + lx * cosY + lz * sinY,
      z: cz - lx * sinY + lz * cosY
    });

    if ((part.orientation || 'horizontal') === 'horizontal' && this.hasCustomContour(part)) {
      const L = Math.max(1, part.length || 1);
      const W = Math.max(1, part.width || 1);
      const contour = this.getCenteredContour2D(part, L, W);
      if (THREE.ShapeUtils.isClockWise(contour)) {
        contour.reverse();
      }
      // En horizontal: rotateX(+PI/2) mapea (u, v) -> (localX = u, localZ = v)
      const faces = THREE.ShapeUtils.triangulateShape(contour, []);
      if (faces.length > 0) {
        return faces.map(([i0, i1, i2]) => [
          toWorldXZ(contour[i0].x, contour[i0].y),
          toWorldXZ(contour[i1].x, contour[i1].y),
          toWorldXZ(contour[i2].x, contour[i2].y)
        ]);
      }
    }

    // Huella rectangular XZ de la OBB dividida en 2 triángulos
    const hx = obb.halfSize.x;
    const hz = obb.halfSize.z;
    const p0 = toWorldXZ(-hx, -hz);
    const p1 = toWorldXZ(hx, -hz);
    const p2 = toWorldXZ(hx, hz);
    const p3 = toWorldXZ(-hx, hz);
    return [
      [p0, p1, p2],
      [p0, p2, p3]
    ];
  }

  private convexPolygonPenetration2D(
    polyA: { x: number; z: number }[],
    polyB: { x: number; z: number }[]
  ): number {
    let minOverlap = Infinity;
    const polygons = [polyA, polyB];

    for (const poly of polygons) {
      const len = poly.length;
      for (let i = 0; i < len; i++) {
        const p0 = poly[i];
        const p1 = poly[(i + 1) % len];
        const ex = p1.x - p0.x;
        const ez = p1.z - p0.z;
        const edgeLen = Math.hypot(ex, ez);
        if (edgeLen < 1e-5) continue;

        const nx = -ez / edgeLen;
        const nz = ex / edgeLen;

        let minA = Infinity;
        let maxA = -Infinity;
        for (const p of polyA) {
          const proj = p.x * nx + p.z * nz;
          if (proj < minA) minA = proj;
          if (proj > maxA) maxA = proj;
        }

        let minB = Infinity;
        let maxB = -Infinity;
        for (const p of polyB) {
          const proj = p.x * nx + p.z * nz;
          if (proj < minB) minB = proj;
          if (proj > maxB) maxB = proj;
        }

        const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);
        if (overlap <= 0) {
          return 0;
        }
        if (overlap < minOverlap) {
          minOverlap = overlap;
        }
      }
    }

    return minOverlap === Infinity ? 0 : minOverlap;
  }

  private setCanonicalAxis(target: THREE.Vector3, axis: 'x' | 'y' | 'z'): THREE.Vector3 {
    if (axis === 'x') return target.set(1, 0, 0);
    if (axis === 'y') return target.set(0, 1, 0);
    return target.set(0, 0, 1);
  }

  private dot3(
    a: { x: number; y: number; z: number },
    b: { x: number; y: number; z: number }
  ): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  /**
   * Detecta colisiones físicas entre una lista de piezas usando el SAT 3D OBB y contornos 2D.
   */
  detectCollisions(
    parts: Part[],
    toleranceMm = 1.5
  ): { partA: Part; partB: Part; penetrationMm: number; overlapVolume: number }[] {
    const collisions: { partA: Part; partB: Part; penetrationMm: number; overlapVolume: number }[] = [];
    if (!parts || parts.length < 2) return collisions;
    const aabbs = parts.map(p => this.getWorldAABB(p));

    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const res = this.arePartsCollidingOBB(parts[i], parts[j], toleranceMm, aabbs[i], aabbs[j]);
        if (res.colliding) {
          collisions.push({
            partA: parts[i],
            partB: parts[j],
            penetrationMm: res.penetrationMm,
            overlapVolume: res.overlapVolume
          });
        }
      }
    }
    return collisions;
  }

  /**
   * Determina si una pieza es un entrepaño o repisa interna horizontal perteneciente a un módulo.
   */
  isInternalShelf(part: Part): boolean {
    if (!part?.groupId) return false;
    const role = part.componentRole;
    if (role === 'shelf') return true;
    if (
      role === 'top' ||
      role === 'bottom' ||
      role === 'countertop' ||
      role === 'backsplash' ||
      role === 'plinth' ||
      role === 'side_left' ||
      role === 'side_right' ||
      role === 'back' ||
      role === 'door' ||
      role === 'divider' ||
      role === 'tie'
    ) {
      return false;
    }
    const name = (part.name || '').toLowerCase();
    if (
      name.includes('repisa') ||
      name.includes('entrepaño') ||
      name.includes('entrepano') ||
      name.includes('estante') ||
      name.includes('balda') ||
      name.includes('shelf')
    ) {
      return true;
    }
    if (
      part.orientation === 'horizontal' &&
      (role === 'drawer_box' || name.includes('cajón') || name.includes('cajon'))
    ) {
      return true;
    }
    return false;
  }

  /**
   * Determina si una pieza es un divisor vertical interno perteneciente a un módulo.
   */
  isInternalDivider(part: Part): boolean {
    if (!part?.groupId) return false;
    const role = part.componentRole;
    if (role === 'divider') return true;
    if (
      role === 'side_left' ||
      role === 'side_right' ||
      role === 'top' ||
      role === 'bottom' ||
      role === 'back' ||
      role === 'door' ||
      role === 'countertop' ||
      role === 'backsplash' ||
      role === 'plinth' ||
      role === 'tie' ||
      role === 'shelf'
    ) {
      return false;
    }
    const name = (part.name || '').toLowerCase();
    if (name.includes('divisor') || name.includes('separador') || name.includes('tabique')) {
      return true;
    }
    if (
      (part.orientation === 'vertical_yz' || part.orientation === 'vertical_xy') &&
      !name.includes('lateral') &&
      !name.includes('costado') &&
      !name.includes('zócalo') &&
      !name.includes('zocalo') &&
      !name.includes('fondo') &&
      !name.includes('puerta')
    ) {
      return true;
    }
    return false;
  }

  /**
   * Calcula el centro exacto de la cavidad interna (en X y Z) para una repisa dentro de su módulo.
   * Respeta la orientación del módulo a 0°, 90°, 180° y 270°, y auto-detecta las caras internas de los costados o divisores adyacentes.
   */
  getModuleCavityCenter(part: Part, allParts: Part[]): { x: number; z: number } | null {
    if (!part?.groupId) return null;
    const groupParts = allParts.filter(p => p.groupId === part.groupId);
    if (groupParts.length < 2) return null;

    const partBounds = this.getWorldAABB(part);

    const sLeft = groupParts.find(p => p.componentRole === 'side_left');
    const sRight = groupParts.find(p => p.componentRole === 'side_right');

    const yzSides = groupParts.filter(
      p => p.orientation === 'vertical_yz' &&
      p.componentRole !== 'plinth' &&
      p.componentRole !== 'back' &&
      p.componentRole !== 'door' &&
      p.componentRole !== 'drawer_front' &&
      p.componentRole !== 'drawer_lateral' &&
      p.componentRole !== 'drawer_box' &&
      !p.name.toLowerCase().includes('zocalo') &&
      !p.name.toLowerCase().includes('zócalo') &&
      !p.name.toLowerCase().includes('fondo')
    );

    const xySides = groupParts.filter(
      p => p.orientation === 'vertical_xy' &&
      p.componentRole !== 'plinth' &&
      p.componentRole !== 'back' &&
      p.componentRole !== 'door' &&
      p.componentRole !== 'drawer_front' &&
      p.componentRole !== 'drawer_lateral' &&
      p.componentRole !== 'drawer_box' &&
      !p.name.toLowerCase().includes('zocalo') &&
      !p.name.toLowerCase().includes('zócalo') &&
      !p.name.toLowerCase().includes('fondo')
    );

    const isRotatedWidthZ = (sLeft?.orientation === 'vertical_xy' || sRight?.orientation === 'vertical_xy')
      || (xySides.length >= 2 && xySides.length >= yzSides.length);

    if (isRotatedWidthZ) {
      let leftMaxZ = -Infinity;
      let rightMinZ = Infinity;

      for (const p of xySides) {
        if (p.id === part.id) continue;
        const pb = this.getWorldAABB(p);
        const overlapY = Math.min(partBounds.maxY, pb.maxY) - Math.max(partBounds.minY, pb.minY);
        if (overlapY > 15 || pb.sy > 300) {
          if (pb.maxZ <= (part.posZ ?? 0) + 15 && pb.maxZ > leftMaxZ) {
            leftMaxZ = pb.maxZ;
          }
          if (pb.minZ >= (part.posZ ?? 0) - 15 && pb.minZ < rightMinZ) {
            rightMinZ = pb.minZ;
          }
        }
      }

      if (leftMaxZ === -Infinity || rightMinZ === Infinity) {
        if (sLeft && sRight && sLeft.orientation === 'vertical_xy') {
          const bL = this.getWorldAABB(sLeft);
          const bR = this.getWorldAABB(sRight);
          leftMaxZ = Math.min(bL.maxZ, bR.maxZ);
          rightMinZ = Math.max(bL.minZ, bR.minZ);
        } else if (xySides.length >= 2) {
          const sorted = [...xySides].sort((a, b) => (a.posZ ?? 0) - (b.posZ ?? 0));
          leftMaxZ = this.getWorldAABB(sorted[0]).maxZ;
          rightMinZ = this.getWorldAABB(sorted[sorted.length - 1]).minZ;
        } else {
          let minZ = Infinity, maxZ = -Infinity;
          for (const gp of groupParts) {
            const gb = this.getWorldAABB(gp);
            if (gb.minZ < minZ) minZ = gb.minZ;
            if (gb.maxZ > maxZ) maxZ = gb.maxZ;
          }
          const t = part.thickness || 18;
          leftMaxZ = minZ + t;
          rightMinZ = maxZ - t;
        }
      }

      const cavityZ = Math.round(((leftMaxZ + rightMinZ) / 2) * 10) / 10;
      const cavityX = part.posX ?? 0;

      return { x: cavityX, z: cavityZ };
    } else {
      let leftMaxX = -Infinity;
      let rightMinX = Infinity;

      for (const p of yzSides) {
        if (p.id === part.id) continue;
        const pb = this.getWorldAABB(p);
        const overlapY = Math.min(partBounds.maxY, pb.maxY) - Math.max(partBounds.minY, pb.minY);
        if (overlapY > 15 || pb.sy > 300) {
          if (pb.maxX <= (part.posX ?? 0) + 15 && pb.maxX > leftMaxX) {
            leftMaxX = pb.maxX;
          }
          if (pb.minX >= (part.posX ?? 0) - 15 && pb.minX < rightMinX) {
            rightMinX = pb.minX;
          }
        }
      }

      if (leftMaxX === -Infinity || rightMinX === Infinity) {
        if (sLeft && sRight && sLeft.orientation === 'vertical_yz') {
          const bL = this.getWorldAABB(sLeft);
          const bR = this.getWorldAABB(sRight);
          leftMaxX = Math.min(bL.maxX, bR.maxX);
          rightMinX = Math.max(bL.minX, bR.minX);
        } else if (yzSides.length >= 2) {
          const sorted = [...yzSides].sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));
          leftMaxX = this.getWorldAABB(sorted[0]).maxX;
          rightMinX = this.getWorldAABB(sorted[sorted.length - 1]).minX;
        } else {
          let minX = Infinity, maxX = -Infinity;
          for (const gp of groupParts) {
            const gb = this.getWorldAABB(gp);
            if (gb.minX < minX) minX = gb.minX;
            if (gb.maxX > maxX) maxX = gb.maxX;
          }
          const t = part.thickness || 18;
          leftMaxX = minX + t;
          rightMinX = maxX - t;
        }
      }

      const cavityX = Math.round(((leftMaxX + rightMinX) / 2) * 10) / 10;
      const cavityZ = part.posZ ?? 0;

      return { x: cavityX, z: cavityZ };
    }
  }

  /**
   * Encuentra el vano vertical libre más grande dentro del módulo para posicionar un nuevo entrepaño en su centro exacto.
   */
  findLargestVerticalGap(part: Part, allParts: Part[]): { gapBottom: number; gapTop: number; bestY: number } {
    const defaultY = (part.posY ?? 0) + 150;
    if (!part?.groupId) {
      return { gapBottom: part.posY ?? 0, gapTop: defaultY, bestY: defaultY };
    }
    const groupParts = allParts.filter(p => p.groupId === part.groupId);
    if (groupParts.length === 0) {
      return { gapBottom: part.posY ?? 0, gapTop: defaultY, bestY: defaultY };
    }

    const partBounds = this.getWorldAABB(part);

    const columnParts = groupParts.filter(p => {
      const pb = this.getWorldAABB(p);
      const overlapX = Math.min(partBounds.maxX, pb.maxX) - Math.max(partBounds.minX, pb.minX);
      const overlapZ = Math.min(partBounds.maxZ, pb.maxZ) - Math.max(partBounds.minZ, pb.minZ);
      return overlapX > 15 && overlapZ > 15;
    });

    const bottomPart = groupParts.find(p => p.componentRole === 'bottom') ||
      columnParts.filter(p => p.orientation === 'horizontal' && p.componentRole !== 'top' && p.componentRole !== 'tie' && !this.isInternalShelf(p))
                 .sort((a, b) => (a.posY ?? 0) - (b.posY ?? 0))[0];

    const floorTopY = bottomPart ? this.getWorldAABB(bottomPart).maxY : (partBounds.minY - 300);

    const topPart = groupParts.find(p => p.componentRole === 'top' || p.componentRole === 'tie') ||
      columnParts.filter(p => p.orientation === 'horizontal' && p.componentRole !== 'bottom' && p.componentRole !== 'plinth' && !this.isInternalShelf(p))
                 .sort((a, b) => (b.posY ?? 0) - (a.posY ?? 0))[0];

    let roofBottomY = topPart ? this.getWorldAABB(topPart).minY : Infinity;
    if (roofBottomY === Infinity) {
      const sides = groupParts.filter(p => p.orientation === 'vertical_yz' || p.orientation === 'vertical_xy');
      if (sides.length > 0) {
        roofBottomY = Math.max(...sides.map(s => this.getWorldAABB(s).maxY));
      } else {
        roofBottomY = partBounds.maxY + 300;
      }
    }

    const shelvesInColumn = columnParts.filter(p => {
      if (bottomPart && p.id === bottomPart.id) return false;
      if (topPart && p.id === topPart.id) return false;
      return this.isInternalShelf(p);
    });

    if (!shelvesInColumn.some(p => p.id === part.id)) {
      shelvesInColumn.push(part);
    }

    const shelfBoundsList = shelvesInColumn
      .map(s => this.getWorldAABB(s))
      .sort((a, b) => a.minY - b.minY);

    interface Gap {
      bottom: number;
      top: number;
      height: number;
    }
    const gaps: Gap[] = [];

    gaps.push({
      bottom: floorTopY,
      top: shelfBoundsList[0].minY,
      height: shelfBoundsList[0].minY - floorTopY
    });

    for (let i = 0; i < shelfBoundsList.length - 1; i++) {
      const b = shelfBoundsList[i].maxY;
      const t = shelfBoundsList[i + 1].minY;
      gaps.push({
        bottom: b,
        top: t,
        height: t - b
      });
    }

    gaps.push({
      bottom: shelfBoundsList[shelfBoundsList.length - 1].maxY,
      top: roofBottomY,
      height: roofBottomY - shelfBoundsList[shelfBoundsList.length - 1].maxY
    });

    let bestGap = gaps[0];
    for (let i = 1; i < gaps.length; i++) {
      if (gaps[i].height >= bestGap.height) {
        bestGap = gaps[i];
      }
    }

    const bestY = Math.round((bestGap.bottom + bestGap.top) / 2);
    return {
      gapBottom: Math.round(bestGap.bottom),
      gapTop: Math.round(bestGap.top),
      bestY
    };
  }

  /**
   * Encuentra el hueco horizontal libre más grande dentro del módulo para posicionar un nuevo divisor vertical en su centro exacto.
   */
  findLargestHorizontalGap(part: Part, allParts: Part[]): { gapMin: number; gapMax: number; bestPos: number; axis: 'x' | 'z' } {
    const partBounds = this.getWorldAABB(part);
    const defaultX = (part.posX ?? 0) + 150;
    if (!part?.groupId) {
      return { gapMin: part.posX ?? 0, gapMax: defaultX, bestPos: defaultX, axis: 'x' };
    }
    const groupParts = allParts.filter(p => p.groupId === part.groupId);
    if (groupParts.length === 0) {
      return { gapMin: part.posX ?? 0, gapMax: defaultX, bestPos: defaultX, axis: 'x' };
    }

    const sLeft = groupParts.find(p => p.componentRole === 'side_left');
    const sRight = groupParts.find(p => p.componentRole === 'side_right');

    const isWidthZ = part.orientation === 'vertical_xy' ||
      sLeft?.orientation === 'vertical_xy' ||
      sRight?.orientation === 'vertical_xy';

    if (isWidthZ) {
      const xyPanels = groupParts.filter(p => {
        if (
          p.componentRole === 'plinth' ||
          p.componentRole === 'back' ||
          p.componentRole === 'door' ||
          p.componentRole === 'drawer_front' ||
          p.componentRole === 'drawer_lateral' ||
          p.componentRole === 'drawer_box' ||
          p.name.toLowerCase().includes('zocalo') ||
          p.name.toLowerCase().includes('zócalo') ||
          p.name.toLowerCase().includes('fondo')
        ) return false;
        return p.orientation === 'vertical_xy';
      });

      const dividers = xyPanels.filter(p => this.isInternalDivider(p));
      if (!dividers.some(p => p.id === part.id)) {
        dividers.push(part);
      }
      dividers.sort((a, b) => (a.posZ ?? 0) - (b.posZ ?? 0));

      const sides = xyPanels.filter(p => !this.isInternalDivider(p));
      let minBoundaryZ = -Infinity;
      let maxBoundaryZ = Infinity;
      if (sLeft && sRight && sLeft.orientation === 'vertical_xy') {
        const bL = this.getWorldAABB(sLeft);
        const bR = this.getWorldAABB(sRight);
        minBoundaryZ = Math.min(bL.maxZ, bR.maxZ);
        maxBoundaryZ = Math.max(bL.minZ, bR.minZ);
      } else if (sides.length >= 2) {
        sides.sort((a, b) => (a.posZ ?? 0) - (b.posZ ?? 0));
        minBoundaryZ = this.getWorldAABB(sides[0]).maxZ;
        maxBoundaryZ = this.getWorldAABB(sides[sides.length - 1]).minZ;
      } else {
        minBoundaryZ = (part.posZ ?? 0) - 300;
        maxBoundaryZ = (part.posZ ?? 0) + 300;
      }

      const gaps: { min: number; max: number; size: number }[] = [];
      const dBounds = dividers.map(d => this.getWorldAABB(d));

      gaps.push({ min: minBoundaryZ, max: dBounds[0].minZ, size: dBounds[0].minZ - minBoundaryZ });
      for (let i = 0; i < dBounds.length - 1; i++) {
        gaps.push({
          min: dBounds[i].maxZ,
          max: dBounds[i + 1].minZ,
          size: dBounds[i + 1].minZ - dBounds[i].maxZ
        });
      }
      gaps.push({
        min: dBounds[dBounds.length - 1].maxZ,
        max: maxBoundaryZ,
        size: maxBoundaryZ - dBounds[dBounds.length - 1].maxZ
      });

      let bestGap = gaps[0];
      for (let i = 1; i < gaps.length; i++) {
        if (gaps[i].size >= bestGap.size) {
          bestGap = gaps[i];
        }
      }
      return {
        gapMin: Math.round(bestGap.min),
        gapMax: Math.round(bestGap.max),
        bestPos: Math.round((bestGap.min + bestGap.max) / 2),
        axis: 'z'
      };
    } else {
      const yzPanels = groupParts.filter(p => {
        if (
          p.componentRole === 'plinth' ||
          p.componentRole === 'back' ||
          p.componentRole === 'door' ||
          p.componentRole === 'drawer_front' ||
          p.componentRole === 'drawer_lateral' ||
          p.componentRole === 'drawer_box' ||
          p.name.toLowerCase().includes('zocalo') ||
          p.name.toLowerCase().includes('zócalo') ||
          p.name.toLowerCase().includes('fondo')
        ) return false;
        return p.orientation === 'vertical_yz';
      });

      const dividers = yzPanels.filter(p => this.isInternalDivider(p));
      if (!dividers.some(p => p.id === part.id)) {
        dividers.push(part);
      }
      dividers.sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));

      const sides = yzPanels.filter(p => !this.isInternalDivider(p));
      let minBoundaryX = -Infinity;
      let maxBoundaryX = Infinity;
      if (sLeft && sRight && sLeft.orientation === 'vertical_yz') {
        const bL = this.getWorldAABB(sLeft);
        const bR = this.getWorldAABB(sRight);
        minBoundaryX = Math.min(bL.maxX, bR.maxX);
        maxBoundaryX = Math.max(bL.minX, bR.minX);
      } else if (sides.length >= 2) {
        sides.sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));
        minBoundaryX = this.getWorldAABB(sides[0]).maxX;
        maxBoundaryX = this.getWorldAABB(sides[sides.length - 1]).minX;
      } else {
        minBoundaryX = (part.posX ?? 0) - 300;
        maxBoundaryX = (part.posX ?? 0) + 300;
      }

      const gaps: { min: number; max: number; size: number }[] = [];
      const dBounds = dividers.map(d => this.getWorldAABB(d));

      gaps.push({ min: minBoundaryX, max: dBounds[0].minX, size: dBounds[0].minX - minBoundaryX });
      for (let i = 0; i < dBounds.length - 1; i++) {
        gaps.push({
          min: dBounds[i].maxX,
          max: dBounds[i + 1].minX,
          size: dBounds[i + 1].minX - dBounds[i].maxX
        });
      }
      gaps.push({
        min: dBounds[dBounds.length - 1].maxX,
        max: maxBoundaryX,
        size: maxBoundaryX - dBounds[dBounds.length - 1].maxX
      });

      let bestGap = gaps[0];
      for (let i = 1; i < gaps.length; i++) {
        if (gaps[i].size >= bestGap.size) {
          bestGap = gaps[i];
        }
      }
      return {
        gapMin: Math.round(bestGap.min),
        gapMax: Math.round(bestGap.max),
        bestPos: Math.round((bestGap.min + bestGap.max) / 2),
        axis: 'x'
      };
    }
  }

  /**
   * Calcula el largo óptimo de corredera comercial (300, 350, 400, 450 o 500 mm)
   * que cabe en la profundidad interna útil sin chocar con el fondo trasero,
   * descontando el espesor del frente cuando el montaje es a ras ('inset').
   */
  getOptimalCommercialSlideLength(
    internalDepth: number,
    frontMountOrSetback: DrawerFrontMountType | number = 'overlay',
    frontThickness = 15
  ): number {
    const commercialSizes = [500, 450, 400, 350, 300];
    const setback =
      typeof frontMountOrSetback === 'number'
        ? frontMountOrSetback
        : frontMountOrSetback === 'inset'
          ? Math.max(12, frontThickness || 15)
          : frontMountOrSetback === 'none'
            ? 5
            : 0;
    const maxSafeLength = internalDepth - setback - 3;
    for (const size of commercialSizes) {
      if (size <= maxSafeLength) {
        return size;
      }
    }
    const maxExactLength = internalDepth - setback;
    for (const size of commercialSizes) {
      if (size <= maxExactLength) {
        return size;
      }
    }
    return 300;
  }

  /**
   * Detecta automáticamente todas las cavidades/vanos verticales libres (Luces Internas)
   * dentro de un módulo existente, soportando divisiones verticales, entrepaños y las 4 orientaciones.
   */
  detectModuleCavities(
    groupOrId: string | PartGroup,
    allParts: Part[],
    groupOrName?: PartGroup | string
  ): ModuleCavityInfo[] {
    const groupId = typeof groupOrId === 'string' ? groupOrId : groupOrId?.id;
    const group: PartGroup | undefined =
      typeof groupOrId === 'object'
        ? groupOrId
        : typeof groupOrName === 'object'
          ? groupOrName
          : undefined;
    const customModuleName = typeof groupOrName === 'string' ? groupOrName : undefined;

    if (!groupId) return [];
    if (
      group &&
      (group.type === 'drawer' ||
        group.subType === 'drawer' ||
        group.templateId === 'modular_drawer')
    ) {
      return [];
    }

    const groupParts = allParts.filter(p => p.groupId === groupId);
    if (groupParts.length < 2) return [];

    // Excluir grupos que solo contienen piezas de cajón
    const nonDrawerParts = groupParts.filter(
      p =>
        p.componentRole !== 'drawer_box' &&
        p.componentRole !== 'drawer_front' &&
        p.componentRole !== 'drawer_bottom' &&
        p.componentRole !== 'drawer_lateral'
    );
    if (nonDrawerParts.length < 2) return [];

    const sLeft = nonDrawerParts.find(p => p.componentRole === 'side_left');
    const sRight = nonDrawerParts.find(p => p.componentRole === 'side_right');

    // Determinar si el ancho del módulo corre en X (lados en vertical_yz) o en Z (lados en vertical_xy)
    const yzStructural = nonDrawerParts.filter(
      p =>
        p.orientation === 'vertical_yz' &&
        p.componentRole !== 'plinth' &&
        p.componentRole !== 'back' &&
        p.componentRole !== 'door' &&
        p.componentRole !== 'backsplash'
    );
    const xyStructural = nonDrawerParts.filter(
      p =>
        p.orientation === 'vertical_xy' &&
        p.componentRole !== 'plinth' &&
        p.componentRole !== 'back' &&
        p.componentRole !== 'door' &&
        p.componentRole !== 'backsplash'
    );

    let isWidthZ = false;
    if (group?.facingDirection === 'right' || group?.facingDirection === 'left') {
      isWidthZ = true;
    } else if (group?.facingDirection === 'front' || group?.facingDirection === 'back') {
      isWidthZ = false;
    } else if (sLeft && sRight) {
      isWidthZ = sLeft.orientation === 'vertical_xy' || sRight.orientation === 'vertical_xy';
    } else {
      isWidthZ = xyStructural.length >= 2 && yzStructural.length < 2;
    }

    const verticalPanels = isWidthZ ? xyStructural : yzStructural;
    if (verticalPanels.length < 2) return [];

    const panelBounds = verticalPanels
      .map(p => ({ part: p, aabb: this.getWorldAABB(p) }))
      .sort((a, b) =>
        isWidthZ
          ? (a.aabb.minZ + a.aabb.maxZ) / 2 - (b.aabb.minZ + b.aabb.maxZ) / 2
          : (a.aabb.minX + a.aabb.maxX) / 2 - (b.aabb.minX + b.aabb.maxX) / 2
      );

    // Determinar orientación frontal exacta del módulo
    const backPart = nonDrawerParts.find(
      p =>
        p.componentRole === 'back' ||
        p.name.toLowerCase().includes('fondo') ||
        p.name.toLowerCase().includes('trasera')
    );
    const backAABB = backPart ? this.getWorldAABB(backPart) : null;

    let facingDirection: 'front' | 'right' | 'back' | 'left' =
      group?.facingDirection ?? (isWidthZ ? 'right' : 'front');

    if (!group?.facingDirection && backAABB) {
      const firstSide = panelBounds[0].aabb;
      const lastSide = panelBounds[panelBounds.length - 1].aabb;
      if (isWidthZ) {
        const modCenterX = (Math.min(firstSide.minX, lastSide.minX) + Math.max(firstSide.maxX, lastSide.maxX)) / 2;
        facingDirection = backAABB.px <= modCenterX ? 'right' : 'left';
      } else {
        const modCenterZ = (Math.min(firstSide.minZ, lastSide.minZ) + Math.max(firstSide.maxZ, lastSide.maxZ)) / 2;
        facingDirection = backAABB.pz <= modCenterZ ? 'front' : 'back';
      }
    }

    const rotationY =
      facingDirection === 'right'
        ? 90
        : facingDirection === 'back'
          ? 180
          : facingDirection === 'left'
            ? 270
            : 0;

    const moduleName = customModuleName || group?.name || 'Módulo';
    const cavities: ModuleCavityInfo[] = [];

    // Recorrer cada columna horizontal formada por pares adyacentes de paneles verticales (laterales y divisores)
    for (let colIdx = 0; colIdx < panelBounds.length - 1; colIdx++) {
      const leftPanel = panelBounds[colIdx];
      const rightPanel = panelBounds[colIdx + 1];

      const spanMin = isWidthZ ? leftPanel.aabb.maxZ : leftPanel.aabb.maxX;
      const spanMax = isWidthZ ? rightPanel.aabb.minZ : rightPanel.aabb.minX;
      const innerWidth = Math.round((spanMax - spanMin) * 10) / 10;
      if (innerWidth < 120) continue;

      const leftSideThickness = Math.round((isWidthZ ? leftPanel.aabb.sz : leftPanel.aabb.sx) * 10) / 10;
      const rightSideThickness = Math.round((isWidthZ ? rightPanel.aabb.sz : rightPanel.aabb.sx) * 10) / 10;

      // Coordenadas de profundidad en esta columna
      let frontEdgeCoord = 0;
      let backInnerCoord = 0;
      if (facingDirection === 'front') {
        frontEdgeCoord = Math.max(leftPanel.aabb.maxZ, rightPanel.aabb.maxZ);
        const sideMinZ = Math.min(leftPanel.aabb.minZ, rightPanel.aabb.minZ);
        backInnerCoord = backAABB ? Math.max(sideMinZ, backAABB.maxZ) : sideMinZ;
      } else if (facingDirection === 'back') {
        frontEdgeCoord = Math.min(leftPanel.aabb.minZ, rightPanel.aabb.minZ);
        const sideMaxZ = Math.max(leftPanel.aabb.maxZ, rightPanel.aabb.maxZ);
        backInnerCoord = backAABB ? Math.min(sideMaxZ, backAABB.minZ) : sideMaxZ;
      } else if (facingDirection === 'right') {
        frontEdgeCoord = Math.max(leftPanel.aabb.maxX, rightPanel.aabb.maxX);
        const sideMinX = Math.min(leftPanel.aabb.minX, rightPanel.aabb.minX);
        backInnerCoord = backAABB ? Math.max(sideMinX, backAABB.maxX) : sideMinX;
      } else {
        frontEdgeCoord = Math.min(leftPanel.aabb.minX, rightPanel.aabb.minX);
        const sideMaxX = Math.max(leftPanel.aabb.maxX, rightPanel.aabb.maxX);
        backInnerCoord = backAABB ? Math.min(sideMaxX, backAABB.minX) : sideMaxX;
      }

      const internalDepth = Math.round(Math.max(150, Math.abs(frontEdgeCoord - backInnerCoord)));
      const optimalSlideLength = this.getOptimalCommercialSlideLength(internalDepth, 'overlay', leftSideThickness);

      // Encontrar piezas horizontales que se solapan con esta columna
      const horizPartsInCol = nonDrawerParts
        .filter(
          p =>
            p.orientation === 'horizontal' &&
            p.componentRole !== 'plinth' &&
            p.componentRole !== 'countertop'
        )
        .map(p => ({ part: p, aabb: this.getWorldAABB(p) }))
        .filter(item => {
          const itemMin = isWidthZ ? item.aabb.minZ : item.aabb.minX;
          const itemMax = isWidthZ ? item.aabb.maxZ : item.aabb.maxX;
          const overlap = Math.min(spanMax, itemMax) - Math.max(spanMin, itemMin);
          return overlap > 20;
        });

      const bottomCandidates = horizPartsInCol
        .filter(item => item.part.componentRole === 'bottom' || (!this.isInternalShelf(item.part) && item.part.componentRole !== 'top' && item.part.componentRole !== 'tie'))
        .sort((a, b) => a.aabb.minY - b.aabb.minY);

      const topCandidates = horizPartsInCol
        .filter(item => item.part.componentRole === 'top' || item.part.componentRole === 'tie' || (!this.isInternalShelf(item.part) && item.part.componentRole !== 'bottom'))
        .sort((a, b) => b.aabb.maxY - a.aabb.maxY);

      const panelMinY = Math.max(leftPanel.aabb.minY, rightPanel.aabb.minY);
      const panelMaxY = Math.min(leftPanel.aabb.maxY, rightPanel.aabb.maxY);

      const floorTopY =
        bottomCandidates.length > 0
          ? Math.max(panelMinY, bottomCandidates[0].aabb.maxY)
          : panelMinY;

      const roofBottomY =
        topCandidates.length > 0 && topCandidates[0].aabb.minY > floorTopY + 60
          ? Math.min(panelMaxY, topCandidates[0].aabb.minY)
          : panelMaxY;

      if (roofBottomY - floorTopY < 70) continue;

      // Entrepaños internos en esta columna
      const shelvesInCol = horizPartsInCol
        .filter(
          item =>
            this.isInternalShelf(item.part) &&
            item.aabb.minY > floorTopY + 30 &&
            item.aabb.maxY < roofBottomY - 30
        )
        .sort((a, b) => a.aabb.minY - b.aabb.minY);

      const yIntervals: { minY: number; maxY: number }[] = [];
      if (shelvesInCol.length === 0) {
        yIntervals.push({ minY: floorTopY, maxY: roofBottomY });
      } else {
        yIntervals.push({ minY: floorTopY, maxY: shelvesInCol[0].aabb.minY });
        for (let i = 0; i < shelvesInCol.length - 1; i++) {
          yIntervals.push({
            minY: shelvesInCol[i].aabb.maxY,
            maxY: shelvesInCol[i + 1].aabb.minY
          });
        }
        yIntervals.push({
          minY: shelvesInCol[shelvesInCol.length - 1].aabb.maxY,
          maxY: roofBottomY
        });
      }

      const spanCenter = Math.round(((spanMin + spanMax) / 2) * 10) / 10;
      const depthCenter = Math.round(((frontEdgeCoord + backInnerCoord) / 2) * 10) / 10;
      const centerX = isWidthZ ? depthCenter : spanCenter;
      const centerZ = isWidthZ ? spanCenter : depthCenter;

      const validIntervals = yIntervals.filter(iv => iv.maxY - iv.minY >= 70);
      validIntervals.forEach((iv, rowIdx) => {
        const minY = Math.round(iv.minY * 10) / 10;
        const maxY = Math.round(iv.maxY * 10) / 10;
        const height = Math.round((maxY - minY) * 10) / 10;
        const colLabel = panelBounds.length > 2 ? `Col ${colIdx + 1} · ` : '';
        const rowLabel =
          validIntervals.length === 1
            ? 'Vano Principal'
            : rowIdx === 0
              ? 'Vano Inferior'
              : rowIdx === validIntervals.length - 1
                ? 'Vano Superior'
                : `Vano Central ${rowIdx}`;

        const roundedFrontEdge = Math.round(frontEdgeCoord * 10) / 10;
        cavities.push({
          id: `${groupId}_cav_${colIdx}_${rowIdx}`,
          groupId,
          moduleId: groupId,
          moduleName,
          groupName: moduleName,
          bayIndex: colIdx,
          verticalIndex: rowIdx,
          totalInBay: validIntervals.length,
          label: `${colLabel}${rowLabel} (${Math.round(innerWidth)} × ${Math.round(height)} × ${Math.round(internalDepth)} mm)`,
          centerX,
          centerY: Math.round(((minY + maxY) / 2) * 10) / 10,
          centerZ,
          minY,
          maxY,
          height,
          internalHeight: height,
          innerWidth,
          internalWidth: innerWidth,
          internalDepth,
          optimalSlideLength,
          leftSideThickness,
          rightSideThickness,
          sideThickness: leftSideThickness,
          lateralThickness: leftSideThickness,
          frontEdgeCoord: roundedFrontEdge,
          frontPlaneZ: roundedFrontEdge,
          backInnerCoord: Math.round(backInnerCoord * 10) / 10,
          facingDirection,
          rotationY
        });
      });
    }

    return cavities;
  }

  /**
   * Detecta todas las cavidades/vanos de todos los muebles de la escena actual.
   */
  detectAllSceneCavities(allParts: Part[], groups: PartGroup[]): ModuleCavityInfo[] {
    const result: ModuleCavityInfo[] = [];
    for (const group of groups) {
      if (
        group.type === 'drawer' ||
        group.subType === 'drawer' ||
        group.templateId === 'modular_drawer'
      ) {
        continue;
      }
      const groupCavities = this.detectModuleCavities(group.id, allParts, group);
      result.push(...groupCavities);
    }
    return result;
  }
}
