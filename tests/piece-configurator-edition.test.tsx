import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { Artwork } from '../types';

before(() => {
  mock.module('../CartContext', { namedExports: { useCart: () => ({ addToCart: () => assert.fail('render must not add to cart') }) } });
  mock.module('../data/mockData', { namedExports: { MADE_TO_ORDER_ADD_ONS: {
    crystals: { small: { price: 10 }, medium: { price: 20 }, large: { price: 30 } },
    woodFrame: { small: { price: 10 }, medium: { price: 20 }, large: { price: 30 } },
    illumination: { medium: { price: 20 }, large: { price: 30 }, major: { price: 40 } },
  } } });
});
after(() => mock.reset());

const piece: Artwork = {
  id: 'synthetic-edition', title: 'Synthetic edition fixture', category: 'Synthetic',
  coverImage: '', images: [], description: 'Test fixture only', year: '2026',
  availability: 'MADE_TO_ORDER', editionSize: 3,
  sizeVariants: [
    { size: '29 cm', price: 100, availability: 'MADE_TO_ORDER' },
    { size: '58 cm', price: 200, availability: 'MADE_TO_ORDER' },
  ],
};
async function render(overrides: Partial<Artwork>) {
  const { default: PieceConfigurator } = await import('../components/PieceConfigurator');
  return renderToStaticMarkup(<MemoryRouter><PieceConfigurator art={{ ...piece, ...overrides }} /></MemoryRouter>);
}

describe('extracted configurator edition boundary', () => {
  for (const editionSold of [3, 4]) it(`replaces a closed edition with the existing commission inquiry (${editionSold})`, async () => {
    const html = await render({ editionSold });
    assert.match(html, /Edition closed/);
    assert.match(html, /Commission a similar piece/);
    assert.match(html, /href="\/inquire"/);
    assert.doesNotMatch(html, /<button|<input|Continue to options|Add to Cart|Request to Purchase/);
  });
  for (const overrides of [{ editionSold: 2 }, {}, { editionSize: undefined, editionSold: 3 }]) {
    it(`retains size choices when the existing contract is open (${JSON.stringify(overrides)})`, async () => {
      const html = await render(overrides);
      assert.match(html, /Select your size/);
      assert.doesNotMatch(html, /Edition closed/);
    });
  }
});
