/**
 * POST /api/admin/custody-keys
 *
 * The one endpoint that hands the registry's private key material to an
 * authenticated admin browser, so that browser can build a custody envelope
 * client-side (utils/custodyEnvelope.ts — PBKDF2 + AES-GCM, entirely in
 * crypto.subtle, so this endpoint's response never needs to leave the
 * browser except as ciphertext the admin encrypts himself). See
 * docs/registry-private-recovery.md, "Custody keys endpoint", for the trust
 * boundary this sits inside, and ~/.claude/commands/awcustody.md for the
 * offline Terminal fallback this endpoint is meant to make unnecessary.
 *
 * The response shape is exactly the `CustodyKeys` type utils/custodyEnvelope.ts
 * declares — no `ok` wrapper — so the admin page can pass the parsed JSON
 * straight into `validateCustodyKeys` / `buildCustodyEnvelope`.
 *
 * Guarded like every other registry-wide secret export
 * (registry-recovery-export.js, records/export.js): the registry step-up
 * unlock, never just an admin session. POST only — a GET could land this
 * response in browser history, a proxy log, or a prefetch.
 *
 * Every call is recorded in registry_maintenance_events (migration 017 /
 * _lib/registryMaintenance.js), the same append-only shape shine-removals.js
 * and the steward-transfer maintenance actions use, before the keys are
 * returned. `ownership_code_audit` (migration 010) was considered first — it
 * is how a single Ownership Code reveal is recorded — but its
 * `keeper_piece_id` column is NOT NULL against one specific piece, and a
 * custody export names no piece; registry_maintenance_events already
 * supports a NULL keeper_piece_id for exactly this kind of registry-wide
 * administrative action, so that is the table this uses instead of a new one.
 */
import { jsonResponse, requireRegistryUnlock, requireDb } from '../_lib/admin.js';
import { isMissingTableError, migrationNotApplied } from '../_lib/keeper.js';
import {
  canonicalMaintenanceJson,
  maintenanceMutationFingerprint,
  normalizeReason,
} from '../_lib/registryMaintenance.js';
import { isCanonicalOwnershipCodeKeyVersion } from '../../../utils/ownershipCodeCrypto.ts';

const EVENT_TYPE = 'custody_keys_exported';
const AUDIT_REASON = 'Custody envelope key export for succession planning, from the admin console.';
const AES_KEY_B64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function noStoreHeaders(extra = {}) {
  return { 'Cache-Control': 'no-store', Pragma: 'no-cache', ...extra };
}

/** True only for a value that decodes to exactly 32 bytes of canonical base64. */
function isCanonicalAesKeyB64(value) {
  if (typeof value !== 'string' || !value || !AES_KEY_B64_PATTERN.test(value)) return false;
  try {
    const binary = atob(value);
    return binary.length === 32 && btoa(binary) === value;
  } catch {
    return false;
  }
}

/**
 * Every OWNERSHIP_CODE_KEY_V<n> binding present in env, not just the active
 * one. Old versions are the only way to read codes issued under them, and
 * the Successor's Handbook says never to lose them, so a partial export
 * would quietly orphan history. Anything present but malformed is skipped
 * rather than returned broken; buildCustodyEnvelope would reject a bad key
 * anyway, but skipping here keeps a misconfigured binding from ever leaving
 * this endpoint.
 */
function collectOwnershipCodeKeys(env) {
  const keys = [];
  const names = env && typeof env === 'object' ? Object.keys(env) : [];
  for (const name of names) {
    const match = /^OWNERSHIP_CODE_KEY_V(\d+)$/.exec(name);
    if (!match) continue;
    const version = match[1];
    if (!isCanonicalOwnershipCodeKeyVersion(version)) continue;
    const keyB64 = env[name];
    if (!isCanonicalAesKeyB64(keyB64)) continue;
    keys.push({ version: Number(version), keyB64 });
  }
  keys.sort((left, right) => left.version - right.version);
  return keys;
}

function activeOwnershipCodeKeyVersion(env) {
  const raw = env.OWNERSHIP_CODE_ACTIVE_KEY_VERSION;
  return isCanonicalOwnershipCodeKeyVersion(raw) ? Number(raw) : null;
}

