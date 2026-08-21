import { legacyEnabled } from './keeper.js';
import { refreshPieceRecord } from './pieceRecordRefresh.js';

const DREAM_SCOPES = new Set([
  'self', 'family', 'community', 'planet',
]);
const DREAM_VISIBILITIES = new Set(['private', 'anonymous', 'attributed']);
const PUBLIC_DREAM_VISIBILITIES = new Set(['anonymous', 'attributed']);
// Three tiers, named for what they actually do (migration 042,
// collector-screen-wording.md §6 "Three tiers, and what outlives you"):
// shine is public forever, keep travels with the piece and opens to whoever
// holds it, seal opens to nobody but its writer, ever.
const DREAM_TIERS = new Set(['shine', 'keep', 'seal']);
const MARKER_KINDS = new Set(['milestone', 'change', 'encounter', 'fulfillment']);
const RITUAL_ACTIONS = new Set(['reinforce', 'plant-new', 'fulfilled']);
export const COLLECTOR_RITUAL_WINDOW_DAYS = 15;

function requiredDatabase(env) {
  if (!env?.DB) throw new Error('db_not_configured');
  return env.DB;
}

function validIso(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function requiredText(value, code, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new Error(code);
  }
  return value.trim();
}

function requiredId(value, code) {
  return requiredText(value, code, 128);
}

function dreamId() {
  return `dream-${crypto.randomUUID().replaceAll('-', '')}`;
}

function markerId() {
  return `marker-${crypto.randomUUID().replaceAll('-', '')}`;
}

function ritualId() {
  return `ritual-${crypto.randomUUID().replaceAll('-', '')}`;
}

function mutationId() {
  return `dream-mutation-${crypto.randomUUID().replaceAll('-', '')}`;
}

function tierChangeId() {
  return `dream-tier-${crypto.randomUUID().replaceAll('-', '')}`;
}

/**
 * True once migration 042 (tier / heirs_may_share / the tier-change ledger)
 * has been applied to this database. Pages deploys and D1 migrations are not
 * atomic, so every tier behavior below is gated on the schema actually being
 * there; a pre-041 database keeps the exact pre-tier behavior.
 */
async function dreamTierSchemaPresent(db) {
  try {
    await db.prepare('SELECT tier FROM collector_dreams LIMIT 1').first();
    return true;
  } catch {
    return false;
  }
}

function rowHasTier(row) {
  return Boolean(row) && Object.hasOwn(row, 'tier') && row.tier != null;
}

function openPublicShare(row) {
  return Boolean(row?.public_shared_at) && !row?.public_revoked_at
    && PUBLIC_DREAM_VISIBILITIES.has(row?.visibility);
}

/**
 * Project one dream row for one viewer. Post-041 the body obeys the tier:
 * the writer always reads their own words (every tier, forever, even after
 * the piece transfers); shine is readable by anyone the state is served to;
 * keep opens only to the piece's current holder; seal opens to nobody but
 * the writer -- not the next caretaker, not heirs. A withheld body is null.
 * Without a viewer (internal holder-only paths) the body passes through
 * unredacted, matching pre-041 behavior.
 */
function dreamFromRow(row, viewer) {
  if (!row) return null;
  const tiered = rowHasTier(row);
  let body = row.body;
  if (viewer && tiered) {
    const own = row.author_user_id === viewer.viewerId;
    const readable = own
      || row.tier === 'shine'
      || (row.tier === 'keep' && viewer.holds === true);
    if (!readable) body = null;
  }
  const projected = {
    id: row.id,
    keeperPieceId: row.keeper_piece_id,
    body,
    scope: row.scope,
    visibility: row.visibility,
    version: Number(row.record_version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sharedAt: row.public_shared_at ?? null,
    revokedAt: row.public_revoked_at ?? null,
    fulfilledAt: row.fulfilled_at ?? null,
    archivedAt: row.archived_at ?? null,
  };
  if (tiered) {
    projected.tier = row.tier;
    projected.heirsMayShare = Number(row.heirs_may_share) === 1;
    projected.sealed = row.tier === 'seal';
  }
  return projected;
}

function markerFromRow(row) {
  return {
    id: row.id,
    dreamId: row.dream_id,
    kind: row.marker_kind,
    body: row.body,
    createdAt: row.created_at,
  };
}

async function heldPiece(db, keeperPieceId, userId) {
  const piece = await db.prepare(`
    SELECT id FROM keeper_pieces
     WHERE id = ?1 AND keeper_user_id = ?2
       AND claimed_at IS NOT NULL AND released_at IS NULL
       AND plate_status NOT IN ('void', 'superseded')
  `).bind(keeperPieceId, userId).first();
  if (!piece) throw new Error('piece_not_held');
  return piece;
}

// SELECT * on purpose: this must read identically on a pre-041 database (no
// tier / heirs_may_share columns yet) and a post-041 one, during the window
// where the deploy and the D1 migration have not both landed.
async function currentDreamRow(db, keeperPieceId) {
  return db.prepare(`
    SELECT * FROM collector_dreams
     WHERE keeper_piece_id = ?1 AND archived_at IS NULL
  `).bind(keeperPieceId).first();
}

async function authorInternalUser(db, userId) {
  return db.prepare(
    'SELECT id FROM users WHERE auth_user_id = ?1',
  ).bind(userId).first();
}

function validBirthParts(birthDate) {
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;
  const [year, month, day] = birthDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

function localDateParts(at, timeZone) {
  if (typeof timeZone !== 'string' || !timeZone.trim()) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(at));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const year = Number(values.year);
    const month = Number(values.month);
    const day = Number(values.day);
    return Number.isSafeInteger(year) && Number.isSafeInteger(month) && Number.isSafeInteger(day)
      ? { year, month, day }
      : null;
  } catch {
    return null;
  }
}

