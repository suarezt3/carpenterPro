import { ReleaseVersion, RoadmapItem } from '../models/changelog.models';
import { AppLanguage } from './i18n-translations.data';
import {
  APP_RELEASES_BY_LANG,
  APP_ROADMAP_BY_LANG,
  RELEASES_ES,
  ROADMAP_ES
} from './changelog-i18n.data';

export const APP_CURRENT_VERSION = 'v2.5.0';

export { APP_RELEASES_BY_LANG, APP_ROADMAP_BY_LANG };

/**
 * Conjunto de versiones predeterminado en español (para compatibilidad hacia atrás).
 */
export const APP_RELEASES: ReleaseVersion[] = RELEASES_ES;

/**
 * Conjunto de ítems de hoja de ruta predeterminado en español.
 */
export const APP_ROADMAP: RoadmapItem[] = ROADMAP_ES;
