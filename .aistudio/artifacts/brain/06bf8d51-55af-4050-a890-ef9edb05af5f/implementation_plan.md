# Plan de Implementación: Edición Interactiva de Nombre de Proyecto e Identificador Único Persistente

Permitir a los usuarios renombrar el proyecto activo y el nombre del cliente directamente desde la barra superior (mediante clic en el título o ícono de lápiz), actualizando el registro existente en LocalStorage y Supabase en lugar de generar proyectos duplicados con distintos nombres.

---

## Decisiones Críticas y Confirmaciones del Usuario

> [!IMPORTANT]
> Se han confirmado las siguientes tres directrices en la fase de consulta:
> 1. **Ubicación de Edición**: Directamente en la barra superior (Header), haciendo clic sobre el nombre del proyecto o en el botón de lápiz de edición.
> 2. **Confirmación de Cambios**: Guardado automático al presionar `[ Enter ]` o al perder el foco (`blur`), además de un botón de guardado rápido.
> 3. **Edición Conjunta**: Posibilidad de modificar tanto el **Nombre del Proyecto** como el **Nombre del Cliente** de forma fluida.
> 4. **Persistencia por ID Único**: El `id` interno del proyecto (ej. `proj_mueble_estudio`) se mantiene constante durante cualquier cambio de nombre, ejecutando un *UPSERT* en Supabase y una actualización en lugar (*in-place*) en LocalStorage.

---

## 1. Visión General y Concepto Central

- **Qué hace**:
  1. Convierte el nombre estático del proyecto en el Header en un control interactivo (Badge / Botón de lápiz / Campo de entrada en línea).
  2. Añade un popover / modal compacto rápido en la barra superior para ajustar el **Nombre del Proyecto** y el **Nombre del Cliente**.
  3. Ejecuta la actualización de nombre mediante `updateProject(p => ({ ...p, name: cleanName, clientName: cleanClient }))` en `ProjectStorageService`.
  4. Garantiza que la clave primaria `id` permanezca idéntica, evitando la creación de copias o entradas duplicadas tanto en la lista local de proyectos (`melamipro_saved_projects_meta`) como en la tabla `projects` de Supabase (`resolution=merge-duplicates`).
- **Público Objetivo**: Usuarios y carpinteros que necesitan personalizar o corregir el título de sus proyectos sin desorganizar su historial de archivos.
- **Valor Principal**: Integridad de datos absoluta, cero duplicidad en la base de datos y máxima usabilidad.

---

## 2. Experiencia de Usuario y Diseño Visual

### Flujos Clave de Usuario

1. **Edición Rápida en la Barra Superior**:
   - En la barra de navegación superior (Header), junto a la marca "Modulr 3D Studio", el nombre del proyecto actual aparece destacado con un ícono discreto de edición (lápiz `edit`).
   - Al hacer clic en el nombre o en el ícono de lápiz, se despliega un popover elegante y flotante (o se habilita un campo de entrada en línea) con los campos:
     - **Nombre del Proyecto** (ej. "Zapatero Vertical Repisas").
     - **Cliente / Referencia** (ej. "Familia Gómez - Habitación Principal").
   - El usuario modifica el texto y presiona `[ Enter ]`, pierde el foco (`blur`) o hace clic en "Guardar Nombre".
   - Un toast de notificación confirma: *"✏️ Proyecto renombrado a '...' "*, y el nuevo nombre se refleja de inmediato en el Header, en la lista de proyectos guardados y en la base de datos de Supabase con el mismo ID.

2. **Carga y Verificación en la Lista de Proyectos**:
   - Al abrir el modal "Mis Proyectos" (Guardados / Nube Supabase), la lista muestra el nuevo nombre actualizado en la misma tarjeta, confirmando que no se generó ninguna duplicación.

---

## 3. Decisiones de Producto y Arquitectura de Estado

- **Preservación Estricta del `id` del Proyecto**:
  - *Enfoque*: `ProjectStorageService.updateProject` mantendrá el mismo `id` (`project.id`).
  - *Razonamiento*: Tanto la función `saveToStorage` de LocalStorage como `saveProject` de Supabase utilizan la estrategia *Upsert por `id`* (`list.findIndex(p => p.id === project.id)` y `resolution=merge-duplicates` en Supabase). Al no alterar el `id`, la actualización reemplaza exactamente la fila existente.
- **Disparador y Sincronización**:
  - La edición actualizará de forma reactiva el signal `currentProject`, propagando los cambios al visor 3D, exportaciones PDF/DXF y encabezados de reportes.

---

## 4. Arquitectura Técnica y Mapeo de Componentes

```
┌────────────────────────────────────────────────────────────────────────┐
│                          HEADER COMPONENT                              │
│  - Signal e input reactivo: project().name, project().clientName       │
│  - Estado de edición: isEditingName (popover / inline)                 │
│  - Eventos: (keydown.enter)="saveProjectName()", (blur)="saveName()"   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       PROJECT STORAGE SERVICE                          │
│  - updateProjectName(newName, newClient)                               │
│  - Preserva project.id sin cambios                                     │
│  - Actualiza LocalStorage (`melamipro_saved_projects_meta` in place)   │
│  - Ejecuta Upsert en Supabase por ID (PRIMARY KEY = id)                │
└────────────────────────────────────────────────────────────────────────┘
```

### Plan de Cambios Específicos

1. **`src/app/services/project-storage.service.ts`**:
   - Agregar método `updateProjectName(name: string, clientName?: string)` que invoque `updateProject`, sanitice el texto y preserve la fecha de actualización `updatedAt`.

2. **`src/app/components/header/header.ts`**:
   - Agregar signals `isEditingTitle = signal(false)`, `titleInput = signal('')`, `clientInput = signal('')`.
   - Métodos `startEditingTitle()`, `saveTitleChange()`, `cancelEditingTitle()`.

3. **`src/app/components/header/header.html`**:
   - Reemplazar la etiqueta de texto estático `{{ project().name }}` por un bloque interactivo con ícono de lápiz `edit` y un popover/diálogo compacto de edición flotante para renombrar Nombre y Cliente.

---

## Verificación y Calidad

- Compilación limpia con `compile_applet`.
- Verificación de edición de nombre y cliente en vivo.
- Inspección de LocalStorage y Supabase confirmando que el ID interno sigue siendo idéntico y no existen registros duplicados.
