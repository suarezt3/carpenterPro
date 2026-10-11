# Refinamiento del Entorno 3D: Posición de Cintas, Amplitud Espacial y Tarjeta Esquina en L

Plan de mejora para resolver los tres problemas visuales y conceptuales detectados en la Fase 1 del entorno de Habitación 3D: **eliminación de solapamientos entre barras flotantes**, **claridad y ampliación del espacio de trabajo arquitectónico hasta 12+ metros**, y **corrección visual total de la tarjeta 'Esquina en L'**.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Decisiones confirmadas por el usuario:
>
> 1. **Ubicación de la Cinta Flotante de Habitación:** Ubicarla de modo que **nunca se solape con la cinta vertical de herramientas** (columna izquierda `left-3`), ni con la **cinta de acciones de piezas/grupos seleccionados** (extremo derecho `right-3`). Se posicionará en `left-16` con ancho delimitado, colapsándose a modo compacto cuando haya piezas seleccionadas para garantizar cero interferencias visuales.
> 2. **Amplitud y Funcionamiento Espacial de la Habitación 3D:** Piso y muros 100% paramétricos ampliables **hasta 10-12 metros o más**, asegurando que el entorno sea suficiente tanto para una cocina compacta como para cocinas grandes con islas o espacios abiertos. En Modo Habitación, la escena se enfoca exclusivamente en el piso arquitectónico útil, sin cuadrículas fantasma detrás de las paredes.
> 3. **Tarjeta 'Esquina en L' en el Modal:** Estructurar la tarjeta con un distintivo icono arquitectónico en L, título prominente **"Esquina en L"** y subtítulo explicativo **"Pared frontal + lateral en L"**, eliminando cualquier bug de renderizado en blanco.

---

## 1. Overview & Core Concept

- **Problema 1 (Solapamiento de Cintas):** La barra superior de Modo Habitación estaba en `top-3 left-3`, exactamente en las mismas coordenadas de la paleta vertical CAD (`top-3 left-3`), pisando los iconos de selección y movimiento.
- **Problema 2 (Espacio y Cuadrantes):** El visor mostraba una cuadrícula neutra centrada en `(0,0)`, haciendo parecer que los muros solo ocupaban un cuadrante y generando dudas sobre si el espacio era suficiente.
- **Problema 3 (Tarjeta en Blanco):** En el modal de configuración, la tarjeta de "Esquina en L" aparecía vacía sin texto ni icono visible.

---

## 2. User Experience & Visual Design

### A. Desacoplamiento de Cintas y Barras Flotantes
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [Paleta CAD]  [Barra Habitación 3D: L-Shape 3600mm]           [Acciones Pieza/Grupo]   │
│  top-3        top-3 left-16 (despejada)                        top-3 right-3           │
│  left-3       (se compacta si hay piezas seleccionadas)        (cuando hay selección)  │
│  │                                                                                     │
│  ▼                                                                                     │
│  [Herramientas]                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Nueva posición:** `top-3 left-16 sm:left-18 z-20`. Deja 64px de holgura libre respecto a la paleta CAD vertical.
- **Comportamiento inteligente:** Si el usuario tiene una pieza o grupo seleccionado (aparece la barra en `right-3`), la barra de habitación reduce su ancho o muestra un badge condensado `🏠 Habitación 3D` para no competir por espacio horizontal.

### B. Espacio Arquitectónico Realista y Escalable
- **Explicación al usuario:** El espacio es 100% ilimitado y paramétrico. No está restringido a un solo cuadrante:
  - Longitud de muro principal: ajustable desde 1,200 mm hasta **12,000 mm (12 metros)**.
  - Longitud de muro lateral en L: ajustable desde 1,000 mm hasta **10,000 mm (10 metros)**.
  - Piso arquitectónico: se adapta dinámicamente para cubrir el 100% del área de los muros más un margen frontal de maniobra.
- **Presets Rápidos en el Modal:**
  - *Cocina Lineal Compacta:* 3,000 mm
  - *Cocina Estándar con Retorno:* 4,200 mm × 2,400 mm
  - *Cocina Amplia con Isla:* 6,000 mm × 4,000 mm
  - *Gran Salón / Espacio Abierto:* 8,500 mm × 6,000 mm
- **Eliminación de cuadrícula residual:** Al activar Modo Habitación, la cuadrícula genérica central de taller se oculta completamente, mostrando únicamente el suelo texturizado real y su rejilla milimétrica propia.

### C. Tarjeta 'Esquina en L' Totalmente Visible y Robusta
- Rediseño con contenedor `min-w-0`, `flex-1`, badge con icono tipográfico/SVG en L (`corner_down_right` / insignia `L`), tipografía con color contrastado `text-slate-900` y subtítulo nítido que no colapsa bajo ninguna resolución de pantalla.

---

## 3. Technical Architecture & File Changes

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        ModuleDesignerComponent (HTML & TS)                             │
│                                                                                        │
│  1. Floating Ribbon Positioning:                                                       │
│     - Move from 'top-3 left-3' -> 'top-3 left-16 sm:left-20'                           │
│     - Responsive max-w constraint to avoid collision with right-3 action bar           │
│                                                                                        │
│  2. Modal 'Esquina en L' Card Fix:                                                     │
│     - Replace missing/unsupported icon with robust architectural L badge               │
│     - Ensure text-slate-800/sky-950 and explicit layout classes                        │
│                                                                                        │
│  3. Space Presets & Scaling:                                                           │
│     - Add quick room dimension presets (Compacta, Estándar, Isla, Abierta)             │
│     - Expand max slider/input range up to 12000 mm                                     │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       Furniture3dViewerComponent (TS)                                  │
│                                                                                        │
│  1. Pure Architectural Floor Framing:                                                  │
│     - Ensure workshop GridHelper is 100% hidden in room mode                           │
│     - Center camera framing nicely on room bounds                                      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Archivos Involucrados:
1. `src/app/components/module-designer/module-designer.html`:
   - Corregir posición de la barra de habitación a `top-3 left-16 sm:left-20`.
   - Reemplazar el botón de "Esquina en L" para asegurar visibilidad total de título, icono y descripción.
   - Añadir botones de presets de tamaño de habitación (3m, 4.5m, 6m, 8m).
2. `src/app/components/module-designer/module-designer.ts`:
   - Añadir método `applyRoomPreset(type: 'compact' | 'standard' | 'island' | 'open')`.
3. `src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`:
   - Asegurar que la cuadrícula global de taller no se superponga ni muestre cuadrantes vacíos en Modo Habitación.
