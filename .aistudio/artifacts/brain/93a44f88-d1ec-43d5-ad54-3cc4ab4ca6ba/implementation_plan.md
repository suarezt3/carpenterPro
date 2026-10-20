# Corrección de Rieles 3D, Cinemática Telescópica y Control de Luz Lateral en Cajones

Este plan resuelve de raíz el desfase geométrico que hacía que las correderas se dibujaran por fuera de las paredes del mueble, incorpora cinemática telescópica real en 3D (perfil exterior fijo en el gabinete y perfil interior móvil con el cajón) y habilita el control de la luz lateral de corredera tanto en el Asistente Paramétrico como en la pestaña Pieza y menú contextual para cajones manuales.

## User Review & Critical Decisions

> [!IMPORTANT]
> Se han consolidado las decisiones confirmadas para garantizar precisión milimétrica de carpintería sin colisiones ni desbordes visuales en 3D:

- **Luz Lateral Configurable con Valor Automático por Riel**: En el Asistente Paramétrico y en el Asistente de Cajón Individual, la luz lateral se ajusta automáticamente al elegir el tipo de corredera (**13 mm por lado / 26 mm total** para telescópica y **5 mm por lado / 10 mm total** para oculta Tandem), permitiendo además que el usuario edite el valor en milímetros si desea personalizar la holgura.
- **Cinemática Telescópica Real al Abrir el Cajón**: Al abrir un cajón en el visor 3D, el **perfil exterior (riel de gabinete)** permanece fijo anclado a la cara interna del lateral del mueble, el **carro intermedio de rodamientos** avanza al 50% del recorrido y el **perfil interior** se desliza solidario pegado a la cara exterior del costado del cajón.
- **Soporte Completo para Cajones Manuales (Clic Derecho + Pestaña Pieza)**: Cualquier cajón armado pieza por pieza o frente individual puede configurar su tipo de corredera y su luz lateral tanto desde el **menú contextual (clic derecho en 3D)** como desde la **pestaña Pieza** del panel derecho.

---

## 1. Overview & Core Concept

- **Qué resuelve**:
  1. **Eliminación del riel por fuera del mueble**: Cuando un módulo (como la *Cajonera de 3 Cajones*) agrupa todas sus piezas bajo un mismo identificador de grupo, el buscador de costados del cajón confundía las paredes exteriores del mueble (*Lateral Izquierdo / Derecho*) con los costados internos de cada cajón (*Cajón N - Lateral Izquierdo / Derecho*). Ahora el motor identifica exclusivamente los costados internos (`drawer_box` / `drawer_lateral`) correspondientes a ese cajón específico (por prefijo de instancia o proximidad vertical en Y), excluyendo siempre las paredes estructurales del gabinete (`side_left`, `side_right`, `divider`).
  2. **Confinamiento Exacto en la Luz Lateral**: El ancho físico de la corredera en 3D se adapta exactamente a la luz disponible entre la cara exterior del costado del cajón y la cara interior del lateral del mueble (por ejemplo, 12.7 mm dentro de los 13 mm por lado), garantizando que jamás atraviese la pared del gabinete ni penetre el costado del cajón.
  3. **Profundidad y Altura Reales de la Corredera**: El largo de la corredera 3D toma la profundidad real del costado de la caja del cajón (ej. 350 mm, 400 mm, 450 mm) y se alinea con el centro vertical real del costado de la caja, en lugar de usar las dimensiones de la tapa frontal.
- **Audiencia y Valor**: Carpinteros, diseñadores y fabricantes de mobiliario en melamina que requieren validación visual 3D fiel a la instalación real en taller y medidas de corte exactas para las cajas de cajón según la holgura de la corredera elegida.

---

## 2. User Experience & Visual Design

- **Flujos de Usuario Clave**:
  1. **Creación y Edición en el Asistente Paramétrico**:
     - Al elegir el tipo de corredera (*Telescópica 45mm*, *Cierre Suave*, *Telescópica 35mm* o *Oculta Tandem*), el campo **Luz Lateral por Lado (mm)** se actualiza automáticamente (13 mm por lado = 26 mm total para telescópicas; 5 mm por lado = 10 mm total para oculta), mostrando en tiempo real el ancho exterior resultante de la caja del cajón.
     - Si el usuario modifica manualmente la luz lateral (por ejemplo, a 12 mm o 14 mm por lado), las medidas de corte de las testeras (*Contrafrente* y *Trasera Interior*) y del *Fondo MDF* se recalculan automáticamente y el visor 3D ajusta el espesor del herraje a ese espacio libre.
  2. **Apertura Interactiva en el Visor 3D**:
     - Con el cajón cerrado, los rieles quedan completamente alojados en el espacio interior de 13 mm entre la caja del cajón y las paredes del mueble (cero piezas sobresaliendo por fuera).
     - Al hacer clic sobre la manija o abrir el cajón, la caja y su perfil interior avanzan hacia adelante mientras el riel exterior permanece fijo en la pared interna del gabinete y el patín intermedio acompaña a media carrera, igual que una corredera telescópica real.
  3. **Cajones Creados Manualmente (Pestaña Pieza y Clic Derecho)**:
     - Al seleccionar cualquier pieza de un cajón manual (o un frente de cajón) y abrir la **pestaña Pieza** o dar **clic derecho en 3D**, el usuario puede elegir el **Tipo de Corredera (Riel)** y definir la **Luz Lateral (mm por lado)**; si el cajón tiene costados y testeras asociados, el sistema ofrece ajustar automáticamente su separación lateral para respetar la luz indicada sin solapamiento.
