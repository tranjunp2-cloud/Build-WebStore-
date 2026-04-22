/**
 * block-variant-disabled-loader.ts
 * Loads the set of admin-disabled block variants from Payload CMS.
 * Returns a Set of `${blockSlug}:${variantName}` keys.
 * Call once at the start of a template generation session; pass result down to selectVariant.
 * Always returns empty set on error so gen proceeds normally.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Load disabled variants as `${blockSlug}:${variantName}` composite keys.
 * One DB query per gen session (~5ms). Safe to call in async AI gen context.
 */
export async function loadDisabledVariants(): Promise<Set<string>> {
    try {
        const payload = await getPayload({ config })
        const result = await payload.find({
            collection: 'block-variants',
            where: { enabled: { equals: false } },
            limit: 1000,
            depth: 0,
        })
        return new Set(
            result.docs.map((d) => `${d.blockSlug}:${d.variantName}`)
        )
    } catch (err) {
        // DB unavailable or schema not migrated yet — proceed with empty set
        console.warn('[block-variant-disabled-loader] loadDisabledVariants failed, using empty set', err)
        return new Set()
    }
}
