-- ==========================================
-- MIGRACIÓN PRECIOS BASE OFICIALES EN COP (WOMPI COLOMBIA)
-- ==========================================

-- 1. Columnas oficiales de precios base en Pesos Colombianos (COP) y tasa fallback 3304
ALTER TABLE IF EXISTS public.platform_settings
  ADD COLUMN IF NOT EXISTS pro_monthly_cop BIGINT NOT NULL DEFAULT 49900,
  ADD COLUMN IF NOT EXISTS pro_annual_monthly_cop BIGINT NOT NULL DEFAULT 39920,
  ADD COLUMN IF NOT EXISTS pro_annual_total_cop BIGINT NOT NULL DEFAULT 479040,
  ADD COLUMN IF NOT EXISTS industrial_monthly_cop BIGINT NOT NULL DEFAULT 95900,
  ADD COLUMN IF NOT EXISTS industrial_annual_monthly_cop BIGINT NOT NULL DEFAULT 76720,
  ADD COLUMN IF NOT EXISTS industrial_annual_total_cop BIGINT NOT NULL DEFAULT 920640,
  ADD COLUMN IF NOT EXISTS usd_to_cop_rate NUMERIC(12,2) NOT NULL DEFAULT 3304;

-- 2. Actualizar valor por defecto de usd_to_cop_rate a 3304
ALTER TABLE IF EXISTS public.platform_settings
  ALTER COLUMN usd_to_cop_rate SET DEFAULT 3304;

-- 3. Migrar fila singleton id = 1 si conserva la tasa heredada 4250
DO $$
BEGIN
  IF to_regclass('public.platform_settings') IS NOT NULL THEN
    UPDATE public.platform_settings SET usd_to_cop_rate = 3304 WHERE id = 1 AND usd_to_cop_rate = 4250;
  END IF;
END $$;
