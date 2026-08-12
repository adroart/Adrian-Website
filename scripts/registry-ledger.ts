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
 *       [--media-dir <read-only-r2-copy> --media-manifest <json>]
 *       Authenticate and decrypt the complete private recovery artifact, then
 *       emit conflict-failing SQL for a NEW, fully migrated recovery database.
 *       The tool never selects or connects to a database.
 *
 * Usage:
 *   npx tsx scripts/registry-ledger.ts verify  ./registry-ledger.jsonl
 *   npx tsx scripts/registry-ledger.ts diff     ./held.jsonl ./fresh.jsonl
 *   npx tsx scripts/registry-ledger.ts restore-sql ./registry-private-recovery.json ./registry-recovery.key ./restore.sql
 *   npx tsx scripts/registry-ledger.ts restore-sql ./registry-private-recovery.json ./registry-recovery.key ./restore.sql --media-dir ./r2-copy --media-manifest ./r2-copy.json
 */
import {
  createReadStream, lstatSync, readFileSync, realpathSync, statSync, writeFileSync,
} from 'node:fs';
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import {
  diffLedgerRecords,
  parseLedgerJsonl,
  verifyLedgerFile,
  type LedgerFileParseResult,
} from '../utils/registryLedger';
import {
  buildVerifiedRegistryRestoreSql,
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

type RestoreMediaOptions = { mediaDir?: string; mediaManifest?: string };

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function parseRestoreMediaOptions(args: string[]): RestoreMediaOptions {
  const options: RestoreMediaOptions = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!value || !['--media-dir', '--media-manifest'].includes(flag)) {
      fail('Media restore options must be exact --media-dir and --media-manifest pairs.');
    }
    const key = flag === '--media-dir' ? 'mediaDir' : 'mediaManifest';
    if (options[key]) fail(`Duplicate restore option: ${flag}`);
    options[key] = value;
  }
  if (Boolean(options.mediaDir) !== Boolean(options.mediaManifest)) {
    fail('Media restore requires both --media-dir and --media-manifest.');
  }
  return options;
}

function safeRelativeMediaPath(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0')
    || isAbsolute(value) || normalize(value) !== value) return false;
  return value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');
}

function loadMediaBucket(mediaDir: string, manifestPath: string) {
  let manifest: unknown;
  try {
    const manifestInfo = lstatSync(manifestPath);
    if (!manifestInfo.isFile() || manifestInfo.isSymbolicLink()) {
      fail('Media manifest must be one real local file, not a symlink.');
    }
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    fail('Refusing unreadable or malformed media manifest.');
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)
    || !exactKeys(manifest as Record<string, unknown>, ['version', 'objects'])
    || (manifest as Record<string, unknown>).version !== 1
    || !Array.isArray((manifest as Record<string, unknown>).objects)) {
    fail('Refusing malformed media manifest.');
  }
  const root = resolve(mediaDir);
  let realRoot: string;
  try {
    const rootInfo = lstatSync(root);
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
      fail('Media directory must be one real local directory, not a symlink.');
    }
    realRoot = realpathSync(root);
  } catch {
    fail('Cannot read media directory.');
  }
  const objects = new Map<string, { path: string; contentType: string; size: number }>();
  for (const raw of (manifest as { objects: unknown[] }).objects) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)
      || !exactKeys(raw as Record<string, unknown>, ['reference', 'file', 'contentType'])) {
      fail('Refusing malformed media manifest object.');
    }
    const { reference, file, contentType } = raw as Record<string, unknown>;
    if (typeof reference !== 'string' || !reference || reference !== reference.trim()
      || reference.length > 1000 || objects.has(reference)
      || !safeRelativeMediaPath(file)
      || !['image/jpeg', 'image/png', 'image/webp'].includes(String(contentType))) {
      fail('Refusing invalid or duplicate media manifest object.');
    }
    const path = resolve(root, file);
    const fromRoot = relative(root, path);
    if (!fromRoot || fromRoot.startsWith(`..${sep}`) || fromRoot === '..' || isAbsolute(fromRoot)) {
      fail('Refusing media path outside the media directory.');
    }
    let cursor = root;
    let size: number;
    try {
      for (const segment of file.split('/')) {
        cursor = join(cursor, segment);
        if (lstatSync(cursor).isSymbolicLink()) fail('Refusing symlinked media path.');
      }
      const fileInfo = statSync(path);
      const realPath = realpathSync(path);
      const realFromRoot = relative(realRoot, realPath);
      if (!fileInfo.isFile() || realFromRoot.startsWith(`..${sep}`)
        || realFromRoot === '..' || isAbsolute(realFromRoot)) {
        fail('Media manifest must reference real local files.');
      }
      size = fileInfo.size;
    } catch {
      fail('Cannot read one media manifest file.');
    }
    objects.set(reference, { path, contentType: String(contentType), size });
  }
  return {
    references: [...objects.keys()],
    async get(reference: string) {
      const object = objects.get(reference);
      if (!object) return null;
      return {
        size: object.size,
        httpMetadata: { contentType: object.contentType },
        body: Readable.toWeb(createReadStream(object.path)),
      };
    },
  };
}

async function cmdRestoreSql(
  archivePath: string,
  keyPath: string,
  outPath: string,
  mediaOptions: RestoreMediaOptions,
): Promise<void> {
  let payload;
  try {
    payload = await decryptPrivateRecoveryExport(loadJson(archivePath), loadRecoveryKey(keyPath));
  } catch (error) {
    fail(`Refusing invalid private recovery archive (${String((error as Error)?.message || error)}).`);
  }
  let sql: string;
  try {
    const mediaSource = mediaOptions.mediaDir && mediaOptions.mediaManifest
      ? loadMediaBucket(mediaOptions.mediaDir, mediaOptions.mediaManifest)
      : undefined;
    if (mediaSource) {
      const expectedReferences = payload.tables.artist_artwork_media
        .map((row) => String(row.storage_reference)).sort();
      const manifestReferences = [...mediaSource.references].sort();
      if (expectedReferences.length !== manifestReferences.length
        || expectedReferences.some((reference, index) =>
          reference !== manifestReferences[index])) {
        fail('Media manifest does not exactly match the recovery archive.');
      }
    }
    sql = await buildVerifiedRegistryRestoreSql(payload, { mediaBucket: mediaSource });
  } catch (error) {
    fail(`Refusing incomplete private recovery media (${String((error as Error)?.message || error)}).`);
  }
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
        fail('Usage: registry-ledger.ts restore-sql <private-recovery.json> <key-file> <new-out.sql> [--media-dir <root> --media-manifest <json>]');
      }
      await cmdRestoreSql(args[0], args[1], args[2], parseRestoreMediaOptions(args.slice(3)));
      break;
    default:
      fail(
        'Commands: verify <ledger> | diff <held-ledger> <fresh-ledger> | ' +
        'restore-sql <private-recovery> <key-file> <new-out.sql> ' +
        '[--media-dir <root> --media-manifest <json>]',
      );
  }
}

void main();