- **Identidad Visual y Estética**:
  - **Dirección Estética**: Precisión técnica CAD industrial limpia y legible.
  - **Paleta y Superficies**: Controles en tonos neutros técnicos (`slate-50`, `slate-800`, bordes sutiles `border-slate-200`) con acentos en azul cobalto (`sky-600` / `indigo-600`) para controles activos y lectura numérica monoespaciada (`tabular-nums`).
  - **Renderizado 3D PBR**: Acero galvanizado/satinado (`#94a3b8` / `#e2e8f0`) para los tres perfiles telescópicos escalonados, pistón hidráulico azul técnico (`#0284c7`) en correderas cierre suave y clips frontales naranjas (`#ea580c`) en correderas ocultas bajo cajón.

---

## 3. Key Product Decisions & Trade-Offs

- **Decisión 1: Separación de Mallas 3D en Riel Fijo (Gabinete) y Riel Móvil (Cajón)**
  - *Enfoque Elegido*: Dividir la geometría 3D de la corredera en componentes con cinemática diferenciada: el perfil interior va unido al desplazamiento del cajón (100% del avance `curOpen`), el carro intermedio de balines compensa su desplazamiento al 50% (`-0.5 * curOpen`), y el perfil exterior del gabinete compensa el 100% (`-1.0 * curOpen`) para permanecer inmóvil respecto a la pared del mueble.
  - *Por qué*: Evita que el riel entero salga "flotando en el aire" cuando se abre el cajón y reproduce fielmente la mecánica telescópica de 3 cuerpos sin alterar el sistema de selección ni de explosión de piezas.
  - *Alternativas Consideradas*: Anclar el perfil exterior al mesh del lateral del mueble fue descartado porque en cajones individuales o manuales sin gabinete exterior el riel perdería su referencia; compensar la traslación dentro del grupo de la corredera funciona tanto con gabinete como en cajones independientes.
- **Decisión 2: Algoritmo de Vinculación Estricta entre Frente, Costados de Caja y Paredes del Mueble**
  - *Enfoque Elegido*: Filtrar estrictamente los candidatos a costados de cajón exigiendo que **no** tengan rol estructural de gabinete (`side_left`, `side_right`, `divider`, `top`, `bottom`, `plinth`, `back`), y emparejarlos con su Frente de Cajón mediante: (1) coincidencia exacta de prefijo de cajón (`_caj1_`, `_caj2_`, `grp_caj_`), o (2) en cajones manuales, coincidencia de nivel vertical (`posY`) y contención horizontal dentro del ancho del frente (`minX > frontMinX` y `maxX < frontMaxX`).
  - *Por qué*: Garantiza que jamás se seleccione una pared exterior del mueble como si fuera el costado del cajón, tanto en cajoneras de múltiples gavetas como en muebles creados pieza por pieza.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Diagrama de Arquitectura y Geometría de Correderas

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   SECCIÓN TRANSVERSAL HORIZONTAL (EJE X)                   │
│                                                                            │
│  ┌──────────┐  ◄─ Luz Lateral ─►  ┌──────────┐              ┌──────────┐   │
│  │ Lateral  │  (ej. 13mm / lado)  │ Costado  │              │ Costado  │   │
│  │  Mueble  │ ┌─────┬─────┬─────┐ │  Cajón   │   Interior   │  Cajón   │   │
│  │   Izq    │ │Perf.│Carro│Perf.│ │   Izq    │   Gaveta     │   Der    │   │
│  │  (15mm)  │ │Fijo │50%  │Móvil│ │  (15mm)  │              │  (15mm)  │   │
│  └──────────┘ └─────┴─────┴─────┘ └──────────┘              └──────────┘   │
│       ▲                ▲                ▲                                  │
│  Cara Interna    Corredera 3D     Cara Externa                             │
│    Gabinete     (Confinada 100%    Caja Cajón                              │
│                  en la luz libre)                                          │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                      FLUJO DE DATOS Y SINCRONIZACIÓN                       │
│                                                                            │
│  ┌──────────────────────────┐       ┌───────────────────────────────────┐  │
│  │ Asistente Paramétrico /  │       │ Pestaña Pieza / Menú Clic Derecho │  │
│  │ Asistente Cajón Indiv.   │       │ (Cajones Manuales o Individuales) │  │
│  │ - Tipo de Riel           │       │ - Asignar Rol Frente de Cajón     │  │
│  │ - Luz Lateral (mm/lado)  │       │ - Cambiar Riel y Luz Lateral (mm) │  │
│  └────────────┬─────────────┘       └─────────────────┬─────────────────┘  │
│               │                                       │                    │
│               ▼                                       ▼                    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │           Generador de Módulos y Almacenamiento de Proyecto          │  │
│  │  - Descuento exacto: Ancho Caja = Ancho Interno - (2 × Luz Lateral)  │  │
│  │  - Persistencia de slideClearancePerSide en Config y HardwareConfig  │  │
│  └────────────┬───────────────────────────────────────┬─────────────────┘  │
│               │                                       │                    │
│               ▼                                       ▼                    │
│  ┌───────────────────────────────────┐   ┌──────────────────────────────┐  │
│  │   Visor 3D (Three.js)             │   │ Motor de Uniones Sistema 32  │  │
│  │ - Emparejamiento exacto a         │   │ - Perforaciones Ø5mm en la   │  │
│  │   costados internos de cada cajón │   │   cara interna del lateral   │  │
│  │ - Riel fijo (0%) / Carro (50%) /  │   │   alineadas al eje Y real    │  │
│  │   Perfil cajón (100% apertura)    │   │   de la corredera            │  │
│  └───────────────────────────────────┘   └──────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Modelo de Datos y Estado

