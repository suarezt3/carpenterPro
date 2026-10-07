# Plan de Implementación: Catálogo sin Miniaturas, Corrección de Plantillas y Cuadrícula CAD Compacta

Eliminación de las miniaturas SVG del catálogo de plantillas para un diseño limpio y rápido, corrección exhaustiva de las coordenadas de las plantillas (especialmente puertas flotantes de organizador sobre inodoro y colisión de cajones en gavetero ollero), y compactación de los paneles de "Posición 3D" y "Dimensiones de Corte" en una cuadrícula CAD de 3 columnas sin desbordamiento.

## Decisiones Críticas y Preferencias del Usuario

> [!IMPORTANT]
> Decisiones confirmadas a través del diálogo interactivo:
> - **Catálogo de Plantillas**: Se retiran por completo las miniaturas SVG que no se veían bien. Las tarjetas del catálogo se rediseñan con una cabecera limpia, icono temático distintivo en contenedor estilizado, insignias de categoría, medidas destacadas en milímetros y botones de acción directos.
> - **Campos de Posición 3D y Dimensiones de Corte**: Se reemplaza el diseño anterior (que tenía botones -50, -10, +10, +50 en cada fila causando desbordamiento horizontal en la bandeja lateral) por una **cuadrícula compacta de 3 columnas tipo software CAD** (X, Y, Z y Largo, Ancho, Espesor) con inputs numéricos estilizados, etiquetas claras y botones de alineación rápida.
> - **Corrección de Plantillas de Muebles**: Se corrigen las coordenadas de todas las plantillas que presentaban desfasajes o colisiones (puertas flotando en el aire en el organizador sobre inodoro, colisión del piso con la gaveta inferior en el gavetero ollero de cocina, y cotas de todas las plantillas).

---

## 1. Visión General de los Cambios

### ¿Qué soluciona esta actualización?
1. **Remoción de Miniaturas SVG**: Eliminar el componente y las vistas previas SVG de las tarjetas del catálogo. Reemplazarlas por tarjetas limpias de 2 columnas con tipografía de alto contraste, dimensiones resaltadas e icono temático.
2. **Corrección de Puertas Flotantes (`bano_sobre_inodoro`)**: Corregir las dimensiones y posición de las puertas del organizador sobre inodoro. El error se originaba en la inversión de largo y ancho en la orientación `vertical_xy`, haciendo que las puertas tuvieran 490 mm de ancho en lugar de 304 mm y aparecieran desubicadas a Y=1400. Se ajustan a `length: 304, width: 490, posY: 1150` para cerrar el vano entre 900 mm y 1400 mm de manera perfecta.
3. **Corrección de Colisiones en Cajones (`cocina_gavetero_ollero`)**: Corregir las cotas de la gaveta inferior para que no intercepte el piso de 18 mm (`posY: 89`), ubicando la gaveta inferior a `posY: 277` y la superior a `posY: 632`, eliminando la alerta de colisión en rojo.
4. **Auditoría Matemática Integral de las 26 Plantillas**: Verificar todas las plantillas para asegurar que no existan piezas flotantes, vanos desfasados ni colisiones espaciales.
5. **Rediseño Ultracompacto de "Dimensiones de Corte" y "Posición 3D" en la Bandeja**:
   - Sustituir las filas con múltiples botones `-50 / -10 / +10 / +50` que desbordaban la barra lateral.
   - Implementar cuadrícula CAD de 3 columnas: `[ Eje X ] [ Eje Y ] [ Eje Z ]` y `[ Largo ] [ Ancho ] [ Espesor ]` con inputs numéricos directos y botones de centrado/suelo abajo.

---

## 2. Experiencia de Usuario y Diseño Visual

