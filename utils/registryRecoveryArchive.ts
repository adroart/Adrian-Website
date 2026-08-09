/**
 * Complete private registry recovery archive.
 *
 * This is deliberately separate from registryLedger.ts. The public/offline
 * issuance ledger remains secret-free; this artifact is an encrypted snapshot
 * of every registry-owned table plus only the Better Auth rows needed to keep
 * current and historical steward associations recoverable.
 */

export const PRIVATE_RECOVERY_ARCHIVE_VERSION = 1 as const;
export const PRIVATE_RECOVERY_SCHEMA_VERSION = 4 as const;
export const PRIVATE_RECOVERY_KIND = 'registry-private-recovery-encrypted' as const;
export const PRIVATE_RECOVERY_PAYLOAD_KIND = 'registry-private-recovery-payload' as const;
export const PRIVATE_RECOVERY_ALGORITHM = 'AES-GCM-256' as const;

export const REGISTRY_RECOVERY_V3_TABLES = [
  'user',
  'account',
  'registry_artworks',
  'keeper_pieces',
  'artwork_claim_requests',
  'artwork_transfer_intents',
  'artwork_transfer_parties',
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
  'artwork_transfer_receipts',
] as const;

export const REGISTRY_RECOVERY_V2_TABLES = REGISTRY_RECOVERY_V3_TABLES.filter(
  (table) => !table.startsWith('artwork_transfer_') && table !== 'artwork_claim_requests',
);
export const REGISTRY_RECOVERY_V1_TABLES = REGISTRY_RECOVERY_V2_TABLES.filter(
  (table) => !table.startsWith('atlas_source_'),
);

