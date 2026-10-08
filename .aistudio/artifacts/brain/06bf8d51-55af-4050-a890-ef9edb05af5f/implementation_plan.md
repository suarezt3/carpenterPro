# Plan de Implementación: Medidas Compactas en Barra Inferior del Visor 3D y Limpieza del Panel Derecho

## 1. Contexto y Diagnóstico
El usuario aclaró mediante capturas de pantalla exactamente dónde y cómo desea gestionar las medidas:
1. **Ubicación exacta**: En la barra inferior del visor 3D (el recuadro rojo señalado en la barra de estado de herramientas de SketchUp), en lugar de tener un módulo flotante ocupando espacio sobre el modelo 3D.
2. **Formato exacto**: 3 campos numéricos compactos directos editables: `Alto × Ancho - Espesor mm` (ejemplo: `1000 × 600 - 15 mm`).
3. **Panel derecho**: Eliminar totalmente la sesión/sección de dimensiones de corte para quitarle peso y scroll innecesario.
4. **Lienzo 3D limpio**: Retirar la caja flotante grande agregada anteriormente para dejar el lienzo 100% despejado.

---

## 2. Modificaciones Propuestas

### A. Barra Inferior de Medidas en `furniture-3d-viewer` (`furniture-3d-viewer.html` y `.ts`)
- Reemplazar la caja estática de texto `Medidas: ...` en la esquina inferior derecha de la barra de estado por **3 campos numéricos compactos directos**:
  - Campo 1: **Alto / Largo** (ej. `1000`), editable en tiempo real.
  - Separador visual: `×`
  - Campo 2: **Ancho** (ej. `600`), editable en tiempo real.
  - Separador visual: `-`
  - Campo 3: **Espesor / Grosor** (ej. `15`), editable en tiempo real.
  - Sufijo: `mm`
- **Comportamiento interactivo**:
  - Al cambiar cualquier valor, se emite inmediatamente la actualización milimétrica en tiempo real a la pieza seleccionada (o con tecla Enter / evento `input`/`change`).
  - Inputs con estilos CAD compactos (ancho pequeño ~50-60px, centrados, tipografía mono negra sobre fondo blanco/gris con borde sutil), idénticos al cajetín de medidas de SketchUp.
  - Si una herramienta interactiva está activa (ej. cinta métrica o empujar/tirar), muestra las cotas correspondientes.
  - Si no hay pieza seleccionada, muestra las dimensiones totales del mueble o campos inactivos/placeholder claros.

### B. Limpieza del Lienzo 3D en `module-designer.html`
- Retirar la tarjeta flotante grande superpuesta que se había colocado en la esquina inferior derecha del lienzo para no tapar el modelo ni las herramientas de zoom/órbita.

### C. Supresión Total de Dimensiones en el Panel Derecho (`module-designer.html`)
- Eliminar por completo el bloque de dimensiones del panel lateral derecho, dejando únicamente el nombre de la pieza, el material, tapacantos, orientación y accesorios.
- De esta manera el panel lateral queda sumamente ligero, enfocado y sin redundancia.

---

## 3. Plan de Verificación
1. **Linter**: Ejecutar `lint_applet` para garantizar que no existan errores de sintaxis ni variables faltantes.
2. **Compilación**: Ejecutar `compile_applet` para verificar la compilación limpia de Angular.
3. **Prueba visual**: Comprobar que en la barra inferior se muestre `[1000] × [600] - [15] mm`, que la edición reactiva funcione al tipear, que el lienzo 3D esté libre de cajas superpuestas y que el panel derecho no tenga la sección de dimensiones.
