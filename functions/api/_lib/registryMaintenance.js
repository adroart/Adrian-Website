export const MAINTENANCE_REASON_MAX = 500;
export const MAINTENANCE_IDEMPOTENCY_KEY_MAX = 128;

const ACQUISITION_TYPES = new Set([
  'sale',
  'gift',
  'retained',
  'loan',
  'consignment',
  'inheritance',
  'other',
]);

const ACQUISITION_FIELDS = new Set([
  'acquisitionType',
  'acquiredAt',
  'amountMinor',
  'currency',
  'acquirerReference',
  'privateNotes',
  'documentReference',
  'publicProvenance',
]);

const TEXT_LIMITS = {
  acquirerReference: 200,
  privateNotes: 5000,
  documentReference: 1000,
  publicProvenance: 2000,
};

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPlainRecord(value) {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalValue(value, seen) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonical_json_invalid');
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object') throw new Error('canonical_json_invalid');
  if (seen.has(value)) throw new Error('canonical_json_invalid');
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry, seen));
    if (!isPlainRecord(value)) throw new Error('canonical_json_invalid');
    const result = Object.create(null);
    for (const key of Object.keys(value).sort()) {
      result[key] = canonicalValue(value[key], seen);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

function normalizeAcquiredAt(value) {
  const input = typeof value === 'string' ? value.trim() : '';
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2}))?$/.exec(input);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) {
    return null;
  }
  if (hourText !== undefined) {
    const offset = zone === 'Z' ? null : zone.slice(1).split(':').map(Number);
    if (Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59
      || (offset && (offset[0] > 23 || offset[1] > 59))) {
      return null;
    }
  }

  const date = new Date(hourText === undefined ? `${input}T00:00:00.000Z` : input);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Stable JSON for maintenance snapshots. Object keys are recursively sorted. */
export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value, new Set()));
}

export const canonicalMaintenanceJson = canonicalJson;

export function normalizeMaintenanceReason(value) {
  const reason = typeof value === 'string' ? value.trim() : '';
  if (!reason) return { ok: false, error: 'reason_required' };
  if (reason.length > MAINTENANCE_REASON_MAX) {
    return { ok: false, error: 'reason_too_long' };
  }
  return { ok: true, reason };
}

export const normalizeReason = normalizeMaintenanceReason;

