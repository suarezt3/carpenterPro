import { Injectable } from '@angular/core';
import { 
  HandleType, 
  HandleFinish, 
  HingeType, 
  SlideType, 
  OpeningDirection, 
  PartHardwareConfig, 
  Part, 
  HardwareItem 
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

@Injectable({
  providedIn: 'root'
})
export class HardwareCatalogService {

  readonly handleOptions: HandleOption[] = [
    {
      id: 'bar_modern',
      name: 'Tirador Barra Tubular Inox',
      category: 'bar',
      description: 'Diseño moderno cilíndrico contemporáneo con doble pie de fijación (160mm C-C).',
      defaultLength: 160,
      supportedFinishes: ['brushed_steel', 'black', 'gold', 'chrome'],
      unitCost: 3.50,
      icon: 'maximize'
    },
    {
      id: 'bar_black',
      name: 'Tirador Barra Negro Slim',
      category: 'bar',
      description: 'Barra rectangular minimalista acabado negro mate electroestático (192mm C-C).',
      defaultLength: 192,
      supportedFinishes: ['black', 'brushed_steel', 'gold'],
      unitCost: 4.20,
      icon: 'linear_scale'
    },
    {
      id: 'knob_round',
      name: 'Pomo Redondo Minimalista',
      category: 'knob',
      description: 'Pomo circular macizo Ø28mm con vástago cónico para puertas y cajones.',
      defaultLength: 28,
      supportedFinishes: ['brushed_steel', 'black', 'gold', 'chrome'],
      unitCost: 2.10,
      icon: 'radio_button_checked'
    },
    {
      id: 'knob_square',
      name: 'Pomo Cuadrado Geométrico',
      category: 'knob',
      description: 'Pomo cúbico 24×24mm de líneas puras para muebles modernos y minimalistas.',
      defaultLength: 24,
      supportedFinishes: ['black', 'brushed_steel', 'gold'],
      unitCost: 2.40,
      icon: 'crop_square'
    },
    {
      id: 'profile_gola',
      name: 'Perfil Gola / J Embutido',
      category: 'profile',
      description: 'Tirador corrido de aluminio anodizado integrado en el canto superior o lateral.',
      defaultLength: 0,
      supportedFinishes: ['black', 'brushed_steel', 'gold', 'white'],
      unitCost: 6.80,
      icon: 'view_agenda'
    },
    {
      id: 'cup_vintage',
      name: 'Tirador Concha Vintage',
      category: 'cup',
      description: 'Tirador estilo concha tradicional para cajones clásicos o provenzales.',
      defaultLength: 96,
      supportedFinishes: ['black', 'brushed_steel', 'gold'],
      unitCost: 3.20,
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
      unitCost: 1.80,
      icon: 'meeting_room'
    },
    {
      id: 'half_cranked',
      name: 'Bisagra Semicodo (Semiparche)',
      cupDiameter: 35,
      openingAngle: '110°',
      description: 'Para dos puertas que comparten un mismo tabique central divisorio (9mm cobertura).',
      unitCost: 1.90,
      icon: 'door_front'
    },
    {
      id: 'full_cranked',
      name: 'Bisagra Codo (Interior / Embutida)',
      cupDiameter: 35,
      openingAngle: '110°',
      description: 'Para puertas que cierran dentro del vano / marco del mueble (enrasadas).',
      unitCost: 2.10,
      icon: 'sensor_door'
    },
    {
      id: 'gas_piston',
      name: 'Pistón a Gas Elevable 100N',
      cupDiameter: 35,
      openingAngle: '90° Basculante',
      description: 'Brazo hidráulico de elevación para puertas basculantes superiores de alacena.',
      unitCost: 4.50,
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
      unitCost: 5.50,
      icon: 'view_week'
    },
    {
      id: 'soft_close',
      name: 'Corredera Telescópica Cierre Suave (Soft-Close)',
      extensionType: 'Extensión Total con Freno Hidráulico',
      loadCapacityKg: 40,
      description: 'Pistón amortiguador hidráulico integrado para cierre silencioso y suave antipellizco.',
      unitCost: 8.90,
      icon: 'motion_photos_paused'
    },
    {
      id: 'undermount',
      name: 'Corredera Oculta Bajo Cajón (Tandem)',
      extensionType: 'Extensión Total Oculta Sincronizada',
      loadCapacityKg: 40,
      description: 'Montaje invisible bajo el fondo del cajón con regulación 3D y gatillos de desacople rápido.',
      unitCost: 14.50,
      icon: 'layers'
    },
    {
      id: 'telescopic_35',
      name: 'Corredera Telescópica Ligera 35mm',
      extensionType: 'Extensión Total (25kg)',
      loadCapacityKg: 25,
      description: 'Perfil compacto de 35mm para cajones medianos o de baja profundidad. Holgura 12.5mm.',
      unitCost: 3.90,
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

  // Genera lista consolidada de herrajes requeridos para presupuesto y compra
  computeRequiredHardwareList(parts: Part[]): HardwareItem[] {
    let hingesStraight = 0;
    let hingesGas = 0;
    let drawersCount = 0;
    let handlesCount = 0;

    for (const part of parts) {
      const detected = this.detectMovableType(part);
      const hw = part.hardwareConfig || this.getDefaultHardwareConfig(part);

      if (detected.movableType === 'door') {
        const height = Math.max(part.length, part.width);
        const hingesNeeded = height > 1600 ? 4 : (height > 900 ? 3 : 2);

        if (hw.hingeType === 'gas_piston') {
          hingesGas += 2;
        } else if (hw.hingeType !== 'none') {
          hingesStraight += hingesNeeded;
        }

        if (hw.handleType && hw.handleType !== 'none') {
          handlesCount++;
        }
      } else if (detected.movableType === 'drawer') {
        drawersCount++;
        if (hw.handleType && hw.handleType !== 'none') {
          handlesCount++;
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
        unitCost: 1.80,
        notes: 'Incluye base de regulación y tornillos 3.5×15mm'
      });
    }

    if (hingesGas > 0) {
      items.push({
        id: 'hw_piston_gas',
        name: 'Brazo Pistón a Gas 100N para Alacena',
        category: 'accessory',
        unit: 'und',
        quantity: hingesGas,
        unitCost: 4.50,
        notes: 'Fuerza 100N con fijaciones para marco y puerta'
      });
    }

    if (drawersCount > 0) {
      items.push({
        id: 'hw_correderas',
        name: 'Corredera Telescópica 45mm H45 Cierre Suave',
        category: 'slide',
        unit: 'par',
        quantity: drawersCount,
        unitCost: 6.50,
        notes: 'Capacidad 35kg por cajón'
      });
    }

    if (handlesCount > 0) {
      items.push({
        id: 'hw_tiradores',
        name: 'Tiradores Metálicos Ergonómicos (160mm C-C)',
        category: 'handle',
        unit: 'und',
        quantity: handlesCount,
        unitCost: 3.50,
        notes: 'Incluye tornillos pasantes M4'
      });
    }

    return items;
  }
}
