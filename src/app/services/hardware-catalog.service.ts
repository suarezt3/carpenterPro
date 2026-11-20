import { Injectable } from '@angular/core';
import {
  HandleType,
  HandleFinish,
  HingeType,
  SlideType,
  OpeningDirection,
  PartHardwareConfig,
  Part,
  HardwareItem,
  ApplianceItem,
  CabinetGolaFinish,
  CabinetLegStyle,
  CabinetRodFinish,
  CabinetVitrinaFrameFinish,
  CabinetVitrinaGlassType
} from '../models/melamine.models';

export interface HandleOption {
  id: HandleType;
  name: string;
  category: 'bar' | 'knob' | 'profile' | 'cup' | 'none';
  description: string;
  defaultLength: number; // mm
  supportedFinishes: HandleFinish[];
  unitCost: number; // USD / Pesos
  icon: string;
}

export interface HingeOption {
  id: HingeType;
  name: string;
  cupDiameter: number; // 35mm
  openingAngle: string; // ej. 110°
  description: string;
  unitCost: number;
  icon: string;
}

export interface SlideOption {
  id: SlideType;
  name: string;
  extensionType: string;
  loadCapacityKg: number;
  description: string;
  unitCost: number; // par
  icon: string;
}

export interface TableLegHardwareOption {
  id: string;
  name: string;
  style: 'hairpin' | 'cylindrical_inox' | 'scandinavian_wood';
  height: number;
  description: string;
  unitCost: number;
  icon: string;
  finish: string;
  material: string;
}

@Injectable({
  providedIn: 'root'
})
export class HardwareCatalogService {

  readonly tableLegOptions: TableLegHardwareOption[] = [
    {
      id: 'hw_leg_hairpin_720',
      name: 'Pata Horquilla Triple Varilla 72cm (Negro Mate)',
      style: 'hairpin',
      height: 720,
      description: 'Acero macizo electroestático de 12mm con pletina de 3 orificios y regatón de goma.',
      unitCost: 48000,
      icon: 'table_bar',
      finish: 'Negro Mate',
      material: 'Acero'
    },
    {
      id: 'hw_leg_hairpin_400',
      name: 'Pata Horquilla Doble Varilla 40cm (Mesa Centro)',
      style: 'hairpin',
      height: 400,
      description: 'Ideal para mesas de centro, mesas ratonas y muebles de TV modernos.',
      unitCost: 36000,
      icon: 'table_bar',
      finish: 'Negro Mate',
      material: 'Acero'
    },
    {
      id: 'hw_leg_cylindrical_720',
      name: 'Pata Cilíndrica Inox Ø60mm Regulable 720mm',
      style: 'cylindrical_inox',
      height: 720,
      description: 'Tubo de acero inoxidable cepillado con base roscada niveladora (+25mm) y brida superior.',
      unitCost: 38000,
      icon: 'table_bar',
      finish: 'Inox Satinado',
      material: 'Acero Inox'
    },
    {
      id: 'hw_leg_cylindrical_100',
      name: 'Pata Cilíndrica Inox 100mm para Mueble Bajo',
      style: 'cylindrical_inox',
      height: 100,
      description: 'Pata niveladora para zócalos de muebles bajos de cocina y alacenas.',
      unitCost: 18000,
      icon: 'table_bar',
      finish: 'Inox Satinado',
      material: 'Acero Inox'
    },
    {
      id: 'hw_leg_scandinavian_720',
      name: 'Pata Cónica Madera Haya Nórdica 72cm Casquillo Dorado',
      style: 'scandinavian_wood',
      height: 720,
      description: 'Madera de haya maciza torneada con placa metálica inclinada 10° y casquillo de latón dorado.',
      unitCost: 46000,
      icon: 'table_bar',
      finish: 'Madera Natural + Oro',
      material: 'Madera Maciza'
    },
    {
      id: 'hw_leg_scandinavian_400',
      name: 'Pata Cónica Madera Haya Nórdica 40cm (Mesa Auxiliar)',
      style: 'scandinavian_wood',
      height: 400,
      description: 'Pata baja escandinava para mesas auxiliares, mesitas de noche y muebles nórdicos.',
      unitCost: 34000,
      icon: 'table_bar',
      finish: 'Madera Natural + Oro',
      material: 'Madera Maciza'
    }
  ];

  readonly handleOptions: HandleOption[] = [
    {
      id: 'bar_modern',
      name: 'Tirador Barra Tubular Inox',
      category: 'bar',
      description: 'Diseño moderno cilíndrico contemporáneo con doble pie de fijación (160mm C-C).',
      defaultLength: 160,
      supportedFinishes: ['brushed_steel', 'black', 'gold', 'chrome'],
      unitCost: 14500,
      icon: 'maximize'
    },
    {
      id: 'bar_black',
      name: 'Tirador Barra Negro Slim',
      category: 'bar',
      description: 'Barra rectangular minimalista acabado negro mate electroestático (192mm C-C).',
      defaultLength: 192,
      supportedFinishes: ['black', 'brushed_steel', 'gold'],
      unitCost: 16800,
      icon: 'linear_scale'
    },
    {
      id: 'knob_round',
      name: 'Pomo Redondo Minimalista',
      category: 'knob',
      description: 'Pomo circular macizo Ø28mm con vástago cónico para puertas y cajones.',
      defaultLength: 28,
      supportedFinishes: ['brushed_steel', 'black', 'gold', 'chrome'],
      unitCost: 8500,
      icon: 'radio_button_checked'
    },
    {
      id: 'knob_square',
      name: 'Pomo Cuadrado Geométrico',
      category: 'knob',
      description: 'Pomo cúbico 24×24mm de líneas puras para muebles modernos y minimalistas.',
      defaultLength: 24,
      supportedFinishes: ['black', 'brushed_steel', 'gold'],
      unitCost: 9600,
      icon: 'crop_square'
    },
    {
      id: 'cup_vintage',
      name: 'Tirador Concha Vintage',
      category: 'cup',
      description: 'Tirador estilo concha tradicional para cajones clásicos o provenzales.',
      defaultLength: 96,
      supportedFinishes: ['black', 'brushed_steel', 'gold'],
      unitCost: 12800,
      icon: 'archive'
    },
    {
      id: 'none',
      name: 'Sin Tirador (Push-to-Open)',
      category: 'none',
      description: 'Apertura táctil por pulsador mecánico o ranura rebajada.',
      defaultLength: 0,
      supportedFinishes: [],
      unitCost: 0,
      icon: 'block'
    }
  ];

