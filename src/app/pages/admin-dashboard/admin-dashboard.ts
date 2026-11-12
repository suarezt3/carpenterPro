import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  Add01Icon,
  AlertCircleIcon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckListIcon,
  CheckmarkCircle02Icon,
  CircleArrowReload01Icon,
  CloudIcon,
  CreditCardIcon,
  CubeIcon,
  Globe02Icon,
  InformationCircleIcon,
  Invoice01Icon,
  Layers01Icon,
  QuoteUpIcon,
  Rocket01Icon,
  Settings01Icon,
  Shield01Icon,
  SparklesIcon,
  StarIcon,
  Tag01Icon,
  Tick02Icon,
  UserIcon
} from '@hugeicons/core-free-icons';

import {
  BillingCycle,
  PlatformFeedbackCategory,
  PlatformFeedbackRecord,
  PlatformFeedbackStatus,
  PlatformSettingsRecord,
  SubscriptionInvoice,
  SubscriptionStatus,
  SupabaseService,
  UserPlan,
  UserProfile,
  UserRole
} from '../../services/supabase.service';

export type AdminSection = 'overview' | 'users' | 'cms' | 'testimonials' | 'support';
export type AdminUserFilter = 'all' | 'free' | 'pro' | 'industrial' | 'super_admin' | 'suspended';
export type SupportCategoryFilter = 'all' | 'support' | 'bug';
export type SupportStatusFilter = 'all' | 'pending' | 'in_progress' | 'resolved';

export interface AdminNavItem {
  id: AdminSection;
  label: string;
  subtitle: string;
}

export interface AdminToastBanner {
  text: string;
  type: 'success' | 'error';
}

export interface UserProfilePatch {
  plan?: UserPlan;
  billing_cycle?: BillingCycle;
  subscription_status?: SubscriptionStatus;
  role?: UserRole;
  is_suspended?: boolean;
}

