import * as THREE from 'three';
import { FloorMaterialType, WallMaterialType } from '../models/melamine.models';

/**
 * Motor generador de texturas procedurales arquitectónicas de alta fidelidad.
 * Crea mapas difusos (color) y de relieve (bump) en memoria usando HTML5 Canvas.
 * No depende de conexiones externas, no sufre fallos de CORS ni URLs caídas.
 */
export class ProceduralTextureFactory {
  private static canvasCache = new Map<string, { map: THREE.CanvasTexture; bump?: THREE.CanvasTexture }>();

  // ==========================================
  // PISOS ARQUITECTÓNICOS
  // ==========================================

  static getFloorMaterial(
    type: FloorMaterialType,
    widthMm = 5000,
    depthMm = 5000
  ): THREE.MeshStandardMaterial {
    const key = `floor_${type}`;
    let textures = this.canvasCache.get(key);

    if (!textures) {
      textures = this.generateFloorTextures(type);
      this.canvasCache.set(key, textures);
    }

    const mat = new THREE.MeshStandardMaterial({
      map: textures.map.clone(),
      roughness: 0.35,
      metalness: 0.05,
    });

    if (textures.bump) {
      mat.bumpMap = textures.bump.clone();
      mat.bumpScale = 0.015;
    }

    // Calibrar repetición basada en medidas físicas reales en mm
    const repeatX = Math.max(1, Math.round(widthMm / 1000));
    const repeatY = Math.max(1, Math.round(depthMm / 1000));

    mat.map!.wrapS = THREE.RepeatWrapping;
    mat.map!.wrapT = THREE.RepeatWrapping;
    mat.map!.repeat.set(repeatX, repeatY);
    mat.map!.needsUpdate = true;

    if (mat.bumpMap) {
      mat.bumpMap.wrapS = THREE.RepeatWrapping;
      mat.bumpMap.wrapT = THREE.RepeatWrapping;
      mat.bumpMap.repeat.set(repeatX, repeatY);
      mat.bumpMap.needsUpdate = true;
    }

    // Ajuste específico de rugosidad/brillo según material
    switch (type) {
      case 'marble_white':
        mat.roughness = 0.18; // Pulido reflectante
        mat.metalness = 0.08;
        if (mat.bumpMap) mat.bumpScale = 0.005;
        break;
      case 'wood_light':
      case 'wood_walnut':
        mat.roughness = 0.42; // Satinado madera natural
        mat.metalness = 0.02;
        if (mat.bumpMap) mat.bumpScale = 0.02;
        break;
      case 'concrete_gray':
        mat.roughness = 0.65; // Mate pulido
        mat.metalness = 0.01;
        if (mat.bumpMap) mat.bumpScale = 0.03;
        break;
      case 'tile_dark':
        mat.roughness = 0.28; // Porcelanato oscuro semi-brillo
        mat.metalness = 0.05;
        if (mat.bumpMap) mat.bumpScale = 0.025;
        break;
    }

    return mat;
  }

  // ==========================================
  // PAREDES ARQUITECTÓNICAS
  // ==========================================

  static getWallMaterial(
    type: WallMaterialType,
    lengthMm = 3600,
    heightMm = 2600
  ): THREE.MeshStandardMaterial {
    const key = `wall_${type}`;
    let textures = this.canvasCache.get(key);

    if (!textures) {
      textures = this.generateWallTextures(type);
      this.canvasCache.set(key, textures);
    }

    const mat = new THREE.MeshStandardMaterial({
      map: textures.map.clone(),
      roughness: 0.4,
      metalness: 0.02,
    });

    if (textures.bump) {
      mat.bumpMap = textures.bump.clone();
      mat.bumpScale = 0.02;
    }

    // Repetición proporcional a la longitud y altura del muro
    let repeatX = 1;
    let repeatY = 1;

    switch (type) {
      case 'subway_tile_white':
      case 'subway_tile_emerald':
        // Cada azulejo mide 100mm x 200mm aprox en canvas repetido
        repeatX = Math.max(1, Math.round(lengthMm / 1000) * 2);
        repeatY = Math.max(1, Math.round(heightMm / 1000) * 3);
        mat.roughness = 0.15; // Azulejo cerámico brillante
        if (mat.bumpMap) mat.bumpScale = 0.035;
        break;
      case 'vertical_slats_wood':
        repeatX = Math.max(1, Math.round(lengthMm / 500));
        repeatY = Math.max(1, Math.round(heightMm / 1200));
        mat.roughness = 0.45;
        if (mat.bumpMap) mat.bumpScale = 0.05;
        break;
      case 'concrete_smooth':
        repeatX = Math.max(1, Math.round(lengthMm / 1800));
        repeatY = Math.max(1, Math.round(heightMm / 1800));
        mat.roughness = 0.7;
        if (mat.bumpMap) mat.bumpScale = 0.02;
        break;
      case 'plaster_warm':
        repeatX = Math.max(1, Math.round(lengthMm / 1200));
        repeatY = Math.max(1, Math.round(heightMm / 1200));
        mat.roughness = 0.85; // Yeso mate
        if (mat.bumpMap) mat.bumpScale = 0.015;
        break;
    }

    mat.map!.wrapS = THREE.RepeatWrapping;
    mat.map!.wrapT = THREE.RepeatWrapping;
    mat.map!.repeat.set(repeatX, repeatY);
    mat.map!.needsUpdate = true;

    if (mat.bumpMap) {
      mat.bumpMap.wrapS = THREE.RepeatWrapping;
      mat.bumpMap.wrapT = THREE.RepeatWrapping;
      mat.bumpMap.repeat.set(repeatX, repeatY);
      mat.bumpMap.needsUpdate = true;
    }

    return mat;
  }

