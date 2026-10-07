# Plan de Rediseño: Catálogo de Plantillas Profesional, Corrección de Herrajes 3D y Menú de Proyectos

Reestructuración integral y profesional del catálogo de plantillas, ajuste de paleta a tonos neutros cálidos y madera sobria, corrección de z-index del menú Proyecto en cabecera, eliminación definitiva de herrajes y correderas duplicadas en el visor 3D, y restricción a dos plantillas canónicas verificadas.

## Decisiones Confirmadas con el Usuario

> [!IMPORTANT]
> - **Alcance de Plantillas**: Restricción inicial a exactamente 2 plantillas limpias y funcionales:
>   1. **Cajonera de 3 Cajones**: Módulo bajo con 3 cajones de extracción individual, frentes limpios y proporciones de taller.
>   2. **Módulo Bajo de Cocina con 1 Puerta y Repisa**: Módulo canónico con 1 puerta batiente con bisagras cazoleta de 35 mm y repisa intermedia.
> - **Paleta Visual**: Neutro cálido (gris pizarra / zinc suave con detalles sobrios en madera natural), eliminando el azul estridente y los contrastes duros.
> - **Herrajes en Cajones**: Exactamente 1 tirador centrado en el frente exterior y 1 par de correderas interiores (izquierda y derecha), evitando la replicación en laterales, traseras o fondos.
> - **Despliegue del Menú Proyecto**: Corrección del contenedor de cabecera para que el menú de proyectos flote libremente por encima de la cinta de trabajo sin quedar oculto.

---

## 1. Visión General & Objetivos

El objetivo es transformar la experiencia del catálogo y modelado 3D de un aspecto prototípico o sobrecargado a una herramienta CAD/CAM de carpintería profesional:
- **Catálogo refinado y proporcional**: Botones compactos, navegación por categorías fluida sin flechas toscas ni barras de desplazamiento dobles, y tipografía técnica limpia.
- **Visualizador 3D exacto**: Renderizado estricto de herrajes; los tiradores y correderas pertenecen exclusivamente al frente/ensamblaje del cajón y nunca a las piezas internas individuales (fondos, laterales, traseras).
- **Z-Index y apilamiento DOM impecable**: El selector de proyectos en la cabecera superior debe ser 100% visible y utilizable sobre cualquier barra o cinta inferior.

---

## 2. Experiencia de Usuario y Diseño Visual

### A. Paleta de Colores Profesional (Neutro Cálido & Madera Sobria)
- **Superficie base y modal**: Slate / Zinc neutro cálido (`bg-stone-50` / `bg-slate-50` en fondos claros, `bg-white` en tarjetas, bordes sutiles `border-slate-200/80`).
- **Acentos**: Tono madera cálida refinada (`amber-700/80` o `stone-700`) para elementos destacados en lugar de azul chillón.
- **Acciones primarias**: Botón de reemplazo con fondo pizarra oscuro o madera tenue (`bg-slate-900 hover:bg-slate-800 text-white` o `bg-stone-800`), y botón secundario "Añadir al lado" con contorno fino (`border-slate-300 text-slate-700 hover:bg-slate-100`).

### B. Navegación de Categorías y Flechas
- **Controles de desplazamiento**: Flechas compactas (`w-7 h-7`), integradas visualmente al contenedor con micro-interacciones suaves.
- **Eliminación de scrollbar doble**: Ocultar el scrollbar nativo horizontal manteniendo el desplazamiento táctil/rueda (`scrollbar-none`).
- **Pestañas de categoría**: Altura y padding equilibrados (`px-3 py-1.5 text-xs`), con contador numérico tipográfico sutil.

### C. Menú Desplegable "Proyecto"
- Establecer en `<app-header>` la clase `relative z-50` para evitar que el contenedor `<main>` o la barra de herramientas capture el contexto de apilamiento.
- Ajustar el contenedor flex de la barra superior para permitir que el dropdown flotante (`absolute top-full z-50`) se dibuje por encima de cualquier cinta o viewport.

