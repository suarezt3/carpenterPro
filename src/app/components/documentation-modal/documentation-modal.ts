import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Archive01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  Compass01Icon,
  InformationCircleIcon,
  Layers01Icon,
  LockIcon,
  Note01Icon,
  RulerIcon,
  Search01Icon,
  Settings01Icon
} from '@hugeicons/core-free-icons';
import { ThemeService } from '../../services/theme.service';

type HugeIconDef = typeof Compass01Icon;
const docSvg = (paths: string[]): HugeIconDef =>
  paths.map((d, idx) => ['path', { d, key: `doc_${idx}` }]) as unknown as HugeIconDef;

/**
 * Estructura de un artículo o guía interactiva dentro del manual técnico de Piezo3D Studio.
 */
export interface DocArticle {
  id: string;
  category: 'mecanizados' | 'cinta_metrica' | 'herramientas_3d' | 'modulos_piezas' | 'optimizador' | 'atajos';
  title: string;
  shortDesc: string;
  icon: string;
  iconColor: string;
  badge?: string;
  steps: string[];
  tips: string[];
  technicalDetails?: { label: string; value: string }[];
}

/**
 * Modal de documentación técnica interactiva y manual de usuario.
 * Permite consultar guías paso a paso por categoría, herramienta CAD, mecanizados CNC,
 * escala humana, bloqueo de piezas, atajos de teclado y optimización de corte.
 */
