import { TestBed } from '@angular/core/testing';
import { CutOptimizerService } from './cut-optimizer.service';
import {
  Part,
  Material,
  ProjectSettings,
  computePartCutDimensions,
  isStoneMaterial
} from '../models/melamine.models';

describe('CutOptimizerService (Fase 5 - Despiece y Optimizador 2D)', () => {
  let service: CutOptimizerService;

  const mockMelamineMaterial: Material = {
    id: 'mat_blanco_18',
    name: 'Blanco Frost 18mm',
    colorHex: '#ffffff',
    thickness: 18,
    category: 'board',
    family: 'solid_matte',
    textureType: 'solid',
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 165000,
    hasGrain: false
  };

  const mockStoneMaterial: Material = {
    id: 'mat_cuarzo_blanco',
    name: 'Cuarzo Blanco Estelar 20mm',
    colorHex: '#f8fafc',
    thickness: 20,
    category: 'board',
    family: 'stone_countertop',
    textureType: 'stone',
    sheetLength: 3000,
    sheetWidth: 1400,
    sheetCost: 1400000,
    hasGrain: false
  };

  const baseSettings: ProjectSettings = {
    sawKerf: 4,
    trimMargin: 10,
    currency: 'COP',
    defaultBoardThickness: 18,
    thinEdgeThickness: 0.45,
    thickEdgeThickness: 2.0,
    thinEdgeCostPerMeter: 1800,
    thickEdgeCostPerMeter: 4200,
    optimizationPreference: 'guillotine_length',
    subtractEdgeBandingFromCut: false
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CutOptimizerService]
    });
    service = TestBed.inject(CutOptimizerService);
  });

  describe('1. Clasificación de Materiales y getCuttableParts (Solución Error #17)', () => {
    it('debe incluir cubiertas / mesones cuando son de melamina o tablero laminado', () => {
      const parts: Part[] = [
        {
          id: 'part_countertop_melamine',
          name: 'Cubierta Melamina Barra',
          length: 1200,
          width: 600,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_blanco_18',
          materialName: 'Blanco Frost 18mm',
          grain: 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          componentRole: 'countertop'
        }
      ];

      const cuttable = service.getCuttableParts(parts, [mockMelamineMaterial]);
      expect(cuttable.length).toBe(1);
      expect(cuttable[0].name).toBe('Cubierta Melamina Barra');
    });

    it('debe excluir mesones de piedra, cuarzo, granito o mármol del corte en sierra 2D', () => {
      const parts: Part[] = [
        {
          id: 'part_countertop_stone',
          name: 'Mesón Cocina Cuarzo',
          length: 2200,
          width: 620,
          thickness: 20,
          quantity: 1,
          materialId: 'mat_cuarzo_blanco',
          materialName: 'Cuarzo Blanco Estelar 20mm',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'countertop'
        },
        {
          id: 'part_shelf_melamine',
          name: 'Entrepaño Interior',
          length: 764,
          width: 480,
          thickness: 18,
          quantity: 2,
          materialId: 'mat_blanco_18',
          materialName: 'Blanco Frost 18mm',
          grain: 'length',
          edges: { l1: 'thin', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'shelf'
        }
      ];

      const cuttable = service.getCuttableParts(parts, [mockMelamineMaterial, mockStoneMaterial]);
      expect(cuttable.length).toBe(1);
      expect(cuttable[0].id).toBe('part_shelf_melamine');
    });

    it('isStoneMaterial debe detectar correctamente materiales pétreos por familia, textura o nombre', () => {
      expect(isStoneMaterial(mockStoneMaterial)).toBe(true);
      expect(isStoneMaterial(mockMelamineMaterial)).toBe(false);
      expect(isStoneMaterial({ id: 'm1', name: 'Granito San Gabriel', family: 'solid_matte' } as Material)).toBe(true);
      expect(isStoneMaterial({ id: 'm2', name: 'Mármol Carrara', family: 'solid_matte' } as Material)).toBe(true);
      expect(isStoneMaterial({ id: 'm3', name: 'Dekton Domoos', family: 'solid_matte' } as Material)).toBe(true);
      // Melaminas con diseño símil mármol son tableros de melamina, no piedra
      expect(isStoneMaterial({ id: 'm4', name: 'Melamina Mármol Carrara', family: 'stone_countertop' } as Material)).toBe(false);
      // Madera maciza alistonada no es piedra
      expect(isStoneMaterial({ id: 'mat_wood_butcher_36', name: 'Madera Roble Macizo Alistonado', family: 'stone_countertop' } as Material)).toBe(false);
    });

    it('getCuttableParts debe excluir piezas de piedra incluso si materials[] está vacío usando el nombre/id de la pieza', () => {
      const parts: Part[] = [
        {
          id: 'p1',
          name: 'Mesón Cuarzo',
          length: 1200,
          width: 600,
          thickness: 20,
          quantity: 1,
          materialId: 'mat_stone_custom',
          materialName: 'Cuarzo Blanco Polar',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' }
        },
        {
          id: 'p2',
          name: 'Lateral Melamina',
          length: 700,
          width: 500,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_roble_custom',
          materialName: 'Melamina Roble',
          grain: 'length',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' }
        }
      ];

      const cuttable = service.getCuttableParts(parts, []);
      expect(cuttable.length).toBe(1);
      expect(cuttable[0].id).toBe('p2');
    });
  });

  describe('2. Descuento de Tapacanto (subtractEdgeBandingFromCut - Decisión #3)', () => {
    const testPart: Part = {
      id: 'p_test_band',
      name: 'Lateral con Cantos Mixtos',
      length: 800,
      width: 500,
      thickness: 18,
      quantity: 1,
      materialId: 'mat_blanco_18',
      materialName: 'Blanco Frost 18mm',
      grain: 'length',
      edges: {
        l1: 'thick', // 2.0mm superior (reduce ancho)
        l2: 'thin',  // 0.45mm inferior (reduce ancho)
        a1: 'thick', // 2.0mm izquierdo (reduce largo)
        a2: 'thick'  // 2.0mm derecho (reduce largo)
      }
    };

    it('con subtractEdgeBandingFromCut inactivo, la medida de corte debe ser idéntica a la nominal', () => {
      const dims = computePartCutDimensions(testPart, false, 0.45, 2.0);
      expect(dims.cutLength).toBe(800);
      expect(dims.cutWidth).toBe(500);
      expect(dims.deductLength).toBe(0);
      expect(dims.deductWidth).toBe(0);
    });

    it('con subtractEdgeBandingFromCut activo, descuenta correctamente espesores en L1, L2, A1, A2', () => {
      const dims = computePartCutDimensions(testPart, true, 0.45, 2.0);
      // Largo 800 - (A1: 2.0 + A2: 2.0) = 796.0 mm
      expect(dims.cutLength).toBe(796);
      expect(dims.deductLength).toBe(4);

      // Ancho 500 - (L1: 2.0 + L2: 0.45) = 497.55
      expect(dims.cutWidth).toBe(497.55);
      expect(dims.deductWidth).toBe(2.45);
    });

    it('optimizeProject debe poblar nominalLength/cutLength en PlacedPart cuando está activo el descuento', () => {
      const settingsWithDeduction: ProjectSettings = {
        ...baseSettings,
        subtractEdgeBandingFromCut: true
      };

      const result = service.optimizeProject([testPart], [mockMelamineMaterial], settingsWithDeduction);
      expect(result.sheets.length).toBeGreaterThan(0);
      const placed = result.sheets[0].placedParts[0];
      expect(placed).toBeDefined();
      expect(placed.nominalLength).toBe(800);
      expect(placed.nominalWidth).toBe(500);
      expect(placed.cutLength).toBe(796);
      expect(placed.cutWidth).toBe(497.55);
    });
  });

  describe('3. Moneda y Costos Fallback 100% en Pesos Colombianos (COP)', () => {
    it('el costo fallback por plancha de melamina debe operar en COP (~185,000)', () => {
      const partWithUnknownMaterial: Part = {
        id: 'p_unknown',
        name: 'Pieza Sin Material Registrado',
        length: 500,
        width: 300,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_inexistente',
        materialName: 'Desconocido',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' }
      };

      const result = service.optimizeProject([partWithUnknownMaterial], [], baseSettings);
      expect(result.sheets.length).toBe(1);
      // El costo de la placa fallback debe ser 185000 COP, nunca residuales de USD ($45)
      expect(result.sheets[0].material.sheetCost).toBe(185000);
    });
  });
});
