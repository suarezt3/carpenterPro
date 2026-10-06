# Plan: Herramientas SketchUp (Rectángulo 3D, Rotar), Menú Contextual Clic Derecho y Rediseño de Bandeja Classic

Este plan define la implementación de las capacidades solicitadas inspiradas en **SketchUp 2024**, incorporando herramientas de creación geométrica, menú contextual de ingeniería rápida al hacer clic derecho y la unificación cromática de la bandeja lateral derecha según el estilo **SketchUp Classic**.

---

## Decisiones Críticas Acordadas con el Usuario

> [!IMPORTANT]
> A partir de las capturas y respuestas del usuario, se definen los siguientes componentes:

1. **Herramienta Dibujar Rectángulo 3D (Tecla `R`)**:
   - Permite hacer clic y arrastrar en la cuadrícula milimétrica del suelo o sobre cualquier cara de una pieza existente para dibujar la huella rectangular de una nueva tabla de melamina con previsualización en vivo (`Largo × Ancho`).
   - Al soltar el clic, la pieza se inserta de inmediato y el cursor queda listo para darle espesor o altura con la herramienta **Empujar / Tirar (Push/Pull)**.

2. **Herramienta Rotar 3D (Tecla `Q`) con Transportador**:
   - Renderiza un transportador circular con graduación de ángulos (0°, 45°, 90°, 180°) sobre la pieza activa.
   - Permite giros rápidos de 90° en los tres planos (Horizontal, Lateral YZ, Frontal XY) o rotación interactiva con arrastre.

3. **Menú Contextual de Clic Derecho (SketchUp Entity Menu)**:
   - Al hacer clic derecho sobre cualquier pieza en el espacio 3D, se abre un menú contextual flotante en la posición del ratón con las acciones acordadas:
     - 📋 **Duplicar Pieza**: Clona la pieza con desplazamiento automático de 20 mm.
     - 🔄 **Girar 90°**: Alterna instantáneamente la orientación (Horizontal ↔ Vertical ↔ Frontal).
     - ⬇️ **Alinear al Suelo (Y = 0)**: Apoya la pieza en la base del mueble.
     - 🎯 **Centrar en X / Centrar en Z**: Centra automáticamente en el vano o eje.
     - 👁️ **Aislar Pieza**: Oculta temporalmente el resto del mueble para inspeccionar solo esta pieza; botón "Restaurar Vista" para regresar.
     - 📦 **Agrupar / Desagrupar**: Añade o separa piezas del grupo de arrastre sincronizado.
     - 🪵 **Cambiar Material / Tapacantos**: Menú rápido para asignar melamina y cantos.
     - 🗑️ **Eliminar Pieza**: Suprime la pieza con atajo `Supr / Backspace`.

4. **Rediseño Total de la Bandeja Lateral Derecha (Estilo SketchUp Classic)**:
   - **Eliminación del fondo negro y la mezcla confusa de colores** (aguamarina, verde pastel, amarillo mostaza, rosa):
     - **Superficies**: Tarjetas en blanco puro (`#ffffff`) sobre marco en gris perla suave (`#f8fafc` / `#f1f5f9`) con bordes sutiles de precisión (`#e2e8f0`).
     - **Tipografía**: Grafito slate oscuro de alta legibilidad (`#0f172a` y `#334155`), sin textos fluorescentes.
     - **Botones de Paso (-50, -10, +10, +50)**: Rediseñados a botones compactos limpios en gris neutro claro con respuesta táctil sobria.
     - **Acento Unificado**: Azul técnico CAD (`#0284c7`) para estados activos, eliminando la confusión visual de múltiples tonalidades no relacionadas.

5. **Fidelidad Visual de la Herramienta Empujar/Tirar (Push/Pull)**:
   - Siguiendo la captura enviada por el usuario (Imagen 1), al posar el cursor sobre una cara, esta se resalta con la **trama punteada (stipple dot pattern)** clásica de SketchUp y un cursor gráfico distintivo con plano y flecha roja saliente.

---

## 1. Arquitectura Técnica de Componentes

### Componentes Involucrados:
- **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`**:
  - Estado `activeTool: 'select' | 'push_pull' | 'rectangle' | 'rotate' | 'move' | 'measure'`.
  - Herramienta Rectángulo 3D: Raycasting sobre plano horizontal / caras, dibujo de rectángulo guía con `THREE.LineSegments` y generación de la nueva pieza `Part`.
  - Herramienta Rotar 3D: Transportador circular (`THREE.RingGeometry` y marcas de ángulo a 0°, 90°, 180°, 270°).
  - Menú Contextual 3D: Captura de evento `contextmenu` sobre piezas, emisión del evento `contextMenuOpened` con coordenadas de pantalla `(clientX, clientY)` y datos de la pieza.
  - Trama punteada para Push/Pull mediante textura procedural de puntos generada en canvas HTML para simular la cara seleccionada de SketchUp.
- **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.html`**:
  - Incorporación de los botones **Rectángulo** (`crop_square` / `rectangle`) y **Rotar 3D** (`rotate_90_degrees_cw` / `sync`) en la paleta izquierda.
  - Menú contextual flotante interactivo con animación suave y desenfoque de fondo.
- **`src/app/components/module-designer/module-designer.html`**:
  - Rediseño integral de las tarjetas de propiedades (Dimensiones, Luz Libre, Tablero, Posición 3D, Orientación, Tapacantos, Mecanizados) con la paleta **SketchUp Classic**.
