/**
 * Piece Record generator (docs/piece-record-format.md).
 *
 * One self-contained HTML file per piece, written to outlive the website:
 * inline CSS, no external requests, readable with JavaScript disabled, the
 * canonical record data embedded as JSON and sealed by a printed SHA-256.
 *
 * Canonicalization and hashing mirror functions/api/_lib/lineage.js exactly:
 * the sorted-keys `stable` shape serialized by JSON.stringify with no added
 * whitespace, hashed with Web Crypto SHA-256 to lowercase hex. The "how to
 * verify" prose printed in every record describes precisely that procedure.
 *
 * Privacy is fail-closed. After assembly the entire canonical object is
 * walked; any forbidden key or string aborts generation (see
 * assertRecordPublic below and the spec's "What the record may never
 * contain"). Nothing partial is ever written.
 *
 * Deterministic: identical input data produces byte-identical output. The
 * only timestamp is the caller-supplied generatedAt; there is no Date.now()
 * and no randomness anywhere in generation.
 */

import { buildLineageEvent } from './lineage.js';
import { resolveArtworkCertificate } from './certificateContent.js';
import { latestCatalogSnapshot } from './catalogSnapshot.js';

export const PIECE_RECORD_SCHEMA = 'adrian-piece-record';
export const PIECE_RECORD_SCHEMA_VERSION = 1;
export const PIECE_RECORD_TRIGGERS = new Set([
  'registration', 'activation', 'bind', 'transfer', 'yearly',
  'contribution', 'attachment', 'on_demand',
]);
export const PIECE_RECORD_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

const PUBLIC_CODE_PATTERN = /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
const LINEAGE_SERVING_STATUSES = new Set(['active', 'superseded']);

function codedError(code) {
  return Object.assign(new Error(code), { code });
}

function isMissingTableError(error) {
  return error instanceof Error && /no such table/i.test(error.message);
}

/* ── Canonicalization + hashing (byte-compatible with lineage.js) ───── */

/** Sorted-keys canonical shape, exactly lineage.js stable(). */
export function stableRecordShape(value) {
  if (Array.isArray(value)) return value.map(stableRecordShape);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableRecordShape(value[key])]),
    );
  }
  return value;
}

export function canonicalRecordJson(record) {
  return JSON.stringify(stableRecordShape(record));
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/* ── The strip-pass (the privacy core) ──────────────────────────────── */

// The lineage privacy pattern (lineage.js PRIVATE_KEY) names these tokens:
// email|ip|user-agent|ownership|recovery|verifier|cipher|nonce|secret|
// password|token|key. lineage.js applies it to object keys; the record does
// the same, matching on the words inside each key (so "description" is not
// condemned for containing "ip") and extends the set with the record-specific
// prohibitions: birth details, prices and amounts, cities and locations.
const FORBIDDEN_KEY_WORDS = new Set([
  'email', 'emails', 'ip', 'ips', 'useragent', 'agent', 'ownership', 'owner',
  'owners', 'recovery', 'verifier', 'cipher', 'ciphertext', 'nonce', 'secret',
  'secrets', 'password', 'passwords', 'token', 'tokens', 'key', 'keys',
  'birth', 'birthday', 'birthdate', 'price', 'prices', 'amount', 'amounts',
  'currency', 'city', 'cities', 'location', 'locations', 'address',
  'addresses',
]);

// String values may never carry an email address, an internal identifier
// (kp-/tp-/dream-/consent-/auth- prefixed), or an IP-address shape.
const FORBIDDEN_STRING_PATTERNS = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /\b(?:kp|tp|dream|consent|auth)-/i,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
];

