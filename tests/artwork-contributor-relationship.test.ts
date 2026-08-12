import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import { LAUNCH_FLAGS } from '../launchFlags.ts';

let endpoint: (context: any) => Promise<Response>;
const originalFlag = LAUNCH_FLAGS.livingLegacy;

before(async () => {
  mock.module('../functions/api/_lib/auth.js', {
    namedExports: {
      requireUser: async () => ({
        userId: 'contributor-one', email: 'contributor@example.com',
        user: { emailVerified: true },
      }),
    },
  });
  mock.module('../functions/api/_lib/db.js', {
    namedExports: {
      getUserByAuthId: async () => ({ id: 'contributor-one' }),
    },
  });
  endpoint = (await import('../functions/api/keeper/piece.js')).onRequest;
});

after(() => {
  LAUNCH_FLAGS.livingLegacy = originalFlag;
  mock.reset();
});

function database(piece: Record<string, unknown> | null, contributor: boolean) {
  return {
    prepare(sql: string) {
      const statement = {
        bind() { return statement; },
        async first() {
          if (sql.includes('FROM keeper_pieces')) return piece;
          if (sql.includes('artwork_contributor_current_access')) {
            return { is_contributor: contributor ? 1 : 0 };
          }
          return null;
        },
      };
      return statement;
    },
  };
}

describe('private artwork relationship projection', () => {
  it('returns only a contributor boolean to the active contributor', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    const response = await endpoint({
      request: new Request('https://adrianrasmussen.com/api/keeper/piece?publicCode=AR-7KQ9M2WX'),
      env: { DB: database({
        id: 'kp-one', piece_id: 'UL-100', edition_number: 0,
        public_code: 'AR-7KQ9M2WX', keeper_user_id: 'keeper-one',
        current_display_location: 'Private', released_at: null,
      }, true) },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true, kept: true, byYou: false, contributor: true,
    });
  });

  it('does not invent contributor access when no governed piece exists', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    const response = await endpoint({
      request: new Request('https://adrianrasmussen.com/api/keeper/piece?publicCode=AR-7KQ9M2WX'),
      env: { DB: database(null, true) },
    });
    assert.deepEqual(await response.json(), {
      ok: true, kept: false, byYou: false, contributor: false,
    });
  });
});
