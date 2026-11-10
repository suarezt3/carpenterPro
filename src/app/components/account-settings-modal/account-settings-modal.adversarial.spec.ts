import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef, computed, signal } from '@angular/core';
import { User } from '@supabase/supabase-js';
import { AccountSettingsModalComponent } from './account-settings-modal';
import { SupabaseService, UserProfile } from '../../services/supabase.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { I18nService } from '../../services/i18n.service';
import { ThemeService, ThemeMode } from '../../services/theme.service';
import { AppLanguage } from '../../data/i18n-translations.data';
import { DEFAULT_ROOM_CONFIG, MelamineProject } from '../../models/melamine.models';
import { HeaderComponent } from '../header/header';
import { provideRouter } from '@angular/router';

describe('AccountSettingsModalComponent & Header — Adversarial ESC / Backdrop Verification', () => {
  let modalComponent: AccountSettingsModalComponent;
  let modalRef: ComponentRef<AccountSettingsModalComponent>;
  let modalFixture: ComponentFixture<AccountSettingsModalComponent>;

  beforeEach(async () => {
    const mockUser = {
      id: 'u-1',
      email: 'eyder@taller.com',
      user_metadata: { first_name: 'Eyder' }
    } as unknown as User;

    const mockProfile: UserProfile = {
      id: 'u-1',
      email: 'eyder@taller.com',
      first_name: 'Eyder',
      last_name: 'Suarez',
      role: 'user',
      plan: 'pro',
      created_at: '2026-11-09',
      updated_at: '2026-11-09'
    };

    const supabaseMock = {
      currentUser: signal<User | null>(mockUser),
      userProfile: signal<UserProfile | null>(mockProfile),
      updateUserProfile: vi.fn().mockResolvedValue({ success: true }),
      buildFallbackProfile: vi.fn().mockReturnValue(mockProfile),
      isAuthenticated: signal(true),
      isAuthLoading: signal(false),
      signOut: vi.fn().mockResolvedValue(undefined),
      cloudProjects: signal([]),
      syncStatus: signal('idle'),
      lastSyncTime: signal(null)
    };

    const projectMock = {
      currentProject: signal<MelamineProject>({
        id: 'p1',
        name: 'Test',
        clientName: 'Client',
        date: '2026-11-09',
        notes: '',
        settings: {
          sawKerf: 4,
          trimMargin: 10,
          defaultBoardThickness: 15,
          thinEdgeThickness: 0.45,
          thickEdgeThickness: 2,
          thinEdgeCostPerMeter: 1800,
          thickEdgeCostPerMeter: 4200,
          currency: 'COP',
          optimizationPreference: 'best_fit',
          subtractEdgeBandingFromCut: false
        },
        materials: [],
        modules: [],
        parts: [],
        hardware: [],
        laborCost: 0,
        laborType: 'percent',
        profitMarginPercent: 25,
        taxPercent: 19,
        updatedAt: '2026-11-09',
        roomConfig: { ...DEFAULT_ROOM_CONFIG }
      }),
      cloudProjects: signal([]),
      savedProjects: signal([]),
      totalPartsCount: signal(0),
      projectNotes: signal([]),
      activeProjectName: signal('Test'),
      pendingNotesCount: signal(0),
      canUndo: signal(false),
      canRedo: signal(false),
      partsCount: signal(0),
      isAutoSaving: signal(false),
      supabase: supabaseMock,
      updateSettings: vi.fn(),
      updateWorkspaceDimensions: vi.fn(),
      updateRoomConfig: vi.fn(),
      updateProject: vi.fn()
    };



    const i18nMock = {
      currentLang: signal<AppLanguage>('es'),
      currentIso: signal('ES'),
      languages: [{ code: 'es', iso: 'ES', name: 'Español', nativeName: 'Español' }],
      setLanguage: vi.fn(),
      t: vi.fn((k: string) => k)
    };

    const themeMock = {
      themeMode: signal<ThemeMode>('sketchup_classic'),
      isClassic: computed(() => true),
      isDark: computed(() => false),
      setTheme: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [AccountSettingsModalComponent, HeaderComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: ProjectStorageService, useValue: projectMock },
        { provide: I18nService, useValue: i18nMock },
        { provide: ThemeService, useValue: themeMock }
      ]
    }).compileComponents();

    modalFixture = TestBed.createComponent(AccountSettingsModalComponent);
    modalComponent = modalFixture.componentInstance;
    modalRef = modalFixture.componentRef;
    modalRef.setInput('isOpen', true);
    modalFixture.detectChanges();
  });

  it('el botón de cerrar (X) emite closed y modalClose', () => {
    const closedSpy = vi.fn();
    const modalCloseSpy = vi.fn();
    modalComponent.closed.subscribe(closedSpy);
    modalComponent.modalClose.subscribe(modalCloseSpy);

    const closeBtn = modalFixture.nativeElement.querySelector('button[title="common.close"]') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    closeBtn.click();

    expect(closedSpy).toHaveBeenCalledTimes(1);
    expect(modalCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('comprobar si al presionar ESC en la ventana se emite closed', () => {
    const closedSpy = vi.fn();
    modalComponent.closed.subscribe(closedSpy);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    modalFixture.detectChanges();

    // Comprobación empírica: ¿AccountSettingsModalComponent escucha window:keydown.escape?
    const didCloseOnEsc = closedSpy.mock.calls.length > 0;
    // Anotamos el resultado empírico
    expect(didCloseOnEsc).toBe(false); // Demuestra que NO se cierra con Escape
  });

  it('comprobar si en HeaderComponent al presionar ESC se cierra isAccountModalOpen', () => {
    const headerFixture = TestBed.createComponent(HeaderComponent);
    const headerComponent = headerFixture.componentInstance;
    headerFixture.detectChanges();

    headerComponent.isAccountModalOpen.set(true);
    expect(headerComponent.isAccountModalOpen()).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    headerFixture.detectChanges();

    // Comprobación empírica: ¿handleGlobalKeyDown cierra isAccountModalOpen?
    expect(headerComponent.isAccountModalOpen()).toBe(true); // Demuestra que Header NO cierra el modal en Escape
  });

  it('comprobar si al hacer clic en el backdrop fuera del diálogo se cierra el modal', () => {
    const closedSpy = vi.fn();
    modalComponent.closed.subscribe(closedSpy);

    // Backdrop es el contenedor fijo exterior
    const backdropEl = modalFixture.nativeElement.querySelector('.fixed.inset-0') as HTMLElement;
    expect(backdropEl).toBeTruthy();
    backdropEl.click();
    modalFixture.detectChanges();

    // Comprobación empírica: ¿backdrop click emite closed?
    expect(closedSpy).not.toHaveBeenCalled(); // Demuestra que backdrop click NO cierra el modal
  });
});
