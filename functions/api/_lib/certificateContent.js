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
    edition: editionNumber === 0
      ? { kind: 'unique' }
      : {
        kind: 'numbered', number: editionNumber,
        size: artwork.editionSize === null ? null : Number(artwork.editionSize),
      },
    publicCode: piece.public_code,
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