function buildNotes({ exportedAt, activeVersion }) {
  const date = exportedAt.slice(0, 10);
  const versionClause = activeVersion
    ? `active ownership code key version ${activeVersion}`
    : 'no ownership code key version currently active';
  return `Keys taken from the live environment on ${date}; ${versionClause}.`;
}

/**
 * Write the audit row before any key material is returned. This mirrors
 * pieces/[id]/reveal.js: if the audit write fails, the request fails closed
 * with the keys never sent, rather than reporting a reveal that the audit
 * trail does not actually have.
 *
 * Every value fed to the mutation fingerprint and the JSON snapshots is an
 * id, a version number, or a timestamp — never a key. The fingerprint is
 * over that same metadata, so even a full read of registry_maintenance_events
 * carries nothing that helps decrypt anything.
 */
async function recordCustodyKeysAudit(env, {
  administrator, exportedAt, registryRecoveryExportKeyId, ownershipCodeKeyVersions, activeVersion,
}) {
  const reason = normalizeReason(AUDIT_REASON);
  if (!reason.ok) throw new Error('invalid_audit_reason');

  const metadata = {
    registryRecoveryExportKeyId,
    ownershipCodeKeyVersions,
    activeOwnershipCodeKeyVersion: activeVersion,
    exportedAt,
  };
  const mutationFingerprint = await maintenanceMutationFingerprint({
    operation: EVENT_TYPE,
    administratorUserId: administrator.userId,
    ...metadata,
  });
  const beforeJson = canonicalMaintenanceJson({ action: 'custody_keys_export_requested' });
  const afterJson = canonicalMaintenanceJson(metadata);

  const statement = env.DB.prepare(
    `INSERT INTO registry_maintenance_events
       (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
        administrator_user_id, administrator_email, reason, before_json,
        after_json, outcome, related_record_id, mutation_fingerprint, created_at)
     VALUES (?1, ?2, ?3, NULL, NULL, ?4, ?5, ?6, ?7, ?8, 'succeeded', NULL, ?9, ?10)`,
  ).bind(
    `rme-${crypto.randomUUID()}`,
    `custody-keys-${crypto.randomUUID()}`,
    EVENT_TYPE,
    administrator.userId,
    administrator.email,
    reason.reason,
    beforeJson,
    afterJson,
    mutationFingerprint,
    exportedAt,
  );

  const result = await statement.run();
  if (result?.success !== true || result?.meta?.changes !== 1) {
    throw new Error('custody_keys_audit_write_failed');
  }
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return jsonResponse(
      { ok: false, error: 'method_not_allowed' },
      405,
      noStoreHeaders({ Allow: 'POST' }),
    );
  }

  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  if (typeof env.REGISTRY_RECOVERY_EXPORT_KEY !== 'string' || !env.REGISTRY_RECOVERY_EXPORT_KEY
    || typeof env.REGISTRY_RECOVERY_EXPORT_KEY_ID !== 'string' || !env.REGISTRY_RECOVERY_EXPORT_KEY_ID) {
    return jsonResponse(
      { ok: false, error: 'registry_recovery_export_not_configured' },
      503,
      noStoreHeaders(),
    );
  }

  const exportedAt = new Date().toISOString();
  const ownershipCodeKeys = collectOwnershipCodeKeys(env);
  const activeVersion = activeOwnershipCodeKeyVersion(env);

  try {
    await recordCustodyKeysAudit(env, {
      administrator: authorization,
      exportedAt,
      registryRecoveryExportKeyId: env.REGISTRY_RECOVERY_EXPORT_KEY_ID,
      ownershipCodeKeyVersions: ownershipCodeKeys.map((entry) => entry.version),
      activeVersion,
    });
  } catch (error) {
    if (isMissingTableError(error)) return migrationNotApplied();
    return jsonResponse({ ok: false, error: 'audit_unavailable' }, 503, noStoreHeaders());
  }

  return jsonResponse(
    {
      registryRecoveryExportKeyB64: env.REGISTRY_RECOVERY_EXPORT_KEY,
      registryRecoveryExportKeyId: env.REGISTRY_RECOVERY_EXPORT_KEY_ID,
      ownershipCodeKeys,
      notes: buildNotes({ exportedAt, activeVersion }),
    },
    200,
    noStoreHeaders(),
  );
}
