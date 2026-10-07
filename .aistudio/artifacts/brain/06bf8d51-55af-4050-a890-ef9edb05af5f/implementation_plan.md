# Catálogo de 20 Plantillas Profesionales de Muebles y Reorganización del Buscador de Documentación

Plan de implementación integral para eliminar la cinta horizontal redundante en el modal de documentación, situar el buscador interactivo directamente sobre la columna lateral izquierda con scroll vertical, e incorporar una biblioteca profesional de 20 plantillas completas de muebles organizadas en 5 categorías (Cocina, Baño, Closets, Sala TV, Oficina) con opciones para reemplazar el diseño actual o añadir junto a él en el espacio 3D.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> A continuación se resumen las decisiones confirmadas basadas en tus respuestas:
> - **Reorganización del Modal de Ayuda**: Se elimina la cinta horizontal superior de categorías/buscador para evitar duplicidades. La barra de búsqueda se coloca en la parte superior del panel lateral izquierdo, permitiendo escribir y buscar en tiempo real en títulos, atajos y pasos detallados con scroll vertical de todas las guías.
> - **Catálogo de 20 Plantillas Reales**: Creación de 20 modelos prediseñados de piezas reales y funcionales divididas en: **Cocina (5)**, **Baño (3)**, **Closets y Dormitorio (5)**, **Sala TV (4)** y **Oficina (3)**.
> - **Acción de Carga**: Modal interactivo de selección con vista previa donde el usuario puede elegir entre **Reemplazar el diseño actual** o **Añadir junto al diseño actual** en el visor 3D.

---

### 1. Overview & Core Concept

- **Qué hace**:
  1. **Buscador y Navegación Lateral de Ayuda**: Rediseño del modal de documentación con una barra de búsqueda dedicada y enfocable directamente sobre la lista vertical lateral izquierda, con scroll suave y filtrado instantáneo que busca en nombres de herramientas, pasos operativos y atajos.
  2. **Biblioteca de 20 Plantillas de Muebles**: Sustituye las 2 plantillas genéricas por una colección completa de 20 muebles estándar de carpintería y fabricación en melamina con dimensiones reales, cálculo de fajas, zócalos, fondos, repisas y puertas.
  3. **Selector Modal de Plantillas**: Nueva interfaz visual con filtros por categoría (Cocina, Baño, Closet, Sala TV, Oficina), fichas de dimensiones ($L \times H \times P$), conteo de piezas y botones para cargar limpio o insertar contiguo.

- **Público Objetivo**: Carpinteros, diseñadores de interiores y fabricantes que necesitan partir de muebles base reales para acelerar su diseño y consultar guías rápidas sin fricciones en la interfaz.

---

### 2. User Experience & Visual Design

#### 2.1. Modal de Documentación Rediseñado
- **Sin cinta superior redundante**: Se elimina la barra horizontal que duplicaba las pestañas.
- **Buscador en cabecera lateral**: Campo de texto amplio con icono, placeholder claro, foco automático y botón de limpieza inmediata.
- **Lista lateral vertical scrollable**: Todas las guías apiladas con sus iconos temáticos, badges de color y títulos en alto contraste.
- **Panel de lectura principal**: Al seleccionar cualquier guía o buscar, el panel derecho muestra la ficha técnica, pasos explicados y consejos de taller.

#### 2.2. Catálogo de 20 Plantillas de Muebles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CATÁLOGO DE PLANTILLAS PROFESIONALES                    │
│   [ Todos (20) ]  [ Cocina (5) ]  [ Baño (3) ]  [ Closets (5) ]  ...       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐  │
│  │ Bajo Mesada 2P + Caj  │  │ Alacena Aérea 2P      │  │ Torre Calientes │  │
│  │ 1200 x 850 x 600 mm   │  │ 800 x 700 x 320 mm    │  │ 600x2100x600 mm │  │
│  │ [8 piezas] [Cocina]   │  │ [6 piezas] [Cocina]   │  │ [10 pzs] [Cocina]  │
│  │ [Reemplazar] [+Añadir]│  │ [Reemplazar] [+Añadir]│  │ [Reemplazar]... │  │
│  └───────────────────────┘  └───────────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Lista Detallada de las 20 Plantillas:
1. **Cocina**:
   - `cocina_bajo_mesada_120`: Bajo Mesada 2 Puertas + 3 Cajones ($1200 \times 850 \times 600\text{ mm}$).
   - `cocina_alacena_80`: Alacena Aérea 2 Puertas con Repisa Interna ($800 \times 700 \times 320\text{ mm}$).
   - `cocina_torre_horno`: Torre Despensero para Microondas y Horno ($600 \times 2100 \times 600\text{ mm}$).
   - `cocina_esquinero_l`: Mueble Esquinero en L para Cocina ($900 \times 850 \times 900\text{ mm}$).
   - `cocina_isla_desayunador`: Isla Central con Barra Desayunadora y Estantes ($1500 \times 900 \times 800\text{ mm}$).
2. **Baño**:
   - `bano_vanitory_cajon`: Vanitory Flotante con Cajón y Hueco Inferior ($700 \times 550 \times 450\text{ mm}$).
   - `bano_gabinete_espejo`: Gabinete Aéreo con Puertas de Espejo ($600 \times 650 \times 160\text{ mm}$).
   - `bano_columna_auxiliar`: Columna Torre de Baño Estrecha ($350 \times 1600 \times 300\text{ mm}$).
