import type { Category, ColorName, Fit, Material, Occasion, Pattern, Season, Slot } from "./taxonomy";

export type ItemStatus = "active" | "archived";

/** Extra views of an item. `image_url` stays the primary (front) cut-out. */
export type ImageView = "front" | "back" | "detail" | "worn";
export interface ItemImage {
  url: string;
  view: ImageView;
  /** true when generated/reconstructed by AI (e.g. extracted from a worn photo) */
  ai?: boolean;
}

export interface Item {
  id: string;
  user_id: string;
  name: string;
  category: Category;
  subcategory: string;
  colors: ColorName[]; // first = dominant
  pattern: Pattern;
  material: Material | null;
  fit: Fit | null;
  seasons: Season[];
  occasions: Occasion[];
  formality: number; // 1-5
  warmth: number; // 1-5
  brand: string | null;
  size: string | null;
  image_url: string | null; // processed cut-out (transparent PNG/WebP)
  original_image_url: string | null;
  images: ItemImage[]; // back / detail / worn shots
  description: string | null; // AI-written, used for styling context
  notes: string | null;
  status: ItemStatus;
  in_laundry: boolean;
  is_favorite: boolean;
  wear_count: number;
  last_worn_at: string | null;
  created_at: string;
}

export type ItemInput = Omit<Item, "id" | "user_id" | "created_at" | "wear_count" | "last_worn_at"> &
  Partial<Pick<Item, "wear_count" | "last_worn_at">>;

export interface OutfitItem {
  item_id: string;
  slot: Slot;
}

export interface Outfit {
  id: string;
  user_id: string;
  name: string;
  occasion: Occasion | null;
  notes: string | null;
  source: "ai" | "user";
  is_favorite: boolean;
  weather: WeatherSnapshot | null;
  items: OutfitItem[];
  created_at: string;
}

export type WishlistStatus = "idea" | "saved" | "bought" | "dismissed";

export interface WishlistItem {
  id: string;
  user_id: string;
  title: string;
  category: Category | null;
  subcategory: string | null;
  color: string | null;
  brand: string | null;
  price: number | null;
  currency: string | null;
  url: string | null;
  image_url: string | null;
  retailer: string | null;
  reason: string | null; // why the stylist suggests it (the gap it fills)
  pairs_with: string[]; // item ids it unlocks outfits with
  priority: 1 | 2 | 3;
  status: WishlistStatus;
  source: "ai" | "user";
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  menswear: "menswear" | "womenswear" | "both";
  height_cm: number | null;
  weight_kg: number | null;
  build: string | null; // e.g. "slim", "athletic", "broad shoulders"
  skin_tone: string | null; // used for color advice, user-provided only
  sizes: { top?: string; bottom?: string; waist?: string; inseam?: string; shoe_eu?: string; [k: string]: string | undefined };
  home_city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  style_keywords: string[]; // "minimal", "old money", "streetwear"…
  favorite_colors: string[];
  avoid: string[]; // colors / items / fits to avoid
  budget: "low" | "mid" | "high" | null;
  currency: string;
  notes: string | null;
}

export interface WeatherSnapshot {
  location: string;
  date: string;
  temp_c: number;
  temp_min_c?: number;
  temp_max_c?: number;
  feels_like_c?: number;
  precipitation_mm?: number;
  rain_chance?: number;
  wind_kmh?: number;
  condition: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  updated_at: string;
  created_at: string;
}

export interface ItemFilters {
  category?: Category;
  subcategory?: string;
  color?: string;
  season?: Season;
  occasion?: Occasion;
  favorite?: boolean;
  status?: ItemStatus | "all";
  include_laundry?: boolean;
  q?: string;
}
