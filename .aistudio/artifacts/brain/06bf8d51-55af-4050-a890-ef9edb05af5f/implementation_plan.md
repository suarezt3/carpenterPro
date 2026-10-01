# Herramientas CAD Profesionales: Mecanizados Automáticos, Detección de Colisiones 3D, Exportación DXF CNC y Planos Técnicos 2D en PDF

Este plan define la arquitectura e implementación de cuatro capacidades avanzadas de ingeniería y fabricación de muebles para MelamiPro Studio, inspiradas en los estándares de la industria como **SketchUp, AutoCAD, Polyboard y seccionadoras CNC de centros de corte (Madecentro, Masisa, Arauco)**.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> A continuación se detallan las decisiones acordadas a partir de las preferencias de taller confirmadas en la Fase 1:

- **Sistema de Ensamble y Mecanizado Predeterminado (Confirmado)**: 
  Tornillo soberbio estándar de ensamble 4x50 mm (taladro pasante Ø4.5 mm avellanado en cara y taladro de guía Ø3.0 mm en canto), espigas/tarugos de madera 8x30 mm (orificios Ø8x20 mm para alineación sin desfasaje), y cazoletas para bisagras de cazoleta estándar Ø35 mm a 22 mm de borde en frentes y puertas.
- **Detección de Colisiones 3D (Confirmado)**:
  Resaltado visual en color rojo rubí translúcido (`#ef4444`) con bordes pulsantes en las piezas en conflicto, acompañado de un indicador HUD contextual en el visor 3D que indica en milímetros la penetración física y las piezas involucradas.
- **Exportación Técnica Dual (Confirmado)**:
  Soporte completo para ambos canales de taller:
  1. Archivo vectorial **DXF R12/2000** estructurado por capas (`PIEZAS_CONTORNO`, `MECANIZADOS_PERFORACIONES`, `TAPACANTOS`, `ROTULOS_TEXTO`) compatible con AutoCAD, Rhino, Aspire y centros de corte seccionadoras.
  2. **Planos Técnicos 2D en PDF** acotados para armado en taller, con vistas ortográficas (Frontal, Lateral y Superior), cotas milimétricas continuas y cuadro de rotulación estándar de carpintería.

---

## 1. Overview & Core Concept

### What It Does
1. **Mecanizados y Perforaciones Paramétricas en 3D**: Al detectar uniones a 90° entre piezas (ej. laterales con piso/techo, divisiones con estantes fijos), el software computa matemáticamente las coordenadas de taladrado y las renderiza en 3D como marcas de perforación y orificios cilíndricos, detallando el diámetro y profundidad en el inspector lateral.
2. **Sistema de Alerta de Colisiones e Interferencias en Tiempo Real**: Durante el arrastre con gizmo, teclado o edición de medidas, el motor evalúa solapamientos volumétricos entre paneles. Si dos placas se interpenetran, se tiñen de rojo y alertan al usuario antes de enviar a corte tableros con medidas erróneas.
3. **Exportador Vectorial DXF CNC**: Generador de geometría vectorial CAD estándar en formato `.dxf` descargable con un clic, con capas diferenciadas para corte y mecanizado.
4. **Generador de Planos Técnicos 2D de Fabricación (PDF)**: Proyección ortográfica vectorial que dibuja el alzado frontal acotado, alzado lateral y vista en planta, con su respectiva lista de corte, materiales y cuadro de firma de cliente.

### Target Audience & Persona
- **Carpinteros y Diseñadores de Mobiliario**: Que necesitan cotas de armado claras para sus operarios sin tener que dibujar planos a mano.
- **Centros de Servicio y Corte (Madecentro, Masisa, etc.)**: Que requieren archivos DXF o listas de perforación para alimentar máquinas seccionadoras y centros de maquinado CNC (Point-to-Point).

---

## 2. User Experience & Visual Design

### Key User Flows

#### Flujo 1: Inspección y Control de Perforaciones de Ensamble (Mecanizados)
1. El usuario diseña el mueble en el visor 3D.
2. En la barra superior del visor 3D, activa el botón conmutador **"Perforaciones"** (icono `fiber_manual_record` / `settings_overscan`).
3. El visor 3D dibuja en las caras y cantos los orificios correspondientes a tornillos soberbios (a 50 mm de los extremos) y tarugos centrados.
4. Al seleccionar una pieza en el panel derecho, una nueva tarjeta **"Mecanizados de Ensamble"** lista el desglose exacto (ej. *"Cara Izq: 2 orificios Ø4.5mm pasantes", "Canto Frontal: 2 orificios Ø8x20mm para tarugos"*).

