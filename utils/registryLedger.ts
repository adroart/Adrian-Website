/**
 * Registry ledger — the offline master record of every artwork plate identity
 * Adrian has issued, and the append-only lineage of what happened to it.
 *
 * GOVERNANCE (decision: offline ledger is MASTER, online D1 is a MIRROR):
 *   The canonical record of the registry is a file Adrian holds offline. The
 *   online D1 database is a convenience mirror that serves live QR lookups and
 *   can be rebuilt from this ledger at any time. Nothing about this file, or the
 *   registry, is stored with Anthropic or depends on Claude at runtime — the
 *   ledger is produced by code running in Adrian's own Cloudflare account and
 *   saved to storage Adrian controls.
 *
 * WHAT IS IN THE LEDGER:
 *   - `plate` records: one per issued plate identity (public code, artwork,
 *     edition, plate status, the recovery-code HASH, the fabrication-file
 *     hashes, and the AES-GCM encrypted Ownership Code envelope). Enough to
 *     rebuild the online `keeper_pieces` registry rows with NO plaintext.
 *   - `event` records: the append-only, hash-chained lineage events
 *     (issued / activated / fulfillment / first_bound …), copied verbatim from
 *     the online append-only log.
 *
 * WHAT IS NOT IN THE LEDGER (deliberately):
 *   - No plaintext Ownership Code. Ever. The plaintext lives only on the
 *     physical art and in the separately escrowed key + your private manifests.
 *   - No steward identity, email, IP, or display location. Those are personal,
 *     governed data; they live in the private encrypted D1 export described in
 *     docs/lineage-plate-runbook.md, not in this issuance ledger.
 *
 * TAMPER EVIDENCE:
 *   The file is a hash chain. Each line commits to the SHA-256 of the previous
 *   line plus its own record, so changing, reordering, or dropping any line
 *   breaks every hash after it. verifyLedgerChain() detects this offline with no
 *   database and no network.
 *
 * PURITY: Web Crypto only, no Date, no randomness — deterministic and
 * isomorphic (browser, Cloudflare Function, and Node test all agree byte for
 * byte). The export endpoint stamps the non-chained header; the chain itself is
 * a pure function of the records.
 */

export const REGISTRY_LEDGER_SCHEMA_VERSION = 1 as const;

export interface OwnershipEnvelope {
  ciphertext: string;
  nonce: string;
  keyVersion: string;
}

export interface LedgerPlateRecord {
  kind: 'plate';
  id: string; // opaque keeper_pieces id (kp-…)
  publicCode: string | null;
  pieceId: string;
  editionNumber: number;
  plateStatus: string;
  recoveryCodeHash: string;
  frontSha256: string | null;
  undersideSha256: string | null;
  envelope: OwnershipEnvelope | null;
  backupStatus: string | null;
  backupReference: string | null;
  plateGeneratedAt: string | null;
  plateActivatedAt: string | null;
  registeredAt: string | null;
  lineageHeadHash: string | null;
  lineageEventCount: number;
}

export interface LedgerEventRecord {
  kind: 'event';
  keeperPieceId: string;
  sequence: number;
  eventType: string;
  eventAt: string;
  previousHash: string | null;
  eventHash: string;
  publicPayload: unknown;
}

export type LedgerRecord = LedgerPlateRecord | LedgerEventRecord;

export interface LedgerLine {
  n: number;
  prev: string | null;
  hash: string;
  record: LedgerRecord;
}

export interface LedgerHeader {
  kind: 'header';
  schemaVersion: typeof REGISTRY_LEDGER_SCHEMA_VERSION;
  exportedAt: string;
  recordCount: number;
  headHash: string | null;
  note: string;
}

export interface LedgerVerifyResult {
  ok: boolean;
  count: number;
  headHash: string | null;
  badIndex?: number;
  reason?: 'sequence' | 'prev' | 'hash' | 'shape';
}

export interface LedgerDiff {
  added: string[]; // present online / in B, absent in the held ledger / A
  removed: string[]; // present in the held ledger / A, absent online / in B
  changed: string[]; // same key, different content
}

