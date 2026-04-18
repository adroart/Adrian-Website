/**
 * POST /api/upload-music
 *
 * Multipart form fields:
 *   file     — the audio file (MP3, WAV, etc.)
 *   filename — desired filename in the bucket (e.g. "river-poem.mp3")
 *   secret   — must match UPLOAD_SECRET env var
 *
 * Environment variables:
 *   UPLOAD_SECRET  — set in .dev.vars locally, Cloudflare Pages dashboard in prod
 *
 * R2 binding:
 *   MUSIC_BUCKET → adrian-music bucket
 *
 * Returns { ok: true, url: "https://pub-....r2.dev/filename.mp3" }
 */

const PUBLIC_BASE = 'https://pub-c319a4177bc349d7879bd19145ffa2cb.r2.dev';

const ALLOWED_ORIGINS = [
  'https://adrianrasmussen.com',
  'https://www.adrianrasmussen.com',
  'https://adrian-website.pages.dev',
  'http://localhost:8888',
  'http://localhost:5173',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('Origin') || '') });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin') || '';
  const headers = { 'Content-Type': 'application/json', ...corsHeaders(origin) };

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid form data' }), { status: 400, headers });
  }

  const secret = formData.get('secret');
  if (!secret || secret !== env.UPLOAD_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers });
  }

  const file = formData.get('file');
  const filename = formData.get('filename');

  if (!file || !filename) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing file or filename' }), { status: 400, headers });
  }

  const safeFilename = filename.toString().replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
  const contentType = file.type || 'audio/mpeg';
  const buffer = await file.arrayBuffer();

  await env.MUSIC_BUCKET.put(safeFilename, buffer, {
    httpMetadata: { contentType },
  });

  const url = `${PUBLIC_BASE}/${safeFilename}`;
  return new Response(JSON.stringify({ ok: true, url }), { status: 200, headers });
}

export async function onRequestGet({ request, env }) {
  const origin = request.headers.get('Origin') || '';
  const headers = { 'Content-Type': 'application/json', ...corsHeaders(origin) };

  const secret = new URL(request.url).searchParams.get('secret');
  if (!secret || secret !== env.UPLOAD_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers });
  }

  const listed = await env.MUSIC_BUCKET.list();
  const files = listed.objects.map(obj => ({
    key: obj.key,
    url: `${PUBLIC_BASE}/${obj.key}`,
    size: obj.size,
    uploaded: obj.uploaded,
  }));

  return new Response(JSON.stringify({ ok: true, files }), { status: 200, headers });
}
