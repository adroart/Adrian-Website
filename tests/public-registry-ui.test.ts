import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

describe('public scanned-identity UI wiring', () => {
  it('loads only strict public instance codes from the no-store registry endpoint', () => {
    const source = readSource('components/WorksPage.tsx');

    assert.match(source, /isPublicRegistryCode\(instanceCode\)/);
    assert.match(source, /\/api\/registry\/\$\{encodeURIComponent\(publicCode\)\}/);
    assert.match(source, /cache:\s*['"]no-store['"]/);
    assert.match(source, /validatePublicPlateIdentity\(data\?\.identity\)/);
  });

  it('uses the verified identity for every field in the leading identity block', () => {
    const source = readSource('components/WorksPage.tsx');

    for (const field of [
      'identity.title',
      'identity.artworkId',
      'identity.edition.label',
      'identity.publicCode',
      'identity.artistName',
      'identity.plateStatus',
      'identity.publicProvenance',
    ]) {
      assert.match(source, new RegExp(field.replace('.', '\\.')));
    }
    assert.doesNotMatch(source, /const editionParam = searchParams\.get\(['"]edition['"]\)/);
  });

  it('keeps exact identity ahead of both catalog and draft record branches', () => {
    const source = readSource('components/WorksPage.tsx');

    assert.match(source, /<PublicIdentityRecord[\s\S]*?identityState/);
    assert.match(source, /draft\.status === ['"]found['"][\s\S]*?<DraftArtworkRecord/);
    assert.match(source, /<PublicIdentityRecord[\s\S]*?<CatalogArtworkRecord/);
    assert.match(source, /return <>\{publicIdentityRecord\}<ArrivalGate/);
  });

  it('gives not-found and temporary failures different states with retry only for temporary failures', () => {
    const source = readSource('components/WorksPage.tsx');

    assert.match(source, /response\.status === 404/);
    assert.match(source, /status:\s*['"]not-found['"]/);
    assert.match(source, /status:\s*['"]unavailable['"]/);
    assert.match(source, />\s*Try again\s*</);
  });

  it('passes only a verified public identity into the launch-gated steward panel', () => {
    const worksPage = readSource('components/WorksPage.tsx');
    const keeperPanel = readSource('components/legacy/KeeperPanel.tsx');

    assert.match(worksPage, /const verifiedIdentity = identityState\.status === ['"]ready['"] && identityState\.publicCode === publicCode/);
    assert.match(worksPage, /legacyOn && identity && <KeeperPanel publicIdentity=\{identity\}/);
    assert.match(keeperPanel, /publicIdentity:\s*PublicPlateIdentity/);
    assert.doesNotMatch(keeperPanel, /React\.FC<\{ artwork: Artwork; editionNumber\?: number \}>/);
  });
});
