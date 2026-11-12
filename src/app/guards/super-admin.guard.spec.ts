import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { superAdminGuard } from './super-admin.guard';
import { SupabaseService, UserProfile } from '../services/supabase.service';

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
});
