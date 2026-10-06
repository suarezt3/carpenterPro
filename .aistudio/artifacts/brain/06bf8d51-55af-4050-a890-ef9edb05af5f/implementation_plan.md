# Plan de Implementación: Espesor Push/Pull, Cinta Métrica Dinámica, Clic Derecho y Tema SketchUp Classic Global

Este plan aborda las cuatro solicitudes clave del usuario para perfeccionar la experiencia de modelado y diseño en MelamiPro Studio con calidad profesional de tipo SketchUp.

---

## 1. Herramienta Empujar / Tirar (`Push/Pull`) en Espesor y Altura en Tiempo Real
### Problema detectado
Actualmente, al posarse sobre la cara superior de una pieza horizontal (`axis === 'y'`), el mapeo dimensional estaba erróneamente enlazado a `length` (longitud) en lugar de `thickness` (espesor). Como resultado, al arrastrar hacia arriba no engrosaba la pieza.

### Solución propuesta
- **Mapeo Dimensional Exacto por Normal de Cara**:
  - Piezas Horizontales:
    - Cara superior o inferior (Normal Y+, Y-): Modifica directamente el **espesor** (`thickness`) y la elevación (`posY`), de modo que al tirar hacia arriba la pieza se hace físicamente más gruesa en milímetros en tiempo real.
    - Caras laterales (Normal X+, X-): Modifica el **largo** (`length`).
    - Caras frontales/traseras (Normal Z+, Z-): Modifica el **ancho** (`width`).
  - Piezas Verticales (Laterales YZ y Fondos XY):
    - Cara superior (Normal Y+): Modifica la altura vertical (`length` o `width` según orientación).
    - Caras planas frontal/posterior: Modifica el espesor (`thickness`).
- **Previsualización de Extrusión Dinámica**:
  - Al tirar de la cara, el recuadro resaltado de la cara sigue el nuevo grosor y el HUD muestra `Espesor: XX mm (+YY mm)` o `Altura: XX mm`.
  - Mantiene contacto con el suelo o con la cara de apoyo para no flotar indebidamente.

---

## 2. Cinta Métrica 3D (`Measure Tape`): Estiramiento Clic + Arrastre Dinámico
### Problema detectado
Actualmente la cinta métrica solo funcionaba con clics separados y al dar clic de nuevo se reiniciaba de inmediato perdiendo la medición.

### Solución propuesta
- **Interacción Clic y Arrastrar (Click & Drag to Stretch)**:
  - `PointerDown`: Fija el Punto A de inicio sobre cualquier arista o cara de la pieza/suelo.
  - `PointerMove` continuo: Mientras se mantiene presionado el botón del ratón, se estira la cinta métrica en tiempo real con línea amarilla segmentada, flechas en los extremos y etiqueta flotante con la distancia milimétrica en vivo.
  - `PointerUp`: Fija el Punto B final.
- **Persistencia de la Medida**:
  - La cota y línea trazada se mantienen fijas en el lienzo 3D para permitir inspección minuciosa.
  - No se borra al interactuar con la cámara.
  - Se añade un botón visible de "Nueva Medida" o tecla `Escape` para limpiar cuando el usuario lo desee.

---

## 3. Resolución del Conflicto de Clic Derecho (Menú Contextual vs. Panorámica de Cámara)
### Problema detectado
En `OrbitControls`, mantener presionado el clic derecho y arrastrar permite desplazar la cámara (Pan / Moverse). Al soltar el ratón tras mover la cámara, el navegador disparaba el evento `contextmenu`, abriendo el menú contextual de forma molesta.

### Solución propuesta
- **Detección de Arrastre vs. Clic Estático**:
  - En `pointerdown`: Se registra la posición inicial `(clientX, clientY)` del clic derecho.
  - En `pointermove`: Si el ratón se desplaza más de 6 píxeles mientras el botón derecho está presionado, se marca el estado `isRightDragPanning = true`.
  - En `contextmenu`: Si `isRightDragPanning === true`, se cancela inmediatamente el evento con `e.preventDefault()` y NO se abre el menú.
  - El menú contextual solo se desplegará cuando sea un clic derecho genuino y estático sobre una pieza o sobre el lienzo.

---

## 4. Unificación de Estilo Visual SketchUp Classic (Blanco y Gris Perla) en Todas las Secciones
### Problema detectado
Las pestañas de **Despiece**, **Optimizador 2D**, **Presupuesto** y el encabezado principal aún conservaban el fondo negro oscuro (`bg-zinc-950`), lo que rompía la coherencia visual con el nuevo modelador 3D.

### Solución propuesta
- **Sincronización de Tema Global**:
  - Crear un estado reactivo global de tema (`isWhiteTheme` / `currentTheme: 'light' | 'dark'`) accesible en toda la app.
  - Por defecto: **Estilo SketchUp Classic** (Fondo blanco y gris perla, acentos neutros y tipografía nítida).
  - Incluir selector de alternancia rápida (Sol/Luna) en el encabezado superior para quienes deseen alternar entre tema claro y oscuro.
- **Rediseño de Componentes Clave**:
  - **Encabezado (`Header`)**: Barra limpia blanca/gris perla, pestañas en botones sutiles estilo CAD, textos contrastados.
  - **Despiece (`PartsList`)**: Tarjetas de resumen en blanco/gris perla, tabla de piezas con cabeceras claras, indicadores de tapacanto limpios.
  - **Optimizador 2D (`CutOptimizer`)**: Tableros de corte 2D sobre lienzo perla claro, tarjetas de estadísticas limpias y controles sin estridencias.
  - **Presupuesto (`BudgetView`)**: Formato de cotización profesional en papel/perla, tablas de costos claras y exportación impecable.

---

## Plan de Verificación
1. **Prueba de Espesor 3D**: Activar `Empujar / Tirar` (tecla `P`), posarse sobre la cara superior de un módulo o base y arrastrar hacia arriba; verificar que el espesor/altura aumente visiblemente y se actualice en la lista de piezas.
2. **Prueba de Cinta Métrica**: Activar cinta métrica (`T`), hacer clic y arrastrar hasta otra esquina; verificar que la línea y la medida se estiren en tiempo real y queden fijas al soltar.
3. **Prueba de Clic Derecho**: Mantener clic derecho presionado y mover el ratón para desplazar la cámara; verificar que al soltar NO se abra el menú contextual. Hacer un clic derecho corto sobre una pieza y verificar que SÍ se abra el menú contextual.
4. **Prueba de Tema Global**: Navegar entre Diseñador 3D, Despiece, Optimizador 2D y Presupuesto; comprobar que todas las vistas compartan el estilo blanco/gris perla uniforme y que el alternador de tema funcione fluidamente.
