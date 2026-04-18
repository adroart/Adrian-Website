/**
 * POST /api/upload-music  — upload a file to R2
 * GET  /api/upload-music  — list files in R2
 *
 * Auth: admin_session cookie (set by /api/admin/login)
 *
 * R2 binding: MUSIC_BUCKET → adrian-music bucket
 */

const PUBLIC_BASE = 'https://audio.adrianrasmussen.com';
const COOKIE_NAME = 'admin_session';

function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

function isAuthed(request, env) {
  return getCookie(request, COOKIE_NAME) === env.UPLOAD_SECRET;
}

export async function onRequestPost({ request, env }) {
  if (!isAuthed(request, env)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid form data' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const file = formData.get('file');
  const filename = formData.get('filename');

  if (!file || !filename) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing file or filename' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const safeFilename = filename.toString().replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
  const buffer = await file.arrayBuffer();

  await env.MUSIC_BUCKET.put(safeFilename, buffer, {
    httpMetadata: { contentType: file.type || 'audio/mpeg' },
  });

  const url = `${PUBLIC_BASE}/${safeFilename}`;
  return new Response(JSON.stringify({ ok: true, url }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet({ request, env }) {
  if (!isAuthed(request, env)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const listed = await env.MUSIC_BUCKET.list();
  const files = listed.objects.map(obj => ({
    key: obj.key,
    url: `${PUBLIC_BASE}/${obj.key}`,
    size: obj.size,
    uploaded: obj.uploaded,
  }));

  return new Response(JSON.stringify({ ok: true, files }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