export const REGISTRY_RECOVERY_TABLES = [
  'user',
  'account',
  'users',
  'profiles',
  'registry_artworks',
  'registry_catalog_membership',
  'keeper_pieces',
  'artwork_claim_requests',
  'artwork_transfer_intents',
  'artwork_transfer_parties',
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
  'artwork_identity_recovery_qualifications',
  'artwork_invitations',
  'artwork_invitation_redemptions',
  'artwork_invitation_redemption_completions',
  'certificate_templates',
  'certificate_assignment_operations',
  'certificate_artwork_assignments',
  'certificate_artwork_overrides',
  'certificate_override_history',
  'collector_curated_cities',
  'collector_person_privacy',
  'collector_piece_privacy',
  'collector_consent_history',
  'artwork_transfer_receipts',
] as const;

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
  users: [
    'id', 'clerk_user_id', 'email', 'stripe_customer_id', 'created_at', 'updated_at',
    'auth_user_id',
  ],
  profiles: [
    'user_id', 'birth_date', 'birth_time', 'birth_place_label', 'lat', 'lng', 'tz_id',
    'computed_json', 'updated_at',
  ],
  registry_artworks: ['id', 'title', 'series', 'edition_size', 'created_at'],
  registry_catalog_membership: [
    'artwork_id', 'series', 'category', 'catalog_digest', 'first_seeded_at',
  ],
  keeper_pieces: [
    'id', 'piece_id', 'edition_number', 'keeper_user_id', 'recovery_code_hash',
    'current_display_location', 'registered_at', 'claimed_at', 'released_at',
    'public_code', 'issuance_key', 'plate_status', 'plate_generated_at',
    'plate_activated_at', 'front_svg_sha256', 'back_svg_sha256',
    'ownership_code_ciphertext', 'ownership_code_nonce', 'ownership_code_key_version',
    'backup_status', 'backup_reference', 'backup_at', 'lineage_head_hash',
    'lineage_event_count', 'record_version', 'steward_version',
    'supersedes_keeper_piece_id', 'superseded_by_keeper_piece_id',
    'physical_disposition', 'replaced_at', 'backup_sha256', 'last_transfer_id',
    'registration_status', 'registered_by_user_id', 'identity_backup_status',
    'identity_backup_reference', 'identity_backup_sha256', 'identity_backup_at',
  ],
  artwork_claim_requests: [
    'id', 'keeper_piece_id', 'requester_user_id', 'requester_email', 'note',
    'routed_to_user_id', 'status', 'created_at', 'resolved_at', 'resolved_by_user_id',
  ],
  artwork_transfer_intents: [
    'id', 'keeper_piece_id', 'expected_from_user_id', 'target_user_id',
    'target_email_commitment',
    'expected_steward_version', 'expected_lineage_count', 'expected_lineage_hash',
    'transfer_kind', 'maintenance_event_id', 'lineage_event_id', 'created_at',
  ],
  artwork_transfer_parties: [
    'id', 'transfer_intent_id', 'party_role', 'user_id', 'public_ref', 'created_at',
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
  artwork_identity_recovery_qualifications: [
    'id', 'keeper_piece_id', 'result', 'copied_artifact', 'schema_version',
    'build_version', 'key_version', 'verifier_version', 'backup_reference',
    'backup_sha256', 'administrator_user_id', 'administrator_email',
    'safe_failure_code', 'qualified_at',
  ],
  artwork_invitations: [
    'id', 'keeper_piece_id', 'token_hash', 'intended_recipient_email',
    'created_by_user_id', 'idempotency_key', 'created_at', 'expires_at',
    'revoked_at', 'revoked_by_user_id',
  ],
  artwork_invitation_redemptions: [
    'invitation_id', 'keeper_piece_id', 'redeemed_by_user_id',
    'verified_recipient_email', 'proof_reference', 'presented_token_hash', 'redeemed_at',
  ],
  artwork_invitation_redemption_completions: ['invitation_id', 'completed_at'],
  certificate_templates: [
    'id', 'name', 'content_json', 'version', 'created_by_user_id', 'created_by_email',
    'created_at', 'updated_at',
  ],
  certificate_assignment_operations: [
    'idempotency_key', 'request_digest', 'template_id', 'artwork_ids_json',
    'assigned_by_user_id', 'assigned_by_email', 'assigned_at',
  ],
  certificate_artwork_assignments: [
    'artwork_id', 'template_id', 'assignment_operation_key', 'version', 'assigned_at',
  ],
  certificate_artwork_overrides: [
    'artwork_id', 'field', 'mode', 'value_json', 'version', 'updated_by_user_id',
    'updated_by_email', 'updated_at',
  ],
  certificate_override_history: [
    'id', 'artwork_id', 'field', 'before_json', 'after_json', 'version',
    'changed_by_user_id', 'changed_by_email', 'changed_at',
  ],
  collector_curated_cities: ['id', 'label', 'population', 'active'],
  collector_person_privacy: [
    'user_id', 'share_derived_chart', 'share_face', 'share_name', 'share_intention',
    'share_business', 'share_mission', 'policy_version', 'updated_at',
  ],
  collector_piece_privacy: [
    'keeper_piece_id', 'user_id', 'share_city', 'city_id', 'policy_version', 'updated_at',
  ],
  collector_consent_history: [
    'id', 'user_id', 'scope', 'target_ref', 'before_json', 'after_json',
    'policy_version', 'changed_at',
  ],
  artwork_transfer_receipts: ['id', 'transfer_intent_id', 'committed_at'],
};

export type PrivateRecoveryPayload = {
  kind: typeof PRIVATE_RECOVERY_PAYLOAD_KIND;
  schemaVersion: typeof PRIVATE_RECOVERY_SCHEMA_VERSION;
  exportedAt: string;
  tables: Record<RegistryRecoveryTable, RecoveryRow[]>;
};

