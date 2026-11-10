import { DocCategory, DocArticle } from '../models/documentation.models';
import { AppLanguage } from './i18n-translations.data';

/* ==========================================================================
   CATEGORÍAS DE DOCUMENTACIÓN EN 6 IDIOMAS
   ========================================================================== */

export const DOC_CATEGORIES_ES: DocCategory[] = [
  { id: 'all', label: 'Todas las Guías', icon: 'auto_stories' },
  { id: 'modulos_piezas', label: 'Módulos Paramétricos', icon: 'view_in_ar', badge: '4 Líneas' },
  { id: 'cotas_luz', label: 'Cotas y Luz Interna 3D', icon: 'straighten', badge: 'HD 3D' },
  { id: 'herramientas_3d', label: 'Modelado 3D & Entorno', icon: 'architecture', badge: 'Escena' },
  { id: 'mecanizados', label: 'Mecanizados CNC', icon: 'adjust', badge: 'Auto' },
  { id: 'optimizador', label: 'Presupuesto y Corte 2D', icon: 'precision_manufacturing', badge: 'Ahorro' },
  { id: 'atajos', label: 'Atajos de Teclado', icon: 'keyboard', badge: 'Pro' }
];

export const DOC_CATEGORIES_EN: DocCategory[] = [
  { id: 'all', label: 'All Guides', icon: 'auto_stories' },
  { id: 'modulos_piezas', label: 'Parametric Modules', icon: 'view_in_ar', badge: '4 Lines' },
  { id: 'cotas_luz', label: '3D Dimensions & Clearances', icon: 'straighten', badge: 'HD 3D' },
  { id: 'herramientas_3d', label: '3D Modeling & Scene', icon: 'architecture', badge: 'Scene' },
  { id: 'mecanizados', label: 'CNC Machining', icon: 'adjust', badge: 'Auto' },
  { id: 'optimizador', label: 'Budget & 2D Cutting', icon: 'precision_manufacturing', badge: 'Savings' },
  { id: 'atajos', label: 'Keyboard Shortcuts', icon: 'keyboard', badge: 'Pro' }
];

export const DOC_CATEGORIES_PT: DocCategory[] = [
  { id: 'all', label: 'Todos os Guias', icon: 'auto_stories' },
  { id: 'modulos_piezas', label: 'Módulos Paramétricos', icon: 'view_in_ar', badge: '4 Linhas' },
  { id: 'cotas_luz', label: 'Cotas e Luz Interna 3D', icon: 'straighten', badge: 'HD 3D' },
  { id: 'herramientas_3d', label: 'Modelagem 3D & Cenário', icon: 'architecture', badge: 'Cena' },
  { id: 'mecanizados', label: 'Usinagem CNC', icon: 'adjust', badge: 'Auto' },
  { id: 'optimizador', label: 'Orçamento & Corte 2D', icon: 'precision_manufacturing', badge: 'Economia' },
  { id: 'atajos', label: 'Atalhos de Teclado', icon: 'keyboard', badge: 'Pro' }
];

export const DOC_CATEGORIES_FR: DocCategory[] = [
  { id: 'all', label: 'Tous les Guides', icon: 'auto_stories' },
  { id: 'modulos_piezas', label: 'Modules Paramétriques', icon: 'view_in_ar', badge: '4 Lignes' },
  { id: 'cotas_luz', label: 'Cotes et Espaces Libres 3D', icon: 'straighten', badge: 'HD 3D' },
  { id: 'herramientas_3d', label: 'Modélisation 3D & Scène', icon: 'architecture', badge: 'Scène' },
  { id: 'mecanizados', label: 'Usinage CNC', icon: 'adjust', badge: 'Auto' },
  { id: 'optimizador', label: 'Devis & Débit 2D', icon: 'precision_manufacturing', badge: 'Économie' },
  { id: 'atajos', label: 'Raccourcis Clavier', icon: 'keyboard', badge: 'Pro' }
];

export const DOC_CATEGORIES_IT: DocCategory[] = [
  { id: 'all', label: 'Tutte le Guide', icon: 'auto_stories' },
  { id: 'modulos_piezas', label: 'Moduli Parametrici', icon: 'view_in_ar', badge: '4 Linee' },
  { id: 'cotas_luz', label: 'Quote e Spazi Interni 3D', icon: 'straighten', badge: 'HD 3D' },
  { id: 'herramientas_3d', label: 'Modellazione 3D & Scena', icon: 'architecture', badge: 'Scena' },
  { id: 'mecanizados', label: 'Lavorazioni CNC', icon: 'adjust', badge: 'Auto' },
  { id: 'optimizador', label: 'Preventivo & Taglio 2D', icon: 'precision_manufacturing', badge: 'Risparmio' },
  { id: 'atajos', label: 'Scorciatoie da Tastiera', icon: 'keyboard', badge: 'Pro' }
];

export const DOC_CATEGORIES_DE: DocCategory[] = [
  { id: 'all', label: 'Alle Anleitungen', icon: 'auto_stories' },
  { id: 'modulos_piezas', label: 'Parametrische Module', icon: 'view_in_ar', badge: '4 Linien' },
  { id: 'cotas_luz', label: '3D-Maße & Innenlichte', icon: 'straighten', badge: 'HD 3D' },
  { id: 'herramientas_3d', label: '3D-Modellierung & Raum', icon: 'architecture', badge: 'Szene' },
  { id: 'mecanizados', label: 'CNC-Bearbeitung', icon: 'adjust', badge: 'Auto' },
  { id: 'optimizador', label: 'Kalkulation & 2D-Zuschnitt', icon: 'precision_manufacturing', badge: 'Einsparung' },
  { id: 'atajos', label: 'Tastaturkürzel', icon: 'keyboard', badge: 'Pro' }
];

export const APP_DOC_CATEGORIES_BY_LANG: Record<AppLanguage, DocCategory[]> = {
  es: DOC_CATEGORIES_ES,
  en: DOC_CATEGORIES_EN,
  pt: DOC_CATEGORIES_PT,
  fr: DOC_CATEGORIES_FR,
  it: DOC_CATEGORIES_IT,
  de: DOC_CATEGORIES_DE
};

/* ==========================================================================
   ARTÍCULOS / GUÍAS EN ESPAÑOL (ES)
   ========================================================================== */

export const DOC_ARTICLES_ES: DocArticle[] = [
  // 1. GUÍA 1: Diseño Paramétrico por Ambientes
  {
    id: 'diseno_parametrico_ambientes',
    category: 'modulos_piezas',
    title: 'Diseño Paramétrico por Ambientes (Cocinas, Closets, Baños y Estudio)',
    shortDesc: 'Configura muebles a medida en 4 líneas especializadas con distribución interior inteligente de puertas, cajones, repisas y zócalos sin descuadrar la estructura.',
    icon: 'view_in_ar',
    iconColor: 'text-sky-600',
    badge: 'Motor Paramétrico',
    steps: [
      'En la Zona 1 (Barra Superior), selecciona la línea de ambiente de trabajo: Cocinas, Closets, Baños u Hogar/Estudio.',
      'Haz clic en el botón "+ Módulo" para abrir el Asistente y Catálogo de Plantillas Paramétricas con módulos preconfigurados de la línea (gabinetes bajos, aéreos, esquineros, roperos con barras de colgado, vanities flotantes con sifón o escritorios).',
      'Inserta el mueble seleccionando "Añadir al taller" para componer proyectos completos o "Reemplazar actual".',
      'En el Inspector Contextual (Zona 3 Derecha), ajusta en milímetros el Ancho, Alto, Profundidad y Espesor estructural (15 mm o 18 mm). El mueble recalcula todas sus piezas automáticamente respetando holguras de ensamble.',
      'En la sección "Distribución Interior y Frentes", añade o quita puertas (batientes, dobles o elevables a gas), cajoneras (1 a 4 cajones con correderas telescópicas automáticas), repisas y barras colgadoras.',
      'Configura la base del mueble: Con Zócalo (plinth), Flotante/Aéreo (con Elevación Y configurable) o Al piso.'
    ],
    tips: [
      'Usa el botón "Duplicar al Lado (+X)" en el inspector para formar baterías de gabinetes o alacenas continuas alineadas a tope sin dejar huecos milimétricos.',
      'Al cambiar el material principal del módulo, todas las piezas asociadas se actualizan a la vez, manteniendo la orientación correcta de la veta de la melamina.'
    ],
    technicalDetails: [
      { label: 'Líneas de Ambiente', value: 'Cocinas, Closets, Baños y Hogar/Estudio' },
      { label: 'Espesores Soportados', value: '15 mm y 18 mm (sincronizados con optimizador)' },
      { label: 'Distribución Interior', value: 'Puertas batientes/elevables, cajones, repisas y percheros' },
      { label: 'Configuración Base', value: 'Zócalo, suspendido/flotante o al piso' }
    ]
  },

  // 2. GUÍA 2: Ajuste de Repisas en Riel Vertical y Edición Directa de "Luz Interna" 3D
  {
    id: 'ajuste_repisas_luz_interna',
    category: 'cotas_luz',
    title: 'Ajuste de Repisas en Riel Vertical y Edición Directa de "Luz Interna" 3D',
    shortDesc: 'Visualización en tiempo real de distancias libres interiores, desplazamiento en riel vertical con protección anti-colisión, auto-centrado y edición por clic directo en la cota 3D.',
    icon: 'straighten',
    iconColor: 'text-emerald-500',
    badge: 'Cotas HD 3D',
    steps: [
      'Haz clic sobre cualquier repisa o entrepaño interior en el visor 3D: se proyectarán instantáneamente las cotas de Luz Superior, Luz Inferior y Ancho Útil en color verde esmeralda con la etiqueta ↕ XXX mm.',
      'Edición Directa en el 3D: Haz clic izquierdo directamente sobre la etiqueta flotante de milímetros en el espacio 3D. Aparecerá un campo numérico: escribe la distancia deseada con el teclado (ej. 250) y presiona [ Enter ]. La repisa se reubicará al instante.',
      'Arrastre en Riel Vertical Anti-Colisión: Mantén presionado el clic sobre la repisa y arrástrala hacia arriba o abajo en el eje Y. El motor confina el movimiento exclusivamente en vertical e impide que la repisa colisione contra el piso, el techo u otros estantes (margen de seguridad anti-colisión minGap = 40 mm).',
      'Ajuste Numérico desde el Inspector Derecho: En el panel inspector, sección "Posición de Repisa (Luz Interna)", ingresa valores exactos en "Luz Inferior" o "Luz Superior".',
      'Auto-Centrado en el Vano: Pulsa el botón "Centrar en el Vano" para equilibrar con precisión simétrica las distancias superior e inferior en un solo paso.'
    ],
    tips: [
      'Si duplicas una repisa con el botón Duplicar, el sistema calcula el vano restante y posiciona la nueva pieza automáticamente centrada sin solaparse con piezas vecinas.',
      'La cota horizontal de Ancho Útil te permite verificar si cajas organizadoras o vajillas caben en el vano sin tener que restar espesores de laterales manualmente.'
    ],
    technicalDetails: [
      { label: 'Movimiento', value: 'Riel vertical anti-colisión con tolerancia de seguridad (40 mm)' },
      { label: 'Edición Directa 3D', value: 'Sprite interactivo Three.js con input numérico instantáneo' },
      { label: 'Cálculo de Luz', value: 'Descuenta espesores de tableros (Luz útil libre real)' },
      { label: 'Auto-Centrado', value: 'Algoritmo simétrico respecto a obstáculos superior e inferior' }
    ]
  },

  // 3. GUÍA 3: Presupuesto Multimoneda en Tiempo Real y Descuento de Tapacanto
  {
    id: 'presupuesto_multimoneda_tapacanto',
    category: 'optimizador',
    title: 'Presupuesto Multimoneda en Tiempo Real y Descuento de Tapacanto',
    shortDesc: 'Cotización comercial automática con tasa de cambio de divisas en vivo (COP base a USD, MXN, EUR), cómputo reactivo de herrajes y descuento de espesor de tapacanto en el optimizador 2D.',
    icon: 'tag',
    iconColor: 'text-amber-500',
    badge: 'Finanzas & Corte',
    steps: [
      'Dirígete a la pestaña "4. Presupuesto" en la barra de navegación superior.',
      'Selector Multimoneda en Vivo: Selecciona la divisa en la que deseas cotizar (COP base, USD, MXN, EUR). El sistema consulta APIs de divisas en vivo y convierte los costos unitarios y totales con formateo monetario regional.',
      'Desglose de Costos de Fabricación: Consulta el número de tableros enteros consumidos según el cálculo del optimizador 2D, los metros lineales de tapacanto delgado (0.45 mm) y grueso (2.0 mm), y el listado de herrajes (tornillos, bisagras, correderas sin doble cobro).',
      'Ingresa el porcentaje de mano de obra del taller, margen de ganancia e impuestos para obtener el precio total de venta para el cliente final.',
      'Descuento de Tapacanto en Corte (subtractEdgeBandingFromCut): En la pestaña "2. Despiece" o "3. Optimizador 2D", activa la casilla "Descontar Tapacanto en Corte".',
      'Al estar activo, la sierra descuenta 0.45 mm o 2.0 mm en los bordes marcados (L1, L2, A1, A2) de cada tablero, garantizando que tras el pegado del canto en el taller la pieza final mida exactamente la cota nominal requerida.'
    ],
    tips: [
      'El descuento de tapacanto es indispensable cuando se utiliza canto rígido de PVC de 2 mm en frentes de cajón o puertas, evitando que rocen con los laterales por exceso de medida.',
      'Puedes exportar el presupuesto detallado en PDF profesional para entregarlo como cotización formal a tus clientes.'
    ],
    technicalDetails: [
      { label: 'Divisas Soportadas', value: 'Moneda base COP convertible a USD, MXN, EUR con tasa en tiempo real' },
      { label: 'Descuento Tapacanto', value: '0.45 mm (canto flexible) y 2.0 mm (canto rígido PVC) en L1/L2/A1/A2' },
      { label: 'Cálculo de Herrajes', value: 'Tornillos, espigas, bisagras y correderas computados por ensamble' },
      { label: 'Tableros Requeridos', value: 'Vinculación directa con el algoritmo Guillotina 2D' }
    ]
  },

  // 4. GUÍA 4: Exportación de Modelo 3D (.DAE), Planos PDF y Guía de Armado RTA
  {
    id: 'exportacion_dae_pdf_armado',
    category: 'optimizador',
    title: 'Exportación de Modelo 3D (.DAE), Planos PDF y Guía de Armado RTA',
    shortDesc: 'Genera entregables industriales listos para taller y cliente: modelo 3D COLLADA .DAE milimétrico universal, planos 2D acotados en PDF y manual interactivo de armado paso a paso RTA.',
    icon: 'download',
    iconColor: 'text-sky-500',
    badge: 'Fabricación Industrial',
    steps: [
      'Exportación de Modelo 3D (.DAE): En la cabecera superior, haz clic en el menú "Exportar" y selecciona "Exportar Modelo 3D (.DAE)". El sistema compila un archivo COLLADA 1.4.1 a escala milimétrica (1 unidad = 1 mm), con jerarquía de piezas agrupadas por módulo en capas limpias y conversión al eje vertical Z_UP estándar.',
      'Planos 2D Técnicos en PDF: En el menú Exportar o en la vista de Despiece, pulsa "Plano 2D Técnico (PDF)". Se descargará una ficha técnica de taller con el despiece completo, representación de caras con perforaciones de mecanizados y cotas de cantos para taladrar en banco.',
      'Planos de Corte 2D de Tableros: En la pestaña "3. Optimizador 2D", pulsa "Exportar Planos de Corte" para imprimir el diagrama de corte de guillotina con numeración correlativa de piezas, kerf de sierra y etiquetas adhesivas con código de barras.',
      'Guía de Armado RTA Paso a Paso: Pulsa el botón "Guía de Armado" en la cabecera para abrir el asistente de montaje paso a paso. Visualiza el ensamble isométrico etapa por etapa de cada módulo, con listado de tornillería y herrajes requeridos por paso para el instalador o cliente.'
    ],
    tips: [
      'El archivo .DAE exportado conserva las texturas de melamina y la geometría agrupada lista para visualización y renderizado sin requerir extensiones intermedias.',
      'La Guía de Armado RTA puede imprimirse o compartirse para agilizar el montaje en obra sin errores de orientación de piezas.'
    ],
    technicalDetails: [
      { label: 'Formato 3D', value: 'COLLADA 1.4.1 (.DAE) universal con coordenadas milimétricas' },
      { label: 'Escala Exportación', value: 'Milimétrica 1:1 con nombres sanitizados para jerarquías 3D' },
      { label: 'Documentos PDF', value: 'Fichas técnicas acotadas, diagramas de corte 2D y etiquetas' },
      { label: 'Manual RTA', value: 'Pasos isométricos 2D con cómputo desglosado de herrajes' }
    ]
  },

  // 5. Escala Humana 1.72m y Brújula Cardinal (+Z)
  {
    id: 'escala_humana_brujula',
    category: 'herramientas_3d',
    title: 'Guía de Escala Humana 1.72 m y Brújula Cardinal (+Z)',
    shortDesc: 'Maniquí arquitectónico a escala real (1720 mm) con regla ergonómica vertical y badges cardinales en el piso para verificar alturas de trabajo.',
    icon: 'human',
    iconColor: 'text-sky-500',
    badge: 'Ergonomía CAD',
    steps: [
      'En el visor 3D observarás el maniquí arquitectónico estilizado a escala humana real (1720 mm / 1.72 m de estatura) ubicado sobre el suelo del taller.',
      'La figura incluye una regla milimétrica vertical que marca alturas antropométricas clave: zócalo (100 mm), mesada de cocina (900 mm), antepecho (1450 mm) y alcance visual (1600-1720 mm).',
      'En el suelo, el marco perimetral del taller delimita los 5000 × 5000 mm con indicadores de alta visibilidad: destacando en azul "▲ FRENTE (+Z) · VISTA PRINCIPAL", y en gris "▼ ATRÁS (-Z)", "► IZQUIERDA (-X)" y "◄ DERECHA (+X)".',
      'Para mover el maniquí de lugar: haz clic sobre su base circular o cuerpo en el 3D y arrástralo suavemente con el ratón hacia donde quieras comparar proporciones ergonómicas con tu mueble.',
      'Para ocultar o mostrar la guía humana y la brújula en cualquier momento, pulsa el botón del icono de figura humana en la barra de herramientas o el atajo de teclado [ G ].'
    ],
    tips: [
      'Usa la escala humana al diseñar alacenas de cocina: podrás comprobar a simple vista si el usuario final alcanzará las repisas superiores sin necesidad de escalones.',
      'El badge "FRENTE (+Z)" te asegura que nunca diseñarás un mueble con las puertas hacia atrás o con las correderas al revés.',
      'La figura no se incluye en el despiece de corte ni en la exportación CNC; es exclusivamente una referencia visual de modelado.'
    ],
    technicalDetails: [
      { label: 'Estatura estándar', value: '1720 mm (1.72 m) proporción ergonómica' },
      { label: 'Marcadores de piso', value: 'FRENTE (+Z), ATRÁS (-Z), IZQ (-X), DER (+X)' },
      { label: 'Interacción', value: 'Arrastre libre en plano XZ del suelo con el ratón' },
      { label: 'Visibilidad', value: 'Conmutable con botón o atajo de teclado [ G ]' }
    ]
  },

  // 6. Congelar / Fijar Piezas y Módulos
  {
    id: 'bloqueo_congelar_piezas',
    category: 'herramientas_3d',
    title: 'Congelar / Fijar Piezas y Módulos',
    shortDesc: 'Bloquea piezas individuales o conjuntos completos contra desplazamientos accidentales, modificaciones o borrados involuntarios.',
    icon: 'lock',
    iconColor: 'text-amber-500',
    badge: 'Protección de Diseño',
    steps: [
      'Selecciona la pieza o conjunto que deseas proteger en el visor 3D.',
      'Puedes congelar el elemento de dos formas rápidas:',
      '• Desde el Menú Contextual (Clic Derecho): Haz clic derecho sobre la pieza y selecciona "Congelar Solo Esta Pieza" o "Congelar Módulo Completo / Cajón Completo".',
      '• Desde la Cinta Contextual Superior: Pulsa el botón con icono de candado.',
      'Una vez congelada, la pieza mostrará un distintivo ámbar con indicador [ Fijo ].',
      'La pieza o grupo congelado queda 100% blindado: no podrá ser movido por arrastre de ratón ni eliminado con la tecla Supr.',
      'Para descongelar y volver a editar, haz clic derecho sobre el elemento y selecciona "Descongelar", o vuelve a pulsar el icono de candado en la barra superior.'
    ],
    tips: [
      'Congela los laterales y la base de tu mueble una vez definidas sus dimensiones principales; así podrás mover y ajustar repisas internas o cajones sin mover la estructura exterior.',
      'Si congelas un cajón completo, tanto el frente, los costados, la trasera, el fondo y las correderas quedarán protegidos en un solo clic.',
      'Las piezas congeladas siguen apareciendo normalmente en el despiece de corte y presupuesto.'
    ],
    technicalDetails: [
      { label: 'Alcance', value: 'Pieza individual (part.isLocked) o Grupo (group.isLocked)' },
      { label: 'Efecto', value: 'Inhabilita traslación, arrastre, rotación y borrado' },
      { label: 'Identificador', value: 'Indicador visual ámbar con icono en 3D y listas' },
      { label: 'Persistencia', value: 'Se guarda en la nube y archivo JSON de proyecto' }
    ]
  },

  // 7. Menú Contextual Inteligente de Clic Derecho
  {
    id: 'menu_contextual_inteligente',
    category: 'herramientas_3d',
    title: 'Menú Contextual Inteligente de Clic Derecho',
    shortDesc: 'Menú contextual 3D adaptativo que cambia sus opciones dinámicamente según hagas clic en un Cajón, Puerta, Estructura o en el Espacio Vacío.',
    icon: 'mouse',
    iconColor: 'text-sky-600',
    badge: 'Productividad 3D',
    steps: [
      'Haz clic con el botón derecho del ratón en cualquier punto del visor 3D.',
      'El menú detecta automáticamente qué elemento se encuentra bajo el cursor y te ofrece acciones específicas:',
      '• Clic en un Cajón: Acceso inmediato para probar apertura/cierre de correderas, congelar el cajón completo, duplicarlo, editar su manija o separar frente.',
      '• Clic en una Puerta: Alternar bisagra reversible (Izquierda / Derecha), abrir/cerrar puerta batiente, cambiar modelo de tirador o bloquear.',
      '• Clic en Pieza de Estructura: Rotar 90°, cambiar orientación (Horizontal / Vertical), duplicar, congelar o eliminar pieza.',
      '• Clic en Suelo o Espacio Vacío: Opciones rápidas para añadir un tablero libre, alternar la guía de escala humana, centrar cámara o restablecer vista.',
      'Para cerrar el menú contextual, simplemente haz clic izquierdo en cualquier parte del lienzo o presiona [ Esc ].'
    ],
    tips: [
      'El menú contextual elimina la necesidad de buscar opciones en paneles laterales: tienes las acciones más frecuentes a la distancia de un solo clic.',
      'Si tienes seleccionadas varias piezas con Shift+Clic, el menú contextual te ofrecerá opciones aplicables a la selección múltiple (ej. Agrupar o Congelar Selección).'
    ],
    technicalDetails: [
      { label: 'Detección Raycaster', value: 'Análisis de colisión 3D en coordenadas exactas del cursor' },
      { label: 'Modos contextuales', value: 'Cajón, Puerta, Pieza estructural y Espacio vacío' },
      { label: 'Animaciones', value: 'Apertura de bisagras y extracción de correderas directa' }
    ]
  },

  // 8. Habitación 3D y Equipos
  {
    id: 'habitacion_equipos_3d',
    category: 'herramientas_3d',
    title: 'Habitación 3D y Equipos',
    shortDesc: 'Ambiente realista de taller o habitación con muros y piso personalizables, e inserción de electrodomésticos normalizados en el inspector de 3 zonas.',
    icon: 'room',
    iconColor: 'text-emerald-500',
    badge: 'Visualización y Escena',
    steps: [
      'En la Zona 1 (Barra Superior), activa el Modo Habitación para proyectar paredes perimetrales y piso arquitectónico con texturas y dimensiones ajustables.',
      'Haz clic en el botón "+ Equipo 3D" en la barra superior o navega a la pestaña "Equipos" en el Inspector Contextual Derecho (Zona 3).',
      'Explora el catálogo de electrodomésticos comerciales normalizados: refrigeradores simples o Side-by-Side, hornos empotrables, microondas, campanas extractoras, fregaderos de cocina de acero inoxidable y lavavajillas.',
      'Inserta el equipo deseado en el taller 3D y arrástralo directamente a la posición de encastre del mueble.',
      'En el Inspector Derecho ajusta elevación Y, rotación y verifica que los nichos y holguras de ventilación cumplan con las especificaciones del fabricante.',
      'Usa el botón de bloqueo para fijar la posición del electrodoméstico una vez encajado en su alacena o módulo bajo.'
    ],
    tips: [
      'Al diseñar un mueble bajo fregadero, coloca el fregadero 3D sobre la cubierta para calcular el rebaje de la mesada y asegurar que las divisiones internas no interfieran con la grifería.',
      'Los electrodomésticos normalizados son elementos de referencia visual que no generan piezas de melamina en el despiece de corte 2D.'
    ],
    technicalDetails: [
      { label: 'Catálogo de Equipos', value: 'Refrigerador, Horno, Microondas, Fregadero, Campana, Lavavajillas' },
      { label: 'Paredes y Suelo', value: 'Dimensiones milimétricas y texturas cerámicas/madera' },
      { label: 'Tolerancias', value: 'Comprobación visual de nichos de encastre y ventilación' },
      { label: 'Integración', value: 'Posicionamiento en 3 zonas e inspector contextual' }
    ]
  },

  // 9. Movimiento por Arrastre Directo 3D y Riel Vertical
  {
    id: 'movimiento_directo_3d',
    category: 'herramientas_3d',
    title: 'Movimiento por Arrastre Directo 3D y Riel Vertical',
    shortDesc: 'Mueve piezas individuales o módulos haciendo clic sostenido sobre cualquier superficie, con restricción inteligente de plano y riel vertical anti-colisión.',
    icon: 'pan_tool',
    iconColor: 'text-sky-600',
    badge: 'Interacción Natural',
    steps: [
      'Haz clic con el botón izquierdo sobre cualquier pieza o módulo en el visor 3D.',
      'El cursor cambiará a un indicador de agarre ("grab") al posar sobre el elemento, y a mano cerrada ("grabbing") al hacer clic sostenido.',
      'Arrastra suavemente con el ratón: el motor confina el desplazamiento al plano coplanar de la pieza o sobre riel vertical si se trata de entrepaños internos.',
      'Si la pieza pertenece a un módulo (ej. un cajón con frente, costados, fondo y correderas), todas las piezas se desplazan unificadas y sincronizadas.',
      'Para ajustes finos de precisión, usa las teclas de flecha del teclado (1 mm por pulsación, o 10 mm manteniendo presionada la tecla Shift).',
      'Para redimensionar una pieza seleccionada, recurre a los tiradores interactivos cúbicos perimetrales o al Inspector Contextual Derecho.'
    ],
    tips: [
      'Para elevar o descender rápidamente una pieza en el eje vertical (Y), utiliza las teclas [ W ] (subir +10 mm) y [ S ] (bajar -10 mm).',
      'Si deseas deshacer un movimiento accidental, presiona [ Ctrl + Z ] de forma inmediata.'
    ],
    technicalDetails: [
      { label: 'Método de arrastre', value: 'Clic sostenido directo sobre la malla con proyección en plano CAD' },
      { label: 'Movimiento modular', value: 'Sincronización por ID de módulo o grupo' },
      { label: 'Micro-Ajuste', value: 'Paso fino de 1 mm / 10 mm con flechas del teclado' },
      { label: 'Deshacer / Rehacer', value: 'Pila completa de historial con [ Ctrl + Z ] / [ Ctrl + Y ]' }
    ]
  },

  // 10. Cinta Contextual de Acciones y Barra Superior
  {
    id: 'cinta_acciones_flotante',
    category: 'herramientas_3d',
    title: 'Cinta Contextual de Acciones y Barra Superior',
    shortDesc: 'Menú contextual flotante para duplicar, rotar 90°, cambiar orientación, congelar y gestionar acabados al instante.',
    icon: 'dashboard_customize',
    iconColor: 'text-emerald-600',
    badge: 'Barra Superior',
    steps: [
      'Al seleccionar cualquier pieza o módulo en el visor 3D, emerge automáticamente la cinta flotante contextual en la parte superior del visor.',
      'La cinta muestra un badge con la cantidad de piezas seleccionadas y los botones de acción rápida:',
      '• "Duplicar": Clona el elemento a un costado conservando mecanizados y herrajes asociados.',
      '• "Rotar 90° [ R ]": Gira 90 grados el elemento o selección alrededor del centro común.',
      '• "Congelar": Bloquea o desbloquea la selección contra desplazamientos accidentales.',
      '• "Mover": Conmuta a la herramienta de traslación rápida.',
      '• "Paleta de Melamina": Abre el selector rápido de acabados para aplicarlo en lote a todas las piezas seleccionadas.',
      '• "Eliminar [ Supr ]": Borra la selección activa del diseño.',
      'En la esquina superior izquierda se ubica la tarjeta con el nombre de la pieza y sus dimensiones (L × A × E).'
    ],
    tips: [
      'La cinta contextual respeta los márgenes visuales y solo aparece cuando existe una selección activa, manteniendo el visor limpio durante la órbita de cámara.',
      'Puedes presionar la tecla [ R ] en cualquier momento para rotar 90° la selección activa sin necesidad de hacer clic en el botón.'
    ],
    technicalDetails: [
      { label: 'Visibilidad', value: 'Contextual reactiva (se muestra únicamente con selección activa)' },
      { label: 'Operaciones de Lote', value: 'Duplicar, Rotar 90°, Congelar, Mover, Textura y Eliminar' },
      { label: 'Atajo de Rotación', value: 'Tecla [ R ] o [ Q ]' },
      { label: 'Atajo de Eliminación', value: 'Tecla [ Supr ] o [ Delete ]' }
    ]
  },

  // 11. Selección Múltiple con Shift y Edición en Bloque
  {
    id: 'seleccion_multiple_shift',
    category: 'modulos_piezas',
    title: 'Selección Múltiple con Shift y Edición en Bloque',
    shortDesc: 'Captura múltiples muebles y piezas mediante caja de selección o Shift + Clic para rotar, mover, duplicar y aplicar melaminas en bloque.',
    icon: 'format_shapes',
    iconColor: 'text-sky-600',
    badge: 'Edición en Lote',
    steps: [
      'Ventana de Selección Múltiple: Mantén presionada la tecla [ Shift ] y arrastra el ratón con clic izquierdo sobre el lienzo 3D. Se dibujará una caja de selección traslúcida que atrapará todas las piezas y muebles que toque o contenga, sin rotar la cámara.',
      'Selección Aditiva con Clic: Mantén [ Shift ] presionado y haz clic sobre piezas o módulos individuales para añadirlos o quitarlos de la selección activa.',
      'Cinta Flotante Contextual: Observa el badge que indica el número total de piezas seleccionadas (ej. "8 piezas seleccionadas").',
      'Rotación en Bloque: Pulsa la tecla [ R ] para girar 90 grados todas las piezas y módulos seleccionados alrededor de su centroide común sin desarmar su distribución relativa.',
      'Aplicación de Acabado en Lote: Abre la paleta de materiales desde la cinta flotante o el Inspector Derecho para cambiar el color o textura de melamina de todas las piezas seleccionadas simultáneamente.',
      'Para deseleccionar todo, haz clic en el suelo vacío del taller 3D o presiona la tecla [ Esc ].'
    ],
    tips: [
      'Al seleccionar múltiples módulos completos, las cotas individuales de dimensión se ocultan automáticamente en el 3D para evitar saturación visual, habilitando las acciones grupales.',
      'Puedes duplicar una batería entera de muebles seleccionados con Shift para crear filas continuas de gabinetes en segundos.'
    ],
    technicalDetails: [
      { label: 'Ventana de Selección', value: 'Shift + Arrastre de ratón (inmoviliza órbita de cámara)' },
      { label: 'Selección Aditiva', value: 'Shift + Clic en pieza o módulo' },
      { label: 'Rotación Colectiva', value: 'Cálculo de centroide común para giro simétrico 90°' },
      { label: 'Edición en Bloque', value: 'Materiales, texturas, duplicación y congelamiento' }
    ]
  },

  // 12. Cortes Especiales, Chaflanes y Destaje Sifón en U
  {
    id: 'cortes_especiales_sifon',
    category: 'modulos_piezas',
    title: 'Cortes Especiales, Chaflanes y Destaje Sifón en U',
    shortDesc: 'Mecanizados avanzados para mesones y vanities: destajes en L para columnas, chaflanes a 45°, cortes diagonales y destaje sifón en U paramétrico.',
    icon: 'scissors',
    iconColor: 'text-amber-600',
    badge: 'Mecanizado Especial',
    steps: [
      'Selecciona la cubierta, mesón o repisa que deseas mecanizar en el visor 3D.',
      'En el Inspector Contextual Derecho (Zona 3), navega a la sección "Cortes Especiales y Esquinas" y "Destaje Sifón en U".',
      'Configura el tipo de corte especial según el requerimiento arquitectónico:',
      '• Recto o Rebaje: Retranqueos de longitud para encajar mesadas entre muros descuadrados.',
      '• Chaflán a 45°: Esquinas biseladas de seguridad para mesones de cocina o barras de paso.',
      '• Diagonal: Remates angulados para módulos terminales en esquinas o pasillos estrechos.',
      '• Destaje en L (Columna): Vaciado rectangular en esquinas posteriores para salvar columnas o mochetas estructurales del muro.',
      'Destaje Sifón en U (Muebles de Baño y Vanities): En muebles bajo lavabo o cajones superiores de baño, activa la opción "Destaje Sifón en U". Ingresa el ancho y profundidad del cajeo central para librar la tubería P-trap del desagüe sin sacrificar el almacenamiento lateral.',
      'Al exportar a DXF CNC o PDF de taller, los cortes especiales se representan con polilíneas continuas LWPOLYLINE acotadas milimétricamente para router CNC o corte con caladora.'
    ],
    tips: [
      'El destaje sifón en U calcula automáticamente las piezas de compensación interior del cajón para sellar los cantos expuestos alrededor de la cañería.',
      'Los chaflanes a 45° en mesones reducen riesgos de accidentes en hogares con niños pequeños.'
    ],
    technicalDetails: [
      { label: 'Tipos de Corte', value: 'Recto, Chaflán 45°, Diagonal, Destaje en L y Sifón en U' },
      { label: 'Aplicación Baños', value: 'Cajeo paramétrico para cañería y desagüe P-trap' },
      { label: 'Exportación DXF', value: 'Polilíneas cerradas LWPOLYLINE en capa mecanizado' },
      { label: 'Planos PDF', value: 'Cotas automáticas de radio, chaflán y vaciado' }
    ]
  },

  // 13. Mecanizados y Perforaciones CNC Automáticas
  {
    id: 'mecanizados_cnc',
    category: 'mecanizados',
    title: 'Mecanizados y Perforaciones CNC Automáticas',
    shortDesc: 'Cómo el motor inteligente calcula tornillos de ensamble, espigas y bisagras analizando automáticamente las uniones de melamina.',
    icon: 'adjust',
    iconColor: 'text-sky-600',
    badge: 'Cálculo Inteligente',
    steps: [
      'El sistema analiza automáticamente todas las superficies de contacto y solapamiento entre piezas contiguas (laterales con base, techo, estantes fijos o divisiones).',
      'Detecta la orientación de la unión (ensamble a tope en ángulo de 90° o frentes de puerta batiente).',
      'Calcula las coordenadas exactas de perforación aplicando estándares profesionales de carpintería:',
      '• Tornillos de ensamble (Cian): Genera taladro pasante de Ø 4 mm en la cara exterior y taladro guía de Ø 3 mm x 30 mm en el canto de la pieza perpendicular, a 50 mm y 100 mm de cada borde.',
      '• Espigas / Tarugos de madera (Ámbar): Genera perforaciones de Ø 8 mm x 15 mm de profundidad en ambas piezas enfrentadas para ensamble oculto sin tornillos exteriores.',
      '• Cazoletas de Bisagras (Púrpura): En puertas batientes calcula automáticamente los huecos de Ø 35 mm x 12.5 mm a 100 mm de los extremos superior e inferior, con distancia de cazoleta al borde K = 4 mm.',
      'Para visualizar los taladros en el visor 3D, activa el botón de mecanizados (ícono de taladro) en la barra de herramientas. Los cilindros 3D se representarán con sus colores identificadores.',
      'Al exportar a DXF CNC, todos estos puntos se exportan en capas vectoriales con sus diámetros y profundidades para centros de mecanizado o routers.'
    ],
    tips: [
      'Los taladros se recalculan automáticamente en tiempo real cada vez que redimensionas una pieza o varias su espesor.',
      'En el panel derecho "Propiedades de la Pieza", puedes consultar la lista detallada de taladros asignados a la pieza seleccionada.',
      'En el plano 2D técnico (PDF), cada cara aparece con sus acotaciones para taladrar con plantilla en taller manual.'
    ],
    technicalDetails: [
      { label: 'Tornillo Ensamble', value: 'Ø 4 mm pasante + Ø 3 mm guía (Color Cian)' },
      { label: 'Espigas de Madera', value: 'Ø 8 mm x 15 mm profundidad (Color Ámbar)' },
      { label: 'Cazoleta Bisagra', value: 'Ø 35 mm x 12.5 mm (Color Púrpura, K = 4 mm)' },
      { label: 'Ubicación bordes', value: 'Distancia estándar 50 mm / 100 mm de aristas' },
      { label: 'Exportación CNC', value: 'Capas DXF CNC + Fichas acotadas PDF' }
    ]
  },

  // 14. Bisagras y Taladros Cazoleta Reversibles
  {
    id: 'bisagras_reversibles',
    category: 'mecanizados',
    title: 'Bisagras y Taladros Cazoleta Ø35mm Reversibles Sincronizados',
    shortDesc: 'Apertura hacia la derecha o izquierda con reubicación automática de perforaciones púrpuras y herrajes 3D.',
    icon: 'door_sliding',
    iconColor: 'text-sky-600',
    badge: 'Bisagras Dinámicas',
    steps: [
      'Al configurar una puerta batiente en el Inspector Contextual o en el menú contextual de clic derecho, selecciona el sentido de apertura deseado: "Puerta (Bisagra Izquierda)" o "Puerta (Bisagra Derecha)".',
      'Al cambiar el sentido, la manija/tirador 3D se traslada al borde opuesto y las bisagras 3D se reubican sobre el lateral correspondiente.',
      'Las perforaciones púrpuras de cazoleta Ø 35 mm x 12.5 mm se recalculan instantáneamente en el borde de apertura (a 22 mm al centro del taladro, K = 4 mm).',
      'Al probar la animación con la opción "Animar / Abrir Pieza" o el botón de puertas en la toolbar, los taladros de cazoleta rotan integrados con la hoja de la puerta.'
    ],
    tips: [
      'Al clonar una puerta batiente izquierda para crear la derecha del mueble, el sistema sincroniza tanto la estética visual 3D como el despiece técnico de mecanizados.',
      'La distancia K = 4 mm es compatible con bisagras rectas, acodadas y superacodadas estándar de mercado (Blum, Grass, Hettich, Ducasse).'
    ],
    technicalDetails: [
      { label: 'Estándar cazoleta', value: 'Ø 35 mm x 12.5 mm de profundidad' },
      { label: 'Distancia al borde K', value: '4 mm al canto / 22 mm al centro del taladro' },
      { label: 'Sincronización', value: 'Bisagra 3D + Tirador + Taladro cazoleta + Rotación animada' }
    ]
  },

  // 15. Parámetros de Taller, Kerf de Sierra, Tapacantos y Notas
  {
    id: 'parametros_taller_notas',
    category: 'optimizador',
    title: 'Parámetros de Taller, Kerf de Sierra, Tapacantos y Notas',
    shortDesc: 'Configuración milimétrica del corte: espesor de la hoja de sierra (kerf), refilado perimetral, gestión de cantos y cuaderno de notas del proyecto.',
    icon: 'precision_manufacturing',
    iconColor: 'text-sky-600',
    badge: 'Precisión de Fabricación',
    steps: [
      'Antes de enviar a corte, ajusta los parámetros de fabricación en la pestaña del Optimizador o en Ajustes del Proyecto:',
      '• Espesor de Sierra (Kerf): Configura el ancho exacto del disco de corte de tu seccionadora (estándar 3.2 mm a 4.0 mm). El optimizador descontará este material en cada pasada para garantizar que las piezas no queden milímetros más pequeñas.',
      '• Refilado de Fábrica (Trim Margin): Establece el despunte perimetral del tablero (ej. 10 mm por lado) para eliminar bordes golpeados, con humedad o cera del transporte de la placa.',
      '• Tapacantos (Canto Delgado 0.45 mm vs Grueso 2.0 mm): Define qué caras llevan canto (L1, L2, A1, A2). El sistema descuenta el espesor del canto grueso en las medidas de corte para que la pieza terminada mida exactamente lo proyectado.',
      '• Cuaderno de Notas y Checklist: Abre el modal de notas desde la barra superior para registrar instrucciones especiales del cliente, requerimientos de instalación en obra y lista de chequeo.'
    ],
    tips: [
      'Si contratas el servicio de corte en un centro de distribución (ej. Masisa, Arauco, Pelíkano), consulta el kerf de su seccionadora (generalmente 4.0 mm u 4.4 mm) e ingrésalo para obtener planos de corte 100% idénticos.',
      'El cálculo de metros lineales de tapacanto distingue entre canto delgado y grueso para presupuestar rollos con exactitud.'
    ],
    technicalDetails: [
      { label: 'Rango Kerf de sierra', value: '1.0 mm a 6.0 mm (Estándar recomendado: 4.0 mm)' },
      { label: 'Refilado perimetral', value: '0 mm a 30 mm por borde (Estándar: 10 mm)' },
      { label: 'Compensación de cantos', value: 'Descuento automático de canto grueso (2 mm) en lista de corte' },
      { label: 'Cuaderno de notas', value: 'Sincronizado en tiempo real con persistencia en nube' }
    ]
  },

  // 16. Optimización de Corte 2D y Despiece Milimétrico
  {
    id: 'optimizador_despiece',
    category: 'optimizador',
    title: 'Optimización de Corte 2D, Despiece y Descuento de Tapacanto',
    shortDesc: 'Algoritmo guillotina de máximo aprovechamiento de placas con respeto de veta, refilado, kerf de sierra y descuento de cantos.',
    icon: 'precision_manufacturing',
    iconColor: 'text-sky-600',
    badge: 'Ahorro de Material',
    steps: [
      'Ve a la pestaña "3. Optimizador 2D" en la barra superior.',
      'Configura el tamaño del tablero comercial (ej. 2440 x 1830 mm) y el espesor de la hoja de sierra (Kerf = 4 mm estándar).',
      'Establece el margen de refilado perimetral del tablero (ej. 10 mm) para sanear los bordes de fábrica.',
      'Activa la casilla "Descontar Tapacanto en Corte" si utilizas canto rígido de PVC de 2 mm.',
      'El motor organizará automáticamente los cortes respetando la dirección de la veta longitudinal o transversal de la melamina y minimizando los retazos sobrantes.',
      'Genera el reporte con el porcentaje de aprovechamiento, metros lineales de tapacanto y plano de corte con numeración correlativa de piezas.',
      'Pulsa "Exportar Plano 2D Técnico" para descargar el PDF de taller listo para imprimir.'
    ],
    tips: [
      'Puedes imprimir etiquetas adhesivas para cada pieza con su nombre de módulo, medidas exactas y esquema de bordes con tapacanto.',
      'El algoritmo Guillotine 2D genera patrones de corte seccionables de extremo a extremo aptos para escuadradoras tradicionales y seccionadoras automáticas.'
    ],
    technicalDetails: [
      { label: 'Algoritmo', value: 'Guillotine 2D con respeto estricto de veta (Largo/Ancho)' },
      { label: 'Parámetros', value: 'Kerf de sierra (0-10 mm), Refilado (0-25 mm)' },
      { label: 'Descuento Cantos', value: '0.45 mm y 2.0 mm en bordes configurados' }
    ]
  },

  // 17. Guía Rápida de Atajos de Teclado
  {
    id: 'atajos_teclado',
    category: 'atajos',
    title: 'Guía Rápida de Atajos de Teclado',
    shortDesc: 'Trabaja con máxima agilidad usando atajos directos sin colisiones para seleccionar, rotar, mover, medir y transformar piezas.',
    icon: 'keyboard',
    iconColor: 'text-emerald-600',
    badge: 'Productividad',
    steps: [
      '• [ V ] o [ Barra Espaciadora ]: Herramienta Seleccionar piezas (Shift + Clic para añadir o quitar piezas/módulos)',
      '• [ Shift + Arrastre ]: Ventana de Selección Múltiple. Congela la cámara y encierra varios muebles o piezas para seleccionarlos en bloque',
      '• [ Shift + Clic ]: Añadir o remover piezas de la selección activa',
      '• [ M ]: Herramienta Mover (traslación en espacio 3D para posicionar módulos o piezas)',
      '• [ R ] / [ Q ]: Rotar 90° en bloque la pieza, cajón o todos los módulos seleccionados (alrededor de su centroide común)',
      '• [ T ]: Cinta Métrica 3D con snapping magnético a vértices y aristas',
      '• [ Z ]: Centrar y reiniciar vista de cámara en el taller 3D',
      '• [ W ] / [ S ]: Elevar o descender la pieza seleccionada en el eje vertical Y (+/-10 mm)',
      '• [ Flechas Teclado ]: Desplazamiento milimétrico de la selección en bloque (1 mm o 10 mm con Shift)',
      '• [ G ]: Mostrar u ocultar Guías Espaciales perimetrales y el Maniquí de Escala Humana 1.72 m',
      '• [ H ] / [ Alt + H ]: Ocultar temporalmente selección o mostrar todas las piezas ocultas',
      '• [ Supr / Delete / Backspace ]: Eliminar inmediatamente las piezas o muebles seleccionados',
      '• [ Ctrl + Z ] / [ Cmd + Z ]: Deshacer última acción (Undo)',
      '• [ Ctrl + Y ] / [ Cmd + Shift + Z ]: Rehacer acción deshecha (Redo)',
      '• [ Esc ]: Cancelar herramienta activa, limpiar selección actual o cerrar ventanas emergentes'
    ],
    tips: [
      'Selección Múltiple en Bloque: Mantén presionado [ Shift ] y arrastra el ratón con el botón izquierdo sobre el lienzo 3D. Se dibujará una caja de selección que atrapará todos los módulos que toque o contenga, sin rotar la cámara.',
      'Atajo [ R ] dedicado exclusivamente a ROTAR: al pulsar R con un cajón, módulo o varios muebles seleccionados, girará 90° de inmediato sin alterar la herramienta activa.',
      'La barra espaciadora o la tecla [ V ] te regresan al instante a la herramienta de selección estándar.'
    ],
    technicalDetails: [
      { label: 'Caja Selección 3D', value: 'Shift + Arrastre ratón' },
      { label: 'Añadir a Selección', value: 'Shift + Clic en pieza' },
      { label: 'Rotación 90°', value: 'Tecla [ R ] o [ Q ] (módulo o selección)' },
      { label: 'Herramienta Mover', value: 'Tecla [ M ]' },
      { label: 'Cinta Métrica', value: 'Tecla [ T ]' },
      { label: 'Seleccionar', value: 'Teclas [ V ] o [ Espacio ]' },
      { label: 'Centrar Vista', value: 'Tecla [ Z ]' },
      { label: 'Escala Humana', value: 'Tecla [ G ]' }
    ]
  }
];

