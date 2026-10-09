# Control Integral de Cajones: Rotación Rígida 360°, Duplicación Apilada, Menú de Grupos y Herrajes Selectivos

Plan de arquitectura y desarrollo para perfeccionar el comportamiento cinemático y la manipulación de cajones modulares en el espacio 3D, incorporando duplicación ágil, rotación sólida en las 4 direcciones ortogonales, selector desplegable de grupos guardados y gestión granular de herrajes 3D por cajón.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> A continuación se resumen las decisiones confirmadas para esta iteración y los comportamientos validados con las respuestas del usuario:

- **Rotación Rígida de Cajones y Grupos en 3D (Confirmado)**:
  - Todo el ensamble del cajón (frente, laterales, contrafrente, fondo y tirador) girará como un sólido rígido indivisible alrededor de su centroide geométrico en X y Z.
  - Se ofrecen dos vías de control fluidas:
    1. **Botones en cinta superior flotante**: Giro de 90° horario / antihorario y selector rápido de orientación cardinal (Frente a 0°, Derecha a 90°, Fondo a 180°, Izquierda a 270°).
    2. **Atajo de teclado 'R'**: Al tener un cajón o grupo seleccionado, pulsar la tecla `R` girará el bloque completo 90° de manera instantánea.
  - Se corrige el cálculo de dimensiones tridimensionales para evitar que las piezas se deformen o el frente se coloque en posición vertical alargada al girar.
  - La dirección de apertura/animación 3D se actualizará dinámicamente según el frente actual (desliza en +Z, +X, -Z o -X).

- **Duplicación de Cajones y Módulos Apilados (Confirmado)**:
  - Nuevo botón **"Duplicar Cajón"** (`content_copy`) en la barra flotante de grupo y en el menú de grupos guardados.
  - Clona instantáneamente todas las piezas que conforman el cajón con sus propiedades, espesores y texturas.
  - Genera un nuevo `groupId` y nombre correlativo (ej. "Cajón 2", "Cajón 3").
  - Ubica el nuevo cajón **apilado verticalmente encima del cajón original** (desplazamiento en eje Y igual a la altura de la pieza frontal + holgura milimétrica de ensamble).
  - Selecciona automáticamente el cajón duplicado para moverlo o ajustarlo de inmediato.

- **Menú Desplegable de Cajones y Grupos Guardados (Confirmado)**:
  - Al pulsar el botón/ícono de grupos en la barra de herramientas 3D (que exhibe el contador), se abrirá un menú desplegable contextual (popover dropdown).
  - Listará claramente cada grupo guardado (ej. "Cajón 1", "Cajón 2", "Módulo Superior") con su conteo de piezas.
  - Al hacer clic en cualquier elemento de la lista, se seleccionará automáticamente todo el grupo en la escena 3D y se enfocarán sus controles.
  - Incluye acceso directo a duplicar, abrir/cerrar y desagrupar cada cajón desde la misma lista.

- **Herrajes 3D Selectivos por Cajón (Confirmado)**:
  - El botón de herrajes 3D ya no alterará indiscriminadamente todos los cajones del proyecto.
  - **Estado Desactivado**: Si el usuario no tiene seleccionado ningún cajón o puerta con herrajes, el botón se mostrará inactivo/deshabilitado con mensaje informativo ("Selecciona un cajón para gestionar sus herrajes").
  - **Control Específico**: Si hay un cajón o módulo seleccionado, el botón reflejará y alternará la visibilidad de los herrajes (correderas telescópicas y manijas/tiradores) **únicamente para ese cajón seleccionado**.

---

## 1. Overview & Core Concept

- **Qué hace**: Otorga control profesional de ensamble y disposición modular tridimensional para carpinteros y diseñadores de mobiliario, permitiendo multiplicar cajoneras en segundos, rotar bloques completos a cualquier frente sin desarmar piezas, localizarlos fácilmente desde un menú desplegable y aislar visualmente sus herrajes técnicos.
- **Público objetivo**: Diseñadores de muebles a medida, carpinteros y fabricantes de melamina que requieren diseñar cajoneras de múltiples módulos sin rehacer cada cajón desde cero.
- **Valor diferencial**: Rigidez geométrica 100% garantizada en Three.js sin desalineación de placas, duplicación vertical con 1 clic y flujo de trabajo ergonómico mediante teclado y cintas flotantes.

---

## 2. User Experience & Visual Design

### Flujo de Usuario: Rotación 360° y Atajo 'R'
1. El usuario selecciona cualquier pieza de un cajón; todo el grupo se activa con contorno técnico azul.
2. En la cinta superior flotante o pulsando la tecla `R`, el cajón gira 90° manteniendo todas sus piezas en perfecta cohesión milimétrica.
3. El usuario puede elegir directamente en qué dirección queda la cara del cajón (Frente, Lateral Derecho, Fondo o Lateral Izquierdo).
4. Al pulsar "Abrir / Cerrar", el cajón se desliza suavemente en la dirección real hacia donde quedó apuntando su frente.

