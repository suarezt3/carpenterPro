import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Session, User } from '@supabase/supabase-js';
import {
  DEFAULT_LANDING_PRICING_CONFIG,
  LandingPricingConfig,
  cloneLandingPricingConfig
} from '../models/landing-pricing.models';
import {
  LandingPricingConfigService,
  computeAnnualMonthlyCop,
  computeAnnualTotalCop,
  isPromoActiveAt
} from './landing-pricing-config.service';
import { SupabaseService } from './supabase.service';

interface MockSupabaseForPricingSpec {
  config: { url: string; publishableKey: string };
  session: WritableSignal<Session | null>;
  currentUser: WritableSignal<User | null>;
}

describe('LandingPricingConfigService (Configuración Dinámica de Precios, Promos, Pagos e IP)', () => {
  let service: LandingPricingConfigService;
  let supabaseService: MockSupabaseForPricingSpec;

  beforeEach(() => {
    supabaseService = {
      config: {
        url: 'https://example-project.test',
        publishableKey: 'public-anon-test-key'
      },
      session: signal<Session | null>(null),
      currentUser: signal<User | null>(null)
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: supabaseService },
        LandingPricingConfigService
      ]
    });
    service = TestBed.inject(LandingPricingConfigService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('debe iniciar con DEFAULT_LANDING_PRICING_CONFIG y pagos bloqueados por defecto (isPaymentsActive() === false)', () => {
    const cfg = service.config();
    expect(cfg).toEqual(DEFAULT_LANDING_PRICING_CONFIG);
    expect(cfg.id).toBe('default');
    expect(cfg.payments_enabled).toBe(false);
    expect(service.isPaymentsActive()).toBe(false);
    expect(service.isPromoCurrentlyActive()).toBe(false);
    expect(cfg.ip_guarantee_enabled).toBe(true);
    expect(cfg.annual_discount_percent).toBe(20);
    expect(cfg.plans.length).toBe(3);
    expect(cfg.plans[0].priceCopMonthly).toBe(0);
    expect(cfg.plans[1].priceCopMonthly).toBe(49900);
    expect(cfg.plans[2].priceCopMonthly).toBe(95900);
    for (const plan of cfg.plans) {
      expect(
        plan.features.some(
          (f) =>
            f.text === '100% propiedad intelectual de tus diseños y modelos 3D' &&
            f.isBold === true
        )
      ).toBe(true);
    }
    expect(service.isLoading()).toBe(false);
    expect(service.isSaving()).toBe(false);
    expect(service.error()).toBeNull();
    expect(service.hasLoadedRemote()).toBe(false);
  });

  it('debe calcular precios anuales COP de forma pura y determinista con clamp 0..80', () => {
    expect(computeAnnualMonthlyCop(49900, 20)).toBe(39920);
    expect(computeAnnualTotalCop(49900, 20)).toBe(479040);
    expect(computeAnnualMonthlyCop(95900, 20)).toBe(76720);
    expect(computeAnnualTotalCop(95900, 20)).toBe(920640);
    expect(computeAnnualMonthlyCop(0, 20)).toBe(0);
    expect(computeAnnualTotalCop(0, 20)).toBe(0);
    expect(computeAnnualMonthlyCop(50000, 99)).toBe(10000);
    expect(computeAnnualMonthlyCop(50000, -10)).toBe(50000);
  });

  it('debe evaluar isPromoCurrentlyActive() e isPromoActiveAt() según promo_enabled y promo_expires_at', () => {
    const nowMs = Date.parse('2026-11-21T12:00:00.000Z');
    const futureIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const pastIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    expect(isPromoActiveAt({ promo_enabled: false, promo_expires_at: null }, nowMs)).toBe(false);
    expect(
      isPromoActiveAt(
        { promo_enabled: false, promo_expires_at: '2026-12-31T23:59:59.000Z' },
        nowMs
      )
    ).toBe(false);
    expect(isPromoActiveAt({ promo_enabled: true, promo_expires_at: null }, nowMs)).toBe(true);
    expect(isPromoActiveAt({ promo_enabled: true, promo_expires_at: '' }, nowMs)).toBe(true);
    expect(
      isPromoActiveAt(
        { promo_enabled: true, promo_expires_at: '2026-12-31T23:59:59.000Z' },
        nowMs
      )
    ).toBe(true);
    expect(
      isPromoActiveAt(
        { promo_enabled: true, promo_expires_at: '2026-11-01T00:00:00.000Z' },
        nowMs
      )
    ).toBe(false);
    expect(
      isPromoActiveAt({ promo_enabled: true, promo_expires_at: 'fecha-invalida' }, nowMs)
    ).toBe(false);

    // 1. promo_enabled: true y sin expiración => true
    service.setLocalConfigForTesting({
      ...cloneLandingPricingConfig(DEFAULT_LANDING_PRICING_CONFIG),
      promo_enabled: true,
      promo_expires_at: null
    });
    expect(service.isPromoCurrentlyActive()).toBe(true);

    // 2. promo_enabled: true y fecha futura => true
    service.applyLocalConfig({
      promo_enabled: true,
      promo_expires_at: futureIso
    });
    expect(service.isPromoCurrentlyActive()).toBe(true);

    // 3. promo_enabled: true y fecha pasada => false
    service.applyLocalConfig({
      promo_enabled: true,
      promo_expires_at: pastIso
    });
    expect(service.isPromoCurrentlyActive()).toBe(false);

    // 4. promo_enabled: false incluso con fecha futura => false
    service.applyLocalConfig({
      promo_enabled: false,
      promo_expires_at: futureIso
    });
    expect(service.isPromoCurrentlyActive()).toBe(false);
  });

  it('loadConfig() debe consultar public.landing_pricing_config, normalizar rangos y usar caché en memoria', async () => {
    const futureIso = '2026-12-24T23:59:59.000Z';
    const remoteRow: Record<string, unknown> = {
      id: 'default',
      payments_enabled: true,
      payments_notice_title: 'Pagos activos',
      payments_notice_message: 'Pasarela en línea disponible.',
      payments_disabled_cta_label: 'Próximamente',
      promo_enabled: true,
      promo_badge: 'Black Week',
      promo_message: '25% OFF en planes anuales',
      promo_code: 'TALLER25',
      promo_expires_at: futureIso,
      promo_discount_percent: 140,
      ip_guarantee_enabled: true,
      ip_guarantee_title: 'Propiedad 100% Tuya',
      ip_guarantee_description: 'Tus planos siempre son tuyos.',
      annual_discount_percent: 95,
      plans: []
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([remoteRow]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const loaded = await service.loadConfig();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchSpy.mock.calls[0];
    expect(String(requestUrl)).toContain('/rest/v1/landing_pricing_config?id=eq.default&select=*&limit=1');
    expect(requestInit?.method).toBe('GET');

    expect(loaded.payments_enabled).toBe(true);
    expect(loaded.promo_discount_percent).toBe(90);
    expect(loaded.annual_discount_percent).toBe(80);
    expect(loaded.plans.length).toBe(3);
    expect(service.isPaymentsActive()).toBe(true);
    expect(service.hasLoadedRemote()).toBe(true);
    expect(service.error()).toBeNull();

    // Llamada posterior sin force=true reutiliza caché sin volver a consultar red
    const cached = await service.loadConfig();
    expect(cached).toEqual(loaded);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Llamada con force=true vuelve a consultar la nube
    await service.loadConfig(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('loadConfig() debe aplicar fallback seguro (payments_enabled: false) sin filtrar nombres de infraestructura ante errores', async () => {
    service.setLocalConfigForTesting({
      ...cloneLandingPricingConfig(DEFAULT_LANDING_PRICING_CONFIG),
      payments_enabled: true
    });
    expect(service.isPaymentsActive()).toBe(true);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'PGRST205',
          message: 'Could not find the table public.landing_pricing_config in Supabase PostgreSQL UUID cache'
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const fallbackResult = await service.loadConfig(true);

    expect(fallbackResult.payments_enabled).toBe(false);
    expect(service.isPaymentsActive()).toBe(false);
    expect(service.hasLoadedRemote()).toBe(false);
    expect(service.config()).toEqual(DEFAULT_LANDING_PRICING_CONFIG);
    const errMsg = service.error() ?? '';
    expect(errMsg.length).toBeGreaterThan(0);
    expect(errMsg).not.toMatch(/supabase|postgres|postgresql|uuid|pgrst/i);

    // Error de red (reject)
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline on Supabase Postgres'));
    const networkFallback = await service.loadConfig(true);
    expect(networkFallback.payments_enabled).toBe(false);
    expect(service.isPaymentsActive()).toBe(false);
    expect(service.error() ?? '').not.toMatch(/supabase|postgres|postgresql|uuid/i);
  });

  it('saveConfig() debe exigir sesión autenticada y persistir upsert en id=default cuando es superadministrador', async () => {
    const draft: LandingPricingConfig = {
      ...cloneLandingPricingConfig(DEFAULT_LANDING_PRICING_CONFIG),
      payments_enabled: true,
      promo_enabled: true,
      promo_badge: 'Lanzamiento',
      promo_code: 'MADERA20',
      promo_discount_percent: 25,
      annual_discount_percent: 30
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // Sin sesión autenticada no debe hacer petición ni exponer términos técnicos
    supabaseService.session.set(null);
    const unauthRes = await service.saveConfig(draft);
    expect(unauthRes.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(unauthRes.error ?? '').not.toMatch(/supabase|postgres|postgresql|uuid/i);

    // Con sesión autenticada ejecuta POST upsert con on_conflict=id
    supabaseService.currentUser.set({
      id: 'admin-user-1',
      email: 'admin@piezo3d.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-11-21T00:00:00.000Z'
    } as unknown as User);
    supabaseService.session.set({
      access_token: 'jwt-superadmin-token',
      refresh_token: 'refresh-1',
      expires_in: 3600,
      token_type: 'bearer',
      user: supabaseService.currentUser()!
    } as unknown as Session);

    const serverSavedRow: LandingPricingConfig = {
      ...draft,
      updated_at: '2026-11-21T15:00:00.000Z',
      updated_by: 'admin-user-1'
    };

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify([serverSavedRow]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const okRes = await service.saveConfig(draft);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [saveUrl, saveInit] = fetchSpy.mock.calls[0];
    expect(String(saveUrl)).toContain('/rest/v1/landing_pricing_config?on_conflict=id');
    expect(saveInit?.method).toBe('POST');
    const headers = saveInit?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer jwt-superadmin-token');
    expect(headers['Prefer']).toContain('resolution=merge-duplicates');

    expect(okRes.success).toBe(true);
    expect(okRes.data?.payments_enabled).toBe(true);
    expect(okRes.data?.promo_code).toBe('MADERA20');
    expect(okRes.data?.updated_at).toBe('2026-11-21T15:00:00.000Z');
    expect(service.isPaymentsActive()).toBe(true);
    expect(service.hasLoadedRemote()).toBe(true);
    expect(service.isSaving()).toBe(false);
    expect(service.error()).toBeNull();
  });

  it('saveConfig() debe manejar rechazo RLS (401/403) y errores de red sin filtrar nombres de infraestructura', async () => {
    supabaseService.session.set({
      access_token: 'jwt-regular-user',
      refresh_token: 'refresh-2',
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: 'usr-1' } as User
    } as unknown as Session);

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: '42501',
          message:
            'new row violates row-level security policy for table "landing_pricing_config" in Supabase PostgreSQL UUID auth.uid()'
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const rlsRes = await service.saveConfig({
      ...cloneLandingPricingConfig(DEFAULT_LANDING_PRICING_CONFIG),
      payments_enabled: true
    });

    expect(rlsRes.success).toBe(false);
    expect(rlsRes.error).toBe(
      'No tienes permisos de superadministrador para guardar la configuración de precios.'
    );
    expect(rlsRes.error ?? '').not.toMatch(/supabase|postgres|postgresql|uuid/i);
    expect(service.error()).toBe(rlsRes.error);
    expect(service.isPaymentsActive()).toBe(false);
    expect(service.isSaving()).toBe(false);

    // Error de tabla/red
    fetchSpy.mockRejectedValueOnce(new Error('Supabase PostgreSQL connection reset'));
    const netRes = await service.saveConfig(DEFAULT_LANDING_PRICING_CONFIG);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(netRes.success).toBe(false);
    expect(netRes.error).toBe('No fue posible guardar la configuración en la nube en este momento.');
    expect(netRes.error ?? '').not.toMatch(/supabase|postgres|postgresql|uuid/i);
  });
});
