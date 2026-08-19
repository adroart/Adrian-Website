import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

type SessionData = {
  session: { id: string };
  user: { id: string; email: string; emailVerified: boolean };
} | null;

let sessionData: SessionData = null;

before(() => {
  mock.module('../lib/account/auth.server.js', {
    namedExports: {
      createAuth: () => ({
        api: { getSession: async () => sessionData },
      }),
    },
  });
});

beforeEach(() => {
  sessionData = null;
});

after(() => mock.reset());

import {
  buildPieceRecordsArchive,
  buildStoredZip,
  crc32,
  recordTitleFromHtml,
  renderRecordsIndexHtml,
} from '../functions/api/_lib/recordArchive.js';
import { syncRecordsArchiveToDrive } from '../functions/api/_lib/driveSync.js';
import { publishPieceRecord } from '../functions/api/_lib/pieceRecord.js';
import { ensureCatalogSnapshot } from '../functions/api/_lib/catalogSnapshot.js';

const ORIGIN = 'https://adrianrasmussen.com';

const readMigration = (name: string) => readFileSync(
  new URL(`../migrations/${name}`, import.meta.url), 'utf8',
);

const migrationsThroughPieceRecords = [
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
  '035_artwork_catalog_snapshots.sql', '036_piece_records.sql',
].map(readMigration).join('\n');

function d1(database: DatabaseSync) {
  const prepare = (sql: string) => {
    let values: SQLInputValue[] = [];
    return {
      bind(...next: SQLInputValue[]) { values = next; return this; },
      async first() { return database.prepare(sql).get(...values) || null; },
      async all() { return { results: database.prepare(sql).all(...values) }; },
      async run() {
        const result = database.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(result.changes) } };
      },
    };
  };
  return { prepare };
}

/** Write-once fake R2 matching the slice of the API the record code uses. */
function fakeBucket() {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
    async get(key: string) {
      const bytes = objects.get(key);
      if (!bytes) return null;
      return {
        arrayBuffer: async () => bytes.slice().buffer,
        text: async () => new TextDecoder().decode(bytes),
      };
    },
    async put(key: string, value: Uint8Array | string, options?: {
      onlyIf?: { etagDoesNotMatch?: string };
    }) {
      if (options?.onlyIf?.etagDoesNotMatch === '*' && objects.has(key)) return null;
      objects.set(
        key,
        value instanceof Uint8Array ? value.slice() : new TextEncoder().encode(String(value)),
      );
      return {};
    },
  };
}

const CODE_ONE = 'AR-ABCDEFGH';
const CODE_TWO = 'AR-KLMNPQRS';

async function fixtureEnv() {
  const database = new DatabaseSync(':memory:');
  database.exec(migrationsThroughPieceRecords);
  database.exec(`
    PRAGMA foreign_keys = ON;
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, recovery_code_hash, registered_at,
       public_code, plate_status)
    VALUES
      ('kp-archive-one', 'UL-901', 0, '${'a'.repeat(64)}',
       '2026-08-01T00:00:00.000Z', '${CODE_ONE}', 'active'),
      ('kp-archive-two', 'UL-902', 0, '${'b'.repeat(64)}',
       '2026-08-01T00:00:00.000Z', '${CODE_TWO}', 'active');
  `);
  const env = {
    DB: d1(database),
    ARTWORK_REGISTRY_BACKUP: fakeBucket(),
    ADMIN_EMAILS: 'artist@example.com',
    REGISTRY_STEP_UP_SECRET: 'registry-step-up-secret',
  };
  await ensureCatalogSnapshot(env, {
    id: 'UL-901', title: 'Earth Archive', series: 'Universal Language',
    category: 'Multidimensional Art', year: '2024', material: 'Carved wood',
    description: 'The first archived piece.',
  }, { source: 'mockData', createdAt: '2026-08-10T00:00:00.000Z' });
  await ensureCatalogSnapshot(env, {
    id: 'UL-902', title: 'Water Archive', series: 'Universal Language',
    category: 'Multidimensional Art', year: '2025', material: 'Carved teak',
    description: 'The second archived piece.',
  }, { source: 'mockData', createdAt: '2026-08-10T00:00:00.000Z' });
  return { database, env };
}

