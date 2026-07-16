/**
 * Catch-all handler for Better Auth. Every /api/auth/* request (send code,
 * verify code, email/password, session, sign-out, and OAuth callbacks) is
 * handled here.
 *
 * The auth instance is built per-request because Pages Functions have no
 * module-global env. `context.request` is a standard Request and
 * `auth.handler` returns a standard Response.
 */

import { createAuth } from '../../../lib/account/auth.server.js';

export async function onRequest(context) {
  const auth = createAuth(context.env, context.waitUntil?.bind(context));
  return auth.handler(context.request);
}
