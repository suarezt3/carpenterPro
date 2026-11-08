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
  ApplianceItem
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

  // Identifica si una pieza es puerta o cajón por rol o nombre
  detectMovableType(part: Part): { movableType: 'door' | 'drawer' | 'none'; direction: OpeningDirection } {
    if (part.hardwareConfig?.movableType) {
      return {
        movableType: part.hardwareConfig.movableType,
        direction: part.hardwareConfig.openingDirection || (part.hardwareConfig.movableType === 'door' ? 'left' : 'top')
      };
    }

    const n = (part.name || '').toUpperCase();
    const role = part.componentRole;

    if (role === 'door' || n.includes('PUERTA')) {
      if (n.includes('BASCULANTE') || n.includes('ELEVABLE') || n.includes('ALACENA')) {
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
      return {
        isMovable: true,
        movableType: 'door',
        handleType: 'bar_modern',
        handleFinish: 'brushed_steel',
        handleLength: 160,
        handlePosition: isBasculante ? 'horizontal' : 'vertical',
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
    let hingesStraight = 0;
    let hinges45 = 0;
    let hinges165 = 0;
    let hingesGas = 0;
    let drawersCount = 0;
    let pushDrawersCount = 0;
    let handlesCount = 0;
    let slidingDoorsCount = 0;
    let hangingRodsCount = 0;

    for (const part of parts) {
      const n = (part.name || '').toLowerCase();
      const notes = (part.notes || '').toLowerCase();
      const mod = (part.moduleName || part.groupName || '').toLowerCase();
      const qty = Number(part.quantity) || 1;

      // 1. Tubo Colgador Ovalado (Closets / Armarios)
      const isRod = (part.shapeType === 'circle' && (n.includes('tubo') || n.includes('colgador') || n.includes('barra'))) ||
                    notes.includes('colgador') || notes.includes('tubo') || n.includes('colgador');
      if (isRod) {
        hangingRodsCount += qty;
        continue;
      }

      // Ignorar piezas estructurales internas de la caja del cajón salvo que sean el contrafrente de un cajón oculto sin tapa vista
      const isDrawerBoxInternal =
        part.componentRole === 'drawer_box' ||
        part.componentRole === 'drawer_lateral' ||
        (part.thickness !== undefined && part.thickness <= 6 && (n.includes('fondo') || n.includes('caj')));
      if (isDrawerBoxInternal && !part.hardwareConfig?.isMovable) {
        continue;
      }

      const detected = this.detectMovableType(part);
      const hw = part.hardwareConfig || this.getDefaultHardwareConfig(part);

      // 2. Puertas correderas de Closet
      const isSlidingDoor = (detected.movableType === 'door' || part.componentRole === 'door') &&
        (n.includes('corrediz') || notes.includes('corrediz') || notes.includes('riel') || mod.includes('closet'));

      if (isSlidingDoor) {
        slidingDoorsCount += qty;
        if (hw.handleType && hw.handleType !== 'none') {
          handlesCount += qty;
        }
        continue;
      }

      if (detected.movableType === 'door') {
        const height = Math.max(part.length, part.width);
        const hingesNeeded = (height > 1600 ? 4 : (height > 900 ? 3 : 2)) * qty;

        // Bisagras angulares de 45° (esquineros pentagonales)
        const is45 = hw.hingeType === 'corner_45' || n.includes('45°') || notes.includes('45°') || part.rotationY === 45 || n.includes('diagonal');
        // Bisagras angulares de 165° (rincón ciego)
        const is165 = hw.hingeType === 'corner_165' || n.includes('165°') || notes.includes('165°') || n.includes('acceso a rincón') || notes.includes('rincón') || notes.includes('ciego') || n.includes('ciego');
        // Pistones neumáticos elevables (alacenas)
        const isLiftUp = hw.hingeType === 'gas_piston' || detected.direction === 'top' || n.includes('basculante') || n.includes('elevable') || n.includes('alacena');

        if (isLiftUp) {
          hingesGas += (2 * qty);
        } else if (is45) {
          hinges45 += hingesNeeded;
        } else if (is165) {
          hinges165 += hingesNeeded;
        } else if (hw.hingeType !== 'none') {
          hingesStraight += hingesNeeded;
        }

        if (hw.handleType && hw.handleType !== 'none') {
          handlesCount += qty;
        }
      } else if (detected.movableType === 'drawer') {
        const isPushOpen =
          hw.slideType === 'push_open' ||
          hw.drawerOpeningSystem === 'push' ||
          notes.includes('push-to-open') ||
          notes.includes('apertura por presión');
        const isFingerPull =
          hw.drawerOpeningSystem === 'finger_pull' ||
          notes.includes('uñero') ||
          notes.includes('gola');

        if (isPushOpen) {
          pushDrawersCount += qty;
        } else {
          drawersCount += qty;
        }

        if (!isPushOpen && !isFingerPull && hw.handleType && hw.handleType !== 'none') {
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

    if (slidingDoorsCount > 0) {
      const closetSlidingKits = Math.max(1, Math.ceil(slidingDoorsCount / 2));
      items.push({
        id: 'hw_kit_closet',
        name: 'Kit Sistema Corredizo Closet (Rieles Sup/Inf + Rodamientos)',
        category: 'slide',
        unit: 'kit',
        quantity: closetSlidingKits,
        unitCost: 75000,
        notes: 'Perfiles de aluminio superior e inferior con carros de rodamiento ajustables'
      });
    }

    if (hangingRodsCount > 0) {
      items.push({
        id: 'hw_tubo_colgador',
        name: 'Tubo Colgador Ovalado Cromado con Soportes Laterales',
        category: 'accessory',
        unit: 'und',
        quantity: hangingRodsCount,
        unitCost: 28000,
        notes: 'Tubo de acero cromado ovalado reforzado con bridas atornillables'
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
