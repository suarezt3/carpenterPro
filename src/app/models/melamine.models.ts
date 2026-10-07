export type EdgeBandingType = 'none' | 'thin' | 'thick';

export type GrainDirection = 'length' | 'width' | 'none';

export interface PartEdges {
  l1: EdgeBandingType; // Largo superior / borde 1
  l2: EdgeBandingType; // Largo inferior / borde 2
  a1: EdgeBandingType; // Ancho izquierdo / borde 1
  a2: EdgeBandingType; // Ancho derecho / borde 2
}

export type PartOrientation = 'horizontal' | 'vertical_yz' | 'vertical_xy';

export type ComponentRole = 
  | 'top' 
  | 'bottom' 
  | 'side_left' 
  | 'side_right' 
  | 'divider' 
  | 'shelf' 
  | 'back' 
  | 'front'
  | 'door' 
  | 'drawer_front' 
  | 'plinth' 
  | 'tie'
  | 'free';

export type HandleType = 
  | 'bar_modern' 
  | 'bar_black' 
  | 'knob_round' 
  | 'knob_square' 
  | 'profile_gola' 
  | 'cup_vintage' 
  | 'none';

export type HandleFinish = 
  | 'brushed_steel' 
  | 'black' 
  | 'gold' 
  | 'chrome' 
  | 'white';

export type HingeType = 
  | 'straight'       // Bisagra Recta (Parche / Solapada total)
  | 'half_cranked'   // Bisagra Semicodo (Semiparche / Semisolapada)
  | 'full_cranked'   // Bisagra Codo (Interior / Embutida)
  | 'gas_piston'     // Pistón Elevable a Gas (Alacenas)
  | 'none';

export type SlideType = 
  | 'telescopic'     // Telescópica 45mm
  | 'soft_close'     // Telescópica con Cierre Suave
  | 'undermount'     // Corredera Oculta bajo fondo
  | 'telescopic_35'  // Telescópica Ligera 35mm
  | 'none';

export type OpeningDirection = 'left' | 'right' | 'top' | 'bottom';

export interface PartHardwareConfig {
  isMovable?: boolean;
  movableType?: 'door' | 'drawer' | 'none';
  handleType?: HandleType;
  handleFinish?: HandleFinish;
  handleLength?: number; // mm
  handlePosition?: 'vertical' | 'horizontal' | 'centered';
  hingeType?: HingeType;
  openingDirection?: OpeningDirection;
  slideType?: SlideType;
  isOpen?: boolean;
}

export interface Part {
  id: string;
  name: string;
  moduleId?: string;
  moduleName?: string;
  length: number; // mm
  width: number;  // mm
  thickness: number; // mm
  quantity: number;
  materialId: string;
  materialName: string;
  grain: GrainDirection;
  edges: PartEdges;
  colorHex?: string;
  notes?: string;
  deductEdgeBanding?: boolean; // si se descuenta el canto en la medida de corte
  // Propiedades espaciales 3D (para modelado paramétrico individual)
  posX?: number; // mm (posición en eje X)
  posY?: number; // mm (elevación en eje Y desde el suelo)
  posZ?: number; // mm (posición en eje Z profundidad)
  orientation?: PartOrientation; // horizontal o vertical
  componentRole?: ComponentRole;
  hardwareConfig?: PartHardwareConfig;
}

export type FurnitureModuleType =
  | 'base_cabinet'     // Bajo mesada / Base con o sin cajones
  | 'wall_cabinet'     // Alacena / Mueble alto
  | 'tall_cabinet'     // Columna / Despensa / Ropero
  | 'drawer_unit'      // Cajonera
  | 'custom';          // Módulo personalizado

export interface FurnitureModule {
  id: string;
  name: string;
  type: FurnitureModuleType;
  width: number;       // mm exterior
  height: number;      // mm exterior
  depth: number;       // mm exterior
  boardThickness: number; // 15 o 18 mm
  backThickness: number;  // 3, 5.5 o 18 mm
  backType: 'groove' | 'rebate' | 'overlay' | 'none';
  shelvesCount: number;
  doorsCount: number;  // 0, 1, 2
  doorsType: 'overlay' | 'inset';
  drawersCount: number;
  hasPlinth: boolean;  // Zócalo inferior
  plinthHeight: number; // mm (típico 80 - 100mm)
  materialId: string;
  backMaterialId?: string;
  defaultThinEdge: boolean;
  defaultThickDoors: boolean;
}

