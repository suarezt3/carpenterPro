import { TestBed } from '@angular/core/testing';
import { ProjectStorageService } from './project-storage.service';
import { CabinetGeneratorService } from './cabinet-generator.service';
import { JoineryEngineService } from './joinery-engine.service';
import { PartGeometryService } from './part-geometry.service';
import { ModuleDesignerComponent } from '../components/module-designer/module-designer';
import {
  ApplianceItem,
  Material,
  ModuleCavityInfo,
  ParametricCabinetConfig,
  Part,
  PartGroup
} from '../models/melamine.models';

const TEST_MATERIALS: Material[] = [
  {
    id: 'mat_white_15',
    name: 'Blanco 15mm',
    colorHex: '#f8fafc',
    thickness: 15,
    category: 'board',
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 42000,
    hasGrain: false
  },
  {
    id: 'mat_white_18',
    name: 'Blanco Frost 18mm',
    colorHex: '#f8fafc',
    thickness: 18,
    category: 'board',
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 45000,
    hasGrain: false
  },
  {
    id: 'mat_mdf_3',
    name: 'Fondo MDF Blanco 3mm',
    colorHex: '#ffffff',
    thickness: 3,
    category: 'mdf',
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 18000,
    hasGrain: false
  }
];

function createCabinetConfig(
  overrides: Partial<ParametricCabinetConfig> = {}
): ParametricCabinetConfig {
  return {
    code: 'MOD_STD',
    name: 'Módulo Base Estándar',
    moduleType: 'base_cabinet',
    category: 'kitchen_base',
    width: 600,
    height: 800,
    depth: 560,
    structureThickness: 18,
    doorThickness: 18,
    backThickness: 3,
    backType: 'groove',
    shelvesCount: 0,
    doorOpening: 'none',
    structureMaterialId: 'mat_white_18',
    doorMaterialId: 'mat_white_18',
    backMaterialId: 'mat_mdf_3',
    handleType: 'bar_modern',
    handleFinish: 'brushed_steel',
    facadeGap: 3,
    hasPlinth: true,
    plinthHeight: 80,
    posX: 0,
    posY: 400,
    posZ: 0,
    ...overrides
  };
}

