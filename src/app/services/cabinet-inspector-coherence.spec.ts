import { TestBed } from '@angular/core/testing';
import { CabinetGeneratorService } from './cabinet-generator.service';
import { ProjectStorageService } from './project-storage.service';
import { JoineryEngineService } from './joinery-engine.service';
import { PartGeometryService } from './part-geometry.service';
import { Material, ParametricCabinetConfig, PartGroup, Part } from '../models/melamine.models';

const MOCK_MATERIALS: Material[] = [
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
    id: 'mat_stone_20',
    name: 'Cuarzo Blanco Estelar 20mm',
    colorHex: '#f1f5f9',
    thickness: 20,
    category: 'stone',
    textureType: 'stone',
    sheetLength: 3000,
    sheetWidth: 1400,
    sheetCost: 150000,
    hasGrain: false
  },
  {
    id: 'mat_back_3',
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

describe('Auditoría y Coherencia Contextual: Panel Inspector y Generador 3D', () => {
  let cabinetGen: CabinetGeneratorService;
  let projectService: ProjectStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CabinetGeneratorService,
        ProjectStorageService,
        JoineryEngineService,
        PartGeometryService
      ]
    });
    cabinetGen = TestBed.inject(CabinetGeneratorService);
    projectService = TestBed.inject(ProjectStorageService);
  });

  describe('1. Aislamiento Estricto de Mesones (countertop) y Piezas Libres', () => {
    it('debe impedir que un mesón sea reconstruido como gabinete o cajonera con gavetas', () => {
      const ctParts: Part[] = [
        {
          id: 'meson_p1',
          name: 'Mesón Cocina Principal',
          length: 1800,
          width: 600,
          thickness: 20,
          quantity: 1,
          materialId: 'mat_stone_20',
          materialName: 'Cuarzo Blanco',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'countertop',
          orientation: 'horizontal'
        }
      ];
      const ctGroup: PartGroup = {
        id: 'group_meson_1',
        name: 'Mesón Cocina',
        type: 'assembly',
        isCountertop: true
      };

      const cfg = cabinetGen.reconstructConfigFromParts(ctParts, ctGroup);
      expect(cfg.drawersCount).toBe(0);
      expect(cfg.shelvesCount).toBe(0);
      expect(cfg.doorOpening).toBe('none');
      expect(cfg.moduleType).toBe('custom');
    });

    it('ProjectStorageService.updateParametricCabinet debe abortar si el grupo es un mesón', () => {
      const ctPart: Part = {
        id: 'meson_part_1',
        name: 'Mesón Cuarzo',
        groupId: 'grp_ct_99',
        groupName: 'Mesón Monolítico',
        length: 1200,
        width: 600,
        thickness: 20,
        quantity: 1,
        materialId: 'mat_stone_20',
        materialName: 'Cuarzo',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'countertop'
      };
      const ctGroup: PartGroup = {
        id: 'grp_ct_99',
        name: 'Mesón Monolítico',
        type: 'assembly',
        isCountertop: true
      };

      projectService.clearFurniture();
      projectService.addPart(ctPart);
      projectService.updateProject(p => ({
        ...p,
        groups: [...(p.groups || []), ctGroup]
      }));

      // Intentar forzar una conversión a cajonera
      const fakeCabinetCfg: ParametricCabinetConfig = {
        code: 'HACK',
        name: 'Gabinete Destructor',
        moduleType: 'drawer_unit',
        width: 600,
        height: 800,
        depth: 500,
        structureThickness: 18,
        doorThickness: 18,
        backThickness: 3,
        backType: 'none',
        shelvesCount: 0,
        doorOpening: 'none',
        drawersCount: 3,
        structureMaterialId: 'mat_white_18',
        doorMaterialId: 'mat_white_18',
        backMaterialId: 'mat_back_3',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3
      };

      const cabinetRes = cabinetGen.generateParametricCabinet(fakeCabinetCfg, MOCK_MATERIALS);
      projectService.updateParametricCabinet('grp_ct_99', cabinetRes.parts, 'Gabinete Destructor', fakeCabinetCfg);

      // El mesón NO debe haberse reemplazado con las piezas del gabinete
      const partsAfter = projectService.currentProject().parts.filter(p => p.groupId === 'grp_ct_99');
      expect(partsAfter.length).toBe(1);
      expect(partsAfter[0].id).toBe('meson_part_1');
      expect(partsAfter[0].componentRole).toBe('countertop');
    });
  });

  describe('2. Reglas de Visibilidad Contextual y Configuración Coherente', () => {
    it('Alacena Aérea (wall_cabinet): drawersCount debe ser estrictamente 0, zócalo false y tapa maciza true', () => {
      const wallCfg: ParametricCabinetConfig = {
        code: 'ALAC600',
        name: 'Alacena Aérea 1P 2 Repisas',
        moduleType: 'wall_cabinet',
        category: 'kitchen_wall',
        width: 600,
        height: 720,
        depth: 320,
        structureThickness: 18,
        doorThickness: 18,
        backThickness: 3,
        backType: 'groove',
        shelvesCount: 2,
        doorOpening: 'left',
        structureMaterialId: 'mat_white_18',
        doorMaterialId: 'mat_white_18',
        backMaterialId: 'mat_back_3',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3
      };

      const res = cabinetGen.generateParametricCabinet(wallCfg, MOCK_MATERIALS);
      expect(res.group.parametricConfig?.drawersCount).toBe(0);
      expect(res.group.parametricConfig?.hangingRodsCount).toBe(0);
      expect(res.group.parametricConfig?.shelvesCount).toBe(2);

      // Ninguna pieza debe ser de cajón
      const drawerParts = res.parts.filter(p => p.componentRole === 'drawer_front' || p.componentRole === 'drawer_box');
      expect(drawerParts.length).toBe(0);

      // Debe tener 2 repisas físicas en 3D
      const shelfParts = res.parts.filter(p => p.componentRole === 'shelf');
      expect(shelfParts.length).toBe(2);

      // Reconstruir desde piezas debe arrojar drawersCount: 0
      const reconstructed = cabinetGen.reconstructConfigFromParts(res.parts, res.group);
      expect(reconstructed.drawersCount).toBe(0);
      expect(reconstructed.shelvesCount).toBe(2);
      expect(reconstructed.doorOpening).toBe('left');
      expect(reconstructed.hasPlinth).toBe(false);
      expect(reconstructed.hasTopCover).toBe(true);
      expect(reconstructed.topTieStrips).toBe(false);
    });

    it('Closet con barra colgador: genera tubo cromado físico en 3D y hangingRodsCount=1', () => {
      const closetCfg: ParametricCabinetConfig = {
        code: 'CLO800',
        name: 'Módulo Closet Colgado',
        moduleType: 'closet',
        category: 'closet',
        environmentLine: 'closet',
        width: 800,
        height: 2000,
        depth: 600,
        structureThickness: 18,
        doorThickness: 18,
        backThickness: 3,
        backType: 'groove',
        shelvesCount: 1,
        doorOpening: 'double',
        hangingRodsCount: 1,
        structureMaterialId: 'mat_white_18',
        doorMaterialId: 'mat_white_18',
        backMaterialId: 'mat_back_3',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3
      };

      const res = cabinetGen.generateParametricCabinet(closetCfg, MOCK_MATERIALS);
      const rodParts = res.parts.filter(p => p.name.includes('Tubo Colgador') || p.materialId === 'hw_rod_chrome');
      expect(rodParts.length).toBe(1);

      const reconstructed = cabinetGen.reconstructConfigFromParts(res.parts, res.group);
      expect(reconstructed.hangingRodsCount).toBe(1);
      expect(reconstructed.drawersCount).toBe(0);
    });

    it('Cajonera (drawer_unit): genera exactamente N cajones sin puertas ni repisas', () => {
      const drawerCfg: ParametricCabinetConfig = {
        code: 'CAJ4',
        name: 'Cajonera 4 Gavetas',
        moduleType: 'drawer_unit',
        category: 'drawers',
        width: 500,
        height: 860,
        depth: 550,
        structureThickness: 18,
        doorThickness: 18,
        backThickness: 3,
        backType: 'groove',
        shelvesCount: 0,
        doorOpening: 'none',
        drawersCount: 4,
        structureMaterialId: 'mat_white_18',
        doorMaterialId: 'mat_white_18',
        backMaterialId: 'mat_back_3',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3
      };

      const res = cabinetGen.generateParametricCabinet(drawerCfg, MOCK_MATERIALS);
      const fronts = res.parts.filter(p => p.componentRole === 'drawer_front');
      expect(fronts.length).toBe(4);

      const doors = res.parts.filter(p => p.componentRole === 'door');
      expect(doors.length).toBe(0);

      const shelves = res.parts.filter(p => p.componentRole === 'shelf');
      expect(shelves.length).toBe(0);

      const reconstructed = cabinetGen.reconstructConfigFromParts(res.parts, res.group);
      expect(reconstructed.drawersCount).toBe(4);
      expect(reconstructed.shelvesCount).toBe(0);
      expect(reconstructed.doorOpening).toBe('none');
    });

    it('Vanity de baño con destaje de sifón en U: genera el corte especial en 3D', () => {
      const vanityCfg: ParametricCabinetConfig = {
        code: 'VAN600',
        name: 'Vanity Baño Lavamanos',
        moduleType: 'vanity',
        category: 'vanity',
        environmentLine: 'bathroom',
        width: 600,
        height: 550,
        depth: 480,
        structureThickness: 18,
        doorThickness: 18,
        backThickness: 3,
        backType: 'none',
        shelvesCount: 0,
        doorOpening: 'none',
        drawersCount: 2,
        siphonCutout: { enabled: true, width: 180, depth: 220 },
        structureMaterialId: 'mat_white_18',
        doorMaterialId: 'mat_white_18',
        backMaterialId: 'mat_back_3',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3
      };

      const res = cabinetGen.generateParametricCabinet(vanityCfg, MOCK_MATERIALS);
      // El cajón superior debe contener cornerCutConfig u_siphon_cutout
      const cutParts = res.parts.filter(p => p.cornerCutConfig?.type === 'u_siphon_cutout');
      expect(cutParts.length).toBeGreaterThan(0);
      expect(cutParts[0].cornerCutConfig?.cutX).toBe(180);
      expect(cutParts[0].cornerCutConfig?.cutY).toBe(220);
    });
  });

  describe('3. Regla de Oro: Coherencia 1:1 entre piezas 3D y Contadores del Inspector', () => {
    it('si un grupo tiene 0 cajones en 3D, drawersCount reconstruido NUNCA debe ser mayor a 0', () => {
      // Simular grupo con configuración heredada corrupta (drawersCount: 3 pero 0 piezas de cajón)
      const parts: Part[] = [
        {
          id: 'lat_i',
          name: 'Lateral Izquierdo',
          length: 720,
          width: 320,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_white_18',
          materialName: 'Blanco',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'side_left'
        },
        {
          id: 'lat_d',
          name: 'Lateral Derecho',
          length: 720,
          width: 320,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_white_18',
          materialName: 'Blanco',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'side_right'
        },
        {
          id: 'rep_1',
          name: 'Entrepaño 1',
          length: 564,
          width: 300,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_white_18',
          materialName: 'Blanco',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'shelf'
        },
        {
          id: 'p_1',
          name: 'Puerta Frontal',
          length: 594,
          width: 714,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_white_18',
          materialName: 'Blanco',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'door'
        }
      ];

      const groupWithBogusDrawers: PartGroup = {
        id: 'grp_alacena_bogus',
        name: 'Alacena Aérea',
        type: 'assembly',
        parametricConfig: {
          code: 'ALAC600',
          name: 'Alacena Aérea',
          moduleType: 'wall_cabinet',
          width: 600,
          height: 720,
          depth: 320,
          structureThickness: 18,
          doorThickness: 18,
          backThickness: 3,
          backType: 'none',
          shelvesCount: 1,
          doorOpening: 'left',
          drawersCount: 3, // <--- Valor falso / corrupto
          structureMaterialId: 'mat_white_18',
          doorMaterialId: 'mat_white_18',
          backMaterialId: 'mat_back_3',
          handleType: 'bar_modern',
          handleFinish: 'brushed_steel',
          facadeGap: 3
        }
      };

      const cfg = cabinetGen.reconstructConfigFromParts(parts, groupWithBogusDrawers);
      expect(cfg.drawersCount).toBe(0);
      expect(cfg.shelvesCount).toBe(1);
      expect(cfg.doorOpening).toBe('left');
    });

    it('en drawer_unit con 0 cajones en 3D, drawersCount DEBE ser 0 (Golden Rule)', () => {
      const partsOnlyCarcass: Part[] = [
        {
          id: 'lat_i',
          name: 'Lateral Izquierdo',
          length: 720,
          width: 500,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_white_18',
          materialName: 'Blanco',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'side_left'
        },
        {
          id: 'lat_d',
          name: 'Lateral Derecho',
          length: 720,
          width: 500,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_white_18',
          materialName: 'Blanco',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'side_right'
        }
      ];

      const emptyDrawerGroup: PartGroup = {
        id: 'grp_drawer_empty',
        name: 'Cajonera Vacía',
        type: 'drawer',
        parametricConfig: {
          code: 'CAJ_EMPTY',
          name: 'Cajonera Vacía',
          moduleType: 'drawer_unit',
          category: 'drawers',
          width: 500,
          height: 720,
          depth: 500,
          structureThickness: 18,
          doorThickness: 18,
          backThickness: 3,
          backType: 'none',
          shelvesCount: 0,
          doorOpening: 'none',
          drawersCount: 3, // <--- Config dice 3 pero físicamente hay 0
          structureMaterialId: 'mat_white_18',
          doorMaterialId: 'mat_white_18',
          backMaterialId: 'mat_back_3',
          handleType: 'bar_modern',
          handleFinish: 'brushed_steel',
          facadeGap: 3
        }
      };

      const cfg = cabinetGen.reconstructConfigFromParts(partsOnlyCarcass, emptyDrawerGroup);
      expect(cfg.drawersCount).toBe(0);
      expect(cfg.shelvesCount).toBe(0);
      expect(cfg.doorOpening).toBe('none');
    });

    it('en mueble bajo sin puertas en 3D, doorOpening DEBE ser none (Golden Rule)', () => {
      const openParts: Part[] = [
        {
          id: 'lat_i',
          name: 'Lateral Izquierdo',
          length: 720,
          width: 500,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_white_18',
          materialName: 'Blanco',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'side_left'
        },
        {
          id: 'rep_1',
          name: 'Entrepaño',
          length: 564,
          width: 480,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_white_18',
          materialName: 'Blanco',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'shelf'
        }
      ];

      const openCabinetGroup: PartGroup = {
        id: 'grp_open',
        name: 'Módulo Abierto Nicho',
        type: 'assembly',
        parametricConfig: {
          code: 'NICHO',
          name: 'Nicho Abierto',
          moduleType: 'base_cabinet',
          category: 'kitchen_base',
          width: 600,
          height: 720,
          depth: 500,
          structureThickness: 18,
          doorThickness: 18,
          backThickness: 3,
          backType: 'none',
          shelvesCount: 1,
          doorOpening: 'double', // <--- Config dice double pero no hay puertas en 3D
          drawersCount: 0,
          structureMaterialId: 'mat_white_18',
          doorMaterialId: 'mat_white_18',
          backMaterialId: 'mat_back_3',
          handleType: 'bar_modern',
          handleFinish: 'brushed_steel',
          facadeGap: 3
        }
      };

      const cfg = cabinetGen.reconstructConfigFromParts(openParts, openCabinetGroup);
      expect(cfg.doorOpening).toBe('none');
      expect(cfg.shelvesCount).toBe(1);
      expect(cfg.drawersCount).toBe(0);
    });

    it('en closet sin tubos en 3D, hangingRodsCount DEBE ser 0 (Golden Rule)', () => {
      const closetNoRods: Part[] = [
        {
          id: 'lat_i',
          name: 'Lateral Izquierdo',
          length: 2000,
          width: 600,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_white_18',
          materialName: 'Blanco',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'side_left'
        }
      ];

      const closetGroup: PartGroup = {
        id: 'grp_closet_norods',
        name: 'Closet Sin Tubo',
        type: 'assembly',
        parametricConfig: {
          code: 'CLO_NO',
          name: 'Closet Sin Tubo',
          moduleType: 'closet',
          category: 'closet',
          environmentLine: 'closet',
          width: 800,
          height: 2000,
          depth: 600,
          structureThickness: 18,
          doorThickness: 18,
          backThickness: 3,
          backType: 'none',
          shelvesCount: 0,
          doorOpening: 'none',
          drawersCount: 0,
          hangingRodsCount: 2, // <--- Config dice 2 pero no hay tubos físicos
          structureMaterialId: 'mat_white_18',
          doorMaterialId: 'mat_white_18',
          backMaterialId: 'mat_back_3',
          handleType: 'bar_modern',
          handleFinish: 'brushed_steel',
          facadeGap: 3
        }
      };

      const cfg = cabinetGen.reconstructConfigFromParts(closetNoRods, closetGroup);
      expect(cfg.hangingRodsCount).toBe(0);
    });

    it('ProjectStorageService conmuta correctamente el tipo de grupo entre drawer y assembly', () => {
      const gId = 'test_group_toggle';
      const initialGroup: PartGroup = {
        id: gId,
        name: 'Gabinete Base',
        type: 'assembly'
      };

      projectService.clearFurniture();
      projectService.updateProject(p => ({
        ...p,
        groups: [initialGroup]
      }));

      // Conmutar a Cajonera
      const drawerCfg: ParametricCabinetConfig = {
        code: 'MOD_DRW',
        name: 'Gabinete Cajonera',
        moduleType: 'drawer_unit',
        width: 600,
        height: 800,
        depth: 500,
        structureThickness: 18,
        doorThickness: 18,
        backThickness: 3,
        backType: 'none',
        shelvesCount: 0,
        doorOpening: 'none',
        drawersCount: 3,
        structureMaterialId: 'mat_white_18',
        doorMaterialId: 'mat_white_18',
        backMaterialId: 'mat_back_3',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3
      };
      projectService.updateParametricCabinet(gId, [], 'Gabinete Cajonera', drawerCfg);
      let updatedG = (projectService.currentProject().groups || []).find(g => g.id === gId);
      expect(updatedG?.type).toBe('drawer');

      // Conmutar de vuelta a Puertas y Repisas
      const doorsCfg: ParametricCabinetConfig = {
        code: 'MOD_DOORS',
        name: 'Gabinete Puertas',
        moduleType: 'base_cabinet',
        width: 600,
        height: 800,
        depth: 500,
        structureThickness: 18,
        doorThickness: 18,
        backThickness: 3,
        backType: 'none',
        shelvesCount: 1,
        doorOpening: 'left',
        drawersCount: 0,
        structureMaterialId: 'mat_white_18',
        doorMaterialId: 'mat_white_18',
        backMaterialId: 'mat_back_3',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3
      };
      projectService.updateParametricCabinet(gId, [], 'Gabinete Puertas', doorsCfg);
      updatedG = (projectService.currentProject().groups || []).find(g => g.id === gId);
      expect(updatedG?.type).toBe('assembly');
    });
  });
});
