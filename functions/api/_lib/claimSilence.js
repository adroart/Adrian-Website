/**
 * Thirty-day silence windows on contested claims (migration 037), evaluated
 * lazily. There is no cron: any later touch of a contested claim runs
 * evaluateSilence, which sends whichever reminders have come due, records
 * them, and, once the deadline has lapsed after the reminders soaked, EXECUTES
 * the pass through the exact governed transfer path migration 024 installed
 * (intent + parties + 'transferred' lineage event + receipt gateway, the same
 * SQL sequence the admin steward-transfer flow in
 * functions/api/admin/maintenance/[id]/actions.js issues). The silence pass
 * never bypasses the receipt model; it executes it.
 *
 * The design contract (todo/plans/collector-screen-wording.md, "The passing
 * confirmation"): when someone claims a held piece, the registered caretaker
 * is emailed; logging in is the identity proof. Silence for thirty days, with
 * more than one reminder across it, passes the piece to the claimant, both
 * sides notified. The steward touching their own piece while a window is open
 * confirms they are alive and holding it, which withdraws the window. Only an
 * active refusal reaches Adrian (a claim_refusal_review maintenance event on
 * the maintenance desk). A piece is never orphaned.
 *
 * FAIL CLOSED: a reminder is recorded only after its email actually sent, and
 * the pass never executes unless every reminder kind is recorded AND the last
 * one has soaked (so a first touch on day 31 can send the reminders but can
 * never pass the piece in the same breath). If email infrastructure is not
 * configured, nothing is recorded and the window simply stays open; the
 * claimant sees only the normal pending state.
 *
 * Marking: the public lineage payload for a governed transfer is structurally
 * fixed by migration 024 to exactly {fromRef, toRef, transferKind} with
 * transferKind from the canonical set, so the silence pass rides as
 * transferKind 'inheritance' there. The 'silence_pass' kind is recorded where
 * it can be: in the maintenance event's reason and in the window row itself
 * (status 'passed' linked to the claim and the receipt via the maintenance
 * event's intent).
 */

import {
  commitMaintenanceMutation,
  findMaintenanceEventByIdempotencyKey,
  maintenanceMutationFingerprint,
} from './registryMaintenance.js';
import { prepareNextLineageEvent } from './lineage.js';
import { syncTransferCollectorLetters } from './collectorLetters.js';

export const SILENCE_WINDOW_DAYS = 30;
export const SILENCE_REMINDER_SCHEDULE = [
  { kind: 'day7', afterDays: 7 },
  { kind: 'day21', afterDays: 21 },
  { kind: 'day29', afterDays: 29 },
];
/** The last reminder must have soaked this long before a pass may execute. */
export const SILENCE_PASS_SOAK_DAYS = 2;
/** System actor recorded on the pass's maintenance event and claim approval. */
export const SILENCE_PASS_ACTOR = {
  userId: 'system-silence-pass',
  email: 'registry-silence@adrianrasmussen.com',
};

const DAY_MS = 86_400_000;

function isoAfterDays(iso, days) {
  const base = Date.parse(iso);
  if (!Number.isFinite(base)) throw new Error('invalid_silence_timestamp');
  return new Date(base + days * DAY_MS).toISOString();
}

function validIso(value) {
  if (typeof value !== 'string' || !value) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function requiredId(value, error) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > 128) throw new Error(error);
  return normalized;
}

