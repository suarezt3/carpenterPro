import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import {
  DEFAULT_LANDING_PRICING_CONFIG,
  LandingPricingConfig,
  LandingPricingConfigSaveResult,
  cloneLandingPricingConfig,
  computeAnnualMonthlyCop,
  computeAnnualTotalCop,
  isPromoActiveAt,
  normalizeLandingPricingConfig
} from '../models/landing-pricing.models';
import { SupabaseService } from './supabase.service';

export {
  computeAnnualMonthlyCop,
  computeAnnualTotalCop,
  isPromoActiveAt,
  cloneLandingPricingConfig,
  normalizeLandingPricingConfig
};

interface SupabaseRestCredentials {
  url: string;
  publishableKey: string;
}

@Injectable({
  providedIn: 'root'
})
export class LandingPricingConfigService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly supabase = inject(SupabaseService, { optional: true });
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly _config = signal<LandingPricingConfig>(
    cloneLandingPricingConfig(DEFAULT_LANDING_PRICING_CONFIG)
  );
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _hasLoadedRemote = signal<boolean>(false);

  private inFlightLoadPromise: Promise<LandingPricingConfig> | null = null;

  readonly config = this._config.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hasLoadedRemote = this._hasLoadedRemote.asReadonly();

  /**
   * Interruptor maestro público de pasarela de pagos.
   * Por seguridad permanece bloqueado (`false`) salvo habilitación explícita remota.
   */
  readonly isPaymentsActive = computed<boolean>(
    () => this._config().payments_enabled === true
  );

  /**
   * Indica si el banner promocional debe mostrarse actualmente según activación y fecha límite.
   */
  readonly isPromoCurrentlyActive = computed<boolean>(() =>
    isPromoActiveAt(this._config())
  );

  constructor() {
    if (this.isBrowser && !this.isTestRuntime() && this.isSupabaseConfigured()) {
      void this.loadConfig();
    }
  }

  private isTestRuntime(): boolean {
    const globalObj = globalThis as unknown as Record<string, unknown>;
    if (globalObj['__vitest_worker__']) {
      return true;
    }
    const processRef = globalObj['process'] as
      | { env?: Record<string, string | undefined> }
      | undefined;
    if (
      processRef?.env?.['NODE_ENV'] === 'test' ||
      processRef?.env?.['VITEST'] === 'true'
    ) {
      return true;
    }
    if (typeof window !== 'undefined') {
      const win = window as unknown as Record<string, unknown>;
      if (win['__karma__']) {
        return true;
      }
    }
    return false;
  }

  private resolveSupabaseCredentials(): SupabaseRestCredentials | null {
    const cfg = this.supabase?.config;
    const rawUrl =
      typeof cfg?.url === 'string' ? cfg.url.trim().replace(/\/+$/, '') : '';
    const rawKey =
      typeof cfg?.publishableKey === 'string' ? cfg.publishableKey.trim() : '';

    if (!rawUrl || !rawKey || !/^https?:\/\//i.test(rawUrl)) {
      return null;
    }
    return { url: rawUrl, publishableKey: rawKey };
  }

  private isSupabaseConfigured(): boolean {
    return this.resolveSupabaseCredentials() !== null;
  }

  private applySafeLoadFallback(): LandingPricingConfig {
    const safeDefault = cloneLandingPricingConfig(DEFAULT_LANDING_PRICING_CONFIG);
    this._config.set(safeDefault);
    this._hasLoadedRemote.set(false);
    return safeDefault;
  }

  private sanitizeErrorMessage(
    status: number,
    rawBody: string,
    operation: 'load' | 'save'
  ): string {
    const isAuthOrRlsError =
      status === 401 ||
      status === 403 ||
      /42501|row-level security|permission denied|insufficient_privilege|not authorized|unauthorized/i.test(
        rawBody
      );

    if (operation === 'save') {
      if (isAuthOrRlsError) {
        return 'No tienes permisos de superadministrador para guardar la configuración de precios.';
      }
      if (
        status === 400 ||
        status === 422 ||
        /23514|check constraint|invalid input/i.test(rawBody)
      ) {
        return 'Algunos valores de precios o descuentos están fuera del rango permitido.';
      }
      return 'No fue posible guardar la configuración en la nube en este momento.';
    }

    if (isAuthOrRlsError) {
      return 'No tienes permisos para consultar la configuración de precios.';
    }
    return 'No fue posible cargar la configuración de precios desde la nube.';
  }

  /**
   * Carga la configuración pública (`id = 'default'`) con caché en memoria
   * y respaldo seguro (`payments_enabled: false`) ante cualquier fallo.
   */
  async loadConfig(force = false): Promise<LandingPricingConfig> {
    if (this._hasLoadedRemote() && !force) {
      return this._config();
    }

    if (this.inFlightLoadPromise && !force) {
      return this.inFlightLoadPromise;
    }

    const credentials = this.resolveSupabaseCredentials();
    if (!this.isBrowser || !credentials || typeof fetch !== 'function') {
      return this.applySafeLoadFallback();
    }

    const loadOperation = this.executeRemoteLoad(credentials);
    this.inFlightLoadPromise = loadOperation;

    try {
      return await loadOperation;
    } finally {
      if (this.inFlightLoadPromise === loadOperation) {
        this.inFlightLoadPromise = null;
      }
    }
  }

  private async executeRemoteLoad(
    credentials: SupabaseRestCredentials
  ): Promise<LandingPricingConfig> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const endpoint = `${credentials.url}/rest/v1/landing_pricing_config?id=eq.default&select=*&limit=1`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          apikey: credentials.publishableKey,
          Authorization: `Bearer ${credentials.publishableKey}`,
          Accept: 'application/json'
        }
      });

      if (!response.ok) {
        const rawBody = await response.text().catch(() => '');
        this._error.set(this.sanitizeErrorMessage(response.status, rawBody, 'load'));
        return this.applySafeLoadFallback();
      }

      const payload = (await response.json()) as unknown;
      const row = Array.isArray(payload) ? (payload[0] ?? null) : payload;
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        return this.applySafeLoadFallback();
      }

      const normalized = normalizeLandingPricingConfig(
        row,
        DEFAULT_LANDING_PRICING_CONFIG
      );
      this._config.set(normalized);
      this._hasLoadedRemote.set(true);
      this._error.set(null);
      return normalized;
    } catch {
      this._error.set(this.sanitizeErrorMessage(0, '', 'load'));
      return this.applySafeLoadFallback();
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Guarda la configuración dinámica de precios en la nube (solo superadministrador autenticado).
   */
  async saveConfig(
    updatedConfig: LandingPricingConfig
  ): Promise<LandingPricingConfigSaveResult> {
    const sanitized = normalizeLandingPricingConfig(
      { ...updatedConfig, id: 'default' },
      DEFAULT_LANDING_PRICING_CONFIG
    );

    const credentials = this.resolveSupabaseCredentials();
    if (!this.isBrowser || !credentials || typeof fetch !== 'function') {
      const msg = 'No fue posible guardar la configuración en la nube en este momento.';
      this._error.set(msg);
      return { success: false, error: msg };
    }

    const session = this.supabase?.session?.() ?? null;
    const accessToken =
      typeof session?.access_token === 'string' ? session.access_token.trim() : '';

    if (!accessToken) {
      const authError =
        'No tienes permisos de superadministrador para guardar la configuración de precios.';
      this._error.set(authError);
      return { success: false, error: authError };
    }

    this._isSaving.set(true);
    this._error.set(null);

    try {
      const endpoint = `${credentials.url}/rest/v1/landing_pricing_config?on_conflict=id`;
      const payload = {
        id: 'default',
        payments_enabled: sanitized.payments_enabled,
        payments_notice_title: sanitized.payments_notice_title,
        payments_notice_message: sanitized.payments_notice_message,
        payments_disabled_cta_label: sanitized.payments_disabled_cta_label,
        promo_enabled: sanitized.promo_enabled,
        promo_badge: sanitized.promo_badge,
        promo_message: sanitized.promo_message,
        promo_code: sanitized.promo_code,
        promo_expires_at: sanitized.promo_expires_at,
        promo_discount_percent: sanitized.promo_discount_percent,
        ip_guarantee_enabled: sanitized.ip_guarantee_enabled,
        ip_guarantee_title: sanitized.ip_guarantee_title,
        ip_guarantee_description: sanitized.ip_guarantee_description,
        annual_discount_percent: sanitized.annual_discount_percent,
        plans: sanitized.plans
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: credentials.publishableKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const rawBody = await response.text().catch(() => '');
        const cleanError = this.sanitizeErrorMessage(response.status, rawBody, 'save');
        this._error.set(cleanError);
        return { success: false, error: cleanError };
      }

      const rawText = await response.text().catch(() => '');
      let parsedRow: unknown = null;
      if (rawText.trim()) {
        try {
          const parsed = JSON.parse(rawText) as unknown;
          parsedRow = Array.isArray(parsed) ? (parsed[0] ?? null) : parsed;
        } catch {
          parsedRow = null;
        }
      }

      const nowIso = new Date().toISOString();
      const currentUserId =
        this.supabase?.currentUser?.()?.id ?? session?.user?.id ?? null;

      const normalized = normalizeLandingPricingConfig(
        parsedRow ?? { ...sanitized, updated_at: nowIso, updated_by: currentUserId },
        sanitized
      );
      const savedData: LandingPricingConfig = {
        ...normalized,
        updated_at: normalized.updated_at || nowIso,
        updated_by: normalized.updated_by ?? currentUserId
      };

      this._config.set(savedData);
      this._hasLoadedRemote.set(true);
      this._error.set(null);
      return { success: true, data: savedData };
    } catch {
      const cleanError =
        'No fue posible guardar la configuración en la nube en este momento.';
      this._error.set(cleanError);
      return { success: false, error: cleanError };
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Reemplaza la configuración en memoria para pruebas unitarias deterministas.
   */
  setLocalConfigForTesting(config: LandingPricingConfig): void {
    const normalized = normalizeLandingPricingConfig(
      config,
      DEFAULT_LANDING_PRICING_CONFIG
    );
    this._config.set(normalized);
    this._error.set(null);
  }

  /**
   * Aplica un parche parcial sobre la configuración en memoria manteniendo la normalización segura.
   */
  applyLocalConfig(patch: Partial<LandingPricingConfig>): LandingPricingConfig {
    const next = normalizeLandingPricingConfig(
      { ...this._config(), ...patch, id: 'default' },
      this._config()
    );
    this._config.set(next);
    this._error.set(null);
    return next;
  }

  /**
   * Limpia el último mensaje de error registrado.
   */
  clearError(): void {
    this._error.set(null);
  }
}
