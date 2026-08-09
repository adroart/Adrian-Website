import {
  jsonResponse,
  requireDb,
  requireRegistryUnlock,
} from '../_lib/admin.js';
import {
  createArtworkInvitation,
  listArtworkInvitations,
  revokeArtworkInvitation,
} from '../_lib/artworkInvitations.js';

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function statusFor(code) {
  if ([
    'invalid_invitation', 'invalid_recipient_email', 'invalid_expiry',
    'idempotency_key_required', 'invalid_created_at', 'invalid_revoked_at',
  ].includes(code)) return 400;
  if (['piece_not_found', 'invitation_not_found'].includes(code)) return 404;
  if ([
    'piece_not_registered', 'piece_already_held', 'invitation_already_created',
    'invitation_used', 'invitation_expired', 'invitation_revoked',
    'invitation_unavailable',
  ].includes(code)) return 409;
  return 500;
}

async function requestBody(request) {
  try {
    return { value: await request.json() };
  } catch {
    return { error: jsonResponse({ ok: false, error: 'invalid_json' }, 400) };
  }
}

export async function onRequest({ request, env }) {
  if (!['GET', 'POST', 'DELETE'].includes(request.method)) {
    return jsonResponse(
      { ok: false, error: 'method_not_allowed' },
      405,
      { Allow: 'GET, POST, DELETE' },
    );
  }
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  try {
    if (request.method === 'GET') {
      return jsonResponse({
        ok: true,
        invitations: await listArtworkInvitations(env),
      });
    }

    const parsed = await requestBody(request);
    if (parsed.error) return parsed.error;
    if (request.method === 'DELETE') {
      if (!exactKeys(parsed.value, ['invitationId'])) {
        return jsonResponse({ ok: false, error: 'invalid_invitation' }, 400);
      }
      const result = await revokeArtworkInvitation(env, {
        invitationId: parsed.value.invitationId,
        revokedBy: authorization.userId,
        revokedAt: new Date().toISOString(),
      });
      return jsonResponse({ ok: true, ...result });
    }

    if (!exactKeys(parsed.value, [
      'keeperPieceId', 'intendedRecipientEmail', 'expiresAt', 'idempotencyKey',
    ])) {
      return jsonResponse({ ok: false, error: 'invalid_invitation' }, 400);
    }
    const result = await createArtworkInvitation(env, {
      keeperPieceId: parsed.value.keeperPieceId,
      intendedRecipientEmail: parsed.value.intendedRecipientEmail,
      expiresAt: parsed.value.expiresAt,
      idempotencyKey: parsed.value.idempotencyKey,
      createdBy: authorization.userId,
      createdAt: new Date().toISOString(),
    });
    return jsonResponse({ ok: true, ...result }, 201);
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : '';
    if (code) return jsonResponse({ ok: false, error: code }, statusFor(code));
    return jsonResponse({ ok: false, error: 'invitation_request_failed' }, 500);
  }
}
