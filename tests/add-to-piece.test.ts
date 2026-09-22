import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, describe, it, mock } from 'node:test';

/**
 * The additive "Add to this piece" layer: artwork-scoped media attach with
 * fail-soft record regeneration, the story as a new admin catalog snapshot,
 * the sealed artist message (migration 040), and the existing-owner path
 * where registration is followed by a first-bind invitation through the
 * existing invitation machinery. Real migrations 001 through 039, real
 * endpoints, in-memory R2.
 */

const ORIGIN = 'https://adrianrasmussen.com';
const STEP_UP_SECRET = 'add-to-piece-step-up-secret';

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
const { createRegistryUnlockToken } = await import('../functions/api/_lib/admin.js');
const {
  createArtistMessage, readForArtist, revealForKeeper, validateArtistMessageBody,
} = await import('../functions/api/_lib/artistMessage.js');
const { onRequest: mediaEndpoint } = await import('../functions/api/admin/artworks/[id]/media.js');
const { onRequest: storyEndpoint } = await import('../functions/api/admin/artworks/[id]/story.js');
const { onRequest: messageEndpoint } = await import('../functions/api/admin/artworks/[id]/message.js');
const { onRequest: registerEndpoint } = await import('../functions/api/admin/register-artwork.js');
const { onRequest: invitationsEndpoint } = await import('../functions/api/admin/invitations.js');

after(() => mock.reset());

// Real migrations 001 through 039 (037 is reserved by a different, unrelated
// feature and does not exist yet; it is skipped here on purpose).
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
  '021_registry_plate_backup_digest.sql',
  '022_registry_fulfillment_detachment.sql', '023_collector_registry_merge.sql',
  '024_ownership_foundation.sql', '025_artwork_registration.sql',
  '026_artwork_invitations.sql', '027_certificate_templates.sql',
  '028_collector_privacy.sql', '029_collector_dreams.sql',
  '030_collector_field.sql', '031_collector_letters.sql',
  '032_artist_verified_sales.sql', '033_artwork_contributors.sql',
  '034_artwork_contributor_invite_rate_limit.sql',
  '036_artwork_catalog_snapshots.sql', '037_piece_records.sql',
  '039_piece_media.sql', '040_artist_messages.sql',
];

type Fixture = ReturnType<typeof fixtureEnvironment>;

/** In-memory R2 with etags, conditional puts, and poisonable prefixes: the
 * union of what pieceMedia.js (lease CAS, streamed get) and pieceRecord.js /
 * identityBackup.js (write-once, arrayBuffer/text read-back) exercise. */
function memoryBucket() {
  const store = new Map<string, {
    bytes: Uint8Array;
    etag: string;
    httpMetadata?: Record<string, string>;
    customMetadata?: Record<string, string>;
  }>();
  const poisonedPrefixes = new Set<string>();
  let counter = 0;

  const poisoned = (key: string) => {
    for (const prefix of poisonedPrefixes) {
      if (key.startsWith(prefix)) return true;
    }
    return false;
  };

  function descriptor(key: string, entry: NonNullable<ReturnType<typeof store.get>>, withBody: boolean) {
    const bytes = entry.bytes;
    const result: Record<string, unknown> = {
      key,
      etag: entry.etag,
      size: bytes.byteLength,
      httpMetadata: entry.httpMetadata,
      customMetadata: entry.customMetadata,
      async arrayBuffer() { return bytes.slice().buffer; },
      async text() { return new TextDecoder().decode(bytes); },
    };
    if (withBody) {
      result.body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bytes.slice());
          controller.close();
        },
      });
    }
    return result;
  }

  return {
    store,
    poisonedPrefixes,
    async put(key: string, value: Uint8Array | string, options: {
      onlyIf?: { etagDoesNotMatch?: string; etagMatches?: string };
      httpMetadata?: Record<string, string>;
      customMetadata?: Record<string, string>;
    } = {}) {
      if (poisoned(key)) throw new Error(`simulated R2 failure for ${key}`);
      const existing = store.get(key);
      const onlyIf = options.onlyIf;
      if (onlyIf?.etagDoesNotMatch === '*' && existing) return null;
      if (onlyIf?.etagMatches !== undefined
        && (!existing || existing.etag !== onlyIf.etagMatches)) return null;
      counter += 1;
      const bytes = typeof value === 'string'
        ? new TextEncoder().encode(value)
        : new Uint8Array(value).slice();
      const entry = {
        bytes,
        etag: `etag-${counter}`,
        httpMetadata: options.httpMetadata,
        customMetadata: options.customMetadata,
      };
      store.set(key, entry);
      return descriptor(key, entry, false);
    },
    async get(key: string) {
      if (poisoned(key)) throw new Error(`simulated R2 failure for ${key}`);
      const entry = store.get(key);
      return entry ? descriptor(key, entry, true) : null;
    },
    async head(key: string) {
      const entry = store.get(key);
      return entry ? descriptor(key, entry, false) : null;
    },
  };
}

