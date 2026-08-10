import { resolvePublicArtworkLedgerMedia } from '../../_lib/certificateContent.js';

const CACHE_CONTROL = 'private, max-age=0, must-revalidate';

function response(status, body = null, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

function hiddenNotFound() {
  return response(404);
}

function validObject(object, expected) {
  return object
    && object.key === expected.storageReference
    && Number(object.size) === expected.byteLength
    && object.httpMetadata?.contentType === expected.contentType;
}

export async function onRequest({ request, env, params }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return response(405, null, { Allow: 'GET, HEAD' });
  }
  if (!env?.DB || !env?.ARTWORK_REGISTRY_BACKUP) return response(502);

  let selected;
  try {
    selected = await resolvePublicArtworkLedgerMedia(env, params?.id);
  } catch {
    return hiddenNotFound();
  }
  if (!selected) return hiddenNotFound();

  let object;
  try {
    object = request.method === 'HEAD'
      ? await env.ARTWORK_REGISTRY_BACKUP.head(selected.storageReference)
      : await env.ARTWORK_REGISTRY_BACKUP.get(selected.storageReference);
  } catch {
    return response(502);
  }
  if (!validObject(object, selected) || (request.method === 'GET' && !object.body)) {
    return response(object ? 502 : 404);
  }

  const etag = `"${selected.sha256}"`;
  const headers = {
    'Cache-Control': CACHE_CONTROL,
    'Content-Type': selected.contentType,
    'Content-Length': String(selected.byteLength),
    ETag: etag,
  };
  if (request.headers.get('If-None-Match') === etag) {
    return response(304, null, headers);
  }
  return response(200, request.method === 'HEAD' ? null : object.body, headers);
}
