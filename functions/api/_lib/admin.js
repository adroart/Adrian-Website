const COOKIE_NAME = 'admin_session';

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export function isAdminAuthed(request, env) {
  return Boolean(env.UPLOAD_SECRET) && getCookie(request, COOKIE_NAME) === env.UPLOAD_SECRET;
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

export function requireAdmin(request, env) {
  if (isAdminAuthed(request, env)) return null;
  return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
}

export function requireDb(env) {
  if (env.DB) return null;
  return jsonResponse({ ok: false, error: 'db_not_configured' }, 503);
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

export async function requireAdminPostStepUp(request, env) {
  if (request.method !== 'POST') {
    return { response: jsonResponse({ ok: false, error: 'method_not_allowed' }, 405) };
  }
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return { response: unauthorized };
  if (!isSameOrigin(request)) {
    return { response: jsonResponse({ ok: false, error: 'origin_forbidden' }, 403) };
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return { response: jsonResponse({ ok: false, error: 'invalid_json' }, 400) };
  }
  if (!constantTimeEqual(body?.adminSecret, env.UPLOAD_SECRET)) {
    return { response: jsonResponse({ ok: false, error: 'step_up_failed' }, 401) };
  }
  return { body };
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
