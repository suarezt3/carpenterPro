# Selección Múltiple 3D, Cinta Métrica Interactiva y Reorganización de la Barra Superior

Implementación de selección múltiple de piezas (Shift+Clic y botón "Seleccionar Todo") con traslación simultánea en bloque, herramienta de cinta métrica 3D interactiva para medir distancias y holguras entre puntos o piezas (distancia directa, $\Delta X$, $\Delta Y$, $\Delta Z$), y rediseño del encabezado superior a pantalla completa eliminando márgenes desperdiciados y estandarizando todos los botones en una sola fila equilibrada.

## User Review & Critical Decisions

> [!IMPORTANT]
> Decisiones confirmadas por el usuario:
> 1. **Selección múltiple**: Mantener tecla `Shift` + clic para agregar o quitar piezas de la selección, junto con un botón rápido de "Seleccionar Todo" y gizmo centralizado para arrastrar todo el conjunto a la vez.
> 2. **Herramienta de medición**: Cinta métrica interactiva 3D entre 2 clics con lectura de distancia directa y desglose de cotas proyectadas en los 3 ejes ($\Delta X$ lateral, $\Delta Y$ altura, $\Delta Z$ fondo).
> 3. **Encabezado superior**: Distribución expandida a todo el ancho de la pantalla (`w-full`) en 3 zonas (Identidad/Proyecto, Pestañas de navegación centralizadas, y Botones de acción alineados con altura uniforme `h-9` y texto de una sola línea `whitespace-nowrap`).

---

## 1. Overview & Core Concept

- **Selección Múltiple y Arrastre en Grupo**:
  - Permite agrupar un cajón, módulo o conjunto de piezas completo para moverlo o reubicarlo como una sola unidad en el plano 3D.
  - Al seleccionar varias piezas (mediante `Shift+Clic` o botón "Seleccionar Todo"), el gizmo de traslación 3D se ubica en el centro geométrico del grupo. Al arrastrar una flecha o usar las flechas del teclado / HUD, **todas las piezas se desplazan juntas en sincronía**, manteniendo sus distancias relativas.
  - Cada traslación en bloque se registra en el historial como una sola acción de Deshacer (`Ctrl+Z`).
- **Cinta Métrica 3D Interactiva**:
  - Activada con un botón `Medir / Cinta Métrica` en la barra del visor 3D.
  - Permite hacer clic en cualquier punto o arista de una pieza (punto A) y luego en otra (punto B), trazando una línea milimétrica con extremos tipo cota y una tarjeta flotante con la distancia exacta ($D$) y sus componentes:
    - $\Delta X$: distancia horizontal / luz entre costados.
    - $\Delta Y$: distancia vertical / luz entre estantes o suelo.
    - $\Delta Z$: distancia en profundidad.
- **Rediseño Completo del Encabezado (Top Bar Contract)**:
  - Elimina la restricción `max-w-7xl` para aprovechar los monitores panorámicos de carpintería y taller.
  - Corrige el botón "Guardar en Nube" para que mantenga altura constante (`h-9`), no se deforme ni se haga "gordito", y conserve espaciado simétrico con el resto de opciones.

---

## 2. User Experience & Visual Design

### 1. Barra Superior Reorganizada a Pantalla Completa (3 Zonas)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [MelamiPro · Mueble Barra]         [Módulos 3D] [Piezas] [Corte] [Presupuesto]         [↺] [↻] [Auto:ON] [Guardar]│
│                                                                                       [Nuevo] [Proyectos] [Export]│
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Zona Izquierda**: Logotipo, versión y nombre del proyecto editable con cliente.
- **Zona Central**: Navegador de pestañas con botones tipo cápsula refinada y estados activos de alto contraste.
- **Zona Derecha**: Grupo de acciones con padding uniforme, sin saltos de línea ni botones sobredimensionados:
  - Bloque Deshacer / Rehacer (`Ctrl+Z` / `Ctrl+Y`).
  - Interruptor compacto `Auto-guardado ON/OFF`.
  - Botón `Guardar en Nube` estilizado con texto en una sola línea `whitespace-nowrap`.
  - Botones secundarios: `Nuevo`, `Proyectos`, `Exportar JSON`, `Configuración`.

