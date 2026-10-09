# Corrección de Apertura de Cajones 3D, Cinta de Acciones para Piezas y Limpieza de Panel Lateral

Corrección del movimiento de apertura de cajones en 3D para que todo el ensamble (frente, laterales, trasera y fondo) se desplace unificado hacia el frente según la orientación actual, incorporación de la cinta de acciones flotante contextual superior para piezas individuales, y desduplicación del panel derecho de propiedades.

## User Review & Critical Decisions

> [!IMPORTANT]
> Decisiones confirmadas por el usuario en la fase de clarificación interactiva:
> - **Cinta de acciones para pieza individual**: Incluye Duplicar, Mover, Rotar 90°, Selector de orientación espacial (Horizontal, Vertical XY, Vertical YZ) y Eliminar pieza.
> - **Movimiento al abrir cajón**: Todas las piezas del cajón se desplazan juntas en bloque hacia el frente según la rotación actual del cajón en 3D, eliminando el despiece o separación entre componentes.
> - **Panel lateral derecho**: Se retira la sección redundante de orientación (dejándola exclusivamente en la barra flotante superior), optimizando el espacio vertical del panel.

---

## 1. Overview & Core Concept

- **Qué hace**:
  1. **Apertura de cajón unificada en 3D**: Al pulsar "Abrir" en la cinta o en el menú contextual, todas las piezas del cajón modular (frente, lateral izquierdo, lateral derecho, trasera/contrafrente y fondo MDF) se trasladan sincronizadamente a lo largo del vector normal frontal del cajón (eje Z o eje X según su ángulo de rotación 0°, 90°, 180°, 270°), manteniendo la integridad del ensamble y las correderas/tiradores.
  2. **Cinta superior unificada para piezas individuales**: Al seleccionar una sola pieza, aparece una cinta compacta, estilizada y homogénea en la parte superior del visor 3D que ofrece acciones inmediatas: badge informativo de dimensiones, botón Duplicar, Mover con gizmo, Rotar 90°, selector de orientación (Horizontal, Vertical XY, Vertical YZ), Eliminar pieza y botón Deseleccionar.
  3. **Limpieza del panel lateral derecho**: Se elimina el bloque duplicado de orientación del cajón/pieza en la bandeja de propiedades, reduciendo la sobrecarga cognitiva y dejando espacio limpio para dimensiones milimétricas, selección de melamina y coordenadas XYZ.
- **Audiencia**: Diseñadores de mobiliario, carpinteros y fabricantes que modelan cocinas, closets y muebles RTA en melamina.
- **Valor clave**: Flujo de trabajo CAD más ágil, sin saltos entre la barra superior y el panel lateral, y simulación de apertura 3D fidedigna sin desmembramiento de piezas.

---

## 2. User Experience & Visual Design

### Flujo de Interacción
1. **Selección de una pieza individual**:
   - El usuario hace clic en un lateral, zócalo o repisa en el visor 3D.
   - Emerge la cinta superior flotante (`bg-slate-900/95 text-white backdrop-blur-md rounded-2xl h-10 border border-white/10 shadow-xl`) con estilo uniforme y elegante.
   - La cinta muestra:
     - Badge con nombre y dimensiones en milímetros.
     - Botón **Duplicar** (`content_copy`).
     - Botón **Mover** (`open_with`).
     - Botón **Rotar 90°** (`rotate_right`).
     - Selector de **Orientación**: Horizontal (`horizontal`), Frontal/Trasera (`vertical_xy`), Lateral (`vertical_yz`).
     - Botón **Eliminar** (`delete` en tono rose sutil al hover).
     - Botón **Cerrar / Deseleccionar** (`close`).
2. **Selección de un grupo / cajón**:
   - Se mantiene la cinta de grupo con opciones de grupo: Duplicar, Mover, Abrir/Cerrar, Rotar 90°, Selector de frente (Frente, Der, Atrás, Izq), Desagrupar y Deseleccionar.
   - Al hacer clic en **Abrir**, todo el cajón se desliza suavemente 320 mm hacia el frente en una animación cinemática continua.
3. **Inspección en el panel lateral**:
   - El panel derecho ya no repite los botones de frente ni orientación, permitiendo visualizar fluidamente dimensiones, cantos y posición 3D sin scroll innecesario.

### Estilo Visual y Consistencia
- **Superficie y Contraste**: Acabado glassmorphism oscuro para barras flotantes sobre lienzo 3D (`bg-slate-900/95`, bordes `border-white/10`).
- **Botones y Tipografía**: Altura uniforme `h-7`, texto `text-xs font-semibold`, iconos `@angular/material/icon` de `text-sm`, radios `rounded-lg`.
- **Micro-interacciones**: Transiciones de 150ms con curvas suaves, estados activos en `bg-indigo-600` / `bg-sky-600` e indicadores visuales de orientación seleccionada.

---

## 3. Key Product Decisions & Trade-Offs

- **Cálculo de vector de apertura a nivel de grupo**:
  - *Enfoque*: Determinar el `facingDirection` del cajón completo una sola vez utilizando la posición del frente relativo al centroide del grupo, y propagar el mismo `slideAxis` y `slideDir` a cada una de las piezas del grupo.
  - *Por qué*: Anteriormente se evaluaba `getDrawerFacing` por pieza individual, lo que causaba que laterales y traseras se desplazaran hacia afuera en 4 direcciones distintas (efecto explosión).
  - *Alternativa descartada*: Animar sólo el frente y dejar las cajas estáticas (inaceptable para visualización de cajones ensamblados).
