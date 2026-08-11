import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const ORIGIN = 'https://adrianrasmussen.com';

function signIn(email = 'artist@example.com') {
  sessionData = {
    session: { id: 'session-1' },
    user: { id: 'user-1', email, emailVerified: true },
  };
}

function request(
  path: string,
  method: string,
  origin?: string,
  body?: unknown,
  cookie = 'better-auth.session_token=test-session',
) {
  const headers = new Headers({ Cookie: cookie });
  if (origin !== undefined) headers.set('Origin', origin);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function database() {
  const statement = {
    bind() { return this; },
    async all() { return { results: [] }; },
    async first() { return null; },
    async run() { return { success: true }; },
  };
  return {
    prepare: () => statement,
    async batch(statements: Array<typeof statement>) {
      return Promise.all(statements.map((entry) => entry.all()));
    },
  };
}

function bucket() {
  let stored = '[]';
  return {
    async get() { return { text: async () => stored }; },
    async put(_key: string, value: string) { stored = value; },
    async list() { return { objects: [] }; },
    async delete() {},
  };
}

const env = () => ({
  DB: database(),
  MUSIC_BUCKET: bucket(),
  ADMIN_EMAILS: 'artist@example.com',
});

type EndpointCase = {
  name: string;
  path: string;
  method: string;
  unsafeMethod?: string;
  load: () => Promise<(context: any) => Promise<Response>>;
  params?: Record<string, string>;
  body?: unknown;
  allowedStatus: number;
};

const privilegedEndpoints: EndpointCase[] = [
  {
    name: 'studio overview', path: '/api/admin/overview', method: 'GET', allowedStatus: 200,
    load: async () => (await import('../functions/api/admin/overview.js')).onRequest,
  },
  {
    name: 'invoice collection', path: '/api/admin/invoices', method: 'GET', unsafeMethod: 'POST', allowedStatus: 200,
    load: async () => (await import('../functions/api/admin/invoices.js')).onRequest,
  },
  {
    name: 'invoice resource', path: '/api/admin/invoices/1', method: 'GET', unsafeMethod: 'PUT', params: { id: '1' }, allowedStatus: 404,
    load: async () => (await import('../functions/api/admin/invoices/[id].js')).onRequest,
  },
  {
    name: 'mark invoice paid', path: '/api/admin/invoices/1/mark-paid', method: 'POST', params: { id: '1' }, body: {}, allowedStatus: 404,
    load: async () => (await import('../functions/api/admin/invoices/[id]/mark-paid.js')).onRequestPost,
  },
  {
    name: 'send invoice', path: '/api/admin/invoices/1/send', method: 'POST', params: { id: '1' }, allowedStatus: 404,
    load: async () => (await import('../functions/api/admin/invoices/[id]/send.js')).onRequestPost,
  },
  {
    name: 'payment preset collection', path: '/api/admin/payment-presets', method: 'GET', unsafeMethod: 'POST', allowedStatus: 200,
    load: async () => (await import('../functions/api/admin/payment-presets.js')).onRequest,
  },
  {
    name: 'payment preset resource', path: '/api/admin/payment-presets/1', method: 'GET', unsafeMethod: 'PUT', params: { id: '1' }, allowedStatus: 404,
    load: async () => (await import('../functions/api/admin/payment-presets/[id].js')).onRequest,
  },
  {
    name: 'private viewings', path: '/api/admin/viewings', method: 'GET', unsafeMethod: 'POST', allowedStatus: 200,
    load: async () => (await import('../functions/api/admin/viewings.js')).onRequest,
  },
  {
    name: 'registry maintenance collection', path: '/api/admin/maintenance', method: 'GET', allowedStatus: 200,
    load: async () => (await import('../functions/api/admin/maintenance.js')).onRequest,
  },
  {
    name: 'registry maintenance detail', path: '/api/admin/maintenance/kp-missing', method: 'GET', params: { id: 'kp-missing' }, allowedStatus: 404,
    load: async () => (await import('../functions/api/admin/maintenance/[id].js')).onRequest,
  },
  {
    name: 'book writes', path: '/api/book', method: 'POST', body: { entry: { id: 'UL-1' } }, allowedStatus: 200,
    load: async () => (await import('../functions/api/book.js')).onRequestPost,
  },
  {
    name: 'poem writes', path: '/api/poems', method: 'POST', body: { poem: { slug: 'one', title: 'One', audioUrl: '/one.mp3', poem: [] } }, allowedStatus: 200,
    load: async () => (await import('../functions/api/poems.js')).onRequestPost,
  },
  {
    name: 'music files', path: '/api/upload-music', method: 'GET', unsafeMethod: 'POST', allowedStatus: 200,
    load: async () => (await import('../functions/api/upload-music.js')).onRequestGet,
  },
  {
    name: 'music deletion', path: '/api/delete-file?key=one.mp3', method: 'DELETE', allowedStatus: 200,
    load: async () => (await import('../functions/api/delete-file.js')).onRequestDelete,
  },
  {
    name: 'pricing config writes', path: '/api/pricing/config', method: 'PUT', body: {}, allowedStatus: 400,
    load: async () => (await import('../functions/api/pricing/config.js')).onRequest,
  },
  {
    name: 'pricing quote collection', path: '/api/pricing/quotes', method: 'GET', unsafeMethod: 'POST', allowedStatus: 200,
    load: async () => (await import('../functions/api/pricing/quotes.js')).onRequest,
  },
  {
    name: 'pricing quote resource', path: '/api/pricing/quotes/1', method: 'DELETE', params: { id: '1' }, allowedStatus: 200,
    load: async () => (await import('../functions/api/pricing/quotes/[id].js')).onRequest,
  },
];

async function invoke(endpoint: EndpointCase, origin?: string, method = endpoint.method) {
  const handler = await endpoint.load();
  return handler({
    request: request(endpoint.path, method, origin, endpoint.body),
    env: env(),
    params: endpoint.params || {},
  });
}

describe('ordinary privileged endpoint security matrix', () => {
  for (const endpoint of privilegedEndpoints) {
    it(`${endpoint.name}: guest 401, non-admin 403, allowlisted admin reaches business behavior`, async () => {
      const guest = await invoke(endpoint, ORIGIN);
      assert.equal(guest.status, 401);
      assert.equal(guest.headers.get('Cache-Control'), 'no-store');

      signIn('collector@example.com');
      const nonAdmin = await invoke(endpoint, ORIGIN);
      assert.equal(nonAdmin.status, 403);
      assert.equal(nonAdmin.headers.get('Cache-Control'), 'no-store');

      signIn();
      const allowed = await invoke(endpoint, ORIGIN);
      assert.equal(allowed.status, endpoint.allowedStatus);
      assert.equal(allowed.headers.get('Cache-Control'), 'no-store');
    });

    const unsafeMethod = endpoint.unsafeMethod
      || (!['GET', 'HEAD', 'OPTIONS'].includes(endpoint.method) ? endpoint.method : null);
    if (unsafeMethod) {
      it(`${endpoint.name}: unsafe requests require the exact request origin`, async () => {
        signIn();
        for (const origin of [undefined, 'https://www.adrianrasmussen.com', 'https://example.com']) {
          const denied = await invoke(endpoint, origin, unsafeMethod);
          assert.equal(denied.status, 403);
          assert.equal(denied.headers.get('Cache-Control'), 'no-store');
          assert.deepEqual(await denied.json(), { ok: false, error: 'origin_forbidden' });
        }
      });
    }
  }
});

describe('registry maintenance mutation security matrix', () => {
  const mutationEndpoints = [
    {
      name: 'acquisition create',
      path: '/api/admin/maintenance/kp-missing/acquisitions',
      method: 'POST',
      params: { id: 'kp-missing' },
      body: {
        idempotencyKey: 'security-create-acquisition',
        reason: 'Verify mutation authorization.',
        acquisition: { acquisitionType: 'sale' },
      },
      allowedStatus: 503,
      load: async () => (await import('../functions/api/admin/maintenance/[id]/acquisitions.js')).onRequest,
    },
    {
      name: 'acquisition correction',
      path: '/api/admin/maintenance/kp-missing/acquisitions/acq-missing',
      method: 'PUT',
      params: { id: 'kp-missing', acquisitionId: 'acq-missing' },
      body: {
        idempotencyKey: 'security-correct-acquisition',
        reason: 'Verify mutation authorization.',
        expectedVersion: 1,
        acquisition: { acquisitionType: 'sale' },
      },
      allowedStatus: 404,
      load: async () => (await import('../functions/api/admin/maintenance/[id]/acquisitions/[acquisitionId].js')).onRequest,
    },
    {
      name: 'steward transfer',
      path: '/api/admin/maintenance/kp-missing/actions',
      method: 'POST',
      params: { id: 'kp-missing' },
      body: {
        action: 'transfer_steward',
        targetEmail: 'verified@example.com',
        transferKind: 'gift',
        reason: 'Verify mutation authorization.',
        idempotencyKey: 'security-transfer-steward',
        expectedStewardVersion: 1,
      },
      allowedStatus: 404,
      load: async () => (await import('../functions/api/admin/maintenance/[id]/actions.js')).onRequest,
    },
  ] as const;

  for (const endpoint of mutationEndpoints) {
    it(`${endpoint.name}: requires admin, exact origin, and registry unlock`, async () => {
      const environment = { ...env(), REGISTRY_STEP_UP_SECRET: 'registry-step-up-secret' };
      const handler = await endpoint.load();
      const invokeMutation = (origin: string | undefined, cookie?: string) => handler({
        request: request(endpoint.path, endpoint.method, origin, endpoint.body, cookie),
        env: environment,
        params: endpoint.params,
      });

      const guest = await invokeMutation(ORIGIN);
      assert.equal(guest.status, 401);

      signIn('collector@example.com');
      const nonAdmin = await invokeMutation(ORIGIN);
      assert.equal(nonAdmin.status, 403);

      signIn();
      const wrongOrigin = await invokeMutation('https://example.com');
      assert.equal(wrongOrigin.status, 403);
      assert.deepEqual(await wrongOrigin.json(), { ok: false, error: 'origin_forbidden' });

      const locked = await invokeMutation(ORIGIN);
      assert.equal(locked.status, 403);
      assert.deepEqual(await locked.json(), { ok: false, error: 'registry_locked' });

      const { createRegistryUnlockToken } = await import('../functions/api/_lib/admin.js');
      const token = await createRegistryUnlockToken(environment, {
        userId: 'user-1',
        email: 'artist@example.com',
        session: { id: 'session-1' },
      });
      const unlocked = await invokeMutation(
        ORIGIN,
        `better-auth.session_token=test-session; registry_unlock=${token}`,
      );
      assert.equal(unlocked.status, endpoint.allowedStatus);
      assert.notEqual((await unlocked.clone().json()).error, 'registry_locked');
    });
  }
});

describe('private collector route security matrix', () => {
  const endpoints = [
    {
      name: 'collector sales collection', path: '/api/admin/collector-sales', params: {},
      body: {
        action: 'createReconnection', recipientEmail: 'collector@example.com',
        recipientName: null, privateContext: null, idempotencyKey: 'security-case',
      },
      load: async () => (await import('../functions/api/admin/collector-sales.js')).onRequest,
    },
    {
      name: 'collector sale detail', path: '/api/admin/collector-sales/sale-one',
      params: { id: 'sale-one' },
      body: { action: 'addReconnectionNote', note: 'Private note.', idempotencyKey: 'security-note' },
      load: async () => (await import('../functions/api/admin/collector-sales/[id].js')).onRequest,
    },
    {
      name: 'collector ledger', path: '/api/admin/collector-ledger', params: {},
      body: {
        action: 'append', artworkRecordId: 'record-one', saleId: null,
        message: 'Private note.', mediaId: null, idempotencyKey: 'security-ledger',
      },
      load: async () => (await import('../functions/api/admin/collector-ledger.js')).onRequest,
    },
    {
      name: 'collector ledger media', path: '/api/admin/collector-ledger/media', params: {},
      body: new Uint8Array([1, 2, 3]),
      load: async () => (await import('../functions/api/admin/collector-ledger/media.js')).onRequest,
    },
  ] as const;

  function observedRequest(
    endpoint: typeof endpoints[number], origin: string | undefined, cookie?: string,
  ) {
    let bodyReads = 0;
    const headers = new Headers();
    if (cookie) headers.set('Cookie', cookie);
    if (origin !== undefined) headers.set('Origin', origin);
    headers.set('Content-Type', endpoint.name.endsWith('media') ? 'image/png' : 'application/json');
    const base = new Request(`${ORIGIN}${endpoint.path}`, {
      method: 'POST', headers,
      body: endpoint.body instanceof Uint8Array
        ? endpoint.body : JSON.stringify(endpoint.body),
    });
    const request = new Proxy(base, {
      get(target, property) {
        if (property === 'body') bodyReads += 1;
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    return { request, bodyReads: () => bodyReads };
  }

  function guardedBindings() {
    let dbCalls = 0;
    let r2Calls = 0;
    return {
      DB: {
        prepare() { dbCalls += 1; throw new Error('business DB must not run'); },
      },
      ARTWORK_REGISTRY_BACKUP: new Proxy({}, {
        get() { r2Calls += 1; throw new Error('R2 must not run'); },
      }),
      counts: () => ({ dbCalls, r2Calls }),
    };
  }

  async function assertDenied(
    response: Response, expectedStatus: number, expectedError: string,
    observed: ReturnType<typeof observedRequest>,
    bindings: ReturnType<typeof guardedBindings>,
  ) {
    assert.equal(response.status, expectedStatus);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { ok: false, error: expectedError });
    assert.equal(observed.bodyReads(), 0);
    assert.deepEqual(bindings.counts(), { dbCalls: 0, r2Calls: 0 });
  }

  for (const endpoint of endpoints) {
    it(`${endpoint.name}: rejects before body, business DB, or R2 access`, async () => {
      const handler = await endpoint.load();
      const invokeDenied = async (
        origin: string | undefined,
        environment: Record<string, unknown>,
        cookie?: string,
      ) => {
        const observed = observedRequest(endpoint, origin, cookie);
        return {
          observed,
          response: await (handler as any)({
            request: observed.request, env: environment, params: endpoint.params,
          }),
        };
      };
      const baseEnvironment = {
        ADMIN_EMAILS: 'artist@example.com',
        REGISTRY_STEP_UP_SECRET: 'collector-security-secret',
      };

      let bindings = guardedBindings();
      let attempt = await invokeDenied(ORIGIN, { ...baseEnvironment, ...bindings });
      await assertDenied(attempt.response, 401, 'unauthorized', attempt.observed, bindings);

      signIn('collector@example.com');
      bindings = guardedBindings();
      attempt = await invokeDenied(ORIGIN, { ...baseEnvironment, ...bindings });
      await assertDenied(attempt.response, 403, 'forbidden', attempt.observed, bindings);

      signIn();
      for (const origin of [undefined, 'https://example.com']) {
        bindings = guardedBindings();
        attempt = await invokeDenied(origin, { ...baseEnvironment, ...bindings });
        await assertDenied(attempt.response, 403, 'origin_forbidden', attempt.observed, bindings);
      }

      bindings = guardedBindings();
      attempt = await invokeDenied(ORIGIN, { ...baseEnvironment, ...bindings });
      await assertDenied(attempt.response, 403, 'registry_locked', attempt.observed, bindings);

      const { createRegistryUnlockToken } = await import('../functions/api/_lib/admin.js');
      const tokenIdentity = {
        userId: 'user-1', email: 'artist@example.com', session: { id: 'session-1' },
      };
      const expired = await createRegistryUnlockToken(baseEnvironment, tokenIdentity, -1);
      bindings = guardedBindings();
      attempt = await invokeDenied(
        ORIGIN, { ...baseEnvironment, ...bindings },
        `better-auth.session_token=test-session; registry_unlock=${expired}`,
      );
      await assertDenied(attempt.response, 403, 'registry_locked', attempt.observed, bindings);

      const active = await createRegistryUnlockToken(baseEnvironment, tokenIdentity);
      const activeCookie = `better-auth.session_token=test-session; registry_unlock=${active}`;
      const noDbObserved = observedRequest(endpoint, ORIGIN, activeCookie);
      const noDbResponse = await (handler as any)({
        request: noDbObserved.request, env: baseEnvironment, params: endpoint.params,
      });
      assert.equal(noDbResponse.status, 401);
      assert.equal(noDbResponse.headers.get('Cache-Control'), 'no-store');
      assert.deepEqual(await noDbResponse.json(), { ok: false, error: 'unauthorized' });
      assert.equal(noDbObserved.bodyReads(), 0);

      if (endpoint.name.endsWith('media')) {
        bindings = guardedBindings();
        const { ARTWORK_REGISTRY_BACKUP: _backup, ...withoutR2 } = bindings;
        attempt = await invokeDenied(
          ORIGIN, { ...baseEnvironment, ...withoutR2 }, activeCookie,
        );
        await assertDenied(
          attempt.response, 503, 'backup_not_configured', attempt.observed,
          bindings,
        );
      }
    });
  }

  it('does not require Origin for authenticated GET requests', async () => {
    signIn();
    const baseEnvironment = {
      ADMIN_EMAILS: 'artist@example.com', DB: guardedBindings().DB,
      REGISTRY_STEP_UP_SECRET: 'collector-security-secret',
    };
    const { createRegistryUnlockToken } = await import('../functions/api/_lib/admin.js');
    const token = await createRegistryUnlockToken(baseEnvironment, {
      userId: 'user-1', email: 'artist@example.com', session: { id: 'session-1' },
    });
    const cookie = `better-auth.session_token=test-session; registry_unlock=${token}`;
    const getCases = [
      [(await import('../functions/api/admin/collector-sales.js')).onRequest,
        '/api/admin/collector-sales?unexpected=1', {}],
      [(await import('../functions/api/admin/collector-sales/[id].js')).onRequest,
        '/api/admin/collector-sales/bad.id', { id: 'bad.id' }],
      [(await import('../functions/api/admin/collector-ledger.js')).onRequest,
        '/api/admin/collector-ledger', {}],
    ] as const;
    for (const origin of [undefined, 'https://example.com']) {
      for (const [handler, path, params] of getCases) {
        const headers = new Headers({ Cookie: cookie });
        if (origin !== undefined) headers.set('Origin', origin);
        const response = await handler({
          request: new Request(`${ORIGIN}${path}`, { headers }),
          env: baseEnvironment, params,
        });
        assert.equal(response.status, 400, `${origin || 'missing origin'} ${path}`);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.deepEqual(await response.json(), { ok: false, error: 'invalid_request' });
      }
    }
  });
});

describe('private registry recovery export security', () => {
  it('requires the administrator step-up and returns only a private encrypted attachment', async () => {
    const environment = {
      ...env(),
      REGISTRY_STEP_UP_SECRET: 'registry-step-up-secret',
      REGISTRY_RECOVERY_EXPORT_KEY: Buffer.alloc(32, 91).toString('base64'),
      REGISTRY_RECOVERY_EXPORT_KEY_ID: 'registry-recovery-key-v1',
    };
    const { onRequest } = await import('../functions/api/admin/registry-recovery-export.js');
    const invokeExport = (cookie?: string) => onRequest({
      request: request('/api/admin/registry-recovery-export', 'GET', ORIGIN, undefined, cookie),
      env: environment,
    });

    assert.equal((await invokeExport()).status, 401);
    signIn();
    const locked = await invokeExport();
    assert.equal(locked.status, 403);
    assert.deepEqual(await locked.json(), { ok: false, error: 'registry_locked' });

    const { createRegistryUnlockToken } = await import('../functions/api/_lib/admin.js');
    const token = await createRegistryUnlockToken(environment, {
      userId: 'user-1', email: 'artist@example.com', session: { id: 'session-1' },
    });
    const response = await invokeExport(
      `better-auth.session_token=test-session; registry_unlock=${token}`,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(
      response.headers.get('Content-Type'),
      'application/vnd.adrian.registry-recovery+json; charset=utf-8',
    );
    assert.match(
      response.headers.get('Content-Disposition') || '',
      /^attachment; filename="registry-private-recovery-[0-9TZ.-]+\.json"$/,
    );
    const archive = await response.json() as any;
    assert.equal(archive.kind, 'registry-private-recovery-encrypted');
    assert.equal(typeof archive.ciphertext, 'string');
  });

  it('fails closed when the separate archive encryption key is not configured', async () => {
    const environment = { ...env(), REGISTRY_STEP_UP_SECRET: 'registry-step-up-secret' };
    signIn();
    const { createRegistryUnlockToken } = await import('../functions/api/_lib/admin.js');
    const token = await createRegistryUnlockToken(environment, {
      userId: 'user-1', email: 'artist@example.com', session: { id: 'session-1' },
    });
    const { onRequest } = await import('../functions/api/admin/registry-recovery-export.js');
    const response = await onRequest({
      request: request(
        '/api/admin/registry-recovery-export', 'GET', ORIGIN, undefined,
        `better-auth.session_token=test-session; registry_unlock=${token}`,
      ),
      env: environment,
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), {
      ok: false, error: 'registry_recovery_export_not_configured',
    });
  });
});

describe('private studio overview', () => {
  it('returns the complete allowlisted item-level work queue', async () => {
    const seen: string[] = [];
    const overviewDb = {
      prepare(sql: string) {
        seen.push(sql);
        return {
          bind() { return this; },
          async all() { return { results: [] }; },
          async first() { return null; },
        };
      },
    };

    signIn();
    const { onRequest } = await import('../functions/api/admin/overview.js');
    const response = await onRequest({
      request: request('/api/admin/overview', 'GET', ORIGIN),
      env: { ...env(), DB: overviewDb },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      queue: { complete: true, items: [] },
      recentArtworks: [],
      recentCollectors: [],
    });
    assert.ok(seen.length >= 8);
  });

  it('fails closed when the installed schema cannot complete every queue source', async () => {
    const olderDb = {
      prepare() {
        return { async first() { throw new Error('no such table: keeper_pieces'); } };
      },
    };
    signIn();
    const { onRequest } = await import('../functions/api/admin/overview.js');
    const response = await onRequest({
      request: request('/api/admin/overview', 'GET', ORIGIN),
      env: { ...env(), DB: olderDb },
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, error: 'overview_incomplete' });
  });
});

describe('exact admin invoice and viewing selectors', () => {
  it('loads one older invoice by exact ID and rejects mixed selector queries', async () => {
    const seen: Array<{ sql: string; bindings: unknown[] }> = [];
    const row = {
      id: 999, invoice_number: 'INV-999', public_token: 'invoice-token-999', status: 'draft',
      client_name: 'Older invoice', client_email: '', client_location: '', job_title: 'Older work',
      job_description: 'Description', currency: 'USD', line_items_json: '[]',
      payment_schedule_json: '[]', current_step_index: 0, subtotal_cents: 0,
      shipping_text: '', total_cents: 0, due_today_cents: 0, payment_preset_id: null,
      payment_preset_ids_json: '[]', payment_snapshot_json: '{}', payment_options_json: '[]',
      notes: '', offer_payment_choice: 0, amount_paid_cents: 0,
      created_at: 1, updated_at: 1, sent_at: null, paid_at: null,
    };
    const exactDb = {
      prepare(sql: string) {
        const record = { sql, bindings: [] as unknown[] };
        seen.push(record);
        return {
          bind(...values: unknown[]) { record.bindings = values; return this; },
          async all() { return { results: [row] }; },
        };
      },
    };
    signIn();
    const { onRequest } = await import('../functions/api/admin/invoices.js');
    const response = await onRequest({
      request: request('/api/admin/invoices?invoiceId=999', 'GET', ORIGIN),
      env: { ...env(), DB: exactDb },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).invoices[0].id, 999);
    assert.match(seen[0].sql, /WHERE id = \?1/);
    assert.deepEqual(seen[0].bindings, [999]);

    const invalid = await onRequest({
      request: request('/api/admin/invoices?invoiceId=999&limit=1', 'GET', ORIGIN),
      env: { ...env(), DB: exactDb },
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { ok: false, error: 'invalid_query' });
  });

  it('loads one older viewing by exact ID and rejects mixed selector queries', async () => {
    const seen: Array<{ sql: string; bindings: unknown[] }> = [];
    const row = {
      id: 999, public_token: 'viewing-token-999', status: 'draft',
      recipient_name: 'Older viewing', client_email: '', intention: '', chart_json: '{}',
      data_json: '{}', invoice_token: null, created_at: 1, updated_at: 1,
      sent_at: null, requested_at: null,
    };
    const exactDb = {
      prepare(sql: string) {
        const record = { sql, bindings: [] as unknown[] };
        seen.push(record);
        return {
          bind(...values: unknown[]) { record.bindings = values; return this; },
          async all() { return { results: [row] }; },
        };
      },
    };
    signIn();
    const { onRequest } = await import('../functions/api/admin/viewings.js');
    const response = await onRequest({
      request: request('/api/admin/viewings?viewingId=999', 'GET', ORIGIN),
      env: { ...env(), DB: exactDb },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).viewings[0].id, 999);
    assert.match(seen[0].sql, /WHERE id = \?1/);
    assert.deepEqual(seen[0].bindings, [999]);

    const invalid = await onRequest({
      request: request('/api/admin/viewings?viewingId=999&offset=0', 'GET', ORIGIN),
      env: { ...env(), DB: exactDb },
    });
    assert.equal(invalid.status, 400);
    assert.deepEqual(await invalid.json(), { ok: false, error: 'invalid_query' });
  });
});

describe('mixed public and private endpoints', () => {
  it('preserves public GET for book, poems, and pricing config', async () => {
    const environment = env();
    const cases = [
      [(await import('../functions/api/book.js')).onRequestGet, '/api/book'],
      [(await import('../functions/api/poems.js')).onRequestGet, '/api/poems'],
      [(await import('../functions/api/pricing/config.js')).onRequest, '/api/pricing/config'],
    ] as const;

    for (const [handler, path] of cases) {
      const response = await (handler as any)({
        request: request(path, 'GET'), env: environment, params: {},
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
  });

  it('returns private no-store JSON for unsupported methods', async () => {
    signIn();
    const cases = [
      [(await import('../functions/api/admin/overview.js')).onRequest, '/api/admin/overview'],
      [(await import('../functions/api/admin/invoices.js')).onRequest, '/api/admin/invoices'],
      [(await import('../functions/api/admin/payment-presets.js')).onRequest, '/api/admin/payment-presets'],
      [(await import('../functions/api/admin/viewings.js')).onRequest, '/api/admin/viewings'],
      [(await import('../functions/api/pricing/config.js')).onRequest, '/api/pricing/config'],
      [(await import('../functions/api/pricing/quotes.js')).onRequest, '/api/pricing/quotes'],
    ] as const;

    for (const [handler, path] of cases) {
      const response = await (handler as any)({
        request: request(path, 'OPTIONS'), env: env(), params: {},
      });
      assert.equal(response.status, 405);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.deepEqual(await response.json(), { ok: false, error: 'method_not_allowed' });
    }
  });
});

describe('legacy password administration retirement', () => {
  it('does not accept UPLOAD_SECRET or mint admin_session cookies', async () => {
    const { onRequestPost } = await import('../functions/api/admin/login.js');
    const response = await onRequestPost({
      request: request('/api/admin/login', 'POST', ORIGIN, { password: 'legacy-secret' }),
      env: { ...env(), UPLOAD_SECRET: 'legacy-secret' },
    });
    assert.equal(response.status, 410);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(response.headers.has('Set-Cookie'), false);
    assert.deepEqual(await response.json(), { ok: false, error: 'password_admin_retired' });
  });

  it('leaves no ordinary endpoint protected only by the legacy admin cookie', () => {
    const files = [
      'functions/api/admin/invoices.js',
      'functions/api/admin/invoices/[id].js',
      'functions/api/admin/invoices/[id]/mark-paid.js',
      'functions/api/admin/invoices/[id]/send.js',
      'functions/api/admin/payment-presets.js',
      'functions/api/admin/payment-presets/[id].js',
      'functions/api/admin/viewings.js',
      'functions/api/admin/maintenance.js',
      'functions/api/admin/maintenance/[id].js',
      'functions/api/admin/maintenance/[id]/actions.js',
      'functions/api/admin/maintenance/[id]/acquisitions.js',
      'functions/api/admin/maintenance/[id]/acquisitions/[acquisitionId].js',
      'functions/api/book.js',
      'functions/api/poems.js',
      'functions/api/upload-music.js',
      'functions/api/delete-file.js',
      'functions/api/pricing/config.js',
      'functions/api/pricing/quotes.js',
      'functions/api/pricing/quotes/[id].js',
    ];

    for (const file of files) {
      const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
      assert.match(source, /requireAdmin|requireRegistryUnlock/);
      assert.doesNotMatch(source, /isAdminAuthed|admin_session/);
    }
  });
});