3. **Closets y Dormitorio**:
   - `closet_ropero_2cuerpos`: Closet 2 Cuerpos con Maletero, Perchero y Zapatero ($1600 \times 2200 \times 550\text{ mm}$).
   - `dormitorio_comoda_4cajones`: Cómoda / Chifonier de 4 Cajones ($800 \times 950 \times 450\text{ mm}$).
   - `dormitorio_mesa_noche`: Mesa de Noche / Buró 2 Cajones ($450 \times 550 \times 400\text{ mm}$).
   - `dormitorio_zapatero_inclinado`: Mueble Zapatero Vertical ($700 \times 1200 \times 350\text{ mm}$).
   - `dormitorio_cabecero_repisas`: Cabecero de Cama con Nichos y Repisas ($1600 \times 1000 \times 200\text{ mm}$).
4. **Sala y TV**:
   - `sala_rack_tv_panel`: Rack Flotante para TV de 65" con Panel Alistonado ($1800 \times 1400 \times 350\text{ mm}$).
   - `sala_mesa_centro`: Mesa de Centro Rectangular con Revistero ($900 \times 420 \times 550\text{ mm}$).
   - `sala_biblioteca_5niveles`: Biblioteca Modular de 5 Niveles ($800 \times 1800 \times 300\text{ mm}$).
   - `sala_aparador_buffet`: Aparador Buffet 3 Puertas ($1400 \times 800 \times 400\text{ mm}$).
5. **Oficina y Estudio**:
   - `oficina_escritorio_l`: Escritorio Gerencial en L con Cajonera ($1400 \times 750 \times 1200\text{ mm}$).
   - `oficina_home_office`: Escritorio Home Office con Repisa Aérea ($1000 \times 750 \times 500\text{ mm}$).
   - `oficina_archivador_movil`: Cajonera Rodante de 3 Cajones ($450 \times 650 \times 500\text{ mm}$).

---

### 3. Key Product Decisions & Trade-Offs

- **Decisión 1: Eliminar la cinta superior y anclar el buscador en el panel lateral izquierdo**
  - *Enfoque*: Quitar el carrusel superior horizontal de botones que ocupaba espacio vertical y comprimía el campo de búsqueda. Colocar el input de búsqueda en la cabecera de la columna izquierda con ancho del 100%.
  - *Por qué*: Resuelve directamente el problema reportado por el usuario donde el botón de búsqueda no se podía escribir bien y simplifica la navegación en una sola lista vertical scrollable.

- **Decisión 2: Servicio Centralizado de Plantillas (`templates-catalog.service.ts`)**
  - *Enfoque*: Crear un servicio dedicado que genera las piezas exactas con materiales, vetas, cantos y posiciones en 3D para las 20 plantillas.
  - *Por qué*: Mantiene el código desacoplado, modular y permite reutilizar las plantillas tanto desde el botón de la barra superior como desde el modal interactivo de modulación.

- **Decisión 3: Modo "Reemplazar" o "Añadir al lado (+X)"**
  - *Enfoque*: Cuando el usuario selecciona "Añadir", el sistema calcula el desplazamiento en X (offset de $+100\text{ mm}$ después de la pieza más a la derecha del mueble actual) y genera nuevos IDs únicos para que ambos módulos coexistan en el mismo visor 3D.
  - *Por qué*: Permite armar cocinas o habitaciones completas combinando varios módulos prediseñados (ej. Bajo mesada + Alacena + Torre).

---

### 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MODULE DESIGNER / HEADER                           │
│   [ Plantillas de Mueble (20) ] ──────► Abre TemplatesCatalogModalComponent │
└──────────────────────┬──────────────────────────────────┬───────────────────┘
                       │                                  │
                       ▼                                  ▼
        ┌─────────────────────────────┐    ┌──────────────────────────────────┐
        │  TemplatesCatalogService    │    │  DocumentationModalComponent     │
        │  - 20 presets paramétricos  │    │  - Buscador integrado lateral izq│
        │  - Cocina, Baño, Closets,   │    │  - Scroll vertical unificado     │
        │    Sala TV, Oficina         │    │  - Búsqueda en pasos y atajos    │
        │  - Offset 3D para "+Añadir" │    └──────────────────────────────────┘
        └─────────────────────────────┘
```

#### Archivos Clave a Modificar / Crear:
1. `src/app/services/templates-catalog.service.ts`: Modelado dimensional de las 20 plantillas completas con roles de pieza y cantos PVC.
2. `src/app/components/templates-modal/templates-modal.ts` y `.html`: Modal interactivo de catálogo con tarjetas, vistas de dimensiones, filtros de categoría y botones "Cargar" o "Añadir (+)".
3. `src/app/components/module-designer/module-designer.ts` y `.html`: Conectar el botón de plantillas al nuevo modal de catálogo.
4. `src/app/components/documentation-modal/documentation-modal.html` y `.ts`: Reorganizar el buscador eliminando la cinta superior y colocándolo sobre la columna izquierda con scroll vertical.
