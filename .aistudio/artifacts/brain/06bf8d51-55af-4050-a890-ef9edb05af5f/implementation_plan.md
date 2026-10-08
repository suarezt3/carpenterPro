# Plan de Implementación: Módulo Flotante de Dimensiones de Corte en Lienzo 3D (Estilo SketchUp)

Reubicación del módulo interactivo de «Dimensiones de Corte (mm)» desde el panel lateral derecho hacia la esquina inferior derecha del lienzo de trabajo 3D, permitiendo edición directa en tiempo real de Largo, Ancho y Espesor con botones de ajuste fino (±10 mm), aligerando la carga visual del inspector lateral.

## Decisiones Críticas y Preferencias Confirmadas

> [!IMPORTANT]
> Decisiones confirmadas por el usuario en la fase de clarificación previa:

- **Ubicación en el Lienzo**: Esquina inferior derecha del visor 3D, integrado sobre la barra de estado al estilo tradicional de la caja de medidas (Measurements Box) de SketchUp.
- **Formato Visual**: Caja fija siempre visible con los 3 campos editables directos (Largo, Ancho, Espesor), accesible inmediatamente sin necesidad de clics previos para desplegar.
- **Modo de Aplicación**: Edición en tiempo real mientras el usuario escribe o hace clic en los botones de incremento/decremento (±10 mm y ±1 mm), reflejando la actualización geométrica 3D instantáneamente.
- **Impacto en el Panel Derecho**: Se retira la tarjeta voluminosa de dimensiones de corte del inspector lateral derecho, aligerando el panel para dejar espacio limpio a Tapacantos, Ranuras, Materiales y Operaciones.

---

## 1. Visión General y Experiencia de Usuario

### ¿Qué hace esta mejora?
Transforma el indicador estático de medidas de la esquina inferior derecha del visor 3D (`MEDIDAS: 2907 × 511 mm`) en un **HUD interactivo de entrada dimensional CAD** estilo SketchUp. Cuando el usuario selecciona una pieza en el modelo 3D:
1. La caja de medidas en la esquina inferior derecha muestra los 3 campos paramétricos: **Largo (L)**, **Ancho (W)** y **Espesor (T)**.
2. Cada campo permite escribir directamente el número o usar micro-botones de paso rápido (`-10`, `+10` mm) para ajustar con precisión de taller.
3. El panel derecho de propiedades se descongestiona drásticamente, eliminando el módulo duplicado y reduciendo el scroll vertical.
4. Si no hay pieza seleccionada, el HUD muestra las cotas envolventes del mueble o la guía de la herramienta activa (Empujar/Tirar, Cinta métrica o Rectángulo).

