import { jsonResponse, requireAdminIdentity, requireDb } from '../_lib/admin.js';
import {
  getCertificateArtworkEditorState,
  setCertificateOverride,
} from '../_lib/certificateContent.js';

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function statusFor(code) {
  if (['invalid_artwork_id', 'invalid_certificate_field', 'invalid_certificate_override',
    'invalid_certificate_value', 'invalid_version'].includes(code)) return 400;
  if (code === 'unknown_artwork') return 404;
  if (code === 'version_conflict') return 409;
  return 500;
}

export async function onRequest({ request, env }) {
  if (!['GET', 'PUT'].includes(request.method)) {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET, PUT' });
  }
  const administrator = await requireAdminIdentity(request, env);
  if (administrator instanceof Response) return administrator;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  if (request.method === 'GET') {
    const artworkId = new URL(request.url).searchParams.get('artworkId');
    if (!artworkId) return jsonResponse({ ok: false, error: 'invalid_artwork_id' }, 400);
    try {
      return jsonResponse({
        ok: true,
        state: await getCertificateArtworkEditorState(env, artworkId),
      });
    } catch (error) {
      const code = typeof error?.code === 'string' ? error.code : 'certificate_override_failed';
      return jsonResponse({ ok: false, error: code }, statusFor(code));
    }
  }
  let body;
  try { body = await request.json(); } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!exactKeys(body, ['artworkId', 'field', 'override', 'expectedVersion'])) {
    return jsonResponse({ ok: false, error: 'invalid_override' }, 400);
  }
  try {
    const override = await setCertificateOverride(env, {
      artworkId: body.artworkId,
      field: body.field,
      override: body.override,
      expectedVersion: body.expectedVersion,
      administrator: { userId: administrator.userId, email: administrator.email },
      updatedAt: new Date().toISOString(),
    });
    return jsonResponse({ ok: true, override });
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'certificate_override_failed';
    return jsonResponse({ ok: false, error: code }, statusFor(code));
  }
}
