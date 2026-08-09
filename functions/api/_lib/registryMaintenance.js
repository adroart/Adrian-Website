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

const PROVENANCE_TYPES = new Set([
  'contributor', 'creation_place', 'intention', 'material', 'technique', 'note',
]);
const PROVENANCE_VISIBILITIES = new Set(['private', 'steward', 'public']);
const PROVENANCE_FIELDS = new Set([
  'entryType', 'title', 'detail', 'role', 'occurredAt', 'visibility',
]);

const stringOrNull = (value) => value === null || typeof value === 'string';
const stringValue = (value) => typeof value === 'string';
const nonnegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const amountOrNull = (value) => value === null || nonnegativeInteger(value);

const MAINTENANCE_TARGETS = {
  keeper_record: {
    table: 'keeper_pieces',
    versionColumn: 'record_version',
    fields: {
      pieceId: ['piece_id', stringValue],
      editionNumber: ['edition_number', nonnegativeInteger],
      plateStatus: ['plate_status', stringValue],
      supersededByKeeperPieceId: ['superseded_by_keeper_piece_id', stringOrNull],
      physicalDisposition: ['physical_disposition', stringOrNull],
    },
  },
  keeper_steward: {
    table: 'keeper_pieces',
    versionColumn: 'steward_version',
    fields: {
      keeperUserId: ['keeper_user_id', stringOrNull],
      claimedAt: ['claimed_at', stringOrNull],
      releasedAt: ['released_at', stringOrNull],
      currentDisplayLocation: ['current_display_location', stringOrNull],
    },
  },
  acquisition: {
    table: 'artwork_acquisitions',
    versionColumn: 'record_version',
    fields: {
      acquisitionType: ['acquisition_type', stringValue],
      acquiredAt: ['acquired_at', stringOrNull],
      amountMinor: ['amount_minor', amountOrNull],
      currency: ['currency', stringOrNull],
      acquirerReference: ['acquirer_reference', stringOrNull],
      privateNotes: ['private_notes', stringOrNull],
      documentReference: ['document_reference', stringOrNull],
      publicProvenance: ['public_provenance', stringOrNull],
      updatedAt: ['updated_at', stringValue],
    },
  },
  provenance: {
    table: 'artwork_provenance_entries',
    versionColumn: 'record_version',
    fields: {
      entryType: ['entry_type', stringValue],
      title: ['title', stringValue],
      detail: ['detail', stringOrNull],
      role: ['role', stringOrNull],
      occurredAt: ['occurred_at', stringOrNull],
      visibility: ['visibility', stringValue],
      updatedAt: ['updated_at', stringValue],
      removedAt: ['removed_at', stringOrNull],
    },
  },
};

const ACQUISITION_UPDATE_SNAPSHOT_FIELDS = [
  'acquisitionId', 'keeperPieceId', 'acquisitionType', 'acquiredAt', 'amountMinor', 'currency',
  'acquirerReference', 'privateNotes', 'documentReference', 'publicProvenance',
  'recordVersion', 'updatedAt',
];
const EVENT_SNAPSHOT_FIELDS = {
  acquisition_created: new Set([...ACQUISITION_UPDATE_SNAPSHOT_FIELDS, 'createdAt']),
  acquisition_corrected: new Set(ACQUISITION_UPDATE_SNAPSHOT_FIELDS),
  steward_reset: new Set([
    'keeperPieceId', 'artworkId', 'keeperUserId', 'claimedAt', 'releasedAt',
    'currentDisplayLocation', 'stewardVersion',
  ]),
  steward_transferred: new Set([
    'keeperPieceId', 'artworkId', 'keeperUserId', 'claimedAt', 'releasedAt',
    'currentDisplayLocation', 'stewardVersion',
  ]),
  link_corrected: new Set([
    'keeperPieceId', 'pieceId', 'editionNumber', 'recordVersion',
  ]),
  plate_voided: new Set([
    'keeperPieceId', 'artworkId', 'plateStatus', 'physicalDisposition', 'recordVersion',
  ]),
  plate_superseded: new Set([
    'keeperPieceId', 'artworkId', 'plateStatus', 'supersededByKeeperPieceId',
    'physicalDisposition', 'recordVersion',
  ]),
  plate_replaced: new Set([
    'keeperPieceId', 'artworkId', 'publicCode', 'plateStatus',
    'supersedesKeeperPieceId', 'supersededByKeeperPieceId', 'replacedAt',
    'recordVersion',
  ]),
  metadata_corrected: new Set([
    'keeperPieceId', 'artworkId', 'pieceId', 'editionNumber', 'title', 'metadata',
    'recordVersion',
  ]),
  provenance_created: new Set([
    'provenanceId', 'keeperPieceId', 'entryType', 'title', 'detail', 'role',
    'occurredAt', 'visibility', 'recordVersion', 'createdAt', 'updatedAt', 'removedAt',
  ]),
  provenance_corrected: new Set([
    'provenanceId', 'keeperPieceId', 'entryType', 'title', 'detail', 'role',
    'occurredAt', 'visibility', 'recordVersion', 'createdAt', 'updatedAt', 'removedAt',
  ]),
  provenance_removed: new Set([
    'provenanceId', 'keeperPieceId', 'entryType', 'title', 'detail', 'role',
    'occurredAt', 'visibility', 'recordVersion', 'createdAt', 'updatedAt', 'removedAt',
  ]),
  recovery_qualification_recorded: new Set([
    'id', 'keeperPieceId', 'qualification', 'qualifiedAt', 'schemaVersion',
    'buildVersion', 'keyVersion', 'generatorVersion', 'notes', 'recordVersion',
  ]),
};

