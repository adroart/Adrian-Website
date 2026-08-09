/**
 * Complete private registry recovery archive.
 *
 * This is deliberately separate from registryLedger.ts. The public/offline
 * issuance ledger remains secret-free; this artifact is an encrypted snapshot
 * of every registry-owned table plus only the Better Auth rows needed to keep
 * current and historical steward associations recoverable.
 */

export const PRIVATE_RECOVERY_ARCHIVE_VERSION = 1 as const;
export const PRIVATE_RECOVERY_SCHEMA_VERSION = 2 as const;
export const PRIVATE_RECOVERY_KIND = 'registry-private-recovery-encrypted' as const;
export const PRIVATE_RECOVERY_PAYLOAD_KIND = 'registry-private-recovery-payload' as const;
export const PRIVATE_RECOVERY_ALGORITHM = 'AES-GCM-256' as const;

export const REGISTRY_RECOVERY_TABLES = [
  'user',
  'account',
  'registry_artworks',
  'keeper_pieces',
  'atlas_source_cities',
  'atlas_source_chains',
  'atlas_source_chain_events',
  'keeper_intentions',
  'piece_fulfillments',
  'artwork_acquisitions',
  'artwork_provenance_entries',
  'artwork_claim_evidence',
  'artwork_lineage_events',
  'ownership_code_audit',
  'registry_maintenance_events',
  'registry_recovery_qualifications',
] as const;

export const REGISTRY_RECOVERY_V1_TABLES = REGISTRY_RECOVERY_TABLES.filter(
  (table) => !table.startsWith('atlas_source_'),
);

const RECOVERY_CLEANLINESS_TABLES = [
  ...REGISTRY_RECOVERY_TABLES,
  'session',
  'verification',
] as const;

export type RegistryRecoveryTable = typeof REGISTRY_RECOVERY_TABLES[number];
export type RecoveryRow = Record<string, string | number | null>;

export const REGISTRY_RECOVERY_COLUMNS: Record<RegistryRecoveryTable, readonly string[]> = {
  user: ['id', 'name', 'email', 'emailVerified', 'image', 'createdAt', 'updatedAt'],
  account: [
    'id', 'userId', 'accountId', 'providerId', 'accessToken', 'refreshToken',
    'accessTokenExpiresAt', 'refreshTokenExpiresAt', 'scope', 'idToken', 'password',
    'createdAt', 'updatedAt',
  ],
  registry_artworks: ['id', 'title', 'series', 'edition_size', 'created_at'],
  keeper_pieces: [
    'id', 'piece_id', 'edition_number', 'keeper_user_id', 'recovery_code_hash',
    'current_display_location', 'registered_at', 'claimed_at', 'released_at',
    'public_code', 'issuance_key', 'plate_status', 'plate_generated_at',
    'plate_activated_at', 'front_svg_sha256', 'back_svg_sha256',
    'ownership_code_ciphertext', 'ownership_code_nonce', 'ownership_code_key_version',
    'backup_status', 'backup_reference', 'backup_at', 'lineage_head_hash',
    'lineage_event_count', 'record_version', 'steward_version',
    'supersedes_keeper_piece_id', 'superseded_by_keeper_piece_id',
    'physical_disposition', 'replaced_at', 'backup_sha256',
  ],
  atlas_source_cities: [
    'id', 'city', 'region', 'country', 'country_code', 'lat', 'lng',
  ],
  atlas_source_chains: [
    'id', 'keeper_piece_id', 'source_system', 'source_reference', 'moved_on',
    'source_event_count', 'source_head_hash',
  ],
  atlas_source_chain_events: [
    'id', 'source_chain_id', 'source_sequence', 'source_event_id',
    'source_event_type', 'source_event_at', 'source_previous_hash',
    'source_event_hash', 'source_event_json',
  ],
  keeper_intentions: [
    'id', 'piece_id', 'edition_number', 'author_user_id', 'kind', 'body',
    'body_hash', 'content_salt', 'confirmed_at', 'sets_for_year',
    'birthday_window', 'created_at', 'erased_at', 'erase_reason',
  ],
  piece_fulfillments: [
    'id', 'keeper_piece_id', 'legacy_source_reference', 'assignment_type',
    'intended_recipient_reference', 'assigned_at', 'shipped_at', 'claimed_at',
    'corrected_at', 'correction_reason',
  ],
  artwork_acquisitions: [
    'id', 'keeper_piece_id', 'acquisition_type', 'acquired_at', 'amount_minor',
    'currency', 'acquirer_reference', 'private_notes', 'document_reference',
    'public_provenance', 'record_version', 'created_at', 'updated_at',
  ],
  artwork_provenance_entries: [
    'id', 'keeper_piece_id', 'entry_type', 'title', 'detail', 'role',
    'occurred_at', 'visibility', 'record_version', 'created_at', 'updated_at',
    'removed_at',
  ],
  artwork_claim_evidence: [
    'id', 'keeper_piece_id', 'actor_user_id', 'verified_email', 'ip_address',
    'user_agent', 'outcome', 'created_at',
  ],
  artwork_lineage_events: [
    'id', 'keeper_piece_id', 'sequence', 'event_type', 'event_at',
    'previous_hash', 'event_hash', 'public_payload_json',
  ],
  ownership_code_audit: [
    'id', 'keeper_piece_id', 'action', 'request_id', 'outcome', 'created_at',
  ],
  registry_maintenance_events: [
    'id', 'idempotency_key', 'event_type', 'keeper_piece_id', 'artwork_id',
    'administrator_user_id', 'administrator_email', 'reason', 'before_json',
    'after_json', 'outcome', 'related_record_id', 'mutation_fingerprint', 'created_at',
  ],
  registry_recovery_qualifications: [
    'id', 'keeper_piece_id', 'scope', 'result', 'copied_artifacts', 'schema_version',
    'build_version', 'key_version', 'generator_version', 'verifier_version',
    'backup_reference', 'backup_sha256', 'administrator_user_id',
    'administrator_email', 'safe_failure_code', 'qualified_at',
  ],
};