#### Flujo 2: Detección y Resolución de Colisiones
1. Si el usuario alarga un estante o mueve una división hasta invadir el lateral, ambas piezas se iluminan instantáneamente en color rojo translúcido.
2. En la esquina superior derecha del lienzo 3D aparece un aviso flotante de alta visibilidad:
   `⚠️ Interferencia detectada: [ESTANTE_01] invade [LATERAL_DER] en 18 mm`.
3. Al hacer clic en el aviso o al corregir la medida/posición, la alerta desaparece y las piezas recuperan su acabado de melamina natural.

#### Flujo 3: Exportación DXF para CNC
1. En la barra de herramientas superior o en la pestaña **Optimización de Corte**, el usuario hace clic en el nuevo botón **"Exportar DXF CNC"** (icono `file_download` o `architecture`).
2. Se genera al instante un archivo `.dxf` estándar listo para descargar (`plano_mecanizado_[nombre].dxf`), con todas las piezas distribuidas ordenadamente en 2D con sus círculos de perforación y capas de color normalizadas.

#### Flujo 4: Generación y Descarga de Plano Técnico 2D en PDF
1. El usuario hace clic en **"Plano Técnico 2D (PDF)"**.
2. Se abre un modal de vista previa técnica en tema oscuro CAD con el plano en alta resolución:
   - Vista Frontal acotada (ancho total, alturas de baldas, zócalos).
   - Vista Lateral acotada (profundidad, fondos ranurados).
   - Vista Superior acotada.
   - Cuadro de rotulación (Proyecto, Cliente, Fecha, Melaminas, Escala).
3. Botón para imprimir directamente o descargar como PDF vectorial de alta precisión.

### Visual Identity & Theme
- **Colores de Interferencia**: Rojo rubí saturado (`#ef4444`, `rgba(239, 68, 68, 0.45)`) con trazo técnico nítido.
- **Colores de Mecanizado**: Azul cian (`#06b6d4`) para tornillos soberbios, naranja ámbar (`#f59e0b`) para tarugos de madera, y violeta (`#8b5cf6`) para cazoletas de bisagra.
- **Lámina de Plano Técnico 2D**: Estilo papel plano de ingeniería (fondo blanco técnico limpio `#fcfcfc`, líneas en gris grafito `#1e293b`, cotas en azul técnico `#0284c7`, textos en JetBrains Mono tabular y Plus Jakarta Sans).

---

## 3. Key Product Decisions & Trade-Offs

### Decisión 1: Generación Vectorial Nativa de DXF vs Dependencias Externas Pesadas
- **Enfoque Elegido**: Servicio TypeScript nativo generador de DXF R12/2000 (`dxf-exporter.service.ts`).
- **Por qué**: El estándar ASCII DXF es universal, ultra liviano, no añade bloatware ni problemas de compilación, y garantiza compatibilidad total con AutoCAD, Aspire, Fusion 360, SketchUp y seccionadoras CNC comerciales.
- **Alternativa descartada**: Librerías pesadas de Node/NPM incompatibles con Vite o entornos de navegador.

### Decisión 2: Detección de Colisiones 3D Geométrica Pura vs Motor de Físicas Complejo
- **Enfoque Elegido**: Algoritmo de intersección AABB orientado en 3D (`THREE.Box3` con cálculo de volumen de penetración y umbral de holgura de 0.5 mm).
- **Por qué**: Proporciona cálculo en 60 FPS sin retraso durante el arrastre con gizmo, sin la sobrecarga de simulación física (como Ammo o Cannon) que no aplica a piezas rígidas ortogonales de carpintería.

### Decisión 3: Renderizado de Planos 2D en SVG Escalar Vectorial + PDF
- **Enfoque Elegido**: Motor de proyección ortográfica 2D que calcula las cotas y vistas en SVG vectorial escalable con precisión milimétrica, renderizable en pantalla con zoom y exportable a PDF con `window.print()` / jsPDF.
- **Por qué**: Garantiza que las líneas de cota, flechas y textos nunca se pixelan en pantallas Retina/4K ni al imprimir en papel A4/A3 de taller.

---

## 4. Technical Architecture & Data Strategy

