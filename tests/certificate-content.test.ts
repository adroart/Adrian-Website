import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, it } from 'node:test';

import {
  assignCertificateTemplate,
  createCertificateTemplate,
  getCertificateArtworkEditorState,
  resolveArtworkCertificate,
  resolveInstanceCertificate,
  setCertificateOverride,
} from '../functions/api/_lib/certificateContent.js';
import { onRequest as publicCertificateRequest } from '../functions/api/certificates/[artworkId].js';

const baseMigrations = [
  '001_init.sql', '003_atlas_legacy.sql', '006_better_auth.sql',
  '008_living_legacy.sql', '009_keeper_register.sql',
  '010_artwork_plate_identity.sql', '011_piece_fulfillments.sql',
  '012_piece_fulfillment_guards.sql', '013_artwork_lineage.sql',
  '014_artwork_lineage_anchor.sql', '015_registry_artworks.sql',
  '016_keeper_piece_edition_kind_guard.sql',
  '017_creator_registry_maintenance.sql', '018_registry_plate_lifecycle.sql',
  '019_registry_creator_history.sql', '020_registry_recovery_qualification.sql',
  '021_registry_plate_backup_digest.sql', '022_registry_fulfillment_detachment.sql',
  '023_collector_registry_merge.sql', '024_ownership_foundation.sql',
  '025_artwork_registration.sql', '027_certificate_templates.sql',
];

function fixture() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  for (const name of baseMigrations) {
    database.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
  database.exec(`
    INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
    VALUES
      ('SIG-100', 'Amphibian Dream', 'Signature', NULL, '2026-08-09T00:00:00.000Z'),
      ('SIG-101', 'Autumn Paladin', 'Signature', 7, '2026-08-09T00:00:00.000Z'),
      ('SIG-102', 'Night Orchard', 'Signature', NULL, '2026-08-09T00:00:00.000Z');
  `);
  const DB = {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...bound: SQLInputValue[]) { values = bound; return statement; },
        first() { return database.prepare(sql).get(...values) ?? null; },
        all() { return { results: database.prepare(sql).all(...values) }; },
        run() {
          const result = database.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
        get sql() { return sql; },
        get values() { return values; },
      };
      return statement;
    },
    async batch(statements: Array<{ sql: string; values: SQLInputValue[] }>) {
      database.exec('BEGIN IMMEDIATE;');
      try {
        const results = statements.map((statement) => {
          const result = database.prepare(statement.sql).run(...statement.values);
          return { success: true, meta: { changes: Number(result.changes) } };
        });
        database.exec('COMMIT;');
        return results;
      } catch (error) {
        database.exec('ROLLBACK;');
        throw error;
      }
    },
  };
  return { database, env: { DB } };
}

const administrator = { userId: 'admin-one', email: 'artist@example.com' };
const now = '2026-08-09T01:02:03.000Z';

function insertRegisteredInstance(database: DatabaseSync) {
  database.exec(`
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, recovery_code_hash, public_code,
       issuance_key, registered_at, ownership_code_ciphertext,
       ownership_code_nonce, ownership_code_key_version,
       registration_status, identity_backup_status,
       identity_backup_reference, identity_backup_sha256, identity_backup_at)
    VALUES
      ('kp-numbered', 'SIG-101', 3, '${'a'.repeat(64)}', 'AR-7KQ9M2WX',
       'register-sig-101-3', '2026-08-09T01:00:00.000Z', 'private-ciphertext',
       'private-nonce', 1, 'registered', 'verified',
       'identities/AR-7KQ9M2WX/${'b'.repeat(64)}.json', '${'b'.repeat(64)}',
       '2026-08-09T01:00:00.000Z');
  `);
}

async function template(env: { DB: unknown }) {
  return createCertificateTemplate(env, {
    name: 'Wood sculpture standard',
    content: {
      materials: ['Birch plywood', 'Natural pigments'],
      makers: [
        { name: 'Adrian Rasmussen', role: 'Artist' },
        { name: 'Mira Sol', role: 'Wood preparation' },
      ],
      origin: 'Bali, Indonesia',
      techniques: ['Hand cut', 'Layered', 'Painted'],
      yearWording: 'Created in 2026',
      certificateWording: 'This record accompanies the artwork.',
      openingWording: 'Welcome to the living record of this work.',
    },
    administrator,
    createdAt: now,
  });
}

