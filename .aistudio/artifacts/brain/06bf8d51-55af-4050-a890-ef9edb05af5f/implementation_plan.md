# Retiro Limpio de los Botones de Cámara y Despiece Explosionado 3D

Retiro seguro y sin efectos colaterales de los botones de **Vistas de Cámara** (`videocam`) y **Despiece Explosionado** (`burst_mode`) de la barra de herramientas vertical del visor 3D para dejar la interfaz despejada, limpia y enfocada, preservando el 100% de las funciones actuales de ensamble, cotas y animación de cajones.

---

### Decisiones Críticas y Revisión del Usuario

> [!IMPORTANT]
> - **Confirmado por el usuario**: Retirar tanto el botón de vistas de cámara como el botón de despiece explosionado 3D para dejar la barra de herramientas limpia.
> - **Garantía de no regresión**: El visor 3D continuará permitiendo orbitar, rotar, hacer zoom y reencuadrar con el botón de centrado de cámara (`filter_center_focus`), mientras que las piezas permanecerán en ensamble físico milimétrico real sin alterar ningún cálculo de despiece ni animación.

---

### 1. Visión General y Concepto Central

- **Qué hace**: Elimina dos controles en desuso de la barra de herramientas vertical izquierda del visor 3D (`furniture-3d-viewer`). Esto reduce la carga cognitiva y evita confusiones para el usuario, enfocando la barra en las herramientas esenciales de diseño y comprobación técnica (ensamble, cotas 3D, mecanizados CNC, herrajes y animación de apertura).
- **Audiencia / Beneficio**: Diseñadores y fabricantes de muebles de melamina que requieren un espacio de trabajo 3D claro, profesional y libre de botones redundantes o inoperativos.

---

### 2. Experiencia de Usuario y Diseño Visual

- **Flujo de Usuario**:
  - Al ingresar al visor 3D o al diseñador de módulos, la barra flotante vertical izquierda se presenta más compacta y estilizada.
  - La navegación 3D se realiza de forma natural y fluida:
    - Clic izquierdo + arrastrar: Orbitar libremente alrededor del mueble.
    - Clic derecho + arrastrar: Desplazamiento panorámico (pan).
    - Rueda del ratón: Zoom milimétrico.
    - Botón de centrado (`filter_center_focus` / tecla Z): Reencuadra el mueble completo en perspectiva isométrica óptima.
  - La apertura y cierre de cajones se sigue accionando directamente desde el botón de animación (`door_sliding` / `meeting_room`) o haciendo clic directo en el cajón en 3D o en la cinta superior flotante.
- **Jerarquía y Estilo Visual**:
  - Se mantienen los mismos tokens de diseño (esquinas redondeadas `rounded-xl`, estados hover sutiles `bg-slate-100`, indicadores activos con acentos de color indigo/sky).
  - Los separadores visuales se ajustan para que las herramientas queden agrupadas coherentemente por familias funcionales (Modelado/Medición → Inspección técnica → Simulación interactiva → Sistema).

---

### 3. Decisiones de Producto y Compensaciones

- **Decisión 1: Retiro de Vistas de Cámara fijas (`videocam`)**
  - *Enfoque*: Quitar el botón y su popover de la barra vertical.
  - *Por qué*: El usuario ya orbita libremente en cualquier ángulo en el espacio tridimensional y cuenta con el botón de centrado y reseteo (`resetCamera`) para volver a la perspectiva general.
  - *Alternativa descartada*: Conservar vistas ortogonales fijas en la barra; descartada porque el usuario confirmó que prefiere una barra limpia y libre de menús innecesarios.

- **Decisión 2: Retiro del Despiece Explosionado (`burst_mode`)**
  - *Enfoque*: Quitar el botón y su deslizador de separación porcentual.
  - *Por qué*: La separación artificial de piezas entraba en conflicto con los nuevos grupos de cajones ensamblados y no aportaba valor en la fabricación real del mueble.
  - *Seguridad*: Al mantenerse `explodedPercent = 0`, el mueble siempre se visualiza en su ensamble exacto de fabricación.

---

### 4. Arquitectura Técnica y Estrategia de Datos

```
┌────────────────────────────────────────────────────────┐
│             Furniture3DViewer (Toolbar)                │
├────────────────────────────────────────────────────────┤
│  [1] Seleccionar / Mover / Empujar-Tirar / Rotar 90°   │
│  [2] Rectángulo 3D / Cinta Métrica                     │
│  ─────────────────────────────── (Separador)           │
│  [3] Mecanizados CNC / Cotas 3D / Luz Libre / Rayos X  │
│  [4] Herrajes 3D (Tiradores, Bisagras, Correderas)     │
│  ─────────────────────────────── (Separador)           │
│  [5] Abrir / Cerrar Puertas y Cajones (Animación 3D)   │
│  [6] Cajones y Grupos Guardados                        │
│  ─────────────────────────────── (Separador)           │
│  [7] Modo Claro/Oscuro CAD                             │
│  [8] Centrar y Reiniciar Cámara (filter_center_focus)  │
└────────────────────────────────────────────────────────┘
```

- **Mapeo de Componentes y Estado**:
  - En `furniture-3d-viewer.html`:
    - Se remueve el bloque de popover `toggleViewsDropdown()` y sus botones asociados (líneas 76–105).
    - Se remueve el bloque de flyout `toggleExplodedSlider()` y su slider de porcentaje (líneas 183–213).
  - En `furniture-3d-viewer.ts`:
    - Se preservan las funciones de control de escena y cámara (`resetCamera()`, `setViewPreset()`) de modo que ningún enlace interno o llamada existente genere advertencias o roturas.
  - Validación con `compile_applet` y `lint_applet` para garantizar cero errores de TypeScript y compilación perfecta.
