import {
  encryptPrivateRecoveryPayload,
  PRIVATE_RECOVERY_PAYLOAD_KIND,
  PRIVATE_RECOVERY_SCHEMA_VERSION,
  REGISTRY_RECOVERY_ORDER_COLUMNS,
  REGISTRY_RECOVERY_TABLES,
} from '../../../utils/registryRecoveryArchive.ts';

export { REGISTRY_RECOVERY_TABLES };

function plainRows(result) {
  return (Array.isArray(result?.results) ? result.results : []).map((row) => ({ ...row }));
}

const REFERENCED_AUTH_USER_IDS_SQL = `
  SELECT keeper_user_id AS id FROM keeper_pieces WHERE keeper_user_id IS NOT NULL
  UNION SELECT author_user_id FROM keeper_intentions WHERE author_user_id IS NOT NULL
  UNION SELECT actor_user_id FROM artwork_claim_evidence WHERE actor_user_id IS NOT NULL
  UNION SELECT requester_user_id FROM artwork_claim_requests WHERE requester_user_id IS NOT NULL
  UNION SELECT routed_to_user_id FROM artwork_claim_requests WHERE routed_to_user_id IS NOT NULL
  UNION SELECT resolved_by_user_id FROM artwork_claim_requests WHERE resolved_by_user_id IS NOT NULL
  UNION SELECT expected_from_user_id FROM artwork_transfer_intents WHERE expected_from_user_id IS NOT NULL
  UNION SELECT target_user_id FROM artwork_transfer_intents WHERE target_user_id IS NOT NULL
  UNION SELECT user_id FROM artwork_transfer_parties WHERE user_id IS NOT NULL
  UNION SELECT administrator_user_id FROM registry_maintenance_events
    WHERE administrator_user_id IS NOT NULL
  UNION SELECT administrator_user_id FROM registry_recovery_qualifications
    WHERE administrator_user_id IS NOT NULL
  UNION SELECT registered_by_user_id FROM keeper_pieces WHERE registered_by_user_id IS NOT NULL
  UNION SELECT administrator_user_id FROM artwork_identity_recovery_qualifications
    WHERE administrator_user_id IS NOT NULL
  UNION SELECT created_by_user_id FROM artwork_invitations WHERE created_by_user_id IS NOT NULL
  UNION SELECT revoked_by_user_id FROM artwork_invitations WHERE revoked_by_user_id IS NOT NULL
  UNION SELECT redeemed_by_user_id FROM artwork_invitation_redemptions
    WHERE redeemed_by_user_id IS NOT NULL
  UNION SELECT created_by_user_id FROM certificate_templates WHERE created_by_user_id IS NOT NULL
  UNION SELECT assigned_by_user_id FROM certificate_assignment_operations
    WHERE assigned_by_user_id IS NOT NULL
  UNION SELECT updated_by_user_id FROM certificate_artwork_overrides
    WHERE updated_by_user_id IS NOT NULL
  UNION SELECT changed_by_user_id FROM certificate_override_history
    WHERE changed_by_user_id IS NOT NULL
  UNION SELECT author_user_id FROM collector_dreams WHERE author_user_id IS NOT NULL
  UNION SELECT author_user_id FROM collector_dream_markers WHERE author_user_id IS NOT NULL
  UNION SELECT author_user_id FROM collector_dream_mutations WHERE author_user_id IS NOT NULL
  UNION SELECT keeper_user_id FROM collector_dream_rituals WHERE keeper_user_id IS NOT NULL
  UNION SELECT created_by_user_id FROM artist_reconnection_cases
    WHERE created_by_user_id IS NOT NULL
  UNION SELECT created_by_user_id FROM artist_artwork_records
    WHERE created_by_user_id IS NOT NULL
  UNION SELECT verified_by_user_id FROM artist_verified_sales
    WHERE verified_by_user_id IS NOT NULL
  UNION SELECT actor_user_id FROM artist_reconnection_events
    WHERE actor_user_id IS NOT NULL
  UNION SELECT actor_user_id FROM artist_artwork_record_events
    WHERE actor_user_id IS NOT NULL
  UNION SELECT actor_user_id FROM artist_verified_sale_events
    WHERE actor_user_id IS NOT NULL
  UNION SELECT uploaded_by_user_id FROM artist_artwork_media
    WHERE uploaded_by_user_id IS NOT NULL
  UNION SELECT created_by_user_id FROM artist_artwork_ledger_entries
    WHERE created_by_user_id IS NOT NULL
  UNION SELECT bridge.auth_user_id FROM users AS bridge
    WHERE bridge.id IN (
      SELECT user_id FROM collector_person_privacy
      UNION SELECT user_id FROM collector_piece_privacy
      UNION SELECT user_id FROM collector_consent_history
    ) AND bridge.auth_user_id IS NOT NULL
  UNION SELECT COALESCE(
      json_extract(before_json, '$.keeperUserId'),
      json_extract(before_json, '$.keeper_user_id')
    ) FROM registry_maintenance_events
    WHERE json_valid(before_json) AND COALESCE(
      json_extract(before_json, '$.keeperUserId'),
      json_extract(before_json, '$.keeper_user_id')
    ) IS NOT NULL
  UNION SELECT COALESCE(
      json_extract(after_json, '$.keeperUserId'),
      json_extract(after_json, '$.keeper_user_id')
    ) FROM registry_maintenance_events
    WHERE json_valid(after_json) AND COALESCE(
      json_extract(after_json, '$.keeperUserId'),
      json_extract(after_json, '$.keeper_user_id')
    ) IS NOT NULL
`;

