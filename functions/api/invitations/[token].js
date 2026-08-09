import { inspectArtworkInvitation } from '../_lib/artworkInvitations.js';

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      ...headers,
    },
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  }
  if (!env?.DB) return json({ ok: false, error: 'invitation_unavailable' }, 503);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }
  if (
    !body
    || typeof body !== 'object'
    || Array.isArray(body)
    || Object.keys(body).length !== 1
    || typeof body.token !== 'string'
    || !body.token
  ) {
    return json({ ok: false, error: 'invalid_invitation_proof' }, 400);
  }
  try {
    const inspected = await inspectArtworkInvitation(env, body.token);
    return json({ ok: true, ...inspected });
  } catch (error) {
    if (error?.code === 'invitation_not_found') {
      return json({ ok: false, error: 'invitation_not_found' }, 404);
    }
    return json({ ok: false, error: 'invitation_unavailable' }, 503);
  }
}
