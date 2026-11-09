import { Injectable, PLATFORM_ID, computed, DestroyRef, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { Project } from '../models/melamine.models';
import { CreateFeedbackPayload, UserFeedbackRecord } from '../models/feedback.models';

/**
 * Estructura del registro que se guarda en la tabla `public.projects` de Supabase.
 * Separa metadatos rápidos (nombre, cliente, conteos) del objeto completo `data` (JSONB).
 */
export interface CloudProjectRecord {
  id: string;
  name: string;
  client_name?: string;
  updated_at: string;
  modules_count: number;
  parts_count: number;
  user_id?: string | null;
  data: Project;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'table_needed' | 'error';

export const SUPABASE_CONFIG = {
  url: 'https://umdcxcjrdyckpxomxlmi.supabase.co',
  publishableKey: 'sb_publishable_FYydWGY0juW6ajW5tLiQQQ_Stz1tMVD'
};

/**
 * Script SQL para ejecutar en el SQL Editor de Supabase.
 * Incluye la columna `user_id`, índices para acelerar búsquedas y políticas RLS granulares.
 */
export const SUPABASE_SQL_SETUP = `-- ==========================================
-- SCRIPT DE INICIALIZACIÓN Y SEGURIDAD RLS PARA SUPABASE
-- Pega este código en Supabase > SQL Editor y pulsa RUN
-- ==========================================

CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name TEXT NOT NULL,
  client_name TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  modules_count INTEGER DEFAULT 0,
  parts_count INTEGER DEFAULT 0,
  data JSONB NOT NULL
);

-- Asegurar columna user_id e índices si la tabla ya existía
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.projects ALTER COLUMN user_id SET DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Limpiar política antigua e implementar políticas granulares por operación
DROP POLICY IF EXISTS "Permitir acceso publico a proyectos" ON public.projects;
DROP POLICY IF EXISTS "projects_select_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_update_policy" ON public.projects;
DROP POLICY IF EXISTS "projects_delete_policy" ON public.projects;

-- Políticas seguras y estrictas de Row Level Security (RLS) exigiendo auth.uid() = user_id
CREATE POLICY "projects_select_policy" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "projects_insert_policy" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_update_policy" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_delete_policy" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- Recargar caché de esquema de PostgREST inmediatamente
NOTIFY pgrst, 'reload schema';
`;

/**
 * Script SQL para la tabla public.user_feedback con políticas RLS y trigger de auto-aprobación.
 */
export const SUPABASE_FEEDBACK_SQL_SETUP = `-- ==========================================
-- TABLA DE FEEDBACK, REPORTES Y TESTIMONIALES CON AUTO-APROBACIÓN
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'support', 'testimonial')),
  title TEXT,
  message TEXT NOT NULL CHECK (char_length(trim(message)) >= 10),
  contact_email TEXT,
  target_module TEXT CHECK (target_module IN ('designer_3d', 'parts_list', 'optimizer_2d', 'budget', 'labels', 'exports', 'general')),
  severity_or_priority TEXT CHECK (severity_or_priority IN ('low', 'medium', 'high', 'critical')),
  rating SMALLINT CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  author_name TEXT,
  author_role TEXT,
  author_location TEXT,
  allow_public_display BOOLEAN NOT NULL DEFAULT false,
  is_approved_public BOOLEAN NOT NULL DEFAULT false,
  app_version TEXT NOT NULL DEFAULT 'v3.0.0',
  app_language TEXT NOT NULL DEFAULT 'es',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.fn_auto_approve_feedback_testimonial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$ BEGIN IF NEW.category = 'testimonial' AND NEW.allow_public_display = true AND COALESCE(NEW.rating, 0) >= 4 THEN NEW.is_approved_public := true; ELSE NEW.is_approved_public := false; END IF; RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_auto_approve_feedback_testimonial ON public.user_feedback;
CREATE TRIGGER trg_auto_approve_feedback_testimonial
  BEFORE INSERT ON public.user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_approve_feedback_testimonial();

CREATE INDEX IF NOT EXISTS idx_user_feedback_category ON public.user_feedback(category);
CREATE INDEX IF NOT EXISTS idx_user_feedback_public_testimonials 
  ON public.user_feedback(category, allow_public_display, is_approved_public, created_at DESC)
  WHERE category = 'testimonial' AND allow_public_display = true AND is_approved_public = true;

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert feedback"
  ON public.user_feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(trim(message)) >= 10
    AND (user_id IS NULL OR auth.uid() = user_id)
  );

CREATE POLICY "Authenticated users can view own feedback"
  ON public.user_feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Public can view approved landing page testimonials"
  ON public.user_feedback
  FOR SELECT
  TO anon, authenticated
  USING (
    category = 'testimonial'
    AND allow_public_display = true
    AND is_approved_public = true
  );
`;

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  // Inyectamos PLATFORM_ID para saber si el código corre en el navegador o en el servidor Node (SSR)
  private readonly platformId = inject(PLATFORM_ID);
  // DestroyRef nos permite limpiar suscripciones automáticamente cuando el servicio se destruya
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private client: SupabaseClient | null = null;

  readonly config = SUPABASE_CONFIG;
  readonly cloudProjects = signal<CloudProjectRecord[]>([]);
  readonly syncStatus = signal<SyncStatus>('idle');
  readonly lastSyncTime = signal<Date | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // Signals reactivos para conocer en toda la app quién es el usuario logueado
  readonly session = signal<Session | null>(null);
  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  /**
   * Construye los encabezados HTTP para las peticiones REST a Supabase.
   * Si el usuario inició sesión, envía su token JWT personal (`session.access_token`)
   * para que PostgreSQL valide su identidad en las políticas RLS (`auth.uid()`).
   */
  private get headers(): Record<string, string> {
    const token = this.session()?.access_token || this.config.publishableKey;
    return {
      'apikey': this.config.publishableKey,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  constructor() {
    // Solo inicializamos Supabase y cargamos proyectos si estamos en el navegador del cliente (evita fallos en SSR)
    if (this.isBrowser) {
      this.initSupabaseClient();
      void this.refreshProjects();
    }
  }

  /**
   * Inicializa el cliente oficial `@supabase/supabase-js` y escucha cambios de sesión
   * (login, logout, renovación automática del token JWT).
   */
  private initSupabaseClient() {
    try {
      this.client = createClient(this.config.url, this.config.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });

      // Recuperar sesión activa guardada en localStorage al abrir la app
      void this.client.auth.getSession().then(({ data }) => {
        if (data?.session) {
          this.session.set(data.session);
          this.currentUser.set(data.session.user);
        }
      });

      // Suscribirse a cambios de estado de autenticación en tiempo real
      const { data: authListener } = this.client.auth.onAuthStateChange((_event, newSession) => {
        this.session.set(newSession);
        this.currentUser.set(newSession?.user ?? null);
      });

      // Evitar fugas de memoria cancelando la suscripción al destruir el servicio
      this.destroyRef.onDestroy(() => {
        authListener.subscription.unsubscribe();
      });
    } catch (err) {
      console.warn('Supabase client init warning:', err);
    }
  }

  // ==========================================
  // MÉTODOS DE AUTENTICACIÓN (SUPABASE AUTH)
  // ==========================================

  /**
   * Inicia sesión con correo y contraseña, actualiza los signals de usuario
   * y recarga la lista de proyectos pertenecientes a esa cuenta.
   */
  async signInWithEmail(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    if (!this.client) return { success: false, error: 'Cliente Supabase no disponible' };
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      return { success: false, error: error.message };
    }
    this.session.set(data.session);
    this.currentUser.set(data.user);
    await this.refreshProjects();
    return { success: true };
  }

  /**
   * Registra un nuevo usuario en Supabase Auth guardando su nombre en `user_metadata`.
   */
  async signUpWithEmail(email: string, password: string, fullName?: string): Promise<{ success: boolean; error?: string }> {
    if (!this.client) return { success: false, error: 'Cliente Supabase no disponible' };
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName || '' }
      }
    });
    if (error) {
      return { success: false, error: error.message };
    }
    this.session.set(data.session);
    this.currentUser.set(data.user);
    return { success: true };
  }

  /**
   * Cierra la sesión activa, limpia los signals de usuario y refresca la lista.
   */
  async signOut(): Promise<void> {
    if (!this.client) return;
    await this.client.auth.signOut();
    this.session.set(null);
    this.currentUser.set(null);
    await this.refreshProjects();
  }

  // ==========================================
  // OPERACIONES DE PROYECTOS EN LA NUBE
  // ==========================================

  /**
   * Obtiene los últimos 50 proyectos ordenados por fecha de actualización.
   * Detecta automáticamente el código PGRST205 si la tabla aún no existe en Supabase.
   */
  async refreshProjects(): Promise<CloudProjectRecord[]> {
    if (!this.isBrowser) return [];
    this.syncStatus.set('syncing');
    try {
      const url = `${this.config.url}/rest/v1/projects?select=*&order=updated_at.desc&limit=50`;
      const res = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!res.ok) {
        const text = await res.text();
        if (
          text.includes('PGRST205') ||
          text.includes('Could not find the table') ||
          text.includes('relation "public.projects" does not exist')
        ) {
          this.syncStatus.set('table_needed');
          this.errorMessage.set('La tabla de proyectos aún no ha sido creada en la nube.');
          return [];
        }
        throw new Error(`Error del servicio en la nube (${res.status}): ${this.cleanErrorMessage(text)}`);
      }

      const data: CloudProjectRecord[] = await res.json();
      this.cloudProjects.set(data);
      this.syncStatus.set('synced');
      this.lastSyncTime.set(new Date());
      this.errorMessage.set(null);
      return data;
    } catch (err: unknown) {
      console.warn('Cloud projects fetch failed:', err);
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (rawMsg.includes('PGRST205') || rawMsg.includes('Could not find the table')) {
        this.syncStatus.set('table_needed');
      } else {
        const cleanMsg = this.cleanErrorMessage(rawMsg);
        this.syncStatus.set('error');
        this.errorMessage.set(cleanMsg);
      }
      return [];
    }
  }

  /**
   * Consulta un único proyecto por su ID cuando se requiere cargar bajo demanda.
   */
  async getProjectById(id: string): Promise<CloudProjectRecord | null> {
    if (!this.isBrowser) return null;
    try {
      const url = `${this.config.url}/rest/v1/projects?id=eq.${encodeURIComponent(id)}&select=*&limit=1`;
      const res = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });
      if (!res.ok) return null;
      const rows: CloudProjectRecord[] = await res.json();
      return rows[0] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Guarda o actualiza (Upsert) un proyecto en Supabase.
   * OPTIMIZACIÓN FREE TIER: En lugar de llamar a `refreshProjects()` después de guardar
   * (lo que descargaría toda la base de datos otra vez), actualiza `cloudProjects` en memoria
   * con el registro devuelto por el POST, reduciendo a la mitad el consumo de ancho de banda.
   */
  async saveProject(project: Project): Promise<{ success: boolean; error?: string }> {
    if (!this.isBrowser) return { success: false, error: 'SSR mode' };
    this.syncStatus.set('syncing');

    const userId = this.currentUser()?.id;
    const recordPayload: Record<string, unknown> = {
      id: project.id,
      name: project.name || 'Sin Título',
      client_name: project.clientName || '',
      updated_at: new Date().toISOString(),
      modules_count: (project.groups && project.groups.length > 0) ? project.groups.length : (project.modules ? project.modules.length : 0),
      parts_count: project.parts ? project.parts.reduce((acc, p) => acc + (p.quantity || 1), 0) : 0,
      data: project
    };

    // Solo incluir user_id si hay un usuario autenticado para evitar error 400
    // en tablas donde la columna no existe o espera omitirse en anónimo
    if (userId) {
      recordPayload['user_id'] = userId;
    }

    try {
      // Upsert en Supabase usando el encabezado Prefer: resolution=merge-duplicates
      const url = `${this.config.url}/rest/v1/projects`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(recordPayload)
      });

      if (!res.ok) {
        const text = await res.text();
        if (text.includes('PGRST205') || text.includes('Could not find the table')) {
          this.syncStatus.set('table_needed');
          return { success: false, error: 'table_needed' };
        }

        // Si la tabla legacy en Supabase no tiene aún la columna user_id en el schema cache (PGRST204 / HTTP 400),
        // reintentar de forma transparente omitiendo user_id para no bloquear el guardado del usuario
        if (recordPayload['user_id'] && (text.includes("'user_id'") || (text.includes('user_id') && text.includes('schema cache')) || text.includes('PGRST204'))) {
          delete recordPayload['user_id'];
          const retryRes = await fetch(url, {
            method: 'POST',
            headers: {
              ...this.headers,
              'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify(recordPayload)
          });

          if (retryRes.ok) {
            const savedRows: CloudProjectRecord[] = await retryRes.json();
            const fallbackRecord: CloudProjectRecord = {
              id: project.id,
              name: project.name || 'Sin Título',
              client_name: project.clientName || '',
              updated_at: recordPayload['updated_at'] as string,
              modules_count: recordPayload['modules_count'] as number,
              parts_count: recordPayload['parts_count'] as number,
              data: project
            };
            const savedRecord = savedRows[0] ?? fallbackRecord;

            this.cloudProjects.update(list => {
              const exists = list.some(item => item.id === savedRecord.id);
              if (exists) {
                return list.map(item => (item.id === savedRecord.id ? savedRecord : item));
              }
              return [savedRecord, ...list];
            });

            this.syncStatus.set('synced');
            this.lastSyncTime.set(new Date());
            this.errorMessage.set(null);
            return { success: true };
          } else {
            const retryText = await retryRes.text();
            throw new Error(`Error del servicio en la nube (${retryRes.status}): ${this.cleanErrorMessage(retryText)}`);
          }
        }

        throw new Error(`Error del servicio en la nube (${res.status}): ${this.cleanErrorMessage(text)}`);
      }

      const savedRows: CloudProjectRecord[] = await res.json();
      const fallbackRecord: CloudProjectRecord = {
        id: project.id,
        name: project.name || 'Sin Título',
        client_name: project.clientName || '',
        updated_at: recordPayload['updated_at'] as string,
        modules_count: recordPayload['modules_count'] as number,
        parts_count: recordPayload['parts_count'] as number,
        user_id: userId || null,
        data: project
      };
      const savedRecord = savedRows[0] ?? fallbackRecord;

      // Actualizar estado local en memoria sin re-descargar toda la tabla
      this.cloudProjects.update(list => {
        const exists = list.some(item => item.id === savedRecord.id);
        if (exists) {
          return list.map(item => (item.id === savedRecord.id ? savedRecord : item));
        }
        return [savedRecord, ...list];
      });

      this.syncStatus.set('synced');
      this.lastSyncTime.set(new Date());
      this.errorMessage.set(null);
      return { success: true };
    } catch (err: unknown) {
      console.warn('Cloud save failed:', err);
      const rawMsg = err instanceof Error ? err.message : String(err);
      if (rawMsg.includes('PGRST205') || rawMsg.includes('Could not find the table')) {
        this.syncStatus.set('table_needed');
        return { success: false, error: 'table_needed' };
      }
      const cleanMsg = this.cleanErrorMessage(rawMsg);
      this.syncStatus.set('error');
      this.errorMessage.set(cleanMsg);
      return { success: false, error: cleanMsg };
    }
  }

  /**
   * Sanitiza mensajes de error técnicos para cumplir con la regla de Privacidad de Infraestructura,
   * evitando exponer "Supabase", "PostgreSQL", "PGRST...", detalles de base de datos o UUIDs al usuario.
   */
  cleanErrorMessage(raw: string): string {
    if (!raw) return 'Error desconocido al conectar con el servicio en la nube.';
    let cleaned = raw;
    if (cleaned.includes('PGRST204') || (cleaned.includes('user_id') && cleaned.includes('schema cache'))) {
      return 'La base de datos en la nube requiere sincronizar la estructura de proyectos.';
    }
    if (cleaned.includes('PGRST205') || cleaned.includes('Could not find the table') || cleaned.includes('relation "public.projects" does not exist')) {
      return 'La tabla de proyectos no ha sido inicializada en la nube.';
    }
    try {
      if (cleaned.trim().startsWith('{') && cleaned.trim().endsWith('}')) {
        const parsed = JSON.parse(cleaned);
        if (parsed.message) {
          cleaned = String(parsed.message);
        }
      }
    } catch {
      // no-op
    }
    cleaned = cleaned.replace(/Supabase/gi, 'Servicio en la nube');
    cleaned = cleaned.replace(/PostgreSQL|Postgres/gi, 'Base de datos');
    return cleaned;
  }

  /**
   * Alias de conveniencia para saveProject en la nube
   */
  async saveProjectCloud(project: Project): Promise<{ success: boolean; error?: string }> {
    return this.saveProject(project);
  }

  /**
   * Elimina un proyecto de Supabase por su ID y lo retira inmediatamente del signal local.
   */
  async deleteProject(id: string): Promise<boolean> {
    if (!this.isBrowser) return false;
    try {
      const url = `${this.config.url}/rest/v1/projects?id=eq.${encodeURIComponent(id)}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: this.headers
      });
      if (res.ok) {
        this.cloudProjects.update(list => list.filter(p => p.id !== id));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting from Supabase:', err);
      return false;
    }
  }

  // ==========================================
  // OPERACIONES DE FEEDBACK, BUGS, SOPORTE Y TESTIMONIOS
  // ==========================================

  /**
   * Envía un reporte de bug, solicitud de función, consulta de soporte o testimonio a Supabase.
   * Si es un testimonio calificado con 4 o 5 estrellas con display público, el trigger de PostgreSQL
   * lo auto-aprueba automáticamente. Maneja de forma segura las políticas RLS para anon y authenticated,
   * evitando el error 42501 al no solicitar RETURNING * en registros donde el usuario anónimo no tiene SELECT.
   */
  async submitFeedback(payload: CreateFeedbackPayload): Promise<{ success: boolean; data?: UserFeedbackRecord; error?: string }> {
    if (!this.isBrowser) return { success: false, error: 'SSR mode' };

    const userId = this.currentUser()?.id || null;
    const isTestimonial = payload.category === 'testimonial';
    const clientUuid = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : undefined;

    const ratingVal = isTestimonial ? (payload.rating ?? 5) : null;
    const allowPublic = isTestimonial ? !!payload.allow_public_display : false;
    const isAutoApprovedCandidate = isTestimonial && allowPublic && (ratingVal ?? 0) >= 4;

    const record = {
      ...(clientUuid ? { id: clientUuid } : {}),
      user_id: userId,
      category: payload.category,
      title: payload.title?.trim() || null,
      message: payload.message.trim(),
      contact_email: payload.contact_email?.trim() || (this.currentUser()?.email || null),
      target_module: !isTestimonial ? (payload.target_module || 'general') : null,
      severity_or_priority: !isTestimonial ? (payload.severity_or_priority || 'medium') : null,
      rating: ratingVal,
      author_name: isTestimonial ? (payload.author_name?.trim() || null) : null,
      author_role: isTestimonial ? (payload.author_role?.trim() || null) : null,
      author_location: isTestimonial ? (payload.author_location?.trim() || null) : null,
      allow_public_display: allowPublic,
      app_version: 'v3.0.0',
      app_language: (payload.metadata?.['language'] as string) || 'es',
      metadata: payload.metadata || {},
      status: 'open' as const
    };

    // Solo se puede solicitar .select() / return=representation si RLS permite SELECT post-inserción:
    // 1. Usuarios autenticados (auth.uid() = user_id)
    // 2. Testimonios públicos auto-aprobados (category='testimonial' AND allow_public_display=true AND is_approved_public=true)
    const canSelectPostInsert = Boolean(userId || isAutoApprovedCandidate);

    try {
      if (this.client) {
        if (canSelectPostInsert) {
          const { data, error } = await this.client
            .from('user_feedback')
            .insert(record)
            .select()
            .maybeSingle();

          if (error) {
            // Si falla por RLS SELECT (ej. desincronización de token o trigger), reintentar inserción minimal
            if (error.code === '42501' || error.message?.includes('policy') || error.code === 'PGRST116') {
              const { error: minError } = await this.client.from('user_feedback').insert(record);
              if (minError) return { success: false, error: minError.message };
            } else {
              return { success: false, error: error.message };
            }
          } else if (data) {
            return { success: true, data: data as UserFeedbackRecord };
          }
        } else {
          // Inserción minimal sin RETURNING para evitar error RLS 42501 en usuarios anónimos
          const { error } = await this.client
            .from('user_feedback')
            .insert(record);

          if (error) {
            return { success: false, error: error.message };
          }
        }

        const fallbackData: UserFeedbackRecord = {
          id: clientUuid || 'feedback-' + Date.now(),
          ...record,
          is_approved_public: isAutoApprovedCandidate,
          created_at: new Date().toISOString()
        };
        return { success: true, data: fallbackData };
      } else {
        const fetchHeaders = {
          ...this.headers,
          'Prefer': canSelectPostInsert ? 'return=representation' : 'return=minimal'
        };

        const res = await fetch(`${this.config.url}/rest/v1/user_feedback`, {
          method: 'POST',
          headers: fetchHeaders,
          body: JSON.stringify(record)
        });

        if (!res.ok) {
          const errText = await res.text();
          return { success: false, error: `Supabase Error (${res.status}): ${errText}` };
        }

        if (canSelectPostInsert) {
          try {
            const data: UserFeedbackRecord[] = await res.json();
            if (data && data.length > 0) {
              return { success: true, data: data[0] };
            }
          } catch {
            // PostgREST respondió sin cuerpo
          }
        }

        const fallbackData: UserFeedbackRecord = {
          id: clientUuid || 'feedback-' + Date.now(),
          ...record,
          is_approved_public: isAutoApprovedCandidate,
          created_at: new Date().toISOString()
        };
        return { success: true, data: fallbackData };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  }

  /**
   * Obtiene el historial de envíos de feedback realizados por el usuario autenticado.
   */
  async getMyFeedback(): Promise<UserFeedbackRecord[]> {
    if (!this.isBrowser) return [];
    const user = this.currentUser();
    if (!user) return [];

    try {
      if (this.client) {
        const { data, error } = await this.client
          .from('user_feedback')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (error) return [];
        return (data || []) as UserFeedbackRecord[];
      } else {
        const url = `${this.config.url}/rest/v1/user_feedback?user_id=eq.${encodeURIComponent(user.id)}&order=created_at.desc&limit=20`;
        const res = await fetch(url, {
          method: 'GET',
          headers: this.headers
        });
        if (!res.ok) return [];
        return await res.json();
      }
    } catch {
      return [];
    }
  }

  /**
   * Consulta testimonios públicos aprobados por la comunidad (lectura permitida por RLS a anónimos y autenticados).
   */
  async getPublicApprovedTestimonials(limit = 10): Promise<UserFeedbackRecord[]> {
    if (!this.isBrowser) return [];

    try {
      if (this.client) {
        const { data, error } = await this.client
          .from('user_feedback')
          .select('*')
          .eq('category', 'testimonial')
          .eq('allow_public_display', true)
          .eq('is_approved_public', true)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) return [];
        return (data || []) as UserFeedbackRecord[];
      } else {
        const url = `${this.config.url}/rest/v1/user_feedback?category=eq.testimonial&allow_public_display=eq.true&is_approved_public=eq.true&order=created_at.desc&limit=${limit}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: this.headers
        });
        if (!res.ok) return [];
        return await res.json();
      }
    } catch {
      return [];
    }
  }

  /**
   * Consulta pública de testimonios comunitarios de 4 y 5 estrellas para la Landing Page.
   */
  async getPublicTestimonials(limit = 10): Promise<UserFeedbackRecord[]> {
    return this.getPublicApprovedTestimonials(limit);
  }

  /**
   * Devuelve el script SQL de configuración para copiarlo desde la interfaz si hace falta.
   */
  getSqlSetupScript(): string {
    return SUPABASE_SQL_SETUP;
  }
}