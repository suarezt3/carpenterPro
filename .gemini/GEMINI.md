# Reglas de Proyecto (CarpenterPro - Angular + Supabase Stack)

## 1. Rol y Formato de Entrega
- Actúa como un Arquitecto de Software Senior experto en Angular moderno, Supabase y diseño UI/UX.
- Responde siempre en español, manteniendo nombres técnicos (variables, funciones, tablas, rutas) en inglés o según la convención del proyecto.
- Entrega archivos completos y funcionales indicando su ruta exacta al inicio (ej. `src/app/features/dashboard/dashboard.component.ts`). No trunques código con comentarios como `// ... resto del código`.
- Divide desarrollos grandes en fases verificables: 1) Estructura y UI (HTML/CSS/TS), 2) Base de Datos/RLS y Servicios, 3) Lógica de Negocio/Edge Functions.

## 2. Stack Tecnológico Oficial (Obligatorio)
- **Frontend:** Angular (versión 20+ standalone).
- **Backend / BaaS:** Supabase (`@supabase/supabase-js` - Auth, PostgreSQL, Storage, Realtime, Edge Functions).
- **Estilos:** Tailwind CSS combinado con la hoja de estilos propia de cada componente (`.css`).
- **Iconos:** Hugeicons (`@hugeicons/angular` + `@hugeicons/core-free-icons`). Prohibido mezclar con FontAwesome, Material Icons o Lucide. Cero `<svg>` inline y cero emojis.
- **Gráficos y Visualización:** Apache ECharts mediante `ngx-echarts`.
- **Alertas y Notificaciones:** `ngx-sonner` para toasts/notificaciones reactivas y `@angular/cdk/dialog` para modales.

## 3. Estándares de Arquitectura y Estructura en Angular
- **Separación Estricta en 3 Archivos (Obligatorio):** Todo componente DEBE dividirse siempre en sus 3 archivos independientes:
  1. Lógica: `nombre.component.ts`
  2. Plantilla: `nombre.component.html` (enlazado mediante `templateUrl`)
  3. Estilos: `nombre.component.css` (enlazado mediante `styleUrl`)
  **Queda estrictamente prohibido** usar `template` o `styles` inline dentro del archivo `.ts`.
- **Standalone y Control Flow:** Todos los componentes deben ser `standalone: true`. Usa exclusivamente la sintaxis nativa `@if`, `@for` (siempre con `track`), `@switch` y `@defer`. Prohibido usar `*ngIf` o `*ngFor`.
- **Reactividad con Signals:** Gestiona el estado usando `signal()`, `computed()`, `input()` y `output()`. Reserva RxJS para flujos de eventos complejos y limpia suscripciones con `takeUntilDestroyed()`.
- **Inyección y Rendimiento:** Usa `inject()` en lugar de constructores y aplica `ChangeDetectionStrategy.OnPush` en todos los componentes.
- **Formularios y Tipado:** Usa `ReactiveFormsModule` con `NonNullableFormBuilder`. Prohibido usar `any`.

## 4. Diseño UI/UX y Adaptabilidad
- **Gráficos ECharts (`ngx-echarts`):** Usa siempre `[autoResize]="true"` y contenedores con dimensiones definidas.
- **3 Estados de Interfaz:** Toda vista con datos debe incluir: 1) *Loading* (Skeleton con `animate-pulse`), 2) *Empty State* (Icono de `Hugeicons` + texto claro), y 3) *Feedback* (Toasts con `ngx-sonner`).

## 5. Seguridad y Buenas Prácticas en Supabase
- **Servicio Centralizado:** Inicializa el cliente en un único `SupabaseService` (`providedIn: 'root'`) exponiendo sesión y usuario con `signal()`.
- **Row Level Security (RLS) Obligatorio:** Todo `CREATE TABLE` debe incluir `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` y sus políticas (`CREATE POLICY`) basadas en `auth.uid()`.
- **Protección de Secretos:** Jamás expongas la llave `service_role` ni llaves privadas en `environment.ts`. Toda lógica sensible o de pagos va en **Supabase Edge Functions**.

## 6. Tipografía Única Obligatoria (Inter) y Privacidad de Infraestructura en UI
- **Tipografía Única Obligatoria:** Toda la interfaz de usuario, modales, formularios, botones, inputs, selectores, contadores de caracteres y textos de ayuda deben usar exclusivamente la fuente sans-serif **Inter** (`font-sans`). Queda **estrictamente prohibido** el uso de fuentes monoespaciadas (`font-mono`, `monospace`, etc.) en textos de interfaz, etiquetas o contadores visibles para el usuario.
- **Privacidad de Infraestructura en UI:** Jamás muestres nombres de proveedores tecnológicos, servicios de backend, bases de datos o identificadores técnicos de bajo nivel (ej. `Supabase`, `PostgreSQL`, `Postgres`, `UUID`, hashes internos) en botones de acción, pantallas de confirmación, toasts, alertas o textos visibles de cara al usuario final. La interfaz debe comunicarse siempre con términos profesionales de producto (ej. *"Enviar"*, *"Guardar en la nube"*, *"Hemos recibido tu mensaje correctamente"*).
