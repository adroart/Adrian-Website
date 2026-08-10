import { resolveArtwork } from './artworkCatalog.js';
import { resolveArtworkCertificate } from './certificateContent.js';
import {
  identityRecoveryDependenciesForRow,
  identityRecoveryQualificationStatus,
  loadLatestPassedIdentityQualification,
  loadLatestPassedPieceQualification,
  recoveryDependenciesForRow,
  recoveryQualificationStatus,
} from './recoveryQualification.js';

const CERTIFICATE_FIELDS = [
  'certificateWording', 'editionWording', 'makers', 'materials',
  'openingWording', 'origin', 'techniques', 'yearWording',
];

function workspaceError(code) {
  return Object.assign(new Error(code), { code });
}

async function first(env, sql, ...values) {
  return env.DB.prepare(sql).bind(...values).first();
}

async function all(env, sql, ...values) {
  const result = await env.DB.prepare(sql).bind(...values).all();
  return result?.results ?? [];
}

async function selectedRecord(env, selector) {
  if (selector.artistArtworkRecordId) {
    const row = await first(env, `
      SELECT id, artwork_id, edition_json, keeper_piece_id, identification_status,
             created_at, updated_at
        FROM artist_artwork_records
       WHERE id = ?1
    `, selector.artistArtworkRecordId);
    if (!row) throw workspaceError('workspace_not_found');
    return row;
  }
  if (selector.keeperPieceId) {
    const rows = await all(env, `
      SELECT id, artwork_id, edition_json, keeper_piece_id, identification_status,
             created_at, updated_at
        FROM artist_artwork_records
       WHERE keeper_piece_id = ?1
       ORDER BY id
       LIMIT 2
    `, selector.keeperPieceId);
    if (rows.length > 1) throw workspaceError('workspace_data_corrupt');
    return rows[0] ?? null;
  }
  if (!selector.artworkId) return null;
  const rows = await all(env, `
    SELECT id, artwork_id, edition_json, keeper_piece_id, identification_status,
           created_at, updated_at
      FROM artist_artwork_records
     WHERE artwork_id = ?1
     ORDER BY id
     LIMIT 2
  `, selector.artworkId);
  if (rows.length > 1) throw workspaceError('workspace_selector_conflict');
  return rows[0] ?? null;
}

async function selectedKeeper(env, selector, record) {
  const keeperPieceId = selector.keeperPieceId ?? record?.keeper_piece_id ?? null;
  if (!keeperPieceId) return null;
  const row = await first(env, `
    SELECT id, piece_id, edition_number, keeper_user_id, registered_at, claimed_at, released_at,
           public_code, plate_status, backup_status, backup_reference, backup_sha256,
           ownership_code_key_version, front_svg_sha256, back_svg_sha256,
           identity_backup_status, identity_backup_reference, identity_backup_sha256,
           registration_status, plate_generated_at, plate_activated_at
      FROM keeper_pieces
     WHERE id = ?1
  `, keeperPieceId);
  if (!row) throw workspaceError('workspace_not_found');
  return row;
}

function validateRecord(row) {
  if (!row) return;
  const shapeIsValid = row.identification_status === 'unresolved'
    ? row.artwork_id === null && row.keeper_piece_id === null
    : row.identification_status === 'identified'
      ? typeof row.artwork_id === 'string' && row.artwork_id && row.keeper_piece_id === null
      : row.identification_status === 'identity_linked'
        && typeof row.artwork_id === 'string' && row.artwork_id
        && typeof row.keeper_piece_id === 'string' && row.keeper_piece_id;
  if (!shapeIsValid) throw workspaceError('workspace_data_corrupt');
  if (row.identification_status === 'unresolved' && row.edition_json !== null) {
    throw workspaceError('workspace_data_corrupt');
  }
  if (row.identification_status !== 'unresolved') {
    try {
      const edition = JSON.parse(row.edition_json);
      const valid = edition && typeof edition === 'object' && !Array.isArray(edition)
        && Object.keys(edition).sort().join('\0') === 'kind\0number\0size'
        && ((edition.kind === 'unique' && edition.number === null && edition.size === null)
          || (edition.kind === 'numbered' && Number.isSafeInteger(edition.number)
            && edition.number >= 1 && (edition.size === null
              || (Number.isSafeInteger(edition.size) && edition.size >= edition.number))));
      if (!valid) throw new Error();
    } catch {
      throw workspaceError('workspace_data_corrupt');
    }
  }
}

