import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, describe, it, mock } from 'node:test';

mock.module('../functions/api/_lib/auth.js', {
  namedExports: {
    requireAdmin: async (request: Request, env: { DB?: unknown }) => {
      if (request.headers.get('X-Test-Admin') !== 'yes') {
        return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        });
      }
      return { userId: 'artist-admin', email: 'artist@example.com' };
    },
  },
});

after(() => mock.reset());

const migrationNames = [
  '001_init.sql', '002_invoices.sql',
  '003_atlas_legacy.sql', '003_viewings.sql',
  '004_invoice_payment_choice.sql', '004_piece_content.sql',
  '005_atlas_legacy.sql', '005_invoice_amount_paid.sql',
  '006_better_auth.sql', '007_pricing.sql',
  '008_living_legacy.sql', '009_keeper_register.sql',
  '010_artwork_plate_identity.sql', '011_piece_fulfillments.sql',
  '012_piece_fulfillment_guards.sql', '013_artwork_lineage.sql',
  '014_artwork_lineage_anchor.sql', '015_registry_artworks.sql',
  '016_keeper_piece_edition_kind_guard.sql',
  '017_creator_registry_maintenance.sql', '018_registry_plate_lifecycle.sql',
  '019_registry_creator_history.sql', '020_registry_recovery_qualification.sql',
  '021_registry_plate_backup_digest.sql', '022_registry_fulfillment_detachment.sql',
  '023_collector_registry_merge.sql', '024_ownership_foundation.sql',
  '025_artwork_registration.sql', '026_artwork_invitations.sql',
  '027_certificate_templates.sql', '028_collector_privacy.sql',
  '029_collector_dreams.sql', '030_collector_field.sql',
  '031_collector_letters.sql', '032_artist_verified_sales.sql',
] as const;

const migrations = migrationNames.map((name) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
)).join('\n');

const now = '2026-08-10T12:00:00.000Z';
const digest = (character: string) => character.repeat(64);

function fixture() {
  const database = new DatabaseSync(':memory:');
  database.exec(`PRAGMA foreign_keys = ON; ${migrations}`);
  database.exec(`
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES ('artist-admin', 'Artist', 'artist@example.com', 1, 1, 1);
    INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
    VALUES
      ('SIG-100', 'Amphibian Dream', 'Signature', NULL, '${now}'),
      ('SIG-101', 'Autumn Paladin', 'Signature', NULL, '${now}'),
      ('SIG-102', 'Night Orchard', 'Signature', NULL, '${now}');
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, recovery_code_hash, public_code, issuance_key,
       registered_at, plate_status, ownership_code_ciphertext, ownership_code_nonce,
       ownership_code_key_version, registration_status, registered_by_user_id,
       identity_backup_status, identity_backup_reference, identity_backup_sha256,
       identity_backup_at)
    VALUES
      ('keeper-linked', 'SIG-100', 0, '${digest('a')}', 'AR-7KQ9M2WX',
       'issue-linked', '${now}', 'legacy', 'cipher-secret', 'nonce-secret', 1,
       'registered', 'artist-admin', 'verified',
       'identities/AR-7KQ9M2WX/${digest('b')}.json', '${digest('b')}', '${now}'),
      ('keeper-only', 'SIG-101', 0, '${digest('c')}', 'AR-8KQ9M2WX',
       'issue-only', '${now}', 'legacy', 'cipher-only', 'nonce-only', 1,
       'registered', 'artist-admin', 'verified',
       'identities/AR-8KQ9M2WX/${digest('d')}.json', '${digest('d')}', '${now}');
    INSERT INTO artist_artwork_records
      (id, artwork_id, edition_json, keeper_piece_id, identification_status,
       created_by_user_id, created_at, updated_at)
    VALUES
      ('record-unresolved', NULL, NULL, NULL, 'unresolved', 'artist-admin', '${now}', '${now}'),
      ('record-identified', 'SIG-102', '{"kind":"unique","number":null,"size":null}',
       NULL, 'identified', 'artist-admin', '${now}', '${now}'),
      ('record-linked', 'SIG-100', '{"kind":"unique","number":null,"size":null}',
       'keeper-linked', 'identity_linked', 'artist-admin', '${now}', '${now}');
  `);
  const queries: string[] = [];
  const DB = {
    prepare(sql: string) {
      queries.push(sql);
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...bound: SQLInputValue[]) { values = bound; return statement; },
        first() { return database.prepare(sql).get(...values) ?? null; },
        all() { return { results: database.prepare(sql).all(...values) }; },
        run() { throw new Error('workspace_must_be_read_only'); },
      };
      return statement;
    },
    batch() { throw new Error('workspace_must_be_read_only'); },
  };
  return { database, env: { DB }, queries };
}

