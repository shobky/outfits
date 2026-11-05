/** What comes back from a worn photo, tidied. Pure, so it can be tested without a model. */

/** Each piece is one image call, so this also caps the cost of one photo. */
export const MAX_WORN_PIECES = 5;

export interface WornCandidate {
  name: string;
  confidence: number;
  match_item_id: string | null;
}

/**
 * Most visible pieces first, up to the cap. A match only counts if that item really is
 * in this person's drawer: a made-up id must not hide a new piece.
 */
export function sortWornPieces<T extends WornCandidate>(pieces: T[], closetIds: Set<string>) {
  const clean = pieces.map((p) => ({ ...p, match_item_id: p.match_item_id && closetIds.has(p.match_item_id) ? p.match_item_id : null, confidence: Math.min(1, Math.max(0, p.confidence)) }));
  const ordered = [...clean].sort((a, b) => b.confidence - a.confidence);
  const matched = ordered.filter((p) => p.match_item_id);
  const fresh = ordered.filter((p) => !p.match_item_id).slice(0, MAX_WORN_PIECES);
  return { matched, fresh };
}

/**
 * The crop box for a tap on a photo: a head-to-toe shaped area centred on the tap and
 * kept inside the picture. All numbers are shares of the image, 0 to 1.
 */
export function cropAround(tap: { x: number; y: number }, size: number, imageAspect: number) {
  const height = Math.min(1, Math.max(0.2, size));
  // A 3:4 box, expressed as a share of the image's width.
  const width = Math.min(1, (height * 0.75) / imageAspect);
  const clamp = (v: number, span: number) => Math.min(1 - span, Math.max(0, v - span / 2));
  return { x: clamp(tap.x, width), y: clamp(tap.y, height), width, height };
}