const REFERENCED_COLLECTOR_USER_IDS_SQL = `
  SELECT user_id AS id FROM collector_person_privacy
  UNION SELECT user_id FROM collector_piece_privacy
  UNION SELECT user_id FROM collector_consent_history
  UNION SELECT person.id FROM users AS person
    WHERE person.auth_user_id IN (
      SELECT author_user_id FROM collector_dreams
      UNION SELECT author_user_id FROM collector_dream_markers
      UNION SELECT author_user_id FROM collector_dream_mutations
      UNION SELECT keeper_user_id FROM collector_dream_rituals
    )
`;

function tableStatement(env, table) {
  if (table === 'user') {
    return env.DB.prepare(
      `WITH referenced_users(id) AS (${REFERENCED_AUTH_USER_IDS_SQL})
       SELECT auth_user.* FROM "user" AS auth_user
       JOIN referenced_users ON referenced_users.id = auth_user.id
       ORDER BY auth_user.id ASC`,
    );
  }
  if (table === 'account') {
    return env.DB.prepare(
      `WITH referenced_users(id) AS (${REFERENCED_AUTH_USER_IDS_SQL})
       SELECT auth_account.* FROM "account" AS auth_account
       JOIN referenced_users ON referenced_users.id = auth_account.userId
       ORDER BY auth_account.id ASC`,
    );
  }
  if (table === 'users') {
    return env.DB.prepare(
      `WITH referenced_users(id) AS (${REFERENCED_COLLECTOR_USER_IDS_SQL})
       SELECT collector_user.* FROM users AS collector_user
       JOIN referenced_users ON referenced_users.id = collector_user.id
       ORDER BY collector_user.id ASC`,
    );
  }
  if (table === 'profiles') {
    return env.DB.prepare(
      `WITH referenced_users(id) AS (${REFERENCED_COLLECTOR_USER_IDS_SQL})
       SELECT profile.* FROM profiles AS profile
       JOIN referenced_users ON referenced_users.id = profile.user_id
       ORDER BY profile.user_id ASC`,
    );
  }
  const order = REGISTRY_RECOVERY_ORDER_COLUMNS[table]
    .map((column) => `"${column}" ASC`).join(', ');
  return env.DB.prepare(`SELECT * FROM "${table}" ORDER BY ${order}`);
}

function collectUserIdsFromValue(value, ids) {
  if (Array.isArray(value)) {
    for (const entry of value) collectUserIdsFromValue(entry, ids);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, entry] of Object.entries(value)) {
    if (['keeperUserId', 'keeper_user_id', 'authorUserId', 'actorUserId'].includes(key)
      && typeof entry === 'string' && entry) ids.add(entry);
    collectUserIdsFromValue(entry, ids);
  }
}

