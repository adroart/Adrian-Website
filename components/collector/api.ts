/**
 * components/collector/api.ts
 *
 * The one typed data layer that talks to the network from components/collector/.
 * Every wrapper below is derived from the live endpoint source (linked in each
 * JSDoc) and cross-checked against the integration contract at
 * docs/collector-side-handoff.md. Nothing in components/collector/ should call
 * fetch() directly — go through here so the invariants below hold in one place.
 *
 * Invariants enforced in this file (docs/collector-side-handoff.md §1, §2, §6):
 *   - The Ownership Code is accepted ONLY as a bindKeeper() argument. It is
 *     normalized (strip hyphens/spaces, uppercase) right there, at the call
 *     site, and nowhere else in this module — never logged, never put in a
 *     URL or query string, never persisted by this file.
 *   - Public QR codes are validated against PUBLIC_CODE_PATTERN (copied
 *     exactly from the contract, independently re-declared in six files —
 *     keep it byte-identical if you ever touch it) before being embedded in
 *     any path.
 *   - Every fetch is same-origin with credentials so the Better Auth session
 *     cookie travels automatically; this file never calls a cross-origin URL.
 *   - ApiOutcome<T> (and the bespoke outcome unions below it) never throw for
 *     an HTTP status the source/contract documents as an expected outcome —
 *     they throw only when fetch() itself rejects (offline, DNS, aborted).
 *   - POST calls that mutate state (bind, dreams, ritual, contributors,
 *     invitations, privacy) are issued exactly once per call; this file adds
 *     no retry loop around any of them.
 *
 * Dependency-free: no imports beyond `import type` (erased at compile time)
 * from sibling modules that already own a shape this file needs to agree
 * with, so the two representations cannot drift apart.
 */

import { LAUNCH_FLAGS } from '../../launchFlags';
import type {
  PublicCreatorHistoryEntry,
  PublicPlateIdentity,
} from '../../utils/publicRegistry';
import type {
  BirthdayWindowResult,
  IntentionKind,
  IntentionView,
} from '../../utils/intentions';
import type {
  ActiveArtworkContributor,
  ContributorInvitation,
} from '../../utils/artworkContributors';

// ============================================================================
// Shared primitives
// ============================================================================

/**
 * Public QR code shape (contract §2, §6.2). Copied exactly — do not derive it
 * from a regex string constant elsewhere; the contract requires every
 * re-declaration to be byte-identical to this one.
 */
export const PUBLIC_CODE_PATTERN = /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

export function isValidPublicCode(value: string): value is string {
  return typeof value === 'string' && PUBLIC_CODE_PATTERN.test(value);
}

const ARTWORK_ID_PATTERN = /^[A-Z]{2,3}-[0-9]{3}$/;

export function isValidArtworkId(value: string): boolean {
  return typeof value === 'string' && ARTWORK_ID_PATTERN.test(value);
}

/**
 * Normalize an Ownership Code exactly the way utils/recoveryCode.ts'
 * normalizeRecoveryCode does — strip whitespace/hyphens, uppercase — so the
 * value this file sends hashes identically once the server normalizes it
 * again. Called ONLY from bindKeeper(). Do not hoist this call earlier or
 * cache its result: the whole point is that the raw code never sits around
 * longer than one request.
 */
function normalizeOwnershipCode(code: string): string {
  return code.replace(/[\s-]+/g, '').toUpperCase();
}

/** Generic result wrapper. Never thrown for a documented HTTP status. */
export type ApiOutcome<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; message?: string };

