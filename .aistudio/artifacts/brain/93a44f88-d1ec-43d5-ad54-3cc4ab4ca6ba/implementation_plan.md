# Plan de Implementación: Corrección de Cajoneras en Catálogo y Asistente Paramétrico de Cajones Corredizos

## 1. Diagnóstico del Problema Actual
Al cargar la plantilla **Cajonera de 3 Cajones** desde el Catálogo se presentan dos fallos críticos:
1. **19 Solapamientos Geométricos**:
   - En `TemplatesCatalogService`, los **Laterales de Cajón** están definidos con `orientation: 'horizontal'` en lugar de `'vertical_yz'`, provocando que se acuesten horizontalmente y colisionen contra la base, los frentes y los costados del mueble.
   - Los **Fondos Internos de Cajón** (`orientation: 'vertical_xy'`) invierten `length` y `width`, haciendo que su altura sea de `428 mm` en lugar de `120 mm` y atraviesen los cajones superiores e inferiores.
   - La **Tapa Superior** se posiciona en `positionY: 732` superponiéndose con los laterales de `750 mm`, y el **Fondo Trasero HDF** se solapa con los laterales al no descontar el espesor o posicionarse fuera del vano trasero.
2. **Piezas Desagrupadas y Sin Configuración Paramétrica**:
   - `ProjectStorageService.loadTemplateFurniture()` inserta las piezas crudas en el lienzo sin asignarles un `groupId` compartido ni crear un registro en `partGroups`, y sin vincular un `cabinetConfig` editable.

---

## 2. Solución Propuesta y Arquitectura

### A. Corrección Geométrica Exacta y Agrupación Automática en Catálogo
- **Geometría Libre de Colisiones (`TemplatesCatalogService` y `CabinetGeneratorService`)**:
  - **Estructura exterior**: Laterales (`vertical_yz`), Base Inferior y Tapa Superior (`horizontal` internas entre laterales, `width = W - 2*t`), Zócalo Frontal (`vertical_xy`) y Fondo Trasero HDF (`vertical_xy` encajado sin solapar).
  - **Cajones Corredizos (por cada cajón $i$)**:
    - **Frente de Cajón** (`vertical_xy`): Ubicado en el plano frontal (`Z = D/2 + t/2`), con holgura perimetral de `2 mm` entre frentes.
    - **Costados de Cajón Izquierdo y Derecho** (`vertical_yz`): Con descuento de `26 mm` (13 mm por lado para rieles telescópicos), altura de costados calibrada y profundidad libre de colisión con el frente y la trasera.
    - **Contra-frente / Trasera Interna de Cajón** (`vertical_xy`): Con `length = ancho_interno_cajón` y `width = alto_costado_cajón`, ubicado entre ambos costados del cajón.
    - **Fondo de Cajón HDF** (`horizontal`): Apoyado en la base de la caja interna del cajón sin intersecar costados ni frentes.
- **Agrupación por Defecto (`ProjectStorageService` y `ModuleDesignerComponent`)**:
  - Al cargar cualquier plantilla del catálogo (como la *Cajonera de 3 Cajones*), todas las piezas del módulo recibirán automáticamente un `groupId` único y se registrarán como un **Grupo Modular (`PartGroup`)** con su `cabinetConfig` paramétrico asociado.
  - Además, en las tarjetas del Catálogo de Plantillas se añadirá el botón **"Configurar en Asistente"** junto a **"Cargar"**, permitiendo abrir la plantilla directamente en el Asistente Paramétrico antes de insertarla si se desea personalizar sus medidas de antemano.

### B. Cajoneras y Cajones Corredizos en el Asistente Paramétrico (`TemplatesModalComponent`)
- **Nueva Categoría "Cajonera" + Opción de Cajones en Módulos**:
  - Se agregará la categoría **`drawer_unit` (Cajonera)** en el selector de categorías del Asistente Paramétrico, además de permitir añadir cajones corredizos en módulos bajos, torres y escritorios.
