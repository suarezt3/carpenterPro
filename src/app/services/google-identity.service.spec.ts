import { TestBed } from '@angular/core/testing';
import {
  GIS_CLIENT_SCRIPT_SRC,
  GOOGLE_CLIENT_ID_PLACEHOLDER,
  GoogleAccountsIdApi,
  GoogleCredentialResponse,
  GoogleIdConfiguration,
  GoogleIdentityService,
  GsiButtonConfiguration,
  generateGoogleNoncePair
} from './google-identity.service';
import { SupabaseService } from './supabase.service';

describe('GoogleIdentityService (GIS + signInWithIdToken con Nonce SHA-256)', () => {
  let service: GoogleIdentityService;
  let mockSupabaseService: {
    config: { url: string; publishableKey: string; googleClientId: string };
    signInWithGoogleIdToken: ReturnType<typeof vi.fn>;
    mapAuthErrorToKey: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockSupabaseService = {
      config: {
        url: 'https://umdcxcjrdyckpxomxlmi.supabase.co',
        publishableKey: 'sb_publishable_FYydWGY0juW6ajW5tLiQQQ_Stz1tMVD',
        googleClientId: '1234567890-piezo3d.apps.googleusercontent.com'
      },
      signInWithGoogleIdToken: vi.fn().mockResolvedValue({ success: true }),
      mapAuthErrorToKey: vi.fn().mockReturnValue('auth.errors.oauthUnavailable')
    };

    TestBed.configureTestingModule({
      providers: [
        GoogleIdentityService,
        { provide: SupabaseService, useValue: mockSupabaseService }
      ]
    });

    service = TestBed.inject(GoogleIdentityService);
    delete window.google;
    document
      .querySelectorAll(`script[src="${GIS_CLIENT_SCRIPT_SRC}"]`)
      .forEach((node) => node.remove());
  });

  afterEach(() => {
    delete window.google;
    document
      .querySelectorAll(`script[src="${GIS_CLIENT_SCRIPT_SRC}"]`)
      .forEach((node) => node.remove());
    vi.restoreAllMocks();
  });

  describe('Generación de rawNonce y hashedNonce (SHA-256)', () => {
    it('debe generar rawNonce y hashedNonce de 64 caracteres hexadecimales con SHA-256 verificable', async () => {
      const pair1 = await generateGoogleNoncePair();
      const pair2 = await service.createNoncePair();

      expect(pair1.rawNonce).toMatch(/^[0-9a-f]{64}$/);
      expect(pair1.hashedNonce).toMatch(/^[0-9a-f]{64}$/);
      expect(pair1.rawNonce).not.toBe(pair1.hashedNonce);

      expect(pair2.rawNonce).toMatch(/^[0-9a-f]{64}$/);
      expect(pair2.hashedNonce).toMatch(/^[0-9a-f]{64}$/);
      expect(pair1.rawNonce).not.toBe(pair2.rawNonce);

      // Verificación criptográfica independiente del SHA-256 de rawNonce
      const encoded = new TextEncoder().encode(pair2.rawNonce);
      const digest = await crypto.subtle.digest('SHA-256', encoded);
      const expectedHex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      expect(pair2.hashedNonce).toBe(expectedHex);
      expect(service.getActiveNoncePair()).toEqual(pair2);
    });
  });

  describe('Carga dinámica única del SDK oficial de Google Identity Services', () => {
    it('debe insertar una sola etiqueta <script src="https://accounts.google.com/gsi/client"> sin duplicarla en llamadas concurrentes', async () => {
      const mockGisApi: GoogleAccountsIdApi = {
        initialize: vi.fn(),
        renderButton: vi.fn(),
        prompt: vi.fn(),
        disableAutoSelect: vi.fn(),
        cancel: vi.fn()
      };

      const p1 = service.loadGisSdk();
      const p2 = service.loadGisSdk();

      const scripts = document.querySelectorAll<HTMLScriptElement>(
        `script[src="${GIS_CLIENT_SCRIPT_SRC}"]`
      );
      expect(scripts.length).toBe(1);

      window.google = { accounts: { id: mockGisApi } };
      scripts[0].dispatchEvent(new Event('load'));

      const [api1, api2] = await Promise.all([p1, p2]);
      expect(api1).toBe(mockGisApi);
      expect(api2).toBe(mockGisApi);
      expect(service.isSdkReady()).toBe(true);
      expect(service.isSdkLoadFailed()).toBe(false);
    });

    it('debe marcar isSdkLoadFailed=true, limpiar scriptLoadPromise y permitir reintento limpio si el script es bloqueado (Brave Shields / ad blocker)', async () => {
      const failedLoadPromise = service.loadGisSdk();

      const scripts = document.querySelectorAll<HTMLScriptElement>(
        `script[src="${GIS_CLIENT_SCRIPT_SRC}"]`
      );
      expect(scripts.length).toBe(1);
      scripts[0].dispatchEvent(new Event('error'));

      await expect(failedLoadPromise).rejects.toThrow('No fue posible cargar el SDK de Google Identity Services.');
      expect(service.isSdkReady()).toBe(false);
      expect(service.isSdkLoadFailed()).toBe(true);

      // Reintento limpio tras desbloquear el script
      const mockGisApi: GoogleAccountsIdApi = {
        initialize: vi.fn(),
        renderButton: vi.fn(),
        prompt: vi.fn(),
        disableAutoSelect: vi.fn(),
        cancel: vi.fn()
      };

      const retryPromise = service.loadGisSdk();
      const retryScripts = document.querySelectorAll<HTMLScriptElement>(
        `script[src="${GIS_CLIENT_SCRIPT_SRC}"]`
      );
      expect(retryScripts.length).toBe(1);

      window.google = { accounts: { id: mockGisApi } };
      retryScripts[0].dispatchEvent(new Event('load'));

      const loadedApi = await retryPromise;
      expect(loadedApi).toBe(mockGisApi);
      expect(service.isSdkReady()).toBe(true);
      expect(service.isSdkLoadFailed()).toBe(false);
    });

    it('debe marcar isSdkLoadFailed=true si el script carga sin window.google.accounts.id y permitir reintento posterior', async () => {
      const brokenLoadPromise = service.loadGisSdk();
      const scripts = document.querySelectorAll<HTMLScriptElement>(
        `script[src="${GIS_CLIENT_SCRIPT_SRC}"]`
      );
      expect(scripts.length).toBe(1);
      scripts[0].dispatchEvent(new Event('load'));

      await expect(brokenLoadPromise).rejects.toThrow(
        'Google Identity Services SDK cargó pero window.google.accounts.id no está disponible.'
      );
      expect(service.isSdkReady()).toBe(false);
      expect(service.isSdkLoadFailed()).toBe(true);
    });
  });

  describe('Inicialización de GIS, renderButton y callback hacia signInWithIdToken', () => {
    it('no debe inicializar GIS si googleClientId tiene el placeholder sin configurar', async () => {
      mockSupabaseService.config.googleClientId = GOOGLE_CLIENT_ID_PLACEHOLDER;
      expect(service.isClientIdConfigured(GOOGLE_CLIENT_ID_PLACEHOLDER)).toBe(false);

      const container = document.createElement('div');
      const rendered = await service.initializeAndRenderButton({ container });
      expect(rendered).toBe(false);
    });

    it('debe inicializar GIS con hashedNonce, renderizar el botón con renderButton y enviar rawNonce + token a signInWithGoogleIdToken', async () => {
      let capturedConfig: GoogleIdConfiguration | null = null;
      let capturedButtonOptions: GsiButtonConfiguration | null = null;

      const mockGisApi: GoogleAccountsIdApi = {
        initialize: vi.fn((cfg: GoogleIdConfiguration) => {
          capturedConfig = cfg;
        }),
        renderButton: vi.fn((parent: HTMLElement, options: GsiButtonConfiguration) => {
          capturedButtonOptions = options;
          const btn = document.createElement('div');
          btn.setAttribute('data-gis-rendered', 'true');
          parent.appendChild(btn);
        }),
        prompt: vi.fn(),
        disableAutoSelect: vi.fn(),
        cancel: vi.fn()
      };

      window.google = { accounts: { id: mockGisApi } };

      const container = document.createElement('div');
      const onStart = vi.fn();
      const onSuccess = vi.fn();
      const onError = vi.fn();

      const rendered = await service.initializeAndRenderButton({
        container,
        width: 380,
        locale: 'es',
        context: 'signin',
        text: 'continue_with',
        onStart,
        onSuccess,
        onError
      });

      expect(rendered).toBe(true);
      expect(service.isSdkReady()).toBe(true);
      expect(service.isSdkLoadFailed()).toBe(false);
      expect(mockGisApi.initialize).toHaveBeenCalledTimes(1);
      expect(mockGisApi.renderButton).toHaveBeenCalledTimes(1);
      expect(container.querySelector('[data-gis-rendered="true"]')).toBeTruthy();

      const activePair = service.getActiveNoncePair();
      expect(activePair).toBeTruthy();
      expect(capturedConfig).toBeTruthy();
      expect(capturedConfig!.client_id).toBe('1234567890-piezo3d.apps.googleusercontent.com');
      expect(capturedConfig!.nonce).toBe(activePair!.hashedNonce);
      expect(capturedConfig!.context).toBe('signin');
      expect(capturedConfig!.ux_mode).toBe('popup');
      expect(capturedConfig!.use_fedcm_for_prompt).toBe(false);

      expect(capturedButtonOptions).toEqual({
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'continue_with',
        logo_alignment: 'left',
        width: 380,
        locale: 'es'
      });

      // Simular respuesta exitosa desde Google Identity Services
      const rawNonceBeforeCallback = activePair!.rawNonce;
      const fakeResponse: GoogleCredentialResponse = {
        credential: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.mockGoogleIdToken',
        select_by: 'btn'
      };

      capturedConfig!.callback(fakeResponse);

      await vi.waitFor(() => {
        expect(mockSupabaseService.signInWithGoogleIdToken).toHaveBeenCalledWith(
          'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.mockGoogleIdToken',
          rawNonceBeforeCallback
        );
        expect(onStart).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onError).not.toHaveBeenCalled();
      });
    });

    it('debe propagar el error i18n a onError si signInWithGoogleIdToken falla o si el credential llega vacío', async () => {
      mockSupabaseService.signInWithGoogleIdToken.mockResolvedValueOnce({
        success: false,
        errorKey: 'auth.errors.oauthUnavailable'
      });

      const onError = vi.fn();
      const onSuccess = vi.fn();

      const failRes = await service.handleGoogleCredentialResponse(
        { credential: 'invalid-jwt-token' },
        'raw-nonce-test-123',
        { onError, onSuccess }
      );

      expect(failRes.success).toBe(false);
      expect(failRes.errorKey).toBe('auth.errors.oauthUnavailable');
      expect(onError).toHaveBeenCalledWith('auth.errors.oauthUnavailable');
      expect(onSuccess).not.toHaveBeenCalled();

      // Credential vacío
      const emptyError = vi.fn();
      const emptyRes = await service.handleGoogleCredentialResponse(
        { credential: '   ' },
        'raw-nonce-test-123',
        { onError: emptyError }
      );
      expect(emptyRes.success).toBe(false);
      expect(emptyError).toHaveBeenCalledWith('auth.errors.oauthUnavailable');
    });

    it('initializeAndRenderButton debe retornar false y activar isSdkLoadFailed cuando el script es bloqueado, y recuperarse en el reintento', async () => {
      const container = document.createElement('div');
      const renderPromise = service.initializeAndRenderButton({
        container,
        context: 'signup',
        locale: 'es'
      });

      const scripts = document.querySelectorAll<HTMLScriptElement>(
        `script[src="${GIS_CLIENT_SCRIPT_SRC}"]`
      );
      expect(scripts.length).toBe(1);
      scripts[0].dispatchEvent(new Event('error'));

      const firstAttempt = await renderPromise;
      expect(firstAttempt).toBe(false);
      expect(service.isSdkReady()).toBe(false);
      expect(service.isSdkLoadFailed()).toBe(true);

      // Reintentar cuando el script logra cargar correctamente
      const mockGisApi: GoogleAccountsIdApi = {
        initialize: vi.fn(),
        renderButton: vi.fn(),
        prompt: vi.fn(),
        disableAutoSelect: vi.fn(),
        cancel: vi.fn()
      };

      const retryPromise = service.initializeAndRenderButton({
        container,
        context: 'signup',
        locale: 'es'
      });

      const retryScripts = document.querySelectorAll<HTMLScriptElement>(
        `script[src="${GIS_CLIENT_SCRIPT_SRC}"]`
      );
      expect(retryScripts.length).toBe(1);
      window.google = { accounts: { id: mockGisApi } };
      retryScripts[0].dispatchEvent(new Event('load'));

      const secondAttempt = await retryPromise;
      expect(secondAttempt).toBe(true);
      expect(service.isSdkReady()).toBe(true);
      expect(service.isSdkLoadFailed()).toBe(false);
      expect(mockGisApi.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          context: 'signup',
          ux_mode: 'popup',
          use_fedcm_for_prompt: false
        })
      );
    });

    it('disableAutoSelect debe invocar window.google.accounts.id.disableAutoSelect() de forma segura', () => {
      const disableAutoSelectSpy = vi.fn();
      window.google = {
        accounts: {
          id: {
            initialize: vi.fn(),
            renderButton: vi.fn(),
            prompt: vi.fn(),
            disableAutoSelect: disableAutoSelectSpy,
            cancel: vi.fn()
          }
        }
      };

      service.disableAutoSelect();
      expect(disableAutoSelectSpy).toHaveBeenCalledTimes(1);
    });
  });
});
