import { generatePublicPlateCode } from '../../../utils/artworkPlate.ts';
import {
  decryptOwnershipCode,
  encryptOwnershipCode,
} from '../../../utils/ownershipCodeCrypto.ts';
import { generateRecoveryCode } from '../../../utils/recoveryCode.ts';
import { ownershipAuditStatement } from './admin.js';
import { resolveArtwork } from './artworkCatalog.js';
import { backupArtworkIdentity } from './identityBackup.js';
import { genKeeperPieceId, hashRecoveryCode } from './keeper.js';
import {
  buildLineageEvent,
  lineageAnchorStatement,
  lineageStatement,
} from './lineage.js';
import { registryPlateCryptoConfigured } from './registryPlateIssuance.js';

const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const PUBLIC_CODE_ATTEMPTS = 8;

function registrationError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function validateAuthorization(value) {
  if (!exactKeys(value, ['userId', 'email', 'registryUnlockExpiresAt'])) {
    throw registrationError('invalid_authorization');
  }
  const userId = typeof value.userId === 'string' ? value.userId.trim() : '';
  const email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : '';
  if (!userId || userId.length > 128 || !email || email.length > 254
    || !Number.isSafeInteger(value.registryUnlockExpiresAt)) {
    throw registrationError('invalid_authorization');
  }
  return { ...value, userId, email };
}

async function normalizeInput(env, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw registrationError('invalid_registration');
  }
  const artworkId = typeof input.artworkId === 'string'
    ? input.artworkId.trim().toUpperCase()
    : '';
  const idempotencyKey = typeof input.idempotencyKey === 'string'
    ? input.idempotencyKey.trim()
    : '';
  const registeredAt = typeof input.registeredAt === 'string'
    ? input.registeredAt.trim()
    : '';
  if (!/^[A-Z]{2,3}-[0-9]{3}$/.test(artworkId)) {
    throw registrationError('unknown_artwork');
  }
  if (!idempotencyKey || idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw registrationError('idempotency_key_required');
  }
  if (!registeredAt || !Number.isFinite(Date.parse(registeredAt))) {
    throw registrationError('invalid_registered_at');
  }
  const authorization = validateAuthorization(input.authorization);
  const artwork = await resolveArtwork(env, artworkId);
  if (!artwork) throw registrationError('unknown_artwork');
  if (artwork.editionKind === 'unspecified') {
    throw registrationError('edition_metadata_required');
  }
  const edition = input.edition;
  if (artwork.editionKind === 'unique') {
    if (!exactKeys(edition, ['kind']) || edition.kind !== 'unique') {
      throw registrationError('invalid_edition');
    }
    return {
      artworkId,
      edition: { kind: 'unique', number: null, size: null },
      editionNumber: 0,
      authorization,
      idempotencyKey,
      registeredAt,
    };
  }
  if (!exactKeys(edition, ['kind', 'number', 'size'])
    || edition.kind !== 'numbered'
    || !Number.isSafeInteger(edition.number)
    || edition.number < 1
    || edition.size !== artwork.editionSize
    || edition.number > edition.size) {
    throw registrationError('invalid_edition');
  }
  return {
    artworkId,
    edition: { kind: 'numbered', number: edition.number, size: edition.size },
    editionNumber: edition.number,
    authorization,
    idempotencyKey,
    registeredAt,
  };
}

function identityFromRow(row) {
  return {
    keeperPieceId: row.id,
    publicCode: row.public_code,
    registrationStatus: 'registered',
    backupStatus: row.identity_backup_status,
  };
}

function rowMatches(row, input) {
  return row.piece_id === input.artworkId
    && row.edition_number === input.editionNumber
    && row.registration_status === 'registered';
}

async function replayRegistration(env, row, input) {
  if (!rowMatches(row, input)) throw registrationError('idempotency_conflict');
  const sameAdministrator = row.registered_by_user_id === input.authorization.userId;
  const activeUnlock = input.authorization.registryUnlockExpiresAt > Math.floor(Date.now() / 1000);
  if (!sameAdministrator || !activeUnlock) {
    return {
      ...identityFromRow(row),
      codeAccess: 'audited-reveal-required',
    };
  }
  if (typeof env.DB.batch !== 'function') throw registrationError('atomic_write_unavailable');
  const revealedAt = new Date().toISOString();
  await env.DB.batch([
    ownershipAuditStatement(env, {
      keeperPieceId: row.id,
      action: 'registration_replay_reveal',
      outcome: 'authorized',
      requestId: input.idempotencyKey,
      createdAt: revealedAt,
    }),
  ]);
  const ownershipCode = await decryptOwnershipCode({
    ciphertext: row.ownership_code_ciphertext,
    nonce: row.ownership_code_nonce,
    keyVersion: String(row.ownership_code_key_version),
  }, {
    publicCode: row.public_code,
    pieceId: row.piece_id,
    editionNumber: row.edition_number,
  }, env);
  return {
    ...identityFromRow(row),
    ownershipCode,
    codeAccess: 'active-unlock-replay',
  };
}

async function findByRegistrationKey(env, idempotencyKey) {
  return env.DB.prepare(
    `SELECT id, piece_id, edition_number, public_code, registration_status,
            registered_at,
            registered_by_user_id, identity_backup_status,
            ownership_code_ciphertext, ownership_code_nonce,
            ownership_code_key_version
       FROM keeper_pieces WHERE issuance_key = ?1`,
  ).bind(idempotencyKey).first();
}