```
┌────────────────────────────────────────────────────────────────────────┐
│  LIENZO 3D (VIEWPORT PRINCIPAL)                                        │
│                                                                        │
│   [3D Model Display & Orbit Controls]                                  │
│                                                                        │
│                                                                        │
│  ────────────────────────────────────────────────────────────────────  │
│  [Herramienta activa: Seleccionar]     ┌────────────────────────────┐  │
│                                        │ 📐 DIMENSIONES DE CORTE    │  │
│                                        │  LARGO (L)  ANCHO (W)  ESP │  │
│                                        │  [ 2907 ]   [ 511 ]   [18] │  │
│                                        │  -10   +10  -10   +10      │  │
│                                        └────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Diseño Visual e Interfaz (UI/UX)

### Paleta y Estilo Arquitectónico
- **Estilo**: CAD HUD profesional con fondo translúcido nítido (`bg-white/95 backdrop-blur-md` en tema claro, `bg-stone-900/95 border-stone-800` en tema oscuro).
- **Tipografía**: Fuente monoespaciada técnica (`JetBrains Mono` / `font-mono`) en negrita para números de cotas, con etiquetas de eje claras: `L` (Largo), `W` (Ancho/Fondo) y `T` (Espesor).
- **Micro-interacciones**:
  - Inputs numéricos con fondo suave (`bg-stone-50 hover:bg-white focus:bg-white focus:ring-1 focus:ring-stone-700`), sin bordes excesivos.
  - Botones de paso rápido `-10` y `+10` discretos y compactos con respuesta táctil y prevención de eventos (`stopPropagation`) para no alterar la cámara 3D.
  - Sombra sutil de elevación (`shadow-lg border border-stone-200/90`) para resaltar sobre el fondo de la rejilla 3D sin obstruir la vista del mueble.

### Estados del Componente
1. **Con Pieza Seleccionada**: Muestra los 3 campos editables de la pieza activa (`selectedPart()`), vinculados bidireccionalmente a su geometría.
2. **Con Múltiples Piezas (Grupo)**: Muestra el ancho y largo del bounding box del grupo seleccionado con opción de desplazamiento en bloque.
3. **Sin Pieza Seleccionada**: Muestra las medidas globales exteriores del mueble (Ancho × Alto × Profundidad) en modo lectura de referencia.

---

## 3. Decisiones Técnicas y Arquitectura

### 1. Ubicación del Componente y Flujo de Eventos
- El HUD se ubicará en `src/app/components/furniture-3d-viewer/furniture-3d-viewer.html` sustituyendo el chip estático en la barra inferior derecha.
- Emitirá el output existente `partModified` hacia `module-designer.ts` y `project-storage.service.ts`, asegurando que el historial de Deshacer/Rehacer (`Undo`/`Redo`) y el despiece de corte se sincronicen de inmediato.
- Los inputs numéricos incluyen filtros para evitar valores negativos o nulos (mínimo 1 mm, validación contra NaN).

### 2. Diagrama de Arquitectura de Datos

```
┌─────────────────────────────────────────────────────────────┐
│                 ModuleDesignerComponent                     │
│   (Maneja estado de selección: selectedPartId / selectedPart) │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌──────────────────────────────┐      ┌──────────────────────────────┐
│  Furniture3dViewerComponent  │      │   Right Properties Drawer    │
│                              │      │                              │
│  [Canvas WebGL Three.js]     │      │  [Identificación / Nombre]   │
│                              │      │  [Tapacantos L1/L2/A1/A2]    │
│  [Bottom-Right Corner HUD]   │◄────►│  [Material y Textura]        │
│  - Input Largo (L) ±10mm     │      │  [Herrajes y Correderas]     │
│  - Input Ancho (W) ±10mm     │      │  (Dimensiones removidas para │
│  - Input Espesor (T)         │      │   eliminar peso y scroll)    │
└──────────────┬───────────────┘      └──────────────────────────────┘
               │
               ▼ (Emite partModified)
┌─────────────────────────────────────────────────────────────┐
│                 ProjectStorageService                       │
│    (Actualiza geometría en milímetros, despiece y cotas)     │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Fases de Ejecución

1. **Fase 1: Implementación del HUD en el Visor 3D**:
   - Crear el componente visual en la esquina inferior derecha de `furniture-3d-viewer.html`.
   - Conectar los métodos de modificación paramétrica `updatePartDimension(axis, value)` y `adjustDimensionStep(axis, delta)` en `furniture-3d-viewer.ts`.
   - Asegurar que el foco en los inputs deshabilite temporalmente los atajos de teclado de la cámara (para que escribir números no dispare herramientas).

2. **Fase 2: Aligeramiento del Panel Derecho en `module-designer.html`**:
   - Retirar la sección voluminosa de «Dimensiones de Corte (mm)» de `module-designer.html`, dejando un resumen compacto de 1 línea de cotas y priorizando Tapacantos, Ranuras y Orientación.
   - Verificar la coherencia estética en modo Claro (SketchUp Classic) y modo Oscuro (CAD Dark).

3. **Fase 3: Validación y Pruebas**:
   - Validar edición manual con teclado y con botones ±10 mm.
   - Comprobar reflejo inmediato en el modelo 3D y en la lista de despiece.
   - Ejecutar compilación (`compile_applet`) y verificación de lint (`lint_applet`).
