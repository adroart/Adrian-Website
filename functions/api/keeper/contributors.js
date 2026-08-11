import { isSameOrigin, requireUser } from '../_lib/auth.js';
import { legacyEnabled, notFound } from '../_lib/keeper.js';
import {
  inviteArtworkContributor,
  listArtworkContributors,
  revokeArtworkContributor,
} from '../_lib/artworkContributors.js';

const INVITE_FIELDS = new Set([
  'action', 'keeperPieceId', 'intendedRecipientEmail', 'expiresAt', 'idempotencyKey',
]);
const REVOKE_INVITATION_FIELDS = new Set([
  'action', 'keeperPieceId', 'invitationId', 'idempotencyKey',
]);
const REVOKE_ACCESS_FIELDS = new Set([
  'action', 'keeperPieceId', 'accessId', 'idempotencyKey',
]);

function exactObject(value, fields) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === fields.size
    && Object.keys(value).every((key) => fields.has(key));
}

function validIdempotencyKey(value) {
  return typeof value === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(value);
}

function validExpiry(value, now) {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    || !Number.isFinite(Date.parse(value))) return false;
  const duration = Date.parse(value) - Date.parse(now);
  return duration <= 31 * 24 * 60 * 60 * 1000;
}

function statusFor(code) {
  if ([
    'invalid_keeper_piece_id', 'invalid_contributor_email', 'idempotency_key_required',
    'invalid_contributor_expiry', 'invalid_invited_at', 'invalid_revoked_at',
    'invalid_contributor_invitation_id', 'invalid_contributor_access_id',
    'exact_contributor_revocation_target_required',
  ].includes(code)) return 400;
  if (code === 'keeper_authority_required') return 403;
  if ([
    'keeper_piece_not_found', 'contributor_invitation_not_found',
    'contributor_access_not_found',
  ].includes(code)) return 404;
  if ([
    'stale_keeper_authority', 'contributor_recipient_not_available',
    'contributor_cannot_be_keeper', 'contributor_already_invited',
    'contributor_already_active', 'contributor_idempotency_conflict',
    'contributor_invitation_used', 'contributor_invitation_revoked',
    'contributor_invitation_expired', 'contributor_invitation_not_available',
  ].includes(code)) return 409;
  if (code === 'contributor_invite_rate_limited') return 429;
  if (code === 'contributor_invite_in_progress') return 409;
  if (code === 'contributor_db_required') return 503;
  return 500;
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export async function onRequest({ request, env }) {
  if (!legacyEnabled()) return notFound();
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
  }
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  if (request.method === 'POST' && !isSameOrigin(request)) {
    return json({ ok: false, error: 'origin_forbidden' }, 403);
  }
  if (!env?.DB) return json({ ok: false, error: 'contributor_unavailable' }, 503);

  const now = new Date().toISOString();
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.searchParams.size !== 1 || !url.searchParams.has('keeperPieceId')) {
        return json({ ok: false, error: 'invalid_query' }, 400);
      }
      const keeperPieceId = url.searchParams.get('keeperPieceId');
      const result = await listArtworkContributors(env, {
        keeperPieceId, keeperUserId: auth.userId, at: now,
      });
      return json({ ok: true, ...result });
    }

    if (new URL(request.url).searchParams.size !== 0) {
      return json({ ok: false, error: 'invalid_query' }, 400);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'invalid_json' }, 400);
    }
    const fields = body?.action === 'invite'
      ? INVITE_FIELDS
      : body?.action === 'revoke' && Object.hasOwn(body, 'invitationId')
        ? REVOKE_INVITATION_FIELDS
        : body?.action === 'revoke' && Object.hasOwn(body, 'accessId')
          ? REVOKE_ACCESS_FIELDS
          : null;
    if (!fields || !exactObject(body, fields)) {
      return json({ ok: false, error: 'invalid_contributor_request' }, 400);
    }
    if (!validIdempotencyKey(body.idempotencyKey)) {
      return json({ ok: false, error: 'invalid_idempotency_key' }, 400);
    }
    if (body.action === 'invite') {
      if (!validExpiry(body.expiresAt, now)) {
        return json({ ok: false, error: 'invalid_contributor_expiry' }, 400);
      }
      const result = await inviteArtworkContributor(env, {
        keeperPieceId: body.keeperPieceId,
        keeperUserId: auth.userId,
        intendedRecipientEmail: body.intendedRecipientEmail,
        expiresAt: body.expiresAt,
        idempotencyKey: body.idempotencyKey,
        invitedAt: now,
      });
      const response = {
        ok: true,
        invitationId: result.invitationId,
        status: result.status,
        ...(result.status === 'created' ? { token: result.token } : {}),
      };
      return json(
        response,
        result.status === 'created' ? 201 : 200,
        result.status === 'created' ? { 'Referrer-Policy': 'no-referrer' } : {},
      );
    }
    const result = await revokeArtworkContributor(env, {
      keeperPieceId: body.keeperPieceId,
      keeperUserId: auth.userId,
      ...(body.invitationId ? { invitationId: body.invitationId } : { accessId: body.accessId }),
      idempotencyKey: body.idempotencyKey,
      revokedAt: now,
    });
    return json({ ok: true, invitationId: result.invitationId, status: result.status });
  } catch (error) {
    const code = error?.isArtworkContributorError && typeof error.code === 'string'
      ? error.code
      : '';
    if (code) {
      const headers = code === 'contributor_invite_rate_limited'
        || code === 'contributor_invite_in_progress'
        ? { 'Retry-After': String(error.retryAfter) }
        : {};
      return json({ ok: false, error: code }, statusFor(code), headers);
    }
    return json({ ok: false, error: 'contributor_request_failed' }, 500);
  }
}
