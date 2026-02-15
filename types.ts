
export enum View {
  HOME = 'HOME',
  ART = 'ART',         // This remains the technical Archive/Gallery
  ART_HUB = 'ART_HUB', // The new narrative "Art" hub
  COLLECTION = 'COLLECTION',
  JEWELRY = 'JEWELRY',
  ORACLE = 'ORACLE',
  STORIES = 'STORIES',
  SHOP = 'SHOP',
  STUDIO = 'STUDIO',
  CART = 'CART'
}

export interface Artwork {
  id: string;
  title: string;
  category: string;
  coverImage: string;
  images: string[];
  description: string;
  year: string;
  dimensions?: string;
  material?: string;
  
  // New Art Hub Fields
  series?: string;
  featured?: boolean;
  createdDate?: Date;

  // Acquisition Fields
  price?: number;
  available?: boolean;
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
}

export type StoryType = 'art' | 'symbols' | 'jewelry' | 'places' | 'practice' | 'poetry';

export interface Story {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  date: string;
  type: StoryType;
  excerpt: string;
  content: string[]; 
  image?: string; 
  readMinutes: number;
  tags: string[];
  
  isFeatured?: boolean;
  isStartHere?: boolean;
  threadId?: string;
  threadOrder?: number;
  
  relatedArtifactId?: string; 
  relatedProductId?: string;  
}