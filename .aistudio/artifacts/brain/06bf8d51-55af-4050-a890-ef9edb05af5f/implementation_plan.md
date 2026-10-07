# Cinta Métrica de Precisión CAD, Panel Compacto y Manual Interactivo de Documentación

Plan de implementación integral para renovar la cinta métrica con estética y precisión CAD (puntas de flecha finas, eliminación de ruido visual y esferas gigantes, captura magnética exacta), reubicar el panel de control a la izquierda junto a la paleta CAD, y crear el centro interactivo de documentación y ayuda accesible desde la barra superior.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> A continuación se detallan las decisiones confirmadas basadas en tus respuestas:
> - **Estilo visual de la cinta métrica**: Flechas CAD finas en las puntas con cruz sutil, eliminando las esferas de 14-22 mm y los rótulos cuadrados gigantes para permitir una visibilidad 100% limpia de la pieza.
> - **Ubicación del panel de control de medida**: Panel compacto flotante junto a la paleta lateral izquierda (en lugar de colocarse en el centro de la pantalla), con botones proporcionados y elegantes para "Nueva Medida" y "Borrar cota".
> - **Acceso a la Documentación**: Botón "Ayuda" con icono en la barra superior que abre un manual modal interactivo completo con buscador, explicaciones paso a paso de cada herramienta (incluyendo Mecanizados CNC) y diagramas visuales.

---

### 1. Overview & Core Concept

- **Qué hace**:
  1. **Cinta Métrica de Precisión Milimétrica**: Transforma la herramienta de medición 3D en un calibrador técnico estilo CAD/SketchUp. Utiliza puntas de flecha cónicas finas en los dos extremos, cruz sutil de centro, motor de imán mejorado que detecta con exactitud los 8 vértices y 12 puntos medios de las piezas para garantizar que una pieza de 509 mm marque exactamente 509 mm, y mantiene la cota fija al rotar/orbitar la escena.
  2. **HUD Compacto Lateral**: Sustituye la tarjeta central grande por una tarjeta compacta y estilizada ubicada a la izquierda, justo al lado de la barra vertical de herramientas CAD, visible únicamente mientras se mide o hay una cota activa.
  3. **Centro Interactivo de Documentación y Ayuda**: Incorpora un modal completo en la barra superior donde se explica detalladamente el funcionamiento de todas las herramientas del software:
     - **Mecanizados y Perforaciones**: Explica cómo el motor analiza automáticamente los puntos de contacto entre piezas, calcula los taladros para tornillos 4x50, espigas 8x30 y cazoletas de bisagras de 35 mm, muestra su código de colores y permite exportarlos a DXF/CNC.
     - **Cinta Métrica y Cotas**: Guía paso a paso sobre el imán inteligente, fijación de cotas e inspección 3D.
     - **Push/Pull, Mover y Rotar**: Cómo interactuar con las piezas directamente en el espacio 3D.
     - **Luz Libre (Holguras)**: Cálculo en tiempo real de espacios libres entre estantes y laterales.
     - **Optimización y Despiece**: Flujo completo hacia corte y fabricación.

- **Público Objetivo**: Diseñadores de mobiliario en melamina, carpinteros, fabricantes CNC y usuarios que necesitan exactitud dimensional estricta y una curva de aprendizaje intuitiva sin sobrecarga visual.

---

### 2. User Experience & Visual Design

#### 2.1. Cinta Métrica CAD Rediseñada
- **Extremos de Flecha CAD**:
  - En los dos extremos de la cota (Punto A y Punto B) se colocan conos esbeltos orientados a lo largo de la línea de medición cuya punta toca con precisión matemática el vértice o punto de contacto.
  - Se añade una sutil cruz técnica (retícula en cruz ortogonal de 6 mm de diámetro con línea fina de 1 px) en la punta exacta para dar certeza visual sin tapar la arista ni la superficie de la pieza.
  - Se eliminan por completo las esferas amarillas de radio 14 mm, los anillos de radio 22 mm y las tarjetas sprite gigantes con letras "A" y "B".
- **Línea de Medición y Cota Técnica**:
  - Línea continua dorada de alta definición (`#f59e0b` o `#facc15`) entre ambas flechas.
  - Rótulo de distancia flotante compacto y estilizado centrado sobre la línea con texto monoespaciado en mm.
  - Líneas de proyección de cotas auxiliares discretas en los ejes ΔX, ΔY, ΔZ solo cuando se requiere análisis ortogonal.

#### 2.2. Panel Flotante Compacto (Lateral Izquierdo)
- **Posición**: Anclado a `left-18` o `left-20` (inmediatamente a la derecha de la paleta vertical de herramientas CAD) y `top-20`, sin invadir el centro ni la vista principal del modelo.
- **Jerarquía y Controles**:
  - Cabecera mínima con icono de cinta, badge "Imán activo" y botón de cerrar.
  - Bloque numérico claro: `Distancia Total: 509 mm` (con desglose ΔX, ΔY, ΔZ en una sola línea compacta).
  - Botones de acción refinados y proporcionados: botón primario "Nueva Medida" y secundario "Borrar cota" con iconos sutiles.
  - Estado vacío orientativo: si aún no se ha medido, una breve píldora flotante que indica "Haz clic en una esquina para comenzar".

