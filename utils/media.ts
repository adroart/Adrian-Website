const MEDIA_BASE = '/media/image';

export interface ImgOptions {
  w?: number;
  h?: number;
  crop?: 'fill' | 'fit' | 'scale' | 'thumb';
  quality?: number | 'auto';
  gravity?: 'auto' | 'center' | 'face' | 'faces';
  format?: 'auto' | 'webp' | 'png' | 'jpg';
}

export function img(publicId: string, opts: ImgOptions = {}): string {
  const path = publicId.split('/').map(encodeURIComponent).join('/');
  const params = new URLSearchParams();
  if (opts.w) params.set('w', String(opts.w));
  if (opts.h) params.set('h', String(opts.h));
  if (opts.crop) params.set('crop', opts.crop);
  if (opts.quality !== undefined) params.set('q', String(opts.quality));
  if (opts.gravity) params.set('gravity', opts.gravity);
  if (opts.format && opts.format !== 'auto') params.set('format', opts.format);
  const query = params.toString();
  return `${MEDIA_BASE}/${path}${query ? `?${query}` : ''}`;
}

export function srcset(
  publicId: string,
  widths: number[] = [400, 800, 1200, 1600],
): string {
  return widths.map((w) => `${img(publicId, { w })} ${w}w`).join(', ');
}
