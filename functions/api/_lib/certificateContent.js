import { resolveArtwork } from './artworkCatalog.js';

const FIELDS = [
  'materials', 'makers', 'origin', 'techniques', 'yearWording',
  'editionWording', 'certificateWording', 'openingWording',
];
const ARRAY_FIELDS = new Set(['materials', 'techniques']);
const TEXT_FIELDS = new Set([
  'origin', 'yearWording', 'editionWording', 'certificateWording', 'openingWording',
]);

function codedError(code) {
  return Object.assign(new Error(code), { code });
}

function dbFor(env) {
  if (!env?.DB) throw codedError('db_not_configured');
  return env.DB;
}

async function first(db, sql, ...values) {
  return db.prepare(sql).bind(...values).first();
}

async function all(db, sql, ...values) {
  const result = await db.prepare(sql).bind(...values).all();
  return result?.results ?? [];
}

function statement(db, sql, ...values) {
  return db.prepare(sql).bind(...values);
}

function requiredText(value, code, maximum = 5000) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maximum) throw codedError(code);
  return normalized;
}

function publicLedgerId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
}

function exactClaimedIdentity(row, expected = {}) {
  if (!row || row.identification_status !== 'identity_linked'
    || row.artwork_record_id == null || row.artwork_id !== row.piece_id
    || row.keeper_piece_id !== row.piece_keeper_id
    || row.registration_status !== 'registered'
    || typeof row.public_code !== 'string' || !/^AR-[A-Z0-9]{8}$/.test(row.public_code)
    || typeof row.keeper_user_id !== 'string' || !row.keeper_user_id
    || typeof row.claimed_at !== 'string' || !row.claimed_at
    || row.released_at !== null
    || !['legacy', 'generated', 'active'].includes(row.plate_status)) return false;
  if (expected.keeperPieceId && row.keeper_piece_id !== expected.keeperPieceId) return false;
  if (expected.publicCode && row.public_code !== expected.publicCode) return false;
  if (expected.userId && row.keeper_user_id !== expected.userId) return false;
  try {
    const edition = JSON.parse(row.edition_json);
    return edition && typeof edition === 'object' && !Array.isArray(edition)
      && ((edition.kind === 'unique' && row.edition_number === 0)
        || (edition.kind === 'numbered' && edition.number === row.edition_number));
  } catch { return false; }
}

function normalizeStringList(value, code) {
  if (!Array.isArray(value)) throw codedError(code);
  const normalized = value.map((item) => requiredText(item, code, 240));
  return [...new Set(normalized)];
}

function normalizeMakers(value) {
  if (!Array.isArray(value)) throw codedError('invalid_certificate_value');
  return value.map((maker) => {
    if (!maker || typeof maker !== 'object' || Array.isArray(maker)) {
      throw codedError('invalid_certificate_value');
    }
    const keys = Object.keys(maker).sort();
    if (keys.join('\0') !== ['name', 'role'].join('\0')) {
      throw codedError('invalid_certificate_value');
    }
    return {
      name: requiredText(maker.name, 'invalid_certificate_value', 160),
      role: requiredText(maker.role, 'invalid_certificate_value', 160),
    };
  });
}

function normalizeFieldValue(field, value) {
  if (ARRAY_FIELDS.has(field)) return normalizeStringList(value, 'invalid_certificate_value');
  if (field === 'makers') return normalizeMakers(value);
  if (TEXT_FIELDS.has(field)) return requiredText(value, 'invalid_certificate_value');
  throw codedError('invalid_certificate_field');
}

export function normalizeCertificateContent(content) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    throw codedError('invalid_certificate_content');
  }
  const unknown = Object.keys(content).filter((field) => !FIELDS.includes(field));
  if (unknown.length) throw codedError('invalid_certificate_field');
  const normalized = {};
  for (const field of FIELDS) {
    if (content[field] === undefined || content[field] === null || content[field] === '') continue;
    const value = normalizeFieldValue(field, content[field]);
    if (Array.isArray(value) && value.length === 0) continue;
    normalized[field] = value;
  }
  return normalized;
}

function normalizeAdministrator(value) {
  return {
    userId: requiredText(value?.userId, 'invalid_administrator', 128),
    email: requiredText(value?.email, 'invalid_administrator', 254).toLowerCase(),
  };
}

function normalizeTimestamp(value) {
  const normalized = requiredText(value, 'invalid_timestamp', 40);
  if (Number.isNaN(Date.parse(normalized))) throw codedError('invalid_timestamp');
  return normalized;
}

