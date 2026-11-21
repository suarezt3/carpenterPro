import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LandingPageComponent } from './landing-page';
import { OFFICIAL_COP_PRICING, PaymentService } from '../../services/payment.service';
import { LandingPricingConfigService } from '../../services/landing-pricing-config.service';
import { DEFAULT_LANDING_PRICING_CONFIG, cloneLandingPricingConfig } from '../../models/landing-pricing.models';
import { CurrencyExchangeService, DEFAULT_COP_RATES } from '../../services/currency-exchange.service';
import { SupabaseService } from '../../services/supabase.service';
import { UserFeedbackRecord } from '../../models/feedback.models';
import { TRANSLATIONS, AppLanguage } from '../../data/i18n-translations.data';

describe('LandingPageComponent', () => {
  let isAuthSignal: WritableSignal<boolean>;
  let mockSupabase: {
    getPublicTestimonials: () => Promise<UserFeedbackRecord[]>;
    isAuthenticated: WritableSignal<boolean>;
    hasAuthCallbackParams: ReturnType<typeof vi.fn>;
    hasAuthErrorParams: ReturnType<typeof vi.fn>;
    waitForAuthReady: ReturnType<typeof vi.fn>;
    currentUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    localStorage.removeItem('melamipro_exchange_rates_cache_v1');
    isAuthSignal = signal(false);
    mockSupabase = {
      isAuthenticated: isAuthSignal,
      hasAuthCallbackParams: vi.fn().mockReturnValue(false),
      hasAuthErrorParams: vi.fn().mockReturnValue(false),
      waitForAuthReady: vi.fn().mockResolvedValue(null),
      currentUser: vi.fn().mockReturnValue(null),
      getPublicTestimonials: vi.fn().mockResolvedValue([
        {
          id: 'test-1',
          user_id: 'user-1',
          category: 'testimonial',
          title: 'Excelente herramienta',
          message: 'Increíble precisión milimétrica en el taller. Nos ahorra mucho tiempo.',
          contact_email: 'test@example.com',
          rating: 5,
          author_name: 'Juan Carpintero',
          author_role: 'Diseñador de Cocinas',
          author_location: 'Bogotá, Colombia',
          allow_public_display: true,
          is_approved_public: true,
          app_version: 'v3.0.0',
          app_language: 'es',
          metadata: {},
          status: 'open',
          created_at: new Date().toISOString()
        } as UserFeedbackRecord
      ])
    };

    await TestBed.configureTestingModule({
      imports: [LandingPageComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: mockSupabase }
      ]
    }).compileComponents();
  });

  it('debe crearse correctamente', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('el ciclo de facturación inicial debe ser "monthly"', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    const component = fixture.componentInstance;
    expect(component.billingCycle()).toBe('monthly');
  });

  it('debe conmutar el ciclo de facturación entre monthly y yearly', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    const component = fixture.componentInstance;

    component.setBillingCycle('yearly');
    expect(component.billingCycle()).toBe('yearly');

    component.setBillingCycle('monthly');
    expect(component.billingCycle()).toBe('monthly');
  });

  it('debe abrir y cerrar el modal informativo de inicio de sesión', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    const component = fixture.componentInstance;

    expect(component.showLoginModal()).toBe(false);
    component.openLoginModal();
    expect(component.showLoginModal()).toBe(true);
    component.closeLoginModal();
    expect(component.showLoginModal()).toBe(false);
  });

  it('debe combinar testimonios reales en vivo con testimonios de respaldo si son menos de 3', async () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    await fixture.whenStable();

    const list = component.testimonialsList();
    expect(list.length).toBe(3);
    expect(list[0].name).toBe('Juan Carpintero');
    expect(list[0].isRealCloud).toBe(true);
    expect(list[1].isRealCloud).toBe(false);
  });

  it('debe permitir cambiar de idioma sincronizado con i18nService', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    const component = fixture.componentInstance;

    component.selectLanguage('en');
    expect(component.i18n.currentLang()).toBe('en');
    expect(component.isLangDropdownOpen()).toBe(false);

    component.selectLanguage('es');
    expect(component.i18n.currentLang()).toBe('es');
  });

  it('debe redirigir a /auth?mode=login al invocar goToStudio si no está autenticado', () => {
    isAuthSignal.set(false);
    const fixture = TestBed.createComponent(LandingPageComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    component.openLoginModal();
    component.goToStudio();

    expect(component.showLoginModal()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/auth'], { queryParams: { mode: 'login' } });
  });

  it('debe navegar hacia /studio al invocar goToStudio si está autenticado', () => {
    isAuthSignal.set(true);
    const fixture = TestBed.createComponent(LandingPageComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    component.openLoginModal();
    component.goToStudio();

    expect(component.showLoginModal()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith('/studio');
  });

  it('debe cambiar de pestaña en la maqueta interactiva', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    const component = fixture.componentInstance;

    expect(component.mockupTab()).toBe('designer');
    component.setMockupTab('optimizer');
    expect(component.mockupTab()).toBe('optimizer');
    component.setMockupTab('budget');
    expect(component.mockupTab()).toBe('budget');
    component.setMockupTab('guide');
    expect(component.mockupTab()).toBe('guide');
  });

  it('debe ajustar la cota libre dentro de los límites [250, 500] mm', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    const component = fixture.componentInstance;

    expect(component.clearanceMm()).toBe(370);
    component.adjustClearance(10);
    expect(component.clearanceMm()).toBe(380);

    // Límite superior
    component.adjustClearance(200);
    expect(component.clearanceMm()).toBe(500);

    // Límite inferior
    component.adjustClearance(-300);
    expect(component.clearanceMm()).toBe(250);
  });

  it('debe registrar el plan seleccionado al abrir el modal y limpiarlo al cerrar', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    const component = fixture.componentInstance;

    component.openLoginModal('pro');
    expect(component.showLoginModal()).toBe(true);
    expect(component.selectedPlanKey()).toBe('pro');

    component.closeLoginModal();
    expect(component.showLoginModal()).toBe(false);
    expect(component.selectedPlanKey()).toBeNull();

    component.openLoginModal('industrial');
    expect(component.showLoginModal()).toBe(true);
    expect(component.selectedPlanKey()).toBe('industrial');
  });

  it('debe cerrar dropdowns y modales con la tecla Escape', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    const component = fixture.componentInstance;

    component.toggleLanguageDropdown();
    component.toggleMobileMenu();
    component.openLoginModal('pro');

    expect(component.isLangDropdownOpen()).toBe(true);
    expect(component.isMobileMenuOpen()).toBe(true);
    expect(component.showLoginModal()).toBe(true);

    component.onEscapeKey();

    expect(component.isLangDropdownOpen()).toBe(false);
    expect(component.isMobileMenuOpen()).toBe(false);
    expect(component.showLoginModal()).toBe(false);
  });

  it('debe tener todos los textos de la sección Sobre Nosotros en los 6 idiomas incluyendo KPIs', () => {
    const requiredKeys = [
      'landing.about.badge',
      'landing.about.title',
      'landing.about.storyP1',
      'landing.about.storyP2',
      'landing.about.missionTitle',
      'landing.about.missionText',
      'landing.about.card1Title',
      'landing.about.card1Desc',
      'landing.about.card2Title',
      'landing.about.card2Desc',
      'landing.about.card3Title',
      'landing.about.card3Desc',
      'landing.about.card4Title',
      'landing.about.card4Desc',
      'landing.about.kpi1Val',
      'landing.about.kpi2Val',
      'landing.about.kpi3Val',
      'landing.about.kpi4Val'
    ];
    const languages: AppLanguage[] = ['es', 'en', 'pt', 'fr', 'it', 'de'];

    for (const lang of languages) {
      for (const key of requiredKeys) {
        const text = TRANSLATIONS[lang]?.[key];
        expect(text).toBeDefined();
        expect(text!.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('debe contener los textos específicos en español para Sobre Nosotros', () => {
    const es = TRANSLATIONS.es;
    expect(es['landing.about.badge']).toBe('Nuestra Historia y Propósito');
    expect(es['landing.about.title']).toBe('Creado para que diseñar, cortar y presupuestar un mueble ocurra en un solo lugar');
    expect(es['landing.about.storyP1']).toContain('Sabemos lo frustrante que resulta querer fabricar un mueble');
    expect(es['landing.about.storyP2']).toContain('Este proyecto nació con una idea clara: reunir en una sola herramienta');
    expect(es['landing.about.storyP2']).toContain('sin necesidad de instalar plugins externos');
    expect(es['landing.about.missionTitle']).toBe('Nuestra Misión');
    expect(es['landing.about.missionText']).toContain('Queremos que cualquier persona');
    expect(es['landing.about.card1Title']).toBe('4 Herramientas en 1');
    expect(es['landing.about.card2Title']).toBe('Cero Plugins ni Instalaciones');
    expect(es['landing.about.card3Title']).toBe('Para Profesionales y Aficionados');
    expect(es['landing.about.card4Title']).toBe('Precisión Real de Taller');
    expect(es['landing.about.kpi1Val']).toBe('4 en 1');
    expect(es['landing.about.kpi2Val']).toBe('0');
    expect(es['landing.about.kpi3Val']).toBe('Pro & DIY');
    expect(es['landing.about.kpi4Val']).toBe('1:1');
  });

  it('debe renderizar en el DOM la sección Sobre Nosotros con el bloque Nuestra Misión, las 4 tarjetas y sus badges indicadores', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.componentInstance.selectLanguage('es');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const aboutSection = compiled.querySelector('#about-us');
    expect(aboutSection).toBeTruthy();

    const textContent = aboutSection?.textContent ?? '';
    expect(textContent).toContain('Nuestra Historia y Propósito');
    expect(textContent).toContain('Creado para que diseñar, cortar y presupuestar un mueble ocurra en un solo lugar');
    expect(textContent).toContain('Nuestra Misión');
    expect(textContent).toContain('4 Herramientas en 1');
    expect(textContent).toContain('Cero Plugins ni Instalaciones');
    expect(textContent).toContain('Para Profesionales y Aficionados');
    expect(textContent).toContain('Precisión Real de Taller');
    expect(textContent).toContain('4 en 1');
    expect(textContent).toContain('0');
    expect(textContent).toContain('Pro & DIY');
    expect(textContent).toContain('1:1');

    // Cero menciones a softwares de terceros ni nombres de backend en la sección Sobre Nosotros
    const lower = textContent.toLowerCase();
    expect(lower).not.toContain('sketchup');
    expect(lower).not.toContain('autocad');
    expect(lower).not.toContain('excel');
    expect(lower).not.toContain('supabase');
    expect(lower).not.toContain('postgres');
  });

  it('debe actualizar reactivamente el DOM de la sección Sobre Nosotros al alternar entre los 6 idiomas', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    const component = fixture.componentInstance;
    const compiled = fixture.nativeElement as HTMLElement;
    const aboutSection = compiled.querySelector('#about-us');
    expect(aboutSection).toBeTruthy();

    // 1. Inglés
    component.selectLanguage('en');
    fixture.detectChanges();
    expect(aboutSection?.textContent).toContain('Our Story & Purpose');
    expect(aboutSection?.textContent).toContain('Our Mission');
    expect(aboutSection?.textContent).toContain('4 Tools in 1');

    // 2. Portugués
    component.selectLanguage('pt');
    fixture.detectChanges();
    expect(aboutSection?.textContent).toContain('Nossa História e Propósito');
    expect(aboutSection?.textContent).toContain('Nossa Missão');
    expect(aboutSection?.textContent).toContain('4 Ferramentas em 1');

    // 3. Francés
    component.selectLanguage('fr');
    fixture.detectChanges();
    expect(aboutSection?.textContent).toContain('Notre Histoire et Mission');
    expect(aboutSection?.textContent).toContain('Notre Mission');
    expect(aboutSection?.textContent).toContain('4 Outils en 1');

    // 4. Italiano
    component.selectLanguage('it');
    fixture.detectChanges();
    expect(aboutSection?.textContent).toContain('La Nostra Storia e Missione');
    expect(aboutSection?.textContent).toContain('La Nostra Missione');
    expect(aboutSection?.textContent).toContain('4 Strumenti in 1');

    // 5. Alemán
    component.selectLanguage('de');
    fixture.detectChanges();
    expect(aboutSection?.textContent).toContain('Unsere Geschichte und Mission');
    expect(aboutSection?.textContent).toContain('Unsere Mission');
    expect(aboutSection?.textContent).toContain('4 Werkzeuge in 1');

    // 6. Volver a Español
    component.selectLanguage('es');
    fixture.detectChanges();
    expect(aboutSection?.textContent).toContain('Nuestra Historia y Propósito');
    expect(aboutSection?.textContent).toContain('Nuestra Misión');
    expect(aboutSection?.textContent).toContain('4 Herramientas en 1');
  });

  describe('Sección de Precios & Conversión Multimoneda (Base COP + TRM en Vivo)', () => {
    it('la moneda de referencia inicial debe ser "COP", en orden COP/USD/MXN/EUR y sincronizada con PaymentService', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      const paymentService = TestBed.inject(PaymentService);
      const setDisplaySpy = vi.spyOn(paymentService, 'setDisplayCurrency');

      expect(component.selectedPricingCurrency()).toBe('COP');
      expect(component.pricingCurrencies.map((c) => c.code)).toEqual(['COP', 'USD', 'MXN', 'EUR']);
      expect(component.pricingCurrencies.map((c) => c.label)).toEqual([
        'COP ($)',
        'USD ($)',
        'MXN ($)',
        'EUR (€)'
      ]);

      component.setPricingCurrency('USD');
      expect(component.selectedPricingCurrency()).toBe('USD');
      expect(setDisplaySpy).toHaveBeenCalledWith('USD');

      component.setPricingCurrency('MXN');
      expect(component.selectedPricingCurrency()).toBe('MXN');
      expect(setDisplaySpy).toHaveBeenCalledTimes(1);

      component.setPricingCurrency('EUR');
      expect(component.selectedPricingCurrency()).toBe('EUR');
      expect(setDisplaySpy).toHaveBeenCalledTimes(1);

      component.setPricingCurrency('COP');
      expect(component.selectedPricingCurrency()).toBe('COP');
      expect(setDisplaySpy).toHaveBeenCalledWith('COP');
    });

    it('getConvertedPrice debe devolver conversión en vivo a USD cuando la moneda es COP y null en monedas extranjeras', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      const exchange = TestBed.inject(CurrencyExchangeService);
      exchange.rates.set({ ...DEFAULT_COP_RATES });

      // 1. En COP: convierte COP -> USD en vivo (49.900 / 3304 = 15.10 USD)
      component.setPricingCurrency('COP');
      const usdFromPro = component.getConvertedPrice(49900);
      expect(usdFromPro).toBe('≈ $ 15.10 USD');

      const usdFromInd = component.getConvertedPrice(95900);
      expect(usdFromInd).toBe('≈ $ 29.03 USD');

      // 2. En USD, MXN y EUR retorna null porque el precio principal ya está convertido
      component.setPricingCurrency('USD');
      expect(component.getConvertedPrice(49900)).toBeNull();
      component.setPricingCurrency('MXN');
      expect(component.getConvertedPrice(49900)).toBeNull();
      component.setPricingCurrency('EUR');
      expect(component.getConvertedPrice(49900)).toBeNull();
    });

    it('debe tener todas las claves de la sección de Precios y cobro COP/Wompi en los 6 idiomas sin USD quemados en facturación anual', () => {
      const requiredPricingKeys = [
        'landing.pricing.currencyLabel',
        'landing.pricing.currencyNotice',
        'landing.pricing.yearlyPeriod',
        'landing.pricing.internationalCardsHint',
        'landing.pricing.officialWompiPrefix',
        'landing.pricing.planStarterBadge',
        'landing.pricing.planStarterTitle',
        'landing.pricing.planStarterDesc',
        'landing.pricing.planStarterPrice',
        'landing.pricing.planStarterPeriod',
        'landing.pricing.planStarterCta',
        'landing.pricing.planStarterF1',
        'landing.pricing.planStarterF2',
        'landing.pricing.planStarterF3',
        'landing.pricing.planStarterLimit1',
        'landing.pricing.planStarterLimit2',
        'landing.pricing.planStarterLimit3',
        'landing.pricing.planProBadge',
        'landing.pricing.planProTitle',
        'landing.pricing.planProDesc',
        'landing.pricing.planProPriceMonthly',
        'landing.pricing.planProPriceYearly',
        'landing.pricing.planProPeriod',
        'landing.pricing.planProBilledYearly',
        'landing.pricing.planProValueNote',
        'landing.pricing.planProCta',
        'landing.pricing.planProF1',
        'landing.pricing.planProF2',
        'landing.pricing.planProF3',
        'landing.pricing.planProF4',
        'landing.pricing.planProF5',
        'landing.pricing.planProF6',
        'landing.pricing.planIndBadge',
        'landing.pricing.planIndTitle',
        'landing.pricing.planIndDesc',
        'landing.pricing.planIndPriceMonthly',
        'landing.pricing.planIndPriceYearly',
        'landing.pricing.planIndPeriod',
        'landing.pricing.planIndBilledYearly',
        'landing.pricing.planIndCta',
        'landing.pricing.planIndF1',
        'landing.pricing.planIndF2',
        'landing.pricing.planIndF3',
        'landing.pricing.planIndF4',
        'landing.pricing.planIndF5',
        'landing.pricing.planIndF6',
        'account.billing.copUsdToggleHint',
        'account.billing.wompiChargeLabel'
      ];

      const languages: AppLanguage[] = ['es', 'en', 'pt', 'fr', 'it', 'de'];

      for (const lang of languages) {
        for (const key of requiredPricingKeys) {
          const text = TRANSLATIONS[lang]?.[key];
          expect(text, `Falta clave ${key} en ${lang}`).toBeDefined();
          expect(text!.trim().length).toBeGreaterThan(0);
        }

        expect(TRANSLATIONS[lang]['landing.pricing.currencyNotice']).toContain('COP');
        expect(TRANSLATIONS[lang]['landing.pricing.currencyNotice']).not.toContain('USD');
        expect(TRANSLATIONS[lang]['landing.pricing.planProBilledYearly']).not.toContain('$144');
        expect(TRANSLATIONS[lang]['landing.pricing.planProBilledYearly']).not.toContain('USD');
        expect(TRANSLATIONS[lang]['landing.pricing.planIndBilledYearly']).not.toContain('$276');
        expect(TRANSLATIONS[lang]['landing.pricing.planIndBilledYearly']).not.toContain('USD');
      }
    });

    it('los precios principales en diccionario deben indicar explícitamente COP en todos los idiomas', () => {
      const languages: AppLanguage[] = ['es', 'en', 'pt', 'fr', 'it', 'de'];

      for (const lang of languages) {
        const starterPrice = TRANSLATIONS[lang]['landing.pricing.planStarterPrice'];
        const proMonthly = TRANSLATIONS[lang]['landing.pricing.planProPriceMonthly'];
        const proYearly = TRANSLATIONS[lang]['landing.pricing.planProPriceYearly'];
        const indMonthly = TRANSLATIONS[lang]['landing.pricing.planIndPriceMonthly'];
        const indYearly = TRANSLATIONS[lang]['landing.pricing.planIndPriceYearly'];

        expect(starterPrice).toContain('COP');
        expect(proMonthly).toContain('COP');
        expect(proYearly).toContain('COP');
        expect(indMonthly).toContain('COP');
        expect(indYearly).toContain('COP');
      }
    });

    it('debe renderizar por defecto en COP ($ 49.900 COP y $ 95.900 COP) con chip de conversión en vivo USD y aviso oficial', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const exchange = TestBed.inject(CurrencyExchangeService);
      exchange.rates.set({ ...DEFAULT_COP_RATES });
      fixture.componentInstance.selectLanguage('es');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const pricingSection = compiled.querySelector('#pricing');
      expect(pricingSection).toBeTruthy();

      const text = pricingSection?.textContent ?? '';

      // Precios oficiales en COP + chip USD en vivo
      expect(text).toContain('$ 0 COP');
      expect(text).toContain('$ 49.900 COP');
      expect(text).toContain('$ 95.900 COP');
      expect(text).toContain('≈ $ 15.10 USD');
      expect(text).toContain('≈ $ 29.03 USD');
      expect(text).toContain('Tarjetas internacionales');
      expect(text).toContain('Cobro oficial en COP · Ref. TRM en vivo');

      // Limitaciones del Plan Inicial y nota de valor
      expect(text).toContain('Límite de 1 proyecto activo (máximo 3 módulos)');
      expect(text).toContain('Optimizador 2D solo en vista previa (1 tablero)');
      expect(text).toContain('Sin descargas PDF, Guías de Armado, Etiquetas ni CNC');
      expect(text).toContain('Se paga solo ahorrando menos de medio tablero de melamina al mes');
    });

    it('al seleccionar USD, MXN o EUR debe mostrar la conversión en vivo en el precio principal y el cobro oficial Wompi en COP debajo', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      const exchange = TestBed.inject(CurrencyExchangeService);
      exchange.rates.set({ ...DEFAULT_COP_RATES });
      component.selectLanguage('es');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      // 1. USD
      const usdBtn = compiled.querySelector('[data-testid="landing-currency-USD"]') as HTMLButtonElement | null;
      usdBtn?.click();
      fixture.detectChanges();

      expect(compiled.querySelector('[data-testid="landing-pro-price"]')?.textContent?.trim()).toBe('$ 15.10 USD');
      expect(compiled.querySelector('[data-testid="landing-ind-price"]')?.textContent?.trim()).toBe('$ 29.03 USD');
      expect(compiled.querySelector('[data-testid="landing-pro-subprice"]')?.textContent).toContain('Cobro oficial Wompi:');
      expect(compiled.querySelector('[data-testid="landing-pro-subprice"]')?.textContent).toContain('$ 49.900 COP');
      expect(compiled.querySelector('[data-testid="landing-ind-subprice"]')?.textContent).toContain('$ 95.900 COP');

      // 2. MXN
      const mxnBtn = compiled.querySelector('[data-testid="landing-currency-MXN"]') as HTMLButtonElement | null;
      mxnBtn?.click();
      fixture.detectChanges();

      expect(compiled.querySelector('[data-testid="landing-pro-price"]')?.textContent).toContain('MXN');
      expect(compiled.querySelector('[data-testid="landing-pro-price"]')?.textContent).toContain('235');
      expect(compiled.querySelector('[data-testid="landing-pro-subprice"]')?.textContent).toContain('Cobro oficial Wompi:');
      expect(compiled.querySelector('[data-testid="landing-pro-subprice"]')?.textContent).toContain('$ 49.900 COP');

      // 3. EUR
      const eurBtn = compiled.querySelector('[data-testid="landing-currency-EUR"]') as HTMLButtonElement | null;
      eurBtn?.click();
      fixture.detectChanges();

      expect(compiled.querySelector('[data-testid="landing-pro-price"]')?.textContent?.trim()).toBe('€ 10.97 EUR');
      expect(compiled.querySelector('[data-testid="landing-ind-price"]')?.textContent?.trim()).toBe('€ 21.08 EUR');
      expect(compiled.querySelector('[data-testid="landing-pro-subprice"]')?.textContent).toContain('$ 49.900 COP');
    });

    it('debe tener mapeados los iconos Hugeicons oficiales correspondientes para checks y restricciones', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;

      expect(component.icons.tick).toBeDefined();
      expect(component.icons.check).toBeDefined();
      expect(component.icons.lock).toBeDefined();
      expect(component.icons.limit).toBeDefined();
    });

    it('al alternar ciclo de facturación a yearly debe mostrar $ 39.920 COP y $ 76.720 COP con totales anuales exactos en COP y USD', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      const exchange = TestBed.inject(CurrencyExchangeService);
      exchange.rates.set({ ...DEFAULT_COP_RATES });
      component.selectLanguage('es');
      fixture.detectChanges();

      component.setBillingCycle('yearly');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const text = compiled.querySelector('#pricing')?.textContent ?? '';

      expect(text).toContain('$ 39.920 COP');
      expect(text).toContain('$ 76.720 COP');
      expect(text).toContain('Facturado anualmente');
      expect(text).toContain('$ 479.040 COP / año');
      expect(text).toContain('$ 920.640 COP / año');
      expect(text).toContain('≈ $ 12.08 USD');
      expect(text).toContain('≈ $ 23.22 USD');

      // Al cambiar a USD en anual debe mostrar el total oficial COP en Wompi
      component.setPricingCurrency('USD');
      fixture.detectChanges();
      expect(compiled.querySelector('[data-testid="landing-pro-price"]')?.textContent?.trim()).toBe('$ 12.08 USD');
      expect(compiled.querySelector('[data-testid="landing-pro-subprice"]')?.textContent).toContain('Cobro oficial Wompi:');
      expect(compiled.querySelector('[data-testid="landing-pro-subprice"]')?.textContent).toContain('$ 479.040 COP');
      expect(compiled.querySelector('[data-testid="landing-pro-subprice"]')?.textContent).toContain('/ año');
    });

    it('debe sincronizarse con platformSettings COP y actualizar el DOM al modificar precios vía updateCmsConfig', () => {
      const settingsSig = signal<{
        pro_monthly_cop?: number;
        pro_annual_monthly_cop?: number;
        pro_annual_total_cop?: number;
        industrial_monthly_cop?: number;
        industrial_annual_monthly_cop?: number;
        industrial_annual_total_cop?: number;
      }>({
        pro_monthly_cop: 52000,
        pro_annual_monthly_cop: 41600,
        pro_annual_total_cop: 499200,
        industrial_monthly_cop: 99000,
        industrial_annual_monthly_cop: 79200,
        industrial_annual_total_cop: 950400
      });
      (mockSupabase as Record<string, unknown>)['platformSettings'] = settingsSig;

      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      component.selectLanguage('es');
      fixture.detectChanges();

      expect(component.pricingConfig()).toEqual({
        starter: { monthly: 0, yearly: 0, yearlyTotal: 0 },
        pro: { monthly: 52000, yearly: 41600, yearlyTotal: 499200 },
        industrial: { monthly: 99000, yearly: 79200, yearlyTotal: 950400 }
      });

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="landing-pro-price"]')?.textContent?.trim()).toBe('$ 52.000 COP');
      expect(compiled.querySelector('[data-testid="landing-ind-price"]')?.textContent?.trim()).toBe('$ 99.000 COP');

      // Actualizar vía CMS
      component.updateCmsConfig({
        pricing: {
          starter: { monthly: 0, yearly: 0, yearlyTotal: 0 },
          pro: {
            monthly: OFFICIAL_COP_PRICING.pro.monthly,
            yearly: OFFICIAL_COP_PRICING.pro.annualMonthly,
            yearlyTotal: OFFICIAL_COP_PRICING.pro.annualTotal
          },
          industrial: {
            monthly: OFFICIAL_COP_PRICING.industrial.monthly,
            yearly: OFFICIAL_COP_PRICING.industrial.annualMonthly,
            yearlyTotal: OFFICIAL_COP_PRICING.industrial.annualTotal
          }
        }
      });
      fixture.detectChanges();

      expect(compiled.querySelector('[data-testid="landing-pro-price"]')?.textContent?.trim()).toBe('$ 49.900 COP');
      expect(compiled.querySelector('[data-testid="landing-ind-price"]')?.textContent?.trim()).toBe('$ 95.900 COP');

      component.setBillingCycle('yearly');
      fixture.detectChanges();

      const yearlyText = compiled.querySelector('#pricing')?.textContent ?? '';
      expect(yearlyText).toContain('$ 39.920 COP');
      expect(yearlyText).toContain('$ 76.720 COP');
      expect(yearlyText).toContain('$ 479.040 COP / año');
      expect(yearlyText).toContain('$ 920.640 COP / año');
    });

    it('debe reflejar el estado aria-pressed en los selectores de facturación y moneda', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const copBtn = compiled.querySelector('[data-testid="landing-currency-COP"]') as HTMLButtonElement | null;
      expect(copBtn?.getAttribute('aria-pressed')).toBe('true');

      component.setBillingCycle('yearly');
      component.setPricingCurrency('EUR');
      fixture.detectChanges();

      const pressedBtns = compiled.querySelectorAll('button[aria-pressed="true"]');
      expect(pressedBtns.length).toBeGreaterThanOrEqual(2);
      expect(compiled.querySelector('[data-testid="landing-currency-EUR"]')?.getAttribute('aria-pressed')).toBe('true');
      expect(copBtn?.getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('Banner Dinámico de Avisos / Mantenimiento (CMS SuperAdmin)', () => {
    it('el signal de aviso inicial debe ser null y no renderizar banner en el DOM', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.systemAnnouncement()).toBeNull();
      const compiled = fixture.nativeElement as HTMLElement;
      const banner = compiled.querySelector('[role="alert"]');
      expect(banner).toBeNull();
    });

    it('debe renderizar aviso de tipo info, warning y maintenance con su texto y botón descartar', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;

      // 1. Info
      component.systemAnnouncement.set({
        id: 'ann-1',
        type: 'info',
        message: 'Nueva actualización de exportación CNC disponible.',
        timestamp: '10:00 AM'
      });
      fixture.detectChanges();

      let compiled = fixture.nativeElement as HTMLElement;
      let banner = compiled.querySelector('[role="alert"]');
      expect(banner).toBeTruthy();
      expect(banner?.textContent).toContain('Nueva actualización de exportación CNC disponible.');
      expect(banner?.textContent).toContain('(10:00 AM)');
      expect(banner?.classList.contains('bg-blue-600')).toBe(true);

      // 2. Warning
      component.systemAnnouncement.set({
        id: 'ann-2',
        type: 'warning',
        message: 'Mantenimiento programado en servidores.',
        dismissible: true
      });
      fixture.detectChanges();

      compiled = fixture.nativeElement as HTMLElement;
      banner = compiled.querySelector('[role="alert"]');
      expect(banner?.textContent).toContain('Mantenimiento programado en servidores.');
      expect(banner?.classList.contains('bg-rose-500')).toBe(true);

      // 3. Maintenance
      component.systemAnnouncement.set({
        id: 'ann-3',
        type: 'maintenance',
        message: 'Modo mantenimiento temporal activado.',
        dismissible: true
      });
      fixture.detectChanges();

      compiled = fixture.nativeElement as HTMLElement;
      banner = compiled.querySelector('[role="alert"]');
      expect(banner?.textContent).toContain('Modo mantenimiento temporal activado.');
      expect(banner?.classList.contains('bg-amber-500')).toBe(true);

      // Botón descartar con accesibilidad localizada
      const dismissBtn = banner?.querySelector('button');
      expect(dismissBtn?.getAttribute('aria-label')).toBe('Cerrar aviso');

      // Descartar aviso
      component.dismissAnnouncement();
      fixture.detectChanges();
      banner = compiled.querySelector('[role="alert"]');
      expect(banner).toBeNull();
      expect(component.systemAnnouncement()).toBeNull();
    });

    it('la clave landing.announcement.dismiss debe estar definida en los 6 idiomas', () => {
      const languages: AppLanguage[] = ['es', 'en', 'pt', 'fr', 'it', 'de'];
      for (const lang of languages) {
        const text = TRANSLATIONS[lang]?.['landing.announcement.dismiss'];
        expect(text).toBeDefined();
        expect(text!.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('Sección de Requisitos del Sistema (Mínimos y Recomendados)', () => {
    it('debe tener todas las 26 claves de traducción en los 6 idiomas', () => {
      const requiredKeys = [
        'landing.requirements.badge',
        'landing.requirements.title',
        'landing.requirements.subtitle',
        'landing.requirements.minBadge',
        'landing.requirements.minTitle',
        'landing.requirements.minDesc',
        'landing.requirements.recBadge',
        'landing.requirements.recTitle',
        'landing.requirements.recDesc',
        'landing.requirements.itemRam',
        'landing.requirements.itemCpu',
        'landing.requirements.itemDisplay',
        'landing.requirements.itemBrowser',
        'landing.requirements.itemPeripherals',
        'landing.requirements.itemConnection',
        'landing.requirements.minRam',
        'landing.requirements.minCpu',
        'landing.requirements.minDisplay',
        'landing.requirements.minBrowser',
        'landing.requirements.minPeripherals',
        'landing.requirements.recRam',
        'landing.requirements.recCpu',
        'landing.requirements.recDisplay',
        'landing.requirements.recPeripherals',
        'landing.requirements.recConnection',
        'landing.requirements.bottomNotice'
      ];

      const languages: AppLanguage[] = ['es', 'en', 'pt', 'fr', 'it', 'de'];

      for (const lang of languages) {
        for (const key of requiredKeys) {
          const text = TRANSLATIONS[lang]?.[key];
          expect(text).toBeDefined();
          expect(text!.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('debe renderizar en el DOM la sección con las 2 tarjetas comparativas y la cápsula informativa', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      fixture.componentInstance.selectLanguage('es');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const section = compiled.querySelector('#system-requirements');
      expect(section).toBeTruthy();

      const text = section?.textContent ?? '';
      expect(text).toContain('Rendimiento en Navegador');
      expect(text).toContain('Requisitos técnicos para ejecutar el estudio 3D');
      expect(text).toContain('Requisitos Mínimos');
      expect(text).toContain('Requisitos Recomendados');
      expect(text).toContain('4 GB de memoria RAM disponible');
      expect(text).toContain('8 GB a 16 GB de memoria RAM');
      expect(text).toContain('WebGL 2.0');
      expect(text).toContain('Por ergonomía de precisión CAD y manejo de cotas en milímetros');

      // Cero marcas de terceros ni nombres de backend
      const lower = text.toLowerCase();
      expect(lower).not.toContain('intel');
      expect(lower).not.toContain('amd');
      expect(lower).not.toContain('nvidia');
      expect(lower).not.toContain('windows');
      expect(lower).not.toContain('chrome');
      expect(lower).not.toContain('supabase');
      expect(lower).not.toContain('postgres');
    });

    it('debe actualizarse reactivamente en el DOM al cambiar de idioma', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      const compiled = fixture.nativeElement as HTMLElement;
      const section = compiled.querySelector('#system-requirements');
      expect(section).toBeTruthy();

      // Inglés
      component.selectLanguage('en');
      fixture.detectChanges();
      expect(section?.textContent).toContain('Browser Performance');
      expect(section?.textContent).toContain('Minimum Requirements');
      expect(section?.textContent).toContain('Recommended Requirements');

      // Alemán
      component.selectLanguage('de');
      fixture.detectChanges();
      expect(section?.textContent).toContain('Browser-Leistung');
      expect(section?.textContent).toContain('Mindestanforderungen');
      expect(section?.textContent).toContain('Empfohlene Anforderungen');

      // Volver a Español
      component.selectLanguage('es');
      fixture.detectChanges();
      expect(section?.textContent).toContain('Rendimiento en Navegador');
    });

    it('debe renderizar enlaces legales en el footer hacia /terms, /privacy, /refunds y el correo de soporte', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('a[routerLink="/terms"]')).toBeTruthy();
      expect(compiled.querySelector('a[routerLink="/privacy"]')).toBeTruthy();
      expect(compiled.querySelector('a[routerLink="/refunds"]')).toBeTruthy();
      expect(compiled.textContent).toContain('piezo3dstudio@gmail.com');
      expect(compiled.textContent).not.toContain('eydersuarez900@gmail.com');
      expect(compiled.querySelector('a[href="mailto:piezo3dstudio@gmail.com"]')).toBeTruthy();
    });

    it('jamás debe mostrar el correo legado eydersuarez900@gmail.com en el DOM aunque platformSettings aún lo contenga', () => {
      const settingsSig = signal<{ support_email?: string }>({
        support_email: 'eydersuarez900@gmail.com'
      });
      (mockSupabase as Record<string, unknown>)['platformSettings'] = settingsSig;

      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(component.supportEmail()).toBe('piezo3dstudio@gmail.com');
      expect(compiled.textContent).toContain('piezo3dstudio@gmail.com');
      expect(compiled.textContent).not.toContain('eydersuarez900@gmail.com');

      settingsSig.set({ support_email: 'soporte@piezo3d.com' });
      fixture.detectChanges();
      expect(component.supportEmail()).toBe('soporte@piezo3d.com');
      expect(compiled.textContent).toContain('soporte@piezo3d.com');
    });
  });

  describe('SEO Semántico, FAQ y Accesibilidad ARIA (FASE 4)', () => {
    it('debe renderizar un único <h1> con palabras clave de diseño 3D, melamina y despiece y actualizarlo en los 6 idiomas', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      component.selectLanguage('es');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const h1Elements = compiled.querySelectorAll('h1');
      expect(h1Elements.length).toBe(1);

      const h1Text = h1Elements.item(0).textContent ?? '';
      expect(h1Text).toContain('Diseño 3D');
      expect(h1Text).toContain('Melamina');
      expect(h1Text).toContain('Despiece');
      expect(h1Text.toLowerCase()).not.toContain('melamina 3d');

      const langs: readonly AppLanguage[] = ['es', 'en', 'pt', 'fr', 'it', 'de'];
      for (const lang of langs) {
        component.selectLanguage(lang);
        fixture.detectChanges();
        const currentH1 = compiled.querySelectorAll('h1');
        expect(currentH1.length).toBe(1);
        expect(currentH1.item(0).textContent?.trim()).toBe(TRANSLATIONS[lang]['landing.hero.title']);
      }
    });

    it('debe mantener una jerarquía semántica estricta (<h1> -> <h2> -> <h3>, sin saltos a <h4>-<h6>) e incluir #faq', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      component.selectLanguage('es');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const h1Elements = compiled.querySelectorAll('h1');
      const h2Elements = compiled.querySelectorAll('h2');
      const h3Elements = compiled.querySelectorAll('h3');
      const skippedHeadings = compiled.querySelectorAll('h4, h5, h6');

      expect(h1Elements.length).toBe(1);
      expect(h2Elements.length).toBeGreaterThanOrEqual(7);
      expect(h3Elements.length).toBeGreaterThanOrEqual(4);
      expect(skippedHeadings.length).toBe(0);

      const faqSection = compiled.querySelector('section#faq');
      expect(faqSection).toBeTruthy();
      expect(faqSection?.querySelector('h2')?.textContent).toContain('Preguntas Frecuentes');
      expect(faqSection?.querySelectorAll('h3').length).toBe(4);
      expect(faqSection?.querySelectorAll('hugeicons-icon').length).toBe(5);
    });

    it('debe incluir todas las claves landing.faq.* y landing.a11y.* en los 6 idiomas sin marcas ni términos prohibidos', () => {
      const langs: readonly AppLanguage[] = ['es', 'en', 'pt', 'fr', 'it', 'de'];
      const requiredKeys = [
        'landing.nav.faq',
        'landing.hero.title',
        'landing.faq.badge',
        'landing.faq.title',
        'landing.faq.subtitle',
        'landing.faq.q1',
        'landing.faq.a1',
        'landing.faq.q2',
        'landing.faq.a2',
        'landing.faq.q3',
        'landing.faq.a3',
        'landing.faq.q4',
        'landing.faq.a4',
        'landing.a11y.mainNav',
        'landing.a11y.navFaq',
        'landing.a11y.termsLink',
        'landing.a11y.privacyLink',
        'landing.a11y.refundsLink',
        'landing.a11y.supportEmailLink',
      ];
      const forbiddenBrandRegex =
        /(sketchup|melamina\s*3d|mueble\s*m[ií]o|polyboard|promob|lepton|cutlist|opticut|click-cuisine|carpenterpro)/i;
      const forbiddenInfraRegex = /(supabase|postgresql|postgres|umdcxcjrdyckpxomxlmi|sql\s*editor)/i;

      for (const lang of langs) {
        const dict = TRANSLATIONS[lang];
        for (const key of requiredKeys) {
          const value = dict[key];
          expect(value, `Falta clave ${key} en idioma ${lang}`).toBeTruthy();
          expect(value.trim().length).toBeGreaterThan(0);
          expect(forbiddenBrandRegex.test(value)).toBe(false);
          expect(forbiddenInfraRegex.test(value)).toBe(false);
        }
      }
    });

    it('debe expandir y contraer las preguntas del acordeón FAQ mediante toggleFaq y actualizar aria-expanded', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      component.selectLanguage('es');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(component.faqItems.length).toBe(4);
      expect(component.openFaqIndex()).toBe(0);

      const firstTrigger = compiled.querySelector('#faq-trigger-0') as HTMLButtonElement | null;
      const secondTrigger = compiled.querySelector('#faq-trigger-1') as HTMLButtonElement | null;
      expect(firstTrigger?.getAttribute('aria-expanded')).toBe('true');
      expect(secondTrigger?.getAttribute('aria-expanded')).toBe('false');
      expect(compiled.querySelector('#faq-panel-0')).toBeTruthy();
      expect(compiled.querySelector('#faq-panel-1')).toBeFalsy();

      secondTrigger?.click();
      fixture.detectChanges();

      expect(component.openFaqIndex()).toBe(1);
      expect(firstTrigger?.getAttribute('aria-expanded')).toBe('false');
      expect(secondTrigger?.getAttribute('aria-expanded')).toBe('true');
      expect(compiled.querySelector('#faq-panel-0')).toBeFalsy();
      expect(compiled.querySelector('#faq-panel-1')).toBeTruthy();

      const secondIcon = secondTrigger?.querySelector('hugeicons-icon');
      expect(secondIcon?.classList.contains('rotate-180')).toBe(true);

      component.toggleFaq(1);
      fixture.detectChanges();
      expect(component.openFaqIndex()).toBeNull();
      expect(compiled.querySelector('#faq-panel-1')).toBeFalsy();
    });

    it('debe incluir atributos aria-label descriptivos en navegación, botones de sección, selector de idioma y enlaces legales', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      component.selectLanguage('es');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const mainNav = compiled.querySelector('nav[aria-label="Navegación principal"]');
      expect(mainNav).toBeTruthy();

      const navButtons = mainNav?.querySelectorAll('button') ?? [];
      expect(navButtons.length).toBeGreaterThanOrEqual(5);
      for (const button of Array.from(navButtons)) {
        const label = button.getAttribute('aria-label')?.trim() ?? '';
        expect(label.length).toBeGreaterThan(5);
      }

      const termsLink = compiled.querySelector('a[routerLink="/terms"]');
      const privacyLink = compiled.querySelector('a[routerLink="/privacy"]');
      const refundsLink = compiled.querySelector('a[routerLink="/refunds"]');

      expect(termsLink?.getAttribute('aria-label')?.trim().length).toBeGreaterThan(5);
      expect(privacyLink?.getAttribute('aria-label')?.trim().length).toBeGreaterThan(5);
      expect(refundsLink?.getAttribute('aria-label')?.trim().length).toBeGreaterThan(5);

      const footerNav = compiled.querySelector('footer nav');
      expect(footerNav?.getAttribute('aria-label')?.trim().length).toBeGreaterThan(5);
      expect(footerNav?.textContent).toContain('Preguntas Frecuentes');
    });
  });

  describe('Integración de Protección de Pagos y Acceso Anticipado en Pricing', () => {
    it('por defecto (payments_enabled === false) debe mostrar el aviso de pagos en implementación, bloquear planes pagos con "Próximamente" y mantener activo Plan Inicial', () => {
      const paymentService = TestBed.inject(PaymentService);
      const openCheckoutSpy = vi.spyOn(paymentService, 'openCheckout').mockResolvedValue(undefined);
      const pricingCfgService = TestBed.inject(LandingPricingConfigService);
      pricingCfgService.setLocalConfigForTesting(cloneLandingPricingConfig(DEFAULT_LANDING_PRICING_CONFIG));

      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      component.selectLanguage('es');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const pricingSection = compiled.querySelector('#pricing');
      expect(pricingSection).toBeTruthy();
      const pricingText = pricingSection?.textContent ?? '';

      expect(pricingText).toContain('Plan Inicial');
      expect(pricingText).toContain('Plan Taller Pro');
      expect(pricingText).toContain('Plan Industrial & CNC');
      expect(pricingText).toContain('Mensual');
      expect(pricingText).toContain('Anual');
      expect(pricingText.toLowerCase()).not.toContain('sitio en construcción');

      const notice = compiled.querySelector('[data-testid="landing-payments-disabled-notice"]') as HTMLElement | null;
      expect(notice).toBeTruthy();
      expect(notice?.textContent).toContain('Pagos en línea en implementación');

      const starterLink = compiled.querySelector('[data-testid="pricing-cta-starter"]') as HTMLAnchorElement | null;
      const proBtn = compiled.querySelector('[data-testid="pricing-cta-pro"]') as HTMLButtonElement | null;
      const indBtn = compiled.querySelector('[data-testid="pricing-cta-industrial"]') as HTMLButtonElement | null;

      expect(starterLink).toBeTruthy();
      expect(starterLink?.tagName).toBe('A');
      expect(starterLink?.getAttribute('href')).toContain('/auth');

      expect(proBtn).toBeTruthy();
      expect(proBtn?.disabled).toBe(true);
      expect(proBtn?.textContent).toContain('Próximamente');

      expect(indBtn).toBeTruthy();
      expect(indBtn?.disabled).toBe(true);
      expect(indBtn?.textContent).toContain('Próximamente');

      proBtn?.click();
      indBtn?.click();
      component.selectPaidPlan('pro');
      component.selectPaidPlan('industrial');
      expect(openCheckoutSpy).not.toHaveBeenCalled();
    });

    it('cuando payments_enabled === true debe ocultar el aviso y habilitar los botones de planes pagos con su ctaLabel', () => {
      const pricingCfgService = TestBed.inject(LandingPricingConfigService);
      pricingCfgService.applyLocalConfig({ payments_enabled: true });

      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      component.selectLanguage('es');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const pricingText = compiled.querySelector('#pricing')?.textContent ?? '';
      expect(compiled.querySelector('[data-testid="landing-payments-disabled-notice"]')).toBeNull();
      expect(pricingText.toLowerCase()).not.toContain('sitio en construcción');
      expect(pricingText.toLowerCase()).not.toContain('próximamente');

      const proBtn = compiled.querySelector('[data-testid="pricing-cta-pro"]') as HTMLButtonElement | null;
      const indBtn = compiled.querySelector('[data-testid="pricing-cta-industrial"]') as HTMLButtonElement | null;
      expect(proBtn?.disabled).toBe(false);
      expect(proBtn?.textContent).toContain('Elegir Plan Taller Pro');
      expect(indBtn?.disabled).toBe(false);
      expect(indBtn?.textContent).toContain('Elegir Plan Industrial');
    });

    it('el CTA de Plan Inicial debe enlazar a /auth?mode=register o /studio sin activar openCheckout', () => {
      const paymentService = TestBed.inject(PaymentService);
      const openCheckoutSpy = vi.spyOn(paymentService, 'openCheckout').mockResolvedValue(undefined);
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      component.selectLanguage('es');

      isAuthSignal.set(false);
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const starterGuest = compiled.querySelector('[data-testid="pricing-cta-starter"]') as HTMLAnchorElement | null;
      expect(starterGuest).toBeTruthy();
      expect(starterGuest?.tagName).toBe('A');
      expect(starterGuest?.getAttribute('href')).toContain('/auth');
      expect(starterGuest?.getAttribute('href')).toContain('mode=register');

      isAuthSignal.set(true);
      fixture.detectChanges();
      const starterAuth = compiled.querySelector('[data-testid="pricing-cta-starter"]') as HTMLAnchorElement | null;
      expect(starterAuth?.getAttribute('href')).toBe('/studio');
      expect(openCheckoutSpy).not.toHaveBeenCalled();
    });

    it('al pulsar Taller Pro e Industrial & CNC con payments_enabled === true debe invocar openCheckout con el plan y ciclo activos', () => {
      const pricingCfgService = TestBed.inject(LandingPricingConfigService);
      pricingCfgService.applyLocalConfig({ payments_enabled: true });
      const paymentService = TestBed.inject(PaymentService);
      const openCheckoutSpy = vi.spyOn(paymentService, 'openCheckout').mockResolvedValue(undefined);
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      component.selectLanguage('es');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const proBtn = compiled.querySelector('[data-testid="pricing-cta-pro"]') as HTMLButtonElement | null;
      const indBtn = compiled.querySelector('[data-testid="pricing-cta-industrial"]') as HTMLButtonElement | null;
      expect(proBtn).toBeTruthy();
      expect(indBtn).toBeTruthy();

      proBtn?.click();
      expect(openCheckoutSpy).toHaveBeenCalledWith('pro', 'monthly');

      component.setBillingCycle('yearly');
      fixture.detectChanges();
      indBtn?.click();
      expect(openCheckoutSpy).toHaveBeenCalledWith('industrial', 'annual');
    });

    it('en modo protegido con payments_enabled === true, pulsar los planes de pago debe poblar earlyAccessModalState y dejar intacto Plan Inicial', async () => {
      const earlyAccessStateSignal = signal<{
        plan: 'pro' | 'industrial';
        cycle: 'monthly' | 'annual';
        sourceRoute: string;
      } | null>(null);
      const paymentMock = {
        isPaymentsProtected: signal(true),
        earlyAccessModalState: earlyAccessStateSignal.asReadonly(),
        openCheckout: vi.fn(async (plan: 'pro' | 'industrial', cycle?: 'monthly' | 'annual' | 'yearly') => {
          const normalizedCycle = cycle === 'yearly' ? 'annual' : (cycle ?? 'monthly');
          earlyAccessStateSignal.set({ plan, cycle: normalizedCycle, sourceRoute: '/' });
        })
      };

      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [LandingPageComponent],
        providers: [
          provideRouter([]),
          { provide: SupabaseService, useValue: mockSupabase },
          { provide: PaymentService, useValue: paymentMock }
        ]
      }).compileComponents();

      TestBed.inject(LandingPricingConfigService).applyLocalConfig({ payments_enabled: true });
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      component.selectLanguage('es');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const starterLink = compiled.querySelector('[data-testid="pricing-cta-starter"]') as HTMLAnchorElement | null;
      expect(starterLink?.getAttribute('href')).toContain('/auth');
      expect(earlyAccessStateSignal()).toBeNull();

      const proBtn = compiled.querySelector('[data-testid="pricing-cta-pro"]') as HTMLButtonElement | null;
      proBtn?.click();
      expect(paymentMock.openCheckout).toHaveBeenCalledWith('pro', 'monthly');
      expect(earlyAccessStateSignal()).toEqual({
        plan: 'pro',
        cycle: 'monthly',
        sourceRoute: '/'
      });
    });
  });

  describe('Banner Promocional Dinámico, Sello de Propiedad Intelectual y Planes Dinámicos', () => {
    it('debe mostrar el banner promocional con descuento, fecha de expiración futura en español y copia de código con feedback "Copiado" por 2s', async () => {
      vi.useFakeTimers();
      try {
        const writeTextMock = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: writeTextMock },
          configurable: true
        });

        const pricingCfgService = TestBed.inject(LandingPricingConfigService);
        pricingCfgService.applyLocalConfig({
          promo_enabled: true,
          promo_badge: 'LANZAMIENTO 2026',
          promo_message: 'Descuento especial para talleres nuevos.',
          promo_code: 'TALLER25',
          promo_discount_percent: 25,
          promo_expires_at: '2026-12-15T18:00:00.000Z'
        });

        const fixture = TestBed.createComponent(LandingPageComponent);
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const promoBanner = compiled.querySelector('[data-testid="landing-promo-banner"]') as HTMLElement | null;
        expect(promoBanner).toBeTruthy();
        expect(compiled.querySelector('[data-testid="landing-promo-badge"]')?.textContent).toContain('LANZAMIENTO 2026');
        expect(compiled.querySelector('[data-testid="landing-promo-discount"]')?.textContent?.trim()).toBe('-25%');
        expect(promoBanner?.textContent).toContain('Descuento especial para talleres nuevos.');

        const expiryText = compiled.querySelector('[data-testid="landing-promo-expiry"]')?.textContent ?? '';
        expect(expiryText).toContain('Válido hasta el');
        expect(expiryText).toContain('15');
        expect(expiryText).toContain('2026');
        expect(expiryText.toLowerCase()).toContain('dic');

        const codePill = compiled.querySelector('[data-testid="landing-promo-code"]') as HTMLElement | null;
        expect(codePill?.textContent?.trim()).toBe('TALLER25');
        expect(codePill?.className).toContain('font-numeric');

        const copyBtn = compiled.querySelector('[data-testid="landing-promo-copy-btn"]') as HTMLButtonElement | null;
        expect(copyBtn?.textContent).toContain('Copiar');
        copyBtn?.click();
        await Promise.resolve();
        fixture.detectChanges();

        expect(writeTextMock).toHaveBeenCalledWith('TALLER25');
        expect(copyBtn?.textContent).toContain('Copiado');

        vi.advanceTimersByTime(2000);
        fixture.detectChanges();
        expect(copyBtn?.textContent).toContain('Copiar');
      } finally {
        vi.useRealTimers();
      }
    });

    it('debe ocultar automáticamente el banner promocional cuando promo_expires_at ya expiró o promo_enabled es false', () => {
      const pricingCfgService = TestBed.inject(LandingPricingConfigService);
      pricingCfgService.applyLocalConfig({
        promo_enabled: true,
        promo_message: 'Oferta expirada',
        promo_expires_at: '2020-01-01T00:00:00.000Z'
      });

      const fixture = TestBed.createComponent(LandingPageComponent);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="landing-promo-banner"]')).toBeNull();

      pricingCfgService.applyLocalConfig({
        promo_enabled: false,
        promo_expires_at: null
      });
      fixture.detectChanges();
      expect(compiled.querySelector('[data-testid="landing-promo-banner"]')).toBeNull();
    });

    it('debe renderizar el sello de Garantía de Propiedad Intelectual cuando ip_guarantee_enabled === true y ocultarlo cuando es false', () => {
      const pricingCfgService = TestBed.inject(LandingPricingConfigService);
      pricingCfgService.applyLocalConfig({
        ip_guarantee_enabled: true,
        ip_guarantee_title: '100% Propiedad Intelectual Tuya',
        ip_guarantee_description: 'Tus planos y despieces son exclusivamente tuyos.'
      });

      const fixture = TestBed.createComponent(LandingPageComponent);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const seal = compiled.querySelector('[data-testid="landing-ip-guarantee-seal"]') as HTMLElement | null;
      expect(seal).toBeTruthy();
      expect(seal?.textContent).toContain('100% Propiedad Intelectual Tuya');
      expect(seal?.textContent).toContain('Tus planos y despieces son exclusivamente tuyos.');

      pricingCfgService.applyLocalConfig({ ip_guarantee_enabled: false });
      fixture.detectChanges();
      expect(compiled.querySelector('[data-testid="landing-ip-guarantee-seal"]')).toBeNull();
    });

    it('debe renderizar tarjetas dinámicas, descuento anual variable y características en negrita vs limitaciones', () => {
      const pricingCfgService = TestBed.inject(LandingPricingConfigService);
      const customConfig = cloneLandingPricingConfig(DEFAULT_LANDING_PRICING_CONFIG);
      customConfig.annual_discount_percent = 25;
      customConfig.plans[1].name = 'Taller Pro Edición 2026';
      customConfig.plans[1].priceCopMonthly = 60000;
      customConfig.plans[1].features = [
        { text: 'Propiedad 100% privada del taller', isBold: true, isLimitation: false },
        { text: 'Restricción de ejemplo', isBold: false, isLimitation: true }
      ];
      pricingCfgService.setLocalConfigForTesting(customConfig);

      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('[data-testid="landing-annual-discount-badge"]')?.textContent?.trim()).toBe('-25%');
      expect(compiled.querySelector('[data-testid="landing-pro-price"]')?.textContent?.trim()).toBe('$ 60.000 COP');

      const proCard = compiled.querySelector('[data-testid="landing-plan-card-pro"]') as HTMLElement;
      expect(proCard.textContent).toContain('Taller Pro Edición 2026');
      expect(proCard.textContent).toContain('Propiedad 100% privada del taller');
      expect(proCard.textContent).toContain('Restricción de ejemplo');

      component.setBillingCycle('yearly');
      fixture.detectChanges();
      expect(compiled.querySelector('[data-testid="landing-pro-price"]')?.textContent?.trim()).toBe('$ 45.000 COP');
      expect(compiled.querySelector('[data-testid="landing-pro-yearly-total"]')?.textContent).toContain('$ 540.000 COP');

      const pricingText = (compiled.querySelector('#pricing')?.textContent ?? '').toLowerCase();
      expect(pricingText).not.toContain('supabase');
      expect(pricingText).not.toContain('postgres');
      expect(pricingText).not.toContain('uuid');
    });
  });

  describe('Auditoría SEO de Enlaces Internos y rel="nofollow" en /auth', () => {
    it('cuando no hay sesión activa, todo <a> hacia /auth debe incluir rel="nofollow", ningún enlace debe contener "www." y los enlaces legales del footer deben ser relativos sin rel="nofollow"', () => {
      isAuthSignal.set(false);
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      component.selectLanguage('es');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;

      const verifyLinksSnapshot = (expectedMinAuthLinks: number): void => {
        const anchors = Array.from(compiled.querySelectorAll('a'));
        expect(anchors.length).toBeGreaterThan(0);

        const authAnchors = anchors.filter((anchor) => {
          const href = anchor.getAttribute('href') ?? '';
          return href.includes('/auth');
        });
        expect(authAnchors.length).toBeGreaterThanOrEqual(expectedMinAuthLinks);

        for (const authAnchor of authAnchors) {
          expect(
            authAnchor.getAttribute('rel'),
            `Falta rel="nofollow" en enlace ${authAnchor.getAttribute('href')}`
          ).toBe('nofollow');
        }

        for (const anchor of anchors) {
          const href = anchor.getAttribute('href') ?? '';
          expect(href.toLowerCase()).not.toContain('www.');
          if (!href.startsWith('mailto:')) {
            expect(href.startsWith('/')).toBe(true);
            expect(href).not.toMatch(/^https?:\/\//i);
          }
        }
      };

      // Vista inicial (barra superior, hero, sobre nosotros, pricing starter, footer)
      verifyLinksSnapshot(6);

      // Con menú móvil desplegado (incluye enlaces móviles a /auth)
      component.toggleMobileMenu();
      fixture.detectChanges();
      verifyLinksSnapshot(8);

      // Enlaces legales del footer y enlace raíz deben ser relativos y SIN rel="nofollow"
      const legalRoutes = ['/terms', '/privacy', '/refunds'] as const;
      for (const route of legalRoutes) {
        const legalLink = compiled.querySelector(`footer a[routerLink="${route}"]`) as HTMLAnchorElement | null;
        expect(legalLink, `Falta enlace legal ${route} en el footer`).toBeTruthy();
        expect(legalLink?.getAttribute('href')).toBe(route);
        expect(legalLink?.getAttribute('rel')).toBeNull();
      }

      const homeLink = compiled.querySelector('header a[routerLink="/"]') as HTMLAnchorElement | null;
      expect(homeLink).toBeTruthy();
      expect(homeLink?.getAttribute('href')).toBe('/');
      expect(homeLink?.getAttribute('rel')).toBeNull();
    });

    it('cuando el usuario está autenticado, los CTAs hacia /studio omiten rel="nofollow" mientras los enlaces estáticos a /auth conservan rel="nofollow"', () => {
      isAuthSignal.set(true);
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      component.selectLanguage('es');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const anchors = Array.from(compiled.querySelectorAll('a'));

      const studioAnchors = anchors.filter((anchor) =>
        (anchor.getAttribute('href') ?? '').startsWith('/studio')
      );
      expect(studioAnchors.length).toBeGreaterThanOrEqual(5);
      for (const studioAnchor of studioAnchors) {
        expect(studioAnchor.getAttribute('rel')).toBeNull();
      }

      const authAnchors = anchors.filter((anchor) =>
        (anchor.getAttribute('href') ?? '').includes('/auth')
      );
      expect(authAnchors.length).toBeGreaterThanOrEqual(1);
      for (const authAnchor of authAnchors) {
        expect(authAnchor.getAttribute('rel')).toBe('nofollow');
      }
    });
  });
});

