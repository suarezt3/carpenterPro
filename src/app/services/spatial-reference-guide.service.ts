import { Injectable } from '@angular/core';
import * as THREE from 'three';

export interface SpatialGuideOptions {
  figurePos: { x: number; z: number };
  isSelected: boolean;
  isWhiteTheme: boolean;
}

/**
 * Construye la Guía de Referencia Espacial 3D de Piezo3D Studio:
 * 1. Indicadores cardinales en el plano de trabajo (FRENTE +Z, ATRÁS -Z, IZQUIERDA -X, DERECHA +X).
 * 2. Maniquí arquitectónico estilizado a escala humana real (1720 mm / 1.72 m) con brújula en su base
 *    y regla ergonómica vertical, movible con el ratón y ocultable por el usuario.
 */
@Injectable({
  providedIn: 'root'
})
export class SpatialReferenceGuideService {

  buildGuideScene(options: SpatialGuideOptions): THREE.Group {
    const rootGroup = new THREE.Group();
    const { figurePos, isSelected, isWhiteTheme } = options;

    // 1. Etiquetas cardinales fijas en los 4 puntos del piso del taller
    const cardinalGroup = this.buildFloorCardinalMarkers(isWhiteTheme);
    rootGroup.add(cardinalGroup);

    // 2. Maniquí arquitectónico 3D móvil (1720 mm de altura) + Brújula y regla
    const figureGroup = this.buildHumanScaleFigure(figurePos, isSelected, isWhiteTheme);
    rootGroup.add(figureGroup);

    return rootGroup;
  }

  private buildFloorCardinalMarkers(isWhiteTheme: boolean): THREE.Group {
    const group = new THREE.Group();

    // Línea frontal indicadora en el borde delantero (+Z)
    const frontBarGeo = new THREE.PlaneGeometry(1800, 10);
    const frontBarMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: isWhiteTheme ? 0.45 : 0.6,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const frontBar = new THREE.Mesh(frontBarGeo, frontBarMat);
    frontBar.rotation.x = -Math.PI / 2;
    frontBar.position.set(0, 1.5, 1380);
    group.add(frontBar);

    // Badges cardinales en los 4 lados del escenario
    const frontSprite = this.createCardinalBadge('▼ FRENTE (+Z) · VISTA FRONTAL', '#0284c7', '#ffffff', 420, 68);
    frontSprite.position.set(0, 18, 1480);
    frontSprite.scale.set(360, 58, 1);
    group.add(frontSprite);

    const backSprite = this.createCardinalBadge('▲ ATRÁS / FONDO (-Z)', '#475569', '#f8fafc', 360, 64);
    backSprite.position.set(0, 18, -1480);
    backSprite.scale.set(290, 52, 1);
    group.add(backSprite);

    const leftSprite = this.createCardinalBadge('◄ IZQUIERDA (-X)', '#64748b', '#f8fafc', 340, 64);
    leftSprite.position.set(-1650, 18, 0);
    leftSprite.scale.set(270, 50, 1);
    group.add(leftSprite);

    const rightSprite = this.createCardinalBadge('DERECHA (+X) ►', '#64748b', '#f8fafc', 340, 64);
    rightSprite.position.set(1650, 18, 0);
    rightSprite.scale.set(270, 50, 1);
    group.add(rightSprite);

    return group;
  }

