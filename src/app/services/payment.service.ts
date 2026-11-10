import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BillingCycle, SupabaseService } from './supabase.service';

export type PaidPlan = 'pro' | 'industrial';
export type CheckoutCycleInput = 'monthly' | 'annual' | 'yearly';
export type UpgradeReason = 'modules_limit' | 'workshop_export' | 'cnc_export';

export interface CheckoutVariantConfig {
  plan: PaidPlan;
  cycle: BillingCycle;
  variantId: string;
  baseUrl: string;
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

interface LemonSqueezyEventPayload {
  event: string;
  data?: Record<string, unknown>;
}

interface LemonSqueezyGlobal {
  Setup?: (config: { eventHandler: (event: LemonSqueezyEventPayload) => void }) => void;
  Url?: {
    Open: (url: string) => void;
    Close?: () => void;
  };
}

declare global {
  interface Window {
    createLemonSqueezy?: () => void;
    LemonSqueezy?: LemonSqueezyGlobal;
  }
}

export const FREE_PLAN_MAX_MODULES = 3;

export const CHECKOUT_VARIANTS: Record<PaidPlan, Record<BillingCycle, CheckoutVariantConfig>> = {
  pro: {
    monthly: {
      plan: 'pro',
      cycle: 'monthly',
      variantId: '2359025',
      baseUrl: 'https://piezo3d.lemonsqueezy.com/checkout/buy/a40b0776-67df-46df-a8cf-56e81733f63e?embed=1&enabled=2359025',
      priceUsd: 15,
      monthlyEquivalentUsd: 15
    },
    annual: {
      plan: 'pro',
      cycle: 'annual',
      variantId: '2359008',
      baseUrl: 'https://piezo3d.lemonsqueezy.com/checkout/buy/fa99e4fd-8006-4c21-bc89-e27cf92d2a16?embed=1&enabled=2359008',
      priceUsd: 144,
      monthlyEquivalentUsd: 12
    }
  },
  industrial: {
    monthly: {
      plan: 'industrial',
      cycle: 'monthly',
      variantId: '2359108',
      baseUrl: 'https://piezo3d.lemonsqueezy.com/checkout/buy/e401ebb9-d089-4949-af7b-aeeb3612ace6?embed=1&enabled=2359108',
      priceUsd: 29,
      monthlyEquivalentUsd: 29
    },
    annual: {
      plan: 'industrial',
      cycle: 'annual',
      variantId: '2359083',
      baseUrl: 'https://piezo3d.lemonsqueezy.com/checkout/buy/c086c431-b940-4043-b7a6-3816e6f0577f?embed=1&enabled=2359083',
      priceUsd: 276,
      monthlyEquivalentUsd: 23
    }
  }
};

const PENDING_CHECKOUT_STORAGE_KEY = 'piezo3d_pending_checkout';
const LEMON_JS_SCRIPT_SRC = 'https://assets.lemonsqueezy.com/lemon.js';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly supabaseService = inject(SupabaseService);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private scriptLoadPromise: Promise<boolean> | null = null;
  private isSetupRegistered = false;

  readonly isScriptReady = signal<boolean>(false);
  readonly lastCheckoutSuccessAt = signal<number | null>(null);
  readonly upgradeModalState = signal<UpgradeModalState | null>(null);

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