function collectReferencedAuthUserIds(tables) {
  const ids = new Set();
  for (const row of tables.keeper_pieces) {
    if (typeof row.keeper_user_id === 'string' && row.keeper_user_id) ids.add(row.keeper_user_id);
  }
  for (const row of tables.keeper_intentions) {
    if (typeof row.author_user_id === 'string' && row.author_user_id) ids.add(row.author_user_id);
  }
  for (const row of tables.artwork_claim_evidence) {
    if (typeof row.actor_user_id === 'string' && row.actor_user_id) ids.add(row.actor_user_id);
  }
  for (const row of tables.artwork_claim_requests) {
    for (const field of ['requester_user_id', 'routed_to_user_id', 'resolved_by_user_id']) {
      if (typeof row[field] === 'string' && row[field]) ids.add(row[field]);
    }
  }
  for (const row of tables.artwork_transfer_intents) {
    for (const field of ['expected_from_user_id', 'target_user_id']) {
      if (typeof row[field] === 'string' && row[field]) ids.add(row[field]);
    }
  }
  for (const row of tables.artwork_transfer_parties) {
    if (typeof row.user_id === 'string' && row.user_id) ids.add(row.user_id);
  }
  for (const table of ['registry_maintenance_events', 'registry_recovery_qualifications']) {
    for (const row of tables[table]) {
      if (typeof row.administrator_user_id === 'string' && row.administrator_user_id) {
        ids.add(row.administrator_user_id);
      }
    }
  }
  for (const row of tables.keeper_pieces) {
    if (typeof row.registered_by_user_id === 'string' && row.registered_by_user_id) {
      ids.add(row.registered_by_user_id);
    }
  }
  for (const row of tables.artwork_identity_recovery_qualifications) {
    if (typeof row.administrator_user_id === 'string' && row.administrator_user_id) {
      ids.add(row.administrator_user_id);
    }
  }
  for (const row of tables.artwork_invitations) {
    for (const field of ['created_by_user_id', 'revoked_by_user_id']) {
      if (typeof row[field] === 'string' && row[field]) ids.add(row[field]);
    }
  }
  for (const row of tables.artwork_invitation_redemptions) {
    if (typeof row.redeemed_by_user_id === 'string' && row.redeemed_by_user_id) {
      ids.add(row.redeemed_by_user_id);
    }
  }
  for (const [table, field] of [
    ['certificate_templates', 'created_by_user_id'],
    ['certificate_assignment_operations', 'assigned_by_user_id'],
    ['certificate_artwork_overrides', 'updated_by_user_id'],
    ['certificate_override_history', 'changed_by_user_id'],
  ]) {
    for (const row of tables[table]) {
      if (typeof row[field] === 'string' && row[field]) ids.add(row[field]);
    }
  }
  for (const [table, field] of [
    ['artist_reconnection_cases', 'created_by_user_id'],
    ['artist_artwork_records', 'created_by_user_id'],
    ['artist_verified_sales', 'verified_by_user_id'],
    ['artist_reconnection_events', 'actor_user_id'],
    ['artist_artwork_record_events', 'actor_user_id'],
    ['artist_verified_sale_events', 'actor_user_id'],
    ['artist_artwork_media', 'uploaded_by_user_id'],
    ['artist_artwork_ledger_entries', 'created_by_user_id'],
  ]) {
    for (const row of tables[table]) {
      if (typeof row[field] === 'string' && row[field]) ids.add(row[field]);
    }
  }
  for (const [table, field] of [
    ['collector_dreams', 'author_user_id'],
    ['collector_dream_markers', 'author_user_id'],
    ['collector_dream_mutations', 'author_user_id'],
    ['collector_dream_rituals', 'keeper_user_id'],
  ]) {
    for (const row of tables[table]) {
      if (typeof row[field] === 'string' && row[field]) ids.add(row[field]);
    }
  }
  for (const row of tables.users) {
    if (typeof row.auth_user_id === 'string' && row.auth_user_id) ids.add(row.auth_user_id);
  }
  for (const row of tables.registry_maintenance_events) {
    for (const field of ['before_json', 'after_json']) {
      try {
        collectUserIdsFromValue(JSON.parse(row[field]), ids);
      } catch {
        throw new Error('registry_recovery_malformed_maintenance_event');
      }
    }
  }
  return [...ids].sort();
}