export interface Material {
  id: string;
  name: string;
  thickness: number; // mm
  sheetLength: number; // mm (ej. 2440, 2600)
  sheetWidth: number;  // mm (ej. 1830, 2140)
  sheetCost: number;   // Precio por tablero entero
  hasGrain: boolean;   // Si tiene textura de veta
  colorHex: string;
  textureType?: 'wood' | 'solid' | 'metal' | 'stone';
}

export interface HardwareItem {
  id: string;
  name: string;
  category: 'hinge' | 'slide' | 'handle' | 'screw' | 'support' | 'accessory' | 'other';
  unit: string; // 'par', 'und', 'caja', 'metro'
  quantity: number;
  unitCost: number;
  notes?: string;
}

export interface ProjectSettings {
  sawKerf: number;            // Espesor de disco / ancho de corte (ej. 4mm)
  trimMargin: number;         // Refilado perimetral del tablero (ej. 10mm)
  thinEdgeThickness: number;  // Espesor tapacanto delgado (ej. 0.45mm)
  thickEdgeThickness: number; // Espesor tapacanto grueso (ej. 2.0mm)
  thinEdgeCostPerMeter: number;
  thickEdgeCostPerMeter: number;
  optimizationPreference: 'guillotine_length' | 'guillotine_width' | 'best_fit';
  currency: string;
}

export interface CutLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stage: number;
  orientation: 'horizontal' | 'vertical';
}

export interface PlacedPart {
  part: Part;
  copyIndex: number;
  x: number;
  y: number;
  length: number; // dimensión a lo largo de X del tablero
  width: number;  // dimensión a lo largo de Y del tablero
  rotated: boolean;
  tag: string;
}

export interface LeftoverScrap {
  id: string;
  x: number;
  y: number;
  length: number;
  width: number;
  areaM2: number;
  usable: boolean;
}

export interface PlacedSheet {
  sheetIndex: number;
  material: Material;
  length: number;
  width: number;
  placedParts: PlacedPart[];
  cutLines: CutLine[];
  leftovers: LeftoverScrap[];
  usedAreaM2: number;
  wasteAreaM2: number;
  efficiencyPercent: number;
  cutLengthMeters: number;
}

export interface OptimizationResult {
  sheets: PlacedSheet[];
  totalSheetsUsed: number;
  totalPartsPlaced: number;
  totalPartsCount: number;
  unplacedParts: Part[];
  overallEfficiency: number;
  totalAreaUsedM2: number;
  totalAreaSheetsM2: number;
  wasteAreaM2: number;
  totalCutMeters: number;
  thinEdgeMeters: number;
  thickEdgeMeters: number;
}

export interface DrillHole {
  id: string;
  type: 'screw_4x50' | 'dowel_8x30' | 'hinge_35' | 'shelf_pin_5' | 'slide_system32' | 'handle_hole_4';
  diameter: number; // mm
  depth: number; // mm
  posX: number; // Global o relativo en mm
  posY: number;
  posZ: number;
  normalAxis: 'x' | 'y' | 'z';
  direction: 1 | -1;
  surfaceType: 'face' | 'edge';
  partId: string;
  partName: string;
  targetPartId?: string;
  targetPartName?: string;
  description: string;
}

export interface CollisionRecord {
  partAId: string;
  partAName: string;
  partBId: string;
  partBName: string;
  overlapX: number;
  overlapY: number;
  overlapZ: number;
  overlapVolumeMm3: number;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  date: string;
  notes: string;
  settings: ProjectSettings;
  materials: Material[];
  modules: FurnitureModule[];
  parts: Part[];
  hardware: HardwareItem[];
  laborCost: number;
  laborType: 'percent' | 'fixed';
  profitMarginPercent: number;
  taxPercent: number;
  updatedAt: string;
}
