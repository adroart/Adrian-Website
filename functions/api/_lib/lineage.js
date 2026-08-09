const PRIVATE_KEY = /(?:email|ip|user.?agent|ownership|recovery|verifier|cipher|nonce|secret|password|token|key)/i;
const PUBLIC_CODE_PATTERN = /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const ARTWORK_ID_PATTERN = /^[A-Z]{2,3}-[0-9]{3}$/;
const TRANSFER_PARTY_REF_PATTERN = /^tp-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TRANSFER_KINDS = new Set(['sale', 'gift', 'inheritance', 'artist-rebind']);
const EMPTY_PAYLOAD_EVENTS = new Set([
  'fulfillment_assign',
  'fulfillment_correct',
  'fulfillment_correction_out',
  'fulfillment_correction_in',
  'fulfillment_ship',
  'first_bound',
  'migration_baseline',
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function assertPublic(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (PRIVATE_KEY.test(key)) throw new Error(`private lineage key: ${key}`);
    assertPublic(child);
  }
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

export function projectLineagePublicPayload(eventType, publicPayload = {}) {
  assertPublic(publicPayload);
  if (eventType === 'issued') {
    if (
      !exactKeys(publicPayload, ['pieceId', 'editionNumber', 'publicCode'])
      || typeof publicPayload.pieceId !== 'string'
      || !ARTWORK_ID_PATTERN.test(publicPayload.pieceId)
      || !Number.isSafeInteger(publicPayload.editionNumber)
      || publicPayload.editionNumber < 0
      || !PUBLIC_CODE_PATTERN.test(publicPayload.publicCode)
    ) throw new Error('invalid issued lineage payload');
    return {
      pieceId: publicPayload.pieceId,
      editionNumber: publicPayload.editionNumber,
      publicCode: publicPayload.publicCode,
    };
  }
  if (eventType === 'activated') {
    if (!exactKeys(publicPayload, ['plateStatus']) || publicPayload.plateStatus !== 'active') {
      throw new Error('invalid activated lineage payload');
    }
    return { plateStatus: 'active' };
  }
  if (eventType === 'link_corrected') {
    if (!exactKeys(publicPayload, ['pieceId', 'editionNumber'])
      || typeof publicPayload.pieceId !== 'string'
      || !ARTWORK_ID_PATTERN.test(publicPayload.pieceId)
      || !Number.isSafeInteger(publicPayload.editionNumber)
      || publicPayload.editionNumber < 0
      || publicPayload.editionNumber > 9999) {
      throw new Error('invalid link_corrected lineage payload');
    }
    return {
      pieceId: publicPayload.pieceId,
      editionNumber: publicPayload.editionNumber,
    };
  }
  if (eventType === 'voided' || eventType === 'superseded') {
    const plateStatus = eventType === 'voided' ? 'void' : 'superseded';
    if (!exactKeys(publicPayload, ['plateStatus']) || publicPayload.plateStatus !== plateStatus) {
      throw new Error(`invalid ${eventType} lineage payload`);
    }
    return { plateStatus };
  }
  if (eventType === 'transferred') {
    if (!exactKeys(publicPayload, ['fromRef', 'toRef', 'transferKind'])
      || !TRANSFER_PARTY_REF_PATTERN.test(publicPayload.fromRef)
      || !TRANSFER_PARTY_REF_PATTERN.test(publicPayload.toRef)
      || publicPayload.fromRef === publicPayload.toRef
      || !TRANSFER_KINDS.has(publicPayload.transferKind)) {
      throw new Error('invalid transferred lineage payload');
    }
    return {
      fromRef: publicPayload.fromRef,
      toRef: publicPayload.toRef,
      transferKind: publicPayload.transferKind,
    };
  }
  if (EMPTY_PAYLOAD_EVENTS.has(eventType)) {
    if (!exactKeys(publicPayload, [])) throw new Error(`invalid ${eventType} lineage payload`);
    return {};
  }
  throw new Error('invalid lineage event type');
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildLineageEvent({
  keeperPieceId,
  sequence,
  eventType,
  eventAt,
  previousHash = null,
  publicPayload = {},
}) {
  const projectedPayload = projectLineagePublicPayload(eventType, publicPayload);
  const publicPayloadJson = JSON.stringify(stable(projectedPayload));
  const commitment = JSON.stringify({
    keeperPieceId,
    sequence,
    eventType,
    eventAt,
    previousHash,
    publicPayload: JSON.parse(publicPayloadJson),
  });
  const eventHash = await sha256Hex(commitment);
  return {
    id: `le-${eventHash}`,
    keeperPieceId,
    sequence,
    eventType,
    eventAt,
    previousHash,
    eventHash,
    publicPayloadJson,
  };
}

export async function prepareNextLineageEvent(env, details) {
  const anchor = await env.DB.prepare(
    `SELECT lineage_head_hash, lineage_event_count
       FROM keeper_pieces WHERE id = ?1`,
  ).bind(details.keeperPieceId).first();
  if (!anchor) throw new Error('lineage anchor missing');
  const previous = await env.DB.prepare(
    `SELECT sequence, event_hash FROM artwork_lineage_events
      WHERE keeper_piece_id = ?1 ORDER BY sequence DESC LIMIT 1`,
  ).bind(details.keeperPieceId).first();
  const anchoredCount = Number(anchor.lineage_event_count);
  const anchoredHash = anchor.lineage_head_hash || null;
  const tailCount = previous?.sequence || 0;
  const tailHash = previous?.event_hash || null;
  if (
    !Number.isSafeInteger(anchoredCount)
    || anchoredCount < 0
    || anchoredCount !== tailCount
    || anchoredHash !== tailHash
  ) throw new Error('lineage anchor mismatch');
  const event = await buildLineageEvent({
    ...details,
    sequence: anchoredCount + 1,
    previousHash: anchoredHash,
  });
  const onlyIfPreviousChanged = details.onlyIfPreviousChanged === true;
  return {
    event,
    statement: lineageStatement(env, event, {
      onlyIfPreviousChanged,
    }),
    anchorStatement: lineageAnchorStatement(env, event, {
      expectedCount: anchoredCount,
      expectedHash: anchoredHash,
      onlyIfPreviousChanged,
    }),
  };
}

export function lineageStatement(env, event, { onlyIfPreviousChanged = false } = {}) {
  return env.DB.prepare(
    `INSERT INTO artwork_lineage_events
       (id, keeper_piece_id, sequence, event_type, event_at, previous_hash,
        event_hash, public_payload_json)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
      WHERE ?9 = 0 OR changes() > 0`,
  ).bind(
    event.id, event.keeperPieceId, event.sequence, event.eventType, event.eventAt,
    event.previousHash, event.eventHash, event.publicPayloadJson,
    onlyIfPreviousChanged ? 1 : 0,
  );
}

export function lineageAnchorStatement(env, event, {
  expectedCount = event.sequence - 1,
  expectedHash = event.previousHash,
  onlyIfPreviousChanged = false,
} = {}) {
  return env.DB.prepare(
    `UPDATE keeper_pieces
        SET lineage_head_hash = ?1, lineage_event_count = ?2
      WHERE id = ?3
        AND lineage_event_count = ?4
        AND ((lineage_head_hash IS NULL AND ?5 IS NULL) OR lineage_head_hash = ?5)
        AND (?6 = 0 OR changes() > 0)`,
  ).bind(
    event.eventHash,
    event.sequence,
    event.keeperPieceId,
    expectedCount,
    expectedHash,
    onlyIfPreviousChanged ? 1 : 0,
  );
}

export function claimEvidenceStatement(env, {
  keeperPieceId,
  actorUserId,
  verifiedEmail,
  ipAddress = null,
  userAgent = null,
  outcome,
  createdAt,
  requireKeeperUserId = null,
  requireClaimedAt = null,
  dedupeWithinSeconds = null,
}) {
  const email = String(verifiedEmail || '').trim().slice(0, 254);
  if (!email) throw new Error('verified email required for claim evidence');
  const ip = typeof ipAddress === 'string' && ipAddress.trim()
    ? ipAddress.trim().slice(0, 64)
    : null;
  const agent = typeof userAgent === 'string' && userAgent.trim()
    ? userAgent.trim().slice(0, 512)
    : null;
  return env.DB.prepare(
    `INSERT INTO artwork_claim_evidence
       (id, keeper_piece_id, actor_user_id, verified_email, ip_address,
        user_agent, outcome, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
      WHERE (?9 IS NULL OR EXISTS (
        SELECT 1 FROM keeper_pieces
         WHERE id = ?2 AND keeper_user_id = ?9 AND claimed_at = ?10
      ))
      AND (?11 IS NULL OR NOT EXISTS (
        SELECT 1 FROM artwork_claim_evidence prior
         WHERE prior.keeper_piece_id = ?2
           AND prior.actor_user_id = ?3
           AND prior.outcome = ?7
           AND julianday(prior.created_at) > julianday(?8, '-' || ?11 || ' seconds')
      ))`,
  ).bind(
    crypto.randomUUID(), keeperPieceId, actorUserId, email, ip,
    agent, outcome, createdAt, requireKeeperUserId, requireClaimedAt,
    Number.isSafeInteger(dedupeWithinSeconds) && dedupeWithinSeconds > 0
      ? dedupeWithinSeconds
      : null,
  );
}
