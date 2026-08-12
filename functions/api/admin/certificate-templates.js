import { jsonResponse, requireAdminIdentity, requireDb } from '../_lib/admin.js';
import {
  createCertificateTemplate,
  listCertificateTemplates,
} from '../_lib/certificateContent.js';

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function statusFor(code) {
  if (['invalid_template', 'invalid_certificate_content', 'invalid_certificate_field',
    'invalid_certificate_value'].includes(code)) return 400;
  return 500;
}

export async function onRequest({ request, env }) {
  if (!['GET', 'POST'].includes(request.method)) {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' });
  }
  const administrator = await requireAdminIdentity(request, env);
  if (administrator instanceof Response) return administrator;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  if (request.method === 'GET') {
    try {
      return jsonResponse({ ok: true, templates: await listCertificateTemplates(env) });
    } catch {
      return jsonResponse({ ok: false, error: 'certificate_templates_failed' }, 500);
    }
  }

  let body;
  try { body = await request.json(); } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!exactKeys(body, ['name', 'content'])) {
    return jsonResponse({ ok: false, error: 'invalid_template' }, 400);
  }
  try {
    const template = await createCertificateTemplate(env, {
      name: body.name,
      content: body.content,
      administrator: { userId: administrator.userId, email: administrator.email },
      createdAt: new Date().toISOString(),
    });
    return jsonResponse({ ok: true, template }, 201);
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'certificate_template_failed';
    return jsonResponse({ ok: false, error: code }, statusFor(code));
  }
}
