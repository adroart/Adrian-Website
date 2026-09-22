import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LettersRoom } from '../components/collector/rooms.tsx';

describe('collector letter room', () => {
  it('renders the authorized letter body as literal text with its kind and date', () => {
    const body = 'First line\n<script>window.letterLeaked = true</script>\nLast line';
    const html = renderToStaticMarkup(
      <LettersRoom live={{
        letters: {
          status: 'ready',
          data: [{
            id: `letter-${'1'.repeat(64)}`,
            kind: 'anniversary',
            body,
            createdAt: '2026-08-10T00:00:00.000Z',
          }],
        },
      } as never} />,
    );

    assert.match(html, /The year turning/);
    assert.match(html, /10 August 2026/);
    assert.match(html, /white-space:pre-wrap/);
    assert.match(html, /First line\n&lt;script&gt;window\.letterLeaked = true&lt;\/script&gt;\nLast line/);
    assert.doesNotMatch(html, /<script>/);
  });

  it('does not render letter data when no authorized live letters are supplied', () => {
    const html = renderToStaticMarkup(<LettersRoom />);

    assert.match(html, /Nothing written yet\./);
    assert.doesNotMatch(html, /The year turning|window\.letterLeaked/);
  });
});
