import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialog } from './components/confirm-dialog/confirm-dialog';

/**
 * Componente raíz de la aplicación Piezo3D Studio.
 * Aloja el RouterOutlet principal y el diálogo global de confirmación.
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
export class App {}
