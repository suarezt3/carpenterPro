import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TechnicalSheetModalComponent } from './technical-sheet-modal';
import { JoineryEngineService } from '../../services/joinery-engine.service';
import { DxfExporterService } from '../../services/dxf-exporter.service';
import { Project, Material, ProjectSettings } from '../../models/melamine.models';

describe('TechnicalSheetModalComponent (Impresión y Proyecciones 2D)', () => {
  let component: TechnicalSheetModalComponent;
  let fixture: ComponentFixture<TechnicalSheetModalComponent>;

  const mockMaterial: Material = {
    id: 'mat_1',
    name: 'Blanco Frost 18mm',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 150000,
    hasGrain: false,
    colorHex: '#ffffff'
  };

  const mockSettings: ProjectSettings = {
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

  const mockProject: Project = {
    id: 'proj_1',
    name: 'Mueble Cocina Test',
    clientName: 'Cliente Juan',
    date: '2026-11-07',
    notes: 'Nota técnica',
    settings: mockSettings,
    materials: [mockMaterial],
    modules: [],
    parts: [
      {
        id: 'part_1',
        name: 'Lateral Izquierdo',
        length: 700,
        width: 500,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_1',
        materialName: 'Blanco Frost 18mm',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 9,
        posY: 350,
        posZ: 250,
        orientation: 'vertical_yz'
      },
      {
        id: 'part_2',
        name: 'Base Inferior',
        length: 564,
        width: 500,
        thickness: 18,
        quantity: 1,
        materialId: 'mat_1',
        materialName: 'Blanco Frost 18mm',
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 300,
        posY: 9,
        posZ: 250,
        orientation: 'horizontal'
      }
    ],
    hardware: [],
    laborCost: 0,
    laborType: 'percent',
    profitMarginPercent: 20,
    taxPercent: 19,
    updatedAt: new Date().toISOString()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TechnicalSheetModalComponent],
      providers: [
        JoineryEngineService,
        DxfExporterService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TechnicalSheetModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('project', mockProject);
    fixture.detectChanges();
  });

  afterEach(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('technical-sheet-open');
    }
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debe añadir la clase technical-sheet-open al body al inicializarse', () => {
    expect(document.body.classList.contains('technical-sheet-open')).toBe(true);
  });

  it('debe remover la clase technical-sheet-open del body al destruirse', () => {
    expect(document.body.classList.contains('technical-sheet-open')).toBe(true);
    fixture.destroy();
    expect(document.body.classList.contains('technical-sheet-open')).toBe(false);
  });

  it('debe calcular las dimensiones generales del proyecto (bounds)', () => {
    const bounds = component.bounds();
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.height).toBeGreaterThan(0);
    expect(bounds.depth).toBeGreaterThan(0);
  });

  it('debe generar piezas proyectadas de alzada frontal y perfil lateral', () => {
    const front = component.frontPieces();
    const side = component.sidePieces();
    expect(front.length).toBe(2);
    expect(side.length).toBe(2);
  });

  it('debe invocar window.print al hacer clic en imprimir', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    component.printSheet();
    expect(printSpy).toHaveBeenCalled();
  });

  it('debe alternar entre CAD oscuro y papel blanco', () => {
    const initialTheme = component.isBlueprintDark();
    component.toggleTheme();
    expect(component.isBlueprintDark()).toBe(!initialTheme);
  });
});