const SENSITIVE_SNAPSHOT_KEY_PARTS = [
  'ownershipcode', 'recoverycode', 'ciphertext', 'nonce', 'verifier',
  'secret', 'token', 'password',
];

const EVENT_MUTATION_POLICIES = {
  acquisition_corrected: {
    targetType: 'acquisition',
    mutableFields: new Set(Object.keys(MAINTENANCE_TARGETS.acquisition.fields)),
    identityFields: ['acquisitionId', 'keeperPieceId', 'recordVersion'],
    versionField: 'recordVersion',
  },
  steward_reset: {
    targetType: 'keeper_steward',
    mutableFields: new Set(Object.keys(MAINTENANCE_TARGETS.keeper_steward.fields)),
    identityFields: ['keeperPieceId', 'artworkId', 'stewardVersion'],
    versionField: 'stewardVersion',
    guardArtwork: true,
  },
  steward_transferred: {
    targetType: 'keeper_steward',
    mutableFields: new Set(Object.keys(MAINTENANCE_TARGETS.keeper_steward.fields)),
    identityFields: ['keeperPieceId', 'artworkId', 'stewardVersion'],
    versionField: 'stewardVersion',
    guardArtwork: true,
  },
  link_corrected: {
    targetType: 'keeper_record',
    mutableFields: new Set(['pieceId', 'editionNumber']),
    identityFields: ['keeperPieceId', 'recordVersion'],
    versionField: 'recordVersion',
    correctedLink: true,
  },
  plate_voided: {
    targetType: 'keeper_record',
    mutableFields: new Set(['plateStatus', 'physicalDisposition']),
    identityFields: ['keeperPieceId', 'artworkId', 'recordVersion'],
    versionField: 'recordVersion',
    guardArtwork: true,
  },
  plate_superseded: {
    targetType: 'keeper_record',
    mutableFields: new Set([
      'plateStatus', 'supersededByKeeperPieceId', 'physicalDisposition',
    ]),
    identityFields: ['keeperPieceId', 'artworkId', 'recordVersion'],
    versionField: 'recordVersion',
    guardArtwork: true,
  },
  provenance_corrected: {
    targetType: 'provenance',
    mutableFields: new Set([
      'entryType', 'title', 'detail', 'role', 'occurredAt', 'visibility',
      'updatedAt', 'removedAt',
    ]),
    identityFields: ['provenanceId', 'keeperPieceId', 'recordVersion'],
    versionField: 'recordVersion',
  },
  provenance_removed: {
    targetType: 'provenance',
    mutableFields: new Set(['updatedAt', 'removedAt']),
    identityFields: ['provenanceId', 'keeperPieceId', 'recordVersion'],
    versionField: 'recordVersion',
  },
};

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPlainRecord(value) {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function containsSensitiveSnapshotKey(value, seen = new Set()) {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.some((entry) => containsSensitiveSnapshotKey(entry, seen));
    }
    for (const [key, entry] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (SENSITIVE_SNAPSHOT_KEY_PARTS.some((part) => normalizedKey.includes(part))) {
        return true;
      }
      if (containsSensitiveSnapshotKey(entry, seen)) return true;
    }
    return false;
  } finally {
    seen.delete(value);
  }
}

function normalizeEventSnapshot(eventType, value) {
  if (value === undefined || value === null) return null;
  if (!isPlainRecord(value) || containsSensitiveSnapshotKey(value)) {
    throw new Error('invalid_snapshot');
  }
  const allowedFields = Object.hasOwn(EVENT_SNAPSHOT_FIELDS, eventType)
    ? EVENT_SNAPSHOT_FIELDS[eventType]
    : null;
  if (!allowedFields || Object.keys(value).some((key) => !allowedFields.has(key))) {
    throw new Error('invalid_snapshot');
  }
  return value;
}

/**
 * Safely project stored history snapshots through the same write-time policy.
 * Legacy or directly inserted rows fail closed without hiding safe event metadata.
 */
export function projectMaintenanceHistorySnapshots(eventType, beforeJson, afterJson) {
  try {
    if (!Object.hasOwn(EVENT_SNAPSHOT_FIELDS, eventType)
      || typeof beforeJson !== 'string'
      || typeof afterJson !== 'string') {
      throw new Error('invalid_snapshot');
    }
    return {
      before: normalizeEventSnapshot(eventType, JSON.parse(beforeJson)),
      after: normalizeEventSnapshot(eventType, JSON.parse(afterJson)),
    };
  } catch {
    return {
      before: null,
      after: null,
      warning: 'unsafe_snapshots_redacted',
    };
  }
}

