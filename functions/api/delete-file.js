/**
 * DELETE /api/delete-file?key=filename.mp3
 * Auth: admin_session cookie (signed token)
 */

import { isAdminAuthed } from './_lib/admin.js';

// Keys are flat object names in the music bucket. Reject anything that could
// traverse or reach outside the expected namespace.
const KEY_RE = /^[a-zA-Z0-9._\/-]{1,200}$/;

export async function onRequestDelete({ request, env }) {
  if (!(await isAdminAuthed(request, env))) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const key = new URL(request.url).searchParams.get('key');
  if (!key) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing key' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!KEY_RE.test(key) || key.includes('..')) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid key' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  await env.MUSIC_BUCKET.delete(key);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