- **`src/app/services/project-storage.service.ts`**:
  - Métodos utilitarios rápidos para duplicar pieza, alinear a suelo, aislar y rotar pieza en 90°.

---

## 2. Plan de Implementación Paso a Paso

### Paso 1: Rediseño Cromático de la Bandeja Lateral Derecha (SketchUp Classic)
- En `module-designer.html`:
  - Reemplazar las tarjetas oscuras `bg-zinc-950` y los múltiples tonos disonantes (aguamarina, verde pastel, amarillo chillón, botón rosa) por tarjetas blancas y gris perla (`bg-white border-slate-200 text-slate-800`).
  - Unificar todas las secciones bajo una jerarquía tipográfica limpia y consistente:
    - *Dimensiones de Corte*: Campos numéricos en fondo blanco con bordes discretos y botones `-50, -10, +10, +50` en gris slate claro (`bg-slate-100 hover:bg-slate-200 text-slate-700`).
    - *Luz Libre*: Tarjetas compactas en blanco con bordes neutros y acento verde esmeralda sutil solo en los valores de hueco útil.
    - *Tablero & Espesor*: Selector de melamina y botones de espesor (15mm, 18mm) en estilo botón de opción limpio.
    - *Posición 3D*: Coordenadas X, Y, Z con botones alineados `Al Suelo`, `Centrar X`, `Centrar Z`.
    - *Tapacantos*: Selector de 4 bordes unificado en escala de grises y azul técnico.
    - *Botón Eliminar*: Sustituir el botón rosa por un botón sobrio en rojo técnico suave (`hover:bg-rose-50 text-rose-600 border-rose-200`).

### Paso 2: Menú Contextual al Hacer Clic Derecho en Piezas 3D
- En `furniture-3d-viewer.ts`:
  - Agregar escucha del evento `contextmenu` en el `<canvas>`.
  - Detectar si el clic derecho incide sobre una pieza mediante raycaster.
  - Si incide sobre una pieza, seleccionar la pieza y desplegar el menú contextual en las coordenadas del cursor.
  - Implementar acciones directas en el componente:
    1. **Duplicar**: Clona la pieza con nuevo ID y desplazamiento de +25mm.
    2. **Rotar 90°**: Cambia la orientación cíclicamente (Horizontal -> Lateral YZ -> Frontal XY) adaptando dimensiones.
    3. **Alinear al Suelo**: Fija `posY = (thickness o height) / 2` apoyándola a cota 0mm.
    4. **Centrar en X / Z**: Calcula el centro del mueble y coloca la pieza en el punto medio.
    5. **Aislar Pieza**: Signal `isolatedPartId`: cuando está activo, oculta visualmente las demás piezas y muestra un chip flotante "Modo Aislado - Restaurar".
    6. **Agrupar / Desagrupar**: Añade o retira de la selección múltiple.
    7. **Eliminar**: Elimina la pieza con registro en el historial para Ctrl+Z.

### Paso 3: Herramienta Dibujar Rectángulo 3D (Tecla `R`)
- Añadir la herramienta `rectangle` a la barra de herramientas izquierda (`activeTool = 'rectangle'`).
- En `furniture-3d-viewer.ts`:
  - Al hacer `pointerdown` en el suelo (plano Y=0) o sobre una cara de otra pieza, fijar la esquina inicial `(x0, z0)`.
  - En `pointermove`, dibujar un rectángulo dinámico azul/ámbar proyectado en tiempo real con cota milimétrica (`Largo × Ancho`).
  - En `pointerup`, crear la pieza con material por defecto y espesor de 18mm, seleccionarla automáticamente y pasar a la herramienta `push_pull` para extruir o ajustar su grosor.

### Paso 4: Herramienta Rotar 3D con Transportador (Tecla `Q`)
- Añadir la herramienta `rotate` a la barra izquierda.
- Al activar sobre una pieza seleccionada, dibuja un transportador de ángulos circular sobre el plano dominante de la pieza.
- Permite arrastrar el transportador o hacer clic en marcas de 90° para girar la pieza con precisión angular instantánea.

### Paso 5: Textura Punteada de Selección Estilo SketchUp para Empujar/Tirar
- Generar una textura procedimental de puntos (stipple pattern de 8×8 píxeles con un punto central gris/azul) usando un `<canvas>` en memoria.
- Asignar la textura con repetición al plano de resaltado de cara en `furniture-3d-viewer.ts` para que al pasar por cualquier cara en modo Empujar/Tirar, la cara adquiera exactamente la apariencia punteada que el usuario mostró en la Imagen 1.

---

## 3. Verificación y Pruebas
1. **Inspección Visual**: Verificar que la bandeja lateral derecha ya no tenga fondo negro ni la mezcla de aguamarina, amarillo y rosa, luciendo limpia, luminosa y profesional como SketchUp.
2. **Clic Derecho**: Probar el menú contextual haciendo clic derecho en laterales, techo y baldas, verificando duplicación, giro en 90°, alineación al suelo y aislamiento.
3. **Rectángulo 3D**: Probar dibujar un rectángulo arrastrando en el suelo y ver la pieza creada instantáneamente.
4. **Rotar 3D**: Probar el giro con transportador.
5. **Compilación y Linters**: Ejecutar `compile_applet` y `lint_applet` asegurando 0 errores.