function keyWords(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function keyForbidden(key) {
  if (/user.?agent/i.test(String(key))) return true;
  return keyWords(key).some((word) => FORBIDDEN_KEY_WORDS.has(word));
}

function stringForbidden(value) {
  return FORBIDDEN_STRING_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Walk the entire assembled record and throw on any forbidden key or string,
 * at any depth. Fail closed: a violation aborts generation.
 */
export function assertRecordPublic(value, path = 'record') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertRecordPublic(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (keyForbidden(key)) {
        throw codedError(`private_piece_record_key:${path}.${key}`);
      }
      assertRecordPublic(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === 'string' && stringForbidden(value)) {
    throw codedError(`private_piece_record_value:${path}`);
  }
}

/**
 * Project a verified public lineage payload for the permanent record.
 * Transfer party references (tp- pseudonyms) belong to the living site's
 * lineage API, not to the permanent record; any value carrying an internal
 * identifier prefix is withheld here, so a transferred event keeps its
 * transferKind and drops fromRef/toRef.
 */
export function recordEventPayload(publicPayload) {
  const kept = {};
  for (const [key, value] of Object.entries(publicPayload || {})) {
    if (typeof value === 'string' && /\b(?:kp|tp|dream|consent|auth)-/i.test(value)) continue;
    kept[key] = value;
  }
  return kept;
}

/* ── Data assembly ──────────────────────────────────────────────────── */

async function firstRow(env, sql, ...values) {
  return env.DB.prepare(sql).bind(...values).first();
}

async function allRows(env, sql, ...values) {
  const result = await env.DB.prepare(sql).bind(...values).all();
  const rows = Array.isArray(result) ? result : result?.results;
  if (!Array.isArray(rows)) throw codedError('registry_unavailable');
  return rows;
}

async function gatherLight(env, keeperPieceId) {
  try {
    const row = await firstRow(
      env,
      `SELECT COUNT(*) AS claim_count, MIN(claim_ordinal) AS claim_ordinal
         FROM collector_claim_ordinals
        WHERE keeper_piece_id = ?1`,
      keeperPieceId,
    );
    const claimCount = Number(row?.claim_count ?? 0);
    const claimOrdinal = row?.claim_ordinal == null ? null : Number(row.claim_ordinal);
    return { claimCount: Number.isSafeInteger(claimCount) ? claimCount : 0, claimOrdinal };
  } catch (error) {
    if (isMissingTableError(error)) return { claimCount: 0, claimOrdinal: null };
    throw error;
  }
}

/**
 * Verify and serialize the public lineage exactly as the public endpoint
 * (functions/api/lineage/[publicCode].js) does: sequence continuity, the
 * previousHash chain, a recomputed hash for every event, and the anchor
 * count and head. Any integrity failure throws; the record is not generated
 * from a broken chain.
 */
async function gatherLineage(env, piece) {
  const rows = await allRows(
    env,
    `SELECT sequence, event_type, event_at, previous_hash, event_hash, public_payload_json
       FROM artwork_lineage_events
      WHERE keeper_piece_id = ?1
      ORDER BY sequence ASC`,
    piece.id,
  );
  if (rows.length === 0) return null;
  if (
    !Number.isSafeInteger(piece.lineage_event_count)
    || piece.lineage_event_count !== rows.length
  ) throw codedError('lineage_integrity_error');
  const events = [];
  let previousHash = null;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.sequence !== index + 1 || row.previous_hash !== previousHash) {
      throw codedError('lineage_integrity_error');
    }
    let publicPayload;
    try {
      publicPayload = JSON.parse(row.public_payload_json);
    } catch {
      throw codedError('lineage_integrity_error');
    }
    if (!publicPayload || typeof publicPayload !== 'object' || Array.isArray(publicPayload)) {
      throw codedError('lineage_integrity_error');
    }
    const recomputed = await buildLineageEvent({
      keeperPieceId: piece.id,
      sequence: row.sequence,
      eventType: row.event_type,
      eventAt: row.event_at,
      previousHash: row.previous_hash,
      publicPayload,
    });
    if (recomputed.eventHash !== row.event_hash) throw codedError('lineage_integrity_error');
    events.push({
      sequence: row.sequence,
      eventType: row.event_type,
      eventAt: row.event_at,
      previousHash: row.previous_hash,
      eventHash: row.event_hash,
      publicPayload: recordEventPayload(JSON.parse(recomputed.publicPayloadJson)),
    });
    previousHash = row.event_hash;
  }
  if (piece.lineage_head_hash !== previousHash) throw codedError('lineage_integrity_error');
  return events;
}

