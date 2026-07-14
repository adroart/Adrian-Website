/**
 * Pure, I/O-free logic for the Living Legacy yearly INTENTION ritual.
 *
 * Like mandalacodes' utils/inscriptions.ts, everything here is deterministic and
 * isomorphic — no fetch, no env, no D1, no R2 — so the unit suite can pin the
 * rules without mocking Cloudflare. The HTTP handler in
 * functions/api/keeper/intention.js composes these around the D1 binding.
 *
 * Two kinds of entry, mirroring the spec:
 *   - 'motivation' — the yearly fused intention. It is the only entry that
 *     LOCKS. It may be set/changed only ONCE a year, inside a window around the
 *     steward's birthday, and only after a confirm-before-it-sets grace step.
 *   - 'journal'    — anytime reflection. Never locks, no birthday gate, no
 *     confirm step. Journaling stays allowed always.
 *
 * INVARIANT (mirrors inscriptions.ts, the chain-content law): the body NEVER
 * enters a hashed payload. contentHash is a salted commitment —
 * SHA-256(saltHex + body) — so deleting salt + body together (legal erasure)
 * leaves a commitment that matches nothing recomputable. The chain (written on
 * mandalacodes via the shared inscription path) carries only the opaque
 * inscriptionId, the contentHash, the kind, an opaque actorRef, and the date.
 */

// ---------- Constants ----------

export const INTENTION_KINDS = ['motivation', 'journal'] as const;
export type IntentionKind = (typeof INTENTION_KINDS)[number];

/** Longest intention body we accept — same ceiling as mandalacodes'
 *  INSCRIPTION_MAX_LENGTH so the two sites agree. */
export const INTENTION_MAX_LENGTH = 2000;

/**
 * How many days on each side of the steward's birthday the yearly motivation may
 * be set or changed. A wide-enough window means a steward who misses the exact day
 * still gets their turn, narrow enough that the motivation is genuinely a
 * once-a-year act tied to the birthday and not an anytime edit.
 */
export const BIRTHDAY_WINDOW_DAYS = 7;

/**
 * The confirm-before-it-sets grace window, in milliseconds. After a steward
 * composes a motivation it is written PENDING (confirmed_at NULL); they then
 * confirm ("see it as the field will see it") and it LOCKS. The grace window is
 * the minimum time the pending draft must be allowed to exist so the confirm is
 * a conscious second act, not a double-click. It is a floor, not a ceiling — a
 * steward may take as long as they like before confirming.
 */
export const CONFIRM_GRACE_MS = 30 * 1000; // 30 seconds

// ---------- Input validation (whitelist discipline) ----------

export interface IntentionInput {
  kind: IntentionKind;
  body: string;
}

export interface ParseResult<T> {
  ok: boolean;
  value?: T;
  error?: string;
}

/**
 * Strictly validate the intention fields of a POST body. Exactly these client
 * fields are accepted: kind, body. Anything else is rejected — the server, not
 * the client, decides what reaches D1 and the chain. (pieceId / editionNumber
 * are routing fields validated by the handler.)
 */
export function parseIntentionInput(value: unknown): ParseResult<IntentionInput> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'intention must be an object' };
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key !== 'kind' && key !== 'body' && key !== 'pieceId' && key !== 'editionNumber') {
      return { ok: false, error: `intention: unknown field "${key}"` };
    }
  }
  if (
    typeof obj.kind !== 'string' ||
    !(INTENTION_KINDS as readonly string[]).includes(obj.kind)
  ) {
    return {
      ok: false,
      error: `kind must be one of: ${INTENTION_KINDS.join(', ')}`,
    };
  }
  if (typeof obj.body !== 'string') {
    return { ok: false, error: 'body must be a string' };
  }
  const body = obj.body.trim();
  if (!body) return { ok: false, error: 'body must not be empty' };
  if (body.length > INTENTION_MAX_LENGTH) {
    return {
      ok: false,
      error: `body must be at most ${INTENTION_MAX_LENGTH} characters`,
    };
  }
  return { ok: true, value: { kind: obj.kind as IntentionKind, body } };
}

// ---------- Salted content commitment (mirrors inscriptions.ts) ----------

/** Random 16-byte salt as lowercase hex. Stored beside the body in D1 and
 *  deleted with it on legal erasure. */
export function generateSaltHex(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(16));
  let hex = '';
  for (let i = 0; i < rnd.length; i++) hex += rnd[i].toString(16).padStart(2, '0');
  return hex;
}

