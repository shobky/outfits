/** Premium features. Off by default, per person, and each has a global off switch. */
export const FEATURES = {
  multi_photo: {
    label: "Combine photos",
    description: "Uses up to 3 photos of a piece for its studio shot. Only pieces with more than one photo cost more, about $0.031 instead of $0.025.",
  },
  worn_extract: {
    label: "Pieces from worn photos",
    description: "Finds each piece you're wearing in a photo and makes a product shot of it. About $0.016 per new piece, up to 5 per photo. Details are reconstructed, so every piece waits for your review.",
  },
  try_on: {
    label: "Try it on",
    description: "Shows you wearing an outfit, from your own photo. About $0.04 each, 5 a day. It's a preview, and it can subtly change how you look.",
  },
} as const;

export type FeatureName = keyof typeof FEATURES;
export const isFeatureName = (v: unknown): v is FeatureName => typeof v === "string" && Object.hasOwn(FEATURES, v);