function establishedAdult(birthDate, at, timeZone) {
  const parts = validBirthParts(birthDate);
  if (!parts) return false;
  const { year, month, day } = parts;
  const local = localDateParts(at, timeZone);
  if (!local) return false;
  let age = local.year - year;
  if (local.month < month || (local.month === month && local.day < day)) age -= 1;
  return age >= 18;
}

async function requireAdult(db, userId, now) {
  const user = await authorInternalUser(db, userId);
  if (!user) throw new Error('user_not_synced');
  const profile = await db.prepare(
    'SELECT birth_date, tz_id FROM profiles WHERE user_id = ?1',
  ).bind(user.id).first();
  if (!profile) throw new Error('adult_status_required');
  if (!establishedAdult(profile.birth_date, now, profile.tz_id)) {
    throw new Error('minor_publicity_forbidden');
  }
}

async function requireNameConsent(db, userId) {
  const consent = await db.prepare(`
    SELECT 1
      FROM users person
      JOIN collector_person_privacy privacy ON privacy.user_id = person.id
     WHERE person.auth_user_id = ?1 AND privacy.share_name = 1
  `).bind(userId).first();
  if (!consent) throw new Error('name_consent_required');
}

function requiredMutationInput(input) {
  const userId = requiredId(input?.userId, 'invalid_user');
  const keeperPieceId = requiredId(input?.keeperPieceId, 'invalid_keeper_piece_id');
  const idempotencyKey = requiredText(input?.idempotencyKey, 'invalid_idempotency_key', 128);
  if (idempotencyKey.length < 8) throw new Error('invalid_idempotency_key');
  if (!validIso(input?.now)) throw new Error('invalid_timestamp');
  return { userId, keeperPieceId, idempotencyKey };
}

async function replayedMutation(
  db, userId, idempotencyKey, dreamId, action, requestJson,
) {
  const replay = await db.prepare(`
    SELECT dream_id, action, request_json FROM collector_dream_mutations
     WHERE author_user_id = ?1 AND idempotency_key = ?2
  `).bind(userId, idempotencyKey).first();
  if (!replay) return false;
  if (replay.dream_id !== dreamId || replay.action !== action
    || replay.request_json !== requestJson) {
    throw new Error('idempotency_conflict');
  }
  return true;
}

export async function getCollectorDreamState(env, { userId, keeperPieceId }) {
  const db = requiredDatabase(env);
  const pieceId = requiredId(keeperPieceId, 'invalid_keeper_piece_id');
  const holderId = requiredId(userId, 'invalid_user');
  let holds = true;
  try {
    await heldPiece(db, pieceId, holderId);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'piece_not_held') throw error;
    holds = false;
  }
  if (!holds) {
    // The writer always keeps access to their own words, every tier
    // including seal, even after the piece transfers (041). A non-holder who
    // never wrote into this piece stays exactly where they were: not held.
    if (!(await dreamTierSchemaPresent(db))) throw new Error('piece_not_held');
    const authored = await db.prepare(`
      SELECT 1 AS present FROM collector_dreams
       WHERE keeper_piece_id = ?1 AND author_user_id = ?2 LIMIT 1
    `).bind(pieceId, holderId).first();
    if (!authored) throw new Error('piece_not_held');
  }
  const viewer = { viewerId: holderId, holds };
  let current = await currentDreamRow(db, pieceId);
  const historyResult = await db.prepare(`
    SELECT * FROM collector_dreams
     WHERE keeper_piece_id = ?1 AND archived_at IS NOT NULL
     ORDER BY created_at, id
  `).bind(pieceId).all();
  let historyRows = historyResult?.results ?? [];
  if (!holds) {
    // A past writer sees their own rows and what shines -- never the shape,
    // dates, or existence of another person's private writing.
    const visibleToPastWriter = (row) => row.author_user_id === holderId
      || (rowHasTier(row) && row.tier === 'shine');
    historyRows = historyRows.filter(visibleToPastWriter);
    if (current && !visibleToPastWriter(current)) current = null;
  }
  let markers = [];
  if (current && holds) {
    const markerResult = await db.prepare(`
      SELECT id, dream_id, marker_kind, body, created_at
        FROM collector_dream_markers
       WHERE dream_id = ?1 ORDER BY created_at, id
    `).bind(current.id).all();
    markers = (markerResult?.results ?? []).map(markerFromRow);
  }
  return {
    keeperPieceId: pieceId,
    current: dreamFromRow(current, viewer),
    history: historyRows.map((row) => dreamFromRow(row, viewer)),
    markers,
  };
}

