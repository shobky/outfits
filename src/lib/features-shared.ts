/** Premium features. Off by default, per person, and each has a global off switch. */
export const FEATURES = {
  multi_photo: {
    label: "Combine photos",
    description: "Uses up to 3 photos of a piece for its studio shot. Only pieces with more than one photo cost more, about $0.031 instead of $0.025.",
  },
} as const;

export type FeatureName = keyof typeof FEATURES;
export const isFeatureName = (v: unknown): v is FeatureName => typeof v === "string" && Object.hasOwn(FEATURES, v);