function missingInfrastructure(error) {
  return error instanceof Error && /no such table/i.test(error.message);
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Send one email through the existing Resend mechanism (the exact pattern
 * functions/api/inquire.js uses). Returns true only when Resend accepted the
 * message; false on any failure, including unconfigured infrastructure.
 * Plaintext codes never appear here; only piece titles/ids and prose.
 */
async function sendRegistryEmail(env, { to, subject, html }) {
  if (!env?.RESEND_API_KEY || typeof to !== 'string' || !to.trim()) return false;
  const fromEmail = env.RESEND_FROM_EMAIL || 'noreply@adrianrasmussen.com';
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Adrian Rasmussen Art <${fromEmail}>`,
        to: [to.trim()],
        subject,
        html,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('[claimSilence] email send failed:', error?.message);
    return false;
  }
}

function reminderEmail(pieceLabel) {
  const safe = escapeHtml(pieceLabel);
  return {
    subject: `A passing awaits your word · ${pieceLabel}`,
    html: `
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#3d3024">
  <h2 style="font-size:22px;font-weight:400;margin-bottom:24px">A passing begins</h2>
  <p style="line-height:1.7">Someone holding ${safe} has asked to become its caretaker.
  Nothing moves without you. Sign in to your account to confirm the letting go,
  or to say the piece is still yours.</p>
  <p style="line-height:1.7">If we do not hear from you within thirty days of the request,
  the piece will pass to the person holding it, and both of you will be told.</p>
</div>`.trim(),
  };
}

function passEmail(pieceLabel, side) {
  const safe = escapeHtml(pieceLabel);
  const body = side === 'steward'
    ? `Thirty days passed without your word, after several reminders. ${safe} has passed to the person holding it. If this is not right, contact Adrian and it will be looked at by a human.`
    : `The thirty days of silence have completed. ${safe} is now yours to carry. Its story continues with you.`;
  return {
    subject: `The passing is complete · ${pieceLabel}`,
    html: `
<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#3d3024">
  <h2 style="font-size:22px;font-weight:400;margin-bottom:24px">The passing is complete</h2>
  <p style="line-height:1.7">${body}</p>
</div>`.trim(),
  };
}

async function stewardEmailFor(db, keeperUserId) {
  if (!keeperUserId) return null;
  const row = await db.prepare(
    'SELECT email FROM user WHERE id = ?1',
  ).bind(keeperUserId).first();
  const email = typeof row?.email === 'string' ? row.email.trim() : '';
  return email || null;
}

/**
 * Open the silence window for a freshly opened (or rediscovered) contested
 * claim. Idempotent and race-safe: one window per claim request, created only
 * while the claim is still pending. Never throws for a lost race.
 */
export async function openSilenceWindow(db, claimRequest, now) {
  const claimRequestId = requiredId(
    claimRequest?.requestId ?? claimRequest?.id,
    'invalid_claim_request_id',
  );
  const keeperPieceId = requiredId(
    claimRequest?.keeperPieceId ?? claimRequest?.keeper_piece_id,
    'invalid_keeper_piece_id',
  );
  const openedAt = claimRequest?.createdAt ?? claimRequest?.created_at ?? now;
  if (!validIso(openedAt)) throw new Error('invalid_silence_timestamp');
  const deadlineAt = isoAfterDays(openedAt, SILENCE_WINDOW_DAYS);
  const id = `csw-${crypto.randomUUID()}`;
  try {
    const inserted = await db.prepare(
      `INSERT INTO claim_silence_windows
         (id, claim_request_id, keeper_piece_id, opened_at, deadline_at, status)
       SELECT ?1, ?2, ?3, ?4, ?5, 'open'
        WHERE EXISTS (
          SELECT 1 FROM artwork_claim_requests
           WHERE id = ?2 AND keeper_piece_id = ?3 AND status = 'pending'
        )
        AND NOT EXISTS (
          SELECT 1 FROM claim_silence_windows WHERE claim_request_id = ?2
        )`,
    ).bind(id, claimRequestId, keeperPieceId, openedAt, deadlineAt).run();
    if (inserted?.success === true && Number(inserted.meta?.changes) === 1) {
      return { ok: true, status: 'opened', windowId: id };
    }
  } catch (error) {
    if (missingInfrastructure(error)) return { ok: false, status: 'unavailable' };
    // A concurrent open hitting UNIQUE(claim_request_id) is a success story.
    if (!/UNIQUE constraint failed/i.test(String(error?.message))) throw error;
  }
  const existing = await db.prepare(
    'SELECT id FROM claim_silence_windows WHERE claim_request_id = ?1',
  ).bind(claimRequestId).first();
  if (existing) return { ok: true, status: 'existing', windowId: existing.id };
  return { ok: false, status: 'not_opened' };
}

async function loadPiece(db, selector) {
  const byPublicCode = typeof selector?.publicCode === 'string' && selector.publicCode.trim();
  const key = byPublicCode
    ? selector.publicCode.trim()
    : requiredId(selector?.keeperPieceId, 'invalid_silence_selector');
  return db.prepare(
    `SELECT id, piece_id, edition_number, keeper_user_id, claimed_at,
            released_at, current_display_location, steward_version,
            lineage_event_count, lineage_head_hash
       FROM keeper_pieces
      WHERE ${byPublicCode ? 'public_code' : 'id'} = ?1`,
  ).bind(key).first();
}

async function activeWindows(db, keeperPieceId) {
  const rows = await db.prepare(
    `SELECT window.id AS window_id, window.opened_at, window.deadline_at,
            window.status AS window_status,
            claim.id AS claim_id, claim.requester_user_id,
            claim.requester_email, claim.status AS claim_status
       FROM claim_silence_windows window
       JOIN artwork_claim_requests claim ON claim.id = window.claim_request_id
      WHERE window.keeper_piece_id = ?1
        AND window.status IN ('open', 'reminded')
      ORDER BY window.opened_at, window.id`,
  ).bind(keeperPieceId).all();
  return rows?.results ?? [];
}

async function ensureWindowsForPendingClaims(db, keeperPieceId, now) {
  const pending = await db.prepare(
    `SELECT claim.id, claim.keeper_piece_id, claim.created_at
       FROM artwork_claim_requests claim
      WHERE claim.keeper_piece_id = ?1 AND claim.status = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM claim_silence_windows window
           WHERE window.claim_request_id = claim.id
        )`,
  ).bind(keeperPieceId).all();
  for (const claim of pending?.results ?? []) {
    await openSilenceWindow(db, claim, now);
  }
}

async function recordedReminders(db, windowId) {
  const rows = await db.prepare(
    'SELECT kind, sent_at FROM claim_silence_reminders WHERE window_id = ?1',
  ).bind(windowId).all();
  return rows?.results ?? [];
}

/**
 * Send whichever reminders have come due for one window and record each one
 * only after its email actually sent (fail closed). Concurrency-safe: the
 * UNIQUE(window_id, kind) guard means a raced duplicate records exactly once.
 * Returns how many reminders were newly recorded.
 */
async function sendDueReminders(db, env, { piece, window }, now) {
  const already = new Set((await recordedReminders(db, window.window_id))
    .map((row) => row.kind));
  const due = SILENCE_REMINDER_SCHEDULE.filter((entry) => !already.has(entry.kind)
    && Date.parse(now) >= Date.parse(isoAfterDays(window.opened_at, entry.afterDays)));
  if (due.length === 0) return 0;

  const stewardEmail = await stewardEmailFor(db, piece.keeper_user_id);
  if (!stewardEmail) {
    console.error('[claimSilence] no steward email; reminders withheld for', window.window_id);
    return 0;
  }
  const pieceLabel = `${piece.piece_id} · ${piece.edition_number}`;
  let recorded = 0;
  for (const entry of due) {
    const message = reminderEmail(pieceLabel);
    const sent = await sendRegistryEmail(env, { to: stewardEmail, ...message });
    if (!sent) {
      // Fail closed: an unsent reminder is never recorded, and without the
      // recorded reminders the pass can never execute (migration 037 also
      // enforces this structurally). The window simply stays where it is.
      console.error('[claimSilence] reminder email not sent; window stays open:', window.window_id, entry.kind);
      break;
    }
    try {
      const inserted = await db.prepare(
        `INSERT INTO claim_silence_reminders (id, window_id, kind, sent_at)
         SELECT ?1, ?2, ?3, ?4
          WHERE NOT EXISTS (
            SELECT 1 FROM claim_silence_reminders
             WHERE window_id = ?2 AND kind = ?3
          )`,
      ).bind(`csr-${crypto.randomUUID()}`, window.window_id, entry.kind, now).run();
      if (inserted?.success === true && Number(inserted.meta?.changes) === 1) recorded += 1;
    } catch (error) {
      if (!/UNIQUE constraint failed/i.test(String(error?.message))) throw error;
    }
  }
  if (recorded > 0 && window.window_status === 'open') {
    await db.prepare(
      `UPDATE claim_silence_windows SET status = 'reminded'
        WHERE id = ?1 AND status = 'open'`,
    ).bind(window.window_id).run();
  }
  return recorded;
}

function passEligible(window, reminders, now) {
  if (Date.parse(now) < Date.parse(window.deadline_at)) return false;
  const kinds = new Set(reminders.map((row) => row.kind));
  if (!SILENCE_REMINDER_SCHEDULE.every((entry) => kinds.has(entry.kind))) return false;
  const lastSent = Math.max(...reminders.map((row) => Date.parse(row.sent_at)));
  if (!Number.isFinite(lastSent)) return false;
  // The soak rule: reminders recorded in this same touch have sent_at = now
  // and therefore can never satisfy this, so a pass never executes in the
  // same breath that sent the reminders.
  return Date.parse(now) - lastSent >= SILENCE_PASS_SOAK_DAYS * DAY_MS;
}

/**
 * Execute the pass through the governed transfer path: the same intent +
 * parties + 'transferred' lineage event + receipt-gateway batch the admin
 * transfer flow commits, so migration 024's triggers perform and verify the
 * steward mutation atomically. Deterministic per window (idempotency key,
 * transfer time, snapshots), so concurrent touches converge on one receipt.
 */
async function executeSilencePass(db, env, { piece, window }, now) {
  const dbEnv = { DB: db };
  const keeperPieceId = piece.id;
  const targetUserId = window.requester_user_id;
  const idempotencyKey = `silence-pass:${window.window_id}`;
  // Deterministic transfer time: the stored deadline. Every invocation of the
  // pass for this window builds the identical maintenance event, so a raced
  // second invocation resolves as an exact idempotent replay.
  const transferAt = new Date(Date.parse(window.deadline_at)).toISOString();
  const transferKind = 'inheritance';
  const reason = `silence_pass: thirty days of silence after reminders passed stewardship to the claimant (claim ${window.claim_id}).`;

  const target = await db.prepare(
    'SELECT id, email FROM user WHERE id = ?1',
  ).bind(targetUserId).first();
  if (!target?.id) {
    console.error('[claimSilence] pass target account missing; window stays open:', window.window_id);
    return { status: 'pending' };
  }

  const finalize = async (transferIntentId) => {
    await db.prepare(
      `UPDATE artwork_claim_requests
          SET status = 'approved', resolved_at = ?2, resolved_by_user_id = ?3
        WHERE id = ?1 AND status = 'pending'`,
    ).bind(window.claim_id, now, SILENCE_PASS_ACTOR.userId).run();
    await db.prepare(
      `UPDATE claim_silence_windows SET status = 'passed', passed_at = ?2
        WHERE id = ?1 AND status IN ('open', 'reminded')`,
    ).bind(window.window_id, now).run();
    await db.prepare(
      `UPDATE claim_silence_windows SET status = 'superseded'
        WHERE keeper_piece_id = ?1 AND id <> ?2 AND status IN ('open', 'reminded')`,
    ).bind(keeperPieceId, window.window_id).run();
    if (transferIntentId) {
      await syncTransferCollectorLetters({ ...env, DB: db }, { transferIntentId });
    }
    const pieceLabel = `${piece.piece_id} · ${piece.edition_number}`;
    const stewardEmail = await stewardEmailFor(db, piece.keeper_user_id);
    const claimantEmail = typeof window.requester_email === 'string'
      ? window.requester_email
      : target.email;
    // Both sides notified. Best effort after the committed truth; a failed
    // notification never rolls back a receipt.
    if (stewardEmail) {
      await sendRegistryEmail(env, { to: stewardEmail, ...passEmail(pieceLabel, 'steward') });
    }
    if (claimantEmail) {
      await sendRegistryEmail(env, { to: claimantEmail, ...passEmail(pieceLabel, 'claimant') });
    }
  };

  const intentByEvent = async (maintenanceEventId) => {
    const row = await db.prepare(
      'SELECT id FROM artwork_transfer_intents WHERE maintenance_event_id = ?1',
    ).bind(maintenanceEventId).first();
    return row?.id ?? null;
  };

  // A pass already committed for this window (concurrent touch, retried
  // request) resolves idempotently: converge the window bookkeeping and stop.
  const existingEvent = await findMaintenanceEventByIdempotencyKey(dbEnv, idempotencyKey);
  if (existingEvent) {
    const transferIntentId = await intentByEvent(existingEvent.id);
    await finalize(transferIntentId);
    return {
      status: 'passed', replayed: true, targetUserId, claimedAt: transferAt, transferIntentId,
    };
  }

  if (!piece.keeper_user_id || !piece.claimed_at || piece.released_at) {
    console.error('[claimSilence] piece has no live steward; window stays open:', window.window_id);
    return { status: 'pending' };
  }

  const before = {
    keeperPieceId,
    artworkId: piece.piece_id,
    keeperUserId: piece.keeper_user_id,
    claimedAt: piece.claimed_at,
    releasedAt: null,
    currentDisplayLocation: piece.current_display_location ?? null,
    stewardVersion: piece.steward_version,
  };
  const changes = {
    keeperUserId: targetUserId,
    claimedAt: transferAt,
    releasedAt: null,
    currentDisplayLocation: null,
  };
  const after = {
    keeperPieceId,
    artworkId: piece.piece_id,
    ...changes,
    stewardVersion: piece.steward_version + 1,
  };
  // 64-hex commitment, deterministic per claim, never the raw email.
  const targetEmailCommitment = await sha256Hex(
    `adrian-website:silence-pass-target:v1\n${window.claim_id}\n${String(window.requester_email || '').toLowerCase()}`,
  );
  const maintenanceEventId = `rme-${crypto.randomUUID()}`;
  const transferIntentId = `transfer-${crypto.randomUUID()}`;
  const fromRef = `tp-${crypto.randomUUID()}`;
  const toRef = `tp-${crypto.randomUUID()}`;

  let lineage;
  try {
    lineage = await prepareNextLineageEvent(dbEnv, {
      keeperPieceId,
      eventType: 'transferred',
      eventAt: transferAt,
      publicPayload: { fromRef, toRef, transferKind },
      onlyIfPreviousChanged: true,
    });
  } catch (error) {
    console.error('[claimSilence] lineage unavailable; window stays open:', error?.message);
    return { status: 'pending' };
  }

  const intentStatement = db.prepare(
    `INSERT INTO artwork_transfer_intents
       (id, keeper_piece_id, expected_from_user_id, target_user_id, target_email_commitment,
        expected_steward_version, expected_lineage_count, expected_lineage_hash,
        transfer_kind, maintenance_event_id, lineage_event_id, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12
      WHERE EXISTS (
        SELECT 1 FROM keeper_pieces
         WHERE id = ?2 AND keeper_user_id = ?3 AND claimed_at = ?13
           AND steward_version = ?6 AND lineage_event_count = ?7
           AND lineage_head_hash IS ?8
      )`,
  ).bind(
    transferIntentId, keeperPieceId, before.keeperUserId, targetUserId,
    targetEmailCommitment, piece.steward_version, lineage.event.sequence - 1,
    lineage.event.previousHash, transferKind, maintenanceEventId, lineage.event.id,
    transferAt, before.claimedAt,
  );
  const partyStatement = (role, userId, publicRef) => db.prepare(
    `INSERT INTO artwork_transfer_parties
       (id, transfer_intent_id, party_role, user_id, public_ref, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6
      WHERE EXISTS (SELECT 1 FROM artwork_transfer_intents WHERE id = ?2)`,
  ).bind(`party-${crypto.randomUUID()}`, transferIntentId, role, userId, publicRef, transferAt);
  const receiptStatement = db.prepare(
    `INSERT INTO artwork_transfer_receipts (id, transfer_intent_id, committed_at)
     VALUES (?1, ?2, ?3)`,
  ).bind(`receipt-${crypto.randomUUID()}`, transferIntentId, transferAt);

  const result = await commitMaintenanceMutation(dbEnv, {
    target: { type: 'keeper_steward', id: keeperPieceId, artworkId: piece.piece_id },
    changes,
    event: {
      idempotencyKey,
      id: maintenanceEventId,
      eventType: 'steward_transferred',
      keeperPieceId,
      artworkId: piece.piece_id,
      authorization: SILENCE_PASS_ACTOR,
      reason,
      before,
      after,
      outcome: 'succeeded',
      relatedRecordId: keeperPieceId,
      createdAt: transferAt,
    },
    expectedVersion: piece.steward_version,
    beforeStatements: [
      intentStatement,
      partyStatement('from', before.keeperUserId, fromRef),
      partyStatement('to', targetUserId, toRef),
    ],
    afterStatements: [lineage.statement],
    gatewayStatement: receiptStatement,
  });
  if (!result.ok) {
    console.error('[claimSilence] silence pass did not commit:', result.error);
    return { status: 'pending', error: result.error };
  }
  const committedIntentId = result.replayed
    ? await intentByEvent(result.eventId)
    : transferIntentId;
  await finalize(committedIntentId);
  return {
    status: 'passed',
    replayed: result.replayed === true,
    targetUserId,
    claimedAt: transferAt,
    transferIntentId: committedIntentId,
  };
}

/**
 * The lazy engine. Call on any touch of a piece that may carry a contested
 * claim (the bind path does; future read hooks can too).
 *
 * selector: { keeperPieceId } or { publicCode }, plus optional touchUserId,
 * the verified session user performing the touch.
 *
 * Returns one of:
 *   { status: 'none' }         no piece or no active window
 *   { status: 'unavailable' }  migration 037 not applied; nothing evaluated
 *   { status: 'withdrawn' }    the current steward touched their piece: alive
 *                              and holding it, every active window withdrawn
 *   { status: 'pending' }      window(s) active; due reminders handled
 *   { status: 'passed', targetUserId, claimedAt, transferIntentId }
 *                              the deadline had lapsed after soaked reminders
 *                              and the governed pass committed (or replayed)
 */
export async function evaluateSilence(db, env, selector, now) {
  if (!validIso(now)) throw new Error('invalid_silence_timestamp');
  let piece;
  let windows;
  try {
    piece = await loadPiece(db, selector);
    if (!piece) return { status: 'none' };
    await ensureWindowsForPendingClaims(db, piece.id, now);
    windows = await activeWindows(db, piece.id);
  } catch (error) {
    if (missingInfrastructure(error)) return { status: 'unavailable' };
    throw error;
  }
  if (windows.length === 0) return { status: 'none' };

  // The steward's own touch is the confirmation path: they are alive and
  // holding the piece, so every active window is withdrawn. The claims stay
  // recorded (pending) for ordinary human resolution.
  const touchUserId = typeof selector?.touchUserId === 'string' && selector.touchUserId
    ? selector.touchUserId
    : null;
  if (touchUserId && touchUserId === piece.keeper_user_id
    && piece.claimed_at && !piece.released_at) {
    let withdrawn = 0;
    for (const window of windows) {
      const updated = await db.prepare(
        `UPDATE claim_silence_windows SET status = 'withdrawn'
          WHERE id = ?1 AND status IN ('open', 'reminded')`,
      ).bind(window.window_id).run();
      withdrawn += Number(updated?.meta?.changes ?? 0);
    }
    return { status: 'withdrawn', windows: withdrawn };
  }

  let remindersSent = 0;
  for (const window of windows) {
    remindersSent += await sendDueReminders(db, env, { piece, window }, now);
  }

  // Oldest eligible window wins the pass; the pass itself supersedes the rest.
  for (const window of windows) {
    const reminders = await recordedReminders(db, window.window_id);
    if (!passEligible(window, reminders, now)) continue;
    const passed = await executeSilencePass(db, env, { piece, window }, now);
    if (passed.status === 'passed') return { ...passed, remindersSent };
    break;
  }
  return { status: 'pending', remindersSent };
}

/**
 * The steward's active refusal, the one genuinely human case: mark the window
 * refused, decline the claim, and surface it to Adrian's maintenance desk as
 * a 'claim_refusal_review' registry maintenance event (017's table). The
 * caller must have authenticated the steward; this verifies they are the
 * current keeper before acting. Idempotent.
 */
export async function refuseSilencePass(db, env, input, now) {
  if (!validIso(now)) throw new Error('invalid_silence_timestamp');
  const stewardUserId = requiredId(input?.stewardUserId, 'invalid_steward_user');
  const noteValue = typeof input?.note === 'string' ? input.note.trim() : '';
  const note = noteValue ? noteValue.slice(0, 500) : null;
  let piece;
  let windows;
  try {
    piece = await loadPiece(db, input);
    if (!piece) return { status: 'none' };
    windows = await activeWindows(db, piece.id);
  } catch (error) {
    if (missingInfrastructure(error)) return { status: 'unavailable' };
    throw error;
  }
  if (piece.keeper_user_id !== stewardUserId || !piece.claimed_at || piece.released_at) {
    return { status: 'not_steward' };
  }
  if (windows.length === 0) return { status: 'none' };

  const stewardEmail = (await stewardEmailFor(db, stewardUserId))
    || `${stewardUserId}@account.invalid`;
  let refused = 0;
  for (const window of windows) {
    const fingerprint = await maintenanceMutationFingerprint({
      operation: 'claim_refusal_review',
      windowId: window.window_id,
      claimRequestId: window.claim_id,
      keeperPieceId: piece.id,
    });
    const reason = note
      ? `claim_refusal_review: the current steward refused the passing. ${note}`.slice(0, 500)
      : 'claim_refusal_review: the current steward refused the passing. Needs review by Adrian.';
    const statements = [
      db.prepare(
        `UPDATE claim_silence_windows
            SET status = 'refused', refused_at = ?2, refusal_note = ?3
          WHERE id = ?1 AND status IN ('open', 'reminded')`,
      ).bind(window.window_id, now, note),
      db.prepare(
        `UPDATE artwork_claim_requests
            SET status = 'declined', resolved_at = ?2, resolved_by_user_id = ?3
          WHERE id = ?1 AND status = 'pending'`,
      ).bind(window.claim_id, now, stewardUserId),
      db.prepare(
        `INSERT INTO registry_maintenance_events
           (id, idempotency_key, event_type, keeper_piece_id, artwork_id,
            administrator_user_id, administrator_email, reason, before_json,
            after_json, outcome, related_record_id, mutation_fingerprint, created_at)
         SELECT ?1, ?2, 'claim_refusal_review', ?3, ?4, ?5, ?6, ?7, ?8, ?9,
                'succeeded', ?10, ?11, ?12
          WHERE NOT EXISTS (
            SELECT 1 FROM registry_maintenance_events WHERE idempotency_key = ?2
          )`,
      ).bind(
        `rme-${crypto.randomUUID()}`, `claim-refusal:${window.window_id}`,
        piece.id, piece.piece_id, stewardUserId, stewardEmail, reason,
        JSON.stringify({ windowId: window.window_id, status: window.window_status }),
        JSON.stringify({ windowId: window.window_id, status: 'refused' }),
        window.claim_id, fingerprint, now,
      ),
    ];
    if (typeof db.batch === 'function') {
      const [windowResult] = await db.batch(statements);
      refused += Number(windowResult?.meta?.changes ?? 0);
    } else {
      for (const statement of statements) await statement.run();
      refused += 1;
    }
  }
  return { status: 'refused', windows: refused };
}
