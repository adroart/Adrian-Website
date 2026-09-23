const SIZES = [80, 150, 160, 200, 240, 280, 300, 360, 400, 560, 600, 640, 675, 700, 720, 800, 900, 960, 1100, 1200, 1280, 1400, 1600, 1800];
const SIZE_PAIRS = new Set([
  '80x80', '150x150', '160x160', '200x200', '240x240', '280x280',
  '360x360', '400x400', '560x560', '600x600', '640x360', '640x640', '700x700',
  '720x720', '800x800', '900x900', '1100x1100', '1200x1200', '1600x1600',
  '960x540', '1200x630', '1200x675', '1200x800', '1600x1200', '800x900', '900x1100',
]);
const RAW_MEDIA_ORIGIN = 'https://adrian-website-media.lightcodes.workers.dev';

function dimension(value) {
  if (!value) return undefined;
  const requested = Number.parseInt(value, 10);
  return SIZES.includes(requested) ? requested : undefined;
}

function outputFormat(request, value) {
  if (value === 'png') return 'image/png';
  if (value === 'jpg') return 'image/jpeg';
  if (value === 'webp') return 'image/webp';
  const accept = request.headers.get('Accept') ?? '';
  if (accept.includes('image/avif')) return 'image/avif';
  if (accept.includes('image/webp')) return 'image/webp';
  return 'image/jpeg';
}

async function handle(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }

  const url = new URL(request.url);
  let key;
  try {
    key = decodeURIComponent(url.pathname.replace(/^\/media\//, ''));
  } catch {
    return new Response('Not found', { status: 404 });
  }
  if (!key || key.includes('..') || key.startsWith('/')) return new Response('Not found', { status: 404 });

  const width = dimension(url.searchParams.get('w'));
  const requestedHeight = dimension(url.searchParams.get('h'));
  const height = width && requestedHeight && SIZE_PAIRS.has(`${width}x${requestedHeight}`) ? requestedHeight : undefined;
  const crop = url.searchParams.get('crop');
  const fit = crop === 'fit' ? 'contain' : crop === 'scale' ? 'scale-down' : 'cover';
  const gravityParam = url.searchParams.get('gravity');
  const gravity = gravityParam === 'face' || gravityParam === 'faces' ? 'face' : gravityParam === 'center' ? 'center' : 'auto';
  const qualityParam = Number.parseInt(url.searchParams.get('q') ?? '', 10);
  const quality = [60, 75, 82, 90].includes(qualityParam) ? qualityParam : 82;
  const format = outputFormat(request, url.searchParams.get('format'));
  const needsTransform = Boolean(width || height || url.searchParams.has('format'));

  let response;
  if (needsTransform && key.startsWith('image/')) {
    // URL-based Image Resizing runs outside this Free-plan Worker's CPU budget.
    // The source request has no query, so it takes the raw R2 branch below.
    const rawUrl = new URL(url.pathname, RAW_MEDIA_ORIGIN);
    const imageOptions = { width, height, fit, gravity, quality };
    if (format !== 'image/jpeg') imageOptions.format = format.slice('image/'.length);
    response = await fetch(rawUrl, {
      headers: { Accept: request.headers.get('Accept') ?? 'image/jpeg' },
      cf: { image: imageOptions },
    });
    if (!response.ok) return response;
  } else {
    const object = await env.MEDIA_BUCKET.get(key);
    if (!object) return new Response('Not found', { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    response = new Response(object.body, { headers });
  }

  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(request.method === 'HEAD' ? null : response.body, {
    status: response.status,
    headers,
  });
}

export default {
  fetch: handle,
};
