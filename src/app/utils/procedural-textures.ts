import * as THREE from 'three';
import { FloorMaterialType, WallMaterialType } from '../models/melamine.models';

/**
 * Motor generador de texturas procedurales arquitectónicas de alta fidelidad.
 * Basado en las colecciones de fabricantes líderes como Corona y Holztek.
 * Crea mapas difusos (color) y de relieve (bump) en memoria usando HTML5 Canvas.
 * Cero dependencias de conexiones externas, sin CORS y con renderizado instantáneo.
 */
export class ProceduralTextureFactory {
  private static canvasCache = new Map<string, { map: THREE.CanvasTexture; bump?: THREE.CanvasTexture }>();
  private static repeatCache = new Map<string, { map: THREE.CanvasTexture; bump?: THREE.CanvasTexture }>();

  // ==========================================
  // PISOS ARQUITECTÓNICOS
  // ==========================================
  static getFloorMaterial(
    type: FloorMaterialType,
    widthMm = 5000,
    depthMm = 5000
  ): THREE.MeshStandardMaterial {
    const baseKey = `floor_${type}`;
    const repeatX = Math.max(1, Math.round(widthMm / 1000));
    const repeatY = Math.max(1, Math.round(depthMm / 1000));
    const configured = this.getOrCreateRepeatedTextures(baseKey, repeatX, repeatY, () =>
      this.generateFloorTextures(type)
    );

    const mat = new THREE.MeshStandardMaterial({
      map: configured.map,
      roughness: 0.35,
      metalness: 0.05,
    });

    if (configured.bump) {
      mat.bumpMap = configured.bump;
      mat.bumpScale = 0.015;
    }

    // Ajuste físico según tipo de material
    switch (type) {
      case 'marble_white':
        mat.roughness = 0.16; // Pulido brillante espejo
        mat.metalness = 0.08;
        if (mat.bumpMap) mat.bumpScale = 0.005;
        break;
      case 'marble_calacatta_gold':
        mat.roughness = 0.14; // Ultra pulido rectificado
        mat.metalness = 0.09;
        if (mat.bumpMap) mat.bumpScale = 0.006;
        break;
      case 'travertine_beige':
        mat.roughness = 0.48; // Piedra calcárea satinada
        mat.metalness = 0.02;
        if (mat.bumpMap) mat.bumpScale = 0.025;
        break;
      case 'stone_slate_black':
        mat.roughness = 0.58; // Pizarra hendida mate
        mat.metalness = 0.04;
        if (mat.bumpMap) mat.bumpScale = 0.045;
        break;
      case 'wood_light':
      case 'wood_guayacan':
      case 'wood_walnut':
      case 'wood_haya':
        mat.roughness = 0.40; // Duelas satinadas
        mat.metalness = 0.02;
        if (mat.bumpMap) mat.bumpScale = 0.022;
        break;
      case 'concrete_gray':
      case 'concrete_arena':
        mat.roughness = 0.62; // Cemento mate pulido
        mat.metalness = 0.02;
        if (mat.bumpMap) mat.bumpScale = 0.028;
        break;
      case 'concrete_white':
        mat.roughness = 0.55; // Cemento blanco luminoso
        mat.metalness = 0.03;
        if (mat.bumpMap) mat.bumpScale = 0.02;
        break;
      case 'tile_dark':
        mat.roughness = 0.28; // Porcelanato oscuro semibrillo
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
    const baseKey = `wall_${type}`;

    // Repetición proporcional a la longitud y altura del muro
    let repeatX = 1;
    let repeatY = 1;
    let roughness = 0.4;
    let metalness = 0.02;
    let bumpScale = 0.02;

    switch (type) {
      case 'brick_clay':
      case 'brick_white':
        // Ladrillos caravista estándar 24x6 cm aprox
        repeatX = Math.max(1, Math.round(lengthMm / 900));
        repeatY = Math.max(1, Math.round(heightMm / 900));
        roughness = 0.80; // Arcilla mate rugosa
        metalness = 0.01;
        bumpScale = 0.06;
        break;
      case 'subway_tile_white':
      case 'subway_tile_emerald':
      case 'subway_tile_black':
        // Azulejos metro 10x20 cm
        repeatX = Math.max(1, Math.round(lengthMm / 1000) * 2);
        repeatY = Math.max(1, Math.round(heightMm / 1000) * 3);
        roughness = type === 'subway_tile_black' ? 0.35 : 0.15; // Cerámica esmaltada
        bumpScale = 0.035;
        break;
      case 'marble_wall_calacatta':
        repeatX = Math.max(1, Math.round(lengthMm / 2000));
        repeatY = Math.max(1, Math.round(heightMm / 2400));
        roughness = 0.15;
        metalness = 0.06;
        bumpScale = 0.006;
        break;
      case 'kitchen_backsplash_quartz':
        repeatX = Math.max(1, Math.round(lengthMm / 1600));
        repeatY = Math.max(1, Math.round(heightMm / 1600));
        roughness = 0.28;
        metalness = 0.03;
        bumpScale = 0.008;
        break;
      case 'kitchen_backsplash_mosaic':
        repeatX = Math.max(1, Math.round(lengthMm / 600));
        repeatY = Math.max(1, Math.round(heightMm / 600));
        roughness = 0.24;
        bumpScale = 0.04;
        break;
      case 'vertical_slats_wood':
        repeatX = Math.max(1, Math.round(lengthMm / 500));
        repeatY = Math.max(1, Math.round(heightMm / 1200));
        roughness = 0.45;
        bumpScale = 0.05;
        break;
      case 'concrete_smooth':
        repeatX = Math.max(1, Math.round(lengthMm / 1800));
        repeatY = Math.max(1, Math.round(heightMm / 1800));
        roughness = 0.7;
        bumpScale = 0.02;
        break;
      case 'plaster_warm':
        repeatX = Math.max(1, Math.round(lengthMm / 1200));
        repeatY = Math.max(1, Math.round(heightMm / 1200));
        roughness = 0.85;
        bumpScale = 0.015;
        break;
    }

    const configured = this.getOrCreateRepeatedTextures(baseKey, repeatX, repeatY, () =>
      this.generateWallTextures(type)
    );

    const mat = new THREE.MeshStandardMaterial({
      map: configured.map,
      roughness,
      metalness,
    });

    if (configured.bump) {
      mat.bumpMap = configured.bump;
      mat.bumpScale = bumpScale;
    }

    return mat;
  }

  private static getOrCreateRepeatedTextures(
    baseKey: string,
    repeatX: number,
    repeatY: number,
    generator: () => { map: THREE.CanvasTexture; bump?: THREE.CanvasTexture }
  ): { map: THREE.CanvasTexture; bump?: THREE.CanvasTexture } {
    const repeatKey = `${baseKey}_${repeatX}_${repeatY}`;
    const existingRepeat = this.repeatCache.get(repeatKey);
    if (existingRepeat) {
      return existingRepeat;
    }

    let baseTextures = this.canvasCache.get(baseKey);
    if (!baseTextures) {
      baseTextures = generator();
      this.canvasCache.set(baseKey, baseTextures);
    }

    const mapClone = baseTextures.map.clone();
    mapClone.wrapS = THREE.RepeatWrapping;
    mapClone.wrapT = THREE.RepeatWrapping;
    mapClone.repeat.set(repeatX, repeatY);
    mapClone.needsUpdate = true;

    let bumpClone: THREE.CanvasTexture | undefined;
    if (baseTextures.bump) {
      bumpClone = baseTextures.bump.clone();
      bumpClone.wrapS = THREE.RepeatWrapping;
      bumpClone.wrapT = THREE.RepeatWrapping;
      bumpClone.repeat.set(repeatX, repeatY);
      bumpClone.needsUpdate = true;
    }

    const configured = { map: mapClone, bump: bumpClone };
    this.repeatCache.set(repeatKey, configured);
    return configured;
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

    switch (type) {
      case 'wood_light':
        this.drawWoodPlanks(ctx, bumpCtx, size, 'light');
        break;
      case 'wood_guayacan':
        this.drawWoodPlanks(ctx, bumpCtx, size, 'guayacan');
        break;
      case 'wood_walnut':
        this.drawWoodPlanks(ctx, bumpCtx, size, 'walnut');
        break;
      case 'wood_haya':
        this.drawWoodPlanks(ctx, bumpCtx, size, 'haya');
        break;
      case 'marble_white':
        this.drawMarble(ctx, bumpCtx, size, 'carrara');
        break;
      case 'marble_calacatta_gold':
        this.drawMarble(ctx, bumpCtx, size, 'calacatta_gold');
        break;
      case 'travertine_beige':
        this.drawTravertine(ctx, bumpCtx, size);
        break;
      case 'stone_slate_black':
        this.drawSlateStone(ctx, bumpCtx, size);
        break;
      case 'concrete_gray':
        this.drawConcrete(ctx, bumpCtx, size, 'gray');
        break;
      case 'concrete_arena':
        this.drawConcrete(ctx, bumpCtx, size, 'arena');
        break;
      case 'concrete_white':
        this.drawConcrete(ctx, bumpCtx, size, 'white');
        break;
      case 'tile_dark':
        this.drawFloorTiles(ctx, bumpCtx, size);
        break;
    }

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const bump = new THREE.CanvasTexture(bumpCanvas);
    return { map, bump };
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

    switch (type) {
      case 'brick_clay':
        this.drawBrickWall(ctx, bumpCtx, size, 'clay');
        break;
      case 'brick_white':
        this.drawBrickWall(ctx, bumpCtx, size, 'white');
        break;
      case 'subway_tile_white':
        this.drawSubwayTiles(ctx, bumpCtx, size, 'white');
        break;
      case 'subway_tile_emerald':
        this.drawSubwayTiles(ctx, bumpCtx, size, 'emerald');
        break;
      case 'subway_tile_black':
        this.drawSubwayTiles(ctx, bumpCtx, size, 'black');
        break;
      case 'marble_wall_calacatta':
        this.drawMarble(ctx, bumpCtx, size, 'calacatta_gold', true);
        break;
      case 'kitchen_backsplash_quartz':
        this.drawQuartzBacksplash(ctx, bumpCtx, size);
        break;
      case 'kitchen_backsplash_mosaic':
        this.drawHexMosaic(ctx, bumpCtx, size);
        break;
      case 'vertical_slats_wood':
        this.drawWoodSlats(ctx, bumpCtx, size);
        break;
      case 'concrete_smooth':
        this.drawSmoothConcreteWall(ctx, bumpCtx, size);
        break;
      case 'plaster_warm':
        this.drawWarmPlaster(ctx, bumpCtx, size);
        break;
    }

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const bump = new THREE.CanvasTexture(bumpCanvas);
    return { map, bump };
  }

  // ==========================================
  // DIBUJADO DETALLADO DE PATRONES EN CANVAS
  // ==========================================

  // 1. Duelas de madera con veta y biseles (Holztek y Corona Madera)
  private static drawWoodPlanks(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    variety: 'light' | 'guayacan' | 'walnut' | 'haya'
  ) {
    const plankCount = 8;
    const plankH = size / plankCount;

    let baseColors: string[];
    let bgColor: string;
    let veinColor: string;
    let jointColor: string;

    switch (variety) {
      case 'light': // Roble Nórdico
        baseColors = ['#d8c29d', '#e0cdab', '#cfb992', '#e5d5b7', '#cbb38a'];
        bgColor = '#d4bfa0';
        veinColor = 'rgba(120, 85, 45, 0.12)';
        jointColor = 'rgba(70, 45, 25, 0.35)';
        break;
      case 'guayacan': // Corona Guayacán Miel
        baseColors = ['#c19a6b', '#cb9d64', '#b68953', '#d4a872', '#ad7d49'];
        bgColor = '#bd8e55';
        veinColor = 'rgba(90, 50, 15, 0.20)';
        jointColor = 'rgba(50, 25, 5, 0.45)';
        break;
      case 'walnut': // Nogal Americano
        baseColors = ['#5c4033', '#4d3326', '#664a3d', '#3d261a', '#543b2b'];
        bgColor = '#4a3224';
        veinColor = 'rgba(20, 10, 5, 0.25)';
        jointColor = 'rgba(10, 5, 0, 0.6)';
        break;
      case 'haya': // Haya Clara
        baseColors = ['#e8ddd0', '#ede3d8', '#dfd2c2', '#f2e9df', '#dacbba'];
        bgColor = '#e5d8c8';
        veinColor = 'rgba(140, 115, 85, 0.10)';
        jointColor = 'rgba(90, 75, 60, 0.25)';
        break;
    }

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < plankCount; i++) {
      const y = i * plankH;
      const color = baseColors[i % baseColors.length];
      ctx.fillStyle = color;
      ctx.fillRect(0, y, size, plankH);

      // Micro-vetas longitudinales
      ctx.strokeStyle = veinColor;
      ctx.lineWidth = 1.4;
      for (let j = 0; j < 12; j++) {
        const lineY = y + (j / 12) * plankH;
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.bezierCurveTo(
          size * 0.33, lineY + (Math.sin(i * 3 + j) * 5),
          size * 0.66, lineY - (Math.sin(i * 2 + j) * 5),
          size, lineY
        );
        ctx.stroke();
      }

      // Juntas horizontales entre duelas
      ctx.fillStyle = jointColor;
      ctx.fillRect(0, y + plankH - 2, size, 2);

      // Relieve junta en bump
      bumpCtx.fillStyle = '#202020';
      bumpCtx.fillRect(0, y + plankH - 3, size, 3);

      // Juntas verticales escalonadas (stagger)
      const splits = [(i * 0.43) % 1, ((i * 0.43) % 1 + 0.5) % 1];
      for (const split of splits) {
        const splitX = split * size;
        ctx.fillStyle = jointColor;
        ctx.fillRect(splitX, y, 2, plankH);

        bumpCtx.fillStyle = '#202020';
        bumpCtx.fillRect(splitX - 1, y, 3, plankH);
      }
    }
  }