  readonly hingeOptions: HingeOption[] = [
    {
      id: 'straight',
      name: 'Bisagra Recta (Parche / Solapada)',
      cupDiameter: 35,
      openingAngle: '110°',
      description: 'Cubre completamente el lateral del mueble (18mm de cobertura). Uso universal.',
      unitCost: 8500,
      icon: 'meeting_room'
    },
    {
      id: 'half_cranked',
      name: 'Bisagra Semicodo (Semiparche)',
      cupDiameter: 35,
      openingAngle: '110°',
      description: 'Para dos puertas que comparten un mismo tabique central divisorio (9mm cobertura).',
      unitCost: 8800,
      icon: 'door_front'
    },
    {
      id: 'full_cranked',
      name: 'Bisagra Codo (Interior / Embutida)',
      cupDiameter: 35,
      openingAngle: '110°',
      description: 'Para puertas que cierran dentro del vano / marco del mueble (enrasadas).',
      unitCost: 9200,
      icon: 'sensor_door'
    },
    {
      id: 'corner_45',
      name: 'Bisagra Angular 45° (Esquineros)',
      cupDiameter: 35,
      openingAngle: '45°',
      description: 'Para muebles esquineros pentagonales y módulos en chaflán.',
      unitCost: 14500,
      icon: 'meeting_room'
    },
    {
      id: 'corner_165',
      name: 'Bisagra Gran Apertura 165° (Rincón Ciego)',
      cupDiameter: 35,
      openingAngle: '165°',
      description: 'Articulada de gran ángulo para acceso completo a esquinas ciegas.',
      unitCost: 18500,
      icon: 'door_front'
    },
    {
      id: 'gas_piston',
      name: 'Pistón a Gas Elevable 100N',
      cupDiameter: 35,
      openingAngle: '90° Basculante',
      description: 'Brazo hidráulico de elevación para puertas basculantes superiores de alacena.',
      unitCost: 18000,
      icon: 'vertical_align_top'
    },
    {
      id: 'none',
      name: 'Sin Bisagras',
      cupDiameter: 0,
      openingAngle: '0°',
      description: 'Sin mecanismo pivotante.',
      unitCost: 0,
      icon: 'block'
    }
  ];

  readonly slideOptions: SlideOption[] = [
    {
      id: 'telescopic',
      name: 'Corredera Telescópica 45mm',
      extensionType: 'Extensión Total (35-45kg)',
      loadCapacityKg: 45,
      description: 'Extracción total con rodamientos de bolas de acero templado. Holgura requerida 12.7mm por lado.',
      unitCost: 24000,
      icon: 'view_week'
    },
    {
      id: 'soft_close',
      name: 'Corredera Telescópica Cierre Suave (Soft-Close)',
      extensionType: 'Extensión Total con Freno Hidráulico',
      loadCapacityKg: 40,
      description: 'Pistón amortiguador hidráulico integrado para cierre silencioso y suave antipellizco.',
      unitCost: 35600,
      icon: 'motion_photos_paused'
    },
    {
      id: 'push_open',
      name: 'Corredera Telescópica Push-to-Open (Apertura por presión)',
      extensionType: 'Extensión Total con Expulsión Táctil',
      loadCapacityKg: 40,
      description: 'Mecanismo expulsor mecánico integrado para frentes lisos sin manija (apertura al presionar).',
      unitCost: 38500,
      icon: 'view_week'
    },
    {
      id: 'undermount',
      name: 'Corredera Oculta Bajo Cajón (Tandem)',
      extensionType: 'Extensión Total Oculta Sincronizada',
      loadCapacityKg: 40,
      description: 'Montaje invisible bajo el fondo del cajón con regulación 3D y gatillos de desacople rápido.',
      unitCost: 58000,
      icon: 'layers'
    },
    {
      id: 'telescopic_35',
      name: 'Corredera Telescópica Ligera 35mm',
      extensionType: 'Extensión Total (25kg)',
      loadCapacityKg: 25,
      description: 'Perfil compacto de 35mm para cajones medianos o de baja profundidad. Holgura 12.5mm.',
      unitCost: 18000,
      icon: 'linear_scale'
    },
    {
      id: 'none',
      name: 'Sin Corredera',
      extensionType: 'Ninguna',
      loadCapacityKg: 0,
      description: 'Sin guía metálica.',
      unitCost: 0,
      icon: 'block'
    }
  ];

  // Calcula la cantidad técnica de bisagras de cazoleta Ø35mm según el largo del borde abisagrado (FASE 1.2)
  computeHingeCountForDoor(hingedEdgeLengthMm: number): number {
    const span = Math.max(0, Number(hingedEdgeLengthMm) || 0);
    if (span <= 900) return 2;
    if (span <= 1600) return 3;
    return 4;
  }

