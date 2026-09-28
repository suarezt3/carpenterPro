import { Injectable, signal } from '@angular/core';
import { Project } from '../models/melamine.models';

export interface CloudProjectRecord {
  id: string;
  name: string;
  client_name?: string;
  updated_at: string;
  modules_count: number;
  parts_count: number;
  data: Project;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'table_needed' | 'error';

export const SUPABASE_CONFIG = {
  url: 'https://umdcxcjrdyckpxomxlmi.supabase.co',
  publishableKey: 'sb_publishable_FYydWGY0juW6ajW5tLiQQQ_Stz1tMVD'
};

export const SUPABASE_SQL_SETUP = `-- ==========================================
-- SCRIPT DE INICIALIZACIÓN PARA SUPABASE
-- Pega este código en Supabase > SQL Editor y pulsa RUN
-- ==========================================

CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client_name TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  modules_count INTEGER DEFAULT 0,
  parts_count INTEGER DEFAULT 0,
  data JSONB NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Permitir lectura, creación y actualización pública con la clave del proyecto
DROP POLICY IF EXISTS "Permitir acceso publico a proyectos" ON public.projects;
CREATE POLICY "Permitir acceso publico a proyectos"
ON public.projects
FOR ALL
USING (true)
WITH CHECK (true);
`;

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  readonly config = SUPABASE_CONFIG;
  readonly cloudProjects = signal<CloudProjectRecord[]>([]);
  readonly syncStatus = signal<SyncStatus>('idle');
  readonly lastSyncTime = signal<Date | null>(null);
  readonly errorMessage = signal<string | null>(null);

  private get headers(): Record<string, string> {
    return {
      'apikey': this.config.publishableKey,
      'Authorization': `Bearer ${this.config.publishableKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  }

  constructor() {
    this.refreshProjects();
  }

  async refreshProjects(): Promise<CloudProjectRecord[]> {
    this.syncStatus.set('syncing');
    try {
      const url = `${this.config.url}/rest/v1/projects?select=*&order=updated_at.desc`;
      const res = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!res.ok) {
        const text = await res.text();
        if (text.includes('PGRST205') || text.includes('Could not find the table') || text.includes('relation "public.projects" does not exist')) {
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

  async saveProject(project: Project): Promise<{ success: boolean; error?: string }> {
    this.syncStatus.set('syncing');
    const record: CloudProjectRecord = {
      id: project.id,
      name: project.name || 'Sin Título',
      client_name: project.clientName || '',
      updated_at: new Date().toISOString(),
      modules_count: project.modules ? project.modules.length : 0,
      parts_count: project.parts ? project.parts.reduce((acc, p) => acc + (p.quantity || 1), 0) : 0,
      data: project
    };

    try {
      // Upsert into Supabase (resolution=merge-duplicates)
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

      this.syncStatus.set('synced');
      this.lastSyncTime.set(new Date());
      this.errorMessage.set(null);
      await this.refreshProjects();
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

  async deleteProject(id: string): Promise<boolean> {
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

  getSqlSetupScript(): string {
    return SUPABASE_SQL_SETUP;
  }
}
