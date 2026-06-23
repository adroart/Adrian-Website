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
 * LIVING LEGACY NOTE: no new redirect branch is needed for keeper binding.
 * The public QR number is look-only and already lands on /works/:code?ref=qr,
 * which the arrival treatment keys off (see components/WorksPage.tsx). The
 * SECRET recovery code (the long code on the back of the art) is never placed
 * in a URL or scanned — it is typed by the keeper into the bind form, which
 * POSTs to /api/keeper/bind. Keeping the recovery code out of the redirect path
 * is deliberate: a URL leaks in browser history, referrers, and shoulder-surfs;
 * the typed-secret flow does not. So the existing /works/:code path suffices.
 */

export function onRequest({ params, request }) {
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

  // Everything else → artwork record on this domain
  const origin = new URL(request.url).origin;
  return Response.redirect(
    `${origin}/works/${code}?ref=qr`,
    302,
  );
}
