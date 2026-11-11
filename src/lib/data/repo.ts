import type { UIMessage } from "ai";
import type { AdminOverview, AiSpendKind, ChatSession, IntakeBatch, IntakeGroup, Item, ItemFilters, ItemInput, NewIntakeGroup, Outfit, Profile, PushSubscriptionRecord, ShareIntent, WishlistItem } from "../types";

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
  acquireTryOnLease(token: string): Promise<boolean>;
  listTryOnRuns(): Promise<import("../types").TryOnRun[]>;
  getTryOnRun(id: string): Promise<import("../types").TryOnRun | null>;
  saveTryOnRun(input: Pick<import("../types").TryOnRun, "result_url" | "recipe">): Promise<import("../types").TryOnRun>;
  deleteTryOnRun(id: string): Promise<void>;
  releaseTryOnLease(token: string): Promise<void>;

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

  createShareIntent(input: Omit<ShareIntent, "id" | "user_id" | "created_at" | "expires_at">): Promise<ShareIntent>;
  getShareIntent(id: string): Promise<ShareIntent | null>;
  deleteShareIntent(id: string): Promise<void>;
  savePushSubscription(input: Pick<PushSubscriptionRecord, "endpoint" | "p256dh" | "auth">): Promise<void>;
  listPushSubscriptions(): Promise<PushSubscriptionRecord[]>;
  deletePushSubscription(endpoint: string): Promise<void>;

  /** Stores an image and returns a public URL. */
  uploadImage(data: Blob, ext: "webp" | "png" | "jpg"): Promise<string>;
  /** Stores a profile/try-on image in the private try-on bucket and returns an authenticated app URL. */
  uploadPrivateImage(data: Blob, ext: "webp" | "png" | "jpg", purpose?: "reference" | "result"): Promise<string>;
  deletePrivateImage(url: string): Promise<void>;
  readPrivateImage(url: string): Promise<Buffer>;
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
  recordAiSpend(kind: AiSpendKind, usd: number): Promise<void>;
  tryOnsToday(): Promise<number>;
  adminOverview(): Promise<Omit<AdminOverview, "flags">>;
  adminSetFeatures(userId: string, features: string[]): Promise<void>;
  adminCreateInvite(code: string, note: string | null, maxUses: number): Promise<void>;
  adminRevokeInvite(code: string): Promise<void>;
  /** This user's counted stylist messages since midnight UTC. */
  chatMessagesToday(): Promise<number>;
  /** Premium features the owner has granted this person. */
  memberFeatures(): Promise<string[]>;
  /** Usage measurement. Never throws: it must not get in the way of the app. */
  track(name: string, props?: Record<string, unknown>): Promise<void>;
  /** Permanently removes this user, their data and their files. */
  deleteAccount(): Promise<void>;

  listIntake(): Promise<{ batches: IntakeBatch[]; groups: IntakeGroup[] }>;
  countIntakePhotosToday(): Promise<number>;
  createIntakeBatch(photos: string[], kind?: "closet" | "worn"): Promise<IntakeBatch>;
  updateIntakeBatch(id: string, patch: Partial<IntakeBatch>): Promise<void>;
  createIntakeGroups(groups: NewIntakeGroup[]): Promise<IntakeGroup[]>;
  getIntakeGroup(id: string): Promise<IntakeGroup | null>;
  updateIntakeGroup(id: string, patch: Partial<IntakeGroup>): Promise<void>;
}

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