### A. Catálogo de Plantillas Rediseñado (Sin Miniaturas)
- **Cabecera de Tarjeta**: Contenedor con icono temático según la categoría (`countertops`, `table_rows`, `inventory_2`, `door_sliding`, `desk`, etc.), nombre del mueble en negrita, insignia de categoría y contador de piezas.
- **Medidas Destacadas**: Cinta milimétrica destacada en negrita (`700 ancho × 550 alto × 450 prof mm`).
- **Descripción Concisa**: Texto explicativo sin saturación visual.
- **Botones de Acción**: Botón ámbar "Reemplazar" y botón oscuro "Añadir al lado".

### B. Bandeja Lateral CAD (Sin Desbordamientos)
- **Dimensiones de Corte (mm)**:
  - Cuadrícula compacta de 3 columnas (`Largo`, `Ancho`, `Espesor`) que cabe cómodamente incluso en barras laterales estrechas de 280-320 px.
- **Posición 3D en Milímetros**:
  - Cuadrícula compacta de 3 columnas con colores identificadores CAD estándar:
    * **Eje X (Rojo)**: Izquierda / Derecha
    * **Eje Y (Verde)**: Altura / Elevación del suelo
    * **Eje Z (Azul)**: Profundidad adelante / atrás
  - Botones inferiores compactos: `[ Al Suelo ]`, `[ Centrar X ]`, `[ Centrar Z ]`.

---

## 3. Plan de Modificaciones Técnicas

### Archivos a Modificar:
1. `src/app/components/templates-modal/templates-modal.html`:
   - Eliminar `<app-template-thumbnail>`.
   - Reestructurar el cuerpo de cada tarjeta del catálogo hacia el diseño limpio con cabecera de icono, medidas destacadas y botones directos.
2. `src/app/services/templates-catalog.service.ts`:
   - Corregir `bano_sobre_inodoro`: ajustar `so_puerta_1_` y `so_puerta_2_` (`length: 304, width: 490, posY: 1150, posZ: 134`) para encajar exactamente en el vano de la estructura.
   - Corregir `cocina_gavetero_ollero`: ajustar `oll_gaveta_1_` (`posY: 632`) y `oll_gaveta_2_` (`posY: 277`) para respetar holguras con el piso y fajas de amarre sin colisiones.
   - Auditar las demás plantillas para garantizar tolerancias y ensambles exactos.
3. `src/app/components/module-designer/module-designer.html`:
   - Rediseñar la sección "Dimensiones de Corte (mm)" a cuadrícula compacta de 3 columnas (`grid grid-cols-3 gap-2`).
   - Rediseñar la sección "Posición 3D en Milímetros" a cuadrícula compacta de 3 columnas (`grid grid-cols-3 gap-2`) con etiquetas identificadoras de ejes y eliminar los botones `-50 / -10 / +10 / +50` desbordados.
4. `src/app/components/module-designer/module-designer.ts`:
   - Asegurar que los métodos de ajuste numérico respondan inmediatamente a cambios directos sin latencia.

---

## 4. Plan de Verificación

1. **Verificación Visual de Catálogo**:
   - Abrir el catálogo de plantillas y comprobar que las tarjetas se muestran limpias, legibles, en 2 columnas y sin las miniaturas SVG anteriores.
2. **Prueba de Carga de Muebles Corregidos**:
   - Cargar `Mueble Organizador sobre Inodoro y Toallero`: verificar que las puertas ya no flotan en el aire y están montadas en su vano del mueble.
   - Cargar `Gavetero Ollero 2 Gavetas para Cocina`: verificar que no hay piezas marcadas en rojo por colisión.
3. **Prueba de Bandeja Lateral CAD**:
   - Seleccionar cualquier pieza y verificar que los campos de "Dimensiones de Corte" y "Posición 3D" encajan perfectamente en la barra lateral sin desbordamiento horizontal (`no scroll horizontal`).
4. **Prueba de Edición Numérica**:
   - Modificar valores en los campos de X, Y, Z y Largo/Ancho comprobando que la pieza en el visor 3D se actualiza al instante.
5. **Compilación y Linteo**:
   - Ejecutar `compile_applet` y `lint_applet` para confirmar cero errores de compilación y cero errores de TypeScript.
