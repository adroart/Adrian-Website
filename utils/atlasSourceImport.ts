import { TRUSTED_ATLAS_PLACES } from '../data/atlasPlaces.ts';

export const ATLAS_SOURCE_MOVE_DATE = '2026-08-09' as const;

const HASH = /^[a-f0-9]{64}$/;
const PIECE_ID = /^[A-Z]{2,3}-[0-9]{3}$/;
const EVENT_TYPES = new Set([
  'created', 'placed', 'moved', 'withdrawn', 'revealed', 'retired',
  'claimed', 'inscribed', 'transferred',
]);
const ACTORS = new Set(['admin', 'steward', 'heir']);
const ALLOWED_EVENT_KEYS = new Set([
  'id', 'pieceId', 'editionNumber', 'type', 'date', 'cityId', 'actor',
  'actorRef', 'inscriptionId', 'contentHash', 'inscriptionKind', 'fromRef',
  'toRef', 'transferKind', 'pieceType', 'series', 'category', 'prevHash', 'hash',
]);
const EVENT_DETAIL_KEYS = [
  'cityId', 'inscriptionId', 'contentHash', 'inscriptionKind', 'fromRef', 'toRef',
  'transferKind', 'pieceType', 'series', 'category',
] as const;
const EVENT_DETAILS_BY_TYPE: Record<AtlasSourceEvent['type'], ReadonlySet<string>> = {
  created: new Set(['cityId', 'pieceType', 'series', 'category']),
  placed: new Set(['cityId']),
  moved: new Set(['cityId']),
  withdrawn: new Set(),
  revealed: new Set(),
  retired: new Set(),
  claimed: new Set(),
  inscribed: new Set(['inscriptionId', 'contentHash', 'inscriptionKind']),
  transferred: new Set(['fromRef', 'toRef', 'transferKind']),
};

export type AtlasSourceEvent = {
  id: string;
  pieceId: string;
  editionNumber?: number;
  type: 'created' | 'placed' | 'moved' | 'withdrawn' | 'revealed' | 'retired'
    | 'claimed' | 'inscribed' | 'transferred';
  date: string;
  cityId?: string | null;
  note?: string;
  actor: 'admin' | 'steward' | 'heir';
  actorRef?: string;
  inscriptionId?: string;
  contentHash?: string;
  inscriptionKind?: 'intention' | 'story' | 'dedication';
  fromRef?: string;
  toRef?: string;
  transferKind?: 'sale' | 'gift' | 'inheritance' | 'artist-rebind';
  pieceType?: 'mandala' | 'other';
  series?: string;
  category?: string;
  prevHash: string | null;
  hash: string;
};

export type AtlasSourceCity = {
  id: string;
  city: string;
  region?: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
};

export type AtlasSourceImport = {
  events: AtlasSourceEvent[];
  cities: AtlasSourceCity[];
  sourceReference: string;
};

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== undefined) result[key] = sortKeys(child);
  }
  return result;
}

export function canonicalizeAtlasSourceEvent(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export async function computeAtlasSourceEventHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizeAtlasSourceEvent(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fail(code: string): never {
  throw new Error(code);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) && new Date(epoch).toISOString() === value;
}

function boundedString(value: unknown, maximum = 300): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum;
}

function hasOpaqueEntropy(value: string, minimumUniqueCharacters: number): boolean {
  return /[A-Za-z]/.test(value) && /[0-9]/.test(value)
    && new Set(value).size >= minimumUniqueCharacters;
}

function isAuthIdentifier(value: unknown): value is string {
  if (!boundedString(value, 160)) return false;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return true;
  }
  if (value.startsWith('user_')) {
    const suffix = value.slice('user_'.length);
    return /^[A-Za-z0-9]{20,64}$/.test(suffix) && hasOpaqueEntropy(suffix, 8);
  }
  return /^[A-Za-z0-9_-]{24,64}$/.test(value) && hasOpaqueEntropy(value, 10);
}

function isSourceEventId(value: unknown): value is string {
  if (!boundedString(value, 160)) return false;
  if (/^evt-[0-9a-z]{8,12}-[a-f0-9]{20}$/.test(value)) return true;
  return /^(?:seed|genesis)-[A-Z]{2,3}-[0-9]{3}-[0-9]{13}$/.test(value);
}

