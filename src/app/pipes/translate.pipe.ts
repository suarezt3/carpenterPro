import { inject, Pipe, PipeTransform } from '@angular/core';
import { I18nService } from '../services/i18n.service';

/**
 * Pipe standalone 't' para traducir cadenas en plantillas Angular.
 * pure: false garantiza que las plantillas con OnPush se actualicen instantáneamente
 * tan pronto como el Signal currentLang de I18nService cambie, sin requerir recargar la página.
 */
@Pipe({
  name: 't',
  standalone: true,
  pure: false
})
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string, params?: Record<string, string | number>): string {
    if (!key) {
      return '';
    }
    return this.i18n.t(key, params);
  }
}
