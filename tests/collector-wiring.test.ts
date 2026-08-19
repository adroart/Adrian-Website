import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  PENDING_BIND_KEY,
  PENDING_BIND_TTL_MS,
  clearPendingBind,
  createPendingBindApi,
  mirrorPendingBind,
  normalizeTypedCode,
  takePendingBind,
  type BindStorage,
} from '../components/collector/pendingBind';

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

/** The discipline assertions are about code, not prose: drop comments first. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** The new-generation collector sources (the legacy subfolder is another era). */
const collectorSources = () =>
  readdirSync(new URL('../components/collector', import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => [`components/collector/${entry.name}`, readSource(`components/collector/${entry.name}`)] as const);

/* ------------------------------------------------------------------ *
 * Source-reading assertions (house pattern from public-registry-ui)
 * ------------------------------------------------------------------ */

describe('pendingBind storage discipline', () => {
  it('never touches localStorage, cookies, or any URL anywhere in the collector surface', () => {
    for (const [name, source] of collectorSources()) {
      const code = stripComments(source);
      assert.doesNotMatch(code, /localStorage/, name);
      assert.doesNotMatch(code, /document\.cookie/, name);
    }
  });

  it('confines sessionStorage to pendingBind.ts alone', () => {
    for (const [name, source] of collectorSources()) {
      if (name.endsWith('pendingBind.ts')) continue;
      assert.doesNotMatch(stripComments(source), /sessionStorage/, name);
    }
    const bridge = readSource('components/collector/pendingBind.ts');
    assert.match(bridge, /window\.sessionStorage/);
  });

  it('writes the mirror key in exactly one place, the bridge writer', () => {
    const bridge = readSource('components/collector/pendingBind.ts');
    const writes = bridge.match(/\.setItem\(/g) ?? [];
    assert.equal(writes.length, 1);
    assert.match(bridge, /export function mirrorPendingBind[\s\S]*?setItem\(PENDING_BIND_KEY/);
    // the read deletes the key in the same motion, before any validation
    assert.match(bridge, /export function takePendingBind[\s\S]*?clearPendingBind\(storage\);\s*\n\s*if \(!raw\) return null;/);
  });

  it('mirrors only at the account bridge and settles on every terminal outcome', () => {
    const wired = readSource('components/collector/wired.tsx');
    // the bridge writes: opening the auth machinery, and the verification round trip
    const bridges = wired.match(/pending\.bridge\(\)/g) ?? [];
    assert.equal(bridges.length, 2);
    assert.match(wired, /const openAccountBridge[\s\S]{0,200}pending\.bridge\(\);\s*\n\s*setAuthOpen\(true\)/);
    assert.match(wired, /case 'needs_verified_email':[\s\S]{0,400}pending\.bridge\(\)/);
    // terminal outcomes settle: bound, mismatch, contested 202, 4xx/5xx, abandonment
    assert.match(wired, /case 'bound':\s*\n\s*pending\.settle\(\)/);
    assert.match(wired, /case 'mismatch':\s*\n\s*pending\.settle\(\)/);
    assert.match(wired, /case 'pending':\s*\n\s*pending\.settle\(\)/);
    assert.match(wired, /case 'not_ready':\s*\n\s*pending\.settle\(\)/);
    assert.match(wired, /case 'not_registered':\s*\n\s*case 'rate_limited':\s*\n\s*case 'conflict':\s*\n\s*case 'error':\s*\n\s*default:\s*\n\s*pending\.settle\(\)/);
    assert.match(wired, /const abandonAccountBridge[\s\S]{0,200}pending\.settle\(\)/);
    // needs_verified_email is NOT terminal: no settle inside its case
    const verifiedCase = wired.slice(
      wired.indexOf("case 'needs_verified_email':"),
      wired.indexOf("case 'not_registered':"),
    );
    assert.doesNotMatch(verifiedCase, /pending\.settle\(\)/);
  });
});

describe('the code never travels', () => {
  it('CodePage never places the code in a URL, a fetch, or history', () => {
    const source = readSource('components/collector/CodePage.tsx');
    assert.doesNotMatch(source, /URLSearchParams/);
    assert.doesNotMatch(source, /window\.location/);
    assert.doesNotMatch(source, /history\./);
    assert.doesNotMatch(source, /\bfetch\(/);
    assert.doesNotMatch(source, /console\./);
  });

  it('wired.tsx sends the typed code only into the bind body, never a URL or log', () => {
    const source = readSource('components/collector/wired.tsx');
    assert.doesNotMatch(source, /console\./);
    assert.match(source, /bindKeeper\(\{\s*\n\s*publicCode: code\.publicCode,\s*\n\s*ownershipCode: code\.normalizedCode,/);
    // the normalized code appears in no template string (URLs are built with templates)
    assert.doesNotMatch(source, /\$\{[^}]*normalizedCode[^}]*\}/);
  });

  it('the code input is walled off from password managers and keyboard capture', () => {
    // autoComplete="off" alone is documented to be ignored by 1Password /
    // LastPass / Bitwarden; the sensitive Ownership Code must not be captured
    // and cloud-synced by an ambient password manager (a leak beyond the app).
    const source = readSource('components/collector/CodePage.tsx');
    for (const attribute of [
      'autoComplete="off"',
      'autoCorrect="off"',
      'autoCapitalize="off"',
      'data-lpignore="true"',
      'data-1p-ignore="true"',
      'data-bwignore="true"',
    ]) {
      assert.ok(source.includes(attribute), `code input missing ${attribute}`);
    }
    // and the input must never carry a name/id a manager keys its vault on
    assert.doesNotMatch(source, /<input[\s\S]*?\sname=/);
    assert.doesNotMatch(source, /<input[\s\S]*?\stype="password"/);
  });
});

describe('the vault is gated on a bound outcome', () => {
  it('fires only on a vault outcome or the demo true code, never on completion', () => {
    const source = readSource('components/collector/CodePage.tsx');
    const vaultFires = source.match(/setVault\(true\)/g) ?? [];
    assert.equal(vaultFires.length, 2);
    assert.match(source, /outcome\.kind === 'vault'\) \{\s*\n\s*setVault\(true\)/);
    assert.match(source, /value === PIECE\.code\) \{\s*\n\s*setVault\(true\)/);
    // the completion effect only schedules the answer; it never opens the vault
    assert.match(source, /if \(filled !== 16 \|\| wrong \|\| vault\) return;\s*\n\s*const t = window\.setTimeout\(\(\) => answer\(code\), PAUSE_MS\);/);
  });

  it('maps every bind outcome kind to a screen', () => {
    const source = readSource('components/collector/wired.tsx');
    for (const kind of [
      'bound', 'mismatch', 'pending', 'not_ready', 'needs_verified_email',
      'not_registered', 'rate_limited', 'conflict', 'error',
    ]) {
      assert.match(source, new RegExp(`case '${kind}':`), kind);
    }
    // and to the settled destinations
    assert.match(source, /case 'pending':[\s\S]{0,200}key: 'receiving'/);
    assert.match(source, /case 'not_ready':[\s\S]{0,200}key: 'plate'/);
    assert.match(source, /case 'needs_verified_email':[\s\S]{0,400}key: 'account'/);
    assert.match(source, /case 'bound':[\s\S]{0,120}kind: 'vault'/);
    assert.match(source, /case 'mismatch':[\s\S]{0,120}kind: 'wrong'/);
  });
});

describe('WorksPage gating', () => {
  it('reaches the collector body only when livingLegacy is on and keeps the legacy path intact', () => {
    const source = readSource('components/WorksPage.tsx');
    // the new branch is flag-gated and identity-verified
    assert.match(source, /if \(legacyOn && publicCode && verifiedIdentity\) \{[\s\S]{0,400}CollectorPieceArrival/);
    // flag off: the existing paths stay, byte-for-byte reachable
    assert.match(source, /<ArrivalGate artwork=\{artwork\} identity=\{verifiedIdentity\} headingLevel=\{1\}>/);
    assert.match(source, /return <>\{publicIdentityRecord\}\{record\}<\/>/);
    assert.match(source, /<KeeperPanel publicIdentity=\{identity\}/);
    // the collector arrival loads lazily so the flag-off bundle is unchanged
    assert.match(source, /const CollectorPieceArrival = lazy\(\(\) => import\('\.\/collector\/wired'\)\)/);
  });
});

describe('demo mode stays the review vehicle', () => {
  it('keeps the sixteen-ones demo check reachable only without a wired submit', () => {
    const source = readSource('components/collector/CodePage.tsx');
    assert.match(source, /if \(onSubmit\) \{/);
    assert.match(source, /value === PIECE\.code/);
  });

  it('offers the wired shell mode only in dev builds', () => {
    const source = readSource('components/collector/CollectorShell.tsx');
    assert.match(source, /DEV_SHELL = typeof import\.meta !== 'undefined' && Boolean\(import\.meta\.env\?\.DEV\)/);
    assert.match(source, /mode === 'wired' && DEV_SHELL/);
    assert.match(source, /DEV_SHELL && \(/);
  });
});

/* ------------------------------------------------------------------ *
 * pendingBind unit tests against a mocked sessionStorage
 * ------------------------------------------------------------------ */

function mockStorage(): BindStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

describe('pendingBind bridge functions', () => {
  it('normalizes a typed code the way the bind body does', () => {
    assert.equal(normalizeTypedCode('k7qm-9xtr 2phv-n4wb'), 'K7QM9XTR2PHVN4WB');
  });

  it('mirrors, then takes back exactly once, deleting the key in the same motion', () => {
    const storage = mockStorage();
    mirrorPendingBind({ publicCode: 'AR-7K9QMX2P', normalizedCode: 'A'.repeat(16) }, storage, 1000);
    assert.equal(storage.map.size, 1);
    const stored = JSON.parse(storage.map.get(PENDING_BIND_KEY)!);
    assert.deepEqual(stored, { publicCode: 'AR-7K9QMX2P', normalizedCode: 'A'.repeat(16), ts: 1000 });

    const taken = takePendingBind(storage, 2000);
    assert.deepEqual(taken, { publicCode: 'AR-7K9QMX2P', normalizedCode: 'A'.repeat(16), ts: 1000 });
    assert.equal(storage.map.size, 0, 'the key never outlives its one read');
    assert.equal(takePendingBind(storage, 2000), null);
  });

  it('discards stale entries older than 24 hours, and still deletes the key', () => {
    const storage = mockStorage();
    mirrorPendingBind({ publicCode: 'AR-7K9QMX2P', normalizedCode: 'B'.repeat(16) }, storage, 0);
    const taken = takePendingBind(storage, PENDING_BIND_TTL_MS + 1);
    assert.equal(taken, null);
    assert.equal(storage.map.size, 0);

    // exactly at the boundary it still counts
    mirrorPendingBind({ publicCode: 'AR-7K9QMX2P', normalizedCode: 'B'.repeat(16) }, storage, 0);
    assert.notEqual(takePendingBind(storage, PENDING_BIND_TTL_MS), null);
  });

  it('discards malformed entries without throwing', () => {
    const storage = mockStorage();
    storage.setItem(PENDING_BIND_KEY, 'not json');
    assert.equal(takePendingBind(storage, 0), null);
    storage.setItem(PENDING_BIND_KEY, JSON.stringify({ publicCode: 1, normalizedCode: 'x', ts: 'y' }));
    assert.equal(takePendingBind(storage, 0), null);
    assert.equal(storage.map.size, 0);
  });

  it('clearPendingBind removes without reading', () => {
    const storage = mockStorage();
    mirrorPendingBind({ publicCode: 'AR-7K9QMX2P', normalizedCode: 'C'.repeat(16) }, storage, 0);
    clearPendingBind(storage);
    assert.equal(storage.map.size, 0);
  });
});

describe('pendingBind api lifecycle (clear-on-outcome matrix)', () => {
  it('holds in memory without touching storage', () => {
    const storage = mockStorage();
    const api = createPendingBindApi(() => storage);
    api.hold('AR-7K9QMX2P', 'D'.repeat(16));
    assert.equal(storage.map.size, 0, 'hold never writes storage');
    assert.equal(api.peek()?.normalizedCode, 'D'.repeat(16));
  });

  it('bridges to storage, restores memory-first while deleting the mirror', () => {
    const storage = mockStorage();
    const api = createPendingBindApi(() => storage);
    api.hold('AR-7K9QMX2P', 'E'.repeat(16));
    api.bridge();
    assert.equal(storage.map.size, 1);
    const restored = api.restore();
    assert.equal(restored?.normalizedCode, 'E'.repeat(16));
    assert.equal(storage.map.size, 0, 'restore deletes the mirror even when memory survived');
  });

  it('restores from the mirror after a document reload (fresh memory)', () => {
    const storage = mockStorage();
    const before = createPendingBindApi(() => storage);
    before.hold('AR-7K9QMX2P', 'F'.repeat(16));
    before.bridge();
    // the reload: a brand-new api instance with empty memory
    const after = createPendingBindApi(() => storage);
    const restored = after.restore();
    assert.equal(restored?.normalizedCode, 'F'.repeat(16));
    assert.equal(storage.map.size, 0, 'the key is deleted immediately on restore');
    assert.equal(after.peek()?.normalizedCode, 'F'.repeat(16), 'and the code now lives in memory');
  });

  it('settle clears memory and the mirror from every state', () => {
    // held only
    let storage = mockStorage();
    let api = createPendingBindApi(() => storage);
    api.hold('AR-7K9QMX2P', 'G'.repeat(16));
    api.settle();
    assert.equal(api.peek(), null);
    assert.equal(storage.map.size, 0);

    // held and bridged
    storage = mockStorage();
    api = createPendingBindApi(() => storage);
    api.hold('AR-7K9QMX2P', 'H'.repeat(16));
    api.bridge();
    api.settle();
    assert.equal(api.peek(), null);
    assert.equal(storage.map.size, 0);

    // nothing held: settling is safe
    storage = mockStorage();
    api = createPendingBindApi(() => storage);
    api.settle();
    assert.equal(api.peek(), null);
    assert.equal(storage.map.size, 0);
  });
});
