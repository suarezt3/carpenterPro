import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import {
  AdminDashboardComponent,
  AdminPlatformSettingsRecord
} from './admin-dashboard';
import {
  PlatformFeedbackRecord,
  PlatformSettingsRecord,
  SubscriptionInvoice,
  SupabaseService,
  UserProfile
} from '../../services/supabase.service';
import {
  PAYMENTS_READINESS_MODE_STORAGE_KEY,
  PaymentService
} from '../../services/payment.service';
import { isSuperAdminOwnerEmail } from '../../utils/support-email';

describe('AdminDashboardComponent', () => {
  let component: AdminDashboardComponent;
  let fixture: ComponentFixture<AdminDashboardComponent>;
  let supabaseMock: Partial<SupabaseService>;

  const mockSettings: AdminPlatformSettingsRecord = {
    id: 1,
    app_version: 'v3.0.0',
    support_email: 'piezo3dstudio@gmail.com',
    pro_monthly_usd: 15,
    pro_annual_monthly_usd: 12,
    pro_annual_total_usd: 144,
    industrial_monthly_usd: 29,
    industrial_annual_monthly_usd: 23,
    industrial_annual_total_usd: 276,
    usd_to_cop_rate: 4250,
    announcement_enabled: false,
    announcement_text: '',
    announcement_badge: 'NOVEDAD',
    free_max_modules: 3,
    updated_at: '2026-11-11T00:00:00Z'
  };

  const mockProfiles: UserProfile[] = [
    {
      id: 'u-admin',
      email: 'eydersuarez900@gmail.com',
      first_name: 'Eyder',
      last_name: 'Suarez',
      role: 'super_admin',
      plan: 'industrial',
      billing_cycle: 'monthly',
      subscription_status: 'active',
      is_suspended: false,
      created_at: '2026-11-01T10:00:00Z',
      updated_at: '2026-11-01T10:00:00Z'
    },
    {
      id: 'u-pro-annual',
      email: 'carlos@taller.com',
      first_name: 'Carlos',
      last_name: 'Mendoza',
      role: 'user',
      plan: 'pro',
      billing_cycle: 'annual',
      subscription_status: 'active',
      is_suspended: false,
      created_at: '2026-11-05T10:00:00Z',
      updated_at: '2026-11-05T10:00:00Z'
    },
    {
      id: 'u-free',
      email: 'ana@carpinteria.com',
      first_name: 'Ana',
      last_name: 'Gomez',
      role: 'user',
      plan: 'free',
      billing_cycle: 'monthly',
      subscription_status: 'free',
      is_suspended: false,
      created_at: '2026-11-08T10:00:00Z',
      updated_at: '2026-11-08T10:00:00Z'
    }
  ];

  const mockInvoices: SubscriptionInvoice[] = [
    {
      id: 'inv-1',
      user_id: 'u-pro-annual',
      plan: 'pro',
      billing_cycle: 'annual',
      amount_usd: 144,
      status: 'paid',
      invoice_url: 'https://example.com/invoice/1',
      created_at: '2026-11-05T10:00:00Z'
    }
  ];

  const mockFeedback: PlatformFeedbackRecord[] = [
    {
      id: 'fb-test-1',
      user_id: 'u-pro-annual',
      user_name: 'Carlos Mendoza',
      user_email: 'carlos@taller.com',
      user_role_title: 'Taller Mendoza',
      category: 'testimonial',
      subject: null,
      message: 'Excelente optimizador de corte para melamina.',
      rating: 5,
      status: 'pending',
      is_featured: false,
      admin_notes: null,
      created_at: '2026-11-09T12:00:00Z'
    },
    {
      id: 'fb-bug-1',
      user_id: 'u-free',
      user_name: 'Ana Gomez',
      user_email: 'ana@carpinteria.com',
      user_role_title: 'Carpintería Ana',
      category: 'bug',
      subject: 'Duda en exportación de etiquetas',
      message: 'El margen de impresión necesita ajuste en impresora térmica.',
      rating: null,
      status: 'pending',
      is_featured: false,
      admin_notes: '',
      created_at: '2026-11-10T15:00:00Z'
    }
  ];

  beforeEach(async () => {
    localStorage.removeItem(PAYMENTS_READINESS_MODE_STORAGE_KEY);
    const settingsSignal = signal<PlatformSettingsRecord>({ ...mockSettings });
    const profileSignal = signal<UserProfile | null>(mockProfiles[0]);

    supabaseMock = {
      platformSettings: settingsSignal,
      userProfile: profileSignal,
      loadPlatformSettings: vi.fn().mockResolvedValue({ ...mockSettings }),
      updatePlatformSettings: vi.fn().mockImplementation(async (patch: Partial<PlatformSettingsRecord>) => {
        const updated = { ...settingsSignal(), ...patch };
        settingsSignal.set(updated);
        return { success: true, data: updated };
      }),
      adminGetAllProfiles: vi.fn().mockResolvedValue(mockProfiles.map(p => ({ ...p }))),
      adminUpdateUserProfile: vi.fn().mockResolvedValue({ success: true }),
      adminGetAllInvoices: vi.fn().mockResolvedValue(mockInvoices.map(i => ({ ...i }))),
      adminGetAllFeedback: vi.fn().mockResolvedValue(mockFeedback.map(f => ({ ...f }))),
      adminUpdateFeedback: vi.fn().mockResolvedValue({ success: true }),
      adminCreateTestimonial: vi.fn().mockImplementation(async payload => ({
        success: true,
        data: {
          id: 'fb-new-test',
          user_id: null,
          user_name: payload.user_name,
          user_email: null,
          user_role_title: payload.user_role_title,
          category: 'testimonial',
          subject: null,
          message: payload.message,
          rating: payload.rating,
          status: 'approved',
          is_featured: payload.is_featured,
          admin_notes: null,
          created_at: '2026-11-11T10:00:00Z'
        } as PlatformFeedbackRecord
      })),
      adminDeleteFeedback: vi.fn().mockResolvedValue({ success: true })
    };

    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: supabaseMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem(PAYMENTS_READINESS_MODE_STORAGE_KEY);
    vi.restoreAllMocks();
  });

  it('should create the component and calculate executive KPIs including MRR in USD', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect(component.totalUsersCount()).toBe(3);
    expect(component.freeUsersCount()).toBe(1);
    expect(component.proUsersCount()).toBe(1);
    expect(component.industrialUsersCount()).toBe(1);
    expect(component.activePaidSubscriptionsCount()).toBe(2);

    // MRR = 1 industrial monthly ($29) + 1 pro annual monthly equivalent ($12) = $41 USD
    expect(component.estimatedMrrUsd()).toBe(41);
    expect(component.pendingSupportCount()).toBe(1);
    expect(component.pendingTestimonialsCount()).toBe(1);
    expect(component.pendingAttentionCount()).toBe(2);

    fixture.detectChanges();
    const mrrEl = fixture.nativeElement.querySelector('[data-testid="kpi-mrr-usd"]');
    expect(mrrEl?.textContent).toContain('$41 USD');
  });

  it('should filter users by search query and category in CRM module and update user plan/role/suspension', async () => {
    component.setSection('users');
    fixture.detectChanges();

    expect(component.filteredUsers().length).toBe(3);

    component.onSearchQueryInput('carlos');
    expect(component.filteredUsers().length).toBe(1);
    expect(component.filteredUsers()[0].email).toBe('carlos@taller.com');

    component.onSearchQueryInput('');
    component.setUserFilter('free');
    expect(component.filteredUsers().length).toBe(1);
    expect(component.filteredUsers()[0].id).toBe('u-free');

    // Manual plan upgrade for free user
    const targetUser = component.filteredUsers()[0];
    await component.onUserPlanChange(targetUser, 'industrial');
    expect(supabaseMock.adminUpdateUserProfile).toHaveBeenCalledWith('u-free', {
      plan: 'industrial',
      subscription_status: 'active'
    });

    // Role toggle
    await component.toggleUserRole(targetUser);
    expect(supabaseMock.adminUpdateUserProfile).toHaveBeenCalledWith('u-free', {
      role: 'super_admin'
    });

    // Account suspension toggle
    await component.toggleUserSuspension(targetUser);
    expect(supabaseMock.adminUpdateUserProfile).toHaveBeenCalledWith('u-free', {
      is_suspended: true
    });
  });

  it('should load and save global CMS settings via updatePlatformSettings including usd_to_cop_rate', async () => {
    component.setSection('cms');
    fixture.detectChanges();

    const copRateInput = fixture.nativeElement.querySelector(
      '[data-testid="cms-usd-to-cop-rate-input"]'
    ) as HTMLInputElement | null;
    expect(copRateInput).toBeTruthy();
    expect(component.cmsForm.controls.usd_to_cop_rate.value).toBe(4250);

    component.cmsForm.patchValue({
      pro_monthly_usd: 19,
      industrial_monthly_usd: 35,
      usd_to_cop_rate: 4300,
      app_version: 'v3.1.0',
      announcement_enabled: true,
      announcement_badge: 'PROMO',
      announcement_text: 'Descuento especial en planes anuales'
    });
    fixture.detectChanges();

    await component.saveCmsSettings();

    expect(supabaseMock.updatePlatformSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        pro_monthly_usd: 19,
        industrial_monthly_usd: 35,
        usd_to_cop_rate: 4300,
        app_version: 'v3.1.0',
        announcement_enabled: true,
        announcement_badge: 'PROMO',
        announcement_text: 'Descuento especial en planes anuales'
      })
    );
    expect(component.toastBanner()?.type).toBe('success');
  });

  it('should approve existing testimonials and create new featured testimonials', async () => {
    component.setSection('testimonials');
    fixture.detectChanges();

    const pendingTestimonial = component.testimonialsList()[0];
    await component.approveTestimonial(pendingTestimonial);

    expect(supabaseMock.adminUpdateFeedback).toHaveBeenCalledWith('fb-test-1', {
      status: 'approved',
      is_featured: true
    });
    expect(component.testimonialsList()[0].status).toBe('approved');

    // Open new testimonial form and submit
    component.toggleNewTestimonialModal();
    component.newTestimonialForm.setValue({
      user_name: 'Roberto Silva',
      user_role_title: 'Muebles Silva',
      rating: 5,
      message: 'Ahorramos 3 horas por proyecto con el despiece automático.',
      is_featured: true
    });

    await component.createTestimonial();
    expect(supabaseMock.adminCreateTestimonial).toHaveBeenCalledWith({
      user_name: 'Roberto Silva',
      user_role_title: 'Muebles Silva',
      rating: 5,
      message: 'Ahorramos 3 horas por proyecto con el despiece automático.',
      is_featured: true
    });
    expect(component.testimonialsList().length).toBe(2);
  });

  it('should update support & bug ticket status and save internal admin notes', async () => {
    component.setSection('support');
    fixture.detectChanges();

    expect(component.supportTicketsList().length).toBe(1);
    const ticket = component.supportTicketsList()[0];

    component.setTicketDraftStatus(ticket.id, 'resolved');
    component.setTicketDraftNotes(ticket.id, 'Resuelto en revisión v3.0.1');

    await component.saveTicketChanges(ticket);

    expect(supabaseMock.adminUpdateFeedback).toHaveBeenCalledWith('fb-bug-1', {
      status: 'resolved',
      admin_notes: 'Resuelto en revisión v3.0.1'
    });
    expect(component.supportTicketsList()[0].status).toBe('resolved');
    expect(component.supportTicketsList()[0].admin_notes).toBe('Resuelto en revisión v3.0.1');
    expect(component.savedFeedbackId()).toBe('fb-bug-1');
  });

  it('should default and normalize support_email to piezo3dstudio@gmail.com and recognize both owner emails', async () => {
    expect(component.currentSettings().support_email).toBe('piezo3dstudio@gmail.com');
    expect(component.cmsForm.controls.support_email.value).toBe('piezo3dstudio@gmail.com');
    expect(fixture.nativeElement.textContent).toContain('piezo3dstudio@gmail.com');

    // Simular que la fila heredada en DB todavía contiene el correo legado
    (supabaseMock.platformSettings as ReturnType<typeof signal<PlatformSettingsRecord>>).set({
      ...mockSettings,
      support_email: 'eydersuarez900@gmail.com'
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.currentSettings().support_email).toBe('piezo3dstudio@gmail.com');
    expect(component.cmsForm.controls.support_email.value).toBe('piezo3dstudio@gmail.com');

    // Salvaguarda dual de correos propietarios SuperAdmin
    expect(isSuperAdminOwnerEmail('eydersuarez900@gmail.com')).toBe(true);
    expect(isSuperAdminOwnerEmail('piezo3dstudio@gmail.com')).toBe(true);
  });

  it('should render Control de Pasarela de Pagos (Wompi Colombia) card with Modo en Vivo by default, toggle to Modo Protegido, show COP pills, and trigger admin checkout tests', () => {
    const paymentService = TestBed.inject(PaymentService);
    const cardEl = fixture.nativeElement.querySelector('[data-testid="admin-payments-readiness-card"]') as HTMLElement | null;
    const badgeEl = fixture.nativeElement.querySelector('[data-testid="admin-payments-mode-badge"]') as HTMLElement | null;
    const envPillEl = fixture.nativeElement.querySelector('[data-testid="admin-wompi-env-pill"]') as HTMLElement | null;
    const copPillEl = fixture.nativeElement.querySelector('[data-testid="admin-wompi-cop-pill"]') as HTMLElement | null;
    const toggleBtn = fixture.nativeElement.querySelector('[data-testid="admin-toggle-payments-mode-btn"]') as HTMLButtonElement | null;
    const testProBtn = fixture.nativeElement.querySelector('[data-testid="admin-test-checkout-pro-btn"]') as HTMLButtonElement | null;
    const testIndBtn = fixture.nativeElement.querySelector('[data-testid="admin-test-checkout-industrial-btn"]') as HTMLButtonElement | null;

    expect(cardEl).toBeTruthy();
    expect(cardEl?.textContent).toContain('Control de Pasarela de Pagos (Wompi Colombia)');
    expect(badgeEl?.textContent).toContain('Modo en Vivo (Checkout Wompi Activo)');
    expect(component.isPaymentsProtected()).toBe(false);
    expect(paymentService.paymentsMode()).toBe('live_checkout');

    expect(envPillEl?.textContent).toContain('Ambiente: Sandbox');
    expect(copPillEl?.textContent).toContain('4.250 COP');
    expect(copPillEl?.textContent).toContain('63.750 COP');
    expect(copPillEl?.textContent).toContain('123.250 COP');

    expect(testProBtn?.textContent).toContain('Probar Checkout Pro ($15)');
    expect(testIndBtn?.textContent).toContain('Probar Checkout Industrial ($29)');

    toggleBtn?.click();
    fixture.detectChanges();

    expect(component.isPaymentsProtected()).toBe(true);
    expect(paymentService.paymentsMode()).toBe('early_access_protected');
    expect(badgeEl?.textContent).toContain('Modo Protegido (Acceso Anticipado — Cobros Pausados)');
    expect(component.toastBanner()?.type).toBe('success');
    expect(component.toastBanner()?.text).toContain('Modo Protegido');

    const testAdminSpy = vi.spyOn(paymentService, 'testAdminCheckout').mockResolvedValue(undefined);
    testProBtn?.click();
    testIndBtn?.click();

    expect(testAdminSpy).toHaveBeenNthCalledWith(1, 'pro', 'monthly');
    expect(testAdminSpy).toHaveBeenNthCalledWith(2, 'industrial', 'monthly');

    toggleBtn?.click();
    fixture.detectChanges();

    expect(component.isPaymentsProtected()).toBe(false);
    expect(paymentService.paymentsMode()).toBe('live_checkout');
    expect(badgeEl?.textContent).toContain('Modo en Vivo (Checkout Wompi Activo)');
    expect(component.toastBanner()?.type).toBe('success');
    expect(component.toastBanner()?.text).toBe(
      'Pasarela de pagos activada en Modo en Vivo (Checkout Wompi Colombia activo).'
    );
  });

  it('should display Wompi COP estimates from PaymentService and surface lastCheckoutError in card and toast banner', async () => {
    const modeSig = signal<'early_access_protected' | 'live_checkout'>('live_checkout');
    const isPreparingSig = signal<boolean>(false);
    const errorSig = signal<string | null>(null);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: supabaseMock },
        {
          provide: PaymentService,
          useValue: {
            paymentsMode: modeSig,
            isPreparingCheckout: isPreparingSig,
            lastCheckoutError: errorSig,
            wompiEnvironment: () => 'sandbox',
            getCopEstimate: (plan: 'pro' | 'industrial') => ({
              amountUsd: plan === 'industrial' ? 29 : 15,
              exchangeRateCop: 4300,
              amountCop: plan === 'industrial' ? 124700 : 64500,
              amountInCents: (plan === 'industrial' ? 124700 : 64500) * 100
            }),
            togglePaymentsMode: () => {
              const next = modeSig() === 'early_access_protected' ? 'live_checkout' : 'early_access_protected';
              modeSig.set(next);
              return next;
            },
            testAdminCheckout: vi.fn().mockImplementation(async () => {
              errorSig.set('Falta configurar WOMPI_INTEGRITY_SECRET en el servidor.');
            })
          }
        }
      ]
    }).compileComponents();

    const localFixture = TestBed.createComponent(AdminDashboardComponent);
    const localComponent = localFixture.componentInstance;
    localFixture.detectChanges();
    await localFixture.whenStable();
    localFixture.detectChanges();

    const copPillEl = localFixture.nativeElement.querySelector('[data-testid="admin-wompi-cop-pill"]') as HTMLElement | null;
    expect(copPillEl?.textContent).toContain('4.300 COP');
    expect(copPillEl?.textContent).toContain('64.500 COP');
    expect(copPillEl?.textContent).toContain('124.700 COP');

    const testProBtn = localFixture.nativeElement.querySelector('[data-testid="admin-test-checkout-pro-btn"]') as HTMLButtonElement | null;
    testProBtn?.click();
    await localFixture.whenStable();
    localFixture.detectChanges();

    const errorBanner = localFixture.nativeElement.querySelector('[data-testid="admin-payments-error-banner"]') as HTMLElement | null;
    expect(errorBanner?.textContent).toContain('Falta configurar WOMPI_INTEGRITY_SECRET en el servidor.');
    expect(localComponent.toastBanner()?.type).toBe('error');
    expect(localComponent.toastBanner()?.text).toContain('WOMPI_INTEGRITY_SECRET');
  });
});