/* ==========================================================================
   ARTÍCULOS / GUÍAS EN INGLÉS (EN)
   ========================================================================== */

export const DOC_ARTICLES_EN: DocArticle[] = [
  // 1. GUIDE 1: Parametric Design by Environment
  {
    id: 'diseno_parametrico_ambientes',
    category: 'modulos_piezas',
    title: 'Parametric Design by Environment (Kitchens, Closets, Bathrooms & Office)',
    shortDesc: 'Configure custom cabinetry across 4 specialized lines with intelligent interior distribution of doors, drawers, shelves, and plinths without skewing the structure.',
    icon: 'view_in_ar',
    iconColor: 'text-sky-600',
    badge: 'Parametric Engine',
    steps: [
      'In Zone 1 (Top Bar), select your working environment line: Kitchens, Closets, Bathrooms, or Living/Office.',
      'Click "+ Module" to open the Parametric Wizard & Template Catalog with preconfigured modules (base cabinets, wall units, corner cabinets, wardrobes with hanging rods, floating vanities, or desks).',
      'Insert the cabinet by choosing "Add to workshop" to compose complete suites, or "Replace current".',
      'In the Contextual Inspector (Zone 3 Right), adjust Width, Height, Depth, and Core Thickness (15 mm or 18 mm) in millimeters. All structural parts recalculate automatically respecting assembly clearances.',
      'In the "Interior Distribution & Fronts" section, add or configure doors (swing, double, or gas-lift flap), drawer units (1 to 4 drawers with automatic runners), shelves, and hanging rods.',
      'Configure cabinet base: With Plinth/Toe-kick, Suspended/Floating (with configurable Y-elevation), or Direct to floor.'
    ],
    tips: [
      'Use the "Duplicate to Side (+X)" button in the inspector to create seamless runs of continuous base cabinets without millimeter gaps.',
      'Changing the primary module material updates all associated components simultaneously while maintaining correct grain direction.'
    ],
    technicalDetails: [
      { label: 'Environment Lines', value: 'Kitchens, Closets, Bathrooms, and Living/Office' },
      { label: 'Supported Thickness', value: '15 mm and 18 mm (synchronized with 2D optimizer)' },
      { label: 'Interior Distribution', value: 'Swing/lift doors, drawers, shelves, and clothes rods' },
      { label: 'Base Configuration', value: 'Plinth, suspended/floating, or direct to floor' }
    ]
  },

  // 2. GUIDE 2: Shelf Adjustment on Vertical Rail & Direct 3D Clearance Editing
  {
    id: 'ajuste_repisas_luz_interna',
    category: 'cotas_luz',
    title: 'Shelf Adjustment on Vertical Rail & Direct 3D Internal Clearance Editing',
    shortDesc: 'Real-time readout of interior free clearances, anti-collision vertical rail movement, auto-centering, and direct numerical editing by clicking on 3D dimensions.',
    icon: 'straighten',
    iconColor: 'text-emerald-500',
    badge: 'HD 3D Dimensions',
    steps: [
      'Click on any interior shelf or divider in the 3D viewport: Top Clearance, Bottom Clearance, and Usable Width dimensions project instantly in emerald green with ↕ XXX mm tags.',
      'Direct 3D Dimension Editing: Left-click directly on the floating millimeter label in the 3D space. A numeric input pops up: type the desired clearance (e.g. 250) and press [ Enter ]. The shelf repositions immediately.',
      'Anti-Collision Vertical Rail Dragging: Hold left-click on the shelf and drag it up or down along the Y-axis. The engine restricts motion strictly to vertical and prevents collisions with floor, roof, or neighboring shelves (safety gap = 40 mm).',
      'Numeric Adjustment in Right Inspector: In the inspector panel under "Shelf Position (Internal Clearance)", enter exact values for "Bottom Clearance" or "Top Clearance".',
      'Auto-Centering in Bay: Click "Center in Bay" to balance top and bottom clearances symmetrically in a single click.'
    ],
    tips: [
      'Duplicating a shelf automatically calculates remaining bay height and positions the new piece centered without overlapping neighbors.',
      'The horizontal Usable Width dimension allows instant verification for storage bins or dishware without manual board thickness deductions.'
    ],
    technicalDetails: [
      { label: 'Movement', value: 'Anti-collision vertical rail with safety gap (40 mm)' },
      { label: 'Direct 3D Editing', value: 'Interactive Three.js sprite with instant keyboard numeric input' },
      { label: 'Clearance Math', value: 'Deducts board thicknesses (true net usable interior space)' },
      { label: 'Auto-Centering', value: 'Symmetric algorithm relative to upper and lower obstacles' }
    ]
  },

  // 3. GUIDE 3: Real-Time Multi-Currency Budget & Edge Banding Deduction
  {
    id: 'presupuesto_multimoneda_tapacanto',
    category: 'optimizador',
    title: 'Real-Time Multi-Currency Budget & Edge Banding Deduction in Cutting',
    shortDesc: 'Automated commercial quotation with live currency exchange rates (canonical COP to USD, MXN, EUR), reactive hardware math, and kerf edge banding compensation in the 2D optimizer.',
    icon: 'tag',
    iconColor: 'text-amber-500',
    badge: 'Finance & Cutting',
    steps: [
      'Navigate to tab "4. Budget" in the top navigation bar.',
      'Live Multi-Currency Selector: Select your target currency (COP base, USD, MXN, EUR). The system queries live FX exchange APIs and converts unit and total costs with localized formatting.',
      'Manufacturing Cost Breakdown: Inspect total board sheet consumption calculated by the 2D optimizer, linear meters of thin (0.45 mm) and thick (2.0 mm) edge banding, and complete hardware list (screws, hinges, runners without double counting).',
      'Input workshop labor percentage, profit margin, and sales taxes to calculate client sales price.',
      'Edge Banding Deduction in Cutting (subtractEdgeBandingFromCut): In tab "2. Parts List" or "3. 2D Optimizer", enable "Deduct Edge Banding in Cut".',
      'When enabled, the saw deducts 0.45 mm or 2.0 mm on designated edges (L1, L2, W1, W2) of each board, ensuring the assembled panel matches nominal blueprint dimensions perfectly after edge banding application.'
    ],
    tips: [
      'Edge banding deduction is vital when applying 2 mm rigid PVC edging to drawer fronts and doors, preventing door rubbing caused by oversized parts.',
      'Export comprehensive quotation PDFs formatted with your workshop details to present to customers.'
    ],
    technicalDetails: [
      { label: 'Supported Currencies', value: 'Base COP convertible to USD, MXN, EUR with live exchange rates' },
      { label: 'Edge Deduction', value: '0.45 mm (thin) and 2.0 mm (rigid PVC) on L1/L2/W1/W2' },
      { label: 'Hardware Math', value: 'Screws, dowels, hinges, and runners computed per joint' },
      { label: 'Required Sheets', value: 'Directly linked with the 2D Guillotine optimizer' }
    ]
  },

  // 4. GUIDE 4: 3D Model (.DAE) Export, PDF Blueprints & RTA Assembly Guide
  {
    id: 'exportacion_dae_pdf_armado',
    category: 'optimizador',
    title: '3D Model (.DAE) Export, PDF Blueprints & RTA Assembly Guide',
    shortDesc: 'Produce industrial shop drawings and client deliverables: millimeter-scale universal COLLADA .DAE 3D models, dimensioned 2D PDF blueprints, and step-by-step RTA assembly manuals.',
    icon: 'download',
    iconColor: 'text-sky-500',
    badge: 'Industrial Manufacturing',
    steps: [
      '3D Model (.DAE) Export: In the top header menu, click "Export" and choose "Export 3D Model (.DAE)". The system compiles a clean COLLADA 1.4.1 file at 1:1 millimeter scale, grouped by module in organized hierarchies and converted to standard Z_UP vertical orientation.',
      '2D Technical Blueprints in PDF: In Export menu or Parts List, click "2D Technical Blueprint (PDF)". Download shop-ready drawings with full piece indexing, hole drilling coordinates, and edge banding legends.',
      '2D Sheet Cutting Layouts: In tab "3. 2D Optimizer", click "Export Cut Layouts" to print the guillotine cutting diagram with numbered parts, saw kerf allowances, and barcode label prints.',
      'Step-by-Step RTA Assembly Guide: Click "Assembly Guide" in the header to open the step-by-step assembly manual. Review isometric exploded steps for each module with bill of materials per phase for installers or clients.'
    ],
    tips: [
      'The exported .DAE file retains melamine texture coordinates and grouped geometry ready for 3D visualization and rendering without plugins.',
      'The RTA Assembly Guide can be printed or shared digitally to ensure error-free on-site installation.'
    ],
    technicalDetails: [
      { label: '3D Format', value: 'Universal COLLADA 1.4.1 (.DAE) with millimeter coordinates' },
      { label: 'Export Scale', value: 'Millimeter 1:1 with sanitized entity names for 3D hierarchies' },
      { label: 'PDF Documents', value: 'Dimensioned technical sheets, 2D cutting diagrams, and labels' },
      { label: 'RTA Manual', value: '2D isometric sequence with itemized hardware requirements' }
    ]
  },

  // 5. Human Scale 1.72m & Cardinal Compass (+Z)
  {
    id: 'escala_humana_brujula',
    category: 'herramientas_3d',
    title: '1.72 m Human Scale Guide & Cardinal Compass (+Z)',
    shortDesc: 'True-to-scale architectural mannequin (1720 mm) with vertical ergonomic ruler and floor compass markers to verify ergonomic heights.',
    icon: 'human',
    iconColor: 'text-sky-500',
    badge: 'CAD Ergonomics',
    steps: [
      'In the 3D viewport, locate the stylized human figure standing at true scale (1720 mm / 1.72 m) on the workshop floor.',
      'The figure includes a vertical millimeter scale marking key heights: toe-kick (100 mm), kitchen counter (900 mm), backsplash (1450 mm), and eye level (1600-1720 mm).',
      'On the floor, the 5000 × 5000 mm workshop frame displays high-visibility markers: "▲ FRONT (+Z) · MAIN VIEW" in blue, and "▼ BACK (-Z)", "► LEFT (-X)", "◄ RIGHT (+X)" in gray.',
      'To reposition the mannequin: click on its base or body in 3D and drag it across the floor to evaluate furniture proportions.',
      'Toggle mannequin and floor markers anytime using the human icon in the toolbar or keyboard shortcut [ G ].'
    ],
    tips: [
      'Use the scale guide when designing wall cabinets to verify if top shelves are easily reachable without step stools.',
      'The "FRONT (+Z)" indicator guarantees doors and drawer fronts face the proper direction.',
      'The figure is strictly a visual aid and is omitted from cutting lists, PDF blueprints, and CNC exports.'
    ],
    technicalDetails: [
      { label: 'Standard Height', value: '1720 mm (1.72 m) ergonomic proportion' },
      { label: 'Floor Markers', value: 'FRONT (+Z), BACK (-Z), LEFT (-X), RIGHT (+X)' },
      { label: 'Interaction', value: 'Free planar dragging on the XZ floor plane' },
      { label: 'Visibility', value: 'Toggled via toolbar button or shortcut [ G ]' }
    ]
  },

  // 6. Freeze / Lock Parts & Modules
  {
    id: 'bloqueo_congelar_piezas',
    category: 'herramientas_3d',
    title: 'Freeze / Lock Parts & Modules',
    shortDesc: 'Lock individual boards or complete cabinetry assemblies against accidental movement, modification, or deletion.',
    icon: 'lock',
    iconColor: 'text-amber-500',
    badge: 'Design Protection',
    steps: [
      'Select the part or assembly you wish to protect in the 3D viewport.',
      'Lock elements using either of two methods:',
      '• Context Menu (Right-Click): Right-click the piece and choose "Freeze This Part Only" or "Freeze Entire Module / Drawer".',
      '• Top Contextual Toolbar: Click the lock icon button.',
      'Locked items display an amber indicator [ Locked ].',
      'Locked pieces cannot be moved by mouse dragging or deleted with the Delete key.',
      'To unlock, right-click the item and choose "Unfreeze", or click the lock icon in the top toolbar again.'
    ],
    tips: [
      'Freeze side panels and bottom deck once primary cabinet dimensions are established to freely adjust shelves and dividers.',
      'Freezing an entire drawer locks fronts, sides, back, bottom, and runners in one click.',
      'Locked pieces remain fully included in cut lists and budget computations.'
    ],
    technicalDetails: [
      { label: 'Scope', value: 'Individual part (part.isLocked) or Group (group.isLocked)' },
      { label: 'Effect', value: 'Disables translation, dragging, rotation, and deletion' },
      { label: 'Indicator', value: 'Amber visual badge in 3D and parts tables' },
      { label: 'Persistence', value: 'Stored in cloud database and project JSON export' }
    ]
  },

  // 7. Smart Right-Click Context Menu
  {
    id: 'menu_contextual_inteligente',
    category: 'herramientas_3d',
    title: 'Smart Right-Click Context Menu',
    shortDesc: 'Adaptive 3D context menu that dynamically changes options depending on whether you click a Drawer, Door, Structural Part, or Empty Floor.',
    icon: 'mouse',
    iconColor: 'text-sky-600',
    badge: '3D Productivity',
    steps: [
      'Right-click anywhere inside the 3D viewport canvas.',
      'The menu detects the target mesh under the cursor and displays context-aware actions:',
      '• Click on Drawer: Test runner opening/closing animation, freeze drawer, duplicate, edit handle style, or isolate front.',
      '• Click on Door: Toggle hinge side (Left / Right), swing open/close, change pull model, or lock.',
      '• Click on Structural Part: Rotate 90°, toggle orientation (Horizontal / Vertical), duplicate, freeze, or delete.',
      '• Click on Empty Space: Quickly add a free board, toggle human scale guide, center camera, or reset viewpoint.',
      'To dismiss the menu, left-click anywhere on the canvas or press [ Esc ].'
    ],
    tips: [
      'The context menu keeps common actions a single click away without navigating submenus.',
      'When multiple parts are selected via Shift+Click, the menu offers bulk actions (Group, Freeze Selection).'
    ],
    technicalDetails: [
      { label: 'Raycaster Detection', value: 'Precision 3D collision check at cursor coordinates' },
      { label: 'Context Modes', value: 'Drawer, Door, Structural Part, and Empty Canvas' },
      { label: 'Animations', value: 'Instant hinge swing and drawer slide simulation' }
    ]
  },

  // 8. 3D Room & Equipment
  {
    id: 'habitacion_equipos_3d',
    category: 'herramientas_3d',
    title: '3D Room & Equipment',
    shortDesc: 'Realistic architectural workshop/room scene with customizable walls and floors, plus standardized 3D appliances in the 3-zone inspector.',
    icon: 'room',
    iconColor: 'text-emerald-500',
    badge: 'Scene & Environment',
    steps: [
      'In Zone 1 (Top Bar), toggle Room Mode to project boundary walls and floor with customizable textures and dimensions.',
      'Click "+ 3D Appliance" in the top bar or switch to the "Equipment" tab in the Right Contextual Inspector (Zone 3).',
      'Browse standard appliances: single and side-by-side refrigerators, built-in ovens, microwaves, range hoods, stainless steel sinks, and dishwashers.',
      'Insert appliances into the 3D scene and drag them directly into cabinet niches.',
      'Use the Right Inspector to adjust Y-elevation, orientation, and verify fit tolerances and ventilation gaps.',
      'Click the lock button to fix appliance positions once aligned.'
    ],
    tips: [
      'When designing sink base units, place the 3D sink atop the counter to check cutout spacing and ensure interior dividers clear drainage pipes.',
      'Appliances serve as visual layout references and do not generate sheet cutting parts.'
    ],
    technicalDetails: [
      { label: 'Appliance Catalog', value: 'Refrigerator, Oven, Microwave, Sink, Range Hood, Dishwasher' },
      { label: 'Walls & Floor', value: 'Millimeter bounds and ceramic/wood architectural textures' },
      { label: 'Fit Tolerances', value: 'Visual inspection of niche dimensions and ventilation gaps' },
      { label: 'Integration', value: '3-zone workspace and contextual property inspector' }
    ]
  },

  // 9. 3D Direct Drag Movement & Vertical Rail
  {
    id: 'movimiento_directo_3d',
    category: 'herramientas_3d',
    title: '3D Direct Drag Movement & Vertical Rail',
    shortDesc: 'Move individual parts or modules by clicking and dragging directly on any face, with smart planar constraint and anti-collision vertical rail.',
    icon: 'pan_tool',
    iconColor: 'text-sky-600',
    badge: 'Natural Interaction',
    steps: [
      'Left-click on any part or cabinet in the 3D viewport.',
      'Cursor switches to grab pointer on hover, and closed grabbing hand when clicked.',
      'Drag smoothly: movement is constrained to the part coplanar axis, or along the vertical rail for interior shelves.',
      'Module assemblies (drawers, cabinets) move as a synchronized unit.',
      'Use keyboard arrow keys for fine adjustment (1 mm step, or 10 mm holding Shift).',
      'To resize parts, interact with the cubic boundary gizmo handles or use the Right Contextual Inspector.'
    ],
    tips: [
      'Press [ W ] to elevate (+10 mm) or [ S ] to lower (-10 mm) selected parts along the Y axis.',
      'Press [ Ctrl + Z ] to immediately undo any movement.'
    ],
    technicalDetails: [
      { label: 'Drag Method', value: 'Direct mesh dragging with CAD coplanar raycasting' },
      { label: 'Module Sync', value: 'Grouped by module and assembly hierarchy' },
      { label: 'Micro-Adjust', value: '1 mm / 10 mm step using keyboard arrow keys' },
      { label: 'Undo / Redo', value: 'Full stack history via [ Ctrl + Z ] / [ Ctrl + Y ]' }
    ]
  },

  // 10. Contextual Action Bar & Top Toolbar
  {
    id: 'cinta_acciones_flotante',
    category: 'herramientas_3d',
    title: 'Contextual Action Bar & Top Toolbar',
    shortDesc: 'Floating contextual toolbar to duplicate, rotate 90°, flip orientation, freeze, and assign textures in bulk.',
    icon: 'dashboard_customize',
    iconColor: 'text-emerald-600',
    badge: 'Top Toolbar',
    steps: [
      'Selecting any board or module in the 3D viewport displays the floating action bar at the top of the canvas.',
      'The bar shows selected item count and quick action buttons:',
      '• "Duplicate": Clones items to the side preserving hardware and joinery.',
      '• "Rotate 90° [ R ]": Rotates the active selection 90 degrees around its shared center.',
      '• "Freeze": Toggles locked state against accidental displacement.',
      '• "Move": Activates rapid translation mode.',
      '• "Melamine Palette": Opens quick finish selector to re-skin all selected boards at once.',
      '• "Delete [ Del ]": Deletes selected boards or modules.',
      'The top-left badge displays part name and dimensions (L × W × T).'
    ],
    tips: [
      'The bar only appears when items are selected, keeping the canvas uncluttered during camera orbiting.',
      'Press [ R ] anytime to rotate selection 90° without clicking the button.'
    ],
    technicalDetails: [
      { label: 'Visibility', value: 'Contextual (only active when elements are selected)' },
      { label: 'Batch Operations', value: 'Duplicate, Rotate 90°, Freeze, Move, Materials, Delete' },
      { label: 'Rotation Key', value: '[ R ] or [ Q ] shortcut' },
      { label: 'Delete Key', value: '[ Del ] or [ Backspace ]' }
    ]
  },

  // 11. Shift Multi-Selection & Bulk Editing
  {
    id: 'seleccion_multiple_shift',
    category: 'modulos_piezas',
    title: 'Shift Multi-Selection & Bulk Editing',
    shortDesc: 'Capture multiple cabinets and parts with window selection or Shift + Click to rotate, move, duplicate, and assign textures in bulk.',
    icon: 'format_shapes',
    iconColor: 'text-sky-600',
    badge: 'Batch Editing',
    steps: [
      'Multi-Selection Window Box: Hold [ Shift ] and drag with left-click across the 3D canvas. A translucent box captures all touching cabinets without orbiting the camera.',
      'Additive Selection: Hold [ Shift ] and click individual parts to add or remove them from the selection.',
      'Contextual Counter: Observe the top counter badge showing total selected parts.',
      'Bulk 90° Rotation: Press [ R ] to spin all selected items 90° around their common centroid without altering relative spacing.',
      'Batch Texture Assignment: Choose any finish in the materials palette to update all selected parts at once.',
      'To deselect, click on empty floor space or press [ Esc ].'
    ],
    tips: [
      'When multiple modules are selected, individual dimension labels hide automatically to prevent visual clutter.',
      'Duplicate an entire row of cabinets with Shift to create kitchen runs in seconds.'
    ],
    technicalDetails: [
      { label: 'Window Selection', value: 'Shift + Drag (locks camera orbit)' },
      { label: 'Additive Selection', value: 'Shift + Click on piece or module' },
      { label: 'Group Rotation', value: 'Common centroid calculation for 90° pivot' },
      { label: 'Bulk Properties', value: 'Materials, finishes, duplication, and locking' }
    ]
  },

  // 12. Special Cuts, Chamfers & U-Siphon Notch
  {
    id: 'cortes_especiales_sifon',
    category: 'modulos_piezas',
    title: 'Special Cuts, Chamfers & U-Siphon Notch',
    shortDesc: 'Advanced machining for countertops and vanities: L-notches for columns, 45° chamfers, diagonal cuts, and parametric U-siphon cutout.',
    icon: 'scissors',
    iconColor: 'text-amber-600',
    badge: 'Special Machining',
    steps: [
      'Select the countertop, panel, or shelf to machine in the 3D viewer.',
      'In the Right Inspector (Zone 3), navigate to "Special Cuts & Corners" and "U-Siphon Notch".',
      'Configure specialized cuts per architectural conditions:',
      '• Straight Cut / Recess: Trim length to fit countertops between out-of-square walls.',
      '• 45° Chamfer: Beveled corner for island counters or high-traffic walkways.',
      '• Diagonal Cut: Angled end cap for terminal modules.',
      '• L-Notch (Column): Corner cutout to wrap around structural pillars.',
      'U-Siphon Notch (Vanity Units): For bathroom sinks, enable "U-Siphon Notch". Enter cutout width and depth to clear P-trap plumbing without sacrificing drawer storage.',
      'Special cuts export to CNC DXF and PDF blueprints as closed LWPOLYLINE vectors.'
    ],
    tips: [
      'The U-siphon notch automatically generates inner lining boards to seal raw core edges around the pipe.',
      'Countertop 45° chamfers improve household safety around small children.'
    ],
    technicalDetails: [
      { label: 'Cut Types', value: 'Straight, 45° Chamfer, Diagonal, L-Notch, and U-Siphon' },
      { label: 'Bathroom Vanities', value: 'Parametric cutout for P-trap drainage lines' },
      { label: 'CNC DXF Export', value: 'Closed LWPOLYLINE entities in dedicated layer' },
      { label: 'PDF Blueprints', value: 'Automatic dimensioning of radii, notches, and bevels' }
    ]
  },

  // 13. Automatic CNC Machining & Hole Drilling
  {
    id: 'mecanizados_cnc',
    category: 'mecanizados',
    title: 'Automatic CNC Machining & Hole Drilling',
    shortDesc: 'How the smart engine calculates assembly screws, wooden dowels, and hinge cup drillings by analyzing board contact interfaces.',
    icon: 'adjust',
    iconColor: 'text-sky-600',
    badge: 'Smart Calculation',
    steps: [
      'The system evaluates all mating surfaces between adjacent parts (sides with bottom, top, fixed shelves, or vertical dividers).',
      'It identifies joint orientations (90° butt joint or door fronts).',
      'It calculates precise drill coordinates using professional carpentry standards:',
      '• Assembly Screws (Cyan): Ø 4 mm through-hole on exterior face and Ø 3 mm × 30 mm pilot hole on mating edge, at 50 mm and 100 mm from edges.',
      '• Wooden Dowels (Amber): Ø 8 mm × 15 mm blind holes in both mating faces for concealed joinery.',
      '• Hinge Cups (Purple): Ø 35 mm × 12.5 mm cup holes at 100 mm from top/bottom door edges, with edge distance K = 4 mm.',
      'Toggle drill hole visualization in 3D using the drill icon in the toolbar. Hole cylinders render in corresponding colors.',
      'When exporting to CNC DXF, all holes map into dedicated vector layers with depth and diameter parameters.'
    ],
    tips: [
      'Holes recalculate dynamically whenever boards are resized or moved.',
      'Review complete drilling coordinates in the "Part Properties" panel.',
      'PDF blueprints display dimensioned drilling coordinates for manual workshop jigs.'
    ],
    technicalDetails: [
      { label: 'Assembly Screw', value: 'Ø 4 mm clearance + Ø 3 mm pilot (Cyan)' },
      { label: 'Wooden Dowel', value: 'Ø 8 mm × 15 mm depth (Amber)' },
      { label: 'Hinge Cup', value: 'Ø 35 mm × 12.5 mm (Purple, K = 4 mm)' },
      { label: 'Edge Spacing', value: 'Standard 50 mm / 100 mm from corners' },
      { label: 'CNC Export', value: 'DXF CNC layers + dimensioned shop PDF' }
    ]
  },

  // 14. Reversible Hinges & Ø35mm Cup Holes
  {
    id: 'bisagras_reversibles',
    category: 'mecanizados',
    title: 'Reversible Hinges & Synchronized Ø35mm Cup Drill Holes',
    shortDesc: 'Left or right swing direction with automatic relocation of purple cup holes and 3D hardware.',
    icon: 'door_sliding',
    iconColor: 'text-sky-600',
    badge: 'Dynamic Hinges',
    steps: [
      'When configuring a swing door in the Inspector or right-click menu, choose swing direction: "Door (Left Hinge)" or "Door (Right Hinge)".',
      'Switching swing direction relocates the 3D handle to the opposite edge and positions 3D hinges on the appropriate side panel.',
      'Purple Ø 35 mm × 12.5 mm cup holes recalculate instantly on the hinge edge (22 mm to center, K = 4 mm).',
      'Testing door swing animation rotates drill holes in sync with the door leaf.'
    ],
    tips: [
      'Cloning a left swing door to create a right door synchronizes both 3D rendering and technical machining cut lists.',
      'K = 4 mm spacing conforms to standard market hinges (Blum, Grass, Hettich, Salice).'
    ],
    technicalDetails: [
      { label: 'Cup Standard', value: 'Ø 35 mm × 12.5 mm depth' },
      { label: 'Edge Margin K', value: '4 mm to edge / 22 mm to hole center' },
      { label: 'Synchronization', value: '3D Hinge + Handle + Cup hole + Animated rotation' }
    ]
  },

  // 15. Workshop Parameters, Saw Kerf, Edge Banding & Notes
  {
    id: 'parametros_taller_notas',
    category: 'optimizador',
    title: 'Workshop Parameters, Saw Kerf, Edge Banding & Notes',
    shortDesc: 'Millimeter cut calibration: blade saw kerf, sheet trimming margin, edge banding allowances, and workshop notes notebook.',
    icon: 'precision_manufacturing',
    iconColor: 'text-sky-600',
    badge: 'Manufacturing Precision',
    steps: [
      'Before exporting cut lists, configure fabrication parameters in Optimizer or Project Settings:',
      '• Saw Kerf: Set exact thickness of the saw blade (standard 3.2 mm to 4.0 mm). The optimizer deducts this material per cut to prevent undersized parts.',
      '• Trim Margin: Set perimeter trim margin (e.g. 10 mm per side) to clean chipped factory board edges.',
      '• Edge Banding (Thin 0.45 mm vs Thick 2.0 mm): Assign which edges receive tape (L1, L2, W1, W2). Thick edge allowances deduct automatically in cutting.',
      '• Notes & Checklist: Open project notes from the top bar to record job site requirements, installation checklists, and client notes.'
    ],
    tips: [
      'If outsourcing cutting to distributors, check their saw blade kerf (typically 4.0 mm or 4.4 mm) for identical cut patterns.',
      'Linear meter tracking separates thin and thick tape for accurate roll purchasing.'
    ],
    technicalDetails: [
      { label: 'Saw Kerf Range', value: '1.0 mm to 6.0 mm (Recommended: 4.0 mm)' },
      { label: 'Perimeter Trim', value: '0 mm to 30 mm per side (Standard: 10 mm)' },
      { label: 'Edge Deduction', value: 'Automatic 2 mm deduction on cutting list' },
      { label: 'Project Notes', value: 'Real-time cloud sync and persistence' }
    ]
  },

  // 16. 2D Cut Optimization, Parts List & Edge Deduction
  {
    id: 'optimizador_despiece',
    category: 'optimizador',
    title: '2D Cut Optimization, Parts List & Edge Banding Deduction',
    shortDesc: 'High-yield 2D guillotine algorithm respecting wood grain orientation, trim margins, saw blade kerf, and edge compensation.',
    icon: 'precision_manufacturing',
    iconColor: 'text-sky-600',
    badge: 'Material Savings',
    steps: [
      'Navigate to tab "3. 2D Optimizer" in the top bar.',
      'Set commercial sheet dimensions (e.g. 2440 × 1830 mm) and saw blade thickness (Kerf = 4 mm standard).',
      'Set sheet perimeter trim margin (e.g. 10 mm) to clean raw board edges.',
      'Enable "Deduct Edge Banding in Cut" if using 2 mm rigid PVC edges.',
      'The engine arranges cutting passes respecting lengthwise or crosswise grain and minimizing waste offcuts.',
      'Generate summary metrics: sheet utilization rate, linear meters of edge banding, and numbered cutting layouts.',
      'Click "Export 2D Technical Blueprint" to generate shop-ready printable PDFs.'
    ],
    tips: [
      'Print adhesive part labels with cabinet names, exact dimensions, and edge banding diagrams.',
      'The 2D Guillotine algorithm generates end-to-end cuts suitable for standard sliding table saws and panel saws.'
    ],
    technicalDetails: [
      { label: 'Algorithm', value: 'Guillotine 2D with strict grain orientation control' },
      { label: 'Parameters', value: 'Saw kerf (0-10 mm), Trim margin (0-25 mm)' },
      { label: 'Edge Deduction', value: '0.45 mm and 2.0 mm on designated edges' }
    ]
  },

  // 17. Quick Keyboard Shortcuts Guide
  {
    id: 'atajos_teclado',
    category: 'atajos',
    title: 'Quick Keyboard Shortcuts Guide',
    shortDesc: 'Work with peak speed using conflict-free shortcuts to select, rotate, move, measure, and transform components.',
    icon: 'keyboard',
    iconColor: 'text-emerald-600',
    badge: 'Productivity',
    steps: [
      '• [ V ] or [ Spacebar ]: Select tool (Shift + Click to add/remove parts)',
      '• [ Shift + Drag ]: Multi-selection window. Locks camera and captures multiple cabinets in a marquee',
      '• [ Shift + Click ]: Add or remove parts from active selection',
      '• [ M ]: Move tool (reposition modules or boards in 3D space)',
      '• [ R ] / [ Q ]: Rotate active selection 90° around shared centroid',
      '• [ T ]: 3D Tape Measure with magnetic snapping to vertices and edges',
      '• [ Z ]: Center and reset 3D camera viewpoint',
      '• [ W ] / [ S ]: Elevate or lower selected part on vertical Y axis (+/-10 mm)',
      '• [ Arrow Keys ]: Millimeter nudge for selected elements (1 mm or 10 mm with Shift)',
      '• [ G ]: Toggle spatial guides and 1.72 m human scale mannequin',
      '• [ H ] / [ Alt + H ]: Hide selection or reveal all hidden parts',
      '• [ Del / Backspace ]: Delete selected parts, cabinets, or appliances',
      '• [ Ctrl + Z ] / [ Cmd + Z ]: Undo last action',
      '• [ Ctrl + Y ] / [ Cmd + Shift + Z ]: Redo undone action',
      '• [ Esc ]: Cancel active tool, clear selection, or dismiss modals'
    ],
    tips: [
      'Multi-Selection Marquee: Hold [ Shift ] and drag left-click across the 3D viewport. A marquee box captures all touching cabinets without orbiting.',
      'Shortcut [ R ] is dedicated exclusively to ROTATE: pressing R with a cabinet selected spins it 90° immediately without tool switching.',
      'Press Spacebar or [ V ] anytime to return to standard selection.'
    ],
    technicalDetails: [
      { label: '3D Selection Box', value: 'Shift + Mouse drag' },
      { label: 'Additive Select', value: 'Shift + Click on part' },
      { label: '90° Rotation', value: '[ R ] or [ Q ] key' },
      { label: 'Move Tool', value: '[ M ] key' },
      { label: 'Tape Measure', value: '[ T ] key' },
      { label: 'Select Tool', value: '[ V ] or [ Spacebar ]' },
      { label: 'Reset Camera', value: '[ Z ] key' },
      { label: 'Human Scale', value: '[ G ] key' }
    ]
  }
];

