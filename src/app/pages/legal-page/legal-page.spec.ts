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

  it('debe activar automáticamente la pestaña correspondiente al navegar a /privacy, /refunds y /terms', async () => {
    await router.navigateByUrl('/privacy');
    fixture.detectChanges();
    expect(component.activeDoc()).toBe('privacy');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="legal-content-privacy"]')).toBeTruthy();
    expect(el.textContent).toContain('PCI-DSS Nivel 1');
    expect(el.textContent).toContain('jamás almacena');

    await router.navigateByUrl('/refunds');
    fixture.detectChanges();
    expect(component.activeDoc()).toBe('refunds');
    expect(el.querySelector('[data-testid="legal-content-refunds"]')).toBeTruthy();
    expect(el.textContent).toContain('7 días calendario');
    expect(el.textContent).toContain('24 a 48 horas hábiles');

    await router.navigateByUrl('/terms');
    fixture.detectChanges();
    expect(component.activeDoc()).toBe('terms');
    expect(el.querySelector('[data-testid="legal-content-terms"]')).toBeTruthy();
    expect(el.textContent).toContain('100% de la titularidad y propiedad intelectual');
  });

  it('debe permitir alternar entre las 3 secciones mediante selectDoc() y actualizar el contenido legal', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.selectDoc('privacy');
    fixture.detectChanges();
    expect(component.activeDoc()).toBe('privacy');
    expect(navigateSpy).toHaveBeenCalledWith('/privacy');
    expect(fixture.nativeElement.querySelector('[data-testid="legal-content-privacy"]')).toBeTruthy();

    component.selectDoc('refunds');
    fixture.detectChanges();
    expect(component.activeDoc()).toBe('refunds');
    expect(navigateSpy).toHaveBeenCalledWith('/refunds');
    expect(fixture.nativeElement.querySelector('[data-testid="legal-content-refunds"]')).toBeTruthy();

    component.selectDoc('terms');
    fixture.detectChanges();
    expect(component.activeDoc()).toBe('terms');
    expect(fixture.nativeElement.querySelector('[data-testid="legal-content-terms"]')).toBeTruthy();
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
      expect(lower).not.toContain('supabase');
      expect(lower).not.toContain('postgres');
      expect(lower).not.toContain('uuid');
    }
  });
});
