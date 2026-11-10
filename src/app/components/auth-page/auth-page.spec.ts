import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthPageComponent } from './auth-page';
import { SupabaseService, UserProfile } from '../../services/supabase.service';
import { TRANSLATIONS, AppLanguage } from '../../data/i18n-translations.data';

interface MockSupabaseAuthService {
  currentUser: WritableSignal<null>;
  userProfile: WritableSignal<UserProfile | null>;
  isAuthenticated: WritableSignal<boolean>;
  isAuthLoading: WritableSignal<boolean>;
  isPasswordRecoveryMode: WritableSignal<boolean>;
  signInWithEmail: ReturnType<typeof vi.fn>;
  signUpWithEmail: ReturnType<typeof vi.fn>;
  signInWithGoogle: ReturnType<typeof vi.fn>;
  sendPasswordResetEmail: ReturnType<typeof vi.fn>;
  updateUserPassword: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
}

describe('AuthPageComponent', () => {
  let fixture: ComponentFixture<AuthPageComponent>;
  let component: AuthPageComponent;
  let mockSupabase: MockSupabaseAuthService;
  let queryParamSubject: BehaviorSubject<ParamMap>;
  let router: Router;

  beforeEach(async () => {
    queryParamSubject = new BehaviorSubject<ParamMap>(convertToParamMap({}));

    mockSupabase = {
      currentUser: signal(null),
      userProfile: signal<UserProfile | null>(null),
      isAuthenticated: signal(false),
      isAuthLoading: signal(false),
      isPasswordRecoveryMode: signal(false),
      signInWithEmail: vi.fn().mockResolvedValue({ success: true }),
      signUpWithEmail: vi.fn().mockResolvedValue({ success: true, needsEmailConfirmation: false }),
      signInWithGoogle: vi.fn().mockResolvedValue({ success: true }),
      sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true }),
      updateUserPassword: vi.fn().mockResolvedValue({ success: true }),
      signOut: vi.fn().mockResolvedValue(undefined)
    };

    await TestBed.configureTestingModule({
      imports: [AuthPageComponent],
      providers: [
        provideRouter([]),
        { provide: SupabaseService, useValue: mockSupabase },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParamSubject.asObservable(),
            snapshot: { queryParamMap: convertToParamMap({}) }
          }
        }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(AuthPageComponent);
    component = fixture.componentInstance;
    component.selectLanguage('es');
    fixture.detectChanges();
  });

  it('debe crearse correctamente en modo login por defecto con cabecera Piezo3D Studio', () => {
    expect(component).toBeTruthy();
    expect(component.mode()).toBe('login');

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Piezo3D Studio');
    expect(el.querySelector('[data-testid="google-auth-btn"]')).toBeTruthy();
  });

  it('debe sincronizar el modo activo desde ?mode=login|register|forgot|reset y usar login ante valores desconocidos', () => {
    queryParamSubject.next(convertToParamMap({ mode: 'register' }));
    fixture.detectChanges();
    expect(component.mode()).toBe('register');

    queryParamSubject.next(convertToParamMap({ mode: 'forgot' }));
    fixture.detectChanges();
    expect(component.mode()).toBe('forgot');

    queryParamSubject.next(convertToParamMap({ mode: 'reset' }));
    fixture.detectChanges();
    expect(component.mode()).toBe('reset');

    queryParamSubject.next(convertToParamMap({ mode: 'unknown_mode' }));
    fixture.detectChanges();
    expect(component.mode()).toBe('login');
  });

  it('debe cambiar automáticamente al modo reset cuando SupabaseService detecta PASSWORD_RECOVERY', () => {
    expect(component.mode()).toBe('login');
    mockSupabase.isPasswordRecoveryMode.set(true);
    fixture.detectChanges();
    expect(component.mode()).toBe('reset');
  });

  it('debe respetar estrictamente la tipografía Inter (cero clases font-mono), cero SVG inline crudo y privacidad de infraestructura', () => {
    const modes: ('login' | 'register' | 'forgot' | 'reset')[] = ['login', 'register', 'forgot', 'reset'];

    for (const m of modes) {
      component.setMode(m);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelectorAll('.font-mono').length).toBe(0);

      // Ningún <svg> fuera de <hugeicons-icon>
      const allSvgs = Array.from(el.querySelectorAll('svg'));
      for (const svg of allSvgs) {
        expect(svg.closest('hugeicons-icon')).toBeTruthy();
      }

      const lowerText = (el.textContent ?? '').toLowerCase();
      expect(lowerText).not.toContain('supabase');
      expect(lowerText).not.toContain('postgres');
      expect(lowerText).not.toContain('uuid');
    }
  });

  it('debe tener todas las traducciones auth.* en los 6 idiomas sin mencionar proveedores de infraestructura', () => {
    const languages: AppLanguage[] = ['es', 'en', 'pt', 'fr', 'it', 'de'];
    const esAuthKeys = Object.keys(TRANSLATIONS.es).filter((k) => k.startsWith('auth.'));
    expect(esAuthKeys.length).toBeGreaterThanOrEqual(65);

    for (const lang of languages) {
      for (const key of esAuthKeys) {
        const val = TRANSLATIONS[lang][key];
        expect(val).toBeDefined();
        expect(val.trim().length).toBeGreaterThan(0);
        const lower = val.toLowerCase();
        expect(lower).not.toContain('supabase');
        expect(lower).not.toContain('postgres');
      }
    }
  });

  describe('Validaciones en Tiempo Real: Nombre y Segundo Nombre / Apellido (Modo Registro)', () => {
    beforeEach(() => {
      component.setMode('register');
      fixture.detectChanges();
    });

    it('debe rechazar Nombre con menos de 3 letras o solo espacios mostrando aviso inmediato', () => {
      const input = fixture.nativeElement.querySelector('[data-testid="input-first-name"]') as HTMLInputElement;

      input.value = 'Jo';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(component.isFirstNameValid()).toBe(false);
      const errEl = fixture.nativeElement.querySelector('[data-testid="first-name-error"]') as HTMLElement;
      expect(errEl).toBeTruthy();
      expect(errEl.textContent).toContain(TRANSLATIONS.es['auth.validation.firstNameMin']);

      // Solo espacios ("   ") o letras separadas insuficientes ("A B")
      input.value = '   ';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(component.isFirstNameValid()).toBe(false);
      expect(fixture.nativeElement.querySelector('[data-testid="first-name-error"]')).toBeTruthy();

      input.value = 'A B';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(component.isFirstNameValid()).toBe(false);
    });

    it('debe bloquear la entrada de dígitos numéricos (0-9) por teclado en Nombre y mostrar feedback inmediato', () => {
      const input = fixture.nativeElement.querySelector('[data-testid="input-first-name"]') as HTMLInputElement;
      const keyEvent = new KeyboardEvent('keydown', { key: '7', cancelable: true });

      input.dispatchEvent(keyEvent);
      fixture.detectChanges();

      expect(keyEvent.defaultPrevented).toBe(true);
      expect(component.firstNameDigitBlocked()).toBe(true);

      const errEl = fixture.nativeElement.querySelector('[data-testid="first-name-error"]') as HTMLElement;
      expect(errEl).toBeTruthy();
      expect(errEl.textContent).toContain(TRANSLATIONS.es['auth.validation.noNumbersAllowed']);
    });

    it('debe rechazar cadenas pegadas con números en Nombre y aceptar nombres válidos con acentos >= 3 letras', () => {
      component.authForm.controls.firstName.setValue('Carlos9');
      fixture.detectChanges();
      expect(component.firstNameHasNumbers()).toBe(true);
      expect(component.isFirstNameValid()).toBe(false);

      component.authForm.controls.firstName.setValue('José María');
      fixture.detectChanges();
      expect(component.firstNameHasNumbers()).toBe(false);
      expect(component.isFirstNameValid()).toBe(true);
    });

    it('debe permitir Segundo Nombre o Apellido vacío (opcional), aceptar letras válidas y bloquear números', () => {
      expect(component.lastName()).toBe('');
      expect(component.isLastNameValid()).toBe(true);

      const input = fixture.nativeElement.querySelector('[data-testid="input-last-name"]') as HTMLInputElement;
      const keyEvent = new KeyboardEvent('keydown', { key: '4', cancelable: true });
      input.dispatchEvent(keyEvent);
      fixture.detectChanges();

      expect(keyEvent.defaultPrevented).toBe(true);
      expect(component.lastNameDigitBlocked()).toBe(true);
      expect(fixture.nativeElement.querySelector('[data-testid="last-name-error"]')).toBeTruthy();

      component.authForm.controls.lastName.setValue('Pérez2');
      fixture.detectChanges();
      expect(component.isLastNameValid()).toBe(false);

      component.authForm.controls.lastName.setValue('De la Cruz');
      fixture.detectChanges();
      expect(component.isLastNameValid()).toBe(true);
    });
  });

  describe('Validación de Correo, Botones Ver/Ocultar y Checklist de Contraseña en Tiempo Real', () => {
    it('debe mostrar indicador visual en tiempo real de correo inválido o válido al escribir', () => {
      component.authForm.controls.email.setValue('correo-invalido@dominio');
      fixture.detectChanges();

      expect(component.isEmailValid()).toBe(false);
      expect(fixture.nativeElement.querySelector('[data-testid="email-invalid-indicator"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[data-testid="email-valid-indicator"]')).toBeNull();

      component.authForm.controls.email.setValue('arquitecto@piezo3d.com');
      fixture.detectChanges();

      expect(component.isEmailValid()).toBe(true);
      expect(fixture.nativeElement.querySelector('[data-testid="email-valid-indicator"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[data-testid="email-invalid-indicator"]')).toBeNull();
    });

    it('debe alternar mostrar/ocultar de forma independiente para Contraseña y Confirmar Contraseña', () => {
      component.setMode('register');
      fixture.detectChanges();

      const pwInput = fixture.nativeElement.querySelector('[data-testid="input-password"]') as HTMLInputElement;
      const confirmInput = fixture.nativeElement.querySelector('[data-testid="input-confirm-password"]') as HTMLInputElement;
      const togglePwBtn = fixture.nativeElement.querySelector('[data-testid="toggle-password-visibility"]') as HTMLButtonElement;
      const toggleConfirmBtn = fixture.nativeElement.querySelector('[data-testid="toggle-confirm-password-visibility"]') as HTMLButtonElement;

      expect(pwInput.type).toBe('password');
      expect(confirmInput.type).toBe('password');

      togglePwBtn.click();
      fixture.detectChanges();
      expect(pwInput.type).toBe('text');
      expect(confirmInput.type).toBe('password');

      toggleConfirmBtn.click();
      fixture.detectChanges();
      expect(pwInput.type).toBe('text');
      expect(confirmInput.type).toBe('text');

      togglePwBtn.click();
      fixture.detectChanges();
      expect(pwInput.type).toBe('password');
      expect(confirmInput.type).toBe('text');
    });

    it('debe evaluar los 4 requisitos del checklist en tiempo real y mantener deshabilitado el envío hasta cumplir el 100%', () => {
      component.setMode('register');
      component.authForm.controls.firstName.setValue('Alejandro');
      component.authForm.controls.email.setValue('alejandro@taller.com');
      fixture.detectChanges();

      const submitBtn = () => fixture.nativeElement.querySelector('[data-testid="auth-submit-btn"]') as HTMLButtonElement;
      expect(submitBtn().disabled).toBe(true);

      // 1. Solo longitud >= 8
      component.authForm.controls.password.setValue('Abcdefgh');
      fixture.detectChanges();
      expect(component.pwHasMinLength()).toBe(true);
      expect(component.pwHasNumber()).toBe(false);
      expect(component.pwHasSpecialChar()).toBe(false);
      expect(component.pwMatchesConfirm()).toBe(false);
      expect(submitBtn().disabled).toBe(true);

      // 2. Longitud + número
      component.authForm.controls.password.setValue('Abcdefg1');
      fixture.detectChanges();
      expect(component.pwHasMinLength()).toBe(true);
      expect(component.pwHasNumber()).toBe(true);
      expect(component.pwHasSpecialChar()).toBe(false);
      expect(submitBtn().disabled).toBe(true);

      // 3. Longitud + número + carácter especial (sin confirmar aún)
      component.authForm.controls.password.setValue('Abcdefg1!');
      component.authForm.controls.confirmPassword.setValue('Abcdefg1?');
      fixture.detectChanges();
      expect(component.pwHasSpecialChar()).toBe(true);
      expect(component.pwMatchesConfirm()).toBe(false);
      expect(submitBtn().disabled).toBe(true);

      // 4. Coincidencia exacta -> 100% válido -> botón habilitado
      component.authForm.controls.confirmPassword.setValue('Abcdefg1!');
      fixture.detectChanges();
      expect(component.pwMatchesConfirm()).toBe(true);
      expect(component.isPasswordChecklistComplete()).toBe(true);
      expect(component.isCurrentFormValid()).toBe(true);
      expect(submitBtn().disabled).toBe(false);

      const checkItems = [
        fixture.nativeElement.querySelector('[data-testid="check-min-length"]') as HTMLElement,
        fixture.nativeElement.querySelector('[data-testid="check-has-number"]') as HTMLElement,
        fixture.nativeElement.querySelector('[data-testid="check-has-special"]') as HTMLElement,
        fixture.nativeElement.querySelector('[data-testid="check-passwords-match"]') as HTMLElement
      ];
      for (const item of checkItems) {
        expect(item.className).toContain('text-emerald-700');
      }
    });
  });

  describe('Flujos Completos de Envío: Login, Registro, Google, Recuperación y Restablecimiento', () => {
    it('debe autenticar con correo en modo login y redirigir a /studio', async () => {
      const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      component.authForm.controls.email.setValue('taller@piezo3d.com');
      component.authForm.controls.password.setValue('MiClaveSegura9!');
      fixture.detectChanges();

      await component.onSubmit();

      expect(mockSupabase.signInWithEmail).toHaveBeenCalledWith('taller@piezo3d.com', 'MiClaveSegura9!');
      expect(navSpy).toHaveBeenCalledWith('/studio');
    });

    it('debe mostrar mensaje de error amigable traducido si falla el inicio de sesión y limpiarlo al escribir', async () => {
      mockSupabase.signInWithEmail.mockResolvedValueOnce({
        success: false,
        errorKey: 'auth.errors.invalidCredentials'
      });

      component.authForm.controls.email.setValue('taller@piezo3d.com');
      component.authForm.controls.password.setValue('ClaveIncorrecta1!');
      fixture.detectChanges();

      await component.onSubmit();
      fixture.detectChanges();

      const alertEl = fixture.nativeElement.querySelector('[data-testid="auth-error-banner"]') as HTMLElement;
      expect(alertEl).toBeTruthy();
      expect(alertEl.textContent).toContain(TRANSLATIONS.es['auth.errors.invalidCredentials']);

      // Al volver a escribir se limpia el error automáticamente
      component.authForm.controls.password.setValue('NuevaClave1!');
      fixture.detectChanges();
      expect(component.errorKey()).toBeNull();
    });

    it('debe registrar usuario y mostrar pantalla de confirmación por correo cuando needsEmailConfirmation es true', async () => {
      mockSupabase.signUpWithEmail.mockResolvedValueOnce({
        success: true,
        needsEmailConfirmation: true
      });

      component.setMode('register');
      component.authForm.controls.firstName.setValue('Valentina');
      component.authForm.controls.lastName.setValue('Ríos');
      component.authForm.controls.email.setValue('valentina@taller.com');
      component.authForm.controls.password.setValue('TallerPro2026!');
      component.authForm.controls.confirmPassword.setValue('TallerPro2026!');
      fixture.detectChanges();

      await component.onSubmit();
      fixture.detectChanges();

      expect(mockSupabase.signUpWithEmail).toHaveBeenCalledWith({
        email: 'valentina@taller.com',
        password: 'TallerPro2026!',
        firstName: 'Valentina',
        lastName: 'Ríos'
      });
      expect(component.registrationConfirmationPending()).toBe(true);
      const banner = fixture.nativeElement.querySelector('[data-testid="register-confirmation-banner"]') as HTMLElement;
      expect(banner).toBeTruthy();
      expect(banner.textContent).toContain('¡Cuenta creada con éxito! Revisa tu bandeja de entrada o correo no deseado para confirmar tu cuenta e iniciar sesión.');
    });

    it('debe mostrar mensaje amigable exacto de confirmación por correo al registrarse', async () => {
      mockSupabase.signUpWithEmail.mockResolvedValueOnce({
        success: true,
        needsEmailConfirmation: true,
        messageKey: 'auth.registerCheckEmail'
      });

      component.setMode('register');
      component.authForm.controls.firstName.setValue('Valentina');
      component.authForm.controls.lastName.setValue('Ríos');
      component.authForm.controls.email.setValue('valentina@taller.com');
      component.authForm.controls.password.setValue('TallerPro2026!');
      component.authForm.controls.confirmPassword.setValue('TallerPro2026!');
      fixture.detectChanges();

      await component.onSubmit();
      fixture.detectChanges();

      const banner = fixture.nativeElement.querySelector('[data-testid="register-confirmation-banner"]') as HTMLElement;
      expect(banner).toBeTruthy();
      expect(banner.textContent).toContain('¡Cuenta creada con éxito! Revisa tu bandeja de entrada o correo no deseado para confirmar tu cuenta e iniciar sesión.');
    });

    it('debe mapear errores específicos de registro (dominio inválido, rate limit, usuario registrado) mostrando diagnósticos claros y sin mención a Supabase', async () => {
      component.setMode('register');
      component.authForm.controls.firstName.setValue('Prueba');
      component.authForm.controls.lastName.setValue('Usuario');
      component.authForm.controls.email.setValue('test@test.com');
      component.authForm.controls.password.setValue('TallerPro2026!');
      component.authForm.controls.confirmPassword.setValue('TallerPro2026!');
      fixture.detectChanges();

      // 1. Dominio inválido (email_address_invalid)
      mockSupabase.signUpWithEmail.mockResolvedValueOnce({
        success: false,
        errorKey: 'auth.errors.invalidEmailDomain'
      });
      await component.onSubmit();
      fixture.detectChanges();

      let alertEl = fixture.nativeElement.querySelector('[data-testid="auth-error-banner"]') as HTMLElement;
      expect(alertEl).toBeTruthy();
      expect(alertEl.textContent).toContain('El dominio del correo ingresado no es válido. Por favor utiliza un correo electrónico real');
      expect(alertEl.textContent?.toLowerCase()).not.toContain('supabase');

      // 2. Límite temporal de envíos (over_email_send_rate_limit / 429)
      mockSupabase.signUpWithEmail.mockResolvedValueOnce({
        success: false,
        errorKey: 'auth.errors.rateLimitExceeded'
      });
      await component.onSubmit();
      fixture.detectChanges();

      alertEl = fixture.nativeElement.querySelector('[data-testid="auth-error-banner"]') as HTMLElement;
      expect(alertEl).toBeTruthy();
      expect(alertEl.textContent).toContain('Se ha alcanzado el límite temporal de envíos de correo de verificación');
      expect(alertEl.textContent?.toLowerCase()).not.toContain('supabase');

      // 3. Usuario ya registrado (user_already_exists)
      mockSupabase.signUpWithEmail.mockResolvedValueOnce({
        success: false,
        errorKey: 'auth.errors.userAlreadyRegistered'
      });
      await component.onSubmit();
      fixture.detectChanges();

      alertEl = fixture.nativeElement.querySelector('[data-testid="auth-error-banner"]') as HTMLElement;
      expect(alertEl).toBeTruthy();
      expect(alertEl.textContent).toContain('Este correo electrónico ya está registrado. Intenta iniciar sesión.');
      expect(alertEl.textContent?.toLowerCase()).not.toContain('supabase');
    });

    it('debe invocar signInWithGoogle al pulsar "Continuar con Google" y mostrar el icono oficial de Google', async () => {
      const googleBtn = fixture.nativeElement.querySelector('[data-testid="google-auth-btn"]') as HTMLButtonElement;
      expect(googleBtn).toBeTruthy();
      const googleImg = googleBtn.querySelector('img[src="assets/google.svg"]');
      expect(googleImg).toBeTruthy();

      googleBtn.click();
      await fixture.whenStable();

      expect(mockSupabase.signInWithGoogle).toHaveBeenCalledTimes(1);
    });

    it('debe renderizar el botón de Google con el svg oficial y la totalidad del formulario en modo registro para pantallas de portátiles', () => {
      component.setMode('register');
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const googleBtn = el.querySelector('[data-testid="google-auth-btn"]') as HTMLButtonElement;
      expect(googleBtn).toBeTruthy();
      const googleImg = googleBtn.querySelector('img[src="assets/google.svg"]') as HTMLImageElement;
      expect(googleImg).toBeTruthy();

      expect(el.querySelector('[data-testid="input-first-name"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="input-last-name"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="input-email"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="input-password"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="input-confirm-password"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="password-checklist"]')).toBeTruthy();
      expect(el.querySelector('[data-testid="auth-submit-btn"]')).toBeTruthy();

      // Verificación de adaptabilidad responsive para laptops (2 columnas y contenedor sm:max-w-xl)
      const firstNameInput = el.querySelector('[data-testid="input-first-name"]');
      const nameGrid = firstNameInput?.closest('.grid');
      expect(nameGrid?.className).toContain('sm:grid-cols-2');

      const passwordInput = el.querySelector('[data-testid="input-password"]');
      const passwordGrid = passwordInput?.closest('.grid');
      expect(passwordGrid?.className).toContain('sm:grid-cols-2');

      const checklistEl = el.querySelector('[data-testid="password-checklist"]');
      const checklistUl = checklistEl?.querySelector('ul');
      expect(checklistUl?.className).toContain('sm:grid-cols-2');

      const cardWrapper = el.querySelector('main > div');
      expect(cardWrapper?.className).toContain('sm:max-w-xl');
    });

    it('debe permitir ir a "¿Olvidaste tu contraseña?", enviar enlace de recuperación y mostrar confirmación', async () => {
      const forgotLink = fixture.nativeElement.querySelector('[data-testid="forgot-password-link"]') as HTMLButtonElement;
      forgotLink.click();
      fixture.detectChanges();

      expect(component.mode()).toBe('forgot');
      const submitBtn = fixture.nativeElement.querySelector('[data-testid="auth-submit-btn"]') as HTMLButtonElement;
      expect(submitBtn.disabled).toBe(true);

      component.authForm.controls.email.setValue('recuperar@piezo3d.com');
      fixture.detectChanges();
      expect(submitBtn.disabled).toBe(false);

      await component.onSubmit();
      fixture.detectChanges();

      expect(mockSupabase.sendPasswordResetEmail).toHaveBeenCalledWith('recuperar@piezo3d.com');
      expect(component.resetEmailSent()).toBe(true);
      expect(fixture.nativeElement.querySelector('[data-testid="forgot-confirmation-banner"]')).toBeTruthy();
    });

    it('debe actualizar la contraseña en modo reset validando el checklist y redirigir a /studio tras confirmar', async () => {
      const navSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      component.setMode('reset');
      fixture.detectChanges();

      const submitBtn = () => fixture.nativeElement.querySelector('[data-testid="auth-submit-btn"]') as HTMLButtonElement;
      expect(submitBtn().disabled).toBe(true);

      component.authForm.controls.password.setValue('NuevaClave2026#');
      component.authForm.controls.confirmPassword.setValue('NuevaClave2026#');
      fixture.detectChanges();
      expect(submitBtn().disabled).toBe(false);

      await component.onSubmit();
      fixture.detectChanges();

      expect(mockSupabase.updateUserPassword).toHaveBeenCalledWith('NuevaClave2026#');
      expect(component.passwordResetSuccess()).toBe(true);
      expect(fixture.nativeElement.querySelector('[data-testid="reset-confirmation-banner"]')).toBeTruthy();

      component.goToStudio();
      expect(navSpy).toHaveBeenCalledWith('/studio');
    });

    it('debe cambiar dinámicamente entre los 6 idiomas desde el selector superior', () => {
      component.selectLanguage('en');
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Continue with Google');

      component.selectLanguage('de');
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Weiter mit Google');

      component.selectLanguage('fr');
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Continuer avec Google');
    });

    it('debe detectar enlaces de recuperación expirados (otp_expired) en la URL y ofrecer botón directo para solicitar nuevo enlace', () => {
      queryParamSubject.next(
        convertToParamMap({
          mode: 'reset',
          error: 'access_denied',
          error_code: 'otp_expired',
          error_description: 'Email link is invalid or has expired'
        })
      );
      fixture.detectChanges();

      expect(component.mode()).toBe('reset');
      expect(component.errorKey()).toBe('auth.errors.sessionExpired');

      const alertEl = fixture.nativeElement.querySelector('[data-testid="auth-error-banner"]') as HTMLElement;
      expect(alertEl).toBeTruthy();
      expect(alertEl.textContent).toContain(TRANSLATIONS.es['auth.errors.sessionExpired']);

      const newLinkBtn = fixture.nativeElement.querySelector('[data-testid="request-new-reset-link-btn"]') as HTMLButtonElement;
      expect(newLinkBtn).toBeTruthy();
      newLinkBtn.click();
      fixture.detectChanges();

      expect(component.mode()).toBe('forgot');
      expect(component.errorKey()).toBeNull();
    });

    it('debe interceptar dígitos en beforeinput (teclados móviles IME / pegado), limpiar bloqueo con Backspace/Escape, rechazar apellido sin letras y aceptar símbolos Unicode en contraseña', () => {
      component.setMode('register');
      fixture.detectChanges();

      const firstNameInput = fixture.nativeElement.querySelector('[data-testid="input-first-name"]') as HTMLInputElement;
      const beforeInputDigit = new InputEvent('beforeinput', { data: '8', cancelable: true });
      firstNameInput.dispatchEvent(beforeInputDigit);
      fixture.detectChanges();

      expect(beforeInputDigit.defaultPrevented).toBe(true);
      expect(component.firstNameDigitBlocked()).toBe(true);

      // Backspace limpia el estado de bloqueo aunque el campo siga vacío
      firstNameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
      fixture.detectChanges();
      expect(component.firstNameDigitBlocked()).toBe(false);

      // Apellido con solo guiones sin letras debe ser inválido
      component.authForm.controls.lastName.setValue('---');
      fixture.detectChanges();
      expect(component.isLastNameValid()).toBe(false);
      expect(fixture.nativeElement.querySelector('[data-testid="last-name-error"]')).toBeTruthy();

      // Símbolos especiales hispanos/Unicode (¡, ¿, €) cuentan en el checklist de contraseña
      component.authForm.controls.password.setValue('Taller2026¡');
      fixture.detectChanges();
      expect(component.pwHasSpecialChar()).toBe(true);
    });
  });
});

