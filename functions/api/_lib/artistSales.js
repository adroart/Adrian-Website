import { resolveArtwork } from './artworkCatalog.js';

const LIMITS = {
  id: 128,
  idempotencyKey: 256,
  email: 254,
  name: 200,
  context: 4000,
  reference: 1000,
  notes: 8000,
  message: 8000,
  reason: 1000,
  search: 200,
};
const CASE_STATUSES = ['open', 'partially_resolved', 'resolved', 'closed'];
const IDENTIFICATION_STATUSES = new Set(['unresolved', 'identified', 'identity_linked']);
const RECONNECTION_EVENT_TYPES = new Set([
  'note_added', 'email_sent', 'artwork_added', 'status_changed',
]);

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, required, optional = []) {
  if (!isObject(value)) return false;
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key))
    && keys.every((key) => allowed.has(key));
}

function normalizedText(value, limit, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string') throw codedError('invalid_request');
  const text = value.trim();
  if (!text || text.length > limit) throw codedError('invalid_request');
  return text;
}

function normalizedId(value, { nullable = false } = {}) {
  return normalizedText(value, LIMITS.id, { nullable });
}

function normalizedEmail(value, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  const email = normalizedText(value, LIMITS.email).toLowerCase();
  if (email.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw codedError('invalid_request');
  }
  return email;
}

function normalizedTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw codedError('invalid_request');
  }
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== value) {
    throw codedError('invalid_request');
  }
  return value;
}

function normalizedAdministrator(value) {
  if (!exactKeys(value, ['userId', 'email'])) throw codedError('invalid_request');
  return { userId: normalizedId(value.userId), email: normalizedEmail(value.email) };
}

function normalizedMoney(value, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (!exactKeys(value, ['amountMinor', 'currency'])
    || !Number.isSafeInteger(value.amountMinor) || value.amountMinor < 0
    || typeof value.currency !== 'string') {
    throw codedError('invalid_money');
  }
  const currency = value.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw codedError('invalid_money');
  return { amountMinor: value.amountMinor, currency };
}

function normalizedOccurrence(value) {
  if (!exactKeys(value, ['precision', 'value'])) throw codedError('invalid_request');
  const { precision } = value;
  const occurredOn = value.value;
  if (precision === 'unknown' && occurredOn === null) {
    return { precision, value: null };
  }
  if (typeof occurredOn !== 'string') throw codedError('invalid_request');
  let valid = false;
  if (precision === 'year' && /^\d{4}$/.test(occurredOn)) {
    valid = new Date(`${occurredOn}-01-01T00:00:00.000Z`).getUTCFullYear() === Number(occurredOn);
  } else if (precision === 'month' && /^\d{4}-\d{2}$/.test(occurredOn)) {
    const date = new Date(`${occurredOn}-01T00:00:00.000Z`);
    valid = Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 7) === occurredOn;
  } else if (precision === 'exact' && /^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
    const date = new Date(`${occurredOn}T00:00:00.000Z`);
    valid = Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === occurredOn;
  }
  if (!valid) throw codedError('invalid_request');
  return { precision, value: occurredOn };
}

function normalizedEdition(value, { nullable = false } = {}) {
  if (nullable && value === null) return null;
  if (!isObject(value)) throw codedError('invalid_request');
  if (value.kind === 'unique' && exactKeys(value, ['kind'])) {
    return { kind: 'unique', number: null, size: null };
  }
  if (value.kind === 'numbered' && exactKeys(value, ['kind', 'number', 'size'])
    && Number.isSafeInteger(value.number) && value.number >= 1 && value.number <= 9999
    && (value.size === null || (Number.isSafeInteger(value.size)
      && value.size >= value.number && value.size <= 9999))) {
    return { kind: 'numbered', number: value.number, size: value.size };
  }
  throw codedError('invalid_request');
}

