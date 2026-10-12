# Plan de Implementación: Corrección Geométrica de Patas y Anclaje Magnético Inteligente

## 1. Contexto y Objetivos

A partir de las respuestas del usuario y la revisión del visor 3D:
1. **Alineación e Inclinación Cónica Simétrica y Uniforme**:
   - Las patas de madera escandinava/nórdica y los juegos de 4 patas presentan desalineación desde vistas cenital (desde arriba) y laterales debido al orden de rotaciones Euler (XYZ) y a que el pivote de inclinación no estaba anclado a la cota superior del plato de fijación.
   - Corregir el cálculo trigonométrico en las 4 esquinas exteriores (`Front-Left`, `Front-Right`, `Rear-Left`, `Rear-Right`) para que la inclinación cónica apunte radialmente hacia afuera de forma 100% simétrica, manteniendo la placa metálica de fijación horizontal y nivelada con la superficie de apoyo.
   - Verificar y asegurar también la geometría simétrica de las patas tipo horquilla (*hairpin*) con alas en escuadra y las cilíndricas en acero inoxidable.
2. **Imán Inteligente de Apoyo sobre Patas (Smart Magnetic Snap)**:
   - Al arrastrar una pieza (por ejemplo, la tapa o base de una mesa) en el visor 3D sobre o cerca de una pata o juego de patas, detectar la proximidad y atraer automáticamente la cara inferior de la pieza a la cota superior exacta de la pata (`legTopY = leg.position.y + leg.height`).
   - Evitar que la pieza sobrepase la pata hacia abajo (bloqueo vertical anti-penetración).
   - Proporcionar retroalimentación visual inmediata en el canvas 3D mediante una guía láser/resaltado de atracción magnética y un indicador flotante cuando el imán inteligente se engancha.

---

## 2. Cambios Propuestos

### A. Geometría y Simetría de Patas 3D (`src/app/services/appliance-3d-builder.service.ts`)
- **Pivote y Orientación de Inclinación Cónica Nórdica (`buildScandinavianMesh`)**:
  - Reestructurar el contenedor de la pata para que el pivote de inclinación se sitúe exactamente en la base de la pletina de montaje superior (`y = h - plateThickness`).
  - Calcular la inclinación radial en dirección a la diagonal de la esquina exterior correspondiente (`dx`, `dz`) sin aplicar rotaciones Euler encadenadas que distorsionen los ejes.
  - Asegurar que la placa de montaje permanezca perfectamente plana y paralela a la horizontal en `y = h`.
- **Alineación de Placas y Varillas Horquilla (`buildHairpinMesh` y `buildTableLegsSet`)**:
  - Orientar las alas en escuadra de la pletina superior hacia el interior o acorde a cada esquina del sobre de mesa.
  - Splay radial simétrico de las varillas y regatón hacia las 4 esquinas exteriores.
- **Patas Cilíndricas Inox (`buildCylindricalMesh`)**:
  - Verificar aplomo vertical estricto a 90 grados y posición precisa en las 4 esquinas.

### B. Imán Inteligente y Restricción Vertical en el Visor 3D (`src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`)
- **Detección de Patas en `applyMagneticSnapToPosition` y Arrastre de Piezas**:
  - Incluir la colección `appliances()` filtrando elementos de tipo `'table_leg'` y `'table_legs_set'`.
  - Cuando se desplaza una pieza (eje Y o plano XZ), comprobar si la proyección horizontal (X, Z) de la pieza se superpone o aproxima al perímetro de las patas.
  - Si la cara inferior de la pieza se encuentra dentro de la zona de atracción vertical de la cota superior de la pata (umbral configurable de aproximación):
    - Enganchar `posY = legTopY + movingThickness / 2`, logrando un apoyo a 0 mm exactos.
    - Prevenir que el movimiento del ratón hacia abajo hunda la pieza a través de la pata mientras permanezca sobre ella.
- **Guía Visual de Resaltado Magnético (`renderLegSnapGuides` / `clearLegSnapGuides`)**:
  - Generar un contorno/línea láser luminosa de atracción magnética en la superficie de contacto entre la pata y la pieza.
  - Mostrar un badge técnico en 3D: `🧲 Apoyo en Patas de Mesa · Cota Superior (0 mm)`.
  - Limpiar la guía automáticamente al alejar la pieza o liberar el arrastre.

---

## 3. Plan de Verificación

1. **Prueba de Compilación y Tipado**:
   - Ejecutar `compile_applet` para garantizar cero errores de compilación TypeScript/Angular.
2. **Verificación Visual de Patas en 3D**:
   - Generar un conjunto de patas cónicas de madera y observar desde vista cenital (Top) y laterales (Front, Side, Iso) comprobando simetría matemática y alineación precisa hacia las 4 esquinas.
   - Verificar patas tipo horquilla metálica y cilíndricas de acero inoxidable.
3. **Verificación de Imán Inteligente**:
   - Arrastrar un tablero horizontal sobre las patas de mesa y comprobar que se ancla magnéticamente en la cota superior sin hundirse hacia el piso.
   - Confirmar la aparición de la señal visual/resaltado de contacto magnético.
