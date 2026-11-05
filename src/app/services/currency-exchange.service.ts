import { Injectable, signal } from '@angular/core';

/**
 * Tasas de cambio de respaldo realistas (Moneda base canónica: COP).
 * Se emplean si el usuario no tiene conexión a internet o ambas APIs fallan.
 * Referencia aproximada de mercado:
 * 1 USD ≈ 4.250 COP
 * 1 EUR ≈ 4.550 COP
 * 1 MXN ≈ 212 COP
 * 1 PEN ≈ 1.140 COP
 * 1 CLP ≈ 4.45 COP
 * 1 ARS ≈ 3.65 COP
 */
export const DEFAULT_COP_RATES: Record<string, number> = {
  COP: 1,
  USD: 1 / 4250, // ≈ 0.000235294
  EUR: 1 / 4550, // ≈ 0.000219780
  MXN: 1 / 212,  // ≈ 0.004716981
  PEN: 1 / 1140, // ≈ 0.000877193
  CLP: 1 / 4.45, // ≈ 0.224719101
  ARS: 1 / 3.65  // ≈ 0.273972603
};

const STORAGE_CACHE_KEY = 'melamipro_exchange_rates_cache_v1';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 horas de vigencia de caché

/**
 * Servicio centralizado de tasas de cambio en tiempo real con base canónica COP.
 * Permite cotizar y visualizar presupuestos en múltiples monedas (USD, EUR, MXN, PEN, CLP, ARS)
 * garantizando que los costos internos y de catálogo nunca se corrompan.
 */
@Injectable({
  providedIn: 'root'
})
export class CurrencyExchangeService {
  /**
   * Mapa reactivo de tasas de cambio relativas a 1 COP.
   * Ej: rates()['USD'] = 0.000235... (1 COP = 0.000235 USD).
   */
  readonly rates = signal<Record<string, number>>({ ...DEFAULT_COP_RATES });

  /**
   * Marca de tiempo de la última actualización exitosa de tasas.
   */
  readonly lastUpdated = signal<Date | null>(null);

  /**
   * Estado de carga de actualización de tasas en segundo plano.
   */
  readonly isRefreshing = signal<boolean>(false);

  /**
   * Último error registrado durante la consulta de tasas (si hubo).
   */
  readonly lastError = signal<string | null>(null);

  constructor() {
    this.loadCachedRates();
    // Iniciar consulta de tasas si la caché está vencida o no existe
    if (!this.isCacheValid()) {
      this.fetchRates();
    }
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  /**
   * Comprueba si la caché de tasas en memoria o almacenamiento local sigue vigente.
   */
  isCacheValid(): boolean {
    const updated = this.lastUpdated();
    if (!updated) return false;
    return Date.now() - updated.getTime() < CACHE_TTL_MS;
  }

  /**
   * Carga tasas previamente almacenadas en localStorage para respuesta instantánea sin parpadeos.
   */
  private loadCachedRates(): void {
    if (!this.isBrowser()) return;
    try {
      const raw = localStorage.getItem(STORAGE_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.timestamp === 'number' &&
        parsed.rates &&
        typeof parsed.rates === 'object'
      ) {
        const date = new Date(parsed.timestamp);
        this.rates.set({
          ...DEFAULT_COP_RATES,
          ...parsed.rates,
          COP: 1
        });
        this.lastUpdated.set(date);
      }
    } catch {
      // Ignorar contenido corrupto en localStorage
    }
  }

  /**
   * Aplica las nuevas tasas y actualiza la copia persistente en localStorage.
   */
  private applyAndCacheRates(newRates: Record<string, number>, date: Date): void {
    const merged: Record<string, number> = {
      ...DEFAULT_COP_RATES,
      ...newRates,
      COP: 1
    };
    this.rates.set(merged);
    this.lastUpdated.set(date);

    if (this.isBrowser()) {
      try {
        localStorage.setItem(
          STORAGE_CACHE_KEY,
          JSON.stringify({
            timestamp: date.getTime(),
            rates: merged
          })
        );
      } catch {
        // Fallback silencioso si el almacenamiento está restringido
      }
    }
  }

  /**
   * Inicializa o valida las tasas al ingresar a vistas sensibles como Presupuesto.
   */
  initRates(): void {
    if (!this.isCacheValid()) {
      this.fetchRates();
    }
  }

  /**
   * Consulta las tasas de cambio vigentes en el mercado con base COP.
   * Utiliza un endpoint primario gratuito sin API Key y un endpoint secundario en CDN de respaldo.
   *
   * @param force Si es true, ignora la vigencia de la caché y fuerza la petición de red.
   */
  async fetchRates(force = false): Promise<boolean> {
    if (!this.isBrowser()) return false;
    if (!force && this.isCacheValid()) return true;

    this.isRefreshing.set(true);
    this.lastError.set(null);

    // 1. Endpoint primario (open.er-api.com - CORS abierto, sin API key)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const resp = await fetch('https://open.er-api.com/v6/latest/COP', {
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (resp.ok) {
        const data = await resp.json();
        if (data && (data.result === 'success' || data.rates) && typeof data.rates === 'object') {
          const parsedRates: Record<string, number> = { COP: 1 };
          for (const [key, val] of Object.entries(data.rates)) {
            if (typeof val === 'number' && !isNaN(val) && val > 0) {
              parsedRates[key.toUpperCase()] = val;
            }
          }
          this.applyAndCacheRates(parsedRates, new Date());
          this.isRefreshing.set(false);
          return true;
        }
      }
    } catch (err) {
      // Registrar fallo y continuar al endpoint secundario de respaldo
    }

    // 2. Endpoint secundario de respaldo (CDN jsDelivr / fawazahmed0)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const resp = await fetch(
        'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/cop.json',
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (resp.ok) {
        const data = await resp.json();
        const copMap = data?.cop;
        if (copMap && typeof copMap === 'object') {
          const parsedRates: Record<string, number> = { COP: 1 };
          for (const [key, val] of Object.entries(copMap)) {
            if (typeof val === 'number' && !isNaN(val) && val > 0) {
              parsedRates[key.toUpperCase()] = val;
            }
          }
          this.applyAndCacheRates(parsedRates, new Date());
          this.isRefreshing.set(false);
          return true;
        }
      }
    } catch (err) {
      // Ambos endpoints fallaron (offline o problemas de red)
    }

