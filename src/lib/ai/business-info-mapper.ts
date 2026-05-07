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

/** Max products kept after dedupe. Composer cards rarely exceed 6. */
const PRODUCTS_CAP = 6

/**
 * Parse comma-separated products string into a clean string[].
 * "ramen, sushi, , gyoza" → ["ramen", "sushi", "gyoza"]
 * Empty/whitespace input → []
 */
export function parseProductsString(raw: string | undefined | null): string[] {
  if (!raw || typeof raw !== 'string') return []
  return raw
    .split(/[,;\n]/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
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
export function mapBusinessInfo(info: BusinessInfoInput): Partial<BusinessSample> {
  const out: Partial<BusinessSample> = {}

  const name = normalizeText(info.businessName)
  if (name) out.name = name

  const description = normalizeText(info.shortDescription)
  if (description) out.description = description

  // Fallback hero copy derived from user input so canned baseBiz hero text
  // never bleeds through when personalizeWithGPT times out (GH-912).
  // GPT overrides these fields on success; this is the safe fallback only.
  if (name) {
    out.heroHeadline = name
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

  return out
}