/**
 * Tier-1 shining contributions, once-shone-stays-shone: everything that has
 * ever shone (public_shared_at set) stays in the record even if the consent
 * state later changed, EXCEPT content carrying an abuse-management removal
 * mark (a row in collector_shine_removals), which is excluded going forward.
 * Words appear with no name, ever.
 *
 * Migration 041 adds `tier <> 'seal'` as defense in depth: a sealed body can
 * never enter a regenerated record even if its share columns were ever
 * wrong. The guard is deliberately NOT `tier = 'shine'` -- rows shone under
 * the pre-tier rules and later closed (revoked, or fail-safe-closed) carry
 * tier 'keep' after the 041 backfill, and once-shone-stays-shone keeps their
 * words in the record; structurally, nothing shone can ever become 'seal'
 * (041 seal-entry coherence), so the seal exclusion can never contradict
 * that rule. The tier-less query below covers only the deploy window where
 * 041 has not been applied yet.
 */
async function gatherShines(env, keeperPieceId) {
  const shinesSql = (tierGuard) => `SELECT id, body, scope, public_shared_at
         FROM collector_dreams
        WHERE keeper_piece_id = ?1
          AND public_shared_at IS NOT NULL
          ${tierGuard}
        ORDER BY public_shared_at ASC, created_at ASC, id ASC`;
  let rows = [];
  try {
    rows = await allRows(env, shinesSql("AND tier <> 'seal'"), keeperPieceId);
  } catch (error) {
    if (error instanceof Error && /no such column:.*\btier\b/i.test(error.message)) {
      rows = await allRows(env, shinesSql(''), keeperPieceId);
    } else if (!isMissingTableError(error)) {
      throw error;
    }
  }
  let removed = new Set();
  try {
    const marks = await allRows(
      env,
      'SELECT content_id FROM collector_shine_removals WHERE keeper_piece_id = ?1',
      keeperPieceId,
    );
    removed = new Set(marks.map((mark) => mark.content_id));
  } catch (error) {
    if (!isMissingTableError(error)) throw error;
  }
  return rows
    .filter((row) => !removed.has(row.id))
    .map((row) => ({
      words: String(row.body),
      scope: String(row.scope),
      shoneAt: String(row.public_shared_at),
    }));
}

function editionShape(editionNumber, editionSize) {
  if (editionNumber === 0) return { kind: 'unique' };
  return {
    kind: 'numbered',
    number: editionNumber,
    size: Number.isInteger(editionSize) && editionSize > 0 ? editionSize : null,
  };
}

function editionLabel(edition) {
  if (edition.kind === 'unique') return 'Unique work';
  if (edition.size !== null) return `Edition ${edition.number} of ${edition.size}`;
  return `Edition ${edition.number}`;
}

function normalizedImage(primaryImage) {
  if (!primaryImage) return null;
  const { dataUri, sha256, byteLength } = primaryImage;
  if (
    typeof dataUri !== 'string'
    || !dataUri.startsWith('data:image/')
    || dataUri.length > PIECE_RECORD_IMAGE_MAX_BYTES
    || typeof sha256 !== 'string'
    || !/^[0-9a-f]{64}$/.test(sha256)
    || !Number.isSafeInteger(byteLength)
    || byteLength < 1
  ) throw codedError('invalid_record_image');
  return { dataUri, sha256, byteLength };
}

/**
 * Gather everything the record holds for one public code.
 *
 * options.includeLegacySections gates the lineage and shines sections. The
 * caller passes the same launch condition the public lineage endpoint
 * enforces (legacyEnabled()); this generator additionally includes lineage
 * only for plate statuses that endpoint would serve.
 */
