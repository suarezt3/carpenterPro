-- Configuracion dinamica de la seccion de precios, promociones, pagos y garantia de IP en la Landing Page
-- Tabla singleton (id = 'default') administrada por el Panel Superadmin con RLS estricto.

CREATE TABLE IF NOT EXISTS public.landing_pricing_config (
  id text PRIMARY KEY DEFAULT 'default',
  payments_enabled boolean NOT NULL DEFAULT false,
  payments_notice_title text NOT NULL DEFAULT 'Pagos en línea en implementación',
  payments_notice_message text NOT NULL DEFAULT 'Actualmente puedes crear tu cuenta gratuita y diseñar proyectos en el estudio. Estamos finalizando la habilitación de pagos en línea; muy pronto podrás activar nuestros planes de pago.',
  payments_disabled_cta_label text NOT NULL DEFAULT 'Próximamente',
  promo_enabled boolean NOT NULL DEFAULT false,
  promo_badge text NOT NULL DEFAULT 'Oferta Especial',
  promo_message text NOT NULL DEFAULT '',
  promo_code text NOT NULL DEFAULT '',
  promo_expires_at timestamptz NULL,
  promo_discount_percent integer NOT NULL DEFAULT 0,
  ip_guarantee_enabled boolean NOT NULL DEFAULT true,
  ip_guarantee_title text NOT NULL DEFAULT '100% Propiedad Intelectual Tuya',
  ip_guarantee_description text NOT NULL DEFAULT 'Todos los proyectos, despieces, modelos 3D, archivos de corte y diseños que crees dentro de la plataforma pertenecen única y exclusivamente a ti. Nunca reclamamos derechos ni reutilizamos tus planos.',
  annual_discount_percent integer NOT NULL DEFAULT 20,
  plans jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT landing_pricing_config_singleton_id CHECK (id = 'default'),
  CONSTRAINT landing_pricing_config_promo_discount_range CHECK (promo_discount_percent >= 0 AND promo_discount_percent <= 90),
  CONSTRAINT landing_pricing_config_annual_discount_range CHECK (annual_discount_percent >= 0 AND annual_discount_percent <= 80),
  CONSTRAINT landing_pricing_config_plans_nonempty_array CHECK (
    jsonb_typeof(plans) = 'array' AND jsonb_array_length(plans) >= 1
  )
);

CREATE OR REPLACE FUNCTION public.touch_landing_pricing_config_audit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_landing_pricing_config_audit ON public.landing_pricing_config;
CREATE TRIGGER trg_landing_pricing_config_audit
  BEFORE INSERT OR UPDATE ON public.landing_pricing_config
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_landing_pricing_config_audit();

ALTER TABLE public.landing_pricing_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.landing_pricing_config FROM PUBLIC;
GRANT SELECT ON public.landing_pricing_config TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.landing_pricing_config TO authenticated;

DROP POLICY IF EXISTS "Public can read default landing pricing config" ON public.landing_pricing_config;
CREATE POLICY "Public can read default landing pricing config"
  ON public.landing_pricing_config
  FOR SELECT
  TO anon, authenticated
  USING (id = 'default');

DROP POLICY IF EXISTS "Superadmin can insert landing pricing config" ON public.landing_pricing_config;
CREATE POLICY "Superadmin can insert landing pricing config"
  ON public.landing_pricing_config
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Superadmin can update landing pricing config" ON public.landing_pricing_config;
CREATE POLICY "Superadmin can update landing pricing config"
  ON public.landing_pricing_config
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Superadmin can delete landing pricing config" ON public.landing_pricing_config;
CREATE POLICY "Superadmin can delete landing pricing config"
  ON public.landing_pricing_config
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

