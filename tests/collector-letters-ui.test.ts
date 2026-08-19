import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import PieceLetters from '../components/collector/legacy/PieceLetters.tsx';
import type { CollectorLetter } from '../utils/collectorLetters.ts';

const letters: CollectorLetter[] = [
  {
    id: `letter-${'1'.repeat(64)}`,
    kind: 'kin-claim',
    body: 'Tonight a piece sharing my Thunder trigram came to light in Denpasar, Indonesia.',
    createdAt: '2026-08-10T00:00:00.000Z',
  },
  {
    id: `letter-${'2'.repeat(64)}`,
    kind: 'transfer',
    body: 'I arrived with a history already begun. The record travels with me.',
    createdAt: '2025-08-10T00:00:00.000Z',
  },
];

describe('piece letters', () => {
  it('renders accessible loading, error, retry, and empty states', () => {
    const loading = renderToStaticMarkup(React.createElement(PieceLetters, {
      status: 'loading', letters: [], onRetry: () => undefined,
    }));
    const error = renderToStaticMarkup(React.createElement(PieceLetters, {
      status: 'error', letters: [], error: 'Letters could not be reached.',
      onRetry: () => undefined,
    }));
    const empty = renderToStaticMarkup(React.createElement(PieceLetters, {
      status: 'ready', letters: [], onRetry: () => undefined,
    }));

    assert.match(loading, /role="status"/);
    assert.match(loading, /Gathering letters/);
    assert.match(error, /role="alert"/);
    assert.match(error, /Letters could not be reached/);
    assert.match(error, />Try again<\/button>/);
    assert.match(empty, /No letters have arrived yet/);
  });

  it('renders the private reading view without counts or social mechanics', () => {
    const html = renderToStaticMarkup(React.createElement(PieceLetters, {
      status: 'ready', letters, onRetry: () => undefined,
    }));

    assert.match(html, /Letters from this piece/);
    assert.match(html, /Kinship/);
    assert.match(html, /Transfer/);
    assert.match(html, /Thunder trigram/);
    assert.equal((html.match(/<article\b/g) ?? []).length, 2);
    assert.equal((html.match(/<h[1-6]\b/g) ?? []).length, 1);
    assert.doesNotMatch(html, /unread|like|share|followers|\b2 letters\b/i);
  });

  it('defaults to a nested heading and permits standalone heading semantics', () => {
    const nested = renderToStaticMarkup(React.createElement(PieceLetters, {
      status: 'ready', letters: [], onRetry: () => undefined,
    }));
    const standalone = renderToStaticMarkup(React.createElement(PieceLetters, {
      status: 'ready', letters: [], onRetry: () => undefined, headingLevel: 'h2',
    }));

    assert.match(nested, /<h4[^>]*>Letters from this piece<\/h4>/);
    assert.match(standalone, /<h2[^>]*>Letters from this piece<\/h2>/);
  });

  it('keeps prohibited language and imagery out of the component', () => {
    const source = readFileSync(
      new URL('../components/collector/PieceLetters.tsx', import.meta.url),
      'utf8',
    );
    assert.doesNotMatch(source, /[\u2014\u{1F300}-\u{1FAFF}]/u);
    assert.doesNotMatch(source, /icon|badge|sticker/i);
  });
});
