import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('central admin registry UI', () => {
  it('uses the shared sign-in modal with a safe admin destination', async () => {
    const login = source('components/AdminLogin.tsx');
    assert.match(login, /SignInModal/);
    assert.match(login, /useLocation/);
    assert.doesNotMatch(login, /api\/admin\/login/);

    const { safeAdminDestination } = await import('../components/AdminLogin.tsx');
    assert.equal(safeAdminDestination('/admin'), '/admin');
    assert.equal(safeAdminDestination('/admin/pieces'), '/admin/pieces');
    for (const hostile of [undefined, null, '/', '/administrator', '/admin/../account', '/admin/%2e%2e/account', '//evil.example/admin', 'https://evil.example/admin', '/admin\\evil', '/admin\u0000/evil']) {
      assert.equal(safeAdminDestination(hostile), '/admin');
    }
  });

  it('verifies the allowlisted identity and signs out through Better Auth', () => {
    const layout = source('components/AdminLayout.tsx');
    assert.match(layout, /\/api\/admin\/verify/);
    assert.match(layout, /response\.status === 401/);
    assert.match(layout, /response\.status === 403/);
    assert.match(layout, /admin\.email/);
    assert.match(layout, /registry-unlock/);
    assert.match(layout, /signOut/);
    assert.doesNotMatch(layout, /api\/admin\/logout/);
  });

  it('submits the registry secret only to unlock and never forwards it to registry operations', () => {
    const pieces = source('components/AdminPieces.tsx');
    assert.match(pieces, /\/api\/admin\/registry-unlock/);
    assert.match(pieces, /JSON\.stringify\(\{ secret:/);
    assert.doesNotMatch(pieces, /sensitive\.stepUpSecret|setStepUpSecret/);
    assert.doesNotMatch(pieces, /adminSecret/);
    assert.doesNotMatch(pieces, /localStorage|sessionStorage/);
    assert.match(pieces, /message === 'registry_locked'/);
    assert.match(pieces, /setRegistryUnlocked\(false\)/);
    assert.match(pieces, /method: 'DELETE'/);
    assert.match(pieces, /Lock registry/);
    const lockAction = pieces.slice(pieces.indexOf('const lockRegistry'), pieces.indexOf('const issuePlate'));
    assert.ok(lockAction.indexOf('setRegistryUnlocked(false)') < lockAction.indexOf("await fetch('/api/admin/registry-unlock'"));
  });

  it('keeps local Vite admin mocks aligned with central auth and registry unlock', () => {
    const vite = source('vite.config.ts');
    assert.doesNotMatch(vite, /\/api\/admin\/login|\/api\/admin\/logout|admin_session/);
    assert.match(vite, /\/api\/admin\/verify/);
    assert.match(vite, /admin:\s*\{\s*id:/);
    assert.match(vite, /status === 'guest'.*401/s);
    assert.match(vite, /status === 'forbidden'.*403/s);
    assert.match(vite, /\/api\/admin\/registry-unlock/);
    assert.match(vite, /req\.method === 'GET'/);
    assert.match(vite, /req\.method === 'POST'/);
    assert.match(vite, /req\.method === 'DELETE'/);
  });

  it('removes the legacy password and admin-session helper surface', () => {
    const admin = source('functions/api/_lib/admin.js');
    assert.doesNotMatch(admin, /admin_session|createAdminSessionToken|verifyAdminPassword|isAdminAuthed|requireAdminPostStepUp|adminSecret/);
    assert.match(admin, /registryStepUpSecret/);
    assert.match(admin, /env\?\.UPLOAD_SECRET/);
  });
});