async function sha256(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createCertificateTemplate(env, input) {
  const db = dbFor(env);
  const name = requiredText(input?.name, 'invalid_template', 120);
  const content = normalizeCertificateContent(input?.content);
  const administrator = normalizeAdministrator(input?.administrator);
  const createdAt = normalizeTimestamp(input?.createdAt);
  const templateId = typeof input?.templateId === 'string' && input.templateId.trim()
    ? input.templateId.trim()
    : `ct-${crypto.randomUUID()}`;
  await statement(db, `
    INSERT INTO certificate_templates
      (id, name, content_json, version, created_by_user_id, created_by_email, created_at, updated_at)
    VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?6)
  `, templateId, name, JSON.stringify(content), administrator.userId, administrator.email, createdAt).run();
  return { templateId, name, content, version: 1 };
}

export async function listCertificateTemplates(env) {
  const rows = await all(dbFor(env), `
    SELECT id, name, content_json, version, updated_at
      FROM certificate_templates
     ORDER BY lower(name), id
  `);
  return rows.map((row) => ({
    templateId: row.id,
    name: row.name,
    content: normalizeCertificateContent(JSON.parse(row.content_json)),
    version: Number(row.version),
    updatedAt: row.updated_at,
  }));
}

function normalizeArtworkIds(value) {
  if (!Array.isArray(value) || value.length === 0) throw codedError('artwork_ids_required');
  const ids = [...new Set(value.map((id) => requiredText(id, 'invalid_artwork_id', 80)))].sort();
  if (ids.length > 500) throw codedError('too_many_artworks');
  return ids;
}

export async function assignCertificateTemplate(env, input) {
  const db = dbFor(env);
  const templateId = requiredText(input?.templateId, 'invalid_template', 128);
  const artworkIds = normalizeArtworkIds(input?.artworkIds);
  const idempotencyKey = requiredText(input?.idempotencyKey, 'idempotency_key_required', 128);
  const administrator = normalizeAdministrator(input?.administrator);
  const assignedAt = normalizeTimestamp(input?.assignedAt);
  const digest = await sha256(JSON.stringify({
    templateId, artworkIds, administratorUserId: administrator.userId,
  }));

  const replay = await first(db, `
    SELECT request_digest, template_id, artwork_ids_json, assigned_at
      FROM certificate_assignment_operations WHERE idempotency_key = ?1
  `, idempotencyKey);
  if (replay) {
    if (replay.request_digest !== digest) throw codedError('idempotency_conflict');
    return {
      templateId: replay.template_id,
      artworkIds: JSON.parse(replay.artwork_ids_json),
      assignedAt: replay.assigned_at,
    };
  }
  if (!await first(db, 'SELECT id FROM certificate_templates WHERE id = ?1', templateId)) {
    throw codedError('unknown_template');
  }
  const known = await Promise.all(artworkIds.map((artworkId) => resolveArtwork(env, artworkId)));
  if (known.some((artwork) => !artwork)) throw codedError('unknown_artwork');

  const statements = [statement(db, `
    INSERT INTO certificate_assignment_operations
      (idempotency_key, request_digest, template_id, artwork_ids_json,
       assigned_by_user_id, assigned_by_email, assigned_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
  `, idempotencyKey, digest, templateId, JSON.stringify(artworkIds),
  administrator.userId, administrator.email, assignedAt)];
  for (const artworkId of artworkIds) {
    statements.push(statement(db, `
      INSERT INTO certificate_artwork_assignments
        (artwork_id, template_id, assignment_operation_key, version, assigned_at)
      VALUES (?1, ?2, ?3, 1, ?4)
      ON CONFLICT(artwork_id) DO UPDATE SET
        template_id = excluded.template_id,
        assignment_operation_key = excluded.assignment_operation_key,
        version = certificate_artwork_assignments.version + 1,
        assigned_at = excluded.assigned_at
    `, artworkId, templateId, idempotencyKey, assignedAt));
  }
  try {
    await db.batch(statements);
  } catch (error) {
    const raced = await first(db, `
      SELECT request_digest, template_id, artwork_ids_json, assigned_at
        FROM certificate_assignment_operations WHERE idempotency_key = ?1
    `, idempotencyKey);
    if (raced?.request_digest === digest) {
      return {
        templateId: raced.template_id, artworkIds: JSON.parse(raced.artwork_ids_json),
        assignedAt: raced.assigned_at,
      };
    }
    if (raced) throw codedError('idempotency_conflict');
    throw error;
  }
  return { templateId, artworkIds, assignedAt };
}

function normalizeOverride(field, override) {
  if (!FIELDS.includes(field)) throw codedError('invalid_certificate_field');
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    throw codedError('invalid_certificate_override');
  }
  if (override.mode === 'inherit' || override.mode === 'suppress') {
    if (Object.keys(override).length !== 1) throw codedError('invalid_certificate_override');
    return { mode: override.mode, value: undefined };
  }
  if (override.mode === 'override' && Object.keys(override).sort().join('\0') === 'mode\0value') {
    const value = normalizeFieldValue(field, override.value);
    if (Array.isArray(value) && value.length === 0) {
      throw codedError('invalid_certificate_value');
    }
    return { mode: 'override', value };
  }
  throw codedError('invalid_certificate_override');
}

