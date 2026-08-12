import { jsonResponse, requireAdminIdentity, requireDb } from '../_lib/admin.js';
import { assignCertificateTemplate } from '../_lib/certificateContent.js';

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function statusFor(code) {
  if (['invalid_template', 'artwork_ids_required', 'invalid_artwork_id',
    'too_many_artworks', 'idempotency_key_required'].includes(code)) return 400;
  if (['unknown_artwork', 'unknown_template'].includes(code)) return 404;
  if (code === 'idempotency_conflict') return 409;
  return 500;
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'POST' });
  }
  const administrator = await requireAdminIdentity(request, env);
  if (administrator instanceof Response) return administrator;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  let body;
  try { body = await request.json(); } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!exactKeys(body, ['templateId', 'artworkIds', 'idempotencyKey'])) {
    return jsonResponse({ ok: false, error: 'invalid_assignment' }, 400);
  }
  try {
    const assignment = await assignCertificateTemplate(env, {
      templateId: body.templateId,
      artworkIds: body.artworkIds,
      idempotencyKey: body.idempotencyKey,
      administrator: { userId: administrator.userId, email: administrator.email },
      assignedAt: new Date().toISOString(),
    });
    return jsonResponse({ ok: true, assignment });
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'certificate_assignment_failed';
    return jsonResponse({ ok: false, error: code }, statusFor(code));
  }
}
