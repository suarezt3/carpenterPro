import { computed, Injectable, signal } from '@angular/core';
import {
  AppLanguage,
  APP_LANGUAGES,
  LanguageOption,
  TRANSLATIONS,
} from '../data/i18n-translations.data';

export const STORAGE_LANG_KEY = 'carpenterpro_lang';

/**
 * Motor Reactivo de Internacionalización (i18n) basado en Signals de Angular.
 * Permite cambiar de idioma en caliente sin recargar la página ni destruir el contexto WebGL de Three.js.
 */
@Injectable({
  providedIn: 'root'
})
export class I18nService {
  /**
   * Signal reactivo con el idioma actualmente seleccionado.
   */
  readonly currentLang = signal<AppLanguage>(this.getInitialLanguage());

  /**
   * Catálogo de idiomas soportados con códigos ISO y nombres.
   */
  readonly languages: readonly LanguageOption[] = APP_LANGUAGES;

  /**
   * Metadatos del idioma actual (código, ISO y nombre).
   */
  readonly currentLanguageOption = computed<LanguageOption>(() => {
    const lang = this.currentLang();
    return this.languages.find(l => l.code === lang) ?? this.languages[0];
  });

  /**
   * Código ISO de 2 letras en mayúscula (ES, EN, PT, FR, IT, DE) para la interfaz compacta.
   */
  readonly currentIso = computed<string>(() => this.currentLanguageOption().iso);