export async function setCertificateOverride(env, input) {
  const db = dbFor(env);
  const artworkId = requiredText(input?.artworkId, 'invalid_artwork_id', 80);
  const field = requiredText(input?.field, 'invalid_certificate_field', 40);
  const override = normalizeOverride(field, input?.override);
  const expectedVersion = input?.expectedVersion;
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    throw codedError('invalid_version');
  }
  const administrator = normalizeAdministrator(input?.administrator);
  const updatedAt = normalizeTimestamp(input?.updatedAt);
  if (!await resolveArtwork(env, artworkId)) {
    throw codedError('unknown_artwork');
  }
  const current = await first(db, `
    SELECT mode, value_json, version
      FROM certificate_artwork_overrides WHERE artwork_id = ?1 AND field = ?2
  `, artworkId, field);
  const currentVersion = Number(current?.version ?? 0);
  if (currentVersion !== expectedVersion) throw codedError('version_conflict');
  const nextVersion = currentVersion + 1;
  const valueJson = override.mode === 'override' ? JSON.stringify(override.value) : null;
  const mutation = current
    ? statement(db, `
      UPDATE certificate_artwork_overrides
         SET mode = ?3, value_json = ?4, version = ?5,
             updated_by_user_id = ?6, updated_by_email = ?7, updated_at = ?8
       WHERE artwork_id = ?1 AND field = ?2 AND version = ?9
    `, artworkId, field, override.mode, valueJson, nextVersion,
    administrator.userId, administrator.email, updatedAt, expectedVersion)
    : statement(db, `
      INSERT INTO certificate_artwork_overrides
        (artwork_id, field, mode, value_json, version,
         updated_by_user_id, updated_by_email, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `, artworkId, field, override.mode, valueJson, nextVersion,
    administrator.userId, administrator.email, updatedAt);
  try {
    const results = await db.batch([mutation]);
    if (current && Number(results?.[0]?.meta?.changes ?? 0) !== 1) {
      throw codedError('version_conflict');
    }
  } catch (error) {
    if (error?.code === 'version_conflict') throw error;
    const latest = await first(db, `
      SELECT version FROM certificate_artwork_overrides WHERE artwork_id = ?1 AND field = ?2
    `, artworkId, field);
    if (Number(latest?.version ?? 0) !== expectedVersion) throw codedError('version_conflict');
    throw error;
  }
  return { artworkId, field, ...override, version: nextVersion };
}

function parseContent(value) {
  if (typeof value !== 'string') return {};
  try { return normalizeCertificateContent(JSON.parse(value)); } catch { return {}; }
}

export async function resolveArtworkCertificate(env, artworkId) {
  const db = dbFor(env);
  const normalizedArtworkId = requiredText(artworkId, 'invalid_artwork_id', 80);
  if (!await resolveArtwork(env, normalizedArtworkId)) {
    throw codedError('certificate_not_found');
  }
  const assignment = await first(db, `
    SELECT template.content_json
      FROM certificate_artwork_assignments assignment
      JOIN certificate_templates template ON template.id = assignment.template_id
     WHERE assignment.artwork_id = ?1
  `, normalizedArtworkId);
  const effective = parseContent(assignment?.content_json);
  const overrides = await all(db, `
    SELECT field, mode, value_json
      FROM certificate_artwork_overrides
     WHERE artwork_id = ?1
  `, normalizedArtworkId);
  for (const row of overrides) {
    if (!FIELDS.includes(row.field)) continue;
    if (row.mode === 'inherit') continue;
    if (row.mode === 'suppress') delete effective[row.field];
    if (row.mode === 'override') {
      try {
        const value = normalizeFieldValue(row.field, JSON.parse(row.value_json));
        if (Array.isArray(value) && value.length === 0) delete effective[row.field];
        else effective[row.field] = value;
      } catch { /* omit corrupt private data */ }
    }
  }
  return effective;
}

