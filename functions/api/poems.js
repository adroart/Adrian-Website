/**
 * GET    /api/poems            — list all poems (Track[]). Public.
 * POST   /api/poems            — upsert a poem by slug. Body: { poem: Track }. Admin only.
 * DELETE /api/poems?slug=...   — remove a poem. Admin only.
 *
 * Storage: a single `poems/index.json` object in the existing R2 audio bucket (MUSIC_BUCKET).
 */

import { jsonResponse, requireAdmin } from './_lib/admin.js';
import { readR2JsonIndex, updateR2JsonIndex, withIndexErrors } from './_lib/r2JsonIndex.js';

const KEY = 'poems/index.json';

async function readPoems(env) {
    return (await readR2JsonIndex(env.MUSIC_BUCKET, KEY)).entries;
}

const json = jsonResponse;

function isValidPoem(p) {
    if (!p || typeof p !== 'object') return false;
    if (typeof p.slug !== 'string' || !p.slug.match(/^[a-z0-9-]+$/)) return false;
    if (typeof p.title !== 'string' || p.title.length === 0) return false;
    if (typeof p.audioUrl !== 'string' || p.audioUrl.length === 0) return false;
    if (!Array.isArray(p.poem)) return false;
    return true;
}

async function handleGet({ env }) {
    const poems = await readPoems(env);
    return json({ ok: true, poems });
}

async function handlePost({ request, env }) {
    const unauthorized = await requireAdmin(request, env);
    if (unauthorized) return unauthorized;

    let body;
    try {
        body = await request.json();
    } catch {
        return json({ ok: false, error: 'Invalid JSON' }, 400);
    }

    const poem = body?.poem;
    if (!isValidPoem(poem)) return json({ ok: false, error: 'Invalid poem' }, 400);

    const incoming = {
        ...poem,
        id: poem.id || poem.slug,
        releaseDate: poem.releaseDate || new Date().toISOString().slice(0, 10),
    };

    await updateR2JsonIndex(env.MUSIC_BUCKET, KEY, (entries) => {
        const idx = entries.findIndex(entry => entry.slug === incoming.slug);
        if (idx >= 0) entries[idx] = incoming;
        else entries.unshift(incoming);
        return entries;
    });
    return json({ ok: true, poem: incoming });
}

async function handleDelete({ request, env }) {
    const unauthorized = await requireAdmin(request, env);
    if (unauthorized) return unauthorized;

    const slug = new URL(request.url).searchParams.get('slug');
    if (!slug) return json({ ok: false, error: 'Missing slug' }, 400);

    await updateR2JsonIndex(env.MUSIC_BUCKET, KEY, entries => entries.filter(entry => entry.slug !== slug));
    return json({ ok: true });
}

export const onRequestGet = withIndexErrors(handleGet);
export const onRequestPost = withIndexErrors(handlePost);
export const onRequestDelete = withIndexErrors(handleDelete);