/** Thrown only when fetch() itself rejects — offline, DNS failure, aborted. */
export class CollectorApiNetworkError extends Error {
  constructor(cause: unknown) {
    super('collector_api_network_error');
    this.name = 'CollectorApiNetworkError';
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Every fetch in this file goes through here: same-origin, credentialed,
 * JSON in and out, no retries. Returns the *raw parsed body* on both success
 * and failure branches so each wrapper below can narrow it into its own
 * response type — this helper does not know or care what any endpoint's
 * success shape looks like.
 */
async function rawRequest(path: string, init?: RequestInit): Promise<{
  status: number;
  ok: boolean;
  body: unknown;
}> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch (cause) {
    throw new CollectorApiNetworkError(cause);
  }
  const text = await response.text().catch(() => '');
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  return { status: response.status, ok: response.ok, body };
}

/** Shared error-shape extraction: every endpoint here answers `{error, message?}` on failure. */
function outcomeError(status: number, body: unknown): { ok: false; status: number; error: string; message?: string } {
  const record = isRecord(body) ? body : {};
  const error = typeof record.error === 'string' ? record.error : `http_${status}`;
  const message = typeof record.message === 'string' ? record.message : undefined;
  return { ok: false, status, error, message };
}

/**
 * Generic JSON GET/POST/PUT wrapper for endpoints whose success body IS the
 * useful payload (no unwrapping needed beyond trusting the server's `ok`
 * flag). Endpoints with a richer success shape (bind, lineage) get their own
 * bespoke function further down instead of using this directly.
 */
async function jsonRequest<T>(path: string, init?: RequestInit): Promise<ApiOutcome<T>> {
  const { status, ok, body } = await rawRequest(path, init);
  if (ok) return { ok: true, status, data: body as T };
  return outcomeError(status, body);
}

/**
 * Pull one named field out of a wrapped success body (e.g. `{ok:true,
 * identity: X}` -> `ApiOutcome<X>`), preserving the failure branch untouched.
 * Written as a plain awaited if/return (not a `.then()` callback returning a
 * ternary) because that shape lets TS's control-flow narrowing do the work
 * reliably across the generic `ApiOutcome<T>` boundary.
 */
async function unwrapField<TBody extends Record<string, unknown>, K extends keyof TBody>(
  promise: Promise<ApiOutcome<TBody>>,
  key: K,
): Promise<ApiOutcome<TBody[K]>> {
  const outcome = await promise;
  if (!outcome.ok) return outcome as ApiOutcome<TBody[K]>;
  return { ok: true, status: outcome.status, data: outcome.data[key] };
}

/**
 * True while the `livingLegacy` launch flag is off (launchFlags.ts). Every
 * endpoint gated behind it answers a bare 404 `{ok:false, error:'not_found'}`
 * with no way to distinguish "feature dark" from "nothing there" purely from
 * the response — so this file checks the flag itself before spending a round
 * trip, matching functions/api/_lib/keeper.js's `legacyEnabled()` exactly.
 */
function livingLegacyDark(): boolean {
  return !LAUNCH_FLAGS.livingLegacy;
}

// ============================================================================
// Step 2 — Verify the identity (contract §4 step 2)
// functions/api/registry/[publicCode].js — never gated, always live.
// ============================================================================

/**
 * GET /api/registry/:publicCode. Not gated by any launch flag (contract §7).
 * Errors: 404 not_found, 409 identity_integrity_error, 503 registry_unavailable.
 */
export async function getRegistryIdentity(publicCode: string): Promise<ApiOutcome<PublicPlateIdentity>> {
  if (!isValidPublicCode(publicCode)) {
    return { ok: false, status: 404, error: 'not_found' };
  }
  return unwrapField(
    jsonRequest<{ ok: true; identity: PublicPlateIdentity }>(
      `/api/registry/${encodeURIComponent(publicCode)}`,
    ),
    'identity',
  );
}

// ============================================================================
// Step 3 — Show the record: certificate + lineage (contract §4 step 3)
// ============================================================================

export interface CertificateLedgerEntry {
  id: string;
  createdAt: string;
  message?: string;
  mediaUrl?: string;
}

export interface CertificateContent {
  materials?: string[];
  makers?: { name: string; role: string }[];
  origin?: string;
  techniques?: string[];
  yearWording?: string;
  editionWording?: string;
  certificateWording?: string;
  openingWording?: string;
  artworkId: string;
  title: string;
  edition:
    | { kind: 'unique' }
    | { kind: 'numbered'; number: number; size: number | null };
  publicCode: string;
  publicLedger: CertificateLedgerEntry[];
}

/**
 * GET /api/certificates/:artworkId?publicCode=. Always available, even on a
 * direct visit (contract §4 step 3) — not gated by livingLegacy.
 * functions/api/certificates/[artworkId].js.
 * Errors: 400 public_code_required, 404 certificate_not_found, 500 certificate_failed.
 */
export async function getCertificate(
  artworkId: string,
  publicCode: string,
): Promise<ApiOutcome<CertificateContent>> {
  if (!publicCode) return { ok: false, status: 400, error: 'public_code_required' };
  const query = new URLSearchParams({ publicCode });
  return unwrapField(
    jsonRequest<{ ok: true; certificate: CertificateContent }>(
      `/api/certificates/${encodeURIComponent(artworkId)}?${query.toString()}`,
    ),
    'certificate',
  );
}

// ============================================================================
// keeper/certificate-ledger — what was paid, for the current keeper alone
// functions/api/keeper/certificate-ledger.js. NOT gated by livingLegacy
// (verified directly against the source: requireUser, then straight to D1).
// STEWARD-ONLY: the endpoint resolves price history strictly for the piece's
// current keeper (functions/api/_lib/certificateContent.js
// resolveCurrentKeeperPriceHistory) and answers 403 not_current_keeper for
// anyone else — a guest or a past keeper never receives an amount. Callers
// must not fetch this for a piece the signed-in account does not hold.
// ============================================================================

export type PriceOccurrencePrecision = 'exact' | 'month' | 'year' | 'unknown';

export interface CurrentKeeperPriceEntry {
  /** minor units (cents for USD) — never a float of major units */
  amountMinor: number;
  /** ISO 4217 code, e.g. 'USD' */
  currency: string;
  /**
   * When it was paid, as precisely as the ledger knows it: 'exact' carries
   * YYYY-MM-DD, 'month' YYYY-MM, 'year' YYYY, and 'unknown' carries null.
   */
  occurrence: { precision: PriceOccurrencePrecision; value: string | null };
  recordedAt: string;
}

/**
 * GET /api/keeper/certificate-ledger?publicCode=. Requires a signed-in
 * session belonging to the piece's CURRENT keeper; entries come back in the
 * server's occurrence order, oldest known date first, unknown-dated entries
 * last. Errors: 404 not_found (bad/missing publicCode), 403
 * not_current_keeper, 503 ledger_unavailable, 405 method_not_allowed.
 */
export async function getCurrentKeeperPriceHistory(
  publicCode: string,
): Promise<ApiOutcome<CurrentKeeperPriceEntry[]>> {
  if (!isValidPublicCode(publicCode)) return { ok: false, status: 404, error: 'not_found' };
  const query = new URLSearchParams({ publicCode });
  return unwrapField(
    jsonRequest<{ ok: true; priceHistory: CurrentKeeperPriceEntry[] }>(
      `/api/keeper/certificate-ledger?${query.toString()}`,
    ),
    'priceHistory',
  );
}

export type LineageEventType =
  | 'issued' | 'activated' | 'link_corrected' | 'voided' | 'superseded'
  | 'transferred' | 'fulfillment_started' | 'fulfillment_completed'
  | 'fulfillment_cancelled' | 'first_bound' | 'migration_baseline';

export interface LineageEvent {
  sequence: number;
  eventType: LineageEventType | string;
  eventAt: string;
  previousHash: string | null;
  eventHash: string;
  /** Already stripped server-side of anything matching the secret-field deny list (contract §4 step 3). */
  publicPayload: Record<string, unknown>;
}

export interface LineageArtwork {
  pieceId: string;
  editionNumber: number;
  publicCode: string;
  plateStatus?: 'superseded';
  successorDisclosure?: 'withheld' | 'disclosed';
  currentPublicCode?: string;
}

/**
 * Discriminated outcome for GET /api/lineage/:publicCode
 * (functions/api/lineage/[publicCode].js). `dark` is its own state, not an
 * error: the endpoint answers a bare 404 while `livingLegacy` is off
 * (contract §3 step 3, §7) and this file detects that proactively rather
 * than reporting it as a generic not-found. Once the flag flips on, a real
 * 404 (unknown/inactive plate) surfaces as `not_found` instead.
 */
export type LineageOutcome =
  | { kind: 'dark' }
  | { kind: 'ok'; artwork: LineageArtwork; events: LineageEvent[] }
  | { kind: 'not_found' }
  | { kind: 'integrity_error' }
  | { kind: 'unavailable' }
  | { kind: 'error'; status: number; error: string };

export async function getLineage(publicCode: string): Promise<LineageOutcome> {
  if (livingLegacyDark()) return { kind: 'dark' };
  if (!isValidPublicCode(publicCode)) return { kind: 'not_found' };
  const { status, ok, body } = await rawRequest(`/api/lineage/${encodeURIComponent(publicCode)}`);
  if (ok) {
    const record = isRecord(body) ? body : {};
    return {
      kind: 'ok',
      artwork: record.artwork as LineageArtwork,
      events: Array.isArray(record.events) ? (record.events as LineageEvent[]) : [],
    };
  }
  const record = isRecord(body) ? body : {};
  const error = typeof record.error === 'string' ? record.error : '';
  if (status === 404 && error === 'not_found') return { kind: 'not_found' };
  if (status === 409 && error === 'lineage_integrity_error') return { kind: 'integrity_error' };
  if (status === 503) return { kind: 'unavailable' };
  return { kind: 'error', status, error: error || `http_${status}` };
}

// ============================================================================
// Step 4 — Become the steward (contract §4 step 4)
// functions/api/keeper/bind.js — the one real cross-app constraint (§4).
// ============================================================================

export interface StewardBindRequest {
  publicCode: string;
  /** Raw, as read/typed by the collector. Never logged, never stored, never put in a URL by this file. */
  ownershipCode: string;
  /** Contested-claim evidence note only; ignored on a clean first bind. */
  note?: string;
}

export interface StewardBindKeeper {
  pieceId: string;
  editionNumber: number;
  claimedAt: string;
}

/**
 * Every reachable outcome of POST /api/keeper/bind (contract §4 step 4,
 * functions/api/keeper/bind.js). Modeled on classifyStewardBindResult in
 * components/legacy/KeeperPanel.tsx, but richer: that reference client
 * collapses everything but 202/2xx into one `error` bucket; this one keeps
 * every server-distinguished case as its own `kind` so collector UI can react
 * differently to, say, "wrong code" versus "already claimed by someone else".
 */
export type StewardBindOutcome =
  | { kind: 'bound'; keeper: StewardBindKeeper }
  | { kind: 'pending'; outcome: 'opened' | 'duplicate'; message: string }
  | { kind: 'mismatch'; message: string }
  | { kind: 'needs_verified_email'; message: string }
  | {
      kind: 'not_ready';
      code: 'plate_not_ready' | 'plate_recovery_not_qualified' | 'identity_recovery_not_qualified';
      message: string;
    }
  | { kind: 'rate_limited'; message: string }
  | { kind: 'conflict'; code: 'already_current_steward' | 'bind_conflict'; message: string }
  | { kind: 'not_registered'; message: string }
  | { kind: 'error'; status: number; error: string; message?: string };

/**
 * POST /api/keeper/bind. Requires a signed-in verified-email session (Better
 * Auth cookie, sent automatically same-origin) — contract §4 step 4, §6.5.
 * Body is whitelisted to exactly `{publicCode, ownershipCode, note?}`; never
 * add pieceId/editionNumber/recoveryCode, which the endpoint rejects with
 * 400 identity_fields_forbidden precisely because they're not authoritative.
 * Not retried by this file — a caller that wants a retry issues a new call.
 */
export async function bindKeeper(request: StewardBindRequest): Promise<StewardBindOutcome> {
  if (!isValidPublicCode(request.publicCode)) {
    return { kind: 'error', status: 404, error: 'not_found', message: 'That code is not a valid piece code.' };
  }
  if (livingLegacyDark()) {
    return { kind: 'error', status: 404, error: 'not_found' };
  }
  const ownershipCode = normalizeOwnershipCode(request.ownershipCode);
  const { status, ok, body } = await rawRequest('/api/keeper/bind', {
    method: 'POST',
    body: JSON.stringify({
      publicCode: request.publicCode,
      ownershipCode,
      ...(request.note?.trim() ? { note: request.note.trim() } : {}),
    }),
  });
  const record = isRecord(body) ? body : {};
  const message = typeof record.message === 'string' ? record.message : '';
  const error = typeof record.error === 'string' ? record.error : '';

  if (status === 202 && record.status === 'claim_requested') {
    const claim = isRecord(record.claim) ? record.claim : {};
    const claimOutcome = claim.outcome === 'duplicate' ? 'duplicate' : 'opened';
    return { kind: 'pending', outcome: claimOutcome, message: message || 'Your stewardship request is recorded for manual review.' };
  }
  if (ok && record.ok === true && isRecord(record.keeper)) {
    const keeper = record.keeper as Record<string, unknown>;
    return {
      kind: 'bound',
      keeper: {
        pieceId: String(keeper.pieceId),
        editionNumber: Number(keeper.editionNumber),
        claimedAt: String(keeper.claimedAt),
      },
    };
  }
  if (status === 404 && error === 'not_registered') {
    return { kind: 'not_registered', message: message || 'This piece is not registered yet.' };
  }
  if (status === 403 && error === 'code_mismatch') {
    return { kind: 'mismatch', message: message || 'That Ownership Code did not match.' };
  }
  if (status === 403 && error === 'verified_email_required') {
    return { kind: 'needs_verified_email', message: message || 'Verify your email before claiming artwork.' };
  }
  if (status === 409
    && (error === 'plate_not_ready' || error === 'plate_recovery_not_qualified' || error === 'identity_recovery_not_qualified')) {
    return { kind: 'not_ready', code: error, message: message || 'This artwork plate is not ready yet.' };
  }
  if (status === 429 && (error === 'claim_rate_limited' || error === 'bind_rate_limited')) {
    return { kind: 'rate_limited', message: message || 'Please wait before trying again.' };
  }
  if (status === 409 && (error === 'already_current_steward' || error === 'bind_conflict')) {
    return { kind: 'conflict', code: error, message: message || 'This piece changed steward. Reload and try again.' };
  }
  return { kind: 'error', status, error: error || `http_${status}`, message: message || undefined };
}

/**
 * The canonical steward deep link (contract §4 step 4, option 1 — recommended
 * for any cross-app collector side). Sends the collector back to this site's
 * own KeeperPanel, which owns sign-in + the authenticated bind; a different
 * domain cannot send this site's session cookie, so it hands the step back
 * rather than trying to bridge it.
 */
export function stewardClaimDeepLink(artworkId: string, publicCode: string): string {
  const query = new URLSearchParams({ instance: publicCode, ref: 'qr', claim: '1' });
  return `/works/${encodeURIComponent(artworkId)}?${query.toString()}`;
}

// ============================================================================
// keeper/piece — the signed-in caller's relationship to a piece
// functions/api/keeper/piece.js. Gated by livingLegacy.
// ============================================================================

/**
 * Present only for the piece's own steward (byYou), and only while a
 * thirty-day silence window is open against this piece
 * (functions/api/_lib/claimSilence.js). remindersSent is a count only —
 * nothing about the claimant is ever included here.
 */
export interface KeeperPendingClaim {
  openedAt: string;
  deadline: string;
  remindersSent: number;
}

export interface KeeperPieceStatus {
  kept: boolean;
  byYou: boolean;
  contributor: boolean;
  keeperPieceId?: string;
  currentDisplayLocation?: string | null;
  stewardHistory?: PublicCreatorHistoryEntry[];
  pendingClaim?: KeeperPendingClaim;
}

/** GET /api/keeper/piece?publicCode=. Requires a signed-in session. */
export async function getKeeperPieceStatus(publicCode: string): Promise<ApiOutcome<KeeperPieceStatus>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  if (!isValidPublicCode(publicCode)) {
    return { ok: false, status: 400, error: 'valid publicCode is required' };
  }
  const query = new URLSearchParams({ publicCode });
  return jsonRequest<{ ok: true } & KeeperPieceStatus>(`/api/keeper/piece?${query.toString()}`)
    .then((outcome) => (outcome.ok ? { ok: true, status: outcome.status, data: outcome.data } : outcome));
}

