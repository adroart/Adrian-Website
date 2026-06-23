import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  generateRecoveryCode,
  normalizeRecoveryCode,
  hashRecoveryCode,
  isWellFormedRecoveryCode,
} from '../utils/recoveryCode';
import {
  birthdayWindowState,
  canSetMotivation,
  canConfirmMotivation,
  intentionState,
  projectIntention,
  computeContentHash,
  generateSaltHex,
  parseIntentionInput,
  CONFIRM_GRACE_MS,
  BIRTHDAY_WINDOW_DAYS,
  IntentionRow,
} from '../utils/intentions';

import {
  buildClaimBridgePayload,
  requestContestedClaim,
  CLAIM_REQUEST_NOTE_MAX,
} from '../functions/api/_lib/claimBridge.js';

// The contested-claim handoff opens a request on mandalacodes' SINGLE shared
// store, then leans on the escalation logic merged there. These pure modules
// are the contract Adrian-Website depends on; we import them across the repo
// boundary to lock that contract (skips cleanly if the sister repo is absent).
import {
  planClaimRequest,
  MAX_OPEN_REQUESTS_PER_REQUESTER,
} from '../../mandalacodes/utils/claimRequests.ts';
import {
  evaluateClaimWindow,
  CLAIM_WINDOW_DAYS,
  CLAIM_WARNING_DAYS,
} from '../../mandalacodes/utils/claimWindow.ts';

// ── Recovery code ──────────────────────────────────────────────────────────

describe('recovery code', () => {
  it('generates a well-formed, grouped code from the safe alphabet', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRecoveryCode();
      assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      assert.ok(isWellFormedRecoveryCode(code));
      // No ambiguous glyphs (O, 0, I, 1) ever appear.
      assert.ok(!/[OI01]/.test(code));
    }
  });

  it('normalizes spacing, case, and hyphens to a single canonical form', () => {
    assert.equal(normalizeRecoveryCode('k7qm-9xtr-2phv-n4wb'), 'K7QM9XTR2PHVN4WB');
    assert.equal(normalizeRecoveryCode('K7QM 9XTR 2PHV N4WB'), 'K7QM9XTR2PHVN4WB');
    assert.equal(normalizeRecoveryCode('K7QM-9XTR2PHV-N4WB'), 'K7QM9XTR2PHVN4WB');
  });

  it('hashes the normalized form, so grouping is cosmetic', async () => {
    const a = await hashRecoveryCode('K7QM-9XTR-2PHV-N4WB');
    const b = await hashRecoveryCode('k7qm 9xtr2phv-n4wb');
    assert.equal(a, b);
    assert.match(a, /^[0-9a-f]{64}$/);
  });

  it('matches the worked-example hash committed in the QR registry', async () => {
    // The example plaintext lives only in the migration/doc note; the repo
    // stores only this hash. This pins the two in sync.
    const hash = await hashRecoveryCode('WORK-EDEX-AMPL-E000');
    assert.equal(
      hash,
      '4f7f0287d2909b11da94d68e90524cf37f5b93cbc77ebd28a1ab701a27d12c62',
    );
  });

  it('rejects malformed codes', () => {
    assert.equal(isWellFormedRecoveryCode('SHORT'), false);
    assert.equal(isWellFormedRecoveryCode('K7QM-9XTR-2PHV-N4W'), false); // 15 chars
    assert.equal(isWellFormedRecoveryCode('K0QM-9XTR-2PHV-N4WB'), false); // contains 0
  });
});

// ── Salted commitment (erasure-safe, matches mandalacodes) ──────────────────

describe('salted content commitment', () => {
  it('binds salt + body and is unrecomputable without the salt', async () => {
    const salt = generateSaltHex();
    assert.match(salt, /^[0-9a-f]{32}$/);
    const body = 'May this year deepen my patience.';
    const hash = await computeContentHash(salt, body);
    assert.match(hash, /^[0-9a-f]{64}$/);
    // Same salt + body → same commitment (deterministic).
    assert.equal(await computeContentHash(salt, body), hash);
    // Different salt → different commitment (erasure: drop salt, lose the link).
    assert.notEqual(await computeContentHash(generateSaltHex(), body), hash);
  });
});

