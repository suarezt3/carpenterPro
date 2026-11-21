import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  ArrowRight01Icon,
  Cancel01Icon,
  Clock01Icon,
  Layers01Icon,
  LockIcon,
  LockPasswordIcon,
  Rocket01Icon,
  ShieldCheckIcon,
  SparklesIcon,
  Tick02Icon
} from '@hugeicons/core-free-icons';
import {
  BillingDisplayCurrency,
  CheckoutCycleInput,
  DEFAULT_COP_USD_FALLBACK_RATE,
  OFFICIAL_COP_PRICING,
  PaidPlan,
  PaymentService
} from '../../services/payment.service';
import {
  LandingPricingConfigService,
  computeAnnualMonthlyCop,
  computeAnnualTotalCop
} from '../../services/landing-pricing-config.service';
import { DEFAULT_LANDING_PRICING_CONFIG } from '../../models/landing-pricing.models';
import { CurrencyExchangeService } from '../../services/currency-exchange.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

interface PaymentServiceWithPricing {
  displayCurrency?: () => BillingDisplayCurrency;
  setDisplayCurrency?: (currency: BillingDisplayCurrency) => void;
  getMonthlyCop?: (plan: PaidPlan, cycle?: CheckoutCycleInput) => number;
  getCopEstimate?: (plan: PaidPlan, cycle?: CheckoutCycleInput) => {
    amountUsd?: number;
    exchangeRateCop?: number;
    amountCop?: number;
  };
  convertCopToUsd?: (amountCop: number) => number;
}

@Component({
  selector: 'app-upgrade-plan-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, TranslatePipe],
  host: {
    '(window:keydown.escape)': 'onEscape()'
  },
  templateUrl: './upgrade-plan-modal.html',
  styleUrl: './upgrade-plan-modal.css'
})
export class UpgradePlanModalComponent implements OnInit {
  readonly paymentService = inject(PaymentService);
  readonly landingPricingConfig = inject(LandingPricingConfigService);
  private readonly currencyExchange = inject(CurrencyExchangeService, { optional: true });
  private readonly i18n = inject(I18nService);

  readonly dynamicConfig = this.landingPricingConfig.config;
  readonly isPaymentsActive = this.landingPricingConfig.isPaymentsActive;
  readonly annualDiscountPercent = computed<number>(
    () => this.dynamicConfig().annual_discount_percent
  );

  readonly billingCycle = signal<'monthly' | 'annual'>('monthly');
  private readonly localDisplayCurrency = signal<BillingDisplayCurrency>('COP');

  readonly displayCurrency = computed<BillingDisplayCurrency>(() => {
    const svc = this.paymentService as unknown as PaymentServiceWithPricing;
    if (typeof svc.displayCurrency === 'function') {
      return svc.displayCurrency() === 'USD' ? 'USD' : 'COP';
    }
    return this.localDisplayCurrency();
  });

  readonly icons = {
    close: Cancel01Icon,
    rocket: Rocket01Icon,
    lock: LockPasswordIcon,
    padlock: LockIcon,
    clock: Clock01Icon,
    shieldCheck: ShieldCheckIcon,
    check: Tick02Icon,
    sparkles: SparklesIcon,
    layers: Layers01Icon,
    arrowRight: ArrowRight01Icon
  };

  readonly modalState = this.paymentService.upgradeModalState;
  readonly isOpen = computed(() => this.modalState() !== null);

  readonly titleKey = computed<string>(() => {
    const reason = this.modalState()?.reason;
    if (reason === 'cnc_export') return 'upgrade.cncExportTitle';
    if (reason === 'workshop_export') return 'upgrade.workshopExportTitle';
    return 'upgrade.modulesLimitTitle';
  });

  readonly subtitleKey = computed<string>(() => {
    const reason = this.modalState()?.reason;
    if (reason === 'cnc_export') return 'upgrade.cncExportDesc';
    if (reason === 'workshop_export') return 'upgrade.workshopExportDesc';
    return 'upgrade.modulesLimitDesc';
  });

  readonly badgeKey = computed<string>(() => {
    const req = this.modalState()?.requiredPlan;
    return req === 'industrial' ? 'upgrade.badgeIndustrial' : 'upgrade.badgePro';
  });

  ngOnInit(): void {
    this.currencyExchange?.initRates?.();
  }

  setBillingCycle(cycle: 'monthly' | 'annual'): void {
    this.billingCycle.set(cycle);
  }

  setDisplayCurrency(currency: BillingDisplayCurrency): void {
    const normalized: BillingDisplayCurrency = currency === 'USD' ? 'USD' : 'COP';
    this.localDisplayCurrency.set(normalized);
    const svc = this.paymentService as unknown as PaymentServiceWithPricing;
    svc.setDisplayCurrency?.(normalized);
  }

  private resolveDynamicPricingOverride(
    plan: PaidPlan
  ): { monthlyCop: number; discount: number } | null {
    const cfg = this.dynamicConfig();
    const planCfg = cfg.plans.find((p) => p.id === plan);
    const monthlyCop = planCfg?.priceCopMonthly ?? OFFICIAL_COP_PRICING[plan].monthly;
    const discount = cfg.annual_discount_percent;
    const isCustom =
      this.landingPricingConfig.hasLoadedRemote() ||
      discount !== DEFAULT_LANDING_PRICING_CONFIG.annual_discount_percent ||
      monthlyCop !== OFFICIAL_COP_PRICING[plan].monthly;
    return isCustom ? { monthlyCop, discount } : null;
  }

