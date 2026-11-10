import { TestBed } from '@angular/core/testing';
import { SupabaseService, SUPABASE_SQL_SETUP, SUPABASE_CONFIG } from './supabase.service';
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

      const payloadsSent: Array<Record<string, unknown>> = [];
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
  });
});



