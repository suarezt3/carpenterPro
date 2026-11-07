import { ReleaseVersion, RoadmapItem } from '../models/changelog.models';
import { AppLanguage } from './i18n-translations.data';

export const RELEASES_ES: ReleaseVersion[] = [
  {
    version: 'v2.5.0',
    name: 'Sincronización Total de Espesores, Tableros a Medida e Interfaz CAD Pro',
    releaseDate: '23 de Octubre de 2026',
    isCurrent: true,
    summary: 'Actualización mayor enfocada en consistencia de cálculo milimétrico entre el visor 3D, despiece y optimizador de corte, además de una interfaz ultracompacta para portátiles.',
    highlights: [
      'Sincronización de espesores reales (15 mm, 18 mm) en todas las vistas y presupuestos',
      'Configurador paramétrico del tamaño de tablero de corte con presets comerciales',
      'Cinta flotante de edición CAD ultracompacta sin solapamiento en pantallas HD'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Selector y configuración de medidas de tablero en Optimizador 2D',
        description: 'Permite editar el largo y ancho de las láminas de melamina con medidas estándar (2440×1830, 2440×2150, 2500×1830, 2600×1830 mm) o medidas personalizadas, con botón para invertir orientación y alertas de piezas que excedan el tablero.',
        tag: 'Optimizador'
      },
      {
        type: 'feature',
        title: 'Sincronización de espesores en Despiece y Presupuesto',
        description: 'Se vinculó el espesor real de cada pieza (15 mm, 18 mm o personalizado) con la vista de cotización y con el optimizador de sierra, evitando que se presupuesten tableros con espesores incorrectos.',
        tag: 'Cálculos'
      },
      {
        type: 'improvement',
        title: 'Rediseño de la cinta flotante superior a iconos compactos CAD',
        description: 'Se redujo el ancho de la cinta de opciones en más del 60%, reemplazando textos por botones icónicos con tooltip interactivo (Congelar, Duplicar, Mover, Girar y Orientación H/L/F), eliminando solapamientos con la barra CAD izquierda en pantallas HD (1366×768).',
        tag: 'Interfaz'
      },
      {
        type: 'improvement',
        title: 'Cabecera global esbelta y profesional',
        description: 'Reducción de altura a 44 px, compactación de pestañas de navegación y estandarización de botones de acción rápida con tooltips.',
        tag: 'Interfaz'
      },
      {
        type: 'fix',
        title: 'Corrección de cálculo en el presupuesto de tableros',
        description: 'Se eliminó el error que mostraba 18 mm por defecto en melaminas creadas a 15 mm en el generador de muebles.',
        tag: 'Presupuesto'
      }
    ]
  },
  {
    version: 'v2.4.0',
    name: 'Cocina Pro Studio & Mesones Paramétricos 3D',
    releaseDate: '21 de Octubre de 2026',
    isCurrent: false,
    summary: 'Lanzamiento del módulo Cocina Pro para diseño de cocinas integrales, mesones en granito/mármol/cuarzo con salpicaderos paramétricos y selector de materiales en 1 clic.',
    highlights: [
      'Asistente de Cocina Pro Studio con módulos bajos, aéreos, esquineros y torres de hornos',
      'Mesones inteligentes 3D con espesores configurables y salpicadero (backsplash)',
      'Paleta de materiales globales (Roble, Nogal, Blanco Polar, Granito Negro, Mármol Calacatta)'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Generador de Mesones Inteligentes',
        description: 'Generación de mesones 3D que se adaptan a la huella superior de los muebles bajos seleccionados o permiten trazado libre.',
        tag: 'Cocina Pro'
      },
      {
        type: 'feature',
        title: 'Panel de Estilo y Texturas en 1 Clic',
        description: 'Aplicación masiva de texturas y acabados a todo el proyecto o por módulos seleccionados de forma instantánea.',
        tag: 'Materiales'
      },
      {
        type: 'improvement',
        title: 'Gestor de plantillas de muebles prediseñados',
        description: 'Incorporación de catálogo de plantillas con cajoneras de 2, 3 y 4 gavetas, alacenas y muebles para fregadero.',
        tag: 'Plantillas'
      }
    ]
  },
  {
    version: 'v2.3.0',
    name: 'Optimizador de Corte de Sierra 2D y Cotización Dinámica',
    releaseDate: '15 de Octubre de 2026',
    isCurrent: false,
    summary: 'Algoritmo de guillotina bidimensional para aprovechamiento óptimo de tableros de melamina, reducción de desperdicio y presupuesto comercial automático.',
    highlights: [
      'Cálculo de corte de sierra considerando grosor de disco (Kerf) y refilado perimetral',
      'Diagrama gráfico interactivo de distribución de piezas con rotación automática según veta',
      'Presupuesto por metro lineal de tapacanto, láminas consumidas y herrajes'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Algoritmo de corte Guillotina 2D',
        description: 'Organización automática de piezas minimizando retazos y optimizando los patrones de corte para el operario de la escuadradora o seccionadora.',
        tag: 'Optimizador'
      },
      {
        type: 'feature',
        title: 'Presupuesto dinámico en tiempo real',
        description: 'Cálculo de costos de materiales, consumo de tapacanto flexible/rígido, herrajes y margen comercial configurable.',
        tag: 'Presupuesto'
      },
      {
        type: 'improvement',
        title: 'Exportación de reportes de despiece',
        description: 'Generación de etiquetas con códigos QR y exportación de listas de corte para impresión de taller.',
        tag: 'Taller'
      }
    ]
  },
  {
    version: 'v2.2.0',
    name: 'Agrupaciones Modulares y Cinemática 3D',
    releaseDate: '8 de Octubre de 2026',
    isCurrent: false,
    summary: 'Transformación del lienzo 3D en un entorno de ensamble modular interactivo con arrastre sincronizado y apertura de puertas.',
    highlights: [
      'Agrupación de piezas como módulos independientes (cajones, alacenas, gabinetes)',
      'Apertura y cierre animado de puertas abatibles y correderas en tiempo real',
      'Imantación magnética (Snapping) entre caras de piezas contiguas'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Cinemática de Apertura 3D',
        description: 'Inspección interna de muebles abriendo y cerrando cajones o puertas con un clic o atajo de teclado.',
        tag: 'Visualización'
      },
      {
        type: 'feature',
        title: 'Duplicación y movimiento en bloque',
        description: 'Capacidad de clonar módulos completos con toda su jerarquía de piezas y herrajes asociados.',
        tag: 'Ensamble'
      }
    ]
  },
  {
    version: 'v2.1.0',
    name: 'Herramientas CAD Profesionales & Escala Humana',
    releaseDate: '1 de Octubre de 2026',
    isCurrent: false,
    summary: 'Inclusión de herramientas de precisión milimétrica, cinta métrica, empujar/tirar (Push-Pull) y referencia visual ergonómica.',
    highlights: [
      'Cinta métrica 3D con medición entre vértices, aristas y centros',
      'Empujar / Tirar para redimensionar tableros arrastrando directamente en el modelo',
      'Figura de escala humana y brújula de orientación espacial'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Herramienta Cinta Métrica CAD',
        description: 'Toma de medidas precisas punto a punto en el espacio tridimensional con visualización de cotas dinámicas.',
        tag: 'CAD'
      },
      {
        type: 'feature',
        title: 'Empujar / Tirar (Push-Pull)',
        description: 'Ajuste directo de dimensiones estirando o contrayendo tableros en el eje correspondiente.',
        tag: 'CAD'
      }
    ]
  },
  {
    version: 'v1.0.0',
    name: 'Lanzamiento Inicial de Piezo3D Studio',
    releaseDate: '15 de Septiembre de 2026',
    isCurrent: false,
    summary: 'Primera versión oficial del software de diseño de carpintería y despiece milimétrico basado en web.',
    highlights: [
      'Motor 3D acelerado por WebGL con Three.js',
      'Inserción paramétrica de piezas de melamina en ejes X, Y, Z',
      'Almacenamiento local de proyectos y persistencia en la nube Supabase'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Lienzo 3D con control de cámara orbital y ortogonal',
        description: 'Navegación libre, vistas frontal, lateral, superior y proyección isométrica con iluminación de estudio.',
        tag: 'Motor 3D'
      },
      {
        type: 'feature',
        title: 'Integración Supabase Cloud',
        description: 'Guardado seguro de proyectos en la nube con sincronización multi-dispositivo.',
        tag: 'Nube'
      }
    ]
  }
];