export async function createCollectorDream(env, input) {
  const db = requiredDatabase(env);
  const userId = requiredId(input?.userId, 'invalid_user');
  const keeperPieceId = requiredId(input?.keeperPieceId, 'invalid_keeper_piece_id');
  const body = requiredText(input?.body, 'invalid_dream_body', 4000);
  const idempotencyKey = requiredText(input?.idempotencyKey, 'invalid_idempotency_key', 128);
  if (idempotencyKey.length < 8) throw new Error('invalid_idempotency_key');
  if (!DREAM_SCOPES.has(input?.scope)) throw new Error('invalid_dream_scope');
  if (!validIso(input?.now)) throw new Error('invalid_timestamp');
  const tier = input?.tier === undefined ? 'keep' : input.tier;
  if (!DREAM_TIERS.has(tier)) throw new Error('invalid_dream_tier');
  const heirsMayShare = input?.heirsMayShare === undefined ? true : input.heirsMayShare;
  if (typeof heirsMayShare !== 'boolean') throw new Error('invalid_heirs_choice');
  await heldPiece(db, keeperPieceId, userId);
  const tiered = await dreamTierSchemaPresent(db);
  if (!tiered && (tier !== 'keep' || heirsMayShare !== true)) {
    throw new Error('dream_tiers_unavailable');
  }
  // Seal answers the heirs question by itself: the sub-choice is hidden on
  // that tier and the stored flag is pinned to 0 (migration 042).
  const storedHeirs = tier === 'seal' ? 0 : (heirsMayShare ? 1 : 0);

  const matchesReplay = (row) => row.keeper_piece_id === keeperPieceId
    && row.body === body && row.scope === input.scope
    && (!rowHasTier(row) || row.tier === tier);
  const replay = await db.prepare(`
    SELECT * FROM collector_dreams
     WHERE author_user_id = ?1 AND idempotency_key = ?2
  `).bind(userId, idempotencyKey).first();
  if (replay) {
    if (!matchesReplay(replay)) throw new Error('idempotency_conflict');
    return getCollectorDreamState(env, { userId, keeperPieceId });
  }
  if (await currentDreamRow(db, keeperPieceId)) throw new Error('current_dream_exists');
  const newDreamId = dreamId();
  const statements = [];
  if (!tiered) {
    statements.push(db.prepare(`
      INSERT INTO collector_dreams
        (id, keeper_piece_id, author_user_id, body, scope, idempotency_key,
         created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
    `).bind(
      newDreamId, keeperPieceId, userId, body, input.scope, idempotencyKey, input.now,
    ));
  } else {
    // Placing a shine dream IS the choice to show it: the row is planted at
    // keep, shared through the audited share mutation, then flipped
    // keep->shine by the audited tier change, all in one transaction, so the
    // public projection and the tier can never disagree.
    const insertTier = tier === 'shine' ? 'keep' : tier;
    const insertHeirs = tier === 'shine' ? 1 : storedHeirs;
    statements.push(db.prepare(`
      INSERT INTO collector_dreams
        (id, keeper_piece_id, author_user_id, body, scope, idempotency_key,
         created_at, updated_at, tier, heirs_may_share)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8, ?9)
    `).bind(
      newDreamId, keeperPieceId, userId, body, input.scope, idempotencyKey,
      input.now, insertTier, insertHeirs,
    ));
    if (tier === 'shine') {
      await requireAdult(db, userId, input.now);
      statements.push(db.prepare(`
        INSERT INTO collector_dream_mutations
          (id, dream_id, author_user_id, action, idempotency_key, request_json,
           resulting_version, created_at)
        VALUES (?1, ?2, ?3, 'share', ?4, ?5, 2, ?6)
      `).bind(
        mutationId(), newDreamId, userId, idempotencyKey,
        JSON.stringify({ visibility: 'anonymous' }), input.now,
      ));
      statements.push(db.prepare(`
        INSERT INTO collector_dream_tier_changes
          (id, dream_id, author_user_id, from_tier, to_tier, idempotency_key,
           resulting_version, created_at)
        VALUES (?1, ?2, ?3, 'keep', 'shine', ?4, 3, ?5)
      `).bind(tierChangeId(), newDreamId, userId, idempotencyKey, input.now));
    }
  }
  try {
    if (statements.length === 1) {
      await statements[0].run();
    } else {
      if (typeof db.batch !== 'function') throw new Error('atomic_batch_unavailable');
      await db.batch(statements);
    }
  } catch (error) {
    const latestReplay = await db.prepare(`
      SELECT * FROM collector_dreams
       WHERE author_user_id = ?1 AND idempotency_key = ?2
    `).bind(userId, idempotencyKey).first();
    if (!latestReplay) {
      if (await currentDreamRow(db, keeperPieceId)) throw new Error('current_dream_exists');
      throw error;
    }
    if (!matchesReplay(latestReplay)) throw new Error('idempotency_conflict');
  }
  return getCollectorDreamState(env, { userId, keeperPieceId });
}

/**
 * The anchor for the yearly window: the birth profile when one is on file
 * and readable, otherwise the piece's claim anniversary (keeper_pieces.
 * claimed_at, same window math over UTC). Callers can never tell which
 * anchor answered -- "they never see a difference". Returns the matched
 * window ({year, distance}) or null when today is outside it.
 */