/* ==========================================================================
   PORTUGUÊS (PT)
   ========================================================================== */

export const DOC_ARTICLES_PT: DocArticle[] = [
  // 1. GUIA 1: Design Paramétrico por Ambientes
  {
    id: 'diseno_parametrico_ambientes',
    category: 'modulos_piezas',
    title: 'Design Paramétrico por Ambientes (Cozinhas, Closets, Banheiros e Estúdio)',
    shortDesc: 'Configure móveis sob medida em 4 linhas especializadas com distribuição interna inteligente de portas, gavetas, prateleiras e rodapés sem desalinhamentos.',
    icon: 'view_in_ar',
    iconColor: 'text-sky-600',
    badge: 'Motor Paramétrico',
    steps: [
      'Na Zona 1 (Barra Superior), selecione a linha de ambiente de trabalho: Cozinhas, Closets, Banheiros ou Home Office / Estúdio.',
      'Clique no botão "+ Módulo" para abrir o Assistente e Catálogo de Modelos Paramétricos com módulos pré-configurados (gabinetes inferiores, aéreos, de canto, roupeiros com cabideiros, toucadores flutuantes com recorte para sifão ou escrivaninhas).',
      'Insira o móvel escolhendo "Adicionar à oficina" para compor projetos completos ou "Substituir atual".',
      'No Inspetor Contextual (Zona 3 Direita), ajuste em milímetros a Largura, Altura, Profundidade e Espessura estrutural (15 mm ou 18 mm). O móvel recalcula todas as peças automaticamente respeitando as folgas de montagem.',
      'Na seção "Distribuição Interna e Frentes", adicione ou remova portas (de abrir, duplas ou basculantes com pistão a gás), gaveteiros (1 a 4 gavetas com corrediças telescópicas automáticas), prateleiras e tubos cabideiros.',
      'Configure a base do móvel: Com Rodapé (plinth), Suspenso/Flutuante (com Elevação Y configurável) ou Direto ao chão.'
    ],
    tips: [
      'Use o botão "Duplicar para o Lado (+X)" no inspetor para formar fileiras de armários contínuos alinhados topo a topo sem frestas milimétricas.',
      'Ao alterar o material principal do módulo, todas as peças associadas são atualizadas simultaneamente, mantendo a orientação correta do veio da melamina.'
    ],
    technicalDetails: [
      { label: 'Linhas de Ambiente', value: 'Cozinhas, Closets, Banheiros e Home Office / Estúdio' },
      { label: 'Espessuras Suportadas', value: '15 mm e 18 mm (sincronizadas com o otimizador 2D)' },
      { label: 'Distribuição Interna', value: 'Portas de giro/basculantes, gavetas, prateleiras e cabideiros' },
      { label: 'Configuração da Base', value: 'Rodapé, suspenso/flutuante ou direto ao chão' }
    ]
  },

  // 2. GUIA 2: Ajuste de Prateleiras em Trilho Vertical e Edição Direta de "Luz Interna" 3D
  {
    id: 'ajuste_repisas_luz_interna',
    category: 'cotas_luz',
    title: 'Ajuste de Prateleiras em Trilho Vertical e Edição Direta de "Luz Interna" 3D',
    shortDesc: 'Visualização em tempo real de vãos livres internos, movimentação em trilho vertical anti-colisão, autocentralização e edição por clique direto na cota 3D.',
    icon: 'straighten',
    iconColor: 'text-emerald-500',
    badge: 'Cotas HD 3D',
    steps: [
      'Clique em qualquer prateleira ou divisória interna no visualizador 3D: as cotas de Vão Livre Superior, Vão Livre Inferior e Largura Útil serão projetadas instantaneamente em verde esmeralda com o rótulo ↕ XXX mm.',
      'Edição Direta no Espaço 3D: Dê um clique esquerdo diretamente no rótulo milimétrico flutuante no visor 3D. Um campo numérico surgirá: digite a distância desejada no teclado (ex.: 250) e pressione [ Enter ]. A prateleira será reposicionada imediatamente.',
      'Arrasto em Trilho Vertical Anti-Colisão: Mantenha o clique pressionado sobre a prateleira e arraste-a para cima ou para baixo no eixo Y. O motor restringe o movimento estritamente à vertical e impede colisões contra o fundo, topo ou outras prateleiras (margem de segurança minGap = 40 mm).',
      'Ajuste Numérico no Inspetor Direito: No painel do inspetor, sob a seção "Posição da Prateleira (Vão Livre)", insira valores exatos em "Vão Inferior" ou "Vão Superior".',
      'Autocentralização no Vão: Clique no botão "Centralizar no Vão" para equilibrar com precisão simétrica as distâncias superior e inferior em uma única etapa.'
    ],
    tips: [
      'Ao duplicar uma prateleira com o botão Duplicar, o sistema calcula a altura restante do vão e posiciona a nova peça automaticamente centralizada sem sobrepor vizinhas.',
      'A cota horizontal de Largura Útil permite verificar se organizadores ou louças cabem no nicho sem precisar subtrair manualmente as espessuras das laterais.'
    ],
    technicalDetails: [
      { label: 'Movimentação', value: 'Trilho vertical anti-colisão com folga de segurança (40 mm)' },
      { label: 'Edição Direta 3D', value: 'Sprite interativo Three.js com entrada numérica imediata' },
      { label: 'Cálculo de Vão', value: 'Subtrai espessuras das chapas (vão útil livre real)' },
      { label: 'Autocentralização', value: 'Algoritmo simétrico em relação aos obstáculos superior e inferior' }
    ]
  },

  // 3. GUIA 3: Orçamento Multimoeda em Tempo Real e Desconto de Fita de Borda
  {
    id: 'presupuesto_multimoneda_tapacanto',
    category: 'optimizador',
    title: 'Orçamento Multimoeda em Tempo Real e Desconto de Fita de Borda',
    shortDesc: 'Cotação comercial automática com taxa de câmbio ao vivo (COP base para USD, MXN, EUR), cálculo reativo de ferragens e compensação de fita de borda no otimizador 2D.',
    icon: 'tag',
    iconColor: 'text-amber-500',
    badge: 'Finanças & Corte',
    steps: [
      'Acesse a aba "4. Orçamento" na barra de navegação superior.',
      'Seletor Multimoeda ao Vivo: Escolha a moeda desejada para cotação (COP base, USD, MXN, EUR). O sistema consulta APIs de câmbio ao vivo e converte custos unitários e totais com formatação monetária regional.',
      'Detalhamento dos Custos de Fabricação: Consulte a quantidade de chapas consumidas segundo o cálculo do otimizador 2D, os metros lineares de fita de borda fina (0,45 mm) e grossa (2,0 mm), e a listagem de ferragens (parafusos, dobradiças e corrediças sem cobrança duplicada).',
      'Insira a porcentagem de mão de obra da marcenaria, margem de lucro e impostos para obter o preço de venda final para o cliente.',
      'Desconto de Fita de Borda no Corte (subtractEdgeBandingFromCut): Na aba "2. Lista de Peças" ou "3. Otimizador 2D", marque a opção "Descontar Fita de Borda no Corte".',
      'Quando ativada, a serra desconta 0,45 mm ou 2,0 mm nas bordas marcadas (L1, L2, LARG1, LARG2) de cada painel, garantindo que após a colagem da borda na oficina a peça final tenha exatamente a medida nominal do projeto.'
    ],
    tips: [
      'O desconto de fita de borda é fundamental ao utilizar fita rígida de PVC de 2 mm em frentes de gaveta ou portas, evitando atritos por excesso de medida.',
      'Você pode exportar o orçamento detalhado em PDF profissional para entregar como proposta formal aos clientes.'
    ],
    technicalDetails: [
      { label: 'Moedas Suportadas', value: 'Moeda base COP convertível para USD, MXN e EUR com taxa em tempo real' },
      { label: 'Desconto de Borda', value: '0,45 mm (flexível) e 2,0 mm (rígida PVC) em L1/L2/LARG1/LARG2' },
      { label: 'Cálculo de Ferragens', value: 'Parafusos, cavilhas, dobradiças e corrediças calculados por união' },
      { label: 'Chapas Necessárias', value: 'Vinculação direta com o algoritmo Guilhotina 2D' }
    ]
  },

  // 4. GUIA 4: Exportação de Modelo 3D (.DAE), Plantas PDF e Manual de Montagem RTA
  {
    id: 'exportacion_dae_pdf_armado',
    category: 'optimizador',
    title: 'Exportação de Modelo 3D (.DAE), Plantas PDF e Manual de Montagem RTA',
    shortDesc: 'Gere entregáveis industriais prontos para oficina e cliente: modelo 3D COLLADA .DAE milimétrico universal, plantas 2D cotadas em PDF e manual interativo de montagem passo a passo RTA.',
    icon: 'download',
    iconColor: 'text-sky-500',
    badge: 'Fabricação Industrial',
    steps: [
      'Exportação de Modelo 3D (.DAE): No menu superior, clique em "Exportar" e selecione "Exportar Modelo 3D (.DAE)". O sistema gera um arquivo COLLADA 1.4.1 em escala milimétrica (1 unidade = 1 mm), com hierarquia de peças agrupadas por módulo em camadas organizadas e conversão para o eixo vertical Z_UP padrão.',
      'Plantas Técnicas 2D em PDF: No menu Exportar ou na Lista de Peças, clique em "Planta 2D Técnica (PDF)". Baixe uma ficha de fábrica com listagem de corte completa, representação gráfica das faces com furações CNC e cotas de fita de borda.',
      'Planos de Corte 2D de Chapas: Na aba "3. Otimizador 2D", clique em "Exportar Planos de Corte" para imprimir o diagrama de corte guilhotina com numeração sequencial das peças, espessura da serra (kerf) e etiquetas com código de barras.',
      'Manual de Montagem RTA Passo a Passo: Clique em "Guia de Montagem" no cabeçalho para abrir o manual de montagem passo a passo. Visualize a montagem isométrica etapa por etapa de cada módulo com relação de ferragens por fase.'
    ],
    tips: [
      'O arquivo .DAE exportado mantém o mapeamento de texturas e a geometria agrupada pronta para visualização e renderização 3D sem necessidade de plugins.',
      'O Manual de Montagem RTA pode ser impresso ou compartilhado digitalmente para agilizar a instalação na obra sem dúvidas sobre o posicionamento das peças.'
    ],
    technicalDetails: [
      { label: 'Formato 3D', value: 'COLLADA 1.4.1 (.DAE) universal com coordenadas milimétricas' },
      { label: 'Escala de Exportação', value: 'Milimétrica 1:1 com nomenclatura organizada para hierarquias 3D' },
      { label: 'Documentos PDF', value: 'Fichas técnicas cotadas, diagramas de corte 2D e etiquetas adesivas' },
      { label: 'Manual RTA', value: 'Sequência isométrica 2D com relação discriminada de ferragens' }
    ]
  },

  // 5. GUIA 5: Guia de Escala Humana 1,72 m e Bússola Cardinal (+Z)
  {
    id: 'escala_humana_brujula',
    category: 'herramientas_3d',
    title: 'Guia de Escala Humana 1,72 m e Bússola Cardinal (+Z)',
    shortDesc: 'Manequim arquitetônico em escala real (1720 mm) com régua ergonômica vertical e marcadores de piso para verificar alturas de trabalho.',
    icon: 'human',
    iconColor: 'text-sky-500',
    badge: 'Ergonomia CAD',
    steps: [
      'No visualizador 3D você encontrará o manequim arquitetônico em escala humana real (1720 mm / 1,72 m de altura) posicionado sobre o piso da oficina.',
      'A figura conta com uma régua vertical milimétrica destacando alturas antropométricas essenciais: rodapé (100 mm), bancada de cozinha (900 mm), frontão (1450 mm) e alcance visual (1600-1720 mm).',
      'No piso, a moldura perimetral da oficina de 5000 × 5000 mm exibe marcações nítidas: em azul "▲ FRENTE (+Z) · VISTA PRINCIPAL", e em cinza "▼ FUNDO (-Z)", "► ESQUERDA (-X)" e "◄ DIREITA (+X)".',
      'Para mover o manequim: clique sobre sua base ou corpo no visor 3D e arraste suavemente com o mouse para comparar proporções com o móvel em modelagem.',
      'Para exibir ou ocultar o manequim e os marcadores a qualquer instante, clique no ícone de figura humana na barra de ferramentas ou utilize o atalho de teclado [ G ].'
    ],
    tips: [
      'Utilize o manequim ao projetar armários aéreos de cozinha para conferir se o usuário alcançará as prateleiras mais altas sem necessitar de escadas.',
      'O indicador "FRENTE (+Z)" assegura que as portas e gavetas nunca sejam desenhadas invertidas para trás.',
      'A figura é puramente uma referência visual e não é incluída na lista de corte nem na exportação CNC.'
    ],
    technicalDetails: [
      { label: 'Altura padrão', value: '1720 mm (1,72 m) proporção ergonômica' },
      { label: 'Marcadores de piso', value: 'FRENTE (+Z), FUNDO (-Z), ESQ (-X), DIR (+X)' },
      { label: 'Interação', value: 'Arrasto livre no plano XZ do piso com o mouse' },
      { label: 'Visibilidade', value: 'Alternável pelo botão na barra ou atalho [ G ]' }
    ]
  },

  // 6. GUIA 6: Congelar / Bloquear Peças e Módulos
  {
    id: 'bloqueo_congelar_piezas',
    category: 'herramientas_3d',
    title: 'Congelar / Bloquear Peças e Módulos',
    shortDesc: 'Bloqueie peças individuais ou conjuntos inteiros contra deslocamentos acidentais, edições ou exclusões involuntárias.',
    icon: 'lock',
    iconColor: 'text-amber-500',
    badge: 'Proteção de Projeto',
    steps: [
      'Selecione a peça ou conjunto que deseja proteger no visualizador 3D.',
      'Você pode congelar o elemento de duas formas ágeis:',
      '• Pelo Menu Contextual (Botão Direito): Clique com o botão direito sobre a peça e escolha "Congelar Apenas Esta Peça" ou "Congelar Módulo Completo / Gaveta Completa".',
      '• Pela Barra Superior Contextual: Clique no botão com o ícone de cadeado.',
      'Quando congelada, a peça exibirá uma etiqueta âmbar com o indicador [ Bloqueado ].',
      'O elemento bloqueado fica 100% protegido: não pode ser arrastado com o mouse nem deletado pela tecla Delete.',
      'Para desbloquear, clique com o botão direito sobre a peça e selecione "Descongelar", ou clique novamente no cadeado da barra superior.'
    ],
    tips: [
      'Bloqueie as laterais e a base do gabinete assim que definir suas dimensões principais; assim você poderá ajustar prateleiras e gavetas sem risco de mover a caixa externa.',
      'Ao congelar uma gaveta inteira, frente, laterais, contra-fundo, fundo e corrediças ficam protegidos com um só clique.',
      'Peças congeladas continuam sendo calculadas normalmente na lista de corte e no orçamento.'
    ],
    technicalDetails: [
      { label: 'Escopo', value: 'Peça individual (part.isLocked) ou Grupo (group.isLocked)' },
      { label: 'Efeito', value: 'Desativa translação, arrasto, rotação e exclusão' },
      { label: 'Identificador', value: 'Badge visual âmbar no visor 3D e nas tabelas' },
      { label: 'Persistência', value: 'Salvo na nuvem e no arquivo JSON do projeto' }
    ]
  },

  // 7. GUIA 7: Menu Contextual Inteligente de Botão Direito
  {
    id: 'menu_contextual_inteligente',
    category: 'herramientas_3d',
    title: 'Menu Contextual Inteligente de Botão Direito',
    shortDesc: 'Menu contextual 3D adaptativo que altera suas opções dinamicamente conforme você clica em Gaveta, Porta, Estrutura ou Espaço Vazio.',
    icon: 'mouse',
    iconColor: 'text-sky-600',
    badge: 'Produtividade 3D',
    steps: [
      'Clique com o botão direito do mouse em qualquer ponto do visualizador 3D.',
      'O menu identifica o elemento sob o cursor e disponibiliza ações pertinentes:',
      '• Clique em uma Gaveta: Teste de abertura/fechamento das corrediças, congelar a gaveta, duplicar, trocar puxador ou isolar frente.',
      '• Clique em uma Porta: Alternar dobradiça reversível (Esquerda / Direita), abrir/fechar folha, trocar puxador ou bloquear.',
      '• Clique em Peça Estrutural: Girar 90°, alternar orientação (Horizontal / Vertical), duplicar, congelar ou excluir.',
      '• Clique no Piso ou Espaço Vazio: Atalhos rápidos para inserir painel avulso, alternar escala humana, centralizar câmera ou reiniciar visão.',
      'Para fechar o menu contextual, dê um clique esquerdo no piso ou pressione [ Esc ].'
    ],
    tips: [
      'O menu contextual poupa navegações em painéis laterais: os comandos mais frequentes ficam a apenas um clique de distância.',
      'Se várias peças estiverem selecionadas com Shift + Clique, o menu apresentará ações em lote (como Agrupar ou Congelar Seleção).'
    ],
    technicalDetails: [
      { label: 'Detecção Raycaster', value: 'Análise de colisão 3D nas coordenadas precisas do cursor' },
      { label: 'Modos Contextuais', value: 'Gaveta, Porta, Peça estrutural e Espaço vazio' },
      { label: 'Animações', value: 'Giro de dobradiças e deslizamento de corrediças instantâneo' }
    ]
  },

  // 8. GUIA 8: Ambiente 3D e Equipamentos
  {
    id: 'habitacion_equipos_3d',
    category: 'herramientas_3d',
    title: 'Ambiente 3D e Equipamentos',
    shortDesc: 'Cenário realista de oficina ou cômodo com paredes e piso personalizáveis, e inserção de eletrodomésticos padronizados no inspetor de 3 zonas.',
    icon: 'room',
    iconColor: 'text-emerald-500',
    badge: 'Visualização e Cenário',
    steps: [
      'Na Zona 1 (Barra Superior), ative o Modo Ambiente para criar paredes perimetrais e piso arquitetônico com medidas e texturas configuráveis.',
      'Clique no botão "+ Equipamento 3D" na barra superior ou acesse a aba "Equipamentos" no Inspetor Contextual Direito (Zona 3).',
      'Navegue pelo catálogo de eletrodomésticos comerciais normatizados: refrigeradores de 1 porta ou Side-by-Side, fornos de embutir, micro-ondas, coifas, cubas de inox e lava-louças.',
      'Insira o eletrodoméstico na cena 3D e posicione-o diretamente no nicho do armário correspondente.',
      'No Inspetor Direito, calibre elevação Y, rotação e comprove se as folgas de ventilação atendem ao fabricante.',
      'Use o botão de bloqueio para fixar a posição do equipamento após encaixá-lo no móvel.'
    ],
    tips: [
      'Ao projetar gabinetes de pia, posicione a cuba 3D sobre a bancada para conferir o recorte superior e garantir que divisórias internas não interfiram no encanamento.',
      'Os eletrodomésticos servem como guias visuais de projeto e não geram peças na lista de corte.'
    ],
    technicalDetails: [
      { label: 'Catálogo de Equipamentos', value: 'Refrigerador, Forno, Micro-ondas, Cuba, Coifa, Lava-louças' },
      { label: 'Paredes e Piso', value: 'Dimensões milimétricas com texturas cerâmicas e amadeiradas' },
      { label: 'Folgas de Encaixe', value: 'Verificação visual de nichos e espaçamentos térmicos' },
      { label: 'Integração', value: 'Posicionamento em 3 zonas e inspetor de propriedades' }
    ]
  },

  // 9. GUIA 9: Movimentação por Arraste Direto 3D e Trilho Vertical
  {
    id: 'movimiento_directo_3d',
    category: 'herramientas_3d',
    title: 'Movimentação por Arraste Direto 3D e Trilho Vertical',
    shortDesc: 'Mova peças individuais ou módulos clicando e arrastando diretamente em qualquer superfície, com restrição de plano e trilho vertical anti-colisão.',
    icon: 'pan_tool',
    iconColor: 'text-sky-600',
    badge: 'Interação Natural',
    steps: [
      'Dê um clique esquerdo sobre qualquer peça ou gabinete no visualizador 3D.',
      'O cursor se transformará em mão aberta ao passar sobre o objeto, e em mão fechada ao manter o clique pressionado.',
      'Arraste com o mouse: o movimento fica restrito ao plano da peça ou ao trilho vertical no caso de prateleiras internas.',
      'Peças pertencentes a um módulo (gavetas com frente, laterais e fundo) movem-se agrupadas e perfeitamente coordenadas.',
      'Para ajustes finos de precisão, utilize as setas do teclado (1 mm por toque, ou 10 mm segurando Shift).',
      'Para redimensionar uma peça selecionada, utilize as alças cúbicas perimetrais ou os campos do Inspetor Direito.'
    ],
    tips: [
      'Pressione as teclas [ W ] (+10 mm) e [ S ] (-10 mm) para elevar ou descer peças rapidamente no eixo Y.',
      'Pressione [ Ctrl + Z ] para desfazer qualquer arrasto indesejado imediatamente.'
    ],
    technicalDetails: [
      { label: 'Método de Arrasto', value: 'Clique sustentado com projeção planar CAD raycasting' },
      { label: 'Movimentação Modular', value: 'Sincronização por ID de módulo e hierarquia' },
      { label: 'Microajuste', value: 'Passos de 1 mm e 10 mm com setas direcionais do teclado' },
      { label: 'Histórico', value: 'Desfazer e refazer com [ Ctrl + Z ] / [ Ctrl + Y ]' }
    ]
  },

  // 10. GUIA 10: Barra Contextual de Ações e Barra Superior
  {
    id: 'cinta_acciones_flotante',
    category: 'herramientas_3d',
    title: 'Barra Contextual de Ações e Barra Superior',
    shortDesc: 'Menu contextual flutuante para duplicar, girar 90°, alternar orientação, congelar e gerenciar acabamentos instantaneamente.',
    icon: 'dashboard_customize',
    iconColor: 'text-emerald-600',
    badge: 'Barra Superior',
    steps: [
      'Ao selecionar uma peça ou gabinete no visor 3D, a barra contextual flutuante surge no topo da tela.',
      'A barra exibe um contador com o total de itens selecionados e atalhos rápidos:',
      '• "Duplicar": Clona o item lateralmente preservando furações e ferragens associadas.',
      '• "Girar 90° [ R ]": Gira a seleção em 90 graus em torno do centro comum.',
      '• "Congelar": Bloqueia ou libera a peça contra movimentações acidentais.',
      '• "Mover": Alterna para a ferramenta de translação rápida.',
      '• "Paleta de Melamina": Abre o seletor de acabamentos para aplicação em lote a todas as peças selecionadas.',
      '• "Excluir [ Del ]": Remove os elementos selecionados do projeto.',
      'No canto superior esquerdo é exibido o nome da peça e suas dimensões (C × L × E).'
    ],
    tips: [
      'A barra só se manifesta quando há seleção ativa, preservando o campo de visão limpo durante a rotação da câmera.',
      'Você pode pressionar a tecla [ R ] a qualquer momento para girar a seleção ativa em 90° sem clicar no botão.'
    ],
    technicalDetails: [
      { label: 'Visibilidade', value: 'Contextual e reativa (somente com seleção ativa)' },
      { label: 'Operações em Lote', value: 'Duplicar, Girar 90°, Bloquear, Mover, Textura e Excluir' },
      { label: 'Atalho de Rotação', value: 'Tecla [ R ] ou [ Q ]' },
      { label: 'Atalho de Exclusão', value: 'Tecla [ Delete ] ou [ Backspace ]' }
    ]
  },

  // 11. GUIA 11: Seleção Múltipla com Shift e Edição em Bloco
  {
    id: 'seleccion_multiple_shift',
    category: 'modulos_piezas',
    title: 'Seleção Múltipla com Shift e Edição em Bloco',
    shortDesc: 'Capture múltiplos móveis e peças por caixa de seleção ou Shift + Clique para girar, mover, duplicar e aplicar melaminas em bloco.',
    icon: 'format_shapes',
    iconColor: 'text-sky-600',
    badge: 'Edição em Lote',
    steps: [
      'Caixa de Seleção Múltipla: Mantenha pressionada a tecla [ Shift ] e arraste o mouse com o botão esquerdo sobre o visualizador 3D. Uma caixa translúcida envolverá e selecionará todas as peças tocadas, sem girar a câmera.',
      'Seleção Aditiva por Clique: Segure [ Shift ] e clique em peças ou módulos avulsos para adicioná-los ou removê-los da seleção.',
      'Contador Contextual: Observe na barra superior o número total de peças selecionadas (ex.: "8 peças selecionadas").',
      'Rotação em Bloco: Pressione a tecla [ R ] para girar em 90° todas as peças selecionadas ao redor de seu centro comum sem desconfigurar a distância entre elas.',
      'Aplicação de Melamina em Bloco: Escolha um acabamento na paleta de materiais para alterar a cor ou textura de todas as peças marcadas simultaneamente.',
      'Para desselecionar tudo, clique no chão vazio ou pressione [ Esc ].'
    ],
    tips: [
      'Ao selecionar múltiplos módulos inteiros, as cotas individuais são ocultadas no 3D para evitar poluição visual.',
      'Duplique uma fileira completa de armários usando Shift para criar bancadas de cozinha em segundos.'
    ],
    technicalDetails: [
      { label: 'Caixa de Seleção', value: 'Shift + Arraste de mouse (trava a rotação da câmera)' },
      { label: 'Seleção Aditiva', value: 'Shift + Clique na peça ou módulo' },
      { label: 'Rotação Coletiva', value: 'Cálculo de centroide comum para giro simétrico de 90°' },
      { label: 'Propriedades em Bloco', value: 'Padrões de melamina, duplicação e congelamento' }
    ]
  },

  // 12. GUIA 12: Cortes Especiais, Chanfros e Recorte Sifão em U
  {
    id: 'cortes_especiales_sifon',
    category: 'modulos_piezas',
    title: 'Cortes Especiais, Chanfros e Recorte Sifão em U',
    shortDesc: 'Usinagens avançadas para bancadas e gabinetes: recortes em L para colunas, chanfros a 45°, cortes diagonais e recorte sifão em U paramétrico.',
    icon: 'scissors',
    iconColor: 'text-amber-600',
    badge: 'Usinagem Especial',
    steps: [
      'Selecione a bancada, tampo ou prateleira que deseja usinar no visualizador 3D.',
      'No Inspetor Contextual Direito (Zona 3), navegue até as seções "Cortes Especiais e Cantos" e "Recorte Sifão em U".',
      'Selecione a modalidade de corte conforme a exigência do ambiente:',
      '• Reto ou Rebaixo: Ajustes de comprimento para encaixar bancadas entre paredes desalinhadas.',
      '• Chanfro a 45°: Cantos chanfrados de segurança para bancadas de passagem ou ilhas.',
      '• Diagonal: Remates angulados para armários de canto ou corredores estreitos.',
      '• Recorte em L (Coluna): Vão retangular traseiro para contornar pilares e vigas prediais.',
      'Recorte Sifão em U (Gabinetes de Banheiro): Em gavetas e móveis de pia, ative a opção "Recorte Sifão em U". Digite a largura e profundidade do recorte central para contornar o sifão e encanamento sem perder os compartimentos laterais.',
      'Na exportação para DXF CNC ou PDF de oficina, os cortes especiais são convertidos em polilinhas contínuas LWPOLYLINE cotadas com precisão milimétrica.'
    ],
    tips: [
      'O recorte sifão em U gera automaticamente os fechamentos internos da gaveta para vedar os topos crus ao redor da passagem do cano.',
      'Chanfros a 45° nas quinas de bancadas reduzem o risco de acidentes domésticos com crianças.'
    ],
    technicalDetails: [
      { label: 'Tipos de Corte', value: 'Reto, Chanfro 45°, Diagonal, Recorte em L e Sifão em U' },
      { label: 'Aplicação em Banheiros', value: 'Recorte paramétrico para tubulação e sifão de pia' },
      { label: 'Exportação DXF', value: 'Polilinhas contínuas fechadas LWPOLYLINE em camada própria' },
      { label: 'Plantas em PDF', value: 'Cotas automáticas de raios, chanfros e recortes' }
    ]
  },

  // 13. GUIA 13: Usinagem e Perfurações CNC Automáticas
  {
    id: 'mecanizados_cnc',
    category: 'mecanizados',
    title: 'Usinagem e Perfurações CNC Automáticas',
    shortDesc: 'Como o motor inteligente calcula parafusos de montagem, cavilhas e dobradiças analisando automaticamente as uniões de melamina.',
    icon: 'adjust',
    iconColor: 'text-sky-600',
    badge: 'Cálculo Inteligente',
    steps: [
      'O sistema analisa todas as faces de contato e sobreposição entre peças vizinhas (laterais com base, topo, prateleiras fixas ou divisórias).',
      'Detecta a orientação de cada junta (junção de topo a 90° ou frentes de portas).',
      'Determina as coordenadas precisas de furação respeitando as boas práticas de marcenaria:',
      '• Parafusos de Montagem (Ciano): Furo passante de Ø 4 mm na face externa e furo guia de Ø 3 mm × 30 mm no topo da peça perpendicular, a 50 mm e 100 mm de cada extremidade.',
      '• Cavilhas de Madeira (Âmbar): Furos de Ø 8 mm × 15 mm de profundidade em ambas as peças para união oculta sem parafusos aparentes.',
      '• Canecos de Dobradiça (Roxo): Em portas de giro, calcula furos de Ø 35 mm × 12,5 mm a 100 mm dos cantos superior e inferior, com distância da borda K = 4 mm.',
      'Para inspecionar as furações no visualizador 3D, ative o botão de furações (ícone de broca) na barra de ferramentas.',
      'Ao exportar em DXF CNC, todos os furos são organizados em camadas vetoriais com diâmetros e profundidades configurados para centros de usinagem.'
    ],
    tips: [
      'As furações recalculam-se em tempo real sempre que você redimensiona um painel ou altera sua espessura.',
      'No painel "Propriedades da Peça", você pode inspecionar a listagem completa de coordenadas atribuídas à peça selecionada.',
      'Na planta 2D técnica (PDF), cada face é exibida com suas cotas para marcação e furação manual com gabaritos na bancada.'
    ],
    technicalDetails: [
      { label: 'Parafuso de Montagem', value: 'Ø 4 mm passante + Ø 3 mm guia (Cor Ciano)' },
      { label: 'Cavilhas de Madeira', value: 'Ø 8 mm × 15 mm profundidade (Cor Âmbar)' },
      { label: 'Caneco de Dobradiça', value: 'Ø 35 mm × 12,5 mm (Cor Roxa, K = 4 mm)' },
      { label: 'Espaçamento de Bordas', value: 'Padrão 50 mm e 100 mm a partir dos cantos' },
      { label: 'Exportação CNC', value: 'Camadas DXF CNC + Fichas cotadas em PDF' }
    ]
  },

  // 14. GUIA 14: Dobradiças e Furações Caneco Ø35mm Reversíveis Sincronizadas
  {
    id: 'bisagras_reversibles',
    category: 'mecanizados',
    title: 'Dobradiças e Furações Caneco Ø35mm Reversíveis Sincronizadas',
    shortDesc: 'Abertura para esquerda ou direita com reposicionamento automático de furações e ferragens 3D.',
    icon: 'door_sliding',
    iconColor: 'text-sky-600',
    badge: 'Dobradiças Dinâmicas',
    steps: [
      'Ao configurar uma porta de bater no Inspetor ou no menu de botão direito, selecione o sentido de abertura: "Porta (Dobradiça Esquerda)" ou "Porta (Dobradiça Direita)".',
      'Ao alterar o lado, o puxador 3D desloca-se para a borda contrária e as dobradiças 3D fixam-se no painel lateral correto.',
      'As furações roxas de caneco Ø 35 mm × 12,5 mm são recalculadas imediatamente no lado de articulação (a 22 mm do centro do furo, K = 4 mm).',
      'Ao testar o movimento pela opção "Abrir Porta" ou pelo botão de animação na barra, os furos de caneco giram integrados à folha da porta.'
    ],
    tips: [
      'Ao clonar uma porta esquerda para criar a porta direita do armário, o sistema sincroniza a renderização 3D e a lista técnica de furações.',
      'A distância K = 4 mm é compatível com os padrões de dobradiças retas, curvas e super curvas dos principais fabricantes (Blum, FGV, Hettich, Hafele).'
    ],
    technicalDetails: [
      { label: 'Padrão do Caneco', value: 'Ø 35 mm × 12,5 mm de profundidade' },
      { label: 'Distância da Borda K', value: '4 mm da borda / 22 mm ao centro do furo' },
      { label: 'Sincronização', value: 'Dobradiça 3D + Puxador + Furo caneco + Giro animado' }
    ]
  },

  // 15. GUIA 15: Parâmetros de Oficina, Kerf de Serra, Fitas de Borda e Notas
  {
    id: 'parametros_taller_notas',
    category: 'optimizador',
    title: 'Parâmetros de Oficina, Kerf de Serra, Fitas de Borda e Notas',
    shortDesc: 'Configuração milimétrica de corte: espessura da serra (kerf), refilo perimetral, gestão de fitas de borda e caderno de notas do projeto.',
    icon: 'precision_manufacturing',
    iconColor: 'text-sky-600',
    badge: 'Precisão de Fabricação',
    steps: [
      'Antes de enviar os planos para corte, ajuste os parâmetros de fabricação no Otimizador ou nas Configurações do Projeto:',
      '• Espessura da Serra (Kerf): Defina a largura real do dente da serra da sua esquadrejadeira ou seccionadora (padrão 3,2 mm a 4,0 mm). O otimizador desconta essa espessura em cada passada para que as peças não fiquem menores.',
      '• Refilo Perimetral (Trim Margin): Estipule o corte de limpeza das bordas da chapa (ex.: 10 mm por lado) para retirar áreas lascadas ou danificadas pelo transporte.',
      '• Fitas de Borda (Fita Fina 0,45 mm vs Fita Grossa 2,0 mm): Indique as bordas que receberão acabamento (L1, L2, LARG1, LARG2). A espessura da fita grossa é descontada das dimensões de corte.',
      '• Caderno de Notas e Checklist: Abra o painel de anotações na barra superior para registrar observações da obra, lista de ferramentas e pedidos especiais do cliente.'
    ],
    tips: [
      'Caso terceirize o corte em centros de distribuição de chapas (ex.: Leo Madeiras, Duratex, Berneck), solicite o kerf da máquina deles (usualmente 4,0 mm ou 4,4 mm) para obter planos 100% idênticos.',
      'O cálculo de metragem linear separa fita fina de grossa para facilitar a compra de rolos na medida exata.'
    ],
    technicalDetails: [
      { label: 'Faixa de Kerf da serra', value: '1,0 mm a 6,0 mm (Padrão recomendado: 4,0 mm)' },
      { label: 'Refilo perimetral', value: '0 mm a 30 mm por borda (Padrão: 10 mm)' },
      { label: 'Compensação de bordas', value: 'Desconto automático de borda grossa (2 mm) na lista de corte' },
      { label: 'Caderno de notas', value: 'Sincronizado na nuvem com salvamento em tempo real' }
    ]
  },

  // 16. GUIA 16: Otimização de Corte 2D, Listagem e Desconto de Fita de Borda
  {
    id: 'optimizador_despiece',
    category: 'optimizador',
    title: 'Otimização de Corte 2D, Listagem e Desconto de Fita de Borda',
    shortDesc: 'Algoritmo guilhotina de máximo aproveitamento de chapas com respeito ao veio da madeira, refilo e compensação de bordas.',
    icon: 'precision_manufacturing',
    iconColor: 'text-sky-600',
    badge: 'Economia de Material',
    steps: [
      'Acesse a aba "3. Otimizador 2D" na barra superior.',
      'Defina as dimensões da chapa comercial (ex.: 2750 × 1850 mm ou 2440 × 1830 mm) e a espessura da serra (Kerf = 4 mm padrão).',
      'Defina a margem de refilo perimetral da chapa (ex.: 10 mm) para esquadrejar os cantos.',
      'Ative a opção "Descontar Fita de Borda no Corte" se for aplicar borda rígida de PVC de 2 mm.',
      'O algoritmo calculará os cortes respeitando a direção do veio longitudinal ou transversal dos padrões amadeirados e minimizando sobras de chapa.',
      'Gere o relatório com a porcentagem de aproveitamento, metragem linear de fita de borda e diagrama de corte com identificação de cada peça.',
      'Clique em "Exportar Planta 2D Técnica" para baixar o arquivo PDF pronto para produção.'
    ],
    tips: [
      'Você pode imprimir etiquetas adesivas para cada peça com o nome do armário, medidas finais de corte e indicação de bordas com fita.',
      'O algoritmo Guilhotina 2D gera padrões de corte de ponta a ponta adequados tanto para esquadrejadeiras manuais quanto para seccionadoras automáticas.'
    ],
    technicalDetails: [
      { label: 'Algoritmo', value: 'Guilhotina 2D com controle rigoroso de veio da madeira' },
      { label: 'Parâmetros', value: 'Espessura da serra (0-10 mm), Refilo (0-25 mm)' },
      { label: 'Desconto de Bordas', value: '0,45 mm e 2,0 mm nas bordas configuradas' }
    ]
  },

  // 17. GUIA 17: Guia Rápido de Atalhos de Teclado
  {
    id: 'atajos_teclado',
    category: 'atajos',
    title: 'Guia Rápido de Atalhos de Teclado',
    shortDesc: 'Trabalhe com máxima agilidade usando atalhos diretos sem colisões para selecionar, girar, mover, medir e transformar peças.',
    icon: 'keyboard',
    iconColor: 'text-emerald-600',
    badge: 'Produtividade',
    steps: [
      '• [ V ] ou [ Barra de Espaço ]: Ferramenta Selecionar peças (Shift + Clique para adicionar/remover peças ou módulos)',
      '• [ Shift + Arrastar ]: Janela de Seleção Múltipla. Congela a câmera e seleciona múltiplos móveis ou painéis em bloco',
      '• [ Shift + Clique ]: Adicionar ou remover peças da seleção atual',
      '• [ M ]: Ferramenta Mover (translação no espaço 3D para posicionar módulos ou peças)',
      '• [ R ] / [ Q ]: Girar 90° em bloco a peça, gaveta ou módulos selecionados (ao redor de seu centroide comum)',
      '• [ T ]: Fita Métrica 3D com atração magnética a vértices e arestas',
      '• [ Z ]: Centralizar e reiniciar a visualização de câmera na oficina 3D',
      '• [ W ] / [ S ]: Elevar ou descer a peça selecionada no eixo vertical Y (+/-10 mm)',
      '• [ Setas do Teclado ]: Deslocamento milimétrico da seleção em bloco (1 mm ou 10 mm com Shift)',
      '• [ G ]: Exibir ou ocultar Guias Espaciais e o Manequim de Escala Humana de 1,72 m',
      '• [ H ] / [ Alt + H ]: Ocultar temporariamente a seleção ou exibir todas as peças ocultas',
      '• [ Delete / Backspace ]: Excluir imediatamente as peças ou gabinetes selecionados',
      '• [ Ctrl + Z ] / [ Cmd + Z ]: Desfazer última ação (Undo)',
      '• [ Ctrl + Y ] / [ Cmd + Shift + Z ]: Refazer ação desfeita (Redo)',
      '• [ Esc ]: Cancelar ferramenta ativa, limpar seleção atual ou fechar janelas modais'
    ],
    tips: [
      'Seleção Múltipla em Bloco: Segure [ Shift ] e arraste com o botão esquerdo do mouse no visor 3D. A caixa de seleção capturará todos os módulos que tocar, sem girar a câmera.',
      'Atalho [ R ] exclusivo para GIRAR: ao pressionar R com um módulo ou gaveta selecionada, ele gira 90° imediatamente sem trocar a ferramenta ativa.',
      'A barra de espaço ou tecla [ V ] retorna instantaneamente à ferramenta de seleção padrão.'
    ],
    technicalDetails: [
      { label: 'Caixa de Seleção 3D', value: 'Shift + Arraste de mouse' },
      { label: 'Adicionar à Seleção', value: 'Shift + Clique na peça' },
      { label: 'Rotação 90°', value: 'Tecla [ R ] ou [ Q ] (módulo ou seleção)' },
      { label: 'Ferramenta Mover', value: 'Tecla [ M ]' },
      { label: 'Fita Métrica', value: 'Tecla [ T ]' },
      { label: 'Selecionar', value: 'Teclas [ V ] ou [ Espaço ]' },
      { label: 'Centralizar Câmera', value: 'Tecla [ Z ]' },
      { label: 'Escala Humana', value: 'Tecla [ G ]' }
    ]
  }
];