  private buildHumanScaleFigure(
    pos: { x: number; z: number },
    isSelected: boolean,
    isWhiteTheme: boolean
  ): THREE.Group {
    const figureGroup = new THREE.Group();
    figureGroup.position.set(pos.x, 0, pos.z);

    const primaryColor = isSelected ? 0x0284c7 : (isWhiteTheme ? 0x334155 : 0x94a3b8);
    const accentColor = isSelected ? 0xf59e0b : 0x0284c7;
    const edgeColor = isSelected ? 0x38bdf8 : (isWhiteTheme ? 0x0f172a : 0xe2e8f0);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      roughness: 0.45,
      metalness: 0.15,
      transparent: true,
      opacity: 0.92
    });

    const darkAccentMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.3,
      metalness: 0.4
    });

    const cyanAccentMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: isSelected ? 0.35 : 0.15,
      roughness: 0.25,
      metalness: 0.3
    });

    const edgeMat = new THREE.LineBasicMaterial({
      color: edgeColor,
      linewidth: isSelected ? 2 : 1
    });

    const addPartWithEdges = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Mesh => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      if (rx || ry || rz) {
        mesh.rotation.set(rx, ry, rz);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const edges = new THREE.EdgesGeometry(geo, 25);
      const lines = new THREE.LineSegments(edges, edgeMat);
      mesh.add(lines);
      figureGroup.add(mesh);
      return mesh;
    };

    // --- 1. DISCO BASE TIPO BRÚJULA CAD EN EL PISO (Y = 2mm) ---
    const baseRingGeo = new THREE.RingGeometry(195, 225, 36);
    const baseRingMat = new THREE.MeshBasicMaterial({
      color: accentColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: isSelected ? 0.95 : 0.75
    });
    const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.set(0, 2, 0);
    figureGroup.add(baseRing);

    const baseDiscGeo = new THREE.CircleGeometry(195, 36);
    const baseDiscMat = new THREE.MeshBasicMaterial({
      color: isSelected ? 0x0284c7 : 0x0f172a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: isSelected ? 0.22 : 0.1
    });
    const baseDisc = new THREE.Mesh(baseDiscGeo, baseDiscMat);
    baseDisc.rotation.x = -Math.PI / 2;
    baseDisc.position.set(0, 1.5, 0);
    figureGroup.add(baseDisc);

    // Flecha frontal prominente en la base apuntando hacia +Z (EL FRENTE)
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 310);      // Punta hacia +Z
    arrowShape.lineTo(-65, 210);
    arrowShape.lineTo(-24, 210);
    arrowShape.lineTo(-24, 140);
    arrowShape.lineTo(24, 140);
    arrowShape.lineTo(24, 210);
    arrowShape.lineTo(65, 210);
    arrowShape.closePath();

    const arrowGeo = new THREE.ShapeGeometry(arrowShape);
    const arrowMesh = new THREE.Mesh(arrowGeo, cyanAccentMat);
    arrowMesh.rotation.x = Math.PI / 2;
    arrowMesh.position.set(0, 3, 0);
    figureGroup.add(arrowMesh);

    // --- 2. ZAPATOS ORIENTADOS HACIA EL FRENTE (+Z) (0 a 45 mm) ---
    const shoeGeo = new THREE.BoxGeometry(85, 45, 195);
    addPartWithEdges(shoeGeo, darkAccentMat, -65, 22.5, 25);
    addPartWithEdges(shoeGeo, darkAccentMat, 65, 22.5, 25);

    // --- 3. PIERNAS (45 a 860 mm) ---
    const legGeo = new THREE.BoxGeometry(82, 815, 95);
    addPartWithEdges(legGeo, bodyMat, -65, 452.5, 0);
    addPartWithEdges(legGeo, bodyMat, 65, 452.5, 0);

    // --- 4. CADERA Y TORSO ARQUITECTÓNICO (860 a 1430 mm) ---
    const hipGeo = new THREE.BoxGeometry(230, 90, 125);
    addPartWithEdges(hipGeo, darkAccentMat, 0, 905, 0);

    const torsoGeo = new THREE.BoxGeometry(260, 480, 140);
    addPartWithEdges(torsoGeo, bodyMat, 0, 1190, 0);

    // Pechera / Peto técnico en la cara FRONTAL (+Z) del torso
    const chestBadgeGeo = new THREE.BoxGeometry(170, 220, 10);
    addPartWithEdges(chestBadgeGeo, cyanAccentMat, 0, 1230, 74);

    // --- 5. BRAZOS Y TABLA DE PLANOS CAD EN EL FRENTE (+Z) ---
    // Brazo izquierdo
    const leftArmGeo = new THREE.BoxGeometry(68, 520, 80);
    addPartWithEdges(leftArmGeo, bodyMat, -172, 1170, 0, 0, 0, 0.05);

    // Brazo derecho superior e inferior sosteniendo el plano hacia el frente (+Z)
    const rightUpperArmGeo = new THREE.BoxGeometry(68, 270, 80);
    addPartWithEdges(rightUpperArmGeo, bodyMat, 172, 1295, 15, -0.25, 0, -0.05);

    const rightForearmGeo = new THREE.BoxGeometry(64, 240, 74);
    addPartWithEdges(rightForearmGeo, bodyMat, 165, 1110, 110, -1.05, -0.2, 0);

    // Tabla / Tablet de planos CAD en las manos (mirando al frente +Z)
    const clipboardGeo = new THREE.BoxGeometry(190, 240, 12);
    addPartWithEdges(clipboardGeo, cyanAccentMat, 115, 1135, 205, -0.45, -0.15, 0);

    // --- 6. CUELLO, CABEZA Y VISERA / GAFAS EN LA CARA FRONTAL (+Z) (1430 a 1720 mm) ---
    const neckGeo = new THREE.CylinderGeometry(42, 46, 55, 16);
    addPartWithEdges(neckGeo, bodyMat, 0, 1455, 0);

    const headGeo = new THREE.BoxGeometry(145, 195, 155);
    addPartWithEdges(headGeo, bodyMat, 0, 1580, 0);

    // Gafas / Visor técnico en la cara frontal (+Z) para distinguir el rostro de un vistazo
    const visorGeo = new THREE.BoxGeometry(132, 42, 24);
    addPartWithEdges(visorGeo, cyanAccentMat, 0, 1595, 76);

    // Casco / Gorra técnica superior con visera apuntando hacia +Z (cota 1720 mm)
    const capCrownGeo = new THREE.BoxGeometry(152, 42, 162);
    addPartWithEdges(capCrownGeo, darkAccentMat, 0, 1699, 0);

    const capBillGeo = new THREE.BoxGeometry(148, 12, 75);
    addPartWithEdges(capBillGeo, cyanAccentMat, 0, 1682, 110);

    // --- 7. REGLA VERTICAL GRADUADA DE ESCALA HUMANA (1720 mm) ---
    const rulerX = -275;
    const rulerLinePoints = [
      new THREE.Vector3(rulerX, 0, 0),
      new THREE.Vector3(rulerX, 1720, 0),
      new THREE.Vector3(rulerX - 30, 0, 0),
      new THREE.Vector3(rulerX + 30, 0, 0),
      new THREE.Vector3(rulerX - 25, 900, 0),
      new THREE.Vector3(rulerX + 25, 900, 0),
      new THREE.Vector3(rulerX - 35, 1720, 0),
      new THREE.Vector3(rulerX + 35, 1720, 0)
    ];
    const rulerGeo = new THREE.BufferGeometry().setFromPoints(rulerLinePoints);
    const rulerLines = new THREE.LineSegments(rulerGeo, edgeMat);
    figureGroup.add(rulerLines);

    // Etiqueta de altura total (1.72 m)
    const heightBadge = this.createCardinalBadge('Escala 1.72 m (1720 mm)', '#0f172a', '#38bdf8', 320, 58);
    heightBadge.position.set(rulerX, 1785, 0);
    heightBadge.scale.set(230, 42, 1);
    figureGroup.add(heightBadge);

    // Etiqueta de altura de mesada (900 mm)
    const counterBadge = this.createCardinalBadge('900 mm · Mesada', '#1e293b', '#fde68a', 260, 52);
    counterBadge.position.set(rulerX - 95, 900, 0);
    counterBadge.scale.set(175, 35, 1);
    figureGroup.add(counterBadge);

    // Etiqueta de dirección en la flecha de los pies
    const frontFootBadge = this.createCardinalBadge(
      isSelected ? '▼ FRENTE (+Z) · Arrastra o pulsa Supr' : '▼ FRENTE (+Z)',
      isSelected ? '#f59e0b' : '#0284c7',
      '#ffffff',
      isSelected ? 440 : 260,
      58
    );
    frontFootBadge.position.set(0, 35, 370);
    frontFootBadge.scale.set(isSelected ? 310 : 185, 42, 1);
    figureGroup.add(frontFootBadge);

    // Marcar todos los elementos del maniquí para poder seleccionarlo y arrastrarlo con el ratón
    figureGroup.traverse(obj => {
      obj.userData = {
        ...obj.userData,
        isReferenceGuide: true
      };
    });

    return figureGroup;
  }

  private createCardinalBadge(
    text: string,
    borderColor: string,
    textColor: string,
    canvasW = 340,
    canvasH = 64
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(6, 6, canvasW - 12, canvasH - 12, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvasW / 2, canvasH / 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    return new THREE.Sprite(mat);
  }
}