import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { CollectorFieldPageView } from '../components/collector/CollectorFieldPage.tsx';

describe('collector field page', () => {
  it('keeps loading and recoverable failure states inside the real page shell', () => {
    const loading = renderToStaticMarkup(React.createElement(CollectorFieldPageView, {
      status: 'loading', data: null, onRetry: () => undefined,
    }));
    const failed = renderToStaticMarkup(React.createElement(CollectorFieldPageView, {
      status: 'error', data: null, error: 'The field could not be reached.',
      onRetry: () => undefined,
    }));

    assert.match(loading, /data-testid="collector-field-page"/);
    assert.match(loading, /Gathering the field/);
    assert.match(failed, /The field could not be reached/);
    assert.match(failed, />Try again</);
  });

  it('keeps the local field behind the living-legacy launch gate', () => {
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
    assert.match(app, /lazy\(\(\) => import\('\.\/components\/collector\/CollectorFieldPage'\)\)/);
    assert.match(
      app,
      /path="\/atlas" element=\{LAUNCH_FLAGS\.livingLegacy \? <CollectorFieldPage\s*\/> : <AtlasExternalRedirect\s*\/>\}/,
    );
  });

  it('links an identified piece to its canonical local field without activity brightness', () => {
    const lens = readFileSync(
      new URL('../components/legacy/PieceConstellation.tsx', import.meta.url),
      'utf8',
    );
    const works = readFileSync(new URL('../components/WorksPage.tsx', import.meta.url), 'utf8');

    assert.match(lens, /fetchCollectorField/);
    assert.match(lens, /publicCode/);
    assert.match(lens, /href="\/atlas"/);
    assert.doesNotMatch(lens, /mandalacodes\.com\/atlas|animate-pulse/);
    assert.match(works, /<PieceConstellation artwork=\{artwork\} publicCode=\{identity\.publicCode\}/);
  });
});