const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsRecord = {
  id: 1,
  app_version: 'v3.0.0',
  support_email: 'eydersuarez900@gmail.com',
  pro_monthly_usd: 15,
  pro_annual_monthly_usd: 12,
  pro_annual_total_usd: 144,
  industrial_monthly_usd: 29,
  industrial_annual_monthly_usd: 23,
  industrial_annual_total_usd: 276,
  announcement_enabled: false,
  announcement_text: '',
  announcement_badge: 'NOVEDAD',
  free_max_modules: 3,
  updated_at: new Date().toISOString()
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    HugeiconsIconComponent
  ],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit {
  readonly supabase = inject(SupabaseService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly icons = {
    shield: Shield01Icon,
    cube: CubeIcon,
    layers: Layers01Icon,
    user: UserIcon,
    settings: Settings01Icon,
    star: StarIcon,
    quote: QuoteUpIcon,
    checkList: CheckListIcon,
    info: InformationCircleIcon,
    invoice: Invoice01Icon,
    creditCard: CreditCardIcon,
    tag: Tag01Icon,
    add: Add01Icon,
    tick: Tick02Icon,
    cancel: Cancel01Icon,
    checkCircle: CheckmarkCircle02Icon,
    alert: AlertCircleIcon,
    arrowRight: ArrowRight01Icon,
    cloud: CloudIcon,
    loading: CircleArrowReload01Icon,
    rocket: Rocket01Icon,
    sparkles: SparklesIcon,
    globe: Globe02Icon
  };

  readonly navItems: readonly AdminNavItem[] = [
    {
      id: 'overview',
      label: 'Resumen y Finanzas',
      subtitle: 'KPIs, MRR y actividad'
    },
    {
      id: 'users',
      label: 'Usuarios y Planes',
      subtitle: 'CRM y control de accesos'
    },
    {
      id: 'cms',
      label: 'Precios y CMS Global',
      subtitle: 'Tarifas, versión y anuncios'
    },
    {
      id: 'testimonials',
      label: 'Testimonios Públicos',
      subtitle: 'Moderación y prueba social'
    },
    {
      id: 'support',
      label: 'Soporte y Reportes',
      subtitle: 'Tickets técnicos y bugs'
    }
  ];

  readonly starScale: readonly number[] = [1, 2, 3, 4, 5];

  // Navigation & UI state
  readonly activeSection = signal<AdminSection>('overview');
  readonly isLoading = signal<boolean>(false);
  readonly isSavingCms = signal<boolean>(false);
  readonly isCreatingTestimonial = signal<boolean>(false);
  readonly showNewTestimonialForm = signal<boolean>(false);
  readonly updatingUserId = signal<string | null>(null);
  readonly updatingFeedbackId = signal<string | null>(null);
  readonly savedFeedbackId = signal<string | null>(null);
  readonly toastBanner = signal<AdminToastBanner | null>(null);

  // Domain Collections
  readonly profiles = signal<UserProfile[]>([]);
  readonly invoices = signal<SubscriptionInvoice[]>([]);
  readonly feedbackList = signal<PlatformFeedbackRecord[]>([]);

  // CRM Filters
  readonly searchQuery = signal<string>('');
  readonly userFilter = signal<AdminUserFilter>('all');

  // Support Filters & Local Drafts
  readonly supportCategoryFilter = signal<SupportCategoryFilter>('all');
  readonly supportStatusFilter = signal<SupportStatusFilter>('all');
  readonly adminNotesDraft = signal<Record<string, string>>({});
  readonly ticketStatusDraft = signal<Record<string, PlatformFeedbackStatus>>({});

  // Current Settings Computed
  readonly currentSettings = computed<PlatformSettingsRecord>(() => {
    const sig = this.supabase.platformSettings;
    return typeof sig === 'function' ? sig() : DEFAULT_PLATFORM_SETTINGS;
  });

  // KPI Computed Signals (Module 1)
  readonly totalUsersCount = computed<number>(() => this.profiles().length);
  readonly freeUsersCount = computed<number>(() =>
    this.profiles().filter(p => p.plan === 'free').length
  );
  readonly proUsersCount = computed<number>(() =>
    this.profiles().filter(p => p.plan === 'pro').length
  );
  readonly industrialUsersCount = computed<number>(() =>
    this.profiles().filter(p => p.plan === 'industrial').length
  );

  readonly activePaidSubscriptionsCount = computed<number>(() =>
    this.profiles().filter(
      p =>
        !p.is_suspended &&
        (p.plan === 'pro' || p.plan === 'industrial') &&
        (p.subscription_status === 'active' || p.subscription_status === 'on_trial')
    ).length
  );

  readonly estimatedMrrUsd = computed<number>(() => {
    const settings = this.currentSettings();
    let total = 0;

    for (const user of this.profiles()) {
      if (user.is_suspended) continue;
      const isPaidStatus =
        user.subscription_status === 'active' || user.subscription_status === 'on_trial';
      if (!isPaidStatus) continue;

      if (user.plan === 'pro') {
        const monthlyRate =
          user.billing_cycle === 'annual'
            ? Number(settings.pro_annual_monthly_usd)
            : Number(settings.pro_monthly_usd);
        total += Number.isFinite(monthlyRate) ? monthlyRate : 0;
      } else if (user.plan === 'industrial') {
        const monthlyRate =
          user.billing_cycle === 'annual'
            ? Number(settings.industrial_annual_monthly_usd)
            : Number(settings.industrial_monthly_usd);
        total += Number.isFinite(monthlyRate) ? monthlyRate : 0;
      }
    }

    return Math.round(total * 100) / 100;
  });

  readonly pendingSupportCount = computed<number>(() =>
    this.feedbackList().filter(
      f =>
        (f.category === 'support' || f.category === 'bug') &&
        (f.status === 'pending' || f.status === 'in_progress')
    ).length
  );

  readonly pendingTestimonialsCount = computed<number>(() =>
    this.feedbackList().filter(f => f.category === 'testimonial' && f.status === 'pending').length
  );

  readonly pendingAttentionCount = computed<number>(
    () => this.pendingSupportCount() + this.pendingTestimonialsCount()
  );

  readonly recentInvoices = computed<SubscriptionInvoice[]>(() => this.invoices().slice(0, 8));
  readonly recentUsers = computed<UserProfile[]>(() => this.profiles().slice(0, 8));

  // Filtered Users (Module 2 - CRM)
  readonly filteredUsers = computed<UserProfile[]>(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.userFilter();

    return this.profiles().filter(user => {
      if (filter === 'free' && user.plan !== 'free') return false;
      if (filter === 'pro' && user.plan !== 'pro') return false;
      if (filter === 'industrial' && user.plan !== 'industrial') return false;
      if (filter === 'super_admin' && user.role !== 'super_admin') return false;
      if (filter === 'suspended' && !user.is_suspended) return false;

      if (!query) return true;

      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
      const email = (user.email || '').toLowerCase();
      return fullName.includes(query) || email.includes(query);
    });
  });

  // Filtered Testimonials (Module 4)
  readonly testimonialsList = computed<PlatformFeedbackRecord[]>(() =>
    this.feedbackList().filter(item => item.category === 'testimonial')
  );

  // Filtered Support & Bugs (Module 5)
  readonly supportTicketsList = computed<PlatformFeedbackRecord[]>(() => {
    const catFilter = this.supportCategoryFilter();
    const statFilter = this.supportStatusFilter();

    return this.feedbackList().filter(item => {
      const isTicket = item.category === 'support' || item.category === 'bug';
      if (!isTicket) return false;
      if (catFilter !== 'all' && item.category !== catFilter) return false;
      if (statFilter !== 'all' && item.status !== statFilter) return false;
      return true;
    });
  });

  // CMS Reactive Form (Module 3)
  readonly cmsForm = this.fb.group({
    pro_monthly_usd: [15, [Validators.required, Validators.min(0)]],
    pro_annual_monthly_usd: [12, [Validators.required, Validators.min(0)]],
    pro_annual_total_usd: [144, [Validators.required, Validators.min(0)]],
    industrial_monthly_usd: [29, [Validators.required, Validators.min(0)]],
    industrial_annual_monthly_usd: [23, [Validators.required, Validators.min(0)]],
    industrial_annual_total_usd: [276, [Validators.required, Validators.min(0)]],
    free_max_modules: [3, [Validators.required, Validators.min(1)]],
    app_version: ['v3.0.0', [Validators.required]],
    support_email: ['eydersuarez900@gmail.com', [Validators.required, Validators.email]],
    announcement_enabled: [false],
    announcement_badge: ['NOVEDAD', [Validators.required]],
    announcement_text: ['']
  });

  readonly announcementBadgeOptions = [
    { value: 'NOVEDAD', label: 'Novedad' },
    { value: 'LANZAMIENTO', label: 'Lanzamiento' },
    { value: 'PROMO', label: 'Promoción (PROMO)' },
    { value: 'PROMOCIÓN', label: 'Promoción' },
    { value: 'DESCUENTO', label: 'Descuento' },
    { value: 'ACTUALIZACIÓN', label: 'Actualización' },
    { value: 'MANTENIMIENTO', label: 'Mantenimiento' },
    { value: 'AVISO', label: 'Aviso Importante' }
  ] as const;

  // New Testimonial Reactive Form (Module 4)
  readonly newTestimonialForm = this.fb.group({
    user_name: ['', [Validators.required, Validators.minLength(2)]],
    user_role_title: ['Taller de Carpintería', [Validators.required]],
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    message: ['', [Validators.required, Validators.minLength(10)]],
    is_featured: [true]
  });

  constructor() {
    effect(() => {
      const settings = this.currentSettings();
      this.syncCmsFormWithSettings(settings);
    });
  }

  ngOnInit(): void {
    void this.reloadAllData();
  }

  setSection(section: AdminSection): void {
    this.activeSection.set(section);
  }

  setUserFilter(filter: AdminUserFilter): void {
    this.userFilter.set(filter);
  }

  onSearchQueryInput(value: string): void {
    this.searchQuery.set(value);
  }

  setSupportCategoryFilter(filter: SupportCategoryFilter): void {
    this.supportCategoryFilter.set(filter);
  }

  setSupportStatusFilter(filter: SupportStatusFilter): void {
    this.supportStatusFilter.set(filter);
  }

  showToast(text: string, type: 'success' | 'error' = 'success'): void {
    this.toastBanner.set({ text, type });
  }

  dismissToast(): void {
    this.toastBanner.set(null);
  }

  async reloadAllData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const [settings, profiles, invoices, feedback] = await Promise.all([
        typeof this.supabase.loadPlatformSettings === 'function'
          ? this.supabase.loadPlatformSettings()
          : Promise.resolve(this.currentSettings()),
        typeof this.supabase.adminGetAllProfiles === 'function'
          ? this.supabase.adminGetAllProfiles()
          : Promise.resolve([] as UserProfile[]),
        typeof this.supabase.adminGetAllInvoices === 'function'
          ? this.supabase.adminGetAllInvoices(50)
          : Promise.resolve([] as SubscriptionInvoice[]),
        typeof this.supabase.adminGetAllFeedback === 'function'
          ? this.supabase.adminGetAllFeedback()
          : Promise.resolve([] as PlatformFeedbackRecord[])
      ]);

      this.syncCmsFormWithSettings(settings);
      this.profiles.set(profiles);
      this.invoices.set(invoices);
      this.feedbackList.set(feedback);
      this.hydrateFeedbackDrafts(feedback);
    } catch {
      this.showToast('No fue posible sincronizar algunos datos administrativos.', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  private syncCmsFormWithSettings(settings: PlatformSettingsRecord): void {
    this.cmsForm.patchValue(
      {
        pro_monthly_usd: settings.pro_monthly_usd,
        pro_annual_monthly_usd: settings.pro_annual_monthly_usd,
        pro_annual_total_usd: settings.pro_annual_total_usd,
        industrial_monthly_usd: settings.industrial_monthly_usd,
        industrial_annual_monthly_usd: settings.industrial_annual_monthly_usd,
        industrial_annual_total_usd: settings.industrial_annual_total_usd,
        free_max_modules: settings.free_max_modules,
        app_version: settings.app_version,
        support_email: settings.support_email,
        announcement_enabled: settings.announcement_enabled,
        announcement_badge: settings.announcement_badge || 'NOVEDAD',
        announcement_text: settings.announcement_text || ''
      },
      { emitEvent: false }
    );
  }

  private hydrateFeedbackDrafts(records: PlatformFeedbackRecord[]): void {
    const notesMap: Record<string, string> = {};
    const statusMap: Record<string, PlatformFeedbackStatus> = {};
    for (const item of records) {
      notesMap[item.id] = item.admin_notes ?? '';
      statusMap[item.id] = item.status;
    }
    this.adminNotesDraft.set(notesMap);
    this.ticketStatusDraft.set(statusMap);
  }

  // ==========================================
  // MODULE 2: CRM & USER MANAGEMENT ACTIONS
  // ==========================================

  async updateUserField(
    user: UserProfile,
    patch: UserProfilePatch,
    customMessage?: string
  ): Promise<void> {
    this.updatingUserId.set(user.id);
    try {
      const result = await this.supabase.adminUpdateUserProfile(user.id, patch);
      if (!result.success) {
        this.showToast(
          result.error || 'No se pudo actualizar el perfil del usuario.',
          'error'
        );
        return;
      }

      this.profiles.update(list =>
        list.map(item =>
          item.id === user.id
            ? {
                ...item,
                ...patch,
                updated_at: new Date().toISOString()
              }
            : item
        )
      );

      this.showToast(
        customMessage || `Perfil de ${user.first_name || user.email} actualizado correctamente.`,
        'success'
      );
    } finally {
      this.updatingUserId.set(null);
    }
  }

  async onUserPlanChange(user: UserProfile, planValue: string): Promise<void> {
    const plan = planValue as UserPlan;
    const subscription_status: SubscriptionStatus =
      plan === 'free'
        ? 'free'
        : user.subscription_status === 'free' || !user.subscription_status
          ? 'active'
          : user.subscription_status;

    await this.updateUserField(
      user,
      { plan, subscription_status },
      `Plan de ${user.first_name || user.email} actualizado a ${this.getPlanLabel(plan)}.`
    );
  }

  async onUserCycleChange(user: UserProfile, cycleValue: string): Promise<void> {
    const billing_cycle = cycleValue as BillingCycle;
    await this.updateUserField(
      user,
      { billing_cycle },
      `Ciclo de facturación actualizado para ${user.first_name || user.email}.`
    );
  }

  async onUserStatusChange(user: UserProfile, statusValue: string): Promise<void> {
    const subscription_status = statusValue as SubscriptionStatus;
    await this.updateUserField(
      user,
      { subscription_status },
      `Estado de suscripción actualizado para ${user.first_name || user.email}.`
    );
  }

  async toggleUserRole(user: UserProfile): Promise<void> {
    const nextRole: UserRole = user.role === 'super_admin' ? 'user' : 'super_admin';
    await this.updateUserField(
      user,
      { role: nextRole },
      `Rol de ${user.first_name || user.email} cambiado a ${nextRole === 'super_admin' ? 'Super Admin' : 'Usuario Estándar'}.`
    );
  }

  async toggleUserSuspension(user: UserProfile): Promise<void> {
    const nextSuspended = !user.is_suspended;
    await this.updateUserField(
      user,
      { is_suspended: nextSuspended },
      nextSuspended
        ? `Cuenta de ${user.first_name || user.email} suspendida.`
        : `Cuenta de ${user.first_name || user.email} reactivada.`
    );
  }

  // ==========================================
  // MODULE 3: CMS & GLOBAL SETTINGS ACTIONS
  // ==========================================

  async saveCmsSettings(): Promise<void> {
    if (this.cmsForm.invalid) {
      this.cmsForm.markAllAsTouched();
      this.showToast('Revisa los campos obligatorios de la configuración global.', 'error');
      return;
    }

    this.isSavingCms.set(true);
    try {
      const raw = this.cmsForm.getRawValue();
      const patch: Partial<PlatformSettingsRecord> = {
        pro_monthly_usd: Number(raw.pro_monthly_usd),
        pro_annual_monthly_usd: Number(raw.pro_annual_monthly_usd),
        pro_annual_total_usd: Number(raw.pro_annual_total_usd),
        industrial_monthly_usd: Number(raw.industrial_monthly_usd),
        industrial_annual_monthly_usd: Number(raw.industrial_annual_monthly_usd),
        industrial_annual_total_usd: Number(raw.industrial_annual_total_usd),
        free_max_modules: Number(raw.free_max_modules),
        app_version: raw.app_version.trim(),
        support_email: raw.support_email.trim(),
        announcement_enabled: Boolean(raw.announcement_enabled),
        announcement_badge: raw.announcement_badge.trim() || 'NOVEDAD',
        announcement_text: raw.announcement_text.trim()
      };

      const result = await this.supabase.updatePlatformSettings(patch);
      if (!result.success) {
        this.showToast(
          result.error || 'No se pudo guardar la configuración global.',
          'error'
        );
        return;
      }

      this.showToast('Configuración global guardada y publicada en tiempo real.', 'success');
    } finally {
      this.isSavingCms.set(false);
    }
  }

  // ==========================================
  // MODULE 4: TESTIMONIALS MODERATION ACTIONS
  // ==========================================

  toggleNewTestimonialModal(): void {
    this.showNewTestimonialForm.update(v => !v);
  }

  setNewTestimonialRating(rating: number): void {
    this.newTestimonialForm.controls.rating.setValue(rating);
  }

  async createTestimonial(): Promise<void> {
    if (this.newTestimonialForm.invalid) {
      this.newTestimonialForm.markAllAsTouched();
      this.showToast('Completa el nombre, taller y mensaje del testimonio.', 'error');
      return;
    }

    this.isCreatingTestimonial.set(true);
    try {
      const raw = this.newTestimonialForm.getRawValue();
      const result = await this.supabase.adminCreateTestimonial({
        user_name: raw.user_name.trim(),
        user_role_title: raw.user_role_title.trim(),
        rating: Number(raw.rating),
        message: raw.message.trim(),
        is_featured: Boolean(raw.is_featured)
      });

      if (!result.success) {
        this.showToast(result.error || 'No se pudo crear el testimonio.', 'error');
        return;
      }

      const createdRecord: PlatformFeedbackRecord = result.data ?? {
        id: `testimonial-${Date.now()}`,
        user_id: null,
        user_name: raw.user_name.trim(),
        user_email: null,
        user_role_title: raw.user_role_title.trim(),
        category: 'testimonial',
        subject: null,
        message: raw.message.trim(),
        rating: Number(raw.rating),
        status: 'approved',
        is_featured: Boolean(raw.is_featured),
        admin_notes: null,
        created_at: new Date().toISOString()
      };

      this.feedbackList.update(list => [createdRecord, ...list]);
      this.newTestimonialForm.reset({
        user_name: '',
        user_role_title: 'Taller de Carpintería',
        rating: 5,
        message: '',
        is_featured: true
      });
      this.showNewTestimonialForm.set(false);
      this.showToast('Testimonio destacado publicado en la portada.', 'success');
    } finally {
      this.isCreatingTestimonial.set(false);
    }
  }

  async approveTestimonial(item: PlatformFeedbackRecord): Promise<void> {
    this.updatingFeedbackId.set(item.id);
    try {
      const result = await this.supabase.adminUpdateFeedback(item.id, {
        status: 'approved',
        is_featured: true
      });
      if (!result.success) {
        this.showToast(result.error || 'No se pudo aprobar el testimonio.', 'error');
        return;
      }

      this.feedbackList.update(list =>
        list.map(f =>
          f.id === item.id ? { ...f, status: 'approved', is_featured: true } : f
        )
      );
      this.showToast('Testimonio aprobado y publicado en la página principal.', 'success');
    } finally {
      this.updatingFeedbackId.set(null);
    }
  }

  async toggleTestimonialFeatured(item: PlatformFeedbackRecord): Promise<void> {
    this.updatingFeedbackId.set(item.id);
    const nextFeatured = !item.is_featured;
    try {
      const result = await this.supabase.adminUpdateFeedback(item.id, {
        is_featured: nextFeatured
      });
      if (!result.success) {
        this.showToast(result.error || 'No se pudo actualizar el estado destacado.', 'error');
        return;
      }

      this.feedbackList.update(list =>
        list.map(f => (f.id === item.id ? { ...f, is_featured: nextFeatured } : f))
      );
      this.showToast(
        nextFeatured
          ? 'Testimonio marcado como destacado.'
          : 'Testimonio retirado de destacados.',
        'success'
      );
    } finally {
      this.updatingFeedbackId.set(null);
    }
  }

  async rejectTestimonial(item: PlatformFeedbackRecord): Promise<void> {
    this.updatingFeedbackId.set(item.id);
    try {
      const result = await this.supabase.adminUpdateFeedback(item.id, {
        status: 'rejected',
        is_featured: false
      });
      if (!result.success) {
        this.showToast(result.error || 'No se pudo ocultar el testimonio.', 'error');
        return;
      }

      this.feedbackList.update(list =>
        list.map(f =>
          f.id === item.id ? { ...f, status: 'rejected', is_featured: false } : f
        )
      );
      this.showToast('Testimonio ocultado de la portada pública.', 'success');
    } finally {
      this.updatingFeedbackId.set(null);
    }
  }

  async deleteFeedbackItem(item: PlatformFeedbackRecord): Promise<void> {
    this.updatingFeedbackId.set(item.id);
    try {
      const result = await this.supabase.adminDeleteFeedback(item.id);
      if (!result.success) {
        this.showToast(result.error || 'No se pudo eliminar el registro.', 'error');
        return;
      }

      this.feedbackList.update(list => list.filter(f => f.id !== item.id));
      this.showToast('Registro eliminado permanentemente.', 'success');
    } finally {
      this.updatingFeedbackId.set(null);
    }
  }

  // ==========================================
  // MODULE 5: SUPPORT & BUG TICKETS ACTIONS
  // ==========================================

  getTicketDraftStatus(ticket: PlatformFeedbackRecord): PlatformFeedbackStatus {
    return this.ticketStatusDraft()[ticket.id] ?? ticket.status;
  }

  setTicketDraftStatus(ticketId: string, statusValue: string): void {
    const status = statusValue as PlatformFeedbackStatus;
    this.ticketStatusDraft.update(prev => ({ ...prev, [ticketId]: status }));
  }

  getTicketDraftNotes(ticket: PlatformFeedbackRecord): string {
    return this.adminNotesDraft()[ticket.id] ?? ticket.admin_notes ?? '';
  }

  setTicketDraftNotes(ticketId: string, notes: string): void {
    this.adminNotesDraft.update(prev => ({ ...prev, [ticketId]: notes }));
  }

  async saveTicketChanges(ticket: PlatformFeedbackRecord): Promise<void> {
    this.updatingFeedbackId.set(ticket.id);
    const nextStatus = this.getTicketDraftStatus(ticket);
    const nextNotes = this.getTicketDraftNotes(ticket).trim();

    try {
      const result = await this.supabase.adminUpdateFeedback(ticket.id, {
        status: nextStatus,
        admin_notes: nextNotes
      });

      if (!result.success) {
        this.showToast(result.error || 'No se pudo actualizar el ticket de soporte.', 'error');
        return;
      }

      this.feedbackList.update(list =>
        list.map(item =>
          item.id === ticket.id
            ? { ...item, status: nextStatus, admin_notes: nextNotes, updated_at: new Date().toISOString() }
            : item
        )
      );
      this.adminNotesDraft.update(prev => ({ ...prev, [ticket.id]: nextNotes }));
      this.ticketStatusDraft.update(prev => ({ ...prev, [ticket.id]: nextStatus }));

      this.savedFeedbackId.set(ticket.id);
      setTimeout(() => {
        if (this.savedFeedbackId() === ticket.id) {
          this.savedFeedbackId.set(null);
        }
      }, 4000);

      this.showToast('¡Guardado y notificado al usuario!', 'success');
    } finally {
      this.updatingFeedbackId.set(null);
    }
  }

  // ==========================================
  // PRESENTATION HELPERS
  // ==========================================

  getPlanLabel(plan: UserPlan): string {
    if (plan === 'industrial') return 'Industrial & CNC';
    if (plan === 'pro') return 'Taller Pro';
    return 'Inicial (Free)';
  }

  getCycleLabel(cycle?: BillingCycle | null): string {
    return cycle === 'annual' ? 'Anual' : 'Mensual';
  }

  getFeedbackStatusLabel(status: PlatformFeedbackStatus): string {
    switch (status) {
      case 'approved':
        return 'Aprobado';
      case 'rejected':
        return 'Oculto';
      case 'in_progress':
        return 'En Revisión';
      case 'resolved':
        return 'Resuelto';
      default:
        return 'Pendiente';
    }
  }

  getCategoryLabel(category: PlatformFeedbackCategory): string {
    if (category === 'bug') return 'Reporte de Bug';
    if (category === 'testimonial') return 'Testimonio';
    return 'Soporte Técnico';
  }

  formatShortDate(isoDate?: string | null): string {
    if (!isoDate) return '—';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate.slice(0, 10);
    return d.toISOString().slice(0, 10);
  }
}