/**
 * PUT /api/keeper/piece. Steward-only; presentation state, never enters the
 * ledger chain. Pass an empty string to clear the current display location.
 */
export async function setKeeperDisplayLocation(
  publicCode: string,
  currentDisplayLocation: string,
): Promise<ApiOutcome<{ currentDisplayLocation: string | null }>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  if (!isValidPublicCode(publicCode)) {
    return { ok: false, status: 400, error: 'valid publicCode is required' };
  }
  return jsonRequest<{ ok: true; currentDisplayLocation: string | null }>('/api/keeper/piece', {
    method: 'PUT',
    body: JSON.stringify({ publicCode, currentDisplayLocation }),
  }).then((outcome) => (outcome.ok ? { ok: true, status: outcome.status, data: outcome.data } : outcome));
}

// ============================================================================
// keeper/claim-refusal — the steward's one door to refuse an open silence-pass
// window (functions/api/keeper/claim-refusal.js,
// functions/api/_lib/claimSilence.js#refuseSilencePass). Gated by
// livingLegacy, like every other keeper/* endpoint.
// ============================================================================

export interface ClaimRefusalResult {
  publicCode: string;
  /** How many open windows this call closed (ordinarily 1). */
  windows: number;
  refusedAt: string;
}

/**
 * POST /api/keeper/claim-refusal. Requires a signed-in, verified-email
 * session belonging to the piece's current live steward. Errors: 404
 * not_registered (no such piece), 403 not_steward, 404 no_open_claim (no
 * open silence window against this piece), 405 method_not_allowed. Never
 * retried by this file, matching bindKeeper's stance on mutating calls.
 */
