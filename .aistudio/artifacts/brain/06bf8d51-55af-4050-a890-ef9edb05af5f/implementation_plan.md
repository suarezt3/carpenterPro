# Plan de Implementación: Unicidad Estricta de Nombres en Cajones y Piezas con Renombrado Completo

Garantizar la integridad y consistencia del modelo de mobiliario impidiendo que existan dos cajones o dos piezas con nombres duplicados, e incorporar la funcionalidad de renombrado para piezas individuales tanto en la cinta de acciones superior como en la lista de despiece total.

---

## 1. Diagnóstico del Problema y Requerimientos

1. **Colisión de nombres en cajones y módulos:**
   - Actualmente, al crear un cajón desde el asistente modular (`showDrawerWizard`), al agrupar piezas seleccionadas (`showGroupNamingModal`) o al renombrar un cajón en la cinta superior, no se verifica si el nombre ya existe en la lista de grupos (`groups()`).
   - Al desagrupar un cajón, este se elimina de `groups()`. Si posteriormente el usuario agrupa o crea otro cajón con el nombre de uno existente (ej. "Cajón 2"), la interfaz permitía crear dos con el mismo nombre ("Cajón 2", "Cajón 2"), causando confusión visual y desorden en el despiece.
2. **Falta de renombrado de piezas individuales:**
   - Actualmente solo los grupos cuentan con herramienta de renombrado en la cinta. Las piezas del catálogo se quedan con nombres predeterminados ("Lateral Izquierdo", "Fondo", etc.) sin opción cómoda para personalizarlas (ej. "Lateral Izquierdo Superior", "Estante 1").
   - Las piezas individuales también deben tener nombres únicos para evitar confusiones en los planos de corte y etiquetas de taller.
3. **Decisiones confirmadas por el usuario:**
   - **Respuesta a nombres duplicados:** Bloquear el botón de guardado/creación, mostrar un indicador de advertencia claro e indicar una sugerencia única automática.
   - **Ubicación para renombrar piezas:** En la cinta superior flotante (al seleccionar la pieza) y directamente en la lista de despiece total del panel lateral.

---

## 2. Arquitectura de Validación y Nombres Únicos

### A. Servicio y Métodos de Validación en `ModuleDesignerComponent` & `ProjectStorageService`
- **Generador de nombres únicos para grupos:**
  - `getNextUniqueGroupName(baseName = 'Cajón'): string`: Escanea todos los grupos existentes (`groups()`) y busca el primer número correlativo disponible (`Cajón 1`, `Cajón 2`, `Cajón 3`, etc.). Si "Cajón 2" fue desagrupado y queda "Cajón 1", sugerirá "Cajón 2".
- **Comprobador de existencia de nombre de grupo:**
  - `isGroupNameTaken(name: string, excludeGroupId?: string | null): boolean`: Comprueba de forma insensible a mayúsculas y espacios si el nombre ya está en uso por otro grupo.
- **Generador de nombres únicos para piezas:**
  - `getNextUniquePieceName(baseName: string): string`: Analiza las piezas del proyecto (`currentParts()`) y, si el nombre base ya existe, genera sufijos correlativos como `Lateral 2`, `Lateral 3`, etc.
- **Comprobador de existencia de nombre de pieza:**
  - `isPieceNameTaken(name: string, excludePartId?: string | null): boolean`: Comprueba de forma insensible a mayúsculas y espacios si alguna otra pieza ya tiene ese nombre exacto.

---

## 3. Plan de Modificaciones por Componente

### 3.1. Asistente Paramétrico de Cajones (`showDrawerWizard`)
- **Inicialización:** Al pulsar `openDrawerWizard()`, el campo `name` se inicializa con `getNextUniqueGroupName('Cajón')`.
- **Validación en vivo:**
  - En `module-designer.html`: Debajo del input del nombre, si `isGroupNameTaken(drawerForm().name)`, se muestra un mensaje de alerta:
    ```html
    <p class="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-1">
      <span class="material-icons text-xs">error</span>
      Ya existe un cajón llamado "{{ drawerForm().name }}". Sugerencia: <strong>{{ suggestedDrawerName() }}</strong>
    </p>
    ```
  - El botón **"Crear y Ensamblar Cajón"** se deshabilita (`[disabled]="isGroupNameTaken(drawerForm().name)"`) con estilo opaco y cursor no permitido.
  - En `submitDrawerWizard()`: Verificación estricta que previene la creación si el nombre no es único.

