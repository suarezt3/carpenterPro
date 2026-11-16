import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { CurrencyExchangeService } from './currency-exchange.service';
import {
  CHECKOUT_VARIANTS,
  DEFAULT_COP_USD_FALLBACK_RATE,
  DEFAULT_PAYMENTS_READINESS_MODE,
  FREE_PLAN_MAX_MODULES,
  OFFICIAL_COP_PRICING,
  PAYMENTS_READINESS_MODE_STORAGE_KEY,
  PaymentService,
  WOMPI_NAVIGATION_HANDLER,
  WOMPI_SANDBOX_PUBLIC_KEY,
  WOMPI_WEB_CHECKOUT_URL,
  WOMPI_WIDGET_SCRIPT_SRC
} from './payment.service';
import { DEFAULT_PLATFORM_SETTINGS, SupabaseService } from './supabase.service';

describe('PaymentService (Precios Oficiales COP, TRM Viva, Wompi Web Checkout Full-Page & Plan Limits)', () => {
  let service: PaymentService;
  let supabaseService: SupabaseService;
  let router: Router;
  let navigatedUrls: string[];

  beforeEach(() => {
    localStorage.removeItem(PAYMENTS_READINESS_MODE_STORAGE_KEY);
    sessionStorage.clear();
    delete window.WidgetCheckout;
    navigatedUrls = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        SupabaseService,
        {
          provide: WOMPI_NAVIGATION_HANDLER,
          useValue: (url: string): void => {
            navigatedUrls.push(url);
          }
        },
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

  it('debe iniciar por defecto en modo live_checkout y moneda de visualización COP', () => {
    expect(DEFAULT_PAYMENTS_READINESS_MODE).toBe('live_checkout');
    expect(service.paymentsMode()).toBe('live_checkout');
    expect(service.isPaymentsProtected()).toBe(false);
    expect(service.displayCurrency()).toBe('COP');
    expect(service.earlyAccessModalState()).toBeNull();
    expect(service.isPreparingCheckout()).toBe(false);
    expect(service.lastCheckoutError()).toBeNull();
    expect(service.lastVerifiedTransactionId()).toBeNull();

    service.setDisplayCurrency('USD');
    expect(service.displayCurrency()).toBe('USD');
    service.setDisplayCurrency('COP');
    expect(service.displayCurrency()).toBe('COP');
  });

  it('debe exponer OFFICIAL_COP_PRICING, DEFAULT_COP_USD_FALLBACK_RATE = 3304 y CHECKOUT_VARIANTS con precios COP y USD', () => {
    expect(WOMPI_SANDBOX_PUBLIC_KEY).toBe('pub_test_5IPqjmLMDEC0cqUMoomPY7CzUaoGW68O');
    expect(WOMPI_WIDGET_SCRIPT_SRC).toBe('https://checkout.wompi.co/widget.js');
    expect(WOMPI_WEB_CHECKOUT_URL).toBe('https://checkout.wompi.co/p/');
    expect(DEFAULT_COP_USD_FALLBACK_RATE).toBe(3304);
    expect(OFFICIAL_COP_PRICING).toEqual({
      pro: { monthly: 49900, annualMonthly: 39920, annualTotal: 479040 },
      industrial: { monthly: 95900, annualMonthly: 76720, annualTotal: 920640 }
    });

    expect(CHECKOUT_VARIANTS.pro.monthly).toEqual({
      plan: 'pro',
      cycle: 'monthly',
      planCode: 'P3D_PRO_MONTHLY',
      priceCop: 49900,
      monthlyEquivalentCop: 49900,
      priceUsd: 15,
      monthlyEquivalentUsd: 15
    });
    expect(CHECKOUT_VARIANTS.pro.annual).toEqual({
      plan: 'pro',
      cycle: 'annual',
      planCode: 'P3D_PRO_ANNUAL',
      priceCop: 479040,
      monthlyEquivalentCop: 39920,
      priceUsd: 144,
      monthlyEquivalentUsd: 12
    });
    expect(CHECKOUT_VARIANTS.industrial.monthly).toEqual({
      plan: 'industrial',
      cycle: 'monthly',
      planCode: 'P3D_IND_MONTHLY',
      priceCop: 95900,
      monthlyEquivalentCop: 95900,
      priceUsd: 29,
      monthlyEquivalentUsd: 29
    });
    expect(CHECKOUT_VARIANTS.industrial.annual).toEqual({
      plan: 'industrial',
      cycle: 'annual',
      planCode: 'P3D_IND_ANNUAL',
      priceCop: 920640,
      monthlyEquivalentCop: 76720,
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

  it('debe calcular precios fijos oficiales en COP, equivalencia USD con TRM viva y evitar que 4250 antiguo infle la conversión', () => {
    // 1. Por defecto con DEFAULT_PLATFORM_SETTINGS (usd_to_cop_rate = 3304)
    expect(service.getMonthlyCop('pro', 'monthly')).toBe(49900);
    expect(service.getMonthlyCop('pro', 'annual')).toBe(39920);
    expect(service.getMonthlyCop('industrial', 'monthly')).toBe(95900);
    expect(service.getMonthlyCop('industrial', 'yearly')).toBe(76720);

    expect(service.getCopEstimate('pro', 'monthly')).toEqual({
      amountCop: 49900,
      amountInCents: 4990000,
      exchangeRateCop: 3304,
      amountUsd: 15.1
    });
    expect(service.getCopEstimate('pro', 'annual')).toEqual({
      amountCop: 479040,
      amountInCents: 47904000,
      exchangeRateCop: 3304,
      amountUsd: 144.99
    });
    expect(service.getCopEstimate('industrial', 'monthly')).toEqual({
      amountCop: 95900,
      amountInCents: 9590000,
      exchangeRateCop: 3304,
      amountUsd: 29.03
    });
    expect(service.getCopEstimate('industrial', 'yearly')).toEqual({
      amountCop: 920640,
      amountInCents: 92064000,
      exchangeRateCop: 3304,
      amountUsd: 278.64
    });

    // 2. Respeta overrides *_cop y usd_to_cop_rate manual (!== 4250) cuando NO hay tasa viva de CurrencyExchangeService
    supabaseService.platformSettings.set({
      ...DEFAULT_PLATFORM_SETTINGS,
      pro_monthly_cop: 52000,
      pro_annual_monthly_cop: 41600,
      pro_annual_total_cop: 499200,
      industrial_annual_total_cop: 980000,
      usd_to_cop_rate: 3800
    });
    expect(service.getMonthlyCop('pro', 'monthly')).toBe(52000);
    expect(service.getMonthlyCop('pro', 'annual')).toBe(41600);
    expect(service.getCopEstimate('pro', 'monthly')).toEqual({
      amountCop: 52000,
      amountInCents: 5200000,
      exchangeRateCop: 3800,
      amountUsd: 13.68
    });
    expect(service.getCopEstimate('industrial', 'yearly')).toEqual({
      amountCop: 980000,
      amountInCents: 98000000,
      exchangeRateCop: 3800,
      amountUsd: 257.89
    });

    // 3. Si platformSettings trae 4250 antiguo pero CurrencyExchangeService tiene tasa viva (lastUpdated != null),
    //    SIEMPRE usa la TRM viva (nunca 4250)
    TestBed.resetTestingModule();
    const liveExchangeMock = {
      rates: () => ({ COP: 1, USD: 1 / 3650 }),
      lastUpdated: () => new Date('2026-11-16T18:00:00Z'),
      getUsdToCopRate: () => 3650
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        SupabaseService,
        { provide: CurrencyExchangeService, useValue: liveExchangeMock },
        PaymentService
      ]
    });
    const supaWithLive = TestBed.inject(SupabaseService);
    const serviceWithLive = TestBed.inject(PaymentService);
    supaWithLive.platformSettings.set({
      ...DEFAULT_PLATFORM_SETTINGS,
      usd_to_cop_rate: 4250
    });

    expect(serviceWithLive.getCopEstimate('pro', 'monthly')).toEqual({
      amountCop: 49900,
      amountInCents: 4990000,
      exchangeRateCop: 3650,
      amountUsd: 13.67
    });
    expect(serviceWithLive.convertCopToUsd(49900)).toBe(13.67);
    expect(serviceWithLive.convertCopToUsd(0)).toBe(0);
    expect(serviceWithLive.convertCopToUsd(-5000)).toBe(0);

    // 4. Mock de CurrencyExchangeService con rates()['USD'] sin lastUpdated cuando settingsRate === 4250
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        SupabaseService,
        { provide: CurrencyExchangeService, useValue: { rates: () => ({ COP: 1, USD: 1 / 4100 }) } },
        PaymentService
      ]
    });
    const supaLegacy4250 = TestBed.inject(SupabaseService);
    const serviceLegacy4250 = TestBed.inject(PaymentService);
    supaLegacy4250.platformSettings.set({
      ...DEFAULT_PLATFORM_SETTINGS,
      usd_to_cop_rate: 4250
    });
    expect(serviceLegacy4250.getCopEstimate('pro', 'monthly')).toEqual({
      amountCop: 49900,
      amountInCents: 4990000,
      exchangeRateCop: 4100,
      amountUsd: 12.17
    });

    // 5. Fallback final a DEFAULT_COP_USD_FALLBACK_RATE (3304) si CurrencyExchangeService no tiene USD y settings es 4250 o undefined
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
      usd_to_cop_rate: 4250
    });
    expect(serviceFallback.getCopEstimate('pro', 'monthly')).toEqual({
      amountCop: 49900,
      amountInCents: 4990000,
      exchangeRateCop: 3304,
      amountUsd: 15.1
    });

    supaFallback.platformSettings.set({
      ...DEFAULT_PLATFORM_SETTINGS,
      usd_to_cop_rate: undefined
    });
    expect(serviceFallback.getCopEstimate('pro', 'monthly')).toEqual({
      amountCop: 49900,
      amountInCents: 4990000,
      exchangeRateCop: 3304,
      amountUsd: 15.1
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

  it('buildWompiWebCheckoutUrl debe generar URL completa con redirect-url y customer-data opcionales', () => {
    const fullUrl = service.buildWompiWebCheckoutUrl(
      {
        publicKey: WOMPI_SANDBOX_PUBLIC_KEY,
        amountInCents: 4990000,
        reference: 'P3D-PRO-MONTHLY-u1-100',
        integritySignature: 'sig_abc123',
        redirectUrl: 'https://piezo3d.com/studio/designer?wompi_checkout=1',
        customerEmail: 'eyder@taller.com',
        customerName: 'Eyder Suarez'
      },
      'https://fallback.example.com'
    );

    const parsedFull = new URL(fullUrl);
    expect(`${parsedFull.origin}${parsedFull.pathname}`).toBe(WOMPI_WEB_CHECKOUT_URL);
    expect(parsedFull.searchParams.get('public-key')).toBe(WOMPI_SANDBOX_PUBLIC_KEY);
    expect(parsedFull.searchParams.get('currency')).toBe('COP');
    expect(parsedFull.searchParams.get('amount-in-cents')).toBe('4990000');
    expect(parsedFull.searchParams.get('reference')).toBe('P3D-PRO-MONTHLY-u1-100');
    expect(parsedFull.searchParams.get('signature:integrity')).toBe('sig_abc123');
    expect(parsedFull.searchParams.get('redirect-url')).toBe(
      'https://piezo3d.com/studio/designer?wompi_checkout=1'
    );
    expect(parsedFull.searchParams.get('customer-data:email')).toBe('eyder@taller.com');
    expect(parsedFull.searchParams.get('customer-data:full-name')).toBe('Eyder Suarez');

    const minimalUrl = service.buildWompiWebCheckoutUrl(
      {
        publicKey: WOMPI_SANDBOX_PUBLIC_KEY,
        amountInCents: 9590000,
        reference: 'P3D-IND-MONTHLY-u2-101',
        integritySignature: 'sig_min999'
      },
      'https://piezo3d.com/studio/designer?wompi_checkout=1'
    );

    const parsedMinimal = new URL(minimalUrl);
    expect(parsedMinimal.searchParams.get('redirect-url')).toBe(
      'https://piezo3d.com/studio/designer?wompi_checkout=1'
    );
    expect(parsedMinimal.searchParams.has('customer-data:email')).toBe(false);
    expect(parsedMinimal.searchParams.has('customer-data:full-name')).toBe(false);
  });

  it('openCheckout autenticado debe solicitar sesión firmada y navegar full-page vía WOMPI_NAVIGATION_HANDLER sin popup WidgetCheckout', async () => {
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
        amountInCents: 9590000,
        amountCop: 95900,
        amountUsd: 29.03,
        exchangeRateCop: 3304,
        reference: 'P3D-INDUSTRIAL-MONTHLY-usr999-123',
        integritySignature: 'sha256_integrity_hex_signature',
        customerEmail: 'eyder@taller.com',
        customerName: 'Eyder Suarez',
        environment: 'sandbox',
        redirectUrl: 'https://piezo3d.com/studio/designer?wompi_checkout=1'
      });

    const widgetConstructorSpy = vi.fn();
    window.WidgetCheckout = widgetConstructorSpy as unknown as NonNullable<Window['WidgetCheckout']>;
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await service.openCheckout('industrial', 'monthly');

    expect(createSessionSpy).toHaveBeenCalledWith({
      plan: 'industrial',
      billingCycle: 'monthly',
      redirectUrl: expect.stringContaining('/studio/designer?wompi_checkout=1')
    });
    expect(widgetConstructorSpy).not.toHaveBeenCalled();
    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(navigatedUrls.length).toBe(1);

    const navigated = new URL(navigatedUrls[0]);
    expect(`${navigated.origin}${navigated.pathname}`).toBe(WOMPI_WEB_CHECKOUT_URL);
    expect(navigated.searchParams.get('public-key')).toBe(WOMPI_SANDBOX_PUBLIC_KEY);
    expect(navigated.searchParams.get('currency')).toBe('COP');
    expect(navigated.searchParams.get('amount-in-cents')).toBe('9590000');
    expect(navigated.searchParams.get('reference')).toBe('P3D-INDUSTRIAL-MONTHLY-usr999-123');
    expect(navigated.searchParams.get('signature:integrity')).toBe('sha256_integrity_hex_signature');
    expect(navigated.searchParams.get('redirect-url')).toBe(
      'https://piezo3d.com/studio/designer?wompi_checkout=1'
    );
    expect(navigated.searchParams.get('customer-data:email')).toBe('eyder@taller.com');
    expect(navigated.searchParams.get('customer-data:full-name')).toBe('Eyder Suarez');
    expect(service.isPreparingCheckout()).toBe(false);
    expect(service.lastCheckoutError()).toBeNull();
  });

  it('testAdminCheckout debe navegar a Wompi Web Checkout en pantalla completa preservando early_access_protected', async () => {
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
      amountInCents: 92064000,
      amountCop: 920640,
      reference: 'P3D-INDUSTRIAL-ANNUAL-usradmin-99',
      integritySignature: 'sig_web_123',
      customerEmail: 'piezo3dstudio@gmail.com',
      customerName: 'Piezo3D Studio',
      redirectUrl: 'https://piezo3d.com/studio/designer?wompi_checkout=1'
    });
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    await service.testAdminCheckout('industrial', 'yearly');

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect(navigatedUrls.length).toBe(1);
    const parsed = new URL(navigatedUrls[0]);
    expect(`${parsed.origin}${parsed.pathname}`).toBe(WOMPI_WEB_CHECKOUT_URL);
    expect(parsed.searchParams.get('amount-in-cents')).toBe('92064000');
    expect(parsed.searchParams.get('reference')).toBe('P3D-INDUSTRIAL-ANNUAL-usradmin-99');
    expect(parsed.searchParams.get('signature:integrity')).toBe('sig_web_123');
    expect(parsed.searchParams.get('customer-data:email')).toBe('piezo3dstudio@gmail.com');
    expect(parsed.searchParams.get('customer-data:full-name')).toBe('Piezo3D Studio');
    expect(service.paymentsMode()).toBe('early_access_protected');
  });

  it('handleWompiTransactionResult debe seguir verificando transacciones por compatibilidad', async () => {
    const verifySpy = vi
      .spyOn(supabaseService, 'verifyWompiTransaction')
      .mockResolvedValue({
        success: true,
        approved: true,
        status: 'APPROVED',
        transactionId: 'tx_wompi_compat_1',
        reference: 'P3D-PRO-MONTHLY-u1-1'
      });
    const refreshSpy = vi.spyOn(supabaseService, 'refreshUserProfile').mockResolvedValue(null);
    const invoicesSpy = vi.spyOn(supabaseService, 'getSubscriptionInvoices').mockResolvedValue([]);
    const navByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const res = await service.handleWompiTransactionResult({
      id: 'tx_wompi_compat_1',
      status: 'APPROVED',
      reference: 'P3D-PRO-MONTHLY-u1-1'
    });

    expect(res.approved).toBe(true);
    expect(verifySpy).toHaveBeenCalledWith('tx_wompi_compat_1', 'P3D-PRO-MONTHLY-u1-1');
    expect(service.lastVerifiedTransactionId()).toBe('tx_wompi_compat_1');
    expect(refreshSpy).toHaveBeenCalled();
    expect(invoicesSpy).toHaveBeenCalled();
    expect(navByUrlSpy).toHaveBeenCalledWith('/studio/designer');
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
