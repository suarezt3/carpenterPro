import * as THREE from 'three';
import { FloorMaterialType, WallMaterialType, GrainDirection } from '../models/melamine.models';

export type MelamineTextureType = 'wood' | 'stone' | 'linen' | 'gloss' | 'wpc' | 'solid';

interface CachedEntry {
  map: THREE.CanvasTexture;
  bump?: THREE.CanvasTexture;
  lastUsed: number;
}

/**
 * Caché LRU acotada para texturas WebGL procedurales.
 * Libera explícitamente la memoria VRAM invocando .dispose() sobre las texturas
 * cuando se supera la capacidad máxima predeterminada (64 texturas concurrentes).
 */
class TextureLRUCache {
  private cache = new Map<string, CachedEntry>();
  private readonly maxCapacity: number;

  constructor(maxCapacity = 64) {
    this.maxCapacity = maxCapacity;
  }

  get(key: string): { map: THREE.CanvasTexture; bump?: THREE.CanvasTexture } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    entry.lastUsed = Date.now();
    return { map: entry.map, bump: entry.bump };
  }

  set(key: string, textures: { map: THREE.CanvasTexture; bump?: THREE.CanvasTexture }): void {
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      existing.lastUsed = Date.now();
      return;
    }

    if (this.cache.size >= this.maxCapacity) {
      this.evictOldest();
    }

    textures.map.userData = { ...(textures.map.userData || {}), isShared: true };
    if (textures.bump) {
      textures.bump.userData = { ...(textures.bump.userData || {}), isShared: true };
    }

    this.cache.set(key, {
      map: textures.map,
      bump: textures.bump,
      lastUsed: Date.now()
    });
  }

  clear(): void {
    for (const [, entry] of this.cache.entries()) {
      entry.map.dispose();
      if (entry.bump) entry.bump.dispose();
    }
    this.cache.clear();
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const entry = this.cache.get(oldestKey);
      if (entry) {
        entry.map.dispose();
        if (entry.bump) entry.bump.dispose();
      }
      this.cache.delete(oldestKey);
    }
  }
}

/**
 * Motor generador de texturas procedurales arquitectónicas de alto rendimiento (Fase 2).
 * Unifica la resolución a 512×512 estándar y 256×256 para modo bajo consumo,
 * erradicando fugas de memoria VRAM mediante una caché LRU acotada con .dispose() explícito.
 */
export class ProceduralTextureFactory {
  private static readonly lruCache = new TextureLRUCache(64);
  private static lowSpecMode = false;

  static setLowSpecMode(enabled: boolean): void {
    this.lowSpecMode = enabled;
  }

  static getResolution(lowSpec?: boolean): number {
    const isLow = lowSpec ?? this.lowSpecMode;
    return isLow ? 256 : 512;
  }

  static clearCache(): void {
    this.lruCache.clear();
  }

