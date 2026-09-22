import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/* Every Playwright spec takes `test` from tests/fixtures.ts, which answers all
   production media requests locally. A spec that imports '@playwright/test'
   directly bypasses that and spends metered R2 operations. */
describe('Playwright specs stay off production media', () => {
  const dir = new URL('./', import.meta.url);

  it('every spec imports test from the shared fixtures, never from @playwright/test', () => {
    const specs = readdirSync(dir).filter((f) => f.endsWith('.spec.ts'));
    assert.ok(specs.length > 0);
    const offenders = specs.filter((f) =>
      /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*'@playwright\/test'/.test(readFileSync(new URL(f, dir), 'utf8')),
    );
    assert.deepEqual(offenders, []);
  });

  it('the fixture answers /media itself', () => {
    const source = readFileSync(new URL('fixtures.ts', dir), 'utf8');
    assert.ok(source.includes('\\/media\\/'));
    assert.ok(source.includes('route.fulfill'));
  });
});
