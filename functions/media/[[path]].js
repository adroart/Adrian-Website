const MEDIA_WORKER_ORIGIN = 'https://adrian-website-media.lightcodes.workers.dev';

export const onRequest = async ({ request }) => {
  const incoming = new URL(request.url);
  const upstream = new URL(incoming.pathname + incoming.search, MEDIA_WORKER_ORIGIN);
  return fetch(new Request(upstream, request));
};
