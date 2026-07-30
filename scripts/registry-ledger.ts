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
 *   restore-sql <private-recovery.json> <key-file> <new-out.sql>
 *       Authenticate and decrypt the complete private recovery artifact, then
 *       emit conflict-failing SQL for a NEW, fully migrated recovery database.
 *       The tool never selects or connects to a database.
 *
 * Usage:
 *   npx tsx scripts/registry-ledger.ts verify  ./registry-ledger.jsonl
 *   npx tsx scripts/registry-ledger.ts diff     ./held.jsonl ./fresh.jsonl
 *   npx tsx scripts/registry-ledger.ts restore-sql ./registry-private-recovery.json ./registry-recovery.key ./restore.sql
 */
import { readFileSync, writeFileSync } from 'node:fs';
import {
  diffLedgerRecords,
  parseLedgerJsonl,
  verifyLedgerFile,
  type LedgerFileParseResult,
} from '../utils/registryLedger';
import {
  buildRegistryRestoreSql,
  decryptPrivateRecoveryExport,
} from '../utils/registryRecoveryArchive';

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

function loadJson(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    fail(`Cannot read private recovery file: ${path}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    fail('Refusing malformed private recovery JSON.');
  }
}

function loadRecoveryKey(path: string): { keyId: string; key: string } {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    fail(`Cannot read recovery key file: ${path}`);
  }
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length !== 2) {
    fail('Recovery key file must contain exactly two non-empty lines: key id, then base64 key.');
  }
  return { keyId: lines[0], key: lines[1] };
}

async function cmdRestoreSql(
  archivePath: string,
  keyPath: string,
  outPath: string,
): Promise<void> {
  let payload;
  try {
    payload = await decryptPrivateRecoveryExport(loadJson(archivePath), loadRecoveryKey(keyPath));
  } catch (error) {
    fail(`Refusing invalid private recovery archive (${String((error as Error)?.message || error)}).`);
  }
  const sql = buildRegistryRestoreSql(payload);
  try {
    writeFileSync(outPath, sql, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    process.stdout.write(
      `Wrote clean-only restore SQL to ${outPath}.\n` +
      'Apply it only to a new, fully migrated recovery database. The SQL refuses any non-empty registry target.\n',
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') {
      fail(`Refusing to overwrite existing restore output: ${outPath}`);
    }
    fail(`Cannot create private restore output: ${outPath}`);
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
    case 'restore-sql':
      if (!args[0] || !args[1] || !args[2]) {
        fail('Usage: registry-ledger.ts restore-sql <private-recovery.json> <key-file> <new-out.sql>');
      }
      await cmdRestoreSql(args[0], args[1], args[2]);
      break;
    default:
      fail(
        'Commands: verify <ledger> | diff <held-ledger> <fresh-ledger> | ' +
        'restore-sql <private-recovery> <key-file> <new-out.sql>',
      );
  }
}

void main();
