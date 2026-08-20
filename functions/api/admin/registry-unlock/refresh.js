/**
 * Sliding refresh for the registry step-up unlock.
 *
 * Re-issues the unlock cookie with a fresh ten-minute TTL while a ceremony is
 * still active. It never resurrects an expired or invalid cookie, and it
 * preserves the original unlock time so the sixty-minute absolute cap holds:
 * past the cap the administrator must re-enter the registry secret.
 */
import {
  REGISTRY_UNLOCK_ABSOLUTE_CAP_SECONDS,
  REGISTRY_UNLOCK_TTL_SECONDS,
  clearRegistryUnlockCookie,
  createRegistryUnlockToken,
  jsonResponse,
  readRegistryUnlockToken,
  registryStepUpSecret,
  registryUnlockCookie,
  requireAdminIdentity,
} from '../../_lib/admin.js';

export async function onRequestPost({ request, env }) {
  const admin = await requireAdminIdentity(request, env);
  if (admin instanceof Response) return admin;
  if (!registryStepUpSecret(env)) {
    return jsonResponse({ ok: false, error: 'registry_unlock_not_configured' }, 503);
  }

  // Missing, tampered, mismatched, and expired cookies all fail inside
  // readRegistryUnlockToken and share this one response shape.
  const unlock = await readRegistryUnlockToken(request, env, admin);
  if (!unlock) return jsonResponse({ ok: false, error: 'registry_locked' }, 403);

  const now = Math.floor(Date.now() / 1000);
  if (now - unlock.origIat > REGISTRY_UNLOCK_ABSOLUTE_CAP_SECONDS) {
    console.warn('[registry-unlock/refresh] absolute cap reached for user', admin.userId);
    return jsonResponse(
      { ok: false, error: 'unlock_absolute_cap' },
      403,
      { 'Set-Cookie': clearRegistryUnlockCookie(request) },
    );
  }

  const token = await createRegistryUnlockToken(
    env,
    admin,
    REGISTRY_UNLOCK_TTL_SECONDS,
    unlock.origIat,
  );
  console.log('[registry-unlock/refresh] refreshed for user', admin.userId);
  return jsonResponse(
    { ok: true, expiresIn: REGISTRY_UNLOCK_TTL_SECONDS },
    200,
    { 'Set-Cookie': registryUnlockCookie(token, request) },
  );
}

export async function onRequest(context) {
  if (context.request.method === 'POST') return onRequestPost(context);
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
}
