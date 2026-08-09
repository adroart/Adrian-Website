const PERSON_DEFAULTS = Object.freeze({
  shareDerivedChart: false,
  shareFace: false,
  shareName: false,
  shareIntention: false,
  shareBusiness: false,
  shareMission: false,
});
export const COLLECTOR_PRIVACY_POLICY_VERSION = 'collector-privacy-v1';

function requiredDatabase(env) {
  if (!env?.DB) throw new Error('db_not_configured');
  return env.DB;
}

function validPolicyVersion(value) {
  return value === COLLECTOR_PRIVACY_POLICY_VERSION;
}

function validIso(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function personFromRow(row) {
  if (!row) return { ...PERSON_DEFAULTS };
  return {
    shareDerivedChart: row.share_derived_chart === 1,
    shareFace: row.share_face === 1,
    shareName: row.share_name === 1,
    shareIntention: row.share_intention === 1,
    shareBusiness: row.share_business === 1,
    shareMission: row.share_mission === 1,
  };
}

function pieceFromRow(row) {
  const visible = row?.share_city === 1 && row?.city_eligible === 1;
  return visible
    ? { shareCity: true, cityId: row.city_id }
    : { shareCity: false, cityId: null };
}

function isExactBooleanRecord(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index])
    && keys.every((key) => typeof value[key] === 'boolean');
}

async function findUser(db, userId) {
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('invalid_user');
  const row = await db.prepare(
    'SELECT id FROM users WHERE auth_user_id = ?1',
  ).bind(userId).first();
  if (!row) throw new Error('user_not_synced');
  return row;
}

function consentId() {
  return `consent-${crypto.randomUUID().replaceAll('-', '')}`;
}

function establishedAdult(birthDate, at) {
  if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;
  const [year, month, day] = birthDate.split('-').map(Number);
  const calendarDate = new Date(0);
  calendarDate.setUTCHours(0, 0, 0, 0);
  calendarDate.setUTCFullYear(year, month - 1, day);
  if (calendarDate.getUTCFullYear() !== year
    || calendarDate.getUTCMonth() + 1 !== month
    || calendarDate.getUTCDate() !== day) return false;
  const moment = new Date(at);
  let age = moment.getUTCFullYear() - year;
  const currentMonth = moment.getUTCMonth() + 1;
  const currentDay = moment.getUTCDate();
  if (currentMonth < month || (currentMonth === month && currentDay < day)) age -= 1;
  return age >= 18;
}

export async function getCollectorPrivacy(env, { userId, keeperPieceId = null }) {
  const db = requiredDatabase(env);
  const user = await findUser(db, userId);
  const person = await db.prepare(`
    SELECT share_derived_chart, share_face, share_name, share_intention,
           share_business, share_mission, policy_version
      FROM collector_person_privacy
     WHERE user_id = ?1
  `).bind(user.id).first();
  let piece = null;
  if (keeperPieceId) {
    piece = await db.prepare(`
      SELECT privacy.share_city, privacy.city_id, privacy.policy_version,
             CASE WHEN city.active = 1 AND city.population >= 50000
                  THEN 1 ELSE 0 END AS city_eligible
        FROM collector_piece_privacy AS privacy
        LEFT JOIN collector_curated_cities AS city ON city.id = privacy.city_id
       WHERE privacy.keeper_piece_id = ?1 AND privacy.user_id = ?2
    `).bind(keeperPieceId, user.id).first();
  }
  return {
    ring1: { privateRecord: true },
    ring2: pieceFromRow(piece),
    ring3: { shareDerivedChart: person?.share_derived_chart === 1 },
    ring4: {
      shareFace: person?.share_face === 1,
      shareName: person?.share_name === 1,
      shareIntention: person?.share_intention === 1,
      shareBusiness: person?.share_business === 1,
      shareMission: person?.share_mission === 1,
    },
    policyVersion: person?.policy_version ?? piece?.policy_version ?? null,
  };
}

