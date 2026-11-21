import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Add01Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  BoldIcon,
  Cancel01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  CircleArrowReload01Icon,
  Clock01Icon,
  CloudIcon,
  CreditCardIcon,
  CubeIcon,
  Delete02Icon,
  Globe02Icon,
  InformationCircleIcon,
  Invoice01Icon,
  Layers01Icon,
  LockPasswordIcon,
  Megaphone01Icon,
  QuoteUpIcon,
  RefreshIcon,
  Rocket01Icon,
  Settings01Icon,
  Shield01Icon,
  SlidersHorizontalIcon,
  SparklesIcon,
  StarIcon,
  Tag01Icon,
  Tick02Icon,
  UserIcon,
  ViewIcon
} from '@hugeicons/core-free-icons';

import {
  BillingCycle,
  PlatformFeedbackCategory,
  PlatformFeedbackRecord,
  PlatformFeedbackStatus,
  PlatformSettingsRecord,
  SubscriptionInvoice,
  SubscriptionStatus,
  SupabaseService,
  UserPlan,
  UserProfile,
  UserRole
} from '../../services/supabase.service';
import {
  DEFAULT_PAYMENTS_READINESS_MODE,
  PaidPlan,
  PaymentService,
  PaymentsReadinessMode
} from '../../services/payment.service';
import { CurrencyExchangeService } from '../../services/currency-exchange.service';
import {
  DEFAULT_LANDING_PRICING_CONFIG,
  LANDING_PRICING_ANNUAL_DISCOUNT_MAX,
  LANDING_PRICING_ANNUAL_DISCOUNT_MIN,
  LANDING_PRICING_PROMO_DISCOUNT_MAX,
  LANDING_PRICING_PROMO_DISCOUNT_MIN,
  LandingPlanConfig,
  LandingPlanFeature,
  LandingPlanId,
  LandingPricingConfig,
  cloneLandingPricingConfig,
  computeAnnualMonthlyCop,
  computeAnnualTotalCop,
  isPromoActiveAt
} from '../../models/landing-pricing.models';
import { LandingPricingConfigService } from '../../services/landing-pricing-config.service';
import { OFFICIAL_SUPPORT_EMAIL, resolvePublicSupportEmail } from '../../utils/support-email';

export type AdminSection =
  | 'overview'
  | 'users'
  | 'landing_pricing'
  | 'cms'
  | 'testimonials'
  | 'support';
export type AdminUserFilter = 'all' | 'free' | 'pro' | 'industrial' | 'super_admin' | 'suspended';
export type SupportCategoryFilter = 'all' | 'support' | 'bug';
export type SupportStatusFilter = 'all' | 'pending' | 'in_progress' | 'resolved';
export type PromoStatusState = 'disabled' | 'active' | 'expired';

export interface AdminNavItem {
  id: AdminSection;
  label: string;
  subtitle: string;
}

export interface AdminToastBanner {
  text: string;
  type: 'success' | 'error';
}

export interface UserProfilePatch {
  plan?: UserPlan;
  billing_cycle?: BillingCycle;
  subscription_status?: SubscriptionStatus;
  role?: UserRole;
  is_suspended?: boolean;
}

export type AdminPlatformSettingsRecord = PlatformSettingsRecord & {
  pro_monthly_cop?: number;
  pro_annual_monthly_cop?: number;
  pro_annual_total_cop?: number;
  industrial_monthly_cop?: number;
  industrial_annual_monthly_cop?: number;
  industrial_annual_total_cop?: number;
  usd_to_cop_rate?: number;
};

export interface AdminCopEstimateResult {
  amountUsd: number;
  exchangeRateCop: number;
  amountCop: number;
  amountInCents: number;
}

interface AdminPaymentBridge {
  paymentsMode?: () => PaymentsReadinessMode;
  togglePaymentsMode?: () => PaymentsReadinessMode;
  testAdminCheckout?: (
    plan: PaidPlan,
    cycle?: 'monthly' | 'annual' | 'yearly'
  ) => Promise<void>;
  getCopEstimate?: (
    plan: PaidPlan,
    cycle?: 'monthly' | 'annual' | 'yearly'
  ) => AdminCopEstimateResult;
  getMonthlyCop?: (
    plan: PaidPlan,
    cycle?: 'monthly' | 'annual' | 'yearly'
  ) => number;
  convertCopToUsd?: (amountCop: number) => number;
  isPreparingCheckout?: () => boolean;
  lastCheckoutError?: () => string | null;
  environment?: () => 'sandbox' | 'production';
  wompiEnvironment?: () => 'sandbox' | 'production';
}

