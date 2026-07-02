/**
 * Admin authentication for the studio-only endpoints.
 *
 * SECURITY MODEL (rewritten 2026-06-16):
 * The session cookie is a SIGNED, EXPIRING token — NOT the raw admin secret.
 * Previously the cookie value was `UPLOAD_SECRET` verbatim, so the master
 * secret travelled in every request and a single cookie leak was a permanent,
 * unrevocable full compromise. Now the cookie is `base64url(payload).sigHex`
 * where payload = { exp } and sig = HMAC-SHA256(UPLOAD_SECRET, payloadB64).
 *
 *  - The raw secret never leaves the server.
 *  - Tokens expire (default 7 days), bounding the blast radius of a leak.
 *  - Verification is constant-time (no signature timing oracle).
 *
 * Legacy cookies (value === raw secret) are intentionally NOT accepted: those
 * cookies ARE the vulnerability. Existing admin sessions are invalidated by
 * this change and the admin simply signs in again.
 */

const COOKIE_NAME = 'admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

// --- byte / base64url helpers ------------------------------------------------

function bytesToBase64url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(str) {
  try {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const binary = atob(b64 + pad);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Constant-time equality for two Uint8Arrays. */
function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacBytes(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

// --- session tokens ----------------------------------------------------------

/** Mint a signed, expiring admin session token. */
export async function createAdminSessionToken(env, ttlSeconds = SESSION_TTL_SECONDS) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payloadB64 = bytesToBase64url(new TextEncoder().encode(JSON.stringify({ exp })));
  const sig = await hmacBytes(env.UPLOAD_SECRET, payloadB64);
  return `${payloadB64}.${bytesToBase64url(sig)}`;
}

/** Constant-time check of a candidate admin password against UPLOAD_SECRET. */
export async function verifyAdminPassword(env, password) {
  if (!env.UPLOAD_SECRET || typeof password !== 'string' || !password) return false;
  // Compare HMACs (fixed 32-byte length) so neither length nor content of the
  // secret leaks via timing. HMAC is deterministic, so the digests match iff
  // password === UPLOAD_SECRET.
  const [a, b] = await Promise.all([
    hmacBytes(env.UPLOAD_SECRET, password),
    hmacBytes(env.UPLOAD_SECRET, env.UPLOAD_SECRET),
  ]);
  return timingSafeEqual(a, b);
}

export async function isAdminAuthed(request, env) {
  if (!env.UPLOAD_SECRET) return false;
  const token = getCookie(request, COOKIE_NAME);
  if (!token || !token.includes('.')) return false;

  const [payloadB64, sigB64] = token.split('.');
  if (!payloadB64 || !sigB64) return false;

  const expected = await hmacBytes(env.UPLOAD_SECRET, payloadB64);
  const got = base64urlToBytes(sigB64);
  if (!timingSafeEqual(expected, got)) return false;

  const payloadBytes = base64urlToBytes(payloadB64);
  if (!payloadBytes) return false;
  try {
    const { exp } = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (typeof exp !== 'number' || exp < Math.floor(Date.now() / 1000)) return false;
  } catch {
    return false;
  }
  return true;
}

export async function requireAdmin(request, env) {
  if (await isAdminAuthed(request, env)) return null;
  return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
}

export function requireDb(env) {
  if (env.DB) return null;
  return jsonResponse({ ok: false, error: 'db_not_configured' }, 503);
}
