
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Product, CartItem } from './types';
import { useAccount } from './lib/account/useAccount';
import { serializeCart, hydrateCart, mergeCarts } from './lib/cart/sync';

export type { CartItem };

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, delta: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CART_STORAGE_KEY = 'adrian_cart_items';
const MAX_QUANTITY_PER_ITEM = 10;

/** One-of-one and numbered editions are limited to qty 1. Open/limited runs allow multiples. */
export function getMaxQuantity(product: Product): number {
  if (!product.edition) return 1;
  const e = product.edition.toLowerCase();
  if (e === 'one of a kind' || e === '1 of 1' || e.startsWith('edition of')) return 1;
  // Open Edition, Limited Run, etc.
  return MAX_QUANTITY_PER_ITEM;
}

// Validate a single cart item has the expected shape and safe values
function isValidCartItem(item: unknown): item is CartItem {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  if (typeof obj.quantity !== 'number' || !Number.isFinite(obj.quantity) || obj.quantity < 1) return false;
  if (typeof obj.product !== 'object' || obj.product === null) return false;
  const prod = obj.product as Record<string, unknown>;
  if (typeof prod.id !== 'string' || prod.id.length === 0) return false;
  if (typeof prod.title !== 'string') return false;
  if (typeof prod.price !== 'number' || !Number.isFinite(prod.price) || prod.price < 0) return false;
  return true;
}

function loadCartFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validate each item and clamp quantities
    return parsed
      .filter(isValidCartItem)
      .map(item => ({
        ...item,
        quantity: Math.min(item.quantity, MAX_QUANTITY_PER_ITEM),
      }));
  } catch {
    return [];
  }
}

const CartContext = createContext<CartContextType | null>(null);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => loadCartFromStorage());
  const [isCartOpen, setIsCartOpen] = useState(false);
  const account = useAccount();
  const syncedFor = useRef<string | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justPushed = useRef<string | null>(null);

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // localStorage unavailable (e.g. private browsing quota exceeded) — fail silently
    }
  }, [items]);

  // Sync-on-sign-in: merge local + remote, then keep them in step thereafter.
  useEffect(() => {
    if (!account.available || !account.isLoaded || !account.isSignedIn || !account.userId) return;
    if (syncedFor.current === account.userId) return;
    syncedFor.current = account.userId;

    let cancelled = false;
    (async () => {
      try {
        const res = await account.fetchAuthed('/api/cart/get');
        const remoteRows = res.ok ? await res.json() : [];
        const remote = hydrateCart(Array.isArray(remoteRows) ? remoteRows : []);
        if (cancelled) return;
        setItems((local) => {
          const merged = mergeCarts(local, remote);
          // Push merged back so the remote reflects the new state.
          const payload = JSON.stringify(serializeCart(merged));
          justPushed.current = payload;
          account.fetchAuthed('/api/cart/put', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
          }).catch(() => {});
          return merged;
        });
      } catch {
        // Non-fatal; local cart unchanged.
      }
    })();
    return () => { cancelled = true; };
  }, [account]);

  // Debounced push of any cart change while signed in.
  useEffect(() => {
    if (!account.available || !account.isSignedIn) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      const payload = JSON.stringify(serializeCart(items));
      if (justPushed.current === payload) return;
      justPushed.current = payload;
      account.fetchAuthed('/api/cart/put', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).catch(() => {});
    }, 350);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [items, account]);

  const addToCart = useCallback((product: Product) => {
    const max = getMaxQuantity(product);
    setItems(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i =>
          i.product.id === product.id
            ? { ...i, quantity: Math.min(i.quantity + 1, max) }
            : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setIsCartOpen(true);
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setItems(prev =>
      prev
        .map(i => {
          if (i.product.id !== productId) return i;
          const max = getMaxQuantity(i.product);
          return { ...i, quantity: Math.min(Math.max(i.quantity + delta, 0), max) };
        })
        .filter(i => i.quantity > 0)
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
      isCartOpen,
      openCart: () => setIsCartOpen(true),
      closeCart: () => setIsCartOpen(false),
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
