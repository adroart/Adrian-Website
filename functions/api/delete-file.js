/**
 * DELETE /api/delete-file?key=filename.mp3
 * Auth: admin_session cookie
 */

const COOKIE_NAME = 'admin_session';

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export async function onRequestDelete({ request, env }) {
  if (getCookie(request, COOKIE_NAME) !== env.UPLOAD_SECRET) {
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

  await env.MUSIC_BUCKET.delete(key);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
