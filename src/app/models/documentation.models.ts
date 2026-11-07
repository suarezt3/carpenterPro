/**
 * Modelos de datos fuertemente tipados para el Centro de Ayuda y Manual Interactivo de CarpenterPro.
 */

export type DocCategoryType =
  | 'all'
  | 'modulos_piezas'
  | 'cotas_luz'
  | 'herramientas_3d'
  | 'mecanizados'
  | 'optimizador'
  | 'atajos';

export interface DocCategory {
  id: DocCategoryType | string;
  label: string;
  icon: string;
  badge?: string;
}

export interface DocTechnicalDetail {
  label: string;
  value: string;
}

export interface DocStep {
  step: number;
  title: string;
  description: string;
  detail?: string;
}

export interface DocArticle {
  id: string;
  category: DocCategoryType | string;
  title: string;
  shortDesc: string;
  icon: string;
  iconColor: string;
  badge?: string;
  steps: string[];
  tips: string[];
  technicalDetails?: DocTechnicalDetail[];
}
