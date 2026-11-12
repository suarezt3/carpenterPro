import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LandingPageComponent } from './landing-page';
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

  describe('Sección de Precios & Conversión Multimoneda', () => {
    it('la moneda de referencia inicial debe ser "USD" y debe poder conmutarse a COP, MXN y EUR', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;

      expect(component.selectedPricingCurrency()).toBe('USD');
      expect(component.pricingCurrencies.length).toBe(4);

      component.setPricingCurrency('COP');
      expect(component.selectedPricingCurrency()).toBe('COP');

      component.setPricingCurrency('MXN');
      expect(component.selectedPricingCurrency()).toBe('MXN');

      component.setPricingCurrency('EUR');
      expect(component.selectedPricingCurrency()).toBe('EUR');

      component.setPricingCurrency('USD');
      expect(component.selectedPricingCurrency()).toBe('USD');
    });

    it('getConvertedPrice debe devolver null para USD y valores aproximados formateados para otras monedas', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;

      // 1. En USD debe retornar null para no ensuciar la tarjeta
      component.setPricingCurrency('USD');
      expect(component.getConvertedPrice(15)).toBeNull();

      // 2. En COP: 15 USD ≈ 63.750 COP
      component.setPricingCurrency('COP');
      const copPrice = component.getConvertedPrice(15);
      expect(copPrice).toBeTruthy();
      expect(copPrice).toContain('≈ $');
      expect(copPrice).toContain('COP');
      expect(copPrice).toContain('63.750');

      // 3. En MXN: 15 USD ≈ 301 MXN
      component.setPricingCurrency('MXN');
      const mxnPrice = component.getConvertedPrice(15);
      expect(mxnPrice).toBeTruthy();
      expect(mxnPrice).toContain('≈ $');
      expect(mxnPrice).toContain('MXN');
      expect(mxnPrice).toContain('301');

      // 4. En EUR: 15 USD ≈ 14 EUR
      component.setPricingCurrency('EUR');
      const eurPrice = component.getConvertedPrice(15);
      expect(eurPrice).toBeTruthy();
      expect(eurPrice).toContain('≈ €');
      expect(eurPrice).toContain('EUR');
      expect(eurPrice).toContain('14');
    });

    it('debe tener todas las claves nuevas de la sección de Precios en los 6 idiomas', () => {
      const requiredPricingKeys = [
        'landing.pricing.currencyLabel',
        'landing.pricing.currencyNotice',
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
        'landing.pricing.planIndF6'
      ];

      const languages: AppLanguage[] = ['es', 'en', 'pt', 'fr', 'it', 'de'];

      for (const lang of languages) {
        for (const key of requiredPricingKeys) {
          const text = TRANSLATIONS[lang]?.[key];
          expect(text).toBeDefined();
          expect(text!.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('los precios principales deben indicar explícitamente USD en todos los idiomas', () => {
      const languages: AppLanguage[] = ['es', 'en', 'pt', 'fr', 'it', 'de'];

      for (const lang of languages) {
        const starterPrice = TRANSLATIONS[lang]['landing.pricing.planStarterPrice'];
        const proMonthly = TRANSLATIONS[lang]['landing.pricing.planProPriceMonthly'];
        const proYearly = TRANSLATIONS[lang]['landing.pricing.planProPriceYearly'];
        const indMonthly = TRANSLATIONS[lang]['landing.pricing.planIndPriceMonthly'];
        const indYearly = TRANSLATIONS[lang]['landing.pricing.planIndPriceYearly'];

        expect(starterPrice).toContain('USD');
        expect(proMonthly).toContain('USD');
        expect(proYearly).toContain('USD');
        expect(indMonthly).toContain('USD');
        expect(indYearly).toContain('USD');
      }
    });

    it('debe renderizar en el DOM los precios explícitos en USD ($15 y $29), las limitaciones del Plan Inicial y la nota de valor', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      fixture.componentInstance.selectLanguage('es');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const pricingSection = compiled.querySelector('#pricing');
      expect(pricingSection).toBeTruthy();

      const text = pricingSection?.textContent ?? '';

      // Precios principales con USD explícito ($15 USD y $29 USD)
      expect(text).toContain('$0 USD');
      expect(text).toContain('$15 USD');
      expect(text).toContain('$29 USD');

      // Limitaciones del Plan Inicial
      expect(text).toContain('Límite de 1 proyecto activo (máximo 3 módulos)');
      expect(text).toContain('Optimizador 2D solo en vista previa (1 tablero)');
      expect(text).toContain('Sin descargas PDF, Guías de Armado, Etiquetas ni CNC');

      // Nota de valor del Plan Taller Pro
      expect(text).toContain('Se paga solo ahorrando menos de medio tablero de melamina al mes');
    });

    it('al seleccionar COP como moneda de referencia en el selector debe mostrar en vivo la insignia de conversión', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      component.selectLanguage('es');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      let pricingSection = compiled.querySelector('#pricing');
      expect(pricingSection?.textContent).not.toContain('≈ $');

      // Seleccionar COP
      component.setPricingCurrency('COP');
      fixture.detectChanges();

      pricingSection = compiled.querySelector('#pricing');
      const text = pricingSection?.textContent ?? '';
      expect(text).toContain('≈ $');
      expect(text).toContain('COP');
      expect(text).toContain('/ mes');
    });

    it('debe tener mapeados los iconos Hugeicons oficiales correspondientes para checks y restricciones', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;

      expect(component.icons.tick).toBeDefined();
      expect(component.icons.check).toBeDefined();
      expect(component.icons.lock).toBeDefined();
      expect(component.icons.limit).toBeDefined();
    });

    it('debe calcular conversiones aproximadas correctas para planes Pro ($15/$12) y CNC ($29/$23) tanto en mensual como en anual', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;

      // COP:
      component.setPricingCurrency('COP');
      expect(component.getConvertedPrice(15)).toContain('63.750');
      expect(component.getConvertedPrice(12)).toContain('51.000');
      expect(component.getConvertedPrice(29)).toContain('123.250');
      expect(component.getConvertedPrice(23)).toContain('97.750');

      // MXN:
      component.setPricingCurrency('MXN');
      expect(component.getConvertedPrice(15)).toContain('301');
      expect(component.getConvertedPrice(12)).toContain('241');
      expect(component.getConvertedPrice(29)).toContain('581');
      expect(component.getConvertedPrice(23)).toContain('461');

      // EUR:
      component.setPricingCurrency('EUR');
      expect(component.getConvertedPrice(15)).toContain('14');
      expect(component.getConvertedPrice(12)).toContain('11');
      expect(component.getConvertedPrice(29)).toContain('27');
      expect(component.getConvertedPrice(23)).toContain('21');
    });

    it('al alternar ciclo de facturación a yearly debe actualizar el precio a $12 USD y $23 USD con facturación anual correcta', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      component.selectLanguage('es');
      fixture.detectChanges();

      component.setBillingCycle('yearly');
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const text = compiled.querySelector('#pricing')?.textContent ?? '';

      expect(text).toContain('$12 USD');
      expect(text).toContain('$23 USD');
      expect(text).toContain('Facturado anualmente ($144 USD / año)');
      expect(text).toContain('Facturado anualmente ($276 USD / año)');
    });

    it('debe gestionar pricingConfig de forma reactiva preparado para CMS y actualizar el DOM en vivo', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      component.selectLanguage('es');
      fixture.detectChanges();

      expect(component.pricingConfig()).toEqual({
        starter: { monthly: 0, yearly: 0 },
        pro: { monthly: 15, yearly: 12 },
        industrial: { monthly: 29, yearly: 23 }
      });

      const compiled = fixture.nativeElement as HTMLElement;
      let pricingText = compiled.querySelector('#pricing')?.textContent ?? '';
      expect(pricingText).toContain('$15 USD');
      expect(pricingText).toContain('$29 USD');

      // Actualizar vía CMS
      component.updateCmsConfig({
        pricing: {
          starter: { monthly: 0, yearly: 0 },
          pro: { monthly: 16, yearly: 13 },
          industrial: { monthly: 32, yearly: 25 }
        }
      });
      fixture.detectChanges();

      expect(component.pricingConfig().pro.monthly).toBe(16);
      expect(component.pricingConfig().industrial.monthly).toBe(32);
      expect(component.cmsConfig().pricing.pro.yearly).toBe(13);

      // El DOM debe reflejar inmediatamente los nuevos precios en modo mensual
      pricingText = compiled.querySelector('#pricing')?.textContent ?? '';
      expect(pricingText).toContain('$16 USD');
      expect(pricingText).toContain('$32 USD');

      // Al alternar a ciclo anual, el DOM debe mostrar los precios anuales actualizados y recalcular subtítulos
      component.setBillingCycle('yearly');
      fixture.detectChanges();

      pricingText = compiled.querySelector('#pricing')?.textContent ?? '';
      expect(pricingText).toContain('$13 USD');
      expect(pricingText).toContain('$25 USD');
      expect(pricingText).toContain('Facturado anualmente ($156 USD / año)');
      expect(pricingText).toContain('Facturado anualmente ($300 USD / año)');
    });

    it('debe reflejar el estado aria-pressed en los selectores de facturación y moneda', () => {
      const fixture = TestBed.createComponent(LandingPageComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const monthlyBtn = compiled.querySelector('button[aria-pressed="true"]');
      expect(monthlyBtn).toBeTruthy();

      component.setBillingCycle('yearly');
      component.setPricingCurrency('EUR');
      fixture.detectChanges();

      const pressedBtns = compiled.querySelectorAll('button[aria-pressed="true"]');
      expect(pressedBtns.length).toBeGreaterThanOrEqual(2);
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
      expect(compiled.textContent).toContain('eydersuarez900@gmail.com');
    });
  });
});

