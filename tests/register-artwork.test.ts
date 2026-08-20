import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, describe, it, mock } from 'node:test';

/**
 * The unified register-an-artwork operation behind POST
 * /api/admin/register-artwork: one idempotent pass that ensures the draft an
 * inline artwork needs, snapshots catalog metadata, runs the existing
 * registration transaction unchanged in its guarantees, and writes the first
 * Piece Record fail-soft. Real migrations, real transaction, in-memory R2.
 */

const ORIGIN = 'https://adrianrasmussen.com';
const STEP_UP_SECRET = 'register-artwork-step-up-secret';

const adminIdentity = {
  userId: 'admin-user',
  email: 'artist@example.com',
  user: { id: 'admin-user', email: 'artist@example.com', emailVerified: true },
  session: { id: 'admin-session' },
};

mock.module('../functions/api/_lib/auth.js', {
  namedExports: {
    requireAdmin: async () => adminIdentity,
  },
});

const { registerArtworkWithRecord } = await import('../functions/api/_lib/artworkRegistration.js');
const { onRequest } = await import('../functions/api/admin/register-artwork.js');
const { createRegistryUnlockToken } = await import('../functions/api/_lib/admin.js');
const { FULL_ARCHIVE } = await import('../data/mockData.ts');

after(() => mock.reset());

const migrationNames = [
  '001_init.sql', '003_atlas_legacy.sql', '006_better_auth.sql',
  '008_living_legacy.sql', '009_keeper_register.sql',
  '010_artwork_plate_identity.sql', '011_piece_fulfillments.sql',
  '012_piece_fulfillment_guards.sql', '013_artwork_lineage.sql',
  '014_artwork_lineage_anchor.sql', '015_registry_artworks.sql',
  '016_keeper_piece_edition_kind_guard.sql',
  '017_creator_registry_maintenance.sql', '018_registry_plate_lifecycle.sql',
  '019_registry_creator_history.sql', '020_registry_recovery_qualification.sql',
  '021_registry_plate_backup_digest.sql',
  '022_registry_fulfillment_detachment.sql', '023_collector_registry_merge.sql',
  '024_ownership_foundation.sql', '025_artwork_registration.sql',
  '026_artwork_invitations.sql', '027_certificate_templates.sql',
  '028_collector_privacy.sql', '029_collector_dreams.sql',
  '030_collector_field.sql', '031_collector_letters.sql',
  '032_artist_verified_sales.sql', '033_artwork_contributors.sql',
  '034_artwork_contributor_invite_rate_limit.sql',
  '036_artwork_catalog_snapshots.sql', '037_piece_records.sql',
];

/**
 * One static catalog artwork with no fixed edition metadata whose descriptive
 * fields cannot trip the Piece Record strip-pass, so the "existing catalog"
 * path is exercised against the real compiled catalog.
 */
const PRIVATE_LOOKING = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\b(?:kp|tp|dream|consent|auth)-|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/i;
const catalogArtwork = FULL_ARCHIVE.find((artwork: any) =>
  !Number.isInteger(artwork.editionSize)
  && !PRIVATE_LOOKING.test(JSON.stringify([
    artwork.title, artwork.series, artwork.category, artwork.year,
    artwork.dimensions, artwork.materials, artwork.material, artwork.description,
  ])));
assert.ok(catalogArtwork, 'a strip-pass-safe catalog artwork exists');
const CATALOG_ID = catalogArtwork!.id as string;

type Fixture = ReturnType<typeof registrationEnvironment>;

