# Plan de Implementación: Catálogo 2 Columnas con Miniaturas 3D, Apertura Interactiva de Puertas/Cajones, Nuevas Melaminas y Corrección de Atajos

Revisión integral de las plantillas de muebles con plantillas dedicadas para cajones, rediseño del catálogo en cuadrícula de 2 columnas con previsualizaciones isométricas 3D coloreadas, botón de Lienzo en Blanco en la cinta superior, reparación del atajo de teclado para suprimir piezas [Supr / Delete / Backspace], catálogo ampliado de melaminas y animación 3D de apertura de puertas y cajones.

## Decisiones Críticas y Preferencias del Usuario

> [!IMPORTANT]
> Decisiones confirmadas a través del diálogo interactivo:
> - **Apertura de Puertas y Cajones**: Se implementa doble modalidad: clic directo sobre cualquier puerta o cajón en el visor 3D para abrir/cerrar individualmente, más un botón global en la barra de herramientas 3D para abrir/cerrar todas las puertas y cajoneras simultáneamente.
> - **Estilo de Previsualización en el Catálogo**: Miniatura isométrica 3D coloreada con materiales reales (maderas, mármol y frentes lacados) generada paramétricamente para cada plantilla, permitiendo ver el mueble antes de cargarlo.
> - **Gama de Nuevos Diseños de Melamina**: Prioridad en maderas nobles cálidas (Roble Miel, Nogal Terracota, Teca, Fresno Nórdico), piedras naturales (Mármol Calacatta Blanco, Granito Negro) y tonos mate modernos (Negro Grafito antihuella, Verde Salvia, Terracota / Barro).

---

## 1. Visión General y Alcance del Producto

### ¿Qué soluciona esta actualización?
1. **Auditoría y Corrección Matemática de Plantillas**: Resolver inconsistencias geométricas, conteos de piezas dispares y asignaciones de materiales en todas las plantillas existentes, garantizando que cada mueble cargue con coordenadas exactas en 3D.
2. **Plantillas Especializadas de Cajones**: Crear una categoría dedicada de módulos cajoneros y gaveteros (cajoneras de 3 y 4 cajones con correderas telescópicas, cajón individual armado con laterales/fondo/contrafrente, y gaveteros olleros de cocina).
3. **Catálogo Rediseñado en Cuadrícula de 2 Columnas**: Sustituir el grid estrecho por un diseño amplio y espacioso de 2 columnas con tarjetas de alta legibilidad, información técnica destacada y **miniatura isométrica 3D coloreada** de cada mueble.
4. **Acceso Directo a "Lienzo en Blanco" en la Cinta Superior**: Ubicar el botón "Lienzo en Blanco" junto al botón de "Plantillas" en la barra superior del modelador, con confirmación de seguridad para evitar pérdidas accidentales.
5. **Corrección de Atajos de Teclado [Supr / Delete / Backspace]**: Conectar formalmente las teclas `Delete` y `Backspace` en el despachador de eventos del visor 3D para eliminar piezas seleccionadas instantáneamente con soporte de Deshacer (`Ctrl+Z`).
6. **Catálogo Enriquecido de Melaminas y Texturas**: Añadir 10+ nuevos acabados de alta gama (Roble Miel, Nogal Terracota, Fresno Nórdico, Teca, Mármol Calacatta, Granito Oscuro, Negro Grafito, Verde Salvia, Terracota) con renderizado procedural en Three.js.
7. **Animación y Movimiento 3D de Puertas y Cajones**: Permitir abrir y cerrar puertas (rotación de 90° sobre bisagras) y cajones (desplazamiento frontal de 300 mm en eje Z) mediante clic interactivo en la pieza o mediante botón global "Abrir / Cerrar Todo".

---

## 2. Experiencia de Usuario y Diseño Visual

