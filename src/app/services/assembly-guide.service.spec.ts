import { TestBed } from '@angular/core/testing';
import { AssemblyGuideService } from './assembly-guide.service';
import { ProjectStorageService } from './project-storage.service';
import { CabinetGeneratorService } from './cabinet-generator.service';
import { Material, ParametricCabinetConfig, Part, PartGroup, Project } from '../models/melamine.models';

describe('AssemblyGuideService', () => {
  let service: AssemblyGuideService;
  let projectService: ProjectStorageService;
  let cabinetGen: CabinetGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AssemblyGuideService, ProjectStorageService, CabinetGeneratorService]
    });
    service = TestBed.inject(AssemblyGuideService);
    projectService = TestBed.inject(ProjectStorageService);
    cabinetGen = TestBed.inject(CabinetGeneratorService);
  });

  it('debe crearse correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('debe calcular correctamente los pasos de armado, alturas en mm y tornillería para un mueble completo', () => {
    // Crear un módulo con casco, fondo, repisa, cajón y puerta
    const testParts: Part[] = [
      {
        id: 'part_side_l',
        name: 'Lateral Izquierdo',
        groupId: 'grp_mueble_1',
        groupName: 'Módulo Alacena Mixta',
        length: 800,
        width: 400,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_blanco',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'none' },
        componentRole: 'side_left',
        posX: 0,
        posY: 400,
        posZ: 200,
        orientation: 'vertical_yz'
      },
      {
        id: 'part_side_r',
        name: 'Lateral Derecho',
        groupId: 'grp_mueble_1',
        groupName: 'Módulo Alacena Mixta',
        length: 800,
        width: 400,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_blanco',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'none' },
        componentRole: 'side_right',
        posX: 600,
        posY: 400,
        posZ: 200,
        orientation: 'vertical_yz'
      },
      {
        id: 'part_bottom',
        name: 'Piso Inferior',
        groupId: 'grp_mueble_1',
        groupName: 'Módulo Alacena Mixta',
        length: 564,
        width: 400,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_blanco',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'bottom',
        posX: 300,
        posY: 9,
        posZ: 200,
        orientation: 'horizontal'
      },
      {
        id: 'part_top',
        name: 'Techo Superior',
        groupId: 'grp_mueble_1',
        groupName: 'Módulo Alacena Mixta',
        length: 564,
        width: 400,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_blanco',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'top',
        posX: 300,
        posY: 791,
        posZ: 200,
        orientation: 'horizontal'
      },
      {
        id: 'part_back',
        name: 'Fondo Trasero',
        groupId: 'grp_mueble_1',
        groupName: 'Módulo Alacena Mixta',
        length: 790,
        width: 590,
        thickness: 3,
        quantity: 1,
        materialId: 'mat_fondo',
        materialName: 'MDF Durolac Blanco 3mm',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'back',
        posX: 300,
        posY: 400,
        posZ: 1.5,
        orientation: 'vertical_xy'
      },
      {
        id: 'part_shelf',
        name: 'Repisa Central',
        groupId: 'grp_mueble_1',
        groupName: 'Módulo Alacena Mixta',
        length: 564,
        width: 380,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_blanco',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'shelf',
        posX: 300,
        posY: 450,
        posZ: 200,
        orientation: 'horizontal'
      },
      {
        id: 'part_drawer_front',
        name: 'Frente de Cajón',
        groupId: 'grp_mueble_1',
        groupName: 'Módulo Alacena Mixta',
        length: 594,
        width: 180,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_blanco',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        componentRole: 'drawer_front',
        posX: 300,
        posY: 100,
        posZ: 410,
        orientation: 'vertical_xy'
      },
      {
        id: 'part_door',
        name: 'Puerta Superior',
        groupId: 'grp_mueble_1',
        groupName: 'Módulo Alacena Mixta',
        length: 600,
        width: 594,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_blanco',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        componentRole: 'door',
        posX: 300,
        posY: 490,
        posZ: 410,
        orientation: 'vertical_xy'
      }
    ];

    const group: PartGroup = {
      id: 'grp_mueble_1',
      name: 'Módulo Alacena Mixta',
      type: 'assembly',
      parametricConfig: {
        code: 'MOD-MIXTO',
        name: 'Módulo Alacena Mixta',
        moduleType: 'base_cabinet',
        width: 600,
        height: 800,
        depth: 400,
        structureThickness: 18,
        doorThickness: 18,
        backThickness: 3,
        backType: 'overlay',
        shelvesCount: 1,
        doorOpening: 'left',
        structureMaterialId: 'mat_blanco',
        doorMaterialId: 'mat_blanco',
        backMaterialId: 'mat_fondo',
        handleType: 'bar_modern',
        handleFinish: 'black',
        facadeGap: 3,
        drawersCount: 1
      }
    };

    const mockProject: Project = {
      id: 'proj_test_1',
      name: 'Proyecto Cocina RTA',
      clientName: 'Cliente Prueba',
      date: '2026-11-06',
      notes: '',
      settings: {
        sawKerf: 4,
        trimMargin: 10,
        thinEdgeThickness: 0.5,
        thickEdgeThickness: 2.0,
        thinEdgeCostPerMeter: 500,
        thickEdgeCostPerMeter: 1200,
        optimizationPreference: 'guillotine_length',
        currency: 'COP'
      },
      materials: [
        {
          id: 'mat_blanco',
          name: 'Melamina Blanca 18mm',
          thickness: 18,
          sheetLength: 2440,
          sheetWidth: 1830,
          sheetCost: 150000,
          hasGrain: false,
          colorHex: '#ffffff'
        },
        {
          id: 'mat_fondo',
          name: 'MDF Durolac Blanco 3mm',
          thickness: 3,
          sheetLength: 2440,
          sheetWidth: 1830,
          sheetCost: 50000,
          hasGrain: false,
          colorHex: '#f1f5f9'
        }
      ],
      modules: [],
      parts: testParts,
      groups: [group],
      hardware: [],
      laborCost: 0,
      laborType: 'percent',
      profitMarginPercent: 20,
      taxPercent: 19,
      updatedAt: '2026-11-06T00:00:00.000Z'
    };

    const guides = service.generateGuidesForProject(mockProject);
    expect(guides.length).toBe(1);

    const guide = guides[0];
    expect(guide.moduleName).toBe('Módulo Alacena Mixta');
    expect(guide.dimensions.width).toBe(600);
    expect(guide.dimensions.height).toBe(800);
    expect(guide.dimensions.depth).toBe(400);
    expect(guide.pieces.length).toBe(8);

    // Códigos P1 a P8 asignados
    expect(guide.pieces[0].code).toBe('P1');
    expect(guide.pieces[7].code).toBe('P8');

    // Comprobar que se generaron los 5 pasos de armado secuenciales
    expect(guide.steps.length).toBe(5);
    expect(guide.steps[0].actionType).toBe('carcass');
    expect(guide.steps[1].actionType).toBe('back');
    expect(guide.steps[2].actionType).toBe('shelves');
    expect(guide.steps[3].actionType).toBe('drawers');
    expect(guide.steps[4].actionType).toBe('doors');

    // Comprobar cotas en mm calculadas
    // Repisa (Paso 3)
    const shelfStep = guide.steps[2];
    expect(shelfStep.measurements).toBeDefined();
    expect(shelfStep.measurements!.length).toBeGreaterThan(0);
    expect(shelfStep.measurements![0].valueMm).toBeGreaterThan(0);

    // Corredera de cajón (Paso 4)
    const drawerStep = guide.steps[3];
    expect(drawerStep.measurements).toBeDefined();
    expect(drawerStep.measurements!.length).toBe(1);
    expect(drawerStep.measurements![0].valueMm).toBeGreaterThan(0);

    // Comprobar Kit de Herrajes y Tornillería
    const structuralScrews = guide.hardwareKit.find(h => h.id === 'screw_structural_50');
    expect(structuralScrews).toBeDefined();
    // depth > 350 => 3 tornillos por unión
    expect(structuralScrews!.quantity).toBeGreaterThanOrEqual(12);

    const backNails = guide.hardwareKit.find(h => h.id === 'nail_back_panel');
    expect(backNails).toBeDefined();
    // Perímetro (790+590)*2 = 2760 mm / 150 = ~19 puntillas
    expect(backNails!.quantity).toBeGreaterThanOrEqual(18);

    const shelfPins = guide.hardwareKit.find(h => h.id === 'shelf_pins');
    expect(shelfPins).toBeDefined();
    expect(shelfPins!.quantity).toBe(4); // 4 por repisa

    const slides = guide.hardwareKit.find(h => h.id === 'telescopic_slides');
    expect(slides).toBeDefined();
    expect(slides!.quantity).toBe(1); // 1 cajón = 1 par de correderas

    const hinges = guide.hardwareKit.find(h => h.id === 'cup_hinges');
    expect(hinges).toBeDefined();
    expect(hinges!.quantity).toBe(2); // Puerta de 600 mm < 900 mm => 2 bisagras

    const handles = guide.hardwareKit.find(h => h.id === 'handles_knobs');
    expect(handles).toBeDefined();
    expect(handles!.quantity).toBe(2); // 1 puerta + 1 cajón = 2 tiradores
  });

  it('debe excluir mesones de piedra y mesones puros de las guías de ensamble', () => {
    const mockProjectWithCountertop: Project = {
      id: 'proj_test_ct',
      name: 'Cocina con Mesón',
      clientName: 'Cliente',
      date: '2026-11-06',
      notes: '',
      settings: {
        sawKerf: 4,
        trimMargin: 10,
        thinEdgeThickness: 0.5,
        thickEdgeThickness: 2.0,
        thinEdgeCostPerMeter: 500,
        thickEdgeCostPerMeter: 1200,
        optimizationPreference: 'guillotine_length',
        currency: 'COP'
      },
      materials: [
        {
          id: 'mat_granito',
          name: 'Granito San Gabriel (Mesón)',
          thickness: 20,
          sheetLength: 2600,
          sheetWidth: 650,
          sheetCost: 400000,
          hasGrain: false,
          colorHex: '#18181b',
          category: 'countertop'
        }
      ],
      modules: [],
      parts: [
        {
          id: 'part_ct',
          name: 'Mesón Granito',
          groupId: 'grp_ct',
          groupName: 'Mesón Cuarzo',
          length: 2000,
          width: 600,
          thickness: 20,
          quantity: 1,
          materialId: 'mat_granito',
          materialName: 'Granito San Gabriel (Mesón)',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'countertop'
        }
      ],
      groups: [
        {
          id: 'grp_ct',
          name: 'Mesón Principal',
          type: 'custom',
          isCountertop: true
        }
      ],
      hardware: [],
      laborCost: 0,
      laborType: 'percent',
      profitMarginPercent: 20,
      taxPercent: 19,
      updatedAt: '2026-11-06T00:00:00.000Z'
    };

    const guides = service.generateGuidesForProject(mockProjectWithCountertop);
    expect(guides.length).toBe(0);
  });

  it('debe calcular cotas de divisor vertical en Paso 3 y de rieles con frentes 3D en Paso 4', () => {
    const dividerPart: Part = {
      id: 'part_div_1',
      name: 'División Central',
      groupId: 'grp_mod_2',
      groupName: 'Módulo con Divisor',
      length: 700,
      width: 400,
      thickness: 18,
      quantity: 1,
      materialId: 'mat_1',
      materialName: 'Melamina 18mm',
      grain: 'length',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      componentRole: 'divider',
      posX: 450,
      posY: 400,
      posZ: 200,
      orientation: 'vertical_yz'
    };

    const sideL: Part = {
      id: 'part_side_l2',
      name: 'Lateral Izquierdo',
      groupId: 'grp_mod_2',
      groupName: 'Módulo con Divisor',
      length: 800,
      width: 400,
      thickness: 18,
      quantity: 1,
      materialId: 'mat_1',
      materialName: 'Melamina 18mm',
      grain: 'length',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      componentRole: 'side_left',
      posX: 0,
      posY: 400,
      posZ: 200,
      orientation: 'vertical_yz'
    };

    const sideR: Part = {
      id: 'part_side_r2',
      name: 'Lateral Derecho',
      groupId: 'grp_mod_2',
      groupName: 'Módulo con Divisor',
      length: 800,
      width: 400,
      thickness: 18,
      quantity: 1,
      materialId: 'mat_1',
      materialName: 'Melamina 18mm',
      grain: 'length',
      edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
      componentRole: 'side_right',
      posX: 900,
      posY: 400,
      posZ: 200,
      orientation: 'vertical_yz'
    };

    const drawerFront: Part = {
      id: 'part_df_1',
      name: 'Cajón Inferior - Frente',
      groupId: 'grp_mod_2',
      groupName: 'Módulo con Divisor',
      length: 400,
      width: 200,
      thickness: 18,
      quantity: 1,
      materialId: 'mat_1',
      materialName: 'Melamina 18mm',
      grain: 'length',
      edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
      componentRole: 'drawer_front',
      posX: 220,
      posY: 150,
      posZ: 410,
      orientation: 'vertical_xy'
    };

    const testProject: Project = {
      id: 'proj_div_test',
      name: 'Proyecto Divisor',
      clientName: 'Cliente',
      date: '2026-11-06',
      notes: '',
      settings: {
        sawKerf: 4,
        trimMargin: 10,
        thinEdgeThickness: 0.5,
        thickEdgeThickness: 2.0,
        thinEdgeCostPerMeter: 500,
        thickEdgeCostPerMeter: 1200,
        optimizationPreference: 'guillotine_length',
        currency: 'COP'
      },
      materials: [{
        id: 'mat_1',
        name: 'Melamina 18mm',
        thickness: 18,
        sheetLength: 2440,
        sheetWidth: 1830,
        sheetCost: 150000,
        hasGrain: false,
        colorHex: '#ffffff'
      }],
      modules: [],
      parts: [sideL, sideR, dividerPart, drawerFront],
      groups: [{
        id: 'grp_mod_2',
        name: 'Módulo con Divisor',
        type: 'assembly'
      }],
      hardware: [],
      laborCost: 0,
      laborType: 'percent',
      profitMarginPercent: 20,
      taxPercent: 19,
      updatedAt: '2026-11-06T00:00:00.000Z'
    };

    const guides = service.generateGuidesForProject(testProject);
    expect(guides.length).toBe(1);

    const guide = guides[0];
    const step3 = guide.steps.find(s => s.actionType === 'shelves');
    expect(step3).toBeDefined();
    expect(step3?.measurements).toBeDefined();
    // Debe contener medición del divisor
    const divMeasurement = step3?.measurements?.find(m => m.label.includes('Divisor'));
    expect(divMeasurement).toBeDefined();
    expect(divMeasurement!.valueMm).toBeGreaterThan(50);

    const step4 = guide.steps.find(s => s.actionType === 'drawers');
    expect(step4).toBeDefined();
    expect(step4?.measurements).toBeDefined();
    expect(step4!.measurements!.length).toBe(1);
    expect(step4!.measurements![0].valueMm).toBeGreaterThan(0);
  });

  it('debe detectar tubos colgadores para closet a partir de partes con forma circular o nombres de tubo', () => {
    const closetProject: Project = {
      id: 'proj_closet',
      name: 'Ropero Closet',
      clientName: '',
      date: '2026-11-06',
      notes: '',
      settings: {
        sawKerf: 4,
        trimMargin: 10,
        thinEdgeThickness: 0.5,
        thickEdgeThickness: 2.0,
        thinEdgeCostPerMeter: 500,
        thickEdgeCostPerMeter: 1200,
        optimizationPreference: 'guillotine_length',
        currency: 'COP'
      },
      materials: [{
        id: 'mat_1',
        name: 'Melamina 18mm',
        thickness: 18,
        sheetLength: 2440,
        sheetWidth: 1830,
        sheetCost: 150000,
        hasGrain: false,
        colorHex: '#ffffff'
      }],
      modules: [],
      parts: [
        {
          id: 'p_lat_l',
          name: 'Lateral Izquierdo',
          groupId: 'grp_closet',
          length: 2000,
          width: 550,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Melamina 18mm',
          grain: 'length',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'side_left'
        },
        {
          id: 'p_lat_r',
          name: 'Lateral Derecho',
          groupId: 'grp_closet',
          length: 2000,
          width: 550,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Melamina 18mm',
          grain: 'length',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'side_right'
        },
        {
          id: 'p_tubo',
          name: 'Tubo Colgador Metálico',
          groupId: 'grp_closet',
          length: 900,
          width: 25,
          thickness: 25,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Tubo Cromado',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          shapeType: 'circle'
        }
      ],
      groups: [{
        id: 'grp_closet',
        name: 'Closet Ropero',
        type: 'assembly'
      }],
      hardware: [],
      laborCost: 0,
      laborType: 'percent',
      profitMarginPercent: 20,
      taxPercent: 19,
      updatedAt: '2026-11-06T00:00:00.000Z'
    };

    const guides = service.generateGuidesForProject(closetProject);
    expect(guides.length).toBe(1);

    const closetGuide = guides[0];
    const closetRodItem = closetGuide.hardwareKit.find(h => h.id === 'closet_hanging_rod');
    expect(closetRodItem).toBeDefined();
    expect(closetRodItem?.quantity).toBe(1);
  });

  it('debe mapear correctamente getPieceCodeForPart y canGenerateAssemblyGuide reactivamente', () => {
    projectService.currentProject.set({
      id: 'proj_reactivo',
      name: 'Módulo Simple',
      clientName: '',
      date: '2026-11-06',
      notes: '',
      settings: {
        sawKerf: 4,
        trimMargin: 10,
        thinEdgeThickness: 0.5,
        thickEdgeThickness: 2.0,
        thinEdgeCostPerMeter: 500,
        thickEdgeCostPerMeter: 1200,
        optimizationPreference: 'guillotine_length',
        currency: 'COP'
      },
      materials: [{
        id: 'mat_1',
        name: 'Melamina 18mm',
        thickness: 18,
        sheetLength: 2440,
        sheetWidth: 1830,
        sheetCost: 150000,
        hasGrain: false,
        colorHex: '#ffffff'
      }],
      modules: [],
      parts: [
        {
          id: 'part_p1_test',
          name: 'Lateral Izquierdo',
          groupId: 'grp_reactivo',
          length: 800,
          width: 400,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Melamina 18mm',
          grain: 'length',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'side_left'
        },
        {
          id: 'part_p2_test',
          name: 'Lateral Derecho',
          groupId: 'grp_reactivo',
          length: 800,
          width: 400,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Melamina 18mm',
          grain: 'length',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'side_right'
        }
      ],
      groups: [{
        id: 'grp_reactivo',
        name: 'Mueble Simple',
        type: 'assembly'
      }],
      hardware: [],
      laborCost: 0,
      laborType: 'percent',
      profitMarginPercent: 20,
      taxPercent: 19,
      updatedAt: '2026-11-06T00:00:00.000Z'
    });

    expect(service.canGenerateAssemblyGuide()).toBe(true);

    const codeP1 = service.getPieceCodeForPart('part_p1_test');
    expect(codeP1).toBe('P1');

    const codeP2 = service.getPieceCodeForPart('part_p2_test');
    expect(codeP2).toBe('P2');

    // Un módulo sin cajones ni puertas solo debe generar Paso 1 (casco)
    const guides = service.guides();
    expect(guides.length).toBe(1);
    expect(guides[0].steps.length).toBe(1);
    expect(guides[0].steps[0].actionType).toBe('carcass');
  });

  it('Alacena Sobre-Nevera 90cm (900x400x600): P5 horizontal (868x398x3), pasos progresivos y pistones a gas + bisagras', () => {
    const mats: Material[] = [
      {
        id: 'mat_blanco_15',
        name: 'Melamina Blanca 15mm',
        thickness: 15,
        sheetLength: 2440,
        sheetWidth: 1830,
        sheetCost: 150000,
        hasGrain: false,
        colorHex: '#ffffff'
      },
      {
        id: 'mat_mdf_3',
        name: 'MDF Durolac 3mm',
        thickness: 3,
        sheetLength: 2440,
        sheetWidth: 1830,
        sheetCost: 50000,
        hasGrain: false,
        colorHex: '#f8fafc'
      }
    ];

    const cfg: ParametricCabinetConfig = {
      code: 'MSN900',
      name: 'Alacena Sobre-Nevera 90cm',
      moduleType: 'wall_cabinet',
      category: 'kitchen_wall',
      environmentLine: 'kitchen',
      width: 900,
      height: 400,
      depth: 600,
      structureThickness: 15,
      doorThickness: 15,
      backThickness: 3,
      backType: 'groove',
      shelvesCount: 0,
      doorOpening: 'top',
      structureMaterialId: 'mat_blanco_15',
      doorMaterialId: 'mat_blanco_15',
      backMaterialId: 'mat_mdf_3',
      elevationY: 1850,
      hasPlinth: false,
      hasTopCover: true,
      hasBackPanel: true,
      hasHandle: true,
      handleType: 'bar_modern',
      handleFinish: 'brushed_steel',
      facadeGap: 3,
      posX: 0,
      posY: 2050,
      posZ: 0
    };

    const generated = cabinetGen.generateParametricCabinet(cfg, mats);

    const project: Project = {
      id: 'proj_sobre_nevera',
      name: 'Cocina Sobre-Nevera',
      clientName: '',
      date: '2026-11-14',
      notes: '',
      settings: {
        sawKerf: 4,
        trimMargin: 10,
        thinEdgeThickness: 0.5,
        thickEdgeThickness: 2.0,
        thinEdgeCostPerMeter: 500,
        thickEdgeCostPerMeter: 1200,
        optimizationPreference: 'guillotine_length',
        currency: 'COP'
      },
      materials: mats,
      modules: [generated.module],
      parts: generated.parts,
      groups: [generated.group],
      hardware: [],
      laborCost: 0,
      laborType: 'percent',
      profitMarginPercent: 20,
      taxPercent: 19,
      updatedAt: '2026-11-14T00:00:00.000Z'
    };

    const guides = service.generateGuidesForProject(project);
    expect(guides.length).toBe(1);

    const guide = guides[0];
    expect(guide.dimensions).toEqual({ width: 900, height: 400, depth: 600 });
    expect(guide.pieces.length).toBe(6);

    // P5 Fondo Trasero Ranurado debe tener orientación horizontal real (868 x 398 x 3)
    const p5 = guide.pieces.find(p => p.code === 'P5');
    expect(p5).toBeDefined();
    expect(p5!.resolvedRole).toBe('back');
    expect(p5!.worldBounds.spanX).toBe(868);
    expect(p5!.worldBounds.spanY).toBe(398);
    expect(p5!.worldBounds.spanZ).toBe(3);

    // P6 Puerta Abatible Superior
    const p6 = guide.pieces.find(p => p.code === 'P6');
    expect(p6).toBeDefined();
    expect(p6!.resolvedRole).toBe('door');
    expect(p6!.worldBounds.spanX).toBe(897);
    expect(p6!.worldBounds.spanY).toBe(397);
    expect(p6!.worldBounds.spanZ).toBe(15);

    // Pasos progresivos estrictos: Paso 1 (Casco P1..P4) -> Paso 2 (Fondo P5) -> Paso 3 (Puertas P6)
    expect(guide.steps.length).toBe(3);

    const step1 = guide.steps[0];
    expect(step1.actionType).toBe('carcass');
    expect(step1.partCodes).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(step1.cumulativePriorPartCodes).toEqual([]);
    expect(step1.partCodes).not.toContain('P5');
    expect(step1.partCodes).not.toContain('P6');

    const step2 = guide.steps[1];
    expect(step2.actionType).toBe('back');
    expect(step2.partCodes).toEqual(['P5']);
    expect(step2.cumulativePriorPartCodes).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(step2.partCodes).not.toContain('P6');
    expect(step2.cumulativePriorPartCodes).not.toContain('P6');

    const step3 = guide.steps[2];
    expect(step3.actionType).toBe('doors');
    expect(step3.partCodes).toEqual(['P6']);
    expect(step3.cumulativePriorPartCodes).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);

    // Kit de herrajes y Paso final deben incluir 2 Pistones a Gas Y 2 Bisagras Cazoleta 35mm
    const gasPistonsKit = guide.hardwareKit.find(h => h.type === 'gas_piston');
    expect(gasPistonsKit).toBeDefined();
    expect(gasPistonsKit!.id).toBe('piston_gas_pair');
    expect(gasPistonsKit!.quantity).toBe(2);
    expect(gasPistonsKit!.name).toBe('Pistones Hidráulicos a Gas');

    const cupHingesKit = guide.hardwareKit.find(h => h.type === 'hinge');
    expect(cupHingesKit).toBeDefined();
    expect(cupHingesKit!.quantity).toBe(2);

    const stepGasPistons = step3.hardware.find(h => h.type === 'gas_piston');
    expect(stepGasPistons).toBeDefined();
    expect(stepGasPistons!.quantity).toBe(2);

    const stepHinges = step3.hardware.find(h => h.type === 'hinge');
    expect(stepHinges).toBeDefined();
    expect(stepHinges!.quantity).toBe(2);
  });

  it('debe soportar muebles armados manualmente pieza a pieza con tableros rotados/free, role inference, pasos progresivos y 0 piezas faltantes', () => {
    const manualParts: Part[] = [
      // Lateral izquierdo construido rotando un tablero horizontal 90° en Z (sin componentRole ni groupId)
      {
        id: 'man_lat_izq',
        name: 'Tablero Vertical Izq',
        length: 800,
        width: 400,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_1',
        materialName: 'Melamina Roble 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
        posX: 9,
        posY: 400,
        posZ: 200,
        orientation: 'horizontal',
        rotationZ: 90
      },
      // Lateral derecho
      {
        id: 'man_lat_der',
        name: 'Tablero Vertical Der',
        length: 800,
        width: 400,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_1',
        materialName: 'Melamina Roble 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'thin', a2: 'thin' },
        posX: 591,
        posY: 400,
        posZ: 200,
        orientation: 'vertical_yz',
        componentRole: 'free'
      },
      // Piso inferior
      {
        id: 'man_piso',
        name: 'Tablero Base',
        length: 564,
        width: 400,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_1',
        materialName: 'Melamina Roble 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 300,
        posY: 9,
        posZ: 200,
        orientation: 'horizontal'
      },
      // Techo superior
      {
        id: 'man_techo',
        name: 'Tablero Superior',
        length: 564,
        width: 400,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_1',
        materialName: 'Melamina Roble 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 300,
        posY: 791,
        posZ: 200,
        orientation: 'horizontal',
        componentRole: 'free'
      },
      // Fondo trasero sin componentRole
      {
        id: 'man_fondo',
        name: 'Lámina Posterior',
        length: 590,
        width: 790,
        thickness: 3,
        quantity: 1,
        materialId: 'mat_mdf',
        materialName: 'MDF 3mm',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 300,
        posY: 400,
        posZ: 1.5,
        orientation: 'vertical_xy'
      },
      // Tablero interior inclinado 35° (rol 'free', cz <= centerZ -> debe ir a Paso 3)
      {
        id: 'man_atril_interior',
        name: 'Separador Inclinado Interior',
        length: 400,
        width: 240,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_1',
        materialName: 'Melamina Roble 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 300,
        posY: 420,
        posZ: 180,
        orientation: 'horizontal',
        rotationZ: 35,
        componentRole: 'free'
      },
      // Puerta frontal sin componentRole
      {
        id: 'man_puerta',
        name: 'Hoja Frontal',
        length: 594,
        width: 794,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_1',
        materialName: 'Melamina Roble 18mm',
        grain: 'length',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        posX: 300,
        posY: 400,
        posZ: 409,
        orientation: 'vertical_xy'
      },
      // Listón exterior rotado 45° en el frente (rol 'free', cz > centerZ -> debe ir a Paso 5)
      {
        id: 'man_moldura_ext',
        name: 'Moldura Frontal Oblicua',
        length: 300,
        width: 120,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_1',
        materialName: 'Melamina Roble 18mm',
        grain: 'none',
        edges: { l1: 'thin', l2: 'thin', a1: 'thin', a2: 'thin' },
        posX: 300,
        posY: 400,
        posZ: 425,
        orientation: 'vertical_xy',
        rotationZ: 45,
        componentRole: 'free'
      }
    ];

    const manualProject: Project = {
      id: 'proj_manual_custom',
      name: 'Mueble Armado Manual',
      clientName: 'Taller',
      date: '2026-11-14',
      notes: '',
      settings: {
        sawKerf: 4,
        trimMargin: 10,
        thinEdgeThickness: 0.5,
        thickEdgeThickness: 2.0,
        thinEdgeCostPerMeter: 500,
        thickEdgeCostPerMeter: 1200,
        optimizationPreference: 'guillotine_length',
        currency: 'COP'
      },
      materials: [
        {
          id: 'mat_1',
          name: 'Melamina Roble 18mm',
          thickness: 18,
          sheetLength: 2440,
          sheetWidth: 1830,
          sheetCost: 160000,
          hasGrain: true,
          colorHex: '#d6b58d'
        },
        {
          id: 'mat_mdf',
          name: 'MDF 3mm',
          thickness: 3,
          sheetLength: 2440,
          sheetWidth: 1830,
          sheetCost: 50000,
          hasGrain: false,
          colorHex: '#f8fafc'
        }
      ],
      modules: [],
      parts: manualParts,
      groups: [],
      hardware: [],
      laborCost: 0,
      laborType: 'percent',
      profitMarginPercent: 20,
      taxPercent: 19,
      updatedAt: '2026-11-14T00:00:00.000Z'
    };

    const guides = service.generateGuidesForProject(manualProject);
    expect(guides.length).toBe(1);

    const guide = guides[0];
    expect(guide.moduleName).toBe('Mueble Armado Manual');
    expect(guide.pieces.length).toBe(manualParts.length);

    // Verificar worldBounds exactos y roles inferidos
    const pieceByPartId = new Map(guide.pieces.map(p => [p.partId, p]));
    expect(pieceByPartId.get('man_lat_izq')!.resolvedRole).toBe('side_left');
    expect(pieceByPartId.get('man_lat_izq')!.worldBounds.spanX).toBe(18);
    expect(pieceByPartId.get('man_lat_izq')!.worldBounds.spanY).toBe(800);
    expect(pieceByPartId.get('man_lat_izq')!.worldBounds.spanZ).toBe(400);

    expect(pieceByPartId.get('man_lat_der')!.resolvedRole).toBe('side_right');
    expect(pieceByPartId.get('man_piso')!.resolvedRole).toBe('bottom');
    expect(pieceByPartId.get('man_techo')!.resolvedRole).toBe('top');
    expect(pieceByPartId.get('man_fondo')!.resolvedRole).toBe('back');
    expect(pieceByPartId.get('man_puerta')!.resolvedRole).toBe('door');
    expect(pieceByPartId.get('man_atril_interior')!.resolvedRole).toBe('free');
    expect(pieceByPartId.get('man_moldura_ext')!.resolvedRole).toBe('free');

    // Verificar AABB de la pieza inclinada a 35° (spanX > 400*cos(35°), spanY > 100)
    const tiltedBounds = pieceByPartId.get('man_atril_interior')!.worldBounds;
    expect(tiltedBounds.spanX).toBeGreaterThan(330);
    expect(tiltedBounds.spanY).toBeGreaterThan(230);
    expect(tiltedBounds.spanZ).toBe(240);

    // Verificar cobertura total (0 piezas faltantes), disjunta y cumulativePriorPartCodes progresivo
    const seenStepCodes = new Set<string>();
    const expectedPrior: string[] = [];

    for (const step of guide.steps) {
      expect(step.cumulativePriorPartCodes).toEqual(expectedPrior);
      for (const code of step.partCodes) {
        expect(seenStepCodes.has(code)).toBe(false);
        expect(step.cumulativePriorPartCodes).not.toContain(code);
        seenStepCodes.add(code);
      }
      expectedPrior.push(...step.partCodes);
    }

    expect(seenStepCodes.size).toBe(guide.pieces.length);
    for (const piece of guide.pieces) {
      expect(seenStepCodes.has(piece.code)).toBe(true);
    }

    // Pieza interior 'free' en Paso 3 (shelves) y moldura exterior 'free' en Paso 5 (doors)
    const shelvesStep = guide.steps.find(s => s.actionType === 'shelves');
    expect(shelvesStep).toBeDefined();
    expect(shelvesStep!.parts.some(p => p.partId === 'man_atril_interior')).toBe(true);

    const doorsStep = guide.steps.find(s => s.actionType === 'doors');
    expect(doorsStep).toBeDefined();
    expect(doorsStep!.parts.some(p => p.partId === 'man_puerta')).toBe(true);
    expect(doorsStep!.parts.some(p => p.partId === 'man_moldura_ext')).toBe(true);
  });

  it('debe combinar grupos modulares y tableros sueltos de escena sin omitir ninguna pieza armable', () => {
    const mixedParts: Part[] = [
      {
        id: 'grp_side_l',
        name: 'Lateral Izquierdo',
        groupId: 'grp_base',
        groupName: 'Módulo Base',
        length: 700,
        width: 400,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_1',
        materialName: 'Melamina 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'side_left',
        posX: 9,
        posY: 350,
        posZ: 200,
        orientation: 'vertical_yz'
      },
      {
        id: 'grp_side_r',
        name: 'Lateral Derecho',
        groupId: 'grp_base',
        groupName: 'Módulo Base',
        length: 700,
        width: 400,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_1',
        materialName: 'Melamina 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'side_right',
        posX: 591,
        posY: 350,
        posZ: 200,
        orientation: 'vertical_yz'
      },
      {
        id: 'loose_board_1',
        name: 'Repisa Suelta',
        length: 800,
        width: 250,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_1',
        materialName: 'Melamina 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 1200,
        posY: 1200,
        posZ: 125,
        orientation: 'horizontal'
      },
      {
        id: 'loose_board_2',
        name: 'Ménsula Derecha',
        length: 250,
        width: 200,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_1',
        materialName: 'Melamina 18mm',
        grain: 'none',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 1591,
        posY: 1100,
        posZ: 125,
        orientation: 'vertical_yz'
      }
    ];

    const mixedProject: Project = {
      id: 'proj_mixed',
      name: 'Escena Mixta',
      clientName: '',
      date: '2026-11-14',
      notes: '',
      settings: {
        sawKerf: 4,
        trimMargin: 10,
        thinEdgeThickness: 0.5,
        thickEdgeThickness: 2.0,
        thinEdgeCostPerMeter: 500,
        thickEdgeCostPerMeter: 1200,
        optimizationPreference: 'guillotine_length',
        currency: 'COP'
      },
      materials: [{
        id: 'mat_1',
        name: 'Melamina 18mm',
        thickness: 18,
        sheetLength: 2440,
        sheetWidth: 1830,
        sheetCost: 150000,
        hasGrain: false,
        colorHex: '#ffffff'
      }],
      modules: [],
      parts: mixedParts,
      groups: [{
        id: 'grp_base',
        name: 'Módulo Base',
        type: 'assembly'
      }],
      hardware: [],
      laborCost: 0,
      laborType: 'percent',
      profitMarginPercent: 20,
      taxPercent: 19,
      updatedAt: '2026-11-14T00:00:00.000Z'
    };

    const guides = service.generateGuidesForProject(mixedProject);
    expect(guides.length).toBe(2);
    expect(guides[0].moduleName).toBe('Módulo Base');
    expect(guides[1].moduleName).toBe('Mueble Armado Manual');

    const totalGuideParts = guides.reduce((sum, g) => sum + g.pieces.length, 0);
    expect(totalGuideParts).toBe(mixedParts.length);
  });
});
