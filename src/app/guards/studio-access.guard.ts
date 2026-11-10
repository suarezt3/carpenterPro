import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

/**
 * Guardia de acceso al entorno de trabajo del Estudio 3D (/studio).
 * Espera a que finalice la verificación inicial de autenticación (isAuthLoading / syncAuthSession).
 * Si el usuario no tiene sesión activa, redirige automáticamente a /auth?mode=login.
 */
export const studioAccessGuard: CanActivateFn = async (_route, _state): Promise<boolean | UrlTree> => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  // Esperar obligatoriamente a que SupabaseService termine de restaurar la sesión inicial desde localStorage
  if (typeof supabaseService.waitForAuthReady === 'function') {
    await supabaseService.waitForAuthReady();
  } else if (typeof supabaseService.isAuthLoading === 'function' && supabaseService.isAuthLoading()) {
    if (typeof supabaseService.syncAuthSession === 'function') {
      await supabaseService.syncAuthSession();
    }
  }

  const isAuth = typeof supabaseService.isAuthenticated === 'function'
    ? supabaseService.isAuthenticated()
    : !!(typeof supabaseService.currentUser === 'function' && supabaseService.currentUser());

  if (isAuth) {
    return true;
  }

  return router.createUrlTree(['/auth'], {
    queryParams: { mode: 'login' }
  });
};

