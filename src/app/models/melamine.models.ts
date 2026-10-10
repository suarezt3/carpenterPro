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
  | 'drawer_box'
  | 'drawer_lateral'
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

export interface PartGroup {
  id: string;
  name: string; // ej. "Cajón 1", "Cajón Inferior"
  type: 'drawer' | 'door_set' | 'assembly' | 'custom';
  isOpen?: boolean; // Estado abierto/cerrado
  slideExtension?: number; // 0 (cerrado) a 1 (100% abierto)
  slideLength?: number; // Largo de corredera en mm (ej. 400, 450, 500)
  slideType?: SlideType; // Telescópica estándar, cierre suave, etc.
  colorHex?: string;
  frontGap?: number; // Holgura lateral para correderas (26mm total)
}

export interface ParametricDrawerConfig {
  name: string; // ej. "Cajón 1"
  outerWidth: number; // Ancho del hueco / exterior en mm (ej. 400)
  slideLength: number; // Largo de corredera / profundidad del cajón en mm (ej. 450)
  boxHeight: number; // Altura de caja del cajón en mm (ej. 140)
  boxThickness: number; // Espesor de laterales/trasera (default: 15mm)
  bottomThickness: number; // Espesor del fondo (default: 3mm MDF)
  slideGap: number; // Holgura total correderas (default: 26mm = 13mm cada lado)
  includeFront: boolean; // Si incluye frente/tapa exterior visto
  frontHeight?: number; // Altura del frente exterior (mm)
  frontWidth?: number; // Ancho del frente exterior (mm)
  posX?: number; // Posición X inicial (centro)
  posY?: number; // Posición Y inicial (elevación base)
  posZ?: number; // Posición Z inicial (profundidad centro)
  materialId?: string;
  bottomMaterialId?: string;
}

export interface Part {
  id: string;
  name: string;
  moduleId?: string;
  moduleName?: string;
  groupId?: string; // ID del grupo o cajón modular al que pertenece
  groupName?: string; // Nombre del grupo (ej. "Cajón 1")
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
  groups?: PartGroup[];
  hardware: HardwareItem[];
  laborCost: number;
  laborType: 'percent' | 'fixed';
  profitMarginPercent: number;
  taxPercent: number;
  updatedAt: string;
  roomConfig?: RoomConfiguration;
}

export type WorkspaceMode = 'module' | 'room';

export type RoomLayoutType = 'single_wall' | 'l_shape';

export type FloorMaterialType = 
  | 'wood_light' 
  | 'wood_walnut' 
  | 'marble_white' 
  | 'concrete_gray' 
  | 'tile_dark';

export type WallMaterialType = 
  | 'subway_tile_white' 
  | 'subway_tile_emerald' 
  | 'plaster_warm' 
  | 'concrete_smooth' 
  | 'vertical_slats_wood';

export interface RoomConfiguration {
  layout: RoomLayoutType;
  mainWallLength: number;      // Longitud en mm (ej. 3600)
  sideWallLength: number;      // Longitud en mm para L (ej. 2400)
  wallHeight: number;          // Altura en mm (ej. 2600)
  wallThickness: number;       // Espesor en mm (ej. 150)
  floorWidth: number;          // Ancho de piso en mm (ej. 5000)
  floorDepth: number;          // Profundidad de piso en mm (ej. 5000)
  floorMaterial: FloorMaterialType;
  wallMaterial: WallMaterialType;
  showFloorGrid: boolean;      // Rejilla técnica milimétrica superpuesta
  showSkirting: boolean;       // Zócalo o rodapié inferior
  wallOffsetX: number;         // Desfase modular X en mm (posición del muro)
  wallOffsetZ: number;         // Desfase modular Z en mm (hacia el fondo)
}

export const DEFAULT_ROOM_CONFIG: RoomConfiguration = {
  layout: 'l_shape',
  mainWallLength: 3600,
  sideWallLength: 2400,
  wallHeight: 2600,
  wallThickness: 150,
  floorWidth: 5000,
  floorDepth: 5000,
  floorMaterial: 'wood_light',
  wallMaterial: 'subway_tile_white',
  showFloorGrid: true,
  showSkirting: true,
  wallOffsetX: 0,
  wallOffsetZ: 0,
};