async function publishFixtureRecords(env: any) {
  for (const [publicCode, generatedAt] of [
    [CODE_ONE, '2026-08-15T00:00:00.000Z'],
    [CODE_TWO, '2026-08-15T00:00:00.000Z'],
  ]) {
    const result = await publishPieceRecord(env, {
      publicCode, trigger: 'registration', generatedAt,
    });
    assert.equal(result.status, 'verified', publicCode);
  }
}

/* ── A minimal STORE-zip reader, used only to prove readability ─────── */

function readStoredZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // End of central directory (no comment, so it sits at the fixed tail).
  const eocd = bytes.byteLength - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054B50, 'EOCD signature');
  const entryCount = view.getUint16(eocd + 8, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = new Map<string, Uint8Array>();
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(view.getUint32(offset, true), 0x02014B50, 'central signature');
    assert.equal(view.getUint16(offset + 10, true), 0, 'method STORE');
    const crc = view.getUint32(offset + 16, true);
    const size = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    // Local header for the same entry.
    assert.equal(view.getUint32(localOffset, true), 0x04034B50, 'local signature');
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.subarray(dataStart, dataStart + size);
    assert.equal(crc32(data), crc, `crc for ${name}`);
    entries.set(name, data.slice());
    offset += 46 + nameLength;
  }
  return entries;
}

describe('deterministic STORE zip writer', () => {
  it('computes the reference CRC-32 check value', () => {
    assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
    assert.equal(crc32(new Uint8Array(0)), 0);
  });

  it('produces identical bytes for identical input, in any entry order', () => {
    const one = { name: 'records/a.html', bytes: new TextEncoder().encode('alpha') };
    const two = { name: 'records/b.html', bytes: new TextEncoder().encode('beta') };
    const first = buildStoredZip([one, two]);
    const second = buildStoredZip([two, one]);
    assert.deepEqual(first, second);

    const changed = buildStoredZip([
      one, { name: 'records/b.html', bytes: new TextEncoder().encode('BETA') },
    ]);
    assert.notDeepEqual(first, changed);
  });

  it('is readable: names, sizes, and CRCs all verify with a plain reader', () => {
    const entries = [
      { name: 'records/index.html', bytes: new TextEncoder().encode('<p>index</p>') },
      { name: 'records/AR-ABCDEFGH.html', bytes: new TextEncoder().encode('<p>one</p>') },
    ];
    const zip = buildStoredZip(entries);
    const read = readStoredZip(zip);
    assert.deepEqual([...read.keys()].sort(), [
      'records/AR-ABCDEFGH.html', 'records/index.html',
    ]);
    assert.equal(new TextDecoder().decode(read.get('records/index.html')!), '<p>index</p>');
  });

  it('refuses unsafe or duplicate entry names and empty archives', () => {
    const bytes = new TextEncoder().encode('x');
    assert.throws(() => buildStoredZip([]), /empty_zip/);
    assert.throws(() => buildStoredZip([{ name: '../escape.html', bytes }]), /invalid_zip_entry/);
    assert.throws(() => buildStoredZip([{ name: '/absolute.html', bytes }]), /invalid_zip_entry/);
    assert.throws(
      () => buildStoredZip([{ name: 'a.html', bytes }, { name: 'a.html', bytes }]),
      /duplicate_zip_entry/,
    );
  });
});

