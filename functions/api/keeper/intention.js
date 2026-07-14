/**
 * /api/keeper/intention
 *
 * GET  ?pieceId=...&editionNumber=0
 *   Returns the signed-in steward's own intentions for a piece they steward:
 *     { ok: true, intentions: IntentionView[], birthdayWindow: {...} }
 *
 * POST { pieceId, editionNumber?, action, kind?, body?, intentionId? }
 *   action 'compose'  → write a PENDING entry.
 *       - kind 'journal'    : anytime reflection. Never locks, no gate.
 *       - kind 'motivation' : the yearly intention. Gated by the birthday
 *         window AND one-per-year; written pending (confirmed_at NULL).
 *   action 'confirm'  → lock a pending motivation after the grace window.
 *
 * The confirm-before-it-sets flow:
 *   compose(motivation) → pending row → (grace window elapses) → confirm → locked.
 * Journaling skips straight to readable (no pending state needed).
 *
 * INVARIANTS (mirrors mandalacodes inscriptions.ts, the chain-content law):
 *   - The body NEVER enters a hashed payload. We store body + a random salt in
 *     D1 (keeper_intentions) and compute a salted commitment
 *     contentHash = SHA-256(salt + body). That contentHash is the only content
 *     representation that would ever reach the ledger chain (written on the
 *     mandalacodes side via the shared inscription path). Deleting body + salt
 *     together (legal erasure) leaves the commitment unlinkable.
 *   - No name, email, or birth date is stored on this row or sent to any chain.
 *     author_user_id is the opaque Better Auth userId, already the chain actorRef.
 *
 * Auth: Better Auth session cookie (requireUser). A caller may only read/write
 * intentions for a piece they actively keep (keeper_pieces binding).
 */

import { requireUser } from '../_lib/clerk.js';
import { getUserByClerkId } from '../_lib/db.js';
import {
  legacyEnabled,
  notFound,
  json,
  migrationNotApplied,
  isMissingTableError,
  generateSaltHex,
  computeContentHash,
  genIntentionId,
} from '../_lib/keeper.js';
import {
  parseIntentionInput,
  birthdayWindowState,
  canSetMotivation,
  canConfirmMotivation,
  projectIntention,
} from '../../../utils/intentions.ts';

/** Confirm the caller actively keeps this piece. Returns the binding row or null. */
async function findActiveBinding(env, userId, pieceId, editionNumber) {
  return env.DB
    .prepare(
      `SELECT id FROM keeper_pieces
        WHERE piece_id = ?1 AND edition_number = ?2
          AND keeper_user_id = ?3 AND released_at IS NULL`,
    )
    .bind(pieceId, editionNumber, userId)
    .first();
}

/** Read the steward's birthday as "MM-DD" from their saved profile, or null. */
async function readKeeperBirthdayMonthDay(env, internalUserId) {
  const row = await env.DB
    .prepare('SELECT birth_date FROM profiles WHERE user_id = ?1')
    .bind(internalUserId)
    .first()
    .catch(() => null);
  const bd = row?.birth_date;
  if (typeof bd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bd)) {
    return bd.slice(5); // "MM-DD"
  }
  return null;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!legacyEnabled()) return notFound();

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  if (!env.DB) return migrationNotApplied();

  const user = await getUserByClerkId(env.DB, auth.userId);
  if (!user) return json({ ok: false, error: 'account_not_synced' }, 409);

  try {
    if (request.method === 'GET') return handleGet(context, auth, user);
    if (request.method === 'POST') return handlePost(context, auth, user);
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    console.error('[keeper/intention] error:', err?.message);
    return json({ ok: false, error: 'intention_failed' }, 500);
  }
}

async function handleGet(context, auth, user) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pieceId = (url.searchParams.get('pieceId') || '').trim();
  const editionNumber = parseInt(url.searchParams.get('editionNumber') || '0', 10) || 0;
  if (!pieceId) return json({ ok: false, error: 'pieceId is required' }, 400);

  const binding = await findActiveBinding(env, auth.userId, pieceId, editionNumber);
  if (!binding) return json({ ok: false, error: 'not_your_piece' }, 403);

  const { results } = await env.DB
    .prepare(
      `SELECT id, piece_id, edition_number, author_user_id, kind, body, body_hash,
              content_salt, confirmed_at, sets_for_year, birthday_window,
              created_at, erased_at
         FROM keeper_intentions
        WHERE piece_id = ?1 AND edition_number = ?2 AND author_user_id = ?3
        ORDER BY created_at DESC
        LIMIT 200`,
    )
    .bind(pieceId, editionNumber, auth.userId)
    .all();

  const intentions = (results ?? []).map((row) => projectIntention(row, auth.userId));

  const birthdayMonthDay = await readKeeperBirthdayMonthDay(env, user.id);
  const birthday = birthdayWindowState(birthdayMonthDay, new Date().toISOString());

  return json({ ok: true, intentions, birthdayWindow: birthday });
}

