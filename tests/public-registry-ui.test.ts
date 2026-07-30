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
      'identity.creatorHistory',
    ]) {
      assert.match(source, new RegExp(field.replace('.', '\\.')));
    }
    assert.doesNotMatch(source, /const editionParam = searchParams\.get\(['"]edition['"]\)/);
    assert.match(source, /Creator history/);
    assert.match(source, /CREATOR_HISTORY_LABELS/);
  });

  it('keeps exact identity ahead of both catalog and draft record branches', () => {
    const source = readSource('components/WorksPage.tsx');

    assert.match(source, /<PublicIdentityRecord[\s\S]*?identityState/);
    assert.match(source, /draft\.status === ['"]found['"][\s\S]*?<DraftArtworkRecord/);
    assert.match(source, /<PublicIdentityRecord[\s\S]*?<CatalogArtworkRecord/);
    assert.match(source, /\{publicIdentityRecord\}[\s\S]*?<ArrivalGate/);
  });

  it('replaces a mismatched route with the canonical verified artwork route', () => {
    const source = readSource('components/WorksPage.tsx');

    assert.match(source, /verifiedIdentity\.artworkId !== id/);
    assert.match(source, /navigate\(canonicalPath, \{ replace: true \}\)/);
    assert.match(source, /\/works\/\$\{encodeURIComponent\(verifiedIdentity\.artworkId\)\}/);
    assert.match(source, /<PublicIdentityRedirectState/);
  });

  it('distinguishes a malformed instance parameter from no instance parameter', () => {
    const source = readSource('components/WorksPage.tsx');

    assert.match(source, /searchParams\.has\(['"]instance['"]\)/);
    assert.match(source, /hasInstanceParam && !publicCode/);
    assert.match(source, /data-testid="public-registry-invalid"/);
  });

  it('gives scanned identity the only h1 when the legacy arrival is enabled', () => {
    const worksPage = readSource('components/WorksPage.tsx');
    const arrivalGate = readSource('components/legacy/ArrivalGate.tsx');

    assert.match(arrivalGate, /headingLevel\?:\s*1\s*\|\s*2/);
    assert.match(worksPage, /<ArrivalGate artwork=\{artwork\} headingLevel=\{publicCode \? 2 : 1\}>/);
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

  it('uses publicCode for status, bind, and location across exact identity kinds', async () => {
    const panel = await import('../components/legacy/KeeperPanel.tsx');
    const source = readSource('components/legacy/KeeperPanel.tsx');
    const identities = [
      {
        artworkId: 'UL-100', title: 'Unique work', series: null,
        edition: { kind: 'unique', number: null, size: null, label: 'Unique work' },
        publicCode: 'AR-7KQ9M2WX', artistName: 'Adrian Rasmussen',
        plateStatus: 'active', publicProvenance: [], creatorHistory: [],
      },
      {
        artworkId: 'MD-905', title: 'Registry draft', series: 'Studio Works',
        edition: { kind: 'numbered', number: 1, size: 3, label: 'Edition 1 of 3' },
        publicCode: 'AR-ABCDEFGH', artistName: 'Adrian Rasmussen',
        plateStatus: 'active', publicProvenance: [], creatorHistory: [],
      },
    ] as const;

    assert.equal(typeof panel.stewardClaimDestination, 'function');
    assert.equal(
      panel.stewardClaimDestination(identities[0]),
      '/works/UL-100?instance=AR-7KQ9M2WX&ref=qr&claim=1',
    );
    assert.equal(
      panel.stewardClaimDestination(identities[1]),
      '/works/MD-905?instance=AR-ABCDEFGH&ref=qr&claim=1',
    );
    assert.match(source, /keeper\/piece\?\$\{params\.toString\(\)\}/);
    assert.match(source, /URLSearchParams\(\{ publicCode \}\)/);
    assert.match(source, /JSON\.stringify\(\{ publicCode, ownershipCode:/);
    assert.match(source, /JSON\.stringify\(\{[\s\S]*?publicCode,[\s\S]*?currentDisplayLocation/);
    assert.doesNotMatch(source, /editionNumber:\s*editionNumber/);
    assert.doesNotMatch(source, /pieceId:\s*pieceId/);
  });

  it('keeps contested 202 outcomes pending and exposes an accessible request form', async () => {
    const panel = await import('../components/legacy/KeeperPanel.tsx');
    const source = readSource('components/legacy/KeeperPanel.tsx');

    assert.deepEqual(panel.classifyStewardBindResult(200, { ok: true }), { kind: 'bound' });
    assert.deepEqual(
      panel.classifyStewardBindResult(202, {
        ok: true,
        status: 'claim_requested',
        message: 'The request is recorded for manual review.',
        claim: { outcome: 'opened' },
      }),
      {
        kind: 'pending',
        message: 'The request is recorded for manual review.',
      },
    );
    assert.match(source, /Request stewardship/);
    assert.match(source, /<label[^>]*htmlFor=/);
    assert.match(source, /<textarea/);
    assert.match(source, /aria-describedby=/);
    assert.match(source, /aria-live=['"]polite['"]/);
    assert.match(source, /role=['"]status['"]/);
    assert.match(source, /AbortController/);
    assert.match(source, /key=\{`register-\$\{publicCode\}`\}/);
    assert.match(source, /key=\{`request-\$\{publicCode\}`\}/);
    assert.match(source, /key=\{`location-\$\{publicCode\}`\}/);
    assert.doesNotMatch(source, /notified|silence|patient window|response window/i);
  });

  it('makes the unrevealed arrival content inert as well as aria-hidden', () => {
    const arrivalGate = readSource('components/legacy/ArrivalGate.tsx');
    assert.match(arrivalGate, /!opened[\s\S]*?inert:\s*['"]['"]/);
    assert.match(arrivalGate, /aria-hidden=\{!opened\}/);
  });
});
