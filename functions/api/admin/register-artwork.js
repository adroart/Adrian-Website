/**
 * POST /api/admin/register-artwork — the unified register-an-artwork operation.
 *
 * One idempotent call behind the /admin/register ceremony. It accepts EITHER
 * an existing catalog/draft artwork id OR a brand-new registry-only artwork
 * typed inline, plus the edition, and in one pass: ensures the draft row an
 * inline artwork needs, takes an append-only catalog snapshot, runs the
 * existing registration transaction (identity issuance, encrypted Ownership
 * Code, fail-hard R2 identity backup, lineage event, maintenance event), then
 * generates the first Piece Record fail-soft.
 *
 * The registry is deliberately independent of commerce: there are no Stripe,
 * Shopify, order, or fulfillment fields anywhere in this contract, and any
 * unexpected key is rejected outright.
 *
 * The older, narrower POST /api/admin/registrations stays untouched.
 */
import {
  jsonResponse,
  requireDb,
  requireRegistryUnlock,
} from '../_lib/admin.js';
import { registerArtworkWithRecord } from '../_lib/artworkRegistration.js';

const ALLOWED_KEYS = ['artworkId', 'newArtwork', 'edition', 'idempotencyKey'];

function errorStatus(code) {
  if ([
    'invalid_registration',
    'invalid_new_artwork',
    'reserved_artwork_id',
    'invalid_edition',
    'edition_size_required',
    'idempotency_key_required',
  ].includes(code)) return 400;
  if (['registry_unlock_required', 'registry_locked'].includes(code)) return 403;
  if (code === 'unknown_artwork') return 404;
  if ([
    'artwork_id_taken',
    'edition_conflict',
    'edition_size_below_issued',
    'edition_metadata_required',
    'artwork_edition_metadata_conflict',
    'idempotency_conflict',
    'registration_conflict',
  ].includes(code)) return 409;
  if ([
    'identity_backup_failed',
    'atomic_write_unavailable',
    'ownership_code_crypto_not_configured',
    'public_code_collision',
    'db_not_configured',
  ].includes(code)) return 503;
  return null;
}

function projectResult(result) {
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
    artwork: {
      id: result.artwork.id,
      title: result.artwork.title,
      series: result.artwork.series,
    },
    record: {
      status: result.record.status,
      ...(result.record.status === 'deferred' && result.record.reason
        ? { reason: result.record.reason }
        : {}),
    },
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
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || !Object.keys(body).every((key) => ALLOWED_KEYS.includes(key))
    || body.edition === undefined
    || body.idempotencyKey === undefined) {
    return jsonResponse({ ok: false, error: 'invalid_registration' }, 400);
  }
  const idempotencyKey = typeof body.idempotencyKey === 'string'
    ? body.idempotencyKey.trim()
    : '';
  if (!idempotencyKey || idempotencyKey.length > 128) {
    return jsonResponse({ ok: false, error: 'idempotency_key_required' }, 400);
  }

  try {
    const result = await registerArtworkWithRecord(env, {
      ...(body.artworkId !== undefined ? { artworkId: body.artworkId } : {}),
      ...(body.newArtwork !== undefined ? { newArtwork: body.newArtwork } : {}),
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
      projectResult(result),
      result.codeAccess === 'created' ? 201 : 200,
    );
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : '';
    const status = errorStatus(code);
    if (status) return jsonResponse({ ok: false, error: code }, status);
    return jsonResponse({ ok: false, error: 'registration_failed' }, 500);
  }
}
