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

export async function onRequestPost(context) {
  const { request, env } = context;

  const origin = request.headers.get('origin') || 'https://adrianrasmussen.com';

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
  };

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

  // Validate each item has a real price ID (not a placeholder)
  for (const item of items) {
    if (!item.stripePriceId || !item.stripePriceId.startsWith('price_')) {
      return new Response(
        JSON.stringify({ error: `Invalid stripePriceId: ${item.stripePriceId}` }),
        { status: 400, headers: corsHeaders }
      );
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return new Response(
        JSON.stringify({ error: 'quantity must be a positive integer' }),
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
      success_url: `${origin}/shop?checkout=success`,
      cancel_url: `${origin}/shop?checkout=cancelled`,
      // Allow promo codes
      allow_promotion_codes: 'true',
    }),
  });

  const session = await stripeRes.json();

  if (!stripeRes.ok || !session.url) {
    console.error('Stripe error:', session);
    return new Response(
      JSON.stringify({ error: session.error?.message || 'Stripe session creation failed' }),
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
  const origin = context.request.headers.get('origin') || 'https://adrianrasmussen.com';
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
