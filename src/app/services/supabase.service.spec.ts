import { TestBed } from '@angular/core/testing';
import {
  AVATAR_COLOR_PRESETS,
  BillingPortalResult,
  normalizeAvatarColorHex,
  resolveAvatarBgClass,
  resolveAvatarColorId,
  SubscriptionMutationResult,
  SupabaseService,
  SUPABASE_SQL_SETUP,
  SUPABASE_CONFIG,
  UserProfile
} from './supabase.service';
import { Project, ProjectSettings } from '../models/melamine.models';

const testSettings: ProjectSettings = {
  sawKerf: 4,
  trimMargin: 10,
  currency: 'COP',
  defaultBoardThickness: 18,
  thinEdgeThickness: 0.45,
  thickEdgeThickness: 2.0,
  thinEdgeCostPerMeter: 1800,
  thickEdgeCostPerMeter: 4200,
  optimizationPreference: 'guillotine_length',
  subtractEdgeBandingFromCut: false
};

const createMockProject = (id: string, name: string): Project => ({
  id,
  name,
  clientName: 'Cliente Prueba',
  date: '2026-11-07',
  notes: '',
  settings: testSettings,
  materials: [],
  modules: [],
  parts: [],
  hardware: [],
  laborCost: 0,
  laborType: 'fixed',
  profitMarginPercent: 30,
  taxPercent: 19,
  updatedAt: '2026-11-07'
});

