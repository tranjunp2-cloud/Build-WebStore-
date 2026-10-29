import type { BasePayload } from 'payload'
import { getBlogSeeds } from './content/blog-seeds'
import { generateBlogSeedsAI, generateBlogPostContent, isQuotaExhausted, type BlogSeedAI } from './generate-blog-seeds'
import { uploadImageUrl } from './upload-media'
import { getBlogThumbnails } from '@/lib/images/blog-thumbnail-images'
import {
    searchPhotos,
    PixabayError,
    PIXABAY_CATEGORY_BY_COMPOSER,
    markPixabayMediaUsed,
} from './pixabay-client'
import { normalizeComposerCategory } from './composer-category-resolver'
import { findOrCreateCartonMedia } from '@/lib/media/carton-placeholder'
import type { BlogPost } from './content/types'

type AnyBlogSeed = BlogSeedAI | BlogPost

async function isValidMedia(id: number, payload: BasePayload): Promise<boolean> {
    const m = await payload.findByID({ collection: 'media', id, depth: 0 }).catch(() => null)
    return (
        m != null &&
        typeof m.filename === 'string' && m.filename.length > 0 &&
        typeof m.mimeType === 'string' && m.mimeType.length > 0 &&
        typeof m.filesize === 'number' && m.filesize > 0
    )
}

async function fetchBlogThumbnail(
    seed: AnyBlogSeed,
    i: number,
    blogThumbnails: string[],
    tenantId: number | string,
    category: string,
    searchRateLimited: boolean,
    payload: BasePayload,
): Promise<{ thumbnailId: number | undefined; wasRateLimited: boolean }> {
    const filename = `blog-${tenantId}-${seed.slug}.jpg`
    const upload = (url: string) => uploadImageUrl(url, filename, seed.title, tenantId, payload)
    const keyword =
        ('imageKeyword' in seed && seed.imageKeyword) ||
        ('category' in seed && seed.category) ||
        category
    let wasRateLimited = false

    // Tier A: Pixabay search
    if (!searchRateLimited) {
        try {
            // GH-1185: site-domain filter — blog topics follow the site's
            // industry, so a loose keyword match still lands on-domain.
            const pixCategory = PIXABAY_CATEGORY_BY_COMPOSER[normalizeComposerCategory(category)]
            const photos = await searchPhotos(keyword, 1, {
                orientation: 'landscape',
                width: 1200,
                category: pixCategory,
                timeoutMs: 6_000,
            })
            if (photos.length > 0) {
                const photo = photos[0]!
                // photo.url is already sized by the client (Pixabay fixed sizes).
                const id = await upload(photo.url)
                if (id !== undefined && await isValidMedia(id, payload)) return { thumbnailId: id, wasRateLimited }
                console.warn(`[seed-blog-posts] Tier A orphan for "${seed.slug}", falling to Tier B`)
            }
        } catch (err) {
            if (err instanceof PixabayError && err.code === 'RATE_LIMITED') {
                wasRateLimited = true
                console.warn(`[seed-blog-posts] Pixabay rate-limited for "${seed.slug}", using curated URL`)
            } else {
                console.warn(`[seed-blog-posts] Tier A failed for "${seed.slug}":`, (err as Error).message)
            }
        }
    }

    // Tier B: curated CDN URL (stable, bypasses search API)
    try {
        const fallbackUrl = blogThumbnails[i % blogThumbnails.length]!
        const id = await upload(fallbackUrl)
        if (id !== undefined && await isValidMedia(id, payload)) return { thumbnailId: id, wasRateLimited }
        console.warn(`[seed-blog-posts] Tier B orphan for "${seed.slug}", falling to Tier C`)
    } catch (err) {
        console.warn(`[seed-blog-posts] Tier B failed for "${seed.slug}":`, (err as Error).message)
    }

    // Tier C: carton placeholder — local file, zero external dependency
    const carton = await findOrCreateCartonMedia(payload, tenantId).catch(() => null)
    if (carton) {
        console.warn(`[seed-blog-posts] Tier C carton used for "${seed.slug}"`)
        return { thumbnailId: carton.id, wasRateLimited }
    }

    console.warn(`[seed-blog-posts] all tiers failed for "${seed.slug}"`)
    return { thumbnailId: undefined, wasRateLimited }
}

function disambiguateSlugs(seeds: AnyBlogSeed[]): AnyBlogSeed[] {
    const counts = new Map<string, number>()
    return seeds.map((seed) => {
        const base = seed.slug.toLowerCase()
        const n = counts.get(base) ?? 0
        counts.set(base, n + 1)
        return n === 0 ? seed : { ...seed, slug: `${seed.slug}-${n}` }
    })
}

function escapeHtml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;')
}

