# Plan de Implementación: Retiro de Landing Page & Sistema Unificado de "Plantillas" Multi-Categoría

## 1. Análisis de Requerimientos y Ajustes Solicitados
- **Eliminar la Landing Page**:
  - Descartar y eliminar el código de la landing page (`src/app/pages/landing`).
  - La aplicación debe iniciar directamente en el entorno de diseño CAD 3D y despiece profesional (`app-header` + `app-module-designer`), sin pasar por landing ni requerir navegación previa.
  - Eliminar los enlaces y eventos `goLanding` presentes en el header o barra superior.
- **Renombrar y Evolucionar a "Plantillas" (Catálogo Multi-Categoría)**:
  - Cambiar el nombre del botón en la cinta superior (junto a `Módulo` y `Habitación 3D`) de *"Módulos Cocina"* a **"Plantillas"**.
  - Flujo inspirado en el plugin Melamina PRO para SketchUp:
    1. Al hacer clic en **"Plantillas"**, se despliega el Catálogo organizado por categorías:
       - **01. Cocinas**: Módulos Altos (Alacenas 1 y 2 puertas, microondas), Módulos Bajos, Módulos Torres.
       - **02. Closets & Armarios**: Módulos roperos, divisiones con colgadores, zapateros.
       - **03. Baño**: Muebles vanitory flotantes, botiquines aéreos.
       - **04. Cajoneras & Estructuras**: Bloques cajoneros de 2, 3 y 4 gavetas.
    2. Al seleccionar un mueble (iniciando con nuestro **Módulo Alto de 1 Puerta**), se abre la ventana de **Opciones de Componente** para parametrizar sus dimensiones (X, Y, Z), sentido de apertura de puerta (izquierda, derecha, elevable, abatible), espesores y acabados.
    3. Al pulsar **"Insertar en Escena"**, el mueble se genera de forma íntegra y se posiciona en el espacio 3D para ser movido libremente en cualquier eje.

---

## 2. Directrices de Diseño y Experiencia de Usuario (UI/UX)
- **Carga Inmediata del Estudio CAD**:
  - Experiencia limpia de herramienta de trabajo (SaaS Studio) sin pantallas intermedias.
  - El usuario aterriza directamente con el lienzo 3D listo para modelar.
- **Cinta Superior de Herramientas**:
  - En la cinta superior del visor 3D, el botón lucirá un diseño distinguido y accesible:
    - Etiqueta: **"Plantillas"** con ícono `library_books` o `dashboard_customize`.
    - Selector rápido y directo con navegación fluida.
- **Navegación Visual del Catálogo de Plantillas**:
  - Panel o modal categorizado con buscador y vista en miniatura técnica de cada mueble.
  - Transición fluida entre la selección de la plantilla y la ventana flotante de *Opciones de Componente*.

---

## 3. Plan de Modificación de Archivos

### A. Eliminación de Landing Page
- `src/app/app.ts`: Retirar importación de `LandingPageComponent`, eliminar señal `currentView` y métodos `showLanding`/`showWorkspace`.
- `src/app/app.html`: Eliminar la condición `@if (currentView() === 'landing')` para renderizar directamente el header y el espacio de trabajo.
- `src/app/components/header/header.ts` & `header.html`: Retirar output `goLanding` y acción de retorno a landing page.
- Eliminar archivos en `src/app/pages/landing` (`landing.ts`, `landing.html`, `landing.css` si existen).

### B. Integración del Catálogo de "Plantillas"
- `src/app/components/module-designer/module-designer.html`:
  - Cambiar el botón en la cinta superior de *"Módulos Cocina"* a **"Plantillas"**.
  - Conectar el botón a un modal integrado o selector donde el usuario visualiza las categorías de muebles (Cocinas, Closets, Baños, etc.) y elige el mueble a configurar.
- `src/app/components/templates-modal/`:
  - Enlazar la selección de módulos hacia el modal de **Opciones de Componente** (`ComponentOptionsModalComponent`) para que los muebles de cocina (como el Módulo Alto de 1 Puerta) abran su configuración técnica paramétrica.
- `src/app/components/component-options-modal/`:
  - Añadir soporte para recibir la categoría seleccionada (Cocina, Closet, etc.) y ajustar los valores predeterminados de forma dinámica.

---

## 4. Verificación y Pruebas
1. **Verificación de Inicio**: Comprobar que al abrir o refrescar la aplicación, carga de inmediato el espacio de trabajo 3D sin rastro de la landing page.
2. **Verificación del Botón "Plantillas"**: Validar que el botón en la cinta superior diga "Plantillas" y responda abriendo el catálogo con las categorías correspondientes.
3. **Flujo de Configuración 3D**: Probar la selección de un mueble alto de 1 puerta desde Plantillas, ajustar su apertura (izquierda/derecha/elevable) e insertarlo en el lienzo 3D.
4. **Compilación y Linters**: Ejecutar `compile_applet` para garantizar cero errores en build y tipos.
