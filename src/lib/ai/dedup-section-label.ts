/**
 * Section label / eyebrow dedup — drop the eyebrow when its text overlaps
 * semantically with the main headline. Prevents the "Why Choose Us / Why
 * customers choose X" stacked-duplicate that makes generated pages feel
 * AI-slop.
 *
 * Rule: if the headline already contains all or ≥ 2 keywords from the
 * section label (case-insensitive, stop-words ignored), drop the label.
 *
 * Plan: plans/260417-0817-wave1-wix-detailed-plan/phase-03-A3-quick-wins.md
 */

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'the', 'of', 'for', 'to', 'in', 'on', 'with', 'by',
  'our', 'your', 'my', 'us', 'we', 'you', 'i',
  'is', 'are', 'was', 'were', 'be', 'been',
  'this', 'that', 'these', 'those',
])

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

/**
 * Returns `undefined` when the section label is redundant vs the headline,
 * else returns the original label. Safe to call unconditionally.
 */
export function dedupSectionLabel(
  sectionLabel: string | undefined,
  headline: string | undefined,
): string | undefined {
  if (!sectionLabel || !headline) return sectionLabel
  const labelWords = new Set(keywords(sectionLabel))
  if (labelWords.size === 0) return sectionLabel
  const headlineWords = keywords(headline)
  const overlap = headlineWords.filter((w) => labelWords.has(w)).length
  if (overlap >= labelWords.size) return undefined
  if (overlap >= 2) return undefined
  return sectionLabel
}
