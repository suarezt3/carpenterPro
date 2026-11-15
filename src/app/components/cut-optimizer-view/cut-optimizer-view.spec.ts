import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CutOptimizerViewComponent } from './cut-optimizer-view';
import { ProjectStorageService } from '../../services/project-storage.service';
import { CutOptimizerService } from '../../services/cut-optimizer.service';
import { ThemeService } from '../../services/theme.service';

describe('CutOptimizerViewComponent (Impresión y Ajuste de Diagrama 2D)', () => {
  let component: CutOptimizerViewComponent;
  let fixture: ComponentFixture<CutOptimizerViewComponent>;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [CutOptimizerViewComponent],
      providers: [
        ProjectStorageService,
        CutOptimizerService,
        ThemeService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CutOptimizerViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debe contener las clases de impresión adecuadas en el contenedor de tablero', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const kpiBanner = compiled.querySelector('.optimizer-kpi-banner');
    if (kpiBanner) {
      expect(kpiBanner.classList.contains('print:hidden')).toBe(true);
    }
  });

  it('debe restablecer el nivel de zoom a 1.0 al invocar resetZoom', () => {
    component.zoomIn();
    expect(component.zoomLevel()).toBeGreaterThan(1.0);
    component.resetZoom();
    expect(component.zoomLevel()).toBe(1.0);
  });

  it('debe cerrar el menú de descarga y restablecer el zoom al invocar printCurrentSheet', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    component.zoomIn();
    expect(component.zoomLevel()).toBeGreaterThan(1.0);

    component.printCurrentSheet();
    expect(component.zoomLevel()).toBe(1.0);

    vi.advanceTimersByTime(200);
    expect(printSpy).toHaveBeenCalled();
  });

  it('debe alternar la sustracción de tapacantos', () => {
    const initial = component.subtractEdgeBanding();
    component.toggleSubtractEdgeBanding();
    expect(component.subtractEdgeBanding()).toBe(!initial);
  });

  it('debe seleccionar pestañas de tableros correctamente', () => {
    const sheets = component.optimizationResult().sheets;
    if (sheets.length > 1) {
      component.selectSheet(1);
      expect(component.selectedSheetIndex()).toBe(1);
    }
  });

  it('debe incluir los enlaces del favicon oficial de Piezo3D al abrir la pestaña PDF de corte', async () => {
    expect(component.currentSheet()).not.toBeNull();

    const renderedSvg = (fixture.nativeElement as HTMLElement).querySelector('#sheet-cut-diagram-svg');
    expect(renderedSvg).not.toBeNull();

    const originalGetById = document.getElementById.bind(document);
    const getByIdSpy = originalGetById('sheet-cut-diagram-svg')
      ? null
      : vi.spyOn(document, 'getElementById').mockImplementation((id: string) =>
          id === 'sheet-cut-diagram-svg' ? (renderedSvg as HTMLElement) : originalGetById(id)
        );

    const writeSpy = vi.fn();
    const closeSpy = vi.fn();
    const mockPrintWindow = {
      document: {
        write: writeSpy,
        close: closeSpy
      }
    } as unknown as Window;
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(mockPrintWindow);

    try {
      await component.downloadCurrentSheetAsPdf();

      expect(openSpy).toHaveBeenCalledWith('', '_blank');
      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(closeSpy).toHaveBeenCalledTimes(1);
      expect(component.isExporting()).toBe(false);

      const html = String(writeSpy.mock.calls[0][0]);
      const expectedOrigin =
        typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null'
          ? window.location.origin.replace(/\/+$/, '')
          : '';

      expect(html).not.toContain('href="null/');
      expect(html).toContain(`<link rel="icon" type="image/x-icon" href="${expectedOrigin}/favicon.ico" />`);
      expect(html).toContain(`<link rel="shortcut icon" type="image/x-icon" href="${expectedOrigin}/favicon.ico" />`);
      expect(html).toContain(
        `<link rel="icon" type="image/png" sizes="32x32" href="${expectedOrigin}/assets/favicon-32x32.png" />`
      );

      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const headLinks = Array.from(parsed.head.querySelectorAll('link')).map(link => ({
        rel: link.getAttribute('rel'),
        type: link.getAttribute('type'),
        sizes: link.getAttribute('sizes'),
        href: link.getAttribute('href')
      }));

      expect(headLinks).toEqual([
        {
          rel: 'icon',
          type: 'image/x-icon',
          sizes: null,
          href: `${expectedOrigin}/favicon.ico`
        },
        {
          rel: 'shortcut icon',
          type: 'image/x-icon',
          sizes: null,
          href: `${expectedOrigin}/favicon.ico`
        },
        {
          rel: 'icon',
          type: 'image/png',
          sizes: '32x32',
          href: `${expectedOrigin}/assets/favicon-32x32.png`
        }
      ]);
    } finally {
      openSpy.mockRestore();
      getByIdSpy?.mockRestore();
    }
  });
});
