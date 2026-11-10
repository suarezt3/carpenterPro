import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { HeaderComponent } from './header';
import { SupabaseService, SyncStatus, UserProfile } from '../../services/supabase.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { I18nService } from '../../services/i18n.service';
import { ThemeService } from '../../services/theme.service';

describe('HeaderComponent — Milestone 4 (Studio Topbar Reorganization & Overlap Fixes)', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let component: HeaderComponent;
  let element: HTMLElement;
  let mockSupabase: {
    isAuthenticated: ReturnType<typeof signal<boolean>>;
    isAuthLoading: ReturnType<typeof signal<boolean>>;
    currentUser: ReturnType<typeof signal<User | null>>;
    userProfile: ReturnType<typeof signal<UserProfile | null>>;
    cloudProjects: ReturnType<typeof signal<unknown[]>>;
    syncStatus: ReturnType<typeof signal<SyncStatus>>;
    lastSyncTime: ReturnType<typeof signal<Date | null>>;
    signOut: ReturnType<typeof vi.fn>;
    updateUserProfile: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockSupabase = {
      isAuthenticated: signal(true),
      isAuthLoading: signal(false),
      currentUser: signal<User | null>({
        id: 'usr-eyder',
        email: 'eyder@carpenterpro.com',
        app_metadata: {},
        user_metadata: { first_name: 'Eyder' },
        aud: 'authenticated',
        created_at: new Date().toISOString()
      } as User),
      userProfile: signal<UserProfile | null>({
        id: 'usr-eyder',
        email: 'eyder@carpenterpro.com',
        first_name: 'Eyder',
        last_name: 'Gómez',
        role: 'user',
        plan: 'pro',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }),
      cloudProjects: signal([]),
      syncStatus: signal<SyncStatus>('idle'),
      lastSyncTime: signal<Date | null>(null),
      signOut: vi.fn().mockResolvedValue(undefined),
      updateUserProfile: vi.fn().mockResolvedValue({ success: true })
    };

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: mockSupabase },
        ProjectStorageService,
        I18nService,
        ThemeService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  describe('F1: Eliminación del botón < Inicio y fijación de logo', () => {
    it('no debe renderizar ningún botón o enlace "< Inicio"', () => {
      const allLinks = Array.from(element.querySelectorAll('a'));
      const inicioLink = allLinks.find(a =>
        a.textContent?.includes('Inicio') ||
        a.getAttribute('title')?.toLowerCase().includes('inicio')
      );
      expect(inicioLink).toBeFalsy();
    });

    it('el logo de Piezo3D Studio no debe navegar hacia landing ni tener routerLink="/"', () => {
      const brandLogo = element.querySelector('.w-7.h-7.rounded-md.bg-zinc-900');
      expect(brandLogo).toBeTruthy();
      expect(brandLogo?.tagName.toLowerCase()).not.toBe('a');
      expect(brandLogo?.getAttribute('routerLink')).toBeNull();
      expect(brandLogo?.getAttribute('href')).toBeNull();
    });
  });

  describe('F2: Pastilla v3.0.0 · Novedades compacta con whitespace-nowrap y shrink-0', () => {
    it('debe tener las clases whitespace-nowrap y shrink-0 en el botón de novedades', () => {
      const buttons = Array.from(element.querySelectorAll('button'));
      const changelogBtn = buttons.find(btn =>
        btn.textContent?.includes('v3.0.0') || btn.textContent?.includes('Novedades') || btn.textContent?.includes('Actual')
      );
      expect(changelogBtn).toBeTruthy();
      expect(changelogBtn?.className).toContain('whitespace-nowrap');
      expect(changelogBtn?.className).toContain('shrink-0');
    });
  });

  describe('F3: Contenedor del nombre de proyecto acotado', () => {
    it('debe contener min-w-[120px] max-w-[180px] 2xl:max-w-[230px] truncate shrink-0 para evitar solapamiento', () => {
      const titleContainer = element.querySelector('.relative.hidden.md\\:flex.items-center');
      expect(titleContainer).toBeTruthy();
      expect(titleContainer?.className).toContain('min-w-[120px]');
      expect(titleContainer?.className).toContain('max-w-[180px]');
      expect(titleContainer?.className).toContain('2xl:max-w-[230px]');
      expect(titleContainer?.className).toContain('truncate');
      expect(titleContainer?.className).toContain('shrink-0');
    });
  });

  describe('F4: Protección de las 5 pestañas centrales de navegación con shrink-0', () => {
    it('debe renderizar exactamente las 5 pestañas completas de manera incondicional', () => {
      const nav = element.querySelector('nav');
      expect(nav).toBeTruthy();
      expect(nav?.className).toContain('shrink-0');

      const tabs = Array.from(nav?.querySelectorAll('button') || []);
      expect(tabs.length).toBe(5);

      // Cada una de las 5 pestañas debe contar con shrink-0
      tabs.forEach(tab => {
        expect(tab.className).toContain('shrink-0');
      });
    });

    it('debe incluir la pestaña 5 (Etiquetas) fija', () => {
      const nav = element.querySelector('nav');
      const tabs = Array.from(nav?.querySelectorAll('button') || []);
      const labelsTab = tabs[4];
      expect(labelsTab).toBeTruthy();
      expect(labelsTab.textContent).toContain('Etiquetas');
    });
  });

  describe('F5: Eliminación del botón suelto de configuración (⚙️)', () => {
    it('no debe existir ningún botón suelto con openSettings() o engranaje en la barra de herramientas', () => {
      const rightZone = element.querySelector('.shrink-0.justify-end');
      expect(rightZone).toBeTruthy();

      // Debe haber botones de: tema, notas, dropdown proyecto, dropdown exportar, autosync, ayuda, idioma, usuario y cerrar sesión
      // Pero NO un botón suelto de configuración con icono de engranaje
      const allButtons = Array.from(rightZone?.querySelectorAll('button') || []);
      const settingsButton = allButtons.find(btn =>
        btn.getAttribute('title')?.toLowerCase().includes('ajustes') ||
        btn.getAttribute('title')?.toLowerCase().includes('parámetros')
      );
      expect(settingsButton).toBeFalsy();
    });
  });

  describe('F6: Botón Interactivo de Usuario y Centro de Configuración', () => {
    it('debe renderizar un botón interactivo con iniciales, nombre y chevron', () => {
      const userNameEl = element.querySelector('[data-testid="studio-user-name"]');
      expect(userNameEl).toBeTruthy();
      expect(userNameEl?.textContent?.trim()).toBe('Eyder');

      // El contenedor padre debe ser un botón interactivo con cursor-pointer y shrink-0
      const userButton = userNameEl?.closest('button');
      expect(userButton).toBeTruthy();
      expect(userButton?.className).toContain('shrink-0');
      expect(userButton?.className).toContain('cursor-pointer');
      expect(userButton?.className).toContain('whitespace-nowrap');

      // Iniciales calculadas EG
      expect(component.userInitials()).toBe('EG');
    });

    it('al hacer clic en el botón de usuario debe llamar a openAccountModal() y abrir el modal', () => {
      expect(component.isAccountModalOpen()).toBe(false);

      const userNameEl = element.querySelector('[data-testid="studio-user-name"]');
      const userButton = userNameEl?.closest('button') as HTMLButtonElement;
      userButton.click();
      fixture.detectChanges();

      expect(component.isAccountModalOpen()).toBe(true);
    });
  });

  describe('F7: Botón Minimalista Compacto de Cerrar Sesión', () => {
    it('debe tener dimensiones w-9 h-9, shrink-0 y selector data-testid="studio-signout-btn"', () => {
      const signOutBtn = element.querySelector('[data-testid="studio-signout-btn"]') as HTMLButtonElement;
      expect(signOutBtn).toBeTruthy();
      expect(signOutBtn.className).toContain('w-9');
      expect(signOutBtn.className).toContain('h-9');
      expect(signOutBtn.className).toContain('shrink-0');
    });

    it('NO debe contener texto visible "Cerrar Sesión"', () => {
      const signOutBtn = element.querySelector('[data-testid="studio-signout-btn"]') as HTMLButtonElement;
      expect(signOutBtn.textContent?.trim()).toBe('');
      expect(signOutBtn.getAttribute('title')).toBeTruthy();
    });

    it('al hacer clic debe invocar signOutFromStudio()', async () => {
      const router = TestBed.inject(Router);
      const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      const signOutBtn = element.querySelector('[data-testid="studio-signout-btn"]') as HTMLButtonElement;
      signOutBtn.click();
      await fixture.whenStable();

      expect(mockSupabase.signOut).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith('/');
    });
  });

  describe('Integración con AccountSettingsModalComponent', () => {
    it('debe renderizar el componente <app-account-settings-modal>', () => {
      const modal = element.querySelector('app-account-settings-modal');
      expect(modal).toBeTruthy();
    });

    it('openSettings() debe delegar a openAccountModal() por compatibilidad', () => {
      expect(component.isAccountModalOpen()).toBe(false);
      component.openSettings();
      expect(component.isAccountModalOpen()).toBe(true);
    });
  });

  describe('Desbloqueo de Menús Desplegables y Popovers del Header', () => {
    it('el contenedor principal del header debe tener overflow-visible para no recortar menús flotantes', () => {
      const mainContainer = element.querySelector('header > div');
      expect(mainContainer).toBeTruthy();
      expect(mainContainer?.className).toContain('overflow-visible');
      expect(mainContainer?.className).not.toContain('overflow-hidden');
    });

    it('al hacer clic en Exportar debe abrir el menú desplegable de exportación en el DOM', () => {
      expect(component.isExportDropdownOpen()).toBe(false);
      component.toggleExportDropdown();
      fixture.detectChanges();

      expect(component.isExportDropdownOpen()).toBe(true);
      // Debe haber opciones de exportación visibles en el DOM
      const exportOptions = element.querySelectorAll('[data-testid^="export-"], [title*="PDF"], [title*="DXF"], button');
      expect(exportOptions.length).toBeGreaterThan(0);
    });

    it('al hacer clic en Proyecto debe abrir el menú desplegable de proyecto', () => {
      expect(component.isProjectDropdownOpen()).toBe(false);
      component.toggleProjectDropdown();
      fixture.detectChanges();

      expect(component.isProjectDropdownOpen()).toBe(true);
    });

    it('al hacer clic en editar título debe abrir el popover interactivo con los campos de nombre y cliente', () => {
      expect(component.isEditingTitle()).toBe(false);
      component.startEditingTitle();
      fixture.detectChanges();

      expect(component.isEditingTitle()).toBe(true);
      const nameInput = element.querySelector('#proj-title-input');
      const clientInput = element.querySelector('#proj-client-input');
      expect(nameInput).toBeTruthy();
      expect(clientInput).toBeTruthy();
    });
  });
});
