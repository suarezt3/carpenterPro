import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { studioAccessGuard } from './studio-access.guard';
import { SupabaseService } from '../services/supabase.service';

describe('studioAccessGuard', () => {
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

  it('debe permitir el acceso (retornar true) si el usuario ya está autenticado', async () => {
    isAuthSig.set(true);

    const result = await TestBed.runInInjectionContext(() => studioAccessGuard(dummyRoute, dummyState));
    expect(result).toBe(true);
    expect(syncAuthSessionSpy).not.toHaveBeenCalled();
  });

  it('debe redirigir a /auth?mode=login si el usuario no está autenticado', async () => {
    isAuthSig.set(false);
    isLoadingSig.set(false);

    const result = await TestBed.runInInjectionContext(() => studioAccessGuard(dummyRoute, dummyState));
    expect(result instanceof UrlTree).toBe(true);

    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe('/auth?mode=login');
  });

  it('debe esperar a syncAuthSession cuando isAuthLoading es true antes de evaluar autenticación', async () => {
    isLoadingSig.set(true);
    isAuthSig.set(false);

    syncAuthSessionSpy.mockImplementation(async () => {
      isLoadingSig.set(false);
      isAuthSig.set(true);
      return { id: 'usr-123', email: 'test@example.com' } as User;
    });

    const result = await TestBed.runInInjectionContext(() => studioAccessGuard(dummyRoute, dummyState));
    expect(syncAuthSessionSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it('debe redirigir a /auth?mode=login si tras syncAuthSession el usuario continúa sin autenticarse', async () => {
    isLoadingSig.set(true);
    isAuthSig.set(false);

    syncAuthSessionSpy.mockImplementation(async () => {
      isLoadingSig.set(false);
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

