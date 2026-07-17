import React, { useEffect, useMemo, useState } from 'react';
import { BookContent, Artwork } from '../types';
import { FULL_ARCHIVE } from '../data/mockData';

// The book page is the permanent works record at /works/:id. Here Adrian
// writes the long-form text for each piece himself. Content is stored
// server-side (/api/book) and rendered beneath the certificate on the
// works page. Mirrors AdminPoetry's editor pattern.

interface FormState {
    id: string;
    epigraph: string;
    body: string;          // paragraphs separated by blank lines
    makersNote: string;    // paragraphs separated by blank lines
    materialsStory: string;
    inspiration: string;
}

const EMPTY_FORM: FormState = {
    id: '',
    epigraph: '',
    body: '',
    makersNote: '',
    materialsStory: '',
    inspiration: '',
};

const paragraphsToText = (p?: string[]): string => (p ?? []).join('\n\n');

const entryToForm = (e: BookContent): FormState => ({
    id: e.id,
    epigraph: e.epigraph ?? '',
    body: paragraphsToText(e.body),
    makersNote: paragraphsToText(e.makersNote),
    materialsStory: e.materialsStory ?? '',
    inspiration: e.inspiration ?? '',
});

const formToEntry = (f: FormState, title?: string): BookContent => ({
    id: f.id,
    title,
    epigraph: f.epigraph.trim() || undefined,
    body: f.body.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean),
    makersNote: f.makersNote.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean),
    materialsStory: f.materialsStory.trim() || undefined,
    inspiration: f.inspiration.trim() || undefined,
});

