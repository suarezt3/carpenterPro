# Plan de Implementación: Gavetas Completas de 5 Piezas, Montaje Real de Correderas y Mecanizados Técnicos

A partir de tus respuestas y observaciones, implementaremos una solución integral para que los cajones sean muebles reales completos tanto en el visor 3D como en la lista de despiece y corte:

---

## 1. Construcción Completa de Gaveta (Caja de Cajón de 5 Piezas)
Actualmente varias plantillas y generadores solo colocaban la tapa frontal exterior. Implementaremos la estructura completa y paramétrica de la gaveta:
- **Tapa de Frente Decorativo:** Frente exterior con recubrimientos/holguras periféricas estándar (1.5mm a 2mm).
- **Caja de Gaveta (5 piezas):**
  1. **Lateral Izquierdo Gaveta:** Con holgura lateral estándar (12.7 mm respecto al costado del mueble para correderas telescópicas).
  2. **Lateral Derecho Gaveta:** Con holgura lateral estándar de 12.7 mm.
  3. **Frente Interior Gaveta:** Conectado a los laterales de gaveta.
  4. **Trasera Gaveta:** Descontada para dejar espacio a la profundidad del fondo.
  5. **Fondo Gaveta:** Pieza horizontal (MDF/Melamina 3mm, 6mm o 15/18mm) ranurada o clavada bajo la caja.
- **Despiece Automático:** Todas estas piezas se incorporarán al optimizador de corte y la lista de materiales con sus nombres y medidas exactas.

---

## 2. Montaje de Rieles en los Costados Interiores del Mueble
- **Ubicación Exacta:** Las correderas se anclan directamente en la cara interior de los laterales del mueble a la altura central/inferior de cada gaveta, respetando los 12.7 mm de luz lateral.
- **Sin Sobredimensionamiento:** Longitud de corredera adaptada a la profundidad útil del mueble (250, 300, 350, 400, 450, 500, 550, 600 mm).

---

## 3. Mecanizados Técnicos y Eliminación de Círculos Erróneos en Frentes
- **Mecanizados de Correderas (Sistema 32):**
  - Primera perforación técnica a **37 mm** exactos de la arista frontal del costado del mueble.
  - Perforaciones subsiguientes con paso de **32 mm** (o múltiplos 64mm, 128mm, 192mm) a lo largo de la línea de la corredera.
- **Limpieza de Círculos en Frentes:**
  - Se eliminan perforaciones o tarugos de ensamble estructural en las caras visibles frontales de los cajones.
  - Perforaciones de tirador / manija centradas paramétricamente según la distancia entre centros (96mm, 128mm, 160mm, 192mm).

---

## 4. Animación Sincronizada de la Gaveta Completa
- Al hacer clic sobre la tapa o la manija de un cajón, se deslizan juntos hacia adelante:
  - Tapa frontal
  - Costados de la gaveta
  - Trasera de la gaveta
  - Fondo de la gaveta
  - Tirador
  - Tramo extensible móvil de la corredera
- Cada cajón se abrirá y cerrará de manera individual e independiente.

---

## Verificación y Pruebas
1. Carga de plantillas con cajones (cómodas, escritorios, veladores, reposteros con gavetas).
2. Verificación en 3D de la caja de cajón de 5 piezas con sus rieles en los laterales.
3. Apertura de cajones independientes comprobando que toda la caja se mueva unida.
4. Inspección de puntos de perforación técnicos (37mm sin círculos parásitos en el frente).
5. Compilación limpia sin errores TypeScript ni de renderizado.