async function yearlyWindowFor(db, userId, keeperPieceId, now) {
  const user = await authorInternalUser(db, userId);
  const profile = user ? await db.prepare(
    'SELECT birth_date, tz_id FROM profiles WHERE user_id = ?1',
  ).bind(user.id).first() : null;
  if (profile && validBirthParts(profile.birth_date) && localDateParts(now, profile.tz_id)) {
    return birthdayWindow(profile.birth_date, now, profile.tz_id);
  }
  const piece = await db.prepare(
    'SELECT claimed_at FROM keeper_pieces WHERE id = ?1',
  ).bind(keeperPieceId).first();
  const claimedDate = typeof piece?.claimed_at === 'string'
    ? piece.claimed_at.slice(0, 10)
    : null;
  if (!claimedDate || !validBirthParts(claimedDate)) return null;
  return birthdayWindow(claimedDate, now, 'UTC');
}

export async function updateCollectorDream(env, input) {
  const db = requiredDatabase(env);
  const { userId, keeperPieceId, idempotencyKey } = requiredMutationInput(input);
  const body = requiredText(input?.body, 'invalid_dream_body', 4000);
  if (!DREAM_SCOPES.has(input?.scope)) throw new Error('invalid_dream_scope');
  if (!Number.isSafeInteger(input?.expectedVersion) || input.expectedVersion < 1) {
    throw new Error('invalid_expected_version');
  }
  await heldPiece(db, keeperPieceId, userId);
  const current = await currentDreamRow(db, keeperPieceId);
  if (!current) throw new Error('current_dream_missing');
  const requestJson = JSON.stringify({
    body, scope: input.scope, expectedVersion: input.expectedVersion,
  });
  if (await replayedMutation(
    db, userId, idempotencyKey, current.id, 'edit', requestJson,
  )) {
    return getCollectorDreamState(env, { userId, keeperPieceId });
  }
  // The yearly lock (§6, "It can be changed once a year, on the birthday"):
  // editing the standing dream's words opens only inside the person's own
  // window. First placement (create) is ungated, and so are tier changes --
  // the lock is what makes the words worth reading, not a lock on choosing
  // where they live. Ships with migration 042.
  if (rowHasTier(current)) {
    const window = await yearlyWindowFor(db, userId, keeperPieceId, input.now);
    if (!window) throw new Error('outside_birthday_window');
  }
  const nextVersion = input.expectedVersion + 1;
  const newMutationId = mutationId();
  try {
    await db.prepare(`
      INSERT INTO collector_dream_mutations
        (id, dream_id, author_user_id, action, idempotency_key, request_json,
         resulting_version, created_at)
      VALUES (?1, ?2, ?3, 'edit', ?4, ?5, ?6, ?7)
    `).bind(
      newMutationId, current.id, userId, idempotencyKey, requestJson,
      nextVersion, input.now,
    ).run();
  } catch (error) {
    if (error instanceof Error && error.message.includes('dream mutation did not apply')) {
      throw new Error('version_conflict');
    }
    throw error;
  }
  return getCollectorDreamState(env, { userId, keeperPieceId });
}

export async function setCollectorDreamSharing(env, input) {
  const db = requiredDatabase(env);
  const { userId, keeperPieceId, idempotencyKey } = requiredMutationInput(input);
  if (!DREAM_VISIBILITIES.has(input?.visibility)) throw new Error('invalid_visibility');
  await heldPiece(db, keeperPieceId, userId);
  const current = await currentDreamRow(db, keeperPieceId);
  if (!current) throw new Error('current_dream_missing');
  const action = input.visibility === 'private' ? 'revoke' : 'share';
  const requestJson = JSON.stringify({ visibility: input.visibility });
  if (await replayedMutation(
    db, userId, idempotencyKey, current.id, action, requestJson,
  )) {
    return getCollectorDreamState(env, { userId, keeperPieceId });
  }
  const tiered = rowHasTier(current);
  if (action === 'revoke' && tiered && current.tier === 'shine') {
    // Once it shines it stays shining, always (§6). The audited admin abuse
    // removal (migration 041, functions/api/admin/shine-removals.js) is the
    // only path off display, and it never runs through here.
    throw new Error('shine_is_permanent');
  }
  if (action === 'share' && tiered && current.tier === 'seal') {
    // Opening a sealed dream toward the light is a deliberate tier act:
    // setCollectorDreamTier(tier: 'shine'), never a plain share.
    throw new Error('dream_sealed');
  }
  if (input.visibility !== 'private') await requireAdult(db, userId, input.now);
  if (input.visibility === 'attributed') await requireNameConsent(db, userId);
  if (input.visibility === 'private' && !current.public_shared_at) throw new Error('dream_not_shared');
  const nextVersion = Number(current.record_version) + 1;
  const newMutationId = mutationId();
  const statements = [db.prepare(`
    INSERT INTO collector_dream_mutations
      (id, dream_id, author_user_id, action, idempotency_key, request_json,
       resulting_version, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
  `).bind(
    newMutationId, current.id, userId, action, idempotencyKey, requestJson,
    nextVersion, input.now,
  )];
  if (action === 'share' && tiered && current.tier === 'keep') {
    // Sharing IS shining (§6): the share and the keep->shine flip land in
    // one transaction so the tier and the public projection never disagree.
    statements.push(db.prepare(`
      INSERT INTO collector_dream_tier_changes
        (id, dream_id, author_user_id, from_tier, to_tier, idempotency_key,
         resulting_version, created_at)
      VALUES (?1, ?2, ?3, 'keep', 'shine', ?4, ?5, ?6)
    `).bind(
      tierChangeId(), current.id, userId, idempotencyKey, nextVersion + 1, input.now,
    ));
  }
  try {
    if (statements.length === 1) {
      await statements[0].run();
    } else {
      if (typeof db.batch !== 'function') throw new Error('atomic_batch_unavailable');
      await db.batch(statements);
    }
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes('dream mutation did not apply')
      || error.message.includes('dream tier change did not apply')
    )) {
      throw new Error('version_conflict');
    }
    throw error;
  }
  // A revoke never removes already-shone words (once-shone-stays-shone,
  // §6), so only a share -- which may newly publish the dream's words --
  // ever needs to refresh the Piece Record. The AFTER INSERT trigger on
  // collector_dream_mutations (migration 029) writes public_shared_at onto
  // the collector_dreams row synchronously, as part of the same statement
  // that just committed above, so gatherShines (_lib/pieceRecord.js) is
  // guaranteed to see it already when the record is rebuilt here.
  if (action === 'share') {
    await refreshPieceRecord(env, {
      keeperPieceId,
      trigger: 'contribution',
      generatedAt: input.now,
      includeLegacySections: legacyEnabled(),
    });
  }
  return getCollectorDreamState(env, { userId, keeperPieceId });
}