export async function listCollectorCuratedCities(env) {
  const db = requiredDatabase(env);
  const result = await db.prepare(`
    SELECT id, label FROM collector_curated_cities
     WHERE active = 1 AND population >= 50000
     ORDER BY label COLLATE NOCASE, id
  `).all();
  return (result?.results ?? []).map((row) => ({ id: row.id, label: row.label }));
}

export async function updateCollectorPrivacy(env, input) {
  const db = requiredDatabase(env);
  if (Object.hasOwn(input ?? {}, 'ring1')) throw new Error('ring1_invariant');
  if (!validPolicyVersion(input?.policyVersion)) throw new Error('invalid_policy_version');
  if (!validIso(input?.changedAt)) throw new Error('invalid_changed_at');
  if (!input?.person && !input?.piece) throw new Error('no_privacy_change');
  const user = await findUser(db, input.userId);
  const statements = [];
  const openingPerson = Boolean(input.person && Object.values(input.person).some(Boolean));
  const openingCity = input.piece?.shareCity === true;
  if (openingPerson || openingCity) {
    const profile = await db.prepare(
      'SELECT birth_date FROM profiles WHERE user_id = ?1',
    ).bind(user.id).first();
    if (!profile) throw new Error('adult_status_required');
    if (!establishedAdult(profile.birth_date, input.changedAt)) {
      throw new Error('minor_publicity_forbidden');
    }
  }

  if (input.person) {
    const personKeys = Object.keys(PERSON_DEFAULTS);
    if (!isExactBooleanRecord(input.person, personKeys)) throw new Error('invalid_person_choices');
    const currentRow = await db.prepare(`
      SELECT share_derived_chart, share_face, share_name, share_intention,
             share_business, share_mission
        FROM collector_person_privacy
       WHERE user_id = ?1
    `).bind(user.id).first();
    const before = personFromRow(currentRow);
    const after = { ...input.person };
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      statements.push(db.prepare(`
        INSERT INTO collector_person_privacy
          (user_id, share_derived_chart, share_face, share_name, share_intention,
           share_business, share_mission, policy_version, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT(user_id) DO UPDATE SET
          share_derived_chart = excluded.share_derived_chart,
          share_face = excluded.share_face,
          share_name = excluded.share_name,
          share_intention = excluded.share_intention,
          share_business = excluded.share_business,
          share_mission = excluded.share_mission,
          policy_version = excluded.policy_version,
          updated_at = excluded.updated_at
      `).bind(
        user.id,
        after.shareDerivedChart ? 1 : 0,
        after.shareFace ? 1 : 0,
        after.shareName ? 1 : 0,
        after.shareIntention ? 1 : 0,
        after.shareBusiness ? 1 : 0,
        after.shareMission ? 1 : 0,
        input.policyVersion,
        input.changedAt,
      ));
      statements.push(db.prepare(`
        INSERT INTO collector_consent_history
          (id, user_id, scope, target_ref, before_json, after_json,
           policy_version, changed_at)
        VALUES (?1, ?2, 'person', 'person', ?3, ?4, ?5, ?6)
      `).bind(
        consentId(), user.id, JSON.stringify(before), JSON.stringify(after),
        input.policyVersion, input.changedAt,
      ));
    }
  }

  if (input.piece) {
    if (!isExactBooleanRecord({ shareCity: input.piece.shareCity }, ['shareCity'])
      || typeof input.piece.keeperPieceId !== 'string'
      || !input.piece.keeperPieceId.trim()
      || (input.piece.shareCity && typeof input.piece.cityId !== 'string')
      || (!input.piece.shareCity && input.piece.cityId !== null)) {
      throw new Error('invalid_piece_choices');
    }
    const held = await db.prepare(`
      SELECT id FROM keeper_pieces
       WHERE id = ?1 AND keeper_user_id = ?2
    `).bind(input.piece.keeperPieceId, input.userId).first();
    if (!held) throw new Error('piece_not_held');
    if (input.piece.shareCity) {
      const city = await db.prepare(`
        SELECT id FROM collector_curated_cities
         WHERE id = ?1 AND active = 1 AND population >= 50000
      `).bind(input.piece.cityId).first();
      if (!city) throw new Error('city_not_curated');
    }
    const currentRow = await db.prepare(`
      SELECT privacy.share_city, privacy.city_id,
             CASE WHEN city.active = 1 AND city.population >= 50000
                  THEN 1 ELSE 0 END AS city_eligible
        FROM collector_piece_privacy AS privacy
        LEFT JOIN collector_curated_cities AS city ON city.id = privacy.city_id
       WHERE privacy.keeper_piece_id = ?1 AND privacy.user_id = ?2
    `).bind(input.piece.keeperPieceId, user.id).first();
    const before = pieceFromRow(currentRow);
    const after = {
      shareCity: input.piece.shareCity,
      cityId: input.piece.shareCity ? input.piece.cityId : null,
    };
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      statements.push(db.prepare(`
        INSERT INTO collector_piece_privacy
          (keeper_piece_id, user_id, share_city, city_id, policy_version, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6)
        ON CONFLICT(keeper_piece_id) DO UPDATE SET
          user_id = excluded.user_id,
          share_city = excluded.share_city,
          city_id = excluded.city_id,
          policy_version = excluded.policy_version,
          updated_at = excluded.updated_at
      `).bind(
        input.piece.keeperPieceId, user.id, after.shareCity ? 1 : 0, after.cityId,
        input.policyVersion, input.changedAt,
      ));
      statements.push(db.prepare(`
        INSERT INTO collector_consent_history
          (id, user_id, scope, target_ref, before_json, after_json,
           policy_version, changed_at)
        VALUES (?1, ?2, 'piece', ?3, ?4, ?5, ?6, ?7)
      `).bind(
        consentId(), user.id, input.piece.keeperPieceId, JSON.stringify(before),
        JSON.stringify(after), input.policyVersion, input.changedAt,
      ));
    }
  }

  if (statements.length > 0) {
    if (typeof db.batch !== 'function') throw new Error('atomic_batch_unavailable');
    await db.batch(statements);
  }
  return getCollectorPrivacy(env, {
    userId: input.userId,
    keeperPieceId: input.piece?.keeperPieceId ?? null,
  });
}

