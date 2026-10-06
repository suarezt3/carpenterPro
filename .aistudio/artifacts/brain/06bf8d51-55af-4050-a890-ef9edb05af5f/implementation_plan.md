# Optimización de Interfaz Compacta, Ajuste Responsivo y Cinta Métrica Magnética Persistente 3D

Plan de implementación integral para eliminar los desbordamientos en la barra de herramientas superior y los paneles laterales en pantallas portátiles (resoluciones 1920x1080 con escalado DPI), e implementar el sistema de imán magnético con cotas 3D permanentes en la cinta métrica.

### User Review & Critical Decisions

> [!IMPORTANT]
> Confirmaciones de interacción validadas con el usuario:
> - **Barra superior compacta**: Menús desplegables agrupados por contexto (Archivo/Proyecto, Exportaciones) y barra compacta con accesos directos principales para garantizar que nunca desborde ni requiera reducir el zoom del navegador en pantallas de 1920px con escalado.
> - **Imán magnético inteligente (Snap 3D)**: Adhesión magnética automática con retroalimentación visual a vértices, esquinas y puntos medios de las aristas de todas las piezas del despiece.
> - **Persistencia de cotas de medición**: Al finalizar una medida entre dos puntos, la cota permanece fija en el espacio 3D para permitir orbitar, rotar e inspeccionar libremente el modelo sin que se borre al hacer clic, eliminándose únicamente mediante el botón "Nueva Medida", "Borrar cota" o la tecla Esc.

---

### 1. Overview & Core Concept

- **What It Does**: 
  1. Reorganiza la barra superior (`header.html`) en una estructura modular con menús desplegables contextuales ("Proyecto" y "Exportar"), manteniendo accesos rápidos esenciales (Guardar en la nube, Tema Claro/Oscuro, Deshacer/Rehacer y Ajustes), adaptándose a cualquier ancho de pantalla sin provocar barras de scroll horizontal ni requerir zoom reducido.
  2. Dota a la paleta CAD lateral izquierda del visor 3D de contención de altura (`max-h-[calc(100vh-8rem)]`, scroll suave y diseño ergonómico) para evitar que sus botones se corten verticalmente en pantallas de baja altura o ventanas no maximizadas.
  3. Integra un algoritmo de imán magnético (*magnetic vertex & edge snapping*) en la herramienta de Cinta Métrica (`furniture-3d-viewer.ts`), que detecta esquinas y puntos medios a corta distancia del cursor proyectado con un indicador visual brillante.
  4. Implementa el estado persistente de medición: la línea de cota con sus extremos y etiqueta milimétrica se queda congelada en las coordenadas globales 3D. El usuario puede orbitar con botón izquierdo o derecho del ratón para verificar la medida sin destruir los datos medidos.

- **Target Audience / Persona**: Carpinteros, ebanistas, diseñadores de mobiliario y armadores de melamina que trabajan en talleres o sobre la marcha con portátiles de 14"–16" (1080p escalados al 125%–150%) y requieren precisión milimétrica al medir ensambles y luces entre piezas.

- **Key Value**: Elimina la fricción visual y el desbordamiento de la pantalla, agiliza la navegación y permite verificar ensambles y cotas complejas sin pérdida de datos ni clics accidentales.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  - *Navegación compacta en la barra superior*:
    - **Zona 1 (Marca)**: Logotipo y nombre del proyecto sin elementos redundantes.
    - **Zona 2 (Navegación central)**: Pestañas numeradas de trabajo (1. Diseñador 3D, 2. Despiece, 3. Optimizador 2D, 4. Presupuesto).
    - **Zona 3 (Acciones y Desplegables)**:
      - Menú *Proyecto* (Nuevo, Abrir proyectos guardados, Auto-guardado en la nube).
      - Menú *Exportar* (Plano 2D PDF, DXF CNC, Descargar JSON).
      - Acciones directas: Selector de Tema (Classic Claro / Oscuro), Deshacer / Rehacer, Guardar destacado en nube y Ajustes.
  - *Inspección con Cinta Métrica Magnética*:
    - Al activar la herramienta (o pulsar `T`), el cursor activa la detección de piezas. Al pasar a menos de 20 píxeles de una esquina o punto medio de arista, aparece un punto verde magnético con halo (*Snap Marker*) que atrae el origen de la medida.
    - El usuario presiona y arrastra (o hace clic inicial y secundario). Al fijar el segundo punto, la cota 3D (líneas guía, ticks y etiqueta con milímetros exactos) se dibuja en el espacio tridimensional.
    - El usuario puede rotar libremente el visor 3D, acercar el zoom y orbitar desde cualquier ángulo para verificar que la cota esté exactamente donde la necesita.
    - En el visor aparece un panel flotante HUD con la medida fijada (ej. `Distancia: 564.0 mm`), con dos opciones directas: `[Nueva Medida]` (o pulsar `T` / clic en botón) y `[Borrar cota]` (o presionar `Esc`).

- **Visual Identity & Theme**:
  - Estilo SketchUp Classic compatible con modo oscuro mediante `ThemeService`.
  - Desplegables limpios con fondo blanco/zinc, bordes finos `border-slate-200` / `border-zinc-800` y sombras suaves.
  - Marcador de imán en color esmeralda/ámbar de alto contraste sobre piezas de madera y melamina con `billboard` para que siempre mire a la cámara.

- **Interactive Feedback & Motion**:
  - Animación suave de apertura de menús desplegables (`animate-in fade-in-50 zoom-in-95 duration-100`).
  - Indicador visual magnético con pulso sutil cuando se adhiere a una esquina.
  - Cierre automático de desplegables al hacer clic fuera o presionar `Esc`.

