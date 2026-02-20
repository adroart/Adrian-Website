export type AvailabilityStatus = 'READY_TO_SHIP' | 'MADE_TO_ORDER' | 'SOLD';

export interface Artwork {
  id: string;
  title: string;
  category: string; // e.g. "Multidimensional Art", "Jewelry"
  series?: string; // e.g. "Universal Language", "Mandala", "Light Codes"
  coverImage: string;
  images: string[];
  description: string;
  longDescription?: string;
  year: string;
  dimensions?: string;
  material?: string;

  // Master Doc Fields
  featured?: boolean; // For "Selected Works"
  availability: AvailabilityStatus;
  price?: number; // Optional if Sold
  edition?: string; // e.g. "Edition of 10"
  editionSize?: number; // Total edition size (e.g. 10)
  editionSold?: number; // How many have sold
  editionNumber?: number; // This specific piece's number in the edition

  createdDate?: Date;

  // Commerce
  stripePriceId?: string; // Stripe Price ID (price_xxx) for Checkout Session API

  // Architecture update fields
  illuminated?: boolean; // Piece has LED/light work
  finish?: string; // e.g. "Natural", "Painted", "Gold Leaf"
  subcategory?: string; // Light Codes: "Frequency Foundations" | "Embodied Vibrations" | "Resonant Formations"
  relatedStorySlug?: string; // Links to Story.slug for bidirectional story linking
  isSignaturePiece?: boolean; // Multidimensional Art pieces outside any named series
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
  price: number;
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
  stripeUrl?: string;       // Legacy: direct Stripe Payment Link (fallback)
  stripePriceId?: string;   // Stripe Price ID (price_xxx) for Checkout Session API
}

export type StoryCategory = 'Living Knowledge' | 'Beneath the Surface' | 'The Practice' | 'The Path';

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
  
  isFeatured?: boolean;
  relatedArtifactId?: string; 
}