export async function gatherPieceRecordData(env, publicCode, options = {}) {
  if (!PUBLIC_CODE_PATTERN.test(String(publicCode || ''))) {
    throw codedError('invalid_public_code');
  }
  if (!env?.DB) throw codedError('db_not_configured');
  const piece = await firstRow(
    env,
    `SELECT id, piece_id, edition_number, public_code, plate_status,
            registration_status, lineage_head_hash, lineage_event_count
       FROM keeper_pieces
      WHERE public_code = ?1`,
    publicCode,
  );
  if (!piece) throw codedError('piece_not_found');

  const snapshot = await latestCatalogSnapshot(env, piece.piece_id);
  const metadata = snapshot?.metadata || {};

  let certificate = null;
  try {
    certificate = await resolveArtworkCertificate(env, piece.piece_id);
    if (certificate && Object.keys(certificate).length === 0) certificate = null;
  } catch {
    certificate = null;
  }

  const light = await gatherLight(env, piece.id);

  const includeLegacySections = options.includeLegacySections === true;
  let lineageEvents = null;
  if (includeLegacySections && LINEAGE_SERVING_STATUSES.has(piece.plate_status)) {
    lineageEvents = await gatherLineage(env, piece);
  }
  const shineEntries = includeLegacySections ? await gatherShines(env, piece.id) : null;

  const editionNumber = Number(piece.edition_number);
  const edition = editionShape(
    Number.isSafeInteger(editionNumber) ? editionNumber : 0,
    metadata?.edition?.size ?? null,
  );

  return {
    piece: {
      publicCode: piece.public_code,
      artworkId: piece.piece_id,
      title: typeof metadata.title === 'string' && metadata.title ? metadata.title : piece.piece_id,
      artist: 'Adrian Rasmussen',
      series: typeof metadata.series === 'string' ? metadata.series : null,
      edition,
      editionLabel: editionLabel(edition),
      year: typeof metadata.year === 'string' ? metadata.year : null,
      dimensions: typeof metadata.dimensions === 'string' ? metadata.dimensions : null,
      materials: Array.isArray(metadata.materials)
        ? metadata.materials.filter((item) => typeof item === 'string')
        : [],
      category: typeof metadata.category === 'string' ? metadata.category : null,
      description: typeof metadata.description === 'string' ? metadata.description : null,
    },
    catalog: snapshot ? { snapshotHash: snapshot.snapshotHash, source: snapshot.source } : null,
    certificate,
    light,
    lineage: lineageEvents === null
      ? { included: false }
      : { included: true, events: lineageEvents },
    shines: shineEntries === null
      ? { included: false }
      : { included: true, entries: shineEntries },
  };
}

/* ── Record assembly ────────────────────────────────────────────────── */

/**
 * Build the canonical record, its hash, and the finished HTML document.
 * Pure given its inputs; deterministic for identical input.
 */
export async function buildPieceRecord(env, {
  publicCode,
  trigger,
  generatedAt,
  includeLegacySections = false,
  primaryImage = null,
}) {
  if (!PIECE_RECORD_TRIGGERS.has(trigger)) throw codedError('invalid_record_trigger');
  if (typeof generatedAt !== 'string' || Number.isNaN(Date.parse(generatedAt))) {
    throw codedError('invalid_timestamp');
  }
  const data = await gatherPieceRecordData(env, publicCode, { includeLegacySections });
  const record = {
    schema: PIECE_RECORD_SCHEMA,
    schemaVersion: PIECE_RECORD_SCHEMA_VERSION,
    generatedAt,
    trigger,
    piece: data.piece,
    catalog: data.catalog,
    certificate: data.certificate,
    light: data.light,
    lineage: data.lineage,
    shines: data.shines,
    media: { primaryImage: normalizedImage(primaryImage) },
  };
  // The final strip-pass. A privacy violation aborts generation entirely.
  assertRecordPublic(record);
  const canonicalJson = canonicalRecordJson(record);
  const recordHash = await sha256Hex(canonicalJson);
  const html = renderPieceRecordHtml(record, { canonicalJson, recordHash });
  return { record, canonicalJson, recordHash, html };
}

/* ── HTML rendering ─────────────────────────────────────────────────── */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dateOnly(value) {
  return typeof value === 'string' ? value.slice(0, 10) : '';
}

const EVENT_LABELS = {
  issued: 'Plate issued',
  activated: 'Plate activated',
  fulfillment_assign: 'Assigned for sale',
  fulfillment_correct: 'Assignment corrected',
  fulfillment_correction_out: 'Assignment corrected',
  fulfillment_correction_in: 'Assignment corrected',
  fulfillment_ship: 'Shipped',
  first_bound: 'First steward registered',
  transferred: 'Stewardship transferred',
  link_corrected: 'Record corrected',
  voided: 'Plate voided',
  superseded: 'Plate superseded',
  migration_baseline: 'Registry history established',
};