function isInscriptionId(value: unknown): value is string {
  if (!boundedString(value, 300)) return false;
  if (/^ins-[0-9a-z]{8,12}-[a-f0-9]{20}$/.test(value)) return true;
  const deterministic = /^ins-first-([A-Z]{2,3}-[0-9]{3})-([0-9]{1,4})-(.+)$/.exec(value);
  return Boolean(deterministic && isAuthIdentifier(deterministic[3]));
}

function validateSourceReference(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length > 2048) fail('source_reference_invalid');
  try {
    const url = new URL(value);
    const approvedPortal = (url.hostname === 'mandalacodes.com'
      || url.hostname === 'www.mandalacodes.com') && url.pathname === '/api/atlas';
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || url.search || url.hash || !approvedPortal) {
      fail('source_reference_invalid');
    }
  } catch {
    fail('source_reference_invalid');
  }
}

function validateCity(value: unknown): asserts value is AtlasSourceCity {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('source_city_malformed');
  const city = value as Record<string, unknown>;
  const expected = new Set(['id', 'city', 'region', 'country', 'countryCode', 'lat', 'lng']);
  if (Object.keys(city).some((key) => !expected.has(key))) fail('source_city_malformed');
  if (!boundedString(city.id, 120) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(city.id)
    || !boundedString(city.city) || !boundedString(city.country)
    || (city.region !== undefined && !boundedString(city.region))
    || typeof city.countryCode !== 'string' || !/^[A-Z]{2}$/.test(city.countryCode)
    || typeof city.lat !== 'number' || !Number.isFinite(city.lat) || city.lat < -90 || city.lat > 90
    || typeof city.lng !== 'number' || !Number.isFinite(city.lng) || city.lng < -180 || city.lng > 180) {
    fail('source_city_malformed');
  }
}

const TRUSTED_CITY_BY_ID = new Map(TRUSTED_ATLAS_PLACES.map((city) => [city.id, city]));

function validateTrustedCity(city: AtlasSourceCity) {
  const trusted = TRUSTED_CITY_BY_ID.get(city.id);
  if (!trusted
    || canonicalizeAtlasSourceEvent(city) !== canonicalizeAtlasSourceEvent(trusted)) {
    fail('source_city_untrusted');
  }
}

function validateEventShape(value: unknown): asserts value is AtlasSourceEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('source_event_malformed');
  const event = value as Record<string, unknown>;
  if (Object.keys(event).some((key) => !ALLOWED_EVENT_KEYS.has(key))) {
    fail('source_event_private_or_unknown_field');
  }
  if (!isSourceEventId(event.id)
    || !PIECE_ID.test(String(event.pieceId || ''))
    || typeof event.type !== 'string' || !EVENT_TYPES.has(event.type) || !isIsoDate(event.date)
    || typeof event.actor !== 'string' || !ACTORS.has(event.actor) || !HASH.test(String(event.hash || ''))
    || !(event.prevHash === null || HASH.test(String(event.prevHash)))) {
    fail('source_event_malformed');
  }
  if (event.editionNumber !== undefined
    && (!Number.isSafeInteger(event.editionNumber) || Number(event.editionNumber) < 0
      || Number(event.editionNumber) > 9999)) fail('source_event_malformed');
  for (const key of EVENT_DETAIL_KEYS) {
    const child = event[key];
    if (child !== undefined && child !== null && !boundedString(child, 300)) {
      fail('source_event_malformed');
    }
  }
  if (event.actorRef !== undefined && !isAuthIdentifier(event.actorRef)) {
    fail('source_event_ref_invalid');
  }
  const allowedDetails = EVENT_DETAILS_BY_TYPE[event.type];
  if (EVENT_DETAIL_KEYS.some((key) => event[key] !== undefined && !allowedDetails.has(key))) {
    fail('source_event_semantics_invalid');
  }
  if ((event.type === 'placed' || event.type === 'moved') && !boundedString(event.cityId, 120)) {
    fail('source_event_semantics_invalid');
  }
  if (event.type === 'transferred') {
    if (!isAuthIdentifier(event.fromRef) || !isAuthIdentifier(event.toRef)
      || !['sale', 'gift', 'inheritance', 'artist-rebind'].includes(String(event.transferKind))) {
      fail('source_event_semantics_invalid');
    }
  }
  if (event.type === 'inscribed') {
    if (!isInscriptionId(event.inscriptionId) || !HASH.test(String(event.contentHash || ''))
      || !['intention', 'story', 'dedication'].includes(String(event.inscriptionKind))) {
      fail('source_event_semantics_invalid');
    }
  }
}

