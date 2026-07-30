/**
 * GET /qr/:code
 *
 * Universal QR redirect — the permanent URL engraved/printed on
 * physical art pieces. This function is the single routing layer
 * between a scanned QR code and its destination.
 *
 * Routing rules (order matters):
 *   "oracle"  →  mandalacodes.com oracle deck home
 *   1..64     →  mandalacodes.com oracle card (legacy printed plaques)
 *   *         →  /works/:code on this domain (artwork record)
 *
 * PERMANENT INFRASTRUCTURE — printed and engraved QR codes in the
 * wild depend on this function. Do not change the URL scheme.
 *
 * LIVING LEGACY NOTE: no new redirect branch is needed for steward binding.
 * The public QR number is look-only and already lands on /works/:code?ref=qr,
 * which the arrival treatment keys off (see components/WorksPage.tsx). The
 * SECRET recovery code (the long code on the back of the art) is never placed
 * in a URL or scanned. It is typed by the steward into the bind form, which
 * POSTs to /api/keeper/bind. Keeping the recovery code out of the redirect path
 * is deliberate: a URL leaks in browser history, referrers, and shoulder-surfs;
 * the typed-secret flow does not. So the existing /works/:code path suffices.
 */

export async function onRequest({ params, request, env }) {
  const code = params.number;

  // Oracle deck home
  if (code === 'oracle') {
    return Response.redirect(
      'https://mandalacodes.com/oracle/universal-language?ref=qr',
      302,
    );
  }

  // Oracle cards 1-64 (legacy printed plaques)
  const n = parseInt(code, 10);
  if (!isNaN(n) && n >= 1 && n <= 64 && String(n) === code) {
    return Response.redirect(
      `https://mandalacodes.com/oracle/universal-language/${n}?ref=qr`,
      302,
    );
  }

  // Issued physical artwork instances
  if (/^AR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code)) {
    if (!env?.DB) return new Response('Registry unavailable', { status: 503 });

    let row;
    try {
      row = await env.DB
        .prepare(
          `SELECT piece_id
             FROM keeper_pieces
            WHERE public_code = ?1
              AND plate_status IN ('generated', 'active')`,
        )
        .bind(code)
        .first();
    } catch {
      return new Response('Registry unavailable', { status: 503 });
    }

    if (!row) return new Response('Not found', { status: 404 });

    const origin = new URL(request.url).origin;
    const query = new URLSearchParams({
      instance: code,
      ref: 'qr',
    });
    return Response.redirect(
      `${origin}/works/${encodeURIComponent(row.piece_id)}?${query.toString()}`,
      302,
    );
  }

  // AR- is reserved for issued physical identities. Invalid values must not
  // collide with static artwork IDs or create plausible-looking work routes.
  if (code.startsWith('AR-')) {
    return new Response('Not found', { status: 404 });
  }

  // Everything else → artwork record on this domain
  const origin = new URL(request.url).origin;
  return Response.redirect(
    `${origin}/works/${code}?ref=qr`,
    302,
  );
}
