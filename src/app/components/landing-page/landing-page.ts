import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  AlertCircleIcon,
  BookOpen01Icon,
  Cabinet01Icon,
  Cancel01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  ChipIcon,
  Clock01Icon,
  CloudIcon,
  Compass01Icon,
  ComputerIcon,
  CpuIcon,
  CubeIcon,
  Download01Icon,
  Globe02Icon,
  InformationCircleIcon,
  LaptopIcon,
  Layers01Icon,
  LockIcon,
  Logout01Icon,
  Mouse01Icon,
  Note01Icon,
  QuoteUpIcon,
  Rocket01Icon,
  RulerIcon,
  ScissorsIcon,
  Settings01Icon,
  Shield01Icon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  Tag01Icon,
  Tick02Icon,
  UserIcon,
  Wifi01Icon
} from '@hugeicons/core-free-icons';

import { I18nService } from '../../services/i18n.service';
import { SupabaseService } from '../../services/supabase.service';
import { OFFICIAL_COP_PRICING, PaymentService } from '../../services/payment.service';
import { CurrencyExchangeService } from '../../services/currency-exchange.service';
import {
  LandingPricingConfigService,
  computeAnnualMonthlyCop,
  computeAnnualTotalCop
} from '../../services/landing-pricing-config.service';
import {
  DEFAULT_LANDING_PRICING_CONFIG,
  LandingPlanConfig,
  LandingPlanFeature
} from '../../models/landing-pricing.models';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppLanguage } from '../../data/i18n-translations.data';
import { UserFeedbackRecord } from '../../models/feedback.models';
import { resolvePublicSupportEmail } from '../../utils/support-email';

export type PricingCurrencyCode = 'COP' | 'USD' | 'MXN' | 'EUR';

export interface PricingCurrencyOption {
  code: PricingCurrencyCode;
  label: string;
  symbol: string;
}

export type AnnouncementType = 'info' | 'warning' | 'maintenance';

export interface SystemAnnouncement {
  id: string;
  type: AnnouncementType;
  badge?: string;
  message: string;
  timestamp?: string;
  dismissible?: boolean;
}

export interface PlanPriceConfig {
  monthly: number;
  yearly: number;
  yearlyTotal?: number;
}

export interface SitePricingConfig {
  starter: PlanPriceConfig;
  pro: PlanPriceConfig;
  industrial: PlanPriceConfig;
}

export interface SiteCmsConfig {
  pricing: SitePricingConfig;
  announcement: SystemAnnouncement | null;
}

export interface DisplayTestimonial {
  id: string;
  name: string;
  role: string;
  location: string;
  rating: number;
  message: string;
  isRealCloud: boolean;
}

export interface LandingFaqItem {
  readonly id: string;
  readonly questionKey: string;
  readonly answerKey: string;
}

/**
 * Landing Page Oficial de Piezo3D Studio.
 * Estándar Enterprise Light UI con fondos limpios (#ffffff, #f8fafc),
 * acentos azul técnico (#2563eb) y pizarra (#0f172a), fuente Inter y 100% Hugeicons.
 */