export const ROADMAP_ES: RoadmapItem[] = [
  {
    id: 'diagonal_cuts',
    title: 'Mesones con Cortes Diagonales y Chaflanes a 45°',
    description: 'Herramienta de corte poligonal que permitirá realizar esquinas redondeadas, biseles y cortes en ángulo sobre mesones de granito, cuarzo y tableros para barras americanas e islas de cocina.',
    status: 'in_progress',
    category: 'Mesones & Geometría',
    targetTimeline: 'Próxima Versión (v2.6.0)',
    badge: 'En Desarrollo Activo',
    progressPercent: 75
  },
  {
    id: 'furniture_gallery_3d',
    title: 'Galería de Accesorios, Indumentaria y Electrodomésticos 3D',
    description: 'Catálogo de modelos 3D listos para arrastrar al proyecto: lavaplatos bajo/sobre tope, griferías monomando, estufas de inducción/gas, hornos empotrables, campanas extractoras, sillas altas de barra y lámparas colgantes.',
    status: 'in_progress',
    category: 'Ambientación & Decoración',
    targetTimeline: 'Próxima Versión (v2.6.0)',
    badge: 'En Desarrollo Activo',
    progressPercent: 60
  },
  {
    id: 'cnc_mechanization_view',
    title: 'Mecanizados CNC en Lista de Despiece y Vista 3D',
    description: 'Definición gráfica de perforaciones de 35 mm para bisagras de cazoleta, líneas de taladros sistema 32 mm, perforaciones para correderas telescópicas y ranuras de fondo de 3 mm / 5.5 mm.',
    status: 'in_progress',
    category: 'Fabricación & CNC',
    targetTimeline: 'Noviembre 2026',
    badge: 'En Pruebas',
    progressPercent: 40
  },
  {
    id: 'technical_pdf_blueprints',
    title: 'Generación Automática de Planos Técnicos de Taller en PDF',
    description: 'Exportación con un clic de cuadernillo técnico en PDF conteniendo vistas acotadas en 2D (planta, alzada y perfil) de cada módulo por separado para facilitar el armado por parte del operario en taller.',
    status: 'planned',
    category: 'Documentación de Taller',
    targetTimeline: 'Q4 2026',
    badge: 'Planificado',
    progressPercent: 15
  },
  {
    id: 'photorealistic_presentation',
    title: 'Modo Presentación Fotorrealista para Clientes',
    description: 'Modo de visualización comercial con iluminación HDRI avanzada, reflejos en mesones y melaminas brillo, sombras de contacto y generación de enlaces interactivos para que el cliente final explore el diseño desde su celular.',
    status: 'planned',
    category: 'Ventas & Clientes',
    targetTimeline: 'Q1 2027',
    badge: 'Planificado',
    progressPercent: 10
  },
  {
    id: 'commercial_quote_generator',
    title: 'Generador de Propuesta Comercial con Logo Personalizado',
    description: 'Creación de cotizaciones formales para el cliente final con logo del taller, desglose de materiales, accesorios, mano de obra, condiciones de pago y render en portada listo para enviar por WhatsApp o correo.',
    status: 'planned',
    category: 'Gestión Comercial',
    targetTimeline: 'Q1 2027',
    badge: 'Planificado',
    progressPercent: 0
  },
  {
    id: 'gcode_cnc_export',
    title: 'Generación Directa de Código G-Code para Centros CNC',
    description: 'Postprocesadores compatibles con máquinas router CNC de 3 ejes para fresado, ranurado y taladrado directo sin intermediarios.',
    status: 'evaluating',
    category: 'Integración Industrial',
    targetTimeline: 'Evaluación Técnica',
    badge: 'Bajo Estudio'
  },
  {
    id: 'hardware_brand_integration',
    title: 'Integración de Catálogos de Fabricantes de Herrajes',
    description: 'Sistemas de elevación aventos, cajones metálicos tipo tandembox/antaro y correderas ocultas sincronizadas con catálogos de marcas líderes.',
    status: 'evaluating',
    category: 'Herrajes Pro',
    targetTimeline: 'Evaluación Técnica',
    badge: 'Bajo Estudio'
  }
];

export const RELEASES_EN: ReleaseVersion[] = [
  {
    version: 'v2.5.0',
    name: 'Total Thickness Sync, Custom Sheet Sizes & Pro CAD Interface',
    releaseDate: 'October 23, 2026',
    isCurrent: true,
    summary: 'Major update focused on millimeter precision calculation consistency across 3D viewer, cut list and cut optimizer, plus an ultra-compact interface for laptops.',
    highlights: [
      'Real thickness synchronization (15 mm, 18 mm) across all views and budgets',
      'Parametric cut sheet size configurator with commercial presets',
      'Ultra-compact floating CAD toolbar without overlap on HD screens'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Sheet size selector & configuration in 2D Optimizer',
        description: 'Edit melamine sheet length and width with standard sizes (2440×1830, 2440×2150, 2500×1830, 2600×1830 mm) or custom sizes, with rotation button and unplaced parts alerts.',
        tag: 'Optimizer'
      },
      {
        type: 'feature',
        title: 'Thickness synchronization in Cut List and Budget',
        description: 'Linked real part thickness (15 mm, 18 mm or custom) to the quotation view and saw optimizer, preventing incorrect sheet thicknesses.',
        tag: 'Calculations'
      },
      {
        type: 'improvement',
        title: 'Redesign of top floating toolbar to compact CAD icons',
        description: 'Reduced toolbar width by over 60%, replacing text with iconic buttons and tooltips, eliminating overlaps on HD screens (1366×768).',
        tag: 'Interface'
      },
      {
        type: 'improvement',
        title: 'Sleek & professional global header',
        description: 'Height reduced to 44 px, streamlined navigation tabs, and standardized quick action buttons with tooltips.',
        tag: 'Interface'
      },
      {
        type: 'fix',
        title: 'Budget sheet calculation correction',
        description: 'Fixed bug that showed 18 mm by default on melamine parts created with 15 mm thickness.',
        tag: 'Budget'
      }
    ]
  },
  {
    version: 'v2.4.0',
    name: 'Kitchen Pro Studio & 3D Parametric Countertops',
    releaseDate: 'October 21, 2026',
    isCurrent: false,
    summary: 'Launch of Kitchen Pro module for full modular kitchen design, granite/marble/quartz countertops with parametric backsplashes and 1-click materials selector.',
    highlights: [
      'Kitchen Pro Studio wizard with base, wall, corner modules and oven towers',
      'Smart 3D countertops with configurable thickness and backsplash',
      'Global materials palette (Oak, Walnut, Polar White, Black Granite, Calacatta Marble)'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Smart Countertop Generator',
        description: 'Generate 3D countertops adapting automatically to base cabinet footprints or freeform placement.',
        tag: 'Kitchen Pro'
      },
      {
        type: 'feature',
        title: '1-Click Style & Texture Panel',
        description: 'Massive application of finishes to the entire project or selected modules instantly.',
        tag: 'Materials'
      },
      {
        type: 'improvement',
        title: 'Pre-designed furniture templates manager',
        description: 'Template catalog including 2, 3, and 4-drawer bases, pantries, and sink cabinets.',
        tag: 'Templates'
      }
    ]
  },
  {
    version: 'v2.3.0',
    name: '2D Saw Cut Optimizer & Dynamic Quotation',
    releaseDate: 'October 15, 2026',
    isCurrent: false,
    summary: '2D guillotine algorithm for optimal sheet utilization, waste reduction, and automatic commercial budgeting.',
    highlights: [
      'Saw cut calculation factoring in kerf and perimeter trim margin',
      'Interactive diagram of part layout with auto-rotation following grain',
      'Per-meter edge banding budget, consumed sheets and hardware calculation'
    ],
    changes: [
      {
        type: 'feature',
        title: '2D Guillotine cutting algorithm',
        description: 'Automatic arrangement of parts minimizing waste and optimizing cutting sequences for saw operators.',
        tag: 'Optimizer'
      },
      {
        type: 'feature',
        title: 'Real-time dynamic budget',
        description: 'Calculation of material costs, thin/thick edge banding, hardware, and configurable commercial margin.',
        tag: 'Budget'
      },
      {
        type: 'improvement',
        title: 'Cut list reports export',
        description: 'QR code label generation and workshop cut list export for printing.',
        tag: 'Workshop'
      }
    ]
  },
  {
    version: 'v2.2.0',
    name: 'Modular Groupings & 3D Kinematics',
    releaseDate: 'October 8, 2026',
    isCurrent: false,
    summary: 'Transform 3D canvas into an interactive modular assembly environment with synchronized drag and animated door opening.',
    highlights: [
      'Part grouping as independent modules (drawers, cabinets, pantries)',
      'Real-time animated opening/closing of swing and sliding doors',
      'Magnetic surface snapping between adjacent part faces'
    ],
    changes: [
      {
        type: 'feature',
        title: '3D Opening Kinematics',
        description: 'Inspect interior of furniture by opening/closing drawers and doors with one click or shortcut.',
        tag: 'Visualization'
      },
      {
        type: 'feature',
        title: 'Block cloning & movement',
        description: 'Clone entire modules with their complete hierarchy of parts and hardware.',
        tag: 'Assembly'
      }
    ]
  },
  {
    version: 'v2.1.0',
    name: 'Professional CAD Tools & Human Scale Reference',
    releaseDate: 'October 1, 2026',
    isCurrent: false,
    summary: 'Inclusion of precision CAD tools, 3D tape measure, Push-Pull direct extrusion, and ergonomic human scale reference.',
    highlights: [
      '3D tape measure with vertex, edge, and center point snapping',
      'Push / Pull tool to resize panels directly in the 3D viewport',
      'Human scale figure and spatial orientation compass'
    ],
    changes: [
      {
        type: 'feature',
        title: 'CAD Tape Measure Tool',
        description: 'Point-to-point 3D measurements with dynamic dimension readouts.',
        tag: 'CAD'
      },
      {
        type: 'feature',
        title: 'Push / Pull (Extrude)',
        description: 'Direct dimension adjustment by pulling or pushing panel faces.',
        tag: 'CAD'
      }
    ]
  },
  {
    version: 'v1.0.0',
    name: 'Initial Release of Piezo3D Studio',
    releaseDate: 'September 15, 2026',
    isCurrent: false,
    summary: 'First official release of web-based millimeter carpentry CAD and cut list software.',
    highlights: [
      'WebGL accelerated 3D engine powered by Three.js',
      'Parametric melamine panel insertion across X, Y, Z axes',
      'Local project storage and Supabase Cloud persistence'
    ],
    changes: [
      {
        type: 'feature',
        title: '3D viewport with orbit and orthogonal cameras',
        description: 'Free navigation, front, side, top views and isometric camera projection.',
        tag: '3D Engine'
      },
      {
        type: 'feature',
        title: 'Supabase Cloud Integration',
        description: 'Secure cloud project storage with cross-device sync.',
        tag: 'Cloud'
      }
    ]
  }
];

