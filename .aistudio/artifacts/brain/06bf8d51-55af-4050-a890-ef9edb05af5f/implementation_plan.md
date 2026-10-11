# Imán Inteligente de Paredes Interiores para Piezas, Grupos, Muebles y Equipos 3D

Sistema unificado de adherencia magnética perimétrica hacia las caras internas de los muros arquitectónicos (muro posterior y muro en escuadra en L), asegurando alineación precisa de piezas individuales, conjuntos/grupos, muebles completos y electrodomésticos con un umbral de proximidad de 30 mm y guía visual luminosa interactiva.

### User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones Confirmadas con el Usuario en la Fase de Clarificación:**
> - **Tipo de Alineación:** Pegar la cara trasera del elemento al muro manteniendo su rotación actual (sin forzar giros arbitrarios).
> - **Sensibilidad y Umbral:** Imán suave de precisión fina a **30 mm de distancia**. Se adhiere al aproximarse a menos de 30 mm y se desengancha limpiamente al mover el cursor hacia afuera.
> - **Feedback Visual en 3D:** Línea guía sutil y resplandor perimétrico iluminado sobre la cara interna del muro activo cuando la adherencia magnética entra en contacto.

---

### 1. Overview & Core Concept

- **Qué hace:** Proporciona un motor de cálculo magnético común que detecta las caras interiores de las paredes de la habitación (`mainWall` en el plano posterior Z y `sideWall` en el plano lateral X) durante cualquier operación de arrastre en 3D.
- **Elementos Soportados:**
  1. **Piezas Individuales:** Al arrastrar directamente una melamina sobre la escena o al desplazarla con el manipulador.
  2. **Conjuntos de Piezas (Grupos / Multiselección):** Al arrastrar un grupo de piezas (ej. un cajón completo, módulos de estantes o gabinetes seleccionados), el bounding box colectivo calcula su plano trasero y lo ajusta al milímetro contra el muro.
  3. **Muebles Completos:** Al mover el cuerpo total del mueble en modo habitación (`workspaceMode = 'room'`).
  4. **Equipos y Electrodomésticos:** Neveras, campanas, hornos, lavaplatos, cocinas y microondas se adhieren al ras de la cara interior de la pared sin incrustarse dentro del espesor constructivo del muro.
- **Beneficio Principal:** Elimina la necesidad de calcular manualmente espesores de pared o posicionamientos milimétricos en X y Z; los elementos se acoplan de forma natural, exacta y visualmente clara contra la pared.

---

### 2. User Experience & Visual Design

- **Flujo de Interacción:**
  1. El usuario hace clic sobre una pieza, grupo o electrodoméstico y lo arrastra libremente en el espacio 3D.
  2. Al aproximar la cara trasera o el borde del objeto a menos de 30 mm de la cara interior del muro (posterior o lateral), el objeto "salta" suavemente y queda pegado al ras de la superficie interior.
  3. En ese instante, se activa una **guía visual luminosa (laser snap line)** en color cian/esmeralda sutil sobre la línea de contacto del muro, acompañada por un resplandor translúcido elegante en el muro activo.
  4. Si el usuario continúa moviendo el ratón alejándose más de 30 mm, el objeto se desengancha de inmediato, volviendo al arrastre libre y apagando la guía visual.
  5. Al soltar el botón del ratón, la posición final queda consolidada con precisión milimétrica.

```
Arrastre libre (cursor) ---> [Distancia <= 30 mm] ---> Imán activo + Línea guía sutil
                                                       │
                                                       ├── Cara trasera pegada al ras
                                                       └── Desenganche al alejar cursor
```

- **Estética & Motion:**
  - Línea guía de contacto con grosor controlado y sutil pulso de opacidad.
  - Indicador de distancia mínima (ej. `Muro Posterior · 0 mm`) para confirmación visual sin estorbar la perspectiva de trabajo.

---

### 3. Key Product Decisions & Trade-Offs

