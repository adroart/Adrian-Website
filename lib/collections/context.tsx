import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAccount } from '../account/useAccount';

export type CollectionItemKind = 'card' | 'artwork' | 'product';

export interface CollectionItem {
  kind: CollectionItemKind;
  ref: string;
}

export interface Collection {
  id: number;
  name: string;
  createdAt: string;
  items: CollectionItem[];
}

interface CollectionsContextValue {
  collections: Collection[];
  isLoading: boolean;
  /** True only when accounts are configured. SaveToCollectionButton uses this
   * to short-circuit and trigger Clerk sign-in flow. */
  available: boolean;
  reload: () => Promise<void>;
  createCollection: (name: string) => Promise<Collection | null>;
  renameCollection: (id: number, name: string) => Promise<void>;
  deleteCollection: (id: number) => Promise<void>;
  addItem: (collectionId: number, item: CollectionItem) => Promise<void>;
  removeItem: (collectionId: number, item: CollectionItem) => Promise<void>;
}

const stub: CollectionsContextValue = {
  collections: [],
  isLoading: false,
  available: false,
  reload: async () => undefined,
  createCollection: async () => null,
  renameCollection: async () => undefined,
  deleteCollection: async () => undefined,
  addItem: async () => undefined,
  removeItem: async () => undefined,
};

const CollectionsContext = createContext<CollectionsContextValue>(stub);

export const CollectionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const account = useAccount();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setLoading] = useState(false);
  const loadedFor = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (!account.available || !account.isSignedIn) {
      setCollections([]);
      return;
    }
    setLoading(true);
    try {
      const res = await account.fetchAuthed('/api/collections/list');
      const data = res.ok ? await res.json() : [];
      setCollections(Array.isArray(data) ? data : []);
    } catch {
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    if (!account.isLoaded) return;
    const tag = account.isSignedIn ? account.userId : 'guest';
    if (loadedFor.current === tag) return;
    loadedFor.current = tag;
    reload();
  }, [account.isLoaded, account.isSignedIn, account.userId, reload]);

  const createCollection = useCallback(async (name: string) => {
    if (!account.available || !account.isSignedIn) return null;
    const res = await account.fetchAuthed('/api/collections/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return null;
    const created = (await res.json()) as Collection;
    setCollections((c) => [...c, created]);
    return created;
  }, [account]);

  const renameCollection = useCallback(async (id: number, name: string) => {
    if (!account.available || !account.isSignedIn) return;
    await account.fetchAuthed('/api/collections/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    });
    setCollections((c) => c.map((col) => (col.id === id ? { ...col, name } : col)));
  }, [account]);

  const deleteCollection = useCallback(async (id: number) => {
    if (!account.available || !account.isSignedIn) return;
    await account.fetchAuthed('/api/collections/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setCollections((c) => c.filter((col) => col.id !== id));
  }, [account]);

  const addItem = useCallback(async (collectionId: number, item: CollectionItem) => {
    if (!account.available || !account.isSignedIn) return;
    await account.fetchAuthed('/api/collections/add-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId, ...item }),
    });
    setCollections((c) =>
      c.map((col) =>
        col.id === collectionId
          ? {
              ...col,
              items: col.items.some((i) => i.kind === item.kind && i.ref === item.ref)
                ? col.items
                : [...col.items, item],
            }
          : col,
      ),
    );
  }, [account]);

  const removeItem = useCallback(async (collectionId: number, item: CollectionItem) => {
    if (!account.available || !account.isSignedIn) return;
    await account.fetchAuthed('/api/collections/remove-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId, ...item }),
    });
    setCollections((c) =>
      c.map((col) =>
        col.id === collectionId
          ? { ...col, items: col.items.filter((i) => !(i.kind === item.kind && i.ref === item.ref)) }
          : col,
      ),
    );
  }, [account]);

  const value = useMemo<CollectionsContextValue>(
    () => ({
      collections,
      isLoading,
      available: account.available,
      reload,
      createCollection,
      renameCollection,
      deleteCollection,
      addItem,
      removeItem,
    }),
    [
      collections,
      isLoading,
      account.available,
      reload,
      createCollection,
      renameCollection,
      deleteCollection,
      addItem,
      removeItem,
    ],
  );

  return <CollectionsContext.Provider value={value}>{children}</CollectionsContext.Provider>;
};

export function useCollections() {
  return useContext(CollectionsContext);
}
