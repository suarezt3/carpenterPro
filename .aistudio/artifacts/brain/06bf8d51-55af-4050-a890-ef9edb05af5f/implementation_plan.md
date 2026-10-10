# Rediseño Profesional del Catálogo de Piezas

Modernización y estilización del catálogo de piezas en la bandeja lateral de diseño, transformando los botones excesivamente redondeados en **tarjetas técnicas rectangulares profesionales** con radio equilibrado (`rounded-lg` de 8px), iconos distintivos de carpintería y subtítulos dimensionales.

---

## Decisiones Críticas Acordadas con el Usuario

> [!IMPORTANT]
> 1. **Estilo de las Piezas:** Tarjetas técnicas rectangulares redondeadas (`rounded-lg`) con icono distintivo y subtítulo dimensional de taller (L × A mm orientativo).
> 2. **Radio de Redondeo:** Curvatura moderada profesional de 8px (`rounded-lg`) en botones y tarjetas (ni circulares ni excesivamente cuadradas).
> 3. **Distribución Espacial:** Cuadrícula de 2 columnas balanceada con tarjetas enriquecidas (icono distintivo, nombre de la pieza y orientación/dimensión de taller).
> 4. **Botones de Asistente y Pieza Libre:** Adaptados al mismo radio uniforme de 8px (`rounded-lg`) con diseño sobrio y moderno para conservar consistencia en toda la bandeja.

---

## 1. Alcance y Transformación Visual

### A. Estructura de las Tarjetas Técnicas (2 Columnas)
Cada elemento del catálogo se convierte en una tarjeta técnica interactiva con:
- **Radio consistente:** `rounded-lg` (8px).
- **Contenedor visual:** Fondo `bg-slate-50 hover:bg-white`, borde sobrio `border border-slate-200/90 hover:border-sky-400 hover:shadow-xs active:scale-[0.98] transition-all`.
- **Icono técnico temático:**
  - *Techo / Barra:* Icono `horizontal_rule` / `roofing` con acento azul cielo (`text-sky-600 bg-sky-50`).
  - *Lateral Izq.:* Icono `dock` / `align_horizontal_left` con acento ámbar (`text-amber-600 bg-amber-50`).
  - *Lateral Der.:* Icono `dock` / `align_horizontal_right` con acento ámbar (`text-amber-600 bg-amber-50`).
  - *Piso / Base:* Icono `table_rows` con acento naranja (`text-orange-600 bg-orange-50`).
  - *División Vert.:* Icono `view_column` con acento amarillo cálido (`text-yellow-600 bg-yellow-50`).
  - *Repisa Interior:* Icono `view_headline` con acento esmeralda (`text-emerald-600 bg-emerald-50`).
  - *Fondo Trasero:* Icono `texture` / `flip_to_back` con acento violeta (`text-purple-600 bg-purple-50`).
  - *Puerta Batiente:* Icono `meeting_room` / `door_front` con acento azul (`text-blue-600 bg-blue-50`).
  - *Frente Cajón:* Icono `inbox` con acento índigo (`text-indigo-600 bg-indigo-50`).
  - *Zócalo Piso:* Icono `border_bottom` con acento piedra (`text-stone-600 bg-stone-50`).
- **Jerarquía tipográfica:**
  - Título principal en negrita de alta legibilidad (`text-xs font-semibold text-slate-800`).
  - Subtítulo técnico dimensional en fuente monoespaciada (`text-[10px] text-slate-500 font-mono`).

### B. Botones de Acción Especial
- **+ Crear Cajón Modular (Asistente):** Estilizado con `rounded-lg`, degradado sobrio y altura equilibrada.
- **+ Añadir Pieza Libre Personalizada:** Estilizado con `rounded-lg` y borde punteado elegante.

---

## 2. Archivos a Modificar

1. `src/app/components/module-designer/module-designer.html`:
   - Sustituir los botones redondeados (`rounded-xl` con círculos simples) en la sección `#TAB 2: PIECE CATALOG` por las nuevas tarjetas técnicas enriquecidas (`rounded-lg`) con iconos distintivos y subtítulos dimensionales.
   - Ajustar el radio de los botones del Asistente de Cajón y Pieza Libre a `rounded-lg`.

2. Verificación de compilación:
   - Ejecutar `lint_applet` para garantizar que la sintaxis y tipos del template sean estrictamente válidos.
