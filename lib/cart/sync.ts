import type { CartItem, Product } from '../../types';
import { FULL_ARCHIVE, MADE_TO_ORDER_ADD_ONS } from '../../data/mockData';

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

type AddOn = 'crystals' | 'woodFrame' | 'illumination';
interface Configuration {
  version: 1;
  artworkId: string;
  size: string;
  addOns: AddOn[];
}

let _configuredIndex: Map<string, { product: Product; configuration: Configuration }> | null = null;

/** Resolve only combinations the existing size/options wizard can create.
 * Saved rows describe choices; all display prices and payment IDs come from
 * the current catalog. Never persist or trust a remote product snapshot.
 */
function configuredIndex() {
  if (_configuredIndex) return _configuredIndex;
  const index = new Map<string, { product: Product; configuration: Configuration }>();
  const ambiguous = new Set<string>();
  for (const art of FULL_ARCHIVE) {
    for (const variant of art.sizeVariants ?? art.madeToOrderSizes ?? []) {
      const digits = variant.size.match(/(\d+)/);
      const cm = digits ? parseInt(digits[1], 10) * (/cm/i.test(variant.size) ? 1 : 2.54) : null;
      const addOnTier = cm === null || cm <= 35 ? 'small' : cm <= 65 ? 'medium' : 'large';
      const lightTier = cm !== null && cm < 30 ? null : cm === null || cm <= 60 ? 'medium' : cm <= 90 ? 'large' : 'major';
      const allowed = art.availableAddOns ?? ['crystals', 'woodFrame', 'illumination'];
      for (let mask = 0; mask < 8; mask++) {
        const crystals = !!(mask & 1), frame = !!(mask & 2), light = !!(mask & 4);
        const addOns: AddOn[] = [
          ...(crystals ? ['crystals' as const] : []),
          ...(frame ? ['woodFrame' as const] : []),
          ...(light ? ['illumination' as const] : []),
        ];
        if (addOns.some(name => !allowed.includes(name)) || (light && !lightTier)) continue;
        const key = [variant.size, crystals ? 'xls' : '', frame ? 'xwf' : '', light ? 'xil' : ''].join('-');
        const id = `${art.id}-${key.replace(/[^a-zA-Z0-9-]/g, '')}`;
        // Sanitized legacy IDs must never select between two different options.
        if (index.has(id) || ambiguous.has(id) || productIndex().has(id)) {
          index.delete(id); ambiguous.add(id); continue;
        }
        const extras = [
          ...(crystals ? [MADE_TO_ORDER_ADD_ONS.crystals[addOnTier]] : []),
          ...(frame ? [MADE_TO_ORDER_ADD_ONS.woodFrame[addOnTier]] : []),
          ...(light && lightTier ? [MADE_TO_ORDER_ADD_ONS.illumination[lightTier]] : []),
        ];
        const labels = [crystals && 'with crystals', frame && 'with wood frame', light && 'illuminated'].filter(Boolean);
        index.set(id, {
          configuration: { version: 1, artworkId: art.id, size: variant.size, addOns },
          product: {
            id, title: `${art.title}, ${variant.size.replace('"', ' inch')}${labels.length ? `, ${labels.join(', ')}` : ''}`,
            price: variant.price + extras.reduce((total, extra) => total + extra.price, 0),
            category: art.category, image: art.coverImage, available: art.availability !== 'SOLD',
            isReadyToShip: variant.availability === 'IN_STOCK', material: art.material,
            edition: art.edition, dimensions: art.dimensions, stripePriceId: variant.stripePriceId,
            addOnPriceIds: extras.length ? extras.map(extra => extra.stripePriceId) : undefined,
          },
        });
      }
    }
  }
  _configuredIndex = index;
  return index;
}

function matchesConfiguration(value: unknown, canonical: Configuration): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const names = candidate.addOns;
  return Object.keys(candidate).length === 4
    && candidate.version === 1 && candidate.artworkId === canonical.artworkId
    && candidate.size === canonical.size && Array.isArray(names)
    && names.length === canonical.addOns.length
    && canonical.addOns.every(name => names.includes(name))
    && new Set(names).size === names.length;
}

function safeQuantity(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(10, Math.round(value))) : 1;
}

/** Serialize existing generated IDs with an explicit option descriptor in the
 * server's existing configurator JSON field. Plain product rows stay compatible.
 */
export function serializeCart(items: CartItem[]): RemoteCartRow[] {
  const configurations = configuredIndex();
  return items.map(i => {
    const canonical = configurations.get(i.product.id);
    return {
      productId: i.product.id, quantity: safeQuantity(i.quantity),
      ...(canonical ? { configurator: { ...canonical.configuration, addOns: [...canonical.configuration.addOns] } } : {}),
    };
  });
}

/** Rehydrate plain or configured rows from the current catalog. Legacy rows
 * containing only generated IDs also recover. Unknown/removed/malformed options
 * are dropped instead of fabricating a product or accepting saved prices.
 */
export function hydrateCart(rows: RemoteCartRow[]): CartItem[] {
  const idx = productIndex();
  const configurations = configuredIndex();
  const out: CartItem[] = [];
  for (const row of rows) {
    if (!row || typeof row.productId !== 'string') continue;
    const canonical = configurations.get(row.productId);
    if (row.configurator !== undefined && (!canonical || !matchesConfiguration(row.configurator, canonical.configuration))) continue;
    const product = canonical?.product ?? idx.get(row.productId);
    if (!product) continue;
    out.push({ product: { ...product, ...(product.addOnPriceIds ? { addOnPriceIds: [...product.addOnPriceIds] } : {}) }, quantity: safeQuantity(row.quantity) });
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
