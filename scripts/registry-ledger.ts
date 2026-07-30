#!/usr/bin/env tsx
/**
 * Offline operator tool for the registry MASTER ledger.
 *
 * The ledger file (registry-ledger.jsonl), downloaded from
 * /api/admin/registry-ledger, is the canonical record of the artwork registry.
 * This CLI lets Adrian work with it entirely offline — no server, no network,
 * nothing stored anywhere but the local filesystem:
 *
 *   verify <ledger.jsonl>
 *       Recompute the hash chain and confirm the file is intact and unaltered.
 *
 *   diff <held.jsonl> <fresh.jsonl>
 *       Compare the held master against a freshly exported ledger. Any output
 *       means the online mirror drifted from the master (something changed
 *       out of band). Silence means they match exactly.
 *
 *   to-sql <ledger.jsonl> [out.sql]
 *       Emit idempotent SQL that rebuilds the online keeper_pieces and
 *       artwork_lineage_events rows from the master file. This is the concrete
 *       "online is a mirror, rebuilt from the master" path. No plaintext is
 *       involved; rows are restored from the recovery-code hash and encrypted
 *       envelope, exactly as the live mint stored them.
 *
 * Usage:
 *   npx tsx scripts/registry-ledger.ts verify  ./registry-ledger.jsonl
 *   npx tsx scripts/registry-ledger.ts diff     ./held.jsonl ./fresh.jsonl
 *   npx tsx scripts/registry-ledger.ts to-sql   ./registry-ledger.jsonl ./rebuild.sql
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  buildRebuildSql,
  diffLedgerRecords,
  parseLedgerJsonl,
  verifyLedgerFile,
  type LedgerFileParseResult,
} from '../utils/registryLedger';

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function load(path: string): LedgerFileParseResult {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    fail(`Cannot read ledger file: ${path}`);
  }
  return parseLedgerJsonl(text);
}

async function cmdVerify(path: string): Promise<void> {
  const result = await verifyLedgerFile(load(path));
  if (!result.ok) {
    fail(`LEDGER TAMPERED. First break at line ${result.badIndex} (${result.reason}). ` +
      `Do not trust this file; recover from an intact copy.`);
  }
  process.stdout.write(
    `OK — ${result.count} records, chain intact.\nHead hash: ${result.headHash}\n`,
  );
}

async function cmdDiff(heldPath: string, freshPath: string): Promise<void> {
  const held = load(heldPath);
  const fresh = load(freshPath);
  const [heldCheck, freshCheck] = await Promise.all([
    verifyLedgerFile(held),
    verifyLedgerFile(fresh),
  ]);
  if (!heldCheck.ok) fail(`Held ledger is broken at line ${heldCheck.badIndex} (${heldCheck.reason}).`);
  if (!freshCheck.ok) fail(`Fresh ledger is broken at line ${freshCheck.badIndex} (${freshCheck.reason}).`);

  const diff = diffLedgerRecords(
    held.lines.map((line) => line.record),
    fresh.lines.map((line) => line.record),
  );
  if (!diff.added.length && !diff.removed.length && !diff.changed.length) {
    process.stdout.write('MATCH — the fresh export is identical to the held master.\n');
    return;
  }
  process.stdout.write('DRIFT detected between held master and fresh export:\n');
  for (const key of diff.added) process.stdout.write(`  + only in fresh: ${key}\n`);
  for (const key of diff.removed) process.stdout.write(`  - only in held:  ${key}\n`);
  for (const key of diff.changed) process.stdout.write(`  ~ changed:       ${key}\n`);
  process.stdout.write(
    '\nAdded lines on a NEWER export are normal growth (new pieces or events). ' +
      'Removed or changed lines mean the online mirror was altered out of band — investigate.\n',
  );
  process.exitCode = 2;
}

async function cmdToSql(path: string, outPath?: string): Promise<void> {
  const ledger = load(path);
  const { lines } = ledger;
  const check = await verifyLedgerFile(ledger);
  if (!check.ok) fail(`Refusing to build SQL from a broken ledger (line ${check.badIndex}, ${check.reason}).`);
  const sql = buildRebuildSql(lines.map((line) => line.record));
  if (outPath) {
    writeFileSync(outPath, sql, 'utf8');
    process.stdout.write(`Wrote rebuild SQL for ${lines.length} records to ${outPath}\n`);
  } else {
    process.stdout.write(sql);
  }
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case 'verify':
      if (!args[0]) fail('Usage: registry-ledger.ts verify <ledger.jsonl>');
      await cmdVerify(args[0]);
      break;
    case 'diff':
      if (!args[0] || !args[1]) fail('Usage: registry-ledger.ts diff <held.jsonl> <fresh.jsonl>');
      await cmdDiff(args[0], args[1]);
      break;
    case 'to-sql':
      if (!args[0]) fail('Usage: registry-ledger.ts to-sql <ledger.jsonl> [out.sql]');
      await cmdToSql(args[0], args[1]);
      break;
    default:
      fail('Commands: verify <file> | diff <held> <fresh> | to-sql <file> [out.sql]');
  }
}

void main();
