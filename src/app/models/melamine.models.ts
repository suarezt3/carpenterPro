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
  // Propiedades espaciales y orientación 3D
  posX?: number; // mm (posición en eje X)
  posY?: number; // mm (elevación en eje Y desde el suelo)
  posZ?: number; // mm (posición en eje Z profundidad)
  rotationX?: number; // grados (rotación en eje X)
  rotationY?: number; // grados (rotación en eje Y)
  rotationZ?: number; // grados (rotación en eje Z)
  orientation?: PartOrientation; // horizontal o vertical
  componentRole?: ComponentRole;
  hardwareConfig?: PartHardwareConfig;
  // Geometría paramétrica CAD (forma rectangular estándar, circular o dibujo libre)
  shapeType?: 'rectangle' | 'circle' | 'freehand';
  radius?: number; // mm (para piezas circulares)
  diameter?: number; // mm (para piezas circulares)
  contourPoints?: { x: number; y: number }[]; // Puntos del polígono 2D en mm para piezas de forma libre
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

export interface ProjectNoteItem {
  id: string;
  title: string;
  content: string;
  category: 'pending' | 'adjustment' | 'design' | 'general';
  completed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  date: string;
  notes: string;
  projectNotes?: ProjectNoteItem[];
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
  appliances?: ApplianceItem[];
}

export type WorkspaceMode = 'module' | 'room';

export type RoomLayoutType = 'single_wall' | 'l_shape' | 'u_shape';

export type FloorMaterialType = 
  // Porcelanatos y Cemento
  | 'concrete_gray' 
  | 'concrete_arena' 
  | 'concrete_white' 
  | 'tile_dark'
  // Maderas y Laminados
  | 'wood_light' 
  | 'wood_guayacan' 
  | 'wood_walnut' 
  | 'wood_haya'
  // Mármoles y Piedras
  | 'marble_white' 
  | 'marble_calacatta_gold' 
  | 'travertine_beige' 
  | 'stone_slate_black';

export type WallMaterialType = 
  // Ladrillos
  | 'brick_clay' 
  | 'brick_white'
  // Azulejos y Cerámica
  | 'subway_tile_white' 
  | 'subway_tile_emerald' 
  | 'subway_tile_black'
  // Mármoles, Cuarzo y Salpicaderos
  | 'marble_wall_calacatta' 
  | 'kitchen_backsplash_quartz' 
  | 'kitchen_backsplash_mosaic'
  // Revestimientos Continuos y Listones
  | 'vertical_slats_wood' 
  | 'concrete_smooth' 
  | 'plaster_warm';

export type FloorFinishCategory = 'all' | 'cement' | 'wood' | 'marble';
export type WallFinishCategory = 'all' | 'brick' | 'tile' | 'marble' | 'panel';

export interface FinishCatalogItem<T> {
  id: T;
  name: string;
  brand: string;
  format: string;
  category: string;
  tag: string;
  swatchBg: string;
  swatchIcon?: string;
  description: string;
}

