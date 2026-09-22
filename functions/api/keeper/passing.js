import { requireUser, normalizeEmail } from '../_lib/auth.js';
import { json, legacyEnabled, migrationNotApplied, notFound, isMissingTableError } from '../_lib/keeper.js';
import {
  acceptCaretakerPassing,
  cancelCaretakerPassing,
  createCaretakerPassing,
  getCaretakerPassingForSender,
  inspectCaretakerPassing,
  resendCaretakerPassing,
} from '../_lib/caretakerPassing.js';

const STATUS = {
  invalid_recipient_email: 400, recipient_readback_required: 400, invalid_transfer_kind: 400,
  invalid_declared_value: 400, invalid_declared_value_method: 400, declared_value_not_allowed: 400,
  invalid_idempotency_key: 400, invalid_token: 400, recipient_is_sender: 409,
  recipient_mismatch: 403, not_your_piece: 403, passing_not_found: 404,
  passing_already_pending: 409, passing_not_pending: 409, passing_expired: 410,
  custody_changed: 409, idempotency_conflict: 409, version_conflict: 409,
  passing_secret_not_configured: 503, atomic_write_unavailable: 503,
};

function responseError(error) {
  const code = typeof error?.code === 'string' ? error.code : 'passing_failed';
  return json({ ok: false, error: code }, STATUS[code] || 500);
}

export async function onRequest({ request, env }) {
  if (!legacyEnabled()) return notFound();
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;
  if (!env.DB) return migrationNotApplied();
  const accountEmail = normalizeEmail(auth.email);
  const verified = auth.user?.emailVerified === true;
  try {
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const token = url.searchParams.get('token') || '';
      const keeperPieceId = url.searchParams.get('keeperPieceId') || '';
      const passing = token
        ? await inspectCaretakerPassing(env, { token, accountEmail, emailVerified: verified })
        : await getCaretakerPassingForSender(env, { keeperPieceId, senderUserId: auth.userId });
      return json({ ok: true, passing });
    }
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'invalid_json' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: 'invalid_json' }, 400);
    let result;
    if (body.action === 'create') result = await createCaretakerPassing(env, {
      senderUserId: auth.userId, keeperPieceId: body.keeperPieceId,
      recipientEmail: body.recipientEmail, confirmedRecipientEmail: body.confirmedRecipientEmail,
      transferKind: body.transferKind, idempotencyKey: body.idempotencyKey,
      declaredValueRaw: body.declaredValueRaw, declaredValueMethod: body.declaredValueMethod,
    });
    else if (body.action === 'cancel') result = await cancelCaretakerPassing(env, {
      senderUserId: auth.userId, passingId: body.passingId,
    });
    else if (body.action === 'resend') result = await resendCaretakerPassing(env, {
      senderUserId: auth.userId, passingId: body.passingId,
    });
    else if (body.action === 'accept') result = await acceptCaretakerPassing(env, {
      token: body.token, userId: auth.userId, accountEmail, emailVerified: verified,
    });
    else return json({ ok: false, error: 'invalid_action' }, 400);
    return json({ ok: true, ...result });
  } catch (error) {
    if (isMissingTableError(error)) return migrationNotApplied();
    return responseError(error);
  }
}
