import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CabinetZoneNode,
  hasReliableParametricRecipe,
  isStandaloneModularDrawerGroup,
  Material,
  ParametricCabinetConfig,
  Part,
  PartGroup,
  ProjectSettings
} from '../models/melamine.models';
import { CabinetGeneratorService } from './cabinet-generator.service';
import { PartGeometryService } from './part-geometry.service';
import { ProjectStorageService } from './project-storage.service';

interface BoxPartSnapshot {
  id: string;
  length: number;
  width: number;
  thickness: number;
  orientation: Part['orientation'];
  posX: number;
  posY: number;
  posZ: number;
}

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
    id: 'mat_oak_18',
    name: 'Melamina Roble 18mm',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 185000,
    hasGrain: true,
    colorHex: '#c29b68',
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

function buildThreeColumnClosetZoneTree(): CabinetZoneNode {
  return {
    id: 'closet_root',
    splitDirection: 'vertical',
    children: [
      {
        id: 'bay_1_shelves',
        splitDirection: 'none',
        sizeRatio: 1,
        content: {
          type: 'shelves',
          shelvesCount: 3,
          shelfSetbackMm: 20
        }
      },
      {
        id: 'bay_2_drawers',
        splitDirection: 'none',
        sizeRatio: 1,
        content: {
          type: 'drawers',
          drawers: {
            count: 2,
            frontMount: 'overlay',
            deductTopMm: 0,
            deductBottomMm: 0,
            deductLeftMm: 0,
            deductRightMm: 0,
            openingSystem: 'handle',
            slideType: 'telescopic',
            bottomType: 'grooved'
          }
        }
      },
      {
        id: 'bay_3_doors_rod',
        splitDirection: 'none',
        sizeRatio: 1,
        content: {
          type: 'doors',
          doors: {
            opening: 'double',
            mount: 'overlay',
            hasHandle: true,
            handleType: 'bar_modern',
            handleFinish: 'brushed_steel'
          },
          hangingRodsCount: 1
        }
      }
    ]
  };
}

function buildThreeColumnClosetConfig(): ParametricCabinetConfig {
  return {
    code: 'CLOSET_3COL',
    name: 'Clóset 3 Cuerpos',
    moduleType: 'closet',
    category: 'custom',
    width: 1800,
    height: 2100,
    depth: 600,
    structureThickness: 15,
    doorThickness: 15,
    backThickness: 3,
    backType: 'groove',
    hasBackPanel: true,
    shelvesCount: 0,
    doorOpening: 'none',
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
    posY: 1050,
    posZ: 0,
    zoneTree: buildThreeColumnClosetZoneTree()
  };
}

