import 'server-only'

import { createHash } from 'node:crypto'
import { calculateContentQualityScore, pageNeedsContentImprovement } from './content-score'
import { generateSchemaGenerationArtifact } from './json-ld'
import { calculateSchemaScore } from './schema-score'
import { isCompatibleSchemaSubtype } from './local-business-constants'
import {
    hasValidGeoCoordinates,
    isValidOpeningTimeRange,
    priceRangeForLocalBusinessCategory,
} from './schema-helpers'
import {
    calculateBusinessDataScore,
    calculateLocalSeoScore,
} from './local-seo-score'
import {
    canSerializePublicLlmsTxt,
    canSerializePublicSitemap,
    derivePublicDiscoveryFacts,
    isSelectedPublicDiscoverySite,
    PUBLIC_DISCOVERY_SITE_LIMIT,
    PUBLIC_DISCOVERY_SITE_SORT,
    publicDiscoverySiteWhere,
} from './public-discovery-facts'
import {
    localSeoScoreResponseSchema,
    metadataFixItemSchema,
    type LocalSeoScoreResponse,
    type MetadataFixItem,
    type SeoHealthIssue,
} from './local-seo-score-contract'

const PAGE_SIZE = 100
const MAX_RECORDS_PER_COLLECTION = 10_000

const SITE_SCORE_SELECT = {
    id: true,
    tenant: true,
    name: true,
    domain: true,
    status: true,
    updatedAt: true,
    contactInfo: true,
    localBusiness: true,
    seo: true,
} as const

const PUBLIC_ROUTE_SITE_SELECT = {
    id: true,
} as const

const COLLECTION_SCORE_SELECT = {
    pages: {
        id: true,
        title: true,
        name: true,
        slug: true,
        isHomepage: true,
        createdAt: true,
        updatedAt: true,
        _status: true,
        seo: true,
        layout: true,
    },
    products: {
        id: true,
        name: true,
        title: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        seo: true,
        shortDescription: true,
        description: true,
        images: true,
    },
    blogs: {
        id: true,
        title: true,
        name: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
        seo: true,
        excerpt: true,
    },
} as const

type ScoredCollectionName = 'pages' | 'products' | 'blogs'
type PayloadCollectionName = ScoredCollectionName | 'sites'
type DocumentRecord = Record<string, unknown> & { id: string | number }

type FindResult = {
    docs: unknown[]
    hasNextPage?: boolean
}

export interface LocalSeoPayload {
    findByID(args: {
        collection: 'sites'
        id: string
        depth: number
        disableErrors: boolean
        select: Record<string, boolean>
    }): Promise<unknown>
    find(args: {
        collection: PayloadCollectionName
        where: Record<string, unknown>
        page?: number
        limit: number
        depth: number
        sort: string | string[]
        select: Record<string, boolean>
    }): Promise<FindResult>
}

interface LocalSeoSnapshot {
    site: DocumentRecord
    pages: DocumentRecord[]
    products: DocumentRecord[]
    blogs: DocumentRecord[]
    publicRouteSite: DocumentRecord | null
}

export interface LocalSeoEvaluation {
    response: LocalSeoScoreResponse
    metadataItems: MetadataFixItem[]
}

