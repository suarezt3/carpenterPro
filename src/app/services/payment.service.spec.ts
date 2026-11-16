import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { CurrencyExchangeService } from './currency-exchange.service';
import {
  CHECKOUT_VARIANTS,
  DEFAULT_COP_USD_FALLBACK_RATE,
  DEFAULT_PAYMENTS_READINESS_MODE,
  FREE_PLAN_MAX_MODULES,
  PAYMENTS_READINESS_MODE_STORAGE_KEY,
  PaymentService,
  WOMPI_SANDBOX_PUBLIC_KEY,
  WOMPI_WEB_CHECKOUT_URL,
  WOMPI_WIDGET_SCRIPT_SRC,
  WompiWidgetCheckoutConfig,
  WompiWidgetTransactionResult
} from './payment.service';
import { DEFAULT_PLATFORM_SETTINGS, SupabaseService } from './supabase.service';

describe('PaymentService (Wompi Colombia, Conversión 1A, Retorno PSE & Plan Limits)', () => {
  let service: PaymentService;
  let supabaseService: SupabaseService;
  let router: Router;

  beforeEach(() => {
    localStorage.removeItem(PAYMENTS_READINESS_MODE_STORAGE_KEY);
    sessionStorage.clear();
    delete window.WidgetCheckout;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        SupabaseService,
        PaymentService
      ]
    });
    supabaseService = TestBed.inject(SupabaseService);
    service = TestBed.inject(PaymentService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    localStorage.removeItem(PAYMENTS_READINESS_MODE_STORAGE_KEY);
    sessionStorage.clear();
    delete window.WidgetCheckout;
    document
      .querySelectorAll(`script[src="${WOMPI_WIDGET_SCRIPT_SRC}"]`)
      .forEach((el) => el.remove());
    vi.restoreAllMocks();
  });

  it('debe iniciar por defecto en modo live_checkout según decisión 3A', () => {
    expect(DEFAULT_PAYMENTS_READINESS_MODE).toBe('live_checkout');
    expect(service.paymentsMode()).toBe('live_checkout');
    expect(service.isPaymentsProtected()).toBe(false);
    expect(service.earlyAccessModalState()).toBeNull();
    expect(service.isPreparingCheckout()).toBe(false);
    expect(service.lastCheckoutError()).toBeNull();
    expect(service.lastVerifiedTransactionId()).toBeNull();
  });

  it('debe exponer constantes oficiales de Wompi Sandbox y catálogo limpio Piezo3D/Wompi sin variantes heredadas', () => {
    expect(WOMPI_SANDBOX_PUBLIC_KEY).toBe('pub_test_5IPqjmLMDEC0cqUMoomPY7CzUaoGW68O');
    expect(WOMPI_WIDGET_SCRIPT_SRC).toBe('https://checkout.wompi.co/widget.js');
    expect(WOMPI_WEB_CHECKOUT_URL).toBe('https://checkout.wompi.co/p/');
    expect(DEFAULT_COP_USD_FALLBACK_RATE).toBe(4250);

    expect(CHECKOUT_VARIANTS.pro.monthly).toEqual({
      plan: 'pro',
      cycle: 'monthly',
      planCode: 'P3D_PRO_MONTHLY',
      priceUsd: 15,
      monthlyEquivalentUsd: 15
    });
    expect(CHECKOUT_VARIANTS.pro.annual).toEqual({
      plan: 'pro',
      cycle: 'annual',
      planCode: 'P3D_PRO_ANNUAL',
      priceUsd: 144,
      monthlyEquivalentUsd: 12
    });
    expect(CHECKOUT_VARIANTS.industrial.monthly).toEqual({
      plan: 'industrial',
      cycle: 'monthly',
      planCode: 'P3D_IND_MONTHLY',
      priceUsd: 29,
      monthlyEquivalentUsd: 29
    });
    expect(CHECKOUT_VARIANTS.industrial.annual).toEqual({
      plan: 'industrial',
      cycle: 'annual',
      planCode: 'P3D_IND_ANNUAL',
      priceUsd: 276,
      monthlyEquivalentUsd: 23
    });
  });

  it('debe respetar persistencia explícita de early_access_protected y live_checkout en localStorage', () => {
    expect(service.togglePaymentsMode()).toBe('early_access_protected');
    expect(service.paymentsMode()).toBe('early_access_protected');
    expect(service.isPaymentsProtected()).toBe(true);
    expect(localStorage.getItem(PAYMENTS_READINESS_MODE_STORAGE_KEY)).toBe('early_access_protected');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), SupabaseService, PaymentService]
    });
    const protectedRehydrated = TestBed.inject(PaymentService);
    expect(protectedRehydrated.paymentsMode()).toBe('early_access_protected');
    expect(protectedRehydrated.isPaymentsProtected()).toBe(true);

    expect(protectedRehydrated.togglePaymentsMode()).toBe('live_checkout');
    expect(protectedRehydrated.paymentsMode()).toBe('live_checkout');
    expect(protectedRehydrated.isPaymentsProtected()).toBe(false);
    expect(localStorage.getItem(PAYMENTS_READINESS_MODE_STORAGE_KEY)).toBe('live_checkout');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), SupabaseService, PaymentService]
    });
    const liveRehydrated = TestBed.inject(PaymentService);
    expect(liveRehydrated.paymentsMode()).toBe('live_checkout');

    localStorage.setItem(PAYMENTS_READINESS_MODE_STORAGE_KEY, 'unexpected_mode');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), SupabaseService, PaymentService]
    });
    const fallbackService = TestBed.inject(PaymentService);
    expect(fallbackService.paymentsMode()).toBe('live_checkout');
    expect(fallbackService.isPaymentsProtected()).toBe(false);
  });

  it('en modo early_access_protected debe interceptar openCheckout sin redirigir a /auth ni llamar a Wompi', async () => {
    service.setPaymentsMode('early_access_protected');
    supabaseService.currentUser.set(null);
    service.savePendingCheckout({ plan: 'pro', cycle: 'monthly' });
    service.openUpgradeModal('modules_limit', 'pro');

    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const createSessionSpy = vi.spyOn(supabaseService, 'createWompiCheckoutSession');
    const ensureScriptSpy = vi.spyOn(service, 'ensureWompiScriptLoaded').mockResolvedValue(true);
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await service.openCheckout('pro', 'monthly');

    expect(navSpy).not.toHaveBeenCalled();
    expect(createSessionSpy).not.toHaveBeenCalled();
    expect(ensureScriptSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(service.consumePendingCheckout()).toBeNull();
    expect(service.upgradeModalState()).toBeNull();
    expect(service.earlyAccessModalState()).toEqual({
      plan: 'pro',
      cycle: 'monthly',
      sourceRoute: router.url || '/'
    });

    await service.openCheckout('industrial', 'annual');
    expect(createSessionSpy).not.toHaveBeenCalled();
    expect(service.earlyAccessModalState()).toEqual({
      plan: 'industrial',
      cycle: 'annual',
      sourceRoute: router.url || '/'
    });

    service.closeEarlyAccessModal();
    expect(service.earlyAccessModalState()).toBeNull();
  });

  it('debe permitir abrir y cerrar openEarlyAccessModal con normalización de ciclo y ruta explícita', () => {
    service.openUpgradeModal('cnc_export', 'industrial');
    service.openEarlyAccessModal('industrial', 'yearly', '/studio/designer');

    expect(service.upgradeModalState()).toBeNull();
    expect(service.earlyAccessModalState()).toEqual({
      plan: 'industrial',
      cycle: 'annual',
      sourceRoute: '/studio/designer'
    });

    service.closeEarlyAccessModal();
    expect(service.earlyAccessModalState()).toBeNull();
  });

  it('debe calcular la conversión 1A en COP desde platformSettings, CurrencyExchangeService o fallback 4250', () => {
    supabaseService.platformSettings.set({
      ...DEFAULT_PLATFORM_SETTINGS,
      pro_monthly_usd: 15,
      industrial_annual_total_usd: 276,
      usd_to_cop_rate: 4300
    });

    const proMonthly = service.getCopEstimate('pro', 'monthly');
    expect(proMonthly).toEqual({
      amountUsd: 15,
      exchangeRateCop: 4300,
      amountCop: 64500,
      amountInCents: 6450000
    });

    const indAnnual = service.getCopEstimate('industrial', 'yearly');
    expect(indAnnual).toEqual({
      amountUsd: 276,
      exchangeRateCop: 4300,
      amountCop: 1186800,
      amountInCents: 118680000
    });

    // Fallback a CurrencyExchangeService cuando platformSettings no tiene tasa válida
    TestBed.resetTestingModule();
    const exchangeMock = {
      rates: () => ({ COP: 1, USD: 1 / 4100 })
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        SupabaseService,
        { provide: CurrencyExchangeService, useValue: exchangeMock },
        PaymentService
      ]
    });
    const supaWithExchange = TestBed.inject(SupabaseService);
    const serviceWithExchange = TestBed.inject(PaymentService);
    supaWithExchange.platformSettings.set({
      ...DEFAULT_PLATFORM_SETTINGS,
      usd_to_cop_rate: 0
    });

    expect(serviceWithExchange.getCopEstimate('pro', 'monthly')).toEqual({
      amountUsd: 15,
      exchangeRateCop: 4100,
      amountCop: 61500,
      amountInCents: 6150000
    });

    // Fallback final a DEFAULT_COP_USD_FALLBACK_RATE (4250) cuando ambos faltan
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        SupabaseService,
        { provide: CurrencyExchangeService, useValue: { rates: () => ({}) } },
        PaymentService
      ]
    });
    const supaFallback = TestBed.inject(SupabaseService);
    const serviceFallback = TestBed.inject(PaymentService);
    supaFallback.platformSettings.set({
      ...DEFAULT_PLATFORM_SETTINGS,
      usd_to_cop_rate: undefined
    });

    expect(serviceFallback.getCopEstimate('pro', 'monthly')).toEqual({
      amountUsd: 15,
      exchangeRateCop: 4250,
      amountCop: 63750,
      amountInCents: 6375000
    });
  });

  it('debe redirigir a /auth?mode=register&plan=...&cycle=... cuando el usuario no ha iniciado sesión en modo live_checkout', async () => {
    service.setPaymentsMode('live_checkout');
    supabaseService.currentUser.set(null);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await service.openCheckout('pro', 'yearly');

    expect(navSpy).toHaveBeenCalledWith(['/auth'], {
      queryParams: {
        mode: 'register',
        plan: 'pro',
        cycle: 'annual'
      }
    });

    const pending = service.consumePendingCheckout();
    expect(pending).toEqual({ plan: 'pro', cycle: 'annual' });
  });

  it('debe solicitar sesión Wompi firmada en servidor y abrir WidgetCheckout cuando el usuario está autenticado', async () => {
    const mockUser = {
      id: 'usr-999',
      email: 'eyder@taller.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-11-10T00:00:00Z'
    } as unknown as User;

    supabaseService.currentUser.set(mockUser);
    supabaseService.userProfile.set({
      id: 'usr-999',
      email: 'eyder@taller.com',
      first_name: 'Eyder',
      last_name: 'Suarez',
      role: 'user',
      plan: 'free',
      created_at: '2026-11-10T00:00:00Z',
      updated_at: '2026-11-10T00:00:00Z'
    });

    const createSessionSpy = vi
      .spyOn(supabaseService, 'createWompiCheckoutSession')
      .mockResolvedValue({
        success: true,
        publicKey: WOMPI_SANDBOX_PUBLIC_KEY,
        currency: 'COP',
        amountInCents: 12325000,
        amountCop: 123250,
        amountUsd: 29,
        exchangeRateCop: 4250,
        reference: 'P3D-INDUSTRIAL-MONTHLY-usr999-123',
        integritySignature: 'sha256_integrity_hex_signature',
        customerEmail: 'eyder@taller.com',
        customerName: 'Eyder Suarez',
        environment: 'sandbox',
        redirectUrl: 'https://piezo3d.com/studio/designer?wompi_checkout=1'
      });

    const verifySpy = vi
      .spyOn(supabaseService, 'verifyWompiTransaction')
      .mockResolvedValue({
        success: true,
        approved: true,
        status: 'APPROVED',
        transactionId: 'tx_wompi_approved_1',
        reference: 'P3D-INDUSTRIAL-MONTHLY-usr999-123',
        portalUrl: 'https://checkout.wompi.co/l/tx_wompi_approved_1'
      });
    const refreshSpy = vi.spyOn(supabaseService, 'refreshUserProfile').mockResolvedValue(null);
    const invoicesSpy = vi.spyOn(supabaseService, 'getSubscriptionInvoices').mockResolvedValue([]);
    const navByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const captured: {
      config: WompiWidgetCheckoutConfig | null;
      callback: ((result: WompiWidgetTransactionResult) => void) | null;
    } = {
      config: null,
      callback: null
    };

    class MockWidgetCheckout {
      constructor(config: WompiWidgetCheckoutConfig) {
        captured.config = config;
      }
      open(cb: (result: WompiWidgetTransactionResult) => void): void {
        captured.callback = cb;
      }
    }
    window.WidgetCheckout = MockWidgetCheckout;

    await service.openCheckout('industrial', 'monthly');

    expect(createSessionSpy).toHaveBeenCalledWith({
      plan: 'industrial',
      billingCycle: 'monthly',
      redirectUrl: expect.stringContaining('/studio/designer?wompi_checkout=1')
    });
    expect(captured.config).toEqual({
      currency: 'COP',
      amountInCents: 12325000,
      reference: 'P3D-INDUSTRIAL-MONTHLY-usr999-123',
      publicKey: WOMPI_SANDBOX_PUBLIC_KEY,
      redirectUrl: 'https://piezo3d.com/studio/designer?wompi_checkout=1',
      signature: { integrity: 'sha256_integrity_hex_signature' },
      customerData: {
        email: 'eyder@taller.com',
        fullName: 'Eyder Suarez'
      }
    });
    expect(service.isPreparingCheckout()).toBe(false);
    expect(service.lastCheckoutError()).toBeNull();

    // Simular respuesta aprobada desde el callback de WidgetCheckout
    expect(captured.callback).toBeTruthy();
    captured.callback?.({
      transaction: {
        id: 'tx_wompi_approved_1',
        status: 'APPROVED',
        reference: 'P3D-INDUSTRIAL-MONTHLY-usr999-123'
      }
    });

    await vi.waitFor(() => {
      expect(verifySpy).toHaveBeenCalledWith('tx_wompi_approved_1', 'P3D-INDUSTRIAL-MONTHLY-usr999-123');
    });
    await vi.waitFor(() => {
      expect(service.lastVerifiedTransactionId()).toBe('tx_wompi_approved_1');
      expect(refreshSpy).toHaveBeenCalled();
      expect(invoicesSpy).toHaveBeenCalled();
      expect(navByUrlSpy).toHaveBeenCalledWith('/studio/designer');
    });
  });

  it('debe inyectar https://checkout.wompi.co/widget.js en head y usar fallback Web Checkout si WidgetCheckout no carga', async () => {
    const loadPromise = service.ensureWompiScriptLoaded();
    const injectedScript = document.querySelector(
      `script[src="${WOMPI_WIDGET_SCRIPT_SRC}"]`
    ) as HTMLScriptElement | null;
    expect(injectedScript).toBeTruthy();
    expect(injectedScript?.defer).toBe(true);

    injectedScript?.dispatchEvent(new Event('load'));
    expect(await loadPromise).toBe(true);
    expect(service.isScriptReady()).toBe(true);

    // Ahora probar fallback cuando WidgetCheckout no está disponible
    service.setPaymentsMode('early_access_protected');
    supabaseService.currentUser.set({
      id: 'usr-admin',
      email: 'piezo3dstudio@gmail.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-11-10T00:00:00Z'
    } as unknown as User);

    vi.spyOn(supabaseService, 'createWompiCheckoutSession').mockResolvedValue({
      success: true,
      publicKey: WOMPI_SANDBOX_PUBLIC_KEY,
      currency: 'COP',
      amountInCents: 117300000,
      reference: 'P3D-INDUSTRIAL-ANNUAL-usradmin-99',
      integritySignature: 'sig_fallback_123',
      redirectUrl: 'https://piezo3d.com/studio/designer?wompi_checkout=1'
    });
    delete window.WidgetCheckout;
    const ensureSpy = vi.spyOn(service, 'ensureWompiScriptLoaded').mockResolvedValue(false);
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await service.testAdminCheckout('industrial', 'yearly');

    expect(ensureSpy).toHaveBeenCalledTimes(1);
    expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    const fallbackUrl = windowOpenSpy.mock.calls[0][0] as string;
    expect(fallbackUrl).toContain(`${WOMPI_WEB_CHECKOUT_URL}?`);
    expect(fallbackUrl).toContain(`public-key=${WOMPI_SANDBOX_PUBLIC_KEY}`);
    expect(fallbackUrl).toContain('currency=COP');
    expect(fallbackUrl).toContain('amount-in-cents=117300000');
    expect(fallbackUrl).toContain('reference=P3D-INDUSTRIAL-ANNUAL-usradmin-99');
    expect(fallbackUrl).toContain('signature%3Aintegrity=sig_fallback_123');
    expect(service.paymentsMode()).toBe('early_access_protected');
  });

  it('debe registrar error claro en lastCheckoutError cuando createWompiCheckoutSession devuelve WOMPI_CONFIG_MISSING', async () => {
    supabaseService.currentUser.set({
      id: 'usr-1',
      email: 'taller@piezo3d.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-11-10T00:00:00Z'
    } as unknown as User);

    vi.spyOn(supabaseService, 'createWompiCheckoutSession').mockResolvedValue({
      success: false,
      errorCode: 'WOMPI_CONFIG_MISSING',
      errorKey: 'account.billing.gatewayKeyMissingError'
    });

    await service.openCheckout('pro', 'monthly');

    expect(service.isPreparingCheckout()).toBe(false);
    expect(service.lastCheckoutError()).toContain('Wompi Colombia');
  });

  it('processWompiRedirectReturn debe verificar el parámetro ?id=... de PSE/Bancolombia, refrescar perfil y limpiar query params', async () => {
    const verifySpy = vi
      .spyOn(supabaseService, 'verifyWompiTransaction')
      .mockResolvedValue({
        success: true,
        approved: true,
        status: 'APPROVED',
        transactionId: 'tx_pse_bancolombia_77',
        portalUrl: 'https://checkout.wompi.co/l/tx_pse_bancolombia_77'
      });
    const refreshSpy = vi.spyOn(supabaseService, 'refreshUserProfile').mockResolvedValue(null);
    const invoicesSpy = vi.spyOn(supabaseService, 'getSubscriptionInvoices').mockResolvedValue([]);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    // URL normal sin marcadores Wompi no debe disparar verificación
    const noParamsResult = await service.processWompiRedirectReturn('/studio/designer?tab=modules');
    expect(noParamsResult).toBeNull();
    expect(verifySpy).not.toHaveBeenCalled();

    // URL de retorno desde PSE / Botón Bancolombia
    const result = await service.processWompiRedirectReturn(
      'https://piezo3d.com/studio/designer?wompi_checkout=1&id=tx_pse_bancolombia_77&env=test'
    );

    expect(verifySpy).toHaveBeenCalledWith('tx_pse_bancolombia_77', undefined);
    expect(result?.approved).toBe(true);
    expect(service.lastVerifiedTransactionId()).toBe('tx_pse_bancolombia_77');
    expect(service.lastCheckoutSuccessAt()).not.toBeNull();
    expect(refreshSpy).toHaveBeenCalled();
    expect(invoicesSpy).toHaveBeenCalled();
    expect(navSpy).toHaveBeenCalledWith(['/studio/designer'], {
      queryParams: {},
      replaceUrl: true
    });
  });

  it('debe aplicar el límite de 3 módulos únicamente al Plan Inicial (free) y desbloquear en pro, industrial o super_admin', () => {
    supabaseService.userProfile.set({
      id: 'u-free',
      email: 'free@taller.com',
      first_name: 'Carpintero',
      last_name: 'Inicial',
      role: 'user',
      plan: 'free',
      created_at: '',
      updated_at: ''
    });

    expect(service.canAddModuleToScene(0)).toBe(true);
    expect(service.canAddModuleToScene(2)).toBe(true);
    expect(service.canAddModuleToScene(FREE_PLAN_MAX_MODULES)).toBe(false);
    expect(service.hasProAccess()).toBe(false);
    expect(service.hasIndustrialAccess()).toBe(false);

    supabaseService.userProfile.update((p) => (p ? { ...p, plan: 'pro' } : p));
    expect(service.canAddModuleToScene(10)).toBe(true);
    expect(service.hasProAccess()).toBe(true);
    expect(service.hasIndustrialAccess()).toBe(false);

    supabaseService.userProfile.update((p) => (p ? { ...p, plan: 'industrial' } : p));
    expect(service.canAddModuleToScene(25)).toBe(true);
    expect(service.hasProAccess()).toBe(true);
    expect(service.hasIndustrialAccess()).toBe(true);

    supabaseService.userProfile.update((p) => (p ? { ...p, plan: 'free', role: 'super_admin' } : p));
    expect(service.canAddModuleToScene(50)).toBe(true);
    expect(service.hasProAccess()).toBe(true);
    expect(service.hasIndustrialAccess()).toBe(true);
  });
});