export async function buildPrivateRecoveryExport(env, options = {}) {
  if (!env?.DB) throw new Error('registry_recovery_db_required');
  const key = env.REGISTRY_RECOVERY_EXPORT_KEY;
  const keyId = env.REGISTRY_RECOVERY_EXPORT_KEY_ID;
  if (typeof key !== 'string' || !key || typeof keyId !== 'string' || !keyId) {
    throw new Error('registry_recovery_export_not_configured');
  }
  const exportedAt = options.exportedAt || new Date().toISOString();
  if (typeof env.DB.batch !== 'function') throw new Error('registry_recovery_snapshot_unavailable');
  const results = await env.DB.batch(
    REGISTRY_RECOVERY_TABLES.map((table) => tableStatement(env, table)),
  );
  if (!Array.isArray(results) || results.length !== REGISTRY_RECOVERY_TABLES.length) {
    throw new Error('registry_recovery_snapshot_incomplete');
  }
  const orderedTables = {};
  REGISTRY_RECOVERY_TABLES.forEach((table, index) => {
    orderedTables[table] = plainRows(results[index]);
  });
  const referencedIds = collectReferencedAuthUserIds(orderedTables);
  const exportedUserIds = orderedTables.user.map((row) => row.id).sort();
  if (referencedIds.length !== exportedUserIds.length
    || referencedIds.some((id, index) => id !== exportedUserIds[index])) {
    throw new Error('registry_recovery_missing_referenced_user');
  }
  const referencedCollectorIds = [...new Set([
    ...orderedTables.collector_person_privacy.map((row) => row.user_id),
    ...orderedTables.collector_piece_privacy.map((row) => row.user_id),
    ...orderedTables.collector_consent_history.map((row) => row.user_id),
    ...orderedTables.users
      .filter((row) => [
        ...orderedTables.collector_dreams.map((dream) => dream.author_user_id),
        ...orderedTables.collector_dream_markers.map((marker) => marker.author_user_id),
        ...orderedTables.collector_dream_mutations.map((mutation) => mutation.author_user_id),
        ...orderedTables.collector_dream_rituals.map((ritual) => ritual.keeper_user_id),
      ].includes(row.auth_user_id))
      .map((row) => row.id),
  ])].sort((left, right) => Number(left) - Number(right));
  const exportedCollectorIds = orderedTables.users.map((row) => row.id);
  if (referencedCollectorIds.length !== exportedCollectorIds.length
    || referencedCollectorIds.some((id, index) => id !== exportedCollectorIds[index])) {
    throw new Error('registry_recovery_missing_collector_user');
  }
  if (orderedTables.users.some((row) =>
    typeof row.auth_user_id !== 'string' || !row.auth_user_id.trim())) {
    throw new Error('registry_recovery_missing_collector_auth_user');
  }
  const profiledIds = new Set(orderedTables.profiles.map((row) => row.user_id));
  const publicDreamAuthors = new Set(orderedTables.collector_dreams
    .filter((row) => row.visibility !== 'private'
      && row.public_shared_at !== null && row.public_revoked_at === null)
    .map((row) => row.author_user_id));
  const publicDreamUserIds = orderedTables.users
    .filter((row) => publicDreamAuthors.has(row.auth_user_id))
    .map((row) => row.id);
  if (publicDreamUserIds.length !== publicDreamAuthors.size) {
    throw new Error('registry_recovery_missing_collector_profile');
  }
  const openUserIds = new Set([
    ...orderedTables.collector_person_privacy
      .filter((row) => [
        row.share_derived_chart, row.share_face, row.share_name, row.share_intention,
        row.share_business, row.share_mission,
      ].some((value) => value === 1)).map((row) => row.user_id),
    ...orderedTables.collector_piece_privacy
      .filter((row) => row.share_city === 1).map((row) => row.user_id),
    ...publicDreamUserIds,
  ]);
  if ([...openUserIds].some((id) => !profiledIds.has(id))) {
    throw new Error('registry_recovery_missing_collector_profile');
  }
  return encryptPrivateRecoveryPayload({
    kind: PRIVATE_RECOVERY_PAYLOAD_KIND,
    schemaVersion: PRIVATE_RECOVERY_SCHEMA_VERSION,
    exportedAt,
    tables: orderedTables,
  }, { key, keyId });
}