const CERTIFICATE_LABELS = {
  materials: 'Materials',
  makers: 'Makers',
  origin: 'Origin',
  techniques: 'Techniques',
  yearWording: 'Year',
  editionWording: 'Edition',
  certificateWording: 'Certificate',
  openingWording: 'Opening words',
};

const RECORD_CSS = `
  :root { color-scheme: light; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #f7f4ee; color: #2b2620;
    font-family: Georgia, 'Times New Roman', Times, serif;
    line-height: 1.6; padding: 3rem 1.5rem;
  }
  main { max-width: 40rem; margin: 0 auto; }
  header { text-align: center; margin-bottom: 3rem; }
  header .code { font-size: 0.8rem; letter-spacing: 0.2em; color: #6d6154; }
  h1 { font-weight: normal; font-size: 2rem; margin: 0.5rem 0 0.25rem; }
  .artist { font-style: italic; color: #4a4137; }
  .details { margin-top: 0.75rem; color: #6d6154; font-size: 0.95rem; }
  section { margin: 2.5rem 0; }
  h2 {
    font-weight: normal; font-size: 1rem; letter-spacing: 0.14em;
    text-transform: uppercase; color: #8a7c6a;
    border-bottom: 1px solid #d9d2c5; padding-bottom: 0.4rem;
    margin-bottom: 1rem;
  }
  p { margin: 0.6rem 0; }
  dl div { margin: 0.6rem 0; }
  dt { color: #8a7c6a; font-size: 0.85rem; letter-spacing: 0.06em; }
  dd { margin: 0; }
  ol.lineage { list-style: none; }
  ol.lineage li { margin: 1.1rem 0; }
  .event-line { }
  .hash-link {
    font-family: 'Courier New', Courier, monospace; font-size: 0.72rem;
    color: #6d6154; overflow-wrap: anywhere; margin-top: 0.2rem;
  }
  .shine { font-style: italic; margin: 1.1rem 0; }
  .shine .shine-note { font-style: normal; font-size: 0.85rem; color: #8a7c6a; }
  .quiet { color: #6d6154; }
  figure { text-align: center; margin: 0 0 2.5rem; }
  figure img { max-width: 100%; }
  footer {
    margin-top: 3.5rem; padding-top: 1rem; border-top: 1px solid #d9d2c5;
    font-size: 0.85rem; color: #6d6154;
  }
  footer .record-hash {
    font-family: 'Courier New', Courier, monospace; font-size: 0.72rem;
    overflow-wrap: anywhere; color: #4a4137;
  }
  #record-verify-slot { margin-top: 0.75rem; }
  #record-verify-slot button {
    font: inherit; font-size: 0.85rem; color: #4a4137;
    background: none; border: 1px solid #b6a992; padding: 0.3rem 0.9rem;
    cursor: pointer;
  }
  @media print {
    body { background: #ffffff; padding: 0; }
    #record-verify-slot { display: none; }
  }
`;

const VERIFY_PROSE = [
  'This file carries its own proof. Inside the page source is a block marked '
  + 'piece-record-canonical. Copy the text inside it. Read it as JSON. Then write it '
  + 'back out in canonical form: in every object, at every level, put the keys in '
  + 'alphabetical order, and print the whole thing as JSON with no spaces or line '
  + 'breaks. Take the SHA-256 of that text. The 64-character result must equal the '
  + 'record hash printed at the foot of this page, and must equal the hash in this '
  + 'file’s name. If it does, nothing in this record has been changed since the day '
  + 'it was written.',
  'The lineage is a chain. The first event has no previous hash. Every later event '
  + 'names, as its previous hash, the event hash of the event before it. Read down '
  + 'the list and check each link. An unbroken chain means the history printed here '
  + 'is whole, in order, with nothing removed from the middle.',
  'Any computer can do this. In a browser console: read the JSON block, sort every '
  + 'object’s keys, JSON.stringify the result, and digest the text with SHA-256 '
  + '(crypto.subtle.digest). No server is needed, and none ever will be.',
];

