import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { StudioWorkspaceComponent } from './studio-workspace';
import { routes } from '../../app.routes';
import { PaymentService } from '../../services/payment.service';
import { SupabaseService } from '../../services/supabase.service';

describe('StudioWorkspaceComponent', () => {
  let isAuthenticatedSig: WritableSignal<boolean>;
  let paymentService: PaymentService;
  let processWompiReturnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    window.history.replaceState({}, '', '/');
    isAuthenticatedSig = signal(true);
    const mockSupabase = {
      isAuthenticated: isAuthenticatedSig,
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

    paymentService = TestBed.inject(PaymentService);
    processWompiReturnSpy = vi
      .spyOn(paymentService, 'processWompiRedirectReturn')
      .mockResolvedValue(null);
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('debe crearse correctamente', () => {
    const fixture = TestBed.createComponent(StudioWorkspaceComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
    expect(processWompiReturnSpy).not.toHaveBeenCalled();
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

  it('debe invocar processWompiRedirectReturn cuando la URL inicial contiene parámetros de retorno de Wompi', () => {
    window.history.replaceState({}, '', '/studio/designer?wompi_checkout=1&id=tx_pse_initial_1&env=test');

    const fixture = TestBed.createComponent(StudioWorkspaceComponent);
    fixture.detectChanges();

    expect(processWompiReturnSpy).toHaveBeenCalledTimes(1);
  });

  it('debe esperar autenticación y procesar processWompiRedirectReturn tras autenticar si la URL inicial trae ?id=...&env=...', () => {
    isAuthenticatedSig.set(false);
    window.history.replaceState({}, '', '/studio/designer?id=tx_bancolombia_2&env=test');

    const fixture = TestBed.createComponent(StudioWorkspaceComponent);
    fixture.detectChanges();
    expect(processWompiReturnSpy).not.toHaveBeenCalled();

    isAuthenticatedSig.set(true);
    fixture.detectChanges();
    expect(processWompiReturnSpy).toHaveBeenCalledTimes(1);
  });
});
