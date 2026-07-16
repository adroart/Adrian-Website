import { jsonResponse } from '../_lib/admin.js';

/**
 * Password-based administration has been replaced by the central account
 * session and administrator email allowlist.
 */
export async function onRequestPost(_context) {
  return jsonResponse({ ok: false, error: 'password_admin_retired' }, 410);
}
