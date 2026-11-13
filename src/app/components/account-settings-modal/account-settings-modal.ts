import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  AccountSetting01Icon,
  Add01Icon,
  Alert02Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  CreditCardIcon,
  Delete02Icon,
  Download01Icon,
  Globe02Icon,
  InformationCircleIcon,
  Invoice01Icon,
  Layers01Icon,
  Moon02Icon,
  RefreshIcon,
  Rocket01Icon,
  Settings01Icon,
  Shield01Icon,
  Sun01Icon,
  Tick02Icon,
  UserIcon
} from '@hugeicons/core-free-icons';

import {
  AVATAR_COLOR_PRESETS,
  AvatarMode,
  PaymentCardBrand,
  SubscriptionInvoice,
  SupabaseService,
  UserPaymentMethod,
  normalizeAvatarColorHex,
  resolveAvatarBgClass
} from '../../services/supabase.service';
import { PaymentService, PaidPlan } from '../../services/payment.service';
import { ProjectStorageService } from '../../services/project-storage.service';
import { I18nService } from '../../services/i18n.service';
import { ThemeService, ThemeMode } from '../../services/theme.service';
import { AppLanguage } from '../../data/i18n-translations.data';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { DEFAULT_ROOM_CONFIG, ProjectSettings } from '../../models/melamine.models';

export type AccountModalTab = 'profile' | 'workshop' | 'preferences' | 'billing';

export interface AvatarColorOption {
  id: string;
  hex: string;
  bg: string;
  ring: string;
}

export interface InvoiceMock {
  id: string;
  invoiceNumber: string;
  date: string;
  description: string;
  amountUsd: number;
  status: 'paid';
  invoiceUrl?: string | null;
}

/**
 * Detecta la marca comercial de una tarjeta según su dígito inicial (VISA: 4, MASTERCARD: 5, AMEX: 3).
 */
export function detectPaymentCardBrand(rawValue: string): PaymentCardBrand | null {
  const digits = rawValue.replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  if (digits.startsWith('4')) {
    return 'VISA';
  }
  if (digits.startsWith('5')) {
    return 'MASTERCARD';
  }
  if (digits.startsWith('3')) {
    return 'AMEX';
  }
  return null;
}

/**
 * Formatea los dígitos ingresados de tarjeta en bloques legibles de 4 dígitos.
 */
export function formatCardNumberDisplay(rawValue: string): string {
  const digitsOnly = rawValue.replace(/\D/g, '');
  const maxLen = digitsOnly.startsWith('3') ? 15 : 16;
  const trimmed = digitsOnly.slice(0, maxLen);
  return trimmed.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * Formatea la fecha de vencimiento de tarjeta con máscara MM / AAAA.
 */
export function formatCardExpiryDisplay(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}

/**
 * Parsea y valida una fecha de expiración MM / AAAA verificando que no esté vencida.
 */
export function parseCardExpiry(rawValue: string): { month: number; year: number } | null {
  const trimmed = rawValue.trim();
  const slashMatch = /^(\d{1,2})\s*\/\s*(\d{4})$/.exec(trimmed);
  let month: number;
  let year: number;

  if (slashMatch) {
    month = Number(slashMatch[1]);
    year = Number(slashMatch[2]);
  } else {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length !== 6) {
      return null;
    }
    month = Number(digits.slice(0, 2));
    year = Number(digits.slice(2, 6));
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  if (!Number.isInteger(year) || year < 2024 || year > 2100) {
    return null;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return null;
  }

  return { month, year };
}

function trimmedMinLength2Validator(control: AbstractControl<string>): ValidationErrors | null {
  const trimmed = String(control.value ?? '').trim();
  return trimmed.length >= 2 ? null : { invalidHolder: true };
}

function cardNumberValidator(control: AbstractControl<string>): ValidationErrors | null {
  const digits = String(control.value ?? '').replace(/\D/g, '');
  const brand = detectPaymentCardBrand(digits);
  if (!brand) {
    return { invalidCardNumber: true };
  }
  const expectedLength = brand === 'AMEX' ? 15 : 16;
  return digits.length === expectedLength ? null : { invalidCardNumber: true };
}

function cardExpiryValidator(control: AbstractControl<string>): ValidationErrors | null {
  return parseCardExpiry(String(control.value ?? '')) ? null : { invalidExpiry: true };
}

function cardCvcValidator(control: AbstractControl<string>): ValidationErrors | null {
  const digits = String(control.value ?? '').trim();
  return /^\d{3,4}$/.test(digits) ? null : { invalidCvc: true };
}

@Component({
  selector: 'app-account-settings-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HugeiconsIconComponent,
    TranslatePipe
  ],
  templateUrl: './account-settings-modal.html',
  styleUrl: './account-settings-modal.css'
})
export class AccountSettingsModalComponent {
  // Inputs & Outputs
  readonly isOpen = input<boolean>(false);
  readonly initialTab = input<AccountModalTab>('profile');
  readonly closed = output<void>();
  readonly modalClose = output<void>();

  // Injected Services
  readonly supabase = inject(SupabaseService);
  readonly paymentService = inject(PaymentService);
  readonly projectService = inject(ProjectStorageService);
  readonly i18n = inject(I18nService);
  readonly themeService = inject(ThemeService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router, { optional: true });

