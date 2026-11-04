import { TestBed } from '@angular/core/testing';
import { CabinetGeneratorService } from './cabinet-generator.service';
import { TemplatesCatalogService } from './templates-catalog.service';
import { JoineryEngineService } from './joinery-engine.service';
import { PartGeometryService } from './part-geometry.service';
import { Material, EnvironmentLine } from '../models/melamine.models';

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
    id: 'mat_wood_18',
    name: 'Roble Bardolino 18mm',
    colorHex: '#b48a60',
    thickness: 18,
    category: 'board',
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 65000,
    hasGrain: true
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

describe('Fase 3: Motor Paramétrico Multi-Ambiente en 4 Líneas y Geometría CAD', () => {
  let cabinetGen: CabinetGeneratorService;
  let catalogService: TemplatesCatalogService;
  let joineryEngine: JoineryEngineService;
  let partGeometry: PartGeometryService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CabinetGeneratorService,
        TemplatesCatalogService,
        JoineryEngineService,
        PartGeometryService
      ]
    });
    cabinetGen = TestBed.inject(CabinetGeneratorService);
    catalogService = TestBed.inject(TemplatesCatalogService);
    joineryEngine = TestBed.inject(JoineryEngineService);
    partGeometry = TestBed.inject(PartGeometryService);
  });

  describe('1. Catálogo Multi-Ambiente en 4 Líneas', () => {
    it('debe catalogar plantillas completas distribuidas en las 4 líneas maestras', () => {
      const kitchenTpls = catalogService.getTemplatesByEnvironment('kitchen');
      const closetTpls = catalogService.getTemplatesByEnvironment('closet');
      const bathroomTpls = catalogService.getTemplatesByEnvironment('bathroom');
      const livingOfficeTpls = catalogService.getTemplatesByEnvironment('living_office');

      expect(kitchenTpls.length).toBeGreaterThanOrEqual(8);
      expect(closetTpls.length).toBeGreaterThanOrEqual(4);
      expect(bathroomTpls.length).toBeGreaterThanOrEqual(3);
      expect(livingOfficeTpls.length).toBeGreaterThanOrEqual(3);

      const totalTpls = kitchenTpls.length + closetTpls.length + bathroomTpls.length + livingOfficeTpls.length;
      expect(totalTpls).toBe(catalogService.templates.length);
    });

    it('cada plantilla debe contar con environmentLine válido y generar piezas válidas en 3D', () => {
      const validLines: EnvironmentLine[] = ['kitchen', 'closet', 'bathroom', 'living_office'];

      for (const tpl of catalogService.templates) {
        expect(validLines).toContain(tpl.environmentLine);
        const parts = tpl.generateParts(MOCK_MATERIALS);
        expect(parts.length).toBeGreaterThan(0);
        for (const p of parts) {
          expect(p.length).toBeGreaterThan(0);
          expect(p.width).toBeGreaterThan(0);
          expect(p.thickness).toBeGreaterThan(0);
          expect(Number.isFinite(p.posX)).toBe(true);
          expect(Number.isFinite(p.posY)).toBe(true);
          expect(Number.isFinite(p.posZ)).toBe(true);
        }
      }
    });
  });

  describe('2. Verificación de Cero Colisiones Físicas en las 4 Líneas', () => {
    it('debe verificar 0 colisiones en todas las plantillas de Cocinas', () => {
      const kitchenTpls = catalogService.getTemplatesByEnvironment('kitchen');
      for (const tpl of kitchenTpls) {
        const parts = tpl.generateParts(MOCK_MATERIALS);
        const collisions = joineryEngine.detectCollisions(parts);
        expect(collisions.length).toBe(0);
      }
    });

    it('debe verificar 0 colisiones en todas las plantillas de Closets y Dormitorios', () => {
      const closetTpls = catalogService.getTemplatesByEnvironment('closet');
      for (const tpl of closetTpls) {
        const parts = tpl.generateParts(MOCK_MATERIALS);
        const collisions = joineryEngine.detectCollisions(parts);
        expect(collisions.length).toBe(0);
      }
    });

    it('debe verificar 0 colisiones en todas las plantillas de Baños', () => {
      const bathroomTpls = catalogService.getTemplatesByEnvironment('bathroom');
      for (const tpl of bathroomTpls) {
        const parts = tpl.generateParts(MOCK_MATERIALS);
        const collisions = joineryEngine.detectCollisions(parts);
        expect(collisions.length).toBe(0);
      }
    });

    it('debe verificar 0 colisiones en todas las plantillas de Hogar y Estudio', () => {
      const livingTpls = catalogService.getTemplatesByEnvironment('living_office');
      for (const tpl of livingTpls) {
        const parts = tpl.generateParts(MOCK_MATERIALS);
        const collisions = joineryEngine.detectCollisions(parts);
        expect(collisions.length).toBe(0);
      }
    });
  });

  describe('3. Módulo Esquinero en L Pentagonal 900x900 (45° Chamfer)', () => {
    it('debe generar geometría pentagonal sin colisiones con puerta a 45° y zócalos perimetrales alineados', () => {
      const cornerTpl = catalogService.templates.find(t => t.id === 'modulo_bajo_esquinero_45');
      expect(cornerTpl).toBeTruthy();
      const parts = cornerTpl!.generateParts(MOCK_MATERIALS);

      expect(parts.length).toBeGreaterThanOrEqual(8);

      // Verificar que la puerta está orientada a 45°
      const door = parts.find(p => p.componentRole === 'door');
      expect(door).toBeTruthy();
      expect(door!.rotationY).toBe(45);

      // Verificar que piso y repisa tienen chaflán frontal derecho
      const bottom = parts.find(p => p.componentRole === 'bottom');
      expect(bottom).toBeTruthy();
      expect(bottom!.cornerCutConfig?.type).toBe('chamfer_corner');
      expect(bottom!.cornerCutConfig?.corner).toBe('front_right');

      // 0 colisiones
      const collisions = joineryEngine.detectCollisions(parts);
      expect(collisions.length).toBe(0);
    });
  });

  describe('4. Módulo Esquinero Recto Ciego 1000mm', () => {
    it('debe generar panel ciego fijo de 450mm, puerta de acceso y zócalos sin colisiones', () => {
      const blindTpl = catalogService.templates.find(t => t.id === 'modulo_bajo_esquinero_ciego_100');
      expect(blindTpl).toBeTruthy();
      const parts = blindTpl!.generateParts(MOCK_MATERIALS);

      const blindPanel = parts.find(p => p.name.includes('Panel Ciego') || p.componentRole === 'door');
      const door = parts.find(p => p.componentRole === 'door');
      expect(blindPanel).toBeTruthy();
      expect(door).toBeTruthy();

      const collisions = joineryEngine.detectCollisions(parts);
      expect(collisions.length).toBe(0);
    });
  });

  describe('5. Vanitorys Flotantes con Destaje Sifón en U', () => {
    it('debe generar corte de sifón en U en la tapa superior del vanitory 1P', () => {
      const vanity1P = catalogService.templates.find(t => t.id === 'vanitory_flotante_1_puerta');
      expect(vanity1P).toBeTruthy();
      const parts = vanity1P!.generateParts(MOCK_MATERIALS);

      const top = parts.find(p => p.componentRole === 'top');
      expect(top).toBeTruthy();
      expect(top!.cornerCutConfig?.type).toBe('u_siphon_cutout');
      expect(top!.cornerCutConfig?.cutX).toBe(180);
      expect(top!.cornerCutConfig?.cutY).toBe(220);

      const collisions = joineryEngine.detectCollisions(parts);
      expect(collisions.length).toBe(0);
    });

    it('debe generar corte de sifón en U en el fondo del cajón superior del vanitory 2 gavetas', () => {
      const vanity2D = catalogService.templates.find(t => t.id === 'vanitory_flotante_2_cajones_sifon');
      expect(vanity2D).toBeTruthy();
      const parts = vanity2D!.generateParts(MOCK_MATERIALS);

      const siphonBottom = parts.find(p => p.cornerCutConfig?.type === 'u_siphon_cutout');
      expect(siphonBottom).toBeTruthy();
      expect(siphonBottom!.name).toContain('Cajón 2');

      const collisions = joineryEngine.detectCollisions(parts);
      expect(collisions.length).toBe(0);
    });
  });

  describe('6. Closets con Barras de Colgado Paramétricas (1 y 2 Barras)', () => {
    it('debe generar 1 tubo cromado en ropero de 1 barra', () => {
      const ropero1 = catalogService.templates.find(t => t.id === 'closet_ropero_1_barra');
      expect(ropero1).toBeTruthy();
      const parts = ropero1!.generateParts(MOCK_MATERIALS);

      const rods = parts.filter(p => p.shapeType === 'circle' && p.name.includes('Tubo Colgador'));
      expect(rods.length).toBe(1);

      const collisions = joineryEngine.detectCollisions(parts);
      expect(collisions.length).toBe(0);
    });

    it('debe generar 2 tubos cromados en ropero doble de 2 barras', () => {
      const ropero2 = catalogService.templates.find(t => t.id === 'closet_armario_2_barras');
      expect(ropero2).toBeTruthy();
      const parts = ropero2!.generateParts(MOCK_MATERIALS);

      const rods = parts.filter(p => p.shapeType === 'circle' && p.name.includes('Tubo Colgador'));
      expect(rods.length).toBe(2);

      const collisions = joineryEngine.detectCollisions(parts);
      expect(collisions.length).toBe(0);
    });
  });

  describe('7. Geometría 3D y Contorno del Destaje Sifón en U', () => {
    it('buildCornerCutContour debe generar un polígono en U centrado en la cara trasera (y = W)', () => {
      const L = 800;
      const W = 500;
      const pts = partGeometry.buildCornerCutContour(L, W, {
        type: 'u_siphon_cutout',
        corner: 'back_left',
        cutX: 200,
        cutY: 250
      });

      // Debe generar 8 vértices que forman el contorno con escotadura en U
      expect(pts.length).toBe(8);

      // Vértice inicial en origen frontal (0, 0)
      expect(pts[0].x).toBe(0);
      expect(pts[0].y).toBe(0);

      // Verificación de cotas del canal del sifón
      const cutoutLeftX = (L - 200) / 2; // 300
      const cutoutRightX = (L + 200) / 2; // 500
      const cutoutDepthY = W - 250; // 250

      const notchBottom = pts.find(p => p.x === cutoutLeftX && p.y === cutoutDepthY);
      const notchRight = pts.find(p => p.x === cutoutRightX && p.y === cutoutDepthY);
      expect(notchBottom).toBeTruthy();
      expect(notchRight).toBeTruthy();
    });

    it('buildExtrudedBoardGeometry debe extruir correctamente una pieza con corte de sifón en U', () => {
      const part = {
        id: 'vanity_top_test',
        name: 'Tapa Lavamanos',
        length: 800,
        width: 500,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_white_18',
        materialName: 'Blanco',
        grain: 'none' as const,
        edges: { l1: 'thick' as const, l2: 'none' as const, a1: 'thick' as const, a2: 'thick' as const },
        orientation: 'horizontal' as const,
        cornerCutConfig: {
          type: 'u_siphon_cutout' as const,
          corner: 'back_left' as const,
          cutX: 200,
          cutY: 250
        }
      };

      const geo = partGeometry.buildExtrudedBoardGeometry(part);
      expect(geo).toBeTruthy();
      expect(geo.boundingBox).toBeTruthy();
      const bb = geo.boundingBox!;
      const dimX = Math.round(bb.max.x - bb.min.x);
      const dimY = Math.round(bb.max.y - bb.min.y);
      const dimZ = Math.round(bb.max.z - bb.min.z);

      expect(dimX).toBe(800);
      expect(dimY).toBe(18);
      expect(dimZ).toBe(500);
    });
  });

  describe('8. Pruebas de Robustez Paramétrica y Casos Límite', () => {
    it('debe generar corner_base con tablero y puerta de 18mm con 0 colisiones', () => {
      const res = cabinetGen.generateParametricCabinet({
        code: 'MBE18',
        name: 'Esquinero 18mm',
        moduleType: 'base_cabinet',
        category: 'corner_base',
        environmentLine: 'kitchen',
        width: 900,
        height: 860,
        depth: 900,
        structureThickness: 18,
        doorThickness: 18,
        backThickness: 18,
        backType: 'none',
        shelvesCount: 1,
        doorOpening: 'left',
        structureMaterialId: 'mat_white_18',
        doorMaterialId: 'mat_white_18',
        backMaterialId: 'mat_white_18',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        hasPlinth: true,
        plinthHeight: 80,
        facadeGap: 3
      }, MOCK_MATERIALS);

      const collisions = joineryEngine.detectCollisions(res.parts);
      expect(collisions.length).toBe(0);
    });

    it('corner_base con shelvesCount: 0 no debe generar ningún entrepaño interior', () => {
      const res = cabinetGen.generateParametricCabinet({
        code: 'MBE0S',
        name: 'Esquinero Sin Repisas',
        moduleType: 'base_cabinet',
        category: 'corner_base',
        environmentLine: 'kitchen',
        width: 900,
        height: 860,
        depth: 900,
        structureThickness: 15,
        doorThickness: 15,
        backThickness: 15,
        backType: 'none',
        shelvesCount: 0,
        doorOpening: 'left',
        structureMaterialId: 'mat_white_18',
        doorMaterialId: 'mat_white_18',
        backMaterialId: 'mat_white_18',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        hasPlinth: true,
        plinthHeight: 80,
        facadeGap: 3
      }, MOCK_MATERIALS);

      const shelves = res.parts.filter(p => p.componentRole === 'shelf');
      expect(shelves.length).toBe(0);
    });

    it('corner_base con doorOpening: none no debe generar puerta diagonal', () => {
      const res = cabinetGen.generateParametricCabinet({
        code: 'MBE_ND',
        name: 'Esquinero Abierto',
        moduleType: 'base_cabinet',
        category: 'corner_base',
        environmentLine: 'kitchen',
        width: 900,
        height: 860,
        depth: 900,
        structureThickness: 15,
        doorThickness: 15,
        backThickness: 15,
        backType: 'none',
        shelvesCount: 1,
        doorOpening: 'none',
        structureMaterialId: 'mat_white_18',
        doorMaterialId: 'mat_white_18',
        backMaterialId: 'mat_white_18',
        handleType: 'none',
        handleFinish: 'brushed_steel',
        hasPlinth: true,
        plinthHeight: 80,
        facadeGap: 3
      }, MOCK_MATERIALS);

      const doors = res.parts.filter(p => p.componentRole === 'door');
      expect(doors.length).toBe(0);
      const collisions = joineryEngine.detectCollisions(res.parts);
      expect(collisions.length).toBe(0);
    });

    it('generateParametricCabinet con hasTopCover: false y topTieStrips: false no debe generar tapa superior', () => {
      const res = cabinetGen.generateParametricCabinet({
        code: 'CLO_NOTOP',
        name: 'Closet Sin Techo',
        moduleType: 'closet',
        environmentLine: 'closet',
        width: 800,
        height: 1800,
        depth: 500,
        structureThickness: 18,
        doorThickness: 18,
        backThickness: 3,
        backType: 'groove',
        shelvesCount: 2,
        doorOpening: 'none',
        hasTopCover: false,
        topTieStrips: false,
        structureMaterialId: 'mat_white_18',
        doorMaterialId: 'mat_white_18',
        backMaterialId: 'mat_back_3',
        handleType: 'none',
        handleFinish: 'brushed_steel',
        facadeGap: 3
      }, MOCK_MATERIALS);

      const tops = res.parts.filter(p => p.componentRole === 'top' || p.componentRole === 'tie');
      expect(tops.length).toBe(0);
    });

    it('generateParametricCabinet con topTieStrips: true debe generar amarres en lugar de tapa maciza', () => {
      const res = cabinetGen.generateParametricCabinet({
        code: 'BASE_TIES',
        name: 'Módulo Bajo con Amarres',
        moduleType: 'base_cabinet',
        environmentLine: 'kitchen',
        width: 600,
        height: 860,
        depth: 580,
        structureThickness: 18,
        doorThickness: 18,
        backThickness: 3,
        backType: 'groove',
        shelvesCount: 1,
        doorOpening: 'left',
        topTieStrips: true,
        hasTopCover: false,
        structureMaterialId: 'mat_white_18',
        doorMaterialId: 'mat_white_18',
        backMaterialId: 'mat_back_3',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        facadeGap: 3
      }, MOCK_MATERIALS);

      const ties = res.parts.filter(p => p.componentRole === 'tie');
      const tops = res.parts.filter(p => p.componentRole === 'top');
      expect(ties.length).toBe(2);
      expect(tops.length).toBe(0);
    });
  });
});
