import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { User } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplatesModalComponent } from './templates-modal';
import { Material } from '../../models/melamine.models';
import { ProjectStorageService } from '../../services/project-storage.service';
import { SupabaseService, SyncStatus } from '../../services/supabase.service';
import {
  FurnitureTemplate,
  TemplatesCatalogService
} from '../../services/templates-catalog.service';
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
  },
  {
    id: 'mat_test_mdf_3',
    name: 'Fondo MDF Blanco 3mm',
    thickness: 3,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 38000,
    hasGrain: false,
    colorHex: '#e4e4e7',
    category: 'mdf'
  }
];

describe('TemplatesModalComponent: Catálogo 3D, Vista 360°, Filtros y Personalización en Asistente', () => {
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

  it('debe permanecer cerrado por defecto y mostrar todas las plantillas al abrir sin filtros ocultos', () => {
    expect(component.isOpen()).toBe(false);
    expect(hostEl.querySelector('[role="dialog"]')).toBeNull();
    expect(component.selectedTemplate()).toBeNull();
    expect(component.creationMode()).toBe('append');

    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    expect(hostEl.querySelector('[role="dialog"]')).toBeTruthy();
    expect(hostEl.textContent).toContain('Catálogo de Plantillas 3D');
    expect(component.activeCategory()).toBe('all');
    expect(component.creationMode()).toBe('append');

    const allTemplates = component.filteredTemplates();
    expect(allTemplates.length).toBe(catalogService.templates.length);
    expect(component.selectedTemplate()?.id).toBe(catalogService.templates[0].id);

    const linesPresent = new Set(allTemplates.map(t => t.environmentLine));
    expect(linesPresent.has('kitchen')).toBe(true);
    expect(linesPresent.has('closet')).toBe(true);
    expect(linesPresent.has('bathroom')).toBe(true);
    expect(linesPresent.has('living_office')).toBe(true);

    const cards = hostEl.querySelectorAll('section[aria-label="Listado de plantillas"] h3');
    expect(cards.length).toBe(catalogService.templates.length);
  });

  it('debe preseleccionar initialTemplateId al abrir y sincronizar cambios mientras el modal permanece abierto', () => {
    const targetTpl = catalogService.templates.find(t => t.category === 'bano');
    expect(targetTpl).toBeDefined();

    fixture.componentRef.setInput('initialTemplateId', targetTpl!.id);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    expect(component.selectedTemplate()?.id).toBe(targetTpl!.id);

    // Filtrar por otra categoría y cambiar initialTemplateId debe restaurar visibilidad y seleccionarlo
    component.selectCategory('cocina');
    fixture.detectChanges();
    expect(component.selectedTemplate()?.category).toBe('cocina');

    const closetTpl = catalogService.templates.find(t => t.category === 'closets');
    expect(closetTpl).toBeDefined();
    fixture.componentRef.setInput('initialTemplateId', closetTpl!.id);
    fixture.detectChanges();

    expect(component.activeCategory()).toBe('all');
    expect(component.selectedTemplate()?.id).toBe(closetTpl!.id);
  });

  it('debe mostrar conteos dinámicos por categoría, filtrar por categoría y búsqueda, y permitir restablecer filtros', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const cats = component.categories();
    expect(cats.length).toBe(7);
    expect(cats.find(c => c.id === 'all')?.count).toBe(catalogService.templates.length);

    const banoBtn = Array.from(hostEl.querySelectorAll('button')).find(btn =>
      btn.textContent?.includes('Baño')
    );
    expect(banoBtn).toBeTruthy();
    banoBtn!.click();
    fixture.detectChanges();

    expect(component.activeCategory()).toBe('bano');
    const expectedBano = catalogService.templates.filter(t => t.category === 'bano');
    expect(component.filteredTemplates().length).toBe(expectedBano.length);
    expect(component.filteredTemplates().every(t => t.category === 'bano')).toBe(true);
    expect(component.selectedTemplate()?.category).toBe('bano');

    component.selectCategory('all');
    fixture.detectChanges();

    const searchInput = hostEl.querySelector('input#catalog-search-input') as HTMLInputElement | null;
    expect(searchInput).toBeTruthy();
    searchInput!.value = 'Vanitory';
    searchInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.searchQuery()).toBe('Vanitory');
    expect(component.filteredTemplates().length).toBeGreaterThan(0);
    expect(
      component.filteredTemplates().every(
        t =>
          t.name.toLowerCase().includes('vanitory') ||
          t.description.toLowerCase().includes('vanitory') ||
          t.badge.toLowerCase().includes('vanitory') ||
          t.categoryLabel.toLowerCase().includes('vanitory')
      )
    ).toBe(true);

    // Búsqueda sin resultados -> estado vacío + botón restablecer
    searchInput!.value = 'ZZZ_INEXISTENTE_999';
    searchInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.filteredTemplates().length).toBe(0);
    expect(component.selectedTemplate()).toBeNull();
    expect(hostEl.textContent).toContain('No se encontraron plantillas');

    const resetBtn = Array.from(hostEl.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Ver todas las plantillas'
    );
    expect(resetBtn).toBeTruthy();
    resetBtn!.click();
    fixture.detectChanges();

    expect(component.searchQuery()).toBe('');
    expect(component.activeCategory()).toBe('all');
    expect(component.filteredTemplates().length).toBe(catalogService.templates.length);
    expect(component.selectedTemplate()).not.toBeNull();
  });

  it('debe renderizar de forma segura app-template-preview-3d en jsdom con resumen de piezas y componentes', () => {
    const drawerTpl = catalogService.templates.find(t => t.id === 'cajonera_3_cajones');
    expect(drawerTpl).toBeDefined();

    fixture.componentRef.setInput('initialTemplateId', drawerTpl!.id);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const previewEl = hostEl.querySelector('app-template-preview-3d') as HTMLElement | null;
    expect(previewEl).toBeTruthy();
    expect(previewEl?.querySelector('.preview-stage')).toBeTruthy();

    const dimsText = `${drawerTpl!.dimensions.width} × ${drawerTpl!.dimensions.height} × ${drawerTpl!.dimensions.depth} mm`;
    expect(previewEl?.textContent).toContain(dimsText);

    const summary = component.selectedSummary();
    expect(summary).not.toBeNull();
    expect(summary!.partsCount).toBeGreaterThan(0);
    expect(summary!.drawersCount).toBe(3);

    const summarySection = hostEl.querySelector(
      'section[aria-label="Vista previa 3D de la plantilla seleccionada"]'
    ) as HTMLElement;
    expect(summarySection.textContent).toContain(`${summary!.partsCount} piezas`);
    expect(summarySection.textContent).toContain('3 Cajones');
  });

  it('debe emitir templateSelected con modo elegido, customizeTemplateRequested y startBlankRequested al accionar los botones', () => {
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const selectedEvents: { template: FurnitureTemplate; mode: 'replace' | 'append' }[] = [];
    const customizeEvents: FurnitureTemplate[] = [];
    let blankCalls = 0;
    let closeCalls = 0;

    component.templateSelected.subscribe(ev => selectedEvents.push(ev));
    component.customizeTemplateRequested.subscribe(tpl => customizeEvents.push(tpl));
    component.startBlankRequested.subscribe(() => {
      blankCalls += 1;
    });
    component.modalClose.subscribe(() => {
      closeCalls += 1;
    });

    const firstTpl = component.selectedTemplate()!;
    const replaceBtn = Array.from(hostEl.querySelectorAll('button')).find(
      b => b.textContent?.trim() === 'Reemplazar escena'
    );
    expect(replaceBtn).toBeTruthy();
    replaceBtn!.click();
    fixture.detectChanges();
    expect(component.creationMode()).toBe('replace');

    const insertBtn = Array.from(hostEl.querySelectorAll('button')).find(b =>
      b.textContent?.includes('+ Insertar Mueble en el Lienzo')
    );
    expect(insertBtn).toBeTruthy();
    insertBtn!.click();
    fixture.detectChanges();

    expect(selectedEvents.length).toBe(1);
    expect(selectedEvents[0].template.id).toBe(firstTpl.id);
    expect(selectedEvents[0].mode).toBe('replace');
    expect(closeCalls).toBe(1);

    // Reabrir y probar "Abrir y Personalizar en Asistente"
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const secondTpl = catalogService.templates[1] ?? catalogService.templates[0];
    component.selectTemplate(secondTpl);
    fixture.detectChanges();

    const customizeBtn = Array.from(hostEl.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Abrir y Personalizar en Asistente')
    );
    expect(customizeBtn).toBeTruthy();
    customizeBtn!.click();
    fixture.detectChanges();

    expect(customizeEvents.length).toBe(1);
    expect(customizeEvents[0].id).toBe(secondTpl.id);
    expect(closeCalls).toBe(2);

    // Reabrir y probar "Lienzo en Blanco"
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const blankBtn = Array.from(hostEl.querySelectorAll('button')).find(b =>
      b.textContent?.includes('Lienzo en Blanco')
    );
    expect(blankBtn).toBeTruthy();
    blankBtn!.click();
    fixture.detectChanges();

    expect(blankCalls).toBe(1);
    expect(closeCalls).toBe(3);
  });
});