### Flujo de Usuario: Duplicación de Cajones
1. Con un cajón seleccionado, el usuario hace clic en el nuevo botón **"Duplicar"** en la cinta superior (o en la lista desplegable).
2. Se crea al instante una copia exacta ubicada justo encima de la cajonera actual (+Y).
3. El nuevo cajón queda seleccionado con su manipulador activo, listo para reposicionarse en el mueble.

### Flujo de Usuario: Menú Desplegable de Grupos
1. El usuario hace clic en el ícono de cajones guardados (botón con el contador numérico).
2. Se despliega una lista clara y accesible con todos los cajones existentes ("Cajón 1", "Cajón 2", etc.).
3. Al seleccionar cualquiera de ellos, la cámara y el visor 3D lo resaltan como grupo activo de forma inmediata.

### Flujo de Usuario: Control de Herrajes Selectivo
1. Con "Cajón 1" seleccionado, el botón de herrajes está activo. El usuario lo desmarca: solo las correderas y tiradores del "Cajón 1" se ocultan, mientras los del "Cajón 2" permanecen visibles.
2. Si deselecciona las piezas (clic en el vacío), el botón pasa a estado inactivo.

---

## 3. Key Product Decisions & Trade-Offs

- **Rotación por transformación de matriz espacial vs. rotación de propiedades locales**:
  - *Decisión*: Calcular matemáticamente la rotación rígida en el centroide del grupo, transformando la terna de coordenadas `(posX, posY, posZ)` y permutando las dimensiones ortogonales del paralelepípedo (`length` vs `width` vs `thickness`) para que tanto la vista de despiece/corte 2D como el renderizado Three.js coincidan exactamente sin crear piezas anómalas.
  - *Alternativa descartada*: Rotar solo los meshes visuales en Three.js sin actualizar las coordenadas de las piezas en el proyecto dejaría el optimizador de corte y la exportación de medidas desfasados.
- **Almacenamiento de estado de herrajes por grupo**:
  - *Decisión*: Registrar la preferencia de visualización de herrajes en la configuración del grupo o mediante un set reactivo de grupos con herrajes ocultos en el visor 3D, garantizando que el usuario tenga control quirúrgico cajón por cajón.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MODULE DESIGNER                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ TOP RIBBON: [Abrir/Cerrar] [Girar 90° ↻/↺] [Orientación] [Duplicar]   │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │ Acciones sobre grupo                  │
│                                     ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                       PROJECT STORAGE SERVICE                         │  │
│  │  - duplicateGroup(groupId, offsetDirection: 'up')                     │  │
│  │  - rotateGroupRigidly(groupId, angleDelta: 90 | -90 | 180)           │  │
│  │  - moveGroup(groupId, deltaX, deltaY, deltaZ)                         │  │
│  │  - groupsList & activePartGroups: sincronizado sin huérfanos          │  │
│  └──────────────────────────────────┬────────────────────────────────────┘  │
│                                     │ Sincronización reactiva               │
│                                     ▼                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                       FURNITURE 3D VIEWER                             │  │
│  │  - Atajo de teclado: Tecla 'R' (gira grupo seleccionado en pasos 90°) │  │
│  │  - Dropdown Desplegable: Cajones y Grupos guardados                   │  │
│  │  - Herrajes 3D: Selectivo por cajón (hiddenHardwareGroups set)        │  │
│  │  - Animación de apertura: Desplazamiento según vector normal de frente│  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Componentes y Métodos Clave a Implementar

1. **`project-storage.service.ts`**:
   - `duplicateGroup(groupId: string)`: Localiza todas las piezas del grupo, clona sus registros con IDs únicos, calcula la cota superior en Y del grupo y suma `(altoCajon + 10mm)` al nuevo bloque, asignando un nuevo nombre secuencial y devolviendo el nuevo ID para selección automática.
   - `rotateGroupRigidly(groupId: string, angleDelta: 90 | -90 | 180)`: Rota las posiciones de los centros de masa respecto al centroide de ensamble y reorienta las orientaciones espaciales (`vertical_xy`, `vertical_yz`, `horizontal`) ajustando `posX`, `posZ` y orientaciones sin estirar ni deformar caras.

2. **`furniture-3d-viewer.ts` & `furniture-3d-viewer.html`**:
   - Atajo de teclado en `window:keydown`: Detectar tecla `'r'` / `'R'`. Si hay un grupo seleccionado, ejecutar `rotateSelectedGroup(90)`.
   - Botón de Herrajes 3D:
     - Enlazado a `selectedGroupHardwareVisible()` con disabled si `!currentSelectedGroupId && !hasSelectedHardwarePart()`.
     - `toggleSelectedGroupHardware()`: Oculta o muestra correderas y tiradores únicamente para el grupo seleccionado.
   - Botón/Icono de Cajones y Grupos Guardados:
     - Popover desplegable flotante con lista interactiva de grupos existentes, selección directa en 1 clic y botón para duplicar.
   - Vector de apertura para animación 3D:
     - Determina la normal del frente (`+Z`, `+X`, `-Z`, `-X`) para que al pulsar abrir/cerrar el cajón se deslice siempre hacia afuera de su cuerpo.

3. **`module-designer.ts` & `module-designer.html`**:
   - Cinta flotante superior enriquecida con botón "Duplicar" (`content_copy`), botones de giro horario y antihorario, e indicador del frente activo.
