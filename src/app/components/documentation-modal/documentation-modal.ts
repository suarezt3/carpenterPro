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
      id: 'push_pull_tool',
      category: 'herramientas_3d',
      title: 'Empujar / Tirar (Push/Pull) y Edición Directa 3D',
      shortDesc: 'Redimensiona piezas estirando sus caras en tiempo real como en SketchUp con auto-alineación coplanar.',
      icon: 'open_in_full',
      iconColor: 'text-amber-600',
      badge: 'Estilo SketchUp',
      steps: [
        'Selecciona la herramienta "Empujar / Tirar" en la paleta izquierda o pulsa la tecla [ P ].',
        'Pasa el cursor sobre la cara de cualquier pieza que desees estirar o acortar (lateral, techo, estante, frente de cajón). La cara se resaltará con un plano traslúcido ámbar.',
        'Haz clic y arrastra el ratón a lo largo del eje normal de la cara para modificar su longitud, profundidad o altura.',
        'El sistema cuenta con imán de coplanaridad: cuando la cara que estás estirando se acerca a la cara de otra pieza contigua, se ajustará automáticamente a la misma altura o profundidad.',
        'Suelta el ratón para confirmar el nuevo tamaño de la pieza.'
      ],
      tips: [
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
        '• [ V ] o [ Barra Espaciadora ]: Herramienta Seleccionar',
        '• [ M ]: Cinta Métrica 3D con Imán Inteligente a vértices',
        '• [ P ]: Empujar / Tirar (Push/Pull) para estirar caras en tiempo real',
        '• [ Q ]: Rotar pieza seleccionada 90 grados',
        '• [ R ]: Dibujar rectángulo 3D en piso o cara de pieza',
        '• [ W / A / S / D ]: Mover pieza seleccionada en incrementos finos de 1 mm / 10 mm',
        '• [ Supr / Delete / Backspace ]: Eliminar pieza seleccionada',
        '• [ Ctrl + Z ] / [ Cmd + Z ]: Deshacer último cambio',
        '• [ Ctrl + Y ] / [ Cmd + Shift + Z ]: Rehacer cambio',
        '• [ Esc ]: Cancelar herramienta activa, limpiar cota o cerrar modales',
        '• [ Clic Derecho + Arrastrar ]: Orbitar y rotar cámara 3D libremente',
        '• [ Rueda del Ratón ]: Zoom adelante / atrás'
      ],
      tips: [
        'Mantener pulsada la tecla Shift mientras haces clic te permite seleccionar múltiples piezas a la vez para moverlas o duplicarlas en bloque.'
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
