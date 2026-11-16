import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

type PaidPlan = 'pro' | 'industrial';
type BillingCycle = 'monthly' | 'annual';
type PaymentTxStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR';

interface PaymentTransactionRow {
  id: string;
  user_id: string;
  reference: string;
  plan: PaidPlan;
  billing_cycle: BillingCycle;
  amount_usd: number;
  amount_in_cents: number;
  currency: string;
  environment: 'sandbox' | 'production';
  status: PaymentTxStatus;
}

interface UserProfileRow {
  id: string;
  email: string;
  plan: 'free' | PaidPlan;
  billing_cycle: BillingCycle | null;
  subscription_status: string | null;
  subscription_id: string | null;
  current_period_end: string | null;
}

const DEFAULT_USD_TO_COP_RATE = 3304;
const MIN_COP_AMOUNT = 1500;

const DEFAULT_COP_PRICING: Record<PaidPlan, Record<BillingCycle, number>> = {
  pro: { monthly: 49900, annual: 479040 },
  industrial: { monthly: 95900, annual: 920640 }
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
  'Access-Control-Allow-Headers': 'Content-Type, X-Event-Checksum',
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

function timingSafeEqualHex(a: string, b: string): boolean {
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();
  if (!cleanA || cleanA.length !== cleanB.length) return false;
  let diff = 0;
  for (let i = 0; i < cleanA.length; i++) {
    diff |= cleanA.charCodeAt(i) ^ cleanB.charCodeAt(i);
  }
  return diff === 0;
}

async function computeSha256Hex(message: string): Promise<string> {
  const bytes = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function resolvePropertyPath(root: Record<string, unknown>, path: string): string {
  const segments = path.split('.').map((s) => s.trim()).filter(Boolean);
  let current: unknown = root;
  for (const segment of segments) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return '';
    }
    current = (current as Record<string, unknown>)[segment];
  }
  if (current === null || current === undefined) return '';
  return String(current);
}

function normalizeTxStatus(raw: unknown): PaymentTxStatus {
  const upper = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (ALLOWED_TX_STATUSES.has(upper as PaymentTxStatus)) {
    return upper as PaymentTxStatus;
  }
  return 'ERROR';
}

