import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, NgZone, PLATFORM_ID, inject, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import { SupabaseService } from './supabase.service';

export const GIS_CLIENT_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
export const GOOGLE_CLIENT_ID_PLACEHOLDER = '<PEGA_AQUI_TU_GOOGLE_CLIENT_ID>';

/**
 * Respuesta entregada por Google Identity Services (GIS) tras la autenticación exitosa del usuario.
 */
export interface GoogleCredentialResponse {
  readonly credential: string;
  readonly select_by?: string;
  readonly clientId?: string;
}

/**
 * Configuración de inicialización para `google.accounts.id.initialize(...)`.
 */
export interface GoogleIdConfiguration {
  readonly client_id: string;
  readonly callback: (response: GoogleCredentialResponse) => void;
  readonly nonce?: string;
  readonly context?: 'signin' | 'signup' | 'use';
  readonly ux_mode?: 'popup' | 'redirect';
  readonly use_fedcm_for_prompt?: boolean;
  readonly auto_select?: boolean;
  readonly cancel_on_tap_outside?: boolean;
  readonly itgp?: boolean;
}

/**
 * Configuración visual para `google.accounts.id.renderButton(...)`.
 */
export interface GsiButtonConfiguration {
  readonly type?: 'standard' | 'icon';
  readonly theme?: 'outline' | 'filled_blue' | 'filled_black';
  readonly size?: 'large' | 'medium' | 'small';
  readonly text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  readonly shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  readonly logo_alignment?: 'left' | 'center';
  readonly width?: number | string;
  readonly locale?: string;
}

/**
 * Notificación del estado del prompt de One Tap (`google.accounts.id.prompt`).
 */
export interface PromptMomentNotification {
  isDisplayMoment(): boolean;
  isDisplayed(): boolean;
  isNotDisplayed(): boolean;
  getNotDisplayedReason(): string;
  isSkippedMoment(): boolean;
  getSkippedReason(): string;
  isDismissedMoment(): boolean;
  getDismissedReason(): string;
}

/**
 * Interfaz fuertemente tipada para `window.google.accounts.id` (cero uso de `any`).
 */
export interface GoogleAccountsIdApi {
  initialize(config: GoogleIdConfiguration): void;
  renderButton(parent: HTMLElement, options: GsiButtonConfiguration): void;
  prompt(momentListener?: (notification: PromptMomentNotification) => void): void;
  disableAutoSelect(): void;
  cancel(): void;
}

export interface GoogleAccountsNamespace {
  readonly id?: GoogleAccountsIdApi;
}

export interface GoogleGlobalNamespace {
  readonly accounts?: GoogleAccountsNamespace;
}

declare global {
  interface Window {
    google?: GoogleGlobalNamespace;
  }
}

export interface GoogleNoncePair {
  readonly rawNonce: string;
  readonly hashedNonce: string;
}

export interface GoogleSignInResult {
  readonly success: boolean;
  readonly errorKey?: string;
}

export interface RenderGoogleButtonOptions {
  readonly container: HTMLElement;
  readonly width?: number;
  readonly locale?: string;
  readonly context?: 'signin' | 'signup';
  readonly text?: 'continue_with' | 'signin_with' | 'signup_with';
  readonly onSuccess?: () => void | Promise<void>;
  readonly onError?: (errorKey: string) => void;
  readonly onStart?: () => void;
}

/**
 * Convierte un arreglo de bytes (`Uint8Array`) a una cadena hexadecimal en minúsculas.
 */
function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Genera un `rawNonce` criptográficamente seguro con `crypto.getRandomValues`
 * y su correspondiente `hashedNonce` SHA-256 (64 caracteres hexadecimales) con `crypto.subtle.digest`.
 */
export async function generateGoogleNoncePair(): Promise<GoogleNoncePair> {
  const randomBytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(randomBytes);
  } else {
    for (let i = 0; i < randomBytes.length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const rawNonce = bytesToHex(randomBytes);
  const encoded = new TextEncoder().encode(rawNonce);

  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashedNonce = bytesToHex(new Uint8Array(hashBuffer));
    return { rawNonce, hashedNonce };
  }

  throw new Error('Web Crypto SHA-256 subtle.digest is required for Google Identity Services nonce generation.');
}

/**
 * Servicio dedicado para Google Identity Services (GIS) y flujo `signInWithIdToken` con Nonce SHA-256.
 * Permite autenticar con Google mostrando directamente el dominio oficial (`piezo3d.com` / `Piezo3D Studio`)
 * en lugar del subdominio técnico de infraestructura.
 */
