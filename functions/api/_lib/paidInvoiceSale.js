import { createVerifiedSale } from './artistSales.js';
import { resolveArtwork } from './artworkCatalog.js';

function fail(code) {
  throw Object.assign(new Error(code), { code });
}

async function digest(value) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function invoiceRow(env, id) {
  const row = await env.DB.prepare(`
    SELECT id, invoice_number, status, client_name, client_email, currency, total_cents,
           amount_paid_cents, paid_at, job_title, job_description, line_items_json, shipping_text
    FROM invoices WHERE id = ?1
  `).bind(id).first();
  if (!row) fail('invoice_not_found');
  return row;
}

function requirePaid(row) {
  if (row.status !== 'paid' || !Number.isSafeInteger(row.total_cents)
    || row.total_cents <= 0 || row.amount_paid_cents !== row.total_cents
    || !Number.isSafeInteger(row.paid_at) || row.paid_at <= 0) fail('invoice_not_paid');
}

async function linkedSale(env, id) {
  return env.DB.prepare(`
    SELECT source.sale_id AS saleId, source.confirmation_digest AS confirmationDigest, source.invoice_revision AS invoiceRevision,
           record.id AS artworkRecordId, record.keeper_piece_id AS keeperPieceId
    FROM paid_invoice_sales source
    JOIN artist_verified_sale_items item ON item.sale_id = source.sale_id
    JOIN artist_artwork_records record ON record.id = item.artwork_record_id
    WHERE source.invoice_id = ?1
  `).bind(id).first();
}

function safeLink(row) {
  return { saleId: row.saleId, artworkRecordId: row.artworkRecordId, keeperPieceId: row.keeperPieceId };
}

export async function loadPaidInvoiceReview(env, id) {
  const row = await invoiceRow(env, id);
  const linked = await linkedSale(env, id);
  if (!linked) requirePaid(row);
  let items = [];
  try { items = JSON.parse(row.line_items_json); } catch { /* Legacy malformed descriptions are optional. */ }
  const revision = await digest(row);
  return {
    invoice: {
      id: row.id, number: row.invoice_number, title: row.job_title, description: row.job_description,
      buyerName: row.client_name, buyerEmail: row.client_email, currency: row.currency,
      totalCents: row.total_cents, paidDate: new Date(row.paid_at * 1000).toISOString().slice(0, 10),
      shipping: row.shipping_text, revision,
      lineItems: Array.isArray(items) ? items.slice(0, 100).map(item => ({
        description: typeof item?.description === 'string' ? item.description : '',
        terms: typeof item?.terms === 'string' ? item.terms : '',
        hasVariants: Array.isArray(item?.variants) && item.variants.length > 0,
        amountCents: Number.isSafeInteger(item?.amountCents) ? item.amountCents : null,
      })) : [],
    },
    linkedSale: linked ? safeLink(linked) : null,
    invoiceChangedSinceLink: Boolean(linked && linked.invoiceRevision !== revision),
  };
}

export async function reviewPaidInvoice(env, id, body, administrator, now) {
  const { artworkId, edition, saleDate, artworkPriceCents, revision } = body;
  if (typeof artworkId !== 'string' || !/^[A-Z]{2,3}-\d{3}$/.test(artworkId)
    || typeof revision !== 'string' || !/^[a-f0-9]{64}$/.test(revision)
    || body.singleArtwork !== true
    || typeof saleDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(saleDate)
    || (artworkPriceCents !== null && (!Number.isSafeInteger(artworkPriceCents) || artworkPriceCents < 0))) {
    fail('invalid_request');
  }
  const kind = edition?.kind;
  const number = kind === 'unique' ? 0 : edition?.number;
  if (!['unique', 'numbered'].includes(kind) || !Number.isSafeInteger(number)
    || (kind === 'numbered' && (number < 1 || number > 9999))) fail('invalid_request');
  const confirmationDigest = await digest([artworkId, kind, number, saleDate, artworkPriceCents, revision]);
  const replay = async () => {
    const linked = await linkedSale(env, id);
    if (!linked) return null;
    if (linked.confirmationDigest !== confirmationDigest) fail('invoice_sale_conflict');
    return safeLink(linked);
  };
  const previous = await replay();
  if (previous) return previous;

  const invoice = await invoiceRow(env, id);
  requirePaid(invoice);
  if (await digest(invoice) !== revision) fail('invoice_changed');
  if (artworkPriceCents !== null && artworkPriceCents > invoice.total_cents) fail('invalid_request');
  const artwork = await resolveArtwork(env, artworkId);
  if (!artwork) fail('artwork_not_found');
  if (artwork.editionKind !== 'unspecified' && artwork.editionKind !== kind) fail('invalid_edition');
  if (kind === 'numbered' && artwork.editionSize !== null && number > artwork.editionSize) fail('invalid_edition');
  const keeper = await env.DB.prepare(`
    SELECT piece.id
    FROM keeper_pieces piece
    WHERE piece.piece_id = ?1 AND piece.edition_number = ?2 AND piece.registration_status = 'registered'
      AND piece.plate_status NOT IN ('void', 'superseded')
  `).bind(artworkId, number).first();
  const { results: candidates } = await env.DB.prepare(`
    SELECT id, artwork_id, edition_json, keeper_piece_id, identification_status, record_version
    FROM artist_artwork_records WHERE artwork_id = ?1
      AND json_extract(edition_json, '$.kind') = ?2
      AND (?3 = 0 OR json_extract(edition_json, '$.number') = ?3)
    LIMIT 2
  `).bind(artworkId, kind, number).all();
  if (candidates.length > 1) fail('artwork_record_ambiguous');
  const record = candidates[0];
  if (record?.keeper_piece_id && record.keeper_piece_id !== keeper?.id) fail('artwork_record_ambiguous');
  const priorSale = await env.DB.prepare(`SELECT id FROM artist_verified_sales WHERE private_reference = ?1 LIMIT 1`)
    .bind(invoice.invoice_number).first();
  if (priorSale) {
    const concurrent = await replay();
    if (concurrent) return concurrent;
    fail('existing_invoice_reference');
  }


  try {
    await createVerifiedSale(env, {
      occurrence: { precision: 'exact', value: saleDate },
      buyerEmail: invoice.client_email || null,
      total: { amountMinor: invoice.total_cents, currency: invoice.currency },
      privateReference: invoice.invoice_number,
      privateNotes: null, reconnectionCaseId: null,
      artworks: [{
        artworkRecordId: record?.id ?? null,
        artworkId: record ? null : artworkId,
        edition: record ? null : kind === 'unique' ? { kind } : { kind, number, size: artwork.editionSize },
        price: artworkPriceCents === null ? null : { amountMinor: artworkPriceCents, currency: invoice.currency },
      }],
      idempotencyKey: `paid-invoice:${id}`, administrator, recordedAt: now,
    }, { invoice, confirmationDigest, revision, keeperPieceId: keeper?.id ?? null, record, artworkId, kind, number });
  } catch (error) {
    const concurrent = await replay();
    if (concurrent) return concurrent;
    if (await digest(await invoiceRow(env, id)) !== revision) fail('invoice_changed');
    throw error;
  }
  const linked = await replay();
  if (!linked) fail('atomic_write_failed');
  return linked;
}
