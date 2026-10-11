# Plan de Implementación: Manipulación Directa 3D de Electrodomésticos

Permitir arrastre libre con el ratón en el visor 3D, imán automático de proximidad a superficies, tiradores interactivos de redimensionado en las caras de la caja delimitadora con escalado armónico, y borrado rápido con la tecla `Delete`.

---

## 1. Atajo de Teclado: Borrado Inmediato con `Delete` / `Backspace`
- **Archivo**: `src/app/components/module-designer/module-designer.ts`
- **Cambio**: En `handleGlobalKeyDown(e: KeyboardEvent)`, verificar si existe un equipo seleccionado (`selectedApplianceId()`).
- Al presionar `Delete`, `Backspace` o `Del` (fuera de inputs/textareas), ejecutar `deleteSelectedAppliance()`.
- Emitir toast informativo: `🗑️ "[Nombre del equipo]" eliminado (Delete)`.

---

## 2. Arrastre Libre 3D con el Ratón e Imán de Proximidad
- **Archivo**: `src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`
- **Lógica de Arrastre Directo**:
  - Al hacer `pointerdown` sobre un electrodoméstico o sobre su caja delimitadora, activar estado `isApplianceDragging = true`.
  - Desactivar temporalmente `OrbitControls` para que la cámara no rote durante el arrastre.
  - Proyectar el puntero del ratón sobre un plano horizontal/interactivo continuo para calcular la posición $(X, Z)$ en tiempo real.
- **Imán Automático de Contacto**:
  - **Suelo**: Si la altura calculada o posición está a menos de 100 mm del piso, adherir a $Y = 0$.
  - **Mesada / Encimera**: Si el equipo pasa sobre la huella de un mueble bajo o pieza horizontal (mesada), detectar la cota superior del mueble y asentar la base del equipo suavemente sobre ella.
  - **Paredes**: Si la cara posterior o lateral se aproxima a menos de 120 mm del muro principal o muro lateral en L, magnetizar la cara contra la superficie del muro.
  - Al soltar (`pointerup`), confirmar la nueva posición y emitir `applianceModified`.

---

## 3. Tiradores 3D en las Caras de la Caja para Redimensionado Interactivo
- **Archivo**: `src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`
- **Tiradores en las Caras**:
  - Cuando un electrodoméstico está seleccionado, generar tiradores interactivos en las caras de su caja delimitadora (+X, -X para Ancho; +Z, -Z para Profundidad; +Y para Altura).
  - Estilo visual profesional estilo CAD: pequeños cubos o botones con borde contrastante y cursor contextual (`ew-resize`, `ns-resize`).
- **Arrastre de Tirador**:
  - Al arrastrar un tirador, calcular la variación de dimensión en pasos múltiplos de 10 mm respetando límites mínimos y máximos seguros.
  - Emitir la actualización en tiempo real para refrescar el modelo 3D y el panel lateral de propiedades.

---

## 4. Escalado Armónico y Uniforme de Subpiezas y Accesorios
- **Archivo**: `src/app/services/appliance-3d-builder.service.ts`
- **Lógica de Proporciones**:
  - Asegurar que al cambiar las dimensiones del equipo (ancho, profundidad, alto), todos sus componentes internos (poceta y grifo en lavaplatos; quemadores y perillas en estufas; tirador, cavidad y panel digital en hornos/microondas; campana y ducto en extractores) mantengan proporciones estéticas armónicas y posiciones relativas coherentes.
  - El grifo y desaguador del lavaplatos se redimensionan y reubican coordinadamente con la cubeta y el escurridor, manteniendo la ergonomía visual sin deformaciones bruscas.

---

## Verificación y Pruebas
1. Seleccionar un horno o nevera y arrastrarlo libremente con el ratón por el piso de la habitación.
2. Comprobar que al acercarse a la pared o sobre un mueble bajo, el imán lo fija automáticamente a la superficie.
3. Presionar la tecla `Delete` y verificar que el electrodoméstico seleccionado desaparece de inmediato.
4. Seleccionar un lavaplatos o anafe, arrastrar los tiradores de las caras y verificar que el ancho y profundidad crecen armónicamente junto con grifería, perillas y quemadores.
5. Ejecutar `compile_applet` para confirmar la ausencia de errores de compilación y validar la estabilidad del dev server.