export type PrivateRecoveryPayload = {
  kind: typeof PRIVATE_RECOVERY_PAYLOAD_KIND;
  schemaVersion: typeof PRIVATE_RECOVERY_SCHEMA_VERSION;
  exportedAt: string;
  tables: Record<RegistryRecoveryTable, RecoveryRow[]>;
};

type PrivateRecoveryPayloadV1 = {
  kind: typeof PRIVATE_RECOVERY_PAYLOAD_KIND;
  schemaVersion: 1;
  exportedAt: string;
  tables: Record<string, RecoveryRow[]>;
};

export type PrivateRecoveryManifestTable = {
  name: RegistryRecoveryTable;
  count: number;
  sha256: string;
};

export type PrivateRecoveryArchive = {
  kind: typeof PRIVATE_RECOVERY_KIND;
  version: typeof PRIVATE_RECOVERY_ARCHIVE_VERSION;
  algorithm: typeof PRIVATE_RECOVERY_ALGORITHM;
  keyId: string;
  nonce: string;
  manifest: {
    schemaVersion: typeof PRIVATE_RECOVERY_SCHEMA_VERSION;
    exportedAt: string;
    payloadSha256: string;
    tables: PrivateRecoveryManifestTable[];
  };
  ciphertext: string;
};

type SupportedPrivateRecoveryArchive = Omit<PrivateRecoveryArchive, 'manifest'> & {
  manifest: Omit<PrivateRecoveryArchive['manifest'], 'schemaVersion'> & {
    schemaVersion: 1 | typeof PRIVATE_RECOVERY_SCHEMA_VERSION;
  };
};

export type PrivateRecoveryKey = { key: string; keyId: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]) {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && actual.every((key, index) => key === sortedExpected[index]);
}

/** Deterministic JSON for encryption, table digests and AAD. */
export function canonicalRecoveryJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalRecoveryJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalRecoveryJson((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  if (value === undefined) throw new Error('recovery_value_undefined');
  return JSON.stringify(value);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof value !== 'string' || !value) throw new Error('recovery_key_invalid');
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error('recovery_key_invalid');
  }
}