// The optional inline verifier. The page reads identically without it; with
// JavaScript it adds one button that recomputes the record hash and walks the
// lineage links, using WebCrypto SHA-256 and nothing else. It never fetches.
const VERIFIER_SCRIPT = `
(function () {
  if (!window.crypto || !window.crypto.subtle || !window.TextEncoder) return;
  var source = document.getElementById('piece-record-canonical');
  var slot = document.getElementById('record-verify-slot');
  if (!source || !slot) return;
  function canonical(value) {
    if (Array.isArray(value)) {
      return '[' + value.map(canonical).join(',') + ']';
    }
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function (key) {
        return JSON.stringify(key) + ':' + canonical(value[key]);
      }).join(',') + '}';
    }
    return JSON.stringify(value);
  }
  function hex(buffer) {
    var bytes = new Uint8Array(buffer);
    var out = '';
    for (var i = 0; i < bytes.length; i += 1) {
      out += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    }
    return out;
  }
  var button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Verify this record';
  var report = document.createElement('p');
  slot.appendChild(button);
  slot.appendChild(report);
  button.addEventListener('click', function () {
    report.textContent = 'Verifying.';
    try {
      var record = JSON.parse(source.textContent);
      var text = canonical(record);
      window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
        .then(function (digest) {
          var computed = hex(digest);
          var printed = slot.getAttribute('data-record-hash');
          if (computed !== printed) {
            report.textContent = 'The record hash does not match. This copy has been altered.';
            return;
          }
          if (record.lineage && record.lineage.included === true) {
            var events = record.lineage.events || [];
            var previous = null;
            for (var i = 0; i < events.length; i += 1) {
              if (events[i].sequence !== i + 1 || events[i].previousHash !== previous) {
                report.textContent = 'The record hash matches, but the lineage chain is broken at event ' + (i + 1) + '.';
                return;
              }
              previous = events[i].eventHash;
            }
          }
          report.textContent = 'Verified. The record hash matches and every lineage link holds.';
        })
        .catch(function () {
          report.textContent = 'Verification could not run in this browser. The written procedure above still works.';
        });
    } catch (error) {
      report.textContent = 'The embedded record could not be read as JSON. This copy has been altered.';
    }
  });
})();
`;

function pieceSection(piece) {
  const detailParts = [piece.editionLabel];
  if (piece.year) detailParts.push(piece.year);
  if (piece.dimensions) detailParts.push(piece.dimensions);
  if (piece.materials.length) detailParts.push(piece.materials.join(', '));
  const lines = [];
  lines.push('<section id="the-piece">');
  lines.push('<h2>The piece</h2>');
  if (piece.category || piece.series) {
    const belonging = [piece.series, piece.category].filter(Boolean).join(' · ');
    lines.push(`<p class="quiet">${escapeHtml(belonging)}</p>`);
  }
  lines.push(`<p>${escapeHtml(detailParts.join(' · '))}</p>`);
  if (piece.description) lines.push(`<p>${escapeHtml(piece.description)}</p>`);
  lines.push(`<p class="quiet">Registry code ${escapeHtml(piece.publicCode)} · Catalog number ${escapeHtml(piece.artworkId)}</p>`);
  lines.push('</section>');
  return lines.join('\n');
}

function certificateSection(certificate) {
  const lines = ['<section id="the-certificate">', '<h2>The certificate</h2>'];
  if (!certificate) {
    lines.push('<p class="quiet">No certificate content has been recorded for this work.</p>');
  } else {
    lines.push('<dl>');
    for (const field of Object.keys(CERTIFICATE_LABELS)) {
      const value = certificate[field];
      if (value === undefined || value === null) continue;
      let text;
      if (field === 'makers' && Array.isArray(value)) {
        text = value.map((maker) => `${maker.name}, ${maker.role}`).join(' · ');
      } else if (Array.isArray(value)) {
        text = value.join(', ');
      } else {
        text = String(value);
      }
      lines.push(`<div><dt>${escapeHtml(CERTIFICATE_LABELS[field])}</dt><dd>${escapeHtml(text)}</dd></div>`);
    }
    lines.push('</dl>');
  }
  lines.push('</section>');
  return lines.join('\n');
}

