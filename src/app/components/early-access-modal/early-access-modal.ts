import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Mail01Icon,
  Rocket01Icon,
  Shield01Icon
} from '@hugeicons/core-free-icons';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { PaidPlan, PaymentService } from '../../services/payment.service';
import { BillingCycle, SupabaseService } from '../../services/supabase.service';
import { resolvePublicSupportEmail } from '../../utils/support-email';

export interface EarlyAccessModalViewState {
  plan: PaidPlan;
  cycle: BillingCycle;
  sourceRoute: string;
}

interface EarlyAccessPaymentBridge {
  earlyAccessModalState?: () => EarlyAccessModalViewState | null;
  closeEarlyAccessModal?: () => void;
}

const DEFAULT_EARLY_ACCESS_MAIL_SUBJECT = 'Solicitud Acceso Prioritario Piezo3D Studio';

/**
 * Modal global de Acceso Anticipado cuando la pasarela de pagos se encuentra en modo protegido.
 * Permite continuar gratis al Estudio 3D (o registro) y solicitar activación prioritaria por correo.
 */
@Component({
  selector: 'app-early-access-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, TranslatePipe],
  host: {
    '(window:keydown.escape)': 'onEscape()'
  },
  templateUrl: './early-access-modal.html',
  styleUrl: './early-access-modal.css'
})
export class EarlyAccessModalComponent {
  readonly paymentService = inject(PaymentService);
  readonly i18n = inject(I18nService);
  readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly paymentBridge = this.paymentService as unknown as EarlyAccessPaymentBridge;

  readonly icons = {
    shield: Shield01Icon,
    checkCircle: CheckmarkCircle02Icon,
    mail: Mail01Icon,
    rocket: Rocket01Icon,
    close: Cancel01Icon,
    arrowRight: ArrowRight01Icon
  };

  readonly benefitKeys: readonly string[] = [
    'earlyAccess.benefit1',
    'earlyAccess.benefit2',
    'earlyAccess.benefit3'
  ];

  readonly modalState = computed<EarlyAccessModalViewState | null>(() => {
    const stateFn = this.paymentBridge.earlyAccessModalState;
    return typeof stateFn === 'function' ? stateFn() : null;
  });

  readonly isOpen = computed<boolean>(() => this.modalState() !== null);

  readonly selectedPlanTitleKey = computed<string>(() => {
    return this.modalState()?.plan === 'industrial'
      ? 'landing.pricing.planIndTitle'
      : 'landing.pricing.planProTitle';
  });

  readonly selectedCycleKey = computed<string>(() => {
    return this.modalState()?.cycle === 'annual'
      ? 'earlyAccess.cycleAnnual'
      : 'earlyAccess.cycleMonthly';
  });

  readonly supportEmail = computed<string>(() => {
    const settingsFn = (
      this.supabaseService as unknown as {
        platformSettings?: () => { support_email?: string } | null;
      }
    ).platformSettings;
    const rawEmail = typeof settingsFn === 'function' ? settingsFn()?.support_email : undefined;
    return resolvePublicSupportEmail(rawEmail);
  });

  readonly mailSubject = computed<string>(() => {
    const translated = this.i18n.t('earlyAccess.mailSubject');
    if (!translated || translated === 'earlyAccess.mailSubject') {
      return DEFAULT_EARLY_ACCESS_MAIL_SUBJECT;
    }
    return translated;
  });

  readonly mailtoHref = computed<string>(() => {
    const email = this.supportEmail();
    const subject = encodeURIComponent(this.mailSubject());
    return `mailto:${email}?subject=${subject}`;
  });

  /**
   * Cierra el modal e ingresa al Estudio 3D si ya está dentro del flujo o según autenticación.
   */
  enterStudio(): void {
    const currentUrl = this.router.url || '';
    this.closeModal();

    if (currentUrl.startsWith('/studio')) {
      return;
    }

    if (this.supabaseService.isAuthenticated?.()) {
      void this.router.navigateByUrl('/studio/designer');
      return;
    }

    void this.router.navigate(['/auth'], {
      queryParams: { mode: 'register' }
    });
  }

  closeModal(): void {
    this.paymentBridge.closeEarlyAccessModal?.();
  }

  onEscape(): void {
    if (this.isOpen()) {
      this.closeModal();
    }
  }
}
