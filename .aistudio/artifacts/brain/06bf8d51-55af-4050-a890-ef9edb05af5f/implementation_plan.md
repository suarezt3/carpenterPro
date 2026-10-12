# Plan de Implementación: Imán Inteligente Pieza-Grupo y Prioridad Direccional

## 1. Contexto y Diagnóstico del Problema

1. **Fallo de Atracción entre Pieza Suelta y Grupo**:
   - Cuando las piezas están agrupadas, la traslación de grupos no realizaba comprobación de imán contra piezas sueltas u otros grupos.
   - Para piezas individuales, el umbral de detección en `applyMagneticSnapToPosition` estaba fijado en solo `12 mm`. Al mover el ratón con velocidad normal, los incrementos de píxeles superaban los 12 mm, saltándose la detección.
   - El usuario prefiere que la pieza se mantenga como entidad independiente (sin fusionarse automáticamente al grupo) pero alineada con precisión milimétrica mediante el imán.
   - Se requiere un umbral uniforme de atracción de `25 mm` para un agarre suave y predecible.

2. **Conflicto entre Mesa Superior y Patas Inferiores (Pieza Intermedia)**:
   - Al mover una pieza situada entre las patas (abajo) y el tablero/grupo (arriba), el imán de las patas aplicaba una zona de captura descendente que sobrescribía la posición vertical calculada por el imán de piezas.
   - Al halar hacia arriba, el sistema saltaba el imán de la mesa superior debido a la prioridad fija y al rango asimétrico.
   - **Solución elegida**: Priorización direccional según el sentido del arrastre:
     - **Movimiento hacia arriba (`dy > 0`)**: Se prioriza la cara inferior de las piezas/grupos superiores (mesa o travesaños).
     - **Movimiento hacia abajo (`dy < 0`)**: Se prioriza la cota superior de las patas de apoyo, reteniendo la pieza en la cota superior (`0 mm`) para evitar que se hunda hacia el piso.

---

## 2. Cambios Propuestos

### A. Imán Inteligente Bidireccional Pieza ↔ Grupo (`src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`)
- **Umbral de Imán Calibrado a 25 mm**:
  - Actualizar el umbral de `applyMagneticSnapToPosition` de 12 mm a `25 mm` en todos los ejes (X, Y, Z).
- **Soporte de Agrupaciones**:
  - Garantizar que al arrastrar una pieza suelta, se evalúen con total precisión todas las caras de las piezas pertenecientes a grupos (`groupId`).
  - Al arrastrar un grupo completo (`this.dragInitialParts.length > 1`), calcular la envolvente del grupo e implementar el enganche magnético contra piezas sueltas externas y otros grupos, no solo contra muros.

### B. Priorización Direccional Dinámica Arriba / Abajo
- **Detección del Sentido de Arrastre (`deltaY` / `dy`)**:
  - Si el usuario arrastra la pieza hacia arriba:
    - Evaluar primero la atracción hacia las caras de las piezas superiores (estructura de la mesa).
    - Desactivar la atracción descendente hacia las patas mientras el vector de arrastre apunte hacia arriba.
  - Si el usuario arrastra la pieza hacia abajo:
    - Evaluar la atracción hacia la cota superior de las patas (`legTopY`).
    - Al detectar las patas, bloquear el descenso para no atravesarlas hacia abajo.

### C. Retroalimentación Visual Unificada
- Mostrar la guía visual láser y el indicador de contacto cuando la pieza se acopla tanto a un grupo de piezas como a las patas.
- Limpiar guías activas al soltar el ratón o alejarse de la zona de enganche.

---

## 3. Plan de Verificación

1. **Compilación y Linting**:
   - Ejecutar `compile_applet` y `lint_applet` para garantizar cero errores de tipos y reglas de estilo.
2. **Prueba de Atracción Pieza Suelta a Grupo**:
   - Crear un grupo de 2 o más piezas (estructura de mesa).
   - Arrastrar una pieza suelta hacia el grupo y verificar que se adhiere fluidamente a 25 mm en cualquiera de sus caras sin unirse al grupo.
3. **Prueba de Pieza Intermedia (Patas vs. Mesa Superior)**:
   - Colocar una pieza entre las patas y la mesa.
   - Arrastrar hacia arriba y verificar que engancha con la mesa superior sin saltársela.
   - Arrastrar hacia abajo y comprobar que se ancla a las patas sin hundirse hacia el piso.