- **Cálculo de la Cara Interna del Muro:**
  - *Enfoque:* La cara frontal interior del muro posterior se ubica con precisión en $Z_{\text{inner}} = \text{wallOffsetZ} + \text{wallThickness}$ (considerando zócalo de 16 mm si está activo). La cara interior del muro lateral en L se ubica en $X_{\text{inner}} = \text{wallOffsetX} + \text{wallThickness}$.
  - *Por qué:* El código previo en ciertas secciones dividía erróneamente el espesor por 2, provocando que los objetos quedasen metidos dentro del tabique. La corrección geométrica garantiza que queden exactamente a ras.
- **Bounding Box Dinámico Orientado:**
  - *Enfoque:* Para cualquier conjunto de piezas o electrodoméstico con rotación, se calcula su envolvente tridimensional exterior mínima y máxima para obtener el punto de contacto más atrasado.
  - *Alternativas Consideradas:* Forzar la rotación del mueble a 0° o 90° automáticamente. Se descartó porque el usuario prefirió mantener la orientación actual establecida.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────┐
│               Furniture 3D Viewer                      │
│                                                        │
│  ┌────────────────────────┐  ┌──────────────────────┐  │
│  │   Direct Drag Engine   │  │ Appliance Drag Eng.  │  │
│  │  (Parts / Groups)      │  │ (Kitchen Appliances) │  │
│  └───────────┬────────────┘  └──────────┬───────────┘  │
│              │                          │              │
│              ▼                          ▼              │
│  ┌──────────────────────────────────────────────────┐  │
│  │      Smart Wall Snap Calculation Engine          │  │
│  │  - Back Wall Inner Face (Z = offsetZ + thickness)│  │
│  │  - Side Wall Inner Face (X = offsetX + thickness)│  │
│  │  - 30 mm Proximity Threshold                     │  │
│  └──────────────────────────┬───────────────────────┘  │
│                             │                          │
│                             ▼                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │          Snap Visual Feedback Manager            │  │
│  │  - Dynamic Laser Guideline Mesh (Cyan/Emerald)   │  │
│  │  - Active Wall Contact Highlight                 │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

#### Plan de Modificaciones:

1. **Motor Central de Imán de Muros (`calculateWallSnap`):**
   - Implementar un método reutilizable en `Furniture3dViewerComponent` que reciba los límites o dimensiones del elemento (minX, maxX, minZ, maxZ, posición actual) y devuelva:
     - Posición corregida en X y Z si está a $\le 30\text{ mm}$ de cualquiera de los muros internos.
     - Bandera booleana indicando si el imán posterior o lateral está activo.
     - Puntos 3D de la línea de contacto para el feedback visual.

2. **Integración en Arrastre de Piezas y Conjuntos de Piezas (`onPointerMove`):**
   - En el arrastre directo de pieza individual (`this.dragInitialPart`), aplicar el imán de muro además del imán entre piezas.
   - En el arrastre directo de grupos de piezas / multiselección (`this.dragInitialParts.length > 1`), calcular la caja envolvente de todo el conjunto y aplicar el imán al bloque rígido completo.

3. **Integración en Electrodomésticos y Equipos (`isApplianceDragging`):**
   - Corregir el cálculo de la cara interna del muro posterior ($Z_{\text{inner}} = \text{wallOffsetZ} + \text{wallThickness} + \text{halfDepth}$) y lateral ($X_{\text{inner}} = \text{wallOffsetX} + \text{wallThickness} + \text{halfWidth}$).
   - Reemplazar el umbral fijo por 30 mm con desenganche dinámico.

4. **Feedback Visual de Resplandor y Línea Guía:**
   - Crear un grupo Three.js dedicado (`wallSnapGuideGroup`) que dibuje una línea luminosa sutil (resplandor cian) a lo largo del muro en la zona de contacto cuando el imán esté adherido.
   - Limpiar automáticamente las guías cuando el elemento se aleje o al soltar el ratón (`onPointerUp`).

5. **Verificación y Compilación:**
   - Ejecutar `compile_applet` para asegurar cero errores de tipos o sintaxis.