- **Cinta flotante unificada con renderizado condicional**:
  - *Enfoque*: Crear una estructura modular en la plantilla de `module-designer.html` que muestre la cinta cuando hay una selección activa (bien sea 1 pieza, múltiples piezas o un grupo), adaptando los controles relevantes sin redundancia.
  - *Por qué*: Mantiene el mismo código visual, altura y alineación, garantizando que el usuario tenga una experiencia coherente.
- **Desduplicación del panel lateral**:
  - *Enfoque*: Retirar la tarjeta de orientación espacial del panel derecho y centralizarla en la barra superior.
  - *Por qué*: Cumple directamente con el requerimiento del usuario de reducir el ruido visual y evitar repetir los mismos botones en dos lugares adyacentes.

---

## 4. Technical Architecture & Data Strategy

### Diagrama del Sistema y Flujo de Datos

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ModuleDesignerComponent                         │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Floating Action Ribbon (module-designer.html)                  │   │
│   │                                                                │   │
│   │ [Single Part Selected]            [Group / Multi-Part Selected]│   │
│   │  ├─ Name & Dims Badge              ├─ Group Name & Count Badge │   │
│   │  ├─ Duplicar                      ├─ Duplicar Grupo           │   │
│   │  ├─ Mover (Gizmo)                 ├─ Mover Bloque             │   │
│   │  ├─ Rotar 90°                     ├─ Abrir / Cerrar 3D        │   │
│   │  ├─ Orientación (H / Vxy / Vyz)   ├─ Rotar 90° (+/- 90°)      │   │
│   │  ├─ Eliminar                      ├─ Frente (0°/90°/180°/270°)│   │
│   │  └─ Deseleccionar                 ├─ Desagrupar               │   │
│   │                                   └─ Deseleccionar            │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                   │                                    │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                 Furniture3dViewerComponent                     │   │
│   │                                                                │   │
│   │  • calculateGroupFacing(groupId, parts)                        │   │
│   │  • buildScene() -> Assigns uniform slideAxis & slideDir        │   │
│   │  • updateOpeningAnimations() -> Smooth translation in unison   │   │
│   │  • Hardware (slides, handles) rotate in sync with group facing │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                   │                                    │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                      ProjectStorageService                     │   │
│   │                                                                │   │
│   │  • rotateGroupRigidly() -> Updates 3D coords & orientations    │   │
│   │  • getGroupFacingDirection() -> Consistent 0°, 90°, 180°, 270° │   │
│   │  • updatePart() / duplicatePart() / deletePart()               │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Componentes y Archivos Clave a Modificar

1. **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`**:
   - Ajustar el cálculo de `slideAxis` y `slideDir` en `buildPieces` para que todas las piezas pertenecientes a un mismo cajón / `groupId` adopten de forma unificada la orientación del frente del cajón.
   - Sincronizar el desplazamiento de apertura en `updateOpeningAnimations()` para que aplique el mismo delta a todas las piezas del grupo.
   - Garantizar que los rieles y correderas (`createDrawerSlidesMesh`) y tiradores (`createHandleMesh`) se construyan con la rotación exacta del ensamble.

2. **`src/app/components/module-designer/module-designer.html`**:
   - Ampliar la barra flotante superior para renderizar la cinta cuando hay una sola pieza seleccionada (`selectedPartId() && !isAnyGroupSelected() && selectedPartIds().length <= 1`), con los botones solicitados (Duplicar, Mover, Rotar 90°, Orientación H/Vxy/Vyz, Eliminar, Deseleccionar).
   - Ocultar/retirar la sección redundante de `Orientación del Cajón / Orientación de la Pieza` del panel lateral derecho.

3. **`src/app/components/module-designer/module-designer.ts`**:
   - Añadir métodos auxiliares si es necesario para rotar una pieza 90° desde la cinta superior (`rotateSelectedPart(90)`).
   - Asegurar que la alternancia de orientación individual funcione de forma fluida y actualice la geometría 3D en tiempo real.

---

## Plan de Verificación

1. **Prueba de Apertura de Cajones**:
   - Abrir un cajón estándar (0°): Verificar que las 5-6 piezas se deslicen juntas hacia el frente en el eje Z positivo.
   - Girar el cajón 90° hacia la derecha: Verificar que al hacer clic en "Abrir", todo el cajón se desplace hacia la derecha (eje X positivo) en bloque, sin despiece ni piezas saliendo en sentidos contrarios.
   - Girar el cajón 180° y 270°: Verificar la misma coherencia de desplazamiento unificado hacia atrás y hacia la izquierda respectivamente.
2. **Prueba de la Cinta Superior para Pieza Individual**:
   - Seleccionar una pieza (ej. un lateral o repisa).
   - Verificar la aparición de la cinta estilizada superior.
   - Probar **Duplicar**: Debe duplicar la pieza seleccionada.
   - Probar **Mover**: Debe activar el gizmo 3D de movimiento.
   - Probar **Rotar 90°**: Debe girar la pieza en 90 grados.
   - Probar **Orientación**: Cambiar entre Horizontal, Vertical XY y Vertical YZ y comprobar que la pieza cambie su postura espacial.
   - Probar **Eliminar**: Debe solicitar confirmación y eliminar la pieza.
3. **Prueba de Limpieza del Panel Lateral Derecho**:
   - Verificar que el panel lateral derecho no contenga botones repetidos de orientación, ofreciendo una vista despejada.
4. **Compilación y Build**:
   - Ejecutar `compile_applet` para confirmar cero errores de compilación TypeScript/AOT.
