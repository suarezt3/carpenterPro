# Plan de Implementación: Bisagras Sincronizadas, Grupos Multi-Pieza y Menú Contextual Inteligente

Ajuste y refinamiento integral del sistema de carpintería y modelado 3D: sincronización automática del lado de bisagras y perforaciones técnicas Ø35mm en puertas batientes clonadas/invertidas, sistema universal de agrupación y manipulación rígida en bloque de conjuntos de piezas (mesas completas, comedores, módulos) con rotación y desagrupación limpia, optimización del menú contextual de clic derecho para mostrar opciones de animación exclusivamente en piezas móviles, y actualización del manual de ayuda con todas las herramientas recientes.

---

## Decisiones Críticas y Confirmaciones del Usuario

> [!IMPORTANT]
> Se han confirmado las siguientes tres directrices en la fase de consulta:
> 1. **Bisagras y Puntos Ø35mm**: Sincronización automática de perforaciones de cazoleta y herrajes 3D según el lado de apertura y posición de la manija.
> 2. **Grupos y Ensambles**: Agrupación libre multi-pieza con selección múltiple o botón "Crear Grupo" con asignación de nombre personalizado (ej. "Mesa Completa", "Alacena"), permitiendo traslación y rotación conjunta sin deformaciones, además de desagrupación inmediata.
> 3. **Menú Contextual (Clic Derecho)**: Opciones de "Animar / Abrir Pieza" condicionadas estrictamente a puertas batientes/elevables, cajones modulares o piezas pertenecientes a un grupo de cajón.

- **Decisión Confirmada 1**: Las perforaciones púrpuras de cazoleta Ø35mm x 12.5mm se calcularán dinámicamente en el borde derecho (`maxX - 22`) o izquierdo (`minX + 22`) según la orientación de la puerta, girando en sincronía al abrir la puerta en 3D.
- **Decisión Confirmada 2**: Agrupación paramétrica universal compatible con todas las piezas melamínicas y accesorios, habilitando traslación, duplicación y rotación coordinada en bloque.
- **Decisión Confirmada 3**: Filtrado contextual de herramientas en clic derecho: ocultar animación en piezas estáticas y desplegar controles de ensamble/agrupación contextuales.

---

## 1. Visión General y Concepto Central

- **Qué hace**:
  1. Corrige la generación de taladros de bisagra Ø35mm (puntos púrpuras) en puertas batientes para que coincidan con la posición física de las bisagras 3D y la apertura de la puerta (izquierda o derecha).
  2. Permite seleccionar múltiples piezas cualesquiera (por ejemplo, cubierta de mesa + laterales o patas, o estructura + puertas) y consolidarlas en un grupo con nombre personalizado (ej. "Mesa de Reuniones", "Módulo Bajo"), moviéndolas y rotándolas al unísono con el mouse o la tecla `[R]`, con posibilidad de desagrupar en cualquier momento.
  3. Adapta el menú contextual de clic derecho para que la acción "Animar / Abrir Pieza" solo se ofrezca en puertas y cajones (individuales o en grupo), presentando opciones de herrajes pertinentes a cada componente.
  4. Documenta todas las capacidades recientes (herramienta circular, dibujo libre, bisagras reversibles y grupos) en el manual técnico integrado.
- **Público Objetivo**: Diseñadores de mobiliario, carpinteros y arquitectos que arman ensambles complejos y requieren mover muebles completos sin desarmar su composición.
- **Valor Principal**: Flexibilidad total en el modelado CAD sin pérdidas de alineación ni inconsistencias en los despieces o animaciones.

---

## 2. Experiencia de Usuario y Diseño Visual

### Flujos Clave de Usuario

1. **Puertas Batientes Izquierda / Derecha**:
   - El usuario inserta una puerta batiente o clona una existente y la arrastra hacia el lateral derecho del mueble.
   - El sistema detecta su posición o propiedad de apertura: las bisagras 3D y los taladros técnicos Ø35mm (cilindros y anillos púrpuras) se reubican automáticamente en el borde exterior derecho (`maxX - 22`).
   - Al abrir la puerta con un clic, las perforaciones se mueven unidas a la hoja de la puerta en rotación precisa.

2. **Creación y Gestión de Conjuntos (Grupos de Piezas)**:
   - El usuario selecciona varias piezas (usando Shift+Clic en el 3D, selección en la cinta inferior o botón "Seleccionar Todo").
   - En la barra de piezas, en el inspector lateral o en el menú contextual aparece la acción destacada `[Crear Grupo / Conjunto]`.
   - Se abre un diálogo limpio para ingresar el nombre (ej. "Mesa Completa", "Cajón Personalizado").
   - Al hacer clic en cualquier pieza de este grupo, se seleccionan todas en bloque. Al arrastrarlas con el mouse, se desplazan juntas manteniendo distancias relativas exactas y respetando el imán magnético.
   - Al presionar `[R]`, todo el conjunto gira rígidamente 90° respecto a su centro geométrico común.
   - En el inspector aparece el botón `[Desagrupar]` para liberar las piezas individuales cuando se requiera reajustar una pata o medida específica.

