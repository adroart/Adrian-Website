/**
 * POST /api/inquire
 *
 * Body: { name, email, vision, commissionType, budget?, timeline?, referral? }
 *
 * Sends a commission inquiry email via Resend and returns { ok: true }.
 *
 * Environment variables (set in .dev.vars locally, Cloudflare Pages dashboard in prod):
 *   RESEND_API_KEY     — re_... API key from resend.com
 *   INQUIRY_TO_EMAIL   — Inbox that receives inquiries (default: hello@adrianrasmussen.com)
 *   RESEND_FROM_EMAIL  — Verified sender address (default: noreply@adrianrasmussen.com)
 */

const ALLOWED_ORIGINS = [
  'https://adrianrasmussen.com',
  'https://adrian-rasmussen-art.pages.dev',
];

function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Only allow localhost in development (when using test keys)
  if (env?.RESEND_API_KEY?.startsWith('re_test_') || !env?.RESEND_API_KEY) {
    try {
      const url = new URL(origin);
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }
  return false;
}

const DEFAULT_TO = 'technicianofthesacred@gmail.com';
const DEFAULT_FROM = 'noreply@adrianrasmussen.com';

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailHtml(data) {
  const { name, email, commissionType, vision, budget, timeline, referral,
          inquiryType, pieceTitle, purchaseSize, purchaseAddOns, purchaseAvailability, purchasePrice } = data;

  const isPurchase = inquiryType === 'purchase';

  if (isPurchase) {
    const rows = [
      ['Name', name],
      ['Email', email],
      ['Piece', pieceTitle || '—'],
    ];
    if (purchaseSize) rows.push(['Size', purchaseSize]);
    if (purchaseAddOns && purchaseAddOns.length) rows.push(['Add-ons', purchaseAddOns.join(', ')]);
    if (purchaseAvailability) rows.push(['Availability', purchaseAvailability]);
    if (purchasePrice) rows.push(['Price', purchasePrice]);

    const tableRows = rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:8px 12px;font-weight:600;color:#5c4a3a;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 12px;color:#3d3024">${escapeHtml(value)}</td></tr>`
      )
      .join('');

    return `
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#3d3024">
  <h2 style="font-size:22px;font-weight:400;margin-bottom:24px">New Purchase Request</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    ${tableRows}
  </table>
  ${vision ? `<div style="border-top:1px solid #d4c8b8;padding-top:20px">
    <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:0.15em;color:#5c4a3a;margin-bottom:12px">Notes</h3>
    <p style="line-height:1.7;white-space:pre-wrap">${escapeHtml(vision)}</p>
  </div>` : ''}
</div>`.trim();
  }

  const rows = [
    ['Name', name],
    ['Email', email],
    ['Commission Type', commissionType],
  ];
  if (budget) rows.push(['Budget', budget]);
  if (timeline) rows.push(['Timeline', timeline]);
  if (referral) rows.push(['How they found you', referral]);

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;font-weight:600;color:#5c4a3a;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 12px;color:#3d3024">${escapeHtml(value)}</td></tr>`
    )
    .join('');

  return `
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#3d3024">
  <h2 style="font-size:22px;font-weight:400;margin-bottom:24px">New Commission Inquiry</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    ${tableRows}
  </table>
  <div style="border-top:1px solid #d4c8b8;padding-top:20px">
    <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:0.15em;color:#5c4a3a;margin-bottom:12px">What wants to exist</h3>
    <p style="line-height:1.7;white-space:pre-wrap">${escapeHtml(vision)}</p>
  </div>
</div>`.trim();
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

  if (!env.RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Email service is not configured. Please contact the studio directly.' }),
      { status: 503, headers: corsHeaders }
    );
  }

  // Validate required fields
  const { name, email, vision, commissionType, inquiryType } = body;
  const isPurchase = inquiryType === 'purchase';
  if (!name || !email || (!isPurchase && (!vision || !commissionType))) {
    return new Response(
      JSON.stringify({ error: 'Please fill in all required fields.' }),
      { status: 400, headers: corsHeaders }
    );
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(
      JSON.stringify({ error: 'Please provide a valid email address.' }),
      { status: 400, headers: corsHeaders }
    );
  }

  const toEmail = env.INQUIRY_TO_EMAIL || DEFAULT_TO;
  const fromEmail = env.RESEND_FROM_EMAIL || DEFAULT_FROM;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `Adrian Rasmussen Art <${fromEmail}>`,
      to: [toEmail],
      reply_to: email,
      subject: isPurchase
        ? `Purchase Request from ${name} — ${body.pieceTitle || 'Piece'}`
        : `Commission Inquiry from ${name} (${commissionType})`,
      html: buildEmailHtml(body),
    }),
  });

  if (!resendRes.ok) {
    const err = await resendRes.json().catch(() => ({}));
    console.error('Resend error:', JSON.stringify(err));
    return new Response(
      JSON.stringify({ error: 'Your message could not be sent. Please try again or contact the studio directly.' }),
      { status: 502, headers: corsHeaders }
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
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
