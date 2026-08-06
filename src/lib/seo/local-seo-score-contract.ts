import { z } from 'zod'

export const seoHealthIssueCodeSchema = z.enum([
    'store-name',
    'business-address',
    'phone',
    'schema-subtype',
    'opening-hours',
    'map-location',
    'price-range',
    'primary-domain',
    'store-unpublished',
    'meta-title',
    'meta-description',
    'content-quality',
    'image-alt',
    'search-verification',
])

export const seoHealthIssueActionSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('edit-store-name'), siteId: z.string().min(1) }),
    z.object({
        kind: z.literal('edit-business-address'),
        siteId: z.string().min(1),
    }),
    z.object({ kind: z.literal('edit-phone'), siteId: z.string().min(1) }),
    z.object({
        kind: z.literal('edit-schema-subtype'),
        siteId: z.string().min(1),
    }),
    z.object({
        kind: z.literal('edit-opening-hours'),
        siteId: z.string().min(1),
    }),
    z.object({
        kind: z.literal('edit-map-location'),
        siteId: z.string().min(1),
    }),
    z.object({
        kind: z.literal('edit-price-range'),
        siteId: z.string().min(1),
    }),
    z.object({ kind: z.literal('setup-primary-domain') }),
    z.object({ kind: z.literal('publish-store'), siteId: z.string().min(1) }),
    z.object({ kind: z.literal('fix-meta-title') }),
    z.object({ kind: z.literal('fix-meta-description') }),
    z.object({
        kind: z.literal('edit-content'),
        siteId: z.string().min(1),
        pageId: z.string().min(1),
    }),
    z.object({
        kind: z.literal('edit-image-alt'),
        productId: z.string().min(1),
    }),
    z.object({
        kind: z.literal('setup-search-verification'),
        siteId: z.string().min(1),
    }),
])

const expectedActionByCode = {
    'store-name': 'edit-store-name',
    'business-address': 'edit-business-address',
    phone: 'edit-phone',
    'schema-subtype': 'edit-schema-subtype',
    'opening-hours': 'edit-opening-hours',
    'map-location': 'edit-map-location',
    'price-range': 'edit-price-range',
    'primary-domain': 'setup-primary-domain',
    'store-unpublished': 'publish-store',
    'meta-title': 'fix-meta-title',
    'meta-description': 'fix-meta-description',
    'content-quality': 'edit-content',
    'image-alt': 'edit-image-alt',
    'search-verification': 'setup-search-verification',
} as const

export const seoHealthIssueSchema = z
    .object({
        id: z.string().min(1).max(80),
        code: seoHealthIssueCodeSchema,
        count: z.number().int().positive().max(1_000_000),
        action: seoHealthIssueActionSchema,
    })
    .superRefine((issue, context) => {
        if (issue.action.kind !== expectedActionByCode[issue.code]) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['action', 'kind'],
                message: `Action ${issue.action.kind} is invalid for ${issue.code}`,
            })
        }
    })

export const localSeoScoreResponseSchema = z
    .object({
        success: z.literal(true),
        score: z.number().int().min(0).max(100),
        breakdown: z
            .object({
                businessData: z.number().int().min(0).max(20),
                schema: z.number().int().min(0).max(35),
                aiDiscoverability: z.number().int().min(0).max(15),
                technicalHealth: z.number().int().min(0).max(30),
            })
            .strict(),
        issues: z.array(seoHealthIssueSchema).max(50),
        aiFixableItemCount: z.number().int().min(0).max(1_000_000),
        evaluatedAt: z.string().datetime({ offset: true }),
        revisionToken: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict()
    .superRefine((response, context) => {
        const total = Object.values(response.breakdown).reduce(
            (sum, value) => sum + value,
            0,
        )
        if (total !== response.score) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['score'],
                message: 'Bucket total must equal score',
            })
        }
    })

export const metadataFixItemSchema = z
    .object({
        collection: z.enum(['pages', 'products', 'blogs']),
        id: z.string().min(1),
        title: z.string().min(1).max(300),
        context: z.string().max(500).optional(),
        missingFields: z
            .array(z.enum(['title', 'description']))
            .min(1)
            .max(2),
        currentTitle: z.string().max(500).optional(),
        currentDescription: z.string().max(2_000).optional(),
    })
    .strict()

export const localSeoMetadataDetailResponseSchema = z
    .object({
        success: z.literal(true),
        detail: z.literal('metadata'),
        items: z.array(metadataFixItemSchema).max(100),
        page: z.number().int().positive(),
        hasNextPage: z.boolean(),
        revisionToken: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict()

export type SeoHealthIssueCode = z.infer<typeof seoHealthIssueCodeSchema>
export type SeoHealthIssueAction = z.infer<typeof seoHealthIssueActionSchema>
export type SeoHealthIssue = z.infer<typeof seoHealthIssueSchema>
export type LocalSeoScoreResponse = z.infer<typeof localSeoScoreResponseSchema>
export type MetadataFixItem = z.infer<typeof metadataFixItemSchema>
export type LocalSeoMetadataDetailResponse = z.infer<
    typeof localSeoMetadataDetailResponseSchema
>
