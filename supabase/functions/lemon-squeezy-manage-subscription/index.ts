import { createClient } from 'npm:@supabase/supabase-js@2';

type SubscriptionAction = 'get_portal_url' | 'sync' | 'cancel' | 'resume';

const CORS_HEADERS = {
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

function normalizeGatewayStatus(rawStatus: unknown, fallback: 'active' | 'cancelled'): string {
  const value = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : '';
  if (value === 'cancelled') return 'cancelled';
  if (value === 'expired') return 'expired';
  if (value === 'past_due' || value === 'unpaid') return 'past_due';
  if (value === 'on_trial') return 'on_trial';
  if (value === 'active') return 'active';
  return fallback;
}

function extractSubscriptionDetails(payload: Record<string, unknown>) {
  const dataObj = (payload['data'] ?? {}) as Record<string, unknown>;
  const attributes = (dataObj['attributes'] ?? {}) as Record<string, unknown>;
  const urls = (attributes['urls'] ?? {}) as Record<string, unknown>;

  const updatePaymentMethodUrl =
    typeof urls['update_payment_method'] === 'string' && urls['update_payment_method'].trim()
      ? urls['update_payment_method'].trim()
      : null;
  const customerPortalUrl =
    typeof urls['customer_portal'] === 'string' && urls['customer_portal'].trim()
      ? urls['customer_portal'].trim()
      : null;

  const endsAt =
    typeof attributes['ends_at'] === 'string' && attributes['ends_at'].trim()
      ? attributes['ends_at'].trim()
      : null;
  const renewsAt =
    typeof attributes['renews_at'] === 'string' && attributes['renews_at'].trim()
      ? attributes['renews_at'].trim()
      : null;

  const rawBrand = typeof attributes['card_brand'] === 'string' ? attributes['card_brand'].trim() : '';
  const cardBrand = rawBrand ? rawBrand.toUpperCase() : null;
  const rawLastFour =
    typeof attributes['card_last_four'] === 'string' ? attributes['card_last_four'].trim() : '';
  const cardLastFour = /^\d{4}$/.test(rawLastFour) ? rawLastFour : null;

  return {
    status: typeof attributes['status'] === 'string' ? attributes['status'] : null,
    cancelled: Boolean(attributes['cancelled']),
    updatePaymentMethodUrl,
    customerPortalUrl,
    periodEnd: endsAt ?? renewsAt,
    cardBrand,
    cardLastFour
  };
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: userData, error: userErr } = await adminClient.auth.getUser(jwt);
    const user = userData?.user ?? null;
    if (userErr || !user) {
      return jsonResponse({ success: false, code: 'UNAUTHORIZED' }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = body['action'] as SubscriptionAction;
    const immediate = Boolean(body['immediate']);

    if (!['get_portal_url', 'sync', 'cancel', 'resume'].includes(action)) {
      return jsonResponse({ success: false, code: 'INVALID_ACTION' }, 400);
    }

    const { data: profile, error: profileErr } = await adminClient
      .from('user_profiles')
      .select(
        'id, plan, subscription_status, subscription_id, customer_id, current_period_end, customer_portal_url, card_brand, card_last_four'
      )
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return jsonResponse({ success: false, code: 'PROFILE_NOT_FOUND' }, 404);
    }

    const subscriptionId =
      typeof profile.subscription_id === 'string' ? profile.subscription_id.trim() : '';
    const lemonApiKey = (Deno.env.get('LEMON_SQUEEZY_API_KEY') ?? '').trim();
    const nowIso = new Date().toISOString();

    if (action === 'get_portal_url' || action === 'sync') {
      if (subscriptionId && lemonApiKey) {
        const res = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${lemonApiKey}`,
            Accept: 'application/vnd.api+json'
          }
        });

        if (res.ok) {
          const lsPayload = (await res.json()) as Record<string, unknown>;
          const details = extractSubscriptionDetails(lsPayload);
          const bestPortalUrl = details.updatePaymentMethodUrl ?? details.customerPortalUrl;
          const resolvedStatus = normalizeGatewayStatus(
            details.status,
            details.cancelled ? 'cancelled' : 'active'
          );

          await adminClient
            .from('user_profiles')
            .update({
              subscription_status: resolvedStatus,
              ...(details.periodEnd ? { current_period_end: details.periodEnd } : {}),
              ...(details.customerPortalUrl || details.updatePaymentMethodUrl
                ? { customer_portal_url: details.customerPortalUrl ?? details.updatePaymentMethodUrl }
                : {}),
              ...(details.cardBrand ? { card_brand: details.cardBrand } : {}),
              ...(details.cardLastFour ? { card_last_four: details.cardLastFour } : {}),
              updated_at: nowIso
            })
            .eq('id', user.id);

          return jsonResponse({
            success: true,
            source: 'lemon_squeezy_api',
            portalUrl: bestPortalUrl,
            customerPortalUrl: details.customerPortalUrl,
            updatePaymentMethodUrl: details.updatePaymentMethodUrl,
            subscription_status: resolvedStatus,
            current_period_end: details.periodEnd ?? profile.current_period_end ?? null,
            cardBrand: details.cardBrand ?? profile.card_brand ?? null,
            cardLastFour: details.cardLastFour ?? profile.card_last_four ?? null
          });
        }
      }

      if (typeof profile.customer_portal_url === 'string' && profile.customer_portal_url.trim()) {
        return jsonResponse({
          success: true,
          source: 'cached_portal_url',
          portalUrl: profile.customer_portal_url.trim(),
          customerPortalUrl: profile.customer_portal_url.trim(),
          updatePaymentMethodUrl: null,
          subscription_status: profile.subscription_status,
          current_period_end: profile.current_period_end ?? null,
          cardBrand: profile.card_brand ?? null,
          cardLastFour: profile.card_last_four ?? null
        });
      }

      return jsonResponse({
        success: false,
        code: subscriptionId ? 'LEMON_API_KEY_MISSING' : 'NO_EXTERNAL_SUBSCRIPTION'
      });
    }

    if (action === 'cancel') {
      if (!subscriptionId) {
        const localUpdate = immediate
          ? { plan: 'free', subscription_status: 'free', updated_at: nowIso }
          : { subscription_status: 'cancelled', updated_at: nowIso };

        const { error: localErr } = await adminClient
          .from('user_profiles')
          .update(localUpdate)
          .eq('id', user.id);

        if (localErr) {
          return jsonResponse({ success: false, code: 'PROFILE_UPDATE_FAILED' }, 500);
        }

        return jsonResponse({
          success: true,
          mode: 'local_profile',
          ...localUpdate
        });
      }

      if (!lemonApiKey) {
        return jsonResponse({
          success: false,
          code: 'LEMON_API_KEY_MISSING',
          portalUrl: profile.customer_portal_url ?? null
        });
      }

      const cancelRes = await fetch(
        `https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${lemonApiKey}`,
            Accept: 'application/vnd.api+json'
          }
        }
      );

      if (!cancelRes.ok) {
        const errText = await cancelRes.text().catch(() => '');
        return jsonResponse({
          success: false,
          code: 'LEMON_API_ERROR',
          detail: errText.slice(0, 300),
          portalUrl: profile.customer_portal_url ?? null
        });
      }

      const lsPayload = (await cancelRes.json()) as Record<string, unknown>;
      const details = extractSubscriptionDetails(lsPayload);

      const { error: syncErr } = await adminClient
        .from('user_profiles')
        .update({
          subscription_status: 'cancelled',
          ...(details.periodEnd ? { current_period_end: details.periodEnd } : {}),
          ...(details.customerPortalUrl ? { customer_portal_url: details.customerPortalUrl } : {}),
          ...(details.cardBrand ? { card_brand: details.cardBrand } : {}),
          ...(details.cardLastFour ? { card_last_four: details.cardLastFour } : {}),
          updated_at: nowIso
        })
        .eq('id', user.id);

      if (syncErr) {
        return jsonResponse({ success: false, code: 'PROFILE_UPDATE_FAILED' }, 500);
      }

      return jsonResponse({
        success: true,
        mode: 'lemon_squeezy',
        subscription_status: 'cancelled',
        current_period_end: details.periodEnd ?? profile.current_period_end ?? null,
        customerPortalUrl: details.customerPortalUrl ?? profile.customer_portal_url ?? null,
        cardBrand: details.cardBrand ?? profile.card_brand ?? null,
        cardLastFour: details.cardLastFour ?? profile.card_last_four ?? null
      });
    }

    // action === 'resume'
    if (!subscriptionId) {
      const { error: resumeLocalErr } = await adminClient
        .from('user_profiles')
        .update({ subscription_status: 'active', updated_at: nowIso })
        .eq('id', user.id);

      if (resumeLocalErr) {
        return jsonResponse({ success: false, code: 'PROFILE_UPDATE_FAILED' }, 500);
      }

      return jsonResponse({
        success: true,
        mode: 'local_profile',
        subscription_status: 'active'
      });
    }

    if (!lemonApiKey) {
      return jsonResponse({
        success: false,
        code: 'LEMON_API_KEY_MISSING',
        portalUrl: profile.customer_portal_url ?? null
      });
    }

    const resumeRes = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${lemonApiKey}`,
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json'
        },
        body: JSON.stringify({
          data: {
            type: 'subscriptions',
            id: subscriptionId,
            attributes: {
              cancelled: false
            }
          }
        })
      }
    );

    if (!resumeRes.ok) {
      const errText = await resumeRes.text().catch(() => '');
      return jsonResponse({
        success: false,
        code: 'LEMON_API_ERROR',
        detail: errText.slice(0, 300),
        portalUrl: profile.customer_portal_url ?? null
      });
    }

    const lsPayload = (await resumeRes.json()) as Record<string, unknown>;
    const details = extractSubscriptionDetails(lsPayload);

    const { error: syncResumeErr } = await adminClient
      .from('user_profiles')
      .update({
        subscription_status: 'active',
        ...(details.periodEnd ? { current_period_end: details.periodEnd } : {}),
        ...(details.customerPortalUrl ? { customer_portal_url: details.customerPortalUrl } : {}),
        ...(details.cardBrand ? { card_brand: details.cardBrand } : {}),
        ...(details.cardLastFour ? { card_last_four: details.cardLastFour } : {}),
        updated_at: nowIso
      })
      .eq('id', user.id);

    if (syncResumeErr) {
      return jsonResponse({ success: false, code: 'PROFILE_UPDATE_FAILED' }, 500);
    }

    return jsonResponse({
      success: true,
      mode: 'lemon_squeezy',
      subscription_status: 'active',
      current_period_end: details.periodEnd ?? profile.current_period_end ?? null,
      customerPortalUrl: details.customerPortalUrl ?? profile.customer_portal_url ?? null,
      cardBrand: details.cardBrand ?? profile.card_brand ?? null,
      cardLastFour: details.cardLastFour ?? profile.card_last_four ?? null
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected subscription error';
    return jsonResponse({ success: false, code: 'INTERNAL_ERROR', detail: message }, 500);
  }
});
