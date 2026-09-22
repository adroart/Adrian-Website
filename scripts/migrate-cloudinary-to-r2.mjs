import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const projectRoot = resolve(args.get('--project-root') ?? process.cwd());
const bucket = args.get('--bucket');
const dataFile = resolve(args.get('--data') ?? join(projectRoot, 'data/mockData.ts'));
const uploadManifest = args.get('--upload-manifest') ? resolve(args.get('--upload-manifest')) : null;
const cacheDir = resolve(args.get('--cache-dir') ?? join('/tmp', 'cloudinary-r2-migration', bucket ?? 'unknown'));
const dryRun = args.get('--dry-run') === 'true';

if (!bucket) throw new Error('Pass --bucket <R2 bucket name>');

const assets = new Map();
const mediaKeys = new Set(['image', 'images', 'coverImage', 'video', 'poster']);
const ignoredDirs = new Set(['.git', 'node_modules', 'dist', 'test-results']);

function addImage(publicId, source) {
  if (!publicId || publicId.includes('${') || publicId.startsWith('/') || publicId.startsWith('http')) return;
  assets.set(`image/${publicId}`, { key: `image/${publicId}`, source: source ?? cloudinarySource('image', publicId) });
}

function addCloudinaryUrl(value) {
  if (value.includes('${')) return false;
  const match = value.match(/^https:\/\/res\.cloudinary\.com\/dobbosnda\/(image|video)\/upload\/(.+)$/);
  if (!match) return false;
  const type = match[1];
  const isVideoPoster = type === 'video' && /(?:^|\/)f_jpg(?:,|\/)/.test(match[2]);
  const segments = match[2].split('/');
  while (segments.length && (/^[a-z]{1,3}_/.test(segments[0]) || /^v\d+$/.test(segments[0]))) segments.shift();
  let publicId = segments.join('/');
  publicId = publicId.replace(/\.(?:jpe?g|png|webp|gif|avif|mp4|mov|webm)$/i, '');
  const key = isVideoPoster
    ? `image/video-posters/${publicId}`
    : `${type}/${publicId}${type === 'video' ? '.mp4' : ''}`;
  assets.set(key, { key, source: value });
  return true;
}

function cloudinarySource(type, publicId) {
  return `https://res.cloudinary.com/dobbosnda/${type}/upload/${publicId.split('/').map(encodeURIComponent).join('/')}`;
}

function visit(value, key = '') {
  if (Array.isArray(value)) {
    for (const item of value) visit(item, key);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) visit(child, childKey);
    return;
  }
  if (typeof value !== 'string') return;
  if (addCloudinaryUrl(value)) return;
  if (mediaKeys.has(key) && !value.startsWith('http')) addImage(value);
}

async function scanFiles(directory) {
  for (const name of await readdir(directory)) {
    if (ignoredDirs.has(name)) continue;
    const path = join(directory, name);
    const info = await stat(path);
    if (info.isDirectory()) {
      await scanFiles(path);
    } else if (/\.(?:ts|tsx|js|jsx|html|astro|json)$/.test(name)) {
      const text = await readFile(path, 'utf8');
      for (const match of text.matchAll(/https:\/\/res\.cloudinary\.com\/dobbosnda\/(?:image|video)\/upload\/[^\s'"<>)]+/g)) {
        addCloudinaryUrl(match[0]);
      }
      for (const match of text.matchAll(/\bimg\(\s*['"]([^'"]+)['"]/g)) addImage(match[1]);
    }
  }
}

const data = await import(pathToFileURL(dataFile));
visit(data);
await scanFiles(projectRoot);

if (uploadManifest) {
  const manifest = JSON.parse(await readFile(uploadManifest, 'utf8'));
  for (const item of manifest.success ?? []) addImage(item.public_id, item.url);
}

const list = [...assets.values()].sort((a, b) => a.key.localeCompare(b.key));
await mkdir(cacheDir, { recursive: true });
await writeFile(join(cacheDir, 'manifest.json'), `${JSON.stringify(list, null, 2)}\n`);
console.log(`Collected ${list.length} referenced assets for ${bucket}.`);
if (dryRun) process.exit(0);

const wrangler = 'npx';
let uploaded = 0;
let skipped = 0;
let failed = 0;

async function migrate(asset) {
  const digest = createHash('sha256').update(asset.key).digest('hex');
  const localPath = join(cacheDir, digest);
  let response;
  try {
    response = await fetch(asset.source, { signal: AbortSignal.timeout(90_000) });
  } catch (error) {
    failed += 1;
    console.error(`DOWNLOAD FAILED ${asset.key}: ${error.message}`);
    return;
  }
  if (!response.ok) {
    skipped += 1;
    console.warn(`SKIP ${response.status} ${asset.key}`);
    return;
  }
  const contentType = response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(localPath, bytes);

  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(wrangler, [
      'wrangler', 'r2', 'object', 'put', `${bucket}/${asset.key}`,
      '--file', localPath,
      '--content-type', contentType,
      '--cache-control', 'public, max-age=31536000, immutable',
      '--remote', '--force',
    ], { cwd: projectRoot, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code) console.error(stderr.trim());
      resolveExit(code ?? 1);
    });
  });
  if (exitCode === 0) {
    uploaded += 1;
    console.log(`UPLOADED ${uploaded}/${list.length} ${asset.key} (${bytes.length} bytes)`);
  } else {
    failed += 1;
    console.error(`UPLOAD FAILED ${asset.key}`);
  }
}

for (let index = 0; index < list.length; index += 4) {
  await Promise.all(list.slice(index, index + 4).map(migrate));
}

console.log(JSON.stringify({ bucket, collected: list.length, uploaded, skipped, failed }));
if (failed) process.exitCode = 1;