export function buildFallbackBlogContent(
    seed: Pick<AnyBlogSeed, 'title' | 'excerpt'>,
    businessName: string,
    locale: string = 'en',
): string {
    const title = escapeHtml(seed.title)
    const excerpt = escapeHtml(seed.excerpt)
    const name = escapeHtml(businessName)
    if (locale.split('-')[0].toLowerCase() !== 'en') {
        return `<h2>${title}</h2><p>${excerpt}</p>`
    }
    return `<h2>${title}</h2><p>${excerpt}</p><h3>Why it matters</h3><p>${name} focuses on practical choices, clear expectations, and dependable results. Use this guide as a starting point, then choose the option that best matches your needs.</p><h3>What to consider</h3><ul><li>Define the outcome you need before comparing options.</li><li>Ask questions about quality, timing, and ongoing support.</li><li>Choose a solution that remains useful as your needs change.</li></ul><h3>Next steps</h3><p>Contact ${name} for advice tailored to your situation and a clear path forward.</p>`
}

function buildLocaleSafeFallbackSeeds(
    businessName: string,
    products: string[] | undefined,
    category: string,
    count: number,
): BlogSeedAI[] {
    const topics = products?.map((product) => product.trim()).filter(Boolean) ?? []
    return Array.from({ length: count }, (_, index) => {
        const topic = topics[index % Math.max(topics.length, 1)] || businessName
        return {
            title: topic,
            excerpt: topic === businessName ? businessName : `${businessName} — ${topic}`,
            slug: `post-${index + 1}`,
            imageKeyword: `${category} service`,
        }
    })
}

export type PreparedBlogPost = {
    title: string
    slug: string
    content: string
    thumbnailId?: number
    /** English stock-image subject retained only for F38 deferred assignment. */
    imageKeyword?: string
}

export function assignResolvedBlogThumbnails(
    prepared: PreparedBlogPost[],
    thumbnailIds: readonly (number | undefined)[],
): PreparedBlogPost[] {
    return prepared.map((post, index) => ({
        ...post,
        ...(thumbnailIds[index] !== undefined ? { thumbnailId: thumbnailIds[index] } : {}),
    }))
}

/**
 * Phase 1 — no site dependency: AI seed topics + full article bodies (3
 * parallel GPT calls, 12s-bounded each) + thumbnails. gen-perf blog-inline:
 * the route kicks this DURING the site GPT window so `persistBlogPosts` can
 * insert all 3 posts BEFORE the `done` event; also reused by the fallback
 * `seedBlogPosts` path.
 * Always prepares exactly three posts. Existing/default tenant posts are
 * replaced only after preparation succeeds, inside `persistBlogPosts`.
 * Returns null when preparation failed entirely. Never throws.
 */
export async function prepareBlogPosts(opts: {
    payload: BasePayload
    tenantId: number | string
    category: string
    businessName: string
    products?: string[]
    industry?: string
    seed?: number
    locale?: string
    /** Settles when the request's other Pixabay consumers (image pool,
     *  sample products) finished searching — the thumbnail phase waits for
     *  it so blog searches never compete for the rate limit (GH-1190). */
    pixabayGate?: Promise<unknown>
    /** F38: prepare text and image demands without any provider request. */
    skipImages?: boolean
}): Promise<PreparedBlogPost[] | null> {
    const { payload, tenantId, category, businessName, products, industry, seed, locale = 'en' } = opts
    try {
        let seeds: AnyBlogSeed[] = []
        try {
            const aiSeeds = await generateBlogSeedsAI({
                businessName,
                industry: industry ?? category,
                products,
                locale,
            })
            seeds = aiSeeds.slice(0, 3)
        } catch (err) {
            const fallbackKind = locale.split('-')[0].toLowerCase() === 'en'
                ? 'static seeds'
                : 'locale-safe seeds'
            if (isQuotaExhausted(err)) {
                console.warn(`[seed-blog-posts] OpenAI quota exhausted, using ${fallbackKind}`)
            } else {
                console.warn(`[seed-blog-posts] AI gen failed, using ${fallbackKind}:`, (err as Error).message)
            }
        }

        if (seeds.length < 3) {
            const need = 3 - seeds.length
            const usedSlugs = new Set(seeds.map((s) => s.slug.toLowerCase()))
            const fill = locale.split('-')[0].toLowerCase() === 'en'
                ? getBlogSeeds(
                    category,
                    {
                        name: businessName,
                        ...(products?.length ? { products } : {}),
                    },
                    seed,
                )
                    .filter((s) => !usedSlugs.has(s.slug.toLowerCase()))
                    .slice(0, need)
                : buildLocaleSafeFallbackSeeds(businessName, products, category, need)
            seeds = [...seeds, ...fill]
        }

        seeds = disambiguateSlugs(seeds)

        // Article bodies are independent of Pixabay — start all 3 GPT calls
        // now so they overlap the thumbnail phase below.
        const contentPromises = seeds.map((s) =>
            generateBlogPostContent(s.title, businessName, industry ?? category, locale).catch(() => undefined),
        )

        if (opts.skipImages) {
            const contents = await Promise.all(contentPromises)
            return seeds.map((s, i) => ({
                title: s.title,
                slug: s.slug,
                content: contents[i] ?? buildFallbackBlogContent(s, businessName, locale),
                imageKeyword:
                    ('imageKeyword' in s && s.imageKeyword) ||
                    ('category' in s && s.category) ||
                    category,
            }))
        }

        // Thumbnails keep the legacy sequencing (one at a time, 500ms apart,
        // rate-limit short-circuit) — gentle on Pixabay, and gated behind the
        // request's other Pixabay consumers (GH-1190).
        if (opts.pixabayGate) await opts.pixabayGate.catch(() => undefined)

        // Per-category landscape fallbacks (1200×630) — one distinct image per seed index.
        const blogThumbnails = getBlogThumbnails(category)
        const firstThumbnail = await fetchBlogThumbnail(
            seeds[0]!, 0, blogThumbnails, tenantId, category, false, payload,
        )
        console.log(`[seed-blog-posts] blog 1/${seeds.length} "${seeds[0]!.slug}" → thumbnailId=${firstThumbnail.thumbnailId ?? 'none'}`)
        const remainingThumbnails = await Promise.all(seeds.slice(1).map(async (seed, offset) => {
            const i = offset + 1
            const { thumbnailId } = await fetchBlogThumbnail(
                seed, i, blogThumbnails, tenantId, category, firstThumbnail.wasRateLimited, payload,
            )
            console.log(`[seed-blog-posts] blog ${i + 1}/${seeds.length} "${seed.slug}" → thumbnailId=${thumbnailId ?? 'none'}`)
            return thumbnailId
        }))
        const thumbnailIds = [firstThumbnail.thumbnailId, ...remainingThumbnails]

        const contents = await Promise.all(contentPromises)
        return seeds.map((s, i) => ({
            title: s.title,
            slug: s.slug,
            content: contents[i] ?? buildFallbackBlogContent(s, businessName, locale),
            ...(thumbnailIds[i] !== undefined ? { thumbnailId: thumbnailIds[i] } : {}),
        }))
    } catch (err) {
        console.warn('[seed-blog-posts] prepare failed (non-fatal):', (err as Error).message)
        return null
    }
}

