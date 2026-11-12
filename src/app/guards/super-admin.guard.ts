import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../services/supabase.service';

/**
 * Guardia de seguridad exclusivo para el Panel de Superadministrador (/admin).
 * Verifica la sesión activa y valida que el perfil tenga rol `super_admin`
 * o corresponda a la cuenta propietaria principal.
 */
export const superAdminGuard: CanActivateFn = async (_route, _state): Promise<boolean | UrlTree> => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  let user: User | null = null;
  if (typeof supabaseService.waitForAuthReady === 'function') {
    user = await supabaseService.waitForAuthReady();
  } else if (typeof supabaseService.isAuthLoading === 'function' && supabaseService.isAuthLoading()) {
    if (typeof supabaseService.syncAuthSession === 'function') {
      user = await supabaseService.syncAuthSession();
    }
  }

  if (!user && typeof supabaseService.currentUser === 'function') {
    user = supabaseService.currentUser();
  }

  if (!user) {
    return router.createUrlTree(['/']);
  }

  if (!supabaseService.userProfile() && typeof supabaseService.loadUserProfile === 'function') {
    await supabaseService.loadUserProfile(user);
  }

  const isSuper =
    supabaseService.userProfile()?.role === 'super_admin' ||
    user.email?.toLowerCase() === 'eydersuarez900@gmail.com';

  if (isSuper) {
    return true;
  }

  return router.createUrlTree(['/studio']);
};