export async function getCertificateArtworkEditorState(env, artworkId) {
  const db = dbFor(env);
  const normalizedArtworkId = requiredText(artworkId, 'invalid_artwork_id', 80);
  if (!await resolveArtwork(env, normalizedArtworkId)) {
    throw codedError('unknown_artwork');
  }
  const assignment = await first(db, `
    SELECT template_id, version
      FROM certificate_artwork_assignments
     WHERE artwork_id = ?1
  `, normalizedArtworkId);
  const rows = await all(db, `
    SELECT field, mode, value_json, version
      FROM certificate_artwork_overrides
     WHERE artwork_id = ?1
     ORDER BY field
  `, normalizedArtworkId);
  const overrides = {};
  for (const row of rows) {
    if (!FIELDS.includes(row.field) || !['inherit', 'override', 'suppress'].includes(row.mode)) {
      continue;
    }
    const version = Number(row.version);
    if (!Number.isSafeInteger(version) || version < 1) continue;
    if (row.mode === 'inherit' || row.mode === 'suppress') {
      overrides[row.field] = { mode: row.mode, version };
      continue;
    }
    try {
      const value = normalizeFieldValue(row.field, JSON.parse(row.value_json));
      if (Array.isArray(value) && value.length === 0) continue;
      overrides[row.field] = { mode: 'override', value, version };
    } catch { /* omit corrupt private editor state */ }
  }
  return {
    artworkId: normalizedArtworkId,
    assignment: assignment
      ? { templateId: assignment.template_id, version: Number(assignment.version) }
      : null,
    overrides,
    effective: await resolveArtworkCertificate(env, normalizedArtworkId),
  };
}

export async function resolveInstanceCertificate(env, { keeperPieceId }) {
  const db = dbFor(env);
  const id = requiredText(keeperPieceId, 'invalid_keeper_piece', 128);
  const piece = await first(db, `
    SELECT keeper.id, keeper.piece_id, keeper.edition_number, keeper.public_code
      FROM keeper_pieces keeper
     WHERE keeper.id = ?1
       AND keeper.registration_status = 'registered'
       AND keeper.public_code IS NOT NULL
  `, id);
  if (!piece) throw codedError('certificate_not_found');
  const artwork = await resolveArtwork(env, piece.piece_id);
  if (!artwork) throw codedError('certificate_not_found');
  const editionNumber = Number(piece.edition_number);
  return {
    ...await resolveArtworkCertificate(env, piece.piece_id),
    artworkId: piece.piece_id,
    title: artwork.title,
    edition: editionNumber === 0
      ? { kind: 'unique' }
      : {
        kind: 'numbered', number: editionNumber,
        size: artwork.editionSize === null ? null : Number(artwork.editionSize),
      },
    publicCode: piece.public_code,
    publicLedger: await resolvePublicArtworkLedger(env, { keeperPieceId: piece.id }),
  };
}

export async function resolveInstanceCertificateByPublicCode(env, { artworkId, publicCode }) {
  const db = dbFor(env);
  const normalizedArtworkId = requiredText(artworkId, 'invalid_artwork_id', 80);
  const normalizedPublicCode = requiredText(publicCode, 'invalid_public_code', 80).toUpperCase();
  const piece = await first(db, `
    SELECT id FROM keeper_pieces
     WHERE piece_id = ?1 AND public_code = ?2 AND registration_status = 'registered'
  `, normalizedArtworkId, normalizedPublicCode);
  if (!piece) throw codedError('certificate_not_found');
  return resolveInstanceCertificate(env, { keeperPieceId: piece.id });
}

