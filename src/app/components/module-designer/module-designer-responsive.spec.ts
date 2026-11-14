import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ModuleDesignerComponent } from './module-designer';
import { Furniture3dViewerComponent } from '../furniture-3d-viewer/furniture-3d-viewer';
import { CutOptimizerViewComponent } from '../cut-optimizer-view/cut-optimizer-view';
import { PartsListComponent } from '../parts-list/parts-list';
import { BudgetViewComponent } from '../budget-view/budget-view';
import { LabelsViewComponent } from '../labels-view/labels-view';
import { ProjectStorageService } from '../../services/project-storage.service';
import { SupabaseService, SyncStatus } from '../../services/supabase.service';
import { ThemeService } from '../../services/theme.service';
import { I18nService } from '../../services/i18n.service';

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

function collectInjectedCssText(): string {
  return Array.from(document.head.querySelectorAll('style'))
    .map(styleEl => styleEl.textContent ?? '')
    .join('\n');
}

function findSpanWithClasses(root: Element, classes: string[]): HTMLSpanElement | undefined {
  return Array.from(root.querySelectorAll('span')).find(sp =>
    classes.every(cls => sp.classList.contains(cls))
  );
}

describe('ModuleDesigner & Studio Responsive Laptop Adaptability (FASE 2 y FASE 3)', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    vi.spyOn(
      Furniture3dViewerComponent.prototype as unknown as ViewerInitInternals,
      'initThree'
    ).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ModuleDesignerComponent: Sub-barra 3D (.md-top-bar), Altura <= 820px e Inspector', () => {
    let fixture: ComponentFixture<ModuleDesignerComponent>;
    let component: ModuleDesignerComponent;
    let hostEl: HTMLElement;
    let i18n: I18nService;

    beforeEach(async () => {
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

      fixture = TestBed.createComponent(ModuleDesignerComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      hostEl = fixture.nativeElement as HTMLElement;
    });

    afterEach(() => {
      fixture.destroy();
    });

    it('debe configurar .md-top-bar sin envolver ni recortar controles con respaldo scroll invisible', () => {
      const topBar = hostEl.querySelector('.md-top-bar') as HTMLElement | null;
      expect(topBar).toBeTruthy();

      const cls = topBar?.className ?? '';
      expect(cls).toContain('flex-nowrap');
      expect(cls).toContain('items-center');
      expect(cls).toContain('justify-between');
      expect(cls).toContain('overflow-x-auto');
      expect(cls).toContain('overflow-y-hidden');
      expect(cls).toContain('no-scrollbar');
    });

    it('debe ocultar la etiqueta redundante Modelador 3D por debajo de 2xl (1536px)', () => {
      const topBar = hostEl.querySelector('.md-top-bar') as HTMLElement;
      const modelerHeading = Array.from(topBar.querySelectorAll('div')).find(
        div =>
          div.classList.contains('2xl:flex') &&
          div.textContent?.includes(i18n.t('designer.modeler3d'))
      );

      expect(modelerHeading).toBeTruthy();
      expect(modelerHeading?.className).toContain('hidden');
      expect(modelerHeading?.className).toContain('2xl:flex');
      expect(modelerHeading?.className).toContain('shrink-0');
    });

    it('debe mantener visibles los 4 botones primarios de creación y compactar etiquetas bajo 2xl', () => {
      const topBar = hostEl.querySelector('.md-top-bar') as HTMLElement;
      const buttons = Array.from(topBar.querySelectorAll('button'));

      const findBtnByKey = (key: string) =>
        buttons.find(btn => btn.textContent?.includes(i18n.t(key)));

      const addModuleBtn = findBtnByKey('designer.addModule');
      const addCountertopBtn = findBtnByKey('designer.addCountertop');
      const addApplianceBtn = findBtnByKey('designer.addAppliance');
      const addFreeBoardBtn = findBtnByKey('designer.addFreeBoard');

      expect(addModuleBtn).toBeTruthy();
      expect(addCountertopBtn).toBeTruthy();
      expect(addApplianceBtn).toBeTruthy();
      expect(addFreeBoardBtn).toBeTruthy();

      for (const btn of [addModuleBtn, addCountertopBtn, addApplianceBtn, addFreeBoardBtn]) {
        expect(btn?.className).toContain('whitespace-nowrap');
        expect(btn?.className).toContain('shrink-0');
        expect(btn?.className).toContain('min-[1440px]:px-2.5');
      }

      const countertopLabel = Array.from(addCountertopBtn!.querySelectorAll('span')).find(sp =>
        sp.textContent?.includes(i18n.t('designer.addCountertop'))
      );
      expect(countertopLabel).toBeTruthy();
      expect(countertopLabel?.className).toContain('inline');
      expect(countertopLabel?.className).not.toContain('hidden');

      const applianceFullSpan = findSpanWithClasses(addApplianceBtn!, ['hidden', '2xl:inline']);
      const applianceShortSpan = findSpanWithClasses(addApplianceBtn!, ['2xl:hidden']);
      expect(applianceFullSpan?.textContent).toContain(i18n.t('designer.addAppliance'));
      expect(applianceShortSpan).toBeTruthy();

      const freeBoardFullSpan = findSpanWithClasses(addFreeBoardBtn!, ['hidden', '2xl:inline']);
      const freeBoardShortSpan = findSpanWithClasses(addFreeBoardBtn!, ['2xl:hidden']);
      expect(freeBoardFullSpan?.textContent).toContain(i18n.t('designer.addFreeBoard'));
      expect(freeBoardShortSpan).toBeTruthy();

      for (const envKey of [
        'designer.kitchens',
        'designer.closets',
        'designer.bathrooms',
        'designer.livingOffice'
      ]) {
        const envPill = findBtnByKey(envKey);
        expect(envPill).toBeTruthy();
        expect(envPill?.className).toContain('px-2');
        expect(envPill?.className).toContain('min-[1440px]:px-2.5');
        expect(envPill?.className).toContain('whitespace-nowrap');
        expect(envPill?.className).toContain('shrink-0');
      }
    });

    it('debe compactar el bloque derecho de .md-top-bar (Habitación 3D abreviado, 60 FPS y panel icono bajo 1480px)', () => {
      const topBar = hostEl.querySelector('.md-top-bar') as HTMLElement;
      const buttons = Array.from(topBar.querySelectorAll('button'));

      const roomBtn = buttons.find(btn => btn.textContent?.includes(i18n.t('designer.room3d')));
      expect(roomBtn).toBeTruthy();
      const roomFullSpan = findSpanWithClasses(roomBtn!, ['hidden', '2xl:inline']);
      const roomShortSpan = findSpanWithClasses(roomBtn!, ['2xl:hidden']);
      expect(roomFullSpan?.textContent).toContain(i18n.t('designer.room3d'));
      expect(roomShortSpan).toBeTruthy();

      const fpsBtn = buttons.find(btn => btn.textContent?.includes(i18n.t('designer.performance60fps')));
      expect(fpsBtn).toBeTruthy();
      const fpsLabel = Array.from(fpsBtn!.querySelectorAll('span')).find(sp =>
        sp.textContent?.includes(i18n.t('designer.performance60fps'))
      );
      expect(fpsLabel?.className).toContain('hidden');
      expect(fpsLabel?.className).toContain('min-[1480px]:inline');
      expect(fpsBtn?.getAttribute('title')).toBeTruthy();

      const togglePanelBtn = buttons.find(btn =>
        btn.textContent?.includes(i18n.t('designer.hide')) ||
        btn.textContent?.includes(i18n.t('designer.show'))
      );
      expect(togglePanelBtn).toBeTruthy();
      const panelLabel = Array.from(togglePanelBtn!.querySelectorAll('span')).find(sp =>
        sp.textContent?.includes(i18n.t('designer.hide')) ||
        sp.textContent?.includes(i18n.t('designer.show'))
      );
      expect(panelLabel?.className).toContain('hidden');
      expect(panelLabel?.className).toContain('min-[1480px]:inline');
      expect(togglePanelBtn?.getAttribute('title')).toBeTruthy();

      component.projectService.setWorkspaceMode('room');
      fixture.detectChanges();

      const envBtn = Array.from(topBar.querySelectorAll('button')).find(btn =>
        btn.textContent?.includes(i18n.t('designer.environment'))
      );
      expect(envBtn).toBeTruthy();
      expect(envBtn?.className).toContain('whitespace-nowrap');
      expect(envBtn?.className).toContain('shrink-0');
    });

    it('debe aplicar ancho progresivo y desplazamiento interno en las 3 pestañas del inspector derecho', () => {
      const inspector = hostEl.querySelector('.md-inspector-panel') as HTMLElement | null;
      expect(inspector).toBeTruthy();

      const cls = inspector?.className ?? '';
      expect(cls).toContain('lg:w-76');
      expect(cls).toContain('xl:w-80');
      expect(cls).toContain('2xl:w-92');
      expect(cls).toContain('min-[2200px]:w-104');
      expect(cls).toContain('h-full');
      expect(cls).toContain('max-h-full');
      expect(cls).toContain('min-h-0');
      expect(cls).toContain('overflow-hidden');

      for (const tab of ['piece', 'catalog', 'appliances'] as const) {
        component.activeDockTab.set(tab);
        fixture.detectChanges();
        const scrollBody = inspector!.querySelector('.flex-1.min-h-0.overflow-y-auto.scrollbar-thin');
        expect(scrollBody).toBeTruthy();
      }
    });

    it('debe incluir media query @media (max-height: 820px) y reglas anti-colisión en CSS compilado', () => {
      const css = collectInjectedCssText();

      expect(css).toContain('max-height: 820px');
      expect(css).toContain('.md-top-bar');
      expect(css).toMatch(/min-height:\s*38px/);
      expect(css).toContain('.md-chips-bar');
      expect(css).toContain('.cad-toolbar');
      expect(css).toMatch(/max-height:\s*calc\(100%\s*-\s*2\.5rem\)/);
      expect(css).toContain('overflow-y: auto');
      expect(css).toContain('.cad-collision-popover');
      expect(css).toContain('.cad-nudge-card');
    });

    it('debe configurar scroll vertical y offsets sin colisión en .cad-toolbar', () => {
      const cadToolbar = hostEl.querySelector('.cad-toolbar') as HTMLElement | null;
      expect(cadToolbar).toBeTruthy();
      const cls = cadToolbar?.className ?? '';
      expect(cls).toContain('max-h-[calc(100%-2.5rem)]');
      expect(cls).toContain('overflow-y-auto');
      expect(cls).toContain('overflow-x-hidden');
      expect(cls).toContain('scrollbar-none');
    });

    it('debe reservar espacio anti-colisión para la barra flotante al colapsar el panel derecho', () => {
      const parts = component.projectService.partsList();
      if (parts.length > 0) {
        component.selectedPartId.set(parts[0].id);
        component.selectedPartIds.set([parts[0].id]);
      }
      component.isSidebarCollapsed.set(true);
      fixture.detectChanges();

      if (parts.length > 0) {
        const floatingRight = hostEl.querySelector('.right-26') as HTMLElement | null;
        expect(floatingRight).toBeTruthy();
        expect(floatingRight?.className).toContain('max-w-[calc(100%-10.75rem)]');
      }
    });
  });

  describe('Vistas Secundarias: Encabezados con flex-wrap y sin desbordes a 1280px', () => {
    it('CutOptimizerViewComponent debe envolver encabezados y barras de controles con flex-wrap', async () => {
      await TestBed.resetTestingModule()
        .configureTestingModule({
          imports: [CutOptimizerViewComponent],
          providers: [
            { provide: SupabaseService, useValue: createMockSupabase() },
            ProjectStorageService,
            ThemeService
          ]
        })
        .compileComponents();

      const i18n = TestBed.inject(I18nService);
      i18n.setLanguage('es');

      const fixture = TestBed.createComponent(CutOptimizerViewComponent);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      const kpiBanner = el.querySelector('.optimizer-kpi-banner') as HTMLElement | null;
      expect(kpiBanner).toBeTruthy();
      expect(kpiBanner?.innerHTML).toContain('flex-wrap');
      expect(kpiBanner?.innerHTML).toContain('whitespace-nowrap');

      const algorithmBadge = Array.from(kpiBanner!.querySelectorAll('span')).find(sp =>
        sp.textContent?.includes(i18n.t('optimizer.algorithmActive'))
      );
      expect(algorithmBadge).toBeTruthy();
      expect(algorithmBadge?.className).toContain('font-sans');
      expect(algorithmBadge?.className).not.toContain('font-mono');

      fixture.destroy();
    });

    it('PartsListComponent debe envolver filtros y acciones en pantallas laptop', async () => {
      await TestBed.resetTestingModule()
        .configureTestingModule({
          imports: [PartsListComponent],
          providers: [
            { provide: SupabaseService, useValue: createMockSupabase() },
            ProjectStorageService,
            ThemeService
          ]
        })
        .compileComponents();

      const fixture = TestBed.createComponent(PartsListComponent);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      const headerBar = el.firstElementChild?.firstElementChild as HTMLElement | null;
      expect(headerBar).toBeTruthy();
      expect(el.innerHTML).toContain('flex-wrap');
      expect(el.innerHTML).toContain('whitespace-nowrap');

      fixture.destroy();
    });

    it('BudgetViewComponent debe envolver encabezados de sección y controles de moneda', async () => {
      await TestBed.resetTestingModule()
        .configureTestingModule({
          imports: [BudgetViewComponent],
          providers: [
            { provide: SupabaseService, useValue: createMockSupabase() },
            ProjectStorageService,
            ThemeService
          ]
        })
        .compileComponents();

      const fixture = TestBed.createComponent(BudgetViewComponent);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      const wrapHeaders = el.querySelectorAll('.flex-wrap');
      expect(wrapHeaders.length).toBeGreaterThanOrEqual(4);

      fixture.destroy();
    });

    it('LabelsViewComponent debe mantener botones y filtros sin recorte horizontal', async () => {
      await TestBed.resetTestingModule()
        .configureTestingModule({
          imports: [LabelsViewComponent],
          providers: [
            { provide: SupabaseService, useValue: createMockSupabase() },
            ProjectStorageService,
            ThemeService
          ]
        })
        .compileComponents();

      const fixture = TestBed.createComponent(LabelsViewComponent);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;

      expect(el.innerHTML).toContain('flex-wrap');
      expect(el.innerHTML).toContain('whitespace-nowrap');

      fixture.destroy();
    });
  });
});
