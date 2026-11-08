import { Component, ChangeDetectionStrategy, inject, signal, computed, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, NonNullableFormBuilder, Validators } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import {
  AlertCircleIcon,
  BookOpen01Icon,
  Bug02Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CircleArrowReload01Icon,
  CustomerSupportIcon,
  Idea01Icon,
  Location01Icon,
  Mail01Icon,
  QuoteUpIcon,
  SendIcon,
  SparklesIcon,
  StarIcon,
  UserIcon
} from '@hugeicons/core-free-icons';

import { SupabaseService } from '../../services/supabase.service';
import { I18nService } from '../../services/i18n.service';
import { ThemeService } from '../../services/theme.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import {
  CreateFeedbackPayload,
  FeedbackCategory,
  FeedbackCategoryOption,
  FeedbackModuleOption,
  FeedbackSeverity,
  FeedbackSeverityOption,
  TargetModule,
  UserFeedbackRecord
} from '../../models/feedback.models';

/**
 * Formulario dinámico unificado para Reporte de Bugs, Solicitudes de Funciones,
 * Soporte Técnico y Testimonios con auto-aprobación en Supabase.
 */
@Component({
  selector: 'app-feedback-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HugeiconsIconComponent, TranslatePipe],
  templateUrl: './feedback-form.html',
  styleUrl: './feedback-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeedbackFormComponent {
  readonly supabase = inject(SupabaseService);
  readonly i18n = inject(I18nService);
  readonly themeService = inject(ThemeService);
  private readonly fb = inject(NonNullableFormBuilder);

  // Evento para regresar a la vista de manual en el modal principal
  readonly navigateToManual = output<void>();

  // Iconos oficiales Hugeicons registrados
  readonly icons = {
    bug: Bug02Icon,
    feature: Idea01Icon,
    support: CustomerSupportIcon,
    testimonial: QuoteUpIcon,
    star: StarIcon,
    send: SendIcon,
    success: CheckmarkCircle02Icon,
    cancel: Cancel01Icon,
    loading: CircleArrowReload01Icon,
    alert: AlertCircleIcon,
    sparkles: SparklesIcon,
    mail: Mail01Icon,
    user: UserIcon,
    location: Location01Icon,
    quote: QuoteUpIcon,
    book: BookOpen01Icon
  };

  // Sub-vistas disponibles dentro de la sección
  readonly activeSubView = signal<'form' | 'history' | 'community'>('form');

  // Opciones de Categoría con descripciones y metadatos
  readonly categoryOptions: FeedbackCategoryOption[] = [
    { id: 'bug', labelKey: 'feedback.catBug', descKey: 'feedback.catBugDesc', iconName: 'bug' },
    { id: 'feature', labelKey: 'feedback.catFeature', descKey: 'feedback.catFeatureDesc', iconName: 'feature' },
    { id: 'support', labelKey: 'feedback.catSupport', descKey: 'feedback.catSupportDesc', iconName: 'support' },
    { id: 'testimonial', labelKey: 'feedback.catTestimonial', descKey: 'feedback.catTestimonialDesc', iconName: 'testimonial' }
  ];

  // Opciones de Módulos afectados
  readonly moduleOptions: FeedbackModuleOption[] = [
    { id: 'general', labelKey: 'feedback.modGeneral' },
    { id: 'designer_3d', labelKey: 'feedback.modDesigner3d' },
    { id: 'parts_list', labelKey: 'feedback.modPartsList' },
    { id: 'optimizer_2d', labelKey: 'feedback.modOptimizer2d' },
    { id: 'budget', labelKey: 'feedback.modBudget' },
    { id: 'labels', labelKey: 'feedback.modLabels' },
    { id: 'exports', labelKey: 'feedback.modExports' }
  ];

  // Opciones de Severidad / Prioridad
  readonly severityOptions: FeedbackSeverityOption[] = [
    { id: 'low', labelKey: 'feedback.sevLow', badgeClass: 'text-zinc-600 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300' },
    { id: 'medium', labelKey: 'feedback.sevMedium', badgeClass: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300' },
    { id: 'high', labelKey: 'feedback.sevHigh', badgeClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300' },
    { id: 'critical', labelKey: 'feedback.sevCritical', badgeClass: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-300' }
  ];

  // Formulario reactivo fuertemente tipado
  readonly feedbackForm = this.fb.group({
    category: this.fb.control<FeedbackCategory>('bug'),
    title: this.fb.control<string>('', [Validators.maxLength(150)]),
    message: this.fb.control<string>('', [Validators.required, Validators.minLength(10)]),
    contact_email: this.fb.control<string>(this.supabase.currentUser()?.email || '', [Validators.email]),
    target_module: this.fb.control<TargetModule>('general'),
    severity_or_priority: this.fb.control<FeedbackSeverity>('medium'),
    rating: this.fb.control<number>(5, [Validators.min(1), Validators.max(5)]),
    author_name: this.fb.control<string>((this.supabase.currentUser()?.user_metadata?.['full_name'] as string) || ''),
    author_role: this.fb.control<string>(''),
    author_location: this.fb.control<string>(''),
    allow_public_display: this.fb.control<boolean>(true)
  });

  // Signals de estado operativo
  readonly selectedCategory = signal<FeedbackCategory>('bug');
  readonly submitting = signal<boolean>(false);
  readonly submitSuccess = signal<UserFeedbackRecord | null>(null);
  readonly submitError = signal<string | null>(null);

  // Historial de usuario y testimonios comunitarios
  readonly myFeedbackList = signal<UserFeedbackRecord[]>([]);
  readonly loadingHistory = signal<boolean>(false);
  readonly communityTestimonials = signal<UserFeedbackRecord[]>([]);
  readonly loadingCommunity = signal<boolean>(false);

  // Computados para validación y UI
  readonly isTestimonial = computed(() => this.selectedCategory() === 'testimonial');

  readonly messageValue = toSignal(this.feedbackForm.controls.message.valueChanges, {
    initialValue: this.feedbackForm.controls.message.value
  });

  readonly ratingValue = toSignal(this.feedbackForm.controls.rating.valueChanges, {
    initialValue: this.feedbackForm.controls.rating.value
  });

  readonly allowPublicValue = toSignal(this.feedbackForm.controls.allow_public_display.valueChanges, {
    initialValue: this.feedbackForm.controls.allow_public_display.value
  });

  readonly messageCharCount = computed(() => {
    return (this.messageValue() || '').trim().length;
  });

  readonly isAutoApprovedEligible = computed(() => {
    const isTest = this.isTestimonial();
    const rating = this.ratingValue();
    const allowPublic = this.allowPublicValue();
    return isTest && allowPublic && rating >= 4;
  });

  /**
   * Cambia la categoría activa y ajusta valores por defecto dinámicamente.
   */
  setCategory(cat: FeedbackCategory): void {
    this.selectedCategory.set(cat);
    this.feedbackForm.controls.category.setValue(cat);
    this.submitError.set(null);

    // Ajustar defaults según categoría
    if (cat === 'testimonial') {
      if (!this.feedbackForm.controls.rating.value) {
        this.feedbackForm.controls.rating.setValue(5);
      }
      this.feedbackForm.controls.allow_public_display.setValue(true);
    }
  }

  /**
   * Asigna la calificación de estrellas (1 a 5).
   */
  setRating(stars: number): void {
    this.feedbackForm.controls.rating.setValue(stars);
  }

  /**
   * Cambia la sub-vista interna y carga datos si corresponde.
   */
  async switchSubView(view: 'form' | 'history' | 'community'): Promise<void> {
    this.activeSubView.set(view);
    if (view === 'history') {
      await this.loadMyFeedback();
    } else if (view === 'community') {
      await this.loadCommunityTestimonials();
    }
  }

  /**
   * Envía el formulario a Supabase con metadatos técnicos del sistema.
   */
  async onSubmit(): Promise<void> {
    if (this.feedbackForm.invalid) {
      this.feedbackForm.markAllAsTouched();
      return;
    }

    const formVal = this.feedbackForm.getRawValue();
    if (formVal.message.trim().length < 10) {
      this.submitError.set(this.i18n.t('feedback.messageMinChars'));
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);

    const payload: CreateFeedbackPayload = {
      category: formVal.category,
      title: formVal.title.trim() || undefined,
      message: formVal.message.trim(),
      contact_email: formVal.contact_email.trim() || undefined,
      target_module: formVal.category !== 'testimonial' ? formVal.target_module : undefined,
      severity_or_priority: formVal.category !== 'testimonial' ? formVal.severity_or_priority : undefined,
      rating: formVal.category === 'testimonial' ? formVal.rating : undefined,
      author_name: formVal.category === 'testimonial' ? (formVal.author_name.trim() || undefined) : undefined,
      author_role: formVal.category === 'testimonial' ? (formVal.author_role.trim() || undefined) : undefined,
      author_location: formVal.category === 'testimonial' ? (formVal.author_location.trim() || undefined) : undefined,
      allow_public_display: formVal.category === 'testimonial' ? formVal.allow_public_display : false,
      metadata: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
        screenResolution: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A',
        devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
        language: this.i18n.currentLang(),
        timestamp: new Date().toISOString()
      }
    };

    const res = await this.supabase.submitFeedback(payload);
    this.submitting.set(false);

    if (res.success && res.data) {
      this.submitSuccess.set(res.data);
      this.myFeedbackList.update(list => [res.data!, ...list]);
      this.feedbackForm.reset({
        category: formVal.category,
        title: '',
        message: '',
        contact_email: formVal.contact_email,
        target_module: 'general',
        severity_or_priority: 'medium',
        rating: 5,
        author_name: formVal.author_name,
        author_role: formVal.author_role,
        author_location: formVal.author_location,
        allow_public_display: true
      });
    } else {
      this.submitError.set(res.error || this.i18n.t('feedback.errorGeneric'));
    }
  }

  /**
   * Restablece la vista para enviar otro reporte o feedback.
   */
  resetForm(): void {
    this.submitSuccess.set(null);
    this.submitError.set(null);
    this.activeSubView.set('form');
  }

  /**
   * Carga el historial de solicitudes enviadas por el usuario autenticado.
   */
  async loadMyFeedback(): Promise<void> {
    this.loadingHistory.set(true);
    try {
      const list = await this.supabase.getMyFeedback();
      this.myFeedbackList.set(list);
    } finally {
      this.loadingHistory.set(false);
    }
  }

  /**
   * Carga los testimonios comunitarios aprobados para la Landing Page.
   */
  async loadCommunityTestimonials(): Promise<void> {
    this.loadingCommunity.set(true);
    try {
      const list = await this.supabase.getPublicApprovedTestimonials(12);
      this.communityTestimonials.set(list);
    } finally {
      this.loadingCommunity.set(false);
    }
  }

  /**
   * Obtiene la clase visual de badge para el estado de un feedback.
   */
  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'resolved':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'in_review':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'archived':
        return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700';
      case 'open':
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800';
    }
  }

  /**
   * Obtiene la etiqueta internacionalizada del estado de un feedback.
   */
  getStatusLabel(status: string): string {
    switch (status) {
      case 'open': return this.i18n.t('feedback.statusOpen');
      case 'in_review': return this.i18n.t('feedback.statusInReview');
      case 'resolved': return this.i18n.t('feedback.statusResolved');
      case 'archived': return this.i18n.t('feedback.statusArchived');
      default: return status;
    }
  }

  /**
   * Obtiene la etiqueta internacionalizada de la categoría de un feedback.
   */
  getCategoryLabel(cat: string): string {
    switch (cat) {
      case 'bug': return this.i18n.t('feedback.catBug');
      case 'feature': return this.i18n.t('feedback.catFeature');
      case 'support': return this.i18n.t('feedback.catSupport');
      case 'testimonial': return this.i18n.t('feedback.catTestimonial');
      default: return cat;
    }
  }

  /**
   * Mapea un identificador de icono de categoría a Hugeicons oficial.
   */
  getCategoryIcon(cat: FeedbackCategory) {
    switch (cat) {
      case 'bug': return this.icons.bug;
      case 'feature': return this.icons.feature;
      case 'support': return this.icons.support;
      case 'testimonial': return this.icons.testimonial;
    }
  }
}
