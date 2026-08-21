/**
 * /api/admin/succession
 *
 *   GET  — the Succession desk's state: the three blanks that have been
 *          filled so far, the two custody dates (when the envelope was
 *          built, when the yearly drill last ran), and whether the
 *          encrypted recovery export and the Google Drive mirror are
 *          configured. Configuration is reported as booleans only; no
 *          secret value is ever read back.
 *   POST — save the three blanks (four fields; the third blank holds both
 *          the family contact and the technical helper) plus the two
 *          custody dates. Upserts the single settings row from migrations
 *          044_succession_settings.sql and 045_succession_custody_dates.sql.
 *
 * Both methods sit behind the registry step-up unlock, like every other
 * registry-wide operation (registry-ledger.js, records/export.js,
 * registry-recovery-export.js): the saved contacts are Adrian's own private
 * information, not public registry data.
 */
import { jsonResponse, requireRegistryUnlock, requireDb } from '../_lib/admin.js';
import { isMissingTableError } from '../_lib/keeper.js';
import { isDriveSyncConfigured } from '../_lib/driveSync.js';
import { sanitizeSuccessionRecord, emptySuccessionRecord } from '../../../utils/adminSuccession.ts';

function migrationNotApplied() {
  return jsonResponse({
    ok: false,
    error: 'succession_settings_migration_not_applied',
    message: 'A succession_settings migration has not been applied to the shared database yet '
      + '(044_succession_settings.sql or 045_succession_custody_dates.sql).',
  }, 503);
}

function configurationStatus(env) {
  return {
    recoveryExportConfigured: Boolean(env.REGISTRY_RECOVERY_EXPORT_KEY && env.REGISTRY_RECOVERY_EXPORT_KEY_ID),
    recordsBucketConfigured: Boolean(env.ARTWORK_REGISTRY_BACKUP),
    driveConfigured: isDriveSyncConfigured(env),
  };
}

function fieldsFromRow(row) {
  if (!row) return { ...emptySuccessionRecord, updatedAt: null };
  return {
    passkeySealedAt: row.passkey_sealed_at || '',
    passkeySecondCopyAt: row.passkey_second_copy_at || '',
    familyContact: row.family_contact || '',
    technicalHelper: row.technical_helper || '',
    custodyEnvelopeMadeAt: row.custody_envelope_made_at || '',
    custodyDrillLastRunAt: row.custody_drill_last_run_at || '',
    updatedAt: row.updated_at || null,
  };
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
  }
  const authorization = await requireRegistryUnlock(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  try {
    if (request.method === 'GET') {
      const row = await env.DB
        .prepare(
          'SELECT passkey_sealed_at, passkey_second_copy_at, family_contact, technical_helper, '
          + 'custody_envelope_made_at, custody_drill_last_run_at, updated_at '
          + 'FROM succession_settings WHERE id = 1',
        )
        .first();
      return jsonResponse({
        ok: true,
        fields: fieldsFromRow(row),
        ...configurationStatus(env),
      });
    }

    // POST → save the four handbook-blank fields plus the two custody dates
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
    }
    const fields = sanitizeSuccessionRecord(body);
    const updatedAt = new Date().toISOString();
    await env.DB
      .prepare(
        `INSERT INTO succession_settings
           (id, passkey_sealed_at, passkey_second_copy_at, family_contact, technical_helper,
            custody_envelope_made_at, custody_drill_last_run_at, updated_at)
         VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
           passkey_sealed_at = excluded.passkey_sealed_at,
           passkey_second_copy_at = excluded.passkey_second_copy_at,
           family_contact = excluded.family_contact,
           technical_helper = excluded.technical_helper,
           custody_envelope_made_at = excluded.custody_envelope_made_at,
           custody_drill_last_run_at = excluded.custody_drill_last_run_at,
           updated_at = excluded.updated_at`,
      )
      .bind(
        fields.passkeySealedAt,
        fields.passkeySecondCopyAt,
        fields.familyContact,
        fields.technicalHelper,
        fields.custodyEnvelopeMadeAt,
        fields.custodyDrillLastRunAt,
        updatedAt,
      )
      .run();

    return jsonResponse({
      ok: true,
      fields: { ...fields, updatedAt },
      ...configurationStatus(env),
    });
  } catch (error) {
    if (isMissingTableError(error) || /no such column/i.test(String(error?.message || ''))) {
      return migrationNotApplied();
    }
    return jsonResponse({ ok: false, error: 'succession_settings_failed' }, 500);
  }
}
