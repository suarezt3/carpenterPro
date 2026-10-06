# Rediseño de Experiencia de Usuario Estilo SketchUp & Herramienta Empujar/Tirar (Push/Pull)

Este plan aborda la simplificación integral de la interfaz de MelamiPro Studio para transformar el entorno de modelado en un espacio limpio, despejado y profesional inspirado en **SketchUp 2024**, eliminando la duplicación de barras, reduciendo la saturación de colores oscuros y añadiendo la icónica herramienta interactiva **Empujar/Tirar (Push/Pull)**.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> A continuación se detallan las decisiones acordadas para la nueva interfaz y ergonomía de trabajo:

- **Estilo Visual e Identidad Cromática**:
  - Transición del diseño negro denso hacia una paleta **SketchUp Classic / Studio Light**: marcos en grises neutros limpios (`#f1f5f9`, `#e2e8f0`, `#ffffff`), fondo de modelado 3D en gris perla claro con horizonte suave y líneas de eje ortogonales discretas.
- **Limpieza de Espacio y Eliminación de Duplicados**:
  - Se elimina por completo la segunda barra de título redundante que contenía botones repetidos ("Plano 2D", "Plano 2D PDF", "DXF CNC", "Barra Módulo", "Bajo Mesada").
  - Las acciones globales de guardado, exportación e impresión se centralizan en la barra superior compacta de un solo renglón.
  - Las plantillas de muebles se trasladan a un menú desplegable limpio "Plantillas de Mueble" en la barra superior.
- **Disposición Ergonómica Estilo SketchUp**:
  - **Barra Vertical Izquierda (Conjunto de Herramientas CAD)**: Herramientas compactas de 36px organizadas en columna:
    1. *Seleccionar* (Puntero / Flecha estándar).
    2. *Empujar / Tirar (Push/Pull)*: La nueva herramienta para estirar o encoger caras directamente arrastrando con el ratón.
    3. *Mover / Trasladar*: Gizmo de traslación 3D para posicionar piezas.
    4. *Cinta Métrica 3D*: Para medir distancias y luces interiores.
    5. *Añadir Pieza*: Desplegable rápido para insertar lateral, piso, techo o estante.
    6. *Vistas Rápidas*: Iso 3D, Frontal, Lateral y Planta en un menú desplegable compacto.
    7. *Mecanizados y Cotas*: Conmutadores discretos de taladros y cotas.
  - **Bandeja Derecha Colapsable ("Bandeja Predeterminada")**:
    - Un botón flotante permite plegar/desplegar la bandeja con 1 clic para disponer del **100% del ancho del lienzo 3D** completamente despejado para modelar sin estorbos.
  - **Conservación del HUD de Micro-Ajuste**:
    - Se mantiene intacto el cuadro de micro-ajuste de zoom y posición milimétrica en la esquina inferior izquierda que el usuario prefiere tener a mano.
- **Herramienta Interactiva "Empujar / Tirar" (Push/Pull)**:
  - Al activar la herramienta y pasar el cursor sobre cualquier cara de una pieza de melamina (cara superior, frontal, lateral), la cara se ilumina con una trama sutil.
  - Al hacer clic y arrastrar hacia afuera o adentro, la dimensión correspondiente (*Largo* o *Ancho*) crece o decrece en tiempo real con indicador milimétrico flotante (`+20 mm`, `850 mm`).

---

## 1. Overview & Core Concept

### What It Does
1. **Lienzo 3D Despejado y Sin Distracciones**: Libera más del 85% de la pantalla para el visor 3D, eliminando múltiples capas de tarjetas flotantes superpuestas y márgenes redundantes.
2. **Herramienta Push/Pull Nativa**: Permite editar las dimensiones de cualquier pieza como en SketchUp: tocando la cara de un lateral para elevar la altura del mueble, o la cara de una balda para modificar el ancho interior sin tener que escribir en formularios numéricos.
3. **Flujo de Herramientas Estándar CAD**: El usuario selecciona una herramienta en la barra izquierda (Seleccionar, Mover, Empujar, Medir) y el cursor responde en consecuencia con guía de ayuda contextual en la barra de estado inferior.

---

## 2. User Experience & Visual Design

### Key User Flows

