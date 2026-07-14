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

function request(path: string, method: string, origin?: string, body?: unknown) {
  const headers = new Headers({ Cookie: 'better-auth.session_token=test-session' });
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
      assert.match(source, /requireAdmin/);
      assert.doesNotMatch(source, /isAdminAuthed|admin_session/);
    }
  });
});
