import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const workflowUrl = new URL('../.github/workflows/collector-letters.yml', import.meta.url);

describe('collector letter anniversary schedule', () => {
  it('runs the closed letter sweep daily only after an explicit rollout switch', () => {
    assert.equal(existsSync(workflowUrl), true, 'collector letter schedule must exist');
    const source = readFileSync(workflowUrl, 'utf8');
    assert.match(source, /schedule:\s*\n\s*- cron:\s*['"]\d+ \d+ \* \* \*['"]/);
    assert.match(source, /vars\.COLLECTOR_LETTERS_RUNNER_ENABLED\s*==\s*'true'/);
    assert.match(source, /secrets\.COLLECTOR_LETTERS_SERVICE_KEY/);
    assert.match(source, /https:\/\/adrianrasmussen\.com\/api\/collector\/letters-runner/);
    assert.match(source, /X-Collector-Letters-Key:/);
    assert.match(source, /--fail-with-body/);
    assert.doesNotMatch(source, /letters-service-secret|[a-f0-9]{64}/i);
  });
});
