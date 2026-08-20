/** Shared central-admin, registry-unlock, database, and audit helpers. */

import { requireAdmin as authorizeAdmin } from './auth.js';

export const REGISTRY_UNLOCK_COOKIE_NAME = 'registry_unlock';
export const REGISTRY_UNLOCK_TTL_SECONDS = 60 * 10;
export const REGISTRY_UNLOCK_ABSOLUTE_CAP_SECONDS = 60 * 60;
const REGISTRY_UNLOCK_DOMAIN = 'adrian-website:registry-unlock:v1';

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
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

function canonicalBase64urlBytes(value) {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const bytes = base64urlToBytes(value);
  if (!bytes || !constantTimeEqual(value, bytesToBase64url(bytes))) return null;
  return bytes;
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

export async function requireAdmin(request, env) {
  const authorization = await authorizeAdmin(request, env);
  return authorization instanceof Response ? authorization : null;
}

/** Central admin authorization that preserves the authenticated identity. */
export async function requireAdminIdentity(request, env) {
  return authorizeAdmin(request, env);
}

export function requireDb(env) {
  if (env.DB) return null;
  return jsonResponse({ ok: false, error: 'db_not_configured' }, 503);
}

export function constantTimeEqual(left, right) {
  const comparisonBytes = 1024;
  const encoder = new TextEncoder();
  const a = encoder.encode(typeof left === 'string' ? left : '');
  const b = encoder.encode(typeof right === 'string' ? right : '');
  let difference = a.length ^ b.length;
  difference |= Number(a.length > comparisonBytes);
  difference |= Number(b.length > comparisonBytes);
  for (let index = 0; index < comparisonBytes; index += 1) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
}

/**
 * Prefer the dedicated registry secret whenever the binding exists. The
 * UPLOAD_SECRET fallback is transitional and applies only when the new binding
 * is absent, never when it is present but empty or invalid.
 */
export function registryStepUpSecret(env) {
  if (env && Object.prototype.hasOwnProperty.call(env, 'REGISTRY_STEP_UP_SECRET')) {
    return typeof env.REGISTRY_STEP_UP_SECRET === 'string' && env.REGISTRY_STEP_UP_SECRET
      ? env.REGISTRY_STEP_UP_SECRET
      : null;
  }
  return typeof env?.UPLOAD_SECRET === 'string' && env.UPLOAD_SECRET
    ? env.UPLOAD_SECRET
    : null;
}

export async function verifyRegistryStepUpSecret(env, candidate) {
  const secret = registryStepUpSecret(env);
  if (!secret || typeof candidate !== 'string' || !candidate) return false;
  const [candidateDigest, secretDigest] = await Promise.all([
    hmacBytes(secret, `${REGISTRY_UNLOCK_DOMAIN}:compare:${candidate}`),
    hmacBytes(secret, `${REGISTRY_UNLOCK_DOMAIN}:compare:${secret}`),
  ]);
  return timingSafeEqual(candidateDigest, secretDigest);
}

/**
 * Mint a signed unlock token bound to one administrator login session.
 *
 * `originalUnlockAt` carries the epoch-seconds timestamp of the first secret
 * exchange across sliding refreshes. Omitted (or invalid) it defaults to the
 * token's own issue time, so a fresh unlock starts the absolute-cap clock.
 */
export async function createRegistryUnlockToken(
  env,
  identity,
  ttlSeconds = REGISTRY_UNLOCK_TTL_SECONDS,
  originalUnlockAt = null,
) {
  const secret = registryStepUpSecret(env);
  if (!secret) throw new Error('registry_unlock_not_configured');
  const sessionId = identity?.session?.id;
  if (typeof sessionId !== 'string' || !sessionId) {
    throw new Error('registry_unlock_session_required');
  }
  const iat = Math.floor(Date.now() / 1000);
  const origIat = typeof originalUnlockAt === 'number'
    && Number.isFinite(originalUnlockAt)
    && originalUnlockAt <= iat
    ? Math.floor(originalUnlockAt)
    : iat;
  const payload = {
    v: 2,
    userId: identity.userId,
    email: typeof identity.email === 'string' ? identity.email.trim().toLowerCase() : '',
    sessionId,
    iat,
    origIat,
    exp: iat + ttlSeconds,
  };
  const payloadB64 = bytesToBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacBytes(secret, `${REGISTRY_UNLOCK_DOMAIN}:token:${payloadB64}`);
  return `${payloadB64}.${bytesToBase64url(signature)}`;
}

export async function readRegistryUnlockToken(request, env, identity) {
  const secret = registryStepUpSecret(env);
  const token = getCookie(request, REGISTRY_UNLOCK_COOKIE_NAME);
  if (!secret || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [payloadB64, signatureB64] = parts;
  const received = canonicalBase64urlBytes(signatureB64);
  const payloadBytes = canonicalBase64urlBytes(payloadB64);
  if (!received || !payloadBytes) return null;
  const expected = await hmacBytes(secret, `${REGISTRY_UNLOCK_DOMAIN}:token:${payloadB64}`);
  if (!timingSafeEqual(expected, received)) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    const now = Math.floor(Date.now() / 1000);
    if (
      payload?.v !== 2
      || typeof payload.userId !== 'string'
      || typeof payload.email !== 'string'
      || typeof payload.sessionId !== 'string'
      || typeof payload.iat !== 'number'
      || typeof payload.exp !== 'number'
      || payload.iat > now
      || payload.exp <= now
      || payload.exp - payload.iat > REGISTRY_UNLOCK_TTL_SECONDS
      || payload.userId !== identity.userId
      || payload.email !== identity.email
      || payload.sessionId !== identity?.session?.id
    ) return null;
    // Tokens minted before sliding refresh existed carry no origIat; treat
    // their issue time as the original unlock so they gain no extra lifetime.
    if (payload.origIat !== undefined
      && (typeof payload.origIat !== 'number' || payload.origIat > payload.iat)) return null;
    const origIat = typeof payload.origIat === 'number' ? payload.origIat : payload.iat;
    // No legitimately issued token can outlive the absolute cap plus one
    // final refresh window; anything beyond that is forged or corrupted.
    if (payload.exp - origIat > REGISTRY_UNLOCK_ABSOLUTE_CAP_SECONDS + REGISTRY_UNLOCK_TTL_SECONDS) {
      return null;
    }
    return { ...payload, origIat };
  } catch {
    return null;
  }
}

export function registryUnlockCookie(token, _request, maxAge = REGISTRY_UNLOCK_TTL_SECONDS) {
  return `${REGISTRY_UNLOCK_COOKIE_NAME}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Secure; Max-Age=${maxAge}`;
}

export function clearRegistryUnlockCookie(request) {
  return registryUnlockCookie('', request, 0);
}

export async function requireRegistryUnlock(request, env) {
  const admin = await requireAdminIdentity(request, env);
  if (admin instanceof Response) return admin;
  if (!registryStepUpSecret(env)) {
    return jsonResponse({ ok: false, error: 'registry_unlock_not_configured' }, 503);
  }
  const unlock = await readRegistryUnlockToken(request, env, admin);
  if (!unlock) return jsonResponse({ ok: false, error: 'registry_locked' }, 403);
  return {
    ...admin,
    registryUnlockExpiresAt: unlock.exp,
    registryUnlockOriginalIat: unlock.origIat,
  };
}

export function ownershipAuditStatement(env, {
  keeperPieceId,
  action,
  outcome,
  requestId = crypto.randomUUID(),
  createdAt = new Date().toISOString(),
}) {
  return env.DB.prepare(
    `INSERT INTO ownership_code_audit
       (id, keeper_piece_id, action, request_id, outcome, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  ).bind(crypto.randomUUID(), keeperPieceId, action, requestId, outcome, createdAt);
}

export async function writeOwnershipAudit(env, details) {
  return ownershipAuditStatement(env, details).run();
}