async function buildCandidate(env, input) {
  const keeperPieceId = genKeeperPieceId();
  const publicCode = generatePublicPlateCode();
  const ownershipCode = generateRecoveryCode();
  const context = {
    publicCode,
    pieceId: input.artworkId,
    editionNumber: input.editionNumber,
  };
  const [verifier, envelope] = await Promise.all([
    hashRecoveryCode(ownershipCode),
    encryptOwnershipCode(ownershipCode, context, env),
  ]);
  const lineageEvent = await buildLineageEvent({
    keeperPieceId,
    sequence: 1,
    eventType: 'issued',
    eventAt: input.registeredAt,
    previousHash: null,
    publicPayload: {
      pieceId: input.artworkId,
      editionNumber: input.editionNumber,
      publicCode,
    },
  });
  return {
    keeperPieceId,
    publicCode,
    ownershipCode,
    artworkId: input.artworkId,
    edition: input.edition,
    editionNumber: input.editionNumber,
    registeredAt: input.registeredAt,
    verifier,
    envelope,
    lineageEvent,
  };
}

function registrationInsert(env, candidate, input, backup) {
  return env.DB.prepare(
    `INSERT INTO keeper_pieces
       (id, piece_id, edition_number, recovery_code_hash, public_code,
        issuance_key, plate_status, ownership_code_ciphertext,
        ownership_code_nonce, ownership_code_key_version, registered_at,
        registration_status, registered_by_user_id, identity_backup_status,
        identity_backup_reference, identity_backup_sha256, identity_backup_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'legacy', ?7, ?8, ?9, ?10,
             'registered', ?11, 'verified', ?12, ?13, ?14)`,
  ).bind(
    candidate.keeperPieceId,
    candidate.artworkId,
    candidate.editionNumber,
    candidate.verifier,
    candidate.publicCode,
    input.idempotencyKey,
    candidate.envelope.ciphertext,
    candidate.envelope.nonce,
    candidate.envelope.keyVersion,
    candidate.registeredAt,
    input.authorization.userId,
    backup.reference,
    backup.sha256,
    candidate.registeredAt,
  );
}

async function maintenanceStatement(env, candidate, input) {
  const after = JSON.stringify({
    artworkId: candidate.artworkId,
    edition: candidate.edition,
    keeperPieceId: candidate.keeperPieceId,
    publicCode: candidate.publicCode,
    registrationStatus: 'registered',
  });
  const fingerprint = await sha256Hex(JSON.stringify({
    idempotencyKey: input.idempotencyKey,
    artworkId: candidate.artworkId,
    edition: candidate.edition,
    registeredAt: candidate.registeredAt,
  }));
  return env.DB.prepare(
    `INSERT INTO registry_maintenance_events
       (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
        administrator_user_id, administrator_email, reason, before_json,
        after_json, outcome, related_record_id, mutation_fingerprint, created_at)
     VALUES (?1, ?2, 'artwork_registered', ?3, ?4, ?5, ?6, ?7, '{}',
             ?8, 'succeeded', ?3, ?9, ?10)`,
  ).bind(
    crypto.randomUUID(),
    input.idempotencyKey,
    candidate.keeperPieceId,
    candidate.artworkId,
    input.authorization.userId,
    input.authorization.email,
    'Register permanent artwork identity.',
    after,
    fingerprint,
    candidate.registeredAt,
  );
}

export async function registerArtwork(env, rawInput) {
  if (!env?.DB || typeof env.DB.batch !== 'function') {
    throw registrationError('atomic_write_unavailable');
  }
  if (!registryPlateCryptoConfigured(env)) {
    throw registrationError('ownership_code_crypto_not_configured');
  }
  const input = await normalizeInput(env, rawInput);
  const replay = await findByRegistrationKey(env, input.idempotencyKey);
  if (replay) return replayRegistration(env, replay, input);
  if (input.authorization.registryUnlockExpiresAt <= Math.floor(Date.now() / 1000)) {
    throw registrationError('registry_unlock_required');
  }

  for (let attempt = 0; attempt < PUBLIC_CODE_ATTEMPTS; attempt += 1) {
    const candidate = await buildCandidate(env, input);
    const backup = await backupArtworkIdentity(env.ARTWORK_REGISTRY_BACKUP, candidate);
    if (backup.status !== 'verified') throw registrationError('identity_backup_failed');
    try {
      await env.DB.batch([
        registrationInsert(env, candidate, input, backup),
        lineageStatement(env, candidate.lineageEvent, { onlyIfPreviousChanged: true }),
        lineageAnchorStatement(env, candidate.lineageEvent, { onlyIfPreviousChanged: true }),
        await maintenanceStatement(env, candidate, input),
      ]);
    } catch (error) {
      const message = String(error?.message || '');
      if (/public_code/i.test(message) && /unique/i.test(message)) continue;
      if (/unique/i.test(message)) {
        const concurrent = await findByRegistrationKey(env, input.idempotencyKey);
        if (concurrent) return replayRegistration(env, concurrent, input);
        throw registrationError('registration_conflict');
      }
      throw error;
    }
    return {
      keeperPieceId: candidate.keeperPieceId,
      publicCode: candidate.publicCode,
      ownershipCode: candidate.ownershipCode,
      codeAccess: 'created',
      registrationStatus: 'registered',
      backupStatus: 'verified',
    };
  }
  throw registrationError('public_code_collision');
}