#### Flujo 1: Interacción con la Herramienta Empujar/Tirar (Push/Pull)
1. El usuario hace clic en el icono **Empujar/Tirar** (icono estándar de cubo con flecha roja saliente `open_in_full` / `expand`) en la barra vertical izquierda.
2. Al posar el ratón sobre el canto superior de un lateral, la cara superior se resalta con un marco azul técnico y un cursor indicador.
3. El usuario arrastra hacia arriba: la pieza aumenta su longitud en tiempo real. En la barra inferior y junto al cursor aparece la cota milimétrica en vivo (ej. `Largo: 875 mm (+20 mm)`).
4. Al soltar el clic, la medida queda aplicada, el ensamble y los mecanizados se recalculan automáticamente.

#### Flujo 2: Ocultar y Mostrar la Bandeja Lateral Derecha
1. Mientras diseña y revisa el mueble, el usuario hace clic en el botón de colapso `chevron_right` en el borde de la bandeja derecha.
2. La bandeja se desliza suavemente hacia la derecha, expandiendo el lienzo 3D a pantalla completa.
3. Al seleccionar una pieza o hacer clic en la pestaña de la bandeja, esta se despliega con su información técnica compacta.

#### Flujo 3: Carga de Plantillas Limpia
1. En la barra superior, un botón desplegable con menú compacto **"Plantillas"** permite elegir: *Bajo Mesada*, *Barra Módulo* o *Lienzo en Blanco*, eliminando los 3 botones sueltos que ocupaban la barra secundaria.

### Visual Identity & Theme
- **Fondo de Escena 3D**: Gris estudio limpio (`#f8fafc` a `#f1f5f9`), suelo con cuadrícula milimétrica nítida en gris pizarra suave (`#cbd5e1`), sombras suaves de oclusión ambiental.
- **Cuerpo y Marco de Herramientas**: Superficies en gris neutro claro (`#ffffff` y `#f1f5f9`) con bordes sutiles (`#e2e8f0`), tipografía en gris grafito de alta legibilidad (`#0f172a`), acentos de acción en azul técnico (`#0284c7`) y ámbar de carpintería (`#f59e0b`).
- **Barra de Estado Inferior Estilo SketchUp**: Franja inferior limpia de 28px con texto de ayuda contextual a la izquierda y el cuadro numérico *Medidas: [valor] mm* a la derecha.

---

## 3. Key Product Decisions & Trade-Offs

### Decisión 1: Barra Vertical Izquierda vs Menús Flotantes Dispersos
- **Enfoque Elegido**: Agrupar todas las herramientas interactivas del 3D en una barra vertical izquierda delgada (ancho 44px) fija al costado del viewport.
- **Por qué**: Es el estándar indiscutible de CAD (SketchUp, AutoCAD, Blender). Elimina la dispersión visual donde los botones flotaban por arriba, por abajo y al centro tapando el mueble.

### Decisión 2: Implementación de Empujar/Tirar con Raycasting de Caras en Three.js
- **Enfoque Elegido**: Raycaster que detecta la normal de la cara del cuboide sobre la cual incide el puntero (`face.normal`). Según la normal (+X, -X, +Y, -Y, +Z, -Z), el arrastre modifica directamente la coordenada dimensional correspondiente (`length` o `width`).
- **Por qué**: Brinda una respuesta natural a 60 FPS sin necesidad de librerías externas adicionales, aprovechando la infraestructura Three.js que ya está optimizada en el proyecto.

### Decisión 3: Bandeja Lateral Colapsable
- **Enfoque Elegido**: Panel derecho con botón de alternancia colapsable (`isSidebarCollapsed = signal<boolean>(false)`).
- **Por qué**: Permite que el usuario decida cuándo concentrarse en modelar visualmente (100% lienzo) y cuándo afinar detalles en el formulario de propiedades.

---

## 4. Technical Architecture & Component Layout

