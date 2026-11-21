/**
 * Modelos de configuración dinámica de precios, promociones, pasarela de pagos
 * y sello de propiedad intelectual para la Landing Page y el estudio.
 */

export type LandingPlanId = 'starter' | 'pro' | 'industrial';

export interface LandingPlanFeature {
  text: string;
  isBold?: boolean;
  isLimitation?: boolean;
}

export interface LandingPlanConfig {
  id: LandingPlanId;
  eyebrow: string;
  name: string;
  description: string;
  priceCopMonthly: number;
  isFree: boolean;
  isPopular: boolean;
  highlightNote?: string;
  ctaLabel: string;
  features: LandingPlanFeature[];
}

export interface LandingPricingConfig {
  id: string;
  payments_enabled: boolean;
  payments_notice_title: string;
  payments_notice_message: string;
  payments_disabled_cta_label: string;
  promo_enabled: boolean;
  promo_badge: string;
  promo_message: string;
  promo_code: string;
  promo_expires_at: string | null;
  promo_discount_percent: number;
  ip_guarantee_enabled: boolean;
  ip_guarantee_title: string;
  ip_guarantee_description: string;
  annual_discount_percent: number;
  plans: LandingPlanConfig[];
  updated_at?: string | null;
  updated_by?: string | null;
}

export interface LandingPricingConfigSaveResult {
  success: boolean;
  data?: LandingPricingConfig;
  error?: string;
}

export const LANDING_PRICING_PROMO_DISCOUNT_MIN = 0;
export const LANDING_PRICING_PROMO_DISCOUNT_MAX = 90;
export const LANDING_PRICING_ANNUAL_DISCOUNT_MIN = 0;
export const LANDING_PRICING_ANNUAL_DISCOUNT_MAX = 80;

