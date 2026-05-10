import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import { Track, Stanza } from '../types';

interface UploadedFile {
    key: string;
    url: string;
    size: number;
    uploaded: string;
}

const slugify = (s: string): string =>
    s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');

// Convert a free-form textarea into Stanza[] by splitting on blank lines.
const parseStanzas = (text: string): Stanza[] =>
    text
        .split(/\n\s*\n+/)
        .map(block => block.replace(/\s+$/g, '').replace(/^\s+/g, ''))
        .filter(block => block.length > 0)
        .map(block => ({ lines: block.split('\n') }));

// Convert Stanza[] back into a textarea-friendly string.
const stanzasToText = (stanzas: Stanza[]): string =>
    stanzas.map(s => s.lines.join('\n')).join('\n\n');

interface FormState {
    slug: string;
    title: string;
    openingLine: string;
    audioUrl: string;
    coverImage: string;
    duration: string;
    dedication: string;
    themes: string;
    aiNote: string;
    poemText: string;
}

const EMPTY_FORM: FormState = {
    slug: '',
    title: '',
    openingLine: '',
    audioUrl: '',
    coverImage: '',
    duration: '',
    dedication: '',
    themes: '',
    aiNote: '',
    poemText: '',
};

const trackToForm = (t: Track): FormState => ({
    slug: t.slug,
    title: t.title,
    openingLine: t.openingLine ?? '',
    audioUrl: t.audioUrl,
    coverImage: t.coverImage ?? '',
    duration: t.duration ?? '',
    dedication: t.dedication ?? '',
    themes: (t.themes ?? []).join(', '),
    aiNote: t.aiNote ?? '',
    poemText: stanzasToText(t.poem ?? []),
});

const formToTrack = (f: FormState): Track => {
    const poem = parseStanzas(f.poemText);
    const openingLine = f.openingLine.trim() || poem[0]?.lines[0] || '';
    return {
        id: f.slug,
        slug: f.slug,
        title: f.title.trim(),
        openingLine,
        audioUrl: f.audioUrl.trim(),
        coverImage: f.coverImage.trim() || undefined,
        duration: f.duration.trim() || undefined,
        dedication: f.dedication.trim() || undefined,
        themes: f.themes.split(',').map(s => s.trim()).filter(Boolean),
        aiNote: f.aiNote.trim() || undefined,
        releaseDate: new Date().toISOString().slice(0, 10),
        poem,
    };
};

