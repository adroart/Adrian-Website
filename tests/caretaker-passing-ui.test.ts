import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const api = readFileSync(new URL('../components/collector/api.ts', import.meta.url), 'utf8');
const wired = readFileSync(new URL('../components/collector/wired.tsx', import.meta.url), 'utf8');
const endpoint = readFileSync(new URL('../functions/api/keeper/passing.js', import.meta.url), 'utf8');

describe('wired caretaker passing', () => {
  it('reads the exact email back, creates only after the second press, and exposes cancel and recipient accept', () => {
    assert.match(wired, /from === 'passconfirm' && key === 'passdone'/);
    assert.match(wired, /confirmedRecipientEmail: recipientEmail/);
    assert.match(wired, /__cancelPassing/);
    assert.match(wired, /__acceptPassing/);
    assert.match(wired, /\.get\('passing'\)/);
    assert.match(wired, /setPassingKind\('gift'\)/);
    assert.match(wired, /setPassingKind\('sale'\)/);
    assert.match(wired, /passingAttempt\.current = null/);
    assert.match(wired, /kind: 'passing-result'/);
    assert.match(wired, /state: failCode\(outcome\) === 'passing_expired' \? 'expired' : 'error'/);
    assert.doesNotMatch(wired, /notyet unwired/);
    assert.match(api, /credentials: 'same-origin'/);
    assert.match(api, /inspectCaretakerPassing/);
    assert.match(api, /acceptCaretakerPassing/);
    assert.match(endpoint, /catch \{\s*return json\(\{ ok: false, error: 'invalid_json' \}, 400\)/);
  });
});
