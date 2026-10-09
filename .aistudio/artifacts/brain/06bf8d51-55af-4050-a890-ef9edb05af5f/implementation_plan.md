# Implementación Completada: Cinta de Acciones a la Derecha y Tarjeta Informativa a la Izquierda

## Resumen de Cambios:
1. **Cinta Oscura de Acciones (Derecha):**
   - La cinta flotante con las opciones de grupo (`Duplicar`, `Mover`, `Abrir`, `90° (R)`, `Frente`, `Desagrupar`) y de pieza individual (`Duplicar`, `Mover`, `90° (R)`, `Orientación`, `Eliminar`) se ubica ahora en la parte superior derecha (`top-3 right-3` o `top-3 right-28` si la bandeja lateral está colapsada).
   - Respeta estrictamente los márgenes visuales y no se desborda ni colisiona con otros paneles.

2. **Tarjeta Informativa Restaurada (Izquierda):**
   - El badge de información con las medidas de la pieza seleccionada o el total de piezas del grupo modular ha vuelto a su ubicación superior izquierda (`top-3 left-16`).
   - Ambas barras quedan alineadas en la misma altura horizontal superior (una en cada extremo) sin tocarse ni solaparse.

3. **Zona Inferior Despejada:**
   - El cuadro flotante de **Micro-Ajuste en Zoom** vuelve a situarse en `bottom-10 left-16` sin ningún texto ni elemento solapándose por debajo, resolviendo exactamente lo mostrado en la imagen de referencia.
