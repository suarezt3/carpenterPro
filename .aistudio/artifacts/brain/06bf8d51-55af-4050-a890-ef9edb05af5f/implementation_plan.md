# Rediseño UI/UX: Tipografía Técnica, Barra Superior Compacta y Adaptación Dinámica 1080p / 2K

Transformación integral de la experiencia visual y ergonómica de MelamiPro Studio. Se integran las fuentes **Plus Jakarta Sans** (interfaz moderna, limpia y sin ruido) y **JetBrains Mono** (cotas, dimensiones y métricas técnicas); se rediseña la barra superior en formato ultra-compacto de alta densidad eliminando desbordamientos (ocultando la pestaña "Etiquetas" y compactando el título/cliente); y se adopta un layout dinámico a pantalla completa (`100vh`) donde el visor 3D y el panel lateral se adaptan automáticamente a monitores **1080p y 2K** sin provocar barras de scroll vertical innecesarias.

## User Review & Critical Decisions

> [!IMPORTANT]
> Decisiones y preferencias confirmadas por el usuario:
> 1. **Tipografía**: Plus Jakarta Sans moderna para la interfaz y textos generales, combinada con JetBrains Mono para cotas milimétricas, coordenadas y números tabulares.
> 2. **Adaptación de Pantalla (1080p y 2K)**: Ajuste dinámico a pantalla completa (`100vh`) sin scroll vertical en el navegador. En 1080p todos los controles caben a la vista; en 2K el visor 3D y el panel lateral se expanden automáticamente aprovechando cada píxel disponible.
> 3. **Barra Superior**: Ocultar la sección "5. Etiquetas" para liberar espacio horizontal, remover o compactar el subtítulo largo de proyecto/cliente en el logo, y aplicar botones compactos de alta densidad para evitar cualquier desbordamiento lateral.
> 4. **Reducción de Ruido Visual**: Limpieza de textos redundantes, tarjetas y bordes pesados, aplicando un diseño CAD refinado y profesional estilo software de ingeniería moderna.

---

## 1. Overview & Core Concept

- **Ergonomía de Estudio CAD a Pantalla Completa**:
  - Elimina el scroll vertical de la ventana en el Diseñador 3D. El espacio de trabajo se calcula dinámicamente (`h-[calc(100vh-56px)]`) para que el lienzo 3D y el panel de propiedades compartan el 100% de la altura útil de la pantalla.
  - En **monitores 2K (1440p)**: El visor Three.js y el dock de inspección crecen verticalmente hasta llenar el monitor panorámico, sin huecos vacíos abajo.
  - En **monitores 1080p (Full HD)**: El lienzo y la barra de fichas de piezas permanecen 100% dentro del marco visual sin requerir scroll hacia abajo para encontrar botones.
- **Barra Superior Compacta de Alta Densidad (Zero Overflow)**:
  - Ocultación discreta de la pestaña "5. Etiquetas" (preservando el componente en el código para reactivación futura).
  - Zona de marca simplificada: `MelamiPro` con insignia `v2.0 Taller` y selector/indicador de proyecto compacto en una sola línea.
  - Botones de acción en una hilera estilizada con anchos y espaciados calculados (`h-8.5`), etiquetas concisas y tooltips informativos para que nunca se desborden hacia la derecha.
- **Sistema Tipográfico y Anti-Ruido Visual**:
  - Carga optimizada de Google Fonts: **Plus Jakarta Sans** (400, 500, 600, 700) + **JetBrains Mono** (500, 600) con `tabular-nums`.
  - Reemplazo de descripciones extensas y banners decorativos por micro-indicadores técnicos elegantes.

---

## 2. User Experience & Visual Design

### 1. Barra Superior Compacta y Equilibrada (Top Bar)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [MelamiPro · Cocina Moderna]     [1. Diseñador 3D] [2. Despiece] [3. Optimizador] [4. Presupuesto]               │
│                                           [↺] [↻] [• Auto] [☁ Guardar] [+ Nuevo] [📁 Proyectos] [Exportar] [⚙]   │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Zona Izquierda (Marca & Proyecto)**: Logotipo minimalista, insignia `v2.0 Taller` y nombre del proyecto en una sola línea compacta con truncado inteligente (`max-w-[200px] truncate`).
- **Zona Central (Pestañas Navegación)**: 4 pestañas esenciales (1. Diseñador 3D, 2. Despiece, 3. Optimizador 2D, 4. Presupuesto). La pestaña "5. Etiquetas" queda oculta de la barra de navegación.
- **Zona Derecha (Acciones Rápidas)**:
  - Deshacer / Rehacer en bloque compacto (`Ctrl+Z` / `Ctrl+Y`).
  - Toggle compacto `Auto ON/OFF`.
  - Botón `Guardar` con icono de nube estilizado en altura regular.
  - Botones de acción secundaria (`Nuevo`, `Proyectos`, `Exportar`, `Configuración`) con iconos nítidos y padding armónico.

