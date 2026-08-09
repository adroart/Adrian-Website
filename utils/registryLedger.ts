/**
 * Registry ledger — the secret-free offline record of every artwork plate
 * identity Adrian has issued and the append-only public lineage around it.
 *
 * GOVERNANCE:
 *   This ledger is safe to hold offline or sync to Drive, but is deliberately
 *   incomplete and is never a full-registry restore source. Complete recovery
 *   uses the separately encrypted private artifact documented in
 *   docs/registry-private-recovery.md. Nothing depends on an AI service at
 *   runtime; both artifacts are produced by code in Adrian's Cloudflare account.
 *
 * WHAT IS IN THE LEDGER:
 *   - `plate` records: one per issued plate identity (public code, artwork,
 *     edition, plate status, the recovery-code HASH, the fabrication-file
 *     hashes, and the AES-GCM encrypted Ownership Code envelope).
 *   - `event` records: the append-only, hash-chained lineage events
 *     (issued / activated / fulfillment / first_bound …), copied verbatim from
 *     the online append-only log.
 *
 * WHAT IS NOT IN THE LEDGER (deliberately):
 *   - No plaintext Ownership Code. Ever. The plaintext lives only on the
 *     physical art and in the separately escrowed key + your private manifests.
 *   - No steward identity, email, IP, or display location. Those are personal,
 *     governed data; they live only in the encrypted private recovery artifact,
 *     not in this issuance ledger.
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

export const REGISTRY_LEDGER_SCHEMA_VERSION = 2 as const;
export const SUPPORTED_REGISTRY_LEDGER_SCHEMA_VERSIONS = [1, 2] as const;
export type RegistryLedgerSchemaVersion = typeof SUPPORTED_REGISTRY_LEDGER_SCHEMA_VERSIONS[number];

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

export interface LedgerSourceChainRecord {
  kind: 'source-chain';
  sourceChainId: string;
  keeperPieceId: string;
  sourceSystem: 'mandalacodes-atlas';
  sourceReference: string;
  movedOn: string;
  eventCount: number;
  headHash: string;
}

export interface LedgerSourceEventRecord {
  kind: 'source-event';
  sourceChainId: string;
  sequence: number;
  eventId: string;
  eventType: string;
  eventAt: string;
  previousHash: string | null;
  eventHash: string;
}

export type LedgerRecord = LedgerPlateRecord | LedgerEventRecord
  | LedgerSourceChainRecord | LedgerSourceEventRecord;

export interface LedgerLine {
  n: number;
  prev: string | null;
  hash: string;
  record: LedgerRecord;
}

export interface LedgerHeader {
  kind: 'header';
  schemaVersion: RegistryLedgerSchemaVersion;
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

export type LedgerFileVerifyReason =
  | 'missing_header'
  | 'duplicate_header'
  | 'late_header'
  | 'schema'
  | 'record_count'
  | 'head_hash'
  | 'json'
  | 'record_shape'
  | NonNullable<LedgerVerifyResult['reason']>;

export interface LedgerFileVerifyResult extends Omit<LedgerVerifyResult, 'reason'> {
  reason?: LedgerFileVerifyReason;
}

export interface LedgerFileParseIssue {
  reason: 'duplicate_header' | 'late_header' | 'json' | 'record_shape';
  badIndex: number;
}

export interface LedgerFileParseResult {
  header: LedgerHeader | null;
  lines: LedgerLine[];
  parseIssue?: LedgerFileParseIssue;
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
  if (record.kind === 'plate') return `plate:${record.id}`;
  if (record.kind === 'event') return `event:${record.keeperPieceId}:${record.sequence}`;
  if (record.kind === 'source-chain') return `source-chain:${record.sourceChainId}`;
  return `source-event:${record.sourceChainId}:${record.sequence}`;
}

/**
 * Deterministic emission order: each plate, then that plate's events in
 * sequence order, with plates ordered by generation time then id. Same registry
 * state always serializes to the same bytes.
 */