function normalizeMaintenanceTarget(target, changes) {
  if (!isPlainRecord(target)
    || typeof target.id !== 'string'
    || !target.id.trim()
    || target.id.trim().length > 128
    || !isPlainRecord(changes)
    || Object.keys(changes).length === 0) {
    return null;
  }
  const definition = Object.hasOwn(MAINTENANCE_TARGETS, target.type)
    ? MAINTENANCE_TARGETS[target.type]
    : null;
  if (!definition) return null;

  const associatedTarget = target.type === 'acquisition' || target.type === 'provenance';
  const targetFields = associatedTarget
    ? new Set(['type', 'id', 'keeperPieceId'])
    : new Set(['type', 'id', 'artworkId']);
  if (Object.keys(target).some((key) => !targetFields.has(key))) return null;
  const keeperPieceId = associatedTarget
    && typeof target.keeperPieceId === 'string'
    && target.keeperPieceId.trim()
    && target.keeperPieceId.trim().length <= 128
    ? target.keeperPieceId.trim()
    : null;
  if (associatedTarget && !keeperPieceId) return null;
  const artworkId = !associatedTarget
    && typeof target.artworkId === 'string'
    && target.artworkId.trim()
    && target.artworkId.trim().length <= 80
    ? target.artworkId.trim()
    : null;
  if (!associatedTarget && !artworkId) return null;

  const assignments = [];
  const values = [];
  const normalizedChanges = Object.create(null);
  for (const [field, value] of Object.entries(changes)) {
    const mapping = Object.hasOwn(definition.fields, field) ? definition.fields[field] : null;
    if (!mapping || !mapping[1](value)) return null;
    assignments.push(mapping[0]);
    values.push(value);
    normalizedChanges[field] = value;
  }
  return {
    targetType: target.type,
    definition,
    id: target.id.trim(),
    keeperPieceId,
    artworkId,
    assignments,
    values,
    changes: normalizedChanges,
  };
}

function sameKeys(left, right) {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(right);
  return left.every((key) => rightKeys.has(key));
}

