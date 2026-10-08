# Plan de Implementación: Sistema Modular de Cajones y Agrupación de Piezas

Implementaremos un sistema integral y modular para crear, agrupar, desagrupar, animar y gestionar cajones dentro de muebles en el módulo de diseño 3D y lista de despiece.

---

## 1. Modelo de Datos y Arquitectura de Grupos (`PartGroup`)

### 1.1 Extensión de Interfaces en `src/app/models/melamine.models.ts`
- Agregar la interfaz `PartGroup`:
  ```typescript
  export interface PartGroup {
    id: string;
    name: string; // ej. "Cajón 1", "Cajón Inferior"
    type: 'drawer' | 'door_set' | 'assembly' | 'custom';
    isOpen?: boolean; // Estado abierto/cerrado
    slideExtension?: number; // 0 (cerrado) a 1 (100% abierto)
    slideLength?: number; // Largo de corredera en mm (ej. 400, 450, 500)
    slideType?: SlideType; // Telescópica estándar, cierre suave, etc.
    frontGap?: number; // Holgura lateral para correderas (típico 13mm por lado = 26mm total)
  }
  ```
- Extender `Part`:
  - `groupId?: string;`
  - `groupName?: string;`

---

## 2. Agrupación y Desagrupación Libre

### 2.1 En `src/app/components/module-designer/module-designer.ts`
- **Agrupar Selección (`groupSelectedParts(name?: string)`)**:
  - Al tener 2 o más piezas seleccionadas (usando selección múltiple en 3D o en lista), habilitar botón **"🔗 Agrupar como Cajón / Módulo"**.
  - Permite ingresar un nombre (por defecto "Cajón 1", "Cajón 2", etc.).
  - Asigna el nuevo `groupId` a todas las piezas seleccionadas.
- **Desagrupar (`ungroup(groupId: string)`)**:
  - Libera todas las piezas del grupo manteniendo intactas sus posiciones 3D, dimensiones y materiales.
  - Elimina el registro del grupo sin afectar las piezas.
- **Mover Grupo Completo**:
  - Permite trasladar el grupo completo en los ejes X, Y, Z de forma sincronizada.

---

## 3. Asistente Rápido de Cajón Paramétrico

### 3.1 Creador Modular de Cajones
- Botón en la barra de herramientas del diseñador: **"+ Crear Cajón Modular"**.
- Modal / Asistente rápido con parámetros estándar de carpintería:
  - **Ancho exterior del cajón o hueco (mm)** (con cálculo de holgura automática para correderas telescópicas: 26 mm).
  - **Profundidad de corredera (mm)** (ej. 350, 400, 450, 500 mm).
  - **Altura de caja (mm)** (ej. 120, 150, 180 mm).
  - **Frente exterior / Tapa de cajón (opcional)** (alto y ancho del frente solapado con tirador a elección).
  - **Espesor de laterales y trasera** (por defecto 15 mm).
  - **Espesor de fondo** (por defecto 3 mm MDF ranurado o embutido).
- **Generación en 1 Clic**:
  - Genera automáticamente las piezas exactas ensambladas:
    1. *Lateral Izquierdo* (15 mm)
    2. *Lateral Derecho* (15 mm)
    3. *Contra-frente Interior* (15 mm)
    4. *Trasera de Cajón* (15 mm)
    5. *Fondo Trasero / Piso de Cajón* (3 mm MDF)
    6. *Frente de Cajón con Tirador* (opcional, 15 mm)
  - Las agrupa inmediatamente bajo `PartGroup` con rol `drawer`, listo para ubicar dentro de cualquier hueco del mueble.

---

## 4. Animación Interactiva y Deslizamiento 3D

### 4.1 En `src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`
- **Apertura y Cierre con Clic Directo**:
  - Al hacer clic en cualquier pieza perteneciente a un grupo de tipo `drawer`, activa la animación suave de deslizamiento frontal (+Z) de todas las piezas del grupo.
- **Interpolación y Desplazamiento**:
  - Las piezas del grupo se desplazan a lo largo del eje Z según el factor `slideExtension` y el largo de la corredera (ej. 350 a 450 mm).
- **Control Deslizante en Panel**:
  - Slider 0% a 100% y botón "Abrir / Cerrar Cajón" para previsualizar en cualquier ángulo o posición fija.

---

## 5. Organización Visual en Lista de Despiece

### 5.1 En `src/app/components/module-designer/module-designer.html`
- **Secciones Desplegables (Accordion) por Grupo**:
  - Cada grupo/cajón aparece en un bloque colapsable/desplegable con:
    - Nombre del cajón editable.
    - Indicador de cantidad de piezas y estado (Abierto / Cerrado).
    - Slider de extensión y botón de apertura interactiva.
    - Botón de **"Desagrupar"** y botón de **"Eliminar Cajón"**.
  - Lista de piezas anidadas pertenecientes al cajón.
- **Sección de Piezas Libres / Sin Grupo**:
  - Muestra las demás piezas del mueble (laterales, repisas, techo, zócalo) que no pertenecen a ningún grupo.
- **Transparencia en Optimización y Corte**:
  - El optimizador de corte recibe todas las piezas individuales con su etiqueta del grupo para facilitar el etiquetado y armado en taller.

---

## 6. Verificación y Pruebas
1. Verificar que compila sin errores (`compile_applet`).
2. Probar la creación de un cajón con el asistente paramétrico en 15 mm (fondo 3 mm MDF).
3. Probar seleccionar piezas sueltas y agruparlas manualmente en un nuevo grupo "Cajón".
4. Probar hacer clic en 3D para animar la apertura y cierre del cajón.
5. Probar el deslizador de apertura y desagrupar el cajón para volver a editar piezas individuales.
6. Verificar que el optimizador de corte procese todas las piezas correctamente.
