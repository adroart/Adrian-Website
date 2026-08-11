import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { after, before, beforeEach, describe, it, mock } from 'node:test';

import { LAUNCH_FLAGS } from '../launchFlags.ts';
import type { ContributorRevokeRequest } from '../utils/artworkContributors.ts';

// @ts-expect-error A revoke request must contain exactly one opaque target.
const invalidRevokeContract: ContributorRevokeRequest = {
  action: 'revoke', keeperPieceId: 'kp-one', invitationId: 'aci-invitation',
  accessId: 'aci-access', idempotencyKey: 'exclusive-target',
};
void invalidRevokeContract;

let authCalls = 0;
let authResult: unknown;
let keeperEndpoint: (context: any) => Promise<Response>;
let recipientEndpoint: (context: any) => Promise<Response>;
const originalFlag = LAUNCH_FLAGS.livingLegacy;
const originalFetch = globalThis.fetch;

before(() => {
  mock.module('../functions/api/_lib/auth.js', {
    namedExports: {
      requireUser: async () => {
        authCalls += 1;
        return authResult;
      },
      isSameOrigin: (request: Request) => request.headers.get('Origin') === new URL(request.url).origin,
    },
  });
});

beforeEach(async () => {
  authCalls = 0;
  authResult = {
    userId: 'keeper-one',
    email: 'keeper@example.com',
    user: { id: 'keeper-one', email: 'keeper@example.com', emailVerified: true },
  };
  keeperEndpoint = (await import('../functions/api/keeper/contributors.js')).onRequest;
  recipientEndpoint = (await import('../functions/api/contributor-invitations.js')).onRequest;
});

after(() => {
  LAUNCH_FLAGS.livingLegacy = originalFlag;
  globalThis.fetch = originalFetch;
  mock.reset();
});

