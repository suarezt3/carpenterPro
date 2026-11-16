import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type PaidPlan = 'pro' | 'industrial';
type BillingCycle = 'monthly' | 'annual';
type SubscriptionAction = 'verify_transaction' | 'sync' | 'get_portal_url' | 'cancel' | 'resume';
type PaymentTxStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';

interface UserProfileRow {
  id: string;
  email: string;
  plan: 'free' | PaidPlan;
  billing_cycle: BillingCycle | null;
  subscription_status: string | null;
  subscription_id: string | null;
  customer_id: string | null;
  variant_id: string | null;
  current_period_end: string | null;
  customer_portal_url: string | null;
  card_brand: string | null;
  card_last_four: string | null;
}

interface PaymentTransactionRow {
  id: string;
  user_id: string;
  reference: string;
  plan: PaidPlan;
  billing_cycle: BillingCycle;
  amount_usd: number;
  amount_in_cents: number;
  currency: string;
  status: PaymentTxStatus;
  wompi_transaction_id: string | null;
}

const DEFAULT_USD_PRICING: Record<PaidPlan, Record<BillingCycle, number>> = {
  pro: { monthly: 15, annual: 144 },
  industrial: { monthly: 29, annual: 276 }
};

const ALLOWED_TX_STATUSES = new Set<PaymentTxStatus>([
  'PENDING',
  'APPROVED',
  'DECLINED',
  'VOIDED',
  'ERROR'
]);

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json'
    }
  });
}

function normalizeTxStatus(raw: unknown): PaymentTxStatus {
  const upper = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (ALLOWED_TX_STATUSES.has(upper as PaymentTxStatus)) {
    return upper as PaymentTxStatus;
  }
  return 'ERROR';
}

function parseReferencePlanCycle(reference: string): {
  plan: PaidPlan;
  cycle: BillingCycle;
  userPrefix: string;
} | null {
  const match = /^P3D-(PRO|INDUSTRIAL)-(MONTHLY|ANNUAL)-([a-f0-9]{8})-/i.exec(reference.trim());
  if (!match) return null;
  return {
    plan: match[1].toUpperCase() === 'INDUSTRIAL' ? 'industrial' : 'pro',
    cycle: match[2].toUpperCase() === 'ANNUAL' ? 'annual' : 'monthly',
    userPrefix: match[3].toLowerCase()
  };
}

function extractCardAndMethodDetails(
  paymentMethod: Record<string, unknown> | null,
  paymentMethodType: string | null
): { cardBrand: string | null; cardLastFour: string | null } {
  const extra =
    paymentMethod?.['extra'] && typeof paymentMethod['extra'] === 'object'
      ? (paymentMethod['extra'] as Record<string, unknown>)
      : null;

  const extraBrand = typeof extra?.['brand'] === 'string' ? extra['brand'].trim() : '';
  const directBrand = typeof paymentMethod?.['brand'] === 'string' ? paymentMethod['brand'].trim() : '';
  const fallbackType = paymentMethodType ? paymentMethodType.trim() : '';
  const resolvedBrand = extraBrand || directBrand || fallbackType;
  const cardBrand = resolvedBrand ? resolvedBrand.toUpperCase() : null;

  const rawLastFour =
    typeof extra?.['last_four'] === 'string'
      ? extra['last_four'].trim()
      : (typeof paymentMethod?.['last_four'] === 'string' ? paymentMethod['last_four'].trim() : '');
  const cardLastFour = /^\d{4}$/.test(rawLastFour) ? rawLastFour : null;

  return { cardBrand, cardLastFour };
}

