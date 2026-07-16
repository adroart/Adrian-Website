import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { createAuth } from '../lib/account/auth.server.js';
import { safeAuthDestination } from '../lib/account/authClient.ts';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('secure Better Auth configuration', () => {
  it('enables Google only with both credentials and exposes only that fact publicly', async () => {
    const endpointPath = new URL('../functions/api/auth/config.js', import.meta.url);
    assert.equal(existsSync(endpointPath), true, 'public auth config endpoint is missing');
    const { onRequest } = await import(endpointPath.href);

    for (const [env, google] of [
      [{}, false],
      [{ GOOGLE_CLIENT_ID: 'id' }, false],
      [{ GOOGLE_CLIENT_SECRET: 'secret' }, false],
      [{ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' }, true],
    ] as const) {
      const response = await onRequest({ request: new Request('https://example.com/api/auth/config'), env });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.deepEqual(await response.json(), { google });
    }
  });

  it('hashes OTPs, revokes sessions on reset, and links only verified local email to Google', () => {
    const auth = source('lib/account/auth.server.js');
    assert.match(auth, /storeOTP:\s*['"]hashed['"]/);
    assert.match(auth, /revokeSessionsOnPasswordReset:\s*true/);
    assert.match(auth, /trustedProviders:\s*\[['"]google['"]\]/);
    assert.match(auth, /requireLocalEmailVerified:\s*true/);
    assert.doesNotMatch(auth, /trustedProviders:\s*\[[^\]]*(?:credential|email-password)/);

    const configured = createAuth({
      BETTER_AUTH_SECRET: 'Correct-Horse-Battery-Staple-Auth-Secret-2026!',
      BETTER_AUTH_URL: 'https://adrianrasmussen.com',
    });
    assert.equal(configured.options.emailAndPassword.revokeSessionsOnPasswordReset, true);
    assert.deepEqual(configured.options.account.accountLinking.trustedProviders, ['google']);
    assert.equal(configured.options.account.accountLinking.requireLocalEmailVerified, true);
    assert.equal(configured.options.plugins[0].options.storeOTP, 'hashed');
  });

  it('fails closed without Resend and never prints a one-time code', async () => {
    const auth = source('lib/account/auth.server.js');
    assert.doesNotMatch(auth, /console\.(?:log|info|warn|error)/);
    assert.match(auth, /RESEND_API_KEY[\s\S]{0,180}throw new Error/);
    assert.match(auth, /forget-password/);

    const production = createAuth({
      BETTER_AUTH_SECRET: 'Correct-Horse-Battery-Staple-Auth-Secret-2026!',
      BETTER_AUTH_URL: 'https://adrianrasmussen.com',
    });
    await assert.rejects(
      production.options.plugins[0].options.sendVerificationOTP({
        email: 'collector@example.com', otp: '123456', type: 'forget-password',
      }),
      /not configured/,
    );

    const local = createAuth({
      BETTER_AUTH_SECRET: 'Correct-Horse-Battery-Staple-Auth-Secret-2026!',
      BETTER_AUTH_URL: 'http://localhost:5555',
    });
    await assert.rejects(
      local.options.plugins[0].options.sendVerificationOTP({
        email: 'collector@example.com', otp: '123456', type: 'sign-in',
      }),
      /not configured/,
    );
  });
});

describe('account client and sign-in UI', () => {
  it('validates same-site destinations for every sign-in method', () => {
    const client = source('lib/account/authClient.ts');
    assert.doesNotMatch(client, /sign-in \(no passwords\)/);
    assert.match(client, /password/i);
    assert.match(client, /export function safeAuthDestination/);
    assert.match(client, /callbackURL:\s*safeAuthDestination\(destination\)/);
    assert.match(client, /requestPasswordReset\(\{\s*email\s*\}\)/);
    assert.match(client, /resetPassword\(\{\s*email,\s*otp,\s*password\s*\}\)/);
    assert.equal(safeAuthDestination('/admin/pieces?tab=new#form'), '/admin/pieces?tab=new#form');
    assert.equal(safeAuthDestination('https://example.com/steal'), '/');
    assert.equal(safeAuthDestination('//example.com/steal'), '/');
    assert.equal(safeAuthDestination('/\\example.com/steal'), '/');
    assert.equal(safeAuthDestination('/account\nHeader: injected'), '/');
  });

  it('closes before navigating away from the modal', async () => {
    const modal = await import('../components/account/SignInModal.tsx');
    assert.equal(typeof modal.closeAndNavigate, 'function');
    const calls: string[] = [];

    modal.closeAndNavigate(
      () => calls.push('close'),
      (destination: string) => calls.push(`navigate:${destination}`),
      '/account/reset-password',
    );

    assert.deepEqual(calls, ['close', 'navigate:/account/reset-password']);
  });

  it('closes on Escape and wraps keyboard focus inside the dialog', async () => {
    const modal = await import('../components/account/SignInModal.tsx');
    assert.equal(typeof modal.handleDialogKeyDown, 'function');
    const calls: string[] = [];
    const first = { focus: () => calls.push('first') };
    const middle = { focus: () => calls.push('middle') };
    const last = { focus: () => calls.push('last') };
    const dialog = {
      querySelectorAll: () => [first, middle, last],
    };
    const event = (key: string, shiftKey = false) => ({
      key,
      shiftKey,
      preventDefault: () => calls.push('prevent'),
    });

    modal.handleDialogKeyDown(event('Escape'), dialog, () => calls.push('close'), middle);
    assert.deepEqual(calls, ['prevent', 'close']);

    calls.length = 0;
    modal.handleDialogKeyDown(event('Tab'), dialog, () => calls.push('close'), last);
    assert.deepEqual(calls, ['prevent', 'first']);

    calls.length = 0;
    modal.handleDialogKeyDown(event('Tab', true), dialog, () => calls.push('close'), first);
    assert.deepEqual(calls, ['prevent', 'last']);

    calls.length = 0;
    modal.handleDialogKeyDown(event('Tab'), dialog, () => calls.push('close'), middle);
    assert.deepEqual(calls, []);
  });

  it('restores focus to the trigger when the modal closes', async () => {
    const modal = await import('../components/account/SignInModal.tsx');
    assert.equal(typeof modal.restoreDialogFocus, 'function');
    let restored = false;
    modal.restoreDialogFocus({ focus: () => { restored = true; } });
    assert.equal(restored, true);
  });

  it('shows configured Google first and handles returned and thrown auth errors', () => {
    const modal = source('components/account/SignInModal.tsx');
    assert.match(modal, /fetch\(['"]\/api\/auth\/config['"]/);
    assert.match(modal, /cache:\s*['"]no-store['"]/);
    assert.match(modal, /googleConfigured\s*&&/);
    assert.ok(modal.indexOf('Continue with Google') < modal.indexOf('Email'));
    assert.match(modal, /try\s*\{/);
    assert.match(modal, /result\.error/);
    assert.match(modal, /catch/);
    assert.match(modal, /Forgot password\?/);
    assert.match(modal, /works even if you forgot your password/i);
  });

  it('provides an accessible OTP password reset route', () => {
    const reset = source('components/account/ResetPassword.tsx');
    assert.match(reset, /requestPasswordReset/);
    assert.match(reset, /resetPasswordWithCode/);
    assert.match(reset, /aria-live/);
    assert.doesNotMatch(reset, /\u2014/);

    const app = source('App.tsx');
    assert.match(app, /path=['"]\/account\/reset-password['"]/);
    assert.match(app, /<ResetPassword\s*\/>/);
  });
});