  // Calcula los desplazamientos centrados [-L/2, +L/2] en mm con margen de 100 mm en los extremos (FASE 1.2)
  computeHingeOffsetsMm(hingedEdgeLengthMm: number): number[] {
    const L = Math.max(100, Number(hingedEdgeLengthMm) || 600);
    const margin = Math.min(100, Math.max(35, L * 0.2));
    const start = -L / 2 + margin;
    const end = L / 2 - margin;
    const count = this.computeHingeCountForDoor(L);
    if (count === 2) {
      return [start, end];
    }
    if (count === 3) {
      return [start, 0, end];
    }
    const step = (end - start) / 3;
    return [start, start + step, start + 2 * step, end];
  }

  // Identifica si una pieza es puerta o cajón por rol o nombre
  detectMovableType(part: Part): { movableType: 'door' | 'drawer' | 'none'; direction: OpeningDirection } {
    if (part.hardwareConfig?.isMovable === false) {
      return { movableType: 'none', direction: 'left' };
    }
    if (part.hardwareConfig?.movableType) {
      return {
        movableType: part.hardwareConfig.movableType,
        direction: part.hardwareConfig.openingDirection || (part.hardwareConfig.movableType === 'door' ? 'left' : 'top')
      };
    }

    const n = (part.name || '').toUpperCase();
    const role = part.componentRole;

    // Respetar roles estructurales/libres explícitos sin aplicar heurísticas heredadas por nombre
    if (role && role !== 'door' && role !== 'drawer_front') {
      return { movableType: 'none', direction: 'left' };
    }

    if (role === 'door' || n.includes('PUERTA')) {
      if (n.includes('ABATIBLE INFERIOR')) {
        return { movableType: 'door', direction: 'bottom' };
      }
      if (
        n.includes('ABATIBLE SUPERIOR') ||
        n.includes('BASCULANTE') ||
        n.includes('ELEVABLE') ||
        n.includes('ALACENA') ||
        n.includes('PISTON') ||
        n.includes('PISTÓN')
      ) {
        return { movableType: 'door', direction: 'top' };
      }
      if (n.includes('DER') || n.includes('DERECHA') || (part.posX || 0) > 0) {
        return { movableType: 'door', direction: 'right' };
      }
      return { movableType: 'door', direction: 'left' };
    }

    if (role === 'drawer_front' || n.includes('CAJON') || n.includes('CAJÓN') || n.includes('GAVETA') || part.id.includes('caj_ind_')) {
      return { movableType: 'drawer', direction: 'top' };
    }

    return { movableType: 'none', direction: 'left' };
  }

  // Genera la configuración de herrajes por defecto para cualquier pieza
  getDefaultHardwareConfig(part: Part): PartHardwareConfig {
    const detected = this.detectMovableType(part);

    if (detected.movableType === 'door') {
      const isBasculante = detected.direction === 'top';
      const isHorizontalHandle = detected.direction === 'top' || detected.direction === 'bottom';
      return {
        isMovable: true,
        movableType: 'door',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        handleLength: 160,
        handlePosition: isHorizontalHandle ? 'horizontal' : 'vertical',
        hingeType: isBasculante ? 'gas_piston' : 'straight',
        openingDirection: detected.direction,
        isOpen: false
      };
    }

    if (detected.movableType === 'drawer') {
      return {
        isMovable: true,
        movableType: 'drawer',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        handleLength: 160,
        handlePosition: 'horizontal',
        slideType: 'telescopic',
        isOpen: false
      };
    }

    return {
      isMovable: false,
      movableType: 'none',
      handleType: 'none',
      handleFinish: 'brushed_steel',
      hingeType: 'none',
      slideType: 'none',
      isOpen: false
    };
  }

  // Resuelve color hexadecimal 3D para el acabado del tirador
  getFinishHexColor(finish?: HandleFinish): number {
    switch (finish) {
      case 'black': return 0x18181b;
      case 'gold': return 0xd97706;
      case 'chrome': return 0xe2e8f0;
      case 'white': return 0xf8fafc;
      case 'brushed_steel':
      default:
        return 0x94a3b8;
    }
  }

