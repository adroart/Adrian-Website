/**
 * The artist's message, sealed until its caretaker unlocks (migration 039,
 * table artist_messages).
 *
 * A message belongs to exactly one physical instance (keeper_piece_id).
 * Writing a new message supersedes the active prior for the same piece; the
 * body is immutable after insert; revealing stamps revealed_at exactly once.
 * While revealed_at IS NULL the body is returned only through readForArtist
 * (behind the admin registry unlock); the collector flow later calls
 * revealForKeeper at the unlock moment. Message bodies are never part of any
 * public payload: the Piece Record generator queries named tables and never
 * artist_messages.
 */

function codedError(code) {
  return Object.assign(new Error(code), { code });
}

const FORBIDDEN_BODY_PREFIXES = ['auth-', 'kp-', 'tp-', 'dream-', 'consent-'];

/**
 * Validate a message body against the exact discipline migration 039 (and 031
 * before it) enforces: plain single-paragraph text, 1 to 2000 characters
 * after trimming equality, no '@', no newlines, no internal id prefixes.
 */
export function validateArtistMessageBody(value) {
  if (typeof value !== 'string') throw codedError('invalid_message_body');
  const body = value.trim();
  if (body.length < 1 || body.length > 2000) throw codedError('invalid_message_body');
  if (body.includes('@') || body.includes('\n') || body.includes('\r')) {
    throw codedError('invalid_message_body');
  }
  // Any control character is refused, not only the newline pair.
  if (/[\u0000-\u001f\u007f]/.test(body)) throw codedError('invalid_message_body');
  const lower = body.toLowerCase();
  if (FORBIDDEN_BODY_PREFIXES.some((prefix) => lower.includes(prefix))) {
    throw codedError('invalid_message_body');
  }
  return body;
}

function isoInstant(value, code) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw codedError(code);
  }
  return value;
}

function rowShape(row) {
  if (!row) return null;
  return {
    id: row.id,
    keeperPieceId: row.keeper_piece_id,
    body: row.body,
    createdAt: row.created_at,
    revealedAt: row.revealed_at ?? null,
    supersededAt: row.superseded_at ?? null,
  };
}

async function activeRow(db, keeperPieceId) {
  return db.prepare(
    `SELECT id, keeper_piece_id, body, created_at, revealed_at, superseded_at
       FROM artist_messages
      WHERE keeper_piece_id = ?1 AND superseded_at IS NULL`,
  ).bind(keeperPieceId).first();
}

/**
 * Write a new sealed message for one physical piece, superseding any active
 * prior in the same operation. Returns the new active row.
 */
export async function createArtistMessage(db, { keeperPieceId, body, createdAt } = {}) {
  if (!db) throw codedError('db_not_configured');
  if (typeof keeperPieceId !== 'string' || !keeperPieceId.trim()) {
    throw codedError('invalid_keeper_piece_id');
  }
  const validated = validateArtistMessageBody(body);
  const at = isoInstant(createdAt ?? new Date().toISOString(), 'invalid_created_at');

  const prior = await activeRow(db, keeperPieceId);
  if (prior) {
    const superseded = await db.prepare(
      `UPDATE artist_messages SET superseded_at = ?2
        WHERE id = ?1 AND superseded_at IS NULL`,
    ).bind(prior.id, at).run();
    if (Number(superseded?.meta?.changes ?? 0) !== 1) {
      throw codedError('artist_message_conflict');
    }
  }

  const id = `am-${crypto.randomUUID()}`;
  try {
    const inserted = await db.prepare(
      `INSERT INTO artist_messages (id, keeper_piece_id, body, created_at)
       VALUES (?1, ?2, ?3, ?4)`,
    ).bind(id, keeperPieceId, validated, at).run();
    if (Number(inserted?.meta?.changes ?? 0) !== 1) {
      throw codedError('artist_message_insert_failed');
    }
  } catch (error) {
    if (error?.code === 'artist_message_insert_failed') throw error;
    // The one-active partial unique index absorbed a concurrent writer.
    throw codedError('artist_message_conflict');
  }
  const row = await activeRow(db, keeperPieceId);
  if (!row || row.id !== id) throw codedError('artist_message_insert_failed');
  return rowShape(row);
}

/**
 * The active message for one piece, body included: the artist wrote it and
 * may read it back. Only ever served behind the admin registry unlock.
 */
export async function readForArtist(db, keeperPieceId) {
  if (!db) throw codedError('db_not_configured');
  if (typeof keeperPieceId !== 'string' || !keeperPieceId.trim()) {
    throw codedError('invalid_keeper_piece_id');
  }
  return rowShape(await activeRow(db, keeperPieceId));
}

/**
 * The caretaker unlocks and meets the message: stamp revealed_at exactly once
 * on the active message and return it, body included. A second call finds
 * the stamp already set and returns the same row unchanged, so the collector
 * flow can call it idempotently. Returns null when no active message exists.
 */
export async function revealForKeeper(db, keeperPieceId, at) {
  if (!db) throw codedError('db_not_configured');
  if (typeof keeperPieceId !== 'string' || !keeperPieceId.trim()) {
    throw codedError('invalid_keeper_piece_id');
  }
  const revealedAt = isoInstant(at ?? new Date().toISOString(), 'invalid_revealed_at');
  const current = await activeRow(db, keeperPieceId);
  if (!current) return null;
  if (current.revealed_at === null) {
    await db.prepare(
      `UPDATE artist_messages SET revealed_at = ?2
        WHERE id = ?1 AND revealed_at IS NULL`,
    ).bind(current.id, revealedAt).run();
  }
  const row = await activeRow(db, keeperPieceId);
  if (!row) throw codedError('artist_message_conflict');
  return rowShape(row);
}
