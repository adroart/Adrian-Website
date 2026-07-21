/**
 * Shared builder for the offline master ledger file. Used by the export
 * endpoint (GET /api/admin/registry-ledger) and by the Google Drive sync so
 * both produce byte-for-byte the same deterministic, hash-chained JSONL.
 *
 * Carries the recovery-code HASH and the ENCRYPTED Ownership Code envelope —
 * never a plaintext code — and no steward identity, email, IP, or display
 * location. See utils/registryLedger.ts for the format and invariants.
 */
import {
  REGISTRY_LEDGER_SCHEMA_VERSION,
  computeLedgerLines,
  serializeLedgerJsonl,
} from '../../../utils/registryLedger.ts';

export const LEDGER_FILENAME = 'registry-ledger.jsonl';

function plateRecordFromRow(row) {
  const hasEnvelope = row.ownership_code_ciphertext && row.ownership_code_nonce
    && (row.ownership_code_key_version !== null && row.ownership_code_key_version !== undefined);
  return {
    kind: 'plate',
    id: row.id,
    publicCode: row.public_code || null,
    pieceId: row.piece_id,
    editionNumber: Number(row.edition_number ?? 0),
    plateStatus: row.plate_status || 'legacy',
    recoveryCodeHash: row.recovery_code_hash,
    frontSha256: row.front_svg_sha256 || null,
    undersideSha256: row.back_svg_sha256 || null,
    envelope: hasEnvelope
      ? {
          ciphertext: row.ownership_code_ciphertext,
          nonce: row.ownership_code_nonce,
          keyVersion: String(row.ownership_code_key_version),
        }
      : null,
    backupStatus: row.backup_status || null,
    backupReference: row.backup_reference || null,
    plateGeneratedAt: row.plate_generated_at || null,
    plateActivatedAt: row.plate_activated_at || null,
    registeredAt: row.registered_at || null,
    lineageHeadHash: row.lineage_head_hash || null,
    lineageEventCount: Number(row.lineage_event_count ?? 0),
  };
}

function eventRecordFromRow(row) {
  let publicPayload = {};
  try {
    publicPayload = row.public_payload_json ? JSON.parse(row.public_payload_json) : {};
  } catch {
    publicPayload = {};
  }
  return {
    kind: 'event',
    keeperPieceId: row.keeper_piece_id,
    sequence: Number(row.sequence),
    eventType: row.event_type,
    eventAt: row.event_at,
    previousHash: row.previous_hash || null,
    eventHash: row.event_hash,
    publicPayload,
  };
}

/** Reads the registry from D1 and returns the serialized ledger file. */
export async function buildLedgerFile(env) {
  const [platesResult, eventsResult] = await Promise.all([
    env.DB.prepare(
      `SELECT id, piece_id, edition_number, public_code, plate_status,
              recovery_code_hash, front_svg_sha256, back_svg_sha256,
              ownership_code_ciphertext, ownership_code_nonce, ownership_code_key_version,
              backup_status, backup_reference, plate_generated_at, plate_activated_at,
              registered_at, lineage_head_hash, lineage_event_count
         FROM keeper_pieces`,
    ).all(),
    env.DB.prepare(
      `SELECT keeper_piece_id, sequence, event_type, event_at, previous_hash,
              event_hash, public_payload_json
         FROM artwork_lineage_events`,
    ).all(),
  ]);

  const records = [
    ...(platesResult.results || []).map(plateRecordFromRow),
    ...(eventsResult.results || []).map(eventRecordFromRow),
  ];
  const lines = await computeLedgerLines(records);
  const headHash = lines.length ? lines[lines.length - 1].hash : null;
  const header = {
    kind: 'header',
    schemaVersion: REGISTRY_LEDGER_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    recordCount: lines.length,
    headHash,
    note: 'Offline master ledger for adrianrasmussen.com artwork registry. No plaintext codes or steward identity.',
  };
  return { body: serializeLedgerJsonl(header, lines), lineCount: lines.length, headHash };
}
