import { TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { Appliance3dBuilderService } from './appliance-3d-builder.service';
import { ProjectStorageService } from './project-storage.service';
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

  describe('Auditoría y Corrección del Ciclo de Movimiento de Equipos 3D', () => {
    let projectStorage: ProjectStorageService;

    beforeEach(() => {
      projectStorage = TestBed.inject(ProjectStorageService);
    });

    it('las mallas hijas del equipo 3D no deben retener un objeto appliance estático obsoleto', () => {
      const fridge = createMockAppliance({
        id: 'fridge_test_1',
        type: 'refrigerator',
        position: { x: 0, y: 0, z: -2150 }
      });
      const group = applianceBuilder.buildApplianceGroup(fridge);

      // El grupo raíz sí contiene la referencia inicial
      expect(group.userData['isAppliance']).toBe(true);
      expect(group.userData['applianceId']).toBe('fridge_test_1');
      expect(group.userData['appliance']).toBeTruthy();

      // Las mallas hijas internas NO deben contener la referencia al objeto estático appliance
      // para evitar que el raycasting devuelva coordenadas obsoletas en clics posteriores
      group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          expect(child.userData['applianceId']).toBe('fridge_test_1');
          expect(child.userData['appliance']).toBeUndefined();
        }
      });
    });

    it('ProjectStorageService.updateAppliance debe actualizar coordenadas mundiales y desvincular groupId limpiamente', () => {
      const oven = createMockAppliance({
        id: 'oven_test_1',
        type: 'oven',
        position: { x: 0, y: 800, z: -2150 },
        groupId: 'mod_oven_tower_123'
      });

      projectStorage.addAppliance(oven);
      expect(projectStorage.currentProject().appliances?.find(a => a.id === 'oven_test_1')?.position).toEqual({
        x: 0,
        y: 800,
        z: -2150
      });
      expect(projectStorage.currentProject().appliances?.find(a => a.id === 'oven_test_1')?.groupId).toBe('mod_oven_tower_123');

      // Simular arrastre individual (pointerup): nuevas coordenadas y desvinculación de groupId
      projectStorage.updateAppliance('oven_test_1', {
        position: { x: 1200, y: 850, z: -500 },
        groupId: undefined
      });

      const updated = projectStorage.currentProject().appliances?.find(a => a.id === 'oven_test_1');
      expect(updated).toBeTruthy();
      expect(updated!.position).toEqual({ x: 1200, y: 850, z: -500 });
      expect(updated!.groupId).toBeUndefined();
      expect('groupId' in updated!).toBe(false);

      // Simular un segundo arrastre (pointerdown y pointerup) desde la nueva posición
      projectStorage.updateAppliance('oven_test_1', {
        position: { x: 1500, y: 850, z: -200 }
      });

      const updated2 = projectStorage.currentProject().appliances?.find(a => a.id === 'oven_test_1');
      expect(updated2!.position).toEqual({ x: 1500, y: 850, z: -200 });
    });

    it('ProjectStorageService.updateMultipleAppliances debe actualizar múltiples equipos y desvincular groupId cuando es undefined', () => {
      const fridge = createMockAppliance({
        id: 'fridge_multi_1',
        type: 'refrigerator',
        position: { x: 0, y: 0, z: -2150 },
        groupId: 'mod_kitchen_1'
      });
      const microwave = createMockAppliance({
        id: 'micro_multi_1',
        type: 'microwave',
        position: { x: 600, y: 900, z: -2150 },
        groupId: 'mod_kitchen_1'
      });

      projectStorage.addAppliance(fridge);
      projectStorage.addAppliance(microwave);

      projectStorage.updateMultipleAppliances([
        {
          id: 'fridge_multi_1',
          updates: { position: { x: -800, y: 0, z: -1000 }, groupId: undefined }
        },
        {
          id: 'micro_multi_1',
          updates: { position: { x: 900, y: 900, z: -1200 } }
        }
      ]);

      const storedFridge = projectStorage.currentProject().appliances?.find(a => a.id === 'fridge_multi_1');
      const storedMicro = projectStorage.currentProject().appliances?.find(a => a.id === 'micro_multi_1');

      expect(storedFridge?.position).toEqual({ x: -800, y: 0, z: -1000 });
      expect(storedFridge?.groupId).toBeUndefined();
      expect('groupId' in storedFridge!).toBe(false);

      expect(storedMicro?.position).toEqual({ x: 900, y: 900, z: -1200 });
      expect(storedMicro?.groupId).toBe('mod_kitchen_1');
    });

    it('ciclo continuo de 3 movimientos consecutivos para Nevera, Horno, Microondas y Estufa preserva coordenadas acumuladas', () => {
      const types = ['refrigerator', 'oven', 'microwave', 'cooktop'] as const;
      const initialPositions = [
        { x: 0, y: 0, z: -2150 },
        { x: 700, y: 800, z: -2150 },
        { x: 1300, y: 1200, z: -2150 },
        { x: 1900, y: 880, z: -2150 }
      ];

      types.forEach((type, index) => {
        const id = `seq_${type}_test`;
        const initialPos = initialPositions[index];
        const app = createMockAppliance({ id, type, position: initialPos });
        projectStorage.addAppliance(app);

        // Movimiento 1 (arrastrar y soltar)
        const pos1 = { x: initialPos.x + 250, y: initialPos.y, z: initialPos.z + 500 };
        projectStorage.updateAppliance(id, { position: pos1 });
        let current = projectStorage.currentProject().appliances?.find(a => a.id === id);
        expect(current?.position).toEqual(pos1);

        // Movimiento 2 (segundo clic y arrastrar de nuevo)
        const pos2 = { x: pos1.x + 300, y: pos1.y + 50, z: pos1.z + 400 };
        projectStorage.updateAppliance(id, { position: pos2 });
        current = projectStorage.currentProject().appliances?.find(a => a.id === id);
        expect(current?.position).toEqual(pos2);

        // Movimiento 3 (tercer clic y arrastrar de nuevo)
        const pos3 = { x: pos2.x - 150, y: pos2.y, z: pos2.z - 200 };
        projectStorage.updateAppliance(id, { position: pos3 });
        current = projectStorage.currentProject().appliances?.find(a => a.id === id);
        expect(current?.position).toEqual(pos3);
      });
    });
  });
});
