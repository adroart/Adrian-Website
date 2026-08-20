#!/usr/bin/env tsx
/**
 * Offline custody envelope tool (docs/registry-custodian-guide.md).
 *
 * Wraps the registry's internal key material into one small encrypted file a
 * successor can open with ONE passphrase. Entirely offline: no network, no
 * database, nothing leaves the local filesystem, and key material is never
 * printed. Safety conventions follow scripts/registry-ledger.ts restore-sql:
 * strict inputs, mode-0600 outputs, refuse-overwrite, fail closed.
 *
 *   create <envelope-out.json> [--keys-file <keys.json>]
 *       Build a new envelope. Keys come from environment variables
 *       (REGISTRY_RECOVERY_EXPORT_KEY, REGISTRY_RECOVERY_EXPORT_KEY_ID, and
 *       any OWNERSHIP_CODE_KEY_V<n>) or from one permission-restricted
 *       (mode 0600) JSON keys file with the exact shape
 *       { registryRecoveryExportKeyB64, registryRecoveryExportKeyId,
 *         ownershipCodeKeys?, notes? }. The passphrase is read from stdin
 *       without echo where possible, asked twice on a terminal. The envelope
 *       is written mode 0600 and never overwrites an existing file.
 *
 *   open --check <envelope.json>
 *       Verify a passphrase opens the envelope. Prints only the key IDs and
 *       versions present, never any key value.
 *
 *   open --recovery-key-file <key-out> <envelope.json>
 *       Additionally write the two-line recovery key file (key id, then
 *       base64 key) that `npm run ledger -- restore-sql` reads, mode 0600,
 *       refusing overwrite. Nothing secret is printed.
 *
 * Usage:
 *   npx tsx scripts/custody-envelope.ts create ./custody-envelope.json
 *   npx tsx scripts/custody-envelope.ts create ./custody-envelope.json --keys-file ./keys.json
 *   npx tsx scripts/custody-envelope.ts open --check ./custody-envelope.json
 *   npx tsx scripts/custody-envelope.ts open --recovery-key-file ./registry-recovery.key ./custody-envelope.json
 */
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import {
  buildCustodyEnvelope,
  openCustodyEnvelope,
  validateCustodyKeys,
  type CustodyKeys,
} from '../utils/custodyEnvelope';

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

/* ── Passphrase input, without echo where possible ──────────────────── */

function readPassphrase(promptText: string): Promise<string> {
  return new Promise((resolvePassphrase, rejectPassphrase) => {
    const stdin = process.stdin;
    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
      // Piped input: read the first line. No echo happens because nothing is
      // a terminal. Confirmation prompts are skipped on this path.
      let data = '';
      stdin.setEncoding('utf8');
      const onData = (chunk: string) => {
        data += chunk;
        const newline = data.search(/\r|\n/);
        if (newline !== -1) {
          stdin.off('data', onData);
          stdin.pause();
          resolvePassphrase(data.slice(0, newline));
        }
      };
      stdin.on('data', onData);
      stdin.once('end', () => resolvePassphrase(data.split(/\r?\n/)[0] ?? ''));
      stdin.once('error', rejectPassphrase);
      return;
    }
    process.stderr.write(promptText);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const finish = (result: string | null) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      process.stderr.write('\n');
      if (result === null) fail('Cancelled.');
      resolvePassphrase(result);
    };
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === '\u0003' || character === '\u0004') return finish(null); // Ctrl-C / Ctrl-D
        if (character === '\r' || character === '\n') return finish(value);
        if (character === '\u007f' || character === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += character;
      }
    };
    stdin.on('data', onData);
  });
}

/* ── Key gathering for `create` ─────────────────────────────────────── */

