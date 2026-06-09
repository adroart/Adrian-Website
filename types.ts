export type AvailabilityStatus = 'READY_TO_SHIP' | 'MADE_TO_ORDER' | 'SOLD';

// ── Provenance (permanent works record) ───────────────────────────

export interface ProvenanceEvent {
  year: string;
  event: 'created' | 'exhibited' | 'sold' | 'commissioned' | 'restored' | 'transferred';
  note?: string;
}

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

  // Provenance — permanent record displayed on /works/:id
  provenance?: ProvenanceEvent[];
  createdLocation?: string;
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