async function sha256(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Text(value: string): Promise<string> {
  return sha256(new TextEncoder().encode(value));
}

function keyBytes(configuration: PrivateRecoveryKey): Uint8Array {
  if (!configuration || typeof configuration.keyId !== 'string' || !configuration.keyId.trim()) {
    throw new Error('recovery_key_invalid');
  }
  const bytes = base64ToBytes(configuration.key);
  if (bytes.byteLength !== 32) throw new Error('recovery_key_invalid');
  return bytes;
}

async function importAesKey(configuration: PrivateRecoveryKey, usage: KeyUsage) {
  return crypto.subtle.importKey('raw', keyBytes(configuration), { name: 'AES-GCM' }, false, [usage]);
}

function archiveAad(archive: Omit<SupportedPrivateRecoveryArchive, 'ciphertext'>) {
  return canonicalRecoveryJson({
    kind: archive.kind,
    version: archive.version,
    algorithm: archive.algorithm,
    keyId: archive.keyId,
    nonce: archive.nonce,
    manifest: archive.manifest,
  });
}

function validateRow(row: unknown): row is RecoveryRow {
  if (!isPlainObject(row)) return false;
  return Object.values(row).every((value) =>
    value === null || typeof value === 'string'
      || (typeof value === 'number' && Number.isFinite(value)));
}

/** Strict synchronous payload shape check used again immediately before SQL emission. */
export function validatePrivateRecoveryPayload(
  payload: unknown,
): asserts payload is PrivateRecoveryPayload | PrivateRecoveryPayloadV1 {
  if (!isPlainObject(payload) || !hasExactKeys(payload, ['kind', 'schemaVersion', 'exportedAt', 'tables'])) {
    throw new Error('recovery_payload_shape');
  }
  if (payload.kind !== PRIVATE_RECOVERY_PAYLOAD_KIND
    || (payload.schemaVersion !== 1 && payload.schemaVersion !== PRIVATE_RECOVERY_SCHEMA_VERSION)
    || typeof payload.exportedAt !== 'string') {
    throw new Error('recovery_payload_unsupported');
  }
  const tableNames = payload.schemaVersion === 1
    ? REGISTRY_RECOVERY_V1_TABLES
    : REGISTRY_RECOVERY_TABLES;
  if (!isPlainObject(payload.tables)
    || !hasExactKeys(payload.tables, tableNames)) {
    throw new Error('recovery_payload_tables');
  }
  for (const table of tableNames) {
    const rows = payload.tables[table];
    if (!Array.isArray(rows) || !rows.every(validateRow)) {
      throw new Error(`recovery_payload_rows_${table}`);
    }
    if (rows.some((row) => !hasExactKeys(row, REGISTRY_RECOVERY_COLUMNS[table]))) {
      throw new Error(`recovery_payload_columns_${table}`);
    }
    for (let index = 1; index < rows.length; index += 1) {
      const previous = rows[index - 1].id;
      const current = rows[index].id;
      if ((typeof previous !== 'string' && typeof previous !== 'number')
        || (typeof current !== 'string' && typeof current !== 'number')
        || String(previous).localeCompare(String(current)) >= 0) {
        throw new Error(`recovery_payload_order_${table}`);
      }
    }
  }
}

export function upgradePrivateRecoveryPayload(payload: unknown): PrivateRecoveryPayload {
  validatePrivateRecoveryPayload(payload);
  if (payload.schemaVersion === PRIVATE_RECOVERY_SCHEMA_VERSION) return payload;
  return {
    kind: PRIVATE_RECOVERY_PAYLOAD_KIND,
    schemaVersion: PRIVATE_RECOVERY_SCHEMA_VERSION,
    exportedAt: payload.exportedAt,
    tables: {
      ...payload.tables,
      atlas_source_cities: [],
      atlas_source_chains: [],
      atlas_source_chain_events: [],
    } as Record<RegistryRecoveryTable, RecoveryRow[]>,
  };
}

function validateArchiveShape(value: unknown): asserts value is SupportedPrivateRecoveryArchive {
  if (!isPlainObject(value) || !hasExactKeys(value, [
    'kind', 'version', 'algorithm', 'keyId', 'nonce', 'manifest', 'ciphertext',
  ])) throw new Error('recovery_archive_shape');
  if (value.kind !== PRIVATE_RECOVERY_KIND
    || value.version !== PRIVATE_RECOVERY_ARCHIVE_VERSION
    || value.algorithm !== PRIVATE_RECOVERY_ALGORITHM) {
    throw new Error('unsupported_recovery_archive');
  }
  if (typeof value.keyId !== 'string' || !value.keyId
    || typeof value.nonce !== 'string' || !value.nonce
    || typeof value.ciphertext !== 'string' || !value.ciphertext
    || !isPlainObject(value.manifest)
    || !hasExactKeys(value.manifest, ['schemaVersion', 'exportedAt', 'payloadSha256', 'tables'])) {
    throw new Error('recovery_archive_shape');
  }
  if ((value.manifest.schemaVersion !== 1
      && value.manifest.schemaVersion !== PRIVATE_RECOVERY_SCHEMA_VERSION)
    || typeof value.manifest.exportedAt !== 'string'
    || typeof value.manifest.payloadSha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(value.manifest.payloadSha256)
    || !Array.isArray(value.manifest.tables)) {
    throw new Error('recovery_archive_manifest');
  }
  const tableNames = value.manifest.schemaVersion === 1
    ? REGISTRY_RECOVERY_V1_TABLES
    : REGISTRY_RECOVERY_TABLES;
  if (value.manifest.tables.length !== tableNames.length) {
    throw new Error('recovery_archive_manifest');
  }
  for (let index = 0; index < tableNames.length; index += 1) {
    const entry = value.manifest.tables[index];
    if (!isPlainObject(entry) || !hasExactKeys(entry, ['name', 'count', 'sha256'])
      || entry.name !== tableNames[index]
      || !Number.isSafeInteger(entry.count) || Number(entry.count) < 0
      || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new Error('recovery_archive_manifest');
    }
  }
}

export async function encryptPrivateRecoveryPayload(
  payload: PrivateRecoveryPayload,
  configuration: PrivateRecoveryKey,
): Promise<PrivateRecoveryArchive> {
  validatePrivateRecoveryPayload(payload);
  if (payload.schemaVersion !== PRIVATE_RECOVERY_SCHEMA_VERSION) {
    throw new Error('recovery_payload_unsupported');
  }
  const plaintext = new TextEncoder().encode(canonicalRecoveryJson(payload));
  const tables: PrivateRecoveryManifestTable[] = [];
  for (const name of REGISTRY_RECOVERY_TABLES) {
    tables.push({
      name,
      count: payload.tables[name].length,
      sha256: await sha256Text(canonicalRecoveryJson(payload.tables[name])),
    });
  }
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const archiveWithoutCiphertext = {
    kind: PRIVATE_RECOVERY_KIND,
    version: PRIVATE_RECOVERY_ARCHIVE_VERSION,
    algorithm: PRIVATE_RECOVERY_ALGORITHM,
    keyId: configuration.keyId,
    nonce: bytesToBase64(nonce),
    manifest: {
      schemaVersion: PRIVATE_RECOVERY_SCHEMA_VERSION,
      exportedAt: payload.exportedAt,
      payloadSha256: await sha256(plaintext),
      tables,
    },
  } as const;
  const key = await importAesKey(configuration, 'encrypt');
  const ciphertext = await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv: nonce,
    additionalData: new TextEncoder().encode(archiveAad(archiveWithoutCiphertext)),
    tagLength: 128,
  }, key, plaintext);
  return { ...archiveWithoutCiphertext, ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
}