export type VerifiedAtlasSourceChain = {
  pieceId: string;
  editionNumber: number;
  events: AtlasSourceEvent[];
  headHash: string;
};

export async function verifyAtlasSourceChains(
  sourceEvents: AtlasSourceEvent[],
  sourceCities: AtlasSourceCity[],
): Promise<{ chains: VerifiedAtlasSourceChain[]; cities: AtlasSourceCity[] }> {
  if (!Array.isArray(sourceEvents) || sourceEvents.length === 0) fail('source_export_empty');
  if (!Array.isArray(sourceCities)) fail('source_city_malformed');
  const cities = [...sourceCities];
  cities.forEach(validateCity);
  cities.forEach(validateTrustedCity);
  cities.sort((a, b) => a.id.localeCompare(b.id));
  if (cities.some((city, index) => index > 0 && city.id === cities[index - 1].id)) {
    fail('source_city_duplicate');
  }
  const cityIds = new Set(cities.map((city) => city.id));

  const groups = new Map<string, AtlasSourceEvent[]>();
  const eventIds = new Set<string>();
  for (const rawEvent of sourceEvents) {
    validateEventShape(rawEvent);
    if (eventIds.has(rawEvent.id)) fail('source_event_duplicate');
    eventIds.add(rawEvent.id);
    if (rawEvent.cityId && !cityIds.has(rawEvent.cityId)) fail('source_city_missing');
    const { hash, ...payload } = rawEvent;
    if (await computeAtlasSourceEventHash(payload) !== hash) fail('source_event_hash_mismatch');
    const editionNumber = rawEvent.editionNumber ?? 0;
    const key = `${rawEvent.pieceId}:${editionNumber}`;
    const group = groups.get(key) || [];
    group.push(rawEvent);
    groups.set(key, group);
  }

  const chains: VerifiedAtlasSourceChain[] = [];
  for (const events of groups.values()) {
    const genesis = events.filter((event) => event.prevHash === null);
    if (genesis.length !== 1 || genesis[0].type !== 'created') fail('source_chain_genesis_invalid');
    const byPrevious = new Map<string, AtlasSourceEvent>();
    for (const event of events) {
      if (event.prevHash === null) continue;
      if (byPrevious.has(event.prevHash)) fail('source_chain_fork');
      byPrevious.set(event.prevHash, event);
    }
    const ordered = [genesis[0]];
    while (ordered.length < events.length) {
      const next = byPrevious.get(ordered[ordered.length - 1].hash);
      if (!next) fail('source_chain_link_mismatch');
      if (Date.parse(next.date) < Date.parse(ordered[ordered.length - 1].date)) {
        fail('source_chain_date_order');
      }
      if (next.type === 'created') fail('source_chain_genesis_invalid');
      if (next.pieceId !== genesis[0].pieceId
        || (next.editionNumber ?? 0) !== (genesis[0].editionNumber ?? 0)) {
        fail('source_chain_identity_mismatch');
      }
      ordered.push(next);
    }
    const linkedHashes = new Set(ordered.map((event) => event.hash));
    if (linkedHashes.size !== events.length) fail('source_chain_link_mismatch');
    chains.push({
      pieceId: genesis[0].pieceId,
      editionNumber: genesis[0].editionNumber ?? 0,
      events: ordered,
      headHash: ordered[ordered.length - 1].hash,
    });
  }
  chains.sort((a, b) => a.pieceId.localeCompare(b.pieceId)
    || a.editionNumber - b.editionNumber);
  return { chains, cities };
}

