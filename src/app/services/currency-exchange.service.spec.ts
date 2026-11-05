import { TestBed } from '@angular/core/testing';
import { CurrencyExchangeService, DEFAULT_COP_RATES } from './currency-exchange.service';

describe('CurrencyExchangeService (Tasas de Cambio en Tiempo Real)', () => {
  let service: CurrencyExchangeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CurrencyExchangeService]
    });
    service = TestBed.inject(CurrencyExchangeService);
  });

  describe('1. Moneda Base Canónica (COP)', () => {
    it('convertFromCop con moneda COP debe devolver exactamente el mismo monto', () => {
      expect(service.convertFromCop(195000, 'COP')).toBe(195000);
      expect(service.convertFromCop(0, 'COP')).toBe(0);
      expect(service.convertFromCop(1500000, 'cop')).toBe(1500000);
    });

    it('convertToCop con moneda COP debe devolver el entero redondeado exacto', () => {
      expect(service.convertToCop(195000, 'COP')).toBe(195000);
      expect(service.convertToCop(195000.4, 'COP')).toBe(195000);
      expect(service.convertToCop(195000.6, 'cop')).toBe(195001);
    });

    it('getInverseRateDisplay con COP debe devolver "Moneda Base (COP)"', () => {
      expect(service.getInverseRateDisplay('COP')).toBe('Moneda Base (COP)');
      expect(service.getInverseRateDisplay('cop')).toBe('Moneda Base (COP)');
    });
  });

  describe('2. Conversión Exacta a Monedas Extranjeras (USD, MXN, EUR, PEN, CLP, ARS)', () => {
    it('debe convertir montos COP a USD usando la tasa activa', () => {
      // Con tasa por defecto 1 USD = 4,250 COP (rate = 1/4250)
      const copAmount = 425000; // Equivalente a 100 USD
      const usdAmount = service.convertFromCop(copAmount, 'USD');
      expect(Math.round(usdAmount)).toBe(100);
    });

    it('debe convertir montos COP a MXN usando la tasa activa', () => {
      // Con tasa por defecto 1 MXN = 212 COP (rate = 1/212)
      const copAmount = 212000; // Equivalente a 1,000 MXN
      const mxnAmount = service.convertFromCop(copAmount, 'MXN');
      expect(Math.round(mxnAmount)).toBe(1000);
    });

    it('debe convertir montos COP a EUR usando la tasa activa', () => {
      // Con tasa por defecto 1 EUR = 4,550 COP (rate = 1/4550)
      const copAmount = 455000; // Equivalente a 100 EUR
      const eurAmount = service.convertFromCop(copAmount, 'EUR');
      expect(Math.round(eurAmount)).toBe(100);
    });

    it('debe revertir montos editados en USD de vuelta a la base canónica COP sin pérdida', () => {
      const userEditedUsd = 100;
      const copResult = service.convertToCop(userEditedUsd, 'USD');
      expect(copResult).toBe(425000);
    });

    it('debe revertir montos editados en MXN de vuelta a COP', () => {
      const userEditedMxn = 1000;
      const copResult = service.convertToCop(userEditedMxn, 'MXN');
      expect(copResult).toBe(212000);
    });
  });

  describe('3. Formato Legible de Tasa Inversa (getInverseRateDisplay)', () => {
    it('debe mostrar la tasa legible para USD (1 USD = $ 4.250 COP)', () => {
      const display = service.getInverseRateDisplay('USD');
      expect(display).toBe('1 USD = $ 4.250 COP');
    });

    it('debe mostrar la tasa legible para MXN (1 MXN = $ 212 COP)', () => {
      const display = service.getInverseRateDisplay('MXN');
      expect(display).toBe('1 MXN = $ 212 COP');
    });

    it('debe mostrar la tasa legible para EUR (1 EUR = $ 4.550 COP)', () => {
      const display = service.getInverseRateDisplay('EUR');
      expect(display).toBe('1 EUR = $ 4.550 COP');
    });
  });

  describe('4. Resistencia y Casos Límite (Edge Cases)', () => {
    it('moneda no reconocida o nula debe comportarse de forma segura devolviendo el valor COP', () => {
      expect(service.convertFromCop(50000, 'XYZ')).toBe(50000);
      expect(service.convertToCop(50000, 'XYZ')).toBe(50000);
      expect(service.getInverseRateDisplay('XYZ')).toBe('1 XYZ = $ --- COP');
    });

    it('montos negativos o cero se manejan correctamente', () => {
      expect(service.convertFromCop(0, 'USD')).toBe(0);
      expect(service.convertToCop(0, 'USD')).toBe(0);
      expect(service.convertFromCop(-100, 'USD')).toBeLessThan(0);
    });

    it('las tasas por defecto deben contener las monedas soportadas por el sistema', () => {
      const supported = ['COP', 'USD', 'EUR', 'MXN', 'PEN', 'CLP', 'ARS'];
      for (const cur of supported) {
        expect(DEFAULT_COP_RATES[cur]).toBeDefined();
        expect(DEFAULT_COP_RATES[cur]).toBeGreaterThan(0);
      }
    });

    it('si fetchRates falla en ambos endpoints debe asignar un mensaje descriptivo en lastError', async () => {
      // Forzamos fallo de fetch simulado
      const originalFetch = window.fetch;
      try {
        window.fetch = () => Promise.reject(new Error('Network offline'));
        const success = await service.fetchRates(true);
        expect(success).toBe(false);
        expect(service.lastError()).toContain('offline');
        expect(service.isRefreshing()).toBe(false);
      } finally {
        window.fetch = originalFetch;
      }
    });
  });
});
