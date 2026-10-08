# Plan de Corrección: Ensamble 3D de Cajones Modulares y Eliminación de Colisiones

Corregiremos la geometría y posición milimétrica de todas las piezas generadas por el Asistente de Cajón Modular para que se arme una caja limpia, perfectamente escuadrada y sin colisiones en el visor 3D.

---

## 1. Corrección de Orientación de Laterales en Visor 3D (`vertical_yz`)

### Problema Identificado:
- Al procesar piezas con orientación `vertical_yz`, el visor asignaba `sy = length` (450 mm) y `sz = width` (140 mm). Como el largo de la corredera es 450 mm y la altura de la caja es 140 mm, los laterales se renderizaban como placas verticales gigantes de 450 mm de altura penetrando el fondo y el mueble.

### Solución en `src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`:
- En la conversión a caja 3D (`sx, sy, sz`), identificar piezas de cajón (`drawer_box` o con rol/nombre lateral de cajón):
  ```typescript
  if (orient === 'vertical_yz') {
    const isDrawerLateral = part.componentRole === 'drawer_box' || 
      (part.name.toUpperCase().includes('LATERAL') && (part.name.toUpperCase().includes('CAJ') || !!part.groupId));
    if (isDrawerLateral && L > W) {
      sx = t; // Espesor 15 mm en eje X
      sy = W; // Altura real de la caja (ej. 140 mm en eje Y)
      sz = L; // Profundidad de corredera (ej. 450 mm en eje Z)
    } else {
      sx = t;
      sy = L;
      sz = W;
    }
  }
  ```
- Replicar esta misma fórmula en `src/app/services/joinery-engine.service.ts` para que la detección de colisiones e interferencias no arroje falsos positivos.

---

## 2. Ensamble de Taller Sin Colisiones (Fondo por debajo)

### Solución en `src/app/services/project-storage.service.ts` (`addParametricDrawer`):
- **Fondo de MDF 3 mm (Base):**
  - Ubicado en la cota inferior:
    `posY = basePosY + (bottomThickness / 2)` (cubre desde `basePosY` hasta `basePosY + 3mm`).
    `posZ = basePosZ`
    `length = boxWidth`, `width = boxLen`
- **Laterales, Contra-frente y Trasera (Caja de 15 mm):**
  - Asientan **exactamente encima** del fondo, comenzando en `basePosY + bottomThickness`:
    `posY = basePosY + bottomThickness + (boxHeight / 2)` (desde `basePosY + 3mm` hasta `basePosY + 3mm + 140mm`).
  - **Laterales:**
    - Izquierdo: `posX = basePosX - (boxWidth / 2) + (t / 2)`, `posZ = basePosZ`.
    - Derecho: `posX = basePosX + (boxWidth / 2) - (t / 2)`, `posZ = basePosZ`.
  - **Contra-frente Interior:**
    - Ajustado entre los dos laterales: `posX = basePosX`, `posZ = basePosZ + (boxLen / 2) - (t / 2)`.
  - **Trasera Interior:**
    - Ajustada entre los dos laterales: `posX = basePosX`, `posZ = basePosZ - (boxLen / 2) + (t / 2)`.
  - **Frente Exterior Solapado (Visto):**
    - Adosado al frente de la caja en `+Z`:
      `posX = basePosX`, `posZ = basePosZ + (boxLen / 2) + (t / 2)`.
      `posY = basePosY + bottomThickness + (boxHeight / 2)` (centrado respecto a la caja).

---

## 3. Correderas Telescópicas Adosadas a los Laterales

### Solución en `furniture-3d-viewer.ts`:
- Ubicar las correderas telescópicas exactamente sobre las caras exteriores de los laterales del cajón (`posX = ±(boxWidth / 2)`), extendiéndose a lo largo de los 450 mm de profundidad.
- Garantizar que al tener piezas modulares separadas (`hasSeparateBoxParts`), el frente exterior no genere una caja falsa interna redundante.

---

## 4. Verificación y Validación
1. Compilar con `compile_applet` y validar sintaxis con `lint_applet`.
2. Crear un cajón con medidas por defecto en el asistente.
3. Verificar visualmente en 3D que los laterales estén en posición horizontal correcta (140 mm de alto, 450 mm de fondo).
4. Comprobar que no haya piezas en rojo (cero colisiones).
5. Probar la apertura/cierre interactiva y el control deslizante.