@Component({
  selector: 'app-landing-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    HugeiconsIconComponent,
    TranslatePipe
  ],
  host: {
    '(window:click)': 'onDocumentClick()',
    '(window:keydown.escape)': 'onEscapeKey()'
  },
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
})
export class LandingPageComponent implements OnInit {
  readonly i18n = inject(I18nService);
  readonly supabaseService = inject(SupabaseService);
  readonly paymentService = inject(PaymentService);
  readonly landingPricingConfig = inject(LandingPricingConfigService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly currencyExchange = inject(CurrencyExchangeService);

  // Estado reactivo seguro de sesión y perfil para barra superior y CTAs de planes
  readonly isAuthenticated = computed<boolean>(() =>
    typeof this.supabaseService.isAuthenticated === 'function'
      ? this.supabaseService.isAuthenticated()
      : false
  );

  readonly userProfile = computed(() =>
    typeof this.supabaseService.userProfile === 'function'
      ? this.supabaseService.userProfile()
      : null
  );

  readonly userFirstName = computed<string>(() => {
    const firstName = this.userProfile()?.first_name?.trim();
    if (firstName) {
      return firstName;
    }
    const user = typeof this.supabaseService.currentUser === 'function'
      ? this.supabaseService.currentUser()
      : null;
    const metaFirst = typeof user?.user_metadata?.['first_name'] === 'string'
      ? user.user_metadata['first_name'].trim()
      : '';
    if (metaFirst) {
      return metaFirst;
    }
    return user?.email?.split('@')[0] || this.i18n.t('auth.defaultUserName');
  });

  // Iconos oficiales de Hugeicons (cero SVGs inline y cero emojis)
  readonly icons = {
    brand: Compass01Icon,
    cube: CubeIcon,
    ruler: RulerIcon,
    layers: Layers01Icon,
    tag: Tag01Icon,
    book: BookOpen01Icon,
    download: Download01Icon,
    check: CheckmarkCircle02Icon,
    tick: Tick02Icon,
    lock: AlertCircleIcon,
    limit: AlertCircleIcon,
    padlock: LockIcon,
    clock: Clock01Icon,
    copy: Note01Icon,
    discountTag: Tag01Icon,
    shieldCheck: ShieldCheckIcon,
    alertCircle: AlertCircleIcon,
    cancel: Cancel01Icon,
    star: StarIcon,
    quote: QuoteUpIcon,
    arrowRight: ArrowRight01Icon,
    arrowDown: ArrowDown01Icon,
    arrowUp: ArrowUp01Icon,
    sparkles: SparklesIcon,
    cloud: CloudIcon,
    globe: Globe02Icon,
    user: UserIcon,
    logout: Logout01Icon,
    checklist: CheckListIcon,
    scissors: ScissorsIcon,
    cabinet: Cabinet01Icon,
    settings: Settings01Icon,
    rocket: Rocket01Icon,
    shield: Shield01Icon,
    menu: CheckListIcon,
    chip: ChipIcon,
    cpu: CpuIcon,
    computer: ComputerIcon,
    laptop: LaptopIcon,
    mouse: Mouse01Icon,
    wifi: Wifi01Icon,
    infoCircle: InformationCircleIcon
  };

  // Estado dinámico de precios, promociones, pasarela e IP desde LandingPricingConfigService
  readonly dynamicPricingConfig = this.landingPricingConfig.config;
  readonly isPaymentsActive = this.landingPricingConfig.isPaymentsActive;
  readonly isPromoActive = this.landingPricingConfig.isPromoCurrentlyActive;
  readonly dynamicPlans = computed<readonly LandingPlanConfig[]>(
    () => this.dynamicPricingConfig().plans
  );
  readonly annualDiscountPercent = computed<number>(
    () => this.dynamicPricingConfig().annual_discount_percent
  );

  readonly promoCodeCopied = signal<boolean>(false);
  private promoCopyTimer: ReturnType<typeof setTimeout> | null = null;

  readonly promoExpirationLabel = computed<string | null>(() => {
    if (!this.isPromoActive()) {
      return null;
    }
    const rawExpiry = this.dynamicPricingConfig().promo_expires_at;
    if (!rawExpiry || !rawExpiry.trim()) {
      return null;
    }
    const parsed = new Date(rawExpiry);
    const ts = parsed.getTime();
    if (!Number.isFinite(ts) || ts <= Date.now()) {
      return null;
    }
    const formatted = new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(parsed);
    return `Válido hasta el ${formatted}`;
  });

  // Fuentes legadas de configuración para compatibilidad de pruebas CMS
  private readonly platformSettingsPricing = signal<SitePricingConfig | null>(null);
  private readonly cmsPricingOverride = signal<SitePricingConfig | null>(null);

  // Configuración reactiva de precios oficiales en COP (dinámica + respaldo CMS)
  readonly pricingConfig = computed<SitePricingConfig>(() => {
    const cmsOverride = this.cmsPricingOverride();
    if (cmsOverride) {
      return cmsOverride;
    }

    const cfg = this.dynamicPricingConfig();
    const proPlan = cfg.plans.find((p) => p.id === 'pro');
    const indPlan = cfg.plans.find((p) => p.id === 'industrial');
    const proMonthly = proPlan?.priceCopMonthly ?? OFFICIAL_COP_PRICING.pro.monthly;
    const indMonthly = indPlan?.priceCopMonthly ?? OFFICIAL_COP_PRICING.industrial.monthly;
    const discount = cfg.annual_discount_percent;

    const hasCustomLandingPricing =
      this.landingPricingConfig.hasLoadedRemote() ||
      discount !== DEFAULT_LANDING_PRICING_CONFIG.annual_discount_percent ||
      proMonthly !== OFFICIAL_COP_PRICING.pro.monthly ||
      indMonthly !== OFFICIAL_COP_PRICING.industrial.monthly;

    const legacyPlatform = this.platformSettingsPricing();
    if (!hasCustomLandingPricing && legacyPlatform) {
      return legacyPlatform;
    }

    return {
      starter: { monthly: 0, yearly: 0, yearlyTotal: 0 },
      pro: {
        monthly: proMonthly,
        yearly: computeAnnualMonthlyCop(proMonthly, discount),
        yearlyTotal: computeAnnualTotalCop(proMonthly, discount)
      },
      industrial: {
        monthly: indMonthly,
        yearly: computeAnnualMonthlyCop(indMonthly, discount),
        yearlyTotal: computeAnnualTotalCop(indMonthly, discount)
      }
    };
  });

  // Banner dinámico de avisos / mantenimiento (controlado desde CMS SuperAdmin)
  readonly systemAnnouncement = signal<SystemAnnouncement | null>(null);

  // Configuración unificada para CMS
  readonly cmsConfig = computed<SiteCmsConfig>(() => ({
    pricing: this.pricingConfig(),
    announcement: this.systemAnnouncement()
  }));

  // Estado del ciclo de facturación (mensual / anual con 20% descuento)
  readonly billingCycle = signal<'monthly' | 'yearly'>('monthly');

  // Moneda inicial en COP con conversión referencial en vivo vía CurrencyExchangeService
  readonly selectedPricingCurrency = signal<PricingCurrencyCode>('COP');

  readonly pricingCurrencies: readonly PricingCurrencyOption[] = [
    { code: 'COP', label: 'COP ($)', symbol: '$' },
    { code: 'USD', label: 'USD ($)', symbol: '$' },
    { code: 'MXN', label: 'MXN ($)', symbol: '$' },
    { code: 'EUR', label: 'EUR (€)', symbol: '€' }
  ];

  // Estado interactivo de la maqueta visual del Hero
  readonly mockupTab = signal<'designer' | 'parts' | 'optimizer' | 'budget' | 'guide'>('designer');
  readonly clearanceMm = signal<number>(370);

  // Estado de menús y modales interactivos
  readonly isLangDropdownOpen = signal<boolean>(false);
  readonly isMobileMenuOpen = signal<boolean>(false);
  readonly showLoginModal = signal<boolean>(false);
  readonly selectedPlanKey = signal<'pro' | 'industrial' | null>(null);

  // Estado del acordeón de Preguntas Frecuentes (FAQ)
  readonly openFaqIndex = signal<number | null>(0);
  readonly faqItems: readonly LandingFaqItem[] = [
    {
      id: 'faq-design-3d',
      questionKey: 'landing.faq.q1',
      answerKey: 'landing.faq.a1'
    },
    {
      id: 'faq-cutlist-optimizer',
      questionKey: 'landing.faq.q2',
      answerKey: 'landing.faq.a2'
    },
    {
      id: 'faq-exports-cnc',
      questionKey: 'landing.faq.q3',
      answerKey: 'landing.faq.a3'
    },
    {
      id: 'faq-free-start',
      questionKey: 'landing.faq.q4',
      answerKey: 'landing.faq.a4'
    }
  ];

  // Testimonios cargados en vivo desde Supabase
  readonly cloudTestimonials = signal<UserFeedbackRecord[]>([]);
  readonly isLoadingTestimonials = signal<boolean>(false);

  // Testimonios combinados (en vivo + respaldo verificado)
  readonly testimonialsList = computed<DisplayTestimonial[]>(() => {
    const live = this.cloudTestimonials();
    const result: DisplayTestimonial[] = [];

    // 1. Agregar testimonios reales aprobados con 4 o 5 estrellas
    for (const item of live) {
      if ((item.rating ?? 0) >= 4 && item.message && item.message.trim().length > 10) {
        result.push({
          id: item.id,
          name: item.author_name || 'Fabricante Profesional',
          role: item.author_role || 'Carpintería de Mobiliario',
          location: item.author_location || 'Taller Verificado',
          rating: item.rating ?? 5,
          message: item.message,
          isRealCloud: true
        });
      }
    }

    // 2. Si hay menos de 3 testimonios en la nube, complementar con los testimonios base de respaldo
    if (result.length < 3) {
      const fallbackList: DisplayTestimonial[] = [
        {
          id: 'fb-1',
          name: this.i18n.t('landing.testimonials.t1Name'),
          role: this.i18n.t('landing.testimonials.t1Role'),
          location: this.i18n.t('landing.testimonials.t1Loc'),
          rating: 5,
          message: this.i18n.t('landing.testimonials.t1Text'),
          isRealCloud: false
        },
        {
          id: 'fb-2',
          name: this.i18n.t('landing.testimonials.t2Name'),
          role: this.i18n.t('landing.testimonials.t2Role'),
          location: this.i18n.t('landing.testimonials.t2Loc'),
          rating: 5,
          message: this.i18n.t('landing.testimonials.t2Text'),
          isRealCloud: false
        },
        {
          id: 'fb-3',
          name: this.i18n.t('landing.testimonials.t3Name'),
          role: this.i18n.t('landing.testimonials.t3Role'),
          location: this.i18n.t('landing.testimonials.t3Loc'),
          rating: 5,
          message: this.i18n.t('landing.testimonials.t3Text'),
          isRealCloud: false
        }
      ];

      for (const fb of fallbackList) {
        if (result.length < 3) {
          result.push(fb);
        }
      }
    }

    return result.slice(0, 3);
  });

  readonly currentLanguageOption = this.i18n.currentLanguageOption;
  readonly supportedLanguages = this.i18n.languages;
  readonly isProcessingAuthCallback = signal<boolean>(false);

  readonly supportEmail = computed<string>(() => {
    const settingsFn = (
      this.supabaseService as {
        platformSettings?: () => { support_email?: string } | null;
      }
    ).platformSettings;
    const rawEmail = typeof settingsFn === 'function' ? settingsFn()?.support_email : undefined;
    return resolvePublicSupportEmail(rawEmail);
  });

  ngOnInit(): void {
    this.currencyExchange.initRates();
    const supabaseCfg = (
      this.supabaseService as {
        config?: { url?: string; publishableKey?: string };
      }
    ).config;
    if (supabaseCfg?.url && supabaseCfg?.publishableKey) {
      void this.landingPricingConfig.loadConfig();
    }
    const loadSettingsFn = (
      this.supabaseService as {
        loadPlatformSettings?: () => Promise<unknown>;
      }
    ).loadPlatformSettings;
    if (typeof loadSettingsFn === 'function') {
      void loadSettingsFn.call(this.supabaseService);
    }
    void this.fetchCommunityTestimonials();
    this.checkAuthCallback();
  }

  private checkAuthCallback(): void {
    if (typeof window === 'undefined') return;

    if (typeof this.supabaseService.hasAuthErrorParams === 'function' && this.supabaseService.hasAuthErrorParams()) {
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
      const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
      const errorCode = params.get('error_code') || hashParams.get('error_code') || params.get('error') || hashParams.get('error') || 'oauth_error';
      void this.router.navigate(['/auth'], {
        queryParams: { mode: 'login', error: errorCode },
        replaceUrl: true
      });
      return;
    }

    if (typeof this.supabaseService.hasAuthCallbackParams === 'function' && this.supabaseService.hasAuthCallbackParams()) {
      this.isProcessingAuthCallback.set(true);
      const waitPromise = typeof this.supabaseService.waitForAuthReady === 'function'
        ? this.supabaseService.waitForAuthReady()
        : Promise.resolve(this.supabaseService.currentUser?.() ?? null);

      void waitPromise.then(() => {
        const user = typeof this.supabaseService.currentUser === 'function' ? this.supabaseService.currentUser() : null;
        if (user) {
          void this.router.navigateByUrl('/studio', { replaceUrl: true });
        } else {
          this.isProcessingAuthCallback.set(false);
        }
      });
    }
  }

  async fetchCommunityTestimonials(): Promise<void> {
    this.isLoadingTestimonials.set(true);
    try {
      let records: UserFeedbackRecord[] = [];
      if (typeof this.supabaseService.getPublicTestimonials === 'function') {
        const publicRecords = await this.supabaseService.getPublicTestimonials(6);
        if (Array.isArray(publicRecords)) {
          records = [...publicRecords];
        }
      }

      const getApprovedFn = (
        this.supabaseService as {
          getApprovedPlatformTestimonials?: (limit?: number) => Promise<
            {
              id: string;
              user_id: string | null;
              user_name: string;
              user_email: string | null;
              user_role_title: string | null;
              subject: string | null;
              message: string;
              rating: number | null;
              created_at: string;
            }[]
          >;
        }
      ).getApprovedPlatformTestimonials;

      if (typeof getApprovedFn === 'function') {
        const approved = await getApprovedFn.call(this.supabaseService, 6);
        if (Array.isArray(approved)) {
          for (const item of approved) {
            if (!records.some((r) => r.id === item.id)) {
              records.push({
                id: item.id,
                user_id: item.user_id,
                category: 'testimonial',
                title: item.subject || 'Testimonio',
                message: item.message,
                contact_email: item.user_email || '',
                rating: item.rating ?? 5,
                author_name: item.user_name || 'Fabricante Profesional',
                author_role: item.user_role_title || 'Taller de Carpintería',
                author_location: 'Taller Verificado',
                allow_public_display: true,
                is_approved_public: true,
                app_version: 'v3.0.0',
                app_language: 'es',
                metadata: {},
                status: 'resolved',
                created_at: item.created_at || new Date().toISOString()
              });
            }
          }
        }
      }

      this.cloudTestimonials.set(records);
    } catch {
      this.cloudTestimonials.set([]);
    } finally {
      this.isLoadingTestimonials.set(false);
    }
  }

  setMockupTab(tab: 'designer' | 'parts' | 'optimizer' | 'budget' | 'guide'): void {
    this.mockupTab.set(tab);
  }

  adjustClearance(delta: number): void {
    this.clearanceMm.update(val => Math.max(250, Math.min(500, val + delta)));
  }

  onDocumentClick(): void {
    if (this.isLangDropdownOpen()) {
      this.isLangDropdownOpen.set(false);
    }
  }

  onEscapeKey(): void {
    this.isLangDropdownOpen.set(false);
    this.isMobileMenuOpen.set(false);
    this.closeLoginModal();
  }

  setBillingCycle(cycle: 'monthly' | 'yearly'): void {
    this.billingCycle.set(cycle);
  }

  /**
   * Abre el Checkout Overlay para el plan de pago seleccionado ('pro' o 'industrial')
   * usando el ciclo de facturación activo ('monthly' o 'annual').
   * Bloqueado si la pasarela global está desactivada (`payments_enabled === false`).
   */
  selectPaidPlan(plan: 'pro' | 'industrial'): void {
    if (!this.isPaymentsActive()) {
      return;
    }
    const cycle = this.billingCycle() === 'yearly' ? 'annual' : 'monthly';
    void this.paymentService.openCheckout(plan, cycle);
  }

  /**
   * Copia el código promocional al portapapeles y muestra confirmación temporal `'Copiado'`.
   */
  async copyPromoCode(code: string): Promise<void> {
    const cleanCode = code.trim();
    if (!cleanCode) {
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(cleanCode);
      }
    } catch {
      // Ignorar restricciones de portapapeles en navegadores o tests headless
    }
    this.promoCodeCopied.set(true);
    if (this.promoCopyTimer) {
      clearTimeout(this.promoCopyTimer);
    }
    this.promoCopyTimer = setTimeout(() => {
      this.promoCodeCopied.set(false);
      this.promoCopyTimer = null;
    }, 2000);
  }

