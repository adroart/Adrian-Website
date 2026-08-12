import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

type PreflightDatabase = {
  prepare(sql: string): { all(): unknown[] };
};

export type ResetDamagedArtwork = {
  keeperPieceId: string;
  publicCode: string | null;
};

export function findResetDamagedArtwork(database: PreflightDatabase): ResetDamagedArtwork[] {
  const rows = database.prepare(`
    SELECT piece.id AS keeperPieceId, piece.public_code AS publicCode
      FROM keeper_pieces piece
     WHERE (piece.keeper_user_id IS NULL) <> (piece.claimed_at IS NULL)
        OR (
         piece.keeper_user_id IS NULL
         AND piece.claimed_at IS NULL
         AND (
         EXISTS (
           SELECT 1 FROM artwork_lineage_events lineage
            WHERE lineage.keeper_piece_id = piece.id
              AND lineage.event_type = 'first_bound'
         )
         OR EXISTS (
           SELECT 1 FROM registry_maintenance_events maintenance
            WHERE maintenance.keeper_piece_id = piece.id
              AND (
                (json_valid(maintenance.before_json)
                  AND COALESCE(
                    json_extract(maintenance.before_json, '$.keeperUserId'),
                    json_extract(maintenance.before_json, '$.keeper_user_id')
                  ) IS NOT NULL)
                OR (json_valid(maintenance.after_json)
                  AND COALESCE(
                    json_extract(maintenance.after_json, '$.keeperUserId'),
                    json_extract(maintenance.after_json, '$.keeper_user_id')
                  ) IS NOT NULL)
              )
         )
       ))
     ORDER BY piece.id
  `).all() as ResetDamagedArtwork[];
  return rows.map((row) => ({
    keeperPieceId: row.keeperPieceId,
    publicCode: row.publicCode,
  }));
}

function isDirectRun(): boolean {
  return Boolean(process.argv[1])
    && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isDirectRun()) {
  const databasePath = process.argv[2];
  if (!databasePath) {
    console.error('Usage: preflight-ownership-foundation <read-only-registry-copy.sqlite>');
    process.exitCode = 2;
  } else {
    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const damaged = findResetDamagedArtwork(database);
      if (damaged.length) {
        console.error(JSON.stringify({ ok: false, damaged }, null, 2));
        process.exitCode = 1;
      } else {
        console.log(JSON.stringify({ ok: true, damaged: [] }));
      }
    } finally {
      database.close();
    }
  }
}
