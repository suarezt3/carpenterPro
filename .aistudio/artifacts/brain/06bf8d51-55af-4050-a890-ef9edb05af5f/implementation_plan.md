# Modularidad de Muros y Corrección del Modal de Habitación 3D

Plan de refinamiento para hacer los **muros 3D modulares y reposicionables**, **eliminar el espacio muerto detrás de las paredes** alineándolos automáticamente con el borde del suelo, e **integrar soporte para gizmo 3D y controles X/Z**, junto con la **corrección del desbordamiento horizontal del modal**.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Decisiones de diseño confirmadas con el usuario:
>
> 1. **Control de Posición de los Muros (Confirmado):** Controles numéricos milimétricos de desplazamiento X y Z en el panel de configuración + capacidad de selección interactiva de los muros en el visor 3D con Gizmo de traslación.
> 2. **Alineación con el Suelo (Confirmado):** Alinear los muros automáticamente al borde posterior e izquierdo del suelo para aprovechar el 100% del área de trabajo útil sin baldosas vacías detrás de las paredes.
> 3. **Corrección Visual del Modal (Confirmado):** Eliminar el desbordamiento horizontal en el modal de configuración de habitación 3D aplicando `overflow-x-hidden`, contenedores flexibles responsivos `min-w-0`, y reajuste en las tarjetas de selección para que "Esquina en L" y las opciones de textura se muestren compactas y totalmente visibles.

---

## 1. Overview & Core Concept

- **Qué resuelve:** Actualmente las paredes se generaban con suelo sobrante detrás y a la izquierda (área muerta inutilizable). Además, los muros eran estáticos sin capacidad de desplazarse en el espacio ni estirarse con libertad, y el modal presentaba un corte horizontal en pantallas medianas.
- **Solución:**
  - Alineación precisa del sistema de coordenadas para que la cara exterior del muro coincida exactamente con el límite posterior e izquierdo del piso arquitectónico.
  - Parámetros de desplazamiento `wallOffsetX` y `wallOffsetZ` en `RoomConfiguration` con botones rápidos en el panel y arrastre interactivo con Gizmo en 3D.
  - Corrección de anchos y paddings en el modal para visualización 100% fluida sin barra de desplazamiento horizontal.

---

## 2. User Experience & Visual Design

### A. Alineación y Aprovechamiento del Espacio 3D
- La esquina de la habitación se ubica en el extremo posterior e izquierdo del piso.
- Todo el piso texturizado queda frente a las paredes hacia el usuario, maximizando la superficie para muebles, islas y mesas.
- Botón rápido en el panel: **"Alinear al borde del piso"** que resetea cualquier desfase a la posición óptima de aprovechamiento.

### B. Muros Modulares y Posicionables
- **Controles en Panel:**
  - Desplazamiento X (Lateral) y Desplazamiento Z (Fondo / Profundidad).
  - Acciones rápidas para estirar o encoger muros (+200 mm, +500 mm).
- **Manipulación 3D:**
  - Al hacer clic en un muro en Modo Habitación 3D, el muro queda seleccionado con contorno resaltado y se activa el gizmo de traslación horizontal (ejes X y Z) para arrastrarlo y posicionarlo libremente en la escena.

### C. Rediseño del Modal de Configuración (Sin Desbordamiento)
- Sustitución de grids rígidos por diseños fluidos `min-w-0` y `overflow-x-hidden`.
- Rediseño de las tarjetas de disposición de paredes:
  - Estructura compacta en 2 columnas equilibradas con `p-2.5`, iconos nítidos y subtítulos que no se desbordan.
- Ajuste del grid de acabados (piso y muros) para que en resoluciones compactas se distribuyan en 2 columnas y en pantallas mayores en 3 columnas sin generar scroll horizontal.

---

## 3. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ModuleDesignerComponent                         │
│                                                                        │
│  Room State Updates:                                                   │
│  - roomConfig: { layout, mainWallLength, sideWallLength, wallHeight,   │
│                  wallOffsetX, wallOffsetZ, floorAlign: 'edge' }        │
│                                                                        │
│  Modal Layout (Fixed Overflow):                                        │
│  - max-w-2xl overflow-hidden w-full                                    │
│  - Body: overflow-y-auto overflow-x-hidden min-w-0                     │
│  - Layout cards: grid-cols-2 gap-2 min-w-0                             │
│                                                                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Inputs: roomConfig, workspaceMode
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Furniture3dViewerComponent                       │
│                                                                        │
│  1. Floor Coordinate Realignment:                                      │
│     - Floor plane placed from Z = 0 to Z = floorDepth                  │
│     - Main Wall sits at Z = wallOffsetZ, X = wallOffsetX               │
│     - Side Wall sits at X = wallOffsetX, Z = wallOffsetZ               │
│     -> ZERO dead floor space behind walls!                             │
│                                                                        │
│  2. Interactive Wall Selection & Gizmo:                                │
│     - raycaster intersects wall meshes                                 │
│     - Active wall selection attaches Gizmo for X/Z translation         │
│     - Emits wall position update back to roomConfig                    │
└────────────────────────────────────────────────────────────────────────┘
```

### Cambios Concretos en Archivos:

1. **`src/app/models/melamine.models.ts`:**
   - Añadir `wallOffsetX: number` y `wallOffsetZ: number` a `RoomConfiguration`.
2. **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`:**
   - Reubicar el piso y las paredes para que el borde posterior coincida con el muro principal sin espacio muerto detrás.
   - Habilitar selección de muros en Modo Habitación para activar el Gizmo de traslación en X y Z.
3. **`src/app/components/module-designer/module-designer.html`:**
   - Corregir el layout del modal: aplicar `overflow-x-hidden`, contenedores `min-w-0`, y reajuste en las tarjetas de "Pared Recta" y "Esquina en L".
   - Añadir controles de posición X y Z y botón de alineación automática en la sección de dimensiones de los muros.
