/**
 * recordPendingAtlasSale(env, sale)
 *
 * Enqueues a confirmed Stripe sale as a PENDING row in atlas_sale_events —
 * the same table the mandalacodes admin queue (`/admin/atlas` → Pending
 * Sales, via functions/api/atlas/sales/*) has always read. Ported from
 * mandalacodes' POST /api/atlas/sale receiver (functions/api/atlas/sale.ts)
 * on 2026-09-08.
 *
 * Retired 2026-09-08: this used to be an HTTP call to
 * https://mandalacodes.com/api/atlas/sale, HMAC-signed with
 * SALE_WEBHOOK_SECRET. That endpoint moved the Atlas collector record to
 * this site on 2026-08-09 and its middleware now answers every non-read
 * request with 410 atlas_moved (probed live 2026-09-08) — the webhook
 * retried three times and gave up silently, so no sale ever became a
 * pending row anywhere. atlas_sale_events lives in the SAME D1 database
 * this site already binds as `DB` for orders (migrations/005_atlas_legacy.sql,
 * "OWNED BY ADRIAN-WEBSITE"; mandalacodes reads it through the identical
 * shared binding), so the fix is a direct write, not a network call. No
 * HTTP, no HMAC, no SALE_WEBHOOK_SECRET, no retries — a same-process D1
 * insert either succeeds or it doesn't, and Stripe's own webhook retries
 * cover the "didn't land" case exactly the way idempotent saleId already
 * assumes.
 *
 * Nothing touches the ledger or steward records here — this only enqueues
 * a pending row; confirmation stays an explicit admin action in
 * /admin/atlas, exactly as before. Best-effort and non-fatal: if the D1
 * write fails, the sale still exists in Stripe and Adrian issues the
 * steward by hand, exactly as before this chain existed.
 */

const SALE_STRING_MAX = 300;

function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isIsoDate(value) {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function trimmedOrUndefined(value) {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.length > SALE_STRING_MAX) return undefined;
  return trimmed;
}

/**
 * Validate + normalize a sale into exactly the fields atlas_sale_events
 * accepts. Mirrors mandalacodes' parseSalePayload (utils/saleBridge.ts)
 * closely enough that a row this writes is indistinguishable from one the
 * old webhook would have produced — same whitelist discipline, since this
 * call is now internal but the row is still read by an admin queue.
 */
function normalizeSale(sale) {
  const saleId = trimmedOrUndefined(sale?.saleId);
  if (!saleId) return { ok: false, reason: 'missing_required_fields' };

  const buyerEmail = typeof sale?.buyerEmail === 'string' ? sale.buyerEmail.trim() : '';
  if (!isValidEmail(buyerEmail)) return { ok: false, reason: 'missing_required_fields' };

  if (!isIsoDate(sale?.saleDate)) return { ok: false, reason: 'missing_required_fields' };

  if (
    sale.editionNumber !== undefined
    && sale.editionNumber !== null
    && (!Number.isInteger(sale.editionNumber) || sale.editionNumber < 0)
  ) {
    return { ok: false, reason: 'invalid_edition_number' };
  }

  if (
    sale.priceCents !== undefined
    && sale.priceCents !== null
    && (!Number.isSafeInteger(sale.priceCents) || sale.priceCents < 0)
  ) {
    return { ok: false, reason: 'invalid_price_cents' };
  }

  const currency = trimmedOrUndefined(sale.currency);
  if (currency !== undefined && !/^[A-Za-z]{3}$/.test(currency)) {
    return { ok: false, reason: 'invalid_currency' };
  }

  return {
    ok: true,
    value: {
      saleId,
      sku: trimmedOrUndefined(sale.sku) ?? null,
      pieceId: trimmedOrUndefined(sale.pieceId) ?? null,
      editionNumber: sale.editionNumber ?? null,
      buyerEmail,
      buyerName: trimmedOrUndefined(sale.buyerName) ?? null,
      saleDate: sale.saleDate,
      priceCents: sale.priceCents ?? null,
      currency: currency ? currency.toUpperCase() : null,
    },
  };
}

/**
 * @param {object} env  Cloudflare env (needs DB)
 * @param {object} sale { saleId, buyerEmail, saleDate, [sku, pieceId,
 *                        editionNumber, buyerName, priceCents, currency] }
 * @returns {Promise<{ ok: boolean, status?: 'queued' | 'duplicate', reason?: string }>}
 */
export async function recordPendingAtlasSale(env, sale) {
  if (!env?.DB) return { ok: false, reason: 'db_not_configured' };

  const parsed = normalizeSale(sale);
  if (!parsed.ok) return parsed;
  const value = parsed.value;

  try {
    const result = await env.DB
      .prepare(
        `INSERT OR IGNORE INTO atlas_sale_events
           (sale_id, sku, piece_id, edition_number, buyer_email, buyer_name,
            sale_date, price_cents, currency, status, raw_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', ?10)`,
      )
      .bind(
        value.saleId,
        value.sku,
        value.pieceId,
        value.editionNumber,
        value.buyerEmail,
        value.buyerName,
        value.saleDate,
        value.priceCents,
        value.currency,
        JSON.stringify(value),
      )
      .run();
    const inserted = (result?.meta?.changes ?? 0) > 0;
    return { ok: true, status: inserted ? 'queued' : 'duplicate' };
  } catch (err) {
    console.warn('[atlasSale] pending sale insert failed:', err);
    return { ok: false, reason: 'db_write_failed' };
  }
}
