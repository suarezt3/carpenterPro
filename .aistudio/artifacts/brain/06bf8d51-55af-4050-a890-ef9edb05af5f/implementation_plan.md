# Herramientas CAD Profesionales: Cotas Dinámicas de Luz Libre, Moneda COP y Modal de Confirmación Estilizado

Este plan detalla la incorporación de tres mejoras solicitadas para elevar MelamiPro Studio al nivel de herramientas profesionales como SketchUp y Polyboard:
1. **Cotas Dinámicas de Luz Libre (Clearance Dimensions)**: Cálculo y renderizado 3D en tiempo real del espacio interior útil entre estantes, techos, bases y divisiones verticales (medida libre para carpintería sin sumar/restar grosores a mano).
2. **Pesos Colombianos (COP) Predeterminado & Selector Multimoneda**: Formateo numérico regional estricto (miles con puntos `$ 1.450.000 COP`, sin decimales para COP/CLP) con selector accesible tanto en la barra de configuración como en la vista de presupuesto.
3. **Sistema de Modales de Confirmación Estilizados**: Sustitución integral de los diálogos nativos `window.confirm` por un modal emergente con diseño de taller oscuro, animación suave, soporte de teclado (Escape/Enter) y advertencia visual de seguridad.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Decisiones confirmadas por el usuario en la fase interactiva:
> 1. **Moneda**: Pesos Colombianos (COP) como divisa principal predeterminada en el proyecto base y en nuevos proyectos, con formateo técnico localizado (separador de miles con punto, sin decimales molestos) y selector rápido entre COP, USD, EUR y MXN.
> 2. **Herramienta CAD Avanzada**: Cotas dinámicas de huecos libres entre estantes y divisiones verticales (luz libre milimétrica), visualizadas tanto en el visor 3D como en el dock de inspección de piezas.
> 3. **Seguridad y Eliminación**: Modal emergente personalizado estilizado en tema oscuro CAD con doble advertencia visual (icono de alerta ámbar/rojo, mensaje explicativo del impacto y botones "Cancelar" y "Eliminar definitivamente"), eliminando por completo los popups nativos del navegador.

---

## 1. Overview & Core Concept

- **Cotas Dinámicas de Luz Libre (Clearance & Bay Dimensions)**:
  - En la carpintería modular, el dato más crítico durante el despiece es la *luz libre* (el espacio útil entre dos caras internas de melamina, por ejemplo entre el piso y el primer estante para alojar un electrodoméstico o archivador).
  - El sistema detectará las piezas adyacentes en el eje vertical (Y) y horizontal (X) para calcular automáticamente el hueco libre exacto en milímetros.
  - Se habilitará un botón toggle en el visor 3D: **"Luz Libre / Cotas Útiles"** que proyecta flechas de cota interna con textos flotantes legibles y una tarjeta en el dock con las distancias a piezas vecinas.

- **Moneda Localizada (COP Predeterminado)**:
  - Inicialización de proyectos con moneda `COP` y valores de referencia reales del mercado colombiano (tableros estándar de melamina ~$180.000 - $220.000 COP, canto $1.200 - $2.500 COP/m).
  - Función de formateo centralizada: en `COP` formatea `$ 1.250.000 COP`; en `USD`/`EUR` preserva los centavos `$ 1,250.00 USD`.
  - Selector directo de moneda en la vista de presupuesto sin necesidad de navegar a configuraciones avanzadas.

- **Modal de Confirmación Estilizado (Dark CAD Confirmation Dialog)**:
  - Reemplazo de todos los `window.confirm()` en el borrado de proyectos en la nube (Supabase), eliminación de proyectos locales, vaciado del lienzo o reseteo de demos.
  - Diseño con fondo glassmorphism oscuro (`bg-black/75 backdrop-blur-sm`), tarjeta de borde rojo/ámbar, botón de acción primaria destructiva con estado de espera y cancelación rápida con la tecla `Escape`.

---

## 2. User Experience & Visual Design

### 1. Visualización 3D de Luz Libre entre Piezas