  // Active Tab
  readonly activeTab = signal<AccountModalTab>('profile');

  // Icons catalog
  readonly icons = {
    user: UserIcon,
    accountSetting: AccountSetting01Icon,
    settings: Settings01Icon,
    shield: Shield01Icon,
    layers: Layers01Icon,
    globe: Globe02Icon,
    creditCard: CreditCardIcon,
    delete: Delete02Icon,
    invoice: Invoice01Icon,
    checkList: CheckListIcon,
    checkCircle: CheckmarkCircle02Icon,
    check: Tick02Icon,
    close: Cancel01Icon,
    alert: Alert02Icon,
    info: InformationCircleIcon,
    download: Download01Icon,
    add: Add01Icon,
    arrowRight: ArrowRight01Icon,
    rocket: Rocket01Icon,
    refresh: RefreshIcon,
    sun: Sun01Icon,
    moon: Moon02Icon
  };

  // Toast feedback
  readonly toastMessage = signal<string | null>(null);
  readonly toastType = signal<'success' | 'error' | 'info'>('success');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly currentUser = this.supabase.currentUser;
  readonly userProfile = this.supabase.userProfile;

  readonly isSuperAdmin = computed(() => {
    const role = typeof this.userProfile === 'function' ? this.userProfile()?.role : undefined;
    const email = typeof this.currentUser === 'function' ? this.currentUser()?.email?.toLowerCase() : undefined;
    return role === 'super_admin' || email === 'eydersuarez900@gmail.com';
  });

  readonly planPrices = computed(() => {
    const settingsFn = (
      this.supabase as {
        platformSettings?: () => {
          pro_monthly_usd?: number;
          pro_annual_monthly_usd?: number;
          pro_annual_total_usd?: number;
          industrial_monthly_usd?: number;
          industrial_annual_monthly_usd?: number;
          industrial_annual_total_usd?: number;
        } | null;
      }
    ).platformSettings;
    const s = typeof settingsFn === 'function' ? settingsFn() : null;
    return {
      pro_monthly_usd: Number(s?.pro_monthly_usd ?? 15),
      pro_annual_monthly_usd: Number(s?.pro_annual_monthly_usd ?? 12),
      pro_annual_total_usd: Number(s?.pro_annual_total_usd ?? 144),
      industrial_monthly_usd: Number(s?.industrial_monthly_usd ?? 29),
      industrial_annual_monthly_usd: Number(s?.industrial_annual_monthly_usd ?? 23),
      industrial_annual_total_usd: Number(s?.industrial_annual_total_usd ?? 276)
    };
  });

  goToAdminPanel(): void {
    this.closeModal();
    if (this.router) {
      void this.router.navigateByUrl('/admin');
    }
  }

  // ---------------------------------------------------------------------------
  // TAB 1: MI PERFIL Y CUENTA (F8)
  // ---------------------------------------------------------------------------
  readonly avatarColors: AvatarColorOption[] = AVATAR_COLOR_PRESETS.map((preset) => ({
    id: preset.id,
    hex: preset.hex,
    bg: preset.bgClass,
    ring: preset.ringClass
  }));

  readonly googlePhotoUrl = computed(() => {
    const user = typeof this.currentUser === 'function' ? this.currentUser() : null;
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    if (typeof meta['avatar_url'] === 'string' && meta['avatar_url'].trim()) {
      return meta['avatar_url'].trim();
    }
    if (typeof meta['picture'] === 'string' && meta['picture'].trim()) {
      return meta['picture'].trim();
    }
    return null;
  });

  readonly selectedAvatarColor = signal<string>(
    this.resolveSelectedColorState(typeof this.userProfile === 'function' ? this.userProfile()?.avatar_color : null)
  );
  readonly avatarType = signal<AvatarMode>(
    this.resolveAvatarModeState(typeof this.userProfile === 'function' ? this.userProfile()?.avatar_mode : null)
  );
  readonly isSavingProfile = signal<boolean>(false);

  readonly avatarStyleColor = computed<string | null>(() => {
    if (this.avatarType() !== 'color') {
      return null;
    }
    const current = this.selectedAvatarColor();
    const normalized = normalizeAvatarColorHex(current);
    const matchesPreset = AVATAR_COLOR_PRESETS.some(
      (preset) => preset.hex.toUpperCase() === normalized.toUpperCase()
    );
    return matchesPreset ? null : normalized;
  });