  // ==========================================
  // PISOS ARQUITECTÓNICOS (512x512 / 256x256)
  // ==========================================
  static getFloorMaterial(
    type: FloorMaterialType,
    widthMm = 5000,
    depthMm = 5000,
    lowSpec?: boolean
  ): THREE.MeshStandardMaterial {
    const resolution = this.getResolution(lowSpec);
    const repeatX = Math.max(1, Math.round(widthMm / 1000));
    const repeatY = Math.max(1, Math.round(depthMm / 1000));
    const cacheKey = `floor_${type}_${resolution}_${repeatX}_${repeatY}`;

    const configured = this.getOrCreateRepeatedTextures(cacheKey, repeatX, repeatY, () =>
      this.generateFloorTextures(type, resolution)
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

    switch (type) {
      case 'marble_white':
        mat.roughness = 0.16;
        mat.metalness = 0.08;
        if (mat.bumpMap) mat.bumpScale = 0.005;
        break;
      case 'marble_calacatta_gold':
        mat.roughness = 0.14;
        mat.metalness = 0.09;
        if (mat.bumpMap) mat.bumpScale = 0.006;
        break;
      case 'travertine_beige':
        mat.roughness = 0.48;
        mat.metalness = 0.02;
        if (mat.bumpMap) mat.bumpScale = 0.025;
        break;
      case 'stone_slate_black':
        mat.roughness = 0.58;
        mat.metalness = 0.04;
        if (mat.bumpMap) mat.bumpScale = 0.045;
        break;
      case 'terrazzo_veneciano':
        mat.roughness = 0.22;
        mat.metalness = 0.05;
        if (mat.bumpMap) mat.bumpScale = 0.008;
        break;
      case 'wood_light':
      case 'wood_guayacan':
      case 'wood_walnut':
      case 'wood_haya':
      case 'spc_plank_oak':
        mat.roughness = 0.40;
        mat.metalness = 0.02;
        if (mat.bumpMap) mat.bumpScale = 0.022;
        break;
      case 'spc_herringbone_honey':
      case 'spc_herringbone_nordic':
        mat.roughness = 0.36;
        mat.metalness = 0.02;
        if (mat.bumpMap) mat.bumpScale = 0.024;
        break;
      case 'concrete_gray':
      case 'concrete_arena':
        mat.roughness = 0.62;
        mat.metalness = 0.02;
        if (mat.bumpMap) mat.bumpScale = 0.028;
        break;
      case 'concrete_white':
        mat.roughness = 0.55;
        mat.metalness = 0.03;
        if (mat.bumpMap) mat.bumpScale = 0.02;
        break;
      case 'porcelain_rectified_white':
        mat.roughness = 0.12;
        mat.metalness = 0.06;
        if (mat.bumpMap) mat.bumpScale = 0.004;
        break;
      case 'porcelain_rectified_gray':
        mat.roughness = 0.25;
        mat.metalness = 0.05;
        if (mat.bumpMap) mat.bumpScale = 0.008;
        break;
      case 'microcement_light':
      case 'microcement_warm':
        mat.roughness = 0.50;
        mat.metalness = 0.02;
        if (mat.bumpMap) mat.bumpScale = 0.015;
        break;
      case 'tile_dark':
        mat.roughness = 0.28;
        mat.metalness = 0.05;
        if (mat.bumpMap) mat.bumpScale = 0.025;
        break;
    }

    return mat;
  }

  // ==========================================
  // PAREDES ARQUITECTÓNICAS (512x512 / 256x256)
  // ==========================================
  static getWallMaterial(
    type: WallMaterialType,
    lengthMm = 3600,
    heightMm = 2600,
    lowSpec?: boolean
  ): THREE.MeshStandardMaterial {
    const resolution = this.getResolution(lowSpec);
    let repeatX = 1;
    let repeatY = 1;
    let roughness = 0.4;
    let metalness = 0.02;
    let bumpScale = 0.02;

    switch (type) {
      case 'brick_clay':
      case 'brick_white':
        repeatX = Math.max(1, Math.round(lengthMm / 900));
        repeatY = Math.max(1, Math.round(heightMm / 900));
        roughness = 0.80;
        metalness = 0.01;
        bumpScale = 0.06;
        break;
      case 'subway_tile_white':
      case 'subway_tile_emerald':
      case 'subway_tile_black':
      case 'subway_tile_navy':
        repeatX = Math.max(1, Math.round(lengthMm / 1000) * 2);
        repeatY = Math.max(1, Math.round(heightMm / 1000) * 3);
        roughness = type === 'subway_tile_black' ? 0.35 : (type === 'subway_tile_navy' ? 0.18 : 0.15);
        bumpScale = 0.035;
        break;
      case 'hydraulic_tile_patchwork':
      case 'hydraulic_tile_geo':
        repeatX = Math.max(1, Math.round(lengthMm / 600));
        repeatY = Math.max(1, Math.round(heightMm / 600));
        roughness = 0.35;
        metalness = 0.02;
        bumpScale = 0.025;
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
      case 'wpc_slats_walnut':
      case 'wpc_slats_black':
        repeatX = Math.max(1, Math.round(lengthMm / 500));
        repeatY = Math.max(1, Math.round(heightMm / 1200));
        roughness = 0.45;
        bumpScale = 0.05;
        break;
      case 'concrete_smooth':
      case 'microcement_wall':
        repeatX = Math.max(1, Math.round(lengthMm / 1800));
        repeatY = Math.max(1, Math.round(heightMm / 1800));
        roughness = 0.65;
        bumpScale = 0.02;
        break;
      case 'plaster_warm':
      case 'paint_warm_white':
      case 'paint_sage_green':
      case 'paint_charcoal':
        repeatX = Math.max(1, Math.round(lengthMm / 1200));
        repeatY = Math.max(1, Math.round(heightMm / 1200));
        roughness = 0.85;
        bumpScale = 0.015;
        break;
    }

    const cacheKey = `wall_${type}_${resolution}_${repeatX}_${repeatY}`;
    const configured = this.getOrCreateRepeatedTextures(cacheKey, repeatX, repeatY, () =>
      this.generateWallTextures(type, resolution)
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

  // ==========================================
  // TABLEROS DE MELAMINA, CUBIERTAS Y MUEBLE
  // Pipeline unificado: Maderas con veta, Linos textiles, Alto brillo,
  // Piedras, Porcelanatos y Listones WPC
  // ==========================================
  static getBoardTexture(
    colorHex: string,
    type: string = 'wood',
    grain: GrainDirection = 'length',
    lowSpec?: boolean
  ): THREE.CanvasTexture {
    const resolution = this.getResolution(lowSpec);
    const normalizedType = this.normalizeBoardType(type);
    const key = `board_${normalizedType}_${grain}_${colorHex.toLowerCase()}_${resolution}`;

    const cached = this.lruCache.get(key);
    if (cached) {
      return cached.map;
    }

    if (typeof document === 'undefined') {
      const fallback = new THREE.CanvasTexture({} as HTMLCanvasElement);
      this.lruCache.set(key, { map: fallback });
      return fallback;
    }

    const canvas = document.createElement('canvas');
    canvas.width = resolution;
    canvas.height = resolution;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallback = new THREE.CanvasTexture(canvas);
      this.lruCache.set(key, { map: fallback });
      return fallback;
    }

    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, resolution, resolution);

    switch (normalizedType) {
      case 'wood':
        this.renderWoodBoardTexture(ctx, resolution, grain);
        break;
      case 'linen':
        this.renderLinenTextileTexture(ctx, resolution);
        break;
      case 'gloss':
        this.renderHighGlossTexture(ctx, resolution);
        break;
      case 'stone':
        this.renderStoneBoardTexture(ctx, resolution, colorHex);
        break;
      case 'wpc':
        this.renderWpcSlatsTexture(ctx, resolution, grain);
        break;
      default:
        this.renderSubtleNoiseTexture(ctx, resolution);
        break;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.userData = { isShared: true };
    this.lruCache.set(key, { map: tex });
    return tex;
  }

  private static normalizeBoardType(rawType: string): MelamineTextureType {
    const lower = (rawType || '').toLowerCase();
    if (lower.includes('linen') || lower.includes('textil') || lower.includes('lino') || lower.includes('tela')) {
      return 'linen';
    }
    if (lower.includes('gloss') || lower.includes('brillo') || lower.includes('espejo') || lower.includes('shine')) {
      return 'gloss';
    }
    if (lower.includes('wpc') || lower.includes('slat') || lower.includes('alistonado') || lower.includes('ranurado')) {
      return 'wpc';
    }
    if (lower.includes('stone') || lower.includes('piedra') || lower.includes('marmol') || lower.includes('granito') || lower.includes('cuarzo') || lower.includes('dekton')) {
      return 'stone';
    }
    if (lower.includes('wood') || lower.includes('madera') || lower.includes('roble') || lower.includes('nogal') || lower.includes('cedro') || lower.includes('teca')) {
      return 'wood';
    }
    return 'solid';
  }

  // 1. Textura de Madera respetando la dirección de veta (part.grain)
  private static renderWoodBoardTexture(
    ctx: CanvasRenderingContext2D,
    size: number,
    grain: GrainDirection
  ): void {
    if (grain === 'none') {
      this.renderSubtleNoiseTexture(ctx, size);
      return;
    }

    const isAlongWidth = grain === 'width'; // Veta transversal (eje Y)
    const step = size / (size >= 512 ? 48 : 28);

    ctx.save();
    if (isAlongWidth) {
      // Rotar 90 grados para orientar la veta a lo largo del ancho
      ctx.translate(size / 2, size / 2);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-size / 2, -size / 2);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.055)';
    for (let i = 0; i < size; i += step) {
      const lineThickness = 1.2 + (Math.sin(i * 0.2) + 1) * 0.8;
      ctx.fillRect(0, i, size, lineThickness);
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
    for (let i = step / 2; i < size; i += step * 1.5) {
      ctx.fillRect(0, i, size, 1);
    }

    // Ondulación sutil de anillos anuales
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
    ctx.lineWidth = 1.2;
    for (let j = 0; j < 6; j++) {
      const yPos = (j / 6) * size;
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.bezierCurveTo(size * 0.3, yPos + 12, size * 0.7, yPos - 12, size, yPos);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 2. Lino Textil (Urdimbre y trama cruzada)
  private static renderLinenTextileTexture(ctx: CanvasRenderingContext2D, size: number): void {
    const step = size >= 512 ? 6 : 4;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    for (let x = 0; x < size; x += step) {
      ctx.fillRect(x, 0, step / 2, size);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let y = 0; y < size; y += step) {
      ctx.fillRect(0, y, size, step / 2);
    }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    for (let x = 0; x < size; x += step) {
      for (let y = 0; y < size; y += step) {
        if ((x + y) % (step * 2) === 0) {
          ctx.fillRect(x, y, step / 2, step / 2);
        }
      }
    }
  }

  // 3. Alto Brillo (Reflejo especular satinado con degradado suave)
  private static renderHighGlossTexture(ctx: CanvasRenderingContext2D, size: number): void {
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.01)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.08)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  // 4. Piedras y Mármoles (vetas orgánicas para mesones de granito/cuarzo)
  private static renderStoneBoardTexture(
    ctx: CanvasRenderingContext2D,
    size: number,
    colorHex: string
  ): void {
    const isDark = colorHex.toLowerCase() === '#1e293b' || colorHex.toLowerCase() === '#262626' || colorHex.toLowerCase() === '#111827';
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.moveTo(size * 0.05, size * 0.12);
    ctx.bezierCurveTo(size * 0.35, size * 0.42, size * 0.65, size * 0.18, size * 0.95, size * 0.75);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(size * 0.12, size * 0.65);
    ctx.bezierCurveTo(size * 0.45, size * 0.82, size * 0.75, size * 0.55, size * 0.92, size * 0.95);
    ctx.stroke();

    // Micropartículas de cuarzo reflectantes
    ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)';
    for (let i = 0; i < 40; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      ctx.fillRect(px, py, 2, 2);
    }
  }

  // 5. Listones WPC / Paneles acústicos
  private static renderWpcSlatsTexture(
    ctx: CanvasRenderingContext2D,
    size: number,
    grain: GrainDirection
  ): void {
    const isAlongWidth = grain === 'width';
    const slatCount = size >= 512 ? 16 : 8;
    const slatW = size / slatCount;
    const grooveW = slatW * 0.28;

    ctx.save();
    if (isAlongWidth) {
      ctx.translate(size / 2, size / 2);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-size / 2, -size / 2);
    }

    for (let i = 0; i < slatCount; i++) {
      const x = i * slatW;
      // Ranura oscura
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(x + slatW - grooveW, 0, grooveW, size);

      // Relieve luz del listón
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(x, 0, 2, size);
    }

    ctx.restore();
  }

  // 6. Micro-ruido difuso
  private static renderSubtleNoiseTexture(ctx: CanvasRenderingContext2D, size: number): void {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.025)';
    for (let y = 0; y < size; y += 4) {
      ctx.fillRect(0, y, size, 1);
    }
  }