### A. Catálogo de Plantillas Rediseñado (2 Columnas con Miniaturas Isométricas)
- **Distribución Espaciosa**: Grid de 2 columnas (`grid grid-cols-1 md:grid-cols-2 gap-5`) en modal ancho `max-w-6xl`.
- **Previsualización Isométrica SVG/Canvas**: Cada tarjeta cuenta con un contenedor superior de previsualización 3D isométrica a escala, con sombreado de caras, color real del material asignado (vetas de madera, blanco o piedra), divisiones visibles de puertas y cajones, y cotas visuales en milímetros.
- **Acciones Duales en Cada Tarjeta**: Botones claros y de alto contraste:
  - **"Reemplazar"** (Botón ámbar/esmeralda con icono `sync`): sustituye el modelo actual y centra la plantilla.
  - **"Añadir al lado"** (Botón oscuro con icono `add_box`): calcula el borde derecho (`maxX + 200 mm`) y sitúa el nuevo mueble sin alterar lo existente.
- **Categorías Refinadas**: Pestañas accesibles: `Todas`, `Cocina`, `Cajoneras y Cajones`, `Baño`, `Closets y Dormitorio`, `Sala TV`, `Oficina`.

### B. Cinta Superior del Modelador
- La barra superior del modelador 3D aloja:
  1. Contador de piezas y área total en m².
  2. Botón destacado **"Plantillas de Muebles"** (abre el catálogo en 2 columnas).
  3. Botón directo **"Lienzo en Blanco"** (`delete_sweep`, estilo sutil rojo/gris con confirmación modal).
  4. Conmutador de bandeja lateral 3D al 100% de pantalla.

### C. Movimiento 3D de Puertas y Cajones
- **Indicador Visual en Cursor**: Al pasar el cursor sobre una puerta o frente de cajón en modo inspección, el cursor cambia a puntero de interacción y muestra una etiqueta flotante: `"Clic para abrir"` o `"Clic para cerrar"`.
- **Animación Fluida**:
  - Puertas: pivotan 90° hacia afuera alrededor de su arista izquierda o derecha (o basculan hacia arriba si es alacena).
  - Cajones: se deslizan suavemente hacia adelante en el eje Z (desplazamiento de 280-320 mm).
- **Botón Global en la Barra 3D**: Botón con icono `meeting_room` / `door_sliding`: *"Abrir / Cerrar Mueble"* que abre o cierra todas las aberturas para inspeccionar estanterías y espacios interiores.

### D. Eliminación Ágil con Atajos [Supr / Delete / Backspace]
- Al tener una o varias piezas seleccionadas, presionar `Supr`, `Delete` o `Backspace` elimina la selección de inmediato, registrando el cambio en el historial de Deshacer (`Ctrl+Z`).
- Notificación toast breve o feedback auditivo sutil confirmando la eliminación de la pieza.

---

