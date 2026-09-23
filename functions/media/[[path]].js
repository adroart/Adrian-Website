const MEDIA_WORKER_ORIGIN = 'https://adrian-website-media.lightcodes.workers.dev';

export const onRequest = async ({ request }) => {
  const incoming = new URL(request.url);
  const upstream = new URL(incoming.pathname + incoming.search, MEDIA_WORKER_ORIGIN);
  // Let the browser request the media Worker directly. Proxying a cold image
  // resize through this Pages Function can exhaust the calling Worker's
  // resources and return 1102 even though the upstream image is available.
  return Response.redirect(upstream, 302);
};
