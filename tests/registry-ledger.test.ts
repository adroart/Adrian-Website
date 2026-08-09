import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  REGISTRY_LEDGER_SCHEMA_VERSION,
  computeLedgerLines,
  diffLedgerRecords,
  ledgerRecordKey,
  orderLedgerRecords,
  parseLedgerJsonl,
  serializeLedgerJsonl,
  verifyLedgerChain,
  verifyLedgerFile,
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

const headerFor = (lines: Awaited<ReturnType<typeof computeLedgerLines>>): LedgerHeader => ({
  kind: 'header',
  schemaVersion: REGISTRY_LEDGER_SCHEMA_VERSION,
  exportedAt: '2026-07-21T12:00:00.000Z',
  recordCount: lines.length,
  headHash: lines.at(-1)?.hash ?? null,
  note: 'test',
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

describe('complete registry ledger file verification', () => {
  it('accepts one valid header followed by the complete valid chain', async () => {
    const lines = await computeLedgerLines([plate(), event()]);
    const result = await verifyLedgerFile({ header: headerFor(lines), lines });
    assert.deepEqual(result, {
      ok: true,
      count: 2,
      headHash: lines.at(-1)?.hash ?? null,
    });
  });

  it('continues to verify schema v1 headers with only v1 plate and event records', async () => {
    const lines = await computeLedgerLines([plate(), event()]);
    const result = await verifyLedgerFile({
      header: { ...headerFor(lines), schemaVersion: 1 } as LedgerHeader,
      lines,
    });
    assert.deepEqual(result, {
      ok: true,
      count: 2,
      headHash: lines.at(-1)?.hash ?? null,
    });
  });

  it('rejects a missing header', async () => {
    const lines = await computeLedgerLines([plate()]);
    const parsed = parseLedgerJsonl(lines.map((line) => JSON.stringify(line)).join('\n'));
    const result = await verifyLedgerFile(parsed);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing_header');
  });

  it('rejects duplicate headers instead of silently filtering them', async () => {
    const lines = await computeLedgerLines([plate()]);
    const header = headerFor(lines);
    const parsed = parseLedgerJsonl([
      JSON.stringify(header),
      JSON.stringify(header),
      JSON.stringify(lines[0]),
    ].join('\n'));
    const result = await verifyLedgerFile(parsed);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'duplicate_header');
  });

  it('rejects a header that appears after a record', async () => {
    const lines = await computeLedgerLines([plate()]);
    const parsed = parseLedgerJsonl([
      JSON.stringify(lines[0]),
      JSON.stringify(headerFor(lines)),
    ].join('\n'));
    const result = await verifyLedgerFile(parsed);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'late_header');
  });

  it('rejects an unsupported header schema', async () => {
    const lines = await computeLedgerLines([plate()]);
    const header = { ...headerFor(lines), schemaVersion: 999 } as unknown as LedgerHeader;
    const result = await verifyLedgerFile({ header, lines });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'schema');
  });

  it('reports malformed JSON without accepting the remaining rows', async () => {
    const lines = await computeLedgerLines([plate()]);
    const parsed = parseLedgerJsonl([
      JSON.stringify(headerFor(lines)),
      '{"n":0',
    ].join('\n'));
    const result = await verifyLedgerFile(parsed);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'json');
  });

  it('rejects a false header record count', async () => {
    const lines = await computeLedgerLines([plate(), event()]);
    const result = await verifyLedgerFile({
      header: { ...headerFor(lines), recordCount: lines.length + 1 },
      lines,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'record_count');
  });

  it('rejects a false header head hash', async () => {
    const lines = await computeLedgerLines([plate(), event()]);
    const result = await verifyLedgerFile({
      header: { ...headerFor(lines), headHash: '0'.repeat(64) },
      lines,
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'head_hash');
  });

  it('rejects clean last-line truncation even though the surviving chain is valid', async () => {
    const completeLines = await computeLedgerLines([plate(), event()]);
    const parsed = parseLedgerJsonl(serializeLedgerJsonl(headerFor(completeLines), completeLines).split('\n').slice(0, -2).join('\n'));
    assert.equal((await verifyLedgerChain(parsed.lines)).ok, true);
    const result = await verifyLedgerFile(parsed);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'record_count');
  });

  it('rejects an extra valid line when the header is stale', async () => {
    const originalLines = await computeLedgerLines([plate(), event()]);
    const extendedLines = await computeLedgerLines([
      plate(),
      event(),
      event({ sequence: 2, eventType: 'activated', eventHash: 'f'.repeat(64) }),
    ]);
    const result = await verifyLedgerFile({ header: headerFor(originalLines), lines: extendedLines });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'record_count');
  });

  it('rejects a line containing an unknown record shape before trusting its hash', async () => {
    const unknownLines = await computeLedgerLines([plate()]);
    unknownLines[0].record = { kind: 'mystery', id: 'unknown' } as unknown as LedgerRecord;
    const result = await verifyLedgerFile({ header: headerFor(unknownLines), lines: unknownLines });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'record_shape');
    assert.equal(result.badIndex, 0);
  });

  it('makes verify and diff refuse an incomplete file, with public-ledger SQL restore retired', async () => {
    const lines = await computeLedgerLines([plate(), event()]);
    const valid = serializeLedgerJsonl(headerFor(lines), lines);
    const truncated = valid.split('\n').slice(0, -2).join('\n');
    const directory = mkdtempSync(join(tmpdir(), 'registry-ledger-'));
    const validPath = join(directory, 'valid.jsonl');
    const truncatedPath = join(directory, 'truncated.jsonl');
    writeFileSync(validPath, valid);
    writeFileSync(truncatedPath, truncated);
    try {
      const commands = [
        ['verify', truncatedPath],
        ['diff', validPath, truncatedPath],
      ];
      for (const args of commands) {
        const result = spawnSync('npx', ['tsx', 'scripts/registry-ledger.ts', ...args], {
          cwd: process.cwd(),
          encoding: 'utf8',
        });
        assert.notEqual(result.status, 0, `${args[0]} unexpectedly accepted an incomplete ledger`);
        assert.match(result.stderr, /record_count/);
      }
      const retired = spawnSync('npx', [
        'tsx', 'scripts/registry-ledger.ts', 'to-sql', validPath,
      ], { cwd: process.cwd(), encoding: 'utf8' });
      assert.notEqual(retired.status, 0);
      assert.match(retired.stderr, /restore-sql <private-recovery>/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('registry ledger recovery boundary', () => {
  it('does not retain a permissive partial-database SQL generator', () => {
    const source = readFileSync(
      new URL('../utils/registryLedger.ts', import.meta.url), 'utf8',
    );
    assert.doesNotMatch(source, /buildRebuildSql|INSERT\s+OR\s+IGNORE/i);
  });
});