function request(path: string, method = 'GET', body?: unknown, query = '') {
  return new Request(`https://adrianrasmussen.com${path}${query}`, {
    method,
    headers: {
      Origin: 'https://adrianrasmussen.com',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const migrations = [
  '001_init.sql', '002_invoices.sql', '003_atlas_legacy.sql', '003_viewings.sql',
  '004_invoice_payment_choice.sql', '004_piece_content.sql', '005_atlas_legacy.sql',
  '005_invoice_amount_paid.sql', '006_better_auth.sql', '007_pricing.sql',
  '008_living_legacy.sql', '009_keeper_register.sql', '010_artwork_plate_identity.sql',
  '011_piece_fulfillments.sql', '012_piece_fulfillment_guards.sql',
  '013_artwork_lineage.sql', '014_artwork_lineage_anchor.sql', '015_registry_artworks.sql',
  '016_keeper_piece_edition_kind_guard.sql', '017_creator_registry_maintenance.sql',
  '018_registry_plate_lifecycle.sql', '019_registry_creator_history.sql',
  '020_registry_recovery_qualification.sql', '021_registry_plate_backup_digest.sql',
  '022_registry_fulfillment_detachment.sql', '023_collector_registry_merge.sql',
  '024_ownership_foundation.sql', '025_artwork_registration.sql',
  '026_artwork_invitations.sql', '027_certificate_templates.sql',
  '028_collector_privacy.sql', '029_collector_dreams.sql', '030_collector_field.sql',
  '031_collector_letters.sql', '032_artist_verified_sales.sql',
  '033_artwork_contributors.sql',
  '034_artwork_contributor_invite_rate_limit.sql',
].map((name) => readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8')).join('\n');

function fixture() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    PRAGMA foreign_keys = ON;
    ${migrations}
    INSERT INTO user (id, name, email, emailVerified, createdAt, updatedAt)
    VALUES
      ('keeper-one', 'Keeper One', 'keeper@example.com', 1, 1, 1),
      ('keeper-other', 'Other Keeper', 'other@example.com', 1, 1, 1),
      ('contributor-one', 'Contributor One', 'contributor@example.com', 1, 1, 1),
      ('contributor-two', 'Contributor Two', 'second@example.com', 1, 1, 1),
      ('contributor-unverified', 'Unverified', 'unverified@example.com', 0, 1, 1),
      ('contributor-ambiguous-a', 'Ambiguous A', 'Twin@Example.com', 1, 1, 1),
      ('contributor-ambiguous-b', 'Ambiguous B', 'twin@example.com', 1, 1, 1);
    INSERT INTO keeper_pieces
      (id, piece_id, edition_number, keeper_user_id, recovery_code_hash,
       claimed_at, registered_at)
    VALUES ('kp-one', 'UL-100', 0, 'keeper-one', '${'a'.repeat(64)}',
      '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');
  `);
  let prepares = 0;
  const DB = {
    prepare(sql: string) {
      prepares += 1;
      let values: SQLInputValue[] = [];
      const statement = {
        bind(...bound: SQLInputValue[]) { values = bound; return statement; },
        first() { return database.prepare(sql).get(...values) ?? null; },
        all() { return { results: database.prepare(sql).all(...values) }; },
        run() {
          const result = database.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      };
      return statement;
    },
  };
  return { database, env: { DB }, prepares: () => prepares };
}

const validInvite = {
  action: 'invite',
  keeperPieceId: 'kp-one',
  intendedRecipientEmail: 'Contributor@Example.com',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  idempotencyKey: 'contributor-invite-one',
};

async function inviteFingerprint(body: typeof validInvite) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([
    'invite', body.keeperPieceId, 'keeper-one', null,
    body.intendedRecipientEmail.trim().toLowerCase(), body.expiresAt,
  ])));
  return Buffer.from(digest).toString('hex');
}

describe('protected artwork contributor API boundary', () => {
  it('provides separate keeper and recipient endpoints plus a typed client contract', () => {
    for (const path of [
      new URL('../functions/api/keeper/contributors.js', import.meta.url),
      new URL('../functions/api/contributor-invitations.js', import.meta.url),
      new URL('../utils/artworkContributors.ts', import.meta.url),
    ]) assert.equal(existsSync(path), true, path.pathname);
  });

  it('keeps both surfaces invisible before method, authentication, or database work', async () => {
    LAUNCH_FLAGS.livingLegacy = false;
    const DB = { prepare: () => assert.fail('database work before launch guard') };
    for (const [endpoint, path] of [
      [keeperEndpoint, '/api/keeper/contributors'],
      [recipientEndpoint, '/api/contributor-invitations'],
    ] as const) {
      const response = await endpoint({ request: request(path, 'PATCH'), env: { DB } });
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { ok: false, error: 'not_found' });
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
    assert.equal(authCalls, 0);
  });

  it('rejects methods before authentication with exact Allow headers', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    const keeper = await keeperEndpoint({
      request: request('/api/keeper/contributors', 'PUT'), env: {},
    });
    assert.equal(keeper.status, 405);
    assert.equal(keeper.headers.get('Allow'), 'GET, POST');
    assert.deepEqual(await keeper.json(), { ok: false, error: 'method_not_allowed' });
    const recipient = await recipientEndpoint({
      request: request('/api/contributor-invitations', 'GET'), env: {},
    });
    assert.equal(recipient.status, 405);
    assert.equal(recipient.headers.get('Allow'), 'POST');
    assert.deepEqual(await recipient.json(), { ok: false, error: 'method_not_allowed' });
    assert.equal(authCalls, 0);
  });

  it('rejects guests, cross-origin mutations, unverified recipients, and missing D1 before business work', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    const target = fixture();
    try {
      authResult = new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
      const before = target.prepares();
      const guest = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', validInvite), env: target.env,
      });
      assert.equal(guest.status, 401);
      assert.equal(target.prepares(), before);

      authResult = {
        userId: 'keeper-one', email: 'keeper@example.com',
        user: { email: 'keeper@example.com', emailVerified: true },
      };
      const crossOriginRequest = request('/api/keeper/contributors', 'POST', validInvite);
      crossOriginRequest.headers.set('Origin', 'https://attacker.example');
      const crossOrigin = await keeperEndpoint({ request: crossOriginRequest, env: target.env });
      assert.equal(crossOrigin.status, 403);
      assert.deepEqual(await crossOrigin.json(), { ok: false, error: 'origin_forbidden' });
      assert.equal(target.prepares(), before);

      authResult = {
        userId: 'contributor-one', email: 'contributor@example.com',
        user: { email: 'contributor@example.com', emailVerified: false },
      };
      const unverified = await recipientEndpoint({
        request: request('/api/contributor-invitations', 'POST', {
          action: 'inspect', token: 'x'.repeat(43),
        }), env: target.env,
      });
      assert.equal(unverified.status, 403);
      assert.deepEqual(await unverified.json(), { ok: false, error: 'verified_email_required' });
      assert.equal(target.prepares(), before);
      assert.equal(unverified.headers.get('Referrer-Policy'), 'no-referrer');

      authResult = {
        userId: 'keeper-one', email: 'keeper@example.com',
        user: { email: 'keeper@example.com', emailVerified: true },
      };
      const missingDb = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'GET', undefined, '?keeperPieceId=kp-one'),
        env: {},
      });
      assert.equal(missingDb.status, 503);
      assert.deepEqual(await missingDb.json(), { ok: false, error: 'contributor_unavailable' });
    } finally { target.database.close(); }
  });

  it('strictly rejects unknown query/body keys and bounded invitation inputs', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    const target = fixture();
    try {
      const badQuery = await keeperEndpoint({
        request: request(
          '/api/keeper/contributors', 'GET', undefined,
          '?keeperPieceId=kp-one&recipientEmail=private%40example.com',
        ),
        env: target.env,
      });
      assert.equal(badQuery.status, 400);
      assert.deepEqual(await badQuery.json(), { ok: false, error: 'invalid_query' });
      const extraBody = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', {
          ...validInvite, keeperUserId: 'forged-keeper',
        }),
        env: target.env,
      });
      assert.equal(extraBody.status, 400);
      assert.deepEqual(await extraBody.json(), { ok: false, error: 'invalid_contributor_request' });
      const longKey = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', {
          ...validInvite, idempotencyKey: 'x'.repeat(129),
        }),
        env: target.env,
      });
      assert.equal(longKey.status, 400);
      assert.deepEqual(await longKey.json(), { ok: false, error: 'invalid_idempotency_key' });
      const tokenInQuery = await recipientEndpoint({
        request: request(
          '/api/contributor-invitations', 'POST',
          { action: 'inspect', token: 'x'.repeat(43) }, '?token=never',
        ),
        env: target.env,
      });
      assert.equal(tokenInQuery.status, 400);
      assert.deepEqual(await tokenInQuery.json(), { ok: false, error: 'invalid_query' });
    } finally { target.database.close(); }
  });

  it('runs invite, exact replay, keeper list, recipient inspect/accept, and access revocation privately', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    const target = fixture();
    try {
      const createdResponse = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', validInvite), env: target.env,
      });
      assert.equal(createdResponse.status, 201);
      const created = await createdResponse.json() as Record<string, unknown>;
      assert.deepEqual(Object.keys(created).sort(), ['invitationId', 'ok', 'status', 'token']);
      assert.equal(created.ok, true);
      assert.equal(created.status, 'created');
      assert.equal(typeof created.token, 'string');
      assert.equal(createdResponse.headers.get('Referrer-Policy'), 'no-referrer');

      await new Promise((resolve) => setTimeout(resolve, 2));
      const replayResponse = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', validInvite), env: target.env,
      });
      assert.equal(replayResponse.status, 200);
      const replay = await replayResponse.json() as Record<string, unknown>;
      assert.deepEqual(Object.keys(replay).sort(), ['invitationId', 'ok', 'status']);
      assert.equal(replay.status, 'replay');

      const listed = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'GET', undefined, '?keeperPieceId=kp-one'),
        env: target.env,
      });
      assert.equal(listed.status, 200);
      const pendingList = await listed.json() as any;
      assert.deepEqual(Object.keys(pendingList.invitations[0]).sort(), [
        'expiresAt', 'invitationId', 'invitedAt', 'recipientEmail', 'status',
      ]);
      assert.equal(pendingList.invitations[0].recipientEmail, 'contributor@example.com');
      assert.doesNotMatch(JSON.stringify(pendingList), /keeper-one|token|hash|fingerprint/i);

      authResult = {
        userId: 'contributor-one', email: 'contributor@example.com',
        user: { email: 'contributor@example.com', emailVerified: true },
      };
      const inspected = await recipientEndpoint({
        request: request('/api/contributor-invitations', 'POST', {
          action: 'inspect', token: created.token,
        }), env: target.env,
      });
      assert.equal(inspected.status, 200);
      const inspection = await inspected.json() as any;
      assert.deepEqual(Object.keys(inspection).sort(), ['artwork', 'invitationId', 'ok', 'status']);
      assert.equal(inspection.status, 'available');
      assert.doesNotMatch(JSON.stringify(inspection), /keeper|recipient|email|token|hash|price|buyer/i);

      const acceptBody = {
        action: 'accept', token: created.token, idempotencyKey: 'contributor-accept-one',
      };
      const accepted = await recipientEndpoint({
        request: request('/api/contributor-invitations', 'POST', acceptBody), env: target.env,
      });
      assert.equal(accepted.status, 200);
      assert.equal((await accepted.json() as any).status, 'accepted');
      await new Promise((resolve) => setTimeout(resolve, 2));
      const acceptReplay = await recipientEndpoint({
        request: request('/api/contributor-invitations', 'POST', acceptBody), env: target.env,
      });
      assert.equal((await acceptReplay.json() as any).status, 'replay');

      authResult = {
        userId: 'keeper-one', email: 'keeper@example.com',
        user: { email: 'keeper@example.com', emailVerified: true },
      };
      const activeResponse = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'GET', undefined, '?keeperPieceId=kp-one'),
        env: target.env,
      });
      const activeList = await activeResponse.json() as any;
      assert.deepEqual(Object.keys(activeList.contributors[0]).sort(), [
        'accessId', 'grantedAt', 'recipientEmail', 'status',
      ]);
      assert.equal(activeList.contributors[0].recipientEmail, 'contributor@example.com');
      assert.doesNotMatch(JSON.stringify(activeList.contributors), /contributor-one/);

      const revoked = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', {
          action: 'revoke', keeperPieceId: 'kp-one', accessId: activeList.contributors[0].accessId,
          idempotencyKey: 'contributor-revoke-one',
        }),
        env: target.env,
      });
      assert.equal(revoked.status, 200);
      assert.equal((await revoked.json() as any).status, 'revoked');
    } finally { target.database.close(); }
  });

  it('keeps wrong-account proof errors opaque and never returns raw database details', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    const target = fixture();
    try {
      const created = await (await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', validInvite), env: target.env,
      })).json() as any;
      authResult = {
        userId: 'contributor-two', email: 'second@example.com',
        user: { email: 'second@example.com', emailVerified: true },
      };
      const wrong = await recipientEndpoint({
        request: request('/api/contributor-invitations', 'POST', {
          action: 'inspect', token: created.token,
        }), env: target.env,
      });
      assert.equal(wrong.status, 404);
      assert.deepEqual(await wrong.json(), {
        ok: false, error: 'contributor_invitation_not_available',
      });

      authResult = {
        userId: 'keeper-other', email: 'other@example.com',
        user: { email: 'other@example.com', emailVerified: true },
      };
      const forbidden = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'GET', undefined, '?keeperPieceId=kp-one'),
        env: target.env,
      });
      assert.equal(forbidden.status, 403);
      assert.deepEqual(await forbidden.json(), { ok: false, error: 'keeper_authority_required' });
    } finally { target.database.close(); }

    authResult = {
      userId: 'keeper-one', email: 'keeper@example.com',
      user: { email: 'keeper@example.com', emailVerified: true },
    };
    const rawFailure = await keeperEndpoint({
      request: request('/api/keeper/contributors', 'GET', undefined, '?keeperPieceId=kp-one'),
      env: { DB: { prepare: () => { throw new Error('SQLITE_PRIVATE_TABLE token_hash'); } } },
    });
    assert.equal(rawFailure.status, 500);
    assert.deepEqual(await rawFailure.json(), {
      ok: false, error: 'contributor_request_failed',
    });
  });

  it('returns one stable recipient-unavailable projection for every account state', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    const outcomes = [];
    for (const [index, email] of [
      'missing@example.com',
      'unverified@example.com',
      'twin@example.com',
    ].entries()) {
      const target = fixture();
      try {
        const response = await keeperEndpoint({
          request: request('/api/keeper/contributors', 'POST', {
            ...validInvite,
            intendedRecipientEmail: email,
            idempotencyKey: `opaque-recipient-${index}`,
          }),
          env: target.env,
        });
        outcomes.push({
          status: response.status,
          databaseStatements: target.prepares(),
          headers: [...response.headers.entries()].sort(),
          body: await response.json(),
        });
        assert.equal(target.database.prepare(
          'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
        ).get().n, 0);
      } finally { target.database.close(); }
    }
    assert.deepEqual(outcomes, Array.from({ length: 3 }, () => ({
      status: 409,
      databaseStatements: 8,
      headers: [
        ['cache-control', 'no-store'],
        ['content-type', 'application/json'],
      ],
      body: { ok: false, error: 'contributor_recipient_not_available' },
    })));
  });

  it('rate limits across recipient and key changes without mutating invitations or returning a token', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    const target = fixture();
    try {
      for (let index = 0; index < 10; index += 1) {
        const response = await keeperEndpoint({
          request: request('/api/keeper/contributors', 'POST', {
            ...validInvite,
            intendedRecipientEmail: `route-missing-${index}@example.com`,
            idempotencyKey: `route-missing-key-${index}`,
          }),
          env: target.env,
        });
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), {
          ok: false, error: 'contributor_recipient_not_available',
        });
      }
      const rejected = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', {
          ...validInvite,
          intendedRecipientEmail: 'second@example.com',
          idempotencyKey: 'route-different-recipient-and-key',
        }),
        env: target.env,
      });
      assert.equal(rejected.status, 429);
      const rejectedBody = await rejected.json();
      assert.deepEqual(rejectedBody, {
        ok: false, error: 'contributor_invite_rate_limited',
      });
      assert.match(rejected.headers.get('Retry-After') || '', /^([1-9]|[1-9][0-9]{1,2}|[1-2][0-9]{3}|3[0-5][0-9]{2}|3600)$/);
      assert.equal(target.database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
      ).get().n, 0);
      assert.equal(JSON.stringify(rejectedBody).includes('token'), false);
    } finally { target.database.close(); }
  });

  it('uses one saturated-bucket path for valid and unavailable recipient account states', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    const statementCounts = [];
    for (const [index, email] of [
      'contributor@example.com',
      'missing@example.com',
      'unverified@example.com',
      'twin@example.com',
    ].entries()) {
      const target = fixture();
      try {
        const now = new Date().toISOString();
        target.database.prepare(
          `INSERT INTO artwork_contributor_invite_rate_limits
             (keeper_user_id, window_started_at, attempt_count, last_attempt_at)
           VALUES (?1, ?2, 10, ?3)`,
        ).run('keeper-one', `${now.slice(0, 13)}:00:00.000Z`, now);
        const before = target.prepares();
        const response = await keeperEndpoint({
          request: request('/api/keeper/contributors', 'POST', {
            ...validInvite,
            intendedRecipientEmail: email,
            idempotencyKey: `saturated-account-state-${index}`,
          }),
          env: target.env,
        });
        statementCounts.push(target.prepares() - before);
        assert.equal(response.status, 429);
        const body = await response.json();
        assert.deepEqual(body, {
          ok: false, error: 'contributor_invite_rate_limited',
        });
        assert.equal(JSON.stringify(body).includes('token'), false);
        assert.equal(target.database.prepare(
          'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
        ).get().n, 0);
        assert.equal(target.database.prepare(
          'SELECT attempt_count FROM artwork_contributor_invite_rate_limits',
        ).get().attempt_count, 10);
      } finally { target.database.close(); }
    }
    assert.deepEqual(statementCounts, [5, 5, 5, 5]);
  });

  it('projects an active exact reservation as stable retryable token-free in-progress', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    const target = fixture();
    try {
      const now = new Date();
      target.database.prepare(
        `INSERT INTO artwork_contributor_invite_reservations
          (idempotency_key, request_fingerprint, keeper_user_id, lease_generation,
           reservation_status, reserved_at, lease_expires_at)
         VALUES (?, ?, 'keeper-one', 1, 'reserved', ?, ?)`,
      ).run(
        validInvite.idempotencyKey,
        await inviteFingerprint(validInvite),
        now.toISOString(),
        new Date(now.getTime() + 30_000).toISOString(),
      );
      const before = target.prepares();
      const response = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', validInvite), env: target.env,
      });
      assert.equal(response.status, 409);
      const body = await response.json();
      assert.deepEqual(body, { ok: false, error: 'contributor_invite_in_progress' });
      assert.match(response.headers.get('Retry-After') || '', /^(?:[1-9]|[12][0-9]|30)$/);
      assert.equal(JSON.stringify(body).includes('token'), false);
      assert.equal(target.prepares() - before, 5);
      assert.equal(target.database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_invitations',
      ).get().n, 0);
      assert.equal(target.database.prepare(
        'SELECT COUNT(*) AS n FROM artwork_contributor_invite_rate_limits',
      ).get().n, 0);
    } finally { target.database.close(); }
  });

  it('replays an exact successful invite after the bucket fills without consuming it again', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    const target = fixture();
    try {
      const createdResponse = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', validInvite), env: target.env,
      });
      const created = await createdResponse.json() as any;
      assert.equal(createdResponse.status, 201);
      for (let index = 1; index < 10; index += 1) {
        const unavailable = await keeperEndpoint({
          request: request('/api/keeper/contributors', 'POST', {
            ...validInvite,
            intendedRecipientEmail: `replay-route-${index}@example.com`,
            idempotencyKey: `replay-route-key-${index}`,
          }),
          env: target.env,
        });
        assert.equal(unavailable.status, 409);
      }
      const replay = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', validInvite), env: target.env,
      });
      assert.equal(replay.status, 200);
      assert.deepEqual(await replay.json(), {
        ok: true, invitationId: created.invitationId, status: 'replay',
      });
      assert.equal(target.database.prepare(
        'SELECT attempt_count FROM artwork_contributor_invite_rate_limits',
      ).get().attempt_count, 10);
    } finally { target.database.close(); }
  });

  it('maps idempotency conflicts and pending revocation to stable token-free responses', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    const target = fixture();
    try {
      const created = await (await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', validInvite), env: target.env,
      })).json() as any;
      const conflict = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', {
          ...validInvite, intendedRecipientEmail: 'second@example.com',
        }), env: target.env,
      });
      assert.equal(conflict.status, 409);
      assert.deepEqual(await conflict.json(), {
        ok: false, error: 'contributor_idempotency_conflict',
      });
      const revoked = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', {
          action: 'revoke', keeperPieceId: 'kp-one', invitationId: created.invitationId,
          idempotencyKey: 'revoke-pending-one',
        }), env: target.env,
      });
      assert.equal(revoked.status, 200);
      const revokedBody = await revoked.json() as any;
      assert.deepEqual(Object.keys(revokedBody).sort(), ['invitationId', 'ok', 'status']);
      assert.equal(revokedBody.status, 'revoked');
      await new Promise((resolve) => setTimeout(resolve, 2));
      const replay = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', {
          action: 'revoke', keeperPieceId: 'kp-one', invitationId: created.invitationId,
          idempotencyKey: 'revoke-pending-one',
        }), env: target.env,
      });
      assert.equal((await replay.json() as any).status, 'replay');
    } finally { target.database.close(); }
  });

  it('bounds first-use expiry while preserving opaque wrong-email proof rejection', async () => {
    LAUNCH_FLAGS.livingLegacy = true;
    const target = fixture();
    try {
      const tooLong = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000).toISOString();
      const bounded = await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', {
          ...validInvite, expiresAt: tooLong,
        }), env: target.env,
      });
      assert.equal(bounded.status, 400);
      assert.deepEqual(await bounded.json(), {
        ok: false, error: 'invalid_contributor_expiry',
      });
      const created = await (await keeperEndpoint({
        request: request('/api/keeper/contributors', 'POST', validInvite), env: target.env,
      })).json() as any;
      authResult = {
        userId: 'contributor-one', email: 'second@example.com',
        user: { email: 'second@example.com', emailVerified: true },
      };
      const wrongEmail = await recipientEndpoint({
        request: request('/api/contributor-invitations', 'POST', {
          action: 'inspect', token: created.token,
        }), env: target.env,
      });
      assert.equal(wrongEmail.status, 404);
      assert.deepEqual(await wrongEmail.json(), {
        ok: false, error: 'contributor_invitation_not_available',
      });
    } finally { target.database.close(); }
  });

  it('freezes one normalized idempotent attempt for every ambiguous mutation', async () => {
    const client = await import('../utils/artworkContributors.ts') as any;
    for (const name of [
      'beginContributorInviteAttempt',
      'beginContributorRevokeAttempt',
      'beginContributorAcceptAttempt',
    ]) assert.equal(typeof client[name], 'function', name);
    const invite = client.beginContributorInviteAttempt(null, {
      keeperPieceId: ' kp-one ',
      intendedRecipientEmail: ' Contributor@Example.com ',
      expiresAt: '2026-08-20T10:00:00.000Z',
    }, () => 'invite-attempt-one');
    assert.deepEqual(invite.request, {
      action: 'invite', keeperPieceId: 'kp-one',
      intendedRecipientEmail: 'contributor@example.com',
      expiresAt: '2026-08-20T10:00:00.000Z', idempotencyKey: 'invite-attempt-one',
    });
    assert.equal(Object.isFrozen(invite), true);
    assert.equal(Object.isFrozen(invite.request), true);
    assert.equal(client.beginContributorInviteAttempt(invite, {
      keeperPieceId: 'changed', intendedRecipientEmail: 'changed@example.com',
      expiresAt: '2026-08-21T10:00:00.000Z',
    }, () => 'different-key'), invite);

    const revoke = client.beginContributorRevokeAttempt(null, {
      keeperPieceId: 'kp-one', accessId: 'aci-safe-access',
    }, () => 'revoke-attempt-one');
    assert.deepEqual(revoke.request, {
      action: 'revoke', keeperPieceId: 'kp-one', accessId: 'aci-safe-access',
      idempotencyKey: 'revoke-attempt-one',
    });
    const accept = client.beginContributorAcceptAttempt(null, {
      token: ' proof-is-memory-only ',
    }, () => 'accept-attempt-one');
    assert.deepEqual(accept.request, {
      action: 'accept', token: 'proof-is-memory-only',
      idempotencyKey: 'accept-attempt-one',
    });
  });

  it('uses credentialed no-store requests, keeps proofs in JSON bodies, and parses allowlisted responses', async () => {
    const client = await import('../utils/artworkContributors.ts') as any;
    for (const name of [
      'loadArtworkContributors', 'createArtworkContributorInvitation',
      'inspectArtworkContributorInvitation', 'acceptArtworkContributorInvitation',
      'revokeArtworkContributor', 'clearContributorInvitationToken',
    ]) assert.equal(typeof client[name], 'function', name);
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const responses = [
      { ok: true, invitations: [], contributors: [] },
      { ok: true, invitationId: 'aci-one', status: 'created', token: 'secret-proof' },
      {
        ok: true, invitationId: 'aci-one', status: 'available',
        artwork: { artworkId: 'UL-100', publicCode: null, edition: { kind: 'unique' } },
      },
      { ok: true, invitationId: 'aci-one', status: 'accepted' },
      { ok: true, invitationId: 'aci-one', status: 'revoked' },
    ];
    globalThis.fetch = async (input, init) => {
      calls.push([input, init]);
      return new Response(JSON.stringify(responses.shift()), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    };
    const listed = await client.loadArtworkContributors('kp-one');
    assert.deepEqual(listed, { invitations: [], contributors: [] });
    const created = await client.createArtworkContributorInvitation({
      action: 'invite', keeperPieceId: 'kp-one', intendedRecipientEmail: 'to@example.com',
      expiresAt: '2026-08-20T10:00:00.000Z', idempotencyKey: 'invite-attempt-one',
    });
    assert.equal(created.token, 'secret-proof');
    assert.deepEqual(client.clearContributorInvitationToken(created), {
      invitationId: 'aci-one', status: 'created', token: null,
    });
    await client.inspectArtworkContributorInvitation('secret-proof');
    await client.acceptArtworkContributorInvitation({
      action: 'accept', token: 'secret-proof', idempotencyKey: 'accept-attempt-one',
    });
    await client.revokeArtworkContributor({
      action: 'revoke', keeperPieceId: 'kp-one', accessId: 'aci-one',
      idempotencyKey: 'revoke-attempt-one',
    });
    for (const [url, init] of calls) {
      assert.equal(init?.credentials, 'include');
      assert.equal(init?.cache, 'no-store');
      assert.doesNotMatch(String(url), /secret-proof|token=/);
    }
    assert.equal(calls[0][0], '/api/keeper/contributors?keeperPieceId=kp-one');
    assert.equal(calls[2][0], '/api/contributor-invitations');
    assert.deepEqual(JSON.parse(String(calls[2][1]?.body)), {
      action: 'inspect', token: 'secret-proof',
    });
  });

  it('fails closed on extra private response fields and contains no proof persistence sink', async () => {
    const client = await import('../utils/artworkContributors.ts') as any;
    assert.equal(typeof client.inspectArtworkContributorInvitation, 'function');
    globalThis.fetch = async () => new Response(JSON.stringify({
      ok: true, invitationId: 'aci-one', status: 'available', keeperUserId: 'private',
      artwork: { artworkId: 'UL-100', publicCode: null, edition: { kind: 'unique' } },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    await assert.rejects(
      client.inspectArtworkContributorInvitation('secret-proof'),
      (error: Error & { code?: string }) => error.code === 'invalid_contributor_response',
    );
    const source = readFileSync(
      new URL('../utils/artworkContributors.ts', import.meta.url), 'utf8',
    );
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|URLSearchParams/);
  });

  it('rejects normalized impossible response timestamps', async () => {
    const client = await import('../utils/artworkContributors.ts') as any;
    globalThis.fetch = async () => new Response(JSON.stringify({
      ok: true,
      invitations: [{
        invitationId: 'aci-one', recipientEmail: 'to@example.com',
        invitedAt: '2026-02-31T00:00:00.000Z', expiresAt: '2026-03-10T00:00:00.000Z',
        status: 'available',
      }],
      contributors: [],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    await assert.rejects(
      client.loadArtworkContributors('kp-one'),
      (error: Error & { code?: string }) => error.code === 'invalid_contributor_response',
    );
  });
});
