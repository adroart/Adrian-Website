import { commitMaintenanceMutation } from './registryMaintenance.js';
import { prepareNextLineageEvent } from './lineage.js';
import { syncTransferCollectorLetters } from './collectorLetters.js';
import { refreshPieceRecord } from './pieceRecordRefresh.js';
import { legacyEnabled } from './keeper.js';

const DAY_MS = 86_400_000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function coded(code) { const error = new Error(code); error.code = code; return error; }
function html(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}
function email(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!EMAIL.test(normalized) || normalized.length > 254) throw coded('invalid_recipient_email');
  return normalized;
}
function id(value, code = 'invalid_id') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > 128) throw coded(code);
  return normalized;
}
function declaredValue(rawValue, rawMethod) {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  const method = typeof rawMethod === 'string' ? rawMethod.trim() : '';
  if (!value && !method) return { value: null, method: null };
  if (!value || value.length > 500) throw coded('invalid_declared_value');
  if (!['paid', 'part_trade_paid', 'traded', 'given'].includes(method)) throw coded('invalid_declared_value_method');
  return { value, method };
}
async function sha(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function invitationToken(env, passingId) {
  const secret = env.CARETAKER_PASSING_SECRET || env.REGISTRY_STEP_UP_SECRET;
  if (typeof secret !== 'string' || secret.length < 32) throw coded('passing_secret_not_configured');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(`caretaker-passing:v1:${passingId}`));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function view(row) {
  return {
    id: row.id, keeperPieceId: row.keeper_piece_id, pieceId: row.piece_id,
    publicCode: row.public_code, title: row.title || row.piece_id,
    recipientEmail: row.recipient_email, transferKind: row.transfer_kind,
    declaredValueRaw: row.declared_value_raw || null,
    declaredValueMethod: row.declared_value_method || null,
    status: row.status, deliveryStatus: row.delivery_status,
    senderNoticeStatus: row.sender_notice_status || null,
    createdAt: row.created_at, expiresAt: row.expires_at,
  };
}

async function sendSenderAcceptanceNotice(env, passingId) {
  const row = await env.DB.prepare(
    `SELECT passing.*, piece.piece_id, piece.public_code, piece.piece_id AS title,
            sender.email AS sender_email
       FROM caretaker_passing_requests passing
       JOIN keeper_pieces piece ON piece.id = passing.keeper_piece_id
       JOIN user sender ON sender.id = passing.sender_user_id
      WHERE passing.id = ?1 AND passing.status = 'accepted' LIMIT 1`,
  ).bind(passingId).first();
  if (!row || row.sender_notice_status === 'sent') return Boolean(row);
  let ok = false;
  let detail = 'email_not_configured';
  if (env.RESEND_API_KEY) {
    const origin = env.PUBLIC_SITE_URL || 'https://adrianrasmussen.com';
    const link = `${origin}/works/${encodeURIComponent(row.piece_id)}?instance=${encodeURIComponent(row.public_code)}`;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': row.sender_notice_provider_idempotency_key,
        },
        body: JSON.stringify({
          from: `Adrian Rasmussen Art <${env.RESEND_FROM_EMAIL || 'noreply@adrianrasmussen.com'}>`,
          to: [row.sender_email],
          subject: `${row.title || row.piece_id} has been accepted`,
          html: `<p>${html(row.title || row.piece_id)} has been accepted by its next caretaker.</p><p><a href="${html(link)}">Open the piece</a></p>`,
        }),
      });
      ok = response.ok;
      detail = ok ? '' : `provider_${response.status}`;
    } catch (error) {
      detail = String(error?.message || 'provider_failed').slice(0, 500);
    }
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE caretaker_passing_requests
        SET sender_notice_status = ?2,
            sender_notice_attempts = sender_notice_attempts + 1,
            sender_notice_error = ?3,
            sender_notice_sent_at = CASE WHEN ?2 = 'sent' THEN ?4 ELSE NULL END,
            updated_at = ?4
      WHERE id = ?1 AND status = 'accepted' AND (sender_notice_status IS NULL OR sender_notice_status <> 'sent')`,
  ).bind(passingId, ok ? 'sent' : 'failed', detail || null, now).run();
  return ok;
}

async function sendInvitation(env, row, rawToken) {
  const providerKey = row.provider_idempotency_key;
  let ok = false;
  let detail = 'email_not_configured';
  if (env.RESEND_API_KEY) {
    const origin = env.PUBLIC_SITE_URL || 'https://adrianrasmussen.com';
    const link = `${origin}/works/${encodeURIComponent(row.piece_id)}?instance=${encodeURIComponent(row.public_code)}&passing=${encodeURIComponent(rawToken)}`;
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': providerKey,
        },
        body: JSON.stringify({
          from: `Adrian Rasmussen Art <${env.RESEND_FROM_EMAIL || 'noreply@adrianrasmussen.com'}>`,
          to: [row.recipient_email],
          subject: `${row.title || row.piece_id} is waiting for you`,
          html: `<p>A caretaker has begun passing ${html(row.title || row.piece_id)} to you.</p><p><a href="${html(link)}">Open the piece and accept the passing</a></p><p>This invitation expires in 30 days.</p>`,
        }),
      });
      ok = response.ok;
      detail = ok ? '' : `provider_${response.status}`;
    } catch (error) {
      detail = String(error?.message || 'provider_failed').slice(0, 500);
    }
  }
  await env.DB.prepare(
    `UPDATE caretaker_passing_requests
        SET delivery_status = ?2, delivery_attempts = delivery_attempts + 1,
            delivery_error = ?3, updated_at = ?4
      WHERE id = ?1 AND status = 'pending'`,
  ).bind(row.id, ok ? 'sent' : 'failed', detail || null, new Date().toISOString()).run();
  return ok;
}

export async function createCaretakerPassing(env, input) {
  if (!env?.DB?.batch) throw coded('atomic_write_unavailable');
  const senderUserId = id(input.senderUserId, 'invalid_sender');
  const keeperPieceId = id(input.keeperPieceId, 'invalid_keeper_piece');
  const recipientEmail = email(input.recipientEmail);
  if (email(input.confirmedRecipientEmail) !== recipientEmail) throw coded('recipient_readback_required');
  const idempotencyKey = id(input.idempotencyKey, 'invalid_idempotency_key');
  const transferKind = input.transferKind === 'gift' ? 'gift' : input.transferKind === 'sale' ? 'sale' : null;
  if (!transferKind) throw coded('invalid_transfer_kind');
  const declared = declaredValue(input.declaredValueRaw, input.declaredValueMethod);
  if (transferKind !== 'sale' && declared.value !== null) throw coded('declared_value_not_allowed');
  const now = input.now || new Date().toISOString();

  await env.DB.prepare(
    `UPDATE caretaker_passing_requests
        SET status = 'expired', updated_at = ?2
      WHERE keeper_piece_id = ?1 AND status = 'pending'
        AND julianday(expires_at) <= julianday(?2)`,
  ).bind(keeperPieceId, now).run();

  const replay = await env.DB.prepare(
    `SELECT passing.*, piece.piece_id, piece.public_code, piece.piece_id AS title
       FROM caretaker_passing_requests passing
       JOIN keeper_pieces piece ON piece.id = passing.keeper_piece_id
      WHERE passing.sender_user_id = ?1 AND passing.idempotency_key = ?2
      LIMIT 1`,
  ).bind(senderUserId, idempotencyKey).first();
  if (replay) {
    if (replay.keeper_piece_id !== keeperPieceId || replay.recipient_email !== recipientEmail
      || replay.transfer_kind !== transferKind || replay.declared_value_raw !== declared.value
      || replay.declared_value_method !== declared.method) throw coded('idempotency_conflict');
    return { passing: view(replay), replayed: true };
  }

  const piece = await env.DB.prepare(
    `SELECT piece.id, piece.piece_id, piece.public_code, piece.keeper_user_id,
            piece.piece_id AS title
       FROM keeper_pieces piece
      WHERE piece.id = ?1 AND piece.keeper_user_id = ?2
        AND piece.claimed_at IS NOT NULL AND piece.released_at IS NULL
        AND piece.plate_status NOT IN ('void', 'superseded')
      LIMIT 1`,
  ).bind(keeperPieceId, senderUserId).first();
  if (!piece) throw coded('not_your_piece');
  const sender = await env.DB.prepare('SELECT email FROM user WHERE id = ?1').bind(senderUserId).first();
  if (sender && email(sender.email) === recipientEmail) throw coded('recipient_is_sender');

  const passingId = `passing-${crypto.randomUUID()}`;
  const rawToken = await invitationToken(env, passingId);
  const expiresAt = new Date(Date.parse(now) + 30 * DAY_MS).toISOString();
  const providerKey = `caretaker-passing:${passingId}`;
  const senderNoticeProviderKey = `caretaker-passing-accepted:${passingId}`;
  try {
    await env.DB.prepare(
      `INSERT INTO caretaker_passing_requests
         (id, keeper_piece_id, sender_user_id, recipient_email, token_hash,
          transfer_kind, idempotency_key, provider_idempotency_key,
          declared_value_raw, declared_value_method, sender_notice_provider_idempotency_key,
          created_at, expires_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?12)`,
    ).bind(passingId, keeperPieceId, senderUserId, recipientEmail, await sha(rawToken),
      transferKind, idempotencyKey, providerKey, declared.value, declared.method,
      senderNoticeProviderKey, now, expiresAt).run();
  } catch (error) {
    const raced = await env.DB.prepare(
      `SELECT passing.*, piece.piece_id, piece.public_code, piece.piece_id AS title
         FROM caretaker_passing_requests passing
         JOIN keeper_pieces piece ON piece.id = passing.keeper_piece_id
        WHERE passing.sender_user_id = ?1 AND passing.idempotency_key = ?2
        LIMIT 1`,
    ).bind(senderUserId, idempotencyKey).first();
    if (raced) {
      if (raced.keeper_piece_id !== keeperPieceId || raced.recipient_email !== recipientEmail
        || raced.transfer_kind !== transferKind || raced.declared_value_raw !== declared.value
        || raced.declared_value_method !== declared.method) throw coded('idempotency_conflict');
      return { passing: view(raced), replayed: true };
    }
    if (/caretaker_passing_one_pending_piece|UNIQUE constraint failed: caretaker_passing_requests.keeper_piece_id/i.test(String(error?.message))) {
      throw coded('passing_already_pending');
    }
    throw error;
  }
  const row = { ...piece, id: passingId, keeper_piece_id: keeperPieceId, recipient_email: recipientEmail,
    transfer_kind: transferKind, status: 'pending', delivery_status: 'pending', created_at: now,
    expires_at: expiresAt, provider_idempotency_key: providerKey,
    declared_value_raw: declared.value, declared_value_method: declared.method,
    sender_notice_status: null };
  const sent = await sendInvitation(env, row, rawToken);
  return { passing: { ...view(row), deliveryStatus: sent ? 'sent' : 'failed' }, replayed: false };
}

async function loadByToken(env, rawToken) {
  const hash = await sha(id(rawToken, 'invalid_token'));
  const row = await env.DB.prepare(
    `SELECT passing.*, piece.piece_id, piece.public_code, piece.piece_id AS title
       FROM caretaker_passing_requests passing
       JOIN keeper_pieces piece ON piece.id = passing.keeper_piece_id
      WHERE passing.token_hash = ?1
      LIMIT 1`,
  ).bind(hash).first();
  if (!row) throw coded('passing_not_found');
  return row;
}

export async function inspectCaretakerPassing(env, input) {
  const row = await loadByToken(env, input.token);
  const accountEmail = email(input.accountEmail);
  if (input.emailVerified !== true || accountEmail !== row.recipient_email) throw coded('recipient_mismatch');
  if (row.status === 'pending' && Date.parse(row.expires_at) <= Date.parse(input.now || new Date().toISOString())) {
    await env.DB.prepare(
      `UPDATE caretaker_passing_requests SET status = 'expired', updated_at = ?2
        WHERE id = ?1 AND status = 'pending'`,
    ).bind(row.id, input.now || new Date().toISOString()).run();
    row.status = 'expired';
  }
  return view(row);
}

export async function getCaretakerPassingForSender(env, input) {
  const keeperPieceId = id(input.keeperPieceId, 'invalid_keeper_piece');
  const senderUserId = id(input.senderUserId, 'invalid_sender');
  const now = input.now || new Date().toISOString();
  await env.DB.prepare(
    `UPDATE caretaker_passing_requests SET status = 'expired', updated_at = ?3
      WHERE keeper_piece_id = ?1 AND sender_user_id = ?2 AND status = 'pending'
        AND julianday(expires_at) <= julianday(?3)`,
  ).bind(keeperPieceId, senderUserId, now).run();
  const row = await env.DB.prepare(
    `SELECT passing.*, piece.piece_id, piece.public_code, piece.piece_id AS title
       FROM caretaker_passing_requests passing
       JOIN keeper_pieces piece ON piece.id = passing.keeper_piece_id
      WHERE passing.keeper_piece_id = ?1 AND passing.sender_user_id = ?2
      ORDER BY passing.created_at DESC LIMIT 1`,
  ).bind(keeperPieceId, senderUserId).first();
  return row ? view(row) : null;
}

export async function cancelCaretakerPassing(env, input) {
  const passingId = id(input.passingId, 'invalid_passing_id');
  const senderUserId = id(input.senderUserId, 'invalid_sender');
  const now = input.now || new Date().toISOString();
  const result = await env.DB.prepare(
    `UPDATE caretaker_passing_requests
        SET status = 'cancelled', cancelled_at = ?3, updated_at = ?3
      WHERE id = ?1 AND sender_user_id = ?2 AND status = 'pending'`,
  ).bind(passingId, senderUserId, now).run();
  if (result?.meta?.changes === 1) return { status: 'cancelled' };
  const row = await env.DB.prepare('SELECT sender_user_id, status FROM caretaker_passing_requests WHERE id = ?1').bind(passingId).first();
  if (!row || row.sender_user_id !== senderUserId) throw coded('passing_not_found');
  if (row.status === 'cancelled') return { status: 'cancelled', replayed: true };
  throw coded('passing_not_pending');
}

export async function resendCaretakerPassing(env, input) {
  const passingId = id(input.passingId);
  const senderUserId = id(input.senderUserId);
  const now = input.now || new Date().toISOString();
  await env.DB.prepare(
    `UPDATE caretaker_passing_requests SET status = 'expired', updated_at = ?3
      WHERE id = ?1 AND sender_user_id = ?2 AND status = 'pending'
        AND julianday(expires_at) <= julianday(?3)`,
  ).bind(passingId, senderUserId, now).run();
  const row = await env.DB.prepare(
    `SELECT passing.*, piece.piece_id, piece.public_code, piece.piece_id AS title
       FROM caretaker_passing_requests passing JOIN keeper_pieces piece ON piece.id = passing.keeper_piece_id
      WHERE passing.id = ?1 AND passing.sender_user_id = ?2 AND passing.status = 'pending'
      LIMIT 1`,
  ).bind(passingId, senderUserId).first();
  if (!row) throw coded('passing_not_found');
  const sent = await sendInvitation(env, row, await invitationToken(env, row.id));
  return { passing: { ...view(row), deliveryStatus: sent ? 'sent' : 'failed' } };
}

export async function acceptCaretakerPassing(env, input) {
  if (!env?.DB?.batch) throw coded('atomic_write_unavailable');
  const row = await loadByToken(env, input.token);
  const targetUserId = id(input.userId, 'invalid_recipient');
  const accountEmail = email(input.accountEmail);
  if (input.emailVerified !== true || accountEmail !== row.recipient_email) throw coded('recipient_mismatch');
  if (row.status === 'accepted') {
    const intent = await env.DB.prepare('SELECT target_user_id FROM artwork_transfer_intents WHERE id = ?1').bind(row.transfer_intent_id).first();
    if (intent?.target_user_id === targetUserId) {
      await sendSenderAcceptanceNotice(env, row.id).catch(() => {});
      const replay = await loadByToken(env, input.token);
      return { passing: view(replay), replayed: true };
    }
  }
  if (row.status !== 'pending') throw coded('passing_not_pending');
  const now = input.now || new Date().toISOString();
  if (Date.parse(row.expires_at) <= Date.parse(now)) throw coded('passing_expired');
  const piece = await env.DB.prepare(
    `SELECT id, piece_id, public_code, keeper_user_id, claimed_at, released_at,
            current_display_location, steward_version, lineage_event_count, lineage_head_hash
       FROM keeper_pieces WHERE id = ?1`,
  ).bind(row.keeper_piece_id).first();
  if (!piece || piece.keeper_user_id !== row.sender_user_id || !piece.claimed_at) throw coded('custody_changed');

  const intentId = `transfer-${crypto.randomUUID()}`;
  const fromRef = `tp-${crypto.randomUUID()}`;
  const toRef = `tp-${crypto.randomUUID()}`;
  const lineage = await prepareNextLineageEvent(env, {
    keeperPieceId: piece.id, eventType: 'transferred', eventAt: now,
    publicPayload: { fromRef, toRef, transferKind: row.transfer_kind }, onlyIfPreviousChanged: true,
  });
  const before = { keeperPieceId: piece.id, artworkId: piece.piece_id, keeperUserId: piece.keeper_user_id,
    claimedAt: piece.claimed_at, releasedAt: piece.released_at, currentDisplayLocation: piece.current_display_location,
    stewardVersion: piece.steward_version };
  const after = { ...before, keeperUserId: targetUserId, claimedAt: now, releasedAt: null,
    currentDisplayLocation: null, stewardVersion: piece.steward_version + 1 };
  const commitment = await sha(accountEmail);
  const intent = env.DB.prepare(
    `INSERT INTO artwork_transfer_intents
       (id, keeper_piece_id, expected_from_user_id, target_user_id, target_email_commitment,
        expected_steward_version, expected_lineage_count, expected_lineage_hash, transfer_kind,
        maintenance_event_id, lineage_event_id, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
  ).bind(intentId, piece.id, piece.keeper_user_id, targetUserId, commitment,
    piece.steward_version, piece.lineage_event_count, piece.lineage_head_hash,
    row.transfer_kind, row.id, lineage.event.id, now);
  const party = (role, userId, ref) => env.DB.prepare(
    `INSERT INTO artwork_transfer_parties (id, transfer_intent_id, party_role, user_id, public_ref, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  ).bind(`party-${crypto.randomUUID()}`, intentId, role, userId, ref, now);
  const receipt = env.DB.prepare(
    'INSERT INTO artwork_transfer_receipts (id, transfer_intent_id, committed_at) VALUES (?1, ?2, ?3)',
  ).bind(`receipt-${crypto.randomUUID()}`, intentId, now);
  const result = await commitMaintenanceMutation(env, {
    target: { type: 'keeper_steward', id: piece.id, artworkId: piece.piece_id },
    changes: { keeperUserId: targetUserId, claimedAt: now, releasedAt: null, currentDisplayLocation: null },
    event: { id: row.id, idempotencyKey: `passing-accept:${row.id}`, eventType: 'steward_transferred',
      keeperPieceId: piece.id, artworkId: piece.piece_id,
      authorization: { userId: targetUserId, email: accountEmail }, reason: 'Recipient accepted caretaker passing.',
      before, after, outcome: 'succeeded', relatedRecordId: piece.id, createdAt: now },
    expectedVersion: piece.steward_version,
    beforeStatements: [intent, party('from', piece.keeper_user_id, fromRef), party('to', targetUserId, toRef)],
    afterStatements: [lineage.statement], gatewayStatement: receipt,
  });
  if (!result.ok) {
    const replay = await loadByToken(env, input.token);
    if (replay.status === 'accepted' && replay.transfer_intent_id) return { passing: view(replay), replayed: true };
    throw coded(result.error || 'passing_accept_failed');
  }
  await syncTransferCollectorLetters(env, { transferIntentId: intentId }).catch(() => {});
  await sendSenderAcceptanceNotice(env, row.id).catch(() => {});
  await refreshPieceRecord(env, { publicCode: piece.public_code, trigger: 'transfer', generatedAt: now,
    includeLegacySections: legacyEnabled() }).catch(() => {});
  const accepted = await loadByToken(env, input.token);
  return { passing: view(accepted), replayed: false };
}

export async function retryCaretakerPassingSenderNotices(env, { cursor = '', limit = 25 } = {}) {
  const bounded = Math.max(1, Math.min(50, Number.isSafeInteger(limit) ? limit : 25));
  const rows = await env.DB.prepare(
    `SELECT id FROM caretaker_passing_requests
      WHERE id > ?1 AND status = 'accepted' AND (sender_notice_status IS NULL OR sender_notice_status <> 'sent')
      ORDER BY id LIMIT ?2`,
  ).bind(cursor, bounded).all();
  for (const row of rows.results || []) await sendSenderAcceptanceNotice(env, row.id).catch(() => {});
  const last = rows.results?.at(-1)?.id || cursor;
  return { processed: rows.results?.length || 0, cursor: last };
}
