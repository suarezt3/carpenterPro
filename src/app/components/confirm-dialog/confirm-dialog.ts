import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:keydown)': 'handleKeyDown($event)'
  },
  templateUrl: './confirm-dialog.html'
})
export class ConfirmDialog {
  readonly dialogService = inject(ConfirmDialogService);
  readonly themeService = inject(ThemeService);
  readonly isOpen = this.dialogService.isOpen;
  readonly options = this.dialogService.options;

  handleKeyDown(event: KeyboardEvent) {
    if (!this.isOpen()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
    } else if (event.key === 'Enter') {
      event.preventDefault();
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
