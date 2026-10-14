import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ThemeService } from '../../services/theme.service';

/**
 * Componente global de diálogo de confirmación asíncrona (Promise-based).
 * Reemplaza los `window.confirm()` nativos con una ventana modal accesible
 * compatible con atajos de teclado (`Enter` para confirmar, `Escape` para cancelar).
 */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:keydown)': 'handleKeyDown($event)'
  },
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css'
})
export class ConfirmDialog {
  readonly dialogService = inject(ConfirmDialogService);
  readonly themeService = inject(ThemeService);

  // Signals reactivos conectados al servicio central de confirmación
  readonly isOpen = this.dialogService.isOpen;
  readonly options = this.dialogService.options;

  /**
   * Captura las teclas Escape y Enter únicamente cuando el diálogo está visible.
   */
  handleKeyDown(event: KeyboardEvent) {
    if (!this.isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      this.confirm();
    }
  }

  confirm() {
    this.dialogService.confirm();
  }

  cancel() {
    this.dialogService.cancel();
  }
}