describe('certificate templates and effective content', () => {
  it('inherits reusable facts, preserves multiple maker roles, and omits missing values', async () => {
    const f = fixture();
    try {
      const created = await template(f.env);
      await assignCertificateTemplate(f.env, {
        templateId: created.templateId,
        artworkIds: ['SIG-100'],
        idempotencyKey: 'assign-sig-100',
        administrator,
        assignedAt: now,
      });
      assert.deepEqual(await resolveArtworkCertificate(f.env, 'SIG-100'), {
        materials: ['Birch plywood', 'Natural pigments'],
        makers: [
          { name: 'Adrian Rasmussen', role: 'Artist' },
          { name: 'Mira Sol', role: 'Wood preparation' },
        ],
        origin: 'Bali, Indonesia',
        techniques: ['Hand cut', 'Layered', 'Painted'],
        yearWording: 'Created in 2026',
        certificateWording: 'This record accompanies the artwork.',
        openingWording: 'Welcome to the living record of this work.',
      });
      assert.deepEqual(await resolveArtworkCertificate(f.env, 'SIG-102'), {});
    } finally { f.database.close(); }
  });

  it('overrides or suppresses one field and can return it to inheritance', async () => {
    const f = fixture();
    try {
      const created = await template(f.env);
      await assignCertificateTemplate(f.env, {
        templateId: created.templateId, artworkIds: ['SIG-100'],
        idempotencyKey: 'assign-one', administrator, assignedAt: now,
      });
      const changed = await setCertificateOverride(f.env, {
        artworkId: 'SIG-100', field: 'origin',
        override: { mode: 'override', value: 'Santa Cruz, California' },
        expectedVersion: 0, administrator, updatedAt: now,
      });
      assert.equal(changed.version, 1);
      assert.equal((await resolveArtworkCertificate(f.env, 'SIG-100')).origin, 'Santa Cruz, California');

      await setCertificateOverride(f.env, {
        artworkId: 'SIG-100', field: 'materials', override: { mode: 'suppress' },
        expectedVersion: 0, administrator, updatedAt: now,
      });
      assert.equal('materials' in await resolveArtworkCertificate(f.env, 'SIG-100'), false);

      await setCertificateOverride(f.env, {
        artworkId: 'SIG-100', field: 'origin', override: { mode: 'inherit' },
        expectedVersion: 1, administrator, updatedAt: '2026-08-09T01:03:03.000Z',
      });
      assert.equal((await resolveArtworkCertificate(f.env, 'SIG-100')).origin, 'Bali, Indonesia');
    } finally { f.database.close(); }
  });

  it('bulk assigns atomically, preserves overrides, replays exactly, and rejects conflicts', async () => {
    const f = fixture();
    try {
      const created = await template(f.env);
      await setCertificateOverride(f.env, {
        artworkId: 'SIG-101', field: 'editionWording',
        override: { mode: 'override', value: 'A hand-finished edition of seven' },
        expectedVersion: 0, administrator, updatedAt: now,
      });
      const input = {
        templateId: created.templateId,
        artworkIds: ['SIG-101', 'UL-100', 'SIG-100'],
        idempotencyKey: 'bulk-signature', administrator, assignedAt: now,
      };
      const first = await assignCertificateTemplate(f.env, input);
      const replay = await assignCertificateTemplate(f.env, input);
      assert.deepEqual(replay, first);
      assert.deepEqual(first.artworkIds, ['SIG-100', 'SIG-101', 'UL-100']);
      assert.deepEqual((await resolveArtworkCertificate(f.env, 'UL-100')).materials,
        ['Birch plywood', 'Natural pigments']);
      assert.equal((await resolveArtworkCertificate(f.env, 'SIG-101')).editionWording,
        'A hand-finished edition of seven');
      await assert.rejects(
        assignCertificateTemplate(f.env, { ...input, artworkIds: ['SIG-100'] }),
        (error: { code?: string }) => error.code === 'idempotency_conflict',
      );
      await assert.rejects(
        assignCertificateTemplate(f.env, { ...input, idempotencyKey: 'unknown', artworkIds: ['SIG-100', 'NOPE-999'] }),
        (error: { code?: string }) => error.code === 'unknown_artwork',
      );
      assert.equal(f.database.prepare('SELECT COUNT(*) AS n FROM certificate_artwork_assignments').get().n, 3);
    } finally { f.database.close(); }
  });

  it('rejects stale override versions without changing any field', async () => {
    const f = fixture();
    try {
      await setCertificateOverride(f.env, {
        artworkId: 'SIG-100', field: 'origin', override: { mode: 'suppress' },
        expectedVersion: 0, administrator, updatedAt: now,
      });
      await assert.rejects(setCertificateOverride(f.env, {
        artworkId: 'SIG-100', field: 'origin',
        override: { mode: 'override', value: 'Changed' }, expectedVersion: 0,
        administrator, updatedAt: '2026-08-09T02:00:00.000Z',
      }), (error: { code?: string }) => error.code === 'version_conflict');
      const stored = f.database.prepare(
        "SELECT mode, version FROM certificate_artwork_overrides WHERE artwork_id = 'SIG-100' AND field = 'origin'",
      ).get();
      assert.deepEqual({ ...stored }, { mode: 'suppress', version: 1 });
    } finally { f.database.close(); }
  });

  it('returns the current assignment, override versions, and effective artwork projection for editing', async () => {
    const f = fixture();
    try {
      const created = await template(f.env);
      await assignCertificateTemplate(f.env, {
        templateId: created.templateId, artworkIds: ['SIG-100'],
        idempotencyKey: 'editor-state-assignment', administrator, assignedAt: now,
      });
      await setCertificateOverride(f.env, {
        artworkId: 'SIG-100', field: 'origin',
        override: { mode: 'override', value: 'Santa Cruz, California' },
        expectedVersion: 0, administrator, updatedAt: now,
      });
      await setCertificateOverride(f.env, {
        artworkId: 'SIG-100', field: 'materials', override: { mode: 'suppress' },
        expectedVersion: 0, administrator, updatedAt: now,
      });

      const state = await getCertificateArtworkEditorState(f.env, 'SIG-100');
      assert.deepEqual(state, {
        artworkId: 'SIG-100',
        assignment: { templateId: created.templateId, version: 1 },
        overrides: {
          materials: { mode: 'suppress', version: 1 },
          origin: { mode: 'override', value: 'Santa Cruz, California', version: 1 },
        },
        effective: {
          makers: [
            { name: 'Adrian Rasmussen', role: 'Artist' },
            { name: 'Mira Sol', role: 'Wood preparation' },
          ],
          origin: 'Santa Cruz, California',
          techniques: ['Hand cut', 'Layered', 'Painted'],
          yearWording: 'Created in 2026',
          certificateWording: 'This record accompanies the artwork.',
          openingWording: 'Welcome to the living record of this work.',
        },
      });
      assert.doesNotMatch(JSON.stringify(state), /artist@example|admin-one|history|updatedAt/i);
    } finally { f.database.close(); }
  });

  it('rejects empty array replacements and omits corrupt empty arrays from public output', async () => {
    const f = fixture();
    try {
      const created = await template(f.env);
      await assignCertificateTemplate(f.env, {
        templateId: created.templateId, artworkIds: ['SIG-100'],
        idempotencyKey: 'empty-array-assignment', administrator, assignedAt: now,
      });
      for (const field of ['materials', 'makers', 'techniques'] as const) {
        await assert.rejects(setCertificateOverride(f.env, {
          artworkId: 'SIG-100', field, override: { mode: 'override', value: [] },
          expectedVersion: 0, administrator, updatedAt: now,
        }), (error: { code?: string }) => error.code === 'invalid_certificate_value', field);
      }

      f.database.exec('PRAGMA ignore_check_constraints = ON;');
      f.database.exec(`
        INSERT INTO certificate_artwork_overrides
          (artwork_id, field, mode, value_json, version,
           updated_by_user_id, updated_by_email, updated_at)
        VALUES ('SIG-100', 'materials', 'override', '[]', 1,
                'admin-one', 'artist@example.com', '${now}');
      `);
      f.database.exec('PRAGMA ignore_check_constraints = OFF;');
      const effective = await resolveArtworkCertificate(f.env, 'SIG-100');
      assert.equal('materials' in effective, false);

      f.database.exec(`
        INSERT INTO keeper_pieces
          (id, piece_id, edition_number, recovery_code_hash, public_code,
           issuance_key, registered_at, ownership_code_ciphertext,
           ownership_code_nonce, ownership_code_key_version,
           registration_status, identity_backup_status,
           identity_backup_reference, identity_backup_sha256, identity_backup_at)
        VALUES
          ('kp-empty-array', 'SIG-100', 0, '${'c'.repeat(64)}', 'AR-8KQ9M2WX',
           'register-sig-100-empty', '2026-08-09T01:00:00.000Z', 'private-ciphertext',
           'private-nonce', 1, 'registered', 'verified',
           'identities/AR-8KQ9M2WX/${'d'.repeat(64)}.json', '${'d'.repeat(64)}',
           '2026-08-09T01:00:00.000Z');
      `);
      const response = await publicCertificateRequest({
        request: new Request('https://adrianrasmussen.com/api/certificates/SIG-100?publicCode=AR-8KQ9M2WX'),
        env: f.env,
        params: { artworkId: 'SIG-100' },
      });
      assert.equal(response.status, 200);
      assert.equal('materials' in (await response.json()).certificate, false);
    } finally { f.database.close(); }
  });

  it('composes exact registered-instance identity without leaking editor metadata', async () => {
    const f = fixture();
    try {
      const created = await template(f.env);
      await assignCertificateTemplate(f.env, {
        templateId: created.templateId, artworkIds: ['SIG-101'], idempotencyKey: 'instance-template',
        administrator, assignedAt: now,
      });
      insertRegisteredInstance(f.database);
      const value = await resolveInstanceCertificate(f.env, { keeperPieceId: 'kp-numbered' });
      assert.deepEqual(value.edition, { kind: 'numbered', number: 3, size: 7 });
      assert.equal(value.artworkId, 'SIG-101');
      assert.equal(value.publicCode, 'AR-7KQ9M2WX');
      const publicJson = JSON.stringify(value);
      for (const forbidden of ['templateId', 'version', 'mode', 'history', 'suppressed']) {
        assert.equal(publicJson.includes(forbidden), false, forbidden);
      }
      await assert.rejects(resolveInstanceCertificate(f.env, { keeperPieceId: 'missing' }),
        (error: { code?: string }) => error.code === 'certificate_not_found');
    } finally { f.database.close(); }
  });

  it('resolves the public instance from its public code and never accepts a private row id', async () => {
    const f = fixture();
    try {
      const created = await template(f.env);
      await assignCertificateTemplate(f.env, {
        templateId: created.templateId, artworkIds: ['SIG-101'], idempotencyKey: 'public-route',
        administrator, assignedAt: now,
      });
      insertRegisteredInstance(f.database);
      const rejected = await publicCertificateRequest({
        request: new Request('https://adrianrasmussen.com/api/certificates/SIG-101?keeperPieceId=kp-numbered'),
        env: f.env,
        params: { artworkId: 'SIG-101' },
      });
      assert.equal(rejected.status, 400);

      const response = await publicCertificateRequest({
        request: new Request('https://adrianrasmussen.com/api/certificates/SIG-101?publicCode=AR-7KQ9M2WX'),
        env: f.env,
        params: { artworkId: 'SIG-101' },
      });
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.certificate.publicCode, 'AR-7KQ9M2WX');
      assert.deepEqual(body.certificate.edition, { kind: 'numbered', number: 3, size: 7 });
      const json = JSON.stringify(body);
      for (const forbidden of [
        'kp-numbered', 'private-ciphertext', 'private-nonce', 'templateId',
        'version', 'mode', 'history', 'suppressed', 'identity_backup',
      ]) assert.equal(json.includes(forbidden), false, forbidden);
    } finally { f.database.close(); }
  });
});
