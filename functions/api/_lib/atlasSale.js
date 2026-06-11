/**
 * notifyMandalacodes(env, sale)
 *
 * Fires the M4 sale webhook to mandalacodes after a successful checkout.
 * Contract: mandalacodes/todo/handoff/adrian-website/sale-webhook-spec.md
 *
 * A verified call lands the sale as a PENDING row in the shared D1 table
 * atlas_sale_events; nothing touches the ledger or steward records until
 * Adrian confirms it in /admin/atlas. This call is best-effort: if it fails
 * after retries, the sale still exists in Stripe and Adrian issues the
 * steward manually, exactly as before M4. Never let it block or fail the
 * order write.
 *
 * Signature: hex( HMAC-SHA256( SALE_WEBHOOK_SECRET, `${timestamp}.${rawBody}` ) )
 * timestamp is unix SECONDS, re-stamped on every retry (receiver enforces a
 * ±5-minute replay window). Idempotent on saleId (INSERT OR IGNORE), so
 * retries are safe.
 */

const ENDPOINT = 'https://mandalacodes.com/api/atlas/sale';

// Retry backoff in ms. 400 = sender bug, never retried. 401/5xx/network = retry.
const BACKOFF_MS = [10_000, 60_000, 360_000];

async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Build the canonical payload. Only the fields the spec accepts; unknown
 * fields are rejected (400) by the receiver. Drops undefined/null so the
 * body stays minimal and stable.
 */
function buildPayload(sale) {
  const out = {
    saleId: sale.saleId,
    buyerEmail: sale.buyerEmail,
    saleDate: sale.saleDate,
  };
  if (sale.sku != null) out.sku = sale.sku;
  if (sale.pieceId != null) out.pieceId = sale.pieceId;
  if (sale.editionNumber != null) out.editionNumber = sale.editionNumber;
  if (sale.buyerName) out.buyerName = sale.buyerName;
  if (sale.priceCents != null) out.priceCents = sale.priceCents;
  if (sale.currency) out.currency = sale.currency;
  return out;
}

async function sendOnce(secret, rawBody) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = await hmacHex(secret, `${timestamp}.${rawBody}`);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sale-Timestamp': timestamp,
      'X-Sale-Signature': signature,
    },
    body: rawBody,
  });
  return res;
}

/**
 * @param {object} env  Cloudflare env (needs SALE_WEBHOOK_SECRET)
 * @param {object} sale { saleId, buyerEmail, saleDate, [sku, pieceId,
 *                        editionNumber, buyerName, priceCents, currency] }
 * @returns {Promise<{ ok: boolean, status?: string, reason?: string }>}
 */
export async function notifyMandalacodes(env, sale) {
  if (!env?.SALE_WEBHOOK_SECRET) {
    // Secret not provisioned yet (step c of MORNING-AFTER). No-op quietly;
    // the queue is convenience, not source of truth.
    return { ok: false, reason: 'secret_unset' };
  }
  if (!sale?.saleId || !sale?.buyerEmail || !sale?.saleDate) {
    return { ok: false, reason: 'missing_required_fields' };
  }

  // Serialize ONCE; sign and send these exact bytes (re-serialization breaks
  // the signature). Re-sign timestamp per attempt, same rawBody.
  const rawBody = JSON.stringify(buildPayload(sale));

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await sendOnce(env.SALE_WEBHOOK_SECRET, rawBody);
      if (res.status === 200) {
        const data = await res.json().catch(() => ({}));
        return { ok: true, status: data.status }; // 'queued' | 'duplicate'
      }
      if (res.status === 400) {
        // Payload itself is wrong — retrying as-is can't help.
        console.warn('[atlasSale] 400 rejected; not retrying:', await res.text().catch(() => ''));
        return { ok: false, reason: 'rejected_400' };
      }
      // 401 (clock skew) / 503 (receiver not ready) / 5xx → retry.
    } catch (err) {
      console.warn('[atlasSale] send failed:', err);
    }

    if (attempt >= BACKOFF_MS.length) {
      return { ok: false, reason: 'retries_exhausted' };
    }
    await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
  }
}
