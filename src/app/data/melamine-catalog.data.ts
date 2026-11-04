import { Material, MelamineFamily } from '../models/melamine.models';

export interface MelamineFamilyInfo {
  id: MelamineFamily;
  label: string;
  description: string;
}

export const MELAMINE_FAMILIES: MelamineFamilyInfo[] = [
  { id: 'wood_light', label: 'Maderas Claras', description: 'Tonos claros, roble y fresno de estilo nórdico contemporáneo' },
  { id: 'wood_medium', label: 'Maderas Medias', description: 'Tonos caramelo, teca y maderas intermedias cálidas' },
  { id: 'wood_dark', label: 'Maderas Oscuras', description: 'Wengué, ébano y nogales profundos de alta elegancia' },
  { id: 'solid_matte', label: 'Unicolores Mate', description: 'Superficies satinadas antihuella de tendencia minimalista' },
  { id: 'high_gloss', label: 'Alto Brillo (HG)', description: 'Acabados espejados ultra reflectantes de alto impacto' },
  { id: 'textile_linen', label: 'Textiles y Linos', description: 'Texturas tramadas suaves para interiores de closet y cajones' },
  { id: 'stone_countertop', label: 'Piedras y Mesones', description: 'Mármoles, granitos, cuarzos y superficies sinterizadas' },
  { id: 'mdf_back', label: 'Fondos Durolac MDF', description: 'Tableros de 3 mm para traseras y fondos de cajón' }
];

/**
 * Catálogo maestro tipado con más de 35 referencias de melaminas y superficies (Fase 4).
 * Precios realistas en pesos colombianos (COP), especificaciones por espesor (15mm y 18mm)
 * y soporte completo para orientación de veta (part.grain).
 */