  // 2. Mármoles pulidos (Carrara Blanco y Madrid Oro Calacatta)
  private static drawMarble(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    variety: 'carrara' | 'calacatta_gold',
    isSeamlessWall = false
  ) {
    const isGold = variety === 'calacatta_gold';

    // Base porcelánica blanca
    ctx.fillStyle = isGold ? '#faf8f2' : '#f8f9fa';
    ctx.fillRect(0, 0, size, size);

    const grad = ctx.createLinearGradient(0, 0, size, size);
    if (isGold) {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#faf6ee');
      grad.addColorStop(1, '#f3ece0');
    } else {
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, '#f1f3f5');
      grad.addColorStop(1, '#e9ecef');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#909090';
    bumpCtx.fillRect(0, 0, size, size);

    // Función de trazo de veta orgánica
    const drawVein = (
      startX: number,
      startY: number,
      endX: number,
      endY: number,
      width: number,
      alpha: number,
      goldTint: boolean
    ) => {
      const color = goldTint
        ? `rgba(180, 140, 70, ${alpha * 1.2})`
        : `rgba(130, 140, 150, ${alpha})`;

      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(startX, startY);

      const midX1 = (startX * 2 + endX) / 3 + (Math.sin(startX) * 70);
      const midY1 = (startY * 2 + endY) / 3 + (Math.cos(startY) * 50);
      const midX2 = (startX + endX * 2) / 3 + (Math.cos(endX) * 70);
      const midY2 = (startY + endY * 2) / 3 + (Math.sin(endY) * 50);

      ctx.bezierCurveTo(midX1, midY1, midX2, midY2, endX, endY);
      ctx.stroke();

      // Ramificación fina
      if (width > 2.5) {
        ctx.lineWidth = width * 0.45;
        ctx.beginPath();
        ctx.moveTo(midX1, midY1);
        ctx.lineTo(midX1 + (Math.sin(midY1) * 90), midY1 + (Math.cos(midX1) * 80));
        ctx.stroke();
      }
    };

    // Vetas maestras
    drawVein(0, size * 0.15, size, size * 0.85, 4.5, 0.28, isGold);
    drawVein(size * 0.2, 0, size * 0.85, size * 0.7, 3.2, 0.22, false);
    if (isGold) {
      drawVein(0, size * 0.55, size * 0.75, size, 3.8, 0.35, true); // Veta dorada dominante
      drawVein(size * 0.45, 0, size, size * 0.45, 2.0, 0.25, true);
    } else {
      drawVein(0, size * 0.75, size * 0.6, size, 2.5, 0.20, false);
    }

    // Si no es un muro continuo, dibujar juntas de baldosas gran formato
    if (!isSeamlessWall) {
      const gridCount = 2;
      const step = size / gridCount;
      ctx.strokeStyle = isGold ? 'rgba(210, 195, 175, 0.5)' : 'rgba(180, 185, 190, 0.4)';
      ctx.lineWidth = 1.5;

      bumpCtx.strokeStyle = '#303030';
      bumpCtx.lineWidth = 2.5;

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
  }

  // 3. Travertino Romano Clásico (Piedra calcárea)
  private static drawTravertine(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#ded4c3';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    // Bandas sedimentarias horizontales sutiles
    for (let y = 0; y < size; y += 4) {
      const tone = Math.sin(y * 0.04) * 8 + Math.cos(y * 0.08) * 4;
      ctx.fillStyle = `rgba(185, 170, 145, ${0.12 + (tone > 0 ? 0.08 : 0)})`;
      ctx.fillRect(0, y, size, 3);
    }

    // Poros y pequeñas cavidades minerales
    for (let p = 0; p < 350; p++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const pw = 4 + Math.random() * 12;
      const ph = 1.5 + Math.random() * 3;
      ctx.fillStyle = 'rgba(120, 105, 85, 0.25)';
      ctx.fillRect(px, py, pw, ph);

      bumpCtx.fillStyle = '#303030';
      bumpCtx.fillRect(px, py, pw, ph);
    }

    // Juntas rectificadas
    ctx.strokeStyle = 'rgba(120, 105, 85, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);

    bumpCtx.strokeStyle = '#202020';
    bumpCtx.lineWidth = 3;
    bumpCtx.strokeRect(0, 0, size, size);
  }

  // 4. Pizarra Negra Hendida (Corona Estructurado)
  private static drawSlateStone(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#1e2227';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    // Capas laminadas de lajas
    for (let y = 0; y < size; y += 8) {
      const shade = Math.sin(y * 0.02) * 12;
      ctx.fillStyle = `rgb(${30 + shade}, ${34 + shade}, ${39 + shade})`;
      ctx.fillRect(0, y, size, 8);

      // Relieve escalonado en bump
      const bumpVal = 100 + shade * 3;
      bumpCtx.fillStyle = `rgb(${bumpVal}, ${bumpVal}, ${bumpVal})`;
      bumpCtx.fillRect(0, y, size, 8);
    }

    // Grano fino
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 14;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    // Juntas perimetrales
    bumpCtx.fillStyle = '#101010';
    bumpCtx.fillRect(0, 0, size, 3);
    bumpCtx.fillRect(0, 0, 3, size);
  }

  // 5. Concretos pulidos (Corona Porcelatech Concrete & Boss Arena)
  private static drawConcrete(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    variety: 'gray' | 'arena' | 'white'
  ) {
    let baseHex: string;
    switch (variety) {
      case 'gray':
        baseHex = '#a6adb4';
        break;
      case 'arena':
        baseHex = '#c8bead';
        break;
      case 'white':
        baseHex = '#e8eaec';
        break;
    }

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    // Textura de granos y micro-áridos
    const imgData = ctx.getImageData(0, 0, size, size);
    const bumpData = bumpCtx.getImageData(0, 0, size, size);
    const data = imgData.data;
    const bdata = bumpData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 20;
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
    ctx.strokeStyle = variety === 'white' ? 'rgba(160, 165, 170, 0.45)' : 'rgba(70, 75, 80, 0.45)';
    ctx.lineWidth = 2;
    bumpCtx.strokeStyle = '#202020';
    bumpCtx.lineWidth = 3;

    ctx.strokeRect(0, 0, size, size);
    bumpCtx.strokeRect(0, 0, size, size);
  }

  // 6. Baldosas oscuras tipo grafito (Corona ARD Pro)
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

  // 7. Ladrillo a la vista (Arcilla rústica o Blanco loft decapado)
  private static drawBrickWall(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    variety: 'clay' | 'white'
  ) {
    const isClay = variety === 'clay';
    const rows = 12;
    const cols = 4;
    const rowH = size / rows;
    const colW = size / cols;
    const mortar = 6;

    // Mortero de junta (gris claro)
    ctx.fillStyle = isClay ? '#c4beb5' : '#dad6cf';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#252525'; // Mortero hundido
    bumpCtx.fillRect(0, 0, size, size);

    for (let r = 0; r < rows; r++) {
      const offsetX = (r % 2 === 1) ? colW / 2 : 0;
      const y = r * rowH;

      for (let c = -1; c <= cols; c++) {
        const x = c * colW + offsetX;
        const bx = x + mortar / 2;
        const by = y + mortar / 2;
        const bw = colW - mortar;
        const bh = rowH - mortar;

        if (bx + bw < 0 || bx > size) continue;

        // Color del ladrillo individual con variaciones auténticas
        const seed = Math.sin(r * 11 + c * 7);
        if (isClay) {
          const red = Math.round(180 + seed * 25);
          const green = Math.round(85 + seed * 18);
          const blue = Math.round(50 + seed * 14);
          ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        } else {
          // Ladrillo blanco decapado
          const lum = Math.round(230 + seed * 15);
          ctx.fillStyle = `rgb(${lum}, ${lum - 2}, ${lum - 6})`;
        }

        ctx.fillRect(bx, by, bw, bh);

        // Textura porosa y rugosa del ladrillo cocido
        for (let p = 0; p < 8; p++) {
          const px = bx + Math.random() * bw;
          const py = by + Math.random() * bh;
          ctx.fillStyle = isClay ? 'rgba(70, 30, 15, 0.25)' : 'rgba(160, 155, 150, 0.2)';
          ctx.fillRect(px, py, 4, 3);
        }

        // Relieve en bumpMap (el ladrillo sobresale del mortero)
        bumpCtx.fillStyle = '#b5b5b5';
        bumpCtx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
      }
    }
  }

  // 8. Azulejo Subway Tile (Metro Blanco, Esmeralda, Negro Carbón)
  private static drawSubwayTiles(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    variety: 'white' | 'emerald' | 'black'
  ) {
    const rows = 8;
    const cols = 4;
    const tileH = size / rows;
    const tileW = size / cols;
    const grout = 4;

    // Color de junta (frague)
    let groutColor: string;
    switch (variety) {
      case 'white':
        groutColor = '#b0b8c0';
        break;
      case 'emerald':
        groutColor = '#2d3748';
        break;
      case 'black':
        groutColor = '#1a1d20';
        break;
    }

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

        // Tono cerámico según variedad
        if (variety === 'white') {
          const lum = 245 + Math.round((Math.sin(r * 5 + c * 3) * 5));
          ctx.fillStyle = `rgb(${lum}, ${lum}, ${lum + 2})`;
        } else if (variety === 'emerald') {
          const g = 80 + Math.round((Math.sin(r * 5 + c * 3) * 12));
          ctx.fillStyle = `rgb(12, ${g}, 55)`;
        } else {
          // Negro Carbón
          const dark = 30 + Math.round((Math.sin(r * 5 + c * 3) * 4));
          ctx.fillStyle = `rgb(${dark}, ${dark + 2}, ${dark + 4})`;
        }

        ctx.fillRect(tx, ty, tw, th);

        // Bisel cerámico (reflejo de luz superior/izquierda)
        ctx.fillStyle = variety === 'white'
          ? 'rgba(255, 255, 255, 0.45)'
          : 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(tx, ty, tw, 3);
        ctx.fillRect(tx, ty, 3, th);

        // Sombra inferior y derecha del bisel
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.fillRect(tx, ty + th - 3, tw, 3);
        ctx.fillRect(tx + tw - 3, ty, 3, th);

        // Bump: baldosa biselada elevada
        bumpCtx.fillStyle = '#b8b8b8';
        bumpCtx.fillRect(tx + 2, ty + 2, tw - 4, th - 4);
      }
    }
  }

  // 9. Salpicadero de Cuarzo Continuo para Cocina
  private static drawQuartzBacksplash(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#858585';
    bumpCtx.fillRect(0, 0, size, size);

    // Micropartículas de cuarzo reflectantes
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (Math.random() < 0.08) {
        // Puntos brillantes minerales de sílice
        data[i] = Math.min(255, data[i] + 35);
        data[i + 1] = Math.min(255, data[i + 1] + 35);
        data[i + 2] = Math.min(255, data[i + 2] + 40);
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  // 10. Mosaico Hexagonal para Salpicadero de Cocina (Corona Sandalo)
  private static drawHexMosaic(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#7a7469'; // Junta gris oscuro
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#202020';
    bumpCtx.fillRect(0, 0, size, size);

    const r = 40; // Radio del hexágono
    const h = r * Math.sqrt(3);
    const stepX = r * 1.5;
    const stepY = h;

    const cols = Math.ceil(size / stepX) + 2;
    const rows = Math.ceil(size / stepY) + 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = col * stepX;
        const cy = row * stepY + (col % 2 === 1 ? h / 2 : 0);

        // Color del hexágono (tonos arena porcelánica)
        const tone = Math.sin(col * 3 + row * 5) * 8;
        const red = 226 + tone;
        const green = 217 + tone;
        const blue = 204 + tone;

        ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        bumpCtx.fillStyle = '#b0b0b0';

        // Dibujar polígono hexágono
        ctx.beginPath();
        bumpCtx.beginPath();
        for (let a = 0; a < 6; a++) {
          const angle = (Math.PI / 3) * a;
          const hx = cx + (r - 2) * Math.cos(angle);
          const hy = cy + (r - 2) * Math.sin(angle);
          if (a === 0) {
            ctx.moveTo(hx, hy);
            bumpCtx.moveTo(hx, hy);
          } else {
            ctx.lineTo(hx, hy);
            bumpCtx.lineTo(hx, hy);
          }
        }
        ctx.closePath();
        bumpCtx.closePath();
        ctx.fill();
        bumpCtx.fill();
      }
    }
  }

  // 11. Listones verticales de madera (Acoustic wood slats)
  private static drawWoodSlats(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    const slatCount = 16;
    const slatWidth = size / slatCount;
    const gap = slatWidth * 0.35;
    const woodWidth = slatWidth - gap;

    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#101010';
    bumpCtx.fillRect(0, 0, size, size);

    for (let i = 0; i < slatCount; i++) {
      const x = i * slatWidth;
      ctx.fillStyle = '#c8a97e';
      ctx.fillRect(x, 0, woodWidth, size);

      ctx.strokeStyle = 'rgba(100, 70, 30, 0.15)';
      ctx.lineWidth = 1;
      for (let v = 0; v < 4; v++) {
        const vx = x + (v + 1) * (woodWidth / 5);
        ctx.beginPath();
        ctx.moveTo(vx, 0);
        ctx.lineTo(vx + (Math.sin(i + v) * 2), size);
        ctx.stroke();
      }

      bumpCtx.fillStyle = '#d0d0d0';
      bumpCtx.fillRect(x, 0, woodWidth, size);
    }
  }

  // 12. Concreto arquitectónico liso
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

  // 13. Yeso / Pintura lavable satinada
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