### Diagrama de la Nueva Interfaz SketchUp

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Top Bar: MelamiPro | Diseñador 3D · Despiece · Optimizador · Presupuesto | [Plantillas ▾] [Guardar] [PDF/DXF] │
├───────┬─────────────────────────────────────────────────────────────────────────────────┬───────────────┤
│ TOOLS │                                                                                 │ BANDEJA LAT.  │
│ (Izq) │                               LIENZO 3D DESPEJADO                               │ (Colapsable)  │
│  [↖]  │                                                                                 │               │
│ Select│                  (Fondo Claro Estudio / Modelo 3D Limpio)                       │ • Propiedades │
│  [⇲]  │                                                                                 │   de Pieza    │
│Push/Pull                                                                                │ • Dimensiones │
│  [✥]  │                                                                                 │ • Tapacantos  │
│ Move  │                                                                                 │ • Mecanizados │
│  [📏]  │   ┌──────────────────────────┐                                                  │               │
│ Tape  │   │  Micro-Ajuste en Zoom    │                                                  │ [ ❯ Colapsar ]│
│  [⊞]  │   │  (X, Y, Z / Imán / Paso) │                                                  │               │
│ Add   │   └──────────────────────────┘                                                  │               │
├───────┴─────────────────────────────────────────────────────────────────────────────────┴───────────────┤
│ Barra de Estado: "Herramienta Activa: Empujar/Tirar • Clic y arrastra para estirar"      | Medidas: 855 mm │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Plan de Implementación Paso a Paso

### Paso 1: Eliminar Barra Secundaria Duplicada y Reorganizar Cabecera
- En `module-designer.html`, suprimir la barra superior repetida con "Modelador 3D", "Barra Módulo", "Bajo Mesada" y botones duplicados de Plano 2D y DXF.
- Añadir en la barra superior un selector desplegable limpio de plantillas ("Mueble Bajo Mesada", "Barra Desayunadora", "Lienzo en Blanco").
- Mantener los botones de exportación ("Plano 2D PDF" y "DXF CNC") de forma única y organizada en la cabecera principal.

### Paso 2: Construir la Barra de Herramientas Vertical Izquierda Estilo SketchUp
- Crear la barra vertical izquierda del visor con iconos compactos (Seleccionar, Push/Pull, Mover Gizmo, Cinta Métrica, Añadir Pieza, Vistas de Cámara).
- Vincular la herramienta activa (`activeTool: 'select' | 'push_pull' | 'move' | 'measure'`) con el cursor del canvas y el motor 3D.

### Paso 3: Desarrollar la Herramienta Interactiva Empujar/Tirar (Push/Pull)
- En `furniture-3d-viewer.ts`, detectar con el raycaster la cara normal apuntada en la pieza.
- Renderizar un plano/borde de realce sobre la cara activa.
- Al iniciar `pointerdown` y mover el cursor, proyectar el desplazamiento en la dirección normal para estirar o encoger la longitud o anchura de la pieza con visualización de cotas instantáneas.
- Emitir la actualización `partModified` para que todo el proyecto se actualice armónicamente.

### Paso 4: Bandeja Lateral Derecha Colapsable y Ajuste de Paleta Clara
- Implementar botón colapsable en la bandeja derecha (`chevron_right` / `chevron_left`).
- Configurar la paleta de colores por defecto en modo claro neutro estilo SketchUp (`isWhiteTheme = true` optimizado con tonos slate/zinc suaves en lugar del negro masivo).
- Asegurar que el cuadro flotante de micro-ajuste de zoom se mantenga en la esquina inferior izquierda con su diseño funcional.

### Paso 5: Barra de Estado Inferior
- Añadir la barra de pie estilo CAD con indicaciones de la herramienta seleccionada a la izquierda y el cuadro de lectura milimétrica a la derecha.

---

## Verificación y Calidad
1. **Espacio Visual**: Comprobar que no existan botones duplicados ni barras secundarias innecesarias.
2. **Push/Pull Test**: Probar la herramienta arrastrando caras de piezas para verificar que se alarguen y encojan con suavidad y precisión milimétrica.
3. **Colapso de Bandeja**: Verificar que al plegar la bandeja lateral derecha el visor 3D se redimensione automáticamente ocupando el 100% del ancho sin romper la relación de aspecto.
4. **Micro-ajuste**: Verificar que el cuadro de micro-ajuste en zoom funcione exactamente igual y permanezca accesible.
5. **Compilación y Linter**: Ejecutar `compile_applet` y `lint_applet` para garantizar cero errores.