// ── Birthday window gate ────────────────────────────────────────────────────

describe('birthday window', () => {
  it('opens within the window on either side of the birthday', () => {
    // Birthday June 23. Window is BIRTHDAY_WINDOW_DAYS (7) on each side.
    const onDay = birthdayWindowState('06-23', '2026-06-23T12:00:00Z');
    assert.equal(onDay.open, true);
    assert.equal(onDay.distanceDays, 0);

    const before = birthdayWindowState('06-23', '2026-06-17T00:00:00Z');
    assert.equal(before.open, true);
    assert.equal(before.distanceDays, 6);

    const after = birthdayWindowState('06-23', '2026-06-30T00:00:00Z');
    assert.equal(after.open, true);
    assert.equal(after.distanceDays, 7);
  });

  it('is closed outside the window', () => {
    const far = birthdayWindowState('06-23', '2026-09-01T00:00:00Z');
    assert.equal(far.open, false);
    const justOut = birthdayWindowState('06-23', '2026-07-01T00:00:00Z');
    assert.equal(justOut.open, false);
    assert.equal(justOut.distanceDays, BIRTHDAY_WINDOW_DAYS + 1);
  });

  it('handles the year wrap (Dec/Jan) by shortest distance', () => {
    const wrap = birthdayWindowState('12-31', '2027-01-03T00:00:00Z');
    assert.equal(wrap.distanceDays, 3);
    assert.equal(wrap.open, true);
  });

  it('fails closed on a missing or malformed birthday', () => {
    assert.equal(birthdayWindowState(null, '2026-06-23T00:00:00Z').open, false);
    assert.equal(birthdayWindowState('garbage', '2026-06-23T00:00:00Z').open, false);
    assert.equal(birthdayWindowState('13-40', '2026-06-23T00:00:00Z').open, false);
  });
});

// ── canSetMotivation gate ───────────────────────────────────────────────────

describe('canSetMotivation', () => {
  const open = { open: true, distanceDays: 0 };
  const closed = { open: false, distanceDays: 100 };

  it('allows a first motivation inside the window', () => {
    const d = canSetMotivation({ lockedYears: [], birthday: open, year: 2026 });
    assert.equal(d.ok, true);
  });

  it('blocks when the birthday window is closed', () => {
    const d = canSetMotivation({ lockedYears: [], birthday: closed, year: 2026 });
    assert.equal(d.ok, false);
    assert.equal(d.reason, 'birthday_window_closed');
  });

  it('blocks a second motivation in the same year, allows a new year', () => {
    const same = canSetMotivation({ lockedYears: [2026], birthday: open, year: 2026 });
    assert.equal(same.ok, false);
    assert.equal(same.reason, 'already_locked_this_year');

    const next = canSetMotivation({ lockedYears: [2026], birthday: open, year: 2027 });
    assert.equal(next.ok, true);
  });
});

// ── Confirm-lock state machine ──────────────────────────────────────────────

describe('confirm-before-it-sets', () => {
  it('blocks confirm until the grace floor elapses', () => {
    const created = '2026-06-23T12:00:00.000Z';
    const tooSoon = new Date(Date.parse(created) + CONFIRM_GRACE_MS - 1).toISOString();
    const ready = new Date(Date.parse(created) + CONFIRM_GRACE_MS).toISOString();

    const early = canConfirmMotivation({ createdAtIso: created, nowIso: tooSoon });
    assert.equal(early.ok, false);
    assert.equal(early.reason, 'grace_not_elapsed');
    assert.ok((early.waitMs ?? 0) > 0);

    const ok = canConfirmMotivation({ createdAtIso: created, nowIso: ready });
    assert.equal(ok.ok, true);
  });
});