export async function refuseClaim(
  publicCode: string,
  note?: string,
): Promise<ApiOutcome<ClaimRefusalResult>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  if (!isValidPublicCode(publicCode)) {
    return { ok: false, status: 400, error: 'valid publicCode is required' };
  }
  return unwrapField(
    jsonRequest<{ ok: true; refused: ClaimRefusalResult }>('/api/keeper/claim-refusal', {
      method: 'POST',
      body: JSON.stringify({ publicCode, ...(note?.trim() ? { note: note.trim() } : {}) }),
    }),
    'refused',
  );
}

// ============================================================================
// keeper/message — the artist's sealed message, met once at the vault
// functions/api/keeper/message.js. Gated by livingLegacy. Steward-only: the
// body never reaches this file's caller unless they are the piece's active
// steward, enforced server-side (a non-steward or dark-flag call answers a
// bare 404, indistinguishable from "no message" at the network layer, so
// this wrapper collapses both into the same absence rather than surfacing
// the 404 as an error the caller has to special-case).
// ============================================================================

export interface KeeperSealedMessage {
  body: string;
  sealedAt: string;
  /** null until the steward's first successful read of this endpoint. */
  revealedAt: string | null;
  /** true only on the call that stamped revealedAt for the first time. */
  firstReveal: boolean;
}

/**
 * GET /api/keeper/message?publicCode=. Requires a signed-in, verified-email
 * session belonging to the piece's active steward. `ok: true, data: null`
 * means "no active message for this piece"; `ok: false` covers the dark
 * flag, a non-steward caller, and any other documented failure — the caller
 * (the collector wiring, right after a bind) treats every non-message
 * outcome the same way: skip quietly, never block the walk.
 */
export async function getKeeperMessage(publicCode: string): Promise<ApiOutcome<KeeperSealedMessage | null>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  if (!isValidPublicCode(publicCode)) return { ok: true, status: 200, data: null };
  const query = new URLSearchParams({ publicCode });
  const { status, ok, body } = await rawRequest(`/api/keeper/message?${query.toString()}`);
  if (!ok) return outcomeError(status, body);
  const record = isRecord(body) ? body : {};
  const message = isRecord(record.message) ? (record.message as unknown as KeeperSealedMessage) : null;
  return { ok: true, status, data: message };
}

// ============================================================================
// keeper/intention — journal + yearly motivation
// functions/api/keeper/intention.js. Gated by livingLegacy.
// ============================================================================

export interface KeeperIntentionsState {
  intentions: IntentionView[];
  birthdayWindow: BirthdayWindowResult;
}

export async function getKeeperIntentions(
  pieceId: string,
  editionNumber = 0,
): Promise<ApiOutcome<KeeperIntentionsState>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  const query = new URLSearchParams({ pieceId, editionNumber: String(editionNumber) });
  return jsonRequest<{ ok: true } & KeeperIntentionsState>(`/api/keeper/intention?${query.toString()}`)
    .then((outcome) => (outcome.ok ? { ok: true, status: outcome.status, data: outcome.data } : outcome));
}

export interface KeeperIntentionComposeResult {
  id: string;
  kind: IntentionKind;
  /** 'open' for a journal entry (never locks); 'pending' for a motivation awaiting confirm. */
  state: 'open' | 'pending';
  setsForYear: number | null;
  contentHash: string;
}

