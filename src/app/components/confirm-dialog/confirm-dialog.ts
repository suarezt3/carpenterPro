import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Alert02Icon,
  Delete02Icon,
  InformationCircleIcon,
  LockIcon,
  Tick02Icon
} from '@hugeicons/core-free-icons';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ThemeService } from '../../services/theme.service';

/**
 * Componente global de diálogo de confirmación asíncrona (Promise-based).
 * Utiliza iconos vectoriales SVG de @hugeicons/angular y soporta atajos de teclado (Enter / Escape).
 */
@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent],
  host: {
    '(window:keydown)': 'handleKeyDown($event)'
  },
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css'
})
export class ConfirmDialog {
  readonly dialogService = inject(ConfirmDialogService);
  readonly themeService = inject(ThemeService);

  // Registro local de iconos vectoriales de Hugeicons usados en el diálogo
  readonly icons = {
    delete: Delete02Icon,
    info: InformationCircleIcon,
    warning: Alert02Icon,
    lock: LockIcon,
    check: Tick02Icon
  };

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