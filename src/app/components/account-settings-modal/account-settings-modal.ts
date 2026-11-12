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
import { CommonModule } from '@angular/common';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  AccountSetting01Icon,
  Add01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  CreditCardIcon,
  Download01Icon,
  Globe02Icon,
  InformationCircleIcon,
  Invoice01Icon,
  Layers01Icon,
  Moon02Icon,
  Rocket01Icon,
  Settings01Icon,
  Shield01Icon,
  Sun01Icon,
  Tick02Icon,
  UserIcon
} from '@hugeicons/core-free-icons';

import { SupabaseService, SubscriptionInvoice } from '../../services/supabase.service';
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

export interface PaymentMethodMock {
  id: string;
  brand: 'visa' | 'mastercard';
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  holderName: string;
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
    invoice: Invoice01Icon,
    checkList: CheckListIcon,
    checkCircle: CheckmarkCircle02Icon,
    check: Tick02Icon,
    close: Cancel01Icon,
    info: InformationCircleIcon,
    download: Download01Icon,
    add: Add01Icon,
    arrowRight: ArrowRight01Icon,
    rocket: Rocket01Icon,
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
  readonly avatarColors: AvatarColorOption[] = [
    { id: 'graphite', hex: '#18181b', bg: 'bg-zinc-900', ring: 'ring-zinc-900' },
    { id: 'stone', hex: '#52525b', bg: 'bg-zinc-700', ring: 'ring-zinc-700' },
    { id: 'sky', hex: '#0284c7', bg: 'bg-sky-600', ring: 'ring-sky-600' },
    { id: 'emerald', hex: '#059669', bg: 'bg-emerald-600', ring: 'ring-emerald-600' },
    { id: 'amber', hex: '#d97706', bg: 'bg-amber-600', ring: 'ring-amber-600' },
    { id: 'zinc', hex: '#27272a', bg: 'bg-zinc-800', ring: 'ring-zinc-800' }
  ];

  readonly selectedAvatarColor = signal<string>(this.getInitialAvatarColor());
  readonly avatarType = signal<'color' | 'google'>(this.getInitialAvatarType());
  readonly isSavingProfile = signal<boolean>(false);

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

