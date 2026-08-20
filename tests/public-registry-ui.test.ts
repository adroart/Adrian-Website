import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

describe('public scanned-identity UI wiring', () => {
  it('has separate public artwork-ledger projection and private keeper price surfaces', () => {
    for (const relativePath of [
      'utils/artworkLedger.ts',
      'functions/api/artwork-ledger/media/[id].js',
      'functions/api/keeper/certificate-ledger.js',
      'components/collector/legacy/CertificateLedger.tsx',
    ]) {
      assert.equal(existsSync(new URL(`../${relativePath}`, import.meta.url)), true, relativePath);
    }

    const projector = readSource('utils/artworkLedger.ts');
    const publicMedia = readSource('functions/api/artwork-ledger/media/[id].js');
    const privateLedger = readSource('functions/api/keeper/certificate-ledger.js');
    const certificateLedger = readSource('components/collector/legacy/CertificateLedger.tsx');
    const certificateService = readSource('functions/api/_lib/certificateContent.js');
    assert.match(projector, /parsePublicArtworkLedger/);
    assert.match(projector, /parseKeeperCertificateLedger/);
    assert.match(publicMedia, /export async function onRequest/);
    assert.match(privateLedger, /export async function onRequest/);
    assert.match(certificateLedger, /export default function CertificateLedger/);
    assert.match(certificateService, /resolvePublicArtworkLedger/);
    assert.match(certificateService, /resolveCurrentKeeperPriceHistory/);
  });

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
    assert.match(source, /<ArrivalGate[\s\S]*?>[\s\S]*?\{publicIdentityRecord\}[\s\S]*?\{record\}/);
    assert.match(source, /return <>\{publicIdentityRecord\}\{record\}<\/>/);
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

  it('gives the scanned arrival the only h1 before the verified identity details', () => {
    const worksPage = readSource('components/WorksPage.tsx');
    const arrivalGate = readSource('components/legacy/ArrivalGate.tsx');
    const arrivalScreen = readSource('components/collector/legacy/ArrivalScreen.tsx');

    assert.match(arrivalGate, /headingLevel\?:\s*1\s*\|\s*2/);
    assert.match(worksPage, /<ArrivalGate artwork=\{artwork\} identity=\{verifiedIdentity\} headingLevel=\{1\}>/);
    assert.match(arrivalScreen, /headingLevel === 1[\s\S]*?<h1 id="collector-arrival-title"[\s\S]*?<h2 id="collector-arrival-title"/);
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
    assert.match(worksPage, /legacyOn && identity[\s\S]*?<KeeperPanel publicIdentity=\{identity\}/);
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

  it('keeps the complete arrival record immediately available without a timed inert gate', () => {
    const arrivalGate = readSource('components/legacy/ArrivalGate.tsx');
    assert.match(arrivalGate, /data-testid="arrival-record"/);
    assert.doesNotMatch(arrivalGate, /setTimeout|\binert\b|aria-hidden/);
  });

  it('keeps a failed certificate recoverable and renders only exact instance identity facts', () => {
    const certificate = readSource('components/collector/legacy/CertificateScreen.tsx');

    assert.match(certificate, /state\.status === ['"]error['"][\s\S]*?onClick=\{retry\}[\s\S]*?>Try again</);
    assert.match(certificate, /state\.status === ['"]error['"][\s\S]*?onComplete[\s\S]*?Complete registration/);
    assert.match(certificate, /projectInstanceCertificate\(body\?\.certificate, artworkId, publicCode\)/);
    assert.match(certificate, /<Fact label="Identifier">\{state\.certificate\.artworkId\}<\/Fact>/);
    assert.match(certificate, /<Fact label="Edition">\{certificateEditionLabel\(state\.certificate\.edition\)\}<\/Fact>/);
    assert.match(certificate, /<Fact label="Public code">\{state\.certificate\.publicCode\}<\/Fact>/);
    assert.doesNotMatch(certificate, /<Fact label="Edition">\{editionLabel\}<\/Fact>/);
    assert.doesNotMatch(certificate, /<Fact label="Public code">\{publicCode\}<\/Fact>/);
    assert.doesNotMatch(certificate, /<Fact label="Edition">\{state\.certificate\.editionWording\}/);
  });

  it('renders claimed creator fortunes and probes private prices without guest affordances', () => {
    const certificate = readSource('components/collector/legacy/CertificateScreen.tsx');
    const ledger = readSource('components/collector/legacy/CertificateLedger.tsx');

    assert.match(certificate, /parsePublicArtworkLedger\(source\.publicLedger\)/);
    assert.match(certificate, /source\.title/);
    assert.match(certificate, /<CertificateLedger[\s\S]*?publicLedger=\{state\.certificate\.publicLedger\}/);
    assert.match(certificate, /title=\{state\.certificate\.title \|\| title\}/);
    assert.match(ledger, /useAccount\(\)/);
    assert.match(ledger, /\/api\/keeper\/certificate-ledger\?publicCode=/);
    assert.match(ledger, /credentials:\s*['"]include['"]/);
    assert.match(ledger, /cache:\s*['"]no-store['"]/);
    assert.match(ledger, /parseKeeperCertificateLedger/);
    assert.match(ledger, /entry\.message/);
    assert.match(ledger, /entry\.mediaUrl/);
    assert.match(ledger, /alt=\{`\$\{title\}, creator note from the artwork certificate`\}/);
    assert.match(ledger, />Price history</);
    assert.match(ledger, /!available \|\| !isLoaded \|\| !isSignedIn \|\| !userId[\s\S]*?return/);
    assert.match(ledger, /errorBody\?\.currentKeeper === true[\s\S]*?state\.status === ['"]error['"]/);
    assert.doesNotMatch(ledger, /locked|unlock|upgrade|price unavailable/i);
  });

  it('uses the mandated Universal Language alt-text contract for every scanned-record artwork image', () => {
    const arrival = readSource('components/collector/legacy/ArrivalScreen.tsx');
    const worksPage = readSource('components/WorksPage.tsx');

    assert.match(arrival, /import \{ ulAltText, ulCardNumber \} from ['"]\.\.\/\.\.\/\.\.\/utils\/universalLanguage['"]/);
    assert.match(arrival, /artwork\.series === ['"]Universal Language['"][\s\S]*?ulAltText\(artwork, ulCardNumber\(artwork\.coverImage\)\)/);
    assert.match(worksPage, /import \{ ulAltText, ulCardNumber \} from ['"]\.\.\/utils\/universalLanguage['"]/);
    assert.match(worksPage, /artwork\.series === ['"]Universal Language['"][\s\S]*?ulAltText\(artwork, ulCardNumber\(artwork\.coverImage\)\)/);
    assert.match(worksPage, /alt=\{imageAlt\}/);
  });
});
