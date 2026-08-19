import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import FieldExperience, {
  filterFieldItems,
  flattenFieldData,
  markerPresentation,
  type CollectorFieldData,
} from '../components/collector/legacy/FieldExperience.tsx';

const fixture: CollectorFieldData = {
  schemaVersion: 3,
  generatedAt: '2026-08-09T12:00:00.000Z',
  chainTips: {},
  lights: [
    {
      artworkId: 'UL-001',
      title: 'The Creative',
      series: 'Universal Language',
      year: 2024,
      identity: [
        {
          publicCode: 'AR-CREATIVE',
          editionLabel: 'Original',
          status: 'registered',
          ordinal: 1,
          city: { id: 'denpasar', label: 'Denpasar, Indonesia', country: 'Indonesia', lat: -8.65, lng: 115.22 },
          brightness: 1,
          markerSize: 1,
        },
      ],
    },
    {
      artworkId: 'SIG-014',
      title: 'Amphibian Dream',
      series: 'Signature Works',
      year: 2025,
      identity: [
        {
          publicCode: 'AR-DREAM01',
          editionLabel: 'Unique work',
          status: 'private',
          ordinal: 2,
          city: null,
          brightness: 1,
          markerSize: 1,
        },
      ],
    },
    {
      artworkId: 'PAINT-003',
      title: 'Quiet Current',
      series: null,
      year: null,
      identity: [
        {
          publicCode: null,
          editionLabel: null,
          status: 'unregistered',
          ordinal: null,
          city: null,
          brightness: 0.24,
          markerSize: 1,
        },
      ],
    },
  ],
  facets: {
    series: ['Universal Language', 'Signature Works'],
    years: [2024, 2025],
    places: [
      { id: 'denpasar', label: 'Denpasar' },
      { id: 'santa-cruz', label: 'Santa Cruz' },
    ],
  },
};

