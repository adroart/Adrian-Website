/**
 * The closed letter sweep must not be able to run before someone turns it on.
 *
 * This test used to require a nightly cron. The schedule was removed on
 * purpose: the feature is parked three gates deep, so a nightly run skipped
 * every single time and told nobody anything. The test was never updated to
 * match, so it has failed on main ever since, pinning a decision that had
 * already been reversed. What it guards is unchanged; only the shape of the
 * guard has moved from "runs nightly, gated" to "does not run until asked".
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const workflowUrl = new URL('../.github/workflows/collector-letters.yml', import.meta.url);

describe('collector letter anniversary schedule', () => {
  it('cannot run the closed letter sweep without an explicit rollout switch', () => {
    assert.equal(existsSync(workflowUrl), true, 'collector letter schedule must exist');
    const source = readFileSync(workflowUrl, 'utf8');

    // No timer while the feature is parked, and a hand-run door so it stays
    // reachable when the gates pass.
    assert.doesNotMatch(source, /^\s*schedule:/m);
    assert.match(source, /^\s*workflow_dispatch:/m);

    // Even by hand, it does nothing until the switch and the key exist.
    assert.match(source, /vars\.COLLECTOR_LETTERS_RUNNER_ENABLED\s*==\s*'true'/);
    assert.match(source, /secrets\.COLLECTOR_LETTERS_SERVICE_KEY/);

    assert.match(source, /https:\/\/adrianrasmussen\.com\/api\/collector\/letters-runner/);
    assert.match(source, /X-Collector-Letters-Key:/);
    assert.match(source, /--fail-with-body/);
    assert.doesNotMatch(source, /letters-service-secret|[a-f0-9]{64}/i);
  });

  it('says what it is waiting for, so restoring the timer is not guesswork', () => {
    const source = readFileSync(workflowUrl, 'utf8');
    assert.match(source, /livingLegacy/);
    assert.match(source, /lineage-plate-runbook\.md/);
    assert.match(source, /restore the schedule/);
  });
});
