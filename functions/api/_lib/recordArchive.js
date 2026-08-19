/**
 * Piece Records archive: one deterministic ZIP of every current public record.
 *
 * Layout inside the zip:
 *   records/index.html          a tiny self-contained front door listing every
 *                               piece (title · public code · link)
 *   records/{publicCode}.html   the newest generated record per piece, pulled
 *                               byte-for-byte from write-once R2 via the
 *                               piece_records table
 *
 * The ZIP writer is a minimal pure-JS STORE-only implementation (no
 * compression): correct CRC-32, fixed timestamps, entries sorted by name, so
 * identical input always produces identical bytes. That determinism is what
 * lets the Drive mirror update piece-records.zip in place without churning
 * revisions for unchanged content.
 *
 * Content is public-safe by construction: every stored record already passed
 * the pieceRecord.js strip-pass before it was written, so the archive needs
 * no encryption (unlike the private recovery export, which stays separate).
 */

function codedError(code) {
  return Object.assign(new Error(code), { code });
}

/* ── CRC-32 (standard, polynomial 0xEDB88320) ───────────────────────── */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let index = 0; index < bytes.byteLength; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* ── Minimal deterministic STORE-only ZIP writer ────────────────────── */

// Fixed DOS timestamp: 1980-01-01 00:00:00, the epoch of the ZIP format.
const FIXED_DOS_TIME = 0;
const FIXED_DOS_DATE = (1 << 5) | 1; // year 1980, month 1, day 1

const ZIP_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

/**
 * Build a STORE-only ZIP from { name, bytes } entries. Entries are sorted by
 * name; duplicate or unsafe names throw. Deterministic: identical input
 * produces identical output bytes.
 */
export function buildStoredZip(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw codedError('empty_zip');
  }
  const encoder = new TextEncoder();
  const normalized = entries.map((entry) => {
    if (!entry || typeof entry.name !== 'string' || !ZIP_NAME_PATTERN.test(entry.name)
      || !(entry.bytes instanceof Uint8Array)) {
      throw codedError('invalid_zip_entry');
    }
    return {
      name: entry.name,
      nameBytes: encoder.encode(entry.name),
      bytes: entry.bytes,
      crc: crc32(entry.bytes),
    };
  }).sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index].name === normalized[index - 1].name) {
      throw codedError('duplicate_zip_entry');
    }
  }

  const localSize = normalized.reduce(
    (total, entry) => total + 30 + entry.nameBytes.byteLength + entry.bytes.byteLength, 0,
  );
  const centralSize = normalized.reduce(
    (total, entry) => total + 46 + entry.nameBytes.byteLength, 0,
  );
  const totalSize = localSize + centralSize + 22;
  if (localSize > 0xFFFFFFFF || normalized.length > 0xFFFF) {
    throw codedError('zip_too_large');
  }
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);

  let offset = 0;
  const localOffsets = [];
  for (const entry of normalized) {
    localOffsets.push(offset);
    writeUint32(view, offset, 0x04034B50); // local file header signature
    writeUint16(view, offset + 4, 20); // version needed to extract
    writeUint16(view, offset + 6, 0); // general purpose flags
    writeUint16(view, offset + 8, 0); // method: STORE
    writeUint16(view, offset + 10, FIXED_DOS_TIME);
    writeUint16(view, offset + 12, FIXED_DOS_DATE);
    writeUint32(view, offset + 14, entry.crc);
    writeUint32(view, offset + 18, entry.bytes.byteLength); // compressed size
    writeUint32(view, offset + 22, entry.bytes.byteLength); // uncompressed size
    writeUint16(view, offset + 26, entry.nameBytes.byteLength);
    writeUint16(view, offset + 28, 0); // extra field length
    out.set(entry.nameBytes, offset + 30);
    out.set(entry.bytes, offset + 30 + entry.nameBytes.byteLength);
    offset += 30 + entry.nameBytes.byteLength + entry.bytes.byteLength;
  }

  const centralStart = offset;
  normalized.forEach((entry, index) => {
    writeUint32(view, offset, 0x02014B50); // central directory signature
    writeUint16(view, offset + 4, 20); // version made by
    writeUint16(view, offset + 6, 20); // version needed to extract
    writeUint16(view, offset + 8, 0); // flags
    writeUint16(view, offset + 10, 0); // method: STORE
    writeUint16(view, offset + 12, FIXED_DOS_TIME);
    writeUint16(view, offset + 14, FIXED_DOS_DATE);
    writeUint32(view, offset + 16, entry.crc);
    writeUint32(view, offset + 20, entry.bytes.byteLength);
    writeUint32(view, offset + 24, entry.bytes.byteLength);
    writeUint16(view, offset + 28, entry.nameBytes.byteLength);
    writeUint16(view, offset + 30, 0); // extra length
    writeUint16(view, offset + 32, 0); // comment length
    writeUint16(view, offset + 34, 0); // disk number start
    writeUint16(view, offset + 36, 0); // internal attributes
    writeUint32(view, offset + 38, 0); // external attributes
    writeUint32(view, offset + 42, localOffsets[index]);
    out.set(entry.nameBytes, offset + 46);
    offset += 46 + entry.nameBytes.byteLength;
  });

  writeUint32(view, offset, 0x06054B50); // end of central directory signature
  writeUint16(view, offset + 4, 0); // this disk
  writeUint16(view, offset + 6, 0); // central directory disk
  writeUint16(view, offset + 8, normalized.length);
  writeUint16(view, offset + 10, normalized.length);
  writeUint32(view, offset + 12, offset - centralStart); // central directory size
  writeUint32(view, offset + 16, centralStart); // central directory offset
  writeUint16(view, offset + 20, 0); // comment length
  return out;
}