  /**
   * Obtiene el valor mensual oficial en COP para el plan y ciclo activos.
   */
  getPlanPeriodCop(plan: PaidPlan): number {
    const cycle = this.billingCycle();
    const dynamic = this.resolveDynamicPricingOverride(plan);
    if (dynamic) {
      return cycle === 'annual'
        ? computeAnnualMonthlyCop(dynamic.monthlyCop, dynamic.discount)
        : Math.round(dynamic.monthlyCop);
    }
    const svc = this.paymentService as unknown as PaymentServiceWithPricing;
    if (typeof svc.getMonthlyCop === 'function') {
      const value = Number(svc.getMonthlyCop(plan, cycle));
      if (Number.isFinite(value) && value > 0) {
        return Math.round(value);
      }
    }
    return cycle === 'annual'
      ? OFFICIAL_COP_PRICING[plan].annualMonthly
      : OFFICIAL_COP_PRICING[plan].monthly;
  }

  /**
   * Obtiene el total anual oficial en COP para el plan indicado.
   */
  getPlanAnnualTotalCop(plan: PaidPlan): number {
    const dynamic = this.resolveDynamicPricingOverride(plan);
    if (dynamic) {
      return computeAnnualTotalCop(dynamic.monthlyCop, dynamic.discount);
    }
    const svc = this.paymentService as unknown as PaymentServiceWithPricing;
    if (typeof svc.getCopEstimate === 'function') {
      const estimate = svc.getCopEstimate(plan, 'annual');
      const value = Number(estimate?.amountCop);
      if (Number.isFinite(value) && value > 0) {
        return Math.round(value);
      }
    }
    return OFFICIAL_COP_PRICING[plan].annualTotal;
  }

  /**
   * Obtiene el valor oficial en COP del cobro correspondiente al ciclo activo (mensual o total anual).
   */
  getPlanChargeCop(plan: PaidPlan): number {
    if (this.billingCycle() === 'annual') {
      return this.getPlanAnnualTotalCop(plan);
    }
    return this.getPlanPeriodCop(plan);
  }

  /**
   * Convierte un monto oficial en COP a su equivalente en vivo en USD.
   */
  convertCopToUsd(amountCop: number): number {
    const safeCop = Math.max(0, Number(amountCop) || 0);
    if (safeCop <= 0) {
      return 0;
    }

    const svc = this.paymentService as unknown as PaymentServiceWithPricing;
    if (typeof svc.convertCopToUsd === 'function') {
      const converted = Number(svc.convertCopToUsd(safeCop));
      if (Number.isFinite(converted) && converted > 0) {
        return Math.round(converted * 100) / 100;
      }
    }

    if (this.currencyExchange && typeof this.currencyExchange.convertFromCop === 'function') {
      const converted = Number(this.currencyExchange.convertFromCop(safeCop, 'USD'));
      if (Number.isFinite(converted) && converted > 0) {
        return Math.round(converted * 100) / 100;
      }
    }

    return Math.round((safeCop / DEFAULT_COP_USD_FALLBACK_RATE) * 100) / 100;
  }

  formatCop(amountCop: number): string {
    return `$ ${Math.round(Math.max(0, amountCop)).toLocaleString('es-CO')} COP`;
  }

  formatUsd(amountUsd: number): string {
    return `$ ${Math.max(0, amountUsd).toFixed(2)} USD`;
  }

  getMainPriceText(plan: PaidPlan): string {
    const periodCop = this.getPlanPeriodCop(plan);
    if (this.displayCurrency() === 'USD') {
      return `≈ ${this.formatUsd(this.convertCopToUsd(periodCop))}`;
    }
    return this.formatCop(periodCop);
  }

  getUsdEquivalentPeriodText(plan: PaidPlan): string {
    return `≈ ${this.formatUsd(this.convertCopToUsd(this.getPlanPeriodCop(plan)))}`;
  }

  getAnnualTotalText(plan: PaidPlan): string {
    const totalCop = this.getPlanAnnualTotalCop(plan);
    const yearlyPeriod = this.i18n.t('landing.pricing.yearlyPeriod');
    if (this.displayCurrency() === 'USD') {
      return `≈ ${this.formatUsd(this.convertCopToUsd(totalCop))} ${yearlyPeriod}`;
    }
    return `${this.formatCop(totalCop)} ${yearlyPeriod}`;
  }

  getOfficialChargeCopText(plan: PaidPlan): string {
    const chargeCop = this.getPlanChargeCop(plan);
    if (this.billingCycle() === 'annual') {
      return `${this.formatCop(chargeCop)} ${this.i18n.t('landing.pricing.yearlyPeriod')}`;
    }
    return this.formatCop(chargeCop);
  }

  selectPlan(plan: PaidPlan): void {
    if (!this.isPaymentsActive()) {
      return;
    }
    void this.paymentService.openCheckout(plan, this.billingCycle());
  }

  closeModal(): void {
    this.paymentService.closeUpgradeModal();
  }

  onEscape(): void {
    if (this.isOpen()) {
      this.closeModal();
    }
  }
}
