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
import { ProjectStorageService } from './project-storage.service';

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

function makeThreeColumnClosetTree(): CabinetZoneNode {
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

function makeClosetConfig(
  overrides: Partial<ParametricCabinetConfig> = {}
): ParametricCabinetConfig {
  return {
    code: 'CLOSET_3B',
    name: 'Clóset 3 Cuerpos Linaje',
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
    zoneTree: makeThreeColumnClosetTree(),
    ...overrides
  };
}

describe('Linaje Paramétrico: Desagrupar -> Editar Pieza -> Reagrupar -> Actualizar Material', () => {
  let projectStorage: ProjectStorageService;
  let cabinetGen: CabinetGeneratorService;

  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    TestBed.configureTestingModule({
      providers: [ProjectStorageService, CabinetGeneratorService]
    });

    projectStorage = TestBed.inject(ProjectStorageService);
    cabinetGen = TestBed.inject(CabinetGeneratorService);

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

  it(
    'tras Hito 2A, ungroup desvincula a edición libre (isParametricGenerated = false), reagrupar crea Grupo Libre sin parametricConfig, reconstructConfigFromParts mantiene seguridad y changeGroupMaterial conserva desplazamientos manuales',
    () => {
      const generated = cabinetGen.generateZoneCabinet(makeClosetConfig(), TEST_MATERIALS);
      projectStorage.addParametricCabinet(generated);

      const originalGroupId = generated.group.id;
      const expectedLineageId = generated.group.parametricConfig?.id || originalGroupId;
      const initialParts = projectStorage.partsList().filter(p => p.groupId === originalGroupId);
      const formerPartIds = initialParts.map(p => p.id);

      const initialDoorCount = initialParts.filter(p => p.componentRole === 'door').length;
      const initialShelfCount = initialParts.filter(p => p.componentRole === 'shelf').length;
      const initialDrawerFrontCount = initialParts.filter(
        p => p.componentRole === 'drawer_front'
      ).length;
      const initialDividerCount = initialParts.filter(p => p.componentRole === 'divider').length;

      expect(initialDoorCount).toBe(2);
      expect(initialShelfCount).toBe(3);
      expect(initialDrawerFrontCount).toBe(2);
      expect(initialDividerCount).toBe(2);

      // 1. Desagrupar (default Hito 2A: detachToFreeEdit = true)
      projectStorage.ungroup(originalGroupId);

      const projectAfterUngroup = projectStorage.currentProject();
      expect(
        (projectAfterUngroup.groups || []).some(g => g.id === originalGroupId)
      ).toBe(false);

      const registry = projectAfterUngroup.parametricLineageRegistry;
      expect(registry?.[expectedLineageId]).toBeUndefined();
      expect(registry?.[originalGroupId]).toBeUndefined();

      const ungroupedParts = projectAfterUngroup.parts.filter(p => formerPartIds.includes(p.id));
      expect(ungroupedParts.length).toBe(formerPartIds.length);
      for (const pt of ungroupedParts) {
        expect(pt.groupId).toBeUndefined();
        expect(pt.moduleId).toBeUndefined();
        expect(pt.zoneId).toBeUndefined();
        expect(pt.sourceParametricModuleId).toBeUndefined();
        expect(pt.sourceParametricGroupId).toBeUndefined();
        expect(pt.isParametricGenerated).toBe(false);
        expect(pt.manuallyModifiedAfterUngroup).toBeUndefined();
      }

      // 2. Mover una repisa manualmente (+100 mm en Y) en modo edición libre
      const targetShelf = ungroupedParts.find(
        p => p.componentRole === 'shelf' && Math.abs((p.posY ?? 0) - 550) < 600
      );
      expect(targetShelf).toBeDefined();
      const originalShelfPosY = targetShelf!.posY ?? 0;
      const movedShelfPosY = Math.round((originalShelfPosY + 100) * 10) / 10;

      projectStorage.updatePart({ ...targetShelf!, posY: movedShelfPosY });

      const movedShelfAfterUpdate = projectStorage
        .partsList()
        .find(p => p.id === targetShelf!.id);
      expect(movedShelfAfterUpdate).toBeDefined();
      expect(movedShelfAfterUpdate!.posY).toBe(movedShelfPosY);
      expect(movedShelfAfterUpdate!.manuallyModifiedAfterUngroup).toBeUndefined();

      // Las demás piezas tampoco deben acoplarse a linaje paramétrico
      const unmodifiedParts = projectStorage
        .partsList()
        .filter(p => formerPartIds.includes(p.id) && p.id !== targetShelf!.id);
      expect(unmodifiedParts.every(p => p.isParametricGenerated === false)).toBe(true);

      // 3. Reagrupar todas las piezas anteriores -> crea Grupo Libre ('custom-group') sin parametricConfig
      const regrouped = projectStorage.createGroup(
        'Clóset 3 Cuerpos Reagrupado',
        formerPartIds,
        'assembly'
      );
      const storedRegrouped = projectStorage.groupsList().find(g => g.id === regrouped.id);
      const regroupedParts = projectStorage.partsList().filter(p => p.groupId === regrouped.id);

      expect(storedRegrouped).toBeDefined();
      expect(storedRegrouped!.type).not.toBe('drawer');
      expect(storedRegrouped!.parametricConfig).toBeUndefined();
      expect(hasReliableParametricRecipe(storedRegrouped, regroupedParts)).toBe(false);
      expect(isStandaloneModularDrawerGroup(storedRegrouped, regroupedParts)).toBe(false);
      expect(regroupedParts.every(pt => pt.isParametricGenerated === false)).toBe(true);

      // 4. Seguridad de reconstructConfigFromParts sobre Grupo Libre: nunca debe clasificar como drawer_unit
      const reconstructed = cabinetGen.reconstructConfigFromParts(regroupedParts, storedRegrouped!);
      const hydrated = cabinetGen.hydrateZoneTreeFromConfig(reconstructed);

      expect(reconstructed.moduleType).not.toBe('drawer_unit');
      expect(hydrated.moduleType).not.toBe('drawer_unit');
      expect(reconstructed.shelvesCount).toBeGreaterThanOrEqual(initialShelfCount);
      expect(reconstructed.width).toBeGreaterThan(0);
      expect(reconstructed.height).toBeGreaterThan(0);
      expect(reconstructed.depth).toBeGreaterThan(0);

      // 5. Cambiar material/color de estructura del Grupo Libre con changeGroupMaterial
      projectStorage.changeGroupMaterial(storedRegrouped!.id, 'mat_oak_18', 'structure');

      const finalGroup = projectStorage.groupsList().find(g => g.id === storedRegrouped!.id);
      const finalParts = projectStorage.partsList().filter(p => p.groupId === storedRegrouped!.id);
      const allProjectParts = projectStorage.partsList();

      // Sin IDs duplicados
      expect(new Set(allProjectParts.map(p => p.id)).size).toBe(allProjectParts.length);

      // Sigue siendo Grupo Libre sin parametricConfig, conservando todas las piezas originales
      expect(finalGroup).toBeDefined();
      expect(finalGroup!.type).not.toBe('drawer');
      expect(finalGroup!.parametricConfig).toBeUndefined();
      expect(hasReliableParametricRecipe(finalGroup, finalParts)).toBe(false);

      expect(finalParts.filter(p => p.componentRole === 'door').length).toBe(initialDoorCount);
      expect(finalParts.filter(p => p.componentRole === 'shelf').length).toBe(initialShelfCount);
      expect(finalParts.filter(p => p.componentRole === 'drawer_front').length).toBe(
        initialDrawerFrontCount
      );
      expect(finalParts.filter(p => p.componentRole === 'divider').length).toBe(initialDividerCount);
      expect(
        finalParts.some(p => p.componentRole === 'accessory' && p.materialId === 'hw_rod_chrome')
      ).toBe(true);
      expect(finalParts.filter(p => p.componentRole === 'plinth').length).toBe(4);

      // El nuevo material de estructura se aplicó a costados y repisas, sin alterar los frentes
      const sides = finalParts.filter(
        p => p.componentRole === 'side_left' || p.componentRole === 'side_right'
      );
      expect(sides.length).toBe(2);
      expect(sides.every(s => s.materialId === 'mat_oak_18')).toBe(true);
      const fronts = finalParts.filter(
        p => p.componentRole === 'door' || p.componentRole === 'drawer_front'
      );
      expect(fronts.every(f => f.materialId === 'mat_white_15')).toBe(true);

      // La repisa desplazada conserva su posY manual (+100 mm) y recibe el nuevo material
      const finalShelves = finalParts.filter(p => p.componentRole === 'shelf');
      expect(finalShelves.every(s => s.materialId === 'mat_oak_18')).toBe(true);
      const preservedMovedShelf = finalShelves.find(s => s.id === targetShelf!.id);
      expect(preservedMovedShelf).toBeDefined();
      expect(preservedMovedShelf!.posY).toBeCloseTo(movedShelfPosY, 1);
    },
    20000
  );

  it('debe degradar a grupo personalizado sin receta si se agrupan piezas de dos módulos desagrupados distintos', () => {
    const modA = cabinetGen.generateZoneCabinet(
      makeClosetConfig({
        id: 'mod_alpha',
        name: 'Módulo A',
        width: 800,
        height: 900,
        depth: 500,
        posX: -500,
        posY: 450,
        zoneTree: {
          id: 'root_a',
          splitDirection: 'none',
          content: { type: 'shelves', shelvesCount: 2, shelfSetbackMm: 15 }
        }
      }),
      TEST_MATERIALS
    );
    const modB = cabinetGen.generateZoneCabinet(
      makeClosetConfig({
        id: 'mod_beta',
        name: 'Módulo B',
        width: 800,
        height: 900,
        depth: 500,
        posX: 500,
        posY: 450,
        zoneTree: {
          id: 'root_b',
          splitDirection: 'none',
          content: {
            type: 'doors',
            doors: {
              opening: 'double',
              mount: 'overlay',
              hasHandle: true,
              handleType: 'bar_modern',
              handleFinish: 'brushed_steel'
            }
          }
        }
      }),
      TEST_MATERIALS
    );

    projectStorage.addParametricCabinet(modA);
    projectStorage.addParametricCabinet(modB);

    const modAPartIds = projectStorage
      .partsList()
      .filter(p => p.groupId === modA.group.id)
      .map(p => p.id);
    const modBPartIds = projectStorage
      .partsList()
      .filter(p => p.groupId === modB.group.id)
      .map(p => p.id);

    projectStorage.ungroup(modA.group.id);
    projectStorage.ungroup(modB.group.id);

    const mixedIds = [...modAPartIds.slice(0, 4), ...modBPartIds.slice(0, 4)];
    const mixedGroup = projectStorage.createGroup('Ensamble Mixto A+B', mixedIds, 'assembly');
    const storedMixed = projectStorage.groupsList().find(g => g.id === mixedGroup.id);
    const mixedParts = projectStorage.partsList().filter(p => p.groupId === mixedGroup.id);

    expect(storedMixed).toBeDefined();
    expect(storedMixed!.parametricConfig).toBeUndefined();
    expect(hasReliableParametricRecipe(storedMixed, mixedParts)).toBe(false);
    expect(isStandaloneModularDrawerGroup(storedMixed, mixedParts)).toBe(false);
  });

  it('reconstructConfigFromParts no debe clasificar como drawer_unit un grupo sin parametricConfig que mezcla piezas "Cajón" con repisas', () => {
    const legacyGroup: PartGroup = {
      id: 'grp_legacy_mixed',
      name: 'Mueble Mixto Heredado',
      type: 'assembly'
    };

    const legacyParts: Part[] = [
      {
        id: 'leg_side_l',
        name: 'Costado Izquierdo',
        length: 1200,
        width: 500,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_white_15',
        materialName: 'Melamina Blanco 15mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: -392.5,
        posY: 600,
        posZ: 0,
        orientation: 'vertical_yz',
        groupId: legacyGroup.id,
        groupName: legacyGroup.name,
        componentRole: 'side_left'
      },
      {
        id: 'leg_side_r',
        name: 'Costado Derecho',
        length: 1200,
        width: 500,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_white_15',
        materialName: 'Melamina Blanco 15mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 392.5,
        posY: 600,
        posZ: 0,
        orientation: 'vertical_yz',
        groupId: legacyGroup.id,
        groupName: legacyGroup.name,
        componentRole: 'side_right'
      },
      {
        id: 'leg_top',
        name: 'Tapa Superior',
        length: 770,
        width: 500,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_white_15',
        materialName: 'Melamina Blanco 15mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 1192.5,
        posZ: 0,
        orientation: 'horizontal',
        groupId: legacyGroup.id,
        groupName: legacyGroup.name,
        componentRole: 'top'
      },
      {
        id: 'leg_bottom',
        name: 'Base Inferior',
        length: 770,
        width: 500,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_white_15',
        materialName: 'Melamina Blanco 15mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 7.5,
        posZ: 0,
        orientation: 'horizontal',
        groupId: legacyGroup.id,
        groupName: legacyGroup.name,
        componentRole: 'bottom'
      },
      {
        id: 'leg_shelf_1',
        name: 'Repisa Superior',
        length: 770,
        width: 460,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_white_15',
        materialName: 'Melamina Blanco 15mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 850,
        posZ: -10,
        orientation: 'horizontal',
        groupId: legacyGroup.id,
        groupName: legacyGroup.name,
        componentRole: 'shelf'
      },
      {
        id: 'leg_shelf_2',
        name: 'Repisa Media',
        length: 770,
        width: 460,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_white_15',
        materialName: 'Melamina Blanco 15mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 550,
        posZ: -10,
        orientation: 'horizontal',
        groupId: legacyGroup.id,
        groupName: legacyGroup.name,
        componentRole: 'shelf'
      },
      {
        id: 'leg_cajon_front_1',
        name: 'Frente Cajón 1',
        length: 794,
        width: 220,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_white_15',
        materialName: 'Melamina Blanco 15mm',
        grain: 'length',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX: 0,
        posY: 140,
        posZ: 257.5,
        orientation: 'vertical_xy',
        groupId: legacyGroup.id,
        groupName: legacyGroup.name,
        componentRole: 'drawer_front'
      },
      {
        id: 'leg_cajon_lat_1',
        name: 'Cajón 1 - Lateral Izquierdo',
        length: 450,
        width: 150,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_white_15',
        materialName: 'Melamina Blanco 15mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: -360,
        posY: 140,
        posZ: 10,
        orientation: 'vertical_yz',
        groupId: legacyGroup.id,
        groupName: legacyGroup.name,
        componentRole: 'drawer_box'
      }
    ];

    expect(hasReliableParametricRecipe(legacyGroup, legacyParts)).toBe(false);
    expect(isStandaloneModularDrawerGroup(legacyGroup, legacyParts)).toBe(false);

    const reconstructed = cabinetGen.reconstructConfigFromParts(legacyParts, legacyGroup);
    const hydrated = cabinetGen.hydrateZoneTreeFromConfig(reconstructed);

    expect(reconstructed.moduleType).not.toBe('drawer_unit');
    expect(hydrated.moduleType).not.toBe('drawer_unit');
    expect(reconstructed.shelvesCount).toBeGreaterThanOrEqual(2);
  });
});