/**
 * Move the standing dream between tiers, following the settled matrix:
 * keep->shine, keep->seal, seal->shine. shine is terminal (once public,
 * never private again) and seal->keep is forbidden. Entering shine routes
 * through the existing audited share path in the same transaction, so the
 * public projection (public_shared_at / visibility) and the tier can never
 * disagree; entering seal requires a dream that has never shone (words that
 * already entered the permanent Piece Record cannot be sealed). Tier changes
 * are NOT gated by the yearly window -- only the words are.
 */
export async function setCollectorDreamTier(env, input) {
  const db = requiredDatabase(env);
  const { userId, keeperPieceId, idempotencyKey } = requiredMutationInput(input);
  const tier = input?.tier;
  if (!DREAM_TIERS.has(tier)) throw new Error('invalid_dream_tier');
  if (tier === 'keep') throw new Error('forbidden_tier_transition');
  await heldPiece(db, keeperPieceId, userId);
  if (!(await dreamTierSchemaPresent(db))) throw new Error('dream_tiers_unavailable');
  const current = await currentDreamRow(db, keeperPieceId);
  if (!current) throw new Error('current_dream_missing');
  const replay = await db.prepare(`
    SELECT dream_id, to_tier FROM collector_dream_tier_changes
     WHERE author_user_id = ?1 AND idempotency_key = ?2
  `).bind(userId, idempotencyKey).first();
  if (replay) {
    if (replay.dream_id !== current.id || replay.to_tier !== tier) {
      throw new Error('idempotency_conflict');
    }
    return getCollectorDreamState(env, { userId, keeperPieceId });
  }
  if (current.tier === tier) throw new Error('tier_unchanged');
  if (current.tier === 'shine') throw new Error('shine_is_permanent');
  if (tier === 'seal') {
    if (current.tier !== 'keep') throw new Error('forbidden_tier_transition');
    if (current.public_shared_at) throw new Error('shone_cannot_seal');
  }
  const statements = [];
  let version = Number(current.record_version);
  if (tier === 'shine') {
    await requireAdult(db, userId, input.now);
    if (!openPublicShare(current)) {
      version += 1;
      statements.push(db.prepare(`
        INSERT INTO collector_dream_mutations
          (id, dream_id, author_user_id, action, idempotency_key, request_json,
           resulting_version, created_at)
        VALUES (?1, ?2, ?3, 'share', ?4, ?5, ?6, ?7)
      `).bind(
        mutationId(), current.id, userId, idempotencyKey,
        JSON.stringify({ visibility: 'anonymous' }), version, input.now,
      ));
    }
  }
  version += 1;
  statements.push(db.prepare(`
    INSERT INTO collector_dream_tier_changes
      (id, dream_id, author_user_id, from_tier, to_tier, idempotency_key,
       resulting_version, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
  `).bind(
    tierChangeId(), current.id, userId, current.tier, tier, idempotencyKey,
    version, input.now,
  ));
  try {
    if (statements.length === 1) {
      await statements[0].run();
    } else {
      if (typeof db.batch !== 'function') throw new Error('atomic_batch_unavailable');
      await db.batch(statements);
    }
  } catch (error) {
    const raced = await db.prepare(`
      SELECT dream_id, to_tier FROM collector_dream_tier_changes
       WHERE author_user_id = ?1 AND idempotency_key = ?2
    `).bind(userId, idempotencyKey).first();
    if (raced) {
      if (raced.dream_id !== current.id || raced.to_tier !== tier) {
        throw new Error('idempotency_conflict');
      }
      return getCollectorDreamState(env, { userId, keeperPieceId });
    }
    if (error instanceof Error && (
      error.message.includes('dream mutation did not apply')
      || error.message.includes('dream tier change did not apply')
    )) {
      throw new Error('version_conflict');
    }
    throw error;
  }
  // keep->shine and seal->shine are the only ways to reach here with
  // tier === 'shine' (current.tier === tier and current.tier === 'shine'
  // both throw above, and 'keep' is rejected as a target at the top of this
  // function), and either one may newly publish the dream's words into the
  // record. keep->seal and every replay/raced path above return without
  // reaching this line, which is correct: sealing never shines anything,
  // and a raced loser's own write never committed.
  if (tier === 'shine') {
    await refreshPieceRecord(env, {
      keeperPieceId,
      trigger: 'contribution',
      generatedAt: input.now,
      includeLegacySections: legacyEnabled(),
    });
  }
  return getCollectorDreamState(env, { userId, keeperPieceId });
}