## 3. Decisiones Técnicas y Arquitectura

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MODULE DESIGNER (3D CAD)                        │
├────────────────────────────────────────────────────────────────────────┤
│  Top Ribbon: [Plantillas (24)]  [Lienzo en Blanco]  [Bandeja Lateral]  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌──────────────────────────────────┐  ┌───────────────────────────┐  │
│   │   THREE.JS 3D VIEWPORT           │  │  PROPERTIES & DOCK PANEL  │  │
│   │   - Renderizado con Melaminas    │  │  - Materiales y Texturas  │  │
│   │     (Roble, Nogal, Mármol, Mate) │  │  - Tapacantos PVC         │  │
│   │   - Apertura interactiva 3D:     │  │  - Lista de Piezas        │  │
│   │     * Puertas: rotación 90°      │  │  - Taladros CNC           │  │
│   │     * Cajones: slide +Z 300mm    │  └───────────────────────────┘  │
│   │   - Atajo Delete/Supr activado   │                                 │
│   │   - Botón global Abrir/Cerrar    │                                 │
│   └──────────────────────────────────┘                                 │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│   TEMPLATES MODAL (Grid 2 Columnas)                                    │
│   - Tarjetas grandes con Miniatura Isométrica 3D Coloreada             │
│   - Categorías: Cocina, Cajoneras, Baño, Closets, Sala TV, Oficina     │
│   - Botones rápidos: [Reemplazar] y [Añadir al lado]                   │
└────────────────────────────────────────────────────────────────────────┘
```

### Componentes Involucrados:
1. `src/app/services/templates-catalog.service.ts`:
   - Corrección matemática de las 20 plantillas existentes (dimensiones, coordenadas, orientaciones y piezas faltantes).
   - Incorporación de 4 nuevas plantillas dedicadas de cajones (Cajonera 3 cajones, Cajonera 4 cajones chifonier, Cajón individual armado con caja completa, Gavetero ollero de cocina).
   - Generador de miniaturas isométricas vectoriales coloreadas con los materiales de la plantilla.
2. `src/app/components/templates-modal/`:
   - Rediseño en grid de 2 columnas (`md:grid-cols-2`).
   - Inserción de previsualización isométrica en la cabecera de cada tarjeta.
   - Pestaña y filtro específico para la categoría `cajones`.
3. `src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`:
   - Implementación del manejo de teclas `Delete` y `Backspace` en `handleViewerKeyDown`.
   - Sistema de cinemática de apertura 3D:
     - `openedPiecesState: Map<string, number>` (0 = cerrado, 1 = abierto).
     - Detección de clics en puertas y frentes de cajón para alternar apertura con interpolación suave.
     - Botón en toolbar 3D: `toggleOpenAllDoorsAndDrawers()`.
     - Matriz de transformación para rotar puertas sobre sus bisagras y deslizar cajones hacia el frente.
4. `src/app/services/project-storage.service.ts`:
   - Ampliación del catálogo de materiales por defecto con maderas nobles (Roble Miel, Nogal Terracota, Teca, Fresno), piedras (Mármol Calacatta, Granito) y tonos mate (Negro Grafito, Verde Salvia, Terracota).
5. `src/app/components/module-designer/module-designer.html`:
   - Inclusión del botón directo "Lienzo en Blanco" en la cinta superior al lado de "Plantillas de Muebles".

---

## 4. Plan de Verificación

1. **Prueba de Carga de Plantillas**:
   - Cargar secuencialmente cada una de las plantillas (Cocina, Cajoneras, Baño, Closets, Sala TV, Oficina) verificando que todas las piezas aparezcan ensambladas sin desfasajes ni piezas flotantes.
   - Probar tanto el modo "Reemplazar" como el modo "Añadir al lado" para ensamblar múltiples muebles contiguos.
2. **Prueba de Miniaturas en Catálogo**:
   - Abrir el modal de plantillas y comprobar la disposición en 2 columnas y el renderizado nítido de la miniatura isométrica en cada tarjeta.
3. **Prueba del Atajo Supr / Delete / Backspace**:
   - Seleccionar una pieza en el 3D y pulsar la tecla `Supr` o `Backspace`; verificar que la pieza se elimina y que `Ctrl+Z` la restaura.
4. **Prueba de Apertura de Puertas y Cajones**:
   - Hacer clic en una puerta para verificar su giro a 90° sobre las bisagras.
   - Hacer clic en un cajón para verificar su extracción frontal.
   - Activar el botón global "Abrir / Cerrar Todo" para verificar la apertura sincronizada de todo el mueble.
5. **Prueba de Nuevos Materiales**:
   - Aplicar los nuevos materiales (Roble Miel, Nogal, Mármol Calacatta, Negro Grafito) a las piezas y verificar su reflejo en el 3D, el desglose de piezas y el optimizador de corte.
6. **Compilación y Linteo**:
   - Ejecutar `compile_applet` y `lint_applet` para garantizar cero errores de TypeScript y AOT.