/**
 * action:'compose'. kind:'journal' is never gated; kind:'motivation' is
 * gated by the birthday window and one-per-year (409 birthday_window_closed /
 * already_locked_this_year on rejection).
 */
export async function composeKeeperIntention(input: {
  pieceId: string;
  editionNumber?: number;
  kind: IntentionKind;
  body: string;
}): Promise<ApiOutcome<KeeperIntentionComposeResult>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  return unwrapField(
    jsonRequest<{ ok: true; intention: KeeperIntentionComposeResult }>('/api/keeper/intention', {
      method: 'POST',
      body: JSON.stringify({
        pieceId: input.pieceId,
        editionNumber: input.editionNumber ?? 0,
        action: 'compose',
        kind: input.kind,
        body: input.body,
      }),
    }),
    'intention',
  );
}

export interface KeeperIntentionConfirmResult {
  id: string;
  state: 'locked';
  setsForYear: number | null;
  confirmedAt?: string;
}

/**
 * action:'confirm'. Locks a pending motivation after the grace window
 * (utils/intentions.ts CONFIRM_GRACE_MS); too-early returns 425 with
 * `error` in {'too_soon','grace_not_elapsed'} and a `message`.waitMs is on
 * the raw body, surfaced here via `message` only — read the 425 case's body
 * yourself if you need the numeric wait.
 */
export async function confirmKeeperIntention(input: {
  pieceId: string;
  editionNumber?: number;
  intentionId: string;
}): Promise<ApiOutcome<KeeperIntentionConfirmResult>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  return unwrapField(
    jsonRequest<{ ok: true; intention: KeeperIntentionConfirmResult }>('/api/keeper/intention', {
      method: 'POST',
      body: JSON.stringify({
        pieceId: input.pieceId,
        editionNumber: input.editionNumber ?? 0,
        action: 'confirm',
        intentionId: input.intentionId,
      }),
    }),
    'intention',
  );
}

// ============================================================================
// keeper/contributors — invite/list/revoke contributor access to one piece
// functions/api/keeper/contributors.js. Gated by livingLegacy.
// Types reused (type-only) from utils/artworkContributors.ts, which already
// owns and runtime-validates this exact wire shape for components/legacy/*;
// reusing the type keeps the two representations from drifting apart without
// this file importing that module's fetch code.
// ============================================================================

export interface KeeperContributorList {
  invitations: ContributorInvitation[];
  contributors: ActiveArtworkContributor[];
}

export async function listKeeperContributors(keeperPieceId: string): Promise<ApiOutcome<KeeperContributorList>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  const query = new URLSearchParams({ keeperPieceId });
  return jsonRequest<{ ok: true } & KeeperContributorList>(`/api/keeper/contributors?${query.toString()}`)
    .then((outcome) => (outcome.ok ? { ok: true, status: outcome.status, data: outcome.data } : outcome));
}

export interface KeeperContributorInviteResult {
  invitationId: string;
  status: 'created' | 'replay';
  token: string | null;
}

export async function inviteKeeperContributor(input: {
  keeperPieceId: string;
  intendedRecipientEmail: string;
  /** ISO instant, at most 31 days out. */
  expiresAt: string;
  idempotencyKey?: string;
}): Promise<ApiOutcome<KeeperContributorInviteResult>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  const outcome = await jsonRequest<
    { ok: true; invitationId: string; status: 'created'; token: string }
    | { ok: true; invitationId: string; status: 'replay' }
  >('/api/keeper/contributors', {
    method: 'POST',
    body: JSON.stringify({
      action: 'invite',
      keeperPieceId: input.keeperPieceId,
      intendedRecipientEmail: input.intendedRecipientEmail.trim().toLowerCase(),
      expiresAt: input.expiresAt,
      idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(),
    }),
  });
  if (!outcome.ok) return outcome as ApiOutcome<KeeperContributorInviteResult>;
  return {
    ok: true,
    status: outcome.status,
    data: {
      invitationId: outcome.data.invitationId,
      status: outcome.data.status,
      token: outcome.data.status === 'created' ? outcome.data.token : null,
    },
  };
}

export interface KeeperContributorMutationResult {
  invitationId: string;
  status: 'revoked' | 'replay';
}

export async function revokeKeeperContributor(input: {
  keeperPieceId: string;
  /** Exactly one of invitationId (pending invite) or accessId (active contributor). */
  invitationId?: string;
  accessId?: string;
  idempotencyKey?: string;
}): Promise<ApiOutcome<KeeperContributorMutationResult>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  const target = input.invitationId
    ? { invitationId: input.invitationId }
    : { accessId: input.accessId };
  return jsonRequest<{ ok: true } & KeeperContributorMutationResult>('/api/keeper/contributors', {
    method: 'POST',
    body: JSON.stringify({
      action: 'revoke',
      keeperPieceId: input.keeperPieceId,
      ...target,
      idempotencyKey: input.idempotencyKey ?? crypto.randomUUID(),
    }),
  }).then((outcome) => (outcome.ok ? { ok: true, status: outcome.status, data: outcome.data } : outcome));
}

// ============================================================================
// collector/onboarding — the steward's birth profile
// functions/api/collector/onboarding.js. NOT gated by livingLegacy (unlike
// most of the collector surface — verified directly against the source; see
// the report to the caller for this discrepancy against the rest of §7).
// ============================================================================

export interface CollectorBirthPlace {
  label: string;
  lat: number;
  lng: number;
  tzId: string;
}

export interface CollectorBirthInputs {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour */
  time: string;
  place: CollectorBirthPlace;
}

export type CollectorOnboardingState =
  | { status: 'missing' }
  | { status: 'skipped' }
  | { status: 'current'; inputs: CollectorBirthInputs; computed?: Record<string, unknown>; updatedAt: string };

export async function getCollectorOnboarding(): Promise<ApiOutcome<CollectorOnboardingState>> {
  return jsonRequest<CollectorOnboardingState>('/api/collector/onboarding');
}

export async function saveCollectorBirthProfile(
  inputs: CollectorBirthInputs,
): Promise<ApiOutcome<CollectorOnboardingState>> {
  return jsonRequest<CollectorOnboardingState>('/api/collector/onboarding', {
    method: 'POST',
    body: JSON.stringify({ action: 'save', inputs }),
  });
}