---

### 3. Key Product Decisions & Trade-Offs

- **Decisión 1: Reagrupación de botones en menús desplegables vs barra de 2 filas**:
  - *Enfoque elegido*: Desplegables contextuales ("Proyecto" y "Exportar").
  - *Razón*: Mantiene la altura de la cabecera en una sola fila compacta (56px) para no restar área útil al visor 3D y canvas WebGL, cumpliendo la regla de altura máxima y evitando que el usuario deba modificar el zoom del navegador en pantallas de 1920px escaladas.
  - *Alternativa descartada*: Barra de dos filas fijas restaría más de 100px verticales al área de trabajo de modelado 3D.

- **Decisión 2: Persistencia de cota 3D con retención durante la órbita**:
  - *Enfoque elegido*: Mantener la cota fijada en el grafo de escena (`THREE.Group`) como objeto estático independiente del control de órbita (`OrbitControls`).
  - *Razón*: En los programas CAD profesionales (como SketchUp y AutoCAD), al trazar una línea de cota temporal o guía, el usuario orbita alrededor para inspeccionar el ensamble; reiniciar la medición con cualquier clic frustraba la verificación.
  - *Alternativa descartada*: Permitir que cualquier clic en el canvas reinicie la medida provocaba la pérdida inmediata de la cota al intentar rotar la cámara.

- **Decisión 3: Cálculo del imán (Snap) sobre bounding box y geometría real de piezas**:
  - *Enfoque elegido*: Precomputar los 8 vértices de las cajas orientadas de cada pieza visible y los 12 puntos medios de sus aristas proyectados en coordenadas de pantalla.
  - *Razón*: Extremadamente veloz (0.1ms por cuadro), predecible para piezas rectangulares de carpintería y sin sobrecargar la GPU.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌────────────────────────────────────────────────────────────────────────┐
│                               HEADER COMPONENT                         │
│  [Logo / Brand] ─── [Pestañas de Navegación 1..4] ─── [Zona Acciones]  │
│                                                          │             │
│                                ┌─────────────────────────┴──────────┐  │
│                                │ Menú Proyecto: Nuevo, Abrir, Auto  │  │
│                                │ Menú Exportar: PDF 2D, DXF, JSON   │  │
│                                │ Botón Guardar en Nube (destacado)  │  │
│                                │ Tema Claro/Oscuro & Deshacer/Rehacer│ │
│                                └────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                     FURNITURE 3D VIEWER (Three.js)                     │
│                                                                        │
│  ┌─────────────────────────┐               ┌────────────────────────┐  │
│  │ Paleta Lateral CAD      │               │ Canvas WebGL           │  │
│  │ max-h-[calc(100vh-8rem)]│               │                        │  │
│  │ Herramientas + Vistas   │               │  ┌──────────────────┐  │  │
│  │ Scroll contenido        │               │  │ Mueble 3D / Piezas│ │  │
│  └─────────────────────────┘               │  └────────┬─────────┘  │  │
│                                                        │               │
│                                             [Raycast & Snap Engine]    │
│                                                        │               │
│                                                        ▼               │
│                                            ┌───────────────────────┐   │
│                                            │ Snap Points:          │   │
│                                            │ • 8 Vértices (Esquinas│   │
│                                            │ • 12 Puntos Medios    │   │
│                                            └───────────┬───────────┘   │
│                                                        │               │
│                                                        ▼               │
│                                            ┌───────────────────────┐   │
│                                            │ Cota Persistente:     │   │
│                                            │ • Línea 3D con Ticks  │   │
│                                            │ • Etiqueta milimétrica │  │
│                                            │ • Orbitación libre    │   │
│                                            │ • HUD: Nueva / Borrar │   │
│                                            └───────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

#### Plan de Modificaciones de Código:

1. **`src/app/components/header/header.ts` & `header.html`**:
   - Crear estados de señal para los menús desplegables (`isProjectMenuOpen = signal(false)`, `isExportMenuOpen = signal(false)`).
   - Implementar directiva/oyente de cierre al hacer clic fuera o presionar `Esc`.
   - Reagrupar acciones secundarias en desplegables contextuales limpios y compactos.
   - Ajustar el ancho máximo de la barra y botones a clase de altura compacta con contención `overflow-hidden` responsiva.

2. **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.html`**:
   - Añadir `max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-none` a la paleta CAD lateral izquierda (`div.absolute.top-3.left-3`).
   - Integrar tarjeta flotante HUD de Cota Persistente en el visor con distancia en mm, botón "Nueva Medida" y botón "Borrar Cota".

3. **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`**:
   - Implementar método `findMagneticSnapPoint(screenX, screenY)` que evalúa los vértices y puntos medios de las piezas más cercanas dentro de un radio umbral (18 píxeles en pantalla).
   - Crear malla/sprite de Three.js para el marcador de imán (*Snap Indicator* verde esmeralda brillante).
   - En `onPointerDown` con la herramienta `measure`:
     - Si ya hay una cota fijada y el usuario hace clic o arrastra para rotar la cámara (`OrbitControls`), la cota NO se borra.
     - Si el usuario pulsa "Nueva Medida" o arrastra con la intención de medir, se inicia una nueva captura.
   - En `onPointerUp`:
     - Al fijar el segundo punto, establecer `isMeasurementPersistent = true`.
     - Dejar los gráficos 3D (línea de cota, extremos y etiqueta HTML/Sprite) renderizándose continuamente en el bucle `animate()`.
   - Añadir escucha de teclado `Escape` para resetear la medición activa o cota fijada.
