/**
 * GET /qr/oracle
 *
 * Gateway plaque redirect. Printed material pointing here now resolves
 * to mandalacodes.com (the oracle's new home).
 *
 * NEVER DELETE THIS FILE — same QR-safety contract as /qr/:number.
 */

export function onRequest() {
  return Response.redirect('https://mandalacodes.com/?ref=qr', 302);
}