export async function resolvePublicArtworkLedger(env, { keeperPieceId }) {
  const db = dbFor(env);
  const id = requiredText(keeperPieceId, 'invalid_keeper_piece', 128);
  let rows;
  try {
    rows = await all(db, `
      SELECT ledger.id, ledger.message, ledger.media_id, ledger.created_at,
             media.id AS stored_media_id,
             media.artwork_record_id AS media_artwork_record_id,
             record.id AS artwork_record_id, record.artwork_id,
             record.edition_json, record.identification_status,
             record.keeper_piece_id, piece.id AS piece_keeper_id,
             piece.piece_id, piece.edition_number, piece.public_code,
             piece.registration_status, piece.keeper_user_id, piece.claimed_at,
             piece.released_at, piece.plate_status
        FROM artist_artwork_ledger_entries ledger
        JOIN artist_artwork_records record
          ON record.id = ledger.artwork_record_id
        JOIN keeper_pieces piece
          ON piece.id = record.keeper_piece_id
        LEFT JOIN artist_artwork_media media
          ON media.id = ledger.media_id
       WHERE piece.id = ?1
         AND record.identification_status = 'identity_linked'
         AND record.artwork_id = piece.piece_id
         AND record.keeper_piece_id = piece.id
         AND piece.registration_status = 'registered'
         AND piece.keeper_user_id IS NOT NULL
         AND piece.claimed_at IS NOT NULL
         AND piece.released_at IS NULL
         AND piece.plate_status IN ('legacy', 'generated', 'active')
       ORDER BY ledger.created_at, ledger.id
    `, id);
  } catch (error) {
    if (/no such table/i.test(String(error?.message))) return [];
    throw error;
  }
  if (rows.some((row) => !exactClaimedIdentity(row, { keeperPieceId: id }))) return [];
  return rows.map((row) => {
    if (!publicLedgerId(row.id)
      || typeof row.created_at !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.created_at)
      || Number.isNaN(Date.parse(row.created_at))
      || new Date(row.created_at).toISOString() !== row.created_at) {
      throw codedError('certificate_ledger_integrity');
    }
    const entry = { id: row.id, createdAt: row.created_at };
    if (row.message !== null) {
      if (typeof row.message !== 'string' || row.message !== row.message.trim()
        || row.message.length < 1 || row.message.length > 8000) {
        throw codedError('certificate_ledger_integrity');
      }
      entry.message = row.message;
    }
    if (row.media_id !== null) {
      if (row.stored_media_id !== row.media_id
        || row.media_artwork_record_id !== row.artwork_record_id) {
        throw codedError('certificate_ledger_integrity');
      }
      entry.mediaUrl = `/api/artwork-ledger/media/${encodeURIComponent(row.id)}`;
    }
    if (!entry.message && !entry.mediaUrl) throw codedError('certificate_ledger_integrity');
    return entry;
  });
}

export async function resolvePublicArtworkLedgerMedia(env, ledgerEntryId) {
  const db = dbFor(env);
  const id = requiredText(ledgerEntryId, 'invalid_ledger_entry', 128);
  if (!publicLedgerId(id)) return null;
  const selected = await first(db, `
    SELECT ledger.id, ledger.artwork_record_id, ledger.media_id,
           media.storage_reference, media.sha256, media.content_type,
           media.byte_length, media.artwork_record_id AS media_artwork_record_id,
           record.artwork_id, record.edition_json, record.identification_status,
           record.keeper_piece_id, piece.id AS piece_keeper_id,
           piece.piece_id, piece.edition_number, piece.public_code,
           piece.registration_status, piece.keeper_user_id, piece.claimed_at,
           piece.released_at, piece.plate_status
      FROM artist_artwork_ledger_entries ledger
      JOIN artist_artwork_media media ON media.id = ledger.media_id
      JOIN artist_artwork_records record ON record.id = ledger.artwork_record_id
      JOIN keeper_pieces piece ON piece.id = record.keeper_piece_id
     WHERE ledger.id = ?1
       AND record.identification_status = 'identity_linked'
       AND record.artwork_id = piece.piece_id
       AND record.keeper_piece_id = piece.id
       AND piece.registration_status = 'registered'
       AND piece.keeper_user_id IS NOT NULL
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND piece.plate_status IN ('legacy', 'generated', 'active')
     LIMIT 1
  `, id);
  if (!selected || selected.id !== id || selected.media_id == null
    || selected.media_artwork_record_id !== selected.artwork_record_id
    || !exactClaimedIdentity(selected, { keeperPieceId: selected.keeper_piece_id })) return null;
  const extension = new Map([
    ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'],
  ]).get(selected.content_type);
  if (!extension || typeof selected.sha256 !== 'string'
    || !/^[0-9a-f]{64}$/.test(selected.sha256)
    || selected.storage_reference
      !== `artwork-ledger/${selected.artwork_record_id}/${selected.sha256}.${extension}`
    || !Number.isSafeInteger(selected.byte_length) || selected.byte_length < 1
    || selected.byte_length > 15 * 1024 * 1024) return null;
  return {
    ledgerEntryId: selected.id,
    mediaId: selected.media_id,
    artworkRecordId: selected.artwork_record_id,
    keeperPieceId: selected.keeper_piece_id,
    keeperUserId: selected.keeper_user_id,
    claimedAt: selected.claimed_at,
    storageReference: selected.storage_reference,
    sha256: selected.sha256,
    contentType: selected.content_type,
    byteLength: selected.byte_length,
  };
}

