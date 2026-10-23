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

    // 1. Marco perimetral completo del taller (5000 x 5000 mm)
    const borderPoints = [
      new THREE.Vector3(-2500, 1.2, 2500),
      new THREE.Vector3(2500, 1.2, 2500),
      new THREE.Vector3(2500, 1.2, -2500),
      new THREE.Vector3(-2500, 1.2, -2500),
      new THREE.Vector3(-2500, 1.2, 2500)
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const borderMat = new THREE.LineBasicMaterial({
      color: isWhiteTheme ? 0x94a3b8 : 0x475569,
      transparent: true,
      opacity: isWhiteTheme ? 0.65 : 0.8
    });
    const borderLine = new THREE.Line(borderGeo, borderMat);
    group.add(borderLine);

    // 2. Cantoneras arquitectónicas CAD en las 4 esquinas del taller
    const cornerLen = 220;
    const cornerMat = new THREE.LineBasicMaterial({
      color: isWhiteTheme ? 0x0284c7 : 0x38bdf8,
      transparent: true,
      opacity: isWhiteTheme ? 0.8 : 0.9
    });
    const corners = [
      // Delantera Izquierda (-2500, 2500)
      [
        new THREE.Vector3(-2500 + cornerLen, 1.5, 2500),
        new THREE.Vector3(-2500, 1.5, 2500),
        new THREE.Vector3(-2500, 1.5, 2500 - cornerLen)
      ],
      // Delantera Derecha (2500, 2500)
      [
        new THREE.Vector3(2500 - cornerLen, 1.5, 2500),
        new THREE.Vector3(2500, 1.5, 2500),
        new THREE.Vector3(2500, 1.5, 2500 - cornerLen)
      ],
      // Trasera Derecha (2500, -2500)
      [
        new THREE.Vector3(2500 - cornerLen, 1.5, -2500),
        new THREE.Vector3(2500, 1.5, -2500),
        new THREE.Vector3(2500, 1.5, -2500 + cornerLen)
      ],
      // Trasera Izquierda (-2500, -2500)
      [
        new THREE.Vector3(-2500 + cornerLen, 1.5, -2500),
        new THREE.Vector3(-2500, 1.5, -2500),
        new THREE.Vector3(-2500, 1.5, -2500 + cornerLen)
      ]
    ];
    for (const pts of corners) {
      const cGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const cLine = new THREE.Line(cGeo, cornerMat);
      group.add(cLine);
    }

    // 3. Cinta frontal azul distintiva en todo el borde delantero (+Z = 2500)
    const frontBarGeo = new THREE.PlaneGeometry(2800, 24);
    const frontBarMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: isWhiteTheme ? 0.75 : 0.9,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const frontBar = new THREE.Mesh(frontBarGeo, frontBarMat);
    frontBar.rotation.x = -Math.PI / 2;
    frontBar.position.set(0, 1.6, 2500);
    group.add(frontBar);

    // 4. Chevrons direccionales en el piso apuntando al interior del taller
    const createInwardChevron = (x: number, z: number, rotY: number, color: number) => {
      const shape = new THREE.Shape();
      shape.moveTo(0, 90);
      shape.lineTo(-75, -40);
      shape.lineTo(-32, -40);
      shape.lineTo(0, 15);
      shape.lineTo(32, -40);
      shape.lineTo(75, -40);
      shape.closePath();

      const geo = new THREE.ShapeGeometry(shape);
      const mat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isWhiteTheme ? 0.7 : 0.85,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = rotY;
      mesh.position.set(x, 2, z);
      return mesh;
    };

    // Frontal (+Z): flecha apuntando hacia el centro (-Z)
    group.add(createInwardChevron(0, 2420, Math.PI, 0x0284c7));
    // Trasero (-Z): flecha apuntando hacia el centro (+Z)
    group.add(createInwardChevron(0, -2420, 0, 0x64748b));
    // Izquierdo (-X): flecha apuntando hacia el centro (+X)
    group.add(createInwardChevron(-2420, 0, -Math.PI / 2, 0x64748b));
    // Derecho (+X): flecha apuntando hacia el centro (-X)
    group.add(createInwardChevron(2420, 0, Math.PI / 2, 0x64748b));

    // 5. Badges cardinales perimetrales de alta visibilidad en los 4 bordes exteriores
    // FRENTE (+Z)
    const frontSprite = this.createPerimeterBadge({
      title: 'FRENTE (+Z)',
      subtitle: 'VISTA PRINCIPAL',
      icon: '▲',
      borderColor: '#0284c7',
      accentColor: '#0284c7',
      titleColor: '#ffffff',
      subtitleColor: '#38bdf8',
      isFront: true
    });
    frontSprite.position.set(0, 65, 2680);
    frontSprite.scale.set(820, 155, 1);
    group.add(frontSprite);

    // ATRÁS (-Z)
    const backSprite = this.createPerimeterBadge({
      title: 'ATRÁS (-Z)',
      subtitle: 'VISTA POSTERIOR',
      icon: '▼',
      borderColor: '#475569',
      accentColor: '#334155',
      titleColor: '#f8fafc',
      subtitleColor: '#94a3b8',
      isFront: false
    });
    backSprite.position.set(0, 65, -2680);
    backSprite.scale.set(780, 148, 1);
    group.add(backSprite);

    // IZQUIERDA (-X)
    const leftSprite = this.createPerimeterBadge({
      title: 'IZQUIERDA (-X)',
      subtitle: 'LATERAL IZQUIERDO',
      icon: '►',
      borderColor: '#475569',
      accentColor: '#334155',
      titleColor: '#f8fafc',
      subtitleColor: '#94a3b8',
      isFront: false
    });
    leftSprite.position.set(-2680, 65, 0);
    leftSprite.scale.set(780, 148, 1);
    group.add(leftSprite);

    // DERECHA (+X)
    const rightSprite = this.createPerimeterBadge({
      title: 'DERECHA (+X)',
      subtitle: 'LATERAL DERECHO',
      icon: '◄',
      borderColor: '#475569',
      accentColor: '#334155',
      titleColor: '#f8fafc',
      subtitleColor: '#94a3b8',
      isFront: false
    });
    rightSprite.position.set(2680, 65, 0);
    rightSprite.scale.set(780, 148, 1);
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

    // Etiqueta flotante informativa cuando el maniquí está seleccionado
    if (isSelected) {
      const selectedBadge = this.createCardinalBadge(
        'Escala Humana (1.72 m) · Arrastra libremente',
        '#f59e0b',
        '#ffffff',
        440,
        58
      );
      selectedBadge.position.set(0, 35, 370);
      selectedBadge.scale.set(310, 42, 1);
      figureGroup.add(selectedBadge);
    }

    // Marcar todos los elementos del maniquí para poder seleccionarlo y arrastrarlo con el ratón
    figureGroup.traverse(obj => {
      obj.userData = {
        ...obj.userData,
        isReferenceGuide: true
      };
    });

    return figureGroup;
  }

  /**
   * Crea un badge perimetral de alta resolución (1600x300 px), gran escala y máxima legibilidad
   * con icono direccional, título principal destacado y subtítulo técnico descriptivo.
   */
  private createPerimeterBadge(options: {
    title: string;
    subtitle: string;
    icon: string;
    borderColor: string;
    accentColor: string;
    titleColor: string;
    subtitleColor: string;
    isFront: boolean;
  }): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const w = 1600;
    const h = 300;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.clearRect(0, 0, w, h);

      // Sombra suave proyectada para despegar visualmente la tarjeta del fondo
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 10;

      // Tarjeta principal con bordes redondeados
      ctx.fillStyle = options.isFront ? 'rgba(10, 16, 30, 0.96)' : 'rgba(15, 23, 42, 0.94)';
      ctx.beginPath();
      ctx.roundRect(16, 16, w - 32, h - 32, 44);
      ctx.fill();

      // Desactivar sombra para contornos y tipografía
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Borde del badge
      ctx.strokeStyle = options.borderColor;
      ctx.lineWidth = options.isFront ? 7 : 5;
      ctx.stroke();

      // Pastilla de icono a la izquierda
      const iconBoxX = 48;
      const iconBoxY = 48;
      const iconBoxSize = 204;
      ctx.fillStyle = options.accentColor;
      ctx.beginPath();
      ctx.roundRect(iconBoxX, iconBoxY, iconBoxSize, iconBoxSize, 36);
      ctx.fill();

      // Icono direccional (flecha) dentro de la pastilla
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 105px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(options.icon, iconBoxX + iconBoxSize / 2, iconBoxY + iconBoxSize / 2 + 4);

      // Título principal en mayúsculas negrita
      const textStartX = iconBoxX + iconBoxSize + 48;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = options.titleColor;
      ctx.font = '800 84px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(options.title, textStartX, 138);

      // Subtítulo técnico
      ctx.fillStyle = options.subtitleColor;
      ctx.font = '700 40px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(options.subtitle, textStartX, 218);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;

    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false
    });
    return new THREE.Sprite(mat);
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
      ctx.font = 'bold 20px "Inter", system-ui, -apple-system, sans-serif';
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