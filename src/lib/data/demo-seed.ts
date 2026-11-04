import type { Item, Outfit, Profile, WishlistItem } from "../types";

export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
const now = new Date().toISOString();

type Seed = Pick<Item, "name" | "category" | "subcategory" | "colors" | "pattern" | "material" | "fit" | "seasons" | "occasions" | "formality" | "warmth"> &
  Partial<Item> & { slug: string };

const seeds: Seed[] = [
  { slug: "tee-white", name: "White heavyweight tee", category: "top", subcategory: "t-shirt", colors: ["white"], pattern: "solid", material: "cotton", fit: "regular", seasons: ["spring", "summer", "autumn"], occasions: ["casual", "beach", "travel"], formality: 2, warmth: 1, is_favorite: true, wear_count: 14 },
  { slug: "tee-black", name: "Black boxy tee", category: "top", subcategory: "t-shirt", colors: ["black"], pattern: "solid", material: "cotton", fit: "oversized", seasons: ["spring", "summer", "autumn"], occasions: ["casual", "party"], formality: 2, warmth: 1, wear_count: 9 },
  { slug: "oxford-blue", name: "Light blue oxford shirt", category: "top", subcategory: "shirt", colors: ["light-blue"], pattern: "solid", material: "cotton", fit: "regular", seasons: ["spring", "summer", "autumn", "winter"], occasions: ["smart-casual", "business", "date"], formality: 3, warmth: 2, is_favorite: true, wear_count: 6 },
  { slug: "sweater-cream", name: "Cream crewneck sweater", category: "top", subcategory: "sweater", colors: ["cream"], pattern: "textured", material: "wool", fit: "relaxed", seasons: ["autumn", "winter"], occasions: ["casual", "smart-casual", "date"], formality: 3, warmth: 4, wear_count: 4 },
  { slug: "polo-navy", name: "Navy knit polo", category: "top", subcategory: "polo", colors: ["navy"], pattern: "solid", material: "knit", fit: "regular", seasons: ["spring", "summer"], occasions: ["smart-casual", "date", "travel"], formality: 3, warmth: 2, wear_count: 3 },
  { slug: "overshirt-grey", name: "Grey wool overshirt", category: "outerwear", subcategory: "jacket", colors: ["grey"], pattern: "solid", material: "wool", fit: "regular", seasons: ["autumn", "winter", "spring"], occasions: ["casual", "smart-casual"], formality: 3, warmth: 3, wear_count: 5 },
  { slug: "chore-brown", name: "Brown chore jacket", category: "outerwear", subcategory: "jacket", colors: ["brown"], pattern: "solid", material: "canvas", fit: "relaxed", seasons: ["autumn", "spring"], occasions: ["casual", "travel"], formality: 2, warmth: 3, is_favorite: true, wear_count: 7 },
  { slug: "coat-camel", name: "Camel overcoat", category: "outerwear", subcategory: "coat", colors: ["camel"], pattern: "solid", material: "wool", fit: "regular", seasons: ["winter", "autumn"], occasions: ["smart-casual", "business", "formal", "date"], formality: 4, warmth: 5, wear_count: 2 },
  { slug: "jeans-indigo", name: "Indigo straight jeans", category: "bottom", subcategory: "jeans", colors: ["navy"], pattern: "solid", material: "denim", fit: "regular", seasons: ["spring", "autumn", "winter"], occasions: ["casual", "date", "travel"], formality: 2, warmth: 3, wear_count: 18 },
  { slug: "trousers-charcoal", name: "Charcoal pleated trousers", category: "bottom", subcategory: "trousers", colors: ["charcoal"], pattern: "solid", material: "wool", fit: "wide", seasons: ["autumn", "winter", "spring"], occasions: ["smart-casual", "business", "formal", "date"], formality: 4, warmth: 3, wear_count: 4 },
  { slug: "chinos-beige", name: "Stone chinos", category: "bottom", subcategory: "chinos", colors: ["beige"], pattern: "solid", material: "cotton", fit: "regular", seasons: ["spring", "summer", "autumn"], occasions: ["smart-casual", "casual", "travel"], formality: 3, warmth: 2, wear_count: 8 },
  { slug: "shorts-navy", name: "Navy linen shorts", category: "bottom", subcategory: "shorts", colors: ["navy"], pattern: "solid", material: "linen", fit: "regular", seasons: ["summer"], occasions: ["casual", "beach", "travel"], formality: 1, warmth: 1, wear_count: 3, in_laundry: true },
  { slug: "sneakers-white", name: "White leather sneakers", category: "footwear", subcategory: "sneakers", colors: ["white"], pattern: "solid", material: "leather", fit: null, seasons: ["spring", "summer", "autumn"], occasions: ["casual", "smart-casual", "travel", "date"], formality: 2, warmth: 2, is_favorite: true, wear_count: 25 },
  { slug: "loafers-brown", name: "Brown suede loafers", category: "footwear", subcategory: "loafers", colors: ["brown"], pattern: "solid", material: "suede", fit: null, seasons: ["spring", "summer", "autumn"], occasions: ["smart-casual", "business", "date"], formality: 4, warmth: 2, wear_count: 6 },
  { slug: "boots-black", name: "Black chelsea boots", category: "footwear", subcategory: "boots", colors: ["black"], pattern: "solid", material: "leather", fit: null, seasons: ["autumn", "winter"], occasions: ["smart-casual", "party", "date"], formality: 3, warmth: 4, wear_count: 5 },
  { slug: "belt-brown", name: "Brown leather belt", category: "accessory", subcategory: "belt", colors: ["brown"], pattern: "solid", material: "leather", fit: null, seasons: ["spring", "summer", "autumn", "winter"], occasions: ["smart-casual", "business", "casual"], formality: 3, warmth: 1, wear_count: 10 },
  { slug: "cap-olive", name: "Olive cotton cap", category: "accessory", subcategory: "cap", colors: ["olive"], pattern: "solid", material: "cotton", fit: null, seasons: ["spring", "summer"], occasions: ["casual", "beach", "sport"], formality: 1, warmth: 1, wear_count: 4 },
];

