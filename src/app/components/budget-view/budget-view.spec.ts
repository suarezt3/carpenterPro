import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BudgetViewComponent } from './budget-view';
import { ProjectStorageService } from '../../services/project-storage.service';
import { CurrencyExchangeService } from '../../services/currency-exchange.service';
import { ThemeService } from '../../services/theme.service';
import { CutOptimizerService } from '../../services/cut-optimizer.service';
import { HardwareCatalogService } from '../../services/hardware-catalog.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

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
      const initialCostCop = testMat.sheetCost;

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
});
