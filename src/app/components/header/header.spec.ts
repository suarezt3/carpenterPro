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
    it('debe contener min-w-[84px] max-w-[108px] min-[1440px]:max-w-[125px] 2xl:max-w-[125px] min-[1840px]:max-w-[180px] truncate shrink-0 para evitar solapamiento', () => {
      const titleContainer = element.querySelector('.relative.hidden.md\\:flex.items-center');
      expect(titleContainer).toBeTruthy();
      expect(titleContainer?.className).toContain('min-w-[84px]');
      expect(titleContainer?.className).toContain('max-w-[108px]');
      expect(titleContainer?.className).toContain('min-[1440px]:max-w-[125px]');
      expect(titleContainer?.className).toContain('2xl:max-w-[125px]');
      expect(titleContainer?.className).toContain('min-[1840px]:max-w-[180px]');
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

    it('debe mostrar el botón Admin solo si el usuario es super_admin y navegar a /admin al hacer clic', () => {
      expect(element.querySelector('[data-testid="header-admin-btn"]')).toBeNull();

      mockSupabase.userProfile.set({
        id: 'usr-admin',
        email: 'admin@piezo3d.com',
        role: 'super_admin',
        plan: 'industrial'
      } as UserProfile);
      fixture.detectChanges();

      const adminBtn = element.querySelector('[data-testid="header-admin-btn"]') as HTMLButtonElement;
      expect(adminBtn).toBeTruthy();
      expect(adminBtn.className).toContain('w-7.5');
      expect(adminBtn.className).toContain('h-7.5');
      expect(adminBtn.className).toContain('min-[1840px]:w-8');
      expect(adminBtn.className).toContain('min-[1840px]:h-8');
      expect(adminBtn.className).toContain('shrink-0');
      expect(adminBtn.textContent?.trim()).toBe('');
      expect(adminBtn.getAttribute('title')).toBe('Panel Ejecutivo Superadmin');

      const router = TestBed.inject(Router);
      const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      adminBtn.click();
      expect(navSpy).toHaveBeenCalledWith('/admin');
    });

    it('debe habilitar isSuperAdmin y mostrar el botón Admin para ambos correos propietarios (eydersuarez900@gmail.com y piezo3dstudio@gmail.com)', () => {
      mockSupabase.userProfile.set({
        id: 'usr-owner-1',
        email: 'eydersuarez900@gmail.com',
        role: 'user',
        plan: 'free'
      } as UserProfile);
      mockSupabase.currentUser.set({
        id: 'usr-owner-1',
        email: 'eydersuarez900@gmail.com'
      } as User);
      fixture.detectChanges();
      expect(component.isSuperAdmin()).toBe(true);
      expect(element.querySelector('[data-testid="header-admin-btn"]')).toBeTruthy();

      mockSupabase.userProfile.set({
        id: 'usr-owner-2',
        email: 'piezo3dstudio@gmail.com',
        role: 'user',
        plan: 'free'
      } as UserProfile);
      mockSupabase.currentUser.set({
        id: 'usr-owner-2',
        email: '  Piezo3DStudio@GMAIL.com '
      } as User);
      fixture.detectChanges();
      expect(component.isSuperAdmin()).toBe(true);
      expect(element.querySelector('[data-testid="header-admin-btn"]')).toBeTruthy();
    });
  });

  describe('F7: Botón Minimalista Compacto de Cerrar Sesión', () => {
    it('debe tener dimensiones w-7.5 h-7.5 min-[1840px]:w-8 min-[1840px]:h-8, shrink-0 y selector data-testid="studio-signout-btn"', () => {
      const signOutBtn = element.querySelector('[data-testid="studio-signout-btn"]') as HTMLButtonElement;
      expect(signOutBtn).toBeTruthy();
      expect(signOutBtn.className).toContain('w-7.5');
      expect(signOutBtn.className).toContain('h-7.5');
      expect(signOutBtn.className).toContain('min-[1840px]:w-8');
      expect(signOutBtn.className).toContain('min-[1840px]:h-8');
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

  describe('AJUSTE 1: Sincronización Reactiva de Avatar en Header', () => {
    beforeEach(() => {
      window.localStorage.removeItem('carpenterpro_avatar_type');
      window.localStorage.removeItem('carpenterpro_avatar_color');
    });

    afterEach(() => {
      window.localStorage.removeItem('carpenterpro_avatar_type');
      window.localStorage.removeItem('carpenterpro_avatar_color');
    });

    it('debe actualizar reactivamente el color del avatar en el DOM al cambiar userProfile sin localStorage ni recarga', () => {
      const baseProfile = mockSupabase.userProfile()!;
      const userButton = element.querySelector('[data-testid="studio-user-name"]')?.closest('button') as HTMLButtonElement;
      expect(userButton).toBeTruthy();

      mockSupabase.userProfile.set({
        ...baseProfile,
        avatar_color: '#0284C7',
        avatar_mode: 'color'
      });
      fixture.detectChanges();

      expect(userButton.querySelector('img[alt="Avatar"]')).toBeNull();
      const skyCircle = userButton.querySelector('div.rounded-full') as HTMLElement;
      expect(skyCircle).toBeTruthy();
      expect(skyCircle.textContent?.trim()).toBe('EG');
      expect(skyCircle.className).toContain('bg-sky-600');
      expect(skyCircle.className).toContain('text-white');
      expect(component.userAvatarStyleColor()).toBeNull();
      expect(skyCircle.style.backgroundColor).toBe('');

      mockSupabase.userProfile.set({
        ...baseProfile,
        avatar_color: '#059669',
        avatar_mode: 'color'
      });
      fixture.detectChanges();

      const emeraldCircle = userButton.querySelector('div.rounded-full') as HTMLElement;
      expect(emeraldCircle).toBeTruthy();
      expect(emeraldCircle.className).toContain('bg-emerald-600');
      expect(emeraldCircle.className).not.toContain('bg-sky-600');
      expect(emeraldCircle.className).toContain('text-white');
      expect(component.userAvatarStyleColor()).toBeNull();
    });

    it('debe alternar reactivamente entre avatar_mode "google" y "color" ignorando localStorage obsoleto', () => {
      const baseProfile = mockSupabase.userProfile()!;
      const userButton = element.querySelector('[data-testid="studio-user-name"]')?.closest('button') as HTMLButtonElement;

      window.localStorage.setItem('carpenterpro_avatar_type', 'color');
      window.localStorage.setItem('carpenterpro_avatar_color', 'amber');

      mockSupabase.currentUser.set({
        ...mockSupabase.currentUser()!,
        user_metadata: {
          first_name: 'Eyder',
          avatar_url: 'https://lh3.googleusercontent.com/test-avatar.png'
        }
      } as User);
      mockSupabase.userProfile.set({
        ...baseProfile,
        avatar_color: '#0284C7',
        avatar_mode: 'google'
      });
      fixture.detectChanges();

      const avatarImg = userButton.querySelector('img[alt="Avatar"]') as HTMLImageElement;
      expect(avatarImg).toBeTruthy();
      expect(avatarImg.getAttribute('src')).toBe('https://lh3.googleusercontent.com/test-avatar.png');
      expect(userButton.querySelector('div.rounded-full')).toBeNull();

      mockSupabase.userProfile.set({
        ...baseProfile,
        avatar_color: '#0284C7',
        avatar_mode: 'color'
      });
      fixture.detectChanges();

      expect(userButton.querySelector('img[alt="Avatar"]')).toBeNull();
      const initialsCircle = userButton.querySelector('div.rounded-full') as HTMLElement;
      expect(initialsCircle).toBeTruthy();
      expect(initialsCircle.className).toContain('bg-sky-600');
      expect(initialsCircle.className).not.toContain('bg-amber-600');
    });

    it('debe soportar user_metadata.picture en avatar_mode "google" y caer a iniciales si no hay foto', () => {
      const baseProfile = mockSupabase.userProfile()!;
      const userButton = element.querySelector('[data-testid="studio-user-name"]')?.closest('button') as HTMLButtonElement;

      mockSupabase.currentUser.set({
        ...mockSupabase.currentUser()!,
        user_metadata: {
          first_name: 'Eyder',
          picture: 'https://example.com/picture-fallback.png'
        }
      } as User);
      mockSupabase.userProfile.set({
        ...baseProfile,
        avatar_color: '#18181B',
        avatar_mode: 'google'
      });
      fixture.detectChanges();

      const avatarImg = userButton.querySelector('img[alt="Avatar"]') as HTMLImageElement;
      expect(avatarImg).toBeTruthy();
      expect(avatarImg.getAttribute('src')).toBe('https://example.com/picture-fallback.png');

      mockSupabase.currentUser.set({
        ...mockSupabase.currentUser()!,
        user_metadata: { first_name: 'Eyder' }
      } as User);
      fixture.detectChanges();

      expect(userButton.querySelector('img[alt="Avatar"]')).toBeNull();
      expect(userButton.querySelector('div.rounded-full')).toBeTruthy();
    });

    it('debe aplicar [style.background-color] cuando avatar_color es un hex personalizado fuera de los 6 presets', () => {
      const baseProfile = mockSupabase.userProfile()!;
      const userButton = element.querySelector('[data-testid="studio-user-name"]')?.closest('button') as HTMLButtonElement;

      mockSupabase.userProfile.set({
        ...baseProfile,
        avatar_color: '#0e7490',
        avatar_mode: 'color'
      });
      fixture.detectChanges();

      const customCircle = userButton.querySelector('div.rounded-full') as HTMLElement;
      expect(customCircle).toBeTruthy();
      expect(component.userAvatarStyleColor()).toBe('#0E7490');
      expect(['rgb(14, 116, 144)', '#0e7490', '#0E7490']).toContain(customCircle.style.backgroundColor);
    });

    it('debe usar localStorage solo como respaldo cuando profile.avatar_mode o avatar_color es null/undefined', () => {
      const baseProfile = mockSupabase.userProfile()!;
      const userButton = element.querySelector('[data-testid="studio-user-name"]')?.closest('button') as HTMLButtonElement;

      window.localStorage.setItem('carpenterpro_avatar_type', 'color');
      window.localStorage.setItem('carpenterpro_avatar_color', 'emerald');

      mockSupabase.currentUser.set({
        ...mockSupabase.currentUser()!,
        user_metadata: {
          first_name: 'Eyder',
          avatar_url: 'https://lh3.googleusercontent.com/ignored-by-localstorage.png'
        }
      } as User);
      mockSupabase.userProfile.set({
        ...baseProfile,
        avatar_color: null,
        avatar_mode: null
      });
      fixture.detectChanges();

      expect(userButton.querySelector('img[alt="Avatar"]')).toBeNull();
      const fallbackCircle = userButton.querySelector('div.rounded-full') as HTMLElement;
      expect(fallbackCircle).toBeTruthy();
      expect(fallbackCircle.className).toContain('bg-emerald-600');
    });
  });

  describe('Fase 1 y Fase 3: Header responsivo para portátiles 14" (1280px–1920px)', () => {
    it('debe mantener overflow-visible en .header-main-bar y compacto h-11 2xl:h-12', () => {
      const mainBar = element.querySelector('.header-main-bar') as HTMLElement;
      expect(mainBar).toBeTruthy();
      expect(mainBar.className).toContain('h-11');
      expect(mainBar.className).toContain('2xl:h-12');
      expect(mainBar.className).toContain('overflow-visible');

      const headerWrapper = element.querySelector('header > div') as HTMLElement;
      expect(headerWrapper).toBeTruthy();
      expect(headerWrapper.className).toContain('overflow-visible');
    });

    it('debe ocultar Studio, separador y pastilla v3.0.0 por debajo de 2xl (1536px) manteniendo v3.0.0 en el DOM', () => {
      const spans = Array.from(element.querySelectorAll('header span'));
      const studioBadge = spans.find((el) => el.textContent?.trim() === 'Studio');
      const dotSeparator = spans.find((el) => el.textContent?.trim() === '·');
      const versionBtn = Array.from(element.querySelectorAll('header button')).find((btn) =>
        btn.textContent?.includes('v3.0.0')
      );

      expect(studioBadge).toBeTruthy();
      expect(studioBadge?.className).toContain('hidden');
      expect(studioBadge?.className).toContain('2xl:inline-block');

      expect(dotSeparator).toBeTruthy();
      expect(dotSeparator?.className).toContain('hidden');
      expect(dotSeparator?.className).toContain('2xl:inline');

      expect(versionBtn).toBeTruthy();
      expect(versionBtn?.className).toContain('hidden');
      expect(versionBtn?.className).toContain('2xl:inline-flex');
      expect(versionBtn?.className).toContain('whitespace-nowrap');
      expect(versionBtn?.className).toContain('shrink-0');
    });

    it('debe renderizar en <nav> las 5 pestañas con versión completa (hidden min-[1840px]:inline), compacta (min-[1840px]:hidden) y respaldo <1280px', () => {
      const nav = element.querySelector('header nav') as HTMLElement;
      expect(nav).toBeTruthy();
      expect(nav.className).toContain('min-[1280px]:shrink-0');
      expect(nav.className).toContain('max-[1279px]:min-w-0');
      expect(nav.className).toContain('max-[1279px]:shrink');
      expect(nav.className).toContain('max-[1279px]:overflow-x-auto');
      expect(nav.className).toContain('no-scrollbar');

      const navButtons = Array.from(nav.querySelectorAll('button'));
      expect(navButtons.length).toBe(5);

      const expectedCompactLabels = [
        'Diseñador 3D',
        'Despiece',
        'Optimizador',
        'Presupuesto',
        'Etiquetas',
      ];

      navButtons.forEach((btn, idx) => {
        expect(btn.className).toContain('px-1.5');
        expect(btn.className).toContain('py-1');
        expect(btn.className).toContain('min-[1440px]:px-2');
        expect(btn.className).toContain('min-[1840px]:px-2.5');
        expect(btn.className).toContain('min-[1840px]:py-1.5');
        expect(btn.className).toContain('text-[11px]');
        expect(btn.className).toContain('min-[1440px]:text-xs');
        expect(btn.className).toContain('shrink-0');

        const spansInBtn = Array.from(btn.querySelectorAll('span'));
        const fullLabel = spansInBtn.find(
          (s) => s.className.includes('hidden') && s.className.includes('min-[1840px]:inline')
        );
        const compactLabel = spansInBtn.find((s) => s.className.includes('min-[1840px]:hidden'));
        expect(fullLabel?.textContent?.trim()).toBeTruthy();
        expect(compactLabel?.textContent?.trim()).toBe(expectedCompactLabels[idx]);
      });
    });

    it('debe aplicar icon-only progresivo (Proyecto <2xl, Exportar/Login <1840px) con [title] y altura h-7.5 min-[1840px]:h-8 en bloque derecho', () => {
      const rightContainer = element.querySelector('.flex.items-center.gap-1.shrink-0.justify-end') as HTMLElement;
      expect(rightContainer).toBeTruthy();

      const buttons = Array.from(rightContainer.querySelectorAll('button'));
      const projectBtn = buttons.find((b) =>
        Array.from(b.querySelectorAll('span')).some(
          (s) =>
            s.className.includes('hidden') &&
            s.className.includes('2xl:inline') &&
            s.textContent?.trim() === 'Proyecto'
        )
      );
      const exportBtn = buttons.find((b) =>
        Array.from(b.querySelectorAll('span')).some(
          (s) =>
            s.className.includes('hidden') &&
            s.className.includes('min-[1840px]:inline') &&
            s.textContent?.trim() === 'Exportar'
        )
      );

      expect(projectBtn).toBeTruthy();
      expect(projectBtn?.className).toContain('h-7.5');
      expect(projectBtn?.className).toContain('min-[1840px]:h-8');
      expect(projectBtn?.getAttribute('title')).toBeTruthy();

      expect(exportBtn).toBeTruthy();
      expect(exportBtn?.className).toContain('h-7.5');
      expect(exportBtn?.className).toContain('min-[1840px]:h-8');
      expect(exportBtn?.getAttribute('title')).toBeTruthy();

      const userNameSpan = rightContainer.querySelector('[data-testid="studio-user-name"]') as HTMLElement;
      expect(userNameSpan).toBeTruthy();
      expect(userNameSpan.className).toContain('hidden');
      expect(userNameSpan.className).toContain('2xl:inline');
      expect(userNameSpan.className).toContain('max-w-16');
      expect(userNameSpan.className).toContain('min-[1840px]:max-w-20');
      expect(userNameSpan.className).toContain('truncate');

      const userAccountBtn = userNameSpan.closest('button') as HTMLButtonElement;
      expect(userAccountBtn).toBeTruthy();
      expect(userAccountBtn.className).toContain('h-7.5');
      expect(userAccountBtn.className).toContain('min-[1840px]:h-8');
      expect(userAccountBtn.getAttribute('title')).toBe(userNameSpan.textContent?.trim());

      mockSupabase.isAuthenticated.set(false);
      fixture.detectChanges();

      const loginLink = rightContainer.querySelector('[data-testid="studio-login-link"]') as HTMLAnchorElement;
      expect(loginLink).toBeTruthy();
      expect(loginLink.className).toContain('h-7.5');
      expect(loginLink.className).toContain('min-[1840px]:h-8');
      expect(loginLink.getAttribute('title')).toBeTruthy();
      const loginLabel = Array.from(loginLink.querySelectorAll('span')).find(
        (s) => s.className.includes('hidden') && s.className.includes('min-[1840px]:inline')
      );
      expect(loginLabel?.textContent?.trim()).toBeTruthy();
    });

    it('debe incluir límites seguros de viewport (max-w y max-h overflow-y-auto) en popovers/dropdowns del header', () => {
      const titleTriggerBtn = element.querySelector('.header-title-trigger button') as HTMLButtonElement;
      expect(titleTriggerBtn).toBeTruthy();
      titleTriggerBtn.click();
      fixture.detectChanges();

      const titlePopover = Array.from(element.querySelectorAll('.header-title-trigger div')).find(
        (d) =>
          d.querySelector('input') !== null &&
          d.className.includes('max-w-[calc(100vw-1rem)]')
      ) as HTMLElement;
      expect(titlePopover).toBeTruthy();
      expect(titlePopover.className).toContain('max-w-[calc(100vw-1rem)]');
      expect(titlePopover.className).toContain('max-h-[calc(100vh-4.5rem)]');
      expect(titlePopover.className).toContain('overflow-y-auto');

      const rightContainer = element.querySelector('.flex.items-center.gap-1.shrink-0.justify-end') as HTMLElement;
      const rightButtons = Array.from(rightContainer.querySelectorAll('button'));

      const projectBtn = rightButtons.find((b) =>
        Array.from(b.querySelectorAll('span')).some(
          (s) =>
            s.className.includes('hidden') &&
            s.className.includes('2xl:inline') &&
            s.textContent?.trim() === 'Proyecto'
        )
      ) as HTMLButtonElement;
      projectBtn.click();
      fixture.detectChanges();

      const projectDropdown = rightContainer.querySelector('[class*="max-w-[calc(100vw-1rem)]"][class*="max-h-[calc(100vh-4.5rem)]"]') as HTMLElement;
      expect(projectDropdown).toBeTruthy();
      expect(projectDropdown.className).toContain('overflow-y-auto');
      projectBtn.click();
      fixture.detectChanges();

      const exportBtn = rightButtons.find((b) =>
        Array.from(b.querySelectorAll('span')).some(
          (s) =>
            s.className.includes('hidden') &&
            s.className.includes('min-[1840px]:inline') &&
            s.textContent?.trim() === 'Exportar'
        )
      ) as HTMLButtonElement;
      exportBtn.click();
      fixture.detectChanges();

      const exportDropdown = rightContainer.querySelector('[class*="max-w-[calc(100vw-1rem)]"][class*="max-h-[calc(100vh-4.5rem)]"]') as HTMLElement;
      expect(exportDropdown).toBeTruthy();
      expect(exportDropdown.className).toContain('overflow-y-auto');
      exportBtn.click();
      fixture.detectChanges();

      const langBtn = rightButtons.find((b) => b.textContent?.trim() === 'ES') as HTMLButtonElement;
      expect(langBtn).toBeTruthy();
      langBtn.click();
      fixture.detectChanges();

      const langDropdown = rightContainer.querySelector('[class*="max-w-[calc(100vw-1rem)]"][class*="max-h-[calc(100vh-4.5rem)]"]') as HTMLElement;
      expect(langDropdown).toBeTruthy();
      expect(langDropdown.className).toContain('overflow-y-auto');
    });

    it('debe incluir @media (max-height: 820px) a 44px y regla .header-title-trigger.overflow-visible en los estilos compilados', () => {
      const stylesText = Array.from(document.head.querySelectorAll('style'))
        .map((styleEl) => styleEl.textContent ?? '')
        .join('\n');

      expect(stylesText).toContain('.header-title-trigger.overflow-visible');
      expect(stylesText).toMatch(/overflow:\s*visible/);
      expect(stylesText).toMatch(/@media\s*\(\s*max-height:\s*820px\s*\)/);
      expect(stylesText).toContain('.header-main-bar');
      expect(stylesText).toMatch(/min-height:\s*44px/);
      expect(stylesText).toMatch(/height:\s*44px/);
    });
  });
});