function validateSelection(selector, record, keeper) {
  if (record?.identification_status === 'unresolved'
    && (selector.artworkId || selector.keeperPieceId)) {
    throw workspaceError('workspace_selector_conflict');
  }
  if (record?.identification_status === 'identified' && selector.keeperPieceId) {
    throw workspaceError('workspace_selector_conflict');
  }
  if (selector.artworkId && record?.artwork_id && selector.artworkId !== record.artwork_id) {
    throw workspaceError('workspace_selector_conflict');
  }
  if (selector.keeperPieceId && record && record.keeper_piece_id !== selector.keeperPieceId) {
    throw workspaceError('workspace_selector_conflict');
  }
  if (record?.keeper_piece_id && keeper?.id !== record.keeper_piece_id) {
    throw workspaceError('workspace_data_corrupt');
  }
  if (record?.artwork_id && keeper && record.artwork_id !== keeper.piece_id) {
    throw workspaceError('workspace_data_corrupt');
  }
  if (record?.keeper_piece_id && keeper) {
    const edition = JSON.parse(record.edition_json);
    const number = edition.kind === 'unique' ? 0 : edition.number;
    if (Number(keeper.edition_number) !== number) {
      throw workspaceError('workspace_data_corrupt');
    }
  }
  if (selector.artworkId && keeper && selector.artworkId !== keeper.piece_id) {
    throw workspaceError('workspace_selector_conflict');
  }
}

async function certificateProjection(env, artworkId) {
  if (!artworkId) return { state: 'unavailable', missingFields: [] };
  const content = await resolveArtworkCertificate(env, artworkId);
  const missingFields = CERTIFICATE_FIELDS.filter((field) => !(field in content));
  return {
    state: missingFields.length === CERTIFICATE_FIELDS.length
      ? 'missing' : missingFields.length ? 'incomplete' : 'complete',
    missingFields,
  };
}

async function invitationProjection(env, keeperPieceId, now) {
  if (!keeperPieceId) return null;
  const row = await first(env, `
    SELECT invitation.id, invitation.expires_at, invitation.revoked_at,
           redemption.redeemed_at
      FROM artwork_invitations invitation
      LEFT JOIN artwork_invitation_redemptions redemption
        ON redemption.invitation_id = invitation.id
     WHERE invitation.keeper_piece_id = ?1
     ORDER BY invitation.created_at DESC, invitation.id DESC
     LIMIT 1
  `, keeperPieceId);
  if (!row) return null;
  const state = row.redeemed_at ? 'redeemed'
    : row.revoked_at ? 'revoked'
      : Date.parse(row.expires_at) <= Date.parse(now) ? 'expired' : 'available';
  return { state, invitationId: row.id };
}

function caretakerProjection(keeper) {
  if (!keeper) return { state: 'not_registered' };
  if (keeper.keeper_user_id && keeper.claimed_at && keeper.released_at === null) {
    return { state: 'active' };
  }
  if (!keeper.keeper_user_id && !keeper.claimed_at && keeper.released_at === null) {
    return { state: 'unclaimed' };
  }
  if (!keeper.keeper_user_id && keeper.claimed_at && keeper.released_at) {
    return { state: 'released' };
  }
  throw workspaceError('workspace_data_corrupt');
}

async function saleProjection(env, record, keeper) {
  if (record) {
    const verified = await first(env, `
      SELECT sale.id
        FROM artist_verified_sale_items item
        JOIN artist_verified_sales sale ON sale.id = item.sale_id
       WHERE item.artwork_record_id = ?1
       ORDER BY sale.recorded_at DESC, sale.id DESC
       LIMIT 1
    `, record.id);
    if (verified) return {
      public: { state: 'verified', verifiedSaleId: verified.id },
      legacyAcquisitionId: null,
    };
  }
  if (keeper) {
    const legacy = await first(env, `
      SELECT id
        FROM artwork_acquisitions
       WHERE keeper_piece_id = ?1 AND acquisition_type = 'sale'
       ORDER BY COALESCE(acquired_at, created_at) DESC, id DESC
       LIMIT 1
    `, keeper.id);
    if (legacy) return {
      public: { state: 'legacy_candidate', verifiedSaleId: null },
      legacyAcquisitionId: legacy.id,
    };
  }
  return null;
}

