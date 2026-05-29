import React, { useState } from 'react';
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
  const { collections, isLoading, createCollection, deleteCollection, removeItem, renameCollection } =
    useCollections();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  if (isLoading) {
    return <p className="font-serif text-wood-700">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && newName.trim()) {
              await createCollection(newName.trim());
              setNewName('');
            }
          }}
          placeholder="New collection name"
          className="flex-1 font-serif text-base px-3 py-2 border border-wood-200 rounded bg-paper-50"
        />
        <button
          type="button"
          className="font-label text-[11px] uppercase tracking-[0.22em] px-4 py-2 bg-bronze-600 text-paper-50 rounded disabled:opacity-50"
          onClick={async () => {
            if (newName.trim()) {
              await createCollection(newName.trim());
              setNewName('');
            }
          }}
          disabled={!newName.trim()}
        >
          Create
        </button>
      </div>

      {collections.length === 0 ? (
        <p className="font-serif text-wood-700">
          You don't have any collections yet. Create one above, then save oracle cards, artworks, or products into it.
        </p>
      ) : (
        <ul className="space-y-6">
          {collections.map((c) => (
            <li key={c.id} className="border border-wood-200 rounded p-5">
              <header className="flex items-baseline justify-between mb-4">
                {editingId === c.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && editingName.trim()) {
                        await renameCollection(c.id, editingName.trim());
                        setEditingId(null);
                      }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={async () => {
                      if (editingName.trim() && editingName !== c.name) {
                        await renameCollection(c.id, editingName.trim());
                      }
                      setEditingId(null);
                    }}
                    autoFocus
                    className="font-display text-xl text-wood-900 bg-transparent border-b border-wood-300 outline-none"
                  />
                ) : (
                  <button
                    type="button"
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
                  className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500 hover:text-wood-900"
                  onClick={async () => {
                    if (window.confirm(`Delete the collection "${c.name}"?`)) {
                      await deleteCollection(c.id);
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
                          className="font-label text-[10px] uppercase tracking-[0.16em] text-wood-500 hover:text-wood-900 flex-shrink-0"
                          onClick={() => removeItem(c.id, item)}
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
