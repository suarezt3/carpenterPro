-- ==========================================
-- MIGRACIÓN WOMPI COLOMBIA (1A, 2A, 3A)
-- ==========================================

-- 1. Tasa de cambio USD -> COP administrable desde CMS / Superadmin
ALTER TABLE IF EXISTS public.platform_settings
  ADD COLUMN IF NOT EXISTS usd_to_cop_rate NUMERIC(12,2) NOT NULL DEFAULT 4250;

-- 2. Columnas de monto en COP, moneda y método de pago en facturas, más índice único idempotente
ALTER TABLE IF EXISTS public.subscription_invoices
  ADD COLUMN IF NOT EXISTS amount_cop BIGINT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS payment_method TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_invoices_subscription_id_unique
  ON public.subscription_invoices(subscription_id)
  WHERE subscription_id IS NOT NULL;

-- 3. Tabla de transacciones de pago con firma e integridad verificada en servidor
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('pro', 'industrial')),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual')),
  amount_usd NUMERIC(10,2) NOT NULL,
  exchange_rate_cop NUMERIC(12,2) NOT NULL,
  amount_in_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'COP' CHECK (currency = 'COP'),
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  wompi_transaction_id TEXT,
  payment_method_type TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'DECLINED', 'VOIDED', 'ERROR')),
  raw_status_reason TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_created
  ON public.payment_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_wompi_tx
  ON public.payment_transactions(wompi_transaction_id)
  WHERE wompi_transaction_id IS NOT NULL;

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users and super admins can view payment transactions" ON public.payment_transactions;
CREATE POLICY "Users and super admins can view payment transactions"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id OR public.is_super_admin());

REVOKE INSERT, UPDATE, DELETE ON public.payment_transactions FROM anon, authenticated;
GRANT SELECT ON public.payment_transactions TO authenticated;
