import { findStaticArtwork } from '../../_lib/artworkCatalog.js';
import { jsonResponse, requireAdmin, requireDb } from '../../_lib/admin.js';

function acquisition(row) {
  return {
    acquisitionId: row.id,
    keeperPieceId: row.keeper_piece_id,
    acquisitionType: row.acquisition_type,
    acquiredAt: row.acquired_at ?? null,
    amountMinor: row.amount_minor ?? null,
    currency: row.currency ?? null,
    acquirerReference: row.acquirer_reference ?? null,
    privateNotes: row.private_notes ?? null,
    documentReference: row.document_reference ?? null,
    publicProvenance: row.public_provenance ?? null,
    recordVersion: row.record_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function history(row) {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    eventType: row.event_type,
    administrator: {
      userId: row.administrator_user_id,
      email: row.administrator_email,
    },
    reason: row.reason,
    before: JSON.parse(row.before_json),
    after: JSON.parse(row.after_json),
    outcome: row.outcome,
    relatedRecordId: row.related_record_id ?? null,
    createdAt: row.created_at,
  };
}

export async function onRequest({ request, env, params }) {
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405, { Allow: 'GET' });
  }
  const missingDb = requireDb(env);
  if (missingDb) return missingDb;
  const id = typeof params?.id === 'string' ? params.id.trim() : '';
  if (!id || id.length > 128) return jsonResponse({ ok: false, error: 'not_found' }, 404);

  try {
    const row = await env.DB.prepare(
      `SELECT kp.id, kp.piece_id, kp.edition_number, kp.public_code,
              kp.plate_status, kp.plate_generated_at, kp.plate_activated_at,
              kp.backup_status, kp.backup_at, kp.registered_at,
              kp.keeper_user_id, kp.current_display_location, kp.claimed_at,
              kp.released_at, kp.record_version, kp.steward_version,
              (kp.recovery_code_hash IS NOT NULL) AS verifier_present,
              (kp.ownership_code_ciphertext IS NOT NULL
                AND kp.ownership_code_nonce IS NOT NULL
                AND kp.ownership_code_key_version IS NOT NULL) AS envelope_present,
              ra.title AS registry_title, ra.series AS registry_series,
              ra.edition_size AS registry_edition_size,
              COALESCE(ba.email, u.email) AS steward_email
         FROM keeper_pieces kp
         LEFT JOIN registry_artworks ra ON ra.id = kp.piece_id
         LEFT JOIN user ba ON ba.id = kp.keeper_user_id
         LEFT JOIN users u ON u.clerk_user_id = kp.keeper_user_id
        WHERE kp.id = ?1`,
    ).bind(id).first();
    if (!row) return jsonResponse({ ok: false, error: 'not_found' }, 404);

    const [acquisitionRows, eventRows] = await Promise.all([
      env.DB.prepare(
        `SELECT id, keeper_piece_id, acquisition_type, acquired_at, amount_minor,
                currency, acquirer_reference, private_notes, document_reference,
                public_provenance, record_version, created_at, updated_at
           FROM artwork_acquisitions WHERE keeper_piece_id = ?1
          ORDER BY COALESCE(acquired_at, created_at), id`,
      ).bind(id).all(),
      env.DB.prepare(
        `SELECT id, idempotency_key, event_type, administrator_user_id,
                administrator_email, reason, before_json, after_json, outcome,
                related_record_id, created_at
           FROM registry_maintenance_events WHERE keeper_piece_id = ?1
          ORDER BY created_at, id`,
      ).bind(id).all(),
    ]);
    const staticRecord = findStaticArtwork(row.piece_id);
    return jsonResponse({
      ok: true,
      piece: {
        id: row.id,
        public: {
          artworkId: row.piece_id,
          title: staticRecord?.title ?? row.registry_title ?? row.piece_id,
          series: staticRecord?.series ?? row.registry_series ?? null,
          editionNumber: row.edition_number,
          editionSize: staticRecord?.editionSize ?? row.registry_edition_size ?? null,
          publicCode: row.public_code ?? null,
          plateStatus: row.plate_status,
        },
        physical: {
          registeredAt: row.registered_at ?? null,
          plateGeneratedAt: row.plate_generated_at ?? null,
          plateActivatedAt: row.plate_activated_at ?? null,
          recordVersion: row.record_version,
          recovery: {
            verifierPresent: Boolean(row.verifier_present),
            envelopePresent: Boolean(row.envelope_present),
            backupStatus: row.backup_status ?? null,
            backupAt: row.backup_at ?? null,
          },
        },
        steward: row.keeper_user_id ? {
          userId: row.keeper_user_id,
          email: row.steward_email ?? null,
          active: !row.released_at,
          currentDisplayLocation: row.current_display_location ?? null,
          claimedAt: row.claimed_at ?? null,
          releasedAt: row.released_at ?? null,
          stewardVersion: row.steward_version,
        } : null,
        acquisitions: (acquisitionRows.results || []).map(acquisition),
        maintenanceHistory: (eventRows.results || []).map(history),
      },
    });
  } catch {
    return jsonResponse({ ok: false, error: 'maintenance_detail_failed' }, 500);
  }
}