async function plateProjection(env, keeper) {
  if (!keeper) return null;
  const identityQualification = await loadLatestPassedIdentityQualification(env.DB, keeper.id);
  const identityStatus = identityRecoveryQualificationStatus(
    identityQualification,
    identityRecoveryDependenciesForRow(keeper, env),
  ).status;
  if (identityStatus !== 'current') {
    return {
      state: keeper.plate_status,
      recoveryState: identityStatus === 'stale' ? 'identity_stale' : 'identity_missing',
    };
  }
  if (!['generated', 'active'].includes(keeper.plate_status)) {
    return { state: keeper.plate_status, recoveryState: 'not_required' };
  }
  if (keeper.backup_status !== 'verified' || !keeper.backup_reference || !keeper.backup_sha256) {
    return { state: keeper.plate_status, recoveryState: 'plate_backup_missing' };
  }
  const qualification = await loadLatestPassedPieceQualification(env.DB, keeper.id);
  const status = recoveryQualificationStatus(
    qualification,
    recoveryDependenciesForRow(keeper, env),
  ).status;
  return {
    state: keeper.plate_status,
    recoveryState: status === 'current' ? 'current'
      : status === 'stale' ? 'plate_recovery_stale' : 'plate_recovery_missing',
  };
}

function addActivity(activity, kind, occurredAt, label) {
  if (typeof occurredAt !== 'string' || !occurredAt || Number.isNaN(Date.parse(occurredAt))) return;
  activity.push({ kind, occurredAt, label });
}

async function activityProjection(env, record, keeper) {
  const activity = [];
  if (record) {
    addActivity(activity, 'sales_record_created', record.created_at,
      'Private artwork sales record created');
    const rows = await all(env, `
      SELECT action, created_at
        FROM artist_artwork_record_events
       WHERE artwork_record_id = ?1
       ORDER BY created_at DESC, id DESC
       LIMIT 20
    `, record.id);
    for (const row of rows) {
      const label = row.action === 'identity_linked' ? 'Permanent identity linked'
        : row.action === 'identified' ? 'Artwork identified' : 'Artwork identification corrected';
      addActivity(activity, 'identity_changed', row.created_at, label);
    }
    const sales = await all(env, `
      SELECT sale.recorded_at
        FROM artist_verified_sale_items item
        JOIN artist_verified_sales sale ON sale.id = item.sale_id
       WHERE item.artwork_record_id = ?1
       ORDER BY sale.recorded_at DESC, sale.id DESC
       LIMIT 20
    `, record.id);
    for (const sale of sales) {
      addActivity(activity, 'sale_verified', sale.recorded_at, 'Sale verified');
    }
  }
  if (keeper) {
    addActivity(activity, 'identity_registered', keeper.registered_at,
      'Permanent identity registered');
    addActivity(activity, 'caretaker_claimed', keeper.claimed_at, 'Caretaker connected');
    addActivity(activity, 'caretaker_released', keeper.released_at, 'Caretaker released');
    addActivity(activity, 'plate_generated', keeper.plate_generated_at, 'Plate generated');
    addActivity(activity, 'plate_activated', keeper.plate_activated_at, 'Plate activated');
    const invitations = await all(env, `
      SELECT invitation.created_at, invitation.revoked_at, redemption.redeemed_at
        FROM artwork_invitations invitation
        LEFT JOIN artwork_invitation_redemptions redemption
          ON redemption.invitation_id = invitation.id
       WHERE invitation.keeper_piece_id = ?1
       ORDER BY invitation.created_at DESC, invitation.id DESC
       LIMIT 20
    `, keeper.id);
    for (const invitation of invitations) {
      addActivity(activity, 'invitation_created', invitation.created_at,
        'Caretaker invitation created');
      addActivity(activity, 'invitation_revoked', invitation.revoked_at,
        'Caretaker invitation revoked');
      addActivity(activity, 'invitation_redeemed', invitation.redeemed_at,
        'Caretaker invitation redeemed');
    }
    const maintenance = await all(env, `
      SELECT event_type, created_at
        FROM registry_maintenance_events
       WHERE keeper_piece_id = ?1 AND outcome = 'succeeded'
       ORDER BY created_at DESC, id DESC
       LIMIT 20
    `, keeper.id);
    for (const event of maintenance) {
      addActivity(activity, 'maintenance_recorded', event.created_at,
        event.event_type === 'artwork_registered'
          ? 'Artwork registration recorded' : 'Registry maintenance recorded');
    }
  }
  return activity
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)
      || left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label))
    .slice(0, 20);
}

function stablePath(path, params) {
  const query = new URLSearchParams(params).toString();
  return `${path}?${query}`;
}