function normalizeKey(value) {
  return normalizedText(value, LIMITS.idempotencyKey);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function requestDigest(value, excludedServerFields = []) {
  const durableValue = isObject(value) && isObject(value.administrator)
    ? { ...value, administrator: { userId: value.administrator.userId } }
    : value;
  for (const field of excludedServerFields) delete durableValue[field];
  return sha256(JSON.stringify(durableValue));
}

async function stableId(kind, digest, suffix = '') {
  const hash = suffix ? await sha256(`${digest}:${suffix}`) : digest;
  return `${kind}-${hash.slice(0, 32)}`;
}

async function sharedMessageChildIdentity(parentKey, artworkRecordId) {
  const digest = await sha256(JSON.stringify({
    namespace: 'artist-shared-sale-message-v1',
    parentKey,
    artworkRecordId,
  }));
  return {
    ledgerEntryId: `ledger-${digest.slice(0, 32)}`,
    idempotencyKey: `artist-shared-ledger-${digest}`,
  };
}

function rows(result) {
  return Array.isArray(result?.results) ? result.results : [];
}

async function first(env, sql, ...values) {
  return env.DB.prepare(sql).bind(...values).first();
}

async function all(env, sql, ...values) {
  return rows(await env.DB.prepare(sql).bind(...values).all());
}

function requireAtomic(env) {
  if (!env?.DB || typeof env.DB.prepare !== 'function' || typeof env.DB.batch !== 'function') {
    throw codedError('atomic_write_unavailable');
  }
}

function statement(env, sql, ...values) {
  return env.DB.prepare(sql).bind(...values);
}

function requireBatchResults(results, expected) {
  if (!Array.isArray(results) || results.length !== expected
    || results.some((result) => result?.success !== true
      || Number(result?.meta?.changes) !== 1)) {
    throw codedError('atomic_write_failed');
  }
}

function editionFromJson(value) {
  return value == null ? null : JSON.parse(value);
}

function recordResult(row, replayed) {
  return {
    artworkRecordId: row.id,
    identificationStatus: row.identification_status,
    artworkId: row.artwork_id,
    edition: editionFromJson(row.edition_json),
    keeperPieceId: row.keeper_piece_id,
    recordVersion: Number(row.record_version),
    replayed,
  };
}

async function assertCatalogEdition(env, artworkId, edition) {
  const artwork = await resolveArtwork(env, artworkId);
  if (!artwork) throw codedError('artwork_not_found');
  if (artwork.editionKind === 'unique') {
    if (edition.kind !== 'unique') throw codedError('invalid_request');
  } else if (artwork.editionKind === 'numbered') {
    if (edition.kind !== 'numbered' || edition.size !== artwork.editionSize
      || edition.number > artwork.editionSize) throw codedError('invalid_request');
  }
}

function normalizeSaleInput(input) {
  if (!exactKeys(input, [
    'occurrence', 'buyerEmail', 'total', 'privateReference', 'privateNotes',
    'reconnectionCaseId', 'artworks', 'idempotencyKey', 'administrator', 'recordedAt',
  ]) || !Array.isArray(input.artworks) || input.artworks.length < 1 || input.artworks.length > 100) {
    throw codedError('invalid_request');
  }
  const artworks = input.artworks.map((item) => {
    if (!exactKeys(item, ['artworkRecordId', 'artworkId', 'edition', 'price'])) {
      throw codedError('invalid_request');
    }
    const artworkRecordId = normalizedId(item.artworkRecordId, { nullable: true });
    const artworkId = item.artworkId === null ? null : normalizedId(item.artworkId).toUpperCase();
    const edition = normalizedEdition(item.edition, { nullable: true });
    if (artworkRecordId !== null) {
      if (artworkId !== null || edition !== null) throw codedError('invalid_request');
    } else if ((artworkId === null) !== (edition === null)) {
      throw codedError('invalid_request');
    }
    return {
      artworkRecordId, artworkId, edition,
      price: normalizedMoney(item.price, { nullable: true }),
    };
  });
  return {
    occurrence: normalizedOccurrence(input.occurrence),
    buyerEmail: normalizedEmail(input.buyerEmail, { nullable: true }),
    total: normalizedMoney(input.total, { nullable: true }),
    privateReference: normalizedText(input.privateReference, LIMITS.reference, { nullable: true }),
    privateNotes: normalizedText(input.privateNotes, LIMITS.notes, { nullable: true }),
    reconnectionCaseId: normalizedId(input.reconnectionCaseId, { nullable: true }),
    artworks,
    idempotencyKey: normalizeKey(input.idempotencyKey),
    administrator: normalizedAdministrator(input.administrator),
    recordedAt: normalizedTimestamp(input.recordedAt),
  };
}

async function saleReplay(env, row, digest) {
  if (row.request_digest !== digest) throw codedError('idempotency_conflict');
  const items = await all(env, `
    SELECT id, artwork_record_id FROM artist_verified_sale_items
     WHERE sale_id = ?1 ORDER BY id
  `, row.id);
  const prices = await all(env, `
    SELECT price.id FROM artist_artwork_price_entries price
      JOIN artist_verified_sale_items item ON item.id = price.sale_item_id
     WHERE item.sale_id = ?1 ORDER BY item.id
  `, row.id);
  return {
    saleId: row.id,
    itemIds: items.map((item) => item.id),
    artworkRecordIds: items.map((item) => item.artwork_record_id),
    priceEntryIds: prices.map((price) => price.id),
    replayed: true,
  };
}

export async function createVerifiedSale(env, rawInput) {
  requireAtomic(env);
  const input = normalizeSaleInput(rawInput);
  const digest = await requestDigest(input, ['recordedAt']);
  const existing = await first(env, `
    SELECT id, request_digest FROM artist_verified_sales WHERE idempotency_key = ?1
  `, input.idempotencyKey);
  if (existing) return saleReplay(env, existing, digest);

  if (input.reconnectionCaseId && !await first(env,
    'SELECT id FROM artist_reconnection_cases WHERE id = ?1', input.reconnectionCaseId)) {
    throw codedError('invalid_request');
  }

  const saleId = await stableId('sale', digest);
  const resolvedItems = [];
  const seen = new Set();
  for (let index = 0; index < input.artworks.length; index += 1) {
    const artwork = input.artworks[index];
    let artworkRecordId = artwork.artworkRecordId;
    let createRecord = false;
    let status = 'unresolved';
    if (artworkRecordId) {
      const record = await first(env, `
        SELECT id FROM artist_artwork_records WHERE id = ?1
      `, artworkRecordId);
      if (!record) throw codedError('artwork_record_not_found');
    } else {
      artworkRecordId = await stableId('record', digest, `artwork:${index}`);
      createRecord = true;
      if (artwork.artworkId) {
        await assertCatalogEdition(env, artwork.artworkId, artwork.edition);
        status = 'identified';
      }
    }
    if (seen.has(artworkRecordId)) throw codedError('invalid_request');
    seen.add(artworkRecordId);
    resolvedItems.push({ ...artwork, artworkRecordId, createRecord, status, index });
  }

  const statements = [statement(env, `
    INSERT INTO artist_verified_sales
      (id, reconnection_case_id, occurrence_precision, occurred_on, buyer_email,
       currency, total_minor, private_reference, private_notes, verified_by_user_id,
       idempotency_key, request_digest, recorded_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
  `, saleId, input.reconnectionCaseId, input.occurrence.precision, input.occurrence.value,
  input.buyerEmail, input.total?.currency ?? null, input.total?.amountMinor ?? null,
  input.privateReference, input.privateNotes, input.administrator.userId,
  input.idempotencyKey, digest, input.recordedAt)];

  const itemIds = [];
  const priceEntryIds = [];
  for (const item of resolvedItems) {
    if (item.createRecord) {
      statements.push(statement(env, `
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
      `, item.artworkRecordId, item.artworkId,
      item.edition ? JSON.stringify(item.edition) : null, item.status,
      input.administrator.userId, input.recordedAt));
    }
  }
  for (const item of resolvedItems) {
    const itemKind = `item-${String(item.index).padStart(3, '0')}`;
    const itemId = await stableId(itemKind, digest, `item:${item.index}`);
    itemIds.push(itemId);
    statements.push(statement(env, `
      INSERT INTO artist_verified_sale_items
        (id, sale_id, artwork_record_id, amount_minor, currency, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `, itemId, saleId, item.artworkRecordId, item.price?.amountMinor ?? null,
    item.price?.currency ?? null, input.recordedAt));
    if (item.price) {
      const priceKind = `price-${String(item.index).padStart(3, '0')}`;
      const priceId = await stableId(priceKind, digest, `price:${item.index}`);
      priceEntryIds.push(priceId);
      statements.push(statement(env, `
        INSERT INTO artist_artwork_price_entries
          (id, artwork_record_id, sale_item_id, amount_minor, currency,
           occurred_on, occurrence_precision, recorded_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
      `, priceId, item.artworkRecordId, itemId, item.price.amountMinor,
      item.price.currency, input.occurrence.value, input.occurrence.precision, input.recordedAt));
    }
    if (input.reconnectionCaseId) {
      const eventId = await stableId('reconnect-event', digest, `sale-artwork:${item.index}`);
      const eventKey = `sale-artwork-${await sha256(`${digest}:${item.index}`)}`;
      statements.push(statement(env, `
        INSERT INTO artist_reconnection_events
          (id, reconnection_case_id, event_type, private_note, artwork_record_id,
           actor_user_id, idempotency_key, request_digest, created_at)
        VALUES (?1, ?2, 'artwork_added', NULL, ?3, ?4, ?5, ?6, ?7)
      `, eventId, input.reconnectionCaseId, item.artworkRecordId,
      input.administrator.userId, eventKey, digest, input.recordedAt));
    }
  }

  try {
    requireBatchResults(await env.DB.batch(statements), statements.length);
  } catch (error) {
    const concurrent = await first(env, `
      SELECT id, request_digest FROM artist_verified_sales WHERE idempotency_key = ?1
    `, input.idempotencyKey);
    if (concurrent) return saleReplay(env, concurrent, digest);
    throw error;
  }
  return {
    saleId, itemIds, artworkRecordIds: resolvedItems.map((item) => item.artworkRecordId),
    priceEntryIds, replayed: false,
  };
}

function normalizeCaseInput(input) {
  if (!exactKeys(input, [
    'recipientEmail', 'recipientName', 'privateContext', 'idempotencyKey',
    'administrator', 'createdAt',
  ])) throw codedError('invalid_request');
  return {
    recipientEmail: normalizedEmail(input.recipientEmail),
    recipientName: normalizedText(input.recipientName, LIMITS.name, { nullable: true }),
    privateContext: normalizedText(input.privateContext, LIMITS.context, { nullable: true }),
    idempotencyKey: normalizeKey(input.idempotencyKey),
    administrator: normalizedAdministrator(input.administrator),
    createdAt: normalizedTimestamp(input.createdAt),
  };
}

export async function createReconnectionCase(env, rawInput) {
  requireAtomic(env);
  const input = normalizeCaseInput(rawInput);
  const digest = await requestDigest(input, ['createdAt']);
  const existing = await first(env, `
    SELECT id, recipient_email, status, request_digest
      FROM artist_reconnection_cases WHERE idempotency_key = ?1
  `, input.idempotencyKey);
  if (existing) {
    if (existing.request_digest !== digest) throw codedError('idempotency_conflict');
    return { reconnectionCaseId: existing.id, recipientEmail: existing.recipient_email,
      status: existing.status, replayed: true };
  }
  const id = await stableId('case', digest);
  try {
    const statements = [statement(env, `
      INSERT INTO artist_reconnection_cases
        (id, recipient_email, recipient_name, private_context, status,
         created_by_user_id, idempotency_key, request_digest, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, 'open', ?5, ?6, ?7, ?8, ?8)
    `, id, input.recipientEmail, input.recipientName, input.privateContext,
    input.administrator.userId, input.idempotencyKey, digest, input.createdAt)];
    requireBatchResults(await env.DB.batch(statements), statements.length);
  } catch (error) {
    const concurrent = await first(env, `
      SELECT id, recipient_email, status, request_digest
        FROM artist_reconnection_cases WHERE idempotency_key = ?1
    `, input.idempotencyKey);
    if (concurrent) {
      if (concurrent.request_digest !== digest) throw codedError('idempotency_conflict');
      return { reconnectionCaseId: concurrent.id, recipientEmail: concurrent.recipient_email,
        status: concurrent.status, replayed: true };
    }
    throw error;
  }
  return { reconnectionCaseId: id, recipientEmail: input.recipientEmail,
    status: 'open', replayed: false };
}

async function effectiveCaseStatus(env, caseId, baseStatus = null) {
  const row = await first(env, `
    SELECT private_note FROM artist_reconnection_events
     WHERE reconnection_case_id = ?1 AND event_type = 'status_changed'
     ORDER BY CASE private_note
       WHEN 'closed' THEN 3 WHEN 'resolved' THEN 2
       WHEN 'partially_resolved' THEN 1 ELSE 0 END DESC,
       created_at DESC, id DESC LIMIT 1
  `, caseId);
  if (row && CASE_STATUSES.includes(row.private_note)) return row.private_note;
  if (baseStatus) return baseStatus;
  const base = await first(env, 'SELECT status FROM artist_reconnection_cases WHERE id = ?1', caseId);
  return base?.status ?? null;
}

export async function appendReconnectionEvent(env, rawInput) {
  requireAtomic(env);
  if (!exactKeys(rawInput, [
    'reconnectionCaseId', 'eventType', 'privateNote', 'artworkRecordId', 'newStatus',
    'idempotencyKey', 'administrator', 'createdAt',
  ])) throw codedError('invalid_request');
  const eventType = rawInput.eventType;
  if (!RECONNECTION_EVENT_TYPES.has(eventType)) throw codedError('invalid_request');
  const input = {
    reconnectionCaseId: normalizedId(rawInput.reconnectionCaseId), eventType,
    privateNote: normalizedText(rawInput.privateNote, LIMITS.notes, { nullable: true }),
    artworkRecordId: normalizedId(rawInput.artworkRecordId, { nullable: true }),
    newStatus: rawInput.newStatus === null ? null : normalizedText(rawInput.newStatus, 30),
    idempotencyKey: normalizeKey(rawInput.idempotencyKey),
    administrator: normalizedAdministrator(rawInput.administrator),
    createdAt: normalizedTimestamp(rawInput.createdAt),
  };
  if ((eventType === 'note_added' || eventType === 'email_sent')
    ? ((eventType === 'note_added' && !input.privateNote)
      || input.artworkRecordId || input.newStatus)
    : eventType === 'artwork_added'
      ? (!input.artworkRecordId || input.privateNote || input.newStatus)
      : (!CASE_STATUSES.includes(input.newStatus) || input.privateNote || input.artworkRecordId)) {
    throw codedError('invalid_request');
  }
  const digest = await requestDigest(input, ['createdAt']);
  const replay = await first(env, `
    SELECT id, event_type, private_note, request_digest FROM artist_reconnection_events
     WHERE idempotency_key = ?1
  `, input.idempotencyKey);
  if (replay) {
    if (replay.request_digest !== digest) throw codedError('idempotency_conflict');
    return {
      reconnectionEventId: replay.id,
      eventType: replay.event_type,
      ...(replay.event_type === 'status_changed' ? { status: replay.private_note } : {}),
      replayed: true,
    };
  }
  const base = await first(env, `
    SELECT id, status FROM artist_reconnection_cases WHERE id = ?1
  `, input.reconnectionCaseId);
  if (!base) throw codedError('invalid_request');
  if (eventType === 'artwork_added' && !await first(env, `
    SELECT item.id FROM artist_verified_sale_items item
      JOIN artist_verified_sales sale ON sale.id = item.sale_id
     WHERE sale.reconnection_case_id = ?1 AND item.artwork_record_id = ?2 LIMIT 1
  `, input.reconnectionCaseId, input.artworkRecordId)) throw codedError('invalid_request');
  const currentStatus = await effectiveCaseStatus(env, input.reconnectionCaseId, base.status);
  if (eventType === 'status_changed'
    && CASE_STATUSES.indexOf(input.newStatus) !== CASE_STATUSES.indexOf(currentStatus) + 1) {
    throw codedError('invalid_request');
  }
  const id = await stableId('reconnect-event', digest);
  const storedNote = eventType === 'status_changed' ? input.newStatus : input.privateNote;
  const insert = eventType === 'status_changed'
    ? statement(env, `
      INSERT INTO artist_reconnection_events
        (id, reconnection_case_id, event_type, private_note, artwork_record_id,
         actor_user_id, idempotency_key, request_digest, created_at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
       WHERE COALESCE(
         (SELECT private_note FROM artist_reconnection_events
           WHERE reconnection_case_id = ?2 AND event_type = 'status_changed'
           ORDER BY CASE private_note
             WHEN 'closed' THEN 3 WHEN 'resolved' THEN 2
             WHEN 'partially_resolved' THEN 1 ELSE 0 END DESC,
             created_at DESC, id DESC LIMIT 1),
         (SELECT status FROM artist_reconnection_cases WHERE id = ?2)
       ) = ?10
    `, id, input.reconnectionCaseId, eventType, storedNote, input.artworkRecordId,
    input.administrator.userId, input.idempotencyKey, digest, input.createdAt, currentStatus)
    : statement(env, `
      INSERT INTO artist_reconnection_events
        (id, reconnection_case_id, event_type, private_note, artwork_record_id,
         actor_user_id, idempotency_key, request_digest, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `, id, input.reconnectionCaseId, eventType, storedNote, input.artworkRecordId,
    input.administrator.userId, input.idempotencyKey, digest, input.createdAt);
  try {
    const results = await env.DB.batch([insert]);
    if (eventType === 'status_changed' && Array.isArray(results) && results.length === 1
      && results[0]?.success === true && Number(results[0]?.meta?.changes) === 0) {
      throw codedError('version_conflict');
    }
    requireBatchResults(results, 1);
  } catch (error) {
    const concurrent = await first(env, `
      SELECT id, event_type, private_note, request_digest FROM artist_reconnection_events
       WHERE idempotency_key = ?1
    `, input.idempotencyKey);
    if (concurrent) {
      if (concurrent.request_digest !== digest) throw codedError('idempotency_conflict');
      return {
        reconnectionEventId: concurrent.id,
        eventType: concurrent.event_type,
        ...(concurrent.event_type === 'status_changed'
          ? { status: concurrent.private_note } : {}),
        replayed: true,
      };
    }
    if (error?.code === 'version_conflict' || error?.code === 'atomic_write_failed') throw error;
    throw codedError('atomic_write_failed');
  }
  return {
    reconnectionEventId: id,
    eventType,
    ...(eventType === 'status_changed' ? { status: input.newStatus } : {}),
    replayed: false,
  };
}

function normalizeIdentityInput(input, mode) {
  const identify = mode === 'identify';
  const required = identify
    ? ['artworkRecordId', 'artworkId', 'edition', 'expectedVersion', 'idempotencyKey', 'administrator', 'identifiedAt']
    : ['artworkRecordId', 'keeperPieceId', 'expectedVersion', 'idempotencyKey', 'administrator', 'linkedAt'];
  if (!exactKeys(input, required) || !Number.isSafeInteger(input.expectedVersion)
    || input.expectedVersion < 1) throw codedError('invalid_request');
  return {
    artworkRecordId: normalizedId(input.artworkRecordId),
    ...(identify ? {
      artworkId: normalizedId(input.artworkId).toUpperCase(),
      edition: normalizedEdition(input.edition), at: normalizedTimestamp(input.identifiedAt),
    } : {
      keeperPieceId: normalizedId(input.keeperPieceId), at: normalizedTimestamp(input.linkedAt),
    }),
    expectedVersion: input.expectedVersion, idempotencyKey: normalizeKey(input.idempotencyKey),
    administrator: normalizedAdministrator(input.administrator),
  };
}

async function identityReplay(env, key, digest) {
  const event = await first(env, `
    SELECT artwork_record_id, after_json, request_digest FROM artist_artwork_record_events
     WHERE idempotency_key = ?1
  `, key);
  if (!event) return null;
  if (event.request_digest !== digest) throw codedError('idempotency_conflict');
  const after = JSON.parse(event.after_json);
  return {
    artworkRecordId: event.artwork_record_id,
    identificationStatus: after.identificationStatus, artworkId: after.artworkId,
    edition: after.editionJson, keeperPieceId: after.keeperPieceId,
    recordVersion: after.recordVersion, replayed: true,
  };
}

function identitySnapshot(row) {
  return {
    artworkId: row.artwork_id, editionJson: editionFromJson(row.edition_json),
    keeperPieceId: row.keeper_piece_id, identificationStatus: row.identification_status,
    recordVersion: Number(row.record_version),
  };
}

async function mutateIdentity(env, input, row, action, after, digest) {
  const eventId = await stableId('record-event', digest);
  const statements = [
    statement(env, `
      INSERT INTO artist_artwork_record_events
        (id, artwork_record_id, action, before_json, after_json, resulting_version,
         actor_user_id, idempotency_key, request_digest, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
    `, eventId, input.artworkRecordId, action, JSON.stringify(identitySnapshot(row)),
    JSON.stringify(after), after.recordVersion, input.administrator.userId,
    input.idempotencyKey, digest, input.at),
    statement(env, `
      UPDATE artist_artwork_records
         SET artwork_id = ?1, edition_json = ?2, keeper_piece_id = ?3,
             identification_status = ?4, record_version = ?5,
             last_event_id = ?6, updated_at = ?7
       WHERE id = ?8 AND record_version = ?9
    `, after.artworkId, JSON.stringify(after.editionJson), after.keeperPieceId,
    after.identificationStatus, after.recordVersion, eventId, input.at,
    input.artworkRecordId, input.expectedVersion),
  ];
  requireBatchResults(await env.DB.batch(statements), statements.length);
  return {
    artworkRecordId: input.artworkRecordId,
    identificationStatus: after.identificationStatus, artworkId: after.artworkId,
    edition: after.editionJson, keeperPieceId: after.keeperPieceId,
    recordVersion: after.recordVersion, replayed: false,
  };
}

export async function identifyArtworkRecord(env, rawInput) {
  requireAtomic(env);
  const input = normalizeIdentityInput(rawInput, 'identify');
  const digest = await requestDigest(input, ['at']);
  const replay = await identityReplay(env, input.idempotencyKey, digest);
  if (replay) return replay;
  await assertCatalogEdition(env, input.artworkId, input.edition);
  const row = await first(env, `
    SELECT id, artwork_id, edition_json, keeper_piece_id, identification_status, record_version
      FROM artist_artwork_records WHERE id = ?1
  `, input.artworkRecordId);
  if (!row) throw codedError('artwork_record_not_found');
  if (!['unresolved', 'identified'].includes(row.identification_status)) {
    throw codedError('invalid_request');
  }
  if (Number(row.record_version) !== input.expectedVersion) throw codedError('version_conflict');
  const after = {
    artworkId: input.artworkId, editionJson: input.edition, keeperPieceId: null,
    identificationStatus: 'identified', recordVersion: input.expectedVersion + 1,
  };
  try {
    return await mutateIdentity(env, input, row,
      row.identification_status === 'unresolved' ? 'identified' : 'identification_corrected',
      after, digest);
  } catch (error) {
    const concurrent = await identityReplay(env, input.idempotencyKey, digest);
    if (concurrent) return concurrent;
    throw codedError('version_conflict');
  }
}

export async function linkArtworkIdentity(env, rawInput) {
  requireAtomic(env);
  const input = normalizeIdentityInput(rawInput, 'link');
  const digest = await requestDigest(input, ['at']);
  const replay = await identityReplay(env, input.idempotencyKey, digest);
  if (replay) return replay;
  const row = await first(env, `
    SELECT id, artwork_id, edition_json, keeper_piece_id, identification_status, record_version
      FROM artist_artwork_records WHERE id = ?1
  `, input.artworkRecordId);
  if (!row) throw codedError('artwork_record_not_found');
  if (row.identification_status !== 'identified') throw codedError('invalid_request');
  if (Number(row.record_version) !== input.expectedVersion) throw codedError('version_conflict');
  const keeper = await first(env, `
    SELECT id, piece_id, edition_number FROM keeper_pieces WHERE id = ?1
  `, input.keeperPieceId);
  if (!keeper) throw codedError('keeper_identity_not_found');
  const edition = editionFromJson(row.edition_json);
  if (keeper.piece_id !== row.artwork_id
    || Number(keeper.edition_number) !== (edition.kind === 'unique' ? 0 : edition.number)) {
    throw codedError('artwork_identity_mismatch');
  }
  if (await first(env, `
    SELECT id FROM artist_artwork_records WHERE keeper_piece_id = ?1 AND id <> ?2
  `, input.keeperPieceId, input.artworkRecordId)) throw codedError('artwork_identity_mismatch');
  const after = {
    artworkId: row.artwork_id, editionJson: edition, keeperPieceId: input.keeperPieceId,
    identificationStatus: 'identity_linked', recordVersion: input.expectedVersion + 1,
  };
  try {
    return await mutateIdentity(env, input, row, 'identity_linked', after, digest);
  } catch (error) {
    const concurrent = await identityReplay(env, input.idempotencyKey, digest);
    if (concurrent) return concurrent;
    throw codedError('version_conflict');
  }
}

function normalizeLedgerInput(input) {
  if (!exactKeys(input, [
    'artworkRecordId', 'saleId', 'message', 'mediaId', 'idempotencyKey',
    'administrator', 'createdAt',
  ])) throw codedError('invalid_request');
  const normalized = {
    artworkRecordId: normalizedId(input.artworkRecordId),
    saleId: normalizedId(input.saleId, { nullable: true }),
    message: normalizedText(input.message, LIMITS.message, { nullable: true }),
    mediaId: normalizedId(input.mediaId, { nullable: true }),
    idempotencyKey: normalizeKey(input.idempotencyKey),
    administrator: normalizedAdministrator(input.administrator),
    createdAt: normalizedTimestamp(input.createdAt),
  };
  if (!normalized.message && !normalized.mediaId) throw codedError('invalid_request');
  return normalized;
}

export async function appendArtworkLedgerEntry(env, rawInput) {
  requireAtomic(env);
  const input = normalizeLedgerInput(rawInput);
  const digest = await requestDigest(input, ['createdAt']);
  const existing = await first(env, `
    SELECT id, artwork_record_id, sale_id, message, media_id, request_digest
      FROM artist_artwork_ledger_entries WHERE idempotency_key = ?1
  `, input.idempotencyKey);
  if (existing) {
    if (existing.request_digest !== digest) throw codedError('idempotency_conflict');
    return { ledgerEntryId: existing.id, artworkRecordId: existing.artwork_record_id,
      saleId: existing.sale_id, message: existing.message, mediaId: existing.media_id,
      replayed: true };
  }
  if (!await first(env, 'SELECT id FROM artist_artwork_records WHERE id = ?1', input.artworkRecordId)) {
    throw codedError('artwork_record_not_found');
  }
  if (input.saleId && !await first(env, `
    SELECT id FROM artist_verified_sale_items WHERE sale_id = ?1 AND artwork_record_id = ?2
  `, input.saleId, input.artworkRecordId)) throw codedError('invalid_request');
  if (input.mediaId && !await first(env, `
    SELECT id FROM artist_artwork_media WHERE id = ?1 AND artwork_record_id = ?2
  `, input.mediaId, input.artworkRecordId)) throw codedError('invalid_request');
  const id = await stableId('ledger', digest);
  try {
    const statements = [statement(env, `
      INSERT INTO artist_artwork_ledger_entries
        (id, artwork_record_id, sale_id, message, media_id, created_by_user_id,
         idempotency_key, request_digest, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `, id, input.artworkRecordId, input.saleId, input.message, input.mediaId,
    input.administrator.userId, input.idempotencyKey, digest, input.createdAt)];
    requireBatchResults(await env.DB.batch(statements), statements.length);
  } catch (error) {
    const concurrent = await first(env, `
      SELECT id, artwork_record_id, sale_id, message, media_id, request_digest
        FROM artist_artwork_ledger_entries WHERE idempotency_key = ?1
    `, input.idempotencyKey);
    if (concurrent) {
      if (concurrent.request_digest !== digest) throw codedError('idempotency_conflict');
      return { ledgerEntryId: concurrent.id, artworkRecordId: concurrent.artwork_record_id,
        saleId: concurrent.sale_id, message: concurrent.message, mediaId: concurrent.media_id,
        replayed: true };
    }
    throw error;
  }
  return { ledgerEntryId: id, artworkRecordId: input.artworkRecordId,
    saleId: input.saleId, message: input.message, mediaId: input.mediaId, replayed: false };
}

function baseSaleSnapshot(row) {
  return {
    reconnectionCaseId: row.reconnection_case_id,
    occurrencePrecision: row.occurrence_precision,
    occurredOn: row.occurred_on,
    buyerEmail: row.buyer_email,
    currency: row.currency,
    totalMinor: row.total_minor == null ? null : Number(row.total_minor),
    privateReference: row.private_reference,
    privateNotes: row.private_notes,
    verifiedByUserId: row.verified_by_user_id,
    recordedAt: row.recorded_at,
  };
}

const SALE_SNAPSHOT_KEYS = [
  'reconnectionCaseId', 'occurrencePrecision', 'occurredOn', 'buyerEmail',
  'currency', 'totalMinor', 'privateReference', 'privateNotes',
  'verifiedByUserId', 'recordedAt',
];

function validatedSaleSnapshot(value) {
  try {
    if (!exactKeys(value, SALE_SNAPSHOT_KEYS)) throw new Error();
    const occurrence = normalizedOccurrence({
      precision: value.occurrencePrecision, value: value.occurredOn,
    });
    const reconnectionCaseId = normalizedId(value.reconnectionCaseId, { nullable: true });
    const buyerEmail = normalizedEmail(value.buyerEmail, { nullable: true });
    const total = value.currency === null && value.totalMinor === null
      ? null : normalizedMoney({ amountMinor: value.totalMinor, currency: value.currency });
    const privateReference = normalizedText(
      value.privateReference, LIMITS.reference, { nullable: true },
    );
    const privateNotes = normalizedText(value.privateNotes, LIMITS.notes, { nullable: true });
    const verifiedByUserId = normalizedId(value.verifiedByUserId);
    const recordedAt = normalizedTimestamp(value.recordedAt);
    if (reconnectionCaseId !== value.reconnectionCaseId
      || buyerEmail !== value.buyerEmail
      || privateReference !== value.privateReference
      || privateNotes !== value.privateNotes
      || verifiedByUserId !== value.verifiedByUserId
      || recordedAt !== value.recordedAt
      || occurrence.precision !== value.occurrencePrecision
      || occurrence.value !== value.occurredOn
      || (total === null
        ? value.currency !== null || value.totalMinor !== null
        : total.currency !== value.currency || total.amountMinor !== value.totalMinor)) {
      throw new Error();
    }
    return {
      reconnectionCaseId, occurrencePrecision: occurrence.precision,
      occurredOn: occurrence.value, buyerEmail,
      currency: total?.currency ?? null, totalMinor: total?.amountMinor ?? null,
      privateReference, privateNotes, verifiedByUserId, recordedAt,
    };
  } catch {
    throw codedError('integrity_error');
  }
}

function parsedSaleSnapshot(value) {
  try { return validatedSaleSnapshot(JSON.parse(value)); } catch {
    throw codedError('integrity_error');
  }
}

function sameSaleSnapshot(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function saleState(env, saleId) {
  const sale = await first(env, `
    SELECT id, reconnection_case_id, occurrence_precision, occurred_on, buyer_email,
           currency, total_minor, private_reference, private_notes,
           verified_by_user_id, recorded_at
      FROM artist_verified_sales WHERE id = ?1
  `, saleId);
  if (!sale) throw codedError('sale_not_found');
  const event = await first(env, `
    SELECT sequence, after_json FROM artist_verified_sale_events
     WHERE sale_id = ?1 ORDER BY sequence DESC LIMIT 1
  `, saleId);
  return {
    sale,
    sequence: event ? Number(event.sequence) : 0,
    snapshot: event ? JSON.parse(event.after_json) : baseSaleSnapshot(sale),
  };
}

export async function appendSharedSaleMessage(env, rawInput) {
  requireAtomic(env);
  if (!exactKeys(rawInput, [
    'saleId', 'artworkRecordIds', 'message', 'expectedSequence', 'idempotencyKey',
    'administrator', 'createdAt',
  ]) || !Array.isArray(rawInput.artworkRecordIds) || rawInput.artworkRecordIds.length < 1
    || !Number.isSafeInteger(rawInput.expectedSequence) || rawInput.expectedSequence < 0) {
    throw codedError('invalid_request');
  }
  const targets = rawInput.artworkRecordIds.map((id) => normalizedId(id));
  if (new Set(targets).size !== targets.length) throw codedError('invalid_request');
  targets.sort();
  const input = {
    saleId: normalizedId(rawInput.saleId), artworkRecordIds: targets,
    message: normalizedText(rawInput.message, LIMITS.message),
    expectedSequence: rawInput.expectedSequence, idempotencyKey: normalizeKey(rawInput.idempotencyKey),
    administrator: normalizedAdministrator(rawInput.administrator),
    createdAt: normalizedTimestamp(rawInput.createdAt),
  };
  const digest = await requestDigest(input, ['createdAt', 'expectedSequence']);
  const existing = await first(env, `
    SELECT id, sale_id, sequence, request_digest FROM artist_verified_sale_events
     WHERE idempotency_key = ?1
  `, input.idempotencyKey);
  const replayResponse = async (event) => ({
    saleEventId: event.id, saleId: event.sale_id, sequence: Number(event.sequence),
    entries: await Promise.all(targets.map(async (artworkRecordId) => ({
      ledgerEntryId: (await sharedMessageChildIdentity(
        input.idempotencyKey, artworkRecordId,
      )).ledgerEntryId,
      artworkRecordId,
    }))),
    replayed: true,
  });
  if (existing) {
    if (existing.request_digest !== digest) throw codedError('idempotency_conflict');
    return replayResponse(existing);
  }
  const state = await saleState(env, input.saleId);
  if (state.sequence !== input.expectedSequence) throw codedError('version_conflict');
  const saleTargets = new Set((await all(env, `
    SELECT artwork_record_id FROM artist_verified_sale_items WHERE sale_id = ?1
  `, input.saleId)).map((row) => row.artwork_record_id));
  if (targets.some((id) => !saleTargets.has(id))) throw codedError('invalid_request');
  const before = state.snapshot;
  const after = { ...before,
    privateNotes: before.privateNotes ? `${before.privateNotes}\n\n${input.message}` : input.message };
  const sequence = state.sequence + 1;
  const eventId = await stableId('sale-event', digest);
  const entries = [];
  const statements = [];
  for (const artworkRecordId of targets) {
    const child = await sharedMessageChildIdentity(input.idempotencyKey, artworkRecordId);
    const { ledgerEntryId } = child;
    entries.push({ ledgerEntryId, artworkRecordId });
    statements.push(statement(env, `
      INSERT INTO artist_artwork_ledger_entries
        (id, artwork_record_id, sale_id, message, created_by_user_id,
         idempotency_key, request_digest, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `, ledgerEntryId, artworkRecordId, input.saleId, input.message,
    input.administrator.userId, child.idempotencyKey, digest, input.createdAt));
  }
  statements.push(statement(env, `
    INSERT INTO artist_verified_sale_events
      (id, sale_id, sequence, event_type, before_json, after_json,
       reason, actor_user_id, idempotency_key, request_digest, created_at)
    VALUES (?1, ?2, ?3, 'shared_message_appended', ?4, ?5, NULL, ?6, ?7, ?8, ?9)
  `, eventId, input.saleId, sequence, JSON.stringify(before), JSON.stringify(after),
  input.administrator.userId, input.idempotencyKey, digest, input.createdAt));
  try {
    requireBatchResults(await env.DB.batch(statements), statements.length);
  } catch (error) {
    const concurrent = await first(env, `
      SELECT id, sale_id, sequence, request_digest FROM artist_verified_sale_events
       WHERE idempotency_key = ?1
    `, input.idempotencyKey);
    if (concurrent) {
      if (concurrent.request_digest !== digest) throw codedError('idempotency_conflict');
      return replayResponse(concurrent);
    }
    throw codedError('version_conflict');
  }
  return { saleEventId: eventId, saleId: input.saleId, sequence, entries, replayed: false };
}

function normalizeReplacement(value) {
  if (!exactKeys(value, [
    'reconnectionCaseId', 'occurrence', 'buyerEmail', 'total',
    'privateReference', 'privateNotes',
  ])) throw codedError('invalid_request');
  return {
    reconnectionCaseId: normalizedId(value.reconnectionCaseId, { nullable: true }),
    occurrence: normalizedOccurrence(value.occurrence),
    buyerEmail: normalizedEmail(value.buyerEmail, { nullable: true }),
    total: normalizedMoney(value.total, { nullable: true }),
    privateReference: normalizedText(value.privateReference, LIMITS.reference, { nullable: true }),
    privateNotes: normalizedText(value.privateNotes, LIMITS.notes, { nullable: true }),
  };
}

export async function correctVerifiedSale(env, rawInput) {
  requireAtomic(env);
  if (!exactKeys(rawInput, [
    'saleId', 'expectedSequence', 'replacement', 'reason', 'idempotencyKey',
    'administrator', 'correctedAt',
  ]) || !Number.isSafeInteger(rawInput.expectedSequence) || rawInput.expectedSequence < 0) {
    throw codedError('invalid_request');
  }
  const input = {
    saleId: normalizedId(rawInput.saleId), expectedSequence: rawInput.expectedSequence,
    replacement: normalizeReplacement(rawInput.replacement),
    reason: normalizedText(rawInput.reason, LIMITS.reason),
    idempotencyKey: normalizeKey(rawInput.idempotencyKey),
    administrator: normalizedAdministrator(rawInput.administrator),
    correctedAt: normalizedTimestamp(rawInput.correctedAt),
  };
  const digest = await requestDigest(input, ['correctedAt']);
  const existing = await first(env, `
    SELECT id, sale_id, sequence, reason, request_digest FROM artist_verified_sale_events
     WHERE idempotency_key = ?1
  `, input.idempotencyKey);
  if (existing) {
    if (existing.request_digest !== digest) throw codedError('idempotency_conflict');
    return { saleEventId: existing.id, saleId: existing.sale_id,
      sequence: Number(existing.sequence), reason: existing.reason, replayed: true };
  }
  if (input.replacement.reconnectionCaseId && !await first(env,
    'SELECT id FROM artist_reconnection_cases WHERE id = ?1',
    input.replacement.reconnectionCaseId)) throw codedError('invalid_request');
  const state = await saleState(env, input.saleId);
  if (state.sequence !== input.expectedSequence) throw codedError('version_conflict');
  const replacement = input.replacement;
  const after = {
    reconnectionCaseId: replacement.reconnectionCaseId,
    occurrencePrecision: replacement.occurrence.precision,
    occurredOn: replacement.occurrence.value,
    buyerEmail: replacement.buyerEmail,
    currency: replacement.total?.currency ?? null,
    totalMinor: replacement.total?.amountMinor ?? null,
    privateReference: replacement.privateReference,
    privateNotes: replacement.privateNotes,
    verifiedByUserId: state.snapshot.verifiedByUserId,
    recordedAt: state.snapshot.recordedAt,
  };
  if (JSON.stringify(after) === JSON.stringify(state.snapshot)) throw codedError('invalid_request');
  const id = await stableId('sale-event', digest);
  const sequence = state.sequence + 1;
  try {
    const statements = [statement(env, `
      INSERT INTO artist_verified_sale_events
        (id, sale_id, sequence, event_type, before_json, after_json,
         reason, actor_user_id, idempotency_key, request_digest, created_at)
      VALUES (?1, ?2, ?3, 'corrected', ?4, ?5, ?6, ?7, ?8, ?9, ?10)
    `, id, input.saleId, sequence, JSON.stringify(state.snapshot), JSON.stringify(after),
    input.reason, input.administrator.userId, input.idempotencyKey, digest, input.correctedAt)];
    requireBatchResults(await env.DB.batch(statements), statements.length);
  } catch (error) {
    const concurrent = await first(env, `
      SELECT id, sale_id, sequence, reason, request_digest FROM artist_verified_sale_events
       WHERE idempotency_key = ?1
    `, input.idempotencyKey);
    if (concurrent) {
      if (concurrent.request_digest !== digest) throw codedError('idempotency_conflict');
      return { saleEventId: concurrent.id, saleId: concurrent.sale_id,
        sequence: Number(concurrent.sequence), reason: concurrent.reason, replayed: true };
    }
    throw codedError('version_conflict');
  }
  return { saleEventId: id, saleId: input.saleId, sequence,
    reason: input.reason, replayed: false };
}

function publicSale(snapshot, id, sequence) {
  return {
    saleId: id,
    reconnectionCaseId: snapshot.reconnectionCaseId,
    occurrence: { precision: snapshot.occurrencePrecision, value: snapshot.occurredOn },
    buyerEmail: snapshot.buyerEmail,
    total: snapshot.totalMinor == null ? null
      : { amountMinor: snapshot.totalMinor, currency: snapshot.currency },
    privateReference: snapshot.privateReference,
    privateNotes: snapshot.privateNotes,
    recordedAt: snapshot.recordedAt,
    sequence,
  };
}

function saleFactProjection(snapshot) {
  return {
    reconnectionCaseId: snapshot.reconnectionCaseId,
    occurrence: { precision: snapshot.occurrencePrecision, value: snapshot.occurredOn },
    buyerEmail: snapshot.buyerEmail,
    total: snapshot.totalMinor == null ? null
      : { amountMinor: snapshot.totalMinor, currency: snapshot.currency },
    privateReference: snapshot.privateReference,
    privateNotes: snapshot.privateNotes,
    recordedAt: snapshot.recordedAt,
  };
}

export async function getArtistSaleDetail(env, saleIdValue) {
  if (!env?.DB) throw codedError('invalid_request');
  const saleId = normalizedId(saleIdValue);
  const saleRow = await first(env, `
    SELECT id, reconnection_case_id, occurrence_precision, occurred_on, buyer_email,
           currency, total_minor, private_reference, private_notes,
           verified_by_user_id, recorded_at
      FROM artist_verified_sales WHERE id = ?1
  `, saleId);
  if (!saleRow) throw codedError('sale_not_found');
  const originalSnapshot = validatedSaleSnapshot(baseSaleSnapshot(saleRow));
  const eventRows = await all(env, `
    SELECT id, sequence, event_type, before_json, after_json, reason, created_at
      FROM artist_verified_sale_events
     WHERE sale_id = ?1 ORDER BY sequence, id
  `, saleId);
  let effectiveSnapshot = originalSnapshot;
  let expectedSequence = 1;
  const events = [];
  const corrections = [];
  for (const event of eventRows) {
    let eventId;
    try {
      eventId = normalizedId(event.id);
    } catch {
      throw codedError('integrity_error');
    }
    const sequence = event.sequence;
    if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence)
      || sequence !== expectedSequence
      || !['corrected', 'shared_message_appended'].includes(event.event_type)
      || eventId !== event.id) {
      throw codedError('integrity_error');
    }
    const before = parsedSaleSnapshot(event.before_json);
    const after = parsedSaleSnapshot(event.after_json);
    if (!sameSaleSnapshot(before, effectiveSnapshot)
      || after.verifiedByUserId !== originalSnapshot.verifiedByUserId
      || after.recordedAt !== originalSnapshot.recordedAt) {
      throw codedError('integrity_error');
    }
    let reason = null;
    try {
      if (event.event_type === 'corrected') {
        reason = normalizedText(event.reason, LIMITS.reason);
        if (reason !== event.reason || sameSaleSnapshot(before, after)) throw new Error();
      } else if (event.reason !== null) throw new Error();
      normalizedTimestamp(event.created_at);
    } catch {
      throw codedError('integrity_error');
    }
    const projectedEvent = {
      saleEventId: eventId, sequence, eventType: event.event_type,
      reason, createdAt: event.created_at,
    };
    events.push(projectedEvent);
    if (event.event_type === 'corrected') {
      corrections.push({
        saleEventId: eventId, sequence, reason, createdAt: event.created_at,
        before: saleFactProjection(before), after: saleFactProjection(after),
      });
    }
    effectiveSnapshot = after;
    expectedSequence += 1;
  }
  const sequence = expectedSequence - 1;
  const originalSale = publicSale(originalSnapshot, saleId, 0);
  const effectiveSale = publicSale(effectiveSnapshot, saleId, sequence);
  const itemRows = await all(env, `
    SELECT item.id AS item_id, item.artwork_record_id, item.amount_minor, item.currency,
           record.artwork_id, record.edition_json, record.keeper_piece_id,
           record.identification_status, record.record_version
      FROM artist_verified_sale_items item
      JOIN artist_artwork_records record ON record.id = item.artwork_record_id
     WHERE item.sale_id = ?1 ORDER BY item.created_at, item.id
  `, saleId);
  const priceRows = await all(env, `
    SELECT price.id, price.sale_item_id, price.amount_minor, price.currency,
           price.occurred_on, price.occurrence_precision, price.recorded_at
      FROM artist_artwork_price_entries price
      JOIN artist_verified_sale_items item ON item.id = price.sale_item_id
     WHERE item.sale_id = ?1
     ORDER BY price.sale_item_id, price.recorded_at, price.id
  `, saleId);
  const ledgerRows = await all(env, `
    SELECT entry.id, entry.artwork_record_id, entry.message, entry.media_id, entry.created_at,
           media.media_role, media.content_type, media.byte_length
      FROM artist_artwork_ledger_entries entry
      LEFT JOIN artist_artwork_media media ON media.id = entry.media_id
     WHERE entry.sale_id = ?1
     ORDER BY entry.artwork_record_id, entry.created_at, entry.id
  `, saleId);
  const pricesByItem = new Map();
  for (const price of priceRows) {
    const entries = pricesByItem.get(price.sale_item_id) || [];
    entries.push({
      priceEntryId: price.id,
      amountMinor: Number(price.amount_minor),
      currency: price.currency,
      occurrence: { precision: price.occurrence_precision, value: price.occurred_on },
      recordedAt: price.recorded_at,
    });
    pricesByItem.set(price.sale_item_id, entries);
  }
  const ledgerByArtwork = new Map();
  for (const entry of ledgerRows) {
    const entries = ledgerByArtwork.get(entry.artwork_record_id) || [];
    entries.push({
      ledgerEntryId: entry.id, message: entry.message, mediaId: entry.media_id,
      createdAt: entry.created_at,
      media: entry.media_id ? {
        mediaRole: entry.media_role, contentType: entry.content_type,
        byteLength: Number(entry.byte_length),
      } : null,
    });
    ledgerByArtwork.set(entry.artwork_record_id, entries);
  }
  const items = itemRows.map((row) => ({
      saleItemId: row.item_id, artworkRecordId: row.artwork_record_id,
      artworkId: row.artwork_id, edition: editionFromJson(row.edition_json),
      keeperPieceId: row.keeper_piece_id, identificationStatus: row.identification_status,
      recordVersion: Number(row.record_version),
      price: row.amount_minor == null ? null
        : { amountMinor: Number(row.amount_minor), currency: row.currency },
      priceEntries: pricesByItem.get(row.item_id) || [],
      ledgerEntries: ledgerByArtwork.get(row.artwork_record_id) || [],
    }));
  return {
    sale: effectiveSale, originalSale, effectiveSale, corrections, items, events,
  };
}

