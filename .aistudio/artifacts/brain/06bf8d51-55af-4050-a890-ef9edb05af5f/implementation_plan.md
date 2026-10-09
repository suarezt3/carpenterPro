# Plan de Implementación: Persistencia y Gestión Modular de Grupos/Cajones en 3D

Resuelve de forma definitiva los dos problemas reportados:
1. **Superposición de la UI:** El botón "Agrupar" se montaba sobre las fichas de piezas en la barra inferior (como se muestra en la captura de pantalla).
2. **Selección y Persistencia de Grupos:** Al hacer clic sobre cualquier pieza de un cajón ya agrupado, el sistema deseleccionaba el conjunto y seleccionaba solo esa pieza individual. Además, faltaba un acceso directo visible para consultar, seleccionar y mover en bloque los cajones guardados.

---

## 1. Diagnóstico del Problema

- **Superposición Visual:** En `module-designer.html`, el botón `@if (selectedPartIds().length >= 2) { Agrupar }` estaba insertado dentro del mismo contenedor flex horizontal de las fichas de piezas sin espacio reservado ni anclaje independiente, provocando que se solapara sobre la última ficha ("Frente Vista").
- **Comportamiento de Clic en 3D:** En `furniture-3d-viewer.ts` (`onPointerDown`), al hacer clic normal en una pieza con `groupId`, el visor emitía `this.partsSelected.emit([part.id])`, seleccionando únicamente esa pieza y descartando el grupo.
- **Acceso a Grupos Guardados:** Aunque el modelo `PartGroup` se guardaba en el proyecto, la lista de cajones estaba oculta en la pestaña "Catálogo" de la bandeja lateral, requiriendo desplazamiento y siendo difícil de encontrar para el usuario.

---

## 2. Solución de Experiencia de Usuario (UI/UX)

Con base en las respuestas del usuario:

1. **Barra Flotante Superior de Selección Múltiple (Cero Superposición):**
   - Cuando se seleccionen 2 o más piezas (o un grupo), se mostrará una barra flotante elegante en la parte superior central del visor 3D:
     `[ 6 piezas seleccionadas | 🔗 Agrupar Selección (Cajón) | ✕ Deseleccionar ]`
   - La tira inferior de fichas de piezas quedará 100% limpia para visualizar nombres y dimensiones sin ningún botón encima.

2. **Panel Flotante Plegable en la Cinta Izquierda de Herramientas:**
   - En la cinta izquierda vertical de herramientas del visor (junto a Girar, Rectángulo, Medir), se añade el botón **"Cajones y Grupos"** (`folder_special` o `inbox`) con un badge indicador del número de grupos guardados.
   - Al pulsar el botón, se despliega un panel lateral flotante que lista todos los grupos creados (ej. *Cajón 1*, *Cajón 2*):
     - Botón para **Seleccionar en Bloque** con 1 clic (activa el gizmo 3D de traslación del cajón completo).
     - Botón para **Animar Apertura/Cierre** (0% a 100%).
     - Botón para **Desagrupar** (liberar las piezas para editarlas individualmente).
     - Desglose plegable de las piezas que componen cada cajón.

3. **Selección Automática del Bloque Completo en 3D:**
   - En el visor 3D, al hacer clic (sin Shift) sobre cualquier pieza que pertenezca a un grupo o cajón (`part.groupId`), el sistema seleccionará automáticamente **todas las piezas del grupo**:
     `selectedPartIds = [todas las piezas con ese groupId]`.
   - Aparece de inmediato el **Gizmo 3D de Grupo** (flechas X, Y, Z en el centroide del cajón) permitiendo al usuario arrastrar y mover el cajón hacia arriba, hacia abajo o en profundidad como una sola entidad física.
   - Si el usuario desea seleccionar una sola pieza de un grupo para editarla, puede usar `Shift + Clic` o seleccionarla desde la lista de piezas.

---

## 3. Cambios en Código y Archivos

### A. `src/app/components/module-designer/module-designer.html`
- **Reubicación del Botón Agrupar:** Mover el bloque de selección múltiple fuera de la barra de fichas inferior y colocarlo como una barra flotante superior centrada (`absolute top-3 left-1/2 -translate-x-1/2 z-30`).
- **Botón y Panel de Grupos en Cinta Izquierda:**
  - Agregar botón en la barra de herramientas del visor 3D para conmutar `showGroupsPanel()`.
  - Crear el panel flotante desplegable con la lista interactiva de grupos y sus acciones (seleccionar bloque, animar, desagrupar).

### B. `src/app/components/module-designer/module-designer.ts`
- **Método `onPartSelectedFromViewer`:**
  - Si la pieza recibida tiene `groupId`:
    ```typescript
    const groupParts = this.currentParts().filter(p => p.groupId === part.groupId);
    this.selectedPartIds.set(groupParts.map(p => p.id));
    this.selectedPartId.set(part.id);
    ```
- **Control de estado para el panel flotante:** `showGroupsPanel = signal<boolean>(false)`.
- **Acciones rápidas:** `selectEntireGroup(groupId)`, `toggleGroupOpen(groupId)`, `ungroup(groupId)`.

### C. `src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`
- **Clic en 3D (`onPointerDown`):**
  - Si `part.groupId` está presente y `!e.shiftKey`:
    ```typescript
    const groupPartIds = this.parts()
      .filter(p => p.groupId === part.groupId)
      .map(p => p.id);
    this.partsSelected.emit(groupPartIds);
    this.partSelected.emit(part);
    ```
  - Esto garantiza que tanto el visor 3D como el diseñador sincronicen de inmediato el grupo completo.

---

## 4. Plan de Verificación

1. **Compilación y Linteo:** Ejecutar `compile_applet` y `lint_applet`.
2. **Prueba de Creación y Agrupación:**
   - Crear un cajón con el asistente o seleccionar 6 piezas y agruparlas con un nombre (ej. "Cajón 1").
   - Verificar que el botón "Agrupar" aparezca arriba en la barra flotante y **no** sobre las fichas inferiores.
3. **Prueba de Clic en 3D:**
   - Deseleccionar todo haciendo clic en el fondo 3D.
   - Hacer clic en una pieza del cajón (ej. el lateral o el frente): verificar que se seleccionen automáticamente las 6 piezas y aparezca el gizmo de grupo.
   - Mover el gizmo en eje Y (arriba/abajo): verificar que todo el cajón se traslade unido.
4. **Prueba del Panel de Grupos en la Cinta Izquierda:**
   - Hacer clic en el nuevo botón de grupos en la cinta de herramientas: comprobar que se abra el panel flotante.
   - Comprobar que liste "Cajón 1", permita seleccionarlo con 1 clic, abrirlo/cerrarlo o desagruparlo.
