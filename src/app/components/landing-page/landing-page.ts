import {
  ChangeDetectionStrategy,
  Component,
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
  Logout01Icon,
  Mouse01Icon,
  QuoteUpIcon,
  Rocket01Icon,
  RulerIcon,
  ScissorsIcon,
  Settings01Icon,
  Shield01Icon,
  SparklesIcon,
  StarIcon,
  Tag01Icon,
  Tick02Icon,
  UserIcon,
  Wifi01Icon
} from '@hugeicons/core-free-icons';

import { I18nService } from '../../services/i18n.service';
import { SupabaseService } from '../../services/supabase.service';
import { PaymentService } from '../../services/payment.service';
import { CurrencyExchangeService } from '../../services/currency-exchange.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppLanguage } from '../../data/i18n-translations.data';
import { UserFeedbackRecord } from '../../models/feedback.models';

export type PricingCurrencyCode = 'USD' | 'COP' | 'MXN' | 'EUR';

export interface PricingCurrencyOption {
  code: PricingCurrencyCode;
  label: string;
  symbol: string;
}

export type AnnouncementType = 'info' | 'warning' | 'maintenance';

export interface SystemAnnouncement {
  id: string;
  type: AnnouncementType;
  message: string;
  timestamp?: string;
  dismissible?: boolean;
}

export interface PlanPriceConfig {
  monthly: number;
  yearly: number;
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
  private readonly router = inject(Router);
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

  // Configuración reactiva de precios (preparada para sincronización directa con CMS SuperAdmin)
  readonly pricingConfig = signal<SitePricingConfig>({
    starter: { monthly: 0, yearly: 0 },
    pro: { monthly: 15, yearly: 12 },
    industrial: { monthly: 29, yearly: 23 }
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

  // Estado de moneda de visualización referencial conectada a CurrencyExchangeService
  readonly selectedPricingCurrency = signal<PricingCurrencyCode>('USD');

  readonly pricingCurrencies: readonly PricingCurrencyOption[] = [
    { code: 'USD', label: 'USD ($)', symbol: '$' },
    { code: 'COP', label: 'COP ($)', symbol: '$' },
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

  ngOnInit(): void {
    this.currencyExchange.initRates();
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
      const records = await this.supabaseService.getPublicTestimonials(6);
      this.cloudTestimonials.set(records || []);
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
   */
  selectPaidPlan(plan: 'pro' | 'industrial'): void {
    const cycle = this.billingCycle() === 'yearly' ? 'annual' : 'monthly';
    void this.paymentService.openCheckout(plan, cycle);
  }

  setPricingCurrency(currency: PricingCurrencyCode): void {
    this.selectedPricingCurrency.set(currency);
  }

  /**
   * Calcula la conversión estimada en tiempo real a la moneda de referencia seleccionada (COP, MXN, EUR).
   * Devuelve null si la moneda activa es USD para mantener limpia la tarjeta.
   */
  getConvertedPrice(usdAmount: number): string | null {
    const curr = this.selectedPricingCurrency();
    if (curr === 'USD') {
      return null;
    }

    const amountInCop = this.currencyExchange.convertToCop(usdAmount, 'USD');
    const targetAmount = this.currencyExchange.convertFromCop(amountInCop, curr);

    let formatted = '';
    let symbol = '$';

    if (curr === 'COP') {
      symbol = '$';
      formatted = Math.round(targetAmount).toLocaleString('es-CO');
    } else if (curr === 'MXN') {
      symbol = '$';
      formatted = Math.round(targetAmount).toLocaleString('es-MX');
    } else if (curr === 'EUR') {
      symbol = '€';
      formatted = Math.round(targetAmount).toLocaleString('de-DE');
    } else {
      formatted = Math.round(targetAmount).toString();
    }

    return `≈ ${symbol} ${formatted} ${curr}`;
  }

  /**
   * Obtiene el texto de facturación anual con cálculo dinámico según pricingConfig().
   * Garantiza que si el CMS modifica los precios anuales, el total facturado se actualice de inmediato.
   */
  getBilledYearlyText(plan: 'pro' | 'industrial'): string {
    const key = plan === 'pro' ? 'landing.pricing.planProBilledYearly' : 'landing.pricing.planIndBilledYearly';
    const baseText = this.i18n.t(key);
    const defaultYearly = plan === 'pro' ? 12 : 23;
    const currentYearly = plan === 'pro' ? this.pricingConfig().pro.yearly : this.pricingConfig().industrial.yearly;
    if (currentYearly === defaultYearly) {
      return baseText;
    }
    const defaultTotal = defaultYearly * 12;
    const currentTotal = currentYearly * 12;
    return baseText.replace(`$${defaultTotal}`, `$${currentTotal}`);
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
    effect(() => {
      const isRecovery = typeof this.supabaseService.isPasswordRecoveryMode === 'function'
        ? this.supabaseService.isPasswordRecoveryMode()
        : false;
      if (isRecovery) {
        void this.router.navigateByUrl('/auth?mode=reset');
      }
    });
  }

  dismissAnnouncement(): void {
    this.systemAnnouncement.set(null);
  }

  updateCmsConfig(config: Partial<SiteCmsConfig>): void {
    if (config.pricing) {
      this.pricingConfig.set(config.pricing);
    }
    if (config.announcement !== undefined) {
      this.systemAnnouncement.set(config.announcement);
    }
  }
}
