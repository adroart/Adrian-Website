/**
 * GET    /api/book            — list all book entries (BookContent[]). Public.
 * GET    /api/book?id=...     — one entry by piece id, or 404. Public.
 * POST   /api/book            — upsert an entry by id. Body: { entry: BookContent }. Admin only.
 * DELETE /api/book?id=...     — remove an entry. Admin only.
 *
 * Storage: a single `book/index.json` object in the existing R2 bucket (MUSIC_BUCKET).
 * Mirrors functions/api/poems.js — same auth model, same store.
 */

import { jsonResponse, requireAdmin } from './_lib/admin.js';
import { readR2JsonIndex, updateR2JsonIndex, withIndexErrors } from './_lib/r2JsonIndex.js';

const KEY = 'book/index.json';

async function readEntries(env) {
    return (await readR2JsonIndex(env.MUSIC_BUCKET, KEY)).entries;
}

const json = jsonResponse;

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

async function handleGet({ request, env }) {
    const entries = await readEntries(env);
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
        const entry = entries.find(e => e.id === id);
        return entry ? json({ ok: true, entry }) : json({ ok: false, error: 'Not found' }, 404);
    }
    return json({ ok: true, entries });
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

    const entry = body?.entry;
    if (!isValidEntry(entry)) return json({ ok: false, error: 'Invalid entry (id required)' }, 400);

    const incoming = sanitise(entry);
    await updateR2JsonIndex(env.MUSIC_BUCKET, KEY, (entries) => {
        const idx = entries.findIndex(entry => entry.id === incoming.id);
        if (idx >= 0) entries[idx] = incoming;
        else entries.push(incoming);
        return entries;
    });
    return json({ ok: true, entry: incoming });
}

async function handleDelete({ request, env }) {
    const unauthorized = await requireAdmin(request, env);
    if (unauthorized) return unauthorized;

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return json({ ok: false, error: 'Missing id' }, 400);

    await updateR2JsonIndex(env.MUSIC_BUCKET, KEY, entries => entries.filter(entry => entry.id !== id));
    return json({ ok: true });
}

export const onRequestGet = withIndexErrors(handleGet);
export const onRequestPost = withIndexErrors(handlePost);
export const onRequestDelete = withIndexErrors(handleDelete);