```
┌──────────────────────────────────────────────────────────────────┐
│  [TECHO 1800x600] ─── (grosor 18mm)                              │
│  │                                                            │  │
│  │   ▲                                                        │  │
│  │   │  ↕ Luz Libre: 420 mm (Espacio Útil)                    │  │
│  │   ▼                                                        │  │
│  ├────────────────────────────┤ [ESTANTE INTERMEDIO] (18mm)   │  │
│  │   ▲                                                        │  │
│  │   │  ↕ Luz Libre: 450 mm (Espacio Inferior)                │  │
│  │   ▼                                                        │  │
│  [BASE / PISO] ───────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

- En el visor 3D: Al activar el modo de cotas interiores o al seleccionar un estante/división, se generan líneas de cota de precisión en color cian/ámbar con la cota milimétrica nítida en fuente **JetBrains Mono**.
- En el panel de propiedades (dock derecho): Se añade una sección plegable **"Huecos Libres Adyacentes"**:
  - *Distancia al elemento superior*: `420 mm`
  - *Distancia al elemento inferior*: `450 mm`
  - *Luz libre lateral izquierda / derecha*: `564 mm`

### 2. Modal de Confirmación Estilizado

```
┌──────────────────────────────────────────────────────────────────┐
│  [!] ¿Eliminar proyecto de la nube?                              │
│                                                                  │
│  El proyecto "Cocina Moderna Roble" será eliminado               │
│  permanentemente de la base de datos de Supabase.                │
│  Esta acción no se puede deshacer.                               │
│                                                                  │
│                   [ Cancelar ]   [ Eliminar Definitivamente ]    │
└──────────────────────────────────────────────────────────────────┘
```

- Componente modal reutilizable que emite `confirm` o `cancel` mediante Signals o Promesas limpias.
- Soporte para variantes de severidad: `danger` (rojo para borrar proyectos/piezas) y `warning` (ámbar para restablecer demo).

### 3. Presupuesto & Formateo Multimoneda

- Cabecera de presupuesto con selector de divisa rápido:
  `[ Moneda: COP ($) ▾ ]`
- Selector sincronizado con `settings.currency` del proyecto y persistido automáticamente en local y en la nube.
- Formateo inteligente con `Intl.NumberFormat`:
  - `COP`: `$ 2.450.000 COP` (sin decimales `.00`, con punto de miles)
  - `USD`: `$ 620.50 USD`
  - `EUR`: `580,20 € EUR`
  - `MXN`: `$ 11,400.00 MXN`

---

## 3. Key Product Decisions & Trade-Offs

- **Cálculo de Luz Libre en Tiempo Real (Raycasting AABB vs Bounds Geométricos)**:
  - *Enfoque*: Cálculo matemático analítico usando las cajas de colisión (`BoundingBox`) y coordenadas `posY`, `posX`, `length`, `width` y `thickness` de las piezas en el mismo módulo o espacio cartesiano.
  - *Razón*: Extremadamente rápido ($\le 1\text{ms}$), sin sobrecargar el renderizador Three.js ni depender de físicas complejas.
- **Servicio Centralizado de Diálogos (`ConfirmDialogService`)**:
  - *Enfoque*: Servicio singleton con señales reactivas que renderiza el modal en la raíz de la aplicación (`app-confirm-dialog` en `app.html`), accesible desde cualquier componente (`header`, `module-designer`, `parts-list`).
  - *Razón*: Desacoplado, elimina por completo `window.confirm` sin ensuciar los componentes individuales con modales duplicados.
- **Valores Iniciales del Proyecto Demo en COP**:
  - *Enfoque*: Ajustar los costos unitarios del proyecto inicial a valores colombianos reales (tablero $195.000 COP, canto $1.800 COP/m, mano de obra $350.000 COP).
  - *Razón*: Brinda una experiencia inmediata y realista desde el primer segundo sin ver cifras en dólares fuera de contexto local.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           ConfirmDialogService                                 │
│  - isOpen = signal(false)                                                      │
│  - options = signal<ConfirmDialogOptions | null>(null)                         │
│  - ask(options): Promise<boolean>                                              │
└──────────────────────────────────────┬─────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼─────────────────────────────────────────┐
│                      App Root Component (app.html)                             │
│  - <app-confirm-dialog /> (Renderizado global con backdrop oscuro y atajos)   │
└────────────────────────────────────────────────────────────────────────────────┘
                                       │
      ┌────────────────────────────────┼────────────────────────────────┐
      ▼                                ▼                                ▼
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────┐
│ Header (header.ts)      │  │ ModuleDesigner          │  │ BudgetView          │
│ - Delete cloud project  │  │ - Delete piece / clear   │  │ - COP formatting    │
│ - Reset demo project    │  │ - Clearance dimensions   │  │ - Fast currency drop│
└─────────────────────────┘  └─────────────────────────┘  └─────────────────────┘
                                       │
                                       ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                   Furniture 3D Viewer (furniture-3d-viewer.ts)                 │
│  - computeClearanceDimensions(parts, selectedPart)                             │
│  - renderClearanceVisuals() -> dimensionGroup                                  │
│  - Toggle UI: [Luz Libre / Cotas Interiores]                                   │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Plan de Cambios Específicos:
1. **`src/app/services/confirm-dialog.service.ts`**: Nuevo servicio reactivo para modales de confirmación con Promesas.
2. **`src/app/components/confirm-dialog/confirm-dialog.ts` & `.html`**: Componente de modal oscuro con accesibilidad y diseño CAD.
3. **`src/app/services/project-storage.service.ts` & `melamine.models.ts`**: Configuración de moneda predeterminada `COP`, valores base en pesos colombianos y formateador numérico regional `formatCurrency(amount, currency)`.
4. **`src/app/components/budget-view/budget-view.html` & `.ts`**: Integración del selector rápido de moneda y formateo localizado en todas las tarjetas y tablas de cotización.
5. **`src/app/components/header/header.ts` & `.html`**: Reemplazo de `confirm()` por `confirmService.ask(...)` en la eliminación de proyectos en la nube y restablecimiento de demos.
6. **`src/app/components/furniture-3d-viewer/furniture-3d-viewer.ts` & `.html`**: Motor de cálculo de distancias libres (luz útil) entre piezas adyacentes, visualización 3D y toggle de visualización.
7. **`src/app/components/module-designer/module-designer.html` & `.ts`**: Indicadores de luz libre superior, inferior y lateral en el dock de inspección de piezas.
