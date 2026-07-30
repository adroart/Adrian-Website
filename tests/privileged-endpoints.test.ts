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
  return { prepare: () => statement };
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

describe('private studio overview', () => {
  it('returns only actionable counts from count-only queries', async () => {
    const counts = [2, 1, 3];
    const seen: string[] = [];
    const overviewDb = {
      prepare(sql: string) {
        seen.push(sql);
        assert.match(sql, /^SELECT COUNT\(\*\) AS count/i);
        assert.doesNotMatch(sql, /email|ownership_code|public_token|amount|total_cents/i);
        const count = counts[seen.length - 1];
        return { async first() { return { count }; } };
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
      attention: { plates: 2, draftViewings: 1, openInvoices: 3 },
    });
    assert.equal(seen.length, 3);
  });

  it('omits attention data when the installed schema is older', async () => {
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
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, attention: null });
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
      [(await import('../functions/api/admin/invoices.js')).onRequest, '/api/admin/invoices'],
      [(await import('../functions/api/admin/payment-presets.js')).onRequest, '/api/admin/payment-presets'],
      [(await import('../functions/api/admin/viewings.js')).onRequest, '/api/admin/viewings'],
      [(await import('../functions/api/pricing/config.js')).onRequest, '/api/pricing/config'],
      [(await import('../functions/api/pricing/quotes.js')).onRequest, '/api/pricing/quotes'],
    ] as const;

    for (const [handler, path] of cases) {
      const response = await handler({ request: request(path, 'OPTIONS'), env: env(), params: {} });
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
