import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import { DreamScreenView } from '../components/collector/legacy/DreamScreen.tsx';
import { PublicDreamView } from '../components/collector/legacy/PublicDream.tsx';
import { YearlyRitualView } from '../components/collector/legacy/YearlyRitualScreen.tsx';
import { loadPublicCollectorDream } from '../utils/collectorDreams.ts';
import type {
  CollectorDreamState,
  YearlyRitualEligibility,
} from '../utils/collectorDreams.ts';

const emptyState: CollectorDreamState = {
  keeperPieceId: 'kp-one', current: null, history: [], markers: [],
};
const currentState: CollectorDreamState = {
  ...emptyState,
  current: {
    id: 'dream-one', keeperPieceId: 'kp-one', body: 'Keep the table open.',
    scope: 'community', visibility: 'private', version: 1,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    sharedAt: null, revokedAt: null, fulfilledAt: null, archivedAt: null,
  },
  markers: [{
    id: 'marker-one', dreamId: 'dream-one', kind: 'milestone',
    body: 'The first neighborhood supper happened.',
    createdAt: '2026-02-01T00:00:00.000Z',
  }],
};

const noop = () => undefined;
const asyncNoop = async () => undefined;

describe('collector dream screens', () => {
  it('renders public dream loading, closed, error, anonymous, and attributed states truthfully', () => {
    const loading = renderToStaticMarkup(React.createElement(PublicDreamView, {
      status: 'loading', dream: null, onRetry: noop,
    }));
    const closed = renderToStaticMarkup(React.createElement(PublicDreamView, {
      status: 'ready', dream: null, onRetry: noop,
    }));
    const error = renderToStaticMarkup(React.createElement(PublicDreamView, {
      status: 'error', dream: null, onRetry: noop,
    }));
    const anonymous = renderToStaticMarkup(React.createElement(PublicDreamView, {
      status: 'ready', onRetry: noop, dream: {
        body: 'May every neighbor find a place at the table.',
        scope: 'community', visibility: 'anonymous', attribution: null,
        sharedAt: '2026-08-09T12:01:00.000Z',
      },
    }));
    const attributed = renderToStaticMarkup(React.createElement(PublicDreamView, {
      status: 'ready', onRetry: noop, dream: {
        body: 'May the forest remain a home for every generation.',
        scope: 'planet', visibility: 'attributed', attribution: 'Adult Keeper',
        sharedAt: '2026-08-09T12:01:00.000Z',
      },
    }));
    assert.match(loading, /role="status"/);
    assert.match(closed, /No dream has been opened publicly here/);
    assert.match(error, /role="alert"/);
    assert.match(error, />Try again<\/button>/);
    assert.match(anonymous, /A dream for the community/);
    assert.match(anonymous, /Shared without a name/);
    assert.doesNotMatch(anonymous, /Adult Keeper/);
    assert.match(attributed, /A dream for the planet/);
    assert.match(attributed, /Adult Keeper/);
    assert.doesNotMatch(`${loading}${closed}${error}${anonymous}${attributed}`,
      /count|like|follow|support|comment|approval/i);
  });

  it('strictly validates the public dream client response', async (context) => {
    context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({
      dream: {
        body: 'A public dream.', scope: 'self', visibility: 'anonymous',
        attribution: null, sharedAt: '2026-08-09T12:01:00.000Z',
        keeperPieceId: 'must-not-pass',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await assert.rejects(loadPublicCollectorDream('AR-ABCDEFGH'), /invalid_public_dream/);
  });

  it('renders clear loading, retryable error, and dignified empty states', () => {
    const loading = renderToStaticMarkup(React.createElement(DreamScreenView, {
      status: 'loading', state: null, onRetry: noop, onSave: asyncNoop,
      onShare: asyncNoop, onMarker: asyncNoop,
    }));
    const error = renderToStaticMarkup(React.createElement(DreamScreenView, {
      status: 'error', state: null, error: 'Your dream could not be opened.',
      onRetry: noop, onSave: asyncNoop, onShare: asyncNoop, onMarker: asyncNoop,
    }));
    const empty = renderToStaticMarkup(React.createElement(DreamScreenView, {
      status: 'ready', state: emptyState, onRetry: noop, onSave: asyncNoop,
      onShare: asyncNoop, onMarker: asyncNoop, onComplete: noop,
    }));

    assert.match(loading, /role="status"/);
    assert.match(loading, /Opening the dream held by this piece/);
    assert.match(error, /role="alert"/);
    assert.match(error, /Your dream could not be opened/);
    assert.match(error, />Try again<\/button>/);
    assert.match(empty, /This piece can hold one dream/);
    assert.match(empty, /<textarea[^>]*name="dream"/);
    assert.equal((empty.match(/type="radio"/g) ?? []).length, 4);
    for (const label of ['Yourself', 'Family and loved ones', 'Your community', 'The planet']) {
      assert.match(empty, new RegExp(label));
    }
    assert.doesNotMatch(empty, />Continue<\/button>/);

    const placed = renderToStaticMarkup(React.createElement(DreamScreenView, {
      status: 'ready', state: currentState, onRetry: noop, onSave: asyncNoop,
      onShare: asyncNoop, onMarker: asyncNoop, onComplete: noop,
    }));
    assert.match(placed, />Continue<\/button>/);
  });

  it('shows dormant sharing as a separate choice and markers as a quiet thread', () => {
    const html = renderToStaticMarkup(React.createElement(DreamScreenView, {
      status: 'ready', state: currentState, onRetry: noop, onSave: asyncNoop,
      onShare: asyncNoop, onMarker: asyncNoop,
    }));
    assert.match(html, /Keep the table open/);
    assert.match(html, />Share without my name<\/button>/);
    assert.match(html, />Share with my name<\/button>/);
    assert.match(html, /The first neighborhood supper happened/);
    assert.match(html, /Add a marker only when something real happened/);
    assert.match(html, /<select[^>]*name="markerKind"/);
    assert.doesNotMatch(html, /approval|support count|like button|follower count/i);
  });

  it('renders the yearly return as exactly three choices anchored to the current dream', () => {
    const eligibility: YearlyRitualEligibility = {
      eligible: true, reason: null, birthdayYear: 2026,
      actions: ['reinforce', 'plant-new', 'fulfilled'],
      currentDream: currentState.current,
    };
    const html = renderToStaticMarkup(React.createElement(YearlyRitualView, {
      status: 'ready', eligibility, selectedAction: 'reinforce',
      onSelectAction: noop, onComplete: asyncNoop, onRetry: noop,
    }));

    assert.match(html, /Keep the table open/);
    assert.equal((html.match(/type="radio"/g) ?? []).length, 3);
    assert.match(html, /Reinforce this dream/);
    assert.match(html, /Plant a new dream/);
    assert.match(html, /Mark this dream fulfilled/);
    assert.doesNotMatch(html, /<textarea/);

    const plant = renderToStaticMarkup(React.createElement(YearlyRitualView, {
      status: 'ready', eligibility, selectedAction: 'plant-new',
      onSelectAction: noop, onComplete: asyncNoop, onRetry: noop,
    }));
    assert.match(plant, /<textarea[^>]*name="newDream"/);
  });

  it('explains missing birth data without inventing eligibility and supports retry states', () => {
    const missing: YearlyRitualEligibility = {
      eligible: false, reason: 'birth_profile_missing', birthdayYear: null,
      actions: [], currentDream: null,
    };
    const html = renderToStaticMarkup(React.createElement(YearlyRitualView, {
      status: 'ready', eligibility: missing, selectedAction: 'reinforce',
      onSelectAction: noop, onComplete: asyncNoop, onRetry: noop,
    }));
    const error = renderToStaticMarkup(React.createElement(YearlyRitualView, {
      status: 'error', eligibility: null, selectedAction: 'reinforce',
      error: 'The yearly return could not be opened.',
      onSelectAction: noop, onComplete: asyncNoop, onRetry: noop,
    }));
    assert.match(html, /Birth details are needed to place the yearly return near your birthday/);
    assert.doesNotMatch(html, /type="date"/);
    assert.match(error, /role="alert"/);
    assert.match(error, />Try again<\/button>/);
    const invalid = renderToStaticMarkup(React.createElement(YearlyRitualView, {
      status: 'ready', eligibility: {
        ...missing, reason: 'birth_profile_invalid',
      }, selectedAction: 'reinforce', onSelectAction: noop,
      onComplete: asyncNoop, onRetry: noop,
    }));
    assert.match(invalid, /Birth details need to be corrected before the yearly return can be placed/);
  });

  it('uses authenticated private adapters and keeps the API methods exact', () => {
    const client = readFileSync(
      new URL('../utils/collectorDreams.ts', import.meta.url), 'utf8',
    );
    const dreamsApi = readFileSync(
      new URL('../functions/api/collector/dreams.js', import.meta.url), 'utf8',
    );
    const ritualApi = readFileSync(
      new URL('../functions/api/collector/ritual.js', import.meta.url), 'utf8',
    );
    assert.match(client, /credentials:\s*'include'/);
    assert.match(client, /cache:\s*'no-store'/);
    assert.match(client, /\/api\/collector\/dreams/);
    assert.match(client, /\/api\/collector\/ritual/);
    for (const source of [dreamsApi, ritualApi]) {
      assert.match(source, /requireUser/);
      assert.match(source, /jsonResponse/);
      assert.match(source, /request\.method !== 'GET'.*request\.method !== 'POST'/s);
      assert.doesNotMatch(source, /PUT|PATCH|DELETE/);
    }
    assert.doesNotMatch(`${dreamsApi}\n${ritualApi}`, /R2|lineage|public_payload|approval/i);
  });

  it('keeps the collector typography and language constraints intact', () => {
    const source = [
      'DreamScreen.tsx', 'YearlyRitualScreen.tsx',
    ].map((file) => readFileSync(
      new URL(`../components/collector/legacy/${file}`, import.meta.url), 'utf8',
    )).join('\n');
    assert.doesNotMatch(source, /text-(?:xs|sm)|tracking-\[/);
    assert.doesNotMatch(source, /[\u2014\u{1F300}-\u{1FAFF}]/u);
    assert.doesNotMatch(source, /icon|badge|sticker/i);
  });
});
