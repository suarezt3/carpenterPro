# Plan de Implementación: Repositorio de Accesorios, Animación Fluida y Configuración de Puertas/Cajones

## Resumen Ejecutivo
Implementar un repositorio profesional de accesorios de carpintería (manijas/tiradores, bisagras de cazoleta, correderas telescópicas), corregir el problema de animación donde las puertas/cajones "brincan" y quedan en el mismo lugar al hacer clic (provocado por la reconstrucción del árbol 3D y desacoplamiento de mecanizados/pivotes), y habilitar tanto en el **menú contextual de clic derecho** como en el **panel inspector de piezas** la capacidad de convertir cualquier pieza personalizada en puerta o cajón, asignar sus accesorios y animar su apertura y cierre de forma interactiva.

---

## Decisiones del Usuario y Preferencias Confirmadas

> [!IMPORTANT]
> Decisiones confirmadas a través de la entrevista interactiva:
> - **Gestión de accesorios**: Catálogo integrado en el inspector de propiedades y en el menú contextual de clic derecho.
> - **Configuración de piezas personalizadas**: Accesible tanto desde el menú contextual de clic derecho como desde el panel inspector de la pieza seleccionada.
> - **Controles de animación**: Clic directo en el tirador/manija 3D, opción de "Abrir / Cerrar" en el menú contextual y botón global de apertura en la barra de herramientas.

---

## 1. Diagnóstico del Error de Visualización y Animación ("Brinco")

### Causa Raíz Detectada
1. **Reconstrucción destructiva de la escena**: Al hacer clic en una pieza o en su entorno, el visor Three.js emite `partSelected`, lo cual actualiza `selectedPartIds` en el diseñador. El efecto reactivo (`effect()`) en el visor detectaba el cambio de selección y llamaba a `buildFurnitureScene()`, limpiando completamente `openCurrentMap.clear()` y `openTargetMap.clear()`, destruyendo la malla y recreándola cerrada instantáneamente tras un único frame.
2. **Círculos en las puertas**: Los círculos observados en las puertas corresponden a las **cazoletas de bisagra de 35 mm** (mecanizados CNC calculados por el motor de ensamble). Al estar ubicados en un grupo estático separado (`drillGroup`), no estaban emparentados con el pivote de giro (`doorPivot`). Al rotar la puerta, los círculos quedaban en el aire o creaban una discrepancia visual.
3. **Ausencia de modelos 3D de herrajes**: No existían accesorios físicos visuales (manijas, bisagras metálicas, correderas) emparentados con la puerta o cajón.

---

## 2. Arquitectura de la Solución y Componentes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MODULO DESIGNER / WORKSPACE                          │
├──────────────────────────────────────┬──────────────────────────────────────┤
│       PANEL INSPECTOR DE PIEZA       │       VISOR 3D (THREE.JS / CAD)      │
│  - Rol Móvil (Puerta/Cajón/Fija)     │  - Árbol jerárquico:                 │
│  - HingeSide: Izq, Der, Basculante   │    doorPivot ──► DoorMesh            │
│  - Catálogo Accesorios / Tiradores   │              ├──► Handle3D (Tirador) │
│  - Selector Bisagras / Correderas    │              └──► HingeCups (35mm)   │
│  - Test apertura instantáneo         │  - Click en tirador / puerta         │
├──────────────────────────────────────┴──────────────────────────────────────┤
│                         MENÚ CONTEXTUAL CLIC DERECHO                        │
│  - "Convertir en Puerta" (Izq / Der / Basculante)                           │
│  - "Convertir en Cajón" (Frente móvil con correderas)                       │
│  - "Asignar Tirador..." (Barra, Concha, Botón, Gola, Sin Tirador)           │
│  - "Abrir / Cerrar Pieza" (Animación lerp suave a 90° o extensión)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Especificación Detallada de Cambios

### A. Repositorio de Accesorios de Carpintería (`accessories-catalog.service.ts` o modelo integrado)
Crear catálogo tipado con metadatos y generadores geométricos 3D optimizados:
1. **Tiradores y Manijas**:
   - **Tirador Tubular de Barra**: Acero cepillado o negro mate (distancias estándar: 96mm, 128mm, 160mm, 192mm).
   - **Tirador de Concha / Clásico**: Con fijación frontal o trasera.
   - **Tirador Botón Cilíndrico**: Minimalista moderno (diámetro 20-25mm).
   - **Tirador Perfil Gola / J-Pull**: Integrado en el borde superior o lateral.
   - **Push-to-Open (Sin tirador)**: Apertura por expulsión mecánica.