export async function appendCollectorDreamMarker(env, input) {
  const db = requiredDatabase(env);
  const { userId, keeperPieceId, idempotencyKey } = requiredMutationInput(input);
  const body = requiredText(input?.body, 'invalid_marker_body', 2000);
  if (!MARKER_KINDS.has(input?.kind)) throw new Error('invalid_marker_kind');
  await heldPiece(db, keeperPieceId, userId);
  const current = await currentDreamRow(db, keeperPieceId);
  if (!current) throw new Error('current_dream_missing');
  const replay = await db.prepare(`
    SELECT dream_id, keeper_piece_id, marker_kind, body
      FROM collector_dream_markers
     WHERE author_user_id = ?1 AND idempotency_key = ?2
  `).bind(userId, idempotencyKey).first();
  if (replay) {
    if (replay.dream_id !== current.id || replay.keeper_piece_id !== keeperPieceId
      || replay.marker_kind !== input.kind || replay.body !== body) {
      throw new Error('idempotency_conflict');
    }
    return getCollectorDreamState(env, { userId, keeperPieceId });
  }
  try {
    await db.prepare(`
      INSERT INTO collector_dream_markers
        (id, dream_id, keeper_piece_id, author_user_id, marker_kind, body,
         idempotency_key, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `).bind(
      markerId(), current.id, keeperPieceId, userId, input.kind, body,
      idempotencyKey, input.now,
    ).run();
  } catch (error) {
    const raced = await db.prepare(`
      SELECT dream_id, keeper_piece_id, marker_kind, body
        FROM collector_dream_markers
       WHERE author_user_id = ?1 AND idempotency_key = ?2
    `).bind(userId, idempotencyKey).first();
    if (!raced) throw error;
    if (raced.dream_id !== current.id || raced.keeper_piece_id !== keeperPieceId
      || raced.marker_kind !== input.kind || raced.body !== body) {
      throw new Error('idempotency_conflict');
    }
  }
  return getCollectorDreamState(env, { userId, keeperPieceId });
}

export async function getPublicCollectorDream(env, { keeperPieceId, now = new Date().toISOString() }) {
  const db = requiredDatabase(env);
  const pieceId = requiredId(keeperPieceId, 'invalid_keeper_piece_id');
  // Post-041 the public read also demands tier = 'shine' (defense in depth:
  // a keep or seal body can never surface here even if the share columns
  // were ever wrong). The tier-less query is kept only for the deploy window
  // where migration 042 has not landed yet.
  const publicDreamSql = (tierGuard) => `
    SELECT dream.id, dream.keeper_piece_id, dream.author_user_id, dream.body,
           dream.scope, dream.visibility, dream.public_shared_at
      FROM collector_dreams dream
      JOIN keeper_pieces piece ON piece.id = dream.keeper_piece_id
      JOIN users author ON author.auth_user_id = dream.author_user_id
      LEFT JOIN collector_person_privacy privacy ON privacy.user_id = author.id
     WHERE dream.keeper_piece_id = ?1
       AND dream.archived_at IS NULL
       AND dream.visibility IN ('anonymous', 'attributed')
       AND dream.public_shared_at IS NOT NULL
       AND dream.public_revoked_at IS NULL
       ${tierGuard}
       AND piece.keeper_user_id = dream.author_user_id
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND piece.plate_status NOT IN ('void', 'superseded')
       AND (dream.visibility = 'anonymous' OR privacy.share_name = 1)
  `;
  let row;
  try {
    row = await db.prepare(publicDreamSql("AND dream.tier = 'shine'")).bind(pieceId).first();
  } catch (error) {
    if (!(error instanceof Error) || !/no such column:.*\btier\b/i.test(error.message)) {
      throw error;
    }
    row = await db.prepare(publicDreamSql('')).bind(pieceId).first();
  }
  if (!row) return null;
  try {
    await requireAdult(db, row.author_user_id, now);
  } catch {
    return null;
  }
  let attribution = null;
  if (row.visibility === 'attributed') {
    const person = await db.prepare(
      'SELECT name FROM user WHERE id = ?1 AND emailVerified = 1',
    ).bind(row.author_user_id).first();
    if (!person || typeof person.name !== 'string' || !person.name.trim()) return null;
    attribution = person.name.trim();
  }
  return {
    keeperPieceId: row.keeper_piece_id,
    dreamId: row.id,
    body: row.body,
    scope: row.scope,
    visibility: row.visibility,
    attribution,
    sharedAt: row.public_shared_at,
  };
}

