import type { UIMessage } from "ai";
import type { ChatSession, IntakeBatch, IntakeGroup, Item, ItemFilters, ItemInput, NewIntakeGroup, Outfit, Profile, WishlistItem } from "../types";

/**
 * Data access layer. Two implementations:
 *  - demo.ts      in-memory, seeded, used when Supabase env vars are missing
 *  - supabase.ts  real persistence (RLS-scoped to the signed-in user)
 * Route handlers and AI tools only ever talk to this interface.
 */
export interface Repo {
  mode: "demo" | "supabase";
  userId: string;
  email: string | null;

  listItems(filters?: ItemFilters): Promise<Item[]>;
  getItems(ids: string[]): Promise<Item[]>;
  createItem(input: ItemInput): Promise<Item>;
  updateItem(id: string, patch: Partial<ItemInput>): Promise<Item>;
  deleteItem(id: string): Promise<void>;
  /** Records pieces as worn on a date. Pieces already logged that day aren't counted twice. Returns how many were new. */
  logWear(itemIds: string[], date: string, outfitId: string | null): Promise<number>;

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
  /** Deletes a stored image. Ignores URLs this repo doesn't own (bundled samples, other hosts). */
  deleteImage(url: string): Promise<void>;
  /** Reads one of this user's stored images. Refuses anything else, so a URL from a client can't reach other hosts. */
  readImage(url: string): Promise<Buffer>;
  /** Where the browser should send a photo: straight to storage when possible. */
  createUploadTarget(ext: "jpg"): Promise<{ method: "PUT" | "FORM"; url: string; publicUrl: string | null }>;

  /** Everyone's AI spend so far today, for the global cap. */
  aiSpendToday(): Promise<number>;
  /** How many studio shots this user has had. */
  studioShotsUsed(): Promise<number>;
  recordAiSpend(kind: "vision" | "studio" | "chat", usd: number): Promise<void>;
  /** This user's counted stylist messages since midnight UTC. */
  chatMessagesToday(): Promise<number>;
  /** Usage measurement. Never throws: it must not get in the way of the app. */
  track(name: string, props?: Record<string, unknown>): Promise<void>;
  /** Permanently removes this user, their data and their files. */
  deleteAccount(): Promise<void>;

  listIntake(): Promise<{ batches: IntakeBatch[]; groups: IntakeGroup[] }>;
  countIntakePhotosToday(): Promise<number>;
  createIntakeBatch(photos: string[]): Promise<IntakeBatch>;
  updateIntakeBatch(id: string, patch: Partial<IntakeBatch>): Promise<void>;
  createIntakeGroups(groups: NewIntakeGroup[]): Promise<IntakeGroup[]>;
  getIntakeGroup(id: string): Promise<IntakeGroup | null>;
  updateIntakeGroup(id: string, patch: Partial<IntakeGroup>): Promise<void>;
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
