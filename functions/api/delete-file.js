/**
 * DELETE /api/delete-file?key=filename.mp3
 * Auth: allowlisted account administrator
 */

import { jsonResponse, requireAdmin } from './_lib/admin.js';

// Keys are flat object names in the music bucket. Reject anything that could
// traverse or reach outside the expected namespace.
const KEY_RE = /^[a-zA-Z0-9._\/-]{1,200}$/;

export async function onRequestDelete({ request, env }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const key = new URL(request.url).searchParams.get('key');
  if (!key) {
    return jsonResponse({ ok: false, error: 'Missing key' }, 400);
  }
  if (!KEY_RE.test(key) || key.includes('..')) {
    return jsonResponse({ ok: false, error: 'Invalid key' }, 400);
  }

  await env.MUSIC_BUCKET.delete(key);
  return jsonResponse({ ok: true });
}
