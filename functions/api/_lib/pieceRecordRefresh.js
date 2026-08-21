/**
 * Shared "build, compare, publish, report" refresh path for one piece's
 * permanent Piece Record (_lib/pieceRecord.js). Three call sites used to
 * carry near-identical copies of this logic (admin/records/rebuild.js,
 * admin/artworks/[id]/media.js, admin/shine-removals.js); this is the one
 * copy they all call now, and it is also what every registry-event trigger
 * site (activation, transfer, bind, contribution) calls directly.
 *
 * Hard contract: refreshPieceRecord NEVER throws. Every failure mode --
 * an unresolvable piece identity, a missing D1 table, a missing R2 bucket,
 * a lineage integrity error, a storage verification failure -- becomes an
 * outcome object instead of an exception. This matters because every
 * trigger site calls this AFTER its own registry mutation has already
 * committed. A thrown error here would turn a successful, sometimes
 * irreversible write (see admin/pieces/[id]/activate.js) into an apparent
 * failure, which is worse than a record that silently stays stale.
 *
 * Idempotency mirrors admin/records/rebuild.js's original rebuildOne
 * exactly: the rebuilt record is compared against the newest stored record
 * two ways -- first the cheap hash equality, then, if that misses, a
 * substantive comparison that holds the two caller-supplied stamps
 * (generatedAt, trigger) constant. Only a genuine content change is
 * reported 'generated'; everything else is 'unchanged', so retries and
 * repeated triggers on unchanged content never churn new R2 objects. This
 * fallback is not optional: generatedAt sits inside the hashed record, so
 * without it a rebuild at a new timestamp would (almost) never match the
 * previous hash and would churn a new record every single time.
 */
import { isMissingTableError } from './keeper.js';
import {
  buildPieceRecord, canonicalRecordJson, publishPieceRecord,
} from './pieceRecord.js';

/**
 * publicCode wins when given; otherwise it is resolved from keeperPieceId.
 * Callers reach this helper from either identity depending on which one
 * their own row already carries in scope (a public_code column, or only
 * the internal keeper_piece_id), so both are accepted rather than forcing
 * every caller to do its own lookup first.
 */
async function resolvePublicCode(env, { publicCode, keeperPieceId }) {
  if (typeof publicCode === 'string' && publicCode.trim()) return publicCode.trim();
  const id = typeof keeperPieceId === 'string' ? keeperPieceId.trim() : '';
  if (!id || !env?.DB) return null;
  const row = await env.DB.prepare(
    'SELECT public_code FROM keeper_pieces WHERE id = ?1',
  ).bind(id).first();
  const resolved = row?.public_code;
  return typeof resolved === 'string' && resolved ? resolved : null;
}

async function latestRecord(env, publicCode) {
  const row = await env.DB.prepare(
    `SELECT record_hash
       FROM piece_records
      WHERE public_code = ?1
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
  ).bind(publicCode).first();
  return row ?? null;
}

/** Canonical JSON of a record with the caller-supplied stamps held constant. */
function substantiveRecordJson(record) {
  return canonicalRecordJson({ ...record, generatedAt: '', trigger: '' });
}

async function storedCanonicalRecord(env, publicCode, recordHash) {
  try {
    const stored = await env.ARTWORK_REGISTRY_BACKUP.get(
      `records/${publicCode}/${recordHash}.json`,
    );
    if (!stored) return null;
    const parsed = JSON.parse(await stored.text());
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Build, compare, and (if changed) publish the Piece Record for one piece.
 * NEVER throws -- see the file header. Returns
 *   { publicCode, status: 'generated'|'unchanged'|'failed'|'skipped', recordHash?, error? }
 * 'skipped' means there was no piece identity to act on at all (no
 * publicCode given and none could be resolved from keeperPieceId); every
 * other failure mode -- including a missing table, meaning the relevant
 * migration has not been applied yet -- is 'failed' with an error code.
 */
/**
 * @param {object} env
 * @param {{
 *   publicCode?: string,
 *   keeperPieceId?: string,
 *   trigger: string,
 *   generatedAt: string,
 *   includeLegacySections?: boolean,
 * }} [input]
 */
export async function refreshPieceRecord(env, {
  publicCode: publicCodeInput,
  keeperPieceId,
  trigger,
  generatedAt,
  includeLegacySections = false,
} = {}) {
  let publicCode = null;
  try {
    publicCode = await resolvePublicCode(env, { publicCode: publicCodeInput, keeperPieceId });
  } catch {
    publicCode = null;
  }
  if (!publicCode) {
    return { publicCode: null, status: 'skipped', error: 'public_code_unresolved' };
  }

  try {
    const built = await buildPieceRecord(env, {
      publicCode, trigger, generatedAt, includeLegacySections,
    });
    const previous = await latestRecord(env, publicCode);
    if (previous) {
      if (previous.record_hash === built.recordHash) {
        return { publicCode, status: 'unchanged', recordHash: previous.record_hash };
      }
      const previousRecord = await storedCanonicalRecord(env, publicCode, previous.record_hash);
      if (previousRecord
        && substantiveRecordJson(previousRecord) === substantiveRecordJson(built.record)) {
        return { publicCode, status: 'unchanged', recordHash: previous.record_hash };
      }
    }
    const result = await publishPieceRecord(env, {
      publicCode, trigger, generatedAt, includeLegacySections,
    });
    if (result.status !== 'verified') {
      return { publicCode, status: 'failed', error: 'record_storage_failed' };
    }
    return { publicCode, status: 'generated', recordHash: result.recordHash };
  } catch (error) {
    return {
      publicCode,
      status: 'failed',
      error: isMissingTableError(error)
        ? 'migration_not_applied'
        : String(error?.code || error?.message || 'record_generation_failed'),
    };
  }
}