export const ROADMAP_EN: RoadmapItem[] = [
  {
    id: 'diagonal_cuts',
    title: 'Countertops with Diagonal Cuts and 45° Chamfers',
    description: 'Polygonal cutting tool for rounded corners, bevels, and angled cuts on granite, quartz, and breakfast bars or kitchen islands.',
    status: 'in_progress',
    category: 'Countertops & Geometry',
    targetTimeline: 'Next Version (v2.6.0)',
    badge: 'Active Development',
    progressPercent: 75
  },
  {
    id: 'furniture_gallery_3d',
    title: '3D Appliances, Accessories & Fittings Gallery',
    description: 'Ready-to-drag 3D models catalog: undermount/topmount sinks, faucets, induction/gas stoves, built-in ovens, range hoods, bar stools, and pendant lights.',
    status: 'in_progress',
    category: 'Room & Decoration',
    targetTimeline: 'Next Version (v2.6.0)',
    badge: 'Active Development',
    progressPercent: 60
  },
  {
    id: 'cnc_mechanization_view',
    title: 'CNC Machining in Cut List and 3D View',
    description: 'Visual definition of 35 mm cup hinge borings, system 32 drill hole lines, drawer slide drillings, and 3 mm / 5.5 mm back panel grooves.',
    status: 'in_progress',
    category: 'Manufacturing & CNC',
    targetTimeline: 'November 2026',
    badge: 'In Testing',
    progressPercent: 40
  },
  {
    id: 'technical_pdf_blueprints',
    title: 'Automatic Workshop PDF Technical Blueprints',
    description: 'One-click export of workshop PDF booklet with dimensioned 2D views (plan, elevation, section) for every module to streamline assembly.',
    status: 'planned',
    category: 'Workshop Blueprints',
    targetTimeline: 'Q4 2026',
    badge: 'Planned',
    progressPercent: 15
  },
  {
    id: 'photorealistic_presentation',
    title: 'Photorealistic Client Presentation Mode',
    description: 'Commercial visualization mode with advanced HDRI lighting, glossy reflections, contact shadows, and shareable interactive mobile links for clients.',
    status: 'planned',
    category: 'Sales & Client',
    targetTimeline: 'Q1 2027',
    badge: 'Planned',
    progressPercent: 10
  },
  {
    id: 'commercial_quote_generator',
    title: 'Commercial Proposal Generator with Custom Logo',
    description: 'Formal quotes for clients with shop logo, breakdown of materials, accessories, labor, payment terms, and cover render ready for WhatsApp or email.',
    status: 'planned',
    category: 'Commercial Management',
    targetTimeline: 'Q1 2027',
    badge: 'Planned',
    progressPercent: 0
  },
  {
    id: 'gcode_cnc_export',
    title: 'Direct G-Code Generation for CNC Routers',
    description: 'Direct post-processors for 3-axis CNC router machines for direct milling, grooving, and drilling without third-party software.',
    status: 'evaluating',
    category: 'Industrial Integration',
    targetTimeline: 'Technical Evaluation',
    badge: 'Under Study'
  },
  {
    id: 'hardware_brand_integration',
    title: 'Hardware Manufacturer Catalogs Integration',
    description: 'Aventos lift systems, tandembox metal drawers, and concealed runners synchronized with leading brand catalogs.',
    status: 'evaluating',
    category: 'Pro Hardware',
    targetTimeline: 'Technical Evaluation',
    badge: 'Under Study'
  }
];

