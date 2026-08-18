/**
 * Product term translator — vi/ms → en for Unsplash search queries.
 *
 * Why: Unsplash only supports English. Malaysian + Vietnamese users type
 * `nasi lemak` / `mì quảng`; without translation we get irrelevant stock
 * photos. GPT translation is overkill (latency, cost, non-deterministic);
 * a hand-curated dict of top food/retail/beauty terms covers the 80/20.
 *
 * Strategy:
 *   1. Check exact match in VI_MS_TO_EN dict (case-insensitive)
 *   2. Else run `franc-min` language detection
 *   3. If detected as English OR unknown (< 3 chars) → pass through
 *   4. Otherwise pass through (safer than wrong translation)
 *
 * Pure function, no I/O. franc-min is ~6kb gzipped.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-01-user-data-threading.md
 * TC coverage: TC-F01-W.06b
 */

import { franc } from 'franc-min'

/**
 * Curated vi/ms → en dictionary for top food / retail / beauty terms
 * in Malaysia + Vietnam. Keys are lowercase; lookups are case-insensitive.
 *
 * Rule of thumb: include a term only if the English form is a GOOD Unsplash
 * query (returns on-topic photos). "bun bo" → "vietnamese beef noodle soup"
 * is better than generic "noodle".
 */
export const VI_MS_TO_EN: Record<string, string> = {
  // ── Vietnamese food ──
  'phở': 'vietnamese pho noodle soup',
  'pho': 'vietnamese pho noodle soup',
  'bún bò': 'vietnamese beef noodle soup',
  'bun bo': 'vietnamese beef noodle soup',
  'bún chả': 'vietnamese grilled pork noodle',
  'bun cha': 'vietnamese grilled pork noodle',
  'mì quảng': 'vietnamese quang noodle',
  'mi quang': 'vietnamese quang noodle',
  'bánh mì': 'vietnamese banh mi sandwich',
  'banh mi': 'vietnamese banh mi sandwich',
  'bánh xèo': 'vietnamese crispy pancake',
  'banh xeo': 'vietnamese crispy pancake',
  'gỏi cuốn': 'vietnamese fresh spring roll',
  'goi cuon': 'vietnamese fresh spring roll',
  'chả giò': 'vietnamese fried spring roll',
  'cha gio': 'vietnamese fried spring roll',
  'cơm tấm': 'vietnamese broken rice',
  'com tam': 'vietnamese broken rice',
  'cà phê sữa đá': 'vietnamese iced coffee',
  'ca phe sua da': 'vietnamese iced coffee',
  'chè': 'vietnamese sweet dessert',
  'che': 'vietnamese sweet dessert',

  // ── Malay / Malaysian food ──
  'nasi lemak': 'malaysian coconut rice',
  'nasi goreng': 'indonesian fried rice',
  'nasi kandar': 'malaysian rice curry',
  'nasi kerabu': 'malaysian blue rice',
  'nasi briyani': 'biryani rice',
  'mee goreng': 'malaysian fried noodle',
  'char kway teow': 'malaysian stir fried noodle',
  'laksa': 'malaysian laksa noodle soup',
  'curry laksa': 'malaysian curry noodle',
  'asam laksa': 'malaysian sour laksa',
  'roti canai': 'malaysian flatbread',
  'roti john': 'malaysian omelette sandwich',
  'satay': 'grilled meat skewer',
  'sate': 'grilled meat skewer',
  'rendang': 'malaysian beef rendang',
  'teh tarik': 'malaysian pulled milk tea',
  'kopi o': 'malaysian black coffee',
  'kopi gula melaka': 'malaysian palm sugar coffee',
  'kopitiam': 'traditional malaysian coffee shop',
  'roti bakar kaya': 'malaysian kaya toast',
  'nasi lemak pandan': 'malaysian pandan coconut rice',
  'cendol': 'malaysian iced dessert',
  'kuih': 'malaysian traditional cake',
  'ais kacang': 'malaysian shaved ice dessert',
  'rojak': 'malaysian fruit salad',

  // ── Retail / fashion ──
  'baju kurung': 'malaysian traditional dress',
  'baju melayu': 'malaysian traditional menswear',
  'kebaya': 'southeast asian embroidered blouse',
  'batik': 'batik fabric pattern',
  'songket': 'malay brocade fabric',
  'áo dài': 'vietnamese ao dai dress',
  'ao dai': 'vietnamese ao dai dress',
  'nón lá': 'vietnamese conical hat',
  'non la': 'vietnamese conical hat',

  // ── Beauty ──
  'massage': 'spa massage',
  'gội đầu': 'hair wash salon',
  'goi dau': 'hair wash salon',
  'làm móng': 'nail salon manicure',
  'lam mong': 'nail salon manicure',
  'trang điểm': 'makeup artist',
  'trang diem': 'makeup artist',
  'kecantikan': 'beauty salon',
  'rawatan wajah': 'facial treatment',
}

const PRODUCT_TRANSLATION_ENTRIES = Object.entries(VI_MS_TO_EN)
  .sort((a, b) => b[0].length - a[0].length)

function normalizeProductLookup(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Return a deterministic English translation only when the curated dictionary
 * recognizes the whole term or a complete phrase inside it.
 */
export function translateKnownProductTerm(term: string): string | null {
  if (!term || typeof term !== 'string') return null
  const normalized = normalizeProductLookup(term)
  if (!normalized) return null

  const padded = ` ${normalized} `
  for (const [foreign, english] of PRODUCT_TRANSLATION_ENTRIES) {
    const normalizedForeign = normalizeProductLookup(foreign)
    if (normalized === normalizedForeign || padded.includes(` ${normalizedForeign} `)) {
      return english
    }
  }
  return null
}

/** Translate only recognized terms and remove duplicates without leaking raw non-English text. */
export function translateKnownProductTerms(terms: string[]): string[] {
  return [...new Set(terms.map(translateKnownProductTerm).filter((term): term is string => Boolean(term)))]
}

/**
 * Translate a single product term to English for Unsplash search.
 *
 * Logic:
 *   1. Dict hit (case-insensitive) → translation
 *   2. franc detects English → pass-through
 *   3. franc detects non-English but no dict entry → pass-through
 *      (better than wrong guess; Unsplash may still find something)
 *   4. Term too short for franc (< 3 chars) → pass-through
 */
export function translateProductTerm(term: string): string {
  if (!term || typeof term !== 'string') return term
  const trimmed = term.trim()
  if (!trimmed) return trimmed

  // Dict hit wins — even for english terms like "teh tarik" that franc may
  // classify as not vi/ms, the dict is the authoritative mapping.
  const knownTranslation = translateKnownProductTerm(trimmed)
  if (knownTranslation) return knownTranslation

  // Short strings: franc can't detect reliably; pass through.
  if (trimmed.length < 3) return trimmed

  try {
    const lang = franc(trimmed, { minLength: 3 })
    // 'eng' = English, 'und' = undetermined.
    // We only translate when (a) dict hits, which already returned above.
    // For everything else, pass through — safer than wrong translation.
    if (lang === 'eng' || lang === 'und') return trimmed
  } catch {
    // franc can throw on degenerate input; fall back to pass-through.
  }

  return trimmed
}

/**
 * Translate the FIRST product term in a list for the primary Unsplash query.
 * Returns empty string if list is empty.
 */
export function translatePrimaryProduct(products: string[] | undefined): string {
  if (!products || products.length === 0) return ''
  return translateProductTerm(products[0]!)
}