- **Controles Paramétricos de Cajones**:
  - ** Dimensiones Generales**: Ancho (`width`), Alto (`height`), Profundidad (`depth`), Espesor de melamina (`15 mm` o `18 mm`), altura de zócalo (`toeKickHeight`) y presencia/orientación de **Manijas / Tiradores** (`hasHandles`, centradas horizontalmente en cada frente de cajón).
  - **Cantidad de Cajones (`drawerCount`)**: Selector rápido de **1 a 6 cajones**.
  - **Distribución de Altura de Cajones (`drawerDistribution: 'uniform' | 'manual'`)**:
    - **Automática Uniforme**: Divide el vano útil frontal en $N$ frentes de cajón iguales con luz de `3 mm` entre frentes y calcula automáticamente la altura útil de cada caja interna.
    - **Manual Personalizada**: Permite definir la altura individual de cada frente de cajón en milímetros (`customDrawerHeights: number[]`, por ejemplo: 2 cajones superiores de `160 mm` para cubiertos y 1 gaveta inferior profunda de `320 mm` para ollas), mostrando en tiempo real el espacio restante o auto-ajustando el último cajón.
  - **Vista Previa Interactiva 2D/Esquemática**: El esquema técnico del Asistente mostrará en tiempo real los frentes de los cajones, sus cotas de altura individual, sus manijas centradas y el espacio interior de las correderas.

### C. Edición Posterior y Animación Interactiva en el Visor 3D
- **Re-edición Paramétrica Completa**:
  - Al seleccionar la cajonera en el lienzo 3D:
    - En la **cinta flotante superior** del grupo aparecerá el botón **"Editar Módulo"** (`openEditGroupWizard()`).
    - En el **menú contextual (clic derecho)** sobre cualquier pieza de la cajonera aparecerá la acción **"Editar Módulo Completo"**, abriendo el Asistente Paramétrico precargado con todas sus medidas, número de cajones, alturas individuales y manijas para agregar o quitar cajones y actualizar el mueble en su misma posición (`originX, originY, originZ`).
- **Apertura / Cierre Deslizante de Cajones en 3D (`Furniture3dViewerComponent`)**:
  - Todas las piezas de cada cajón (frente, 2 costados, trasera interna y fondo de cajón) compartirán metadatos del índice de cajón o se vincularán espacialmente en el visor 3D para poder deslizar/abrir y cerrar los cajones desde el menú contextual o inspección 3D y verificar visualmente el interior sin colisiones.

---

## 3. Archivos a Modificar
1. **`src/app/models/melamine.models.ts`**:
   - Ampliar `WizardCategory` para incluir `'drawer_unit'`.
   - Ampliar `CabinetModuleConfig` con `drawerDistribution?: 'uniform' | 'manual'`, `customDrawerHeights?: number[]` y metadatos de plantilla para cajoneras.
2. **`src/app/services/cabinet-generator.service.ts`**:
   - Actualizar `generateCabinetParts()` para soportar `category === 'drawer_unit'` y cajones con alturas uniformes o manuales (`customDrawerHeights`), generando frentes, costados (`vertical_yz`), traseras internas (`vertical_xy`) y fondos (`horizontal`) con holguras exactas para correderas telescópicas y **0 solapamientos**.
3. **`src/app/services/templates-catalog.service.ts`**:
   - Actualizar la plantilla `cajonera_3_cajones` (y demás plantillas con cajones) para que utilicen orientaciones exactas libres de colisiones y expongan su `defaultWizardConfig` para edición paramétrica.
4. **`src/app/services/project-storage.service.ts`**:
   - Actualizar `loadTemplateFurniture()` para que todo módulo cargado desde plantilla cree un único `PartGroup` agrupado por defecto y adjunte su `cabinetConfig` editable.
5. **`src/app/components/templates-modal/templates-modal.ts` y `templates-modal.html`**:
   - Incorporar la categoría **Cajonera**, controles de cantidad de cajones (1 a 6), modo de altura **Uniforme / Manual** con inputs por cajón, vista previa interactiva de cajones con manijas, y el botón **"Configurar en Asistente"** en las tarjetas del catálogo.
6. **`src/app/components/module-designer/module-designer.ts` y `furniture-3d-viewer.ts`**:
   - Garantizar que tanto el botón **"Editar Módulo"** en la barra superior como **"Editar Módulo Completo"** en el clic derecho abran el Asistente Paramétrico con los datos de la cajonera y regeneren el conjunto sin perder su ubicación ni materiales.
