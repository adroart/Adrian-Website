import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

type SessionData = {
  session: { id: string };
  user: {
    id: string;
    email?: string | null;
    emailVerified?: boolean;
    name?: string;
  };
} | null;

let sessionData: SessionData = null;

before(() => {
  mock.module('../lib/account/auth.server.js', {
    namedExports: {
      createAuth: () => ({
        api: {
          getSession: async () => sessionData,
        },
      }),
    },
  });
});

beforeEach(() => {
  sessionData = null;
});

after(() => {
  mock.reset();
});

const env = (adminEmails?: string) => ({
  DB: {},
  ADMIN_EMAILS: adminEmails,
});

function request(method = 'GET', origin?: string) {
  const headers = new Headers({ Cookie: 'better-auth.session_token=test-session' });
  if (origin !== undefined) headers.set('Origin', origin);
  return new Request('https://adrianrasmussen.com/api/admin/verify', { method, headers });
}

function signedIn(overrides: Partial<NonNullable<SessionData>['user']> = {}) {
  sessionData = {
    session: { id: 'session-1' },
    user: {
      id: 'user-1',
      email: 'artist@example.com',
      emailVerified: true,
      name: 'Private profile name',
      ...overrides,
    },
  };
}

async function loadAuth() {
  return import('../functions/api/_lib/auth.js');
}

describe('central Better Auth identity', () => {
  it('returns a valid Better Auth session and null when the session is missing', async () => {
    const { verifyRequest } = await loadAuth();
    signedIn();
    const authenticated = await verifyRequest(request(), env());
    assert.equal(authenticated?.userId, 'user-1');
    assert.equal(authenticated?.email, 'artist@example.com');
    assert.equal(authenticated?.user.emailVerified, true);

    sessionData = null;
    assert.equal(await verifyRequest(request(), env()), null);
  });

  it('requires a session and marks private JSON responses no-store', async () => {
    const { requireUser } = await loadAuth();
    const response = await requireUser(request(), env());
    assert.ok(response instanceof Response);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'unauthorized' });
  });

  it('requires the exact request origin for unsafe signed-in user requests', async () => {
    const { requireUser } = await loadAuth();
    signedIn();
    const allowed = await requireUser(
      request('POST', 'https://adrianrasmussen.com'),
      env(),
    );
    assert.ok(!(allowed instanceof Response));

    for (const origin of [undefined, 'https://www.adrianrasmussen.com', 'https://example.com']) {
      const denied = await requireUser(request('POST', origin), env());
      assert.ok(denied instanceof Response);
      assert.equal(denied.status, 403);
      assert.equal(denied.headers.get('Cache-Control'), 'no-store');
    }
  });

  it('serves private JSON directly from the central auth helpers', async () => {
    const central = await loadAuth();
    assert.equal(central.jsonResponse({ private: true }).headers.get('Cache-Control'), 'no-store');
  });

  it('accepts only internal return paths', async () => {
    const { safeReturnPath } = await loadAuth();
    assert.equal(safeReturnPath('/admin/pieces?tab=active#latest'), '/admin/pieces?tab=active#latest');
    assert.equal(safeReturnPath('https://example.com/steal', '/admin'), '/admin');
    assert.equal(safeReturnPath('//example.com/steal', '/admin'), '/admin');
    assert.equal(safeReturnPath('admin/pieces', '/admin'), '/admin');
  });
});

describe('central admin authorization', () => {
  it('normalizes the signed-in email and comma-separated allowlist', async () => {
    const { requireAdmin } = await loadAuth();
    signedIn({ email: '  Artist@Example.COM  ' });
    const auth = await requireAdmin(request(), env(' other@example.com, ARTIST@example.com , '));
    assert.ok(!(auth instanceof Response));
    assert.equal(auth.userId, 'user-1');
    assert.equal(auth.email, 'artist@example.com');
  });

  it('returns 401 for guests and 403 for signed-in unverified or non-admin users', async () => {
    const { requireAdmin } = await loadAuth();
    const guest = await requireAdmin(request(), env('artist@example.com'));
    assert.ok(guest instanceof Response);
    assert.equal(guest.status, 401);
    assert.equal(guest.headers.get('Cache-Control'), 'no-store');

    signedIn({ emailVerified: false });
    const unverified = await requireAdmin(request(), env('artist@example.com'));
    assert.ok(unverified instanceof Response);
    assert.equal(unverified.status, 403);

    signedIn();
    const nonAdmin = await requireAdmin(request(), env('someone@example.com'));
    assert.ok(nonAdmin instanceof Response);
    assert.equal(nonAdmin.status, 403);
  });

  it('denies every user when ADMIN_EMAILS is missing or empty', async () => {
    const { requireAdmin } = await loadAuth();
    signedIn();
    for (const configured of [undefined, '', ' ,  , ']) {
      const result = await requireAdmin(request(), env(configured));
      assert.ok(result instanceof Response);
      assert.equal(result.status, 403);
    }
  });

  it('requires the exact request origin for unsafe cookie-authenticated requests', async () => {
    const { requireAdmin } = await loadAuth();
    signedIn();
    const allowed = await requireAdmin(
      request('POST', 'https://adrianrasmussen.com'),
      env('artist@example.com'),
    );
    assert.ok(!(allowed instanceof Response));

    for (const origin of [undefined, 'https://www.adrianrasmussen.com', 'https://example.com']) {
      const denied = await requireAdmin(request('POST', origin), env('artist@example.com'));
      assert.ok(denied instanceof Response);
      assert.equal(denied.status, 403);
      assert.equal(denied.headers.get('Cache-Control'), 'no-store');
    }
  });
});

describe('/api/admin/verify', () => {
  it('returns only the authorized admin id and normalized email', async () => {
    signedIn({ email: ' Artist@Example.COM ' });
    const { onRequestGet } = await import('../functions/api/admin/verify.js');
    const response = await onRequestGet({
      request: request(),
      env: env('artist@example.com'),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), {
      ok: true,
      admin: { id: 'user-1', email: 'artist@example.com' },
    });
  });

  it('preserves guest and unauthorized status codes', async () => {
    const { onRequestGet } = await import('../functions/api/admin/verify.js');
    const guest = await onRequestGet({ request: request(), env: env('artist@example.com') });
    assert.equal(guest.status, 401);

    signedIn();
    const nonAdmin = await onRequestGet({ request: request(), env: env('other@example.com') });
    assert.equal(nonAdmin.status, 403);
  });
});
