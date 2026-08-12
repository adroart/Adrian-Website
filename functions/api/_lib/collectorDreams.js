const DREAM_SCOPES = new Set([
  'self', 'family', 'community', 'planet',
]);
const DREAM_VISIBILITIES = new Set(['private', 'anonymous', 'attributed']);
const PUBLIC_DREAM_VISIBILITIES = new Set(['anonymous', 'attributed']);
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

function dreamFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    keeperPieceId: row.keeper_piece_id,
    body: row.body,
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

async function currentDreamRow(db, keeperPieceId) {
  return db.prepare(`
    SELECT id, keeper_piece_id, author_user_id, body, scope, visibility, record_version,
           created_at, updated_at, public_shared_at, public_revoked_at,
           fulfilled_at, archived_at
      FROM collector_dreams
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
  await heldPiece(db, pieceId, holderId);
  const current = await currentDreamRow(db, pieceId);
  const historyResult = await db.prepare(`
    SELECT id, keeper_piece_id, author_user_id, body, scope, visibility, record_version,
           created_at, updated_at, public_shared_at, public_revoked_at,
           fulfilled_at, archived_at
      FROM collector_dreams
     WHERE keeper_piece_id = ?1 AND archived_at IS NOT NULL
     ORDER BY created_at, id
  `).bind(pieceId).all();
  let markers = [];
  if (current) {
    const markerResult = await db.prepare(`
      SELECT id, dream_id, marker_kind, body, created_at
        FROM collector_dream_markers
       WHERE dream_id = ?1 ORDER BY created_at, id
    `).bind(current.id).all();
    markers = (markerResult?.results ?? []).map(markerFromRow);
  }
  return {
    keeperPieceId: pieceId,
    current: dreamFromRow(current),
    history: (historyResult?.results ?? []).map(dreamFromRow),
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
  await heldPiece(db, keeperPieceId, userId);

  const replay = await db.prepare(`
    SELECT keeper_piece_id, body, scope FROM collector_dreams
     WHERE author_user_id = ?1 AND idempotency_key = ?2
  `).bind(userId, idempotencyKey).first();
  if (replay) {
    if (replay.keeper_piece_id !== keeperPieceId
      || replay.body !== body || replay.scope !== input.scope) {
      throw new Error('idempotency_conflict');
    }
    return getCollectorDreamState(env, { userId, keeperPieceId });
  }
  if (await currentDreamRow(db, keeperPieceId)) throw new Error('current_dream_exists');
  try {
    await db.prepare(`
      INSERT INTO collector_dreams
        (id, keeper_piece_id, author_user_id, body, scope, idempotency_key,
         created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
    `).bind(
      dreamId(), keeperPieceId, userId, body, input.scope, idempotencyKey, input.now,
    ).run();
  } catch (error) {
    const latestReplay = await db.prepare(`
      SELECT keeper_piece_id, body, scope FROM collector_dreams
       WHERE author_user_id = ?1 AND idempotency_key = ?2
    `).bind(userId, idempotencyKey).first();
    if (!latestReplay) {
      if (await currentDreamRow(db, keeperPieceId)) throw new Error('current_dream_exists');
      throw error;
    }
    if (latestReplay.keeper_piece_id !== keeperPieceId
      || latestReplay.body !== body || latestReplay.scope !== input.scope) {
      throw new Error('idempotency_conflict');
    }
  }
  return getCollectorDreamState(env, { userId, keeperPieceId });
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
  if (input.visibility !== 'private') await requireAdult(db, userId, input.now);
  if (input.visibility === 'attributed') await requireNameConsent(db, userId);
  if (input.visibility === 'private' && !current.public_shared_at) throw new Error('dream_not_shared');
  const nextVersion = Number(current.record_version) + 1;
  const newMutationId = mutationId();
  try {
    await db.prepare(`
      INSERT INTO collector_dream_mutations
        (id, dream_id, author_user_id, action, idempotency_key, request_json,
         resulting_version, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `).bind(
      newMutationId, current.id, userId, action, idempotencyKey, requestJson,
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
  const row = await db.prepare(`
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
       AND piece.keeper_user_id = dream.author_user_id
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND piece.plate_status NOT IN ('void', 'superseded')
       AND (dream.visibility = 'anonymous' OR privacy.share_name = 1)
  `).bind(pieceId).first();
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
  const user = await authorInternalUser(db, holderId);
  if (!user) throw new Error('user_not_synced');
  const profile = await db.prepare(
    'SELECT birth_date, tz_id FROM profiles WHERE user_id = ?1',
  ).bind(user.id).first();
  if (!profile) {
    return {
      eligible: false, reason: 'birth_profile_missing', birthdayYear: null,
      actions: [], currentDream: null,
    };
  }
  if (!validBirthParts(profile.birth_date) || !localDateParts(now, profile.tz_id)) {
    return {
      eligible: false, reason: 'birth_profile_invalid', birthdayYear: null,
      actions: [], currentDream: null,
    };
  }
  const current = await currentDreamRow(db, pieceId);
  if (!current) {
    return {
      eligible: false, reason: 'current_dream_missing', birthdayYear: null,
      actions: [], currentDream: null,
    };
  }
  const window = birthdayWindow(profile.birth_date, now, profile.tz_id);
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
  DREAM_VISIBILITIES,
  MARKER_KINDS,
  PUBLIC_DREAM_VISIBILITIES,
  RITUAL_ACTIONS,
};
