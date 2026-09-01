import React, { useState } from 'react';
import { useCollections, type CollectionItemKind } from '../../lib/collections/context';
import { useAccount } from '../../lib/account/useAccount';
import SignInTrigger from './SignInTrigger';

interface Props {
  kind: CollectionItemKind;
  /** The item reference id (card number, artwork id, or product id). */
  itemRef: string;
  /** Optional label override; defaults to "Save to collection". */
  label?: string;
}

/**
 * A small button that lets the visitor save the current artwork / card /
 * product into one of their collections. Hidden when accounts are
 * unavailable. Signed-out visitors see a sign-in prompt before the chooser.
 */
const SaveToCollectionButton: React.FC<Props> = ({ kind, itemRef, label = 'Save to collection' }) => {
  const account = useAccount();
  const { collections, createCollection, addItem } = useCollections();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');

  if (!account.available) return null;

  // Signed out: a single button that opens the sign-in modal.
  if (!account.isSignedIn) {
    return (
      <div className="stc">
        <SignInTrigger>
          <button type="button" className="stc__btn">{label}</button>
        </SignInTrigger>
        <style>{stcStyles}</style>
      </div>
    );
  }

  const handleAdd = async (collectionId: number) => {
    await addItem(collectionId, { kind, ref: itemRef });
    setOpen(false);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const created = await createCollection(name);
    if (created) await addItem(created.id, { kind, ref: itemRef });
    setNewName('');
    setOpen(false);
  };

  // Signed in: the collection chooser.
  return (
    <div className="stc">
      <button type="button" className="stc__btn" onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && (
        <div className="stc__menu">
          {collections.length === 0 ? (
            <p className="stc__menu-empty">No collections yet. Create your first one below.</p>
          ) : (
            <ul className="stc__menu-list">
              {collections.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="stc__menu-item"
                    onClick={() => handleAdd(c.id)}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="stc__create">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="New collection name"
              className="stc__input"
            />
            <button
              type="button"
              className="stc__create-btn"
              onClick={handleCreate}
              disabled={!newName.trim()}
            >
              Save
            </button>
          </div>
        </div>
      )}
      <style>{stcStyles}</style>
    </div>
  );
};

const stcStyles = `
  .stc { position: relative; display: inline-block; }
  .stc__btn {
    font-family: var(--font-label);
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--color-bronze-600);
    background: transparent;
    border: 1px solid color-mix(in oklab, var(--color-bronze-600) 35%, transparent);
    border-radius: 3px;
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.2s;
  }
  .stc__btn:hover {
    background: color-mix(in oklab, var(--color-bronze-400) 8%, transparent);
  }
  .stc__menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 15;
    width: 240px;
    background: var(--color-paper-50);
    border: 1px solid color-mix(in oklab, var(--color-wood-600) 22%, transparent);
    border-radius: 3px;
    padding: 8px;
    box-shadow: 0 8px 24px -10px rgba(0,0,0,0.18);
  }
  .stc__menu-empty {
    font-family: 'Cormorant Garamond', serif;
    font-size: 13px;
    color: var(--color-wood-600);
    margin: 4px 6px 8px;
  }
  .stc__menu-list { list-style: none; padding: 0; margin: 0 0 8px; }
  .stc__menu-item {
    display: block;
    width: 100%;
    text-align: left;
    font-family: 'Cormorant Garamond', serif;
    font-size: 15px;
    color: var(--color-wood-900);
    background: transparent;
    border: 0;
    padding: 6px 8px;
    cursor: pointer;
    border-radius: 2px;
  }
  .stc__menu-item:hover { background: color-mix(in oklab, var(--color-bronze-400) 10%, transparent); }
  .stc__create {
    display: flex;
    gap: 6px;
    padding-top: 8px;
    border-top: 1px solid color-mix(in oklab, var(--color-wood-600) 12%, transparent);
  }
  .stc__input {
    flex: 1;
    font-family: 'Cormorant Garamond', serif;
    font-size: 14px;
    padding: 6px 8px;
    border: 1px solid color-mix(in oklab, var(--color-wood-600) 22%, transparent);
    border-radius: 2px;
    background: var(--color-paper-50);
  }
  .stc__create-btn {
    font-family: var(--font-label);
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-paper-50);
    background: var(--color-bronze-600);
    border: 0;
    border-radius: 2px;
    padding: 6px 10px;
    cursor: pointer;
  }
  .stc__create-btn:disabled { opacity: 0.5; cursor: not-allowed; }
`;

export default SaveToCollectionButton;