describe('SupabaseService (Fase 5 - Endurecimiento RLS Multitenant)', () => {
  let service: SupabaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SupabaseService]
    });
    service = TestBed.inject(SupabaseService);
  });

  it('debe tener configurada la URL oficial de Supabase', () => {
    expect(service.config.url).toBe(SUPABASE_CONFIG.url);
    expect(service.config.publishableKey).toBe(SUPABASE_CONFIG.publishableKey);
  });

  it('el script SQL de setup debe incluir habilitación de RLS en public.projects', () => {
    const sql = service.getSqlSetupScript();
    expect(sql).toContain('ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.projects');
    expect(sql).toContain('user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE');
  });

  it('las políticas RLS deben exigir estrictamente auth.uid() = user_id para SELECT, INSERT, UPDATE y DELETE', () => {
    const sql = SUPABASE_SQL_SETUP;

    // SELECT
    expect(sql).toContain('CREATE POLICY "projects_select_policy" ON public.projects\n  FOR SELECT USING (auth.uid() = user_id);');

    // INSERT
    expect(sql).toContain('CREATE POLICY "projects_insert_policy" ON public.projects\n  FOR INSERT WITH CHECK (auth.uid() = user_id);');

    // UPDATE
    expect(sql).toContain('CREATE POLICY "projects_update_policy" ON public.projects\n  FOR UPDATE USING (auth.uid() = user_id)\n  WITH CHECK (auth.uid() = user_id);');

    // DELETE
    expect(sql).toContain('CREATE POLICY "projects_delete_policy" ON public.projects\n  FOR DELETE USING (auth.uid() = user_id);');
  });

  it('el script SQL jamás debe contener la cláusula insegura OR user_id IS NULL (Solución Error #18)', () => {
    const sql = SUPABASE_SQL_SETUP;
    expect(sql.toUpperCase()).not.toContain('USER_ID IS NULL');
  });

  describe('Integración de Feedback, Bugs y Testimonios (user_feedback)', () => {
    it('el script SQL de feedback debe contener la tabla user_feedback con RLS y el trigger de auto-aprobación', async () => {
      const { SUPABASE_FEEDBACK_SQL_SETUP } = await import('./supabase.service');
      expect(SUPABASE_FEEDBACK_SQL_SETUP).toContain('CREATE TABLE IF NOT EXISTS public.user_feedback');
      expect(SUPABASE_FEEDBACK_SQL_SETUP).toContain('fn_auto_approve_feedback_testimonial');
      expect(SUPABASE_FEEDBACK_SQL_SETUP).toContain('trg_auto_approve_feedback_testimonial');
      expect(SUPABASE_FEEDBACK_SQL_SETUP).toContain('ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;');
      expect(SUPABASE_FEEDBACK_SQL_SETUP).toContain('CREATE POLICY "Users can insert feedback"');
      expect(SUPABASE_FEEDBACK_SQL_SETUP).toContain('CREATE POLICY "Authenticated users can view own feedback"');
      expect(SUPABASE_FEEDBACK_SQL_SETUP).toContain('CREATE POLICY "Public can view approved landing page testimonials"');
    });

    it('getMyFeedback debe retornar arreglo vacío cuando no hay usuario autenticado', async () => {
      service.currentUser.set(null);
      const list = await service.getMyFeedback();
      expect(list).toEqual([]);
    });

    it('submitFeedback debe aceptar payload de bug y retornar éxito o error estructurado', async () => {
      const res = await service.submitFeedback({
        category: 'bug',
        message: 'Valid bug report with sufficient length',
        target_module: 'general',
        severity_or_priority: 'medium'
      });
      expect(typeof res.success).toBe('boolean');
      if (res.success) {
        expect(res.data).toBeDefined();
        expect(res.data?.category).toBe('bug');
      }
    });

    it('el script SQL de setup debe incluir DEFAULT auth.uid(), ALTER COLUMN y NOTIFY reload schema', () => {
      expect(SUPABASE_SQL_SETUP).toContain('user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid()');
      expect(SUPABASE_SQL_SETUP).toContain('ALTER TABLE public.projects ALTER COLUMN user_id SET DEFAULT auth.uid();');
      expect(SUPABASE_SQL_SETUP).toContain("NOTIFY pgrst, 'reload schema';");
    });

    it('saveProjectCloud debe ser un alias funcional de saveProject', async () => {
      expect(typeof service.saveProjectCloud).toBe('function');
    });

    it('cleanErrorMessage debe sanitizar nombres de infraestructura y extraer mensaje de error', () => {
      const errWithSupabase = service.cleanErrorMessage('Supabase Error (400): Could not find the table');
      expect(errWithSupabase.toLowerCase()).not.toContain('supabase');
      expect(errWithSupabase).toContain('La tabla de proyectos no ha sido inicializada en la nube');

      const errPgrst204 = service.cleanErrorMessage("Could not find the 'user_id' column of 'projects' in the schema cache");
      expect(errPgrst204).toContain('La base de datos en la nube requiere sincronizar la estructura de proyectos.');

      const jsonErr = service.cleanErrorMessage('{"message": "Custom error occurred in Supabase"}');
      expect(jsonErr.toLowerCase()).not.toContain('supabase');
      expect(jsonErr).toContain('Custom error occurred in Servicio en la nube');
    });

    it('saveProject omite user_id en el payload cuando no hay usuario autenticado', async () => {
      service.currentUser.set(null);
      let capturedPayload: Record<string, unknown> | null = null;

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
        if (init?.body && typeof init.body === 'string') {
          capturedPayload = JSON.parse(init.body) as Record<string, unknown>;
        }
        return Promise.resolve(new Response(JSON.stringify([{ id: 'proj_anon', name: 'Demo' }]), { status: 200 }));
      });

      const testProject = createMockProject('proj_anon', 'Mueble Anonimo');
      const res = await service.saveProject(testProject);
      expect(res.success).toBe(true);
      expect(capturedPayload).toBeDefined();
      expect(capturedPayload!['user_id']).toBeUndefined();

      fetchSpy.mockRestore();
    });

    it('saveProject reintenta transparentemente sin user_id si PostgREST reporta columna ausente en schema cache', async () => {
      // Usuario autenticado
      service.currentUser.set({ id: 'usr-123', email: 'test@example.com', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' });

      const payloadsSent: Record<string, unknown>[] = [];
      let callCount = 0;

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
        callCount++;
        if (init?.body && typeof init.body === 'string') {
          payloadsSent.push(JSON.parse(init.body) as Record<string, unknown>);
        }

        if (callCount === 1) {
          // Primer intento falla con HTTP 400 y error de user_id en schema cache
          return Promise.resolve(new Response(
            JSON.stringify({
              code: 'PGRST204',
              message: "Could not find the 'user_id' column of 'projects' in the schema cache"
            }),
            { status: 400 }
          ));
        }

        // Reintento exitoso
        return Promise.resolve(new Response(
          JSON.stringify([{ id: 'proj_retry', name: 'Mueble Rescatado' }]),
          { status: 200 }
        ));
      });

      const testProject = createMockProject('proj_retry', 'Mueble Rescatado');
      const res = await service.saveProject(testProject);
      expect(res.success).toBe(true);
      expect(callCount).toBe(2);
      // El primer intento incluía user_id
      expect(payloadsSent[0]['user_id']).toBe('usr-123');
      // El segundo intento (retry) lo omitió
      expect(payloadsSent[1]['user_id']).toBeUndefined();

      fetchSpy.mockRestore();
    });
  });

  describe('Autenticación Reactiva, Perfiles de Usuario y Privacidad de Errores (user_profiles)', () => {
    it('SUPABASE_USER_PROFILES_SQL_SETUP debe definir public.user_profiles con RLS y trigger fn_handle_new_auth_user', async () => {
      const { SUPABASE_USER_PROFILES_SQL_SETUP } = await import('./supabase.service');
      expect(SUPABASE_USER_PROFILES_SQL_SETUP).toContain('CREATE TABLE IF NOT EXISTS public.user_profiles');
      expect(SUPABASE_USER_PROFILES_SQL_SETUP).toContain('ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;');
      expect(SUPABASE_USER_PROFILES_SQL_SETUP).toContain('CREATE POLICY "Users can view own profile"');
      expect(SUPABASE_USER_PROFILES_SQL_SETUP).toContain('CREATE POLICY "Users can update own profile"');
      expect(SUPABASE_USER_PROFILES_SQL_SETUP).toContain('CREATE OR REPLACE FUNCTION public.fn_handle_new_auth_user()');
      expect(SUPABASE_USER_PROFILES_SQL_SETUP).toContain('EXCEPTION\n    WHEN OTHERS THEN\n      -- Resiliencia absoluta: un error en perfiles jamás bloquea el alta del usuario en auth.users\n      RETURN NEW;');
      expect(SUPABASE_USER_PROFILES_SQL_SETUP).toContain('CREATE TRIGGER trg_on_auth_user_created');
    });

    it('buildFallbackProfile debe extraer first_name y last_name desde user_metadata o full_name (Google OAuth)', () => {
      const emailUser = {
        id: 'u-1',
        email: 'carlos@taller.com',
        app_metadata: {},
        user_metadata: { first_name: 'Carlos', last_name: 'Suárez' },
        aud: 'authenticated',
        created_at: '2026-11-09T00:00:00Z'
      };
      const p1 = service.buildFallbackProfile(emailUser);
      expect(p1.first_name).toBe('Carlos');
      expect(p1.last_name).toBe('Suárez');
      expect(p1.role).toBe('user');
      expect(p1.plan).toBe('free');

      const googleUser = {
        id: 'u-2',
        email: 'lucia@gmail.com',
        app_metadata: {},
        user_metadata: { full_name: 'Lucía Fernández Gómez' },
        aud: 'authenticated',
        created_at: '2026-11-09T00:00:00Z'
      };
      const p2 = service.buildFallbackProfile(googleUser);
      expect(p2.first_name).toBe('Lucía');
      expect(p2.last_name).toBe('Fernández Gómez');
    });

    it('mapAuthErrorToKey debe mapear errores técnicos a claves i18n amigables sin exponer nombres de infraestructura', () => {
      expect(service.mapAuthErrorToKey({ code: 'invalid_credentials', message: 'Invalid login credentials' }))
        .toBe('auth.errors.invalidCredentials');
      expect(service.mapAuthErrorToKey({ code: 'user_already_exists', message: 'User already registered' }))
        .toBe('auth.errors.userAlreadyRegistered');
      expect(service.mapAuthErrorToKey({ status: 429, message: 'Email rate limit exceeded' }))
        .toBe('auth.errors.rateLimitExceeded');
      expect(service.mapAuthErrorToKey({ code: 'over_email_send_rate_limit', message: 'Rate limit reached' }))
        .toBe('auth.errors.rateLimitExceeded');
      expect(service.mapAuthErrorToKey({ code: 'email_address_invalid', message: 'Invalid email address' }))
        .toBe('auth.errors.invalidEmailDomain');
      expect(service.mapAuthErrorToKey({ code: 'validation_failed', message: 'Disposable email domain' }))
        .toBe('auth.errors.invalidEmailDomain');
      expect(service.mapAuthErrorToKey({ code: 'email_not_confirmed', message: 'Email not confirmed' }))
        .toBe('auth.errors.emailNotConfirmed');
      expect(service.mapAuthErrorToKey({ code: 'same_password', message: 'New password should be different from the old password' }))
        .toBe('auth.errors.samePassword');
      expect(service.mapAuthErrorToKey({ code: 'otp_expired', message: 'Token has expired' }))
        .toBe('auth.errors.sessionExpired');
      expect(service.mapAuthErrorToKey(new Error('Failed to fetch from Supabase endpoint')))
        .toBe('auth.errors.networkError');
      expect(service.mapAuthErrorToKey({ message: 'Unexpected internal Supabase database error' }))
        .toBe('auth.errors.generic');
      expect(service.mapAuthErrorToKey({ code: 'access_denied', message: 'Email link is invalid or has expired' }))
        .toBe('auth.errors.sessionExpired');
      expect(service.mapAuthErrorToKey({ code: 'flow_state_not_found', message: 'Flow state not found' }))
        .toBe('auth.errors.sessionExpired');
    });

    it('SUPABASE_USER_PROFILES_SQL_SETUP no debe tener recursión infinita 42P17 en RLS y debe proteger role/plan mediante trigger', async () => {
      const { SUPABASE_USER_PROFILES_SQL_SETUP } = await import('./supabase.service');
      expect(SUPABASE_USER_PROFILES_SQL_SETUP).not.toContain('SELECT role FROM public.user_profiles');
      expect(SUPABASE_USER_PROFILES_SQL_SETUP).toContain('CREATE OR REPLACE FUNCTION public.fn_protect_user_profile_fields()');
      expect(SUPABASE_USER_PROFILES_SQL_SETUP).toContain('CREATE TRIGGER trg_protect_user_profile_fields');
      expect(SUPABASE_USER_PROFILES_SQL_SETUP).toContain('REVOKE ALL ON FUNCTION public.fn_handle_new_auth_user() FROM PUBLIC, anon, authenticated;');
    });

    it('signOut debe limpiar cloudProjects inmediatamente en memoria incluso si la red falla al cerrar sesión', async () => {
      service.cloudProjects.set([
        {
          id: 'proj-private-1',
          name: 'Cocina Privada',
          updated_at: '2026-11-09T00:00:00Z',
          modules_count: 2,
          parts_count: 10,
          user_id: 'u-1',
          data: createMockProject('proj-private-1', 'Cocina Privada')
        }
      ]);

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline network error'));
      try {
        await service.signOut();
        expect(service.currentUser()).toBeNull();
        expect(service.userProfile()).toBeNull();
        expect(service.cloudProjects()).toEqual([]);
      } finally {
        fetchSpy.mockRestore();
      }
    });

    describe('signUpWithEmail (Mapeo de respuestas y estados de sesión)', () => {
      it('debe retornar needsEmailConfirmation: true y messageKey auth.registerCheckEmail cuando session === null', async () => {
        const mockAuth = {
          signUp: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'u-pending-1',
                email: 'nuevo@taller.com',
                identities: [{ id: 'id-1', user_id: 'u-pending-1', provider: 'email' }]
              },
              session: null
            },
            error: null
          })
        };
        (service as unknown as { client: { auth: typeof mockAuth } }).client = { auth: mockAuth };

        const result = await service.signUpWithEmail({
          email: 'nuevo@taller.com',
          password: 'Password123!',
          firstName: 'Juan',
          lastName: 'Pérez'
        });

        expect(result.success).toBe(true);
        expect(result.needsEmailConfirmation).toBe(true);
        expect(result.messageKey).toBe('auth.registerCheckEmail');
        expect(service.session()).toBeNull();
        expect(service.currentUser()).toBeNull();
      });

      it('debe retornar needsEmailConfirmation: false y actualizar session cuando session !== null', async () => {
        const mockSession = { access_token: 'valid-jwt-token' };
        const mockUser = {
          id: 'u-active-1',
          email: 'activo@taller.com',
          identities: [{ id: 'id-2', user_id: 'u-active-1', provider: 'email' }]
        };
        const mockAuth = {
          signUp: vi.fn().mockResolvedValue({
            data: {
              user: mockUser,
              session: mockSession
            },
            error: null
          })
        };
        (service as unknown as { client: { auth: typeof mockAuth } }).client = { auth: mockAuth };
        vi.spyOn(service, 'loadUserProfile').mockResolvedValue(null);
        vi.spyOn(service, 'refreshProjects').mockResolvedValue([]);

        const result = await service.signUpWithEmail({
          email: 'activo@taller.com',
          password: 'Password123!',
          firstName: 'Ana',
          lastName: 'Gómez'
        });

        expect(result.success).toBe(true);
        expect(result.needsEmailConfirmation).toBe(false);
        expect(service.session()).toEqual(mockSession as unknown as import('@supabase/supabase-js').Session);
        expect(service.currentUser()).toEqual(mockUser as unknown as import('@supabase/supabase-js').User);
      });

      it('debe detectar correo duplicado cuando Supabase devuelve identities: [] con email confirmation activo', async () => {
        const mockAuth = {
          signUp: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'u-dup-1',
                email: 'existente@taller.com',
                identities: []
              },
              session: null
            },
            error: null
          })
        };
        (service as unknown as { client: { auth: typeof mockAuth } }).client = { auth: mockAuth };

        const result = await service.signUpWithEmail({
          email: 'existente@taller.com',
          password: 'Password123!',
          firstName: 'Carlos',
          lastName: 'Ruiz'
        });

        expect(result.success).toBe(false);
        expect(result.errorKey).toBe('auth.errors.userAlreadyRegistered');
      });

      it('debe mapear email_address_invalid a auth.errors.invalidEmailDomain', async () => {
        const mockAuth = {
          signUp: vi.fn().mockResolvedValue({
            data: { user: null, session: null },
            error: { code: 'email_address_invalid', message: 'Invalid email address' }
          })
        };
        (service as unknown as { client: { auth: typeof mockAuth } }).client = { auth: mockAuth };

        const result = await service.signUpWithEmail({
          email: 'test@test.com',
          password: 'Password123!',
          firstName: 'Carlos',
          lastName: 'Ruiz'
        });

        expect(result.success).toBe(false);
        expect(result.errorKey).toBe('auth.errors.invalidEmailDomain');
      });

      it('debe mapear 429 over_email_send_rate_limit a auth.errors.rateLimitExceeded', async () => {
        const mockAuth = {
          signUp: vi.fn().mockResolvedValue({
            data: { user: null, session: null },
            error: { status: 429, code: 'over_email_send_rate_limit', message: 'Rate limit exceeded' }
          })
        };
        (service as unknown as { client: { auth: typeof mockAuth } }).client = { auth: mockAuth };

        const result = await service.signUpWithEmail({
          email: 'spam@taller.com',
          password: 'Password123!',
          firstName: 'Carlos',
          lastName: 'Ruiz'
        });

        expect(result.success).toBe(false);
        expect(result.errorKey).toBe('auth.errors.rateLimitExceeded');
      });
    });

    describe('updateUserProfile (Milestone 3 - F8)', () => {
      it('debe retornar error si no hay usuario autenticado', async () => {
        service.currentUser.set(null);
        const res = await service.updateUserProfile({ first_name: 'Nuevo', last_name: 'Nombre' });
        expect(res.success).toBe(false);
        expect(res.errorKey).toBe('account.profileUpdateNoUser');
      });

      it('debe actualizar la señal userProfile localmente cuando no hay cliente o es exitoso', async () => {
        const mockUser = {
          id: 'user-123',
          email: 'carpintero@taller.com',
          created_at: '2026-11-09T00:00:00Z',
          app_metadata: {},
          user_metadata: { first_name: 'Juan', last_name: 'Pérez' },
          aud: 'authenticated'
        } as unknown as import('@supabase/supabase-js').User;

        service.currentUser.set(mockUser);
        service.userProfile.set({
          id: 'user-123',
          email: 'carpintero@taller.com',
          first_name: 'Juan',
          last_name: 'Pérez',
          role: 'user',
          plan: 'pro',
          created_at: '2026-11-09T00:00:00Z',
          updated_at: '2026-11-09T00:00:00Z'
        });

        const mockEq = vi.fn().mockResolvedValue({ error: null });
        const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
        (service as unknown as { client: { from: typeof mockFrom } }).client = { from: mockFrom };

        const res = await service.updateUserProfile({ first_name: 'Mateo', last_name: 'Gómez' });
        expect(res.success).toBe(true);
        expect(service.userProfile()?.first_name).toBe('Mateo');
        expect(service.userProfile()?.last_name).toBe('Gómez');
        expect(mockFrom).toHaveBeenCalledWith('user_profiles');
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
          first_name: 'Mateo',
          last_name: 'Gómez'
        }));
        expect(mockEq).toHaveBeenCalledWith('id', 'user-123');
      });

      it('debe manejar errores devueltos por la base de datos sin romper el estado', async () => {
        const mockUser = {
          id: 'user-error',
          email: 'error@taller.com',
          created_at: '2026-11-09T00:00:00Z',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated'
        } as unknown as import('@supabase/supabase-js').User;

        service.currentUser.set(mockUser);
        const mockEq = vi.fn().mockResolvedValue({ error: { message: 'Database error' } });
        const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
        (service as unknown as { client: { from: typeof mockFrom } }).client = { from: mockFrom };

        const res = await service.updateUserProfile({ first_name: 'Fallo' });
        expect(res.success).toBe(false);
        expect(res.errorKey).toBe('account.profileUpdateError');
      });
    });

    describe('Superadministrador y CMS Global (platform_settings y platform_feedback)', () => {
      it('SUPABASE_SUPERADMIN_SQL_SETUP debe incluir platform_settings, platform_feedback y función is_super_admin', async () => {
        const { SUPABASE_SUPERADMIN_SQL_SETUP } = await import('./supabase.service');
        expect(SUPABASE_SUPERADMIN_SQL_SETUP).toContain('CREATE TABLE IF NOT EXISTS public.platform_settings');
        expect(SUPABASE_SUPERADMIN_SQL_SETUP).toContain('CREATE TABLE IF NOT EXISTS public.platform_feedback');
        expect(SUPABASE_SUPERADMIN_SQL_SETUP).toContain('CREATE OR REPLACE FUNCTION public.is_super_admin()');
        expect(SUPABASE_SUPERADMIN_SQL_SETUP).toContain('eydersuarez900@gmail.com');
      });

      it('buildFallbackProfile debe asignar rol super_admin y plan industrial a la cuenta propietaria', () => {
        const ownerUser = {
          id: 'owner-1',
          email: 'eydersuarez900@gmail.com',
          app_metadata: {},
          user_metadata: { first_name: 'Eyder', last_name: 'Suárez' },
          aud: 'authenticated',
          created_at: '2026-11-01T00:00:00Z'
        };
        const profile = service.buildFallbackProfile(ownerUser);
        expect(profile.role).toBe('super_admin');
        expect(profile.plan).toBe('industrial');
        expect(profile.subscription_status).toBe('active');
        expect(profile.is_suspended).toBe(false);
      });

      it('isSuperAdmin debe ser true si el rol es super_admin o el email es el propietario', () => {
        service.currentUser.set(null);
        service.userProfile.set(null);
        expect(service.isSuperAdmin()).toBe(false);

        service.currentUser.set({
          id: 'owner-id',
          email: 'eydersuarez900@gmail.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: ''
        });
        expect(service.isSuperAdmin()).toBe(true);

        service.currentUser.set({
          id: 'admin-id',
          email: 'admin@taller.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: ''
        });
        service.userProfile.set({
          id: 'admin-id',
          email: 'admin@taller.com',
          first_name: 'Admin',
          last_name: 'General',
          role: 'super_admin',
          plan: 'industrial',
          created_at: '',
          updated_at: ''
        });
        expect(service.isSuperAdmin()).toBe(true);
      });

      it('loadPlatformSettings debe retornar la configuración por defecto y actualizar la señal', async () => {
        const settings = await service.loadPlatformSettings();
        expect(settings.id).toBe(1);
        expect(settings.app_version).toBe('v3.0.0');
        expect(settings.support_email).toBe('eydersuarez900@gmail.com');
        expect(service.platformSettings().pro_monthly_usd).toBe(15);
      });

      it('updatePlatformSettings debe actualizar la señal platformSettings localmente y llamar a la base de datos', async () => {
        const mockEq = vi.fn().mockResolvedValue({ error: null });
        const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
        (service as unknown as { client: { from: typeof mockFrom } }).client = { from: mockFrom };

        const res = await service.updatePlatformSettings({
          pro_monthly_usd: 19,
          announcement_enabled: true,
          announcement_text: 'Oferta Especial'
        });

        expect(res.success).toBe(true);
        expect(service.platformSettings().pro_monthly_usd).toBe(19);
        expect(service.platformSettings().announcement_enabled).toBe(true);
        expect(service.platformSettings().announcement_text).toBe('Oferta Especial');
        expect(mockFrom).toHaveBeenCalledWith('platform_settings');
        expect(mockEq).toHaveBeenCalledWith('id', 1);
      });

      it('adminGetAllProfiles debe retornar lista de perfiles mapeados', async () => {
        const mockProfiles = [
          {
            id: 'u-1',
            email: 'user1@test.com',
            first_name: 'User',
            last_name: 'Uno',
            role: 'user',
            plan: 'free',
            billing_cycle: 'monthly',
            subscription_status: 'free',
            is_suspended: false,
            created_at: '2026-11-01T00:00:00Z',
            updated_at: '2026-11-01T00:00:00Z'
          }
        ];
        const mockOrder = vi.fn().mockResolvedValue({ data: mockProfiles, error: null });
        const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
        const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
        (service as unknown as { client: { from: typeof mockFrom } }).client = { from: mockFrom };

        const list = await service.adminGetAllProfiles();
        expect(list.length).toBe(1);
        expect(list[0].email).toBe('user1@test.com');
        expect(mockFrom).toHaveBeenCalledWith('user_profiles');
      });

      it('adminUpdateUserProfile debe actualizar perfil y sincronizar perfil local si es el usuario actual', async () => {
        const currentU = {
          id: 'user-me',
          email: 'me@test.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: ''
        };
        service.currentUser.set(currentU);
        const initialProfile: UserProfile = {
          id: 'user-me',
          email: 'me@test.com',
          first_name: 'Yo',
          last_name: 'Mismo',
          role: 'user',
          plan: 'free',
          created_at: '',
          updated_at: ''
        };
        service.userProfile.set(initialProfile);

        const mockEq = vi.fn().mockResolvedValue({ error: null });
        const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
        (service as unknown as { client: { from: typeof mockFrom } }).client = { from: mockFrom };

        const res = await service.adminUpdateUserProfile('user-me', {
          plan: 'pro',
          role: 'super_admin'
        });

        expect(res.success).toBe(true);
        expect(service.userProfile()?.plan).toBe('pro');
        expect(service.userProfile()?.role).toBe('super_admin');
        expect(mockEq).toHaveBeenCalledWith('id', 'user-me');
      });

      it('adminCreateTestimonial debe insertar un testimonio aprobado', async () => {
        const mockSingle = vi.fn().mockResolvedValue({
          data: {
            id: 'testimonio-1',
            user_name: 'Carpintería Moderna',
            user_role_title: 'Taller',
            category: 'testimonial',
            message: 'Excelente herramienta para despieces.',
            rating: 5,
            status: 'approved',
            is_featured: true,
            created_at: '2026-11-10T00:00:00Z'
          },
          error: null
        });
        const mockSelect = vi.fn().mockReturnValue({ maybeSingle: mockSingle });
        const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
        const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
        (service as unknown as { client: { from: typeof mockFrom } }).client = { from: mockFrom };

        const res = await service.adminCreateTestimonial({
          user_name: 'Carpintería Moderna',
          user_role_title: 'Taller',
          message: 'Excelente herramienta para despieces.',
          rating: 5,
          is_featured: true
        });

        expect(res.success).toBe(true);
        expect(res.data?.user_name).toBe('Carpintería Moderna');
        expect(res.data?.rating).toBe(5);
        expect(mockFrom).toHaveBeenCalledWith('platform_feedback');
      });

      it('adminDeleteFeedback debe eliminar el registro en platform_feedback', async () => {
        const mockEq = vi.fn().mockResolvedValue({ error: null });
        const mockDelete = vi.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });
        (service as unknown as { client: { from: typeof mockFrom } }).client = { from: mockFrom };

        const res = await service.adminDeleteFeedback('feed-123');
        expect(res.success).toBe(true);
        expect(mockFrom).toHaveBeenCalledWith('platform_feedback');
        expect(mockEq).toHaveBeenCalledWith('id', 'feed-123');
      });
    });

    describe('Hidratación de sesión y perfil en recarga F5 (waitForAuthReady)', () => {
      it('debe esperar a que terminen TANTO getSession() como loadUserProfile() antes de resolver', async () => {
        const persistedUser = {
          id: 'u-reload-1',
          email: 'gerencia@carpenterpro.com',
          app_metadata: {},
          user_metadata: { first_name: 'Sofía' },
          aud: 'authenticated',
          created_at: '2026-11-01T00:00:00Z'
        } as unknown as import('@supabase/supabase-js').User;

        let resolveSession!: (val: { data: { session: { user: typeof persistedUser; access_token: string } | null } }) => void;
        const sessionPromise = new Promise<{ data: { session: { user: typeof persistedUser; access_token: string } | null } }>((resolve) => {
          resolveSession = resolve;
        });

        let resolveProfile!: (val: { data: Record<string, unknown> | null; error: null }) => void;
        const profilePromise = new Promise<{ data: Record<string, unknown> | null; error: null }>((resolve) => {
          resolveProfile = resolve;
        });

        const mockMaybeSingle = vi.fn().mockReturnValue(profilePromise);
        const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
        const mockGetSession = vi.fn().mockReturnValue(sessionPromise);

        (service as unknown as {
          client: {
            auth: { getSession: typeof mockGetSession };
            from: typeof mockFrom;
          };
        }).client = {
          auth: { getSession: mockGetSession },
          from: mockFrom
        };

        let readyResolved = false;
        const readyPromise = service.waitForAuthReady().then((u) => {
          readyResolved = true;
          return u;
        });

        // Mientras getSession() no resuelve, waitForAuthReady sigue esperando
        await Promise.resolve();
        expect(readyResolved).toBe(false);

        // Resuelve getSession(), pero loadUserProfile() aún está pendiente
        resolveSession({
          data: {
            session: {
              user: persistedUser,
              access_token: 'jwt-persisted'
            }
          }
        });
        await Promise.resolve();
        await Promise.resolve();
        expect(readyResolved).toBe(false);

        // Resuelve loadUserProfile() con rol super_admin y plan industrial
        resolveProfile({
          data: {
            id: 'u-reload-1',
            email: 'gerencia@carpenterpro.com',
            first_name: 'Sofía',
            last_name: 'Admin',
            role: 'super_admin',
            plan: 'industrial',
            billing_cycle: 'annual',
            subscription_status: 'active',
            is_suspended: false,
            created_at: '2026-11-01T00:00:00Z',
            updated_at: '2026-11-12T00:00:00Z'
          },
          error: null
        });

        const hydratedUser = await readyPromise;
        expect(readyResolved).toBe(true);
        expect(hydratedUser?.id).toBe('u-reload-1');
        expect(service.isAuthenticated()).toBe(true);
        expect(service.userProfile()?.role).toBe('super_admin');
        expect(service.userProfile()?.plan).toBe('industrial');
        expect(service.isAuthLoading()).toBe(false);
      });

      it('debe resolver de forma segura con perfil de respaldo si loadUserProfile falla o excede el tiempo', async () => {
        const persistedUser = {
          id: 'u-fallback-1',
          email: 'taller@carpenterpro.com',
          app_metadata: {},
          user_metadata: { first_name: 'Mateo' },
          aud: 'authenticated',
          created_at: '2026-11-01T00:00:00Z'
        } as unknown as import('@supabase/supabase-js').User;

        const mockMaybeSingle = vi.fn().mockRejectedValue(new Error('Network down'));
        const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
        const mockGetSession = vi.fn().mockResolvedValue({
          data: {
            session: {
              user: persistedUser,
              access_token: 'jwt-token'
            }
          }
        });

        (service as unknown as {
          client: {
            auth: { getSession: typeof mockGetSession };
            from: typeof mockFrom;
          };
        }).client = {
          auth: { getSession: mockGetSession },
          from: mockFrom
        };

        const hydratedUser = await service.waitForAuthReady();
        expect(hydratedUser?.id).toBe('u-fallback-1');
        expect(service.isAuthenticated()).toBe(true);
        expect(service.userProfile()?.first_name).toBe('Mateo');
        expect(service.isAuthLoading()).toBe(false);
      });

      it('no debe quedar colgado si getSession() lanza error durante la hidratación', async () => {
        const mockGetSession = vi.fn().mockRejectedValue(new Error('Storage unavailable'));
        (service as unknown as {
          client: { auth: { getSession: typeof mockGetSession } };
        }).client = {
          auth: { getSession: mockGetSession }
        };

        const hydratedUser = await service.waitForAuthReady();
        expect(hydratedUser).toBeNull();
        expect(service.isAuthenticated()).toBe(false);
        expect(service.isAuthLoading()).toBe(false);
      });

      it('no debe quedar colgado si getSession() nunca resuelve y supera el tiempo límite', async () => {
        vi.useFakeTimers();
        try {
          const mockGetSession = vi.fn().mockReturnValue(new Promise<never>(() => undefined));
          (service as unknown as {
            client: { auth: { getSession: typeof mockGetSession } };
          }).client = {
            auth: { getSession: mockGetSession }
          };

          const readyPromise = service.waitForAuthReady();
          await vi.advanceTimersByTimeAsync(8500);

          const hydratedUser = await readyPromise;
          expect(hydratedUser).toBeNull();
          expect(service.isAuthenticated()).toBe(false);
          expect(service.isAuthLoading()).toBe(false);
        } finally {
          vi.useRealTimers();
        }
      });
    });

    describe('Avatar helpers, perfil extendido, suscripción y métodos de pago', () => {
      const createAuthUser = (overrides?: Partial<import('@supabase/supabase-js').User>) => ({
        id: 'user-billing-1',
        email: 'carlos@taller.com',
        app_metadata: {},
        user_metadata: { first_name: 'Carlos', last_name: 'Mendoza' },
        aud: 'authenticated',
        created_at: '2026-11-01T00:00:00Z',
        ...overrides
      }) as unknown as import('@supabase/supabase-js').User;

      const createUserProfile = (overrides?: Partial<UserProfile>): UserProfile => ({
        id: 'user-billing-1',
        email: 'carlos@taller.com',
        first_name: 'Carlos',
        last_name: 'Mendoza',
        role: 'user',
        plan: 'pro',
        billing_cycle: 'monthly',
        subscription_status: 'active',
        avatar_color: '#18181B',
        avatar_mode: 'color',
        created_at: '2026-11-01T00:00:00Z',
        updated_at: '2026-11-01T00:00:00Z',
        ...overrides
      });

      it('los helpers de color de avatar deben normalizar presets y hexadecimales de forma segura', () => {
        expect(AVATAR_COLOR_PRESETS.length).toBe(6);
        expect(normalizeAvatarColorHex('sky')).toBe('#0284C7');
        expect(normalizeAvatarColorHex('EMERALD')).toBe('#059669');
        expect(normalizeAvatarColorHex('#0284c7')).toBe('#0284C7');
        expect(normalizeAvatarColorHex('#1a2b3c')).toBe('#1A2B3C');
        expect(normalizeAvatarColorHex('invalido')).toBe('#18181B');
        expect(normalizeAvatarColorHex(null)).toBe('#18181B');

        expect(resolveAvatarColorId('#059669')).toBe('emerald');
        expect(resolveAvatarColorId('STONE')).toBe('stone');
        expect(resolveAvatarColorId('#1A2B3C')).toBe('graphite');
        expect(resolveAvatarColorId(undefined)).toBe('graphite');

        expect(resolveAvatarBgClass('#0284c7')).toBe('bg-sky-600');
        expect(resolveAvatarBgClass('amber')).toBe('bg-amber-600');
        expect(resolveAvatarBgClass('#999999')).toBe('bg-zinc-900');
      });

      it('buildFallbackProfile y loadUserProfile deben incluir avatar_color, avatar_mode, card_brand y card_last_four', async () => {
        const googleUser = createAuthUser({
          user_metadata: {
            first_name: 'Ana',
            avatar_url: 'https://example.com/photo.jpg'
          }
        });
        const fallback = service.buildFallbackProfile(googleUser);
        expect(fallback.avatar_color).toBe('#18181B');
        expect(fallback.avatar_mode).toBe('google');
        expect(fallback.card_brand).toBeNull();
        expect(fallback.card_last_four).toBeNull();

        const mockMaybeSingle = vi.fn().mockResolvedValue({
          data: {
            id: 'user-billing-1',
            email: 'carlos@taller.com',
            first_name: 'Carlos',
            last_name: 'Mendoza',
            role: 'user',
            plan: 'pro',
            billing_cycle: 'annual',
            subscription_status: 'active',
            card_brand: '  visa ',
            card_last_four: '**** 4242',
            avatar_color: '#0284c7',
            avatar_mode: 'color',
            created_at: '2026-11-01T00:00:00Z',
            updated_at: '2026-11-02T00:00:00Z'
          },
          error: null
        });
        const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
        (service as unknown as { client: { from: typeof mockFrom } }).client = { from: mockFrom };

        const loaded = await service.loadUserProfile(googleUser);
        expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('avatar_color'));
        expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('avatar_mode'));
        expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('card_brand'));
        expect(mockSelect).toHaveBeenCalledWith(expect.stringContaining('card_last_four'));
        expect(loaded?.avatar_color).toBe('#0284C7');
        expect(loaded?.avatar_mode).toBe('color');
        expect(loaded?.card_brand).toBe('VISA');
        expect(loaded?.card_last_four).toBe('4242');
      });

      it('loadUserProfile debe incluir avatar_color y avatar_mode en el upsert inicial si no existe registro', async () => {
        const user = createAuthUser();
        const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        const mockUpsert = vi.fn().mockResolvedValue({ error: null });
        const mockFrom = vi.fn().mockReturnValue({
          select: mockSelect,
          upsert: mockUpsert
        });
        (service as unknown as { client: { from: typeof mockFrom } }).client = { from: mockFrom };

        await service.loadUserProfile(user);
        expect(mockUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            avatar_color: '#18181B',
            avatar_mode: 'color'
          }),
          { onConflict: 'id' }
        );
      });

      it('updateUserProfile debe normalizar avatar_color, persistir avatar_mode y reemplazar userProfile con nueva referencia inmutable', async () => {
        const user = createAuthUser();
        const initialProfile = createUserProfile();
        service.currentUser.set(user);
        service.userProfile.set(initialProfile);

        const mockEq = vi.fn().mockResolvedValue({ error: null });
        const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
        (service as unknown as { client: { from: typeof mockFrom } }).client = { from: mockFrom };

        const res = await service.updateUserProfile({
          first_name: 'Carlos',
          last_name: 'Mendoza',
          avatar_color: 'emerald',
          avatar_mode: 'color'
        });

        expect(res.success).toBe(true);
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
          avatar_color: '#059669',
          avatar_mode: 'color'
        }));
        const nextProfile = service.userProfile();
        expect(nextProfile).not.toBe(initialProfile);
        expect(nextProfile?.avatar_color).toBe('#059669');
        expect(nextProfile?.avatar_mode).toBe('color');
      });

      it('cancelSubscription debe cancelar al fin del periodo sin enviar reason ni alterar el plan', async () => {
        const user = createAuthUser();
        const initialProfile = createUserProfile({ plan: 'pro', subscription_status: 'active' });
        service.currentUser.set(user);
        service.userProfile.set(initialProfile);

        const mockEq = vi.fn().mockResolvedValue({ error: null });
        const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
        (service as unknown as { client: { from: typeof mockFrom } }).client = { from: mockFrom };

        const res = await service.cancelSubscription({ immediate: false, reason: 'cost' });

        expect(res.success).toBe(true);
        const sentPayload = mockUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sentPayload['subscription_status']).toBe('cancelled');
        expect(sentPayload['plan']).toBeUndefined();
        expect(sentPayload['reason']).toBeUndefined();
        expect(service.userProfile()).not.toBe(initialProfile);
        expect(service.userProfile()?.subscription_status).toBe('cancelled');
        expect(service.userProfile()?.plan).toBe('pro');
      });

      it('cancelSubscription con immediate=true debe bajar a plan free y status free sin enviar reason', async () => {
        const user = createAuthUser();
        const initialProfile = createUserProfile({ plan: 'industrial', subscription_status: 'active' });
        service.currentUser.set(user);
        service.userProfile.set(initialProfile);

        const mockEq = vi.fn().mockResolvedValue({ error: null });
        const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
        (service as unknown as { client: { from: typeof mockFrom } }).client = { from: mockFrom };

        const res = await service.cancelSubscription({ immediate: true, reason: 'alternative' });

        expect(res.success).toBe(true);
        const sentPayload = mockUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(sentPayload['plan']).toBe('free');
        expect(sentPayload['subscription_status']).toBe('free');
        expect(sentPayload['reason']).toBeUndefined();
        expect(service.userProfile()).not.toBe(initialProfile);
        expect(service.userProfile()?.plan).toBe('free');
        expect(service.userProfile()?.subscription_status).toBe('free');
      });

      it('reactivateSubscription debe restaurar subscription_status a active con nueva referencia inmutable', async () => {
        const user = createAuthUser();
        const initialProfile = createUserProfile({ plan: 'pro', subscription_status: 'cancelled' });
        service.currentUser.set(user);
        service.userProfile.set(initialProfile);

        const mockEq = vi.fn().mockResolvedValue({ error: null });
        const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
        const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
        (service as unknown as { client: { from: typeof mockFrom } }).client = { from: mockFrom };

        const res = await service.reactivateSubscription();

        expect(res.success).toBe(true);
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: 'active' }));
        expect(service.userProfile()).not.toBe(initialProfile);
        expect(service.userProfile()?.subscription_status).toBe('active');
      });

      it('getBillingPortalUrl debe invocar la Edge Function, sincronizar userProfile y manejar caché/errores', async () => {
        service.currentUser.set(null);
        const unauthRes: BillingPortalResult = await service.getBillingPortalUrl();
        expect(unauthRes.success).toBe(false);
        expect(unauthRes.errorKey).toBe('account.profileUpdateNoUser');

        const user = createAuthUser();
        const initialProfile = createUserProfile({
          plan: 'pro',
          subscription_status: 'active',
          subscription_id: 'sub_ls_100',
          customer_portal_url: 'https://app.lemonsqueezy.com/my-orders/cached'
        });
        service.currentUser.set(user);
        service.userProfile.set(initialProfile);

        const mockInvoke = vi.fn().mockResolvedValue({
          data: {
            success: true,
            source: 'lemon_squeezy_api',
            portalUrl: 'https://app.lemonsqueezy.com/my-orders/live-update',
            updatePaymentMethodUrl: 'https://app.lemonsqueezy.com/my-orders/live-update',
            customerPortalUrl: 'https://app.lemonsqueezy.com/my-orders/customer',
            subscription_status: 'active',
            current_period_end: '2027-01-15T00:00:00Z',
            cardBrand: 'mastercard',
            cardLastFour: '5511'
          },
          error: null
        });
        (service as unknown as { client: { functions: { invoke: typeof mockInvoke } } }).client = {
          functions: { invoke: mockInvoke }
        };

        const liveRes = await service.getBillingPortalUrl();
        expect(mockInvoke).toHaveBeenCalledWith('lemon-squeezy-manage-subscription', {
          body: { action: 'get_portal_url' }
        });
        expect(liveRes.success).toBe(true);
        expect(liveRes.source).toBe('lemon_squeezy_api');
        expect(liveRes.portalUrl).toBe('https://app.lemonsqueezy.com/my-orders/live-update');
        expect(liveRes.cardBrand).toBe('MASTERCARD');
        expect(liveRes.cardLastFour).toBe('5511');
        expect(service.userProfile()).not.toBe(initialProfile);
        expect(service.userProfile()?.customer_portal_url).toBe('https://app.lemonsqueezy.com/my-orders/customer');
        expect(service.userProfile()?.current_period_end).toBe('2027-01-15T00:00:00Z');
        expect(service.userProfile()?.card_brand).toBe('MASTERCARD');
        expect(service.userProfile()?.card_last_four).toBe('5511');

        // Fallback seguro a customer_portal_url cacheada cuando falla la Edge Function
        mockInvoke.mockResolvedValueOnce({
          data: { success: false, code: 'LEMON_API_KEY_MISSING' },
          error: null
        });
        const cachedRes = await service.getBillingPortalUrl();
        expect(cachedRes.success).toBe(true);
        expect(cachedRes.source).toBe('cached_portal_url');
        expect(cachedRes.portalUrl).toBe('https://app.lemonsqueezy.com/my-orders/customer');

        // Sin caché: LEMON_API_KEY_MISSING y error genérico devuelven claves i18n precisas
        service.userProfile.set({ ...initialProfile, customer_portal_url: null });
        mockInvoke.mockResolvedValueOnce({
          data: { success: false, code: 'LEMON_API_KEY_MISSING' },
          error: null
        });
        const missingKeyRes = await service.getBillingPortalUrl();
        expect(missingKeyRes.success).toBe(false);
        expect(missingKeyRes.errorCode).toBe('LEMON_API_KEY_MISSING');
        expect(missingKeyRes.errorKey).toBe('account.billing.gatewayKeyMissingError');

        mockInvoke.mockResolvedValueOnce({
          data: null,
          error: { message: 'Function failed' }
        });
        const genericErrRes = await service.getBillingPortalUrl();
        expect(genericErrRes.success).toBe(false);
        expect(genericErrRes.errorCode).toBe('EDGE_INVOKE_ERROR');
        expect(genericErrRes.errorKey).toBe('account.billing.portalUnavailableToast');
      });

      it('cancelSubscription y reactivateSubscription vía functions.invoke deben sincronizar éxito y rechazar errores sin falsos positivos', async () => {
        const user = createAuthUser();
        const activeExtProfile = createUserProfile({
          plan: 'pro',
          subscription_status: 'active',
          subscription_id: 'sub_ls_200',
          customer_portal_url: 'https://app.lemonsqueezy.com/my-orders/sub200'
        });
        service.currentUser.set(user);
        service.userProfile.set(activeExtProfile);

        // Si subscription_id existe y no hay functions.invoke, no finge cancelación ni muta estado
        (service as unknown as { client: { from: ReturnType<typeof vi.fn> } }).client = {
          from: vi.fn()
        };
        const noEdgeRes: SubscriptionMutationResult = await service.cancelSubscription({ immediate: false });
        expect(noEdgeRes.success).toBe(false);
        expect(noEdgeRes.errorCode).toBe('EDGE_CLIENT_UNAVAILABLE');
        expect(noEdgeRes.errorKey).toBe('account.billing.cancelErrorToast');
        expect(service.userProfile()).toBe(activeExtProfile);

        const mockInvoke = vi.fn();
        (service as unknown as { client: { functions: { invoke: typeof mockInvoke } } }).client = {
          functions: { invoke: mockInvoke }
        };

        // LEMON_API_KEY_MISSING jamás finge éxito ni altera userProfile
        mockInvoke.mockResolvedValueOnce({
          data: {
            success: false,
            code: 'LEMON_API_KEY_MISSING',
            portalUrl: 'https://app.lemonsqueezy.com/my-orders/sub200'
          },
          error: null
        });
        const missingKeyCancel = await service.cancelSubscription({ immediate: false, reason: 'cost' });
        expect(mockInvoke).toHaveBeenCalledWith('lemon-squeezy-manage-subscription', {
          body: { action: 'cancel', immediate: false, reason: 'cost' }
        });
        expect(missingKeyCancel.success).toBe(false);
        expect(missingKeyCancel.errorCode).toBe('LEMON_API_KEY_MISSING');
        expect(missingKeyCancel.errorKey).toBe('account.billing.gatewayKeyMissingError');
        expect(missingKeyCancel.portalUrl).toBe('https://app.lemonsqueezy.com/my-orders/sub200');
        expect(service.userProfile()).toBe(activeExtProfile);
        expect(service.userProfile()?.subscription_status).toBe('active');

        // Error de Edge Function tampoco finge éxito
        mockInvoke.mockResolvedValueOnce({
          data: { success: false, code: 'LEMON_API_ERROR' },
          error: null
        });
        const apiErrCancel = await service.cancelSubscription({ immediate: true });
        expect(apiErrCancel.success).toBe(false);
        expect(apiErrCancel.errorCode).toBe('LEMON_API_ERROR');
        expect(apiErrCancel.errorKey).toBe('account.billing.cancelErrorToast');
        expect(service.userProfile()?.subscription_status).toBe('active');

        // Cancelación real exitosa sincroniza metadatos
        mockInvoke.mockResolvedValueOnce({
          data: {
            success: true,
            mode: 'lemon_squeezy',
            subscription_status: 'cancelled',
            current_period_end: '2027-02-01T00:00:00Z',
            customerPortalUrl: 'https://app.lemonsqueezy.com/my-orders/sub200-new',
            cardBrand: 'visa',
            cardLastFour: '1111'
          },
          error: null
        });
        const okCancel = await service.cancelSubscription({ immediate: false, reason: 'paused' });
        expect(okCancel.success).toBe(true);
        const afterCancelProfile = service.userProfile();
        expect(afterCancelProfile).not.toBe(activeExtProfile);
        expect(afterCancelProfile?.subscription_status).toBe('cancelled');
        expect(afterCancelProfile?.plan).toBe('pro');
        expect(afterCancelProfile?.card_brand).toBe('VISA');
        expect(afterCancelProfile?.card_last_four).toBe('1111');
        expect(afterCancelProfile?.customer_portal_url).toBe('https://app.lemonsqueezy.com/my-orders/sub200-new');

        // Reactivación fallida por falta de API Key no muta estado cancelado
        mockInvoke.mockResolvedValueOnce({
          data: { success: false, code: 'LEMON_API_KEY_MISSING' },
          error: null
        });
        const failResume = await service.reactivateSubscription();
        expect(mockInvoke).toHaveBeenLastCalledWith('lemon-squeezy-manage-subscription', {
          body: { action: 'resume' }
        });
        expect(failResume.success).toBe(false);
        expect(failResume.errorCode).toBe('LEMON_API_KEY_MISSING');
        expect(failResume.errorKey).toBe('account.billing.gatewayKeyMissingError');
        expect(service.userProfile()?.subscription_status).toBe('cancelled');

        // Reactivación real exitosa restaura active
        mockInvoke.mockResolvedValueOnce({
          data: {
            success: true,
            mode: 'lemon_squeezy',
            subscription_status: 'active',
            current_period_end: '2027-03-01T00:00:00Z'
          },
          error: null
        });
        const okResume = await service.reactivateSubscription();
        expect(okResume.success).toBe(true);
        expect(service.userProfile()?.subscription_status).toBe('active');
        expect(service.userProfile()?.current_period_end).toBe('2027-03-01T00:00:00Z');

        // Plan manual local sin subscription_id vía Edge Function degrada a free con immediate=true
        const localManualProfile = createUserProfile({
          plan: 'industrial',
          subscription_status: 'active',
          subscription_id: null
        });
        service.userProfile.set(localManualProfile);
        mockInvoke.mockResolvedValueOnce({
          data: {
            success: true,
            mode: 'local_profile',
            plan: 'free',
            subscription_status: 'free'
          },
          error: null
        });
        const localImmediateCancel = await service.cancelSubscription({ immediate: true });
        expect(localImmediateCancel.success).toBe(true);
        expect(service.userProfile()?.plan).toBe('free');
        expect(service.userProfile()?.subscription_status).toBe('free');
      });
    });
  });
});