export async function skipCollectorBirthProfile(): Promise<ApiOutcome<CollectorOnboardingState>> {
  return jsonRequest<CollectorOnboardingState>('/api/collector/onboarding', {
    method: 'POST',
    body: JSON.stringify({ action: 'skip' }),
  });
}

// ============================================================================
// collector/privacy — the four-ring privacy model
// functions/api/collector/privacy.js. NOT gated by livingLegacy (verified
// directly against the source, same discrepancy noted above).
// ============================================================================

export interface CollectorPersonPrivacy {
  shareDerivedChart: boolean;
  shareFace: boolean;
  shareName: boolean;
  shareIntention: boolean;
  shareBusiness: boolean;
  shareMission: boolean;
}

export interface CollectorPrivacyState {
  ring1: { privateRecord: true };
  ring2: { shareCity: boolean; cityId: string | null };
  ring3: { shareDerivedChart: boolean };
  ring4: Omit<CollectorPersonPrivacy, 'shareDerivedChart'>;
  policyVersion: string | null;
}

export async function getCollectorPrivacy(keeperPieceId?: string): Promise<ApiOutcome<CollectorPrivacyState>> {
  const query = keeperPieceId ? `?${new URLSearchParams({ piece: keeperPieceId }).toString()}` : '';
  return jsonRequest<CollectorPrivacyState>(`/api/collector/privacy${query}`);
}

export interface CollectorCuratedCity {
  id: string;
  label: string;
}

export async function getCollectorCuratedCities(): Promise<ApiOutcome<CollectorCuratedCity[]>> {
  return unwrapField(
    jsonRequest<{ cities: CollectorCuratedCity[] }>('/api/collector/privacy?view=cities'),
    'cities',
  );
}

/**
 * PUT/POST /api/collector/privacy. `ring1` can never be sent (server rejects
 * it — it is not a choice). Opening `person` any-true or `piece.shareCity`
 * requires an on-file, 18+ birth profile; the server enforces this and
 * answers 404 adult_status_required / minor_publicity_forbidden.
 */
export async function updateCollectorPrivacy(input: {
  person?: CollectorPersonPrivacy;
  piece?: { keeperPieceId: string; shareCity: boolean; cityId: string | null };
}): Promise<ApiOutcome<CollectorPrivacyState>> {
  return jsonRequest<CollectorPrivacyState>('/api/collector/privacy', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// ============================================================================
// collector/dreams + collector/ritual — the yearly dream ritual
// functions/api/collector/dreams.js, functions/api/collector/ritual.js.
// Both gated by livingLegacy.
// ============================================================================

export type CollectorDreamScope = 'self' | 'family' | 'community' | 'planet';
export type CollectorDreamVisibility = 'private' | 'anonymous' | 'attributed';
export type CollectorDreamMarkerKind = 'milestone' | 'change' | 'encounter' | 'fulfillment';

/**
 * The three tiers, named for what they actually do (migration 041,
 * todo/plans/collector-screen-wording.md §6 "Three tiers"): 'shine' is read
 * by anyone who meets the piece and is permanent once entered; 'keep'
 * travels with the piece and opens only to whoever holds it; 'seal' opens to
 * nobody but its writer, ever. Allowed transitions: keep->shine, keep->seal,
 * seal->shine.
 */
export type DreamTier = 'shine' | 'keep' | 'seal';

export interface CollectorDream {
  id: string;
  keeperPieceId: string;
  body: string;
  scope: CollectorDreamScope;
  visibility: CollectorDreamVisibility;
  version: number;
  createdAt: string;
  updatedAt: string;
  sharedAt: string | null;
  revokedAt: string | null;
  fulfilledAt: string | null;
  archivedAt: string | null;
  /** Present once migration 041 is applied server-side. */
  tier?: DreamTier;
  /** "The ones who come after may share this" -- pinned false on 'seal'. */
  heirsMayShare?: boolean;
  /** Convenience mirror of tier === 'seal'. When the signed-in account may
   * not read a body (someone else's sealed words, or another writer's kept
   * words on a piece you no longer hold), the server sends `body` as null;
   * use TieredCollectorDream where that possibility must be typed. */
  sealed?: boolean;
}

/**
 * The post-041 dream shape, precise about withheld bodies: the server sends
 * `body: null` for words the requesting account may not read (seal-tier
 * bodies belong to their writer alone; keep-tier bodies open only to the
 * piece's current holder). The writer always receives their own words.
 */
export interface TieredCollectorDream extends Omit<CollectorDream, 'body' | 'tier' | 'heirsMayShare' | 'sealed'> {
  body: string | null;
  tier: DreamTier;
  heirsMayShare: boolean;
  sealed: boolean;
}

export interface CollectorDreamMarker {
  id: string;
  dreamId: string;
  kind: CollectorDreamMarkerKind;
  body: string;
  createdAt: string;
}

export interface CollectorDreamState {
  keeperPieceId: string;
  current: CollectorDream | null;
  history: CollectorDream[];
  markers: CollectorDreamMarker[];
}

export async function getCollectorDreamState(keeperPieceId: string): Promise<ApiOutcome<CollectorDreamState>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  const query = new URLSearchParams({ piece: keeperPieceId });
  return jsonRequest<CollectorDreamState>(`/api/collector/dreams?${query.toString()}`);
}

function dreamIdempotencyKey(explicit?: string): string {
  return explicit ?? crypto.randomUUID();
}

export async function createCollectorDream(input: {
  keeperPieceId: string;
  body: string;
  scope: CollectorDreamScope;
  /**
   * The destination tier, planted in ONE create (migration 041's optional
   * allowlist fields on action:'create'). Omitted, the server plants at keep
   * with heirs ON — the exact pre-041 body shape. On a pre-041 registry a
   * create asking for anything beyond that default answers 503
   * dream_tiers_unavailable BEFORE inserting anything, so a caller may fall
   * back to the two-step (plain create, then the tier verb) safely.
   */
  tier?: DreamTier;
  /** "The ones who come after may share this." Meaningful on keep; the
   * server pins it false on seal regardless of what is sent. */
  heirsMayShare?: boolean;
  idempotencyKey?: string;
}): Promise<ApiOutcome<CollectorDreamState>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  return jsonRequest<CollectorDreamState>('/api/collector/dreams', {
    method: 'POST',
    body: JSON.stringify({
      action: 'create',
      keeperPieceId: input.keeperPieceId,
      body: input.body,
      scope: input.scope,
      ...(input.tier !== undefined ? { tier: input.tier } : {}),
      ...(input.heirsMayShare !== undefined ? { heirsMayShare: input.heirsMayShare } : {}),
      idempotencyKey: dreamIdempotencyKey(input.idempotencyKey),
    }),
  });
}

