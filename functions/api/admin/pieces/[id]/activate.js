import {
  jsonResponse,
  requireRegistryUnlock,
  requireDb,
  writeOwnershipAudit,
} from '../../../_lib/admin.js';
import { prepareNextLineageEvent } from '../../../_lib/lineage.js';
import {
  loadLatestPassedPieceQualification,
  recoveryDependenciesForRow,
  recoveryQualificationStatus,
} from '../../../_lib/recoveryQualification.js';
import { plateBackupIsVerified } from '../../../_lib/plateBackup.js';

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
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
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
    if (!plateBackupIsVerified(row)) {
      return jsonResponse({ ok: false, error: 'verified_backup_required' }, 409);
    }
    const dependencies = recoveryDependenciesForRow(row, env);
    const qualification = await loadLatestPassedPieceQualification(env.DB, row.id);
    const qualificationStatus = recoveryQualificationStatus(qualification, dependencies);
    if (qualificationStatus.status !== 'current') {
      return jsonResponse({
        ok: false,
        error: 'recovery_qualification_required',
        reasons: qualificationStatus.reasons,
      }, 409);
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
        WHERE id = ?2 AND plate_status = 'generated'
          AND backup_status = 'verified'
          AND backup_reference = ?3
          AND backup_sha256 = ?4
          AND ownership_code_key_version = ?5
          AND EXISTS (
            SELECT 1 FROM registry_recovery_qualifications qualification
             WHERE qualification.id = ?6
               AND qualification.keeper_piece_id = keeper_pieces.id
               AND qualification.scope = 'piece'
               AND qualification.result = 'passed'
               AND qualification.copied_artifacts = 1
               AND qualification.schema_version = ?7
               AND qualification.build_version = ?8
               AND qualification.key_version = ?5
               AND qualification.generator_version = ?9
               AND qualification.verifier_version = ?10
               AND qualification.backup_reference = ?3
               AND qualification.backup_sha256 = ?4
          )
          AND record_version = ?11
          AND public_code = ?12
          AND piece_id = ?13
          AND edition_number = ?14
          AND plate_generated_at = ?15
          AND front_svg_sha256 = ?16
          AND back_svg_sha256 = ?17
          AND recovery_code_hash = ?18`,
    ).bind(
      activatedAt,
      row.id,
      dependencies.backupReference,
      dependencies.backupSha256,
      dependencies.keyVersion,
      qualification.id,
      dependencies.schemaVersion,
      dependencies.buildVersion,
      dependencies.generatorVersion,
      dependencies.verifierVersion,
      row.record_version,
      row.public_code,
      row.piece_id,
      row.edition_number,
      row.plate_generated_at,
      row.front_svg_sha256,
      row.back_svg_sha256,
      row.recovery_code_hash,
    );
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
      const currentDependencies = current ? recoveryDependenciesForRow(current, env) : null;
      const currentQualification = current
        ? await loadLatestPassedPieceQualification(env.DB, current.id)
        : null;
      if (
        current?.plate_status === 'active' &&
        plateBackupIsVerified(current) &&
        recoveryQualificationStatus(currentQualification, currentDependencies).status === 'current' &&
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
