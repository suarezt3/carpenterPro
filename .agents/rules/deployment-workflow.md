# Directriz Global: Flujo Obligatorio de Trabajo y Despliegue (`LOCALHOST` -> `DEVELOP` -> `MAIN`)

Regla permanente e inquebrantable para todas las sesiones de desarrollo en **Piezo3D Studio**. Todo cambio debe seguir estrictamente el flujo secuencial **`LOCALHOST` -> `DEVELOP` -> `MAIN`**. Antes de ejecutar cualquier modificación de código, prueba o comando Git, verifica siempre la rama activa con `git branch --show-current` y asegúrate de trabajar sobre `develop`.

- **Regla fundamental de Git:** **PROHIBIDO ejecutar `git commit` o `git push` automáticamente al terminar una tarea.** Ningún cambio debe confirmarse ni subirse al repositorio remoto sin validación previa en local y confirmación explícita del usuario.

## 1. Entorno Local y Staging (`LOCALHOST` -> `DEVELOP` -> `*.vercel.app`)

### 1.1 Desarrollo y Validación Local (`LOCALHOST` sobre `develop`)
- **Rama de trabajo por defecto:** Todo nuevo requerimiento, corrección de bugs, refactorización, ajuste visual o configuración debe aplicarse y validarse primero en entorno local exclusivamente sobre la rama `develop` (nunca en `main`).
- **Validación local obligatoria previa:** Antes de dar por terminada una tarea en local sobre `develop`, ejecuta y valida todas las comprobaciones del proyecto:
  1. Compilación completa: `npm run build` (sin errores).
  2. Tests unitarios (y validaciones estáticas cuando apliquen): `npm test` / `npx ng test --watch=false`, junto con `tsc` y `eslint` / `npm run lint`.
  3. Prueba manual en `localhost` (`npm run dev` o `npm start` verificando el flujo modificado en navegador local).
- **Detención obligatoria sin commit ni push:** **PROHIBIDO ejecutar `git commit` o `git push` automáticamente al terminar una tarea.** Al finalizar y validar los cambios locales, detente sin hacer `commit` ni `push`, presenta el resumen de pruebas locales y pregunta explícitamente al usuario:
  > *"¿Quieres subir los cambios a develop?"*

### 1.2 Publicación en Staging / Preview (`DEVELOP` -> `*.vercel.app`)
- **Subida condicionada a aprobación explícita:** Únicamente después de que el usuario responda afirmativamente a *"¿Quieres subir los cambios a develop?"*, confirma los cambios (`git commit`) y súbelos exclusivamente a la rama de desarrollo (`git push origin develop`) para su validación en el entorno preview/staging `*.vercel.app`.
- **Estado obligatorio tras finalizar:** Al terminar cualquier tarea de desarrollo o despliegue, la rama local activa debe quedar siempre en `develop` (nunca en `main`).

## 2. Entorno de Producción (`DEVELOP` -> `MAIN` -> `https://piezo3d.com`)
- **Prohibición estricta en `main`:** Queda **TERMINANTEMENTE PROHIBIDO** desarrollar directamente sobre `main`, hacer commits directos en `main` o ejecutar `git push origin main` sin confirmación explícita del usuario.
- **Compuerta obligatoria de aprobación:** Solo tras subir y validar los cambios en `develop` (`*.vercel.app`), pregunta explícitamente al usuario si se desea fusionar a `main`:
  > *"¿Deseas fusionar `develop` en `main` para publicar en `piezo3d.com`?"*
- **Protocolo exacto de publicación en producción (solo tras aprobación explícita y validación previa en `.vercel.app`):**
  1. Verificar que `develop` esté limpia, actualizada y validada en `*.vercel.app`.
  2. Cambiar a `main` (`git checkout main`) y asegurarse de estar al día con `origin/main` (`git pull origin main --ff-only`).
  3. Hacer un merge limpio de `develop` hacia `main` (`git merge develop`).
  4. Subir producción al remoto (`git push origin main`).
  5. **Regresar inmediatamente a `develop`** (`git checkout develop`) para evitar commits accidentales en `main` en turnos o sesiones posteriores.

## 3. Comportamiento SEO y Autenticación por Entorno
- **SEO e Indexación (`SeoService` en `src/app/services/seo.service.ts`):**
  - En `*.vercel.app` y en entorno local (`localhost`, `127.0.0.1`, `0.0.0.0`, `::1`, `[::1]`), `SeoService` inyecta `<meta name="robots" content="noindex, nofollow">` en **todas** las rutas para impedir que previews o entornos locales aparezcan en buscadores.
  - En producción bajo `piezo3d.com` / `www.piezo3d.com`, `SeoService` inyecta `index, follow` únicamente en las páginas públicas (`/`, `/auth`, `/terms`, `/privacy`, `/refunds`); las rutas privadas o internas (`/studio/**`, `/admin`, `/designer`, `/parts`, `/cutlist`, `/optimizer`, `/budget`, `/labels`) y rutas no públicas mantienen siempre `noindex, nofollow`.
- **Redirecciones de Autenticación (`SupabaseService` en `src/app/services/supabase.service.ts`):**
  - Todas las redirecciones de autenticación de Supabase (`redirectTo` en `signInWithGoogle` y `sendPasswordResetEmail`, y `emailRedirectTo` en `signUp`) deben usar dinámicamente `window.location.origin` (ej. `${window.location.origin}/?auth_callback=1` o `${window.location.origin}/auth?mode=reset`).
  - Queda prohibido hardcodear `https://piezo3d.com` o una URL fija de `*.vercel.app` en las redirecciones de autenticación, de modo que toda sesión iniciada en `.vercel.app` permanezca en ese origen `.vercel.app` y toda sesión iniciada en `piezo3d.com` permanezca en `piezo3d.com`.
