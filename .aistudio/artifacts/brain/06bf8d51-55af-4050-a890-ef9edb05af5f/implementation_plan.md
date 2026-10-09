# Panel Flotante de Grupos con Enfoque 3D y Desvinculación de Marcas Externas

Plan integral para reparar y desplegar el panel flotante lateral de cajones y grupos guardados con selección directa y encuadre suave de cámara 3D, además de una depuración exhaustiva de cualquier referencia a marcas o plataformas externas (SketchUp u otros programas) en la documentación y la interfaz.

> [!IMPORTANT]
> **Decisiones Confirmadas:**
> - **Despliegue del listado de grupos:** Panel lateral flotante adyacente a la barra de herramientas vertical, desacoplado de contenedores con recorte de desbordamiento (`overflow: hidden/auto`) para garantizar apertura instantánea y visibilidad completa.
> - **Interacción al seleccionar un grupo:** Selección completa de las piezas que componen el grupo + encuadre suave (*smooth camera interpolation*) de la cámara 3D hacia el centro geométrico del módulo.
> - **Independencia de marca:** Eliminación rigurosa de toda referencia textual a "SketchUp" o softwares de terceros en manuales de usuario, tooltips, modales, badges y atributos HTML, sustituyéndolos por terminología propia de diseño y fabricación CAD profesional.

---

## 1. Visión General y Propósito

El aplicativo cuenta con herramientas avanzadas de modelado de mobiliario y gestión modular (cajones y módulos ensamblados). Este cambio atiende dos necesidades fundamentales:
1. **Identidad de Marca Propia:** Establecer una terminología autónoma, profesional y propietaria sin hacer mención a softwares comerciales (como SketchUp), garantizando que el manual de usuario, la ayuda contextual y las descripciones técnicas reflejen una experiencia única.
2. **Navegación Intuitiva de Conjuntos Modulares:** Asegurar que el botón de cajones y grupos guardados (que muestra el conteo numérico como `2`) despliegue de inmediato su panel lateral flotante con la lista de agrupaciones activas, permitiendo al usuario hacer clic para resaltar el grupo completo y posicionar la cámara sobre él fluidamente.

---

## 2. Experiencia de Usuario y Diseño Visual

### Flujo de Interacción: Explorador de Grupos y Cajones
1. **Acceso Inmediato:** El usuario visualiza en la barra de herramientas lateral el icono de bandeja/cajón con el contador numérico dinámico (`2`).
2. **Apertura del Panel Flotante:** Al pulsar el botón, emerge a su derecha un panel flotante limpio con estilo de diseño sobrio:
   - Encabezado con título `"Cajones y Grupos Guardados"`, contador de conjuntos activos y botón de cierre rápido.
   - Lista interactiva de grupos con nombre personalizable, conteo de piezas integrantes e indicador de apertura/cierre.
   - Botón de acción para el Asistente de Cajones (`"Crear nuevo cajón"`).
3. **Selección y Enfoque 3D:** Al hacer clic sobre cualquier tarjeta de grupo en la lista:
   - Se activan y resaltan simultáneamente todas las piezas del conjunto en el visor 3D (contorno azul brillante y cinta de acción superior).
   - La cámara 3D efectúa una transición suave (*lerp* continuo) apuntando hacia el centroide de ese grupo para una inspección cómoda.
   - Se mantiene la sincronización con el árbol de piezas del panel inspector derecho.

### Limpieza Editorial y Terminológica
- Se sustituyen menciones como `"Estilo SketchUp"`, `"fondo claro estudio SketchUp"`, `"Modo SketchUp Classic"` por:
  - `"Modo Estudio CAD"` / `"Fondo Claro Estudio"`
  - `"Arrastre Directo 3D"` / `"Modelado CAD Interactivo"`
  - `"Herramienta Empujar / Tirar"` y `"Cotas y Medidas en Tiempo Real"`

