import { createAuth } from '../../../lib/account/auth.server.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function privateJsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isSameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function safeReturnPath(value, fallback = '/') {
  const safeFallback = typeof fallback === 'string'
    && fallback.startsWith('/')
    && !fallback.startsWith('//')
    && !fallback.includes('\\')
    ? fallback
    : '/';

  if (typeof value !== 'string') return safeFallback;
  const candidate = value.trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return safeFallback;
  }

  try {
    const parsed = new URL(candidate, 'https://internal.invalid');
    if (parsed.origin !== 'https://internal.invalid') return safeFallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return safeFallback;
  }
}

export const validateReturnPath = safeReturnPath;

export async function verifyRequest(request, env) {
  if (!env?.DB) return null;
  try {
    const auth = createAuth(env);
    const data = await auth.api.getSession({ headers: request.headers });
    if (!data?.user?.id) return null;
    return {
      userId: data.user.id,
      email: data.user.email ?? null,
      session: data.session,
      user: data.user,
    };
  } catch {
    return null;
  }
}

export async function requireUser(request, env) {
  const auth = await verifyRequest(request, env);
  if (!auth) return privateJsonResponse({ error: 'unauthorized' }, 401);
  if (!SAFE_METHODS.has(request.method.toUpperCase()) && !isSameOrigin(request)) {
    return privateJsonResponse({ error: 'origin_forbidden' }, 403);
  }
  return auth;
}

export async function requireAdmin(request, env) {
  const auth = await verifyRequest(request, env);
  if (!auth) {
    return privateJsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }

  const email = normalizeEmail(auth.user.email);
  const allowedEmails = typeof env?.ADMIN_EMAILS === 'string'
    ? env.ADMIN_EMAILS.split(',').map(normalizeEmail).filter(Boolean)
    : [];
  if (auth.user.emailVerified !== true || !email || !allowedEmails.includes(email)) {
    return privateJsonResponse({ ok: false, error: 'forbidden' }, 403);
  }

  if (!SAFE_METHODS.has(request.method.toUpperCase()) && !isSameOrigin(request)) {
    return privateJsonResponse({ ok: false, error: 'origin_forbidden' }, 403);
  }

  return { ...auth, email };
}
