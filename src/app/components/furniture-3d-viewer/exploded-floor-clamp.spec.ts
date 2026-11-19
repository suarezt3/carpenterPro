import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  Material,
  ParametricCabinetConfig,
  Part,
  ProjectSettings
} from '../../models/melamine.models';
import { CabinetGeneratorService } from '../../services/cabinet-generator.service';
import { PartGeometryService } from '../../services/part-geometry.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import {
  computeFloorClampedExplodedLayout,
  FloorClampedExplodedPartLayout
} from './furniture-3d-viewer';

const TEST_MATERIALS: Material[] = [
  {
    id: 'mat_white_15',
    name: 'Melamina Blanco 15mm',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 145000,
    hasGrain: false,
    colorHex: '#f8fafc',
    category: 'board'
  },
  {
    id: 'mat_mdf_3',
    name: 'Fondo MDF 3mm',
    thickness: 3,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 35000,
    hasGrain: false,
    colorHex: '#e4e4e7',
    family: 'mdf_back',
    category: 'mdf'
  }
];

const TEST_SETTINGS: ProjectSettings = {
  sawKerf: 4,
  trimMargin: 10,
  defaultBoardThickness: 15,
  thinEdgeThickness: 0.45,
  thickEdgeThickness: 2.0,
  thinEdgeCostPerMeter: 1500,
  thickEdgeCostPerMeter: 3500,
  optimizationPreference: 'best_fit',
  currency: 'COP'
};

function makePlinthBaseConfig(
  overrides: Partial<ParametricCabinetConfig> = {}
): ParametricCabinetConfig {
  return {
    code: 'BASE_PLINTH',
    name: 'Mueble Base con Zócalo',
    moduleType: 'base_cabinet',
    category: 'kitchen_base',
    width: 800,
    height: 820,
    depth: 580,
    structureThickness: 15,
    doorThickness: 15,
    backThickness: 3,
    backType: 'groove',
    hasBackPanel: true,
    shelvesCount: 1,
    doorOpening: 'double',
    hasHandle: true,
    handleType: 'bar_modern',
    handleFinish: 'brushed_steel',
    handlePosition: 'vertical',
    structureMaterialId: 'mat_white_15',
    doorMaterialId: 'mat_white_15',
    backMaterialId: 'mat_mdf_3',
    facadeGap: 3,
    baseType: 'plinth',
    hasPlinth: true,
    plinthHeight: 80,
    hasTopCover: true,
    topTieStrips: false,
    posX: 0,
    posY: 410,
    posZ: 0,
    zoneTree: {
      id: 'base_root',
      splitDirection: 'none',
      content: {
        type: 'doors',
        doors: {
          opening: 'double',
          mount: 'overlay',
          hasHandle: true,
          handleType: 'bar_modern',
          handleFinish: 'brushed_steel'
        },
        shelvesCount: 1,
        shelfSetbackMm: 25
      }
    },
    ...overrides
  };
}

function assertExactRestore(layout: readonly FloorClampedExplodedPartLayout[]): void {
  for (const item of layout) {
    expect(item.floorLiftY).toBe(0);
    expect(item.explodedCenter.x).toBe(item.originalCenter.x);
    expect(item.explodedCenter.y).toBe(item.originalCenter.y);
    expect(item.explodedCenter.z).toBe(item.originalCenter.z);
  }
}

