import { generatePublicPlateCode } from '../../../utils/artworkPlate.ts';
import {
  decryptOwnershipCode,
  encryptOwnershipCode,
} from '../../../utils/ownershipCodeCrypto.ts';
import { generateRecoveryCode } from '../../../utils/recoveryCode.ts';
import { ownershipAuditStatement } from './admin.js';
import {
  ARTWORK_ID_PATTERN,
  DRAFT_EDITION_MAX,
  DRAFT_SERIES_MAX,
  DRAFT_TITLE_MAX,
  findStaticArtwork,
  resolveArtwork,
} from './artworkCatalog.js';
import { ensureCatalogSnapshot } from './catalogSnapshot.js';
import { backupArtworkIdentity } from './identityBackup.js';
import {
  genKeeperPieceId,
  hashRecoveryCode,
  isMissingTableError,
  legacyEnabled,
} from './keeper.js';
import { publishPieceRecord } from './pieceRecord.js';
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

/** Read one registered identity and its caretaker/activity projection without mutation. */
export async function readRegisteredArtworkIdentity(env, keeperPieceId) {
  if (!keeperPieceId) return null;
  const row = await env.DB.prepare(`
    SELECT id, piece_id, edition_number, keeper_user_id, registered_at, claimed_at, released_at,
           public_code, plate_status, backup_status, backup_reference, backup_sha256,
           ownership_code_key_version, front_svg_sha256, back_svg_sha256,
           identity_backup_status, identity_backup_reference, identity_backup_sha256,
           registration_status, plate_generated_at, plate_activated_at
      FROM keeper_pieces WHERE id = ?1
  `).bind(keeperPieceId).first();
  if (!row) return null;
  let caretaker;
  if (row.keeper_user_id && row.claimed_at && row.released_at === null) caretaker = 'active';
  else if (!row.keeper_user_id && !row.claimed_at && row.released_at === null) caretaker = 'unclaimed';
  else if (!row.keeper_user_id && row.claimed_at && row.released_at) caretaker = 'released';
  else throw registrationError('workspace_data_corrupt');
  return {
    row,
    caretaker,
    activity: [
      ['identity_registered', row.registered_at, 'Permanent identity registered'],
      ['caretaker_claimed', row.claimed_at, 'Caretaker connected'],
      ['caretaker_released', row.released_at, 'Caretaker released'],
      ['plate_generated', row.plate_generated_at, 'Plate generated'],
      ['plate_activated', row.plate_activated_at, 'Plate activated'],
    ],
  };
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

/* ── Unified register-an-artwork operation ─────────────────────────────
 *
 * One idempotent operation behind POST /api/admin/register-artwork:
 * accept EITHER an existing catalog/draft artwork id OR a brand-new
 * registry-only artwork typed inline, ensure the registry_artworks row an
 * inline artwork (or a static piece without edition metadata) needs, take
 * an append-only catalog snapshot, run the existing registration
 * transaction unchanged in its guarantees, then generate the first Piece
 * Record FAIL-SOFT: a record failure never fails the registration.
 * The old /api/admin/registrations path is untouched.
 */

function normalizeUnifiedSelector(input) {
  const hasArtworkId = input.artworkId !== undefined;
  const hasNewArtwork = input.newArtwork !== undefined;
  if (hasArtworkId === hasNewArtwork) throw registrationError('invalid_registration');
  if (hasArtworkId) {
    const artworkId = typeof input.artworkId === 'string'
      ? input.artworkId.trim().toUpperCase()
      : '';
    if (!ARTWORK_ID_PATTERN.test(artworkId)) throw registrationError('unknown_artwork');
    return { kind: 'existing', artworkId };
  }
  const raw = input.newArtwork;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw registrationError('invalid_new_artwork');
  }
  if (!Object.keys(raw).every((key) => ['id', 'title', 'series'].includes(key))) {
    throw registrationError('invalid_new_artwork');
  }
  const artworkId = typeof raw.id === 'string' ? raw.id.trim().toUpperCase() : '';
  if (!ARTWORK_ID_PATTERN.test(artworkId)) throw registrationError('invalid_new_artwork');
  // AR- is reserved for issued public codes; artwork ids stay out of it.
  if (artworkId.startsWith('AR-')) throw registrationError('reserved_artwork_id');
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title || title.length > DRAFT_TITLE_MAX) throw registrationError('invalid_new_artwork');
  const series = typeof raw.series === 'string' && raw.series.trim()
    ? raw.series.trim().slice(0, DRAFT_SERIES_MAX)
    : null;
  return { kind: 'new', artworkId, title, series };
}