  private static getOrCreateRepeatedTextures(
    cacheKey: string,
    repeatX: number,
    repeatY: number,
    generator: () => { map: THREE.CanvasTexture; bump?: THREE.CanvasTexture }
  ): { map: THREE.CanvasTexture; bump?: THREE.CanvasTexture } {
    const existing = this.lruCache.get(cacheKey);
    if (existing) {
      return existing;
    }

    const baseTextures = generator();
    const mapClone = baseTextures.map.clone();
    mapClone.wrapS = THREE.RepeatWrapping;
    mapClone.wrapT = THREE.RepeatWrapping;
    mapClone.repeat.set(repeatX, repeatY);
    mapClone.needsUpdate = true;
    mapClone.userData = { isShared: true };

    let bumpClone: THREE.CanvasTexture | undefined;
    if (baseTextures.bump) {
      bumpClone = baseTextures.bump.clone();
      bumpClone.wrapS = THREE.RepeatWrapping;
      bumpClone.wrapT = THREE.RepeatWrapping;
      bumpClone.repeat.set(repeatX, repeatY);
      bumpClone.needsUpdate = true;
      bumpClone.userData = { isShared: true };
    }

    const configured = { map: mapClone, bump: bumpClone };
    this.lruCache.set(cacheKey, configured);
    return configured;
  }

