import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { FULL_ARCHIVE } from '../data/mockData';
import { LAUNCH_FLAGS } from '../launchFlags';
import {
  FORBIDDEN_SITE_TERMS,
  getStaticSitemapEntries,
  resolveCanonicalUrl,
  resolveSeoConfig,
} from '../utils/seoMetadata';

const allowedForbiddenTermFiles = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'scripts/validate-seo.ts',
]);

function assertNoForbiddenSiteTerms() {
  const files = [
    'App.tsx',
    'index.html',
    'useSeoMeta.ts',
    'hooks/useMetaTags.ts',
    'components/SubcategoryPage.tsx',
    'components/PiecePage.tsx',
    'components/LaserCutWoodArtPage.tsx',
    'data/mockData.ts',
    'utils/seoMetadata.ts',
    'scripts/generate-sitemap.ts',
    'scripts/generate-static-route-html.ts',
  ];

  for (const file of files) {
    if (allowedForbiddenTermFiles.has(file)) continue;
    const source = readFileSync(file, 'utf8').toLowerCase();
    for (const term of FORBIDDEN_SITE_TERMS) {
      assert.equal(
        source.includes(term),
        false,
        `${file} contains forbidden site term: ${term}`,
      );
    }
  }
}

function assertRouteMetadata() {
  const mandala = resolveSeoConfig('/creations/multidimensional-art/mandala');
  assert.match(mandala.title, /Mandala Art/i);
  assert.match(mandala.description, /laser-cut wood/i);
  assert.match(mandala.description, /sacred geometry/i);

  const laserCut = resolveSeoConfig('/creations/laser-cut-wood-art');
  assert.match(laserCut.title, /Laser-Cut Wood Art/i);
  assert.match(laserCut.description, /layered/i);
  assert.match(laserCut.description, /Adrian Rasmussen/i);

  const universalLanguage = resolveSeoConfig('/creations/multidimensional-art/universal-language');
  assert.equal(/oracle/i.test(`${universalLanguage.title} ${universalLanguage.description}`), false);
  assert.match(universalLanguage.description, /multi-dimensional wooden sculptures/i);

  assert.equal(
    resolveCanonicalUrl('/universal-language/12'),
    'https://adrianrasmussen.com/oracle/universal-language/12',
  );
}

function assertSitemapRoutes() {
  const routes = getStaticSitemapEntries(LAUNCH_FLAGS).map(entry => entry.path);
  assert.equal(routes.includes('/creations/laser-cut-wood-art'), true);
  assert.equal(routes.includes('/creations/multidimensional-art/mandala'), true);
  assert.equal(routes.includes('/shop'), LAUNCH_FLAGS.shopEnabled);
}

function assertArchiveSupportsSeoTargets() {
  const mandalas = FULL_ARCHIVE.filter(art => art.series === 'Mandala');
  assert.equal(mandalas.length >= 40, true, `Expected at least 40 Mandala pieces, found ${mandalas.length}`);

  const laserCutWood = FULL_ARCHIVE.filter(art => /laser cut wood/i.test(art.material ?? ''));
  assert.equal(
    laserCutWood.length >= 100,
    true,
    `Expected at least 100 laser cut wood artworks, found ${laserCutWood.length}`,
  );
}

function assertBuildGeneratesSeoArtifacts() {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const buildScript = packageJson.scripts?.build ?? '';

  assert.match(buildScript, /generate-static-route-html/, 'Build must generate route-specific HTML metadata.');
  assert.match(buildScript, /generate-sitemap/, 'Build must regenerate the sitemap.');
}

function assertCanonicalDomain() {
  const files = [
    'AGENTS.md',
    'CLAUDE.md',
    'index.html',
    'constants.ts',
    'vite.config.ts',
    'public/robots.txt',
    'public/sitemap.xml',
    'utils/seoMetadata.ts',
    'scripts/generate-sitemap.ts',
    'scripts/generate-static-route-html.ts',
    'scripts/generate-og-pages.ts',
    'scripts/generate-ul-qr.ts',
    'scripts/circle-qr-demo.mjs',
    'functions/oracle/universal-language/[number].js',
    'functions/qr/[number].js',
    'functions/qr/oracle.js',
    'functions/api/checkout.js',
    'functions/api/subscribe.js',
    'functions/api/inquire.js',
    'components/About.tsx',
    'components/Breadcrumb.tsx',
    'components/LaserCutWoodArtPage.tsx',
    'components/PiecePage.tsx',
    'components/Store.tsx',
    'components/SubcategoryPage.tsx',
    'components/UniversalLanguageCard.tsx',
    'components/Writings.tsx',
    'docs/research/seo/README.md',
    'docs/research/seo/index.html',
    'docs/research/seo/2026-05-20-12-month-execution-plan.md',
  ];
  const staleArtDomain = 'adrianrasmussen' + '.art';
  const staleWwwDomain = 'www.' + 'adrianrasmussen.com';

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.equal(source.includes(staleArtDomain), false, `${file} must not reference .art.`);
    assert.equal(source.includes(staleWwwDomain), false, `${file} must not reference www canonical URLs.`);
  }
}

assertNoForbiddenSiteTerms();
assertRouteMetadata();
assertSitemapRoutes();
assertArchiveSupportsSeoTargets();
assertBuildGeneratesSeoArtifacts();
assertCanonicalDomain();

console.log('SEO validation passed.');