  readonly googlePhotoUrl = computed(() => {
    const user = this.currentUser();
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    if (typeof meta['avatar_url'] === 'string' && meta['avatar_url'].trim()) {
      return meta['avatar_url'].trim();
    }
    if (typeof meta['picture'] === 'string' && meta['picture'].trim()) {
      return meta['picture'].trim();
    }
    return null;
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

  readonly subscriptionStatusKey = computed<string>(() => {
    const status = this.userProfile()?.subscription_status;
    if (status === 'on_trial') return 'account.billing.statusTrial';
    if (status === 'cancelled') return 'account.billing.statusCancelled';
    if (status === 'past_due') return 'account.billing.statusPastDue';
    if (status === 'expired') return 'account.billing.statusExpired';
    if (status === 'active' || this.userPlan() !== 'free') return 'account.billing.activeBadge';
    return 'account.billing.activeBadge';
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

  readonly paymentMethods = signal<PaymentMethodMock[]>([
    {
      id: 'pm_1',
      brand: 'visa',
      last4: '4242',
      expiryMonth: 8,
      expiryYear: 2028,
      isDefault: true,
      holderName: 'Usuario Registrado'
    },
    {
      id: 'pm_2',
      brand: 'mastercard',
      last4: '8812',
      expiryMonth: 11,
      expiryYear: 2027,
      isDefault: false,
      holderName: 'Usuario Registrado'
    }
  ]);

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

    // Sincronizar tab inicial SOLO cuando el modal transita de false a true
    effect(() => {
      const open = this.isOpen();
      if (open && !this.previousIsOpen) {
        untracked(() => {
          this.activeTab.set(this.initialTab());
          this.showManageBillingNotice.set(false);
          this.loadProfileData();
          this.loadWorkshopData();
          this.loadPreferencesData();
          void this.loadBillingData();
        });
      }
      this.previousIsOpen = open;
    });

    // Recargar facturas automáticamente si se completa un Checkout.Success mientras el modal está abierto
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
  selectTab(tab: AccountModalTab) {
    this.activeTab.set(tab);
    if (tab === 'billing') {
      void this.loadBillingData();
    }
  }

  closeModal() {
    this.closed.emit();
    this.modalClose.emit();
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
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
  private loadProfileData() {
    const profile = this.userProfile();
    if (profile) {
      this.profileForm.patchValue({
        firstName: profile.first_name || '',
        lastName: profile.last_name || ''
      });
    } else {
      const user = this.currentUser();
      if (user) {
        const fallback = this.supabase.buildFallbackProfile(user);
        this.profileForm.patchValue({
          firstName: fallback.first_name,
          lastName: fallback.last_name
        });
      }
    }
  }

  private getInitialAvatarColor(): string {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('carpenterpro_avatar_color');
      if (saved) return saved;
    }
    return 'graphite';
  }

  private getInitialAvatarType(): 'color' | 'google' {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem('carpenterpro_avatar_type');
      if (saved === 'color' || saved === 'google') return saved;
    }
    const user = this.currentUser ? this.currentUser() : null;
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const hasPhoto = (typeof meta['avatar_url'] === 'string' && !!meta['avatar_url'].trim()) ||
                     (typeof meta['picture'] === 'string' && !!meta['picture'].trim());
    return hasPhoto ? 'google' : 'color';
  }

  selectAvatarColor(colorId: string) {
    this.selectedAvatarColor.set(colorId);
    this.avatarType.set('color');
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('carpenterpro_avatar_color', colorId);
      window.localStorage.setItem('carpenterpro_avatar_type', 'color');
    }
  }

  setAvatarType(type: 'color' | 'google') {
    this.avatarType.set(type);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('carpenterpro_avatar_type', type);
    }
  }

  getAvatarBgClass(): string {
    const found = this.avatarColors.find(c => c.id === this.selectedAvatarColor());
    return found ? found.bg : 'bg-zinc-900';
  }

  async saveProfile() {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSavingProfile.set(true);
    const { firstName, lastName } = this.profileForm.getRawValue();

    const result = await this.supabase.updateUserProfile({
      first_name: firstName,
      last_name: lastName
    });

    this.isSavingProfile.set(false);

    if (result.success) {
      this.showToast(this.i18n.t('account.profile.savedSuccess'), 'success');
    } else {
      const errorMsg = result.errorKey ? this.i18n.t(result.errorKey) : this.i18n.t('account.profileUpdateError');
      this.showToast(errorMsg, 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // LÓGICA TAB 2: PARÁMETROS DEL TALLER
  // ---------------------------------------------------------------------------
  private loadWorkshopData() {
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

  setWorkspacePreset(width: number, depth: number) {
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

  saveWorkshopSettings() {
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
  private loadPreferencesData() {
    const project = this.projectService.currentProject();
    const room = project.roomConfig || DEFAULT_ROOM_CONFIG;
    this.showFloorGrid.set(room.showFloorGrid ?? true);
    this.showClearances.set(room.showClearances ?? true);
  }

  selectLanguage(langCode: AppLanguage) {
    this.i18n.setLanguage(langCode);
    this.activeTab.set('preferences');
    this.showToast(this.i18n.t('account.preferences.saveSuccess'));
  }

  setCurrency(currencyCode: string) {
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

  toggleFloorGrid(checked: boolean) {
    this.showFloorGrid.set(checked);
    this.projectService.updateRoomConfig({ showFloorGrid: checked });
    this.activeTab.set('preferences');
    this.showToast(this.i18n.t('account.preferences.saveSuccess'));
  }

  onFloorGridToggle(event: Event) {
    const input = event.target as HTMLInputElement | null;
    if (input) {
      this.toggleFloorGrid(input.checked);
    }
  }

  toggleClearances(checked: boolean) {
    this.showClearances.set(checked);
    this.projectService.updateRoomConfig({ showClearances: checked });
    this.activeTab.set('preferences');
    this.showToast(this.i18n.t('account.preferences.saveSuccess'));
  }

  onClearancesToggle(event: Event) {
    const input = event.target as HTMLInputElement | null;
    if (input) {
      this.toggleClearances(input.checked);
    }
  }

  set3DTheme(mode: ThemeMode) {
    this.themeService.setTheme(mode);
    this.activeTab.set('preferences');
    this.showToast(this.i18n.t('account.preferences.saveSuccess'));
  }

  // ---------------------------------------------------------------------------
  // LÓGICA TAB 4: SUSCRIPCIÓN Y FACTURAS
  // ---------------------------------------------------------------------------
  async loadBillingData(): Promise<void> {
    const profileCycle = this.userProfile()?.billing_cycle;
    if (profileCycle === 'annual' || profileCycle === 'monthly') {
      this.billingCycleSelect.set(profileCycle);
    }

    if (typeof this.supabase.getSubscriptionInvoices !== 'function') {
      return;
    }

    this.isLoadingInvoices.set(true);
    try {
      const records = await this.supabase.getSubscriptionInvoices(20);
      this.cloudInvoices.set(records);
      this.hasLoadedCloudInvoices.set(true);
    } catch {
      // Conservar estado previo si falla la red
    } finally {
      this.isLoadingInvoices.set(false);
    }
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

  upgradePlan(plan?: PaidPlan, cycleOverride?: 'monthly' | 'annual') {
    this.showToast(this.i18n.t('account.billing.upgradeMockToast'));
    const targetPlan: PaidPlan = plan ?? (this.userPlan() === 'pro' ? 'industrial' : 'pro');
    const cycle = cycleOverride ?? this.billingCycleSelect();
    this.billingCycleSelect.set(cycle);
    void this.paymentService.openCheckout(targetPlan, cycle);
  }

  addPaymentMethod() {
    this.showManageBillingNotice.set(true);
    this.showToast(this.i18n.t('account.billing.addMethodMockToast'));
  }

  downloadInvoice(invoice: InvoiceMock) {
    if (invoice.invoiceUrl && typeof window !== 'undefined') {
      window.open(invoice.invoiceUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    this.showToast(`${this.i18n.t('account.billing.downloadPdf')}: ${invoice.invoiceNumber}`);
  }
}