describe('Motor de Cavidades y Cajoneras Modulares (Escenarios 1-8)', () => {
  let projectService: ProjectStorageService;
  let cabinetGen: CabinetGeneratorService;
  let joineryEngine: JoineryEngineService;
  let partGeometry: PartGeometryService;
  let designer: ModuleDesignerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModuleDesignerComponent],
      providers: [
        ProjectStorageService,
        CabinetGeneratorService,
        JoineryEngineService,
        PartGeometryService
      ]
    }).compileComponents();

    projectService = TestBed.inject(ProjectStorageService);
    cabinetGen = TestBed.inject(CabinetGeneratorService);
    joineryEngine = TestBed.inject(JoineryEngineService);
    partGeometry = TestBed.inject(PartGeometryService);

    projectService.clearFurniture();
    projectService.updateProject(
      p => ({
        ...p,
        materials: [...TEST_MATERIALS]
      }),
      false
    );

    const fixture = TestBed.createComponent(ModuleDesignerComponent);
    designer = fixture.componentInstance;
  });

  const expectZeroCollisions = (parts: Part[]): void => {
    const detectCols = joineryEngine.detectCollisions(parts);
    const joineryCols = joineryEngine.calculateJoinery(parts).collisions;
    expect(detectCols.length).toBe(0);
    expect(joineryCols.length).toBe(0);
  };

  const addGeneratedCabinet = (
    overrides: Partial<ParametricCabinetConfig> = {}
  ): { parts: Part[]; group: PartGroup } => {
    const generated = cabinetGen.generateParametricCabinet(
      createCabinetConfig(overrides),
      TEST_MATERIALS
    );
    projectService.addParametricCabinet(generated);
    return { parts: generated.parts, group: generated.group };
  };

  describe('Escenario 1: Alacena Aérea 320 mm y Corredera Segura', () => {
    it('getOptimalCommercialSlideLength(287, overlay/inset) debe devolver <= 250 mm y jamás 300 mm', () => {
      const slideOverlay = partGeometry.getOptimalCommercialSlideLength(287, 'overlay', 15);
      const slideInset = partGeometry.getOptimalCommercialSlideLength(287, 'inset', 18);

      expect(slideOverlay).toBeLessThanOrEqual(250);
      expect(slideOverlay).toBe(250);
      expect(slideInset).toBeLessThanOrEqual(250);
      expect(slideInset).toBe(250);
    });

    it('debe marcar la alacena aérea como isUpperCabinet, excluirla por defecto del wizard y encajar cajón con 0 colisiones contra Fondo Trasero Ranurado', () => {
      const { group: wallGroup } = addGeneratedCabinet({
        code: 'ALACENA_320',
        name: 'Alacena Aérea 320mm',
        moduleType: 'wall_cabinet',
        category: 'kitchen_wall',
        width: 600,
        height: 750,
        depth: 320,
        structureThickness: 15,
        doorThickness: 15,
        backType: 'groove',
        hasPlinth: false,
        plinthHeight: 0,
        doorOpening: 'none',
        posX: 0,
        posY: 1800,
        posZ: 0
      });

      const cavities = partGeometry.detectModuleCavities(
        wallGroup,
        projectService.currentProject().parts,
        wallGroup
      );
      expect(cavities.length).toBe(1);
      const wallCavity = cavities[0];
      expect(wallCavity.isUpperCabinet).toBe(true);
      expect(wallCavity.optimalSlideLength).toBeLessThanOrEqual(250);

      // Excluida por defecto cuando showUpperCabinetsInDrawerWizard() === false
      expect(designer.showUpperCabinetsInDrawerWizard()).toBe(false);
      expect(
        designer.availableCabinetModulesForDrawer().some(g => g.id === wallGroup.id)
      ).toBe(false);

      // Al activar el toggle sí aparece disponible
      designer.toggleShowUpperCabinetsInDrawerWizard(true);
      expect(
        designer.availableCabinetModulesForDrawer().some(g => g.id === wallGroup.id)
      ).toBe(true);

      // Insertar cajón con corredera óptima sin chocar con Fondo Trasero Ranurado
      const created = projectService.addParametricDrawersToCavity(wallCavity, 1, {
        slideLength: wallCavity.optimalSlideLength,
        boxHeight: 140,
        bottomThickness: 3,
        includeFront: true,
        frontMountType: 'overlay',
        handleType: 'handle'
      });

      expect(created.length).toBe(1);
      expect(created[0].slideLength).toBeLessThanOrEqual(250);
      expectZeroCollisions(projectService.currentProject().parts);
    });
  });

  describe('Escenario 2: Electrodomésticos Horno / Microondas / Lavaplatos', () => {
    it('debe excluir vanos ocupados por horno y microondas (0 en Módulo Bajo Horno, solo libre inferior y superior en Torre) y excluir Módulo Bajo Horno de availableCabinetModulesForDrawer', () => {
      // 1. Módulo Bajo para Horno Empotrado 60cm (oven_base) + Horno empotrado
      const ovenBase = cabinetGen.generateParametricCabinet(
        createCabinetConfig({
          code: 'MBH600',
          name: 'Módulo Bajo para Horno Empotrado 60cm',
          moduleType: 'base_cabinet',
          category: 'oven_base',
          width: 600,
          height: 860,
          depth: 580,
          structureThickness: 15,
          doorThickness: 15,
          backType: 'none',
          hasBackPanel: false,
          shelvesCount: 1,
          doorOpening: 'bottom',
          hasPlinth: true,
          plinthHeight: 80,
          posX: 0,
          posY: 430,
          posZ: 0
        }),
        TEST_MATERIALS
      );
      projectService.addParametricCabinet(ovenBase);

      const ovenBaseAppliance: ApplianceItem = {
        id: 'app_oven_base_1',
        type: 'oven',
        name: 'Horno Empotrable 60cm',
        width: 595,
        depth: 560,
        height: 595,
        finish: 'black_matte',
        position: { x: 0, y: 200, z: 10 },
        rotation: 0,
        mountType: 'built_in',
        price: 0,
        includeInBudget: true,
        groupId: ovenBase.group.id
      };
      projectService.addAppliance(ovenBaseAppliance);

      // 2. Torre Columna de Horno y Microondas (oven_tower) + Horno y Microondas
      const ovenTower = cabinetGen.generateParametricCabinet(
        createCabinetConfig({
          code: 'THM6021',
          name: 'Torre Columna de Horno y Microondas',
          moduleType: 'tall_cabinet',
          category: 'oven_tower',
          width: 600,
          height: 2150,
          depth: 580,
          structureThickness: 15,
          doorThickness: 15,
          backType: 'groove',
          shelvesCount: 3,
          doorOpening: 'left',
          hasPlinth: true,
          plinthHeight: 80,
          posX: 800,
          posY: 1075,
          posZ: 0
        }),
        TEST_MATERIALS
      );
      projectService.addParametricCabinet(ovenTower);

      const lowerZoneH = Math.round((2150 - 80) * 0.32);
      const ovenBaseY = 80 + lowerZoneH + 18;
      const microBaseY = ovenBaseY + 595 + 18;

      const towerOven: ApplianceItem = {
        id: 'app_tower_oven_1',
        type: 'oven',
        name: 'Horno Torre 60cm',
        width: 595,
        depth: 560,
        height: 595,
        finish: 'black_matte',
        position: { x: 800, y: ovenBaseY, z: 10 },
        rotation: 0,
        mountType: 'built_in',
        price: 0,
        includeInBudget: true,
        groupId: ovenTower.group.id
      };
      const towerMicro: ApplianceItem = {
        id: 'app_tower_micro_1',
        type: 'microwave',
        name: 'Microondas Torre 60cm',
        width: 595,
        depth: 390,
        height: 388,
        finish: 'black_matte',
        position: { x: 800, y: microBaseY, z: 95 },
        rotation: 0,
        mountType: 'built_in',
        price: 0,
        includeInBudget: true,
        groupId: ovenTower.group.id
      };
      projectService.addAppliance(towerOven);
      projectService.addAppliance(towerMicro);

      const allParts = projectService.currentProject().parts;
      const allGroups = projectService.currentProject().groups || [];
      const allApps = projectService.currentProject().appliances || [];

      const ovenBaseCavities = partGeometry.detectModuleCavities(
        ovenBase.group,
        allParts,
        ovenBase.group,
        allApps
      );
      expect(ovenBaseCavities.length).toBe(0);

      const towerCavities = partGeometry.detectModuleCavities(
        ovenTower.group,
        allParts,
        ovenTower.group,
        allApps
      );
      expect(towerCavities.length).toBe(2);
      expect(towerCavities.some(c => c.minY < 200)).toBe(true);
      expect(towerCavities.some(c => c.minY > 1700)).toBe(true);
      // Verificar que ni el nicho del horno ni el del microondas aparecen
      expect(
        towerCavities.some(c => c.centerY !== undefined && c.centerY > 750 && c.centerY < 1750)
      ).toBe(false);

      const sceneCavities = partGeometry.detectAllSceneCavities(allParts, allGroups, allApps);
      expect(sceneCavities.filter(c => c.groupId === ovenBase.group.id).length).toBe(0);
      expect(sceneCavities.filter(c => c.groupId === ovenTower.group.id).length).toBe(2);

      const wizardModules = designer.availableCabinetModulesForDrawer();
      expect(wizardModules.some(g => g.id === ovenBase.group.id)).toBe(false);
      expect(wizardModules.some(g => g.id === ovenTower.group.id)).toBe(true);
    });

    it('debe aislar la Torre Columna de Horno y Microondas (insertSpecializedKitchenModule) conservando solo los vanos superior e inferior libres y 0 colisiones al insertar cajón', () => {
      designer.insertSpecializedKitchenModule('torre_hornos_microondas_60', true);

      const allParts = projectService.currentProject().parts;
      const allGroups = projectService.currentProject().groups || [];
      const allApps = projectService.currentProject().appliances || [];
      expect(allGroups.length).toBe(1);
      const towerGroup = allGroups[0];

      const towerCavities = partGeometry.detectModuleCavities(
        towerGroup,
        allParts,
        towerGroup,
        allApps
      );
      expect(towerCavities.length).toBe(2);
      expect(towerCavities.some(c => c.minY < 200)).toBe(true);
      expect(towerCavities.some(c => c.minY > 1700)).toBe(true);
      expect(
        towerCavities.some(c => c.centerY !== undefined && c.centerY > 750 && c.centerY < 1750)
      ).toBe(false);

      expect(
        designer.availableCabinetModulesForDrawer().some(g => g.id === towerGroup.id)
      ).toBe(true);

      const lowerCavity = towerCavities[0];
      designer.selectEntireGroup(towerGroup.id);
      designer.quickFillCavityWithDrawers(lowerCavity, 2, 'overlay');
      expectZeroCollisions(projectService.currentProject().parts);
    });

    it('debe excluir el vano de un Módulo Bajo Lavaplatos con tarja instalada', () => {
      const sinkBase = cabinetGen.generateParametricCabinet(
        createCabinetConfig({
          code: 'MBL800',
          name: 'Módulo Bajo Lavaplatos 80cm',
          moduleType: 'base_cabinet',
          category: 'sink_base',
          width: 800,
          height: 860,
          depth: 580,
          structureThickness: 15,
          doorThickness: 15,
          backType: 'none',
          hasBackPanel: false,
          shelvesCount: 0,
          doorOpening: 'double',
          hasPlinth: true,
          plinthHeight: 80,
          posX: 0,
          posY: 430,
          posZ: 0
        }),
        TEST_MATERIALS
      );
      projectService.addParametricCabinet(sinkBase);
      projectService.addAppliance({
        id: 'app_sink_1',
        type: 'sink',
        name: 'Lavaplatos Submontar',
        width: 780,
        depth: 480,
        height: 210,
        finish: 'stainless_steel',
        position: { x: 0, y: 860, z: 0 },
        rotation: 0,
        mountType: 'countertop',
        price: 0,
        includeInBudget: true,
        groupId: sinkBase.group.id
      });

      const sinkCavities = partGeometry.detectModuleCavities(
        sinkBase.group,
        projectService.currentProject().parts,
        sinkBase.group,
        projectService.currentProject().appliances
      );
      expect(sinkCavities.length).toBe(0);
      expect(
        designer.availableCabinetModulesForDrawer().some(g => g.id === sinkBase.group.id)
      ).toBe(false);
    });
  });

  describe('Escenario 3: Cajones 1, 2, 3 y 4 en Mueble con Puerta Cerrada (0 Colisiones)', () => {
    const counts: number[] = [1, 2, 3, 4];

    for (const count of counts) {
      it(`debe insertar ${count} cajones en módulo con puerta cerrada completa eliminando la puerta cubriente y dejando 0 colisiones`, () => {
        projectService.clearFurniture();
        const { group } = addGeneratedCabinet({
          code: `MOD_DOOR_${count}`,
          name: `Módulo Puerta ${count}`,
          width: 600,
          height: 800,
          depth: 560,
          shelvesCount: 0,
          doorOpening: 'left',
          posY: 400
        });

        const cavities = partGeometry.detectModuleCavities(
          group,
          projectService.currentProject().parts
        );
        expect(cavities.length).toBe(1);
        expect(cavities[0].coveringDoorIds?.length ?? 0).toBe(1);

        const created = projectService.addParametricDrawersToCavity(
          cavities[0],
          count,
          {
            slideLength: cavities[0].optimalSlideLength,
            boxHeight: 110,
            bottomThickness: 3,
            includeFront: true,
            frontMountType: 'overlay',
            handleType: 'handle'
          },
          { clearCoveringDoors: true, fillFullCavityHeight: count === 1 }
        );

        expect(created.length).toBe(count);

        const allParts = projectService.currentProject().parts;
        const remainingDoors = allParts.filter(
          p => p.groupId === group.id && p.componentRole === 'door'
        );
        expect(remainingDoors.length).toBe(0);
        expectZeroCollisions(allParts);
      });

      it(`debe insertar ${count} cajones solo en el vano inferior bajo puerta larga recortándola automáticamente sin colisiones`, () => {
        projectService.clearFurniture();
        const { group } = addGeneratedCabinet({
          code: `MOD_TALL_DOOR_${count}`,
          name: `Torre Puerta Larga ${count}`,
          moduleType: 'tall_cabinet',
          width: 600,
          height: 1600,
          depth: 560,
          shelvesCount: 1,
          doorOpening: 'left',
          posY: 800
        });

        const cavities = partGeometry.detectModuleCavities(
          group,
          projectService.currentProject().parts
        );
        expect(cavities.length).toBe(2);
        const lowerCavity = cavities[0];
        expect(lowerCavity.coveringDoorIds?.length ?? 0).toBe(1);

        const created = projectService.addParametricDrawersToCavity(
          lowerCavity,
          count,
          {
            slideLength: lowerCavity.optimalSlideLength,
            boxHeight: 110,
            bottomThickness: 3,
            includeFront: true,
            frontMountType: 'overlay',
            handleType: 'handle'
          },
          { clearCoveringDoors: true, fillFullCavityHeight: count === 1 }
        );

        expect(created.length).toBe(count);

        const allParts = projectService.currentProject().parts;
        const remainingDoors = allParts.filter(
          p => p.groupId === group.id && p.componentRole === 'door'
        );
        expect(remainingDoors.length).toBe(1);
        const trimmedDoorAABB = partGeometry.getWorldAABB(remainingDoors[0]);
        expect(trimmedDoorAABB.minY).toBeGreaterThanOrEqual(lowerCavity.maxY + 1.9);
        expectZeroCollisions(allParts);
      });
    }
  });

  describe('Escenario 4: Cajón Interno de Closet (frontMountType: none) detrás de Puerta Cerrada', () => {
    it('debe mantener la puerta exterior intacta, retranquear la caja >= 22 mm detrás de frontEdgeCoord y dejar 0 colisiones', () => {
      const { group } = addGeneratedCabinet({
        code: 'CLOSET_INT',
        name: 'Closet Puerta Doble',
        moduleType: 'closet',
        category: 'closet',
        width: 800,
        height: 1200,
        depth: 580,
        shelvesCount: 1,
        doorOpening: 'double',
        posY: 600
      });

      const initialDoors = projectService
        .currentProject()
        .parts.filter(p => p.groupId === group.id && p.componentRole === 'door');
      expect(initialDoors.length).toBe(2);

      const cavities = partGeometry.detectModuleCavities(
        group,
        projectService.currentProject().parts
      );
      const lowerCavity = cavities[0];
      expect(lowerCavity.coveringDoorIds?.length ?? 0).toBe(2);

      const safeSlide = partGeometry.getOptimalCommercialSlideLength(
        lowerCavity.internalDepth,
        'none',
        15,
        true
      );
      const created = projectService.addParametricDrawersToCavity(
        lowerCavity,
        1,
        {
          slideLength: safeSlide,
          boxHeight: 140,
          bottomThickness: 3,
          includeFront: false,
          frontMountType: 'none',
          handleType: 'handle'
        },
        { clearCoveringDoors: false }
      );

      expect(created.length).toBe(1);
      const allParts = projectService.currentProject().parts;
      const doorsAfter = allParts.filter(
        p => p.groupId === group.id && p.componentRole === 'door'
      );
      expect(doorsAfter.length).toBe(2);

      const drawerParts = allParts.filter(p => p.groupId === created[0].id);
      expect(drawerParts.some(p => p.componentRole === 'drawer_front')).toBe(false);

      const contraFrente = drawerParts.find(p => p.name.includes('Contra-frente'));
      expect(contraFrente).toBeDefined();
      if (!contraFrente) return;

      const boxBounds = partGeometry.getWorldAABB(contraFrente);
      expect(lowerCavity.frontEdgeCoord - boxBounds.maxZ).toBeGreaterThanOrEqual(21.9);
      expectZeroCollisions(allParts);
    });
  });

  describe('Escenario 5: Estilo Melamina 3D (convertPartToModularDrawer)', () => {
    it('debe convertir una pieza guía dentro de un vano en cajonera modular eliminando la pieza temporal, generando herrajes y 0 colisiones', () => {
      const { group } = addGeneratedCabinet({
        code: 'MOD_CONV',
        name: 'Módulo Conversión',
        width: 600,
        height: 800,
        depth: 560,
        shelvesCount: 0,
        doorOpening: 'none',
        posY: 400
      });

      const cavities = partGeometry.detectModuleCavities(
        group,
        projectService.currentProject().parts
      );
      const cav = cavities[0];
      const guidePart: Part = {
        id: 'guide_part_in_cavity',
        name: 'Frente Guía Cajón',
        groupId: group.id,
        groupName: group.name,
        length: cav.innerWidth,
        width: 180,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco Frost 18mm',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: cav.centerX,
        posY: cav.minY + 100,
        posZ: cav.centerZ,
        orientation: 'vertical_xy',
        componentRole: 'free'
      };
      projectService.addPart(guidePart);

      const created = projectService.convertPartToModularDrawer(guidePart.id, 3, 'overlay');
      expect(created.length).toBe(3);

      const proj = projectService.currentProject();
      expect(proj.parts.some(p => p.id === guidePart.id)).toBe(false);

      for (const grp of created) {
        expect(grp.templateId).toBe('modular_drawer');
        expect(proj.hardware.some(h => h.id === `hw_slide_${grp.id}`)).toBe(true);
        expect(proj.hardware.some(h => h.id === `hw_handle_${grp.id}`)).toBe(true);
      }

      expectZeroCollisions(proj.parts);
    });

    it('debe convertir una pieza libre sobre el piso en cajón modular con herrajes y 0 colisiones', () => {
      const floorGuide: Part = {
        id: 'free_floor_part',
        name: 'Tablero Guía Piso',
        length: 500,
        width: 180,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco Frost 18mm',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 1200,
        posY: 100,
        posZ: 0,
        orientation: 'vertical_xy',
        componentRole: 'free'
      };
      projectService.addPart(floorGuide);

      const created = projectService.convertPartToModularDrawer(floorGuide.id, 1, 'overlay');
      expect(created.length).toBe(1);

      const proj = projectService.currentProject();
      expect(proj.parts.some(p => p.id === floorGuide.id)).toBe(false);
      expect(created[0].templateId).toBe('modular_drawer');
      expect(proj.hardware.some(h => h.id === `hw_slide_${created[0].id}`)).toBe(true);
      expect(proj.hardware.some(h => h.id === `hw_handle_${created[0].id}`)).toBe(true);
      expectZeroCollisions(proj.parts);
    });
  });

  describe('Escenario 6: Subdivisión de Huecos (splitCavityWithShelf y splitCavityWithVerticalDivider)', () => {
    it('debe subdividir horizontal y verticalmente un vano, detectar los sub-vanos y rellenar uno con cajones manteniendo 0 colisiones', () => {
      const { group } = addGeneratedCabinet({
        code: 'MOD_SPLIT',
        name: 'Módulo Subdivisible',
        width: 900,
        height: 900,
        depth: 560,
        shelvesCount: 0,
        doorOpening: 'none',
        posY: 450
      });

      const initialCavities = partGeometry.detectModuleCavities(
        group,
        projectService.currentProject().parts
      );
      expect(initialCavities.length).toBe(1);

      const createdShelf = projectService.splitCavityWithShelf(initialCavities[0]);
      expect(createdShelf).not.toBeNull();

      const afterShelfCavities = partGeometry.detectModuleCavities(
        group,
        projectService.currentProject().parts
      );
      expect(afterShelfCavities.length).toBe(2);

      const createdDivider = projectService.splitCavityWithVerticalDivider(afterShelfCavities[0]);
      expect(createdDivider).not.toBeNull();

      const finalCavities = partGeometry.detectModuleCavities(
        group,
        projectService.currentProject().parts
      );
      expect(finalCavities.length).toBe(3);

      const targetSubCavity = finalCavities[0];
      const drawers = projectService.addParametricDrawersToCavity(targetSubCavity, 2, {
        slideLength: targetSubCavity.optimalSlideLength,
        boxHeight: 110,
        bottomThickness: 3,
        includeFront: true,
        frontMountType: 'overlay',
        handleType: 'handle'
      });
      expect(drawers.length).toBe(2);
      expectZeroCollisions(projectService.currentProject().parts);
    });

    it('debe subdividir primero verticalmente y luego horizontalmente y rellenar un sub-vano con 0 colisiones', () => {
      const { group } = addGeneratedCabinet({
        code: 'MOD_SPLIT_VH',
        name: 'Módulo Vertical-Horizontal',
        width: 900,
        height: 900,
        depth: 560,
        shelvesCount: 0,
        doorOpening: 'none',
        posY: 450
      });

      const initial = partGeometry.detectModuleCavities(group, projectService.currentProject().parts);
      expect(initial.length).toBe(1);

      const div = projectService.splitCavityWithVerticalDivider(initial[0]);
      expect(div).not.toBeNull();

      const cols = partGeometry.detectModuleCavities(group, projectService.currentProject().parts);
      expect(cols.length).toBe(2);

      const shelf = projectService.splitCavityWithShelf(cols[1]);
      expect(shelf).not.toBeNull();

      const subCavs = partGeometry.detectModuleCavities(group, projectService.currentProject().parts);
      expect(subCavs.length).toBe(3);

      const created = projectService.addParametricDrawersToCavity(subCavs[2], 2, {
        slideLength: subCavs[2].optimalSlideLength,
        boxHeight: 110,
        bottomThickness: 3,
        includeFront: true,
        frontMountType: 'inset',
        handleType: 'push'
      });
      expect(created.length).toBe(2);
      expectZeroCollisions(projectService.currentProject().parts);
    });
  });

  describe('Escenario 7: Integración UI ModuleDesigner y Módulos Rotados (facingDirection: right)', () => {
    it('debe exponer signals/acciones de cavidades, relleno 1-clic, subdivisión y conversión de pieza en ModuleDesigner', () => {
      const { group } = addGeneratedCabinet({
        code: 'MOD_UI',
        name: 'Módulo UI',
        width: 800,
        height: 860,
        depth: 560,
        shelvesCount: 0,
        doorOpening: 'none',
        posY: 430
      });

      // Seleccionar grupo completo y probar selectedModuleCavities + splits + quickFill
      designer.selectEntireGroup(group.id);
      expect(designer.selectedModuleCavities().length).toBe(1);

      const mainCav: ModuleCavityInfo = designer.selectedModuleCavities()[0];
      designer.quickSplitCavityHorizontally(mainCav);
      expect(designer.selectedModuleCavities().length).toBe(2);

      const lowerCav: ModuleCavityInfo = designer.selectedModuleCavities()[0];
      designer.quickSplitCavityVertically(lowerCav);
      expect(designer.selectedModuleCavities().length).toBe(3);

      const targetCav: ModuleCavityInfo = designer.selectedModuleCavities()[0];
      designer.quickFillCavityWithDrawers(targetCav, 2, 'overlay');
      expectZeroCollisions(projectService.currentProject().parts);

      // Probar canConvertSelectedPartToDrawer y convertSelectedPartToDrawer con pieza suelta
      const loosePart: Part = {
        id: 'ui_free_part',
        name: 'Pieza UI Libre',
        length: 450,
        width: 160,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco Frost 18mm',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 1400,
        posY: 90,
        posZ: 0,
        orientation: 'vertical_xy',
        componentRole: 'free'
      };
      projectService.addPart(loosePart);
      designer.selectedPartIds.set([loosePart.id]);
      designer.selectedPartId.set(loosePart.id);

      expect(designer.canConvertSelectedPartToDrawer()).toBe(true);
      designer.convertSelectedPartToDrawer(1, 'overlay');
      expect(
        projectService.currentProject().parts.some(p => p.id === loosePart.id)
      ).toBe(false);
      expectZeroCollisions(projectService.currentProject().parts);
    });

    it('debe detectar cavidades e insertar cajones sin colisiones en un módulo rotado 90° (facingDirection: right)', () => {
      const { parts, group } = addGeneratedCabinet({
        code: 'MOD_ROT_RIGHT',
        name: 'Módulo Rotado 90°',
        width: 600,
        height: 800,
        depth: 560,
        shelvesCount: 1,
        doorOpening: 'left',
        posY: 400
      });

      projectService.rotateMultiplePartsRigidly(
        parts.map(p => p.id),
        90
      );

      const updatedGroup = (projectService.currentProject().groups || []).find(
        g => g.id === group.id
      );
      expect(updatedGroup?.facingDirection).toBe('right');

      const rotatedCavities = partGeometry.detectModuleCavities(
        group.id,
        projectService.currentProject().parts,
        updatedGroup
      );
      expect(rotatedCavities.length).toBe(2);
      expect(rotatedCavities[0].facingDirection).toBe('right');

      designer.selectEntireGroup(group.id);
      designer.quickFillCavityWithDrawers(rotatedCavities[0], 2, 'overlay');

      const drawerGroups = (projectService.currentProject().groups || []).filter(
        g => g.templateId === 'modular_drawer'
      );
      expect(drawerGroups.length).toBe(2);
      expect(drawerGroups[0].facingDirection).toBe('right');
      expectZeroCollisions(projectService.currentProject().parts);
    });

    it('debe sincronizar el Asistente de Cajón Modular (openDrawerWizard, setDrawerWizardFrontMount, submitDrawerWizard) con 0 colisiones', () => {
      const { group } = addGeneratedCabinet({
        code: 'MOD_WIZ_UI',
        name: 'Módulo Wizard',
        width: 600,
        height: 800,
        depth: 560,
        shelvesCount: 1,
        doorOpening: 'left',
        posY: 400
      });

      designer.openDrawerWizard(group.id);
      expect(designer.showDrawerWizard()).toBe(true);
      expect(designer.drawerWizardTargetModuleId()).toBe(group.id);
      expect(designer.selectedDrawerWizardCavity()).not.toBeNull();

      designer.setDrawerWizardCount(3);
      designer.setDrawerWizardFrontMount('inset');
      expect(designer.drawerForm().frontMountType).toBe('inset');
      expect(designer.drawerForm().slideLength).toBeLessThanOrEqual(
        designer.drawerWizardMaxSafeSlideLength() ?? 999
      );

      designer.submitDrawerWizard();
      expect(designer.showDrawerWizard()).toBe(false);

      const drawerGroups = (projectService.currentProject().groups || []).filter(
        g => g.templateId === 'modular_drawer'
      );
      expect(drawerGroups.length).toBe(3);
      expectZeroCollisions(projectService.currentProject().parts);
    });
  });

  describe('Escenario 8: Detección de Huecos en Piezas Sueltas (__loose_structure__) y Sincronización de Apertura', () => {
    const createInvertedULooseParts = (): Part[] => [
      {
        id: 'loose_left_side',
        name: 'Lateral Izquierdo',
        length: 720,
        width: 560,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco Frost 18mm',
        colorHex: '#e2d9c8',
        grain: 'length',
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        posX: -300,
        posY: 360,
        posZ: 0,
        orientation: 'vertical_yz',
        componentRole: 'free'
      },
      {
        id: 'loose_right_side',
        name: 'Lateral Derecho',
        length: 720,
        width: 560,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco Frost 18mm',
        colorHex: '#e2d9c8',
        grain: 'length',
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        posX: 300,
        posY: 360,
        posZ: 0,
        orientation: 'vertical_yz',
        componentRole: 'free'
      },
      {
        id: 'loose_top_roof',
        name: 'Techo',
        length: 618,
        width: 560,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco Frost 18mm',
        colorHex: '#e2d9c8',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 729,
        posZ: 0,
        orientation: 'horizontal',
        componentRole: 'free'
      }
    ];

    it('isInternalShelf debe excluir siempre piezas de cajón y Fondo MDF horizontal', () => {
      const drawerFondo: Part = {
        id: 'drawer_fondo_test',
        name: 'Fondo MDF (Cajón 1)',
        groupId: 'drawer_grp_1',
        length: 538,
        width: 450,
        thickness: 3,
        quantity: 1,
        materialId: 'mat_mdf_3',
        materialName: 'Fondo MDF Blanco 3mm',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 120,
        posZ: 0,
        orientation: 'horizontal',
        componentRole: 'drawer_box'
      };
      const drawerFront: Part = {
        ...drawerFondo,
        id: 'drawer_front_test',
        name: 'Frente Cajón 1',
        orientation: 'vertical_xy',
        componentRole: 'drawer_front'
      };
      const drawerBottomRole: Part = {
        ...drawerFondo,
        id: 'drawer_bottom_role_test',
        name: 'Pieza Horizontal',
        componentRole: 'drawer_bottom'
      };
      const drawerLateralRole: Part = {
        ...drawerFondo,
        id: 'drawer_lat_role_test',
        name: 'Lateral Cajón',
        orientation: 'vertical_yz',
        componentRole: 'drawer_lateral'
      };
      const unnamedContraFrente: Part = {
        ...drawerFondo,
        id: 'drawer_contra_test',
        name: 'Contra-frente Interno',
        componentRole: 'free'
      };

      expect(partGeometry.isInternalShelf(drawerFondo)).toBe(false);
      expect(partGeometry.isInternalShelf(drawerFront)).toBe(false);
      expect(partGeometry.isInternalShelf(drawerBottomRole)).toBe(false);
      expect(partGeometry.isInternalShelf(drawerLateralRole)).toBe(false);
      expect(partGeometry.isInternalShelf(unnamedContraFrente)).toBe(false);
    });

    it('debe detectar huecos en estructura en U invertida de piezas sueltas ignorando muros/puertas y rellenarlos con 3 cajones sin colisiones', () => {
      const looseParts = createInvertedULooseParts();
      const nearbyWall: Part = {
        id: 'loose_nearby_wall',
        name: 'Muro Posterior',
        type: 'wall',
        length: 1200,
        width: 2200,
        thickness: 40,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco Frost 18mm',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 1100,
        posZ: -320,
        orientation: 'vertical_xy',
        componentRole: 'free'
      };
      const nearbyDoor: Part = {
        id: 'loose_nearby_door',
        name: 'Puerta Suelta',
        type: 'door',
        length: 720,
        width: 500,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco Frost 18mm',
        grain: 'length',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX: 350,
        posY: 360,
        posZ: 0,
        orientation: 'vertical_yz',
        componentRole: 'door'
      };

      looseParts.forEach(p => projectService.addPart(p));
      projectService.addPart(nearbyWall);
      projectService.addPart(nearbyDoor);

      const allCavities = partGeometry.detectAllSceneCavities(
        projectService.currentProject().parts,
        projectService.currentProject().groups || [],
        projectService.currentProject().appliances
      );
      const looseCavities = allCavities.filter(c => c.groupId === '__loose_structure__');

      expect(looseCavities.length).toBe(1);
      const cav = looseCavities[0];
      expect(cav.moduleId).toBe('__loose_structure__');
      expect(cav.moduleName).toBe('Estructura de Piezas Sueltas');
      expect(cav.isUpperCabinet).toBe(false);
      expect(cav.internalWidth).toBe(582);
      expect(cav.internalHeight).toBe(720);
      expect(cav.internalDepth).toBe(560);
      expect(cav.minY).toBe(0);
      expect(cav.maxY).toBe(720);
      expect(cav.facingDirection).toBe('front');
      expect(cav.frontPlaneZ).toBe(280);
      expect(cav.leftPartId).toBe('loose_left_side');
      expect(cav.rightPartId).toBe('loose_right_side');
      expect(cav.topPartId).toBe('loose_top_roof');
      expect(cav.bottomPartId).toBeUndefined();

      const createdDrawers = projectService.addParametricDrawersToCavity(cav, 3, {
        slideLength: cav.optimalSlideLength,
        boxHeight: 140,
        bottomThickness: 3,
        includeFront: true,
        frontMountType: 'overlay',
        handleType: 'handle'
      });

      expect(createdDrawers.length).toBe(3);
      for (const grp of createdDrawers) {
        expect(grp.templateId).toBe('modular_drawer');
        expect(grp.isOpen).toBe(false);
        expect(grp.slideExtension).toBe(0);
        const boxParts = projectService
          .currentProject()
          .parts.filter(p => p.groupId === grp.id && !p.id.endsWith('_fondo_mdf'));
        expect(boxParts.length).toBeGreaterThanOrEqual(5);
        for (const bp of boxParts) {
          expect(bp.materialId).toBe('mat_white_18');
          expect(bp.colorHex).toBe('#e2d9c8');
        }
      }

      expectZeroCollisions(projectService.currentProject().parts);
    });

    it('debe soportar splitCavityWithShelf, splitCavityWithVerticalDivider y convertPartToModularDrawer en huecos sueltos sin referencias rotas', () => {
      createInvertedULooseParts().forEach(p => projectService.addPart(p));

      const initialCavities = partGeometry.detectAllSceneCavities(
        projectService.currentProject().parts,
        projectService.currentProject().groups || []
      );
      expect(initialCavities.length).toBe(1);

      const shelf = projectService.splitCavityWithShelf(initialCavities[0]);
      expect(shelf).not.toBeNull();
      expect(shelf!.groupId).toBeUndefined();
      expect(shelf!.materialId).toBe('mat_white_18');
      expect(shelf!.colorHex).toBe('#e2d9c8');
      expect(shelf!.thickness).toBe(18);

      const afterShelfCavities = partGeometry.detectAllSceneCavities(
        projectService.currentProject().parts,
        projectService.currentProject().groups || []
      );
      expect(afterShelfCavities.length).toBe(2);

      const divider = projectService.splitCavityWithVerticalDivider(afterShelfCavities[1]);
      expect(divider).not.toBeNull();
      expect(divider!.groupId).toBeUndefined();
      expect(divider!.orientation).toBe('vertical_yz');
      expect(divider!.materialId).toBe('mat_white_18');
      expect(divider!.thickness).toBe(18);

      const afterDivCavities = partGeometry.detectAllSceneCavities(
        projectService.currentProject().parts,
        projectService.currentProject().groups || []
      );
      expect(afterDivCavities.length).toBe(3);

      // Convertir una pieza guía ubicada dentro de uno de los sub-vanos sueltos
      const targetSubCav = afterDivCavities[0];
      const guidePart: Part = {
        id: 'loose_guide_drawer',
        name: 'Frente Guía Suelto',
        length: targetSubCav.innerWidth,
        width: 140,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco Frost 18mm',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: targetSubCav.centerX,
        posY: targetSubCav.minY + 90,
        posZ: targetSubCav.centerZ,
        orientation: 'vertical_xy',
        componentRole: 'free'
      };
      projectService.addPart(guidePart);

      const converted = projectService.convertPartToModularDrawer(guidePart.id, 2, 'overlay');
      expect(converted.length).toBe(2);
      expect(
        projectService.currentProject().parts.some(p => p.id === guidePart.id)
      ).toBe(false);
      expectZeroCollisions(projectService.currentProject().parts);
    });

    it('debe sincronizar toggleGroupOpen(groupId, forceState) y setGroupSlideExtension con isOpen y slideExtension', () => {
      createInvertedULooseParts().forEach(p => projectService.addPart(p));
      const [cav] = partGeometry.detectAllSceneCavities(
        projectService.currentProject().parts,
        projectService.currentProject().groups || []
      );
      const [drawerGroup] = projectService.addParametricDrawersToCavity(cav, 1, {
        slideLength: cav.optimalSlideLength,
        boxHeight: 140,
        bottomThickness: 3,
        includeFront: true,
        frontMountType: 'overlay',
        handleType: 'handle'
      });

      const getGrp = () =>
        (projectService.currentProject().groups || []).find(g => g.id === drawerGroup.id);

      expect(getGrp()?.isOpen).toBe(false);
      expect(getGrp()?.slideExtension).toBe(0);

      projectService.toggleGroupOpen(drawerGroup.id, true);
      expect(getGrp()?.isOpen).toBe(true);
      expect(getGrp()?.slideExtension).toBe(1);

      // Llamada idempotente con forceState=true mantiene estado abierto
      projectService.toggleGroupOpen(drawerGroup.id, true);
      expect(getGrp()?.isOpen).toBe(true);
      expect(getGrp()?.slideExtension).toBe(1);

      projectService.toggleGroupOpen(drawerGroup.id, false);
      expect(getGrp()?.isOpen).toBe(false);
      expect(getGrp()?.slideExtension).toBe(0);

      projectService.setGroupSlideExtension(drawerGroup.id, 0.65);
      expect(getGrp()?.slideExtension).toBe(0.65);
      expect(getGrp()?.isOpen).toBe(true);

      projectService.setGroupSlideExtension(drawerGroup.id, 0.02);
      expect(getGrp()?.slideExtension).toBe(0.02);
      expect(getGrp()?.isOpen).toBe(false);
    });

    it('debe separar múltiples estructuras sueltas independientes por proximidad espacial y marcar isUpperCabinet cuando floorTopY >= 1200', () => {
      // Estructura 1: U invertida elevada sobre Y=1300 (isUpperCabinet: true)
      const upperLoose: Part[] = [
        {
          id: 'upper_loose_l',
          name: 'Lateral Izq Aéreo',
          length: 700,
          width: 320,
          thickness: 15,
          quantity: 1,
          materialId: 'mat_white_15',
          materialName: 'Blanco 15mm',
          grain: 'length',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: -300,
          posY: 1650,
          posZ: 0,
          orientation: 'vertical_yz',
          componentRole: 'free'
        },
        {
          id: 'upper_loose_r',
          name: 'Lateral Der Aéreo',
          length: 700,
          width: 320,
          thickness: 15,
          quantity: 1,
          materialId: 'mat_white_15',
          materialName: 'Blanco 15mm',
          grain: 'length',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: 300,
          posY: 1650,
          posZ: 0,
          orientation: 'vertical_yz',
          componentRole: 'free'
        },
        {
          id: 'upper_loose_top',
          name: 'Techo Aéreo',
          length: 615,
          width: 320,
          thickness: 15,
          quantity: 1,
          materialId: 'mat_white_15',
          materialName: 'Blanco 15mm',
          grain: 'length',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: 0,
          posY: 2007.5,
          posZ: 0,
          orientation: 'horizontal',
          componentRole: 'free'
        }
      ];

      // Estructura 2: U invertida independiente en X=1500 sobre el piso (Y=0)
      const secondLoose = createInvertedULooseParts().map(p => ({
        ...p,
        id: `${p.id}_2`,
        posX: (p.posX ?? 0) + 1500
      }));

      [...upperLoose, ...secondLoose].forEach(p => projectService.addPart(p));

      const looseCavities = partGeometry
        .detectAllSceneCavities(
          projectService.currentProject().parts,
          projectService.currentProject().groups || []
        )
        .filter(c => c.groupId === '__loose_structure__');

      expect(looseCavities.length).toBe(2);
      const upperCav = looseCavities.find(c => c.centerX === 0);
      const floorCav = looseCavities.find(c => c.centerX === 1500);
      expect(upperCav).toBeDefined();
      expect(upperCav!.isUpperCabinet).toBe(true);
      expect(upperCav!.minY).toBe(1300);
      expect(upperCav!.maxY).toBe(2000);
      expect(upperCav!.internalHeight).toBe(700);
      expect(upperCav!.internalWidth).toBe(585);
      expect(floorCav).toBeDefined();
      expect(floorCav!.isUpperCabinet).toBe(false);
      expect(floorCav!.internalWidth).toBe(582);
    });
  });
});