/* ==========================================================================
   FRANÇAIS (FR)
   ========================================================================== */

export const DOC_ARTICLES_FR: DocArticle[] = [
  // 1. GUIDE 1: Conception Paramétrique par Espaces
  {
    id: 'diseno_parametrico_ambientes',
    category: 'modulos_piezas',
    title: 'Conception Paramétrique par Espaces (Cuisines, Dressings, Bains et Bureau)',
    shortDesc: 'Configurez des meubles sur mesure dans 4 gammes spécialisées avec distribution intérieure intelligente des portes, tiroirs, étagères et plinthes sans déformation.',
    icon: 'view_in_ar',
    iconColor: 'text-sky-600',
    badge: 'Moteur Paramétrique',
    steps: [
      'En Zone 1 (Barre Supérieure), sélectionnez la gamme d\'espace de travail : Cuisines, Dressings, Salles de bain ou Bureau / Salon.',
      'Cliquez sur le bouton "+ Module" pour ouvrir l\'Assistant et le Catalogue de Gabarits Paramétriques avec des caissons préconfigurés (meubles bas, hauts, d\'angle, armoires avec penderies, meubles vasques suspendus avec découpe siphon ou bureaux).',
      'Insérez le meuble en choisissant "Ajouter à l\'atelier" pour composer des ensembles complets ou "Remplacer l\'actuel".',
      'Dans l\'Inspecteur Contextuel (Zone 3 Droite), ajustez en millimètres la Largeur, la Hauteur, la Profondeur et l\'Épaisseur de panneau (15 mm ou 18 mm). Le meuble recalcule automatiquement tous ses composants en respectant les jeux d\'assemblage.',
      'Dans la section "Distribution Intérieure et Façades", ajoutez ou configurez portes (battantes, doubles ou relevables à vérin à gaz), blocs-tiroirs (1 à 4 tiroirs avec coulisses télescopiques automatiques), étagères et tringles de penderie.',
      'Définissez la base du meuble : Avec Plinthe, Suspendu/Mural (avec Hauteur Y réglable) ou Posé au sol.'
    ],
    tips: [
      'Utilisez le bouton "Dupliquer sur le Côté (+X)" dans l\'inspecteur pour créer des enfilades de caissons parfaitement alignées sans jeu millimétrique.',
      'Modifier le matériau principal du module met à jour tous les panneaux associés instantanément en conservant le sens du fil du mélaminé.'
    ],
    technicalDetails: [
      { label: 'Gammes d\'Espaces', value: 'Cuisines, Dressings, Salles de bain et Bureau / Salon' },
      { label: 'Épaisseurs Supportées', value: '15 mm et 18 mm (synchronisées avec l\'optimiseur 2D)' },
      { label: 'Distribution Intérieure', value: 'Portes battantes/relevables, tiroirs, étagères et penderies' },
      { label: 'Configuration de Base', value: 'Plinthe, suspendu/mural ou direct au sol' }
    ]
  },

  // 2. GUIDE 2: Ajustement d'Étagères sur Rail Vertical et Édition Directe des "Espaces Libres" 3D
  {
    id: 'ajuste_repisas_luz_interna',
    category: 'cotas_luz',
    title: 'Ajustement d\'Étagères sur Rail Vertical et Édition Directe des "Espaces Libres" 3D',
    shortDesc: 'Visualisation en temps réel des espaces utiles intérieurs, déplacement sur rail vertical anti-collision, centrage automatique et édition par clic direct sur la cote 3D.',
    icon: 'straighten',
    iconColor: 'text-emerald-500',
    badge: 'Cotes HD 3D',
    steps: [
      'Cliquez sur n\'importe quelle étagère ou séparateur intérieur dans le visualiseur 3D : les cotes d\'Espace Libre Supérieur, Espace Libre Inférieur et Largeur Utile s\'affichent aussitôt en vert émeraude avec l\'étiquette ↕ XXX mm.',
      'Édition Directe dans l\'Espace 3D : Cliquez du bouton gauche directement sur l\'étiquette millimétrique flottante dans la scène 3D. Un champ numérique apparaît : saisissez la distance souhaitée (ex. : 250) et appuyez sur [ Entrée ]. L\'étagère se repositionne instantanément.',
      'Glissement sur Rail Vertical Anti-Collision : Maintenez le clic enfoncé sur l\'étagère et faites-la glisser vers le haut ou le bas le long de l\'axe Y. Le moteur bride le mouvement strictement à la verticale et empêche les collisions avec le sol, le plafond ou les autres tablettes (marge de sécurité minGap = 40 mm).',
      'Réglage Numérique dans l\'Inspecteur Droit : Dans le panneau inspecteur, section "Position de l\'Étagère (Espace Libre)", saisissez des valeurs exactes dans "Espace Inférieur" ou "Espace Supérieur".',
      'Centrage Automatique dans la Baie : Cliquez sur le bouton "Centrer dans la Baie" pour équilibrer symétriquement les hauteurs supérieure et inférieure en une seule opération.'
    ],
    tips: [
      'En dupliquant une étagère via le bouton Dupliquer, le système calcule l\'espace résiduel et positionne le nouveau panneau automatiquement centré sans chevaucher les éléments voisins.',
      'La cote horizontale de Largeur Utile permet de vérifier instantanément si des bacs ou de la vaisselle rentrent dans le meuble sans calcul manuel d\'épaisseur des montants.'
    ],
    technicalDetails: [
      { label: 'Déplacement', value: 'Rail vertical anti-collision avec marge de sécurité (40 mm)' },
      { label: 'Édition Directe 3D', value: 'Sprite interactif Three.js avec saisie numérique immédiate' },
      { label: 'Calcul d\'Espace', value: 'Déduit l\'épaisseur des panneaux (hauteur libre réelle)' },
      { label: 'Centrage Automatique', value: 'Algorithme symétrique par rapport aux obstacles haut et bas' }
    ]
  },

  // 3. GUIDE 3: Devis Multi-Devises en Temps Réel et Déduction de Chant
  {
    id: 'presupuesto_multimoneda_tapacanto',
    category: 'optimizador',
    title: 'Devis Multi-Devises en Temps Réel et Déduction de Chant',
    shortDesc: 'Chiffrage commercial automatique avec taux de change en direct (base COP vers USD, MXN, EUR), calcul réactif de quincaillerie et compensation de chant dans l\'optimiseur 2D.',
    icon: 'tag',
    iconColor: 'text-amber-500',
    badge: 'Finance & Débit',
    steps: [
      'Rendez-vous dans l\'onglet "4. Devis" de la barre de navigation supérieure.',
      'Sélecteur Multi-Devises en Direct : Choisissez la devise cible souhaitée (COP de référence, USD, MXN, EUR). Le système interroge les API de change en direct et convertit coûts unitaires et totaux avec mise en forme monétaire régionale.',
      'Décomposition des Coûts de Fabrication : Examinez le nombre de panneaux consommés calculé par l\'optimiseur 2D, les mètres linéaires de bande de chant mince (0,45 mm) et épaisse (2,0 mm), et la liste détaillée de la quincaillerie (vis, charnières et coulisses sans double comptage).',
      'Indiquez le pourcentage de main-d\'œuvre de l\'atelier, la marge bénéficiaire et les taxes pour générer le prix de vente final pour le client.',
      'Déduction de Chant au Débit (subtractEdgeBandingFromCut) : Dans l\'onglet "2. Débit" ou "3. Optimiseur 2D", cochez l\'option "Déduire le Chant au Débit".',
      'Lorsqu\'elle est activée, la scie déduit 0,45 mm ou 2,0 mm sur les chants désignés (L1, L2, LARG1, LARG2) de chaque pièce, garantissant ainsi qu\'après placage du chant à l\'atelier, le panneau mesure exactement la cote nominale requise.'
    ],
    tips: [
      'La déduction de chant est indispensable lors de l\'utilisation de chants épais en PVC de 2 mm sur les façades de tiroirs ou portes pour éviter tout frottement.',
      'Vous pouvez exporter le devis détaillé en PDF professionnel pour le remettre directement comme proposition commerciale aux clients.'
    ],
    technicalDetails: [
      { label: 'Devises Supportées', value: 'Devise de base COP convertible en USD, MXN, EUR avec taux en direct' },
      { label: 'Déduction de Chant', value: '0,45 mm (mince) et 2,0 mm (PVC rigide) sur L1/L2/LARG1/LARG2' },
      { label: 'Calcul Quincaillerie', value: 'Vis, tourillons, charnières et coulisses quantifiés par assemblage' },
      { label: 'Panneaux Requis', value: 'Liaison directe avec l\'algorithme de coupe Guillotine 2D' }
    ]
  },

  // 4. GUIDE 4: Exportation Modèle 3D (.DAE), Plans PDF et Notice de Montage RTA
  {
    id: 'exportacion_dae_pdf_armado',
    category: 'optimizador',
    title: 'Exportation Modèle 3D (.DAE), Plans PDF et Notice de Montage RTA',
    shortDesc: 'Générez des livrables industriels complets : modèle 3D COLLADA .DAE millimétrique universel, plans 2D cotés en PDF et notice interactive d\'assemblage pas à pas RTA.',
    icon: 'download',
    iconColor: 'text-sky-500',
    badge: 'Fabrication Industrielle',
    steps: [
      'Exportation Modèle 3D (.DAE) : Dans le menu supérieur, cliquez sur "Exporter" et choisissez "Exporter Modèle 3D (.DAE)". Le système compile un fichier COLLADA 1.4.1 à l\'échelle millimétrique (1 unité = 1 mm), avec hiérarchie des pièces groupées par caisson et orientation verticale Z_UP standard.',
      'Plans Techniques 2D en PDF : Dans le menu Exporter ou la vue de Débit, cliquez sur "Plan 2D Technique (PDF)". Téléchargez une fiche d\'atelier avec la nomenclature complète, les faces avec perçages CNC et les légendes d\'encollage de chant.',
      'Plans de Débit 2D des Panneaux : Dans l\'onglet "3. Optimiseur 2D", cliquez sur "Exporter Plans de Débit" pour imprimer le schéma de coupe guillotine avec numérotation des pièces, trait de scie (kerf) et étiquettes à code-barres.',
      'Notice de Montage RTA Pas à Pas : Cliquez sur "Guide de Montage" pour ouvrir le livret d\'assemblage étape par étape. Visualisez l\'assemblage isométrique phase par phase de chaque caisson avec nomenclature de visserie par étape.'
    ],
    tips: [
      'Le fichier .DAE exporté préserve les textures et la géométrie groupée prête pour la visualisation et le rendu 3D sans module d\'extension.',
      'Le livret de montage RTA peut être imprimé ou partagé numériquement pour faciliter l\'installation sur chantier sans erreur de sens des pièces.'
    ],
    technicalDetails: [
      { label: 'Format 3D', value: 'COLLADA 1.4.1 (.DAE) universel avec coordonnées en millimètres' },
      { label: 'Échelle d\'Export', value: 'Millimétrique 1:1 avec hiérarchies 3D organisées' },
      { label: 'Documents PDF', value: 'Fiches techniques cotées, schémas de débit 2D et étiquettes' },
      { label: 'Manuel RTA', value: 'Séquence isométrique 2D avec nomenclature détaillée de quincaillerie' }
    ]
  },

  // 5. GUIDE 5: Guide d'Échelle Humaine 1,72 m et Boussole Cardinale (+Z)
  {
    id: 'escala_humana_brujula',
    category: 'herramientas_3d',
    title: 'Guide d\'Échelle Humaine 1,72 m et Boussole Cardinale (+Z)',
    shortDesc: 'Mannequin architectural à l\'échelle réelle (1720 mm) avec règle ergonomique verticale et repères au sol pour vérifier les hauteurs de travail.',
    icon: 'human',
    iconColor: 'text-sky-500',
    badge: 'Ergonomie CAO',
    steps: [
      'Dans le visualiseur 3D se trouve le mannequin architectural stylisé à taille humaine réelle (1720 mm / 1,72 m) placé sur le sol de l\'atelier.',
      'La silhouette intègre une règle millimétrique verticale marquant les repères anthropométriques clés : plinthe (100 mm), plan de travail (900 mm), crédence (1450 mm) et niveau du regard (1600-1720 mm).',
      'Au sol, le cadre perimetrique d\'atelier de 5000 × 5000 mm affiche des repères haute visibilité : en bleu "▲ FACE (+Z) · VUE PRINCIPALE", et en gris "▼ ARRIÈRE (-Z)", "► GAUCHE (-X)" et "◄ DROITE (+X)".',
      'Pour déplacer le mannequin : cliquez sur son socle ou son corps dans la scène 3D et faites-le glisser avec la souris vers la zone à comparer avec votre mobilier.',
      'Pour masquer ou afficher le guide humain et les repères cardinaux, cliquez sur l\'icône de personnage dans la barre d\'outils ou utilisez le raccourci clavier [ G ].'
    ],
    tips: [
      'Utilisez le mannequin lors de la conception de meubles hauts pour vérifier si l\'utilisateur pourra atteindre les étagères supérieures sans escabeau.',
      'Le repère "FACE (+Z)" vous garantit que portes et façades de tiroirs ne seront jamais modélisées vers l\'arrière.',
      'Le personnage est un guide visuel exclusif : il n\'apparaît ni dans le calepinage de débit ni dans les exports CNC.'
    ],
    technicalDetails: [
      { label: 'Stature Standard', value: '1720 mm (1,72 m) proportion ergonomique' },
      { label: 'Repères au Sol', value: 'FACE (+Z), ARRIÈRE (-Z), GAUCHE (-X), DROITE (+X)' },
      { label: 'Interaction', value: 'Glissement libre sur le plan XZ du sol à la souris' },
      { label: 'Visibilité', value: 'Commutable par bouton d\'outils ou raccourci clavier [ G ]' }
    ]
  },

  // 6. GUIDE 6: Verrouiller / Figer Pièces et Modules
  {
    id: 'bloqueo_congelar_piezas',
    category: 'herramientas_3d',
    title: 'Verrouiller / Figer Pièces et Modules',
    shortDesc: 'Verrouillez des panneaux individuels ou des modules complets contre les déplacements involontaires, modifications ou suppressions.',
    icon: 'lock',
    iconColor: 'text-amber-500',
    badge: 'Protection de Conception',
    steps: [
      'Sélectionnez la pièce ou le caisson que vous souhaitez sécuriser dans le visualiseur 3D.',
      'Vous pouvez figer l\'élément de deux manières rapides :',
      '• Menu Contextuel (Clic Droit) : Faites un clic droit sur la pièce et choisissez "Figer Uniquement Cette Pièce" ou "Figer le Module Complet / Tiroir Complet".',
      '• Barre Contextuelle Supérieure : Cliquez sur le bouton avec l\'icône de cadenas.',
      'Une fois figée, la pièce affiche une étiquette ambrée avec la mention [ Verrouillé ].',
      'L\'élément verrouillé est totalement protégé : il ne peut être déplacé à la souris ni supprimé avec la touche Suppr.',
      'Pour déverrouiller, faites un clic droit sur l\'élément et sélectionnez "Débloquer", ou recliquez sur l\'icône de cadenas en haut.'
    ],
    tips: [
      'Figez les côtés et la base de votre meuble dès que les dimensions principales sont calées ; vous pourrez ainsi ajuster étagères et tiroirs sans bouger la structure extérieure.',
      'Figer un tiroir complet protège façade, côtés, fond, dos et coulisses en un seul clic.',
      'Les pièces verrouillées continuent d\'apparaître normalement dans la liste de débit et le devis.'
    ],
    technicalDetails: [
      { label: 'Portée', value: 'Pièce individuelle (part.isLocked) ou Groupe (group.isLocked)' },
      { label: 'Effet', value: 'Désactive translation, glisser, rotation et suppression' },
      { label: 'Indicateur', value: 'Badge visuel ambré dans la 3D et les listes' },
      { label: 'Persistance', value: 'Enregistré dans le cloud et l\'export JSON du projet' }
    ]
  },

  // 7. GUIDE 7: Menu Contextuel Intelligent par Clic Droit
  {
    id: 'menu_contextual_inteligente',
    category: 'herramientas_3d',
    title: 'Menu Contextuel Intelligent par Clic Droit',
    shortDesc: 'Menu contextuel 3D adaptatif dont les options changent selon que vous cliquez sur un Tiroir, une Porte, un Panneau Structurel ou l\'Espace Vide.',
    icon: 'mouse',
    iconColor: 'text-sky-600',
    badge: 'Productivité 3D',
    steps: [
      'Faites un clic droit avec la souris n\'importe où dans le visualiseur 3D.',
      'Le menu analyse automatiquement le composant sous le curseur et propose des actions adaptées :',
      '• Clic sur Tiroir : Test immédiat d\'ouverture/fermeture des coulisses, figer le tiroir, dupliquer, modifier la poignée ou isoler la façade.',
      '• Clic sur Porte : Inverser charnière réversible (Gauche / Droite), ouvrir/fermer le battant, changer de modèle de poignée ou verrouiller.',
      '• Clic sur Panneau de Meuble : Rotation 90°, basculer l\'orientation (Horizontale / Verticale), dupliquer, figer ou supprimer.',
      '• Clic au Sol ou Espace Vide : Accès rapide pour insérer un panneau libre, afficher le mannequin humain, centrer la caméra ou réinitialiser la vue.',
      'Pour fermer le menu contextuel, cliquez simplement avec le bouton gauche dans l\'espace vide ou appuyez sur [ Échap ].'
    ],
    tips: [
      'Le menu contextuel évite de chercher des options dans les panneaux latéraux : les commandes fréquentes sont sous votre curseur.',
      'Si plusieurs pièces sont sélectionnées avec Shift + Clic, le menu proposera des actions de groupe (comme Grouper ou Figer la Sélection).'
    ],
    technicalDetails: [
      { label: 'Détection Raycaster', value: 'Détection de collision 3D aux coordonnées exactes du curseur' },
      { label: 'Modes Contextuels', value: 'Tiroir, Porte, Panneau structurel et Espace vide' },
      { label: 'Animations', value: 'Pivotement de charnière et coulissement de tiroir en temps réel' }
    ]
  },

  // 8. GUIDE 8: Pièce 3D et Équipements
  {
    id: 'habitacion_equipos_3d',
    category: 'herramientas_3d',
    title: 'Pièce 3D et Équipements',
    shortDesc: 'Environnement réaliste d\'atelier ou de pièce avec murs et sol personnalisables, et insertion d\'électroménagers standardisés dans l\'inspecteur à 3 zones.',
    icon: 'room',
    iconColor: 'text-emerald-500',
    badge: 'Visualisation et Décor',
    steps: [
      'En Zone 1 (Barre Supérieure), activez le Mode Pièce pour afficher les murs d\'enceinte et le sol architectural avec dimensions et finitions réglables.',
      'Cliquez sur le bouton "+ Équipement 3D" dans la barre supérieure ou accédez à l\'onglet "Équipements" de l\'Inspecteur Droit (Zone 3).',
      'Parcourez le catalogue d\'appareils électroménagers standardisés : réfrigérateurs simples ou américains, fours encastrables, micro-ondes, hottes, éviers en inox et lave-vaisselle.',
      'Insérez l\'équipement souhaité dans la scène 3D et faites-le glisser directement dans la niche du caisson prévu.',
      'Dans l\'Inspecteur Droit, réglez l\'élévation Y, la rotation et vérifiez que les jeux d\'encastrement et d\'aération répondent aux normes du fabricant.',
      'Utilisez le bouton de verrouillage pour figer la position de l\'électroménager une fois encastré.'
    ],
    tips: [
      'Lors de la conception d\'un sous-évier, placez l\'évier 3D sur le plan de travail pour visualiser la découpe d\'encastrement et éviter les interférences avec le siphon.',
      'Les appareils électroménagers sont des éléments de repérage visuel et ne génèrent aucun panneau dans le plan de débit 2D.'
    ],
    technicalDetails: [
      { label: 'Catalogue Équipements', value: 'Réfrigérateur, Four, Micro-ondes, Évier, Hotte, Lave-vaisselle' },
      { label: 'Murs et Sol', value: 'Cotes millimétriques et textures carrelage/bois' },
      { label: 'Tolérances d\'Encastrement', value: 'Contrôle visuel des niches et des jeux de ventilation' },
      { label: 'Intégration', value: 'Positionnement en 3 zones et inspecteur de propriétés' }
    ]
  },

  // 9. GUIDE 9: Déplacement par Glisser Direct 3D et Rail Vertical
  {
    id: 'movimiento_directo_3d',
    category: 'herramientas_3d',
    title: 'Déplacement par Glisser Direct 3D et Rail Vertical',
    shortDesc: 'Déplacez pièces ou modules d\'un clic glissé direct sur n\'importe quelle face, avec guidage planaire et rail vertical anti-collision.',
    icon: 'pan_tool',
    iconColor: 'text-sky-600',
    badge: 'Interaction Naturelle',
    steps: [
      'Cliquez avec le bouton gauche sur n\'importe quelle pièce ou module dans le visualiseur 3D.',
      'Le curseur passe en main ouverte au survol de l\'élément, puis en main fermée lors du clic maintenu.',
      'Faites glisser doucement avec la souris : le moteur contraint le déplacement au plan coplanaire ou sur rail vertical pour les étagères intérieures.',
      'Si la pièce appartient à un sous-ensemble (ex. : un tiroir avec façade, côtés, dos et fond), tous les éléments se déplacent solidairement.',
      'Pour des réglages de précision, utilisez les flèches du clavier (1 mm par pression, ou 10 mm en maintenant Shift).',
      'Pour redimensionner un panneau sélectionné, utilisez les poignées cubiques de contour ou les champs de l\'Inspecteur Droit.'
    ],
    tips: [
      'Pour monter ou descendre rapidement une pièce selon l\'axe vertical (Y), utilisez les touches [ W ] (+10 mm) et [ S ] (-10 mm).',
      'Pour annuler un déplacement involontaire, appuyez immédiatement sur [ Ctrl + Z ].'
    ],
    technicalDetails: [
      { label: 'Méthode de Glisser', value: 'Clic maintenu direct sur la géométrie avec projection CAO' },
      { label: 'Mouvement Modulaire', value: 'Synchronisation par identifiant de caisson ou groupe' },
      { label: 'Micro-Ajustement', value: 'Pas précis de 1 mm / 10 mm avec les touches fléchées' },
      { label: 'Annuler / Rétablir', value: 'Historique complet via [ Ctrl + Z ] / [ Ctrl + Y ]' }
    ]
  },

  // 10. GUIDE 10: Barre Contextuelle d\'Actions et Barre Supérieure
  {
    id: 'cinta_acciones_flotante',
    category: 'herramientas_3d',
    title: 'Barre Contextuelle d\'Actions et Barre Supérieure',
    shortDesc: 'Barre contextuelle flottante pour dupliquer, pivoter de 90°, changer l\'orientation, verrouiller et gérer les finitions en lot.',
    icon: 'dashboard_customize',
    iconColor: 'text-emerald-600',
    badge: 'Barre Supérieure',
    steps: [
      'Lors de la sélection d\'un panneau ou d\'un meuble dans le visualiseur 3D, la barre flottante apparaît en haut du canevas.',
      'La barre indique le nombre de pièces sélectionnées et offre des boutons d\'action directe :',
      '• "Dupliquer" : Clone l\'élément sur le côté en conservant perçages et quincaillerie.',
      '• "Pivoter 90° [ R ]" : Fait tourner l\'élément de 90 degrés autour de son centre.',
      '• "Figer" : Verrouille ou libère la sélection contre les déplacements accidentels.',
      '• "Déplacer" : Bascule vers l\'outil de translation rapide.',
      '• "Nuancier Mélaminé" : Ouvre le sélecteur de finitions pour appliquer un décor à toutes les pièces sélectionnées à la fois.',
      '• "Supprimer [ Suppr ]" : Efface les éléments sélectionnés du projet.',
      'Dans le coin supérieur gauche, un cartouche affiche le nom de la pièce et ses cotes (L × l × É).'
    ],
    tips: [
      'La barre n\'apparaît qu\'en présence d\'une sélection active, préservant la clarté du champ de vision pendant la rotation de caméra.',
      'Vous pouvez appuyer sur la touche [ R ] à tout moment pour pivoter de 90° sans devoir cliquer sur le bouton.'
    ],
    technicalDetails: [
      { label: 'Visibilité', value: 'Contextuelle réactive (visible uniquement avec sélection active)' },
      { label: 'Opérations Groupées', value: 'Dupliquer, Pivoter 90°, Figer, Déplacer, Matériaux et Supprimer' },
      { label: 'Raccourci Rotation', value: 'Touche [ R ] ou [ Q ]' },
      { label: 'Raccourci Suppression', value: 'Touche [ Suppr ] ou [ Retour arrière ]' }
    ]
  },

  // 11. GUIDE 11: Sélection Multiple avec Shift et Édition Groupée
  {
    id: 'seleccion_multiple_shift',
    category: 'modulos_piezas',
    title: 'Sélection Multiple avec Shift et Édition Groupée',
    shortDesc: 'Capturez plusieurs meubles et panneaux par zone de sélection ou Shift + Clic pour pivoter, déplacer, dupliquer et changer de mélaminé en lot.',
    icon: 'format_shapes',
    iconColor: 'text-sky-600',
    badge: 'Édition Groupée',
    steps: [
      'Cadre de Sélection Multiple : Maintenez enfoncée la touche [ Shift ] et tracez un rectangle au clic gauche sur le canevas 3D. Une boîte translucide capturera tous les meubles et panneaux touchés, sans faire pivoter la caméra.',
      'Sélection Cumulative par Clic : Maintenez [ Shift ] et cliquez sur des panneaux ou caissons individuels pour les ajouter ou les retirer de la sélection.',
      'Compteur Contextuel : Observez le badge supérieur indiquant le nombre de pièces sélectionnées (ex. : "8 pièces sélectionnées").',
      'Rotation Groupée : Appuyez sur [ R ] pour faire pivoter de 90° tous les composants sélectionnés autour de leur barycentre commun sans déformer leurs espacements relatifs.',
      'Application de Décor en Lot : Choisissez un matériau dans la palette pour changer la couleur ou texture de tous les panneaux sélectionnés simultanément.',
      'Pour tout désélectionner, cliquez sur le sol vide ou appuyez sur [ Échap ].'
    ],
    tips: [
      'Lorsque plusieurs modules sont sélectionnés, les cotes de dimension individuelles sont masquées automatiquement pour préserver la lisibilité de la scène.',
      'Dupliquez une rangée entière de caissons avec Shift pour monter une cuisine complète en quelques secondes.'
    ],
    technicalDetails: [
      { label: 'Cadre de Sélection', value: 'Shift + Glisser souris (bloque la rotation de la caméra)' },
      { label: 'Sélection Cumulative', value: 'Shift + Clic sur pièce ou module' },
      { label: 'Rotation Collective', value: 'Calcul du centre de gravité commun pour pivotement symétrique 90°' },
      { label: 'Propriétés Groupées', value: 'Matériaux, textures, duplication et verrouillage' }
    ]
  },

  // 12. GUIDE 12: Découpes Spéciales, Chanfreins et Découpe Siphon en U
  {
    id: 'cortes_especiales_sifon',
    category: 'modulos_piezas',
    title: 'Découpes Spéciales, Chanfreins et Découpe Siphon en U',
    shortDesc: 'Usinages avancés pour plans de travail et vasques : découpes en L pour poteaux, chanfreins à 45°, découpes biaises et découpe siphon en U paramétrique.',
    icon: 'scissors',
    iconColor: 'text-amber-600',
    badge: 'Usinage Spécial',
    steps: [
      'Sélectionnez le plan de travail, dessus de meuble ou tablette à usiner dans le visualiseur 3D.',
      'Dans l\'Inspecteur Droit (Zone 3), ouvrez les sections "Découpes Spéciales et Coins" et "Découpe Siphon en U".',
      'Configurez le type d\'usinage selon les contraintes de pose :',
      '• Droit ou Rétrécissement : Ajustements de longueur pour insérer des plans entre murs non d\'équerre.',
      '• Chanfrein à 45° : Coins biseautés de protection pour plans d\'îlots ou zones de passage.',
      '• Coupe Biaise : Finitions angulaires pour meubles terminaux ou couloirs étroits.',
      '• Découpe en L (Poteau) : Évidement rectangulaire arrière pour contourner colonnes ou piliers porteurs.',
      'Découpe Siphon en U (Meubles de Salle de Bain) : Dans les tiroirs supérieurs sous vasque, cochez l\'option "Découpe Siphon en U". Renseignez la largeur et la profondeur de l\'échancrure pour laisser passer le siphon sans condamner les rangements latéraux.',
      'À l\'export DXF CNC ou PDF d\'atelier, les découpes spéciales sont transcrites en polylignes fermées LWPOLYLINE cotées au millimètre.'
    ],
    tips: [
      'La découpe siphon en U calcule automatiquement les joues intérieures du tiroir pour masquer et border les chants exposés autour de la tuyauterie.',
      'Les chanfreins à 45° sur les plans réduisent les risques de chocs et blessures chez les jeunes enfants.'
    ],
    technicalDetails: [
      { label: 'Types d\'Usinages', value: 'Droit, Chanfrein 45°, Biais, Évidement en L et Siphon en U' },
      { label: 'Usage Sanitaire', value: 'Découpe paramétrique pour évacuation et siphon de lavabo' },
      { label: 'Export DXF', value: 'Polylignes fermées LWPOLYLINE dans un calque dédié' },
      { label: 'Plans PDF', value: 'Cotes automatiques de rayons, chanfreins et évidements' }
    ]
  },

  // 13. GUIDE 13: Usinages et Perçages CNC Automatiques
  {
    id: 'mecanizados_cnc',
    category: 'mecanizados',
    title: 'Usinages et Perçages CNC Automatiques',
    shortDesc: 'Calcul automatique par le moteur intelligent des vis d\'assemblage, tourillons et charnières par analyse des jonctions de panneaux.',
    icon: 'adjust',
    iconColor: 'text-sky-600',
    badge: 'Calcul Intelligent',
    steps: [
      'Le système analyse toutes les surfaces de contact et recouvrements entre panneaux adjacents (côtés avec fond, dessus, tablettes fixes ou séparateurs).',
      'Il identifie l\'orientation de l\'assemblage (aboutement à angle droit de 90° ou battants de portes).',
      'Il calcule les coordonnées exactes de perçage selon les règles professionnelles de menuiserie :',
      '• Vis d\'assemblage (Cyan) : Perçage débouchant de Ø 4 mm sur la face extérieure et avant-trou de Ø 3 mm × 30 mm dans le chant du panneau perpendiculaire, à 50 mm et 100 mm de chaque bord.',
      '• Tourillons en bois (Ambre) : Trous borgnes de Ø 8 mm × 15 mm dans les deux faces en regard pour assemblage invisible sans vis apparentes.',
      '• Boîtiers de charnières (Violet) : Sur les portes battantes, calcul automatique des perçages Ø 35 mm × 12,5 mm à 100 mm des arêtes haute et basse, avec cote de boîtier au chant K = 4 mm.',
      'Pour afficher les perçages dans la scène 3D, activez le bouton d\'usinage (icône de mèche) dans la barre d\'outils.',
      'À l\'exportation DXF CNC, l\'ensemble de ces points est généré dans des calques vectoriels avec leurs diamètres et profondeurs pour centre d\'usinage.'
    ],
    tips: [
      'Les perçages sont recalculés automatiquement en temps réel à chaque redimensionnement de panneau ou changement d\'épaisseur.',
      'Dans le panneau "Propriétés de la Pièce", vous pouvez consulter la liste détaillée des coordonnées affectées au panneau sélectionné.',
      'Sur le plan technique 2D (PDF), chaque face est cotée pour permettre le pointage et perçage manuel avec gabarits en atelier.'
    ],
    technicalDetails: [
      { label: 'Vis d\'Assemblage', value: 'Ø 4 mm débouchant + Ø 3 mm avant-trou (Couleur Cyan)' },
      { label: 'Tourillons Bois', value: 'Ø 8 mm × 15 mm profondeur (Couleur Ambre)' },
      { label: 'Boîtier Charnière', value: 'Ø 35 mm × 12,5 mm (Couleur Violette, K = 4 mm)' },
      { label: 'Position des Bords', value: 'Espacement standard 50 mm / 100 mm des arêtes' },
      { label: 'Export CNC', value: 'Calques DXF CNC + Fiches d\'usinage cotées PDF' }
    ]
  },

  // 14. GUIDE 14: Charnières et Perçages Boîtier Ø35mm Réversibles Synchronisés
  {
    id: 'bisagras_reversibles',
    category: 'mecanizados',
    title: 'Charnières et Perçages Boîtier Ø35mm Réversibles Synchronisés',
    shortDesc: 'Sens d\'ouverture gauche ou droit avec repositionnement automatique des perçages et de la quincaillerie 3D.',
    icon: 'door_sliding',
    iconColor: 'text-sky-600',
    badge: 'Charnières Dynamiques',
    steps: [
      'Lors de la configuration d\'une porte battante dans l\'Inspecteur ou via le menu clic droit, sélectionnez le côté de ferrage : "Porte (Charnière Gauche)" ou "Porte (Charnière Droite)".',
      'Au changement de côté, la poignée 3D bascule sur le montant opposé et les charnières 3D se fixent sur le montant adéquat.',
      'Les perçages violets de boîtier Ø 35 mm × 12,5 mm sont instantanément recalculés sur le bord d\'articulation (à 22 mm du centre du trou, K = 4 mm).',
      'Lors du test de l\'animation d\'ouverture, les perçages de boîtier pivotent solidairement avec le vantail de porte.'
    ],
    tips: [
      'Cloner une porte battante gauche pour créer la droite d\'un meuble synchronise à la fois le rendu visuel 3D et la fiche technique de débit.',
      'La cote K = 4 mm est conforme aux standards des grandes marques de ferrures (Blum, Hettich, Grass, Salice).'
    ],
    technicalDetails: [
      { label: 'Standard Boîtier', value: 'Ø 35 mm × 12,5 mm de profondeur' },
      { label: 'Distance au Bord K', value: '4 mm au chant / 22 mm au centre du perçage' },
      { label: 'Synchronisation', value: 'Charnière 3D + Poignée + Perçage boîtier + Rotation animée' }
    ]
  },

  // 15. GUIDE 15: Paramètres d\'Atelier, Trait de Scie (Kerf), Chants et Carnet de Notes
  {
    id: 'parametros_taller_notas',
    category: 'optimizador',
    title: 'Paramètres d\'Atelier, Trait de Scie (Kerf), Chants et Carnet de Notes',
    shortDesc: 'Calibrage millimétrique de découpe : épaisseur de lame (kerf), surcôte de délignage, gestion des bandes de chant et carnet de notes.',
    icon: 'precision_manufacturing',
    iconColor: 'text-sky-600',
    badge: 'Précision de Fabrication',
    steps: [
      'Avant de lancer vos débits, calibrez les paramètres de coupe dans l\'Optimiseur ou dans les Paramètres du Projet :',
      '• Épaisseur de Lame (Kerf) : Définissez la largeur de coupe exacte de votre lame de scie (standard de 3,2 mm à 4,0 mm). L\'optimiseur retranchera cette matière à chaque passe pour éviter des pièces sous-dimensionnées.',
      '• Délignage Périphérique (Trim Margin) : Fixez la surcôte de nettoyage périphérique du panneau (ex. : 10 mm par côté) pour éliminer les bords abîmés pendant le transport.',
      '• Bandes de Chant (Chant Mince 0,45 mm vs Chant Épais 2,0 mm) : Déterminez les chants à plaquer (L1, L2, LARG1, LARG2). L\'épaisseur du chant épais est déduite des cotes de coupe.',
      '• Carnet de Notes et Liste de Contrôle : Ouvrez le carnet depuis la barre supérieure pour consigner les exigences de chantier, consignes de pose et listes de vérification.'
    ],
    tips: [
      'Si vous sous-traitez le débit auprès d\'un distributeur de panneaux, demandez l\'épaisseur de leur trait de scie (souvent 4,0 mm ou 4,4 mm) pour obtenir des plans de coupe identiques.',
      'Le calcul du linéaire sépare chants minces et chants épais pour commander les rouleaux aux métrages exacts.'
    ],
    technicalDetails: [
      { label: 'Plage Kerf de Scie', value: '1,0 mm à 6,0 mm (Recommandé : 4,0 mm)' },
      { label: 'Délignage Périphérique', value: '0 mm à 30 mm par bord (Standard : 10 mm)' },
      { label: 'Compensation de Chant', value: 'Déduction automatique du chant épais (2 mm) sur la liste' },
      { label: 'Carnet de Notes', value: 'Synchronisé en temps réel avec sauvegarde dans le cloud' }
    ]
  },

  // 16. GUIDE 16: Optimisation de Débit 2D, Calepinage et Déduction de Chant
  {
    id: 'optimizador_despiece',
    category: 'optimizador',
    title: 'Optimisation de Débit 2D, Calepinage et Déduction de Chant',
    shortDesc: 'Algorithme guillotine 2D pour maximiser le rendement des panneaux avec respect du fil du bois, délignage et déduction des chants rigides.',
    icon: 'precision_manufacturing',
    iconColor: 'text-sky-600',
    badge: 'Économie de Matériau',
    steps: [
      'Ouvrez l\'onglet "3. Optimiseur 2D" dans la barre supérieure.',
      'Indiquez les dimensions du panneau commercial (ex. : 2800 × 2070 mm ou 2440 × 1830 mm) et l\'épaisseur de lame (Kerf = 4 mm standard).',
      'Définissez la marge de délignage périphérique (ex. : 10 mm) pour rafraîchir les chants d\'usine.',
      'Activez la case "Déduire le Chant au Débit" si vous utilisez du chant rigide en PVC de 2 mm.',
      'L\'algorithme organise les découpes en respectant le fil longitudinal ou transversal des panneaux et en minimisant les chutes.',
      'Obtenez le bilan chiffré : taux de rendement, métrage de chant et plan de calepinage avec numérotation de chaque pièce.',
      'Cliquez sur "Exporter Plan 2D Technique" pour générer le PDF prêt pour l\'atelier.'
    ],
    tips: [
      'Vous pouvez imprimer des étiquettes autocollantes pour chaque pièce comportant le nom du meuble, ses dimensions exactes et le schéma de placage des chants.',
      'L\'algorithme Guillotine 2D génère des découpes continues de bout en bout compatibles avec les scies à format manuelles et les scies à panneaux numériques.'
    ],
    technicalDetails: [
      { label: 'Algorithme', value: 'Guillotine 2D avec respect strict du fil du panneau' },
      { label: 'Paramètres', value: 'Trait de scie (0-10 mm), Délignage (0-25 mm)' },
      { label: 'Déduction Chants', value: '0,45 mm et 2,0 mm sur les côtés renseignés' }
    ]
  },

  // 17. GUIDE 17: Guide Rapide des Raccourcis Clavier
  {
    id: 'atajos_teclado',
    category: 'atajos',
    title: 'Guide Rapide des Raccourcis Clavier',
    shortDesc: 'Travaillez avec une agilité maximale grâce à des raccourcis sans conflit pour sélectionner, pivoter, déplacer, mesurer et transformer.',
    icon: 'keyboard',
    iconColor: 'text-emerald-600',
    badge: 'Productivité',
    steps: [
      '• [ V ] ou [ Barre d\'espace ] : Outil Sélectionner (Shift + Clic pour ajouter/retirer des pièces ou modules)',
      '• [ Shift + Glisser ] : Boîte de Sélection Multiple. Fige la caméra et sélectionne plusieurs caissons ou panneaux en groupe',
      '• [ Shift + Clic ] : Ajouter ou retirer des composants de la sélection courante',
      '• [ M ] : Outil Déplacer (translation dans l\'espace 3D pour positionner panneaux ou modules)',
      '• [ R ] / [ Q ] : Pivoter de 90° en bloc le panneau, le tiroir ou les modules sélectionnés (autour de leur barycentre commun)',
      '• [ T ] : Mètre Ruban 3D avec accrochage magnétique sur sommets et arêtes',
      '• [ Z ] : Centrer et réinitialiser la vue caméra dans l\'atelier 3D',
      '• [ W ] / [ S ] : Monter ou descendre la pièce sélectionnée sur l\'axe vertical Y (+/-10 mm)',
      '• [ Flèches du Clavier ] : Déplacement millimétrique de la sélection (1 mm ou 10 mm avec Shift)',
      '• [ G ] : Afficher ou masquer les repères d\'espace et le mannequin d\'échelle humaine de 1,72 m',
      '• [ H ] / [ Alt + H ] : Masquer temporairement la sélection ou réafficher toutes les pièces cachées',
      '• [ Suppr / Retour arrière ] : Supprimer immédiatement les panneaux ou meubles sélectionnés',
      '• [ Ctrl + Z ] / [ Cmd + Z ] : Annuler la dernière action (Undo)',
      '• [ Ctrl + Y ] / [ Cmd + Shift + Z ] : Rétablir l\'action annulée (Redo)',
      '• [ Échap ] : Annuler l\'outil actif, vider la sélection courante ou fermer les fenêtres modales'
    ],
    tips: [
      'Sélection Multiple Groupée : Maintenez [ Shift ] et tracez un rectangle avec le bouton gauche dans le visualiseur 3D. Le cadre capturera tous les meubles touchés sans faire tourner la scène.',
      'Touche [ R ] dédiée au PIVOTEMENT : presser R avec un meuble ou tiroir sélectionné le fait pivoter de 90° aussitôt sans quitter l\'outil en cours.',
      'La barre d\'espace ou la touche [ V ] vous ramène immédiatement à l\'outil de sélection standard.'
    ],
    technicalDetails: [
      { label: 'Cadre de Sélection 3D', value: 'Shift + Glisser souris' },
      { label: 'Ajout à la Sélection', value: 'Shift + Clic sur pièce' },
      { label: 'Rotation 90°', value: 'Touche [ R ] ou [ Q ] (module ou sélection)' },
      { label: 'Outil Déplacer', value: 'Touche [ M ]' },
      { label: 'Mètre Ruban', value: 'Touche [ T ]' },
      { label: 'Outil Sélectionner', value: 'Touches [ V ] ou [ Espace ]' },
      { label: 'Centrer Caméra', value: 'Touche [ Z ]' },
      { label: 'Échelle Humaine', value: 'Touche [ G ]' }
    ]
  }
];

