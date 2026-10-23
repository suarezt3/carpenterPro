import { ReleaseVersion, RoadmapItem } from '../models/changelog.models';

export const APP_CURRENT_VERSION = 'v2.5.0';

export const APP_RELEASES: ReleaseVersion[] = [
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

export const APP_ROADMAP: RoadmapItem[] = [
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