function snapshotBoxParts(parts: readonly Part[]): BoxPartSnapshot[] {
  return parts
    .filter(p => p.componentRole !== 'drawer_front' && !p.id.toLowerCase().endsWith('_frente'))
    .map(p => ({
      id: p.id,
      length: p.length,
      width: p.width,
      thickness: p.thickness,
      orientation: p.orientation,
      posX: p.posX ?? 0,
      posY: p.posY ?? 0,
      posZ: p.posZ ?? 0
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

describe('Cajón Modular Independiente: Montaje de Frente y Protección de Módulos Complejos', () => {
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

  it('debe alternar frontMountType overlay -> inset -> none -> overlay conservando intactas las 5 piezas de caja y slideLength en [200..700]', () => {
    const drawerGroup = projectStorage.addParametricDrawer({
      name: 'Cajón Modular Independiente',
      outerWidth: 564,
      slideLength: 450,
      boxHeight: 140,
      boxThickness: 15,
      bottomThickness: 3,
      includeFront: true,
      frontMountType: 'overlay',
      handleType: 'handle',
      materialId: 'mat_white_15',
      frontMaterialId: 'mat_white_15',
      bottomMaterialId: 'mat_mdf_3',
      posX: 0,
      posY: 200,
      posZ: 0
    });

    const getGroup = (): PartGroup | undefined =>
      projectStorage.groupsList().find(g => g.id === drawerGroup.id);
    const getGroupParts = (): Part[] =>
      projectStorage.partsList().filter(p => p.groupId === drawerGroup.id);

    const initialParts = getGroupParts();
    expect(isStandaloneModularDrawerGroup(getGroup(), initialParts)).toBe(true);
    expect(hasReliableParametricRecipe(getGroup(), initialParts)).toBe(false);
    expect(initialParts.length).toBe(6);

    const initialFronts = initialParts.filter(p => p.componentRole === 'drawer_front');
    expect(initialFronts.length).toBe(1);

    const initialBoxSnapshot = snapshotBoxParts(initialParts);
    expect(initialBoxSnapshot.length).toBe(5);

    const initialCfg = projectStorage.getModularDrawerConfig(drawerGroup.id);
    expect(initialCfg).not.toBeNull();
    expect(initialCfg!.frontMountType).toBe('overlay');
    expect(initialCfg!.slideLength).toBeGreaterThanOrEqual(200);
    expect(initialCfg!.slideLength).toBeLessThanOrEqual(700);
    expect(initialCfg!.slideLength).toBe(450);

    const overlayFrontWidth = initialFronts[0].length;

    // 1. overlay -> inset
    const updatedInset = projectStorage.updateModularDrawerGroup(drawerGroup.id, {
      frontMountType: 'inset'
    });
    expect(updatedInset).not.toBeNull();

    const insetParts = getGroupParts();
    expect(insetParts.length).toBe(6);
    expect(snapshotBoxParts(insetParts)).toEqual(initialBoxSnapshot);

    const insetFronts = insetParts.filter(p => p.componentRole === 'drawer_front');
    expect(insetFronts.length).toBe(1);
    expect(insetFronts[0].length).toBeLessThan(overlayFrontWidth);

    const insetCfg = projectStorage.getModularDrawerConfig(drawerGroup.id);
    expect(insetCfg).not.toBeNull();
    expect(insetCfg!.frontMountType).toBe('inset');
    expect(insetCfg!.includeFront).toBe(true);
    expect(insetCfg!.slideLength).toBeGreaterThanOrEqual(200);
    expect(insetCfg!.slideLength).toBeLessThanOrEqual(700);
    expect(insetCfg!.slideLength).toBe(450);

    // Verificar que el frente embutido permanece por delante de la caja sin invadir el contrafrente
    const insetBoxMaxZ = Math.max(
      ...insetParts
        .filter(p => p.componentRole !== 'drawer_front')
        .map(p => partGeometry.getWorldAABB(p).maxZ)
    );
    const insetFrontMinZ = partGeometry.getWorldAABB(insetFronts[0]).minZ;
    expect(insetFrontMinZ).toBeGreaterThanOrEqual(insetBoxMaxZ + 1.5);

    // 2. inset -> none (elimina únicamente el frente)
    const updatedNone = projectStorage.updateModularDrawerGroup(drawerGroup.id, {
      frontMountType: 'none'
    });
    expect(updatedNone).not.toBeNull();

    const noneParts = getGroupParts();
    expect(noneParts.length).toBe(5);
    expect(noneParts.filter(p => p.componentRole === 'drawer_front').length).toBe(0);
    expect(snapshotBoxParts(noneParts)).toEqual(initialBoxSnapshot);
    expect(isStandaloneModularDrawerGroup(getGroup(), noneParts)).toBe(true);

    const noneCfg = projectStorage.getModularDrawerConfig(drawerGroup.id);
    expect(noneCfg).not.toBeNull();
    expect(noneCfg!.frontMountType).toBe('none');
    expect(noneCfg!.includeFront).toBe(false);
    expect(noneCfg!.slideLength).toBeGreaterThanOrEqual(200);
    expect(noneCfg!.slideLength).toBeLessThanOrEqual(700);
    expect(noneCfg!.slideLength).toBe(450);

    // 3. none -> overlay (recrea el frente sin alterar las 5 piezas de caja)
    const updatedOverlay = projectStorage.updateModularDrawerGroup(drawerGroup.id, {
      frontMountType: 'overlay'
    });
    expect(updatedOverlay).not.toBeNull();

    const restoredParts = getGroupParts();
    expect(restoredParts.length).toBe(6);
    expect(snapshotBoxParts(restoredParts)).toEqual(initialBoxSnapshot);

    const restoredFronts = restoredParts.filter(p => p.componentRole === 'drawer_front');
    expect(restoredFronts.length).toBe(1);
    expect(restoredFronts[0].length).toBeGreaterThan(insetFronts[0].length);

    const restoredCfg = projectStorage.getModularDrawerConfig(drawerGroup.id);
    expect(restoredCfg).not.toBeNull();
    expect(restoredCfg!.frontMountType).toBe('overlay');
    expect(restoredCfg!.includeFront).toBe(true);
    expect(restoredCfg!.slideLength).toBeGreaterThanOrEqual(200);
    expect(restoredCfg!.slideLength).toBeLessThanOrEqual(700);
    expect(restoredCfg!.slideLength).toBe(450);

    const restoredBoxMaxZ = Math.max(
      ...restoredParts
        .filter(p => p.componentRole !== 'drawer_front')
        .map(p => partGeometry.getWorldAABB(p).maxZ)
    );
    const restoredFrontMinZ = partGeometry.getWorldAABB(restoredFronts[0]).minZ;
    expect(restoredFrontMinZ).toBeGreaterThanOrEqual(restoredBoxMaxZ + 1.5);
  });

  it('debe rechazar getModularDrawerConfig y updateModularDrawerGroup sobre un clóset de 3 cuerpos sin mutar piezas ni generar correderas absurdas (1421 mm)', () => {
    const closetCfg = buildThreeColumnClosetConfig();
    const generated = cabinetGen.generateZoneCabinet(closetCfg, TEST_MATERIALS);
    projectStorage.addParametricCabinet(generated);

    const closetGroupId = generated.group.id;
    const storedGroup = projectStorage.groupsList().find(g => g.id === closetGroupId);
    const beforeParts = projectStorage.partsList().filter(p => p.groupId === closetGroupId);

    expect(storedGroup).toBeDefined();
    expect(storedGroup!.type).not.toBe('drawer');
    expect(isStandaloneModularDrawerGroup(storedGroup, beforeParts)).toBe(false);
    expect(hasReliableParametricRecipe(storedGroup, beforeParts)).toBe(true);

    const beforeSnapshot = beforeParts.map(p => ({
      id: p.id,
      name: p.name,
      length: p.length,
      width: p.width,
      thickness: p.thickness,
      posX: p.posX,
      posY: p.posY,
      posZ: p.posZ,
      orientation: p.orientation
    }));

    expect(projectStorage.getModularDrawerConfig(closetGroupId)).toBeNull();
    expect(
      projectStorage.updateModularDrawerGroup(closetGroupId, { frontMountType: 'inset' })
    ).toBeNull();
    expect(
      projectStorage.updateModularDrawerGroup(closetGroupId, { frontMountType: 'none' })
    ).toBeNull();
    expect(
      projectStorage.updateModularDrawerGroup(closetGroupId, { slideLength: 450 })
    ).toBeNull();

    const afterParts = projectStorage.partsList().filter(p => p.groupId === closetGroupId);
    expect(afterParts.length).toBe(beforeParts.length);
    const afterSnapshot = afterParts.map(p => ({
      id: p.id,
      name: p.name,
      length: p.length,
      width: p.width,
      thickness: p.thickness,
      posX: p.posX,
      posY: p.posY,
      posZ: p.posZ,
      orientation: p.orientation
    }));
    expect(afterSnapshot).toEqual(beforeSnapshot);

    // Verificar que ningún herraje ni parámetro de grupo registró una corredera de 1421 mm
    const project = projectStorage.currentProject();
    for (const hw of project.hardware || []) {
      expect(hw.name).not.toContain('1421');
    }

    // Incluso ante un proyecto heredado con group.type === 'drawer' en el clóset, los guards deben bloquearlo
    projectStorage.updateGroup(closetGroupId, { type: 'drawer' });
    const forcedDrawerGroup = projectStorage.groupsList().find(g => g.id === closetGroupId);
    expect(isStandaloneModularDrawerGroup(forcedDrawerGroup, afterParts)).toBe(false);
    expect(projectStorage.getModularDrawerConfig(closetGroupId)).toBeNull();
    expect(
      projectStorage.updateModularDrawerGroup(closetGroupId, { frontMountType: 'inset' })
    ).toBeNull();
    expect(projectStorage.partsList().filter(p => p.groupId === closetGroupId).length).toBe(
      beforeParts.length
    );
  });
});
