import { COLLECTOR_UL_KINSHIP } from '../../../data/collectorKinship.ts';
import { TRUSTED_ATLAS_PLACES } from '../../../data/atlasPlaces.ts';

const LETTER_KINDS = new Set(['kin-claim', 'anniversary', 'transfer']);
const PINNED_CITIES = new Map(TRUSTED_ATLAS_PLACES.map((place) => [place.id, place]));

function requiredDatabase(env) {
  if (!env?.DB) throw new Error('db_not_configured');
  return env.DB;
}

function requiredId(value, code) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()
    || value.length > 128) throw new Error(code);
  return value;
}

function validIso(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function publicLetter(row) {
  return {
    id: row.id,
    kind: row.kind,
    body: row.body,
    createdAt: row.created_at,
  };
}

async function lettersForEvent(db, eventKey) {
  const result = await db.prepare(`
    SELECT id, kind, body, created_at
      FROM collector_letters
     WHERE event_key = ?1
     ORDER BY keeper_piece_id, id
  `).bind(eventKey).all();
  return (result?.results ?? []).map(publicLetter);
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function letterRecord({ keeperPieceId, kind, body, createdAt, eventKey }) {
  return {
    id: `letter-${await sha256Hex(`collector-letter-v1:${eventKey}:${keeperPieceId}`)}`,
    keeperPieceId,
    kind,
    body,
    createdAt,
    eventKey,
  };
}

async function storeLetters(db, eventKey, records) {
  if (records.length === 0) return [];
  if (typeof db.batch !== 'function') throw new Error('atomic_batch_unavailable');
  await db.batch(records.map((record) => db.prepare(`
    INSERT OR IGNORE INTO collector_letters
      (id, keeper_piece_id, kind, body, created_at, event_key)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6)
  `).bind(
    record.id, record.keeperPieceId, record.kind, record.body,
    record.createdAt, record.eventKey,
  )));
  return lettersForEvent(db, eventKey);
}

function sharedTrigram(a, b) {
  if (a.upper === b.upper || a.upper === b.lower) return a.upper;
  if (a.lower === b.upper || a.lower === b.lower) return a.lower;
  return null;
}

function pinnedCityLabel(cityId) {
  const place = PINNED_CITIES.get(cityId);
  if (!place) return null;
  return [place.city, place.region, place.country].filter(Boolean).join(', ');
}

function wholeYearsSince(claimIso, nowIso) {
  const claim = new Date(claimIso);
  const now = new Date(nowIso);
  if (!Number.isFinite(claim.getTime()) || !Number.isFinite(now.getTime())) return 0;
  let years = now.getUTCFullYear() - claim.getUTCFullYear();
  const month = now.getUTCMonth() - claim.getUTCMonth();
  if (month < 0 || (month === 0 && now.getUTCDate() < claim.getUTCDate())) years -= 1;
  return Math.max(0, years);
}

async function generateKinLetters(db, keeperPieceId, now) {
  const source = await db.prepare(`
    SELECT piece.id, piece.piece_id, ordinal.claim_ordinal,
           ordinal.first_bound_event_id, event.event_at
      FROM keeper_pieces AS piece
      JOIN collector_claim_ordinals AS ordinal ON ordinal.keeper_piece_id = piece.id
      JOIN artwork_lineage_events AS event ON event.id = ordinal.first_bound_event_id
     WHERE piece.id = ?1
       AND piece.keeper_user_id IS NOT NULL
       AND piece.claimed_at IS NOT NULL
       AND piece.plate_status NOT IN ('void', 'superseded')
  `).bind(keeperPieceId).first();
  if (!source) throw new Error('source_piece_not_active');
  const sourceKinship = COLLECTOR_UL_KINSHIP[source.piece_id];
  if (!sourceKinship) return [];
  const eventKey = `kin:${source.first_bound_event_id}`;
  const replay = await lettersForEvent(db, eventKey);
  if (replay.length > 0) return replay;

  const cityRow = await db.prepare(`
    SELECT privacy.city_id
      FROM keeper_pieces AS piece
      JOIN users AS account ON account.auth_user_id = piece.keeper_user_id
      JOIN profiles AS profile
        ON profile.user_id = account.id
       AND date(profile.birth_date) = profile.birth_date
       AND date(profile.birth_date, '+18 years') <= date(?2)
      JOIN collector_piece_privacy AS privacy
        ON privacy.keeper_piece_id = piece.id AND privacy.user_id = account.id
       AND privacy.share_city = 1
      JOIN collector_curated_cities AS city
        ON city.id = privacy.city_id AND city.active = 1 AND city.population >= 50000
     WHERE piece.id = ?1 AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
  `).bind(source.id, now).first();
  const city = pinnedCityLabel(cityRow?.city_id);
  if (!city || !Number.isSafeInteger(Number(source.claim_ordinal))
    || Number(source.claim_ordinal) < 1) return [];

  const recipientsResult = await db.prepare(`
    SELECT piece.id, piece.piece_id
      FROM keeper_pieces AS piece
      JOIN users AS account ON account.auth_user_id = piece.keeper_user_id
      JOIN collector_person_privacy AS privacy
        ON privacy.user_id = account.id AND privacy.share_derived_chart = 1
      JOIN profiles AS profile
        ON profile.user_id = account.id
       AND date(profile.birth_date) = profile.birth_date
       AND date(profile.birth_date, '+18 years') <= date(?1)
     WHERE piece.keeper_user_id IS NOT NULL
       AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
       AND piece.plate_status NOT IN ('void', 'superseded')
     ORDER BY piece.id
  `).bind(now).all();
  const records = [];
  for (const recipient of recipientsResult?.results ?? []) {
    if (recipient.id === source.id || recipient.piece_id === source.piece_id) continue;
    const recipientKinship = COLLECTOR_UL_KINSHIP[recipient.piece_id];
    if (!recipientKinship) continue;
    const trigram = sharedTrigram(sourceKinship, recipientKinship);
    if (!trigram) continue;
    const body = `Tonight a piece sharing my ${trigram} trigram came to light in ${city}. `
      + `It is Founding Light ${Number(source.claim_ordinal)}. `
      + 'We are kin across the same turning world.';
    records.push(await letterRecord({
      keeperPieceId: recipient.id,
      kind: 'kin-claim',
      body,
      createdAt: source.event_at,
      eventKey,
    }));
  }
  return storeLetters(db, eventKey, records);
}

async function currentPublicCity(db, keeperPieceId, now) {
  const row = await db.prepare(`
    SELECT privacy.city_id
      FROM keeper_pieces AS piece
      JOIN users AS account ON account.auth_user_id = piece.keeper_user_id
      JOIN profiles AS profile
        ON profile.user_id = account.id
       AND date(profile.birth_date) = profile.birth_date
       AND date(profile.birth_date, '+18 years') <= date(?2)
      JOIN collector_piece_privacy AS privacy
        ON privacy.keeper_piece_id = piece.id AND privacy.user_id = account.id
       AND privacy.share_city = 1
      JOIN collector_curated_cities AS city
        ON city.id = privacy.city_id AND city.active = 1 AND city.population >= 50000
     WHERE piece.id = ?1 AND piece.claimed_at IS NOT NULL
       AND piece.released_at IS NULL
  `).bind(keeperPieceId, now).first();
  return pinnedCityLabel(row?.city_id);
}

async function generateAnniversaryLetter(db, keeperPieceId, now) {
  const piece = await db.prepare(`
    SELECT id, claimed_at
      FROM keeper_pieces
     WHERE id = ?1 AND keeper_user_id IS NOT NULL AND claimed_at IS NOT NULL
       AND released_at IS NULL
       AND plate_status NOT IN ('void', 'superseded')
  `).bind(keeperPieceId).first();
  if (!piece) throw new Error('piece_not_active');
  const years = wholeYearsSince(piece.claimed_at, now);
  if (years < 1) return [];
  const eventKey = `anniversary:${piece.id}:${piece.claimed_at}:${years}`;
  const replay = await lettersForEvent(db, eventKey);
  if (replay.length > 0) return replay;
  const city = await currentPublicCity(db, piece.id, now);
  const duration = years === 1 ? 'one year' : `${years} years`;
  const where = city ? ` in ${city}` : '';
  const body = `It has been ${duration} since you began keeping me${where}. `
    + 'The record remains with the piece, carrying what time has made true.';
  const record = await letterRecord({
    keeperPieceId: piece.id,
    kind: 'anniversary',
    body,
    createdAt: now,
    eventKey,
  });
  return storeLetters(db, eventKey, [record]);
}

async function generateTransferLetter(db, transferIntentId) {
  const transfer = await db.prepare(`
    SELECT intent.id, intent.keeper_piece_id, receipt.committed_at
      FROM artwork_transfer_intents AS intent
      JOIN artwork_transfer_receipts AS receipt
        ON receipt.transfer_intent_id = intent.id
      JOIN artwork_lineage_events AS event
        ON event.id = intent.lineage_event_id
       AND event.keeper_piece_id = intent.keeper_piece_id
       AND event.event_type = 'transferred'
     WHERE intent.id = ?1
  `).bind(transferIntentId).first();
  if (!transfer) throw new Error('completed_transfer_missing');
  const eventKey = `transfer:${transfer.id}`;
  const replay = await lettersForEvent(db, eventKey);
  if (replay.length > 0) return replay;
  const body = 'I arrived with a history already begun. '
    + 'The record travels with me, and nothing true is left behind.';
  const record = await letterRecord({
    keeperPieceId: transfer.keeper_piece_id,
    kind: 'transfer',
    body,
    createdAt: transfer.committed_at,
    eventKey,
  });
  return storeLetters(db, eventKey, [record]);
}

async function letterCount(db) {
  const row = await db.prepare(
    'SELECT COUNT(*) AS count FROM collector_letters',
  ).first();
  return Number(row?.count ?? 0);
}

export async function syncFirstBindCollectorLetters(env, input) {
  try {
    const db = requiredDatabase(env);
    const now = input?.now;
    if (!validIso(now)) throw new Error('invalid_timestamp');
    const before = await letterCount(db);
    await generateKinLetters(
      db,
      requiredId(input?.keeperPieceId, 'invalid_keeper_piece_id'),
      now,
    );
    return { ok: true, created: Math.max(0, (await letterCount(db)) - before) };
  } catch {
    // A letter is derived, private prose. Canonical ownership has already
    // committed before this helper runs and must never be rolled back or
    // reported as failed because the derived record is unavailable.
    return { ok: false, created: 0 };
  }
}

export async function syncTransferCollectorLetters(env, input) {
  try {
    const db = requiredDatabase(env);
    const before = await letterCount(db);
    await generateTransferLetter(
      db,
      requiredId(input?.transferIntentId, 'invalid_transfer_intent_id'),
    );
    return { ok: true, created: Math.max(0, (await letterCount(db)) - before) };
  } catch {
    // See syncFirstBindCollectorLetters: transfer truth is the committed
    // intent, lineage event, receipt, and keeper mutation, never this prose.
    return { ok: false, created: 0 };
  }
}

export async function runCollectorLetterEvents(env, input) {
  const db = requiredDatabase(env);
  const now = input?.now;
  if (!validIso(now)) throw new Error('invalid_timestamp');
  const before = await letterCount(db);
  let failed = 0;

  const firstBinds = await db.prepare(`
    SELECT event.keeper_piece_id
      FROM artwork_lineage_events AS event
      JOIN collector_claim_ordinals AS ordinal
        ON ordinal.first_bound_event_id = event.id
       AND ordinal.keeper_piece_id = event.keeper_piece_id
     WHERE event.event_type = 'first_bound'
     ORDER BY event.sequence, event.id
  `).all();
  for (const row of firstBinds?.results ?? []) {
    const result = await syncFirstBindCollectorLetters(env, {
      keeperPieceId: row.keeper_piece_id,
      now,
    });
    if (!result.ok) failed += 1;
  }

  const transfers = await db.prepare(`
    SELECT intent.id
      FROM artwork_transfer_intents AS intent
      JOIN artwork_transfer_receipts AS receipt
        ON receipt.transfer_intent_id = intent.id
      JOIN artwork_lineage_events AS event
        ON event.id = intent.lineage_event_id
       AND event.keeper_piece_id = intent.keeper_piece_id
       AND event.event_type = 'transferred'
     ORDER BY receipt.committed_at, intent.id
  `).all();
  for (const row of transfers?.results ?? []) {
    const result = await syncTransferCollectorLetters(env, {
      transferIntentId: row.id,
    });
    if (!result.ok) failed += 1;
  }

  const anniversaries = await db.prepare(`
    SELECT id
      FROM keeper_pieces
     WHERE keeper_user_id IS NOT NULL
       AND claimed_at IS NOT NULL
       AND released_at IS NULL
       AND plate_status NOT IN ('void', 'superseded')
     ORDER BY id
  `).all();
  for (const row of anniversaries?.results ?? []) {
    try {
      await generateAnniversaryLetter(db, row.id, now);
    } catch {
      failed += 1;
    }
  }

  return {
    created: Math.max(0, (await letterCount(db)) - before),
    failed,
    checked: (firstBinds?.results?.length ?? 0)
      + (transfers?.results?.length ?? 0)
      + (anniversaries?.results?.length ?? 0),
  };
}

export async function getCollectorLetters(env, input) {
  const db = requiredDatabase(env);
  const userId = requiredId(input?.userId, 'invalid_user');
  const keeperPieceId = requiredId(input?.keeperPieceId, 'invalid_keeper_piece_id');
  const held = await db.prepare(`
    SELECT id FROM keeper_pieces
     WHERE id = ?1 AND keeper_user_id = ?2 AND claimed_at IS NOT NULL
       AND released_at IS NULL
       AND plate_status NOT IN ('void', 'superseded')
  `).bind(keeperPieceId, userId).first();
  if (!held) throw new Error('piece_not_held');
  const result = await db.prepare(`
    SELECT id, kind, body, created_at
      FROM collector_letters
     WHERE keeper_piece_id = ?1
     ORDER BY created_at DESC, id DESC
  `).bind(keeperPieceId).all();
  return (result?.results ?? []).map(publicLetter);
}

export async function generateCollectorLetters(env, input) {
  const db = requiredDatabase(env);
  if (!LETTER_KINDS.has(input?.kind)) throw new Error('invalid_letter_kind');
  if (!validIso(input?.now)) throw new Error('invalid_timestamp');
  if (input.kind === 'kin-claim') {
    return generateKinLetters(db, requiredId(
      input.keeperPieceId, 'invalid_keeper_piece_id',
    ), input.now);
  }
  if (input.kind === 'anniversary') {
    return generateAnniversaryLetter(db, requiredId(
      input.keeperPieceId, 'invalid_keeper_piece_id',
    ), input.now);
  }
  return generateTransferLetter(db, requiredId(
    input.transferIntentId, 'invalid_transfer_intent_id',
  ));
}