function fixtureEnvironment() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  for (const name of migrationNames) {
    database.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
  const DB = {
    prepare(sql: string) {
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...bound: SQLInputValue[]) { values = bound; return statement; },
        async first() { return database.prepare(sql).get(...values) ?? null; },
        async all() { return { results: database.prepare(sql).all(...values) }; },
        async run() {
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
  const bucket = memoryBucket();
  return {
    database,
    bucket,
    env: {
      DB,
      ARTWORK_REGISTRY_BACKUP: bucket,
      OWNERSHIP_CODE_ACTIVE_KEY_VERSION: '1',
      OWNERSHIP_CODE_KEY_V1: Buffer.alloc(32, 7).toString('base64'),
      REGISTRY_STEP_UP_SECRET: STEP_UP_SECRET,
    },
  };
}

let registrationCounter = 0;

/** Register a fresh registry-only artwork; returns its identity. */
async function registerFixtureArtwork(fixture: Fixture, artworkId: string) {
  registrationCounter += 1;
  const result: any = await registerArtworkWithRecord(fixture.env, {
    newArtwork: { id: artworkId, title: `Held Light ${registrationCounter}` },
    edition: { kind: 'unique' },
    authorization: {
      userId: 'admin-user',
      email: 'artist@example.com',
      registryUnlockExpiresAt: Math.floor(Date.now() / 1000) + 600,
    },
    idempotencyKey: `add-to-piece-register-${registrationCounter}`,
    registeredAt: '2026-08-19T01:02:03.000Z',
  });
  assert.equal(result.registrationStatus, 'registered');
  return { keeperPieceId: result.keeperPieceId as string, publicCode: result.publicCode as string };
}

async function invoke(
  fixture: Fixture,
  endpoint: (context: any) => Promise<Response>,
  method: string,
  path: string,
  params: Record<string, string>,
  body?: unknown,
) {
  const token = await createRegistryUnlockToken(fixture.env, adminIdentity);
  const request = new Request(`${ORIGIN}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      Cookie: `better-auth.session_token=admin-session; registry_unlock=${token}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return endpoint({ request, env: fixture.env, params });
}

function recordRows(fixture: Fixture, publicCode: string) {
  return fixture.database.prepare(
    'SELECT trigger_event, r2_key, record_hash FROM piece_records WHERE public_code = ? ORDER BY created_at, id',
  ).all(publicCode) as Array<{ trigger_event: string; r2_key: string; record_hash: string }>;
}

const NOW = '2026-08-19T02:00:00.000Z';

describe('POST /api/admin/artworks/[id]/media (artwork-scoped attach)', () => {
  it('admits a photo, records the attach, and reports per-instance record outcomes', async () => {
    const fixture = fixtureEnvironment();
    try {
      const { publicCode } = await registerFixtureArtwork(fixture, 'ATP-100');
      const bytes = new TextEncoder().encode('a small jpeg-shaped payload');
      const response = await invoke(
        fixture, mediaEndpoint, 'POST', '/api/admin/artworks/ATP-100/media', { id: 'ATP-100' },
        { kind: 'photo', contentType: 'image/jpeg', bytes: Buffer.from(bytes).toString('base64') },
      );
      assert.equal(response.status, 201);
      const payload = await response.json() as any;
      assert.equal(payload.ok, true);
      assert.equal(payload.media.artworkId, 'ATP-100');
      assert.equal(payload.media.kind, 'photo');
      assert.equal(payload.records.total, 1);
      assert.equal(payload.records.failed, 0);
      assert.equal(payload.records.outcomes[0].publicCode, publicCode);
      // Artwork media does not alter record content today, so regeneration
      // is a clean no-op rather than a churned duplicate.
      assert.equal(payload.records.outcomes[0].status, 'unchanged');
      assert.equal(recordRows(fixture, publicCode).length, 1);

      const row = fixture.database.prepare(
        'SELECT artwork_id, keeper_piece_id, kind FROM piece_media WHERE id = ?',
      ).get(payload.media.id) as any;
      assert.equal(row.artwork_id, 'ATP-100');
      assert.equal(row.keeper_piece_id, null);

      const listed = await invoke(
        fixture, mediaEndpoint, 'GET', '/api/admin/artworks/ATP-100/media', { id: 'ATP-100' },
      );
      const listing = await listed.json() as any;
      assert.equal(listing.media.length, 1);
    } finally {
      fixture.database.close();
    }
  });

  it('stays fail-soft when record regeneration cannot reach R2', async () => {
    const fixture = fixtureEnvironment();
    try {
      await registerFixtureArtwork(fixture, 'ATP-101');
      // Poison the records prefix AFTER registration: the attach itself
      // (media/ prefix) succeeds while every record write fails.
      fixture.bucket.poisonedPrefixes.add('records/');
      const response = await invoke(
        fixture, mediaEndpoint, 'POST', '/api/admin/artworks/ATP-101/media', { id: 'ATP-101' },
        {
          kind: 'photo',
          contentType: 'image/png',
          bytes: Buffer.from('a png-shaped payload').toString('base64'),
        },
      );
      assert.equal(response.status, 201);
      const payload = await response.json() as any;
      assert.equal(payload.ok, true, 'the attach succeeds even when records fail');
      assert.equal(payload.records.total, 1);
      assert.equal(payload.records.failed, 1);
      assert.equal(payload.records.outcomes[0].status, 'failed');
      const media = fixture.database.prepare(
        "SELECT COUNT(*) AS n FROM piece_media WHERE artwork_id = 'ATP-101'",
      ).get() as any;
      assert.equal(media.n, 1);
    } finally {
      fixture.database.close();
    }
  });

  it('refuses an unknown artwork and a foreign kind', async () => {
    const fixture = fixtureEnvironment();
    try {
      const unknown = await invoke(
        fixture, mediaEndpoint, 'POST', '/api/admin/artworks/ZZZ-999/media', { id: 'ZZZ-999' },
        { kind: 'photo', contentType: 'image/jpeg', bytes: Buffer.from('x').toString('base64') },
      );
      assert.equal(unknown.status, 404);

      await registerFixtureArtwork(fixture, 'ATP-102');
      const audio = await invoke(
        fixture, mediaEndpoint, 'POST', '/api/admin/artworks/ATP-102/media', { id: 'ATP-102' },
        { kind: 'artist_message_audio', contentType: 'audio/mpeg', bytes: Buffer.from('x').toString('base64') },
      );
      assert.equal(audio.status, 400);
    } finally {
      fixture.database.close();
    }
  });
});

describe('POST /api/admin/artworks/[id]/story', () => {
  it('writes a new admin snapshot merging prior fields and regenerates the record', async () => {
    const fixture = fixtureEnvironment();
    try {
      const { publicCode } = await registerFixtureArtwork(fixture, 'ATP-110');
      const story = 'Carved through one long winter, this piece kept the shape the wood asked for.';
      const response = await invoke(
        fixture, storyEndpoint, 'POST', '/api/admin/artworks/ATP-110/story', { id: 'ATP-110' },
        { story },
      );
      assert.equal(response.status, 201);
      const payload = await response.json() as any;
      assert.equal(payload.ok, true);
      assert.equal(payload.story, story);
      assert.equal(payload.snapshot.inserted, true);
      assert.equal(payload.records.generated, 1);

      const snapshots = fixture.database.prepare(
        "SELECT source, canonical_json FROM artwork_catalog_snapshots WHERE artwork_id = 'ATP-110' ORDER BY created_at, id",
      ).all() as any[];
      assert.equal(snapshots.length, 2, 'registration snapshot plus the story snapshot');
      const newest = JSON.parse(snapshots[1].canonical_json);
      assert.equal(snapshots[1].source, 'admin');
      assert.equal(newest.description, story);
      assert.equal(newest.title, JSON.parse(snapshots[0].canonical_json).title, 'prior fields merged');

      const records = recordRows(fixture, publicCode);
      assert.equal(records.length, 2);
      assert.equal(records[1].trigger_event, 'attachment');
      const html = new TextDecoder().decode(
        fixture.bucket.store.get(records[1].r2_key)!.bytes,
      );
      assert.ok(html.includes(story), 'the story reached the permanent record');

      const read = await invoke(
        fixture, storyEndpoint, 'GET', '/api/admin/artworks/ATP-110/story', { id: 'ATP-110' },
      );
      assert.equal(((await read.json()) as any).story, story);
    } finally {
      fixture.database.close();
    }
  });

  it('rejects an empty, oversize, or control-character story', async () => {
    const fixture = fixtureEnvironment();
    try {
      await registerFixtureArtwork(fixture, 'ATP-111');
      for (const bad of ['', '   ', 'a'.repeat(5001), 'quiet\u0007bell']) {
        const response = await invoke(
          fixture, storyEndpoint, 'POST', '/api/admin/artworks/ATP-111/story', { id: 'ATP-111' },
          { story: bad },
        );
        assert.equal(response.status, 400);
      }
      const snapshots = fixture.database.prepare(
        "SELECT COUNT(*) AS n FROM artwork_catalog_snapshots WHERE artwork_id = 'ATP-111'",
      ).get() as any;
      assert.equal(snapshots.n, 1, 'only the registration snapshot exists');
    } finally {
      fixture.database.close();
    }
  });
});

describe('artist messages (migration 040): sealed until the caretaker unlocks', () => {
  it('creates, supersedes on rewrite, and reveals exactly once', async () => {
    const fixture = fixtureEnvironment();
    try {
      const { keeperPieceId } = await registerFixtureArtwork(fixture, 'ATP-120');
      const first = await createArtistMessage(fixture.env.DB, {
        keeperPieceId, body: 'May this piece keep you company.', createdAt: NOW,
      });
      assert.equal(first.revealedAt, null);
      assert.equal(first.supersededAt, null);

      const second = await createArtistMessage(fixture.env.DB, {
        keeperPieceId, body: 'A newer word, before anyone met the first.', createdAt: NOW,
      });
      assert.notEqual(second.id, first.id);
      const priorRow = fixture.database.prepare(
        'SELECT superseded_at FROM artist_messages WHERE id = ?',
      ).get(first.id) as any;
      assert.equal(priorRow.superseded_at, NOW, 'the prior message is superseded');

      const active = await readForArtist(fixture.env.DB, keeperPieceId);
      assert.equal(active!.id, second.id);
      assert.equal(active!.body, 'A newer word, before anyone met the first.');

      const revealed = await revealForKeeper(fixture.env.DB, keeperPieceId, '2026-08-20T00:00:00.000Z');
      assert.equal(revealed!.revealedAt, '2026-08-20T00:00:00.000Z');
      // Reveal-once: a later call returns the same stamp unchanged.
      const again = await revealForKeeper(fixture.env.DB, keeperPieceId, '2026-09-01T00:00:00.000Z');
      assert.equal(again!.revealedAt, '2026-08-20T00:00:00.000Z');
    } finally {
      fixture.database.close();
    }
  });

  it('enforces the body discipline and the immutability triggers in the schema itself', async () => {
    const fixture = fixtureEnvironment();
    try {
      const { keeperPieceId } = await registerFixtureArtwork(fixture, 'ATP-121');
      const insert = fixture.database.prepare(
        'INSERT INTO artist_messages (id, keeper_piece_id, body, created_at) VALUES (?, ?, ?, ?)',
      );

      // The 031-mirrored body CHECKs.
      assert.throws(() => insert.run('am-bad-1', keeperPieceId, 'reach me at a@b.example', NOW), /CHECK constraint failed/);
      assert.throws(() => insert.run('am-bad-2', keeperPieceId, 'line one\nline two', NOW), /CHECK constraint failed/);
      assert.throws(() => insert.run('am-bad-3', keeperPieceId, `see kp-abc`, NOW), /CHECK constraint failed/);
      assert.throws(() => insert.run('am-bad-4', keeperPieceId, ' padded ', NOW), /CHECK constraint failed/);
      assert.throws(() => insert.run('am-bad-5', keeperPieceId, 'x'.repeat(2001), NOW), /CHECK constraint failed/);
      // The lib mirrors the schema, normalizing only outer whitespace.
      for (const bad of ['a@b', 'two\nlines', 'x'.repeat(2001), 'auth-thing', '', '   ']) {
        assert.throws(() => validateArtistMessageBody(bad), /invalid_message_body/);
      }
      assert.equal(validateArtistMessageBody(' padded '), 'padded');

      insert.run('am-good-1', keeperPieceId, 'A single quiet paragraph.', NOW);

      // Only one ACTIVE message per piece.
      assert.throws(
        () => insert.run('am-good-2', keeperPieceId, 'A second active one.', NOW),
        /UNIQUE constraint failed/,
      );

      // Body immutable after insert; no DELETE, ever.
      assert.throws(
        () => fixture.database.prepare('UPDATE artist_messages SET body = ? WHERE id = ?')
          .run('rewritten', 'am-good-1'),
        /first reveal or a first supersede/,
      );
      assert.throws(
        () => fixture.database.prepare('DELETE FROM artist_messages WHERE id = ?').run('am-good-1'),
        /never deleted/,
      );

      // revealed_at moves NULL -> value exactly once and never again.
      fixture.database.prepare('UPDATE artist_messages SET revealed_at = ? WHERE id = ?')
        .run(NOW, 'am-good-1');
      assert.throws(
        () => fixture.database.prepare('UPDATE artist_messages SET revealed_at = ? WHERE id = ?')
          .run('2027-01-01T00:00:00.000Z', 'am-good-1'),
        /first reveal or a first supersede/,
      );
      assert.throws(
        () => fixture.database.prepare('UPDATE artist_messages SET revealed_at = NULL WHERE id = ?')
          .run('am-good-1'),
        /first reveal or a first supersede/,
      );

      // superseded_at is likewise one-way.
      fixture.database.prepare('UPDATE artist_messages SET superseded_at = ? WHERE id = ?')
        .run(NOW, 'am-good-1');
      assert.throws(
        () => fixture.database.prepare('UPDATE artist_messages SET superseded_at = NULL WHERE id = ?')
          .run('am-good-1'),
        /first reveal or a first supersede/,
      );
    } finally {
      fixture.database.close();
    }
  });

  it('serves the endpoint contract and never lets a body into a public record', async () => {
    const fixture = fixtureEnvironment();
    try {
      const { keeperPieceId, publicCode } = await registerFixtureArtwork(fixture, 'ATP-122');
      const distinctive = 'orchid lantern seven, a word only the caretaker will meet';

      const sealed = await invoke(
        fixture, messageEndpoint, 'POST', '/api/admin/artworks/ATP-122/message', { id: 'ATP-122' },
        { keeperPieceId, body: distinctive },
      );
      assert.equal(sealed.status, 201);
      const sealedPayload = await sealed.json() as any;
      assert.equal(sealedPayload.ok, true);
      assert.ok(!JSON.stringify(sealedPayload).includes(distinctive), 'POST answers a body-free summary');

      // The instance listing carries a body-free summary only.
      const listed = await invoke(
        fixture, messageEndpoint, 'GET', '/api/admin/artworks/ATP-122/message', { id: 'ATP-122' },
      );
      const listing = await listed.json() as any;
      assert.equal(listing.instances.length, 1);
      assert.equal(listing.instances[0].keeperPieceId, keeperPieceId);
      assert.ok(listing.instances[0].message.id, 'the summary names the message');
      assert.ok(!JSON.stringify(listing).includes(distinctive), 'no body in the listing');

      // The artist reads the sealed body back for the chosen instance.
      const read = await invoke(
        fixture, messageEndpoint, 'GET',
        `/api/admin/artworks/ATP-122/message?keeperPieceId=${encodeURIComponent(keeperPieceId)}`,
        { id: 'ATP-122' },
      );
      const readPayload = await read.json() as any;
      assert.equal(readPayload.message.body, distinctive);
      assert.equal(readPayload.message.revealedAt, null);

      // Force a full record regeneration and prove the message is in none of
      // the permanent artifacts: not the HTML, not the canonical JSON, not
      // anything else the registry bucket holds.
      const storied = await invoke(
        fixture, storyEndpoint, 'POST', '/api/admin/artworks/ATP-122/story', { id: 'ATP-122' },
        { story: 'The story is public; the message is not.' },
      );
      assert.equal(storied.status, 201);
      assert.ok(recordRows(fixture, publicCode).length >= 2);
      for (const [key, entry] of fixture.bucket.store) {
        const text = new TextDecoder().decode(entry.bytes);
        assert.ok(!text.includes(distinctive), `sealed body leaked into ${key}`);
      }
    } finally {
      fixture.database.close();
    }
  });
});

describe('the existing-owner path: register, then invite through the existing machinery', () => {
  it('registers via /api/admin/register-artwork and creates the first-bind invitation', async () => {
    const fixture = fixtureEnvironment();
    try {
      const registered = await invoke(
        fixture, registerEndpoint, 'POST', '/api/admin/register-artwork', {},
        {
          newArtwork: { id: 'ATP-130', title: 'Already Held' },
          edition: { kind: 'unique' },
          idempotencyKey: 'held-register-1',
        },
      );
      assert.equal(registered.status, 201);
      const identity = await registered.json() as any;
      assert.ok(identity.keeperPieceId);
      assert.ok(identity.ownershipCode, 'the Ownership Code is still shown once');

      const invited = await invoke(
        fixture, invitationsEndpoint, 'POST', '/api/admin/invitations', {},
        {
          keeperPieceId: identity.keeperPieceId,
          intendedRecipientEmail: 'holder@example.com',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          idempotencyKey: 'held-invite-1',
        },
      );
      assert.equal(invited.status, 201);
      const invitation = await invited.json() as any;
      assert.equal(invitation.ok, true);
      assert.match(invitation.invitationId, /^iv-/);
      assert.ok(invitation.token, 'the single-use proof is returned once');

      const row = fixture.database.prepare(
        'SELECT keeper_piece_id, intended_recipient_email FROM artwork_invitations WHERE id = ?',
      ).get(invitation.invitationId) as any;
      assert.equal(row.keeper_piece_id, identity.keeperPieceId);
      assert.equal(row.intended_recipient_email, 'holder@example.com');

      const listed = await invoke(
        fixture, invitationsEndpoint, 'GET', '/api/admin/invitations', {},
      );
      const listing = await listed.json() as any;
      assert.equal(listing.invitations.length, 1);
      assert.equal(listing.invitations[0].status, 'available');
      assert.equal(listing.invitations[0].keeperPieceId, identity.keeperPieceId);
    } finally {
      fixture.database.close();
    }
  });
});
