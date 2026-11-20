import { Injectable, signal } from '@angular/core';

export type ConfirmChoiceResult = 'confirm' | 'secondary' | 'cancel';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  secondaryText?: string;
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

  private boolResolver: ((value: boolean) => void) | null = null;
  private choiceResolver: ((value: ConfirmChoiceResult) => void) | null = null;

  private clearPendingResolversAsCancelled(): void {
    if (this.boolResolver) {
      const resolve = this.boolResolver;
      this.boolResolver = null;
      resolve(false);
    }
    if (this.choiceResolver) {
      const resolve = this.choiceResolver;
      this.choiceResolver = null;
      resolve('cancel');
    }
  }

  /**
   * Abre el diálogo de confirmación y devuelve una promesa booleana
   * (true si se confirma, false si se cancela).
   */
  ask(options: ConfirmDialogOptions): Promise<boolean> {
    this.clearPendingResolversAsCancelled();
    this.options.set({
      ...options,
      secondaryText: undefined,
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      severity: options.severity || 'warning'
    });
    this.isOpen.set(true);

    return new Promise<boolean>(resolve => {
      this.boolResolver = resolve;
    });
  }

  /**
   * Abre el diálogo de confirmación con hasta 3 acciones ('confirm' | 'secondary' | 'cancel').
   */
  askChoice(
    options: ConfirmDialogOptions & { secondaryText?: string }
  ): Promise<ConfirmChoiceResult> {
    this.clearPendingResolversAsCancelled();
    this.options.set({
      ...options,
      confirmText: options.confirmText || 'Confirmar',
      cancelText: options.cancelText || 'Cancelar',
      severity: options.severity || 'warning'
    });
    this.isOpen.set(true);

    return new Promise<ConfirmChoiceResult>(resolve => {
      this.choiceResolver = resolve;
    });
  }

  confirm(): void {
    this.isOpen.set(false);
    if (this.boolResolver) {
      const resolve = this.boolResolver;
      this.boolResolver = null;
      resolve(true);
    }
    if (this.choiceResolver) {
      const resolve = this.choiceResolver;
      this.choiceResolver = null;
      resolve('confirm');
    }
  }

  chooseSecondary(): void {
    this.isOpen.set(false);
    if (this.choiceResolver) {
      const resolve = this.choiceResolver;
      this.choiceResolver = null;
      resolve('secondary');
    }
    if (this.boolResolver) {
      const resolve = this.boolResolver;
      this.boolResolver = null;
      resolve(false);
    }
  }

  cancel(): void {
    this.isOpen.set(false);
    if (this.boolResolver) {
      const resolve = this.boolResolver;
      this.boolResolver = null;
      resolve(false);
    }
    if (this.choiceResolver) {
      const resolve = this.choiceResolver;
      this.choiceResolver = null;
      resolve('cancel');
    }
  }
}
