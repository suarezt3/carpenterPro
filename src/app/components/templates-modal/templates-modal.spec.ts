import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { User } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplatesModalComponent } from './templates-modal';
import { Material, ParametricCabinetConfig } from '../../models/melamine.models';
import { ProjectStorageService } from '../../services/project-storage.service';
import { SupabaseService, SyncStatus } from '../../services/supabase.service';
import { TemplatesCatalogService } from '../../services/templates-catalog.service';
import { ThemeService } from '../../services/theme.service';

function createMockSupabase(): Partial<SupabaseService> {
  return {
    isAuthenticated: signal(false),
    isAuthLoading: signal(false),
    currentUser: signal<User | null>(null),
    userProfile: signal(null),
    cloudProjects: signal([]),
    syncStatus: signal<SyncStatus>('idle'),
    lastSyncTime: signal<Date | null>(null),
    signOut: vi.fn().mockResolvedValue(undefined),
    refreshProjects: vi.fn().mockResolvedValue([]),
    saveProject: vi.fn().mockResolvedValue(null)
  };
}

const TEST_MATERIALS: Material[] = [
  {
    id: 'mat_test_white_15',
    name: 'Melamina Blanco Mate 15mm',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 145000,
    hasGrain: false,
    colorHex: '#f8fafc',
    category: 'board'
  }
];

function createEditConfig(): ParametricCabinetConfig {
  return {
    code: 'CLO_EDIT',
    name: 'Closet Principal Editado',
    moduleType: 'closet',
    category: 'closet',
    width: 1000,
    height: 2100,
    depth: 600,
    structureThickness: 18,
    doorThickness: 18,
    backThickness: 3,
    backType: 'groove',
    shelvesCount: 3,
    doorOpening: 'double',
    hasHandle: true,
    hasBackPanel: true,
    structureMaterialId: 'mat_test_white_15',
    doorMaterialId: 'mat_test_white_15',
    backMaterialId: 'mat_test_white_15',
    handleType: 'bar_modern',
    handleFinish: 'brushed_steel',
    facadeGap: 3
  };
}