### 2. Selección Múltiple 3D

- En la barra inferior del visor 3D se añade el botón **"Seleccionar Todo"** y el contador dinámico (ej. `3 piezas seleccionadas`).
- Al presionar `Shift` y hacer clic en el 3D, la pieza se añade o retira de la selección activa.
- Las piezas seleccionadas muestran un contorno azul cobalto técnico.
- Las flechas del gizmo 3D aparecen centradas en el grupo.

### 3. Cinta Métrica 3D

- Botón en la botonera superior del visor: `Regla / Medir` con icono `straighten`.
- Al activarse, aparece una guía visual y se habilita el puntero de medición.
- Un clic fija el Punto A y el siguiente fija el Punto B, desplegando la cota 3D con indicador numérico.
- Botón "Limpiar Medida" o presionar `Esc` para reiniciar.

---

## 3. Key Product Decisions & Trade-Offs

- **Centroide de Grupo para el Gizmo de Traslación**:
  - *Enfoque*: Calcular el centroide $\bar{P} = \frac{1}{N}\sum P_i$ de las piezas seleccionadas y posicionar allí las flechas de traslación.
  - *Razón*: Mover el grupo desde su centro visual resulta natural e intuitivo para el usuario, independientemente de cuántas piezas compongan el conjunto.
- **Sincronización en Lote con `pushSnapshot()`**:
  - *Enfoque*: Desplazar todas las piezas con un solo `updateProject` acumulativo por interacción, de modo que presionar `Ctrl+Z` revierta el movimiento de todo el cajón o grupo a la vez.
- **Cinta Métrica Basada en Raycasting 3D con Puntos de Anclaje a Vértices**:
  - *Enfoque*: La cinta métrica detecta las superficies y esquinas de las piezas mediante raycasting, permitiendo medir luces internas, alturas de cajón o espacios libres con exactitud milimétrica.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           Header Component (w-full)                            │
│  - Zona 1: Brand & Project Info                                                │
│  - Zona 2: Navigation Tabs                                                     │
│  - Zona 3: Action Buttons (Undo/Redo, Auto-Sync, Save Cloud, Projects, Export) │
└────────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────────┐
│                   Furniture3dViewerComponent (3D Core)                         │
│  - selectedPartIds: signal<string[]> (Multi-Selection Set)                     │
│  - selectAllParts() / togglePartSelection(partId)                              │
│  - Group Dragging: onPointerMove traslada todas las piezas por deltaWorld      │
│  - Measure Tool:                                                               │
│    - isMeasureMode: signal<boolean>(false)                                     │
│    - measurePointA: Vector3 | null                                             │
│    - measurePointB: Vector3 | null                                             │
│    - dynamic MeasureLine 3D & HTML HUD Badge                                   │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Componentes y Archivos Clave a Modificar

1. **`src/app/components/header/header.html` & `header.ts`**:
   - Reemplazar `max-w-7xl mx-auto` por contenedor fluido a pantalla completa `w-full px-4 sm:px-6 lg:px-8`.
   - Reestructurar el header en 3 zonas claras con flexbox equilibrado (`justify-between items-center`).
   - Normalizar la altura (`h-9`), padding y `whitespace-nowrap` del botón "Guardar en Nube" y resto de botones para eliminar deformaciones.

2. **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts` & `furniture-3d-viewer.html`**:
   - Soporte de selección múltiple: signal `selectedPartIds = signal<string[]>([])`.
   - Detección de `e.shiftKey` en `onPointerDown` para multi-selección acumulativa.
   - Botón "Seleccionar Todo" y "Deseleccionar".
   - Arrastre grupal: cuando `selectedPartIds.length > 1`, desplazar todas las piezas seleccionadas simultáneamente.
   - Herramienta de medición 3D: modo cinta métrica interactiva con cálculo de distancia euclidiana y proyecciones en X, Y, Z.

3. **`src/app/components/module-designer/module-designer.ts` & `module-designer.html`**:
   - Soporte para mover múltiples piezas seleccionadas en bloque desde el diseñador.
