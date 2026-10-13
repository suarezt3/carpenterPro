# Asistente Paramétrico de Plantillas & Módulos

Asistente interactivo de diseño paramétrico para muebles (cocinas, closets, vanitorios y estanterías) con tema visual claro y ergonómico, que genera módulos ensamblados en 3D con control total de dimensiones, puertas, manijas y entrepaños.

### User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones confirmadas por el usuario en la fase de clarificación**:
> - **Apertura Directa**: Al hacer clic en el botón superior **"Plantillas"**, se abre de inmediato el nuevo Asistente Paramétrico Interactivo (similar al flujo ágil y directo de *Crear Cajón Modular*), sin catálogos estáticos oscuros ni pantallas intermedias.
> - **Estilo Visual & UI/UX**: Tema claro moderno dominado por blanco (`bg-white`), pizarra suave (`slate-50`, `slate-100`, `slate-200`) y acentos sutiles índigo/cielo (`sky-600`, `indigo-600`), erradicando contrastes negros agresivos y tipografías pesadas.
> - **Distribución de Entrepaños**: Distribución uniforme automática por defecto con selector para conmutar a ajuste manual milimétrico de la cota de cada repisa.
> - **Edición Post-Creación**: Todas las piezas generadas se integran como un grupo paramétrico en el proyecto, permitiendo cambiar el material/color de forma global al módulo o individualmente a cada pieza en el inspector 3D.

---

### 1. Overview & Core Concept

- **Qué hace**: Proporciona una herramienta interactiva para carpinteros, diseñadores de interiores y fabricantes que deseen generar muebles modulares completos (alacenas, muebles bajos, armarios, vanitorios, módulos abiertos) especificando sus cotas exteriores (ancho, alto, fondo), el espesor de la melamina (15 mm, 18 mm, etc.), configuración de puertas (sin puerta, apertura izquierda, derecha, doble puerta, elevable), manijas y estantes/entrepaños.
- **Público Objetivo**: Fabricantes y diseñadores que necesitan un flujo rápido, confiable y sin fallas de cálculo para diseñar muebles y obtener de inmediato su despiece, cotas y visualización 3D.
- **Valor Principal**: Elimina los errores de cálculo geométrico y colisiones entre paneles, ofrece una interfaz limpia y luminosa, y garantiza que cada pieza resultante sea editable en acabados y medidas.

---

### 2. User Experience & Visual Design

#### Flujo de Usuario Paso a Paso
1. **Acceso Inmediato**: El usuario pulsa el botón **"Plantillas"** en la barra superior.
2. **Asistente Modular Paramétrico**: Se despliega el modal en tema claro con preajustes de tipo de mueble:
   - *Módulo Base / Bajo* (con patas o zócalo opcional)
   - *Alacena / Módulo Alto*
   - *Armario / Closet*
   - *Vanitorio / Mueble Baño*
   - *Estantería / Módulo Abierto*
3. **Formulario Paramétrico Intuitivo**:
   - **Dimensiones Generales**: Alto ($H$), Ancho ($W$), Fondo ($D$) con controles numéricos rápidos y presets estándar.
   - **Espesor de Estructura**: Selector de melamina (15 mm, 18 mm o personalizado).
   - **Puertas**: Conmutador [Sin Puerta | 1 Puerta Izquierda | 1 Puerta Derecha | 2 Puertas Dobles | Puerta Elevable].
   - **Manijas**: Toggle [Con Manija / Sin Manija] con selector de acabado y posición.
   - **Entrepaños**: Número de entrepaños (0 a 8) y modo de distribución:
     - *Automático Uniforme*: Calcula la luz interior libre y distribuye los entrepaños con espaciado idéntico.
     - *Manual*: Despliega deslizadores o campos numéricos para fijar la altura exacta de cada entrepaño desde la base.
   - **Material & Color Inicial**: Selector visual de melaminas disponibles en el proyecto.
4. **Inserción & Grupo 3D**: Al pulsar **"Crear Módulo"**, se generan todas las piezas perfectamente dimensionadas y alineadas en el visor 3D, agrupadas bajo un nombre descriptivo y seleccionadas listas para desplazar o personalizar.

#### Identidad Visual & Paleta
- **Canvas & Superficies (60%)**: Blanco puro (`#FFFFFF`) y pizarra ultra suave (`#F8FAFC`, `#F1F5F9`) para fondos y tarjetas.
- **Bordes & Separadores (30%)**: Líneas finas sutiles (`border-slate-200`, `border-slate-300/80`) sin sombras negras saturadas ni cajas oscuras.
- **Acentos Funcionales (10%)**: Azul cielo (`sky-600`) e índigo moderno (`indigo-600`) para botones primarios, estados activos y focos de entrada.
- **Tipografía**: Jerarquía clara con `Plus Jakarta Sans` / `Outfit`, números tabulares (`tabular-nums`) para todas las dimensiones y etiquetas de cota legibles.

---

### 3. Key Product Decisions & Trade-Offs

