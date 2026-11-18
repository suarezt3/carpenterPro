import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ModuleDesignerComponent } from './module-designer';
import { Furniture3dViewerComponent } from '../furniture-3d-viewer/furniture-3d-viewer';
import {
  APPLIANCES_CATALOG_PRESETS,
  ApplianceItem,
  Part
} from '../../models/melamine.models';
import { I18nService } from '../../services/i18n.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { SupabaseService, SyncStatus } from '../../services/supabase.service';
import { ThemeService } from '../../services/theme.service';

interface ViewerInitInternals {
  initThree: () => void;
}

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

function buildTestPart(overrides: Partial<Part> = {}): Part {
  return {
    id: overrides.id ?? 'ux-part-1',
    name: overrides.name ?? 'LATERAL TEST',
    length: overrides.length ?? 700,
    width: overrides.width ?? 500,
    thickness: overrides.thickness ?? 18,
    quantity: overrides.quantity ?? 1,
    materialId: overrides.materialId ?? 'mat_white_15',
    materialName: overrides.materialName ?? 'Melamina Blanco 15mm',
    grain: overrides.grain ?? 'length',
    edges: overrides.edges ?? { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
    posX: overrides.posX ?? 0,
    posY: overrides.posY ?? 350,
    posZ: overrides.posZ ?? 0,
    orientation: overrides.orientation ?? 'vertical_yz',
    componentRole: overrides.componentRole ?? 'side_left',
    ...overrides
  };
}

function buildTestAppliance(overrides: Partial<ApplianceItem> = {}): ApplianceItem {
  return {
    id: overrides.id ?? 'ux-app-1',
    name: overrides.name ?? 'Nevera French Door',
    type: overrides.type ?? 'refrigerator',
    width: overrides.width ?? 900,
    depth: overrides.depth ?? 700,
    height: overrides.height ?? 1800,
    finish: overrides.finish ?? 'stainless_steel',
    mountType: overrides.mountType ?? 'floor',
    position: overrides.position ?? { x: 0, y: 0, z: 0 },
    rotation: overrides.rotation ?? 0,
    includeInBudget: overrides.includeInBudget ?? true,
    price: overrides.price ?? 2500000,
    ...overrides
  };
}

describe('ModuleDesignerComponent: Refactor UX/UI Completo (TAREA 1, 2, 3 y 4)', () => {
  let fixture: ComponentFixture<ModuleDesignerComponent>;
  let component: ModuleDesignerComponent;
  let hostEl: HTMLElement;
  let projectService: ProjectStorageService;
  let i18n: I18nService;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as ViewerInitInternals,
      'initThree'
    ).mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [ModuleDesignerComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: createMockSupabase() },
        ProjectStorageService,
        ThemeService,
        I18nService
      ]
    }).compileComponents();

    i18n = TestBed.inject(I18nService);
    i18n.setLanguage('es');
    projectService = TestBed.inject(ProjectStorageService);

    fixture = TestBed.createComponent(ModuleDesignerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    hostEl = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('TAREA 1: Desacople de Línea de Ambiente y Catálogo Equipos sin Filtro Oculto', () => {
    it('no debe exponer señales ni métodos eliminados de líneas de ambiente en ModuleDesignerComponent', () => {
      expect('selectedEnvironmentLine' in component).toBe(false);
      expect('setEnvironmentLine' in component).toBe(false);
      expect('applianceFilterByEnvironment' in component).toBe(false);
    });

    it('pestaña Equipos debe renderizar las 15 pastillas de categoría sin badge de Línea y filtrar directamente', () => {
      component.activeDockTab.set('appliances');
      fixture.detectChanges();

      const inspector = hostEl.querySelector('.md-inspector-panel') as HTMLElement;
      expect(inspector).toBeTruthy();
      expect(inspector.textContent).not.toContain('Línea:');

      const expectedPills: {
        label: string;
        cat: ReturnType<typeof component.activeApplianceCategory>;
      }[] = [
        { label: 'Todos', cat: 'all' },
        { label: 'Baño', cat: 'bathroom' },
        { label: 'Closet & Camas', cat: 'bedroom' },
        { label: 'TVs', cat: 'electronics' },
        { label: 'Oficina', cat: 'office' },
        { label: 'Neveras', cat: 'cold' },
        { label: 'Hornos & Cocción', cat: 'cooking' },
        { label: 'Lavaplatos', cat: 'washing' },
        { label: 'Campanas', cat: 'extraction' },
        { label: 'Microondas', cat: 'microwave' },
        { label: 'Cafeteras', cat: 'coffee' },
        { label: 'Patas', cat: 'legs' },
        { label: 'Sillas', cat: 'seating' },
        { label: 'Lámparas', cat: 'lighting' },
        { label: 'Ventanas & Puertas', cat: 'architecture' }
      ];

      expect(component.activeApplianceCategory()).toBe('all');
      expect(component.filteredAppliances().length).toBe(APPLIANCES_CATALOG_PRESETS.length);
      expect(inspector.textContent).toContain(`${APPLIANCES_CATALOG_PRESETS.length} ítems`);

      const buttons = Array.from(inspector.querySelectorAll('button'));
      for (const pill of expectedPills) {
        const btn = buttons.find(b => b.textContent?.trim() === pill.label);
        expect(btn).toBeTruthy();

        btn!.click();
        fixture.detectChanges();

        expect(component.activeApplianceCategory()).toBe(pill.cat);
        const expectedItems =
          pill.cat === 'all'
            ? APPLIANCES_CATALOG_PRESETS
            : APPLIANCES_CATALOG_PRESETS.filter(a => a.category === pill.cat);
        expect(component.filteredAppliances().length).toBe(expectedItems.length);
        expect(inspector.textContent).toContain(`${expectedItems.length} ítems`);
      }
    });
  });

  describe('TAREA 2: Controles Limpios de Escenario 3D y Toggle Imán / Colisiones en .md-top-bar', () => {
    it('debe alternar Cuarto 3D / Entorno y colapsar la bandeja lateral desde .md-top-bar', () => {
      const topBar = hostEl.querySelector('.md-top-bar') as HTMLElement;
      const findTopBtn = (needle: string) =>
        Array.from(topBar.querySelectorAll('button')).find(b => b.textContent?.includes(needle));

      const roomBtn = findTopBtn(i18n.t('designer.room3d'));
      expect(roomBtn).toBeTruthy();
      expect(findTopBtn(i18n.t('designer.environment'))).toBeUndefined();

      roomBtn!.click();
      fixture.detectChanges();

      expect(component.workspaceMode()).toBe('room');
      const envBtn = findTopBtn(i18n.t('designer.environment'));
      expect(envBtn).toBeTruthy();

      envBtn!.click();
      fixture.detectChanges();
      expect(component.showRoomSettingsModal()).toBe(true);

      const roomOnBtn = findTopBtn(i18n.t('designer.roomOn'));
      expect(roomOnBtn).toBeTruthy();
      roomOnBtn!.click();
      fixture.detectChanges();
      expect(component.workspaceMode()).toBe('module');

      const collapseBtn = findTopBtn(i18n.t('designer.hide'));
      expect(collapseBtn).toBeTruthy();
      collapseBtn!.click();
      fixture.detectChanges();

      expect(component.isSidebarCollapsed()).toBe(true);
      expect(hostEl.querySelector('.md-inspector-panel')).toBeNull();

      const expandBtn = findTopBtn(i18n.t('designer.show'));
      expect(expandBtn).toBeTruthy();
      expandBtn!.click();
      fixture.detectChanges();
      expect(component.isSidebarCollapsed()).toBe(false);
      expect(hostEl.querySelector('.md-inspector-panel')).toBeTruthy();
    });

    it('debe sincronizar isMagneticSnap() con viewer3d y alternar desde el botón Imán / Colisiones 3D', () => {
      const topBar = hostEl.querySelector('.md-top-bar') as HTMLElement;
      const snapBtn = Array.from(topBar.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Imán / Colisiones 3D')
      );
      expect(snapBtn).toBeTruthy();
      expect(component.viewer3d()).toBeTruthy();
      expect(component.isMagneticSnap()).toBe(true);
      expect(snapBtn?.className).toContain('bg-zinc-900');
      expect(snapBtn?.className).toContain('text-white');

      snapBtn!.click();
      fixture.detectChanges();

      expect(component.isMagneticSnap()).toBe(false);
      expect(component.viewer3d()?.isMagneticSnap()).toBe(false);
      expect(component.toastMessage()).toContain('Imán 3D desactivado');
      expect(snapBtn?.className).toContain('bg-white');
      expect(snapBtn?.className).toContain('text-zinc-700');

      snapBtn!.click();
      fixture.detectChanges();

      expect(component.isMagneticSnap()).toBe(true);
      expect(component.viewer3d()?.isMagneticSnap()).toBe(true);
      expect(component.toastMessage()).toContain('Imán y colisiones 3D activos');
    });
  });

  describe('TAREA 3: + Catálogo Unificado (CONSTRUCCIÓN Y MÓDULOS 3D con 4 Botones Diferenciados)', () => {
    it('debe renderizar CONSTRUCCIÓN Y MÓDULOS 3D con las 4 acciones diferenciadas y conservar Cajón Modular', () => {
      component.activeDockTab.set('catalog');
      fixture.detectChanges();

      const inspector = hostEl.querySelector('.md-inspector-panel') as HTMLElement;
      expect(inspector.textContent).toContain('CONSTRUCCIÓN Y MÓDULOS 3D');
      expect(inspector.textContent).toContain('Cajón Modular (Asistente)');

      const buttons = Array.from(inspector.querySelectorAll('button'));
      const assistantBtn = buttons.find(b =>
        b.textContent?.includes('+ Crear Módulo a Medida (Asistente)')
      );
      const templatesBtn = buttons.find(b =>
        b.textContent?.includes('Plantillas de Muebles 3D')
      );
      const freeBoardBtn = buttons.find(b =>
        b.textContent?.includes('+ Tablero / Pieza Libre')
      );
      const countertopBtn = buttons.find(b =>
        b.textContent?.includes('+ Mesón de Piedra')
      );

      expect(assistantBtn).toBeTruthy();
      expect(assistantBtn?.className).toContain('bg-zinc-900');
      expect(assistantBtn?.className).toContain('text-white');
      expect(templatesBtn).toBeTruthy();
      expect(freeBoardBtn).toBeTruthy();
      expect(countertopBtn).toBeTruthy();
    });

    it('las 4 acciones de CONSTRUCCIÓN Y MÓDULOS 3D deben abrir Asistente, Catálogo, crear Tablero Libre y abrir Mesón de Piedra', async () => {
      component.activeDockTab.set('catalog');
      fixture.detectChanges();

      const inspector = hostEl.querySelector('.md-inspector-panel') as HTMLElement;
      const findCatBtn = (text: string) =>
        Array.from(inspector.querySelectorAll('button')).find(b => b.textContent?.includes(text))!;

      // 1. + Crear Módulo a Medida (Asistente)
      findCatBtn('+ Crear Módulo a Medida (Asistente)').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.showTemplatesModal()).toBe(true);
      expect(component.templatesModalInitialView()).toBe('assistant');
      const modalOnAssistant = hostEl.querySelector('app-templates-modal') as HTMLElement | null;
      expect(modalOnAssistant).toBeTruthy();
      expect(modalOnAssistant?.textContent).toContain('Dimensiones Exteriores (mm)');

      component.closeTemplatesModal();
      fixture.detectChanges();
      expect(component.showTemplatesModal()).toBe(false);

      // 2. Plantillas de Muebles 3D
      findCatBtn('Plantillas de Muebles 3D').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.showTemplatesModal()).toBe(true);
      expect(component.templatesModalInitialView()).toBe('catalog');
      const modalOnCatalog = hostEl.querySelector('app-templates-modal') as HTMLElement | null;
      expect(modalOnCatalog?.querySelector('input[placeholder="Filtrar plantilla..."]')).toBeTruthy();

      component.closeTemplatesModal();
      fixture.detectChanges();

      // 3. + Tablero / Pieza Libre
      const countBefore = component.currentParts().length;
      findCatBtn('+ Tablero / Pieza Libre').click();
      fixture.detectChanges();

      expect(component.currentParts().length).toBe(countBefore + 1);
      expect(component.selectedPart()?.length).toBe(600);
      expect(component.selectedPart()?.width).toBe(400);
      expect(component.selectedPart()?.orientation).toBe('horizontal');
      expect(component.toastMessage()).toBe('Tablero libre añadido al lienzo 3D');
      expect(component.activeDockTab()).toBe('piece');

      // 4. + Mesón de Piedra
      component.activeDockTab.set('catalog');
      fixture.detectChanges();
      findCatBtn('+ Mesón de Piedra').click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.showTemplatesModal()).toBe(false);
      expect(component.showKitchenProPanel()).toBe(true);
      expect(component.kitchenProTab()).toBe('countertop');
    });
  });

  describe('TAREA 4: Propiedades Estado Vacío, Inspector de Equipo y Smart Tab Inicial -> Auto Piece', () => {
    it('estado vacío de Propiedades debe mostrar "Ninguna pieza seleccionada", sin botones duplicados y enlace "Ir a + Catálogo"', () => {
      projectService.clearFurniture();
      projectService.setWorkspaceMode('module');
      component.deselectAll();
      component.activeDockTab.set('piece');
      fixture.detectChanges();

      const inspector = hostEl.querySelector('.md-inspector-panel') as HTMLElement;
      expect(inspector.textContent).toContain('Ninguna pieza seleccionada');
      expect(inspector.textContent).not.toContain('Añadir Piezas o Cajones (Catálogo)');
      expect(inspector.textContent).not.toContain('Explorar Plantillas de Muebles');

      const goToCatalogBtn = Array.from(inspector.querySelectorAll('button')).find(
        b => b.textContent?.trim() === 'Ir a + Catálogo'
      );
      expect(goToCatalogBtn).toBeTruthy();

      goToCatalogBtn!.click();
      fixture.detectChanges();

      expect(component.activeDockTab()).toBe('catalog');
      expect(inspector.textContent).toContain('CONSTRUCCIÓN Y MÓDULOS 3D');
    });

    it('al seleccionar un equipo 3D debe cambiar a "piece" y renderizar el inspector compartido de Equipo Seleccionado', () => {
      const app = buildTestAppliance({ id: 'app-piece-tab-1', name: 'Horno Empotrado 60' });
      projectService.addAppliance(app);
      projectService.selectAppliance(null);
      projectService.selectAppliances([]);
      component.activeDockTab.set('catalog');
      fixture.detectChanges();

      component.onApplianceSelectedFrom3D(app);
      fixture.detectChanges();

      expect(component.activeDockTab()).toBe('piece');
      const inspector = hostEl.querySelector('.md-inspector-panel') as HTMLElement;
      expect(inspector.textContent).toContain('Equipo Seleccionado');
      expect(inspector.textContent).toContain('Equipo');
      const nameInput = inspector.querySelector(
        'input[title="Editar nombre del electrodoméstico"]'
      ) as HTMLInputElement | null;
      expect(nameInput?.value).toBe('Horno Empotrado 60');
    });

    it('debe cambiar automáticamente de "catalog" a "piece" al seleccionar pieza, lote de piezas, equipo, lote de equipos o muro 3D', () => {
      const part = buildTestPart({ id: 'smart-part-1' });
      const app = buildTestAppliance({ id: 'smart-app-1' });
      projectService.updateProject(p => ({ ...p, parts: [part], appliances: [app] }), false);

      // 1. Selección individual de pieza 3D
      component.deselectAll();
      expect(component.activeDockTab()).toBe('catalog');
      component.onSelectPartFrom3D(part);
      expect(component.activeDockTab()).toBe('piece');

      // 2. Selección múltiple de piezas 3D
      component.deselectAll();
      expect(component.activeDockTab()).toBe('catalog');
      component.onPartsSelectedFrom3D([part.id]);
      expect(component.activeDockTab()).toBe('piece');

      // 3. Selección individual de equipo 3D
      component.deselectAll();
      expect(component.activeDockTab()).toBe('catalog');
      component.onApplianceSelectedFrom3D(app);
      expect(component.activeDockTab()).toBe('piece');

      // 4. Selección múltiple de equipos 3D
      component.deselectAll();
      expect(component.activeDockTab()).toBe('catalog');
      component.onAppliancesSelectedFrom3D([app.id]);
      expect(component.activeDockTab()).toBe('piece');

      // 5. Selección de muro 3D
      component.deselectAll();
      expect(component.activeDockTab()).toBe('catalog');
      component.onWallSelected('main');
      expect(component.activeDockTab()).toBe('piece');
    });
  });
});