function birthdayOccurrence(year, month, day) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1, Math.min(day, lastDay)));
}

function birthdayWindow(birthDate, now, timeZone) {
  const parts = validBirthParts(birthDate);
  if (!parts) return null;
  const { month, day } = parts;
  const local = localDateParts(now, timeZone);
  if (!local) return null;
  const midnight = new Date(Date.UTC(
    local.year, local.month - 1, local.day,
  ));
  const candidates = [-1, 0, 1].map((offset) => {
    const year = local.year + offset;
    const occurrence = birthdayOccurrence(year, month, day);
    return { year, distance: Math.abs(occurrence.getTime() - midnight.getTime()) / 86_400_000 };
  }).sort((a, b) => a.distance - b.distance || a.year - b.year);
  return candidates[0].distance <= COLLECTOR_RITUAL_WINDOW_DAYS ? candidates[0] : null;
}

function ritualFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    keeperPieceId: row.keeper_piece_id,
    birthdayYear: Number(row.birthday_year),
    action: row.action,
    priorDreamId: row.prior_dream_id,
    resultingDreamId: row.resulting_dream_id,
    completedAt: row.completed_at,
  };
}

export async function getYearlyRitualEligibility(env, { userId, keeperPieceId, now }) {
  const db = requiredDatabase(env);
  const holderId = requiredId(userId, 'invalid_user');
  const pieceId = requiredId(keeperPieceId, 'invalid_keeper_piece_id');
  if (!validIso(now)) throw new Error('invalid_timestamp');
  await heldPiece(db, pieceId, holderId);
  const tiered = await dreamTierSchemaPresent(db);
  const user = await authorInternalUser(db, holderId);
  if (!user && !tiered) throw new Error('user_not_synced');
  const profile = user ? await db.prepare(
    'SELECT birth_date, tz_id FROM profiles WHERE user_id = ?1',
  ).bind(user.id).first() : null;
  const profileUsable = Boolean(profile)
    && Boolean(validBirthParts(profile.birth_date))
    && Boolean(localDateParts(now, profile.tz_id));
  let anchorDate = profileUsable ? profile.birth_date : null;
  let anchorTz = profileUsable ? profile.tz_id : null;
  if (!profileUsable) {
    if (!tiered) {
      // Pre-041 behavior, unchanged.
      if (!profile) {
        return {
          eligible: false, reason: 'birth_profile_missing', birthdayYear: null,
          actions: [], currentDream: null,
        };
      }
      return {
        eligible: false, reason: 'birth_profile_invalid', birthdayYear: null,
        actions: [], currentDream: null,
      };
    }
    // Anniversary fallback (041): no readable birth profile means the window
    // anchors on the piece's claim anniversary instead -- same math, same
    // response shape, and nothing in the payload says which anchor answered.
    const piece = await db.prepare(
      'SELECT claimed_at FROM keeper_pieces WHERE id = ?1',
    ).bind(pieceId).first();
    anchorDate = typeof piece?.claimed_at === 'string' ? piece.claimed_at.slice(0, 10) : null;
    anchorTz = 'UTC';
    if (!anchorDate || !validBirthParts(anchorDate)) {
      return {
        eligible: false, reason: 'outside_birthday_window', birthdayYear: null,
        actions: [], currentDream: dreamFromRow(await currentDreamRow(db, pieceId)),
      };
    }
  }
  const current = await currentDreamRow(db, pieceId);
  if (!current) {
    return {
      eligible: false, reason: 'current_dream_missing', birthdayYear: null,
      actions: [], currentDream: null,
    };
  }
  const window = birthdayWindow(anchorDate, now, anchorTz);
  if (!window) {
    return {
      eligible: false, reason: 'outside_birthday_window', birthdayYear: null,
      actions: [], currentDream: dreamFromRow(current),
    };
  }
  const completed = await db.prepare(`
    SELECT id FROM collector_dream_rituals
     WHERE keeper_piece_id = ?1 AND keeper_user_id = ?2 AND birthday_year = ?3
  `).bind(pieceId, holderId, window.year).first();
  if (completed) {
    return {
      eligible: false, reason: 'already_completed', birthdayYear: window.year,
      actions: [], currentDream: dreamFromRow(current),
    };
  }
  return {
    eligible: true,
    reason: null,
    birthdayYear: window.year,
    actions: ['reinforce', 'plant-new', 'fulfilled'],
    currentDream: dreamFromRow(current),
  };
}

