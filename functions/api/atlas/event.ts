/**
 * POST /api/atlas/event
 *
 * Admin-only. Append a ledger event for a single piece. Validates cityId,
 * type, then computes the hash chain via utils/ledger.appendEvent. After
 * the global ledger is persisted, regenerates atlas/public.json.
 */

import type { LedgerEvent, LedgerEventType } from '../../../types';
import { appendEvent, groupChains } from '../../../utils/ledger';
import { getCityById } from '../../../data/cities';
import type { PagesContext } from './_helpers';
import {
  json,
  isAdmin,
  readLedger,
  writeLedger,
  regeneratePublicState,
} from './_helpers';

const VALID_TYPES: ReadonlySet<LedgerEventType> = new Set<LedgerEventType>([
  'created',
  'placed',
  'moved',
  'withdrawn',
  'revealed',
  'retired',
]);

function isValidEventInput(
  e: unknown,
): e is Omit<LedgerEvent, 'hash' | 'prevHash'> {
  if (!e || typeof e !== 'object') return false;
  const obj = e as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id) return false;
  if (typeof obj.pieceId !== 'string' || !obj.pieceId) return false;
  if (typeof obj.type !== 'string') return false;
  if (!VALID_TYPES.has(obj.type as LedgerEventType)) return false;
  if (typeof obj.date !== 'string' || !obj.date) return false;
  if (obj.actor !== 'admin' && obj.actor !== 'steward') return false;
  if (obj.cityId !== undefined && obj.cityId !== null && typeof obj.cityId !== 'string') {
    return false;
  }
  if (obj.editionNumber !== undefined && typeof obj.editionNumber !== 'number') {
    return false;
  }
  if (obj.note !== undefined && typeof obj.note !== 'string') return false;
  return true;
}

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  if (!isAdmin(request, env)) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const incoming = (body as { event?: unknown })?.event;
  if (!isValidEventInput(incoming)) {
    return json({ ok: false, error: 'Invalid event' }, 400);
  }

  if (incoming.cityId && !getCityById(incoming.cityId)) {
    return json({ ok: false, error: 'Unknown cityId' }, 400);
  }

  const events = await readLedger(env);
  const chains = groupChains(events);
  const key = `${incoming.pieceId}:${incoming.editionNumber ?? 0}`;
  const chain = chains.get(key) ?? [];

  // Genesis guard: a 'created' event for a piece that already has a chain
  // would corrupt the projection. Reject with 409 per spec.
  if (incoming.type === 'created' && chain.length > 0) {
    return json(
      { ok: false, error: 'Genesis event already exists for this piece' },
      409,
    );
  }

  const fullEvent = await appendEvent(chain, incoming);
  events.push(fullEvent);

  await writeLedger(env, events);
  await regeneratePublicState(env, events);

  return json({ ok: true, event: fullEvent });
}