export const FLOOR_FINISHES_CATALOG: FinishCatalogItem<FloorMaterialType>[] = [
  // Porcelanatos y Cemento
  {
    id: 'concrete_gray',
    name: 'Porcelanato Gris Cemento',
    brand: 'Corona Porcelatech®',
    format: '60×60 cm Rectificado',
    category: 'cement',
    tag: 'Porcelanato Satinado',
    swatchBg: '#a6adb4',
    description: 'Porcelanato arquitectónico rectificado gris neutro de alta resistencia',
  },
  {
    id: 'concrete_arena',
    name: 'Porcelanato Arena Cálido',
    brand: 'Corona Porcelatech®',
    format: '60×60 cm Rectificado',
    category: 'cement',
    tag: 'Porcelanato Sedoso',
    swatchBg: '#c8bead',
    description: 'Porcelanato mate satinado con textura sedosa arena natural',
  },
  {
    id: 'concrete_white',
    name: 'Porcelanato Blanco Pulido',
    brand: 'Corona Porcelatech Pro',
    format: '60×120 cm Gran Formato',
    category: 'cement',
    tag: 'Porcelanato Luminoso',
    swatchBg: '#e5e7eb',
    description: 'Porcelanato blanco ártico micropulido contemporáneo',
  },
  {
    id: 'tile_dark',
    name: 'Porcelanato Grafito Antracita',
    brand: 'Corona Porcelatech ARD®',
    format: '60×60 cm Rectificado',
    category: 'cement',
    tag: 'Porcelanato Pro',
    swatchBg: '#272b30',
    description: 'Porcelanato técnico antracita oscuro de alto tráfico',
  },

  // Maderas y Laminados
  {
    id: 'wood_light',
    name: 'Roble Nórdico Natural',
    brand: 'Holztek SPC',
    format: '20×120 cm Duela',
    category: 'wood',
    tag: 'Impermeable',
    swatchBg: '#d8c29d',
    description: 'Madera clara con veta sincronizada natural',
  },
  {
    id: 'wood_guayacan',
    name: 'Guayacán Hobo Miel',
    brand: 'Corona Madera',
    format: '20×120 cm Duela',
    category: 'wood',
    tag: 'Vetas Cálidas',
    swatchBg: '#c19a6b',
    description: 'Vetas intensas de madera tropical dorada',
  },
  {
    id: 'wood_walnut',
    name: 'Nogal Americano Clásico',
    brand: 'Holztek SPC',
    format: '20×120 cm Duela',
    category: 'wood',
    tag: 'Elegancia',
    swatchBg: '#5c4033',
    description: 'Tono café profundo con textura de duela noble',
  },
  {
    id: 'wood_haya',
    name: 'Haya Clara Escandinava',
    brand: 'Holztek',
    format: '20×120 cm Duela',
    category: 'wood',
    tag: 'Minimalista',
    swatchBg: '#e6d7c3',
    description: 'Madera sutilmente blanqueada y limpia',
  },

  // Mármoles y Piedras
  {
    id: 'marble_white',
    name: 'Carrara Blanco Puro',
    brand: 'Corona Rectificado',
    format: '60×120 cm',
    category: 'marble',
    tag: 'Brillo Espejo',
    swatchBg: '#f8f9fa',
    description: 'Porcelanato blanco pulido con vetas grises',
  },
  {
    id: 'marble_calacatta_gold',
    name: 'Madrid Oro Calacatta',
    brand: 'Corona Rect. Pulido',
    format: '60×120 cm',
    category: 'marble',
    tag: 'Gold Luxury',
    swatchBg: '#faf7f0',
    description: 'Fondo blanco con vetas doradas y cobrizas',
  },
  {
    id: 'travertine_beige',
    name: 'Travertino Clásico Romano',
    brand: 'Corona Estructurado',
    format: '60×60 cm',
    category: 'marble',
    tag: 'Textura Piedra',
    swatchBg: '#ded4c3',
    description: 'Piedra calcárea con textura mineral porosa',
  },
  {
    id: 'stone_slate_black',
    name: 'Pizarra Negra Alpina',
    brand: 'Corona Estructurado',
    format: '60×60 cm',
    category: 'marble',
    tag: 'Relieve Hendido',
    swatchBg: '#1e2227',
    description: 'Piedra volcánica oscura con relieve hendido',
  },
];

export const WALL_FINISHES_CATALOG: FinishCatalogItem<WallMaterialType>[] = [
  // Ladrillos
  {
    id: 'brick_clay',
    name: 'Ladrillo Arcilla Rústico',
    brand: 'Caravista Rústico',
    format: '24×6 cm con Llaga',
    category: 'brick',
    tag: 'Industrial Loft',
    swatchBg: '#b85d38',
    swatchIcon: '🧱',
    description: 'Ladrillo visto cocido con mortero gris claro',
  },
  {
    id: 'brick_white',
    name: 'Ladrillo Blanco Loft',
    brand: 'Loft Decapado',
    format: '24×6 cm con Llaga',
    category: 'brick',
    tag: 'Nórdico Loft',
    swatchBg: '#eeebe6',
    swatchIcon: '🧱',
    description: 'Ladrillo pintado blanco desgastado con relieve',
  },

  // Cerámica y Subway Tiles
  {
    id: 'subway_tile_white',
    name: 'Azulejo Metro Blanco',
    brand: 'Corona Revestimientos',
    format: '10×20 cm Biselado',
    category: 'tile',
    tag: 'Clásico Cocina',
    swatchBg: '#f8f9fa',
    swatchIcon: '✨',
    description: 'Subway tile biselado brillante con junta gris',
  },
  {
    id: 'subway_tile_emerald',
    name: 'Azulejo Verde Esmeralda',
    brand: 'Cerámica Artesanal',
    format: '10×20 cm Vitrificado',
    category: 'tile',
    tag: 'Esmalte Joya',
    swatchBg: '#0c5037',
    description: 'Verde artesanal esmaltado con reflejo vitrificado',
  },
  {
    id: 'subway_tile_black',
    name: 'Metro Carbón Mate',
    brand: 'Corona Pro',
    format: '10×20 cm Biselado',
    category: 'tile',
    tag: 'Contemporáneo',
    swatchBg: '#212529',
    description: 'Subway negro satinado con relieve biselado',
  },

  // Mármoles, Cuarzo y Salpicaderos
  {
    id: 'marble_wall_calacatta',
    name: 'Mármol Calacatta Continuo',
    brand: 'Corona Gran Formato',
    format: '120×260 cm Bookmatch',
    category: 'marble',
    tag: 'Sin Juntas',
    swatchBg: '#faf9f6',
    description: 'Placas pulidas continuas con vetas Calacatta',
  },
  {
    id: 'kitchen_backsplash_quartz',
    name: 'Cuarzo Gris Neutro Cocina',
    brand: 'Superficie Sólida',
    format: 'Salpicadero Continuo',
    category: 'marble',
    tag: 'Anti-Grasa',
    swatchBg: '#cbd5e1',
    description: 'Salpicadero continuo satinado para zona de cocción',
  },
  {
    id: 'kitchen_backsplash_mosaic',
    name: 'Mosaico Hexagonal Sandalo',
    brand: 'Corona Decorativo',
    format: 'Hexágono 15×15 cm',
    category: 'marble',
    tag: 'Geométrico',
    swatchBg: '#e2d9cc',
    description: 'Geometría hexagonal moderna para salpicadero',
  },

  // Paneles y Revestimientos
  {
    id: 'vertical_slats_wood',
    name: 'Listones Acústicos Roble',
    brand: 'Palillería Nórdica',
    format: 'Listones 25×12 mm',
    category: 'panel',
    tag: 'Tendencia Cocina',
    swatchBg: '#c8a97e',
    swatchIcon: '🥢',
    description: 'Fondo negro fonoabsorbente con palillería roble',
  },
  {
    id: 'concrete_smooth',
    name: 'Cemento Visto Encofrado',
    brand: 'Hormigón Arquitectónico',
    format: 'Paneles 120×60 cm',
    category: 'panel',
    tag: 'Brutalista',
    swatchBg: '#c5cbd0',
    description: 'Hormigón visto con marcas de encofrado',
  },
  {
    id: 'plaster_warm',
    name: 'Yeso Liso Cálido',
    brand: 'Pintura Lavable Cocina',
    format: 'Pared Continua',
    category: 'panel',
    tag: 'Neutral Mate',
    swatchBg: '#f4f1ea',
    description: 'Pintura satinada lavable blanca rota sin textura',
  },
];


