import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { onRequest as dreamRequest } from '../functions/api/collector/dreams.js';
import { onRequest as publicDreamRequest } from '../functions/api/collector/dreams/public/[publicCode].js';
import { onRequest as lettersRequest } from '../functions/api/collector/letters.js';
import { onRequest as lettersRunnerRequest } from '../functions/api/collector/letters-runner.js';
import { onRequest as ritualRequest } from '../functions/api/collector/ritual.js';
import { LAUNCH_FLAGS } from '../launchFlags.ts';

const originalLegacyFlag = LAUNCH_FLAGS.livingLegacy;

after(() => {
  LAUNCH_FLAGS.livingLegacy = originalLegacyFlag;
});

type Endpoint = (context: {
  request: Request;
  env: Record<string, unknown>;
  params?: Record<string, string>;
}) => Promise<Response>;

const cases: Array<{
  name: string;
  endpoint: Endpoint;
  url: string;
  params?: Record<string, string>;
  enabledMethodStatus: number;
}> = [
  {
    name: 'dreams',
    endpoint: dreamRequest,
    url: 'https://adrianrasmussen.com/api/collector/dreams',
    enabledMethodStatus: 401,
  },
  {
    name: 'yearly ritual',
    endpoint: ritualRequest,
    url: 'https://adrianrasmussen.com/api/collector/ritual',
    enabledMethodStatus: 401,
  },
  {
    name: 'letters',
    endpoint: lettersRequest,
    url: 'https://adrianrasmussen.com/api/collector/letters',
    enabledMethodStatus: 503,
  },
  {
    name: 'public dreams',
    endpoint: publicDreamRequest,
    url: 'https://adrianrasmussen.com/api/collector/dreams/public/AR-ABCDEFGH',
    params: { publicCode: 'AR-ABCDEFGH' },
    enabledMethodStatus: 503,
  },
];

const lettersRunner = {
  name: 'letters runner',
  endpoint: lettersRunnerRequest as Endpoint,
  url: 'https://adrianrasmussen.com/api/collector/letters-runner',
  params: undefined,
};

describe('collector phase two launch boundary', () => {
  it('keeps every ceremony endpoint hidden for every method while Living Legacy is off', async () => {
    LAUNCH_FLAGS.livingLegacy = false;

    for (const candidate of [...cases, lettersRunner]) {
      for (const method of ['GET', 'POST', 'DELETE']) {
        const response = await candidate.endpoint({
          request: new Request(candidate.url, { method }),
          env: {},
          params: candidate.params,
        });
        assert.equal(response.status, 404, `${candidate.name} ${method}`);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.deepEqual(await response.json(), { ok: false, error: 'not_found' });
      }
    }
  });

  it('preserves each endpoint method contract when Living Legacy is on', async () => {
    LAUNCH_FLAGS.livingLegacy = true;

    for (const candidate of cases.slice(0, 3)) {
      const getResponse = await candidate.endpoint({
        request: new Request(candidate.url),
        env: {},
        params: candidate.params,
      });
      const postResponse = await candidate.endpoint({
        request: new Request(candidate.url, { method: 'POST' }),
        env: {},
        params: candidate.params,
      });
      const unsupportedResponse = await candidate.endpoint({
        request: new Request(candidate.url, { method: 'DELETE' }),
        env: {},
        params: candidate.params,
      });

      assert.equal(
        getResponse.status,
        candidate.enabledMethodStatus,
        `${candidate.name} GET exits the launch guard`,
      );
      assert.equal(
        postResponse.status,
        candidate.enabledMethodStatus,
        `${candidate.name} POST exits the launch guard`,
      );
      assert.equal(unsupportedResponse.status, 405, `${candidate.name} rejects DELETE`);
      assert.equal(unsupportedResponse.headers.get('Allow'), 'GET, POST');
    }

    const publicGet = await publicDreamRequest({
      request: new Request(cases[3].url),
      env: {},
      params: cases[3].params,
    });
    const publicPost = await publicDreamRequest({
      request: new Request(cases[3].url, { method: 'POST' }),
      env: {},
      params: cases[3].params,
    });
    assert.equal(publicGet.status, cases[3].enabledMethodStatus);
    assert.equal(publicPost.status, 405);
    assert.equal(publicPost.headers.get('Allow'), 'GET');

    const runnerPost = await lettersRunnerRequest({
      request: new Request(lettersRunner.url, { method: 'POST' }),
      env: {},
    });
    const runnerGet = await lettersRunnerRequest({
      request: new Request(lettersRunner.url),
      env: {},
    });
    assert.equal(runnerPost.status, 503);
    assert.equal(runnerGet.status, 405);
    assert.equal(runnerGet.headers.get('Allow'), 'POST');
  });
});
