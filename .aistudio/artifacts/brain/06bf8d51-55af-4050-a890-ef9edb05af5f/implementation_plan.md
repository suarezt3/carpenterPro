# Plan de Implementación: Guardado en la Nube con Supabase y Resaltado Técnico Azul Cobalt

## 1. Contexto y Objetivos
- **Resaltado 3D Profesional**: Reemplazar el color turquesa fluorescente por un **Azul Cobalt Blueprint Técnico (`#2563eb` / `#1d4ed8`)** con aristas y contornos nítidos (`#60a5fa`), ofreciendo una estética técnica de ingeniería de corte limpia y descansada para la vista.
- **Persistencia en la Nube con Supabase**:
  - URL: `https://umdcxcjrdyckpxomxlmi.supabase.co`
  - Clave API: `sb_publishable_FYydWGY0juW6ajW5tLiQQQ_Stz1tMVD`
  - Guardar proyectos directamente en Supabase (tabla `projects` / `furniture_projects`).
  - Sincronización híbrida: Botón manual destacado de **"Guardar en la Nube"** + debounce de sincronización automática continua.
  - En el modal **"Proyectos"**, mostrar la lista de proyectos en la nube con fecha, número de piezas, dimensiones, botón para **Cargar Proyecto**, **Duplicar** y **Eliminar**.
  - Manejo resiliente con sincronización transparente.

---

## 2. Cambios de Código Propuestos

### A. Servicio Supabase Cloud Storage (`src/app/services/supabase.service.ts`)
- Implementar cliente HTTP reactivo contra la API REST de Supabase con los headers de autorización estándar (`apikey`, `Authorization: Bearer <key>`).
- Métodos:
  - `getProjects()`: Obtiene todos los proyectos ordenados por fecha de modificación descendente.
  - `saveProject(project)`: Inserta o actualiza (`upsert`) el proyecto con su despiece completo, materiales, tapacantos y configuración 3D.
  - `deleteProject(id)`: Elimina un proyecto en la nube.
- Manejo de estado (`Nube Conectada`, `Sincronizando...`, `Guardado en Supabase`).

### B. Integración en `ProjectStorageService` y Modal de Proyectos
- Añadir indicador visual de sincronización en la barra superior (ej: `☁️ Guardado en Nube`, `🔄 Sincronizando...`).
- Actualizar el diálogo/modal de "Proyectos" para mostrar una pestaña principal **"En la Nube (Supabase)"** con todos los proyectos guardados, permitiendo:
  - Cargar cualquiera con 1 clic para edición instantánea.
  - Guardar el proyecto actual con nombre personalizado.
  - Ver tamaño, fecha y total de piezas.
  - Borrar proyectos antiguos de la nube.

### C. Refinamiento Estético 3D en `furniture-3d-viewer.ts`
- Actualizar los materiales de selección:
  - Tono base seleccionado: **Azul Cobalt Blueprint Técnico (`0x1d4ed8` / `0x2563eb`)** con acabado semitransparente satinado (opacidad 0.88).
  - Líneas de contorno / wireframe: Azul técnico de precisión (`0x60a5fa`) con grosor visible y nítido.
  - Puntos de anclaje y badges HUD actualizados con acento Cobalt Blueprint elegante.

---

## 3. Plan de Verificación
1. Validar compilación con `compile_applet` y linter con `lint_applet`.
2. Probar en el visor 3D la selección de piezas para verificar el nuevo aspecto Azul Cobalt técnico.
3. Probar el guardado manual y la sincronización en Supabase, así como la carga de proyectos desde el panel "Proyectos".
