import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LegalPageComponent } from './legal-page';
import { SupabaseService } from '../../services/supabase.service';

describe('LegalPageComponent (Centro Legal Público: /terms, /privacy, /refunds)', () => {
  let fixture: ComponentFixture<LegalPageComponent>;
  let component: LegalPageComponent;
  let router: Router;
  let mockSupabase: {
    platformSettings: ReturnType<
      typeof signal<{
        support_email: string;
        app_version: string;
      }>
    >;
    loadPlatformSettings: ReturnType<typeof vi.fn>;
  };

  function installScrollToSpy(hostEl: HTMLElement): ReturnType<typeof vi.fn> {
    const scrollToSpy = vi.fn();
    Object.defineProperty(hostEl, 'scrollTo', {
      value: scrollToSpy,
      configurable: true,
      writable: true
    });
    return scrollToSpy;
  }

  beforeEach(async () => {
    mockSupabase = {
      platformSettings: signal({
        support_email: 'eydersuarez900@gmail.com',
        app_version: 'v3.0.0'
      }),
      loadPlatformSettings: vi.fn().mockResolvedValue({})
    };

    await TestBed.configureTestingModule({
      imports: [LegalPageComponent],
      providers: [
        provideRouter([
          { path: '', component: LegalPageComponent },
          { path: 'terms', component: LegalPageComponent },
          { path: 'privacy', component: LegalPageComponent },
          { path: 'refunds', component: LegalPageComponent }
        ]),
        { provide: SupabaseService, useValue: mockSupabase }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(LegalPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente mostrando Términos y Condiciones por defecto, fecha de actualización y correo oficial', () => {
    expect(component).toBeTruthy();
    expect(component.activeDoc()).toBe('terms');

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Centro Legal y Transparencia Operativa');
    expect(el.textContent).toContain('Última actualización: Noviembre 2026');
    expect(el.textContent).toContain('eydersuarez900@gmail.com');
    expect(el.querySelector('[data-testid="legal-back-home-btn"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="legal-content-terms"]')).toBeTruthy();
  });

  it('debe activar automáticamente la pestaña correspondiente y hacer scroll suave al inicio al navegar a /privacy, /refunds y /terms', async () => {
    const el = fixture.nativeElement as HTMLElement;
    const scrollToSpy = installScrollToSpy(el);

    await router.navigateByUrl('/privacy');
    fixture.detectChanges();
    expect(component.activeDoc()).toBe('privacy');
    expect(el.querySelector('[data-testid="legal-content-privacy"]')).toBeTruthy();
    expect(el.textContent).toContain('PCI-DSS Nivel 1');
    expect(el.textContent).toContain('jamás almacena');
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

    await router.navigateByUrl('/refunds');
    fixture.detectChanges();
    expect(component.activeDoc()).toBe('refunds');
    expect(el.querySelector('[data-testid="legal-content-refunds"]')).toBeTruthy();
    expect(el.textContent).toContain('7 días calendario');
    expect(el.textContent).toContain('24 a 48 horas hábiles');
    expect(el.textContent).toContain('Envía tu Solicitud');
    expect(el.textContent).toContain('Datos de la Cuenta');
    expect(el.textContent).toContain('Resolución en 24-48 h');
    expect(scrollToSpy).toHaveBeenCalledTimes(2);

    await router.navigateByUrl('/terms');
    fixture.detectChanges();
    expect(component.activeDoc()).toBe('terms');
    expect(el.querySelector('[data-testid="legal-content-terms"]')).toBeTruthy();
    expect(el.textContent).toContain('100% de la titularidad y propiedad intelectual');
    expect(scrollToSpy).toHaveBeenCalledTimes(3);
  });

  it('debe permitir alternar entre las 3 pestañas mediante selectDoc() y botones de pestaña ejecutando scroll suave', () => {
    const el = fixture.nativeElement as HTMLElement;
    const scrollToSpy = installScrollToSpy(el);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const privacyTab = el.querySelector<HTMLButtonElement>('[data-testid="legal-tab-privacy"]');
    expect(privacyTab).toBeTruthy();
    privacyTab?.click();
    fixture.detectChanges();
    expect(component.activeDoc()).toBe('privacy');
    expect(navigateSpy).toHaveBeenCalledWith('/privacy');
    expect(el.querySelector('[data-testid="legal-content-privacy"]')).toBeTruthy();
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

    const refundsTab = el.querySelector<HTMLButtonElement>('[data-testid="legal-tab-refunds"]');
    expect(refundsTab).toBeTruthy();
    refundsTab?.click();
    fixture.detectChanges();
    expect(component.activeDoc()).toBe('refunds');
    expect(navigateSpy).toHaveBeenCalledWith('/refunds');
    expect(el.querySelector('[data-testid="legal-content-refunds"]')).toBeTruthy();
    expect(scrollToSpy).toHaveBeenCalledTimes(2);

    component.selectDoc('terms');
    fixture.detectChanges();
    expect(component.activeDoc()).toBe('terms');
    expect(el.querySelector('[data-testid="legal-content-terms"]')).toBeTruthy();
    expect(scrollToSpy).toHaveBeenCalledTimes(3);
    expect(scrollToSpy).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('debe incluir en el footer enlaces directos a /terms, /privacy, /refunds, botón de volver arriba y retorno a Landing (/)', () => {
    const el = fixture.nativeElement as HTMLElement;
    const scrollToSpy = installScrollToSpy(el);

    const footer = el.querySelector('[data-testid="legal-footer"]');
    expect(footer).toBeTruthy();

    const termsLink = el.querySelector<HTMLAnchorElement>('[data-testid="legal-footer-link-terms"]');
    const privacyLink = el.querySelector<HTMLAnchorElement>('[data-testid="legal-footer-link-privacy"]');
    const refundsLink = el.querySelector<HTMLAnchorElement>('[data-testid="legal-footer-link-refunds"]');
    const homeLink = el.querySelector<HTMLAnchorElement>('[data-testid="legal-footer-home-btn"]');
    const backToTopBtn = el.querySelector<HTMLButtonElement>('[data-testid="legal-back-to-top-btn"]');

    expect(termsLink?.getAttribute('href')).toBe('/terms');
    expect(privacyLink?.getAttribute('href')).toBe('/privacy');
    expect(refundsLink?.getAttribute('href')).toBe('/refunds');
    expect(homeLink?.getAttribute('href')).toBe('/');
    expect(backToTopBtn).toBeTruthy();
    expect(backToTopBtn?.textContent).toContain('Volver arriba');

    backToTopBtn?.click();
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

    privacyLink?.click();
    fixture.detectChanges();
    expect(component.activeDoc()).toBe('privacy');
    expect(scrollToSpy).toHaveBeenCalledTimes(2);
    expect(scrollToSpy).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('debe reiniciar scrollTop a 0 como respaldo seguro cuando scrollTo no está disponible', () => {
    const el = fixture.nativeElement as HTMLElement;
    Object.defineProperty(el, 'scrollTo', {
      value: undefined,
      configurable: true,
      writable: true
    });
    el.scrollTop = 320;

    component.scrollToTop();
    expect(el.scrollTop).toBe(0);
  });

  it('debe mantener estructura de scroll sin overflow-hidden ni h-screen restrictivo, cabecera sticky e iconos Hugeicons puros', () => {
    const el = fixture.nativeElement as HTMLElement;
    const container = el.querySelector<HTMLElement>('[data-testid="legal-page-container"]');
    const header = el.querySelector<HTMLElement>('header');

    expect(container).toBeTruthy();
    expect(container?.classList.contains('overflow-hidden')).toBe(false);
    expect(container?.classList.contains('h-screen')).toBe(false);
    expect(container?.classList.contains('min-h-screen')).toBe(true);
    expect(container?.classList.contains('w-full')).toBe(true);
    expect(container?.classList.contains('pb-28')).toBe(true);

    expect(header?.classList.contains('sticky')).toBe(true);
    expect(header?.classList.contains('top-0')).toBe(true);
    expect(header?.classList.contains('z-30')).toBe(true);
    expect(header?.classList.contains('bg-white/95')).toBe(true);
    expect(header?.classList.contains('backdrop-blur-xs')).toBe(true);
    expect(header?.classList.contains('border-b')).toBe(true);
    expect(header?.classList.contains('border-zinc-200')).toBe(true);

    const allSvgs = el.querySelectorAll('svg');
    const hugeiconsSvgs = el.querySelectorAll('hugeicons-icon svg');
    expect(allSvgs.length).toBe(hugeiconsSvgs.length);
  });

  it('debe reflejar dinámicamente el correo de soporte desde platformSettings y mantener privacidad de infraestructura', () => {
    mockSupabase.platformSettings.set({
      support_email: 'soporte@piezo3d.com',
      app_version: 'v3.1.0'
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(component.supportEmail()).toBe('soporte@piezo3d.com');
    expect(el.textContent).toContain('soporte@piezo3d.com');

    for (const doc of ['terms', 'privacy', 'refunds'] as const) {
      component.selectDoc(doc);
      fixture.detectChanges();
      const lower = (el.textContent ?? '').toLowerCase();
      expect(lower).not.toContain('carpenterpro');
      expect(lower).not.toContain('supabase');
      expect(lower).not.toContain('postgres');
      expect(lower).not.toContain('postgresql');
      expect(lower).not.toContain('uuid');
    }
  });
});
