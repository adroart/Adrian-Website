/**
 * Admin API for Living Legacy piece registration.
 *
 *   GET  /api/admin/pieces   → list registered pieces (newest first). NEVER
 *                              returns a recovery code or its hash.
 *   POST /api/admin/pieces   → register a piece. The server generates the long
 *                              recovery code, hashes it, stores ONLY the hash,
 *                              and returns the PLAINTEXT code exactly once so the
 *                              artist can print it on the back of the art.
 *
 * THE SHOW-CODE-ONCE RULE (load-bearing):
 *   The plaintext recovery code is returned in the POST response and NOWHERE
 *   else. It is never stored (only its SHA-256 hash reaches D1), never logged,
 *   and GET never includes it. If the artist loses the printed code before a
 *   keeper binds, the only recovery is to re-register the piece, which mints a
 *   FRESH code and voids the old one.
 *
 * THE REFUSE-OVERWRITE RULE (anti-takeover):
 *   If a piece/edition already has a LIVE keeper bound (keeper_user_id set,
 *   released_at NULL), registration refuses with 409, since re-registering would void
 *   the code a real keeper may rely on. If the piece is registered but still
 *   UNCLAIMED, registration is allowed and mints a fresh code; the response says
 *   the previously printed code is now void.
 *
 * GATING:
 *   requireAdmin first (401 when not authed), then the `livingLegacy` flag
 *   (404 when off, so the surface is invisible in production until the feature
 *   ships, same as the keeper endpoints), then the D1 binding (503). A missing
 *   008/009 migration table surfaces as the same 503 the keeper endpoints use.
 *
 * INVARIANT: no row written here ever enters a ledger hash. keeper_pieces is
 * mutable D1; the chain (mandalacodes side) carries only opaque ids + salted
 * commitments. recovery_code_hash is a SHA-256 hash, never the plaintext.
 */

import { jsonResponse, requireAdmin, requireDb } from '../_lib/admin.js';
import {
  legacyEnabled,
  notFound,
  migrationNotApplied,
  isMissingTableError,
  hashRecoveryCode,
  genKeeperPieceId,
} from '../_lib/keeper.js';
import { generateRecoveryCode } from '../../../utils/recoveryCode.ts';

export async function onRequest(context) {
  const { request, env } = context;

  // requireAdmin gates every admin endpoint, no exceptions.
  const unauthorized = requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  // Behind the Living Legacy flag: invisible (404) while the feature is off, the
  // same way the keeper endpoints hide their surface.
  if (!legacyEnabled()) return notFound();

  const missingDb = requireDb(env);
  if (missingDb) return missingDb;

  if (request.method === 'GET') return listPieces(env);
  if (request.method === 'POST') return registerPiece(request, env);
  return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
}

/**
 * Serialize a keeper_pieces row for the admin list. Deliberately omits
 * recovery_code_hash (and there is no plaintext to omit, it was never stored).
 */
function serialize(row) {
  return {
    id: row.id,
    pieceId: row.piece_id,
    editionNumber: row.edition_number,
    keeperBound: Boolean(row.keeper_user_id) && !row.released_at,
    currentDisplayLocation: row.current_display_location || null,
    registeredAt: row.registered_at || null,
    claimedAt: row.claimed_at || null,
    releasedAt: row.released_at || null,
  };
}

async function listPieces(env) {
  try {
    const { results } = await env.DB
      .prepare(
        `SELECT id, piece_id, edition_number, keeper_user_id,
                current_display_location, registered_at, claimed_at, released_at
           FROM keeper_pieces
          ORDER BY COALESCE(registered_at, claimed_at) DESC`,
      )
      .all();
    return jsonResponse({ ok: true, pieces: (results || []).map(serialize) });
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    throw err;
  }
}

async function registerPiece(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400);
  }

  // Whitelist discipline: the server decides what reaches D1.
  const pieceId = typeof body?.pieceId === 'string' ? body.pieceId.trim() : '';
  const editionNumber = Number.isInteger(body?.editionNumber) ? body.editionNumber : 0;
  if (!pieceId) {
    return jsonResponse({ ok: false, error: 'piece_id_required' }, 400);
  }

  const nowIso = new Date().toISOString();

  try {
    // Is there already a row for this piece/edition (active, not released)?
    const existing = await env.DB
      .prepare(
        `SELECT id, keeper_user_id, claimed_at
           FROM keeper_pieces
          WHERE piece_id = ?1 AND edition_number = ?2 AND released_at IS NULL`,
      )
      .bind(pieceId, editionNumber)
      .first();

    // Refuse to overwrite a LIVE keeper's binding: a re-register would void the
    // code that keeper relies on. The artist must release the piece first.
    if (existing && existing.keeper_user_id) {
      return jsonResponse(
        {
          ok: false,
          error: 'keeper_bound',
          message:
            'This piece already has a keeper. Registering again would void the code they rely on, so it is refused. Release the piece first if it is genuinely being re-issued.',
        },
        409,
      );
    }

    // Fresh code minted server-side. The plaintext is returned once below and
    // never stored or logged; only the hash reaches D1.
    const recoveryCode = generateRecoveryCode();
    const codeHash = await hashRecoveryCode(recoveryCode);

    let reRegistered = false;
    if (existing) {
      // Registered-but-unclaimed → mint a fresh code, void the old printed one.
      await env.DB
        .prepare(
          `UPDATE keeper_pieces
              SET recovery_code_hash = ?1, registered_at = ?2
            WHERE id = ?3`,
        )
        .bind(codeHash, nowIso, existing.id)
        .run();
      reRegistered = true;
    } else {
      const id = genKeeperPieceId();
      try {
        await env.DB
          .prepare(
            `INSERT INTO keeper_pieces
               (id, piece_id, edition_number, recovery_code_hash, registered_at)
             VALUES (?1, ?2, ?3, ?4, ?5)`,
          )
          .bind(id, pieceId, editionNumber, codeHash, nowIso)
          .run();
      } catch (insErr) {
        // UNIQUE(recovery_code_hash) collision is astronomically unlikely
        // (32^16 space) but handled honestly; UNIQUE(piece_id, edition_number)
        // would mean a concurrent register raced us.
        if (/unique/i.test(String(insErr?.message))) {
          return jsonResponse(
            {
              ok: false,
              error: 'register_conflict',
              message: 'This piece was registered a moment ago. Reload the list.',
            },
            409,
          );
        }
        throw insErr;
      }
    }

    // The ONLY time the plaintext recovery code is ever returned. Print it on the
    // back of the art now; it will not be shown again.
    return jsonResponse(
      {
        ok: true,
        reRegistered,
        recoveryCode,
        piece: { pieceId, editionNumber, registeredAt: nowIso },
        message: reRegistered
          ? 'A fresh code was generated. The previously printed code is now void. Print this new code on the back of the art. It will not be shown again.'
          : 'Piece registered. Print this code on the back of the art. It will not be shown again.',
      },
      201,
    );
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    // Never leak internals; never log the plaintext code (we hold it only in the
    // response we are returning).
    console.error('[admin/pieces] error:', err?.message);
    return jsonResponse({ ok: false, error: 'register_failed' }, 500);
  }
}
