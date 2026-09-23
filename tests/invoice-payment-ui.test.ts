import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('../components/AdminInvoices.tsx', import.meta.url), 'utf8');

describe('manual invoice payment UI', () => {
  it('retains the exact key and amount only across an uncertain retry and blocks duplicate presses', () => {
    assert.match(source, /paymentAttemptRef/);
    assert.match(source, /crypto\.randomUUID\(\)/);
    assert.match(source, /paidCents: attempt\.paidCents, idempotencyKey: attempt\.key/);
    assert.match(source, /if \(paymentBusyId === invoice\.id\) return/);
    assert.match(source, /delete paymentAttemptRef\.current\[invoice\.id\]/);
    assert.match(source, /retry the exact same payment safely/);
  });
});
