import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BudgetViewComponent } from './budget-view';
import { ProjectStorageService } from '../../services/project-storage.service';
import { CurrencyExchangeService } from '../../services/currency-exchange.service';
import { ThemeService } from '../../services/theme.service';
import { CutOptimizerService } from '../../services/cut-optimizer.service';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { I18nService } from '../../services/i18n.service';
import { Material, Part } from '../../models/melamine.models';

describe('BudgetViewComponent (Conversión Real de Moneda y Formato de Precio Unitario)', () => {
  let component: BudgetViewComponent;
  let fixture: ComponentFixture<BudgetViewComponent>;
  let projectService: ProjectStorageService;
  let exchangeService: CurrencyExchangeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BudgetViewComponent],
      providers: [
        ProjectStorageService,
        CurrencyExchangeService,
        ThemeService,
        CutOptimizerService,
        HardwareCatalogService,
        ConfirmDialogService
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetViewComponent);
    component = fixture.componentInstance;
    projectService = TestBed.inject(ProjectStorageService);
    exchangeService = TestBed.inject(CurrencyExchangeService);
    fixture.detectChanges();
  });

  it('debe crearse e inicializar las tasas de cambio', () => {
    expect(component).toBeTruthy();
    expect(exchangeService.rates()['COP']).toBe(1);
    expect(exchangeService.rates()['USD']).toBeGreaterThan(0);
  });

  describe('1. Formato de Precios Unitarios y Separadores de Miles en COP', () => {
    beforeEach(() => {
      projectService.updateCurrency('COP');
      fixture.detectChanges();
    });

    it('debe formatear precios unitarios con puntos separadores de miles en COP', () => {
      expect(component.formatUnitPrice(195000)).toBe('$ 195.000');
      expect(component.formatUnitPrice(215000)).toBe('$ 215.000');
      expect(component.formatUnitPrice(145000)).toBe('$ 145.000');
      expect(component.formatUnitPrice(45000)).toBe('$ 45.000');
      expect(component.formatUnitPrice(0)).toBe('$ 0');
    });

    it('format debe devolver el valor con código COP y separadores de miles', () => {
      expect(component.format(990000)).toBe('$ 990.000 COP');
      expect(component.format(195000)).toBe('$ 195.000 COP');
    });
  });

  describe('2. Conversión Real Matemática al Cambiar a USD y MXN', () => {
    it('al cambiar a USD, format y formatUnitPrice deben convertir el monto real base COP', () => {
      projectService.updateCurrency('USD');
      fixture.detectChanges();

      // 425,000 COP con tasa de 1/4250 debe ser exactamente 100 USD
      expect(component.format(425000)).toBe('$ 100.00 USD');
      expect(component.formatUnitPrice(425000)).toBe('$ 100.00');

      // Un tablero de 195,000 COP debe convertirse a ~45.88 USD
      const unitPriceUsd = component.formatUnitPrice(195000);
      expect(unitPriceUsd).toContain('$');
      expect(unitPriceUsd).toContain('.');
      const numericPart = parseFloat(unitPriceUsd.replace('$', '').trim());
      expect(numericPart).toBeGreaterThan(40);
      expect(numericPart).toBeLessThan(50);
    });

    it('al cambiar a MXN, format y formatUnitPrice deben convertir a pesos mexicanos', () => {
      projectService.updateCurrency('MXN');
      fixture.detectChanges();

      // 212,000 COP con tasa de 1/212 debe ser 1,000 MXN
      expect(component.format(212000)).toBe('$ 1,000.00 MXN');
      expect(component.formatUnitPrice(212000)).toBe('$ 1,000.00');

      // Un tablero de 195,000 COP debe ser ~919.81 MXN
      const unitPriceMxn = component.formatUnitPrice(195000);
      expect(unitPriceMxn).toContain('$');
      const numericPart = parseFloat(unitPriceMxn.replace('$', '').replace(/,/g, '').trim());
      expect(numericPart).toBeGreaterThan(850);
      expect(numericPart).toBeLessThan(1000);
    });

    it('getInverseRateDisplay debe mostrar la pastilla informativa correspondiente', () => {
      expect(exchangeService.getInverseRateDisplay('COP')).toBe('Moneda Base (COP)');
      expect(exchangeService.getInverseRateDisplay('USD')).toBe('1 USD = $ 4.250 COP');
      expect(exchangeService.getInverseRateDisplay('MXN')).toBe('1 MXN = $ 212 COP');
    });
  });

  describe('3. Edición de Precios Unitarios y Conversión Bidireccional a COP', () => {
    it('parseCleanNumber debe limpiar símbolos y separadores de miles/decimales', () => {
      projectService.updateCurrency('COP');
      expect(component.parseCleanNumber('$ 195.000')).toBe(195000);
      expect(component.parseCleanNumber('195000')).toBe(195000);
      expect(component.parseCleanNumber('1.500.000')).toBe(1500000);

      projectService.updateCurrency('USD');
      expect(component.parseCleanNumber('$ 45.88')).toBe(45.88);
      expect(component.parseCleanNumber('45.88')).toBe(45.88);
      expect(component.parseCleanNumber('1,250.50')).toBe(1250.50);
      expect(component.parseCleanNumber('1,500,000')).toBe(1500000);
      expect(component.parseCleanNumber('1,234,567.89')).toBe(1234567.89);
      expect(component.parseCleanNumber('')).toBe(0);
      expect(component.parseCleanNumber('invalido')).toBe(0);

      projectService.updateCurrency('EUR');
      expect(component.parseCleanNumber('195.000')).toBe(195000);
      expect(component.parseCleanNumber('1.500.000')).toBe(1500000);
      expect(component.parseCleanNumber('1.234.567,89')).toBe(1234567.89);
    });

    it('al hacer focus y blur sin modificar el texto, no debe corromper ni producir drift en el precio base COP', () => {
      projectService.updateCurrency('USD');
      fixture.detectChanges();

      const testMat = component.materials()[0];
      const originalCop = testMat.sheetCost; // ej. 195000 COP

      // Simulamos elemento input real
      const inputEl = document.createElement('input');
      const focusEvent = { target: inputEl } as unknown as FocusEvent;

      // Focus: input muestra el valor convertido a USD
      component.onPriceFocus(focusEvent, originalCop);
      expect(inputEl.dataset['initialRaw']).toBeDefined();

      // Blur sin editar el valor
      component.onMaterialPriceBlur(testMat, focusEvent);

      // El costo base del material debe permanecer exactamente igual
      const checkMat = component.materials().find(m => m.id === testMat.id)!;
      expect(checkMat.sheetCost).toBe(originalCop);
      expect(inputEl.value).toBe(component.formatUnitPrice(originalCop));
    });

    it('editar un herraje calculado automáticamente debe persistir en projectService y reflejarse en allHardware', () => {
      const autoItems = component.autoHardware();
      if (autoItems.length > 0) {
        const firstAuto = autoItems[0];
        const newCost = 15000;
        component.updateHardwareCost(firstAuto, newCost);
        fixture.detectChanges();

        const storedHw = projectService.hardwareList().find(h => h.id === firstAuto.id);
        expect(storedHw).toBeDefined();
        expect(storedHw?.unitCost).toBe(newCost);

        const updatedInAll = component.allHardware().find(h => h.id === firstAuto.id);
        expect(updatedInAll?.unitCost).toBe(newCost);
      }
    });

    it('editar un precio unitario en USD debe almacenarse en COP y recalcular subtotales', () => {
      projectService.updateCurrency('USD');
      fixture.detectChanges();

      const testMat = component.materials()[0];

      // El usuario escribe 100 USD en el input de precio unitario
      const userEnteredUsd = 100;
      const calculatedCop = exchangeService.convertToCop(userEnteredUsd, 'USD');
      expect(calculatedCop).toBe(425000);

      // Simulamos la llamada de blur
      component.updateMaterialCost(testMat, calculatedCop);
      fixture.detectChanges();

      // En el almacenamiento interno el material ahora vale 425,000 COP
      const updatedMat = component.materials().find(m => m.id === testMat.id)!;
      expect(updatedMat.sheetCost).toBe(425000);

      // Al mostrarlo en USD en la tabla, se muestra como $ 100.00
      expect(component.formatUnitPrice(updatedMat.sheetCost)).toBe('$ 100.00');

      // Si cambiamos la moneda a COP, se muestra exactamente como $ 425.000 COP
      projectService.updateCurrency('COP');
      fixture.detectChanges();
      expect(component.formatUnitPrice(updatedMat.sheetCost)).toBe('$ 425.000');
      expect(component.format(updatedMat.sheetCost)).toBe('$ 425.000 COP');
    });
  });

  describe('4. Toggle Incluir / Excluir para Mesones de Piedra y Cotización PDF', () => {
    let i18nService: I18nService;

    const melamineMat: Material = {
      id: 'mat_mel_test_18',
      name: 'Melamina Roble Test 18mm',
      thickness: 18,
      sheetLength: 2440,
      sheetWidth: 1830,
      sheetCost: 200000,
      hasGrain: true,
      colorHex: '#a16207',
      category: 'board',
      textureType: 'wood',
      family: 'wood_medium'
    };

    const stoneMat: Material = {
      id: 'mat_stone_carrara_test',
      name: 'Piedra Mármol Test (Mesón)',
      thickness: 30,
      sheetLength: 3000,
      sheetWidth: 1600,
      sheetCost: 1440000, // 4.8 m² -> exactamente $300.000 COP / m²
      hasGrain: false,
      colorHex: '#f1f5f9',
      textureType: 'stone',
      family: 'stone_countertop',
      category: 'countertop'
    };

    const createStoneScenarioParts = (): Part[] => [
      {
        id: 'mel_part_1',
        name: 'Repisa Test',
        groupId: 'grp_mod_1',
        groupName: 'Módulo Base Test',
        length: 1000,
        width: 500,
        thickness: 18,
        quantity: 1,
        materialId: melamineMat.id,
        materialName: melamineMat.name,
        grain: 'length',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 400,
        posZ: 0,
        orientation: 'horizontal',
        componentRole: 'shelf'
      },
      {
        id: 'stone_main_1',
        name: 'Mesón Principal de Cocina',
        groupId: 'grp_stone_1',
        groupName: 'Mesón Piedra Cocina',
        length: 2000,
        width: 600, // 1.20 m² -> $360.000 COP
        thickness: 30,
        quantity: 1,
        materialId: stoneMat.id,
        materialName: stoneMat.name,
        colorHex: stoneMat.colorHex,
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 875,
        posZ: 0,
        orientation: 'horizontal',
        componentRole: 'countertop',
        excludeFromCutlist: true
      },
      {
        id: 'stone_splash_1',
        name: 'Zócalo / Salpicadero Posterior Mesón',
        groupId: 'grp_stone_1',
        groupName: 'Mesón Piedra Cocina',
        length: 2000,
        width: 100, // 0.20 m² -> $60.000 COP
        thickness: 20,
        quantity: 1,
        materialId: stoneMat.id,
        materialName: stoneMat.name,
        colorHex: stoneMat.colorHex,
        grain: 'none',
        edges: { l1: 'none', l2: 'none', a1: 'none', a2: 'none' },
        posX: 0,
        posY: 940.5,
        posZ: -290,
        orientation: 'vertical_xy',
        componentRole: 'backsplash',
        excludeFromCutlist: true
      }
    ];

    beforeEach(() => {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }
      i18nService = TestBed.inject(I18nService);
      i18nService.setLanguage('es');

      projectService.updateProject(p => ({
        ...p,
        materials: [melamineMat, stoneMat],
        modules: [],
        groups: [
          {
            id: 'grp_stone_1',
            name: 'Mesón Piedra Cocina',
            type: 'assembly',
            isCountertop: true,
            facingDirection: 'front'
          }
        ],
        parts: createStoneScenarioParts(),
        hardware: [],
        appliances: [],
        laborType: 'percent',
        laborCost: 20,
        profitMarginPercent: 25,
        taxPercent: 19,
        settings: {
          ...p.settings,
          currency: 'COP'
        }
      }), false);
      fixture.detectChanges();
    });

    afterEach(() => {
      projectService.flushPendingStorageSave();
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }
      vi.restoreAllMocks();
    });

    it('debe incluir por defecto los mesones de piedra cuando includeInBudget es undefined', () => {
      const breakdown = component.stoneCountertopsBreakdown();
      expect(breakdown.items.length).toBe(2);
      expect(breakdown.items[0].part.includeInBudget).toBeUndefined();
      expect(breakdown.items[0].included).toBe(true);
      expect(breakdown.items[1].part.includeInBudget).toBeUndefined();
      expect(breakdown.items[1].included).toBe(true);
      expect(breakdown.totalStoneCost).toBe(420000);
      expect(breakdown.totalAreaM2).toBe(1.4);
      expect(component.includedStoneItems().length).toBe(2);

      const mainCheckbox = fixture.nativeElement.querySelector(
        'input[type="checkbox"][data-stone-checkbox-id="stone_main_1"]'
      ) as HTMLInputElement | null;
      const splashCheckbox = fixture.nativeElement.querySelector(
        'input[type="checkbox"][data-stone-checkbox-id="stone_splash_1"]'
      ) as HTMLInputElement | null;

      expect(mainCheckbox).not.toBeNull();
      expect(splashCheckbox).not.toBeNull();
      expect(mainCheckbox?.checked).toBe(true);
      expect(splashCheckbox?.checked).toBe(true);
    });

    it('desmarcar Mesón Principal y/o Zócalo recalcula en cascada, atenúa la fila y muestra Excluido', () => {
      // Totales iniciales con ambos incluidos:
      // Tableros = 200.000 + Piedra = 420.000 -> Materiales = 620.000
      // Mano de obra 20% = 124.000 -> Producción = 744.000
      // Utilidad 25% = 186.000 -> Subtotal antes IVA = 930.000
      // IVA 19% = 176.700 -> Precio cliente = 1.106.700
      expect(component.totalMaterialsCost()).toBe(620000);
      expect(component.laborTotal()).toBe(124000);
      expect(component.productionCost()).toBe(744000);
      expect(component.profitAmount()).toBe(186000);
      expect(component.subtotalBeforeTax()).toBe(930000);
      expect(component.taxAmount()).toBe(176700);
      expect(component.finalClientPrice()).toBe(1106700);

      // Desmarcar Zócalo / Salpicadero Posterior vía checkbox en el DOM
      const splashCheckbox = fixture.nativeElement.querySelector(
        'input[type="checkbox"][data-stone-checkbox-id="stone_splash_1"]'
      ) as HTMLInputElement;
      splashCheckbox.checked = false;
      splashCheckbox.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(component.stoneCountertopsBreakdown().items.length).toBe(2);
      expect(component.stoneCountertopsBreakdown().totalStoneCost).toBe(360000);
      expect(component.stoneCountertopsBreakdown().totalAreaM2).toBe(1.2);
      expect(component.totalMaterialsCost()).toBe(560000);
      expect(component.laborTotal()).toBe(112000);
      expect(component.productionCost()).toBe(672000);
      expect(component.profitAmount()).toBe(168000);
      expect(component.subtotalBeforeTax()).toBe(840000);
      expect(component.taxAmount()).toBe(159600);
      expect(component.finalClientPrice()).toBe(999600);

      const splashRow = fixture.nativeElement.querySelector(
        'tr[data-stone-row-id="stone_splash_1"]'
      ) as HTMLTableRowElement;
      const splashSubtotalCell = fixture.nativeElement.querySelector(
        'td[data-stone-subtotal-id="stone_splash_1"]'
      ) as HTMLTableCellElement;
      const mainRow = fixture.nativeElement.querySelector(
        'tr[data-stone-row-id="stone_main_1"]'
      ) as HTMLTableRowElement;

      expect(splashRow.classList.contains('opacity-50')).toBe(true);
      expect(splashSubtotalCell.textContent?.trim()).toBe('Excluido');
      expect(mainRow.classList.contains('opacity-50')).toBe(false);

      // Desmarcar también Mesón Principal de Cocina
      const mainCheckbox = fixture.nativeElement.querySelector(
        'input[type="checkbox"][data-stone-checkbox-id="stone_main_1"]'
      ) as HTMLInputElement;
      mainCheckbox.checked = false;
      mainCheckbox.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(component.stoneCountertopsBreakdown().items.length).toBe(2);
      expect(component.stoneCountertopsBreakdown().totalStoneCost).toBe(0);
      expect(component.stoneCountertopsBreakdown().totalAreaM2).toBe(0);
      expect(component.totalMaterialsCost()).toBe(200000);
      expect(component.laborTotal()).toBe(40000);
      expect(component.productionCost()).toBe(240000);
      expect(component.profitAmount()).toBe(60000);
      expect(component.subtotalBeforeTax()).toBe(300000);
      expect(component.taxAmount()).toBe(57000);
      expect(component.finalClientPrice()).toBe(357000);

      const mainSubtotalCell = fixture.nativeElement.querySelector(
        'td[data-stone-subtotal-id="stone_main_1"]'
      ) as HTMLTableCellElement;
      expect(mainRow.classList.contains('opacity-50')).toBe(true);
      expect(mainSubtotalCell.textContent?.trim()).toBe('Excluido');
    });

    it('re-marcar un mesón o salpicadero excluido restaura exactamente el monto original y la UI', () => {
      const initialStoneCost = component.stoneCountertopsBreakdown().totalStoneCost;
      const initialAreaM2 = component.stoneCountertopsBreakdown().totalAreaM2;
      const initialFinalPrice = component.finalClientPrice();

      component.toggleStoneCountertopBudget('stone_main_1', false);
      component.toggleStoneCountertopBudget('stone_splash_1', false);
      fixture.detectChanges();

      expect(component.stoneCountertopsBreakdown().totalStoneCost).toBe(0);
      expect(component.finalClientPrice()).toBe(357000);

      // Re-marcar ambos vía checkbox en el DOM
      const mainCheckbox = fixture.nativeElement.querySelector(
        'input[type="checkbox"][data-stone-checkbox-id="stone_main_1"]'
      ) as HTMLInputElement;
      const splashCheckbox = fixture.nativeElement.querySelector(
        'input[type="checkbox"][data-stone-checkbox-id="stone_splash_1"]'
      ) as HTMLInputElement;

      mainCheckbox.checked = true;
      mainCheckbox.dispatchEvent(new Event('change'));
      splashCheckbox.checked = true;
      splashCheckbox.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(component.stoneCountertopsBreakdown().totalStoneCost).toBe(initialStoneCost);
      expect(component.stoneCountertopsBreakdown().totalAreaM2).toBe(initialAreaM2);
      expect(component.finalClientPrice()).toBe(initialFinalPrice);

      const mainRow = fixture.nativeElement.querySelector(
        'tr[data-stone-row-id="stone_main_1"]'
      ) as HTMLTableRowElement;
      const mainSubtotalCell = fixture.nativeElement.querySelector(
        'td[data-stone-subtotal-id="stone_main_1"]'
      ) as HTMLTableCellElement;
      expect(mainRow.classList.contains('opacity-50')).toBe(false);
      expect(mainSubtotalCell.textContent?.trim()).toBe('$ 360.000 COP');
    });

    it('en la vista de cotización PDF omite mesones excluidos y oculta la sección si todos están excluidos', () => {
      component.showClientQuotation.set(true);
      fixture.detectChanges();

      let quotationSection = fixture.nativeElement.querySelector(
        '[data-testid="quotation-stone-section"]'
      ) as HTMLElement | null;
      expect(quotationSection).not.toBeNull();
      expect(
        quotationSection?.querySelector('[data-quotation-stone-id="stone_main_1"]')
      ).not.toBeNull();
      expect(
        quotationSection?.querySelector('[data-quotation-stone-id="stone_splash_1"]')
      ).not.toBeNull();

      // Excluir solo el zócalo/salpicadero
      component.toggleStoneCountertopBudget('stone_splash_1', false);
      fixture.detectChanges();

      quotationSection = fixture.nativeElement.querySelector(
        '[data-testid="quotation-stone-section"]'
      ) as HTMLElement | null;
      expect(quotationSection).not.toBeNull();
      expect(
        quotationSection?.querySelector('[data-quotation-stone-id="stone_main_1"]')
      ).not.toBeNull();
      expect(
        quotationSection?.querySelector('[data-quotation-stone-id="stone_splash_1"]')
      ).toBeNull();

      // Excluir también el mesón principal -> toda la sección de mesones en cotización desaparece
      component.toggleStoneCountertopBudget('stone_main_1', false);
      fixture.detectChanges();

      quotationSection = fixture.nativeElement.querySelector(
        '[data-testid="quotation-stone-section"]'
      ) as HTMLElement | null;
      expect(quotationSection).toBeNull();

      // La tabla 1.B principal sigue visible para permitir reactivación
      const breakdownSection = fixture.nativeElement.querySelector(
        '[data-testid="stone-countertops-section"]'
      ) as HTMLElement | null;
      expect(breakdownSection).not.toBeNull();
      expect(breakdownSection?.querySelectorAll('tbody tr').length).toBe(2);
    });
  });
});
