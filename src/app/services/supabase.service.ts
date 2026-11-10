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

export type UserRole = 'user' | 'super_admin';
export type UserPlan = 'free' | 'pro' | 'industrial';
export type BillingCycle = 'monthly' | 'annual';
export type SubscriptionStatus = 'free' | 'active' | 'on_trial' | 'past_due' | 'cancelled' | 'expired';

/**
 * Perfil de usuario sincronizado con `public.user_profiles` y `auth.users`.
 */
export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  plan: UserPlan;
  billing_cycle?: BillingCycle | null;
  subscription_status?: SubscriptionStatus | null;
  subscription_id?: string | null;
  customer_id?: string | null;
  variant_id?: string | null;
  current_period_end?: string | null;
  customer_portal_url?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Registro de factura o recibo de suscripción sincronizado con `public.subscription_invoices`.
 */
export interface SubscriptionInvoice {
  id: string;
  user_id: string;
  subscription_id?: string | null;
  plan: UserPlan;
  billing_cycle: BillingCycle;
  amount_usd: number;
  status: string;
  invoice_url?: string | null;
  created_at: string;
}

export interface SignUpEmailPayload {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
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

/**
 * Script SQL para la tabla `public.user_profiles` con RLS estricto y sincronización automática con `auth.users`.
 */
export const SUPABASE_USER_PROFILES_SQL_SETUP = `-- ==========================================
-- TABLA DE PERFILES DE USUARIO CON TRIGGER AUTOMÁTICO Y RLS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'super_admin')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'industrial')),
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  subscription_status TEXT DEFAULT 'free' CHECK (subscription_status IN ('free', 'active', 'on_trial', 'past_due', 'cancelled', 'expired')),
  subscription_id TEXT,
  customer_id TEXT,
  variant_id TEXT,
  current_period_end TIMESTAMPTZ,
  customer_portal_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'industrial')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  amount_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'paid',
  invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_user_id ON public.subscription_invoices(user_id, created_at DESC);
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own invoices" ON public.subscription_invoices;
CREATE POLICY "Users can view own invoices"
  ON public.subscription_invoices
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

CREATE OR REPLACE FUNCTION public.fn_protect_user_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Modifying profile id is not allowed' USING ERRCODE = '42501';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Modifying user role is not allowed' USING ERRCODE = '42501';
    END IF;
    IF NEW.plan IS DISTINCT FROM OLD.plan THEN
      RAISE EXCEPTION 'Modifying subscription plan directly is not allowed' USING ERRCODE = '42501';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_profile_fields ON public.user_profiles;
CREATE TRIGGER trg_protect_user_profile_fields
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protect_user_profile_fields();

CREATE OR REPLACE FUNCTION public.fn_handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
BEGIN
  BEGIN
    v_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', '');
    v_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', '');
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '');

    IF v_first_name = '' AND v_full_name <> '' THEN
      v_first_name := split_part(trim(v_full_name), ' ', 1);
      v_last_name := trim(substr(trim(v_full_name), length(v_first_name) + 1));
    END IF;

    INSERT INTO public.user_profiles (id, email, first_name, last_name, role, plan)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NULLIF(v_first_name, ''), 'Usuario'),
      COALESCE(v_last_name, ''),
      'user',
      'free'
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      first_name = CASE WHEN public.user_profiles.first_name = '' THEN EXCLUDED.first_name ELSE public.user_profiles.first_name END,
      updated_at = now();
  EXCEPTION
    WHEN OTHERS THEN
      -- Resiliencia absoluta: un error en perfiles jamás bloquea el alta del usuario en auth.users
      RETURN NEW;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_handle_new_auth_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_handle_new_auth_user();
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

  // Signals reactivos de sesión y perfil para toda la aplicación
  readonly session = signal<Session | null>(null);
  readonly currentUser = signal<User | null>(null);
  readonly userProfile = signal<UserProfile | null>(null);
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isAuthLoading = signal<boolean>(true);
  readonly isPasswordRecoveryMode = signal<boolean>(false);

  /**
   * Construye los encabezados HTTP para las peticiones REST.
   * Si el usuario inició sesión, envía su token JWT personal (`session.access_token`)
   * para que la base de datos valide su identidad en las políticas RLS (`auth.uid()`).
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
    // Solo inicializamos cliente y cargamos proyectos si estamos en el navegador (evita fallos en SSR)
    if (this.isBrowser) {
      this.initSupabaseClient();
      void this.refreshProjects();
    } else {
      this.isAuthLoading.set(false);
    }
  }

  private authInitPromise: Promise<void> | null = null;

  /**
   * Inicializa el cliente oficial y escucha cambios de sesión en tiempo real
   * (login, logout, renovación automática del token JWT y recuperación de contraseña).
   */
  private initSupabaseClient(): void {
    try {
      if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
        this.isPasswordRecoveryMode.set(true);
      }

      let initialAuthProjectsSynced = false;

      this.client = createClient(this.config.url, this.config.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });

      // Recuperar sesión activa guardada en localStorage al abrir la aplicación
      this.authInitPromise = this.client.auth.getSession()
        .then(async ({ data }) => {
          if (data?.session?.user) {
            this.session.set(data.session);
            this.currentUser.set(data.session.user);
            this.userProfile.set(this.buildFallbackProfile(data.session.user));
            if (!initialAuthProjectsSynced) {
              initialAuthProjectsSynced = true;
              void this.refreshProjects();
            }
            await this.loadUserProfile(data.session.user);
          }
          this.isAuthLoading.set(false);
        })
        .catch(() => {
          this.isAuthLoading.set(false);
        });

      // Suscribirse a cambios de estado de autenticación en tiempo real
      const { data: authListener } = this.client.auth.onAuthStateChange((event, newSession) => {
        if (event === 'PASSWORD_RECOVERY') {
          this.isPasswordRecoveryMode.set(true);
        }

        this.session.set(newSession);
        const user = newSession?.user ?? null;
        this.currentUser.set(user);

        if (user) {
          this.userProfile.set(this.buildFallbackProfile(user));
          const shouldRefreshProjects =
            event === 'SIGNED_IN' || (event === 'INITIAL_SESSION' && !initialAuthProjectsSynced);
          if (shouldRefreshProjects) {
            initialAuthProjectsSynced = true;
          }
          // Ejecutar consultas secundarias fuera del callback síncrono para evitar bloqueo del lock interno de sesión
          setTimeout(() => {
            void this.loadUserProfile(user);
            if (shouldRefreshProjects) {
              void this.refreshProjects();
            }
          }, 0);
        } else {
          this.userProfile.set(null);
          if (event === 'SIGNED_OUT') {
            this.cloudProjects.set([]);
            setTimeout(() => {
              void this.refreshProjects();
            }, 0);
          }
        }

        this.isAuthLoading.set(false);
      });

      // Evitar fugas de memoria cancelando la suscripción al destruir el servicio
      this.destroyRef.onDestroy(() => {
        authListener.subscription.unsubscribe();
      });
    } catch (err) {
      console.warn('Auth client init warning:', err);
      this.isAuthLoading.set(false);
    }
  }

  /**
   * Construye un perfil en memoria a partir de `user_metadata` como respaldo inmediato
   * mientras se sincroniza o si aún no está disponible el registro en `public.user_profiles`.
   */
  buildFallbackProfile(user: User): UserProfile {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    let firstName = typeof meta['first_name'] === 'string' ? meta['first_name'].trim() : '';
    let lastName = typeof meta['last_name'] === 'string' ? meta['last_name'].trim() : '';
    const fullName = typeof meta['full_name'] === 'string'
      ? meta['full_name'].trim()
      : (typeof meta['name'] === 'string' ? meta['name'].trim() : '');

    if (!firstName && fullName) {
      const parts = fullName.split(/\s+/);
      firstName = parts[0] ?? '';
      lastName = parts.slice(1).join(' ').trim();
    }

    if (!firstName && user.email) {
      firstName = user.email.split('@')[0] || 'Usuario';
    }

    const nowIso = new Date().toISOString();
    return {
      id: user.id,
      email: user.email ?? '',
      first_name: firstName || 'Usuario',
      last_name: lastName,
      role: 'user',
      plan: 'free',
      billing_cycle: 'monthly',
      subscription_status: 'free',
      subscription_id: null,
      customer_id: null,
      variant_id: null,
      current_period_end: null,
      customer_portal_url: null,
      created_at: user.created_at || nowIso,
      updated_at: user.updated_at || user.created_at || nowIso
    };
  }

  /**
   * Carga el perfil del usuario desde `public.user_profiles` respetando RLS (`auth.uid() = id`).
   */
  async loadUserProfile(user?: User | null): Promise<UserProfile | null> {
    const targetUser = user ?? this.currentUser();
    if (!targetUser) {
      this.userProfile.set(null);
      return null;
    }

    const fallback = this.buildFallbackProfile(targetUser);
    if (!this.isBrowser || !this.client) {
      this.userProfile.set(fallback);
      return fallback;
    }

    try {
      const { data, error } = await this.client
        .from('user_profiles')
        .select('id, email, first_name, last_name, role, plan, billing_cycle, subscription_status, subscription_id, customer_id, variant_id, current_period_end, customer_portal_url, created_at, updated_at')
        .eq('id', targetUser.id)
        .maybeSingle();

      if (!error && data) {
        const record = data as Record<string, unknown>;
        const rawCycle = record['billing_cycle'];
        const rawStatus = record['subscription_status'];
        const validStatuses: SubscriptionStatus[] = ['free', 'active', 'on_trial', 'past_due', 'cancelled', 'expired'];
        const parsedStatus: SubscriptionStatus = typeof rawStatus === 'string' && validStatuses.includes(rawStatus as SubscriptionStatus)
          ? (rawStatus as SubscriptionStatus)
          : (record['plan'] === 'pro' || record['plan'] === 'industrial' ? 'active' : 'free');

        const profile: UserProfile = {
          id: String(record['id'] ?? targetUser.id),
          email: String(record['email'] ?? targetUser.email ?? ''),
          first_name: String(record['first_name'] || fallback.first_name),
          last_name: String(record['last_name'] ?? fallback.last_name),
          role: record['role'] === 'super_admin' ? 'super_admin' : 'user',
          plan: record['plan'] === 'pro' || record['plan'] === 'industrial' ? record['plan'] : 'free',
          billing_cycle: rawCycle === 'annual' ? 'annual' : 'monthly',
          subscription_status: parsedStatus,
          subscription_id: record['subscription_id'] ? String(record['subscription_id']) : null,
          customer_id: record['customer_id'] ? String(record['customer_id']) : null,
          variant_id: record['variant_id'] ? String(record['variant_id']) : null,
          current_period_end: record['current_period_end'] ? String(record['current_period_end']) : null,
          customer_portal_url: record['customer_portal_url'] ? String(record['customer_portal_url']) : null,
          created_at: String(record['created_at'] ?? fallback.created_at),
          updated_at: String(record['updated_at'] ?? fallback.updated_at)
        };
        this.userProfile.set(profile);
        return profile;
      }
    } catch {
      // Fallback silencioso a metadatos locales de sesión
    }

    this.userProfile.set(fallback);
    return fallback;
  }

  /**
   * Recarga el perfil del usuario desde la nube (por ejemplo, tras completar un pago en el Checkout Overlay).
   */
  async refreshUserProfile(): Promise<UserProfile | null> {
    return this.loadUserProfile(this.currentUser());
  }

  /**
   * Consulta el historial real de facturas de suscripción del usuario autenticado en `public.subscription_invoices`.
   */
  async getSubscriptionInvoices(limit = 20): Promise<SubscriptionInvoice[]> {
    if (!this.isBrowser) return [];
    const user = this.currentUser();
    if (!user || !this.client) return [];

    try {
      const { data, error } = await this.client
        .from('subscription_invoices')
        .select('id, user_id, subscription_id, plan, billing_cycle, amount_usd, status, invoice_url, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error || !Array.isArray(data)) {
        return [];
      }

      return data.map((row) => {
        const record = row as Record<string, unknown>;
        return {
          id: String(record['id'] ?? ''),
          user_id: String(record['user_id'] ?? user.id),
          subscription_id: record['subscription_id'] ? String(record['subscription_id']) : null,
          plan: record['plan'] === 'industrial' ? 'industrial' : (record['plan'] === 'pro' ? 'pro' : 'free'),
          billing_cycle: record['billing_cycle'] === 'annual' ? 'annual' : 'monthly',
          amount_usd: Number(record['amount_usd'] ?? 0),
          status: String(record['status'] ?? 'paid'),
          invoice_url: record['invoice_url'] ? String(record['invoice_url']) : null,
          created_at: String(record['created_at'] ?? new Date().toISOString())
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Actualiza el perfil de usuario (nombre y apellido) en `public.user_profiles`
   * respetando la política RLS (`auth.uid() = id`).
   * Al completarse con éxito, actualiza de inmediato la señal reactiva `userProfile`.
   */
  async updateUserProfile(updates: { first_name?: string; last_name?: string }): Promise<{ success: boolean; errorKey?: string }> {
    const user = this.currentUser();
    if (!user) {
      return { success: false, errorKey: 'account.profileUpdateNoUser' };
    }

    const trimmedFirstName = updates.first_name !== undefined ? updates.first_name.trim() : undefined;
    const trimmedLastName = updates.last_name !== undefined ? updates.last_name.trim() : undefined;
    const nowIso = new Date().toISOString();

    const payload: Record<string, unknown> = {
      updated_at: nowIso
    };
    if (trimmedFirstName !== undefined) {
      payload['first_name'] = trimmedFirstName;
    }
    if (trimmedLastName !== undefined) {
      payload['last_name'] = trimmedLastName;
    }

    if (this.isBrowser && this.client) {
      try {
        const { error } = await this.client
          .from('user_profiles')
          .update(payload)
          .eq('id', user.id);

        if (error) {
          return { success: false, errorKey: 'account.profileUpdateError' };
        }
      } catch {
        return { success: false, errorKey: 'account.profileUpdateError' };
      }
    }

    this.userProfile.update((current) => {
      const fallback = current ?? this.buildFallbackProfile(user);
      return {
        ...fallback,
        first_name: trimmedFirstName !== undefined ? trimmedFirstName : fallback.first_name,
        last_name: trimmedLastName !== undefined ? trimmedLastName : fallback.last_name,
        updated_at: nowIso
      };
    });

    return { success: true };
  }

  /**
   * Sincroniza la sesión activa (usado por guardias de navegación como `studioAccessGuard`
   * para asegurar que `currentUser` y `userProfile` estén listos al entrar al Estudio).
   */
  async syncAuthSession(): Promise<User | null> {
    if (!this.isBrowser || !this.client) {
      this.isAuthLoading.set(false);
      return this.currentUser();
    }

    try {
      const { data } = await this.client.auth.getSession();
      const activeSession = data?.session ?? null;
      this.session.set(activeSession);
      const user = activeSession?.user ?? null;
      this.currentUser.set(user);
      if (user) {
        if (!this.userProfile() || this.userProfile()?.id !== user.id) {
          await this.loadUserProfile(user);
        }
      } else {
        this.userProfile.set(null);
      }
      return user;
    } catch {
      return this.currentUser();
    } finally {
      this.isAuthLoading.set(false);
    }
  }

  /**
   * Espera a que termine de restaurarse la sesión inicial desde `localStorage` antes de evaluar guardias de ruta.
   */
  async waitForAuthReady(): Promise<User | null> {
    if (this.authInitPromise) {
      try {
        await this.authInitPromise;
      } catch {
        // Ignorar errores de inicialización y continuar con sincronización directa
      }
    }
    if (this.isAuthLoading() || !this.currentUser()) {
      return this.syncAuthSession();
    }
    return this.currentUser();
  }

  // ==========================================
  // MÉTODOS DE AUTENTICACIÓN Y TRADUCCIÓN DE ERRORES
  // ==========================================

  /**
   * Convierte cualquier error técnico del backend de autenticación en una clave `i18n` amigable,
   * garantizando privacidad total de infraestructura (cero mensajes crudos ni nombres de proveedores).
   */
  mapAuthErrorToKey(error: unknown): string {
    if (!error) return 'auth.errors.generic';

    const errObj = typeof error === 'object' ? (error as Record<string, unknown>) : {};
    const code = typeof errObj['code'] === 'string' ? errObj['code'].toLowerCase() : '';
    const status = typeof errObj['status'] === 'number' ? errObj['status'] : 0;
    const rawMsg = typeof errObj['message'] === 'string'
      ? errObj['message'].toLowerCase()
      : (error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase());

    if (
      code === 'invalid_credentials' ||
      rawMsg.includes('invalid login credentials') ||
      rawMsg.includes('invalid email or password')
    ) {
      return 'auth.errors.invalidCredentials';
    }

    if (code === 'email_not_confirmed' || rawMsg.includes('email not confirmed')) {
      return 'auth.errors.emailNotConfirmed';
    }

    if (
      code === 'user_already_exists' ||
      code === 'email_exists' ||
      rawMsg.includes('already registered') ||
      rawMsg.includes('already been registered') ||
      rawMsg.includes('user already exists')
    ) {
      return 'auth.errors.userAlreadyRegistered';
    }

    if (
      status === 429 ||
      code === 'over_email_send_rate_limit' ||
      code.includes('rate_limit') ||
      rawMsg.includes('rate limit') ||
      rawMsg.includes('over_email_send_rate_limit') ||
      rawMsg.includes('too many requests') ||
      rawMsg.includes('security purposes')
    ) {
      return 'auth.errors.rateLimitExceeded';
    }

    if (
      code === 'email_address_invalid' ||
      code === 'validation_failed' ||
      code === 'invalid_email' ||
      rawMsg.includes('email_address_invalid') ||
      rawMsg.includes('unable to validate email') ||
      rawMsg.includes('invalid email') ||
      rawMsg.includes('disposable') ||
      rawMsg.includes('valid email') ||
      rawMsg.includes('domain')
    ) {
      return 'auth.errors.invalidEmailDomain';
    }

    if (code === 'same_password' || rawMsg.includes('different from the old password')) {
      return 'auth.errors.samePassword';
    }

    if (code === 'weak_password' || rawMsg.includes('password should be')) {
      return 'auth.errors.weakPassword';
    }

    if (
      code === 'otp_expired' ||
      code === 'flow_state_expired' ||
      code === 'flow_state_not_found' ||
      code === 'bad_code_verifier' ||
      code === 'session_not_found' ||
      rawMsg.includes('auth session missing') ||
      rawMsg.includes('token has expired') ||
      rawMsg.includes('email link is invalid') ||
      (code === 'access_denied' && (rawMsg.includes('expired') || rawMsg.includes('invalid')))
    ) {
      return 'auth.errors.sessionExpired';
    }

    if (
      code === 'provider_disabled' ||
      rawMsg.includes('provider is not enabled') ||
      rawMsg.includes('unsupported provider')
    ) {
      return 'auth.errors.oauthUnavailable';
    }

    if (
      rawMsg.includes('failed to fetch') ||
      rawMsg.includes('networkerror') ||
      rawMsg.includes('network request failed')
    ) {
      return 'auth.errors.networkError';
    }

    return 'auth.errors.generic';
  }

  /**
   * Inicia sesión con correo electrónico y contraseña, actualiza sesión + perfil
   * y recarga los proyectos asociados a la cuenta.
   */
  async signInWithEmail(email: string, password: string): Promise<{ success: boolean; errorKey?: string }> {
    if (!this.client) {
      return { success: false, errorKey: 'auth.errors.serviceUnavailable' };
    }

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await this.client.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (error) {
        return { success: false, errorKey: this.mapAuthErrorToKey(error) };
      }

      this.session.set(data.session);
      this.currentUser.set(data.user);
      if (data.user) {
        await this.loadUserProfile(data.user);
      }
      await this.refreshProjects();
      return { success: true };
    } catch (err) {
      return { success: false, errorKey: this.mapAuthErrorToKey(err) };
    }
  }

  /**
   * Registra un nuevo usuario enviando `first_name`, `last_name` y `full_name` en `options.data`
   * para que el trigger automático cree su fila en `public.user_profiles`.
   */
  async signUpWithEmail(payload: SignUpEmailPayload): Promise<{
    success: boolean;
    needsEmailConfirmation?: boolean;
    messageKey?: string;
    errorKey?: string;
  }> {
    if (!this.client) {
      return { success: false, errorKey: 'auth.errors.serviceUnavailable' };
    }

    try {
      const normalizedEmail = payload.email.trim().toLowerCase();
      const cleanFirstName = payload.firstName.trim();
      const cleanLastName = (payload.lastName ?? '').trim();
      const fullName = [cleanFirstName, cleanLastName].filter(Boolean).join(' ');
      const emailRedirectTo = this.isBrowser && typeof window !== 'undefined'
        ? `${window.location.origin}/studio`
        : undefined;

      const { data, error } = await this.client.auth.signUp({
        email: normalizedEmail,
        password: payload.password,
        options: {
          ...(emailRedirectTo ? { emailRedirectTo } : {}),
          data: {
            first_name: cleanFirstName,
            last_name: cleanLastName,
            full_name: fullName
          }
        }
      });

      if (error) {
        return { success: false, errorKey: this.mapAuthErrorToKey(error) };
      }

      // Cuando la confirmación de correo está activa y el correo ya existe,
      // el proveedor devuelve un usuario con arreglo `identities` vacío.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { success: false, errorKey: 'auth.errors.userAlreadyRegistered' };
      }

      if (data.session && data.user) {
        this.session.set(data.session);
        this.currentUser.set(data.user);
        await this.loadUserProfile(data.user);
        await this.refreshProjects();
        return { success: true, needsEmailConfirmation: false };
      }

      // Usuario creado con confirmación de correo pendiente (data.session === null)
      return {
        success: true,
        needsEmailConfirmation: true,
        messageKey: 'auth.registerCheckEmail'
      };
    } catch (err) {
      return { success: false, errorKey: this.mapAuthErrorToKey(err) };
    }
  }

  /**
   * Inicia el flujo OAuth con Google redirigiendo al Estudio 3D (`/studio`) al completar.
   */
  async signInWithGoogle(): Promise<{ success: boolean; errorKey?: string }> {
    if (!this.client || !this.isBrowser || typeof window === 'undefined') {
      return { success: false, errorKey: 'auth.errors.serviceUnavailable' };
    }

    try {
      const { error } = await this.client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/studio`
        }
      });

      if (error) {
        return { success: false, errorKey: this.mapAuthErrorToKey(error) };
      }

      return { success: true };
    } catch (err) {
      return { success: false, errorKey: this.mapAuthErrorToKey(err) };
    }
  }

  /**
   * Envía un enlace seguro de restablecimiento de contraseña redirigiendo a `/auth?mode=reset`.
   */
  async sendPasswordResetEmail(email: string): Promise<{ success: boolean; errorKey?: string }> {
    if (!this.client) {
      return { success: false, errorKey: 'auth.errors.serviceUnavailable' };
    }

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const redirectTo = this.isBrowser && typeof window !== 'undefined'
        ? `${window.location.origin}/auth?mode=reset`
        : undefined;

      const { error } = await this.client.auth.resetPasswordForEmail(
        normalizedEmail,
        redirectTo ? { redirectTo } : undefined
      );

      if (error) {
        return { success: false, errorKey: this.mapAuthErrorToKey(error) };
      }

      return { success: true };
    } catch (err) {
      return { success: false, errorKey: this.mapAuthErrorToKey(err) };
    }
  }

  /**
   * Actualiza la contraseña del usuario autenticado (ej. tras abrir el enlace de recuperación).
   */
  async updateUserPassword(newPassword: string): Promise<{ success: boolean; errorKey?: string }> {
    if (!this.client) {
      return { success: false, errorKey: 'auth.errors.serviceUnavailable' };
    }

    try {
      const { data, error } = await this.client.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return { success: false, errorKey: this.mapAuthErrorToKey(error) };
      }

      this.isPasswordRecoveryMode.set(false);
      if (data.user) {
        this.currentUser.set(data.user);
        await this.loadUserProfile(data.user);
      }

      return { success: true };
    } catch (err) {
      return { success: false, errorKey: this.mapAuthErrorToKey(err) };
    }
  }

  /**
   * Cierra la sesión activa, limpia los signals de usuario y perfil y refresca proyectos.
   */
  async signOut(): Promise<void> {
    if (this.client) {
      try {
        await this.client.auth.signOut();
      } catch {
        // Garantizar limpieza local incluso si la red falla
      }
    }
    this.session.set(null);
    this.currentUser.set(null);
    this.userProfile.set(null);
    this.isPasswordRecoveryMode.set(false);
    this.cloudProjects.set([]);
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

    if (!this.currentUser() && this.isAuthLoading()) {
      await this.syncAuthSession();
    }

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
              if (minError) return { success: false, error: this.cleanErrorMessage(minError.message) };
            } else {
              return { success: false, error: this.cleanErrorMessage(error.message) };
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
            return { success: false, error: this.cleanErrorMessage(error.message) };
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
          return { success: false, error: this.cleanErrorMessage(errText) };
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
      return { success: false, error: this.cleanErrorMessage(msg) };
    }
  }

  /**
   * Obtiene el historial de envíos de feedback realizados por el usuario autenticado.
   */
  async getMyFeedback(): Promise<UserFeedbackRecord[]> {
    if (!this.isBrowser) return [];
    if (!this.currentUser() && this.isAuthLoading()) {
      await this.syncAuthSession();
    }
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