export async function decryptPrivateRecoveryExport(
  value: unknown,
  configuration: PrivateRecoveryKey,
): Promise<PrivateRecoveryPayload> {
  validateArchiveShape(value);
  if (value.keyId !== configuration.keyId) throw new Error('recovery_key_id_mismatch');
  const nonce = base64ToBytes(value.nonce);
  if (nonce.byteLength !== 12) throw new Error('recovery_archive_shape');
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt({
      name: 'AES-GCM',
      iv: nonce,
      additionalData: new TextEncoder().encode(archiveAad({
        kind: value.kind,
        version: value.version,
        algorithm: value.algorithm,
        keyId: value.keyId,
        nonce: value.nonce,
        manifest: value.manifest,
      })),
      tagLength: 128,
    }, await importAesKey(configuration, 'decrypt'), base64ToBytes(value.ciphertext));
  } catch {
    throw new Error('recovery_archive_authentication');
  }
  const bytes = new Uint8Array(plaintext);
  if (await sha256(bytes) !== value.manifest.payloadSha256) {
    throw new Error('recovery_archive_digest');
  }
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('recovery_payload_json');
  }
  validatePrivateRecoveryPayload(payload);
  if (payload.schemaVersion !== value.manifest.schemaVersion) {
    throw new Error('recovery_archive_manifest');
  }
  if (payload.exportedAt !== value.manifest.exportedAt) {
    throw new Error('recovery_archive_manifest');
  }
  const tableNames = value.manifest.schemaVersion === 1
    ? REGISTRY_RECOVERY_V1_TABLES
    : REGISTRY_RECOVERY_TABLES;
  for (let index = 0; index < tableNames.length; index += 1) {
    const name = tableNames[index];
    const expected = value.manifest.tables[index];
    if (payload.tables[name].length !== expected.count
      || await sha256Text(canonicalRecoveryJson(payload.tables[name])) !== expected.sha256) {
      throw new Error('recovery_archive_manifest');
    }
  }
  return upgradePrivateRecoveryPayload(payload);
}

function sqlIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function sqlValue(value: RecoveryRow[string]): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('recovery_payload_number');
    return String(value);
  }
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Generate offline-only SQL after the encrypted artifact has been fully
 * authenticated. Every insert is guarded, conflict-failing and transactional.
 * A failed cleanliness guard rolls back before any target mutation; per-table
 * temporary triggers keep later statements fail-closed even in a permissive
 * SQL runner that continues after the first error. A final expected-count
 * trigger rolls back the whole transaction if any insert was skipped or failed.
 */
export function buildRegistryRestoreSql(
  sourcePayload: PrivateRecoveryPayload | PrivateRecoveryPayloadV1,
): string {
  const payload = upgradePrivateRecoveryPayload(sourcePayload);
  const guardTable = '__registry_recovery_clean_guard';
  const completionTable = '__registry_recovery_completion_guard';
  const completionTrigger = '__registry_recovery_require_complete';
  const statements = [
    '-- Private registry recovery restore. Use only with a new, fully migrated recovery database.',
    '-- This SQL never selects a configured database and must never be aimed at production.',
    'PRAGMA foreign_keys = ON;',
    `CREATE TEMP TABLE ${guardTable} (token INTEGER PRIMARY KEY CHECK (token = 1));`,
    `CREATE TEMP TABLE ${completionTable} (token INTEGER PRIMARY KEY CHECK (token = 1));`,
    ...REGISTRY_RECOVERY_TABLES.map((table) =>
      `CREATE TEMP TRIGGER __registry_recovery_require_clean_${table} `
      + `BEFORE INSERT ON ${sqlIdentifier(table)} `
      + `WHEN NOT EXISTS (SELECT 1 FROM ${guardTable} WHERE token = 1) BEGIN `
      + `SELECT RAISE(ABORT, 'registry_recovery_target_not_empty'); END;`),
    `CREATE TEMP TRIGGER __registry_recovery_cleanliness_check BEFORE INSERT ON ${guardTable} WHEN `
      + RECOVERY_CLEANLINESS_TABLES.map((table) =>
        `EXISTS (SELECT 1 FROM ${sqlIdentifier(table)} LIMIT 1)`).join(' OR ')
      + ` BEGIN SELECT RAISE(ROLLBACK, 'registry_recovery_target_not_empty'); END;`,
    `CREATE TEMP TRIGGER ${completionTrigger} BEFORE INSERT ON ${completionTable} WHEN `
      + REGISTRY_RECOVERY_TABLES.map((table) =>
        `(SELECT COUNT(*) FROM ${sqlIdentifier(table)}) <> ${payload.tables[table].length}`).join(' OR ')
      + ` BEGIN SELECT RAISE(ROLLBACK, 'registry_recovery_incomplete_restore'); END;`,
    'BEGIN IMMEDIATE;',
    `INSERT INTO ${guardTable} (token) VALUES (1);`,
  ];

  for (const table of REGISTRY_RECOVERY_TABLES) {
    for (const row of payload.tables[table]) {
      const columns = Object.keys(row).sort();
      if (!columns.length) throw new Error(`recovery_payload_columns_${table}`);
      statements.push(
        `INSERT INTO ${sqlIdentifier(table)} (${columns.map(sqlIdentifier).join(', ')}) VALUES (`
        + `${columns.map((column) => sqlValue(row[column])).join(', ')});`,
      );
    }
  }
  statements.push(`INSERT INTO ${completionTable} (token) VALUES (1);`);
  statements.push('COMMIT;');
  statements.push(`DROP TRIGGER ${completionTrigger};`);
  statements.push('DROP TRIGGER __registry_recovery_cleanliness_check;');
  for (const table of REGISTRY_RECOVERY_TABLES) {
    statements.push(`DROP TRIGGER __registry_recovery_require_clean_${table};`);
  }
  statements.push(`DROP TABLE ${completionTable};`);
  statements.push(`DROP TABLE ${guardTable};`);
  return `${statements.join('\n')}\n`;
}
