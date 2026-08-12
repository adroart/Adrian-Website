import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('artwork contributor account and keeper UI', () => {
  it('adds a launch-gated account access route without placing proof in navigation state', () => {
    assert.equal(
      existsSync(new URL('../components/account/ContributorAccess.tsx', import.meta.url)),
      true,
    );
    const app = source('App.tsx');
    const layout = source('components/account/AccountLayout.tsx');
    const dashboard = source('components/AccountDashboard.tsx');
    assert.match(app, /path="\/account\/contributor-access"/);
    assert.match(app, /LAUNCH_FLAGS\.livingLegacy/);
    assert.match(layout, /Contributor access/);
    assert.match(dashboard, /Contributor access/);
    assert.doesNotMatch(`${app}\n${layout}\n${dashboard}`, /[?&](?:token|proof)=/i);
  });

  it('keeps invitation proof memory-only and clears it at every account boundary', () => {
    const account = source('components/account/ContributorAccess.tsx');
    assert.match(account, /beginContributorAcceptAttempt/);
    assert.match(account, /disabled=\{Boolean\(busy\)\}/);
    assert.match(account, /AbortController/);
    assert.match(account, /userId/);
    assert.match(account, /proofUserId === userId/);
    assert.match(account, /setToken\(['"]['"]\)/);
    assert.match(account, /setInspection\(null\)/);
    assert.doesNotMatch(account, /localStorage|sessionStorage|URLSearchParams|console\./);
  });

  it('preserves only ambiguous mutation attempts for exact retry', async () => {
    const client = await import('../utils/artworkContributors.ts') as any;
    assert.equal(typeof client.isContributorMutationOutcomeAmbiguous, 'function');
    assert.equal(client.isContributorMutationOutcomeAmbiguous(
      new client.ArtworkContributorRequestError(0, 'contributor_network_error'),
    ), true);
    assert.equal(client.isContributorMutationOutcomeAmbiguous(
      new client.ArtworkContributorRequestError(502, 'invalid_contributor_response'),
    ), true);
    assert.equal(client.isContributorMutationOutcomeAmbiguous(
      new client.ArtworkContributorRequestError(409, 'contributor_idempotency_conflict'),
    ), false);
  });

  it('shows exact safe artwork identity and every server proof status', () => {
    const account = source('components/account/ContributorAccess.tsx');
    for (const value of [
      'artworkId', 'publicCode', 'Unique work', 'Number ',
      'available', 'used', 'expired', 'revoked', 'already_active', 'claim_pending',
    ]) assert.match(account, new RegExp(value));
    assert.match(account, /aria-live="polite"/);
    assert.match(account, /role="alert"/);
  });

  it('gives the current keeper a private, retryable contributor manager', () => {
    const panel = source('components/legacy/KeeperPanel.tsx');
    assert.match(panel, /ContributorManagement/);
    assert.match(panel, /loadArtworkContributors/);
    assert.match(panel, /beginContributorInviteAttempt/);
    assert.match(panel, /beginContributorRevokeAttempt/);
    assert.match(panel, /clearContributorInvitationToken/);
    assert.match(panel, /recipientEmail/);
    assert.match(panel, /expiresAt/);
    assert.match(panel, /Dismiss/);
    assert.match(panel, /Try again/);
  });

  it('projects the contributor relationship without exposing contributor identity', () => {
    const endpoint = source('functions/api/keeper/piece.js');
    assert.match(endpoint, /contributor/);
    assert.match(endpoint, /artwork_contributor_current_access/);
    assert.match(endpoint, /contributor_user_id/);
    assert.doesNotMatch(endpoint, /contributorEmail|contributorUserId/);
  });

  it('shows a contributor relationship without keeper-only controls', () => {
    const panel = source('components/legacy/KeeperPanel.tsx');
    assert.match(panel, /You are a contributor to this artwork/);
    assert.match(panel, /\/account\/contributor-access/);
    assert.match(panel, /Contributors are not keepers/);
    assert.match(panel, /currentStatus\?\.contributor/);
    assert.match(panel, /status\?\.byYou \|\| status\?\.contributor/);
    assert.match(panel, /setInterval/);
  });

  it('keeps contributor controls readable, keyboard complete, and free of prohibited styling', () => {
    const ui = [
      source('components/account/ContributorAccess.tsx'),
      source('components/legacy/KeeperPanel.tsx'),
    ].join('\n');
    assert.match(ui, /text-\[16px\]|text-base/);
    assert.match(ui, /min-h-11/);
    assert.match(ui, /focus-visible:/);
    assert.doesNotMatch(ui, /[\u2014\u{1F300}-\u{1FAFF}]/u);
    assert.match(source('components/account/AccountLayout.tsx'), /min-h-11/);
    assert.match(source('components/account/ContributorAccess.tsx'), /acceptedPath/);
    assert.match(source('components/legacy/KeeperPanel.tsx'), /revokeConfirm/);
  });
});
