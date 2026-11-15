import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LabelsViewComponent,
  buildLabelBarcodeBars,
  formatLabelEdgeValue,
  parsePieceCodeNumber
} from './labels-view';
import { ProjectStorageService } from '../../services/project-storage.service';
import { AssemblyGuideService } from '../../services/assembly-guide.service';
import { PaymentService } from '../../services/payment.service';
import { ThemeService } from '../../services/theme.service';
import { I18nService } from '../../services/i18n.service';
import { SupabaseService, SyncStatus, UserProfile } from '../../services/supabase.service';
import {
  Material,
  Part,
  PartEdges,
  PartGroup,
  Project,
  ProjectSettings
} from '../../models/melamine.models';

const DEFAULT_SETTINGS: ProjectSettings = {
  sawKerf: 4,
  trimMargin: 10,
  defaultBoardThickness: 18,
  thinEdgeThickness: 0.45,
  thickEdgeThickness: 2.0,
  thinEdgeCostPerMeter: 1800,
  thickEdgeCostPerMeter: 4200,
  optimizationPreference: 'guillotine_length',
  currency: 'COP',
  subtractEdgeBandingFromCut: false
};

const MAT_BLANCO: Material = {
  id: 'mat_blanco',
  name: 'Melamina Blanca 18mm',
  thickness: 18,
  sheetLength: 2440,
  sheetWidth: 1830,
  sheetCost: 165000,
  hasGrain: false,
  colorHex: '#f4f4f5',
  category: 'board'
};

const MAT_ROBLE: Material = {
  id: 'mat_roble',
  name: 'Melamina Roble 18mm',
  thickness: 18,
  sheetLength: 2440,
  sheetWidth: 1830,
  sheetCost: 195000,
  hasGrain: true,
  colorHex: '#b48a5a',
  category: 'board'
};

const MAT_NO_USADO: Material = {
  id: 'mat_sin_uso',
  name: 'Melamina Grafito 18mm',
  thickness: 18,
  sheetLength: 2440,
  sheetWidth: 1830,
  sheetCost: 185000,
  hasGrain: false,
  colorHex: '#27272a',
  category: 'board'
};

const MAT_PIEDRA: Material = {
  id: 'mat_stone_cuarzo',
  name: 'Cuarzo Blanco Polar',
  thickness: 20,
  sheetLength: 3000,
  sheetWidth: 1400,
  sheetCost: 850000,
  hasGrain: false,
  colorHex: '#fafafa',
  textureType: 'stone',
  category: 'stone',
  family: 'stone_countertop'
};

const DEFAULT_EDGES: PartEdges = {
  l1: 'thin',
  l2: 'none',
  a1: 'thick',
  a2: 'none'
};

function makePart(overrides: Partial<Part> & { id: string; name: string }): Part {
  return {
    length: 600,
    width: 400,
    thickness: 18,
    quantity: 1,
    materialId: MAT_BLANCO.id,
    materialName: MAT_BLANCO.name,
    grain: 'length',
    edges: { ...DEFAULT_EDGES },
    posX: 0,
    posY: 400,
    posZ: 0,
    orientation: 'horizontal',
    ...overrides
  };
}

function makeProject(partial: Partial<Project> = {}): Project {
  return {
    id: 'proj_labels_test',
    name: 'Cocina Integral Norte',
    clientName: 'Estudio Arquitectónico',
    date: '2026-11-15',
    notes: '',
    settings: { ...DEFAULT_SETTINGS },
    materials: [MAT_BLANCO, MAT_ROBLE, MAT_NO_USADO, MAT_PIEDRA],
    modules: [],
    groups: [],
    parts: [],
    hardware: [],
    laborCost: 0,
    laborType: 'percent',
    profitMarginPercent: 25,
    taxPercent: 19,
    updatedAt: '2026-11-15T00:00:00.000Z',
    ...partial
  };
}

function createMockSupabase(profileSignal = signal<UserProfile | null>(null)): Partial<SupabaseService> {
  return {
    isAuthenticated: signal(false),
    isAuthLoading: signal(false),
    currentUser: signal<User | null>(null),
    userProfile: profileSignal,
    cloudProjects: signal([]),
    syncStatus: signal<SyncStatus>('idle'),
    lastSyncTime: signal<Date | null>(null),
    signOut: vi.fn().mockResolvedValue(undefined),
    refreshProjects: vi.fn().mockResolvedValue([]),
    saveProject: vi.fn().mockResolvedValue(null)
  };
}