describe('piece records archive', () => {
  it('archives the newest record per piece plus a generated index front door', async () => {
    const { env } = await fixtureEnv();
    await publishFixtureRecords(env);

    // A newer record for piece one (content changes through generatedAt).
    const newer = await publishPieceRecord(env, {
      publicCode: CODE_ONE, trigger: 'on_demand', generatedAt: '2026-08-18T00:00:00.000Z',
    });
    assert.equal(newer.status, 'verified');

    const { bytes, pieces } = await buildPieceRecordsArchive(env);
    const read = readStoredZip(bytes);
    assert.deepEqual([...read.keys()].sort(), [
      `records/${CODE_ONE}.html`,
      `records/${CODE_TWO}.html`,
      'records/index.html',
    ]);

    // The newest record for piece one is the one in the archive.
    const archivedOne = new TextDecoder().decode(read.get(`records/${CODE_ONE}.html`)!);
    assert.match(archivedOne, /Generated 2026-08-18/);
    assert.equal(recordTitleFromHtml(archivedOne, CODE_ONE), 'Earth Archive');

    // The archived bytes are exactly the stored R2 bytes.
    const storedKey = `records/${CODE_ONE}/${newer.recordHash}.html`;
    assert.deepEqual(
      read.get(`records/${CODE_ONE}.html`),
      env.ARTWORK_REGISTRY_BACKUP.objects.get(storedKey),
    );

    // The index lists every piece: title · code · link.
    const index = new TextDecoder().decode(read.get('records/index.html')!);
    assert.match(index, /Earth Archive · <span class="code">AR-ABCDEFGH<\/span>/);
    assert.match(index, /Water Archive · <span class="code">AR-KLMNPQRS<\/span>/);
    assert.match(index, /href="AR-ABCDEFGH\.html"/);
    assert.match(index, /href="AR-KLMNPQRS\.html"/);
    assert.deepEqual(pieces.map((piece: any) => piece.publicCode), [CODE_ONE, CODE_TWO]);
  });

  it('builds byte-identical archives from identical stored state', async () => {
    const { env } = await fixtureEnv();
    await publishFixtureRecords(env);
    const first = await buildPieceRecordsArchive(env);
    const second = await buildPieceRecordsArchive(env);
    assert.deepEqual(first.bytes, second.bytes);
  });

  it('renders a deterministic index and falls back to the code for unreadable titles', () => {
    const html = renderRecordsIndexHtml([
      { publicCode: CODE_ONE, title: 'Earth Archive', recordHash: 'f'.repeat(64) },
    ]);
    assert.match(html, /Piece Records/);
    assert.doesNotMatch(html, /—/, 'no em dashes');
    assert.equal(recordTitleFromHtml('<html>no block</html>', CODE_TWO), CODE_TWO);
  });
});

/* ── Endpoint guards ────────────────────────────────────────────────── */

