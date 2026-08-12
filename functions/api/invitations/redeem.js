import { requireUser } from '../_lib/auth.js';
import { redeemArtworkInvitation } from '../_lib/artworkInvitations.js';

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      ...headers,
    },
  });
}

function statusFor(code) {
  if (['invitation_not_found'].includes(code)) return 404;
  if (['invitation_recipient_mismatch'].includes(code)) return 403;
  if ([
    'invitation_used', 'invitation_expired', 'invitation_revoked',
    'piece_already_held', 'identity_not_ready',
    'identity_recovery_not_qualified',
  ].includes(code)) return 409;
  if (['atomic_write_unavailable'].includes(code)) return 503;
  return 400;
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  }
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  const verifiedEmail = typeof auth.email === 'string' ? auth.email.trim().toLowerCase() : '';
  if (!verifiedEmail || auth.user?.emailVerified !== true) {
    return json({ ok: false, error: 'verified_email_required' }, 403);
  }
  if (!env?.DB) return json({ ok: false, error: 'invitation_unavailable' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  if (
    !body
    || typeof body !== 'object'
    || Array.isArray(body)
    || Object.keys(body).length !== 1
    || typeof body.token !== 'string'
    || !body.token
  ) {
    return json({ ok: false, error: 'invalid_invitation_proof' }, 400);
  }

  try {
    const result = await redeemArtworkInvitation(env, {
      token: body.token,
      claimant: { userId: auth.userId, verifiedEmail },
      evidence: {
        ipAddress: request.headers.get('CF-Connecting-IP'),
        userAgent: request.headers.get('User-Agent'),
      },
      redeemedAt: new Date().toISOString(),
    });
    return json({ ok: true, ...result });
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : '';
    if (code) return json({ ok: false, error: code }, statusFor(code));
    return json({ ok: false, error: 'invitation_redemption_failed' }, 500);
  }
}