- **Configuración de Herraje por Pieza (`PartHardwareConfig`)**:
  - Se añade la propiedad opcional `slideClearancePerSide?: number` (en mm por lado; por defecto `13` mm para correderas telescópicas y `5` mm para ocultas Tandem) y `slideLength?: number` para cajones manuales.
- **Configuración Paramétrica de Módulo (`ParametricCabinetConfig`)**:
  - Se añade `slideClearancePerSide?: number` (mm de luz entre cada costado del cajón y la pared interna del mueble), sincronizado automáticamente al cambiar `slideType` pero editable manualmente en el Asistente.

### Mapeo de Componentes Interactivos y Manejadores

1. **Asistente Paramétrico de Módulos y Cajoneras**:
   - Selector de **Luz por Lado (mm)** junto al selector de Tipo de Corredera (con presets rápidos `13 mm Estándar (26mm total)`, `12.7 mm (1/2")`, `5 mm Oculta Tandem` y entrada numérica libre de `3` a `30` mm).
   - Al reconstruir un módulo existente (`Editar Módulo`), lee la luz lateral real existente entre el lateral del mueble y el costado del cajón para preservar cualquier ajuste personalizado.
2. **Pestaña Pieza (Inspector Lateral) y Menú Contextual 3D (Cajones Manuales e Individuales)**:
   - En la sección de Herrajes y Movimiento de la pestaña Pieza (y en el submenú de Corredera del clic derecho), cuando la pieza es un frente o parte de un cajón:
     - Permite seleccionar el tipo de corredera (*Telescópica 45mm*, *Cierre Suave*, *Telescópica 35mm*, *Oculta Tandem*, *Sin corredera*).
     - Permite ajustar la **Luz Lateral por Lado (mm)**; si el cajón cuenta con costados y testeras (ya sea en grupo o manuales en la misma cota vertical), recalcula y ajusta automáticamente la posición X de los costados del cajón y el largo de sus testeras/fondo para mantener exactamente esa luz respecto a las paredes del mueble sin solapamientos.
3. **Renderizador 3D de Correderas y Cinemática Telescópica**:
   - **Búsqueda de Costados**: Filtra `drawerLatIzq` y `drawerLatDer` exigiendo el mismo prefijo de cajón (`_caj1_`, `_caj2_`, etc.) o, en cajones manuales, piezas con rol/nombre de costado de cajón en la misma franja vertical (`posY`) situadas estrictamente por dentro del frente (`minX > frontMinX + 5` y `maxX < frontMaxX - 5`), descartando siempre cualquier `side_left` o `side_right` del mueble.
   - **Geometría y Confinamiento**:
     - En correderas telescópicas laterales, el conjunto del riel se posiciona exactamente en el intersticio `[drawerSideOuterFace, drawerSideOuterFace ± clearancePerSide]`, centrado en el eje Y del costado de la caja (`drawerLat.posY`) y desde el borde frontal del costado hacia atrás con la longitud exacta del costado (`drawerLat.length`).
     - En correderas ocultas (*Undermount Tandem*), los rieles se alojan debajo del fondo del cajón, pegados a la cara interna inferior de los costados del cajón, completamente invisibles desde el exterior del gabinete.
   - **Animación Telescópica**: Durante el bucle de animación `updateOpeningAnimations`, el desplazamiento de apertura `offset = cur * maxSlide` mueve el cajón completo, mientras los sub-grupos `outerRail` y `midCarriage` de cada corredera actualizan su posición local en `-offset` y `-offset * 0.5` respectivamente, logrando el efecto telescópico real donde el riel del mueble nunca se despega del gabinete.
4. **Motor de Perforaciones Sistema 32**:
   - Actualiza la altura `slideY` de las perforaciones `slide_system32` en la cara interior de los laterales del mueble para que coincidan exactamente con el eje vertical real de la corredera de cada cajón.
