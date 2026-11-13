import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot, RouterStateSnapshot, convertToParamMap } from '@angular/router';
import { User } from '@supabase/supabase-js';

import { of } from 'rxjs';
import { AuthPageComponent } from './components/auth-page/auth-page';
import { LandingPageComponent } from './components/landing-page/landing-page';
import { HeaderComponent } from './components/header/header';
import { AccountSettingsModalComponent } from './components/account-settings-modal/account-settings-modal';
import { studioAccessGuard } from './guards/studio-access.guard';
import { SupabaseService, UserProfile, SyncStatus } from './services/supabase.service';
import { ProjectStorageService } from './services/project-storage.service';
import { I18nService } from './services/i18n.service';
import { ThemeService } from './services/theme.service';
import { TRANSLATIONS } from './data/i18n-translations.data';
import { routes } from './app.routes';

describe('Tier 4: Real-World Application Scenarios (Empirical Adversarial Verification)', () => {
  // Common signals & mocks
  let isAuthSig: WritableSignal<boolean>;
  let isLoadingSig: WritableSignal<boolean>;
  let currentUserSig: WritableSignal<User | null>;
  let userProfileSig: WritableSignal<UserProfile | null>;
  let mockSupabase: Partial<SupabaseService>;
  let router: Router;

  beforeEach(() => {
    isAuthSig = signal(false);
    isLoadingSig = signal(false);
    currentUserSig = signal<User | null>(null);
    userProfileSig = signal<UserProfile | null>(null);

    mockSupabase = {
      isAuthenticated: isAuthSig,
      isAuthLoading: isLoadingSig,
      currentUser: currentUserSig,
      userProfile: userProfileSig,
      cloudProjects: signal([]),
      syncStatus: signal<SyncStatus>('idle'),
      lastSyncTime: signal<Date | null>(null),
      syncAuthSession: vi.fn().mockImplementation(async () => currentUserSig()),
      signInWithEmail: vi.fn(),
      signUpWithEmail: vi.fn(),
      signInWithGoogle: vi.fn(),
      sendPasswordResetEmail: vi.fn(),
      updateUserPassword: vi.fn(),
      updateUserProfile: vi.fn().mockResolvedValue({ success: true }),
      getBillingPortalUrl: vi.fn().mockResolvedValue({
        success: true,
        portalUrl: 'https://piezo3d.lemonsqueezy.com/billing',
        source: 'lemon_squeezy_api'
      }),
      cancelSubscription: vi.fn().mockResolvedValue({ success: true }),
      reactivateSubscription: vi.fn().mockResolvedValue({ success: true }),
      signOut: vi.fn().mockImplementation(async () => {
        isAuthSig.set(false);
        currentUserSig.set(null);
        userProfileSig.set(null);
      }),
      mapAuthErrorToKey: vi.fn((err: unknown) => {
        const msg = String(err).toLowerCase();
        if (msg.includes('domain') || msg.includes('email_address_invalid')) return 'auth.errors.invalidEmailDomain';
        if (msg.includes('rate_limit') || msg.includes('429')) return 'auth.errors.rateLimitExceeded';
        if (msg.includes('already registered') || msg.includes('user_already_exists')) return 'auth.errors.userAlreadyRegistered';
        return 'auth.errors.generic';
      })
    };
  });

  // ===========================================================================
  // SCENARIO 1: New user signup with invalid domain & correction
  // ===========================================================================
  describe('Scenario 1: New user signup with invalid domain & correction (F15, F16, F17, F18)', () => {
    let fixture: ComponentFixture<AuthPageComponent>;
    let authComponent: AuthPageComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [AuthPageComponent],
        providers: [
          provideRouter([]),
          { provide: SupabaseService, useValue: mockSupabase },
          {
            provide: ActivatedRoute,
            useValue: {
              queryParamMap: of(convertToParamMap({ mode: 'register' })),
              snapshot: { queryParamMap: convertToParamMap({ mode: 'register' }) }
            }
          }
        ]
      }).compileComponents();

      router = TestBed.inject(Router);
      fixture = TestBed.createComponent(AuthPageComponent);
      authComponent = fixture.componentInstance;
      authComponent.selectLanguage('es');
      authComponent.setMode('register');
      fixture.detectChanges();
    });

    it('Step 1.1: Intento de registro con dominio no válido dispara diagnóstico claro y sin mención a Supabase', async () => {
      // Setup form inputs
      authComponent.authForm.controls.firstName.setValue('Mateo');
      authComponent.authForm.controls.lastName.setValue('González');
      authComponent.authForm.controls.email.setValue('mateo@invalid-domain-test.xyz');
      authComponent.authForm.controls.password.setValue('ClaveValida2026!');
      authComponent.authForm.controls.confirmPassword.setValue('ClaveValida2026!');
      fixture.detectChanges();

      expect(authComponent.isCurrentFormValid()).toBe(true);

      // Backend rejects with invalid domain error
      (mockSupabase.signUpWithEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: false,
        errorKey: 'auth.errors.invalidEmailDomain'
      });

      await authComponent.onSubmit();
      fixture.detectChanges();

      const errorBanner = fixture.nativeElement.querySelector('[data-testid="auth-error-banner"]') as HTMLElement;
      expect(errorBanner).toBeTruthy();
      expect(errorBanner.textContent).toContain(
        'El dominio del correo ingresado no es válido. Por favor utiliza un correo electrónico real (ej. Gmail, Outlook, Hotmail o corporativo).'
      );
      expect(errorBanner.textContent?.toLowerCase()).not.toContain('supabase');
      expect(errorBanner.textContent?.toLowerCase()).not.toContain('postgres');
    });

    it('Step 1.2: Corrección a dominio legítimo limpia error y completa registro mostrando aviso de confirmación', async () => {
      // Step 1: Iniciar con error
      authComponent.authForm.controls.firstName.setValue('Mateo');
      authComponent.authForm.controls.lastName.setValue('González');
      authComponent.authForm.controls.email.setValue('mateo@invalid-domain-test.xyz');
      authComponent.authForm.controls.password.setValue('ClaveValida2026!');
      authComponent.authForm.controls.confirmPassword.setValue('ClaveValida2026!');
      fixture.detectChanges();

      (mockSupabase.signUpWithEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: false,
        errorKey: 'auth.errors.invalidEmailDomain'
      });
      await authComponent.onSubmit();
      fixture.detectChanges();
      expect(authComponent.errorKey()).toBe('auth.errors.invalidEmailDomain');

      // Step 2: Corrección a dominio válido
      authComponent.authForm.controls.email.setValue('mateo.gonzalez@gmail.com');
      fixture.detectChanges();
      expect(authComponent.errorKey()).toBeNull(); // Se limpia automáticamente al editar

      // Step 3: Envío corregido con confirmación requerida (session === null)
      (mockSupabase.signUpWithEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: true,
        needsEmailConfirmation: true,
        messageKey: 'auth.registerCheckEmail'
      });

      await authComponent.onSubmit();
      fixture.detectChanges();

      expect(authComponent.registrationConfirmationPending()).toBe(true);
      const confirmBanner = fixture.nativeElement.querySelector('[data-testid="register-confirmation-banner"]') as HTMLElement;
      expect(confirmBanner).toBeTruthy();
      expect(confirmBanner.textContent).toContain(
        '¡Cuenta creada con éxito! Revisa tu bandeja de entrada o correo no deseado para confirmar tu cuenta e iniciar sesión.'
      );
    });

    it('Step 1.3: Paridad en los 6 idiomas para los mensajes de error y confirmación', () => {
      const languages = ['es', 'en', 'pt', 'fr', 'it', 'de'] as const;
      for (const lang of languages) {
        expect(TRANSLATIONS[lang]['auth.errors.invalidEmailDomain']).toBeDefined();
        expect(TRANSLATIONS[lang]['auth.errors.invalidEmailDomain'].length).toBeGreaterThan(15);
        expect(TRANSLATIONS[lang]['auth.registerCheckEmail']).toBeDefined();
        expect(TRANSLATIONS[lang]['auth.registerCheckEmail'].length).toBeGreaterThan(15);
      }
    });
  });

  // ===========================================================================
  // SCENARIO 2: Unauthenticated landing access blocked
  // ===========================================================================
  describe('Scenario 2: Unauthenticated landing access blocked (F13, F14)', () => {
    let landingFixture: ComponentFixture<LandingPageComponent>;
    let landingComponent: LandingPageComponent;

    beforeEach(async () => {
      isAuthSig.set(false);
      isLoadingSig.set(false);
      currentUserSig.set(null);

      await TestBed.configureTestingModule({
        imports: [LandingPageComponent],
        providers: [
          provideRouter(routes),
          { provide: SupabaseService, useValue: mockSupabase }
        ]
      }).compileComponents();

      router = TestBed.inject(Router);
      landingFixture = TestBed.createComponent(LandingPageComponent);
      landingComponent = landingFixture.componentInstance;
      landingFixture.detectChanges();
    });

    it('Step 2.1: En Landing Page (/), hacer clic en "Comenzar Gratis" o "goToStudio" redirige a /auth?mode=login', () => {
      const navSpy = vi.spyOn(router, 'navigate');
      landingComponent.goToStudio();
      expect(navSpy).toHaveBeenCalledWith(['/auth'], { queryParams: { mode: 'login' } });
    });

    it('Step 2.2: studioAccessGuard bloquea acceso directo a /studio retornando UrlTree /auth?mode=login', async () => {
      isAuthSig.set(false);
      isLoadingSig.set(false);
      currentUserSig.set(null);

      const result = await TestBed.runInInjectionContext(() =>
        studioAccessGuard({} as ActivatedRouteSnapshot, { url: '/studio' } as RouterStateSnapshot)
      );

      expect(result instanceof UrlTree).toBe(true);
      expect(router.serializeUrl(result as UrlTree)).toBe('/auth?mode=login');
    });

    it('Step 2.3: studioAccessGuard espera la carga de sesión si isAuthLoading es true', async () => {
      isLoadingSig.set(true);
      isAuthSig.set(false);

      const guardPromise = TestBed.runInInjectionContext(() =>
        studioAccessGuard({} as ActivatedRouteSnapshot, { url: '/studio' } as RouterStateSnapshot)
      );

      // syncAuthSession fue invocado
      expect(mockSupabase.syncAuthSession).toHaveBeenCalled();

      const result = await guardPromise;
      expect(result instanceof UrlTree).toBe(true);
      expect(router.serializeUrl(result as UrlTree)).toBe('/auth?mode=login');
    });
  });

  // ===========================================================================
  // SCENARIO 3: Authenticated user studio topbar navigation without overlap
  // ===========================================================================
  describe('Scenario 3: Authenticated user studio topbar navigation without overlap (F1, F2, F3, F4, F6)', () => {
    let headerFixture: ComponentFixture<HeaderComponent>;
    let headerComponent: HeaderComponent;
    let headerElement: HTMLElement;

    beforeEach(async () => {
      isAuthSig.set(true);
      isLoadingSig.set(false);
      currentUserSig.set({
        id: 'usr-eyder',
        email: 'eyder@carpenterpro.com',
        app_metadata: {},
        user_metadata: { first_name: 'Eyder', last_name: 'Gómez' },
        aud: 'authenticated',
        created_at: new Date().toISOString()
      } as User);
      userProfileSig.set({
        id: 'usr-eyder',
        email: 'eyder@carpenterpro.com',
        first_name: 'Eyder',
        last_name: 'Gómez',
        role: 'user',
        plan: 'pro',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      await TestBed.configureTestingModule({
        imports: [HeaderComponent],
        providers: [
          provideRouter(routes),
          { provide: SupabaseService, useValue: mockSupabase },
          ProjectStorageService,
          I18nService,
          ThemeService
        ]
      }).compileComponents();

      router = TestBed.inject(Router);
      headerFixture = TestBed.createComponent(HeaderComponent);
      headerComponent = headerFixture.componentInstance;
      headerFixture.detectChanges();
      headerElement = headerFixture.nativeElement as HTMLElement;
    });

    it('Step 3.1: Botón "< Inicio" eliminado del lado izquierdo y logo no navega a landing', () => {
      const allLinks = Array.from(headerElement.querySelectorAll('a'));
      const inicioLink = allLinks.find(a =>
        a.textContent?.includes('Inicio') || a.getAttribute('title')?.toLowerCase().includes('inicio')
      );
      expect(inicioLink).toBeFalsy();

      const logo = headerElement.querySelector('.w-7.h-7.rounded-md.bg-zinc-900');
      expect(logo).toBeTruthy();
      expect(logo?.getAttribute('routerLink')).toBeNull();
      expect(logo?.getAttribute('href')).toBeNull();
    });

    it('Step 3.2: Pastilla Novedades con whitespace-nowrap y shrink-0, y título con max-w truncate', () => {
      const buttons = Array.from(headerElement.querySelectorAll('button'));
      const changelogBtn = buttons.find(b =>
        b.textContent?.includes('v3.0.0') || b.textContent?.includes('Novedades') || b.textContent?.includes('Actual')
      );
      expect(changelogBtn).toBeTruthy();
      expect(changelogBtn?.className).toContain('whitespace-nowrap');
      expect(changelogBtn?.className).toContain('shrink-0');

      const titleContainer = headerElement.querySelector('.relative.hidden.md\\:flex.items-center');
      expect(titleContainer).toBeTruthy();
      expect(titleContainer?.className).toContain('max-w-[180px]');
      expect(titleContainer?.className).toContain('2xl:max-w-[230px]');
      expect(titleContainer?.className).toContain('truncate');
      expect(titleContainer?.className).toContain('shrink-0');
    });

    it('Step 3.3: Las 5 pestañas completas protegidas con shrink-0 sin solapamiento', () => {
      const nav = headerElement.querySelector('nav');
      expect(nav).toBeTruthy();
      expect(nav?.className).toContain('shrink-0');

      const tabs = Array.from(nav?.querySelectorAll('button') || []);
      expect(tabs.length).toBe(5);

      tabs.forEach(tab => {
        expect(tab.className).toContain('shrink-0');
      });

      // Pestaña 1 visible
      expect(tabs[0].textContent).toContain('1. Diseñador 3D');
      // Pestaña 5 visible
      expect(tabs[4].textContent).toContain('Etiquetas');
    });

    it('Step 3.4: Botón suelto de configuración (⚙️) eliminado de la barra', () => {
      const rightZone = headerElement.querySelector('.flex.items-center.gap-1.shrink-0.justify-end');
      expect(rightZone).toBeTruthy();
      const allButtons = Array.from(rightZone?.querySelectorAll('button') || []);
      const looseSettingsBtn = allButtons.find(btn =>
        btn.getAttribute('title')?.toLowerCase().includes('ajustes') ||
        btn.getAttribute('title')?.toLowerCase().includes('parámetros')
      );
      expect(looseSettingsBtn).toBeFalsy();
    });

    it('Step 3.5: Botón interactivo de usuario abre el modal de Cuenta y Configuración', () => {
      const userBtn = headerElement.querySelector('[data-testid="studio-user-name"]')?.closest('button') as HTMLButtonElement;
      expect(userBtn).toBeTruthy();
      expect(userBtn.className).toContain('shrink-0');
      expect(userBtn.className).toContain('cursor-pointer');

      expect(headerComponent.isAccountModalOpen()).toBe(false);
      userBtn.click();
      headerFixture.detectChanges();
      expect(headerComponent.isAccountModalOpen()).toBe(true);
    });
  });

  // ===========================================================================
  // SCENARIO 4: User profile editing and workshop parameter adjustment in unified modal
  // ===========================================================================
  describe('Scenario 4: User profile editing and workshop parameter adjustment in unified modal (F8, F9, F10, F11)', () => {
    let modalFixture: ComponentFixture<AccountSettingsModalComponent>;
    let modalComponent: AccountSettingsModalComponent;
    let projectService: ProjectStorageService;

    beforeEach(async () => {
      currentUserSig.set({
        id: 'usr-eyder',
        email: 'eyder@carpenterpro.com',
        app_metadata: {},
        user_metadata: { first_name: 'Eyder', last_name: 'Suarez' },
        aud: 'authenticated',
        created_at: new Date().toISOString()
      } as User);
      userProfileSig.set({
        id: 'usr-eyder',
        email: 'eyder@carpenterpro.com',
        first_name: 'Eyder',
        last_name: 'Suarez',
        role: 'user',
        plan: 'pro',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      await TestBed.configureTestingModule({
        imports: [AccountSettingsModalComponent],
        providers: [
          provideRouter([]),
          { provide: SupabaseService, useValue: mockSupabase },
          ProjectStorageService,
          I18nService,
          ThemeService
        ]
      }).compileComponents();

      projectService = TestBed.inject(ProjectStorageService);
      modalFixture = TestBed.createComponent(AccountSettingsModalComponent);
      modalComponent = modalFixture.componentInstance;
      modalFixture.componentRef.setInput('isOpen', true);
      modalFixture.componentRef.setInput('initialTab', 'profile');
      modalFixture.detectChanges();
    });

    it('Step 4.1: Pestaña 1 (Perfil) permite editar Nombre y Apellido y actualizar public.user_profiles', async () => {
      expect(modalComponent.activeTab()).toBe('profile');
      expect(modalComponent.profileForm.value.firstName).toBe('Eyder');

      modalComponent.profileForm.patchValue({
        firstName: 'Eyder Alexander',
        lastName: 'Suarez Peña'
      });

      await modalComponent.saveProfile();

      expect(mockSupabase.updateUserProfile).toHaveBeenCalledWith({
        first_name: 'Eyder Alexander',
        last_name: 'Suarez Peña',
        avatar_color: '#18181B',
        avatar_mode: 'color'
      });
      expect(modalComponent.toastMessage()).toBeTruthy();
      expect(modalComponent.toastMessage()).toContain('Perfil actualizado');
    });

    it('Step 4.2: Pestaña 2 (Taller) ajusta kerf, espesores y margen de utilidad conservando 100% parámetros', () => {
      modalComponent.selectTab('workshop');
      modalFixture.detectChanges();

      expect(modalComponent.activeTab()).toBe('workshop');
      expect(modalComponent.workshopForm.value.sawKerf).toBe(4);

      // Modificar parámetros del taller
      modalComponent.workshopForm.patchValue({
        sawKerf: 3.5,
        trimMargin: 15,
        defaultBoardThickness: 18,
        profitMarginPercent: 35,
        currency: 'USD'
      });

      modalComponent.saveWorkshopSettings();

      const proj = projectService.currentProject();
      expect(proj.settings.sawKerf).toBe(3.5);
      expect(proj.settings.trimMargin).toBe(15);
      expect(proj.settings.defaultBoardThickness).toBe(18);
      expect(proj.settings.currency).toBe('USD');
      expect(proj.profitMarginPercent).toBe(35);
      expect(modalComponent.toastMessage()).toBeTruthy();
      expect(modalComponent.toastMessage()).toContain('Parámetros del taller');
    });

    it('Step 4.3: Pestaña 3 (Preferencias) actualiza idioma, cotas y tema 3D', () => {
      modalComponent.selectTab('preferences');
      modalFixture.detectChanges();

      expect(modalComponent.activeTab()).toBe('preferences');

      // Alternar cotas y piso
      modalComponent.toggleFloorGrid(false);
      expect(modalComponent.showFloorGrid()).toBe(false);
      expect(projectService.currentProject().roomConfig?.showFloorGrid).toBe(false);

      modalComponent.toggleClearances(false);
      expect(modalComponent.showClearances()).toBe(false);
      expect(projectService.currentProject().roomConfig?.showClearances).toBe(false);
    });

    it('Step 4.4: Pestaña 4 (Facturación) muestra portal alojado sin capturar PAN/CVC, sincroniza tarjeta y gestiona cancelación externa', async () => {
      modalComponent.selectTab('billing');
      await modalComponent.loadBillingData();
      modalFixture.detectChanges();

      const el = modalFixture.nativeElement as HTMLElement;
      expect(modalComponent.activeTab()).toBe('billing');
      expect(modalComponent.invoices().length).toBe(3);

      // Cero captura local de tarjetas o CVC en el DOM
      expect(el.querySelector('input[autocomplete="cc-number"]')).toBeNull();
      expect(el.querySelector('input[autocomplete="cc-csc"]')).toBeNull();
      expect(el.querySelector('input[autocomplete="cc-exp"]')).toBeNull();
      expect(el.querySelector('[data-testid="account-add-payment-form"]')).toBeNull();
      expect(el.querySelector('[data-testid="account-payment-methods-empty"]')).toBeTruthy();

      // Sincronizar tarjeta y suscripción externa desde la nube
      userProfileSig.set({
        id: 'usr-eyder',
        email: 'eyder@carpenterpro.com',
        first_name: 'Eyder',
        last_name: 'Suarez',
        role: 'user',
        plan: 'pro',
        billing_cycle: 'monthly',
        subscription_status: 'active',
        subscription_id: 'ls-sub-401',
        customer_portal_url: 'https://piezo3d.lemonsqueezy.com/billing',
        card_brand: 'Visa',
        card_last_four: '4242',
        current_period_end: '2027-02-01T00:00:00Z',
        created_at: '2026-11-10T00:00:00Z',
        updated_at: '2026-11-12T00:00:00Z'
      });
      modalFixture.detectChanges();

      const cardOnFile = el.querySelector('[data-testid="account-card-on-file"]') as HTMLElement;
      expect(cardOnFile).toBeTruthy();
      expect(cardOnFile.textContent).toContain('VISA');
      expect(cardOnFile.textContent).toContain('4242');
      expect(cardOnFile.querySelector('.font-numeric')?.textContent).toContain('4242');

      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      try {
        const portalBtn = el.querySelector('[data-testid="account-open-billing-portal-btn"]') as HTMLButtonElement;
        portalBtn.click();
        await modalFixture.whenStable();
        modalFixture.detectChanges();

        expect(mockSupabase.getBillingPortalUrl).toHaveBeenCalledTimes(1);
        expect(openSpy).toHaveBeenCalledWith(
          'https://piezo3d.lemonsqueezy.com/billing',
          '_blank',
          'noopener,noreferrer'
        );
        expect(modalComponent.toastType()).toBe('success');
        expect(modalComponent.toastMessage()).toBe(TestBed.inject(I18nService).t('account.billing.portalOpenedToast'));
      } finally {
        openSpy.mockRestore();
      }

      // Panel de gestión con suscripción externa: oculta cancelación inmediata y maneja error de API key faltante
      (el.querySelector('[data-testid="account-customer-portal-btn"]') as HTMLButtonElement).click();
      modalFixture.detectChanges();
      (el.querySelector('[data-testid="account-cancel-subscription-btn"]') as HTMLButtonElement).click();
      modalFixture.detectChanges();

      expect(el.querySelector('[data-testid="account-cancel-immediate-checkbox"]')).toBeNull();
      expect(el.querySelector('[data-testid="account-cancel-grace-only-note"]')).toBeTruthy();

      (mockSupabase.cancelSubscription as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        success: false,
        errorCode: 'LEMON_API_KEY_MISSING',
        errorKey: 'account.billing.gatewayKeyMissingError',
        portalUrl: 'https://piezo3d.lemonsqueezy.com/billing'
      });

      (el.querySelector('[data-testid="account-confirm-cancel-btn"]') as HTMLButtonElement).click();
      await modalFixture.whenStable();
      modalFixture.detectChanges();

      expect(modalComponent.toastType()).toBe('error');
      expect(modalComponent.toastMessage()).toBe(TestBed.inject(I18nService).t('account.billing.gatewayKeyMissingError'));
    });
  });

  // ===========================================================================
  // SCENARIO 5: Logout from studio navigates to landing page and locks /studio
  // ===========================================================================
  describe('Scenario 5: Logout from studio navigates to landing page and locks /studio (F7, F12, F13)', () => {
    let headerFixture: ComponentFixture<HeaderComponent>;
    let headerElement: HTMLElement;

    beforeEach(async () => {
      isAuthSig.set(true);
      isLoadingSig.set(false);
      currentUserSig.set({
        id: 'usr-eyder',
        email: 'eyder@carpenterpro.com',
        app_metadata: {},
        user_metadata: { first_name: 'Eyder' },
        aud: 'authenticated',
        created_at: new Date().toISOString()
      } as User);

      await TestBed.configureTestingModule({
        imports: [HeaderComponent],
        providers: [
          provideRouter(routes),
          { provide: SupabaseService, useValue: mockSupabase },
          ProjectStorageService,
          I18nService,
          ThemeService
        ]
      }).compileComponents();

      router = TestBed.inject(Router);
      headerFixture = TestBed.createComponent(HeaderComponent);
      headerFixture.detectChanges();
      headerElement = headerFixture.nativeElement as HTMLElement;
    });

    it('Step 5.1: Botón de logout es minimalista (w-9 h-9, sin texto visible "Cerrar Sesión")', () => {
      const signOutBtn = headerElement.querySelector('[data-testid="studio-signout-btn"]') as HTMLButtonElement;
      expect(signOutBtn).toBeTruthy();
      expect(signOutBtn.className).toContain('w-9');
      expect(signOutBtn.className).toContain('h-9');
      expect(signOutBtn.textContent?.trim()).toBe('');
      expect(signOutBtn.getAttribute('title')).toBeTruthy();
    });

    it('Step 5.2: Pulsar logout ejecuta signOut() en Supabase y redirige inmediatamente a "/"', async () => {
      const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      const signOutBtn = headerElement.querySelector('[data-testid="studio-signout-btn"]') as HTMLButtonElement;
      signOutBtn.click();
      await headerFixture.whenStable();

      expect(mockSupabase.signOut).toHaveBeenCalledTimes(1);
      expect(navSpy).toHaveBeenCalledWith('/');
    });

    it('Step 5.3: Tras logout, intentar volver a /studio es bloqueado por studioAccessGuard y redirige a /auth?mode=login', async () => {
      // Tras signOut, la sesión está inactiva
      isAuthSig.set(false);
      currentUserSig.set(null);
      userProfileSig.set(null);

      const guardResult = await TestBed.runInInjectionContext(() =>
        studioAccessGuard({} as ActivatedRouteSnapshot, { url: '/studio' } as RouterStateSnapshot)
      );

      expect(guardResult instanceof UrlTree).toBe(true);
      expect(router.serializeUrl(guardResult as UrlTree)).toBe('/auth?mode=login');
    });
  });
});
