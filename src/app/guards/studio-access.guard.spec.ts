import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Route, Router, RouterStateSnapshot, Routes, UrlTree, provideRouter } from '@angular/router';
import { Component, signal, WritableSignal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { studioAccessGuard } from './studio-access.guard';
import { SupabaseService, UserProfile } from '../services/supabase.service';
import { routes } from '../app.routes';

@Component({
  selector: 'app-test-route-stub',
  standalone: true,
  template: ''
})
class TestRouteStubComponent {}

function cloneRoutesWithStubs(sourceRoutes: Routes): Routes {
  return sourceRoutes.map((route): Route => {
    const cloned: Route = { ...route };
    if (cloned.loadComponent) {
      cloned.component = TestRouteStubComponent;
      delete cloned.loadComponent;
    }
    if (cloned.children) {
      cloned.children = cloneRoutesWithStubs(cloned.children);
    }
    return cloned;
  });
}

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

  it('debe esperar a waitForAuthReady() al recargar /studio/designer y permitir permanecer en la ruta con sesión persistida', async () => {
    const persistedUser = { id: 'usr-reload', email: 'carpintero@taller.com' } as User;
    const waitForAuthReadySpy = vi.fn().mockImplementation(async () => {
      await Promise.resolve();
      currentUserSig.set(persistedUser);
      isAuthSig.set(true);
      isLoadingSig.set(false);
      return persistedUser;
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(cloneRoutesWithStubs(routes)),
        {
          provide: SupabaseService,
          useValue: {
            isAuthenticated: isAuthSig,
            isAuthLoading: isLoadingSig,
            currentUser: currentUserSig,
            userProfile: signal<UserProfile | null>(null),
            waitForAuthReady: waitForAuthReadySpy
          }
        }
      ]
    });

    const router = TestBed.inject(Router);
    const navigated = await router.navigateByUrl('/studio/designer');
    expect(navigated).toBe(true);
    expect(waitForAuthReadySpy).toHaveBeenCalledTimes(1);
    expect(router.url).toBe('/studio/designer');
  });

  it('debe conservar /studio/parts, /studio/optimizer, /studio/budget y /studio/labels y redirigir /studio/:tab hacia /studio/designer sin bucles', async () => {
    const persistedUser = { id: 'usr-tabs', email: 'tabs@taller.com' } as User;
    isAuthSig.set(true);
    currentUserSig.set(persistedUser);
    const waitForAuthReadySpy = vi.fn().mockResolvedValue(persistedUser);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(cloneRoutesWithStubs(routes)),
        {
          provide: SupabaseService,
          useValue: {
            isAuthenticated: isAuthSig,
            isAuthLoading: isLoadingSig,
            currentUser: currentUserSig,
            userProfile: signal<UserProfile | null>(null),
            waitForAuthReady: waitForAuthReadySpy
          }
        }
      ]
    });

    const router = TestBed.inject(Router);

    await router.navigateByUrl('/studio/parts');
    expect(router.url).toBe('/studio/parts');

    await router.navigateByUrl('/studio/cutlist');
    expect(router.url).toBe('/studio/parts');

    await router.navigateByUrl('/studio/optimizer');
    expect(router.url).toBe('/studio/optimizer');

    await router.navigateByUrl('/studio/budget');
    expect(router.url).toBe('/studio/budget');

    await router.navigateByUrl('/studio/labels');
    expect(router.url).toBe('/studio/labels');

    await router.navigateByUrl('/studio/desconocida');
    expect(router.url).toBe('/studio/designer');

    await router.navigateByUrl('/studio');
    expect(router.url).toBe('/studio/designer');
  });

  it('debe redirigir a /auth?mode=login al recargar /studio/designer sin sesión o si waitForAuthReady falla', async () => {
    const waitForAuthReadySpy = vi.fn().mockRejectedValue(new Error('Auth timeout'));

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(cloneRoutesWithStubs(routes)),
        {
          provide: SupabaseService,
          useValue: {
            isAuthenticated: isAuthSig,
            isAuthLoading: isLoadingSig,
            currentUser: currentUserSig,
            userProfile: signal<UserProfile | null>(null),
            waitForAuthReady: waitForAuthReadySpy
          }
        }
      ]
    });

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/studio/designer');
    expect(waitForAuthReadySpy).toHaveBeenCalledTimes(1);
    expect(router.url).toBe('/auth?mode=login');
  });
});