export const RELEASES_PT: ReleaseVersion[] = [
  {
    version: 'v2.5.0',
    name: 'Sincronização Total de Espessuras, Chapas Sob Medida e Interface CAD Pro',
    releaseDate: '23 de Outubro de 2026',
    isCurrent: true,
    summary: 'Grande atualização focada na consistência de cálculo milimétrico entre o visualizador 3D, plano de corte e otimizador, além de interface ultracompacta para notebooks.',
    highlights: [
      'Sincronização de espessuras reais (15 mm, 18 mm) em todas as vistas e orçamentos',
      'Configurador paramétrico de tamanho de chapa com predefinições comerciais',
      'Barra flutuante de edição CAD ultracompacta sem sobreposição em telas HD'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Seletor e configuração de medidas de chapa no Otimizador 2D',
        description: 'Permite editar comprimento e largura das chapas de MDF/melamina com medidas padrão ou personalizadas, com rotação e alertas de peças que excedem a chapa.',
        tag: 'Otimizador'
      },
      {
        type: 'feature',
        title: 'Sincronização de espessuras na Lista de Corte e Orçamento',
        description: 'Vinculou a espessura real de cada peça (15 mm, 18 mm ou personalizada) à cotação e ao otimizador de corte, evitando chapas incorretas.',
        tag: 'Cálculos'
      },
      {
        type: 'improvement',
        title: 'Redesenho da barra flutuante superior para ícones compactos CAD',
        description: 'Redução de largura em mais de 60%, substituindo textos por botões com tooltip interativo, eliminando sobreposições em telas HD (1366×768).',
        tag: 'Interface'
      },
      {
        type: 'improvement',
        title: 'Cabeçalho global elegante e profissional',
        description: 'Altura reduzida para 44 px, abas de navegação compactas e botões de ação padronizados com tooltips.',
        tag: 'Interface'
      },
      {
        type: 'fix',
        title: 'Correção de cálculo no orçamento de chapas',
        description: 'Eliminado o erro que exibia 18 mm por padrão em melaminas criadas a 15 mm no gerador.',
        tag: 'Orçamento'
      }
    ]
  },
  {
    version: 'v2.4.0',
    name: 'Cozinha Pro Studio & Bancadas Paramétricas 3D',
    releaseDate: '21 de Outubro de 2026',
    isCurrent: false,
    summary: 'Lançamento do módulo Cozinha Pro para design de cozinhas planejadas, bancadas em granito/mármore/quartzo com rodabancas paramétricas e seletor em 1 clique.',
    highlights: [
      'Assistente Cozinha Pro Studio com balcões, aéreos, cantoneiras e torres de fornos',
      'Bancadas inteligentes 3D com espessuras configuráveis e rodabanca (backsplash)',
      'Paleta de materiais globais (Carvalho, Nogueira, Branco Polar, Granito Preto, Mármore Calacatta)'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Gerador de Bancadas Inteligentes',
        description: 'Geração de bancadas 3D que se adaptam automaticamente ao topo dos balcões selecionados.',
        tag: 'Cozinha Pro'
      },
      {
        type: 'feature',
        title: 'Painel de Estilos e Texturas em 1 Clique',
        description: 'Aplicação instantânea de acabamentos ao projeto inteiro ou por módulos selecionados.',
        tag: 'Materiais'
      },
      {
        type: 'improvement',
        title: 'Gerenciador de gabaritos de móveis pré-definidos',
        description: 'Catálogo de modelos com gaveteiros de 2, 3 e 4 gavetas, despensas e armários de pia.',
        tag: 'Gabaritos'
      }
    ]
  },
  {
    version: 'v2.3.0',
    name: 'Otimizador de Corte 2D e Orçamento Dinâmico',
    releaseDate: '15 de Outubro de 2026',
    isCurrent: false,
    summary: 'Algoritmo de guilhotina bidimensional para aproveitamento ideal de chapas, redução de sobras e orçamento comercial automático.',
    highlights: [
      'Cálculo de corte de serra considerando espessura do disco (Kerf) e refilamento',
      'Diagrama gráfico interativo de distribuição de peças com rotação conforme veio',
      'Orçamento por metro linear de fita de borda, chapas consumidas e ferragens'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Algoritmo de corte Guilhotina 2D',
        description: 'Organização automática minimizando retalhos e otimizando sequências de corte para esquadrejadeiras ou seccionadoras.',
        tag: 'Otimizador'
      },
      {
        type: 'feature',
        title: 'Orçamento dinâmico em tempo real',
        description: 'Cálculo de custos de materiais, fitas de borda finas/grossas, ferragens e margem de lucro.',
        tag: 'Orçamento'
      },
      {
        type: 'improvement',
        title: 'Exportação de relatórios de corte',
        description: 'Geração de etiquetas com códigos QR e listas de corte para impressão de oficina.',
        tag: 'Oficina'
      }
    ]
  },
  {
    version: 'v2.2.0',
    name: 'Agrupamentos Modulares e Cinemática 3D',
    releaseDate: '8 de Outubro de 2026',
    isCurrent: false,
    summary: 'Transformação do espaço 3D em montagem modular interativa com arrasto sincronizado e abertura de portas.',
    highlights: [
      'Agrupamento de peças como módulos independentes (gavetas, aéreos, gabinetes)',
      'Abertura e fechamento animado de portas e gavetas em tempo real',
      'Alinhamento magnético inteligente (Snapping) entre faces'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Cinemática de Abertura 3D',
        description: 'Inspeção interna abrindo e fechando gavetas ou portas com um clique.',
        tag: 'Visualização'
      },
      {
        type: 'feature',
        title: 'Duplicação e movimento em bloco',
        description: 'Capacidade de clonar módulos completos com toda sua hierarquia de peças e ferragens.',
        tag: 'Montagem'
      }
    ]
  },
  {
    version: 'v2.1.0',
    name: 'Ferramentas CAD Profissionais & Escala Humana',
    releaseDate: '1 de Outubro de 2026',
    isCurrent: false,
    summary: 'Inclusão de ferramentas de precisão milimétrica, fita métrica 3D, empurrar/puxar (Push-Pull) e referência ergonômica.',
    highlights: [
      'Fita métrica 3D com medição entre vértices, arestas e centros',
      'Empurrar / Puxar para redimensionar chapas diretamente no modelo',
      'Figura de escala humana e bússola espacial'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Ferramenta Fita Métrica CAD',
        description: 'Medição ponto a ponto no espaço tridimensional com cotas dinâmicas.',
        tag: 'CAD'
      },
      {
        type: 'feature',
        title: 'Empurrar / Puxar (Push-Pull)',
        description: 'Ajuste direto de medidas esticando ou contraindo chapas no eixo correspondente.',
        tag: 'CAD'
      }
    ]
  },
  {
    version: 'v1.0.0',
    name: 'Lançamento Inicial do Piezo3D Studio',
    releaseDate: '15 de Setembro de 2026',
    isCurrent: false,
    summary: 'Primeira versão oficial do software de marcenaria e plano de corte milimétrico na web.',
    highlights: [
      'Motor 3D acelerado por WebGL com Three.js',
      'Inserção paramétrica de peças nos eixos X, Y, Z',
      'Armazenamento local e persistência em nuvem Supabase'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Canvas 3D com câmera orbital e ortogonal',
        description: 'Navegação livre, vistas frontal, lateral, superior e projeção isométrica.',
        tag: 'Motor 3D'
      },
      {
        type: 'feature',
        title: 'Integração Supabase Cloud',
        description: 'Armazenamento seguro de projetos na nuvem com sincronização entre dispositivos.',
        tag: 'Nuvem'
      }
    ]
  }
];

export const ROADMAP_PT: RoadmapItem[] = [
  {
    id: 'diagonal_cuts',
    title: 'Bancadas com Cortes Diagonais e Chanfros a 45°',
    description: 'Ferramenta de corte poligonal para cantos arredondados, chanfros e cortes angulares em bancadas e ilhas de cozinha.',
    status: 'in_progress',
    category: 'Bancadas & Geometria',
    targetTimeline: 'Próxima Versão (v2.6.0)',
    badge: 'Em Desenvolvimento Ativo',
    progressPercent: 75
  },
  {
    id: 'furniture_gallery_3d',
    title: 'Galeria de Eletrodomésticos, Acessórios e Decoração 3D',
    description: 'Catálogo de modelos 3D prontos: pias de embutir/sobrepor, torneiras monocomando, cooktops, fornos, coifas, banquetas e luminárias.',
    status: 'in_progress',
    category: 'Decoração & Ambiente',
    targetTimeline: 'Próxima Versão (v2.6.0)',
    badge: 'Em Desenvolvimento Ativo',
    progressPercent: 60
  },
  {
    id: 'cnc_mechanization_view',
    title: 'Usinagens CNC na Lista de Peças e Vista 3D',
    description: 'Definição gráfica de furações de 35 mm para dobradiças de caneco, furação sistema 32 mm, corrediças telescópicas e ranhuras de fundo de 3 mm / 5.5 mm.',
    status: 'in_progress',
    category: 'Fabricação & CNC',
    targetTimeline: 'Novembro 2026',
    badge: 'Em Testes',
    progressPercent: 40
  },
  {
    id: 'technical_pdf_blueprints',
    title: 'Geração Automática de Plantas Técnicas de Oficina em PDF',
    description: 'Exportação em 1 clique de caderno técnico em PDF com vistas cotadas em 2D de cada módulo para facilitar a montagem na oficina.',
    status: 'planned',
    category: 'Documentação Técnica',
    targetTimeline: 'Q4 2026',
    badge: 'Planejado',
    progressPercent: 15
  },
  {
    id: 'photorealistic_presentation',
    title: 'Modo Apresentação Fotorrealista para Clientes',
    description: 'Modo comercial com iluminação HDRI avançada, reflexos em bancadas, sombras suaves e links interativos para o cliente visualizar no celular.',
    status: 'planned',
    category: 'Vendas & Clientes',
    targetTimeline: 'Q1 2027',
    badge: 'Planejado',
    progressPercent: 10
  },
  {
    id: 'commercial_quote_generator',
    title: 'Gerador de Proposta Comercial com Logotipo Personalizado',
    description: 'Criação de orçamentos formais com logo da marcenaria, detalhamento de materiais, ferragens, mão de obra e render na capa pronto para WhatsApp.',
    status: 'planned',
    category: 'Gestão Comercial',
    targetTimeline: 'Q1 2027',
    badge: 'Planejado',
    progressPercent: 0
  },
  {
    id: 'gcode_cnc_export',
    title: 'Geração Direta de Código G-Code para Roteadores CNC',
    description: 'Pós-processadores para roteadores CNC de 3 eixos para usinagem, furação e ranhuras diretas sem programas intermediários.',
    status: 'evaluating',
    category: 'Integração Industrial',
    targetTimeline: 'Avaliação Técnica',
    badge: 'Em Estudo'
  },
  {
    id: 'hardware_brand_integration',
    title: 'Integração de Catálogos de Fabricantes de Ferragens',
    description: 'Sistemas de elevação aventos, gavetas metálicas tandembox e corrediças ocultas integradas aos catálogos das marcas líderes.',
    status: 'evaluating',
    category: 'Ferragens Pro',
    targetTimeline: 'Avaliação Técnica',
    badge: 'Em Estudo'
  }
];