describe('collector field browsing', () => {
  it('marks nonmatching lights as receded without removing them', () => {
    const items = flattenFieldData(fixture);
    const filtered = filterFieldItems(items, {
      series: 'Universal Language',
      year: 'all',
      place: 'all',
    });

    assert.equal(filtered.length, items.length);
    assert.deepEqual(filtered.map(({ item, matches }) => [item.key, matches]), [
      ['UL-001::AR-CREATIVE', true],
      ['SIG-014::AR-DREAM01', false],
      ['PAINT-003::catalog-1', false],
    ]);
  });

  it('keeps registered lights equally bright with a neutral marker size', () => {
    const [registered, privateRegistered, unregistered] = flattenFieldData(fixture);
    const first = markerPresentation(registered, true);
    const second = markerPresentation(privateRegistered, true);
    const dim = markerPresentation(unregistered, true);
    const html = renderToStaticMarkup(React.createElement(FieldExperience, {
      status: 'ready', data: fixture, onRetry: () => undefined,
    }));
    const coreFill = (key: string) => new RegExp(
      `data-field-key="${key}"[\\s\\S]*?collector-field__marker-core"[^>]*fill="([^"]+)"`,
    ).exec(html)?.[1];

    assert.equal(first.opacity, second.opacity);
    assert.equal(first.radius, second.radius);
    assert.ok(dim.opacity < first.opacity);
    assert.equal(coreFill(registered.key), coreFill(privateRegistered.key));
  });

  it('renders the same identities in the visual field and accessible list twin', () => {
    const html = renderToStaticMarkup(React.createElement(FieldExperience, {
      status: 'ready',
      data: fixture,
      onRetry: () => undefined,
      initialFilters: { series: 'Universal Language' },
    }));

    for (const item of flattenFieldData(fixture)) {
      const occurrences = html.match(new RegExp(`data-field-key="${item.key}"`, 'g'))?.length ?? 0;
      assert.equal(occurrences, 2, `${item.key} should be in both field and list`);
    }
    assert.match(html, /data-field-match="false"/);
    assert.match(html, /Outside the current lens/);
    assert.match(html, /Founding Light 1/);
    assert.match(html, /<select[^>]*id="[^"]*collector-field-series"/);
    assert.match(html, /href="\/works\/PAINT-003"/);
    assert.doesNotMatch(html, /\/works\/PAINT-003\?instance=/);
    assert.doesNotMatch(html, /Indonesia, Indonesia/);
    assert.match(html, /Catalog work/);
    assert.equal((html.match(/<h[1-6]\b/g) ?? []).length, 1);
  });

  it('uses unique DOM and SVG ids when more than one field is mounted', () => {
    const html = renderToStaticMarkup(React.createElement('div', null,
      React.createElement(FieldExperience, { status: 'ready', data: fixture, onRetry: () => undefined }),
      React.createElement(FieldExperience, { status: 'ready', data: fixture, onRetry: () => undefined }),
    ));
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    const references = [
      ...html.matchAll(/(?:aria-labelledby|aria-describedby)="([^"]+)"/g),
    ].flatMap((match) => match[1].split(/\s+/));
    const paintReferences = [...html.matchAll(/url\(#([^)]+)\)/g)].map((match) => match[1]);

    assert.equal(new Set(ids).size, ids.length);
    for (const reference of [...references, ...paintReferences]) {
      assert.ok(ids.includes(reference), `${reference} should resolve to an id in the same document`);
    }
  });

  it('keeps receded browse links at full text opacity', () => {
    const experience = readFileSync(
      new URL('../components/collector/FieldExperience.tsx', import.meta.url),
      'utf8',
    );
    const recededRule = /\.collector-field__item\[data-field-match="false"\]\s*\{([^}]*)\}/
      .exec(experience)?.[1] ?? '';

    assert.ok(recededRule);
    assert.doesNotMatch(recededRule, /\bopacity\s*:/);
  });

  it('renders loading, empty, and retryable error states', () => {
    const loading = renderToStaticMarkup(React.createElement(FieldExperience, {
      status: 'loading', data: null, onRetry: () => undefined,
    }));
    const empty = renderToStaticMarkup(React.createElement(FieldExperience, {
      status: 'ready', data: { ...fixture, lights: [] }, onRetry: () => undefined,
    }));
    const error = renderToStaticMarkup(React.createElement(FieldExperience, {
      status: 'error', data: null, error: 'The field could not be reached.', onRetry: () => undefined,
    }));

    assert.match(loading, /role="status"/);
    assert.match(loading, /Gathering the field/);
    assert.match(empty, /No works are in the field yet/);
    assert.match(error, /role="alert"/);
    assert.match(error, /The field could not be reached/);
    assert.match(error, />Try again<\/button>/);
  });

  it('keeps catalog and high-latitude markers inside their labeled fields', () => {
    const privateIdentities = Array.from({ length: 173 }, (_, index) => ({
      publicCode: `AR-PRIVATE-${index}`,
      editionLabel: 'Catalog work',
      status: 'unregistered' as const,
      ordinal: null,
      city: null,
      brightness: 0.24 as const,
      markerSize: 1 as const,
    }));
    const html = renderToStaticMarkup(React.createElement(FieldExperience, {
      status: 'ready',
      data: {
        ...fixture,
        lights: [{
          artworkId: 'CATALOG', title: 'Catalog work', series: null, year: null,
          identity: privateIdentities,
        }],
      },
      onRetry: () => undefined,
    }));
    const markerY = [...html.matchAll(/<circle[^>]*cy="([\d.]+)"/g)]
      .map((match) => Number(match[1]));
    const edgeHtml = renderToStaticMarkup(React.createElement(FieldExperience, {
      status: 'ready',
      data: {
        ...fixture,
        lights: [{
          artworkId: 'EDGE', title: 'Northern Edge', series: 'Signature Works', year: 2025,
          identity: [{
            publicCode: 'AR-NORTH01', editionLabel: 'Original', status: 'registered', ordinal: 3,
            city: { id: 'north', label: 'Northern Edge', country: 'Recorded place', lat: 85, lng: 179 },
            brightness: 1, markerSize: 1,
          }],
        }],
      },
      onRetry: () => undefined,
    }));
    const edgeMarker = /collector-field__marker-core" cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/
      .exec(edgeHtml);
    assert.ok(edgeMarker);
    const [, rawX, rawY, rawRadius] = edgeMarker;
    const x = Number(rawX);
    const y = Number(rawY);
    const haloRadius = Number(rawRadius) + 6;
    const ellipseDistance = ((x - 500) / (438 - haloRadius)) ** 2
      + ((y - 215) / (175 - haloRadius)) ** 2;

    assert.ok(Math.max(...markerY) <= 534);
    assert.ok(ellipseDistance <= 1);
  });

  it('makes reduced motion immediately readable without a timed or inert gate', () => {
    const experience = readFileSync(
      new URL('../components/collector/FieldExperience.tsx', import.meta.url),
      'utf8',
    );
    const fieldMap = readFileSync(
      new URL('../components/collector/FieldMap.tsx', import.meta.url),
      'utf8',
    );

    assert.match(experience, /prefers-reduced-motion:\s*reduce/);
    assert.match(experience, /animation:\s*none\s*!important/);
    assert.doesNotMatch(`${experience}\n${fieldMap}`, /setTimeout|\binert\b/);
  });

  it('keeps prohibited atlas and interface language out of the experience', () => {
    const source = [
      'FieldExperience.tsx',
      'FieldMap.tsx',
      'FieldBrowse.tsx',
    ].map((file) => readFileSync(new URL(`../components/collector/${file}`, import.meta.url), 'utf8')).join('\n');

    assert.doesNotMatch(source, /hexagram|support count|visit count|word count/i);
    assert.doesNotMatch(source, /[\u2014\u{1F300}-\u{1FAFF}]/u);
  });
});
