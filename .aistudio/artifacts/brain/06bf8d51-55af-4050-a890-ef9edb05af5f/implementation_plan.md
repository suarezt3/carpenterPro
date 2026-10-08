# Plan de Implementación: Separación Limpia de Melamina y Espesor Libre

## 1. Contexto y Diagnóstico
Actualmente, los nombres de las melaminas incluyen espesores fijos en su etiqueta (ej. `MDF / Durolac Blanco 3mm (Fondos)` o `Melamina Blanca 18mm`). Si el usuario cambia el espesor de la pieza a 15mm, se produce una contradicción visual confusa: el desplegable dice "3mm" mientras que la pieza tiene asignado "15mm".

El usuario ha especificado:
1. **Selector de Melamina**: Debe mostrar **únicamente el color o textura** (ej. *Blanco Frost*, *Roble Nebraska*, *MDF Durolac Blanco*) sin mención de milímetros.
2. **Asignación de Espesor**: Debe ser completamente libre e independiente, combinando **botones rápidos de taller** (3, 15, 18, 36 mm) con un **campo numérico directo** en milímetros para ingresar cualquier valor deseado (ej. 6, 12, 16, 25 mm).
3. **Persistencia y Reactividad**: Al cambiar de melamina no se debe forzar ni sobrescribir el espesor que el usuario ya definió para su pieza.

---

## 2. Modificaciones Propuestas

### A. Limpieza de Nombres de Melamina en `project-storage.service.ts`
- Actualizar el catálogo predeterminado de materiales para que los nombres sean puramente de diseño/color:
  - `Melamina Roble Nebraska` (en vez de `Melamina Roble Nebraska 18mm`)
  - `Melamina Nogal Terracota`
  - `Melamina Blanco Frost`
  - `MDF Durolac Blanco` (en vez de `MDF / Durolac Blanco 3mm (Fondos)`)
  - etc.
- Implementar una función de saneamiento para que los materiales ya guardados en `localStorage` también se limpien automáticamente de sufijos como `18mm`, `15mm`, `3mm`.

### B. Ajuste de `onMaterialChange` en `module-designer.ts`
- Modificar `onMaterialChange` para que **únicamente actualice `materialId` y `materialName`**, manteniendo intacto el `thickness` actual de la pieza salvo que sea una pieza nueva sin espesor.

### C. Rediseño de la Sección "Tablero & Espesor" en `module-designer.html`
- **Desplegable de Melamina**:
  - Mostrar solo `mat.name` (color/textura) junto a una muestra visual de color (círculo `colorHex`), sin el texto `({{ mat.thickness }} mm)`.
- **Control de Espesor Libre y Rápido**:
  - **Fila superior de control libre**: Campo de entrada numérico directo con botón de incremento/decremento `[ -1 ]` y `[ +1 ]`, permitiendo tipear cualquier espesor en milímetros con validación reactiva en tiempo real.
  - **Botones rápidos de taller**: Conservar los accesos rápidos de 1 clic para los estándares más comunes (`3 mm`, `15 mm`, `18 mm`, `36 mm`), marcando como activo aquel que coincida con el espesor actual.
  - Badge de estado claro en la cabecera mostrando el espesor actual de la pieza.

### D. Armonización en `templates-catalog.service.ts`
- Asegurar que las plantillas iniciales asignen nombres limpios de material sin sufijos numéricos.

---

## 3. Plan de Verificación
1. **Linter**: Ejecutar `lint_applet` para asegurar ausencia de errores de sintaxis y tipos.
2. **Compilación**: Ejecutar `compile_applet` para validar el empaquetado Angular.
3. **Prueba funcional**:
   - Abrir el panel derecho en una pieza seleccionada.
   - Verificar que el selector muestre nombres limpios de color (ej. "MDF Durolac Blanco", "Blanco Frost").
   - Cambiar de material y comprobar que el espesor de la pieza no se altere.
   - Probar tanto los botones rápidos (15, 18 mm) como el campo numérico libre (ej. 12 mm) y comprobar que la pieza y el visor 3D se actualicen en tiempo real.
