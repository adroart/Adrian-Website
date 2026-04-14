/**
 * GET /qr/:number
 *
 * Redirects a physical QR code scan to the oracle card reading page.
 * This indirection means the destination URL can change any time without
 * reprinting physical plaques — just update this file and redeploy.
 *
 * Examples:
 *   /qr/1  →  /oracle/universal-language/1?ref=qr
 *   /qr/41 →  /oracle/universal-language/41?ref=qr
 */

export function onRequest({ params }) {
  // Gateway — redirects to the oracle deck entrance page
  if (params.number === 'oracle') {
    return Response.redirect(
      'https://adrianrasmussen.com/oracle?ref=qr',
      302,
    );
  }

  const n = parseInt(params.number, 10);

  if (isNaN(n) || n < 1 || n > 64) {
    return new Response('Not found', { status: 404 });
  }

  return Response.redirect(
    `https://adrianrasmussen.com/oracle/universal-language/${n}?ref=qr`,
    302,
  );
}
