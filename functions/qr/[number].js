/**
 * GET /qr/:number
 *
 * Redirects a physical QR code scan to the Universal Language oracle card.
 * The oracle deck now lives on mandalacodes.com, so the redirect target
 * crosses domains; this indirection keeps any printed plaques working
 * until Adrian reprints them with the mandalacodes URL baked in.
 *
 * Examples:
 *   /qr/1  →  https://mandalacodes.com/oracle/universal-language/1?ref=qr
 *   /qr/41 →  https://mandalacodes.com/oracle/universal-language/41?ref=qr
 */

export function onRequest({ params }) {
  // Gateway — the bare /qr/oracle code redirects to the deck's home.
  if (params.number === 'oracle') {
    return Response.redirect(
      'https://mandalacodes.com/oracle/universal-language?ref=qr',
      302,
    );
  }

  const n = parseInt(params.number, 10);

  if (isNaN(n) || n < 1 || n > 64) {
    return new Response('Not found', { status: 404 });
  }

  return Response.redirect(
    `https://mandalacodes.com/oracle/universal-language/${n}?ref=qr`,
    302,
  );
}