function computeNextPeriodEnd(
  existingPeriodEnd: string | null,
  billingCycle: BillingCycle,
  alreadyAppliedSameTx: boolean
): string {
  const nowMs = Date.now();
  const daysToAdd = billingCycle === 'annual' ? 365 : 30;
  const durationMs = daysToAdd * 24 * 60 * 60 * 1000;

  if (alreadyAppliedSameTx && existingPeriodEnd) {
    const parsedExisting = Date.parse(existingPeriodEnd);
    if (Number.isFinite(parsedExisting) && parsedExisting > nowMs) {
      return new Date(parsedExisting).toISOString();
    }
  }

  let baseMs = nowMs;
  if (existingPeriodEnd) {
    const parsedExisting = Date.parse(existingPeriodEnd);
    if (Number.isFinite(parsedExisting) && parsedExisting > nowMs) {
      baseMs = parsedExisting;
    }
  }

  return new Date(baseMs + durationMs).toISOString();
}

async function resolveFallbackUsdPrice(
  supabase: SupabaseClient,
  plan: PaidPlan,
  cycle: BillingCycle
): Promise<number> {
  const defaultPrice = DEFAULT_USD_PRICING[plan][cycle];
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (!data || typeof data !== 'object') return defaultPrice;
    const row = data as Record<string, unknown>;
    const key =
      plan === 'industrial'
        ? (cycle === 'annual' ? 'industrial_annual_total_usd' : 'industrial_monthly_usd')
        : (cycle === 'annual' ? 'pro_annual_total_usd' : 'pro_monthly_usd');
    const numeric = Number(row[key]);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : defaultPrice;
  } catch {
    return defaultPrice;
  }
}

function resolveWompiApiBase(privateKey: string): string {
  return privateKey.startsWith('prv_prod_')
    ? 'https://production.wompi.co'
    : 'https://sandbox.wompi.co';
}

