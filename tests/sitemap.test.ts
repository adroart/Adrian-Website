import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FULL_ARCHIVE, TRACKS } from '../data/mockData';
import { piecePath } from '../utils/pieceSlug';
import { loadStories } from '../scripts/story-source';
import { buildSitemap, sitemapEntries } from '../scripts/generate-sitemap';

const origin = 'https://adrianrasmussen.com';

test('sitemap contains the canonical catalog, actual story sources and compiled poems', () => {
  const locations = sitemapEntries(false).map(entry => entry.loc);
  for (const artwork of FULL_ARCHIVE) assert.ok(locations.includes(`${origin}${piecePath(artwork)}`));
  for (const story of loadStories(new URL('../content/stories', import.meta.url).pathname)) {
    assert.ok(locations.includes(`${origin}/writings/${encodeURIComponent(story.slug)}`));
  }
  for (const track of TRACKS) assert.ok(locations.includes(`${origin}/poetry/${encodeURIComponent(track.slug)}`));
  assert.ok(locations.includes(`${origin}/oracle`));
  assert.ok(locations.includes(`${origin}/poetry`));
  assert.equal(new Set(locations).size, locations.length);
  assert.ok(locations.every(location => !/\/oracle\/|\/account(?:\/|$)|\/admin(?:\/|$)|\/invoice\/|\/viewing\//.test(location)));
  assert.ok(!locations.includes(`${origin}/shop`));
  assert.ok(sitemapEntries(true).some(entry => entry.loc === `${origin}/shop`));
});

test('committed sitemap matches generation without fabricated modification dates', () => {
  const xml = buildSitemap();
  assert.equal(xml, readFileSync(new URL('../public/sitemap.xml', import.meta.url), 'utf8'));
  assert.equal(xml, buildSitemap());
  assert.ok(!xml.includes('<lastmod>'));
  assert.ok(!xml.includes('/oracle/universal-language'));
});

test('sitemap escapes XML characters in locations', () => {
  assert.ok(buildSitemap([{ loc: `${origin}/sample?a=1&b=2`, priority: '0.7' }]).includes('?a=1&amp;b=2'));
});
