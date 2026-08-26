import type { Where } from 'payload'
import {
    encodePublicSlugPath,
    encodePublicSlugSegment,
} from './canonical'

/** Shared F37 public-route predicates used by route handlers and score evaluation. */
export const PUBLIC_STOREFRONT_STATUS = 'published' as const
export const APPROVED_AI_CRAWLERS_ALLOWED = true as const
export const PUBLIC_DISCOVERY_SITE_SORT = ['createdAt', 'id'] satisfies string[]
export const PUBLIC_DISCOVERY_SITE_LIMIT = 1 as const

export interface PublicDiscoveryFacts {
    approvedAiCrawlersAllowed: boolean
    sitemapPresent: boolean
    llmsTxtReachable: boolean
}

export function isPublishedStorefront(status: unknown): boolean {
    return status === PUBLIC_STOREFRONT_STATUS
}

export function publicDiscoverySiteWhere(tenantId: string | number): Where {
    return {
        and: [
            { tenant: { equals: tenantId } },
            { status: { equals: PUBLIC_STOREFRONT_STATUS } },
        ],
    }
}

function recordId(value: unknown): string | null {
    if (typeof value === 'string' || typeof value === 'number') {
        return String(value)
    }
    if (
        typeof value === 'object' &&
        value !== null &&
        'id' in value &&
        (typeof value.id === 'string' || typeof value.id === 'number')
    ) {
        return String(value.id)
    }
    return null
}

export function isSelectedPublicDiscoverySite(
    requestedSite: unknown,
    selectedPublicSite: unknown,
): boolean {
    const requestedId = recordId(requestedSite)
    return requestedId !== null && requestedId === recordId(selectedPublicSite)
}

/**
 * Sitemap and llms.txt share the same published-site route gate. Route-level
 * failures are handled by their handlers; score evaluation never performs a
 * loopback HTTP request.
 */
export function isSitemapTimestampSerializable(value: unknown): boolean {
    if (!value) return true
    try {
        return !Number.isNaN(new Date(String(value)).getTime())
    } catch {
        return false
    }
}

type PublicPageRecord = Record<string, unknown> & {
    slug?: unknown
    updatedAt?: unknown
    isHomepage?: unknown
}

type PublicContentRecord = Record<string, unknown> & {
    slug?: unknown
    updatedAt?: unknown
}

export interface PublicDiscoveryDocumentInput {
    pages: PublicPageRecord[]
    products: PublicContentRecord[]
    blogs: PublicContentRecord[]
}

function publicSlugsCanSerialize(
    input: PublicDiscoveryDocumentInput,
): boolean {
    try {
        input.pages.forEach((page) => {
            const isHomepage =
                page.isHomepage ||
                page.slug === '/' ||
                page.slug === 'home' ||
                !page.slug
            if (!isHomepage) encodePublicSlugPath(page.slug)
        })
        input.products.forEach((product) => {
            encodePublicSlugSegment(product.slug)
        })
        input.blogs.forEach((blog) => {
            encodePublicSlugSegment(blog.slug)
        })
        return true
    } catch {
        return false
    }
}

export function canSerializePublicSitemap(
    input: PublicDiscoveryDocumentInput,
): boolean {
    return (
        publicSlugsCanSerialize(input) &&
        [...input.pages, ...input.products, ...input.blogs].every((record) =>
            isSitemapTimestampSerializable(record.updatedAt),
        )
    )
}

export function canSerializePublicLlmsTxt(
    input: PublicDiscoveryDocumentInput & { openingHours: unknown },
): boolean {
    if (!publicSlugsCanSerialize(input)) return false
    if (input.openingHours == null) return true
    if (!Array.isArray(input.openingHours)) return false

    return input.openingHours.every(
        (row) => row !== null && row !== undefined,
    )
}

export function derivePublicDiscoveryFacts(input: {
    status: unknown
    tenantRouteAvailable: boolean
    publicRouteSiteSelected: boolean
    sitemapRouteAvailable: boolean
    llmsRouteAvailable: boolean
}): PublicDiscoveryFacts {
    const routesAvailable =
        isPublishedStorefront(input.status) &&
        input.tenantRouteAvailable &&
        input.publicRouteSiteSelected
    return {
        approvedAiCrawlersAllowed: APPROVED_AI_CRAWLERS_ALLOWED,
        sitemapPresent: routesAvailable && input.sitemapRouteAvailable,
        llmsTxtReachable: routesAvailable && input.llmsRouteAvailable,
    }
}
