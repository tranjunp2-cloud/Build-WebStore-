/**
 * Library identity isolation (#2103 A1 / TC-AIAUD-160..162).
 *
 * `src/lib/ai/content/*.ts` ships sample businesses ("Farah Glow Studio",
 * Bangsar address, +60 numbers, glow@farahstudio.my …) for the template gallery
 * and tests. They describe fictional businesses, so on a real merchant's site
 * they must never appear — not as a name, description, tagline or contact line.
 *
 * Every real-generation path derives its `BusinessSample` through this helper:
 * identity + contact come from the merchant (override / FACTS) or stay empty.
 * Only category-level copy (hero headline/subheadline, products) of the sample
 * may remain, because it is generic marketing text without identity.
 */

import type { BusinessSample } from './content/types'

const IDENTITY_AND_CONTACT_KEYS = ['name', 'tagline', 'description', 'address', 'phone', 'email'] as const

/**
 * Merge a merchant override over a library sample while dropping the sample's
 * identity + contact fields. Those fall back to the merchant FACTS
 * (brand / description / contact) carried on `override.facts`, otherwise ''.
 */
export function withoutLibraryIdentity(
  base: BusinessSample,
  override?: Partial<BusinessSample>,
): BusinessSample {
  const defined: Partial<BusinessSample> = {}
  if (override) {
    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined) (defined as Record<string, unknown>)[key] = value
    }
  }
  const blank = Object.fromEntries(IDENTITY_AND_CONTACT_KEYS.map((k) => [k, ''])) as Pick<
    BusinessSample,
    (typeof IDENTITY_AND_CONTACT_KEYS)[number]
  >
  const facts = override?.facts
  const fromFacts: Partial<BusinessSample> = {}
  if (facts?.brand?.trim()) fromFacts.name = facts.brand.trim()
  if (facts?.description?.trim()) fromFacts.description = facts.description.trim()
  if (facts?.contact?.phone?.trim()) fromFacts.phone = facts.contact.phone.trim()
  if (facts?.contact?.email?.trim()) fromFacts.email = facts.contact.email.trim()
  if (facts?.contact?.address?.trim()) fromFacts.address = facts.contact.address.trim()
  return {
    ...base,
    ...blank,
    ...fromFacts,
    ...defined,
  }
}
