import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  REGISTRY_LEDGER_SCHEMA_VERSION,
  buildRebuildSql,
  computeLedgerLines,
  diffLedgerRecords,
  ledgerRecordKey,
  orderLedgerRecords,
  parseLedgerJsonl,
  serializeLedgerJsonl,
  verifyLedgerChain,
  type LedgerHeader,
  type LedgerRecord,
} from '../utils/registryLedger.ts';

const plate = (over: Partial<Extract<LedgerRecord, { kind: 'plate' }>> = {}): LedgerRecord => ({
  kind: 'plate',
  id: 'kp-1',
  publicCode: 'AR-7KQ9M2WX',
  pieceId: 'UL-100',
  editionNumber: 0,
  plateStatus: 'active',
  recoveryCodeHash: 'a'.repeat(64),
  frontSha256: 'b'.repeat(64),
  undersideSha256: 'c'.repeat(64),
  envelope: { ciphertext: 'Y2lwaGVy', nonce: 'bm9uY2U=', keyVersion: '1' },
  backupStatus: 'verified',
  backupReference: 'plates/AR-7KQ9M2WX.json',
  plateGeneratedAt: '2026-07-20T10:00:00.000Z',
  plateActivatedAt: '2026-07-21T10:00:00.000Z',
  registeredAt: '2026-07-20T10:00:00.000Z',
  lineageHeadHash: 'd'.repeat(64),
  lineageEventCount: 2,
  ...over,
});

const event = (over: Partial<Extract<LedgerRecord, { kind: 'event' }>> = {}): LedgerRecord => ({
  kind: 'event',
  keeperPieceId: 'kp-1',
  sequence: 1,
  eventType: 'issued',
  eventAt: '2026-07-20T10:00:00.000Z',
  previousHash: null,
  eventHash: 'e'.repeat(64),
  publicPayload: { pieceId: 'UL-100', editionNumber: 0, publicCode: 'AR-7KQ9M2WX' },
  ...over,
});

describe('registry ledger chain', () => {
  it('is deterministic — same records serialize byte for byte', async () => {
    const records = [event({ sequence: 2, eventType: 'activated', eventHash: 'f'.repeat(64) }), plate(), event()];
    const a = await computeLedgerLines(records);
    const b = await computeLedgerLines([...records].reverse());
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it('orders each plate before its events, plates by generation time', () => {
    const ordered = orderLedgerRecords([
      event({ keeperPieceId: 'kp-2', sequence: 1, eventHash: '1'.repeat(64) }),
      plate({ id: 'kp-2', publicCode: 'AR-AAAAAAAA', plateGeneratedAt: '2026-07-22T00:00:00.000Z' }),
      plate({ id: 'kp-1', plateGeneratedAt: '2026-07-20T00:00:00.000Z' }),
      event({ keeperPieceId: 'kp-1', sequence: 1 }),
    ]);
    assert.deepEqual(ordered.map(ledgerRecordKey), [
      'plate:kp-1', 'event:kp-1:1', 'plate:kp-2', 'event:kp-2:1',
    ]);
  });

  it('verifies an intact chain and reports the head hash', async () => {
    const lines = await computeLedgerLines([plate(), event()]);
    const result = await verifyLedgerChain(lines);
    assert.equal(result.ok, true);
    assert.equal(result.count, 2);
    assert.equal(result.headHash, lines[lines.length - 1].hash);
  });

  it('detects a tampered record', async () => {
    const lines = await computeLedgerLines([plate(), event()]);
    // Alter a field without recomputing the hash → chain must break here.
    (lines[0].record as Extract<LedgerRecord, { kind: 'plate' }>).recoveryCodeHash = '0'.repeat(64);
    const result = await verifyLedgerChain(lines);
    assert.equal(result.ok, false);
    assert.equal(result.badIndex, 0);
    assert.equal(result.reason, 'hash');
  });

  it('detects a dropped line', async () => {
    const lines = await computeLedgerLines([plate(), event(), event({ sequence: 2, eventHash: 'f'.repeat(64) })]);
    lines.splice(1, 1); // remove the middle line
    const result = await verifyLedgerChain(lines);
    assert.equal(result.ok, false);
    // Re-numbering breaks at the first shifted line.
    assert.ok(result.badIndex !== undefined && result.badIndex >= 1);
  });

  it('round-trips through JSONL with a header', async () => {
    const lines = await computeLedgerLines([plate(), event()]);
    const header: LedgerHeader = {
      kind: 'header',
      schemaVersion: REGISTRY_LEDGER_SCHEMA_VERSION,
      exportedAt: '2026-07-21T12:00:00.000Z',
      recordCount: lines.length,
      headHash: lines[lines.length - 1].hash,
      note: 'test',
    };
    const text = serializeLedgerJsonl(header, lines);
    const parsed = parseLedgerJsonl(text);
    assert.equal(parsed.header?.schemaVersion, REGISTRY_LEDGER_SCHEMA_VERSION);
    assert.equal(parsed.lines.length, 2);
    const reverify = await verifyLedgerChain(parsed.lines);
    assert.equal(reverify.ok, true);
    assert.equal(reverify.headHash, header.headHash);
  });
});

describe('registry ledger diff', () => {
  it('reports added, removed, and changed records', () => {
    const held: LedgerRecord[] = [plate(), event()];
    const fresh: LedgerRecord[] = [
      plate({ plateStatus: 'active', backupStatus: 'verified' }), // unchanged
      event(),
      plate({ id: 'kp-9', publicCode: 'AR-NEWNEW22', pieceId: 'UL-101' }), // added
    ];
    const diff = diffLedgerRecords(held, fresh);
    assert.deepEqual(diff.added, ['plate:kp-9']);
    assert.deepEqual(diff.removed, []);
    assert.deepEqual(diff.changed, []);
  });

  it('flags a changed record (silent online alteration)', () => {
    const held: LedgerRecord[] = [plate()];
    const fresh: LedgerRecord[] = [plate({ recoveryCodeHash: '9'.repeat(64) })];
    const diff = diffLedgerRecords(held, fresh);
    assert.deepEqual(diff.changed, ['plate:kp-1']);
  });
});

describe('registry ledger rebuild SQL', () => {
  it('rebuilds keeper_pieces and lineage rows without any plaintext', () => {
    const sql = buildRebuildSql([plate(), event()]);
    assert.match(sql, /INSERT OR IGNORE INTO keeper_pieces/);
    assert.match(sql, /INSERT OR IGNORE INTO artwork_lineage_events/);
    // The recovery-code HASH and encrypted envelope are restored, not a code.
    assert.match(sql, new RegExp("'" + 'a'.repeat(64) + "'"));
    assert.match(sql, /'Y2lwaGVy'/);
    // The lineage event id is derived from the event hash, matching live mint.
    assert.match(sql, new RegExp("'le-" + 'e'.repeat(64) + "'"));
    // Idempotent so a partial database re-applies safely.
    assert.doesNotMatch(sql, /INSERT INTO/);
  });

  it('escapes single quotes so a crafted value cannot break out', () => {
    const sql = buildRebuildSql([plate({ backupReference: "plates/a'b.json" })]);
    assert.match(sql, /'plates\/a''b\.json'/);
  });
});
