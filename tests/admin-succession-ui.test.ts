import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('succession desk', () => {
  it('replaces the honest placeholder with the real page at /admin/succession', () => {
    const app = source('App.tsx');
    assert.match(app, /const Succession = lazy\(\(\) => import\('\.\/components\/admin\/Succession'\)\)/);
    assert.match(app, /<Route path="succession" element=\{<Succession\s*\/>\}/);
    assert.doesNotMatch(app, /AdminSuccessionPlaceholder/);
    assert.doesNotMatch(app, /Succession is not built yet/);
  });

  it('uses the shared admin primitives and the ceremony kit instead of inventing its own', () => {
    const page = source('components/admin/Succession.tsx');
    assert.match(page, /import \{ AdminAlert, AdminPage, AdminPageHeader, AdminSection, adminUI \} from '\.\/AdminPage'/);
    assert.match(page, /const \{ Body, Brass, Field, Ledger, Note, Quiet, State \} = adminUI/);
    // Never modified; only imported.
    assert.doesNotMatch(page, /export const adminUI/);
  });

  it('gates the substantive page behind the registry step-up unlock, in three states', () => {
    const page = source('components/admin/Succession.tsx');
    assert.match(page, /successionReadiness\(unlocked, config\.recoveryExportConfigured\)/);
    assert.match(page, /readiness === 'locked'/);
    assert.match(page, /fetch\('\/api\/admin\/registry-unlock'\)/);
  });

  it('downloads both archives via fetch and a blob, never a bare anchor to the endpoint', () => {
    const page = source('components/admin/Succession.tsx');
    assert.match(page, /async function downloadViaBlob/);
    assert.match(page, /downloadViaBlob\('\/api\/admin\/registry-recovery-export'/);
    assert.match(page, /downloadViaBlob\('\/api\/admin\/records\/export'/);
    assert.doesNotMatch(page, /href=["']\/api\/admin\/(registry-recovery-export|records\/export)["']/);
  });

  it('names both missing recovery-export secrets and the exact command to set them', () => {
    const page = source('components/admin/Succession.tsx');
    assert.match(page, /REGISTRY_RECOVERY_EXPORT_KEY_ID/);
    assert.match(page, /wrangler pages secret put REGISTRY_RECOVERY_EXPORT_KEY --project-name adrian-website/);
    assert.match(page, /wrangler pages secret put REGISTRY_RECOVERY_EXPORT_KEY_ID --project-name adrian-website/);
    assert.match(page, /docs\/finish-setup\.md/);
  });

  it('renders the handbook by reusing successorHandbook.js rather than duplicating its markdown renderer', () => {
    const page = source('components/admin/Succession.tsx');
    assert.match(page, /import \{ HANDBOOK_SOURCE, renderHandbookMarkdown \} from '\.\.\/\.\.\/functions\/api\/_lib\/successorHandbook\.js'/);
    assert.doesNotMatch(page, /function renderHandbookMarkdown/);
  });

  it('states honestly, in the page copy, which lines are not known rather than fabricating them', () => {
    const page = source('components/admin/Succession.tsx');
    for (const admission of [
      'Not known here',
      'keeps no record of when the encrypted archive was last downloaded',
      'has no way to check whether it exists',
      'Nothing here tracks drills',
    ]) {
      assert.ok(page.includes(admission), `expected the page to admit: ${admission}`);
    }
  });

  it('quotes the custody rule and the yearly drill in the handbook\'s own words', () => {
    const page = source('components/admin/Succession.tsx');
    const guide = source('docs/registry-custodian-guide.md');
    assert.ok(guide.includes('the passkey and the files must never be stored in'), 'guide still contains the custody rule');
    assert.match(page, /The passkey and the files must never be stored in the same place/);
    assert.match(page, /A drill that ends with a working scratch copy is proof the succession works/);
  });

  it('has a single-row settings migration numbered 044, matching the pricing_config shape', () => {
    const migration = source('migrations/044_succession_settings.sql');
    assert.match(migration, /CREATE TABLE IF NOT EXISTS succession_settings/);
    assert.match(migration, /id INTEGER PRIMARY KEY CHECK \(id = 1\)/);
    for (const column of ['passkey_sealed_at', 'passkey_second_copy_at', 'family_contact', 'technical_helper']) {
      assert.match(migration, new RegExp(column));
    }
  });

  it('gates the settings endpoint behind requireRegistryUnlock, like every other registry-wide export', () => {
    const endpoint = source('functions/api/admin/succession.js');
    assert.match(endpoint, /requireRegistryUnlock/);
    assert.match(endpoint, /requireDb/);
    assert.match(endpoint, /succession_settings/);
    assert.match(endpoint, /REGISTRY_RECOVERY_EXPORT_KEY/);
    assert.match(endpoint, /ARTWORK_REGISTRY_BACKUP/);
  });
});

describe('utils/adminSuccession pure helpers', () => {
  it('sanitizes free-typed fields to a single trimmed line with a length cap', async () => {
    const { sanitizeSuccessionField, sanitizeSuccessionFields } = await import('../utils/adminSuccession.ts');
    assert.equal(sanitizeSuccessionField('  a lawyer,\n  in town  '), 'a lawyer, in town');
    assert.equal(sanitizeSuccessionField(42 as unknown as string), '');
    assert.equal(sanitizeSuccessionField('x'.repeat(600)).length, 500);
    assert.deepEqual(
      sanitizeSuccessionFields({ passkeySealedAt: '  a safe  ', familyContact: 12 }),
      { passkeySealedAt: 'a safe', passkeySecondCopyAt: '', familyContact: '', technicalHelper: '' },
    );
  });

  it('reports readiness across the three named states', async () => {
    const { successionReadiness } = await import('../utils/adminSuccession.ts');
    assert.equal(successionReadiness(false, false), 'locked');
    assert.equal(successionReadiness(false, true), 'locked');
    assert.equal(successionReadiness(true, false), 'unconfigured');
    assert.equal(successionReadiness(true, true), 'ready');
  });

  it('reports whether every blank has been filled', async () => {
    const { successionFieldsComplete, emptySuccessionFields } = await import('../utils/adminSuccession.ts');
    assert.equal(successionFieldsComplete(emptySuccessionFields), false);
    assert.equal(successionFieldsComplete({
      passkeySealedAt: 'a', passkeySecondCopyAt: 'b', familyContact: 'c', technicalHelper: 'd',
    }), true);
    assert.equal(successionFieldsComplete({
      passkeySealedAt: 'a', passkeySecondCopyAt: 'b', familyContact: '', technicalHelper: 'd',
    }), false);
  });

  it('splices filled fields into the real handbook source without touching the file on disk', async () => {
    const { fillHandbookBlanks } = await import('../utils/adminSuccession.ts');
    const { HANDBOOK_SOURCE } = await import('../functions/api/_lib/successorHandbook.js');
    const filled = fillHandbookBlanks(HANDBOOK_SOURCE, {
      passkeySealedAt: 'a lawyer in town',
      passkeySecondCopyAt: 'a bank box',
      familyContact: 'Jane Doe, 555-0100',
      technicalHelper: 'Sam the developer',
    });
    assert.ok(filled.includes('Written and sealed at: a lawyer in town'));
    assert.ok(filled.includes('A second sealed copy at: a bank box'));
    assert.ok(filled.includes('Family contact for the registry: Jane Doe, 555-0100'));
    assert.ok(filled.includes('Technical helper who knows this system: Sam the developer'));
    // The exported constant itself is untouched: fillHandbookBlanks returns a
    // new string, it never mutates the module's own HANDBOOK_SOURCE.
    assert.ok(HANDBOOK_SOURCE.includes('Written and sealed at: __'));
  });

  it('leaves a blank untouched when its field is empty, so the handbook still visibly asks for it', async () => {
    const { fillHandbookBlanks, emptySuccessionFields } = await import('../utils/adminSuccession.ts');
    const { HANDBOOK_SOURCE } = await import('../functions/api/_lib/successorHandbook.js');
    const filled = fillHandbookBlanks(HANDBOOK_SOURCE, emptySuccessionFields);
    assert.equal(filled, HANDBOOK_SOURCE);
  });
});
