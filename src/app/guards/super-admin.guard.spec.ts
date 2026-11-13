import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Route, Router, RouterStateSnapshot, Routes, UrlTree, provideRouter } from '@angular/router';
import { Component, signal, WritableSignal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { superAdminGuard } from './super-admin.guard';
import { SupabaseService, UserProfile } from '../services/supabase.service';
import { routes } from '../app.routes';

@Component({
  selector: 'app-admin-route-stub',
  standalone: true,
  template: ''
})
class AdminRouteStubComponent {}

function cloneRoutesWithAdminStubs(sourceRoutes: Routes): Routes {
  return sourceRoutes.map((route): Route => {
    const cloned: Route = { ...route };
    if (cloned.loadComponent) {
      cloned.component = AdminRouteStubComponent;
      delete cloned.loadComponent;
    }
    if (cloned.children) {
      cloned.children = cloneRoutesWithAdminStubs(cloned.children);
    }
    return cloned;
  });
}

describe('superAdminGuard', () => {
  let userProfileSig: WritableSignal<UserProfile | null>;
  let currentUserSig: WritableSignal<User | null>;
  let waitForAuthReadySpy: ReturnType<typeof vi.fn>;
  let loadUserProfileSpy: ReturnType<typeof vi.fn>;
  let mockSupabase: Partial<SupabaseService>;

  const dummyRoute = {} as ActivatedRouteSnapshot;
  const dummyState = { url: '/admin' } as RouterStateSnapshot;

  beforeEach(() => {
    userProfileSig = signal<UserProfile | null>(null);
    currentUserSig = signal<User | null>(null);
    waitForAuthReadySpy = vi.fn().mockResolvedValue(null);
    loadUserProfileSpy = vi.fn().mockResolvedValue(null);

    mockSupabase = {
      userProfile: userProfileSig,
      currentUser: currentUserSig,
      waitForAuthReady: waitForAuthReadySpy as unknown as () => Promise<User | null>,
      loadUserProfile: loadUserProfileSpy as unknown as (user?: User | null) => Promise<UserProfile | null>
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: mockSupabase }
      ]
    });
  });

  it('debe redirigir a / cuando no hay usuario autenticado', async () => {
    waitForAuthReadySpy.mockResolvedValue(null);

    const result = await TestBed.runInInjectionContext(() => superAdminGuard(dummyRoute, dummyState));
    expect(result instanceof UrlTree).toBe(true);

    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe('/');
  });

  it('debe redirigir a /studio cuando el usuario autenticado tiene rol regular user', async () => {
    const regularUser = { id: 'u-regular', email: 'cliente@taller.com' } as User;
    waitForAuthReadySpy.mockResolvedValue(regularUser);
    loadUserProfileSpy.mockImplementation(async () => {
      const profile: UserProfile = {
        id: 'u-regular',
        email: 'cliente@taller.com',
        first_name: 'Cliente',
        last_name: 'Regular',
        role: 'user',
        plan: 'pro',
        created_at: '2026-11-10T00:00:00Z',
        updated_at: '2026-11-10T00:00:00Z'
      };
      userProfileSig.set(profile);
      return profile;
    });

    const result = await TestBed.runInInjectionContext(() => superAdminGuard(dummyRoute, dummyState));
    expect(loadUserProfileSpy).toHaveBeenCalledWith(regularUser);
    expect(result instanceof UrlTree).toBe(true);

    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe('/studio');
  });

  it('debe permitir acceso (retornar true) cuando el usuario tiene rol super_admin', async () => {
    const adminUser = { id: 'u-admin', email: 'admin@piezo3d.com' } as User;
    waitForAuthReadySpy.mockResolvedValue(adminUser);
    userProfileSig.set({
      id: 'u-admin',
      email: 'admin@piezo3d.com',
      first_name: 'Admin',
      last_name: 'Principal',
      role: 'super_admin',
      plan: 'industrial',
      created_at: '2026-11-10T00:00:00Z',
      updated_at: '2026-11-10T00:00:00Z'
    });

    const result = await TestBed.runInInjectionContext(() => superAdminGuard(dummyRoute, dummyState));
    expect(result).toBe(true);
    expect(loadUserProfileSpy).not.toHaveBeenCalled();
  });

  it('debe permitir acceso (retornar true) para la cuenta propietaria eydersuarez900@gmail.com', async () => {
    const ownerUser = { id: 'u-owner', email: 'eydersuarez900@gmail.com' } as User;
    waitForAuthReadySpy.mockResolvedValue(ownerUser);

    const result = await TestBed.runInInjectionContext(() => superAdminGuard(dummyRoute, dummyState));
    expect(result).toBe(true);
  });

  it('debe esperar a que waitForAuthReady() hidrate sesión y perfil al recargar /admin y conservar la ruta exacta', async () => {
    const adminUser = { id: 'u-admin-reload', email: 'director@piezo3d.com' } as User;
    waitForAuthReadySpy.mockImplementation(async () => {
      await Promise.resolve();
      currentUserSig.set(adminUser);
      userProfileSig.set({
        id: 'u-admin-reload',
        email: 'director@piezo3d.com',
        first_name: 'Directora',
        last_name: 'General',
        role: 'super_admin',
        plan: 'industrial',
        created_at: '2026-11-10T00:00:00Z',
        updated_at: '2026-11-12T00:00:00Z'
      });
      return adminUser;
    });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(cloneRoutesWithAdminStubs(routes)),
        { provide: SupabaseService, useValue: mockSupabase }
      ]
    });

    const router = TestBed.inject(Router);
    const navigated = await router.navigateByUrl('/admin');
    expect(navigated).toBe(true);
    expect(waitForAuthReadySpy).toHaveBeenCalledTimes(1);
    expect(router.url).toBe('/admin');
  });

  it('debe resolver rutas públicas (auth, terms, privacy, refunds) y fallback ** sin errores', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(cloneRoutesWithAdminStubs(routes)),
        { provide: SupabaseService, useValue: mockSupabase }
      ]
    });

    const router = TestBed.inject(Router);

    await router.navigateByUrl('/auth?mode=login');
    expect(router.url).toBe('/auth?mode=login');

    await router.navigateByUrl('/terms');
    expect(router.url).toBe('/terms');

    await router.navigateByUrl('/privacy');
    expect(router.url).toBe('/privacy');

    await router.navigateByUrl('/refunds');
    expect(router.url).toBe('/refunds');

    await router.navigateByUrl('/ruta-inexistente-404');
    expect(router.url).toBe('/');
  });
});
