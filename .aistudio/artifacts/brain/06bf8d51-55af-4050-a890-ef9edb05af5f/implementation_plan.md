# Rotación Libre en 3D y Ajuste de Orientación para Piezas Circulares y Cilíndricas

Habilitar la rotación completa en 3D (ejes X, Y, Z) para piezas circulares y cilindros en el lienzo 3D de **Piezo3D Studio**, permitiendo acostar, inclinar y orientar los tubos/columnas en cualquier dirección del espacio, ajustar su longitud y diámetro sobre su propio eje, y reflejar sus ángulos de inclinación en el despiece y la ficha técnica 2D.

## Decisiones Confirmadas por el Usuario

> [!IMPORTANT]
> A continuación se resumen las decisiones de diseño y producto confirmadas en la fase de consulta interactiva:

- **Controles de Rotación 3D en Propiedades**: Se incorporan deslizadores/entradas numéricas para los ángulos $R_x, R_y, R_z$ ($0^\circ$ a $360^\circ$) más botones de acción rápida de giro a $90^\circ$ (Acostar X, Acostar Z, Parar Y, Invertir).
- **Dimensionamiento sobre Eje Local (Extrusión/Longitud)**: Al estirar o editar una pieza cilíndrica inclinada o acostada, la propiedad "Longitud" se aplica a lo largo de su eje longitudinal transformado, manteniendo su diámetro intacto.
- **Detalle de Despiece y Ficha Técnica 2D**: Las piezas circulares/cilíndricas rotadas se listan con su diámetro ($\varnothing$), longitud total y notas con los ángulos de orientación $(R_x, R_y, R_z)$ para facilitar el armado e instalación en taller.

---

## 1. Visión General y Concepto Principal

### Qué Hace
Permite a los diseñadores y carpinteros colocar cilindros o piezas circulares en cualquier orientación espacial:
1. **Modelado de Estructuras Tubulares y Patas Inclinadas**: Diseño de patas cónicas/cilíndricas inclinadas para mesas, barras transversales, soportes cilíndricos horizontales y elementos de carpintería metálica o melamínica.
2. **Giro Interactivo y Atajos de 90°**: Botones de un solo clic en la bandeja lateral de propiedades para acostar la pieza sobre el piso (horizontal en X o Z) o pararla verticalmente.
3. **Cálculo de Despiece Preciso**: Mantiene la identidad geométrica del cilindro (Diámetro $\times$ Longitud) en la optimización de cortes y fichas técnicas 2D con indicación de ángulos.

### Usuario Objetivo
Diseñadores de muebles modulares, arquitectos de interiores y fabricantes que requieren proyectar estructuras con soportes circulares u horizontales sin estar limitados a extrusiones únicamente verticales.

---

## 2. Experiencia de Usuario y Diseño Visual

### Flujos de Usuario Principales

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Selección de Pieza Circular / Cilíndrica en Canvas 3D                   │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. Panel Lateral de Propiedades: Sección "Orientación y Rotación 3D"       │
│    - Sliders y Inputs: Rx (°), Ry (°), Rz (°)                              │
│    - Botones Rápidos 90°: [Acostar X]  [Acostar Z]  [Parar Y]  [Girar 90°]   │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. Renderizado y Manipulación Directa en Three.js                           │
│    - Matriz de transformación con rotación Euler / Quat aplicada            │
│    - Gizmo de redimensionado alineado al eje local de la pieza             │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. Actualización Automática de Tabla de Despiece y Ficha Técnica 2D        │
│    - Muestra Ø Diámetro, Longitud de tubo y Ángulo de armado (ej: Rx: 90°)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Identidad Visual y Controles en Bandeja

- **Sección Dedicada de Rotación 3D**:
  - Encabezado claro con icono `<mat-icon>3d_rotation</mat-icon>` y título **Orientación y Ángulos 3D**.
  - Tres entradas numéricas de precisión ($R_x, R_y, R_z$) con pasito de $1^\circ$ o $15^\circ$.
  - Fila de botones de atajo con estilo `bg-slate-100 hover:bg-sky-50 text-slate-700` y bordes limpios:
    - `Acostar X (90°, 0°, 0°)`
    - `Acostar Z (0°, 0°, 90°)`
    - `Parar Vertical (0°, 0°, 0°)`
    - `Girar +90° Y`