    this.lastError.set('No se pudo sincronizar con las APIs de tasas de cambio. Se están utilizando tasas de respaldo offline.');
    this.isRefreshing.set(false);
    return false;
  }

  /**
   * Convierte un monto base canónico en COP a la moneda de destino seleccionada.
   *
   * @param amountInCop Monto en Pesos Colombianos (COP).
   * @param targetCurrency Código de moneda objetivo (ej. 'USD', 'MXN', 'EUR', 'COP').
   */
  convertFromCop(amountInCop: number, targetCurrency: string): number {
    const num = Number(amountInCop) || 0;
    const code = (targetCurrency || 'COP').toUpperCase();
    if (code === 'COP') return num;

    const rate = this.rates()[code] ?? DEFAULT_COP_RATES[code];
    if (!rate || rate <= 0) return num;

    return num * rate;
  }

  /**
   * Convierte un valor ingresado por el usuario en una moneda extranjera de vuelta
   * a la base canónica COP para almacenamiento seguro sin pérdida de datos.
   *
   * @param amountInTargetCurrency Valor en la moneda extranjera activa.
   * @param sourceCurrency Código de la moneda de origen (ej. 'USD', 'MXN').
   */
  convertToCop(amountInTargetCurrency: number, sourceCurrency: string): number {
    const num = Number(amountInTargetCurrency) || 0;
    const code = (sourceCurrency || 'COP').toUpperCase();
    if (code === 'COP') return Math.round(num);

    const rate = this.rates()[code] ?? DEFAULT_COP_RATES[code];
    if (!rate || rate <= 0) return Math.round(num);

    return Math.round(num / rate);
  }

  /**
   * Devuelve la tasa de cambio inversa en formato legible para el usuario.
   * Ej: '1 USD = $ 4.250 COP' o '1 MXN = $ 212 COP'.
   * Si la moneda seleccionada es COP, devuelve 'Moneda Base (COP)'.
   */
  getInverseRateDisplay(targetCurrency: string): string {
    const code = (targetCurrency || 'COP').toUpperCase();
    if (code === 'COP') {
      return 'Moneda Base (COP)';
    }

    const rate = this.rates()[code] ?? DEFAULT_COP_RATES[code];
    if (!rate || rate <= 0) {
      return `1 ${code} = $ --- COP`;
    }

    const copPerUnit = 1 / rate;
    const formattedCop = copPerUnit >= 10
      ? Math.round(copPerUnit).toLocaleString('es-CO')
      : copPerUnit.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return `1 ${code} = $ ${formattedCop} COP`;
  }
}
