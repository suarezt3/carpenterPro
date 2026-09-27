# Plan de Implementación: MelamiPro Studio (Diseñador, Despiece y Optimizador 2D de Melamina)

MelamiPro Studio es una aplicación web integral en Angular para carpinteros, diseñadores y fabricantes de muebles de melamina. Sustituye herramientas de pago (como MuebleMIO, Flatman, Cutting Optimization Pro, MaxCut) permitiendo diseñar muebles modulares paramétricos, generar despieces automáticos con tapacantos y veta, optimizar patrones de corte 2D tipo guillotina (respetando espesor de sierra o *kerf* y refilado), calcular costos detallados e imprimir etiquetas con identificación para el taller.

---

## 1. Arquitectura Técnica & Tecnologías

- **Frontend & Lógica**: Angular 21 (Zoneless, Signals, OnPush, Reactive Forms).
- **Diseño & Estilo**: Tailwind CSS 4, Google Material Icons.
- **Visualizador Modular 3D / Isométrico**:
  - Vista interactiva del mueble ensamblado con controles para rotar, explosionar piezas o ver estructura interna en rayos X / alambre.
- **Motor de Optimización 2D de Corte (2D Guillotine Bin Packing)**:
  - Algoritmo heurístico de corte guillotina real (cortes lineales de borde a borde factibles en sierras escuadradoras y seccionadoras).
  - Configuración de espesor de disco de sierra (*kerf*, ej. 3.2 mm / 4 mm) y refilado/saneado perimetral del tablero (ej. 10 mm).
  - Respeto del sentido de la veta del tablero (horizontal, vertical o indiferente/sin veta).
  - Deducción de espesor de tapacantos/cubrecantos (delgado 0.45mm, grueso 1mm / 2mm) sobre las medidas reales de corte del tablero.
- **Persistencia & Portabilidad**:
  - Almacenamiento local persistente con guardado automático.
  - Exportación e importación de proyectos en formato `.json` descargable e importable sin depender de servidores externos.
  - Exportación de listas de despiece a formato CSV.
- **Módulo de Costos y Lista de Materiales (BOM)**:
  - Tableros de melamina requeridos, fondos MDF 3mm.
  - Metros lineales de tapacanto (delgado vs grueso).
  - Herrajes automáticos según muebles (bisagras, correderas telescópicas, tiradores, tornillos 4x50, tarugos, patas niveladoras).
  - Configuración de precios unitarios y cálculo de presupuesto con margen de ganancia comercial.
- **Centro de Impresión y Etiquetas de Taller**:
  - Plano de corte por tablero con medidas y orden de piezas listo para imprimir.
  - Generador de etiquetas para piezas cortadas con medidas brutas de corte, medidas netas finales, lados con tapacanto (L1, L2, A1, A2) y nombre del módulo.

---

## 2. Fases de Desarrollo

### Fase 1: Estructuras de Datos y Biblioteca de Módulos Paramétricos
- Modelado de muebles:
  - Mueble bajo de cocina (con puertas, repisa interna, zócalo o patas).
  - Mueble aéreo / alacena.
  - Cajonera (3 o 4 cajones con descuento de correderas de 25-26mm total).
  - Ropero / Closet / Armario con divisiones.
  - Mueble personalizado / libre (para agregar cualquier pieza a medida).

### Fase 2: Diseñador Interactivo de Módulos
- Ajuste en tiempo real de dimensiones generales (ancho, alto, profundidad, espesor de melamina: 15mm, 18mm, etc.).
- Vista previa 3D/isométrica interactiva con despiece visual (modo ensamble vs modo explosionado).
- Generación automática del despiece: laterales, techo, base, repisas, zócalos, frentes de cajón, cajones y fondo.

### Fase 3: Gestor de Lista de Corte (Despiece)
- Tabla completa y editable con todas las piezas del proyecto agrupadas por material y espesor.
- Asignación gráfica de tapacantos (Largo 1, Largo 2, Ancho 1, Ancho 2) y selector de veta.
- Botón para agregar piezas manuales personalizadas adicionales.

### Fase 4: Algoritmo de Optimización de Corte 2D (Guillotine Packing)
- Algoritmo de corte guillotina 2D que ubica las piezas maximizando el aprovechamiento del tablero comercial.
- Parámetros: medidas de tablero (ej. 2440 x 1830 mm, 2500 x 1830 mm, etc.), espesor de corte de sierra (*kerf*), refilado perimetral.
- Renderizado interactivo en Canvas del plano de corte por cada tablero utilizado, con cotas, colores por módulo y cálculo de porcentaje de merma/desperdicio.

### Fase 5: Presupuesto, Costos & Lista de Herrajes (BOM)
- Desglose de materiales y herrajes requeridos.
- Precios editables en tiempo real con cálculo automático de costo de fabricación y precio de venta recomendado.

### Fase 6: Módulo de Etiquetas Imprimibles y Exportación
- Vista lista para imprimir con diseño de etiquetas industriales para cada pieza.
- Exportación e importación de proyectos en JSON y descarga de plan de corte.

---

## 3. Verificación y Calidad
- Pruebas con proyectos completos de carpintería (cocina o closet con múltiples módulos).
- Comprobación matemática de descuentos de tapacanto y correderas de cajón.
- Verificación de compilación estricta de TypeScript y Angular AOT.