### 3.2. Modal de Agrupación Manual (`showGroupNamingModal`)
- **Inicialización:** Al pulsar `openGroupNamingModal()`, el input `newGroupNameInput` se predetermina con `getNextUniqueGroupName('Cajón')`.
- **Validación en vivo:**
  - Alerta en vivo si el nombre escrito colisiona con un grupo existente.
  - Botón **"Agrupar Piezas"** deshabilitado si el nombre está duplicado.
  - Al pulsar <kbd>Enter</kbd> en el input, si está duplicado no procede y lanza un toast informativo con la sugerencia.

### 3.3. Renombrado de Cajones en la Cinta Superior
- Al editar el nombre del cajón desde la cinta superior flotante:
  - Al hacer clic en el botón de check o presionar <kbd>Enter</kbd>:
    - Se verifica si `isGroupNameTaken(newName, currentGroupId)`.
    - Si ya existe otro grupo con ese nombre: se bloquea el guardado, se mantiene el input abierto y se emite un aviso toast: `⚠️ Ya existe un cajón con el nombre "${newName}". Por favor elige otro o usa "${sugerencia}".`
    - Si es único: se actualiza con `projectService.updateGroup(groupId, { name })` y se confirma con toast de éxito.

### 3.4. Renombrado de Piezas Individuales en la Cinta Superior
- En la cinta superior de pieza individual (`selPart`):
  - Añadir soporte para `renamingPartId` y `renamingPartName`.
  - Agregar botón de edición `<button (click)="startRenameSelectedPart($event)"><span class="material-icons">edit</span></button>`.
  - Al estar en modo edición: muestra un input inline con botones de confirmación (<kbd>Enter</kbd> / check) y cancelación (<kbd>Esc</kbd> / cruz).
  - Al confirmar: verifica `isPieceNameTaken(newName, selPart.id)`. Si colisiona con otra pieza, bloquea y notifica; si es único, actualiza `part.name` en `projectService.updatePart()`.

### 3.5. Renombrado de Piezas en la Lista de Despiece Total
- En cada elemento de la lista del panel lateral:
  - Añadir botón de renombrar `<button (click)="startRenamePart(part, $event)" title="Renombrar pieza">`.
  - Modo inline: si `renamingPartId() === part.id`, el título de la pieza se convierte temporalmente en un input editable compacto con botones de check y cancelar.
  - Validación de unicidad idéntica: bloquea nombres duplicados y sugiere un nombre disponible.

### 3.6. Duplicación de Cajones y Piezas
- Al duplicar un cajón (`duplicateSelectedGroup` / `duplicateGroupInViewer`):
  - El nuevo grupo recibe automáticamente un nombre único, ej. `Cajón 2 (Copia)` o el siguiente número libre correlativo, garantizando cero colisiones.
- Al duplicar una pieza individual (`duplicateSelectedPart`):
  - La nueva pieza clonada recibe un nombre único correlativo (ej. `Lateral Izquierdo 2`), evitando duplicados en la lista.

---

## 4. Plan de Pruebas y Verificación

1. **Prueba de Creación de Cajón Modular:**
   - Abrir el Asistente de Cajón. Verificar que sugiere el primer nombre libre (ej. `Cajón 1`).
   - Crear el primer cajón.
   - Volver a abrir el Asistente y escribir deliberadamente `Cajón 1`. Comprobar que aparece la alerta de nombre existente y el botón de creación queda bloqueado.
   - Cambiar a `Cajón 2` y crear.
2. **Prueba de Desagrupación y Reagrupación:**
   - Desagrupar `Cajón 2`. Verificar que `Cajón 2` desaparece de la lista de cajones.
   - Seleccionar las piezas sueltas y agrupar. Comprobar que no permite llamarlo `Cajón 1` (ya existente) y sugiere correctamente `Cajón 2`.
3. **Prueba de Renombrado en la Cinta:**
   - Intentar renombrar `Cajón 2` a `Cajón 1`. Verificar bloqueo y alerta.
   - Renombrar `Cajón 2` a `Gaveta Inferior`. Verificar actualización exitosa.
4. **Prueba de Renombrado de Piezas Individuales:**
   - Seleccionar una pieza desde el 3D o la lista. Renombrarla desde la cinta flotante a `Lateral Exterior`.
   - Intentar renombrar otra pieza con el mismo nombre `Lateral Exterior` y verificar el bloqueo.
   - Renombrar una pieza desde la lista de despiece total con el botón de edición en línea.
5. **Verificación de Compilación y Calidad:**
   - Ejecutar `compile_applet` y `lint_applet` para confirmar cero errores de tipos o sintaxis.