  // Genera lista consolidada de herrajes requeridos para presupuesto y compra en COP
  computeRequiredHardwareList(parts: Part[], _appliances: ApplianceItem[] = []): HardwareItem[] {
    void _appliances;
    let hingesStraight = 0;
    let hinges45 = 0;
    let hinges165 = 0;
    let hingesGas = 0;
    let compasAbatibleCount = 0;
    let drawersCount = 0;
    let pushDrawersCount = 0;
    let undermountDrawersCount = 0;
    let pushDoorsCount = 0;
    let handlesCount = 0;
    let slidingDoorsCount = 0;
    let slidingTrackMm = 0;
    let shoeStopAluminumMm = 0;
    let concealedHangersCount = 0;
    let movableShelvesCount = 0;
    const slidingBayCounts = new Map<string, { leaves: number; explicit3Leaves: boolean; hasZone: boolean }>();
    const legCounts = new Map<CabinetLegStyle, number>();
    const rodCounts = new Map<CabinetRodFinish, number>();
    const golaMmByFinish = new Map<CabinetGolaFinish, number>();
    const vitrinaFrameMm = new Map<CabinetVitrinaFrameFinish, number>();
    const vitrinaGlassM2 = new Map<CabinetVitrinaGlassType, number>();
    const wallAnchorModuleIds = new Set<string>();

    const inferLegStyle = (part: Part, lowerName: string): CabinetLegStyle => {
      if (part.hardwareConfig?.legStyle) return part.hardwareConfig.legStyle;
      const matId = part.materialId || '';
      if (matId === 'hw_leg_black_leveler' || lowerName.includes('niveladora negra')) {
        return 'black_leveler';
      }
      if (
        matId === 'hw_leg_scandinavian_wood' ||
        lowerName.includes('nórdica') ||
        lowerName.includes('nordica')
      ) {
        return 'scandinavian_wood';
      }
      if (matId === 'hw_leg_hairpin_metal' || lowerName.includes('horquilla')) {
        return 'hairpin_metal';
      }
      return 'cylindrical_inox';
    };

    const inferRodFinish = (part: Part, lowerName: string): CabinetRodFinish => {
      if (part.hardwareConfig?.rodFinish) return part.hardwareConfig.rodFinish;
      const matId = part.materialId || '';
      if (matId === 'hw_rod_matte_black' || lowerName.includes('negro mate')) {
        return 'matte_black';
      }
      if (matId === 'hw_rod_gold' || lowerName.includes('dorada') || lowerName.includes('dorado')) {
        return 'gold';
      }
      return 'chrome';
    };

    const inferGolaFinish = (part: Part, lowerName: string): CabinetGolaFinish => {
      if (part.hardwareConfig?.golaFinish) return part.hardwareConfig.golaFinish;
      const matId = part.materialId || '';
      if (matId === 'hw_gola_matte_black' || lowerName.includes('negro mate')) {
        return 'matte_black';
      }
      if (matId === 'hw_gola_white' || lowerName.includes('blanco')) {
        return 'white';
      }
      if (matId === 'hw_gola_champagne' || lowerName.includes('champagne')) {
        return 'champagne';
      }
      return 'natural_aluminum';
    };

    for (const part of parts) {
      const n = (part.name || '').toLowerCase();
      const notes = (part.notes || '').toLowerCase();
      const mod = (part.moduleName || part.groupName || '').toLowerCase();
      const matId = part.materialId || '';
      const qty = Number(part.quantity) || 1;

      // 0. Patas físicas de módulo por estilo (excluye appliances)
      const isCabinetLeg =
        part.componentRole === 'accessory' &&
        (Boolean(part.hardwareConfig?.legStyle) ||
          matId.startsWith('hw_leg_') ||
          n.includes('pata'));
      if (isCabinetLeg) {
        const legStyle = inferLegStyle(part, n);
        legCounts.set(legStyle, (legCounts.get(legStyle) ?? 0) + qty);
        continue;
      }

      // 0b. Perfiles Gola horizontales (metros lineales por acabado)
      const isGolaProfile =
        part.componentRole === 'accessory' &&
        (matId.startsWith('hw_gola_') ||
          n.includes('perfil gola') ||
          part.hardwareConfig?.handleType === 'gola_less');
      if (isGolaProfile) {
        const gFinish = inferGolaFinish(part, n);
        const lenMm = Math.max(0, Number(part.length) || 0) * qty;
        golaMmByFinish.set(gFinish, (golaMmByFinish.get(gFinish) ?? 0) + lenMm);
        continue;
      }

      // 0c. Colgadores ocultos murales
      const isConcealedHanger =
        part.componentRole === 'accessory' &&
        (part.hardwareConfig?.wallMountType === 'concealed_hanger' ||
          matId === 'hw_wall_concealed_hanger' ||
          n.includes('colgador oculto'));
      if (isConcealedHanger) {
        concealedHangersCount += qty;
        continue;
      }

      // 0d. Amarres o listones franceses de anclaje a muro
      if (
        part.componentRole === 'tie' &&
        (part.hardwareConfig?.wallMountType === 'french_cleat' ||
          part.hardwareConfig?.wallMountType === 'direct_nailer' ||
          n.includes('listón francés') ||
          n.includes('liston frances') ||
          n.includes('amarre trasero'))
      ) {
        const modKey = part.moduleId || part.groupId || part.id;
        wallAnchorModuleIds.add(modKey);
        continue;
      }

      // 0e. Rieles de sistema corredizo (metros lineales)
      const isSlidingTrack =
        part.componentRole === 'accessory' &&
        (matId === 'hw_sliding_track' || (n.includes('riel') && n.includes('corrediz')));
      if (isSlidingTrack) {
        slidingTrackMm += Math.max(0, Number(part.length) || 0) * qty;
        continue;
      }

      // 0f. Tope frontal aluminio de zapatero (metros lineales)
      const isAluminumShoeStop =
        part.componentRole === 'accessory' &&
        (matId === 'hw_shoe_stop_aluminum' ||
          n.includes('tope frontal aluminio') ||
          part.hardwareConfig?.shoeRackFrontStopType === 'aluminum_profile');
      if (isAluminumShoeStop) {
        shoeStopAluminumMm += Math.max(0, Number(part.length) || 0) * qty;
        continue;
      }

      // 1. Barra / Tubo Colgador por acabado (Closets / Armarios / Zonas)
      const isRod =
        (part.componentRole === 'accessory' &&
          (matId.startsWith('hw_rod_') || Boolean(part.hardwareConfig?.rodFinish))) ||
        (part.shapeType === 'circle' &&
          (n.includes('tubo') || n.includes('colgador') || n.includes('barra'))) ||
        notes.includes('colgador') ||
        notes.includes('tubo') ||
        n.includes('colgador');
      if (isRod) {
        const rFinish = inferRodFinish(part, n);
        rodCounts.set(rFinish, (rodCounts.get(rFinish) ?? 0) + qty);
        continue;
      }

      // 1b. Repisas móviles regulables (4 soportes metálicos por repisa móvil; excluye fijas, nicho y zapateros)
      const isShelfPart =
        part.componentRole === 'shelf' ||
        n.includes('repisa') ||
        n.includes('entrepaño') ||
        n.includes('entrepano');
      const isMovableShelf =
        isShelfPart &&
        !part.hardwareConfig?.isStructuralFixedShelf &&
        part.hardwareConfig?.shoeRackAngleDeg === undefined &&
        part.hardwareConfig?.isMovableShelf !== false &&
        (part.hardwareConfig?.isMovableShelf === true ||
          notes.includes('móvil') ||
          notes.includes('movil') ||
          notes.includes('regulable'));
      if (isMovableShelf) {
        movableShelvesCount += qty;
        continue;
      }

      // Ignorar piezas estructurales internas de la caja del cajón salvo que sean el contrafrente de un cajón oculto sin tapa vista
      const isDrawerBoxInternal =
        part.componentRole === 'drawer_box' ||
        part.componentRole === 'drawer_lateral' ||
        part.componentRole === 'drawer_bottom' ||
        (part.thickness !== undefined && part.thickness <= 6 && (n.includes('fondo') || n.includes('caj')));
      if (isDrawerBoxInternal && !part.hardwareConfig?.isMovable) {
        continue;
      }

      const detected = this.detectMovableType(part);
      if (detected.movableType === 'none') {
        continue;
      }
      const hw = part.hardwareConfig || this.getDefaultHardwareConfig(part);

      const hasPhysicalHandle =
        Boolean(hw.handleType) &&
        hw.handleType !== 'none' &&
        hw.handleType !== 'push' &&
        hw.handleType !== 'push_open' &&
        hw.handleType !== 'gola_less' &&
        hw.handleType !== 'gola' &&
        hw.handleType !== 'finger_pull' &&
        hw.openingSystem !== 'push' &&
        hw.openingSystem !== 'finger_pull' &&
        hw.openingSystem !== 'gola' &&
        hw.handlePosition !== 'none';

      const isVitrinaDoor =
        (detected.movableType === 'door' || part.componentRole === 'door') &&
        (hw.doorPanelStyle === 'vitrina' || matId === 'vitrina_aluminio_vidrio');
      if (isVitrinaDoor) {
        const vFrame: CabinetVitrinaFrameFinish = hw.vitrinaFrameFinish || 'matte_black';
        const vGlass: CabinetVitrinaGlassType = hw.vitrinaGlassType || 'clear';
        const lenMm = Math.max(0, Number(part.length) || 0);
        const widMm = Math.max(0, Number(part.width) || 0);
        vitrinaFrameMm.set(
          vFrame,
          (vitrinaFrameMm.get(vFrame) ?? 0) + 2 * (lenMm + widMm) * qty
        );
        vitrinaGlassM2.set(
          vGlass,
          (vitrinaGlassM2.get(vGlass) ?? 0) + ((lenMm * widMm) / 1_000_000) * qty
        );
      }

      // 2. Puertas corredizas (detecta por nombre/notas sin exigir 'closet' en el nombre del módulo)
      const isExplicitlyHinged =
        notes.includes('abatible') ||
        hw.hingeType === 'straight' ||
        hw.hingeType === 'half_cranked' ||
        hw.hingeType === 'full_cranked' ||
        hw.hingeType === 'corner_45' ||
        hw.hingeType === 'corner_165' ||
        hw.hingeType === 'gas_piston';
      const isSlidingDoor =
        (detected.movableType === 'door' || part.componentRole === 'door') &&
        (n.includes('corrediz') ||
          notes.includes('corrediz') ||
          notes.includes('riel') ||
          hw.slidingLeavesCount !== undefined ||
          (mod.includes('closet') && !isExplicitlyHinged));

      const isPushDoor =
        hw.openingSystem === 'push' ||
        hw.handleType === 'push' ||
        hw.handleType === 'push_open';

      if (isSlidingDoor) {
        slidingDoorsCount += qty;
        const bayKey = part.zoneId
          ? `${part.groupId || part.moduleId || 'default'}::${part.zoneId}`
          : part.groupId || part.moduleId || 'default';
        const prevBay = slidingBayCounts.get(bayKey) ?? {
          leaves: 0,
          explicit3Leaves: false,
          hasZone: Boolean(part.zoneId)
        };
        slidingBayCounts.set(bayKey, {
          leaves: prevBay.leaves + qty,
          explicit3Leaves: prevBay.explicit3Leaves || hw.slidingLeavesCount === 3,
          hasZone: prevBay.hasZone || Boolean(part.zoneId)
        });
        if (isPushDoor) {
          pushDoorsCount += qty;
        }
        if (hasPhysicalHandle) {
          handlesCount += qty;
        }
        continue;
      }

      if (detected.movableType === 'door') {
        const upperName = (part.name || '').toUpperCase();
        const openingDir = hw.openingDirection || detected.direction;

        // Pistones neumáticos elevables (alacenas / abatible superior)
        const isLiftUp =
          hw.hingeType === 'gas_piston' ||
          openingDir === 'top' ||
          upperName.includes('ABATIBLE SUPERIOR') ||
          upperName.includes('PISTON') ||
          upperName.includes('PISTÓN') ||
          upperName.includes('BASCULANTE') ||
          upperName.includes('ELEVABLE') ||
          upperName.includes('ALACENA');

        const isBottomFoldDown =
          openingDir === 'bottom' || upperName.includes('ABATIBLE INFERIOR');
        const isHorizontalHinge = isLiftUp || isBottomFoldDown;
        const isRotated90Z = Math.abs(Math.round(part.rotationZ || 0) % 180) === 90;
        const horizontalWidth =
          part.orientation === 'vertical_xy'
            ? (isRotated90Z ? part.width : part.length)
            : part.orientation === 'vertical_yz'
              ? part.width
              : Math.min(part.length, part.width);
        const verticalHeight =
          part.orientation === 'vertical_xy'
            ? (isRotated90Z ? part.length : part.width)
            : Math.max(part.length, part.width);

        const hingedSpan = isHorizontalHinge ? horizontalWidth : verticalHeight;
        const perDoorHinges =
          typeof hw.hingeCount === 'number' && hw.hingeCount > 0
            ? Math.round(hw.hingeCount)
            : this.computeHingeCountForDoor(hingedSpan);
        const hingesNeeded = perDoorHinges * qty;

        // Bisagras angulares de 45° (esquineros pentagonales)
        const is45 = hw.hingeType === 'corner_45' || n.includes('45°') || notes.includes('45°') || part.rotationY === 45 || n.includes('diagonal');
        // Bisagras angulares de 165° (rincón ciego)
        const is165 = hw.hingeType === 'corner_165' || n.includes('165°') || notes.includes('165°') || n.includes('acceso a rincón') || notes.includes('rincón') || notes.includes('ciego') || n.includes('ciego');

        if (isLiftUp) {
          // Puerta Abatible Superior requiere TANTO los 2 pistones a gas COMO las bisagras de cazoleta Ø35mm superiores (FASE 4.2)
          hingesGas += 2 * qty;
          if (hw.hingeType !== 'none') {
            hingesStraight += hingesNeeded;
          }
        } else if (isBottomFoldDown) {
          compasAbatibleCount += (horizontalWidth >= 600 ? 2 : 1) * qty;
          if (hw.hingeType !== 'none') {
            hingesStraight += hingesNeeded;
          }
        } else if (is45) {
          hinges45 += hingesNeeded;
        } else if (is165) {
          hinges165 += hingesNeeded;
        } else if (hw.hingeType !== 'none') {
          hingesStraight += hingesNeeded;
        }

        if (isPushDoor) {
          pushDoorsCount += qty;
        }

        if (hasPhysicalHandle) {
          handlesCount += qty;
        }
      } else if (detected.movableType === 'drawer') {
        const isUndermount =
          hw.slideType === 'undermount' ||
          notes.includes('oculta') ||
          notes.includes('undermount');
        const isPushOpen =
          hw.slideType === 'push_open' ||
          hw.openingSystem === 'push' ||
          hw.drawerOpeningSystem === 'push' ||
          hw.handleType === 'push' ||
          hw.handleType === 'push_open' ||
          notes.includes('push-to-open') ||
          notes.includes('apertura por presión');
        const isHandlelessProfile =
          hw.openingSystem === 'finger_pull' ||
          hw.openingSystem === 'gola' ||
          hw.drawerOpeningSystem === 'finger_pull' ||
          hw.drawerOpeningSystem === 'gola' ||
          hw.handleType === 'finger_pull' ||
          hw.handleType === 'gola_less' ||
          hw.handleType === 'gola' ||
          Boolean(hw.isInternalDrawerFront) ||
          notes.includes('uñero') ||
          notes.includes('gola');

        if (isUndermount) {
          undermountDrawersCount += qty;
        } else if (isPushOpen) {
          pushDrawersCount += qty;
        } else {
          drawersCount += qty;
        }

        if (!isPushOpen && !isHandlelessProfile && hasPhysicalHandle) {
          handlesCount += qty;
        }
      }
    }

    const items: HardwareItem[] = [];

    if (hingesStraight > 0) {
      items.push({
        id: 'hw_bisagra_35',
        name: 'Bisagra Cazoleta Ø35mm Cierre Suave (Parche)',
        category: 'hinge',
        unit: 'und',
        quantity: hingesStraight,
        unitCost: 8500,
        notes: 'Incluye base de regulación y tornillos 3.5×15mm'
      });
    }

    if (hinges45 > 0) {
      items.push({
        id: 'hw_bisagra_45',
        name: 'Bisagra Angular 45° para Mueble Esquinero Pentagonal',
        category: 'hinge',
        unit: 'und',
        quantity: hinges45,
        unitCost: 14500,
        notes: 'Ángulo negativo/positivo para puertas en chaflán a 45°'
      });
    }

    if (hinges165 > 0) {
      items.push({
        id: 'hw_bisagra_165',
        name: 'Bisagra Gran Apertura 165° para Rincón Ciego',
        category: 'hinge',
        unit: 'und',
        quantity: hinges165,
        unitCost: 18500,
        notes: 'Brazo articulado zero-protrusion para acceso total a esquinas ciegas'
      });
    }

    if (hingesGas > 0) {
      items.push({
        id: 'hw_piston_gas',
        name: 'Brazo Pistón Neumático a Gas 100N para Alacena',
        category: 'accessory',
        unit: 'und',
        quantity: hingesGas,
        unitCost: 18000,
        notes: 'Fuerza 100N con fijaciones para marco y puerta elevable'
      });
    }

    if (compasAbatibleCount > 0) {
      items.push({
        id: 'hw_compas_abatible',
        name: 'Compás / Retenedor Puerta Abatible Inferior',
        category: 'accessory',
        unit: 'und',
        quantity: compasAbatibleCount,
        unitCost: 19500,
        notes: 'Compás retenedor con apertura amortiguada para puerta abatible inferior'
      });
    }

    if (pushDoorsCount > 0) {
      items.push({
        id: 'hw_push_door_piston',
        name: 'Espaciador / Expulsor Push-to-Open Puerta',
        category: 'accessory',
        unit: 'und',
        quantity: pushDoorsCount,
        unitCost: 9500,
        notes: 'Expulsor de apertura por presión con pletina magnética para puerta sin tirador'
      });
    }

    if (drawersCount > 0) {
      items.push({
        id: 'hw_correderas',
        name: 'Corredera Telescópica 45mm H45 Cierre Suave (Par)',
        category: 'slide',
        unit: 'par',
        quantity: drawersCount,
        unitCost: 24000,
        notes: 'Capacidad 40kg por cajón con rodamientos y freno hidráulico'
      });
    }

    if (pushDrawersCount > 0) {
      items.push({
        id: 'hw_correderas_push',
        name: 'Corredera Telescópica Push-to-Open (Apertura por presión)',
        category: 'slide',
        unit: 'par',
        quantity: pushDrawersCount,
        unitCost: 38500,
        notes: 'Mecanismo expulsor táctil integrado para frente liso sin manija'
      });
    }

    if (undermountDrawersCount > 0) {
      items.push({
        id: 'hw_correderas_oculta',
        name: 'Par Correderas Ocultas Cierre Suave',
        category: 'slide',
        unit: 'par',
        quantity: undermountDrawersCount,
        unitCost: 58000,
        notes: 'Extracción total oculta bajo cajón con gatillos 3D de desacople rápido'
      });
    }

    if (slidingDoorsCount > 0) {
      let closetSlidingKits = 0;
      for (const bay of slidingBayCounts.values()) {
        if (bay.hasZone || bay.explicit3Leaves) {
          closetSlidingKits += 1;
        } else {
          closetSlidingKits += Math.max(1, Math.ceil(bay.leaves / 2));
        }
      }
      items.push({
        id: 'hw_kit_closet',
        name: 'Kit Sistema Corredizo Closet (Rieles Sup/Inf + Rodamientos)',
        category: 'slide',
        unit: 'kit',
        quantity: Math.max(1, closetSlidingKits),
        unitCost: 75000,
        notes: 'Perfiles de aluminio superior e inferior con carros de rodamiento ajustables'
      });
    }

    if (slidingTrackMm > 0) {
      const meters = Math.max(0.1, Math.round((slidingTrackMm / 1000) * 100) / 100);
      items.push({
        id: 'hw_riel_corredizo',
        name: 'Riel Aluminio Sistema Corredizo (Superior/Inferior)',
        category: 'slide',
        unit: 'metro',
        quantity: meters,
        unitCost: 34000,
        notes: `Metros lineales de riel superior e inferior (${Math.round(slidingTrackMm)} mm totales)`
      });
    }

    if (shoeStopAluminumMm > 0) {
      const meters = Math.max(0.1, Math.round((shoeStopAluminumMm / 1000) * 100) / 100);
      items.push({
        id: 'hw_tope_zapatero_aluminio',
        name: 'Perfil Tope Aluminio Zapatero',
        category: 'accessory',
        unit: 'metro',
        quantity: meters,
        unitCost: 22000,
        notes: `Perfil tope frontal de aluminio para zapatero (${Math.round(shoeStopAluminumMm)} mm totales)`
      });
    }

    const vitrinaFrameCatalog: Record<CabinetVitrinaFrameFinish, { id: string; name: string; unitCost: number }> = {
      matte_black: {
        id: 'hw_vitrina_marco_matte_black',
        name: 'Perfil Aluminio Marco Vitrina (Negro Mate)',
        unitCost: 39000
      },
      natural_aluminum: {
        id: 'hw_vitrina_marco_natural_aluminum',
        name: 'Perfil Aluminio Marco Vitrina (Aluminio Natural)',
        unitCost: 36000
      },
      gold: {
        id: 'hw_vitrina_marco_gold',
        name: 'Perfil Aluminio Marco Vitrina (Dorado)',
        unitCost: 42000
      }
    };
    for (const [finish, totalMm] of vitrinaFrameMm.entries()) {
      if (totalMm <= 0) continue;
      const spec = vitrinaFrameCatalog[finish];
      const meters = Math.max(0.1, Math.round((totalMm / 1000) * 100) / 100);
      items.push({
        id: spec.id,
        name: spec.name,
        category: 'accessory',
        unit: 'metro',
        quantity: meters,
        unitCost: spec.unitCost,
        notes: `Perímetro completo perfil de aluminio + escuadras de armado (${Math.round(totalMm)} mm)`
      });
    }

    const vitrinaGlassCatalog: Record<CabinetVitrinaGlassType, { id: string; name: string; unitCost: number }> = {
      clear: {
        id: 'hw_vitrina_vidrio_clear',
        name: 'Vidrio Templado 4mm Vitrina (Claro)',
        unitCost: 135000
      },
      bronze_smoked: {
        id: 'hw_vitrina_vidrio_bronze_smoked',
        name: 'Vidrio Templado 4mm Vitrina (Bronce Ahumado)',
        unitCost: 165000
      },
      frosted: {
        id: 'hw_vitrina_vidrio_frosted',
        name: 'Vidrio Templado 4mm Vitrina (Esmerilado)',
        unitCost: 155000
      }
    };
    for (const [glassType, areaM2] of vitrinaGlassM2.entries()) {
      if (areaM2 <= 0) continue;
      const spec = vitrinaGlassCatalog[glassType];
      const roundedArea = Math.max(0.01, Math.round(areaM2 * 100) / 100);
      items.push({
        id: spec.id,
        name: spec.name,
        category: 'accessory',
        unit: 'm²',
        quantity: roundedArea,
        unitCost: spec.unitCost,
        notes: `Vidrio templado de seguridad cortado a medida (${roundedArea.toFixed(2)} m²)`
      });
    }

    const rodCatalog: Record<CabinetRodFinish, { id: string; name: string; unitCost: number; notes: string }> = {
      chrome: {
        id: 'hw_tubo_colgador',
        name: 'Tubo Colgador Ovalado Cromado con Soportes Laterales',
        unitCost: 28000,
        notes: 'Tubo de acero cromado ovalado reforzado con bridas atornillables'
      },
      matte_black: {
        id: 'hw_tubo_colgador_negro',
        name: 'Barra Colgadora Negro Mate con Soportes Laterales',
        unitCost: 34000,
        notes: 'Barra colgadora acabado negro mate texturizado con bridas'
      },
      gold: {
        id: 'hw_tubo_colgador_dorado',
        name: 'Barra Colgadora Dorada con Soportes Laterales',
        unitCost: 36000,
        notes: 'Barra colgadora acabado dorado satinado con bridas'
      }
    };
    let totalRodsCount = 0;
    for (const [finish, qty] of rodCounts.entries()) {
      if (qty <= 0) continue;
      totalRodsCount += qty;
      const spec = rodCatalog[finish];
      items.push({
        id: spec.id,
        name: spec.name,
        category: 'accessory',
        unit: 'und',
        quantity: qty,
        unitCost: spec.unitCost,
        notes: spec.notes
      });
    }
    if (totalRodsCount > 0) {
      items.push({
        id: 'hw_bridas_tubo_colgador',
        name: 'Brida / Soporte Lateral Tubo Colgador',
        category: 'support',
        unit: 'und',
        quantity: totalRodsCount * 2,
        unitCost: 3500,
        notes: '2 soportes de fijación lateral por cada barra o tubo colgador'
      });
    }

    const golaCatalog: Record<CabinetGolaFinish, { id: string; name: string; unitCost: number }> = {
      natural_aluminum: {
        id: 'hw_gola_natural_aluminum',
        name: 'Perfil Gola Aluminio Natural',
        unitCost: 42000
      },
      matte_black: {
        id: 'hw_gola_matte_black',
        name: 'Perfil Gola Negro Mate',
        unitCost: 48000
      },
      white: {
        id: 'hw_gola_white',
        name: 'Perfil Gola Blanco',
        unitCost: 45000
      },
      champagne: {
        id: 'hw_gola_champagne',
        name: 'Perfil Gola Champagne',
        unitCost: 48000
      }
    };
    for (const [finish, totalMm] of golaMmByFinish.entries()) {
      if (totalMm <= 0) continue;
      const spec = golaCatalog[finish];
      const meters = Math.max(0.1, Math.round((totalMm / 1000) * 100) / 100);
      items.push({
        id: spec.id,
        name: spec.name,
        category: 'accessory',
        unit: 'metro',
        quantity: meters,
        unitCost: spec.unitCost,
        notes: `Perfil aluminio Gola en J (${Math.round(totalMm)} mm totales)`
      });
    }

    if (movableShelvesCount > 0) {
      items.push({
        id: 'hw_soportes_repisa',
        name: 'Soporte Metálico para Repisa',
        category: 'support',
        unit: 'und',
        quantity: movableShelvesCount * 4,
        unitCost: 1200,
        notes: '4 soportes/pines metálicos Ø5mm por cada repisa móvil regulable'
      });
    }

    const legCatalog: Record<CabinetLegStyle, { id: string; name: string; unitCost: number; notes: string }> = {
      cylindrical_inox: {
        id: 'hw_patas_niveladoras',
        name: 'Pata Cilíndrica Niveladora Inox',
        unitCost: 18000,
        notes: 'Pata metálica niveladora regulable en acero inoxidable'
      },
      black_leveler: {
        id: 'hw_leg_black_leveler',
        name: 'Pata Niveladora Negra',
        unitCost: 12000,
        notes: 'Pata niveladora regulable de alta resistencia en acabado negro'
      },
      scandinavian_wood: {
        id: 'hw_leg_scandinavian_wood',
        name: 'Pata Nórdica Madera',
        unitCost: 26000,
        notes: 'Pata cónica de madera natural con platina metálica de fijación'
      },
      hairpin_metal: {
        id: 'hw_leg_hairpin_metal',
        name: 'Pata Horquilla Metálica',
        unitCost: 32000,
        notes: 'Pata horquilla estructural en acero electrostático'
      }
    };
    for (const [style, qty] of legCounts.entries()) {
      if (qty <= 0) continue;
      const spec = legCatalog[style];
      items.push({
        id: spec.id,
        name: spec.name,
        category: 'support',
        unit: 'und',
        quantity: qty,
        unitCost: spec.unitCost,
        notes: spec.notes
      });
    }

    if (concealedHangersCount > 0) {
      const sets = Math.max(1, Math.ceil(concealedHangersCount / 2));
      items.push({
        id: 'hw_concealed_hanger_kit',
        name: 'Juego de Colgadores Ocultos + Platinas Murales',
        category: 'accessory',
        unit: 'juego',
        quantity: sets,
        unitCost: 29000,
        notes: 'Par de colgadores ocultos regulables de alta carga con platinas de fijación a muro'
      });
    }

    if (wallAnchorModuleIds.size > 0) {
      items.push({
        id: 'hw_wall_anchor_kit',
        name: 'Kit Chazos y Tornillos de Anclaje a Muro',
        category: 'screw',
        unit: 'kit',
        quantity: wallAnchorModuleIds.size,
        unitCost: 14500,
        notes: 'Juego de chazos expansivos y tornillos tirafondo estructurales para instalación mural'
      });
    }

    if (handlesCount > 0) {
      items.push({
        id: 'hw_tiradores',
        name: 'Tiradores Metálicos Ergonómicos (160mm C-C)',
        category: 'handle',
        unit: 'und',
        quantity: handlesCount,
        unitCost: 12500,
        notes: 'Incluye tornillos pasantes M4'
      });
    }

    return items;
  }
}
