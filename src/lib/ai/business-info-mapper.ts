/**
 * Business info mapper — single source of truth for converting the wire-level
 * `BusinessInfoInput` (POST body shape) into a `Partial<BusinessSample>` that
 * composer block builders consume via `bizOverride` deep-merge.
 *
 * Design rule: user input wins when provided, canned content fills gaps.
 * Pure functions only — no I/O, no async. Import from source in tests.
 *
 * Wire-level `products` is a comma-separated string (legacy form field);
 * this module parses it into `string[]` + dedupes + trims + caps at 6.
 *
 * Plan: plans/260414-2249-ai-gen-wix-level-optimize/phase-01-user-data-threading.md
 */

import type { BusinessSample } from './content/types'
import type { BusinessInfoInput } from './system-prompt'
import type { GenerationFacts } from './generation-facts'
import { currentGenerationFacts } from './generation-facts-scope'

/** Max products kept after dedupe. Composer cards rarely exceed 6. */
const PRODUCTS_CAP = 6

/** A product the merchant typed, with the price they typed next to it (if any). */
export type ParsedProduct = {
  name: string
  /** First price found (RM amount). For "from RM120" this is the starting price. */
  price?: number
  /** True when the merchant wrote "from RMx" — the price is a starting price. */
  startingPrice?: boolean
}

/** Max products the generator creates from the merchant's list. */
export const MAX_LISTED_PRODUCTS = 20

const RM_PRICE = /\bRM\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/i

/**
 * Split on `,` `;` newline only outside parentheses. A comma between digits
 * followed by exactly three digits ("RM1,200") is a thousands separator, not a split.
 */
function splitOutsideParens(raw: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!
    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    const isThousands =
      ch === ',' && /\d/.test(raw[i - 1] ?? '') && /^\d{3}(?!\d)/.test(raw.slice(i + 1))
    if (depth === 0 && !isThousands && (ch === ',' || ch === ';' || ch === '\n')) {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts.map((s) => s.trim()).filter((s) => s.length > 0)
}

function toPrice(match: RegExpMatchArray | null): number | undefined {
  if (!match) return undefined
  const n = Number(match[1]!.replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Parse one entry: "Kek lapis (whole RM65, half RM35)", "kuih raya box RM48", "birthday from RM120". */
function parseProductEntry(entry: string): ParsedProduct | null {
  let rest = entry.replace(/\s+/g, ' ').trim()
  let price: number | undefined
  let startingPrice = false

  // First price inside parentheses is the default; a paren group holding a price is dropped from the name.
  const parenWithPrice = rest.match(/\(([^()]*\bRM\s?\d[^()]*)\)/i)
  if (parenWithPrice) {
    price = toPrice(parenWithPrice[1]!.match(RM_PRICE))
    if (/\bfrom\b/i.test(parenWithPrice[1]!.split(RM_PRICE)[0] ?? '')) startingPrice = true
    rest = rest.replace(parenWithPrice[0], ' ')
  }
  // Remaining top-level price: "kuih raya box RM48" / "birthday from RM120".
  const top = rest.match(RM_PRICE)
  if (top) {
    price ??= toPrice(top)
    if (/\bfrom\s*$/i.test(rest.slice(0, top.index ?? 0))) startingPrice = true
    rest = rest.replace(new RegExp(`\\b(?:starting\\s+)?from\\s+${RM_PRICE.source}`, 'i'), ' ').replace(RM_PRICE, ' ')
  }

  const name = rest
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:@=]+|[\s\-–—:@=]+$/g, '')
    .trim()
  const fallbackName = entry.replace(/\s+/g, ' ').trim()
  const finalName = name || fallbackName
  if (!finalName) return null
  return {
    name: finalName,
    ...(price !== undefined ? { price } : {}),
    ...(price !== undefined && startingPrice ? { startingPrice: true } : {}),
  }
}

/**
 * Parse the merchant's free-text product list into names + optional prices.
 * "Kek lapis (whole RM65, half RM35), kuih raya box RM48, birthday from RM120"
 *  → [{Kek lapis, 65}, {kuih raya box, 48}, {birthday, 120, startingPrice}]
 * Duplicate names (case-insensitive) are dropped; capped at MAX_LISTED_PRODUCTS.
 */
export function parseProducts(raw: string | undefined | null): ParsedProduct[] {
  if (!raw || typeof raw !== 'string') return []
  const seen = new Set<string>()
  const out: ParsedProduct[] = []
  for (const entry of splitOutsideParens(raw)) {
    const parsed = parseProductEntry(entry)
    if (!parsed) continue
    const key = parsed.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(parsed)
    if (out.length >= MAX_LISTED_PRODUCTS) break
  }
  return out
}

/**
 * Clean product names only (no prices, no paren price groups) — what image search,
 * keyword extraction and composer cards want.
 * "ramen, sushi, , gyoza" → ["ramen", "sushi", "gyoza"]
 * Empty/whitespace input → []
 */
export function parseProductsString(raw: string | undefined | null): string[] {
  return parseProducts(raw).map((p) => p.name)
}

/**
 * Dedupe case-insensitively while preserving first-seen casing + order.
 * Caps at PRODUCTS_CAP items to prevent layout overflow.
 */
export function dedupeNonEmpty(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of items) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
    if (out.length >= PRODUCTS_CAP) break
  }
  return out
}

