import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FULL_ARCHIVE } from '../data/mockData.ts';
import { companionCardUrl, contextualCardReturn, ulCardNumber } from '../utils/universalLanguage.ts';

describe('sculpture and companion card navigation', () => {
  const artworks = FULL_ARCHIVE.filter(a => a.series === 'Universal Language');
  it('joins all 64 sculptures to canonical card URLs without renaming either side', () => {
    assert.equal(artworks.length, 64);
    assert.equal(new Set(artworks.map(a => companionCardUrl(a))).size, 64);
    for (const art of artworks) {
      const number = ulCardNumber(art.coverImage);
      assert.equal(companionCardUrl(art), `https://mandalacodes.com/universal-language/${number}`);
      assert.equal(contextualCardReturn(art, `?from=mandalacodes&card=${number}`), companionCardUrl(art));
    }
  });
  it('rejects mismatched, duplicated or hostile return context', () => {
    const art = artworks[0];
    const n = ulCardNumber(art.coverImage)!;
    for (const query of ['?from=evil&card='+n, '?from=mandalacodes&card=999', `?from=mandalacodes&card=${n}&card=${n}`, `?from=mandalacodes&from=evil&card=${n}`]) {
      assert.equal(contextualCardReturn(art, query), null);
    }
    for (const target of ['https://evil.test/universal-language/'+n, 'javascript:alert(1)', '//evil.test', `https://user@mandalacodes.com/universal-language/${n}`]) {
      assert.equal(contextualCardReturn(art, '', target), null);
    }
  });
  it('preserves safe legacy reading context using an external canonical URL', () => {
    const art = artworks[0];
    const n = ulCardNumber(art.coverImage);
    assert.equal(contextualCardReturn(art, '', `/oracle/universal-language/${n}?system=gene-keys`), `${companionCardUrl(art)}?system=gene-keys`);
    assert.equal(companionCardUrl({ series: 'Other', coverImage: '1_test' }), null);
  });
});
