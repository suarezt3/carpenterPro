# Imán Magnético 3D a 1mm, Control con Teclado y Micro-Ajuste en Zoom

Implementación de un sistema de unión magnética inteligente (Face Snapping) con resolución de 1 mm para acoplar piezas sin solapamientos ni holguras, control de desplazamiento milimétrico mediante flechas de teclado y un HUD flotante de micro-ajuste para manipular piezas con zoom aplicado sin depender de la visibilidad de las guías 3D.

## User Review & Critical Decisions

> [!IMPORTANT]
> Decisiones confirmadas por el usuario:
> 1. **Ajuste de unión entre piezas**: Imán magnético automático a caras y cantos de piezas contiguas con precisión de 1 mm (eliminando los saltos bruscos de 5 mm y asegurando unión exacta a 0 mm de contacto).
> 2. **Desplazamiento con zoom aplicado**: Control dual mediante flechas del teclado en el visor 3D y una botonera HUD flotante de micro-ajuste milimétrico (X, Y, Z con pasos de 1 mm y 10 mm).

---

## 1. Overview & Core Concept

- **Imán Magnético Inteligente (Face Snapping)**:
  - Al arrastrar o estirar una pieza, el visor calculará en tiempo real los planos límites (caras frontal, trasera, laterales, superior e inferior) de todas las demás piezas del mueble.
  - Cuando la cara de la pieza en movimiento se acerque a menos de 12 mm de la cara de otra pieza, se "enganchará" magnéticamente con precisión matemática de 0 mm (contacto perfecto sin interpenetración).
  - La resolución base de arrastre libre pasa de 5 mm a 1 mm.
- **Movimiento con Teclado en Zoom (Nudge System)**:
  - Al tener una pieza seleccionada, el usuario podrá acercar la cámara al máximo para inspeccionar un ensamble o unión y mover la pieza utilizando las **Flechas del teclado** (←/→ para eje X, ↑/↓ para eje Z de profundidad, y `RePág`/`AvPág` o `Shift+↑/↓` para eje Y de altura).
- **HUD Flotante de Micro-Ajuste**:
  - En la esquina inferior del visor 3D se mostrará un panel compacto y no invasivo con botones `[-1mm]`, `[+1mm]`, `[-10mm]`, `[+10mm]` para cada eje (X lateral, Y vertical, Z profundidad), permitiendo ajustar la posición con un clic manteniendo la vista de detalle.

---

## 2. User Experience & Visual Design

### Flujo de Interacción y Pantalla

1. **Inspección de Unión y Arrastre Suave**:
   - Al estirar o trasladar una pieza, los movimientos son ultra-fluidos en pasos de 1 mm.
   - Si la pieza se aproxima a otra pieza vecina, se activa un efecto de enganche magnético y un destello sutil de color cian en la arista de contacto, garantizando que queden exactamente alineadas como en un software CAD profesional (SketchUp / AutoCAD).

2. **Control por Teclado**:
   - `←` / `→`: Mover ±1 mm en el eje horizontal X (o ±10 mm con `Shift`).
   - `↑` / `↓`: Mover ±1 mm en profundidad Z (o ±10 mm con `Shift`).
   - `Shift + ↑` / `Shift + ↓` (o teclas `W`/`S` / `PageUp`/`PageDown`): Mover ±1 mm en elevación vertical Y.
   - Cada movimiento genera un registro reversible con `Ctrl+Z` (Deshacer).

3. **HUD Flotante en el Canvas 3D**:
   - Situado de forma limpia en el visor (`bg-zinc-950/80 backdrop-blur-md border border-zinc-800 rounded-xl`).
   - Selector de paso rápido: `[1 mm]` y `[10 mm]`.
   - Botonera direccional: `X: ◄ ►`, `Y: ▲ ▼`, `Z: ◄ ►` con valores de coordenadas en milímetros actualizados en tiempo real.

---

## 3. Key Product Decisions & Trade-Offs

- **Umbral Magnético de 12 mm con Prioridad de Contacto**:
  - *Enfoque*: Calcular distancias entre cajas envolventes (AABB) de la pieza activa contra todas las piezas estáticas. Si la distancia entre caras coplanares o adyacentes es menor a 12 mm, forzar la posición a la cara exacta. Si la distancia es mayor, aplicar el snap de 1 mm.
  - *Razón*: Resuelve definitivamente el problema mostrado en la captura del usuario, donde un snap de 5 mm saltaba entre una holgura visible y una superposición indeseada.
- **Teclas Activas solo con Pieza Seleccionada y Foco Fuera de Formularios**:
  - *Enfoque*: El escuchador de teclado solo actúa cuando hay una pieza seleccionada y el usuario no está editando un campo de texto `<input>`.
  - *Razón*: Garantiza que escribir nombres o notas no mueva accidentalmente el mueble 3D.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                   3D Viewport (furniture-3d-viewer)                    │
│   - Raycaster & Dragging Gizmo                                         │
│   - Magnetic Face-Snapping Engine (12mm threshold -> exact 0mm face)   │
│   - Step resolution: 1mm (configurable 1mm / 5mm / 10mm)               │
│   - Keyboard Event Handler (Arrow keys, Shift, PageUp/Down)            │
│   - Floating Micro-Nudge HUD (X, Y, Z stepping buttons)                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   ModuleDesigner / ProjectStorageService               │
│   - updatePartLive(updates) -> actualiza la pieza en tiempo real       │
│   - pushSnapshot() -> registra en historial para Deshacer (Ctrl+Z)     │
└────────────────────────────────────────────────────────────────────────┘
```

### Componentes y Archivos Clave a Modificar

1. **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`**:
   - Algoritmo de cálculo de caras (minX, maxX, minY, maxY, minZ, maxZ) de todas las piezas estáticas.
   - Función `applyMagneticSnap(proposedPos, proposedSize, orient)` para alinear automáticamente las caras a 0 mm de holgura.
   - Ajuste de resolución de arrastre de `snap = 5` a `snap = 1` mm.
   - Método `nudgePart(axis: 'x' | 'y' | 'z', delta: number)` con llamada a `dragStarted` y `partModified`.
   - Manejador de teclado para flechas y teclas de elevación.
   - Señal `nudgeStep = signal<number>(1)` (opciones 1mm y 10mm).

2. **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.html`**:
   - Incorporar el HUD flotante de micro-ajuste en la esquina inferior del visor 3D, visible cuando hay una pieza seleccionada.
