# Desacoplamiento y Retiro de Plantillas de Muebles

Descarte y desacoplamiento limpio del botón de Plantillas y modales asociados en la interfaz visual del diseñador de módulos, manteniendo intactos los servicios de catálogo subyacentes para permitir un rediseño futuro sin roturas.

## Decisiones Críticas y Confirmadas

> [!IMPORTANT]
> Decisiones confirmadas por el usuario en la fase de clarificación:
> - **Barra superior despejada**: Se retira el botón de "Plantillas" de la barra superior sin agregar elementos distractores, otorgando protagonismo al espacio de trabajo y controles directos del lienzo.
> - **Desacoplamiento seguro**: Se ocultan y desvinculan los accesos visuales y modales de plantillas en la UI (`module-designer.html` y componente contenedor), preservando los servicios y modelos de datos (`templates-catalog.service.ts`) para reutilizarlos en una versión mejorada.

---

## 1. Visión General y Propósito

El catálogo actual de plantillas prefabricadas no responde de manera óptima a las necesidades del taller y flujo de diseño paramétrico, por lo que se descarta temporalmente de la experiencia del usuario. La barra superior queda limpia, despejada y enfocada en el modelado 3D interactivo, evitando confusiones o inconsistencias de piezas predefinidas mientras se reformula la arquitectura del catálogo.

---

## 2. Experiencia de Usuario y Diseño Visual

### Flujo de Navegación Simplificado
1. **Barra Superior Limpia**:
   - Se elimina el botón `[Plantillas]` y su menú desplegable de la barra de acciones superior.
   - La barra conserva únicamente los elementos esenciales: título del proyecto/módulo, estado de piezas/dimensiones y acciones directas (reiniciar lienzo, deshacer/rehacer, exportación).
2. **Lienzo y Mensajes de Estado Cero**:
   - Si el lienzo está vacío, el texto orientativo se ajusta para guiar al usuario a dibujar piezas con la herramienta rectangular 3D o añadir piezas desde el panel lateral, eliminando menciones al botón de plantillas.
3. **Modales Desactivados**:
   - El diálogo modal `app-templates-modal` queda desvinculado de la plantilla activa del diseñador, asegurando cero interferencias con el renderizado 3D y atajos de teclado.

---

## 3. Decisiones de Producto y Compensaciones

- **Retiro Visual vs. Eliminación de Archivos**:
  - *Enfoque Seleccionado*: Desacoplar el llamado en la interfaz (`module-designer.html` y variables de control en `module-designer.ts`), sin eliminar físicamente el servicio `templates-catalog.service.ts` ni el componente aislado `templates-modal`.
  - *Razón*: Permite que la aplicación mantenga una compilación limpia e inmediata sin riesgo de regresiones en dependencias, facilitando la reactivación cuando se defina la nueva estrategia para muebles preensamblados.
- **Limpieza de Ayudas en Pantalla**:
  - *Enfoque*: Actualizar el banner/aviso de lienzo vacío para que sea coherente con las herramientas de diseño directo disponibles (dibujo con herramienta rectángulo y agregado de piezas).

---

## 4. Arquitectura Técnica y Estrategia de Componentes

```
┌───────────────────────────────────────────────────────────────┐
│               BARRA SUPERIOR (Module Designer)                │
│  [Nombre Proyecto] │ [Medidas Módulo] │ [Deshacer / Rehacer]  │
│  (Botón de Plantillas retirado - Barra limpia y despejada)    │
└──────────────────────────────┬────────────────────────────────┘
                               │
       ┌───────────────────────┴────────────────────────┐
       ▼                                                ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│       Visor 3D Interactivo   │        │     Panel Lateral Derecho    │
│  - Dibujo de rectángulos 3D  │        │  - Medidas de pieza          │
│  - Medidas inferiores        │        │  - Selección de melamina     │
│  - Modificación paramétrica  │        │  - Espesor libre de taller   │
└──────────────────────────────┘        └──────────────────────────────┘
                               │
            [Servicios de Catálogo Preservados]
            (templates-catalog.service.ts inactivo en UI)
```

### Plan de Cambios Específicos
1. **`src/app/components/module-designer/module-designer.html`**:
   - Retirar el botón `Plantillas` y su disparador `(click)="openTemplatesModal()"`.
   - Retirar la etiqueta `<app-templates-modal>` de la plantilla.
   - Ajustar el texto descriptivo del estado vacío para reflejar el modelado directo.
2. **`src/app/components/module-designer/module-designer.ts`**:
   - Retirar la importación de `TemplatesModalComponent` en el arreglo `imports` del componente.
   - Marcar o simplificar las señales asociadas al modal para evitar estado muerto innecesario.
3. **Verificación**:
   - Compilación completa sin advertencias ni errores con `compile_applet`.
