import type { BusinessInfoInput } from './system-prompt'
import { hashString } from './seeded-random'

/**
 * Compound seed mixing user contact fields (name|email|phone) to break the
 * cross-user hash-collision class behind GH-912. Falls back to name-only when
 * optional fields are absent.
 *
 * Use everywhere a seeded RNG/hash drives content selection in the AI gen
 * pipeline (theme, image pool, sample products, post-AI swap, blog seeds).
 */
export function computeGenSeed(info: Pick<BusinessInfoInput, 'businessName' | 'email' | 'phone'>): number {
    const parts = [info.businessName, info.email, info.phone].filter(Boolean)
    return hashString(parts.join('|'))
}