/**
 * Phase 2 — needs the created site: insert the prepared posts. Split from
 * prepare so the route can run it inline before `done`. Never throws;
 * per-post failures are logged and skipped.
 */
export async function persistBlogPosts(
    payload: BasePayload,
    prepared: PreparedBlogPost[],
    tenantId: number | string,
    siteId: number | string,
    userId: number | string,
): Promise<number> {
    if (prepared.length === 0) return 0

    try {
        await payload.delete({
            collection: 'blogs',
            where: { tenant: { equals: tenantId } },
            overrideAccess: true,
        })
    } catch (err) {
        console.warn('[seed-blog-posts] failed to replace existing posts:', (err as Error).message)
        return 0
    }

    let count = 0
    for (const post of prepared) {
        // Guard against re-seed slug collision (tenant deleted all posts and regenerated)
        let finalSlug = `${tenantId}-${post.slug}`
        try {
            const slugCheck = await payload.find({
                collection: 'blogs',
                where: { slug: { equals: finalSlug }, tenant: { equals: tenantId } },
                limit: 1,
                // a trashed post can be restored: its slug is still taken
                trash: true,
            })
            if (slugCheck.totalDocs > 0) finalSlug = `${finalSlug}-${Math.random().toString(36).slice(2, 8)}`
        } catch { /* proceed with original slug */ }

        try {
            await payload.create({
                collection: 'blogs',
                data: {
                    tenant: tenantId,
                    site: siteId,
                    title: post.title,
                    slug: finalSlug,
                    content: post.content,
                    // #2103 A4: the generated site is a draft, so its AI posts are drafts too; the first
                    // publish of the site takes them live (publishSeededBlogPosts in publish-site.ts).
                    status: 'draft',
                    // explicit marker: the site's first publish promotes exactly these (publishSeededBlogPosts)
                    aiSeeded: true,
                    author: userId,
                    ...(post.thumbnailId !== undefined ? { thumbnail: post.thumbnailId } : {}),
                },
                context: { skipPublishNotify: true },
            })
            count++
            if (post.thumbnailId !== undefined) markPixabayMediaUsed([post.thumbnailId])
        } catch (err) {
            console.warn(`[seed-blog-posts] post "${post.slug}" failed (non-fatal):`, (err as Error).message)
        }
    }
    return count
}

/** Legacy single-shot fallback: prepare + persist. */
export async function seedBlogPosts(
    payload: BasePayload,
    tenantId: number | string,
    siteId: number | string,
    category: string,
    businessName: string,
    userId: number | string,
    products?: string[],
    industry?: string,
    seed?: number,
    locale?: string,
): Promise<number> {
    const prepared = await prepareBlogPosts({
        payload, tenantId, category, businessName, products, industry, seed, locale,
    })
    if (!prepared || prepared.length === 0) return 0
    return persistBlogPosts(payload, prepared, tenantId, siteId, userId)
}
