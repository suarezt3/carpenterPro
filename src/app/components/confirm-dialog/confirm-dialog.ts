import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Alert02Icon,
  Delete02Icon,
  InformationCircleIcon,
  LockIcon,
  SlidersHorizontalIcon,
  Tick02Icon
} from '@hugeicons/core-free-icons';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ThemeService } from '../../services/theme.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

/**
 * Componente global de diálogo de confirmación asíncrona (Promise-based) de 2 o 3 acciones.
 * Utiliza iconos vectoriales SVG de @hugeicons/angular y soporta atajos de teclado (Enter / Escape).
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, TranslatePipe],
  host: {
    '(window:keydown)': 'handleKeyDown($event)'
  },
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css'
})
export class ConfirmDialog {
  readonly dialogService = inject(ConfirmDialogService);
  readonly themeService = inject(ThemeService);

  readonly icons = {
    delete: Delete02Icon,
    info: InformationCircleIcon,
    warning: Alert02Icon,
    lock: LockIcon,
    settings: SlidersHorizontalIcon,
    check: Tick02Icon
  };

  readonly isOpen = this.dialogService.isOpen;
  readonly options = this.dialogService.options;

  /**
   * Captura las teclas Escape y Enter únicamente cuando el diálogo está visible.
   */
  handleKeyDown(event: KeyboardEvent): void {
    if (!this.isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancel();
    } else if (event.key === 'Enter') {
      const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
      if (activeEl instanceof HTMLButtonElement && activeEl.dataset['dialogAction'] === 'secondary') {
        event.preventDefault();
        event.stopPropagation();
        this.chooseSecondary();
        return;
      }
      if (activeEl instanceof HTMLButtonElement && activeEl.dataset['dialogAction'] === 'cancel') {
        event.preventDefault();
        event.stopPropagation();
        this.cancel();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.confirm();
    }
  }

  confirm(): void {
    this.dialogService.confirm();
  }

  chooseSecondary(): void {
    this.dialogService.chooseSecondary();
  }

  cancel(): void {
    this.dialogService.cancel();
  }
}
