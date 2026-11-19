import React, { useRef, useState } from 'react';
import AccountLayout from './AccountLayout';
import { useCollections, type CollectionItem } from '../../lib/collections/context';
import { Link } from 'react-router-dom';

const itemLabel = (item: CollectionItem): string => {
  if (item.kind === 'artwork') return `Artwork · ${item.ref}`;
  if (item.kind === 'product') return `Product · ${item.ref}`;
  // Legacy 'card' items from when the oracle deck lived on this site.
  // The deck now lives at mandalacodes.com; saved entries persist as
  // history but no longer link.
  return `Oracle card · ${item.ref}`;
};

const itemLink = (item: CollectionItem): string | null => {
  if (item.kind === 'artwork') return `/creations/${item.ref}`;
  if (item.kind === 'product') return '/shop';
  return null;
};

const CollectionsManagerInner: React.FC = () => {
  const { collections, isLoading, loadFailed, reload, createCollection, deleteCollection, removeItem, renameCollection } =
    useCollections();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async (action: () => Promise<void>, error: string) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setSaveError(null);
    try {
      await action();
    } catch {
      setSaveError(error);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  if (isLoading) {
    return <p className="font-serif text-wood-700">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      {loadFailed && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-wood-800">
          <span>Could not load your collections.</span>
          <button type="button" className="underline" onClick={reload}>Try again</button>
        </div>
      )}
      {saveError && <p role="alert" className="text-wood-800">{saveError}</p>}
      <form className="flex gap-3" onSubmit={(event) => {
        event.preventDefault();
        const name = newName.trim();
        if (busy || loadFailed || !name) return;
        void save(async () => {
          await createCollection(name);
          setNewName('');
        }, 'Could not create the collection. Try again.');
      }}>
        <input
          type="text"
          aria-label="New collection name"
          disabled={busy}
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder="New collection name"
          maxLength={80}
          className="flex-1 min-w-0 font-serif text-base px-3 py-2 border border-wood-200 rounded bg-paper-50"
        />
        <button
          type="submit"
          className="font-label text-label uppercase tracking-[0.22em] px-4 py-2 bg-bronze-600 text-paper-50 rounded disabled:opacity-50"
          disabled={busy || loadFailed || !newName.trim()}
        >
          Create
        </button>
      </form>

      {collections.length === 0 ? (
        !loadFailed && (
          <p className="font-serif text-wood-700">
            You don’t have any collections yet. Create one, then save artworks or products to it.
          </p>
        )
      ) : (
        <ul className="space-y-6">
          {collections.map((c) => (
            <li key={c.id} className="border border-wood-200 rounded p-5">
              <header className="flex flex-wrap items-baseline justify-between gap-3 mb-4">
                {editingId === c.id ? (
                  <form className="flex min-w-0 flex-wrap items-center gap-2" onSubmit={(event) => {
                    event.preventDefault();
                    const name = editingName.trim();
                    if (busy || loadFailed || !name) return;
                    void save(async () => {
                      await renameCollection(c.id, name);
                      setEditingId(null);
                    }, 'Could not rename the collection. Try again.');
                  }}>
                    <input
                      type="text"
                      aria-label="Collection name"
                      disabled={busy}
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Escape') setEditingId(null); }}
                      maxLength={80}
                      autoFocus
                      className="min-w-0 w-full sm:w-auto font-display text-xl text-wood-900 bg-transparent border-b border-wood-300"
                    />
                    <button type="submit" disabled={busy || loadFailed || !editingName.trim()} className="text-sm underline">Save name</button>
                    <button type="button" onClick={() => setEditingId(null)} disabled={busy} className="text-sm underline">Cancel</button>
                  </form>
                ) : (
                  <button
                    type="button"
                    disabled={busy || loadFailed}
                    onClick={() => {
                      setEditingId(c.id);
                      setEditingName(c.name);
                    }}
                    className="font-display text-xl text-wood-900 text-left hover:text-bronze-600"
                  >
                    {c.name}
                  </button>
                )}
                <button
                  type="button"
                  className="font-label text-micro uppercase tracking-[0.18em] text-wood-500 hover:text-wood-900"
                  disabled={busy || loadFailed}
                  onClick={() => {
                    if (window.confirm(`Delete the collection "${c.name}"?`)) {
                      void save(() => deleteCollection(c.id), 'Could not delete the collection. Try again.');
                    }
                  }}
                >
                  Delete
                </button>
              </header>
              {c.items.length === 0 ? (
                <p className="font-serif text-sm text-wood-600 italic">No items yet.</p>
              ) : (
                <ul className="grid sm:grid-cols-2 gap-2">
                  {c.items.map((item) => {
                    const link = itemLink(item);
                    return (
                      <li key={`${item.kind}_${item.ref}`} className="flex items-center justify-between gap-3 text-sm">
                        {link ? (
                          <Link
                            to={link}
                            className="font-serif text-wood-800 hover:text-bronze-600 truncate"
                          >
                            {itemLabel(item)}
                          </Link>
                        ) : (
                          <span className="font-serif text-wood-500 italic truncate" title="The oracle deck moved to mandalacodes.com">
                            {itemLabel(item)}
                          </span>
                        )}
                        <button
                          type="button"
                          className="font-label text-micro uppercase tracking-[0.16em] text-wood-500 hover:text-wood-900 flex-shrink-0"
                          disabled={busy || loadFailed}
                          onClick={() => void save(() => removeItem(c.id, item), 'Could not remove the item. Try again.')}
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const CollectionsManager: React.FC = () => (
  <AccountLayout title="Your collections">
    <CollectionsManagerInner />
  </AccountLayout>
);

export default CollectionsManager;
