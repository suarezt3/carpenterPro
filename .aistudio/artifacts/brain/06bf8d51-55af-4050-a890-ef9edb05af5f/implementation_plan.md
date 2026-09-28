# Plan de Implementación: Visor 3D Interactivo con Three.js en MelamiPro Studio

## Objetivo
Transformar el visualizador de muebles en un **entorno 3D interactivo en tiempo real** utilizando **Three.js** y **OrbitControls** (estilo SketchUp / Flatma), solucionando la falta de reactividad al modificar anchos, altos y profundidades, y permitiendo rotar, hacer zoom, separar piezas en vista despiezada y abrir puertas/cajones con un clic.

---

## 1. Tecnologías y Dependencias
- **`three`**: Motor WebGL 3D estándar para renderizado de mallas, materiales, luces y sombras.
- **`@types/three`**: Definiciones TypeScript para tipado estricto.
- **`three/examples/jsm/controls/OrbitControls`**: Navegación 3D orbital fluida (rotación 360°, paneo con clic derecho/shift y zoom con rueda del ratón).

---

## 2. Arquitectura y Componentes a Modificar

### A. Servicio o Componente 3D (`ThreeViewportComponent` o integrado en `ModuleDesignerComponent`)
1. **Inicialización Segura SSR (Angular 21)**:
   - Instanciar Three.js únicamente en el navegador (`afterNextRender` / comprobación `typeof window !== 'undefined'`).
   - `ResizeObserver` para adaptar el canvas 3D dinámicamente si el usuario colapsa o redimensiona paneles.
2. **Escena 3D Profesional de Taller**:
   - Cuadrícula milimétrica en el suelo (`GridHelper`) y plano con sombras suaves.
   - Iluminación de estudio (Luz ambiental difusa + 2 luces direccionales para resaltar aristas y texturas de melamina).
   - Generación de mallas con texturas de veta de madera procedurales o colores sólidos mates con biselado suave de cantos.
3. **Mapeo Paramétrico Reactivo en Tiempo Real**:
   - Cada pieza (lateral izquierdo, lateral derecho, piso, techo, repisas, fajas, puertas, fondos y cajones) se genera como un `Mesh` o `Group` 3D con sus coordenadas exactas en milímetros (escaladas a unidades de Three.js).
   - **Solución al problema de actualización**: Suscripción reactiva inmediata a los cambios del formulario (`valueChanges` y `toSignal`), regenerando las geometrías en tiempo real mientras el usuario escribe o mueve el control deslizante, sin necesidad de guardar o recargar.

### B. Interacciones Avanzadas 3D
1. **Vista Despiezada (Exploded View Slider)**:
   - Control deslizante interactivo de 0% a 100%:
     - Los laterales se desplazan hacia los lados.
     - La cubierta/techo sube y el piso baja.
     - Las puertas y frentes de cajón se adelantan.
     - El fondo trasero se desplaza hacia atrás.
   - Permite visualizar con total claridad cómo encaja cada unión, ranura y tornillo.
2. **Apertura Interactiva de Puertas y Cajones**:
   - Raycasting con el ratón: al hacer clic en una puerta, rota sobre sus bisagras laterales (ángulo de 0° a 95°).
   - Al hacer clic en un cajón, se desliza hacia afuera mostrando su caja interior y correderas.
3. **Selección e Inspección de Piezas**:
   - Al tocar cualquier pieza en 3D, se resalta con un borde iluminado y muestra un badge flotante con su nombre y medidas exactas (ej. "Lateral Izquierdo: 750 × 580 × 18 mm - Cantos: L1 delgado").

### C. Controles de Cámara y Vistas Rápidas
- Botones de cámara rápida: **Vista Isométrica**, **Vista Frontal**, **Vista Superior (Planta)** y **Vista Lateral**.
- Botón **Centrar / Reset Cámara**.

---

## 3. Plan de Verificación y Pruebas
1. **Instalación limpia**: Instalar `three` y `@types/three`.
2. **Compilación y SSR**: Ejecutar `compile_applet` para garantizar que la compilación AOT y el prerenderizado SSR se completen sin errores de `window` o `Canvas`.
3. **Prueba de Reactividad**: Verificar que al cambiar Ancho (ej. de 800 a 1200 mm), Alto y Profundidad, el mueble 3D se redimensione de inmediato y las repisas/puertas se adapten automáticamente.
4. **Verificación de Lint**: Ejecutar `lint_applet` para mantener el código 100% limpio y libre de advertencias.