export const DEFAULT_LANDING_PRICING_CONFIG: LandingPricingConfig = {
  id: 'default',
  payments_enabled: false,
  payments_notice_title: 'Pagos en línea en implementación',
  payments_notice_message:
    'Actualmente puedes crear tu cuenta gratuita y diseñar proyectos en el estudio. Estamos finalizando la habilitación de pagos en línea; muy pronto podrás activar nuestros planes de pago.',
  payments_disabled_cta_label: 'Próximamente',
  promo_enabled: false,
  promo_badge: 'Oferta Especial',
  promo_message:
    'Aprovecha el descuento especial de lanzamiento en planes anuales para tu taller.',
  promo_code: '',
  promo_expires_at: null,
  promo_discount_percent: 0,
  ip_guarantee_enabled: true,
  ip_guarantee_title: '100% Propiedad Intelectual Tuya',
  ip_guarantee_description:
    'Todos los proyectos, despieces, modelos 3D, archivos de corte y diseños que crees dentro de la plataforma pertenecen única y exclusivamente a ti. Nunca reclamamos derechos ni reutilizamos tus planos.',
  annual_discount_percent: 20,
  plans: [
    {
      id: 'starter',
      eyebrow: 'MODO EXPLORACIÓN',
      name: 'Plan Inicial',
      description:
        'Para conocer la plataforma, probar el diseñador 3D en vivo y armar tu primer boceto.',
      priceCopMonthly: 0,
      isFree: true,
      isPopular: false,
      highlightNote: '',
      ctaLabel: 'Probar Gratis Ahora',
      features: [
        {
          text: 'Diseñador 3D Paramétrico y Luz Interna en vivo',
          isBold: false,
          isLimitation: false
        },
        {
          text: 'Prueba de cajones inteligentes y plantillas base',
          isBold: false,
          isLimitation: false
        },
        {
          text: 'Vista previa en pantalla de Despiece y Presupuesto',
          isBold: false,
          isLimitation: false
        },
        {
          text: '100% propiedad intelectual de tus diseños y modelos 3D',
          isBold: true,
          isLimitation: false
        },
        {
          text: 'Límite de 1 proyecto activo (máximo 3 módulos)',
          isBold: false,
          isLimitation: true
        },
        {
          text: 'Optimizador 2D solo en vista previa (1 tablero)',
          isBold: false,
          isLimitation: true
        },
        {
          text: 'Sin descargas PDF, Guías de Armado, Etiquetas ni CNC',
          isBold: false,
          isLimitation: true
        }
      ]
    },
    {
      id: 'pro',
      eyebrow: 'MÁS POPULAR',
      name: 'Plan Taller Pro',
      description:
        'Todo lo que un carpintero o diseñador necesita para cotizar, optimizar y fabricar sin límites.',
      priceCopMonthly: 49900,
      isFree: false,
      isPopular: true,
      highlightNote: 'Se paga solo ahorrando menos de medio tablero de melamina al mes.',
      ctaLabel: 'Elegir Plan Taller Pro',
      features: [
        {
          text: 'Proyectos y módulos 3D ilimitados en la nube',
          isBold: false,
          isLimitation: false
        },
        {
          text: 'Optimizador 2D Guillotina completo (veta, kerf y tapacanto)',
          isBold: false,
          isLimitation: false
        },
        {
          text: 'Descarga de Planos de Corte 2D en PDF listos para taller',
          isBold: false,
          isLimitation: false
        },
        {
          text: 'Generador de Guías de Armado RTA en PDF paso a paso',
          isBold: false,
          isLimitation: false
        },
        {
          text: 'Impresión de Etiquetas de taller con diagrama de cantos',
          isBold: false,
          isLimitation: false
        },
        {
          text: 'Presupuesto Multimoneda completo con margen de utilidad',
          isBold: false,
          isLimitation: false
        },
        {
          text: '100% propiedad intelectual de tus diseños y modelos 3D',
          isBold: true,
          isLimitation: false
        }
      ]
    },
    {
      id: 'industrial',
      eyebrow: 'PARA FÁBRICAS Y CENTROS DE CORTE',
      name: 'Plan Industrial & CNC',
      description:
        'Para talleres automatizados con router CNC, estudios de arquitectura y producción en serie.',
      priceCopMonthly: 95900,
      isFree: false,
      isPopular: false,
      highlightNote: '',
      ctaLabel: 'Elegir Plan Industrial',
      features: [
        {
          text: 'Todo lo incluido en el Plan Taller Pro sin límites',
          isBold: false,
          isLimitation: false
        },
        {
          text: 'Exportación DXF CNC por capas vectoriales (LWPOLYLINE)',
          isBold: false,
          isLimitation: false
        },
        {
          text: 'Exportación de Modelo 3D agrupado (.DAE COLLADA)',
          isBold: false,
          isLimitation: false
        },
        {
          text: 'Creación de catálogos propios de melamina, piedras y herrajes',
          isBold: false,
          isLimitation: false
        },
        {
          text: 'Personalización de marca/logo en PDFs de presupuesto y armado',
          isBold: false,
          isLimitation: false
        },
        {
          text: 'Soporte técnico prioritario para taller',
          isBold: false,
          isLimitation: false
        },
        {
          text: '100% propiedad intelectual de tus diseños y modelos 3D',
          isBold: true,
          isLimitation: false
        }
      ]
    }
  ],
  updated_at: null,
  updated_by: null
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLandingPlanId(value: unknown): value is LandingPlanId {
  return value === 'starter' || value === 'pro' || value === 'industrial';
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

/**
 * Ajusta el porcentaje de descuento promocional dentro del rango permitido (`0..90`).
 */
export function clampPromoDiscountPercent(value: unknown, fallback = 0): number {
  return clampInteger(
    value,
    LANDING_PRICING_PROMO_DISCOUNT_MIN,
    LANDING_PRICING_PROMO_DISCOUNT_MAX,
    fallback
  );
}

/**
 * Ajusta el porcentaje de descuento anual dentro del rango permitido (`0..80`).
 */
export function clampAnnualDiscountPercent(value: unknown, fallback = 20): number {
  return clampInteger(
    value,
    LANDING_PRICING_ANNUAL_DISCOUNT_MIN,
    LANDING_PRICING_ANNUAL_DISCOUNT_MAX,
    fallback
  );
}

/**
 * Calcula la tarifa mensual equivalente en COP al facturar en ciclo anual.
 */
export function computeAnnualMonthlyCop(
  monthlyCop: number,
  annualDiscountPercent: number
): number {
  const safeMonthly =
    typeof monthlyCop === 'number' && Number.isFinite(monthlyCop) && monthlyCop > 0
      ? Math.round(monthlyCop)
      : 0;
  if (safeMonthly <= 0) {
    return 0;
  }
  const clampedDiscount = clampAnnualDiscountPercent(annualDiscountPercent, 20);
  return Math.round(safeMonthly * (1 - clampedDiscount / 100));
}

/**
 * Calcula el monto total anual en COP (12 meses) con el descuento anual aplicado.
 */
export function computeAnnualTotalCop(
  monthlyCop: number,
  annualDiscountPercent: number
): number {
  return computeAnnualMonthlyCop(monthlyCop, annualDiscountPercent) * 12;
}

/**
 * Evalúa de forma determinista si la promoción está activa para una marca temporal dada.
 */
export function isPromoActiveAt(
  cfg: Pick<LandingPricingConfig, 'promo_enabled' | 'promo_expires_at'>,
  nowMs: number = Date.now()
): boolean {
  if (cfg.promo_enabled !== true) {
    return false;
  }
  if (cfg.promo_expires_at === null || cfg.promo_expires_at === undefined) {
    return true;
  }
  const rawExpiration =
    typeof cfg.promo_expires_at === 'string' ? cfg.promo_expires_at.trim() : '';
  if (!rawExpiration) {
    return true;
  }
  const ts = new Date(rawExpiration).getTime();
  return Number.isFinite(ts) && ts > nowMs;
}

function clonePlanConfig(plan: LandingPlanConfig): LandingPlanConfig {
  return {
    ...plan,
    features: plan.features.map((feature) => ({
      text: feature.text,
      isBold: Boolean(feature.isBold),
      isLimitation: Boolean(feature.isLimitation)
    }))
  };
}

/**
 * Crea una copia profunda e independiente de `LandingPricingConfig`.
 */
export function cloneLandingPricingConfig(config: LandingPricingConfig): LandingPricingConfig {
  return {
    ...config,
    plans: config.plans.map((plan) => clonePlanConfig(plan))
  };
}

function normalizePromoExpiration(value: unknown, fallback: string | null): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const ts = new Date(trimmed).getTime();
    return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
  }
  if (value === undefined) {
    return fallback;
  }
  return null;
}