function nextActionProjection({
  record, keeper, artwork, certificate, invitation, caretaker, plate, sale,
}) {
  if (record?.identification_status === 'unresolved') {
    return {
      label: 'Resolve artwork identity',
      href: stablePath('/admin/collector-sales', { artistArtworkRecordId: record.id }),
      reason: 'This sales record is not matched to a catalog artwork.',
    };
  }
  if (plate?.recoveryState === 'identity_missing' || plate?.recoveryState === 'identity_stale') {
    return {
      label: 'Verify identity recovery',
      href: stablePath('/admin/pieces/wizard', { keeperPieceId: keeper.id }),
      reason: 'The registered identity needs a current copied recovery check.',
    };
  }
  if (plate && !['current', 'not_required'].includes(plate.recoveryState)) {
    return {
      label: 'Complete plate recovery',
      href: stablePath('/admin/pieces/wizard', { keeperPieceId: keeper.id }),
      reason: 'The physical plate needs current backup and recovery proof.',
    };
  }
  if (record?.identification_status === 'identified') {
    return {
      label: 'Register artwork identity',
      href: stablePath('/admin/registrations', {
        artworkId: artwork.id, artistArtworkRecordId: record.id,
      }),
      reason: 'This exact artwork is identified but has no permanent identity.',
    };
  }
  if (artwork && certificate.state !== 'complete') {
    return {
      label: 'Complete certificate facts',
      href: stablePath('/admin/certificates', { artworkId: artwork.id }),
      reason: 'The effective certificate is missing required facts.',
    };
  }
  if (keeper && caretaker.state === 'unclaimed'
    && (!invitation || ['available', 'expired', 'revoked'].includes(invitation.state))) {
    return {
      label: invitation?.state === 'available'
        ? 'Resolve caretaker invitation' : 'Create caretaker invitation',
      href: stablePath('/admin/invitations', { keeperPieceId: keeper.id }),
      reason: invitation?.state === 'available'
        ? 'A caretaker invitation is waiting to be completed.'
        : 'No completed caretaker invitation is recorded.',
    };
  }
  if (sale?.state === 'legacy_candidate') {
    return {
      label: 'Verify legacy sale',
      href: stablePath('/admin/collector-sales', {
        source: 'legacy_acquisition', acquisitionId: sale.legacyAcquisitionId,
        artworkId: artwork.id, keeperPieceId: keeper.id,
      }),
      reason: 'A legacy sale record is waiting for verification.',
    };
  }
  if (keeper) {
    return {
      label: 'Review caretaker experience',
      href: stablePath('/admin/pieces', { keeperPieceId: keeper.id }),
      reason: 'The core artwork record is ready for experience review.',
    };
  }
  return null;
}

export async function getArtworkWorkspace(env, selector, now = new Date().toISOString()) {
  if (!env?.DB) throw workspaceError('db_not_configured');
  const record = await selectedRecord(env, selector);
  validateRecord(record);
  const keeper = await selectedKeeper(env, selector, record);
  validateSelection(selector, record, keeper);

  const artworkId = selector.artworkId ?? record?.artwork_id ?? keeper?.piece_id ?? null;
  const artwork = artworkId ? await resolveArtwork(env, artworkId) : null;
  if (artworkId && !artwork) {
    if (selector.artworkId && !record && !keeper) throw workspaceError('workspace_not_found');
    throw workspaceError('workspace_data_corrupt');
  }
  if (keeper && (keeper.registration_status !== 'registered'
    || typeof keeper.public_code !== 'string' || !keeper.public_code)) {
    throw workspaceError('workspace_data_corrupt');
  }

  const [certificate, invitation, sale, plate, activity] = await Promise.all([
    certificateProjection(env, artwork?.id ?? null),
    invitationProjection(env, keeper?.id ?? null, now),
    saleProjection(env, record, keeper),
    plateProjection(env, keeper),
    activityProjection(env, record, keeper),
  ]);
  const caretaker = caretakerProjection(keeper);
  const nextAction = nextActionProjection({
    record, keeper, artwork, certificate, invitation, caretaker, plate,
    sale: sale ? { ...sale.public, legacyAcquisitionId: sale.legacyAcquisitionId } : null,
  });

  return {
    catalog: artwork ? {
      artworkId: artwork.id,
      title: typeof artwork.title === 'string' && artwork.title.trim()
        ? artwork.title.trim() : `Artwork ${artwork.id}`,
    } : null,
    salesRecord: record ? {
      artworkRecordId: record.id,
      state: record.identification_status,
    } : null,
    identity: keeper ? {
      keeperPieceId: keeper.id,
      publicCode: keeper.public_code,
      state: 'registered',
    } : null,
    certificate,
    invitation,
    caretaker,
    plate,
    sale: sale?.public ?? null,
    nextAction,
    activity,
  };
}
