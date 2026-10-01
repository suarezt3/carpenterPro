import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'danger' | 'warning' | 'info';
  icon?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmDialogService {
  readonly isOpen = signal(false);
  readonly options = signal<ConfirmDialogOptions | null>(null);

  private resolver: ((value: boolean) => void) | null = null;

  /**
   * Opens the styled confirmation dialog and returns a Promise
   * that resolves to true if confirmed or false if cancelled.
   */
  ask(options: ConfirmDialogOptions): Promise<boolean> {
    this.options.set({
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      severity: options.severity || 'warning',
      ...options
    });
    this.isOpen.set(true);

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  confirm() {
    this.isOpen.set(false);
    if (this.resolver) {
      this.resolver(true);
      this.resolver = null;
    }
  }

  cancel() {
    this.isOpen.set(false);
    if (this.resolver) {
      this.resolver(false);
      this.resolver = null;
    }
  }
}
