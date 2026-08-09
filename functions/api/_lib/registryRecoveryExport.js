import {
  encryptPrivateRecoveryPayload,
  PRIVATE_RECOVERY_PAYLOAD_KIND,
  PRIVATE_RECOVERY_SCHEMA_VERSION,
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
  return env.DB.prepare(`SELECT * FROM "${table}" ORDER BY id ASC`);
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
  return encryptPrivateRecoveryPayload({
    kind: PRIVATE_RECOVERY_PAYLOAD_KIND,
    schemaVersion: PRIVATE_RECOVERY_SCHEMA_VERSION,
    exportedAt,
    tables: orderedTables,
  }, { key, keyId });
}
