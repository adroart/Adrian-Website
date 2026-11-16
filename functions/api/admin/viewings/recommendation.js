import { jsonResponse, requireAdmin } from '../../_lib/admin.js';

const ORACLE_RECOMMENDATION_URL = 'https://mandalacodes.com/api/oracle/recommendation';

export async function onRequest({ request, env }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const token = env?.ORACLE_API_TOKEN;
  if (typeof token !== 'string' || !token.trim()) {
    return jsonResponse({ error: 'recommendation_unavailable' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || (body.profile !== undefined
      && (!body.profile || typeof body.profile !== 'object' || Array.isArray(body.profile)))
    || (body.utcBirth !== undefined && typeof body.utcBirth !== 'string')
    || (!body.profile && !body.utcBirth)) {
    return jsonResponse({ error: 'chart_required' }, 400);
  }
  const chart = {
    clientName: body.clientName,
    profile: body.profile,
    utcBirth: body.utcBirth,
  };

  try {
    const upstream = await fetch(ORACLE_RECOMMENDATION_URL, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(chart),
    });
    if (!upstream.ok) {
      return jsonResponse({ error: 'recommendation_unavailable' }, 502);
    }
    const result = await upstream.json();
    if (!result || !Array.isArray(result.pieces)) {
      return jsonResponse({ error: 'recommendation_unavailable' }, 502);
    }
    return jsonResponse(result);
  } catch {
    return jsonResponse({ error: 'recommendation_unavailable' }, 502);
  }
}