/* ==========================================================================
   ITALIANO (IT)
   ========================================================================== */

export const DOC_ARTICLES_IT: DocArticle[] = [
  // 1. GUIDA 1: Progettazione Parametrica per Ambienti
  {
    id: 'diseno_parametrico_ambientes',
    category: 'modulos_piezas',
    title: 'Progettazione Parametrica per Ambienti (Cucine, Armadi, Bagni e Studio)',
    shortDesc: 'Configura mobili su misura in 4 linee specializzate con distribuzione interna intelligente di ante, cassetti, ripiani e zoccoli senza disallineamenti.',
    icon: 'view_in_ar',
    iconColor: 'text-sky-600',
    badge: 'Motore Parametrico',
    steps: [
      'Nella Zona 1 (Barra Superiore), seleziona la linea di ambiente desiderata: Cucine, Armadi, Bagni o Zona Giorno / Studio.',
      'Fai clic sul pulsante "+ Modulo" per aprire la Configurazione Guidata e il Catalogo Modelli Parametrici con moduli preconfigurati (basi, pensili, moduli ad angolo, guardaroba con tubi appendiabiti, mobili lavabo sospesi con scansasso per sifone o scrivanie).',
      'Inserisci il mobile selezionando "Aggiungi al laboratorio" per comporre arredi completi oppure "Sostituisci attuale".',
      'Nell\'Ispettore Contestuale (Zona 3 Destra), imposta in millimetri Larghezza, Altezza, Profondità e Spessore strutturale dei pannelli (15 mm o 18 mm). Il mobile ricalcola automaticamente tutti i suoi componenti rispettando i giochi di montaggio.',
      'Nella sezione "Distribuzione Interna e Frontali", aggiungi o rimuovi ante (a battente, doppie o a ribalta con pistone a gas), cassettiere (da 1 a 4 cassetti con guide telescopiche automatiche), ripiani e aste appendiabiti.',
      'Configura il basamento del mobile: Con Zoccolo (plinth), Sospeso/Mural (con elevazione Y regolabile) o In appoggio a terra.'
    ],
    tips: [
      'Usa il pulsante "Duplica a Lato (+X)" nell\'ispettore per formare file continue di basi o pensili perfettamente allineati a filo senza fessure.',
      'Modificando il materiale principale del modulo, tutti i pannelli associati si aggiornano simultaneamente mantenendo il corretto orientamento della venatura del nobilitato.'
    ],
    technicalDetails: [
      { label: 'Linee di Ambiente', value: 'Cucine, Armadiature, Bagni e Studio / Soggiorno' },
      { label: 'Spessori Supportati', value: '15 mm e 18 mm (sincronizzati con l\'ottimizzatore 2D)' },
      { label: 'Distribuzione Interna', value: 'Ante a battente/ribalta, cassetti, ripiani e appendiabiti' },
      { label: 'Configurazione Base', value: 'Zoccolo, sospeso/a parete o a pavimento' }
    ]
  },

  // 2. GUIDA 2: Regolazione Ripiani su Guida Verticale e Modifica Diretta "Luce Interna" 3D
  {
    id: 'ajuste_repisas_luz_interna',
    category: 'cotas_luz',
    title: 'Regolazione Ripiani su Guida Verticale e Modifica Diretta "Luce Interna" 3D',
    shortDesc: 'Visualizzazione in tempo reale delle distanze libere interne, spostamento su guida verticale anti-collisione, autocentraggio e modifica con clic diretto sulla quota 3D.',
    icon: 'straighten',
    iconColor: 'text-emerald-500',
    badge: 'Quote HD 3D',
    steps: [
      'Fai clic su qualsiasi ripiano o divisorio interno nel visualizzatore 3D: le quote di Luce Libera Superiore, Luce Libera Inferiore e Larghezza Utile verranno proiettate all\'istante in verde smeraldo con l\'etichetta ↕ XXX mm.',
      'Modifica Diretta nello Spazio 3D: Fai clic con il tasto sinistro direttamente sull\'etichetta millimetrica fluttuante nella scena 3D. Comparirà un campo numerico: digita il valore desiderato (es. 250) e premi [ Invio ]. Il ripiano si riposizionerà all\'istante.',
      'Trascinamento su Guida Verticale Anti-Collisione: Tieni premuto il clic sul ripiano e trascinalo verso l\'alto o verso il basso lungo l\'asse Y. Il motore confina il movimento rigorosamente in verticale ed evita collisioni con fondo, cappello o altri ripiani (margine di sicurezza minGap = 40 mm).',
      'Regolazione Numerica nell\'Ispettore Destro: Nel pannello ispettore, sezione "Posizione Ripiano (Luce Interna)", inserisci valori esatti in "Luce Inferiore" o "Luce Superiore".',
      'Autocentraggio nel Vano: Premi il pulsante "Centra nel Vano" per ripartire con perfetta simmetria le distanze superiore e inferiore in un solo clic.'
    ],
    tips: [
      'Duplicando un ripiano con il pulsante Duplica, il sistema calcola lo spazio residuo nel vano e posiziona il nuovo pezzo centrato senza sovrapporsi ai vicini.',
      'La quota orizzontale di Larghezza Utile consente di verificare all\'istante se scatole o stoviglie entrano nel vano senza dover sottrarre manualmente lo spessore dei fianchi.'
    ],
    technicalDetails: [
      { label: 'Movimento', value: 'Guida verticale anti-collisione con tolleranza di sicurezza (40 mm)' },
      { label: 'Modifica Diretta 3D', value: 'Sprite interattivo Three.js con input numerico istantaneo' },
      { label: 'Calcolo Luce', value: 'Detrae gli spessori dei pannelli (spazio utile interno reale)' },
      { label: 'Autocentraggio', value: 'Algoritmo simmetrico rispetto agli ostacoli superiore e inferiore' }
    ]
  },

  // 3. GUIDA 3: Preventivo Multivaluta in Tempo Reale e Detrazione Bordo
  {
    id: 'presupuesto_multimoneda_tapacanto',
    category: 'optimizador',
    title: 'Preventivo Multivaluta in Tempo Reale e Detrazione Bordo',
    shortDesc: 'Quotazione commerciale automatica con tasso di cambio in tempo reale (COP base in USD, MXN, EUR), calcolo reattivo ferramenta e compensazione bordo nell\'ottimizzatore 2D.',
    icon: 'tag',
    iconColor: 'text-amber-500',
    badge: 'Finanza & Taglio',
    steps: [
      'Vai alla scheda "4. Preventivo" nella barra di navigazione superiore.',
      'Selettore Multivaluta in Tempo Reale: Scegli la valuta in cui desideri calcolare i prezzi (COP di base, USD, MXN, EUR). Il sistema interroga API di cambio valuta live e converte costi unitari e totali con formattazione monetaria regionale.',
      'Dettaglio dei Costi di Fabbricazione: Consulta il consumo di pannelli calcolato dall\'ottimizzatore 2D, i metri lineari di bordo sottile (0,45 mm) e spesso (2,0 mm), e l\'elenco completo della ferramenta (viti, cerniere e guide senza doppi conteggi).',
      'Inserisci la percentuale di manodopera di falegnameria, il margine di profitto e le imposte per generare il prezzo finale di vendita al cliente.',
      'Detrazione Bordo al Taglio (subtractEdgeBandingFromCut): Nella scheda "2. Distinta" o "3. Ottimizzatore 2D", attiva la casella "Detrai Bordo al Taglio".',
      'Quando attiva, la sezionatrice detrae 0,45 mm o 2,0 mm dai bordi contrassegnati (L1, L2, LARG1, LARG2) di ciascun pannello, garantendo che dopo la bordatura in laboratorio il pezzo finale misuri esattamente la quota nominale richiesta dal progetto.'
    ],
    tips: [
      'La detrazione del bordo è essenziale quando si impiega bordo rigido in PVC da 2 mm su frontali di cassetti o ante, evitando sfregamenti dovuti a misure maggiorate.',
      'Puoi esportare il preventivo dettagliato in PDF professionale per presentarlo direttamente come proposta formale ai tuoi clienti.'
    ],
    technicalDetails: [
      { label: 'Valute Supportate', value: 'Valuta base COP convertibile in USD, MXN ed EUR con tassi live' },
      { label: 'Detrazione Bordo', value: '0,45 mm (sottile) e 2,0 mm (PVC rigido) su L1/L2/LARG1/LARG2' },
      { label: 'Calcolo Ferramenta', value: 'Viti, spine in legno, cerniere e guide calcolate per giunzione' },
      { label: 'Pannelli Richiesti', value: 'Collegamento diretto con l\'algoritmo di taglio Ghigliottina 2D' }
    ]
  },

  // 4. GUIDA 4: Esportazione Modello 3D (.DAE), Tavole PDF e Guida di Montaggio RTA
  {
    id: 'exportacion_dae_pdf_armado',
    category: 'optimizador',
    title: 'Esportazione Modello 3D (.DAE), Tavole PDF e Guida di Montaggio RTA',
    shortDesc: 'Genera elaborati industriali pronti per falegnameria e cliente: modello 3D COLLADA .DAE millimetrico universale, tavole 2D quotate in PDF e manuale di montaggio passo dopo passo RTA.',
    icon: 'download',
    iconColor: 'text-sky-500',
    badge: 'Produzione Industriale',
    steps: [
      'Esportazione Modello 3D (.DAE): Nel menu superiore, fai clic su "Esporta" e seleziona "Esporta Modello 3D (.DAE)". Il sistema compila un file COLLADA 1.4.1 in scala millimetrica 1:1, con elementi raggruppati per mobile in livelli ordinati e orientamento verticale Z_UP standard.',
      'Tavole Tecniche 2D in PDF: Nel menu Esporta o nella vista Distinta, clicca su "Tavola 2D Tecnica (PDF)". Scarica una scheda d\'officina con distinta completa, rappresentazione delle facce con forature CNC e quote di bordatura.',
      'Schemi di Taglio 2D dei Pannelli: Nella scheda "3. Ottimizzatore 2D", clicca su "Esporta Schemi di Taglio" per stampare il piano di taglio a ghigliottina con numerazione dei pezzi, spessore lama (kerf) ed etichette con codice a barre.',
      'Manuale di Montaggio RTA Passo dopo Passo: Fai clic su "Guida al Montaggio" per visualizzare il fascicolo d\'assemblaggio passo dopo passo. Esamina l\'esploso isometrico fase per fase di ogni mobile con tabella della viteria per passaggio.'
    ],
    tips: [
      'Il file .DAE esportato conserva le texture e la geometria raggruppata pronta per la visualizzazione e il rendering 3D senza estensioni.',
      'La Guida di Montaggio RTA può essere stampata o inviata al cliente per semplificare la posa in opera senza dubbi sul verso dei pannelli.'
    ],
    technicalDetails: [
      { label: 'Formato 3D', value: 'COLLADA 1.4.1 (.DAE) universale con coordinate millimetriche' },
      { label: 'Scala Esportazione', value: 'Millimetrica 1:1 con gerarchie 3D ordinate' },
      { label: 'Documenti PDF', value: 'Schede tecniche quotate, schemi di taglio 2D ed etichette' },
      { label: 'Manuale RTA', value: 'Sequenza isometrica 2D con distinta dettagliata della ferramenta' }
    ]
  },

  // 5. GUIDA 5: Guida Scala Umana 1,72 m e Bussola Cardinale (+Z)
  {
    id: 'escala_humana_brujula',
    category: 'herramientas_3d',
    title: 'Guida Scala Umana 1,72 m e Bussola Cardinale (+Z)',
    shortDesc: 'Manichino architettonico in scala reale (1720 mm) con righello ergonomico verticale e indicatori a terra per verificare le altezze di lavoro.',
    icon: 'human',
    iconColor: 'text-sky-500',
    badge: 'Ergonomia CAD',
    steps: [
      'Nel visualizzatore 3D è presente la figura architettonica stilizzata a grandezza d\'uomo naturale (1720 mm / 1,72 m di altezza) posizionata sul pavimento della stanza.',
      'Il manichino comprende un righello millimetrico verticale con le quote antropometriche fondamentali: zoccolo (100 mm), piano di lavoro cucina (900 mm), alzatina (1450 mm) e altezza degli occhi (1600-1720 mm).',
      'A pavimento, il perimetro del laboratorio di 5000 × 5000 mm mostra marcatori ben visibili: in blu "▲ FRONTE (+Z) · VISTA PRINCIPALE", e in grigio "▼ DIETRO (-Z)", "► SINISTRA (-X)" e "◄ DESTRA (+X)".',
      'Per spostare il manichino: fai clic sul suo basamento o corpo nel 3D e trascinalo con il mouse verso il mobile per verificarne proporzioni e accessibilità.',
      'Per mostrare o nascondere la guida umana e i riferimenti cardinali, premi l\'icona della figura umana sulla barra o usa la scorciatoia da tastiera [ G ].'
    ],
    tips: [
      'Usa la figura umana durante la progettazione di pensili per controllare se l\'utente potrà raggiungere i ripiani alti senza ausilio di scalette.',
      'Il riferimento "FRONTE (+Z)" garantisce che ante e cassetti non vengano mai disegnati rivolti all\'indietro.',
      'La figura è un riferimento puramente visivo e non viene inclusa nella distinta di taglio né nei file CNC.'
    ],
    technicalDetails: [
      { label: 'Statura Standard', value: '1720 mm (1,72 m) proporzione ergonomica' },
      { label: 'Marcatori a Terra', value: 'FRONTE (+Z), DIETRO (-Z), SIN (-X), DES (+X)' },
      { label: 'Interazione', value: 'Trascinamento libero sul piano XZ del pavimento col mouse' },
      { label: 'Visibilità', value: 'Attivabile con pulsante su barra o scorciatoia [ G ]' }
    ]
  },

  // 6. GUIDA 6: Congela / Blocca Pezzi e Moduli
  {
    id: 'bloqueo_congelar_piezas',
    category: 'herramientas_3d',
    title: 'Congela / Blocca Pezzi e Moduli',
    shortDesc: 'Blocca singoli pannelli o interi moduli contro spostamenti accidentali, modifiche o eliminazioni involontarie.',
    icon: 'lock',
    iconColor: 'text-amber-500',
    badge: 'Protezione Progetto',
    steps: [
      'Seleziona il pezzo o il mobile che vuoi tutelare nel visualizzatore 3D.',
      'Puoi congelare l\'elemento in due modi rapidi:',
      '• Dal Menu Contestuale (Tasto Destro): Clicca col tasto destro sul pezzo e scegli "Congela Solo Questo Pezzo" o "Congela Modulo Completo / Cassetto Completo".',
      '• Dalla Barra Contestuale Superiore: Premi il pulsante con l\'icona del lucchetto.',
      'Una volta congelato, il pezzo mostrerà un badge ambra con l\'indicatore [ Bloccato ].',
      'L\'elemento bloccato è protetto al 100%: non potrà essere trascinato con il mouse né eliminato con il tasto Canc.',
      'Per sbloccare, fai clic destro sul pezzo e seleziona "Scongela", oppure clicca nuovamente sul lucchetto nella barra superiore.'
    ],
    tips: [
      'Blocca i fianchi e la base del mobile non appena stabilite le misure perimetriche; potrai così disporre ripiani interni e cassetti senza rischiare di muovere la scocca.',
      'Bloccando un cassetto completo, frontale, spondine, retro, fondo e guide vengono protetti in un solo clic.',
      'I pezzi congelati continuano a essere conteggiati regolarmente nella distinta di taglio e nel preventivo.'
    ],
    technicalDetails: [
      { label: 'Ambito', value: 'Singolo pezzo (part.isLocked) o Gruppo (group.isLocked)' },
      { label: 'Effetto', value: 'Inibisce traslazione, trascinamento, rotazione ed eliminazione' },
      { label: 'Indicatore', value: 'Badge visivo ambra nella scena 3D e nelle tabelle' },
      { label: 'Persistenza', value: 'Memorizzato nel cloud e nel JSON di progetto' }
    ]
  },

  // 7. GUIDA 7: Menu Contestuale Intelligente con Tasto Destro
  {
    id: 'menu_contextual_inteligente',
    category: 'herramientas_3d',
    title: 'Menu Contestuale Intelligente con Tasto Destro',
    shortDesc: 'Menu contestuale 3D adattivo che cambia opzioni dinamicamente se fai clic su Cassetto, Anta, Struttura o Spazio Vuoto.',
    icon: 'mouse',
    iconColor: 'text-sky-600',
    badge: 'Produttività 3D',
    steps: [
      'Fai clic con il pulsante destro del mouse in un punto qualunque della vista 3D.',
      'Il menu rileva automaticamente il componente sotto il puntatore offrendo comandi contestuali:',
      '• Clic su Cassetto: Test immediato apertura/chiusura guide, congela cassetto, duplica, cambia maniglia o isola frontale.',
      '• Clic su Anta: Inverti cerniera reversibile (Sinistra / Destra), apri/chiudi battente, cambia maniglia o blocca.',
      '• Clic su Elemento Strutturale: Ruota di 90°, inverti orientamento (Orizzontale / Verticale), duplica, congela o elimina.',
      '• Clic sul Pavimento o Spazio Vuoto: Accesso veloce per inserire pannello libero, mostrare scala umana, centrare camera o azzerare vista.',
      'Per chiudere il menu contestuale, è sufficiente fare clic sinistro sul pavimento vuoto o premere [ Esc ].'
    ],
    tips: [
      'Il menu contestuale evita di cercare comandi nei pannelli laterali: le opzioni primarie sono sempre a portata di clic.',
      'Se selezioni più pezzi contemporaneamente con Shift + Clic, il menu offrirà azioni di gruppo (come Raggruppa o Congela Selezione).'
    ],
    technicalDetails: [
      { label: 'Rilevamento Raycaster', value: 'Analisi collisioni 3D alle coordinate esatte del puntatore' },
      { label: 'Modalità Contestuali', value: 'Cassetto, Anta, Elemento strutturale e Spazio vuoto' },
      { label: 'Animazioni', value: 'Rotazione cerniere ed estrazione guide in tempo reale' }
    ]
  },

  // 8. GUIDA 8: Stanza 3D ed Elettrodomestici
  {
    id: 'habitacion_equipos_3d',
    category: 'herramientas_3d',
    title: 'Stanza 3D ed Elettrodomestici',
    shortDesc: 'Ambiente realistico di laboratorio o stanza con pareti e pavimento personalizzabili, e inserimento di elettrodomestici standard nell\'ispettore a 3 zone.',
    icon: 'room',
    iconColor: 'text-emerald-500',
    badge: 'Visualizzazione e Scena',
    steps: [
      'Nella Zona 1 (Barra Superiore), attiva la Modalità Stanza per mostrare pareti perimetrali e pavimento con finiture e dimensioni regolabili.',
      'Premi il pulsante "+ Elettrodomestico 3D" nella barra superiore oppure passa alla scheda "Elettrodomestici" nell\'Ispettore Destro (Zona 3).',
      'Esplora il catalogo degli elettrodomestici normalizzati: frigoriferi singoli o all\'americana, forni a incasso, microonde, cappe aspiranti, lavelli in acciaio inox e lavastoviglie.',
      'Inserisci l\'apparecchio nella scena 3D e posizionalo direttamente nella nicchia del mobile designato.',
      'Nell\'Ispettore Destro, calibra elevazione Y, rotazione e accertati che i giochi d\'incasso e le aperture d\'areazione soddisfino i requisiti dei costruttori.',
      'Utilizza il pulsante di blocco per fissare la posizione dell\'elettrodomestico una volta allineato.'
    ],
    tips: [
      'Durante la progettazione del sottolavello, colloca il lavello 3D sul piano per valutare il foro d\'incasso ed evitare interferenze con lo scarico.',
      'Gli elettrodomestici sono elementi di riferimento visivo e non generano pezzi nella distinta di taglio dei pannelli.'
    ],
    technicalDetails: [
      { label: 'Catalogo Elettrodomestici', value: 'Frigorifero, Forno, Microonde, Lavello, Cappa, Lavastoviglie' },
      { label: 'Pareti e Pavimento', value: 'Dimensioni millimetriche con texture piastrelle/legno' },
      { label: 'Tolleranze d\'Incasso', value: 'Verifica visiva di nicchie e fessure di ventilazione' },
      { label: 'Integrazione', value: 'Posizionamento su 3 zone e ispettore delle proprietà' }
    ]
  },

  // 9. GUIDA 9: Spostamento per Trascinamento Diretto 3D e Guida Verticale
  {
    id: 'movimiento_directo_3d',
    category: 'herramientas_3d',
    title: 'Spostamento per Trascinamento Diretto 3D e Guida Verticale',
    shortDesc: 'Sposta pezzi o moduli facendo clic e trascinando direttamente su qualsiasi superficie, con vincolo di piano e guida verticale anti-collisione.',
    icon: 'pan_tool',
    iconColor: 'text-sky-600',
    badge: 'Interazione Naturale',
    steps: [
      'Fai clic col tasto sinistro su qualsiasi pezzo o mobile nel visualizzatore 3D.',
      'Il puntatore si trasforma in mano aperta al passaggio sul pezzo, e in mano chiusa tenendo premuto il tasto del mouse.',
      'Trascina con delicatezza: il motore vincola lo spostamento al piano della faccia o sulla guida verticale nel caso di ripiani interni.',
      'I componenti appartenenti a un assieme modulare (ad esempio un cassetto con frontale, sponde e fondo) si muovono coordinati.',
      'Per correzioni millimetriche di precisione, impiega i tasti freccia della tastiera (1 mm a tocco, o 10 mm tenendo premuto Shift).',
      'Per ridimensionare un pezzo selezionato, puoi usare i manipolatori cubici d\'ingombro o i campi dell\'Ispettore Destro.'
    ],
    tips: [
      'Per sollevare o abbassare rapidamente un componente lungo l\'asse verticale (Y), usa i tasti [ W ] (+10 mm) e [ S ] (-10 mm).',
      'Per annullare uno spostamento errato, premi immediatamente [ Ctrl + Z ].'
    ],
    technicalDetails: [
      { label: 'Metodo di Trascinamento', value: 'Clic mantenuto diretto sulla mesh con proiezione CAD complanare' },
      { label: 'Movimento Modulare', value: 'Sincronizzazione per ID modulo e gerarchia' },
      { label: 'Micro-Regolazione', value: 'Passo fine di 1 mm / 10 mm con tasti freccia' },
      { label: 'Annulla / Ripristina', value: 'Cronologia completa con [ Ctrl + Z ] / [ Ctrl + Y ]' }
    ]
  },

  // 10. GUIDA 10: Barra Contestuale di Azioni e Barra Superiore
  {
    id: 'cinta_acciones_flotante',
    category: 'herramientas_3d',
    title: 'Barra Contestuale di Azioni e Barra Superiore',
    shortDesc: 'Menu contestuale mobile per duplicare, ruotare di 90°, cambiare orientamento, congelare e gestire finiture in blocco.',
    icon: 'dashboard_customize',
    iconColor: 'text-emerald-600',
    badge: 'Barra Superiore',
    steps: [
      'Selezionando qualsiasi pezzo o mobile nel visualizzatore 3D, compare automaticamente la barra contestuale fluttuante in alto.',
      'La barra riporta il numero di elementi selezionati e pulsanti di comando rapido:',
      '• "Duplica": Clona l\'elemento a lato mantenendo forature e ferramenta.',
      '• "Ruota 90° [ R ]": Ruota la selezione attiva di 90 gradi attorno al centro comune.',
      '• "Congela": Blocca o sblocca la selezione contro spostamenti indesiderati.',
      '• "Sposta": Passa allo strumento di traslazione rapida.',
      '• "Campionario Melammina": Apre il selettore di finiture per applicare una texture a tutti i pezzi selezionati in una sola mossa.',
      '• "Elimina [ Canc ]": Cancella gli elementi selezionati dal progetto.',
      'Nell\'angolo superiore sinistro compare la scheda con il nome del pezzo e le sue quote (L × P × S).'
    ],
    tips: [
      'La barra compare solo in presenza di una selezione attiva, mantenendo pulita la vista prospettica durante le rotazioni di camera.',
      'Puoi premere il tasto [ R ] in qualsiasi momento per ruotare di 90° la selezione senza cliccare con il mouse.'
    ],
    technicalDetails: [
      { label: 'Visibilità', value: 'Contestuale e reattiva (visibile solo con selezione attiva)' },
      { label: 'Operazioni in Blocco', value: 'Duplica, Ruota 90°, Congela, Sposta, Materiali ed Elimina' },
      { label: 'Scorciatoia Rotazione', value: 'Tasto [ R ] o [ Q ]' },
      { label: 'Scorciatoia Eliminazione', value: 'Tasto [ Canc ] o [ Backspace ]' }
    ]
  },

  // 11. GUIDA 11: Selezione Multipla con Shift e Modifica in Blocco
  {
    id: 'seleccion_multiple_shift',
    category: 'modulos_piezas',
    title: 'Selezione Multipla con Shift e Modifica in Blocco',
    shortDesc: 'Cattura più mobili e pezzi tramite riquadro di selezione o Shift + Clic per ruotare, spostare, duplicare e assegnare finiture in blocco.',
    icon: 'format_shapes',
    iconColor: 'text-sky-600',
    badge: 'Modifica in Blocco',
    steps: [
      'Riquadro di Selezione Multipla: Tieni premuto il tasto [ Shift ] e trascina con il clic sinistro sulla vista 3D. Un rettangolo traslucido selezionerà tutti i mobili e pannelli toccati, senza far ruotare la camera.',
      'Selezione Additiva con Clic: Tieni premuto [ Shift ] e fai clic su singoli pezzi o moduli per aggiungerli o toglierli dalla selezione.',
      'Contatore Contestuale: Osserva il badge sulla barra superiore che indica il totale dei pezzi selezionati (es. "8 pezzi selezionati").',
      'Rotazione in Blocco: Premi il tasto [ R ] per ruotare di 90° tutti i componenti selezionati attorno al loro baricentro comune senza alterare le distanze reciproche.',
      'Assegnazione Finiture in Serie: Scegli un materiale dalla tavolozza per cambiare colore o venatura a tutti i pezzi selezionati contemporaneamente.',
      'Per deselezionare tutto, fai clic sul pavimento vuoto o premi [ Esc ].'
    ],
    tips: [
      'Quando selezioni più mobili interi, le quote millimetriche individuali vengono nascoste automaticamente per evitare affollamento visivo.',
      'Duplica un\'intera composizione di basi con Shift per realizzare file di mobili cucina in pochi secondi.'
    ],
    technicalDetails: [
      { label: 'Finestra di Selezione', value: 'Shift + Trascinamento mouse (blocca l\'orbita camera)' },
      { label: 'Selezione Additiva', value: 'Shift + Clic su pezzo o modulo' },
      { label: 'Rotazione Collettiva', value: 'Calcolo baricentro comune per rotazione simmetrica di 90°' },
      { label: 'Proprietà di Gruppo', value: 'Materiali, venature, duplicazione e blocco' }
    ]
  },

  // 12. GUIDA 12: Tagli Speciali, Smussi e Sagomatura Sifone a U
  {
    id: 'cortes_especiales_sifon',
    category: 'modulos_piezas',
    title: 'Tagli Speciali, Smussi e Sagomatura Sifone a U',
    shortDesc: 'Lavorazioni avanzate per top e mobili bagno: scansassi a L per pilastri, smussi a 45°, tagli diagonali e scansasso sifone a U parametrico.',
    icon: 'scissors',
    iconColor: 'text-amber-600',
    badge: 'Lavorazione Speciale',
    steps: [
      'Seleziona il piano di lavoro, top o ripiano che vuoi lavorare nel visualizzatore 3D.',
      'Nell\'Ispettore Destro (Zona 3), raggiungi le sezioni "Tagli Speciali e Spigoli" e "Scansasso Sifone a U".',
      'Seleziona la tipologia di taglio conforme all\'ambiente:',
      '• Dritto o Rientranza: Compensazioni longitudinali per alloggiare top tra pareti fuori squadra.',
      '• Smusso a 45°: Angoli smussati di sicurezza per penisole o zone di passaggio.',
      '• Taglio Diagonale: Chiusure angolate per mobili terminali o passaggi stretti.',
      '• Scansasso a L (Pilastro): Rientranza posteriore per aggirare colonne e riseghe del muro.',
      'Scansasso Sifone a U (Mobili Bagno): Nei cassetti superiori del mobile lavabo, attiva l\'opzione "Scansasso Sifone a U". Inserisci larghezza e profondità dell\'incavo per consentire il passaggio del sifone senza sacrificare i vani laterali.',
      'Nell\'esportazione verso DXF CNC o PDF per laboratorio, i tagli speciali vengono descritti con polilinee chiuse continue LWPOLYLINE quotate al millimetro.'
    ],
    tips: [
      'Lo scansasso sifone a U genera automaticamente le spondine interne del cassetto per sigillare i bordi grezzi attorno al tubo.',
      'Gli smussi a 45° sui piani riducono il rischio di urti accidentali in presenza di bambini.'
    ],
    technicalDetails: [
      { label: 'Tipologie di Taglio', value: 'Dritto, Smusso 45°, Diagonale, Scansasso a L e Sifone a U' },
      { label: 'Uso Arredobagno', value: 'Sagomatura parametrica per piletta e sifone di scarico' },
      { label: 'Esportazione DXF', value: 'Polilinee chiuse LWPOLYLINE in apposito layer lavorazioni' },
      { label: 'Tavole PDF', value: 'Quote automatiche di raggi, smussi e scassi' }
    ]
  },

  // 13. GUIDA 13: Lavorazioni e Forature CNC Automatiche
  {
    id: 'mecanizados_cnc',
    category: 'mecanizados',
    title: 'Lavorazioni e Forature CNC Automatiche',
    shortDesc: 'Come il motore intelligente calcola viti di assemblaggio, spine e cerniere analizzando automaticamente le giunzioni dei pannelli.',
    icon: 'adjust',
    iconColor: 'text-sky-600',
    badge: 'Calcolo Intelligente',
    steps: [
      'Il sistema esamina tutte le superfici di contatto e sormonto tra pannelli contigui (fianchi con base, cappello, ripiani fissi o tramezzi).',
      'Identifica la direzione della giunzione (unione di testa ad angolo retto di 90° o frontali di ante a battente).',
      'Determina le coordinate esatte di foratura nel rispetto delle norme professionali di falegnameria:',
      '• Viti di assemblaggio (Ciano): Foro passante di Ø 4 mm sulla faccia esterna e foro d\'invito di Ø 3 mm × 30 mm sul bordo del pezzo ortogonale, a 50 mm e 100 mm dalle estremità.',
      '• Spine in legno / Perni (Ambra): Fori ciechi di Ø 8 mm × 15 mm di profondità su entrambi i pannelli per unioni a scomparsa senza viti a vista.',
      '• Scodellini cerniere (Viola): Sulle ante a battente calcola fori di Ø 35 mm × 12,5 mm a 100 mm dai bordi superiore e inferiore, con distanza dal bordo K = 4 mm.',
      'Per ispezionare le forature nel visualizzatore 3D, attiva il pulsante forature (icona della punta da trapano) nella barra strumenti.',
      'Nell\'esportazione in DXF CNC, tutti questi punti vengono generati in layer vettoriali dedicati con diametri e profondità pronti per centri di lavoro.'
    ],
    tips: [
      'Le forature si ricalcolano dinamicamente in tempo reale ogni volta che ridimensioni un pannello o ne modifichi lo spessore.',
      'Nel pannello destro "Proprietà del Pezzo", puoi consultare l\'elenco dettagliato delle coordinate assegnate all\'elemento selezionato.',
      'Sulla tavola 2D tecnica (PDF), ogni faccia è quotata per permettere la tracciatura e foratura manuale con dime da banco.'
    ],
    technicalDetails: [
      { label: 'Vite di Giunzione', value: 'Ø 4 mm passante + Ø 3 mm invito (Colore Ciano)' },
      { label: 'Spine in Legno', value: 'Ø 8 mm × 15 mm profondità (Colore Ambra)' },
      { label: 'Scodellino Cerniera', value: 'Ø 35 mm × 12,5 mm (Colore Viola, K = 4 mm)' },
      { label: 'Posizionamento Bordi', value: 'Interasse standard 50 mm e 100 mm dagli spigoli' },
      { label: 'Esportazione CNC', value: 'Layer DXF CNC + Schede d\'officina quotate PDF' }
    ]
  },

  // 14. GUIDA 14: Cerniere e Fori Scodellino Ø35mm Reversibili Sincronizzati
  {
    id: 'bisagras_reversibles',
    category: 'mecanizados',
    title: 'Cerniere e Fori Scodellino Ø35mm Reversibili Sincronizzati',
    shortDesc: 'Apertura verso sinistra o destra con riposizionamento automatico delle forature e della ferramenta 3D.',
    icon: 'door_sliding',
    iconColor: 'text-sky-600',
    badge: 'Cerniere Dinamiche',
    steps: [
      'Configurando un\'anta a battente nell\'Ispettore o nel menu contestuale, seleziona il verso d\'apertura desiderato: "Anta (Cerniera a Sinistra)" o "Anta (Cerniera a Destra)".',
      'Cambiando il verso, la maniglia 3D si sposta sul lato opposto e le cerniere 3D si fissano sul fianco appropriato.',
      'I fori viola di scodellino Ø 35 mm × 12,5 mm vengono ricalcolati immediatamente sul bordo d\'apertura (a 22 mm dal centro del foro, K = 4 mm).',
      'Provando l\'animazione con l\'opzione "Apri Anta" o con il comando sulla barra, i fori scodellino ruotano solidali con il battente.'
    ],
    tips: [
      'Clonando un\'anta sinistra per creare la destra del mobile, il sistema sincronizza sia l\'aspetto estetico 3D che la distinta tecnica delle forature.',
      'La distanza K = 4 mm è conforme agli standard dei maggiori produttori di ferramenta (Blum, Salice, Grass, Hettich).'
    ],
    technicalDetails: [
      { label: 'Standard Scodellino', value: 'Ø 35 mm × 12,5 mm di profondità' },
      { label: 'Distanza dal Bordo K', value: '4 mm al filo / 22 mm al centro del foro' },
      { label: 'Sincronizzazione', value: 'Cerniera 3D + Maniglia + Foro scodellino + Rotazione animata' }
    ]
  },

  // 15. GUIDA 15: Parametri di Laboratorio, Spessore Lama (Kerf), Bordi e Note
  {
    id: 'parametros_taller_notas',
    category: 'optimizador',
    title: 'Parametri di Laboratorio, Spessore Lama (Kerf), Bordi e Note',
    shortDesc: 'Calibrazione millimetrica del taglio: spessore lama sega (kerf), rifilatura perimetrale, gestione bordi e taccuino di progetto.',
    icon: 'precision_manufacturing',
    iconColor: 'text-sky-600',
    badge: 'Precisione di Fabbricazione',
    steps: [
      'Prima di inviare i pezzi al taglio, calibra i parametri di lavorazione nell\'Ottimizzatore o nelle Impostazioni di Progetto:',
      '• Spessore Lama (Kerf): Configura la larghezza di taglio del dente della tua sezionatrice (standard da 3,2 mm a 4,0 mm). L\'ottimizzatore detrarrà questo spessore a ogni passata per evitare pezzi sottodimensionati.',
      '• Rifilatura Perimetrale (Trim Margin): Imposta l\'intestatura perimetrale del pannello (es. 10 mm per lato) per eliminare bordi sbeccati dal trasporto.',
      '• Bordi (Bordo Sottile 0,45 mm vs Bordo Spesso 2,0 mm): Specifica quali bordi devono essere bordati (L1, L2, LARG1, LARG2). Lo spessore del bordo spesso viene detratto dalle quote di taglio.',
      '• Taccuino di Progetto e Checklist: Apri il blocco note dalla barra superiore per appuntare istruzioni di cantiere, dettagli di posa e liste di controllo.'
    ],
    tips: [
      'Se affidi il taglio a centri di sezionatura esterni, chiedi lo spessore del loro dente di sega (spesso 4,0 mm o 4,4 mm) per ottenere schemi di taglio perfettamente coincidenti.',
      'Il calcolo dello sviluppo lineare distingue bordo sottile da bordo spesso per acquistare le bobine con la massima precisione.'
    ],
    technicalDetails: [
      { label: 'Gamma Kerf di Lama', value: 'Da 1,0 mm a 6,0 mm (Consigliato: 4,0 mm)' },
      { label: 'Rifilatura Perimetrale', value: 'Da 0 mm a 30 mm per lato (Standard: 10 mm)' },
      { label: 'Compensazione Bordi', value: 'Detrazione automatica bordo spesso (2 mm) nella distinta' },
      { label: 'Taccuino di Progetto', value: 'Sincronizzato in cloud con salvataggio in tempo reale' }
    ]
  },

  // 16. GUIDA 16: Ottimizzazione di Taglio 2D, Distinta e Detrazione Bordo
  {
    id: 'optimizador_despiece',
    category: 'optimizador',
    title: 'Ottimizzazione di Taglio 2D, Distinta e Detrazione Bordo',
    shortDesc: 'Algoritmo a ghigliottina per massimizzare la resa dei pannelli con rispetto venatura del legno, rifilatura e detrazione bordi rigidi.',
    icon: 'precision_manufacturing',
    iconColor: 'text-sky-600',
    badge: 'Risparmio Materiale',
    steps: [
      'Apri la scheda "3. Ottimizzatore 2D" nella barra superiore.',
      'Imposta le dimensioni del pannello commerciale (es. 2800 × 2070 mm o 2440 × 1830 mm) e lo spessore della lama (Kerf = 4 mm standard).',
      'Definisci la rifilatura perimetrale del pannello (es. 10 mm) per squadrare i bordi.',
      'Attiva la casella "Detrai Bordo al Taglio" se intendi applicare bordo rigido in PVC da 2 mm.',
      'L\'algoritmo calcolerà gli schemi di taglio rispettando il verso della venatura longitudinale o trasversale dei decori lignei e riducendo al minimo gli sfridi.',
      'Genera il report con percentuale di resa, metri lineari di bordo e schema di taglio con identificativo di ogni pezzo.',
      'Fai clic su "Esporta Tavola 2D Tecnica" per scaricare il PDF pronto per la produzione.'
    ],
    tips: [
      'Puoi stampare etichette adesive per ciascun pezzo complete di nome del mobile, misure nominali di taglio e schema di bordatura.',
      'L\'algoritmo Ghigliottina 2D genera tagli passanti da estremità a estremità adatti sia a sezionatrici orizzontali a controllo numerico sia a squadratrici tradizionali.'
    ],
    technicalDetails: [
      { label: 'Algoritmo', value: 'Ghigliottina 2D con controllo rigoroso della venatura' },
      { label: 'Parametri', value: 'Spessore lama (0-10 mm), Rifilatura (0-25 mm)' },
      { label: 'Detrazione Bordi', value: '0,45 mm e 2,0 mm sui bordi configurati' }
    ]
  },

  // 17. GUIDA 17: Guida Rapida alle Scorciatoie da Tastiera
  {
    id: 'atajos_teclado',
    category: 'atajos',
    title: 'Guida Rapida alle Scorciatoie da Tastiera',
    shortDesc: 'Lavora alla massima velocità con scorciatoie dirette senza conflitti per selezionare, ruotare, spostare, misurare e trasformare.',
    icon: 'keyboard',
    iconColor: 'text-emerald-600',
    badge: 'Produtività',
    steps: [
      '• [ V ] o [ Barra Spaziatrice ]: Strumento Seleziona (Shift + Clic per aggiungere/rimuovere pezzi o mobili)',
      '• [ Shift + Trascina ]: Finestra di Selezione Multipla. Blocca la camera e seleziona più mobili o pannelli in blocco',
      '• [ Shift + Clic ]: Aggiunge o toglie componenti dalla selezione attiva',
      '• [ M ]: Strumento Sposta (traslazione nello spazio 3D per posizionare moduli o pannelli)',
      '• [ R ] / [ Q ]: Ruota di 90° in blocco il pezzo, cassetto o moduli selezionati (attorno al baricentro comune)',
      '• [ T ]: Metro a Nastro 3D con snap magnetico a vertici e spigoli',
      '• [ Z ]: Centra e reimposta la vista della camera nella scena 3D',
      '• [ W ] / [ S ]: Alza o abbassa il pezzo selezionato sull\'asse verticale Y (+/-10 mm)',
      '• [ Tasti Freccia ]: Spostamento millimetrico della selezione (1 mm o 10 mm con Shift)',
      '• [ G ]: Mostra o nasconde le guide spaziali e il manichino a scala umana di 1,72 m',
      '• [ H ] / [ Alt + H ]: Nasconde temporaneamente la selezione o mostra tutti i pezzi nascosti',
      '• [ Canc / Backspace ]: Elimina immediatamente i pezzi o mobili selezionati',
      '• [ Ctrl + Z ] / [ Cmd + Z ]: Annulla l\'ultima operazione (Undo)',
      '• [ Ctrl + Y ] / [ Cmd + Shift + Z ]: Ripristina l\'operazione annullata (Redo)',
      '• [ Esc ]: Annulla strumento attivo, deseleziona tutto o chiude finestre modali'
    ],
    tips: [
      'Selezione Multipla in Blocco: Tieni premuto [ Shift ] e trascina con il tasto sinistro nel visualizzatore 3D. Il riquadro catturerà tutti i mobili toccati senza far girare la camera.',
      'Tasto [ R ] dedicato alla ROTAZIONE: premendo R con un mobile o cassetto selezionato, questo ruota di 90° all\'istante senza cambiare strumento.',
      'La barra spaziatrice o il tasto [ V ] ti riportano subito allo strumento di selezione standard.'
    ],
    technicalDetails: [
      { label: 'Riquadro Selezione 3D', value: 'Shift + Trascinamento mouse' },
      { label: 'Aggiungi a Selezione', value: 'Shift + Clic su pezzo' },
      { label: 'Rotazione 90°', value: 'Tasto [ R ] o [ Q ] (modulo o selezione)' },
      { label: 'Strumento Sposta', value: 'Tasto [ M ]' },
      { label: 'Metro a Nastro', value: 'Tasto [ T ]' },
      { label: 'Strumento Seleziona', value: 'Tasti [ V ] o [ Spazio ]' },
      { label: 'Centra Camera', value: 'Tasto [ Z ]' },
      { label: 'Scala Umana', value: 'Tasto [ G ]' }
    ]
  }
];