export async function completeYearlyRitual(env, input) {
  const db = requiredDatabase(env);
  const { userId, keeperPieceId, idempotencyKey } = requiredMutationInput(input);
  if (!RITUAL_ACTIONS.has(input?.action)) throw new Error('invalid_ritual_action');
  const plantBody = input.action === 'plant-new'
    ? requiredText(input?.body, 'invalid_dream_body', 4000)
    : null;
  if (input.action === 'plant-new' && !DREAM_SCOPES.has(input?.scope)) {
    throw new Error('invalid_dream_scope');
  }
  await heldPiece(db, keeperPieceId, userId);
  const replay = await db.prepare(`
    SELECT ritual.id, ritual.keeper_piece_id, ritual.keeper_user_id,
           ritual.birthday_year, ritual.action, ritual.prior_dream_id,
           ritual.resulting_dream_id, ritual.completed_at,
           resulting.body AS resulting_body, resulting.scope AS resulting_scope
      FROM collector_dream_rituals ritual
      JOIN collector_dreams resulting ON resulting.id = ritual.resulting_dream_id
     WHERE ritual.keeper_user_id = ?1 AND ritual.idempotency_key = ?2
  `).bind(userId, idempotencyKey).first();
  if (replay) {
    if (replay.keeper_piece_id !== keeperPieceId || replay.action !== input.action
      || (input.action === 'plant-new'
        && (replay.resulting_body !== plantBody || replay.resulting_scope !== input.scope))) {
      throw new Error('idempotency_conflict');
    }
    return {
      ritual: ritualFromRow(replay),
      state: await getCollectorDreamState(env, { userId, keeperPieceId }),
      eligibility: await getYearlyRitualEligibility(env, {
        userId, keeperPieceId, now: input.now,
      }),
    };
  }
  const eligibility = await getYearlyRitualEligibility(env, {
    userId, keeperPieceId, now: input.now,
  });
  if (!eligibility.eligible) {
    if (eligibility.reason === 'already_completed') throw new Error('ritual_already_completed');
    throw new Error(eligibility.reason);
  }
  const current = await currentDreamRow(db, keeperPieceId);
  if (!current) throw new Error('current_dream_missing');
  let resultingDreamId = current.id;
  const statements = [];
  if (input.action === 'plant-new') {
    resultingDreamId = dreamId();
    statements.push(db.prepare(`
      UPDATE collector_dreams
         SET archived_at = ?1,
             public_revoked_at = CASE WHEN public_shared_at IS NOT NULL THEN ?1 ELSE public_revoked_at END,
             updated_at = ?1,
             record_version = record_version + 1
       WHERE id = ?2 AND archived_at IS NULL AND record_version = ?3
    `).bind(input.now, current.id, current.record_version));
    statements.push(db.prepare(`
      INSERT INTO collector_dreams
        (id, keeper_piece_id, author_user_id, body, scope, idempotency_key,
         created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
    `).bind(
      resultingDreamId, keeperPieceId, userId, plantBody, input.scope,
      idempotencyKey, input.now,
    ));
  } else if (input.action === 'fulfilled') {
    if (current.fulfilled_at) throw new Error('dream_already_fulfilled');
  }
  const newRitualId = ritualId();
  statements.push(db.prepare(`
    INSERT INTO collector_dream_rituals
      (id, keeper_piece_id, keeper_user_id, birthday_year, action,
       prior_dream_id, resulting_dream_id, idempotency_key, completed_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
  `).bind(
    newRitualId, keeperPieceId, userId, eligibility.birthdayYear, input.action,
    current.id, resultingDreamId, idempotencyKey, input.now,
  ));
  if (typeof db.batch !== 'function') throw new Error('atomic_batch_unavailable');
  try {
    await db.batch(statements);
  } catch (error) {
    const racedReplay = await db.prepare(`
      SELECT ritual.id, ritual.keeper_piece_id, ritual.keeper_user_id,
             ritual.birthday_year, ritual.action, ritual.prior_dream_id,
             ritual.resulting_dream_id, ritual.completed_at,
             resulting.body AS resulting_body, resulting.scope AS resulting_scope
        FROM collector_dream_rituals ritual
        JOIN collector_dreams resulting ON resulting.id = ritual.resulting_dream_id
       WHERE ritual.keeper_user_id = ?1 AND ritual.idempotency_key = ?2
    `).bind(userId, idempotencyKey).first();
    if (racedReplay) {
      if (racedReplay.keeper_piece_id !== keeperPieceId
        || racedReplay.action !== input.action
        || (input.action === 'plant-new'
          && (racedReplay.resulting_body !== plantBody
            || racedReplay.resulting_scope !== input.scope))) {
        throw new Error('idempotency_conflict');
      }
      return {
        ritual: ritualFromRow(racedReplay),
        state: await getCollectorDreamState(env, { userId, keeperPieceId }),
        eligibility: await getYearlyRitualEligibility(env, {
          userId, keeperPieceId, now: input.now,
        }),
      };
    }
    const completed = await db.prepare(`
      SELECT id FROM collector_dream_rituals
       WHERE keeper_piece_id = ?1 AND keeper_user_id = ?2 AND birthday_year = ?3
    `).bind(keeperPieceId, userId, eligibility.birthdayYear).first();
    if (completed) throw new Error('ritual_already_completed');
    throw error;
  }
  const stored = await db.prepare(`
    SELECT id, keeper_piece_id, keeper_user_id, birthday_year, action,
           prior_dream_id, resulting_dream_id, completed_at
      FROM collector_dream_rituals WHERE id = ?1
  `).bind(newRitualId).first();
  return {
    ritual: ritualFromRow(stored),
    state: await getCollectorDreamState(env, { userId, keeperPieceId }),
    eligibility: await getYearlyRitualEligibility(env, {
      userId, keeperPieceId, now: input.now,
    }),
  };
}

export {
  DREAM_SCOPES,
  DREAM_TIERS,
  DREAM_VISIBILITIES,
  MARKER_KINDS,
  PUBLIC_DREAM_VISIBILITIES,
  RITUAL_ACTIONS,
};
