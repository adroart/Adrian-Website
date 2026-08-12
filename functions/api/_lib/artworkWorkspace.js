import { resolveArtwork } from './artworkCatalog.js';
import { readRegisteredArtworkIdentity } from './artworkRegistration.js';
import { readArtworkInvitationProjection } from './artworkInvitations.js';
import {
  readArtistArtworkRecordProjection,
  readVerifiedSaleProjection,
} from './artistSales.js';
import { resolveArtworkCertificate } from './certificateContent.js';
import { readMaintenanceWorkspaceProjection } from './registryMaintenance.js';
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

async function selectedRecord(env, selector) {
  const result = await readArtistArtworkRecordProjection(env, selector);
  if (selector.artistArtworkRecordId) {
    const row = result;
    if (!row) throw workspaceError('workspace_not_found');
    return row;
  }
  const rows = result;
  if (selector.keeperPieceId && rows.length > 1) throw workspaceError('workspace_data_corrupt');
  if (rows.length > 1) throw workspaceError('workspace_selector_conflict');
  return rows[0] ?? null;
}

async function selectedKeeper(env, selector, record) {
  const keeperPieceId = selector.keeperPieceId ?? record?.keeper_piece_id ?? null;
  if (!keeperPieceId) return null;
  const identity = await readRegisteredArtworkIdentity(env, keeperPieceId);
  if (!identity) throw workspaceError('workspace_not_found');
  return identity;
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

function activityProjection(record, identity, invitationActivity, saleActivity, maintenanceActivity) {
  const activity = [];
  if (record) {
    addActivity(activity, 'sales_record_created', record.created_at,
      'Private artwork sales record created');
  }
  for (const [kind, occurredAt, label] of [
    ...(identity?.activity ?? []), ...invitationActivity, ...saleActivity, ...maintenanceActivity,
  ]) addActivity(activity, kind, occurredAt, label);
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
  const identityProjection = await selectedKeeper(env, selector, record);
  const keeper = identityProjection?.row ?? null;
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

  const [certificate, invitationRead, verifiedRead, maintenanceRead, plate] = await Promise.all([
    certificateProjection(env, artwork?.id ?? null),
    readArtworkInvitationProjection(env, keeper?.id ?? null, now),
    readVerifiedSaleProjection(env, record?.id ?? null),
    readMaintenanceWorkspaceProjection(env, keeper?.id ?? null),
    plateProjection(env, keeper),
  ]);
  const invitation = invitationRead.invitation;
  const caretaker = { state: identityProjection?.caretaker ?? 'not_registered' };
  const sale = verifiedRead.sale ? {
    public: verifiedRead.sale, legacyAcquisitionId: null,
  } : maintenanceRead.legacySale ? {
    public: { state: 'legacy_candidate', verifiedSaleId: null },
    legacyAcquisitionId: maintenanceRead.legacySale.acquisitionId,
  } : null;
  const activity = activityProjection(
    record, identityProjection, invitationRead.activity,
    verifiedRead.activity, maintenanceRead.activity,
  );
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
