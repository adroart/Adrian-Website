/**
 * GET    /api/poems            — list all poems (Track[]). Public.
 * POST   /api/poems            — upsert a poem by slug. Body: { poem: Track }. Auth: admin_session cookie.
 * DELETE /api/poems?slug=...   — remove a poem. Auth: admin_session cookie.
 *
 * Storage: a single `poems/index.json` object in the existing R2 audio bucket (MUSIC_BUCKET).
 */

import { isAdminAuthed } from './_lib/admin.js';

const KEY = 'poems/index.json';

async function readPoems(env) {
    const obj = await env.MUSIC_BUCKET.get(KEY);
    if (!obj) return [];
    try {
        const text = await obj.text();
        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writePoems(env, poems) {
    await env.MUSIC_BUCKET.put(KEY, JSON.stringify(poems, null, 2), {
        httpMetadata: { contentType: 'application/json' },
    });
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

function isValidPoem(p) {
    if (!p || typeof p !== 'object') return false;
    if (typeof p.slug !== 'string' || !p.slug.match(/^[a-z0-9-]+$/)) return false;
    if (typeof p.title !== 'string' || p.title.length === 0) return false;
    if (typeof p.audioUrl !== 'string' || p.audioUrl.length === 0) return false;
    if (!Array.isArray(p.poem)) return false;
    return true;
}

export async function onRequestGet({ env }) {
    const poems = await readPoems(env);
    return json({ ok: true, poems });
}

export async function onRequestPost({ request, env }) {
    if (!(await isAdminAuthed(request, env))) return json({ ok: false, error: 'Unauthorized' }, 401);

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

    const poems = await readPoems(env);
    const idx = poems.findIndex(p => p.slug === incoming.slug);
    if (idx >= 0) poems[idx] = incoming;
    else poems.unshift(incoming);

    await writePoems(env, poems);
    return json({ ok: true, poem: incoming });
}

export async function onRequestDelete({ request, env }) {
    if (!(await isAdminAuthed(request, env))) return json({ ok: false, error: 'Unauthorized' }, 401);

    const slug = new URL(request.url).searchParams.get('slug');
    if (!slug) return json({ ok: false, error: 'Missing slug' }, 400);

    const poems = await readPoems(env);
    const next = poems.filter(p => p.slug !== slug);
    await writePoems(env, next);
    return json({ ok: true });
}