export async function updateCollectorDream(input: {
  keeperPieceId: string;
  body: string;
  scope: CollectorDreamScope;
  expectedVersion: number;
  idempotencyKey?: string;
}): Promise<ApiOutcome<CollectorDreamState>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  return jsonRequest<CollectorDreamState>('/api/collector/dreams', {
    method: 'POST',
    body: JSON.stringify({
      action: 'update',
      keeperPieceId: input.keeperPieceId,
      body: input.body,
      scope: input.scope,
      expectedVersion: input.expectedVersion,
      idempotencyKey: dreamIdempotencyKey(input.idempotencyKey),
    }),
  });
}

/** visibility:'anonymous'|'attributed' shares the current dream publicly; requires an on-file 18+ birth profile, and 'attributed' additionally requires shareName consent (contract-adjacent invariant, not in docs/collector-side-handoff.md — see collectorDreams.js requireAdult/requireNameConsent). */
export async function shareCollectorDream(input: {
  keeperPieceId: string;
  visibility: 'anonymous' | 'attributed';
  idempotencyKey?: string;
}): Promise<ApiOutcome<CollectorDreamState>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  return jsonRequest<CollectorDreamState>('/api/collector/dreams', {
    method: 'POST',
    body: JSON.stringify({
      action: 'share',
      keeperPieceId: input.keeperPieceId,
      visibility: input.visibility,
      idempotencyKey: dreamIdempotencyKey(input.idempotencyKey),
    }),
  });
}

export async function revokeCollectorDreamSharing(input: {
  keeperPieceId: string;
  idempotencyKey?: string;
}): Promise<ApiOutcome<CollectorDreamState>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  return jsonRequest<CollectorDreamState>('/api/collector/dreams', {
    method: 'POST',
    body: JSON.stringify({
      action: 'revoke',
      keeperPieceId: input.keeperPieceId,
      visibility: 'private',
      idempotencyKey: dreamIdempotencyKey(input.idempotencyKey),
    }),
  });
}

/**
 * POST action:'tier' — move the standing dream between tiers
 * (functions/api/collector/dreams.js -> collectorDreams.js
 * setCollectorDreamTier). 'keep' is never a destination: shine is permanent
 * and seal->keep is forbidden, so only 'shine' and 'seal' can be asked for.
 * Documented rejections (all 409): shine_is_permanent, shone_cannot_seal,
 * tier_unchanged, dream_sealed, version_conflict, idempotency_conflict;
 * 503 dream_tiers_unavailable while migration 041 has not been applied.
 * Tier changes are not gated by the yearly birthday window.
 */
export async function setCollectorDreamTier(input: {
  keeperPieceId: string;
  tier: Exclude<DreamTier, 'keep'>;
  idempotencyKey?: string;
}): Promise<ApiOutcome<CollectorDreamState>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  return jsonRequest<CollectorDreamState>('/api/collector/dreams', {
    method: 'POST',
    body: JSON.stringify({
      action: 'tier',
      keeperPieceId: input.keeperPieceId,
      tier: input.tier,
      idempotencyKey: dreamIdempotencyKey(input.idempotencyKey),
    }),
  });
}

export async function appendCollectorDreamMarker(input: {
  keeperPieceId: string;
  kind: CollectorDreamMarkerKind;
  body: string;
  idempotencyKey?: string;
}): Promise<ApiOutcome<CollectorDreamState>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  return jsonRequest<CollectorDreamState>('/api/collector/dreams', {
    method: 'POST',
    body: JSON.stringify({
      action: 'marker',
      keeperPieceId: input.keeperPieceId,
      kind: input.kind,
      body: input.body,
      idempotencyKey: dreamIdempotencyKey(input.idempotencyKey),
    }),
  });
}

/**
 * GET /api/collector/dreams/public/:publicCode — the one dream a piece lets
 * shine, if any. Public, no auth. Gated by livingLegacy (bare 404 while off).
 * functions/api/collector/dreams/public/[publicCode].js. A piece with nothing
 * shared answers 200 `{dream: null}`, which is an absence, not an error.
 */
export interface PublicCollectorDream {
  body: string;
  scope: CollectorDreamScope;
  visibility: 'anonymous' | 'attributed';
  attribution: string | null;
  sharedAt: string | null;
}

export async function getPublicDream(
  publicCode: string,
): Promise<ApiOutcome<PublicCollectorDream | null>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  if (!isValidPublicCode(publicCode)) return { ok: true, status: 200, data: null };
  const { status, ok, body } = await rawRequest(
    `/api/collector/dreams/public/${encodeURIComponent(publicCode)}`,
  );
  if (!ok) return outcomeError(status, body);
  const record = isRecord(body) ? body : {};
  const dream = isRecord(record.dream) ? (record.dream as unknown as PublicCollectorDream) : null;
  return { ok: true, status, data: dream };
}

export type CollectorRitualAction = 'reinforce' | 'plant-new' | 'fulfilled';

export interface CollectorRitualEligibility {
  eligible: boolean;
  reason: string | null;
  birthdayYear: number | null;
  actions: CollectorRitualAction[];
  currentDream: CollectorDream | null;
}

export async function getYearlyRitualEligibility(
  keeperPieceId: string,
): Promise<ApiOutcome<CollectorRitualEligibility>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  const query = new URLSearchParams({ piece: keeperPieceId });
  return jsonRequest<CollectorRitualEligibility>(`/api/collector/ritual?${query.toString()}`);
}

export interface CollectorRitualRecord {
  id: string;
  keeperPieceId: string;
  birthdayYear: number;
  action: CollectorRitualAction;
  priorDreamId: string;
  resultingDreamId: string;
  completedAt: string;
}

export interface CollectorRitualCompletion {
  ritual: CollectorRitualRecord;
  state: CollectorDreamState;
  eligibility: CollectorRitualEligibility;
}