  // ==========================================
  // GENERADORES DE PISO (512x512 / 256x256)
  // ==========================================
  private static generateFloorTextures(
    type: FloorMaterialType,
    size: number
  ): { map: THREE.CanvasTexture; bump?: THREE.CanvasTexture } {
    if (typeof document === 'undefined') {
      const dummy = new THREE.CanvasTexture({} as HTMLCanvasElement);
      return { map: dummy };
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bumpCtx = bumpCanvas.getContext('2d');

    if (!ctx || !bumpCtx) {
      const dummyMap = new THREE.CanvasTexture(canvas);
      const dummyBump = new THREE.CanvasTexture(bumpCanvas);
      return { map: dummyMap, bump: dummyBump };
    }

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
      case 'spc_plank_oak':
        this.drawWoodPlanks(ctx, bumpCtx, size, 'light');
        break;
      case 'spc_herringbone_honey':
        this.drawHerringboneSPC(ctx, bumpCtx, size, 'honey');
        break;
      case 'spc_herringbone_nordic':
        this.drawHerringboneSPC(ctx, bumpCtx, size, 'nordic');
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
      case 'terrazzo_veneciano':
        this.drawTerrazzoFloor(ctx, bumpCtx, size);
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
      case 'porcelain_rectified_white':
        this.drawRectifiedPorcelain(ctx, bumpCtx, size, 'white');
        break;
      case 'porcelain_rectified_gray':
        this.drawRectifiedPorcelain(ctx, bumpCtx, size, 'gray');
        break;
      case 'microcement_light':
        this.drawMicrocement(ctx, bumpCtx, size, 'light');
        break;
      case 'microcement_warm':
        this.drawMicrocement(ctx, bumpCtx, size, 'warm');
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
  // GENERADORES DE PARED (512x512 / 256x256)
  // ==========================================
  private static generateWallTextures(
    type: WallMaterialType,
    size: number
  ): { map: THREE.CanvasTexture; bump?: THREE.CanvasTexture } {
    if (typeof document === 'undefined') {
      const dummy = new THREE.CanvasTexture({} as HTMLCanvasElement);
      return { map: dummy };
    }

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bumpCtx = bumpCanvas.getContext('2d');

    if (!ctx || !bumpCtx) {
      const dummyMap = new THREE.CanvasTexture(canvas);
      const dummyBump = new THREE.CanvasTexture(bumpCanvas);
      return { map: dummyMap, bump: dummyBump };
    }

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
      case 'subway_tile_navy':
        this.drawSubwayTiles(ctx, bumpCtx, size, 'navy');
        break;
      case 'hydraulic_tile_patchwork':
        this.drawHydraulicTiles(ctx, bumpCtx, size, 'patchwork');
        break;
      case 'hydraulic_tile_geo':
        this.drawHydraulicTiles(ctx, bumpCtx, size, 'geo');
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
        this.drawWoodSlats(ctx, bumpCtx, size, 'natural');
        break;
      case 'wpc_slats_walnut':
        this.drawWoodSlats(ctx, bumpCtx, size, 'walnut');
        break;
      case 'wpc_slats_black':
        this.drawWoodSlats(ctx, bumpCtx, size, 'black');
        break;
      case 'concrete_smooth':
        this.drawSmoothConcreteWall(ctx, bumpCtx, size);
        break;
      case 'microcement_wall':
        this.drawMicrocementWall(ctx, bumpCtx, size);
        break;
      case 'plaster_warm':
        this.drawWarmPlaster(ctx, bumpCtx, size);
        break;
      case 'paint_warm_white':
        this.drawPaintWall(ctx, bumpCtx, size, '#f9f8f4');
        break;
      case 'paint_sage_green':
        this.drawPaintWall(ctx, bumpCtx, size, '#526657');
        break;
      case 'paint_charcoal':
        this.drawPaintWall(ctx, bumpCtx, size, '#282c34');
        break;
    }

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const bump = new THREE.CanvasTexture(bumpCanvas);
    return { map, bump };
  }

  // ==========================================
  // PATRONES GRÁFICOS INTERNOS
  // ==========================================

  private static drawWoodPlanks(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    variety: 'light' | 'guayacan' | 'walnut' | 'haya'
  ) {
    const plankCount = size >= 512 ? 8 : 4;
    const plankH = size / plankCount;

    let baseColors: string[];
    let bgColor: string;
    let veinColor: string;
    let jointColor: string;

    switch (variety) {
      case 'light':
        baseColors = ['#d8c29d', '#e0cdab', '#cfb992', '#e5d5b7', '#cbb38a'];
        bgColor = '#d4bfa0';
        veinColor = 'rgba(120, 85, 45, 0.12)';
        jointColor = 'rgba(70, 45, 25, 0.35)';
        break;
      case 'guayacan':
        baseColors = ['#c19a6b', '#cb9d64', '#b68953', '#d4a872', '#ad7d49'];
        bgColor = '#bd8e55';
        veinColor = 'rgba(90, 50, 15, 0.20)';
        jointColor = 'rgba(50, 25, 5, 0.45)';
        break;
      case 'walnut':
        baseColors = ['#5c4033', '#4d3326', '#664a3d', '#3d261a', '#543b2b'];
        bgColor = '#4a3224';
        veinColor = 'rgba(20, 10, 5, 0.25)';
        jointColor = 'rgba(10, 5, 0, 0.6)';
        break;
      case 'haya':
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

      ctx.strokeStyle = veinColor;
      ctx.lineWidth = 1.2;
      for (let j = 0; j < (size >= 512 ? 10 : 6); j++) {
        const lineY = y + (j / 10) * plankH;
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.bezierCurveTo(
          size * 0.33, lineY + (Math.sin(i * 3 + j) * 4),
          size * 0.66, lineY - (Math.sin(i * 2 + j) * 4),
          size, lineY
        );
        ctx.stroke();
      }

      ctx.fillStyle = jointColor;
      ctx.fillRect(0, y + plankH - 2, size, 2);

      bumpCtx.fillStyle = '#202020';
      bumpCtx.fillRect(0, y + plankH - 2, size, 2);

      const splits = [(i * 0.43) % 1, ((i * 0.43) % 1 + 0.5) % 1];
      for (const split of splits) {
        const splitX = split * size;
        ctx.fillStyle = jointColor;
        ctx.fillRect(splitX, y, 2, plankH);

        bumpCtx.fillStyle = '#202020';
        bumpCtx.fillRect(splitX - 1, y, 2, plankH);
      }
    }
  }

  private static drawMarble(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    variety: 'carrara' | 'calacatta_gold',
    isSeamlessWall = false
  ) {
    const isGold = variety === 'calacatta_gold';

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

      const midX1 = (startX * 2 + endX) / 3 + (Math.sin(startX) * 50);
      const midY1 = (startY * 2 + endY) / 3 + (Math.cos(startY) * 40);
      const midX2 = (startX + endX * 2) / 3 + (Math.cos(endX) * 50);
      const midY2 = (startY + endY * 2) / 3 + (Math.sin(endY) * 40);

      ctx.bezierCurveTo(midX1, midY1, midX2, midY2, endX, endY);
      ctx.stroke();

      if (width > 2.5) {
        ctx.lineWidth = width * 0.45;
        ctx.beginPath();
        ctx.moveTo(midX1, midY1);
        ctx.lineTo(midX1 + (Math.sin(midY1) * 60), midY1 + (Math.cos(midX1) * 50));
        ctx.stroke();
      }
    };

    drawVein(0, size * 0.15, size, size * 0.85, 3.8, 0.28, isGold);
    drawVein(size * 0.2, 0, size * 0.85, size * 0.7, 2.6, 0.22, false);
    if (isGold) {
      drawVein(0, size * 0.55, size * 0.75, size, 3.2, 0.35, true);
      drawVein(size * 0.45, 0, size, size * 0.45, 1.8, 0.25, true);
    } else {
      drawVein(0, size * 0.75, size * 0.6, size, 2.2, 0.20, false);
    }

    if (!isSeamlessWall) {
      const gridCount = 2;
      const step = size / gridCount;
      ctx.strokeStyle = isGold ? 'rgba(210, 195, 175, 0.5)' : 'rgba(180, 185, 190, 0.4)';
      ctx.lineWidth = 1.2;

      bumpCtx.strokeStyle = '#303030';
      bumpCtx.lineWidth = 2.0;

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

  private static drawTravertine(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#ded4c3';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y += 4) {
      const tone = Math.sin(y * 0.04) * 8 + Math.cos(y * 0.08) * 4;
      ctx.fillStyle = `rgba(185, 170, 145, ${0.12 + (tone > 0 ? 0.08 : 0)})`;
      ctx.fillRect(0, y, size, 3);
    }

    const poresCount = size >= 512 ? 200 : 90;
    for (let p = 0; p < poresCount; p++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      const pw = 3 + Math.random() * 8;
      const ph = 1.2 + Math.random() * 2.5;
      ctx.fillStyle = 'rgba(120, 105, 85, 0.25)';
      ctx.fillRect(px, py, pw, ph);

      bumpCtx.fillStyle = '#303030';
      bumpCtx.fillRect(px, py, pw, ph);
    }

    ctx.strokeStyle = 'rgba(120, 105, 85, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, size, size);

    bumpCtx.strokeStyle = '#202020';
    bumpCtx.lineWidth = 2.5;
    bumpCtx.strokeRect(0, 0, size, size);
  }

  private static drawSlateStone(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#1e2227';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    for (let y = 0; y < size; y += 8) {
      const shade = Math.sin(y * 0.02) * 12;
      ctx.fillStyle = `rgb(${30 + shade}, ${34 + shade}, ${39 + shade})`;
      ctx.fillRect(0, y, size, 8);

      const bumpVal = 100 + shade * 3;
      bumpCtx.fillStyle = `rgb(${bumpVal}, ${bumpVal}, ${bumpVal})`;
      bumpCtx.fillRect(0, y, size, 8);
    }

    bumpCtx.fillStyle = '#101010';
    bumpCtx.fillRect(0, 0, size, 2);
    bumpCtx.fillRect(0, 0, 2, size);
  }

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