async function handlePost(context, auth, user) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const pieceId = typeof body?.pieceId === 'string' ? body.pieceId.trim() : '';
  const editionNumber = Number.isInteger(body?.editionNumber) ? body.editionNumber : 0;
  const action = body?.action;
  if (!pieceId) return json({ ok: false, error: 'pieceId is required' }, 400);
  if (action !== 'compose' && action !== 'confirm') {
    return json({ ok: false, error: 'action must be "compose" or "confirm"' }, 400);
  }

  const binding = await findActiveBinding(env, auth.userId, pieceId, editionNumber);
  if (!binding) return json({ ok: false, error: 'not_your_piece' }, 403);

  const nowIso = new Date().toISOString();

  if (action === 'compose') {
    const parsed = parseIntentionInput({ kind: body?.kind, body: body?.body });
    if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
    const { kind, body: text } = parsed.value;

    let setsForYear = null;
    let birthdayWindowFlag = 0;

    if (kind === 'motivation') {
      // Birthday-window + one-per-year gate runs BEFORE any write.
      const birthdayMonthDay = await readKeeperBirthdayMonthDay(env, user.id);
      const birthday = birthdayWindowState(birthdayMonthDay, nowIso);
      const year = new Date(nowIso).getUTCFullYear();

      const { results: locked } = await env.DB
        .prepare(
          `SELECT sets_for_year FROM keeper_intentions
            WHERE piece_id = ?1 AND edition_number = ?2 AND kind = 'motivation'
              AND confirmed_at IS NOT NULL AND erased_at IS NULL`,
        )
        .bind(pieceId, editionNumber)
        .all();
      const lockedYears = (locked ?? [])
        .map((r) => r.sets_for_year)
        .filter((y) => Number.isInteger(y));

      const decision = canSetMotivation({ lockedYears, birthday, year });
      if (!decision.ok) {
        return json(
          { ok: false, error: decision.reason, message: decision.message },
          409,
        );
      }
      setsForYear = year;
      birthdayWindowFlag = birthday.open ? 1 : 0;
    }

    // Salted commitment — body + salt live in D1, only the commitment is
    // chain-bound (on the mandalacodes side).
    const salt = generateSaltHex();
    const contentHash = await computeContentHash(salt, text);
    const id = genIntentionId();
    // Journals are readable immediately (no confirm step); motivations are
    // written PENDING (confirmed_at NULL) and lock on a later confirm.
    const confirmedAt = kind === 'journal' ? nowIso : null;

    await env.DB
      .prepare(
        `INSERT INTO keeper_intentions
           (id, piece_id, edition_number, author_user_id, kind, body, body_hash,
            content_salt, confirmed_at, sets_for_year, birthday_window, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
      )
      .bind(
        id, pieceId, editionNumber, auth.userId, kind, text, contentHash,
        salt, confirmedAt, setsForYear, birthdayWindowFlag, nowIso,
      )
      .run();

    return json({
      ok: true,
      intention: {
        id,
        kind,
        state: kind === 'journal' ? 'open' : 'pending',
        setsForYear,
        contentHash,
      },
    });
  }

  // action === 'confirm' — lock a pending motivation after the grace window.
  const intentionId = typeof body?.intentionId === 'string' ? body.intentionId : '';
  if (!intentionId) return json({ ok: false, error: 'intentionId is required' }, 400);

  const row = await env.DB
    .prepare(
      `SELECT id, kind, confirmed_at, sets_for_year, created_at, erased_at, author_user_id
         FROM keeper_intentions
        WHERE id = ?1 AND piece_id = ?2 AND edition_number = ?3`,
    )
    .bind(intentionId, pieceId, editionNumber)
    .first();

  if (!row || row.author_user_id !== auth.userId || row.erased_at) {
    return json({ ok: false, error: 'intention_not_found' }, 404);
  }
  if (row.kind !== 'motivation') {
    return json({ ok: false, error: 'only_motivations_confirm' }, 400);
  }
  if (row.confirmed_at) {
    // Idempotent: already locked.
    return json({ ok: true, intention: { id: row.id, state: 'locked', setsForYear: row.sets_for_year } });
  }

  const decision = canConfirmMotivation({ createdAtIso: row.created_at, nowIso });
  if (!decision.ok) {
    return json(
      { ok: false, error: decision.reason, message: decision.message, waitMs: decision.waitMs },
      425, // Too Early — the grace window has not elapsed
    );
  }

  // Lock it. The partial UNIQUE index (uniq_keeper_motivation_year) guards
  // against a racing confirm of a second motivation for the same year.
  try {
    await env.DB
      .prepare(
        `UPDATE keeper_intentions SET confirmed_at = ?1
          WHERE id = ?2 AND confirmed_at IS NULL`,
      )
      .bind(nowIso, intentionId)
      .run();
  } catch (e) {
    if (/unique/i.test(String(e?.message))) {
      return json(
        { ok: false, error: 'already_locked_this_year', message: 'This year is already set.' },
        409,
      );
    }
    throw e;
  }

  return json({
    ok: true,
    intention: { id: row.id, state: 'locked', setsForYear: row.sets_for_year, confirmedAt: nowIso },
  });
}
