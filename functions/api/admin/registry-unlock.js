import {
  REGISTRY_UNLOCK_TTL_SECONDS,
  clearRegistryUnlockCookie,
  createRegistryUnlockToken,
  jsonResponse,
  readRegistryUnlockToken,
  registryStepUpSecret,
  registryUnlockCookie,
  requireAdminIdentity,
  verifyRegistryStepUpSecret,
} from '../_lib/admin.js';

export async function onRequestPost({ request, env }) {
  const admin = await requireAdminIdentity(request, env);
  if (admin instanceof Response) return admin;
  if (!registryStepUpSecret(env)) {
    return jsonResponse({ ok: false, error: 'registry_unlock_not_configured' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!(await verifyRegistryStepUpSecret(env, body?.secret))) {
    return jsonResponse({ ok: false, error: 'unlock_failed' }, 401);
  }

  const token = await createRegistryUnlockToken(env, admin);
  return jsonResponse(
    { ok: true, expiresIn: REGISTRY_UNLOCK_TTL_SECONDS },
    200,
    { 'Set-Cookie': registryUnlockCookie(token, request) },
  );
}

export async function onRequestGet({ request, env }) {
  const admin = await requireAdminIdentity(request, env);
  if (admin instanceof Response) return admin;
  if (!registryStepUpSecret(env)) {
    return jsonResponse({ ok: false, error: 'registry_unlock_not_configured' }, 503);
  }
  const unlock = await readRegistryUnlockToken(request, env, admin);
  return jsonResponse({
    ok: true,
    unlocked: Boolean(unlock),
    expiresAt: unlock ? new Date(unlock.exp * 1000).toISOString() : null,
  });
}

export async function onRequestDelete({ request, env }) {
  const clearCookie = { 'Set-Cookie': clearRegistryUnlockCookie(request) };
  const origin = request.headers.get('Origin');
  let sameOrigin = false;
  try {
    sameOrigin = Boolean(origin) && origin === new URL(request.url).origin;
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin) {
    return jsonResponse({ ok: false, error: 'origin_forbidden' }, 403, clearCookie);
  }
  return jsonResponse(
    { ok: true, unlocked: false },
    200,
    clearCookie,
  );
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'POST') return onRequestPost(context);
  if (context.request.method === 'DELETE') return onRequestDelete(context);
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
}
