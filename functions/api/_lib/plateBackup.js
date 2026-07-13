function backupDocument(row) {
  return {
    schemaVersion: 1,
    publicCode: row.public_code,
    pieceId: row.piece_id,
    editionNumber: row.edition_number,
    plateGeneratedAt: row.plate_generated_at,
    envelope: {
      ciphertext: row.ownership_code_ciphertext,
      nonce: row.ownership_code_nonce,
      keyVersion: String(row.ownership_code_key_version),
    },
  };
}

/** Mirrors an already-encrypted row. This module never receives encryption keys. */
export async function backupPlateEnvelope(bucket, row) {
  const reference = `plates/${row.public_code}.json`;
  if (!bucket) return { status: 'failed', reference };

  try {
    const expected = JSON.stringify(backupDocument(row));
    await bucket.put(reference, expected, {
      httpMetadata: { contentType: 'application/json' },
    });
    const stored = await bucket.get(reference);
    if (!stored) return { status: 'failed', reference };
    const actual = await stored.text();
    if (actual !== expected) return { status: 'failed', reference };
    return { status: 'verified', reference };
  } catch {
    return { status: 'failed', reference };
  }
}

export async function recordPlateBackupResult(db, keeperPieceId, result) {
  const at = result.status === 'verified' ? new Date().toISOString() : null;
  await db.prepare(
    `UPDATE keeper_pieces
        SET backup_status = ?1, backup_reference = ?2, backup_at = ?3
      WHERE id = ?4`,
  ).bind(result.status, result.reference, at, keeperPieceId).run();
  return at;
}