#### 2.3. Modal Interactivo de Documentación ("Manual de Herramientas")
- **Acceso**: Botón en el Header superior `[ Ayuda / Manual ]` con icono `help_outline`, accesible en cualquier momento.
- **Estructura del Modal**:
  - **Buscador Rápido**: Filtro en tiempo real para encontrar herramientas por nombre (ej. "mecanizados", "medir", "tornillos", "puertas", "dxf").
  - **Navegación por Categorías**:
    1. *Herramientas 3D y Medición* (Cinta métrica magnética, Push/Pull, Mover/Rotar, Luz libre, Rayos X).
    2. *Mecanizados y Ensambles CNC* (Explicación técnica detallada del cálculo automático de tornillos, espigas, bisagras y exportación DXF).
    3. *Diseño y Modulación* (Crear piezas, cambiar orientación, materiales, cantos PVC).
    4. *Despiece, Corte y Fabricación* (Lista de corte, optimizador 2D, exportación PDF/DXF).
    5. *Atajos de Teclado* (Esc, Supr, Ctrl+Z, etc.).
  - **Tarjetas de Herramientas**: Cada herramienta cuenta con su icono oficial, descripción clara de cómo se activa, qué hace paso a paso, diagrama o referencia esquemática y consejos profesionales para su uso.

---

### 3. Key Product Decisions & Trade-Offs

- **Decisión 1: Sustitución de Marcadores Esféricos por Flechas Cónicas y Retícula Cruzada**
  - *Enfoque*: Generar una geometría `ConeGeometry` esbelta en Three.js con la punta orientada exactamente hacia el punto medido, más una cruz sutil de 2 segmentos de línea en el plano normal.
  - *Por qué*: Resuelve directamente la queja del usuario sobre no poder ver si la cinta terminó donde necesitaba al rotar la imagen por culpa del círculo gigante y la etiqueta cuadrada.
  - *Alternativas descartadas*: Mantener esferas más pequeñas. Fueron descartadas porque cualquier esfera oculta el vértice de la esquina de la madera.

- **Decisión 2: Mejora del Algoritmo de Snap Magnético y Aumento de Sensibilidad**
  - *Enfoque*: Elevar el radio de captura en pantalla a 32-36 px, comprobar exhaustivamente los 8 vértices exactos de cada pieza en coordenadas de mundo, y si el cursor está sobre la pieza, priorizar las esquinas más cercanas antes que el raycast en el plano interior de la cara.
  - *Por qué*: Explica por qué una pieza de 509 mm dio 501 mm (el raycast cayó 8 mm adentro de la cara en lugar de adherirse al vértice de la arista). Con el imán mejorado, el imán se engancha al vértice exacto, garantizando 509 mm exactos.

- **Decisión 3: Reubicación del HUD de Medición al Lateral Izquierdo**
  - *Enfoque*: Mover el HUD a la izquierda junto a la barra de herramientas y reducir su altura y tamaño de botones en un 40%.
  - *Por qué*: Despeja el centro de la pantalla permitiendo orbitar e inspeccionar el mueble sin distracciones visuales.

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             HEADER COMPONENT                                │
│   [Proyecto ▼]  [Exportar ▼]  ...  [ Ayuda / Manual ] (Abre Modal Doc)      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                      ┌────────────────┴────────────────┐
                      ▼                                 ▼
         ┌─────────────────────────┐       ┌────────────────────────┐
         │  DocumentationModal     │       │  Furniture3DViewer     │
         │  - Buscador             │       │  - Canvas Three.js     │
         │  - Tabs de categorías   │       │  - Paleta CAD Izquierda│
         │  - Guía Mecanizados CNC │       └───────────┬────────────┘
         │  - Guía Cinta Métrica   │                   │
         │  - Atajos de teclado    │                   │
         └─────────────────────────┘                   ▼
                                           ┌────────────────────────┐
                                           │  Left-Docked HUD       │
                                           │  - Distancia CAD       │
                                           │  - Botones Compactos   │
                                           │  - Snap Feedback       │
                                           └────────────────────────┘
```

#### Modificaciones Técnicas Clave:
1. **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`**:
   - Rediseño de `renderMeasurementVisuals()`: sustitución de `SphereGeometry`/`RingGeometry`/`Sprite` gigante por flechas cónicas CAD y crucetas técnicas.
   - Refuerzo de `findMagneticSnapCandidate()` y `getPartSnapPoints()`: cálculo exhaustivo de esquinas mundiales con tolerancia y orden de atracción para fijación exacta al mm.
   - Estado de indicador magnético con rótulo de asistencia de snap en tiempo real.
2. **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.html`**:
   - Reubicación del HUD de medida: de `left-1/2 -translate-x-1/2` a posición lateral izquierda compacta (`left-20 top-4`), reduciendo padding, botones y tipografías.
3. **`src/app/components/documentation-modal/documentation-modal.ts` y `.html`**:
   - Creación de un componente modal standalone de Documentación y Manual de Herramientas con diseño limpio, buscador y cobertura completa de mecanizados, cinta métrica y utilidades CAD.
4. **`src/app/components/header/header.ts` y `.html`**:
   - Inclusión del botón "Ayuda / Guía" que emite o activa la apertura del modal de documentación.