export class LocalSeoSnapshotChangedError extends Error {
    constructor() {
        super('Local SEO inputs changed while the score was being evaluated')
        this.name = 'LocalSeoSnapshotChangedError'
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function present(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0
}

function relationId(value: unknown): string | null {
    if (typeof value === 'string' || typeof value === 'number')
        return String(value)
    return isRecord(value) &&
        (typeof value.id === 'string' || typeof value.id === 'number')
        ? String(value.id)
        : null
}

function tenantRouteContextAvailable(value: unknown): boolean {
    return isRecord(value) && present(value.slug)
}

function publicDiscoveryDocuments(snapshot: LocalSeoSnapshot) {
    return {
        pages: snapshot.pages.filter((page) => {
            const seo = isRecord(page.seo) ? page.seo : {}
            return page._status === 'published' && seo.noIndex !== true
        }),
        products: snapshot.products,
        blogs: snapshot.blogs,
    }
}

async function findAll(
    payload: LocalSeoPayload,
    collection: ScoredCollectionName,
    where: Record<string, unknown>,
): Promise<DocumentRecord[]> {
    const docs: DocumentRecord[] = []
    for (let page = 1; ; page += 1) {
        const result = await payload.find({
            collection,
            where,
            page,
            limit: PAGE_SIZE,
            depth: 0,
            sort: ['createdAt', 'id'],
            select: COLLECTION_SCORE_SELECT[collection],
        })
        const batch = result.docs.filter(
            (doc): doc is DocumentRecord =>
                isRecord(doc) &&
                (typeof doc.id === 'string' || typeof doc.id === 'number'),
        )
        docs.push(...batch)
        if (docs.length > MAX_RECORDS_PER_COLLECTION) {
            throw new Error(`Local SEO ${collection} safety ceiling exceeded`)
        }
        if (result.hasNextPage === false || result.docs.length < PAGE_SIZE)
            break
        if (result.hasNextPage !== true && result.docs.length === 0) break
    }
    return docs
}

async function loadSnapshot(
    payload: LocalSeoPayload,
    siteId: string,
    authorizedTenantId: string,
): Promise<LocalSeoSnapshot> {
    const loadedSite = await payload.findByID({
        collection: 'sites',
        id: siteId,
        depth: 1,
        disableErrors: true,
        select: SITE_SCORE_SELECT,
    })
    if (
        !isRecord(loadedSite) ||
        (typeof loadedSite.id !== 'string' && typeof loadedSite.id !== 'number')
    ) {
        throw new Error(
            'Authorized site disappeared during Local SEO evaluation',
        )
    }
    const site: DocumentRecord = loadedSite as DocumentRecord
    const tenantId = relationId(site.tenant)
    if (tenantId !== authorizedTenantId) {
        throw new Error(
            'Authorized site tenant changed during Local SEO evaluation',
        )
    }
    const tenantFilter = tenantId ? [{ tenant: { equals: tenantId } }] : []
    const [pages, products, blogs, publicRouteSiteResult] = await Promise.all([
        findAll(payload, 'pages', {
            and: [
                { site: { equals: siteId } },
                { isVisible: { not_equals: false } },
                { deletedAt: { exists: false } },
            ],
        }),
        findAll(payload, 'products', {
            and: [
                { site: { equals: siteId } },
                ...tenantFilter,
                { status: { equals: 'active' } },
                { deletedAt: { exists: false } },
            ],
        }),
        findAll(payload, 'blogs', {
            and: [
                { site: { equals: siteId } },
                ...tenantFilter,
                { status: { equals: 'published' } },
            ],
        }),
        payload.find({
            collection: 'sites',
            where: publicDiscoverySiteWhere(tenantId),
            page: 1,
            limit: PUBLIC_DISCOVERY_SITE_LIMIT,
            depth: 0,
            sort: PUBLIC_DISCOVERY_SITE_SORT,
            select: PUBLIC_ROUTE_SITE_SELECT,
        }),
    ])
    const publicRouteSite =
        publicRouteSiteResult.docs.find(
            (doc): doc is DocumentRecord =>
                isRecord(doc) &&
                (typeof doc.id === 'string' || typeof doc.id === 'number'),
        ) ?? null
    return { site, pages, products, blogs, publicRouteSite }
}

function snapshotToken(snapshot: LocalSeoSnapshot): string {
    return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')
}

function seoFields(
    record: DocumentRecord,
    collection: ScoredCollectionName,
): {
    title?: string
    description?: string
} {
    const seo = isRecord(record.seo) ? record.seo : {}
    return collection === 'blogs'
        ? {
              title: present(seo.metaTitle) ? seo.metaTitle : undefined,
              description: present(seo.metaDescription)
                  ? seo.metaDescription
                  : undefined,
          }
        : {
              title: present(seo.title) ? seo.title : undefined,
              description: present(seo.description)
                  ? seo.description
                  : undefined,
          }
}

function recordLabel(
    record: DocumentRecord,
    collection: ScoredCollectionName,
): string {
    const candidates =
        collection === 'products'
            ? [record.name, record.title]
            : [record.title, record.name]
    return (
        candidates.find(present)?.trim() ||
        `Untitled ${collection.slice(0, -1)}`
    )
}

function recordContext(
    record: DocumentRecord,
    collection: ScoredCollectionName,
): string | undefined {
    const direct =
        collection === 'products'
            ? [record.shortDescription, record.description]
            : collection === 'blogs'
              ? [record.excerpt]
              : []
    const directText = direct.find(present)
    if (directText) return directText.trim().slice(0, 500)
    if (collection !== 'pages' || !Array.isArray(record.layout))
        return undefined
    const text = record.layout
        .flatMap((block) => {
            if (!isRecord(block)) return []
            return [
                block.headline,
                block.subheadline,
                block.description,
                block.content,
                block.body,
                block.sectionLabel,
            ].filter(present)
        })
        .join(' ')
        .trim()
    return text ? text.slice(0, 500) : undefined
}

function collectMetadataItems(snapshot: LocalSeoSnapshot): MetadataFixItem[] {
    const groups: Array<[ScoredCollectionName, DocumentRecord[]]> = [
        ['pages', snapshot.pages],
        ['products', snapshot.products],
        ['blogs', snapshot.blogs],
    ]
    return groups.flatMap(([collection, records]) =>
        records.flatMap((record) => {
            const current = seoFields(record, collection)
            const missingFields: Array<'title' | 'description'> = []
            if (!current.title) missingFields.push('title')
            if (!current.description) missingFields.push('description')
            if (missingFields.length === 0) return []
            return [
                metadataFixItemSchema.parse({
                    collection,
                    id: String(record.id),
                    title: recordLabel(record, collection).slice(0, 300),
                    context: recordContext(record, collection),
                    missingFields,
                    currentTitle: current.title?.trim().slice(0, 500),
                    currentDescription: current.description
                        ?.trim()
                        .slice(0, 2_000),
                }),
            ]
        }),
    )
}

function productHasMissingAlt(product: DocumentRecord): boolean {
    if (!Array.isArray(product.images)) return false
    return product.images.some((image) => {
        if (!isRecord(image)) return false
        if (present(image.alt)) return false
        return !isRecord(image.image) || !present(image.image.alt)
    })
}

function deriveIssues(
    snapshot: LocalSeoSnapshot,
    metadataItems: MetadataFixItem[],
    contentIssue: {
        page: DocumentRecord
        count: number
    } | undefined,
    missingAltProducts: DocumentRecord[],
): SeoHealthIssue[] {
    const { site } = snapshot
    const siteId = String(site.id)
    const localBusiness = isRecord(site.localBusiness) ? site.localBusiness : {}
    const contactInfo = isRecord(site.contactInfo) ? site.contactInfo : {}
    const seo = isRecord(site.seo) ? site.seo : {}
    const titleCount = metadataItems.filter((item) =>
        item.missingFields.includes('title'),
    ).length
    const descriptionCount = metadataItems.filter((item) =>
        item.missingFields.includes('description'),
    ).length
    const issues: Array<SeoHealthIssue & { impact: number }> = []
    const add = (issue: SeoHealthIssue, impact: number) =>
        issues.push({ ...issue, impact })

    if (!present(site.name))
        add(
            {
                id: 'store-name',
                code: 'store-name',
                count: 1,
                action: { kind: 'edit-store-name', siteId },
            },
            10,
        )
    if (
        ![
            present(contactInfo.address)
                ? contactInfo.address
                : localBusiness.streetAddress,
            localBusiness.city,
            localBusiness.postcode,
        ].every(present)
    ) {
        add(
            {
                id: 'business-address',
                code: 'business-address',
                count: 1,
                action: { kind: 'edit-business-address', siteId },
            },
            18,
        )
    }
    if (!present(contactInfo.phone))
        add(
            {
                id: 'phone',
                code: 'phone',
                count: 1,
                action: { kind: 'edit-phone', siteId },
            },
            8,
        )
    const compatibleSubtype =
        present(localBusiness.businessCategory) &&
        present(localBusiness.schemaSubtype) &&
        isCompatibleSchemaSubtype(
            localBusiness.businessCategory,
            localBusiness.schemaSubtype,
        )
    const hasOpeningHours =
        Array.isArray(localBusiness.openingHours) &&
        localBusiness.openingHours.some(
            (row) =>
                isRecord(row) &&
                row.isClosed !== true &&
                isValidOpeningTimeRange(row.opens, row.closes),
        )
    const hasGeo = hasValidGeoCoordinates(
        localBusiness.latitude,
        localBusiness.longitude,
    )
    const hasPriceRange =
        present(localBusiness.priceRange) ||
        Boolean(
            priceRangeForLocalBusinessCategory(localBusiness.businessCategory),
        )

    if (!compatibleSubtype)
        add(
            {
                id: 'schema-subtype',
                code: 'schema-subtype',
                count: 1,
                action: { kind: 'edit-schema-subtype', siteId },
            },
            4,
        )
    if (!hasOpeningHours)
        add(
            {
                id: 'opening-hours',
                code: 'opening-hours',
                count: 1,
                action: { kind: 'edit-opening-hours', siteId },
            },
            5,
        )
    if (!hasGeo)
        add(
            {
                id: 'map-location',
                code: 'map-location',
                count: 1,
                action: { kind: 'edit-map-location', siteId },
            },
            4,
        )
    if (!hasPriceRange)
        add(
            {
                id: 'price-range',
                code: 'price-range',
                count: 1,
                action: { kind: 'edit-price-range', siteId },
            },
            3,
        )
    if (!present(site.domain))
        add(
            {
                id: 'primary-domain',
                code: 'primary-domain',
                count: 1,
                action: { kind: 'setup-primary-domain' },
            },
            3,
        )
    if (site.status !== 'published')
        add(
            {
                id: 'store-unpublished',
                code: 'store-unpublished',
                count: 1,
                action: { kind: 'publish-store', siteId },
            },
            6,
        )
    if (titleCount > 0)
        add(
            {
                id: 'meta-title',
                code: 'meta-title',
                count: titleCount,
                action: { kind: 'fix-meta-title' },
            },
            8,
        )
    if (descriptionCount > 0)
        add(
            {
                id: 'meta-description',
                code: 'meta-description',
                count: descriptionCount,
                action: { kind: 'fix-meta-description' },
            },
            8,
        )
    if (contentIssue) {
        add(
            {
                id: 'content-quality',
                code: 'content-quality',
                count: contentIssue.count,
                action: {
                    kind: 'edit-content',
                    siteId,
                    pageId: String(contentIssue.page.id),
                },
            },
            8,
        )
    }
    if (missingAltProducts[0]) {
        add(
            {
                id: 'image-alt',
                code: 'image-alt',
                count: missingAltProducts.length,
                action: {
                    kind: 'edit-image-alt',
                    productId: String(missingAltProducts[0].id),
                },
            },
            8,
        )
    }
    if (!present(seo.googleVerificationToken)) {
        add(
            {
                id: 'search-verification',
                code: 'search-verification',
                count: 1,
                action: { kind: 'setup-search-verification', siteId },
            },
            3,
        )
    }

    return issues
        .sort(
            (left, right) =>
                right.impact - left.impact ||
                left.code.localeCompare(right.code),
        )
        .map(({ impact: _impact, ...issue }) => issue)
}

function evaluateSnapshot(snapshot: LocalSeoSnapshot): LocalSeoEvaluation {
    const localBusiness = isRecord(snapshot.site.localBusiness)
        ? snapshot.site.localBusiness
        : {}
    const contactInfo = isRecord(snapshot.site.contactInfo)
        ? snapshot.site.contactInfo
        : {}
    const business = calculateBusinessDataScore({
        businessName: present(snapshot.site.name)
            ? snapshot.site.name
            : undefined,
        streetAddress: present(contactInfo.address)
            ? contactInfo.address
            : present(localBusiness.streetAddress)
                ? localBusiness.streetAddress
                : undefined,
        city: present(localBusiness.city) ? localBusiness.city : undefined,
        postcode: present(localBusiness.postcode)
            ? localBusiness.postcode
            : undefined,
        country: 'MY',
        phone: present(contactInfo.phone) ? contactInfo.phone : undefined,
    })

    const artifact = generateSchemaGenerationArtifact(snapshot.site)
    const schema = calculateSchemaScore(artifact)
    const metadataItems = collectMetadataItems(snapshot)
    const missingAltProducts = snapshot.products.filter(productHasMissingAlt)
    const pagesForContent = snapshot.pages.map((page) => ({
        layout: Array.isArray(page.layout) ? page.layout : [],
    }))
    const hasContactSection = snapshot.pages.some(
        (page) =>
            Array.isArray(page.layout) &&
            page.layout.some(
                (block) => isRecord(block) && block.blockType === 'contact',
            ),
    )
    const contentIssuePages = snapshot.pages.filter((page) =>
        pageNeedsContentImprovement(
            Array.isArray(page.layout) ? page.layout : [],
        ),
    )
    const contentIssuePage =
        contentIssuePages[0] ??
        (!hasContactSection ? snapshot.pages[0] : undefined)
    const contentIssue = contentIssuePage
        ? {
              page: contentIssuePage,
              count: Math.max(contentIssuePages.length, 1),
          }
        : undefined
    const contentQualityScore = calculateContentQualityScore({
        pages: pagesForContent,
        productMissingAltCount: missingAltProducts.length,
        hasContactSection,
    })
    const titleCount =
        snapshot.pages.length +
        snapshot.products.length +
        snapshot.blogs.length -
        metadataItems.filter((item) => item.missingFields.includes('title'))
            .length
    const descriptionCount =
        snapshot.pages.length +
        snapshot.products.length +
        snapshot.blogs.length -
        metadataItems.filter((item) =>
            item.missingFields.includes('description'),
        ).length
    const eligibleMetadataCount =
        snapshot.pages.length + snapshot.products.length + snapshot.blogs.length
    const indexablePageCount = snapshot.pages.filter((page) => {
        const seo = isRecord(page.seo) ? page.seo : {}
        return seo.noIndex !== true
    }).length
    const siteSeo = isRecord(snapshot.site.seo) ? snapshot.site.seo : {}
    const publicDocuments = publicDiscoveryDocuments(snapshot)
    const localBusinessOpeningHours = isRecord(snapshot.site.localBusiness)
        ? snapshot.site.localBusiness.openingHours
        : undefined
    const score = calculateLocalSeoScore({
        businessDataScore: business.score,
        schemaScore: schema.score,
        aiDiscoverability: derivePublicDiscoveryFacts({
            status: snapshot.site.status,
            tenantRouteAvailable: tenantRouteContextAvailable(snapshot.site.tenant),
            publicRouteSiteSelected: isSelectedPublicDiscoverySite(
                snapshot.site,
                snapshot.publicRouteSite,
            ),
            sitemapRouteAvailable: canSerializePublicSitemap(publicDocuments),
            llmsRouteAvailable: canSerializePublicLlmsTxt({
                ...publicDocuments,
                openingHours: localBusinessOpeningHours,
            }),
        }),
        technicalHealth: {
            eligibleMetadataCount,
            metaTitleCount: titleCount,
            metaDescriptionCount: descriptionCount,
            contentQualityScore,
            googleVerificationConfigured: present(
                siteSeo.googleVerificationToken,
            ),
            eligiblePageCount: snapshot.pages.length,
            indexablePageCount,
        },
    })
    const revisionToken = snapshotToken(snapshot)
    const issues = deriveIssues(
        snapshot,
        metadataItems,
        contentIssue,
        missingAltProducts,
    )
    return {
        response: localSeoScoreResponseSchema.parse({
            success: true,
            score: score.score,
            breakdown: score.breakdown,
            issues,
            aiFixableItemCount: metadataItems.length,
            evaluatedAt: new Date().toISOString(),
            revisionToken,
        }),
        metadataItems,
    }
}

/**
 * Accepts only a stable double-read. When inputs change, the verified second
 * snapshot becomes the retry source so the bounded retry needs at most 3 reads.
 */
export async function evaluateAuthoritativeLocalSeo(
    payload: LocalSeoPayload,
    siteId: string,
    authorizedTenantId: string,
): Promise<LocalSeoEvaluation> {
    let snapshot = await loadSnapshot(payload, siteId, authorizedTenantId)
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const evaluation = evaluateSnapshot(snapshot)
        const verification = await loadSnapshot(
            payload,
            siteId,
            authorizedTenantId,
        )
        if (snapshotToken(verification) === evaluation.response.revisionToken) {
            return evaluation
        }
        snapshot = verification
    }
    throw new LocalSeoSnapshotChangedError()
}
