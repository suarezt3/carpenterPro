import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyExchangeService } from './currency-exchange.service';
import {
  BillingCycle,
  SupabaseService,
  WompiCheckoutSessionResult,
  WompiVerifyTransactionResult
} from './supabase.service';

export type PaidPlan = 'pro' | 'industrial';
export type CheckoutCycleInput = 'monthly' | 'annual' | 'yearly';
export type UpgradeReason = 'modules_limit' | 'workshop_export' | 'cnc_export';
export type PaymentsReadinessMode = 'early_access_protected' | 'live_checkout';

export const WOMPI_SANDBOX_PUBLIC_KEY = 'pub_test_5IPqjmLMDEC0cqUMoomPY7CzUaoGW68O';
export const WOMPI_WIDGET_SCRIPT_SRC = 'https://checkout.wompi.co/widget.js';
export const WOMPI_WEB_CHECKOUT_URL = 'https://checkout.wompi.co/p/';
export const DEFAULT_COP_USD_FALLBACK_RATE = 4250;

export const DEFAULT_PAYMENTS_READINESS_MODE: PaymentsReadinessMode = 'live_checkout';
export const PAYMENTS_READINESS_MODE_STORAGE_KEY = 'piezo3d_payments_readiness_mode';

export interface EarlyAccessModalState {
  plan: PaidPlan;
  cycle: BillingCycle;
  sourceRoute: string;
}

export interface CheckoutVariantConfig {
  plan: PaidPlan;
  cycle: BillingCycle;
  planCode: 'P3D_PRO_MONTHLY' | 'P3D_PRO_ANNUAL' | 'P3D_IND_MONTHLY' | 'P3D_IND_ANNUAL';
  priceUsd: number;
  monthlyEquivalentUsd: number;
}

export interface PendingCheckoutIntent {
  plan: PaidPlan;
  cycle: BillingCycle;
}

export interface UpgradeModalState {
  reason: UpgradeReason;
  requiredPlan: PaidPlan;
  featureName?: string;
}

export interface CopPriceEstimate {
  amountUsd: number;
  exchangeRateCop: number;
  amountCop: number;
  amountInCents: number;
}

export interface WompiWidgetTransaction {
  id: string;
  status?: string;
  reference?: string;
  amountInCents?: number;
  amount_in_cents?: number;
  currency?: string;
  paymentMethodType?: string;
  payment_method_type?: string;
}

export interface WompiWidgetTransactionResult {
  transaction?: WompiWidgetTransaction;
}

export interface WompiWidgetCheckoutConfig {
  currency: 'COP';
  amountInCents: number;
  reference: string;
  publicKey: string;
  redirectUrl?: string;
  signature: {
    integrity: string;
  };
  customerData?: {
    email?: string;
    fullName?: string;
  };
}

export interface WompiWidgetCheckoutInstance {
  open: (callback: (result: WompiWidgetTransactionResult) => void) => void;
}

export type WompiWidgetCheckoutConstructor = new (
  config: WompiWidgetCheckoutConfig
) => WompiWidgetCheckoutInstance;

declare global {
  interface Window {
    WidgetCheckout?: WompiWidgetCheckoutConstructor;
  }
}

export const FREE_PLAN_MAX_MODULES = 3;

export const CHECKOUT_VARIANTS: Record<PaidPlan, Record<BillingCycle, CheckoutVariantConfig>> = {
  pro: {
    monthly: {
      plan: 'pro',
      cycle: 'monthly',
      planCode: 'P3D_PRO_MONTHLY',
      priceUsd: 15,
      monthlyEquivalentUsd: 15
    },
    annual: {
      plan: 'pro',
      cycle: 'annual',
      planCode: 'P3D_PRO_ANNUAL',
      priceUsd: 144,
      monthlyEquivalentUsd: 12
    }
  },
  industrial: {
    monthly: {
      plan: 'industrial',
      cycle: 'monthly',
      planCode: 'P3D_IND_MONTHLY',
      priceUsd: 29,
      monthlyEquivalentUsd: 29
    },
    annual: {
      plan: 'industrial',
      cycle: 'annual',
      planCode: 'P3D_IND_ANNUAL',
      priceUsd: 276,
      monthlyEquivalentUsd: 23
    }
  }
};