    // Micro-puntos de áridos
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    const dotCount = size >= 512 ? 300 : 150;
    for (let i = 0; i < dotCount; i++) {
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }

    ctx.strokeStyle = variety === 'white' ? 'rgba(160, 165, 170, 0.45)' : 'rgba(70, 75, 80, 0.45)';
    ctx.lineWidth = 1.5;
    bumpCtx.strokeStyle = '#202020';
    bumpCtx.lineWidth = 2.5;

    ctx.strokeRect(0, 0, size, size);
    bumpCtx.strokeRect(0, 0, size, size);
  }

  private static drawFloorTiles(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#272b30';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    const tiles = size >= 512 ? 4 : 2;
    const tileSize = size / tiles;

    for (let y = 0; y < tiles; y++) {
      for (let x = 0; x < tiles; x++) {
        const toneVar = (Math.sin(x * 7 + y * 13) * 6);
        const r = 40 + toneVar;
        const g = 44 + toneVar;
        const b = 49 + toneVar;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);

        bumpCtx.fillStyle = '#a0a0a0';
        bumpCtx.fillRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
      }
    }

    bumpCtx.fillStyle = '#101010';
    for (let i = 0; i <= tiles; i++) {
      bumpCtx.fillRect(i * tileSize - 1.5, 0, 3, size);
      bumpCtx.fillRect(0, i * tileSize - 1.5, size, 3);
    }
  }

  private static drawBrickWall(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    variety: 'clay' | 'white'
  ) {
    const isClay = variety === 'clay';
    const rows = size >= 512 ? 10 : 6;
    const cols = size >= 512 ? 4 : 2;
    const rowH = size / rows;
    const colW = size / cols;
    const mortar = 4;

    ctx.fillStyle = isClay ? '#c4beb5' : '#dad6cf';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#252525';
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

        const seed = Math.sin(r * 11 + c * 7);
        if (isClay) {
          const red = Math.round(180 + seed * 25);
          const green = Math.round(85 + seed * 18);
          const blue = Math.round(50 + seed * 14);
          ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        } else {
          const lum = Math.round(230 + seed * 15);
          ctx.fillStyle = `rgb(${lum}, ${lum - 2}, ${lum - 6})`;
        }

        ctx.fillRect(bx, by, bw, bh);

        bumpCtx.fillStyle = '#b5b5b5';
        bumpCtx.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
      }
    }
  }

  private static drawSubwayTiles(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    variety: 'white' | 'emerald' | 'black' | 'navy'
  ) {
    const rows = size >= 512 ? 8 : 4;
    const cols = size >= 512 ? 4 : 2;
    const tileH = size / rows;
    const tileW = size / cols;
    const grout = 3;

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
      case 'navy':
        groutColor = '#243242';
        break;
    }

    ctx.fillStyle = groutColor;
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#202020';
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

        if (variety === 'white') {
          const lum = 245 + Math.round((Math.sin(r * 5 + c * 3) * 5));
          ctx.fillStyle = `rgb(${lum}, ${lum}, ${lum + 2})`;
        } else if (variety === 'emerald') {
          const g = 80 + Math.round((Math.sin(r * 5 + c * 3) * 12));
          ctx.fillStyle = `rgb(12, ${g}, 55)`;
        } else if (variety === 'navy') {
          const b = 75 + Math.round((Math.sin(r * 5 + c * 3) * 8));
          ctx.fillStyle = `rgb(27, 50, ${b})`;
        } else {
          const dark = 30 + Math.round((Math.sin(r * 5 + c * 3) * 4));
          ctx.fillStyle = `rgb(${dark}, ${dark + 2}, ${dark + 4})`;
        }

        ctx.fillRect(tx, ty, tw, th);

        ctx.fillStyle = variety === 'white'
          ? 'rgba(255, 255, 255, 0.45)'
          : 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(tx, ty, tw, 2);
        ctx.fillRect(tx, ty, 2, th);

        bumpCtx.fillStyle = '#b8b8b8';
        bumpCtx.fillRect(tx + 1, ty + 1, tw - 2, th - 2);
      }
    }
  }

  private static drawQuartzBacksplash(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#858585';
    bumpCtx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    const flecks = size >= 512 ? 400 : 180;
    for (let i = 0; i < flecks; i++) {
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
    }
  }

  private static drawHexMosaic(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#7a7469';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#202020';
    bumpCtx.fillRect(0, 0, size, size);

    const r = size >= 512 ? 32 : 24;
    const h = r * Math.sqrt(3);
    const stepX = r * 1.5;
    const stepY = h;

    const cols = Math.ceil(size / stepX) + 2;
    const rows = Math.ceil(size / stepY) + 2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cx = col * stepX;
        const cy = row * stepY + (col % 2 === 1 ? h / 2 : 0);

        const tone = Math.sin(col * 3 + row * 5) * 8;
        const red = 226 + tone;
        const green = 217 + tone;
        const blue = 204 + tone;

        ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        bumpCtx.fillStyle = '#b0b0b0';

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

  private static drawWoodSlats(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    variety: 'natural' | 'walnut' | 'black' = 'natural'
  ) {
    const slatCount = size >= 512 ? 16 : 8;
    const slatWidth = size / slatCount;
    const gap = slatWidth * 0.35;
    const woodWidth = slatWidth - gap;

    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#101010';
    bumpCtx.fillRect(0, 0, size, size);

    let slatColor = '#c8a97e';
    let veinColor = 'rgba(100, 70, 30, 0.15)';
    if (variety === 'walnut') {
      slatColor = '#593e2b';
      veinColor = 'rgba(25, 15, 10, 0.25)';
    } else if (variety === 'black') {
      slatColor = '#24272c';
      veinColor = 'rgba(255, 255, 255, 0.05)';
    }

    for (let i = 0; i < slatCount; i++) {
      const x = i * slatWidth;
      ctx.fillStyle = slatColor;
      ctx.fillRect(x, 0, woodWidth, size);

      ctx.strokeStyle = veinColor;
      ctx.lineWidth = 1;
      for (let v = 0; v < 3; v++) {
        const vx = x + (v + 1) * (woodWidth / 4);
        ctx.beginPath();
        ctx.moveTo(vx, 0);
        ctx.lineTo(vx + (Math.sin(i + v) * 2), size);
        ctx.stroke();
      }

      bumpCtx.fillStyle = '#d0d0d0';
      bumpCtx.fillRect(x, 0, woodWidth, size);
    }
  }

  private static drawRectifiedPorcelain(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    variant: 'white' | 'gray'
  ) {
    const isWhite = variant === 'white';
    const bgBase = isWhite ? '#f8fafc' : '#64748b';
    const groutColor = isWhite ? 'rgba(200, 210, 220, 0.65)' : 'rgba(50, 60, 75, 0.85)';

    ctx.fillStyle = bgBase;
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#909090';
    bumpCtx.fillRect(0, 0, size, size);

    // Moteado micropulido sutil
    const mottlingCount = size >= 512 ? 300 : 120;
    for (let i = 0; i < mottlingCount; i++) {
      const mx = Math.random() * size;
      const my = Math.random() * size;
      const alpha = Math.random() * 0.06;
      ctx.fillStyle = isWhite ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha})`;
      ctx.fillRect(mx, my, 4 + Math.random() * 8, 4 + Math.random() * 8);
    }

    // Juntas rectificadas ultra finas (2x2 baldosas gran formato de 80x80cm)
    const half = size / 2;
    ctx.strokeStyle = groutColor;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(half, 0);
    ctx.lineTo(half, size);
    ctx.moveTo(0, half);
    ctx.lineTo(size, half);
    ctx.stroke();

    bumpCtx.strokeStyle = '#202020';
    bumpCtx.lineWidth = 1.5;
    bumpCtx.beginPath();
    bumpCtx.moveTo(half, 0);
    bumpCtx.lineTo(half, size);
    bumpCtx.moveTo(0, half);
    bumpCtx.lineTo(size, half);
    bumpCtx.stroke();
  }

  private static drawHerringboneSPC(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    variant: 'honey' | 'nordic'
  ) {
    const isHoney = variant === 'honey';
    const basePalette = isHoney
      ? ['#c59d64', '#bd935a', '#cd9f66', '#b38850', '#d4a872']
      : ['#dfd2bc', '#d6c8b1', '#e5dac5', '#cec0a8', '#ebd8c2'];
    const jointColor = isHoney ? 'rgba(70, 45, 20, 0.45)' : 'rgba(100, 90, 75, 0.35)';

    ctx.fillStyle = basePalette[0];
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    const cols = size >= 512 ? 8 : 4;
    const colW = size / cols;
    const plankH = colW * 2.2;

    for (let c = -1; c <= cols + 1; c++) {
      const x = c * colW;
      const isAlt = (c % 2 === 0);
      const rows = Math.ceil(size / plankH) + 2;

      for (let r = -1; r <= rows; r++) {
        const y = r * plankH + (isAlt ? plankH / 2 : 0);
        const colIdx = Math.abs((c * 3 + r * 7) % basePalette.length);
        const col = basePalette[colIdx];

        ctx.fillStyle = col;
        ctx.fillRect(x, y, colW, plankH);

        // Vetas finas longitudinales en la duela
        ctx.strokeStyle = isHoney ? 'rgba(80, 45, 15, 0.12)' : 'rgba(120, 100, 80, 0.08)';
        ctx.lineWidth = 1;
        for (let v = 1; v <= 3; v++) {
          const vx = x + v * (colW / 4);
          ctx.beginPath();
          ctx.moveTo(vx, y);
          ctx.lineTo(vx + (Math.sin(c + r + v) * 2), y + plankH);
          ctx.stroke();
        }

        // Microbisel perimetral
        ctx.strokeStyle = jointColor;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(x, y, colW, plankH);

        bumpCtx.strokeStyle = '#252525';
        bumpCtx.lineWidth = 1.5;
        bumpCtx.strokeRect(x, y, colW, plankH);
      }
    }
  }

  private static drawMicrocement(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    variant: 'light' | 'warm'
  ) {
    const isWarm = variant === 'warm';
    const baseColor = isWarm ? '#d6cdbd' : '#cbd5e1';

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#888888';
    bumpCtx.fillRect(0, 0, size, size);

    // Aguas y pases de llana orgánica
    const passCount = size >= 512 ? 18 : 8;
    for (let i = 0; i < passCount; i++) {
      const cx = (i * 0.37 % 1) * size;
      const cy = (i * 0.71 % 1) * size;
      const rad = (size * 0.25) + (i * 8);

      const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, rad);
      const alpha = 0.04 + (i % 3) * 0.02;
      grad.addColorStop(0, isWarm ? `rgba(255, 250, 240, ${alpha * 1.5})` : `rgba(255, 255, 255, ${alpha * 1.5})`);
      grad.addColorStop(0.6, isWarm ? `rgba(180, 165, 145, ${alpha})` : `rgba(150, 160, 175, ${alpha})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Microstippling de poros cerrados
    ctx.fillStyle = 'rgba(0, 0, 0, 0.025)';
    const stippleCount = size >= 512 ? 400 : 150;
    for (let j = 0; j < stippleCount; j++) {
      const sx = Math.random() * size;
      const sy = Math.random() * size;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
  }

  private static drawTerrazzoFloor(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#eee8dc';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#888888';
    bumpCtx.fillRect(0, 0, size, size);

    // Áridos y partículas pétreas multicolores
    const chipColors = ['#c26d53', '#374151', '#9ca3af', '#b48a60', '#ffffff', '#475569'];
    const chipCount = size >= 512 ? 420 : 180;

    for (let i = 0; i < chipCount; i++) {
      const cx = Math.random() * size;
      const cy = Math.random() * size;
      const r = 2 + Math.random() * 6;
      const color = chipColors[i % chipColors.length];

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const vertices = 4 + Math.floor(Math.random() * 3);
      for (let v = 0; v < vertices; v++) {
        const ang = (v / vertices) * Math.PI * 2;
        const dist = r * (0.6 + Math.random() * 0.8);
        ctx.lineTo(cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist);
      }
      ctx.closePath();
      ctx.fill();

      // Relieve tenue en el mapa de bump
      bumpCtx.fillStyle = color === '#ffffff' ? '#b0b0b0' : '#606060';
      bumpCtx.fillRect(cx - 1, cy - 1, 2, 2);
    }

    // Cuadrícula sutil de 60x60cm
    ctx.strokeStyle = 'rgba(160, 150, 135, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, size, size);
    bumpCtx.strokeStyle = '#303030';
    bumpCtx.lineWidth = 1.5;
    bumpCtx.strokeRect(0, 0, size, size);
  }

  private static drawHydraulicTiles(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    variant: 'patchwork' | 'geo'
  ) {
    const isPatchwork = variant === 'patchwork';
    const grid = 2;
    const step = size / grid;

    ctx.fillStyle = isPatchwork ? '#e2e8f0' : '#475569';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    for (let gx = 0; gx < grid; gx++) {
      for (let gy = 0; gy < grid; gy++) {
        const ox = gx * step;
        const oy = gy * step;
        const cx = ox + step / 2;
        const cy = oy + step / 2;
        const half = step / 2;

        ctx.fillStyle = isPatchwork ? ((gx + gy) % 2 === 0 ? '#f1f5f9' : '#e0e7ff') : '#334155';
        ctx.fillRect(ox + 2, oy + 2, step - 4, step - 4);

        // Motivo geométrico central (estrella o rombo)
        ctx.fillStyle = isPatchwork ? '#1e3a8a' : '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(cx, cy - half * 0.7);
        ctx.lineTo(cx + half * 0.7, cy);
        ctx.lineTo(cx, cy + half * 0.7);
        ctx.lineTo(cx - half * 0.7, cy);
        ctx.closePath();
        ctx.fill();

        // Círculo concéntrico interno
        ctx.fillStyle = isPatchwork ? '#d97706' : '#94a3b8';
        ctx.beginPath();
        ctx.arc(cx, cy, half * 0.32, 0, Math.PI * 2);
        ctx.fill();

        // Borde de baldosa
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(ox, oy, step, step);

        bumpCtx.strokeStyle = '#202020';
        bumpCtx.lineWidth = 2.5;
        bumpCtx.strokeRect(ox, oy, step, step);
      }
    }
  }

  private static drawMicrocementWall(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#858585';
    bumpCtx.fillRect(0, 0, size, size);

    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.07)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.05)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const count = size >= 512 ? 220 : 90;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.025)';
    for (let i = 0; i < count; i++) {
      ctx.fillRect(Math.random() * size, Math.random() * size, 3, 2);
    }
  }

  private static drawPaintWall(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number,
    colorHex: string
  ) {
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    // Textura sutil de rodillo arquitectónico mate
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    const dotCount = size >= 512 ? 350 : 150;
    for (let i = 0; i < dotCount; i++) {
      const px = Math.random() * size;
      const py = Math.random() * size;
      ctx.fillRect(px, py, 1.2, 1.2);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.035)';
    for (let j = 0; j < dotCount; j++) {
      const qx = Math.random() * size;
      const qy = Math.random() * size;
      ctx.fillRect(qx, qy, 1.2, 1.2);
    }
  }

  private static drawSmoothConcreteWall(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#c5cbd0';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    const count = size >= 512 ? 300 : 150;
    for (let i = 0; i < count; i++) {
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }
  }

  private static drawWarmPlaster(
    ctx: CanvasRenderingContext2D,
    bumpCtx: CanvasRenderingContext2D,
    size: number
  ) {
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(0, 0, size, size);

    bumpCtx.fillStyle = '#888888';
    bumpCtx.fillRect(0, 0, size, size);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
    const count = size >= 512 ? 250 : 100;
    for (let i = 0; i < count; i++) {
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }
  }
}