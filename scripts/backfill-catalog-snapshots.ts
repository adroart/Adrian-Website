/**
 * One-time, idempotent catalog-snapshot backfill for pieces that were
 * registered in D1 before migration 035 existed, whose catalog metadata so far
 * lives only in data/mockData.ts.
 *
 * House offline pattern (see scripts/import-atlas-source.ts): this script
 * NEVER touches a database. It reads the compiled catalog (FULL_ARCHIVE),
 * canonicalizes every artwork through the exact same code the live registry
 * uses (functions/api/_lib/catalogSnapshot.js — imported, not mirrored), and
 * emits deterministic SQL to stdout. Review the SQL, then apply it through
 * the normal offline process, e.g.:
 *
 *   npx tsx scripts/backfill-catalog-snapshots.ts > /tmp/catalog-snapshots.sql
 *   wrangler d1 execute adrian-website --remote --file /tmp/catalog-snapshots.sql
 *
 * Optional: --created-at 2026-08-19T00:00:00.000Z pins the snapshot timestamp
 * (defaults to now). The timestamp does not affect idempotency.
 *
 * Idempotency and divergence:
 * - Every INSERT is guarded by NOT EXISTS on (artwork_id, snapshot_hash), the
 *   same guard ensureCatalogSnapshot applies at runtime, so re-running the
 *   script (with any timestamp) is a clean no-op. Same hash = same content,
 *   so an existing row never needs touching; the table is append-only
 *   (migration 035 forbids UPDATE and DELETE).
 * - A catalog entry whose content has since changed simply gains a NEW
 *   snapshot row under its new hash; nothing is ever rewritten.
 * - Each INSERT is additionally scoped to pieces the registry actually knows
 *   (EXISTS on keeper_pieces.piece_id), so the backfill freezes metadata only
 *   for registered pieces, not the whole catalog.
 */

import { FULL_ARCHIVE } from '../data/mockData.ts';
// The runtime canonicalization itself — imported so the backfill can never
// drift from functions/api/_lib/catalogSnapshot.js.
// @ts-ignore plain-JS Cloudflare Function module without type declarations
import { catalogSnapshotDigest } from '../functions/api/_lib/catalogSnapshot.js';

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function sql(value: string | number | null): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

const createdAt = argument('--created-at') ?? new Date().toISOString();
if (Number.isNaN(Date.parse(createdAt)) || !/Z$/.test(createdAt)) {
  process.stderr.write('invalid --created-at (expected an ISO-8601 UTC timestamp ending in Z)\n');
  process.exitCode = 1;
} else {
  try {
    const statements = [
      '-- Catalog snapshot backfill for registered pieces (append-only, migration 035).',
      '-- Generated offline by scripts/backfill-catalog-snapshots.ts. Never run automatically.',
      '-- Idempotent: re-running is a no-op; guarded on (artwork_id, snapshot_hash).',
      'PRAGMA foreign_keys = ON;',
      'BEGIN IMMEDIATE;',
    ];
    const artworks = [...FULL_ARCHIVE].sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
    const seenIds = new Set<string>();
    for (const artwork of artworks) {
      if (seenIds.has(artwork.id)) throw new Error(`duplicate_catalog_id:${artwork.id}`);
      seenIds.add(artwork.id);
      const { canonical, canonicalJson, snapshotHash } = await catalogSnapshotDigest(artwork);
      const artworkId: string = canonical.id;
      // The exact id shape ensureCatalogSnapshot writes at runtime.
      const rowId = `acs-${artworkId.toLowerCase()}-${snapshotHash.slice(0, 32)}`;
      statements.push(
        `INSERT INTO artwork_catalog_snapshots`
        + ` (id, artwork_id, snapshot_hash, canonical_json, source, created_at)`
        + ` SELECT ${sql(rowId)}, ${sql(artworkId)}, ${sql(snapshotHash)},`
        + ` ${sql(canonicalJson)}, 'mockData', ${sql(createdAt)}`
        + ` WHERE EXISTS (SELECT 1 FROM keeper_pieces WHERE piece_id = ${sql(artworkId)})`
        + ` AND NOT EXISTS (SELECT 1 FROM artwork_catalog_snapshots`
        + ` WHERE artwork_id = ${sql(artworkId)} AND snapshot_hash = ${sql(snapshotHash)});`,
      );
    }
    statements.push('COMMIT;');
    process.stdout.write(`${statements.join('\n')}\n`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'catalog_snapshot_backfill_failed'}\n`,
    );
    process.exitCode = 1;
  }
}