const DEFAULT_PLATFORM_SETTINGS: AdminPlatformSettingsRecord = {
  id: 1,
  app_version: 'v3.0.0',
  support_email: OFFICIAL_SUPPORT_EMAIL,
  pro_monthly_usd: 15,
  pro_annual_monthly_usd: 12,
  pro_annual_total_usd: 144,
  industrial_monthly_usd: 29,
  industrial_annual_monthly_usd: 23,
  industrial_annual_total_usd: 276,
  pro_monthly_cop: 49900,
  pro_annual_monthly_cop: 39920,
  pro_annual_total_cop: 479040,
  industrial_monthly_cop: 95900,
  industrial_annual_monthly_cop: 76720,
  industrial_annual_total_cop: 920640,
  usd_to_cop_rate: 3304,
  announcement_enabled: false,
  announcement_text: '',
  announcement_badge: 'NOVEDAD',
  free_max_modules: 3,
  updated_at: new Date().toISOString()
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    HugeiconsIconComponent
  ],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit {
  readonly supabase = inject(SupabaseService);
  readonly paymentService = inject(PaymentService);
  readonly landingPricingConfig = inject(LandingPricingConfigService);
  readonly currencyExchange = inject(CurrencyExchangeService, { optional: true });
  private readonly fb = inject(NonNullableFormBuilder);

  readonly icons = {
    shield: Shield01Icon,
    cube: CubeIcon,
    layers: Layers01Icon,
    layout: SlidersHorizontalIcon,
    lock: LockPasswordIcon,
    user: UserIcon,
    settings: Settings01Icon,
    star: StarIcon,
    quote: QuoteUpIcon,
    checkList: CheckListIcon,
    info: InformationCircleIcon,
    invoice: Invoice01Icon,
    creditCard: CreditCardIcon,
    tag: Tag01Icon,
    discount: Megaphone01Icon,
    clock: Clock01Icon,
    add: Add01Icon,
    tick: Tick02Icon,
    cancel: Cancel01Icon,
    checkCircle: CheckmarkCircle02Icon,
    alert: AlertCircleIcon,
    arrowRight: ArrowRight01Icon,
    arrowUp: ArrowUp01Icon,
    arrowDown: ArrowDown01Icon,
    delete: Delete02Icon,
    bold: BoldIcon,
    view: ViewIcon,
    reset: RefreshIcon,
    cloud: CloudIcon,
    loading: CircleArrowReload01Icon,
    rocket: Rocket01Icon,
    sparkles: SparklesIcon,
    globe: Globe02Icon
  };

  readonly navItems: readonly AdminNavItem[] = [
    {
      id: 'overview',
      label: 'Resumen y Finanzas',
      subtitle: 'KPIs, MRR y actividad'
    },
    {
      id: 'users',
      label: 'Usuarios y Planes',
      subtitle: 'CRM y control de accesos'
    },
    {
      id: 'landing_pricing',
      label: 'Landing & Precios',
      subtitle: 'Pasarela, promo, sello IP y planes'
    },
    {
      id: 'cms',
      label: 'Precios y CMS Global',
      subtitle: 'Tarifas, versión y anuncios'
    },
    {
      id: 'testimonials',
      label: 'Testimonios Públicos',
      subtitle: 'Moderación y prueba social'
    },
    {
      id: 'support',
      label: 'Soporte y Reportes',
      subtitle: 'Tickets técnicos y bugs'
    }
  ];

  readonly starScale: readonly number[] = [1, 2, 3, 4, 5];

  // Navigation & UI state
  readonly activeSection = signal<AdminSection>('overview');
  readonly isLoading = signal<boolean>(false);
  readonly isSavingCms = signal<boolean>(false);
  readonly isCreatingTestimonial = signal<boolean>(false);
  readonly showNewTestimonialForm = signal<boolean>(false);
  readonly updatingUserId = signal<string | null>(null);
  readonly updatingFeedbackId = signal<string | null>(null);
  readonly savedFeedbackId = signal<string | null>(null);
  readonly toastBanner = signal<AdminToastBanner | null>(null);

  // Domain Collections
  readonly profiles = signal<UserProfile[]>([]);
  readonly invoices = signal<SubscriptionInvoice[]>([]);
  readonly feedbackList = signal<PlatformFeedbackRecord[]>([]);

  // CRM Filters
  readonly searchQuery = signal<string>('');
  readonly userFilter = signal<AdminUserFilter>('all');

  // Support Filters & Local Drafts
  readonly supportCategoryFilter = signal<SupportCategoryFilter>('all');
  readonly supportStatusFilter = signal<SupportStatusFilter>('all');
  readonly adminNotesDraft = signal<Record<string, string>>({});
  readonly ticketStatusDraft = signal<Record<string, PlatformFeedbackStatus>>({});

  // Landing & Precios Dynamic Editor Draft State (Module 3B)
  private lastHydratedLandingSnapshot = this.toLandingComparableSnapshot(
    this.landingPricingConfig.config()
  );
  readonly landingDraft = signal<LandingPricingConfig>(
    cloneLandingPricingConfig(this.landingPricingConfig.config())
  );
  readonly activePlanEditorTab = signal<LandingPlanId>('starter');
  readonly newFeatureTextDraft = signal<string>('');
  readonly newFeatureBoldDraft = signal<boolean>(false);
  readonly newFeatureLimitationDraft = signal<boolean>(false);

  readonly hasUnsavedLandingChanges = computed<boolean>(
    () =>
      this.toLandingComparableSnapshot(this.landingDraft()) !==
      this.toLandingComparableSnapshot(this.landingPricingConfig.config())
  );

  readonly activePlanDraft = computed<LandingPlanConfig>(() => {
    const draft = this.landingDraft();
    const activeId = this.activePlanEditorTab();
    return (
      draft.plans.find(plan => plan.id === activeId) ??
      draft.plans[0] ??
      cloneLandingPricingConfig(DEFAULT_LANDING_PRICING_CONFIG).plans[0]
    );
  });

  readonly promoStatus = computed<PromoStatusState>(() => {
    const draft = this.landingDraft();
    if (!draft.promo_enabled) return 'disabled';
    return isPromoActiveAt(draft) ? 'active' : 'expired';
  });

  readonly promoExpiryLocalInput = computed<string>(() =>
    this.isoToDatetimeLocalInput(this.landingDraft().promo_expires_at)
  );

  readonly promoPreviewExpiryFormatted = computed<string | null>(() => {
    const iso = this.landingDraft().promo_expires_at;
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  });

  readonly isSavingLandingPricing = computed<boolean>(() =>
    this.landingPricingConfig.isSaving()
  );

  // Current Settings Computed
  readonly currentSettings = computed<AdminPlatformSettingsRecord>(() => {
    const sig = this.supabase.platformSettings;
    const raw: AdminPlatformSettingsRecord =
      typeof sig === 'function' ? sig() : DEFAULT_PLATFORM_SETTINGS;
    const parsedRate = Number(raw.usd_to_cop_rate ?? 3304);
    const proMonthlyCop = Number(raw.pro_monthly_cop ?? 49900);
    const proAnnualMonthlyCop = Number(raw.pro_annual_monthly_cop ?? 39920);
    const proAnnualTotalCop = Number(raw.pro_annual_total_cop ?? 479040);
    const indMonthlyCop = Number(raw.industrial_monthly_cop ?? 95900);
    const indAnnualMonthlyCop = Number(raw.industrial_annual_monthly_cop ?? 76720);
    const indAnnualTotalCop = Number(raw.industrial_annual_total_cop ?? 920640);
    return {
      ...raw,
      pro_monthly_cop:
        Number.isFinite(proMonthlyCop) && proMonthlyCop >= 1500 ? proMonthlyCop : 49900,
      pro_annual_monthly_cop:
        Number.isFinite(proAnnualMonthlyCop) && proAnnualMonthlyCop >= 1500
          ? proAnnualMonthlyCop
          : 39920,
      pro_annual_total_cop:
        Number.isFinite(proAnnualTotalCop) && proAnnualTotalCop >= 1500
          ? proAnnualTotalCop
          : 479040,
      industrial_monthly_cop:
        Number.isFinite(indMonthlyCop) && indMonthlyCop >= 1500 ? indMonthlyCop : 95900,
      industrial_annual_monthly_cop:
        Number.isFinite(indAnnualMonthlyCop) && indAnnualMonthlyCop >= 1500
          ? indAnnualMonthlyCop
          : 76720,
      industrial_annual_total_cop:
        Number.isFinite(indAnnualTotalCop) && indAnnualTotalCop >= 1500
          ? indAnnualTotalCop
          : 920640,
      usd_to_cop_rate:
        Number.isFinite(parsedRate) && parsedRate > 0 && parsedRate !== 4250 ? parsedRate : 3304,
      support_email: resolvePublicSupportEmail(raw.support_email)
    };
  });

  private getPaymentBridge(): AdminPaymentBridge {
    return this.paymentService as unknown as AdminPaymentBridge;
  }

  // Payments Readiness Guard (SuperAdmin Switch)
  readonly paymentsMode = computed<PaymentsReadinessMode>(() =>
    typeof this.paymentService.paymentsMode === 'function'
      ? this.paymentService.paymentsMode()
      : DEFAULT_PAYMENTS_READINESS_MODE
  );

  readonly isPaymentsProtected = computed<boolean>(
    () => this.paymentsMode() === 'early_access_protected'
  );

  readonly wompiEnvironment = computed<'sandbox' | 'production'>(() => {
    const bridge = this.getPaymentBridge();
    const fromService =
      typeof bridge.wompiEnvironment === 'function'
        ? bridge.wompiEnvironment()
        : typeof bridge.environment === 'function'
          ? bridge.environment()
          : null;
    if (fromService === 'production' || fromService === 'sandbox') {
      return fromService;
    }
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.toLowerCase();
      if (host === 'piezo3d.com' || host === 'www.piezo3d.com') {
        return 'production';
      }
    }
    return 'sandbox';
  });

  readonly wompiEnvironmentLabel = computed<string>(() =>
    this.wompiEnvironment() === 'production' ? 'Producción' : 'Sandbox'
  );

  readonly effectiveUsdToCopRate = computed<number>(() => {
    const fromService = this.getPaymentBridge().getCopEstimate?.('pro', 'monthly');
    if (
      fromService &&
      Number.isFinite(fromService.exchangeRateCop) &&
      fromService.exchangeRateCop > 0 &&
      fromService.exchangeRateCop !== 4250
    ) {
      return fromService.exchangeRateCop;
    }
    const settingsRate = Number(this.currentSettings().usd_to_cop_rate ?? 3304);
    if (Number.isFinite(settingsRate) && settingsRate > 0 && settingsRate !== 4250) {
      return settingsRate;
    }
    const liveUsdPerCop = Number(this.currencyExchange?.rates?.()['USD']);
    if (Number.isFinite(liveUsdPerCop) && liveUsdPerCop > 0) {
      const inverseRate = Math.round((1 / liveUsdPerCop) * 100) / 100;
      if (inverseRate > 0 && Math.round(inverseRate) !== 4250) {
        return inverseRate;
      }
    }
    return 3304;
  });

  readonly proMonthlyCopEstimate = computed<number>(() => {
    const fromService = this.getPaymentBridge().getCopEstimate?.('pro', 'monthly');
    if (
      fromService &&
      Number.isFinite(fromService.amountCop) &&
      fromService.amountCop > 0 &&
      fromService.exchangeRateCop !== 4250
    ) {
      return fromService.amountCop;
    }
    const cop = Number(this.currentSettings().pro_monthly_cop ?? 49900);
    return Number.isFinite(cop) && cop >= 1500 ? Math.round(cop) : 49900;
  });

  readonly industrialMonthlyCopEstimate = computed<number>(() => {
    const fromService = this.getPaymentBridge().getCopEstimate?.('industrial', 'monthly');
    if (
      fromService &&
      Number.isFinite(fromService.amountCop) &&
      fromService.amountCop > 0 &&
      fromService.exchangeRateCop !== 4250
    ) {
      return fromService.amountCop;
    }
    const cop = Number(this.currentSettings().industrial_monthly_cop ?? 95900);
    return Number.isFinite(cop) && cop >= 1500 ? Math.round(cop) : 95900;
  });

  readonly proMonthlyUsdEstimate = computed<number>(() => {
    const fromService = this.getPaymentBridge().getCopEstimate?.('pro', 'monthly');
    if (
      fromService &&
      Number.isFinite(fromService.amountUsd) &&
      fromService.amountUsd > 0 &&
      fromService.exchangeRateCop !== 4250
    ) {
      return Math.round(fromService.amountUsd * 100) / 100;
    }
    return Math.round((this.proMonthlyCopEstimate() / this.effectiveUsdToCopRate()) * 100) / 100;
  });

  readonly industrialMonthlyUsdEstimate = computed<number>(() => {
    const fromService = this.getPaymentBridge().getCopEstimate?.('industrial', 'monthly');
    if (
      fromService &&
      Number.isFinite(fromService.amountUsd) &&
      fromService.amountUsd > 0 &&
      fromService.exchangeRateCop !== 4250
    ) {
      return Math.round(fromService.amountUsd * 100) / 100;
    }
    return (
      Math.round((this.industrialMonthlyCopEstimate() / this.effectiveUsdToCopRate()) * 100) / 100
    );
  });

  readonly isPreparingGatewayCheckout = computed<boolean>(() => {
    const bridge = this.getPaymentBridge();
    return typeof bridge.isPreparingCheckout === 'function'
      ? Boolean(bridge.isPreparingCheckout())
      : false;
  });

  readonly gatewayCheckoutError = computed<string | null>(() => {
    const bridge = this.getPaymentBridge();
    const err =
      typeof bridge.lastCheckoutError === 'function' ? bridge.lastCheckoutError() : null;
    return typeof err === 'string' && err.trim() ? err.trim() : null;
  });

  // KPI Computed Signals (Module 1)
  readonly totalUsersCount = computed<number>(() => this.profiles().length);
  readonly freeUsersCount = computed<number>(() =>
    this.profiles().filter(p => p.plan === 'free').length
  );
  readonly proUsersCount = computed<number>(() =>
    this.profiles().filter(p => p.plan === 'pro').length
  );
  readonly industrialUsersCount = computed<number>(() =>
    this.profiles().filter(p => p.plan === 'industrial').length
  );

  readonly activePaidSubscriptionsCount = computed<number>(() =>
    this.profiles().filter(
      p =>
        !p.is_suspended &&
        (p.plan === 'pro' || p.plan === 'industrial') &&
        (p.subscription_status === 'active' || p.subscription_status === 'on_trial')
    ).length
  );

  readonly estimatedMrrUsd = computed<number>(() => {
    const settings = this.currentSettings();
    let total = 0;

    for (const user of this.profiles()) {
      if (user.is_suspended) continue;
      const isPaidStatus =
        user.subscription_status === 'active' || user.subscription_status === 'on_trial';
      if (!isPaidStatus) continue;

      if (user.plan === 'pro') {
        const monthlyRate =
          user.billing_cycle === 'annual'
            ? Number(settings.pro_annual_monthly_usd)
            : Number(settings.pro_monthly_usd);
        total += Number.isFinite(monthlyRate) ? monthlyRate : 0;
      } else if (user.plan === 'industrial') {
        const monthlyRate =
          user.billing_cycle === 'annual'
            ? Number(settings.industrial_annual_monthly_usd)
            : Number(settings.industrial_monthly_usd);
        total += Number.isFinite(monthlyRate) ? monthlyRate : 0;
      }
    }

    return Math.round(total * 100) / 100;
  });

  readonly pendingSupportCount = computed<number>(() =>
    this.feedbackList().filter(
      f =>
        (f.category === 'support' || f.category === 'bug') &&
        (f.status === 'pending' || f.status === 'in_progress')
    ).length
  );

  readonly pendingTestimonialsCount = computed<number>(() =>
    this.feedbackList().filter(f => f.category === 'testimonial' && f.status === 'pending').length
  );

  readonly pendingAttentionCount = computed<number>(
    () => this.pendingSupportCount() + this.pendingTestimonialsCount()
  );

  readonly recentInvoices = computed<SubscriptionInvoice[]>(() => this.invoices().slice(0, 8));
  readonly recentUsers = computed<UserProfile[]>(() => this.profiles().slice(0, 8));

  // Filtered Users (Module 2 - CRM)
  readonly filteredUsers = computed<UserProfile[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.userFilter();

    return this.profiles().filter(user => {
      if (filter === 'free' && user.plan !== 'free') return false;
      if (filter === 'pro' && user.plan !== 'pro') return false;
      if (filter === 'industrial' && user.plan !== 'industrial') return false;
      if (filter === 'super_admin' && user.role !== 'super_admin') return false;
      if (filter === 'suspended' && !user.is_suspended) return false;

      if (!query) return true;

      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
      const email = (user.email || '').toLowerCase();
      return fullName.includes(query) || email.includes(query);
    });
  });

  // Filtered Testimonials (Module 4)
  readonly testimonialsList = computed<PlatformFeedbackRecord[]>(() =>
    this.feedbackList().filter(item => item.category === 'testimonial')
  );

  // Filtered Support & Bugs (Module 5)
  readonly supportTicketsList = computed<PlatformFeedbackRecord[]>(() => {
    const catFilter = this.supportCategoryFilter();
    const statFilter = this.supportStatusFilter();

    return this.feedbackList().filter(item => {
      const isTicket = item.category === 'support' || item.category === 'bug';
      if (!isTicket) return false;
      if (catFilter !== 'all' && item.category !== catFilter) return false;
      if (statFilter !== 'all' && item.status !== statFilter) return false;
      return true;
    });
  });

  // CMS Reactive Form (Module 3)
  readonly cmsForm = this.fb.group({
    pro_monthly_cop: [49900, [Validators.required, Validators.min(1500)]],
    pro_annual_monthly_cop: [39920, [Validators.required, Validators.min(1500)]],
    pro_annual_total_cop: [479040, [Validators.required, Validators.min(1500)]],
    industrial_monthly_cop: [95900, [Validators.required, Validators.min(1500)]],
    industrial_annual_monthly_cop: [76720, [Validators.required, Validators.min(1500)]],
    industrial_annual_total_cop: [920640, [Validators.required, Validators.min(1500)]],
    pro_monthly_usd: [15, [Validators.required, Validators.min(0)]],
    pro_annual_monthly_usd: [12, [Validators.required, Validators.min(0)]],
    pro_annual_total_usd: [144, [Validators.required, Validators.min(0)]],
    industrial_monthly_usd: [29, [Validators.required, Validators.min(0)]],
    industrial_annual_monthly_usd: [23, [Validators.required, Validators.min(0)]],
    industrial_annual_total_usd: [276, [Validators.required, Validators.min(0)]],
    usd_to_cop_rate: [3304, [Validators.required, Validators.min(1)]],
    free_max_modules: [3, [Validators.required, Validators.min(1)]],
    app_version: ['v3.0.0', [Validators.required]],
    support_email: [OFFICIAL_SUPPORT_EMAIL, [Validators.required, Validators.email]],
    announcement_enabled: [false],
    announcement_badge: ['NOVEDAD', [Validators.required]],
    announcement_text: ['']
  });

  readonly announcementBadgeOptions = [
    { value: 'NOVEDAD', label: 'Novedad' },
    { value: 'LANZAMIENTO', label: 'Lanzamiento' },
    { value: 'PROMO', label: 'Promoción (PROMO)' },
    { value: 'PROMOCIÓN', label: 'Promoción' },
    { value: 'DESCUENTO', label: 'Descuento' },
    { value: 'ACTUALIZACIÓN', label: 'Actualización' },
    { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
    { value: 'AVISO', label: 'Aviso Importante' }
  ] as const;

  // New Testimonial Reactive Form (Module 4)
  readonly newTestimonialForm = this.fb.group({
    user_name: ['', [Validators.required, Validators.minLength(2)]],
    user_role_title: ['Taller de Carpintería', [Validators.required]],
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    message: ['', [Validators.required, Validators.minLength(10)]],
    is_featured: [true]
  });

  constructor() {
    effect(() => {
      const settings = this.currentSettings();
      this.syncCmsFormWithSettings(settings);
    });

    effect(() => {
      const remoteConfig = this.landingPricingConfig.config();
      const remoteSnapshot = this.toLandingComparableSnapshot(remoteConfig);
      const currentDraftSnapshot = untracked(() =>
        this.toLandingComparableSnapshot(this.landingDraft())
      );
      if (currentDraftSnapshot === this.lastHydratedLandingSnapshot) {
        this.lastHydratedLandingSnapshot = remoteSnapshot;
        this.landingDraft.set(cloneLandingPricingConfig(remoteConfig));
      }
    });
  }

  ngOnInit(): void {
    void this.reloadAllData();
  }

  setSection(section: AdminSection): void {
    this.activeSection.set(section);
  }

  setUserFilter(filter: AdminUserFilter): void {
    this.userFilter.set(filter);
  }

  onSearchQueryInput(value: string): void {
    this.searchQuery.set(value);
  }

  setSupportCategoryFilter(filter: SupportCategoryFilter): void {
    this.supportCategoryFilter.set(filter);
  }

  setSupportStatusFilter(filter: SupportStatusFilter): void {
    this.supportStatusFilter.set(filter);
  }

  showToast(text: string, type: 'success' | 'error' = 'success'): void {
    this.toastBanner.set({ text, type });
  }

  dismissToast(): void {
    this.toastBanner.set(null);
  }

  togglePaymentsReadinessMode(): void {
    const nextMode =
      this.paymentService.togglePaymentsMode?.() ??
      (this.isPaymentsProtected() ? 'live_checkout' : 'early_access_protected');

    if (nextMode === 'live_checkout') {
      this.showToast(
        'Pasarela de pagos activada en Modo en Vivo (Checkout Wompi Colombia activo).',
        'success'
      );
      return;
    }

    this.showToast(
      'Pasarela de pagos cambiada a Modo Protegido (Acceso Anticipado — cobros pausados).',
      'success'
    );
  }

  testAdminCheckout(plan: PaidPlan): void {
    const maybePromise = this.getPaymentBridge().testAdminCheckout?.(plan, 'monthly');
    if (maybePromise && typeof maybePromise.then === 'function') {
      void maybePromise.then(() => {
        const err = this.gatewayCheckoutError();
        if (err) {
          this.showToast(err, 'error');
        }
      });
    }
  }

  async reloadAllData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const hasRemoteLandingConfig = Boolean(
        this.supabase.config?.url && this.supabase.config?.publishableKey
      );
      const [settings, profiles, invoices, feedback] = await Promise.all([
        typeof this.supabase.loadPlatformSettings === 'function'
          ? this.supabase.loadPlatformSettings()
          : Promise.resolve(this.currentSettings()),
        typeof this.supabase.adminGetAllProfiles === 'function'
          ? this.supabase.adminGetAllProfiles()
          : Promise.resolve([] as UserProfile[]),
        typeof this.supabase.adminGetAllInvoices === 'function'
          ? this.supabase.adminGetAllInvoices(50)
          : Promise.resolve([] as SubscriptionInvoice[]),
        typeof this.supabase.adminGetAllFeedback === 'function'
          ? this.supabase.adminGetAllFeedback()
          : Promise.resolve([] as PlatformFeedbackRecord[]),
        hasRemoteLandingConfig && typeof this.landingPricingConfig.loadConfig === 'function'
          ? this.landingPricingConfig.loadConfig(true)
          : Promise.resolve(this.landingPricingConfig.config())
      ]);

      this.syncCmsFormWithSettings(settings);
      this.profiles.set(profiles);
      this.invoices.set(invoices);
      this.feedbackList.set(feedback);
      this.hydrateFeedbackDrafts(feedback);
    } catch {
      this.showToast('No fue posible sincronizar algunos datos administrativos.', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  private syncCmsFormWithSettings(settings: AdminPlatformSettingsRecord): void {
    const parsedRate = Number(settings.usd_to_cop_rate ?? 3304);
    const proMonthlyCop = Number(settings.pro_monthly_cop ?? 49900);
    const proAnnualMonthlyCop = Number(settings.pro_annual_monthly_cop ?? 39920);
    const proAnnualTotalCop = Number(settings.pro_annual_total_cop ?? 479040);
    const indMonthlyCop = Number(settings.industrial_monthly_cop ?? 95900);
    const indAnnualMonthlyCop = Number(settings.industrial_annual_monthly_cop ?? 76720);
    const indAnnualTotalCop = Number(settings.industrial_annual_total_cop ?? 920640);
    this.cmsForm.patchValue(
      {
        pro_monthly_cop:
          Number.isFinite(proMonthlyCop) && proMonthlyCop >= 1500 ? proMonthlyCop : 49900,
        pro_annual_monthly_cop:
          Number.isFinite(proAnnualMonthlyCop) && proAnnualMonthlyCop >= 1500
            ? proAnnualMonthlyCop
            : 39920,
        pro_annual_total_cop:
          Number.isFinite(proAnnualTotalCop) && proAnnualTotalCop >= 1500
            ? proAnnualTotalCop
            : 479040,
        industrial_monthly_cop:
          Number.isFinite(indMonthlyCop) && indMonthlyCop >= 1500 ? indMonthlyCop : 95900,
        industrial_annual_monthly_cop:
          Number.isFinite(indAnnualMonthlyCop) && indAnnualMonthlyCop >= 1500
            ? indAnnualMonthlyCop
            : 76720,
        industrial_annual_total_cop:
          Number.isFinite(indAnnualTotalCop) && indAnnualTotalCop >= 1500
            ? indAnnualTotalCop
            : 920640,
        pro_monthly_usd: settings.pro_monthly_usd,
        pro_annual_monthly_usd: settings.pro_annual_monthly_usd,
        pro_annual_total_usd: settings.pro_annual_total_usd,
        industrial_monthly_usd: settings.industrial_monthly_usd,
        industrial_annual_monthly_usd: settings.industrial_annual_monthly_usd,
        industrial_annual_total_usd: settings.industrial_annual_total_usd,
        usd_to_cop_rate:
          Number.isFinite(parsedRate) && parsedRate > 0 && parsedRate !== 4250 ? parsedRate : 3304,
        free_max_modules: settings.free_max_modules,
        app_version: settings.app_version,
        support_email: resolvePublicSupportEmail(settings.support_email),
        announcement_enabled: settings.announcement_enabled,
        announcement_badge: settings.announcement_badge || 'NOVEDAD',
        announcement_text: settings.announcement_text || ''
      },
      { emitEvent: false }
    );
  }

  private hydrateFeedbackDrafts(records: PlatformFeedbackRecord[]): void {
    const notesMap: Record<string, string> = {};
    const statusMap: Record<string, PlatformFeedbackStatus> = {};
    for (const item of records) {
      notesMap[item.id] = item.admin_notes ?? '';
      statusMap[item.id] = item.status;
    }
    this.adminNotesDraft.set(notesMap);
    this.ticketStatusDraft.set(statusMap);
  }

  // ==========================================
  // MODULE 2: CRM & USER MANAGEMENT ACTIONS
  // ==========================================

  async updateUserField(
    user: UserProfile,
    patch: UserProfilePatch,
    customMessage?: string
  ): Promise<void> {
    this.updatingUserId.set(user.id);
    try {
      const result = await this.supabase.adminUpdateUserProfile(user.id, patch);
      if (!result.success) {
        this.showToast(
          result.error || 'No se pudo actualizar el perfil del usuario.',
          'error'
        );
        return;
      }

      this.profiles.update(list =>
        list.map(item =>
          item.id === user.id
            ? {
                ...item,
                ...patch,
                updated_at: new Date().toISOString()
              }
            : item
        )
      );

      this.showToast(
        customMessage || `Perfil de ${user.first_name || user.email} actualizado correctamente.`,
        'success'
      );
    } finally {
      this.updatingUserId.set(null);
    }
  }

  async onUserPlanChange(user: UserProfile, planValue: string): Promise<void> {
    const plan = planValue as UserPlan;
    const subscription_status: SubscriptionStatus =
      plan === 'free'
        ? 'free'
        : user.subscription_status === 'free' || !user.subscription_status
          ? 'active'
          : user.subscription_status;

    await this.updateUserField(
      user,
      { plan, subscription_status },
      `Plan de ${user.first_name || user.email} actualizado a ${this.getPlanLabel(plan)}.`
    );
  }

  async onUserCycleChange(user: UserProfile, cycleValue: string): Promise<void> {
    const billing_cycle = cycleValue as BillingCycle;
    await this.updateUserField(
      user,
      { billing_cycle },
      `Ciclo de facturación actualizado para ${user.first_name || user.email}.`
    );
  }

  async onUserStatusChange(user: UserProfile, statusValue: string): Promise<void> {
    const subscription_status = statusValue as SubscriptionStatus;
    await this.updateUserField(
      user,
      { subscription_status },
      `Estado de suscripción actualizado para ${user.first_name || user.email}.`
    );
  }

  async toggleUserRole(user: UserProfile): Promise<void> {
    const nextRole: UserRole = user.role === 'super_admin' ? 'user' : 'super_admin';
    await this.updateUserField(
      user,
      { role: nextRole },
      `Rol de ${user.first_name || user.email} cambiado a ${nextRole === 'super_admin' ? 'Super Admin' : 'Usuario Estándar'}.`
    );
  }

  async toggleUserSuspension(user: UserProfile): Promise<void> {
    const nextSuspended = !user.is_suspended;
    await this.updateUserField(
      user,
      { is_suspended: nextSuspended },
      nextSuspended
        ? `Cuenta de ${user.first_name || user.email} suspendida.`
        : `Cuenta de ${user.first_name || user.email} reactivada.`
    );
  }

  // ==========================================
  // MODULE 3: CMS & GLOBAL SETTINGS ACTIONS
  // ==========================================

  async saveCmsSettings(): Promise<void> {
    if (this.cmsForm.invalid) {
      this.cmsForm.markAllAsTouched();
      this.showToast('Revisa los campos obligatorios de la configuración global.', 'error');
      return;
    }

    this.isSavingCms.set(true);
    try {
      const raw = this.cmsForm.getRawValue();
      const parsedRate = Number(raw.usd_to_cop_rate);
      const patch: Partial<AdminPlatformSettingsRecord> = {
        pro_monthly_cop: Math.max(1500, Math.round(Number(raw.pro_monthly_cop) || 49900)),
        pro_annual_monthly_cop: Math.max(
          1500,
          Math.round(Number(raw.pro_annual_monthly_cop) || 39920)
        ),
        pro_annual_total_cop: Math.max(
          1500,
          Math.round(Number(raw.pro_annual_total_cop) || 479040)
        ),
        industrial_monthly_cop: Math.max(
          1500,
          Math.round(Number(raw.industrial_monthly_cop) || 95900)
        ),
        industrial_annual_monthly_cop: Math.max(
          1500,
          Math.round(Number(raw.industrial_annual_monthly_cop) || 76720)
        ),
        industrial_annual_total_cop: Math.max(
          1500,
          Math.round(Number(raw.industrial_annual_total_cop) || 920640)
        ),
        pro_monthly_usd: Number(raw.pro_monthly_usd),
        pro_annual_monthly_usd: Number(raw.pro_annual_monthly_usd),
        pro_annual_total_usd: Number(raw.pro_annual_total_usd),
        industrial_monthly_usd: Number(raw.industrial_monthly_usd),
        industrial_annual_monthly_usd: Number(raw.industrial_annual_monthly_usd),
        industrial_annual_total_usd: Number(raw.industrial_annual_total_usd),
        usd_to_cop_rate: Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 3304,
        free_max_modules: Number(raw.free_max_modules),
        app_version: raw.app_version.trim(),
        support_email: resolvePublicSupportEmail(raw.support_email),
        announcement_enabled: Boolean(raw.announcement_enabled),
        announcement_badge: raw.announcement_badge.trim() || 'NOVEDAD',
        announcement_text: raw.announcement_text.trim()
      };

      const result = await this.supabase.updatePlatformSettings(patch);
      if (!result.success) {
        this.showToast(
          result.error || 'No se pudo guardar la configuración global.',
          'error'
        );
        return;
      }

      this.showToast('Configuración global guardada y publicada en tiempo real.', 'success');
    } finally {
      this.isSavingCms.set(false);
    }
  }

  // ==========================================
  // MODULE 4: TESTIMONIALS MODERATION ACTIONS
  // ==========================================

  toggleNewTestimonialModal(): void {
    this.showNewTestimonialForm.update(v => !v);
  }

  setNewTestimonialRating(rating: number): void {
    this.newTestimonialForm.controls.rating.setValue(rating);
  }

  async createTestimonial(): Promise<void> {
    if (this.newTestimonialForm.invalid) {
      this.newTestimonialForm.markAllAsTouched();
      this.showToast('Completa el nombre, taller y mensaje del testimonio.', 'error');
      return;
    }

    this.isCreatingTestimonial.set(true);
    try {
      const raw = this.newTestimonialForm.getRawValue();
      const result = await this.supabase.adminCreateTestimonial({
        user_name: raw.user_name.trim(),
        user_role_title: raw.user_role_title.trim(),
        rating: Number(raw.rating),
        message: raw.message.trim(),
        is_featured: Boolean(raw.is_featured)
      });

      if (!result.success) {
        this.showToast(result.error || 'No se pudo crear el testimonio.', 'error');
        return;
      }

      const createdRecord: PlatformFeedbackRecord = result.data ?? {
        id: `testimonial-${Date.now()}`,
        user_id: null,
        user_name: raw.user_name.trim(),
        user_email: null,
        user_role_title: raw.user_role_title.trim(),
        category: 'testimonial',
        subject: null,
        message: raw.message.trim(),
        rating: Number(raw.rating),
        status: 'approved',
        is_featured: Boolean(raw.is_featured),
        admin_notes: null,
        created_at: new Date().toISOString()
      };

      this.feedbackList.update(list => [createdRecord, ...list]);
      this.newTestimonialForm.reset({
        user_name: '',
        user_role_title: 'Taller de Carpintería',
        rating: 5,
        message: '',
        is_featured: true
      });
      this.showNewTestimonialForm.set(false);
      this.showToast('Testimonio destacado publicado en la portada.', 'success');
    } finally {
      this.isCreatingTestimonial.set(false);
    }
  }

  async approveTestimonial(item: PlatformFeedbackRecord): Promise<void> {
    this.updatingFeedbackId.set(item.id);
    try {
      const result = await this.supabase.adminUpdateFeedback(item.id, {
        status: 'approved',
        is_featured: true
      });
      if (!result.success) {
        this.showToast(result.error || 'No se pudo aprobar el testimonio.', 'error');
        return;
      }

      this.feedbackList.update(list =>
        list.map(f =>
          f.id === item.id ? { ...f, status: 'approved', is_featured: true } : f
        )
      );
      this.showToast('Testimonio aprobado y publicado en la página principal.', 'success');
    } finally {
      this.updatingFeedbackId.set(null);
    }
  }

  async toggleTestimonialFeatured(item: PlatformFeedbackRecord): Promise<void> {
    this.updatingFeedbackId.set(item.id);
    const nextFeatured = !item.is_featured;
    try {
      const result = await this.supabase.adminUpdateFeedback(item.id, {
        is_featured: nextFeatured
      });
      if (!result.success) {
        this.showToast(result.error || 'No se pudo actualizar el estado destacado.', 'error');
        return;
      }

      this.feedbackList.update(list =>
        list.map(f => (f.id === item.id ? { ...f, is_featured: nextFeatured } : f))
      );
      this.showToast(
        nextFeatured
          ? 'Testimonio marcado como destacado.'
          : 'Testimonio retirado de destacados.',
        'success'
      );
    } finally {
      this.updatingFeedbackId.set(null);
    }
  }

  async rejectTestimonial(item: PlatformFeedbackRecord): Promise<void> {
    this.updatingFeedbackId.set(item.id);
    try {
      const result = await this.supabase.adminUpdateFeedback(item.id, {
        status: 'rejected',
        is_featured: false
      });
      if (!result.success) {
        this.showToast(result.error || 'No se pudo ocultar el testimonio.', 'error');
        return;
      }

      this.feedbackList.update(list =>
        list.map(f =>
          f.id === item.id ? { ...f, status: 'rejected', is_featured: false } : f
        )
      );
      this.showToast('Testimonio ocultado de la portada pública.', 'success');
    } finally {
      this.updatingFeedbackId.set(null);
    }
  }

  async deleteFeedbackItem(item: PlatformFeedbackRecord): Promise<void> {
    this.updatingFeedbackId.set(item.id);
    try {
      const result = await this.supabase.adminDeleteFeedback(item.id);
      if (!result.success) {
        this.showToast(result.error || 'No se pudo eliminar el registro.', 'error');
        return;
      }

      this.feedbackList.update(list => list.filter(f => f.id !== item.id));
      this.showToast('Registro eliminado permanentemente.', 'success');
    } finally {
      this.updatingFeedbackId.set(null);
    }
  }

  // ==========================================
  // MODULE 5: SUPPORT & BUG TICKETS ACTIONS
  // ==========================================

  getTicketDraftStatus(ticket: PlatformFeedbackRecord): PlatformFeedbackStatus {
    return this.ticketStatusDraft()[ticket.id] ?? ticket.status;
  }

  setTicketDraftStatus(ticketId: string, statusValue: string): void {
    const status = statusValue as PlatformFeedbackStatus;
    this.ticketStatusDraft.update(prev => ({ ...prev, [ticketId]: status }));
  }

  getTicketDraftNotes(ticket: PlatformFeedbackRecord): string {
    return this.adminNotesDraft()[ticket.id] ?? ticket.admin_notes ?? '';
  }

  setTicketDraftNotes(ticketId: string, notes: string): void {
    this.adminNotesDraft.update(prev => ({ ...prev, [ticketId]: notes }));
  }

  async saveTicketChanges(ticket: PlatformFeedbackRecord): Promise<void> {
    this.updatingFeedbackId.set(ticket.id);
    const nextStatus = this.getTicketDraftStatus(ticket);
    const nextNotes = this.getTicketDraftNotes(ticket).trim();

    try {
      const result = await this.supabase.adminUpdateFeedback(ticket.id, {
        status: nextStatus,
        admin_notes: nextNotes
      });

      if (!result.success) {
        this.showToast(result.error || 'No se pudo actualizar el ticket de soporte.', 'error');
        return;
      }

      this.feedbackList.update(list =>
        list.map(item =>
          item.id === ticket.id
            ? { ...item, status: nextStatus, admin_notes: nextNotes, updated_at: new Date().toISOString() }
            : item
        )
      );
      this.adminNotesDraft.update(prev => ({ ...prev, [ticket.id]: nextNotes }));
      this.ticketStatusDraft.update(prev => ({ ...prev, [ticket.id]: nextStatus }));

      this.savedFeedbackId.set(ticket.id);
      setTimeout(() => {
        if (this.savedFeedbackId() === ticket.id) {
          this.savedFeedbackId.set(null);
        }
      }, 4000);

      this.showToast('¡Guardado y notificado al usuario!', 'success');
    } finally {
      this.updatingFeedbackId.set(null);
    }
  }

  // ==========================================
  // PRESENTATION HELPERS
  // ==========================================

  getPlanLabel(plan: UserPlan): string {
    if (plan === 'industrial') return 'Industrial & CNC';
    if (plan === 'pro') return 'Taller Pro';
    return 'Inicial (Free)';
  }

  getCycleLabel(cycle?: BillingCycle | null): string {
    return cycle === 'annual' ? 'Anual' : 'Mensual';
  }

  getFeedbackStatusLabel(status: PlatformFeedbackStatus): string {
    switch (status) {
      case 'approved':
        return 'Aprobado';
      case 'rejected':
        return 'Oculto';
      case 'in_progress':
        return 'En Revisión';
      case 'resolved':
        return 'Resuelto';
      default:
        return 'Pendiente';
    }
  }

  getCategoryLabel(category: PlatformFeedbackCategory): string {
    if (category === 'bug') return 'Reporte de Bug';
    if (category === 'testimonial') return 'Testimonio';
    return 'Soporte Técnico';
  }

  formatCopCurrency(amount: number): string {
    const safe = Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
    return `$ ${safe.toLocaleString('es-CO')} COP`;
  }

  formatUsdCurrency(amount: number): string {
    const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
    return `$ ${safe.toFixed(2)} USD`;
  }

  computeUsdEquivalentFromForm(copAmount: number): number {
    const rate = Number(this.cmsForm.controls.usd_to_cop_rate.value ?? 3304);
    const safeRate =
      Number.isFinite(rate) && rate > 0 && rate !== 4250 ? rate : this.effectiveUsdToCopRate();
    const safeCop = Number.isFinite(copAmount) && copAmount > 0 ? copAmount : 0;
    return Math.round((safeCop / safeRate) * 100) / 100;
  }

  computeCopEstimateFromForm(usdAmount: number): number {
    const rate = Number(this.cmsForm.controls.usd_to_cop_rate.value ?? 3304);
    const safeRate = Number.isFinite(rate) && rate > 0 && rate !== 4250 ? rate : 3304;
    const safeUsd = Number.isFinite(usdAmount) && usdAmount > 0 ? usdAmount : 0;
    return Math.max(1500, Math.round(safeUsd * safeRate));
  }

  formatShortDate(isoDate?: string | null): string {
    if (!isoDate) return '—';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate.slice(0, 10);
    return d.toISOString().slice(0, 10);
  }

  // ==========================================
  // MODULE 3B: LANDING & PRICING CONFIG EDITOR
  // ==========================================

  setActivePlanEditorTab(planId: LandingPlanId): void {
    this.activePlanEditorTab.set(planId);
  }

  toggleLandingPaymentsEnabled(): void {
    this.landingDraft.update(draft => ({
      ...draft,
      payments_enabled: !draft.payments_enabled
    }));
  }

  setLandingPaymentsNoticeTitle(value: string): void {
    this.landingDraft.update(draft => ({
      ...draft,
      payments_notice_title: value
    }));
  }

  setLandingPaymentsNoticeMessage(value: string): void {
    this.landingDraft.update(draft => ({
      ...draft,
      payments_notice_message: value
    }));
  }

  setLandingPaymentsDisabledCtaLabel(value: string): void {
    this.landingDraft.update(draft => ({
      ...draft,
      payments_disabled_cta_label: value
    }));
  }

  setLandingAnnualDiscountPercent(rawValue: string | number): void {
    const clamped = this.clampIntegerInput(
      rawValue,
      LANDING_PRICING_ANNUAL_DISCOUNT_MIN,
      LANDING_PRICING_ANNUAL_DISCOUNT_MAX
    );
    this.landingDraft.update(draft => ({
      ...draft,
      annual_discount_percent: clamped
    }));
  }

  toggleLandingPromoEnabled(): void {
    this.landingDraft.update(draft => ({
      ...draft,
      promo_enabled: !draft.promo_enabled
    }));
  }

  setLandingPromoBadge(value: string): void {
    this.landingDraft.update(draft => ({
      ...draft,
      promo_badge: value
    }));
  }

  setLandingPromoMessage(value: string): void {
    this.landingDraft.update(draft => ({
      ...draft,
      promo_message: value
    }));
  }

  setLandingPromoCode(value: string): void {
    this.landingDraft.update(draft => ({
      ...draft,
      promo_code: value
    }));
  }

  setLandingPromoDiscountPercent(rawValue: string | number): void {
    const clamped = this.clampIntegerInput(
      rawValue,
      LANDING_PRICING_PROMO_DISCOUNT_MIN,
      LANDING_PRICING_PROMO_DISCOUNT_MAX
    );
    this.landingDraft.update(draft => ({
      ...draft,
      promo_discount_percent: clamped
    }));
  }

  setLandingPromoExpiresLocal(localValue: string): void {
    const iso = this.datetimeLocalInputToIso(localValue);
    this.landingDraft.update(draft => ({
      ...draft,
      promo_expires_at: iso
    }));
  }

  clearLandingPromoExpiry(): void {
    this.landingDraft.update(draft => ({
      ...draft,
      promo_expires_at: null
    }));
  }

  toggleLandingIpGuaranteeEnabled(): void {
    this.landingDraft.update(draft => ({
      ...draft,
      ip_guarantee_enabled: !draft.ip_guarantee_enabled
    }));
  }

  setLandingIpGuaranteeTitle(value: string): void {
    this.landingDraft.update(draft => ({
      ...draft,
      ip_guarantee_title: value
    }));
  }

  setLandingIpGuaranteeDescription(value: string): void {
    this.landingDraft.update(draft => ({
      ...draft,
      ip_guarantee_description: value
    }));
  }

  setActivePlanEyebrow(value: string): void {
    this.updateActivePlan(plan => ({ ...plan, eyebrow: value }));
  }

  setActivePlanName(value: string): void {
    this.updateActivePlan(plan => ({ ...plan, name: value }));
  }

  setActivePlanDescription(value: string): void {
    this.updateActivePlan(plan => ({ ...plan, description: value }));
  }

  setActivePlanPriceCop(rawValue: string | number): void {
    this.updateActivePlan(plan => {
      if (plan.isFree) {
        return { ...plan, priceCopMonthly: 0 };
      }
      const numeric = Number(rawValue);
      const safePrice =
        Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric) : 0;
      return { ...plan, priceCopMonthly: safePrice };
    });
  }

  setActivePlanHighlightNote(value: string): void {
    this.updateActivePlan(plan => ({ ...plan, highlightNote: value }));
  }

  setActivePlanCtaLabel(value: string): void {
    this.updateActivePlan(plan => ({ ...plan, ctaLabel: value }));
  }

  toggleActivePlanPopular(): void {
    const activeId = this.activePlanEditorTab();
    const currentlyPopular = this.activePlanDraft().isPopular;
    const nextPopular = !currentlyPopular;
    this.landingDraft.update(draft => ({
      ...draft,
      plans: draft.plans.map(plan => {
        if (plan.id === activeId) {
          return { ...plan, isPopular: nextPopular };
        }
        return nextPopular ? { ...plan, isPopular: false } : plan;
      })
    }));
  }

  setActivePlanFeatureText(index: number, text: string): void {
    this.updateActivePlanFeature(index, feature => ({ ...feature, text }));
  }

  toggleActivePlanFeatureBold(index: number): void {
    this.updateActivePlanFeature(index, feature => ({
      ...feature,
      isBold: !feature.isBold
    }));
  }

  toggleActivePlanFeatureLimitation(index: number): void {
    this.updateActivePlanFeature(index, feature => ({
      ...feature,
      isLimitation: !feature.isLimitation
    }));
  }

  moveActivePlanFeature(index: number, direction: -1 | 1): void {
    this.updateActivePlan(plan => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= plan.features.length) {
        return plan;
      }
      const nextFeatures = plan.features.map(feature => ({ ...feature }));
      const [moved] = nextFeatures.splice(index, 1);
      if (!moved) {
        return plan;
      }
      nextFeatures.splice(targetIndex, 0, moved);
      return { ...plan, features: nextFeatures };
    });
  }

  removeActivePlanFeature(index: number): void {
    this.updateActivePlan(plan => ({
      ...plan,
      features: plan.features.filter((_, i) => i !== index)
    }));
  }

  setNewFeatureTextDraft(value: string): void {
    this.newFeatureTextDraft.set(value);
  }

  setNewFeatureBoldDraft(value: boolean): void {
    this.newFeatureBoldDraft.set(Boolean(value));
  }

  setNewFeatureLimitationDraft(value: boolean): void {
    this.newFeatureLimitationDraft.set(Boolean(value));
  }

  addActivePlanFeature(): void {
    const trimmed = this.newFeatureTextDraft().trim();
    if (!trimmed) {
      return;
    }
    const newFeature: LandingPlanFeature = {
      text: trimmed,
      isBold: this.newFeatureBoldDraft(),
      isLimitation: this.newFeatureLimitationDraft()
    };
    this.updateActivePlan(plan => ({
      ...plan,
      features: [...plan.features, newFeature]
    }));
    this.newFeatureTextDraft.set('');
    this.newFeatureBoldDraft.set(false);
    this.newFeatureLimitationDraft.set(false);
  }

  resetLandingPricingDraft(): void {
    const saved = this.landingPricingConfig.config();
    this.lastHydratedLandingSnapshot = this.toLandingComparableSnapshot(saved);
    this.landingDraft.set(cloneLandingPricingConfig(saved));
    this.newFeatureTextDraft.set('');
    this.newFeatureBoldDraft.set(false);
    this.newFeatureLimitationDraft.set(false);
    this.showToast('Cambios sin guardar descartados.', 'success');
  }

  async saveLandingPricingConfig(): Promise<void> {
    const result = await this.landingPricingConfig.saveConfig(this.landingDraft());
    if (!result.success) {
      this.showToast(
        result.error || 'No fue posible guardar la configuración de Landing & Precios.',
        'error'
      );
      return;
    }

    const persisted = result.data ?? this.landingPricingConfig.config();
    this.lastHydratedLandingSnapshot = this.toLandingComparableSnapshot(persisted);
    this.landingDraft.set(cloneLandingPricingConfig(persisted));
    this.showToast(
      'Cambios de Landing & Precios guardados y publicados en vivo.',
      'success'
    );
  }

  computePlanAnnualMonthlyCop(monthlyCop: number): number {
    return computeAnnualMonthlyCop(
      monthlyCop,
      this.landingDraft().annual_discount_percent
    );
  }

  computePlanAnnualTotalCop(monthlyCop: number): number {
    return computeAnnualTotalCop(
      monthlyCop,
      this.landingDraft().annual_discount_percent
    );
  }

  getPlanTabDefaultLabel(planId: LandingPlanId): string {
    if (planId === 'pro') return 'Plan Taller Pro';
    if (planId === 'industrial') return 'Plan Industrial & CNC';
    return 'Plan Inicial';
  }

  isoToDatetimeLocalInput(iso?: string | null): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (value: number): string => String(value).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  datetimeLocalInputToIso(localValue: string): string | null {
    const trimmed = localValue.trim();
    if (!trimmed) return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const hours = Number(match[4]);
      const minutes = Number(match[5]);
      const seconds = Number(match[6] ?? '0');
      const localDate = new Date(year, month - 1, day, hours, minutes, seconds, 0);
      return Number.isFinite(localDate.getTime()) ? localDate.toISOString() : null;
    }
    const fallback = new Date(trimmed);
    return Number.isFinite(fallback.getTime()) ? fallback.toISOString() : null;
  }

  private clampIntegerInput(rawValue: string | number, min: number, max: number): number {
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      return min;
    }
    const numeric = Number(rawValue);
    if (!Number.isFinite(numeric)) {
      return min;
    }
    return Math.min(max, Math.max(min, Math.round(numeric)));
  }

  private updateActivePlan(updater: (plan: LandingPlanConfig) => LandingPlanConfig): void {
    const activeId = this.activePlanEditorTab();
    this.landingDraft.update(draft => ({
      ...draft,
      plans: draft.plans.map(plan => (plan.id === activeId ? updater(plan) : plan))
    }));
  }

  private updateActivePlanFeature(
    index: number,
    updater: (feature: LandingPlanFeature) => LandingPlanFeature
  ): void {
    this.updateActivePlan(plan => ({
      ...plan,
      features: plan.features.map((feature, i) => (i === index ? updater(feature) : feature))
    }));
  }

  private toLandingComparableSnapshot(config: LandingPricingConfig): string {
    return JSON.stringify({
      payments_enabled: Boolean(config.payments_enabled),
      payments_notice_title: config.payments_notice_title ?? '',
      payments_notice_message: config.payments_notice_message ?? '',
      payments_disabled_cta_label: config.payments_disabled_cta_label ?? '',
      promo_enabled: Boolean(config.promo_enabled),
      promo_badge: config.promo_badge ?? '',
      promo_message: config.promo_message ?? '',
      promo_code: config.promo_code ?? '',
      promo_expires_at: config.promo_expires_at ?? null,
      promo_discount_percent: Number(config.promo_discount_percent ?? 0),
      ip_guarantee_enabled: Boolean(config.ip_guarantee_enabled),
      ip_guarantee_title: config.ip_guarantee_title ?? '',
      ip_guarantee_description: config.ip_guarantee_description ?? '',
      annual_discount_percent: Number(config.annual_discount_percent ?? 20),
      plans: (config.plans ?? []).map(plan => ({
        id: plan.id,
        eyebrow: plan.eyebrow ?? '',
        name: plan.name ?? '',
        description: plan.description ?? '',
        priceCopMonthly: Number(plan.priceCopMonthly ?? 0),
        isFree: Boolean(plan.isFree),
        isPopular: Boolean(plan.isPopular),
        highlightNote: plan.highlightNote ?? '',
        ctaLabel: plan.ctaLabel ?? '',
        features: (plan.features ?? []).map(feature => ({
          text: feature.text ?? '',
          isBold: Boolean(feature.isBold),
          isLimitation: Boolean(feature.isLimitation)
        }))
      }))
    });
  }
}