  constructor() {
    if (this.isBrowser) {
      void this.ensureLemonScriptLoaded();
    }
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
   * Obtiene la configuración de variante para un plan y ciclo dados.
   */
  getVariantConfig(plan: PaidPlan, cycle: CheckoutCycleInput = 'monthly'): CheckoutVariantConfig {
    const normalizedCycle = this.normalizeCycle(cycle);
    return CHECKOUT_VARIANTS[plan][normalizedCycle];
  }

  /**
   * Construye la URL completa del Checkout Overlay con los parámetros de pre-llenado del usuario autenticado.
   */
  buildCheckoutUrl(plan: PaidPlan, cycle: CheckoutCycleInput = 'monthly'): string {
    const normalizedCycle = this.normalizeCycle(cycle);
    const variant = CHECKOUT_VARIANTS[plan][normalizedCycle];
    const user = this.supabaseService.currentUser?.() ?? null;
    const profile = this.supabaseService.userProfile?.() ?? null;

    if (!user) {
      return variant.baseUrl;
    }

    const email = (profile?.email || user.email || '').trim();
    const firstName = (profile?.first_name || '').trim();
    const lastName = (profile?.last_name || '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || email.split('@')[0] || 'Usuario';

    const params: string[] = [
      `checkout[email]=${encodeURIComponent(email)}`,
      `checkout[name]=${encodeURIComponent(fullName)}`,
      `checkout[custom][user_id]=${encodeURIComponent(user.id)}`,
      `checkout[custom][plan]=${encodeURIComponent(plan)}`,
      `checkout[custom][billing_cycle]=${encodeURIComponent(normalizedCycle)}`
    ];

    return `${variant.baseUrl}&${params.join('&')}`;
  }

  /**
   * Carga dinámicamente `https://assets.lemonsqueezy.com/lemon.js` en el `<head>`,
   * inicializa `window.createLemonSqueezy?.()` y registra el listener de `Checkout.Success`.
   */
  ensureLemonScriptLoaded(): Promise<boolean> {
    if (!this.isBrowser || typeof window === 'undefined') {
      return Promise.resolve(false);
    }

    if (window.LemonSqueezy?.Url?.Open) {
      this.initializeLemonOverlay();
      this.isScriptReady.set(true);
      return Promise.resolve(true);
    }

    if (this.scriptLoadPromise) {
      return this.scriptLoadPromise;
    }

    this.scriptLoadPromise = new Promise<boolean>((resolve) => {
      const existingScript = this.document.querySelector(
        `script[src="${LEMON_JS_SCRIPT_SRC}"]`
      ) as HTMLScriptElement | null;

      if (existingScript) {
        this.initializeLemonOverlay();
        this.isScriptReady.set(Boolean(window.LemonSqueezy?.Url?.Open));
        resolve(true);
        return;
      }

      const script = this.document.createElement('script');
      script.src = LEMON_JS_SCRIPT_SRC;
      script.defer = true;
      script.onload = () => {
        this.initializeLemonOverlay();
        this.isScriptReady.set(true);
        resolve(true);
      };
      script.onerror = () => {
        this.isScriptReady.set(false);
        resolve(false);
      };
      this.document.head.appendChild(script);
    });

    return this.scriptLoadPromise;
  }

  /**
   * Inicializa el objeto global `LemonSqueezy` y suscribe el callback `Checkout.Success`
   * para cerrar el overlay, refrescar el perfil y las facturas en segundo plano y navegar a `/studio/designer` sin recargar la página.
   */
  private initializeLemonOverlay(): void {
    if (!this.isBrowser || typeof window === 'undefined') return;

    try {
      window.createLemonSqueezy?.();
      if (window.LemonSqueezy?.Setup && !this.isSetupRegistered) {
        this.isSetupRegistered = true;
        window.LemonSqueezy.Setup({
          eventHandler: async (event: LemonSqueezyEventPayload) => {
            if (event?.event === 'Checkout.Success') {
              await this.handleCheckoutSuccess();
            }
          }
        });
      }
    } catch {
      // Continuar con fallback de apertura estándar si el navegador restringe el objeto global
    }
  }

  /**
   * Procesa el evento `Checkout.Success` cerrando automáticamente el overlay de Lemon Squeezy,
   * actualizando el perfil y las facturas del usuario y navegando internamente a `/studio/designer`.
   */
  async handleCheckoutSuccess(): Promise<void> {
    if (this.isBrowser && typeof window !== 'undefined') {
      try {
        window.LemonSqueezy?.Url?.Close?.();
      } catch {
        // Ignorar si el overlay ya fue cerrado por el usuario
      }
    }

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

    const currentUrl = this.router.url || '';
    if (!currentUrl.startsWith('/studio')) {
      await this.router.navigateByUrl('/studio/designer');
    }
  }

  /**
   * Abre el Checkout Overlay para el plan y ciclo elegidos.
   * Si el usuario no ha iniciado sesión, guarda la intención y redirige a `/auth?mode=register&plan=...&cycle=...`.
   */
  async openCheckout(plan: PaidPlan, cycle: CheckoutCycleInput = 'monthly'): Promise<void> {
    const normalizedCycle = this.normalizeCycle(cycle);

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

    const finalUrl = this.buildCheckoutUrl(plan, normalizedCycle);
    if (!this.isBrowser || typeof window === 'undefined') {
      return;
    }

    await this.ensureLemonScriptLoaded();
    this.initializeLemonOverlay();

    if (window.LemonSqueezy?.Url?.Open) {
      window.LemonSqueezy.Url.Open(finalUrl);
      return;
    }

    window.open(finalUrl, '_blank', 'noopener,noreferrer');
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
