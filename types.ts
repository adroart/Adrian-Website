export type AvailabilityStatus = 'READY_TO_SHIP' | 'MADE_TO_ORDER' | 'SOLD';

export type VariantAvailability = 'IN_STOCK' | 'MADE_TO_ORDER';

export interface SizeVariant {
  size: string;                        // e.g., '16"', '24"', '36"'
  price: number;                       // [DUMMY] placeholder — replace before going live
  stripePriceId?: string;              // Stripe Price ID for this size (e.g. price_xxx)
  availability: VariantAvailability;   // Per-variant stock status
  editionNumber?: number;              // For in-stock pieces: which number in the edition
}

export interface Artwork {
  id: string;
  title: string;
  category: string; // e.g. "Multidimensional Art", "Jewelry"
  series?: string; // e.g. "Universal Language", "Mandala", "Light Codes"
  coverImage: string;
  images: string[];
  description: string;
  longDescription?: string;
  seriesDescription?: string; // Series boilerplate; description becomes piece-specific
  year: string;
  dimensions?: string;
  material?: string;

  // Master Doc Fields
  featured?: boolean; // For "Selected Works"
  availability: AvailabilityStatus;
  price?: number; // Optional if Sold. For MTO with madeToOrderSizes, use lowest size price.
  edition?: string; // e.g. "Edition of 10"
  editionSize?: number; // Total edition size (e.g. 10)
  editionSold?: number; // How many have sold
  editionNumber?: number; // This specific piece's number in the edition

  createdDate?: Date;

  // Commerce
  stripePriceId?: string; // Stripe Price ID (price_xxx) for Checkout Session API
  stripeUrl?: string;     // Legacy: direct Stripe Payment Link (fallback)

  // Size variants — if set, piece page shows unified configurator with per-variant availability.
  // Each variant has its own Stripe Price ID and stock status.
  sizeVariants?: SizeVariant[];
  madeToOrderSizes?: SizeVariant[]; // Legacy alias — still read as fallback in PiecePage + GalleryTileCard

  // Architecture update fields
  illuminated?: boolean; // Piece has LED/light work
  finish?: string; // e.g. "Natural", "Painted", "Gold Leaf"
  subcategory?: string; // Light Codes: "Frequency Foundations" | "Embodied Vibrations" | "Resonant Formations"
  relatedStorySlug?: string; // Links to Story.slug for bidirectional story linking
  isSignaturePiece?: boolean; // Multidimensional Art pieces outside any named series

  // Configurator opt-in: when set, the configurator only shows these add-ons.
  // When undefined, defaults to the full set (crystals, woodFrame, illumination
  // — illumination still gated by size tier). Use this to hide add-ons that
  // don't apply to a piece (e.g. jewelry shouldn't offer a wood frame).
  availableAddOns?: Array<'crystals' | 'woodFrame' | 'illumination'>;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  category: string;
  matchSeries?: string;
  pieceIds?: string[];
}

export interface Product {
  id: string;
  title: string;
  price: number;            // Lowest price (for sorting and "From $X")
  highPrice?: number;       // Highest price (for range display: "$X to $Y")
  category: string;
  image: string;
  available: boolean;
  description?: string;
  longDescription?: string;
  dimensions?: string;
  weight?: string;
  origin?: string;
  material?: string;
  edition?: string;
  isReadyToShip: boolean;
  hasVariants?: boolean;    // True when piece has sizeVariants (always goes to Configure)
  stripeUrl?: string;       // Legacy: direct Stripe Payment Link (fallback)
  stripePriceId?: string;   // Stripe Price ID (price_xxx) for Checkout Session API
  // For configured made-to-order items: add-on Stripe Price IDs sent as additional line items
  addOnPriceIds?: string[];
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type StoryCategory = 'Living Knowledge' | 'Beneath the Surface' | 'The Practice' | 'The Path';

export interface AudioTrack {
  title: string;
  url: string;
  duration?: string;
}

export interface Stanza {
  lines: string[];           // one entry per line; rendered with whitespace-pre-line
  startSeconds?: number;     // optional click-to-seek anchor; absent on all stanzas → page falls back to pure tide marker
}

export interface Track {
  id: string;                // 'river-poem-2026'
  slug: string;              // /poetry/<slug>
  title: string;
  openingLine?: string;      // first line, used as the index entry (falls back to poem[0].lines[0])
  audioUrl: string;          // https://audio.adrianrasmussen.com/<file>
  poem: Stanza[];            // the poem as structured stanzas
  coverImage?: string;       // Cloudinary public_id or full URL — rendered as a small seal, not a hero
  duration?: string;         // '3:42'
  durationSeconds?: number;
  releaseDate: string;       // ISO
  dedication?: string;       // optional Cormorant italic line under the title
  themes?: string[];
  aiNote?: string;           // optional honest credit line shown subtly at the page bottom
}

export interface Story {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  date: string;
  category: StoryCategory; // Updated from 'type'
  excerpt: string;
  content: string[];
  image?: string;
  readMinutes: number;
  tags: string[];
  tracks?: AudioTrack[];
  lyrics?: string[];