function normalizeUnifiedEdition(edition) {
  if (!edition || typeof edition !== 'object' || Array.isArray(edition)) {
    throw registrationError('invalid_edition');
  }
  if (edition.kind === 'unique') {
    if (!Object.keys(edition).every((key) => key === 'kind')) {
      throw registrationError('invalid_edition');
    }
    return { kind: 'unique', number: null, size: null };
  }
  if (edition.kind !== 'numbered') throw registrationError('invalid_edition');
  if (!Object.keys(edition).every((key) => ['kind', 'number', 'size'].includes(key))) {
    throw registrationError('invalid_edition');
  }
  if (!Number.isSafeInteger(edition.number)
    || edition.number < 1
    || edition.number > DRAFT_EDITION_MAX) {
    throw registrationError('invalid_edition');
  }
  const size = edition.size === undefined || edition.size === null ? null : edition.size;
  if (size !== null && (
    !Number.isSafeInteger(size) || size < edition.number || size > DRAFT_EDITION_MAX
  )) {
    throw registrationError('invalid_edition');
  }
  return { kind: 'numbered', number: edition.number, size };
}

async function findDraftRow(env, artworkId) {
  try {
    return await env.DB
      .prepare('SELECT id, title, series, edition_size FROM registry_artworks WHERE id = ?1')
      .bind(artworkId)
      .first();
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

async function issuedEditionShape(env, artworkId) {
  const row = await env.DB.prepare(
    `SELECT
       MAX(CASE WHEN edition_number = 0 THEN 1 ELSE 0 END) AS has_unique,
       MAX(CASE WHEN edition_number > 0 THEN edition_number ELSE NULL END) AS highest_numbered
     FROM keeper_pieces WHERE piece_id = ?1`,
  ).bind(artworkId).first();
  return {
    hasUnique: Number(row?.has_unique) === 1,
    highestNumbered: row?.highest_numbered == null ? null : Number(row.highest_numbered),
  };
}

function ensureDraftStatement(env, { artworkId, title, series, editionSize, createdAt }) {
  return env.DB.prepare(
    `INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5
      WHERE NOT EXISTS (SELECT 1 FROM registry_artworks WHERE id = ?1)`,
  ).bind(artworkId, title, series, editionSize, createdAt);
}

async function existingRegistrationRecord(env, publicCode) {
  try {
    return await env.DB.prepare(
      `SELECT record_hash FROM piece_records
        WHERE public_code = ?1 AND trigger_event = 'registration'
        ORDER BY created_at ASC, id ASC LIMIT 1`,
    ).bind(publicCode).first();
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

/**
 * Generate and store the first Piece Record for a freshly registered (or
 * replayed) identity. FAIL-SOFT by contract: any failure is reported as
 * { status: 'deferred', reason } and never thrown, because the admin
 * records rebuild endpoint is the recovery path.
 */
async function publishRegistrationRecord(env, publicCode, generatedAt) {
  try {
    const already = await existingRegistrationRecord(env, publicCode);
    if (already) return { status: 'generated', recordHash: already.record_hash };
    const published = await publishPieceRecord(env, {
      publicCode,
      trigger: 'registration',
      generatedAt,
      // The same launch condition the public lineage endpoint enforces:
      // livingLegacy-gated sections stay out of records generated before
      // the flag is on.
      includeLegacySections: legacyEnabled(),
    });
    if (published.status === 'verified') {
      return { status: 'generated', recordHash: published.recordHash };
    }
    return { status: 'deferred', reason: 'record_write_failed' };
  } catch (error) {
    return {
      status: 'deferred',
      reason: typeof error?.code === 'string' ? error.code : 'record_generation_failed',
    };
  }
}

/**
 * The unified register-an-artwork operation. Input:
 *   { artworkId } XOR { newArtwork: { id, title, series? } },
 *   edition: { kind: 'unique' } | { kind: 'numbered', number, size? },
 *   authorization, idempotencyKey, registeredAt.
 *
 * Returns the existing registration result shape plus:
 *   artwork: { id, title, series },
 *   record: { status: 'generated' | 'deferred', reason? }.
 */
export async function registerArtworkWithRecord(env, rawInput) {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    throw registrationError('invalid_registration');
  }
  const selector = normalizeUnifiedSelector(rawInput);
  const edition = normalizeUnifiedEdition(rawInput.edition);
  const idempotencyKey = typeof rawInput.idempotencyKey === 'string'
    ? rawInput.idempotencyKey.trim()
    : '';
  if (!idempotencyKey || idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw registrationError('idempotency_key_required');
  }
  const registeredAt = typeof rawInput.registeredAt === 'string'
    ? rawInput.registeredAt.trim()
    : '';
  if (!registeredAt || !Number.isFinite(Date.parse(registeredAt))) {
    throw registrationError('invalid_registered_at');
  }

  const replayRow = await findByRegistrationKey(env, idempotencyKey);
  if (replayRow && replayRow.piece_id !== selector.artworkId) {
    throw registrationError('idempotency_conflict');
  }
  const replaying = Boolean(replayRow);

  const staticArtwork = findStaticArtwork(selector.artworkId);
  let draft = await findDraftRow(env, selector.artworkId);
  // resolveArtwork can throw artwork_edition_metadata_conflict; let it travel.
  const resolved = await resolveArtwork(env, selector.artworkId);

  if (!replaying) {
    if (selector.kind === 'new') {
      if (staticArtwork) throw registrationError('artwork_id_taken');
      if (draft) {
        // A draft with this id is only acceptable when it is exactly the
        // draft THIS registration would have created, so a retry after a
        // partial failure works and a genuine collision is refused.
        const sameDraft = draft.title === selector.title
          && (draft.series || null) === selector.series
          && (draft.edition_size == null ? null : Number(draft.edition_size))
            === (edition.kind === 'numbered' ? edition.size : null);
        if (!sameDraft) throw registrationError('artwork_id_taken');
      }
    } else if (!staticArtwork && !draft) {
      throw registrationError('unknown_artwork');
    }
  }

  // Settle the edition against what the catalog already fixes.
  let finalEdition = edition;
  const resolvedKind = resolved ? resolved.editionKind : null;
  if (resolvedKind === 'unique' && edition.kind !== 'unique') {
    throw registrationError('edition_conflict');
  }
  if (resolvedKind === 'numbered') {
    if (edition.kind !== 'numbered') throw registrationError('edition_conflict');
    if (edition.size === null) {
      finalEdition = { ...edition, size: resolved.editionSize };
    } else if (edition.size !== resolved.editionSize) {
      throw registrationError('edition_conflict');
    }
    if (finalEdition.number > finalEdition.size) throw registrationError('invalid_edition');
  }

  // A brand-new artwork, or a static piece with no edition metadata yet,
  // needs a registry_artworks row so the edition is fixed before minting.
  const needsDraftRow = !replaying
    && (resolvedKind === null || resolvedKind === 'unspecified')
    && !draft;
  if (needsDraftRow) {
    if (finalEdition.kind === 'numbered' && finalEdition.size === null) {
      throw registrationError('edition_size_required');
    }
    const issued = await issuedEditionShape(env, selector.artworkId);
    if (finalEdition.kind === 'unique' && issued.highestNumbered !== null) {
      throw registrationError('edition_conflict');
    }
    if (finalEdition.kind === 'numbered') {
      if (issued.hasUnique) throw registrationError('edition_conflict');
      if (issued.highestNumbered !== null && finalEdition.size < issued.highestNumbered) {
        throw registrationError('edition_size_below_issued');
      }
    }
    await ensureDraftStatement(env, {
      artworkId: selector.artworkId,
      title: staticArtwork ? staticArtwork.title : selector.title,
      series: staticArtwork ? (staticArtwork.series || null) : selector.series,
      editionSize: finalEdition.kind === 'numbered' ? finalEdition.size : null,
      createdAt: registeredAt,
    }).run();
    draft = await findDraftRow(env, selector.artworkId);
  }

  const artworkInfo = staticArtwork
    ? {
        id: selector.artworkId,
        title: staticArtwork.title,
        series: staticArtwork.series || null,
      }
    : {
        id: selector.artworkId,
        title: draft?.title ?? (selector.kind === 'new' ? selector.title : selector.artworkId),
        series: (draft?.series ?? (selector.kind === 'new' ? selector.series : null)) || null,
      };

  // Append-only catalog snapshot: full static catalog data when the artwork
  // came from FULL_ARCHIVE, otherwise the typed registry fields.
  const snapshotArtwork = staticArtwork
    ? {
        ...staticArtwork,
        editionKind: finalEdition.kind,
        editionSize: finalEdition.kind === 'numbered' ? finalEdition.size : null,
      }
    : {
        id: artworkInfo.id,
        title: artworkInfo.title,
        series: artworkInfo.series,
        editionKind: finalEdition.kind,
        editionSize: finalEdition.kind === 'numbered' ? finalEdition.size : null,
      };
  await ensureCatalogSnapshot(env, snapshotArtwork, {
    source: staticArtwork ? 'mockData' : 'admin',
    createdAt: registeredAt,
  });

  // The existing registration transaction, unchanged in its guarantees:
  // identity backup fail-hard, atomic D1 batch, idempotent replay.
  const registration = await registerArtwork(env, {
    artworkId: selector.artworkId,
    edition: finalEdition.kind === 'unique'
      ? { kind: 'unique' }
      : { kind: 'numbered', number: finalEdition.number, size: finalEdition.size },
    authorization: rawInput.authorization,
    idempotencyKey,
    registeredAt,
  });

  const record = await publishRegistrationRecord(env, registration.publicCode, registeredAt);

  return { ...registration, artwork: artworkInfo, record };
}
