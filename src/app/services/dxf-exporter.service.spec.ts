import { TestBed } from '@angular/core/testing';
import { DxfExporterService } from './dxf-exporter.service';
import { JoineryEngineService } from './joinery-engine.service';
import { PartGeometryService } from './part-geometry.service';
import { Project, Part } from '../models/melamine.models';

describe('DxfExporterService (Fase 5 - Exportación CAD DXF CNC Industrial AC1015)', () => {
  let service: DxfExporterService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DxfExporterService, JoineryEngineService, PartGeometryService]
    });
    service = TestBed.inject(DxfExporterService);
  });

  const baseProject: Project = {
    id: 'proj_dxf_test',
    name: 'Cocina Integral CNC Test',
    date: '2026-11-04',
    modules: [],
    groups: [],
    parts: [],
    materials: [
      {
        id: 'mat_1',
        name: 'Melamina Roble',
        thickness: 18,
        sheetLength: 2440,
        sheetWidth: 1830,
        sheetCost: 185000,
        hasGrain: true,
        colorHex: '#c29b68'
      }
    ],
    hardware: [],
    appliances: [],
    laborCost: 0,
    laborType: 'fixed',
    profitMarginPercent: 30,
    taxPercent: 19,
    updatedAt: '2026-11-04T00:00:00.000Z',
    notes: '',
    clientName: 'Cliente Prueba',
    settings: {
      sawKerf: 4,
      trimMargin: 10,
      defaultBoardThickness: 18,
      thinEdgeThickness: 0.45,
      thickEdgeThickness: 2.0,
      thinEdgeCostPerMeter: 1200,
      thickEdgeCostPerMeter: 3500,
      optimizationPreference: 'best_fit',
      currency: 'COP',
      subtractEdgeBandingFromCut: false
    }
  };

  it('debe generar un encabezado DXF versión AC1015 (AutoCAD 2000) en milímetros', () => {
    const dxf = service.generateDxfString(baseProject);

    expect(dxf).toContain('$ACADVER\n1\nAC1015');
    expect(dxf).toContain('$INSUNITS\n70\n4'); // 4 = Millimeters
    expect(dxf).toContain('SECTION\n2\nTABLES');
    expect(dxf).toContain('SECTION\n2\nENTITIES');
    expect(dxf).toContain('0\nEOF');
  });

  it('debe definir las 5 capas industriales normalizadas con sus colores', () => {
    const dxf = service.generateDxfString(baseProject);

    expect(dxf).toContain('2\nPIEZAS_CONTORNO');
    expect(dxf).toContain('2\nMECANIZADOS_PERFORACIONES');
    expect(dxf).toContain('2\nTAPACANTOS');
    expect(dxf).toContain('2\nTEXTOS_ETIQUETAS');
    expect(dxf).toContain('2\nCOTAS_MEDIDAS');
  });

  it('debe exportar contorno rectangular estándar como LWPOLYLINE cerrada', () => {
    const project: Project = {
      ...baseProject,
      parts: [
        {
          id: 'p_rect',
          name: 'Lateral Izquierdo',
          length: 800,
          width: 500,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Melamina Roble',
          grain: 'length',
          edges: { l1: 'thick', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'side_left',
          orientation: 'vertical_yz'
        }
      ]
    };

    const dxf = service.generateDxfString(project);

    // Debe contener LWPOLYLINE en capa PIEZAS_CONTORNO
    expect(dxf).toContain('0\nLWPOLYLINE');
    expect(dxf).toContain('8\nPIEZAS_CONTORNO');
    expect(dxf).toContain('90\n4'); // 4 vértices para rectángulo
    expect(dxf).toContain('70\n1'); // 1 = cerrada (closed polyline)
    // Tapacantos L1 en capa TAPACANTOS
    expect(dxf).toContain('8\nTAPACANTOS');
  });

  it('debe exportar contorno real con cortes especiales (destaje notch_l, chaflán y sifón U) con más de 4 vértices', () => {
    const project: Project = {
      ...baseProject,
      parts: [
        {
          id: 'p_notch',
          name: 'Piso con Destaje L',
          length: 600,
          width: 500,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Melamina Roble',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'bottom',
          cornerCutConfig: {
            type: 'notch_l',
            corner: 'front_right',
            cutX: 100,
            cutY: 80
          }
        },
        {
          id: 'p_siphon',
          name: 'Cajón Lavamanos Resaque U Sifón',
          length: 700,
          width: 450,
          thickness: 18,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Melamina Roble',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          componentRole: 'bottom',
          cornerCutConfig: {
            type: 'u_siphon_cutout',
            corner: 'both_front',
            cutX: 200,
            cutY: 250
          }
        }
      ]
    };

    const dxf = service.generateDxfString(project);

    expect(dxf).toContain('0\nLWPOLYLINE');
    // El destaje notch_l produce 6 vértices
    expect(dxf).toContain('90\n6');
    // El resaque u_siphon_cutout produce 8 vértices
    expect(dxf).toContain('90\n8');
  });

  it('debe exportar piezas circulares como entidad CIRCLE en capa PIEZAS_CONTORNO', () => {
    const project: Project = {
      ...baseProject,
      parts: [
        {
          id: 'p_round_table',
          name: 'Tapa Mesa Redonda',
          length: 800,
          width: 800,
          thickness: 25,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Melamina Roble',
          grain: 'none',
          edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
          shapeType: 'circle',
          diameter: 800
        }
      ]
    };

    const dxf = service.generateDxfString(project);

    expect(dxf).toContain('0\nCIRCLE');
    expect(dxf).toContain('8\nPIEZAS_CONTORNO');
    expect(dxf).toContain('40\n400.000'); // Radio = 800 / 2 = 400
  });

  it('no debe fallar si una pieza no tiene definida la propiedad edges', () => {
    const project: Project = {
      ...baseProject,
      parts: [
        {
          id: 'p_no_edges',
          name: 'Pieza Sin Cantos',
          length: 500,
          width: 300,
          thickness: 15,
          quantity: 1,
          materialId: 'mat_1',
          materialName: 'Melamina',
          grain: 'none',
          edges: undefined as unknown as Part['edges']
        }
      ]
    };

    expect(() => {
      const dxf = service.generateDxfString(project);
      expect(dxf).toContain('Pieza Sin Cantos');
    }).not.toThrow();
  });
});
