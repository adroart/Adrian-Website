/**
 * Project the append-only Atlas ledger into derived state.
 *
 * Events are immutable; the current state of every piece is computed by
 * replaying its chain from genesis. This module owns those rules so the
 * downstream UI and API never have to interpret event types directly.
 *
 * Public projection rules (important):
 *   - `withdrawn` pieces are omitted from PublicAtlasState entirely. We
 *     never expose the fact that a piece was hidden — the public projection
 *     just shows it as if it never existed publicly.
 *   - `retired` pieces are also omitted from public output. They live on
 *     in the raw ledger for posterity but the globe shouldn't show them.
 *   - `seeking` pieces (created, never placed) ARE included publicly so
 *     the "seeking ground" cluster works.
 *   - Cities are filtered down to only those referenced by visible pieces.
 */
import type {
  CityCentroid,
  LedgerEvent,
  PieceRecord,
  PublicAtlasState,
} from '../types';

/**
 * Replay a single piece's chain into its current state. Caller is responsible
 * for sorting events by date ascending before calling — same convention as
 * utils/ledger.ts.
 *
 * Throws nothing: malformed chains produce a best-effort projection. The
 * verifyChain helper in ledger.ts is the place to enforce integrity.
 */
export function projectPiece(events: LedgerEvent[]): PieceRecord {
  if (events.length === 0) {
    throw new Error('projectPiece: cannot project an empty chain');
  }

  // Anchor identity from the first event (genesis).
  const genesis = events[0];
  const record: PieceRecord = {
    pieceId: genesis.pieceId,
    editionNumber: genesis.editionNumber,
    currentCityId: null,
    status: 'seeking',
    history: events,
    isPublic: true,
  };

  for (const e of events) {
    switch (e.type) {
      case 'created':
        // Genesis. Optional cityId is allowed (e.g. studio of origin) but
        // doesn't count as "placed" — the piece is still seeking ground
        // until an explicit 'placed' event.
        if (e.cityId) record.currentCityId = e.cityId;
        record.status = 'seeking';
        break;
      case 'placed':
        record.currentCityId = e.cityId ?? null;
        record.status = 'placed';
        break;
      case 'moved':
        record.currentCityId = e.cityId ?? null;
        record.status = 'placed';
        break;
      case 'withdrawn':
        record.isPublic = false;
        // currentCityId is retained internally so admin can still see it;
        // only the public projection strips it.
        break;
      case 'revealed':
        record.isPublic = true;
        break;
      case 'retired':
        record.status = 'retired';
        record.currentCityId = null;
        break;
    }
  }

  return record;
}

/**
 * Group a flat list of events into per-piece chains and project each one.
 * Returned map is keyed by `${pieceId}:${editionNumber ?? 0}` so that
 * editioned works each get their own record.
 */
export function projectAll(events: LedgerEvent[]): Map<string, PieceRecord> {
  const groups = new Map<string, LedgerEvent[]>();
  for (const e of events) {
    const key = `${e.pieceId}:${e.editionNumber ?? 0}`;
    const arr = groups.get(key);
    if (arr) arr.push(e);
    else groups.set(key, [e]);
  }

  const out = new Map<string, PieceRecord>();
  for (const [key, chain] of groups) {
    chain.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    out.set(key, projectPiece(chain));
  }
  return out;
}

/**
 * Build the safe, public-facing projection. Strips private fields, hides
 * withdrawn and retired pieces, and includes only the cities those pieces
 * reference. The result is what gets cached at /api/atlas and mirrored to
 * the GitHub redundancy repo.
 *
 * @param records   Output of projectAll(events).
 * @param artworks  Lookup of artwork metadata (series + category) keyed by
 *                  pieceId. We accept a Map so callers can build it from
 *                  whatever source they want (mockData.ts at first, a CMS
 *                  later) without coupling this util to a particular data
 *                  source.
 * @param cities    The full city catalog. Filtered down to referenced ones.
 */
export function toPublicState(
  records: Map<string, PieceRecord>,
  artworks: Map<string, { series?: string; category?: string }>,
  cities: CityCentroid[],
): PublicAtlasState {
  const referencedCityIds = new Set<string>();
  const pieces: PublicAtlasState['pieces'] = [];

  for (const record of records.values()) {
    if (record.status === 'retired') continue;
    if (!record.isPublic) continue;

    const meta = artworks.get(record.pieceId);

    // The public status is binary: a piece is either placed or seeking.
    // The internal 'withdrawn' state never reaches the public projection.
    const publicStatus: 'seeking' | 'placed' =
      record.status === 'placed' ? 'placed' : 'seeking';

    // Most recent placed/moved event's date, for client-side sorting and
    // the "recently placed" view.
    let placedAt: string | undefined;
    for (let i = record.history.length - 1; i >= 0; i--) {
      const h = record.history[i];
      if (h.type === 'placed' || h.type === 'moved') {
        placedAt = h.date;
        break;
      }
    }

    if (record.currentCityId) referencedCityIds.add(record.currentCityId);

    pieces.push({
      pieceId: record.pieceId,
      editionNumber: record.editionNumber,
      series: meta?.series,
      category: meta?.category,
      cityId: record.currentCityId,
      status: publicStatus,
      placedAt,
    });
  }

  const filteredCities = cities.filter((c) => referencedCityIds.has(c.id));

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    pieces,
    cities: filteredCities,
  };
}
