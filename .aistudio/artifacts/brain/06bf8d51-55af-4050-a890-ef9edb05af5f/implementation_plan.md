# Funcionalidad de Ocultar y Mostrar Piezas y Grupos Modulares

Permitir ocultar temporalmente piezas individuales (techos, laterales, fondos) o grupos completos (cajones, módulos) para despejar la vista y facilitar el trabajo interior en el mueble 3D, con restauración inmediata mediante el botón "Mostrar Todo" y controles individuales en la lista de despiece.

---

### Decisiones Críticas y Revisión del Usuario

> [!IMPORTANT]
> - **Ubicación de controles (Confirmado por el usuario)**:
>   - En la **cinta superior flotante**: Botón dedicado "Ocultar" (`visibility_off`) cuando se tiene seleccionada una pieza individual o un grupo modular.
>   - En la **lista lateral de despiece**: Icono de ojo interactivo (`visibility` / `visibility_off`) en cada fila de pieza para alternar su visibilidad individualmente sin necesidad de seleccionarla en el 3D.
> - **Restauración de elementos ocultos (Confirmado por el usuario)**:
>   - Botón visible y accesible **"Mostrar Todo"** (`visibility`) tanto en la cabecera del visor 3D como en la cabecera de la lista de despiece lateral, indicando el número de piezas ocultas (ej. *"Mostrar Todo (2)"*).
>   - Clic directo en el icono de ojo apagado de cualquier pieza en la lista lateral para restaurar solo esa pieza.
> - **Atajo de teclado de productividad**: Tecla `H` (Hide) para ocultar la pieza o grupo seleccionado al instante, y `Alt+H` o botón flotante para restaurar todo.

---

### 1. Visión General y Concepto Central

- **Qué hace**: Oculta la geometría 3D de una pieza o grupo seleccionado sin borrarla ni alterar el proyecto, la lista de corte, los costos ni sus coordenadas milimétricas XYZ. Cuando la pieza está oculta, el usuario puede seleccionar piezas internas (como repisas intermedias, divisiones o correderas) que antes estaban bloqueadas visualmente por la tapa, techo o laterales.
- **Audiencia / Beneficio**: Diseñadores y carpinteros de melamina que configuran interiores de muebles y cajones, eliminando la frustración de tener caras o techos que tapan el área de trabajo interior.

---

### 2. Experiencia de Usuario y Diseño Visual

#### Flujo 1: Ocultar una pieza o grupo desde la cinta superior flotante
1. El usuario hace clic en el techo, frente o lateral del mueble en el visor 3D.
2. Aparece la cinta superior con las acciones de la pieza o cajón.
3. El usuario pulsa el nuevo botón **"Ocultar"** (icono `visibility_off`, botón con estilo ámbar/slate sutil) o presiona la tecla `H`.
4. La pieza/grupo desaparece visualmente del canvas 3D al instante, permitiendo ver el interior del mueble.
5. Se muestra un indicador flotante no invasivo en la parte superior: *"N pieza(s) oculta(s) · Mostrar Todo"*.

#### Flujo 2: Ocultar y desocultar desde la lista lateral de despiece
1. En la pestaña de piezas, cada fila cuenta con un icono de ojo discreto a la derecha.
2. Si la pieza está visible, el ojo es gris sutil (`visibility`).
3. Si la pieza está oculta:
   - El fondo de la fila adopta un tono atenuado con borde sutilmente punteado.
   - El icono cambia a `visibility_off` en color ámbar.
   - Al pulsar el ojo, la pieza reaparece en 3D en su posición exacta.

#### Flujo 3: Restauración global rápida
1. El usuario pulsa **"Mostrar Todo"** en el aviso flotante del visor 3D o en la cabecera del panel lateral.
2. Todas las piezas ocultas vuelven a mostrarse simultáneamente, conservando sus materiales, cantos y ensambles.

---

### 3. Decisiones de Producto y Compensaciones

- **Decisión 1: Ocultamiento visual no destructivo**
  - *Enfoque*: El estado de ocultamiento se gestiona mediante un conjunto reactivo `hiddenPartIds: Set<string>`.
  - *Por qué*: Garantiza que las piezas nunca salgan de la memoria del proyecto, los cómputos de corte ni la exportación PDF/Excel. Solo se apaga su renderizado en la escena Three.js (`mesh.visible = false`).
  - *Alternativa descartada*: Marcar un atributo persistente `part.isDeleted = true`; descartada porque provocaría recálculos de ensamble y riesgo de pérdida de datos.

- **Decisión 2: Sincronización bidireccional entre Visor 3D y Diseñador**
  - *Enfoque*: Centralizar `hiddenPartIds` en `ModuleDesigner` y comunicarlo de forma reactiva al `Furniture3DViewer`.
  - *Por qué*: Permite que tanto la cinta de acciones, el menú contextual 3D, el cartel flotante y la lista lateral compartan exactamente el mismo estado en tiempo real.

---

### 4. Arquitectura Técnica y Estrategia de Datos

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ModuleDesigner Component                        │
│                                                                        │
│  State: hiddenPartIds = signal<Set<string>>(new Set())                 │
│  Methods: hidePart(), hideGroup(), togglePartVisibility(), showAll()   │
└───────────────────────┬────────────────────────┬───────────────────────┘
                        │                        │
         ┌──────────────▼──────────────┐  ┌──────▼─────────────────────┐
         │     Floating Top Ribbon     │  │   Lateral Despiece List    │
         ├─────────────────────────────┤  ├────────────────────────────┤
         │ [Ocultar Pieza/Grupo]       │  │ Eye button on each row     │
         │ [Mostrar Todo (N)] badge    │  │ Muted styling when hidden  │
         └──────────────┬──────────────┘  └────────────────────────────┘
                        │
         ┌──────────────▼──────────────┐
         │    Furniture3DViewer (3D)   │
         ├─────────────────────────────┤
         │ Three.js mesh.visible sync  │
         │ Raycaster ignores hidden    │
         │ Floating 3D notice banner   │
         └─────────────────────────────┘
```

- **Mapeo de Componentes y Estado**:
  - `furniture-3d-viewer.ts`:
    - Conectar la entrada/sincronización de `hiddenPartIds`.
    - Garantizar que el raycaster de selección omita las mallas ocultas (`mesh.visible === false`).
  - `module-designer.ts`:
    - Definir métodos `hideSelectedPart()`, `hideActiveGroup()`, `togglePartVisibility(id)`, `showAllParts()`.
    - Atajos de teclado: `H` para ocultar la selección actual.
  - `module-designer.html`:
    - Agregar botón "Ocultar" en la cinta de piezas y en la cinta de grupos.
    - Agregar botón flotante "Mostrar Todo" cuando `hiddenPartIds().size > 0`.
    - Agregar icono de ojo en cada fila de pieza y estilo visual diferenciado.
  - Validación completa con `lint_applet` y `compile_applet`.