function seedComposedReadState(database: DatabaseSync) {
  database.exec(`
    INSERT INTO certificate_templates
      (id, name, content_json, version, created_by_user_id, created_by_email,
       created_at, updated_at)
    VALUES
      ('template-one', 'Partial facts',
       '{"materials":["Wood"],"origin":"Bali, Indonesia"}', 1,
       'artist-admin', 'artist@example.com', '${now}', '${now}');
    INSERT INTO certificate_assignment_operations
      (idempotency_key, request_digest, template_id, artwork_ids_json,
       assigned_by_user_id, assigned_by_email, assigned_at)
    VALUES
      ('assignment-one', '${digest('9')}', 'template-one', '["SIG-100"]',
       'artist-admin', 'artist@example.com', '${now}');
    INSERT INTO certificate_artwork_assignments
      (artwork_id, template_id, assignment_operation_key, version, assigned_at)
    VALUES ('SIG-100', 'template-one', 'assignment-one', 1, '${now}');
    INSERT INTO artwork_invitations
      (id, keeper_piece_id, token_hash, intended_recipient_email,
       created_by_user_id, idempotency_key, created_at, expires_at)
    VALUES
      ('iv-123e4567-e89b-42d3-a456-426614174000', 'keeper-linked', '${digest('e')}',
       'secret-buyer@example.com', 'artist-admin', 'invite-one',
       '2026-08-10T10:00:00.000Z', '2026-08-12T10:00:00.000Z');
    INSERT INTO artist_verified_sales
      (id, occurrence_precision, occurred_on, buyer_email, currency, total_minor,
       private_reference, private_notes, verified_by_user_id, idempotency_key,
       request_digest, recorded_at)
    VALUES
      ('sale-linked', 'exact', '2026-08-09', 'hidden-buyer@example.com', 'USD', 990000,
       'private-reference-sentinel', 'private-note-sentinel', 'artist-admin',
       'sale-linked-key', '${digest('f')}', '2026-08-10T11:00:00.000Z');
    INSERT INTO artist_verified_sale_items
      (id, sale_id, artwork_record_id, amount_minor, currency, created_at)
    VALUES
      ('sale-item-linked', 'sale-linked', 'record-linked', 990000, 'USD',
       '2026-08-10T11:00:00.000Z');
    INSERT INTO artwork_acquisitions
      (id, keeper_piece_id, acquisition_type, acquired_at, amount_minor, currency,
       acquirer_reference, private_notes, document_reference, record_version,
       created_at, updated_at)
    VALUES
      ('legacy-acquisition', 'keeper-only', 'sale', '2020-01-01', 250000, 'USD',
       'private-buyer-sentinel', 'legacy-private-note', 'private-document', 1,
       '2026-08-08T10:00:00.000Z', '2026-08-08T10:00:00.000Z');
    INSERT INTO registry_maintenance_events
      (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
       administrator_user_id, administrator_email, reason, before_json,
       after_json, outcome, related_record_id, mutation_fingerprint, created_at)
    VALUES
      ('maintenance-one', 'maintenance-one-key', 'acquisition_created',
       'keeper-linked', NULL, 'artist-admin', 'artist@example.com',
       'private-maintenance-reason', '{}', '{}', 'succeeded', NULL,
       '${digest('8')}', '2026-08-10T09:00:00.000Z');
  `);
}

function collectKeysAndStrings(value: unknown, keys: string[] = [], strings: string[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeysAndStrings(item, keys, strings);
    return { keys, strings };
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.push(key);
      collectKeysAndStrings(child, keys, strings);
    }
  } else if (typeof value === 'string') strings.push(value);
  return { keys, strings };
}