describe('Integración de Estado de Sesión en LandingPageComponent y HeaderComponent', () => {
  it('LandingPageComponent debe ser 100% pública en la barra superior (sin nombre ni botón Cerrar Sesión) y cerrar sesión automáticamente al inicializarse si había sesión activa', async () => {
    const { LandingPageComponent } = await import('../landing-page/landing-page');
    const isAuthenticatedSig = signal(true);
    const userProfileSig = signal<UserProfile | null>({
      id: 'u-1',
      email: 'sofia@taller.com',
      first_name: 'Sofía',
      last_name: 'Méndez',
      role: 'user',
      plan: 'pro',
      created_at: '2026-11-09T00:00:00Z',
      updated_at: '2026-11-09T00:00:00Z'
    });
    const signOutMock = vi.fn().mockImplementation(async () => {
      isAuthenticatedSig.set(false);
      userProfileSig.set(null);
    });

    await TestBed.configureTestingModule({
      imports: [LandingPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: SupabaseService,
          useValue: {
            getPublicTestimonials: vi.fn().mockResolvedValue([]),
            isAuthenticated: isAuthenticatedSig,
            userProfile: userProfileSig,
            currentUser: signal(null),
            isPasswordRecoveryMode: signal(false),
            signOut: signOutMock
          }
        }
      ]
    }).compileComponents();

    const landingFixture = TestBed.createComponent(LandingPageComponent);
    landingFixture.detectChanges();
    await landingFixture.whenStable();
    landingFixture.detectChanges();
    const el = landingFixture.nativeElement as HTMLElement;

    // Al entrar a LandingPageComponent con sesión activa, cierra sesión automáticamente
    expect(signOutMock).toHaveBeenCalledTimes(1);

    // La barra superior de la Landing Page jamás muestra el nombre del usuario ni botón de Cerrar Sesión
    const userNameEl = el.querySelector('[data-testid="landing-user-name"]');
    const signOutBtn = el.querySelector('[data-testid="landing-signout-btn"]');
    expect(userNameEl).toBeNull();
    expect(signOutBtn).toBeNull();

    // Siempre muestra el enlace Iniciar Sesión (/auth?mode=login) y CTAs de planes
    const loginLink = el.querySelector('[data-testid="landing-login-link"]') as HTMLAnchorElement;
    expect(loginLink).toBeTruthy();
    expect(loginLink.getAttribute('href')).toContain('/auth?mode=login');

    const starterCta = el.querySelector('[data-testid="pricing-cta-starter"]') as HTMLAnchorElement;
    const proCta = el.querySelector('[data-testid="pricing-cta-pro"]') as HTMLButtonElement;
    const indCta = el.querySelector('[data-testid="pricing-cta-industrial"]') as HTMLButtonElement;
    expect(starterCta.getAttribute('href')).toContain('/auth?mode=register');
    expect(proCta).toBeTruthy();
    expect(indCta).toBeTruthy();
  });

  it('HeaderComponent (Estudio 3D) debe mostrar enlace Iniciar Sesión sin sesión y first_name + Cerrar Sesión con sesión activa', async () => {
    const { HeaderComponent } = await import('../header/header');
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    const supabase = TestBed.inject(SupabaseService);
    const signOutSpy = vi.spyOn(supabase, 'signOut').mockResolvedValue();

    const headerFixture = TestBed.createComponent(HeaderComponent);
    headerFixture.detectChanges();
    const el = headerFixture.nativeElement as HTMLElement;

    // Sin sesión: enlace hacia /auth?mode=login
    const loginLink = el.querySelector('[data-testid="studio-login-link"]') as HTMLAnchorElement;
    expect(loginLink).toBeTruthy();
    expect(loginLink.getAttribute('href')).toContain('/auth?mode=login');

    // Con sesión sin perfil ni correo: usa fallback traducido auth.defaultUserName ("Usuario") y nunca clave cruda
    supabase.currentUser.set({
      id: 'u-anon-meta',
      email: '',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2026-11-09T00:00:00Z'
    });
    supabase.userProfile.set(null);
    headerFixture.detectChanges();
    expect(el.querySelector('[data-testid="studio-user-name"]')?.textContent?.trim()).toBe('Usuario');

    // Con sesión activa y perfil cargado: muestra first_name + botón Cerrar Sesión
    supabase.currentUser.set({
      id: 'u-99',
      email: 'mateo@taller.com',
      app_metadata: {},
      user_metadata: { first_name: 'Mateo' },
      aud: 'authenticated',
      created_at: '2026-11-09T00:00:00Z'
    });
    supabase.userProfile.set({
      id: 'u-99',
      email: 'mateo@taller.com',
      first_name: 'Mateo',
      last_name: 'Restrepo',
      role: 'user',
      plan: 'free',
      created_at: '2026-11-09T00:00:00Z',
      updated_at: '2026-11-09T00:00:00Z'
    });
    headerFixture.detectChanges();

    const studioUserName = el.querySelector('[data-testid="studio-user-name"]') as HTMLElement;
    const studioSignOutBtn = el.querySelector('[data-testid="studio-signout-btn"]') as HTMLButtonElement;
    expect(studioUserName?.textContent?.trim()).toBe('Mateo');
    expect(studioSignOutBtn).toBeTruthy();

    studioSignOutBtn.click();
    await headerFixture.whenStable();
    expect(signOutSpy).toHaveBeenCalledTimes(1);
  });
});