/**
 * The salted commitment that goes into the hashed chain payload:
 * SHA-256 over the UTF-8 bytes of (saltHex + body), lowercase hex. Without the
 * salt, the commitment cannot be matched against any recomputable value — that
 * is exactly the erasure property we need. Byte-identical to mandalacodes'
 * computeContentHash so a commitment written here verifies there.
 */
export async function computeContentHash(
  saltHex: string,
  body: string,
): Promise<string> {
  const data = new TextEncoder().encode(saltHex + body);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

/** Opaque id for a D1 intention row, also used as the chain's inscriptionId. */
export function genIntentionId(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  let hex = '';
  for (let i = 0; i < rnd.length; i++) hex += rnd[i].toString(16).padStart(2, '0');
  return `int-${Date.now().toString(36)}-${hex}`;
}

// ---------- Birthday-window gate (pure, testable) ----------

/**
 * Day-of-year distance between two month/day pairs, accounting for the year
 * wrap (Dec 28 and Jan 2 are 5 days apart, not 360). Leap day is treated as a
 * normal day; we compare against a fixed 365-day ring, which is correct to
 * within a day for the window check and never throws on Feb 29.
 */
function dayOfYearDistance(
  birthdayMonth: number,
  birthdayDay: number,
  nowMonth: number,
  nowDay: number,
): number {
  // Cumulative days before the start of each month (non-leap reference ring).
  const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const a = cum[birthdayMonth - 1] + (birthdayDay - 1);
  const b = cum[nowMonth - 1] + (nowDay - 1);
  const raw = Math.abs(a - b);
  return Math.min(raw, 365 - raw);
}

export interface BirthdayWindowResult {
  /** True when `now` falls within BIRTHDAY_WINDOW_DAYS of the birthday. */
  open: boolean;
  /** Days from now to the birthday (0 on the day itself). */
  distanceDays: number;
}

/**
 * Is the steward inside their birthday window right now? The birthday source is
 * a stored "MM-DD" string for this slice (the year is irrelevant — only the
 * anniversary matters). `nowIso` is any ISO date/timestamp.
 *
 * Returns open:false with distanceDays:Infinity when the birthday string is
 * missing or malformed, so a steward with no birthday on file simply cannot lock
 * a motivation until they provide one — a fail-closed default.
 */
export function birthdayWindowState(
  birthdayMonthDay: string | null | undefined,
  nowIso: string,
): BirthdayWindowResult {
  if (!birthdayMonthDay || !/^\d{2}-\d{2}$/.test(birthdayMonthDay)) {
    return { open: false, distanceDays: Infinity };
  }
  const [bm, bd] = birthdayMonthDay.split('-').map((n) => parseInt(n, 10));
  if (bm < 1 || bm > 12 || bd < 1 || bd > 31) {
    return { open: false, distanceDays: Infinity };
  }
  const now = new Date(nowIso);
  if (Number.isNaN(now.getTime())) {
    return { open: false, distanceDays: Infinity };
  }
  // UTC month/day — birthdays are a calendar anniversary, not a clock instant.
  const nm = now.getUTCMonth() + 1;
  const nd = now.getUTCDate();
  const distanceDays = dayOfYearDistance(bm, bd, nm, nd);
  return { open: distanceDays <= BIRTHDAY_WINDOW_DAYS, distanceDays };
}

// ---------- D1 row shape ----------

/** keeper_intentions row as D1 returns it (snake_case). */
export interface IntentionRow {
  id: string;
  piece_id: string;
  edition_number: number;
  author_user_id: string | null;
  kind: string;
  body: string | null;
  body_hash: string;
  content_salt: string | null;
  confirmed_at: string | null;
  sets_for_year: number | null;
  birthday_window: number;
  created_at: string;
  erased_at: string | null;
  erase_reason?: string | null;
}

// ---------- Confirm-lock state machine (pure, testable) ----------

export type IntentionState =
  | 'erased' // body + salt removed; a tombstone
  | 'pending' // composed, awaiting the confirm-before-it-sets step
  | 'locked' // confirmed motivation, set for its year
  | 'open'; // a journal entry — readable, never locks

/**
 * Derive the lifecycle state of an intention row. Pure projection over the
 * stored columns:
 *   - erased_at set OR body null  → 'erased'
 *   - journal                     → 'open' (journals never lock)
 *   - motivation, confirmed_at set → 'locked'
 *   - motivation, not confirmed    → 'pending'
 */
export function intentionState(
  row: Pick<IntentionRow, 'kind' | 'body' | 'confirmed_at' | 'erased_at'>,
): IntentionState {
  if (row.erased_at || row.body === null) return 'erased';
  if (row.kind === 'journal') return 'open';
  return row.confirmed_at ? 'locked' : 'pending';
}

export interface SetMotivationContext {
  /** Existing CONFIRMED, non-erased motivation rows for this piece/edition. */
  lockedYears: number[];
  /** The steward's birthday window state at `now`. */
  birthday: BirthdayWindowResult;
  /** Calendar year the new motivation would set for (UTC year of `now`). */
  year: number;
}

export interface SetMotivationDecision {
  ok: boolean;
  /** Machine-stable reason on rejection. */
  reason?: 'birthday_window_closed' | 'already_locked_this_year';
  /** Human sentence for the UI (no em dashes). */
  message?: string;
}

/**
 * May a steward SET (compose, pending) a new yearly motivation right now? The
 * gate runs BEFORE the pending row is written, so a closed window or an
 * already-locked year stops the ritual at the door rather than after a draft.
 *
 * Journaling is never gated and never calls this.
 */
export function canSetMotivation(ctx: SetMotivationContext): SetMotivationDecision {
  if (!ctx.birthday.open) {
    return {
      ok: false,
      reason: 'birthday_window_closed',
      message:
        'The yearly intention can only be set in the days around your birthday. Your journaling stays open anytime.',
    };
  }
  if (ctx.lockedYears.includes(ctx.year)) {
    return {
      ok: false,
      reason: 'already_locked_this_year',
      message:
        'You have already set this year’s intention into the piece. It holds until next year.',
    };
  }
  return { ok: true };
}

export interface ConfirmContext {
  /** The pending row's created_at (ISO). */
  createdAtIso: string;
  /** Now (ISO). */
  nowIso: string;
}

export interface ConfirmDecision {
  ok: boolean;
  reason?: 'too_soon' | 'grace_not_elapsed';
  message?: string;
  /** Milliseconds the steward must still wait before confirming. */
  waitMs?: number;
}

/**
 * May a pending motivation be CONFIRMED (locked) now? Enforces the grace floor:
 * at least CONFIRM_GRACE_MS must have elapsed since the pending row was written,
 * so the confirm is a deliberate second act. Returns the remaining wait so the
 * UI can show the grace countdown rather than a bare error.
 */
export function canConfirmMotivation(ctx: ConfirmContext): ConfirmDecision {
  const created = new Date(ctx.createdAtIso).getTime();
  const now = new Date(ctx.nowIso).getTime();
  if (Number.isNaN(created) || Number.isNaN(now)) {
    return { ok: false, reason: 'too_soon', message: 'Please try again in a moment.' };
  }
  const elapsed = now - created;
  if (elapsed < CONFIRM_GRACE_MS) {
    return {
      ok: false,
      reason: 'grace_not_elapsed',
      waitMs: CONFIRM_GRACE_MS - elapsed,
      message: 'Take a breath. This sets in a moment.',
    };
  }
  return { ok: true };
}

// ---------- Read projection (what the steward sees) ----------

export interface IntentionView {
  id: string;
  kind: IntentionKind;
  state: IntentionState;
  createdAt: string;
  confirmedAt?: string;
  setsForYear?: number;
  /** Present only when the row is readable (not erased). */
  body?: string;
  contentHash: string;
  authoredByYou: boolean;
}

/**
 * Project a D1 row into what THIS viewer may see. Erased rows carry no body
 * (tombstone). The contentHash is always included so an exported record can be
 * checked against the chain's commitment.
 */
export function projectIntention(
  row: IntentionRow,
  viewerUserId: string,
): IntentionView {
  const kind = (INTENTION_KINDS as readonly string[]).includes(row.kind)
    ? (row.kind as IntentionKind)
    : 'journal';
  const state = intentionState(row);
  const base: IntentionView = {
    id: row.id,
    kind,
    state,
    createdAt: row.created_at,
    contentHash: row.body_hash,
    authoredByYou: row.author_user_id === viewerUserId,
    ...(row.confirmed_at ? { confirmedAt: row.confirmed_at } : {}),
    ...(row.sets_for_year != null ? { setsForYear: row.sets_for_year } : {}),
  };
  if (state === 'erased') return base;
  return { ...base, body: row.body ?? undefined };
}