  constructor() {
    // Sincronizar el atributo html lang inicial en el navegador
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = this.currentLang();
    }
  }

  /**
   * Verifica si un código corresponde a uno de los 6 idiomas soportados.
   */
  private isValidLanguage(lang: unknown): lang is AppLanguage {
    return lang === 'es' || lang === 'en' || lang === 'pt' || lang === 'fr' || lang === 'it' || lang === 'de';
  }

  /**
   * Obtiene el idioma inicial desde localStorage con fallback seguro a español ('es').
   */
  private getInitialLanguage(): AppLanguage {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_LANG_KEY);
        if (this.isValidLanguage(saved)) {
          return saved;
        }
      } catch {
        // Entorno restringido o cookies/localStorage deshabilitadas
      }
    }
    return 'es';
  }

  /**
   * Cambia el idioma activo de forma reactiva instantánea.
   * Actualiza el Signal, persiste en localStorage y sincroniza document.documentElement.lang.
   */
  setLanguage(lang: AppLanguage): void {
    if (!this.isValidLanguage(lang) || this.currentLang() === lang) {
      return;
    }

    this.currentLang.set(lang);

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_LANG_KEY, lang);
      } catch {
        // Fallback silencioso si localStorage está bloqueado
      }
    }

    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = lang;
    }
  }

  /**
   * Traduce dinámicamente nombres de piezas estándar o generadas por plantilla
   * (ej. "Lateral Izquierdo", "Cajón 1 - Frente de Cajón", "Base", etc.)
   */
  translatePartName(name: string): string {
    if (!name || this.currentLang() === 'es') {
      return name;
    }
    const lang = this.currentLang();
    const map = PART_TRANSLATIONS[lang];
    if (!map) return name;

    if (map[name]) {
      return map[name];
    }

    let translated = name;
    for (const term of PART_TERMS_ES) {
      if (translated.includes(term) && map[term]) {
        translated = translated.replace(new RegExp(term, 'g'), map[term]);
      }
    }
    return translated;
  }

  /**
   * Método reactivo de traducción de claves.
   * Al leer this.currentLang(), cualquier computed(), efecto o pipe vinculado
   * se reevaluará de forma automática e inmediata al cambiar el idioma.
   */
  t(key: string, params?: Record<string, string | number>): string {
    const lang = this.currentLang();
    const dictionary = TRANSLATIONS[lang] || TRANSLATIONS['es'];
    let text = dictionary[key] ?? TRANSLATIONS['es'][key];

    if (text === undefined) {
      text = this.translatePartName(key);
    }

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{\\{${k}\\}\\}|\\{${k}\\}`, 'g'), String(v));
      }
    }

    return text;
  }
}

const PART_TERMS_ES: readonly string[] = [
  'Lateral Izquierdo de Caja',
  'Lateral Derecho de Caja',
  'Lateral Izquierdo Cajón',
  'Lateral Derecho Cajón',
  'Zócalo Lateral Izquierdo',
  'Zócalo Lateral Derecho',
  'Muro Lateral Izquierdo',
  'Muro Lateral Derecho',
  'Lateral Izquierdo Apoyo a Pared',
  'Lateral Izquierdo',
  'Lateral Derecho',
  'Repisa Ajustable',
  'Repisa Fija',
  'Divisor Vertical',
  'Puerta Izquierda',
  'Puerta Derecha',
  'Frente de Cajón',
  'Frente Cajón',
  'Trasera de Cajón',
  'Trasera Cajón',
  'Fondo de Cajón',
  'Fondo Cajón',
  'Zócalo Frontal',
  'Zócalo Trasero',
  'Amarre Frontal',
  'Amarre Trasero',
  'Tapa Superior',
  'Pieza Manual',
  'Base',
  'Techo',
  'Fondo',
  'Repisa',
  'Divisor',
  'Puerta',
  'Zócalo',
  'Mesón',
  'Salpicadero',
  'Costado',
  'Cajón'
];

const PART_TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  es: {
    'Lateral Izquierdo de Caja': 'Lateral Izquierdo de Caja',
    'Lateral Derecho de Caja': 'Lateral Derecho de Caja',
    'Lateral Izquierdo Cajón': 'Lateral Izquierdo Cajón',
    'Lateral Derecho Cajón': 'Lateral Derecho Cajón',
    'Zócalo Lateral Izquierdo': 'Zócalo Lateral Izquierdo',
    'Zócalo Lateral Derecho': 'Zócalo Lateral Derecho',
    'Muro Lateral Izquierdo': 'Muro Lateral Izquierdo',
    'Muro Lateral Derecho': 'Muro Lateral Derecho',
    'Lateral Izquierdo Apoyo a Pared': 'Lateral Izquierdo Apoyo a Pared',
    'Lateral Izquierdo': 'Lateral Izquierdo',
    'Lateral Derecho': 'Lateral Derecho',
    'Repisa Ajustable': 'Repisa Ajustable',
    'Repisa Fija': 'Repisa Fija',
    'Divisor Vertical': 'Divisor Vertical',
    'Puerta Izquierda': 'Puerta Izquierda',
    'Puerta Derecha': 'Puerta Derecha',
    'Frente de Cajón': 'Frente de Cajón',
    'Frente Cajón': 'Frente Cajón',
    'Trasera de Cajón': 'Trasera de Cajón',
    'Trasera Cajón': 'Trasera Cajón',
    'Fondo de Cajón': 'Fondo de Cajón',
    'Fondo Cajón': 'Fondo Cajón',
    'Zócalo Frontal': 'Zócalo Frontal',
    'Zócalo Trasero': 'Zócalo Trasero',
    'Amarre Frontal': 'Amarre Frontal',
    'Amarre Trasero': 'Amarre Trasero',
    'Tapa Superior': 'Tapa Superior',
    'Pieza Manual': 'Pieza Manual',
    'Base': 'Base',
    'Techo': 'Techo',
    'Fondo': 'Fondo',
    'Repisa': 'Repisa',
    'Divisor': 'Divisor',
    'Puerta': 'Puerta',
    'Zócalo': 'Zócalo',
    'Mesón': 'Mesón',
    'Salpicadero': 'Salpicadero',
    'Costado': 'Costado',
    'Cajón': 'Cajón'
  },
  en: {
    'Lateral Izquierdo de Caja': 'Drawer Left Side',
    'Lateral Derecho de Caja': 'Drawer Right Side',
    'Lateral Izquierdo Cajón': 'Drawer Left Side',
    'Lateral Derecho Cajón': 'Drawer Right Side',
    'Zócalo Lateral Izquierdo': 'Left Plinth',
    'Zócalo Lateral Derecho': 'Right Plinth',
    'Muro Lateral Izquierdo': 'Left Side Wall',
    'Muro Lateral Derecho': 'Right Side Wall',
    'Lateral Izquierdo Apoyo a Pared': 'Left Wall Support Side',
    'Lateral Izquierdo': 'Left Side',
    'Lateral Derecho': 'Right Side',
    'Repisa Ajustable': 'Adjustable Shelf',
    'Repisa Fija': 'Fixed Shelf',
    'Divisor Vertical': 'Vertical Divider',
    'Puerta Izquierda': 'Left Door',
    'Puerta Derecha': 'Right Door',
    'Frente de Cajón': 'Drawer Front',
    'Frente Cajón': 'Drawer Front',
    'Trasera de Cajón': 'Drawer Back',
    'Trasera Cajón': 'Drawer Back',
    'Fondo de Cajón': 'Drawer Bottom',
    'Fondo Cajón': 'Drawer Bottom',
    'Zócalo Frontal': 'Front Plinth',
    'Zócalo Trasero': 'Rear Plinth',
    'Amarre Frontal': 'Front Stretcher',
    'Amarre Trasero': 'Rear Stretcher',
    'Tapa Superior': 'Top Cover',
    'Pieza Manual': 'Manual Part',
    'Base': 'Bottom Panel',
    'Techo': 'Top Panel',
    'Fondo': 'Back Panel',
    'Repisa': 'Shelf',
    'Divisor': 'Divider',
    'Puerta': 'Door',
    'Zócalo': 'Plinth',
    'Mesón': 'Countertop',
    'Salpicadero': 'Backsplash',
    'Costado': 'Side Panel',
    'Cajón': 'Drawer'
  },
  pt: {
    'Lateral Izquierdo de Caja': 'Lateral Esquerda da Gaveta',
    'Lateral Derecho de Caja': 'Lateral Direita da Gaveta',
    'Lateral Izquierdo Cajón': 'Lateral Esquerda da Gaveta',
    'Lateral Derecho Cajón': 'Lateral Direita da Gaveta',
    'Zócalo Lateral Izquierdo': 'Rodapé Lateral Esquerdo',
    'Zócalo Lateral Derecho': 'Rodapé Lateral Direito',
    'Muro Lateral Izquierdo': 'Muro Lateral Esquerdo',
    'Muro Lateral Derecho': 'Muro Lateral Direito',
    'Lateral Izquierdo Apoyo a Pared': 'Lateral Esquerda Apoio Parede',
    'Lateral Izquierdo': 'Lateral Esquerda',
    'Lateral Derecho': 'Lateral Direita',
    'Repisa Ajustable': 'Prateleira Ajustável',
    'Repisa Fija': 'Prateleira Fixa',
    'Divisor Vertical': 'Divisória Vertical',
    'Puerta Izquierda': 'Porta Esquerda',
    'Puerta Derecha': 'Porta Direita',
    'Frente de Cajón': 'Frente de Gaveta',
    'Frente Cajón': 'Frente de Gaveta',
    'Trasera de Cajón': 'Traseira da Gaveta',
    'Trasera Cajón': 'Traseira da Gaveta',
    'Fondo de Cajón': 'Fundo da Gaveta',
    'Fondo Cajón': 'Fundo da Gaveta',
    'Zócalo Frontal': 'Rodapé Frontal',
    'Zócalo Trasero': 'Rodapé Traseiro',
    'Amarre Frontal': 'Travessa Frontal',
    'Amarre Trasero': 'Travessa Traseira',
    'Tapa Superior': 'Tampo Superior',
    'Pieza Manual': 'Peça Manual',
    'Base': 'Base Inferior',
    'Techo': 'Tampo Superior',
    'Fondo': 'Fundo',
    'Repisa': 'Prateleira',
    'Divisor': 'Divisória',
    'Puerta': 'Porta',
    'Zócalo': 'Rodapé',
    'Mesón': 'Bancada',
    'Salpicadero': 'Rodabanca',
    'Costado': 'Lateral',
    'Cajón': 'Gaveta'
  },
  fr: {
    'Lateral Izquierdo de Caja': 'Côté Gauche Tiroir',
    'Lateral Derecho de Caja': 'Côté Droit Tiroir',
    'Lateral Izquierdo Cajón': 'Côté Gauche Tiroir',
    'Lateral Derecho Cajón': 'Côté Droit Tiroir',
    'Zócalo Lateral Izquierdo': 'Plinthe Latérale Gauche',
    'Zócalo Lateral Derecho': 'Plinthe Latérale Droite',
    'Muro Lateral Izquierdo': 'Mur Latéral Gauche',
    'Muro Lateral Derecho': 'Mur Latéral Droit',
    'Lateral Izquierdo Apoyo a Pared': 'Côté Gauche Appui Mural',
    'Lateral Izquierdo': 'Côté Gauche',
    'Lateral Derecho': 'Côté Droit',
    'Repisa Ajustable': 'Étagère Réglable',
    'Repisa Fija': 'Étagère Fixe',
    'Divisor Vertical': 'Montant Intermédiaire',
    'Puerta Izquierda': 'Porte Gauche',
    'Puerta Derecha': 'Porte Droite',
    'Frente de Cajón': 'Façade de Tiroir',
    'Frente Cajón': 'Façade de Tiroir',
    'Trasera de Cajón': 'Arrière de Tiroir',
    'Trasera Cajón': 'Arrière de Tiroir',
    'Fondo de Cajón': 'Fond de Tiroir',
    'Fondo Cajón': 'Fond de Tiroir',
    'Zócalo Frontal': 'Plinthe Avant',
    'Zócalo Trasero': 'Plinthe Arrière',
    'Amarre Frontal': 'Traverse Avant',
    'Amarre Trasero': 'Traverse Arrière',
    'Tapa Superior': 'Dessus Supérieur',
    'Pieza Manual': 'Pièce Manuelle',
    'Base': 'Base Inférieure',
    'Techo': 'Dessus / Toit',
    'Fondo': 'Fond / Panneau Arrière',
    'Repisa': 'Étagère',
    'Divisor': 'Séparateur',
    'Puerta': 'Porte',
    'Zócalo': 'Plinthe',
    'Mesón': 'Plan de Travail',
    'Salpicadero': 'Crédence',
    'Costado': 'Côté',
    'Cajón': 'Tiroir'
  },
  it: {
    'Lateral Izquierdo de Caja': 'Fianco Sinistro Cassetto',
    'Lateral Derecho de Caja': 'Fianco Destro Cassetto',
    'Lateral Izquierdo Cajón': 'Fianco Sinistro Cassetto',
    'Lateral Derecho Cajón': 'Fianco Destro Cassetto',
    'Zócalo Lateral Izquierdo': 'Zoccolo Laterale Sinistro',
    'Zócalo Lateral Derecho': 'Zoccolo Laterale Destro',
    'Muro Lateral Izquierdo': 'Muro Laterale Sinistro',
    'Muro Lateral Derecho': 'Muro Laterale Destro',
    'Lateral Izquierdo Apoyo a Pared': 'Fianco Sinistro Appoggio Parete',
    'Lateral Izquierdo': 'Fianco Sinistro',
    'Lateral Derecho': 'Fianco Destro',
    'Repisa Ajustable': 'Ripiano Regolabile',
    'Repisa Fija': 'Ripiano Fisso',
    'Divisor Vertical': 'Tramezzo Verticale',
    'Puerta Izquierda': 'Anta Sinistra',
    'Puerta Derecha': 'Anta Destra',
    'Frente de Cajón': 'Frontale Cassetto',
    'Frente Cajón': 'Frontale Cassetto',
    'Trasera de Cajón': 'Sponda Posteriore Cassetto',
    'Trasera Cajón': 'Sponda Posteriore Cassetto',
    'Fondo de Cajón': 'Fondo Cassetto',
    'Fondo Cajón': 'Fondo Cassetto',
    'Zócalo Frontal': 'Zoccolo Frontale',
    'Zócalo Trasero': 'Zoccolo Posteriore',
    'Amarre Frontal': 'Traversa Frontale',
    'Amarre Trasero': 'Traversa Posteriore',
    'Tapa Superior': 'Top Superiore',
    'Pieza Manual': 'Pezzo Manuale',
    'Base': 'Base Inferiore',
    'Techo': 'Cielo / Cappello',
    'Fondo': 'Schienale',
    'Repisa': 'Ripiano',
    'Divisor': 'Divisorio',
    'Puerta': 'Anta',
    'Zócalo': 'Zoccolo',
    'Mesón': 'Piano di Lavoro',
    'Salpicadero': 'Alzatina',
    'Costado': 'Fianco',
    'Cajón': 'Cassetto'
  },
  de: {
    'Lateral Izquierdo de Caja': 'Schubladenzarge Links',
    'Lateral Derecho de Caja': 'Schubladenzarge Rechts',
    'Lateral Izquierdo Cajón': 'Schubladenzarge Links',
    'Lateral Derecho Cajón': 'Schubladenzarge Rechts',
    'Zócalo Lateral Izquierdo': 'Sockelblende Links',
    'Zócalo Lateral Derecho': 'Sockelblende Rechts',
    'Muro Lateral Izquierdo': 'Linke Wand',
    'Muro Lateral Derecho': 'Rechte Wand',
    'Lateral Izquierdo Apoyo a Pared': 'Linke Wandabstützung',
    'Lateral Izquierdo': 'Linke Seite',
    'Lateral Derecho': 'Rechte Seite',
    'Repisa Ajustable': 'Verstellbarer Einlegeboden',
    'Repisa Fija': 'Fester Boden',
    'Divisor Vertical': 'Vertikale Trennwand',
    'Puerta Izquierda': 'Linke Tür',
    'Puerta Derecha': 'Rechte Tür',
    'Frente de Cajón': 'Schubladenblende',
    'Frente Cajón': 'Schubladenblende',
    'Trasera de Cajón': 'Schubladenrückwand',
    'Trasera Cajón': 'Schubladenrückwand',
    'Fondo de Cajón': 'Schubladenboden',
    'Fondo Cajón': 'Schubladenboden',
    'Zócalo Frontal': 'Sockelblende Vorne',
    'Zócalo Trasero': 'Sockelblende Hinten',
    'Amarre Frontal': 'Traverse Vorne',
    'Amarre Trasero': 'Traverse Hinten',
    'Tapa Superior': 'Abdeckplatte',
    'Pieza Manual': 'Manuelles Bauteil',
    'Base': 'Unterboden',
    'Techo': 'Oberboden',
    'Fondo': 'Rückwand',
    'Repisa': 'Einlegeboden',
    'Divisor': 'Mittelseite',
    'Puerta': 'Tür',
    'Zócalo': 'Sockelblende',
    'Mesón': 'Arbeitsplatte',
    'Salpicadero': 'Wandanschlussleiste',
    'Costado': 'Außenseite',
    'Cajón': 'Schublade'
  }
};