export function orderLedgerRecords(records: LedgerRecord[]): LedgerRecord[] {
  const plates = records.filter((r): r is LedgerPlateRecord => r.kind === 'plate');
  const events = records.filter((r): r is LedgerEventRecord => r.kind === 'event');
  const sourceChains = records.filter((r): r is LedgerSourceChainRecord => r.kind === 'source-chain');
  const sourceEvents = records.filter((r): r is LedgerSourceEventRecord => r.kind === 'source-event');
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
  const sourceChainByPiece = new Map(sourceChains.map((chain) => [chain.keeperPieceId, chain]));
  const sourceEventsByChain = new Map<string, LedgerSourceEventRecord[]>();
  for (const event of sourceEvents) {
    const list = sourceEventsByChain.get(event.sourceChainId) || [];
    list.push(event);
    sourceEventsByChain.set(event.sourceChainId, list);
  }
  for (const list of sourceEventsByChain.values()) list.sort((a, b) => a.sequence - b.sequence);

  const ordered: LedgerRecord[] = [];
  const seenPieces = new Set<string>();
  for (const plate of plates) {
    ordered.push(plate);
    seenPieces.add(plate.id);
    for (const event of eventsByPiece.get(plate.id) || []) ordered.push(event);
    const sourceChain = sourceChainByPiece.get(plate.id);
    if (sourceChain) {
      ordered.push(sourceChain);
      sourceChainByPiece.delete(plate.id);
      const sourceChainId = sourceChain.sourceChainId;
      for (const event of sourceEventsByChain.get(sourceChainId) || []) ordered.push(event);
      sourceEventsByChain.delete(sourceChainId);
    }
  }
  // Events for pieces without a plate record (legacy) still belong in the chain,
  // appended after the plated pieces in a deterministic order.
  const orphanPieceIds = [...eventsByPiece.keys()].filter((id) => !seenPieces.has(id)).sort();
  for (const id of orphanPieceIds) {
    for (const event of eventsByPiece.get(id) || []) ordered.push(event);
  }
  for (const chain of [...sourceChainByPiece.values()].sort((a, b) =>
    a.keeperPieceId.localeCompare(b.keeperPieceId))) {
    ordered.push(chain);
    const sourceChainId = chain.sourceChainId;
    for (const event of sourceEventsByChain.get(sourceChainId) || []) ordered.push(event);
    sourceEventsByChain.delete(sourceChainId);
  }
  for (const chainId of [...sourceEventsByChain.keys()].sort()) {
    for (const event of sourceEventsByChain.get(chainId) || []) ordered.push(event);
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

/** Verify the complete ledger document, including its non-chained header. */
export async function verifyLedgerFile(file: {
  header: LedgerHeader | null;
  lines: LedgerLine[];
  parseIssue?: LedgerFileParseIssue;
}): Promise<LedgerFileVerifyResult> {
  if (file.parseIssue) {
    return {
      ok: false,
      count: file.lines.length,
      headHash: null,
      badIndex: file.parseIssue.badIndex,
      reason: file.parseIssue.reason,
    };
  }
  if (!file.header) {
    return { ok: false, count: file.lines.length, headHash: null, reason: 'missing_header' };
  }
  if (!isLedgerHeader(file.header)) {
    return { ok: false, count: file.lines.length, headHash: null, reason: 'schema' };
  }
  if (file.header.recordCount !== file.lines.length) {
    return { ok: false, count: file.lines.length, headHash: null, reason: 'record_count' };
  }
  for (let index = 0; index < file.lines.length; index += 1) {
    if (!isLedgerLine(file.lines[index])
      || !isLedgerRecordForSchema(file.lines[index].record, file.header.schemaVersion)) {
      return {
        ok: false,
        count: file.lines.length,
        headHash: null,
        badIndex: index,
        reason: 'record_shape',
      };
    }
  }
  const chain = await verifyLedgerChain(file.lines);
  if (!chain.ok) return chain;
  if (file.header.headHash !== chain.headHash) {
    return {
      ok: false,
      count: chain.count,
      headHash: chain.headHash,
      reason: 'head_hash',
    };
  }
  return chain;
}

/** Serialize a full ledger file: a header line, then one JSON object per line. */
export function serializeLedgerJsonl(header: LedgerHeader, lines: LedgerLine[]): string {
  return [JSON.stringify(header), ...lines.map((line) => JSON.stringify(line))].join('\n') + '\n';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isHashOrNull(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && /^[a-f0-9]{64}$/.test(value));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (!isPlainObject(value)) return false;
  return Object.values(value).every(isJsonValue);
}

function isOwnershipEnvelope(value: unknown): value is OwnershipEnvelope {
  return isPlainObject(value)
    && hasExactKeys(value, ['ciphertext', 'nonce', 'keyVersion'])
    && isString(value.ciphertext)
    && isString(value.nonce)
    && isString(value.keyVersion);
}

function isLedgerPlateRecord(value: unknown): value is LedgerPlateRecord {
  if (!isPlainObject(value) || !hasExactKeys(value, [
    'kind', 'id', 'publicCode', 'pieceId', 'editionNumber', 'plateStatus',
    'recoveryCodeHash', 'frontSha256', 'undersideSha256', 'envelope',
    'backupStatus', 'backupReference', 'plateGeneratedAt', 'plateActivatedAt',
    'registeredAt', 'lineageHeadHash', 'lineageEventCount',
  ])) return false;
  return value.kind === 'plate'
    && isString(value.id)
    && isStringOrNull(value.publicCode)
    && isString(value.pieceId)
    && isNonNegativeInteger(value.editionNumber)
    && isString(value.plateStatus)
    && isString(value.recoveryCodeHash)
    && isStringOrNull(value.frontSha256)
    && isStringOrNull(value.undersideSha256)
    && (value.envelope === null || isOwnershipEnvelope(value.envelope))
    && isStringOrNull(value.backupStatus)
    && isStringOrNull(value.backupReference)
    && isStringOrNull(value.plateGeneratedAt)
    && isStringOrNull(value.plateActivatedAt)
    && isStringOrNull(value.registeredAt)
    && isStringOrNull(value.lineageHeadHash)
    && isNonNegativeInteger(value.lineageEventCount);
}

function isLedgerEventRecord(value: unknown): value is LedgerEventRecord {
  if (!isPlainObject(value) || !hasExactKeys(value, [
    'kind', 'keeperPieceId', 'sequence', 'eventType', 'eventAt', 'previousHash',
    'eventHash', 'publicPayload',
  ])) return false;
  return value.kind === 'event'
    && isString(value.keeperPieceId)
    && isNonNegativeInteger(value.sequence)
    && isString(value.eventType)
    && isString(value.eventAt)
    && isStringOrNull(value.previousHash)
    && isString(value.eventHash)
    && isJsonValue(value.publicPayload);
}

function isLedgerSourceChainRecord(value: unknown): value is LedgerSourceChainRecord {
  if (!isPlainObject(value) || !hasExactKeys(value, [
    'kind', 'sourceChainId', 'keeperPieceId', 'sourceSystem', 'sourceReference', 'movedOn',
    'eventCount', 'headHash',
  ])) return false;
  return value.kind === 'source-chain'
    && isString(value.sourceChainId)
    && isString(value.keeperPieceId)
    && value.sourceSystem === 'mandalacodes-atlas'
    && isString(value.sourceReference)
    && isString(value.movedOn)
    && isNonNegativeInteger(value.eventCount)
    && typeof value.headHash === 'string'
    && /^[a-f0-9]{64}$/.test(value.headHash);
}

function isLedgerSourceEventRecord(value: unknown): value is LedgerSourceEventRecord {
  if (!isPlainObject(value) || !hasExactKeys(value, [
    'kind', 'sourceChainId', 'sequence', 'eventId', 'eventType', 'eventAt',
    'previousHash', 'eventHash',
  ])) return false;
  return value.kind === 'source-event'
    && isString(value.sourceChainId)
    && isNonNegativeInteger(value.sequence)
    && value.sequence > 0
    && isString(value.eventId)
    && isString(value.eventType)
    && isString(value.eventAt)
    && isHashOrNull(value.previousHash)
    && typeof value.eventHash === 'string'
    && /^[a-f0-9]{64}$/.test(value.eventHash);
}

function isLedgerRecord(value: unknown): value is LedgerRecord {
  return isLedgerPlateRecord(value) || isLedgerEventRecord(value)
    || isLedgerSourceChainRecord(value) || isLedgerSourceEventRecord(value);
}

function isLedgerRecordForSchema(value: unknown, schemaVersion: RegistryLedgerSchemaVersion) {
  if (schemaVersion === 1) return isLedgerPlateRecord(value) || isLedgerEventRecord(value);
  return isLedgerRecord(value);
}

function isLedgerLine(value: unknown): value is LedgerLine {
  if (!isPlainObject(value) || !hasExactKeys(value, ['n', 'prev', 'hash', 'record'])) return false;
  return isNonNegativeInteger(value.n)
    && isHashOrNull(value.prev)
    && typeof value.hash === 'string'
    && /^[a-f0-9]{64}$/.test(value.hash)
    && isPlainObject(value.record);
}

function isLedgerHeader(value: unknown): value is LedgerHeader {
  if (!isPlainObject(value) || !hasExactKeys(value, [
    'kind', 'schemaVersion', 'exportedAt', 'recordCount', 'headHash', 'note',
  ])) return false;
  return value.kind === 'header'
    && SUPPORTED_REGISTRY_LEDGER_SCHEMA_VERSIONS.includes(
      value.schemaVersion as RegistryLedgerSchemaVersion,
    )
    && isString(value.exportedAt)
    && isNonNegativeInteger(value.recordCount)
    && isHashOrNull(value.headHash)
    && isString(value.note);
}

/** Parse every non-empty row without hiding duplicate, late, or invalid rows. */
export function parseLedgerJsonl(text: string): LedgerFileParseResult {
  const rows = text.split(/\r?\n/);
  let header: LedgerHeader | null = null;
  const lines: LedgerLine[] = [];
  let sawNonHeader = false;

  for (let physicalIndex = 0; physicalIndex < rows.length; physicalIndex += 1) {
    const row = rows[physicalIndex];
    if (row.trim().length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(row);
    } catch {
      return { header, lines, parseIssue: { reason: 'json', badIndex: physicalIndex } };
    }
    if (!isPlainObject(parsed)) {
      return { header, lines, parseIssue: { reason: 'record_shape', badIndex: physicalIndex } };
    }
    if (parsed.kind === 'header') {
      if (header) {
        return { header, lines, parseIssue: { reason: 'duplicate_header', badIndex: physicalIndex } };
      }
      if (sawNonHeader) {
        return { header, lines, parseIssue: { reason: 'late_header', badIndex: physicalIndex } };
      }
      header = parsed as unknown as LedgerHeader;
      continue;
    }
    sawNonHeader = true;
    lines.push(parsed as unknown as LedgerLine);
  }
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
