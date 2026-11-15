# Directriz Global: Flujo de Ramas Git, Entornos y Despliegue (`develop` -> `main`)

Regla permanente e inquebrantable para todas las sesiones de desarrollo en **Piezo3D Studio**. Antes de ejecutar cualquier modificación de código, prueba, commit o despliegue, verifica siempre la rama activa con `git branch --show-current`.

## 1. Entorno de Desarrollo y Staging (`develop` -> `*.vercel.app`)
- **Rama de trabajo por defecto:** Todo nuevo requerimiento, corrección de bugs, refactorización, ajuste visual o configuración debe desarrollarse, probarse, confirmarse (`commit`) y subirse (`git push origin develop`) exclusivamente en la rama `develop`.
- **Verificación previa al commit/push:** Antes de confirmar o subir cambios a `develop`, valida las comprobaciones correspondientes del proyecto (`tsc`, `eslint`, pruebas unitarias y compilación cuando aplique).
- **Publicación en Staging/Preview:** Tras confirmar cambios en `develop`, súbelos únicamente a la rama de desarrollo (`git push origin develop`) para su validación en el entorno preview/staging `*.vercel.app`.
- **Estado obligatorio tras finalizar:** Al terminar cualquier tarea de desarrollo o despliegue, la rama local activa debe quedar siempre en `develop` (nunca en `main`).

## 2. Entorno de Producción (`main` -> `https://piezo3d.com`)
- **Prohibición estricta en `main`:** Queda **TERMINANTEMENTE PROHIBIDO** desarrollar directamente sobre `main`, hacer commits directos en `main` o ejecutar `git push origin main` sin confirmación explícita del usuario.
- **Compuerta obligatoria de aprobación:** Antes de pasar cualquier cambio de `develop` a `main`, el cambio debe estar validado previamente en `*.vercel.app`, y se debe preguntar siempre o esperar orden explícita del usuario:
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
