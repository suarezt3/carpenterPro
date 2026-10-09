# Implementación Completada: Arrastre Directo tipo SketchUp y Reubicación de Información

## 1. Arrastre Directo con el Mouse (Estilo SketchUp)
- **Arrastre directo sobre la superficie:** Ahora puedes hacer clic sostenido con el botón izquierdo sobre cualquier pieza o gaveta y arrastrarla directamente para moverla en el espacio 3D, sin la obligación estricta de tener que acertarle a las flechas rojas, verdes o azules del gizmo.
- **Soporte para grupos y cajones completos:** Al hacer clic y arrastrar cualquier pieza que pertenezca a un grupo o cajón modular (frente, laterales, contrafrente, trasera o fondo), todo el grupo se desplaza en bloque de forma simultánea y sincronizada.
- **Herramienta Mover & Selección:** Funciona tanto con la herramienta estándar de selección como con la herramienta de Mover (`M`), transformando el cursor en `grabbing` durante el desplazamiento.
- **Compatibilidad magnética:** Respeta el imán magnético para alineación precisa a caras y bordes de piezas adyacentes.

## 2. Reubicación de la Tarjeta Informativa (Esquina Inferior Izquierda)
- El cuadro de información de la pieza (`Medidas Largo × Ancho (Espesor)`) o del grupo (`GRUPO (n piezas)`) fue trasladado desde la parte superior a la esquina inferior izquierda del visor 3D (`bottom-3 left-16`).
- El banner de piezas ocultas y el panel flotante de micro-ajuste se coordinaron verticalmente de forma limpia en esa misma esquina.
- La cinta superior oscura de acciones permanece totalmente libre y sin solapamiento alguno con los textos informativos.
