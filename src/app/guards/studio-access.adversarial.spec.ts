import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { studioAccessGuard } from './studio-access.guard';
import { SupabaseService } from '../services/supabase.service';

describe('studioAccessGuard (Adversarial Stress Suite)', () => {
  let isAuthSig: WritableSignal<boolean>;
  let isLoadingSig: WritableSignal<boolean>;
  let currentUserSig: WritableSignal<User | null>;
  let syncAuthSessionSpy: ReturnType<typeof vi.fn>;
  let mockSupabase: Partial<SupabaseService>;
  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = { url: '/studio' } as RouterStateSnapshot;

  beforeEach(() => {
    isAuthSig = signal(false);
    isLoadingSig = signal(false);
    currentUserSig = signal<User | null>(null);
    syncAuthSessionSpy = vi.fn().mockResolvedValue(null);

    mockSupabase = {
      isAuthenticated: isAuthSig,
      isAuthLoading: isLoadingSig,
      currentUser: currentUserSig,
      syncAuthSession: syncAuthSessionSpy as unknown as () => Promise<User | null>
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: mockSupabase }
      ]
    });
  });

  describe('Edge Case: Null Session & Cold Start', () => {
    it('debe rechazar acceso y retornar UrlTree hacia /auth?mode=login cuando no hay sesión', async () => {
      isAuthSig.set(false);
      isLoadingSig.set(false);
      currentUserSig.set(null);

      const result = await TestBed.runInInjectionContext(() => studioAccessGuard(dummyRoute, dummyState));
      expect(result instanceof UrlTree).toBe(true);

      const router = TestBed.inject(Router);
      expect(router.serializeUrl(result as UrlTree)).toBe('/auth?mode=login');
    });

    it('debe prevenir bypass con llamadas concurrentes cuando el usuario no está autenticado', async () => {
      isAuthSig.set(false);
      isLoadingSig.set(false);

      const results = await Promise.all([
        TestBed.runInInjectionContext(() => studioAccessGuard(dummyRoute, dummyState)),
        TestBed.runInInjectionContext(() => studioAccessGuard(dummyRoute, dummyState)),
        TestBed.runInInjectionContext(() => studioAccessGuard(dummyRoute, dummyState))
      ]);

      const router = TestBed.inject(Router);
      for (const res of results) {
        expect(res instanceof UrlTree).toBe(true);
        expect(router.serializeUrl(res as UrlTree)).toBe('/auth?mode=login');
      }
    });
  });

  describe('Edge Case: Active Session', () => {
    it('debe permitir acceso inmediato (true) sin llamar a syncAuthSession si ya está autenticado', async () => {
      isAuthSig.set(true);
      isLoadingSig.set(false);

      const result = await TestBed.runInInjectionContext(() => studioAccessGuard(dummyRoute, dummyState));
      expect(result).toBe(true);
      expect(syncAuthSessionSpy).not.toHaveBeenCalled();
    });

    it('debe permitir acceso cuando isAuthenticated no está disponible pero currentUser tiene usuario válido', async () => {
      // Simular cliente donde solo existe currentUser()
      delete (mockSupabase as Record<string, unknown>)['isAuthenticated'];
      currentUserSig.set({ id: 'usr-456', email: 'carpintero@test.com' } as User);

      const result = await TestBed.runInInjectionContext(() => studioAccessGuard(dummyRoute, dummyState));
      expect(result).toBe(true);
    });
  });

  describe('Edge Case: Sync Exception & Network Crash', () => {
    it('investigar comportamiento cuando syncAuthSession lanza una excepción de red', async () => {
      isLoadingSig.set(true);
      isAuthSig.set(false);

      const syncError = new Error('Supabase network connection timeout 504');
      syncAuthSessionSpy.mockRejectedValue(syncError);

      try {
        const result = await TestBed.runInInjectionContext(() => studioAccessGuard(dummyRoute, dummyState));
        // Si el guard maneja la excepción internamente:
        expect(result instanceof UrlTree).toBe(true);
        const router = TestBed.inject(Router);
        expect(router.serializeUrl(result as UrlTree)).toBe('/auth?mode=login');
      } catch (err) {
        // Si el guard propaga la excepción hacia el router:
        expect(err).toBe(syncError);
        // En cualquier caso, NO debe haber retornado true (cero bypass)
      }
    });

    it('debe redirigir a /auth?mode=login cuando syncAuthSession resuelve a null tras finalizar carga', async () => {
      isLoadingSig.set(true);
      isAuthSig.set(false);

      syncAuthSessionSpy.mockImplementation(async () => {
        isLoadingSig.set(false);
        currentUserSig.set(null);
        isAuthSig.set(false);
        return null;
      });

      const result = await TestBed.runInInjectionContext(() => studioAccessGuard(dummyRoute, dummyState));
      expect(syncAuthSessionSpy).toHaveBeenCalledTimes(1);
      expect(result instanceof UrlTree).toBe(true);
      const router = TestBed.inject(Router);
      expect(router.serializeUrl(result as UrlTree)).toBe('/auth?mode=login');
    });
  });

  describe('Edge Case: Fallback de compatibilidad', () => {
    it('debe redirigir si isAuthenticated y currentUser son funciones no definidas o devuelven falsy', async () => {
      (mockSupabase as Record<string, unknown>)['isAuthenticated'] = undefined;
      (mockSupabase as Record<string, unknown>)['currentUser'] = undefined;

      const result = await TestBed.runInInjectionContext(() => studioAccessGuard(dummyRoute, dummyState));
      expect(result instanceof UrlTree).toBe(true);
      const router = TestBed.inject(Router);
      expect(router.serializeUrl(result as UrlTree)).toBe('/auth?mode=login');
    });
  });
});
