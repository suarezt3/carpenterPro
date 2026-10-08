# Espesor por Defecto a 15mm en Piezas Nuevas

Ajuste del estándar de espesor base en todo el diseñador 3D para que cualquier pieza nueva insertada (desde el catálogo de piezas o dibujada interactivamente con la herramienta rectángulo) nazca automáticamente con un grosor de 15 mm, manteniendo el fondo trasero en MDF de 3 mm según las normas de taller.

## Decisiones Críticas y Confirmadas

> [!IMPORTANT]
> Decisiones confirmadas por el usuario:
> - **Catálogo de Piezas**: Techo/Cubierta, Laterales (izq/der), Piso/Base, Divisiones, Repisas, Puertas, Frentes de Cajón y Zócalos utilizarán 15 mm por defecto.
> - **Fondo Trasero**: Mantiene su espesor de taller de 3 mm (MDF/Durolac).
> - **Herramientas de Dibujo y Piezas Libres**: Los rectángulos dibujados interactivamente en el visor 3D y las piezas añadidas desde "+ Añadir Pieza Libre Personalizada" también se generarán con 15 mm por defecto (elevación `posY = y + 7.5 mm`).

---

## 1. Visión General y Alcance

Actualmente, el diseñador tenía configurado `18 mm` como espesor por defecto al insertar piezas nuevas desde el catálogo y al trazar rectángulos en el visor 3D. Este cambio alinea la creación de componentes al estándar de melamina de 15 mm ampliamente utilizado en carpintería y fabricación a medida, respetando los 3 mm para fondos acanalados o traseros.

---

## 2. Experiencia de Usuario y Flujo de Trabajo

1. **Inserción desde Catálogo**:
   - Al pulsar cualquiera de los botones del catálogo de piezas (ej. *+ Lateral Izq.*, *+ Techo / Barra*, *+ Repisa Interior*), la pieza se sitúa con espesor inicial de **15 mm**.
   - El panel de propiedades lateral mostrará de inmediato `Espesor: 15 mm`.
2. **Dibujo de Rectángulo 3D**:
   - Al arrastrar sobre el suelo o sobre otra pieza con la herramienta de Rectángulo 3D, el volumen extruido inicial tendrá **15 mm** de grosor con su centro vertical ajustado exactamente a `+7.5 mm`.
3. **Pieza Libre / Personalizada**:
   - El formulario y valores por defecto para piezas manuales asignarán **15 mm** como valor de partida.
4. **Fondo Trasero**:
   - Al seleccionar *+ Fondo Trasero*, se preserva en **3 mm** para encajar con respaldos de MDF estándar.

---

## 3. Decisiones de Producto y Compensaciones

- **Alineación de Posición Y en 3D**:
  - Al cambiar de 18 mm a 15 mm, la altura relativa del centroide en piezas horizontales creadas sobre el suelo pasa de `y + 9` a `y + 7.5` para que la cara inferior descanse perfectamente sobre la superficie de referencia sin flotar ni solaparse.
- **Materiales y Texturas**:
  - Las piezas nuevas buscarán por defecto el material de melamina activo del proyecto y adoptarán el espesor de 15 mm asignado a la pieza.

---

## 4. Arquitectura Técnica y Estrategia de Componentes

```
┌───────────────────────────────────────────────────────────────┐
│                    CATÁLOGO DE PIEZAS (DOCK)                  │
│   [+ Techo]  [+ Lateral Izq]  [+ Piso]  [+ Repisa]  ...       │
│                --> defaultThickness = 15 mm                   │
│   [+ Fondo Trasero]                                           │
│                --> backThickness = 3 mm                       │
└──────────────────────────────┬────────────────────────────────┘
                               │
       ┌───────────────────────┴────────────────────────┐
       ▼                                                ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│  module-designer.ts          │        │  furniture-3d-viewer.ts      │
│  - defaultT = 15             │        │  - Rectángulo 3D:            │
│  - onPartCreatedFromViewer:  │        │    thickness: 15             │
│    thickness: 15             │        │    posY: startY + 7.5        │
└──────────────────────────────┘        └──────────────────────────────┘
```

### Archivos a Modificar
1. **`src/app/components/module-designer/module-designer.ts`**:
   - Cambiar `const defaultT = 18;` a `15;` en `addPieceFromCatalog()`.
   - Actualizar `onPartCreatedFromViewer()` para asignar `thickness: partData.thickness || 15`.
   - Ajustar el cálculo de elevación inicial en piezas como Techo y Piso (`posY: 80 + defaultT / 2`).
2. **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts`**:
   - En la finalización del trazo de rectángulo (`isDrawingRect`), cambiar `thickness: 15` y `posY = this.rectStartPoint.y + 7.5`.
3. **`src/app/components/parts-list/parts-list.ts`**:
   - Ajustar el formulario de creación manual (`thickness: [15, ...]`).
4. **Verificación**:
   - Ejecutar `compile_applet` y `lint_applet` para confirmar la ausencia de errores.
