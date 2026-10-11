# Catálogo Extendido de Acabados Arquitectónicos (Pisos y Muros 3D)

Plan para dotar al módulo de configuración de entorno 3D de un catálogo profesional y realista de acabados para pisos y paredes, inspirado en fabricantes líderes como Corona y Holztek, organizado por pestañas temáticas con renderizado procedural Three.js en tiempo real.

### User Review & Critical Decisions

> [!IMPORTANT]
> Se han incorporado las respuestas acordadas para estructurar el catálogo y maximizar la variedad estética sin comprometer el rendimiento:

- **Confirmed Decision 1 (Organización por Pestañas)**: La interfaz del selector de acabados tendrá pestañas claras de categoría para Pisos (*Porcelanatos/Cemento, Maderas, Cerámica/Mármol*) y para Paredes (*Ladrillo, Cerámica/Subway, Mármol/Piedra, Madera/Acústico*).
- **Confirmed Decision 2 (Colecciones de Piso)**: Inclusión de acabados inspirados en Corona y Holztek (Porcelanatos *Concrete Gris Pro*, *Boss Arena*, *Madrid Oro*, duelas de madera *Guayacán Miel*, *Roble Nórdico*, *Nogal Americano* y baldosas gran formato).
- **Confirmed Decision 3 (Revestimientos de Muro)**: Incorporación de ladrillo a la vista clásico y blanco decapado, baldosas *Subway/Metro* biseladas, mármol *Calacatta Gold*, salpicadero de cocina con juntas definidas y paneles de listones.
- **Open Choice (Texturas Procedurales en Canvas vs Imágenes Externas)**: Se mantiene la arquitectura de texturas generadas con HTML5 Canvas en memoria. Esto garantiza cero caídas de red, carga instantánea, mapas de relieve (*bump map*) calibrados al milímetro y compatibilidad total con la escala de la habitación sin distorsión.

---

### 1. Overview & Core Concept

- **What It Does**: Transforma el selector de pisos y paredes de una cuadrícula simple de 5 opciones fijas a un catálogo enriquecido con más de 20 acabados de alta definición distribuidos en categorías temáticas y marcas de referencia reconocidas.
- **Target Audience / Persona**: Diseñadores de cocinas, carpinteros, arquitectos de interiores y clientes finales que desean visualizar sus muebles modulares en un contexto realista idéntico a los materiales del mercado local.
- **Key Value**: Elimina la sensación de prototipo genérico; permite contrastar el color de la melamina y los herrajes contra texturas auténticas de porcelanato, ladrillo rústico, mármoles y maderas cálidas.

---

### 2. User Experience & Visual Design

- **Estructura Visual de Pestañas**:
  - En el modal/panel de **Ajustar Habitación**, la sección de materiales se optimiza con pestañas segmentadas sin saturar la pantalla.
  - Cada pestaña filtra dinámicamente las tarjetas de materiales con miniatura de textura, nombre comercial del acabado, fabricante/colección de referencia y especificación de formato (ej. 60×60 cm, 20×120 cm, biselado 10×20 cm).
- **Diseño de Tarjetas de Acabado**:
  - Miniatura circular/cuadrada con preview fiel del patrón y brillo.
  - Tipografía limpia con el nombre del modelo y etiqueta sutil de la colección (ej. *Corona Concrete ARD*, *Holztek Roble Nórdico*, *Brick Terracota Rústico*).
  - Indicador visual de selección activa con borde contrastante y check arquitectónico.
- **Interacción y Feedback**:
  - Al hacer clic en cualquier acabado, la escena 3D Three.js actualiza de inmediato el material, mapa difuso y relieve de las paredes o del suelo sin recargas ni parpadeos.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Generación Procedural Avanzada (Canvas 2D -> WebGL)**
  - *Chosen Approach*: Extender `ProceduralTextureFactory` para sintetizar con gran detalle los nuevos patrones: ladrillo visto con llagas y rugosidad, mármol con vetas doradas/grises, porcelanatos micro-granulados y duelas laminadas.
  - *Why*: Cero dependencias de servidores externos o URLs de imágenes que expiran; control total sobre la escala de repetición (`wrapS`/`wrapT`) según el tamaño real en milímetros de la habitación.
  - *Alternatives Considered*: Descargar imágenes JPG/PNG de la web; se descartó para evitar bloqueos por CORS, lentitud de red y problemas de licencia o links caídos.
- **Decision 2: Modelo de Datos Extensible en `melamine.models.ts`**
  - *Chosen Approach*: Ampliar los tipos `FloorMaterialType` y `WallMaterialType` con identificadores semánticos unívocos manteniendo retrocompatibilidad con proyectos existentes.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ModuleDesigner Component                        │
│  - roomConfig (Signal<RoomConfiguration>)                              │
│  - activeFloorTab ('all' | 'cement' | 'wood' | 'marble')               │
│  - activeWallTab ('all' | 'brick' | 'tile' | 'marble' | 'wood')        │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ emite actualizaciones
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Furniture3DViewer Component                     │
│  - updateRoomScene()                                                   │
│  - floorMesh.material  ◄─── ProceduralTextureFactory.getFloorMaterial() │
│  - wallMeshes.material ◄─── ProceduralTextureFactory.getWallMaterial()  │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ genera texturas
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       ProceduralTextureFactory                         │
│  - drawBrickWall()         (Ladrillo visto arcilla y blanco)           │
│  - drawSubwayTiles()       (Metro blanco, negro mate, esmeralda)       │
│  - drawCalacattaGold()     (Mármol blanco vetas doradas Corona)        │
│  - drawPorcelainCement()   (Concrete Gris Pro, Boss Arena)             │
│  - drawWoodDuelas()        (Guayacán Miel, Roble Nórdico, Nogal)       │
│  - drawKitchenBacksplash() (Mosaico geométrico y cuarzo)               │
└────────────────────────────────────────────────────────────────────────┘
```

#### Catálogo de Acabados a Implementar:
1. **Pisos (Floors)**:
   - *Porcelanatos y Cemento*: Concrete Gris Pro (Corona), Boss Arena (Corona), Grafito Industrial, Cemento Blanco Pulido.
   - *Maderas y Laminados*: Roble Nórdico (Holztek), Guayacán Miel (Corona), Nogal Americano Clásico, Haya Clara Escandinava.
   - *Mármol y Piedras*: Mármol Calacatta Oro (Corona), Mármol Carrara Gris, Travertino Clásico, Piedra Pizarra Negra.
2. **Muros y Salpicaderos (Walls)**:
   - *Ladrillos*: Ladrillo Visto Arcilla Rústico, Ladrillo Blanco Decapado Estilo Loft.
   - *Cerámica y Metro*: Azulejo Metro Blanco Biselado, Azulejo Metro Negro Carbón, Azulejo Esmeralda Artesanal.
   - *Mármoles y Cuarzo*: Mármol Blanco Calacatta, Cuarzo Gris Neutro Pulido.
   - *Paneles y Revestimientos*: Listones Acústicos de Roble, Cemento Encofrado Visto, Yeso Cálido Mate.