@Injectable({
  providedIn: 'root'
})
export class GoogleIdentityService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly ngZone = inject(NgZone);
  private readonly supabaseService = inject(SupabaseService);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private scriptLoadPromise: Promise<GoogleAccountsIdApi> | null = null;
  private activeNoncePair: GoogleNoncePair | null = null;

  readonly isSdkReady = signal<boolean>(false);
  readonly isSdkLoadFailed = signal<boolean>(false);
  readonly isAuthenticating = signal<boolean>(false);

  /**
   * Retorna el `googleClientId` configurado en `environment` (`SUPABASE_CONFIG.googleClientId`).
   */
  getClientId(): string {
    const envClientId = (environment.googleClientId ?? '').trim();
    const configClientId = (this.supabaseService?.config?.googleClientId ?? '').trim();
    return configClientId || envClientId;
  }

  /**
   * Verifica si el `googleClientId` ha sido configurado con un ID real de Google Cloud Console
   * (distinto de vacío y del placeholder `<PEGA_AQUI_TU_GOOGLE_CLIENT_ID>`).
   */
  isClientIdConfigured(clientId = this.getClientId()): boolean {
    const trimmed = clientId.trim();
    return (
      trimmed.length > 0 &&
      trimmed !== GOOGLE_CLIENT_ID_PLACEHOLDER &&
      !trimmed.includes('PEGA_AQUI')
    );
  }

  /**
   * Genera un par de nonces criptográficamente seguros (`rawNonce` y `hashedNonce` SHA-256 en hex).
   */
  async createNoncePair(): Promise<GoogleNoncePair> {
    const pair = await generateGoogleNoncePair();
    this.activeNoncePair = pair;
    return pair;
  }

  /**
   * Obtiene el último par de nonces generado para la sesión actual de GIS.
   */
  getActiveNoncePair(): GoogleNoncePair | null {
    return this.activeNoncePair;
  }

  /**
   * Carga dinámicamente (una sola vez, sin duplicar etiquetas `<script>`) el SDK oficial de Google:
   * `https://accounts.google.com/gsi/client`.
   */
  loadGisSdk(): Promise<GoogleAccountsIdApi> {
    if (!this.isBrowser || typeof window === 'undefined') {
      return Promise.reject(new Error('Google Identity Services solo está disponible en el navegador.'));
    }

    const existingApi = window.google?.accounts?.id;
    if (existingApi) {
      this.isSdkReady.set(true);
      this.isSdkLoadFailed.set(false);
      return Promise.resolve(existingApi);
    }

    if (this.scriptLoadPromise) {
      return this.scriptLoadPromise;
    }

    this.isSdkLoadFailed.set(false);

    this.scriptLoadPromise = new Promise<GoogleAccountsIdApi>((resolve, reject) => {
      let scriptElement: HTMLScriptElement | null = null;

      const checkAndResolve = (): void => {
        const api = window.google?.accounts?.id;
        if (api) {
          this.ngZone.run(() => {
            this.isSdkReady.set(true);
            this.isSdkLoadFailed.set(false);
          });
          resolve(api);
        } else {
          this.scriptLoadPromise = null;
          this.ngZone.run(() => {
            this.isSdkReady.set(false);
            this.isSdkLoadFailed.set(true);
          });
          if (scriptElement?.parentNode) {
            scriptElement.remove();
          }
          if (this.isBrowser && !environment.production) {
            console.warn('[GIS] Google Identity Services script loaded, but window.google.accounts.id is unavailable.');
          }
          reject(new Error('Google Identity Services SDK cargó pero window.google.accounts.id no está disponible.'));
        }
      };

      const handleError = (): void => {
        this.scriptLoadPromise = null;
        this.ngZone.run(() => {
          this.isSdkReady.set(false);
          this.isSdkLoadFailed.set(true);
        });
        if (scriptElement?.parentNode) {
          scriptElement.remove();
        }
        if (this.isBrowser && !environment.production) {
          console.warn('[GIS] Google Identity Services script was blocked or failed to load (e.g., tracker blocker / Brave Shields).');
        }
        reject(new Error('No fue posible cargar el SDK de Google Identity Services.'));
      };

      const existingScript = this.document.querySelector<HTMLScriptElement>(
        `script[src="${GIS_CLIENT_SCRIPT_SRC}"]`
      );

      if (existingScript) {
        scriptElement = existingScript;
        if (window.google?.accounts?.id) {
          checkAndResolve();
          return;
        }
        existingScript.addEventListener('load', checkAndResolve, { once: true });
        existingScript.addEventListener('error', handleError, { once: true });
        return;
      }

      const script = this.document.createElement('script');
      scriptElement = script;
      script.src = GIS_CLIENT_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', checkAndResolve, { once: true });
      script.addEventListener('error', handleError, { once: true });
      (this.document.head ?? this.document.body).appendChild(script);
    });

    return this.scriptLoadPromise;
  }

  /**
   * Inicializa Google Identity Services con `hashedNonce` y renderiza el botón oficial de Google
   * dentro del contenedor proporcionado mediante `google.accounts.id.renderButton(...)`.
   */
  async initializeAndRenderButton(options: RenderGoogleButtonOptions): Promise<boolean> {
    if (!this.isBrowser) {
      return false;
    }

    const clientId = this.getClientId();
    if (!this.isClientIdConfigured(clientId)) {
      if (!environment.production) {
        console.warn('[GIS] Google Client ID is not configured.');
      }
      return false;
    }

    try {
      const gisApi = await this.loadGisSdk();
      const { rawNonce, hashedNonce } = await this.createNoncePair();

      if (!environment.production) {
        console.info('[GIS] Initializing Google Identity Services button', {
          context: options.context ?? 'signin',
          ux_mode: 'popup',
          use_fedcm_for_prompt: false
        });
      }

      gisApi.initialize({
        client_id: clientId,
        nonce: hashedNonce,
        context: options.context ?? 'signin',
        ux_mode: 'popup',
        use_fedcm_for_prompt: false,
        auto_select: false,
        cancel_on_tap_outside: true,
        callback: (response: GoogleCredentialResponse) => {
          void this.handleGoogleCredentialResponse(response, rawNonce, options);
        }
      });

      const targetWidth = this.resolveButtonWidth(options.container, options.width);
      options.container.innerHTML = '';

      const buttonConfig: GsiButtonConfiguration = {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: options.text ?? 'continue_with',
        logo_alignment: 'left',
        ...(targetWidth ? { width: targetWidth } : {}),
        ...(options.locale ? { locale: options.locale } : {})
      };

      gisApi.renderButton(options.container, buttonConfig);
      this.ngZone.run(() => {
        this.isSdkReady.set(true);
        this.isSdkLoadFailed.set(false);
      });
      return true;
    } catch (err: unknown) {
      this.scriptLoadPromise = null;
      this.ngZone.run(() => {
        this.isSdkReady.set(false);
        this.isSdkLoadFailed.set(true);
      });
      if (!environment.production) {
        console.warn('[GIS] Google Identity Services initialization or script loading failed:', err);
      }
      return false;
    }
  }

  /**
   * Procesa el `credential` recibido desde el callback de Google Identity Services
   * enviándolo a `supabaseService.signInWithGoogleIdToken(credential, rawNonce)` dentro de `NgZone.run()`.
   */
  async handleGoogleCredentialResponse(
    response: GoogleCredentialResponse,
    rawNonce?: string,
    callbacks?: Pick<RenderGoogleButtonOptions, 'onStart' | 'onSuccess' | 'onError'>
  ): Promise<GoogleSignInResult> {
    const credential = typeof response?.credential === 'string' ? response.credential.trim() : '';
    const effectiveRawNonce = rawNonce ?? this.activeNoncePair?.rawNonce;

    if (!credential) {
      const result: GoogleSignInResult = {
        success: false,
        errorKey: 'auth.errors.oauthUnavailable'
      };
      this.ngZone.run(() => {
        callbacks?.onError?.(result.errorKey!);
      });
      return result;
    }

    this.ngZone.run(() => {
      this.isAuthenticating.set(true);
      callbacks?.onStart?.();
    });

    try {
      const authResult = await this.supabaseService.signInWithGoogleIdToken(
        credential,
        effectiveRawNonce
      );

      return await this.ngZone.run(async () => {
        if (authResult.success) {
          // Regenerar el par de nonces después de consumir el token actual
          void this.createNoncePair().catch(() => undefined);
          await callbacks?.onSuccess?.();
          return { success: true };
        }

        const errKey = authResult.errorKey ?? 'auth.errors.oauthUnavailable';
        callbacks?.onError?.(errKey);
        return { success: false, errorKey: errKey };
      });
    } catch (err: unknown) {
      return this.ngZone.run(() => {
        const errKey = this.supabaseService.mapAuthErrorToKey(err);
        callbacks?.onError?.(errKey);
        return { success: false, errorKey: errKey };
      });
    } finally {
      this.ngZone.run(() => {
        this.isAuthenticating.set(false);
      });
    }
  }

  /**
   * Desactiva la selección automática de cuenta en Google Identity Services (`disableAutoSelect`)
   * al cerrar sesión para que el usuario pueda elegir otra cuenta libremente.
   */
  disableAutoSelect(): void {
    if (!this.isBrowser || typeof window === 'undefined') {
      return;
    }
    try {
      window.google?.accounts?.id?.disableAutoSelect();
    } catch {
      // Ignorar si el SDK de GIS aún no fue cargado en la sesión actual
    }
  }

  private resolveButtonWidth(container: HTMLElement, explicitWidth?: number): number | undefined {
    const rawWidth =
      typeof explicitWidth === 'number' && explicitWidth > 0
        ? explicitWidth
        : Math.round(container.getBoundingClientRect().width || container.clientWidth || 0);

    if (!rawWidth || rawWidth <= 0) {
      return 360;
    }
    // Google Identity Services admite widths numéricos entre 200px y 400px
    return Math.min(400, Math.max(200, rawWidth));
  }
}
