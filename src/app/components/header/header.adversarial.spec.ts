import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { HeaderComponent } from './header';
import { SupabaseService, SyncStatus } from '../../services/supabase.service';

describe('HeaderComponent — signOutFromStudio Adversarial Verification', () => {
  let signOutSpy: ReturnType<typeof vi.fn>;
  let mockSupabase: Partial<SupabaseService>;
  let router: Router;

  beforeEach(async () => {
    signOutSpy = vi.fn().mockResolvedValue(undefined);

    mockSupabase = {
      isAuthenticated: signal(true),
      isAuthLoading: signal(false),
      currentUser: signal<User | null>({
        id: 'usr-tester',
        email: 'tester@carpenterpro.com',
        app_metadata: {},
        user_metadata: { first_name: 'Eyder' },
        aud: 'authenticated',
        created_at: new Date().toISOString()
      } as User),
      userProfile: signal(null),
      cloudProjects: signal([]),
      syncStatus: signal<SyncStatus>('idle'),
      lastSyncTime: signal<Date | null>(null),
      signOut: signOutSpy as unknown as () => Promise<void>
    };

    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: mockSupabase }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  it('debe cerrar dropdowns, invocar signOut(), mostrar toast y navegar inmediatamente a "/"', async () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    const component = fixture.componentInstance;
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.isProjectDropdownOpen.set(true);
    component.isExportDropdownOpen.set(true);
    component.isLanguageDropdownOpen.set(true);

    await component.signOutFromStudio();

    expect(component.isProjectDropdownOpen()).toBe(false);
    expect(component.isExportDropdownOpen()).toBe(false);
    expect(component.isLanguageDropdownOpen()).toBe(false);
    expect(signOutSpy).toHaveBeenCalledTimes(1);
    expect(component.toastMessage()).toBeTruthy();
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/');
  });

  it('debe navegar hacia "/" incluso si supabase.signOut no está definido', async () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    const component = fixture.componentInstance;
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    delete (component.supabase as unknown as Record<string, unknown>)['signOut'];

    await component.signOutFromStudio();

    expect(navigateByUrlSpy).toHaveBeenCalledWith('/');
  });

  it('comportamiento cuando supabase.signOut rechaza con un error de red', async () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    const component = fixture.componentInstance;
    const navigateByUrlSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const networkError = new Error('Network timeout during sign out');
    signOutSpy.mockRejectedValue(networkError);

    try {
      await component.signOutFromStudio();
      // Si maneja la excepción internamente:
      expect(navigateByUrlSpy).toHaveBeenCalledWith('/');
    } catch (err) {
      // Si la excepción no es atrapada, documentar si navigateByUrl fue llamado o no
      expect(err).toBe(networkError);
      // Observación adversaria: si la excepción escapa sin catch, navigateByUrl no se ejecutó
      expect(navigateByUrlSpy).not.toHaveBeenCalled();
    }
  });
});