async function verifyImport(input: AtlasSourceImport): Promise<{
  chains: VerifiedAtlasSourceChain[];
  cities: AtlasSourceCity[];
  sourceReference: string;
}> {
  validateSourceReference(input?.sourceReference);
  const verified = await verifyAtlasSourceChains(input?.events, input?.cities);
  return { ...verified, sourceReference: input.sourceReference };
}

function sql(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Verify an authoritative Mandala Atlas export and emit a deterministic,
 * transactional SQL artifact. This function never connects to D1 and never
 * applies production mutations.
 */
export async function buildAtlasSourceImportSql(input: AtlasSourceImport): Promise<string> {
  const verified = await verifyImport(input);
  const statements = [
    '-- Verified Mandala Atlas source-chain import.',
    '-- Generated offline. Review and apply through the normal D1 migration process.',
    'PRAGMA foreign_keys = ON;',
    'CREATE TEMP TABLE __atlas_source_import_guard (ok INTEGER NOT NULL);',
    `CREATE TEMP TRIGGER __atlas_source_import_require_match
      BEFORE INSERT ON __atlas_source_import_guard WHEN NEW.ok <> 1 BEGIN
      SELECT RAISE(ROLLBACK, 'atlas_source_import_collision'); END;`,
    'BEGIN IMMEDIATE;',
  ];

  const assertMatch = (condition: string) => {
    statements.push(`INSERT INTO __atlas_source_import_guard (ok)
      SELECT CASE WHEN ${condition} THEN 1 ELSE 0 END;`);
  };

  for (const city of verified.cities) {
    const existing = `id = ${sql(city.id)}`;
    const exact = `${existing} AND city = ${sql(city.city)} AND region IS ${sql(city.region)} `
      + `AND country = ${sql(city.country)} AND country_code = ${sql(city.countryCode)} `
      + `AND lat = ${sql(city.lat)} AND lng = ${sql(city.lng)}`;
    assertMatch(`NOT EXISTS (SELECT 1 FROM atlas_source_cities WHERE ${existing}) `
      + `OR EXISTS (SELECT 1 FROM atlas_source_cities WHERE ${exact})`);
    statements.push(
      `INSERT INTO atlas_source_cities (id, city, region, country, country_code, lat, lng) SELECT `
      + `${sql(city.id)}, ${sql(city.city)}, ${sql(city.region)}, ${sql(city.country)}, `
      + `${sql(city.countryCode)}, ${sql(city.lat)}, ${sql(city.lng)} WHERE NOT EXISTS (`
      + `SELECT 1 FROM atlas_source_cities WHERE ${existing});`,
    );
  }

  for (const chain of verified.chains) {
    const keeperPieceId = `kp-atlas-${chain.headHash.slice(0, 24)}`;
    const sourceChainId = `atlas-source-${chain.headHash}`;
    const currentKeeper = `piece_id = ${sql(chain.pieceId)} AND edition_number = ${chain.editionNumber} `
      + `AND plate_status NOT IN ('void', 'superseded')`;
    assertMatch(`(SELECT COUNT(*) FROM keeper_pieces WHERE ${currentKeeper}) <= 1`);
    assertMatch(`NOT EXISTS (SELECT 1 FROM keeper_pieces WHERE ${currentKeeper}) OR EXISTS (`
      + `SELECT 1 FROM keeper_pieces WHERE ${currentKeeper} AND plate_status = 'legacy' `
      + `AND keeper_user_id IS NULL AND claimed_at IS NULL `
      + `AND public_code IS NULL AND issuance_key IS NULL `
      + `AND plate_generated_at IS NULL AND plate_activated_at IS NULL `
      + `AND front_svg_sha256 IS NULL AND back_svg_sha256 IS NULL `
      + `AND backup_status IS NULL AND backup_reference IS NULL AND backup_at IS NULL `
      + `AND backup_sha256 IS NULL `
      + `AND ownership_code_ciphertext IS NULL AND ownership_code_nonce IS NULL `
      + `AND ownership_code_key_version IS NULL)`);
    statements.push(
      `INSERT INTO keeper_pieces (id, piece_id, edition_number, recovery_code_hash, `
      + `registered_at, plate_status) SELECT ${sql(keeperPieceId)}, ${sql(chain.pieceId)}, `
      + `${chain.editionNumber}, ${sql(`disabled-atlas:${chain.headHash}`)}, `
      + `${sql(`${ATLAS_SOURCE_MOVE_DATE}T00:00:00.000Z`)}, 'legacy' WHERE NOT EXISTS (`
      + `SELECT 1 FROM keeper_pieces WHERE ${currentKeeper});`,
    );
    const keeperId = `(SELECT id FROM keeper_pieces WHERE ${currentKeeper} ORDER BY id ASC LIMIT 1)`;
    const chainCollision = `id = ${sql(sourceChainId)} OR keeper_piece_id = ${keeperId} `
      + `OR source_head_hash = ${sql(chain.headHash)}`;
    const exactChain = `id = ${sql(sourceChainId)} AND keeper_piece_id = ${keeperId} `
      + `AND source_system = 'mandalacodes-atlas' `
      + `AND source_reference = ${sql(verified.sourceReference)} `
      + `AND moved_on = ${sql(ATLAS_SOURCE_MOVE_DATE)} `
      + `AND source_event_count = ${chain.events.length} `
      + `AND source_head_hash = ${sql(chain.headHash)}`;
    assertMatch(`NOT EXISTS (SELECT 1 FROM atlas_source_chains WHERE ${chainCollision}) `
      + `OR EXISTS (SELECT 1 FROM atlas_source_chains WHERE ${exactChain})`);
    statements.push(
      `INSERT INTO atlas_source_chains (id, keeper_piece_id, source_system, source_reference, `
      + `moved_on, source_event_count, source_head_hash) SELECT ${sql(sourceChainId)}, ${keeperId}, `
      + `'mandalacodes-atlas', ${sql(verified.sourceReference)}, ${sql(ATLAS_SOURCE_MOVE_DATE)}, `
      + `${chain.events.length}, ${sql(chain.headHash)} WHERE NOT EXISTS (`
      + `SELECT 1 FROM atlas_source_chains WHERE id = ${sql(sourceChainId)});`,
    );
    chain.events.forEach((event, index) => {
      const eventId = `atlas-source-event-${event.hash}`;
      const eventJson = canonicalizeAtlasSourceEvent(event);
      const eventCollision = `id = ${sql(eventId)} OR source_event_id = ${sql(event.id)} `
        + `OR source_event_hash = ${sql(event.hash)} `
        + `OR (source_chain_id = ${sql(sourceChainId)} AND source_sequence = ${index + 1}) `
        + `OR (source_chain_id = ${sql(sourceChainId)} AND source_previous_hash IS ${sql(event.prevHash)})`;
      const exactEvent = `id = ${sql(eventId)} AND source_chain_id = ${sql(sourceChainId)} `
        + `AND source_sequence = ${index + 1} AND source_event_id = ${sql(event.id)} `
        + `AND source_event_type = ${sql(event.type)} AND source_event_at = ${sql(event.date)} `
        + `AND source_previous_hash IS ${sql(event.prevHash)} `
        + `AND source_event_hash = ${sql(event.hash)} AND source_event_json = ${sql(eventJson)}`;
      assertMatch(`NOT EXISTS (SELECT 1 FROM atlas_source_chain_events WHERE ${eventCollision}) `
        + `OR EXISTS (SELECT 1 FROM atlas_source_chain_events WHERE ${exactEvent})`);
      statements.push(
        `INSERT INTO atlas_source_chain_events (id, source_chain_id, source_sequence, `
        + `source_event_id, source_event_type, source_event_at, source_previous_hash, `
        + `source_event_hash, source_event_json) SELECT `
        + `${sql(eventId)}, ${sql(sourceChainId)}, ${index + 1}, `
        + `${sql(event.id)}, ${sql(event.type)}, ${sql(event.date)}, ${sql(event.prevHash)}, `
        + `${sql(event.hash)}, ${sql(eventJson)} WHERE NOT EXISTS (`
        + `SELECT 1 FROM atlas_source_chain_events WHERE id = ${sql(eventId)});`,
      );
    });
  }
  statements.push('COMMIT;');
  statements.push('DROP TRIGGER __atlas_source_import_require_match;');
  statements.push('DROP TABLE __atlas_source_import_guard;');
  return `${statements.join('\n')}\n`;
}
