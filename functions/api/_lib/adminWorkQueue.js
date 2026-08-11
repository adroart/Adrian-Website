import {
  identityRecoveryDependenciesForRow,
  identityRecoveryQualificationStatus,
  loadLatestPassedIdentityQualification,
  loadLatestPassedPieceQualification,
  recoveryDependenciesForRow,
  recoveryQualificationStatus,
} from './recoveryQualification.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const QUEUE_LIMIT = 50;
const RECENT_LIMIT = 5;

function queueError(cause) {
  const error = new Error('work_queue_incomplete');
  error.code = 'work_queue_incomplete';
  error.cause = cause;
  return error;
}

function resultRows(result) {
  if (!result || !Array.isArray(result.results)) throw new Error('invalid_query_result');
  return result.results;
}

async function all(env, sql, ...bindings) {
  return resultRows(await env.DB.prepare(sql).bind(...bindings).all());
}

function instant(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value * 1000;
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function ageSignal(value, now) {
  const at = instant(value);
  const current = instant(now);
  if (at === null || current === null) return 'Date not recorded';
  const days = Math.max(0, Math.floor((current - at) / DAY_MS));
  return days === 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`;
}

function exactPath(path, values) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && String(value)) query.set(key, String(value));
  }
  return `${path}?${query}`;
}

function item(domain, title, state, signal, actionLabel, href, occurredAt, priority) {
  return { domain, title, state, signal, actionLabel, href, occurredAt, priority };
}

function publicItem(value) {
  const { domain, title, state, signal, actionLabel, href } = value;
  return { domain, title, state, signal, actionLabel, href };
}

function itemOrder(left, right) {
  return left.priority - right.priority
    || (instant(left.occurredAt) ?? 0) - (instant(right.occurredAt) ?? 0)
    || left.href.localeCompare(right.href);
}

async function readRecoveryItems(env, keepers, now) {
  const items = [];
  const current = new Set();
  for (const keeper of keepers) {
    const identityQualification = await loadLatestPassedIdentityQualification(env.DB, keeper.id);
    const identity = identityRecoveryQualificationStatus(
      identityQualification,
      identityRecoveryDependenciesForRow(keeper, env),
    );
    if (identity.status !== 'current') {
      items.push(item(
        'recovery', `Artwork ${keeper.piece_id}`, identity.status,
        identity.qualifiedAt ? ageSignal(identity.qualifiedAt, now) : 'No current recovery proof',
        identity.status === 'stale' ? 'Review stale recovery proof' : 'Add recovery proof',
        exactPath('/admin/pieces', { keeperPieceId: keeper.id }),
        identity.qualifiedAt ?? keeper.registered_at, 0,
      ));
      continue;
    }

    if (['generated', 'active'].includes(keeper.plate_status)) {
      const plateQualification = await loadLatestPassedPieceQualification(env.DB, keeper.id);
      const plate = recoveryQualificationStatus(
        plateQualification,
        recoveryDependenciesForRow(keeper, env),
      );
      if (plate.status !== 'current') {
        items.push(item(
          'recovery', `Artwork ${keeper.piece_id}`, plate.status,
          plate.qualifiedAt ? ageSignal(plate.qualifiedAt, now) : 'No current recovery proof',
          plate.status === 'stale' ? 'Refresh recovery proof' : 'Prove copied recovery',
          exactPath('/admin/pieces/wizard', { keeperPieceId: keeper.id }),
          plate.qualifiedAt ?? keeper.registered_at, 0,
        ));
        continue;
      }
    }
    current.add(keeper.id);
  }
  return { items, current };
}

export async function readAdminWorkQueue(env, options = {}) {
  if (!env?.DB || typeof env.DB.prepare !== 'function') throw queueError('db_not_configured');
  const now = options.now ?? new Date().toISOString();
  try {
    const keepers = await all(env, `SELECT id, piece_id, edition_number, keeper_user_id,
      registered_at, claimed_at, released_at, public_code, plate_status, backup_status,
      backup_reference, backup_sha256, ownership_code_key_version,
      identity_backup_status, identity_backup_reference, identity_backup_sha256,
      registration_status
      FROM keeper_pieces
      WHERE registration_status = 'registered'
      ORDER BY registered_at DESC, id DESC`);

    const { items: recoveryItems, current: recoveryCurrent } = await readRecoveryItems(env, keepers, now);

    const [saleItems, artworkRecords, verifiedSales, invoices, viewings, invitations, legacySales, reconnections]
      = await Promise.all([
        all(env, `SELECT id, sale_id, artwork_record_id, created_at
          FROM artist_verified_sale_items ORDER BY created_at DESC, id DESC`),
        all(env, `SELECT id, artwork_id, keeper_piece_id, identification_status, created_at, updated_at
          FROM artist_artwork_records WHERE identification_status = 'identified'
          ORDER BY updated_at DESC, id DESC`),
        all(env, `SELECT id, recorded_at FROM artist_verified_sales
          ORDER BY recorded_at DESC, id DESC`),
        all(env, `SELECT id, invoice_number, public_token, status, job_title,
          total_cents, amount_paid_cents, updated_at, paid_at
          FROM invoices WHERE status IN ('sent', 'paid', 'overdue') OR amount_paid_cents > 0
          ORDER BY updated_at DESC, id DESC`),
        all(env, `SELECT id, status, recipient_name, invoice_token, updated_at, requested_at
          FROM viewings WHERE status IN ('draft', 'requested')
          ORDER BY updated_at DESC, id DESC`),
        all(env, `SELECT invitation.id, invitation.keeper_piece_id, invitation.created_at,
          invitation.expires_at, invitation.revoked_at, redemption.redeemed_at
          FROM artwork_invitations invitation
          LEFT JOIN artwork_invitation_redemptions redemption ON redemption.invitation_id = invitation.id
          ORDER BY invitation.created_at DESC, invitation.id DESC`),
        all(env, `SELECT acquisition.id, acquisition.keeper_piece_id, acquisition.acquisition_type,
          acquisition.acquired_at, acquisition.updated_at
          FROM artwork_acquisitions acquisition
          WHERE acquisition.acquisition_type = 'sale'
          ORDER BY acquisition.updated_at DESC, acquisition.id DESC`),
        all(env, `WITH ranked_status AS (
          SELECT reconnection_case_id, private_note,
            ROW_NUMBER() OVER (PARTITION BY reconnection_case_id ORDER BY created_at DESC, id DESC) AS rank
          FROM artist_reconnection_events WHERE event_type = 'status_changed'
        )
        SELECT reconnect.id, reconnect.recipient_name, reconnect.created_at, reconnect.updated_at,
          coalesce(latest.private_note, reconnect.status) AS effective_status
        FROM artist_reconnection_cases reconnect
        LEFT JOIN ranked_status latest ON latest.reconnection_case_id = reconnect.id AND latest.rank = 1
        ORDER BY reconnect.updated_at DESC, reconnect.id DESC LIMIT 20`),
      ]);

    const queue = [...recoveryItems];
    const saleById = new Map(verifiedSales.map((row) => [row.id, row]));
    const saleItemByRecord = new Map();
    for (const row of saleItems) if (!saleItemByRecord.has(row.artwork_record_id)) {
      saleItemByRecord.set(row.artwork_record_id, row);
    }
    for (const record of artworkRecords) {
      const saleItem = saleItemByRecord.get(record.id);
      if (!saleItem || record.keeper_piece_id) continue;
      const sale = saleById.get(saleItem.sale_id);
      queue.push(item(
        'sale_artwork', `Artwork ${record.artwork_id}`, 'ready_for_registration',
        ageSignal(record.updated_at ?? sale?.recorded_at ?? saleItem.created_at, now),
        'Register artwork identity',
        exactPath('/admin/registrations', {
          artworkId: record.artwork_id,
          artistArtworkRecordId: record.id,
        }),
        record.updated_at ?? sale?.recorded_at ?? saleItem.created_at, 1,
      ));
    }

    const invoiceByToken = new Map(invoices.map((row) => [row.public_token, row]));
    for (const invoice of invoices) {
      const total = Number(invoice.total_cents) || 0;
      const paid = Number(invoice.amount_paid_cents) || 0;
      let state = null;
      let actionLabel = 'Open invoice';
      let priority = 4;
      if (invoice.status === 'paid' || (total > 0 && paid >= total)) {
        state = 'sale_verification_needed';
        actionLabel = 'Verify sale from paid invoice';
        priority = 2;
      } else if (invoice.status === 'overdue') state = 'overdue';
      else if (paid > 0 && paid < total) state = 'partial';
      else if (invoice.status === 'sent') state = 'open';
      if (!state) continue;
      queue.push(item(
        'invoice', `${invoice.invoice_number} · ${invoice.job_title || 'Invoice'}`, state,
        state === 'overdue' ? 'Overdue' : ageSignal(invoice.paid_at ?? invoice.updated_at, now),
        actionLabel, exactPath('/admin/invoices', { invoiceId: invoice.id }),
        invoice.paid_at ?? invoice.updated_at, priority,
      ));
    }

    for (const viewing of viewings) {
      if (viewing.status === 'draft') {
        queue.push(item(
          'viewing', `Viewing ${viewing.id}`, 'draft', ageSignal(viewing.updated_at, now),
          'Continue viewing', exactPath('/admin/viewings', { viewingId: viewing.id }),
          viewing.updated_at, 3,
        ));
      } else if (viewing.status === 'requested' && invoiceByToken.has(viewing.invoice_token)) {
        const linkedInvoice = invoiceByToken.get(viewing.invoice_token);
        queue.push(item(
          'viewing', `Viewing ${viewing.id}`, 'requested_with_invoice',
          ageSignal(viewing.requested_at ?? viewing.updated_at, now), 'Open linked invoice',
          exactPath('/admin/invoices', { invoiceId: linkedInvoice.id }),
          viewing.requested_at ?? viewing.updated_at, 3,
        ));
      }
    }

    const latestInvitation = new Map();
    for (const invitation of invitations) if (!latestInvitation.has(invitation.keeper_piece_id)) {
      latestInvitation.set(invitation.keeper_piece_id, invitation);
    }
    const keeperById = new Map(keepers.map((row) => [row.id, row]));
    const legacyKeeperIds = new Set(legacySales.map((row) => row.keeper_piece_id));
    for (const keeper of keepers) {
      if (!recoveryCurrent.has(keeper.id) || legacyKeeperIds.has(keeper.id)
        || keeper.keeper_user_id || keeper.claimed_at || keeper.released_at) continue;
      const invitation = latestInvitation.get(keeper.id);
      if (invitation?.redeemed_at || invitation?.revoked_at) continue;
      const expired = invitation && instant(invitation.expires_at) <= instant(now);
      const state = invitation ? (expired ? 'expired' : 'ready') : 'unresolved';
      queue.push(item(
        'invitation', `Artwork ${keeper.piece_id}`, state,
        invitation ? (expired ? `Expired ${ageSignal(invitation.expires_at, now)}` : ageSignal(invitation.created_at, now))
          : 'No invitation prepared',
        state === 'expired' ? 'Replace invitation' : state === 'ready' ? 'Open invitation' : 'Create invitation',
        exactPath('/admin/invitations', { keeperPieceId: keeper.id }),
        invitation?.created_at ?? keeper.registered_at, 5,
      ));
    }

    for (const acquisition of legacySales) {
      const artworkId = acquisition.piece_id ?? keeperById.get(acquisition.keeper_piece_id)?.piece_id;
      if (!artworkId) throw new Error('legacy_sale_artwork_missing');
      queue.push(item(
        'legacy_sale', `Artwork ${artworkId}`, 'awaiting_verification',
        ageSignal(acquisition.updated_at ?? acquisition.acquired_at, now), 'Verify legacy sale',
        exactPath('/admin/collector-sales', {
          source: 'legacy_acquisition', acquisitionId: acquisition.id,
          artworkId, keeperPieceId: acquisition.keeper_piece_id,
        }),
        acquisition.updated_at ?? acquisition.acquired_at, 6,
      ));
    }

    const recentArtworks = keepers.slice(0, RECENT_LIMIT).map((keeper) => ({
      title: `Artwork ${keeper.piece_id}`,
      signal: ageSignal(keeper.registered_at, now),
      href: exactPath(`/admin/artworks/${encodeURIComponent(keeper.piece_id)}`, { instance: keeper.id }),
    }));
    const recentCollectors = reconnections.slice(0, RECENT_LIMIT).map((record) => ({
      title: record.recipient_name ? `Reconnection · ${record.recipient_name}` : 'Collector reconnection',
      signal: `${record.effective_status || 'open'} · ${ageSignal(record.updated_at ?? record.created_at, now)}`,
      href: '/admin/collector-sales',
    }));

    return {
      queue: { complete: true, items: queue.sort(itemOrder).slice(0, QUEUE_LIMIT).map(publicItem) },
      recentArtworks,
      recentCollectors,
    };
  } catch (error) {
    if (error?.code === 'work_queue_incomplete') throw error;
    throw queueError(error);
  }
}