export const RELEASES_FR: ReleaseVersion[] = [
  {
    version: 'v2.5.0',
    name: 'Synchronisation Totale des Épaisseurs, Panneaux Sur-Mesure & Interface CAD Pro',
    releaseDate: '23 Octobre 2026',
    isCurrent: true,
    summary: 'Mise à jour majeure axée sur la cohérence de calcul millimétrique entre le visualiseur 3D, la fiche de débit et l\'optimiseur de coupe, plus une interface ultra-compacte.',
    highlights: [
      'Synchronisation des épaisseurs réelles (15 mm, 18 mm) sur toutes les vues et devis',
      'Configurateur paramétrique de dimensions de panneau avec préréglages du commerce',
      'Barre d\'outils CAD flottante ultra-compacte sans chevauchement sur écrans HD'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Sélecteur et configuration des dimensions de panneau dans l\'Optimiseur 2D',
        description: 'Modifiez la longueur et la largeur des panneaux mélaminés avec formats standard ou sur mesure, avec inversion d\'orientation et alertes de pièces hors format.',
        tag: 'Optimiseur'
      },
      {
        type: 'feature',
        title: 'Synchronisation des épaisseurs dans le Débit et le Devis',
        description: 'Liaison de l\'épaisseur réelle de chaque pièce (15 mm, 18 mm ou sur mesure) au devis et à l\'optimiseur de coupe.',
        tag: 'Calculs'
      },
      {
        type: 'improvement',
        title: 'Refonte de la barre supérieure en icônes compactes CAD',
        description: 'Réduction de la largeur de plus de 60%, remplaçant les textes par des boutons à info-bulles interactives, éliminant les chevauchements en HD (1366×768).',
        tag: 'Interface'
      },
      {
        type: 'improvement',
        title: 'En-tête global affiné et professionnel',
        description: 'Hauteur réduite à 44 px, onglets de navigation épurés et boutons d\'action rapide standardisés.',
        tag: 'Interface'
      },
      {
        type: 'fix',
        title: 'Correction du calcul de devis de panneaux',
        description: 'Correction du bug qui affichait 18 mm par défaut sur les pièces générées en 15 mm.',
        tag: 'Devis'
      }
    ]
  },
  {
    version: 'v2.4.0',
    name: 'Cuisine Pro Studio & Plans de Travail Paramétriques 3D',
    releaseDate: '21 Octobre 2026',
    isCurrent: false,
    summary: 'Lancement du module Cuisine Pro pour conception de cuisines complètes, plans de travail en granit/marbre/quartz avec crédences et sélecteur de finitions en 1 clic.',
    highlights: [
      'Assistant Cuisine Pro Studio avec meubles bas, hauts, d\'angle et colonnes de four',
      'Plans de travail intelligents 3D avec épaisseurs configurables et crédence',
      'Palette de matériaux globaux (Chêne, Noyer, Blanc Polaire, Granit Noir, Marbre Calacatta)'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Générateur de Plans de Travail Intelligents',
        description: 'Génération 3D s\'adaptant automatiquement à l\'empreinte des meubles bas sélectionnés.',
        tag: 'Cuisine Pro'
      },
      {
        type: 'feature',
        title: 'Panneau de Styles et Textures en 1 Clic',
        description: 'Application immédiate de textures et finitions à l\'ensemble du projet ou aux modules choisis.',
        tag: 'Matériaux'
      },
      {
        type: 'improvement',
        title: 'Gestionnaire de gabarits de meubles préconçus',
        description: 'Catalogue de gabarits avec caissons 2, 3 et 4 tiroirs, garde-manger et sous-éviers.',
        tag: 'Gabarits'
      }
    ]
  },
  {
    version: 'v2.3.0',
    name: 'Optimiseur de Débit 2D et Devis Dynamique',
    releaseDate: '15 Octobre 2026',
    isCurrent: false,
    summary: 'Algorithme de coupe guillotine bidimensionnel pour une utilisation optimale des panneaux, réduction des chutes et chiffrage commercial automatique.',
    highlights: [
      'Calcul du trait de scie (Kerf) et marge de délignage périphérique',
      'Diagramme interactif de répartition des pièces avec orientation selon le fil',
      'Chiffrage au mètre linéaire des bandes de chant, panneaux et quincaillerie'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Algorithme de coupe Guillotine 2D',
        description: 'Agencement automatique réduisant les chutes et optimisant les passes de coupe pour scie à panneaux.',
        tag: 'Optimiseur'
      },
      {
        type: 'feature',
        title: 'Devis dynamique en temps réel',
        description: 'Calcul précis des matériaux, chants minces/épais, quincaillerie et marge commerciale.',
        tag: 'Devis'
      },
      {
        type: 'improvement',
        title: 'Exportation des fiches de débit',
        description: 'Génération d\'étiquettes à QR code et fiches de coupe pour l\'atelier.',
        tag: 'Atelier'
      }
    ]
  },
  {
    version: 'v2.2.0',
    name: 'Regroupements Modulaires et Cinématique 3D',
    releaseDate: '8 Octobre 2026',
    isCurrent: false,
    summary: 'Transformation de l\'espace 3D en environnement d\'assemblage interactif avec déplacement groupé et ouverture de portes.',
    highlights: [
      'Regroupement des pièces en caissons indépendants (tiroirs, placards, meubles)',
      'Ouverture et fermeture animée des portes battantes et coulissantes en temps réel',
      'Magnétisme intelligent (Snapping) entre faces de panneaux'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Cinématique d\'Ouverture 3D',
        description: 'Inspection intérieure des meubles en ouvrant tiroirs et portes d\'un clic.',
        tag: 'Visualisation'
      },
      {
        type: 'feature',
        title: 'Duplication et déplacement en bloc',
        description: 'Clonage de modules complets avec toute leur hiérarchie et quincaillerie.',
        tag: 'Assemblage'
      }
    ]
  },
  {
    version: 'v2.1.0',
    name: 'Outils CAD Professionnels & Échelle Humaine',
    releaseDate: '1 Octobre 2026',
    isCurrent: false,
    summary: 'Outils de précision millimétrique, mètre ruban 3D, extrusion pousser/tirer et référence ergonomique humaine.',
    highlights: [
      'Mètre ruban 3D avec mesure entre sommets, arêtes et centres',
      'Pousser / Tirer pour redimensionner les panneaux directement dans la scène 3D',
      'Silhouette d\'échelle humaine et boussole spatiale'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Outil Mètre Ruban CAD',
        description: 'Prise de mesures précises point à point avec affichage de cotes dynamiques.',
        tag: 'CAD'
      },
      {
        type: 'feature',
        title: 'Pousser / Tirer (Push-Pull)',
        description: 'Ajustement direct en étirant ou contractant les panneaux sur l\'axe voulu.',
        tag: 'CAD'
      }
    ]
  },
  {
    version: 'v1.0.0',
    name: 'Lancement Initial de Piezo3D Studio',
    releaseDate: '15 Septembre 2026',
    isCurrent: false,
    summary: 'Première version officielle du logiciel web de conception de menuiserie et débit millimétrique.',
    highlights: [
      'Moteur 3D accéléré WebGL avec Three.js',
      'Insertion paramétrique de pièces mélaminées sur axes X, Y, Z',
      'Stockage local et persistance dans le cloud Supabase'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Scène 3D avec caméras orbitale et orthogonale',
        description: 'Navigation libre, vues de face, côté, dessus et vue isométrique.',
        tag: 'Moteur 3D'
      },
      {
        type: 'feature',
        title: 'Intégration Supabase Cloud',
        description: 'Sauvegarde sécurisée dans le cloud et synchronisation multi-appareils.',
        tag: 'Cloud'
      }
    ]
  }
];

export const ROADMAP_FR: RoadmapItem[] = [
  {
    id: 'diagonal_cuts',
    title: 'Plans de Travail avec Coupes Diagonales et Chanfreins 45°',
    description: 'Outil de découpe polygonale pour angles arrondis, chanfreins et coupes biaises sur plans en granit, quartz et îlots.',
    status: 'in_progress',
    category: 'Plans & Géométrie',
    targetTimeline: 'Prochaine Version (v2.6.0)',
    badge: 'En Développement Actif',
    progressPercent: 75
  },
  {
    id: 'furniture_gallery_3d',
    title: 'Galerie d\'Électroménager, Accessoires et Décoration 3D',
    description: 'Catalogue d\'objets 3D prêts à glisser : éviers sous/sur plan, mitigeurs, plaques induction/gaz, fours, hottes, tabourets et luminaires.',
    status: 'in_progress',
    category: 'Ambiance & Décoration',
    targetTimeline: 'Prochaine Version (v2.6.0)',
    badge: 'En Développement Actif',
    progressPercent: 60
  },
  {
    id: 'cnc_mechanization_view',
    title: 'Usinages CNC dans la Liste de Pièces et Vue 3D',
    description: 'Définition visuelle des perçages 35 mm pour charnières invisibles, perçages système 32 mm, coulisses de tiroir et rainures de fond.',
    status: 'in_progress',
    category: 'Fabrication & CNC',
    targetTimeline: 'Novembre 2026',
    badge: 'En Phase de Test',
    progressPercent: 40
  },
  {
    id: 'technical_pdf_blueprints',
    title: 'Génération Automatique de Plans d\'Atelier en PDF',
    description: 'Export en un clic d\'un livret technique PDF contenant les vues cotées 2D de chaque caisson pour faciliter l\'assemblage en atelier.',
    status: 'planned',
    category: 'Plans d\'Atelier',
    targetTimeline: 'T4 2026',
    badge: 'Planifié',
    progressPercent: 15
  },
  {
    id: 'photorealistic_presentation',
    title: 'Mode Présentation Photoréaliste pour Clients',
    description: 'Rendu commercial haute fidélité avec éclairage HDRI, reflets sur plans de travail et lien interactif visualisable sur smartphone.',
    status: 'planned',
    category: 'Ventes & Clients',
    targetTimeline: 'T1 2027',
    badge: 'Planifié',
    progressPercent: 10
  },
  {
    id: 'commercial_quote_generator',
    title: 'Générateur de Proposition Commerciale avec Logo Personnalisé',
    description: 'Devis formels avec logo de l\'atelier, décomposition des matériaux, quincaillerie, main d\'œuvre et rendu en page de garde.',
    status: 'planned',
    category: 'Gestion Commerciale',
    targetTimeline: 'T1 2027',
    badge: 'Planifié',
    progressPercent: 0
  },
  {
    id: 'gcode_cnc_export',
    title: 'Génération Directe de G-Code pour Centres d\'Usinage CNC',
    description: 'Post-processeurs pour fraiseuses CNC 3 axes pour rainurage, perçage et détourage direct sans logiciel tiers.',
    status: 'evaluating',
    category: 'Intégration Industrielle',
    targetTimeline: 'Évaluation Technique',
    badge: 'À l\'Étude'
  },
  {
    id: 'hardware_brand_integration',
    title: 'Intégration des Catalogues Fabricants de Quincaillerie',
    description: 'Systèmes de relevage aventos, tiroirs métalliques tandembox et coulisses invisibles synchronisés avec les grands fabricants.',
    status: 'evaluating',
    category: 'Quincaillerie Pro',
    targetTimeline: 'Évaluation Technique',
    badge: 'À l\'Étude'
  }
];

