import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef, computed, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { AccountSettingsModalComponent } from './account-settings-modal';
import { SupabaseService, UserProfile } from '../../services/supabase.service';
import { PaymentService } from '../../services/payment.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { I18nService } from '../../services/i18n.service';
import { ThemeService, ThemeMode } from '../../services/theme.service';
import { AppLanguage } from '../../data/i18n-translations.data';
import { DEFAULT_ROOM_CONFIG, MelamineProject } from '../../models/melamine.models';

const createMockProject = (): MelamineProject => ({
  id: 'test-project-1',
  name: 'Cocina de Prueba',
  clientName: 'Cliente Test',
  date: '2026-11-09',
  notes: '',
  settings: {
    sawKerf: 4,
    trimMargin: 10,
    defaultBoardThickness: 15,
    thinEdgeThickness: 0.45,
    thickEdgeThickness: 2.0,
    thinEdgeCostPerMeter: 1800,
    thickEdgeCostPerMeter: 4200,
    currency: 'COP',
    optimizationPreference: 'best_fit',
    subtractEdgeBandingFromCut: false
  },
  materials: [
    {
      id: 'mat-1',
      name: 'Melamina Blanca',
      thickness: 15,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 150000,
      hasGrain: false,
      colorHex: '#ffffff',
      category: 'board'
    }
  ],
  modules: [],
  parts: [],
  hardware: [],
  laborCost: 0,
  laborType: 'percent',
  profitMarginPercent: 25,
  taxPercent: 19,
  updatedAt: '2026-11-09',
  roomConfig: { ...DEFAULT_ROOM_CONFIG }
});

