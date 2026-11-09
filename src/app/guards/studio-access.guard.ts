import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

/**
 * Guardia de acceso al entorno de trabajo del Estudio 3D (/studio).
 *
 * En esta Fase 1, permite el libre acceso (retorna true) para probar la navegación
 * fluida entre la Landing Page (/) y el Estudio 3D (/studio).
 *
 * PUNTO DE INTEGRACIÓN PARA FASE 2 (Autenticación y Freemium / Trial de 7-14 días):
 * --------------------------------------------------------------------------------
 * En la siguiente fase, aquí se conectará la lógica de negocio para:
 * 1. Comprobar si el usuario tiene una sesión activa mediante `supabaseService.currentUser()`.
 * 2. Si no hay sesión, permitir acceso condicional a modo prueba (Freemium o contador de días restantes de 7 a 14 días).
 * 3. Si el periodo de prueba expiró y no cuenta con suscripción activa (Plan Taller Pro o Plan Industrial):
 *    - Redirigir hacia la Landing Page con parámetro de consulta (ej. `router.parseUrl('/?pricing=required')`)
 *    - O desplegar el modal de suscripción para completar el pago.
 */
export const studioAccessGuard: CanActivateFn = (_route, _state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  // Verificación preliminar disponible para inspección en tiempo de ejecución
  const currentUser = supabaseService.currentUser();
  const isAuthenticated = supabaseService.isAuthenticated();

  // En Fase 1 el acceso es completamente libre para validar flujos y experiencia de usuario.
  // Cuando se active la Fase 2, aquí se descomentará la validación estricta:
  // if (!isAuthenticated) {
  //   return router.parseUrl('/?auth=required');
  // }

  return true;
};