/* ==========================================================================
   DEUTSCH (DE)
   ========================================================================== */

export const DOC_ARTICLES_DE: DocArticle[] = [
  // 1. ANLEITUNG 1: Parametrisches Design nach Räumen
  {
    id: 'diseno_parametrico_ambientes',
    category: 'modulos_piezas',
    title: 'Parametrisches Design nach Räumen (Küchen, Schränke, Bäder & Arbeitszimmer)',
    shortDesc: 'Konfigurieren Sie maßgefertigte Möbel in 4 Speziallinien mit intelligenter Innenaufteilung von Türen, Schubkästen, Fachböden und Sockeln.',
    icon: 'view_in_ar',
    iconColor: 'text-sky-600',
    badge: 'Parametrische Engine',
    steps: [
      'Wählen Sie in Zone 1 (Obere Leiste) die gewünschte Raumlinie: Küchen, Schränke, Badezimmer oder Wohnen / Arbeitszimmer.',
      'Klicken Sie auf "+ Modul", um den Parametrischen Assistenten und Vorlagenkatalog mit vorkonfigurierten Korpussen zu öffnen (Unterschränke, Hängeschränke, Ecksowie Garderobenschränke mit Kleiderstangen, schwebende Waschtische mit Siphon-Ausschnitt oder Schreibtische).',
      'Fügen Sie den Korpus über "Zur Werkstatt hinzufügen" für Gesamtensembles oder über "Aktuelles ersetzen" ein.',
      'Passen Sie im Kontext-Inspektor (Zone 3 Rechts) Breite, Höhe, Tiefe und Plattenstärke (15 mm oder 18 mm) millimetergenau an. Das Möbelstück berechnet alle Bauteile unter Berücksichtigung von Montagefugen automatisch neu.',
      'Unter "Innenaufteilung & Fronten" konfigurieren Sie Türen (Drehtüren, Doppeltüren oder Klappen mit Gasdruckfeder), Schubkasteneinheiten (1 bis 4 Auszüge mit automatischen Teleskopführungen), Fachböden und Kleiderstangen.',
      'Definieren Sie die Sockelkonstruktion: Mit Sockelblende (Plinth), Schwebend/Wandhängend (mit einstellbarer Y-Höhe) oder Direkt auf dem Boden.'
    ],
    tips: [
      'Nutzen Sie den Button "Seitlich duplizieren (+X)" im Inspektor, um Schrankzeilen fugenlos und bündig aneinanderzureihen.',
      'Beim Wechsel des Hauptdekors werden alle zugehörigen Bauteile simultan aktualisiert, wobei die Holzmaserungsrichtung stets korrekt beibehalten wird.'
    ],
    technicalDetails: [
      { label: 'Raumlinien', value: 'Küchen, Schränke, Badezimmer und Wohnen / Arbeitszimmer' },
      { label: 'Unterstützte Stärken', value: '15 mm und 18 mm (mit 2D-Optimierer synchronisiert)' },
      { label: 'Innenaufteilung', value: 'Dreh-/Klapptüren, Schubkästen, Fachböden und Kleiderstangen' },
      { label: 'Sockelkonfiguration', value: 'Sockelblende, schwebend/wandhängend oder bodenstehend' }
    ]
  },

  // 2. ANLEITUNG 2: Fachboden-Einstellung auf Vertikalschiene & Direkte 3D-Lichte-Bearbeitung
  {
    id: 'ajuste_repisas_luz_interna',
    category: 'cotas_luz',
    title: 'Fachboden-Einstellung auf Vertikalschiene & Direkte 3D-Lichte-Bearbeitung',
    shortDesc: 'Echtzeitanzeige nutzbarer Innenmaße, kollisionsfreie Bewegung auf der Vertikalschiene, automatisches Zentrieren und Direktbearbeitung per Klick auf das 3D-Maß.',
    icon: 'straighten',
    iconColor: 'text-emerald-500',
    badge: 'HD 3D-Maße',
    steps: [
      'Klicken Sie auf einen Fachboden oder Zwischenträger im 3D-Viewport: Oberes Lichte Maß, Unteres Lichte Maß und Lichte Nutzbreite werden sofort in Smaragdgrün mit der Beschriftung ↕ XXX mm eingeblendet.',
      'Direkte Bearbeitung im 3D-Raum: Klicken Sie mit der linken Maustaste direkt auf das schwebende Millimeter-Label im 3D-Raum. Ein numerisches Eingabefeld erscheint: geben Sie das gewünschte Maß ein (z. B. 250) und drücken Sie [ Eingabe ]. Der Fachboden springt sofort an die neue Position.',
      'Kollisionsfreies Ziehen auf der Vertikalschiene: Halten Sie den Fachboden mit gedrückter Maustaste und ziehen Sie ihn entlang der Y-Achse nach oben oder unten. Das System sperrt horizontale Auslenkungen und verhindert Kollisionen mit Boden, Deckel oder Nachbarböden (Sicherheitsabstand minGap = 40 mm).',
      'Numerische Feineinstellung im rechten Inspektor: Geben Sie im Inspektor unter "Fachbodenposition (Lichtes Maß)" exakte Millimeterwerte für "Unteres Maß" oder "Oberes Maß" ein.',
      'Automatisches Zentrieren im Fach: Ein Klick auf "Im Fach zentrieren" gleicht die oberen und unteren Abstände mit einem Klick perfekt symmetrisch aus.'
    ],
    tips: [
      'Beim Duplizieren eines Fachbodens berechnet das System die verbleibende Fachhöhe und platziert das neue Element zentriert, ohne Nachbarn zu überlappen.',
      'Anhand der horizontalen lichten Nutzbreite sehen Sie sofort, ob Aufbewahrungsboxen oder Geschirr passen, ohne Plattenstärken abziehen zu müssen.'
    ],
    technicalDetails: [
      { label: 'Bewegung', value: 'Kollisionsfreie Vertikalschiene mit Sicherheitsabstand (40 mm)' },
      { label: 'Direktbearbeitung 3D', value: 'Interaktives Three.js-Sprite mit sofortiger Zifferneingabe' },
      { label: 'Lichtes Maß', value: 'Zieht Plattenstärken ab (echter nutzbarer Freiraum)' },
      { label: 'Zentrierautomatik', value: 'Symmetrischer Algorithmus zwischen oberem und unterem Bauteil' }
    ]
  },

  // 3. ANLEITUNG 3: Echtzeit-Mehrwährungskalkulation & Kantenabzug beim Zuschnitt
  {
    id: 'presupuesto_multimoneda_tapacanto',
    category: 'optimizador',
    title: 'Echtzeit-Mehrwährungskalkulation & Kantenabzug beim Zuschnitt',
    shortDesc: 'Automatische Vorkalkulation mit Live-Wechselkursen (Basis COP zu USD, MXN, EUR), reaktive Beschlagsberechnung und Kantenstärkenabzug im 2D-Optimierer.',
    icon: 'tag',
    iconColor: 'text-amber-500',
    badge: 'Finanzen & Zuschnitt',
    steps: [
      'Wechseln Sie in der oberen Menüleiste auf den Reiter "4. Kalkulation".',
      'Live-Mehrwährungswähler: Wählen Sie Ihre Zielwährung (Basiswährung COP, USD, MXN, EUR). Das System ruft aktuelle Wechselkurse ab und rechnet Einzel- und Gesamtbeträge mit regionaler Währungsformatierung um.',
      'Fertigungskostenaufstellung: Prüfen Sie den vom 2D-Optimierer ermittelten Plattenverbrauch, die Laufmeter an Dünnkante (0,45 mm) und Dickkante (2,0 mm) sowie die Beschlagsliste (Schrauben, Topfbänder und Auszüge ohne Doppelberechnung).',
      'Geben Sie Werkstatt-Lohnkosten, Gewinnmarge und Steuersatz ein, um den finalen Verkaufspreis für den Endkunden zu kalkulieren.',
      'Kantenabzug beim Zuschnitt (subtractEdgeBandingFromCut): Aktivieren Sie auf dem Reiter "2. Stückliste" oder "3. 2D-Optimierer" das Kontrollkästchen "Kanten beim Zuschnitt abziehen".',
      'Ist die Option aktiv, zieht die Säge an den belegten Kanten (L1, L2, B1, B2) jeder Platte 0,45 mm bzw. 2,0 mm ab. Dadurch hat das fertig bekantete Werkstück exakt das im Entwurf definierte Nennmaß.'
    ],
    tips: [
      'Der Kantenabzug ist bei 2 mm starken PVC-Sicherheitskanten an Fronten unverzichtbar, um Fugenklemmungen durch Übermaß zu vermeiden.',
      'Exportieren Sie das kalkulierte Angebot als professionelles PDF zur direkten Übergabe an den Auftraggeber.'
    ],
    technicalDetails: [
      { label: 'Währungen', value: 'Basis COP konvertierbar in USD, MXN, EUR mit Live-Wechselkursen' },
      { label: 'Kantenabzug', value: '0,45 mm (Dünnkante) und 2,0 mm (Dickkante) an L1/L2/B1/B2' },
      { label: 'Beschlagsberechnung', value: 'Schrauben, Dübel, Bänder und Schienen exakt je Korpusverbindung' },
      { label: 'Plattenbedarf', value: 'Direkte Kopplung mit dem 2D-Guillotine-Zuschnittoptimierer' }
    ]
  },

  // 4. ANLEITUNG 4: 3D-Modell-Export (.DAE), PDF-Werkstattpläne & RTA-Montageanleitung
  {
    id: 'exportacion_dae_pdf_armado',
    category: 'optimizador',
    title: '3D-Modell-Export (.DAE), PDF-Werkstattpläne & RTA-Montageanleitung',
    shortDesc: 'Generieren Sie industriefähige Werkstatt- und Kundendokumente: millimetergenaues universelles COLLADA .DAE 3D-Modell, bemaßte 2D-PDF-Pläne und Schritt-für-Schritt RTA-Montagehandbuch.',
    icon: 'download',
    iconColor: 'text-sky-500',
    badge: 'Industrielle Fertigung',
    steps: [
      '3D-Modell-Export (.DAE): Klicken Sie im oberen Menü auf "Exportieren" und wählen Sie "3D-Modell exportieren (.DAE)". Das System generiert eine saubere COLLADA 1.4.1-Datei im Millimetermaßstab 1:1 mit bauteilbezogenen Baugruppen und Standard-Z_UP-Ausrichtung.',
      'Bemaßte 2D-Werkstattpläne als PDF: Klicken Sie im Exportmenü oder in der Stückliste auf "Technischer 2D-Plan (PDF)". Laden Sie werkstattfertige Zeichnungen mit vollständiger Bauteilnummerierung, CNC-Bohrbildern und Kantenbelegung herunter.',
      '2D-Plattenzuschnittpläne: Klicken Sie unter "3. 2D-Optimierer" auf "Schnittpläne exportieren", um den Guillotine-Schnittplan mit nummerierten Zuschnittteilen, Sägeblatt-Schnittfugen und Barcode-Etiketten auszugeben.',
      'Schritt-für-Schritt RTA-Montageanleitung: Klicken Sie auf "Montageanleitung", um das Handbuch Schritt für Schritt aufzurufen. Prüfen Sie die isometrische Explosionszeichnung Korpus für Korpus mit Bauphasen und Schraubenlisten.'
    ],
    tips: [
      'Die exportierte .DAE-Datei behält Texturen und gruppierte Geometrie bei, bereit für 3D-Visualisierung und Rendering ohne Zusatzprogramme.',
      'Das RTA-Montagehandbuch kann ausgedruckt oder digital geteilt werden, um Fehler bei der Montage vor Ort auszuschließen.'
    ],
    technicalDetails: [
      { label: '3D-Format', value: 'Universelles COLLADA 1.4.1 (.DAE) mit Millimeterkoordinaten' },
      { label: 'Exportmaßstab', value: 'Millimetergenau 1:1 mit bereinigten 3D-Hierarchien' },
      { label: 'PDF-Dokumente', value: 'Bemaßte Werkstattzeichnungen, 2D-Schnittpläne und Etiketten' },
      { label: 'RTA-Handbuch', value: 'Isometrische 2D-Montageschritte mit Bauteil- und Schraubenlisten' }
    ]
  },

  // 5. ANLEITUNG 5: 1,72 m Menschliches Maßstabsmodell & Kardinalkompass (+Z)
  {
    id: 'escala_humana_brujula',
    category: 'herramientas_3d',
    title: '1,72 m Menschliches Maßstabsmodell & Kardinalkompass (+Z)',
    shortDesc: 'Maßstabsgetreue Architekturfigur (1720 mm) mit vertikaler Skala und Bodenmarkierungen zur Überprüfung ergonomischer Arbeitshöhen.',
    icon: 'human',
    iconColor: 'text-sky-500',
    badge: 'CAD-Ergonomie',
    steps: [
      'Im 3D-Viewport steht die stilisierte menschliche Architekturfigur im realen Maßstab (1720 mm / 1,72 m Körpergröße) auf dem Werkstattboden.',
      'Die Figur besitzt eine vertikale Millimeterskala mit wichtigen anthropometrischen Höhenmarken: Sockelhöhe (100 mm), Arbeitsplattenhöhe (900 mm), Oberschrankunterkante (1450 mm) und Augenhöhe (1600-1720 mm).',
      'Auf dem Boden markiert der 5000 × 5000 mm große Raumrahmen eindeutige Richtungen: in Blau "▲ FRONT (+Z) · HAUPTANSICHT", und in Grau "▼ HINTEN (-Z)", "► LINKS (-X)" und "◄ RECHTS (+X)".',
      'Figur verschieben: Klicken Sie auf Sockel oder Körper der Figur im 3D-Raum und ziehen Sie sie mit der Maus an das Möbelstück heran, um Proportionen zu prüfen.',
      'Menschliches Modell und Richtungsmarkierungen können jederzeit über das Figursymbol in der Werkzeugleiste oder das Tastaturkürzel [ G ] ein- und ausgeblendet werden.'
    ],
    tips: [
      'Nutzen Sie die Figur bei Hängeschränken, um sofort zu sehen, ob obere Fachböden ohne Trittleiter erreichbar sind.',
      'Die Markierung "FRONT (+Z)" stellt sicher, dass Schranktüren und Schubkästen nicht versehentlich nach hinten konstruiert werden.',
      'Die Figur dient ausschließlich als optische Orientierung und wird weder in Zuschnittlisten noch in CNC-Dateien exportiert.'
    ],
    technicalDetails: [
      { label: 'Standardgröße', value: '1720 mm (1,72 m) ergonomische Normgröße' },
      { label: 'Bodenmarkierungen', value: 'FRONT (+Z), HINTEN (-Z), LINKS (-X), RECHTS (+X)' },
      { label: 'Interaktion', value: 'Freies horizontales Verschieben auf der XZ-Bodenebene' },
      { label: 'Sichtbarkeit', value: 'Umschaltbar per Symbolschaltfläche oder Tastenkürzel [ G ]' }
    ]
  },

  // 6. ANLEITUNG 6: Teile & Module Einfrieren / Fixieren
  {
    id: 'bloqueo_congelar_piezas',
    category: 'herramientas_3d',
    title: 'Teile & Module Einfrieren / Fixieren',
    shortDesc: 'Sperren Sie einzelne Platten oder komplette Baugruppen gegen versehentliches Verschieben, Ändern oder Löschen.',
    icon: 'lock',
    iconColor: 'text-amber-500',
    badge: 'Entwurfsschutz',
    steps: [
      'Wählen Sie das Bauteil oder die Baugruppe im 3D-Viewport aus, die geschützt werden soll.',
      'Fixieren Sie das Element auf zwei bequeme Arten:',
      '• Über das Rechtsklick-Kontextmenü: Klicken Sie mit rechts auf das Bauteil und wählen Sie "Nur dieses Teil fixieren" oder "Gesamtes Modul / Schubkasten fixieren".',
      '• Über die obere Werkzeugleiste: Klicken Sie auf das Schlosssymbol.',
      'Ein fixiertes Element wird durch ein bernsteinfarbenes Abzeichen [ Fixiert ] gekennzeichnet.',
      'Gesperrte Elemente sind vollständig geschützt: Sie können weder per Mauszeiger verschoben noch mit der Entf-Taste gelöscht werden.',
      'Zum Entsperren klicken Sie mit der rechten Maustaste auf das Bauteil und wählen "Freigeben" oder klicken erneut auf das Schlosssymbol.'
    ],
    tips: [
      'Fixieren Sie Korpusseiten und Unterboden, sobald die Grundmaße stehen; so können Sie Einlegeböden und Auszüge frei verschieben, ohne den Korpus zu verziehen.',
      'Das Sperren eines Auszugs schützt Front, Zargen, Rückwand, Boden und Führungen mit einem einzigen Klick.',
      'Fixierte Teile fließen weiterhin vollständig in Zuschnittoptimierung und Kalkulation ein.'
    ],
    technicalDetails: [
      { label: 'Geltungsbereich', value: 'Einzelteil (part.isLocked) oder Baugruppe (group.isLocked)' },
      { label: 'Wirkung', value: 'Sperrt Verschieben, Ziehen, Drehen und Löschen' },
      { label: 'Kennzeichnung', value: 'Bernsteinfarbener Indikator im 3D-Raum und in Tabellen' },
      { label: 'Persistenz', value: 'Gespeichert in der Cloud und in der Projekt-JSON-Datei' }
    ]
  },

  // 7. ANLEITUNG 7: Intelligentes Rechtsklick-Kontextmenü
  {
    id: 'menu_contextual_inteligente',
    category: 'herramientas_3d',
    title: 'Intelligentes Rechtsklick-Kontextmenü',
    shortDesc: 'Adaptives 3D-Kontextmenü, das Optionen dynamisch anpasst, je nachdem ob auf Schubkasten, Tür, Korpusteil oder freie Fläche geklickt wird.',
    icon: 'mouse',
    iconColor: 'text-sky-600',
    badge: '3D-Produktivität',
    steps: [
      'Klicken Sie mit der rechten Maustaste an eine beliebige Stelle im 3D-Viewport.',
      'Das Menü erkennt das anvisierte Element und blendet passende Aktionen ein:',
      '• Klick auf Schubkasten: Auszugsanimation testen, Schubkasten fixieren, duplizieren, Griffmodell wechseln oder Front isolieren.',
      '• Klick auf Tür: Anschlagseite wechseln (Links / Rechts), Drehtür öffnen/schließen, Griff anpassen oder sperren.',
      '• Klick auf Korpusteil: Um 90° drehen, Ausrichtung umschalten (Horizontal / Vertikal), duplizieren, sperren oder löschen.',
      '• Klick auf Werkstattboden / Leerraum: Schnellzugriff auf freie Platte einfügen, Maßstabsfigur einblenden, Kamera zentrieren oder Ansicht zurücksetzen.',
      'Um das Kontextmenü zu schließen, klicken Sie mit links in den Leerraum oder drücken Sie [ Esc ].'
    ],
    tips: [
      'Das Kontextmenü erspart lange Wege in Seitenleisten: Die wichtigsten Aktionen liegen direkt am Mauszeiger.',
      'Bei Mehrfachauswahl über Shift + Klick bietet das Menü Sammelaktionen (z. B. Gruppieren oder Auswahl sperren).'
    ],
    technicalDetails: [
      { label: 'Raycaster-Erkennung', value: '3D-Kollisionsprüfung an den exakten Mauszeiger-Koordinaten' },
      { label: 'Kontextmodi', value: 'Schubkasten, Tür, Konstruktionsteil und Leerraum' },
      { label: 'Animationen', value: 'Echtzeit-Drehung von Scharnieren und Schienen-Auszug' }
    ]
  },

  // 8. ANLEITUNG 8: 3D-Raum & Geräte
  {
    id: 'habitacion_equipos_3d',
    category: 'herramientas_3d',
    title: '3D-Raum & Geräte',
    shortDesc: 'Realistische Werkstatt- oder Raumszene mit anpassbaren Wänden und Böden sowie normierten 3D-Elektrogeräten im 3-Zonen-Inspektor.',
    icon: 'room',
    iconColor: 'text-emerald-500',
    badge: 'Visualisierung & Umgebung',
    steps: [
      'Aktivieren Sie in Zone 1 (Obere Leiste) den Raummodus, um Begrenzungswände und Boden mit anpassbaren Abmessungen und Texturen einzublenden.',
      'Klicken Sie auf "+ 3D-Gerät" in der oberen Leiste oder wechseln Sie im rechten Inspektor (Zone 3) auf den Reiter "Geräte".',
      'Wählen Sie aus genormten Einbaugeräten: Einzel- und Side-by-Side-Kühlschränke, Einbaubacköfen, Mikrowellen, Dunstabzugshauben, Edelstahlspülen und Geschirrspüler.',
      'Fügen Sie das Gerät in den 3D-Raum ein und positionieren Sie es direkt in der Nische des vorgesehenen Möbels.',
      'Passen Sie im rechten Inspektor Einbauhöhe (Y) und Drehung an und kontrollieren Sie Nischenmaße und Lüftungsabstände nach Herstellervorgaben.',
      'Fixieren Sie das Gerät mit der Schlossschaltfläche, sobald die Position stimmt.'
    ],
    tips: [
      'Platzieren Sie beim Spülenschrank die 3D-Spüle auf der Arbeitsplatte, um den Ausschnitt zu überprüfen und Rohrleitungskollisionen auszuschließen.',
      'Elektrogeräte dienen ausschließlich der visuellen Raumplanung und erzeugen keine Teile im 2D-Zuschnittplan.'
    ],
    technicalDetails: [
      { label: 'Gerätekatalog', value: 'Kühlschrank, Backofen, Mikrowelle, Spüle, Haube, Geschirrspüler' },
      { label: 'Wände & Boden', value: 'Millimetergenaue Maße mit Fliesen- und Holzstrukturen' },
      { label: 'Einbautoleranzen', value: 'Sichtprüfung von Gerätenischen und Lüftungsquerschnitten' },
      { label: 'Integration', value: '3-Zonen-Arbeitsbereich und kontextueller Eigenschaftsinspektor' }
    ]
  },

  // 9. ANLEITUNG 9: Direktes 3D-Ziehen & Vertikalschienen-Führung
  {
    id: 'movimiento_directo_3d',
    category: 'herramientas_3d',
    title: 'Direktes 3D-Ziehen & Vertikalschienen-Führung',
    shortDesc: 'Verschieben Sie Teile oder Korpusse direkt per Mausklick auf jede Fläche mit planarer Zwangsführung und kollisionsfreier Vertikalschiene.',
    icon: 'pan_tool',
    iconColor: 'text-sky-600',
    badge: 'Natürliche Interaktion',
    steps: [
      'Klicken Sie mit der linken Maustaste auf ein beliebiges Bauteil oder einen Korpus im 3D-Viewport.',
      'Der Mauszeiger wechselt beim Überfahren zur offenen Hand und beim Klick zur geschlossenen Greifhand.',
      'Ziehen Sie mit der Maus: Die Bewegung bleibt planar auf das Bauteil beschränkt bzw. auf die Vertikalschiene bei Fachböden.',
      'Gehört das Bauteil zu einer Baugruppe (z. B. ein Schubkasten mit Front, Zargen und Boden), bewegt sich die gesamte Gruppe synchron.',
      'Für millimetergenaue Feinausrichtung nutzen Sie die Pfeiltasten der Tastatur (1 mm Schrittweite, oder 10 mm bei gehaltener Shift-Taste).',
      'Zum Umdimensionieren nutzen Sie die kubischen Begrenzungs-Gizmos oder die Eingabefelder im rechten Inspektor.'
    ],
    tips: [
      'Drücken Sie [ W ] (+10 mm) oder [ S ] (-10 mm), um selektierte Teile auf der vertikalen Y-Achse schnell anzuheben oder abzusenken.',
      'Mit [ Strg + Z ] machen Sie versehentliche Verschiebungen sofort rückgängig.'
    ],
    technicalDetails: [
      { label: 'Zieh-Methode', value: 'Direktes Ziehen am Mesh mit koplanarem CAD-Raycasting' },
      { label: 'Modulare Bewegung', value: 'Synchronisation über Modul-ID und Baugruppenhierarchie' },
      { label: 'Feinjustierung', value: '1 mm / 10 mm Schrittweite über Tastaturpfeile' },
      { label: 'Rückgängig / Wiederholen', value: 'Vollständige Historie über [ Strg + Z ] / [ Strg + Y ]' }
    ]
  },

  // 10. ANLEITUNG 10: Kontextuelle Aktionsleiste & Obere Werkzeugleiste
  {
    id: 'cinta_acciones_flotante',
    category: 'herramientas_3d',
    title: 'Kontextuelle Aktionsleiste & Obere Werkzeugleiste',
    shortDesc: 'Schwebende Kontextleiste zum Duplizieren, 90°-Drehen, Ausrichtung ändern, Sperren und Zuweisen von Dekoren in einem Schritt.',
    icon: 'dashboard_customize',
    iconColor: 'text-emerald-600',
    badge: 'Obere Leiste',
    steps: [
      'Sobald Sie ein Bauteil oder einen Korpus im 3D-Viewport auswählen, erscheint die schwebende Leiste oben im Ansichtsfenster.',
      'Die Leiste zeigt die Anzahl markierter Teile und Direktaktionen:',
      '• "Duplizieren": Klont das Element zur Seite inklusive Beschlägen und Bohrungen.',
      '• "90° Drehen [ R ]": Rotiert die Auswahl um 90 Grad um den gemeinsamen Mittelpunkt.',
      '• "Einfrieren": Sperrt oder entsperrt die Auswahl gegen unbeabsichtigtes Bewegen.',
      '• "Verschieben": Aktiviert das schnelle Transformationswerkzeug.',
      '• "Melamin-Palette": Öffnet die Dekorauswahl, um allen markierten Teilen gleichzeitig ein Dekor zuzuweisen.',
      '• "Löschen [ Entf ]": Entfernt markierte Bauteile aus dem Entwurf.',
      'Links oben zeigt eine Infobox den Bauteilnamen und die Abmessungen (L × B × D).'
    ],
    tips: [
      'Die Leiste wird nur bei aktiver Auswahl eingeblendet, sodass der Blickwinkel beim Navigieren stets unverstellt bleibt.',
      'Über die Taste [ R ] können Sie die Auswahl jederzeit um 90° drehen, ohne auf den Button klicken zu müssen.'
    ],
    technicalDetails: [
      { label: 'Sichtbarkeit', value: 'Kontextabhängig reaktiv (nur bei aktiver Selektion sichtbar)' },
      { label: 'Stapelaktionen', value: 'Duplizieren, 90° Drehen, Sperren, Verschieben, Dekor und Löschen' },
      { label: 'Rotationskürzel', value: 'Taste [ R ] oder [ Q ]' },
      { label: 'Löschkürzel', value: 'Taste [ Entf ] oder [ Rückschritt ]' }
    ]
  },

  // 11. ANLEITUNG 11: Shift-Mehrfachauswahl & Stapelbearbeitung
  {
    id: 'seleccion_multiple_shift',
    category: 'modulos_piezas',
    title: 'Shift-Mehrfachauswahl & Stapelbearbeitung',
    shortDesc: 'Erfassen Sie mehrere Korpusse und Teile per Auswahlfenster oder Shift + Klick zum Drehen, Verschieben, Duplizieren und gemeinsamen Umfärben.',
    icon: 'format_shapes',
    iconColor: 'text-sky-600',
    badge: 'Stapelbearbeitung',
    steps: [
      'Auswahlfenster: Halten Sie [ Shift ] gedrückt und ziehen Sie mit linker Maustaste ein Auswahlfenster im 3D-Viewport. Ein transparenter Rahmen erfasst alle berührten Teile, ohne die Kamera zu drehen.',
      'Additive Einzelselektion: Halten Sie [ Shift ] und klicken Sie auf Bauteile oder Korpusse, um sie zur Auswahl hinzuzufügen oder abzuwählen.',
      'Zähler in der Werkzeugleiste: Ein Indikator oben zeigt die Gesamtzahl ausgewählter Teile (z. B. "8 Teile ausgewählt").',
      'Gemeinsame Drehung: Drücken Sie [ R ], um alle markierten Teile um 90° um ihren gemeinsamen Schwerpunkt zu drehen, ohne die Relativabstände zu verändern.',
      'Stapel-Dekorzuweisung: Wählen Sie ein Material aus der Palette, um Textur und Farbe aller markierten Platten gleichzeitig anzupassen.',
      'Um die Auswahl aufzuheben, klicken Sie in den freien Raum oder drücken Sie [ Esc ].'
    ],
    tips: [
      'Bei Mehrfachauswahl ganzer Korpusse werden Einzelmaße im 3D ausgeblendet, um eine übersichtliche Darstellung zu gewährleisten.',
      'Duplizieren Sie eine komplette Reihe von Unterschränken mit Shift, um Schrankzeilen in Sekundenschnelle aufzubauen.'
    ],
    technicalDetails: [
      { label: 'Auswahlfenster', value: 'Shift + Mausziehen (sperrt Kameradrehung)' },
      { label: 'Additive Auswahl', value: 'Shift + Klick auf Bauteil oder Korpus' },
      { label: 'Gemeinsame Drehung', value: 'Schwerpunktberechnung für symmetrischen 90°-Schwenk' },
      { label: 'Stapeleigenschaften', value: 'Materialien, Dekore, Duplikation und Sperrung' }
    ]
  },

  // 12. ANLEITUNG 12: Sonderschnitte, Fasen & U-Siphon-Ausklinkung
  {
    id: 'cortes_especiales_sifon',
    category: 'modulos_piezas',
    title: 'Sonderschnitte, Fasen & U-Siphon-Ausklinkung',
    shortDesc: 'Fortgeschrittene Bearbeitungen für Arbeitsplatten und Waschtische: L-Ausklinkungen für Pfeiler, 45°-Fasen, Diagonalschnitte und U-Siphon-Ausschnitt.',
    icon: 'scissors',
    iconColor: 'text-amber-600',
    badge: 'Spezialbearbeitung',
    steps: [
      'Wählen Sie die Arbeitsplatte, Abdeckung oder den Fachboden im 3D-Viewport aus.',
      'Navigieren Sie im rechten Inspektor (Zone 3) zu "Sonderschnitte & Ecken" und "U-Siphon-Ausklinkung".',
      'Wählen Sie den benötigten Schnitttyp je nach Raumsituation:',
      '• Gerade / Rücksprung: Längenanpassungen zur Einpassung von Platten zwischen schiefen Wänden.',
      '• 45°-Fase: Abgeschrägte Sicherheitskanten für Kücheninseln oder Durchgangsbereiche.',
      '• Diagonalschnitt: Schräge Eckabschlüsse für Endschränke in engen Fluren.',
      '• L-Ausklinkung (Pfeiler): Eckausklinkung an der Rückseite zur Umgehung von Mauervorsprüngen und Schornsteinen.',
      'U-Siphon-Ausklinkung (Badmöbel): Aktivieren Sie bei oberen Waschtisch-Schubkästen "U-Siphon-Ausklinkung". Geben Sie Breite und Tiefe des Mittelausschnitts ein, um Raum für den Siphon zu schaffen, ohne Stauraum links und rechts zu verlieren.',
      'Beim Export in DXF CNC oder Werkstatt-PDF werden Sonderschnitte als geschlossene LWPOLYLINE-Vektoren millimetergenau ausgegeben.'
    ],
    tips: [
      'Die U-Siphon-Ausklinkung generiert automatisch die inneren Schutzzargen des Schubkastens, um offene Schnittkanten um das Rohr sauber abzudecken.',
      '45°-Fasen an Arbeitsplattenkanten verringern die Verletzungsgefahr in Haushalten mit Kleinkindern.'
    ],
    technicalDetails: [
      { label: 'Schnitttypen', value: 'Gerade, 45°-Fase, Diagonal, L-Ausklinkung und U-Siphon' },
      { label: 'Badezimmer-Einsatz', value: 'Parametrischer Ausschnitt für Siphon und Abwasserrohr' },
      { label: 'DXF-Export', value: 'Geschlossene LWPOLYLINE-Geometrien in eigenem Layer' },
      { label: 'PDF-Zeichnungen', value: 'Automatische Bemaßung von Radien, Fasen und Ausklinkungen' }
    ]
  },

  // 13. ANLEITUNG 13: Automatische CNC-Bearbeitungen & Bohrbilder
  {
    id: 'mecanizados_cnc',
    category: 'mecanizados',
    title: 'Automatische CNC-Bearbeitungen & Bohrbilder',
    shortDesc: 'Wie die intelligente Engine Verbindungsschrauben, Holzdübel und Topfbandbohrungen durch Kontaktflächenanalyse berechnet.',
    icon: 'adjust',
    iconColor: 'text-sky-600',
    badge: 'Intelligente Berechnung',
    steps: [
      'Das System analysiert automatisch sämtliche Berührungsflächen zwischen aneinandergrenzenden Bauteilen (Seiten mit Boden, Deckel, Festböden oder Mittelseiten).',
      'Es erkennt die Ausrichtung der Verbindung (90°-Stumpfstoß oder Frontanschlag).',
      'Es berechnet exakte Bohrkoordinaten nach handwerklichen Tischlerstandards:',
      '• Korpus-Verbindungsschrauben (Cyan): Durchgangsbohrung Ø 4 mm auf der Außenseite und Vorbohrung Ø 3 mm × 30 mm in der Kante des Gegenstücks, jeweils 50 mm und 100 mm von den Kanten.',
      '• Holzdübel (Bernstein): Sacklochbohrungen Ø 8 mm × 15 mm in beiden Kontaktflächen für verdeckte Korpusverbindungen ohne sichtbare Schrauben.',
      '• Topfbandbohrungen (Lila): An Drehtüren automatische Topfbohrungen Ø 35 mm × 12,5 mm, jeweils 100 mm von Ober- und Unterkante mit Topfabstand K = 4 mm.',
      'Zur visuellen Kontrolle im 3D-Modell aktivieren Sie die Bohrbildschaltfläche (Bohrersymbol) in der Werkzeugleiste.',
      'Beim DXF-CNC-Export werden alle Bohrungen in Vektor-Layern mit Durchmesser und Tiefe für CNC-Bearbeitungszentren ausgegeben.'
    ],
    tips: [
      'Bohrungen passen sich in Echtzeit automatisch an, sobald Plattenabmessungen oder -stärken verändert werden.',
      'Im Eigenschaftenfeld "Bauteil-Eigenschaften" können Sie die vollständige Koordinatenliste der zugewiesenen Bohrungen einsehen.',
      'Auf der technischen 2D-Zeichnung (PDF) ist jede Bauteilfläche mit Bohrkoordinaten für manuelle Bohrschablonen bemaßt.'
    ],
    technicalDetails: [
      { label: 'Verbindungsschraube', value: 'Ø 4 mm Durchgang + Ø 3 mm Vorbohrung (Cyan)' },
      { label: 'Holzdübel', value: 'Ø 8 mm × 15 mm Tiefe (Bernstein)' },
      { label: 'Topfbandbohrung', value: 'Ø 35 mm × 12,5 mm (Lila, K = 4 mm)' },
      { label: 'Kantenabstand', value: 'Standard 50 mm und 100 mm von Plattenecken' },
      { label: 'CNC-Export', value: 'DXF-CNC-Layer + Bemaßte Werkstatt-PDFs' }
    ]
  },

  // 14. ANLEITUNG 14: Reversible Scharniere & Synchronisierte Ø35mm Topfbohrungen
  {
    id: 'bisagras_reversibles',
    category: 'mecanizados',
    title: 'Reversible Scharniere & Synchronisierte Ø35mm Topfbohrungen',
    shortDesc: 'Öffnungsrichtung links oder rechts mit automatischer Neupositionierung von Bohrungen und 3D-Beschlägen.',
    icon: 'door_sliding',
    iconColor: 'text-sky-600',
    badge: 'Dynamische Scharniere',
    steps: [
      'Wählen Sie bei Drehtüren im Inspektor oder im Rechtsklick-Menü die Anschlagseite: "Tür (Anschlag Links)" oder "Tür (Anschlag Rechts)".',
      'Beim Wechsel der Seite wandert der 3D-Griff automatisch an die Gegenseite und die Topfbänder setzen an der entsprechenden Korpusseite an.',
      'Die lila Topfbohrungen Ø 35 mm × 12,5 mm werden sofort an der Scharnierkante neu berechnet (22 mm bis Bohrungsmitte, K = 4 mm).',
      'Beim Testen der Öffnungsanimation drehen die Topfbandbohrungen mit dem Türflügel synchron mit.'
    ],
    tips: [
      'Beim Klonen einer linken Tür zur rechten Schranktür synchronisiert das System sowohl die 3D-Optik als auch die technische Bohrbildliste.',
      'Das Kantenmaß K = 4 mm entspricht dem Industriestandard marktüblicher Scharniersysteme (Blum, Hettich, Grass, Salice).'
    ],
    technicalDetails: [
      { label: 'Topfbandnorm', value: 'Ø 35 mm × 12,5 mm Bohrtiefe' },
      { label: 'Kantenabstand K', value: '4 mm zur Kante / 22 mm zur Bohrungsmitte' },
      { label: 'Synchronisation', value: '3D-Band + Griff + Topfbohrung + Drehanimation' }
    ]
  },

  // 15. ANLEITUNG 15: Werkstattparameter, Sägeblatt-Schnittfuge (Kerf), Kanten & Notizen
  {
    id: 'parametros_taller_notas',
    category: 'optimizador',
    title: 'Werkstattparameter, Sägeblatt-Schnittfuge (Kerf), Kanten & Notizen',
    shortDesc: 'Millimetergenaue Zuschnittkalibrierung: Schnittfugenbreite (Kerf), Vorritz- und Besäumzugabe, Kantenverwaltung und Projektnotizbuch.',
    icon: 'precision_manufacturing',
    iconColor: 'text-sky-600',
    badge: 'Fertigungspräzision',
    steps: [
      'Vor dem Zuschnitt kalibrieren Sie die Fertigungsparameter im Optimierer oder in den Projekteinstellungen:',
      '• Sägeblatt-Schnittfuge (Kerf): Geben Sie die exakte Schnittbreite Ihres Sägeblatts ein (Standard 3,2 mm bis 4,0 mm). Der Optimierer zieht dieses Material bei jedem Trennschnitt ab, um Maßverluste zu vermeiden.',
      '• Besäumzugabe (Trim Margin): Bestimmen Sie den umlaufenden Randschnitt der Rohplatte (z. B. 10 mm je Seite), um Transportschäden zu beseitigen.',
      '• Kantenbänder (Dünnkante 0,45 mm vs Dickkante 2,0 mm): Weisen Sie den Kanten (L1, L2, B1, B2) Kantenmaterial zu. Dickkanten werden automatisch von den Zuschnittmaßen abgezogen.',
      '• Projektnotizbuch & Checkliste: Öffnen Sie das Notizbuch in der oberen Leiste für Kundenabsprachen, Montagewerkzeuglisten und Aufmaßnotizen.'
    ],
    tips: [
      'Fragen Sie bei Plattenzuschnitt durch Händler nach deren Sägeblattbreite (oft 4,0 mm oder 4,4 mm), um absolut übereinstimmende Schnittpläne zu erhalten.',
      'Die getrennte Erfassung von Dünn- und Dickkanten erleichtert den passgenauen Einkauf ganzer Kantenrollen.'
    ],
    technicalDetails: [
      { label: 'Schnittfugenbereich', value: '1,0 mm bis 6,0 mm (Empfehlung: 4,0 mm)' },
      { label: 'Besäumzugabe', value: '0 mm bis 30 mm je Seite (Standard: 10 mm)' },
      { label: 'Kantenkompensation', value: 'Automatischer 2 mm Dickkantenabzug in der Stückliste' },
      { label: 'Projektnotizbuch', value: 'Echtzeit-Cloud-Synchronisation mit Projektspeicherung' }
    ]
  },

  // 16. ANLEITUNG 16: 2D-Zuschnittoptimierung, Stückliste & Kantenabzug
  {
    id: 'optimizador_despiece',
    category: 'optimizador',
    title: '2D-Zuschnittoptimierung, Stückliste & Kantenabzug',
    shortDesc: 'Guillotine-Algorithmus für maximale Plattenausnutzung unter Berücksichtigung von Faserverlauf, Besäumschnitt und Kantenstärkenabzug.',
    icon: 'precision_manufacturing',
    iconColor: 'text-sky-600',
    badge: 'Einsparung',
    steps: [
      'Öffnen Sie den Reiter "3. 2D-Optimierer" in der oberen Leiste.',
      'Geben Sie die Maße der Rohplatte (z. B. 2800 × 2070 mm oder 2440 × 1830 mm) und die Sägeblattstärke ein (Kerf = 4 mm Standard).',
      'Legen Sie die umlaufende Besäumzugabe fest (z. B. 10 mm), um Kanten zu säubern.',
      'Aktivieren Sie "Kanten beim Zuschnitt abziehen", wenn 2 mm PVC-Dickkanten verarbeitet werden.',
      'Der Algorithmus berechnet Zuschnittfolgen unter strenger Einhaltung von Längs- oder Querfaserverlauf und minimalem Verschnitt.',
      'Prüfen Sie den Auswertungsbericht: Flächenausnutzung in Prozent, Kanten-Laufmeter und nummerierter Schnittplan.',
      'Klicken Sie auf "Technischen 2D-Plan exportieren", um die druckfertige Werkstatt-PDF herunterzuladen.'
    ],
    tips: [
      'Drucken Sie Selbstklebe-Etiketten für jedes Bauteil mit Korpuszugehörigkeit, exakten Sägewerten und Kantenbelegung aus.',
      'Der 2D-Guillotine-Algorithmus erzeugt durchgehende Trennschnitte, die sich sowohl für manuelle Formatkreissägen als auch für automatische Plattenaufteilsägen eignen.'
    ],
    technicalDetails: [
      { label: 'Algorithmus', value: 'Guillotine 2D mit strikter Faserverlaufskontrolle' },
      { label: 'Parameter', value: 'Sägeblattstärke (0-10 mm), Besäumschnitt (0-25 mm)' },
      { label: 'Kantenabzug', value: '0,45 mm und 2,0 mm an konfigurierten Kanten' }
    ]
  },

  // 17. ANLEITUNG 17: Kurzanleitung Tastaturkürzel
  {
    id: 'atajos_teclado',
    category: 'atajos',
    title: 'Kurzanleitung Tastaturkürzel',
    shortDesc: 'Arbeiten Sie mit maximaler Effizienz dank konfliktfreier Direktkürzel zum Auswählen, Drehen, Bewegen, Messen und Transformieren.',
    icon: 'keyboard',
    iconColor: 'text-emerald-600',
    badge: 'Produktivität',
    steps: [
      '• [ V ] oder [ Leertaste ]: Auswahlwerkzeug (Shift + Klick zum Hinzufügen/Abwählen von Bauteilen oder Korpussen)',
      '• [ Shift + Ziehen ]: Mehrfachauswahl-Fenster. Sperrt die Kamera und erfasst mehrere Korpusse oder Platten als Gruppe',
      '• [ Shift + Klick ]: Bauteile zur aktiven Auswahl hinzufügen oder entfernen',
      '• [ M ]: Verschiebewerkzeug (Transformation im 3D-Raum zum Platzieren von Modulen)',
      '• [ R ] / [ Q ]: Markiertes Bauteil, Schubkasten oder Korpusse um 90° um den gemeinsamen Schwerpunkt drehen',
      '• [ T ]: 3D-Maßband mit magnetischem Fangen an Eckpunkten und Kanten',
      '• [ Z ]: 3D-Kamera zentrieren und Blickwinkel zurücksetzen',
      '• [ W ] / [ S ]: Selektiertes Bauteil auf der vertikalen Y-Achse heben oder senken (+/-10 mm)',
      '• [ Pfeiltasten ]: Millimeterweises Verschieben der Auswahl (1 mm bzw. 10 mm mit Shift)',
      '• [ G ]: Raumhilfslinien und 1,72 m menschliches Maßstabsmodell ein-/ausblenden',
      '• [ H ] / [ Alt + H ]: Auswahl vorübergehend ausblenden bzw. alle verborgenen Teile wieder anzeigen',
      '• [ Entf / Rückschritt ]: Markierte Bauteile oder Korpusse sofort löschen',
      '• [ Strg + Z ] / [ Cmd + Z ]: Letzte Aktion rückgängig machen (Undo)',
      '• [ Strg + Y ] / [ Cmd + Shift + Z ]: Rückgängig gemachte Aktion wiederherstellen (Redo)',
      '• [ Esc ]: Aktives Werkzeug abbrechen, Auswahl aufheben oder Modals schließen'
    ],
    tips: [
      'Mehrfachauswahl in der Szene: Halten Sie [ Shift ] und ziehen Sie mit linker Maustaste im 3D-Viewport. Das Auswahlfenster erfasst alle berührten Korpusse, ohne die Szene zu rotieren.',
      'Kürzel [ R ] exklusiv zum DREHEN: Beim Drücken von R mit markiertem Korpus dreht sich dieser sofort um 90°, ohne das aktive Werkzeug zu wechseln.',
      'Die Leertaste oder Taste [ V ] bringt Sie jederzeit sofort zum Standard-Auswahlwerkzeug zurück.'
    ],
    technicalDetails: [
      { label: '3D-Auswahlfenster', value: 'Shift + Mausziehen' },
      { label: 'Zur Auswahl hinzufügen', value: 'Shift + Klick auf Bauteil' },
      { label: '90°-Drehung', value: 'Taste [ R ] oder [ Q ] (Modul oder Auswahl)' },
      { label: 'Verschieben', value: 'Taste [ M ]' },
      { label: 'Maßband', value: 'Taste [ T ]' },
      { label: 'Auswahlwerkzeug', value: 'Taste [ V ] oder [ Leertaste ]' },
      { label: 'Kamera zentrieren', value: 'Taste [ Z ]' },
      { label: 'Menschliches Modell', value: 'Taste [ G ]' }
    ]
  }
];

export const APP_DOC_ARTICLES_BY_LANG: Record<AppLanguage, DocArticle[]> = {
  es: DOC_ARTICLES_ES,
  en: DOC_ARTICLES_EN,
  pt: DOC_ARTICLES_PT,
  fr: DOC_ARTICLES_FR,
  it: DOC_ARTICLES_IT,
  de: DOC_ARTICLES_DE
};
