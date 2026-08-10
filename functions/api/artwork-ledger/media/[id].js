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

function sameAuthorization(left, right) {
  return [
    'ledgerEntryId', 'mediaId', 'artworkRecordId', 'keeperPieceId',
    'keeperUserId', 'claimedAt', 'storageReference', 'sha256',
    'contentType', 'byteLength',
  ].every((key) => left?.[key] === right?.[key]);
}

async function verifiedBytes(object, expected) {
  let stream;
  try {
    stream = object.body?.getReader
      ? object.body
      : new Response(object.body).body;
  } catch { return null; }
  if (!stream?.getReader) return null;
  const reader = stream.getReader();
  const aggregate = new Uint8Array(expected.byteLength);
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (total > expected.byteLength) {
        await reader.cancel().catch(() => {});
        return null;
      }
      aggregate.set(chunk, total - chunk.byteLength);
    }
  } catch { return null; }
  if (total !== expected.byteLength) return null;
  const digest = await crypto.subtle.digest('SHA-256', aggregate);
  const sha256 = Array.from(new Uint8Array(digest), (byte) => (
    byte.toString(16).padStart(2, '0')
  )).join('');
  return sha256 === expected.sha256 ? aggregate : null;
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
    object = await env.ARTWORK_REGISTRY_BACKUP.get(selected.storageReference);
  } catch {
    return response(502);
  }
  if (!validObject(object, selected) || !object.body) {
    return response(object ? 502 : 404);
  }
  const bytes = await verifiedBytes(object, selected);
  if (!bytes) return response(502);

  let rechecked;
  try {
    rechecked = await resolvePublicArtworkLedgerMedia(env, params?.id);
  } catch {
    return hiddenNotFound();
  }
  if (!rechecked || !sameAuthorization(selected, rechecked)) return hiddenNotFound();

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
  return response(200, request.method === 'HEAD' ? null : bytes, headers);
}
