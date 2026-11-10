import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { CHECKOUT_VARIANTS, FREE_PLAN_MAX_MODULES, PaymentService } from './payment.service';
import { SupabaseService } from './supabase.service';
import { User } from '@supabase/supabase-js';

describe('PaymentService (Checkout Overlay, Pre-fill & Plan Limits)', () => {
  let service: PaymentService;
  let supabaseService: SupabaseService;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        SupabaseService,
        PaymentService
      ]
    });
    supabaseService = TestBed.inject(SupabaseService);
    service = TestBed.inject(PaymentService);
    router = TestBed.inject(Router);
  });

  it('debe tener configurados los 4 enlaces oficiales y Variant IDs exactos', () => {
    expect(CHECKOUT_VARIANTS.pro.monthly.variantId).toBe('2359025');
    expect(CHECKOUT_VARIANTS.pro.monthly.baseUrl).toBe(
      'https://piezo3d.lemonsqueezy.com/checkout/buy/a40b0776-67df-46df-a8cf-56e81733f63e?embed=1&enabled=2359025'
    );

    expect(CHECKOUT_VARIANTS.pro.annual.variantId).toBe('2359008');
    expect(CHECKOUT_VARIANTS.pro.annual.baseUrl).toBe(
      'https://piezo3d.lemonsqueezy.com/checkout/buy/fa99e4fd-8006-4c21-bc89-e27cf92d2a16?embed=1&enabled=2359008'
    );

    expect(CHECKOUT_VARIANTS.industrial.monthly.variantId).toBe('2359108');
    expect(CHECKOUT_VARIANTS.industrial.monthly.baseUrl).toBe(
      'https://piezo3d.lemonsqueezy.com/checkout/buy/e401ebb9-d089-4949-af7b-aeeb3612ace6?embed=1&enabled=2359108'
    );

    expect(CHECKOUT_VARIANTS.industrial.annual.variantId).toBe('2359083');
    expect(CHECKOUT_VARIANTS.industrial.annual.baseUrl).toBe(
      'https://piezo3d.lemonsqueezy.com/checkout/buy/c086c431-b940-4043-b7a6-3816e6f0577f?embed=1&enabled=2359083'
    );
  });

  it('debe redirigir a /auth?mode=register&plan=...&cycle=... cuando el usuario no ha iniciado sesión', async () => {
    supabaseService.currentUser.set(null);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await service.openCheckout('pro', 'yearly');

    expect(navSpy).toHaveBeenCalledWith(['/auth'], {
      queryParams: {
        mode: 'register',
        plan: 'pro',
        cycle: 'annual'
      }
    });

    const pending = service.consumePendingCheckout();
    expect(pending).toEqual({ plan: 'pro', cycle: 'annual' });
  });

  it('debe pre-llenar email, name y custom user_id/plan/billing_cycle y abrir LemonSqueezy.Url.Open cuando el usuario está autenticado', async () => {
    const mockUser = {
      id: 'usr-999',
      email: 'eyder@taller.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-11-10T00:00:00Z'
    } as unknown as User;

    supabaseService.currentUser.set(mockUser);
    supabaseService.userProfile.set({
      id: 'usr-999',
      email: 'eyder@taller.com',
      first_name: 'Eyder',
      last_name: 'Suarez',
      role: 'user',
      plan: 'free',
      created_at: '2026-11-10T00:00:00Z',
      updated_at: '2026-11-10T00:00:00Z'
    });

    const openSpy = vi.fn();
    window.LemonSqueezy = {
      Url: { Open: openSpy },
      Setup: vi.fn()
    };

    await service.openCheckout('industrial', 'monthly');

    expect(openSpy).toHaveBeenCalledTimes(1);
    const openedUrl = openSpy.mock.calls[0][0] as string;
    expect(openedUrl).toContain('enabled=2359108');
    expect(openedUrl).toContain('checkout[email]=eyder%40taller.com');
    expect(openedUrl).toContain('checkout[name]=Eyder%20Suarez');
    expect(openedUrl).toContain('checkout[custom][user_id]=usr-999');
    expect(openedUrl).toContain('checkout[custom][plan]=industrial');
    expect(openedUrl).toContain('checkout[custom][billing_cycle]=monthly');
  });

  it('debe aplicar el límite de 3 módulos únicamente al Plan Inicial (free) y desbloquear en pro, industrial o super_admin', () => {
    supabaseService.userProfile.set({
      id: 'u-free',
      email: 'free@taller.com',
      first_name: 'Carpintero',
      last_name: 'Inicial',
      role: 'user',
      plan: 'free',
      created_at: '',
      updated_at: ''
    });

    expect(service.canAddModuleToScene(0)).toBe(true);
    expect(service.canAddModuleToScene(2)).toBe(true);
    expect(service.canAddModuleToScene(FREE_PLAN_MAX_MODULES)).toBe(false);
    expect(service.hasProAccess()).toBe(false);
    expect(service.hasIndustrialAccess()).toBe(false);

    supabaseService.userProfile.update((p) => (p ? { ...p, plan: 'pro' } : p));
    expect(service.canAddModuleToScene(10)).toBe(true);
    expect(service.hasProAccess()).toBe(true);
    expect(service.hasIndustrialAccess()).toBe(false);

    supabaseService.userProfile.update((p) => (p ? { ...p, plan: 'industrial' } : p));
    expect(service.canAddModuleToScene(25)).toBe(true);
    expect(service.hasProAccess()).toBe(true);
    expect(service.hasIndustrialAccess()).toBe(true);

    supabaseService.userProfile.update((p) => (p ? { ...p, plan: 'free', role: 'super_admin' } : p));
    expect(service.canAddModuleToScene(50)).toBe(true);
    expect(service.hasProAccess()).toBe(true);
    expect(service.hasIndustrialAccess()).toBe(true);
  });

  it('debe cerrar automáticamente el Checkout Overlay, refrescar perfil/facturas y navegar a /studio/designer al recibir Checkout.Success', async () => {
    const closeSpy = vi.fn();
    window.LemonSqueezy = {
      Url: {
        Open: vi.fn(),
        Close: closeSpy
      },
      Setup: vi.fn()
    };

    const refreshSpy = vi.spyOn(supabaseService, 'refreshUserProfile').mockResolvedValue(null);
    const invoicesSpy = vi.spyOn(supabaseService, 'getSubscriptionInvoices').mockResolvedValue([]);
    const navByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await service.handleCheckoutSuccess();

    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(refreshSpy).toHaveBeenCalled();
    expect(invoicesSpy).toHaveBeenCalled();
    expect(navByUrlSpy).toHaveBeenCalledWith('/studio/designer');
  });
});
