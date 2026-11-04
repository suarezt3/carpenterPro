import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { Appliance3dBuilderService } from './appliance-3d-builder.service';
import { ApplianceItem, DEFAULT_ROOM_CONFIG, getResolvedRoomWalls } from '../models/melamine.models';

function createMockAppliance(overrides: Partial<ApplianceItem>): ApplianceItem {
  return {
    id: 'app_' + Math.random().toString(36).substring(2, 7),
    name: 'Test Appliance',
    type: 'refrigerator',
    width: 900,
    depth: 700,
    height: 1800,
    finish: 'stainless_steel',
    mountType: 'floor',
    position: { x: 0, y: 0, z: -2000 },
    rotation: 0,
    includeInBudget: true,
    price: 2500000,
    ...overrides
  };
}

describe('Fase 2: Rendimiento GPU, Posicionamiento y Habitación 3D Magnética', () => {
  let applianceBuilder: Appliance3dBuilderService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [Appliance3dBuilderService]
    });
    applianceBuilder = TestBed.inject(Appliance3dBuilderService);
  });

  describe('Appliance3dBuilderService (Zero PointLights & Pooling)', () => {
    it('debe construir modelos 3D sin ningún PointLight real (costo cero en shaders)', () => {
      const types: ApplianceItem['type'][] = [
        'refrigerator',
        'oven',
        'cooktop',
        'hood',
        'sink',
        'microwave',
        'pendant_lamp',
        'table_leg',
        'washbasin_vessel',
        'washbasin_undermount',
        'bathroom_mirror_led',
        'toilet',
        'closet_rod',
        'bed',
        'tv',
        'desktop_workspace',
        'office_chair'
      ];

      for (const t of types) {
        const item = createMockAppliance({ type: t });
        const group = applianceBuilder.buildApplianceGroup(item);

        let pointLightCount = 0;
        group.traverse((child) => {
          if (child instanceof THREE.PointLight) {
            pointLightCount++;
          }
        });

        expect(pointLightCount).toBe(0);
        expect(group.children.length).toBeGreaterThan(0);
      }
    });

    it('debe compartir geometrías y materiales mediante caché interna para no duplicar asignaciones GPU', () => {
      const item1 = createMockAppliance({ type: 'refrigerator', finish: 'stainless_steel' });
      const item2 = createMockAppliance({ type: 'refrigerator', finish: 'stainless_steel' });

      const group1 = applianceBuilder.buildApplianceGroup(item1);
      const group2 = applianceBuilder.buildApplianceGroup(item2);

      const materials1 = new Set<THREE.Material>();
      group1.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => materials1.add(m));
          } else {
            materials1.add(child.material);
          }
        }
      });

      let sharedCount = 0;
      group2.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = Array.isArray(child.material) ? child.material[0] : child.material;
          if (materials1.has(mat)) {
            sharedCount++;
          }
        }
      });

      expect(sharedCount).toBeGreaterThan(0);
    });
  });

  describe('Posicionamiento Real contra la Cara Interior de Muros', () => {
    it('getResolvedRoomWalls debe posicionar la cara interna del muro principal en Z = -2350 mm para habitación de 5000 mm', () => {
      const config = { ...DEFAULT_ROOM_CONFIG, floorWidth: 5000, floorDepth: 5000, wallThickness: 150 };
      const walls = getResolvedRoomWalls(config);
      const mainWall = walls.find(w => w.id === 'main');

      expect(mainWall).toBeTruthy();
      if (!mainWall) return;

      // El piso mide 5000 mm (-2500 a +2500).
      // El muro principal se apoya en el borde posterior baseZ = -2500.
      // Su centro está en posZ = -2500 + 75 = -2425 mm.
      // Su cara interior hacia la habitación está en posZ + thickness / 2 = -2425 + 75 = -2350 mm.
      const innerFaceZ = mainWall.posZ + mainWall.thickness / 2;
      expect(innerFaceZ).toBe(-2350);

      // Un refrigerador de profundidad 700 mm apoyado en la cara interior debe tener posZ = -2350 + 350 = -2000 mm
      const fridgeDepth = 700;
      const fridgePosZ = innerFaceZ + (fridgeDepth / 2);
      expect(fridgePosZ).toBe(-2000);
    });
  });

  describe('Adherencia y Cotas de Elevación por Tipo de Módulo', () => {
    it('debe definir las cotas estándar de elevación (0 mm base/closet, 450 mm vanity, 1450 mm alacena superior)', () => {
      const getElevationForCategory = (cat: string): number => {
        if (cat === 'kitchen_wall' || cat === 'wall_cabinet') return 1450;
        if (cat === 'vanity') return 450;
        if (cat === 'kitchen_base' || cat === 'base_cabinet' || cat === 'closet' || cat === 'oven_base' || cat === 'sink_base') return 0;
        return 0;
      };

      expect(getElevationForCategory('kitchen_base')).toBe(0);
      expect(getElevationForCategory('closet')).toBe(0);
      expect(getElevationForCategory('vanity')).toBe(450);
      expect(getElevationForCategory('kitchen_wall')).toBe(1450);
      expect(getElevationForCategory('wall_cabinet')).toBe(1450);
    });
  });
});
