# Plan de Implementación: Descarga y Exportación Completa de Diagramas 2D de Corte

## 1. Diagnóstico del Problema Actual

Al pulsar "Imprimir Diagrama" en el Optimizador de Corte 2D:
- El navegador ejecuta `window.print()` sobre la vista completa de la aplicación sin estilos de impresión optimizados (`@media print`).
- El contenedor del diagrama SVG cuenta con clases de scroll (`overflow-auto`) y dimensiones fijas, lo que provoca que en la vista previa de impresión (hoja carta/A4 vertical) el diagrama se desborde verticalmente, quedando cortada la parte inferior de las piezas y los retazos (como se evidencia en la captura de pantalla).
- No existe un botón de descarga directa de archivo para guardar el diagrama sin pasar por el diálogo del navegador.

---

## 2. Decisiones de Diseño y Especificación Técnica

Conforme a las respuestas aclaratorias del usuario:
1. **Botón de Descarga con Menú Desplegable:**
   - Incorporar junto a "Imprimir Diagrama" un botón interactivo **"Descargar"** con selector de formato:
     - **Imagen PNG en Alta Resolución (Ultra HD):** Exportación vectorial a canvas a escala completa (3000px) garantizando que se renderice el 100% del tablero con todas las piezas, cotas y etiquetas sin recortes.
     - **Documento PDF de Taller:** Generación directa del plano técnico en PDF en formato apaisado.
2. **Corrección de Impresión y Guardado en PDF (`@media print`):**
   - Configuración de página `@page { size: landscape; margin: 8mm; }`.
   - Reglas CSS de impresión que oculten barras de navegación, botones, zoom y encabezados innecesarios.
   - Forzar el contenedor del tablero a `overflow: visible !important`, `height: auto !important`, ajustando el SVG al 100% del ancho/alto imprimible con preservación de aspecto (`viewBox`), de modo que el tablero completo (2440 × 1830 mm) se ajuste perfectamente en una sola página apaisada sin truncamiento.
   - Encabezado técnico de impresión con datos del proyecto, número de tablero, material, medidas brutas y estadísticas de corte.

---

## 3. Plan de Cambios por Archivo

### Archivo 1: `src/app/components/cut-optimizer-view/cut-optimizer-view.ts`
- Implementar métodos de exportación:
  - `downloadCurrentSheetAsPng()`: Convierte el SVG del tablero actual a imagen PNG en alta resolución (usando `XMLSerializer`, creación de imagen y renderizado en `<canvas>` con descarga automática de archivo `Plano_Corte_Tablero_[N].png`).
  - `downloadCurrentSheetAsPdf()`: Genera y descarga el documento PDF apaisado del tablero de corte listo para taller.
  - `toggleDownloadMenu()`: Control del menú desplegable de descarga.
  - `printCurrentSheet()`: Ajuste previo al print para asegurar que el zoom esté al 100% y el tablero encaje de forma íntegra.

### Archivo 2: `src/app/components/cut-optimizer-view/cut-optimizer-view.html`
- Añadir el botón desplegable de descarga con icono y opciones accesibles (PNG y PDF).
- Asignar identificadores y clases específicas (`print-sheet-container`, `print-sheet-svg`) al contenedor del diagrama y al SVG.
- Agregar un membrete técnico visible únicamente durante la impresión (`print:block hidden`) con:
  - Nombre del proyecto y fecha.
  - Especificación del tablero (Tablero #N, Material, Largo × Ancho × Espesor).
  - Resumen de aprovechamiento, metros de sierra y piezas colocadas.

### Archivo 3: `src/app/components/cut-optimizer-view/cut-optimizer-view.css` (o estilos globales de impresión)
- Reglas `@media print`:
  - `@page { size: landscape; margin: 8mm; }`
  - Eliminación de overflow, sombras, botones y elementos fuera del área de corte.
  - Escalado automático del SVG para que quepa al 100% sin scroll ni cortes en una sola hoja.

---

## 4. Verificación y Pruebas
1. Verificar que al hacer clic en "Descargar PNG" se descargue el tablero completo mostrando todas las piezas de arriba a abajo con sus cotas.
2. Verificar que al hacer clic en "Descargar PDF" se genere el plano técnico sin cortes.
3. Verificar que al abrir el diálogo de "Imprimir Diagrama" la vista previa del navegador se muestre en orientación horizontal y encaje el 100% del tablero en una sola página.
4. Ejecutar `lint_applet` y validar compilación exitosa.