const AdminPoetry: React.FC = () => {
    const [poems, setPoems] = useState<Track[]>([]);
    const [audioFiles, setAudioFiles] = useState<UploadedFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null); // slug being edited, or 'new'
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    // Auto-derive slug from title when creating a new poem and slug not manually edited.
    const [slugTouched, setSlugTouched] = useState(false);

    const refresh = async () => {
        setLoading(true);
        try {
            const [poemsRes, filesRes] = await Promise.all([
                fetch('/api/poems').then(r => r.json()),
                fetch('/api/upload-music').then(r => r.json()),
            ]);
            if (poemsRes?.ok) setPoems(poemsRes.poems || []);
            if (filesRes?.ok) {
                const audio = (filesRes.files || []).filter((f: UploadedFile) =>
                    /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(f.key)
                );
                setAudioFiles(audio);
            }
        } catch {
            setMessage({ type: 'err', text: 'Failed to load. Are you signed in?' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { refresh(); }, []);

    const startNew = () => {
        setForm(EMPTY_FORM);
        setSlugTouched(false);
        setEditing('new');
        setMessage(null);
    };

    const startEdit = (poem: Track) => {
        setForm(trackToForm(poem));
        setSlugTouched(true);
        setEditing(poem.slug);
        setMessage(null);
    };

    const cancelEdit = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setSlugTouched(false);
        setMessage(null);
    };

    const updateField = (field: keyof FormState, value: string) => {
        setForm(prev => {
            const next = { ...prev, [field]: value };
            if (field === 'title' && !slugTouched && editing === 'new') {
                next.slug = slugify(value);
            }
            return next;
        });
    };

    const save = async () => {
        if (!form.title.trim() || !form.audioUrl.trim() || !form.poemText.trim() || !form.slug.trim()) {
            setMessage({ type: 'err', text: 'Title, audio, slug, and the poem are all required.' });
            return;
        }
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/poems', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ poem: formToTrack(form) }),
            });
            const data = await res.json();
            if (data?.ok) {
                setMessage({ type: 'ok', text: 'Saved. It is live now.' });
                setEditing(null);
                setForm(EMPTY_FORM);
                setSlugTouched(false);
                await refresh();
            } else {
                setMessage({ type: 'err', text: data?.error || 'Save failed.' });
            }
        } catch {
            setMessage({ type: 'err', text: 'Save failed. Check your connection.' });
        } finally {
            setSaving(false);
        }
    };

    const remove = async (slug: string) => {
        if (!confirm('Delete this poem? This cannot be undone.')) return;
        try {
            await fetch(`/api/poems?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' });
            await refresh();
        } catch {
            setMessage({ type: 'err', text: 'Delete failed.' });
        }
    };

    const fieldLabel = 'font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold block mb-2';
    const fieldInput = 'w-full border border-wood-300 bg-white px-4 py-3 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-400';

    return (
        <AdminLayout>
            <section className="pt-12 pb-32 px-6">
                <div className="max-w-2xl mx-auto">
                    <h1 className="font-serif text-4xl text-wood-900 font-medium mb-2">Poetry</h1>
                    <p className="font-sans text-sm text-wood-500 mb-12">
                        {loading ? 'Loading...' : `${poems.length} poem${poems.length !== 1 ? 's' : ''} live on the site`}
                    </p>

                    {message && (
                        <div className={`mb-6 px-4 py-3 border ${
                            message.type === 'ok'
                                ? 'border-bronze-300 bg-bronze-50 text-bronze-800'
                                : 'border-red-300 bg-red-50 text-red-800'
                        } font-sans text-sm`}>
                            {message.text}
                        </div>
                    )}

                    {/* Editor */}
                    {editing && (
                        <div className="bg-white border border-wood-200 p-8 mb-10">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 font-semibold">
                                    {editing === 'new' ? 'New poem' : 'Editing'}
                                </h2>
                                <button
                                    onClick={cancelEdit}
                                    className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-400 hover:text-wood-700 font-semibold"
                                >
                                    Cancel
                                </button>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className={fieldLabel}>Title</label>
                                    <input
                                        type="text"
                                        value={form.title}
                                        onChange={e => updateField('title', e.target.value)}
                                        placeholder="First Light"
                                        className={fieldInput}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={fieldLabel}>Slug (URL)</label>
                                        <input
                                            type="text"
                                            value={form.slug}
                                            onChange={e => { setSlugTouched(true); updateField('slug', slugify(e.target.value)); }}
                                            placeholder="first-light"
                                            disabled={editing !== 'new'}
                                            className={`${fieldInput} ${editing !== 'new' ? 'bg-wood-50' : ''}`}
                                        />
                                    </div>
                                    <div>
                                        <label className={fieldLabel}>Duration (optional)</label>
                                        <input
                                            type="text"
                                            value={form.duration}
                                            onChange={e => updateField('duration', e.target.value)}
                                            placeholder="3:42"
                                            className={fieldInput}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={fieldLabel}>Audio file</label>
                                    {audioFiles.length === 0 ? (
                                        <p className="font-sans text-sm text-wood-500">
                                            No audio files yet. <a href="/admin/files" className="text-bronze-600 underline">Upload one first</a>.
                                        </p>
                                    ) : (
                                        <select
                                            value={form.audioUrl}
                                            onChange={e => updateField('audioUrl', e.target.value)}
                                            className={fieldInput}
                                        >
                                            <option value="">Choose a file...</option>
                                            {audioFiles.map(f => (
                                                <option key={f.key} value={f.url}>{f.key}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div>
                                    <label className={fieldLabel}>Cover image (Cloudinary public_id, optional)</label>
                                    <input
                                        type="text"
                                        value={form.coverImage}
                                        onChange={e => updateField('coverImage', e.target.value)}
                                        placeholder="adrian-website/poetry/first-light"
                                        className={fieldInput}
                                    />
                                </div>

                                <div>
                                    <label className={fieldLabel}>Dedication (optional, italic line under title)</label>
                                    <input
                                        type="text"
                                        value={form.dedication}
                                        onChange={e => updateField('dedication', e.target.value)}
                                        placeholder="a small fragment for the morning"
                                        className={fieldInput}
                                    />
                                </div>

                                <div>
                                    <label className={fieldLabel}>The poem</label>
                                    <p className="font-sans text-[11px] text-wood-400 mb-2">
                                        Separate stanzas with a blank line.
                                    </p>
                                    <textarea
                                        value={form.poemText}
                                        onChange={e => updateField('poemText', e.target.value)}
                                        rows={14}
                                        placeholder={`Before the morning knew its name,\nthe river had already begun.\n\nA small bird, a small fire,\na small reason to keep going.`}
                                        className={`${fieldInput} font-serif text-base leading-[1.7] resize-y`}
                                    />
                                </div>

                                <div>
                                    <label className={fieldLabel}>Opening line (optional, defaults to first line)</label>
                                    <input
                                        type="text"
                                        value={form.openingLine}
                                        onChange={e => updateField('openingLine', e.target.value)}
                                        placeholder="Before the morning knew its name"
                                        className={fieldInput}
                                    />
                                </div>

                                <div>
                                    <label className={fieldLabel}>Themes (comma-separated, optional)</label>
                                    <input
                                        type="text"
                                        value={form.themes}
                                        onChange={e => updateField('themes', e.target.value)}
                                        placeholder="Stillness, Beginning"
                                        className={fieldInput}
                                    />
                                </div>

                                <div>
                                    <label className={fieldLabel}>Honesty note (optional, shown small at the bottom)</label>
                                    <input
                                        type="text"
                                        value={form.aiNote}
                                        onChange={e => updateField('aiNote', e.target.value)}
                                        placeholder="Poem written by Adrian. Music co-created with AI as an instrument of voice."
                                        className={fieldInput}
                                    />
                                </div>

                                <button
                                    onClick={save}
                                    disabled={saving}
                                    className="w-full bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
                                >
                                    {saving ? 'Saving...' : editing === 'new' ? 'Publish poem' : 'Save changes'}
                                </button>
                            </div>
                        </div>
                    )}

                    {!editing && (
                        <button
                            onClick={startNew}
                            className="w-full bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors mb-10"
                        >
                            New poem
                        </button>
                    )}

                    {/* Existing poems */}
                    {!loading && poems.length > 0 && (
                        <div>
                            <h2 className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-4">All poems</h2>
                            <div className="space-y-2">
                                {poems.map(poem => (
                                    <div key={poem.slug} className="bg-white border border-wood-200 px-5 py-4 flex items-center gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-serif text-lg text-wood-900 truncate">{poem.title}</p>
                                            <p className="font-label text-[11px] text-wood-400 font-semibold mt-0.5 truncate">
                                                /{poem.slug}
                                                {poem.duration ? ` · ${poem.duration}` : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4 flex-shrink-0">
                                            <a
                                                href={`/poetry/${poem.slug}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 hover:text-bronze-600 font-semibold"
                                            >
                                                View
                                            </a>
                                            <button
                                                onClick={() => startEdit(poem)}
                                                className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 hover:text-bronze-600 font-semibold"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => remove(poem.slug)}
                                                className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-300 hover:text-red-500 font-semibold"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!loading && poems.length === 0 && !editing && (
                        <p className="font-sans text-sm text-wood-400 text-center py-8">
                            No poems published yet.
                        </p>
                    )}
                </div>
            </section>
        </AdminLayout>
    );
};

export default AdminPoetry;
