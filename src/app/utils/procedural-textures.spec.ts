import * as THREE from 'three';
import { ProceduralTextureFactory } from './procedural-textures';

describe('ProceduralTextureFactory (Fase 2 - Optimización VRAM y Pipeline Procedural)', () => {
  beforeEach(() => {
    ProceduralTextureFactory.clearCache();
    ProceduralTextureFactory.setLowSpecMode(false);
  });

  afterEach(() => {
    ProceduralTextureFactory.clearCache();
  });

  describe('Resoluciones y Modo Bajo Consumo', () => {
    it('debe retornar 512 en resolución estándar y 256 en modo bajo consumo', () => {
      expect(ProceduralTextureFactory.getResolution(false)).toBe(512);
      expect(ProceduralTextureFactory.getResolution(true)).toBe(256);

      ProceduralTextureFactory.setLowSpecMode(true);
      expect(ProceduralTextureFactory.getResolution()).toBe(256);

      ProceduralTextureFactory.setLowSpecMode(false);
      expect(ProceduralTextureFactory.getResolution()).toBe(512);
    });
  });

  describe('getBoardTexture', () => {
    it('debe generar y cachear texturas de madera con veta longitudinal (length)', () => {
      const tex1 = ProceduralTextureFactory.getBoardTexture('#c19a6b', 'wood', 'length', false);
      expect(tex1).toBeInstanceOf(THREE.CanvasTexture);
      expect(tex1.userData?.['isShared']).toBe(true);

      const tex2 = ProceduralTextureFactory.getBoardTexture('#c19a6b', 'wood', 'length', false);
      expect(tex2).toBe(tex1); // Hit de caché LRU
    });

    it('debe diferenciar texturas cuando cambia la dirección de veta (grain)', () => {
      const texLength = ProceduralTextureFactory.getBoardTexture('#c19a6b', 'wood', 'length', false);
      const texWidth = ProceduralTextureFactory.getBoardTexture('#c19a6b', 'wood', 'width', false);
      expect(texLength).not.toBe(texWidth);
    });

    it('debe soportar linos textiles, alto brillo, piedras y listones WPC', () => {
      const texLinen = ProceduralTextureFactory.getBoardTexture('#e2e8f0', 'linen', 'none', false);
      const texGloss = ProceduralTextureFactory.getBoardTexture('#ffffff', 'gloss', 'none', false);
      const texStone = ProceduralTextureFactory.getBoardTexture('#1e293b', 'stone', 'none', false);
      const texWpc = ProceduralTextureFactory.getBoardTexture('#ad7d49', 'wpc', 'length', false);

      expect(texLinen).toBeInstanceOf(THREE.CanvasTexture);
      expect(texGloss).toBeInstanceOf(THREE.CanvasTexture);
      expect(texStone).toBeInstanceOf(THREE.CanvasTexture);
      expect(texWpc).toBeInstanceOf(THREE.CanvasTexture);
    });

    it('debe evictar texturas antiguas con .dispose() al superar la capacidad máxima de 64', () => {
      const textures: THREE.CanvasTexture[] = [];
      const disposeSpies: Array<ReturnType<typeof vi.spyOn>> = [];

      for (let i = 0; i < 70; i++) {
        const hex = `#${i.toString(16).padStart(6, '0')}`;
        const tex = ProceduralTextureFactory.getBoardTexture(hex, 'wood', 'length', true);
        textures.push(tex);
        disposeSpies.push(vi.spyOn(tex, 'dispose'));
      }

      // Al menos las primeras texturas deben haber sido evictadas y llamadas con dispose()
      const disposedCount = disposeSpies.filter(spy => spy.mock.calls.length > 0).length;
      expect(disposedCount).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Pisos y Paredes Arquitectónicas', () => {
    it('debe generar MeshStandardMaterial para pisos arquitectónicos de Fase 4', () => {
      const finishes: Parameters<typeof ProceduralTextureFactory.getFloorMaterial>[0][] = [
        'wood_light',
        'porcelain_rectified_white',
        'spc_herringbone_honey',
        'microcement_light',
        'terrazzo_veneciano'
      ];

      for (const f of finishes) {
        const mat = ProceduralTextureFactory.getFloorMaterial(f, 4000, 4000, true);
        expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
        expect(mat.map).toBeTruthy();
      }
    });

    it('debe generar MeshStandardMaterial para paredes arquitectónicas de Fase 4', () => {
      const finishes: Parameters<typeof ProceduralTextureFactory.getWallMaterial>[0][] = [
        'subway_tile_white',
        'subway_tile_navy',
        'hydraulic_tile_geo',
        'microcement_wall',
        'paint_sage_green',
        'wpc_slats_walnut'
      ];

      for (const f of finishes) {
        const mat = ProceduralTextureFactory.getWallMaterial(f, 3000, 2400, true);
        expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial);
        expect(mat.map).toBeTruthy();
      }
    });
  });
});