2. **Bisagras de Cazoleta (35mm)**:
   - Bisagra Recta (Parche / Cobertura total).
   - Bisagra Acodada (Semi-parche / Codo 9).
   - Bisagra Superacodada (Encastrada / Codo 18).
   - Brazo Basculante / Pistón de gas para puertas elevables.
3. **Correderas de Cajón**:
   - Correderas telescópicas laterales (extensión total 45mm zincada).
   - Guías ocultas bajo cajón con cierre suave.

### B. Corrección de la Animación de Apertura (Suavidad sin Saltos)
1. **Preservación de Estado**:
   - Modificar `buildFurnitureScene()` y los efectos reactivos para no borrar `openTargetMap` ni reiniciar el progreso de rotación/desplazamiento al cambiar de selección.
   - Optimizar la actualización de selección: actualizar materiales y el Gizmo de transformación sin destruir ni reconstruir la escena Three.js cuando solo cambian los IDs seleccionados.
2. **Emparentamiento Correcto**:
   - Emparentar tanto el tirador 3D como las cazoletas de bisagra (`hinge_35`) directamente dentro del `doorPivot`.
   - Al rotar `doorPivot.rotation.y` (o `rotation.x` en basculantes), la puerta, su tirador y sus bisagras se moverán solidariamente en una sola transformación matemática.
3. **Animación Lerp con Easing Real**:
   - Suavizar la interpolación de apertura con delta time para que responda uniformemente a 60 FPS sin saltos abruptos.

### C. Menú Contextual de Clic Derecho
Añadir sección dedicada a piezas móviles:
- **Puerta / Bisagra**:
  - Convertir en Puerta (Bisagra Izquierda)
  - Convertir en Puerta (Bisagra Derecha)
  - Convertir en Puerta Basculante (Superior)
- **Cajón**:
  - Convertir en Frente de Cajón Móvil
- **Quitar Rol Móvil**:
  - Volver a pieza fija estándar
- **Herrajes y Tirador**:
  - Submenú rápido con opciones visuales de tirador (Barra, Concha, Botón, Gola, Push-Open).
- **Acción Rápida de Animación**:
  - Opción directa "Abrir / Cerrar Pieza" para probar el movimiento inmediatamente.

### D. Panel Inspector de Piezas (Module Designer)
- Nueva sección colapsable **"Comportamiento Móvil y Accesorios"**:
  - Selector de Rol: Estándar (Fija) | Puerta | Frente de Cajón.
  - Si es Puerta: Selector de ubicación de bisagra (Izquierda, Derecha, Superior).
  - Selector de Tirador: Lista desplegable con vista previa de estilo, material y orientación (Horizontal / Vertical).
  - Posicionamiento del tirador: Centrado, borde superior, borde inferior, centrado lateral.
  - Botón interactivo de prueba: "Probar Animación (Abrir / Cerrar)".

---

## 4. Plan de Verificación

1. **Prueba de Carga de Plantilla**: Cargar la plantilla "Closet / Ropero 2 Cuerpos con Maletero y Perchero", verificar que las puertas se ubiquen perfectamente alineadas con sus bisagras y tiradores integrados.
2. **Prueba de Clic en Tiradores / Puertas**: Hacer clic en el tirador o puerta y confirmar que se abre a 90° de manera continua y fluida, sin saltos ni reseteos de posición.
3. **Prueba de Creación Manual**:
   - Crear una pieza rectangular manual.
   - Hacer clic derecho -> "Convertir en Puerta (Bisagra Izquierda)" o asignarlo en el inspector.
   - Comprobar que adquiere automáticamente el tirador y bisagras, y que se anima al hacer clic o mediante el menú.
4. **Prueba de Creación de Cajón**:
   - Crear un frente de cajón, designarlo como cajón y comprobar la animación de extracción hacia el frente.
5. **Verificación de Compilación**: Ejecutar `compile_applet` para garantizar cero errores de TypeScript y AOT.