const AdminBookEditor: React.FC = () => {
    const [entries, setEntries] = useState<BookContent[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<string | null>(null); // piece id being edited, or null
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

    // Every piece in the archive, sorted by title, with its current entry (if any).
    const pieces = useMemo(() => {
        const byId = new Map(entries.map(e => [e.id, e]));
        return [...FULL_ARCHIVE]
            .sort((a, b) => a.title.localeCompare(b.title))
            .map(art => ({ art, entry: byId.get(art.id) }));
    }, [entries]);

    const artById = useMemo(() => {
        const m = new Map<string, Artwork>();
        FULL_ARCHIVE.forEach(a => m.set(a.id, a));
        return m;
    }, []);

    const written = pieces.filter(p => p.entry);
    const unwritten = pieces.filter(p => !p.entry);

    const refresh = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/book').then(r => r.json());
            if (res?.ok) setEntries(res.entries || []);
        } catch {
            setMessage({ type: 'err', text: 'Failed to load. Are you signed in?' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { refresh(); }, []);

    const startEdit = (id: string) => {
        const existing = entries.find(e => e.id === id);
        setForm(existing ? entryToForm(existing) : { ...EMPTY_FORM, id });
        setEditing(id);
        setMessage(null);
    };

    const cancelEdit = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setMessage(null);
    };

    const updateField = (field: keyof FormState, value: string) =>
        setForm(prev => ({ ...prev, [field]: value }));

    const save = async () => {
        if (!form.id) {
            setMessage({ type: 'err', text: 'Pick a piece first.' });
            return;
        }
        const title = artById.get(form.id)?.title;
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/book', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entry: formToEntry(form, title) }),
            });
            const data = await res.json();
            if (data?.ok) {
                setMessage({ type: 'ok', text: 'Saved. It is live now.' });
                setEditing(null);
                setForm(EMPTY_FORM);
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

    const remove = async (id: string) => {
        if (!confirm('Clear the written page for this piece? The piece record stays; only your text is removed.')) return;
        try {
            await fetch(`/api/book?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
            await refresh();
        } catch {
            setMessage({ type: 'err', text: 'Delete failed.' });
        }
    };

    const fieldLabel = 'font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold block mb-2';
    const fieldInput = 'w-full border border-wood-300 bg-white px-4 py-3 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-400';
    const proseArea = `${fieldInput} font-serif text-base leading-[1.7] resize-y`;

    const editingArt = editing ? artById.get(editing) : undefined;

    return (
        <section className="pt-12 pb-32 px-6">
                <div className="max-w-2xl mx-auto">
                    <h1 className="font-serif text-4xl text-wood-900 font-medium mb-2">Book Pages</h1>
                    <p className="font-sans text-sm text-wood-500 mb-12">
                        {loading
                            ? 'Loading...'
                            : `${written.length} of ${pieces.length} pieces have a written page`}
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
                    {editing && editingArt && (
                        <div className="bg-white border border-wood-200 p-8 mb-10">
                            <div className="flex items-center justify-between mb-1">
                                <h2 className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 font-semibold">
                                    Writing the page for
                                </h2>
                                <button
                                    onClick={cancelEdit}
                                    className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-400 hover:text-wood-700 font-semibold"
                                >
                                    Cancel
                                </button>
                            </div>
                            <p className="font-serif text-2xl text-wood-900 mb-1">{editingArt.title}</p>
                            <p className="font-label text-[11px] text-wood-400 font-semibold mb-6">
                                {editingArt.series ? `${editingArt.series} · ` : ''}/works/{editingArt.id}
                            </p>

                            <div className="space-y-5">
                                <div>
                                    <label className={fieldLabel}>Epigraph (optional, a single line set apart above the writing)</label>
                                    <input
                                        type="text"
                                        value={form.epigraph}
                                        onChange={e => updateField('epigraph', e.target.value)}
                                        placeholder="A door is also a kind of question."
                                        className={fieldInput}
                                    />
                                </div>

                                <div>
                                    <label className={fieldLabel}>The writing</label>
                                    <p className="font-sans text-[11px] text-wood-400 mb-2">
                                        The main body of the page. Separate paragraphs with a blank line.
                                    </p>
                                    <textarea
                                        value={form.body}
                                        onChange={e => updateField('body', e.target.value)}
                                        rows={14}
                                        placeholder={`This piece began as a single line drawn at dawn...\n\nOver the weeks it became something else entirely.`}
                                        className={proseArea}
                                    />
                                </div>

                                <div>
                                    <label className={fieldLabel}>From the studio (optional)</label>
                                    <p className="font-sans text-[11px] text-wood-400 mb-2">
                                        Process, intention, the making of it. Separate paragraphs with a blank line.
                                    </p>
                                    <textarea
                                        value={form.makersNote}
                                        onChange={e => updateField('makersNote', e.target.value)}
                                        rows={8}
                                        placeholder={`The wood was reclaimed from...`}
                                        className={proseArea}
                                    />
                                </div>

                                <div>
                                    <label className={fieldLabel}>Materials story (optional, a sentence or two)</label>
                                    <textarea
                                        value={form.materialsStory}
                                        onChange={e => updateField('materialsStory', e.target.value)}
                                        rows={3}
                                        placeholder="Hand-carved oak, brass leaf, and a single point of light."
                                        className={proseArea}
                                    />
                                </div>

                                <div>
                                    <label className={fieldLabel}>What it reaches toward (optional, a sentence or two)</label>
                                    <textarea
                                        value={form.inspiration}
                                        onChange={e => updateField('inspiration', e.target.value)}
                                        rows={3}
                                        placeholder="A reminder that stillness and motion are the same gesture, slowed down."
                                        className={proseArea}
                                    />
                                </div>

                                <button
                                    onClick={save}
                                    disabled={saving}
                                    className="w-full bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
                                >
                                    {saving ? 'Saving...' : 'Save page'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Pieces still needing a page */}
                    {!editing && !loading && (
                        <div className="mb-10">
                            <label className={fieldLabel}>Write a page for a piece</label>
                            <select
                                value=""
                                onChange={e => e.target.value && startEdit(e.target.value)}
                                className={fieldInput}
                            >
                                <option value="">Choose a piece...</option>
                                <optgroup label="Not yet written">
                                    {unwritten.map(({ art }) => (
                                        <option key={art.id} value={art.id}>{art.title}</option>
                                    ))}
                                </optgroup>
                                {written.length > 0 && (
                                    <optgroup label="Already written">
                                        {written.map(({ art }) => (
                                            <option key={art.id} value={art.id}>{art.title}</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>
                    )}

                    {/* Written pages */}
                    {!loading && written.length > 0 && (
                        <div>
                            <h2 className="font-label text-xs uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-4">
                                Written pages
                            </h2>
                            <div className="space-y-2">
                                {written.map(({ art, entry }) => (
                                    <div key={art.id} className="bg-white border border-wood-200 px-5 py-4 flex items-center gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-serif text-lg text-wood-900 truncate">{art.title}</p>
                                            <p className="font-label text-[11px] text-wood-400 font-semibold mt-0.5 truncate">
                                                {art.series ? `${art.series} · ` : ''}
                                                {entry?.body?.length ? `${entry.body.length} paragraph${entry.body.length !== 1 ? 's' : ''}` : 'no body yet'}
                                                {entry?.updatedAt ? ` · ${entry.updatedAt}` : ''}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4 flex-shrink-0">
                                            <a
                                                href={`/works/${art.id}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 hover:text-bronze-600 font-semibold"
                                            >
                                                View
                                            </a>
                                            <button
                                                onClick={() => startEdit(art.id)}
                                                className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 hover:text-bronze-600 font-semibold"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => remove(art.id)}
                                                className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-300 hover:text-red-500 font-semibold"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {!loading && written.length === 0 && !editing && (
                        <p className="font-sans text-sm text-wood-400 text-center py-8">
                            No pages written yet. Pick a piece above to begin.
                        </p>
                    )}
                </div>
        </section>
    );
};

export default AdminBookEditor;
