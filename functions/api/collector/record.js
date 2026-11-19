import { isSameOrigin, requireUser } from '../_lib/auth.js';
import { json, legacyEnabled, notFound } from '../_lib/keeper.js';
import { isPublicRegistryCode } from '../../../utils/publicRegistry.ts';
import { refreshPieceRecord } from '../_lib/pieceRecordRefresh.js';
import {
  readPrivateLivingRecord, readPublicLivingRecord, searchMilestonePlaces, writeLivingRecord,
} from '../_lib/collectorLivingRecord.js';

const fields = {
  reflect: ['id', 'body'],
  'successor-access': ['id', 'kind', 'allow'],
  offer: ['id'],
  withdraw: ['id'],
  publish: ['id'],
  milestone: ['id', 'placeId', 'grain', 'year', 'visibility'],
};

export async function onRequest({ request, env }) {
  if (!legacyEnabled()) return notFound();
  const url = new URL(request.url);
  const publicCode = url.searchParams.get('publicCode');
  const view = url.searchParams.get('view');
  const query = url.searchParams.get('q');
  const expectedKeys = request.method === 'GET' ? view === 'places' ? 3 : 2 : 1;
  if (!isPublicRegistryCode(publicCode) || url.searchParams.size !== expectedKeys
    || (request.method === 'GET' && (!['public', 'private', 'places'].includes(view)
      || (view === 'places' && !query)))) {
    return json({ ok: false, error: 'invalid_record_request' }, 400);
  }
  if (!env?.DB) return json({ ok: false, error: 'living_record_unavailable' }, 503);
  try {
    if (request.method === 'GET' && view === 'public') {
      return json({ ok: true, ...await readPublicLivingRecord(env.DB, publicCode) });
    }
    if (request.method !== 'GET' && request.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405);
    }
    const auth = await requireUser(request, env);
    if (auth instanceof Response) return auth;
    if (request.method === 'GET') {
      return view === 'places'
        ? json({ ok: true, places: await searchMilestonePlaces(env.DB, publicCode, auth.userId, query) })
        : json({ ok: true, ...await readPrivateLivingRecord(env.DB, publicCode, auth.userId) });
    }
    if (!isSameOrigin(request)) return json({ ok: false, error: 'origin_forbidden' }, 403);
    const input = await request.json().catch(() => null);
    const allowed = typeof input?.action === 'string' && Object.hasOwn(fields, input.action)
      ? fields[input.action] : null;
    if (!allowed || Object.keys(input).length !== allowed.length + 1
      || !allowed.every(key => Object.hasOwn(input, key))) {
      return json({ ok: false, error: 'invalid_record_request' }, 400);
    }
    const now = new Date().toISOString();
    await writeLivingRecord(env.DB, publicCode, auth.userId, input, now);
    // Publication has committed. Export failure must not report that write as
    // failed; retrying the public action can repair its portable record.
    if (input.action === 'publish' || (input.action === 'milestone' && input.visibility === 'public')) {
      const recordRefresh = await refreshPieceRecord(env, {
        publicCode, trigger: 'contribution', generatedAt: now, includeLegacySections: true,
      });
      return json({ ok: true, recordRefresh });
    }
    return json({ ok: true });
  } catch (error) {
    const code = error?.message;
    if (code === 'invalid_record_entry') return json({ ok: false, error: code }, 400);
    if (code === 'record_not_found') return json({ ok: false, error: code }, 404);
    if (['record_permission_required', 'adult_status_required', 'minor_publicity_forbidden', 'user_not_synced'].includes(code)) {
      return json({ ok: false, error: code }, 403);
    }
    return json({ ok: false, error: 'living_record_unavailable' }, 503);
  }
}