export interface RoomConfiguration {
  layout: RoomLayoutType;
  mainWallLength: number;      // Longitud en mm (ej. 3600)
  sideWallLength: number;      // Longitud en mm para L o lateral izquierdo (ej. 2400)
  rightWallLength?: number;     // Longitud en mm para lateral derecho en U (ej. 2400)
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
  rightWallLength: 2400,
  wallHeight: 2600,
  wallThickness: 150,
  floorWidth: 5000,
  floorDepth: 5000,
  floorMaterial: 'concrete_gray',
  wallMaterial: 'kitchen_backsplash_quartz',
  showFloorGrid: true,
  showSkirting: true,
  wallOffsetX: 0,
  wallOffsetZ: 0,
};

// ==========================================
// FASE 2: REPOSITORIO DE ELECTRODOMÉSTICOS Y ACCESORIOS 3D
// ==========================================

export type ApplianceType = 
  | 'refrigerator' 
  | 'oven' 
  | 'cooktop' 
  | 'hood' 
  | 'sink' 
  | 'microwave'
  | 'coffee_maker'
  | 'table_leg'
  | 'table_legs_set';

export type ApplianceFinish = 
  | 'stainless_steel' 
  | 'black_matte' 
  | 'white_gloss'
  | 'gold_brass'
  | 'natural_wood'
  | 'retro_red';

export type ApplianceMountType = 
  | 'floor' 
  | 'countertop' 
  | 'wall' 
  | 'built_in';

export interface AppliancePosition {
  x: number; // en mm (eje horizontal)
  y: number; // en mm (altura desde el suelo)
  z: number; // en mm (profundidad en sala)
}

export interface ApplianceItem {
  id: string;
  type: ApplianceType;
  name: string;
  brand?: string;
  modelCode?: string;
  width: number;       // en mm (eje X)
  depth: number;       // en mm (eje Z)
  height: number;      // en mm (eje Y)
  finish: ApplianceFinish;
  position: AppliancePosition;
  rotation: number;    // en grados: 0, 90, 180, 270
  mountType: ApplianceMountType;
  price: number;       // Costo para presupuesto
  includeInBudget: boolean;
  notes?: string;
}

export interface AppliancePreset {
  id: string;
  type: ApplianceType;
  name: string;
  category: 'cold' | 'cooking' | 'extraction' | 'washing' | 'microwave' | 'coffee' | 'legs';
  categoryLabel: string;
  brand: string;
  modelCode: string;
  defaultWidth: number;
  defaultDepth: number;
  defaultHeight: number;
  minWidth: number;
  maxWidth: number;
  minDepth: number;
  maxDepth: number;
  minHeight: number;
  maxHeight: number;
  defaultMountType: ApplianceMountType;
  defaultFinish: ApplianceFinish;
  defaultPrice: number;
  icon: string;
  description: string;
  recommendedHeights?: number[];
  standardWidths?: number[];
}

