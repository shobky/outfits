import type { IntakeView } from "../types";

/** The main photo plus two more. More raises the cost with little visible gain. */
export const MAX_REFERENCES = 2;

/**
 * The other photos of a piece, to send alongside the one being styled. Close-ups come
 * first because they carry the detail the main photo can't show. Photos of the opposite
 * side come last because they're the likeliest to confuse which side should be shown.
 */
export function pickReferences(views: IntakeView[], target: IntakeView, max = MAX_REFERENCES) {
  const others = views.filter((v) => v !== target && v.photo_url !== target.photo_url);
  return [...others.filter((v) => v.view === "detail"), ...others.filter((v) => v.view !== "detail")].slice(0, max);
}