INSERT INTO public.landing_pricing_config (
  id,
  payments_enabled,
  payments_notice_title,
  payments_notice_message,
  payments_disabled_cta_label,
  promo_enabled,
  promo_badge,
  promo_message,
  promo_code,
  promo_expires_at,
  promo_discount_percent,
  ip_guarantee_enabled,
  ip_guarantee_title,
  ip_guarantee_description,
  annual_discount_percent,
  plans
)
VALUES (
  'default',
  false,
  'Pagos en línea en implementación',
  'Actualmente puedes crear tu cuenta gratuita y diseñar proyectos en el estudio. Estamos finalizando la habilitación de pagos en línea; muy pronto podrás activar nuestros planes de pago.',
  'Próximamente',
  false,
  'Oferta Especial',
  'Aprovecha el descuento especial de lanzamiento en planes anuales para tu taller.',
  '',
  NULL,
  0,
  true,
  '100% Propiedad Intelectual Tuya',
  'Todos los proyectos, despieces, modelos 3D, archivos de corte y diseños que crees dentro de la plataforma pertenecen única y exclusivamente a ti. Nunca reclamamos derechos ni reutilizamos tus planos.',
  20,
  '[
    {
      "id": "starter",
      "eyebrow": "MODO EXPLORACIÓN",
      "name": "Plan Inicial",
      "description": "Para conocer la plataforma, probar el diseñador 3D en vivo y armar tu primer boceto.",
      "priceCopMonthly": 0,
      "isFree": true,
      "isPopular": false,
      "highlightNote": "",
      "ctaLabel": "Probar Gratis Ahora",
      "features": [
        { "text": "Diseñador 3D Paramétrico y Luz Interna en vivo", "isBold": false, "isLimitation": false },
        { "text": "Prueba de cajones inteligentes y plantillas base", "isBold": false, "isLimitation": false },
        { "text": "Vista previa en pantalla de Despiece y Presupuesto", "isBold": false, "isLimitation": false },
        { "text": "100% propiedad intelectual de tus diseños y modelos 3D", "isBold": true, "isLimitation": false },
        { "text": "Límite de 1 proyecto activo (máximo 3 módulos)", "isBold": false, "isLimitation": true },
        { "text": "Optimizador 2D solo en vista previa (1 tablero)", "isBold": false, "isLimitation": true },
        { "text": "Sin descargas PDF, Guías de Armado, Etiquetas ni CNC", "isBold": false, "isLimitation": true }
      ]
    },
    {
      "id": "pro",
      "eyebrow": "MÁS POPULAR",
      "name": "Plan Taller Pro",
      "description": "Todo lo que un carpintero o diseñador necesita para cotizar, optimizar y fabricar sin límites.",
      "priceCopMonthly": 49900,
      "isFree": false,
      "isPopular": true,
      "highlightNote": "Se paga solo ahorrando menos de medio tablero de melamina al mes.",
      "ctaLabel": "Elegir Plan Taller Pro",
      "features": [
        { "text": "Proyectos y módulos 3D ilimitados en la nube", "isBold": false, "isLimitation": false },
        { "text": "Optimizador 2D Guillotina completo (veta, kerf y tapacanto)", "isBold": false, "isLimitation": false },
        { "text": "Descarga de Planos de Corte 2D en PDF listos para taller", "isBold": false, "isLimitation": false },
        { "text": "Generador de Guías de Armado RTA en PDF paso a paso", "isBold": false, "isLimitation": false },
        { "text": "Impresión de Etiquetas de taller con diagrama de cantos", "isBold": false, "isLimitation": false },
        { "text": "Presupuesto Multimoneda completo con margen de utilidad", "isBold": false, "isLimitation": false },
        { "text": "100% propiedad intelectual de tus diseños y modelos 3D", "isBold": true, "isLimitation": false }
      ]
    },
    {
      "id": "industrial",
      "eyebrow": "PARA FÁBRICAS Y CENTROS DE CORTE",
      "name": "Plan Industrial & CNC",
      "description": "Para talleres automatizados con router CNC, estudios de arquitectura y producción en serie.",
      "priceCopMonthly": 95900,
      "isFree": false,
      "isPopular": false,
      "highlightNote": "",
      "ctaLabel": "Elegir Plan Industrial",
      "features": [
        { "text": "Todo lo incluido en el Plan Taller Pro sin límites", "isBold": false, "isLimitation": false },
        { "text": "Exportación DXF CNC por capas vectoriales (LWPOLYLINE)", "isBold": false, "isLimitation": false },
        { "text": "Exportación de Modelo 3D agrupado (.DAE COLLADA)", "isBold": false, "isLimitation": false },
        { "text": "Creación de catálogos propios de melamina, piedras y herrajes", "isBold": false, "isLimitation": false },
        { "text": "Personalización de marca/logo en PDFs de presupuesto y armado", "isBold": false, "isLimitation": false },
        { "text": "Soporte técnico prioritario para taller", "isBold": false, "isLimitation": false },
        { "text": "100% propiedad intelectual de tus diseños y modelos 3D", "isBold": true, "isLimitation": false }
      ]
    }
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
