import type { CartItem, Product } from '../../types';
import { FULL_ARCHIVE } from '../../data/mockData';

interface RemoteCartRow {
  productId: string;
  quantity: number;
  configurator?: unknown;
}

let _productIndex: Map<string, Product> | null = null;

function productIndex(): Map<string, Product> {
  if (_productIndex) return _productIndex;
  _productIndex = new Map();
  // Some shop products derive from FULL_ARCHIVE artworks (id used directly).
  // Others may live elsewhere; for sync we only need to rehydrate items that
  // can be matched by id. Unknown ids are dropped silently on rehydrate.
  for (const art of FULL_ARCHIVE) {
    const p: Product = {
      id: art.id,
      title: art.title,
      price: art.price ?? 0,
      category: art.category,
      image: art.coverImage,
      available: art.availability !== 'SOLD',
      isReadyToShip: art.availability === 'READY_TO_SHIP',
      edition: art.edition,
      hasVariants: !!(art.sizeVariants || art.madeToOrderSizes),
      stripePriceId: art.stripePriceId,
      stripeUrl: art.stripeUrl,
    };
    _productIndex.set(art.id, p);
  }
  return _productIndex;
}

/**
 * Serialise the in-memory cart for transmission to /api/cart/put.
 */
export function serializeCart(items: CartItem[]): RemoteCartRow[] {
  return items.map((i) => ({
    productId: i.product.id,
    quantity: i.quantity,
  }));
}

/**
 * Rehydrate remote rows into CartItems by looking each product id up in
 * FULL_ARCHIVE. Unknown ids are dropped.
 */
export function hydrateCart(rows: RemoteCartRow[]): CartItem[] {
  const idx = productIndex();
  const out: CartItem[] = [];
  for (const row of rows) {
    const product = idx.get(row.productId);
    if (!product) continue;
    out.push({ product, quantity: Math.max(1, Math.min(10, Math.round(row.quantity))) });
  }
  return out;
}

/**
 * Merge two cart lists, summing quantities for identical product ids
 * (clamped per item). Used by the sync-on-sign-in flow when both the
 * local cart and the remote D1 cart have content.
 */
export function mergeCarts(local: CartItem[], remote: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const item of [...local, ...remote]) {
    const existing = map.get(item.product.id);
    if (existing) {
      existing.quantity = Math.min(10, existing.quantity + item.quantity);
    } else {
      map.set(item.product.id, { ...item });
    }
  }
  return Array.from(map.values());
}
