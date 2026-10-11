# Plan de Implementación: Elevación Libre 3D con Ratón e Imán Dinámico de Contacto

Permitir que cualquier electrodoméstico o equipo seleccionado pueda moverse libremente en todas las dimensiones con el ratón (desplazamiento horizontal y elevación vertical directa hacia arriba y abajo), conservando el imán inteligente que se adhiere suavemente al acercarse a superficies (suelo, mesadas, paredes) y se libera de forma natural cuando el usuario aleja el cursor.

---

## 1. Diagnóstico del Comportamiento Actual
- **Causa del bloqueo de altura**: En `furniture-3d-viewer.ts`, el plano de intersección de arrastre del equipo (`this.dragPlane`) estaba configurado como un plano horizontal rígido (`Vector3(0, 1, 0)`) a la altura previa del equipo, y en `onPointerMove` la coordenada $Y$ se fijaba a `initialPos.y`, impidiendo que el movimiento vertical del ratón en la pantalla elevara o descendiera el equipo.
- **Comportamiento deseado**: 
  - Al arrastrar el ratón hacia arriba/abajo en la pantalla, el equipo debe subir y bajar en el espacio 3D de manera fluida y predecible.
  - Al pasar cerca de superficies de apoyo (suelo a $Y = 0$, o mesadas horizontales a la cota superior del mueble), el imán debe aplicar un "snap magnético" (zona de atracción de ~120 mm) fijando la base.
  - Si el usuario continúa moviendo el ratón alejándose de la superficie, el imán se suelta automáticamente permitiendo continuar la elevación libre.

---

## 2. Cambios Arquitectónicos y Algorítmicos

### A. Plano de Arrastre 3D Orientado a la Cámara (`furniture-3d-viewer.ts`)
- Configurar `this.dragPlane` en `onPointerDown` perpendicular a la dirección visual de la cámara (`camDir.negate()`) pasando por la posición del equipo.
- Esto proyecta con precisión milimétrica los movimientos del cursor 2D de la pantalla en vectores $(X, Y, Z)$ reales en el espacio 3D del taller/cocina:
  $$\Delta \mathbf{P} = \mathbf{P}_{\text{intersect}} - \mathbf{P}_{\text{start}}$$
  $$\text{targetX} = \text{initialPos.x} + \Delta P_x$$
  $$\text{targetY} = \max(0, \text{initialPos.y} + \Delta P_y)$$
  $$\text{targetZ} = \text{initialPos.z} + \Delta P_z$$

### B. Imán Dinámico con Zona de Atracción y Desenganche Suave
- **Imán a Suelo ($Y = 0$)**:
  - Si el ratón baja el equipo y $\text{targetY} \le 110\text{ mm}$, se adhiere magnéticamente a la base ($Y = 0$).
  - Si el ratón se desplaza hacia arriba superando ese umbral, se despega suavemente y sigue la elevación del ratón.
- **Imán a Mesadas y Módulos de Muebles**:
  - Detectar si la proyección horizontal $(X, Z)$ del equipo se sitúa sobre alguna pieza horizontal del mueble (mesada, repisa o tapa).
  - Calcular la cota superior de apoyo $Y_{\text{mesada}} = p.posY + p.thickness / 2$.
  - Si $|\text{targetY} - Y_{\text{mesada}}| \le 130\text{ mm}$, la base del equipo se adhiere magnéticamente a $Y_{\text{mesada}}$.
  - Si el usuario mueve el ratón más de $130\text{ mm}$ por encima o por debajo de la mesada, el imán se libera fluidamente.
- **Imán a Pared Posterior y Lateral**:
  - Pared posterior: adherencia a la cara interior del muro si la distancia es $\le 80\text{ mm}$; se desengancha al alejar el ratón hacia el frente.
  - Muro lateral en L: adherencia a la cara interior izquierda si la distancia es $\le 80\text{ mm}$.

### C. Feedback Visual 3D Durante la Elevación
- El anillo de proyección en el suelo se actualiza en tiempo real mostrando la huella vertical del equipo.
- Actualización suave en el visor 3D sin saltos bruscos.

---

## 3. Plan de Verificación y Pruebas
1. **Prueba de Elevación Libre**:
   - Seleccionar cualquier electrodoméstico (nevera, horno, microondas, fregadero) y arrastrar con el ratón hacia arriba y hacia abajo en la pantalla: comprobar que el equipo se eleva y desciende libremente.
2. **Prueba de Imán en Suelo y Mesada**:
   - Bajar el equipo hacia el piso: verificar que se fija a $Y = 0$. Mover el ratón hacia arriba: verificar que se despega sin atascarse.
   - Mover el equipo sobre un mueble bajo: verificar que al acercarse a la altura de la mesada se posa exactamente sobre la cara superior. Elevarlo más arriba: comprobar que se desengancha de la mesada.
3. **Prueba de Compilación y Calidad**:
   - Ejecutar `compile_applet` y `lint_applet` para garantizar 0 errores de compilación y cumplimiento de estándares.