const PENDING_CHECKOUT_STORAGE_KEY = 'piezo3d_pending_checkout';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly supabaseService = inject(SupabaseService);
  private readonly currencyExchange = inject(CurrencyExchangeService, { optional: true });
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private scriptLoadPromise: Promise<boolean> | null = null;
  private readonly inFlightRedirectVerifications = new Map<string, Promise<WompiVerifyTransactionResult>>();

  readonly isScriptReady = signal<boolean>(false);
  readonly lastCheckoutSuccessAt = signal<number | null>(null);
  readonly upgradeModalState = signal<UpgradeModalState | null>(null);
  readonly paymentsMode = signal<PaymentsReadinessMode>(this.readStoredPaymentsMode());
  readonly isPaymentsProtected = computed<boolean>(() => this.paymentsMode() === 'early_access_protected');
  readonly earlyAccessModalState = signal<EarlyAccessModalState | null>(null);
  readonly isPreparingCheckout = signal<boolean>(false);
  readonly lastCheckoutError = signal<string | null>(null);
  readonly lastVerifiedTransactionId = signal<string | null>(null);

  /**
   * Indica si el usuario actual está sujeto a las restricciones del Plan Inicial (`free`).
   * Evalúa exactamente `userProfile()?.plan === 'free' && userProfile()?.role !== 'super_admin'`.
   */
  readonly isFreePlanRestricted = computed<boolean>(() => {
    const profile = this.supabaseService.userProfile?.() ?? null;
    return profile?.plan === 'free' && profile?.role !== 'super_admin';
  });

  /**
   * Indica si la exportación de documentos de taller (PDF de Corte, Guía de Armado PDF, Etiquetas)
   * está restringida por tener el Plan Inicial (`free`).
   */
  readonly isWorkshopExportRestricted = computed<boolean>(() => {
    const profile = this.supabaseService.userProfile?.() ?? null;
    return profile?.plan === 'free' && profile?.role !== 'super_admin';
  });

  /**
   * Indica si la exportación Industrial CNC (`.DXF`) y Modelo 3D (`.DAE`) está restringida
   * (requiere `plan === 'industrial'` o `role === 'super_admin'`).
   */
  readonly isCncExportRestricted = computed<boolean>(() => {
    const profile = this.supabaseService.userProfile?.() ?? null;
    if (!profile) return false;
    return profile.role !== 'super_admin' && profile.plan !== 'industrial';
  });

  /**
   * Indica si el usuario tiene acceso a funciones de Plan Taller Pro o superior (`pro`, `industrial` o `super_admin`).
   */
  readonly hasProAccess = computed<boolean>(() => {
    const profile = this.supabaseService.userProfile?.() ?? null;
    if (!profile) return false;
    if (profile.role === 'super_admin') return true;
    return profile.plan === 'pro' || profile.plan === 'industrial';
  });

  /**
   * Indica si el usuario tiene acceso a funciones exclusivas de Plan Industrial & CNC (`industrial` o `super_admin`).
   */
  readonly hasIndustrialAccess = computed<boolean>(() => {
    const profile = this.supabaseService.userProfile?.() ?? null;
    if (!profile) return false;
    if (profile.role === 'super_admin') return true;
    return profile.plan === 'industrial';
  });

  private readStoredPaymentsMode(): PaymentsReadinessMode {
    if (!this.isBrowser || typeof localStorage === 'undefined') {
      return DEFAULT_PAYMENTS_READINESS_MODE;
    }
    try {
      const stored = localStorage.getItem(PAYMENTS_READINESS_MODE_STORAGE_KEY);
      if (stored === 'early_access_protected') {
        return 'early_access_protected';
      }
      if (stored === 'live_checkout') {
        return 'live_checkout';
      }
      return DEFAULT_PAYMENTS_READINESS_MODE;
    } catch {
      return DEFAULT_PAYMENTS_READINESS_MODE;
    }
  }

  /**
   * Actualiza el modo de disponibilidad de la pasarela de pagos y lo persiste en `localStorage`.
   */
  setPaymentsMode(mode: PaymentsReadinessMode): void {
    this.paymentsMode.set(mode);
    if (!this.isBrowser || typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(PAYMENTS_READINESS_MODE_STORAGE_KEY, mode);
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }

  /**
   * Alterna entre el modo protegido de acceso anticipado (`early_access_protected`)
   * y el modo de checkout público activo (`live_checkout`).
   */
  togglePaymentsMode(): PaymentsReadinessMode {
    const nextMode: PaymentsReadinessMode =
      this.paymentsMode() === 'early_access_protected' ? 'live_checkout' : 'early_access_protected';
    this.setPaymentsMode(nextMode);
    return nextMode;
  }

  /**
   * Abre el modal informativo de Acceso Anticipado para el plan y ciclo solicitados.
   */
  openEarlyAccessModal(plan: PaidPlan, cycle: CheckoutCycleInput = 'monthly', sourceRoute?: string): void {
    this.closeUpgradeModal();
    this.earlyAccessModalState.set({
      plan,
      cycle: this.normalizeCycle(cycle),
      sourceRoute: sourceRoute ?? (this.router.url || '/')
    });
  }

  /**
   * Cierra el modal informativo de Acceso Anticipado.
   */
  closeEarlyAccessModal(): void {
    this.earlyAccessModalState.set(null);
  }

  /**
   * Normaliza el ciclo de facturación admitiendo `'monthly'`, `'annual'` o `'yearly'`.
   */
  normalizeCycle(cycle?: CheckoutCycleInput | string | null): BillingCycle {
    if (cycle === 'annual' || cycle === 'yearly') {
      return 'annual';
    }
    return 'monthly';
  }

  /**
   * Obtiene la configuración limpia de catálogo para un plan y ciclo dados.
   */
  getVariantConfig(plan: PaidPlan, cycle: CheckoutCycleInput = 'monthly'): CheckoutVariantConfig {
    const normalizedCycle = this.normalizeCycle(cycle);
    return CHECKOUT_VARIANTS[plan][normalizedCycle];
  }

  /**
   * Calcula el estimado exacto en Pesos Colombianos (COP) y centavos Wompi a partir de la referencia en USD.
   * Prioriza `platformSettings.usd_to_cop_rate`, luego `CurrencyExchangeService` y finalmente `DEFAULT_COP_USD_FALLBACK_RATE`.
   */
  getCopEstimate(plan: PaidPlan, cycle: CheckoutCycleInput = 'monthly'): CopPriceEstimate {
    const normalizedCycle = this.normalizeCycle(cycle);
    const variant = CHECKOUT_VARIANTS[plan][normalizedCycle];
    const settings = this.supabaseService.platformSettings?.() ?? null;

    let amountUsd = variant.priceUsd;
    if (settings) {
      const candidateUsd =
        plan === 'pro'
          ? normalizedCycle === 'annual'
            ? Number(settings.pro_annual_total_usd)
            : Number(settings.pro_monthly_usd)
          : normalizedCycle === 'annual'
            ? Number(settings.industrial_annual_total_usd)
            : Number(settings.industrial_monthly_usd);
      if (Number.isFinite(candidateUsd) && candidateUsd > 0) {
        amountUsd = candidateUsd;
      }
    }

    let exchangeRateCop = DEFAULT_COP_USD_FALLBACK_RATE;
    const settingsRate = Number(settings?.usd_to_cop_rate);
    if (Number.isFinite(settingsRate) && settingsRate > 0) {
      exchangeRateCop = settingsRate;
    } else {
      const usdPerCop = Number(this.currencyExchange?.rates?.()['USD']);
      if (Number.isFinite(usdPerCop) && usdPerCop > 0) {
        exchangeRateCop = Math.round((1 / usdPerCop) * 100) / 100;
      }
    }

    const amountCop = Math.max(1500, Math.round(amountUsd * exchangeRateCop));
    const amountInCents = amountCop * 100;

    return {
      amountUsd,
      exchangeRateCop,
      amountCop,
      amountInCents
    };
  }

  /**
   * Carga dinámicamente `https://checkout.wompi.co/widget.js` en el `<head>` del documento.
   */
  ensureWompiScriptLoaded(): Promise<boolean> {
    if (!this.isBrowser || typeof window === 'undefined') {
      return Promise.resolve(false);
    }

    if (typeof window.WidgetCheckout === 'function') {
      this.isScriptReady.set(true);
      return Promise.resolve(true);
    }

    if (this.scriptLoadPromise) {
      return this.scriptLoadPromise;
    }

    this.scriptLoadPromise = new Promise<boolean>((resolve) => {
      const existingScript = this.document.querySelector(
        `script[src="${WOMPI_WIDGET_SCRIPT_SRC}"]`
      ) as HTMLScriptElement | null;

      if (existingScript) {
        if (existingScript.dataset['wompiStatus'] === 'loaded') {
          const ready = typeof window.WidgetCheckout === 'function';
          this.isScriptReady.set(ready);
          this.scriptLoadPromise = null;
          resolve(ready);
          return;
        }
        if (existingScript.dataset['wompiStatus'] === 'error') {
          existingScript.remove();
        } else {
          existingScript.addEventListener(
            'load',
            () => {
              existingScript.dataset['wompiStatus'] = 'loaded';
              this.isScriptReady.set(true);
              this.scriptLoadPromise = null;
              resolve(true);
            },
            { once: true }
          );
          existingScript.addEventListener(
            'error',
            () => {
              existingScript.dataset['wompiStatus'] = 'error';
              this.isScriptReady.set(false);
              this.scriptLoadPromise = null;
              resolve(false);
            },
            { once: true }
          );
          return;
        }
      }

      const script = this.document.createElement('script');
      script.src = WOMPI_WIDGET_SCRIPT_SRC;
      script.defer = true;
      script.dataset['wompiStatus'] = 'loading';
      script.onload = () => {
        script.dataset['wompiStatus'] = 'loaded';
        this.isScriptReady.set(true);
        this.scriptLoadPromise = null;
        resolve(true);
      };
      script.onerror = () => {
        script.dataset['wompiStatus'] = 'error';
        this.isScriptReady.set(false);
        this.scriptLoadPromise = null;
        resolve(false);
      };
      this.document.head.appendChild(script);
    });

    return this.scriptLoadPromise;
  }

  /**
   * Construye la URL de respaldo de Wompi Web Checkout para abrir en pestaña cuando el widget no está disponible.
   */
  buildWompiWebCheckoutUrl(
    session: Pick<
      WompiCheckoutSessionResult,
      'publicKey' | 'amountInCents' | 'reference' | 'integritySignature' | 'redirectUrl'
    >,
    fallbackRedirectUrl?: string
  ): string {
    const query = new URLSearchParams({
      'public-key': session.publicKey || WOMPI_SANDBOX_PUBLIC_KEY,
      currency: 'COP',
      'amount-in-cents': String(session.amountInCents ?? 0),
      reference: session.reference ?? '',
      'signature:integrity': session.integritySignature ?? ''
    });
    const effectiveRedirectUrl = session.redirectUrl || fallbackRedirectUrl;
    if (effectiveRedirectUrl) {
      query.set('redirect-url', effectiveRedirectUrl);
    }
    return `${WOMPI_WEB_CHECKOUT_URL}?${query.toString()}`;
  }

  private resolveCheckoutRedirectUrl(): string {
    if (this.isBrowser && typeof window !== 'undefined') {
      const origin = window.location?.origin;
      if (origin && origin !== 'null' && /^https?:\/\//i.test(origin)) {
        return `${origin.replace(/\/+$/, '')}/studio/designer?wompi_checkout=1`;
      }
    }
    return 'https://piezo3d.com/studio/designer?wompi_checkout=1';
  }

  private async verifyAndFinalizeWompiTransaction(
    txId: string,
    reference?: string,
    options?: { skipNavigation?: boolean }
  ): Promise<WompiVerifyTransactionResult> {
    if (typeof this.supabaseService.verifyWompiTransaction !== 'function') {
      return {
        success: false,
        errorCode: 'VERIFY_UNAVAILABLE',
        errorKey: 'account.billing.portalUnavailableToast'
      };
    }

    const verifyRes = await this.supabaseService.verifyWompiTransaction(txId, reference);
    if (!verifyRes.success) {
      if (verifyRes.errorCode === 'WOMPI_CONFIG_MISSING') {
        this.lastCheckoutError.set(
          'La pasarela de pagos requiere configurar las llaves de Wompi Colombia en el servidor.'
        );
      } else {
        this.lastCheckoutError.set(
          'No se pudo confirmar la transacción en este momento. Verifica tu historial en unos instantes.'
        );
      }
      return verifyRes;
    }

    const resolvedTxId = verifyRes.transactionId || txId;
    this.lastVerifiedTransactionId.set(resolvedTxId);

    const normalizedStatus = String(verifyRes.status ?? '').toUpperCase();
    if (verifyRes.approved) {
      this.lastCheckoutError.set(null);
      this.lastCheckoutSuccessAt.set(Date.now());
      this.closeUpgradeModal();

      try {
        await this.supabaseService.refreshUserProfile?.();
        await this.supabaseService.getSubscriptionInvoices?.(20);
      } catch {
        // Continuar con reintento diferido
      }

      setTimeout(() => {
        void this.supabaseService.refreshUserProfile?.();
        void this.supabaseService.getSubscriptionInvoices?.(20);
      }, 2500);

      if (!options?.skipNavigation) {
        const currentUrl = this.router.url || '';
        if (!currentUrl.startsWith('/studio')) {
          await this.router.navigateByUrl('/studio/designer');
        }
      }
    } else if (
      normalizedStatus === 'DECLINED' ||
      normalizedStatus === 'ERROR' ||
      normalizedStatus === 'VOIDED'
    ) {
      this.lastCheckoutError.set(
        'El pago no fue aprobado. Puedes reintentar con otro método de pago.'
      );
    }

    return verifyRes;
  }

  /**
   * Procesa el objeto de transacción devuelto por `WidgetCheckout.open(...)`,
   * verificándolo en el servidor, refrescando perfil/facturas y navegando al estudio si corresponde.
   */
  async handleWompiTransactionResult(
    transaction: WompiWidgetTransaction
  ): Promise<WompiVerifyTransactionResult> {
    const txId = typeof transaction?.id === 'string' ? transaction.id.trim() : '';
    if (!txId) {
      return {
        success: false,
        errorCode: 'INVALID_TRANSACTION_ID',
        errorKey: 'account.billing.portalUnavailableToast'
      };
    }

    return this.verifyAndFinalizeWompiTransaction(txId, transaction.reference);
  }

  /**
   * Procesa el retorno desde PSE / Botón Bancolombia extrayendo `?id=<txId>` de la URL,
   * verificando la transacción en el servidor y limpiando los parámetros de Wompi con `replaceUrl: true`.
   */
  async processWompiRedirectReturn(url?: string): Promise<WompiVerifyTransactionResult | null> {
    let candidateUrl = url ?? '';
    if (!candidateUrl) {
      const routerUrl = this.router.url || '';
      if (
        routerUrl.includes('id=') &&
        (routerUrl.includes('wompi_checkout=1') || routerUrl.includes('env='))
      ) {
        candidateUrl = routerUrl;
      } else if (this.isBrowser && typeof window !== 'undefined' && window.location?.href) {
        candidateUrl = window.location.href;
      } else {
        candidateUrl = routerUrl;
      }
    }

    if (!candidateUrl) {
      return null;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(candidateUrl, 'https://piezo3d.com');
    } catch {
      return null;
    }

    const txId = parsedUrl.searchParams.get('id')?.trim() ?? '';
    const hasWompiMarker =
      parsedUrl.searchParams.get('wompi_checkout') === '1' || parsedUrl.searchParams.has('env');
    if (!txId || !hasWompiMarker) {
      return null;
    }

    const existingPromise = this.inFlightRedirectVerifications.get(txId);
    if (existingPromise) {
      return existingPromise;
    }

    const reference = parsedUrl.searchParams.get('reference')?.trim() || undefined;
    const verificationPromise = (async (): Promise<WompiVerifyTransactionResult> => {
      try {
        const result = await this.verifyAndFinalizeWompiTransaction(txId, reference, {
          skipNavigation: true
        });

        const remainingParams: Record<string, string> = {};
        parsedUrl.searchParams.forEach((value, key) => {
          if (
            key !== 'wompi_checkout' &&
            key !== 'id' &&
            key !== 'env' &&
            key !== 'reference'
          ) {
            remainingParams[key] = value;
          }
        });

        const targetPath =
          parsedUrl.pathname && parsedUrl.pathname.startsWith('/studio')
            ? parsedUrl.pathname
            : '/studio/designer';

        await this.router.navigate([targetPath], {
          queryParams: remainingParams,
          replaceUrl: true
        });

        return result;
      } finally {
        this.inFlightRedirectVerifications.delete(txId);
      }
    })();

    this.inFlightRedirectVerifications.set(txId, verificationPromise);
    return verificationPromise;
  }

  private async launchWompiCheckout(plan: PaidPlan, cycle: BillingCycle): Promise<void> {
    if (!this.isBrowser || typeof window === 'undefined') {
      return;
    }

    this.isPreparingCheckout.set(true);
    this.lastCheckoutError.set(null);

    try {
      if (typeof this.supabaseService.createWompiCheckoutSession !== 'function') {
        this.lastCheckoutError.set(
          'El servicio de checkout no está disponible en este momento.'
        );
        return;
      }

      const redirectUrl = this.resolveCheckoutRedirectUrl();
      const sessionRes = await this.supabaseService.createWompiCheckoutSession({
        plan,
        billingCycle: cycle,
        redirectUrl
      });

      if (
        !sessionRes?.success ||
        !sessionRes.reference ||
        !sessionRes.amountInCents ||
        !sessionRes.integritySignature
      ) {
        if (sessionRes?.errorCode === 'WOMPI_CONFIG_MISSING') {
          this.lastCheckoutError.set(
            'La pasarela de pagos requiere configurar las llaves de Wompi Colombia en el servidor.'
          );
        } else if (sessionRes?.errorCode === 'UNAUTHENTICATED') {
          this.lastCheckoutError.set('Debes iniciar sesión para continuar con el pago.');
        } else {
          this.lastCheckoutError.set(
            'No fue posible iniciar el checkout de pago. Intenta nuevamente en unos segundos.'
          );
        }
        return;
      }

      const publicKey = sessionRes.publicKey || WOMPI_SANDBOX_PUBLIC_KEY;
      const effectiveRedirectUrl = sessionRes.redirectUrl || redirectUrl;

      await this.ensureWompiScriptLoaded();

      if (typeof window.WidgetCheckout === 'function') {
        try {
          const customerData =
            sessionRes.customerEmail || sessionRes.customerName
              ? {
                  ...(sessionRes.customerEmail ? { email: sessionRes.customerEmail } : {}),
                  ...(sessionRes.customerName ? { fullName: sessionRes.customerName } : {})
                }
              : undefined;

          const widget = new window.WidgetCheckout({
            currency: 'COP',
            amountInCents: sessionRes.amountInCents,
            reference: sessionRes.reference,
            publicKey,
            redirectUrl: effectiveRedirectUrl,
            signature: {
              integrity: sessionRes.integritySignature
            },
            ...(customerData ? { customerData } : {})
          });

          widget.open((result: WompiWidgetTransactionResult) => {
            const tx = result?.transaction;
            if (!tx?.id) {
              return;
            }
            const status = String(tx.status ?? '').toUpperCase();
            if (status === 'DECLINED' || status === 'ERROR' || status === 'VOIDED') {
              this.lastCheckoutError.set(
                'El pago no fue aprobado. Puedes intentar con otro medio de pago.'
              );
              return;
            }
            void this.handleWompiTransactionResult(tx);
          });
          return;
        } catch {
          // Continuar al fallback Web Checkout si el widget falla al instanciar
        }
      }

      const fallbackUrl = this.buildWompiWebCheckoutUrl(sessionRes, effectiveRedirectUrl);
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    } finally {
      this.isPreparingCheckout.set(false);
    }
  }

  /**
   * Abre el Checkout de Wompi Colombia para el plan y ciclo elegidos.
   * Si la pasarela está en modo protegido (`early_access_protected`), abre el modal de Acceso Anticipado
   * sin redirigir a `/auth` ni invocar Wompi.
   * En modo `live_checkout`, si el usuario no ha iniciado sesión, guarda la intención y redirige a `/auth?mode=register&plan=...&cycle=...`.
   */
  async openCheckout(plan: PaidPlan, cycle: CheckoutCycleInput = 'monthly'): Promise<void> {
    const normalizedCycle = this.normalizeCycle(cycle);

    if (this.paymentsMode() === 'early_access_protected') {
      this.clearPendingCheckout();
      this.openEarlyAccessModal(plan, normalizedCycle);
      return;
    }

    if (!this.supabaseService.isAuthenticated?.()) {
      this.savePendingCheckout({ plan, cycle: normalizedCycle });
      await this.router.navigate(['/auth'], {
        queryParams: {
          mode: 'register',
          plan,
          cycle: normalizedCycle
        }
      });
      return;
    }

    this.clearPendingCheckout();
    this.closeUpgradeModal();
    await this.launchWompiCheckout(plan, normalizedCycle);
  }

  /**
   * Permite al SuperAdmin probar el flujo real del Checkout de Wompi Colombia
   * sin desactivar la protección pública (`early_access_protected`) si estuviera activa.
   */
  async testAdminCheckout(plan: PaidPlan, cycle: CheckoutCycleInput = 'monthly'): Promise<void> {
    const normalizedCycle = this.normalizeCycle(cycle);
    await this.launchWompiCheckout(plan, normalizedCycle);
  }

  /**
   * Guarda una intención de compra pendiente en `sessionStorage` para retomarla tras el registro/login.
   */
  savePendingCheckout(intent: PendingCheckoutIntent): void {
    if (!this.isBrowser || typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(PENDING_CHECKOUT_STORAGE_KEY, JSON.stringify(intent));
    } catch {
      // Ignorar si sessionStorage no está disponible
    }
  }

  /**
   * Obtiene y limpia la intención de compra pendiente almacenada en `sessionStorage`.
   */
  consumePendingCheckout(): PendingCheckoutIntent | null {
    if (!this.isBrowser || typeof sessionStorage === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const plan = parsed['plan'] === 'industrial' ? 'industrial' : (parsed['plan'] === 'pro' ? 'pro' : null);
      if (!plan) return null;
      const cycle = this.normalizeCycle(String(parsed['cycle'] ?? 'monthly'));
      return { plan, cycle };
    } catch {
      return null;
    }
  }

  /**
   * Limpia cualquier intención de compra pendiente en `sessionStorage`.
   */
  clearPendingCheckout(): void {
    if (!this.isBrowser || typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
    } catch {
      // no-op
    }
  }

  /**
   * Verifica si el usuario puede agregar un nuevo módulo a la escena 3D.
   * En el Plan Inicial (`free`), el límite es de hasta 3 módulos por escena.
   */
  canAddModuleToScene(currentModulesCount: number): boolean {
    if (!this.isFreePlanRestricted()) {
      return true;
    }
    return currentModulesCount < FREE_PLAN_MAX_MODULES;
  }

  /**
   * Abre el modal de mejora de suscripción indicando el motivo y el plan requerido.
   */
  openUpgradeModal(reason: UpgradeReason, requiredPlan: PaidPlan = 'pro', featureName?: string): void {
    this.upgradeModalState.set({
      reason,
      requiredPlan,
      featureName
    });
  }

  /**
   * Cierra el modal de mejora de suscripción.
   */
  closeUpgradeModal(): void {
    this.upgradeModalState.set(null);
  }
}
