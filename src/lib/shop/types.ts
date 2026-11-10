/** Retailer facts only. Missing fields are unknown, never inferred from a photo. */
export interface ShopProduct {
  url: string;
  title: string;
  retailer: string;
  image_url?: string;
  images: string[];
  price?: number;
  currency?: string;
  description?: string;
  brand?: string;
  material?: string;
  color?: string;
  sizes: string[];
  variants: { id: string; title: string; url?: string; available?: boolean; price?: number; image_url?: string }[];
  availability?: string;
  measurements: { name: string; value: string; kind: "garment" | "body" | "package" | "unspecified" }[];
  size_guide_url?: string;
  rating?: { value: number; count?: number; scale: number };
  reviews: { text: string; rating?: number; author?: string }[];
  checked_at: string;
  source: "retailer";
}

export type ShopStoreId = "townteam" | "defacto" | "amazon";
export interface ShopSearchResult {
  products: ShopProduct[];
  stores: { id: ShopStoreId; name: string; status: "ok" | "unavailable"; search_url: string; message?: string }[];
}

export type ShopProductResult =
  | { status: "ok"; product: ShopProduct }
  | { status: "unverified" | "dead"; message: string };