function parseReferencePlanCycle(reference: string): { plan: PaidPlan; cycle: BillingCycle } | null {
  const match = /^P3D-(PRO|INDUSTRIAL)-(MONTHLY|ANNUAL)-/i.exec(reference.trim());
  if (!match) return null;
  const plan: PaidPlan = match[1].toUpperCase() === 'INDUSTRIAL' ? 'industrial' : 'pro';
  const cycle: BillingCycle = match[2].toUpperCase() === 'ANNUAL' ? 'annual' : 'monthly';
  return { plan, cycle };
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

async function fetchPlatformSettingsRow(
  supabase: SupabaseClient
): Promise<Record<string, unknown> | null> {
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function resolveExpectedCopFromSettings(
  settingsRow: Record<string, unknown> | null,
  plan: PaidPlan,
  cycle: BillingCycle
): number {
  const defaultCop = DEFAULT_COP_PRICING[plan][cycle];
  if (!settingsRow) return defaultCop;
  const key =
    plan === 'industrial'
      ? (cycle === 'annual' ? 'industrial_annual_total_cop' : 'industrial_monthly_cop')
      : (cycle === 'annual' ? 'pro_annual_total_cop' : 'pro_monthly_cop');
  const numeric = Number(settingsRow[key]);
  return Number.isFinite(numeric) && numeric >= MIN_COP_AMOUNT
    ? Math.round(numeric)
    : defaultCop;
}

function resolveFallbackExchangeRateCop(settingsRow: Record<string, unknown> | null): number {
  const settingsRate = Number(settingsRow?.['usd_to_cop_rate']);
  if (Number.isFinite(settingsRate) && settingsRate > 0 && settingsRate !== 4250) {
    return Math.round(settingsRate * 100) / 100;
  }
  return DEFAULT_USD_TO_COP_RATE;
}

async function resolveFallbackUsdPrice(
  supabase: SupabaseClient,
  plan: PaidPlan,
  cycle: BillingCycle,
  amountInCents?: number,
  prefetchedSettings?: Record<string, unknown> | null
): Promise<number> {
  const settingsRow =
    prefetchedSettings !== undefined ? prefetchedSettings : await fetchPlatformSettingsRow(supabase);
  const copAmount =
    typeof amountInCents === 'number' && Number.isFinite(amountInCents) && amountInCents > 0
      ? Math.round(amountInCents / 100)
      : resolveExpectedCopFromSettings(settingsRow, plan, cycle);
  const rate = resolveFallbackExchangeRateCop(settingsRow);
  return Math.round((copAmount / rate) * 100) / 100;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const eventsSecret = (Deno.env.get('WOMPI_EVENTS_SECRET') ?? '').trim();
    if (!eventsSecret) {
      return jsonResponse({ error: 'WOMPI_EVENTS_SECRET not configured' }, 500);
    }

    const rawBody = await req.text();
    let payload: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return jsonResponse({ error: 'Invalid webhook payload' }, 400);
      }
      payload = parsed as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: 'Invalid JSON payload' }, 400);
    }

    const signatureRaw = payload['signature'];
    const signatureObj =
      signatureRaw && typeof signatureRaw === 'object' && !Array.isArray(signatureRaw)
        ? (signatureRaw as Record<string, unknown>)
        : null;
    const properties = signatureObj?.['properties'];
    const bodyChecksum = typeof signatureObj?.['checksum'] === 'string'
      ? signatureObj['checksum'].trim()
      : '';
    const headerChecksum = (
      req.headers.get('X-Event-Checksum') ??
      req.headers.get('x-event-checksum') ??
      ''
    ).trim();
    const timestamp = payload['timestamp'];
    const dataRaw = payload['data'];
    const dataObj =
      dataRaw && typeof dataRaw === 'object' && !Array.isArray(dataRaw)
        ? (dataRaw as Record<string, unknown>)
        : null;

    if (
      !Array.isArray(properties) ||
      properties.length === 0 ||
      !properties.every((prop) => typeof prop === 'string' && prop.trim().length > 0) ||
      !bodyChecksum ||
      (typeof timestamp !== 'number' && typeof timestamp !== 'string') ||
      !dataObj
    ) {
      return jsonResponse({ error: 'Invalid or incomplete signature metadata' }, 401);
    }

    const concatenatedProps = properties
      .map((prop) => resolvePropertyPath(dataObj, prop))
      .join('');
    const expectedChecksum = await computeSha256Hex(
      `${concatenatedProps}${String(timestamp)}${eventsSecret}`
    );

    const bodyMatches = timingSafeEqualHex(expectedChecksum, bodyChecksum);
    const headerMatches = !headerChecksum || timingSafeEqualHex(expectedChecksum, headerChecksum);
    if (!bodyMatches || !headerMatches) {
      return jsonResponse({ error: 'Invalid webhook signature' }, 401);
    }

    const eventName = typeof payload['event'] === 'string' ? payload['event'].trim() : '';
    const rawTx = dataObj['transaction'];
    if (
      eventName !== 'transaction.updated' ||
      !rawTx ||
      typeof rawTx !== 'object' ||
      Array.isArray(rawTx)
    ) {
      return jsonResponse({
        received: true,
        skipped: 'Unhandled Wompi event type',
        event: eventName
      });
    }

    let tx = rawTx as Record<string, unknown>;
    const txId = typeof tx['id'] === 'string' ? tx['id'].trim() : '';
    if (!txId) {
      return jsonResponse({ received: true, skipped: 'Missing transaction id' });
    }

    const wompiPrivateKey = (Deno.env.get('WOMPI_PRIVATE_KEY') ?? '').trim();
    if (wompiPrivateKey) {
      const apiBase = wompiPrivateKey.startsWith('prv_prod_')
        ? 'https://production.wompi.co'
        : 'https://sandbox.wompi.co';
      try {
        const verifyRes = await fetch(`${apiBase}/v1/transactions/${encodeURIComponent(txId)}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${wompiPrivateKey}`,
            Accept: 'application/json'
          }
        });

        if (verifyRes.status === 404) {
          return jsonResponse({ error: 'Transaction not found on Wompi API' }, 400);
        }

        if (verifyRes.ok) {
          const verifiedPayload = (await verifyRes.json().catch(() => null)) as Record<string, unknown> | null;
          const verifiedData =
            verifiedPayload?.['data'] && typeof verifiedPayload['data'] === 'object'
              ? (verifiedPayload['data'] as Record<string, unknown>)
              : null;

          if (verifiedData) {
            const verifiedStatus = normalizeTxStatus(verifiedData['status']);
            const webhookStatus = normalizeTxStatus(tx['status']);
            const verifiedAmount = Number(verifiedData['amount_in_cents']);
            const webhookAmount = Number(tx['amount_in_cents']);
            const verifiedCurrency = String(verifiedData['currency'] ?? '').trim().toUpperCase();
            const webhookCurrency = String(tx['currency'] ?? '').trim().toUpperCase();

            if (
              verifiedStatus !== webhookStatus ||
              verifiedAmount !== webhookAmount ||
              verifiedCurrency !== webhookCurrency
            ) {
              return jsonResponse({ error: 'Wompi API verification mismatch' }, 400);
            }

            tx = verifiedData;
          }
        }
      } catch {
        // Mantiene procesamiento respaldado por firma criptográfica si hay fallo transitorio de red
      }
    }

    const reference = typeof tx['reference'] === 'string' ? tx['reference'].trim() : '';
    const amountInCents = Number(tx['amount_in_cents']);
    const currency = String(tx['currency'] ?? '').trim().toUpperCase();
    const txStatus = normalizeTxStatus(tx['status']);
    const statusReason =
      typeof tx['status_message'] === 'string' && tx['status_message'].trim()
        ? tx['status_message'].trim()
        : null;
    const customerEmail =
      typeof tx['customer_email'] === 'string' ? tx['customer_email'].trim().toLowerCase() : '';
    const paymentMethodType =
      typeof tx['payment_method_type'] === 'string' && tx['payment_method_type'].trim()
        ? tx['payment_method_type'].trim().toUpperCase()
        : null;
    const paymentMethod =
      tx['payment_method'] && typeof tx['payment_method'] === 'object' && !Array.isArray(tx['payment_method'])
        ? (tx['payment_method'] as Record<string, unknown>)
        : null;

    const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').trim();
    const serviceRoleKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim();
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase configuration missing' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    let txRecord: PaymentTransactionRow | null = null;
    if (reference) {
      const { data: byRef } = await supabase
        .from('payment_transactions')
        .select('id, user_id, reference, plan, billing_cycle, amount_usd, amount_in_cents, currency, environment, status')
        .eq('reference', reference)
        .maybeSingle();
      if (byRef) {
        txRecord = byRef as PaymentTransactionRow;
      }
    }

    if (!txRecord) {
      const { data: byTxId } = await supabase
        .from('payment_transactions')
        .select('id, user_id, reference, plan, billing_cycle, amount_usd, amount_in_cents, currency, environment, status')
        .eq('wompi_transaction_id', txId)
        .maybeSingle();
      if (byTxId) {
        txRecord = byTxId as PaymentTransactionRow;
      }
    }

    let userId = txRecord?.user_id ?? '';
    let resolvedPlan: PaidPlan | null = txRecord?.plan ?? null;
    let resolvedCycle: BillingCycle | null = txRecord?.billing_cycle ?? null;

    if (txRecord) {
      if (
        !Number.isFinite(amountInCents) ||
        Number(amountInCents) !== Number(txRecord.amount_in_cents) ||
        currency !== 'COP'
      ) {
        return jsonResponse({ error: 'Transaction amount or currency mismatch' }, 400);
      }
    } else {
      if (currency !== 'COP' || !Number.isFinite(amountInCents) || amountInCents <= 0) {
        return jsonResponse({ error: 'Invalid transaction currency or amount' }, 400);
      }

      const parsedRef = parseReferencePlanCycle(reference);
      if (parsedRef) {
        resolvedPlan = parsedRef.plan;
        resolvedCycle = parsedRef.cycle;
      }

      if (!userId && customerEmail) {
        const { data: matchedProfile } = await supabase
          .from('user_profiles')
          .select('id')
          .ilike('email', customerEmail)
          .maybeSingle();
        if (matchedProfile?.id) {
          userId = String(matchedProfile.id);
        }
      }
    }

    if (!userId || !resolvedPlan || !resolvedCycle) {
      return jsonResponse({
        received: true,
        skipped: 'No matching payment transaction or user profile found',
        reference,
        transactionId: txId
      });
    }

    let fallbackSettingsRow: Record<string, unknown> | null | undefined;
    if (!txRecord) {
      fallbackSettingsRow = await fetchPlatformSettingsRow(supabase);
      const expectedCop = resolveExpectedCopFromSettings(
        fallbackSettingsRow,
        resolvedPlan,
        resolvedCycle
      );
      const expectedAmountInCents = Math.max(MIN_COP_AMOUNT, Math.round(expectedCop)) * 100;
      if (Number(amountInCents) !== expectedAmountInCents) {
        return jsonResponse({ error: 'Transaction amount or currency mismatch' }, 400);
      }
    }

    const nowIso = new Date().toISOString();
    const receiptUrl = `https://checkout.wompi.co/l/${encodeURIComponent(txId)}`;

    let claimedApprovalNow = false;
    if (txRecord) {
      if (txStatus === 'APPROVED' && txRecord.status !== 'APPROVED') {
        const { data: claimedRows, error: txUpdateErr } = await supabase
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
          return jsonResponse({ error: txUpdateErr.message }, 500);
        }
        claimedApprovalNow = Array.isArray(claimedRows) && claimedRows.length > 0;
      } else {
        const { error: txUpdateErr } = await supabase
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
          return jsonResponse({ error: txUpdateErr.message }, 500);
        }
      }
    }

    if (txStatus === 'APPROVED') {
      const { data: existingProfileData, error: profileReadErr } = await supabase
        .from('user_profiles')
        .select('id, email, plan, billing_cycle, subscription_status, subscription_id, current_period_end')
        .eq('id', userId)
        .maybeSingle();

      if (profileReadErr) {
        return jsonResponse({ error: profileReadErr.message }, 500);
      }

      const existingProfile = (existingProfileData ?? null) as UserProfileRow | null;
      const alreadyAppliedSameTx =
        existingProfile?.subscription_id === txId ||
        (txRecord?.status === 'APPROVED' && !claimedApprovalNow && existingProfile?.subscription_id === txId);

      const nextPeriodEndIso = computeNextPeriodEnd(
        existingProfile?.current_period_end ?? null,
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

      const { error: profileUpdateErr } = await supabase
        .from('user_profiles')
        .update(profileUpdate)
        .eq('id', userId);

      if (profileUpdateErr) {
        return jsonResponse({ error: profileUpdateErr.message }, 500);
      }

      let existingInvoice: { id: string } | null = null;
      const { data: byWompiTx, error: byWompiTxErr } = await supabase
        .from('subscription_invoices')
        .select('id')
        .eq('wompi_transaction_id', txId)
        .limit(1)
        .maybeSingle();

      if (!byWompiTxErr && byWompiTx) {
        existingInvoice = byWompiTx as { id: string };
      } else {
        const { data: bySubId } = await supabase
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
        const amountUsd =
          txRecord && Number.isFinite(Number(txRecord.amount_usd)) && Number(txRecord.amount_usd) > 0
            ? Number(txRecord.amount_usd)
            : await resolveFallbackUsdPrice(
                supabase,
                resolvedPlan,
                resolvedCycle,
                amountInCents,
                fallbackSettingsRow
              );
        const amountCop = Math.round(amountInCents / 100);

        const { error: invoiceErr } = await supabase
          .from('subscription_invoices')
          .insert({
            user_id: userId,
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
            const { error: fallbackInvoiceErr } = await supabase
              .from('subscription_invoices')
              .insert({
                user_id: userId,
                subscription_id: txId,
                plan: resolvedPlan,
                billing_cycle: resolvedCycle,
                amount_usd: amountUsd,
                status: 'paid',
                invoice_url: receiptUrl
              });
            if (fallbackInvoiceErr && fallbackInvoiceErr.code !== '23505') {
              return jsonResponse({ error: fallbackInvoiceErr.message }, 500);
            }
          } else {
            return jsonResponse({ error: invoiceErr.message }, 500);
          }
        }
      }
    }

    return jsonResponse({
      received: true,
      event: eventName,
      transactionId: txId,
      reference,
      status: txStatus,
      userId,
      plan: resolvedPlan,
      billingCycle: resolvedCycle
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected webhook error';
    return jsonResponse({ error: message }, 400);
  }
});
