import type { UIMessage } from "ai";
import type { ChatSession, Item, ItemFilters, ItemInput, Outfit, Profile, WishlistItem } from "../types";

/**
 * Data access layer. Two implementations:
 *  - demo.ts      in-memory, seeded, used when Supabase env vars are missing
 *  - supabase.ts  real persistence (RLS-scoped to the signed-in user)
 * Route handlers and AI tools only ever talk to this interface.
 */
export interface Repo {
  mode: "demo" | "supabase";
  userId: string;

  listItems(filters?: ItemFilters): Promise<Item[]>;
  getItems(ids: string[]): Promise<Item[]>;
  createItem(input: ItemInput): Promise<Item>;
  updateItem(id: string, patch: Partial<ItemInput>): Promise<Item>;
  deleteItem(id: string): Promise<void>;

  listOutfits(): Promise<Outfit[]>;
  createOutfit(input: Omit<Outfit, "id" | "user_id" | "created_at">): Promise<Outfit>;
  updateOutfit(id: string, patch: Partial<Outfit>): Promise<Outfit>;
  deleteOutfit(id: string): Promise<void>;

  listWishlist(): Promise<WishlistItem[]>;
  createWishlist(items: Omit<WishlistItem, "id" | "user_id" | "created_at">[]): Promise<WishlistItem[]>;
  updateWishlist(id: string, patch: Partial<WishlistItem>): Promise<WishlistItem>;
  deleteWishlist(id: string): Promise<void>;

  getProfile(): Promise<Profile>;
  updateProfile(patch: Partial<Profile>): Promise<Profile>;

  listChats(): Promise<ChatSession[]>;
  getChat(id: string): Promise<{ session: ChatSession; messages: UIMessage[] } | null>;
  saveChat(id: string, messages: UIMessage[], title?: string): Promise<void>;
  deleteChat(id: string): Promise<void>;

  /** Stores an image and returns a public URL. */
  uploadImage(data: Blob, ext: "webp" | "png" | "jpg"): Promise<string>;
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
