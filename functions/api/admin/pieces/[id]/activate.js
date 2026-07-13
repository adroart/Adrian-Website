import {
  jsonResponse,
  requireAdminPostStepUp,
  requireDb,
  writeOwnershipAudit,
} from '../../../_lib/admin.js';
import { prepareNextLineageEvent } from '../../../_lib/lineage.js';

const CONFIRMATIONS = [
  'realMetalQrScanned',
  'artworkEditionPublicCodeMatch',
  'undersideOwnershipCodeMatch',
  'attachmentAndAbrasionInspected',
];

function validateChecks(body) {
  return CONFIRMATIONS.every((field) => body?.[field] === true);
}

function hashesMatch(row, body) {
  return body?.frontSha256 === row.front_svg_sha256 &&
    body?.undersideSha256 === row.back_svg_sha256;
}

export async function onRequest({ request, env, params }) {
  const authorization = await requireAdminPostStepUp(request, env);
  if (authorization.response) return authorization.response;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  const { body } = authorization;
  if (!validateChecks(body)) {
    return jsonResponse({ ok: false, error: 'physical_checks_incomplete' }, 400);
  }

  try {
    const row = await env.DB.prepare(
      'SELECT * FROM keeper_pieces WHERE id = ?1',
    ).bind(params.id).first();
    if (!row || !['generated', 'active'].includes(row.plate_status)) {
      return jsonResponse({ ok: false, error: 'plate_not_found' }, 404);
    }
    if (!hashesMatch(row, body)) {
      return jsonResponse({ ok: false, error: 'fabrication_hash_mismatch' }, 409);
    }
    if (row.backup_status !== 'verified') {
      return jsonResponse({ ok: false, error: 'verified_backup_required' }, 409);
    }
    if (row.plate_status === 'active') {
      await writeOwnershipAudit(env, {
        keeperPieceId: row.id,
        action: 'activate',
        outcome: 'already_active',
      });
      return jsonResponse({ ok: true, plateStatus: 'active', idempotent: true });
    }

    try {
      await writeOwnershipAudit(env, {
        keeperPieceId: row.id,
        action: 'activate',
        outcome: 'activation_attempt',
      });
    } catch {
      return jsonResponse({ ok: false, error: 'audit_unavailable' }, 503);
    }

    const activatedAt = new Date().toISOString();
    const update = env.DB.prepare(
      `UPDATE keeper_pieces
          SET plate_status = 'active', plate_activated_at = ?1
        WHERE id = ?2 AND plate_status = 'generated'`,
    ).bind(activatedAt, row.id);
    if (typeof env.DB.batch !== 'function') {
      return jsonResponse({ ok: false, error: 'atomic_write_unavailable' }, 503);
    }
    const lineage = await prepareNextLineageEvent(env, {
      keeperPieceId: row.id,
      eventType: 'activated',
      eventAt: activatedAt,
      publicPayload: { plateStatus: 'active' },
      onlyIfPreviousChanged: true,
    });
    const [result] = await env.DB.batch([
      update,
      lineage.statement,
      lineage.anchorStatement,
    ]);
    const changes = result?.meta?.changes;
    if (changes === 0) {
      const current = await env.DB.prepare(
        'SELECT * FROM keeper_pieces WHERE id = ?1',
      ).bind(row.id).first();
      if (
        current?.plate_status === 'active' &&
        current.backup_status === 'verified' &&
        hashesMatch(current, body)
      ) {
        return jsonResponse({ ok: true, plateStatus: 'active', idempotent: true });
      }
      return jsonResponse({ ok: false, error: 'activation_conflict' }, 409);
    }
    return jsonResponse({
      ok: true,
      plateStatus: 'active',
      activatedAt,
      idempotent: false,
    });
  } catch {
    return jsonResponse({ ok: false, error: 'activation_failed' }, 500);
  }
}
