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
  loadFailed: boolean;
  /** True only when accounts are configured. SaveToCollectionButton uses this
   * to short-circuit and trigger the account sign-in flow. */
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
  loadFailed: false,
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
  const { available, isLoaded, isSignedIn, userId, fetchAuthed } = useAccount();
  const owner = available && isSignedIn ? userId : null;
  // A distinct scope also rejects an old response after signing out and back in.
  const scope = useMemo(() => ({ owner }), [owner]);
  const currentOwner = useRef(scope);
  currentOwner.current = scope;
  const operationQueue = useMemo(() => ({ current: Promise.resolve() as Promise<void> }), [scope]);
  const enqueue = useCallback(<T,>(action: () => Promise<T>): Promise<T> => {
    const result = operationQueue.current.then(action);
    operationQueue.current = result.then(() => undefined, () => undefined);
    return result;
  }, [operationQueue]);
  const newestLoad = useRef(0);
  const [snapshot, setSnapshot] = useState<{
    owner: string; scope: typeof scope; collections: Collection[]; loading: boolean; failed: boolean;
  } | null>(null);
  const current = owner && snapshot?.scope === scope ? snapshot : null;
  const collections = current?.collections ?? stub.collections;
  const isLoading = !!owner && (current?.loading ?? true);
  const loadFailed = current?.failed ?? false;

  const reload = useCallback(() => enqueue(async () => {
    if (!owner || currentOwner.current !== scope) return;
    const requestId = ++newestLoad.current;
    setSnapshot((previous) => ({
      owner,
      scope,
      collections: previous?.scope === scope ? previous.collections : [],
      loading: true,
      failed: false,
    }));
    try {
      const res = await fetchAuthed('/api/collections/list');
      if (!res.ok) throw new Error('collections load failed');
      const data: unknown = await res.json();
      if (!Array.isArray(data)) throw new Error('unexpected collections response');
      if (currentOwner.current === scope && requestId === newestLoad.current) {
        setSnapshot({ owner, scope, collections: data, loading: false, failed: false });
      }
    } catch {
      if (currentOwner.current === scope && requestId === newestLoad.current) {
        setSnapshot((previous) => previous?.scope === scope
          ? { ...previous, loading: false, failed: true }
          : previous);
      }
    }
  }), [owner, scope, fetchAuthed, enqueue]);

  useEffect(() => {
    if (isLoaded) void reload();
  }, [isLoaded, reload]);

  const updateCollections = useCallback((update: (items: Collection[]) => Collection[]) => {
    if (currentOwner.current !== scope) return;
    setSnapshot((previous) => previous && previous.scope === scope
      ? { ...previous, collections: update(previous.collections) }
      : previous);
  }, [scope]);

  const post = useCallback(async (endpoint: string, body: object) => {
    if (!owner || currentOwner.current !== scope) throw new Error('account unavailable');
    const res = await fetchAuthed(`/api/collections/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('collection change failed');
    const data = await res.json();
    if (currentOwner.current !== scope) throw new Error('account changed');
    return data;
  }, [owner, scope, fetchAuthed]);

  const createCollection = useCallback((name: string) => enqueue(async () => {
    const created = await post('create', { name }) as Collection;
    if (!Number.isInteger(created?.id) || typeof created.name !== 'string' || !Array.isArray(created.items)) {
      throw new Error('unexpected collection response');
    }
    updateCollections((collections) => [...collections, created]);
    return created;
  }), [post, updateCollections, enqueue]);

  const change = useCallback((endpoint: string, body: object, update: (items: Collection[]) => Collection[]) => enqueue(async () => {
    const data = await post(endpoint, body);
    if (data?.ok !== true) throw new Error('collection change failed');
    updateCollections(update);
  }), [post, updateCollections, enqueue]);

  const renameCollection = useCallback(async (id: number, name: string) => {
    await change('update', { id, name }, (collections) =>
      collections.map((collection) => collection.id === id ? { ...collection, name } : collection));
  }, [change]);

  const deleteCollection = useCallback(async (id: number) => {
    await change('delete', { id }, (collections) => collections.filter((collection) => collection.id !== id));
  }, [change]);

  const addItem = useCallback(async (collectionId: number, item: CollectionItem) => {
    await change('add-item', { collectionId, ...item }, (collections) =>
      collections.map((collection) => collection.id === collectionId
        && !collection.items.some((saved) => saved.kind === item.kind && saved.ref === item.ref)
        ? { ...collection, items: [...collection.items, item] }
        : collection));
  }, [change]);

  const removeItem = useCallback(async (collectionId: number, item: CollectionItem) => {
    await change('remove-item', { collectionId, ...item }, (collections) =>
      collections.map((collection) => collection.id === collectionId
        ? { ...collection, items: collection.items.filter((saved) => saved.kind !== item.kind || saved.ref !== item.ref) }
        : collection));
  }, [change]);

  const value = useMemo<CollectionsContextValue>(
    () => ({
      collections,
      isLoading,
      loadFailed,
      available,
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
      loadFailed,
      available,
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