  readonly profileForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['']
  });

  readonly userEmail = computed(() => {
    return this.currentUser()?.email || this.userProfile()?.email || 'usuario@tallerpro.com';
  });

  readonly userPlan = computed(() => {
    return this.userProfile()?.plan || 'free';
  });

  readonly currentBillingCycle = computed<'monthly' | 'annual'>(() => {
    return this.userProfile()?.billing_cycle === 'annual' ? 'annual' : 'monthly';
  });

  readonly userPlanTitleKey = computed(() => {
    const plan = this.userPlan();
    if (plan === 'industrial') return 'account.billing.planIndTitle';
    if (plan === 'pro') return 'account.billing.planProTitle';
    return 'account.billing.planStarterTitle';
  });

  readonly userInitials = computed(() => {
    const profile = this.userProfile();
    const firstName = (profile?.first_name || '').trim();
    const lastName = (profile?.last_name || '').trim();
    if (firstName && lastName) {
      return (firstName[0] + lastName[0]).toUpperCase();
    }
    if (firstName) {
      return firstName.slice(0, 2).toUpperCase();
    }
    const email = this.userEmail();
    return (email.slice(0, 2) || 'US').toUpperCase();
  });

  // ---------------------------------------------------------------------------
  // TAB 2: PARÁMETROS DEL TALLER Y PROYECTO (F9)
  // ---------------------------------------------------------------------------
  readonly workshopForm = this.fb.group({
    sawKerf: [4, [Validators.required, Validators.min(0)]],
    trimMargin: [10, [Validators.required, Validators.min(0)]],
    defaultBoardThickness: [15, [Validators.required, Validators.min(10), Validators.max(35)]],
    applyThicknessToAllParts: [false],
    thinEdgeThickness: [0.45, [Validators.required, Validators.min(0)]],
    thickEdgeThickness: [2.0, [Validators.required, Validators.min(0)]],
    thinEdgeCostPerMeter: [1800, [Validators.required, Validators.min(0)]],
    thickEdgeCostPerMeter: [4200, [Validators.required, Validators.min(0)]],
    currency: ['COP', Validators.required],
    optimizationPreference: ['best_fit', Validators.required],
    floorWidth: [5000, [Validators.required, Validators.min(2000), Validators.max(25000)]],
    floorDepth: [5000, [Validators.required, Validators.min(2000), Validators.max(25000)]],
    profitMarginPercent: [25, [Validators.required, Validators.min(0), Validators.max(100)]],
    defaultSheetLength: [2440, [Validators.required, Validators.min(1000), Validators.max(4000)]],
    defaultSheetWidth: [1830, [Validators.required, Validators.min(500), Validators.max(3000)]]
  });

  // ---------------------------------------------------------------------------
  // TAB 3: PREFERENCIAS DE INTERFAZ (F10)
  // ---------------------------------------------------------------------------
  readonly showFloorGrid = signal<boolean>(true);
  readonly showClearances = signal<boolean>(true);

  // ---------------------------------------------------------------------------
  // TAB 4: SUSCRIPCIÓN, MÉTODOS DE PAGO Y FACTURAS (F11)
  // ---------------------------------------------------------------------------
  readonly billingCycleSelect = signal<'monthly' | 'annual'>('monthly');
  readonly isLoadingInvoices = signal<boolean>(false);
  readonly hasLoadedCloudInvoices = signal<boolean>(false);
  readonly cloudInvoices = signal<SubscriptionInvoice[]>([]);
  readonly showManageBillingNotice = signal<boolean>(false);

  readonly isManagingSubscription = signal<boolean>(false);
  readonly isConfirmingCancel = signal<boolean>(false);
  readonly isCancellingSubscription = signal<boolean>(false);
  readonly isReactivatingSubscription = signal<boolean>(false);

  readonly cancelSubscriptionForm = this.fb.group({
    reason: [''],
    immediate: [false]
  });

  readonly isLoadingPaymentMethods = signal<boolean>(false);
  readonly isAddingPaymentMethod = signal<boolean>(false);
  readonly isSavingPaymentMethod = signal<boolean>(false);
  readonly processingPaymentMethodId = signal<string | null>(null);
  readonly paymentMethods = signal<UserPaymentMethod[]>([]);

  readonly paymentMethodForm = this.fb.group({
    holderName: ['', [Validators.required, trimmedMinLength2Validator]],
    cardNumber: ['', [Validators.required, cardNumberValidator]],
    expiry: ['', [Validators.required, cardExpiryValidator]],
    cvc: ['', [Validators.required, cardCvcValidator]],
    isDefault: [false]
  });

  private readonly cardNumberValue = signal<string>('');
  readonly detectedCardBrand = computed<PaymentCardBrand | null>(() =>
    detectPaymentCardBrand(this.cardNumberValue())
  );

  readonly primaryPaymentMethod = computed<UserPaymentMethod | null>(() => {
    const methods = this.paymentMethods();
    if (methods.length === 0) {
      return null;
    }
    return methods.find((pm) => pm.is_default) ?? null;
  });

  readonly subscriptionStatusKey = computed<string>(() => {
    const status = this.userProfile()?.subscription_status;
    if (status === 'on_trial') return 'account.billing.statusTrial';
    if (status === 'cancelled') return 'account.billing.statusCancelledUntilEnd';
    if (status === 'past_due') return 'account.billing.statusPastDue';
    if (status === 'expired') return 'account.billing.statusExpired';
    if (status === 'active' || this.userPlan() !== 'free') return 'account.billing.activeBadge';
    return 'account.billing.activeBadge';
  });

  readonly subscriptionStatusPillClass = computed<string>(() => {
    const status = this.userProfile()?.subscription_status;
    if (status === 'cancelled' || status === 'past_due') {
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    }
    if (status === 'expired') {
      return 'bg-red-50 text-red-700 border border-red-200';
    }
    return 'bg-zinc-900 text-white';
  });

  readonly subscriptionBillingCycleKey = computed<string>(() => {
    if (this.userPlan() === 'free') {
      return 'account.billing.cycleStarter';
    }
    const cycle = this.userProfile()?.billing_cycle;
    return cycle === 'annual' ? 'account.billing.cycleAnnual' : 'account.billing.cycleMonthly';
  });

  readonly formattedRenewalDate = computed<string | null>(() => {
    const rawDate = this.userProfile()?.current_period_end;
    if (!rawDate) return null;
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  });

  readonly customerPortalUrl = computed<string | null>(() => {
    const url = this.userProfile()?.customer_portal_url;
    return typeof url === 'string' && url.trim().length > 0 ? url.trim() : null;
  });

  readonly invoices = signal<InvoiceMock[]>([
    {
      id: 'inv_1',
      invoiceNumber: 'INV-2026-011',
      date: '01/11/2026',
      description: 'Plan Taller Pro - Mensual',
      amountUsd: 15.00,
      status: 'paid'
    },
    {
      id: 'inv_2',
      invoiceNumber: 'INV-2026-010',
      date: '01/10/2026',
      description: 'Plan Taller Pro - Mensual',
      amountUsd: 15.00,
      status: 'paid'
    },
    {
      id: 'inv_3',
      invoiceNumber: 'INV-2026-009',
      date: '01/09/2026',
      description: 'Plan Taller Pro - Mensual',
      amountUsd: 15.00,
      status: 'paid'
    }
  ]);

  readonly displayedInvoices = computed<InvoiceMock[]>(() => {
    if (this.hasLoadedCloudInvoices()) {
      return this.cloudInvoices().map((inv, idx) => {
        const dt = new Date(inv.created_at);
        const formattedDate = Number.isNaN(dt.getTime())
          ? inv.created_at
          : dt.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const planTitle = inv.plan === 'industrial' ? 'Plan Industrial & CNC' : 'Plan Taller Pro';
        const cycleLabel = inv.billing_cycle === 'annual' ? 'Anual' : 'Mensual';
        return {
          id: inv.id,
          invoiceNumber: `INV-${String(idx + 1).padStart(3, '0')}`,
          date: formattedDate,
          description: `${planTitle} - ${cycleLabel}`,
          amountUsd: Number(inv.amount_usd ?? 0),
          status: 'paid',
          invoiceUrl: inv.invoice_url ?? null
        };
      });
    }
    return this.invoices();
  });

  private previousIsOpen = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.toastTimer) {
        clearTimeout(this.toastTimer);
      }
    });

    this.paymentMethodForm.controls.cardNumber.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((val) => {
        this.cardNumberValue.set(val);
      });

    // Sincronizar tab inicial y datos SOLO cuando el modal transita de false a true
    effect(() => {
      const open = this.isOpen();
      if (open && !this.previousIsOpen) {
        untracked(() => {
          this.activeTab.set(this.initialTab());
          this.showManageBillingNotice.set(false);
          this.isManagingSubscription.set(false);
          this.isConfirmingCancel.set(false);
          this.isAddingPaymentMethod.set(false);
          this.cancelSubscriptionForm.reset({ reason: '', immediate: false });
          this.resetPaymentMethodForm();
          this.loadProfileData();
          this.loadWorkshopData();
          this.loadPreferencesData();
          void this.loadBillingData();
        });
      } else if (!open && this.previousIsOpen) {
        untracked(() => {
          this.isAddingPaymentMethod.set(false);
          this.isConfirmingCancel.set(false);
          this.resetPaymentMethodForm();
        });
      }
      this.previousIsOpen = open;
    });

    // Recargar facturas y pagos automáticamente si se completa un Checkout.Success mientras el modal está abierto
    effect(() => {
      const successAt = this.paymentService.lastCheckoutSuccessAt?.() ?? null;
      if (successAt && this.isOpen()) {
        untracked(() => {
          void this.loadBillingData();
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // NAVEGACIÓN ENTRE PESTAÑAS
  // ---------------------------------------------------------------------------
  selectTab(tab: AccountModalTab): void {
    this.activeTab.set(tab);
    if (tab === 'billing') {
      void this.loadBillingData();
    }
  }

  closeModal(): void {
    this.isAddingPaymentMethod.set(false);
    this.isConfirmingCancel.set(false);
    this.resetPaymentMethodForm();
    this.closed.emit();
    this.modalClose.emit();
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastType.set(type);
    this.toastMessage.set(message);
    this.toastTimer = setTimeout(() => {
      this.toastMessage.set(null);
    }, 3500);
  }

  // ---------------------------------------------------------------------------
  // LÓGICA TAB 1: PERFIL Y CUENTA
  // ---------------------------------------------------------------------------
  private loadProfileData(): void {
    const profile = typeof this.userProfile === 'function' ? this.userProfile() : null;
    if (profile) {
      this.profileForm.patchValue({
        firstName: profile.first_name || '',
        lastName: profile.last_name || ''
      });
      this.selectedAvatarColor.set(this.resolveSelectedColorState(profile.avatar_color));
      this.avatarType.set(this.resolveAvatarModeState(profile.avatar_mode));
      return;
    }

    const user = typeof this.currentUser === 'function' ? this.currentUser() : null;
    if (user && typeof this.supabase.buildFallbackProfile === 'function') {
      const fallback = this.supabase.buildFallbackProfile(user);
      this.profileForm.patchValue({
        firstName: fallback.first_name,
        lastName: fallback.last_name
      });
      this.selectedAvatarColor.set(this.resolveSelectedColorState(fallback.avatar_color));
      this.avatarType.set(this.resolveAvatarModeState(fallback.avatar_mode));
      return;
    }

    this.selectedAvatarColor.set('graphite');
    this.avatarType.set(this.googlePhotoUrl() ? 'google' : 'color');
  }

  private resolveSelectedColorState(colorOrId?: string | null): string {
    if (!colorOrId || !colorOrId.trim()) {
      return 'graphite';
    }
    const trimmed = colorOrId.trim();
    const normalizedHex = normalizeAvatarColorHex(trimmed);
    const preset = AVATAR_COLOR_PRESETS.find(
      (p) => p.id.toLowerCase() === trimmed.toLowerCase() || p.hex.toUpperCase() === normalizedHex.toUpperCase()
    );
    if (preset) {
      return preset.id;
    }
    if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
      return normalizedHex;
    }
    return 'graphite';
  }

  private resolveAvatarModeState(mode?: AvatarMode | null): AvatarMode {
    if (mode === 'google' || mode === 'color') {
      return mode;
    }
    return this.googlePhotoUrl() ? 'google' : 'color';
  }

  selectAvatarColor(colorId: string): void {
    this.selectedAvatarColor.set(colorId);
    this.avatarType.set('color');
  }

  setAvatarType(type: AvatarMode): void {
    this.avatarType.set(type);
  }

  isAvatarColorSelected(col: AvatarColorOption): boolean {
    if (this.avatarType() !== 'color') {
      return false;
    }
    const current = this.selectedAvatarColor();
    return current.toLowerCase() === col.id.toLowerCase() ||
      normalizeAvatarColorHex(current).toUpperCase() === col.hex.toUpperCase();
  }

  getAvatarBgClass(): string {
    return resolveAvatarBgClass(this.selectedAvatarColor());
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    if (typeof this.supabase.updateUserProfile !== 'function') {
      return;
    }

    this.isSavingProfile.set(true);
    const { firstName, lastName } = this.profileForm.getRawValue();

    try {
      const result = await this.supabase.updateUserProfile({
        first_name: firstName,
        last_name: lastName,
        avatar_color: normalizeAvatarColorHex(this.selectedAvatarColor()),
        avatar_mode: this.avatarType()
      });

      if (result.success) {
        this.showToast(this.i18n.t('account.profile.savedSuccess'), 'success');
      } else {
        const errorMsg = result.errorKey ? this.i18n.t(result.errorKey) : this.i18n.t('account.profileUpdateError');
        this.showToast(errorMsg, 'error');
      }
    } catch {
      this.showToast(this.i18n.t('account.profileUpdateError'), 'error');
    } finally {
      this.isSavingProfile.set(false);
    }
  }

  // ---------------------------------------------------------------------------
  // LÓGICA TAB 2: PARÁMETROS DEL TALLER
  // ---------------------------------------------------------------------------
  private loadWorkshopData(): void {
    const project = this.projectService.currentProject();
    const s = project.settings;
    const room = project.roomConfig || DEFAULT_ROOM_CONFIG;

    // Buscar tablero estándar de melamina
    const primaryBoard = project.materials.find(m => m.category === 'board' || !m.category);

    this.workshopForm.patchValue({
      sawKerf: s.sawKerf,
      trimMargin: s.trimMargin,
      defaultBoardThickness: s.defaultBoardThickness || 15,
      applyThicknessToAllParts: false,
      thinEdgeThickness: s.thinEdgeThickness,
      thickEdgeThickness: s.thickEdgeThickness,
      thinEdgeCostPerMeter: s.thinEdgeCostPerMeter,
      thickEdgeCostPerMeter: s.thickEdgeCostPerMeter,
      currency: s.currency,
      optimizationPreference: s.optimizationPreference,
      floorWidth: room.floorWidth || 5000,
      floorDepth: room.floorDepth || 5000,
      profitMarginPercent: project.profitMarginPercent ?? 25,
      defaultSheetLength: primaryBoard?.sheetLength ?? 2440,
      defaultSheetWidth: primaryBoard?.sheetWidth ?? 1830
    });
  }

  setWorkspacePreset(width: number, depth: number): void {
    this.workshopForm.patchValue({
      floorWidth: width,
      floorDepth: depth
    });
    this.activeTab.set('workshop');
    this.showToast(this.i18n.t('settings.workspaceToast', {
      width: (width / 1000).toFixed(1),
      depth: (depth / 1000).toFixed(1)
    }));
  }

  saveWorkshopSettings(): void {
    if (this.workshopForm.invalid) {
      this.workshopForm.markAllAsTouched();
      return;
    }

    this.activeTab.set('workshop');
    const raw = this.workshopForm.getRawValue();
    const applyToAll = !!raw.applyThicknessToAllParts;

    const val: ProjectSettings = {
      sawKerf: Number(raw.sawKerf),
      trimMargin: Number(raw.trimMargin),
      defaultBoardThickness: Number(raw.defaultBoardThickness) || 15,
      thinEdgeThickness: Number(raw.thinEdgeThickness),
      thickEdgeThickness: Number(raw.thickEdgeThickness),
      thinEdgeCostPerMeter: Number(raw.thinEdgeCostPerMeter),
      thickEdgeCostPerMeter: Number(raw.thickEdgeCostPerMeter),
      currency: raw.currency,
      optimizationPreference: raw.optimizationPreference as 'guillotine_length' | 'guillotine_width' | 'best_fit'
    };

    this.projectService.updateSettings(val, applyToAll);

    if (raw.floorWidth && raw.floorDepth) {
      this.projectService.updateWorkspaceDimensions(Number(raw.floorWidth), Number(raw.floorDepth));
    }

    // Actualizar margen de utilidad y dimensiones de placa
    const profitMargin = Number(raw.profitMarginPercent);
    const sheetLength = Number(raw.defaultSheetLength);
    const sheetWidth = Number(raw.defaultSheetWidth);

    this.projectService.updateProject(p => {
      let updatedMaterials = p.materials;
      if (sheetLength && sheetWidth) {
        updatedMaterials = p.materials.map(m => {
          if (m.category === 'board' || !m.category) {
            return { ...m, sheetLength, sheetWidth };
          }
          return m;
        });
      }
      return {
        ...p,
        profitMarginPercent: profitMargin,
        materials: updatedMaterials
      };
    });

    this.showToast(this.i18n.t('account.workshop.saveSuccess'));
  }

  // ---------------------------------------------------------------------------
  // LÓGICA TAB 3: PREFERENCIAS DE INTERFAZ
  // ---------------------------------------------------------------------------
  private loadPreferencesData(): void {
    const project = this.projectService.currentProject();
    const room = project.roomConfig || DEFAULT_ROOM_CONFIG;
    this.showFloorGrid.set(room.showFloorGrid ?? true);
    this.showClearances.set(room.showClearances ?? true);
  }

  selectLanguage(langCode: AppLanguage): void {
    this.i18n.setLanguage(langCode);
    this.activeTab.set('preferences');
    this.showToast(this.i18n.t('account.preferences.saveSuccess'));
  }

  setCurrency(currencyCode: string): void {
    this.workshopForm.patchValue({ currency: currencyCode });
    this.projectService.updateProject(p => ({
      ...p,
      settings: {
        ...p.settings,
        currency: currencyCode
      }
    }));
    this.activeTab.set('preferences');
    this.showToast(this.i18n.t('account.preferences.saveSuccess'));
  }

  toggleFloorGrid(checked: boolean): void {
    this.showFloorGrid.set(checked);
    this.projectService.updateRoomConfig({ showFloorGrid: checked });
    this.activeTab.set('preferences');
    this.showToast(this.i18n.t('account.preferences.saveSuccess'));
  }

  onFloorGridToggle(event: Event): void {
    const inputEl = event.target as HTMLInputElement | null;
    if (inputEl) {
      this.toggleFloorGrid(inputEl.checked);
    }
  }

  toggleClearances(checked: boolean): void {
    this.showClearances.set(checked);
    this.projectService.updateRoomConfig({ showClearances: checked });
    this.activeTab.set('preferences');
    this.showToast(this.i18n.t('account.preferences.saveSuccess'));
  }

  onClearancesToggle(event: Event): void {
    const inputEl = event.target as HTMLInputElement | null;
    if (inputEl) {
      this.toggleClearances(inputEl.checked);
    }
  }

  set3DTheme(mode: ThemeMode): void {
    this.themeService.setTheme(mode);
    this.activeTab.set('preferences');
    this.showToast(this.i18n.t('account.preferences.saveSuccess'));
  }

  // ---------------------------------------------------------------------------
  // LÓGICA TAB 4: SUSCRIPCIÓN, MÉTODOS DE PAGO Y FACTURAS
  // ---------------------------------------------------------------------------
  async loadBillingData(): Promise<void> {
    const profileCycle = this.userProfile()?.billing_cycle;
    if (profileCycle === 'annual' || profileCycle === 'monthly') {
      this.billingCycleSelect.set(profileCycle);
    }

    const tasks: Promise<void>[] = [];

    if (typeof this.supabase.getSubscriptionInvoices === 'function') {
      this.isLoadingInvoices.set(true);
      tasks.push(
        this.supabase
          .getSubscriptionInvoices(20)
          .then((records) => {
            this.cloudInvoices.set(records);
            this.hasLoadedCloudInvoices.set(true);
          })
          .catch(() => {
            // Conservar estado previo si falla la red
          })
          .finally(() => {
            this.isLoadingInvoices.set(false);
          })
      );
    }

    if (typeof this.supabase.getPaymentMethods === 'function') {
      this.isLoadingPaymentMethods.set(true);
      tasks.push(
        this.supabase
          .getPaymentMethods()
          .then((methods) => {
            this.paymentMethods.set(Array.isArray(methods) ? methods : []);
          })
          .catch(() => {
            // Conservar estado previo si falla la red
          })
          .finally(() => {
            this.isLoadingPaymentMethods.set(false);
          })
      );
    }

    await Promise.all(tasks);
  }

  setBillingCycleSelect(cycle: 'monthly' | 'annual'): void {
    this.billingCycleSelect.set(cycle);
  }

  selectPlanCheckout(plan: PaidPlan, cycleOverride?: 'monthly' | 'annual'): void {
    const cycle = cycleOverride ?? this.billingCycleSelect();
    this.billingCycleSelect.set(cycle);
    void this.paymentService.openCheckout(plan, cycle);
  }

  openCustomerPortal(): void {
    const plan = this.userPlan();
    if (plan === 'pro' || plan === 'industrial') {
      this.showManageBillingNotice.set(false);
      this.isManagingSubscription.update((open) => {
        const next = !open;
        if (!next) {
          this.isConfirmingCancel.set(false);
        }
        return next;
      });
      return;
    }

    this.showManageBillingNotice.set(true);
    this.showToast(this.i18n.t('account.billing.manageInAppNotice'), 'info');
    if (typeof document !== 'undefined') {
      const targetEl = document.getElementById('account-payment-methods-section')
        ?? document.getElementById('account-billing-plans-section');
      if (targetEl && typeof targetEl.scrollIntoView === 'function') {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  openCancelConfirm(): void {
    this.cancelSubscriptionForm.reset({ reason: '', immediate: false });
    this.isConfirmingCancel.set(true);
  }

  closeCancelConfirm(): void {
    this.isConfirmingCancel.set(false);
    this.cancelSubscriptionForm.reset({ reason: '', immediate: false });
  }

  async confirmCancelSubscription(): Promise<void> {
    if (typeof this.supabase.cancelSubscription !== 'function') {
      return;
    }

    this.isCancellingSubscription.set(true);
    const { reason, immediate } = this.cancelSubscriptionForm.getRawValue();
    const trimmedReason = reason.trim();

    try {
      const result = await this.supabase.cancelSubscription({
        immediate,
        reason: trimmedReason ? trimmedReason : undefined
      });

      if (result.success) {
        this.isConfirmingCancel.set(false);
        this.cancelSubscriptionForm.reset({ reason: '', immediate: false });
        if (immediate) {
          this.isManagingSubscription.set(false);
          this.showToast(this.i18n.t('account.billing.cancelImmediateSuccessToast'), 'success');
        } else {
          this.showToast(this.i18n.t('account.billing.cancelSuccessToast'), 'info');
        }
      } else {
        const msg = result.errorKey ? this.i18n.t(result.errorKey) : this.i18n.t('account.billing.cancelErrorToast');
        this.showToast(msg, 'error');
      }
    } catch {
      this.showToast(this.i18n.t('account.billing.cancelErrorToast'), 'error');
    } finally {
      this.isCancellingSubscription.set(false);
    }
  }

  async reactivateSubscription(): Promise<void> {
    if (typeof this.supabase.reactivateSubscription !== 'function') {
      return;
    }

    this.isReactivatingSubscription.set(true);
    try {
      const result = await this.supabase.reactivateSubscription();
      if (result.success) {
        this.showToast(this.i18n.t('account.billing.reactivateSuccessToast'), 'success');
      } else {
        const msg = result.errorKey ? this.i18n.t(result.errorKey) : this.i18n.t('account.billing.reactivateErrorToast');
        this.showToast(msg, 'error');
      }
    } catch {
      this.showToast(this.i18n.t('account.billing.reactivateErrorToast'), 'error');
    } finally {
      this.isReactivatingSubscription.set(false);
    }
  }

  upgradePlan(plan?: PaidPlan, cycleOverride?: 'monthly' | 'annual'): void {
    this.showToast(this.i18n.t('account.billing.upgradeMockToast'));
    const targetPlan: PaidPlan = plan ?? (this.userPlan() === 'pro' ? 'industrial' : 'pro');
    const cycle = cycleOverride ?? this.billingCycleSelect();
    this.billingCycleSelect.set(cycle);
    void this.paymentService.openCheckout(targetPlan, cycle);
  }

  addPaymentMethod(): void {
    this.openAddPaymentForm();
  }

  openAddPaymentForm(): void {
    this.resetPaymentMethodForm(this.paymentMethods().length === 0);
    this.isAddingPaymentMethod.set(true);
  }

  cancelAddPaymentForm(): void {
    this.isAddingPaymentMethod.set(false);
    this.resetPaymentMethodForm(false);
  }

  private resetPaymentMethodForm(defaultFlag = false): void {
    this.paymentMethodForm.reset({
      holderName: '',
      cardNumber: '',
      expiry: '',
      cvc: '',
      isDefault: defaultFlag
    });
    this.paymentMethodForm.markAsPristine();
    this.paymentMethodForm.markAsUntouched();
    this.cardNumberValue.set('');
  }

  onCardNumberInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement | null;
    if (!inputEl) {
      return;
    }
    const formatted = formatCardNumberDisplay(inputEl.value);
    inputEl.value = formatted;
    this.paymentMethodForm.controls.cardNumber.setValue(formatted);
  }

  onExpiryInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement | null;
    if (!inputEl) {
      return;
    }
    const formatted = formatCardExpiryDisplay(inputEl.value);
    inputEl.value = formatted;
    this.paymentMethodForm.controls.expiry.setValue(formatted);
  }

  onCvcInput(event: Event): void {
    const inputEl = event.target as HTMLInputElement | null;
    if (!inputEl) {
      return;
    }
    const digits = inputEl.value.replace(/\D/g, '').slice(0, 4);
    inputEl.value = digits;
    this.paymentMethodForm.controls.cvc.setValue(digits);
  }

  async savePaymentMethod(): Promise<void> {
    if (this.paymentMethodForm.invalid) {
      this.paymentMethodForm.markAllAsTouched();
      return;
    }

    if (typeof this.supabase.addPaymentMethod !== 'function') {
      return;
    }

    const raw = this.paymentMethodForm.getRawValue();
    const digits = raw.cardNumber.replace(/\D/g, '');
    const brand = detectPaymentCardBrand(digits);
    const parsedExpiry = parseCardExpiry(raw.expiry);
    const trimmedHolder = raw.holderName.trim();

    if (!brand || !parsedExpiry || trimmedHolder.length < 2) {
      this.paymentMethodForm.markAllAsTouched();
      return;
    }

    // Seguridad: solo enviar marca, últimos 4 dígitos, expiración, titular y predeterminada (NUNCA PAN ni CVC)
    const last4 = digits.slice(-4);
    const isDefault =
      this.paymentMethods().length === 0 && !this.paymentMethodForm.controls.isDefault.dirty
        ? true
        : raw.isDefault;

    this.isSavingPaymentMethod.set(true);
    try {
      const result = await this.supabase.addPaymentMethod({
        brand,
        last4,
        exp_month: parsedExpiry.month,
        exp_year: parsedExpiry.year,
        holder_name: trimmedHolder,
        is_default: isDefault
      });

      if (result.success) {
        if (result.data) {
          const savedCard = result.data;
          this.paymentMethods.update((list) => {
            const base = savedCard.is_default
              ? list.map((item) => ({ ...item, is_default: false }))
              : [...list];
            return [savedCard, ...base].sort((a, b) => Number(b.is_default) - Number(a.is_default));
          });
        } else if (typeof this.supabase.getPaymentMethods === 'function') {
          const refreshed = await this.supabase.getPaymentMethods();
          this.paymentMethods.set(Array.isArray(refreshed) ? refreshed : []);
        }

        this.isAddingPaymentMethod.set(false);
        this.resetPaymentMethodForm(false);
        this.showToast(this.i18n.t('account.billing.cardSavedToast'), 'success');
      } else {
        const msg = result.errorKey ? this.i18n.t(result.errorKey) : this.i18n.t('account.billing.cardSaveErrorToast');
        this.showToast(msg, 'error');
      }
    } catch {
      this.showToast(this.i18n.t('account.billing.cardSaveErrorToast'), 'error');
    } finally {
      this.isSavingPaymentMethod.set(false);
    }
  }

  async setDefaultPaymentMethod(methodId: string): Promise<void> {
    if (typeof this.supabase.setDefaultPaymentMethod !== 'function') {
      return;
    }

    this.processingPaymentMethodId.set(methodId);
    try {
      const result = await this.supabase.setDefaultPaymentMethod(methodId);
      if (result.success) {
        this.paymentMethods.update((list) =>
          list
            .map((item) => ({ ...item, is_default: item.id === methodId }))
            .sort((a, b) => Number(b.is_default) - Number(a.is_default))
        );
        this.showToast(this.i18n.t('account.billing.cardDefaultSuccessToast'), 'success');
      } else {
        const msg = result.errorKey ? this.i18n.t(result.errorKey) : this.i18n.t('account.billing.cardActionErrorToast');
        this.showToast(msg, 'error');
      }
    } catch {
      this.showToast(this.i18n.t('account.billing.cardActionErrorToast'), 'error');
    } finally {
      this.processingPaymentMethodId.set(null);
    }
  }

  async deletePaymentMethod(methodId: string): Promise<void> {
    if (typeof this.supabase.deletePaymentMethod !== 'function') {
      return;
    }

    this.processingPaymentMethodId.set(methodId);
    try {
      const result = await this.supabase.deletePaymentMethod(methodId);
      if (result.success) {
        this.paymentMethods.update((list) => list.filter((item) => item.id !== methodId));
        this.showToast(this.i18n.t('account.billing.cardDeleteSuccessToast'), 'success');
      } else {
        const msg = result.errorKey ? this.i18n.t(result.errorKey) : this.i18n.t('account.billing.cardActionErrorToast');
        this.showToast(msg, 'error');
      }
    } catch {
      this.showToast(this.i18n.t('account.billing.cardActionErrorToast'), 'error');
    } finally {
      this.processingPaymentMethodId.set(null);
    }
  }

  formatExpiryMonthYear(expMonth: number, expYear: number): string {
    return `${String(expMonth).padStart(2, '0')} / ${expYear}`;
  }

  downloadInvoice(invoice: InvoiceMock): void {
    if (invoice.invoiceUrl && typeof window !== 'undefined') {
      window.open(invoice.invoiceUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    this.showToast(`${this.i18n.t('account.billing.downloadPdf')}: ${invoice.invoiceNumber}`);
  }
}
