import { ChangeDetectionStrategy, Component, signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import {
  ArrowRight01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Mail01Icon,
  Rocket01Icon,
  Shield01Icon
} from '@hugeicons/core-free-icons';
import { TRANSLATIONS } from '../../data/i18n-translations.data';
import { I18nService } from '../../services/i18n.service';
import { CheckoutCycleInput, PaidPlan, PaymentService } from '../../services/payment.service';
import { BillingCycle, SupabaseService } from '../../services/supabase.service';
import { EarlyAccessModalComponent, EarlyAccessModalViewState } from './early-access-modal';

@Component({
  selector: 'app-early-access-test-route-stub',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ''
})
class EarlyAccessTestRouteStubComponent {}

const TEST_ROUTES: Routes = [
  { path: '', pathMatch: 'full', component: EarlyAccessTestRouteStubComponent },
  { path: 'auth', component: EarlyAccessTestRouteStubComponent },
  {
    path: 'studio',
    children: [
      { path: 'designer', component: EarlyAccessTestRouteStubComponent },
      { path: 'parts', component: EarlyAccessTestRouteStubComponent }
    ]
  }
];

describe('EarlyAccessModalComponent (Modal Global de Acceso Anticipado)', () => {
  let fixture: ComponentFixture<EarlyAccessModalComponent>;
  let component: EarlyAccessModalComponent;
  let router: Router;
  let i18n: I18nService;

  let earlyAccessStateSig: WritableSignal<EarlyAccessModalViewState | null>;
  let isPaymentsProtectedSig: WritableSignal<boolean>;
  let isAuthSig: WritableSignal<boolean>;
  let platformSettingsSig: WritableSignal<{ support_email?: string } | null>;

  let paymentServiceMock: {
    earlyAccessModalState: WritableSignal<EarlyAccessModalViewState | null>;
    isPaymentsProtected: WritableSignal<boolean>;
    openEarlyAccessModal: ReturnType<typeof vi.fn>;
    closeEarlyAccessModal: ReturnType<typeof vi.fn>;
    savePendingCheckout: ReturnType<typeof vi.fn>;
  };

  let supabaseServiceMock: {
    isAuthenticated: WritableSignal<boolean>;
    platformSettings: WritableSignal<{ support_email?: string } | null>;
  };

  const resolveExpectedText = (key: string): string => {
    const lang = i18n.currentLang();
    return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS.es[key] ?? key;
  };

  beforeEach(async () => {
    earlyAccessStateSig = signal<EarlyAccessModalViewState | null>(null);
    isPaymentsProtectedSig = signal<boolean>(true);
    isAuthSig = signal<boolean>(false);
    platformSettingsSig = signal<{ support_email?: string } | null>({
      support_email: 'piezo3dstudio@gmail.com'
    });

    paymentServiceMock = {
      earlyAccessModalState: earlyAccessStateSig,
      isPaymentsProtected: isPaymentsProtectedSig,
      openEarlyAccessModal: vi.fn((plan: PaidPlan, cycle: CheckoutCycleInput = 'monthly', sourceRoute = '/') => {
        const normalizedCycle: BillingCycle = cycle === 'annual' || cycle === 'yearly' ? 'annual' : 'monthly';
        earlyAccessStateSig.set({ plan, cycle: normalizedCycle, sourceRoute });
      }),
      closeEarlyAccessModal: vi.fn(() => {
        earlyAccessStateSig.set(null);
      }),
      savePendingCheckout: vi.fn()
    };

    supabaseServiceMock = {
      isAuthenticated: isAuthSig,
      platformSettings: platformSettingsSig
    };

    await TestBed.configureTestingModule({
      imports: [EarlyAccessModalComponent],
      providers: [
        provideRouter(TEST_ROUTES),
        { provide: PaymentService, useValue: paymentServiceMock },
        { provide: SupabaseService, useValue: supabaseServiceMock },
        I18nService
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    i18n = TestBed.inject(I18nService);
    i18n.setLanguage('es');

    fixture = TestBed.createComponent(EarlyAccessModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe permanecer cerrado cuando earlyAccessModalState() es null', () => {
    expect(component.isOpen()).toBe(false);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="early-access-modal"]')).toBeNull();
  });

  it('debe abrir con Plan Taller Pro, mostrar insignia, título, 3 beneficios, Hugeicons y diseño Minimalist Studio', () => {
    earlyAccessStateSig.set({
      plan: 'pro',
      cycle: 'monthly',
      sourceRoute: '/'
    });
    fixture.detectChanges();

    expect(component.isOpen()).toBe(true);
    expect(component.icons.shield).toBe(Shield01Icon);
    expect(component.icons.checkCircle).toBe(CheckmarkCircle02Icon);
    expect(component.icons.mail).toBe(Mail01Icon);
    expect(component.icons.rocket).toBe(Rocket01Icon);
    expect(component.icons.close).toBe(Cancel01Icon);
    expect(component.icons.arrowRight).toBe(ArrowRight01Icon);

    const el = fixture.nativeElement as HTMLElement;
    const modal = el.querySelector('[data-testid="early-access-modal"]') as HTMLElement;
    expect(modal).toBeTruthy();
    expect(modal.className).toContain('z-80');
    expect(modal.className).toContain('font-sans');
    expect(el.querySelectorAll('.font-mono').length).toBe(0);

    const badge = el.querySelector('[data-testid="early-access-badge"]') as HTMLElement;
    expect(badge.className).toContain('bg-sky-50');
    expect(badge.className).toContain('border-sky-200');
    expect(badge.className).toContain('text-sky-600');
    expect(badge.textContent).toContain(resolveExpectedText('earlyAccess.badge'));

    const title = el.querySelector('[data-testid="early-access-title"]') as HTMLElement;
    expect(title.textContent?.trim()).toBe(resolveExpectedText('earlyAccess.title'));

    const pill = el.querySelector('[data-testid="early-access-selected-plan-pill"]') as HTMLElement;
    expect(pill.textContent).toContain('Plan Taller Pro');
    expect(pill.textContent).toContain(resolveExpectedText('earlyAccess.cycleMonthly'));

    const description = el.querySelector('[data-testid="early-access-description"]') as HTMLElement;
    expect(description.textContent?.trim()).toBe(resolveExpectedText('earlyAccess.description'));

    const benefits = el.querySelectorAll('[data-testid="early-access-benefits-list"] li');
    expect(benefits.length).toBe(3);
    expect(benefits.item(0).textContent).toContain(resolveExpectedText('earlyAccess.benefit1'));
    expect(benefits.item(1).textContent).toContain(resolveExpectedText('earlyAccess.benefit2'));
    expect(benefits.item(2).textContent).toContain(resolveExpectedText('earlyAccess.benefit3'));

    // Todos los iconos deben renderizarse dentro de hugeicons-icon, cero <svg> inline sueltos
    const allSvgs = Array.from(modal.querySelectorAll('svg'));
    for (const svg of allSvgs) {
      expect(svg.closest('hugeicons-icon')).toBeTruthy();
    }
    expect(modal.querySelectorAll('hugeicons-icon').length).toBe(8);
  });

  it('debe mostrar Plan Industrial & CNC y ciclo Anual cuando se abre con plan industrial anual', () => {
    earlyAccessStateSig.set({
      plan: 'industrial',
      cycle: 'annual',
      sourceRoute: '/studio/designer'
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const pill = el.querySelector('[data-testid="early-access-selected-plan-pill"]') as HTMLElement;
    expect(pill.textContent).toContain('Plan Industrial & CNC');
    expect(pill.textContent).toContain(resolveExpectedText('earlyAccess.cycleAnnual'));
  });

  it('debe construir enlace mailto:piezo3dstudio@gmail.com?subject=... y normalizar cualquier correo legado', () => {
    const tSpy = vi.spyOn(i18n, 't');
    platformSettingsSig.set({ support_email: 'eydersuarez900@gmail.com' });
    earlyAccessStateSig.set({
      plan: 'pro',
      cycle: 'monthly',
      sourceRoute: '/'
    });
    fixture.detectChanges();

    const expectedSubject =
      TRANSLATIONS.es['earlyAccess.mailSubject'] ?? 'Solicitud Acceso Prioritario Piezo3D Studio';
    const expectedHref = `mailto:piezo3dstudio@gmail.com?subject=${encodeURIComponent(expectedSubject)}`;

    expect(component.supportEmail()).toBe('piezo3dstudio@gmail.com');
    expect(component.mailSubject()).toBe(expectedSubject);
    expect(component.mailtoHref()).toBe(expectedHref);

    const el = fixture.nativeElement as HTMLElement;
    const mailLink = el.querySelector('[data-testid="early-access-priority-mailto"]') as HTMLAnchorElement;
    expect(mailLink).toBeTruthy();
    expect(mailLink.getAttribute('href')).toBe(expectedHref);
    expect(mailLink.getAttribute('href')).toContain('mailto:piezo3dstudio@gmail.com?subject=');
    expect(el.textContent).not.toContain('eydersuarez900@gmail.com');
    expect(tSpy).toHaveBeenCalledWith('earlyAccess.secondaryCta', {
      email: 'piezo3dstudio@gmail.com'
    });

    const secondaryTemplate = TRANSLATIONS.es['earlyAccess.secondaryCta'];
    if (secondaryTemplate) {
      expect(mailLink.textContent).toContain('piezo3dstudio@gmail.com');
    }
  });

  it('al pulsar el botón principal desde "/" con usuario autenticado debe cerrar el modal y navegar a /studio/designer', async () => {
    await router.navigateByUrl('/');
    isAuthSig.set(true);
    earlyAccessStateSig.set({
      plan: 'pro',
      cycle: 'monthly',
      sourceRoute: '/'
    });
    fixture.detectChanges();

    const navByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const el = fixture.nativeElement as HTMLElement;
    const enterBtn = el.querySelector('[data-testid="early-access-enter-studio-btn"]') as HTMLButtonElement;
    enterBtn.click();
    fixture.detectChanges();

    expect(paymentServiceMock.closeEarlyAccessModal).toHaveBeenCalledTimes(1);
    expect(component.isOpen()).toBe(false);
    expect(navByUrlSpy).toHaveBeenCalledWith('/studio/designer');
    expect(navSpy).not.toHaveBeenCalled();
    expect(paymentServiceMock.savePendingCheckout).not.toHaveBeenCalled();
  });

  it('al pulsar el botón principal desde "/" sin iniciar sesión debe cerrar el modal y navegar a /auth?mode=register', async () => {
    await router.navigateByUrl('/');
    isAuthSig.set(false);
    earlyAccessStateSig.set({
      plan: 'industrial',
      cycle: 'annual',
      sourceRoute: '/'
    });
    fixture.detectChanges();

    const navByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const el = fixture.nativeElement as HTMLElement;
    const enterBtn = el.querySelector('[data-testid="early-access-enter-studio-btn"]') as HTMLButtonElement;
    enterBtn.click();
    fixture.detectChanges();

    expect(paymentServiceMock.closeEarlyAccessModal).toHaveBeenCalledTimes(1);
    expect(component.isOpen()).toBe(false);
    expect(navSpy).toHaveBeenCalledWith(['/auth'], {
      queryParams: { mode: 'register' }
    });
    expect(navByUrlSpy).not.toHaveBeenCalled();
    expect(paymentServiceMock.savePendingCheckout).not.toHaveBeenCalled();
  });

  it('al pulsar el botón principal dentro de /studio/designer solo debe cerrar el modal in-place sin navegar', async () => {
    await router.navigateByUrl('/studio/designer');
    isAuthSig.set(true);
    earlyAccessStateSig.set({
      plan: 'pro',
      cycle: 'monthly',
      sourceRoute: '/studio/designer'
    });
    fixture.detectChanges();

    const navByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const el = fixture.nativeElement as HTMLElement;
    const enterBtn = el.querySelector('[data-testid="early-access-enter-studio-btn"]') as HTMLButtonElement;
    enterBtn.click();
    fixture.detectChanges();

    expect(paymentServiceMock.closeEarlyAccessModal).toHaveBeenCalledTimes(1);
    expect(component.isOpen()).toBe(false);
    expect(navByUrlSpy).not.toHaveBeenCalled();
    expect(navSpy).not.toHaveBeenCalled();
  });

  it('debe cerrar el modal con la tecla Escape y al hacer clic en los botones de cierre', () => {
    // 1. Escape no hace nada cuando está cerrado
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(paymentServiceMock.closeEarlyAccessModal).not.toHaveBeenCalled();

    // 2. Escape cierra cuando está abierto
    earlyAccessStateSig.set({ plan: 'pro', cycle: 'monthly', sourceRoute: '/' });
    fixture.detectChanges();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(paymentServiceMock.closeEarlyAccessModal).toHaveBeenCalledTimes(1);
    expect(component.isOpen()).toBe(false);

    // 3. Click en botón superior X
    earlyAccessStateSig.set({ plan: 'pro', cycle: 'monthly', sourceRoute: '/' });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('[data-testid="early-access-close-x-btn"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(paymentServiceMock.closeEarlyAccessModal).toHaveBeenCalledTimes(2);
    expect(component.isOpen()).toBe(false);

    // 4. Click en botón inferior Cerrar
    earlyAccessStateSig.set({ plan: 'industrial', cycle: 'annual', sourceRoute: '/' });
    fixture.detectChanges();
    (el.querySelector('[data-testid="early-access-close-btn"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(paymentServiceMock.closeEarlyAccessModal).toHaveBeenCalledTimes(3);
    expect(component.isOpen()).toBe(false);

    // 5. Click en el fondo (backdrop)
    earlyAccessStateSig.set({ plan: 'pro', cycle: 'monthly', sourceRoute: '/' });
    fixture.detectChanges();
    (el.querySelector('[data-testid="early-access-backdrop"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(paymentServiceMock.closeEarlyAccessModal).toHaveBeenCalledTimes(4);
    expect(component.isOpen()).toBe(false);
  });
});