describe('LabelsViewComponent (Filtro Real de Materiales, Sync P1/P2/P3, Sticker Compacto e Impresión)', () => {
  let fixture: ComponentFixture<LabelsViewComponent>;
  let component: LabelsViewComponent;
  let projectService: ProjectStorageService;
  let i18n: I18nService;
  let userProfileSignal: ReturnType<typeof signal<UserProfile | null>>;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    document.body.classList.remove('labels-printing', 'assembly-guide-open', 'technical-sheet-open');

    userProfileSignal = signal<UserProfile | null>(null);

    await TestBed.configureTestingModule({
      imports: [LabelsViewComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: createMockSupabase(userProfileSignal) },
        ProjectStorageService,
        AssemblyGuideService,
        PaymentService,
        ThemeService,
        I18nService
      ]
    }).compileComponents();

    i18n = TestBed.inject(I18nService);
    i18n.setLanguage('es');

    projectService = TestBed.inject(ProjectStorageService);
    fixture = TestBed.createComponent(LabelsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    document.body.classList.remove('labels-printing', 'assembly-guide-open', 'technical-sheet-open');
    vi.restoreAllMocks();
  });

  describe('1. Filtro Real de Materiales (Solo Materiales Activos NO-piedra)', () => {
    it('debe mostrar únicamente "all" y los materiales NO-piedra con piezas cortables activas en el selector', () => {
      const group: PartGroup = { id: 'mod_a', name: 'Módulo Base 600', type: 'assembly' };
      projectService.updateProject(() =>
        makeProject({
          groups: [group],
          parts: [
            makePart({
              id: 'part_1',
              name: 'Lateral Izquierdo',
              groupId: group.id,
              groupName: group.name,
              quantity: 2,
              materialId: MAT_BLANCO.id,
              materialName: MAT_BLANCO.name
            }),
            makePart({
              id: 'part_2',
              name: 'Puerta Derecha',
              groupId: group.id,
              groupName: group.name,
              quantity: 1,
              materialId: MAT_ROBLE.id,
              materialName: MAT_ROBLE.name
            }),
            makePart({
              id: 'part_stone_1',
              name: 'Mesón Cuarzo',
              materialId: MAT_PIEDRA.id,
              materialName: MAT_PIEDRA.name,
              componentRole: 'countertop',
              excludeFromCutlist: true
            }),
            makePart({
              id: 'part_excluded_mel',
              name: 'Plantilla Auxiliar',
              materialId: MAT_NO_USADO.id,
              materialName: MAT_NO_USADO.name,
              excludeFromCutlist: true
            })
          ]
        })
      );

      fixture.detectChanges();

      const used = component.usedMaterials();
      expect(used.map(m => m.id)).toEqual([MAT_BLANCO.id, MAT_ROBLE.id]);
      expect(used[0].partsCount).toBe(2);
      expect(used[1].partsCount).toBe(1);

      // Las piezas de piedra y excludeFromCutlist no deben generar etiquetas
      expect(component.flatLabels().length).toBe(3);

      const el = fixture.nativeElement as HTMLElement;
      const selects = el.querySelectorAll('select');
      const materialSelect = selects[1];
      const optionValues = Array.from(materialSelect.querySelectorAll('option')).map(o => o.value);
      expect(optionValues).toEqual(['all', MAT_BLANCO.id, MAT_ROBLE.id]);
      expect(optionValues).not.toContain(MAT_NO_USADO.id);
      expect(optionValues).not.toContain(MAT_PIEDRA.id);
    });

    it('debe incluir material personalizado fuera de catálogo en usedMaterials y reiniciar filtro si desaparece', () => {
      const modA: PartGroup = { id: 'mod_a', name: 'Módulo Cocina', type: 'assembly' };
      projectService.updateProject(() =>
        makeProject({
          groups: [modA],
          parts: [
            makePart({
              id: 'part_custom',
              name: 'Repisa Especial',
              groupId: modA.id,
              materialId: 'mat_custom_nogal',
              materialName: 'Melamina Nogal Especial 18mm'
            }),
            makePart({
              id: 'part_b',
              name: 'Base',
              groupId: modA.id,
              materialId: MAT_BLANCO.id,
              materialName: MAT_BLANCO.name
            })
          ]
        })
      );
      fixture.detectChanges();

      expect(component.usedMaterials().map(m => m.id)).toEqual([MAT_BLANCO.id, 'mat_custom_nogal']);

      component.selectedModuleFilter.set(modA.id);
      component.selectedMaterialFilter.set('mat_custom_nogal');
      fixture.detectChanges();
      expect(component.flatLabels().length).toBe(1);

      // Cambiar el proyecto quitando la pieza de mat_custom_nogal y el módulo mod_a
      const modB: PartGroup = { id: 'mod_b', name: 'Módulo Nuevo', type: 'assembly' };
      projectService.updateProject(() =>
        makeProject({
          groups: [modB],
          parts: [
            makePart({
              id: 'part_b_only',
              name: 'Base Nueva',
              groupId: modB.id,
              materialId: MAT_BLANCO.id,
              materialName: MAT_BLANCO.name
            })
          ]
        })
      );
      fixture.detectChanges();

      expect(component.selectedMaterialFilter()).toBe('all');
      expect(component.selectedModuleFilter()).toBe('all');
      expect(component.flatLabels().length).toBe(1);
    });
  });

  describe('2. Sincronización P1/P2/P3, Agrupación por Módulo y Orden Numérico Ascendente', () => {
    it('debe parsear códigos numéricos correctamente sin orden lexicográfico', () => {
      expect(parsePieceCodeNumber('P1')).toBe(1);
      expect(parsePieceCodeNumber('P2')).toBe(2);
      expect(parsePieceCodeNumber('P10')).toBe(10);
      expect(parsePieceCodeNumber('P11')).toBe(11);
      expect(parsePieceCodeNumber(undefined)).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('debe agrupar por módulo en orden de guía y ordenar numéricamente P1..P11 (P2 antes que P10) dejando piezas sueltas al final', () => {
      const mod1: PartGroup = { id: 'mod_1', name: 'Módulo Torre Despensa', type: 'assembly' };
      const mod2: PartGroup = { id: 'mod_2', name: 'Módulo Alacena Superior', type: 'assembly' };

      // 11 piezas en Módulo 1 en orden intencionalmente mezclado para probar P1..P11
      const mod1Parts: Part[] = [
        makePart({
          id: 'm1_door',
          name: 'Puerta Principal',
          groupId: mod1.id,
          groupName: mod1.name,
          componentRole: 'door',
          length: 1800,
          width: 450,
          posX: 225,
          posY: 900,
          posZ: 580,
          orientation: 'vertical_xy'
        }),
        makePart({
          id: 'm1_shelf_6',
          name: 'Repisa 6',
          groupId: mod1.id,
          groupName: mod1.name,
          componentRole: 'shelf',
          posX: 225,
          posY: 1600,
          posZ: 280
        }),
        makePart({
          id: 'm1_shelf_5',
          name: 'Repisa 5',
          groupId: mod1.id,
          groupName: mod1.name,
          componentRole: 'shelf',
          posX: 225,
          posY: 1350,
          posZ: 280
        }),
        makePart({
          id: 'm1_shelf_4',
          name: 'Repisa 4',
          groupId: mod1.id,
          groupName: mod1.name,
          componentRole: 'shelf',
          posX: 225,
          posY: 1100,
          posZ: 280
        }),
        makePart({
          id: 'm1_shelf_3',
          name: 'Repisa 3',
          groupId: mod1.id,
          groupName: mod1.name,
          componentRole: 'shelf',
          posX: 225,
          posY: 850,
          posZ: 280
        }),
        makePart({
          id: 'm1_shelf_2',
          name: 'Repisa 2',
          groupId: mod1.id,
          groupName: mod1.name,
          componentRole: 'shelf',
          posX: 225,
          posY: 600,
          posZ: 280
        }),
        makePart({
          id: 'm1_shelf_1',
          name: 'Repisa 1',
          groupId: mod1.id,
          groupName: mod1.name,
          componentRole: 'shelf',
          posX: 225,
          posY: 350,
          posZ: 280
        }),
        makePart({
          id: 'm1_back',
          name: 'Fondo MDF 3mm',
          groupId: mod1.id,
          groupName: mod1.name,
          componentRole: 'back',
          thickness: 3,
          posX: 225,
          posY: 900,
          posZ: 10,
          orientation: 'vertical_xy'
        }),
        makePart({
          id: 'm1_top',
          name: 'Techo Superior',
          groupId: mod1.id,
          groupName: mod1.name,
          componentRole: 'top',
          posX: 225,
          posY: 1791,
          posZ: 280
        }),
        makePart({
          id: 'm1_bottom',
          name: 'Base Inferior',
          groupId: mod1.id,
          groupName: mod1.name,
          componentRole: 'bottom',
          posX: 225,
          posY: 9,
          posZ: 280
        }),
        makePart({
          id: 'm1_side_r',
          name: 'Lateral Derecho',
          groupId: mod1.id,
          groupName: mod1.name,
          componentRole: 'side_right',
          length: 1800,
          width: 560,
          posX: 441,
          posY: 900,
          posZ: 280,
          orientation: 'vertical_yz'
        }),
        makePart({
          id: 'm1_side_l',
          name: 'Lateral Izquierdo',
          groupId: mod1.id,
          groupName: mod1.name,
          componentRole: 'side_left',
          length: 1800,
          width: 560,
          posX: 9,
          posY: 900,
          posZ: 280,
          orientation: 'vertical_yz'
        })
      ];

      const mod2Parts: Part[] = [
        makePart({
          id: 'm2_shelf',
          name: 'Repisa Alacena',
          groupId: mod2.id,
          groupName: mod2.name,
          componentRole: 'shelf',
          quantity: 2,
          posX: 300,
          posY: 350,
          posZ: 160
        }),
        makePart({
          id: 'm2_side_l',
          name: 'Costado Alacena',
          groupId: mod2.id,
          groupName: mod2.name,
          componentRole: 'side_left',
          posX: 9,
          posY: 350,
          posZ: 160,
          orientation: 'vertical_yz'
        })
      ];

      const loosePart = makePart({
        id: 'loose_panel_1',
        name: 'Cenefa Suelta Manual',
        posX: 900,
        posY: 100,
        posZ: 0
      });

      // Insertar primero la pieza suelta, luego mod2, luego mod1 mezclado para comprobar el reordenamiento
      projectService.updateProject(() =>
        makeProject({
          groups: [mod1, mod2],
          parts: [loosePart, ...mod2Parts, ...mod1Parts]
        })
      );
      fixture.detectChanges();

      const labels = component.flatLabels();
      // 12 en mod1 + 3 copias en mod2 + 1 suelta = 16 etiquetas
      expect(labels.length).toBe(16);

      const mod1Labels = labels.slice(0, 12);
      expect(mod1Labels.every(l => l.moduleName === mod1.name)).toBe(true);
      expect(mod1Labels.map(l => l.pieceCode)).toEqual([
        'P1',
        'P2',
        'P3',
        'P4',
        'P5',
        'P6',
        'P7',
        'P8',
        'P9',
        'P10',
        'P11',
        'P12'
      ]);

      const mod2Labels = labels.slice(12, 15);
      expect(mod2Labels.every(l => l.moduleName === mod2.name)).toBe(true);
      expect(mod2Labels.map(l => l.pieceCode)).toEqual(['P1', 'P2', 'P2']);
      expect(mod2Labels.slice(1).map(l => l.copyIndex)).toEqual([1, 2]);

      const lastLabel = labels[15];
      expect(lastLabel.part.id).toBe('loose_panel_1');
    });
  });

  describe('3. Formato Legible de Cantos, Código de Barras CSS y Cero <svg> Inline', () => {
    it('debe formatear tapacantos como 0.45 / 2.0 / - con bordes diferenciados y cero <svg> en tarjetas', () => {
      expect(formatLabelEdgeValue('thin')).toBe('0.45');
      expect(formatLabelEdgeValue('thick')).toBe('2.0');
      expect(formatLabelEdgeValue('none')).toBe('-');
      expect(buildLabelBarcodeBars('ETQ-12345-1')).toEqual(buildLabelBarcodeBars('ETQ-12345-1'));
      expect(buildLabelBarcodeBars('ETQ-12345-1').length).toBe(20);

      const group: PartGroup = { id: 'mod_edge', name: 'Módulo Cajonera', type: 'assembly' };
      projectService.updateProject(() =>
        makeProject({
          groups: [group],
          parts: [
            makePart({
              id: 'part_edge_check',
              name: 'Frente de Cajón',
              groupId: group.id,
              groupName: group.name,
              componentRole: 'drawer_front',
              length: 594,
              width: 196,
              thickness: 18,
              edges: { l1: 'thin', l2: 'none', a1: 'thick', a2: 'none' }
            })
          ]
        })
      );
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const grid = el.querySelector('#labels-print-grid') as HTMLElement | null;
      expect(grid).toBeTruthy();

      const gridText = grid?.textContent ?? '';
      expect(gridText).toContain('L1: 0.45');
      expect(gridText).toContain('L2: -');
      expect(gridText).toContain('A1: 2.0');
      expect(gridText).toContain('A2: -');
      expect(gridText).not.toContain('L1:thin');
      expect(gridText).not.toContain('L2:none');
      expect(gridText).toContain('594 × 196 mm');
      expect(gridText).toContain('P1');
      expect(gridText).toContain('Módulo Cajonera');

      // Bordes Minimalist Studio por cada lado
      expect(grid?.querySelector('.border-sky-600')).toBeTruthy();
      expect(grid?.querySelector('.border-zinc-900')).toBeTruthy();
      expect(grid?.querySelector('.border-dashed.border-zinc-300')).toBeTruthy();

      // Código de barras CSS/HTML sin SVG
      const bars = grid?.querySelectorAll('.label-barcode .label-barcode-bar') ?? [];
      expect(bars.length).toBe(20);
      expect(grid?.querySelectorAll('svg').length ?? 0).toBe(0);

      // Ningún <svg> fuera de <hugeicons-icon> en toda la vista
      const nonIconSvgs = Array.from(el.querySelectorAll('svg')).filter(
        svg => !svg.closest('hugeicons-icon')
      );
      expect(nonIconSvgs.length).toBe(0);

      // Preservar clases verificadas por module-designer-responsive.spec.ts
      expect(el.innerHTML).toContain('flex-wrap');
      expect(el.innerHTML).toContain('whitespace-nowrap');
    });
  });

  describe('4. Escala con 65+ Etiquetas e Impresión Multipágina (labels-printing)', () => {
    it('debe activar labels-printing en body al montar, renderizar 66 etiquetas en #labels-print-grid, llamar window.print() y limpiar al destruir', () => {
      expect(document.body.classList.contains('labels-printing')).toBe(true);

      const group: PartGroup = { id: 'mod_massive', name: 'Cocina Completa 22 Piezas', type: 'assembly' };
      const bulkParts: Part[] = Array.from({ length: 22 }, (_, idx) =>
        makePart({
          id: `bulk_part_${idx + 1}`,
          name: `Pieza Taller ${idx + 1}`,
          groupId: group.id,
          groupName: group.name,
          quantity: 3,
          materialId: MAT_BLANCO.id,
          materialName: MAT_BLANCO.name,
          posX: idx * 30,
          posY: 400,
          posZ: 200
        })
      );

      projectService.updateProject(() =>
        makeProject({
          groups: [group],
          parts: bulkParts
        })
      );
      fixture.detectChanges();

      expect(component.flatLabels().length).toBe(66);

      const el = fixture.nativeElement as HTMLElement;
      const renderedCards = el.querySelectorAll('#labels-print-grid .label-sticker-card');
      expect(renderedCards.length).toBe(66);
      expect(el.textContent).toContain('(66)');

      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      component.printLabels();
      expect(document.body.classList.contains('labels-printing')).toBe(true);
      expect(printSpy).toHaveBeenCalledTimes(1);

      fixture.destroy();
      expect(document.body.classList.contains('labels-printing')).toBe(false);
    });

    it('debe bloquear window.print() y abrir modal de actualización si el plan restringe exportación de taller', () => {
      userProfileSignal.set({
        id: 'usr_free',
        email: 'free@example.com',
        first_name: 'Free',
        last_name: 'User',
        role: 'user',
        plan: 'free',
        created_at: '2026-11-15T00:00:00.000Z',
        updated_at: '2026-11-15T00:00:00.000Z'
      });

      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined);
      const paymentService = TestBed.inject(PaymentService);
      const upgradeSpy = vi.spyOn(paymentService, 'openUpgradeModal');

      component.printLabels();
      expect(printSpy).not.toHaveBeenCalled();
      expect(upgradeSpy).toHaveBeenCalledWith('workshop_export', 'pro');
    });
  });
});
