export type CadToolType =
  | 'select'
  | 'push_pull'
  | 'move'
  | 'measure'
  | 'protractor'
  | 'rotate_90'
  | 'draw_line'
  | 'draw_rect_face'
  | 'draw_arc'
  | 'draw_rect'
  | 'draw_circle'
  | 'draw_freehand';

/**
 * Guía de referencia auxiliar (punto '+' o línea punteada infinita/proyectada)
 */
export interface CadGuide {
  id: string;
  type: 'point' | 'line' | 'angle';
  // Posición mundial del punto auxiliar (+)
  origin: { x: number; y: number; z: number };
  // Vector director normalizado en el espacio 3D para líneas guía
  direction?: { x: number; y: number; z: number };
  // Ángulo en grados si fue generada con el transportador
  angleDeg?: number;
  // Distancia paramétrica si se trazó con offset desde una arista
  offsetDistance?: number;
  // ID de la pieza sobre la cual se trazó
  partId?: string;
  // Normal de la cara sobre la cual se trazó (para proyectar en el plano correcto)
  faceNormal?: { x: number; y: number; z: number };
  createdAt: number;
}

/**
 * Información de la cara impactada por el cursor (cara ancha o canto)
 */
export interface CadHoveredFace {
  partId: string;
  faceIndex: number; // 0..5
  // Normal en coordenadas mundiales (ej. [0, 1, 0] para cara superior, [1, 0, 0] para canto lateral)
  worldNormal: { x: number; y: number; z: number };
  // Punto mundial del impacto
  worldPoint: { x: number; y: number; z: number };
  // Coordenadas 2D locales proyectadas en el plano de la cara (u, v) en milímetros
  localU: number;
  localV: number;
  faceWidth: number;
  faceHeight: number;
  isEdgeFace: boolean; // true si es el canto / espesor (15 o 18 mm), false si es la cara ancha
}

/**
 * Sub-región resultante de la partición de una cara por una línea divisoria, rectángulo o arco
 */
export interface CadFacePartition {
  partId: string;
  faceNormal: { x: number; y: number; z: number };
  // Polígono 2D de la región principal restante
  mainPolygon: { u: number; v: number }[];
  // Polígono 2D de la región recortada / esquina
  cutoutPolygon: { u: number; v: number }[];
  // Tipo de corte que generó la partición
  cutType: 'line_cut' | 'rect_notch' | 'arc_cut';
  // Esquina afectada para sincronización con PartCornerCutConfig
  corner?: 'front_right' | 'front_left' | 'back_right' | 'back_left' | 'both_front' | 'all';
  // Medidas estimadas del corte
  cutDimensions: {
    width: number;
    height: number;
    areaMm2: number;
    radius?: number;
  };
  // Coordenadas mundiales de los vértices para renderizar el sombreado 3D interactivo
  cutoutWorldVertices: { x: number; y: number; z: number }[];
}
