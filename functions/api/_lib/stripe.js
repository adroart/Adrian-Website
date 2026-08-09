/**
 * Stripe REST helpers. The checkout endpoint already uses raw fetch to
 * avoid pulling in the Stripe SDK; we follow the same pattern here so
 * Workers stay slim.
 */

const STRIPE_API = 'https://api.stripe.com/v1';

/** Parse a lowercase/uppercase hex string into bytes, or null if malformed. */
function hexToBytes(hex) {
  if (typeof hex !== 'string' || hex.length === 0 || hex.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Constant-time equality for two Uint8Arrays. */
function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * POST to a Stripe endpoint with form-encoded body, returning the parsed
 * JSON. Throws on non-2xx.
 */
async function stripeFetch(path, params, env) {
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
  const body = new URLSearchParams();
  const append = (key, val) => {
    if (val == null) return;
    if (Array.isArray(val)) val.forEach((v, i) => append(`${key}[${i}]`, v));
    else if (typeof val === 'object') {
      for (const [k, v] of Object.entries(val)) append(`${key}[${k}]`, v);
    } else body.append(key, String(val));
  };
  for (const [k, v] of Object.entries(params || {})) append(k, v);

  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe ${path} ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Idempotent: looks up an existing Stripe Customer by email first, then
 * creates one if none match. Returns the Stripe customer id.
 */
export async function ensureStripeCustomer(env, { email, authUserId }) {
  // Find by email — Stripe doesn't enforce uniqueness so we take the
  // first match. If multiple exist Adrian has a deeper data issue worth
  // investigating manually.
  const found = await fetch(
    `${STRIPE_API}/customers?email=${encodeURIComponent(email)}&limit=1`,
    { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } },
  ).then((r) => r.json());

  if (found?.data?.[0]?.id) return found.data[0].id;

  const created = await stripeFetch(
    '/customers',
    {
      email,
      metadata: { auth_user_id: authUserId },
    },
    env,
  );
  return created.id;
}

/**
 * Verify a Stripe webhook signature manually. Uses the timestamp + body
 * scheme from `Stripe-Signature` header. Avoids the Stripe SDK so this
 * stays Worker-compatible.
 */
export async function verifyStripeWebhook(request, env) {
  const sig = request.headers.get('stripe-signature') || '';
  if (!sig || !env.STRIPE_WEBHOOK_SECRET) return null;
  const parts = Object.fromEntries(sig.split(',').map((p) => p.split('=')));
  const ts = parts.t;
  const v1 = parts.v1;
  if (!ts || !v1) return null;

  const body = await request.text();
  const payload = `${ts}.${body}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.STRIPE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  const provided = hexToBytes(v1);

  // Constant-time comparison — never use === on a signature.
  if (!timingSafeEqual(mac, provided)) return null;
  // Reject events older than 5 minutes to limit replay window.
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return null;
  try {
    return { event: JSON.parse(body), raw: body };
  } catch {
    return null;
  }
}
