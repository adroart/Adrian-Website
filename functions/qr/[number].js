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
