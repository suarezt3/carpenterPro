import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TemplatePreview3dComponent } from './template-preview-3d';
import { Material } from '../../models/melamine.models';
import {
  FurnitureTemplate,
  TemplatesCatalogService
} from '../../services/templates-catalog.service';

interface Preview3dTestInternals {
  initThree: () => void;
}

const CUSTOM_PREVIEW_MATERIALS: Material[] = [
  {
    id: 'mat_prev_oak_18',
    name: 'Roble Europeo 18mm',
    thickness: 18,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 195000,
    hasGrain: true,
    textureType: 'wood',
    colorHex: '#c29b68',
    category: 'board'
  },
  {
    id: 'mat_prev_mdf_3',
    name: 'MDF Blanco 3mm',
    thickness: 3,
    sheetLength: 2440,
    sheetWidth: 1830,
    sheetCost: 38000,
    hasGrain: false,
    textureType: 'solid',
    colorHex: '#f4f4f5',
    category: 'mdf'
  }
];

describe('TemplatePreview3dComponent: Render Seguro en jsdom, Controles 360° y Materiales', () => {
  let fixture: ComponentFixture<TemplatePreview3dComponent>;
  let component: TemplatePreview3dComponent;
  let hostEl: HTMLElement;
  let catalogService: TemplatesCatalogService;
  let sampleTemplate: FurnitureTemplate;
  let altTemplate: FurnitureTemplate;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplatePreview3dComponent],
      providers: [TemplatesCatalogService]
    }).compileComponents();

    catalogService = TestBed.inject(TemplatesCatalogService);
    sampleTemplate =
      catalogService.getTemplateById('cajonera_3_cajones') ?? catalogService.templates[0];
    altTemplate =
      catalogService.getTemplateById('closet_corredizo_2_puertas') ??
      catalogService.templates[catalogService.templates.length - 1];
  });

  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
  });

  it('debe degradar de forma segura en jsdom sin WebGL mostrando resumen dimensional y piezas generadas', async () => {
    fixture = TestBed.createComponent(TemplatePreview3dComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('template', sampleTemplate);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    hostEl = fixture.nativeElement as HTMLElement;

    expect(component.webglUnavailable()).toBe(true);
    expect(hostEl.querySelector('.preview-stage')).toBeTruthy();
    const fallbackEl = hostEl.querySelector('.preview-fallback') as HTMLElement | null;
    expect(fallbackEl).toBeTruthy();
    expect(fallbackEl?.textContent).toContain(sampleTemplate.name);

    const expectedDims = `${sampleTemplate.dimensions.width} × ${sampleTemplate.dimensions.height} × ${sampleTemplate.dimensions.depth} mm`;
    expect(component.dimensionsLabel()).toBe(expectedDims);
    expect(fallbackEl?.textContent).toContain(expectedDims);
    expect(component.renderedPartsCount()).toBe(component.generatedParts().length);
    expect(fallbackEl?.textContent).toContain(`${component.renderedPartsCount()} piezas`);

    // Con materials vacío debe usar materiales de respaldo internos sin fallar
    expect(component.effectiveMaterials().length).toBeGreaterThan(0);
    expect(component.generatedParts().length).toBeGreaterThan(0);
  });

  it('debe usar los materiales entregados cuando no están vacíos y actualizar piezas al cambiar template', async () => {
    fixture = TestBed.createComponent(TemplatePreview3dComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('template', sampleTemplate);
    fixture.componentRef.setInput('materials', CUSTOM_PREVIEW_MATERIALS);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    hostEl = fixture.nativeElement as HTMLElement;

    expect(component.effectiveMaterials().map(m => m.id)).toEqual([
      'mat_prev_oak_18',
      'mat_prev_mdf_3'
    ]);

    const firstDims = component.dimensionsLabel();
    fixture.componentRef.setInput('template', altTemplate);
    fixture.detectChanges();

    const secondDims = `${altTemplate.dimensions.width} × ${altTemplate.dimensions.height} × ${altTemplate.dimensions.depth} mm`;
    expect(component.dimensionsLabel()).toBe(secondDims);
    if (firstDims !== secondDims) {
      expect(hostEl.textContent).toContain(secondDims);
    }
    expect(component.generatedParts().length).toBeGreaterThan(0);
  });

  it('debe sincronizar autoRotate, renderizar controles HUD 360° y resetear cámara de forma segura', () => {
    vi.spyOn(
      TemplatePreview3dComponent.prototype as unknown as Preview3dTestInternals,
      'initThree'
    ).mockImplementation(() => undefined);

    fixture = TestBed.createComponent(TemplatePreview3dComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('template', sampleTemplate);
    fixture.componentRef.setInput('autoRotate', true);
    fixture.detectChanges();
    hostEl = fixture.nativeElement as HTMLElement;

    expect(component.webglUnavailable()).toBe(false);
    expect(component.isAutoRotating()).toBe(true);

    const canvasEl = hostEl.querySelector('canvas');
    expect(canvasEl).toBeTruthy();

    const rotateBtn = hostEl.querySelector(
      'button[aria-label="Pausar rotación 360 grados"]'
    ) as HTMLButtonElement | null;
    expect(rotateBtn).toBeTruthy();
    expect(rotateBtn?.getAttribute('aria-pressed')).toBe('true');

    rotateBtn!.click();
    fixture.detectChanges();
    expect(component.isAutoRotating()).toBe(false);

    const resumeBtn = hostEl.querySelector(
      'button[aria-label="Reanudar rotación 360 grados"]'
    ) as HTMLButtonElement | null;
    expect(resumeBtn).toBeTruthy();
    expect(resumeBtn?.getAttribute('aria-pressed')).toBe('false');

    // Cambiar input autoRotate resincroniza la señal interna
    fixture.componentRef.setInput('autoRotate', false);
    fixture.detectChanges();
    expect(component.isAutoRotating()).toBe(false);
    fixture.componentRef.setInput('autoRotate', true);
    fixture.detectChanges();
    expect(component.isAutoRotating()).toBe(true);

    const resetBtn = hostEl.querySelector(
      'button[aria-label="Restablecer cámara 3D"]'
    ) as HTMLButtonElement | null;
    expect(resetBtn).toBeTruthy();
    expect(() => resetBtn!.click()).not.toThrow();

    expect(() => fixture.destroy()).not.toThrow();
  });
});
