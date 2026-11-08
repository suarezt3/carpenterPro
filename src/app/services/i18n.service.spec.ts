import { TestBed } from '@angular/core/testing';
import { I18nService, STORAGE_LANG_KEY } from './i18n.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { AppLanguage, APP_LANGUAGES, TRANSLATIONS } from '../data/i18n-translations.data';
import { APP_RELEASES_BY_LANG, APP_ROADMAP_BY_LANG } from '../data/changelog-i18n.data';

describe('I18nService & TranslatePipe (Multilenguaje Reactivo en Tiempo Real)', () => {
  let service: I18nService;
  let pipe: TranslatePipe;

  beforeEach(() => {
    localStorage.removeItem(STORAGE_LANG_KEY);
    TestBed.configureTestingModule({
      providers: [I18nService, TranslatePipe]
    });
    service = TestBed.inject(I18nService);
    pipe = TestBed.inject(TranslatePipe);
  });

  afterEach(() => {
    localStorage.removeItem(STORAGE_LANG_KEY);
  });

  it('debe inicializarse en español ("es") por defecto', () => {
    expect(service.currentLang()).toBe('es');
    expect(service.currentIso()).toBe('ES');
    expect(service.currentLanguageOption().name).toBe('Español');
  });

  it('debe traducir claves en español correctamente', () => {
    expect(service.t('nav.designer3d')).toBe('1. Diseñador 3D');
    expect(service.t('nav.partsList')).toBe('2. Despiece');
    expect(service.t('partsList.thinEdge')).toBe('Canto Delgado (0.45)');
    expect(pipe.transform('nav.designer3d')).toBe('1. Diseñador 3D');
  });

  it('debe cambiar de idioma a inglés ("en") y actualizar traducciones en caliente', () => {
    service.setLanguage('en');
    expect(service.currentLang()).toBe('en');
    expect(service.currentIso()).toBe('EN');
    expect(localStorage.getItem(STORAGE_LANG_KEY)).toBe('en');

    expect(service.t('nav.designer3d')).toBe('1. 3D Designer');
    expect(service.t('nav.partsList')).toBe('2. Cut List');
    expect(service.t('inspector.edgeBanding')).toBe('Edge Banding');
    expect(pipe.transform('nav.designer3d')).toBe('1. 3D Designer');
  });

  it('debe soportar los 6 idiomas clave: es, en, pt, fr, it, de con terminología técnica', () => {
    const edgeBandingTranslations: Record<AppLanguage, string> = {
      es: 'Tapacantos',
      en: 'Edge Banding',
      pt: 'Fita de Borda',
      fr: 'Chants',
      it: 'Bordatura',
      de: 'Kantenband'
    };

    const cutListTranslations: Record<AppLanguage, string> = {
      es: '2. Despiece',
      en: '2. Cut List',
      pt: '2. Plano de Corte',
      fr: '2. Liste de Débit',
      it: '2. Distinta Taglio',
      de: '2. Stückliste'
    };

    for (const opt of APP_LANGUAGES) {
      service.setLanguage(opt.code);
      expect(service.t('inspector.edgeBanding')).toBe(edgeBandingTranslations[opt.code]);
      expect(service.t('nav.partsList')).toBe(cutListTranslations[opt.code]);
    }
  });

  it('debe mantener paridad exacta de todas las claves en los 6 diccionarios', () => {
    const esKeys = Object.keys(TRANSLATIONS.es);
    for (const opt of APP_LANGUAGES) {
      const langDict = TRANSLATIONS[opt.code];
      const langKeys = Object.keys(langDict);
      expect(langKeys.length).toBe(esKeys.length);
      for (const k of esKeys) {
        expect(langDict[k]).toBeDefined();
        expect(langDict[k].trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('debe interpolar parámetros reales en claves de optimizador y presupuesto en los 6 idiomas', () => {
    service.setLanguage('es');
    expect(service.t('optimizer.cutMapTitle', { index: 2 })).toBe('Plano de Corte - Tablero #2');
    expect(service.t('optimizer.sheetCutInfo', { parts: 14, cuts: 22.5, area: 3.8 })).toBe('14 piezas ubicadas · 22.5 ml de corte · 3.8 m² utilizados');
    expect(service.t('budget.withProfitMargin', { margin: 35 })).toBe('Con 35% margen utilidad');

    service.setLanguage('en');
    expect(pipe.transform('optimizer.cutMapTitle', { index: 2 })).toBe('Cut Diagram - Sheet #2');
    expect(pipe.transform('budget.sheetsRequired', { count: 4 })).toBe('4 sheets required');
    expect(pipe.transform('labels.noLabels')).toBe('No labels to generate');
  });

  it('TranslatePipe debe retornar cadena vacía ante entrada nula, indefinida o vacía', () => {
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform(null as unknown as string)).toBe('');
    expect(pipe.transform(undefined as unknown as string)).toBe('');
  });

  it('debe ignorar códigos de idioma inválidos en localStorage o setLanguage y hacer fallback a español ("es")', () => {
    localStorage.setItem(STORAGE_LANG_KEY, 'invalid-lang');
    const freshService = new I18nService();
    expect(freshService.currentLang()).toBe('es');

    freshService.setLanguage('xx' as unknown as AppLanguage);
    expect(freshService.currentLang()).toBe('es');
  });

  it('debe hacer fallback al español si una clave no existe en otro idioma o devolver la clave literal', () => {
    service.setLanguage('de');
    expect(service.t('nav.designer3d')).toBe('1. 3D-Designer');
    expect(service.t('clave.inexistente.total')).toBe('clave.inexistente.total');
  });

  it('debe traducir correctamente nav.clientPlaceholder y las claves de inspector, despiece y presupuesto sin dobles signos de puntuación', () => {
    for (const opt of APP_LANGUAGES) {
      service.setLanguage(opt.code);
      expect(service.t('nav.clientPlaceholder')).not.toBe('nav.clientPlaceholder');
      expect(service.t('nav.projectNameLabel').endsWith(':')).toBe(true);
      expect(service.t('nav.clientLabel').endsWith(':')).toBe(true);
      expect(service.t('inspector.moduleMaterial')).not.toBe('inspector.moduleMaterial');
      expect(service.t('partsList.stoneCountertops')).not.toBe('partsList.stoneCountertops');
      expect(service.t('budget.profitMargin')).not.toBe('budget.profitMargin');
      expect(service.t('budget.productionCost')).not.toBe('budget.productionCost');
    }
  });

  it('debe traducir correctamente los 4 bloques clave (Changelog, Settings, Optimizador 2D y Finishes) en los 6 idiomas', () => {
    for (const opt of APP_LANGUAGES) {
      service.setLanguage(opt.code);

      // Bloque 1: Changelog
      expect(service.t('changelog.title')).toBeTruthy();
      expect(service.t('changelog.currentVersionInUse')).toBeTruthy();
      expect(service.t('changelog.keyPoints')).toBeTruthy();
      expect(service.t('changelog.understoodBtn')).toBeTruthy();

      // Bloque 2: Configuración (Settings)
      expect(service.t('settings.infoBanner')).toContain('<strong>');
      expect(service.t('settings.millimeterPrecision')).toBeTruthy();
      expect(service.t('settings.tooltipThicknessTitle')).toBeTruthy();
      expect(service.t('settings.tooltipSawKerfTitle')).toBeTruthy();
      expect(service.t('settings.tooltipTrimTitle')).toBeTruthy();

      // Bloque 3: Optimizador 2D
      const alertMsg = service.t('optimizer.unplacedAlert', { count: 3 });
      expect(alertMsg).toContain('3');
      expect(service.t('optimizer.unplacedAdvice')).toBeTruthy();

      // Bloque 4: Acabados de Equipos / Artefactos
      expect(service.t('appliance.finishStainlessSteel')).toBeTruthy();
      expect(service.t('appliance.finishBlackMatte')).toBeTruthy();
    }
  });

  it('debe traducir correctamente el módulo de notas y bitácora (notes.*) en los 6 idiomas', () => {
    for (const opt of APP_LANGUAGES) {
      service.setLanguage(opt.code);

      expect(service.t('notes.title')).toBeTruthy();
      expect(service.t('notes.newNote')).toBeTruthy();
      expect(service.t('notes.deleteNoteTitle')).toBeTruthy();
      expect(service.t('notes.deleteNoteMessage', { title: '"Test"' })).toContain('Test');
      expect(service.t('notes.deleteNoteConfirm')).toBeTruthy();
      expect(service.t('notes.editNoteTitle')).toBeTruthy();
      expect(service.t('notes.createNoteTitle')).toBeTruthy();
      expect(service.t('notes.catPending')).toBeTruthy();
      expect(service.t('notes.catAdjustment')).toBeTruthy();
      expect(service.t('notes.catDesign')).toBeTruthy();
      expect(service.t('notes.catGeneral')).toBeTruthy();
      expect(service.t('notes.tooltipBold')).toBeTruthy();
      expect(service.t('notes.filterAll')).toBeTruthy();
      expect(service.t('notes.searchPlaceholder')).toBeTruthy();
      expect(service.t('notes.emptyNoNotes')).toBeTruthy();
      expect(service.t('notes.emptyNoFiltered')).toBeTruthy();
      expect(service.t('notes.statusResolved')).toBeTruthy();
      expect(service.t('notes.statusPending')).toBeTruthy();
      expect(service.t('notes.catBadgeAdjustment')).toBeTruthy();
      expect(service.t('notes.catBadgeDesign')).toBeTruthy();
      expect(service.t('notes.catBadgeGeneral')).toBeTruthy();
      expect(service.t('notes.catBadgePending')).toBeTruthy();
    }
  });

  it('debe traducir correctamente el giro del módulo, orientación de cara y toasts en los 6 idiomas', () => {
    for (const opt of APP_LANGUAGES) {
      service.setLanguage(opt.code);

      // Giro de módulo y caras CAD
      expect(service.t('inspector.moduleRotation')).toBeTruthy();
      expect(service.t('inspector.orientFacingToward')).toBeTruthy();
      expect(service.t('designer.faceFront')).toBeTruthy();
      expect(service.t('designer.faceRight')).toBeTruthy();
      expect(service.t('designer.faceBack')).toBeTruthy();
      expect(service.t('designer.faceLeft')).toBeTruthy();
      expect(service.t('designer.lowerClearance')).toBeTruthy();
      expect(service.t('designer.upperClearance')).toBeTruthy();

      // Toasts configurados
      const wsToast = service.t('settings.workspaceToast', { width: '5.0', depth: '4.5' });
      expect(wsToast).toContain('5.0');
      expect(wsToast).toContain('4.5');

      const savedToast = service.t('settings.configSavedToast', { thickness: 18 });
      expect(savedToast).toContain('18');

      const savedAllToast = service.t('settings.configSavedAllToast', { thickness: 15 });
      expect(savedAllToast).toContain('15');
    }
  });

  it('debe contener las nuevas claves de Despiece, Guardado en Nube y Validación de Notas en los 6 idiomas', () => {
    for (const opt of APP_LANGUAGES) {
      service.setLanguage(opt.code);

      // Despiece: badge y tooltip
      const badgeText = service.t('partsList.appliancesTabBadge', { count: 3 });
      expect(badgeText).toContain('3');
      expect(badgeText.trim().length).toBeGreaterThan(1);

      const edgeTooltip = service.t('partsList.cycleEdgeTooltip', { edge: 'L1' });
      expect(edgeTooltip).toContain('L1');

      // Guardado en la nube y privacidad
      expect(service.t('projects.savingToCloud')).toBeTruthy();
      expect(service.t('projects.savedToCloud')).toBeTruthy();
      expect(service.t('projects.checkConnection')).toBeTruthy();
      const fallbackToast = service.t('projects.saveLocalFallback', { error: 'Network timeout' });
      expect(fallbackToast).toContain('Network timeout');

      // Validación de notas de proyecto
      expect(service.t('notes.validationMissingBoth')).toBeTruthy();
      expect(service.t('notes.validationMissingTitle')).toBeTruthy();
      expect(service.t('notes.validationMissingContent')).toBeTruthy();
    }
  });

  it('debe proveer versiones de Changelog y Roadmap completas para cada uno de los 6 idiomas', () => {
    for (const opt of APP_LANGUAGES) {
      const releases = APP_RELEASES_BY_LANG[opt.code];
      expect(releases).toBeDefined();
      expect(releases.length).toBeGreaterThanOrEqual(1);

      const currentRelease = releases.find(r => r.isCurrent);
      expect(currentRelease).toBeDefined();
      expect(currentRelease!.version).toBe('v3.0.0');
      expect(currentRelease!.name.trim().length).toBeGreaterThan(0);
      expect(currentRelease!.summary.trim().length).toBeGreaterThan(0);
      expect(currentRelease!.highlights.length).toBeGreaterThan(0);
      expect(currentRelease!.changes.length).toBeGreaterThan(0);

      const roadmap = APP_ROADMAP_BY_LANG[opt.code];
      expect(roadmap).toBeDefined();
      expect(roadmap.length).toBeGreaterThanOrEqual(3);
      for (const item of roadmap) {
        expect(item.title.trim().length).toBeGreaterThan(0);
        expect(item.description.trim().length).toBeGreaterThan(0);
        if (item.badge) {
          expect(item.badge.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });
});
