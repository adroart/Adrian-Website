/**
 * POST /api/subscribe
 *
 * Body: { email: string }
 *
 * Proxies the Kit (ConvertKit) subscribe call server-side so ad blockers
 * cannot intercept the request to api.convertkit.com.
 *
 * Environment variables (set in .dev.vars locally, Cloudflare Pages dashboard in prod):
 *   KIT_FORM_ID         — numeric form ID from Kit
 *   KIT_PUBLIC_API_KEY   — public API key from Kit
 */

const ALLOWED_ORIGINS = [
  'https://adrianrasmussen.com',
  'https://adrian-rasmussen-art.pages.dev',
];

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow localhost in development
  if (!env?.KIT_PUBLIC_API_KEY) {
    try {
      const url = new URL(origin);
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }
  // Also allow localhost when env vars are present (local dev with wrangler)
  try {
    const url = new URL(origin);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
  } catch {
    // ignore
  }
  return false;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const requestOrigin = request.headers.get('origin') || '';
  const origin = isAllowedOrigin(requestOrigin, env) ? requestOrigin : ALLOWED_ORIGINS[0];

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

  const formId = env.KIT_FORM_ID;
  const apiKey = env.KIT_PUBLIC_API_KEY;

  if (!formId || !apiKey) {
    return new Response(
      JSON.stringify({ error: 'Newsletter service is not configured.' }),
      { status: 503, headers: corsHeaders }
    );
  }

  const { email } = body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(
      JSON.stringify({ error: 'Please provide a valid email address.' }),
      { status: 400, headers: corsHeaders }
    );
  }

  const kitRes = await fetch(
    `https://api.convertkit.com/v3/forms/${formId}/subscribe`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ api_key: apiKey, email }),
    }
  );

  const data = await kitRes.json().catch(() => ({}));

  if (!kitRes.ok || !data.subscription) {
    console.error('Kit error:', JSON.stringify(data));
    return new Response(
      JSON.stringify({ error: 'Subscription failed. Please try again.' }),
      { status: 502, headers: corsHeaders }
    );
  }

  return new Response(JSON.stringify({ subscription: data.subscription }), {
    status: 200,
    headers: corsHeaders,
  });
}

// Handle CORS preflight
export async function onRequestOptions(context) {
  const requestOrigin = context.request.headers.get('origin') || '';
  const origin = isAllowedOrigin(requestOrigin, context.env) ? requestOrigin : ALLOWED_ORIGINS[0];

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
