import {
  jsonResponse,
  requireDb,
  requireRegistryUnlock,
} from '../_lib/admin.js';
import { registerArtwork } from '../_lib/artworkRegistration.js';

const CLIENT_KEYS = ['artworkId', 'edition', 'idempotencyKey'];

function hasExactKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...expected].sort().join('\0');
}

function validEditionShape(edition) {
  if (!edition || typeof edition !== 'object' || Array.isArray(edition)) return false;
  if (edition.kind === 'unique') return hasExactKeys(edition, ['kind']);
  if (edition.kind === 'numbered') {
    return hasExactKeys(edition, ['kind', 'number', 'size'])
      && Number.isSafeInteger(edition.number)
      && edition.number >= 1
      && (
        edition.size === null
        || (
          Number.isSafeInteger(edition.size)
          && edition.size >= edition.number
        )
      );
  }
  return false;
}

function errorStatus(code) {
  if (['invalid_registration', 'invalid_edition', 'idempotency_key_required'].includes(code)) {
    return 400;
  }
  if (code === 'unknown_artwork') return 404;
  if ([
    'edition_metadata_required',
    'idempotency_conflict',
    'registration_conflict',
  ].includes(code)) return 409;
  if ([
    'identity_backup_failed',
    'atomic_write_unavailable',
    'ownership_code_crypto_not_configured',
    'public_code_collision',
  ].includes(code)) return 503;
  return null;
}

function projectRegistration(result) {
  return {
    ok: true,
    keeperPieceId: result.keeperPieceId,
    publicCode: result.publicCode,
    ...(typeof result.ownershipCode === 'string'
      ? { ownershipCode: result.ownershipCode }
      : {}),
    codeAccess: result.codeAccess,
    registrationStatus: result.registrationStatus,
    backupStatus: result.backupStatus,
  };
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return jsonResponse(
      { ok: false, error: 'method_not_allowed' },
      405,
      { Allow: 'POST' },
    );
  }

  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  if (!env.ARTWORK_REGISTRY_BACKUP) {
    return jsonResponse({ ok: false, error: 'backup_not_configured' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!hasExactKeys(body, CLIENT_KEYS)) {
    return jsonResponse({ ok: false, error: 'invalid_registration' }, 400);
  }
  if (!validEditionShape(body.edition)) {
    return jsonResponse({ ok: false, error: 'invalid_edition' }, 400);
  }
  const idempotencyKey = typeof body.idempotencyKey === 'string'
    ? body.idempotencyKey.trim()
    : '';
  if (!idempotencyKey || idempotencyKey.length > 128) {
    return jsonResponse({ ok: false, error: 'idempotency_key_required' }, 400);
  }

  try {
    const result = await registerArtwork(env, {
      artworkId: body.artworkId,
      edition: body.edition,
      idempotencyKey,
      authorization: {
        userId: authorization.userId,
        email: authorization.email,
        registryUnlockExpiresAt: authorization.registryUnlockExpiresAt,
      },
      registeredAt: new Date().toISOString(),
    });
    return jsonResponse(
      projectRegistration(result),
      result.codeAccess === 'created' ? 201 : 200,
    );
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : '';
    const status = errorStatus(code);
    if (status) return jsonResponse({ ok: false, error: code }, status);
    return jsonResponse({ ok: false, error: 'registration_failed' }, 500);
  }
}
