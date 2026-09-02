/**
 * What a caller is allowed to be told when something throws.
 *
 * Six endpoints used a thrown Error's message as the error code, which is how
 * the libraries beneath them return codes. Everything else came through the
 * same door: measured on 2026-09-02, a refused dream answered
 * `D1_ERROR: public dream requires established adult: SQLITE_CONSTRAINT`,
 * which no client could classify and no person could act on.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { clientErrorCode } from '../functions/api/_lib/clientError.js';

describe('the code a caller is given', () => {
  it('passes a real code through untouched', () => {
    for (const code of [
      'piece_not_held', 'outside_birthday_window', 'invalid_inputs',
      'user_not_synced', 'db_not_configured', 'shine_is_permanent',
    ]) {
      assert.equal(clientErrorCode(new Error(code), 'fallback'), code);
    }
  });

  it('never hands back a driver error', () => {
    assert.equal(
      clientErrorCode(new Error('D1_ERROR: something went wrong: SQLITE_CONSTRAINT'), 'fallback'),
      'fallback',
    );
    assert.equal(
      clientErrorCode(new Error('SQLITE_CONSTRAINT_TRIGGER'), 'fallback'),
      'fallback',
    );
  });

  it('never hands back a database rule written as prose', () => {
    // one of the migrations' own trigger words, with no mapping of its own
    assert.equal(
      clientErrorCode(new Error('D1_ERROR: artwork lineage is append-only: SQLITE_CONSTRAINT'), 'fallback'),
      'fallback',
    );
    assert.equal(clientErrorCode(new Error('lineage anchor mismatch'), 'fallback'), 'fallback');
  });

  it('answers a trigger with the code the request-time check already uses', () => {
    assert.equal(
      clientErrorCode(
        new Error('D1_ERROR: public dream requires established adult: SQLITE_CONSTRAINT'),
        'collector_dream_failed',
      ),
      'adult_status_required',
    );
    assert.equal(
      clientErrorCode(new Error('D1_ERROR: attributed dream requires name consent'), 'x'),
      'name_consent_required',
    );
    assert.equal(
      clientErrorCode(new Error('D1_ERROR: piece privacy requires the current keeper'), 'x'),
      'piece_not_held',
    );
  });

  it('falls back on anything that is not a thrown Error', () => {
    assert.equal(clientErrorCode(undefined, 'fallback'), 'fallback');
    assert.equal(clientErrorCode(null, 'fallback'), 'fallback');
    assert.equal(clientErrorCode({}, 'fallback'), 'fallback');
    assert.equal(clientErrorCode(new Error(''), 'fallback'), 'fallback');
  });
});

describe('no endpoint returns a raw thrown message any more', () => {
  it('has no caller left passing error.message straight out', () => {
    const offenders: string[] = [];
    const walk = (dir: URL) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
        if (entry.isDirectory()) { walk(child); continue; }
        if (!entry.name.endsWith('.js')) continue;
        const source = readFileSync(child, 'utf8');
        if (/error instanceof Error \? error\.message/.test(source)) {
          offenders.push(child.pathname);
        }
      }
    };
    walk(new URL('../functions/api/', import.meta.url));
    assert.deepEqual(offenders, []);
  });
});
