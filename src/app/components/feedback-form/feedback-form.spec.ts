import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeedbackFormComponent } from './feedback-form';
import { SupabaseService } from '../../services/supabase.service';
import { I18nService } from '../../services/i18n.service';
import { ThemeService } from '../../services/theme.service';
import { UserFeedbackRecord } from '../../models/feedback.models';
import { QuoteUpIcon, BookOpen01Icon, StarIcon } from '@hugeicons/core-free-icons';

describe('FeedbackFormComponent — Soporte, Bugs, Sugerencias y Testimonios con Supabase', () => {
  let component: FeedbackFormComponent;
  let fixture: ComponentFixture<FeedbackFormComponent>;
  let supabaseMock: {
    submitFeedback: ReturnType<typeof vi.fn>;
    getMyFeedback: ReturnType<typeof vi.fn>;
    getPublicApprovedTestimonials: ReturnType<typeof vi.fn>;
    isAuthenticated: ReturnType<typeof vi.fn>;
    currentUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    supabaseMock = {
      submitFeedback: vi.fn(),
      getMyFeedback: vi.fn().mockResolvedValue([]),
      getPublicApprovedTestimonials: vi.fn().mockResolvedValue([]),
      isAuthenticated: vi.fn().mockReturnValue(false),
      currentUser: vi.fn().mockReturnValue(null)
    };

    await TestBed.configureTestingModule({
      imports: [FeedbackFormComponent],
      providers: [
        { provide: SupabaseService, useValue: supabaseMock },
        I18nService,
        ThemeService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FeedbackFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente con los estados por defecto (categoría bug, rating 5)', () => {
    expect(component).toBeTruthy();
    expect(component.selectedCategory()).toBe('bug');
    expect(component.isTestimonial()).toBe(false);
    expect(component.submitting()).toBe(false);
    expect(component.submitSuccess()).toBeNull();
    expect(component.submitError()).toBeNull();
  });

  describe('Conmutación Dinámica de Categorías', () => {
    it('al seleccionar testimonial debe activar isTestimonial, default rating 5 y display público', () => {
      component.setCategory('testimonial');
      fixture.detectChanges();

      expect(component.selectedCategory()).toBe('testimonial');
      expect(component.isTestimonial()).toBe(true);
      expect(component.feedbackForm.controls.rating.value).toBe(5);
      expect(component.feedbackForm.controls.allow_public_display.value).toBe(true);
      expect(component.isAutoApprovedEligible()).toBe(true);
    });

    it('al cambiar a feature o support debe actualizar la categoría en el signal y el form', () => {
      component.setCategory('feature');
      expect(component.selectedCategory()).toBe('feature');
      expect(component.feedbackForm.controls.category.value).toBe('feature');
      expect(component.isTestimonial()).toBe(false);

      component.setCategory('support');
      expect(component.selectedCategory()).toBe('support');
      expect(component.feedbackForm.controls.category.value).toBe('support');
    });
  });

  describe('Lógica de Auto-Aprobación para Testimonios (4 y 5 Estrellas)', () => {
    beforeEach(() => {
      component.setCategory('testimonial');
    });

    it('con 5 estrellas y display público autorizado debe ser elegible para auto-aprobación', () => {
      component.setRating(5);
      component.feedbackForm.controls.allow_public_display.setValue(true);
      expect(component.isAutoApprovedEligible()).toBe(true);
    });

    it('con 4 estrellas y display público autorizado debe ser elegible para auto-aprobación', () => {
      component.setRating(4);
      component.feedbackForm.controls.allow_public_display.setValue(true);
      expect(component.isAutoApprovedEligible()).toBe(true);
    });

    it('con 3 estrellas o menos NO debe ser elegible para auto-aprobación (requiere revisión)', () => {
      component.setRating(3);
      component.feedbackForm.controls.allow_public_display.setValue(true);
      expect(component.isAutoApprovedEligible()).toBe(false);

      component.setRating(2);
      expect(component.isAutoApprovedEligible()).toBe(false);
    });

    it('si el usuario desmarca la autorización pública, NO es elegible para auto-aprobación', () => {
      component.setRating(5);
      component.feedbackForm.controls.allow_public_display.setValue(false);
      expect(component.isAutoApprovedEligible()).toBe(false);
    });
  });

  describe('Validación de Mensaje (Mínimo 10 caracteres)', () => {
    it('un mensaje con menos de 10 caracteres debe ser inválido', () => {
      component.feedbackForm.controls.message.setValue('Hola');
      expect(component.feedbackForm.controls.message.valid).toBe(false);
      expect(component.messageCharCount()).toBe(4);
    });

    it('un mensaje con 10 o más caracteres debe ser válido', () => {
      component.feedbackForm.controls.message.setValue('1234567890');
      expect(component.feedbackForm.controls.message.valid).toBe(true);
      expect(component.messageCharCount()).toBe(10);
    });
  });

  describe('Envío del Formulario a Supabase', () => {
    it('debe enviar los datos correctamente a SupabaseService y actualizar el estado de éxito', async () => {
      const mockRecord: UserFeedbackRecord = {
        id: 'test-uuid-1234',
        user_id: null,
        category: 'testimonial',
        title: 'Excelente software',
        message: 'CarpenterPro me ayudó muchísimo en mi carpintería!',
        rating: 5,
        allow_public_display: true,
        is_approved_public: true,
        app_version: 'v3.0.0',
        app_language: 'es',
        metadata: {},
        status: 'open',
        created_at: new Date().toISOString()
      };

      supabaseMock.submitFeedback.mockResolvedValue({
        success: true,
        data: mockRecord
      });

      component.setCategory('testimonial');
      component.feedbackForm.controls.title.setValue('Excelente software');
      component.feedbackForm.controls.message.setValue('CarpenterPro me ayudó muchísimo en mi carpintería!');
      component.setRating(5);
      component.feedbackForm.controls.author_name.setValue('Juan Carpintero');

      await component.onSubmit();

      expect(supabaseMock.submitFeedback).toHaveBeenCalledTimes(1);
      expect(component.submitSuccess()).toEqual(mockRecord);
      expect(component.submitting()).toBe(false);
    });

    it('si Supabase responde con error, debe mostrar el mensaje en submitError', async () => {
      supabaseMock.submitFeedback.mockResolvedValue({
        success: false,
        error: 'Error de conexión con Supabase'
      });

      component.setCategory('bug');
      component.feedbackForm.controls.message.setValue('El optimizador falla al girar piezas.');

      await component.onSubmit();

      expect(component.submitSuccess()).toBeNull();
      expect(component.submitError()).toBe('Error de conexión con Supabase');
      expect(component.submitting()).toBe(false);
    });

    it('al enviar con éxito debe incorporar el registro a myFeedbackList en memoria local', async () => {
      const mockRecord: UserFeedbackRecord = {
        id: 'ticket-999',
        user_id: null,
        category: 'bug',
        title: 'Error de cálculo',
        message: 'El optimizador no rota la placa adecuadamente.',
        rating: null,
        allow_public_display: false,
        is_approved_public: false,
        app_version: 'v3.0.0',
        app_language: 'es',
        metadata: {},
        status: 'open',
        created_at: new Date().toISOString()
      };

      supabaseMock.submitFeedback.mockResolvedValue({
        success: true,
        data: mockRecord
      });

      component.setCategory('bug');
      component.feedbackForm.controls.message.setValue('El optimizador no rota la placa adecuadamente.');

      await component.onSubmit();

      expect(component.myFeedbackList()).toContain(mockRecord);
      expect(component.myFeedbackList()[0].id).toBe('ticket-999');
    });

    it('si el correo es inválido, el formulario debe marcarse inválido y no llamar a Supabase', async () => {
      component.feedbackForm.controls.contact_email.setValue('correo-invalido-sin-arroba');
      component.feedbackForm.controls.message.setValue('Mensaje válido de más de diez caracteres.');

      await component.onSubmit();

      expect(supabaseMock.submitFeedback).not.toHaveBeenCalled();
      expect(component.feedbackForm.controls.contact_email.invalid).toBe(true);
    });
  });

  describe('Internacionalización de Categorías y Estados', () => {
    it('getCategoryLabel debe retornar la traducción correspondiente a cada categoría', () => {
      expect(component.getCategoryLabel('bug')).toBeTruthy();
      expect(component.getCategoryLabel('feature')).toBeTruthy();
      expect(component.getCategoryLabel('support')).toBeTruthy();
      expect(component.getCategoryLabel('testimonial')).toBeTruthy();
    });

    it('getStatusLabel debe retornar la traducción adecuada para cada estado del ticket', () => {
      expect(component.getStatusLabel('open')).toBeTruthy();
      expect(component.getStatusLabel('in_review')).toBeTruthy();
      expect(component.getStatusLabel('resolved')).toBeTruthy();
      expect(component.getStatusLabel('archived')).toBeTruthy();
    });
  });

  describe('Sub-Vistas: Historial de Usuario y Comunidad', () => {
    it('al cambiar a la vista de historial debe consultar getMyFeedback', async () => {
      await component.switchSubView('history');
      expect(component.activeSubView()).toBe('history');
      expect(supabaseMock.getMyFeedback).toHaveBeenCalled();
    });

    it('al cambiar a la vista de comunidad debe consultar getPublicApprovedTestimonials', async () => {
      await component.switchSubView('community');
      expect(component.activeSubView()).toBe('community');
      expect(supabaseMock.getPublicApprovedTestimonials).toHaveBeenCalled();
    });

    it('resetForm debe restablecer el estado a form limpio', () => {
      component.submitSuccess.set({} as UserFeedbackRecord);
      component.submitError.set('error previo');
      component.resetForm();

      expect(component.submitSuccess()).toBeNull();
      expect(component.submitError()).toBeNull();
      expect(component.activeSubView()).toBe('form');
    });

    it('en el estado vacío de mis envíos, el botón debe conmutar a la vista de formulario', () => {
      component.activeSubView.set('history');
      component.myFeedbackList.set([]);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const buttons = Array.from(compiled.querySelectorAll('button'));
      const createBtn = buttons.find(b => b.textContent?.includes('Crear Nueva Solicitud') || b.textContent?.includes('Create New Request'));
      expect(createBtn).toBeTruthy();

      createBtn?.click();
      fixture.detectChanges();

      expect(component.activeSubView()).toBe('form');
    });
  });

  describe('Auditoría UI: Iconografía 100% Hugeicons, Estrellas y Tipografía Unificada', () => {
    it('todas las categorías deben retornar iconos válidos de Hugeicons y testimonial debe ser QuoteUpIcon', () => {
      const categories: ('bug' | 'feature' | 'support' | 'testimonial')[] = ['bug', 'feature', 'support', 'testimonial'];
      for (const cat of categories) {
        const iconDef = component.getCategoryIcon(cat);
        expect(iconDef).toBeDefined();
        expect(Array.isArray(iconDef)).toBe(true);
      }
      expect(component.getCategoryIcon('testimonial')).toBe(QuoteUpIcon);
      expect(component.icons.quote).toBe(QuoteUpIcon);
      expect(component.icons.book).toBe(BookOpen01Icon);
      expect(component.icons.star).toBe(StarIcon);
    });

    it('en categoría testimonial debe renderizar 5 botones de estrellas con clases activa e inactiva', () => {
      component.setCategory('testimonial');
      component.setRating(3);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const starActiveButtons = compiled.querySelectorAll('.star-active');
      const starInactiveButtons = compiled.querySelectorAll('.star-inactive');

      expect(starActiveButtons.length).toBe(3);
      expect(starInactiveButtons.length).toBe(2);
    });

    it('el formulario no debe contener clases font-mono en contadores de caracteres ni en el ticket de éxito', () => {
      const compiled = fixture.nativeElement as HTMLElement;
      const monoElements = compiled.querySelectorAll('.font-mono');
      expect(monoElements.length).toBe(0);
    });

    it('el banner de la comunidad debe usar estilo neutral y alternar entre publicación directa y revisión privada', () => {
      component.setCategory('testimonial');
      component.setRating(5);
      component.feedbackForm.controls.allow_public_display.setValue(true);
      fixture.detectChanges();

      let compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.bg-emerald-50')).toBeFalsy();
      expect(compiled.querySelector('.bg-slate-50')).toBeTruthy();

      // Al bajar a 3 estrellas, se mantiene el diseño neutral y alterna al texto de revisión técnica
      component.setRating(3);
      fixture.detectChanges();

      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.bg-emerald-50')).toBeFalsy();
      expect(compiled.querySelector('.bg-slate-50')).toBeTruthy();
    });
  });
});

