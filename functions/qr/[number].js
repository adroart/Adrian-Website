/**
 * GET /qr/:number
 *
 * Printed-plaque redirect. The 64 oracle cards have been migrated to
 * mandalacodes.com; this function keeps every physical plaque already
 * in the world working forever by 302-redirecting to the new home.
 *
 * NEVER DELETE THIS FILE. The plaques are printed and out there.
 * As long as adrianrasmussen.com keeps serving /qr/:n, the QR codes
 * on every card resolve correctly without reprinting.
 *
 * Examples:
 *   /qr/1  →  https://mandalacodes.com/universal-language/1?ref=qr
 *   /qr/41 →  https://mandalacodes.com/universal-language/41?ref=qr
 */

export function onRequest({ params }) {
  // Gateway plaque — redirects to the Mandala Codes home / deck entrance.
  if (params.number === 'oracle') {
    return Response.redirect('https://mandalacodes.com/?ref=qr', 302);
  }

  const n = parseInt(params.number, 10);

  if (isNaN(n) || n < 1 || n > 64) {
    return new Response('Not found', { status: 404 });
  }

  return Response.redirect(
    `https://mandalacodes.com/universal-language/${n}?ref=qr`,
    302,
  );
}