type LegacyPrivateRecoveryPayload = {
  kind: typeof PRIVATE_RECOVERY_PAYLOAD_KIND;
  schemaVersion: 1 | 2 | 3;
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
    schemaVersion: 1 | 2 | 3 | typeof PRIVATE_RECOVERY_SCHEMA_VERSION;
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

const V4_KEEPER_COLUMNS = new Set([
  'registration_status', 'registered_by_user_id', 'identity_backup_status',
  'identity_backup_reference', 'identity_backup_sha256', 'identity_backup_at',
]);

export const REGISTRY_RECOVERY_ORDER_COLUMNS: Record<RegistryRecoveryTable, readonly string[]> = {
  ...Object.fromEntries(REGISTRY_RECOVERY_TABLES.map((table) => [table, ['id']])) as unknown as Record<RegistryRecoveryTable, readonly string[]>,
  users: ['id'],
  profiles: ['user_id'],
  registry_catalog_membership: ['artwork_id'],
  artwork_invitation_redemptions: ['invitation_id'],
  artwork_invitation_redemption_completions: ['invitation_id'],
  certificate_assignment_operations: ['idempotency_key'],
  certificate_artwork_assignments: ['artwork_id'],
  certificate_artwork_overrides: ['artwork_id', 'field'],
  collector_person_privacy: ['user_id'],
  collector_piece_privacy: ['keeper_piece_id'],
};

function recoveryTables(schemaVersion: number): readonly RegistryRecoveryTable[] {
  if (schemaVersion === 1) return REGISTRY_RECOVERY_V1_TABLES;
  if (schemaVersion === 2) return REGISTRY_RECOVERY_V2_TABLES;
  if (schemaVersion === 3) return REGISTRY_RECOVERY_V3_TABLES;
  return REGISTRY_RECOVERY_TABLES;
}

function recoveryColumns(table: RegistryRecoveryTable, schemaVersion: number) {
  if (table === 'keeper_pieces' && schemaVersion < 4) {
    return REGISTRY_RECOVERY_COLUMNS.keeper_pieces.filter((column) =>
      !V4_KEEPER_COLUMNS.has(column) && (schemaVersion >= 3 || column !== 'last_transfer_id'));
  }
  return REGISTRY_RECOVERY_COLUMNS[table];
}

function compareRecoveryRows(
  left: RecoveryRow,
  right: RecoveryRow,
  columns: readonly string[],
): number {
  for (const column of columns) {
    const leftValue = left[column];
    const rightValue = right[column];
    if ((typeof leftValue !== 'string' && typeof leftValue !== 'number')
      || (typeof rightValue !== 'string' && typeof rightValue !== 'number')) return 0;
    const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue));
    if (comparison) return comparison;
  }
  return 0;
}

