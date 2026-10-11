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
    name: 'Concrete Gris Pro',
    brand: 'Corona Porcelatech',
    format: '60×60 cm',
    category: 'cement',
    tag: 'Alta Resistencia',
    swatchBg: '#a6adb4',
    description: 'Cemento pulido industrial gris neutro ARD Pro',
  },
  {
    id: 'concrete_arena',
    name: 'Boss Arena Cálido',
    brand: 'Corona Porcelatech',
    format: '60×60 cm',
    category: 'cement',
    tag: 'Mate Sedoso',
    swatchBg: '#c8bead',
    description: 'Microcemento cálido con matices arena natural',
  },
  {
    id: 'concrete_white',
    name: 'Cemento Blanco Ártico',
    brand: 'Corona Pro',
    format: '60×120 cm',
    category: 'cement',
    tag: 'Luminoso',
    swatchBg: '#e5e7eb',
    description: 'Hormigón blanco contemporáneo micropulido',
  },
  {
    id: 'tile_dark',
    name: 'Grafito Industrial ARD',
    brand: 'Corona ARD® Pro',
    format: '60×60 cm',
    category: 'cement',
    tag: 'Antideslizante',
    swatchBg: '#272b30',
    description: 'Porcelanato antracita oscuro de alto tráfico',
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