  getIncludedFeatures(plan: LandingPlanConfig): readonly LandingPlanFeature[] {
    return plan.features.filter((feature) => !feature.isLimitation);
  }

  getLimitationFeatures(plan: LandingPlanConfig): readonly LandingPlanFeature[] {
    return plan.features.filter((feature) => Boolean(feature.isLimitation));
  }

  setPricingCurrency(currency: PricingCurrencyCode): void {
    this.selectedPricingCurrency.set(currency);
    if (currency === 'COP' || currency === 'USD') {
      const paymentWithDisplay = this.paymentService as {
        setDisplayCurrency?: (curr: 'COP' | 'USD') => void;
      };
      paymentWithDisplay.setDisplayCurrency?.(currency);
    }
  }

  /**
   * Formatea un monto oficial en Pesos Colombianos (COP), ej. "$ 49.900 COP".
   */
  formatCopPrice(amountCop: number): string {
    const rounded = Math.round(Math.max(0, Number(amountCop) || 0));
    return `$ ${rounded.toLocaleString('es-CO')} COP`;
  }

  /**
   * Formatea un monto canónico en COP convertido en vivo a la moneda seleccionada.
   */
  formatConvertedCurrencyPrice(amountCop: number, currency: PricingCurrencyCode): string {
    const safeCop = Math.max(0, Number(amountCop) || 0);
    if (currency === 'COP') {
      return this.formatCopPrice(safeCop);
    }
    if (safeCop <= 0) {
      return currency === 'EUR' ? '€ 0 EUR' : `$ 0 ${currency}`;
    }

    const converted = this.currencyExchange.convertFromCop(safeCop, currency);
    if (currency === 'USD') {
      const roundedUsd = Math.round(converted * 100) / 100;
      return `$ ${roundedUsd.toFixed(2)} USD`;
    }
    if (currency === 'EUR') {
      const roundedEur = Math.round(converted * 100) / 100;
      return `€ ${roundedEur.toFixed(2)} EUR`;
    }
    if (currency === 'MXN') {
      return `$ ${Math.round(converted).toLocaleString('es-MX')} MXN`;
    }
    return `$ ${Math.round(converted)} ${currency}`;
  }