function lightSection(light) {
  const lines = ['<section id="the-light">', '<h2>The light</h2>'];
  if (light.claimCount > 0 && light.claimOrdinal !== null) {
    lines.push(`<p>This piece has been claimed. It is Light ${escapeHtml(light.claimOrdinal)} of the registry. The count is the whole of what this record holds about who keeps it: no name, no place.</p>`);
  } else if (light.claimCount > 0) {
    lines.push(`<p>Claims recorded: ${escapeHtml(light.claimCount)}. The count is the whole of what this record holds about who keeps it: no name, no place.</p>`);
  } else {
    lines.push('<p class="quiet">No claim has been recorded yet. When one is, only the count will appear here, never a name.</p>');
  }
  lines.push('</section>');
  return lines.join('\n');
}

function lineageSection(lineage) {
  const lines = ['<section id="the-lineage">', '<h2>The lineage</h2>'];
  if (!lineage.included) {
    lines.push('<p class="quiet">The living record of this piece is not yet published. A later record will carry it.</p>');
  } else {
    lines.push('<p class="quiet">Every public event in this piece’s registry history, in order. Each event names the hash of the one before it; the chain can be checked by hand.</p>');
    lines.push('<ol class="lineage">');
    for (const event of lineage.events) {
      const label = EVENT_LABELS[event.eventType] || 'Registry event';
      lines.push('<li>');
      lines.push(`<p class="event-line">${event.sequence}. ${escapeHtml(label)} · ${escapeHtml(dateOnly(event.eventAt))}</p>`);
      lines.push(`<p class="hash-link">${event.previousHash === null ? 'origin' : escapeHtml(event.previousHash)} → ${escapeHtml(event.eventHash)}</p>`);
      lines.push('</li>');
    }
    lines.push('</ol>');
  }
  lines.push('</section>');
  return lines.join('\n');
}

function shinesSection(shines) {
  const lines = ['<section id="what-shines">', '<h2>What shines</h2>'];
  if (!shines.included) {
    lines.push('<p class="quiet">The living record of this piece is not yet published. A later record will carry it.</p>');
  } else if (shines.entries.length === 0) {
    lines.push('<p class="quiet">Nothing has been let shine from this piece yet.</p>');
  } else {
    lines.push('<p class="quiet">Words placed in this piece and let shine, kept as words alone, with no name.</p>');
    for (const entry of shines.entries) {
      lines.push('<div class="shine">');
      lines.push(`<p>${escapeHtml(entry.words)}</p>`);
      lines.push(`<p class="shine-note">For ${escapeHtml(entry.scope)} · first shone ${escapeHtml(dateOnly(entry.shoneAt))}</p>`);
      lines.push('</div>');
    }
  }
  lines.push('</section>');
  return lines.join('\n');
}

function verifySection() {
  const lines = ['<section id="how-to-verify">', '<h2>How to verify</h2>'];
  for (const paragraph of VERIFY_PROSE) {
    lines.push(`<p>${escapeHtml(paragraph)}</p>`);
  }
  lines.push('</section>');
  return lines.join('\n');
}

/**
 * Render the finished, self-contained HTML document. Deterministic; no state
 * beyond its arguments.
 */
