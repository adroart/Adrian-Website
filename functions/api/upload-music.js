/**
 * POST /api/upload-music  — upload a file to R2
 * GET  /api/upload-music  — list files in R2
 *
 * Auth: allowlisted account administrator
 *
 * R2 binding: MUSIC_BUCKET → adrian-music bucket
 */

import { jsonResponse, requireAdmin } from './_lib/admin.js';

const PUBLIC_BASE = 'https://audio.adrianrasmussen.com';

export async function onRequestPost({ request, env }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid form data' }, 400);
  }

  const file = formData.get('file');
  const filename = formData.get('filename');

  if (!file || !filename) {
    return jsonResponse({ ok: false, error: 'Missing file or filename' }, 400);
  }

  const safeFilename = filename.toString().replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
  const buffer = await file.arrayBuffer();

  await env.MUSIC_BUCKET.put(safeFilename, buffer, {
    httpMetadata: { contentType: file.type || 'audio/mpeg' },
  });

  const url = `${PUBLIC_BASE}/${safeFilename}`;
  return jsonResponse({ ok: true, url });
}

export async function onRequestGet({ request, env }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const listed = await env.MUSIC_BUCKET.list();
  const files = listed.objects.map(obj => ({
    key: obj.key,
    url: `${PUBLIC_BASE}/${obj.key}`,
    size: obj.size,
    uploaded: obj.uploaded,
  }));

  return jsonResponse({ ok: true, files });
}
