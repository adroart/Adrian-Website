import { isPublicRegistryCode } from '../../../utils/publicRegistry.ts';
import { requireUser, privateJsonResponse } from '../_lib/auth.js';
import { resolveCurrentKeeperPriceHistory } from '../_lib/certificateContent.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return privateJsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  if (!env?.DB) return privateJsonResponse({ ok: false, error: 'ledger_unavailable' }, 503);

  const url = new URL(request.url);
  const publicCode = url.searchParams.get('publicCode');
  if (url.searchParams.size !== 1 || !isPublicRegistryCode(publicCode)) {
    return privateJsonResponse({ ok: false, error: 'not_found' }, 404);
  }
  try {
    const priceHistory = await resolveCurrentKeeperPriceHistory(env, {
      publicCode,
      userId: auth.userId,
    });
    return privateJsonResponse({ ok: true, priceHistory });
  } catch (error) {
    if (error?.code === 'not_current_keeper' || error?.code === 'invalid_public_code') {
      return privateJsonResponse({ ok: false, error: 'not_current_keeper' }, 403);
    }
    if (error?.code === 'current_keeper_ledger_unavailable') {
      return privateJsonResponse({
        ok: false, error: 'ledger_unavailable', currentKeeper: true,
      }, 503);
    }
    return privateJsonResponse({ ok: false, error: 'ledger_unavailable' }, 503);
  }
}