/** Deterministic canonical JSON: keys sorted recursively, no whitespace. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Stable, deterministic key for a record — used for ordering and diffing. */
export function ledgerRecordKey(record: LedgerRecord): string {
  return record.kind === 'plate'
    ? `plate:${record.id}`
    : `event:${record.keeperPieceId}:${record.sequence}`;
}

/**
 * Deterministic emission order: each plate, then that plate's events in
 * sequence order, with plates ordered by generation time then id. Same registry
 * state always serializes to the same bytes.
 */
export function orderLedgerRecords(records: LedgerRecord[]): LedgerRecord[] {
  const plates = records.filter((r): r is LedgerPlateRecord => r.kind === 'plate');
  const events = records.filter((r): r is LedgerEventRecord => r.kind === 'event');
  const generatedAt = (plate: LedgerPlateRecord) =>
    plate.plateGeneratedAt || plate.registeredAt || '';
  plates.sort((a, b) => (generatedAt(a) < generatedAt(b) ? -1 : generatedAt(a) > generatedAt(b) ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const eventsByPiece = new Map<string, LedgerEventRecord[]>();
  for (const event of events) {
    const list = eventsByPiece.get(event.keeperPieceId) || [];
    list.push(event);
    eventsByPiece.set(event.keeperPieceId, list);
  }
  for (const list of eventsByPiece.values()) list.sort((a, b) => a.sequence - b.sequence);

  const ordered: LedgerRecord[] = [];
  const seenPieces = new Set<string>();
  for (const plate of plates) {
    ordered.push(plate);
    seenPieces.add(plate.id);
    for (const event of eventsByPiece.get(plate.id) || []) ordered.push(event);
  }
  // Events for pieces without a plate record (legacy) still belong in the chain,
  // appended after the plated pieces in a deterministic order.
  const orphanPieceIds = [...eventsByPiece.keys()].filter((id) => !seenPieces.has(id)).sort();
  for (const id of orphanPieceIds) {
    for (const event of eventsByPiece.get(id) || []) ordered.push(event);
  }
  return ordered;
}

/** Build the hash-chained lines for an ordered record list. */
export async function computeLedgerLines(records: LedgerRecord[]): Promise<LedgerLine[]> {
  const ordered = orderLedgerRecords(records);
  const lines: LedgerLine[] = [];
  let prev: string | null = null;
  for (let index = 0; index < ordered.length; index += 1) {
    const record = ordered[index];
    const hash = await sha256Hex(canonical({ n: index, prev, record }));
    lines.push({ n: index, prev, hash, record });
    prev = hash;
  }
  return lines;
}

/** Recompute the chain and report the first inconsistency, if any. */
export async function verifyLedgerChain(lines: LedgerLine[]): Promise<LedgerVerifyResult> {
  let prev: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || typeof line !== 'object' || !line.record) {
      return { ok: false, count: lines.length, headHash: prev, badIndex: index, reason: 'shape' };
    }
    if (line.n !== index) {
      return { ok: false, count: lines.length, headHash: prev, badIndex: index, reason: 'sequence' };
    }
    if (line.prev !== prev) {
      return { ok: false, count: lines.length, headHash: prev, badIndex: index, reason: 'prev' };
    }
    const hash = await sha256Hex(canonical({ n: index, prev, record: line.record }));
    if (hash !== line.hash) {
      return { ok: false, count: lines.length, headHash: prev, badIndex: index, reason: 'hash' };
    }
    prev = hash;
  }
  return { ok: true, count: lines.length, headHash: prev };
}

/** Serialize a full ledger file: a header line, then one JSON object per line. */
export function serializeLedgerJsonl(header: LedgerHeader, lines: LedgerLine[]): string {
  return [JSON.stringify(header), ...lines.map((line) => JSON.stringify(line))].join('\n') + '\n';
}

