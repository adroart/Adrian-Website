import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('custody envelope ceremony (components/admin/CustodyEnvelope.tsx)', () => {
  const page = source('components/admin/CustodyEnvelope.tsx');

  it('uses the shared admin primitives instead of inventing its own, and never modifies AdminPage', () => {
    assert.match(page, /import \{ adminUI \} from '\.\/AdminPage'/);
    assert.match(page, /const \{ Brass, Field, Quiet \} = adminUI/);
    assert.doesNotMatch(page, /export const adminUI/);
  });

  it('only ever imports buildCustodyEnvelope and validateCustodyKeys, never redefines the crypto', () => {
    assert.match(page, /import \{ buildCustodyEnvelope, validateCustodyKeys, type CustodyKeys \} from '\.\.\/\.\.\/utils\/custodyEnvelope'/);
    assert.doesNotMatch(page, /crypto\.subtle\.(encrypt|decrypt|deriveKey)/);
  });

  it('generates the passphrase via a dynamic import, so the bundled wordlist is not paid for at page load', () => {
    assert.match(page, /await import\('\.\.\/\.\.\/utils\/custodyPassphrase'\)/);
    assert.doesNotMatch(page, /^import .*custodyPassphrase/m);
  });

  it('never puts the passphrase or the keys in a fetch body, a URL, or storage', () => {
    // The only fetch in this file is the POST that reads the keys down from
    // the server; nothing is ever fetched or posted back up.
    const fetchCalls = page.match(/fetch\([^)]*\)/g) ?? [];
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0], /'\/api\/admin\/custody-keys'/);
    // The file's own doc comment names localStorage/sessionStorage in prose,
    // to say the passphrase never goes there; only real API usage is banned.
    assert.doesNotMatch(page, /\b(localStorage|sessionStorage)\.(setItem|getItem)/);
    assert.doesNotMatch(page, /console\.(log|debug|info)/);
  });

  it('downloads the result as custody-envelope.json via a Blob, never a bare anchor to a server URL', () => {
    assert.match(page, /function downloadJsonBlob/);
    assert.match(page, /downloadJsonBlob\('custody-envelope\.json', envelope\)/);
    assert.match(page, /new Blob\(/);
  });

  it('asks him to retype two words chosen at random before building anything', () => {
    assert.match(page, /randomWordlistIndex/);
    assert.match(page, /verifyIndices/);
    assert.match(page, /confirmAndBuild/);
  });

  it('never reaches into a settings save itself; it only offers an onEnvelopeMade callback', () => {
    assert.match(page, /onEnvelopeMade\?:\s*\(date: string\) => void/);
    assert.match(page, /onEnvelopeMade\?\.\(madeAt\)/);
    assert.doesNotMatch(page, /\/api\/admin\/succession/);
    assert.doesNotMatch(page, /setDraft/);
  });

  it('tells the truth about the ceremony being shown once and never recoverable', () => {
    for (const admission of [
      'This is shown once',
      'nobody, including you, can recover',
      'must never be kept in the same place',
    ]) {
      assert.ok(page.includes(admission), `expected the page to say: ${admission}`);
    }
  });

  it('never uses an em dash', () => {
    assert.doesNotMatch(page, /—/);
    assert.doesNotMatch(page, /--/);
  });
});

describe('Succession.tsx wires in CustodyEnvelope minimally', () => {
  it('renders the ceremony behind the same registry unlock, not before it', () => {
    const page = source('components/admin/Succession.tsx');
    const unlockIndex = page.indexOf("readiness === 'locked'");
    const custodyIndex = page.indexOf('<CustodyEnvelope');
    assert.ok(unlockIndex >= 0 && custodyIndex >= 0);
    assert.ok(custodyIndex > unlockIndex, 'the ceremony must render after the locked-state branch, inside the unlocked view');
  });
});