describe('read-only artwork workspace projection', () => {
  it('delegates canonical storage reads to their owning modules', async () => {
    const registration = await import('../functions/api/_lib/artworkRegistration.js');
    const invitations = await import('../functions/api/_lib/artworkInvitations.js');
    const sales = await import('../functions/api/_lib/artistSales.js');
    const maintenance = await import('../functions/api/_lib/registryMaintenance.js');
    assert.equal(typeof registration.readRegisteredArtworkIdentity, 'function');
    assert.equal(typeof invitations.readArtworkInvitationProjection, 'function');
    assert.equal(typeof sales.readArtistArtworkRecordProjection, 'function');
    assert.equal(typeof sales.readVerifiedSaleProjection, 'function');
    assert.equal(typeof maintenance.readMaintenanceWorkspaceProjection, 'function');
    const source = readFileSync(
      new URL('../functions/api/_lib/artworkWorkspace.js', import.meta.url), 'utf8',
    );
    assert.doesNotMatch(source, /FROM\s+(?:artist_|keeper_pieces|artwork_invitations|artwork_acquisitions|registry_maintenance_events)/i);
  });

  it('resolves unresolved, identified, linked, catalog-only, and registered-only workspaces', async () => {
    const { getArtworkWorkspace } = await import('../functions/api/_lib/artworkWorkspace.js');
    const f = fixture();
    try {
      const unresolved = await getArtworkWorkspace(f.env, {
        artistArtworkRecordId: 'record-unresolved',
      }, now);
      assert.equal(unresolved.catalog, null);
      assert.deepEqual(unresolved.salesRecord, {
        artworkRecordId: 'record-unresolved', state: 'unresolved',
      });
      assert.equal(unresolved.identity, null);

      const identified = await getArtworkWorkspace(f.env, {
        artworkId: 'SIG-102', artistArtworkRecordId: 'record-identified',
      }, now);
      assert.deepEqual(identified.catalog, { artworkId: 'SIG-102', title: 'Communion' });
      assert.equal(identified.salesRecord?.state, 'identified');
      assert.equal(identified.identity, null);

      const linked = await getArtworkWorkspace(f.env, {
        keeperPieceId: 'keeper-linked', artistArtworkRecordId: 'record-linked',
      }, now);
      assert.deepEqual(linked.catalog, { artworkId: 'SIG-100', title: 'Amphibian Dream' });
      assert.deepEqual(linked.identity, {
        keeperPieceId: 'keeper-linked', publicCode: 'AR-7KQ9M2WX', state: 'registered',
      });

      const catalogOnly = await getArtworkWorkspace(f.env, { artworkId: 'UL-100' }, now);
      assert.equal(catalogOnly.catalog?.artworkId, 'UL-100');
      assert.equal(catalogOnly.salesRecord, null);
      assert.equal(catalogOnly.identity, null);

      const registeredOnly = await getArtworkWorkspace(f.env, {
        keeperPieceId: 'keeper-only',
      }, now);
      assert.equal(registeredOnly.catalog?.artworkId, 'SIG-101');
      assert.equal(registeredOnly.salesRecord, null);
      assert.equal(registeredOnly.identity?.keeperPieceId, 'keeper-only');
    } finally { f.database.close(); }
  });

  it('attaches the linked sales record and verified history to a keeper-only lookup', async () => {
    const { getArtworkWorkspace } = await import('../functions/api/_lib/artworkWorkspace.js');
    const f = fixture();
    try {
      seedComposedReadState(f.database);
      const workspace = await getArtworkWorkspace(f.env, {
        keeperPieceId: 'keeper-linked',
      }, now);
      assert.deepEqual(workspace.salesRecord, {
        artworkRecordId: 'record-linked', state: 'identity_linked',
      });
      assert.deepEqual(workspace.sale, {
        state: 'verified', verifiedSaleId: 'sale-linked',
      });
    } finally { f.database.close(); }
  });

  it('composes allowlisted certificate, invitation, caretaker, plate, and sale states', async () => {
    const { getArtworkWorkspace } = await import('../functions/api/_lib/artworkWorkspace.js');
    const f = fixture();
    try {
      seedComposedReadState(f.database);
      const linked = await getArtworkWorkspace(f.env, {
        artistArtworkRecordId: 'record-linked',
      }, now);
      assert.deepEqual(linked.certificate, {
        state: 'incomplete',
        missingFields: [
          'certificateWording', 'editionWording', 'makers', 'openingWording',
          'techniques', 'yearWording',
        ],
      });
      assert.deepEqual(linked.invitation, {
        state: 'available', invitationId: 'iv-123e4567-e89b-42d3-a456-426614174000',
      });
      assert.deepEqual(linked.caretaker, { state: 'unclaimed' });
      assert.deepEqual(linked.plate, { state: 'legacy', recoveryState: 'identity_missing' });
      assert.deepEqual(linked.sale, { state: 'verified', verifiedSaleId: 'sale-linked' });

      const legacy = await getArtworkWorkspace(f.env, { keeperPieceId: 'keeper-only' }, now);
      assert.deepEqual(legacy.sale, { state: 'legacy_candidate', verifiedSaleId: null });
    } finally { f.database.close(); }
  });

  it('rejects unknown, ambiguous, conflicting, and corrupt selector relationships', async () => {
    const { getArtworkWorkspace } = await import('../functions/api/_lib/artworkWorkspace.js');
    const f = fixture();
    try {
      await assert.rejects(
        getArtworkWorkspace(f.env, { artistArtworkRecordId: 'missing-record' }, now),
        (error: { code?: string }) => error.code === 'workspace_not_found',
      );
      await assert.rejects(
        getArtworkWorkspace(f.env, {
          artworkId: 'SIG-100', artistArtworkRecordId: 'record-unresolved',
        }, now),
        (error: { code?: string }) => error.code === 'workspace_selector_conflict',
      );
      await assert.rejects(
        getArtworkWorkspace(f.env, {
          artworkId: 'SIG-100', keeperPieceId: 'keeper-only',
        }, now),
        (error: { code?: string }) => error.code === 'workspace_selector_conflict',
      );
      f.database.exec(`
        INSERT INTO artist_artwork_records
          (id, artwork_id, edition_json, keeper_piece_id, identification_status,
           created_by_user_id, created_at, updated_at)
        VALUES ('record-ambiguous', 'SIG-100',
          '{"kind":"unique","number":null,"size":null}', NULL, 'identified',
          'artist-admin', '${now}', '${now}');
      `);
      await assert.rejects(
        getArtworkWorkspace(f.env, { artworkId: 'SIG-100' }, now),
        (error: { code?: string }) => error.code === 'workspace_selector_conflict',
      );

      f.database.exec(`
        PRAGMA foreign_keys = OFF;
        DROP TRIGGER artist_artwork_records_guarded_update;
      `);
      f.database.exec(`
        UPDATE artist_artwork_records SET artwork_id = 'SIG-101'
         WHERE id = 'record-linked';
      `);
      await assert.rejects(
        getArtworkWorkspace(f.env, { artistArtworkRecordId: 'record-linked' }, now),
        (error: { code?: string }) => error.code === 'workspace_data_corrupt',
      );
    } finally { f.database.close(); }
  });

  it('fails closed when a linked sales edition differs from its permanent identity', async () => {
    const { getArtworkWorkspace } = await import('../functions/api/_lib/artworkWorkspace.js');
    const f = fixture();
    try {
      f.database.exec('DROP TRIGGER artist_artwork_records_guarded_update;');
      f.database.exec(`
        UPDATE artist_artwork_records
           SET edition_json = '{"kind":"numbered","number":1,"size":64}'
         WHERE id = 'record-linked';
      `);
      await assert.rejects(
        getArtworkWorkspace(f.env, { artistArtworkRecordId: 'record-linked' }, now),
        (error: { code?: string }) => error.code === 'workspace_data_corrupt',
      );
    } finally { f.database.close(); }
  });

  it('never projects private facts or performs a write', async () => {
    const { getArtworkWorkspace } = await import('../functions/api/_lib/artworkWorkspace.js');
    const f = fixture();
    try {
      seedComposedReadState(f.database);
      const workspace = await getArtworkWorkspace(f.env, {
        artistArtworkRecordId: 'record-linked',
      }, now);
      const { keys, strings } = collectKeysAndStrings(workspace);
      assert.equal(keys.some((key) => /token|verifier|cipher|nonce|recovery.?key|storage.?reference|buyer|private|amount|birth/i.test(key)), false);
      const serialized = JSON.stringify(strings);
      for (const secret of [
        'cipher-secret', 'nonce-secret', digest('a'), digest('b'), digest('e'), digest('f'),
        'secret-buyer@example.com', 'hidden-buyer@example.com', 'private-reference-sentinel',
        'private-note-sentinel', '990000',
      ]) assert.doesNotMatch(serialized, new RegExp(secret));
      assert.equal(f.queries.some((sql) => /\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql)), false);
      assert.doesNotMatch(
        readFileSync(new URL('../functions/api/_lib/artworkWorkspace.js', import.meta.url), 'utf8'),
        /\b(?:INSERT|UPDATE|DELETE|REPLACE)\b|registerArtwork\s*\(|createArtworkInvitation\s*\(|createVerifiedSale\s*\(|commitMaintenanceMutation\s*\(/i,
      );
    } finally { f.database.close(); }
  });

  it('derives exactly one prioritized safe action and bounded deterministic activity', async () => {
    const { getArtworkWorkspace } = await import('../functions/api/_lib/artworkWorkspace.js');
    const f = fixture();
    try {
      seedComposedReadState(f.database);
      const unresolved = await getArtworkWorkspace(f.env, {
        artistArtworkRecordId: 'record-unresolved',
      }, now);
      assert.deepEqual(unresolved.nextAction, {
        label: 'Resolve artwork identity',
        href: '/admin/collector-sales?artistArtworkRecordId=record-unresolved',
        reason: 'This sales record is not matched to a catalog artwork.',
      });

      const identified = await getArtworkWorkspace(f.env, {
        artistArtworkRecordId: 'record-identified',
      }, now);
      assert.deepEqual(identified.nextAction, {
        label: 'Register artwork identity',
        href: '/admin/registrations?artworkId=SIG-102&artistArtworkRecordId=record-identified',
        reason: 'This exact artwork is identified but has no permanent identity.',
      });

      const linked = await getArtworkWorkspace(f.env, {
        artistArtworkRecordId: 'record-linked',
      }, now);
      assert.deepEqual(linked.nextAction, {
        label: 'Verify identity recovery',
        href: '/admin/pieces/wizard?keeperPieceId=keeper-linked',
        reason: 'The registered identity needs a current copied recovery check.',
      });
      assert.ok(linked.activity.length > 0 && linked.activity.length <= 20);
      assert.ok(linked.activity.some((event) => event.kind === 'sale_verified'));
      assert.ok(linked.activity.some((event) => event.kind === 'invitation_created'));
      assert.ok(linked.activity.some((event) => event.kind === 'maintenance_recorded'));
      for (let index = 1; index < linked.activity.length; index += 1) {
        assert.ok(linked.activity[index - 1].occurredAt >= linked.activity[index].occurredAt);
      }

      f.database.exec(`
        INSERT INTO artwork_identity_recovery_qualifications
          (id, keeper_piece_id, result, copied_artifact, schema_version,
           build_version, key_version, verifier_version, backup_reference,
           backup_sha256, administrator_user_id, administrator_email,
           safe_failure_code, qualified_at)
        VALUES
          ('identity-proof', 'keeper-linked', 'passed', 1, '1',
           'registry-recovery-build-v1', 1, 'copied-identity-v1',
           'identities/AR-7KQ9M2WX/${digest('b')}.json', '${digest('b')}',
           'artist-admin', 'artist@example.com', NULL, '${now}');
      `);
      const afterRecovery = await getArtworkWorkspace(f.env, {
        artistArtworkRecordId: 'record-linked',
      }, now);
      assert.deepEqual(afterRecovery.nextAction, {
        label: 'Complete certificate facts',
        href: '/admin/certificates?artworkId=SIG-100',
        reason: 'The effective certificate is missing required facts.',
      });
    } finally { f.database.close(); }
  });

  it('does not offer a first-bind invitation action to active or released caretakers', async () => {
    const { getArtworkWorkspace } = await import('../functions/api/_lib/artworkWorkspace.js');
    const f = fixture();
    try {
      seedComposedReadState(f.database);
      f.database.exec(`
        UPDATE certificate_templates
           SET content_json = '{"materials":["Wood"],"makers":[{"name":"Adrian Rasmussen","role":"Artist"}],"origin":"Bali","techniques":["Handmade"],"yearWording":"Made in 2026","editionWording":"Unique work","certificateWording":"Certificate","openingWording":"Welcome"}'
         WHERE id = 'template-one';
        INSERT INTO artwork_identity_recovery_qualifications
          (id, keeper_piece_id, result, copied_artifact, schema_version,
           build_version, key_version, verifier_version, backup_reference,
           backup_sha256, administrator_user_id, administrator_email,
           safe_failure_code, qualified_at)
        VALUES
          ('identity-proof-action', 'keeper-linked', 'passed', 1, '1',
           'registry-recovery-build-v1', 1, 'copied-identity-v1',
           'identities/AR-7KQ9M2WX/${digest('b')}.json', '${digest('b')}',
           'artist-admin', 'artist@example.com', NULL, '${now}');
      `);
      const triggers = f.database.prepare(
        "SELECT name FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = 'keeper_pieces'",
      ).all() as Array<{ name: string }>;
      for (const trigger of triggers) f.database.exec(`DROP TRIGGER "${trigger.name}"`);

      f.database.exec(`
        UPDATE keeper_pieces
           SET keeper_user_id = 'artist-admin', claimed_at = '${now}', released_at = NULL
         WHERE id = 'keeper-linked';
      `);
      const active = await getArtworkWorkspace(f.env, { keeperPieceId: 'keeper-linked' }, now);
      assert.equal(active.caretaker.state, 'active');
      assert.notEqual(active.nextAction?.label, 'Resolve caretaker invitation');
      assert.notEqual(active.nextAction?.label, 'Create caretaker invitation');

      f.database.exec(`
        UPDATE keeper_pieces
           SET keeper_user_id = NULL, released_at = '2026-08-10T12:01:00.000Z'
         WHERE id = 'keeper-linked';
      `);
      const released = await getArtworkWorkspace(f.env, { keeperPieceId: 'keeper-linked' }, now);
      assert.equal(released.caretaker.state, 'released');
      assert.notEqual(released.nextAction?.label, 'Resolve caretaker invitation');
      assert.notEqual(released.nextAction?.label, 'Create caretaker invitation');
    } finally { f.database.close(); }
  });

  it('exposes one authenticated GET endpoint with strict selector validation and no-store responses', async () => {
    const { onRequest } = await import('../functions/api/admin/artwork-workspace.js');
    const f = fixture();
    const request = (query = '', init: RequestInit = {}) => new Request(
      `https://example.com/api/admin/artwork-workspace${query}`,
      { headers: { 'X-Test-Admin': 'yes', ...(init.headers || {}) }, ...init },
    );
    try {
      const unauthorized = await onRequest({
        request: new Request('https://example.com/api/admin/artwork-workspace?artworkId=SIG-100'),
        env: f.env,
      });
      assert.equal(unauthorized.status, 401);
      assert.equal(unauthorized.headers.get('Cache-Control'), 'no-store');

      const method = await onRequest({ request: request('?artworkId=SIG-100', { method: 'POST' }), env: f.env });
      assert.equal(method.status, 405);
      assert.equal(method.headers.get('Allow'), 'GET');
      assert.equal(method.headers.get('Cache-Control'), 'no-store');

      for (const query of [
        '', '?extra=value', '?artworkId=', `?artworkId=${'x'.repeat(81)}`,
        '?artworkId=SIG-100&artworkId=SIG-100',
      ]) {
        const response = await onRequest({ request: request(query), env: f.env });
        assert.equal(response.status, 400, query);
        assert.equal(response.headers.get('Cache-Control'), 'no-store', query);
      }
      const missingDb = await onRequest({ request: request('?artworkId=SIG-100'), env: {} });
      assert.equal(missingDb.status, 503);
      assert.deepEqual(await missingDb.json(), { ok: false, error: 'db_not_configured' });

      const unknown = await onRequest({ request: request('?artworkId=sig-100'), env: f.env });
      assert.equal(unknown.status, 404);
      const conflict = await onRequest({
        request: request('?artworkId=SIG-100&keeperPieceId=keeper-only'), env: f.env,
      });
      assert.equal(conflict.status, 409);
      assert.deepEqual(await conflict.json(), { ok: false, error: 'workspace_selector_conflict' });

      const success = await onRequest({ request: request('?keeperPieceId=keeper-only'), env: f.env });
      assert.equal(success.status, 200);
      assert.equal(success.headers.get('Cache-Control'), 'no-store');
      const body = await success.json() as { ok: boolean; workspace: { identity: { keeperPieceId: string } } };
      assert.equal(body.ok, true);
      assert.equal(body.workspace.identity.keeperPieceId, 'keeper-only');
    } finally { f.database.close(); }
  });

  it('strictly parses the allowlist and builds selector-only client requests', async () => {
    const { getArtworkWorkspace } = await import('../functions/api/_lib/artworkWorkspace.js');
    const {
      buildArtworkWorkspacePath,
      parseArtworkWorkspaceResponse,
    } = await import('../utils/artworkWorkspace.ts');
    const f = fixture();
    try {
      seedComposedReadState(f.database);
      const workspace = await getArtworkWorkspace(f.env, {
        artistArtworkRecordId: 'record-linked',
      }, now);
      const parsed = parseArtworkWorkspaceResponse({ ok: true, workspace });
      assert.deepEqual(parsed, workspace);
      assert.equal(
        buildArtworkWorkspacePath({
          artworkId: 'SIG-100', keeperPieceId: 'Keeper Case-Sensitive',
          artistArtworkRecordId: 'Record/Mixed',
        }),
        '/api/admin/artwork-workspace?artworkId=SIG-100&keeperPieceId=Keeper+Case-Sensitive&artistArtworkRecordId=Record%2FMixed',
      );
      assert.throws(() => buildArtworkWorkspacePath({}));
      assert.throws(() => buildArtworkWorkspacePath({ artworkId: ' ' }));
      assert.throws(() => buildArtworkWorkspacePath({ artworkId: 'SIG-100', extra: 'secret' } as never));

      assert.throws(() => parseArtworkWorkspaceResponse({ ok: true, workspace, extra: true }));
      assert.throws(() => parseArtworkWorkspaceResponse({
        ok: true, workspace: { ...workspace, catalog: { ...workspace.catalog, extra: true } },
      }));
      assert.throws(() => parseArtworkWorkspaceResponse({
        ok: true, workspace: { ...workspace, caretaker: { state: 'owner' } },
      }));
      assert.throws(() => parseArtworkWorkspaceResponse({
        ok: true, workspace: { ...workspace, privateNotes: 'hidden' },
      }));
      assert.throws(() => parseArtworkWorkspaceResponse({
        ok: true,
        workspace: {
          ...workspace,
          nextAction: { label: 'Leave', href: 'https://evil.example', reason: 'Unsafe' },
        },
      }));
      assert.throws(() => parseArtworkWorkspaceResponse({
        ok: true,
        workspace: {
          ...workspace,
          nextAction: { label: 'Email buyer@example.com', href: '/admin/pieces', reason: 'Unsafe' },
        },
      }));

      const withoutIdentity = {
        ...workspace, salesRecord: null, identity: null, invitation: null,
        caretaker: { state: 'not_registered' }, plate: null,
      };
      for (const contradictory of [
        { ...workspace, identity: null },
        { ...withoutIdentity, caretaker: { state: 'active' } },
        { ...withoutIdentity, invitation: workspace.invitation },
        { ...withoutIdentity, plate: workspace.plate },
      ]) assert.throws(() => parseArtworkWorkspaceResponse({ ok: true, workspace: contradictory }));

      assert.throws(() => parseArtworkWorkspaceResponse({
        ok: true,
        workspace: {
          ...workspace,
          nextAction: { label: 'Review', href: '/admin/pieces', reason: 'Missing stable ID' },
        },
      }));
      assert.throws(() => parseArtworkWorkspaceResponse({
        ok: true,
        workspace: {
          ...workspace,
          nextAction: {
            label: 'Review',
            href: '/admin/collector-sales?source=arbitrary&artworkId=SIG-100',
            reason: 'Arbitrary source',
          },
        },
      }));
    } finally { f.database.close(); }
  });
});
