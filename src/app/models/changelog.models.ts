/**
 * Modelos de datos para el sistema de Novedades (Changelog) y Hoja de Ruta (Roadmap)
 * de Piezo3D Studio.
 */

export type ChangeType = 'feature' | 'improvement' | 'fix' | 'cad';

export interface ReleaseChange {
  type: ChangeType;
  title: string;
  description: string;
  tag?: string;
}

export interface ReleaseVersion {
  version: string;
  name: string;
  releaseDate: string;
  isCurrent?: boolean;
  summary: string;
  highlights: string[];
  changes: ReleaseChange[];
}

export type RoadmapStatus = 'in_progress' | 'planned' | 'evaluating';

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  category: string;
  targetTimeline?: string;
  badge?: string;
  progressPercent?: number;
}