export function seedItems(): Item[] {
  return seeds.map(({ slug, ...s }, i) => ({
    id: `demo-${slug}`,
    user_id: DEMO_USER_ID,
    brand: null,
    size: null,
    image_url: `/demo/${slug}.svg`,
    original_image_url: null,
    images: [],
    description: null,
    notes: null,
    status: "active",
    in_laundry: false,
    is_favorite: false,
    wear_count: 0,
    last_worn_at: null,
    created_at: new Date(Date.now() - i * 86_400_000).toISOString(),
    ...s,
  }));
}

export function seedOutfits(): Outfit[] {
  return [
    {
      id: "demo-outfit-1",
      user_id: DEMO_USER_ID,
      name: "Sunday coffee",
      occasion: "casual",
      notes: "Relaxed earth tones, works 14–20°C.",
      source: "ai",
      is_favorite: true,
      weather: null,
      created_at: now,
      items: [
        { item_id: "demo-chore-brown", slot: "outer" },
        { item_id: "demo-tee-white", slot: "top" },
        { item_id: "demo-jeans-indigo", slot: "bottom" },
        { item_id: "demo-sneakers-white", slot: "shoes" },
      ],
    },
  ];
}

export function seedWishlist(): WishlistItem[] {
  return [
    {
      id: "demo-wish-1",
      user_id: DEMO_USER_ID,
      title: "Olive linen camp-collar shirt",
      category: "top",
      subcategory: "shirt",
      color: "olive",
      brand: null,
      price: 60,
      currency: "EUR",
      url: null,
      image_url: null,
      retailer: null,
      reason: "Your summer tops are all white/black tees — a textured camp-collar adds a smart-casual option that pairs with your navy shorts and stone chinos.",
      pairs_with: ["demo-shorts-navy", "demo-chinos-beige", "demo-loafers-brown"],
      priority: 1,
      status: "idea",
      source: "ai",
      created_at: now,
    },
  ];
}

export function seedProfile(): Profile {
  return {
    id: DEMO_USER_ID,
    display_name: "Demo",
    menswear: "menswear",
    height_cm: 180,
    weight_kg: 75,
    build: "slim",
    skin_tone: null,
    sizes: { top: "M", waist: "32", inseam: "32", shoe_eu: "43" },
    home_city: "Lisbon",
    country: "Portugal",
    latitude: 38.7223,
    longitude: -9.1393,
    style_keywords: ["minimal", "smart casual", "earth tones"],
    favorite_colors: ["navy", "cream", "brown"],
    avoid: ["skinny fits"],
    budget: "mid",
    currency: "EUR",
    notes: null,
  };
}