export async function listArtistSaleWorkspace(env, rawFilters = {}) {
  if (!env?.DB || !exactKeys(rawFilters, [], [
    'caseStatus', 'search', 'identificationStatus', 'limit', 'offset',
  ])) {
    throw codedError('invalid_request');
  }
  const limit = rawFilters.limit === undefined ? 25 : rawFilters.limit;
  const offset = rawFilters.offset === undefined ? 0 : rawFilters.offset;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50
    || !Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000) {
    throw codedError('invalid_request');
  }
  const filters = {
    caseStatus: rawFilters.caseStatus === undefined ? null : normalizedText(rawFilters.caseStatus, 30),
    search: rawFilters.search === undefined ? null
      : normalizedText(rawFilters.search, LIMITS.search).toLowerCase(),
    identificationStatus: rawFilters.identificationStatus === undefined ? null
      : normalizedText(rawFilters.identificationStatus, 30),
  };
  if (filters.caseStatus && !CASE_STATUSES.includes(filters.caseStatus)) throw codedError('invalid_request');
  if (filters.identificationStatus && !IDENTIFICATION_STATUSES.has(filters.identificationStatus)) {
    throw codedError('invalid_request');
  }
  const searchPattern = filters.search ? `%${filters.search}%` : null;
  const pageSize = limit + 1;
  const saleRows = await all(env, `
    WITH ranked_events AS (
      SELECT sale_id, sequence, after_json,
             ROW_NUMBER() OVER (
               PARTITION BY sale_id ORDER BY sequence DESC, id DESC
             ) AS event_rank
        FROM artist_verified_sale_events
    )
    SELECT sale.id, sale.reconnection_case_id, sale.occurrence_precision,
           sale.occurred_on, sale.buyer_email, sale.currency, sale.total_minor,
           sale.private_reference, sale.private_notes, sale.verified_by_user_id,
           sale.recorded_at, latest.sequence AS latest_sequence,
           latest.after_json AS latest_after_json
      FROM artist_verified_sales sale
      LEFT JOIN ranked_events latest
        ON latest.sale_id = sale.id AND latest.event_rank = 1
     WHERE (
       ?1 IS NULL
       OR lower(
         sale.id || char(10)
         || coalesce(CASE WHEN latest.sequence IS NULL THEN sale.buyer_email
              ELSE json_extract(latest.after_json, '$.buyerEmail') END, '') || char(10)
         || coalesce(CASE WHEN latest.sequence IS NULL THEN sale.private_reference
              ELSE json_extract(latest.after_json, '$.privateReference') END, '') || char(10)
         || coalesce(CASE WHEN latest.sequence IS NULL THEN sale.private_notes
              ELSE json_extract(latest.after_json, '$.privateNotes') END, '')
       ) LIKE ?2
     )
       AND (
         ?3 IS NULL OR EXISTS (
           SELECT 1
             FROM artist_verified_sale_items filtered_item
             JOIN artist_artwork_records filtered_record
               ON filtered_record.id = filtered_item.artwork_record_id
            WHERE filtered_item.sale_id = sale.id
              AND filtered_record.identification_status = ?3
         )
       )
     ORDER BY sale.recorded_at DESC, sale.id DESC
     LIMIT ?4 OFFSET ?5
  `, filters.search, searchPattern, filters.identificationStatus, pageSize, offset);
  const saleHasMore = saleRows.length > limit;
  const salePageRows = saleRows.slice(0, limit);
  const saleIds = salePageRows.map((row) => row.id);
  const statusesBySale = new Map(saleIds.map((id) => [id, []]));
  if (saleIds.length > 0) {
    const placeholders = saleIds.map((_, index) => `?${index + 1}`).join(', ');
    const statusRows = await all(env, `
      SELECT item.sale_id, record.identification_status
        FROM artist_verified_sale_items item
        JOIN artist_artwork_records record ON record.id = item.artwork_record_id
       WHERE item.sale_id IN (${placeholders})
       ORDER BY item.sale_id, item.created_at, item.id
    `, ...saleIds);
    for (const row of statusRows) statusesBySale.get(row.sale_id)?.push(row.identification_status);
  }
  const sales = salePageRows.map((row) => {
    const sequence = row.latest_sequence == null ? 0 : Number(row.latest_sequence);
    const snapshot = row.latest_after_json
      ? JSON.parse(row.latest_after_json)
      : baseSaleSnapshot(row);
    return {
      ...publicSale(snapshot, row.id, sequence),
      identificationStatuses: statusesBySale.get(row.id) || [],
    };
  });
  const caseRows = await all(env, `
    WITH ranked_status AS (
      SELECT reconnection_case_id, private_note,
             ROW_NUMBER() OVER (
               PARTITION BY reconnection_case_id
               ORDER BY CASE private_note
                 WHEN 'closed' THEN 3 WHEN 'resolved' THEN 2
                 WHEN 'partially_resolved' THEN 1 ELSE 0 END DESC,
                 created_at DESC, id DESC
             ) AS status_rank
        FROM artist_reconnection_events
       WHERE event_type = 'status_changed'
    )
    SELECT reconnect.id, reconnect.recipient_email, reconnect.recipient_name,
           reconnect.private_context, reconnect.created_at,
           coalesce(latest.private_note, reconnect.status) AS effective_status
      FROM artist_reconnection_cases reconnect
      LEFT JOIN ranked_status latest
        ON latest.reconnection_case_id = reconnect.id AND latest.status_rank = 1
     WHERE (?1 IS NULL OR coalesce(latest.private_note, reconnect.status) = ?1)
       AND (
         ?2 IS NULL
         OR lower(
           reconnect.id || char(10) || reconnect.recipient_email || char(10)
           || coalesce(reconnect.recipient_name, '') || char(10)
           || coalesce(reconnect.private_context, '')
         ) LIKE ?3
       )
     ORDER BY reconnect.created_at DESC, reconnect.id DESC
     LIMIT ?4 OFFSET ?5
  `, filters.caseStatus, filters.search, searchPattern, pageSize, offset);
  const caseHasMore = caseRows.length > limit;
  const reconnectionCases = caseRows.slice(0, limit).map((row) => ({
      reconnectionCaseId: row.id, recipientEmail: row.recipient_email,
      recipientName: row.recipient_name, privateContext: row.private_context,
      status: row.effective_status, createdAt: row.created_at,
    }));
  const artworkRecordRows = await all(env, `
    SELECT record.id, record.artwork_id, record.edition_json,
           record.identification_status, piece.public_code
      FROM artist_artwork_records record
      LEFT JOIN keeper_pieces piece ON piece.id = record.keeper_piece_id
     WHERE record.identification_status IN ('identified', 'identity_linked')
     ORDER BY CASE WHEN record.identification_status = 'identity_linked' THEN 0 ELSE 1 END,
              record.updated_at DESC, record.id DESC
     LIMIT ?1 OFFSET ?2
  `, pageSize, offset);
  const artworkRecordsHaveMore = artworkRecordRows.length > limit;
  const artworkRecords = artworkRecordRows.slice(0, limit).map((row) => ({
    artworkRecordId: row.id,
    artworkId: row.artwork_id,
    edition: editionFromJson(row.edition_json),
    identificationStatus: row.identification_status,
    publicCode: row.public_code,
  }));
  return {
    sales,
    reconnectionCases,
    artworkRecords,
    pagination: {
      limit,
      offset,
      sales: { hasMore: saleHasMore, nextOffset: saleHasMore ? offset + limit : null },
      reconnectionCases: {
        hasMore: caseHasMore,
        nextOffset: caseHasMore ? offset + limit : null,
      },
      artworkRecords: {
        hasMore: artworkRecordsHaveMore,
        nextOffset: artworkRecordsHaveMore ? offset + limit : null,
      },
    },
  };
}
