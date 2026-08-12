import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type {
  AdminInvitation,
  InvitationCreateAttempt,
} from '../utils/artworkInvitations.ts';

const attemptFor = (keeperPieceId: string): InvitationCreateAttempt => Object.freeze({
  request: Object.freeze({
    keeperPieceId,
    intendedRecipientEmail: 'collector@example.com',
    expiresAt: '2026-08-20T00:00:00.000Z',
    idempotencyKey: `attempt-${keeperPieceId}`,
  }),
});

const invitation = (
  invitationId: string,
  keeperPieceId: string,
  status: AdminInvitation['status'],
): AdminInvitation => ({
  invitationId,
  keeperPieceId,
  intendedRecipientEmail: 'collector@example.com',
  createdAt: '2026-08-11T00:00:00.000Z',
  expiresAt: '2026-08-20T00:00:00.000Z',
  status,
  artwork: {
    artworkId: 'UL-100',
    title: 'An Existing Work',
    publicCode: 'AR-BCDEFGHJ',
    edition: { kind: 'unique' },
  },
});

describe('artwork invitation deep-link state', () => {
  it('discards a frozen create attempt when the URL selects another keeper piece', async () => {
    const screen = await import('../components/admin/ArtworkInvitations.tsx');
    const reconcile = (screen as Record<string, unknown>).reconcileInvitationAttemptForKeeper;

    assert.equal(typeof reconcile, 'function');
    if (typeof reconcile !== 'function') return;

    const attempt = attemptFor('kp-one');
    assert.equal(reconcile(attempt, 'kp-two'), null);
    assert.equal(reconcile(attempt, 'kp-one'), attempt);
    assert.equal(reconcile(attempt, ''), null);
  });

  it('targets the matching available invitation instead of an unavailable history row', async () => {
    const screen = await import('../components/admin/ArtworkInvitations.tsx');
    const findTarget = (screen as Record<string, unknown>).findAvailableInvitationForKeeper;

    assert.equal(typeof findTarget, 'function');
    if (typeof findTarget !== 'function') return;

    const revoked = invitation('invite-revoked', 'kp-one', 'revoked');
    const available = invitation('invite-available', 'kp-one', 'available');
    const other = invitation('invite-other', 'kp-two', 'available');

    assert.equal(findTarget([revoked, other, available], 'kp-one'), available);
    assert.equal(findTarget([revoked, other], 'kp-one'), null);
    assert.equal(findTarget([available], ''), null);
  });
});