  // ==========================================
  // GENERADORES DE PISO
  // ==========================================

  private static generateFloorTextures(type: FloorMaterialType): { map: THREE.CanvasTexture; bump?: THREE.CanvasTexture } {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bumpCtx = bumpCanvas.getContext('2d')!;

    if (type === 'wood_light' || type === 'wood_walnut') {
      this.drawWoodPlanks(ctx, bumpCtx, size, type === 'wood_light');
    } else if (type === 'marble_white') {
      this.drawMarble(ctx, bumpCtx, size);
    } else if (type === 'concrete_gray') {
      this.drawConcrete(ctx, bumpCtx, size);
    } else if (type === 'tile_dark') {
      this.drawFloorTiles(ctx, bumpCtx, size);
    }

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const bump = new THREE.CanvasTexture(bumpCanvas);

    return { map, bump };
  }

  // Duelas de madera con vetas y juntas
  private static drawWoodPlanks(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    isLight: boolean
  ) {
    const plankCount = 8;
    const plankH = size / plankCount;

    // Colores base
    const baseColorsLight = ['#d8c29d', '#e0cdab', '#cfb992', '#e5d5b7', '#cbb38a'];
    const baseColorsDark = ['#5c4033', '#4d3326', '#664a3d', '#3d261a', '#543b2b'];
    const baseColors = isLight ? baseColorsLight : baseColorsDark;

    // Fondo inicial
    ctx.fillStyle = isLight ? '#d4bfa0' : '#4a3224';
    ctx.fillRect(0, 0, size, size);
    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < plankCount; i++) {
      const y = i * plankH;
      const color = baseColors[i % baseColors.length];

      ctx.fillStyle = color;
      ctx.fillRect(0, y, size, plankH);

      // Líneas de vetas sutiles dentro de la duela
      ctx.strokeStyle = isLight ? 'rgba(120, 85, 45, 0.12)' : 'rgba(20, 10, 5, 0.22)';
      ctx.lineWidth = 1.5;
      for (let j = 0; j < 12; j++) {
        const lineY = y + (j / 12) * plankH;
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.bezierCurveTo(
          size * 0.33, lineY + (Math.sin(i * 3 + j) * 4),
          size * 0.66, lineY - (Math.sin(i * 2 + j) * 4),
          size, lineY
        );
        ctx.stroke();
      }

      // Juntas horizontales entre duelas
      ctx.fillStyle = isLight ? 'rgba(70, 45, 25, 0.35)' : 'rgba(10, 5, 0, 0.6)';
      ctx.fillRect(0, y + plankH - 2, size, 2);

      // Relieve de junta en bumpMap
      bumpCtx.fillStyle = '#202020';
      bumpCtx.fillRect(0, y + plankH - 3, size, 3);

      // Juntas verticales escalonadas (stagger)
      const splits = [(i * 0.43) % 1, ((i * 0.43) % 1 + 0.5) % 1];
      for (const split of splits) {
        const splitX = split * size;
        ctx.fillStyle = isLight ? 'rgba(70, 45, 25, 0.35)' : 'rgba(10, 5, 0, 0.6)';
        ctx.fillRect(splitX, y, 2, plankH);

        bumpCtx.fillStyle = '#202020';
        bumpCtx.fillRect(splitX - 1, y, 3, plankH);
      }
    }
  }

  // Mármol porcelanato Calacatta con vetas orgánicas
  private static drawMarble(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    // Fondo blanco hueso porcelánico
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, size, size);

    // Gradiente sutil
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#f1f3f5');
    grad.addColorStop(1, '#e9ecef');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#909090';
    bumpCtx.fillRect(0, 0, size, size);

    // Vetas grises suaves marmoleadas
    const drawVein = (startX: number, startY: number, endX: number, endY: number, width: number, alpha: number) => {
      ctx.strokeStyle = `rgba(130, 140, 150, ${alpha})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(startX, startY);

      const midX1 = (startX * 2 + endX) / 3 + (Math.random() - 0.5) * 120;
      const midY1 = (startY * 2 + endY) / 3 + (Math.random() - 0.5) * 80;
      const midX2 = (startX + endX * 2) / 3 + (Math.random() - 0.5) * 120;
      const midY2 = (startY + endY * 2) / 3 + (Math.random() - 0.5) * 80;

      ctx.bezierCurveTo(midX1, midY1, midX2, midY2, endX, endY);
      ctx.stroke();

      // Ramificación
      if (width > 2) {
        ctx.lineWidth = width * 0.4;
        ctx.beginPath();
        ctx.moveTo(midX1, midY1);
        ctx.lineTo(midX1 + (Math.random() - 0.5) * 150, midY1 + (Math.random() - 0.5) * 150);
        ctx.stroke();
      }
    };

    // Vetas maestras y secundarias
    drawVein(0, size * 0.2, size, size * 0.85, 4.5, 0.28);
    drawVein(size * 0.1, 0, size * 0.9, size * 0.7, 3, 0.22);
    drawVein(size * 0.4, size, size, size * 0.3, 2, 0.18);
    drawVein(0, size * 0.75, size * 0.6, size, 2.5, 0.2);

    // Baldosas cuadradas grandes 60x60cm con junta ultrafina
    const gridCount = 2;
    const step = size / gridCount;
    ctx.strokeStyle = 'rgba(180, 185, 190, 0.4)';
    ctx.lineWidth = 1.5;
    bumpCtx.strokeStyle = '#303030';
    bumpCtx.lineWidth = 2;

    for (let i = 1; i < gridCount; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(size, i * step);
      ctx.stroke();

      bumpCtx.beginPath();
      bumpCtx.moveTo(i * step, 0);
      bumpCtx.lineTo(i * step, size);
      bumpCtx.stroke();

      bumpCtx.beginPath();
      bumpCtx.moveTo(0, i * step);
      bumpCtx.lineTo(size, i * step);
      bumpCtx.stroke();
    }
  }

  // Concreto pulido con microtextura
  private static drawConcrete(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#a6adb4';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    // Textura de granos y áridos
    const imgData = ctx.getImageData(0, 0, size, size);
    const bumpData = bumpCtx.getImageData(0, 0, size, size);
    const data = imgData.data;
    const bdata = bumpData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 22;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));

      const bVal = 128 + noise * 1.5;
      bdata[i] = bVal;
      bdata[i + 1] = bVal;
      bdata[i + 2] = bVal;
    }

    ctx.putImageData(imgData, 0, 0);
    bumpCtx.putImageData(bumpData, 0, 0);

    // Juntas de dilatación del piso de concreto
    ctx.strokeStyle = 'rgba(70, 75, 80, 0.45)';
    ctx.lineWidth = 2;
    bumpCtx.strokeStyle = '#202020';
    bumpCtx.lineWidth = 3;

    ctx.strokeRect(0, 0, size, size);
    bumpCtx.strokeRect(0, 0, size, size);
  }

  // Baldosas oscuras tipo grafito
  private static drawFloorTiles(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#272b30';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    const tiles = 4;
    const tileSize = size / tiles;

    for (let y = 0; y < tiles; y++) {
      for (let x = 0; x < tiles; x++) {
        const toneVar = (Math.sin(x * 7 + y * 13) * 6);
        const r = 40 + toneVar;
        const g = 44 + toneVar;
        const b = 49 + toneVar;

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);

        // Relieve baldosa sobresaliente
        bumpCtx.fillStyle = '#a0a0a0';
        bumpCtx.fillRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
      }
    }

    // Fraguas oscuras
    bumpCtx.fillStyle = '#101010';
    for (let i = 0; i <= tiles; i++) {
      bumpCtx.fillRect(i * tileSize - 2, 0, 4, size);
      bumpCtx.fillRect(0, i * tileSize - 2, size, 4);
    }
  }

  // ==========================================
  // GENERADORES DE PARED
  // ==========================================

  private static generateWallTextures(type: WallMaterialType): { map: THREE.CanvasTexture; bump?: THREE.CanvasTexture } {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bumpCtx = bumpCanvas.getContext('2d')!;

    if (type === 'subway_tile_white' || type === 'subway_tile_emerald') {
      this.drawSubwayTiles(ctx, bumpCtx, size, type === 'subway_tile_white');
    } else if (type === 'vertical_slats_wood') {
      this.drawWoodSlats(ctx, bumpCtx, size);
    } else if (type === 'concrete_smooth') {
      this.drawSmoothConcreteWall(ctx, bumpCtx, size);
    } else if (type === 'plaster_warm') {
      this.drawWarmPlaster(ctx, bumpCtx, size);
    }

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const bump = new THREE.CanvasTexture(bumpCanvas);

    return { map, bump };
  }

  // Azulejos tipo Subway Tile (cerámica con bisel y juntas)
  private static drawSubwayTiles(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    isWhite: boolean
  ) {
    const rows = 8;
    const cols = 4;
    const tileH = size / rows;
    const tileW = size / cols;
    const grout = 4;

    // Color de junta (frague)
    const groutColor = isWhite ? '#b0b8c0' : '#2d3748';
    ctx.fillStyle = groutColor;
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#202020'; // Fragua hundida
    bumpCtx.fillRect(0, 0, size, size);

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2 === 1) ? tileW / 2 : 0;
      const y = r * tileH;

      for (let c = -1; c <= cols; c++) {
        const x = c * tileW + offsetX;

        const tx = x + grout / 2;
        const ty = y + grout / 2;
        const tw = tileW - grout;
        const th = tileH - grout;

        if (tx + tw < 0 || tx > size) continue;

        // Tono cerámico con sutil variación
        if (isWhite) {
          const lum = 245 + Math.round((Math.sin(r * 5 + c * 3) * 5));
          ctx.fillStyle = `rgb(${lum}, ${lum}, ${lum + 2})`;
        } else {
          // Verde Esmeralda artesanal
          const g = 80 + Math.round((Math.sin(r * 5 + c * 3) * 12));
          ctx.fillStyle = `rgb(12, ${g}, 55)`;
        }

        ctx.fillRect(tx, ty, tw, th);

        // Bisel cerámico (luz superior e izquierda)
        ctx.fillStyle = isWhite ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.18)';
        ctx.fillRect(tx, ty, tw, 3);
        ctx.fillRect(tx, ty, 3, th);

        // Sombra inferior y derecha
        ctx.fillStyle = isWhite ? 'rgba(0, 0, 0, 0.08)' : 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(tx, ty + th - 3, tw, 3);
        ctx.fillRect(tx + tw - 3, ty, 3, th);

        // Relieve en bumpMap (baldosa sobresale con bisel)
        bumpCtx.fillStyle = '#b0b0b0';
        bumpCtx.fillRect(tx + 2, ty + 2, tw - 4, th - 4);
      }
    }
  }

  // Listones verticales de madera (Acoustic wood slats)
  private static drawWoodSlats(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    const slatCount = 16;
    const slatWidth = size / slatCount;
    const gap = slatWidth * 0.35;
    const woodWidth = slatWidth - gap;

    // Fondo oscuro acústico
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#101010';
    bumpCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < slatCount; i++) {
      const x = i * slatWidth;

      // Color madera roble cálido
      ctx.fillStyle = '#c8a97e';
      ctx.fillRect(x, 0, woodWidth, size);

      // Microvetas en listón
      ctx.strokeStyle = 'rgba(100, 70, 30, 0.15)';
      ctx.lineWidth = 1;
      for (let v = 0; v < 4; v++) {
        const vx = x + (v + 1) * (woodWidth / 5);
        ctx.beginPath();
        ctx.moveTo(vx, 0);
        ctx.lineTo(vx + (Math.sin(i + v) * 2), size);
        ctx.stroke();
      }

      // Bump: listón sobresale fuertemente del fondo negro
      bumpCtx.fillStyle = '#d0d0d0';
      bumpCtx.fillRect(x, 0, woodWidth, size);
    }
  }

  // Concreto arquitectónico suave
  private static drawSmoothConcreteWall(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#c5cbd0';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 14;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // Yeso / Plaster arquitectónico mate cálido
  private static drawWarmPlaster(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#888888';
    bumpCtx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const bumpData = bumpCtx.getImageData(0, 0, size, size);
    const data = imgData.data;
    const bdata = bumpData.data;

    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 8;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n));

      bdata[i] = 128 + n * 2;
      bdata[i + 1] = 128 + n * 2;
      bdata[i + 2] = 128 + n * 2;
    }
    ctx.putImageData(imgData, 0, 0);
    bumpCtx.putImageData(bumpData, 0, 0);
  }
}
