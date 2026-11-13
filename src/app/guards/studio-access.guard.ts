import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

/**
 * Guardia de acceso al entorno de trabajo del Estudio 3D (/studio).
 * Espera obligatoriamente a que finalice la hidratación inicial de autenticación
 * (sesión persistida en localStorage + perfil de usuario).
 * Si el usuario no tiene sesión activa, redirige automáticamente a /auth?mode=login.
 */
export const studioAccessGuard: CanActivateFn = async (_route, _state): Promise<boolean | UrlTree> => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  // Esperar obligatoriamente a que SupabaseService termine de restaurar sesión y perfil
  let user: unknown = null;
  try {
    if (typeof supabaseService.waitForAuthReady === 'function') {
      user = await supabaseService.waitForAuthReady();
    } else if (typeof supabaseService.isAuthLoading === 'function' && supabaseService.isAuthLoading()) {
      if (typeof supabaseService.syncAuthSession === 'function') {
        user = await supabaseService.syncAuthSession();
      }
    }
  } catch {
    user = null;
  }

  const isAuth =
    !!user ||
    (typeof supabaseService.isAuthenticated === 'function'
      ? supabaseService.isAuthenticated()
      : !!(typeof supabaseService.currentUser === 'function' && supabaseService.currentUser()));

  if (isAuth) {
    return true;
  }

  return router.createUrlTree(['/auth'], {
    queryParams: { mode: 'login' }
  });
};

