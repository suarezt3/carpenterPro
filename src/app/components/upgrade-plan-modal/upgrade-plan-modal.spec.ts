import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UpgradePlanModalComponent } from './upgrade-plan-modal';
import {
  BillingDisplayCurrency,
  CheckoutCycleInput,
  OFFICIAL_COP_PRICING,
  PaidPlan,
  PaymentService,
  UpgradeModalState
} from '../../services/payment.service';
import { CurrencyExchangeService, DEFAULT_COP_RATES } from '../../services/currency-exchange.service';
import { LandingPricingConfigService } from '../../services/landing-pricing-config.service';
import { DEFAULT_LANDING_PRICING_CONFIG, cloneLandingPricingConfig } from '../../models/landing-pricing.models';
import { I18nService } from '../../services/i18n.service';

interface ProtectedEarlyAccessState {
  plan: PaidPlan;
  cycle: 'monthly' | 'annual';
  sourceRoute: string;
}

describe('UpgradePlanModalComponent', () => {
  let fixture: ComponentFixture<UpgradePlanModalComponent>;
  let component: UpgradePlanModalComponent;
  let upgradeStateSignal: WritableSignal<UpgradeModalState | null>;
  let earlyAccessStateSignal: WritableSignal<ProtectedEarlyAccessState | null>;
  let isProtectedSignal: WritableSignal<boolean>;
  let displayCurrencySignal: WritableSignal<BillingDisplayCurrency>;
  let exchangeRateCop: number;
  let landingPricingConfig: LandingPricingConfigService;
  let mockPaymentService: {
    upgradeModalState: ReturnType<WritableSignal<UpgradeModalState | null>['asReadonly']>;
    earlyAccessModalState: ReturnType<WritableSignal<ProtectedEarlyAccessState | null>['asReadonly']>;
    isPaymentsProtected: ReturnType<WritableSignal<boolean>['asReadonly']>;
    displayCurrency: ReturnType<WritableSignal<BillingDisplayCurrency>['asReadonly']>;
    setDisplayCurrency: ReturnType<typeof vi.fn>;
    getMonthlyCop: ReturnType<typeof vi.fn>;
    getCopEstimate: ReturnType<typeof vi.fn>;
    convertCopToUsd: ReturnType<typeof vi.fn>;
    openCheckout: ReturnType<typeof vi.fn>;
    closeUpgradeModal: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    localStorage.removeItem('melamipro_exchange_rates_cache_v1');
    upgradeStateSignal = signal<UpgradeModalState | null>(null);
    earlyAccessStateSignal = signal<ProtectedEarlyAccessState | null>(null);
    isProtectedSignal = signal(true);
    displayCurrencySignal = signal<BillingDisplayCurrency>('COP');
    exchangeRateCop = 3304;

    mockPaymentService = {
      upgradeModalState: upgradeStateSignal.asReadonly(),
      earlyAccessModalState: earlyAccessStateSignal.asReadonly(),
      isPaymentsProtected: isProtectedSignal.asReadonly(),
      displayCurrency: displayCurrencySignal.asReadonly(),
      setDisplayCurrency: vi.fn((curr: BillingDisplayCurrency) => {
        displayCurrencySignal.set(curr === 'USD' ? 'USD' : 'COP');
      }),
      getMonthlyCop: vi.fn((plan: PaidPlan, cycle: CheckoutCycleInput = 'monthly') => {
        const normalized = cycle === 'annual' || cycle === 'yearly' ? 'annual' : 'monthly';
        return normalized === 'annual'
          ? OFFICIAL_COP_PRICING[plan].annualMonthly
          : OFFICIAL_COP_PRICING[plan].monthly;
      }),
      getCopEstimate: vi.fn((plan: PaidPlan, cycle: CheckoutCycleInput = 'monthly') => {
        const normalized = cycle === 'annual' || cycle === 'yearly' ? 'annual' : 'monthly';
        const amountCop =
          normalized === 'annual'
            ? OFFICIAL_COP_PRICING[plan].annualTotal
            : OFFICIAL_COP_PRICING[plan].monthly;
        return {
          amountUsd: Math.round((amountCop / exchangeRateCop) * 100) / 100,
          exchangeRateCop,
          amountCop,
          amountInCents: amountCop * 100
        };
      }),
      convertCopToUsd: vi.fn((amountCop: number) => Math.round((amountCop / exchangeRateCop) * 100) / 100),
      openCheckout: vi.fn(async (plan: PaidPlan, cycle: CheckoutCycleInput = 'monthly') => {
        const normalizedCycle: 'monthly' | 'annual' = cycle === 'yearly' ? 'annual' : cycle;
        if (isProtectedSignal()) {
          upgradeStateSignal.set(null);
          earlyAccessStateSignal.set({
            plan,
            cycle: normalizedCycle,
            sourceRoute: '/studio/designer'
          });
        }
      }),
      closeUpgradeModal: vi.fn(() => {
        upgradeStateSignal.set(null);
      })
    };

    await TestBed.configureTestingModule({
      imports: [UpgradePlanModalComponent],
      providers: [{ provide: PaymentService, useValue: mockPaymentService }]
    }).compileComponents();

    const exchange = TestBed.inject(CurrencyExchangeService);
    exchange.rates.set({ ...DEFAULT_COP_RATES });
    landingPricingConfig = TestBed.inject(LandingPricingConfigService);
    TestBed.inject(I18nService).setLanguage('es');
    fixture = TestBed.createComponent(UpgradePlanModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe permanecer oculto cuando upgradeModalState es null', () => {
    expect(component.isOpen()).toBe(false);
    const modal = fixture.nativeElement.querySelector('[data-testid="upgrade-plan-modal"]');
    expect(modal).toBeNull();
  });

  it('debe abrirse para modules_limit mostrando ambos planes (Pro e Industrial)', () => {
    upgradeStateSignal.set({
      reason: 'modules_limit',
      requiredPlan: 'pro',
      featureName: 'Módulos 3D'
    });
    fixture.detectChanges();

    expect(component.isOpen()).toBe(true);
    expect(component.titleKey()).toBe('upgrade.modulesLimitTitle');
    expect(component.subtitleKey()).toBe('upgrade.modulesLimitDesc');
    expect(component.badgeKey()).toBe('upgrade.badgePro');

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="upgrade-plan-modal"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="upgrade-modal-cta-pro"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="upgrade-modal-cta-industrial"]')).toBeTruthy();
  });

  it('debe resolver claves de workshop_export correctamente', () => {
    upgradeStateSignal.set({
      reason: 'workshop_export',
      requiredPlan: 'pro'
    });
    fixture.detectChanges();

    expect(component.titleKey()).toBe('upgrade.workshopExportTitle');
    expect(component.subtitleKey()).toBe('upgrade.workshopExportDesc');
    expect(component.badgeKey()).toBe('upgrade.badgePro');
  });

  it('debe ocultar la tarjeta Pro cuando requiredPlan es industrial (cnc_export)', () => {
    upgradeStateSignal.set({
      reason: 'cnc_export',
      requiredPlan: 'industrial'
    });
    fixture.detectChanges();

    expect(component.titleKey()).toBe('upgrade.cncExportTitle');
    expect(component.subtitleKey()).toBe('upgrade.cncExportDesc');
    expect(component.badgeKey()).toBe('upgrade.badgeIndustrial');

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="upgrade-modal-cta-pro"]')).toBeNull();
    expect(root.querySelector('[data-testid="upgrade-modal-cta-industrial"]')).toBeTruthy();
  });

  it('debe alternar tarifas oficiales en COP y conversión viva en USD entre ciclo Mensual y Anual (-20%)', () => {
    upgradeStateSignal.set({
      reason: 'modules_limit',
      requiredPlan: 'pro'
    });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(component.displayCurrency()).toBe('COP');
    expect(root.querySelector('[data-testid="upgrade-pro-price"]')?.textContent?.trim()).toBe('$ 49.900 COP');
    expect(root.querySelector('[data-testid="upgrade-ind-price"]')?.textContent?.trim()).toBe('$ 95.900 COP');
    expect(root.querySelector('[data-testid="upgrade-pro-currency-hint"]')?.textContent).toContain('≈ $ 15.10 USD');
    expect(root.querySelector('[data-testid="upgrade-ind-currency-hint"]')?.textContent).toContain('≈ $ 29.03 USD');
    expect(root.textContent).not.toContain('$15 USD');
    expect(root.textContent).not.toContain('$29 USD');

    const annualBtn = root.querySelector('[data-testid="upgrade-cycle-annual-btn"]') as HTMLButtonElement | null;
    annualBtn?.click();
    fixture.detectChanges();

    expect(component.billingCycle()).toBe('annual');
    expect(root.querySelector('[data-testid="upgrade-pro-price"]')?.textContent?.trim()).toBe('$ 39.920 COP');
    expect(root.querySelector('[data-testid="upgrade-ind-price"]')?.textContent?.trim()).toBe('$ 76.720 COP');
    expect(root.querySelector('[data-testid="upgrade-pro-annual-summary"]')?.textContent).toContain('-20%');
    expect(root.querySelector('[data-testid="upgrade-pro-annual-summary"]')?.textContent).toContain('$ 479.040 COP / año');
    expect(root.querySelector('[data-testid="upgrade-ind-annual-summary"]')?.textContent).toContain('$ 920.640 COP / año');
    expect(root.querySelector('[data-testid="upgrade-pro-currency-hint"]')?.textContent).toContain('≈ $ 12.08 USD');
    expect(root.querySelector('[data-testid="upgrade-ind-currency-hint"]')?.textContent).toContain('≈ $ 23.22 USD');
    expect(root.textContent).not.toContain('$12 USD');
    expect(root.textContent).not.toContain('$23 USD');

    const monthlyBtn = root.querySelector('[data-testid="upgrade-cycle-monthly-btn"]') as HTMLButtonElement | null;
    monthlyBtn?.click();
    fixture.detectChanges();

    expect(component.billingCycle()).toBe('monthly');
    expect(root.querySelector('[data-testid="upgrade-pro-price"]')?.textContent?.trim()).toBe('$ 49.900 COP');
  });

  it('debe alternar entre COP ($) y USD ($) conectado a PaymentService.displayCurrency mostrando cobro oficial Wompi', () => {
    upgradeStateSignal.set({
      reason: 'modules_limit',
      requiredPlan: 'pro'
    });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const usdBtn = root.querySelector('[data-testid="upgrade-currency-usd-btn"]') as HTMLButtonElement | null;
    const copBtn = root.querySelector('[data-testid="upgrade-currency-cop-btn"]') as HTMLButtonElement | null;
    expect(usdBtn).toBeTruthy();
    expect(copBtn).toBeTruthy();

    // Cambiar a USD en mensual
    usdBtn?.click();
    fixture.detectChanges();

    expect(mockPaymentService.setDisplayCurrency).toHaveBeenCalledWith('USD');
    expect(component.displayCurrency()).toBe('USD');
    expect(root.querySelector('[data-testid="upgrade-pro-price"]')?.textContent?.trim()).toBe('≈ $ 15.10 USD');
    expect(root.querySelector('[data-testid="upgrade-ind-price"]')?.textContent?.trim()).toBe('≈ $ 29.03 USD');
    expect(root.querySelector('[data-testid="upgrade-pro-currency-hint"]')?.textContent).toContain('Cobro oficial Wompi:');
    expect(root.querySelector('[data-testid="upgrade-pro-currency-hint"]')?.textContent).toContain('$ 49.900 COP');
    expect(root.querySelector('[data-testid="upgrade-ind-currency-hint"]')?.textContent).toContain('$ 95.900 COP');

    // Cambiar a anual en USD
    const annualBtn = root.querySelector('[data-testid="upgrade-cycle-annual-btn"]') as HTMLButtonElement | null;
    annualBtn?.click();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="upgrade-pro-price"]')?.textContent?.trim()).toBe('≈ $ 12.08 USD');
    expect(root.querySelector('[data-testid="upgrade-pro-annual-summary"]')?.textContent).toContain('-20%');
    expect(root.querySelector('[data-testid="upgrade-pro-annual-summary"]')?.textContent).toContain('≈ $ 144.99 USD / año');
    expect(root.querySelector('[data-testid="upgrade-pro-currency-hint"]')?.textContent).toContain('$ 479.040 COP / año');

    // Volver a COP
    copBtn?.click();
    fixture.detectChanges();
    expect(mockPaymentService.setDisplayCurrency).toHaveBeenCalledWith('COP');
    expect(component.displayCurrency()).toBe('COP');
    expect(root.querySelector('[data-testid="upgrade-pro-price"]')?.textContent?.trim()).toBe('$ 39.920 COP');
  });

  it('por defecto (payments_enabled === false) debe mostrar aviso informativo, deshabilitar botones con "Próximamente" y bloquear openCheckout', () => {
    expect(landingPricingConfig.isPaymentsActive()).toBe(false);
    upgradeStateSignal.set({
      reason: 'modules_limit',
      requiredPlan: 'pro'
    });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const notice = root.querySelector('[data-testid="upgrade-payments-disabled-notice"]') as HTMLElement | null;
    expect(notice).toBeTruthy();
    expect(notice?.textContent).toContain('Pagos en línea en implementación');

    const proCta = root.querySelector('[data-testid="upgrade-modal-cta-pro"]') as HTMLButtonElement | null;
    const indCta = root.querySelector('[data-testid="upgrade-modal-cta-industrial"]') as HTMLButtonElement | null;
    expect(proCta).toBeTruthy();
    expect(indCta).toBeTruthy();
    expect(proCta?.disabled).toBe(true);
    expect(indCta?.disabled).toBe(true);
    expect(proCta?.textContent).toContain('Próximamente');
    expect(indCta?.textContent).toContain('Próximamente');

    proCta?.click();
    indCta?.click();
    component.selectPlan('pro');
    component.selectPlan('industrial');
    expect(mockPaymentService.openCheckout).not.toHaveBeenCalled();

    const ipNote = root.querySelector('[data-testid="upgrade-ip-guarantee-note"]') as HTMLElement | null;
    expect(ipNote).toBeTruthy();
    expect(ipNote?.textContent).toContain('100% Propiedad Intelectual Tuya');

    landingPricingConfig.applyLocalConfig({
      ip_guarantee_enabled: false,
      payments_enabled: true
    });
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="upgrade-payments-disabled-notice"]')).toBeNull();
    expect(root.querySelector('[data-testid="upgrade-ip-guarantee-note"]')).toBeNull();
    expect((root.querySelector('[data-testid="upgrade-modal-cta-pro"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('debe reflejar tarifas y descuento anual dinámicos desde LandingPricingConfigService', () => {
    const custom = cloneLandingPricingConfig(DEFAULT_LANDING_PRICING_CONFIG);
    custom.annual_discount_percent = 30;
    custom.plans[1].priceCopMonthly = 60000;
    landingPricingConfig.setLocalConfigForTesting(custom);

    upgradeStateSignal.set({
      reason: 'modules_limit',
      requiredPlan: 'pro'
    });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="upgrade-pro-price"]')?.textContent?.trim()).toBe('$ 60.000 COP');

    const annualBtn = root.querySelector('[data-testid="upgrade-cycle-annual-btn"]') as HTMLButtonElement | null;
    annualBtn?.click();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="upgrade-pro-price"]')?.textContent?.trim()).toBe('$ 42.000 COP');
    expect(root.querySelector('[data-testid="upgrade-pro-annual-summary"]')?.textContent).toContain('-30%');
    expect(root.querySelector('[data-testid="upgrade-pro-annual-summary"]')?.textContent).toContain('$ 504.000 COP / año');
  });

  it('al elegir Plan Taller Pro en modo protegido con payments_enabled === true debe delegar en openCheckout, cerrar UpgradeModal y abrir Acceso Anticipado', () => {
    landingPricingConfig.applyLocalConfig({ payments_enabled: true });
    upgradeStateSignal.set({
      reason: 'workshop_export',
      requiredPlan: 'pro'
    });
    fixture.detectChanges();

    const proCta = fixture.nativeElement.querySelector(
      '[data-testid="upgrade-modal-cta-pro"]'
    ) as HTMLButtonElement | null;
    expect(proCta?.disabled).toBe(false);
    proCta?.click();
    fixture.detectChanges();

    expect(mockPaymentService.openCheckout).toHaveBeenCalledWith('pro', 'monthly');
    expect(upgradeStateSignal()).toBeNull();
    expect(earlyAccessStateSignal()).toEqual({
      plan: 'pro',
      cycle: 'monthly',
      sourceRoute: '/studio/designer'
    });
  });

  it('al elegir Plan Industrial en ciclo anual con payments_enabled === true debe delegar openCheckout("industrial", "annual")', () => {
    landingPricingConfig.applyLocalConfig({ payments_enabled: true });
    upgradeStateSignal.set({
      reason: 'cnc_export',
      requiredPlan: 'industrial'
    });
    fixture.detectChanges();

    const annualBtn = fixture.nativeElement.querySelector(
      '[data-testid="upgrade-cycle-annual-btn"]'
    ) as HTMLButtonElement | null;
    annualBtn?.click();
    fixture.detectChanges();

    const indCta = fixture.nativeElement.querySelector(
      '[data-testid="upgrade-modal-cta-industrial"]'
    ) as HTMLButtonElement | null;
    expect(indCta?.disabled).toBe(false);
    indCta?.click();
    fixture.detectChanges();

    expect(mockPaymentService.openCheckout).toHaveBeenCalledWith('industrial', 'annual');
    expect(upgradeStateSignal()).toBeNull();
    expect(earlyAccessStateSignal()).toEqual({
      plan: 'industrial',
      cycle: 'annual',
      sourceRoute: '/studio/designer'
    });
  });

  it('debe cerrarse con el botón X y la tecla Escape solo cuando está abierto', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(mockPaymentService.closeUpgradeModal).not.toHaveBeenCalled();

    upgradeStateSignal.set({
      reason: 'modules_limit',
      requiredPlan: 'pro'
    });
    fixture.detectChanges();

    const closeBtn = fixture.nativeElement.querySelector(
      '[data-testid="upgrade-modal-close-btn"]'
    ) as HTMLButtonElement | null;
    closeBtn?.click();
    fixture.detectChanges();
    expect(mockPaymentService.closeUpgradeModal).toHaveBeenCalledTimes(1);
    expect(upgradeStateSignal()).toBeNull();

    upgradeStateSignal.set({
      reason: 'cnc_export',
      requiredPlan: 'industrial'
    });
    fixture.detectChanges();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(mockPaymentService.closeUpgradeModal).toHaveBeenCalledTimes(2);
    expect(upgradeStateSignal()).toBeNull();
  });
});