  /**
   * Retorna el precio canónico en COP del periodo activo (mensual o anual/mes) para el plan indicado.
   */
  getPlanPeriodCop(plan: 'starter' | 'pro' | 'industrial'): number {
    if (plan === 'starter') {
      return 0;
    }
    const cfg = this.pricingConfig()[plan];
    return this.billingCycle() === 'monthly' ? cfg.monthly : cfg.yearly;
  }

  /**
   * Retorna el total anual oficial en COP para el plan indicado.
   */
  getPlanAnnualTotalCop(plan: 'pro' | 'industrial'): number {
    const cfg = this.pricingConfig()[plan];
    return cfg.yearlyTotal && cfg.yearlyTotal > 0 ? cfg.yearlyTotal : cfg.yearly * 12;
  }

  /**
   * Retorna el precio principal grande formateado según la moneda activa en Landing.
   */
  getPlanDisplayPrice(plan: 'starter' | 'pro' | 'industrial'): string {
    return this.formatConvertedCurrencyPrice(
      this.getPlanPeriodCop(plan),
      this.selectedPricingCurrency()
    );
  }

  /**
   * Calcula la conversión referencial en vivo a USD cuando la moneda activa es COP.
   * Cuando la moneda activa ya es extranjera ('USD' | 'MXN' | 'EUR'), retorna null porque el precio principal ya está convertido.
   */
  getConvertedPrice(copAmount: number): string | null {
    const curr = this.selectedPricingCurrency();
    if (curr !== 'COP') {
      return null;
    }
    return `≈ ${this.formatConvertedCurrencyPrice(copAmount, 'USD')}`;
  }

