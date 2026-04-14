/**
 * GET /qr/oracle
 *
 * Redirects a physical QR code scan to the Universal Language oracle gateway.
 * This indirection means the destination can change any time without reprinting
 * physical plaques — just update the URL below and redeploy.
 *
 * Current destination: /oracle?ref=qr  (the gateway entrance page)
 */

export function onRequest() {
  return Response.redirect(
    'https://adrianrasmussen.com/oracle?ref=qr',
    302,
  );
}