/** Parse a ledger file back into its header and chained lines. */
export function parseLedgerJsonl(text: string): { header: LedgerHeader | null; lines: LedgerLine[] } {
  const rows = text
    .split(/\r?\n/)
    .filter((row) => row.trim().length > 0)
    .map((row) => JSON.parse(row) as Record<string, unknown>);
  const header = rows.length > 0 && rows[0].kind === 'header' ? (rows[0] as unknown as LedgerHeader) : null;
  const lines = rows.filter((row) => row.kind !== 'header') as unknown as LedgerLine[];
  return { header, lines };
}

/**
 * Compare two record sets by key + content. Used to prove the online mirror
 * matches the held master (drift = tampering or an out-of-band change), or to
 * see what a newer export added.
 */
export function diffLedgerRecords(held: LedgerRecord[], other: LedgerRecord[]): LedgerDiff {
  const heldMap = new Map(held.map((r) => [ledgerRecordKey(r), canonical(r)]));
  const otherMap = new Map(other.map((r) => [ledgerRecordKey(r), canonical(r)]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const [key, value] of otherMap) {
    if (!heldMap.has(key)) added.push(key);
    else if (heldMap.get(key) !== value) changed.push(key);
  }
  for (const key of heldMap.keys()) if (!otherMap.has(key)) removed.push(key);
  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
}

function sqlText(value: string | null): string {
  if (value === null) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlInt(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'NULL';
  return String(Math.trunc(value));
}

/**
 * Emit idempotent SQL that rebuilds the online registry rows from the ledger —
 * the concrete "online is a mirror rebuilt from the master file" path. Uses
 * INSERT OR IGNORE so re-running against a partially present database is safe.
 * No plaintext is involved: keeper_pieces is restored from the recovery-code
 * hash and the encrypted envelope, exactly as the live mint route stored them.
 */
export function buildRebuildSql(records: LedgerRecord[]): string {
  const ordered = orderLedgerRecords(records);
  const statements: string[] = [
    '-- Rebuild online registry from the offline master ledger.',
    '-- Apply with: npx wrangler d1 execute adrian-website --remote --file <this>.sql',
  ];
  for (const record of ordered) {
    if (record.kind === 'plate') {
      statements.push(
        'INSERT OR IGNORE INTO keeper_pieces ' +
          '(id, piece_id, edition_number, recovery_code_hash, public_code, plate_status, ' +
          'plate_generated_at, plate_activated_at, front_svg_sha256, back_svg_sha256, ' +
          'ownership_code_ciphertext, ownership_code_nonce, ownership_code_key_version, ' +
          'backup_status, backup_reference, registered_at, lineage_head_hash, lineage_event_count) VALUES (' +
          [
            sqlText(record.id),
            sqlText(record.pieceId),
            sqlInt(record.editionNumber),
            sqlText(record.recoveryCodeHash),
            sqlText(record.publicCode),
            sqlText(record.plateStatus),
            sqlText(record.plateGeneratedAt),
            sqlText(record.plateActivatedAt),
            sqlText(record.frontSha256),
            sqlText(record.undersideSha256),
            sqlText(record.envelope ? record.envelope.ciphertext : null),
            sqlText(record.envelope ? record.envelope.nonce : null),
            sqlText(record.envelope ? record.envelope.keyVersion : null),
            sqlText(record.backupStatus),
            sqlText(record.backupReference),
            sqlText(record.registeredAt),
            sqlText(record.lineageHeadHash),
            sqlInt(record.lineageEventCount),
          ].join(', ') +
          ');',
      );
    } else {
      statements.push(
        'INSERT OR IGNORE INTO artwork_lineage_events ' +
          '(id, keeper_piece_id, sequence, event_type, event_at, previous_hash, event_hash, public_payload_json) VALUES (' +
          [
            sqlText(`le-${record.eventHash}`),
            sqlText(record.keeperPieceId),
            sqlInt(record.sequence),
            sqlText(record.eventType),
            sqlText(record.eventAt),
            sqlText(record.previousHash),
            sqlText(record.eventHash),
            sqlText(canonical(record.publicPayload)),
          ].join(', ') +
          ');',
      );
    }
  }
  return statements.join('\n') + '\n';
}