  /**
   * Construye el aviso de cobro oficial en COP por Wompi cuando se visualizan monedas extranjeras.
   */
  getOfficialWompiChargeText(plan: 'pro' | 'industrial'): string {
    const prefix = this.i18n.t('landing.pricing.officialWompiPrefix');
    if (this.billingCycle() === 'yearly') {
      const totalCop = this.formatCopPrice(this.getPlanAnnualTotalCop(plan));
      return `${prefix} ${totalCop} ${this.i18n.t('landing.pricing.yearlyPeriod')}`;
    }
    return `${prefix} ${this.formatCopPrice(this.pricingConfig()[plan].monthly)}`;
  }

  /**
   * Obtiene el texto de facturación anual con el total dinámico según pricingConfig() y la moneda activa.
   */
  getBilledYearlyText(plan: 'pro' | 'industrial'): string {
    const key = plan === 'pro' ? 'landing.pricing.planProBilledYearly' : 'landing.pricing.planIndBilledYearly';
    const baseText = this.i18n.t(key);
    const totalCop = this.getPlanAnnualTotalCop(plan);
    const formattedTotal = this.formatConvertedCurrencyPrice(totalCop, this.selectedPricingCurrency());
    return `${baseText} (${formattedTotal} ${this.i18n.t('landing.pricing.yearlyPeriod')})`;
  }