describe('intentionState', () => {
  const base = { kind: 'motivation', body: 'x', confirmed_at: null, erased_at: null };
  it('derives pending → locked → erased for motivations', () => {
    assert.equal(intentionState(base), 'pending');
    assert.equal(intentionState({ ...base, confirmed_at: '2026-06-23T00:00:00Z' }), 'locked');
    assert.equal(intentionState({ ...base, erased_at: '2026-06-24T00:00:00Z' }), 'erased');
    assert.equal(intentionState({ ...base, body: null }), 'erased');
  });
  it('treats journals as open (never locking)', () => {
    assert.equal(intentionState({ ...base, kind: 'journal' }), 'open');
    assert.equal(intentionState({ ...base, kind: 'journal', confirmed_at: 'x' }), 'open');
  });
});

describe('projectIntention', () => {
  const row: IntentionRow = {
    id: 'int-1',
    piece_id: 'UL-100',
    edition_number: 0,
    author_user_id: 'user-a',
    kind: 'motivation',
    body: 'Patience.',
    body_hash: 'abc',
    content_salt: 'deadbeef',
    confirmed_at: '2026-06-23T00:00:00Z',
    sets_for_year: 2026,
    birthday_window: 1,
    created_at: '2026-06-23T00:00:00Z',
    erased_at: null,
  };

  it('returns the body to the author of a readable row', () => {
    const v = projectIntention(row, 'user-a');
    assert.equal(v.state, 'locked');
    assert.equal(v.body, 'Patience.');
    assert.equal(v.authoredByYou, true);
    assert.equal(v.setsForYear, 2026);
  });

  it('never leaks the body of an erased row', () => {
    const v = projectIntention({ ...row, erased_at: '2026-07-01T00:00:00Z', body: null }, 'user-a');
    assert.equal(v.state, 'erased');
    assert.equal(v.body, undefined);
    // The commitment is still exported for chain verification.
    assert.equal(v.contentHash, 'abc');
  });
});

describe('parseIntentionInput (whitelist)', () => {
  it('accepts a valid motivation', () => {
    const r = parseIntentionInput({ kind: 'motivation', body: '  hold steady  ' });
    assert.equal(r.ok, true);
    assert.equal(r.value?.body, 'hold steady');
  });
  it('rejects unknown fields and bad kinds', () => {
    assert.equal(parseIntentionInput({ kind: 'motivation', body: 'x', evil: 1 }).ok, false);
    assert.equal(parseIntentionInput({ kind: 'spell', body: 'x' }).ok, false);
    assert.equal(parseIntentionInput({ kind: 'journal', body: '   ' }).ok, false);
  });
});

// ── Contested-claim handoff: Adrian-side bridge payload ──────────────────────

describe('claim bridge payload (Adrian side, whitelist)', () => {
  it('builds exactly the fields the receiver accepts, edition 0 always sent', () => {
    const p = buildClaimBridgePayload({
      pieceId: 'UL-100',
      editionNumber: 0,
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
    });
    assert.deepEqual(Object.keys(p).sort(), [
      'editionNumber',
      'pieceId',
      'requesterEmail',
      'requesterRef',
    ]);
    // edition 0 is the chain-key default and must travel (not dropped as falsy).
    assert.equal(p.editionNumber, 0);
  });

  it('defaults a missing/invalid editionNumber to 0', () => {
    const p = buildClaimBridgePayload({
      pieceId: 'UL-100',
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
    });
    assert.equal(p.editionNumber, 0);
  });

  it('includes a trimmed note and caps it at CLAIM_REQUEST_NOTE_MAX', () => {
    const long = 'x'.repeat(CLAIM_REQUEST_NOTE_MAX + 200);
    const p = buildClaimBridgePayload({
      pieceId: 'UL-100',
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
      note: `   bought at auction lot 12   `,
    });
    assert.equal(p.note, 'bought at auction lot 12');

    const capped = buildClaimBridgePayload({
      pieceId: 'UL-100',
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
      note: long,
    });
    assert.equal(capped.note?.length, CLAIM_REQUEST_NOTE_MAX);

    // An empty/whitespace note is omitted entirely (never an empty string).
    const blank = buildClaimBridgePayload({
      pieceId: 'UL-100',
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
      note: '   ',
    });
    assert.equal('note' in blank, false);
  });
});

