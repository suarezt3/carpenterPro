/**
 * Modelos de datos y tipado estricto para la sección de Soporte, Reporte de Bugs,
 * Solicitud de Funciones y Testimonios con integración directa a Supabase.
 */

export type FeedbackCategory = 'bug' | 'feature' | 'support' | 'testimonial';

export type TargetModule =
  | 'designer_3d'
  | 'parts_list'
  | 'optimizer_2d'
  | 'budget'
  | 'labels'
  | 'exports'
  | 'general';

export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';

export type FeedbackStatus = 'open' | 'in_review' | 'resolved' | 'archived';

export interface UserFeedbackRecord {
  id: string;
  user_id?: string | null;
  category: FeedbackCategory;
  title?: string | null;
  message: string;
  contact_email?: string | null;
  target_module?: TargetModule | null;
  severity_or_priority?: FeedbackSeverity | null;
  rating?: number | null;
  author_name?: string | null;
  author_role?: string | null;
  author_location?: string | null;
  allow_public_display: boolean;
  is_approved_public: boolean;
  app_version: string;
  app_language: string;
  metadata: Record<string, unknown>;
  status: FeedbackStatus;
  created_at: string;
}

export interface CreateFeedbackPayload {
  category: FeedbackCategory;
  title?: string;
  message: string;
  contact_email?: string;
  target_module?: TargetModule;
  severity_or_priority?: FeedbackSeverity;
  rating?: number;
  author_name?: string;
  author_role?: string;
  author_location?: string;
  allow_public_display?: boolean;
  metadata?: Record<string, unknown>;
}

export interface FeedbackCategoryOption {
  id: FeedbackCategory;
  labelKey: string;
  descKey: string;
  iconName: string;
}

export interface FeedbackModuleOption {
  id: TargetModule;
  labelKey: string;
}

export interface FeedbackSeverityOption {
  id: FeedbackSeverity;
  labelKey: string;
  badgeClass: string;
}
