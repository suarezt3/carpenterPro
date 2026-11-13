import { createClient } from 'npm:@supabase/supabase-js@2';

type PaidPlan = 'pro' | 'industrial';
type BillingCycle = 'monthly' | 'annual';
type SubscriptionStatus = 'free' | 'active' | 'on_trial' | 'past_due' | 'cancelled' | 'expired';

interface VariantMapping {
  plan: PaidPlan;
  cycle: BillingCycle;
  defaultAmountUsd: number;
}

const VARIANT_MAP: Record<string, VariantMapping> = {
  '2359025': { plan: 'pro', cycle: 'monthly', defaultAmountUsd: 15 },
  '2359008': { plan: 'pro', cycle: 'annual', defaultAmountUsd: 144 },
  '2359108': { plan: 'industrial', cycle: 'monthly', defaultAmountUsd: 29 },
  '2359083': { plan: 'industrial', cycle: 'annual', defaultAmountUsd: 276 }
};

function timingSafeEqualHex(a: string, b: string): boolean {
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();
  if (cleanA.length !== cleanB.length) return false;
  let diff = 0;
  for (let i = 0; i < cleanA.length; i++) {
    diff |= cleanA.charCodeAt(i) ^ cleanB.charCodeAt(i);
  }
  return diff === 0;
}

