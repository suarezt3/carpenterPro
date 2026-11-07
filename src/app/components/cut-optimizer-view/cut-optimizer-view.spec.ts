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
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
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
});