function normalizePlanFeatures(
  rawFeatures: unknown,
  fallbackFeatures: LandingPlanFeature[]
): LandingPlanFeature[] {
  if (!Array.isArray(rawFeatures)) {
    return fallbackFeatures.map((feature) => ({ ...feature }));
  }

  const normalized: LandingPlanFeature[] = [];
  for (const item of rawFeatures) {
    if (!isPlainRecord(item)) {
      continue;
    }
    const text = typeof item['text'] === 'string' ? item['text'].trim() : '';
    if (!text) {
      continue;
    }
    normalized.push({
      text,
      isBold: Boolean(item['isBold']),
      isLimitation: Boolean(item['isLimitation'])
    });
  }

  if (rawFeatures.length > 0 && normalized.length === 0) {
    return fallbackFeatures.map((feature) => ({ ...feature }));
  }

  return normalized;
}

function normalizePlans(
  rawPlans: unknown,
  fallbackPlans: LandingPlanConfig[]
): LandingPlanConfig[] {
  let candidate: unknown = rawPlans;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate) as unknown;
    } catch {
      candidate = null;
    }
  }

  if (!Array.isArray(candidate) || candidate.length === 0) {
    return fallbackPlans.map((plan) => clonePlanConfig(plan));
  }

  const normalized: LandingPlanConfig[] = [];
  for (const entry of candidate) {
    if (!isPlainRecord(entry) || !isLandingPlanId(entry['id'])) {
      continue;
    }
    const planId = entry['id'];
    const fallbackPlan =
      fallbackPlans.find((plan) => plan.id === planId) ??
      DEFAULT_LANDING_PRICING_CONFIG.plans.find((plan) => plan.id === planId) ??
      DEFAULT_LANDING_PRICING_CONFIG.plans[0];

    const isFree = typeof entry['isFree'] === 'boolean' ? entry['isFree'] : fallbackPlan.isFree;
    const rawPrice = Number(entry['priceCopMonthly']);
    const resolvedPrice = isFree
      ? 0
      : Number.isFinite(rawPrice) && rawPrice >= 0
        ? Math.round(rawPrice)
        : fallbackPlan.priceCopMonthly;

    normalized.push({
      id: planId,
      eyebrow:
        typeof entry['eyebrow'] === 'string' ? entry['eyebrow'].trim() : fallbackPlan.eyebrow,
      name:
        typeof entry['name'] === 'string' && entry['name'].trim()
          ? entry['name'].trim()
          : fallbackPlan.name,
      description:
        typeof entry['description'] === 'string' && entry['description'].trim()
          ? entry['description'].trim()
          : fallbackPlan.description,
      priceCopMonthly: resolvedPrice,
      isFree,
      isPopular:
        typeof entry['isPopular'] === 'boolean' ? entry['isPopular'] : fallbackPlan.isPopular,
      highlightNote:
        typeof entry['highlightNote'] === 'string'
          ? entry['highlightNote'].trim()
          : (fallbackPlan.highlightNote ?? ''),
      ctaLabel:
        typeof entry['ctaLabel'] === 'string' && entry['ctaLabel'].trim()
          ? entry['ctaLabel'].trim()
          : fallbackPlan.ctaLabel,
      features: normalizePlanFeatures(entry['features'], fallbackPlan.features)
    });
  }

  return normalized.length > 0
    ? normalized
    : fallbackPlans.map((plan) => clonePlanConfig(plan));
}

function resolveNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function resolveStringAllowEmpty(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

/**
 * Sanitiza y normaliza una fila o borrador hacia un `LandingPricingConfig` tipado y seguro.
 */
export function normalizeLandingPricingConfig(
  raw: unknown,
  fallback: LandingPricingConfig = DEFAULT_LANDING_PRICING_CONFIG
): LandingPricingConfig {
  const safeFallback = cloneLandingPricingConfig(fallback);
  if (!isPlainRecord(raw)) {
    return safeFallback;
  }

  return {
    id: 'default',
    payments_enabled:
      typeof raw['payments_enabled'] === 'boolean'
        ? raw['payments_enabled']
        : safeFallback.payments_enabled,
    payments_notice_title: resolveNonEmptyString(
      raw['payments_notice_title'],
      safeFallback.payments_notice_title
    ),
    payments_notice_message: resolveNonEmptyString(
      raw['payments_notice_message'],
      safeFallback.payments_notice_message
    ),
    payments_disabled_cta_label: resolveNonEmptyString(
      raw['payments_disabled_cta_label'],
      safeFallback.payments_disabled_cta_label
    ),
    promo_enabled:
      typeof raw['promo_enabled'] === 'boolean'
        ? raw['promo_enabled']
        : safeFallback.promo_enabled,
    promo_badge: resolveStringAllowEmpty(raw['promo_badge'], safeFallback.promo_badge),
    promo_message: resolveStringAllowEmpty(raw['promo_message'], safeFallback.promo_message),
    promo_code: resolveStringAllowEmpty(raw['promo_code'], safeFallback.promo_code),
    promo_expires_at: normalizePromoExpiration(
      raw['promo_expires_at'],
      safeFallback.promo_expires_at
    ),
    promo_discount_percent: clampPromoDiscountPercent(
      raw['promo_discount_percent'],
      safeFallback.promo_discount_percent
    ),
    ip_guarantee_enabled:
      typeof raw['ip_guarantee_enabled'] === 'boolean'
        ? raw['ip_guarantee_enabled']
        : safeFallback.ip_guarantee_enabled,
    ip_guarantee_title: resolveNonEmptyString(
      raw['ip_guarantee_title'],
      safeFallback.ip_guarantee_title
    ),
    ip_guarantee_description: resolveNonEmptyString(
      raw['ip_guarantee_description'],
      safeFallback.ip_guarantee_description
    ),
    annual_discount_percent: clampAnnualDiscountPercent(
      raw['annual_discount_percent'],
      safeFallback.annual_discount_percent
    ),
    plans: normalizePlans(raw['plans'], safeFallback.plans),
    updated_at:
      typeof raw['updated_at'] === 'string'
        ? raw['updated_at']
        : raw['updated_at'] === null
          ? null
          : (safeFallback.updated_at ?? null),
    updated_by:
      typeof raw['updated_by'] === 'string'
        ? raw['updated_by']
        : raw['updated_by'] === null
          ? null
          : (safeFallback.updated_by ?? null)
  };
}