```
┌────────────────────────────────────────────────────────────────────────┐
│                              VISOR 3D CAD                              │
│                                                                        │
│ ┌────┐  ┌──────────────────────────────┐                              │
│ │ ⤹  │  │ Cajones y Grupos (2)       ✕ │                              │
│ │ ⤸  │  ├──────────────────────────────┤                              │
│ │ ☩  │  │ [📦] Cajón Inferior (5 pzs)  │ ──► [Clic]                   │
│ │ 🗄² │► │ [📦] Cajón Superior (5 pzs)  │     • Resalta grupo completo  │
│ │ 📐 │  ├──────────────────────────────┤     • Cámara enfoca suave     │
│ └────┘  │  + Diseñar Nuevo Cajón       │                               │
│         └──────────────────────────────┘                               │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Decisiones Clave de Producto y Arquitectura

- **Desacoplamiento del Popover Flotante:**
  - *Problema actual:* La barra de herramientas izquierda posee `overflow-y: auto`, lo que provoca que cualquier submenú posicionado en `absolute left-11` quede recortado horizontalmente dentro del contenedor de 44px de ancho, aparentando que el botón no hace nada.
  - *Solución:* Reubicar el panel desplegable de grupos como elemento hermano en el visor 3D o con posicionamiento `fixed`/`absolute` sobre el contenedor principal del visor (`left-14 top-3 z-40`), permitiendo desplegarse libremente con fondo traslúcido `backdrop-blur-md` sin recortes.
- **Enfoque Suave de Cámara (*Camera Smooth Tween*):**
  - Implementar interpolación mediante `Vector3.lerp` o animación controlada por `requestAnimationFrame` en `furniture-3d-viewer.ts` para desplazar suavemente `controls.target` y la posición de la cámara hacia el centroide del grupo sin saltos bruscos.
- **Auditoría Global de Texto:**
  - Sustitución minuciosa de todas las ocurrencias en `documentation-modal.ts`, `furniture-3d-viewer.html`, `header.html`, `module-designer.html` y `theme.service.ts`.

---

## 4. Diagrama de Arquitectura y Estados

```
 ┌────────────────────────────────────────────────────────────┐
 │                  ModuleDesigner Component                  │
 └─────────────────────────────┬──────────────────────────────┘
                               │ [partGroups]="groups()"
                               │ [parts]="currentParts()"
                               ▼
 ┌────────────────────────────────────────────────────────────┐
 │                 Furniture3dViewer Component                │
 │                                                            │
 │  ┌───────────────────────┐     ┌────────────────────────┐  │
 │  │ CAD Palette Toolbar   │     │ Groups Floating Flyout │  │
 │  │  • Inbox icon button  │────►│  • Group cards list    │  │
 │  │  • toggleFlyout()     │     │  • selectGroupInViewer │  │
 │  └───────────────────────┘     └───────────┬────────────┘  │
 │                                            │               │
 │                                            ▼               │
 │                               ┌─────────────────────────┐  │
 │                               │ Camera Target Lerp      │  │
 │                               │ • Calculate centroid    │  │
 │                               │ • Smooth pan & orbit    │  │
 │                               │ • Highlight meshes      │  │
 │                               └─────────────────────────┘  │
 └────────────────────────────────────────────────────────────┘
```

### Plan de Verificación
1. **Revisión de Textos:** Búsqueda automatizada con `grep` para verificar cero ocurrencias de nombres de marcas externas en toda la base de código.
2. **Prueba de Clic en el Botón de Grupos:** Comprobar que al pulsar el botón con el indicador numérico se abra y cierre fluidamente el panel lateral.
3. **Prueba de Selección y Cámara:** Comprobar que al seleccionar cualquiera de los dos cajones en la lista se resalte el grupo completo y la cámara se desplace con suavidad hacia el conjunto.
4. **Compilación y Linter:** Ejecución de `compile_applet` y `lint_applet` para garantizar una integración limpia sin regresiones.