  toggleLanguageDropdown(event?: Event): void {
    event?.stopPropagation();
    this.isLangDropdownOpen.update(v => !v);
  }

  closeLanguageDropdown(): void {
    this.isLangDropdownOpen.set(false);
  }

  selectLanguage(lang: AppLanguage): void {
    this.i18n.setLanguage(lang);
    this.isLangDropdownOpen.set(false);
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(v => !v);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  scrollToSection(sectionId: string): void {
    this.closeMobileMenu();
    if (typeof document !== 'undefined') {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  toggleFaq(index: number): void {
    if (index < 0 || index >= this.faqItems.length) {
      return;
    }
    this.openFaqIndex.update(current => (current === index ? null : index));
  }

  openLoginModal(planKey?: 'pro' | 'industrial'): void {
    this.selectedPlanKey.set(planKey ?? null);
    this.showLoginModal.set(true);
  }

  closeLoginModal(): void {
    this.showLoginModal.set(false);
    this.selectedPlanKey.set(null);
  }

  goToStudio(): void {
    this.closeLoginModal();
    if (this.isAuthenticated()) {
      void this.router.navigateByUrl('/studio');
    } else {
      void this.router.navigate(['/auth'], { queryParams: { mode: 'login' } });
    }
  }

  handlePlanAction(): void {
    this.closeMobileMenu();
    if (this.isAuthenticated()) {
      void this.router.navigateByUrl('/studio');
      return;
    }
    void this.router.navigateByUrl('/auth?mode=register');
  }

  async signOut(): Promise<void> {
    this.closeMobileMenu();
    if (typeof this.supabaseService.signOut === 'function') {
      await this.supabaseService.signOut();
    }
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.promoCopyTimer) {
        clearTimeout(this.promoCopyTimer);
        this.promoCopyTimer = null;
      }
    });

    effect(() => {
      const isRecovery = typeof this.supabaseService.isPasswordRecoveryMode === 'function'
        ? this.supabaseService.isPasswordRecoveryMode()
        : false;
      if (isRecovery) {
        void this.router.navigateByUrl('/auth?mode=reset');
      }
    });

    effect(() => {
      const settingsFn = (
        this.supabaseService as {
          platformSettings?: () => {
            pro_monthly_cop?: number;
            pro_annual_monthly_cop?: number;
            pro_annual_total_cop?: number;
            industrial_monthly_cop?: number;
            industrial_annual_monthly_cop?: number;
            industrial_annual_total_cop?: number;
            announcement_enabled?: boolean;
            announcement_text?: string;
            announcement_badge?: string;
          } | null;
        }
      ).platformSettings;

      if (typeof settingsFn === 'function') {
        const s = settingsFn();
        if (s) {
          const proMonthlyCop = Number(s.pro_monthly_cop) > 0
            ? Math.round(Number(s.pro_monthly_cop))
            : OFFICIAL_COP_PRICING.pro.monthly;
          const proYearlyCop = Number(s.pro_annual_monthly_cop) > 0
            ? Math.round(Number(s.pro_annual_monthly_cop))
            : OFFICIAL_COP_PRICING.pro.annualMonthly;
          const proYearlyTotalCop = Number(s.pro_annual_total_cop) > 0
            ? Math.round(Number(s.pro_annual_total_cop))
            : (Number(s.pro_annual_monthly_cop) > 0
              ? proYearlyCop * 12
              : OFFICIAL_COP_PRICING.pro.annualTotal);

          const indMonthlyCop = Number(s.industrial_monthly_cop) > 0
            ? Math.round(Number(s.industrial_monthly_cop))
            : OFFICIAL_COP_PRICING.industrial.monthly;
          const indYearlyCop = Number(s.industrial_annual_monthly_cop) > 0
            ? Math.round(Number(s.industrial_annual_monthly_cop))
            : OFFICIAL_COP_PRICING.industrial.annualMonthly;
          const indYearlyTotalCop = Number(s.industrial_annual_total_cop) > 0
            ? Math.round(Number(s.industrial_annual_total_cop))
            : (Number(s.industrial_annual_monthly_cop) > 0
              ? indYearlyCop * 12
              : OFFICIAL_COP_PRICING.industrial.annualTotal);

          this.platformSettingsPricing.set({
            starter: { monthly: 0, yearly: 0, yearlyTotal: 0 },
            pro: {
              monthly: proMonthlyCop,
              yearly: proYearlyCop,
              yearlyTotal: proYearlyTotalCop
            },
            industrial: {
              monthly: indMonthlyCop,
              yearly: indYearlyCop,
              yearlyTotal: indYearlyTotalCop
            }
          });

          if (s.announcement_enabled && s.announcement_text && s.announcement_text.trim().length > 0) {
            this.systemAnnouncement.set({
              id: 'cms-global-announcement',
              type: s.announcement_badge?.toUpperCase() === 'MANTENIMIENTO' ? 'maintenance' : 'info',
              badge: s.announcement_badge?.trim() || 'NOVEDAD',
              message: s.announcement_text.trim(),
              dismissible: true
            });
          } else {
            this.systemAnnouncement.set(null);
          }
        }
      }
    });
  }

  dismissAnnouncement(): void {
    this.systemAnnouncement.set(null);
  }

  updateCmsConfig(config: Partial<SiteCmsConfig>): void {
    if (config.pricing) {
      this.cmsPricingOverride.set(config.pricing);
    }
    if (config.announcement !== undefined) {
      this.systemAnnouncement.set(config.announcement);
    }
  }
}
