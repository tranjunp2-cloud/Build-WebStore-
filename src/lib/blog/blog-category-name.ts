import type { Payload } from 'payload'
import { romanizeCjk, stableSlugSuffix } from '@/lib/utils/slug-romanize'

// The code lives in a client-safe module (the category screens import it); re-exported for server callers.
export { BLOG_CATEGORY_DUPLICATE_CODE } from './blog-category-codes'

/**
 * URL slug for a blog category name: lowercase, accents stripped ("đ" → "d"), Chinese/Japanese romanized,
 * words joined by "-". A name with no letters left (emoji, symbols) gets `category-<hash of the name>`:
 * the slug field is required, and the same name must keep giving the same slug for the duplicate check (GH-2317).
 */
export function toBlogCategorySlug(name: string): string {
    const slug = romanizeCjk(name)
        .toLowerCase()
        .replace(/đ/g, 'd')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
    // Hash the name the way Latin names compare (case and repeated spaces ignored), so "🍜  🍜" = "🍜 🍜".
    const key = name.trim().replace(/\s+/g, ' ').toLowerCase()
    return slug || (key ? `category-${stableSlugSuffix(key)}` : '')
}

/**
 * True when another category of the tenant already uses this name (GH-2265).
 * Names match by slug, so "recent news" = "Recent News". A stored slug that equals it counts too:
 * renaming through the API keeps the old slug, and the (tenant, slug) unique index still holds it.
 */
export async function blogCategoryNameTaken(
    payload: Payload,
    { tenantId, name, excludeId }: { tenantId: string | number; name: string; excludeId?: string | number },
): Promise<boolean> {
    const slug = toBlogCategorySlug(name)
    if (!slug) return false
    const { docs } = await payload.find({
        collection: 'blog_categories',
        where: { tenant: { equals: tenantId } },
        pagination: false,
        depth: 0,
        select: { name: true, slug: true },
    })
    return docs.some(category =>
        String(category.id) !== String(excludeId)
        && (category.slug === slug || toBlogCategorySlug(String(category.name ?? '')) === slug),
    )
}
