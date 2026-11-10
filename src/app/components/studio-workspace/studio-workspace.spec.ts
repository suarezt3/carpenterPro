import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { StudioWorkspaceComponent } from './studio-workspace';
import { routes } from '../../app.routes';
import { SupabaseService } from '../../services/supabase.service';

describe('StudioWorkspaceComponent', () => {
  beforeEach(async () => {
    const mockSupabase = {
      isAuthenticated: signal(true),
      isAuthLoading: signal(false),
      currentUser: signal<User | null>({
        id: 'user-mock',
        email: 'user@test.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString()
      } as User),
      userProfile: signal(null),
      cloudProjects: signal([]),
      syncStatus: signal<'idle' | 'syncing' | 'error' | 'offline'>('idle'),
      lastSyncTime: signal<Date | null>(null),
      syncAuthSession: vi.fn().mockResolvedValue(null),
      signOut: vi.fn().mockResolvedValue(undefined),
      refreshProjects: vi.fn().mockResolvedValue([]),
      saveProject: vi.fn().mockResolvedValue(null),
      getProjectById: vi.fn().mockResolvedValue(null),
      deleteProject: vi.fn().mockResolvedValue(true)
    };

    await TestBed.configureTestingModule({
      imports: [StudioWorkspaceComponent],
      providers: [
        provideRouter(routes),
        { provide: SupabaseService, useValue: mockSupabase }
      ]
    }).compileComponents();
  });

  it('debe crearse correctamente', () => {
    const fixture = TestBed.createComponent(StudioWorkspaceComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('debe inicializar en la pestaña modules por defecto', () => {
    const fixture = TestBed.createComponent(StudioWorkspaceComponent);
    const component = fixture.componentInstance;
    expect(component.activeTab()).toBe('modules');
  });

  it('debe actualizar la pestaña activa al invocar onTabChanged', () => {
    const fixture = TestBed.createComponent(StudioWorkspaceComponent);
    const component = fixture.componentInstance;
    component.onTabChanged('parts');
    expect(component.activeTab()).toBe('parts');

    component.onTabChanged('optimizer');
    expect(component.activeTab()).toBe('optimizer');

    component.onTabChanged('budget');
    expect(component.activeTab()).toBe('budget');

    component.onTabChanged('labels');
    expect(component.activeTab()).toBe('labels');
  });

  it('debe sincronizar la pestaña activa según la URL de navegación', async () => {
    const fixture = TestBed.createComponent(StudioWorkspaceComponent);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/studio/optimizer');
    expect(component.activeTab()).toBe('optimizer');

    await router.navigateByUrl('/studio/parts');
    expect(component.activeTab()).toBe('parts');

    await router.navigateByUrl('/studio/budget');
    expect(component.activeTab()).toBe('budget');

    await router.navigateByUrl('/studio/labels');
    expect(component.activeTab()).toBe('labels');
  });
});
