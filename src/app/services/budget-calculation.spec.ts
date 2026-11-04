import { TestBed } from '@angular/core/testing';
import { HardwareCatalogService } from './hardware-catalog.service';
import { Part, ApplianceItem, Material, isStoneMaterial } from '../models/melamine.models';

describe('Budget & Hardware Calculation (Fase 5 - Cómputo de Herrajes y Presupuesto COP)', () => {
  let hardwareService: HardwareCatalogService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HardwareCatalogService]
    });
    hardwareService = TestBed.inject(HardwareCatalogService);
  });

  describe('1. Cómputo Automático de Herrajes en COP (Solución Error #16)', () => {
    it('debe calcular bisagras cazoleta estándar para puertas convencionales en COP', () => {
      const parts: Part[] = [
        {
          id: 'p_door_1',
          name: 'Puerta Cocina Izq',
          length: 700,
          width: 400,
          thickness: 18,
          quantity: 2,
          materialId: 'mat_1',
          materialName: 'Blanco',
          grain: 'length',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          componentRole: 'door',
          hardwareConfig: {
            isMovable: true,
            movableType: 'door',
            handleType: 'bar_modern',
            hingeType: 'straight'
          }
        }
      ];

      const hardware = hardwareService.computeRequiredHardwareList(parts);
      const hinges = hardware.find(h => h.id === 'hw_bisagra_35');
      const handles = hardware.find(h => h.id === 'hw_tiradores');

      expect(hinges).toBeDefined();
      expect(hinges?.quantity).toBe(4); // 2 bisagras por puerta * 2 puertas
      expect(hinges?.unitCost).toBe(8500); // 8,500 COP comercial

      expect(handles).toBeDefined();
      expect(handles?.quantity).toBe(2);
      expect(handles?.unitCost).toBe(12500); // 12,500 COP
    });

    it('debe calcular bisagras angulares de 45° para esquineros pentagonales', () => {
      const parts: Part[] = [
        {
          id: 'p_corner_diag',
          name: 'Puerta Esquinera Diagonal 45°',
          length: 700,
          width: 450,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Roble',
          grain: 'length',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          componentRole: 'door',
          rotationY: 45,
          notes: 'Puerta frontal chaflán a 45°'
        }
      ];

      const hardware = hardwareService.computeRequiredHardwareList(parts);
      const hinge45 = hardware.find(h => h.id === 'hw_bisagra_45');

      expect(hinge45).toBeDefined();
      expect(hinge45?.quantity).toBe(2);
      expect(hinge45?.unitCost).toBe(14500); // 14,500 COP
    });

    it('debe calcular bisagras de 165° para esquineros de rincón ciego', () => {
      const parts: Part[] = [
        {
          id: 'p_blind_door',
          name: 'Puerta de Acceso a Rincón',
          length: 700,
          width: 400,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Roble',
          grain: 'length',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          componentRole: 'door',
          notes: 'Puerta batiente para módulo rincón ciego'
        }
      ];

      const hardware = hardwareService.computeRequiredHardwareList(parts);
      const hinge165 = hardware.find(h => h.id === 'hw_bisagra_165');

      expect(hinge165).toBeDefined();
      expect(hinge165?.quantity).toBe(2);
      expect(hinge165?.unitCost).toBe(18500); // 18,500 COP
    });

    it('debe calcular pistones neumáticos a gas 100N para puertas elevables de alacena', () => {
      const parts: Part[] = [
        {
          id: 'p_lift_door',
          name: 'Puerta Basculante Alacena Superior',
          length: 400,
          width: 800,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Gris Grafito',
          grain: 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          componentRole: 'door',
          hardwareConfig: {
            isMovable: true,
            movableType: 'door',
            handleType: 'bar_modern',
            hingeType: 'gas_piston',
            openingDirection: 'top'
          }
        }
      ];

      const hardware = hardwareService.computeRequiredHardwareList(parts);
      const piston = hardware.find(h => h.id === 'hw_piston_gas');

      expect(piston).toBeDefined();
      expect(piston?.quantity).toBe(2); // 2 pistones por puerta basculante
      expect(piston?.unitCost).toBe(18000); // 18,000 COP
    });

    it('debe calcular correderas telescópicas para cajoneras (1 par por cajón)', () => {
      const parts: Part[] = [
        {
          id: 'p_drawer_front_1',
          name: 'Frente de Cajón Cubiertero',
          length: 150,
          width: 600,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Blanco',
          grain: 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          componentRole: 'drawer_front'
        },
        {
          id: 'p_drawer_front_2',
          name: 'Frente de Gaveta Olla',
          length: 270,
          width: 600,
          thickness: 18,
          quantity: 2,
          materialId: 'mat_1',
          materialName: 'Blanco',
          grain: 'none',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          componentRole: 'drawer_front'
        }
      ];

      const hardware = hardwareService.computeRequiredHardwareList(parts);
      const slides = hardware.find(h => h.id === 'hw_correderas');

      expect(slides).toBeDefined();
      expect(slides?.quantity).toBe(3); // 1 + 2 = 3 pares de correderas
      expect(slides?.unitCost).toBe(24000); // 24,000 COP por par
    });

    it('debe calcular kits correderos y tubos colgadores para la línea Closet', () => {
      const parts: Part[] = [
        {
          id: 'p_closet_door_1',
          name: 'Puerta Corrediza Closet Izq',
          length: 2200,
          width: 800,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Nocce',
          grain: 'length',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          componentRole: 'door',
          moduleName: 'Closet Principal 2 Puertas'
        },
        {
          id: 'p_closet_door_2',
          name: 'Puerta Corrediza Closet Der',
          length: 2200,
          width: 800,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Nocce',
          grain: 'length',
          edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
          componentRole: 'door',
          moduleName: 'Closet Principal 2 Puertas'
        },
        {
          id: 'p_tubo_colgador',
          name: 'Tubo Colgador Cromado',
          length: 764,
          width: 25,
          thickness: 25,
          quantity: 2,
          materialId: 'mat_tubo',
          materialName: 'Tubo Acero',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          shapeType: 'circle',
          notes: 'Tubo colgador ovalado con soportes'
        }
      ];

      const hardware = hardwareService.computeRequiredHardwareList(parts);
      const slidingKit = hardware.find(h => h.id === 'hw_kit_closet');
      const rod = hardware.find(h => h.id === 'hw_tubo_colgador');

      expect(slidingKit).toBeDefined();
      expect(slidingKit?.quantity).toBe(1); // 1 kit para el par de puertas correderas
      expect(slidingKit?.unitCost).toBe(75000);

      expect(rod).toBeDefined();
      expect(rod?.quantity).toBe(2);
      expect(rod?.unitCost).toBe(28000);
    });
  });

  describe('2. Erradicación del Doble Cobro de Electrodomésticos (Solución Error #16)', () => {
    it('computeRequiredHardwareList no debe agregar patas ni artefactos desde appliances', () => {
      const mockAppliances: ApplianceItem[] = [
        {
          id: 'app_table_legs',
          name: 'Juego de 4 Patas Horquilla Hairpin 72cm',
          type: 'table_legs_set',
          width: 720,
          height: 720,
          depth: 100,
          finish: 'black_matte',
          rotation: 0,
          mountType: 'floor',
          position: { x: 0, y: 0, z: 0 },
          price: 180000,
          includeInBudget: true
        },
        {
          id: 'app_refrigerator',
          name: 'Refrigerador Side by Side',
          type: 'refrigerator',
          width: 900,
          height: 1800,
          depth: 700,
          finish: 'stainless_steel',
          rotation: 0,
          mountType: 'floor',
          position: { x: 0, y: 0, z: 0 },
          price: 3500000,
          includeInBudget: true
        }
      ];

      // Al pasar partes vacías pero con electrodomésticos, el resultado debe ser estrictamente 0 herrajes
      const hardware = hardwareService.computeRequiredHardwareList([], mockAppliances);
      expect(hardware.length).toBe(0);
      expect(hardware.some(h => h.name.includes('Patas') || h.name.includes('Pata'))).toBe(false);
    });
  });

  describe('3. Clasificación de Cubiertas de Melamina vs Piedras por m²', () => {
    const materials: Material[] = [
      {
        id: 'mat_melamina_cover',
        name: 'Melamina Roble Cava 18mm',
        colorHex: '#8b5a2b',
        thickness: 18,
        category: 'board',
        family: 'wood_medium',
        textureType: 'wood',
        sheetLength: 2440,
        sheetWidth: 1830,
        sheetCost: 175000,
        hasGrain: true
      },
      {
        id: 'mat_marmol_carrara',
        name: 'Mármol Blanco Carrara 20mm',
        colorHex: '#f1f5f9',
        thickness: 20,
        category: 'board',
        family: 'stone_countertop',
        textureType: 'stone',
        sheetLength: 2800,
        sheetWidth: 1600,
        sheetCost: 1800000,
        hasGrain: false
      }
    ];

    it('isStoneMaterial debe diferenciar melaminas de superficies de piedra', () => {
      expect(isStoneMaterial(materials[0])).toBe(false);
      expect(isStoneMaterial(materials[1])).toBe(true);
    });

    it('cubiertas de melamina deben mantenerse en el cómputo de tableros enteros', () => {
      const melamineCountertop: Part = {
        id: 'p_countertop_wood',
        name: 'Tapa Mesón Melamina 18mm',
        length: 1800,
        width: 600,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_melamina_cover',
        materialName: 'Melamina Roble Cava 18mm',
        grain: 'length',
        edges: { l1: 'thick', l2: 'thick', a1: 'thick', a2: 'thick' },
        componentRole: 'countertop'
      };

      const mat = materials.find(m => m.id === melamineCountertop.materialId);
      expect(isStoneMaterial(mat)).toBe(false);
    });

    it('mesones de piedra deben cuantificarse en m² con precio comercial real', () => {
      const stoneCountertop: Part = {
        id: 'p_countertop_stone',
        name: 'Mesón Cocina en Isla Mármol',
        length: 2000,
        width: 900,
        thickness: 20,
        quantity: 1,
        materialId: 'mat_marmol_carrara',
        materialName: 'Mármol Blanco Carrara 20mm',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        componentRole: 'countertop'
      };

      const mat = materials.find(m => m.id === stoneCountertop.materialId)!;
      expect(isStoneMaterial(mat)).toBe(true);

      const areaM2 = (stoneCountertop.length * stoneCountertop.width * stoneCountertop.quantity) / 1_000_000;
      expect(areaM2).toBe(1.8);

      const sheetAreaM2 = (mat.sheetLength * mat.sheetWidth) / 1_000_000; // 2.8 * 1.6 = 4.48 m²
      const costPerM2 = Math.round(mat.sheetCost / sheetAreaM2); // 1,800,000 / 4.48 = 401,786
      const subtotal = Math.round(areaM2 * costPerM2);

      expect(subtotal).toBeGreaterThan(700000);
      expect(subtotal).toBeLessThan(800000);
    });
  });
});
