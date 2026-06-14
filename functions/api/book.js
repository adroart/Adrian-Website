/**
 * GET    /api/book            — list all book entries (BookContent[]). Public.
 * GET    /api/book?id=...     — one entry by piece id, or 404. Public.
 * POST   /api/book            — upsert an entry by id. Body: { entry: BookContent }. Auth: admin_session cookie.
 * DELETE /api/book?id=...     — remove an entry. Auth: admin_session cookie.
 *
 * Storage: a single `book/index.json` object in the existing R2 bucket (MUSIC_BUCKET).
 * Mirrors functions/api/poems.js — same auth model, same store.
 */

const COOKIE_NAME = 'admin_session';
const KEY = 'book/index.json';

function getCookie(request, name) {
    const header = request.headers.get('Cookie') || '';
    const match = header.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`));
    return match ? match.slice(name.length + 1) : null;
}

function isAuthed(request, env) {
    return getCookie(request, COOKIE_NAME) === env.UPLOAD_SECRET;
}

async function readEntries(env) {
    const obj = await env.MUSIC_BUCKET.get(KEY);
    if (!obj) return [];
    try {
        const parsed = JSON.parse(await obj.text());
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeEntries(env, entries) {
    await env.MUSIC_BUCKET.put(KEY, JSON.stringify(entries, null, 2), {
        httpMetadata: { contentType: 'application/json' },
    });
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// Normalise an array-of-strings field: accept array or newline string, drop blanks.
function toParagraphs(value) {
    if (Array.isArray(value)) return value.map(s => String(s).trim()).filter(Boolean);
    if (typeof value === 'string') {
        return value.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);
    }
    return [];
}

function cleanString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isValidEntry(e) {
    if (!e || typeof e !== 'object') return false;
    if (typeof e.id !== 'string' || !e.id.trim()) return false;
    return true;
}

// Keep only known fields; coerce shapes. Prevents arbitrary blobs in the store.
function sanitise(e) {
    const out = {
        id: e.id.trim(),
        title: cleanString(e.title),
        epigraph: cleanString(e.epigraph),
        body: toParagraphs(e.body),
        makersNote: toParagraphs(e.makersNote),
        materialsStory: cleanString(e.materialsStory),
        inspiration: cleanString(e.inspiration),
        updatedAt: new Date().toISOString().slice(0, 10),
    };
    // Drop empty optionals so stored JSON stays lean.
    if (!out.title) delete out.title;
    if (!out.epigraph) delete out.epigraph;
    if (!out.body.length) delete out.body;
    if (!out.makersNote.length) delete out.makersNote;
    if (!out.materialsStory) delete out.materialsStory;
    if (!out.inspiration) delete out.inspiration;
    return out;
}

export async function onRequestGet({ request, env }) {
    const entries = await readEntries(env);
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
        const entry = entries.find(e => e.id === id);
        return entry ? json({ ok: true, entry }) : json({ ok: false, error: 'Not found' }, 404);
    }
    return json({ ok: true, entries });
}

export async function onRequestPost({ request, env }) {
    if (!isAuthed(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

    let body;
    try {
        body = await request.json();
    } catch {
        return json({ ok: false, error: 'Invalid JSON' }, 400);
    }

    const entry = body?.entry;
    if (!isValidEntry(entry)) return json({ ok: false, error: 'Invalid entry (id required)' }, 400);

    const incoming = sanitise(entry);
    const entries = await readEntries(env);
    const idx = entries.findIndex(e => e.id === incoming.id);
    if (idx >= 0) entries[idx] = incoming;
    else entries.push(incoming);

    await writeEntries(env, entries);
    return json({ ok: true, entry: incoming });
}

export async function onRequestDelete({ request, env }) {
    if (!isAuthed(request, env)) return json({ ok: false, error: 'Unauthorized' }, 401);

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ ok: false, error: 'Missing id' }, 400);

    const entries = await readEntries(env);
    await writeEntries(env, entries.filter(e => e.id !== id));
    return json({ ok: true });
}