function registrationEnvironment() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  for (const name of migrationNames) {
    database.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
  database.exec(`
    INSERT INTO registry_artworks (id, title, series, edition_size, created_at)
    VALUES ('SIG-100', 'Amphibian Dream', 'Signature', NULL, '2026-08-09T00:00:00.000Z');
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
  const objects = new Map<string, Uint8Array>();
  const poisonedPrefixes = new Set<string>();
  const ARTWORK_REGISTRY_BACKUP = {
    async put(key: string, value: Uint8Array | string) {
      for (const prefix of poisonedPrefixes) {
        if (key.startsWith(prefix)) throw new Error(`simulated R2 failure for ${key}`);
      }
      const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
      objects.set(key, bytes);
    },
    async get(key: string) {
      const bytes = objects.get(key);
      return bytes ? {
        async arrayBuffer() { return bytes.slice().buffer; },
        async text() { return new TextDecoder().decode(bytes); },
      } : null;
    },
  };
  return {
    database,
    objects,
    poisonedPrefixes,
    env: {
      DB,
      ARTWORK_REGISTRY_BACKUP,
      OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
      OWNERSHIP_CODE_KEY_V1: Buffer.alloc(32, 9).toString('base64'),
      REGISTRY_STEP_UP_SECRET: STEP_UP_SECRET,
    },
  };
}

function unifiedInput(overrides: Record<string, unknown> = {}) {
  return {
    artworkId: CATALOG_ID,
    edition: { kind: 'unique' as const },
    authorization: {
      userId: 'admin-user',
      email: 'artist@example.com',
      registryUnlockExpiresAt: Math.floor(Date.now() / 1000) + 600,
    },
    idempotencyKey: 'register-unified-1',
    registeredAt: '2026-08-19T01:02:03.000Z',
    ...overrides,
  };
}

function counts(fixture: Fixture, artworkId: string) {
  const one = (sql: string, value: string) =>
    Number((fixture.database.prepare(sql).get(value) as { n: number }).n);
  return {
    identities: one('SELECT COUNT(*) AS n FROM keeper_pieces WHERE piece_id = ?', artworkId),
    drafts: one('SELECT COUNT(*) AS n FROM registry_artworks WHERE id = ?', artworkId),
    snapshots: one('SELECT COUNT(*) AS n FROM artwork_catalog_snapshots WHERE artwork_id = ?', artworkId),
  };
}

function recordRows(fixture: Fixture, publicCode: string) {
  return fixture.database.prepare(
    'SELECT trigger_event, r2_key FROM piece_records WHERE public_code = ?',
  ).all(publicCode) as Array<{ trigger_event: string; r2_key: string }>;
}

describe('registerArtworkWithRecord (unified operation)', () => {
  it('registers an existing catalog artwork with only the edition chosen', async () => {
    const fixture = registrationEnvironment();
    try {
      const result: any = await registerArtworkWithRecord(fixture.env, unifiedInput());
      assert.equal(result.registrationStatus, 'registered');
      assert.equal(result.codeAccess, 'created');
      assert.equal(result.backupStatus, 'verified');
      assert.match(result.publicCode, /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
      assert.equal(result.artwork.id, CATALOG_ID);
      assert.equal(result.artwork.title, catalogArtwork!.title);
      assert.deepEqual(result.record, { status: 'generated', recordHash: result.record.recordHash });
      assert.match(String(result.record.recordHash), /^[0-9a-f]{64}$/);

      const snapshot = fixture.database.prepare(
        'SELECT source, canonical_json FROM artwork_catalog_snapshots WHERE artwork_id = ?',
      ).get(CATALOG_ID) as { source: string; canonical_json: string };
      assert.equal(snapshot.source, 'mockData');
      const metadata = JSON.parse(snapshot.canonical_json);
      assert.equal(metadata.title, catalogArtwork!.title);
      assert.deepEqual(metadata.edition, { kind: 'unique', size: null });

      const records = recordRows(fixture, result.publicCode);
      assert.equal(records.length, 1);
      assert.equal(records[0].trigger_event, 'registration');
      assert.ok(fixture.objects.has(records[0].r2_key), 'record HTML stored in R2');
      const html = new TextDecoder().decode(fixture.objects.get(records[0].r2_key)!);
      assert.ok(html.includes(result.publicCode));
      assert.ok(!html.includes(result.ownershipCode as string), 'no Ownership Code in the record');
    } finally {
      fixture.database.close();
    }
  });

  it('registers a brand-new registry-only artwork typed inline', async () => {
    const fixture = registrationEnvironment();
    try {
      const result = await registerArtworkWithRecord(fixture.env, unifiedInput({
        artworkId: undefined,
        newArtwork: { id: 'NEW-201', title: 'Quiet Threshold', series: 'Thresholds' },
      }));
      assert.equal(result.codeAccess, 'created');
      assert.deepEqual(result.artwork, {
        id: 'NEW-201', title: 'Quiet Threshold', series: 'Thresholds',
      });
      assert.equal(result.record.status, 'generated');

      const draft = fixture.database.prepare(
        'SELECT title, series, edition_size FROM registry_artworks WHERE id = ?',
      ).get('NEW-201') as { title: string; series: string; edition_size: number | null };
      assert.deepEqual({ ...draft }, {
        title: 'Quiet Threshold', series: 'Thresholds', edition_size: null,
      });

      const snapshot = fixture.database.prepare(
        'SELECT source, canonical_json FROM artwork_catalog_snapshots WHERE artwork_id = ?',
      ).get('NEW-201') as { source: string; canonical_json: string };
      assert.equal(snapshot.source, 'admin');
      assert.equal(JSON.parse(snapshot.canonical_json).title, 'Quiet Threshold');

      assert.equal(recordRows(fixture, result.publicCode).length, 1);
      assert.equal(counts(fixture, 'NEW-201').identities, 1);
    } finally {
      fixture.database.close();
    }
  });

  it('replays idempotently: same identity, no duplicate draft, snapshot, or record', async () => {
    const fixture = registrationEnvironment();
    try {
      const input = unifiedInput({
        artworkId: undefined,
        newArtwork: { id: 'NEW-202', title: 'Second Light' },
        edition: { kind: 'numbered', number: 2, size: 8 },
      });
      const first = await registerArtworkWithRecord(fixture.env, input);
      const replay = await registerArtworkWithRecord(fixture.env, input);
      assert.equal(replay.keeperPieceId, first.keeperPieceId);
      assert.equal(replay.publicCode, first.publicCode);
      assert.equal(replay.codeAccess, 'active-unlock-replay');
      assert.equal(replay.record.status, 'generated');

      assert.deepEqual(counts(fixture, 'NEW-202'), { identities: 1, drafts: 1, snapshots: 1 });
      assert.equal(recordRows(fixture, first.publicCode).length, 1);

      // A replayed size may be omitted; the fixed edition size fills it.
      const omitted = await registerArtworkWithRecord(fixture.env, {
        ...input,
        edition: { kind: 'numbered', number: 2 },
      });
      assert.equal(omitted.keeperPieceId, first.keeperPieceId);

      // The same key with different identity input is refused.
      await assert.rejects(
        registerArtworkWithRecord(fixture.env, { ...input, artworkId: CATALOG_ID, newArtwork: undefined }),
        (error: Error & { code?: string }) => error.code === 'idempotency_conflict',
      );
    } finally {
      fixture.database.close();
    }
  });

  it('fails soft on record generation: registration succeeds with the record deferred', async () => {
    const fixture = registrationEnvironment();
    try {
      fixture.poisonedPrefixes.add('records/');
      const result = await registerArtworkWithRecord(fixture.env, unifiedInput({
        idempotencyKey: 'register-deferred-1',
      }));
      assert.equal(result.registrationStatus, 'registered');
      assert.equal(result.codeAccess, 'created');
      assert.equal(result.record.status, 'deferred');
      assert.ok(result.record.reason, 'a deferral carries its reason');
      assert.equal(counts(fixture, CATALOG_ID).identities, 1);
      assert.equal(recordRows(fixture, result.publicCode).length, 0);

      // The identity backup stayed fail-hard and untouched by the poisoning.
      const piece = fixture.database.prepare(
        'SELECT identity_backup_status FROM keeper_pieces WHERE id = ?',
      ).get(result.keeperPieceId) as { identity_backup_status: string };
      assert.equal(piece.identity_backup_status, 'verified');

      // A retry of the same attempt heals the record once R2 recovers.
      fixture.poisonedPrefixes.clear();
      const healed = await registerArtworkWithRecord(fixture.env, unifiedInput({
        idempotencyKey: 'register-deferred-1',
      }));
      assert.equal(healed.keeperPieceId, result.keeperPieceId);
      assert.equal(healed.record.status, 'generated');
      assert.equal(recordRows(fixture, result.publicCode).length, 1);
    } finally {
      fixture.database.close();
    }
  });

  it('keeps registration atomic when the identity backup fails, record path untouched', async () => {
    const fixture = registrationEnvironment();
    try {
      fixture.poisonedPrefixes.add('identities/');
      await assert.rejects(
        registerArtworkWithRecord(fixture.env, unifiedInput()),
        (error: Error & { code?: string }) => error.code === 'identity_backup_failed',
      );
      assert.equal(counts(fixture, CATALOG_ID).identities, 0);
      assert.equal(fixture.database.prepare(
        'SELECT COUNT(*) AS n FROM piece_records',
      ).get()!.n, 0);
    } finally {
      fixture.database.close();
    }
  });

  it('rejects colliding, reserved, and malformed new-artwork ids', async () => {
    const fixture = registrationEnvironment();
    try {
      const attempt = (newArtwork: Record<string, unknown>, key: string) =>
        registerArtworkWithRecord(fixture.env, unifiedInput({
          artworkId: undefined, newArtwork, idempotencyKey: key,
        }));
      const rejectsWith = async (promise: Promise<unknown>, code: string) => {
        await assert.rejects(promise, (error: Error & { code?: string }) => error.code === code, code);
      };

      // The compiled catalog already owns this id.
      await rejectsWith(attempt({ id: CATALOG_ID, title: 'Imposter' }, 'k1'), 'artwork_id_taken');
      // A different admin draft already owns this id.
      await rejectsWith(attempt({ id: 'SIG-100', title: 'Different Work' }, 'k2'), 'artwork_id_taken');
      // AR- is the public-code namespace.
      await rejectsWith(attempt({ id: 'AR-123', title: 'Reserved' }, 'k3'), 'reserved_artwork_id');
      // Malformed ids and titles never reach the registry.
      await rejectsWith(attempt({ id: 'SIGNATURE-1', title: 'Bad Id' }, 'k4'), 'invalid_new_artwork');
      await rejectsWith(attempt({ id: 'NEW-300', title: '' }, 'k5'), 'invalid_new_artwork');
      // A numbered edition of a new work needs its size fixed.
      await assert.rejects(
        registerArtworkWithRecord(fixture.env, unifiedInput({
          artworkId: undefined,
          newArtwork: { id: 'NEW-301', title: 'Numbered' },
          edition: { kind: 'numbered', number: 1 },
          idempotencyKey: 'k6',
        })),
        (error: Error & { code?: string }) => error.code === 'edition_size_required',
      );
      assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM keeper_pieces').get()!.n, 0);
    } finally {
      fixture.database.close();
    }
  });
});

describe('POST /api/admin/register-artwork contract', () => {
  async function invoke(fixture: Fixture, body: unknown) {
    const token = await createRegistryUnlockToken(fixture.env, adminIdentity);
    const request = new Request(`${ORIGIN}/api/admin/register-artwork`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        Cookie: `better-auth.session_token=admin-session; registry_unlock=${token}`,
      },
      body: JSON.stringify(body),
    });
    return onRequest({ request, env: fixture.env });
  }

  it('registers end to end and answers with the identity plus the record status', async () => {
    const fixture = registrationEnvironment();
    try {
      const response = await invoke(fixture, {
        artworkId: CATALOG_ID,
        edition: { kind: 'unique' },
        idempotencyKey: 'endpoint-register-1',
      });
      assert.equal(response.status, 201);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      const payload = await response.json() as Record<string, unknown>;
      assert.equal(payload.ok, true);
      assert.match(String(payload.publicCode), /^AR-/);
      assert.match(String(payload.ownershipCode), /^[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}$/);
      assert.deepEqual(payload.record, { status: 'generated' });
      assert.deepEqual(payload.artwork, {
        id: CATALOG_ID, title: catalogArtwork!.title, series: catalogArtwork!.series || null,
      });
      assert.doesNotMatch(JSON.stringify(payload), /recordHash|backupReference|identities\//);
    } finally {
      fixture.database.close();
    }
  });

  it('carries no commerce concepts: any Stripe, Shopify, order, or fulfillment field is refused', async () => {
    const fixture = registrationEnvironment();
    try {
      const base = {
        artworkId: CATALOG_ID,
        edition: { kind: 'unique' },
        idempotencyKey: 'endpoint-clean-1',
      };
      for (const plant of [
        { stripeSessionId: 'cs_test_1' },
        { stripePriceId: 'price_1' },
        { shopifyOrderId: '1001' },
        { orderId: 'order-1' },
        { fulfillment: { carrier: 'dhl' } },
        { shipment: 'tomorrow' },
        { priceUsd: 1200 },
        { buyerEmail: 'buyer@example.com' },
      ]) {
        const response = await invoke(fixture, { ...base, ...plant });
        assert.equal(response.status, 400, Object.keys(plant)[0]);
        assert.deepEqual(await response.json(), { ok: false, error: 'invalid_registration' });
      }
      assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM keeper_pieces').get()!.n, 0);
    } finally {
      fixture.database.close();
    }
  });

  it('answers 409 for an id collision and 404 for an unknown artwork', async () => {
    const fixture = registrationEnvironment();
    try {
      const taken = await invoke(fixture, {
        newArtwork: { id: 'SIG-100', title: 'Different Work' },
        edition: { kind: 'unique' },
        idempotencyKey: 'endpoint-collision-1',
      });
      assert.equal(taken.status, 409);
      assert.deepEqual(await taken.json(), { ok: false, error: 'artwork_id_taken' });

      const unknown = await invoke(fixture, {
        artworkId: 'ZZZ-999',
        edition: { kind: 'unique' },
        idempotencyKey: 'endpoint-unknown-1',
      });
      assert.equal(unknown.status, 404);
      assert.deepEqual(await unknown.json(), { ok: false, error: 'unknown_artwork' });
    } finally {
      fixture.database.close();
    }
  });
});
