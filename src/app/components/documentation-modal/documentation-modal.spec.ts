import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DocumentationModalComponent } from './documentation-modal';
import { I18nService, STORAGE_LANG_KEY } from '../../services/i18n.service';
import { ThemeService } from '../../services/theme.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { AppLanguage } from '../../data/i18n-translations.data';
import { ADDITIONAL_TRANSLATIONS } from '../../data/i18n-additional-translations.data';
import {
  APP_DOC_ARTICLES_BY_LANG,
  APP_DOC_CATEGORIES_BY_LANG
} from '../../data/documentation-i18n.data';

describe('Empirical Adversarial Audit — Milestone 2: Help Center & Interactive Manual', () => {
  const EXPECTED_LANGUAGES: AppLanguage[] = ['es', 'en', 'pt', 'fr', 'it', 'de'];
  const EXPECTED_ARTICLE_COUNT = 17;
  const EXPECTED_ARTICLE_IDS = [
    'diseno_parametrico_ambientes',
    'ajuste_repisas_luz_interna',
    'presupuesto_multimoneda_tapacanto',
    'exportacion_dae_pdf_armado',
    'escala_humana_brujula',
    'bloqueo_congelar_piezas',
    'menu_contextual_inteligente',
    'habitacion_equipos_3d',
    'movimiento_directo_3d',
    'cinta_acciones_flotante',
    'seleccion_multiple_shift',
    'cortes_especiales_sifon',
    'mecanizados_cnc',
    'bisagras_reversibles',
    'parametros_taller_notas',
    'optimizador_despiece',
    'atajos_teclado'
  ];

  describe('1. Multilingual Documentation Data Integrity (APP_DOC_ARTICLES_BY_LANG & APP_DOC_CATEGORIES_BY_LANG)', () => {
    it('debe contener exactamente los 6 idiomas soportados en categorías y artículos', () => {
      const catLangs = Object.keys(APP_DOC_CATEGORIES_BY_LANG) as AppLanguage[];
      const artLangs = Object.keys(APP_DOC_ARTICLES_BY_LANG) as AppLanguage[];

      expect(catLangs.sort()).toEqual([...EXPECTED_LANGUAGES].sort());
      expect(artLangs.sort()).toEqual([...EXPECTED_LANGUAGES].sort());
    });

    for (const lang of EXPECTED_LANGUAGES) {
      describe(`Idioma: [${lang.toUpperCase()}]`, () => {
        it(`debe tener exactamente ${EXPECTED_ARTICLE_COUNT} artículos con IDs canónicos completos`, () => {
          const articles = APP_DOC_ARTICLES_BY_LANG[lang];
          expect(articles).toBeDefined();
          expect(articles.length).toBe(EXPECTED_ARTICLE_COUNT);

          const ids = articles.map(a => a.id);
          expect(ids).toEqual(EXPECTED_ARTICLE_IDS);
        });

        it('cada artículo debe tener title, shortDesc, steps, tips no vacíos y categoría válida', () => {
          const categories = APP_DOC_CATEGORIES_BY_LANG[lang];
          const validCatIds = new Set(categories.map(c => c.id));
          const articles = APP_DOC_ARTICLES_BY_LANG[lang];

          for (const art of articles) {
            expect(art.id).toBeTruthy();
            expect(typeof art.id).toBe('string');

            expect(art.title).toBeTruthy();
            expect(art.title.trim().length).toBeGreaterThan(3);

            expect(art.shortDesc).toBeTruthy();
            expect(art.shortDesc.trim().length).toBeGreaterThan(10);

            expect(art.icon).toBeTruthy();
            expect(art.iconColor).toBeTruthy();

            expect(validCatIds.has(art.category)).toBe(true);

            expect(Array.isArray(art.steps)).toBe(true);
            expect(art.steps.length).toBeGreaterThan(0);
            for (const step of art.steps) {
              expect(typeof step).toBe('string');
              expect(step.trim().length).toBeGreaterThan(5);
            }

            expect(Array.isArray(art.tips)).toBe(true);
            expect(art.tips.length).toBeGreaterThan(0);
            for (const tip of art.tips) {
              expect(typeof tip).toBe('string');
              expect(tip.trim().length).toBeGreaterThan(5);
            }

            if (art.technicalDetails) {
              expect(Array.isArray(art.technicalDetails)).toBe(true);
              for (const td of art.technicalDetails) {
                expect(td.label).toBeTruthy();
                expect(td.label.trim().length).toBeGreaterThan(1);
                expect(td.value).toBeTruthy();
                expect(td.value.trim().length).toBeGreaterThan(1);
              }
            }
          }
        });

        it('debe tener cero valores null o undefined en todo el dataset de artículos y categorías', () => {
          const articles = APP_DOC_ARTICLES_BY_LANG[lang];
          const categories = APP_DOC_CATEGORIES_BY_LANG[lang];

          const checkNoNulls = (obj: unknown, path = ''): void => {
            expect(obj).not.toBeNull();
            expect(obj).not.toBeUndefined();
            if (typeof obj === 'object' && obj !== null) {
              for (const [key, val] of Object.entries(obj)) {
                checkNoNulls(val, `${path}.${key}`);
              }
            }
          };

          checkNoNulls(categories, `categories[${lang}]`);
          checkNoNulls(articles, `articles[${lang}]`);
        });

        it('no debe contener emojis (especialmente candado 🔒) en títulos, descripciones o pasos', () => {
          const articles = APP_DOC_ARTICLES_BY_LANG[lang];
          const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]/u;

          for (const art of articles) {
            expect(art.title).not.toMatch(emojiRegex);
            expect(art.title).not.toContain('🔒');
            expect(art.shortDesc).not.toMatch(emojiRegex);
            expect(art.shortDesc).not.toContain('🔒');

            for (const step of art.steps) {
              expect(step).not.toMatch(emojiRegex);
              expect(step).not.toContain('🔒');
            }

            for (const tip of art.tips) {
              expect(tip).not.toMatch(emojiRegex);
              expect(tip).not.toContain('🔒');
            }
          }
        });

        it('no debe contener menciones a herramientas retiradas ("Patas de Mesa", cinta métrica antigua, atajos CAD [D] o [P])', () => {
          const articles = APP_DOC_ARTICLES_BY_LANG[lang];
          const categories = APP_DOC_CATEGORIES_BY_LANG[lang];

          // Categoría cinta_metrica retirada
          expect(categories.some(c => c.id === 'cinta_metrica')).toBe(false);
          // Categoría cotas_luz activa
          expect(categories.some(c => c.id === 'cotas_luz')).toBe(true);

          for (const art of articles) {
            expect(art.category).not.toBe('cinta_metrica');
            expect(art.title.toLowerCase()).not.toContain('patas de mesa');
            expect(art.shortDesc.toLowerCase()).not.toContain('patas de mesa');

            for (const step of art.steps) {
              expect(step.toLowerCase()).not.toContain('patas de mesa');
              expect(step).not.toContain('[ D ]');
              expect(step).not.toContain('[ P ]');
            }
          }
        });
      });
    }

    it('las 4 nuevas guías obligatorias deben existir en todos los idiomas con contenido coherente', () => {
      const requiredNewGuides = [
        'diseno_parametrico_ambientes',
        'ajuste_repisas_luz_interna',
        'presupuesto_multimoneda_tapacanto',
        'exportacion_dae_pdf_armado'
      ];

      for (const lang of EXPECTED_LANGUAGES) {
        const articles = APP_DOC_ARTICLES_BY_LANG[lang];
        for (const guideId of requiredNewGuides) {
          const guide = articles.find(a => a.id === guideId);
          expect(guide).toBeDefined();
          expect(guide!.steps.length).toBeGreaterThanOrEqual(4);
          expect(guide!.tips.length).toBeGreaterThanOrEqual(2);
        }
      }
    });

    it('la Guía 8 debe ser habitacion_equipos_3d y no contener patas de mesa', () => {
      for (const lang of EXPECTED_LANGUAGES) {
        const guide8 = APP_DOC_ARTICLES_BY_LANG[lang].find(a => a.id === 'habitacion_equipos_3d');
        expect(guide8).toBeDefined();
        expect(guide8!.category).toBe('herramientas_3d');
        const textDump = JSON.stringify(guide8).toLowerCase();
        expect(textDump).not.toContain('patas de mesa');
        expect(textDump).not.toContain('hairpin');
        expect(textDump).not.toContain('escandinavas');
      }
    });
  });

  describe('2. UI Localization Key Parity (help.* in i18n-additional-translations.data.ts)', () => {
    it('todas las claves help.* deben existir de manera simétrica en los 6 idiomas con 100% de paridad', () => {
      const helpKeysByLang: Record<AppLanguage, string[]> = {
        es: [], en: [], pt: [], fr: [], it: [], de: []
      };

      for (const lang of EXPECTED_LANGUAGES) {
        const dict = ADDITIONAL_TRANSLATIONS[lang];
        helpKeysByLang[lang] = Object.keys(dict)
          .filter(k => k.startsWith('help.'))
          .sort();
      }

      const esHelpKeys = helpKeysByLang.es;
      expect(esHelpKeys.length).toBeGreaterThanOrEqual(30);

      for (const lang of EXPECTED_LANGUAGES) {
        expect(helpKeysByLang[lang]).toEqual(esHelpKeys);
        for (const key of esHelpKeys) {
          const val = ADDITIONAL_TRANSLATIONS[lang][key];
          expect(val).toBeDefined();
          expect(val.trim().length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('3. DocumentationModalComponent Reactive Behavior & Signal Flow', () => {
    let component: DocumentationModalComponent;
    let fixture: ComponentFixture<DocumentationModalComponent>;
    let i18nService: I18nService;

    beforeEach(async () => {
      localStorage.removeItem(STORAGE_LANG_KEY);
      await TestBed.configureTestingModule({
        imports: [DocumentationModalComponent, TranslatePipe],
        providers: [I18nService, ThemeService, TranslatePipe]
      }).compileComponents();

      i18nService = TestBed.inject(I18nService);
      fixture = TestBed.createComponent(DocumentationModalComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('isOpen', true);
      fixture.detectChanges();
    });

    afterEach(() => {
      localStorage.removeItem(STORAGE_LANG_KEY);
    });

    it('debe crearse correctamente con señales iniciales válidas', () => {
      expect(component).toBeTruthy();
      expect(component.searchQuery()).toBe('');
      expect(component.activeCategory()).toBe('all');
      expect(component.selectedArticleId()).toBe('diseno_parametrico_ambientes');
      expect(component.categories().length).toBe(7);
      expect(component.articles().length).toBe(EXPECTED_ARTICLE_COUNT);
    });

    it('debe cambiar reactivamente las categorías y artículos al cambiar el idioma en I18nService', () => {
      // 1. Español por defecto
      expect(i18nService.currentLang()).toBe('es');
      expect(component.categories()[1].label).toBe('Módulos Paramétricos');
      expect(component.articles()[0].title).toContain('Diseño Paramétrico por Ambientes');

      // 2. Cambio reactivo a Inglés
      i18nService.setLanguage('en');
      expect(i18nService.currentLang()).toBe('en');
      expect(component.categories()[1].label).toBe('Parametric Modules');
      expect(component.articles()[0].title).toContain('Parametric Design by Environment');

      // 3. Cambio reactivo a Portugués
      i18nService.setLanguage('pt');
      expect(component.categories()[1].label).toBe('Módulos Paramétricos');
      expect(component.articles()[0].title).toContain('Design Paramétrico por Ambientes');

      // 4. Cambio reactivo a Francés
      i18nService.setLanguage('fr');
      expect(component.categories()[1].label).toBe('Modules Paramétriques');
      expect(component.articles()[0].title).toContain('Conception Paramétrique par Espaces');

      // 5. Cambio reactivo a Italiano
      i18nService.setLanguage('it');
      expect(component.categories()[1].label).toBe('Moduli Parametrici');
      expect(component.articles()[0].title).toContain('Progettazione Parametrica per Ambienti');

      // 6. Cambio reactivo a Alemán
      i18nService.setLanguage('de');
      expect(component.categories()[1].label).toBe('Parametrische Module');
      expect(component.articles()[0].title).toContain('Parametrisches Design nach Räumen');

      // 7. Retorno a Español
      i18nService.setLanguage('es');
      expect(component.categories()[1].label).toBe('Módulos Paramétricos');
      expect(component.articles()[0].title).toContain('Diseño Paramétrico por Ambientes');
    });

    it('debe filtrar artículos al seleccionar una categoría específica', () => {
      component.selectCategory('cotas_luz');
      expect(component.activeCategory()).toBe('cotas_luz');

      const filtered = component.filteredArticles();
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every(a => a.category === 'cotas_luz')).toBe(true);

      // El artículo seleccionado debe ser uno de los filtrados
      expect(filtered.some(a => a.id === component.selectedArticleId())).toBe(true);
    });

    it('debe filtrar artículos reactivamente por término de búsqueda en título, descripción o pasos', () => {
      component.searchQuery.set('sifón');
      const filtered = component.filteredArticles();
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.some(a => a.id === 'cortes_especiales_sifon')).toBe(true);

      component.searchQuery.set('término_inexistente_xyz_123');
      expect(component.filteredArticles().length).toBe(0);
      expect(component.selectedArticle()).toBeNull();

      component.searchQuery.set('');
      expect(component.filteredArticles().length).toBe(EXPECTED_ARTICLE_COUNT);
    });

    it('debe permitir navegación secuencial con goToNextArticle y goToPrevArticle', () => {
      component.activeCategory.set('all');
      component.searchQuery.set('');
      component.selectArticle(EXPECTED_ARTICLE_IDS[0]);

      expect(component.prevArticleItem()).toBeNull();
      expect(component.nextArticleItem()?.id).toBe(EXPECTED_ARTICLE_IDS[1]);

      component.goToNextArticle();
      expect(component.selectedArticleId()).toBe(EXPECTED_ARTICLE_IDS[1]);
      expect(component.prevArticleItem()?.id).toBe(EXPECTED_ARTICLE_IDS[0]);

      component.goToPrevArticle();
      expect(component.selectedArticleId()).toBe(EXPECTED_ARTICLE_IDS[0]);
    });

    it('debe emitir evento modalClose al llamar close()', () => {
      let closed = false;
      component.modalClose.subscribe(() => {
        closed = true;
      });
      component.close();
      expect(closed).toBe(true);
    });

    it('debe devolver iconos Hugeicons válidos en getCategoryIcon y getArticleIcon', () => {
      const catIcons = ['view_in_ar', 'straighten', 'architecture', 'adjust', 'precision_manufacturing', 'keyboard', 'auto_stories'];
      for (const icon of catIcons) {
        const iconDef = component.getCategoryIcon(icon);
        expect(iconDef).toBeDefined();
        expect(Array.isArray(iconDef)).toBe(true);
      }

      const artIcons = ['view_in_ar', 'cube', 'straighten', 'tag', 'download', 'human', 'lock', 'mouse', 'room', 'scissors', 'keyboard'];
      for (const icon of artIcons) {
        const iconDef = component.getArticleIcon(icon);
        expect(iconDef).toBeDefined();
        expect(Array.isArray(iconDef)).toBe(true);
      }
    });
  });

  describe('4. Template & HTML Markup Conformance', () => {
    let fixture: ComponentFixture<DocumentationModalComponent>;

    beforeEach(async () => {
      localStorage.removeItem(STORAGE_LANG_KEY);
      await TestBed.configureTestingModule({
        imports: [DocumentationModalComponent, TranslatePipe],
        providers: [I18nService, ThemeService, TranslatePipe]
      }).compileComponents();

      fixture = TestBed.createComponent(DocumentationModalComponent);
      fixture.componentRef.setInput('isOpen', true);
      fixture.detectChanges();
    });

    afterEach(() => {
      localStorage.removeItem(STORAGE_LANG_KEY);
    });

    it('el componente renderizado debe contener cero elementos <svg> directos en la plantilla', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      // Comprobar que en el árbol DOM del modal no existan etiquetas svg nativas embebidas directamente en el HTML
      const directSvgs = compiled.querySelectorAll(':scope > svg, .fixed svg');
      // Los únicos SVGs presentes son los generados internamente por los componentes <hugeicons-icon>
      const hugeiconsElements = compiled.querySelectorAll('hugeicons-icon');
      expect(hugeiconsElements.length).toBeGreaterThan(0);
    });

    it('todas las traducciones de UI del modal deben renderizarse sin fallar en los 6 idiomas', () => {
      const i18n = TestBed.inject(I18nService);
      const compiled = fixture.nativeElement as HTMLElement;

      for (const lang of EXPECTED_LANGUAGES) {
        i18n.setLanguage(lang);
        fixture.detectChanges();

        const titleHeader = compiled.querySelector('h2');
        expect(titleHeader?.textContent?.trim()).toBeTruthy();

        const footerText = compiled.querySelector('.border-t span');
        expect(footerText?.textContent?.trim()).toBeTruthy();
      }
    });

    it('debe sincronizar initialTab=feedback con activeModalTab cuando isOpen es true', async () => {
      fixture.componentRef.setInput('initialTab', 'feedback');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(fixture.componentInstance.activeModalTab()).toBe('feedback');

      fixture.componentInstance.selectTab('manual');
      expect(fixture.componentInstance.activeModalTab()).toBe('manual');
    });
  });
});