export const MELAMINE_MATERIALS_CATALOG: Material[] = [
  // ==========================================
  // 1. MADERAS CLARAS
  // ==========================================
  {
    id: 'mat_roble_18',
    name: 'Melamina Roble Kendal Natural',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 185000,
    hasGrain: true,
    colorHex: '#b48a60',
    textureType: 'wood',
    family: 'wood_light',
    familyLabel: 'Maderas Claras',
    brand: 'Pelíkano / Vesto',
    thicknessSpecs: {
      '15': { sheetCost: 185000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 215000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_roblemiel_18',
    name: 'Melamina Roble Miel Cálido',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 210000,
    hasGrain: true,
    colorHex: '#c29b68',
    textureType: 'wood',
    family: 'wood_light',
    familyLabel: 'Maderas Claras',
    brand: 'Arauco Prism',
    thicknessSpecs: {
      '15': { sheetCost: 180000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 210000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_nordico_18',
    name: 'Melamina Roble Nórdico Glacial',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 212000,
    hasGrain: true,
    colorHex: '#d8c29d',
    textureType: 'wood',
    family: 'wood_light',
    familyLabel: 'Maderas Claras',
    brand: 'Egger Feelwood',
    thicknessSpecs: {
      '15': { sheetCost: 182000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 212000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_haya_18',
    name: 'Melamina Haya Natural Escandinava',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 178000,
    hasGrain: true,
    colorHex: '#e6d7c3',
    textureType: 'wood',
    family: 'wood_light',
    familyLabel: 'Maderas Claras',
    brand: 'Pelíkano',
    thicknessSpecs: {
      '15': { sheetCost: 178000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 208000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_fresno_18',
    name: 'Melamina Fresno Blanco Nórdico',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 210000,
    hasGrain: true,
    colorHex: '#d9c5a5',
    textureType: 'wood',
    family: 'wood_light',
    familyLabel: 'Maderas Claras',
    brand: 'Fundermax',
    thicknessSpecs: {
      '15': { sheetCost: 180000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 210000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_roble_santana_18',
    name: 'Melamina Roble Santana Dorado',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 215000,
    hasGrain: true,
    colorHex: '#bfa07d',
    textureType: 'wood',
    family: 'wood_light',
    familyLabel: 'Maderas Claras',
    brand: 'Kronospan',
    thicknessSpecs: {
      '15': { sheetCost: 185000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 215000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },

  // ==========================================
  // 2. MADERAS MEDIAS
  // ==========================================
  {
    id: 'mat_caramelo_18',
    name: 'Melamina Madera Caramelo Tostado',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 220000,
    hasGrain: true,
    colorHex: '#a06e42',
    textureType: 'wood',
    family: 'wood_medium',
    familyLabel: 'Maderas Medias',
    brand: 'Pelíkano Syncron',
    thicknessSpecs: {
      '15': { sheetCost: 190000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 220000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_roble_rustico_18',
    name: 'Melamina Roble Rústico Aserrado',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 225000,
    hasGrain: true,
    colorHex: '#9c6f44',
    textureType: 'wood',
    family: 'wood_medium',
    familyLabel: 'Maderas Medias',
    brand: 'Arauco Vesto',
    thicknessSpecs: {
      '15': { sheetCost: 195000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 225000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_teca_18',
    name: 'Melamina Teca Ártico Natural',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 228000,
    hasGrain: true,
    colorHex: '#8b5a2b',
    textureType: 'wood',
    family: 'wood_medium',
    familyLabel: 'Maderas Medias',
    brand: 'Tableros Masisa',
    thicknessSpecs: {
      '15': { sheetCost: 195000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 228000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_nogal_amazonico_18',
    name: 'Melamina Nogal Amazónico Silvestre',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 235000,
    hasGrain: true,
    colorHex: '#734b2f',
    textureType: 'wood',
    family: 'wood_medium',
    familyLabel: 'Maderas Medias',
    brand: 'Pelíkano',
    thicknessSpecs: {
      '15': { sheetCost: 200000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 235000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_cedro_18',
    name: 'Melamina Cedro Americano Canela',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 192000,
    hasGrain: true,
    colorHex: '#8b4d2c',
    textureType: 'wood',
    family: 'wood_medium',
    familyLabel: 'Maderas Medias',
    brand: 'Arauco',
    thicknessSpecs: {
      '15': { sheetCost: 192000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 222000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_parota_18',
    name: 'Melamina Parota Exótica Veteada',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 238000,
    hasGrain: true,
    colorHex: '#6d4c38',
    textureType: 'wood',
    family: 'wood_medium',
    familyLabel: 'Maderas Medias',
    brand: 'Egger Pro',
    thicknessSpecs: {
      '15': { sheetCost: 205000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 238000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },

  // ==========================================
  // 3. MADERAS OSCURAS
  // ==========================================
  {
    id: 'mat_wengue_18',
    name: 'Melamina Wengué Pardo Profundo',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 240000,
    hasGrain: true,
    colorHex: '#382b24',
    textureType: 'wood',
    family: 'wood_dark',
    familyLabel: 'Maderas Oscuras',
    brand: 'Arauco Vesto',
    thicknessSpecs: {
      '15': { sheetCost: 205000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 240000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_nogal_18',
    name: 'Melamina Nogal Terracota Oscuro',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 235000,
    hasGrain: true,
    colorHex: '#5c3a21',
    textureType: 'wood',
    family: 'wood_dark',
    familyLabel: 'Maderas Oscuras',
    brand: 'Pelíkano',
    thicknessSpecs: {
      '15': { sheetCost: 200000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 235000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_tabaco_18',
    name: 'Melamina Roble Tabaco Intenso',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 236000,
    hasGrain: true,
    colorHex: '#423126',
    textureType: 'wood',
    family: 'wood_dark',
    familyLabel: 'Maderas Oscuras',
    brand: 'Kronospan',
    thicknessSpecs: {
      '15': { sheetCost: 202000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 236000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_ebano_18',
    name: 'Melamina Ébano Real Negro Veteado',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 245000,
    hasGrain: true,
    colorHex: '#25201d',
    textureType: 'wood',
    family: 'wood_dark',
    familyLabel: 'Maderas Oscuras',
    brand: 'Fundermax',
    thicknessSpecs: {
      '15': { sheetCost: 210000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 245000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_roble_moro_18',
    name: 'Melamina Roble Moro Carbonizado',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 242000,
    hasGrain: true,
    colorHex: '#2d2621',
    textureType: 'wood',
    family: 'wood_dark',
    familyLabel: 'Maderas Oscuras',
    brand: 'Pelíkano Syncron',
    thicknessSpecs: {
      '15': { sheetCost: 208000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 242000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_cenizo_18',
    name: 'Melamina Cenizo Oscuro Ahumado',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 239000,
    hasGrain: true,
    colorHex: '#3f3b39',
    textureType: 'wood',
    family: 'wood_dark',
    familyLabel: 'Maderas Oscuras',
    brand: 'Arauco Vesto',
    thicknessSpecs: {
      '15': { sheetCost: 205000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 239000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },

  // ==========================================
  // 4. UNICOLORES MATE / SATINADOS
  // ==========================================
  {
    id: 'mat_blanco_18',
    name: 'Melamina Blanco Nieve Frost Mate',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 135000,
    hasGrain: false,
    colorHex: '#f8fafc',
    textureType: 'solid',
    family: 'solid_matte',
    familyLabel: 'Unicolores Mate',
    brand: 'Arauco Clásico',
    thicknessSpecs: {
      '15': { sheetCost: 135000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 165000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_blanco_calido_18',
    name: 'Melamina Blanco Cálido Almendra',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 138000,
    hasGrain: false,
    colorHex: '#f5f3ef',
    textureType: 'solid',
    family: 'solid_matte',
    familyLabel: 'Unicolores Mate',
    brand: 'Pelíkano Mate',
    thicknessSpecs: {
      '15': { sheetCost: 138000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 168000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_arena_18',
    name: 'Melamina Arena Natural Desierto',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 175000,
    hasGrain: false,
    colorHex: '#d8cfc4',
    textureType: 'solid',
    family: 'solid_matte',
    familyLabel: 'Unicolores Mate',
    brand: 'Egger PerfectSense',
    thicknessSpecs: {
      '15': { sheetCost: 145000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 175000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_gris_15',
    name: 'Melamina Gris Humo Neutro',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 142000,
    hasGrain: false,
    colorHex: '#9ca3af',
    textureType: 'solid',
    family: 'solid_matte',
    familyLabel: 'Unicolores Mate',
    brand: 'Arauco Vesto',
    thicknessSpecs: {
      '15': { sheetCost: 142000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 172000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_taupe_18',
    name: 'Melamina Taupe Visón Cálido',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 178000,
    hasGrain: false,
    colorHex: '#8b8076',
    textureType: 'solid',
    family: 'solid_matte',
    familyLabel: 'Unicolores Mate',
    brand: 'Pelíkano Velvet',
    thicknessSpecs: {
      '15': { sheetCost: 148000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 178000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_grafito_18',
    name: 'Melamina Negro Grafito Antihuella',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 185000,
    hasGrain: false,
    colorHex: '#1e293b',
    textureType: 'solid',
    family: 'solid_matte',
    familyLabel: 'Unicolores Mate',
    brand: 'Fundermax Star Favorit',
    thicknessSpecs: {
      '15': { sheetCost: 155000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 185000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_negro_mate_18',
    name: 'Melamina Negro Mate Absoluto',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 188000,
    hasGrain: false,
    colorHex: '#18181b',
    textureType: 'solid',
    family: 'solid_matte',
    familyLabel: 'Unicolores Mate',
    brand: 'Egger PerfectSense',
    thicknessSpecs: {
      '15': { sheetCost: 158000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 188000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_salvia_18',
    name: 'Melamina Verde Salvia Botánico',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 190000,
    hasGrain: false,
    colorHex: '#4a5d4e',
    textureType: 'solid',
    family: 'solid_matte',
    familyLabel: 'Unicolores Mate',
    brand: 'Pelíkano',
    thicknessSpecs: {
      '15': { sheetCost: 160000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 190000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_azul_naval_18',
    name: 'Melamina Azul Naval Océano',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 192000,
    hasGrain: false,
    colorHex: '#1e3a5f',
    textureType: 'solid',
    family: 'solid_matte',
    familyLabel: 'Unicolores Mate',
    brand: 'Arauco Vesto',
    thicknessSpecs: {
      '15': { sheetCost: 162000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 192000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_terracota_18',
    name: 'Melamina Terracota Suave Arcilla',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 190000,
    hasGrain: false,
    colorHex: '#9c533e',
    textureType: 'solid',
    family: 'solid_matte',
    familyLabel: 'Unicolores Mate',
    brand: 'Pelíkano',
    thicknessSpecs: {
      '15': { sheetCost: 160000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 190000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_antracita_18',
    name: 'Melamina Gris Antracita Técnico',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 185000,
    hasGrain: false,
    colorHex: '#334155',
    textureType: 'solid',
    family: 'solid_matte',
    familyLabel: 'Unicolores Mate',
    brand: 'Arauco',
    thicknessSpecs: {
      '15': { sheetCost: 155000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 185000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },

  // ==========================================
  // 5. ALTO BRILLO (HG)
  // ==========================================
  {
    id: 'mat_hg_blanco_18',
    name: 'Melamina Blanco Puro Alto Brillo HG',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 235000,
    hasGrain: false,
    colorHex: '#ffffff',
    textureType: 'gloss',
    family: 'high_gloss',
    familyLabel: 'Alto Brillo (HG)',
    brand: 'Luxe by Alvic',
    thicknessSpecs: {
      '15': { sheetCost: 195000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 235000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_hg_gris_18',
    name: 'Melamina Gris Cálido Alto Brillo HG',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 240000,
    hasGrain: false,
    colorHex: '#b0aba5',
    textureType: 'gloss',
    family: 'high_gloss',
    familyLabel: 'Alto Brillo (HG)',
    brand: 'Luxe by Alvic',
    thicknessSpecs: {
      '15': { sheetCost: 200000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 240000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_hg_grafito_18',
    name: 'Melamina Grafito Titanio Alto Brillo HG',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 245000,
    hasGrain: false,
    colorHex: '#2b2f38',
    textureType: 'gloss',
    family: 'high_gloss',
    familyLabel: 'Alto Brillo (HG)',
    brand: 'Luxe by Alvic',
    thicknessSpecs: {
      '15': { sheetCost: 205000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 245000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_hg_negro_18',
    name: 'Melamina Negro Piano Espejo Alto Brillo HG',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 250000,
    hasGrain: false,
    colorHex: '#0f1115',
    textureType: 'gloss',
    family: 'high_gloss',
    familyLabel: 'Alto Brillo (HG)',
    brand: 'Luxe by Alvic',
    thicknessSpecs: {
      '15': { sheetCost: 210000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 250000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },

  // ==========================================
  // 6. TEXTILES / LINOS (INTERIORES DE CLOSET)
  // ==========================================
  {
    id: 'mat_lino_cancun_18',
    name: 'Melamina Lino Cancún Texturizado',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 170000,
    hasGrain: true,
    colorHex: '#e3dbd0',
    textureType: 'linen',
    family: 'textile_linen',
    familyLabel: 'Textiles y Linos',
    brand: 'Pelíkano Lino',
    thicknessSpecs: {
      '15': { sheetCost: 170000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 205000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_lino_oscuro_18',
    name: 'Melamina Lino Oscuro Antracita',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 210000,
    hasGrain: true,
    colorHex: '#4d4844',
    textureType: 'linen',
    family: 'textile_linen',
    familyLabel: 'Textiles y Linos',
    brand: 'Arauco Vesto Textil',
    thicknessSpecs: {
      '15': { sheetCost: 175000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 210000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_textil_cuerda_18',
    name: 'Melamina Textil Cuerda Yute',
    thickness: 15,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 172000,
    hasGrain: true,
    colorHex: '#c7bca9',
    textureType: 'linen',
    family: 'textile_linen',
    familyLabel: 'Textiles y Linos',
    brand: 'Pelíkano',
    thicknessSpecs: {
      '15': { sheetCost: 172000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 208000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },
  {
    id: 'mat_cuero_vison_18',
    name: 'Melamina Cuero Visón Textil',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 215000,
    hasGrain: false,
    colorHex: '#73655b',
    textureType: 'linen',
    family: 'textile_linen',
    familyLabel: 'Textiles y Linos',
    brand: 'Egger Feelwood',
    thicknessSpecs: {
      '15': { sheetCost: 180000, sheetLength: 2440, sheetWidth: 1830 },
      '18': { sheetCost: 215000, sheetLength: 2440, sheetWidth: 1830 }
    },
    category: 'board'
  },

  // ==========================================
  // 7. PIEDRAS / MÁRMOLES / CUARZOS (MESONES)
  // ==========================================
  {
    id: 'mat_stone_blanco_estelar',
    name: 'Cuarzo Blanco Estelar Silestone (Mesón)',
    thickness: 20,
    sheetLength: 3000,
    sheetWidth: 1600,
    sheetCost: 1380000,
    hasGrain: false,
    colorHex: '#f4f6f8',
    textureType: 'stone',
    family: 'stone_countertop',
    familyLabel: 'Piedras y Mesones',
    brand: 'Cosentino Silestone',
    category: 'countertop'
  },
  {
    id: 'mat_stone_calacatta_oro',
    name: 'Piedra Sinterizada Calacatta Oro (Mesón)',
    thickness: 20,
    sheetLength: 3200,
    sheetWidth: 1600,
    sheetCost: 1550000,
    hasGrain: false,
    colorHex: '#f8f6f0',
    textureType: 'stone',
    family: 'stone_countertop',
    familyLabel: 'Piedras y Mesones',
    brand: 'Neolith / Dekton',
    category: 'countertop'
  },
  {
    id: 'mat_stone_carrara_30',
    name: 'Piedra Mármol Carrara Pulido (Mesón)',
    thickness: 30,
    sheetLength: 3000,
    sheetWidth: 1600,
    sheetCost: 1450000,
    hasGrain: false,
    colorHex: '#f8fafc',
    textureType: 'stone',
    family: 'stone_countertop',
    familyLabel: 'Piedras y Mesones',
    brand: 'Natural Stone Selection',
    category: 'countertop'
  },
  {
    id: 'mat_stone_granite_black_30',
    name: 'Granito Negro San Gabriel (Mesón)',
    thickness: 30,
    sheetLength: 2800,
    sheetWidth: 1600,
    sheetCost: 1180000,
    hasGrain: false,
    colorHex: '#1e293b',
    textureType: 'stone',
    family: 'stone_countertop',
    familyLabel: 'Piedras y Mesones',
    brand: 'Granitos Naturales Pro',
    category: 'countertop'
  },
  {
    id: 'mat_stone_pietra_grey',
    name: 'Mármol Pietra Grey Apomazado (Mesón)',
    thickness: 20,
    sheetLength: 3000,
    sheetWidth: 1600,
    sheetCost: 1420000,
    hasGrain: false,
    colorHex: '#4a4e54',
    textureType: 'stone',
    family: 'stone_countertop',
    familyLabel: 'Piedras y Mesones',
    brand: 'Natural Stone Selection',
    category: 'countertop'
  },
  {
    id: 'mat_stone_terrazzo',
    name: 'Terrazzo Veneciano Nórdico (Mesón)',
    thickness: 20,
    sheetLength: 3000,
    sheetWidth: 1400,
    sheetCost: 1280000,
    hasGrain: false,
    colorHex: '#edeae4',
    textureType: 'stone',
    family: 'stone_countertop',
    familyLabel: 'Piedras y Mesones',
    brand: 'Agglotech Terrazzo',
    category: 'countertop'
  },
  {
    id: 'mat_stone_quartz_polar_20',
    name: 'Cuarzo Blanco Polar Silestone (Mesón)',
    thickness: 20,
    sheetLength: 3000,
    sheetWidth: 1600,
    sheetCost: 1320000,
    hasGrain: false,
    colorHex: '#f1f5f9',
    textureType: 'stone',
    family: 'stone_countertop',
    familyLabel: 'Piedras y Mesones',
    brand: 'Cosentino Silestone',
    category: 'countertop'
  },
  {
    id: 'mat_stone_dekton_gray_20',
    name: 'Piedra Sinterizada Gris Dekton (Mesón)',
    thickness: 20,
    sheetLength: 3200,
    sheetWidth: 1440,
    sheetCost: 1680000,
    hasGrain: false,
    colorHex: '#64748b',
    textureType: 'stone',
    family: 'stone_countertop',
    familyLabel: 'Piedras y Mesones',
    brand: 'Cosentino Dekton',
    category: 'countertop'
  },
  {
    id: 'mat_wood_butcher_36',
    name: 'Madera Roble Macizo Alistonado (Mesón)',
    thickness: 36,
    sheetLength: 2440,
    sheetWidth: 1220,
    sheetCost: 620000,
    hasGrain: true,
    colorHex: '#b47b48',
    textureType: 'wood',
    family: 'stone_countertop',
    familyLabel: 'Piedras y Mesones',
    brand: 'Maderas Finas Macizas',
    category: 'countertop'
  },

  // ==========================================
  // 8. FONDOS DE DUROLAC / MDF (3mm)
  // ==========================================
  {
    id: 'mat_mdf_3',
    name: 'MDF Durolac Blanco',
    thickness: 3,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 45000,
    hasGrain: false,
    colorHex: '#e5e5e5',
    textureType: 'solid',
    family: 'mdf_back',
    familyLabel: 'Fondos Durolac MDF',
    brand: 'Arauco Trupan',
    category: 'mdf'
  },
  {
    id: 'mat_mdf_gris_3',
    name: 'MDF Durolac Gris Perla',
    thickness: 3,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 45000,
    hasGrain: false,
    colorHex: '#a0a0a0',
    textureType: 'solid',
    family: 'mdf_back',
    familyLabel: 'Fondos Durolac MDF',
    brand: 'Arauco Trupan',
    category: 'mdf'
  },
  {
    id: 'mat_mdf_madera_3',
    name: 'MDF Durolac Roble Miel',
    thickness: 3,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 48000,
    hasGrain: true,
    colorHex: '#c29b68',
    textureType: 'wood',
    family: 'mdf_back',
    familyLabel: 'Fondos Durolac MDF',
    brand: 'Arauco Trupan',
    category: 'mdf'
  }
];