function optionalText(input, field) {
  const value = input[field];
  if (value === undefined || value === null || value === '') return { value: null };
  if (typeof value !== 'string') return { error: `${field}_invalid` };
  const normalized = value.trim();
  if (!normalized) return { value: null };
  if (normalized.length > TEXT_LIMITS[field]) {
    return { error: `${field.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`)}_too_long` };
  }
  return { value: normalized };
}

export function normalizeAcquisitionInput(input) {
  if (!isPlainRecord(input)) return { ok: false, error: 'invalid_input' };
  if (Object.keys(input).some((key) => !ACQUISITION_FIELDS.has(key))) {
    return { ok: false, error: 'unknown_field' };
  }

  const acquisitionType = typeof input.acquisitionType === 'string'
    ? input.acquisitionType.trim().toLowerCase()
    : '';
  if (!ACQUISITION_TYPES.has(acquisitionType)) {
    return { ok: false, error: 'invalid_acquisition_type' };
  }

  const acquiredAtProvided = input.acquiredAt !== undefined
    && input.acquiredAt !== null
    && input.acquiredAt !== '';
  const acquiredAt = acquiredAtProvided ? normalizeAcquiredAt(input.acquiredAt) : null;
  if (acquiredAtProvided && !acquiredAt) {
    return { ok: false, error: 'invalid_acquired_at' };
  }

  const amountProvided = input.amountMinor !== undefined && input.amountMinor !== null;
  const currencyValue = typeof input.currency === 'string' ? input.currency.trim() : input.currency;
  const currencyProvided = currencyValue !== undefined && currencyValue !== null && currencyValue !== '';
  if (amountProvided && !currencyProvided) return { ok: false, error: 'currency_required' };
  if (!amountProvided && currencyProvided) return { ok: false, error: 'amount_required' };

  let amountMinor = null;
  let currency = null;
  if (amountProvided) {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 0) {
      return { ok: false, error: 'invalid_amount' };
    }
    amountMinor = input.amountMinor;
    currency = typeof currencyValue === 'string' ? currencyValue.toUpperCase() : '';
    if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'invalid_currency' };
  }

  const normalizedText = {};
  for (const field of Object.keys(TEXT_LIMITS)) {
    const result = optionalText(input, field);
    if (result.error) return { ok: false, error: result.error };
    normalizedText[field] = result.value;
  }

  return {
    ok: true,
    acquisition: {
      acquisitionType,
      acquiredAt,
      amountMinor,
      currency,
      ...normalizedText,
    },
  };
}

function normalizeIdempotencyKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!key || key.length > MAINTENANCE_IDEMPOTENCY_KEY_MAX) {
    throw new Error('invalid_idempotency_key');
  }
  return key;
}

function normalizedAdministrator(authorization) {
  const userId = typeof authorization?.userId === 'string' ? authorization.userId.trim() : '';
  const email = typeof authorization?.email === 'string'
    ? authorization.email.trim().toLowerCase()
    : '';
  if (!userId || userId.length > 128 || !email || email.length > 254) {
    throw new Error('invalid_administrator_identity');
  }
  return { userId, email };
}

function normalizeOptionalIdentifier(value, max = 128) {
  if (value === undefined || value === null) return null;
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > max) throw new Error('invalid_maintenance_identifier');
  return normalized;
}

function normalizeEventDetails(details, eventId) {
  const reason = normalizeMaintenanceReason(details?.reason);
  if (!reason.ok) throw new Error(reason.error);
  const idempotencyKey = normalizeIdempotencyKey(details?.idempotencyKey);
  const eventType = typeof details?.eventType === 'string' ? details.eventType.trim() : '';
  if (!/^[a-z][a-z0-9_]{0,79}$/.test(eventType)) throw new Error('invalid_event_type');
  const outcome = details?.outcome;
  if (outcome !== 'succeeded' && outcome !== 'failed') throw new Error('invalid_event_outcome');
  const createdAt = typeof details?.createdAt === 'string' && details.createdAt.trim()
    ? new Date(details.createdAt.trim())
    : new Date();
  if (Number.isNaN(createdAt.getTime())) throw new Error('invalid_created_at');
  return {
    id: eventId ?? `rme-${crypto.randomUUID()}`,
    idempotencyKey,
    eventType,
    keeperPieceId: normalizeOptionalIdentifier(details?.keeperPieceId),
    artworkId: normalizeOptionalIdentifier(details?.artworkId, 80),
    administrator: normalizedAdministrator(details?.authorization),
    reason: reason.reason,
    beforeJson: canonicalJson(details?.before ?? null),
    afterJson: canonicalJson(details?.after ?? null),
    outcome,
    relatedRecordId: normalizeOptionalIdentifier(details?.relatedRecordId),
    createdAt: createdAt.toISOString(),
  };
}

export async function findMaintenanceEventByIdempotencyKey(env, value) {
  const idempotencyKey = normalizeIdempotencyKey(value);
  return env.DB.prepare(
    `SELECT id, idempotency_key, event_type, keeper_piece_id, artwork_id,
            administrator_user_id, administrator_email, reason, before_json,
            after_json, outcome, related_record_id, created_at
       FROM registry_maintenance_events
      WHERE idempotency_key = ?1`,
  ).bind(idempotencyKey).first();
}

export const replayMaintenanceEvent = findMaintenanceEventByIdempotencyKey;

export function classifyMaintenanceIdempotency(existing, expected) {
  if (!existing) return { kind: 'miss' };
  const normalized = normalizeEventDetails(expected, existing.id);
  const exact = existing.idempotency_key === normalized.idempotencyKey
    && existing.event_type === normalized.eventType
    && (existing.keeper_piece_id ?? null) === normalized.keeperPieceId
    && (existing.artwork_id ?? null) === normalized.artworkId
    && existing.administrator_user_id === normalized.administrator.userId
    && existing.administrator_email === normalized.administrator.email
    && existing.reason === normalized.reason
    && existing.before_json === normalized.beforeJson
    && existing.after_json === normalized.afterJson
    && existing.outcome === normalized.outcome
    && (existing.related_record_id ?? null) === normalized.relatedRecordId;
  return exact ? { kind: 'replay', event: existing } : { kind: 'conflict' };
}

export function buildMaintenanceEventStatement(env, details, options = {}) {
  const normalized = normalizeEventDetails(details, details?.id);
  const guard = options.requirePreviousChange === false ? '1 = 1' : 'changes() = 1';
  return env.DB.prepare(
    `INSERT INTO registry_maintenance_events
       (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
        administrator_user_id, administrator_email, reason, before_json,
        after_json, outcome, related_record_id, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13
      WHERE ${guard}`,
  ).bind(
    normalized.id,
    normalized.idempotencyKey,
    normalized.eventType,
    normalized.keeperPieceId,
    normalized.artworkId,
    normalized.administrator.userId,
    normalized.administrator.email,
    normalized.reason,
    normalized.beforeJson,
    normalized.afterJson,
    normalized.outcome,
    normalized.relatedRecordId,
    normalized.createdAt,
  );
}

/**
 * Run one optimistic mutation and its succeeded/failed maintenance event in a
 * single D1 batch. The caller builds the mutation only after this helper
 * validates and supplies its expected record_version. The event SELECT sees
 * SQLite changes() from that mutation, so a zero-row conflict cannot append a
 * success event.
 */
export async function commitMaintenanceMutation(env, {
  buildMutation,
  event,
  expectedVersion,
}) {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    return { ok: false, error: 'invalid_expected_version' };
  }
  if (typeof env?.DB?.batch !== 'function') {
    return { ok: false, error: 'atomic_write_unavailable' };
  }

  let mutationStatement;
  try {
    mutationStatement = buildMutation(expectedVersion);
  } catch {
    return { ok: false, error: 'invalid_versioned_mutation' };
  }
  if (!mutationStatement) return { ok: false, error: 'invalid_versioned_mutation' };

  const eventId = event?.id ?? `rme-${crypto.randomUUID()}`;
  let eventStatement;
  try {
    eventStatement = buildMaintenanceEventStatement(env, { ...event, id: eventId });
  } catch {
    return { ok: false, error: 'invalid_maintenance_event' };
  }

  try {
    const [mutationResult, eventResult] = await env.DB.batch([
      mutationStatement,
      eventStatement,
    ]);
    const mutationChanges = mutationResult?.meta?.changes;
    const eventChanges = eventResult?.meta?.changes;
    if (mutationResult?.success !== true || eventResult?.success !== true) {
      return { ok: false, error: 'maintenance_write_failed' };
    }
    if (mutationChanges !== 1) return { ok: false, error: 'version_conflict' };
    if (eventChanges !== 1) return { ok: false, error: 'maintenance_write_failed' };
    return { ok: true, eventId };
  } catch {
    return { ok: false, error: 'maintenance_write_failed' };
  }
}
