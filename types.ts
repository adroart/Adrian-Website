export type AvailabilityStatus = 'READY_TO_SHIP' | 'MADE_TO_ORDER' | 'SOLD';

export interface Artwork {
  id: string;
  title: string;
  category: string; // e.g. "Multidimensional Art", "Light Codes"
  series?: string; // e.g. "Universal Language"
  coverImage: string;
  images: string[];
  description: string;
  longDescription?: string;
  year: string;
  dimensions?: string;
  material?: string;
  
  // New Master Doc Fields
  featured?: boolean; // For "Selected Works"
  availability: AvailabilityStatus;
  price?: number; // Optional if Sold
  edition?: string; // e.g. "Edition of 10"
  editionSize?: number; // Total edition size (e.g. 10)
  editionSold?: number; // How many have sold
  editionNumber?: number; // This specific piece's number in the edition

  createdDate?: Date;
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