### 2. Layout Dinámico a Pantalla Completa (1080p & 2K)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ HEADER FIJO (56px)                                                                                               │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ SUB-BARRA DE HERRAMIENTAS Y PLANTILLAS (40px)                                                                    │
├────────────────────────────────────────────────────────────────────────┬─────────────────────────────────────────┤
│                                                                        │ DOCK DE PROPIEDADES & CATÁLOGO          │
│                                                                        │ (h-full con scroll interno suave)       │
│                      VISOR 3D THREE.JS                                 │                                         │
│                 (h-full dinámico 100% de la altura útil)               │ • Propiedades de Pieza                  │
│                                                                        │ • Edición Milimétrica                   │
│                                                                        │ • Materiales & Cantos                   │
│                                                                        │ • Añadir Piezas & Cajón                 │
├────────────────────────────────────────────────────────────────────────┤                                         │
│ BARRA DE FICHAS DE PIEZAS (36px) [Todo] [Techo] [Lateral] [Fondo] ...  │                                         │
└────────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────┘
```

---

## 3. Key Product Decisions & Trade-Offs

- **Flex-1 con `min-h-0` y `overflow-hidden`**:
  - *Enfoque*: En lugar de alturas fijas en píxeles (`h-[720px]`), el contenedor principal de la aplicación y el visor 3D usan `flex-1 min-h-0 h-full`. El `ResizeObserver` de Three.js ya existente detecta el tamaño exacto del contenedor y escala la cámara y el renderizador al milímetro.
  - *Razón*: Garantiza que en 1080p (altura neta ~880px) todo encaje sin barra de scroll de ventana, y en 2K (altura neta ~1350px) el visor aproveche los ~1200px de espacio vertical disponible.
- **Ocultamiento de Etiquetas sin Eliminación de Código**:
  - *Enfoque*: Se oculta el botón de la barra de navegación en `header.html` y se mantiene la vista `<app-labels-view>` registrada en el switch de `app.html`.
  - *Razón*: El usuario solicitó dejarla lista para reactivarse cuando se requiera sin perder lógica ni componentes.
- **Tipografía Plus Jakarta Sans + JetBrains Mono**:
  - *Enfoque*: Fuente sans-serif contemporánea con excelente legibilidad en monitores oscuros de taller, emparejada con JetBrains Mono para números milimétricos y alineación tabular estricta.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                      index.html & styles.css                                   │
│  - Google Fonts: Plus Jakarta Sans (400, 500, 600, 700)                        │
│  - Google Fonts: JetBrains Mono (500, 600)                                     │
│  - font-family global: 'Plus Jakarta Sans', system-ui, sans-serif             │
│  - font-mono: 'JetBrains Mono', monospace                                      │
└────────────────────────────────────────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼─────────────────────────────────────────┐
│                        App Component (app.html)                                │
│  - Container: h-screen flex flex-col overflow-hidden (0 window scrollbar)       │
│  - Header: shrink-0 h-14                                                       │
│  - Main: flex-1 min-h-0 flex flex-col overflow-hidden (o scroll en despiece)   │
└────────────────────────────────────────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼─────────────────────────────────────────┐
│                    ModuleDesigner (module-designer.html)                       │
│  - Top Toolbar: shrink-0 py-1.5 px-3 (Plantillas, piezas, m²)                  │
│  - Grid: flex-1 min-h-0 grid grid-cols-12 h-full gap-2.5                       │
│  - Left Column: flex flex-col h-full min-h-0 (col-span-9)                      │
│    - 3D Viewer: flex-1 min-h-0 w-full h-full relative                          │
│    - Bottom Chips: shrink-0 py-1 px-2                                          │
│  - Right Column: h-full min-h-0 flex flex-col overflow-hidden (col-span-3)     │
│    - Panel Body: flex-1 min-h-0 overflow-y-auto                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Archivos a Modificar:
1. `src/styles.css` & `src/index.html`: Carga de fuentes Google Fonts (Plus Jakarta Sans y JetBrains Mono) y reglas de tipografía y números tabulares.
2. `src/app/components/header/header.html` & `header.ts`: Ocultar pestaña "Etiquetas", compactar nombre de proyecto/cliente en una sola línea, y optimizar espaciados de botones para evitar desbordamientos.
3. `src/app/app.html`: Layout raíz `h-screen flex flex-col overflow-hidden` para el modo diseñador 3D.
4. `src/app/components/module-designer/module-designer.html`: Reemplazo de alturas fijas por `flex-1 min-h-0 h-full` tanto en el contenedor 3D como en el dock lateral.
5. `src/app/components/furniture-3d-viewer/furniture-3d-viewer.html`: Contenedor adaptativo `w-full h-full min-h-[480px]` para que el WebGL canvas ocupe todo el espacio asignado por el flexbox.