/**
 * Normalize phone — strip surrounding whitespace, collapse internal whitespace.
 * Does NOT enforce format (Malaysia/Vietnam have varied formats) — just cleans
 * user typos. Empty/invalid → undefined so `biz.phone ?? canned` works.
 */
export function normalizePhone(raw: string | undefined | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined
  const cleaned = raw.trim().replace(/\s+/g, ' ')
  if (cleaned.length < 4) return undefined
  return cleaned
}

/**
 * Normalize email — lowercase + trim. Empty/invalid → undefined.
 * Final format validation happens at Zod layer.
 */
export function normalizeEmail(raw: string | undefined | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined
  const cleaned = raw.trim().toLowerCase()
  if (!cleaned.includes('@')) return undefined
  return cleaned
}

/**
 * Normalize free-form text — trim + collapse internal whitespace.
 * Empty → undefined.
 */
function normalizeText(raw: string | undefined | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined
  const cleaned = raw.trim().replace(/\s+/g, ' ')
  return cleaned.length > 0 ? cleaned : undefined
}

/**
 * Map wire `BusinessInfoInput` → `Partial<BusinessSample>` for composer override.
 *
 * - `name` from `businessName` (trimmed)
 * - `tagline` from explicit `tagline`, else first 120 chars of `shortDescription`
 * - `description` from `shortDescription`
 * - `phone/email/address` normalized
 * - `products` parsed from comma-separated string → string[] deduped
 *
 * Returns only keys with non-empty values, so the downstream shallow-merge
 * leaves canned content in place for undefined fields.
 */
export function mapBusinessInfo(
  info: BusinessInfoInput,
  facts: GenerationFacts | undefined = currentGenerationFacts(),
): Partial<BusinessSample> {
  const out: Partial<BusinessSample> = {}

  const name = normalizeText(info.businessName)
  if (name) out.name = name

  const description = normalizeText(info.shortDescription)
  if (description) out.description = description

  // Fallback hero copy derived from user input so canned baseBiz hero text
  // never bleeds through when personalizeWithGPT times out (GH-912).
  // GPT overrides these fields on success; this is the safe fallback only.
  if (name) {
    out.heroHeadline = name.slice(0, 100)
    if (description) out.heroSubheadline = description.slice(0, 200)
  }

  const explicitTagline = normalizeText(info.tagline)
  if (explicitTagline) {
    out.tagline = explicitTagline
  } else if (description) {
    out.tagline = description.length > 120 ? description.slice(0, 117) + '...' : description
  }

  const phone = normalizePhone(info.phone)
  if (phone) out.phone = phone

  const email = normalizeEmail(info.email)
  if (email) out.email = email

  const address = normalizeText(info.address)
  if (address) out.address = address

  const products = dedupeNonEmpty(parseProductsString(info.products))
  if (products.length > 0) out.products = products

  if (facts) out.facts = facts

  return out
}
