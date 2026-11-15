import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialog } from './components/confirm-dialog/confirm-dialog';
import { SeoService } from './services/seo.service';

/**
 * Componente raíz de la aplicación Piezo3D Studio.
 * Aloja el RouterOutlet principal, el diálogo global de confirmación e inicializa el SEO dinámico por ruta.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    ConfirmDialog
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly seoService = inject(SeoService);

  constructor() {
    this.seoService.initRouteSeoListener();
  }
}