function request(
  path: string,
  method: string,
  body?: unknown,
  cookie = 'better-auth.session_token=test-session',
) {
  const headers = new Headers({ Cookie: cookie, Origin: ORIGIN });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function signIn(email = 'artist@example.com') {
  sessionData = {
    session: { id: 'session-1' },
    user: { id: 'user-1', email, emailVerified: true },
  };
}

async function unlockedCookie(environment: any) {
  const { createRegistryUnlockToken } = await import('../functions/api/_lib/admin.js');
  const token = await createRegistryUnlockToken(environment, {
    userId: 'user-1',
    email: 'artist@example.com',
    session: { id: 'session-1' },
  });
  return `better-auth.session_token=test-session; registry_unlock=${token}`;
}

describe('records export endpoint', () => {
  it('requires an admin session and the registry step-up unlock', async () => {
    const { env } = await fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/records/export.js');

    const guest = await onRequest({ request: request('/api/admin/records/export', 'GET'), env });
    assert.equal(guest.status, 401);

    signIn('collector@example.com');
    const nonAdmin = await onRequest({ request: request('/api/admin/records/export', 'GET'), env });
    assert.equal(nonAdmin.status, 403);

    signIn();
    const locked = await onRequest({ request: request('/api/admin/records/export', 'GET'), env });
    assert.equal(locked.status, 403);
    assert.deepEqual(await locked.json(), { ok: false, error: 'registry_locked' });
  });

  it('streams the archive as a piece-records.zip attachment when unlocked', async () => {
    const { env } = await fixtureEnv();
    await publishFixtureRecords(env);
    const { onRequest } = await import('../functions/api/admin/records/export.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const response = await onRequest({
      request: request('/api/admin/records/export', 'GET', undefined, cookie), env,
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'application/zip');
    assert.equal(
      response.headers.get('Content-Disposition'),
      'attachment; filename="piece-records.zip"',
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    const read = readStoredZip(bytes);
    assert.equal(read.has('records/index.html'), true);
    assert.equal(read.has(`records/${CODE_ONE}.html`), true);

    const method = await onRequest({
      request: request('/api/admin/records/export', 'PUT', undefined, cookie), env,
    });
    assert.equal(method.status, 405);
  });

  it('fails closed on POST until the Drive credentials are provisioned', async () => {
    const { env } = await fixtureEnv();
    await publishFixtureRecords(env);
    const { onRequest } = await import('../functions/api/admin/records/export.js');
    signIn();
    const cookie = await unlockedCookie(env);
    const response = await onRequest({
      request: request('/api/admin/records/export', 'POST', undefined, cookie), env,
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: 'drive_not_configured' });
  });
});

describe('records archive Drive mirror', () => {
  const configured = {
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_DRIVE_REFRESH_TOKEN: 'refresh-token',
  };

  function jsonResponse(status: number, body: unknown) {
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() { return body; },
      async text() { return JSON.stringify(body); },
    };
  }

  it('finds piece-records.zip by name and updates it in place as application/zip', async () => {
    const zipBytes = buildStoredZip([
      { name: 'records/index.html', bytes: new TextEncoder().encode('<p>index</p>') },
    ]);
    const calls: Array<{ url: string; method: string; contentType: string | null; body: unknown }> = [];
    const fetchImpl = (async (url: string, init?: any) => {
      calls.push({
        url,
        method: init?.method || 'GET',
        contentType: init?.headers?.['Content-Type'] || null,
        body: init?.body,
      });
      if (url.includes('oauth2.googleapis.com/token')) return jsonResponse(200, { access_token: 'at-1' });
      if (url.startsWith('https://www.googleapis.com/drive/v3/files?')) {
        assert.match(decodeURIComponent(url), /name = 'piece-records\.zip' and trashed = false/);
        return jsonResponse(200, { files: [{ id: 'zip-file' }] });
      }
      if (url.includes('/upload/drive/v3/files/zip-file')) {
        return jsonResponse(200, { id: 'zip-file', webViewLink: 'https://drive/zip' });
      }
      throw new Error(`unexpected ${url}`);
    }) as unknown as typeof fetch;

    const result = await syncRecordsArchiveToDrive(configured, zipBytes, fetchImpl);
    assert.deepEqual(result, {
      ok: true, fileId: 'zip-file', webViewLink: 'https://drive/zip', updated: true,
    });
    const upload = calls.find((call) => call.method === 'PATCH')!;
    assert.equal(upload.contentType, 'application/zip');
    assert.deepEqual(upload.body, zipBytes);
  });

  it('creates piece-records.zip with a binary multipart body when none exists', async () => {
    const zipBytes = buildStoredZip([
      { name: 'records/index.html', bytes: new TextEncoder().encode('<p>index</p>') },
    ]);
    const fetchImpl = (async (url: string, init?: any) => {
      if (url.includes('oauth2.googleapis.com/token')) return jsonResponse(200, { access_token: 'at-1' });
      if (url.startsWith('https://www.googleapis.com/drive/v3/files?')) return jsonResponse(200, { files: [] });
      if (url.includes('/upload/drive/v3/files?')) {
        assert.ok(init?.body instanceof Uint8Array);
        const body = new TextDecoder('latin1').decode(init.body);
        assert.match(body, /"name":"piece-records\.zip"/);
        assert.match(body, /"mimeType":"application\/zip"/);
        return jsonResponse(200, { id: 'zip-new', webViewLink: null });
      }
      throw new Error(`unexpected ${url}`);
    }) as unknown as typeof fetch;

    const result = await syncRecordsArchiveToDrive(configured, zipBytes, fetchImpl);
    assert.equal(result.ok, true);
    assert.equal(result.fileId, 'zip-new');
    assert.equal(result.updated, false);
  });
});

describe('records rebuild endpoint', () => {
  it('requires an admin session and the registry step-up unlock', async () => {
    const { env } = await fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/records/rebuild.js');

    const guest = await onRequest({
      request: request('/api/admin/records/rebuild', 'POST', {}), env,
    });
    assert.equal(guest.status, 401);

    signIn();
    const locked = await onRequest({
      request: request('/api/admin/records/rebuild', 'POST', {}), env,
    });
    assert.equal(locked.status, 403);
    assert.deepEqual(await locked.json(), { ok: false, error: 'registry_locked' });
  });

  it('generates records for every public piece, then reports a clean no-op rebuild', async () => {
    const { env } = await fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/records/rebuild.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const first = await onRequest({
      request: request('/api/admin/records/rebuild', 'POST', {}, cookie), env,
    });
    assert.equal(first.status, 200);
    const firstBody = await first.json();
    assert.equal(firstBody.ok, true);
    assert.equal(firstBody.total, 2);
    assert.equal(firstBody.generated, 2);
    assert.equal(firstBody.unchanged, 0);
    assert.deepEqual(
      firstBody.outcomes.map((outcome: any) => [outcome.publicCode, outcome.status]),
      [[CODE_ONE, 'generated'], [CODE_TWO, 'generated']],
    );

    const recordCount = async () => Number((await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM piece_records',
    ).bind().first())!.count);
    assert.equal(await recordCount(), 2);
    const storedObjects = env.ARTWORK_REGISTRY_BACKUP.objects.size;

    // Rebuilding unchanged content is a clean no-op: no new rows, no new files.
    const second = await onRequest({
      request: request('/api/admin/records/rebuild', 'POST', {}, cookie), env,
    });
    assert.equal(second.status, 200);
    const secondBody = await second.json();
    assert.equal(secondBody.ok, true);
    assert.equal(secondBody.generated, 0);
    assert.equal(secondBody.unchanged, 2);
    assert.equal(await recordCount(), 2);
    assert.equal(env.ARTWORK_REGISTRY_BACKUP.objects.size, storedObjects);

    // A substantive change (new catalog snapshot) regenerates just that piece.
    await ensureCatalogSnapshot(env, {
      id: 'UL-901', title: 'Earth Archive, renamed', series: 'Universal Language',
      category: 'Multidimensional Art', year: '2024', material: 'Carved wood',
      description: 'The first archived piece.',
    }, { source: 'admin', createdAt: '2026-08-19T00:00:00.000Z' });
    const third = await onRequest({
      request: request('/api/admin/records/rebuild', 'POST', { publicCode: CODE_ONE }, cookie),
      env,
    });
    assert.equal(third.status, 200);
    const thirdBody = await third.json();
    assert.equal(thirdBody.total, 1);
    assert.equal(thirdBody.generated, 1);
    assert.equal(await recordCount(), 3);
  });

  it('rejects malformed public codes and non-POST methods', async () => {
    const { env } = await fixtureEnv();
    const { onRequest } = await import('../functions/api/admin/records/rebuild.js');
    signIn();
    const cookie = await unlockedCookie(env);

    const invalid = await onRequest({
      request: request('/api/admin/records/rebuild', 'POST', { publicCode: 'AR-lower000' }, cookie),
      env,
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { ok: false, error: 'invalid_public_code' });

    const method = await onRequest({
      request: request('/api/admin/records/rebuild', 'GET', undefined, cookie), env,
    });
    assert.equal(method.status, 405);
  });
});