export function renderPieceRecordHtml(record, { canonicalJson, recordHash }) {
  const { piece } = record;
  const embeddedJson = canonicalJson.replace(/</g, '\\u003c');
  const image = record.media.primaryImage;
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(piece.title)} · ${escapeHtml(piece.publicCode)}</title>`,
    `<style>${RECORD_CSS}</style>`,
    '</head>',
    '<body>',
    '<main>',
    '<header>',
    `<p class="code">${escapeHtml(piece.publicCode)}</p>`,
    `<h1>${escapeHtml(piece.title)}</h1>`,
    `<p class="artist">${escapeHtml(piece.artist)}</p>`,
    `<p class="details">${escapeHtml([piece.editionLabel, piece.year].filter(Boolean).join(' · '))}</p>`,
    '</header>',
    image
      ? `<figure><img src="${escapeHtml(image.dataUri)}" alt="${escapeHtml(`${piece.title} by ${piece.artist}`)}"></figure>`
      : '',
    pieceSection(piece),
    certificateSection(record.certificate),
    lightSection(record.light),
    lineageSection(record.lineage),
    shinesSection(record.shines),
    verifySection(),
    '<footer>',
    `<p>Piece Record · ${escapeHtml(record.schema)} · schema version ${record.schemaVersion}</p>`,
    `<p>Generated ${escapeHtml(dateOnly(record.generatedAt))} · trigger: ${escapeHtml(record.trigger)}</p>`,
    `<p class="record-hash">Record hash ${escapeHtml(recordHash)}</p>`,
    `<div id="record-verify-slot" data-record-hash="${escapeHtml(recordHash)}"></div>`,
    '</footer>',
    '</main>',
    `<script type="application/json" id="piece-record-canonical">${embeddedJson}</scr${'ipt'}>`,
    `<script>${VERIFIER_SCRIPT}</scr${'ipt'}>`,
    '</body>',
    '</html>',
    '',
  ].filter((line) => line !== '').join('\n');
}

/* ── R2 write path + D1 row ─────────────────────────────────────────── */

function toBytes(value) {
  return new TextEncoder().encode(value);
}

async function storedBytes(stored) {
  if (typeof stored?.arrayBuffer === 'function') {
    return new Uint8Array(await stored.arrayBuffer());
  }
  if (typeof stored?.text === 'function') {
    return new TextEncoder().encode(await stored.text());
  }
  throw new TypeError('piece record object body unavailable');
}

function bytesEqual(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function writeOnceVerified(bucket, reference, bytes, contentType) {
  try {
    await bucket.put(reference, bytes, {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType },
    });
    const stored = await bucket.get(reference);
    if (!stored || !bytesEqual(await storedBytes(stored), bytes)) return false;
    return true;
  } catch {
    return false;
  }
}

export function pieceRecordR2Key(publicCode, recordHash) {
  return `records/${publicCode}/${recordHash}.html`;
}

/**
 * Generate, store write-once in R2 (content-addressed, read back and
 * byte-compared before being reported verified, modeled on
 * identityBackup.js), then insert the append-only piece_records row.
 * Idempotent: republishing an identical record verifies against the stored
 * bytes and leaves the existing row in place.
 */
export async function publishPieceRecord(env, {
  publicCode,
  trigger,
  generatedAt,
  includeLegacySections = false,
  primaryImage = null,
}) {
  const built = await buildPieceRecord(env, {
    publicCode, trigger, generatedAt, includeLegacySections, primaryImage,
  });
  const htmlKey = pieceRecordR2Key(publicCode, built.recordHash);
  const jsonKey = `records/${publicCode}/${built.recordHash}.json`;
  const bucket = env?.ARTWORK_REGISTRY_BACKUP;
  if (!bucket) {
    return {
      status: 'failed', recordHash: built.recordHash, r2Key: htmlKey,
      record: built.record, html: built.html,
    };
  }
  const htmlVerified = await writeOnceVerified(
    bucket, htmlKey, toBytes(built.html), 'text/html; charset=utf-8',
  );
  const jsonVerified = await writeOnceVerified(
    bucket, jsonKey, toBytes(built.canonicalJson), 'application/json',
  );
  if (!htmlVerified || !jsonVerified) {
    return {
      status: 'failed', recordHash: built.recordHash, r2Key: htmlKey,
      record: built.record, html: built.html,
    };
  }
  await env.DB.prepare(
    `INSERT INTO piece_records
       (id, public_code, record_hash, r2_key, trigger_event, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6
      WHERE NOT EXISTS (
        SELECT 1 FROM piece_records
         WHERE public_code = ?2 AND record_hash = ?3
      )`,
  ).bind(
    `pr-${built.recordHash}`, publicCode, built.recordHash, htmlKey, trigger, generatedAt,
  ).run();
  return {
    status: 'verified',
    recordHash: built.recordHash,
    r2Key: htmlKey,
    record: built.record,
    html: built.html,
  };
}