describe('requestContestedClaim (Adrian side, transport)', () => {
  it('no-ops with secret_unset when CLAIM_BRIDGE_SECRET is not provisioned', async () => {
    const r = await requestContestedClaim({}, {
      pieceId: 'UL-100',
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'secret_unset');
  });

  it('reports missing required fields without calling out', async () => {
    const r = await requestContestedClaim({ CLAIM_BRIDGE_SECRET: 's' }, {
      pieceId: 'UL-100',
      // requesterRef / requesterEmail missing
    } as never);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'missing_required_fields');
  });

  it('passes through the receiver status on a 200 (opened / duplicate)', async () => {
    const calls: string[] = [];
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: { headers: Record<string, string> }) => {
      calls.push(init.headers['X-Claim-Signature']);
      return new Response(JSON.stringify({ ok: true, status: 'opened', request: { id: 'req-1' } }), {
        status: 200,
      });
    }) as typeof fetch;
    try {
      const r = await requestContestedClaim({ CLAIM_BRIDGE_SECRET: 'shared-secret' }, {
        pieceId: 'UL-100',
        editionNumber: 0,
        requesterRef: 'user-asker',
        requesterEmail: 'asker@example.com',
      });
      assert.equal(r.ok, true);
      assert.equal(r.status, 'opened');
      assert.equal(r.request?.id, 'req-1');
      // The call was signed (an HMAC hex of length 64 went out).
      assert.match(calls[0], /^[0-9a-f]{64}$/);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('does NOT retry a 400 (our payload is wrong)', async () => {
    let n = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      n++;
      return new Response(JSON.stringify({ ok: false, error: 'bad' }), { status: 400 });
    }) as typeof fetch;
    try {
      const r = await requestContestedClaim({ CLAIM_BRIDGE_SECRET: 'shared-secret' }, {
        pieceId: 'UL-100',
        requesterRef: 'user-asker',
        requesterEmail: 'asker@example.com',
      });
      assert.equal(r.ok, false);
      assert.equal(r.reason, 'rejected_400');
      assert.equal(n, 1); // no retry
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

// ── Contested-claim handoff: shared escalation contract (mandalacodes) ────────
// These pin the rules Adrian-Website hands the claim into. They live on the
// mandalacodes side (one source of truth); we assert the contract here so a
// drift on either side is caught.

describe('contested claim opens a request (not a 409)', () => {
  const boundSteward = {
    pieceId: 'UL-100',
    clerkUserId: 'user-holder',
    email: 'holder@example.com',
    issuedAt: '2026-01-01T00:00:00Z',
    outreachStatus: 'claimed' as const,
  };

  it('a bound piece routes the request to the HOLDER, pending, never binding', () => {
    const plan = planClaimRequest([], {
      input: { pieceId: 'UL-100' },
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
      steward: boundSteward,
      now: '2026-06-23T00:00:00Z',
    });
    assert.equal(plan.ok, true);
    assert.equal(plan.value?.status, 'pending'); // not bound, not 409
    assert.equal(plan.value?.routedTo, 'holder'); // anti-takeover: the holder decides
    assert.equal(plan.value?.requesterRef, 'user-asker');
  });

  it('the bound holder cannot request their own piece (self-guard)', () => {
    const plan = planClaimRequest([], {
      input: { pieceId: 'UL-100' },
      requesterRef: 'user-holder',
      requesterEmail: 'holder@example.com',
      steward: boundSteward,
      now: '2026-06-23T00:00:00Z',
    });
    assert.equal(plan.ok, false);
  });
});

describe('dedupe + rate limit (shared store guardrails)', () => {
  const steward = {
    pieceId: 'UL-100',
    clerkUserId: 'user-holder',
    email: 'holder@example.com',
    issuedAt: '2026-01-01T00:00:00Z',
    outreachStatus: 'claimed' as const,
  };

  it('a second request for the same piece by the same requester is one open request', () => {
    const first = planClaimRequest([], {
      input: { pieceId: 'UL-100' },
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
      steward,
      now: '2026-06-23T00:00:00Z',
    });
    assert.equal(first.ok, true);
    const second = planClaimRequest([first.value!], {
      input: { pieceId: 'UL-100' },
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
      steward,
      now: '2026-06-23T01:00:00Z',
    });
    assert.equal(second.ok, false); // dedupe → no duplicate open request
  });

  it('caps a requester at MAX_OPEN_REQUESTS_PER_REQUESTER open requests', () => {
    const open = [];
    for (let i = 0; i < MAX_OPEN_REQUESTS_PER_REQUESTER; i++) {
      const r = planClaimRequest(open, {
        input: { pieceId: `UL-10${i}` },
        requesterRef: 'user-asker',
        requesterEmail: 'asker@example.com',
        steward: undefined,
        now: '2026-06-23T00:00:00Z',
      });
      assert.equal(r.ok, true);
      open.push(r.value!);
    }
    const overflow = planClaimRequest(open, {
      input: { pieceId: 'UL-999' },
      requesterRef: 'user-asker',
      requesterEmail: 'asker@example.com',
      steward: undefined,
      now: '2026-06-23T00:00:00Z',
    });
    assert.equal(overflow.ok, false); // rate limited
  });
});

describe('escalation outcomes (run on the mandalacodes side)', () => {
  const baseRequest = {
    id: 'req-1',
    pieceId: 'UL-100',
    requesterRef: 'user-asker',
    requesterEmail: 'asker@example.com',
    createdAt: '2026-06-01T00:00:00Z',
    status: 'pending' as const,
    routedTo: 'holder' as const,
  };

  it("a holder's NO stops the claim cold, regardless of elapsed time", () => {
    const declined = { ...baseRequest, status: 'declined' as const };
    // Even far past the full window, a decline never frees the piece.
    const r = evaluateClaimWindow({
      request: declined,
      holderResponded: false,
      nowIso: '2027-01-01T00:00:00Z',
    });
    assert.equal(r.status, 'declined');
  });

  it('only unanswered silence across the FULL window, every warning delivered, frees the piece', () => {
    const past = new Date(
      Date.parse(baseRequest.createdAt) + CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const freed = evaluateClaimWindow({
      request: baseRequest,
      holderResponded: false,
      nowIso: past,
      warningsSent: CLAIM_WARNING_DAYS.length, // all four delivered
    });
    assert.equal(freed.status, 'frees-to-requester');
  });

  it('mere inactivity never frees: full window but warnings undelivered stays blocked', () => {
    const past = new Date(
      Date.parse(baseRequest.createdAt) + CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const notFreed = evaluateClaimWindow({
      request: baseRequest,
      holderResponded: false,
      nowIso: past,
      warningsSent: 0, // nothing actually delivered to the keeper yet
    });
    assert.notEqual(notFreed.status, 'frees-to-requester');
  });

  it('any keeper response keeps the piece blocked (engagement never frees)', () => {
    const past = new Date(
      Date.parse(baseRequest.createdAt) + CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const held = evaluateClaimWindow({
      request: baseRequest,
      holderResponded: true,
      nowIso: past,
      warningsSent: CLAIM_WARNING_DAYS.length,
    });
    assert.equal(held.status, 'blocked-active');
  });
});