describe('AccountSettingsModalComponent (Milestone 3 — Features F8, F9, F10, F11)', () => {
  let component: AccountSettingsModalComponent;
  let componentRef: ComponentRef<AccountSettingsModalComponent>;
  let fixture: ComponentFixture<AccountSettingsModalComponent>;
  let supabaseMock: Partial<SupabaseService>;
  let projectServiceMock: Partial<ProjectStorageService>;
  let i18nMock: Partial<I18nService>;
  let themeServiceMock: Partial<ThemeService>;

  beforeEach(async () => {
    const mockUser = {
      id: 'u-1',
      email: 'eyder@taller.com',
      user_metadata: { first_name: 'Eyder', last_name: 'Suarez' }
    } as unknown as User;

    const mockProfile: UserProfile = {
      id: 'u-1',
      email: 'eyder@taller.com',
      first_name: 'Eyder',
      last_name: 'Suarez',
      role: 'user',
      plan: 'pro',
      created_at: '2026-11-09',
      updated_at: '2026-11-09'
    };

    const userSignal = signal<User | null>(mockUser);
    const profileSignal = signal<UserProfile | null>(mockProfile);
    const projectSignal = signal<MelamineProject>(createMockProject());
    const langSignal = signal<AppLanguage>('es');
    const themeSignal = signal<ThemeMode>('sketchup_classic');
    const isClassicComputed = computed(() => themeSignal() === 'sketchup_classic');
    const isDarkComputed = computed(() => themeSignal() === 'dark');

    supabaseMock = {
      isAuthenticated: signal(true),
      currentUser: userSignal,
      userProfile: profileSignal,
      updateUserProfile: vi.fn().mockResolvedValue({ success: true }),
      refreshUserProfile: vi.fn().mockResolvedValue(mockProfile),
      getSubscriptionInvoices: vi.fn().mockResolvedValue([]),
      buildFallbackProfile: vi.fn().mockReturnValue(mockProfile)
    };

    projectServiceMock = {
      currentProject: projectSignal,
      updateSettings: vi.fn(),
      updateWorkspaceDimensions: vi.fn(),
      updateRoomConfig: vi.fn(),
      updateProject: vi.fn((fn: (p: MelamineProject) => MelamineProject) => {
        projectSignal.update(fn);
      })
    };

    i18nMock = {
      currentLang: langSignal,
      languages: [
        { code: 'es', iso: 'ES', name: 'Español', nativeName: 'Español' },
        { code: 'en', iso: 'EN', name: 'English', nativeName: 'English' },
        { code: 'pt', iso: 'PT', name: 'Português', nativeName: 'Português' },
        { code: 'fr', iso: 'FR', name: 'Français', nativeName: 'Français' },
        { code: 'it', iso: 'IT', name: 'Italiano', nativeName: 'Italiano' },
        { code: 'de', iso: 'DE', name: 'Deutsch', nativeName: 'Deutsch' }
      ],
      setLanguage: vi.fn((code: AppLanguage) => {
        langSignal.set(code);
      }),
      t: vi.fn((key: string) => key)
    };

    themeServiceMock = {
      themeMode: themeSignal,
      isClassic: isClassicComputed,
      isDark: isDarkComputed,
      setTheme: vi.fn((m: ThemeMode) => {
        themeSignal.set(m);
      })
    };

    await TestBed.configureTestingModule({
      imports: [AccountSettingsModalComponent],
      providers: [
        { provide: SupabaseService, useValue: supabaseMock },
        {
          provide: PaymentService,
          useValue: {
            openCheckout: vi.fn().mockResolvedValue(undefined)
          }
        },
        { provide: ProjectStorageService, useValue: projectServiceMock },
        { provide: I18nService, useValue: i18nMock },
        { provide: ThemeService, useValue: themeServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AccountSettingsModalComponent);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('isOpen', true);
    componentRef.setInput('initialTab', 'profile');
    fixture.detectChanges();
  });

  it('debe crearse correctamente con valores iniciales', () => {
    expect(component).toBeTruthy();
    expect(component.isOpen()).toBe(true);
    expect(component.activeTab()).toBe('profile');
    expect(component.userEmail()).toBe('eyder@taller.com');
    expect(component.userPlan()).toBe('pro');
    expect(component.userInitials()).toBe('ES');
  });

  describe('Navegación entre pestañas', () => {
    it('debe permitir cambiar a la pestaña de Taller (workshop)', () => {
      component.selectTab('workshop');
      expect(component.activeTab()).toBe('workshop');
    });

    it('debe permitir cambiar a la pestaña de Preferencias (preferences)', () => {
      component.selectTab('preferences');
      expect(component.activeTab()).toBe('preferences');
    });

    it('debe permitir cambiar a la pestaña de Facturación (billing)', () => {
      component.selectTab('billing');
      expect(component.activeTab()).toBe('billing');
    });
  });

  describe('Pestaña 1: Mi Perfil y Cuenta (F8)', () => {
    it('debe inicializar el formulario con el nombre y apellido del perfil activo', () => {
      expect(component.profileForm.get('firstName')?.value).toBe('Eyder');
      expect(component.profileForm.get('lastName')?.value).toBe('Suarez');
    });

    it('debe permitir seleccionar un color de identidad para el avatar', () => {
      component.selectAvatarColor('emerald');
      expect(component.selectedAvatarColor()).toBe('emerald');
      expect(component.avatarType()).toBe('color');
      expect(component.getAvatarBgClass()).toBe('bg-emerald-600');
    });

    it('debe llamar a supabase.updateUserProfile al guardar los cambios de perfil válidos', async () => {
      component.profileForm.patchValue({
        firstName: 'Eyder Andrés',
        lastName: 'Suarez Peña'
      });

      await component.saveProfile();
      expect(supabaseMock.updateUserProfile).toHaveBeenCalledWith({
        first_name: 'Eyder Andrés',
        last_name: 'Suarez Peña'
      });
      expect(component.toastMessage()).toBe('account.profile.savedSuccess');
    });

    it('no debe llamar a updateUserProfile si el formulario es inválido', async () => {
      component.profileForm.patchValue({
        firstName: '' // Requerido
      });

      await component.saveProfile();
      expect(supabaseMock.updateUserProfile).not.toHaveBeenCalled();
    });
  });

  describe('Pestaña 2: Parámetros del Taller y Proyecto (F9)', () => {
    beforeEach(() => {
      component.selectTab('workshop');
      fixture.detectChanges();
    });

    it('debe conservar todos los parámetros existentes del taller en el formulario', () => {
      const v = component.workshopForm.value;
      expect(v.sawKerf).toBe(4);
      expect(v.trimMargin).toBe(10);
      expect(v.defaultBoardThickness).toBe(15);
      expect(v.thinEdgeThickness).toBe(0.45);
      expect(v.thickEdgeThickness).toBe(2.0);
      expect(v.thinEdgeCostPerMeter).toBe(1800);
      expect(v.thickEdgeCostPerMeter).toBe(4200);
      expect(v.currency).toBe('COP');
      expect(v.optimizationPreference).toBe('best_fit');
      expect(v.floorWidth).toBe(5000);
      expect(v.floorDepth).toBe(5000);
      expect(v.profitMarginPercent).toBe(25);
      expect(v.defaultSheetLength).toBe(2440);
      expect(v.defaultSheetWidth).toBe(1830);
    });

    it('debe actualizar dimensiones de espacio de trabajo en el formulario reactivo al elegir preset y persistir solo al guardar', () => {
      component.setWorkspacePreset(8000, 8000);
      expect(component.workshopForm.get('floorWidth')?.value).toBe(8000);
      expect(component.workshopForm.get('floorDepth')?.value).toBe(8000);
      expect(projectServiceMock.updateWorkspaceDimensions).not.toHaveBeenCalled();
      expect(component.activeTab()).toBe('workshop');

      component.saveWorkshopSettings();
      expect(projectServiceMock.updateWorkspaceDimensions).toHaveBeenCalledWith(8000, 8000);
    });

    it('debe guardar la configuración del taller en el ProjectStorageService', () => {
      component.workshopForm.patchValue({
        sawKerf: 4.2,
        trimMargin: 12,
        defaultBoardThickness: 18,
        currency: 'USD',
        profitMarginPercent: 30,
        defaultSheetLength: 2600,
        defaultSheetWidth: 2100
      });

      component.saveWorkshopSettings();

      expect(projectServiceMock.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          sawKerf: 4.2,
          trimMargin: 12,
          defaultBoardThickness: 18,
          currency: 'USD'
        }),
        false
      );
      expect(projectServiceMock.updateProject).toHaveBeenCalled();
      expect(component.toastMessage()).toBe('account.workshop.saveSuccess');
    });
  });

  describe('Pestaña 3: Preferencias de Interfaz (F10)', () => {
    beforeEach(() => {
      component.selectTab('preferences');
      fixture.detectChanges();
    });

    it('debe cambiar de idioma llamando a I18nService y preservar la pestaña preferences', () => {
      component.selectLanguage('en');
      expect(i18nMock.setLanguage).toHaveBeenCalledWith('en');
      expect(component.activeTab()).toBe('preferences');
    });

    it('debe cambiar la moneda y preservar la pestaña preferences sin saltar a perfil', () => {
      component.setCurrency('USD');
      expect(component.activeTab()).toBe('preferences');
      expect(component.workshopForm.get('currency')?.value).toBe('USD');
    });

    it('debe alternar la cuadrícula del piso llamando a updateRoomConfig y preservar la pestaña', () => {
      component.toggleFloorGrid(false);
      expect(component.showFloorGrid()).toBe(false);
      expect(projectServiceMock.updateRoomConfig).toHaveBeenCalledWith({ showFloorGrid: false });
      expect(component.activeTab()).toBe('preferences');
    });

    it('debe alternar cotas de luz interna llamando a updateRoomConfig y preservar la pestaña', () => {
      component.toggleClearances(false);
      expect(component.showClearances()).toBe(false);
      expect(projectServiceMock.updateRoomConfig).toHaveBeenCalledWith({ showClearances: false });
      expect(component.activeTab()).toBe('preferences');
    });

    it('debe cambiar el tema 3D llamando a ThemeService y preservar la pestaña', () => {
      component.set3DTheme('dark');
      expect(themeServiceMock.setTheme).toHaveBeenCalledWith('dark');
      expect(component.activeTab()).toBe('preferences');
    });

    it('los botones de pestaña superior deben incluir la clase tab-nav-btn y estilos ergonómicos', () => {
      const tabButtons = fixture.nativeElement.querySelectorAll('button[data-testid^="account-tab-"]');
      expect(tabButtons.length).toBe(4);
      tabButtons.forEach((btn: HTMLButtonElement) => {
        expect(btn.className).toContain('tab-nav-btn');
        expect(btn.className).toContain('rounded-lg');
      });
    });
  });

  describe('Pestaña 4: Suscripción, Métodos de Pago y Facturas (F11)', () => {
    beforeEach(() => {
      component.selectTab('billing');
      fixture.detectChanges();
    });

    it('debe mostrar el plan activo y lista de métodos de pago simulados', () => {
      expect(component.paymentMethods().length).toBe(2);
      expect(component.paymentMethods()[0].last4).toBe('4242');
      expect(component.paymentMethods()[0].isDefault).toBe(true);
    });

    it('debe mostrar la lista de facturas simuladas', () => {
      expect(component.invoices().length).toBe(3);
      expect(component.invoices()[0].invoiceNumber).toBe('INV-2026-011');
      expect(component.invoices()[0].status).toBe('paid');
    });

    it('debe emitir feedback al presionar agregar método de pago', () => {
      component.addPaymentMethod();
      expect(component.toastMessage()).toBe('account.billing.addMethodMockToast');
    });

    it('debe emitir feedback al solicitar mejorar de plan', () => {
      component.upgradePlan();
      expect(component.toastMessage()).toBe('account.billing.upgradeMockToast');
    });

    it('debe emitir feedback al descargar factura', () => {
      component.downloadInvoice(component.invoices()[0]);
      expect(component.toastMessage()).toContain('INV-2026-011');
    });

    it('debe establecer toastType en success por defecto y mostrar estilo amigable esmeralda', () => {
      component.showToast('Prueba de éxito');
      expect(component.toastMessage()).toBe('Prueba de éxito');
      expect(component.toastType()).toBe('success');

      fixture.detectChanges();
      const toastEl = fixture.nativeElement.querySelector('[role="status"]');
      expect(toastEl).toBeTruthy();
      expect(toastEl.classList.contains('bg-emerald-50/95')).toBe(true);
      expect(toastEl.classList.contains('text-emerald-900')).toBe(true);
    });

    it('debe admitir toastType error con estilo de alerta rose', () => {
      component.showToast('Error en guardado', 'error');
      expect(component.toastType()).toBe('error');

      fixture.detectChanges();
      const toastEl = fixture.nativeElement.querySelector('[role="status"]');
      expect(toastEl).toBeTruthy();
      expect(toastEl.classList.contains('bg-rose-50/95')).toBe(true);
      expect(toastEl.classList.contains('text-rose-900')).toBe(true);
    });

    it('debe respetar la jerarquía de planes (free < pro < industrial) en botones superiores e inferiores', () => {
      // Caso 1: Usuario en Plan Industrial Anual (Plan Máximo)
      component.userProfile.set({
        id: 'user-123',
        email: 'eyder@taller.com',
        first_name: 'Eyder',
        last_name: 'Suarez',
        role: 'user',
        plan: 'industrial',
        billing_cycle: 'annual',
        subscription_status: 'active',
        current_period_end: '2027-11-10T00:00:00Z',
        created_at: '2026-11-10T00:00:00Z',
        updated_at: '2026-11-10T00:00:00Z'
      });
      component.setBillingCycleSelect('annual');
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="account-upgrade-plan-btn"]')).toBeNull();
      expect(el.querySelector('[data-testid="account-max-plan-badge"]')).toBeTruthy();

      const proCardBtn = el.querySelector('[data-testid="account-checkout-pro-btn"]') as HTMLButtonElement;
      const indCardBtn = el.querySelector('[data-testid="account-checkout-industrial-btn"]') as HTMLButtonElement;
      expect(proCardBtn.disabled).toBe(true);
      expect(proCardBtn.textContent?.trim()).toBe('account.billing.includedInIndustrialBtn');
      expect(indCardBtn.disabled).toBe(true);
      expect(indCardBtn.textContent?.trim()).toBe('account.billing.currentPlanBtn');

      // Caso 2: Usuario en Plan Industrial Mensual -> muestra botón Cambiar a Plan Anual (-20%) arriba
      component.userProfile.set({
        id: 'user-123',
        email: 'eyder@taller.com',
        first_name: 'Eyder',
        last_name: 'Suarez',
        role: 'user',
        plan: 'industrial',
        billing_cycle: 'monthly',
        subscription_status: 'active',
        created_at: '2026-11-10T00:00:00Z',
        updated_at: '2026-11-10T00:00:00Z'
      });
      component.setBillingCycleSelect('annual');
      fixture.detectChanges();

      const updatedIndCardBtn = el.querySelector('[data-testid="account-checkout-industrial-btn"]') as HTMLButtonElement;
      expect(el.querySelector('[data-testid="account-upgrade-plan-btn"]')).toBeNull();
      expect(el.querySelector('[data-testid="account-switch-annual-top-btn"]')).toBeTruthy();
      expect(updatedIndCardBtn.disabled).toBe(false);
      expect(updatedIndCardBtn.textContent).toContain('account.billing.switchToAnnualBtn');

      // Verificar título en una sola línea amplia y botón Gestionar Suscripción y Pagos en modo in-app
      const planTitleEl = el.querySelector('[data-testid="account-active-plan-title"]') as HTMLElement;
      expect(planTitleEl).toBeTruthy();
      expect(planTitleEl.className).toContain('whitespace-nowrap');

      const windowOpenSpy = vi.spyOn(window, 'open');
      const manageBtn = el.querySelector('[data-testid="account-customer-portal-btn"]') as HTMLButtonElement;
      expect(manageBtn).toBeTruthy();
      manageBtn.click();
      fixture.detectChanges();

      expect(windowOpenSpy).not.toHaveBeenCalled();
      expect(component.showManageBillingNotice()).toBe(true);
      expect(el.querySelector('[data-testid="account-manage-billing-notice"]')).toBeTruthy();
      windowOpenSpy.mockRestore();
    });
  });

  describe('Cierre del modal', () => {
    it('debe emitir closed y modalClose al invocar closeModal', () => {
      const closedSpy = vi.fn();
      const modalCloseSpy = vi.fn();
      component.closed.subscribe(closedSpy);
      component.modalClose.subscribe(modalCloseSpy);

      component.closeModal();
      expect(closedSpy).toHaveBeenCalled();
      expect(modalCloseSpy).toHaveBeenCalled();
    });
  });
});
