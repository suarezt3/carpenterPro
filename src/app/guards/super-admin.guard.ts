import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../services/supabase.service';

/**
 * Guardia de seguridad exclusivo para el Panel de Superadministrador (/admin).
 * Espera a que finalice la hidratación de sesión y perfil antes de validar
 * el rol `super_admin` o la cuenta propietaria principal.
 */
export const superAdminGuard: CanActivateFn = async (_route, _state): Promise<boolean | UrlTree> => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  let user: User | null = null;
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

  if (!user && typeof supabaseService.currentUser === 'function') {
    user = supabaseService.currentUser();
  }

  if (!user) {
    return router.createUrlTree(['/']);
  }

  const currentProfile = typeof supabaseService.userProfile === 'function'
    ? supabaseService.userProfile()
    : null;

  if ((!currentProfile || currentProfile.id !== user.id) && typeof supabaseService.loadUserProfile === 'function') {
    try {
      await supabaseService.loadUserProfile(user);
    } catch {
      // Continuar con evaluación segura si el perfil no pudo recargarse
    }
  }

  const resolvedProfile = typeof supabaseService.userProfile === 'function'
    ? supabaseService.userProfile()
    : null;

  const isSuper =
    resolvedProfile?.role === 'super_admin' ||
    user.email?.toLowerCase() === 'eydersuarez900@gmail.com';

  if (isSuper) {
    return true;
  }

  return router.createUrlTree(['/studio']);
};
