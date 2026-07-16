import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';

const calls: string[] = [];

before(() => {
  mock.module('better-auth/react', {
    namedExports: {
      createAuthClient: () => ({
        emailOtp: {},
        signIn: {},
        signUp: {},
        signOut: async () => {
          calls.push('better-auth');
          return { data: null, error: null };
        },
      }),
    },
  });
  mock.module('better-auth/client/plugins', {
    namedExports: { emailOTPClient: () => ({ id: 'email-otp' }) },
  });
});

after(() => {
  mock.reset();
});

describe('central account sign-out', () => {
  it('clears an administrator registry unlock before ending the Better Auth session', async (context) => {
    calls.length = 0;
    context.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      calls.push(`fetch:${String(input)}:${init?.method}`);
      return new Response(null, { status: 204 });
    });

    const { signOut } = await import('../lib/account/authClient.ts');
    await signOut();

    assert.deepEqual(calls, [
      'fetch:/api/admin/registry-unlock:DELETE',
      'better-auth',
    ]);
  });

  it('still ends an ordinary account session when registry cleanup is unauthorized', async (context) => {
    const { signOut } = await import('../lib/account/authClient.ts');

    for (const status of [401, 403]) {
      calls.length = 0;
      context.mock.method(globalThis, 'fetch', async () => new Response(null, { status }));
      await signOut();
      assert.deepEqual(calls, ['better-auth']);
      context.mock.restoreAll();
    }
  });

  it('still ends an account session when registry cleanup cannot be reached', async (context) => {
    calls.length = 0;
    context.mock.method(globalThis, 'fetch', async () => {
      throw new Error('network unavailable');
    });

    const { signOut } = await import('../lib/account/authClient.ts');
    await signOut();

    assert.deepEqual(calls, ['better-auth']);
  });

  it('bounds registry cleanup so a stalled request cannot block account sign-out', async (context) => {
    calls.length = 0;
    context.mock.method(globalThis, 'fetch', (_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response(null, { status: 204 })), 300);
      init?.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('aborted', 'AbortError'));
      });
    }));

    const { signOut } = await import('../lib/account/authClient.ts');
    const startedAt = Date.now();
    await signOut();

    assert.ok(Date.now() - startedAt < 250, 'sign-out waited for the stalled cleanup request');
    assert.deepEqual(calls, ['better-auth']);
  });
});
