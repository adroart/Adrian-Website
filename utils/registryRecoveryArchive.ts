/**
 * Complete private registry recovery archive.
 *
 * This is deliberately separate from registryLedger.ts. The public/offline
 * issuance ledger remains secret-free; this artifact is an encrypted snapshot
 * of every registry-owned table plus only the Better Auth rows needed to keep
 * current and historical steward associations recoverable.
 */

export const PRIVATE_RECOVERY_ARCHIVE_VERSION = 1 as const;
export const PRIVATE_RECOVERY_SCHEMA_VERSION = 9 as const;
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

/** The exact Phase 1 archive manifest. Never reorder or extend this list. */
export const REGISTRY_RECOVERY_V4_TABLES = [
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

/** The exact Phase 2 archive manifest. Never reorder or extend this list. */
export const REGISTRY_RECOVERY_V5_TABLES = [
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
  'collector_claim_ordinals',
  'collector_dreams',
  'collector_dream_markers',
  'collector_dream_mutations',
  'collector_dream_rituals',
  'collector_letters',
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

/** The exact schema-v6 archive manifest. Never reorder or extend this list. */
export const REGISTRY_RECOVERY_V6_TABLES = [
  ...REGISTRY_RECOVERY_V5_TABLES,
  'artist_reconnection_cases',
  'artist_reconnection_events',
  'artist_artwork_records',
  'artist_artwork_record_events',
  'artist_verified_sales',
  'artist_verified_sale_events',
  'artist_verified_sale_items',
  'artist_artwork_media',
  'artist_artwork_ledger_entries',
  'artist_artwork_price_entries',
] as const;

/** The exact schema-v7 archive manifest. Never reorder or extend this list. */
export const REGISTRY_RECOVERY_V7_TABLES = [
  ...REGISTRY_RECOVERY_V6_TABLES,
  'artwork_contributor_invitations',
  'artwork_contributor_revocations',
  'artwork_contributor_invitation_acceptances',
  'artwork_contributor_access_grants',
] as const;

/** The exact schema-v8 archive manifest. Never reorder or extend this list. */
export const REGISTRY_RECOVERY_V8_TABLES = [
  ...REGISTRY_RECOVERY_V7_TABLES,
  'artwork_catalog_snapshots',
  'piece_records',
] as const;

export const REGISTRY_RECOVERY_TABLES = [
  ...REGISTRY_RECOVERY_V8_TABLES,
  'collector_dream_tier_changes',
] as const;

const RECOVERY_CLEANLINESS_TABLES = [
  ...REGISTRY_RECOVERY_TABLES,
  'session',
  'verification',
  'artwork_contributor_invite_rate_limits',
  'artwork_contributor_invite_reservations',
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
  collector_claim_ordinals: [
    'keeper_piece_id', 'first_bound_event_id', 'claim_ordinal',
  ],
  collector_dreams: [
    'id', 'keeper_piece_id', 'author_user_id', 'body', 'scope', 'visibility',
    'idempotency_key', 'record_version', 'created_at', 'updated_at',
    'public_shared_at', 'public_revoked_at', 'fulfilled_at', 'archived_at',
    'last_mutation_id', 'tier', 'heirs_may_share',
  ],
  collector_dream_markers: [
    'id', 'dream_id', 'keeper_piece_id', 'author_user_id', 'marker_kind', 'body',
    'idempotency_key', 'created_at',
  ],
  collector_dream_mutations: [
    'id', 'dream_id', 'author_user_id', 'action', 'idempotency_key',
    'request_json', 'resulting_version', 'created_at',
  ],
  collector_dream_rituals: [
    'id', 'keeper_piece_id', 'keeper_user_id', 'birthday_year', 'action',
    'prior_dream_id', 'resulting_dream_id', 'idempotency_key', 'completed_at',
  ],
  collector_letters: [
    'id', 'keeper_piece_id', 'kind', 'body', 'created_at', 'event_key',
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
  artist_reconnection_cases: [
    'id', 'recipient_email', 'recipient_name', 'private_context', 'status',
    'created_by_user_id', 'idempotency_key', 'request_digest', 'created_at', 'updated_at',
  ],
  artist_artwork_records: [
    'id', 'artwork_id', 'edition_json', 'keeper_piece_id', 'identification_status',
    'record_version', 'last_event_id', 'created_by_user_id', 'created_at', 'updated_at',
  ],
  artist_verified_sales: [
    'id', 'reconnection_case_id', 'occurrence_precision', 'occurred_on', 'buyer_email',
    'currency', 'total_minor', 'private_reference', 'private_notes',
    'verified_by_user_id', 'idempotency_key', 'request_digest', 'recorded_at',
  ],
  artist_reconnection_events: [
    'id', 'reconnection_case_id', 'event_type', 'private_note', 'artwork_record_id',
    'actor_user_id', 'idempotency_key', 'request_digest', 'created_at',
  ],
  artist_artwork_record_events: [
    'id', 'artwork_record_id', 'action', 'before_json', 'after_json',
    'resulting_version', 'actor_user_id', 'idempotency_key', 'request_digest', 'created_at',
  ],
  artist_verified_sale_events: [
    'id', 'sale_id', 'sequence', 'event_type', 'before_json', 'after_json', 'reason',
    'actor_user_id', 'idempotency_key', 'request_digest', 'created_at',
  ],
  artist_verified_sale_items: [
    'id', 'sale_id', 'artwork_record_id', 'amount_minor', 'currency', 'created_at',
  ],
  artist_artwork_media: [
    'id', 'artwork_record_id', 'media_role', 'storage_reference', 'sha256',
    'content_type', 'byte_length', 'uploaded_by_user_id', 'created_at',
  ],
  artist_artwork_ledger_entries: [
    'id', 'artwork_record_id', 'sale_id', 'message', 'media_id', 'created_by_user_id',
    'idempotency_key', 'request_digest', 'created_at',
  ],
  artist_artwork_price_entries: [
    'id', 'artwork_record_id', 'sale_item_id', 'amount_minor', 'currency',
    'occurred_on', 'occurrence_precision', 'recorded_at',
  ],
  artwork_contributor_invitations: [
    'id', 'keeper_piece_id', 'keeper_user_id', 'steward_version',
    'intended_recipient_user_id', 'intended_recipient_email', 'token_hash',
    'idempotency_key', 'request_fingerprint', 'invited_at', 'expires_at',
  ],
  artwork_contributor_revocations: [
    'revocation_kind', 'invitation_id', 'revoked_by_keeper_user_id',
    'steward_version', 'idempotency_key', 'request_fingerprint', 'revoked_at',
  ],
  artwork_contributor_invitation_acceptances: [
    'invitation_id', 'accepted_by_user_id', 'presented_token_hash',
    'idempotency_key', 'request_fingerprint', 'accepted_at',
  ],
  artwork_contributor_access_grants: [
    'invitation_id', 'keeper_piece_id', 'contributor_user_id', 'keeper_user_id',
    'steward_version', 'granted_at',
  ],
  artwork_catalog_snapshots: [
    'id', 'artwork_id', 'snapshot_hash', 'canonical_json', 'source', 'created_at',
  ],
  piece_records: [
    'id', 'public_code', 'record_hash', 'r2_key', 'trigger_event', 'created_at',
  ],
  collector_dream_tier_changes: [
    'id', 'dream_id', 'author_user_id', 'from_tier', 'to_tier', 'idempotency_key',
    'resulting_version', 'created_at',
  ],
};

export type PrivateRecoveryPayload = {
  kind: typeof PRIVATE_RECOVERY_PAYLOAD_KIND;
  schemaVersion: typeof PRIVATE_RECOVERY_SCHEMA_VERSION;
  exportedAt: string;
  tables: Record<RegistryRecoveryTable, RecoveryRow[]>;
};

type LegacyPrivateRecoveryPayload = {
  kind: typeof PRIVATE_RECOVERY_PAYLOAD_KIND;
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
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
    schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | typeof PRIVATE_RECOVERY_SCHEMA_VERSION;
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

const V9_DREAM_COLUMNS = new Set(['tier', 'heirs_may_share']);

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
  collector_claim_ordinals: ['keeper_piece_id'],
  collector_dreams: ['id'],
  collector_dream_markers: ['id'],
  collector_dream_mutations: ['id'],
  collector_dream_rituals: ['id'],
  collector_letters: ['id'],
  artwork_contributor_revocations: ['revocation_kind', 'invitation_id'],
  artwork_contributor_invitation_acceptances: ['invitation_id'],
  artwork_contributor_access_grants: ['invitation_id'],
};

export type RegistryRecoveryOrderColumnType = 'text' | 'number' | 'dynamic';

export const REGISTRY_RECOVERY_ORDER_COLUMN_TYPES: Record<
  RegistryRecoveryTable,
  readonly RegistryRecoveryOrderColumnType[]
> = {
  ...Object.fromEntries(REGISTRY_RECOVERY_TABLES.map((table) => [
    table, REGISTRY_RECOVERY_ORDER_COLUMNS[table].map(() => 'text'),
  ])) as unknown as Record<
    RegistryRecoveryTable,
    readonly RegistryRecoveryOrderColumnType[]
  >,
  users: ['number'],
  profiles: ['number'],
  collector_person_privacy: ['number'],
  artwork_acquisitions: ['dynamic'],
  artwork_provenance_entries: ['dynamic'],
  registry_maintenance_events: ['dynamic'],
  registry_recovery_qualifications: ['dynamic'],
  artwork_contributor_revocations: ['text', 'text'],
};

function recoveryTables(schemaVersion: number): readonly RegistryRecoveryTable[] {
  if (schemaVersion === 1) return REGISTRY_RECOVERY_V1_TABLES;
  if (schemaVersion === 2) return REGISTRY_RECOVERY_V2_TABLES;
  if (schemaVersion === 3) return REGISTRY_RECOVERY_V3_TABLES;
  if (schemaVersion === 4) return REGISTRY_RECOVERY_V4_TABLES;
  if (schemaVersion === 5) return REGISTRY_RECOVERY_V5_TABLES;
  if (schemaVersion === 6) return REGISTRY_RECOVERY_V6_TABLES;
  if (schemaVersion === 7) return REGISTRY_RECOVERY_V7_TABLES;
  if (schemaVersion === 8) return REGISTRY_RECOVERY_V8_TABLES;
  return REGISTRY_RECOVERY_TABLES;
}

function recoveryColumns(table: RegistryRecoveryTable, schemaVersion: number) {
  if (table === 'keeper_pieces' && schemaVersion < 4) {
    return REGISTRY_RECOVERY_COLUMNS.keeper_pieces.filter((column) =>
      !V4_KEEPER_COLUMNS.has(column) && (schemaVersion >= 3 || column !== 'last_transfer_id'));
  }
  if (table === 'collector_dreams' && schemaVersion < 9) {
    return REGISTRY_RECOVERY_COLUMNS.collector_dreams.filter(
      (column) => !V9_DREAM_COLUMNS.has(column));
  }
  return REGISTRY_RECOVERY_COLUMNS[table];
}

function compareUtf8(left: string, right: string): number {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return leftBytes[index] - rightBytes[index];
  }
  return leftBytes.length - rightBytes.length;
}

function compareRecoveryOrderValue(
  left: RecoveryRow[string],
  right: RecoveryRow[string],
  type: RegistryRecoveryOrderColumnType,
): number {
  if (type === 'number') {
    if (typeof left !== 'number' || typeof right !== 'number') {
      throw new Error('recovery_payload_order_type');
    }
    return left - right;
  }
  if (type === 'text') {
    if (typeof left !== 'string' || typeof right !== 'string') {
      throw new Error('recovery_payload_order_type');
    }
    return compareUtf8(left, right);
  }
  const leftNumeric = typeof left === 'number';
  const rightNumeric = typeof right === 'number';
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  if (leftNumeric && rightNumeric) return left - right;
  if (typeof left === 'string' && typeof right === 'string') return compareUtf8(left, right);
  throw new Error('recovery_payload_order_type');
}

function compareRecoveryRows(
  left: RecoveryRow,
  right: RecoveryRow,
  columns: readonly string[],
  types: readonly RegistryRecoveryOrderColumnType[],
): number {
  for (let index = 0; index < columns.length; index += 1) {
    const column = columns[index];
    const leftValue = left[column];
    const rightValue = right[column];
    const comparison = compareRecoveryOrderValue(leftValue, rightValue, types[index]);
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
    || (![1, 2, 3, 4, 5, 6, 7, 8, PRIVATE_RECOVERY_SCHEMA_VERSION].includes(payload.schemaVersion as number))
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
        REGISTRY_RECOVERY_ORDER_COLUMNS[table as RegistryRecoveryTable],
        REGISTRY_RECOVERY_ORDER_COLUMN_TYPES[table as RegistryRecoveryTable]) >= 0) {
        throw new Error(`recovery_payload_order_${table}`);
      }
    }
  }
  if (Number(payload.schemaVersion) >= 5) {
    const firstBoundRows = (payload.tables.artwork_lineage_events as RecoveryRow[])
      .filter((row) => row.event_type === 'first_bound');
    const firstBounds = new Map(firstBoundRows
      .map((row) => [row.keeper_piece_id, row.id]));
    const ordinals = payload.tables.collector_claim_ordinals as RecoveryRow[];
    const ordinalNumbers = ordinals.map((row) => Number(row.claim_ordinal))
      .sort((left, right) => left - right);
    if (firstBoundRows.length !== firstBounds.size
      || ordinals.length !== firstBounds.size
      || ordinals.some((row) => !Number.isSafeInteger(row.claim_ordinal)
        || Number(row.claim_ordinal) < 1)
      || ordinals.some((row) => firstBounds.get(row.keeper_piece_id) !== row.first_bound_event_id)
      || ordinalNumbers.some((ordinal, index) => ordinal !== index + 1)) {
      throw new Error('recovery_claim_ordinals_invalid');
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
        ...(payload.schemaVersion < 4 ? {
          registration_status: row.public_code === null ? null : 'registered',
          registered_by_user_id: null,
          identity_backup_status: null,
          identity_backup_reference: null,
          identity_backup_sha256: null,
          identity_backup_at: null,
        } : {}),
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
      ...(payload.schemaVersion < 4 ? {
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
      } : {}),
      ...(payload.schemaVersion < 5 ? {
        collector_claim_ordinals: [...payload.tables.artwork_lineage_events]
          .filter((row) => row.event_type === 'first_bound')
          .sort((left, right) => compareUtf8(String(left.event_at), String(right.event_at))
            || compareUtf8(String(left.event_hash), String(right.event_hash))
            || compareUtf8(String(left.keeper_piece_id), String(right.keeper_piece_id)))
          .map((row, index) => ({
            keeper_piece_id: row.keeper_piece_id,
            first_bound_event_id: row.id,
            claim_ordinal: index + 1,
          }))
          .sort((left, right) => compareUtf8(
            String(left.keeper_piece_id), String(right.keeper_piece_id),
          )),
        collector_dreams: [],
        collector_dream_markers: [],
        collector_dream_mutations: [],
        collector_dream_rituals: [],
        collector_letters: [],
      } : {}),
      ...(payload.schemaVersion < 6 ? {
        artist_reconnection_cases: [],
        artist_artwork_records: [],
        artist_verified_sales: [],
        artist_reconnection_events: [],
        artist_artwork_record_events: [],
        artist_verified_sale_events: [],
        artist_verified_sale_items: [],
        artist_artwork_media: [],
        artist_artwork_ledger_entries: [],
        artist_artwork_price_entries: [],
      } : {}),
      ...(payload.schemaVersion < 7 ? {
        artwork_contributor_invitations: [],
        artwork_contributor_revocations: [],
        artwork_contributor_invitation_acceptances: [],
        artwork_contributor_access_grants: [],
      } : {}),
      ...(payload.schemaVersion < 8 ? {
        artwork_catalog_snapshots: [],
        piece_records: [],
      } : {}),
      ...(payload.schemaVersion < 9 ? {
        collector_dreams: (
          (payload.tables as { collector_dreams?: RecoveryRow[] }).collector_dreams ?? []
        ).map((row) => ({
          ...row,
          // Mirrors migration 042's ALTER TABLE defaults exactly: every row
          // gets heirs_may_share = 1 (the column default), and the tier
          // backfill UPDATE sets tier = 'shine' for exactly the rows already
          // standing in the light (an open, non-revoked anonymous/attributed
          // share); every other pre-tier row lands on 'keep' (the column
          // default), never 'seal' -- sealing did not exist before this
          // schema version, so no archived row can already be sealed.
          tier: (row.visibility === 'anonymous' || row.visibility === 'attributed')
            && row.public_shared_at !== null
            ? 'shine' : 'keep',
          heirs_may_share: 1,
        })),
        collector_dream_tier_changes: [],
      } : {}),
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
  if ((![1, 2, 3, 4, 5, 6, 7, 8, PRIVATE_RECOVERY_SCHEMA_VERSION].includes(value.manifest.schemaVersion as number))
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
    return lineageOrder || compareUtf8(String(left.id), String(right.id));
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

function parseArtworkRecordSnapshot(value: RecoveryRow[string]) {
  let snapshot: Record<string, unknown>;
  try {
    snapshot = JSON.parse(String(value));
  } catch {
    throw new Error('recovery_artwork_record_event_invalid');
  }
  if (!hasExactKeys(snapshot, [
    'artworkId', 'editionJson', 'keeperPieceId', 'identificationStatus', 'recordVersion',
  ]) || !Number.isSafeInteger(snapshot.recordVersion)) {
    throw new Error('recovery_artwork_record_event_invalid');
  }
  return snapshot;
}

function artworkRecordRestoreStatements(payload: PrivateRecoveryPayload): string[] {
  const eventsByRecord = new Map<string | number, RecoveryRow[]>();
  for (const event of payload.tables.artist_artwork_record_events) {
    const events = eventsByRecord.get(event.artwork_record_id) ?? [];
    events.push(event);
    eventsByRecord.set(event.artwork_record_id, events);
  }
  const statements: string[] = [];
  for (const current of payload.tables.artist_artwork_records) {
    const events = [...(eventsByRecord.get(current.id) ?? [])]
      .sort((left, right) => Number(left.resulting_version) - Number(right.resulting_version));
    if (!events.length) {
      if (current.record_version !== 1 || current.last_event_id !== null) {
        throw new Error('recovery_artwork_record_event_invalid');
      }
      statements.push(insertStatement('artist_artwork_records', current));
      continue;
    }

    const firstBefore = parseArtworkRecordSnapshot(events[0].before_json);
    if (firstBefore.recordVersion !== 1) {
      throw new Error('recovery_artwork_record_event_invalid');
    }
    const initialRow: RecoveryRow = {
      id: current.id,
      artwork_id: firstBefore.artworkId as string | null,
      edition_json: firstBefore.editionJson === null
        ? null : JSON.stringify(firstBefore.editionJson),
      keeper_piece_id: firstBefore.keeperPieceId as string | null,
      identification_status: String(firstBefore.identificationStatus),
      record_version: 1,
      last_event_id: null,
      created_by_user_id: current.created_by_user_id,
      created_at: current.created_at,
      updated_at: current.created_at,
    };
    statements.push(insertStatement('artist_artwork_records', initialRow));

    let prior = firstBefore;
    events.forEach((event, index) => {
      const before = parseArtworkRecordSnapshot(event.before_json);
      const after = parseArtworkRecordSnapshot(event.after_json);
      if (canonicalRecoveryJson(before) !== canonicalRecoveryJson(prior)
        || event.resulting_version !== after.recordVersion
        || Number(event.resulting_version) !== Number(before.recordVersion) + 1) {
        throw new Error('recovery_artwork_record_event_invalid');
      }
      statements.push(insertStatement('artist_artwork_record_events', event));
      const isFinal = index === events.length - 1;
      const artworkId = isFinal ? current.artwork_id : after.artworkId as string | null;
      const editionJson = isFinal ? current.edition_json
        : after.editionJson === null ? null : JSON.stringify(after.editionJson);
      const keeperPieceId = isFinal ? current.keeper_piece_id : after.keeperPieceId as string | null;
      const identificationStatus = isFinal
        ? current.identification_status : String(after.identificationStatus);
      statements.push(
        `UPDATE artist_artwork_records SET `
        + `artwork_id = ${sqlValue(artworkId)}, edition_json = ${sqlValue(editionJson)}, `
        + `keeper_piece_id = ${sqlValue(keeperPieceId)}, `
        + `identification_status = ${sqlValue(identificationStatus)}, `
        + `record_version = ${sqlValue(event.resulting_version)}, `
        + `last_event_id = ${sqlValue(event.id)}, updated_at = ${sqlValue(event.created_at)} `
        + `WHERE id = ${sqlValue(current.id)};`,
      );
      prior = after;
    });
    const finalAfter = prior;
    const finalEdition = finalAfter.editionJson === null
      ? null : JSON.stringify(finalAfter.editionJson);
    if (current.record_version !== finalAfter.recordVersion
      || current.last_event_id !== events.at(-1)?.id
      || current.updated_at !== events.at(-1)?.created_at
      || current.artwork_id !== finalAfter.artworkId
      || current.keeper_piece_id !== finalAfter.keeperPieceId
      || current.identification_status !== finalAfter.identificationStatus
      || (current.edition_json === null ? finalEdition !== null
        : finalEdition === null
          || canonicalRecoveryJson(JSON.parse(String(current.edition_json)))
            !== canonicalRecoveryJson(JSON.parse(String(finalEdition))))) {
      throw new Error('recovery_artwork_record_event_invalid');
    }
  }
  return statements;
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

const CLAIM_ORDINAL_ASSIGN_TRIGGER_SQL = `CREATE TRIGGER artwork_lineage_first_bound_assign_ordinal
AFTER INSERT ON artwork_lineage_events
WHEN NEW.event_type = 'first_bound'
BEGIN
  INSERT INTO collector_claim_ordinals
    (keeper_piece_id, first_bound_event_id, claim_ordinal)
  VALUES (
    NEW.keeper_piece_id,
    NEW.id,
    (SELECT COALESCE(MAX(claim_ordinal), 0) + 1
       FROM collector_claim_ordinals)
  );
END;`;

const DREAM_INSERT_KEEPER_TRIGGER_SQL = `CREATE TRIGGER collector_dreams_insert_current_keeper
BEFORE INSERT ON collector_dreams BEGIN
  SELECT RAISE(ABORT, 'dream requires current keeper') WHERE NOT EXISTS (
    SELECT 1 FROM keeper_pieces piece
     WHERE piece.id = NEW.keeper_piece_id
       AND piece.keeper_user_id = NEW.author_user_id
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND piece.plate_status NOT IN ('void', 'superseded')
  );
  SELECT RAISE(ABORT, 'public dream requires established adult') WHERE NEW.visibility IN ('anonymous', 'attributed')
    AND NOT EXISTS (
      SELECT 1 FROM users person
      JOIN profiles profile ON profile.user_id = person.id
       WHERE person.auth_user_id = NEW.author_user_id
         AND date(profile.birth_date, '+18 years') <= date(NEW.created_at)
    );
  SELECT RAISE(ABORT, 'attributed dream requires name consent') WHERE NEW.visibility = 'attributed'
    AND NOT EXISTS (
      SELECT 1 FROM users person
      JOIN collector_person_privacy privacy ON privacy.user_id = person.id
       WHERE person.auth_user_id = NEW.author_user_id
         AND privacy.share_name = 1
    );
END;`;

const DREAM_MARKER_KEEPER_TRIGGER_SQL = `CREATE TRIGGER collector_dream_markers_current_keeper
BEFORE INSERT ON collector_dream_markers BEGIN
  SELECT RAISE(ABORT, 'dream marker requires current keeper') WHERE NOT EXISTS (
    SELECT 1 FROM collector_dreams dream
    JOIN keeper_pieces piece ON piece.id = dream.keeper_piece_id
     WHERE dream.id = NEW.dream_id
       AND dream.keeper_piece_id = NEW.keeper_piece_id
       AND dream.archived_at IS NULL
       AND piece.keeper_user_id = NEW.author_user_id
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND piece.plate_status NOT IN ('void', 'superseded')
  );
END;`;

const DREAM_RITUAL_COMPLETION_TRIGGER_SQL = `CREATE TRIGGER collector_dream_rituals_valid_completion
BEFORE INSERT ON collector_dream_rituals BEGIN
  SELECT RAISE(ABORT, 'invalid dream ritual completion') WHERE NOT EXISTS (
    SELECT 1 FROM collector_dreams prior
    JOIN collector_dreams resulting ON resulting.id = NEW.resulting_dream_id
    JOIN keeper_pieces piece ON piece.id = NEW.keeper_piece_id
     WHERE prior.id = NEW.prior_dream_id
       AND prior.keeper_piece_id = NEW.keeper_piece_id
       AND resulting.keeper_piece_id = NEW.keeper_piece_id
       AND piece.keeper_user_id = NEW.keeper_user_id
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND piece.plate_status NOT IN ('void', 'superseded')
       AND (
         (NEW.action = 'reinforce' AND prior.id = resulting.id
           AND prior.archived_at IS NULL)
         OR (NEW.action = 'fulfilled' AND prior.id = resulting.id
           AND prior.fulfilled_at IS NULL AND prior.archived_at IS NULL)
         OR (NEW.action = 'plant-new' AND prior.id <> resulting.id
           AND prior.archived_at = NEW.completed_at
           AND resulting.archived_at IS NULL
           AND resulting.created_at = NEW.completed_at)
       )
  );
END;`;

const DREAM_MUTATION_EXACT_TRIGGER_SQL = `CREATE TRIGGER collector_dream_mutation_exact_application
BEFORE INSERT ON collector_dream_mutations
BEGIN
  SELECT RAISE(ABORT, 'dream mutation did not apply exactly') WHERE NEW.request_json IS NULL
    OR json_valid(NEW.request_json) = 0
    OR json_type(NEW.request_json) <> 'object'
    OR NOT EXISTS (
      SELECT 1
        FROM collector_dreams dream
        JOIN keeper_pieces piece ON piece.id = dream.keeper_piece_id
       WHERE dream.id = NEW.dream_id
         AND dream.author_user_id = NEW.author_user_id
         AND dream.archived_at IS NULL
         AND dream.record_version + 1 = NEW.resulting_version
         AND piece.keeper_user_id = NEW.author_user_id
         AND piece.claimed_at IS NOT NULL
         AND piece.released_at IS NULL
         AND piece.plate_status NOT IN ('void', 'superseded')
         AND (
           (
             NEW.action = 'edit'
             AND json_remove(
               NEW.request_json, '$.body', '$.scope', '$.expectedVersion'
             ) = '{}'
             AND json_type(NEW.request_json, '$.body') = 'text'
             AND json_type(NEW.request_json, '$.scope') = 'text'
             AND json_type(NEW.request_json, '$.expectedVersion') = 'integer'
             AND dream.record_version =
               json_extract(NEW.request_json, '$.expectedVersion')
           )
           OR (
             NEW.action = 'share'
             AND json_remove(NEW.request_json, '$.visibility') = '{}'
             AND json_extract(NEW.request_json, '$.visibility')
               IN ('anonymous', 'attributed')
           )
           OR (
             NEW.action = 'revoke'
             AND json_remove(NEW.request_json, '$.visibility') = '{}'
             AND json_extract(NEW.request_json, '$.visibility') = 'private'
             AND dream.public_shared_at IS NOT NULL
             AND dream.tier <> 'shine'
           )
         )
    );
END;`;

const DREAM_MUTATION_APPLY_TRIGGER_SQL = `CREATE TRIGGER collector_dream_mutation_apply_exactly
AFTER INSERT ON collector_dream_mutations
BEGIN
  UPDATE collector_dreams
     SET body = json_extract(NEW.request_json, '$.body'),
         scope = json_extract(NEW.request_json, '$.scope'),
         updated_at = NEW.created_at,
         record_version = record_version + 1,
         last_mutation_id = NEW.id
   WHERE NEW.action = 'edit'
     AND id = NEW.dream_id
     AND author_user_id = NEW.author_user_id
     AND archived_at IS NULL
     AND record_version = json_extract(NEW.request_json, '$.expectedVersion');

  UPDATE collector_dreams
     SET visibility = json_extract(NEW.request_json, '$.visibility'),
         public_shared_at = NEW.created_at,
         public_revoked_at = NULL,
         updated_at = NEW.created_at,
         record_version = record_version + 1,
         last_mutation_id = NEW.id
   WHERE NEW.action = 'share'
     AND id = NEW.dream_id
     AND author_user_id = NEW.author_user_id
     AND archived_at IS NULL
     AND record_version + 1 = NEW.resulting_version;

  UPDATE collector_dreams
     SET visibility = 'private',
         public_revoked_at = NEW.created_at,
         updated_at = NEW.created_at,
         record_version = record_version + 1,
         last_mutation_id = NEW.id
   WHERE NEW.action = 'revoke'
     AND id = NEW.dream_id
     AND author_user_id = NEW.author_user_id
     AND archived_at IS NULL
     AND public_shared_at IS NOT NULL
     AND record_version + 1 = NEW.resulting_version;

  SELECT RAISE(ABORT, 'dream mutation did not apply exactly') WHERE NOT EXISTS (
    SELECT 1 FROM collector_dreams dream
     WHERE dream.id = NEW.dream_id
       AND dream.last_mutation_id = NEW.id
       AND dream.record_version = NEW.resulting_version
       AND dream.updated_at = NEW.created_at
       AND (
         (NEW.action = 'edit'
           AND dream.body = json_extract(NEW.request_json, '$.body')
           AND dream.scope = json_extract(NEW.request_json, '$.scope'))
         OR (NEW.action = 'share'
           AND dream.visibility = json_extract(NEW.request_json, '$.visibility')
           AND dream.public_shared_at = NEW.created_at
           AND dream.public_revoked_at IS NULL)
         OR (NEW.action = 'revoke'
           AND dream.visibility = 'private'
           AND dream.public_shared_at IS NOT NULL
           AND dream.public_revoked_at = NEW.created_at)
       )
  );
END;`;

const DREAM_RUNTIME_UPDATE_GUARD_SQL = `CREATE TRIGGER collector_dreams_runtime_update_guard
BEFORE UPDATE ON collector_dreams
BEGIN
  SELECT RAISE(ABORT, 'dream update requires exact authorization') WHERE NOT (
    EXISTS (
      SELECT 1 FROM collector_dream_mutations mutation
       WHERE mutation.id = NEW.last_mutation_id
         AND mutation.dream_id = OLD.id
         AND mutation.author_user_id = OLD.author_user_id
         AND mutation.resulting_version = OLD.record_version + 1
         AND NEW.record_version = mutation.resulting_version
         AND NEW.updated_at = mutation.created_at
         AND NEW.keeper_piece_id = OLD.keeper_piece_id
         AND NEW.author_user_id = OLD.author_user_id
         AND NEW.idempotency_key = OLD.idempotency_key
         AND NEW.created_at = OLD.created_at
         AND NEW.tier = OLD.tier
         AND NEW.heirs_may_share = OLD.heirs_may_share
         AND (
           (mutation.action = 'edit'
             AND NEW.body = json_extract(mutation.request_json, '$.body')
             AND NEW.scope = json_extract(mutation.request_json, '$.scope')
             AND NEW.visibility = OLD.visibility
             AND NEW.public_shared_at IS OLD.public_shared_at
             AND NEW.public_revoked_at IS OLD.public_revoked_at
             AND NEW.fulfilled_at IS OLD.fulfilled_at
             AND NEW.archived_at IS OLD.archived_at)
           OR (mutation.action = 'share'
             AND NEW.body = OLD.body AND NEW.scope = OLD.scope
             AND NEW.visibility = json_extract(mutation.request_json, '$.visibility')
             AND NEW.public_shared_at = mutation.created_at
             AND NEW.public_revoked_at IS NULL
             AND NEW.fulfilled_at IS OLD.fulfilled_at
             AND NEW.archived_at IS OLD.archived_at)
           OR (mutation.action = 'revoke'
             AND NEW.body = OLD.body AND NEW.scope = OLD.scope
             AND NEW.visibility = 'private'
             AND NEW.public_shared_at IS OLD.public_shared_at
             AND NEW.public_revoked_at = mutation.created_at
             AND NEW.fulfilled_at IS OLD.fulfilled_at
             AND NEW.archived_at IS OLD.archived_at)
         )
    )
    OR EXISTS (
      SELECT 1 FROM collector_dream_tier_changes change
       WHERE change.dream_id = OLD.id
         AND change.author_user_id = OLD.author_user_id
         AND change.from_tier = OLD.tier
         AND change.to_tier = NEW.tier
         AND change.resulting_version = OLD.record_version + 1
         AND NEW.record_version = change.resulting_version
         AND NEW.updated_at = change.created_at
         AND NEW.heirs_may_share = CASE
           WHEN change.to_tier = 'seal' THEN 0 ELSE OLD.heirs_may_share END
         AND NEW.body = OLD.body AND NEW.scope = OLD.scope
         AND NEW.visibility = OLD.visibility
         AND NEW.public_shared_at IS OLD.public_shared_at
         AND NEW.public_revoked_at IS OLD.public_revoked_at
         AND NEW.fulfilled_at IS OLD.fulfilled_at
         AND NEW.archived_at IS OLD.archived_at
         AND NEW.keeper_piece_id = OLD.keeper_piece_id
         AND NEW.author_user_id = OLD.author_user_id
         AND NEW.idempotency_key = OLD.idempotency_key
         AND NEW.created_at = OLD.created_at
         AND NEW.last_mutation_id IS OLD.last_mutation_id
    )
    OR EXISTS (
      SELECT 1 FROM collector_dream_rituals ritual
       WHERE ritual.action = 'fulfilled'
         AND ritual.prior_dream_id = OLD.id
         AND ritual.resulting_dream_id = OLD.id
         AND ritual.completed_at = NEW.fulfilled_at
         AND OLD.fulfilled_at IS NULL
         AND NEW.body = OLD.body AND NEW.scope = OLD.scope
         AND NEW.visibility = OLD.visibility
         AND NEW.public_shared_at IS OLD.public_shared_at
         AND NEW.public_revoked_at IS OLD.public_revoked_at
         AND NEW.archived_at IS OLD.archived_at
         AND NEW.keeper_piece_id = OLD.keeper_piece_id
         AND NEW.author_user_id = OLD.author_user_id
         AND NEW.idempotency_key = OLD.idempotency_key
         AND NEW.created_at = OLD.created_at
         AND NEW.last_mutation_id IS OLD.last_mutation_id
         AND NEW.updated_at = ritual.completed_at
         AND NEW.record_version = OLD.record_version + 1
         AND NEW.tier = OLD.tier
         AND NEW.heirs_may_share = OLD.heirs_may_share
    )
    OR (
      OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL
      AND NEW.updated_at = NEW.archived_at
      AND NEW.record_version = OLD.record_version + 1
      AND NEW.body = OLD.body AND NEW.scope = OLD.scope
      AND NEW.visibility = OLD.visibility
      AND NEW.public_shared_at IS OLD.public_shared_at
      AND NEW.public_revoked_at IS (
        CASE WHEN OLD.public_shared_at IS NOT NULL
          THEN NEW.archived_at ELSE OLD.public_revoked_at END)
      AND NEW.fulfilled_at IS OLD.fulfilled_at
      AND NEW.keeper_piece_id = OLD.keeper_piece_id
      AND NEW.author_user_id = OLD.author_user_id
      AND NEW.idempotency_key = OLD.idempotency_key
      AND NEW.created_at = OLD.created_at
      AND NEW.last_mutation_id IS OLD.last_mutation_id
      AND NEW.tier = OLD.tier
      AND NEW.heirs_may_share = OLD.heirs_may_share
    )
    OR (
      OLD.public_revoked_at IS NULL AND NEW.public_revoked_at IS NOT NULL
      AND NEW.updated_at = NEW.public_revoked_at
      AND NEW.record_version = OLD.record_version + 1
      AND NEW.body = OLD.body AND NEW.scope = OLD.scope
      AND NEW.visibility IN (OLD.visibility, 'private')
      AND NEW.public_shared_at IS OLD.public_shared_at
      AND NEW.fulfilled_at IS OLD.fulfilled_at
      AND NEW.archived_at IS OLD.archived_at
      AND NEW.keeper_piece_id = OLD.keeper_piece_id
      AND NEW.author_user_id = OLD.author_user_id
      AND NEW.idempotency_key = OLD.idempotency_key
      AND NEW.created_at = OLD.created_at
      AND NEW.last_mutation_id IS OLD.last_mutation_id
      AND NEW.tier = OLD.tier
      AND NEW.heirs_may_share = OLD.heirs_may_share
    )
  );
END;`;

// Migration 042's tier-model triggers, recreated verbatim (see
// migrations/042_collector_dream_tiers.sql). collector_dreams_tier_transitions
// and collector_dreams_seal_entry_coherence fire only BEFORE UPDATE, and
// collector_dreams_seal_pins_heirs_update likewise -- restore never updates a
// collector_dreams row, so none of the three can block a restore INSERT.
// They are still dropped and recreated around the bulk insert below, exactly
// like the 029 guards, so the live trigger set is fully accounted for and
// stays byte-identical to a fresh 001-042 migration run.
const DREAM_TIER_TRANSITIONS_TRIGGER_SQL = `CREATE TRIGGER collector_dreams_tier_transitions
BEFORE UPDATE ON collector_dreams
WHEN NEW.tier IS NOT OLD.tier
BEGIN
  SELECT RAISE(ABORT, 'forbidden dream tier transition') WHERE NOT (
    (OLD.tier = 'keep' AND NEW.tier IN ('shine', 'seal'))
    OR (OLD.tier = 'seal' AND NEW.tier = 'shine')
  );
END;`;

const DREAM_SEAL_ENTRY_COHERENCE_TRIGGER_SQL = `CREATE TRIGGER collector_dreams_seal_entry_coherence
BEFORE UPDATE ON collector_dreams
WHEN NEW.tier = 'seal' AND OLD.tier IS NOT 'seal'
BEGIN
  SELECT RAISE(ABORT, 'sealing requires a private never-shone dream')
   WHERE NEW.visibility <> 'private' OR NEW.public_shared_at IS NOT NULL;
END;`;

// BEFORE INSERT: every archived sealed dream already satisfies this shape
// (it is a structural invariant of the live tables the export was taken
// from), so it never blocks a restore INSERT in practice; dropped and
// recreated anyway to mirror collector_dreams_insert_current_keeper above.
const DREAM_SEAL_PINS_HEIRS_INSERT_TRIGGER_SQL = `CREATE TRIGGER collector_dreams_seal_pins_heirs_insert
BEFORE INSERT ON collector_dreams
WHEN NEW.tier = 'seal'
BEGIN
  SELECT RAISE(ABORT, 'a sealed dream pins heirs_may_share to 0')
   WHERE NEW.heirs_may_share <> 0;
  SELECT RAISE(ABORT, 'sealing requires a private never-shone dream')
   WHERE NEW.visibility <> 'private' OR NEW.public_shared_at IS NOT NULL;
END;`;

const DREAM_SEAL_PINS_HEIRS_UPDATE_TRIGGER_SQL = `CREATE TRIGGER collector_dreams_seal_pins_heirs_update
BEFORE UPDATE ON collector_dreams
WHEN NEW.tier = 'seal' AND NEW.heirs_may_share <> 0
BEGIN
  SELECT RAISE(ABORT, 'a sealed dream pins heirs_may_share to 0');
END;`;

// The tier-change ledger's exact-application pair, shaped exactly like
// DREAM_MUTATION_EXACT_TRIGGER_SQL / DREAM_MUTATION_APPLY_TRIGGER_SQL above:
// BEFORE INSERT checks the live dream is at the expected from_tier, AFTER
// INSERT performs the one authorized tier flip. Both must be dropped before
// the bulk collector_dream_tier_changes insert below (a restored ledger row
// already reflects a dream row that restore inserted directly at its final
// tier, not the pre-transition from_tier these triggers expect to find).
// collector_dream_tier_changes_no_update / _no_delete are append-only guards
// like the artwork_catalog_snapshots / piece_records ones noted below --
// they never fire on INSERT, so they are left untouched throughout.
const DREAM_TIER_CHANGE_EXACT_APPLICATION_TRIGGER_SQL = `CREATE TRIGGER collector_dream_tier_change_exact_application
BEFORE INSERT ON collector_dream_tier_changes
BEGIN
  SELECT RAISE(ABORT, 'dream tier change did not apply exactly') WHERE NOT EXISTS (
    SELECT 1
      FROM collector_dreams dream
      JOIN keeper_pieces piece ON piece.id = dream.keeper_piece_id
     WHERE dream.id = NEW.dream_id
       AND dream.author_user_id = NEW.author_user_id
       AND dream.archived_at IS NULL
       AND dream.tier = NEW.from_tier
       AND dream.record_version + 1 = NEW.resulting_version
       AND piece.keeper_user_id = NEW.author_user_id
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND piece.plate_status NOT IN ('void', 'superseded')
       AND (
         (NEW.to_tier = 'shine'
           AND dream.visibility IN ('anonymous', 'attributed')
           AND dream.public_shared_at IS NOT NULL
           AND dream.public_revoked_at IS NULL)
         OR (NEW.to_tier = 'seal'
           AND dream.visibility = 'private'
           AND dream.public_shared_at IS NULL)
       )
  );
END;`;

const DREAM_TIER_CHANGE_APPLY_EXACTLY_TRIGGER_SQL = `CREATE TRIGGER collector_dream_tier_change_apply_exactly
AFTER INSERT ON collector_dream_tier_changes
BEGIN
  UPDATE collector_dreams
     SET tier = NEW.to_tier,
         heirs_may_share = CASE WHEN NEW.to_tier = 'seal' THEN 0 ELSE heirs_may_share END,
         updated_at = NEW.created_at,
         record_version = record_version + 1
   WHERE id = NEW.dream_id
     AND author_user_id = NEW.author_user_id
     AND archived_at IS NULL
     AND tier = NEW.from_tier
     AND record_version + 1 = NEW.resulting_version;

  SELECT RAISE(ABORT, 'dream tier change did not apply exactly') WHERE NOT EXISTS (
    SELECT 1 FROM collector_dreams dream
     WHERE dream.id = NEW.dream_id
       AND dream.tier = NEW.to_tier
       AND dream.record_version = NEW.resulting_version
       AND dream.updated_at = NEW.created_at
       AND (NEW.to_tier <> 'seal' OR dream.heirs_may_share = 0)
  );
END;`;

const DREAM_RITUAL_FULFILL_TRIGGER_SQL = `CREATE TRIGGER collector_dream_ritual_fulfill_exactly
AFTER INSERT ON collector_dream_rituals
WHEN NEW.action = 'fulfilled'
BEGIN
  UPDATE collector_dreams
     SET fulfilled_at = NEW.completed_at,
         updated_at = NEW.completed_at,
         record_version = record_version + 1
   WHERE id = NEW.prior_dream_id
     AND id = NEW.resulting_dream_id
     AND keeper_piece_id = NEW.keeper_piece_id
     AND archived_at IS NULL
     AND fulfilled_at IS NULL;
  SELECT RAISE(ABORT, 'invalid dream ritual completion') WHERE NOT EXISTS (
    SELECT 1 FROM collector_dreams
     WHERE id = NEW.prior_dream_id
       AND fulfilled_at = NEW.completed_at
  );
END;`;

const CONTRIBUTOR_RESTORE_TRIGGER_SQL = [
  `CREATE TRIGGER artwork_contributor_invitation_insert_guard
BEFORE INSERT ON artwork_contributor_invitations
BEGIN
  SELECT RAISE(ABORT, 'contributor invitation requires current keeper and verified recipient') WHERE NOT EXISTS (
    SELECT 1
      FROM keeper_pieces AS piece
      JOIN user AS recipient ON recipient.id = NEW.intended_recipient_user_id
     WHERE piece.id = NEW.keeper_piece_id
       AND piece.keeper_user_id = NEW.keeper_user_id
       AND piece.steward_version = NEW.steward_version
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND recipient.emailVerified = 1
       AND lower(recipient.email) = NEW.intended_recipient_email
       AND recipient.id <> piece.keeper_user_id
  );
  SELECT RAISE(ABORT, 'contributor already active') WHERE EXISTS (
    SELECT 1
      FROM artwork_contributor_current_access AS access
     WHERE access.keeper_piece_id = NEW.keeper_piece_id
       AND access.keeper_user_id = NEW.keeper_user_id
       AND access.steward_version = NEW.steward_version
       AND access.contributor_user_id = NEW.intended_recipient_user_id
  );
  SELECT RAISE(ABORT, 'contributor already invited') WHERE EXISTS (
    SELECT 1
      FROM artwork_contributor_invitations AS invitation
      LEFT JOIN artwork_contributor_invitation_acceptances AS acceptance
        ON acceptance.invitation_id = invitation.id
      LEFT JOIN artwork_contributor_revocations AS invitation_revocation
        ON invitation_revocation.invitation_id = invitation.id
       AND invitation_revocation.revocation_kind = 'invitation'
     WHERE invitation.keeper_piece_id = NEW.keeper_piece_id
       AND invitation.keeper_user_id = NEW.keeper_user_id
       AND invitation.steward_version = NEW.steward_version
       AND invitation.intended_recipient_user_id = NEW.intended_recipient_user_id
       AND acceptance.invitation_id IS NULL
       AND invitation_revocation.invitation_id IS NULL
       AND julianday(invitation.expires_at) > julianday(NEW.invited_at)
       AND NOT EXISTS (
         SELECT 1
           FROM artwork_contributor_access_grants AS prior_grant
           JOIN artwork_contributor_revocations AS prior_revocation
             ON prior_revocation.invitation_id = prior_grant.invitation_id
            AND prior_revocation.revocation_kind = 'access'
          WHERE prior_grant.keeper_piece_id = invitation.keeper_piece_id
            AND prior_grant.contributor_user_id = invitation.intended_recipient_user_id
            AND prior_grant.keeper_user_id = invitation.keeper_user_id
            AND prior_grant.steward_version = invitation.steward_version
            AND julianday(prior_revocation.revoked_at) >= julianday(invitation.invited_at)
       )
  );
END;`,
  `CREATE TRIGGER artwork_contributor_invitation_accept_guard
BEFORE INSERT ON artwork_contributor_invitation_acceptances
BEGIN
  SELECT RAISE(ABORT, 'contributor invitation is not available') WHERE NOT EXISTS (
    SELECT 1
      FROM artwork_contributor_invitations AS invitation
      JOIN keeper_pieces AS piece ON piece.id = invitation.keeper_piece_id
      JOIN user AS recipient ON recipient.id = invitation.intended_recipient_user_id
      LEFT JOIN artwork_contributor_revocations AS revocation
        ON revocation.invitation_id = invitation.id
       AND revocation.revocation_kind = 'invitation'
     WHERE invitation.id = NEW.invitation_id
       AND invitation.intended_recipient_user_id = NEW.accepted_by_user_id
       AND invitation.token_hash = NEW.presented_token_hash
       AND piece.keeper_user_id = invitation.keeper_user_id
       AND piece.steward_version = invitation.steward_version
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND recipient.emailVerified = 1
       AND revocation.invitation_id IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM artwork_claim_requests AS claim
          WHERE claim.keeper_piece_id = invitation.keeper_piece_id
            AND claim.requester_user_id = NEW.accepted_by_user_id
            AND claim.status = 'pending'
       )
       AND NOT EXISTS (
         SELECT 1
           FROM artwork_contributor_access_grants AS prior_grant
           JOIN artwork_contributor_revocations AS prior_revocation
             ON prior_revocation.invitation_id = prior_grant.invitation_id
            AND prior_revocation.revocation_kind = 'access'
          WHERE prior_grant.keeper_piece_id = invitation.keeper_piece_id
            AND prior_grant.contributor_user_id = invitation.intended_recipient_user_id
            AND prior_grant.keeper_user_id = invitation.keeper_user_id
            AND prior_grant.steward_version = invitation.steward_version
            AND julianday(prior_revocation.revoked_at) >= julianday(invitation.invited_at)
       )
       AND julianday(invitation.invited_at) <= julianday(NEW.accepted_at)
       AND julianday(invitation.expires_at) > julianday(NEW.accepted_at)
  );
END;`,
  `CREATE TRIGGER artwork_contributor_invitation_accept_grant
AFTER INSERT ON artwork_contributor_invitation_acceptances
BEGIN
  INSERT INTO artwork_contributor_access_grants
    (invitation_id, keeper_piece_id, contributor_user_id, keeper_user_id,
     steward_version, granted_at)
  SELECT invitation.id, invitation.keeper_piece_id,
         invitation.intended_recipient_user_id, invitation.keeper_user_id,
         invitation.steward_version, NEW.accepted_at
    FROM artwork_contributor_invitations AS invitation
   WHERE invitation.id = NEW.invitation_id;
END;`,
  `CREATE TRIGGER artwork_contributor_grant_guard
BEFORE INSERT ON artwork_contributor_access_grants
BEGIN
  SELECT RAISE(ABORT, 'contributor access grant lacks accepted proof') WHERE NOT EXISTS (
    SELECT 1
      FROM artwork_contributor_invitation_acceptances AS acceptance
      JOIN artwork_contributor_invitations AS invitation
        ON invitation.id = acceptance.invitation_id
     WHERE acceptance.invitation_id = NEW.invitation_id
       AND invitation.keeper_piece_id = NEW.keeper_piece_id
       AND invitation.intended_recipient_user_id = NEW.contributor_user_id
       AND invitation.keeper_user_id = NEW.keeper_user_id
       AND invitation.steward_version = NEW.steward_version
       AND acceptance.accepted_at = NEW.granted_at
       AND NOT EXISTS (
         SELECT 1 FROM artwork_contributor_current_access AS current_access
          WHERE current_access.keeper_piece_id = NEW.keeper_piece_id
            AND current_access.contributor_user_id = NEW.contributor_user_id
       )
  );
END;`,
  `CREATE TRIGGER artwork_contributor_invitation_revoke_guard
BEFORE INSERT ON artwork_contributor_revocations
WHEN NEW.revocation_kind = 'invitation'
BEGIN
  SELECT RAISE(ABORT, 'contributor invitation cannot be revoked') WHERE NOT EXISTS (
    SELECT 1
      FROM artwork_contributor_invitations AS invitation
      JOIN keeper_pieces AS piece ON piece.id = invitation.keeper_piece_id
     WHERE invitation.id = NEW.invitation_id
       AND invitation.keeper_user_id = NEW.revoked_by_keeper_user_id
       AND invitation.steward_version = NEW.steward_version
       AND piece.keeper_user_id = invitation.keeper_user_id
       AND piece.steward_version = invitation.steward_version
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND julianday(NEW.revoked_at) >= julianday(invitation.invited_at)
       AND julianday(NEW.revoked_at) < julianday(invitation.expires_at)
       AND NOT EXISTS (
         SELECT 1 FROM artwork_contributor_invitation_acceptances AS acceptance
          WHERE acceptance.invitation_id = invitation.id
       )
  );
END;`,
  `CREATE TRIGGER artwork_contributor_access_revoke_guard
BEFORE INSERT ON artwork_contributor_revocations
WHEN NEW.revocation_kind = 'access'
BEGIN
  SELECT RAISE(ABORT, 'contributor access cannot be revoked') WHERE NOT EXISTS (
    SELECT 1
      FROM artwork_contributor_current_access AS access
     WHERE access.invitation_id = NEW.invitation_id
       AND access.keeper_user_id = NEW.revoked_by_keeper_user_id
       AND access.steward_version = NEW.steward_version
       AND julianday(NEW.revoked_at) >= julianday(access.granted_at)
  );
END;`,
] as const;

const CONTRIBUTOR_RESTORE_TRIGGER_NAMES = [
  'artwork_contributor_invitation_insert_guard',
  'artwork_contributor_invitation_accept_guard',
  'artwork_contributor_invitation_accept_grant',
  'artwork_contributor_grant_guard',
  'artwork_contributor_invitation_revoke_guard',
  'artwork_contributor_access_revoke_guard',
] as const;

const CONTRIBUTOR_OPERATIONAL_TRIGGER_SQL = [
  `CREATE TRIGGER artwork_contributor_invite_reservation_guard
BEFORE INSERT ON artwork_contributor_invitations
WHEN EXISTS (
  SELECT 1 FROM artwork_contributor_invite_reservations
   WHERE idempotency_key = NEW.idempotency_key
)
BEGIN
  SELECT RAISE(ABORT, 'contributor invite reservation unavailable') WHERE NOT EXISTS (
    SELECT 1 FROM artwork_contributor_invite_reservations
     WHERE idempotency_key = NEW.idempotency_key
       AND request_fingerprint = NEW.request_fingerprint
       AND keeper_user_id = NEW.keeper_user_id
       AND reservation_status = 'reserved'
       AND completed_invitation_id IS NULL
       AND julianday(lease_expires_at) > julianday('now')
  );
END;`,
  `CREATE TRIGGER artwork_contributor_invite_rate_limit_guard
BEFORE INSERT ON artwork_contributor_invitations
BEGIN
  INSERT INTO artwork_contributor_invite_rate_limits
    (keeper_user_id, window_started_at, attempt_count, last_attempt_at)
  VALUES (
    NEW.keeper_user_id,
    strftime('%Y-%m-%dT%H:00:00.000Z', NEW.invited_at),
    1,
    NEW.invited_at
  )
  ON CONFLICT(keeper_user_id) DO UPDATE SET
    window_started_at = excluded.window_started_at,
    attempt_count = CASE
      WHEN excluded.window_started_at
           > artwork_contributor_invite_rate_limits.window_started_at THEN 1
      ELSE artwork_contributor_invite_rate_limits.attempt_count + 1
    END,
    last_attempt_at = excluded.last_attempt_at
  WHERE (
    excluded.window_started_at
      > artwork_contributor_invite_rate_limits.window_started_at
    OR (
      excluded.window_started_at
        = artwork_contributor_invite_rate_limits.window_started_at
      AND artwork_contributor_invite_rate_limits.attempt_count < 10
    )
  );
  SELECT RAISE(ABORT, 'contributor invite rate limited') WHERE changes() <> 1;
END;`,
  `CREATE TRIGGER artwork_contributor_invite_reservation_complete
AFTER INSERT ON artwork_contributor_invitations
WHEN EXISTS (
  SELECT 1 FROM artwork_contributor_invite_reservations
   WHERE idempotency_key = NEW.idempotency_key
)
BEGIN
  UPDATE artwork_contributor_invite_reservations
     SET reservation_status = 'completed',
         completed_invitation_id = NEW.id,
         completed_at = NEW.invited_at
   WHERE idempotency_key = NEW.idempotency_key
     AND request_fingerprint = NEW.request_fingerprint
     AND keeper_user_id = NEW.keeper_user_id
     AND reservation_status = 'reserved';
  SELECT RAISE(ABORT, 'contributor invite reservation completion failed') WHERE changes() <> 1;
END;`,
] as const;

const CONTRIBUTOR_OPERATIONAL_TRIGGER_NAMES = [
  'artwork_contributor_invite_reservation_guard',
  'artwork_contributor_invite_rate_limit_guard',
  'artwork_contributor_invite_reservation_complete',
] as const;

/**
 * Generate offline-only SQL after the encrypted artifact has been fully
 * authenticated. Every insert is guarded, conflict-failing and transactional.
 * A failed cleanliness guard rolls back before any target mutation; per-table
 * temporary triggers keep later statements fail-closed even in a permissive
 * SQL runner that continues after the first error. A final expected-count
 * trigger rolls back the whole transaction if any insert was skipped or failed.
 */
function buildRegistryRestoreSqlInternal(
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
      + [
        ...REGISTRY_RECOVERY_TABLES.map((table) =>
          `(SELECT COUNT(*) FROM ${sqlIdentifier(table)}) <> ${payload.tables[table].length}`),
        ...CONTRIBUTOR_RESTORE_TRIGGER_NAMES.map((trigger, index) =>
          `NOT EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'trigger' `
          + `AND name = ${sqlValue(trigger)} `
          + `AND sql = ${sqlValue(CONTRIBUTOR_RESTORE_TRIGGER_SQL[index].slice(0, -1))})`),
        ...CONTRIBUTOR_OPERATIONAL_TRIGGER_NAMES.map((trigger, index) =>
          `NOT EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'trigger' `
          + `AND name = ${sqlValue(trigger)} `
          + `AND sql = ${sqlValue(CONTRIBUTOR_OPERATIONAL_TRIGGER_SQL[index].slice(0, -1))})`),
        '(SELECT COUNT(*) FROM artwork_contributor_invite_rate_limits) <> 0',
        '(SELECT COUNT(*) FROM artwork_contributor_invite_reservations) <> 0',
      ].join(' OR ')
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
    'artwork_provenance_entries', 'artwork_claim_evidence',
  ]);
  statements.push('DROP TRIGGER artwork_lineage_first_bound_assign_ordinal;');
  insertTables(['artwork_lineage_events', 'collector_claim_ordinals']);
  statements.push(CLAIM_ORDINAL_ASSIGN_TRIGGER_SQL);
  insertTables([
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
  statements.push('DROP TRIGGER collector_dreams_insert_current_keeper;');
  statements.push('DROP TRIGGER collector_dream_markers_current_keeper;');
  statements.push('DROP TRIGGER collector_dream_rituals_valid_completion;');
  statements.push('DROP TRIGGER collector_dream_mutation_exact_application;');
  statements.push('DROP TRIGGER collector_dream_mutation_apply_exactly;');
  statements.push('DROP TRIGGER collector_dreams_runtime_update_guard;');
  statements.push('DROP TRIGGER collector_dream_ritual_fulfill_exactly;');
  statements.push('DROP TRIGGER collector_dreams_tier_transitions;');
  statements.push('DROP TRIGGER collector_dreams_seal_entry_coherence;');
  statements.push('DROP TRIGGER collector_dreams_seal_pins_heirs_insert;');
  statements.push('DROP TRIGGER collector_dreams_seal_pins_heirs_update;');
  statements.push('DROP TRIGGER collector_dream_tier_change_exact_application;');
  statements.push('DROP TRIGGER collector_dream_tier_change_apply_exactly;');
  insertTables([
    'collector_dreams', 'collector_dream_markers', 'collector_dream_mutations',
    'collector_dream_rituals', 'collector_dream_tier_changes',
  ]);
  statements.push(DREAM_INSERT_KEEPER_TRIGGER_SQL);
  statements.push(DREAM_MARKER_KEEPER_TRIGGER_SQL);
  statements.push(DREAM_RITUAL_COMPLETION_TRIGGER_SQL);
  statements.push(DREAM_MUTATION_EXACT_TRIGGER_SQL);
  statements.push(DREAM_MUTATION_APPLY_TRIGGER_SQL);
  statements.push(DREAM_RUNTIME_UPDATE_GUARD_SQL);
  statements.push(DREAM_RITUAL_FULFILL_TRIGGER_SQL);
  statements.push(DREAM_TIER_TRANSITIONS_TRIGGER_SQL);
  statements.push(DREAM_SEAL_ENTRY_COHERENCE_TRIGGER_SQL);
  statements.push(DREAM_SEAL_PINS_HEIRS_INSERT_TRIGGER_SQL);
  statements.push(DREAM_SEAL_PINS_HEIRS_UPDATE_TRIGGER_SQL);
  statements.push(DREAM_TIER_CHANGE_EXACT_APPLICATION_TRIGGER_SQL);
  statements.push(DREAM_TIER_CHANGE_APPLY_EXACTLY_TRIGGER_SQL);
  // collector_dream_tier_changes_no_update / _no_delete never fire on
  // INSERT (mirrors the artwork_catalog_snapshots / piece_records note
  // below), so they stay untouched throughout.
  insertTables(['collector_letters']);
  insertTables(['artist_reconnection_cases']);
  statements.push(...artworkRecordRestoreStatements(payload));
  insertTables([
    'artist_verified_sales', 'artist_reconnection_events',
  ]);
  for (const event of [...payload.tables.artist_verified_sale_events]
    .sort((left, right) => compareUtf8(String(left.sale_id), String(right.sale_id))
      || Number(left.sequence) - Number(right.sequence)
      || compareUtf8(String(left.id), String(right.id)))) {
    statements.push(insertStatement('artist_verified_sale_events', event));
  }
  insertTables([
    'artist_verified_sale_items', 'artist_artwork_media',
    'artist_artwork_ledger_entries', 'artist_artwork_price_entries',
  ]);
  // Append-only permanent-record tables (migrations 035 and 036). Their
  // no-update/no-delete triggers do not block restore inserts, and the
  // piece_records address-pin trigger holds because every archived row was
  // written through it.
  insertTables(['artwork_catalog_snapshots', 'piece_records']);
  for (const trigger of CONTRIBUTOR_RESTORE_TRIGGER_NAMES) {
    statements.push(`DROP TRIGGER ${trigger};`);
  }
  for (const trigger of CONTRIBUTOR_OPERATIONAL_TRIGGER_NAMES) {
    statements.push(`DROP TRIGGER ${trigger};`);
  }
  insertTables([
    'artwork_contributor_invitations',
    'artwork_contributor_invitation_acceptances',
    'artwork_contributor_access_grants',
    'artwork_contributor_revocations',
  ]);
  statements.push(...CONTRIBUTOR_RESTORE_TRIGGER_SQL);
  statements.push(...CONTRIBUTOR_OPERATIONAL_TRIGGER_SQL);
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

/**
 * Synchronous restore generation remains available for archives without media.
 * Archives that reference R2 objects must pass the asynchronous media preflight.
 */
export function buildRegistryRestoreSql(
  sourcePayload: PrivateRecoveryPayload | LegacyPrivateRecoveryPayload,
): string {
  const payload = upgradePrivateRecoveryPayload(sourcePayload);
  if (payload.tables.artist_artwork_media.length) {
    throw new Error('registry_recovery_media_verification_required');
  }
  return buildRegistryRestoreSqlInternal(payload);
}

type RecoveryMediaBucket = {
  get(reference: string): Promise<unknown>;
};

function recoveryMediaContentType(object: Record<string, unknown>): string | null {
  const metadata = object.httpMetadata;
  if (isPlainObject(metadata) && typeof metadata.contentType === 'string') {
    return metadata.contentType;
  }
  return typeof object.contentType === 'string' ? object.contentType : null;
}

async function readRecoveryMediaBytes(
  object: Record<string, unknown>,
  expectedLength: number,
): Promise<Uint8Array> {
  const body = object.body as {
    getReader?: () => { read(): Promise<{ done: boolean; value?: Uint8Array }> };
  } | undefined;
  if (body && typeof body.getReader === 'function') {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      if (!(result.value instanceof Uint8Array)) {
        throw new Error('registry_recovery_media_unreadable');
      }
      length += result.value.byteLength;
      if (length > expectedLength) {
        throw new Error('registry_recovery_media_length_mismatch');
      }
      chunks.push(result.value);
    }
    if (length !== expectedLength) throw new Error('registry_recovery_media_length_mismatch');
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  }
  if (typeof object.arrayBuffer === 'function') {
    const bytes = new Uint8Array(await (object.arrayBuffer as () => Promise<ArrayBuffer>)());
    if (bytes.byteLength !== expectedLength) {
      throw new Error('registry_recovery_media_length_mismatch');
    }
    return bytes;
  }
  throw new Error('registry_recovery_media_unreadable');
}

async function verifyRecoveryMediaObjects(
  payload: PrivateRecoveryPayload,
  mediaBucket: RecoveryMediaBucket | undefined,
) {
  if (!payload.tables.artist_artwork_media.length) return;
  if (!mediaBucket || typeof mediaBucket.get !== 'function') {
    throw new Error('registry_recovery_media_bucket_required');
  }
  for (const media of payload.tables.artist_artwork_media) {
    let object: unknown;
    try {
      object = await mediaBucket.get(String(media.storage_reference));
    } catch {
      throw new Error('registry_recovery_media_unreadable');
    }
    if (!isPlainObject(object)) throw new Error('registry_recovery_media_missing');
    if (typeof object.size === 'number' && object.size !== media.byte_length) {
      throw new Error('registry_recovery_media_length_mismatch');
    }
    if (recoveryMediaContentType(object) !== media.content_type) {
      throw new Error('registry_recovery_media_content_type_mismatch');
    }
    let bytes: Uint8Array;
    try {
      bytes = await readRecoveryMediaBytes(object, Number(media.byte_length));
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('registry_recovery_media_')) {
        throw error;
      }
      throw new Error('registry_recovery_media_unreadable');
    }
    if (await sha256(bytes) !== media.sha256) {
      throw new Error('registry_recovery_media_digest_mismatch');
    }
  }
}

/** Verify every archived private media reference before any restore SQL exists. */
export async function buildVerifiedRegistryRestoreSql(
  sourcePayload: PrivateRecoveryPayload | LegacyPrivateRecoveryPayload,
  options: { mediaBucket?: RecoveryMediaBucket } = {},
): Promise<string> {
  const payload = upgradePrivateRecoveryPayload(sourcePayload);
  await verifyRecoveryMediaObjects(payload, options.mediaBucket);
  return buildRegistryRestoreSqlInternal(payload);
}
