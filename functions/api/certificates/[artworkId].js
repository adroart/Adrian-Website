import { jsonResponse, requireDb } from '../_lib/admin.js';
import { resolveInstanceCertificateByPublicCode } from '../_lib/certificateContent.js';

function publicResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': status === 200 ? 'public, max-age=60' : 'no-store',
    },
  });
}

export async function onRequest({ request, env, params }) {
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  const publicCode = new URL(request.url).searchParams.get('publicCode');
  if (!publicCode) return publicResponse({ ok: false, error: 'public_code_required' }, 400);
  try {
    const certificate = await resolveInstanceCertificateByPublicCode(env, {
      artworkId: params.artworkId,
      publicCode,
    });
    return publicResponse({ ok: true, certificate });
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : '';
    if (['certificate_not_found', 'invalid_artwork_id', 'invalid_public_code'].includes(code)) {
      return publicResponse({ ok: false, error: 'certificate_not_found' }, 404);
    }
    return publicResponse({ ok: false, error: 'certificate_failed' }, 500);
  }
}
