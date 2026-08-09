import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, describe, it, mock } from 'node:test';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('artwork invitation client contracts', () => {
  afterEach(() => mock.restoreAll());

  it('inspects by token and redeems without browser-supplied artwork identity', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      if (String(input) === '/api/invitations/inspect') {
        return new Response(JSON.stringify({
          invitationId: 'iv-00000000-0000-4000-8000-000000000001',
          artwork: {
            artworkId: 'SIG-100', title: 'Amphibian Dream', publicCode: 'AR-7KQ9M2WX',
            edition: { kind: 'unique' },
          },
          status: 'available',
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        ok: true,
        keeper: { pieceId: 'SIG-100', editionNumber: 0, claimedAt: '2026-08-10T00:00:00.000Z' },
      }), { status: 200 });
    });

    const { inspectInvitation, redeemInvitation } = await import('../utils/artworkInvitations.ts');
    const token = 'private_invitation_token';
    const inspected = await inspectInvitation(token);
    assert.equal(inspected.status, 'available');
    await redeemInvitation(token);

    assert.equal(requests[0].url, '/api/invitations/inspect');
    assert.equal(requests[0].init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(requests[0].init?.body)), { token });
    assert.equal(requests[0].url.includes(token), false);
    assert.equal(requests[1].url, '/api/invitations/redeem');
    assert.equal(requests[1].init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(requests[1].init?.body)), { token });
    assert.doesNotMatch(String(requests[1].init?.body), /artwork|edition|publicCode|keeperPiece/i);
  });

  it('freezes the exact administrator create attempt and keeps recipient data out of URLs', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      return new Response(JSON.stringify({
        ok: true,
        invitationId: 'iv-00000000-0000-4000-8000-000000000001',
        token: 'one-time-token',
      }), { status: 201 });
    });
    const {
      beginInvitationCreateAttempt,
      createInvitation,
      clearInvitationSecret,
    } = await import('../utils/artworkInvitations.ts');
    const draft = {
      keeperPieceId: 'kp-one',
      intendedRecipientEmail: ' Collector@Example.com ',
      expiresAt: '2026-08-20T00:00:00.000Z',
    };
    const attempt = beginInvitationCreateAttempt(null, draft, () => 'invite-attempt-one');
    draft.intendedRecipientEmail = 'changed@example.com';
    const created = await createInvitation(attempt.request);

    assert.equal(Object.isFrozen(attempt), true);
    assert.equal(Object.isFrozen(attempt.request), true);
    assert.equal(attempt.request.intendedRecipientEmail, 'collector@example.com');
    assert.equal(requests[0].url, '/api/admin/invitations');
    assert.doesNotMatch(requests[0].url, /collector|kp-one|expires/i);
    assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
      keeperPieceId: 'kp-one',
      intendedRecipientEmail: 'collector@example.com',
      expiresAt: '2026-08-20T00:00:00.000Z',
      idempotencyKey: 'invite-attempt-one',
    });
    assert.deepEqual(clearInvitationSecret(created), {
      invitationId: created.invitationId,
      token: null,
    });
  });

  it('keeps plaintext invitation proof out of browser persistence and offers explicit dismissal', () => {
    const door = source('components/collector/InvitationDoor.tsx');
    const admin = source('components/admin/ArtworkInvitations.tsx');
    const clients = source('utils/artworkInvitations.ts');
    for (const contents of [door, admin, clients]) {
      assert.doesNotMatch(contents, /localStorage|sessionStorage|indexedDB/);
      assert.doesNotMatch(contents, /—/);
    }
    assert.match(admin, /Dismiss token/i);
    assert.match(admin, /clearInvitationSecret/);
    assert.match(door, /Invitation token/i);
    assert.match(door, /type="submit"/);
    assert.match(admin, /type="email"/);
    assert.match(admin, /type="datetime-local"/);
  });
});
