import { requireAdult } from './collectorDreams.js';

const pieceSql = `
  SELECT id, keeper_user_id, claimed_at, released_at
    FROM keeper_pieces
   WHERE public_code = ?1 AND registration_status = 'registered'
     AND plate_status IN ('legacy', 'generated', 'active')`;
const activeKeeper = 'piece.keeper_user_id = ?2 AND piece.claimed_at IS NOT NULL AND piece.released_at IS NULL';

function text(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new Error('invalid_record_entry');
  }
  return value.trim();
}

function entryId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
    throw new Error('invalid_record_entry');
  }
  return id;
}

async function piece(db, publicCode) {
  const row = await db.prepare(pieceSql).bind(publicCode).first();
  if (!row) throw new Error('record_not_found');
  return row;
}

const reflectionFields = `r.id, r.body, r.created_at AS createdAt`;
const milestoneFields = `m.id, m.year, m.grain,
  CASE m.grain WHEN 'region' THEN c.region ELSE c.city END AS place,
  c.country`;
const milestoneSource = `collector_place_milestones m JOIN atlas_source_cities c ON c.id = m.place_id`;

export async function readPublicLivingRecord(db, publicCode) {
  const { id } = await piece(db, publicCode);
  const reflections = await db.prepare(`
    SELECT ${reflectionFields} FROM collector_reflections r
     WHERE r.keeper_piece_id = ?1 AND r.published_at IS NOT NULL
     ORDER BY r.created_at, r.id`).bind(id).all();
  const milestones = await db.prepare(`
    SELECT ${milestoneFields} FROM ${milestoneSource}
     WHERE m.keeper_piece_id = ?1 AND m.visibility = 'public'
     ORDER BY m.year, m.created_at, m.id`).bind(id).all();
  return { reflections: reflections.results, milestones: milestones.results };
}

export async function readPrivateLivingRecord(db, publicCode, userId) {
  const current = await piece(db, publicCode);
  const keeper = current.keeper_user_id === userId && Boolean(current.claimed_at) && !current.released_at;
  const access = await db.prepare(`
    SELECT 1 AS allowed FROM artwork_contributor_current_access
     WHERE keeper_piece_id = ?1 AND contributor_user_id = ?2
     LIMIT 1`).bind(current.id, userId).first();
  const reflections = await db.prepare(`
    SELECT ${reflectionFields},
           CASE WHEN r.published_at IS NOT NULL THEN 'public'
                WHEN r.offered_at IS NOT NULL THEN 'offered' ELSE 'private' END AS visibility,
           r.author_user_id = ?2 AS yours, r.successor_access AS successorAccess,
           EXISTS (SELECT 1 FROM artwork_contributor_current_access a
             WHERE a.invitation_id = r.invitation_id AND a.keeper_user_id = ?2
               AND r.offered_at IS NOT NULL AND r.published_at IS NULL) AS canPublish,
           EXISTS (SELECT 1 FROM artwork_contributor_current_access a WHERE a.invitation_id = r.invitation_id) AS active
      FROM collector_reflections r JOIN keeper_pieces piece ON piece.id = r.keeper_piece_id
     WHERE r.keeper_piece_id = ?1 AND (
       r.author_user_id = ?2 OR (
         ${activeKeeper} AND r.published_at IS NULL
         AND r.offered_at IS NOT NULL
         AND EXISTS (SELECT 1 FROM artwork_contributor_current_access a WHERE a.invitation_id = r.invitation_id)
       ) OR (
         ${activeKeeper} AND r.published_at IS NULL AND r.successor_access = 1
         AND piece.steward_version > r.steward_version
       )
     )
     ORDER BY r.created_at, r.id`).bind(current.id, userId).all();
  const milestones = await db.prepare(`
    SELECT ${milestoneFields}, m.visibility, m.author_user_id = ?2 AS yours, m.successor_access AS successorAccess
      FROM ${milestoneSource} JOIN keeper_pieces piece ON piece.id = m.keeper_piece_id
     WHERE m.keeper_piece_id = ?1 AND m.visibility = 'private'
       AND (m.author_user_id = ?2 OR (${activeKeeper} AND m.successor_access = 1
         AND piece.steward_version > m.steward_version))
     ORDER BY m.year, m.created_at, m.id`).bind(current.id, userId).all();
  return {
    role: keeper ? 'keeper' : access ? 'contributor' : null,
    reflections: reflections.results,
    milestones: milestones.results,
  };
}

export async function searchMilestonePlaces(db, publicCode, userId, query) {
  const match = text(query, 60);
  if (match.length < 2) throw new Error('invalid_record_entry');
  const places = await db.prepare(`
    SELECT c.id, c.city, c.region, c.country
      FROM atlas_source_cities c
     WHERE EXISTS (
       SELECT 1 FROM keeper_pieces piece WHERE piece.public_code = ?1
         AND piece.registration_status = 'registered' AND ${activeKeeper}
     )
       AND (instr(lower(c.city), lower(?3)) > 0 OR instr(lower(c.region), lower(?3)) > 0)
     ORDER BY c.city, c.country, c.id LIMIT 15`).bind(publicCode, userId, match).all();
  return places.results;
}

