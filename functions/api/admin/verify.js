/**
 * GET /api/admin/verify
 * Returns the safe identity fields for an authorized Better Auth administrator.
 */

import { privateJsonResponse, requireAdmin } from '../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const authorization = await requireAdmin(request, env);
  if (authorization instanceof Response) return authorization;
  return privateJsonResponse({
    ok: true,
    admin: {
      id: authorization.userId,
      email: authorization.email,
    },
  });
}
