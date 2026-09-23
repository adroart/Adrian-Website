import { jsonResponse, requireAdminIdentity, requireDb } from '../../../_lib/admin.js';
import { serializeInvoiceRow } from '../../../_lib/invoices.js';

const FIELDS = new Set(['paidCents', 'totalCents', 'idempotencyKey']);

async function digest(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const result = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(result)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function paymentError(error) {
  const message = String(error?.message || '');
  if (/invoice not payable/i.test(message)) return ['not_found', 404];
  if (/invoice total conflict/i.test(message)) return ['total_conflict', 409];
  if (/invoice overpayment/i.test(message)) return ['overpayment', 409];
  if (/UNIQUE constraint failed: invoice_payment_events.idempotency_key/i.test(message)) {
    return ['idempotency_race', 409];
  }
  return ['payment_write_failed', 503];
}

async function invoice(env, id) {
  return env.DB.prepare('SELECT * FROM invoices WHERE id = ?1').bind(id).first();
}

async function replay(env, idempotencyKey, requestDigest, invoiceId) {
  const event = await env.DB.prepare(
    `SELECT invoice_id, request_digest FROM invoice_payment_events WHERE idempotency_key = ?1`,
  ).bind(idempotencyKey).first();
  if (!event) return null;
  if (Number(event.invoice_id) !== invoiceId || event.request_digest !== requestDigest) {
    return { conflict: true };
  }
  return { conflict: false, row: await invoice(env, invoiceId) };
}

/**
 * POST { paidCents, idempotencyKey, totalCents? }
 * paidCents is the exact manual payment being recorded. totalCents remains the
 * explicit variant choice seam and may be fixed only before the first payment.
 */
export async function onRequestPost({ request, env, params }) {
  const authorization = await requireAdminIdentity(request, env);
  if (authorization instanceof Response) return authorization;
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return jsonResponse({ ok: false, error: 'invalid_id' }, 400);

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((key) => !FIELDS.has(key))) {
    return jsonResponse({ ok: false, error: 'invalid_input' }, 400);
  }
  if (!Number.isSafeInteger(body.paidCents) || body.paidCents <= 0) {
    return jsonResponse({ ok: false, error: 'invalid_paid_cents' }, 400);
  }
  const totalCents = body.totalCents === undefined ? null : body.totalCents;
  if (totalCents !== null && (!Number.isSafeInteger(totalCents) || totalCents <= 0)) {
    return jsonResponse({ ok: false, error: 'invalid_total_cents' }, 400);
  }
  const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
  if (idempotencyKey.length < 8 || idempotencyKey.length > 128) {
    return jsonResponse({ ok: false, error: 'idempotency_key_required' }, 400);
  }

  const requestDigest = await digest({ invoiceId: id, paidCents: body.paidCents, totalCents });
  try {
    const existing = await replay(env, idempotencyKey, requestDigest, id);
    if (existing) {
      if (existing.conflict) return jsonResponse({ ok: false, error: 'idempotency_conflict' }, 409);
      return jsonResponse({ ok: true, replayed: true, invoice: serializeInvoiceRow(existing.row) });
    }

    await env.DB.prepare(
      `INSERT INTO invoice_payment_events
         (id, invoice_id, idempotency_key, request_digest, paid_cents,
          requested_total_cents, administrator_user_id, administrator_email, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, unixepoch())`,
    ).bind(`payment-${crypto.randomUUID()}`, id, idempotencyKey, requestDigest,
      body.paidCents, totalCents, authorization.userId, authorization.email).run();
    const row = await invoice(env, id);
    return jsonResponse({ ok: true, replayed: false, invoice: serializeInvoiceRow(row) });
  } catch (error) {
    const raced = await replay(env, idempotencyKey, requestDigest, id).catch(() => null);
    if (raced) {
      if (raced.conflict) return jsonResponse({ ok: false, error: 'idempotency_conflict' }, 409);
      return jsonResponse({ ok: true, replayed: true, invoice: serializeInvoiceRow(raced.row) });
    }
    const [code, status] = paymentError(error);
    if (code === 'idempotency_race') return jsonResponse({ ok: false, error: 'idempotency_conflict' }, 409);
    return jsonResponse({ ok: false, error: code }, status);
  }
}