### Diagrama del Sistema CAD

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MelamiPro Studio CAD Core                       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ Joinery &        │      │ Collision        │      │ Technical Export │
│ Drilling Engine  │      │ Detection Engine │      │ Engine           │
│                  │      │                  │      │                  │
│ • Contact Face-  │      │ • Box3 Intersect │      │ • DXF R12 Maker  │
│   Edge Analysis  │      │ • Penetration    │      │   - Layers       │
│ • 4x50mm Screws  │      │   Volume Math    │   - Toolpaths    │
│ • 8x30mm Dowels  │      │ • Emissive Red   │      │ • 2D Ortho PDF   │
│ • 35mm Hinges    │      │   Highlighting   │      │   - Front/Side/Top│
└─────────┬────────┘      └─────────┬────────┘      └─────────┬────────┘
          │                         │                         │
          ▼                         ▼                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Furniture 3D Viewer & UI Dock Layer                  │
│                                                                        │
│ • 3D Cylindrical Drill Marks & Toolpath Gizmos (Conmutador On/Off)     │
│ • Floating Collision Warning HUD with mm overlap details               │
│ • Dock Inspector Card: Desglose de Perforaciones y Ensambles           │
│ • Modals: Previsualización de Plano 2D y Descargador DXF               │
└────────────────────────────────────────────────────────────────────────┘
```

### Modelos de Datos (TypeScript)

```typescript
export interface DrillHole {
  id: string;
  type: 'screw_4x50' | 'dowel_8x30' | 'hinge_35' | 'shelf_pin_5';
  diameter: number; // mm
  depth: number; // mm
  posX: number;
  posY: number;
  posZ: number;
  axis: 'x' | 'y' | 'z';
  surface: 'face_front' | 'face_back' | 'edge_top' | 'edge_bottom' | 'edge_left' | 'edge_right';
  targetPartName?: string;
}

export interface CollisionRecord {
  partAId: string;
  partAName: string;
  partBId: string;
  partBName: string;
  overlapX: number;
  overlapY: number;
  overlapZ: number;
  penetrationVolumeMm3: number;
}
```

---

## Plan de Implementación Paso a Paso

### Paso 1: Motor de Detección de Colisiones e Interferencias 3D
- Implementar algoritmo de chequeo de colisión entre cajas 3D en `furniture-3d-viewer.ts`.
- Aplicar material de resaltado rojo translúcido (`#ef4444`) a las piezas involucradas.
- Añadir el banner HUD de colisión en `furniture-3d-viewer.html` con contador y detalles de solapamiento en milímetros.

### Paso 2: Motor de Ensamble y Perforaciones Paramétricas (Mecanizados)
- Desarrollar servicio `joinery-engine.service.ts` para computar contactos de canto-cara a 90°.
- Calcular posiciones de tornillos soberbios 4x50 mm (a 50 mm de los bordes) y tarugos 8x30 mm.
- Renderizar marcas visuales de taladros en el visor 3D con conmutador en la barra superior.
- Añadir tarjeta de mecanizados en el inspector lateral (`module-designer.html`).

### Paso 3: Servicio Exportador Vectorial DXF para Centros de Corte y CNC
- Crear servicio `dxf-exporter.service.ts` con generación de capas AutoCAD R12:
  - `PIEZAS_CONTORNO` (blanco/cyan)
  - `MECANIZADOS_PERFORACIONES` (rojo)
  - `TAPACANTOS` (amarillo)
  - `ROTULOS_TEXTO` (verde)
- Integrar botón de descarga DXF en la barra superior y pestaña de piezas.

### Paso 4: Motor de Proyección Ortográfica y Planos Técnicos 2D en PDF
- Crear componente `technical-sheet-modal` con las tres vistas ortográficas proyectadas (Frontal, Lateral, Superior) totalmente acotadas.
- Cuadro de rotulación con datos del proyecto, cliente, materiales y fecha.
- Soporte para impresión directa en alta resolución y descarga PDF.

---

## Verificación y Calidad
1. **Pruebas en Visor 3D**: Verificar que al desplazar una pieza y solaparla con otra se active la alarma roja de colisión de inmediato.
2. **Pruebas de Mecanizado**: Comprobar que los laterales y bases muestren los puntos de perforación precisos según las reglas de carpintería.
3. **Validación DXF**: Verificar la integridad del archivo `.dxf` generado abriéndolo o revisando la sintaxis de entidades estándar.
4. **Validación del Plano 2D**: Comprobar que las cotas coincidan exactamente con las medidas reales del mueble.
5. **Compilación y Linter**: Ejecutar `compile_applet` y `lint_applet` para garantizar cero errores de compilación y cumplimiento de accesibilidad.