export async function resolveCurrentKeeperPriceHistory(env, { publicCode, userId }) {
  const db = dbFor(env);
  const normalizedPublicCode = requiredText(publicCode, 'invalid_public_code', 80).toUpperCase();
  const normalizedUserId = requiredText(userId, 'invalid_user', 128);
  if (!/^AR-[A-Z0-9]{8}$/.test(normalizedPublicCode)) throw codedError('invalid_public_code');
  try {
    const rows = await all(db, `
      WITH prices AS (
        SELECT id, artwork_record_id, amount_minor, currency, occurred_on,
               occurrence_precision, recorded_at
          FROM artist_artwork_price_entries
      )
      SELECT price.id AS price_id, price.amount_minor, price.currency,
             price.occurred_on, price.occurrence_precision, price.recorded_at,
             record.id AS artwork_record_id, record.artwork_id,
             record.edition_json, record.identification_status,
             record.keeper_piece_id, piece.id AS piece_keeper_id,
             piece.piece_id, piece.edition_number, piece.public_code,
             piece.registration_status, piece.keeper_user_id, piece.claimed_at,
             piece.released_at, piece.plate_status
        FROM artist_artwork_records record
        JOIN keeper_pieces piece ON piece.id = record.keeper_piece_id
        LEFT JOIN prices price ON price.artwork_record_id = record.id
       WHERE piece.public_code = ?1
         AND piece.keeper_user_id = ?2
         AND record.identification_status = 'identity_linked'
         AND record.artwork_id = piece.piece_id
         AND record.keeper_piece_id = piece.id
         AND piece.registration_status = 'registered'
         AND piece.claimed_at IS NOT NULL
         AND piece.released_at IS NULL
         AND piece.plate_status IN ('legacy', 'generated', 'active')
       ORDER BY
         CASE WHEN price.occurrence_precision = 'unknown' THEN 1 ELSE 0 END,
         CASE price.occurrence_precision
           WHEN 'exact' THEN price.occurred_on
           WHEN 'month' THEN price.occurred_on || '-01'
           WHEN 'year' THEN price.occurred_on || '-01-01'
           ELSE NULL
         END,
         CASE price.occurrence_precision
           WHEN 'exact' THEN 0 WHEN 'month' THEN 1 WHEN 'year' THEN 2 ELSE 3
         END,
         price.recorded_at, price.id
    `, normalizedPublicCode, normalizedUserId);
    if (rows.length === 0) throw codedError('not_current_keeper');
    if (rows.some((row) => !exactClaimedIdentity(row, {
      publicCode: normalizedPublicCode, userId: normalizedUserId,
    }))) throw codedError('not_current_keeper');
    return rows.filter((row) => row.price_id !== null).map((row) => {
      if (typeof row.price_id !== 'string' || !row.price_id
        || !Number.isSafeInteger(row.amount_minor) || row.amount_minor < 0
        || typeof row.currency !== 'string' || !/^[A-Z]{3}$/.test(row.currency)
        || !['exact', 'month', 'year', 'unknown'].includes(row.occurrence_precision)
        || typeof row.recorded_at !== 'string' || Number.isNaN(Date.parse(row.recorded_at))
        || (row.occurrence_precision === 'unknown' ? row.occurred_on !== null
          : typeof row.occurred_on !== 'string')) throw new Error('invalid_price_history');
      return {
        amountMinor: row.amount_minor,
        currency: row.currency,
        occurrence: {
          precision: row.occurrence_precision,
          value: row.occurred_on,
        },
        recordedAt: row.recorded_at,
      };
    });
  } catch (error) {
    if (error?.code === 'not_current_keeper') throw error;
    throw codedError('current_keeper_ledger_unavailable');
  }
}