---

## 3. Arquitectura Técnica y Corrección de Herrajes 3D

### Diagrama de Flujo y Jerarquía

```
┌─────────────────────────────────────────────────────────────┐
│                       MelamiPro Header                      │
│   [Classic]  [Deshacer/Rehacer]  [Proyecto ▼ (z-index 50)]  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Flota sobre la cinta
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Barra de Herramientas 3D                    │
│   [Modelador 3D]       [Plantillas (Modal)]  [Lienzo Vacío] │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│  Plantilla 1: Cajonera 3C    │ │  Plantilla 2: Bajo 1 Puerta  │
│  - 3 Frentes de cajón        │ │  - 1 Puerta batiente         │
│  - 1 Tirador por frente      │ │  - Bisagras cazoleta 35mm    │
│  - 1 Par de rieles laterales │ │  - Repisa regulable          │
│  - Cajas de gaveta 5 piezas  │ │  - Laterales y fondo         │
└──────────────────────────────┘ └──────────────────────────────┘
```

### Reglas Estrictas en el Renderizador 3D (`furniture-3d-viewer.ts`)
1. **Detección Estricta de Frentes de Cajón**:
   - `isDrawerFront` debe ser `true` únicamente si `componentRole === 'drawer_front'` o el nombre es específicamente "FRENTE DE CAJÓN".
   - Piezas auxiliares como `Lateral Izq. Gaveta`, `Trasera Gaveta`, `Fondo Gaveta` **NO** deben ser marcadas como frente ni recibir tiradores ni juegos de correderas adicionales.
2. **Evitar Duplicación de Cajas de Cajón**:
   - Si la plantilla ya provee las 5 piezas físicas de la gaveta en el despiece, el visor no debe inyectar una segunda caja procedural dentro de la misma pieza.
3. **Alineación de Correderas Telescópicas**:
   - Las correderas se posicionan estrictamente en la cota interior de los costados del mueble con longitud acorde a la profundidad del mueble (ej. 450 mm o 400 mm).

---

## 4. Plan de Ejecución Paso a Paso

1. **Corrección de Apilamiento del Menú "Proyecto"**:
   - Modificar `app.html` y `header.html` para garantizar que el menú flotante tenga un z-index prioritario y no se recorte por `overflow-x-auto`.
2. **Rediseño del Catálogo de Plantillas (`templates-modal.html` & `templates-modal.ts`)**:
   - Sustituir la paleta azul chillón por una paleta neutra cálida profesional.
   - Redimensionar y estilizar los botones de desplazamiento de categorías `<` y `>`.
   - Limpiar el scroll horizontal (eliminar scrollbar antiestético manteniendo soporte de arrastre y rueda).
   - Ajustar las tarjetas: dimensiones tipográficas acordes, botones de acción proporcionados.
3. **Corrección en el Visor 3D (`furniture-3d-viewer.ts`)**:
   - Aislar la generación de tiradores y correderas para que nunca se apliquen a piezas internas de gaveta (laterales, trasera, fondo).
   - Asegurar exactamente 1 tirador frontal por cajón y un solo par de correderas por gaveta.
4. **Configuración de las 2 Plantillas Iniciales en `templates-catalog.service.ts`**:
   - Depurar el catálogo para dejar activas las dos plantillas solicitadas:
     - **Cajonera Módulo 3 Cajones**: ancho 500 mm, alto 720 mm, prof 500 mm, con sus 3 frentes y gavetas bien calculadas.
     - **Módulo Bajo Cocina con 1 Puerta y Repisa**: ancho 450 mm, alto 720 mm, prof 550 mm, con 1 puerta batiente y 1 repisa interior.
5. **Verificación y Compilación**:
   - Ejecutar verificación de compilación sin errores para asegurar estabilidad total.
