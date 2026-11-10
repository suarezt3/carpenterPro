# Directriz Global: Tipografía Inter y Paleta Oficial "Minimalist Studio" (Regla 60-30-10)

## 1. Tipografía Global Obligatoria
- **Textos de Interfaz (`--font-sans`):** Exclusivamente la fuente **Inter** (`font-family: var(--font-sans)`). Todos los textos, botones, modales, menús, etiquetas, inputs y placeholders deben usar Inter.
- **Cifras y Medidas Técnicas (`--font-numeric`):** Exclusivamente la fuente **JetBrains Mono** (`font-family: var(--font-numeric); font-variant-numeric: tabular-nums;`) aplicada a cotas, milímetros (`mm`), despieces, contadores y mediciones técnicas para legibilidad numérica y espaciado tabular óptimo.

## 2. Paleta Oficial "Minimalist Studio" (Regla 60-30-10)
- **60% Fondos y Superficies Neutras:**
  - Blanco Puro: `#FFFFFF` (`bg-white`) para tarjetas, paneles, tablas y modales.
  - Gris Piedra Suave: `#FAFAFA` (`bg-zinc-50`) y `#F4F4F5` (`bg-zinc-100`) para fondos de sección, contenedores secundarios y cajas de iconos.
- **30% Estructura, Textos, Pestañas Activas y Botones Principales (Grafito):**
  - Negro Grafito Principal: `#18181B` (`bg-zinc-900`, `text-zinc-900`, hover `#27272A` / `bg-zinc-800`) para **todos los botones de acción primaria**, cabeceras oscuras, pestañas seleccionadas y títulos principales.
  - Gris Grafito Medio: `#52525B` (`text-zinc-600`) y `#71717A` (`text-zinc-500`) para subtítulos y textos secundarios.
  - Bordes Arquitectónicos: `#E4E4E7` (`border-zinc-200`) y `#D4D4D8` (`border-zinc-300`).
- **10% Acento Técnico Puntual (Azul Acero):**
  - Azul Acero Sobrio: `#0284C7` (`text-sky-600`, `border-sky-600`, fondo suave `#F0F9FF` / `bg-sky-50`) reservado **exclusivamente** para enlaces puntuales, indicadores de selección/cotas en el visor 3D y detalles de énfasis sutil.

## 3. Uso Estrictamente Restringido de Colores Semánticos (Prohibido su uso decorativo)
- **Rojo (`#DC2626` / `red-600`):** Exclusivo para colisiones 3D, errores de validación de formularios y acciones destructivas.
- **Verde Esmeralda (`#059669` / `emerald-600`):** Exclusivo para checks de validación aprobada (requisitos de contraseña o confirmaciones).
- **Ámbar (`#D97706` / `amber-500`):** Exclusivo para las 5 estrellas de calificación de testimonios y alertas de advertencia.
- **Prohibición Estricta:** Eliminar todos los colores morados, violetas, índigos, fucsias, rosas, naranjas o amarillos decorativos y eliminar cualquier degradado (`from-blue-600 to-purple-600`) en todo el proyecto.
