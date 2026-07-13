const PRIVATE_KEY = /(?:email|ip|user.?agent|ownership|recovery|verifier|cipher|nonce|secret|password|token|key)/i;

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
  assertPublic(publicPayload);
  const publicPayloadJson = JSON.stringify(stable(publicPayload));
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
  const previous = await env.DB.prepare(
    `SELECT sequence, event_hash FROM artwork_lineage_events
      WHERE keeper_piece_id = ?1 ORDER BY sequence DESC LIMIT 1`,
  ).bind(details.keeperPieceId).first();
  const event = await buildLineageEvent({
    ...details,
    sequence: (previous?.sequence || 0) + 1,
    previousHash: previous?.event_hash || null,
  });
  return {
    event,
    statement: lineageStatement(env, event, {
      onlyIfPreviousChanged: details.onlyIfPreviousChanged === true,
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
