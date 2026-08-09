import { constantTimeEqual } from './admin.js';
import { hashRecoveryCode } from './keeper.js';
import {
  claimEvidenceStatement,
  prepareNextLineageEvent,
} from './lineage.js';
import { plateBackupIsVerified } from './plateBackup.js';
import {
  identityRecoveryDependenciesForRow,
  identityRecoveryQualificationStatus,
  loadLatestPassedIdentityQualification,
  loadLatestPassedPieceQualification,
  recoveryDependenciesForRow,
  recoveryQualificationStatus,
} from './recoveryQualification.js';

function claimError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

async function verifyProof(piece, proof) {
  if (!proof || typeof proof !== 'object') throw claimError('claim_proof_required');
  if (proof.kind === 'ownership_code') {
    const reference = typeof proof.reference === 'string' ? proof.reference : '';
    if (!reference) throw claimError('claim_proof_required');
    const verifier = await hashRecoveryCode(reference);
    if (!constantTimeEqual(verifier, piece.recovery_code_hash)) {
      throw claimError('code_mismatch');
    }
    return;
  }
  if (proof.kind === 'invitation') {
    if (typeof proof.reference !== 'string' || !proof.reference) {
      throw claimError('claim_proof_required');
    }
    if (piece.invitation_proof_verified !== true) {
      throw claimError('invitation_not_verified');
    }
    return;
  }
  throw claimError('unsupported_claim_proof');
}

async function registeredIdentityGuard(env, piece) {
  if (piece.registration_status !== 'registered'
    || piece.identity_backup_status !== 'verified') {
    throw claimError('identity_not_ready');
  }
  const dependencies = identityRecoveryDependenciesForRow(piece, env);
  const qualification = await loadLatestPassedIdentityQualification(env.DB, piece.id);
  if (identityRecoveryQualificationStatus(qualification, dependencies).status !== 'current') {
    throw claimError('identity_recovery_not_qualified');
  }
  return {
    sql: `registration_status = 'registered'
      AND identity_backup_status = 'verified'
      AND identity_backup_reference = ?4
      AND identity_backup_sha256 = ?5
      AND ownership_code_key_version = ?9
      AND EXISTS (
        SELECT 1 FROM artwork_identity_recovery_qualifications qualification
         WHERE qualification.id = ?6
           AND qualification.keeper_piece_id = keeper_pieces.id
           AND qualification.result = 'passed'
           AND qualification.copied_artifact = 1
           AND qualification.schema_version = ?7
           AND qualification.build_version = ?8
           AND qualification.key_version = ?9
           AND qualification.verifier_version = ?10
           AND qualification.backup_reference = ?4
           AND qualification.backup_sha256 = ?5
      )`,
    values: [
      piece.identity_backup_reference,
      piece.identity_backup_sha256,
      qualification.id,
      dependencies.schemaVersion,
      dependencies.buildVersion,
      dependencies.keyVersion,
      dependencies.verifierVersion,
    ],
  };
}

async function physicalPlateGuard(env, piece) {
  if (piece.plate_status !== 'active' || !plateBackupIsVerified(piece)) {
    throw claimError('plate_not_ready');
  }
  const dependencies = recoveryDependenciesForRow(piece, env);
  const qualification = await loadLatestPassedPieceQualification(env.DB, piece.id);
  if (recoveryQualificationStatus(qualification, dependencies).status !== 'current') {
    throw claimError('plate_recovery_not_qualified');
  }
  return {
    sql: `plate_status = 'active' AND backup_status = 'verified'
      AND backup_reference = ?4 AND backup_sha256 = ?5
      AND ownership_code_key_version = ?9
      AND EXISTS (
        SELECT 1 FROM registry_recovery_qualifications qualification
         WHERE qualification.id = ?6
           AND qualification.keeper_piece_id = keeper_pieces.id
           AND qualification.scope = 'piece'
           AND qualification.result = 'passed'
           AND qualification.copied_artifacts = 1
           AND qualification.schema_version = ?7
           AND qualification.build_version = ?8
           AND qualification.key_version = ?9
           AND qualification.generator_version = ?10
           AND qualification.verifier_version = ?11
           AND qualification.backup_reference = ?4
           AND qualification.backup_sha256 = ?5
      )`,
    values: [
      piece.backup_reference,
      piece.backup_sha256,
      qualification.id,
      dependencies.schemaVersion,
      dependencies.buildVersion,
      dependencies.keyVersion,
      dependencies.generatorVersion,
      dependencies.verifierVersion,
    ],
  };
}

async function readinessGuard(env, piece) {
  if (piece.registration_status === 'registered'
    && piece.identity_backup_status === 'verified') {
    return registeredIdentityGuard(env, piece);
  }
  if (piece.public_code == null) return { sql: 'public_code IS NULL', values: [] };
  return physicalPlateGuard(env, piece);
}

export async function prepareFirstKeeperBind(env, {
  piece,
  claimant,
  proof,
  evidence,
  boundAt,
}) {
  if (!piece?.id || piece.keeper_user_id || piece.claimed_at || piece.released_at) {
    throw claimError('first_bind_unavailable');
  }
  const userId = typeof claimant?.userId === 'string' ? claimant.userId.trim() : '';
  const verifiedEmail = typeof claimant?.verifiedEmail === 'string'
    ? claimant.verifiedEmail.trim()
    : '';
  if (!userId || !verifiedEmail) throw claimError('verified_claimant_required');
  if (typeof boundAt !== 'string' || !Number.isFinite(Date.parse(boundAt))) {
    throw claimError('invalid_bound_at');
  }
  await verifyProof(piece, proof);
  const guard = await readinessGuard(env, piece);
  const lineage = await prepareNextLineageEvent(env, {
    keeperPieceId: piece.id,
    eventType: 'first_bound',
    eventAt: boundAt,
    publicPayload: {},
    onlyIfPreviousChanged: true,
  });

  const guardValues = guard.values;
  const keeperMutation = env.DB.prepare(
    `UPDATE keeper_pieces
        SET keeper_user_id = ?1, claimed_at = ?2, released_at = NULL
      WHERE id = ?3
        AND keeper_user_id IS NULL AND claimed_at IS NULL AND released_at IS NULL
        AND (${guard.sql})`,
  ).bind(userId, boundAt, piece.id, ...guardValues);
  const claimEvidence = claimEvidenceStatement(env, {
    keeperPieceId: piece.id,
    actorUserId: userId,
    verifiedEmail,
    ipAddress: evidence?.ipAddress ?? null,
    userAgent: evidence?.userAgent ?? null,
    outcome: 'first_bound',
    createdAt: boundAt,
    requireKeeperUserId: userId,
    requireClaimedAt: boundAt,
  });
  return {
    statements: [
      keeperMutation,
      lineage.statement,
      lineage.anchorStatement,
      claimEvidence,
    ],
    result: {
      keeper: {
        pieceId: piece.piece_id,
        editionNumber: piece.edition_number,
        claimedAt: boundAt,
      },
    },
  };
}
