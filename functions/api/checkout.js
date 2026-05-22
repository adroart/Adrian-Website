/**
 * POST /api/checkout
 *
 * Body: { items: Array<{ stripePriceId: string; quantity: number }> }
 *
 * Returns: { url: string } — Stripe Checkout Session URL to redirect to.
 *
 * Environment variables (set in .dev.vars locally, Cloudflare Pages dashboard in prod):
 *   STRIPE_SECRET_KEY  — sk_live_... or sk_test_...
 */

// Countries to which Adrian ships from Bali.
// Add or remove codes as needed before going live.
const SHIPPING_COUNTRIES = [
  'US', 'CA', 'GB', 'AU', 'NZ',
  'SG', 'MY', 'ID', 'TH', 'PH', 'JP', 'KR', 'HK', 'TW',
  'DE', 'FR', 'NL', 'BE', 'CH', 'AT', 'IT', 'ES', 'PT',
  'SE', 'NO', 'DK', 'FI',
  'AE', 'IL', 'ZA', 'IN',
  'BR', 'MX', 'AR',
];

// Allowed origins for CORS and redirect URLs.
// Add localhost variants for local development as needed.
const ALLOWED_ORIGINS = [
  'https://adrianrasmussen.com',
  'https://adrian-rasmussen-art.pages.dev',
];

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Only allow localhost in development (when using test keys)
  if (env?.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
    try {
      const url = new URL(origin);
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }
  return false;
}

const MAX_ITEMS = 20;
const MAX_QUANTITY_PER_ITEM = 10;

// Simple in-memory rate limiter: max 5 requests per IP per 60s window
// Note: resets when Worker instance is recycled. Effective for burst prevention.
const rateLimitMap = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, windowStart: now };

  // Reset window if expired
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry.count = 0;
    entry.windowStart = now;
  }

  entry.count += 1;
  rateLimitMap.set(ip, entry);

  // Clean up old entries periodically
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now - val.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(key);
    }
  }

  return entry.count <= RATE_LIMIT_MAX;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const requestOrigin = request.headers.get('origin') || '';
  const origin = isAllowedOrigin(requestOrigin, env)
    ? requestOrigin
    : ALLOWED_ORIGINS[0];

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
  };

  const clientIp = request.headers.get('cf-connecting-ip') ||
                   request.headers.get('x-forwarded-for') ||
                   'unknown';

  if (!checkRateLimit(clientIp)) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait a moment and try again.' }),
      { status: 429, headers: { ...corsHeaders, 'Retry-After': '60' } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (!env.STRIPE_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Payment system is not configured. Please contact the studio.' }), {
      status: 503,
      headers: corsHeaders,
    });
  }

  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return new Response(JSON.stringify({ error: 'items must be a non-empty array' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (items.length > MAX_ITEMS) {
    return new Response(JSON.stringify({ error: `Too many items. Maximum is ${MAX_ITEMS}.` }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Validate each item has a real price ID (not a placeholder)
  for (const item of items) {
    if (typeof item.stripePriceId !== 'string' || !item.stripePriceId.startsWith('price_')) {
      return new Response(
        JSON.stringify({ error: 'One or more items have an invalid price identifier.' }),
        { status: 400, headers: corsHeaders }
      );
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY_PER_ITEM) {
      return new Response(
        JSON.stringify({ error: `Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}.` }),
        { status: 400, headers: corsHeaders }
      );
    }
  }

  // Build shipping address country params
  const shippingParams = Object.fromEntries(
    SHIPPING_COUNTRIES.map((cc, i) => [
      `shipping_address_collection[allowed_countries][${i}]`,
      cc,
    ])
  );

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      mode: 'payment',
      // Build line_items[N][price] and line_items[N][quantity]
      ...Object.fromEntries(
        items.flatMap((item, i) => [
          [`line_items[${i}][price]`, item.stripePriceId],
          [`line_items[${i}][quantity]`, String(item.quantity)],
        ])
      ),
      // Collect shipping address for all orders (ships internationally from Bali)
      ...shippingParams,
      success_url: `${origin}/order-confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop?checkout=cancelled`,
      // Allow promo codes
      allow_promotion_codes: 'true',
    }),
  });

  const session = await stripeRes.json();

  if (!stripeRes.ok || !session.url) {
    // Log full error server-side for debugging, but never expose to client
    console.error('Stripe error:', JSON.stringify(session));
    return new Response(
      JSON.stringify({ error: 'Payment session could not be created. Please try again or contact the studio.' }),
      { status: 502, headers: corsHeaders }
    );
  }

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: corsHeaders,
  });
}

// Handle CORS preflight
export async function onRequestOptions(context) {
  const requestOrigin = context.request.headers.get('origin') || '';
  const origin = isAllowedOrigin(requestOrigin, context.env)
    ? requestOrigin
    : ALLOWED_ORIGINS[0];

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
