import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UpgradePlanModalComponent } from './upgrade-plan-modal';
import {
  CheckoutCycleInput,
  PaidPlan,
  PaymentService,
  UpgradeModalState
} from '../../services/payment.service';
import { I18nService } from '../../services/i18n.service';

interface ProtectedEarlyAccessState {
  plan: PaidPlan;
  cycle: 'monthly' | 'annual';
  sourceRoute: string;
}

describe('UpgradePlanModalComponent', () => {
  let fixture: ComponentFixture<UpgradePlanModalComponent>;
  let component: UpgradePlanModalComponent;
  let upgradeStateSignal: WritableSignal<UpgradeModalState | null>;
  let earlyAccessStateSignal: WritableSignal<ProtectedEarlyAccessState | null>;
  let isProtectedSignal: WritableSignal<boolean>;
  let mockPaymentService: {
    upgradeModalState: ReturnType<WritableSignal<UpgradeModalState | null>['asReadonly']>;
    earlyAccessModalState: ReturnType<WritableSignal<ProtectedEarlyAccessState | null>['asReadonly']>;
    isPaymentsProtected: ReturnType<WritableSignal<boolean>['asReadonly']>;
    openCheckout: ReturnType<typeof vi.fn>;
    closeUpgradeModal: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    upgradeStateSignal = signal<UpgradeModalState | null>(null);
    earlyAccessStateSignal = signal<ProtectedEarlyAccessState | null>(null);
    isProtectedSignal = signal(true);

    mockPaymentService = {
      upgradeModalState: upgradeStateSignal.asReadonly(),
      earlyAccessModalState: earlyAccessStateSignal.asReadonly(),
      isPaymentsProtected: isProtectedSignal.asReadonly(),
      openCheckout: vi.fn(async (plan: PaidPlan, cycle: CheckoutCycleInput = 'monthly') => {
        const normalizedCycle: 'monthly' | 'annual' = cycle === 'yearly' ? 'annual' : cycle;
        if (isProtectedSignal()) {
          upgradeStateSignal.set(null);
          earlyAccessStateSignal.set({
            plan,
            cycle: normalizedCycle,
            sourceRoute: '/studio/designer'
          });
        }
      }),
      closeUpgradeModal: vi.fn(() => {
        upgradeStateSignal.set(null);
      })
    };

    await TestBed.configureTestingModule({
      imports: [UpgradePlanModalComponent],
      providers: [{ provide: PaymentService, useValue: mockPaymentService }]
    }).compileComponents();

    TestBed.inject(I18nService).setLanguage('es');
    fixture = TestBed.createComponent(UpgradePlanModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe permanecer oculto cuando upgradeModalState es null', () => {
    expect(component.isOpen()).toBe(false);
    const modal = fixture.nativeElement.querySelector('[data-testid="upgrade-plan-modal"]');
    expect(modal).toBeNull();
  });

  it('debe abrirse para modules_limit mostrando ambos planes (Pro e Industrial)', () => {
    upgradeStateSignal.set({
      reason: 'modules_limit',
      requiredPlan: 'pro',
      featureName: 'Módulos 3D'
    });
    fixture.detectChanges();

    expect(component.isOpen()).toBe(true);
    expect(component.titleKey()).toBe('upgrade.modulesLimitTitle');
    expect(component.subtitleKey()).toBe('upgrade.modulesLimitDesc');
    expect(component.badgeKey()).toBe('upgrade.badgePro');

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="upgrade-plan-modal"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="upgrade-modal-cta-pro"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="upgrade-modal-cta-industrial"]')).toBeTruthy();
  });

  it('debe resolver claves de workshop_export correctamente', () => {
    upgradeStateSignal.set({
      reason: 'workshop_export',
      requiredPlan: 'pro'
    });
    fixture.detectChanges();

    expect(component.titleKey()).toBe('upgrade.workshopExportTitle');
    expect(component.subtitleKey()).toBe('upgrade.workshopExportDesc');
    expect(component.badgeKey()).toBe('upgrade.badgePro');
  });

  it('debe ocultar la tarjeta Pro cuando requiredPlan es industrial (cnc_export)', () => {
    upgradeStateSignal.set({
      reason: 'cnc_export',
      requiredPlan: 'industrial'
    });
    fixture.detectChanges();

    expect(component.titleKey()).toBe('upgrade.cncExportTitle');
    expect(component.subtitleKey()).toBe('upgrade.cncExportDesc');
    expect(component.badgeKey()).toBe('upgrade.badgeIndustrial');

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="upgrade-modal-cta-pro"]')).toBeNull();
    expect(root.querySelector('[data-testid="upgrade-modal-cta-industrial"]')).toBeTruthy();
  });

  it('debe alternar tarifas entre ciclo Mensual ($15/$29) y Anual ($12/$23)', () => {
    upgradeStateSignal.set({
      reason: 'modules_limit',
      requiredPlan: 'pro'
    });
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('$15 USD');
    expect(root.textContent).toContain('$29 USD');

    const annualBtn = root.querySelector('[data-testid="upgrade-cycle-annual-btn"]') as HTMLButtonElement | null;
    annualBtn?.click();
    fixture.detectChanges();

    expect(component.billingCycle()).toBe('annual');
    expect(root.textContent).toContain('$12 USD');
    expect(root.textContent).toContain('$23 USD');

    const monthlyBtn = root.querySelector('[data-testid="upgrade-cycle-monthly-btn"]') as HTMLButtonElement | null;
    monthlyBtn?.click();
    fixture.detectChanges();

    expect(component.billingCycle()).toBe('monthly');
    expect(root.textContent).toContain('$15 USD');
  });

  it('al elegir Plan Taller Pro en modo protegido debe delegar en openCheckout, cerrar UpgradeModal y abrir Acceso Anticipado', () => {
    upgradeStateSignal.set({
      reason: 'workshop_export',
      requiredPlan: 'pro'
    });
    fixture.detectChanges();

    const proCta = fixture.nativeElement.querySelector(
      '[data-testid="upgrade-modal-cta-pro"]'
    ) as HTMLButtonElement | null;
    proCta?.click();
    fixture.detectChanges();

    expect(mockPaymentService.openCheckout).toHaveBeenCalledWith('pro', 'monthly');
    expect(upgradeStateSignal()).toBeNull();
    expect(earlyAccessStateSignal()).toEqual({
      plan: 'pro',
      cycle: 'monthly',
      sourceRoute: '/studio/designer'
    });
  });

  it('al elegir Plan Industrial en ciclo anual debe delegar openCheckout("industrial", "annual")', () => {
    upgradeStateSignal.set({
      reason: 'cnc_export',
      requiredPlan: 'industrial'
    });
    fixture.detectChanges();

    const annualBtn = fixture.nativeElement.querySelector(
      '[data-testid="upgrade-cycle-annual-btn"]'
    ) as HTMLButtonElement | null;
    annualBtn?.click();
    fixture.detectChanges();

    const indCta = fixture.nativeElement.querySelector(
      '[data-testid="upgrade-modal-cta-industrial"]'
    ) as HTMLButtonElement | null;
    indCta?.click();
    fixture.detectChanges();

    expect(mockPaymentService.openCheckout).toHaveBeenCalledWith('industrial', 'annual');
    expect(upgradeStateSignal()).toBeNull();
    expect(earlyAccessStateSignal()).toEqual({
      plan: 'industrial',
      cycle: 'annual',
      sourceRoute: '/studio/designer'
    });
  });

  it('debe cerrarse con el botón X y la tecla Escape solo cuando está abierto', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(mockPaymentService.closeUpgradeModal).not.toHaveBeenCalled();

    upgradeStateSignal.set({
      reason: 'modules_limit',
      requiredPlan: 'pro'
    });
    fixture.detectChanges();

    const closeBtn = fixture.nativeElement.querySelector(
      '[data-testid="upgrade-modal-close-btn"]'
    ) as HTMLButtonElement | null;
    closeBtn?.click();
    fixture.detectChanges();
    expect(mockPaymentService.closeUpgradeModal).toHaveBeenCalledTimes(1);
    expect(upgradeStateSignal()).toBeNull();

    upgradeStateSignal.set({
      reason: 'cnc_export',
      requiredPlan: 'industrial'
    });
    fixture.detectChanges();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(mockPaymentService.closeUpgradeModal).toHaveBeenCalledTimes(2);
    expect(upgradeStateSignal()).toBeNull();
  });
});
