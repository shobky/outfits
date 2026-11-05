/**
 * ChatGPT-plan models sometimes write citations as U+E200 cite U+E202 turn0search0 U+E201.
 * These are private-use characters with no meaning outside ChatGPT, and the real
 * sources already arrive separately. A marker that hasn't closed yet is removed too,
 * so it can't flash up while a reply streams.
 */
const MARKER = /[ \t]*[^]*(?:|$)/g;

export const stripCitationMarkers = (text: string) => text.replace(MARKER, "");