describe('TemplatesModalComponent: initialView, environmentLine y Visibilidad Completa de Plantillas (TAREA 1 & 3)', () => {
  let fixture: ComponentFixture<TemplatesModalComponent>;
  let component: TemplatesModalComponent;
  let hostEl: HTMLElement;
  let catalogService: TemplatesCatalogService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    await TestBed.configureTestingModule({
      imports: [TemplatesModalComponent],
      providers: [
        { provide: SupabaseService, useValue: createMockSupabase() },
        ProjectStorageService,
        TemplatesCatalogService,
        ThemeService
      ]
    }).compileComponents();

    catalogService = TestBed.inject(TemplatesCatalogService);
    fixture = TestBed.createComponent(TemplatesModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('materials', TEST_MATERIALS);
    fixture.detectChanges();
    hostEl = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    fixture.destroy();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('debe tener initialView = "assistant" y environmentLine = undefined por defecto', () => {
    expect(component.initialView()).toBe('assistant');
    expect(component.environmentLine()).toBeUndefined();
    expect(component.activeView()).toBe('assistant');
  });

  it('debe abrir en vista "assistant" cuando initialView = "assistant" en modo creación', () => {
    fixture.componentRef.setInput('initialView', 'assistant');
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    expect(component.activeView()).toBe('assistant');
    expect(hostEl.textContent).toContain('Dimensiones Exteriores (mm)');
    expect(hostEl.textContent).toContain('Crear Módulo en 3D');
    expect(hostEl.querySelector('input[placeholder="Filtrar plantilla..."]')).toBeNull();
  });

  it('debe abrir directamente en vista "catalog" cuando initialView = "catalog" en modo creación', () => {
    fixture.componentRef.setInput('initialView', 'catalog');
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    expect(component.activeView()).toBe('catalog');
    expect(hostEl.querySelector('input[placeholder="Filtrar plantilla..."]')).toBeTruthy();
    expect(hostEl.textContent).toContain('Todas las Plantillas');
  });

  it('debe alternar correctamente entre "catalog" y "assistant" al reabrir con distinto initialView', () => {
    fixture.componentRef.setInput('initialView', 'catalog');
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    expect(component.activeView()).toBe('catalog');

    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();

    fixture.componentRef.setInput('initialView', 'assistant');
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    expect(component.activeView()).toBe('assistant');
  });

  it('en modo edición debe forzar "assistant" vía loadConfig incluso si initialView = "catalog"', () => {
    const editCfg = createEditConfig();
    fixture.componentRef.setInput('initialView', 'catalog');
    fixture.componentRef.setInput('editingGroupId', 'group-edit-1');
    fixture.componentRef.setInput('editingConfig', editCfg);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    expect(component.activeView()).toBe('assistant');
    expect(component.moduleName()).toBe('Closet Principal Editado');
    expect(component.width()).toBe(1000);
    expect(component.height()).toBe(2100);
    expect(hostEl.textContent).toContain('Guardar Cambios del Módulo');
  });

  it('con environmentLine = undefined no debe sobrescribir el preset elegido al abrir en modo creación', () => {
    component.selectPreset('drawers');
    expect(component.activePreset()).toBe('drawers');

    fixture.componentRef.setInput('initialView', 'assistant');
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    expect(component.environmentLine()).toBeUndefined();
    expect(component.activePreset()).toBe('drawers');
  });

  it('cuando environmentLine recibe un valor explícito sí aplica el preset mapeado correspondiente', () => {
    fixture.componentRef.setInput('environmentLine', 'bathroom');
    fixture.componentRef.setInput('initialView', 'assistant');
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    expect(component.activePreset()).toBe('vanity');
    expect(component.moduleName()).toBe('Vanitorio Baño');
  });

  it('filteredTemplates en categoría "all" debe mostrar TODAS las plantillas sin filtro oculto por environmentLine', () => {
    fixture.componentRef.setInput('environmentLine', 'kitchen');
    fixture.componentRef.setInput('initialView', 'catalog');
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    expect(component.activeCategory()).toBe('all');
    const allTemplates = component.filteredTemplates();
    expect(allTemplates.length).toBe(catalogService.templates.length);

    const linesPresent = new Set(allTemplates.map(t => t.environmentLine));
    expect(linesPresent.has('kitchen')).toBe(true);
    expect(linesPresent.has('closet')).toBe(true);
    expect(linesPresent.has('bathroom')).toBe(true);
    expect(linesPresent.has('living_office')).toBe(true);

    const renderedCards = hostEl.querySelectorAll('h3');
    expect(renderedCards.length).toBe(catalogService.templates.length);
  });

  it('debe filtrar plantillas por categoría y búsqueda en la vista catálogo', () => {
    fixture.componentRef.setInput('initialView', 'catalog');
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const categoryButtons = Array.from(hostEl.querySelectorAll('button'));
    const banoBtn = categoryButtons.find(btn => btn.textContent?.includes('Baños'));
    expect(banoBtn).toBeTruthy();

    banoBtn!.click();
    fixture.detectChanges();

    expect(component.activeCategory()).toBe('bano');
    const expectedBano = catalogService.templates.filter(t => t.category === 'bano');
    expect(component.filteredTemplates().length).toBe(expectedBano.length);
    expect(component.filteredTemplates().every(t => t.category === 'bano')).toBe(true);

    component.selectCategory('all');
    component.searchQuery.set('Vanitory');
    fixture.detectChanges();
    expect(component.filteredTemplates().length).toBeGreaterThan(0);
    expect(
      component.filteredTemplates().every(t =>
        t.name.toLowerCase().includes('vanitory') ||
        t.description.toLowerCase().includes('vanitory') ||
        t.categoryLabel.toLowerCase().includes('vanitory')
      )
    ).toBe(true);
  });
});