function normalizedComparableIdentifier(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validateEventMutation(normalizedTarget, event, expectedVersion) {
  const eventType = typeof event?.eventType === 'string' ? event.eventType.trim() : '';
  const policy = Object.hasOwn(EVENT_MUTATION_POLICIES, eventType)
    ? EVENT_MUTATION_POLICIES[eventType]
    : null;
  if (!policy || policy.targetType !== normalizedTarget.targetType || event?.outcome !== 'succeeded') {
    return null;
  }

  const changeKeys = Object.keys(normalizedTarget.changes);
  if (changeKeys.some((key) => !policy.mutableFields.has(key))) return null;

  const before = normalizeEventSnapshot(eventType, event?.before);
  const after = normalizeEventSnapshot(eventType, event?.after);
  if (!isPlainRecord(before) || !isPlainRecord(after)) return null;

  const expectedSnapshotKeys = [...policy.identityFields, ...changeKeys];
  if (!sameKeys(Object.keys(before), expectedSnapshotKeys)
    || !sameKeys(Object.keys(after), expectedSnapshotKeys)) {
    return null;
  }

  const associatedTarget = normalizedTarget.targetType === 'acquisition'
    || normalizedTarget.targetType === 'provenance';
  const expectedKeeperPieceId = associatedTarget
    ? normalizedTarget.keeperPieceId
    : normalizedTarget.id;
  if (normalizedComparableIdentifier(event?.keeperPieceId) !== expectedKeeperPieceId
    || normalizedComparableIdentifier(event?.relatedRecordId) !== normalizedTarget.id
    || before.keeperPieceId !== expectedKeeperPieceId
    || after.keeperPieceId !== expectedKeeperPieceId
    || after[policy.versionField] !== expectedVersion + 1) {
    return null;
  }
  if (normalizedTarget.targetType === 'acquisition'
    && (before.acquisitionId !== normalizedTarget.id
      || after.acquisitionId !== normalizedTarget.id)) {
    return null;
  }
  if (normalizedTarget.targetType === 'provenance'
    && (before.provenanceId !== normalizedTarget.id
      || after.provenanceId !== normalizedTarget.id)) {
    return null;
  }
  if (associatedTarget && event?.artworkId !== null) {
    return null;
  }
  if (policy.correctedLink
    && (!changeKeys.includes('pieceId')
      || normalizedComparableIdentifier(event?.artworkId) !== after.pieceId
      || normalizedTarget.artworkId !== after.pieceId)) {
    return null;
  }
  if (policy.guardArtwork
    && (normalizedComparableIdentifier(event?.artworkId) !== normalizedTarget.artworkId
      || before.artworkId !== normalizedTarget.artworkId
      || after.artworkId !== normalizedTarget.artworkId)) {
    return null;
  }

  for (const key of changeKeys) {
    if (canonicalJson(after[key]) !== canonicalJson(normalizedTarget.changes[key])) return null;
  }
  if (before[policy.versionField] !== expectedVersion) {
    return { error: 'version_conflict' };
  }
  return {
    eventType,
    before,
    after,
    beforeValues: changeKeys.map((key) => before[key]),
    contextGuard: associatedTarget
      ? { column: 'keeper_piece_id', operator: '=', value: normalizedTarget.keeperPieceId }
      : policy.guardArtwork
        ? { column: 'piece_id', operator: 'IS', value: normalizedTarget.artworkId }
        : null,
  };
}

function buildVersionedMutationStatement(
  env,
  normalized,
  expectedVersion,
  beforeValues,
  contextGuard,
) {
  const { definition, id, assignments, values } = normalized;
  const setClauses = assignments.map((column, index) => `${column} = ?${index + 1}`);
  const idPosition = values.length + 1;
  const versionPosition = values.length + 2;
  const contextPosition = contextGuard
    ? values.length + 3
    : null;
  const beforeStartPosition = values.length + (contextPosition === null ? 3 : 4);
  const priorValueClauses = assignments.map(
    (column, index) => `${column} IS ?${beforeStartPosition + index}`,
  );
  const contextClause = contextPosition === null
    ? ''
    : ` AND ${contextGuard.column} ${contextGuard.operator} ?${contextPosition}`;
  setClauses.push(`${definition.versionColumn} = ${definition.versionColumn} + 1`);
  return env.DB.prepare(
    `UPDATE ${definition.table}
        SET ${setClauses.join(', ')}
      WHERE id = ?${idPosition} AND ${definition.versionColumn} = ?${versionPosition}${contextClause}
        AND ${priorValueClauses.join(' AND ')}`,
  ).bind(
    ...values,
    id,
    expectedVersion,
    ...(contextPosition === null ? [] : [contextGuard.value]),
    ...beforeValues,
  );
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

export async function maintenanceMutationFingerprint(value) {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fingerprintValidatedMaintenanceMutation(
  normalizedTarget,
  validatedEvent,
  expectedVersion,
) {
  return maintenanceMutationFingerprint({
    target: {
      type: normalizedTarget.targetType,
      keeperPieceId: normalizedTarget.keeperPieceId,
      artworkId: normalizedTarget.artworkId,
    },
    id: normalizedTarget.id,
    expectedVersion,
    changes: normalizedTarget.changes,
    eventType: validatedEvent.eventType,
    before: validatedEvent.before,
    after: validatedEvent.after,
  });
}

/** Verify that a stored fingerprint represents the exact validated mutation. */
export async function matchesMaintenanceMutationFingerprint(existing, {
  target,
  changes,
  event,
  expectedVersion,
}) {
  if (!existing || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0) return false;
  const normalizedTarget = normalizeMaintenanceTarget(target, changes);
  if (!normalizedTarget) return false;
  try {
    const validatedEvent = validateEventMutation(normalizedTarget, event, expectedVersion);
    if (!validatedEvent || validatedEvent.error) return false;
    const expected = await fingerprintValidatedMaintenanceMutation(
      normalizedTarget,
      validatedEvent,
      expectedVersion,
    );
    return existing.mutation_fingerprint === expected;
  } catch {
    return false;
  }
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

function normalizeProvenanceOccurredAt(value) {
  if (value === undefined || value === null || value === '') return { value: null };
  if (typeof value !== 'string') return { error: 'invalid_occurred_at' };
  const input = value.trim();
  if (!input) return { value: null };
  if (/^\d{4}$/.test(input)) return { value: input };
  const month = /^(\d{4})-(\d{2})$/.exec(input);
  if (month) {
    const monthNumber = Number(month[2]);
    return monthNumber >= 1 && monthNumber <= 12
      ? { value: input }
      : { error: 'invalid_occurred_at' };
  }
  const full = normalizeAcquiredAt(input);
  if (!full) return { error: 'invalid_occurred_at' };
  return { value: /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : full };
}

export function normalizeProvenanceInput(input) {
  if (!isPlainRecord(input)) return { ok: false, error: 'invalid_input' };
  if (Object.keys(input).some((key) => !PROVENANCE_FIELDS.has(key))) {
    return { ok: false, error: 'unknown_field' };
  }
  const entryType = typeof input.entryType === 'string'
    ? input.entryType.trim().toLowerCase()
    : '';
  if (!PROVENANCE_TYPES.has(entryType)) {
    return { ok: false, error: 'invalid_entry_type' };
  }
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) return { ok: false, error: 'title_required' };
  if (title.length > 300) return { ok: false, error: 'title_too_long' };

  const detail = input.detail === undefined || input.detail === null || input.detail === ''
    ? null
    : typeof input.detail === 'string'
      ? input.detail.trim() || null
      : undefined;
  if (detail === undefined) return { ok: false, error: 'invalid_detail' };
  if (detail !== null && detail.length > 5000) {
    return { ok: false, error: 'detail_too_long' };
  }
  const role = input.role === undefined || input.role === null || input.role === ''
    ? null
    : typeof input.role === 'string'
      ? input.role.trim() || null
      : undefined;
  if (role === undefined) return { ok: false, error: 'invalid_role' };
  if (role !== null && role.length > 300) return { ok: false, error: 'role_too_long' };
  if (entryType === 'contributor' && !role) {
    return { ok: false, error: 'role_required' };
  }

  const occurredAt = normalizeProvenanceOccurredAt(input.occurredAt);
  if (occurredAt.error) return { ok: false, error: occurredAt.error };
  const visibility = typeof input.visibility === 'string'
    ? input.visibility.trim().toLowerCase()
    : '';
  if (!PROVENANCE_VISIBILITIES.has(visibility)) {
    return { ok: false, error: 'invalid_visibility' };
  }
  return {
    ok: true,
    provenance: {
      entryType,
      title,
      detail,
      role,
      occurredAt: occurredAt.value,
      visibility,
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
  if (!Object.hasOwn(EVENT_SNAPSHOT_FIELDS, eventType)) throw new Error('invalid_event_type');
  const outcome = details?.outcome;
  if (outcome !== 'succeeded' && outcome !== 'failed') throw new Error('invalid_event_outcome');
  const mutationFingerprint = typeof details?.mutationFingerprint === 'string'
    ? details.mutationFingerprint.trim()
    : '';
  if (!/^[0-9a-f]{64}$/.test(mutationFingerprint)) {
    throw new Error('invalid_mutation_fingerprint');
  }
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
    beforeJson: canonicalJson(normalizeEventSnapshot(eventType, details?.before)),
    afterJson: canonicalJson(normalizeEventSnapshot(eventType, details?.after)),
    outcome,
    relatedRecordId: normalizeOptionalIdentifier(details?.relatedRecordId),
    mutationFingerprint,
    createdAt: createdAt.toISOString(),
  };
}

export async function findMaintenanceEventByIdempotencyKey(env, value) {
  const idempotencyKey = normalizeIdempotencyKey(value);
  return env.DB.prepare(
    `SELECT id, idempotency_key, event_type, keeper_piece_id, artwork_id,
            administrator_user_id, administrator_email, reason, before_json,
            after_json, outcome, related_record_id, mutation_fingerprint, created_at
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
    && (existing.related_record_id ?? null) === normalized.relatedRecordId
    && existing.mutation_fingerprint === normalized.mutationFingerprint;
  return exact ? { kind: 'replay', event: existing } : { kind: 'conflict' };
}

function prepareMaintenanceEventStatement(env, normalized, options = {}) {
  const guard = options.requirePreviousChange === false ? '1 = 1' : 'changes() = 1';
  return env.DB.prepare(
    `INSERT INTO registry_maintenance_events
       (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
        administrator_user_id, administrator_email, reason, before_json,
        after_json, outcome, related_record_id, mutation_fingerprint, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
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
    normalized.mutationFingerprint,
    normalized.createdAt,
  );
}

export function buildMaintenanceEventStatement(env, details, options = {}) {
  return prepareMaintenanceEventStatement(
    env,
    normalizeEventDetails(details, details?.id),
    options,
  );
}

async function resolveMaintenanceIdempotency(env, event, fallback) {
  try {
    const existing = await findMaintenanceEventByIdempotencyKey(env, event.idempotencyKey);
    const classification = classifyMaintenanceIdempotency(existing, event);
    if (classification.kind === 'replay') {
      return {
        ok: true,
        replayed: true,
        eventId: existing.id,
        event: existing,
      };
    }
    if (classification.kind === 'conflict') {
      return { ok: false, error: 'idempotency_conflict' };
    }
  } catch {
    // Preserve the safe original failure when replay classification is unavailable.
  }
  return fallback;
}

/**
 * Run one optimistic mutation and its succeeded maintenance event in a
 * single D1 batch. Most callers use the generated versioned mutation. A
 * structurally guarded workflow may instead supply a final gateway statement
 * whose database trigger performs and verifies the mutation atomically.
 */
export async function commitMaintenanceMutation(env, {
  target,
  changes,
  event,
  expectedVersion,
  beforeStatements = [],
  afterStatements = [],
  gatewayStatement = null,
}) {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    return { ok: false, error: 'invalid_expected_version' };
  }
  const normalizedTarget = normalizeMaintenanceTarget(target, changes);
  if (!normalizedTarget) return { ok: false, error: 'invalid_maintenance_target' };

  let validatedEvent;
  try {
    validatedEvent = validateEventMutation(normalizedTarget, event, expectedVersion);
  } catch {
    return { ok: false, error: 'invalid_event_mutation' };
  }
  if (!validatedEvent) return { ok: false, error: 'invalid_event_mutation' };
  if (validatedEvent.error) return { ok: false, error: validatedEvent.error };
  if (typeof env?.DB?.batch !== 'function') {
    return { ok: false, error: 'atomic_write_unavailable' };
  }

  const eventId = event?.id ?? `rme-${crypto.randomUUID()}`;
  let boundEvent;
  let mutationStatement;
  let eventStatement;
  try {
    const mutationFingerprint = await fingerprintValidatedMaintenanceMutation(
      normalizedTarget,
      validatedEvent,
      expectedVersion,
    );
    boundEvent = { ...event, id: eventId, mutationFingerprint };
    const normalizedEvent = normalizeEventDetails(boundEvent, eventId);
    if (!gatewayStatement) {
      mutationStatement = buildVersionedMutationStatement(
        env,
        normalizedTarget,
        expectedVersion,
        validatedEvent.beforeValues,
        validatedEvent.contextGuard,
      );
    }
    eventStatement = prepareMaintenanceEventStatement(env, normalizedEvent);
  } catch {
    return { ok: false, error: 'invalid_maintenance_event' };
  }

  try {
    const statements = gatewayStatement
      ? [...beforeStatements, eventStatement, ...afterStatements, gatewayStatement]
      : [...beforeStatements, mutationStatement, eventStatement, ...afterStatements];
    const results = await env.DB.batch(statements);
    const mutationResult = gatewayStatement
      ? results.at(-1)
      : results[beforeStatements.length];
    const eventResult = gatewayStatement
      ? results[beforeStatements.length]
      : results[beforeStatements.length + 1];
    const eventChanges = eventResult?.meta?.changes;
    if (mutationResult?.success !== true || eventResult?.success !== true) {
      return resolveMaintenanceIdempotency(
        env,
        boundEvent,
        { ok: false, error: 'maintenance_write_failed' },
      );
    }
    if (!gatewayStatement && mutationResult?.meta?.changes !== 1) {
      return resolveMaintenanceIdempotency(
        env,
        boundEvent,
        { ok: false, error: 'version_conflict' },
      );
    }
    if (eventChanges !== 1) {
      return resolveMaintenanceIdempotency(
        env,
        boundEvent,
        { ok: false, error: 'maintenance_write_failed' },
      );
    }
    return { ok: true, eventId };
  } catch {
    return resolveMaintenanceIdempotency(
      env,
      boundEvent,
      { ok: false, error: 'maintenance_write_failed' },
    );
  }
}

function normalizeAcquisitionCreateRequest({
  keeperPieceId,
  acquisition,
  authorization,
  reason,
  idempotencyKey,
  acquisitionId,
  eventId,
  createdAt,
}) {
  const normalizedKeeperPieceId = normalizeOptionalIdentifier(keeperPieceId);
  const normalizedInput = normalizeAcquisitionInput(acquisition);
  if (!normalizedInput.ok) return { error: normalizedInput.error };
  const normalizedReason = normalizeMaintenanceReason(reason);
  if (!normalizedReason.ok) return { error: normalizedReason.error };

  let administrator;
  let normalizedIdempotencyKey;
  try {
    administrator = normalizedAdministrator(authorization);
    normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
  } catch (error) {
    return { error: error?.message || 'invalid_acquisition_create' };
  }
  if (!normalizedKeeperPieceId) return { error: 'invalid_maintenance_identifier' };

  const normalizedAcquisitionId = acquisitionId ?? `acq-${crypto.randomUUID()}`;
  const normalizedEventId = eventId ?? `rme-${crypto.randomUUID()}`;
  if (normalizeOptionalIdentifier(normalizedAcquisitionId) !== normalizedAcquisitionId
    || normalizeOptionalIdentifier(normalizedEventId) !== normalizedEventId) {
    return { error: 'invalid_maintenance_identifier' };
  }
  if (createdAt !== undefined && typeof createdAt !== 'string') {
    return { error: 'invalid_created_at' };
  }
  const timestamp = createdAt === undefined ? new Date() : new Date(createdAt);
  if (Number.isNaN(timestamp.getTime())) return { error: 'invalid_created_at' };

  return {
    keeperPieceId: normalizedKeeperPieceId,
    acquisition: normalizedInput.acquisition,
    administrator,
    reason: normalizedReason.reason,
    idempotencyKey: normalizedIdempotencyKey,
    acquisitionId: normalizedAcquisitionId,
    eventId: normalizedEventId,
    createdAt: timestamp.toISOString(),
  };
}

function acquisitionCreateReplay(existing, request, mutationFingerprint) {
  if (!existing) return null;
  const exact = existing.idempotency_key === request.idempotencyKey
    && existing.event_type === 'acquisition_created'
    && existing.keeper_piece_id === request.keeperPieceId
    && existing.artwork_id == null
    && existing.administrator_user_id === request.administrator.userId
    && existing.administrator_email === request.administrator.email
    && existing.reason === request.reason
    && existing.outcome === 'succeeded'
    && existing.mutation_fingerprint === mutationFingerprint;
  if (!exact) return { ok: false, error: 'idempotency_conflict' };
  try {
    const acquisition = JSON.parse(existing.after_json);
    normalizeEventSnapshot('acquisition_created', acquisition);
    if (acquisition?.keeperPieceId !== request.keeperPieceId
      || acquisition?.acquisitionId !== existing.related_record_id) {
      return { ok: false, error: 'maintenance_write_failed' };
    }
    return {
      ok: true,
      replayed: true,
      eventId: existing.id,
      acquisition,
    };
  } catch {
    return { ok: false, error: 'maintenance_write_failed' };
  }
}

async function resolveAcquisitionCreateReplay(env, request, mutationFingerprint, fallback) {
  try {
    const existing = await findMaintenanceEventByIdempotencyKey(env, request.idempotencyKey);
    return acquisitionCreateReplay(existing, request, mutationFingerprint) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Atomically create one acquisition and its append-only maintenance event. */
export async function commitAcquisitionCreate(env, input) {
  const allowedFields = new Set([
    'keeperPieceId', 'acquisition', 'authorization', 'reason', 'idempotencyKey',
    'acquisitionId', 'eventId', 'createdAt',
  ]);
  if (!isPlainRecord(input) || Object.keys(input).some((key) => !allowedFields.has(key))) {
    return { ok: false, error: 'invalid_acquisition_create' };
  }
  let request;
  try {
    request = normalizeAcquisitionCreateRequest(input || {});
  } catch {
    return { ok: false, error: 'invalid_acquisition_create' };
  }
  if (request.error) return { ok: false, error: request.error };
  if (typeof env?.DB?.batch !== 'function') {
    return { ok: false, error: 'atomic_write_unavailable' };
  }

  const mutationFingerprint = await maintenanceMutationFingerprint({
    operation: 'acquisition_create',
    keeperPieceId: request.keeperPieceId,
    acquisition: request.acquisition,
  });
  const existingReplay = await resolveAcquisitionCreateReplay(
    env,
    request,
    mutationFingerprint,
    null,
  );
  if (existingReplay) return existingReplay;

  const acquisition = {
    acquisitionId: request.acquisitionId,
    keeperPieceId: request.keeperPieceId,
    ...request.acquisition,
    recordVersion: 1,
    createdAt: request.createdAt,
    updatedAt: request.createdAt,
  };
  const event = {
    id: request.eventId,
    idempotencyKey: request.idempotencyKey,
    eventType: 'acquisition_created',
    keeperPieceId: request.keeperPieceId,
    artworkId: null,
    authorization: request.administrator,
    reason: request.reason,
    before: null,
    after: acquisition,
    outcome: 'succeeded',
    relatedRecordId: request.acquisitionId,
    mutationFingerprint,
    createdAt: request.createdAt,
  };

  let acquisitionStatement;
  let eventStatement;
  try {
    acquisitionStatement = env.DB.prepare(
      `INSERT INTO artwork_acquisitions
         (id, keeper_piece_id, acquisition_type, acquired_at, amount_minor,
          currency, acquirer_reference, private_notes, document_reference,
          public_provenance, record_version, created_at, updated_at)
       SELECT ?1, id, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, ?11
         FROM keeper_pieces
        WHERE id = ?2`,
    ).bind(
      request.acquisitionId,
      request.keeperPieceId,
      request.acquisition.acquisitionType,
      request.acquisition.acquiredAt,
      request.acquisition.amountMinor,
      request.acquisition.currency,
      request.acquisition.acquirerReference,
      request.acquisition.privateNotes,
      request.acquisition.documentReference,
      request.acquisition.publicProvenance,
      request.createdAt,
    );
    eventStatement = prepareMaintenanceEventStatement(
      env,
      normalizeEventDetails(event, request.eventId),
    );
  } catch {
    return { ok: false, error: 'invalid_maintenance_event' };
  }

  try {
    const [acquisitionResult, eventResult] = await env.DB.batch([
      acquisitionStatement,
      eventStatement,
    ]);
    if (acquisitionResult?.success !== true || eventResult?.success !== true) {
      return resolveAcquisitionCreateReplay(
        env, request, mutationFingerprint, { ok: false, error: 'maintenance_write_failed' },
      );
    }
    if (acquisitionResult?.meta?.changes !== 1) {
      return resolveAcquisitionCreateReplay(
        env, request, mutationFingerprint, { ok: false, error: 'keeper_piece_not_found' },
      );
    }
    if (eventResult?.meta?.changes !== 1) {
      return resolveAcquisitionCreateReplay(
        env, request, mutationFingerprint, { ok: false, error: 'maintenance_write_failed' },
      );
    }
    return { ok: true, replayed: false, eventId: request.eventId, acquisition };
  } catch {
    return resolveAcquisitionCreateReplay(
      env, request, mutationFingerprint, { ok: false, error: 'maintenance_write_failed' },
    );
  }
}

function normalizeProvenanceCreateRequest({
  keeperPieceId,
  provenance,
  authorization,
  reason,
  idempotencyKey,
  provenanceId,
  eventId,
  createdAt,
}) {
  const normalizedKeeperPieceId = normalizeOptionalIdentifier(keeperPieceId);
  const normalizedInput = normalizeProvenanceInput(provenance);
  if (!normalizedInput.ok) return { error: normalizedInput.error };
  const normalizedReason = normalizeMaintenanceReason(reason);
  if (!normalizedReason.ok) return { error: normalizedReason.error };

  let administrator;
  let normalizedIdempotencyKey;
  try {
    administrator = normalizedAdministrator(authorization);
    normalizedIdempotencyKey = normalizeIdempotencyKey(idempotencyKey);
  } catch (error) {
    return { error: error?.message || 'invalid_provenance_create' };
  }
  if (!normalizedKeeperPieceId) return { error: 'invalid_maintenance_identifier' };
  const normalizedProvenanceId = provenanceId ?? `prov-${crypto.randomUUID()}`;
  const normalizedEventId = eventId ?? `rme-${crypto.randomUUID()}`;
  if (normalizeOptionalIdentifier(normalizedProvenanceId) !== normalizedProvenanceId
    || normalizeOptionalIdentifier(normalizedEventId) !== normalizedEventId) {
    return { error: 'invalid_maintenance_identifier' };
  }
  if (createdAt !== undefined && typeof createdAt !== 'string') {
    return { error: 'invalid_created_at' };
  }
  const timestamp = createdAt === undefined ? new Date() : new Date(createdAt);
  if (Number.isNaN(timestamp.getTime())) return { error: 'invalid_created_at' };
  return {
    keeperPieceId: normalizedKeeperPieceId,
    provenance: normalizedInput.provenance,
    administrator,
    reason: normalizedReason.reason,
    idempotencyKey: normalizedIdempotencyKey,
    provenanceId: normalizedProvenanceId,
    eventId: normalizedEventId,
    createdAt: timestamp.toISOString(),
  };
}

function provenanceCreateReplay(existing, request, mutationFingerprint) {
  if (!existing) return null;
  const exact = existing.idempotency_key === request.idempotencyKey
    && existing.event_type === 'provenance_created'
    && existing.keeper_piece_id === request.keeperPieceId
    && existing.artwork_id == null
    && existing.administrator_user_id === request.administrator.userId
    && existing.administrator_email === request.administrator.email
    && existing.reason === request.reason
    && existing.outcome === 'succeeded'
    && existing.mutation_fingerprint === mutationFingerprint;
  if (!exact) return { ok: false, error: 'idempotency_conflict' };
  try {
    const provenance = JSON.parse(existing.after_json);
    normalizeEventSnapshot('provenance_created', provenance);
    if (provenance?.keeperPieceId !== request.keeperPieceId
      || provenance?.provenanceId !== existing.related_record_id
      || provenance?.recordVersion !== 1
      || provenance?.removedAt !== null) {
      return { ok: false, error: 'maintenance_write_failed' };
    }
    return { ok: true, replayed: true, eventId: existing.id, provenance };
  } catch {
    return { ok: false, error: 'maintenance_write_failed' };
  }
}

async function resolveProvenanceCreateReplay(env, request, mutationFingerprint, fallback) {
  try {
    const existing = await findMaintenanceEventByIdempotencyKey(env, request.idempotencyKey);
    return provenanceCreateReplay(existing, request, mutationFingerprint) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Atomically create one typed creator-history entry and its maintenance event. */
export async function commitProvenanceCreate(env, input) {
  const allowedFields = new Set([
    'keeperPieceId', 'provenance', 'authorization', 'reason', 'idempotencyKey',
    'provenanceId', 'eventId', 'createdAt',
  ]);
  if (!isPlainRecord(input) || Object.keys(input).some((key) => !allowedFields.has(key))) {
    return { ok: false, error: 'invalid_provenance_create' };
  }
  let request;
  try {
    request = normalizeProvenanceCreateRequest(input);
  } catch {
    return { ok: false, error: 'invalid_provenance_create' };
  }
  if (request.error) return { ok: false, error: request.error };
  if (typeof env?.DB?.batch !== 'function') {
    return { ok: false, error: 'atomic_write_unavailable' };
  }

  const mutationFingerprint = await maintenanceMutationFingerprint({
    operation: 'provenance_create',
    keeperPieceId: request.keeperPieceId,
    provenance: request.provenance,
  });
  const existingReplay = await resolveProvenanceCreateReplay(
    env, request, mutationFingerprint, null,
  );
  if (existingReplay) return existingReplay;

  const provenance = {
    provenanceId: request.provenanceId,
    keeperPieceId: request.keeperPieceId,
    ...request.provenance,
    recordVersion: 1,
    createdAt: request.createdAt,
    updatedAt: request.createdAt,
    removedAt: null,
  };
  const event = {
    id: request.eventId,
    idempotencyKey: request.idempotencyKey,
    eventType: 'provenance_created',
    keeperPieceId: request.keeperPieceId,
    artworkId: null,
    authorization: request.administrator,
    reason: request.reason,
    before: null,
    after: provenance,
    outcome: 'succeeded',
    relatedRecordId: request.provenanceId,
    mutationFingerprint,
    createdAt: request.createdAt,
  };

  let provenanceStatement;
  let eventStatement;
  try {
    provenanceStatement = env.DB.prepare(
      `INSERT INTO artwork_provenance_entries
         (id, keeper_piece_id, entry_type, title, detail, role, occurred_at,
          visibility, record_version, created_at, updated_at, removed_at)
       SELECT ?1, id, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?9, NULL
         FROM keeper_pieces
        WHERE id = ?2`,
    ).bind(
      request.provenanceId,
      request.keeperPieceId,
      request.provenance.entryType,
      request.provenance.title,
      request.provenance.detail,
      request.provenance.role,
      request.provenance.occurredAt,
      request.provenance.visibility,
      request.createdAt,
    );
    eventStatement = prepareMaintenanceEventStatement(
      env,
      normalizeEventDetails(event, request.eventId),
    );
  } catch {
    return { ok: false, error: 'invalid_maintenance_event' };
  }

  try {
    const [provenanceResult, eventResult] = await env.DB.batch([
      provenanceStatement,
      eventStatement,
    ]);
    if (provenanceResult?.success !== true || eventResult?.success !== true) {
      return resolveProvenanceCreateReplay(
        env, request, mutationFingerprint, { ok: false, error: 'maintenance_write_failed' },
      );
    }
    if (provenanceResult?.meta?.changes !== 1) {
      return resolveProvenanceCreateReplay(
        env, request, mutationFingerprint, { ok: false, error: 'keeper_piece_not_found' },
      );
    }
    if (eventResult?.meta?.changes !== 1) {
      return resolveProvenanceCreateReplay(
        env, request, mutationFingerprint, { ok: false, error: 'maintenance_write_failed' },
      );
    }
    return { ok: true, replayed: false, eventId: request.eventId, provenance };
  } catch {
    return resolveProvenanceCreateReplay(
      env, request, mutationFingerprint, { ok: false, error: 'maintenance_write_failed' },
    );
  }
}