export const APPLIANCE_FINISH_OPTIONS: { id: ApplianceFinish; label: string; color: string; metallic: number; roughness: number }[] = [
  { id: 'stainless_steel', label: 'Acero Inox Cepillado', color: '#c8cbd0', metallic: 0.85, roughness: 0.28 },
  { id: 'black_matte', label: 'Negro Mate Premium', color: '#1e2022', metallic: 0.20, roughness: 0.55 },
  { id: 'white_gloss', label: 'Blanco Cristal Brillante', color: '#f5f6f8', metallic: 0.05, roughness: 0.15 },
  { id: 'gold_brass', label: 'Latón Dorado Cepillado', color: '#d4af37', metallic: 0.88, roughness: 0.25 },
  { id: 'natural_wood', label: 'Madera Roble / Haya', color: '#c19a6b', metallic: 0.05, roughness: 0.70 },
  { id: 'retro_red', label: 'Rojo Carmesí Barista', color: '#991b1b', metallic: 0.35, roughness: 0.30 },
];

export const APPLIANCES_CATALOG_PRESETS: AppliancePreset[] = [
  // 1. NEVERAS / REFRIGERADORES
  {
    id: 'preset_fridge_french',
    type: 'refrigerator',
    name: 'Nevera French Door (Doble Puerta)',
    category: 'cold',
    categoryLabel: 'Refrigeración',
    brand: 'Whirlpool / Samsung',
    modelCode: 'RF-6500-SS',
    defaultWidth: 910,
    defaultDepth: 750,
    defaultHeight: 1780,
    minWidth: 800,
    maxWidth: 1100,
    minDepth: 650,
    maxDepth: 900,
    minHeight: 1650,
    maxHeight: 2000,
    defaultMountType: 'floor',
    defaultFinish: 'stainless_steel',
    defaultPrice: 4200000,
    icon: 'kitchen',
    description: 'Refrigerador de gran formato con dispensador frontal, doble puerta batiente y gaveta congelador inferior.',
    standardWidths: [850, 910, 950]
  },
  {
    id: 'preset_fridge_bottom_mount',
    type: 'refrigerator',
    name: 'Nevera Combi / Bottom Mount 70cm',
    category: 'cold',
    categoryLabel: 'Refrigeración',
    brand: 'Bosch / Mabe',
    modelCode: 'KGN-49X-BM',
    defaultWidth: 700,
    defaultDepth: 680,
    defaultHeight: 1850,
    minWidth: 600,
    maxWidth: 800,
    minDepth: 600,
    maxDepth: 750,
    minHeight: 1600,
    maxHeight: 2000,
    defaultMountType: 'floor',
    defaultFinish: 'stainless_steel',
    defaultPrice: 2850000,
    icon: 'kitchen',
    description: 'Nevera vertical europea con refrigerador superior a nivel visual y congelador en la parte baja.',
    standardWidths: [600, 700, 750]
  },
  {
    id: 'preset_fridge_compact',
    type: 'refrigerator',
    name: 'Nevera Top Mount Estándar 60cm',
    category: 'cold',
    categoryLabel: 'Refrigeración',
    brand: 'Haceb / Electrolux',
    modelCode: 'TM-310-LT',
    defaultWidth: 600,
    defaultDepth: 650,
    defaultHeight: 1650,
    minWidth: 540,
    maxWidth: 680,
    minDepth: 550,
    maxDepth: 700,
    minHeight: 1450,
    maxHeight: 1780,
    defaultMountType: 'floor',
    defaultFinish: 'stainless_steel',
    defaultPrice: 1650000,
    icon: 'kitchen',
    description: 'Nevera clásica de 2 puertas compacta, idónea para cocinas medianas o apartamentos modernos.',
    standardWidths: [550, 600, 650]
  },

  // 2. HORNOS
  {
    id: 'preset_oven_60cm',
    type: 'oven',
    name: 'Horno Eléctrico Empotrable 60cm',
    category: 'cooking',
    categoryLabel: 'Cocción',
    brand: 'Teka / Bosch',
    modelCode: 'HLB-840-BK',
    defaultWidth: 595,
    defaultDepth: 570,
    defaultHeight: 595,
    minWidth: 550,
    maxWidth: 650,
    minDepth: 500,
    maxDepth: 620,
    minHeight: 550,
    maxHeight: 650,
    defaultMountType: 'built_in',
    defaultFinish: 'black_matte',
    defaultPrice: 1950000,
    icon: 'microwave',
    description: 'Horno multifunción con panel touch LED, tirador tubular horizontal y puerta de triple vidrio ahumado.',
    standardWidths: [595, 600]
  },
  {
    id: 'preset_oven_tower_75cm',
    type: 'oven',
    name: 'Horno Pro Gran Capacidad 75cm',
    category: 'cooking',
    categoryLabel: 'Cocción',
    brand: 'Smeg / KitchenAid',
    modelCode: 'PRO-750-SS',
    defaultWidth: 750,
    defaultDepth: 580,
    defaultHeight: 600,
    minWidth: 700,
    maxWidth: 900,
    minDepth: 520,
    maxDepth: 640,
    minHeight: 580,
    maxHeight: 650,
    defaultMountType: 'built_in',
    defaultFinish: 'stainless_steel',
    defaultPrice: 3400000,
    icon: 'microwave',
    description: 'Horno empotrable extra ancho para torre de hornos o bajo encimera con convección forzada.',
    standardWidths: [750, 900]
  },

  // 3. ESTUFAS Y ANAFES (CUBIERTAS DE COCCIÓN)
  {
    id: 'preset_cooktop_induction_60cm',
    type: 'cooktop',
    name: 'Anafe Vitrocerámico / Inducción 60cm',
    category: 'cooking',
    categoryLabel: 'Cocción',
    brand: 'Franke / Bosch',
    modelCode: 'PUE-611-IND',
    defaultWidth: 590,
    defaultDepth: 520,
    defaultHeight: 60,
    minWidth: 500,
    maxWidth: 700,
    minDepth: 480,
    maxDepth: 550,
    minHeight: 45,
    maxHeight: 90,
    defaultMountType: 'countertop',
    defaultFinish: 'black_matte',
    defaultPrice: 1780000,
    icon: 'mode_heat',
    description: 'Placa de inducción extraplana con 4 zonas concéntricas de cocción y controles táctiles frontales.',
    standardWidths: [590, 600]
  },
  {
    id: 'preset_cooktop_gas_5burners',
    type: 'cooktop',
    name: 'Estufa de Gas 5 Hornillas en Acero Inox 86cm',
    category: 'cooking',
    categoryLabel: 'Cocción',
    brand: 'Challenger / Haceb',
    modelCode: 'SQ-860-GAS',
    defaultWidth: 860,
    defaultDepth: 510,
    defaultHeight: 65,
    minWidth: 750,
    maxWidth: 950,
    minDepth: 480,
    maxDepth: 540,
    minHeight: 50,
    maxHeight: 90,
    defaultMountType: 'countertop',
    defaultFinish: 'stainless_steel',
    defaultPrice: 1250000,
    icon: 'mode_heat',
    description: 'Cubierta de empotrar en acero inoxidable con 5 quemadores italianos, parrilas de hierro fundido y quemador Wok.',
    standardWidths: [750, 860, 900]
  },
  {
    id: 'preset_cooktop_domino_compact',
    type: 'cooktop',
    name: 'Anafe Dominó 2 Puestos 30cm',
    category: 'cooking',
    categoryLabel: 'Cocción',
    brand: 'Teka / Cata',
    modelCode: 'DOM-302-BK',
    defaultWidth: 300,
    defaultDepth: 520,
    defaultHeight: 55,
    minWidth: 280,
    maxWidth: 350,
    minDepth: 480,
    maxDepth: 530,
    minHeight: 45,
    maxHeight: 70,
    defaultMountType: 'countertop',
    defaultFinish: 'black_matte',
    defaultPrice: 790000,
    icon: 'mode_heat',
    description: 'Cubierta modular compacta de 2 puestos en cristal templado negro para islas o cocinas pequeñas.',
    standardWidths: [300]
  },

  // 4. CAMPANAS EXTRACTORAS
  {
    id: 'preset_hood_t_shape_90cm',
    type: 'hood',
    name: 'Campana Isla / Pared T-Invertida 90cm',
    category: 'extraction',
    categoryLabel: 'Extracción',
    brand: 'Cata / Challenger',
    modelCode: 'ISL-90-GLS',
    defaultWidth: 900,
    defaultDepth: 500,
    defaultHeight: 520,
    minWidth: 750,
    maxWidth: 1050,
    minDepth: 450,
    maxDepth: 550,
    minHeight: 350,
    maxHeight: 850,
    defaultMountType: 'wall',
    defaultFinish: 'stainless_steel',
    defaultPrice: 1450000,
    icon: 'air',
    description: 'Campana extractora de pared con ducto telescópico, iluminación LED, filtros de aluminio y botonera táctil.',
    standardWidths: [750, 900]
  },
  {
    id: 'preset_hood_pyramidal_60cm',
    type: 'hood',
    name: 'Campana Piramidal Clásica 60cm',
    category: 'extraction',
    categoryLabel: 'Extracción',
    brand: 'Haceb / Teka',
    modelCode: 'PIR-60-SS',
    defaultWidth: 600,
    defaultDepth: 500,
    defaultHeight: 480,
    minWidth: 550,
    maxWidth: 650,
    minDepth: 450,
    maxDepth: 520,
    minHeight: 320,
    maxHeight: 750,
    defaultMountType: 'wall',
    defaultFinish: 'stainless_steel',
    defaultPrice: 850000,
    icon: 'air',
    description: 'Campana con forma piramidal de 60cm, de alta potencia y fácil desmontaje de rejillas filtrantes.',
    standardWidths: [600]
  },
  {
    id: 'preset_hood_telescopic_built_in',
    type: 'hood',
    name: 'Campana Telescópica Empotrada en Mueble 60cm',
    category: 'extraction',
    categoryLabel: 'Extracción',
    brand: 'Franke / Bosch',
    modelCode: 'TL-62-EM',
    defaultWidth: 600,
    defaultDepth: 310,
    defaultHeight: 220,
    minWidth: 550,
    maxWidth: 650,
    minDepth: 280,
    maxDepth: 350,
    minHeight: 180,
    maxHeight: 300,
    defaultMountType: 'built_in',
    defaultFinish: 'stainless_steel',
    defaultPrice: 920000,
    icon: 'air',
    description: 'Campana retráctil que se oculta dentro del mueble aéreo superior con frente extraíble de acero.',
    standardWidths: [600]
  },

  // 5. FREGADEROS / LAVAPLATOS
  {
    id: 'preset_sink_single_drainer',
    type: 'sink',
    name: 'Lavaplatos 1 Pozo Grande + Escurridor 80cm',
    category: 'washing',
    categoryLabel: 'Lavaplatos',
    brand: 'Corona / Franke',
    modelCode: 'LVP-8048-DX',
    defaultWidth: 800,
    defaultDepth: 480,
    defaultHeight: 210,
    minWidth: 700,
    maxWidth: 950,
    minDepth: 440,
    maxDepth: 520,
    minHeight: 180,
    maxHeight: 240,
    defaultMountType: 'countertop',
    defaultFinish: 'stainless_steel',
    defaultPrice: 650000,
    icon: 'wash',
    description: 'Poceta profunda con zona de escurridor acanalado, grifo monomando cuello de cisne y canastilla antirreboce.',
    standardWidths: [780, 800, 860]
  },
  {
    id: 'preset_sink_double_bowl',
    type: 'sink',
    name: 'Lavaplatos Doble Pozo Acero Inox 84cm',
    category: 'washing',
    categoryLabel: 'Lavaplatos',
    brand: 'Teka / Blanco',
    modelCode: 'DB-840-INX',
    defaultWidth: 840,
    defaultDepth: 480,
    defaultHeight: 220,
    minWidth: 750,
    maxWidth: 950,
    minDepth: 450,
    maxDepth: 530,
    minHeight: 180,
    maxHeight: 250,
    defaultMountType: 'countertop',
    defaultFinish: 'stainless_steel',
    defaultPrice: 890000,
    icon: 'wash',
    description: 'Doble cubeta de acero inoxidable satinado calibre 18 para lavado y enjuague simultáneo con grifería giratoria.',
    standardWidths: [800, 840, 900]
  },
  {
    id: 'preset_sink_compact_square',
    type: 'sink',
    name: 'Lavaplatos Pozo Cuadrado Submontar 50cm',
    category: 'washing',
    categoryLabel: 'Lavaplatos',
    brand: 'Corona / Grohe',
    modelCode: 'LVP-SQR-50',
    defaultWidth: 500,
    defaultDepth: 450,
    defaultHeight: 210,
    minWidth: 400,
    maxWidth: 600,
    minDepth: 400,
    maxDepth: 500,
    minHeight: 180,
    maxHeight: 230,
    defaultMountType: 'countertop',
    defaultFinish: 'black_matte',
    defaultPrice: 580000,
    icon: 'wash',
    description: 'Diseño minimalista con radio 10mm en esquinas, desagüe oculto y grifo de diseño elegante.',
    standardWidths: [450, 500, 550]
  },

  // 6. MICROONDAS
  {
    id: 'preset_micro_builtin_trim',
    type: 'microwave',
    name: 'Microondas Empotrado con Marco Trim 60cm',
    category: 'microwave',
    categoryLabel: 'Microondas',
    brand: 'Samsung / Panasonic',
    modelCode: 'MW-TRIM-32L',
    defaultWidth: 595,
    defaultDepth: 390,
    defaultHeight: 388,
    minWidth: 520,
    maxWidth: 650,
    minDepth: 340,
    maxDepth: 460,
    minHeight: 350,
    maxHeight: 450,
    defaultMountType: 'built_in',
    defaultFinish: 'black_matte',
    defaultPrice: 1100000,
    icon: 'microwave',
    description: 'Horno microondas con marco de integración en acero o cristal negro a juego con la torre de hornos.',
    standardWidths: [595]
  },
  {
    id: 'preset_micro_countertop',
    type: 'microwave',
    name: 'Microondas de Sobremesa / Nicho 48cm',
    category: 'microwave',
    categoryLabel: 'Microondas',
    brand: 'LG / Haceb',
    modelCode: 'MW-NEO-25L',
    defaultWidth: 485,
    defaultDepth: 370,
    defaultHeight: 290,
    minWidth: 440,
    maxWidth: 550,
    minDepth: 320,
    maxDepth: 420,
    minHeight: 260,
    maxHeight: 340,
    defaultMountType: 'countertop',
    defaultFinish: 'stainless_steel',
    defaultPrice: 550000,
    icon: 'microwave',
    description: 'Microondas portátil compacto para instalar sobre encimera o en nicho abierto de alacena.',
    standardWidths: [485, 520]
  },

  // 7. CAFETERAS ESPRESSO DE COCINA
  {
    id: 'preset_espresso_barista_pro',
    type: 'coffee_maker',
    name: 'Cafetera Espresso Barista Pro 38cm',
    category: 'coffee',
    categoryLabel: 'Cafeteras',
    brand: 'Breville / DeLonghi',
    modelCode: 'BES878-SS',
    defaultWidth: 380,
    defaultDepth: 360,
    defaultHeight: 410,
    minWidth: 300,
    maxWidth: 460,
    minDepth: 300,
    maxDepth: 460,
    minHeight: 320,
    maxHeight: 480,
    defaultMountType: 'countertop',
    defaultFinish: 'stainless_steel',
    defaultPrice: 2850000,
    icon: 'coffee',
    description: 'Cafetera espresso italiana sobre encimera con doble salida de café, portafiltro profesional, manómetro analógico, lanceta de vapor inox y bandeja calientatazas superior.',
    standardWidths: [380]
  },
  {
    id: 'preset_espresso_compact',
    type: 'coffee_maker',
    name: 'Cafetera Espresso Compacta 26cm',
    category: 'coffee',
    categoryLabel: 'Cafeteras',
    brand: 'Smeg / Oster',
    modelCode: 'EC-685-BK',
    defaultWidth: 260,
    defaultDepth: 330,
    defaultHeight: 330,
    minWidth: 220,
    maxWidth: 320,
    minDepth: 280,
    maxDepth: 380,
    minHeight: 280,
    maxHeight: 380,
    defaultMountType: 'countertop',
    defaultFinish: 'black_matte',
    defaultPrice: 1250000,
    icon: 'coffee',
    description: 'Cafetera espresso slim para mesada de cocina con vaporizador de leche, panel frontal con pulsadores LED y bandeja de goteo en inox.',
    standardWidths: [260]
  },
  {
    id: 'preset_espresso_retro_red',
    type: 'coffee_maker',
    name: 'Cafetera Espresso Vintage Retro 32cm',
    category: 'coffee',
    categoryLabel: 'Cafeteras',
    brand: 'Ariete / SMEG',
    modelCode: 'VNT-1389-RD',
    defaultWidth: 320,
    defaultDepth: 340,
    defaultHeight: 360,
    minWidth: 260,
    maxWidth: 380,
    minDepth: 280,
    maxDepth: 400,
    minHeight: 300,
    maxHeight: 420,
    defaultMountType: 'countertop',
    defaultFinish: 'retro_red',
    defaultPrice: 1980000,
    icon: 'coffee',
    description: 'Cafetera espresso estilo retro de sobremesa con reloj termómetro central, detalles cromados y chasis carmesí de colección.',
    standardWidths: [320]
  },

  // 8. ACCESORIOS Y PATAS DE MESA Y MOBILIARIO
  {
    id: 'preset_legs_hairpin_set',
    type: 'table_legs_set',
    name: 'Juego de 4 Patas Horquilla (Hairpin) 72cm',
    category: 'legs',
    categoryLabel: 'Patas de Mesa',
    brand: 'MelamiPro Hardware',
    modelCode: 'HP-720-TRI',
    defaultWidth: 800,
    defaultDepth: 1200,
    defaultHeight: 720,
    minWidth: 400,
    maxWidth: 2400,
    minDepth: 400,
    maxDepth: 1400,
    minHeight: 350,
    maxHeight: 950,
    defaultMountType: 'floor',
    defaultFinish: 'black_matte',
    defaultPrice: 180000,
    icon: 'table_bar',
    description: 'Juego de 4 patas metálicas estilo horquilla (Hairpin) de triple varilla maciza con inclinación estética y pletina triangular de anclaje para mesas de comedor y escritorios.',
    standardWidths: [800, 900, 1000]
  },
  {
    id: 'preset_legs_cylindrical_inox_set',
    type: 'table_legs_set',
    name: 'Juego de 4 Patas Cilíndricas Inox 72cm Regulables',
    category: 'legs',
    categoryLabel: 'Patas de Mesa',
    brand: 'MelamiPro Hardware',
    modelCode: 'CYL-60-720-SS',
    defaultWidth: 800,
    defaultDepth: 1200,
    defaultHeight: 720,
    minWidth: 400,
    maxWidth: 2400,
    minDepth: 400,
    maxDepth: 1400,
    minHeight: 350,
    maxHeight: 950,
    defaultMountType: 'floor',
    defaultFinish: 'stainless_steel',
    defaultPrice: 140000,
    icon: 'table_bar',
    description: 'Juego de 4 patas tubulares de acero inoxidable Ø60mm con base roscada niveladora regulable (+25mm) y pletina de montaje reforzada.',
    standardWidths: [800, 900, 1000]
  },
  {
    id: 'preset_legs_scandinavian_wood_set',
    type: 'table_legs_set',
    name: 'Juego de 4 Patas Cónicas Madera Nórdica 72cm',
    category: 'legs',
    categoryLabel: 'Patas de Mesa',
    brand: 'MelamiPro Hardware',
    modelCode: 'WD-CONIC-720',
    defaultWidth: 800,
    defaultDepth: 1200,
    defaultHeight: 720,
    minWidth: 400,
    maxWidth: 2400,
    minDepth: 400,
    maxDepth: 1400,
    minHeight: 350,
    maxHeight: 950,
    defaultMountType: 'floor',
    defaultFinish: 'natural_wood',
    defaultPrice: 165000,
    icon: 'table_bar',
    description: 'Juego de 4 patas cónicas de madera maciza estilo nórdico escandinavo con ángulo de inclinación 10°, placa metálica de fijación y regatón dorado latón.',
    standardWidths: [800, 900, 1000]
  },
  {
    id: 'preset_legs_hairpin_single',
    type: 'table_leg',
    name: 'Pata Horquilla Industrial Hairpin 72cm (Individual)',
    category: 'legs',
    categoryLabel: 'Patas de Mesa',
    brand: 'MelamiPro Hardware',
    modelCode: 'HP-720-IND',
    defaultWidth: 120,
    defaultDepth: 120,
    defaultHeight: 720,
    minWidth: 80,
    maxWidth: 200,
    minDepth: 80,
    maxDepth: 200,
    minHeight: 300,
    maxHeight: 900,
    defaultMountType: 'floor',
    defaultFinish: 'black_matte',
    defaultPrice: 45000,
    icon: 'table_bar',
    description: 'Pata individual estilo horquilla hairpin de varilla de acero electroestático para ubicar libremente en esquinas o centros.',
    standardWidths: [120]
  },
  {
    id: 'preset_legs_cylindrical_single',
    type: 'table_leg',
    name: 'Pata Cilíndrica Inox Ø60mm Regulable (Individual)',
    category: 'legs',
    categoryLabel: 'Patas de Mesa',
    brand: 'MelamiPro Hardware',
    modelCode: 'CYL-60-IND',
    defaultWidth: 100,
    defaultDepth: 100,
    defaultHeight: 720,
    minWidth: 60,
    maxWidth: 150,
    minDepth: 60,
    maxDepth: 150,
    minHeight: 100,
    maxHeight: 900,
    defaultMountType: 'floor',
    defaultFinish: 'stainless_steel',
    defaultPrice: 35000,
    icon: 'table_bar',
    description: 'Pata individual cilíndrica de acero inoxidable con nivelador roscado para soporte perimetral o patas de refuerzo central.',
    standardWidths: [100]
  },
  {
    id: 'preset_legs_scandinavian_single',
    type: 'table_leg',
    name: 'Pata Cónica Madera Nórdica con Regatón Dorado (Individual)',
    category: 'legs',
    categoryLabel: 'Patas de Mesa',
    brand: 'MelamiPro Hardware',
    modelCode: 'WD-CONIC-IND',
    defaultWidth: 90,
    defaultDepth: 90,
    defaultHeight: 720,
    minWidth: 60,
    maxWidth: 140,
    minDepth: 60,
    maxDepth: 140,
    minHeight: 200,
    maxHeight: 900,
    defaultMountType: 'floor',
    defaultFinish: 'natural_wood',
    defaultPrice: 42000,
    icon: 'table_bar',
    description: 'Pata individual cónica de madera torneada con casquillo dorado para muebles escandinavos, mesas auxiliares o cómodas.',
    standardWidths: [90]
  },
  {
    id: 'preset_legs_coffee_hairpin_set',
    type: 'table_legs_set',
    name: 'Juego de 4 Patas Hairpin Mesa de Centro 40cm',
    category: 'legs',
    categoryLabel: 'Patas de Mesa',
    brand: 'MelamiPro Hardware',
    modelCode: 'HP-400-SET',
    defaultWidth: 600,
    defaultDepth: 900,
    defaultHeight: 400,
    minWidth: 300,
    maxWidth: 1600,
    minDepth: 300,
    maxDepth: 1200,
    minHeight: 250,
    maxHeight: 500,
    defaultMountType: 'floor',
    defaultFinish: 'black_matte',
    defaultPrice: 120000,
    icon: 'table_bar',
    description: 'Juego de 4 patas horquilla bajas de 40cm ideales para mesas ratonas de living, mesas de centro y muebles bajos de TV.',
    standardWidths: [600]
  }
];
