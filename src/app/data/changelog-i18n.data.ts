import { ReleaseVersion, RoadmapItem } from '../models/changelog.models';
import { AppLanguage } from './i18n-translations.data';

export const RELEASES_ES: ReleaseVersion[] = [
  {
    version: 'v3.0.0',
    name: 'Evolución Industrial: Motor Paramétrico Multi-Ambiente, Cotas HD 3D y Exportación Total',
    releaseDate: 'Noviembre 2026',
    isCurrent: true,
    summary: 'Gran salto arquitectónico hacia la parametrización integral de muebles por ambientes, acotado tridimensional interactivo de luz interna, catálogo masivo de melaminas, presupuesto multimoneda en vivo y suite de exportación industrial para producción.',
    highlights: [
      'Motor paramétrico multi-ambiente en 4 líneas: Cocinas, Closets, Baños (destaje sifón en U) y Hogar/Estudio',
      'Cotas de luz interna HD con riel vertical anti-colisión y edición numérica directa en el lienzo 3D',
      'Catálogo masivo con más de 35 melaminas, mesones de mármol/cuarzo, electrodomésticos 3D y selección con Shift',
      'Presupuesto multimoneda en tiempo real (COP canónico a USD, MXN, EUR), herrajes automáticos y descuento de tapacanto',
      'Exportación industrial completa: SketchUp .DAE milimétrico, manuales de armado PDF estilo IKEA y DXF CNC',
      'Sistema multilenguaje instantáneo en 6 idiomas (ES, EN, PT, FR, IT, DE) reactivo sin recargar WebGL'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Motor Paramétrico Multi-Ambiente en 4 Líneas de Diseño',
        description: 'Módulos inteligentes especializados para Cocinas Integrales (bajos, aéreos, esquineros a 45° y ciegos), Closets y Vestidores (distribución de repisas, cajoneras y barras colgadoras), Baños (vanities flotantes con destaje para sifón en U paramétrico) y Hogar / Estudio (escritorios y libreros) con resolución geométrica sin colisiones.',
        tag: 'Paramétrico'
      },
      {
        type: 'feature',
        title: 'Cotas de Luz Interna HD y Edición Numérica Directa en 3D',
        description: 'Visualización nítida de distancias útiles (Luz Superior, Luz Inferior y Ancho Interno) mediante sprites de alta resolución. Permite hacer clic directamente sobre cualquier cota en 3D para editar su valor con el teclado, con desplazamiento de entrepaños en riel vertical con detección anti-colisión y auto-centrado.',
        tag: 'Cotas 3D'
      },
      {
        type: 'feature',
        title: 'Catálogo Masivo de Materiales y Selección Múltiple con Shift',
        description: 'Más de 35 melaminas organizadas en familias comerciales (maderas naturales, unicolores mate, alto brillo y textiles), mesones de cuarzo y mármol con salpicadero paramétrico, y catálogo de electrodomésticos low-poly. Soporte de selección múltiple con Shift para editar propiedades y texturas en lote.',
        tag: 'Catálogo & 3D'
      },
      {
        type: 'feature',
        title: 'Presupuesto Multimoneda en Tiempo Real y Descuento de Tapacanto',
        description: 'Cotización dinámica con base canónica en COP convertible en vivo a USD, MXN, EUR y otras divisas con tasas de mercado actualizadas. Incorporación del ajuste subtractEdgeBandingFromCut en el optimizador 2D para descontar el espesor del tapacanto en las piezas de corte.',
        tag: 'Presupuesto'
      },
      {
        type: 'feature',
        title: 'Exportación Industrial Completa (.DAE, Manuales PDF y DXF)',
        description: 'Exportador 3D COLLADA 1.4.1 (.DAE) milimétrico compatible con SketchUp con jerarquías limpias, generador de manuales de armado paso a paso estilo IKEA en PDF con vista explosionada y tabla de tornillería, y archivos DXF con entidades LWPOLYLINE para corte y mecanizado.',
        tag: 'Exportación'
      },
      {
        type: 'feature',
        title: 'Sistema Multilenguaje Instantáneo en 6 Idiomas',
        description: 'Cambio fluido e instantáneo entre Español, English, Português, Français, Italiano y Deutsch en toda la interfaz sin necesidad de recargar la página ni reiniciar el contexto WebGL.',
        tag: 'Multilenguaje'
      },
      {
        type: 'improvement',
        title: 'Cómputo Unificado de Herrajes y Fijaciones sin Duplicidad',
        description: 'Detección automática de bisagras, correderas, tiradores y tornillos según la cinemática del módulo, evitando duplicación en el costo final de los herrajes.',
        tag: 'Herrajes'
      },
      {
        type: 'fix',
        title: 'Optimización de Holguras y Ranurado en Módulos Especiales',
        description: 'Ajuste de holguras perimetrales de 2 mm en frentes de cajón y alineación de ranuras de fondo de 3 mm en esquineros y vanities suspendidos.',
        tag: 'Geometría'
      }
    ]
  },
  {
    version: 'v2.5.0',
    name: 'Sincronización Total de Espesores, Tableros a Medida e Interfaz CAD Pro',
    releaseDate: '23 de Octubre de 2026',
    isCurrent: false,
    summary: 'Actualización mayor enfocada en consistencia de cálculo milimétrico entre el visor 3D, despiece y optimizador de corte, además de una interfaz ultracompacta para portátiles.',
    highlights: [
      'Sincronización de espesores reales (15 mm, 18 mm) en todas las vistas y presupuestos',
      'Configurador paramétrico del tamaño de tablero de corte con presets comerciales',
      'Cinta flotante de edición compacta sin solapamiento en pantallas HD'
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
        title: 'Rediseño de la cinta superior a controles compactos',
        description: 'Se redujo el ancho de la cinta de opciones en más del 60%, reemplazando textos por botones icónicos con tooltip interactivo (Congelar, Duplicar, Mover, Girar y Orientación H/L/F), eliminando solapamientos en pantallas HD (1366×768).',
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
        description: 'Generación de mesones 3D paramétricos que se adaptan a la huella superior de los muebles bajos seleccionados.',
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
    name: 'Precisión Dimensional & Escala Humana',
    releaseDate: '1 de Octubre de 2026',
    isCurrent: false,
    summary: 'Inclusión de herramientas de precisión milimétrica, medición paramétrica tridimensional y referencia visual ergonómica.',
    highlights: [
      'Medición tridimensional dinámica entre piezas, aristas y centros',
      'Edición dimensional guiada en ejes ortogonales X, Y, Z',
      'Figura de escala humana y brújula de orientación espacial'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Medición Dimensional de Precisión',
        description: 'Toma de medidas precisas punto a punto en el espacio tridimensional con visualización de cotas.',
        tag: 'Medición'
      },
      {
        type: 'feature',
        title: 'Ajuste Dimensional Ortogonal',
        description: 'Ajuste directo de dimensiones sobre los ejes ortogonales para tableros y módulos.',
        tag: 'Geometría'
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
    id: 'custom_glb_import',
    title: 'Importación de Modelos 3D Personalizados en Formato .GLB / .GLTF',
    description: 'Capacidad de arrastrar y soltar modelos 3D personalizados de electrodomésticos, campanas, griferías o accesorios decorativos con optimización automática de polígonos y texturas.',
    status: 'in_progress',
    category: 'Personalización & 3D',
    targetTimeline: 'Q1 2027',
    badge: 'En Desarrollo Activo',
    progressPercent: 65
  },
  {
    id: 'cloud_quote_link',
    title: 'Cotización Compartible por Enlace Web Público en la Nube',
    description: 'Generación de enlaces interactivos seguros para que los clientes finales exploren el presupuesto, desglose de materiales y visualización 3D desde cualquier teléfono o tablet.',
    status: 'in_progress',
    category: 'Ventas & Clientes',
    targetTimeline: 'Q1 2027',
    badge: 'En Desarrollo',
    progressPercent: 45
  },
  {
    id: 'hardware_brand_templates',
    title: 'Plantillas Avanzadas de Herrajes Blum y Hettich',
    description: 'Integración paramétrica de sistemas de elevación (Aventos HK-S, HF), cajoneras metálicas (Legrabox, AvanTech YOU) y guías ocultas con mapas de perforación exactos.',
    status: 'planned',
    category: 'Herrajes Industriales',
    targetTimeline: 'Q2 2027',
    badge: 'Planificado',
    progressPercent: 20
  },
  {
    id: 'gcode_cnc_export',
    title: 'Postprocesador Directo de Código G-Code para CNC de 3 Ejes',
    description: 'Generación directa de archivos G-Code estándar (G0, G1, G2, G3) para fresado de ranuras, desbaste perimetral y taladrado en routers CNC de carpintería.',
    status: 'evaluating',
    category: 'Integración CNC',
    targetTimeline: 'Evaluación Técnica',
    badge: 'Bajo Estudio'
  },
  {
    id: 'photorealistic_presentation',
    title: 'Modo Presentación Fotorrealista para Clientes',
    description: 'Visualización comercial de alta fidelidad con iluminación ambiental HDRI, reflejos en melaminas brillo y sombras de contacto suaves.',
    status: 'planned',
    category: 'Ventas & Clientes',
    targetTimeline: 'Q2 2027',
    badge: 'Planificado',
    progressPercent: 15
  }
];

export const RELEASES_EN: ReleaseVersion[] = [
  {
    version: 'v3.0.0',
    name: 'Industrial Evolution: Multi-Room Parametric Engine, HD 3D Dimensions & Full Export',
    releaseDate: 'November 2026',
    isCurrent: true,
    summary: 'Major architectural breakthrough introducing comprehensive parametric furniture design across room categories, real-time HD internal clearance dimensioning, massive melamine catalog, live multi-currency budgeting, and a full industrial export suite for manufacturing.',
    highlights: [
      'Multi-room parametric engine in 4 lines: Kitchens, Closets, Bathrooms (U-siphon vanity cutout), and Living/Office',
      'HD internal clearance dimensions with vertical anti-collision rail and direct numeric inline editing in 3D',
      'Massive catalog with 35+ melamines, marble/quartz countertops, 3D appliances, and Shift batch multi-selection',
      'Real-time multi-currency budget (canonical COP to USD, MXN, EUR), automatic hardware calculation and edge banding deduction',
      'Complete industrial export: millimeter-scale SketchUp .DAE, IKEA-style step-by-step PDF assembly guides, and CNC DXF',
      'Instantaneous 6-language system (ES, EN, PT, FR, IT, DE) reactively switching without WebGL reload'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Multi-Room Parametric Engine in 4 Specialized Lines',
        description: 'Full parametric design with tailored modules for Fitted Kitchens (base, wall, 45° corner, and blind straight units), Closets & Wardrobes (dynamic shelving, drawer banks, and hanging rods), Bathrooms (floating vanities with automatic parametric U-siphon cutout), and Living / Office (desks and bookcases) with zero geometric collisions.',
        tag: 'Parametric'
      },
      {
        type: 'feature',
        title: 'HD Internal Clearance Dimensions & Direct 3D Editing',
        description: 'Crisp real-time display of usable internal clearances (Top Clearance, Bottom Clearance, and Internal Width) via high-definition billboard sprites. Click directly on any 3D dimension label to input exact numbers via keyboard, with vertical rail shelf sliding and anti-collision centering.',
        tag: '3D Dimensions'
      },
      {
        type: 'feature',
        title: 'Massive Material Catalog and Shift Batch Multi-Selection',
        description: 'Over 35 commercial melamines grouped into woodgrains, matte solids, high gloss, and textiles, plus quartz and marble countertops with parametric backsplashes, and low-poly 3D appliances. Select multiple items with Shift to batch-update finishes and properties.',
        tag: 'Catalog & 3D'
      },
      {
        type: 'feature',
        title: 'Real-Time Multi-Currency Budgeting & Edge Banding Cut Allowance',
        description: 'Dynamic quotation engine with canonical COP base converting live to USD, MXN, EUR and more using real-time forex rates. Integrates subtractEdgeBandingFromCut option in the 2D cut optimizer to deduct edge tape thickness for seamless joinery.',
        tag: 'Budget'
      },
      {
        type: 'feature',
        title: 'Full Industrial Export Suite (.DAE, PDF Manuals & CNC DXF)',
        description: 'Millimeter-scale COLLADA 1.4.1 (.DAE) 3D exporter for SketchUp with organized part hierarchies, IKEA-style step-by-step PDF assembly manual generator with exploded views and fastener schedules, and CNC DXF export with LWPOLYLINE entities.',
        tag: 'Export'
      },
      {
        type: 'feature',
        title: 'Instantaneous 6-Language Reactive System',
        description: 'Seamless live switching between Spanish, English, Portuguese, French, Italian, and German across the entire interface without page reloads or WebGL context reset.',
        tag: 'Multilingual'
      },
      {
        type: 'improvement',
        title: 'Unified Hardware & Fastener Computation without Double Charges',
        description: 'Automated calculation of cup hinges, drawer slides, pulls, and assembly screws based on module dimensions and opening mechanics, eliminating quote discrepancies.',
        tag: 'Hardware'
      },
      {
        type: 'fix',
        title: 'Clearance and Back Groove Alignment in Corner and Vanity Units',
        description: 'Standardized 2 mm perimeter clearances on drawer fronts and doors, and corrected 3 mm back panel groove alignment on corner and vanity units.',
        tag: 'Geometry'
      }
    ]
  },
  {
    version: 'v2.5.0',
    name: 'Total Thickness Sync, Custom Sheet Sizes & Pro CAD Interface',
    releaseDate: 'October 23, 2026',
    isCurrent: false,
    summary: 'Major update focused on millimeter precision calculation consistency across 3D viewer, cut list and cut optimizer, plus an ultra-compact interface for laptops.',
    highlights: [
      'Real thickness synchronization (15 mm, 18 mm) across all views and budgets',
      'Parametric cut sheet size configurator with commercial presets',
      'Ultra-compact floating toolbar without overlap on HD screens'
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
        title: 'Top floating toolbar redesign to compact controls',
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
        description: 'Generate parametric 3D countertops adapting automatically to base cabinet footprints.',
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
    name: 'Dimensional Precision & Human Scale',
    releaseDate: 'October 1, 2026',
    isCurrent: false,
    summary: 'Inclusion of millimeter precision tools, dynamic 3D dimensioning and ergonomic visual reference.',
    highlights: [
      'Dynamic 3D measurement between parts, edges and centers',
      'Guided dimensional adjustment across orthogonal X, Y, Z axes',
      'Human scale figure and spatial orientation compass'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Precision Dimensional Measurement',
        description: 'Accurate point-to-point distance readings in 3D space with dimension display.',
        tag: 'Measurement'
      },
      {
        type: 'feature',
        title: 'Orthogonal Dimensional Adjustment',
        description: 'Direct dimension adjustment along orthogonal axes for panels and modules.',
        tag: 'Geometry'
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
    id: 'custom_glb_import',
    title: 'Custom 3D Model Import in .GLB / .GLTF Format',
    description: 'Drag-and-drop custom 3D models for appliances, range hoods, faucets, and decorative accessories with automatic polygon and texture optimization.',
    status: 'in_progress',
    category: 'Customization & 3D',
    targetTimeline: 'Q1 2027',
    badge: 'Active Development',
    progressPercent: 65
  },
  {
    id: 'cloud_quote_link',
    title: 'Shareable Cloud Web Quote Link',
    description: 'Generate secure interactive links allowing end clients to review quotes, material breakdowns, and interactive 3D views from any phone or tablet.',
    status: 'in_progress',
    category: 'Sales & Clients',
    targetTimeline: 'Q1 2027',
    badge: 'In Development',
    progressPercent: 45
  },
  {
    id: 'hardware_brand_templates',
    title: 'Advanced Blum & Hettich Hardware Templates',
    description: 'Parametric integration for lift systems (Aventos HK-S, HF), metal drawer boxes (Legrabox, AvanTech YOU), and concealed undermount slides with exact boring patterns.',
    status: 'planned',
    category: 'Industrial Hardware',
    targetTimeline: 'Q2 2027',
    badge: 'Planned',
    progressPercent: 20
  },
  {
    id: 'gcode_cnc_export',
    title: 'Direct 3-Axis CNC G-Code Postprocessor',
    description: 'Direct generation of standard G-Code files (G0, G1, G2, G3) for groove milling, contour routing, and boring operations on woodworking CNC routers.',
    status: 'evaluating',
    category: 'CNC Integration',
    targetTimeline: 'Technical Evaluation',
    badge: 'Under Study'
  },
  {
    id: 'photorealistic_presentation',
    title: 'Photorealistic Presentation Mode for Clients',
    description: 'High-fidelity commercial visualization with HDRI environmental lighting, high-gloss melamine reflections, and soft contact shadows.',
    status: 'planned',
    category: 'Sales & Clients',
    targetTimeline: 'Q2 2027',
    badge: 'Planned',
    progressPercent: 15
  }
];

export const RELEASES_PT: ReleaseVersion[] = [
  {
    version: 'v3.0.0',
    name: 'Evolução Industrial: Motor Paramétrico Multi-Ambiente, Cotas HD 3D e Exportação Total',
    releaseDate: 'Novembro de 2026',
    isCurrent: true,
    summary: 'Grande salto arquitetônico para o design paramétrico por ambientes, cotas interativas de vão interno em 3D, catálogo massivo de melaminas, orçamento multimoeda em tempo real e exportação industrial para marcenaria.',
    highlights: [
      'Motor paramétrico multi-ambiente em 4 linhas: Cozinhas, Closets, Banheiros (recorte sifão em U) e Estudo/Home Office',
      'Cotas de luz interna HD com trilho vertical anticolisão e edição numérica direta no espaço 3D',
      'Catálogo massivo com mais de 35 melaminas, bancadas de mármore/quartzo, eletrodomésticos 3D e seleção com Shift',
      'Orçamento multimoeda em tempo real (COP canônico para USD, MXN, EUR), ferragens automáticas e desconto de fita de borda',
      'Exportação industrial completa: SketchUp .DAE milimétrico, manuais de montagem PDF estilo IKEA e DXF CNC',
      'Sistema multilíngue instantâneo em 6 idiomas (ES, EN, PT, FR, IT, DE) reativo sem recarregar o WebGL'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Motor Paramétrico Multi-Ambiente em 4 Linhas Especializadas',
        description: 'Módulos inteligentes para Cozinhas Planejadas (balcões, aéreos, cantos a 45° e retos), Closets e Guarda-roupas (prateleiras, gaveteiros e cabideiros), Banheiros (gabinetes flutuantes com recorte paramétrico para sifão em U) e Home Office com 0 colisões.',
        tag: 'Paramétrico'
      },
      {
        type: 'feature',
        title: 'Cotas de Luz Interna HD e Edição Numérica Direta em 3D',
        description: 'Visualização nítida de vãos úteis livres (Luz Superior, Luz Inferior e Largura Interna) com sprites HD. Permite clicar diretamente em qualquer cota no 3D para digitar a medida no teclado, com deslizamento de prateleiras em trilho vertical anticolisão.',
        tag: 'Cotas 3D'
      },
      {
        type: 'feature',
        title: 'Catálogo Massivo de Materiais e Seleção Múltipla com Shift',
        description: 'Mais de 35 padrões de melamina em famílias (madeiras, unicolores foscos, alto brilho e tecidos), bancadas de quartzo/mármore com rodobanca paramétrica e eletrodomésticos 3D. Seleção em lote com a tecla Shift.',
        tag: 'Catálogo & 3D'
      },
      {
        type: 'feature',
        title: 'Orçamento Multimoeda em Tempo Real e Desconto de Fita de Borda',
        description: 'Cálculo de custos dinâmico com base canônica em COP conversível ao vivo para USD, MXN, EUR e outras moedas com taxas de mercado. Opção subtractEdgeBandingFromCut no otimizador de corte para descontar a espessura da borda.',
        tag: 'Orçamento'
      },
      {
        type: 'feature',
        title: 'Exportação Industrial Completa (.DAE, Manuais PDF e DXF CNC)',
        description: 'Exportador 3D COLLADA 1.4.1 (.DAE) milimétrico para SketchUp com hierarquia de peças, gerador de manuais de montagem passo a passo estilo IKEA em PDF com lista de ferragens, e exportação DXF com entidades LWPOLYLINE.',
        tag: 'Exportação'
      },
      {
        type: 'feature',
        title: 'Sistema Multilíngue Instantâneo em 6 Idiomas',
        description: 'Alternância fluida entre Espanhol, Inglês, Português, Francês, Italiano e Alemão em toda a interface sem recarregar a página nem reiniciar o visor 3D.',
        tag: 'Multilíngue'
      },
      {
        type: 'improvement',
        title: 'Cálculo Unificado de Ferragens e Fixações sem Duplicidade',
        description: 'Cálculo automatizado de dobradiças, corrediças, puxadores e parafusos de acordo com a cinemática do módulo, eliminando inconsistências no orçamento.',
        tag: 'Ferragens'
      },
      {
        type: 'fix',
        title: 'Otimização de Folgas e Rasgo de Fundo em Módulos Especiais',
        description: 'Ajuste de folgas perimetrais de 2 mm nas frentes de gaveta e alinhamento do canal de fundo de 3 mm em cantoneiras e gabinetes de banheiro.',
        tag: 'Geometria'
      }
    ]
  },
  {
    version: 'v2.5.0',
    name: 'Sincronização Total de Espessuras, Chapas Sob Medida e Interface CAD Pro',
    releaseDate: '23 de Outubro de 2026',
    isCurrent: false,
    summary: 'Grande atualização focada na consistência de cálculo milimétrico entre o visualizador 3D, plano de corte e otimizador, além de interface ultracompacta para notebooks.',
    highlights: [
      'Sincronização de espessuras reais (15 mm, 18 mm) em todas as vistas e orçamentos',
      'Configurador paramétrico de tamanho de chapa com predefinições comerciais',
      'Barra flutuante de edição ultracompacta sem sobreposição em telas HD'
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
        title: 'Redesenho da barra superior para controles compactos',
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
    name: 'Precisão Dimensional & Escala Humana',
    releaseDate: '1 de Outubro de 2026',
    isCurrent: false,
    summary: 'Inclusão de ferramentas de precisão milimétrica, medição paramétrica tridimensional e referência visual ergonômica.',
    highlights: [
      'Medição tridimensional dinâmica entre peças, arestas e centros',
      'Ajuste dimensional guiado nos eixos ortogonais X, Y, Z',
      'Figura de escala humana e bússola de orientação espacial'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Medição Dimensional de Precisão',
        description: 'Leitura de distâncias precisas ponto a ponto no espaço tridimensional com visualização de cotas.',
        tag: 'Medição'
      },
      {
        type: 'feature',
        title: 'Ajuste Dimensional Ortogonal',
        description: 'Ajuste direto de dimensões nos eixos ortogonais para painéis e módulos.',
        tag: 'Geometria'
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
    id: 'custom_glb_import',
    title: 'Importação de Modelos 3D Personalizados em Formato .GLB / .GLTF',
    description: 'Capacidade de arrastar e soltar modelos 3D personalizados de eletrodomésticos, coifas, torneiras ou acessórios com otimização automática de polígonos.',
    status: 'in_progress',
    category: 'Personalização & 3D',
    targetTimeline: 'Q1 2027',
    badge: 'Em Desenvolvimento Ativo',
    progressPercent: 65
  },
  {
    id: 'cloud_quote_link',
    title: 'Orçamento Compartilhável por Link Web Público na Nuvem',
    description: 'Geração de links interativos seguros para os clientes finais revisarem o orçamento, materiais e visualização 3D em qualquer smartphone ou tablet.',
    status: 'in_progress',
    category: 'Vendas & Clientes',
    targetTimeline: 'Q1 2027',
    badge: 'Em Desenvolvimento',
    progressPercent: 45
  },
  {
    id: 'hardware_brand_templates',
    title: 'Modelos Avançados de Ferragens Blum e Hettich',
    description: 'Integração paramétrica de sistemas de elevação (Aventos), gavetas metálicas (Legrabox, AvanTech YOU) e corrediças ocultas com furação milimétrica.',
    status: 'planned',
    category: 'Ferragens Industriais',
    targetTimeline: 'Q2 2027',
    badge: 'Planejado',
    progressPercent: 20
  },
  {
    id: 'gcode_cnc_export',
    title: 'Pós-processador Direto de Código G-Code para CNC de 3 Eixos',
    description: 'Geração direta de arquivos G-Code padrão (G0, G1, G2, G3) para fresamento de ranhuras, usinagem perimétrica e furação em roteadores CNC de marcenaria.',
    status: 'evaluating',
    category: 'Integração CNC',
    targetTimeline: 'Avaliação Técnica',
    badge: 'Em Estudo'
  },
  {
    id: 'photorealistic_presentation',
    title: 'Modo de Apresentação Fotorrealista para Clientes',
    description: 'Visualização comercial de alta fidelidade com iluminação HDRI, reflexos em melaminas de alto brilho e sombras suaves.',
    status: 'planned',
    category: 'Vendas & Clientes',
    targetTimeline: 'Q2 2027',
    badge: 'Planejado',
    progressPercent: 15
  }
];

export const RELEASES_FR: ReleaseVersion[] = [
  {
    version: 'v3.0.0',
    name: 'Évolution Industrielle: Moteur Paramétrique Multi-Pièces, Cotes HD 3D et Exportation Complète',
    releaseDate: 'Novembre 2026',
    isCurrent: true,
    summary: 'Avancée architecturale majeure introduisant la conception paramétrique par pièces, le cotage 3D interactif du jeu intérieur, un vaste catalogue de mélaminés, le chiffrage multidevise en direct et l\'exportation industrielle pour l\'agencement.',
    highlights: [
      'Moteur paramétrique multi-pièces en 4 lignes: Cuisines, Dressings, Salles de bain (découpe siphon en U) et Bureau/Séjour',
      'Cotes de lumière interne HD avec rail vertical anti-collision et édition numérique directe dans la vue 3D',
      'Catalogue massif avec plus de 35 mélaminés, plans de travail marbre/quartz, électroménagers 3D et sélection Shift',
      'Devis multidevise en temps réel (base COP vers USD, MXN, EUR), calcul automatique de quincaillerie et déduction de chant',
      'Exportation industrielle complète: SketchUp .DAE millimétrique, manuels de montage PDF style IKEA et DXF CNC',
      'Système multilingue instantané en 6 langues (ES, EN, PT, FR, IT, DE) réactif sans rechargement WebGL'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Moteur Paramétrique Multi-Pièces en 4 Lignes Spécialisées',
        description: 'Conception paramétrique complète pour Cuisines (meubles bas, hauts, d\'angle à 45° et droits), Dressings (tablettes dynamiques, blocs tiroirs et tringles), Salles de bain (meubles vasque avec découpe automatique en U pour siphon) et Bureau sans aucune collision géométrique.',
        tag: 'Paramétrique'
      },
      {
        type: 'feature',
        title: 'Cotes de Lumière Interne HD et Édition Numérique Directe en 3D',
        description: 'Affichage net des dimensions utiles (Lumière Supérieure, Lumière Inférieure et Largeur Interne) avec sprites HD. Cliquez directement sur une cote 3D pour saisir la valeur au clavier, avec déplacement des étagères sur rail vertical anti-collision.',
        tag: 'Cotes 3D'
      },
      {
        type: 'feature',
        title: 'Catalogue Massif de Matériaux et Sélection Multiple avec Shift',
        description: 'Plus de 35 décors mélaminés (bois, unis mats, brillant et textiles), plans de travail en quartz/marbre avec crédence paramétrique et électroménagers 3D. Sélection multiple avec la touche Shift pour modifier les propriétés par lot.',
        tag: 'Catalogue & 3D'
      },
      {
        type: 'feature',
        title: 'Devis Multidevise en Temps Réel et Déduction d\'Épaisseur de Chant',
        description: 'Calcul dynamique avec base canonique COP convertie en temps réel en USD, MXN, EUR avec taux de change en direct. Option subtractEdgeBandingFromCut dans l\'optimiseur de coupe pour déduire l\'épaisseur des bandes de chant.',
        tag: 'Devis'
      },
      {
        type: 'feature',
        title: 'Exportation Industrielle Complète (.DAE, Manuais PDF et DXF CNC)',
        description: 'Exportateur 3D COLLADA 1.4.1 (.DAE) millimétrique pour SketchUp avec hiérarchies claires, générateur de manuels d\'assemblage étape par étape style IKEA en PDF avec quincaillerie détaillée, et fichiers DXF avec entités LWPOLYLINE.',
        tag: 'Exportation'
      },
      {
        type: 'feature',
        title: 'Système Multilingue Instantané en 6 Langues',
        description: 'Changement fluide et instantané entre Espagnol, Anglais, Portugais, Français, Italien et Allemand sur toute l\'interface sans recharger la page ni réinitialiser WebGL.',
        tag: 'Multilingue'
      },
      {
        type: 'improvement',
        title: 'Calcul Unifié de Quincaillerie et Fixations sans Doublons',
        description: 'Comptabilisation automatique des charnières, coulisses, poignées et vis selon les dimensions et ouvertures du meuble, éliminant les doublons de coût.',
        tag: 'Quincaillerie'
      },
      {
        type: 'fix',
        title: 'Ajustement des Jeux et Rainures de Fond pour Meubles Spéciaux',
        description: 'Standardisation des jeux de 2 mm sur façades et tiroirs, et alignement précis des rainures de fond de 3 mm sur les angles et meubles vasque.',
        tag: 'Géométrie'
      }
    ]
  },
  {
    version: 'v2.5.0',
    name: 'Synchronisation Totale des Épaisseurs, Panneaux Sur-Mesure & Interface CAD Pro',
    releaseDate: '23 Octobre 2026',
    isCurrent: false,
    summary: 'Mise à jour majeure axée sur la cohérence de calcul millimétrique entre le visualiseur 3D, la fiche de débit et l\'optimiseur de coupe, plus une interface ultra-compacte.',
    highlights: [
      'Synchronisation des épaisseurs réelles (15 mm, 18 mm) sur toutes les vues et devis',
      'Configurateur paramétrique de dimensions de panneau avec préréglages du commerce',
      'Barre d\'outils flottante ultra-compacte sans chevauchement sur écrans HD'
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
        title: 'Refonte de la barre supérieure en contrôles compacts',
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
    name: 'Précision Dimensionnelle & Échelle Humaine',
    releaseDate: '1 Octobre 2026',
    isCurrent: false,
    summary: 'Intégration d\'outils de précision millimétrique, mesure paramétrique 3D et référence visuelle ergonomique.',
    highlights: [
      'Mesure 3D dynamique entre pièces, arêtes et centres',
      'Ajustement dimensionnel guidé sur les axes orthogonaux X, Y, Z',
      'Silhouette à échelle humaine et boussole d\'orientation spatiale'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Mesure Dimensionnelle de Précision',
        description: 'Relevé de distances précises point à point dans l\'espace 3D avec affichage de cotes.',
        tag: 'Mesure'
      },
      {
        type: 'feature',
        title: 'Ajustement Dimensionnel Orthogonal',
        description: 'Ajustement direct des dimensions sur les axes orthogonaux pour panneaux et modules.',
        tag: 'Géométrie'
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
    id: 'custom_glb_import',
    title: 'Importation de Modèles 3D Personnalisés au Format .GLB / .GLTF',
    description: 'Glisser-déposer des modèles 3D personnalisés d\'appareils électroménagers, hottes, robinetterie et accessoires avec optimisation automatique des polygones.',
    status: 'in_progress',
    category: 'Personnalisation & 3D',
    targetTimeline: 'Q1 2027',
    badge: 'Développement Actif',
    progressPercent: 65
  },
  {
    id: 'cloud_quote_link',
    title: 'Devis Partageable par Lien Web Public dans le Cloud',
    description: 'Génération de liens interactifs sécurisés permettant aux clients d\'examiner le devis, les matériaux et la vue 3D interactive depuis leur smartphone.',
    status: 'in_progress',
    category: 'Ventes & Clients',
    targetTimeline: 'Q1 2027',
    badge: 'En Développement',
    progressPercent: 45
  },
  {
    id: 'hardware_brand_templates',
    title: 'Modèles Avancés de Quincaillerie Blum et Hettich',
    description: 'Intégration paramétrique des systèmes de relevage (Aventos HK-S, HF), tiroirs métalliques (Legrabox, AvanTech YOU) et coulisses invisibles avec perçages exacts.',
    status: 'planned',
    category: 'Quincaillerie Industrielle',
    targetTimeline: 'Q2 2027',
    badge: 'Planifié',
    progressPercent: 20
  },
  {
    id: 'gcode_cnc_export',
    title: 'Post-processeur Direct de Code G-Code pour CNC 3 Axes',
    description: 'Génération directe de fichiers G-Code standard (G0, G1, G2, G3) pour le rainurage, détourage de contours et perçage sur défonceuses CNC bois.',
    status: 'evaluating',
    category: 'Intégration CNC',
    targetTimeline: 'Évaluation Technique',
    badge: 'À l\'Étude'
  },
  {
    id: 'photorealistic_presentation',
    title: 'Mode Présentation Photoréaliste pour Clients',
    description: 'Rendu commercial haute fidélité avec éclairage d\'ambiance HDRI, reflets sur laques brillantes et ombres douces.',
    status: 'planned',
    category: 'Ventas & Clients',
    targetTimeline: 'Q2 2027',
    badge: 'Planifié',
    progressPercent: 15
  }
];

export const RELEASES_IT: ReleaseVersion[] = [
  {
    version: 'v3.0.0',
    name: 'Evoluzione Industriale: Motore Parametrico Multi-Ambiente, Quote HD 3D ed Esportazione Completa',
    releaseDate: 'Novembre 2026',
    isCurrent: true,
    summary: 'Importante svolta architetturale per la progettazione parametrica per ambienti, quote interattive di luce interna in 3D, catalogo completo di nobilitati, preventivazione multivaluta in tempo reale e suite di esportazione industriale.',
    highlights: [
      'Motore parametrico multi-ambiente in 4 linee: Cucine, Armadi, Bagno (scasso sifone a U) e Ufficio/Living',
      'Quote di luce interna HD con binario verticale anti-collisione e modifica numerica diretta nel visualizzatore 3D',
      'Catalogo completo con oltre 35 nobilitati, top in marmo/quarzo, elettrodomestici 3D e selezione multipla con Shift',
      'Preventivo multivaluta in tempo reale (COP canonico verso USD, MXN, EUR), ferramenta automatica e detrazione bordi',
      'Esportazione industriale completa: SketchUp .DAE millimetrico, manuali di montaggio PDF stile IKEA e DXF CNC',
      'Sistema multilingue istantaneo in 6 lingue (ES, EN, PT, FR, IT, DE) reattivo senza ricaricare WebGL'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Motore Parametrico Multi-Ambiente in 4 Linee Specializzate',
        description: 'Progettazione parametrica completa per Cucine Componibili (basi, pensili, angolari a 45° e ciechi), Armadi e Guardaroba (ripiani dinamici, cassettiere e tubi appendiabiti), Arredo Bagno (mobili sospesi con scasso parametrico per sifone a U) e Ufficio senza alcuna collisione.',
        tag: 'Parametrico'
      },
      {
        type: 'feature',
        title: 'Quote di Luce Interna HD e Modifica Numerica Diretta in 3D',
        description: 'Visualizzazione nitida delle luci utili libere (Luce Superiore, Inferiore e Larghezza Interna) con sprite HD ad alta definizione. È possibile fare clic direttamente su qualsiasi quota in 3D per inserire il valore numerico da tastiera, con binario verticale anti-collisione.',
        tag: 'Quote 3D'
      },
      {
        type: 'feature',
        title: 'Catalogo Materiali e Selezione Multipla in Blocco con Shift',
        description: 'Oltre 35 nobilitati commerciali suddivisi in famiglie (essenze legno, tinte unite opache, lucidi e tessuti), top in quarzo e marmo con alzatina parametrica ed elettrodomestici 3D. Selezione multipla con tasto Shift per modificare materiali e parametri in blocco.',
        tag: 'Catalogo & 3D'
      },
      {
        type: 'feature',
        title: 'Preventivo Multivaluta in Tempo Reale e Detrazione Bordatura',
        description: 'Calcolo dinamico con valuta base canonica in COP convertibile in tempo reale in USD, MXN, EUR con tassi di cambio live. Impostazione subtractEdgeBandingFromCut nell\'ottimizzatore 2D per detrarre lo spessore del bordo nelle misure di taglio.',
        tag: 'Preventivo'
      },
      {
        type: 'feature',
        title: 'Esportazione Industriale Completa (.DAE, Manuali PDF e DXF CNC)',
        description: 'Esportatore 3D COLLADA 1.4.1 (.DAE) millimetrico per SketchUp con gerarchie ordinate, generatore di manuali di montaggio passo-passo stile IKEA in PDF con distinta ferramenta e file DXF con entità LWPOLYLINE per CNC.',
        tag: 'Esportazione'
      },
      {
        type: 'feature',
        title: 'Sistema Multilingue Istantaneo in 6 Lingue',
        description: 'Passaggio fluido e reattivo tra Spagnolo, Inglese, Portoghese, Francese, Italiano e Tedesco su tutta l\'interfaccia senza ricaricare la pagina né riavviare il contesto WebGL.',
        tag: 'Multilingue'
      },
      {
        type: 'improvement',
        title: 'Calcolo Unificato di Ferramenta e Fissaggi senza Duplicazioni',
        description: 'Rilevamento automatico di cerniere, guide per cassetti, maniglie e viti di giunzione in base alla cinematica del mobile, eliminando discrepanze di costo.',
        tag: 'Ferramenta'
      },
      {
        type: 'fix',
        title: 'Ottimizzazione Fughe e Scanalature Schienale nei Moduli Speciali',
        description: 'Standardizzazione delle luci perimetrali di 2 mm su ante e cassetti e allineamento preciso delle fresate schienale da 3 mm su basi angolari e vanità.',
        tag: 'Geometria'
      }
    ]
  },
  {
    version: 'v2.5.0',
    name: 'Sincronizzazione Totale Spessori, Pannelli su Misura e Interfaccia CAD Pro',
    releaseDate: '23 Ottobre 2026',
    isCurrent: false,
    summary: 'Aggiornamento principale focalizzato sulla coerenza millimetrica tra visualizzatore 3D, distinta pezzi e ottimizzatore di taglio, oltre a un\'interfaccia ultracompatta per notebook.',
    highlights: [
      'Sincronizzazione spessori reali (15 mm, 18 mm) su tutte le viste e preventivi',
      'Configuratore parametrico dimensioni pannello con misure commerciali',
      'Barra mobile ultracompatta senza sovrapposizioni su schermi HD'
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
        title: 'Riprogettazione della barra superiore con controlli compatti',
        description: 'Larghezza ridotta di oltre il 60%, sostituendo i testi con pulsanti a icone e tooltip interattivi, eliminando sovrapposizioni in HD (1366×768).',
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
    name: 'Precisione Dimensionale & Scala Umana',
    releaseDate: '1 Ottobre 2026',
    isCurrent: false,
    summary: 'Introduzione di strumenti di precisione millimetrica, misurazione parametrica 3D e riferimento visivo ergonomico.',
    highlights: [
      'Misurazione 3D dinamica tra pezzi, spigoli e punti centrali',
      'Regolazione dimensionale guidata sugli assi ortogonali X, Y, Z',
      'Figura in scala umana e bussola di orientamento spaziale'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Misurazione Dimensionale di Precisione',
        description: 'Rilevamento distanze punto a punto nello spazio tridimensionale con visualizzazione quote.',
        tag: 'Misurazione'
      },
      {
        type: 'feature',
        title: 'Regolazione Dimensionale Ortogonale',
        description: 'Regolazione diretta delle dimensioni lungo gli assi ortogonali per pannelli e moduli.',
        tag: 'Geometria'
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
    id: 'custom_glb_import',
    title: 'Importazione di Modelli 3D Personalizzati in Formato .GLB / .GLTF',
    description: 'Funzionalità drag-and-drop per modelli 3D personalizzati di elettrodomestici, cappe, rubinetteria e accessori con ottimizzazione automatica dei poligoni.',
    status: 'in_progress',
    category: 'Personalizzazione & 3D',
    targetTimeline: 'Q1 2027',
    badge: 'In Sviluppo Attivo',
    progressPercent: 65
  },
  {
    id: 'cloud_quote_link',
    title: 'Preventivo Condivisibile tramite Link Web Pubblico in Cloud',
    description: 'Generazione di link interattivi sicuri che consentono ai clienti di consultare preventivo, distinta materiali e vista 3D da smartphone o tablet.',
    status: 'in_progress',
    category: 'Vendite & Clienti',
    targetTimeline: 'Q1 2027',
    badge: 'In Sviluppo',
    progressPercent: 45
  },
  {
    id: 'hardware_brand_templates',
    title: 'Template Avanzati di Ferramenta Blum e Hettich',
    description: 'Integrazione parametrica di sistemi a ribalta (Aventos HK-S, HF), cassetti metallici (Legrabox, AvanTech YOU) e guide a scomparsa con schemi di foratura esatti.',
    status: 'planned',
    category: 'Ferramenta Industriale',
    targetTimeline: 'Q2 2027',
    badge: 'Pianificato',
    progressPercent: 20
  },
  {
    id: 'gcode_cnc_export',
    title: 'Post-processor Diretto di Codice G-Code per CNC a 3 Assi',
    description: 'Generazione diretta di file G-Code standard (G0, G1, G2, G3) per fresatura scanalature, contornatura e forature su centri di lavoro CNC per legno.',
    status: 'evaluating',
    category: 'Integrazione CNC',
    targetTimeline: 'Valutazione Tecnica',
    badge: 'In Valutazione'
  },
  {
    id: 'photorealistic_presentation',
    title: 'Modalità Presentazione Fotorealistica per Clienti',
    description: 'Visualizzazione commerciale ad alta fedeltà con illuminazione ambientale HDRI, riflessi su nobilitati lucidi e ombre di contatto morbide.',
    status: 'planned',
    category: 'Vendite & Clienti',
    targetTimeline: 'Q2 2027',
    badge: 'Pianificato',
    progressPercent: 15
  }
];

export const RELEASES_DE: ReleaseVersion[] = [
  {
    version: 'v3.0.0',
    name: 'Industrielle Evolution: Raumübergreifende parametrische Konstruktion, HD-3D-Bemaßung & Voller Export',
    releaseDate: 'November 2026',
    isCurrent: true,
    summary: 'Bedeutender architektonischer Meilenstein für parametrisches Möbeldesign nach Raumbereichen, interaktive HD-Lichtmaß-Bemaßung im 3D-Raum, massiven Melaminkatalog, Live-Multiwährungs-Kalkulation und industrielle Fertigungsexporte.',
    highlights: [
      'Parametrische Konstruktion in 4 Produktlinien: Küchen, Schränke, Bad (U-Siphon-Ausklinkung) und Wohnen/Büro',
      'HD-Lichtmaßbemaßung mit vertikaler Antikollisions-Gleitschiene und direkter numerischer Eingabe im 3D-Viewer',
      'Umfassender Materialkatalog mit über 35 Dekoren, Marmor-/Quarz-Arbeitsplatten, 3D-Geräten und Shift-Mehrfachauswahl',
      'Echtzeit-Multiwährungskalkulation (kanonisches COP in USD, MXN, EUR), automatischer Beschlagsberechnung und Kantenabzug',
      'Vollständiger Industrie-Export: millimetergenaues SketchUp .DAE, IKEA-Stil PDF-Aufbauanleitungen und CNC-DXF',
      'Reaktives 6-Sprachen-System (ES, EN, PT, FR, IT, DE) ohne Neuladen der WebGL-Grafik'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Parametrische Konstruktion in 4 Speziallinien',
        description: 'Vollparametrisches Design mit Modulen für Einbauküchen (Unter-, Ober-, 45°-Eck- und Eckblendschränke), Schränke und Ankleiden (dynamische Fachböden, Schubkästen und Kleiderstangen), Badezimmermöbel (schwebende Waschtische mit parametrischer U-Siphonausklinkung) und Homeoffice ohne geometrische Kollisionen.',
        tag: 'Parametrisch'
      },
      {
        type: 'feature',
        title: 'HD-Lichtmaßbemaßung und direkte numerische Bearbeitung in 3D',
        description: 'Gestochen scharfe Anzeige nutzbarer Innenmaße (Oberes Lichtmaß, Unteres Lichtmaß, Innenbreite) über hochauflösende Billboard-Sprites. Klicken Sie direkt auf eine 3D-Maßzahl zur Tastatureingabe mit vertikaler Fachbodenverstellung und Kollisionsschutz.',
        tag: '3D-Maße'
      },
      {
        type: 'feature',
        title: 'Umfangreicher Dekorkatalog und Shift-Mehrfachauswahl',
        description: 'Über 35 Handelsdekore gegliedert in Holzstrukturen, Mattfarben, Hochglanz und Textil, Quarz- und Marmorarbeitsplatten mit parametrischer Wischleiste sowie Low-Poly-3D-Geräte. Mehrfachauswahl mit Shift für Sammelbearbeitung.',
        tag: 'Katalog & 3D'
      },
      {
        type: 'feature',
        title: 'Echtzeit-Multiwährungskalkulation und Kantenstärkenabzug',
        description: 'Dynamische Preiskalkulation mit COP als Leitwährung und Live-Umrechnung in USD, MXN, EUR anhand aktueller Marktkurse. Option subtractEdgeBandingFromCut im 2D-Zuschnittoptimierer zum Abzug der Kantenstärke vom Zuschnittmaß.',
        tag: 'Kalkulation'
      },
      {
        type: 'feature',
        title: 'Vollständiger Industrie-Export (.DAE, PDF-Anleitungen und DXF CNC)',
        description: 'Millimetergenauer COLLADA 1.4.1 (.DAE) 3D-Export für SketchUp mit Bauteilgruppen, IKEA-Stil PDF-Montageanleitungs-Generator mit Explosionszeichnungen und Beschlagslisten sowie CNC-DXF mit LWPOLYLINE-Geometrien.',
        tag: 'Export'
      },
      {
        type: 'feature',
        title: 'Sofortige 6-Sprachen-Umschaltung',
        description: 'Nahtloser und reaktiver Sprachwechsel zwischen Spanisch, Englisch, Portugiesisch, Französisch, Italienisch und Deutsch ohne Seitenreload oder WebGL-Neustart.',
        tag: 'Mehrsprachigkeit'
      },
      {
        type: 'improvement',
        title: 'Einheitliche Beschlagsberechnung ohne Doppelberechnungen',
        description: 'Automatische Ermittlung von Topfbändern, Schubkastenführungen, Griffen und Verbindungsschrauben passend zur Modulkinematik ohne Berechnungsfehler.',
        tag: 'Beschläge'
      },
      {
        type: 'fix',
        title: 'Optimierung von Fugen und Rückwandnuten bei Sondermöbeln',
        description: 'Standardisierte 2 mm Frontfugen an Schubkästen und Türen sowie präzise Ausrichtung der 3 mm Rückwandnut an Eck- und Waschtischmöbeln.',
        tag: 'Geometrie'
      }
    ]
  },
  {
    version: 'v2.5.0',
    name: 'Vollständige Stärken-Synchronisation, Maßplatten & Pro-CAD-Oberfläche',
    releaseDate: '23. Oktober 2026',
    isCurrent: false,
    summary: 'Großes Update mit Fokus auf millimetergenaue Konsistenz zwischen 3D-Viewer, Stückliste und Zuschnittoptimierer sowie ultrakompakter Oberfläche für Laptops.',
    highlights: [
      'Synchronisation realer Plattenstärken (15 mm, 18 mm) über alle Ansichten und Kalkulationen',
      'Parametrischer Plattenmaß-Konfigurator mit handelsüblichen Standardformaten',
      'Ultrakompakte schwebende Steuerleiste ohne Überlappungen auf HD-Displays'
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
        title: 'Neugestaltung der oberen Leiste mit kompakten Steuerelementen',
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
    name: 'Dimensionale Präzision & Menschlicher Maßstab',
    releaseDate: '1. Oktober 2026',
    isCurrent: false,
    summary: 'Einführung von Millimeter-Präzisionswerkzeugen, dynamischer 3D-Bemaßung und ergonomischer Referenzfigur.',
    highlights: [
      'Dynamische 3D-Abstandsmessung zwischen Bauteilen, Kanten und Mittelpunkten',
      'Geführte Maßanpassung entlang orthogonaler X-, Y-, Z-Achsen',
      'Menschliche Maßstabsfigur und räumlicher Orientierungskompass'
    ],
    changes: [
      {
        type: 'feature',
        title: 'Präzisions-Abstandsmessung',
        description: 'Punkt-zu-Punkt-Abstandsmessung im 3D-Raum mit dynamischer Maßanzeige.',
        tag: 'Messung'
      },
      {
        type: 'feature',
        title: 'Orthogonale Maßanpassung',
        description: 'Direkte Maßanpassung entlang orthogonaler Achsen für Platten und Module.',
        tag: 'Geometrie'
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
    id: 'custom_glb_import',
    title: 'Import benutzerdefinierter 3D-Modelle im .GLB / .GLTF-Format',
    description: 'Drag-and-Drop benutzerdefinierter 3D-Modelle für Elektrogeräte, Dunstabzugshauben, Armaturen und Deko mit automatischer Polygon- und Texturoptimierung.',
    status: 'in_progress',
    category: 'Anpassung & 3D',
    targetTimeline: 'Q1 2027',
    badge: 'In aktiver Entwicklung',
    progressPercent: 65
  },
  {
    id: 'cloud_quote_link',
    title: 'Teilbarer Web-Angebotslink in der Cloud',
    description: 'Erstellung sicherer interaktiver Links, über die Endkunden Angebote, Materialaufstellungen und 3D-Ansichten auf Smartphones oder Tablets einsehen können.',
    status: 'in_progress',
    category: 'Vertrieb & Kunden',
    targetTimeline: 'Q1 2027',
    badge: 'In Entwicklung',
    progressPercent: 45
  },
  {
    id: 'hardware_brand_templates',
    title: 'Erweiterte Beschlagsvorlagen von Blum und Hettich',
    description: 'Parametrische Integration von Klappensystemen (Aventos HK-S, HF), Metall-Schubkastensystemen (Legrabox, AvanTech YOU) und Unterflurführungen mit exakten Bohrbildern.',
    status: 'planned',
    category: 'Industriebeschläge',
    targetTimeline: 'Q2 2027',
    badge: 'Geplant',
    progressPercent: 20
  },
  {
    id: 'gcode_cnc_export',
    title: 'Direkter G-Code-Postprozessor für 3-Achs-CNC-Maschinen',
    description: 'Direkte Erzeugung standardisierter G-Code-Dateien (G0, G1, G2, G3) für Nutfräsungen, Konturschnitte und Bohrungen auf Holz-CNC-Fräsen.',
    status: 'evaluating',
    category: 'CNC-Integration',
    targetTimeline: 'Technische Prüfung',
    badge: 'In Prüfung'
  },
  {
    id: 'photorealistic_presentation',
    title: 'Fotorealistischer Präsentationsmodus für Kunden',
    description: 'Kommerzielle High-End-Visualisierung mit HDRI-Umgebungsbeleuchtung, Reflexionen auf Glanzmelamin und weichen Kontaktschatten.',
    status: 'planned',
    category: 'Vertrieb & Kunden',
    targetTimeline: 'Q2 2027',
    badge: 'Geplant',
    progressPercent: 15
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
