import { createClient } from 'npm:@supabase/supabase-js@2';

type PaidPlan = 'pro' | 'industrial';
type BillingCycle = 'monthly' | 'annual';
type WompiEnvironment = 'sandbox' | 'production';

const SANDBOX_PUBLIC_KEY_FALLBACK = 'pub_test_5IPqjmLMDEC0cqUMoomPY7CzUaoGW68O';
const DEFAULT_USD_TO_COP_RATE = 4250;
const MIN_COP_AMOUNT = 1500;

const DEFAULT_USD_PRICING: Record<PaidPlan, Record<BillingCycle, number>> = {
  pro: { monthly: 15, annual: 144 },
  industrial: { monthly: 29, annual: 276 }
};

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

async function computeSha256Hex(message: string): Promise<string> {
  const bytes = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomHex4(): string {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function sanitizeRedirectUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function resolvePositiveNumber(raw: unknown, fallback: number): number {
  const numeric = Number(raw);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
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
    const rawPlan = typeof body['plan'] === 'string' ? body['plan'].trim().toLowerCase() : '';
    const rawCycle = typeof body['billingCycle'] === 'string'
      ? body['billingCycle'].trim().toLowerCase()
      : '';

    if (rawPlan !== 'pro' && rawPlan !== 'industrial') {
      return jsonResponse({ success: false, code: 'INVALID_PLAN' }, 400);
    }
    if (rawCycle !== 'monthly' && rawCycle !== 'annual') {
      return jsonResponse({ success: false, code: 'INVALID_BILLING_CYCLE' }, 400);
    }

    const plan: PaidPlan = rawPlan;
    const billingCycle: BillingCycle = rawCycle;
    const redirectUrl = sanitizeRedirectUrl(body['redirectUrl']);

    const integritySecret = (Deno.env.get('WOMPI_INTEGRITY_SECRET') ?? '').trim();
    if (!integritySecret) {
      return jsonResponse({
        success: false,
        code: 'WOMPI_CONFIG_MISSING',
        missing: ['WOMPI_INTEGRITY_SECRET']
      });
    }

    const envPublicKey = (Deno.env.get('WOMPI_PUBLIC_KEY') ?? '').trim();
    const publicKey = envPublicKey || SANDBOX_PUBLIC_KEY_FALLBACK;
    const environment: WompiEnvironment = publicKey.startsWith('pub_prod_') ? 'production' : 'sandbox';

    let settingsRow: Record<string, unknown> | null = null;
    try {
      const { data: settingsData } = await adminClient
        .from('platform_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (settingsData && typeof settingsData === 'object') {
        settingsRow = settingsData as Record<string, unknown>;
      }
    } catch {
      settingsRow = null;
    }

    const priceFieldMap: Record<PaidPlan, Record<BillingCycle, string>> = {
      pro: {
        monthly: 'pro_monthly_usd',
        annual: 'pro_annual_total_usd'
      },
      industrial: {
        monthly: 'industrial_monthly_usd',
        annual: 'industrial_annual_total_usd'
      }
    };

    const priceColumn = priceFieldMap[plan][billingCycle];
    const defaultUsd = DEFAULT_USD_PRICING[plan][billingCycle];
    const amountUsd = resolvePositiveNumber(settingsRow?.[priceColumn], defaultUsd);
    const exchangeRateCop = resolvePositiveNumber(
      settingsRow?.['usd_to_cop_rate'],
      DEFAULT_USD_TO_COP_RATE
    );

    const amountCop = Math.max(MIN_COP_AMOUNT, Math.round(amountUsd * exchangeRateCop));
    const amountInCents = amountCop * 100;
    const reference = `P3D-${plan.toUpperCase()}-${billingCycle.toUpperCase()}-${user.id.slice(0, 8)}-${Date.now()}-${randomHex4()}`;

    const { error: insertErr } = await adminClient
      .from('payment_transactions')
      .insert({
        user_id: user.id,
        reference,
        plan,
        billing_cycle: billingCycle,
        amount_usd: amountUsd,
        exchange_rate_cop: exchangeRateCop,
        amount_in_cents: amountInCents,
        currency: 'COP',
        environment,
        status: 'PENDING'
      });

    if (insertErr) {
      return jsonResponse({
        success: false,
        code: 'PAYMENT_INIT_FAILED',
        detail: insertErr.message
      });
    }

    const integritySignature = await computeSha256Hex(
      `${reference}${amountInCents}COP${integritySecret}`
    );

    const { data: profileRow } = await adminClient
      .from('user_profiles')
      .select('email, first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();

    const profile = (profileRow && typeof profileRow === 'object'
      ? profileRow
      : null) as Record<string, unknown> | null;

    const profileEmail = typeof profile?.['email'] === 'string' ? profile['email'].trim() : '';
    const authEmail = typeof user.email === 'string' ? user.email.trim() : '';
    const customerEmail = profileEmail || authEmail;

    const firstName = typeof profile?.['first_name'] === 'string' ? profile['first_name'].trim() : '';
    const lastName = typeof profile?.['last_name'] === 'string' ? profile['last_name'].trim() : '';
    const profileFullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const metaName = typeof user.user_metadata?.['full_name'] === 'string'
      ? user.user_metadata['full_name'].trim()
      : (typeof user.user_metadata?.['name'] === 'string' ? user.user_metadata['name'].trim() : '');
    const customerName = profileFullName || metaName || customerEmail;

    return jsonResponse({
      success: true,
      publicKey,
      currency: 'COP',
      amountInCents,
      amountCop,
      amountUsd,
      exchangeRateCop,
      reference,
      integritySignature,
      customerEmail,
      customerName,
      environment,
      ...(redirectUrl ? { redirectUrl } : {})
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected checkout initialization error';
    return jsonResponse({ success: false, code: 'INTERNAL_ERROR', detail: message }, 500);
  }
});
