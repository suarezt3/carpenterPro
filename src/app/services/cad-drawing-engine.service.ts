import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { Part } from '../models/melamine.models';
import {
  CadGuide,
  CadHoveredFace,
  CadFacePartition
} from '../models/cad-tools.models';

@Injectable({
  providedIn: 'root'
})
export class CadDrawingEngineService {

  // Reusable scratch vectors to ensure zero allocations during pointer events
  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly v3 = new THREE.Vector3();
  private readonly normalVec = new THREE.Vector3();

  /**
   * Construye el grupo Three.js para la visualización de todas las Guías de Referencia CAD activas.
   * - Puntos Auxiliares: Cruces técnicas nítidas (+) de 14mm con centro en bajorrelieve.
   * - Líneas Guía: Trazos punteados (LineDashedMaterial) en azul técnico cyan (#0284c7 / #38bdf8).
   * - Guías Angulares: Trazos orientados con indicación de grados.
   */
  buildGuidesGroup(guides: CadGuide[]): THREE.Group {
    const group = new THREE.Group();
    group.name = 'cad_guides_root';
    if (!guides || guides.length === 0) return group;

    const guideColor = 0x0284c7; // Azul técnico CAD
    const dashMat = new THREE.LineDashedMaterial({
      color: guideColor,
      dashSize: 10,
      gapSize: 6,
      depthTest: false,
      transparent: true,
      opacity: 0.85
    });

    const crossMat = new THREE.LineBasicMaterial({
      color: 0x0284c7,
      depthTest: false,
      linewidth: 2,
      transparent: true,
      opacity: 0.95
    });

    for (const g of guides) {
      const origin = new THREE.Vector3(g.origin.x, g.origin.y, g.origin.z);

      // 1. Marca de Punto Auxiliar (+)
      const s = 7; // Semilongitud del brazo de la cruz (14 mm total)
      let ptsCross: THREE.Vector3[] = [];

      if (g.faceNormal) {
        this.normalVec.set(g.faceNormal.x, g.faceNormal.y, g.faceNormal.z).normalize();
        // Construir dos ejes tangentes ortogonales a la normal de la cara
        let tangent1 = new THREE.Vector3(1, 0, 0);
        if (Math.abs(this.normalVec.x) > 0.9) tangent1.set(0, 1, 0);
        tangent1.cross(this.normalVec).normalize();
        const tangent2 = new THREE.Vector3().crossVectors(this.normalVec, tangent1).normalize();

        ptsCross = [
          origin.clone().addScaledVector(tangent1, -s), origin.clone().addScaledVector(tangent1, s),
          origin.clone().addScaledVector(tangent2, -s), origin.clone().addScaledVector(tangent2, s)
        ];
      } else {
        ptsCross = [
          new THREE.Vector3(origin.x - s, origin.y, origin.z), new THREE.Vector3(origin.x + s, origin.y, origin.z),
          new THREE.Vector3(origin.x, origin.y, origin.z - s), new THREE.Vector3(origin.x, origin.y, origin.z + s)
        ];
      }

      const crossGeo = new THREE.BufferGeometry().setFromPoints(ptsCross);
      const crossMesh = new THREE.LineSegments(crossGeo, crossMat);
      crossMesh.renderOrder = 999;
      group.add(crossMesh);

      // 2. Línea Guía Punteada Infinita o Proyectada
      if ((g.type === 'line' || g.type === 'angle') && g.direction) {
        const dir = new THREE.Vector3(g.direction.x, g.direction.y, g.direction.z).normalize();
        const lineLen = 3000; // 3 metros en cada dirección
        const pStart = origin.clone().addScaledVector(dir, -lineLen);
        const pEnd = origin.clone().addScaledVector(dir, lineLen);

        const lineGeo = new THREE.BufferGeometry().setFromPoints([pStart, pEnd]);
        const line = new THREE.Line(lineGeo, dashMat);
        line.computeLineDistances();
        line.renderOrder = 998;
        group.add(line);

        // Si es angular, agregar etiqueta sutil de grados
        if (g.type === 'angle' && g.angleDeg !== undefined) {
          const spritePos = origin.clone().addScaledVector(dir, 120);
          const labelSprite = this.createGuideLabelSprite(`${g.angleDeg.toFixed(1)}°`);
          labelSprite.position.copy(spritePos);
          group.add(labelSprite);
        }
      }
    }

    return group;
  }

