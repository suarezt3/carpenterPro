# Plan de Implementación: Herramienta Circular y Dibujo Libre a Mano Alzada

Este plan detalla la arquitectura y adición de las dos nuevas herramientas de modelado CAD solicitadas para el visor 3D de despiece y carpintería:
1. **Herramienta Circular (Piezas Redondas / Tapas Cilíndricas)**
2. **Herramienta de Dibujo Libre (Trazado Continuo Suavizado / Polígono Cerrado)**

---

## 1. Decisiones Técnicas y Especificaciones del Usuario

Basado en las respuestas del usuario:
- **Plano de trabajo**: Superficie plana horizontal (suelo o cara superior de mueble, plano XZ en elevación Y) con extrusión de espesor paramétrico configurable (por defecto 15/18 mm).
- **Herramienta Circular**: Arrastrar desde el centro hacia afuera hasta el radio deseado con cotas en vivo (Radio $R$ y Diámetro $\varnothing$ en mm).
- **Herramienta de Dibujo Libre**: Trazado continuo interactivo a mano alzada que, al soltar el ratón o acercarse al punto inicial, se cierra automáticamente y suaviza los puntos generando un polígono 2D extruido (`THREE.ExtrudeGeometry` / `Shape`).
- **Integración completa en el flujo**: Las piezas creadas se integran en el listado de despiece de piezas (`Part`), cálculo de material, dimensiones de corte envolvente ($L \times W$), color/textura de melamina y compatibilidad con las herramientas CAD existentes (mover, empujar/tirar, girar).

---

## 2. Modificaciones Propuestas

### A. Modelo de Datos (`src/app/models/melamine.models.ts`)
- Extender el tipo `Part` para soportar geometrías especiales:
  - `shapeType?: 'rectangular' | 'circular' | 'freehand'`
  - `circleRadius?: number` (radio en mm)
  - `polygonPoints?: { x: number; z: number }[]` (vértices 2D en plano horizontal relativos al centro de la pieza)
- Asegurar que `length` y `width` representen el bounding box para la lista de corte y optimizador (por ejemplo, para un círculo de radio $R$, `length = 2*R`, `width = 2*R`).

### B. Renderizado 3D en el Visor (`src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`)
- **Soporte de Geometrías en `buildFurnitureScene`**:
  - Si `part.shapeType === 'circular'`: Generar `THREE.CylinderGeometry(radius, radius, thickness, 48)` orientado en el plano horizontal, con sus bordes circulares técnicos correspondientes.
  - Si `part.shapeType === 'freehand'`: Generar `THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })` orientado horizontalmente con sus contornos técnicos.
  - Para piezas estándar: Mantener `THREE.BoxGeometry(sx, sy, sz)`.
- **Nuevas Herramientas en `activeTool`**:
  - `activeTool: 'select' | 'push_pull' | 'move' | 'measure' | 'rotate_90' | 'draw_rect' | 'draw_circle' | 'draw_freehand'`
  - **Herramienta Circular**:
    - PointerDown: Fijar centro `(x, y, z)`.
    - PointerMove: Calcular radio en tiempo real, mostrar previsualización de disco/cilindro cyan translúcido y cota HUD (`Radio: X mm • Diámetro: 2X mm`).
    - PointerUp: Si radio $\ge 30\text{ mm}$, emitir `partCreated` con `shapeType: 'circular'`, `circleRadius: R`, `length: 2R`, `width: 2R`.
  - **Herramienta de Dibujo Libre**:
    - PointerDown: Inicializar ruta de puntos sobre el plano horizontal.
    - PointerMove: Registrar puntos con distancia mínima de muestreo (15 mm), trazar línea continua amarilla/cyan con `LineSegments` en tiempo real.
    - PointerUp: Cerrar polígono automáticamente, simplificar/suavizar vértices redundantes, calcular centro y bounding box $L \times W$, y emitir `partCreated` con `shapeType: 'freehand'` y `polygonPoints`.
  - **Limpieza de Recursos**: Métodos de preview `circlePreviewGroup` y `freehandPreviewGroup`.
  - **Atajos de Teclado**: Tecla `C` para Círculo, Tecla `F` para Dibujo Libre.

### C. Plantilla e Interfaz Visual (`src/app/components/furniture-3d-viewer/furniture-3d-viewer.html`)
- Añadir botones en la paleta lateral CAD:
  - Botón de **Círculo 3D** (icono `radio_button_unchecked` o `circle`) con tooltip y estado activo.
  - Botón de **Dibujo Libre 3D** (icono `gesture` o `draw`) con tooltip y estado activo.
- Barra inferior de estado y HUD de cotas en vivo:
  - Mensajes de ayuda interactiva cuando esté activo el círculo o dibujo libre.
  - Visualización en la caja de medidas de:
    - Círculo: `Ø Diámetro mm (R Radio mm)`
    - Dibujo libre: `Perímetro mm • Vértices N`

### D. Panel de Propiedades e Inspector (`src/app/components/module-designer/module-designer.html` & `.ts`)
- En el inspector de pieza seleccionada:
  - Mostrar badge y propiedades según la forma (`Circular` o `Forma Libre`).
  - Para piezas circulares: permitir editar directamente el Diámetro / Radio con ajuste automático de dimensiones.
  - Mantener compatibilidad total con asignación de materiales, tapacantos y espesores de taller.

---

## 3. Plan de Verificación

1. **Compilación y Linters**:
   - Ejecutar `compile_applet` para garantizar compatibilidad estricta de TypeScript y Angular.
2. **Prueba de Herramienta Circular**:
   - Activar la herramienta Circular en la paleta CAD (o tecla `C`).
   - Hacer clic y arrastrar en el suelo o sobre una pieza existente.
   - Verificar la previsualización del disco con cota en vivo (Radio y Diámetro).
   - Soltar y confirmar la creación del cilindro/tapa en 3D con material y sombras.
3. **Prueba de Herramienta de Dibujo Libre**:
   - Activar la herramienta de Dibujo Libre (o tecla `F`).
   - Trazar una forma continua en el espacio 3D con el ratón.
   - Soltar el ratón y verificar el cierre automático del polígono, la extrusión 3D del espesor y el cálculo de medidas.
4. **Verificación de Herramientas Existentes**:
   - Probar mover, empujar/tirar, agrupar y compatibilidad con el resto del proyecto sin regresiones.
