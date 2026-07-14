/** Public, non-sensitive sign-in capability discovery. */
export function onRequest({ request, env }) {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return Response.json(
    { google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
