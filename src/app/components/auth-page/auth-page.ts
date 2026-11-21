import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Alert02Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  CircleArrowReload01Icon,
  CircleIcon,
  Compass01Icon,
  Globe02Icon,
  LockPasswordIcon,
  Mail01Icon,
  RefreshIcon,
  Shield01Icon,
  UserIcon,
  ViewIcon,
  ViewOffSlashIcon
} from '@hugeicons/core-free-icons';

import { environment } from '../../../environments/environment';
import { SupabaseService } from '../../services/supabase.service';
import { GoogleIdentityService } from '../../services/google-identity.service';
import { PaymentService } from '../../services/payment.service';
import { I18nService } from '../../services/i18n.service';
import { AppLanguage } from '../../data/i18n-translations.data';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { resolvePublicSupportEmail } from '../../utils/support-email';

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

const NAME_LETTERS_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛãõÃÕäëïöüÄËÏÖÜñÑçÇß\s'-]+$/;
const EMAIL_FORMAT_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const SPECIAL_CHAR_REGEX = /[^\p{L}\p{N}\s]/u;

/**
 * Página dedicada de Autenticación y Gestión de Acceso de Piezo3D Studio (`/auth`).
 * Soporta Iniciar Sesión, Registro (Correo y Google) y Recuperación / Restablecimiento de Contraseña
 * con validación reactiva en tiempo real, estética Enterprise Light UI, fuente Inter y 100% Hugeicons.
 */
@Component({
  selector: 'app-auth-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    HugeiconsIconComponent,
    TranslatePipe
  ],
  host: {
    '(window:click)': 'closeLanguageDropdown()',
    '(window:keydown.escape)': 'closeLanguageDropdown()'
  },
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.css'
})
export class AuthPageComponent {
  readonly supabaseService = inject(SupabaseService);
  readonly googleIdentityService = inject(GoogleIdentityService);
  readonly paymentService = inject(PaymentService);
  readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly googleButtonContainer = viewChild<ElementRef<HTMLDivElement>>('googleButtonContainer');
  readonly isGisButtonRendered = signal<boolean>(false);
  readonly isGisLoading = signal<boolean>(false);
  readonly isGisLoadBlocked = signal<boolean>(false);
  readonly effectiveGisLoadBlocked = computed<boolean>(() => {
    const sdkFailed = this.googleIdentityService.isSdkLoadFailed?.() ?? false;
    return this.isGisLoadBlocked() || (sdkFailed && !this.isGisButtonRendered() && !this.isGisLoading());
  });

  private gisRenderRequestId = 0;
  private isDestroyed = false;

  // Catálogo de iconos oficiales de Hugeicons
  readonly icons = {
    brand: Compass01Icon,
    arrowLeft: ArrowLeft01Icon,
    arrowRight: ArrowRight01Icon,
    arrowDown: ArrowDown01Icon,
    globe: Globe02Icon,
    user: UserIcon,
    mail: Mail01Icon,
    lock: LockPasswordIcon,
    view: ViewIcon,
    viewOff: ViewOffSlashIcon,
    checkCircle: CheckmarkCircle02Icon,
    neutralCircle: CircleIcon,
    alert: AlertCircleIcon,
    warning: Alert02Icon,
    refresh: RefreshIcon,
    spinner: CircleArrowReload01Icon,
    shield: Shield01Icon
  };

  // Modo activo de autenticación sincronizado con query param ?mode=
  readonly mode = signal<AuthMode>('login');

