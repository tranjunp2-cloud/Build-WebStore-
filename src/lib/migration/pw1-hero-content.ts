/** Migration content is authoritative: an empty headline must stay empty. */
export function heroHeadlineForPersistence(
  block: { headline?: unknown; title?: unknown; heading?: unknown },
  migration: boolean,
): unknown {
  return migration
    ? (block.headline ?? "")
    : block.headline || block.title || block.heading || "Welcome";
}