function loadKeysFile(path: string): CustodyKeys {
  let info;
  try {
    info = lstatSync(path);
  } catch {
    fail(`Cannot read keys file: ${path}`);
  }
  if (!info.isFile() || info.isSymbolicLink()) {
    fail('Keys file must be one real local file, not a symlink.');
  }
  if ((info.mode & 0o077) !== 0) {
    fail('Keys file must be permission-restricted (chmod 600) before use.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    fail('Refusing unreadable or malformed keys file.');
  }
  try {
    validateCustodyKeys(parsed);
  } catch (error) {
    fail(`Refusing invalid keys file (${String((error as Error)?.message || error)}).`);
  }
  return parsed;
}

function loadKeysFromEnvironment(): CustodyKeys {
  const keyB64 = process.env.REGISTRY_RECOVERY_EXPORT_KEY;
  const keyId = process.env.REGISTRY_RECOVERY_EXPORT_KEY_ID;
  if (!keyB64 || !keyId) {
    fail('Set REGISTRY_RECOVERY_EXPORT_KEY and REGISTRY_RECOVERY_EXPORT_KEY_ID, '
      + 'or pass --keys-file <keys.json>.');
  }
  const ownershipCodeKeys: { version: number; keyB64: string }[] = [];
  for (const [name, value] of Object.entries(process.env)) {
    const match = /^OWNERSHIP_CODE_KEY_V(\d+)$/.exec(name);
    if (match && value) {
      ownershipCodeKeys.push({ version: Number(match[1]), keyB64: value });
    }
  }
  ownershipCodeKeys.sort((left, right) => left.version - right.version);
  const keys: CustodyKeys = {
    registryRecoveryExportKeyB64: keyB64,
    registryRecoveryExportKeyId: keyId,
    ownershipCodeKeys,
  };
  try {
    validateCustodyKeys(keys);
  } catch (error) {
    fail(`Refusing invalid environment keys (${String((error as Error)?.message || error)}).`);
  }
  return keys;
}

function describeContents(keys: CustodyKeys): string {
  const versions = (keys.ownershipCodeKeys ?? []).map((entry) => entry.version);
  const ownership = versions.length
    ? `Ownership Code key versions: ${versions.join(', ')}.`
    : 'No Ownership Code keys included.';
  return `Recovery export key id: ${keys.registryRecoveryExportKeyId}. ${ownership}`;
}

/* ── Commands ───────────────────────────────────────────────────────── */

async function cmdCreate(outPath: string, keysFilePath: string | undefined): Promise<void> {
  const keys = keysFilePath ? loadKeysFile(keysFilePath) : loadKeysFromEnvironment();
  const passphrase = await readPassphrase('Passphrase (not shown): ');
  if (process.stdin.isTTY) {
    const confirmation = await readPassphrase('Repeat the passphrase: ');
    if (confirmation !== passphrase) fail('Passphrases do not match. Nothing was written.');
  }
  let envelope;
  try {
    envelope = await buildCustodyEnvelope({ passphrase, keys });
  } catch (error) {
    fail(`Refusing to build the envelope (${String((error as Error)?.message || error)}).`);
  }
  try {
    writeFileSync(outPath, `${JSON.stringify(envelope, null, 2)}\n`, {
      encoding: 'utf8', flag: 'wx', mode: 0o600,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') {
      fail(`Refusing to overwrite existing envelope: ${outPath}`);
    }
    fail(`Cannot create envelope file: ${outPath}`);
  }
  process.stdout.write(
    `Wrote custody envelope to ${outPath} (mode 0600).\n`
    + `${describeContents(keys)}\n`
    + 'Store the envelope with the archive files. Store the passphrase, on paper, '
    + 'somewhere else entirely.\n',
  );
}

function loadEnvelopeJson(path: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    fail(`Cannot read envelope file: ${path}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    fail('Refusing malformed envelope JSON.');
  }
}

async function cmdOpen(envelopePath: string, recoveryKeyOutPath: string | undefined): Promise<void> {
  const envelope = loadEnvelopeJson(envelopePath);
  const passphrase = await readPassphrase('Passphrase (not shown): ');
  let keys: CustodyKeys;
  try {
    keys = await openCustodyEnvelope({ passphrase, envelope });
  } catch {
    fail('Cannot open the envelope with that passphrase and file. Nothing more is known.');
  }
  process.stdout.write(`Envelope opens. ${describeContents(keys)}\n`);
  if (!recoveryKeyOutPath) return;
  try {
    writeFileSync(
      recoveryKeyOutPath,
      `${keys.registryRecoveryExportKeyId}\n${keys.registryRecoveryExportKeyB64}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EEXIST') {
      fail(`Refusing to overwrite existing key file: ${recoveryKeyOutPath}`);
    }
    fail(`Cannot create recovery key file: ${recoveryKeyOutPath}`);
  }
  process.stdout.write(
    `Wrote the two-line recovery key file to ${recoveryKeyOutPath} (mode 0600).\n`
    + 'It is decrypted key material: use it for the restore, then delete it.\n',
  );
}

/* ── Argument parsing ───────────────────────────────────────────────── */

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case 'create': {
      const keysFlagIndex = args.indexOf('--keys-file');
      const keysFilePath = keysFlagIndex === -1 ? undefined : args[keysFlagIndex + 1];
      const positional = args.filter((argument, index) =>
        !argument.startsWith('--') && (keysFlagIndex === -1 || index !== keysFlagIndex + 1));
      const unknown = args.filter((argument) =>
        argument.startsWith('--') && argument !== '--keys-file');
      if (positional.length !== 1 || unknown.length
        || (keysFlagIndex !== -1 && (!keysFilePath || keysFilePath.startsWith('--')))) {
        fail('Usage: custody-envelope.ts create <envelope-out.json> [--keys-file <keys.json>]');
      }
      await cmdCreate(positional[0], keysFilePath);
      break;
    }
    case 'open': {
      const check = args.includes('--check');
      const keyFlagIndex = args.indexOf('--recovery-key-file');
      const recoveryKeyOutPath = keyFlagIndex === -1 ? undefined : args[keyFlagIndex + 1];
      const consumed = new Set<string>(['--check']);
      if (keyFlagIndex !== -1) {
        if (!recoveryKeyOutPath || recoveryKeyOutPath.startsWith('--')) {
          fail('Usage: custody-envelope.ts open --recovery-key-file <key-out> <envelope.json>');
        }
        consumed.add('--recovery-key-file');
      }
      const positional = args.filter((argument, index) =>
        !argument.startsWith('--') && (keyFlagIndex === -1 || index !== keyFlagIndex + 1));
      const unknown = args.filter((argument) =>
        argument.startsWith('--') && !consumed.has(argument));
      if (positional.length !== 1 || unknown.length || (!check && keyFlagIndex === -1)) {
        fail('Usage: custody-envelope.ts open --check <envelope.json> | '
          + 'open --recovery-key-file <key-out> <envelope.json>');
      }
      await cmdOpen(positional[0], recoveryKeyOutPath);
      break;
    }
    default:
      fail(
        'Commands: create <envelope-out.json> [--keys-file <keys.json>] | '
        + 'open --check <envelope.json> | '
        + 'open --recovery-key-file <key-out> <envelope.json>',
      );
  }
}

void main();