- **Controles de Tamaño de Cilindro**:
  - Campos de entrada para **Diámetro ($\varnothing$)** (mm) y **Longitud (Eje Principal)** (mm).

---

## 3. Decisiones de Producto y Complejidad Técnica

### Decisión 1: Representación Geométrica en Three.js (`CylinderGeometry`)
- **Enfoque Elegido**: Aplicar la rotación de la pieza mediante un contenedor `THREE.Group` o matriz Euler $(R_x, R_y, R_z)$ en `PieceMeshData`, asegurando que los vértices del cilindro se alineen con el centro de masa local.
- **Por qué**: Permite que las operaciones de estirado ("Longitud") modifiquen la altura interna del `CylinderGeometry` sin distorsionar la forma circular del diámetro ni deformar la malla.

### Decisión 2: Compatibilidad con el Motor de Despiece y Exportación DXF
- **Enfoque Elegido**: Mantener en la interfaz `Part` los atributos `rotX`, `rotY`, `rotZ`. Para el optimizador de tablero, las piezas cilíndricas/barras se contabilizan como elementos lineales o tableros redondos según corresponda, incluyendo sus notas de armado en el reporte en PDF/DXF.

---

## 4. Arquitectura Técnica y Estrategia de Datos

### Diagrama de Arquitectura y Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Estado del Proyecto                               │
│                   (ProjectStorageService / Part Signal)                     │
│  Part { id, shapeType: 'circle', diameter, length, rotX, rotY, rotZ }       │
└──────────────────────┬──────────────────────────────┬───────────────────────┘
                       │                              │
                       ▼                              ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│  Furniture3dViewerComponent  │              │    ModuleDesignerComponent   │
│       (Vista Canvas 3D)      │              │      (Panel Propiedades)     │
│                              │              │                              │
│  - Crea CylinderGeometry     │              │  - Inputs Rx, Ry, Rz         │
│  - Aplica Group.rotation     │  ◄─────────► │  - Botones Rápidos 90°       │
│    (rotX, rotY, rotZ)        │  emite event │  - Controles Ø y Longitud    │
│  - Muestra Bounding Box      │              │                              │
└──────────────────────────────┘              └──────────────────────────────┘
                       │                              │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
                       ┌──────────────────────────────┐
                       │   Ficha Técnica 2D & DXF     │
                       │                              │
                       │ - Tabla: Ø mm x Longitud mm  │
                       │ - Notas: "Orientación Rx:90°"│
                       └──────────────────────────────┘
```

### Cambios en Modelos y Servicios

1. **`src/app/models/melamine.models.ts`**:
   - Agregar campos opcionales `rotX?: number; rotY?: number; rotZ?: number;` al tipo `Part`.
2. **`src/app/components/module-designer/module-designer.html` & `.ts`**:
   - Añadir el bloque UI de controles de rotación 3D e inclinación rápida cuando la pieza seleccionada tiene `shapeType === 'circle'`.
   - Conectar los eventos `(input)` y `(click)` a la actualización del signal de la pieza en `ProjectStorageService`.
3. **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`**:
   - Al construir la malla 3D de piezas circulares/cilíndricas, establecer `mesh.rotation.set(THREE.MathUtils.degToRad(part.rotX || 0), THREE.MathUtils.degToRad(part.rotY || 0), THREE.MathUtils.degToRad(part.rotZ || 0))`.
4. **`src/app/components/technical-sheet-modal/technical-sheet-modal.html` & `parts-list.html`**:
   - Reflejar las propiedades de diámetro y ángulos de rotación en la tabla de piezas y plano técnico.

---

## Plan de Verificación

1. **Compilación**: Ejecutar `compile_applet` para asegurar que las definiciones de tipo y componentes Angular compilen limpiamente.
2. **Prueba Funcional en Canvas 3D**:
   - Crear un cilindro o pieza circular.
   - Usar los botones de rotación rápida (Acostar X, Acostar Z, Parar Y) y verificar que el cilindro se acueste horizontalmente sobre el plano o gire a cualquier ángulo $X, Y, Z$.
   - Ajustar la longitud y el diámetro mientras el cilindro está inclinado, verificando que la geometría se estire sobre su propio eje.
   - Confirmar que la ficha técnica 2D y lista de partes muestren los datos correctos sin errores de formato.
