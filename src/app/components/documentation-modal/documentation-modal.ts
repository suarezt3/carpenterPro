import { Component, ChangeDetectionStrategy, input, output, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';

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

@Component({
  selector: 'app-documentation-modal',
  imports: [CommonModule],
  templateUrl: './documentation-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentationModalComponent {
  readonly themeService = inject(ThemeService);

  isOpen = input<boolean>(false);
  modalClose = output<void>();

  searchQuery = signal<string>('');
  activeCategory = signal<string>('all');
  selectedArticleId = signal<string>('mecanizados_cnc');

  readonly categories = [
    { id: 'all', label: 'Todas las Guías', icon: 'auto_stories' },
    { id: 'mecanizados', label: 'Mecanizados CNC', icon: 'adjust', badge: 'Auto' },
    { id: 'cinta_metrica', label: 'Cinta Métrica 3D', icon: 'straighten', badge: 'Imán' },
    { id: 'herramientas_3d', label: 'Herramientas 3D CAD', icon: 'architecture' },
    { id: 'modulos_piezas', label: 'Módulos y Plantillas', icon: 'view_in_ar' },
    { id: 'optimizador', label: 'Corte y Fabricación', icon: 'precision_manufacturing' },
    { id: 'atajos', label: 'Atajos de Teclado', icon: 'keyboard' }
  ];

  readonly articles: DocArticle[] = [
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
    {
      id: 'cinta_metrica_cad',
      category: 'cinta_metrica',
      title: 'Cinta Métrica y Acotado de Precisión CAD',
      shortDesc: 'Medición milimétrica exacta con imán a esquinas/puntos medios, flechas CAD y cotas persistentes al orbitar el 3D.',
      icon: 'straighten',
      iconColor: 'text-amber-600',
      badge: 'Precisión Milimétrica',
      steps: [
        'Activa la herramienta pulsando el icono de cinta métrica en la barra vertical izquierda o presionando la tecla [ M ].',
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
    {
      id: 'cinta_acciones_flotante',
      category: 'herramientas_3d',
      title: 'Cinta Flotante de Acciones Rápidas y Gestión de Grupos',
      shortDesc: 'Menú contextual superior derecho para duplicar, rotar 90°, abrir/cerrar, cambiar orientación y desagrupar bloques modulares al instante.',
      icon: 'dashboard_customize',
      iconColor: 'text-emerald-600',
      badge: 'Barra Superior',
      steps: [
        'Al seleccionar cualquier pieza o grupo en el visor 3D, se despliega automáticamente la cinta oscura de acciones en la esquina superior derecha (top-3 right-3), respetando estrictamente los márgenes visuales sin tapar tu diseño.',
        'Si seleccionas un grupo o cajón modular, la cinta te permite:',
        '• "Duplicar": Crea una copia exacta de todo el módulo o cajón a un costado con sus herrajes y mecanizados.',
        '• "Mover": Activa el cursor de traslación rápida para arrastrar el bloque completo.',
        '• "Abrir / Cerrar": Extrae las correderas del cajón o gira la puerta del grupo para revisar su interior.',
        '• "90° (R)": Rota el ensamble completo 90 grados en el plano horizontal.',
        '• "Frente": Enfoca y selecciona de forma aislada la fachada frontal del cajón o puerta.',
        '• "Desagrupar": Separa el ensamble en piezas individuales independientes para editar sus partes por separado.',
        'Si seleccionas una pieza individual, dispones de: "Duplicar", "Mover", "90° (R)", "Orientación (Horizontal / Vertical)" y "Eliminar".',
        'En la esquina opuesta (superior izquierda, top-3 left-16), se muestra la tarjeta informativa con el nombre de la pieza, sus medidas (L × A × E) o el recuento de piezas del grupo, ambas barras perfectamente alineadas y sin solaparse.'
      ],
      tips: [
        'Ambas barras flotantes (info a la izquierda y acciones a la derecha) conservan un diseño minimalista que no obstruye la visibilidad del mueble 3D ni compite con los controles de cámara.',
        'Puedes presionar [ Q ] como atajo de teclado para la rotación rápida de 90° de la pieza seleccionada.'
      ],
      technicalDetails: [
        { label: 'Ubicación Acciones', value: 'Esquina superior derecha (top-3 right-3)' },
        { label: 'Ubicación Info', value: 'Esquina superior izquierda (top-3 left-16)' },
        { label: 'Operaciones Grupo', value: 'Duplicar, Mover, Abrir/Cerrar, 90° (R), Frente, Desagrupar' },
        { label: 'Operaciones Pieza', value: 'Duplicar, Mover, 90° (R), Orientación H/V, Eliminar' }
      ]
    },
    {
      id: 'dibujo_rectangulo_3d',
      category: 'herramientas_3d',
      title: 'Dibujar Rectángulo 3D en el Lienzo CAD',
      shortDesc: 'Traza placas y paneles rectangulares directamente en el suelo 3D o sobre caras de muebles con previsualización milimétrica dinámica.',
      icon: 'crop_square',
      iconColor: 'text-sky-600',
      badge: 'Atajo [ R ]',
      steps: [
        'Activa la herramienta de dibujo presionando la tecla [ R ] en tu teclado o haciendo clic en el icono de rectángulo de la paleta izquierda.',
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
        { label: 'Atajo rápido', value: 'Tecla [ R ]' },
        { label: 'Snap de dibujo', value: 'Incrementos de 10 mm durante el trazado' },
        { label: 'Dimensión mínima', value: '60 mm x 60 mm (evita clics accidentales)' },
        { label: 'Espesor inicial', value: '15 mm o 18 mm según la configuración activa' }
      ]
    },
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
    {
      id: 'plantillas_muebles',
      category: 'modulos_piezas',
      title: 'Catálogo de 20 Plantillas de Muebles y Despiece',
      shortDesc: 'Accede a 20 plantillas profesionales organizadas en Cocina, Baño, Closets, Sala TV y Oficina con opción de reemplazar o añadir al 3D.',
      icon: 'menu_book',
      iconColor: 'text-blue-600',
      badge: '20 Plantillas',
      steps: [
        'Haz clic en el botón "Plantillas de Muebles" en la barra superior o en el modelador 3D.',
        'Explora las 20 plantillas categorizadas: Cocina (bajo mesadas, alacenas, torres), Baño (vanitories flotantes, gabinetes con espejo), Closets (roperos, cómodas, mesas de noche, zapateros), Sala TV (racks, libreros, mesas de centro) y Oficina (escritorios en L, cajoneras móviles).',
        'Al hacer clic en cualquier plantilla podrás elegir:',
        '• "Reemplazar diseño actual": Borra el lienzo actual y carga el mueble seleccionado centrado en el espacio 3D.',
        '• "Añadir junto al diseño": Coloca el mueble a la derecha del diseño actual sin borrar tus piezas previas, ideal para componer habitaciones completas.',
        '• "Lienzo en Blanco": Inicia un diseño desde cero.'
      ],
      tips: [
        'Todas las piezas de las plantillas son 100% editables: puedes cambiar su material, grosor, tapacantos o medidas usando la herramienta Empujar/Tirar o el panel de propiedades.'
      ],
      technicalDetails: [
        { label: 'Categorías', value: 'Cocina, Baño, Closets, Sala TV, Oficina' },
        { label: 'Total Muebles', value: '20 diseños paramétricos completos' },
        { label: 'Modos de Carga', value: 'Reemplazo total o Adición lateral en 3D' }
      ]
    },
    {
      id: 'optimizador_despiece',
      category: 'optimizador',
      title: 'Optimización de Corte 2D y Despiece Milimétrico',
      shortDesc: 'Algoritmo guillotine de máximo rendimiento de placas con kerf de sierra, refilado y etiquetas imprimibles con QR.',
      icon: 'precision_manufacturing',
      iconColor: 'text-purple-600',
      badge: 'Ahorro de Material',
      steps: [
        'Ve a la pestaña "Optimizador" en la barra superior.',
        'Configura el tamaño del tablero comercial (ej. 2440 x 1830 mm o 2750 x 1830 mm) y el espesor de la hoja de sierra (Kerf = 4 mm estándar).',
        'Establece el margen de refilado perimetral del tablero (ej. 10 mm) para eliminar bordes dañados.',
        'El motor organizará automáticamente los cortes respetando la dirección de la veta de la melamina y minimizando los retazos sobrantes.',
        'Genera el reporte con el porcentaje de aprovechamiento, metros lineales de tapacanto y plano de corte con numeración de piezas.',
        'Pulsa "Exportar Plano 2D Técnico" para descargar el PDF de taller listo para imprimir.'
      ],
      tips: [
        'Puedes imprimir etiquetas autoadhesivas para cada pieza con su código QR, nombre del módulo, medidas y bordes con canto.'
      ],
      technicalDetails: [
        { label: 'Algoritmo', value: 'Guillotine 2D con respeto estricto de veta' },
        { label: 'Parámetros', value: 'Kerf de sierra (0-10 mm), Refilado (0-25 mm)' }
      ]
    },
    {
      id: 'atajos_teclado',
      category: 'atajos',
      title: 'Guía Rápida de Atajos de Teclado',
      shortDesc: 'Trabaja con máxima agilidad usando atajos directos para medir, seleccionar, deshacer y transformar piezas.',
      icon: 'keyboard',
      iconColor: 'text-emerald-600',
      badge: 'Productividad',
      steps: [
        '• [ Clic sostenido + Arrastre ]: Mover pieza individual o grupo completo directamente en el espacio 3D (arrastre fluido sin flechas en el centro)',
        '• [ V ] o [ Barra Espaciadora ]: Herramienta Seleccionar piezas',
        '• [ M ]: Cinta Métrica 3D con Imán Inteligente a vértices y aristas',
        '• [ P ]: Empujar / Tirar (Push/Pull) para estirar o encoger caras en tiempo real',
        '• [ R ]: Dibujar rectángulo 3D en el piso con previsualización dinámica',
        '• [ Q ]: Rotar pieza o ensamble seleccionado 90 grados en el plano horizontal',
        '• [ Supr / Delete / Backspace ]: Eliminar inmediatamente la pieza o grupo seleccionado (con restauración vía Ctrl+Z)',
        '• [ Ctrl + Z ] / [ Cmd + Z ]: Deshacer última acción o restauración de pieza eliminada',
        '• [ Ctrl + Y ] / [ Cmd + Shift + Z ]: Rehacer acción deshecha',
        '• [ Clic en Puerta o Cajón ]: Abrir o cerrar individualmente puertas (giro 90°) o extraer cajones en el visor 3D',
        '• [ Shift + Clic ]: Selección múltiple aditiva de piezas en el visor 3D para mover o duplicar en bloque',
        '• [ Flechas Teclado ]: Mover pieza seleccionada en incrementos milimétricos (1 mm o 10 mm con Shift)',
        '• [ Esc ]: Cancelar herramienta activa, limpiar selección o cerrar ventanas emergentes'
      ],
      tips: [
        'La cinta contextual superior derecha te brinda acceso rápido con un solo clic a: Duplicar, Mover, Abrir/Cerrar, 90° (R), Frente y Desagrupar.'
      ]
    }
  ];

  filteredArticles = computed(() => {
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
      const inTech = art.technicalDetails ? art.technicalDetails.some(td => td.label.toLowerCase().includes(q) || td.value.toLowerCase().includes(q)) : false;
      return inTitle || inDesc || inBadge || inSteps || inTips || inTech;
    });
  });

  selectedArticle = computed(() => {
    const currentId = this.selectedArticleId();
    const list = this.filteredArticles();
    if (list.length === 0) return null;
    const found = list.find(a => a.id === currentId);
    return found || list[0];
  });

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
}
