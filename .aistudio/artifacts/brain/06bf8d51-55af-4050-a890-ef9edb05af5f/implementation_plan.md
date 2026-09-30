# Estiramiento Unidireccional 3D, Deshacer/Rehacer y Control de Guardado en Nube

Ajuste del comportamiento de redimensionamiento de piezas mediante tiradores 3D para que crezcan exclusivamente hacia el lado jalado (anclando el extremo opuesto), incorporación de un sistema de historial de cambios con botones Deshacer/Rehacer (y atajos de teclado Ctrl+Z / Ctrl+Y), y desacoplamiento del guardado en la nube con botón manual y switch opcional de auto-guardado.

## User Review & Critical Decisions

> [!IMPORTANT]
> Decisiones confirmadas por el usuario:
> 1. **Guardado en la nube**: Se implementará el guardado manual mediante el botón "Guardar en Nube", junto con un interruptor (switch) visible para habilitar/deshabilitar el auto-guardado automático según la preferencia del carpintero.
> 2. **Historial de cambios**: Se añadirán botones dedicados para **Deshacer (Undo)** y **Rehacer (Redo)** en la barra superior, con soporte de atajos de teclado globales (`Ctrl+Z` / `Cmd+Z` y `Ctrl+Y` / `Ctrl+Shift+Z`).

---

## 1. Overview & Core Concept

- **Estiramiento Unidireccional de Piezas (3D)**: Actualmente, al modificar la longitud o ancho de una pieza jalando un tirador exterior, la pieza crece simétricamente en ambos sentidos respecto a su centro. Con este ajuste, al jalar el extremo superior, la base permanece fija y solo crece hacia arriba; al jalar hacia abajo, el tope se mantiene fijo y solo crece hacia abajo; y de forma análoga para laterales y fondo.
- **Historial Deshacer / Rehacer (Undo / Redo)**: El usuario podrá experimentar libremente en el diseño 3D, agregar, mover, redimensionar piezas o modificar materiales sabiendo que puede revertir cualquier error al instante.
- **Control de Guardado Flexible**: Control explícito del momento exacto en que se suben los datos a Supabase, evitando sobreescrituras no deseadas en la nube mientras se realizan pruebas intermedias.

---

## 2. User Experience & Visual Design

### Flujo de Interacción y Controles

1. **Visor 3D y Manipulación**:
   - Al seleccionar una pieza (resaltada en Azul Cobalt Técnico `#1d4ed8`), aparecen los tiradores en sus extremos.
   - Al arrastrar el tirador superior (+Y o +X según orientación), el cursor cambia a flechas dimensionales y la pieza se estira en tiempo real únicamente en la dirección del arrastre con snap de 5 mm.
   - El extremo opuesto actúa como punto de anclaje estático.

2. **Barra Superior (Top Bar Contract)**:
   - Se incorporan los botones **Deshacer** (`mat-icon: undo`) y **Rehacer` (`mat-icon: redo`) junto al nombre del proyecto o en la botonera de acciones principales, con estados activos/deshabilitados según la disponibilidad del historial.
   - Al lado del botón **"Guardar en Nube"**, se añade un selector compacto de **Auto-guardar** (con indicador ON/OFF), permitiendo guardar manualmente con un clic o activar la sincronización periódica automática.

3. **Atajos de Teclado**:
   - `Ctrl+Z` / `Cmd+Z`: Deshacer la última acción.
   - `Ctrl+Y` / `Ctrl+Shift+Z` / `Cmd+Shift+Z`: Rehacer la última acción deshecha.
   - Los atajos se ignoran si el foco está dentro de un campo de texto o formulario para no interferir con la edición de texto.

---

## 3. Key Product Decisions & Trade-Offs

- **Compensación de Posición en Redimensionamiento**:
  - *Enfoque*: Cuando la dimensión de la pieza cambia en $\Delta$, su posición de centro en ese eje debe desplazarse exactamente en $(\Delta / 2) \times \text{dirección}$.
  - *Razón*: Dado que Three.js construye las geometrías de cajas (`BoxGeometry`) centradas en $(0,0,0)$, desplazar el centro en la mitad del cambio fija automáticamente el lado opuesto en el espacio 3D mundial.
- **Pila de Historial en Memoria y Snapshot Diferido**:
  - *Enfoque*: Registrar el estado del proyecto en la pila de `undo` antes de iniciar la interacción (por ejemplo al hacer `pointerdown` en un tirador o al agregar/eliminar piezas) y limitar la pila a 30 niveles para garantizar máxima fluidez y bajo consumo de memoria.
- **Auto-guardado Opcional con Persistencia Local Siempre Activa**:
  - *Enfoque*: El almacenamiento local en el navegador (`localStorage`) se mantiene instantáneo para evitar pérdida de datos si se cierra la pestaña; la sincronización con Supabase respeta la preferencia del switch (desactivado por defecto o configurable) y solo se ejecuta automáticamente si el usuario lo activa.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Top Bar (Header Component)                      │
│   [MelamiPro] · [Deshacer (Ctrl+Z)] [Rehacer (Ctrl+Y)]                 │
│                 [Switch: Auto-guardar ON/OFF] [Guardar en Nube]        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 ProjectStorageService (State Manager)                  │
│   - currentProject (signal)                                            │
│   - undoStack / redoStack (signals)                                    │
│   - canUndo / canRedo (computed)                                       │
│   - autoSyncCloud (signal, default false / persistible)                │
│   - undo() / redo() / pushHistoryState()                               │
│   - saveCurrentToCloud()                                               │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   ▼                                 ▼
┌─────────────────────────────────────┐   ┌──────────────────────────────┐
│  3D Viewer (furniture-3d-viewer)    │   │   SupabaseService (Cloud)    │
│  - onPointerDown: push snapshot     │   │   - saveProject(...)         │
│  - onPointerMove:                   │   │   (solo invocado manualmente │
│    newDim = dim + steppedDelta      │   │    o si autoSyncCloud está   │
│    newPos = pos + (stepped/2) * dir │   │    activado)                 │
└─────────────────────────────────────┘   └──────────────────────────────┘
```

### Componentes y Archivos Clave a Modificar

1. **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`**:
   - Ajustar el cálculo matemático de estiramiento en `onPointerMove`: calcular tanto el nuevo tamaño (`length` o `width`) como el nuevo desplazamiento del centro (`posX`, `posY` o `posZ`) en función del vector unitario del tirador (`dir`) y la orientación de la pieza (`horizontal`, `vertical_yz`, `vertical_xy`).
   - Emitir el registro de historial al inicio del arrastre de tiradores para que la operación completa sea reversible en un solo paso de Deshacer.

2. **`src/app/services/project-storage.service.ts`**:
   - Implementar las señales `undoStack`, `redoStack`, `canUndo`, `canRedo`, `autoSyncEnabled`.
   - Métodos `undo()`, `redo()`, `snapshotState()`, `toggleAutoSync()`.
   - Modificar `saveToStorage`: solo llamar a `scheduleCloudAutoSync` si `autoSyncEnabled()` es verdadero.

3. **`src/app/components/header/header.ts` & `header.html`**:
   - Agregar botones con iconos `<mat-icon>undo</mat-icon>` y `<mat-icon>redo</mat-icon>`.
   - Añadir interruptor toggle estilizado para "Auto-guardar en nube".
   - Conectar atajos de teclado (`window.addEventListener('keydown')`) para Deshacer y Rehacer.
