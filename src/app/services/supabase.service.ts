import { Injectable, PLATFORM_ID, computed, DestroyRef, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { Project } from '../models/melamine.models';

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
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client_name TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  modules_count INTEGER DEFAULT 0,
  parts_count INTEGER DEFAULT 0,
  data JSONB NOT NULL
);

-- Asegurar columna user_id e índices si la tabla ya existía
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
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

-- Políticas compatibles con proyectos propios (auth.uid() = user_id) y modo taller local (user_id IS NULL)
CREATE POLICY "projects_select_policy" ON public.projects
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "projects_insert_policy" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "projects_update_policy" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "projects_delete_policy" ON public.projects
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);
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
          this.errorMessage.set('La tabla "projects" aún no ha sido creada en tu Supabase.');
          return [];
        }
        throw new Error(`Error Supabase (${res.status}): ${text}`);
      }

      const data: CloudProjectRecord[] = await res.json();
      this.cloudProjects.set(data);
      this.syncStatus.set('synced');
      this.lastSyncTime.set(new Date());
      this.errorMessage.set(null);
      return data;
    } catch (err: unknown) {
      console.warn('Supabase fetch failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('PGRST205') || msg.includes('Could not find the table')) {
        this.syncStatus.set('table_needed');
      } else {
        this.syncStatus.set('error');
        this.errorMessage.set(msg);
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
    const record: CloudProjectRecord = {
      id: project.id,
      name: project.name || 'Sin Título',
      client_name: project.clientName || '',
      updated_at: new Date().toISOString(),
      modules_count: project.modules ? project.modules.length : 0,
      parts_count: project.parts ? project.parts.reduce((acc, p) => acc + (p.quantity || 1), 0) : 0,
      ...(userId ? { user_id: userId } : {}),
      data: project
    };

    try {
      // Upsert en Supabase usando el encabezado Prefer: resolution=merge-duplicates
      const url = `${this.config.url}/rest/v1/projects`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(record)
      });

      if (!res.ok) {
        const text = await res.text();
        if (text.includes('PGRST205') || text.includes('Could not find the table')) {
          this.syncStatus.set('table_needed');
          return { success: false, error: 'table_needed' };
        }
        throw new Error(`Supabase Error (${res.status}): ${text}`);
      }

      const savedRows: CloudProjectRecord[] = await res.json();
      const savedRecord = savedRows[0] ?? record;

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
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('PGRST205') || msg.includes('Could not find the table')) {
        this.syncStatus.set('table_needed');
      } else {
        this.syncStatus.set('error');
        this.errorMessage.set(msg);
      }
      return { success: false, error: msg };
    }
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

  /**
   * Devuelve el script SQL de configuración para copiarlo desde la interfaz si hace falta.
   */
  getSqlSetupScript(): string {
    return SUPABASE_SQL_SETUP;
  }
}