import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('central admin registry UI', () => {
  it('uses the shared sign-in modal with a safe admin destination', () => {
    const login = source('components/AdminLogin.tsx');
    assert.match(login, /SignInModal/);
    assert.match(login, /destination=["{']+\/admin/);
    assert.doesNotMatch(login, /api\/admin\/login/);
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
  });
});