3. **Menú Contextual Inteligente (Clic Derecho)**:
   - Si se hace clic derecho sobre una puerta: muestra "Animar / Abrir Puerta", "Bisagras Ø35mm", "Tirador / Manija", "Invertir Apertura", "Duplicar", "Eliminar".
   - Si se hace clic derecho sobre un cajón o grupo tipo cajón: muestra "Animar / Deslizar Cajón", "Correderas", "Tirador", "Duplicar Grupo".
   - Si se hace clic derecho sobre una pieza fija (mesa, lateral, repisa, zócalo): NO muestra "Animar Pieza"; muestra "Rotar 90°", "Cambiar Melamina", "Agrupar Selección", "Duplicar", "Eliminar".

4. **Manual y Documentación Oficial**:
   - En el modal de ayuda se añaden artículos completos y detallados sobre:
     - Herramienta de Círculos y Trazado Paramétrico.
     - Herramienta de Dibujo Libre y Polígonos Extruidos.
     - Agrupación Universal de Muebles y Conjuntos.
     - Configuración y Sentido de Bisagras en Puertas Batientes.

---

## 3. Decisiones de Producto y Arquitectura de Estado

- **Ensamble Rígido de Grupos en Three.js y Modelo de Datos**:
  - *Enfoque*: Los grupos almacenan el identificador `groupId` y `groupName` en cada pieza `Part`. Se introduce un método universal de cálculo centroidal y traslación relativa tanto para el arrastre continuo en el visor 3D como para la rotación 90°/180°.
  - *Por qué*: Evita dependencias circulares o transformaciones matriciales destructivas en la lista de despiece original, asegurando que las dimensiones de corte de cada pieza permanezcan exactas.
- **Generación Dinámica de Taladros en `joinery-engine.service.ts`**:
  - *Enfoque*: En `generateDoorHingeHoles`, evaluar `part.hardwareConfig?.openingDirection` o la posición geométrica relativa de la puerta para calcular el eje X de perforación: si la apertura es derecha, `hingeOffsetX = b.maxX - 22`; si es izquierda, `hingeOffsetX = b.minX + 22`.
  - *Por qué*: Garantiza coherencia matemática absoluta entre el visualizador 3D, el listado de taladros y la futura exportación CNC DXF.

---

## 4. Arquitectura Técnica y Mapeo de Componentes

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MODULE DESIGNER (Host)                         │
│  - Gestor de selección múltiple (selectedPartIds)                     │
│  - Modal de bautizo de grupo (showGroupNamingModal, newGroupName)     │
│  - Acciones de creación/desagrupación (createGroup, ungroup)          │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
┌─────────────────────────────────┐   ┌──────────────────────────────────┐
│      FURNITURE 3D VIEWER        │   │      JOINERY ENGINE SERVICE      │
│  - Detección de bisagras der/izq│   │  - calculateJoinery(parts)       │
│  - Arrastre rígido en bloque    │   │  - generateDoorHingeHoles:       │
│  - Rotación rígida (tecla R)    │   │    b.maxX - 22 ó b.minX + 22     │
│  - Menú contextual adaptativo:  │   │  - Fijación al pivot de rotación │
│    Animación SOLO en móviles    │   └──────────────────────────────────┘
└─────────────────────────────────┘
                                  │
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    DOCUMENTATION MODAL (Manual)                        │
│  - Nuevos artículos: Bisagras reversibles, Creación de Grupos, CAD 3D │
└────────────────────────────────────────────────────────────────────────┘
```

### Plan de Cambios Específicos

1. **`src/app/services/joinery-engine.service.ts`**:
   - En `generateDoorHingeHoles`: determinar el lado de apertura de la puerta inspeccionando `part.hardwareConfig?.openingDirection` y fallback espacial (`part.posX > 0` o sufijo `DER`/`DERECHA`).
   - Ubicar el centro de la cazoleta en `b.maxX - 22` para puertas derechas y en `b.minX + 22` para puertas izquierdas.

2. **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts` & `.html`**:
   - Ajustar el montaje de los taladros de cazoleta en `renderDrillHolesVisuals` para puertas batientes derechas e izquierdas, manteniendo la rotación sincronizada con el pivot `doorPivot`.
   - Modificar el menú contextual para evaluar `isMovablePart(part)`: solo mostrar el bloque de "Animar / Abrir Pieza" si `part.componentRole === 'door'`, `part.componentRole === 'drawer_front'`, o si pertenece a un grupo con tipo `'drawer'` o nombre que contenga `'caj'`.
   - Añadir al menú contextual las opciones rápidas: "Agrupar piezas seleccionadas", "Seleccionar conjunto", "Desagrupar".
   - Optimizar el arrastre directo y la rotación en bloque para cualquier grupo de piezas (`assembly` o personalizado).

3. **`src/app/components/module-designer/module-designer.ts` & `.html`**:
   - Agregar el botón "Crear Grupo" en la barra inferior de selección cuando haya $\ge 2$ piezas seleccionadas.
   - Incorporar controles de edición y desagrupación en la pestaña de propiedades de grupo.

4. **`src/app/components/documentation-modal/documentation-modal.ts`**:
   - Añadir artículos oficiales documentando la herramienta de círculo, dibujo libre, bisagras reversibles sincronizadas y agrupamiento multi-pieza.

---

## Verificación y Calidad

- Compilación limpia con `compile_applet`.
- Verificación de no-regresión en herramientas CAD previas (rectángulo, círculo, dibujo libre, cinta métrica, empujar/tirar).
- Pruebas de clonación de puertas batientes verificando que los cilindros y anillos morados se ubiquen en el lado correcto y giren en vivo.
- Pruebas de agrupamiento de mesa (tapa + patas) comprobando arrastre en conjunto, rotación en bloque y desagrupación intacta.
