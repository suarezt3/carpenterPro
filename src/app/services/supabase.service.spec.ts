import { TestBed } from '@angular/core/testing';
import { SupabaseService, SUPABASE_SQL_SETUP, SUPABASE_CONFIG } from './supabase.service';

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
});
