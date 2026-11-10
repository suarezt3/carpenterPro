import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  ArrowRight01Icon,
  Cancel01Icon,
  Layers01Icon,
  LockPasswordIcon,
  Rocket01Icon,
  SparklesIcon,
  Tick02Icon
} from '@hugeicons/core-free-icons';
import { PaidPlan, PaymentService } from '../../services/payment.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-upgrade-plan-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, TranslatePipe],
  host: {
    '(window:keydown.escape)': 'onEscape()'
  },
  templateUrl: './upgrade-plan-modal.html',
  styleUrl: './upgrade-plan-modal.css'
})
export class UpgradePlanModalComponent {
  readonly paymentService = inject(PaymentService);

  readonly billingCycle = signal<'monthly' | 'annual'>('monthly');

  readonly icons = {
    close: Cancel01Icon,
    rocket: Rocket01Icon,
    lock: LockPasswordIcon,
    check: Tick02Icon,
    sparkles: SparklesIcon,
    layers: Layers01Icon,
    arrowRight: ArrowRight01Icon
  };

  readonly modalState = this.paymentService.upgradeModalState;
  readonly isOpen = computed(() => this.modalState() !== null);

  readonly titleKey = computed<string>(() => {
    const reason = this.modalState()?.reason;
    if (reason === 'cnc_export') return 'upgrade.cncExportTitle';
    if (reason === 'workshop_export') return 'upgrade.workshopExportTitle';
    return 'upgrade.modulesLimitTitle';
  });

  readonly subtitleKey = computed<string>(() => {
    const reason = this.modalState()?.reason;
    if (reason === 'cnc_export') return 'upgrade.cncExportDesc';
    if (reason === 'workshop_export') return 'upgrade.workshopExportDesc';
    return 'upgrade.modulesLimitDesc';
  });

  readonly badgeKey = computed<string>(() => {
    const req = this.modalState()?.requiredPlan;
    return req === 'industrial' ? 'upgrade.badgeIndustrial' : 'upgrade.badgePro';
  });

  setBillingCycle(cycle: 'monthly' | 'annual'): void {
    this.billingCycle.set(cycle);
  }

  selectPlan(plan: PaidPlan): void {
    void this.paymentService.openCheckout(plan, this.billingCycle());
  }

  closeModal(): void {
    this.paymentService.closeUpgradeModal();
  }

  onEscape(): void {
    if (this.isOpen()) {
      this.closeModal();
    }
  }
}
