/**
 * POST /api/atlas/steward/update
 *
 * Steward-authenticated. The session cookie carries the piece scope, so the
 * body never re-asserts identity. Diffs the incoming desired state against
 * the current PieceRecord and appends 0..N events to express the change.
 *
 * Diff rules (from spec):
 *   - cityId differs (and current isPublic) → 'placed' if no prior city,
 *     else 'moved'.
 *   - isPublic flipping false (currently public) → 'withdrawn'.
 *   - isPublic flipping true (currently withdrawn) → 'revealed'.
 *   - No-op → return current record, no event appended.
 *
 * cityId must validate via getCityById; notes are admin-only and ignored.
 * On every successful write we refresh the steward session cookie.
 */

import type { LedgerEvent, LedgerEventType, PieceRecord } from '../../../../types';
import { appendEvent, groupChains } from '../../../../utils/ledger';
import { projectPiece } from '../../../../utils/ledgerProjection';
import { getCityById } from '../../../../data/cities';
import type { PagesContext } from '../_helpers';
import {
  json,
  getCookie,
  STEWARD_COOKIE,
  readLedger,
  writeLedger,
  regeneratePublicState,
  verifyStewardSession,
  issueStewardSession,
  stewardSessionCookie,
  isSecureRequest,
} from '../_helpers';

interface UpdateBody {
  cityId?: unknown;
  isPublic?: unknown;
}

function genEventId(): string {
  // Cheap unique-enough id for a low-write ledger. Not a ULID but stable
  // and url-safe; collisions with real ULIDs are astronomically unlikely.
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  let hex = '';
  for (let i = 0; i < rnd.length; i++) hex += rnd[i].toString(16).padStart(2, '0');
  return `evt-${Date.now().toString(36)}-${hex}`;
}

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const token = getCookie(request, STEWARD_COOKIE) || '';
  const session = await verifyStewardSession(token, env.UPLOAD_SECRET);
  if (!session) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  let body: UpdateBody;
  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const cityIdProvided =
    body.cityId !== undefined && body.cityId !== null;
  const cityId = cityIdProvided
    ? typeof body.cityId === 'string'
      ? body.cityId
      : ''
    : null;
  if (cityIdProvided && (!cityId || !getCityById(cityId))) {
    return json({ ok: false, error: 'Unknown cityId' }, 400);
  }

  const isPublicProvided = typeof body.isPublic === 'boolean';
  const desiredIsPublic = isPublicProvided ? (body.isPublic as boolean) : undefined;

  const events = await readLedger(env);
  const chains = groupChains(events);
  const chainKey = `${session.pieceId}:${session.editionNumber ?? 0}`;
  const chain = chains.get(chainKey);
  if (!chain || chain.length === 0) {
    return json(
      { ok: false, error: 'No chain for this piece' },
      403,
    );
  }

  const current: PieceRecord = projectPiece(chain);

  const now = new Date().toISOString();
  const appended: LedgerEvent[] = [];

  // Track running state so multiple flips in one request can produce
  // multiple events in deterministic order.
  let runningChain = chain.slice();
  let runningCity = current.currentCityId;
  let runningIsPublic = current.isPublic;
  let runningStatus = current.status;

  async function pushEvent(
    type: LedgerEventType,
    eventCityId: string | null,
  ): Promise<void> {
    const draft: Omit<LedgerEvent, 'hash' | 'prevHash'> = {
      id: genEventId(),
      pieceId: session!.pieceId,
      editionNumber: session!.editionNumber,
      type,
      date: now,
      cityId: eventCityId,
      actor: 'steward',
    };
    const full = await appendEvent(runningChain, draft);
    runningChain = [...runningChain, full];
    appended.push(full);
  }

  // 1. City change → placed (if seeking) or moved.
  if (cityIdProvided && cityId && cityId !== runningCity) {
    if (runningStatus === 'placed') {
      await pushEvent('moved', cityId);
    } else {
      await pushEvent('placed', cityId);
    }
    runningCity = cityId;
    runningStatus = 'placed';
  }

  // 2. Visibility change.
  if (isPublicProvided) {
    if (desiredIsPublic === false && runningIsPublic) {
      await pushEvent('withdrawn', runningCity);
      runningIsPublic = false;
    } else if (desiredIsPublic === true && !runningIsPublic) {
      await pushEvent('revealed', runningCity);
      runningIsPublic = true;
    }
  }

  // Empty / no-op update: return the current record unchanged.
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  // Refresh the steward session on every authenticated hit (slide TTL).
  const refreshedToken = await issueStewardSession(
    { pieceId: session.pieceId, editionNumber: session.editionNumber },
    env.UPLOAD_SECRET,
  );
  headers['Set-Cookie'] = stewardSessionCookie(
    refreshedToken,
    isSecureRequest(request),
  );

  if (appended.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, piece: current, appended: [] }),
      { status: 200, headers },
    );
  }

  const allEvents = events.concat(appended);
  await writeLedger(env, allEvents);
  await regeneratePublicState(env, allEvents);

  const updated = projectPiece(runningChain);
  return new Response(
    JSON.stringify({ ok: true, piece: updated, appended }),
    { status: 200, headers },
  );
}
