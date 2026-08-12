import { isSameOrigin, requireUser } from './_lib/auth.js';
import { legacyEnabled, notFound } from './_lib/keeper.js';
import {
  acceptArtworkContributorInvitation,
  inspectArtworkContributorInvitation,
} from './_lib/artworkContributors.js';

const INSPECT_FIELDS = new Set(['action', 'token']);
const ACCEPT_FIELDS = new Set(['action', 'token', 'idempotencyKey']);

function exactObject(value, fields) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === fields.size
    && Object.keys(value).every((key) => fields.has(key));
}

function validToken(value) {
  return typeof value === 'string' && value.length >= 32 && value.length <= 512
    && !/\s/.test(value);
}

function validIdempotencyKey(value) {
  return typeof value === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(value);
}

function statusFor(code) {
  if ([
    'invalid_inspection_time', 'invalid_accepted_at', 'idempotency_key_required',
  ].includes(code)) return 400;
  if (code === 'contributor_invitation_not_available') return 404;
  if ([
    'contributor_invitation_stale', 'contributor_invitation_used',
    'contributor_invitation_expired', 'contributor_invitation_revoked',
    'contributor_invitation_already_active', 'contributor_invitation_claim_pending',
    'contributor_idempotency_conflict',
  ].includes(code)) return 409;
  if (code === 'contributor_db_required') return 503;
  return 500;
}

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

export async function onRequest({ request, env }) {
  if (!legacyEnabled()) return notFound();
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  }
  const auth = await requireUser(request, env);
  if (auth instanceof Response) {
    const headers = new Headers(auth.headers);
    headers.set('Cache-Control', 'no-store');
    headers.set('Referrer-Policy', 'no-referrer');
    return new Response(auth.body, { status: auth.status, statusText: auth.statusText, headers });
  }
  if (!isSameOrigin(request)) return json({ ok: false, error: 'origin_forbidden' }, 403);
  const verifiedEmail = typeof auth.email === 'string' ? auth.email.trim().toLowerCase() : '';
  if (!verifiedEmail || auth.user?.emailVerified !== true) {
    return json({ ok: false, error: 'verified_email_required' }, 403);
  }
  if (!env?.DB) return json({ ok: false, error: 'contributor_unavailable' }, 503);
  if (new URL(request.url).searchParams.size !== 0) {
    return json({ ok: false, error: 'invalid_query' }, 400);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  const fields = body?.action === 'inspect'
    ? INSPECT_FIELDS
    : body?.action === 'accept'
      ? ACCEPT_FIELDS
      : null;
  if (!fields || !exactObject(body, fields) || !validToken(body.token)) {
    return json({ ok: false, error: 'invalid_contributor_request' }, 400);
  }
  if (body.action === 'accept' && !validIdempotencyKey(body.idempotencyKey)) {
    return json({ ok: false, error: 'invalid_idempotency_key' }, 400);
  }
  const claimant = { userId: auth.userId, verifiedEmail };
  const now = new Date().toISOString();
  try {
    if (body.action === 'inspect') {
      const inspected = await inspectArtworkContributorInvitation(env, {
        token: body.token, claimant, inspectedAt: now,
      });
      return json({
        ok: true,
        invitationId: inspected.invitationId,
        artwork: inspected.artwork,
        status: inspected.status,
      });
    }
    const accepted = await acceptArtworkContributorInvitation(env, {
      token: body.token,
      claimant,
      idempotencyKey: body.idempotencyKey,
      acceptedAt: now,
    });
    return json({
      ok: true, invitationId: accepted.invitationId, status: accepted.status,
    });
  } catch (error) {
    const code = error?.isArtworkContributorError && typeof error.code === 'string'
      ? error.code
      : '';
    if (code) return json({ ok: false, error: code }, statusFor(code));
    return json({ ok: false, error: 'contributor_invitation_request_failed' }, 500);
  }
}