export function projectPublicCollectorVisibility({ privacy, content }) {
  if (!privacy || !content || content.subjectIsAdult !== true) return {};
  const projected = {};
  if (privacy.ring2?.shareCity === true
    && typeof privacy.ring2.cityId === 'string'
    && /^[a-z0-9-]{2,120}$/.test(privacy.ring2.cityId)) {
    projected.cityId = privacy.ring2.cityId;
  }
  if (privacy.ring3?.shareDerivedChart === true && content.derivedChart != null) {
    const chart = {};
    const positions = [
      'lifesWork', 'evolution', 'radiance', 'purpose', 'attraction', 'iq',
      'eq', 'sq', 'core', 'culture', 'pearl',
    ];
    for (const position of positions) {
      const value = content.derivedChart?.[position];
      if (Number.isSafeInteger(value?.gate)
        && value.gate >= 1
        && value.gate <= 64
        && Number.isSafeInteger(value?.line)
        && value.line >= 1
        && value.line <= 6) {
        chart[position] = { gate: value.gate, line: value.line };
      }
    }
    if (Object.keys(chart).length > 0) projected.derivedChart = chart;
  }
  const fields = [
    ['shareFace', 'face'],
    ['shareName', 'name'],
    ['shareIntention', 'intention'],
    ['shareBusiness', 'business'],
    ['shareMission', 'mission'],
  ];
  for (const [choice, field] of fields) {
    if (privacy.ring4?.[choice] === true
      && typeof content[field] === 'string'
      && content[field].trim().length >= 1
      && content[field].length <= 5000) {
      projected[field] = content[field];
    }
  }
  return projected;
}