  /**
   * Crea un sprite de texto sutil para cotas de guías y ángulos
   */
  private createGuideLabelSprite(text: string): THREE.Sprite {
    if (typeof document === 'undefined') {
      return new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
    }
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.roundRect(4, 4, 120, 40, 6);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 24);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(40, 15, 1);
    sprite.renderOrder = 1000;
    return sprite;
  }

  /**
   * Detecta con precisión la cara impactada de una pieza (cara ancha o canto/espesor)
   */
  detectPieceFace(hit: THREE.Intersection, part: Part, mesh: THREE.Mesh): CadHoveredFace | null {
    if (!hit.face || !mesh) return null;

    mesh.updateMatrixWorld(true);
    const worldNormal = hit.face.normal.clone().applyQuaternion(mesh.quaternion).normalize();

    // Determinar dimensiones según orientación
    const L = part.length;
    const W = part.width;
    const T = part.thickness ?? 15;

    // Normal en espacio local de la pieza
    const invQ = mesh.quaternion.clone().invert();
    const localNormal = hit.face.normal.clone().applyQuaternion(invQ);

    let isEdgeFace = false;
    let faceWidth = L;
    let faceHeight = W;

    // Clasificación de la cara según la normal local
    if (Math.abs(localNormal.y) > 0.8) {
      // Cara horizontal ancha (top o bottom)
      isEdgeFace = false;
      faceWidth = L;
      faceHeight = W;
    } else if (Math.abs(localNormal.x) > 0.8) {
      // Canto lateral (espesor T x ancho W)
      isEdgeFace = true;
      faceWidth = W;
      faceHeight = T;
    } else if (Math.abs(localNormal.z) > 0.8) {
      // Canto frontal/trasero (largo L x espesor T)
      isEdgeFace = true;
      faceWidth = L;
      faceHeight = T;
    }

    // Proyectar el punto de impacto a coordenadas UV locales respecto al centro de la pieza
    const localHit = hit.point.clone().applyMatrix4(mesh.matrixWorld.clone().invert());
    let localU = 0;
    let localV = 0;

    if (!isEdgeFace) {
      localU = Math.round(localHit.x + (faceWidth / 2));
      localV = Math.round(localHit.z + (faceHeight / 2));
    } else if (Math.abs(localNormal.x) > 0.8) {
      localU = Math.round(localHit.z + (faceWidth / 2));
      localV = Math.round(localHit.y + (faceHeight / 2));
    } else {
      localU = Math.round(localHit.x + (faceWidth / 2));
      localV = Math.round(localHit.y + (faceHeight / 2));
    }

    return {
      partId: part.id,
      faceIndex: hit.faceIndex || 0,
      worldNormal: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
      worldPoint: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
      localU,
      localV,
      faceWidth,
      faceHeight,
      isEdgeFace
    };
  }

  /**
   * Evalúa enganche magnético (snapping) hacia Puntos Guía (+) o Líneas Guía activas
   */
  findGuideSnap(
    guides: CadGuide[],
    ray: THREE.Ray,
    thresholdDistMm = 25
  ): { snapPoint: THREE.Vector3; guideId: string; type: 'point' | 'line' } | null {
    if (!guides || guides.length === 0) return null;

    let closestDist = Infinity;
    let bestSnap: { snapPoint: THREE.Vector3; guideId: string; type: 'point' | 'line' } | null = null;

    for (const g of guides) {
      const gOrigin = new THREE.Vector3(g.origin.x, g.origin.y, g.origin.z);

      // 1. Prioridad: Punto Auxiliar (+)
      const distToPoint = ray.distanceToPoint(gOrigin);
      if (distToPoint < thresholdDistMm && distToPoint < closestDist) {
        closestDist = distToPoint;
        bestSnap = {
          snapPoint: gOrigin.clone(),
          guideId: g.id,
          type: 'point'
        };
      }

      // 2. Línea Guía Punteada
      if (g.type === 'line' && g.direction) {
        const dir = new THREE.Vector3(g.direction.x, g.direction.y, g.direction.z).normalize();
        // Distancia entre el rayo y la línea guía 3D
        const linePt = new THREE.Vector3();
        const rayPt = new THREE.Vector3();
        this.closestPointsBetweenRays(ray.origin, ray.direction, gOrigin, dir, rayPt, linePt);
        const distLine = rayPt.distanceTo(linePt);

        if (distLine < thresholdDistMm && distLine < closestDist) {
          closestDist = distLine;
          bestSnap = {
            snapPoint: linePt.clone(),
            guideId: g.id,
            type: 'line'
          };
        }
      }
    }

    return bestSnap;
  }

  /**
   * Calcula la partición de la cara en 2 regiones (principal y recorte) a partir de una línea de corte
   */
  calculateLinePartition(
    part: Part,
    face: CadHoveredFace,
    p1World: THREE.Vector3,
    p2World: THREE.Vector3,
    mesh: THREE.Mesh
  ): CadFacePartition | null {
    const W = face.faceWidth;
    const H = face.faceHeight;
    const invM = mesh.matrixWorld.clone().invert();

    // Convertir P1 y P2 a coordenadas locales de la cara (0..W, 0..H)
    const p1Loc = p1World.clone().applyMatrix4(invM);
    const p2Loc = p2World.clone().applyMatrix4(invM);

    let u1 = 0, v1 = 0, u2 = 0, v2 = 0;
    if (!face.isEdgeFace) {
      u1 = p1Loc.x + W / 2;
      v1 = p1Loc.z + H / 2;
      u2 = p2Loc.x + W / 2;
      v2 = p2Loc.z + H / 2;
    } else {
      u1 = p1Loc.x + W / 2;
      v1 = p1Loc.y + H / 2;
      u2 = p2Loc.x + W / 2;
      v2 = p2Loc.y + H / 2;
    }

    // Clasificar en qué borde cae cada punto (0: U=0, 1: U=W, 2: V=0, 3: V=H)
    const tol = 20; // 20mm margen de borde
    const edge1 = this.classifyEdge(u1, v1, W, H, tol);
    const edge2 = this.classifyEdge(u2, v2, W, H, tol);

    if (edge1 === 'none' || edge2 === 'none' || edge1 === edge2) {
      // La línea no conecta dos bordes distintos de la cara
      return null;
    }

    // Detectar esquina cortada (ej. chaflán a 45° o diagonal)
    const cornerCut = this.findCornerCutBetweenEdges(edge1, edge2, u1, v1, u2, v2, W, H);
    if (!cornerCut) return null;

    // Convertir vértices de la región de recorte a coordenadas mundiales
    const cutoutWorld = cornerCut.polygon2D.map(pt => {
      const vLoc = new THREE.Vector3();
      if (!face.isEdgeFace) {
        vLoc.set(pt.u - W / 2, 0, pt.v - H / 2);
      } else {
        vLoc.set(pt.u - W / 2, pt.v - H / 2, 0);
      }
      return vLoc.applyMatrix4(mesh.matrixWorld);
    });

    return {
      partId: part.id,
      faceNormal: face.worldNormal,
      mainPolygon: cornerCut.mainPolygon2D,
      cutoutPolygon: cornerCut.polygon2D,
      cutType: 'line_cut',
      corner: cornerCut.corner as 'front_right' | 'front_left' | 'back_right' | 'back_left',
      cutDimensions: {
        width: Math.round(cornerCut.spanU),
        height: Math.round(cornerCut.spanV),
        areaMm2: Math.round(0.5 * cornerCut.spanU * cornerCut.spanV)
      },
      cutoutWorldVertices: cutoutWorld.map(p => ({ x: p.x, y: p.y, z: p.z }))
    };
  }

  /**
   * Clasifica a qué borde del rectángulo (left, right, bottom, top) pertenece un punto (u, v)
   */
  private classifyEdge(u: number, v: number, W: number, H: number, tol: number): 'left' | 'right' | 'bottom' | 'top' | 'none' {
    if (Math.abs(u) <= tol) return 'left';
    if (Math.abs(u - W) <= tol) return 'right';
    if (Math.abs(v) <= tol) return 'bottom';
    if (Math.abs(v - H) <= tol) return 'top';
    return 'none';
  }

  /**
   * Resuelve el triángulo de chaflán de esquina entre dos bordes
   */
  private findCornerCutBetweenEdges(
    e1: string,
    e2: string,
    u1: number,
    v1: number,
    u2: number,
    v2: number,
    W: number,
    H: number
  ): {
    corner: string;
    spanU: number;
    spanV: number;
    polygon2D: { u: number; v: number }[];
    mainPolygon2D: { u: number; v: number }[];
  } | null {
    // Esquina front_right (U=W, V=H)
    if ((e1 === 'right' && e2 === 'top') || (e1 === 'top' && e2 === 'right')) {
      const spanU = Math.abs(W - Math.min(u1, u2));
      const spanV = Math.abs(H - Math.min(v1, v2));
      return {
        corner: 'front_right',
        spanU,
        spanV,
        polygon2D: [
          { u: W, v: H },
          { u: W - spanU, v: H },
          { u: W, v: H - spanV }
        ],
        mainPolygon2D: [
          { u: 0, v: 0 },
          { u: W, v: 0 },
          { u: W, v: H - spanV },
          { u: W - spanU, v: H },
          { u: 0, v: H }
        ]
      };
    }

    // Esquina front_left (U=0, V=H)
    if ((e1 === 'left' && e2 === 'top') || (e1 === 'top' && e2 === 'left')) {
      const spanU = Math.max(u1, u2);
      const spanV = Math.abs(H - Math.min(v1, v2));
      return {
        corner: 'front_left',
        spanU,
        spanV,
        polygon2D: [
          { u: 0, v: H },
          { u: spanU, v: H },
          { u: 0, v: H - spanV }
        ],
        mainPolygon2D: [
          { u: 0, v: 0 },
          { u: W, v: 0 },
          { u: W, v: H },
          { u: spanU, v: H },
          { u: 0, v: H - spanV }
        ]
      };
    }

    // Esquina back_right (U=W, V=0)
    if ((e1 === 'right' && e2 === 'bottom') || (e1 === 'bottom' && e2 === 'right')) {
      const spanU = Math.abs(W - Math.min(u1, u2));
      const spanV = Math.max(v1, v2);
      return {
        corner: 'back_right',
        spanU,
        spanV,
        polygon2D: [
          { u: W, v: 0 },
          { u: W - spanU, v: 0 },
          { u: W, v: spanV }
        ],
        mainPolygon2D: [
          { u: 0, v: 0 },
          { u: W - spanU, v: 0 },
          { u: W, v: spanV },
          { u: W, v: H },
          { u: 0, v: H }
        ]
      };
    }

    // Esquina back_left (U=0, V=0)
    if ((e1 === 'left' && e2 === 'bottom') || (e1 === 'bottom' && e2 === 'left')) {
      const spanU = Math.max(u1, u2);
      const spanV = Math.max(v1, v2);
      return {
        corner: 'back_left',
        spanU,
        spanV,
        polygon2D: [
          { u: 0, v: 0 },
          { u: spanU, v: 0 },
          { u: 0, v: spanV }
        ],
        mainPolygon2D: [
          { u: spanU, v: 0 },
          { u: W, v: 0 },
          { u: W, v: H },
          { u: 0, v: H },
          { u: 0, v: spanV }
        ]
      };
    }

    return null;
  }

  /**
   * Construye el grupo Three.js que resalta interactivamente la sub-región de corte
   */
  buildPartitionHighlightGroup(
    partition: CadFacePartition,
    isHovered: boolean
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'cad_partition_highlight';
    if (!partition || partition.cutoutWorldVertices.length < 3) return group;

    const verts = partition.cutoutWorldVertices;
    const normal = new THREE.Vector3(
      partition.faceNormal.x,
      partition.faceNormal.y,
      partition.faceNormal.z
    ).normalize();

    // Pequeño desplazamiento de 0.8mm sobre la cara para evitar z-fighting
    const offset = normal.clone().multiplyScalar(0.8);

    const pts3D = verts.map(v => new THREE.Vector3(v.x, v.y, v.z).add(offset));

    // 1. Malla semitransparente sombreada
    const shape = new THREE.Shape();
    // Proyectar a plano 2D para triangular
    const uAxis = new THREE.Vector3(1, 0, 0);
    if (Math.abs(normal.x) > 0.8) uAxis.set(0, 1, 0);
    uAxis.cross(normal).normalize();
    const vAxis = new THREE.Vector3().crossVectors(normal, uAxis).normalize();

    const p0 = pts3D[0];
    shape.moveTo(0, 0);
    for (let i = 1; i < pts3D.length; i++) {
      const diff = pts3D[i].clone().sub(p0);
      shape.lineTo(diff.dot(uAxis), diff.dot(vAxis));
    }
    shape.closePath();

    const shapeGeo = new THREE.ShapeGeometry(shape);
    const mAlign = new THREE.Matrix4().makeBasis(uAxis, vAxis, normal);
    shapeGeo.applyMatrix4(mAlign);
    shapeGeo.translate(p0.x, p0.y, p0.z);

    const fillColor = isHovered ? 0x0284c7 : 0x38bdf8;
    const fillMat = new THREE.MeshBasicMaterial({
      color: fillColor,
      transparent: true,
      opacity: isHovered ? 0.45 : 0.25,
      depthTest: false,
      side: THREE.DoubleSide
    });
    const fillMesh = new THREE.Mesh(shapeGeo, fillMat);
    fillMesh.renderOrder = 990;
    group.add(fillMesh);

    // 2. Borde con guiones nítidos
    const ptsLoop = [...pts3D, pts3D[0]];
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(ptsLoop);
    const edgeMat = new THREE.LineDashedMaterial({
      color: 0x0369a1,
      dashSize: 8,
      gapSize: 4,
      depthTest: false
    });
    const edgeLine = new THREE.Line(edgeGeo, edgeMat);
    edgeLine.computeLineDistances();
    edgeLine.renderOrder = 991;
    group.add(edgeLine);

    // 3. Etiqueta flotante CAD con las cotas del corte
    const center = new THREE.Vector3();
    pts3D.forEach(p => center.add(p));
    center.divideScalar(pts3D.length).add(normal.clone().multiplyScalar(15));

    const labelText = `${partition.cutDimensions.width} × ${partition.cutDimensions.height} mm`;
    const label = this.createGuideLabelSprite(labelText);
    label.position.copy(center);
    group.add(label);

    return group;
  }

  /**
   * Calcula la distancia más cercana entre dos rayos tridimensionales en el espacio
   */
  private closestPointsBetweenRays(
    p1: THREE.Vector3,
    d1: THREE.Vector3,
    p2: THREE.Vector3,
    d2: THREE.Vector3,
    outPointOnRay1: THREE.Vector3,
    outPointOnRay2: THREE.Vector3
  ) {
    const w0 = p1.clone().sub(p2);
    const a = d1.dot(d1);
    const b = d1.dot(d2);
    const c = d2.dot(d2);
    const d = d1.dot(w0);
    const e = d2.dot(w0);

    const denom = a * c - b * b;
    if (Math.abs(denom) < 1e-6) {
      // Rayos paralelos
      outPointOnRay1.copy(p1);
      outPointOnRay2.copy(p2).addScaledVector(d2, e / c);
      return;
    }

    const s = (b * e - c * d) / denom;
    const t = (a * e - b * d) / denom;

    outPointOnRay1.copy(p1).addScaledVector(d1, s);
    outPointOnRay2.copy(p2).addScaledVector(d2, t);
  }

  /**
   * Calcula la partición rectangular (caja o destaje en L) sobre una cara
   */
  calculateRectPartition(
    part: Part,
    face: CadHoveredFace,
    p1World: THREE.Vector3,
    p2World: THREE.Vector3,
    mesh: THREE.Mesh
  ): CadFacePartition | null {
    const W = face.faceWidth;
    const H = face.faceHeight;
    const invM = mesh.matrixWorld.clone().invert();

    const p1Loc = p1World.clone().applyMatrix4(invM);
    const p2Loc = p2World.clone().applyMatrix4(invM);

    let u1 = 0, v1 = 0, u2 = 0, v2 = 0;
    if (!face.isEdgeFace) {
      u1 = p1Loc.x + W / 2;
      v1 = p1Loc.z + H / 2;
      u2 = p2Loc.x + W / 2;
      v2 = p2Loc.z + H / 2;
    } else {
      u1 = p1Loc.x + W / 2;
      v1 = p1Loc.y + H / 2;
      u2 = p2Loc.x + W / 2;
      v2 = p2Loc.y + H / 2;
    }

    const minU = Math.max(0, Math.min(u1, u2));
    const maxU = Math.min(W, Math.max(u1, u2));
    const minV = Math.max(0, Math.min(v1, v2));
    const maxV = Math.min(H, Math.max(v1, v2));

    const spanU = Math.round(maxU - minU);
    const spanV = Math.round(maxV - minV);

    if (spanU < 8 || spanV < 8) return null;

    const cutoutPoly2D = [
      { u: minU, v: minV },
      { u: maxU, v: minV },
      { u: maxU, v: maxV },
      { u: minU, v: maxV }
    ];

    const cutoutWorld = cutoutPoly2D.map(pt => {
      const vLoc = new THREE.Vector3();
      if (!face.isEdgeFace) {
        vLoc.set(pt.u - W / 2, 0, pt.v - H / 2);
      } else {
        vLoc.set(pt.u - W / 2, pt.v - H / 2, 0);
      }
      return vLoc.applyMatrix4(mesh.matrixWorld);
    });

    let corner: 'front_right' | 'front_left' | 'back_right' | 'back_left' = 'front_right';
    if (minU <= 25 && minV <= 25) corner = 'back_left';
    else if (maxU >= W - 25 && minV <= 25) corner = 'back_right';
    else if (minU <= 25 && maxV >= H - 25) corner = 'front_left';
    else corner = 'front_right';

    return {
      partId: part.id,
      faceNormal: face.worldNormal,
      mainPolygon: [
        { u: 0, v: 0 },
        { u: W, v: 0 },
        { u: W, v: H },
        { u: 0, v: H }
      ],
      cutoutPolygon: cutoutPoly2D,
      cutType: 'rect_notch',
      corner,
      cutDimensions: {
        width: spanU,
        height: spanV,
        areaMm2: spanU * spanV
      },
      cutoutWorldVertices: cutoutWorld.map(p => ({ x: p.x, y: p.y, z: p.z }))
    };
  }

  /**
   * Calcula la partición en curva / arco conectando bordes de la cara
   */
  calculateArcPartition(
    part: Part,
    face: CadHoveredFace,
    p1World: THREE.Vector3,
    p2World: THREE.Vector3,
    pMidWorld: THREE.Vector3,
    mesh: THREE.Mesh
  ): CadFacePartition | null {
    const W = face.faceWidth;
    const H = face.faceHeight;
    const invM = mesh.matrixWorld.clone().invert();

    const p1Loc = p1World.clone().applyMatrix4(invM);
    const p2Loc = p2World.clone().applyMatrix4(invM);
    const pMidLoc = pMidWorld.clone().applyMatrix4(invM);

    let u1 = 0, v1 = 0, u2 = 0, v2 = 0, uMid = 0, vMid = 0;
    if (!face.isEdgeFace) {
      u1 = p1Loc.x + W / 2;
      v1 = p1Loc.z + H / 2;
      u2 = p2Loc.x + W / 2;
      v2 = p2Loc.z + H / 2;
      uMid = pMidLoc.x + W / 2;
      vMid = pMidLoc.z + H / 2;
    } else {
      u1 = p1Loc.x + W / 2;
      v1 = p1Loc.y + H / 2;
      u2 = p2Loc.x + W / 2;
      v2 = p2Loc.y + H / 2;
      uMid = pMidLoc.x + W / 2;
      vMid = pMidLoc.y + H / 2;
    }

    const chord = Math.hypot(u2 - u1, v2 - v1);
    if (chord < 10) return null;

    const midChordU = (u1 + u2) * 0.5;
    const midChordV = (v1 + v2) * 0.5;
    const sagitta = Math.max(3, Math.hypot(uMid - midChordU, vMid - midChordV));
    const radius = Math.max(10, Math.round((sagitta / 2) + (chord * chord) / (8 * sagitta)));

    // Determinar la esquina más cercana al corte
    const corners = [
      { u: 0, v: 0, name: 'back_left' },
      { u: W, v: 0, name: 'back_right' },
      { u: W, v: H, name: 'front_right' },
      { u: 0, v: H, name: 'front_left' }
    ];
    let closestCorner = corners[0];
    let minD = Infinity;
    for (const c of corners) {
      const d = Math.hypot(c.u - midChordU, c.v - midChordV);
      if (d < minD) {
        minD = d;
        closestCorner = c;
      }
    }

    // Muestreo del arco suave en 12 segmentos parabólicos/circulares
    const arcPoints2D: { u: number; v: number }[] = [];
    const segments = 12;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      // Interpolación cuadrática bezier pasando por el punto medio
      const oneMinusT = 1 - t;
      const u = oneMinusT * oneMinusT * u1 + 2 * oneMinusT * t * uMid + t * t * u2;
      const v = oneMinusT * oneMinusT * v1 + 2 * oneMinusT * t * vMid + t * t * v2;
      arcPoints2D.push({ u, v });
    }

    const cutoutPoly2D: { u: number; v: number }[] = [
      ...arcPoints2D,
      { u: closestCorner.u, v: closestCorner.v }
    ];

    const cutoutWorld = cutoutPoly2D.map(pt => {
      const vLoc = new THREE.Vector3();
      if (!face.isEdgeFace) {
        vLoc.set(pt.u - W / 2, 0, pt.v - H / 2);
      } else {
        vLoc.set(pt.u - W / 2, pt.v - H / 2, 0);
      }
      return vLoc.applyMatrix4(mesh.matrixWorld);
    });

    return {
      partId: part.id,
      faceNormal: face.worldNormal,
      mainPolygon: [
        { u: 0, v: 0 },
        { u: W, v: 0 },
        { u: W, v: H },
        { u: 0, v: H }
      ],
      cutoutPolygon: cutoutPoly2D,
      cutType: 'arc_cut',
      corner: closestCorner.name as 'front_right' | 'front_left' | 'back_right' | 'back_left',
      cutDimensions: {
        width: Math.round(chord),
        height: Math.round(sagitta),
        areaMm2: Math.round(0.5 * chord * sagitta),
        radius
      },
      cutoutWorldVertices: cutoutWorld.map(p => ({ x: p.x, y: p.y, z: p.z }))
    };
  }

  /**
   * Algoritmo Ray-Casting O(N) para determinar si un punto (u, v) se encuentra dentro de un polígono 2D
   */
  isPointInPolygon2D(pt: { u: number; v: number }, polygon: { u: number; v: number }[]): boolean {
    if (!polygon || polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].u, yi = polygon[i].v;
      const xj = polygon[j].u, yj = polygon[j].v;
      const intersect = ((yi > pt.v) !== (yj > pt.v)) &&
        (pt.u < (xj - xi) * (pt.v - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Previsualización de línea CAD interactiva (Lápiz L) con cota milimétrica en tiempo real
   */
  buildPreviewLineGroup(p1: THREE.Vector3, p2: THREE.Vector3, lengthMm: number): THREE.Group {
    const group = new THREE.Group();
    group.name = 'cad_preview_line';

    const lineMat = new THREE.LineDashedMaterial({
      color: 0x0284c7,
      dashSize: 8,
      gapSize: 4,
      depthTest: false
    });
    const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    const line = new THREE.Line(geo, lineMat);
    line.computeLineDistances();
    line.renderOrder = 998;
    group.add(line);

    // Marca cruz (+) en el punto final
    const s = 6;
    const crossGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(p2.x - s, p2.y, p2.z), new THREE.Vector3(p2.x + s, p2.y, p2.z),
      new THREE.Vector3(p2.x, p2.y, p2.z - s), new THREE.Vector3(p2.x, p2.y, p2.z + s)
    ]);
    const crossMat = new THREE.LineBasicMaterial({ color: 0x0284c7, depthTest: false, linewidth: 2 });
    const cross = new THREE.LineSegments(crossGeo, crossMat);
    cross.renderOrder = 999;
    group.add(cross);

    // Cota flotante
    const mid = p1.clone().lerp(p2, 0.5).add(new THREE.Vector3(0, 14, 0));
    const label = this.createGuideLabelSprite(`${Math.round(lengthMm)} mm`);
    label.position.copy(mid);
    group.add(label);

    return group;
  }

  /**
   * Previsualización de rectángulo de corte sobre cara (R)
   */
  buildPreviewRectGroup(
    face: CadHoveredFace,
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    mesh: THREE.Mesh
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'cad_preview_rect';

    const normal = new THREE.Vector3(face.worldNormal.x, face.worldNormal.y, face.worldNormal.z).normalize();
    const offset = normal.clone().multiplyScalar(0.6);

    const invM = mesh.matrixWorld.clone().invert();
    const loc1 = p1.clone().applyMatrix4(invM);
    const loc2 = p2.clone().applyMatrix4(invM);

    let cornerA = new THREE.Vector3();
    let cornerB = new THREE.Vector3();
    let cornerC = new THREE.Vector3();
    let cornerD = new THREE.Vector3();

    if (!face.isEdgeFace) {
      cornerA.set(loc1.x, loc1.y, loc1.z);
      cornerB.set(loc2.x, loc1.y, loc1.z);
      cornerC.set(loc2.x, loc2.y, loc2.z);
      cornerD.set(loc1.x, loc2.y, loc2.z);
    } else {
      cornerA.set(loc1.x, loc1.y, loc1.z);
      cornerB.set(loc2.x, loc1.y, loc1.z);
      cornerC.set(loc2.x, loc2.y, loc2.z);
      cornerD.set(loc1.x, loc2.y, loc2.z);
    }

    const ptsWorld = [
      cornerA.applyMatrix4(mesh.matrixWorld).add(offset),
      cornerB.applyMatrix4(mesh.matrixWorld).add(offset),
      cornerC.applyMatrix4(mesh.matrixWorld).add(offset),
      cornerD.applyMatrix4(mesh.matrixWorld).add(offset),
      cornerA.clone().applyMatrix4(mesh.matrixWorld).add(offset)
    ];

    const geo = new THREE.BufferGeometry().setFromPoints(ptsWorld);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x0284c7,
      dashSize: 6,
      gapSize: 3,
      depthTest: false
    });
    const line = new THREE.Line(geo, lineMat);
    line.computeLineDistances();
    line.renderOrder = 998;
    group.add(line);

    return group;
  }

  /**
   * Previsualización de arco de 3 puntos (A)
   */
  buildPreviewArcGroup(
    p1: THREE.Vector3,
    p2: THREE.Vector3,
    pMid: THREE.Vector3,
    radiusMm: number
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'cad_preview_arc';

    const segments = 16;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const oneMinusT = 1 - t;
      // Bezier cuadrática 3D pasando por el punto medio
      const x = oneMinusT * oneMinusT * p1.x + 2 * oneMinusT * t * pMid.x + t * t * p2.x;
      const y = oneMinusT * oneMinusT * p1.y + 2 * oneMinusT * t * pMid.y + t * t * p2.y;
      const z = oneMinusT * oneMinusT * p1.z + 2 * oneMinusT * t * pMid.z + t * t * p2.z;
      pts.push(new THREE.Vector3(x, y, z));
    }

    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x0284c7,
      dashSize: 6,
      gapSize: 3,
      depthTest: false
    });
    const line = new THREE.Line(geo, lineMat);
    line.computeLineDistances();
    line.renderOrder = 998;
    group.add(line);

    const label = this.createGuideLabelSprite(`R: ${Math.round(radiusMm)} mm`);
    label.position.copy(pMid.clone().add(new THREE.Vector3(0, 12, 0)));
    group.add(label);

    return group;
  }

  /**
   * Previsualización interactiva del Transportador Angular (Protractor)
   */
  buildProtractorFanGroup(
    origin: THREE.Vector3,
    baseDir: THREE.Vector3,
    currentDir: THREE.Vector3,
    angleDeg: number
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'cad_protractor_fan';

    const r = 160; // 160 mm de radio de transportador
    const pBase = origin.clone().addScaledVector(baseDir.clone().normalize(), r);
    const pCurrent = origin.clone().addScaledVector(currentDir.clone().normalize(), r);

    // Eje de rotación normal al abanico
    const normal = new THREE.Vector3().crossVectors(baseDir, currentDir).normalize();
    if (normal.lengthSq() < 0.01) normal.set(0, 1, 0);

    // Línea base (0°)
    const geoBase = new THREE.BufferGeometry().setFromPoints([origin, pBase]);
    const matBase = new THREE.LineBasicMaterial({ color: 0x64748b, depthTest: false, linewidth: 2 });
    const lineBase = new THREE.Line(geoBase, matBase);
    lineBase.renderOrder = 997;
    group.add(lineBase);

    // Línea actual (Ángulo)
    const geoCurr = new THREE.BufferGeometry().setFromPoints([origin, pCurrent]);
    const matCurr = new THREE.LineBasicMaterial({ color: 0x0284c7, depthTest: false, linewidth: 2 });
    const lineCurr = new THREE.Line(geoCurr, matCurr);
    lineCurr.renderOrder = 998;
    group.add(lineCurr);

    // Arco de abanico
    const arcPts: THREE.Vector3[] = [];
    const steps = 24;
    const totalRad = (angleDeg * Math.PI) / 180;
    for (let i = 0; i <= steps; i++) {
      const stepAngle = (totalRad * i) / steps;
      const pt = baseDir.clone().normalize().applyAxisAngle(normal, stepAngle).multiplyScalar(r * 0.75).add(origin);
      arcPts.push(pt);
    }
    const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
    const arcMat = new THREE.LineDashedMaterial({ color: 0x0284c7, dashSize: 4, gapSize: 2, depthTest: false });
    const arcLine = new THREE.Line(arcGeo, arcMat);
    arcLine.computeLineDistances();
    arcLine.renderOrder = 998;
    group.add(arcLine);

    // Etiqueta flotante con ángulo exacto
    const midRad = totalRad * 0.5;
    const labelPos = baseDir.clone().normalize().applyAxisAngle(normal, midRad).multiplyScalar(r * 0.9).add(origin);
    const label = this.createGuideLabelSprite(`${angleDeg.toFixed(1)}°`);
    label.position.copy(labelPos);
    group.add(label);

    return group;
  }

  /**
   * Construye el grupo 3D para la previsualización del corte en profundidad con Empujar/Tirar (P)
   * Renderiza el prisma 3D que se hunde en la pieza hasta el límite del espesor (-T mm).
   */
  buildCutDepthPreviewGroup(
    partition: CadFacePartition,
    depthMm: number,
    maxDepthMm: number
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = 'cad_cut_depth_preview';
    if (!partition || partition.cutoutWorldVertices.length < 3) return group;

    const normal = new THREE.Vector3(
      partition.faceNormal.x,
      partition.faceNormal.y,
      partition.faceNormal.z
    ).normalize();

    // Desplazamiento en la dirección del empuje
    const depthVec = normal.clone().multiplyScalar(depthMm);

    const topPts = partition.cutoutWorldVertices.map(v => new THREE.Vector3(v.x, v.y, v.z));
    const botPts = topPts.map(v => v.clone().add(depthVec));

    const isAtLimit = Math.abs(depthMm) >= maxDepthMm - 0.5;
    const fillColor = isAtLimit ? 0x059669 : 0x0284c7;

    // 1. Trazado de aristas laterales conectando cara superior e inferior
    const edgePts: THREE.Vector3[] = [];
    for (let i = 0; i < topPts.length; i++) {
      edgePts.push(topPts[i], botPts[i]);
    }
    const sideEdgesGeo = new THREE.BufferGeometry().setFromPoints(edgePts);
    const sideEdgesMat = new THREE.LineBasicMaterial({
      color: fillColor,
      depthTest: false,
      transparent: true,
      opacity: 0.95,
      linewidth: 2
    });
    const sideEdges = new THREE.LineSegments(sideEdgesGeo, sideEdgesMat);
    sideEdges.renderOrder = 996;
    group.add(sideEdges);

    // 2. Contorno inferior punteado
    const botLoop = [...botPts, botPts[0]];
    const botGeo = new THREE.BufferGeometry().setFromPoints(botLoop);
    const botMat = new THREE.LineDashedMaterial({
      color: fillColor,
      dashSize: 6,
      gapSize: 3,
      depthTest: false
    });
    const botLine = new THREE.Line(botGeo, botMat);
    botLine.computeLineDistances();
    botLine.renderOrder = 997;
    group.add(botLine);

    // 3. Cara inferior sombreada
    const shape = new THREE.Shape();
    const uAxis = new THREE.Vector3(1, 0, 0);
    if (Math.abs(normal.x) > 0.8) uAxis.set(0, 1, 0);
    uAxis.cross(normal).normalize();
    const vAxis = new THREE.Vector3().crossVectors(normal, uAxis).normalize();

    const p0 = botPts[0];
    shape.moveTo(0, 0);
    for (let i = 1; i < botPts.length; i++) {
      const diff = botPts[i].clone().sub(p0);
      shape.lineTo(diff.dot(uAxis), diff.dot(vAxis));
    }
    shape.closePath();

    const shapeGeo = new THREE.ShapeGeometry(shape);
    const mAlign = new THREE.Matrix4().makeBasis(uAxis, vAxis, normal);
    shapeGeo.applyMatrix4(mAlign);
    shapeGeo.translate(p0.x, p0.y, p0.z);

    const fillMat = new THREE.MeshBasicMaterial({
      color: fillColor,
      transparent: true,
      opacity: isAtLimit ? 0.6 : 0.35,
      depthTest: false,
      side: THREE.DoubleSide
    });
    const fillMesh = new THREE.Mesh(shapeGeo, fillMat);
    fillMesh.renderOrder = 994;
    group.add(fillMesh);

    // 4. Etiqueta flotante CAD con profundidad y estado de límite
    const midBot = new THREE.Vector3();
    botPts.forEach(p => midBot.add(p));
    midBot.divideScalar(botPts.length);

    const labelText = isAtLimit
      ? `Límite Espesor: -${Math.round(maxDepthMm)} mm (Corte Pasante)`
      : `Profundidad: ${Math.round(depthMm)} mm (Límite: -${Math.round(maxDepthMm)} mm)`;

    const label = this.createGuideLabelSprite(labelText);
    label.position.copy(midBot.clone().add(normal.clone().multiplyScalar(8)));
    group.add(label);

    return group;
  }
}