@Component({
  selector: 'app-documentation-modal',
  imports: [HugeiconsIconComponent],
  templateUrl: './documentation-modal.html',
  styleUrl: './documentation-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentationModalComponent {
  readonly themeService = inject(ThemeService);

  // Registro local de iconos vectoriales verificados
  readonly icons = {
    book: docSvg([
      'M4 5.5A2.5 2.5 0 0 1 6.5 3H20V19H6.5A2.5 2.5 0 0 0 4 21.5V5.5Z',
      'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
      'M8 7H16',
      'M8 11H14'
    ]),
    close: Cancel01Icon,
    search: Search01Icon,
    cancel: Cancel01Icon,
    searchOff: Search01Icon,
    tune: Settings01Icon,
    listNumbered: CheckListIcon,
    lightbulb: InformationCircleIcon,
    verified: CheckmarkCircle02Icon,
    arrowLeft: ArrowLeft01Icon,
    arrowRight: ArrowRight01Icon,
    lock: LockIcon,
    keyboard: docSvg([
      'M3 6H21V18H3V6Z',
      'M7 10H8',
      'M11 10H13',
      'M16 10H17',
      'M7 14H17'
    ]),
    cube3d: docSvg([
      'M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z',
      'M12 12L20 7.5',
      'M12 12L4 7.5',
      'M12 12V21'
    ]),
    doorSwing: docSvg([
      'M5 3H19V21H5V3Z',
      'M12 3L17.5 5.5V18.5L12 21V3Z'
    ]),
    humanFigure: docSvg([
      'M12 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
      'M9 7h6a2 2 0 0 1 2 2v5h-2v7h-2v-6h-2v6H9v-7H7V9a2 2 0 0 1 2-2z'
    ]),
    mouseContext: docSvg([
      'M12 2C8.686 2 6 4.686 6 8v8c0 3.314 2.686 6 6 6s6-2.686 6-6V8c0-3.314-2.686-6-6-6z',
      'M12 6v4',
      'M12 2v8h6'
    ]),
    roomEnvironment: docSvg([
      'M3 21h18',
      'M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16',
      'M9 9h6',
      'M9 13h6',
      'M9 17h6'
    ])
  };

  // Estado de apertura del modal y evento de cierre
  readonly isOpen = input<boolean>(false);
  readonly modalClose = output<void>();
  readonly openChangelog = output<void>();

  // Signals reactivos para el buscador, categoría activa y artículo seleccionado
  readonly searchQuery = signal<string>('');
  readonly activeCategory = signal<string>('all');
  readonly selectedArticleId = signal<string>('escala_humana_brujula');

  readonly categories = [
    { id: 'all', label: 'Todas las Guías', icon: 'auto_stories' },
    { id: 'herramientas_3d', label: 'Herramientas 3D CAD', icon: 'architecture' },
    { id: 'mecanizados', label: 'Mecanizados CNC', icon: 'adjust', badge: 'Auto' },
    { id: 'cinta_metrica', label: 'Cinta Métrica 3D', icon: 'straighten', badge: 'Imán' },
    { id: 'modulos_piezas', label: 'Módulos y Plantillas', icon: 'view_in_ar' },
    { id: 'optimizador', label: 'Corte y Fabricación', icon: 'precision_manufacturing' },
    { id: 'atajos', label: 'Atajos de Teclado', icon: 'keyboard' }
  ];

  readonly articles: DocArticle[] = [
    // 1. NUEVA GUÍA: Escala Humana 1.72m y Brújula de Frente (+Z)
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
        'En el suelo, el marco perimetral del taller delimita los 5000 × 5000 mm con indicadores de alta visibilidad en sus bordes exteriores: destacando en azul "▲ FRENTE (+Z) · VISTA PRINCIPAL", y en gris "▼ ATRÁS (-Z)", "► IZQUIERDA (-X)" y "◄ DERECHA (+X)".',
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

    // 2. NUEVA GUÍA: Congelar / Fijar Piezas y Módulos (Candado)
    {
      id: 'bloqueo_congelar_piezas',
      category: 'herramientas_3d',
      title: 'Congelar / Fijar Piezas y Módulos (Candado 🔒)',
      shortDesc: 'Bloquea piezas individuales o conjuntos completos contra desplazamientos accidentales, modificaciones o borrados involuntarios.',
      icon: 'lock',
      iconColor: 'text-amber-500',
      badge: 'Protección de Diseño',
      steps: [
        'Selecciona la pieza o conjunto que deseas proteger en el visor 3D.',
        'Puedes congelar el elemento de dos formas rápidas:',
        '• Desde el Menú Contextual (Clic Derecho): Haz clic derecho sobre la pieza y selecciona "Congelar Solo Esta Pieza" o "Congelar Módulo Completo / Cajón Completo".',
        '• Desde la Cinta de Acciones Superior: Pulsa el botón con icono de candado.',
        'Una vez congelada, la pieza mostrará un distintivo ámbar con candado [ 🔒 Fijo ].',
        'La pieza o grupo congelado queda 100% blindado: no podrá ser movido por arrastre de ratón, ni estirado con Empujar/Tirar, ni eliminado con la tecla Supr.',
        'Para descongelar y volver a editar, haz clic derecho sobre el elemento y selecciona "Descongelar", o vuelve a pulsar el candado en la barra superior.'
      ],
      tips: [
        'Congela los laterales y la base de tu mueble una vez definidas sus dimensiones principales; así podrás mover y ajustar repisas internas o cajones sin mover la estructura exterior.',
        'Si congelas un cajón completo, tanto el frente, los costados, la trasera, el fondo y las correderas quedarán protegidos en un solo clic.',
        'Las piezas congeladas siguen apareciendo normalmente en el despiece de corte y presupuesto.'
      ],
      technicalDetails: [
        { label: 'Alcance', value: 'Pieza individual (part.isLocked) o Grupo (group.isLocked)' },
        { label: 'Efecto', value: 'Inhabilita traslación, Push/Pull, rotación y borrado' },
        { label: 'Identificador', value: 'Indicador visual ámbar con candado en 3D y listas' },
        { label: 'Persistencia', value: 'Se guarda en Supabase y archivo JSON de proyecto' }
      ]
    },

    // 3. NUEVA GUÍA: Menú Contextual Inteligente de Clic Derecho
    {
      id: 'menu_contextual_inteligente',
      category: 'herramientas_3d',
      title: 'Menú Contextual Inteligente de Clic Derecho',
      shortDesc: 'Menú contextual 3D adaptativo que cambia sus opciones dinámicamente según hagas clic en un Cajón, Puerta, Estructura o en el Espacio Vacío.',
      icon: 'mouse',
      iconColor: 'text-indigo-500',
      badge: 'Productividad 3D',
      steps: [
        'Haz clic con el botón derecho del ratón en cualquier punto del visor 3D.',
        'El menú detecta automáticamente qué elemento se encuentra bajo el cursor y te ofrece acciones específicas:',
        '• Clic en un Cajón: Acceso inmediato para probar apertura/cierre de correderas, congelar el cajón completo, duplicarlo, editar su manija o separar frente.',
        '• Clic en una Puerta: Alternar bisagra reversible (Izquierda / Derecha), abrir/cerrar puerta batiente, cambiar modelo de tirador o bloquear.',
        '• Clic en Pieza de Estructura: Rotar 90°, cambiar orientación (Horizontal / Vertical), duplicar, congelar o eliminar pieza.',
        '• Clic en Suelo o Espacio Vacío: Opciones rápidas para crear una nueva pieza rectangular, alternar la guía de escala humana, centrar cámara o restablecer vista.',
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

    // 4. NUEVA GUÍA: Modo Habitación 3D, Electrodomésticos y Patas de Mesa
    {
      id: 'habitacion_electrodomesticos_patas',
      category: 'modulos_piezas',
      title: 'Modo Habitación 3D, Electrodomésticos y Patas de Mesa',
      shortDesc: 'Ambiente realista de taller/cuarto con paredes y piso, inserción en 1 clic de electrodomésticos normalizados y patas de mesa de diseño.',
      icon: 'room',
      iconColor: 'text-emerald-500',
      badge: 'Visualización y Ambientación',
      steps: [
        'En la barra de herramientas puedes alternar el Modo Habitación para proyectar paredes perimetrales y piso con acabados personalizables.',
        'En el menú de inserción rápida dispones de dos catálogos especializados:',
        '• Electrodomésticos Paramétricos: Inserta refrigeradores (nevera simple o Side-by-Side), hornos empotrables, microondas, campanas extractoras, fregaderos de cocina (planchas de acero inoxidable) y lavavajillas con medidas comerciales estandarizadas.',
        '• Patas de Mesa y Estructuras: Añade patas estilo Horquilla (Hairpin de varilla metálica negra/dorada), Cilíndricas en acero inoxidable regulables en altura, o patas cónicas Escandinavas de madera maciza.',
        'Los electrodomésticos y patas se integran al espacio 3D para verificar que los huecos de encastre (nichos) cuenten con las tolerancias de ventilación requeridas.',
        'Puedes mover y reubicar los electrodomésticos haciendo clic sostenido y arrastrándolos igual que cualquier módulo.'
      ],
      tips: [
        'Al diseñar un mueble bajo para fregadero, coloca el fregadero 3D sobre la cubierta para calcular el rebaje y verificar que las divisiones internas no choquen con las cañerías del sifón.',
        'Las patas de mesa calculan automáticamente su costo unitario en el módulo de presupuesto de herrajes.'
      ],
      technicalDetails: [
        { label: 'Catálogo Electrodomésticos', value: 'Refrigerador, Horno, Microondas, Fregadero, Campana, Lavavajillas' },
        { label: 'Estilos de Patas', value: 'Hairpin 3 varillas, Cilíndrica Inox, Escandinava madera' },
        { label: 'Iluminación', value: 'Luz ambiental suave, focos direccionales y modo día/noche' }
      ]
    },

    // 5. NUEVA GUÍA: Parámetros de Taller, Kerf de Sierra, Tapacantos y Cuaderno de Notas
    {
      id: 'parametros_taller_notas',
      category: 'optimizador',
      title: 'Parámetros de Taller, Kerf de Sierra, Tapacantos y Notas',
      shortDesc: 'Configuración milimétrica del corte: espesor de la hoja de sierra (kerf), refilado perimetral, gestión de cantos y cuaderno de notas del proyecto.',
      icon: 'precision_manufacturing',
      iconColor: 'text-purple-500',
      badge: 'Precisión de Fabricación',
      steps: [
        'Antes de enviar a corte, ajusta los parámetros de fabricación en la pestaña del Optimizador o en Ajustes del Proyecto:',
        '• Espesor de Sierra (Kerf): Configura el ancho exacto del disco de corte de tu seccionadora (estándar 3.2 mm a 4.0 mm). El optimizador descontará este material en cada pasada para garantizar que las piezas no queden milímetros más pequeñas.',
        '• Refilado de Fábrica (Trim Margin): Establece el despunte perimetral del tablero (ej. 10 mm por lado). Elimina bordes golpeados, con humedad o cera del transporte de la placa.',
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

    // 6. Mecanizados y Perforaciones CNC Automáticas
    {
      id: 'mecanizados_cnc',
      category: 'mecanizados',
      title: 'Mecanizados y Perforaciones CNC Automáticas',
      shortDesc: 'Cómo el motor inteligente calcula tornillos de ensamble, espigas y bisagras analizando automáticamente las uniones de melamina.',
      icon: 'adjust',
      iconColor: 'text-sky-600',
      badge: 'Cálculo Inteligente',
      steps: [
        'El sistema analiza automáticamente todas las superficies de contacto y solapamiento entre piezas contiguas (por ejemplo: laterales con base, techo, estantes fijos o divisiones verticales).',
        'Detecta la orientación de la unión (ensamble a tope en ángulo de 90° o puertas frontales).',
        'Calcula las coordenadas exactas de perforación aplicando los estándares profesionales de carpintería y herrajes:',
        '• Tornillos de ensamble (Cian): Genera un taladro pasante de Ø 4 mm en la cara exterior y un taladro piloto/guía de Ø 3 mm x 30 mm en el canto de la pieza perpendicular, ubicados a 50 mm y 100 mm de cada borde.',
        '• Espigas / Tarugos de madera (Ámbar): Genera perforaciones de Ø 8 mm x 15 mm de profundidad en ambas piezas enfrentadas para ensamble oculto sin tornillos exteriores.',
        '• Cazoletas de Bisagras (Púrpura): En piezas configuradas como puerta, calcula automáticamente los huecos de Ø 35 mm x 12.5 mm de profundidad a 100 mm de los extremos superior e inferior, con distancia de cazoleta al borde K = 4 mm.',
        'Para visualizar los taladros en el visor 3D, haz clic en el botón de mecanizados (ícono de diana/taladro) en la barra vertical izquierda de herramientas. Los cilindros 3D se dibujarán con sus colores correspondientes.',
        'Al exportar a DXF CNC, todos estos puntos se exportan en capas vectoriales con sus diámetros y profundidades para centros de mecanizado CNC o routers.'
      ],
      tips: [
        'Los taladros se recalculan automáticamente en tiempo real cada vez que redimensionas una pieza, cambias su espesor o mueves un estante.',
        'En el panel derecho "Propiedades de la Pieza", puedes ver la lista detallada de taladros asignados a la pieza seleccionada.',
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

    // 7. Cinta Métrica y Acotado de Precisión CAD
    {
      id: 'cinta_metrica_cad',
      category: 'cinta_metrica',
      title: 'Cinta Métrica y Acotado de Precisión CAD',
      shortDesc: 'Medición milimétrica exacta con imán a esquinas/puntos medios, flechas CAD y cotas persistentes al orbitar el 3D.',
      icon: 'straighten',
      iconColor: 'text-amber-600',
      badge: 'Precisión Milimétrica',
      steps: [
        'Activa la herramienta pulsando el icono de cinta métrica en la barra vertical izquierda o presionando la tecla [ T ].',
        'Acerca el cursor a una esquina o arista de cualquier pieza. Observarás que el imán inteligente (indicador verde esmeralda) se bloquea con precisión matemática al vértice exacto, mostrando un rótulo con el nombre de la pieza.',
        'Haz clic en el vértice inicial (Punto A) y arrastra hacia la esquina o arista de destino (Punto B).',
        'Al soltar el clic, las flechas CAD finas indicarán con su punta matemática el inicio y fin exactos de la medida.',
        'La cota queda FIJA y PERSISTENTE en el espacio 3D. Puedes rotar, orbitar e inspeccionar el mueble desde cualquier ángulo sin que la medición desaparezca.',
        'En el panel compacto flotante a la izquierda podrás consultar la distancia euclidiana total (ej. 509 mm) y el desglose ortogonal en los ejes ΔX (ancho), ΔY (altura) y ΔZ (profundidad).',
        'Para tomar otra medida, pulsa el botón "Nueva Medida" o haz clic en un nuevo vértice. Para borrar la cota pulsa [ Esc ] o el botón "Borrar".'
      ],
      tips: [
        'El imán prioriza las esquinas exteriores para que piezas de medidas exactas (ej. 509 mm) marquen exactamente 509 mm sin falsos milímetros interiores.',
        'Las flechas cónicas CAD y la cruz de centro sutil nunca tapan las caras de la madera cuando rotas la vista.',
        'El panel compacto permanece anclado a la izquierda para no estorbar el centro de la pantalla.'
      ],
      technicalDetails: [
        { label: 'Imán de captura', value: '8 vértices (esquinas) + 12 puntos medios por pieza' },
        { label: 'Estilo gráfico', value: 'Flechas cónicas CAD + Retícula sutil en cruz' },
        { label: 'Desglose técnico', value: 'Distancia directa 3D + Deltas ΔX, ΔY, ΔZ' },
        { label: 'Persistencia 3D', value: 'Permite órbita y rotación continua sin borrado' }
      ]
    },

    // 8. Movimiento por Arrastre Directo 3D
    {
      id: 'movimiento_directo_3d',
      category: 'herramientas_3d',
      title: 'Movimiento por Arrastre Directo 3D',
      shortDesc: 'Mueve piezas individuales o grupos modulares (cajoneras) haciendo clic sostenido sobre cualquier superficie, sin flechas molestas en el centro.',
      icon: 'pan_tool',
      iconColor: 'text-indigo-600',
      badge: 'Interacción Natural',
      steps: [
        'Haz clic con el botón izquierdo sobre cualquier pieza o ensamble de grupo en el visor 3D.',
        'Observa que el cursor cambia a una mano abierta ("grab") al posar sobre el elemento seleccionado, y a mano cerrada ("grabbing") al hacer clic.',
        'Mantén presionado el botón izquierdo y arrastra el ratón suavemente hacia donde quieras mover la pieza o grupo en la escena.',
        'Si la pieza pertenece a un grupo modular (ej. un cajón con frente, laterales, fondo y correderas), todas las piezas del bloque se desplazarán unidas y sincronizadas.',
        'Las flechas de traslación axiales que antes se dibujaban en el centro han sido retiradas para darte un espacio de trabajo limpio, nítido y libre de ruido visual.',
        'Para redimensionar la pieza (largo y ancho), utiliza los tiradores interactivos cúbicos (azul y ámbar) situados en los bordes exteriores de la pieza seleccionada.'
      ],
      tips: [
        'Puedes presionar las flechas del teclado para ajustes milimétricos finos (1 mm o 10 mm manteniendo pulsada la tecla Shift).',
        'En la esquina inferior izquierda dispones del panel flotante de "Micro-Ajuste en Zoom" para desplazar la pieza en coordenadas exactas en X, Y o Z.',
        'Para deshacer cualquier movimiento presiona [ Ctrl + Z ] o el botón Deshacer.'
      ],
      technicalDetails: [
        { label: 'Método de arrastre', value: 'Clic sostenido directo sobre la malla (Plano CAD coplanar)' },
        { label: 'Movimiento grupal', value: 'Sincronizado para piezas con mismo groupId (cajones/módulos)' },
        { label: 'Tiradores de borde', value: 'Cubos interactivos perimetrales (Largo en azul, Ancho en ámbar)' },
        { label: 'Precisión CAD', value: 'Paso fino de 1 mm con soporte magnético' }
      ]
    },

    // 9. Cinta Flotante de Acciones Rápidas
    {
      id: 'cinta_acciones_flotante',
      category: 'herramientas_3d',
      title: 'Cinta Flotante de Acciones Rápidas y Gestión de Grupos',
      shortDesc: 'Menú contextual superior derecho para duplicar, rotar 90°, abrir/cerrar, cambiar orientación y desagrupar bloques modulares al instante.',
      icon: 'dashboard_customize',
      iconColor: 'text-emerald-600',
      badge: 'Barra Superior',
      steps: [
        'Al seleccionar cualquier pieza o grupo en el visor 3D, se despliega automáticamente la cinta oscura de acciones en la esquina superior derecha, respetando estrictamente los márgenes visuales sin tapar tu diseño.',
        'Si seleccionas un grupo o cajón modular, la cinta te permite:',
        '• "Duplicar": Crea una copia exacta de todo el módulo o cajón a un costado con sus herrajes y mecanizados.',
        '• "Mover": Activa el cursor de traslación rápida para arrastrar el bloque completo.',
        '• "Abrir / Cerrar": Extrae las correderas del cajón o gira la puerta del grupo para revisar su interior.',
        '• "90° (R)": Rota el ensamble completo 90 grados en el plano horizontal.',
        '• "Frente": Enfoca y selecciona de forma aislada la fachada frontal del cajón o puerta.',
        '• "Desagrupar": Separa el ensamble en piezas individuales independientes para editar sus partes por separado.',
        'Si seleccionas una pieza individual, dispones de: "Duplicar", "Mover", "90° (R)", "Orientación (Horizontal / Vertical)" y "Eliminar".',
        'En la esquina superior izquierda se muestra la tarjeta informativa con el nombre de la pieza, sus medidas (L × A × E) o el recuento de piezas del grupo.'
      ],
      tips: [
        'Ambas barras flotantes conservan un diseño minimalista que no obstruye la visibilidad del mueble 3D ni compite con los controles de cámara.',
        'Puedes presionar [ Q ] como atajo de teclado para la rotación rápida de 90° de la pieza seleccionada.'
      ],
      technicalDetails: [
        { label: 'Ubicación Acciones', value: 'Esquina superior derecha (top-3 right-3)' },
        { label: 'Ubicación Info', value: 'Esquina superior izquierda (top-3 left-16)' },
        { label: 'Operaciones Grupo', value: 'Duplicar, Mover, Abrir/Cerrar, 90° (R), Frente, Desagrupar' },
        { label: 'Operaciones Pieza', value: 'Duplicar, Mover, 90° (R), Orientación H/V, Eliminar' }
      ]
    },

    // 10. Dibujar Rectángulo 3D en el Lienzo CAD
    {
      id: 'dibujo_rectangulo_3d',
      category: 'herramientas_3d',
      title: 'Dibujar Rectángulo 3D en el Lienzo CAD',
      shortDesc: 'Traza placas y paneles rectangulares directamente en el suelo 3D o sobre caras de muebles con previsualización milimétrica dinámica.',
      icon: 'crop_square',
      iconColor: 'text-sky-600',
      badge: 'Atajo [ D ]',
      steps: [
        'Activa la herramienta de dibujo presionando la tecla [ D ] en tu teclado o haciendo clic en el icono de rectángulo de la paleta izquierda.',
        'Haz clic en el punto de inicio deseado (sobre el piso o sobre la superficie de una pieza existente).',
        'Arrastra el ratón: verás una retícula traslúcida cian proyectada en 3D que indica en tiempo real las dimensiones del rectángulo (Largo × Ancho en milímetros) con snap por defecto de 10 mm.',
        'Al soltar el clic, se creará instantáneamente una nueva pieza de melamina real con el espesor estándar del proyecto (15 mm o 18 mm).',
        'La nueva pieza se incorpora de inmediato a la lista de piezas, al despiece general, al optimizador de corte y al cálculo de mecanizados CNC.',
        'Si deseas cancelar el trazado en cualquier momento antes de soltar el clic, simplemente pulsa la tecla [ Esc ].'
      ],
      tips: [
        'Una vez creada la pieza, puedes presionar [ P ] para usar la herramienta Empujar/Tirar y ajustar su espesor, o hacer clic y arrastrar para reubicarla.',
        'El sistema previene la creación de micro-piezas accidentales exigiendo una dimensión mínima de 60 × 60 mm.'
      ],
      technicalDetails: [
        { label: 'Atajo rápido', value: 'Tecla [ D ]' },
        { label: 'Snap de dibujo', value: 'Incrementos de 10 mm durante el trazado' },
        { label: 'Dimensión mínima', value: '60 mm x 60 mm (evita clics accidentales)' },
        { label: 'Espesor inicial', value: '15 mm o 18 mm según la configuración activa' }
      ]
    },

    // 11. Empujar / Tirar (Push/Pull)
    {
      id: 'push_pull_tool',
      category: 'herramientas_3d',
      title: 'Empujar / Tirar (Push/Pull) y Edición Directa 3D',
      shortDesc: 'Redimensiona piezas estirando sus caras en tiempo real con auto-alineación coplanar e imán inteligente.',
      icon: 'open_in_full',
      iconColor: 'text-amber-600',
      badge: 'Modelado Dinámico',
      steps: [
        'Selecciona la herramienta "Empujar / Tirar" en la paleta izquierda o pulsa la tecla [ P ].',
        'Pasa el cursor sobre la cara de cualquier pieza que desees estirar o acortar (lateral, techo, estante, frente de cajón). La cara se resaltará con un plano traslúcido ámbar.',
        'Haz clic y arrastra el ratón a lo largo del eje normal de la cara para modificar su longitud, profundidad o altura.',
        'El sistema cuenta con imán de coplanaridad: cuando la cara que estás estirando se acerca a la cara de otra pieza contigua, se ajustará automáticamente a la misma altura o profundidad.',
        'Suelta el ratón para confirmar el nuevo tamaño de la pieza.'
      ],
      tips: [
        'Recuerda: para mover de lugar una pieza completa, simplemente haz clic sostenido y arrástrala. Utiliza Empujar/Tirar [ P ] específicamente cuando desees alargar, ensanchar o variar espesores.',
        'No necesitas calcular restas matemáticas; estira el estante hasta tocar el lateral contiguo y el imán lo alineará exactamente.',
        'Todos los despieces y listas de corte se recalculan instantáneamente.'
      ],
      technicalDetails: [
        { label: 'Ejes soportados', value: 'Largo (X), Alto/Espesor (Y), Profundidad (Z)' },
        { label: 'Imán de caras', value: 'Alineación automática con piezas vecinas' },
        { label: 'Atajo rápido', value: 'Tecla [ P ]' }
      ]
    },

    // 12. Luz Libre (Cálculo Automático de Holguras Útiles)
    {
      id: 'luz_libre_tool',
      category: 'herramientas_3d',
      title: 'Luz Libre (Cálculo Automático de Holguras Útiles)',
      shortDesc: 'Visualiza el espacio útil real en milímetros entre estantes, divisiones y laterales para ubicar objetos y electrodomésticos.',
      icon: 'height',
      iconColor: 'text-emerald-600',
      badge: 'Ergonomía',
      steps: [
        'Activa la herramienta "Luz Libre" con el icono de doble flecha vertical en la paleta izquierda.',
        'Haz clic en cualquier estante o división interna.',
        'El sistema calculará y proyectará líneas verdes discontinuas en 3D indicando el hueco libre exacto hacia el techo, piso o laterales más cercanos.',
        'Esto te permite verificar si cabe un electrodoméstico (ej. microondas de 380 mm) o carpetas de oficina sin necesidad de restar espesores manualmente.'
      ],
      tips: [
        'Combina Luz Libre con la herramienta Empujar/Tirar para ajustar la posición del estante hasta obtener la luz libre deseada.'
      ],
      technicalDetails: [
        { label: 'Direcciones', value: 'Luz superior, inferior, izquierda y derecha' },
        { label: 'Tolerancia', value: 'Descuenta automáticamente los 15 mm o 18 mm de espesor de placas' }
      ]
    },

    // 13. Catálogo de Plantillas de Muebles
    {
      id: 'plantillas_muebles',
      category: 'modulos_piezas',
      title: 'Catálogo de Plantillas de Muebles y Asistente Modular',
      shortDesc: 'Diseña módulos paramétricos a medida o carga plantillas listas de Cocina, Baño, Closets y Cajoneras con opción de reemplazar o añadir al 3D.',
      icon: 'menu_book',
      iconColor: 'text-blue-600',
      badge: 'Asistente Paramétrico',
      steps: [
        'Haz clic en el botón "Plantillas" en la barra superior del modelador 3D.',
        'Utiliza el Asistente Paramétrico para configurar ancho, alto, profundidad, cantidad de entrepaños (uniformes o manuales), puertas y manijas, o explora el catálogo prediseñado.',
        'Al insertar cualquier módulo o plantilla podrás elegir:',
        '• "Reemplazar actual": Limpia el lienzo actual y carga el mueble seleccionado centrado en el espacio 3D.',
        '• "Añadir al taller": Coloca el mueble junto al diseño actual sin borrar tus piezas previas, ideal para componer cocinas o armarios completos.',
        '• "Lienzo en Blanco": Inicia un diseño desde cero.'
      ],
      tips: [
        'Todas las piezas generadas son 100% editables: puedes usar el botón "Editar Módulo" de la cinta superior para reconfigurar sus parámetros en cualquier momento.'
      ],
      technicalDetails: [
        { label: 'Categorías', value: 'Cocina Bajo/Alto, Closets, Baño, Estanterías y Cajoneras' },
        { label: 'Edición en Vivo', value: 'Reconstrucción paramétrica sin perder posición 3D' },
        { label: 'Modos de Carga', value: 'Reemplazo total o Adición lateral en 3D' }
      ]
    },

    // 14. Creación y Gestión de Conjuntos (Grupos)
    {
      id: 'agrupacion_conjuntos',
      category: 'modulos_piezas',
      title: 'Creación y Gestión de Conjuntos (Mesas, Módulos y Cajones)',
      shortDesc: 'Aprende a agrupar múltiples piezas melamínicas y accesorios (patas, puertas, frentes) en un solo bloque con nombre personalizado.',
      icon: 'format_shapes',
      iconColor: 'text-indigo-600',
      badge: 'Agrupación Libre',
      steps: [
        'Para agrupar varias piezas (por ejemplo, la cubierta de una mesa con sus 4 patas y faldones, o un mueble armado a medida):',
        '1. Selecciona las piezas deseadas manteniendo presionada la tecla [ Shift ] y haciendo clic sobre cada una en el visor 3D o en la cinta inferior de piezas.',
        '2. También puedes usar el botón "Todo" para seleccionar todas las piezas del lienzo a la vez.',
        '3. Haz clic en el botón "Agrupar" que aparecerá en la barra flotante superior.',
        '4. Asigna un nombre descriptivo al conjunto (ej. "Mesa Comedor", "Cajón 1", "Módulo Alacena").',
        '5. A partir de ese momento, al hacer clic sobre cualquiera de las piezas del conjunto, todo el bloque se seleccionará rígidamente.',
        '6. Si necesitas modificar una pieza por separado, selecciona el grupo y haz clic en "Desagrupar" en la barra superior.'
      ],
      tips: [
        'Los conjuntos agrupados se conservan al guardar en Supabase y al descargar tu archivo JSON de proyecto.',
        'Si duplicas un grupo con el botón "Duplicar", se creará una copia idéntica del ensamble completo.'
      ],
      technicalDetails: [
        { label: 'Soporte de piezas', value: 'Piezas melamínicas, puertas, estantes y cajones' },
        { label: 'Rotación en bloque', value: 'Cálculo de centroide común para rotación 90° / 180°' },
        { label: 'Desagrupamiento', value: 'Retorno a piezas independientes con un solo clic' }
      ]
    },

    // 15. Bisagras y Taladros Cazoleta Reversibles
    {
      id: 'bisagras_reversibles',
      category: 'mecanizados',
      title: 'Bisagras y Taladros Cazoleta Ø35mm Reversibles Sincronizados',
      shortDesc: 'Apertura hacia la derecha o izquierda con reubicación automática de perforaciones púrpuras y herrajes 3D.',
      icon: 'door_sliding',
      iconColor: 'text-purple-600',
      badge: 'Bisagras Dinámicas',
      steps: [
        'Cuando creas o duplicas una puerta batiente para colocarla en el lado opuesto del mueble:',
        '1. En el menú contextual de clic derecho en 3D o desde Editar Módulo, selecciona el sentido de apertura deseado: "Puerta (Bisagra Izquierda)" o "Puerta (Bisagra Derecha)".',
        '2. Al cambiar el sentido, la manija/tirador 3D se ubicará en el borde opuesto y las bisagras 3D se trasladarán al borde correspondiente.',
        '3. Las perforaciones púrpuras de cazoleta Ø35mm x 12.5mm se recalcularán automáticamente en el borde de apertura (a 22mm de la arista).',
        '4. Al probar la animación con la opción "Animar / Abrir Pieza", los taladros de cazoleta rotarán integrados con la hoja de la puerta.'
      ],
      tips: [
        'Al clonar una puerta batiente izquierda para crear la derecha del mueble, el sistema sincronizará tanto la estética visual 3D como el despiece técnico de mecanizados.'
      ],
      technicalDetails: [
        { label: 'Estándar cazoleta', value: 'Ø 35 mm x 12.5 mm de profundidad' },
        { label: 'Distancia al borde K', value: '4 mm al canto / 22 mm al centro del taladro' },
        { label: 'Sincronización', value: 'Bisagra 3D + Tirador + Taladro cazoleta + Rotación animada' }
      ]
    },

    // 16. Optimización de Corte 2D y Despiece Milimétrico
    {
      id: 'optimizador_despiece',
      category: 'optimizador',
      title: 'Optimización de Corte 2D y Despiece Milimétrico',
      shortDesc: 'Algoritmo guillotina de máximo rendimiento de placas con kerf de sierra, refilado y etiquetas imprimibles.',
      icon: 'precision_manufacturing',
      iconColor: 'text-purple-600',
      badge: 'Ahorro de Material',
      steps: [
        'Ve a la pestaña "3. Optimizador 2D" en la barra superior.',
        'Configura el tamaño del tablero comercial (ej. 2440 x 1830 mm) y el espesor de la hoja de sierra (Kerf = 4 mm estándar).',
        'Establece el margen de refilado perimetral del tablero (ej. 10 mm) para limpiar bordes de fábrica.',
        'El motor organizará automáticamente los cortes respetando la dirección de la veta longitudinal o transversal de la melamina y minimizando los retazos sobrantes.',
        'Genera el reporte con el porcentaje de aprovechamiento, metros lineales de tapacanto y plano de corte con numeración de piezas.',
        'Pulsa "Exportar Plano 2D Técnico" para descargar el PDF de taller listo para imprimir.'
      ],
      tips: [
        'Puedes imprimir etiquetas adhesivas para cada pieza con su nombre de módulo, medidas exactas y esquema de bordes con tapacanto.'
      ],
      technicalDetails: [
        { label: 'Algoritmo', value: 'Guillotine 2D con respeto estricto de veta (Largo/Ancho)' },
        { label: 'Parámetros', value: 'Kerf de sierra (0-10 mm), Refilado (0-25 mm)' }
      ]
    },

    // 17. Guía Rápida de Atajos de Teclado
    {
      id: 'atajos_teclado',
      category: 'atajos',
      title: 'Guía Rápida de Atajos de Teclado',
      shortDesc: 'Trabaja con máxima agilidad usando atajos directos sin colisiones para modelar, rotar, medir, deshacer y transformar piezas.',
      icon: 'keyboard',
      iconColor: 'text-emerald-600',
      badge: 'Productividad',
      steps: [
        '• [ V ] o [ Barra Espaciadora ]: Herramienta Seleccionar piezas (Shift + Clic para añadir o quitar piezas/módulos)',
        '• [ Shift + Arrastre ]: Ventana de Selección Múltiple (estilo SketchUp). Congela la cámara y encierra varios muebles o piezas para seleccionarlos en bloque',
        '• [ P ]: Herramienta Empujar / Tirar (Push/Pull) para estirar o encoger caras en tiempo real',
        '• [ M ]: Herramienta Mover (Gizmo 3D de flechas para posicionar módulos o piezas en X, Y, Z)',
        '• [ D ]: Herramienta Dibujar Rectángulo 3D (traza nuevas placas de melamina en el piso o caras)',
        '• [ C ]: Herramienta Dibujar Círculo 3D (traza tapas circulares o mesas redondas)',
        '• [ F ]: Herramienta Dibujo Libre a Mano Alzada (Freehand con auto-extrusión)',
        '• [ T ]: Cinta Métrica 3D con snapping magnético a vértices y aristas',
        '• [ Q ]: Herramienta Transportador / Rotar 90° interactiva con el ratón',
        '• [ R ]: Rotar 90° en bloque pieza, cajón o todos los módulos seleccionados (alrededor de su centro común)',
        '• [ Z ]: Centrar y reiniciar vista de cámara en el taller 3D',
        '• [ W ] / [ S ]: Elevar o descender la pieza seleccionada en el eje vertical (Y)',
        '• [ Flechas Teclado ]: Desplazamiento milimétrico de la selección en bloque (1 mm o 10 mm con Shift)',
        '• [ G ]: Mostrar u ocultar Guías Espaciales perimetrales y el Maniquí de Escala Humana',
        '• [ H ] / [ Alt + H ]: Ocultar temporalmente selección o mostrar todas las piezas ocultas',
        '• [ Supr / Delete / Backspace ]: Eliminar inmediatamente las piezas, muebles seleccionados o equipos',
        '• [ Ctrl + Z ] / [ Cmd + Z ]: Deshacer última acción (Undo)',
        '• [ Ctrl + Y ] / [ Cmd + Shift + Z ]: Rehacer acción deshecha (Redo)',
        '• [ Esc ]: Cancelar herramienta activa, limpiar selección actual o cerrar ventanas emergentes'
      ],
      tips: [
        'Selección Múltiple tipo SketchUp: Mantén presionado [ Shift ] y arrastra el ratón con el botón izquierdo sobre el lienzo 3D. Se dibujará una caja de selección que atrapará todos los módulos que toque o contenga, sin rotar la cámara. Una vez seleccionados, puedes moverlos juntos, girarlos con [ R ] o cambiarles la melamina en bloque.',
        'Coherencia en Multi-Selección: Cuando hay varios muebles seleccionados, las cotas individuales (ancho, alto, fondo) se ocultan automáticamente para evitar inconsistencias, habilitando acciones en bloque (girar, mover, duplicar, congelar, paleta de melaminas).',
        'Atajo [ R ] dedicado exclusivamente a ROTAR: al pulsar R con un cajón, módulo o varios muebles seleccionados, girará 90° de inmediato sin alterar la herramienta activa.',
        'Atajos de Dibujo 3D: pulsa [ D ] para trazar Rectángulos, [ C ] para Círculos y [ F ] para Dibujo Libre a Mano Alzada.',
        'La barra espaciadora o la tecla [ V ] te regresan al instante a la herramienta de selección estándar.'
      ],
      technicalDetails: [
        { label: 'Caja Selección 3D', value: 'Shift + Arrastre ratón' },
        { label: 'Añadir a Selección', value: 'Shift + Clic en pieza' },
        { label: 'Rotación 90°', value: 'Tecla [ R ] (módulo o selección)' },
        { label: 'Rectángulo 3D', value: 'Tecla [ D ] (nueva pieza rectangular)' },
        { label: 'Círculo 3D', value: 'Tecla [ C ] (pieza circular)' },
        { label: 'Mano Alzada', value: 'Tecla [ F ] (trazo libre)' },
        { label: 'Seleccionar', value: 'Teclas [ V ] o [ Espacio ]' },
        { label: 'Empujar / Tirar', value: 'Tecla [ P ]' }
      ]
    }
  ];

  /**
   * Filtra los artículos del manual según la categoría seleccionada y el término de búsqueda.
   */
  readonly filteredArticles = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const cat = this.activeCategory();

    return this.articles.filter(art => {
      const matchCat = cat === 'all' || art.category === cat;
      if (!matchCat) return false;

      if (!q) return true;
      const inTitle = art.title.toLowerCase().includes(q);
      const inDesc = art.shortDesc.toLowerCase().includes(q);
      const inBadge = art.badge ? art.badge.toLowerCase().includes(q) : false;
      const inSteps = art.steps.some(s => s.toLowerCase().includes(q));
      const inTips = art.tips.some(t => t.toLowerCase().includes(q));
      const inTech = art.technicalDetails
        ? art.technicalDetails.some(td => td.label.toLowerCase().includes(q) || td.value.toLowerCase().includes(q))
        : false;
      return inTitle || inDesc || inBadge || inSteps || inTips || inTech;
    });
  });

  /**
   * Obtiene el artículo actualmente activo para mostrarlo en el panel de lectura derecho.
   */
  readonly selectedArticle = computed(() => {
    const currentId = this.selectedArticleId();
    const list = this.filteredArticles();
    if (list.length === 0) return null;
    const found = list.find(a => a.id === currentId);
    return found || list[0];
  });

  /**
   * Índice del artículo seleccionado dentro de la lista filtrada.
   */
  readonly currentArticleIndex = computed(() => {
    const art = this.selectedArticle();
    if (!art) return -1;
    return this.filteredArticles().findIndex(a => a.id === art.id);
  });

  /**
   * Artículo anterior en la lista de navegación secuencial.
   */
  readonly prevArticleItem = computed(() => {
    const idx = this.currentArticleIndex();
    const list = this.filteredArticles();
    return idx > 0 ? list[idx - 1] : null;
  });

  /**
   * Artículo siguiente en la lista de navegación secuencial.
   */
  readonly nextArticleItem = computed(() => {
    const idx = this.currentArticleIndex();
    const list = this.filteredArticles();
    return (idx >= 0 && idx < list.length - 1) ? list[idx + 1] : null;
  });

  goToPrevArticle() {
    const prev = this.prevArticleItem();
    if (prev) {
      this.selectedArticleId.set(prev.id);
    }
  }

  goToNextArticle() {
    const next = this.nextArticleItem();
    if (next) {
      this.selectedArticleId.set(next.id);
    }
  }

  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement | null;
    this.searchQuery.set(target?.value ?? '');
  }

  selectCategory(catId: string) {
    this.activeCategory.set(catId);
    const filtered = this.filteredArticles();
    if (filtered.length > 0 && !filtered.some(a => a.id === this.selectedArticleId())) {
      this.selectedArticleId.set(filtered[0].id);
    }
  }

  selectArticle(artId: string) {
    this.selectedArticleId.set(artId);
  }

  close() {
    this.modalClose.emit();
  }

  /**
   * Mapea los iconos de las categorías del manual a sus equivalentes en Hugeicons.
   */
  getCategoryIcon(iconName: string) {
    switch (iconName) {
      case 'adjust': return Settings01Icon;
      case 'straighten': return RulerIcon;
      case 'architecture': return Compass01Icon;
      case 'view_in_ar': return this.icons.cube3d;
      case 'precision_manufacturing': return Layers01Icon;
      case 'keyboard': return this.icons.keyboard;
      case 'auto_stories':
      default:
        return this.icons.book;
    }
  }

  /**
   * Mapea los iconos de los artículos individuales del manual a Hugeicons.
   */
  getArticleIcon(iconName: string) {
    switch (iconName) {
      case 'human': return this.icons.humanFigure;
      case 'lock': return this.icons.lock;
      case 'mouse': return this.icons.mouseContext;
      case 'room': return this.icons.roomEnvironment;
      case 'adjust': return Settings01Icon;
      case 'straighten': return RulerIcon;
      case 'pan_tool': return Archive01Icon;
      case 'dashboard_customize': return Settings01Icon;
      case 'crop_square': return Layers01Icon;
      case 'open_in_full': return Compass01Icon;
      case 'height': return RulerIcon;
      case 'menu_book': return this.icons.book;
      case 'precision_manufacturing': return Layers01Icon;
      case 'keyboard': return this.icons.keyboard;
      case 'format_shapes': return this.icons.cube3d;
      case 'door_sliding': return this.icons.doorSwing;
      case 'note': return Note01Icon;
      default:
        return this.icons.book;
    }
  }
}