  isFeatured?: boolean;
  relatedArtifactId?: string;
}

// === Atlas / Ledger ===
// Public, append-only, hash-chained record of where every Adrian Rasmussen
// piece lives in the world. City-level only — never addresses, never
// user-provided coordinates. See docs/ledger-api.md and
// docs/atlas-style-notes.md for the full picture.

/**
 * A curated city centroid. Coordinates are looked up once (see data/cities.ts)
 * and never come from steward input. This is the only place lat/lng live.
 */
export interface CityCentroid {
  id: string;            // 'lisbon-pt', 'denpasar-id' — stable kebab-case slug
  city: string;          // 'Lisbon'
  region?: string;       // optional state/province (e.g. 'California')
  country: string;       // 'Portugal'
  countryCode: string;   // ISO 3166-1 alpha-2, uppercase, 'PT'
  lat: number;           // centroid, not user-provided
  lng: number;
}

/**
 * Every change to a piece's location is one of these event types. Events
 * are immutable and form a per-piece hash chain in the R2 ledger.
 */
export type LedgerEventType =
  | 'created'      // piece came into existence (location optional, e.g. studio)
  | 'placed'       // first known steward location (admin-entered or claim)
  | 'moved'        // piece relocated to a new city
  | 'withdrawn'    // steward marked piece private (point hides from public)
  | 'revealed'     // steward re-publicized piece
  | 'retired';     // piece destroyed, lost, or otherwise removed from ledger

/**
 * One entry in the append-only ledger. Genesis events have prevHash: null.
 * Every subsequent event for the same pieceId+editionNumber references the
 * hash of the previous event. The chain is per-piece, not global, so
 * different pieces can be appended to independently.
 */
export interface LedgerEvent {
  id: string;                    // ULID or uuid-v4
  pieceId: string;               // matches Artwork.id
  editionNumber?: number;        // for editioned works, which copy
  type: LedgerEventType;
  date: string;                  // ISO 8601
  cityId?: string | null;        // references CityCentroid.id; null for retired/withdrawn
  note?: string;                 // private to admin, never shown publicly
  actor: 'admin' | 'steward';    // who created this event
  prevHash: string | null;       // hash of previous event in the chain, null for genesis
  hash: string;                  // hash of this event's canonical form
}

/**
 * Derived state — computed by replaying events, never stored on disk.
 * Use utils/ledgerProjection.ts to build these from a LedgerEvent[].
 */
export interface PieceRecord {
  pieceId: string;
  editionNumber?: number;
  currentCityId: string | null;  // null = not yet placed or withdrawn
  status: 'seeking' | 'placed' | 'withdrawn' | 'retired';
  history: LedgerEvent[];
  isPublic: boolean;             // derived from withdrawn/revealed
}

/**
 * Private — never exposed in the public GET. Stored in atlas/stewards.json
 * in R2, only readable by admin. The raw steward key is shown to Adrian
 * ONCE on issuance and never persisted.
 */
export interface StewardRecord {
  pieceId: string;
  editionNumber?: number;
  name?: string;                 // collector first name, optional
  email?: string;                // for outreach
  notes?: string;                // admin-only
  keyHash: string;               // hashed steward key (never store raw)
  keyIssuedAt: string;           // ISO
  outreachStatus: 'no-contact' | 'invited' | 'claimed' | 'declined';
  lastClaimAt?: string;          // last time steward used their key
}

/**
 * Public projection — what gets served to /atlas and mirrored to the
 * GitHub redundancy repo. Strips every private field. 'withdrawn' pieces
 * are omitted entirely; 'seeking' pieces (created but never placed) are
 * included so the seeking-ground view works.
 */
export interface PublicAtlasState {
  generatedAt: string;           // ISO
  schemaVersion: number;         // start at 1
  pieces: Array<{
    pieceId: string;
    editionNumber?: number;
    series?: string;             // from Artwork.series
    category?: string;           // from Artwork.category
    cityId: string | null;
    status: 'seeking' | 'placed';  // never expose 'withdrawn' as a state, just omit
    placedAt?: string;           // ISO of most recent placed/moved event
  }>;
  cities: CityCentroid[];        // only cities referenced by public pieces
}