describe('ModuleDesignerComponent: Smart Tab Inicial en "+ Catálogo" según Estado de Entrada (TAREA 4)', () => {
  let activeFixture: ComponentFixture<ModuleDesignerComponent> | null = null;

  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as ViewerInitInternals,
      'initThree'
    ).mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [ModuleDesignerComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: createMockSupabase() },
        ProjectStorageService,
        ThemeService,
        I18nService
      ]
    }).compileComponents();
  });

  afterEach(() => {
    activeFixture?.destroy();
    activeFixture = null;
    vi.restoreAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('debe iniciar en "catalog" cuando el proyecto entra vacío (sin piezas)', () => {
    const projectService = TestBed.inject(ProjectStorageService);
    projectService.clearFurniture();

    activeFixture = TestBed.createComponent(ModuleDesignerComponent);
    const comp = activeFixture.componentInstance;
    activeFixture.detectChanges();

    expect(comp.activeDockTab()).toBe('catalog');
  });

  it('debe iniciar en "catalog" sin pieza seleccionada cuando entra en modo "room"', () => {
    const projectService = TestBed.inject(ProjectStorageService);
    projectService.setWorkspaceMode('room');

    activeFixture = TestBed.createComponent(ModuleDesignerComponent);
    const comp = activeFixture.componentInstance;
    activeFixture.detectChanges();

    expect(comp.selectedPartId()).toBeNull();
    expect(comp.activeDockTab()).toBe('catalog');
  });

  it('ngOnInit debe corregir activeDockTab a "catalog" cuando no hay selección activa en sesión ya inicializada', () => {
    const projectService = TestBed.inject(ProjectStorageService);
    projectService.designerSessionInitialized.set(true);
    projectService.designerActiveDockTab.set('piece');
    projectService.designerSelectedPartId.set(null);
    projectService.designerSelectedPartIds.set([]);
    projectService.selectedApplianceId.set(null);
    projectService.selectedApplianceIds.set([]);
    projectService.selectedWallId.set(null);

    activeFixture = TestBed.createComponent(ModuleDesignerComponent);
    const comp = activeFixture.componentInstance;
    activeFixture.detectChanges();

    expect(comp.activeDockTab()).toBe('catalog');
  });
});
