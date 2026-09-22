/** Whole-object indexes use conditional R2 writes so concurrent editors cannot
 * erase one another's unrelated entries. Corruption is never an empty index. */
export async function readR2JsonIndex(bucket, key) {
  if (!bucket) throw new Error('index_storage_unavailable');
  const object = await bucket.get(key);
  if (!object) return { entries: [], etag: null };
  let entries;
  try { entries = JSON.parse(await object.text()); } catch { throw new Error('index_corrupt'); }
  if (!Array.isArray(entries)) throw new Error('index_corrupt');
  if (typeof object.etag !== 'string' || !object.etag) throw new Error('index_version_unavailable');
  return { entries, etag: object.etag };
}

export async function updateR2JsonIndex(bucket, key, update) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { entries, etag } = await readR2JsonIndex(bucket, key);
    const next = update(entries);
    const result = await bucket.put(key, JSON.stringify(next, null, 2), {
      httpMetadata: { contentType: 'application/json' },
      onlyIf: etag === null ? { etagDoesNotMatch: '*' } : { etagMatches: etag },
    });
    if (result) return;
  }
  throw new Error('index_conflict');
}

export function withIndexErrors(handler) {
  return async (context) => {
    try { return await handler(context); } catch (error) {
      const known = ['index_corrupt', 'index_conflict', 'index_storage_unavailable', 'index_version_unavailable'];
      const code = known.includes(error?.message) ? error.message : 'index_storage_unavailable';
      return new Response(JSON.stringify({ ok: false, error: code }), {
        status: code === 'index_conflict' ? 409 : 503,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }
  };
}