- **Decisión 1: Sustitución del Antiguo Modal Oscuro por el Nuevo Asistente Integrado**
  - *Enfoque*: Reemplazar el modal de fondo negro y tarjetas de contrastes bruscos por el nuevo componente `CabinetWizardComponent` (o extensión paramétrica de `TemplatesModalComponent` en modo asistente claro).
  - *Por qué*: Resuelve directamente la queja del usuario sobre contrastes agresivos y módulos que no se construían adecuadamente.
  - *Alternativa descartada*: Mantener una pestaña de catálogo oscuro; el usuario solicitó específicamente abrir el asistente interactivo directo.

- **Decisión 2: Algoritmo de Cálculo Preciso de Piezas Ensambladas**
  - *Enfoque*: Calcular las piezas con ingeniería real de despiece:
    - Laterales: $H \times D$
    - Techo y Piso: $(W - 2 \cdot e) \times D$ (o montantes según sistema constructivo)
    - Entrepaños: $(W - 2 \cdot e) \times (D - \text{holgura frontal})$
    - Puertas: con holgura perimetral estándar (1.5 mm por lado) para evitar roces
    - Trasera opcional: MDF 3 mm ranurado o sobrepuesto
  - *Por qué*: Garantiza que las piezas no se traslapen en el motor 3D y el cálculo de corte sea 100% exacto para carpintería.

- **Decisión 3: Compatibilidad y Edición Posterior de Materiales**
  - *Enfoque*: Cada pieza generada se etiqueta con su rol (`side_left`, `shelf`, `door`, `top`, `bottom`) y se vincula al grupo del mueble. Desde el panel lateral de propiedades o el menú contextual, el usuario puede cambiar el color de una pieza o de todo el grupo con 1 clic.

---

### 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────────┐
│                    Barra Superior (CAD)                      │
│                [ Módulo ]  [ Plantillas ]                    │
└────────────────────────────────┬─────────────────────────────┘
                                 │ Clic abre asistente
                                 ▼
┌──────────────────────────────────────────────────────────────┐
│             Nuevo Asistente Paramétrico Modular              │
│  (Tema claro: blanco, pizarra suave y acentos sky/indigo)    │
│                                                              │
│  ┌───────────────────────┐  ┌─────────────────────────────┐  │
│  │ 1. Tipo & Dimensiones │  │ 3. Entrepaños               │  │
│  │    W x H x D (mm)     │  │    [Uniforme / Manual]      │  │
│  │    Espesor melamina   │  │    Cantidad (0-8)           │  │
│  ├───────────────────────┤  ├─────────────────────────────┤  │
│  │ 2. Puertas & Manijas  │  │ 4. Resumen & Material       │  │
│  │    [Izq/Der/Doble/Sin]│  │    Selector de color/textura│  │
│  │    [Con/Sin Manija]   │  │    Vista previa de despiece │  │
│  └───────────────────────┘  └─────────────────────────────┘  │
│                                                              │
│            [ Cancelar ]     [ Crear Módulo 3D ]              │
└────────────────────────────────┬─────────────────────────────┘
                                 │ Emite configuración
                                 ▼
┌──────────────────────────────────────────────────────────────┐
│                  ProjectService / Motor 3D                   │
│  1. Genera grupo con N piezas calculadas milimétricamente    │
│  2. Asigna materiales y etiquetas constructivas              │
│  3. Posiciona el módulo en escena 3D y enfoca selección      │
│  4. Habilita edición posterior de material/color             │
└──────────────────────────────────────────────────────────────┘
```

#### Modelo de Datos Paramétrico
```typescript
export interface ParametricCabinetWizardConfig {
  name: string;
  category: 'kitchen_base' | 'kitchen_wall' | 'closet' | 'vanity' | 'bookshelf';
  width: number;           // Ancho exterior en mm
  height: number;          // Alto exterior en mm
  depth: number;           // Fondo exterior en mm
  structureThickness: number; // 15 o 18 mm
  doorConfig: 'none' | 'left' | 'right' | 'double' | 'lift_up';
  doorThickness: number;   // 15 o 18 mm
  hasHandle: boolean;
  handleType?: HandleType;
  handleFinish?: HandleFinish;
  shelvesCount: number;    // 0 a 8
  shelfDistribution: 'uniform' | 'manual';
  shelfManualOffsets?: number[]; // Alturas desde la base interior
  hasBackPanel: boolean;
  backThickness: number;   // 3 mm MDF
  materialId: string;
  doorMaterialId?: string;
  elevationY?: number;     // Altura respecto al piso
}
```

#### Mapeo de Estados y Controladores
- **`openTemplatesWizard()`**: Inicializa el estado reactivo con valores amigables y preconfigura dimensiones según el tipo de mueble seleccionado.
- **`calculateShelvesDistribution()`**: Distribución matemática de estantes con cotas precisas:
  $$\text{Espacio Libre} = \frac{H_{\text{interior}} - (N \cdot e_{\text{estante}})}{N + 1}$$
- **`generateCabinetParts()`**: Ensamblador constructivo que crea las mallas 3D sin colisiones y las añade al `ProjectService`.
- **`updateGroupMaterial()`**: Permite que al seleccionar el mueble en el visor o en la lista, se pueda alterar el material de todas las piezas o de una pieza específica inmediatamente.