/* ── The archive of current records ─────────────────────────────────── */

const PUBLIC_CODE_PATTERN = /^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Read piece.title back out of a stored record's embedded canonical JSON. */
export function recordTitleFromHtml(html, publicCode) {
  const match = /<script type="application\/json" id="piece-record-canonical">([\s\S]*?)<\/script>/
    .exec(html);
  if (match) {
    try {
      const record = JSON.parse(match[1]);
      const title = record?.piece?.title;
      if (typeof title === 'string' && title) return title;
    } catch {
      // fall through to the code itself
    }
  }
  return publicCode;
}

const INDEX_CSS = `
  :root { color-scheme: light; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #f7f4ee; color: #2b2620;
    font-family: Georgia, 'Times New Roman', Times, serif;
    line-height: 1.6; padding: 3rem 1.5rem;
  }
  main { max-width: 40rem; margin: 0 auto; }
  h1 { font-weight: normal; font-size: 1.6rem; margin-bottom: 0.5rem; }
  p.quiet { color: #6d6154; margin-bottom: 2rem; }
  ul { list-style: none; }
  li { margin: 0.8rem 0; }
  a { color: #4a4137; }
  .code { color: #6d6154; font-size: 0.9rem; letter-spacing: 0.08em; }
`;

/**
 * Render the archive's front door: every piece, one line each,
 * title · public code · link to its record file. Deterministic.
 */
export function renderRecordsIndexHtml(pieces) {
  const lines = [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Piece Records · Adrian Rasmussen</title>',
    `<style>${INDEX_CSS}</style>`,
    '</head>',
    '<body>',
    '<main>',
    '<h1>Piece Records</h1>',
    '<p class="quiet">One permanent record per piece. Each file stands alone, carries its own proof, and can be read with nothing but a browser.</p>',
    '<ul>',
  ];
  for (const piece of pieces) {
    lines.push(
      `<li>${escapeHtml(piece.title)} · <span class="code">${escapeHtml(piece.publicCode)}</span>`
      + ` · <a href="${escapeHtml(piece.publicCode)}.html">open the record</a></li>`,
    );
  }
  lines.push('</ul>', '</main>', '</body>', '</html>', '');
  return lines.join('\n');
}

/**
 * Gather the newest record per piece from D1 + R2 and build the archive zip.
 * Returns { bytes, pieces } where pieces lists what the archive holds.
 * Throws coded errors: db_not_configured, records_bucket_not_configured,
 * record_object_missing:{key}.
 */
export async function buildPieceRecordsArchive(env) {
  if (!env?.DB) throw codedError('db_not_configured');
  const bucket = env?.ARTWORK_REGISTRY_BACKUP;
  if (!bucket) throw codedError('records_bucket_not_configured');

  const result = await env.DB.prepare(
    `SELECT public_code, record_hash, r2_key, created_at, id
       FROM piece_records
      ORDER BY public_code ASC, created_at DESC, id DESC`,
  ).all();
  const rows = Array.isArray(result) ? result : result?.results;
  if (!Array.isArray(rows)) throw codedError('registry_unavailable');

  // Newest record per public code: rows arrive newest-first within each code.
  const newestByCode = new Map();
  for (const row of rows) {
    if (!PUBLIC_CODE_PATTERN.test(String(row.public_code || ''))) continue;
    if (!newestByCode.has(row.public_code)) newestByCode.set(row.public_code, row);
  }

  const decoder = new TextDecoder();
  const pieces = [];
  const entries = [];
  for (const [publicCode, row] of newestByCode) {
    const stored = await bucket.get(row.r2_key);
    if (!stored) throw codedError(`record_object_missing:${row.r2_key}`);
    const bytes = typeof stored.arrayBuffer === 'function'
      ? new Uint8Array(await stored.arrayBuffer())
      : new TextEncoder().encode(await stored.text());
    const title = recordTitleFromHtml(decoder.decode(bytes), publicCode);
    pieces.push({ publicCode, title, recordHash: row.record_hash });
    entries.push({ name: `records/${publicCode}.html`, bytes });
  }
  pieces.sort((left, right) =>
    left.publicCode < right.publicCode ? -1 : left.publicCode > right.publicCode ? 1 : 0);

  entries.push({
    name: 'records/index.html',
    bytes: new TextEncoder().encode(renderRecordsIndexHtml(pieces)),
  });
  return { bytes: buildStoredZip(entries), pieces };
}

export const RECORDS_ARCHIVE_FILENAME = 'piece-records.zip';