export async function writeLivingRecord(db, publicCode, userId, input, now) {
  const id = entryId(input.id);
  const { id: pieceId } = await piece(db, publicCode);
  if (input.action === 'successor-access') {
    if (!['reflection', 'milestone'].includes(input.kind) || typeof input.allow !== 'boolean') {
      throw new Error('invalid_record_entry');
    }
    const table = input.kind === 'reflection' ? 'collector_reflections' : 'collector_place_milestones';
    const unpublished = input.kind === 'reflection' ? 'published_at IS NULL' : "visibility = 'private'";
    // This author-only grant outlives caretakership. It conveys reading, never ownership or publication.
    const updated = await db.prepare(`
      UPDATE ${table} SET successor_access = ?4
       WHERE keeper_piece_id = ?1 AND author_user_id = ?2 AND id = ?3 AND ${unpublished}
      RETURNING id`).bind(pieceId, userId, id, input.allow ? 1 : 0).first();
    if (updated) return;
  }
  if (input.action === 'reflect') {
    const body = text(input.body, 2000);
    const saved = await db.prepare(`
      INSERT INTO collector_reflections (id, invitation_id, keeper_piece_id, author_user_id, body, created_at, steward_version)
      SELECT ?3, a.invitation_id, ?1, ?2, ?4, ?5, a.steward_version FROM artwork_contributor_current_access a
       WHERE a.keeper_piece_id = ?1 AND a.contributor_user_id = ?2
      ON CONFLICT(id) DO NOTHING RETURNING id`).bind(pieceId, userId, id, body, now).first();
    if (saved) return;
    const retry = await db.prepare(`
      SELECT r.id FROM collector_reflections r
       JOIN artwork_contributor_current_access a ON a.invitation_id = r.invitation_id
       WHERE r.keeper_piece_id = ?1 AND r.author_user_id = ?2 AND r.id = ?3 AND r.body = ?4
    `).bind(pieceId, userId, id, body).first();
    if (retry) return;
  }
  if (input.action === 'offer' || input.action === 'withdraw') {
    if (input.action === 'offer') await requireAdult(db, userId, now);
    const updated = await db.prepare(`
      UPDATE collector_reflections SET offered_at = CASE ?4 WHEN 'offer' THEN COALESCE(offered_at, ?5) ELSE NULL END
       WHERE keeper_piece_id = ?1 AND author_user_id = ?2 AND id = ?3 AND published_at IS NULL
         AND (?4 = 'withdraw' OR EXISTS (
           SELECT 1 FROM artwork_contributor_current_access a WHERE a.invitation_id = collector_reflections.invitation_id
         ))
      RETURNING id`).bind(pieceId, userId, id, input.action, now).first();
    if (updated) return;
  }
  if (input.action === 'publish') {
    const candidate = await db.prepare(`
      SELECT r.author_user_id AS authorUserId FROM collector_reflections r
        JOIN keeper_pieces piece ON piece.id = r.keeper_piece_id
        JOIN artwork_contributor_current_access a ON a.invitation_id = r.invitation_id
       WHERE r.keeper_piece_id = ?1 AND ${activeKeeper} AND r.id = ?3 AND r.offered_at IS NOT NULL
    `).bind(pieceId, userId, id).first();
    if (!candidate) throw new Error('record_permission_required');
    await requireAdult(db, candidate.authorUserId, now);
    const published = await db.prepare(`
      UPDATE collector_reflections SET published_at = ?4
       WHERE keeper_piece_id = ?1 AND id = ?3 AND offered_at IS NOT NULL AND published_at IS NULL
         AND EXISTS (
           SELECT 1 FROM artwork_contributor_current_access a
            WHERE a.invitation_id = collector_reflections.invitation_id AND a.keeper_user_id = ?2
         )
      RETURNING id`).bind(pieceId, userId, id, now).first();
    if (published) return;
    const retry = await db.prepare(`
      SELECT r.id FROM collector_reflections r
       JOIN artwork_contributor_current_access a ON a.invitation_id = r.invitation_id
       WHERE r.keeper_piece_id = ?1 AND a.keeper_user_id = ?2 AND r.id = ?3 AND r.published_at IS NOT NULL
    `).bind(pieceId, userId, id).first();
    if (retry) return;
  }
  if (input.action === 'milestone') {
    const placeId = text(input.placeId, 128);
    const { grain, year, visibility } = input;
    if (!['city', 'region'].includes(grain) || !['private', 'public'].includes(visibility)
      || !Number.isInteger(year) || year < 1900 || year > Number(now.slice(0, 4))) {
      throw new Error('invalid_record_entry');
    }
    if (visibility === 'public') await requireAdult(db, userId, now);
    const saved = await db.prepare(`
      INSERT INTO collector_place_milestones (id, keeper_piece_id, author_user_id, place_id, grain, year, visibility, created_at, steward_version)
      SELECT ?3, piece.id, ?2, c.id, ?5, ?6, ?7, ?8, piece.steward_version
        FROM keeper_pieces piece JOIN atlas_source_cities c ON c.id = ?4
       WHERE piece.id = ?1 AND ${activeKeeper}
         AND (?5 = 'city' OR length(trim(c.region)) > 0)
      ON CONFLICT(id) DO NOTHING RETURNING id`).bind(pieceId, userId, id, placeId, grain, year, visibility, now).first();
    if (saved) return;
    const retry = await db.prepare(`
      SELECT m.id FROM collector_place_milestones m JOIN keeper_pieces piece ON piece.id = m.keeper_piece_id
       WHERE m.keeper_piece_id = ?1 AND ${activeKeeper} AND m.id = ?3 AND m.author_user_id = ?2
         AND m.place_id = ?4 AND m.grain = ?5 AND m.year = ?6 AND m.visibility = ?7
    `).bind(pieceId, userId, id, placeId, grain, year, visibility).first();
    if (retry) return;
  }
  throw new Error('record_permission_required');
}