describe('Despiece Explosivo con Tope de Piso (computeFloorClampedExplodedLayout, Y >= 0)', () => {
  let projectStorage: ProjectStorageService;
  let cabinetGen: CabinetGeneratorService;
  let partGeometry: PartGeometryService;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    TestBed.configureTestingModule({
      providers: [ProjectStorageService, CabinetGeneratorService, PartGeometryService]
    });

    projectStorage = TestBed.inject(ProjectStorageService);
    cabinetGen = TestBed.inject(CabinetGeneratorService);
    partGeometry = TestBed.inject(PartGeometryService);

    projectStorage.clearFurniture();
    projectStorage.updateProject(
      p => ({
        ...p,
        materials: [...TEST_MATERIALS],
        settings: { ...TEST_SETTINGS }
      }),
      false
    );
  });

  afterEach(() => {
    projectStorage?.flushPendingStorageSave();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('debe mantener todas las piezas sobre Y >= -0.001 al 25/50/75/100% y restaurar exactamente al volver a 0% en mueble base con zócalo y cajón alojado', () => {
    const baseCabinet = cabinetGen.generateZoneCabinet(makePlinthBaseConfig(), TEST_MATERIALS);
    projectStorage.addParametricCabinet(baseCabinet);

    // Agregar un cajón modular alojado dentro del mueble base (hostGroupId)
    const hostedDrawer = projectStorage.addParametricDrawer({
      name: 'Cajón Alojado',
      outerWidth: 770,
      slideLength: 450,
      boxHeight: 140,
      boxThickness: 15,
      bottomThickness: 3,
      includeFront: true,
      frontMountType: 'inset',
      handleType: 'handle',
      materialId: 'mat_white_15',
      frontMaterialId: 'mat_white_15',
      bottomMaterialId: 'mat_mdf_3',
      hostGroupId: baseCabinet.group.id,
      posX: 0,
      posY: 160,
      posZ: 0
    });

    // Agregar una pieza adicional alojada en el mismo grupo del mueble base
    const hostedManualPart: Part = {
      id: 'hosted_divider_extra',
      name: 'Separador Interno Alojado',
      length: 480,
      width: 240,
      thickness: 15,
      quantity: 1,
      materialId: 'mat_white_15',
      materialName: 'Melamina Blanco 15mm',
      grain: 'none',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      posX: 0,
      posY: 500,
      posZ: 0,
      orientation: 'vertical_yz',
      groupId: baseCabinet.group.id,
      groupName: baseCabinet.group.name,
      isParametricGenerated: false
    };
    projectStorage.addPart(hostedManualPart);

    const parts = projectStorage.partsList();
    const groups = projectStorage.groupsList();
    const getWorldAABB = (part: Part) => partGeometry.getWorldAABB(part);

    expect(parts.some(p => p.componentRole === 'plinth')).toBe(true);
    expect(parts.some(p => p.groupId === hostedDrawer.id)).toBe(true);
    expect(parts.some(p => p.id === hostedManualPart.id)).toBe(true);

    // 1. Al 0%: explodedCenter debe ser exactamente igual a originalCenter
    const layoutAt0 = computeFloorClampedExplodedLayout(parts, groups, 0, getWorldAABB);
    expect(layoutAt0.length).toBe(parts.length);
    assertExactRestore(layoutAt0);

    // 2. Al 25%, 50%, 75% y 100%: ninguna pieza atraviesa el piso (bottomY >= -0.001)
    const expectedBaseCluster = `group:${baseCabinet.group.id}`;
    for (const percent of [25, 50, 75, 100]) {
      const layout = computeFloorClampedExplodedLayout(parts, groups, percent, getWorldAABB);
      expect(layout.length).toBe(parts.length);

      let anyMoved = false;
      const clusterLifts = new Set<number>();

      for (const item of layout) {
        expect(Number.isFinite(item.explodedCenter.x)).toBe(true);
        expect(Number.isFinite(item.explodedCenter.y)).toBe(true);
        expect(Number.isFinite(item.explodedCenter.z)).toBe(true);
        expect(Number.isFinite(item.bottomY)).toBe(true);
        expect(item.bottomY).toBeGreaterThanOrEqual(-0.001);

        if (
          Math.abs(item.explodedCenter.x - item.originalCenter.x) > 0.1 ||
          Math.abs(item.explodedCenter.y - item.originalCenter.y) > 0.1 ||
          Math.abs(item.explodedCenter.z - item.originalCenter.z) > 0.1
        ) {
          anyMoved = true;
        }

        // El cajón alojado comparte clúster y elevación con el mueble anfitrión
        if (item.groupId === baseCabinet.group.id || item.groupId === hostedDrawer.id) {
          expect(item.clusterKey).toBe(expectedBaseCluster);
          clusterLifts.add(item.floorLiftY);
        }
      }

      expect(anyMoved).toBe(true);
      expect(clusterLifts.size).toBe(1);
      const [baseLift] = Array.from(clusterLifts);
      expect(baseLift).toBeGreaterThan(0);
    }

    // 3. Al regresar a 0%: restauración exacta pieza por pieza
    const layoutBackTo0 = computeFloorClampedExplodedLayout(parts, groups, 0, getWorldAABB);
    expect(layoutBackTo0.length).toBe(parts.length);
    assertExactRestore(layoutBackTo0);
    expect(layoutBackTo0.map(i => i.explodedCenter)).toEqual(
      layoutAt0.map(i => i.originalCenter)
    );
  });

  it('debe aislar el floorLiftY por clúster (alacena aérea en Y alto mantiene floorLiftY === 0 mientras mueble base con patas respeta Y >= -0.001)', () => {
    const legsCabinet = cabinetGen.generateZoneCabinet(
      makePlinthBaseConfig({
        name: 'Mueble Base Patas',
        baseType: 'legs',
        hasPlinth: false,
        plinthHeight: 120
      }),
      TEST_MATERIALS
    );
    const upperCabinet = cabinetGen.generateZoneCabinet(
      makePlinthBaseConfig({
        name: 'Alacena Aérea',
        moduleType: 'wall_cabinet',
        category: 'kitchen_wall',
        width: 800,
        height: 700,
        depth: 350,
        baseType: 'none',
        hasPlinth: false,
        plinthHeight: 0,
        posX: 1200,
        posY: 1750,
        posZ: 0
      }),
      TEST_MATERIALS
    );

    projectStorage.addParametricCabinet(legsCabinet);
    projectStorage.addParametricCabinet(upperCabinet);

    const parts = projectStorage.partsList();
    const groups = projectStorage.groupsList();
    const getWorldAABB = (part: Part) => partGeometry.getWorldAABB(part);

    const layoutAt100 = computeFloorClampedExplodedLayout(parts, groups, 100, getWorldAABB);
    for (const item of layoutAt100) {
      expect(item.bottomY).toBeGreaterThanOrEqual(-0.001);
    }

    const upperItems = layoutAt100.filter(i => i.groupId === upperCabinet.group.id);
    expect(upperItems.length).toBeGreaterThan(0);
    expect(upperItems.every(i => i.floorLiftY === 0)).toBe(true);

    const layoutAt0 = computeFloorClampedExplodedLayout(parts, groups, 0, getWorldAABB);
    assertExactRestore(layoutAt0);
  });
});
