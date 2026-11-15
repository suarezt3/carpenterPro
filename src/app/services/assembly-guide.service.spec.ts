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

  it('debe consolidar torre compleja de 6 cajones (3×177mm + 3×160mm = 36 piezas de cajón, 49 en total) en 2 sub-ensambles ×3, Paso 4A/4B, 100% códigos y callouts agrupados', () => {
    const groupId = 'grp_torre_closet';
    const groupName = 'Torre Clóset 6 Cajones';

    const buildDrawerParts = (opts: {
      idPrefix: string;
      drawerLabel: string;
      centerX: number;
      boxBottomY: number;
      boxHeight: number;
      frontHeight: number;
      boxWidth: number;
      slideLength: number;
      boxT: number;
      frontCenterZ: number;
      useExplicitSubRoles?: boolean;
    }): Part[] => {
      const {
        idPrefix,
        drawerLabel,
        centerX,
        boxBottomY,
        boxHeight,
        frontHeight,
        boxWidth,
        slideLength,
        boxT,
        frontCenterZ,
        useExplicitSubRoles
      } = opts;
      const innerW = boxWidth - 2 * boxT;
      const depthCenter = frontCenterZ - 11 - slideLength / 2;
      const boxCenterY = boxBottomY + 3 + boxHeight / 2;
      const lateralRole = useExplicitSubRoles ? 'drawer_lateral' : 'drawer_box';
      const bottomRole = useExplicitSubRoles ? 'drawer_bottom' : 'drawer_box';

      return [
        {
          id: `${idPrefix}_fondo`,
          name: `Fondo MDF (${drawerLabel})`,
          groupId,
          groupName,
          length: boxWidth,
          width: slideLength,
          thickness: 3,
          quantity: 1,
          materialId: 'mat_mdf',
          materialName: 'MDF Durolac Blanco 3mm',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: centerX,
          posY: boxBottomY + 1.5,
          posZ: depthCenter,
          orientation: 'horizontal',
          componentRole: bottomRole
        },
        {
          id: `${idPrefix}_lat_izq`,
          name: `Lateral Izq (${drawerLabel})`,
          groupId,
          groupName,
          length: slideLength,
          width: boxHeight,
          thickness: boxT,
          quantity: 1,
          materialId: 'mat_15',
          materialName: 'Melamina Roble 15mm',
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: centerX - boxWidth / 2 + boxT / 2,
          posY: boxCenterY,
          posZ: depthCenter,
          orientation: 'vertical_yz',
          componentRole: lateralRole
        },
        {
          id: `${idPrefix}_lat_der`,
          name: `Lateral Der (${drawerLabel})`,
          groupId,
          groupName,
          length: slideLength,
          width: boxHeight,
          thickness: boxT,
          quantity: 1,
          materialId: 'mat_15',
          materialName: 'Melamina Roble 15mm',
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: centerX + boxWidth / 2 - boxT / 2,
          posY: boxCenterY,
          posZ: depthCenter,
          orientation: 'vertical_yz',
          componentRole: lateralRole
        },
        {
          id: `${idPrefix}_contrafrente`,
          name: `Contra-frente (${drawerLabel})`,
          groupId,
          groupName,
          length: innerW,
          width: boxHeight,
          thickness: boxT,
          quantity: 1,
          materialId: 'mat_15',
          materialName: 'Melamina Roble 15mm',
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: centerX,
          posY: boxCenterY,
          posZ: frontCenterZ - 11 - boxT / 2,
          orientation: 'vertical_xy',
          componentRole: 'drawer_box'
        },
        {
          id: `${idPrefix}_trasera`,
          name: `Trasera (${drawerLabel})`,
          groupId,
          groupName,
          length: innerW,
          width: boxHeight,
          thickness: boxT,
          quantity: 1,
          materialId: 'mat_15',
          materialName: 'Melamina Roble 15mm',
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: centerX,
          posY: boxCenterY,
          posZ: frontCenterZ - 11 - slideLength + boxT / 2,
          orientation: 'vertical_xy',
          componentRole: 'drawer_box'
        },
        {
          id: `${idPrefix}_frente`,
          name: `Frente Vista (${drawerLabel})`,
          groupId,
          groupName,
          length: 596,
          width: frontHeight,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_18',
          materialName: 'Melamina Blanca 18mm',
          grain: 'length',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX: centerX,
          posY: boxBottomY + frontHeight / 2,
          posZ: frontCenterZ,
          orientation: 'vertical_xy',
          componentRole: 'drawer_front'
        }
      ];
    };

    // 12 piezas de estructura + fondo + repisas + 1 puerta + 36 piezas de cajón = 49 piezas totales
    const carcassAndInteriorParts: Part[] = [
      {
        id: 't_lat_izq',
        name: 'Lateral Izquierdo',
        groupId,
        groupName,
        length: 2100,
        width: 550,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'side_left',
        posX: 9,
        posY: 1050,
        posZ: 275,
        orientation: 'vertical_yz'
      },
      {
        id: 't_lat_der',
        name: 'Lateral Derecho',
        groupId,
        groupName,
        length: 2100,
        width: 550,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'side_right',
        posX: 591,
        posY: 1050,
        posZ: 275,
        orientation: 'vertical_yz'
      },
      {
        id: 't_piso',
        name: 'Piso Inferior',
        groupId,
        groupName,
        length: 564,
        width: 550,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'bottom',
        posX: 300,
        posY: 79,
        posZ: 275,
        orientation: 'horizontal'
      },
      {
        id: 't_zocalo',
        name: 'Zócalo Frontal',
        groupId,
        groupName,
        length: 564,
        width: 70,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'plinth',
        posX: 300,
        posY: 35,
        posZ: 510,
        orientation: 'vertical_xy'
      },
      {
        id: 't_techo',
        name: 'Techo Superior',
        groupId,
        groupName,
        length: 564,
        width: 550,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'top',
        posX: 300,
        posY: 2091,
        posZ: 275,
        orientation: 'horizontal'
      },
      {
        id: 't_amarre',
        name: 'Amarre Trasero Superior',
        groupId,
        groupName,
        length: 564,
        width: 80,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'tie',
        posX: 300,
        posY: 2040,
        posZ: 15,
        orientation: 'vertical_xy'
      },
      {
        id: 't_fondo',
        name: 'Fondo Trasero MDF',
        groupId,
        groupName,
        length: 590,
        width: 2020,
        thickness: 3,
        quantity: 1,
        materialId: 'mat_mdf',
        materialName: 'MDF Durolac Blanco 3mm',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'back',
        posX: 300,
        posY: 1080,
        posZ: 1.5,
        orientation: 'vertical_xy'
      },
      {
        id: 't_divisor',
        name: 'Divisor Vertical Superior',
        groupId,
        groupName,
        length: 550,
        width: 530,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'divider',
        posX: 300,
        posY: 1800,
        posZ: 275,
        orientation: 'vertical_yz'
      },
      {
        id: 't_repisa_1',
        name: 'Repisa 1',
        groupId,
        groupName,
        length: 564,
        width: 520,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'shelf',
        posX: 300,
        posY: 750,
        posZ: 275,
        orientation: 'horizontal'
      },
      {
        id: 't_repisa_2',
        name: 'Repisa 2',
        groupId,
        groupName,
        length: 564,
        width: 520,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'shelf',
        posX: 300,
        posY: 1410,
        posZ: 275,
        orientation: 'horizontal'
      },
      {
        id: 't_repisa_3',
        name: 'Repisa 3',
        groupId,
        groupName,
        length: 564,
        width: 520,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'shelf',
        posX: 300,
        posY: 1620,
        posZ: 275,
        orientation: 'horizontal'
      },
      {
        id: 't_repisa_4',
        name: 'Repisa 4',
        groupId,
        groupName,
        length: 564,
        width: 520,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina Blanca 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'shelf',
        posX: 300,
        posY: 1830,
        posZ: 275,
        orientation: 'horizontal'
      }
    ];

    // Grupo inferior: 3 cajones de 177mm nombrados (Cajón 1), (Cajón 2), (Cajón 3)
    const lowerDrawers = [0, 1, 2].flatMap(i =>
      buildDrawerParts({
        idPrefix: `low_${i + 1}`,
        drawerLabel: `Cajón ${i + 1}`,
        centerX: 300,
        boxBottomY: 95 + i * 218,
        boxHeight: 177,
        frontHeight: 212,
        boxWidth: 544,
        slideLength: 500,
        boxT: 15,
        frontCenterZ: 561
      })
    );

    // Grupo superior: 3 cajones de 160mm TAMBIÉN nombrados (Cajón 1), (Cajón 2), (Cajón 3)
    const upperDrawers = [0, 1, 2].flatMap(i =>
      buildDrawerParts({
        idPrefix: `up_${i + 1}`,
        drawerLabel: `Cajón ${i + 1}`,
        centerX: 300,
        boxBottomY: 775 + i * 200,
        boxHeight: 160,
        frontHeight: 195,
        boxWidth: 544,
        slideLength: 500,
        boxT: 15,
        frontCenterZ: 561
      })
    );

    const topDoor: Part = {
      id: 't_puerta_sup',
      name: 'Puerta Superior Torre',
      groupId,
      groupName,
      length: 660,
      width: 596,
      thickness: 18,
      quantity: 1,
      materialId: 'mat_18',
      materialName: 'Melamina Blanca 18mm',
      grain: 'length',
      edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
      componentRole: 'door',
      posX: 300,
      posY: 1760,
      posZ: 561,
      orientation: 'vertical_xy'
    };

    const allParts: Part[] = [...carcassAndInteriorParts, ...lowerDrawers, ...upperDrawers, topDoor];
    expect(allParts.length).toBe(49);

    const towerProject: Project = {
      id: 'proj_tower_6_drawers',
      name: 'Proyecto Torre 6 Cajones',
      clientName: 'Taller',
      date: '2026-11-15',
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
          id: 'mat_18',
          name: 'Melamina Blanca 18mm',
          thickness: 18,
          sheetLength: 2440,
          sheetWidth: 1830,
          sheetCost: 150000,
          hasGrain: false,
          colorHex: '#ffffff'
        },
        {
          id: 'mat_15',
          name: 'Melamina Roble 15mm',
          thickness: 15,
          sheetLength: 2440,
          sheetWidth: 1830,
          sheetCost: 140000,
          hasGrain: true,
          colorHex: '#d6b58d'
        },
        {
          id: 'mat_mdf',
          name: 'MDF Durolac Blanco 3mm',
          thickness: 3,
          sheetLength: 2440,
          sheetWidth: 1830,
          sheetCost: 50000,
          hasGrain: false,
          colorHex: '#f8fafc'
        }
      ],
      modules: [],
      parts: allParts,
      groups: [
        {
          id: groupId,
          name: groupName,
          type: 'assembly'
        }
      ],
      hardware: [],
      laborCost: 0,
      laborType: 'percent',
      profitMarginPercent: 20,
      taxPercent: 19,
      updatedAt: '2026-11-15T00:00:00.000Z'
    };

    const guides = service.generateGuidesForProject(towerProject);
    expect(guides.length).toBe(1);

    const guide = guides[0];
    expect(guide.pieces.length).toBe(49);
    expect(guide.pieces[0].code).toBe('P1');
    expect(guide.pieces[48].code).toBe('P49');

    // 1) 6 cajones físicos separados aunque el nombre repita (Cajón 1..3) dos veces
    const drawerPieces = guide.pieces.filter(p => p.drawerClusterId);
    expect(drawerPieces.length).toBe(36);
    const uniqueClusters = new Set(drawerPieces.map(p => p.drawerClusterId));
    expect(uniqueClusters.size).toBe(6);
    for (let u = 1; u <= 6; u++) {
      const unitPieces = drawerPieces.filter(p => p.drawerUnitIndex === u);
      expect(unitPieces.length).toBe(6);
    }

    // 2) Exactamente 2 plantillas de sub-ensamble (3×177mm y 3×160mm)
    expect(guide.drawerSubassemblies).toBeDefined();
    expect(guide.drawerSubassemblies!.length).toBe(2);

    const sub177 = guide.drawerSubassemblies!.find(s => s.boxHeight === 177);
    const sub160 = guide.drawerSubassemblies!.find(s => s.boxHeight === 160);
    expect(sub177).toBeDefined();
    expect(sub160).toBeDefined();

    expect(sub177!.repeatCount).toBe(3);
    expect(sub177!.representativeParts.length).toBe(5);
    expect(sub177!.representativeFront).toBeDefined();
    expect(sub177!.allBoxPartCodes.length).toBe(15);
    expect(sub177!.allFrontPartCodes.length).toBe(3);
    expect(sub177!.allPartCodes.length).toBe(18);
    expect(sub177!.railElevationsMm.length).toBe(3);
    expect(sub177!.pieceGroupsSummary.length).toBe(5);
    expect(sub177!.pieceGroupsSummary.every(g => g.quantity === 3)).toBe(true);

    expect(sub160!.repeatCount).toBe(3);
    expect(sub160!.representativeParts.length).toBe(5);
    expect(sub160!.representativeFront).toBeDefined();
    expect(sub160!.allBoxPartCodes.length).toBe(15);
    expect(sub160!.allFrontPartCodes.length).toBe(3);
    expect(sub160!.allPartCodes.length).toBe(18);
    expect(sub160!.railElevationsMm.length).toBe(3);
    expect(sub160!.pieceGroupsSummary.length).toBe(5);
    expect(sub160!.pieceGroupsSummary.every(g => g.quantity === 3)).toBe(true);

    // 3) Paso drawer_subassembly antes de drawers (carcass_mount)
    const subIdx = guide.steps.findIndex(s => s.actionType === 'drawer_subassembly');
    const mountIdx = guide.steps.findIndex(s => s.actionType === 'drawers');
    expect(subIdx).toBeGreaterThan(-1);
    expect(mountIdx).toBe(subIdx + 1);

    const subStep = guide.steps[subIdx];
    expect(subStep.renderMode).toBe('subassembly_zoom');
    expect(subStep.parts.length).toBe(30);
    expect(subStep.subassemblyData?.length).toBe(2);
    expect(subStep.pieceGroupsSummary).toBeDefined();
    const bottomSummary = subStep.pieceGroupsSummary!.find(g => g.label.includes('Fondo MDF'));
    expect(bottomSummary).toBeDefined();
    expect(bottomSummary!.quantity).toBe(6);
    expect(bottomSummary!.codes.length).toBe(6);

    const mountStep = guide.steps[mountIdx];
    expect(mountStep.renderMode).toBe('carcass_mount');
    expect(mountStep.parts.length).toBe(6);
    expect(mountStep.compactCallouts?.length).toBe(6);
    expect(mountStep.compactCallouts![0].label).toBe('Cajón 1');
    expect(mountStep.compactCallouts![0].kind).toBe('drawer_unit');
    expect(mountStep.compactCallouts![0].codes.length).toBe(6);
    expect(mountStep.compactCallouts![0].sublabel).toMatch(/^P\d+–P\d+ · P\d+$/);
    expect(mountStep.measurements?.length).toBe(6);
    expect(mountStep.pieceGroupsSummary?.length).toBe(2);
    expect(mountStep.pieceGroupsSummary!.every(g => g.quantity === 3)).toBe(true);
    expect(mountStep.hardware.some(h => h.id === 'telescopic_slides' && h.quantity === 6)).toBe(true);
    expect(mountStep.hardware.some(h => h.id === 'screw_hardware_15' && h.quantity === 48)).toBe(true);

    // 4) Cobertura 100% disjunta P1..P49 y cumulativePriorPartCodes progresivo
    const seenCodes = new Set<string>();
    const expectedPrior: string[] = [];
    for (const step of guide.steps) {
      expect(step.cumulativePriorPartCodes).toEqual(expectedPrior);
      for (const code of step.partCodes) {
        expect(seenCodes.has(code)).toBe(false);
        expect(step.cumulativePriorPartCodes).not.toContain(code);
        seenCodes.add(code);
      }
      expectedPrior.push(...step.partCodes);
    }
    expect(seenCodes.size).toBe(49);
    for (const piece of guide.pieces) {
      expect(seenCodes.has(piece.code)).toBe(true);
    }

    // 5) explodedCalloutGroups consolida los 6 cajones + 13 piezas fuera de cajón = 19 callouts
    expect(guide.explodedCalloutGroups).toBeDefined();
    expect(guide.explodedCalloutGroups!.length).toBe(19);
    const drawerCallouts = guide.explodedCalloutGroups!.filter(c => c.kind === 'drawer_unit');
    const partCallouts = guide.explodedCalloutGroups!.filter(c => c.kind === 'part');
    expect(drawerCallouts.length).toBe(6);
    expect(partCallouts.length).toBe(13);

    const calloutCoveredCodes = new Set(guide.explodedCalloutGroups!.flatMap(c => c.codes));
    expect(calloutCoveredCodes.size).toBe(49);
  });

  it('debe separar cajones de dos columnas paralelas a la misma altura Y con nombres repetidos y agrupar dentro de tolerancia <= 3mm', () => {
    const groupId = 'grp_double_tower';
    const makeDrawerAt = (
      prefix: string,
      label: string,
      cx: number,
      bottomY: number,
      boxH: number
    ): Part[] => {
      const boxW = 460;
      const slideLen = 450;
      const t = 15;
      const innerW = boxW - 2 * t;
      const cy = bottomY + 3 + boxH / 2;
      return [
        {
          id: `${prefix}_bottom`,
          name: `Fondo MDF (${label})`,
          groupId,
          length: boxW,
          width: slideLen,
          thickness: 3,
          quantity: 1,
          materialId: 'mat_mdf',
          materialName: 'MDF 3mm',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          posX: cx,
          posY: bottomY + 1.5,
          posZ: 225,
          orientation: 'horizontal',
          componentRole: 'drawer_bottom'
        },
        {
          id: `${prefix}_lat_l`,
          name: `Lateral Izq (${label})`,
          groupId,
          length: slideLen,
          width: boxH,
          thickness: t,
          quantity: 1,
          materialId: 'mat_15',
          materialName: 'Melamina 15mm',
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: cx - boxW / 2 + t / 2,
          posY: cy,
          posZ: 225,
          orientation: 'vertical_yz',
          componentRole: 'drawer_lateral'
        },
        {
          id: `${prefix}_lat_r`,
          name: `Lateral Der (${label})`,
          groupId,
          length: slideLen,
          width: boxH,
          thickness: t,
          quantity: 1,
          materialId: 'mat_15',
          materialName: 'Melamina 15mm',
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: cx + boxW / 2 - t / 2,
          posY: cy,
          posZ: 225,
          orientation: 'vertical_yz',
          componentRole: 'drawer_lateral'
        },
        {
          id: `${prefix}_cf`,
          name: `Contra-frente (${label})`,
          groupId,
          length: innerW,
          width: boxH,
          thickness: t,
          quantity: 1,
          materialId: 'mat_15',
          materialName: 'Melamina 15mm',
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: cx,
          posY: cy,
          posZ: 442.5,
          orientation: 'vertical_xy',
          componentRole: 'drawer_box'
        },
        {
          id: `${prefix}_tr`,
          name: `Trasera (${label})`,
          groupId,
          length: innerW,
          width: boxH,
          thickness: t,
          quantity: 1,
          materialId: 'mat_15',
          materialName: 'Melamina 15mm',
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          posX: cx,
          posY: cy,
          posZ: 7.5,
          orientation: 'vertical_xy',
          componentRole: 'drawer_box'
        },
        {
          id: `${prefix}_fr`,
          name: `Frente Vista (${label})`,
          groupId,
          length: 496,
          width: 196,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_15',
          materialName: 'Melamina 15mm',
          grain: 'length',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          posX: cx,
          posY: bottomY + 98,
          posZ: 465,
          orientation: 'vertical_xy',
          componentRole: 'drawer_front'
        }
      ];
    };

    const parts: Part[] = [
      {
        id: 'col_side_l',
        name: 'Lateral Izquierdo',
        groupId,
        length: 900,
        width: 500,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_15',
        materialName: 'Melamina 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'side_left',
        posX: 9,
        posY: 450,
        posZ: 250,
        orientation: 'vertical_yz'
      },
      {
        id: 'col_div',
        name: 'Divisor Central',
        groupId,
        length: 864,
        width: 500,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_15',
        materialName: 'Melamina 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'divider',
        posX: 520,
        posY: 450,
        posZ: 250,
        orientation: 'vertical_yz'
      },
      {
        id: 'col_side_r',
        name: 'Lateral Derecho',
        groupId,
        length: 900,
        width: 500,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_15',
        materialName: 'Melamina 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'side_right',
        posX: 1031,
        posY: 450,
        posZ: 250,
        orientation: 'vertical_yz'
      },
      // Columna izquierda (cx = 264) y columna derecha (cx = 776) a la misma altura Y con diferencia de 2mm en boxHeight (160 vs 162)
      ...makeDrawerAt('l1', 'Cajón 1', 264, 100, 160),
      ...makeDrawerAt('l2', 'Cajón 2', 264, 320, 160),
      ...makeDrawerAt('r1', 'Cajón 1', 776, 100, 162),
      ...makeDrawerAt('r2', 'Cajón 2', 776, 320, 162)
    ];

    const project: Project = {
      id: 'proj_double_col',
      name: 'Módulo Doble Columna',
      clientName: '',
      date: '2026-11-15',
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
          id: 'mat_15',
          name: 'Melamina 15mm',
          thickness: 15,
          sheetLength: 2440,
          sheetWidth: 1830,
          sheetCost: 140000,
          hasGrain: false,
          colorHex: '#ffffff'
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
      parts,
      groups: [{ id: groupId, name: 'Doble Columna', type: 'assembly' }],
      hardware: [],
      laborCost: 0,
      laborType: 'percent',
      profitMarginPercent: 20,
      taxPercent: 19,
      updatedAt: '2026-11-15T00:00:00.000Z'
    };

    const guides = service.generateGuidesForProject(project);
    expect(guides.length).toBe(1);
    const guide = guides[0];

    const unitSet = new Set(guide.pieces.filter(p => p.drawerClusterId).map(p => p.drawerClusterId));
    expect(unitSet.size).toBe(4);

    // Ordenados por cy ascendente y luego cx ascendente: l1 (1), r1 (2), l2 (3), r2 (4)
    const pieceMap = new Map(guide.pieces.map(p => [p.partId, p]));
    expect(pieceMap.get('l1_fr')!.drawerUnitIndex).toBe(1);
    expect(pieceMap.get('r1_fr')!.drawerUnitIndex).toBe(2);
    expect(pieceMap.get('l2_fr')!.drawerUnitIndex).toBe(3);
    expect(pieceMap.get('r2_fr')!.drawerUnitIndex).toBe(4);

    // Diferencia <= 3 mm (160 vs 162) se consolida en 1 plantilla ×4
    expect(guide.drawerSubassemblies?.length).toBe(1);
    expect(guide.drawerSubassemblies![0].repeatCount).toBe(4);
  });

  it('debe mantener un único paso full_progress para un módulo de 1 cajón con caja completa (<= 8 piezas de cajón)', () => {
    const groupId = 'grp_single_drawer';
    const singleDrawerParts: Part[] = [
      {
        id: 'sd_lat_l',
        name: 'Lateral Izquierdo',
        groupId,
        length: 700,
        width: 500,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'side_left',
        posX: 9,
        posY: 350,
        posZ: 250,
        orientation: 'vertical_yz'
      },
      {
        id: 'sd_lat_r',
        name: 'Lateral Derecho',
        groupId,
        length: 700,
        width: 500,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'side_right',
        posX: 591,
        posY: 350,
        posZ: 250,
        orientation: 'vertical_yz'
      },
      {
        id: 'sd_box_fondo',
        name: 'Fondo MDF (Cajón 1)',
        groupId,
        length: 544,
        width: 450,
        thickness: 3,
        quantity: 1,
        materialId: 'mat_mdf',
        materialName: 'MDF 3mm',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'drawer_box',
        posX: 300,
        posY: 121.5,
        posZ: 250,
        orientation: 'horizontal'
      },
      {
        id: 'sd_box_lat_l',
        name: 'Lateral Izq (Cajón 1)',
        groupId,
        length: 450,
        width: 140,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina 15mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'drawer_box',
        posX: 35.5,
        posY: 193,
        posZ: 250,
        orientation: 'vertical_yz'
      },
      {
        id: 'sd_box_lat_r',
        name: 'Lateral Der (Cajón 1)',
        groupId,
        length: 450,
        width: 140,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina 15mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'drawer_box',
        posX: 564.5,
        posY: 193,
        posZ: 250,
        orientation: 'vertical_yz'
      },
      {
        id: 'sd_box_cf',
        name: 'Contra-frente (Cajón 1)',
        groupId,
        length: 514,
        width: 140,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina 15mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'drawer_box',
        posX: 300,
        posY: 193,
        posZ: 467.5,
        orientation: 'vertical_xy'
      },
      {
        id: 'sd_box_tr',
        name: 'Trasera (Cajón 1)',
        groupId,
        length: 514,
        width: 140,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina 15mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'drawer_box',
        posX: 300,
        posY: 193,
        posZ: 32.5,
        orientation: 'vertical_xy'
      },
      {
        id: 'sd_front',
        name: 'Frente Vista (Cajón 1)',
        groupId,
        length: 594,
        width: 180,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina 18mm',
        grain: 'length',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        componentRole: 'drawer_front',
        posX: 300,
        posY: 200,
        posZ: 486,
        orientation: 'vertical_xy'
      }
    ];

    const project: Project = {
      id: 'proj_single_drawer',
      name: 'Módulo 1 Cajón',
      clientName: '',
      date: '2026-11-15',
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
          id: 'mat_18',
          name: 'Melamina 18mm',
          thickness: 18,
          sheetLength: 2440,
          sheetWidth: 1830,
          sheetCost: 150000,
          hasGrain: false,
          colorHex: '#ffffff'
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
      parts: singleDrawerParts,
      groups: [{ id: groupId, name: 'Módulo Simple 1 Cajón', type: 'assembly' }],
      hardware: [],
      laborCost: 0,
      laborType: 'percent',
      profitMarginPercent: 20,
      taxPercent: 19,
      updatedAt: '2026-11-15T00:00:00.000Z'
    };

    const guides = service.generateGuidesForProject(project);
    expect(guides.length).toBe(1);
    const guide = guides[0];

    expect(guide.steps.some(s => s.actionType === 'drawer_subassembly')).toBe(false);
    const drawerSteps = guide.steps.filter(s => s.actionType === 'drawers');
    expect(drawerSteps.length).toBe(1);
    expect(drawerSteps[0].renderMode).toBe('full_progress');
    expect(drawerSteps[0].parts.length).toBe(6);
    expect(guide.explodedCalloutGroups).toBeUndefined();
  });

  it('debe generar sub-ensamble ×6 para una cajonera paramétrica real de 6 gavetas producida por CabinetGeneratorService', () => {
    const mats: Material[] = [
      {
        id: 'mat_18',
        name: 'Melamina Blanca 18mm',
        thickness: 18,
        sheetLength: 2440,
        sheetWidth: 1830,
        sheetCost: 150000,
        hasGrain: false,
        colorHex: '#ffffff'
      },
      {
        id: 'mat_mdf',
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
      code: 'CAJ600',
      name: 'Cajonera Torre 6 Gavetas',
      moduleType: 'drawer_unit',
      category: 'drawers',
      width: 600,
      height: 1200,
      depth: 500,
      structureThickness: 18,
      doorThickness: 18,
      backThickness: 3,
      backType: 'groove',
      shelvesCount: 0,
      doorOpening: 'none',
      drawersCount: 6,
      structureMaterialId: 'mat_18',
      doorMaterialId: 'mat_18',
      backMaterialId: 'mat_mdf',
      handleType: 'bar_modern',
      handleFinish: 'black',
      facadeGap: 3,
      hasPlinth: true,
      plinthHeight: 70,
      hasTopCover: true,
      hasBackPanel: true,
      posX: 0,
      posY: 600,
      posZ: 0
    };

    const generated = cabinetGen.generateParametricCabinet(cfg, mats);
    const project: Project = {
      id: 'proj_caj6_gen',
      name: 'Cajonera Real',
      clientName: '',
      date: '2026-11-15',
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
      updatedAt: '2026-11-15T00:00:00.000Z'
    };

    const guides = service.generateGuidesForProject(project);
    expect(guides.length).toBe(1);
    const guide = guides[0];

    expect(guide.drawerSubassemblies).toBeDefined();
    expect(guide.drawerSubassemblies!.length).toBe(1);
    expect(guide.drawerSubassemblies![0].repeatCount).toBe(6);
    expect(guide.drawerSubassemblies![0].representativeParts.length).toBe(5);
    expect(guide.drawerSubassemblies![0].allBoxPartCodes.length).toBe(30);
    expect(guide.drawerSubassemblies![0].allFrontPartCodes.length).toBe(6);

    const subStep = guide.steps.find(s => s.actionType === 'drawer_subassembly');
    const mountStep = guide.steps.find(s => s.actionType === 'drawers');
    expect(subStep).toBeDefined();
    expect(mountStep).toBeDefined();
    expect(subStep!.renderMode).toBe('subassembly_zoom');
    expect(mountStep!.renderMode).toBe('carcass_mount');
    expect(mountStep!.compactCallouts?.length).toBe(6);
    expect(mountStep!.measurements?.length).toBe(6);

    const seen = new Set<string>();
    for (const step of guide.steps) {
      for (const code of step.partCodes) {
        expect(seen.has(code)).toBe(false);
        seen.add(code);
      }
    }
    expect(seen.size).toBe(guide.pieces.length);
    expect(guide.explodedCalloutGroups).toBeDefined();
    expect(guide.explodedCalloutGroups!.filter(c => c.kind === 'drawer_unit').length).toBe(6);
  });

  it('debe detectar y agrupar cajones internos sin frente (frontMountType none) usando fallback firstBoxCode en compactCallouts', () => {
    const groupId = 'grp_closet_internal';
    const makeInternalBox = (prefix: string, label: string, bottomY: number): Part[] => [
      {
        id: `${prefix}_fondo`,
        name: `Fondo MDF (${label})`,
        groupId,
        length: 520,
        width: 450,
        thickness: 3,
        quantity: 1,
        materialId: 'mat_mdf',
        materialName: 'MDF 3mm',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 300,
        posY: bottomY + 1.5,
        posZ: 250,
        orientation: 'horizontal',
        componentRole: 'drawer_box'
      },
      {
        id: `${prefix}_lat_l`,
        name: `Lateral Izq (${label})`,
        groupId,
        length: 450,
        width: 150,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina 15mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 47.5,
        posY: bottomY + 78,
        posZ: 250,
        orientation: 'vertical_yz',
        componentRole: 'drawer_box'
      },
      {
        id: `${prefix}_lat_r`,
        name: `Lateral Der (${label})`,
        groupId,
        length: 450,
        width: 150,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina 15mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 552.5,
        posY: bottomY + 78,
        posZ: 250,
        orientation: 'vertical_yz',
        componentRole: 'drawer_box'
      },
      {
        id: `${prefix}_cf`,
        name: `Contra-frente (${label})`,
        groupId,
        length: 490,
        width: 150,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina 15mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 300,
        posY: bottomY + 78,
        posZ: 467.5,
        orientation: 'vertical_xy',
        componentRole: 'drawer_box'
      },
      {
        id: `${prefix}_tr`,
        name: `Trasera (${label})`,
        groupId,
        length: 490,
        width: 150,
        thickness: 15,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina 15mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        posX: 300,
        posY: bottomY + 78,
        posZ: 32.5,
        orientation: 'vertical_xy',
        componentRole: 'drawer_box'
      }
    ];

    const parts: Part[] = [
      {
        id: 'ci_lat_l',
        name: 'Lateral Izquierdo',
        groupId,
        length: 1800,
        width: 520,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'side_left',
        posX: 9,
        posY: 900,
        posZ: 260,
        orientation: 'vertical_yz'
      },
      {
        id: 'ci_lat_r',
        name: 'Lateral Derecho',
        groupId,
        length: 1800,
        width: 520,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_18',
        materialName: 'Melamina 18mm',
        grain: 'length',
        edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'side_right',
        posX: 591,
        posY: 900,
        posZ: 260,
        orientation: 'vertical_yz'
      },
      ...makeInternalBox('int1', 'Cajón 1', 100),
      ...makeInternalBox('int2', 'Cajón 2', 300),
      ...makeInternalBox('int3', 'Cajón 3', 500)
    ];

    const project: Project = {
      id: 'proj_internal_boxes',
      name: 'Closet Gavetas Internas',
      clientName: '',
      date: '2026-11-15',
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
          id: 'mat_18',
          name: 'Melamina 18mm',
          thickness: 18,
          sheetLength: 2440,
          sheetWidth: 1830,
          sheetCost: 150000,
          hasGrain: false,
          colorHex: '#ffffff'
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
      parts,
      groups: [{ id: groupId, name: 'Closet Gavetas Internas', type: 'assembly' }],
      hardware: [],
      laborCost: 0,
      laborType: 'percent',
      profitMarginPercent: 20,
      taxPercent: 19,
      updatedAt: '2026-11-15T00:00:00.000Z'
    };

    const guides = service.generateGuidesForProject(project);
    expect(guides.length).toBe(1);
    const guide = guides[0];

    expect(guide.drawerSubassemblies?.length).toBe(1);
    expect(guide.drawerSubassemblies![0].repeatCount).toBe(3);

    const mountStep = guide.steps.find(s => s.actionType === 'drawers');
    expect(mountStep).toBeDefined();
    expect(mountStep!.renderMode).toBe('carcass_mount');
    expect(mountStep!.compactCallouts?.length).toBe(3);
    expect(mountStep!.compactCallouts![0].primaryCode).toBe('P3');
    expect(mountStep!.compactCallouts![0].sublabel).toBe('P3–P7');
    expect(mountStep!.hardware.some(h => h.id === 'telescopic_slides' && h.quantity === 3)).toBe(true);
  });
});
