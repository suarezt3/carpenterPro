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
});