/** action:'plant-new' requires body + scope for the new dream; 'reinforce'/'fulfilled' take neither. */
export async function completeYearlyRitual(input: {
  keeperPieceId: string;
  action: CollectorRitualAction;
  body?: string;
  scope?: CollectorDreamScope;
  idempotencyKey?: string;
}): Promise<ApiOutcome<CollectorRitualCompletion>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  const payload: Record<string, unknown> = {
    keeperPieceId: input.keeperPieceId,
    action: input.action,
    idempotencyKey: dreamIdempotencyKey(input.idempotencyKey),
  };
  if (input.action === 'plant-new') {
    payload.body = input.body;
    payload.scope = input.scope;
  }
  return jsonRequest<CollectorRitualCompletion>('/api/collector/ritual', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ============================================================================
// collector/letters — derived, private prose
// functions/api/collector/letters.js. Gated by livingLegacy. GET only: the
// POST side requires the X-Collector-Letters-Key service secret (a
// server-to-server credential this browser client never holds), so letters
// are generated by the backend on lineage events, never by this file.
// ============================================================================

export type CollectorLetterKind = 'kin-claim' | 'anniversary' | 'transfer';

export interface CollectorLetter {
  id: string;
  kind: CollectorLetterKind;
  body: string;
  createdAt: string;
}

export async function getCollectorLetters(keeperPieceId: string): Promise<ApiOutcome<CollectorLetter[]>> {
  if (livingLegacyDark()) return { ok: false, status: 404, error: 'not_found' };
  const query = new URLSearchParams({ piece: keeperPieceId });
  return unwrapField(
    jsonRequest<{ letters: CollectorLetter[] }>(`/api/collector/letters?${query.toString()}`),
    'letters',
  );
}

// ============================================================================
// First-bind invitations (distinct from keeper/contributors above)
// functions/api/invitations/[token].js, functions/api/invitations/redeem.js.
// NOT gated by livingLegacy (verified directly against the source).
// ============================================================================

export type FirstBindInvitationStatus = 'used' | 'revoked' | 'expired' | 'available';

export interface FirstBindInvitationArtwork {
  artworkId: string;
  title: string;
  publicCode: string;
  edition:
    | { kind: 'unique' }
    | { kind: 'numbered'; number: number; size: number | null };
}

export interface FirstBindInvitationInspection {
  invitationId: string;
  artwork: FirstBindInvitationArtwork;
  status: FirstBindInvitationStatus;
}

/**
 * POST /api/invitations/:token — public, no auth required. Note the handler
 * (functions/api/invitations/[token].js) reads `token` from the JSON body,
 * not the URL segment; this file still puts the token in the path too, for
 * a legible request line, and always sends it in the body since that is
 * what the server actually reads.
 */
export async function inspectFirstBindInvitation(token: string): Promise<ApiOutcome<FirstBindInvitationInspection>> {
  const trimmed = token.trim();
  return jsonRequest<{ ok: true } & FirstBindInvitationInspection>(
    `/api/invitations/${encodeURIComponent(trimmed)}`,
    { method: 'POST', body: JSON.stringify({ token: trimmed }) },
  ).then((outcome) => (outcome.ok ? { ok: true, status: outcome.status, data: outcome.data } : outcome));
}

/**
 * POST /api/invitations/redeem. Requires a signed-in verified-email session.
 * On success this is a first bind: the recipient becomes the steward exactly
 * once (piece_already_held on any replay after the first).
 */
export async function redeemFirstBindInvitation(token: string): Promise<ApiOutcome<StewardBindKeeper>> {
  return unwrapField(
    jsonRequest<{ ok: true; keeper: StewardBindKeeper }>('/api/invitations/redeem', {
      method: 'POST',
      body: JSON.stringify({ token: token.trim() }),
    }),
    'keeper',
  );
}

// ============================================================================
// Public Atlas projection — the source of the real claim ordinal (Light N)
// functions/api/atlas.js at /api/atlas. Public, not gated by livingLegacy.
// The bind response carries no ordinal; the atlas's verified projection does,
// per identity row: { publicCode, ordinal, ... } inside state.lights[].
// ============================================================================

interface AtlasIdentityRow {
  publicCode: string | null;
  ordinal: number | null;
}

/**
 * The claim ordinal for one public code, from GET /api/atlas. Returns the
 * ordinal when the atlas has projected a first bind for this code, null when
 * it has not (yet). Failures surface through ApiOutcome; only a rejected
 * fetch throws (CollectorApiNetworkError), matching the rest of this file.
 */
export async function getAtlasOrdinal(publicCode: string): Promise<ApiOutcome<number | null>> {
  if (!isValidPublicCode(publicCode)) return { ok: true, status: 200, data: null };
  const { status, ok, body } = await rawRequest('/api/atlas');
  if (!ok) return outcomeError(status, body);
  const record = isRecord(body) ? body : {};
  const state = isRecord(record.state) ? record.state : {};
  const lights = Array.isArray(state.lights) ? state.lights : [];
  for (const light of lights) {
    if (!isRecord(light) || !Array.isArray(light.identity)) continue;
    for (const identity of light.identity as unknown[]) {
      if (!isRecord(identity)) continue;
      const row = identity as unknown as AtlasIdentityRow;
      if (row.publicCode === publicCode) {
        return {
          ok: true,
          status,
          data: typeof row.ordinal === 'number' && Number.isSafeInteger(row.ordinal) && row.ordinal > 0
            ? row.ordinal
            : null,
        };
      }
    }
  }
  return { ok: true, status, data: null };
}

// ============================================================================
// Public Piece Record (contract-adjacent; endpoint under construction by
// another agent at functions/api/records/[publicCode].js at the time this
// file was written — see the report to the caller). Modeled purely as a URL
// helper + fetch returning the HTML text, since the record is a rendered
// public page, not a JSON payload.
// ============================================================================

export function publicRecordUrl(publicCode: string): string {
  return `/api/records/${encodeURIComponent(publicCode)}`;
}

export type PublicRecordOutcome =
  | { kind: 'html'; html: string }
  | { kind: 'none' }
  | { kind: 'error'; status: number };

export async function getPublicRecord(publicCode: string): Promise<PublicRecordOutcome> {
  if (!isValidPublicCode(publicCode)) return { kind: 'none' };
  let response: Response;
  try {
    response = await fetch(publicRecordUrl(publicCode), {
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (cause) {
    throw new CollectorApiNetworkError(cause);
  }
  if (response.status === 404) return { kind: 'none' };
  if (!response.ok) return { kind: 'error', status: response.status };
  return { kind: 'html', html: await response.text() };
}
