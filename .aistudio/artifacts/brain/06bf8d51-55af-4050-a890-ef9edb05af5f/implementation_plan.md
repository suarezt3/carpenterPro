# Plan de Transición de Marca e Identidad SaaS: Modulr 3D Studio

Este plan detalla la modernización de la identidad visual y de producto, evolucionando de MelamiPro a **Modulr 3D Studio**, un nombre escalable, memorable y de alto impacto internacional para software SaaS de mobiliario y diseño de interiores.

---

## 1. Estrategia de Marca e Isotipo

- **Nombre de Marca:** **Modulr** (con submarca descriptiva de producto: **Modulr 3D Studio** / *Modular Furniture CAD & Optimization*).
  - *Por qué destaca:* Corto, memorable, con terminación SaaS moderna (`-r`), internacional tanto en español como en inglés, y comunica la esencia modular del diseño de muebles contemporáneo y la adaptabilidad para evolucionar hacia diseño integral de interiores.
- **Nuevo Isotipo / Logo:**
  - Sustituir el ícono tradicional de martillo/carpintero genérico por un isotipo geométrico moderno de diseño modular: un prisma cúbico/isométrico tridimensional estilizado (`view_in_ar` o `dashboard_customize` con gradiente tecnológico índigo y azul cobalto).
  - Badge de versión SaaS: `SaaS Pro` o `Studio v2.4`.

---

## 2. Puntos de Implementación en la Aplicación

1. **Header Principal (`src/app/components/header/header.html` & `header.ts`)**:
   - Actualizar el isotipo y el logotipo tipográfico: `Modulr` con acento en color dinámico (`Modul` + `r` estilizado) y badge de nivel profesional.
   - Mensajes de exportación e importación con compatibilidad: soporte para archivos de proyecto `.modulr.json` y retrocompatibilidad automática con los existentes `.melamipro.json`.

2. **Index y Encabezados SEO (`src/index.html` & `metadata.json`)**:
   - Actualizar el `<title>`, `<meta name="description">`, `og:title` y `og:description` alineados a *Modulr 3D Studio*.

3. **Footer y Módulos de Reportes (`src/app/app.html`, `documentation-modal.html`, `technical-sheet-modal.html`)**:
   - Actualizar la firma de marca en el pie de página, fichas técnicas imprimibles y documentación técnica.

4. **Compatibilidad y Persistencia (`project-storage.service.ts`)**:
   - Garantizar que los proyectos existentes guardados en `localStorage` o descargados previamente sigan abriéndose sin ningún problema (alias transparentes para nombres de archivo `.modulr.json` sin romper proyectos guardados).

---

## 3. Verificación y Calidad

- Compilación limpia con `compile_applet`.
- Verificación con `lint_applet`.
- Validación visual de contraste tanto en el tema Claro (Estudio) como en el tema Oscuro (CAD).