function extractWompiTransaction(payload: Record<string, unknown>): Record<string, unknown> | null {
  const rawData = payload['data'];
  if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
    return null;
  }
  const dataObj = rawData as Record<string, unknown>;
  const nestedTx = dataObj['transaction'];
  if (nestedTx && typeof nestedTx === 'object' && !Array.isArray(nestedTx)) {
    return nestedTx as Record<string, unknown>;
  }
  return dataObj;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, code: 'METHOD_NOT_ALLOWED' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      return jsonResponse({ success: false, code: 'UNAUTHORIZED' }, 401);
    }

    const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').trim();
    const serviceRoleKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ success: false, code: 'SUPABASE_CONFIG_MISSING' }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: userData, error: userErr } = await adminClient.auth.getUser(jwt);
    const user = userData?.user ?? null;
    if (userErr || !user) {
      return jsonResponse({ success: false, code: 'UNAUTHORIZED' }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const rawAction = typeof body['action'] === 'string' ? body['action'].trim() : '';
    const validActions: SubscriptionAction[] = [
      'verify_transaction',
      'sync',
      'get_portal_url',
      'cancel',
      'resume'
    ];
    if (!validActions.includes(rawAction as SubscriptionAction)) {
      return jsonResponse({ success: false, code: 'INVALID_ACTION' }, 400);
    }
    const action = rawAction as SubscriptionAction;
    const immediate = Boolean(body['immediate']);

    const { data: profileData, error: profileErr } = await adminClient
      .from('user_profiles')
      .select(
        'id, email, plan, billing_cycle, subscription_status, subscription_id, customer_id, variant_id, current_period_end, customer_portal_url, card_brand, card_last_four'
      )
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr || !profileData) {
      return jsonResponse({ success: false, code: 'PROFILE_NOT_FOUND' }, 404);
    }

    const profile = profileData as UserProfileRow;
    const wompiPrivateKey = (Deno.env.get('WOMPI_PRIVATE_KEY') ?? '').trim();
    const nowIso = new Date().toISOString();
    const subscriptionId =
      typeof profile.subscription_id === 'string' ? profile.subscription_id.trim() : '';

    if (action === 'verify_transaction') {
      const transactionId =
        typeof body['transactionId'] === 'string' ? body['transactionId'].trim() : '';
      const bodyReference =
        typeof body['reference'] === 'string' ? body['reference'].trim() : '';

      if (!transactionId) {
        return jsonResponse({ success: false, code: 'TRANSACTION_ID_REQUIRED' }, 400);
      }

      if (!wompiPrivateKey) {
        return jsonResponse({
          success: false,
          code: 'WOMPI_CONFIG_MISSING',
          missing: ['WOMPI_PRIVATE_KEY']
        });
      }

      const apiBase = resolveWompiApiBase(wompiPrivateKey);
      const txRes = await fetch(`${apiBase}/v1/transactions/${encodeURIComponent(transactionId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${wompiPrivateKey}`,
          Accept: 'application/json'
        }
      });

      if (!txRes.ok) {
        const errText = await txRes.text().catch(() => '');
        return jsonResponse({
          success: false,
          code: 'WOMPI_API_ERROR',
          status: txRes.status,
          detail: errText.slice(0, 300)
        });
      }

      const wompiPayload = (await txRes.json().catch(() => ({}))) as Record<string, unknown>;
      const tx = extractWompiTransaction(wompiPayload);
      if (!tx) {
        return jsonResponse({ success: false, code: 'WOMPI_INVALID_RESPONSE' });
      }

      const txId = typeof tx['id'] === 'string' && tx['id'].trim() ? tx['id'].trim() : transactionId;
      const reference =
        typeof tx['reference'] === 'string' && tx['reference'].trim()
          ? tx['reference'].trim()
          : bodyReference;
      const amountInCents = Number(tx['amount_in_cents']);
      const currency = String(tx['currency'] ?? '').trim().toUpperCase();
      const txStatus = normalizeTxStatus(tx['status']);
      const statusReason =
        typeof tx['status_message'] === 'string' && tx['status_message'].trim()
          ? tx['status_message'].trim()
          : null;
      const txCustomerEmail =
        typeof tx['customer_email'] === 'string' ? tx['customer_email'].trim().toLowerCase() : '';
      const paymentMethodType =
        typeof tx['payment_method_type'] === 'string' && tx['payment_method_type'].trim()
          ? tx['payment_method_type'].trim().toUpperCase()
          : null;
      const paymentMethod =
        tx['payment_method'] && typeof tx['payment_method'] === 'object' && !Array.isArray(tx['payment_method'])
          ? (tx['payment_method'] as Record<string, unknown>)
          : null;

      let txRecord: PaymentTransactionRow | null = null;
      if (reference) {
        const { data: byRef } = await adminClient
          .from('payment_transactions')
          .select('id, user_id, reference, plan, billing_cycle, amount_usd, amount_in_cents, currency, status, wompi_transaction_id')
          .eq('reference', reference)
          .maybeSingle();
        if (byRef) {
          txRecord = byRef as PaymentTransactionRow;
        }
      }

      if (!txRecord) {
        const { data: byTxId } = await adminClient
          .from('payment_transactions')
          .select('id, user_id, reference, plan, billing_cycle, amount_usd, amount_in_cents, currency, status, wompi_transaction_id')
          .eq('wompi_transaction_id', txId)
          .maybeSingle();
        if (byTxId) {
          txRecord = byTxId as PaymentTransactionRow;
        }
      }

      if (txRecord) {
        if (txRecord.user_id !== user.id) {
          return jsonResponse({ success: false, code: 'TRANSACTION_OWNERSHIP_MISMATCH' }, 403);
        }
        if (
          !Number.isFinite(amountInCents) ||
          Number(amountInCents) !== Number(txRecord.amount_in_cents) ||
          currency !== 'COP'
        ) {
          return jsonResponse({ success: false, code: 'TRANSACTION_INTEGRITY_MISMATCH' }, 400);
        }
      } else {
        const parsedRef = parseReferencePlanCycle(reference);
        const profileEmail = (profile.email || user.email || '').trim().toLowerCase();
        const matchesPrefix = Boolean(parsedRef && user.id.toLowerCase().startsWith(parsedRef.userPrefix));
        const matchesEmail = Boolean(txCustomerEmail && profileEmail && txCustomerEmail === profileEmail);
        const matchesSub = Boolean(subscriptionId && subscriptionId === txId);

        if (!matchesPrefix && !matchesEmail && !matchesSub) {
          return jsonResponse({ success: false, code: 'TRANSACTION_OWNERSHIP_MISMATCH' }, 403);
        }
        if (currency !== 'COP' || !Number.isFinite(amountInCents) || amountInCents <= 0) {
          return jsonResponse({ success: false, code: 'TRANSACTION_INTEGRITY_MISMATCH' }, 400);
        }
      }

      const receiptUrl = `https://checkout.wompi.co/l/${encodeURIComponent(txId)}`;
      let claimedApprovalNow = false;

      if (txRecord) {
        if (txStatus === 'APPROVED' && txRecord.status !== 'APPROVED') {
          const { data: claimedRows, error: txUpdateErr } = await adminClient
            .from('payment_transactions')
            .update({
              wompi_transaction_id: txId,
              status: txStatus,
              payment_method_type: paymentMethodType,
              raw_status_reason: statusReason,
              receipt_url: receiptUrl,
              updated_at: nowIso
            })
            .eq('id', txRecord.id)
            .neq('status', 'APPROVED')
            .select('id');

          if (txUpdateErr) {
            return jsonResponse({ success: false, code: 'TX_UPDATE_FAILED' }, 500);
          }
          claimedApprovalNow = Array.isArray(claimedRows) && claimedRows.length > 0;
        } else {
          const { error: txUpdateErr } = await adminClient
            .from('payment_transactions')
            .update({
              wompi_transaction_id: txId,
              status: txStatus,
              payment_method_type: paymentMethodType,
              raw_status_reason: statusReason,
              receipt_url: receiptUrl,
              updated_at: nowIso
            })
            .eq('id', txRecord.id);

          if (txUpdateErr) {
            return jsonResponse({ success: false, code: 'TX_UPDATE_FAILED' }, 500);
          }
        }
      }

      if (txStatus !== 'APPROVED') {
        return jsonResponse({
          success: true,
          approved: false,
          status: txStatus,
          transactionId: txId,
          reference,
          ...(statusReason ? { statusReason } : {})
        });
      }

      const parsedRef = parseReferencePlanCycle(reference);
      const resolvedPlan: PaidPlan =
        txRecord?.plan ??
        parsedRef?.plan ??
        (profile.plan === 'industrial' ? 'industrial' : 'pro');
      const resolvedCycle: BillingCycle =
        txRecord?.billing_cycle ??
        parsedRef?.cycle ??
        (profile.billing_cycle === 'annual' ? 'annual' : 'monthly');

      const alreadyAppliedSameTx =
        profile.subscription_id === txId ||
        (txRecord?.status === 'APPROVED' && !claimedApprovalNow && profile.subscription_id === txId);

      const nextPeriodEndIso = computeNextPeriodEnd(
        profile.current_period_end,
        resolvedCycle,
        alreadyAppliedSameTx
      );

      const { cardBrand, cardLastFour } = extractCardAndMethodDetails(
        paymentMethod,
        paymentMethodType
      );

      const profileUpdate: Record<string, unknown> = {
        plan: resolvedPlan,
        billing_cycle: resolvedCycle,
        subscription_status: 'active',
        subscription_id: txId,
        variant_id: `wompi:${resolvedPlan}:${resolvedCycle}`,
        current_period_end: nextPeriodEndIso,
        customer_portal_url: receiptUrl,
        updated_at: nowIso
      };

      if (cardBrand) {
        profileUpdate['card_brand'] = cardBrand;
      }
      if (cardLastFour) {
        profileUpdate['card_last_four'] = cardLastFour;
      }

      const { error: profileUpdateErr } = await adminClient
        .from('user_profiles')
        .update(profileUpdate)
        .eq('id', user.id);

      if (profileUpdateErr) {
        return jsonResponse({ success: false, code: 'PROFILE_UPDATE_FAILED' }, 500);
      }

      let existingInvoice: { id: string } | null = null;
      const { data: byWompiTx, error: byWompiTxErr } = await adminClient
        .from('subscription_invoices')
        .select('id')
        .eq('wompi_transaction_id', txId)
        .limit(1)
        .maybeSingle();

      if (!byWompiTxErr && byWompiTx) {
        existingInvoice = byWompiTx as { id: string };
      } else {
        const { data: bySubId } = await adminClient
          .from('subscription_invoices')
          .select('id')
          .eq('subscription_id', txId)
          .limit(1)
          .maybeSingle();
        if (bySubId) {
          existingInvoice = bySubId as { id: string };
        }
      }

      if (!existingInvoice) {
        const amountUsd = txRecord
          ? Number(txRecord.amount_usd)
          : await resolveFallbackUsdPrice(adminClient, resolvedPlan, resolvedCycle);
        const amountCop = Math.round(amountInCents / 100);

        const { error: invoiceErr } = await adminClient
          .from('subscription_invoices')
          .insert({
            user_id: user.id,
            subscription_id: txId,
            wompi_transaction_id: txId,
            plan: resolvedPlan,
            billing_cycle: resolvedCycle,
            amount_usd: amountUsd,
            amount_cop: amountCop,
            currency: 'COP',
            payment_method: paymentMethodType ?? cardBrand,
            status: 'paid',
            invoice_url: receiptUrl
          });

        if (invoiceErr && invoiceErr.code !== '23505') {
          if (invoiceErr.code === '42703') {
            const { error: fallbackInvoiceErr } = await adminClient
              .from('subscription_invoices')
              .insert({
                user_id: user.id,
                subscription_id: txId,
                plan: resolvedPlan,
                billing_cycle: resolvedCycle,
                amount_usd: amountUsd,
                status: 'paid',
                invoice_url: receiptUrl
              });
            if (fallbackInvoiceErr && fallbackInvoiceErr.code !== '23505') {
              return jsonResponse({ success: false, code: 'INVOICE_INSERT_FAILED' }, 500);
            }
          } else {
            return jsonResponse({ success: false, code: 'INVOICE_INSERT_FAILED' }, 500);
          }
        }
      }

      return jsonResponse({
        success: true,
        approved: true,
        status: txStatus,
        plan: resolvedPlan,
        billing_cycle: resolvedCycle,
        subscription_status: 'active',
        current_period_end: nextPeriodEndIso,
        customerPortalUrl: receiptUrl,
        portalUrl: receiptUrl,
        cardBrand: cardBrand ?? profile.card_brand ?? null,
        cardLastFour: cardLastFour ?? profile.card_last_four ?? null,
        transactionId: txId,
        reference
      });
    }

    if (action === 'get_portal_url' || action === 'sync') {
      let targetTxId = subscriptionId;
      if (!targetTxId) {
        const { data: latestTx } = await adminClient
          .from('payment_transactions')
          .select('wompi_transaction_id')
          .eq('user_id', user.id)
          .eq('status', 'APPROVED')
          .not('wompi_transaction_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (typeof latestTx?.['wompi_transaction_id'] === 'string') {
          targetTxId = latestTx['wompi_transaction_id'].trim();
        }
      }

      if (targetTxId && wompiPrivateKey) {
        const apiBase = resolveWompiApiBase(wompiPrivateKey);
        const res = await fetch(`${apiBase}/v1/transactions/${encodeURIComponent(targetTxId)}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${wompiPrivateKey}`,
            Accept: 'application/json'
          }
        });

        if (res.ok) {
          const wompiPayload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          const tx = extractWompiTransaction(wompiPayload);
          if (tx) {
            const txId = typeof tx['id'] === 'string' && tx['id'].trim() ? tx['id'].trim() : targetTxId;
            const receiptUrl = `https://checkout.wompi.co/l/${encodeURIComponent(txId)}`;
            const paymentMethodType =
              typeof tx['payment_method_type'] === 'string' && tx['payment_method_type'].trim()
                ? tx['payment_method_type'].trim().toUpperCase()
                : null;
            const paymentMethod =
              tx['payment_method'] && typeof tx['payment_method'] === 'object' && !Array.isArray(tx['payment_method'])
                ? (tx['payment_method'] as Record<string, unknown>)
                : null;
            const { cardBrand, cardLastFour } = extractCardAndMethodDetails(
              paymentMethod,
              paymentMethodType
            );
            const resolvedCardBrand = cardBrand ?? profile.card_brand ?? null;
            const resolvedCardLastFour = cardLastFour ?? profile.card_last_four ?? null;
            const txStatus = normalizeTxStatus(tx['status']);

            let resolvedStatus = profile.subscription_status ?? 'active';
            if (txStatus === 'APPROVED' && resolvedStatus !== 'cancelled' && resolvedStatus !== 'expired') {
              resolvedStatus = 'active';
            }

            await adminClient
              .from('user_profiles')
              .update({
                customer_portal_url: receiptUrl,
                ...(resolvedCardBrand ? { card_brand: resolvedCardBrand } : {}),
                ...(resolvedCardLastFour ? { card_last_four: resolvedCardLastFour } : {}),
                updated_at: nowIso
              })
              .eq('id', user.id);

            return jsonResponse({
              success: true,
              source: 'wompi_api',
              portalUrl: receiptUrl,
              customerPortalUrl: receiptUrl,
              updatePaymentMethodUrl: null,
              subscription_status: resolvedStatus,
              current_period_end: profile.current_period_end ?? null,
              cardBrand: resolvedCardBrand,
              cardLastFour: resolvedCardLastFour
            });
          }
        }
      }

      if (typeof profile.customer_portal_url === 'string' && profile.customer_portal_url.trim()) {
        const cachedUrl = profile.customer_portal_url.trim();
        return jsonResponse({
          success: true,
          source: 'cached_portal_url',
          portalUrl: cachedUrl,
          customerPortalUrl: cachedUrl,
          updatePaymentMethodUrl: null,
          subscription_status: profile.subscription_status,
          current_period_end: profile.current_period_end ?? null,
          cardBrand: profile.card_brand ?? null,
          cardLastFour: profile.card_last_four ?? null
        });
      }

      return jsonResponse({
        success: false,
        code: targetTxId ? 'WOMPI_CONFIG_MISSING' : 'NO_EXTERNAL_SUBSCRIPTION'
      });
    }

    if (action === 'cancel') {
      const cancelUpdate =
        immediate && !subscriptionId
          ? { plan: 'free', subscription_status: 'free', updated_at: nowIso }
          : { subscription_status: 'cancelled', updated_at: nowIso };

      const { error: cancelErr } = await adminClient
        .from('user_profiles')
        .update(cancelUpdate)
        .eq('id', user.id);

      if (cancelErr) {
        return jsonResponse({ success: false, code: 'PROFILE_UPDATE_FAILED' }, 500);
      }

      return jsonResponse({
        success: true,
        mode: 'wompi_period_end',
        ...cancelUpdate,
        current_period_end: profile.current_period_end ?? null,
        customerPortalUrl: profile.customer_portal_url ?? null,
        cardBrand: profile.card_brand ?? null,
        cardLastFour: profile.card_last_four ?? null
      });
    }

    // action === 'resume'
    if (profile.current_period_end) {
      const periodEndMs = Date.parse(profile.current_period_end);
      if (Number.isFinite(periodEndMs) && periodEndMs <= Date.now()) {
        return jsonResponse({
          success: false,
          code: 'SUBSCRIPTION_PERIOD_EXPIRED',
          current_period_end: profile.current_period_end
        });
      }
    }

    const { error: resumeErr } = await adminClient
      .from('user_profiles')
      .update({
        subscription_status: 'active',
        updated_at: nowIso
      })
      .eq('id', user.id);

    if (resumeErr) {
      return jsonResponse({ success: false, code: 'PROFILE_UPDATE_FAILED' }, 500);
    }

    return jsonResponse({
      success: true,
      mode: 'wompi_period_end',
      subscription_status: 'active',
      current_period_end: profile.current_period_end ?? null,
      customerPortalUrl: profile.customer_portal_url ?? null,
      cardBrand: profile.card_brand ?? null,
      cardLastFour: profile.card_last_four ?? null
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected subscription error';
    return jsonResponse({ success: false, code: 'INTERNAL_ERROR', detail: message }, 500);
  }
});