export const RELEASES_IT: ReleaseVersion[] = [
  {
    version: 'v2.5.0',
    name: 'Sincronizzazione Totale Spessori, Pannelli su Misura e Interfaccia CAD Pro',
    releaseDate: '23 Ottobre 2026',
    isCurrent: true,
    summary: 'Aggiornamento principale focalizzato sulla coerenza millimetrica tra visualizzatore 3D, distinta pezzi e ottimizzatore di taglio, oltre a un\'interfaccia ultracompatta per notebook.',
    highlights: [
      'Sincronizzazione spessori reali (15 mm, 18 mm) su tutte le viste e preventivi',
      'Configuratore parametrico dimensioni pannello con misure commerciali',
      'Barra mobile CAD ultracompatta senza sovrapposizioni su schermi HD'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Selettore e impostazione misure pannello nell\'Ottimizzatore 2D',
        description: 'Consente di modificare lunghezza e larghezza dei pannelli nobilitati con formati standard o personalizzati, con rotazione e avvisi di pezzi fuori misura.',
        tag: 'Ottimizzatore'
      },
      {
        type: 'feature',
        title: 'Sincronizzazione spessori nella Distinta e nel Preventivo',
        description: 'Collegato lo spessore reale di ciascun pezzo al preventivo e all\'ottimizzatore, evitando pannelli con spessori errati.',
        tag: 'Calcoli'
      },
      {
        type: 'improvement',
        title: 'Riprogettazione della barra superiore con icone CAD compatte',
        description: 'Larghezza ridotta di oltre il 60%, sostituendo i testi con icone e tooltip interattivi, eliminando sovrapposizioni in HD (1366×768).',
        tag: 'Interfaccia'
      },
      {
        type: 'improvement',
        title: 'Intestazione globale snella e professionale',
        description: 'Altezza ridotta a 44 px, schede di navigazione compatte e pulsanti di azione rapida standardizzati.',
        tag: 'Interfaccia'
      },
      {
        type: 'fix',
        title: 'Correzione calcolo preventivo pannelli',
        description: 'Eliminato l\'errore che impostava 18 mm di default su pezzi generati a 15 mm.',
        tag: 'Preventivo'
      }
    ]
  },
  {
    version: 'v2.4.0',
    name: 'Cucina Pro Studio & Piani di Lavoro Parametrici 3D',
    releaseDate: '21 Ottobre 2026',
    isCurrent: false,
    summary: 'Lancio del modulo Cucina Pro per progettazione di cucine modulari, top in granito/marmo/quarzo con alzatine parametriche e finiture in 1 clic.',
    highlights: [
      'Assistente Cucina Pro Studio con basi, pensili, angolari e colonne forno',
      'Piani di lavoro intelligenti 3D con spessori configurabili e alzatina (backsplash)',
      'Palette materiali globali (Rovere, Noce, Bianco Polare, Granito Nero, Marmo Calacatta)'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Generatore Piani di Lavoro Intelligenti',
        description: 'Generazione 3D che si adatta automaticamente all\'impronta dei mobili base selezionati.',
        tag: 'Cucina Pro'
      },
      {
        type: 'feature',
        title: 'Pannello Stili e Finiture in 1 Clic',
        description: 'Applicazione istantanea di finiture all\'intero progetto o per singoli moduli.',
        tag: 'Materiali'
      },
      {
        type: 'improvement',
        title: 'Gestore modelli di arredo predefiniti',
        description: 'Catalogo di modelli con cassettiere da 2, 3 e 4 cassetti, dispense e basi sottolavello.',
        tag: 'Modelli'
      }
    ]
  },
  {
    version: 'v2.3.0',
    name: 'Ottimizzatore di Taglio 2D e Preventivo Dinamico',
    releaseDate: '15 Ottobre 2026',
    isCurrent: false,
    summary: 'Algoritmo a ghigliottina bidimensionale per il massimo sfruttamento dei pannelli, riduzione degli scarti e calcolo commerciale automatico.',
    highlights: [
      'Calcolo del taglio considerando spessore lama (Kerf) e rifilatura perimetrale',
      'Diagramma interattivo con rotazione automatica secondo la venatura',
      'Preventivo al metro lineare di bordatura, pannelli impiegati e ferramenta'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Algoritmo di taglio a Ghigliottina 2D',
        description: 'Disposizione automatica dei pezzi per ridurre gli sfridi e ottimizzare i passaggi dell\'operatore alla sezionatrice.',
        tag: 'Ottimizzatore'
      },
      {
        type: 'feature',
        title: 'Preventivo dinamico in tempo reale',
        description: 'Calcolo immediato di materiali, bordi sottili/spessi, ferramenta e margine di profitto.',
        tag: 'Preventivo'
      },
      {
        type: 'improvement',
        title: 'Esportazione schede di taglio',
        description: 'Creazione di etichette con codici QR e liste di taglio per la produzione in laboratorio.',
        tag: 'Laboratorio'
      }
    ]
  },
  {
    version: 'v2.2.0',
    name: 'Raggruppamenti Modulari e Cinematica 3D',
    releaseDate: '8 Ottobre 2026',
    isCurrent: false,
    summary: 'Trasformazione dello spazio 3D in ambiente di montaggio modulare interattivo con trascinamento sincronizzato e apertura ante.',
    highlights: [
      'Raggruppamento pezzi in moduli indipendenti (cassetti, pensili, basi)',
      'Apertura e chiusura animata di ante e cassetti in tempo reale',
      'Aggancio magnetico intelligente (Snapping) tra facce contigue'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Cinematica di Apertura 3D',
        description: 'Ispezione interna dei mobili aprendo cassetti e ante con un clic.',
        tag: 'Visualizzazione'
      },
      {
        type: 'feature',
        title: 'Duplicazione e spostamento in blocco',
        description: 'Clonazione di moduli completi con l\'intera gerarchia di pezzi e ferramenta.',
        tag: 'Montaggio'
      }
    ]
  },
  {
    version: 'v2.1.0',
    name: 'Strumenti CAD Professionali & Scala Umana',
    releaseDate: '1 Ottobre 2026',
    isCurrent: false,
    summary: 'Inclusione di strumenti di precisione millimetrica, flessometro 3D, estrudi Spingi/Tira e figura umana ergonomica.',
    highlights: [
      'Flessometro 3D con misurazione tra vertici, spigoli e punti mediani',
      'Strumento Spingi / Tira per ridimensionare pannelli direttamente nel 3D',
      'Sagoma di scala umana e bussola di orientamento nello spazio'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Strumento Flessometro CAD',
        description: 'Misurazioni precise punto a punto nello spazio con quote dinamiche.',
        tag: 'CAD'
      },
      {
        type: 'feature',
        title: 'Spingi / Tira (Push-Pull)',
        description: 'Modifica diretta trascinando le facce dei pannelli sull\'asse desiderato.',
        tag: 'CAD'
      }
    ]
  },
  {
    version: 'v1.0.0',
    name: 'Rilascio Iniziale di Piezo3D Studio',
    releaseDate: '15 Settembre 2026',
    isCurrent: false,
    summary: 'Prima versione ufficiale del software web per falegnameria e distinte di taglio millimetriche.',
    highlights: [
      'Motore 3D accelerato WebGL basato su Three.js',
      'Inserimento parametrico di pannelli nobilitati sugli assi X, Y, Z',
      'Salvataggio locale e persistenza nel cloud Supabase'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Spazio 3D con controllo telecamera orbitale e ortogonale',
        description: 'Navigazione libera, viste frontale, laterale, superiore e proiezione assonometrica.',
        tag: 'Motore 3D'
      },
      {
        type: 'feature',
        title: 'Integrazione Cloud Supabase',
        description: 'Salvataggio sicuro dei progetti nel cloud con sincronizzazione tra dispositivi.',
        tag: 'Cloud'
      }
    ]
  }
];