  // Visibilidad independiente de contraseñas
  readonly showPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);

  // Selector de idioma superior
  readonly isLangDropdownOpen = signal<boolean>(false);
  readonly supportedLanguages = this.i18n.languages;
  readonly currentLanguageOption = this.i18n.currentLanguageOption;

  readonly supportEmail = computed<string>(() => {
    const settingsFn = (
      this.supabaseService as {
        platformSettings?: () => { support_email?: string } | null;
      }
    ).platformSettings;
    const rawEmail = typeof settingsFn === 'function' ? settingsFn()?.support_email : undefined;
    return resolvePublicSupportEmail(rawEmail);
  });

  // Estados de envío y notificaciones amigables (claves i18n)
  readonly isSubmitting = signal<boolean>(false);
  readonly isGoogleSubmitting = signal<boolean>(false);
  readonly errorKey = signal<string | null>(null);
  readonly registrationConfirmationPending = signal<boolean>(false);
  readonly resetEmailSent = signal<boolean>(false);
  readonly passwordResetSuccess = signal<boolean>(false);

  // Señales de bloqueo inmediato cuando el usuario intenta teclear dígitos numéricos en Nombre/Apellido
  readonly firstNameDigitBlocked = signal<boolean>(false);
  readonly lastNameDigitBlocked = signal<boolean>(false);

  // Formulario reactivo fuertemente tipado con NonNullableFormBuilder
  readonly authForm = this.fb.group({
    firstName: [''],
    lastName: [''],
    email: [''],
    password: [''],
    confirmPassword: ['']
  });

  // Signals reactivos de campos sincronizados bidireccionalmente con authForm
  readonly firstName = signal<string>('');
  readonly lastName = signal<string>('');
  readonly email = signal<string>('');
  readonly password = signal<string>('');
  readonly confirmPassword = signal<string>('');

  // =========================================================
  // VALIDACIONES EN TIEMPO REAL BASADAS EN SIGNALS (COMPUTED)
  // =========================================================

  // 1. Nombre (Obligatorio en Registro: mínimo 3 letras, prohibido números)
  readonly firstNameTrimmed = computed(() => this.firstName().trim());
  readonly firstNameLetterCount = computed(() =>
    this.firstNameTrimmed().replace(/[\s'-]/g, '').length
  );
  readonly firstNameHasNumbers = computed(() => /\d/.test(this.firstName()));
  readonly firstNameHasInvalidChars = computed(() => {
    const raw = this.firstName();
    const trimmed = this.firstNameTrimmed();
    if (raw.length === 0) return false;
    if (/\d/.test(raw)) return true;
    return trimmed.length > 0 && !NAME_LETTERS_REGEX.test(trimmed);
  });
  readonly isFirstNameValid = computed(() => {
    const raw = this.firstName();
    const trimmed = this.firstNameTrimmed();
    return (
      trimmed.length >= 3 &&
      this.firstNameLetterCount() >= 3 &&
      !/\d/.test(raw) &&
      NAME_LETTERS_REGEX.test(trimmed)
    );
  });

  // 2. Segundo Nombre o Apellido (Opcional en Registro, prohibido números si escribe texto)
  readonly lastNameTrimmed = computed(() => this.lastName().trim());
  readonly lastNameLetterCount = computed(() =>
    this.lastNameTrimmed().replace(/[\s'-]/g, '').length
  );
  readonly lastNameHasNumbers = computed(() => /\d/.test(this.lastName()));
  readonly lastNameHasInvalidChars = computed(() => {
    const raw = this.lastName();
    const trimmed = this.lastNameTrimmed();
    if (raw.length === 0) return false;
    if (/\d/.test(raw)) return true;
    return trimmed.length > 0 && (!NAME_LETTERS_REGEX.test(trimmed) || this.lastNameLetterCount() === 0);
  });
  readonly isLastNameValid = computed(() => {
    const raw = this.lastName();
    const trimmed = this.lastNameTrimmed();
    if (trimmed.length === 0) {
      return !/\d/.test(raw);
    }
    return this.lastNameLetterCount() >= 1 && !/\d/.test(raw) && NAME_LETTERS_REGEX.test(trimmed);
  });

  // 3. Correo Electrónico (Formato real en tiempo real)
  readonly emailTrimmed = computed(() => this.email().trim());
  readonly isEmailTouchedOrNonEmpty = computed(() => this.emailTrimmed().length > 0);
  readonly isEmailValid = computed(() => EMAIL_FORMAT_REGEX.test(this.emailTrimmed()));

  // 4 & 5. Checklist Interactivo de Contraseña en Tiempo Real
  readonly pwHasMinLength = computed(() => this.password().length >= 8);
  readonly pwHasNumber = computed(() => /\d/.test(this.password()));
  readonly pwHasSpecialChar = computed(() => SPECIAL_CHAR_REGEX.test(this.password()));
  readonly pwMatchesConfirm = computed(
    () => this.password().length > 0 && this.password() === this.confirmPassword()
  );
  readonly isPasswordChecklistComplete = computed(
    () =>
      this.pwHasMinLength() &&
      this.pwHasNumber() &&
      this.pwHasSpecialChar() &&
      this.pwMatchesConfirm()
  );

  // 6. Validación Integral del Modo Activo para Habilitar/Bloquear el Envío
  readonly isCurrentFormValid = computed<boolean>(() => {
    switch (this.mode()) {
      case 'login':
        return this.isEmailValid() && this.password().length > 0;
      case 'register':
        return (
          this.isFirstNameValid() &&
          this.isLastNameValid() &&
          this.isEmailValid() &&
          this.isPasswordChecklistComplete()
        );
      case 'forgot':
        return this.isEmailValid();
      case 'reset':
        return this.isPasswordChecklistComplete();
    }
  });

  constructor() {
    // Sincronizar cambios desde ReactiveForms hacia los Signals reactivos
    this.authForm.controls.firstName.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((val) => {
        if (this.firstName() !== val) {
          this.firstName.set(val);
        }
        if (!/\d/.test(val)) {
          this.firstNameDigitBlocked.set(false);
        }
        this.clearTransientErrors();
      });

    this.authForm.controls.lastName.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((val) => {
        if (this.lastName() !== val) {
          this.lastName.set(val);
        }
        if (!/\d/.test(val)) {
          this.lastNameDigitBlocked.set(false);
        }
        this.clearTransientErrors();
      });

    this.authForm.controls.email.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((val) => {
        if (this.email() !== val) {
          this.email.set(val);
        }
        this.clearTransientErrors();
      });

    this.authForm.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((val) => {
        if (this.password() !== val) {
          this.password.set(val);
        }
        this.clearTransientErrors();
      });

    this.authForm.controls.confirmPassword.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((val) => {
        if (this.confirmPassword() !== val) {
          this.confirmPassword.set(val);
        }
        this.clearTransientErrors();
      });

    // Sincronización inversa cuando los Signals se actualizan directamente por código
    effect(() => {
      const fn = this.firstName();
      const ln = this.lastName();
      const em = this.email();
      const pw = this.password();
      const cpw = this.confirmPassword();

      if (this.authForm.controls.firstName.value !== fn) {
        this.authForm.controls.firstName.setValue(fn, { emitEvent: false });
      }
      if (this.authForm.controls.lastName.value !== ln) {
        this.authForm.controls.lastName.setValue(ln, { emitEvent: false });
      }
      if (this.authForm.controls.email.value !== em) {
        this.authForm.controls.email.setValue(em, { emitEvent: false });
      }
      if (this.authForm.controls.password.value !== pw) {
        this.authForm.controls.password.setValue(pw, { emitEvent: false });
      }
      if (this.authForm.controls.confirmPassword.value !== cpw) {
        this.authForm.controls.confirmPassword.setValue(cpw, { emitEvent: false });
      }
    });

    // Escuchar parámetro ?mode=login|register|forgot|reset y posibles errores de callback en la URL
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const rawMode = params.get('mode');
      if (this.isValidAuthMode(rawMode)) {
        this.applyModeState(rawMode);
      } else if (!this.supabaseService.isPasswordRecoveryMode?.()) {
        this.applyModeState('login');
      }

      const rawPlan = params.get('plan');
      if (rawPlan === 'pro' || rawPlan === 'industrial') {
        const rawCycle = this.paymentService.normalizeCycle(params.get('cycle'));
        this.paymentService.savePendingCheckout({
          plan: rawPlan,
          cycle: rawCycle
        });
      }

      const callbackErrorKey = this.extractCallbackErrorKey(params);
      if (callbackErrorKey) {
        this.errorKey.set(callbackErrorKey);
      }
    });

    // Activar automáticamente modo reset ante evento PASSWORD_RECOVERY
    effect(() => {
      const isRecovery = this.supabaseService.isPasswordRecoveryMode?.() ?? false;
      if (isRecovery && this.mode() !== 'reset') {
        this.applyModeState('reset');
      }
    });

    this.destroyRef.onDestroy(() => {
      this.isDestroyed = true;
      this.gisRenderRequestId++;
    });

    // Sincronizar estado de fallo del SDK de Google Identity Services si ocurre de forma externa
    effect(() => {
      const sdkFailed = this.googleIdentityService.isSdkLoadFailed?.() ?? false;
      if (sdkFailed) {
        untracked(() => {
          if (!this.isGisLoading() && !this.isGisButtonRendered()) {
            this.isGisButtonRendered.set(false);
            this.isGisLoadBlocked.set(true);
          }
        });
      }
    });

    // Inicializar y renderizar el botón oficial de Google Identity Services (GIS)
    // únicamente después de que el DOM del contenedor exista y termine el ciclo de render actual.
    effect((onCleanup) => {
      const activeMode = this.mode();
      const containerRef = this.googleButtonContainer();
      const lang = this.currentLanguageOption().code;
      const isStatusScreenVisible =
        this.registrationConfirmationPending() ||
        this.resetEmailSent() ||
        this.passwordResetSuccess();

      if (
        !this.isBrowser ||
        isStatusScreenVisible ||
        (activeMode !== 'login' && activeMode !== 'register') ||
        !containerRef?.nativeElement
      ) {
        untracked(() => {
          this.gisRenderRequestId++;
          this.isGisButtonRendered.set(false);
          this.isGisLoading.set(false);
          this.isGisLoadBlocked.set(false);
        });
        return;
      }

      const containerEl = containerRef.nativeElement;
      const renderRef = afterNextRender(
        () => {
          if (this.isDestroyed || this.googleButtonContainer()?.nativeElement !== containerEl) {
            return;
          }
          void this.renderOfficialGoogleButton(containerEl, activeMode, lang);
        },
        { injector: this.injector }
      );

      onCleanup(() => {
        renderRef.destroy();
      });
    });
  }

  /**
   * Renderiza el botón oficial de Google mediante `google.accounts.id.renderButton(...)`
   * utilizando `GoogleIdentityService` (flujo `signInWithIdToken` con Nonce SHA-256).
   */
  async renderOfficialGoogleButton(
    containerElement: HTMLElement,
    activeMode: 'login' | 'register' = 'login',
    locale: string = this.currentLanguageOption().code
  ): Promise<boolean> {
    if (!this.isBrowser || !containerElement) {
      return false;
    }

    const requestId = ++this.gisRenderRequestId;
    this.isGisLoading.set(true);
    this.isGisLoadBlocked.set(false);

    try {
      const rendered = await this.googleIdentityService.initializeAndRenderButton({
        container: containerElement,
        context: activeMode === 'register' ? 'signup' : 'signin',
        text: 'continue_with',
        locale,
        onStart: () => {
          this.errorKey.set(null);
          this.isGoogleSubmitting.set(true);
        },
        onSuccess: async () => {
          this.isGoogleSubmitting.set(false);
          await this.handlePostAuthNavigation();
        },
        onError: (errKey: string) => {
          this.isGoogleSubmitting.set(false);
          this.errorKey.set(errKey || 'auth.errors.oauthUnavailable');
        }
      });

      if (this.isDestroyed || requestId !== this.gisRenderRequestId) {
        return false;
      }

      if (rendered) {
        this.isGisButtonRendered.set(true);
        this.isGisLoadBlocked.set(false);
        this.isGisLoading.set(false);
        if (!environment.production) {
          console.info('[AuthPage] Google Identity Services button mounted in #googleButtonContainer.', {
            mode: activeMode,
            locale
          });
        }
        return true;
      }

      this.isGisButtonRendered.set(false);
      this.isGisLoadBlocked.set(true);
      this.isGisLoading.set(false);
      if (!environment.production) {
        console.warn('[AuthPage] Google Identity Services button could not be rendered (script blocked or unavailable).', {
          mode: activeMode,
          locale
        });
      }
      return false;
    } catch (err: unknown) {
      if (this.isDestroyed || requestId !== this.gisRenderRequestId) {
        return false;
      }

      this.isGisButtonRendered.set(false);
      this.isGisLoadBlocked.set(true);
      this.isGisLoading.set(false);
      if (!environment.production) {
        console.warn('[AuthPage] Google Identity Services script loading failed or was blocked.', err);
      }
      return false;
    }
  }

  /**
   * Reintenta cargar y renderizar el botón oficial de Google Identity Services dentro del contenedor GIS.
   */
  retryGoogleButton(): void {
    if (this.isGisLoading() || this.isGoogleSubmitting()) {
      return;
    }

    const activeMode = this.mode();
    if (activeMode !== 'login' && activeMode !== 'register') {
      return;
    }

    const containerEl = this.googleButtonContainer()?.nativeElement;
    if (!containerEl) {
      return;
    }

    void this.renderOfficialGoogleButton(containerEl, activeMode, this.currentLanguageOption().code);
  }

  private async handlePostAuthNavigation(): Promise<void> {
    await this.router.navigateByUrl('/studio');
    const pending = this.paymentService.consumePendingCheckout();
    if (pending) {
      void this.paymentService.openCheckout(pending.plan, pending.cycle);
    }
  }

  private isValidAuthMode(value: string | null): value is AuthMode {
    return value === 'login' || value === 'register' || value === 'forgot' || value === 'reset';
  }

  private extractCallbackErrorKey(params: ParamMap): string | null {
    const queryError = params.get('error');
    const queryCode = params.get('error_code');
    const queryDesc = params.get('error_description');

    let hashError: string | null = null;
    let hashCode: string | null = null;
    let hashDesc: string | null = null;

    if (typeof window !== 'undefined' && window.location.hash.length > 1) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      hashError = hashParams.get('error');
      hashCode = hashParams.get('error_code');
      hashDesc = hashParams.get('error_description');
    }

    const errCode = queryCode || hashCode || queryError || hashError;
    const errDesc = queryDesc || hashDesc || '';

    if (!errCode && !errDesc) {
      return null;
    }

    if (typeof this.supabaseService.mapAuthErrorToKey === 'function') {
      return this.supabaseService.mapAuthErrorToKey({
        code: errCode ?? '',
        message: errDesc || (errCode ?? '')
      });
    }

    const combined = `${errCode ?? ''} ${errDesc}`.toLowerCase();
    if (
      combined.includes('otp_expired') ||
      combined.includes('flow_state') ||
      combined.includes('expired') ||
      combined.includes('access_denied')
    ) {
      return 'auth.errors.sessionExpired';
    }
    return 'auth.errors.generic';
  }

  private clearTransientErrors(): void {
    if (this.errorKey()) {
      this.errorKey.set(null);
    }
  }

  private applyModeState(nextMode: AuthMode): void {
    this.mode.set(nextMode);
    this.errorKey.set(null);
    this.registrationConfirmationPending.set(false);
    this.resetEmailSent.set(false);
    this.passwordResetSuccess.set(false);
    this.firstNameDigitBlocked.set(false);
    this.lastNameDigitBlocked.set(false);
  }

  setMode(nextMode: AuthMode): void {
    this.applyModeState(nextMode);
    this.password.set('');
    this.confirmPassword.set('');
    this.showPassword.set(false);
    this.showConfirmPassword.set(false);
    if (typeof window !== 'undefined' && window.location.hash.includes('error')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        mode: nextMode,
        error: null,
        error_code: null,
        error_description: null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  toggleShowPassword(): void {
    this.showPassword.update((v) => !v);
  }

  toggleShowConfirmPassword(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  toggleLanguageDropdown(event?: Event): void {
    event?.stopPropagation();
    this.isLangDropdownOpen.update((v) => !v);
  }

  closeLanguageDropdown(): void {
    if (this.isLangDropdownOpen()) {
      this.isLangDropdownOpen.set(false);
    }
  }

  selectLanguage(lang: AppLanguage): void {
    this.i18n.setLanguage(lang);
    this.isLangDropdownOpen.set(false);
  }

  /**
   * Bloquea en tiempo real el ingreso de dígitos numéricos (0-9) por teclado
   * en Nombre y Segundo Nombre / Apellido, activando aviso inmediato en pantalla.
   */
  onNameKeyDown(event: KeyboardEvent, field: 'firstName' | 'lastName'): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      if (field === 'firstName') {
        this.firstNameDigitBlocked.set(true);
      } else {
        this.lastNameDigitBlocked.set(true);
      }
      return;
    }

    if (
      event.key.length === 1 ||
      event.key === 'Backspace' ||
      event.key === 'Delete' ||
      event.key === 'Escape'
    ) {
      if (field === 'firstName') {
        this.firstNameDigitBlocked.set(false);
      } else {
        this.lastNameDigitBlocked.set(false);
      }
    }
  }

  /**
   * Intercepta inserciones de texto antes de aplicarse al campo (teclados virtuales
   * móviles Android/iOS donde keydown emite 'Unidentified', dictado o pegado con dígitos).
   */
  onNameBeforeInput(event: InputEvent, field: 'firstName' | 'lastName'): void {
    const inserted = event.data;
    if (typeof inserted !== 'string' || inserted.length === 0) {
      return;
    }

    if (/\d/.test(inserted)) {
      event.preventDefault();
      if (field === 'firstName') {
        this.firstNameDigitBlocked.set(true);
      } else {
        this.lastNameDigitBlocked.set(true);
      }
      return;
    }

    if (field === 'firstName') {
      this.firstNameDigitBlocked.set(false);
    } else {
      this.lastNameDigitBlocked.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.isCurrentFormValid() || this.isSubmitting()) {
      return;
    }

    this.errorKey.set(null);
    this.isSubmitting.set(true);

    try {
      const activeMode = this.mode();

      if (activeMode === 'login') {
        const res = await this.supabaseService.signInWithEmail(
          this.emailTrimmed(),
          this.password()
        );
        if (res.success) {
          await this.router.navigateByUrl('/studio');
          const pending = this.paymentService.consumePendingCheckout();
          if (pending) {
            void this.paymentService.openCheckout(pending.plan, pending.cycle);
          }
        } else {
          this.errorKey.set(res.errorKey ?? 'auth.errors.invalidCredentials');
        }
        return;
      }

      if (activeMode === 'register') {
        const res = await this.supabaseService.signUpWithEmail({
          email: this.emailTrimmed(),
          password: this.password(),
          firstName: this.firstNameTrimmed(),
          lastName: this.lastNameTrimmed()
        });

        if (res.success) {
          if (res.needsEmailConfirmation) {
            this.registrationConfirmationPending.set(true);
          } else {
            await this.router.navigateByUrl('/studio');
            const pending = this.paymentService.consumePendingCheckout();
            if (pending) {
              void this.paymentService.openCheckout(pending.plan, pending.cycle);
            }
          }
        } else {
          this.errorKey.set(res.errorKey ?? 'auth.errors.generic');
        }
        return;
      }

      if (activeMode === 'forgot') {
        const res = await this.supabaseService.sendPasswordResetEmail(this.emailTrimmed());
        if (res.success) {
          this.resetEmailSent.set(true);
        } else {
          this.errorKey.set(res.errorKey ?? 'auth.errors.generic');
        }
        return;
      }

      if (activeMode === 'reset') {
        const res = await this.supabaseService.updateUserPassword(this.password());
        if (res.success) {
          this.passwordResetSuccess.set(true);
          this.password.set('');
          this.confirmPassword.set('');
        } else {
          this.errorKey.set(res.errorKey ?? 'auth.errors.generic');
        }
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  goToStudio(): void {
    void this.router.navigateByUrl('/studio');
  }
}