async function computeHmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeStatus(rawStatus: string | undefined, eventName: string): SubscriptionStatus {
  if (eventName === 'subscription_expired') return 'expired';
  if (eventName === 'subscription_cancelled') return 'cancelled';
  switch ((rawStatus ?? '').toLowerCase()) {
    case 'active':
      return 'active';
    case 'on_trial':
      return 'on_trial';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'cancelled':
      return 'cancelled';
    case 'expired':
      return 'expired';
    default:
      return 'active';
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Signature, X-Event-Name'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const rawBody = await req.text();
    const webhookSecret = Deno.env.get('LEMON_SQUEEZY_WEBHOOK_SECRET');
    const signatureHeader = req.headers.get('X-Signature') ?? req.headers.get('x-signature') ?? '';

    if (webhookSecret && webhookSecret.trim().length > 0) {
      if (!signatureHeader) {
        return new Response(JSON.stringify({ error: 'Missing X-Signature header' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const expectedHex = await computeHmacSha256Hex(webhookSecret.trim(), rawBody);
      if (!timingSafeEqualHex(signatureHeader, expectedHex)) {
        return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const meta = (payload['meta'] ?? {}) as Record<string, unknown>;
    const customData = (meta['custom_data'] ?? {}) as Record<string, unknown>;
    const dataObj = (payload['data'] ?? {}) as Record<string, unknown>;
    const attributes = (dataObj['attributes'] ?? {}) as Record<string, unknown>;
    const urls = (attributes['urls'] ?? {}) as Record<string, unknown>;
    const firstSubItem = (attributes['first_subscription_item'] ?? {}) as Record<string, unknown>;

    const eventName = String(
      meta['event_name'] ?? req.headers.get('X-Event-Name') ?? req.headers.get('x-event-name') ?? ''
    );

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const variantIdRaw = String(
      attributes['variant_id'] ??
      firstSubItem['variant_id'] ??
      customData['variant_id'] ??
      ''
    ).trim();

    const mappedVariant = VARIANT_MAP[variantIdRaw];
    const customPlan = String(customData['plan'] ?? '').toLowerCase();
    const customCycle = String(customData['billing_cycle'] ?? '').toLowerCase();

    const resolvedPlan: PaidPlan = mappedVariant?.plan ??
      (customPlan === 'industrial' ? 'industrial' : 'pro');
    const resolvedCycle: BillingCycle = mappedVariant?.cycle ??
      (customCycle === 'annual' || customCycle === 'yearly' ? 'annual' : 'monthly');

    let userId = typeof customData['user_id'] === 'string' ? customData['user_id'].trim() : '';
    const userEmail = String(
      attributes['user_email'] ??
      attributes['customer_email'] ??
      customData['email'] ??
      ''
    ).trim().toLowerCase();

    if (!userId && userEmail) {
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .ilike('email', userEmail)
        .maybeSingle();

      if (existingProfile?.id) {
        userId = String(existingProfile.id);
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ received: true, skipped: 'No matching user_id or user_email found', eventName }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const subscriptionId = String(
      attributes['subscription_id'] ?? dataObj['id'] ?? ''
    );
    const customerId = attributes['customer_id'] !== undefined && attributes['customer_id'] !== null
      ? String(attributes['customer_id'])
      : null;
    const renewsAt = typeof attributes['renews_at'] === 'string'
      ? attributes['renews_at']
      : (typeof attributes['ends_at'] === 'string' ? attributes['ends_at'] : null);
    const updatePaymentUrl = typeof urls['update_payment_method'] === 'string'
      ? urls['update_payment_method']
      : null;
    const customerPortalUrl = typeof urls['customer_portal'] === 'string'
      ? urls['customer_portal']
      : updatePaymentUrl;
    const rawCardBrand = typeof attributes['card_brand'] === 'string' ? attributes['card_brand'].trim() : '';
    const cardBrand = rawCardBrand ? rawCardBrand.toUpperCase() : null;
    const rawCardLastFour = typeof attributes['card_last_four'] === 'string' ? attributes['card_last_four'].trim() : '';
    const cardLastFour = /^\d{4}$/.test(rawCardLastFour) ? rawCardLastFour : null;

    if (
      eventName === 'subscription_created' ||
      eventName === 'subscription_updated' ||
      eventName === 'subscription_resumed' ||
      eventName === 'subscription_unpaused' ||
      eventName === 'order_created'
    ) {
      const normalizedSubStatus = normalizeStatus(
        typeof attributes['status'] === 'string' ? attributes['status'] : 'active',
        eventName
      );
      const effectivePlan = normalizedSubStatus === 'expired' ? 'free' : resolvedPlan;

      const updatePayload: Record<string, unknown> = {
        plan: effectivePlan,
        billing_cycle: resolvedCycle,
        subscription_status: normalizedSubStatus,
        subscription_id: subscriptionId || null,
        customer_id: customerId,
        variant_id: variantIdRaw || null,
        updated_at: new Date().toISOString()
      };

      if (renewsAt) {
        updatePayload['current_period_end'] = renewsAt;
      }
      if (customerPortalUrl) {
        updatePayload['customer_portal_url'] = customerPortalUrl;
      }
      if (cardBrand) {
        updatePayload['card_brand'] = cardBrand;
      }
      if (cardLastFour) {
        updatePayload['card_last_four'] = cardLastFour;
      }

      const { error: updateErr } = await supabase
        .from('user_profiles')
        .update(updatePayload)
        .eq('id', userId);

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else if (eventName === 'subscription_cancelled') {
      const { error: cancelErr } = await supabase
        .from('user_profiles')
        .update({
          subscription_status: 'cancelled',
          ...(renewsAt ? { current_period_end: renewsAt } : {}),
          ...(customerPortalUrl ? { customer_portal_url: customerPortalUrl } : {}),
          ...(cardBrand ? { card_brand: cardBrand } : {}),
          ...(cardLastFour ? { card_last_four: cardLastFour } : {}),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (cancelErr) {
        return new Response(JSON.stringify({ error: cancelErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else if (eventName === 'subscription_expired') {
      const { error: expireErr } = await supabase
        .from('user_profiles')
        .update({
          plan: 'free',
          subscription_status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (expireErr) {
        return new Response(JSON.stringify({ error: expireErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else if (
      eventName === 'subscription_payment_success' ||
      eventName === 'subscription_payment_recovered'
    ) {
      const rawTotalCents = Number(
        attributes['total_usd'] ?? attributes['total'] ?? attributes['subtotal_usd'] ?? NaN
      );
      const amountUsd = Number.isFinite(rawTotalCents) && rawTotalCents > 0
        ? Number((rawTotalCents / 100).toFixed(2))
        : (mappedVariant?.defaultAmountUsd ?? (resolvedPlan === 'industrial' ? (resolvedCycle === 'annual' ? 276 : 29) : (resolvedCycle === 'annual' ? 144 : 15)));

      const invoiceUrl = typeof urls['invoice_url'] === 'string'
        ? urls['invoice_url']
        : (typeof attributes['invoice_url'] === 'string' ? attributes['invoice_url'] : null);

      await supabase.from('user_profiles').update({
        plan: resolvedPlan,
        billing_cycle: resolvedCycle,
        subscription_status: 'active',
        updated_at: new Date().toISOString()
      }).eq('id', userId);

      const { error: invoiceErr } = await supabase
        .from('subscription_invoices')
        .insert({
          user_id: userId,
          subscription_id: subscriptionId || null,
          plan: resolvedPlan,
          billing_cycle: resolvedCycle,
          amount_usd: amountUsd,
          status: 'paid',
          invoice_url: invoiceUrl
        });

      if (invoiceErr) {
        return new Response(JSON.stringify({ error: invoiceErr.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(
      JSON.stringify({
        received: true,
        event: eventName,
        userId,
        plan: resolvedPlan,
        billingCycle: resolvedCycle
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected webhook error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