export const ROADMAP_IT: RoadmapItem[] = [
  {
    id: 'diagonal_cuts',
    title: 'Piani di Lavoro con Tagli Diagonali e Smussi a 45°',
    description: 'Strumento di taglio poligonale per spigoli arrotondati, biselli e tagli angolari su piani in quarzo, granito e penisole.',
    status: 'in_progress',
    category: 'Piani & Geometria',
    targetTimeline: 'Prossima Versione (v2.6.0)',
    badge: 'In Sviluppo Attivo',
    progressPercent: 75
  },
  {
    id: 'furniture_gallery_3d',
    title: 'Galleria di Elettrodomestici, Accessori e Arredi 3D',
    description: 'Catalogo di modelli 3D pronti da trascinare: lavelli sottopiano/soprapiano, miscelatori, piani a induzione/gas, forni a incasso, cappe, sgabelli e lampade.',
    status: 'in_progress',
    category: 'Ambiente & Arredo',
    targetTimeline: 'Prossima Versione (v2.6.0)',
    badge: 'In Sviluppo Attivo',
    progressPercent: 60
  },
  {
    id: 'cnc_mechanization_view',
    title: 'Lavorazioni CNC nella Distinta Pezzi e Vista 3D',
    description: 'Rappresentazione grafica di fori da 35 mm per cerniere, file di fori sistema 32 mm, guide per cassetti e canali schienale da 3 mm / 5.5 mm.',
    status: 'in_progress',
    category: 'Produzione & CNC',
    targetTimeline: 'Novembre 2026',
    badge: 'In Fase di Test',
    progressPercent: 40
  },
  {
    id: 'technical_pdf_blueprints',
    title: 'Generazione Automatica di Disegni Tecnici PDF per Falegnameria',
    description: 'Esportazione con un clic di fascicoli tecnici PDF con piante, prospetti e sezioni quotate in 2D per facilitare il montaggio.',
    status: 'planned',
    category: 'Disegni di Laboratorio',
    targetTimeline: 'Q4 2026',
    badge: 'Pianificato',
    progressPercent: 15
  },
  {
    id: 'photorealistic_presentation',
    title: 'Modalità Presentazione Fotorealistica per Clienti',
    description: 'Visualizzazione commerciale ad alta fedeltà con illuminazione HDRI, riflessi realistici e link condivisibili per visualizzazione da smartphone.',
    status: 'planned',
    category: 'Vendite & Clienti',
    targetTimeline: 'Q1 2027',
    badge: 'Pianificato',
    progressPercent: 10
  },
  {
    id: 'commercial_quote_generator',
    title: 'Generatore di Proposte Commerciali con Logo Personalizzato',
    description: 'Creazione di preventivi formali con logo del laboratorio, elenco materiali, accessori, manodopera e render di copertina.',
    status: 'planned',
    category: 'Gestione Commerciale',
    targetTimeline: 'Q1 2027',
    badge: 'Pianificato',
    progressPercent: 0
  },
  {
    id: 'gcode_cnc_export',
    title: 'Generazione Diretta di Codice G-Code per Centri di Lavoro CNC',
    description: 'Post-processori compatibili con pantografi e router CNC a 3 assi per fresatura, canali e forature dirette.',
    status: 'evaluating',
    category: 'Integrazione Industriale',
    targetTimeline: 'Valutazione Tecnica',
    badge: 'In Valutazione'
  },
  {
    id: 'hardware_brand_integration',
    title: 'Integrazione dei Cataloghi Produttori Ferramenta',
    description: 'Sistemi di apertura verso l\'alto aventos, cassetti metallici tandembox e guide a scomparsa sincronizzati con i produttori leader.',
    status: 'evaluating',
    category: 'Ferramenta Pro',
    targetTimeline: 'Valutazione Tecnica',
    badge: 'In Valutazione'
  }
];

export const RELEASES_DE: ReleaseVersion[] = [
  {
    version: 'v2.5.0',
    name: 'Vollständige Stärken-Synchronisation, Maßplatten & Pro-CAD-Oberfläche',
    releaseDate: '23. Oktober 2026',
    isCurrent: true,
    summary: 'Großes Update mit Fokus auf millimetergenaue Konsistenz zwischen 3D-Viewer, Stückliste und Zuschnittoptimierer sowie ultrakompakter Oberfläche für Laptops.',
    highlights: [
      'Synchronisation realer Plattenstärken (15 mm, 18 mm) über alle Ansichten und Kalkulationen',
      'Parametrischer Plattenmaß-Konfigurator mit handelsüblichen Standardformaten',
      'Ultrakompakte schwebende CAD-Leiste ohne Überlappungen auf HD-Displays'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Plattenmaß-Auswahl und Konfiguration im 2D-Optimierer',
        description: 'Bearbeitung von Länge und Breite von Melaminharzplatten mit Standard- oder Maßformaten, Drehung und Warnungen bei übergroßen Bauteilen.',
        tag: 'Optimierer'
      },
      {
        type: 'feature',
        title: 'Stärken-Synchronisation in Stückliste und Kalkulation',
        description: 'Verknüpfung der tatsächlichen Bauteilstärke (15 mm, 18 mm oder frei) mit Angebot und Schnittplan, um Fehlkalkulationen zu vermeiden.',
        tag: 'Berechnungen'
      },
      {
        type: 'improvement',
        title: 'Neugestaltung der oberen Werkzeugleiste mit kompakten CAD-Symbolen',
        description: 'Breitenreduktion um mehr als 60 % durch Icon-Buttons mit Tooltips, verhindert Überlappung auf HD-Bildschirmen (1366×768).',
        tag: 'Oberfläche'
      },
      {
        type: 'improvement',
        title: 'Schlanke & professionelle globale Kopfzeile',
        description: 'Höhe auf 44 px reduziert, kompakte Navigationsreiter und einheitliche Schnellaktions-Buttons mit Tooltips.',
        tag: 'Oberfläche'
      },
      {
        type: 'fix',
        title: 'Korrektur der Plattenberechnung im Angebot',
        description: 'Behebung des Fehlers, bei dem standardmäßig 18 mm statt der gewählten 15 mm berechnet wurden.',
        tag: 'Angebot'
      }
    ]
  },
  {
    version: 'v2.4.0',
    name: 'Küche Pro Studio & Parametrische 3D-Arbeitsplatten',
    releaseDate: '21. Oktober 2026',
    isCurrent: false,
    summary: 'Start des Küche-Pro-Moduls für Einbauküchen, Arbeitsplatten aus Granit/Marmor/Quarz mit Wandanschlussleisten und 1-Klick-Materialauswahl.',
    highlights: [
      'Küche Pro Studio Assistent mit Unterschränken, Hängeschränken, Eckschränken und Geräteschränken',
      'Intelligente 3D-Arbeitsplatten mit einstellbaren Stärken und Wischleiste (Backsplash)',
      'Globale Materialpalette (Eiche, Nussbaum, Polarweiß, Schwarzer Granit, Calacatta-Marmor)'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Intelligenter Arbeitsplatten-Generator',
        description: 'Automatische Anpassung von 3D-Arbeitsplatten an die Kontur der gewählten Unterschränke.',
        tag: 'Küche Pro'
      },
      {
        type: 'feature',
        title: '1-Klick Stil- und Textur-Panel',
        description: 'Direkte Zuweisung von Dekoren und Oberflächen auf das gesamte Projekt oder gewählte Schränke.',
        tag: 'Materialien'
      },
      {
        type: 'improvement',
        title: 'Vorlagen-Manager für vorgefertigte Schränke',
        description: 'Katalog mit 2-, 3- und 4-Schubladen-Schränken, Vorratsschränken und Spülenunterschränken.',
        tag: 'Vorlagen'
      }
    ]
  },
  {
    version: 'v2.3.0',
    name: '2D-Sägezuschnitt-Optimierer und Dynamische Kalkulation',
    releaseDate: '15. Oktober 2026',
    isCurrent: false,
    summary: '2D-Guillotine-Algorithmus zur optimalen Plattenausnutzung, Verschnittreduktion und automatischen gewerblichen Vorkalkulation.',
    highlights: [
      'Schnittfugenberechnung unter Berücksichtigung von Sägeblattdicke (Kerf) und Besäumschnitt',
      'Interaktiver Schnittplan mit automatischer Drehung passend zur Maserung',
      'Kalkulation von Kantenumleimern pro Laufmeter, Plattenverbrauch und Beschlägen'
    ],
    changes: [
      {
        type: 'feature',
        title: '2D-Guillotine-Zuschnittalgorithmus',
        description: 'Automatische Teileverschachtelung zur Minimierung von Resten und Optimierung der Schnittfolgen an Formatkreissäge oder Plattenaufteilsäge.',
        tag: 'Optimierer'
      },
      {
        type: 'feature',
        title: 'Dynamische Echtzeit-Kalkulation',
        description: 'Berechnung von Materialkosten, Dünn-/Starkkanten, Beschlägen und einstellbarer Marge.',
        tag: 'Angebot'
      },
      {
        type: 'improvement',
        title: 'Export von Zuschnittberichten',
        description: 'Erstellung von QR-Code-Etiketten und Stücklisten für den Werkstattdruck.',
        tag: 'Werkstatt'
      }
    ]
  },
  {
    version: 'v2.2.0',
    name: 'Modulare Baugruppen und 3D-Kinematik',
    releaseDate: '8. Oktober 2026',
    isCurrent: false,
    summary: 'Verwandlung der 3D-Bühne in eine interaktive Montage-Umgebung mit synchronem Verschieben und Türöffnung.',
    highlights: [
      'Gruppierung von Bauteilen zu eigenständigen Korpora (Schubladen, Hängeschränke, Schränke)',
      'Animiertes Öffnen und Schließen von Dreh- und Schiebetüren in Echtzeit',
      'Intelligentes magnetisches Fügen (Snapping) an angrenzenden Plattenflächen'
    ],
    changes: [
      {
        type: 'feature',
        title: '3D-Öffnungskinematik',
        description: 'Möbelinnenraum-Prüfung durch interaktives Öffnen von Türen und Schubladen.',
        tag: 'Visualisierung'
      },
      {
        type: 'feature',
        title: 'Block-Duplizierung und Bewegung',
        description: 'Kopieren ganzer Korpusse mitsamt aller zugehörigen Beschläge und Teile.',
        tag: 'Montage'
      }
    ]
  },
  {
    version: 'v2.1.0',
    name: 'Professionelle CAD-Werkzeuge & Ergonomischer Maßstab',
    releaseDate: '1. Oktober 2026',
    isCurrent: false,
    summary: 'Millimetergenaue Werkzeuge, 3D-Messband, Drücken/Ziehen (Push-Pull) und menschliche Maßstabsfigur.',
    highlights: [
      '3D-Messband zum Messen zwischen Eckpunkten, Kanten und Mittelpunkten',
      'Drücken/Ziehen zum direkten Ändern von Plattenabmessungen im 3D-Raum',
      'Menschliche Maßstabsfigur und Kompass zur räumlichen Orientierung'
    ],
    changes: [
      {
        type: 'feature',
        title: 'CAD-Messbandwerkzeug',
        description: 'Präzise Punkt-zu-Punkt-Messung mit dynamischer Maßanzeige.',
        tag: 'CAD'
      },
      {
        type: 'feature',
        title: 'Drücken / Ziehen (Push-Pull)',
        description: 'Direktes Anpassen von Bauteilmaßen durch Ziehen oder Drücken der Plattenseiten.',
        tag: 'CAD'
      }
    ]
  },
  {
    version: 'v1.0.0',
    name: 'Erstveröffentlichung von Piezo3D Studio',
    releaseDate: '15. September 2026',
    isCurrent: false,
    summary: 'Erste offizielle Version der webbasierten Schreinerei-CAD- und millimetergenauen Zuschnittsoftware.',
    highlights: [
      'WebGL-beschleunigte 3D-Engine mit Three.js',
      'Parametrische Platzierung von Melaminplatten auf X-, Y-, Z-Achsen',
      'Lokaler Projektspeicher und Supabase-Cloud-Synchronisation'
    ],
    changes: [
      {
        type: 'feature',
        title: '3D-Arbeitsraum mit Orbit- und Orthogonal-Kamera',
        description: 'Freie Navigation, Vorder-, Seiten-, Draufsicht und Isometrie-Projektion.',
        tag: '3D-Engine'
      },
      {
        type: 'feature',
        title: 'Supabase Cloud-Integration',
        description: 'Sichere Projektspeicherung in der Cloud mit geräteübergreifender Synchronisation.',
        tag: 'Cloud'
      }
    ]
  }
];