/** Strict synchronous payload shape check used again immediately before SQL emission. */
export function validatePrivateRecoveryPayload(
  payload: unknown,
): asserts payload is PrivateRecoveryPayload | LegacyPrivateRecoveryPayload {
  if (!isPlainObject(payload) || !hasExactKeys(payload, ['kind', 'schemaVersion', 'exportedAt', 'tables'])) {
    throw new Error('recovery_payload_shape');
  }
  if (payload.kind !== PRIVATE_RECOVERY_PAYLOAD_KIND
    || (![1, 2, 3, PRIVATE_RECOVERY_SCHEMA_VERSION].includes(payload.schemaVersion as number))
    || typeof payload.exportedAt !== 'string') {
    throw new Error('recovery_payload_unsupported');
  }
  const tableNames = recoveryTables(payload.schemaVersion as number);
  if (!isPlainObject(payload.tables)
    || !hasExactKeys(payload.tables, tableNames)) {
    throw new Error('recovery_payload_tables');
  }
  for (const table of tableNames) {
    const rows = payload.tables[table];
    if (!Array.isArray(rows) || !rows.every(validateRow)) {
      throw new Error(`recovery_payload_rows_${table}`);
    }
    if (rows.some((row) => !hasExactKeys(row, recoveryColumns(table, payload.schemaVersion as number)))) {
      throw new Error(`recovery_payload_columns_${table}`);
    }
    for (let index = 1; index < rows.length; index += 1) {
      if (compareRecoveryRows(rows[index - 1], rows[index],
        REGISTRY_RECOVERY_ORDER_COLUMNS[table as RegistryRecoveryTable]) >= 0) {
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
      keeper_pieces: payload.tables.keeper_pieces.map((row) => ({
        ...row,
        ...(payload.schemaVersion < 3 ? { last_transfer_id: null } : {}),
        registration_status: row.public_code === null ? null : 'registered',
        registered_by_user_id: null,
        identity_backup_status: null,
        identity_backup_reference: null,
        identity_backup_sha256: null,
        identity_backup_at: null,
      })),
      ...(payload.schemaVersion === 1 ? {
        atlas_source_cities: [],
        atlas_source_chains: [],
        atlas_source_chain_events: [],
      } : {}),
      ...(payload.schemaVersion < 3 ? {
        artwork_claim_requests: [],
        artwork_transfer_intents: [],
        artwork_transfer_parties: [],
        artwork_transfer_receipts: [],
      } : {}),
      users: [],
      profiles: [],
      registry_catalog_membership: [],
      artwork_identity_recovery_qualifications: [],
      artwork_invitations: [],
      artwork_invitation_redemptions: [],
      artwork_invitation_redemption_completions: [],
      certificate_templates: [],
      certificate_assignment_operations: [],
      certificate_artwork_assignments: [],
      certificate_artwork_overrides: [],
      certificate_override_history: [],
      collector_curated_cities: [],
      collector_person_privacy: [],
      collector_piece_privacy: [],
      collector_consent_history: [],
    } as unknown as Record<RegistryRecoveryTable, RecoveryRow[]>,
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
  if ((![1, 2, 3, PRIVATE_RECOVERY_SCHEMA_VERSION].includes(value.manifest.schemaVersion as number))
    || typeof value.manifest.exportedAt !== 'string'
    || typeof value.manifest.payloadSha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(value.manifest.payloadSha256)
    || !Array.isArray(value.manifest.tables)) {
    throw new Error('recovery_archive_manifest');
  }
  const tableNames = recoveryTables(value.manifest.schemaVersion as number);
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
  const tableNames = recoveryTables(value.manifest.schemaVersion as number);
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

function transferRestoreRows(payload: PrivateRecoveryPayload) {
  const intentsById = new Map(payload.tables.artwork_transfer_intents.map((row) => [row.id, row]));
  const maintenanceById = new Map(payload.tables.registry_maintenance_events.map((row) => [row.id, row]));
  const receipts = [...payload.tables.artwork_transfer_receipts].sort((left, right) => {
    const leftIntent = intentsById.get(left.transfer_intent_id);
    const rightIntent = intentsById.get(right.transfer_intent_id);
    if (!leftIntent || !rightIntent) throw new Error('recovery_transfer_intent_missing');
    const lineageOrder = Number(leftIntent.expected_lineage_count)
      - Number(rightIntent.expected_lineage_count);
    return lineageOrder || String(left.id).localeCompare(String(right.id));
  });
  const firstIntentByPiece = new Map<string | number, RecoveryRow>();
  for (const receipt of receipts) {
    const intent = intentsById.get(receipt.transfer_intent_id);
    if (!intent) throw new Error('recovery_transfer_intent_missing');
    const current = firstIntentByPiece.get(intent.keeper_piece_id);
    if (!current
      || Number(intent.expected_lineage_count) < Number(current.expected_lineage_count)) {
      firstIntentByPiece.set(intent.keeper_piece_id, intent);
    }
  }

  const keeperRows = payload.tables.keeper_pieces.map((row) => {
    const firstIntent = firstIntentByPiece.get(row.id);
    if (!firstIntent) return row;
    const maintenance = maintenanceById.get(firstIntent.maintenance_event_id);
    let before: Record<string, unknown>;
    try {
      before = JSON.parse(String(maintenance?.before_json));
    } catch {
      throw new Error('recovery_transfer_baseline_invalid');
    }
    const claimedAt = before.claimedAt ?? before.claimed_at;
    const releasedAt = before.releasedAt ?? before.released_at ?? null;
    const currentDisplayLocation = before.currentDisplayLocation
      ?? before.current_display_location ?? null;
    const keeperUserId = before.keeperUserId ?? before.keeper_user_id;
    const stewardVersion = before.stewardVersion ?? before.steward_version;
    if (keeperUserId !== firstIntent.expected_from_user_id
      || typeof claimedAt !== 'string' || !claimedAt
      || stewardVersion !== firstIntent.expected_steward_version
      || (releasedAt !== null && typeof releasedAt !== 'string')
      || (currentDisplayLocation !== null && typeof currentDisplayLocation !== 'string')) {
      throw new Error('recovery_transfer_baseline_invalid');
    }
    return {
      ...row,
      keeper_user_id: firstIntent.expected_from_user_id,
      claimed_at: claimedAt,
      released_at: releasedAt as string | null,
      current_display_location: currentDisplayLocation as string | null,
      steward_version: firstIntent.expected_steward_version,
      lineage_event_count: firstIntent.expected_lineage_count,
      lineage_head_hash: firstIntent.expected_lineage_hash,
      last_transfer_id: null,
    };
  });
  return { keeperRows, receipts };
}

function invitationRestoreRows(payload: PrivateRecoveryPayload, keeperRows: RecoveryRow[]) {
  const lineageByPiece = new Map<string | number, RecoveryRow[]>();
  for (const row of payload.tables.artwork_lineage_events) {
    const rows = lineageByPiece.get(row.keeper_piece_id) ?? [];
    rows.push(row);
    lineageByPiece.set(row.keeper_piece_id, rows);
  }
  const completions = new Map(payload.tables.artwork_invitation_redemption_completions
    .map((row) => [row.invitation_id, row]));
  const firstBoundRows = new Map<string | number, RecoveryRow>();
  const redemptionsByPiece = new Map<string | number, RecoveryRow>();
  for (const redemption of payload.tables.artwork_invitation_redemptions) {
    if (!completions.has(redemption.invitation_id)
      || redemptionsByPiece.has(redemption.keeper_piece_id)) {
      throw new Error('recovery_invitation_completion_invalid');
    }
    const lineage = (lineageByPiece.get(redemption.keeper_piece_id) ?? []).find((row) =>
      row.event_type === 'first_bound' && row.event_at === redemption.redeemed_at);
    const evidence = payload.tables.artwork_claim_evidence.find((row) =>
      row.keeper_piece_id === redemption.keeper_piece_id
      && row.actor_user_id === redemption.redeemed_by_user_id
      && row.verified_email === redemption.verified_recipient_email
      && row.outcome === 'first_bound'
      && row.created_at === redemption.redeemed_at);
    if (!lineage || !evidence) throw new Error('recovery_invitation_completion_invalid');
    redemptionsByPiece.set(redemption.keeper_piece_id, redemption);
    firstBoundRows.set(redemption.keeper_piece_id, lineage);
  }

  const unboundKeeperRows = keeperRows.map((row) => {
    const redemption = redemptionsByPiece.get(row.id);
    if (!redemption) return row;
    const lineage = firstBoundRows.get(row.id)!;
    return {
      ...row,
      keeper_user_id: null,
      claimed_at: null,
      released_at: null,
      current_display_location: null,
      lineage_event_count: Number(lineage.sequence) - 1,
      lineage_head_hash: lineage.previous_hash,
      steward_version: 0,
      last_transfer_id: null,
    };
  });
  const firstBoundUpdates = keeperRows.flatMap((row) => {
    const redemption = redemptionsByPiece.get(row.id);
    if (!redemption) return [];
    const lineage = firstBoundRows.get(row.id)!;
    return [{
      id: row.id,
      keeper_user_id: redemption.redeemed_by_user_id,
      claimed_at: redemption.redeemed_at,
      released_at: null,
      current_display_location: row.current_display_location,
      lineage_event_count: lineage.sequence,
      lineage_head_hash: lineage.event_hash,
      steward_version: row.steward_version,
      last_transfer_id: null,
    }];
  });
  return { unboundKeeperRows, firstBoundUpdates };
}

function insertStatement(table: RegistryRecoveryTable, row: RecoveryRow): string {
  const columns = Object.keys(row).sort();
  if (!columns.length) throw new Error(`recovery_payload_columns_${table}`);
  return `INSERT INTO ${sqlIdentifier(table)} (${columns.map(sqlIdentifier).join(', ')}) VALUES (`
    + `${columns.map((column) => sqlValue(row[column])).join(', ')});`;
}

function certificateRestoreStatements(payload: PrivateRecoveryPayload): string[] {
  const statements: string[] = [];
  const historiesByOverride = new Map<string, RecoveryRow[]>();
  for (const row of payload.tables.certificate_override_history) {
    const key = `${row.artwork_id}\u0000${row.field}`;
    const rows = historiesByOverride.get(key) ?? [];
    rows.push(row);
    historiesByOverride.set(key, rows);
  }
  const currentKeys = new Set(payload.tables.certificate_artwork_overrides
    .map((row) => `${row.artwork_id}\u0000${row.field}`));
  for (const history of payload.tables.certificate_override_history) {
    const key = `${history.artwork_id}\u0000${history.field}`;
    if (!currentKeys.has(key)) statements.push(insertStatement('certificate_override_history', history));
  }
  for (const current of payload.tables.certificate_artwork_overrides) {
    const key = `${current.artwork_id}\u0000${current.field}`;
    const history = [...(historiesByOverride.get(key) ?? [])]
      .sort((left, right) => Number(left.version) - Number(right.version));
    if (!history.length || history.at(-1)?.version !== current.version) {
      throw new Error('recovery_certificate_history_invalid');
    }
    let previousAfterJson: string | null = null;
    history.forEach((entry, index) => {
      let after: Record<string, unknown>;
      try {
        after = JSON.parse(String(entry.after_json));
      } catch {
        throw new Error('recovery_certificate_history_invalid');
      }
      if (!['inherit', 'override', 'suppress'].includes(String(after.mode))
        || after.version !== entry.version) {
        throw new Error('recovery_certificate_history_invalid');
      }
      const valueJson = after.mode === 'override' ? JSON.stringify(after.value) : null;
      const expectedAfterJson = JSON.stringify({
        mode: after.mode,
        value: after.mode === 'override' ? after.value : null,
        version: after.version,
      });
      if (entry.after_json !== expectedAfterJson
        || entry.before_json !== previousAfterJson) {
        throw new Error('recovery_certificate_history_invalid');
      }
      const replayRow: RecoveryRow = {
        artwork_id: entry.artwork_id,
        field: entry.field,
        mode: String(after.mode),
        value_json: valueJson,
        version: Number(entry.version),
        updated_by_user_id: entry.changed_by_user_id,
        updated_by_email: entry.changed_by_email,
        updated_at: entry.changed_at,
      };
      if (index === history.length - 1 && (
        current.mode !== replayRow.mode
        || current.value_json !== replayRow.value_json
        || current.version !== replayRow.version
        || current.updated_by_user_id !== replayRow.updated_by_user_id
        || current.updated_by_email !== replayRow.updated_by_email
        || current.updated_at !== replayRow.updated_at
      )) throw new Error('recovery_certificate_history_invalid');
      if (index === 0) {
        statements.push(insertStatement('certificate_artwork_overrides', replayRow));
      } else {
        statements.push(
          `UPDATE certificate_artwork_overrides SET `
          + `mode = ${sqlValue(replayRow.mode)}, value_json = ${sqlValue(replayRow.value_json)}, `
          + `version = ${sqlValue(replayRow.version)}, `
          + `updated_by_user_id = ${sqlValue(replayRow.updated_by_user_id)}, `
          + `updated_by_email = ${sqlValue(replayRow.updated_by_email)}, `
          + `updated_at = ${sqlValue(replayRow.updated_at)} `
          + `WHERE artwork_id = ${sqlValue(replayRow.artwork_id)} `
          + `AND field = ${sqlValue(replayRow.field)};`,
        );
      }
      previousAfterJson = expectedAfterJson;
    });
  }
  return statements;
}

const REGISTERED_IDENTITY_INSERT_GUARD_SQL = `CREATE TRIGGER keeper_piece_registered_identity_insert_guard
BEFORE INSERT ON keeper_pieces
WHEN NEW.registration_status = 'registered' AND (
  NEW.public_code IS NULL OR NEW.issuance_key IS NULL OR NEW.registered_at IS NULL
  OR NEW.ownership_code_ciphertext IS NULL OR NEW.ownership_code_nonce IS NULL
  OR NEW.ownership_code_key_version IS NULL OR NEW.identity_backup_status <> 'verified'
  OR NEW.identity_backup_reference IS NULL OR NEW.identity_backup_sha256 IS NULL
  OR NEW.identity_backup_at IS NULL OR NEW.identity_backup_reference <>
    'identities/' || NEW.public_code || '/' || NEW.identity_backup_sha256 || '.json'
)
BEGIN SELECT RAISE(ABORT, 'registered artwork identity is incomplete'); END;`;

/**
 * Generate offline-only SQL after the encrypted artifact has been fully
 * authenticated. Every insert is guarded, conflict-failing and transactional.
 * A failed cleanliness guard rolls back before any target mutation; per-table
 * temporary triggers keep later statements fail-closed even in a permissive
 * SQL runner that continues after the first error. A final expected-count
 * trigger rolls back the whole transaction if any insert was skipped or failed.
 */
export function buildRegistryRestoreSql(
  sourcePayload: PrivateRecoveryPayload | LegacyPrivateRecoveryPayload,
): string {
  const payload = upgradePrivateRecoveryPayload(sourcePayload);
  const transferRows = transferRestoreRows(payload);
  const invitationRows = invitationRestoreRows(payload, transferRows.keeperRows);
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
  const insertTables = (tables: readonly RegistryRecoveryTable[]) => {
    for (const table of tables) {
      for (const row of payload.tables[table]) statements.push(insertStatement(table, row));
    }
  };

  insertTables([
    'user', 'account', 'users', 'profiles', 'registry_artworks',
    'registry_catalog_membership',
  ]);
  statements.push('DROP TRIGGER keeper_piece_registered_identity_insert_guard;');
  for (const row of invitationRows.unboundKeeperRows) {
    statements.push(insertStatement('keeper_pieces', row));
  }
  statements.push(REGISTERED_IDENTITY_INSERT_GUARD_SQL);
  insertTables(['artwork_invitations', 'artwork_invitation_redemptions']);
  insertTables([
    'artwork_claim_requests', 'artwork_transfer_intents', 'artwork_transfer_parties',
    'atlas_source_cities', 'atlas_source_chains', 'atlas_source_chain_events',
    'keeper_intentions', 'piece_fulfillments', 'artwork_acquisitions',
    'artwork_provenance_entries', 'artwork_claim_evidence', 'artwork_lineage_events',
    'ownership_code_audit', 'registry_maintenance_events',
    'registry_recovery_qualifications', 'artwork_identity_recovery_qualifications',
  ]);
  for (const row of invitationRows.firstBoundUpdates) {
    statements.push(
      `UPDATE keeper_pieces SET keeper_user_id = ${sqlValue(row.keeper_user_id)}, `
      + `claimed_at = ${sqlValue(row.claimed_at)}, released_at = ${sqlValue(row.released_at)}, `
      + `current_display_location = ${sqlValue(row.current_display_location)}, `
      + `lineage_event_count = ${sqlValue(row.lineage_event_count)}, `
      + `lineage_head_hash = ${sqlValue(row.lineage_head_hash)}, `
      + `steward_version = ${sqlValue(row.steward_version)}, `
      + `last_transfer_id = ${sqlValue(row.last_transfer_id)} `
      + `WHERE id = ${sqlValue(row.id)};`,
    );
  }
  insertTables(['artwork_invitation_redemption_completions']);
  for (const row of transferRows.receipts) {
    statements.push(insertStatement('artwork_transfer_receipts', row));
  }
  insertTables([
    'certificate_templates', 'certificate_assignment_operations',
    'certificate_artwork_assignments',
  ]);
  statements.push(...certificateRestoreStatements(payload));
  insertTables([
    'collector_curated_cities', 'collector_person_privacy',
    'collector_piece_privacy', 'collector_consent_history',
  ]);
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