export const ROADMAP_DE: RoadmapItem[] = [
  {
    id: 'diagonal_cuts',
    title: 'Arbeitsplatten mit Diagonalschnitten und 45°-Fasen',
    description: 'Polygonales Schneidwerkzeug für gerundete Ecken, Fasen und Gehrungsschnitte auf Arbeitsplatten aus Granit, Quarz oder Thekenplatten.',
    status: 'in_progress',
    category: 'Arbeitsplatten & Geometrie',
    targetTimeline: 'Nächste Version (v2.6.0)',
    badge: 'In aktiver Entwicklung',
    progressPercent: 75
  },
  {
    id: 'furniture_gallery_3d',
    title: '3D-Bibliothek für Einbaugeräte, Zubehör und Deko',
    description: '3D-Modellkatalog zum direkten Einfügen: Unterbau-/Auflagespülen, Einhebelmischer, Induktions-/Gaskochfelder, Einbaubacköfen, Dunstabzugshauben, Barhocker und Hängeleuchten.',
    status: 'in_progress',
    category: 'Raum & Dekoration',
    targetTimeline: 'Nächste Version (v2.6.0)',
    badge: 'In aktiver Entwicklung',
    progressPercent: 60
  },
  {
    id: 'cnc_mechanization_view',
    title: 'CNC-Bearbeitungen in Stückliste und 3D-Ansicht',
    description: 'Grafische Definition von 35-mm-Topfbandbohrungen, System-32-Lochreihen, Schubladenführungsbohrungen und 3-mm- / 5.5-mm-Rückwandnuten.',
    status: 'in_progress',
    category: 'Fertigung & CNC',
    targetTimeline: 'November 2026',
    badge: 'In Testphase',
    progressPercent: 40
  },
  {
    id: 'technical_pdf_blueprints',
    title: 'Automatische Werkstatt-PDF-Fertigungspläne',
    description: '1-Klick-Export eines technischen PDF-Buchs mit 2D-Ansichten (Grundriss, Ansicht, Schnitt) jedes Korpus zur reibungslosen Montage.',
    status: 'planned',
    category: 'Werkstattdokumentation',
    targetTimeline: 'Q4 2026',
    badge: 'Geplant',
    progressPercent: 15
  },
  {
    id: 'photorealistic_presentation',
    title: 'Fotorealistischer Kunden-Präsentationsmodus',
    description: 'Verkaufsfördernde Ansicht mit HDRI-Beleuchtung, Glanzeffekten auf Arbeitsplatten und interaktiven Weblinks für das Kunden-Smartphone.',
    status: 'planned',
    category: 'Vertrieb & Kunden',
    targetTimeline: 'Q1 2027',
    badge: 'Geplant',
    progressPercent: 10
  },
  {
    id: 'commercial_quote_generator',
    title: 'Kundenangebot-Generator mit eigenem Firmenlogo',
    description: 'Erstellung formeller Angebote mit Werkstatt-Logo, Aufschlüsselung von Material, Beschlägen, Lohnkosten und Deckblatt-Rendering.',
    status: 'planned',
    category: 'Kaufmännische Verwaltung',
    targetTimeline: 'Q1 2027',
    badge: 'Geplant',
    progressPercent: 0
  },
  {
    id: 'gcode_cnc_export',
    title: 'Direkte G-Code-Generierung für CNC-Bearbeitungszentren',
    description: 'Postprozessoren für 3-Achs-CNC-Fräsen zum direkten Fräsen, Nuten und Bohren ohne externe Software.',
    status: 'evaluating',
    category: 'Industrielle Integration',
    targetTimeline: 'Technische Prüfung',
    badge: 'In Prüfung'
  },
  {
    id: 'hardware_brand_integration',
    title: 'Integration führender Beschlagshersteller-Kataloge',
    description: 'Aventos-Klappenbeschläge, Tandembox-Metallschubkästen und Unterflurführungen direkt synchronisiert mit Herstellerdaten.',
    status: 'evaluating',
    category: 'Profi-Beschläge',
    targetTimeline: 'Technische Prüfung',
    badge: 'In Prüfung'
  }
];

export const APP_RELEASES_BY_LANG: Record<AppLanguage, ReleaseVersion[]> = {
  es: RELEASES_ES,
  en: RELEASES_EN,
  pt: RELEASES_PT,
  fr: RELEASES_FR,
  it: RELEASES_IT,
  de: RELEASES_DE
};

export const APP_ROADMAP_BY_LANG: Record<AppLanguage, RoadmapItem[]> = {
  es: ROADMAP_ES,
  en: ROADMAP_EN,
  pt: ROADMAP_PT,
  fr: ROADMAP_FR,
  it: ROADMAP_IT,
  de: ROADMAP_DE
};
