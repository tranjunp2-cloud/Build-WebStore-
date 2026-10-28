import * as Sentry from '@sentry/nextjs'
import { getPayload } from 'payload'
import productSlugify from 'slugify'
import configPromise from '@payload-config'
import { z } from 'zod'
import { CATEGORY_LOCK_BUSY_ERROR, withActiveCategoryRowLock } from '@/lib/payload/category-row-lock'
import { ProductPersistenceVerificationError, saveProduct, type ProductActor } from '@/lib/products/save-product'

const AiCategoryIdSchema = z.union([
    z.number().int().positive().max(2_147_483_647),
    z.string()
        .trim()
        .regex(/^[1-9]\d*$/)
        .transform(value => Number(value))
        .refine(
            value => Number.isSafeInteger(value) && value <= 2_147_483_647,
            'Category ID is out of range',
        ),
])

const AiSaveMetadataSchema = z.object({
    generationId: z.string().uuid(),
    operationId: z.string().uuid(),
    skuAttempt: z.number().int().min(1).max(3),
}).strict()

export type AiSaveErrorCode =
    | 'CATEGORY_INVALID'
    | 'REQUEST_INVALID'
    | 'AI_DRAFT_CATEGORY_CONFLICT'
    | 'CATEGORY_BUSY_RETRY'
    | 'SKU_CONFLICT'
    | 'SAVE_FAILED'
    | 'PERSISTENCE_VERIFY_FAILED'

export type AiProductSaveResult =
    | {
        ok: true
        productId: string | number
        outcome: 'created' | 'replayed'
        referenceId: string
    }
    | {
        ok: false
        code: AiSaveErrorCode
        message: string
        retryable: boolean
        referenceId: string
    }

type AiSaveTelemetry = {
    tenantId: string | number
    userId: string | number
    generationId: string
    referenceId: string
    operationId: string
    skuAttempt: number
    categoryId: string | number
    variantCount: number
    durationMs: number
    stage: 'replay_precheck' | 'lock_or_create' | 'verify'
    outcome: 'created' | 'replayed' | 'failed'
    code?: string
    retryable?: boolean
    causeName?: string
    causeCode?: string
}

function aiSaveFailure(
    code: AiSaveErrorCode,
    message: string,
    retryable: boolean,
    referenceId: string,
): AiProductSaveResult {
    return { ok: false, code, message, retryable, referenceId }
}

function compactUuid(value: string): string {
    return value.replace(/-/g, '').toLowerCase()
}

function normalizeAiSaveCause(error: unknown): { causeName: string; causeCode?: string } {
    if (!error || typeof error !== 'object') return { causeName: 'UnknownError' }
    const candidate = error as { name?: unknown; code?: unknown }
    return {
        causeName: typeof candidate.name === 'string' ? candidate.name.slice(0, 80) : 'UnknownError',
        causeCode: typeof candidate.code === 'string' ? candidate.code.slice(0, 80) : undefined,
    }
}

function reportAiSaveFailure(code: string, telemetry: AiSaveTelemetry): void {
    try {
        Sentry.withScope(scope => {
            scope.setTag('feature', 'ai-product-save')
            scope.setTag('ai_save_code', code)
            scope.setTag('reference_id', telemetry.referenceId)
            scope.setTag('operation_id', telemetry.operationId)
            scope.setContext('aiProductSave', telemetry)
            Sentry.captureException(new Error(`AI Product save failed: ${code}`))
        })
    } catch (reportError) {
        void reportError
    }
}

function structuredError(error: unknown): { code?: string; message?: string } | null {
    if (!(error instanceof Error)) return null
    try {
        const parsed = JSON.parse(error.message) as { code?: unknown; message?: unknown }
        return {
            code: typeof parsed.code === 'string' ? parsed.code : undefined,
            message: typeof parsed.message === 'string' ? parsed.message : undefined,
        }
    } catch (parseError) {
        void parseError
        return null
    }
}

function categoryIdFromProduct(product: unknown): string | number | null {
    if (!product || typeof product !== 'object') return null
    const categoryValues = (product as { category?: unknown }).category
    if (!Array.isArray(categoryValues) || categoryValues.length !== 1) return null

    const value = categoryValues[0]
    if (typeof value === 'string' || typeof value === 'number') return value
    if (value && typeof value === 'object' && 'id' in value) {
        const id = (value as { id?: unknown }).id
        return typeof id === 'string' || typeof id === 'number' ? id : null
    }
    return null
}

function relationId(value: unknown): string | number | null {
    if (typeof value === 'string' || typeof value === 'number') return value
    if (value && typeof value === 'object' && 'id' in value) {
        const id = (value as { id?: unknown }).id
        return typeof id === 'string' || typeof id === 'number' ? id : null
    }
    return null
}

function successfulAiSave(
    product: Record<string, unknown>,
    outcome: 'created' | 'replayed',
    referenceId: string,
): AiProductSaveResult {
    const productId = product.id
    if (typeof productId !== 'string' && typeof productId !== 'number') {
        return aiSaveFailure(
            'PERSISTENCE_VERIFY_FAILED',
            'The product could not be verified after saving. Please try again.',
            true,
            referenceId,
        )
    }

    return { ok: true, productId, outcome, referenceId }
}

/**
 * AI bulk-create boundary only.
 *
 * Keep the existing manual Product save path unchanged, but independently revalidate the
 * category selected in the AI review modal. Client-side revalidation is UX; this query is the
 * authoritative tenant/active-category check for direct Server Action calls.
 */
export async function saveAiProduct(
    rawData: unknown,
    rawMetadata: unknown,
    /** The signed-in user and workspace; a function is read only once the request itself is valid. */
    resolveActor: ProductActor | (() => Promise<ProductActor>),
    options: { placeholderImageId?: () => Promise<string | number | null> } = {},
): Promise<AiProductSaveResult> {
    const referenceId = crypto.randomUUID()
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
        return aiSaveFailure(
            'CATEGORY_INVALID',
            'Please select an active category from your store.',
            false,
            referenceId,
        )
    }

    const category = (rawData as Record<string, unknown>).category
    if (!Array.isArray(category) || category.length !== 1) {
        return aiSaveFailure(
            'CATEGORY_INVALID',
            'Please select an active category from your store.',
            false,
            referenceId,
        )
    }

    const parsedCategory = AiCategoryIdSchema.safeParse(category[0])
    if (!parsedCategory.success) {
        return aiSaveFailure(
            'CATEGORY_INVALID',
            'Please select an active category from your store.',
            false,
            referenceId,
        )
    }

    const rawSlug = (rawData as Record<string, unknown>).slug
    const requestedSlug = typeof rawSlug === 'string'
        ? productSlugify(rawSlug, { lower: true, strict: true })
        : ''
    const operationSuffix = requestedSlug.match(/-ai-([a-f0-9]{32})$/)?.[1] ?? null
    const parsedMetadata = AiSaveMetadataSchema.safeParse(rawMetadata).data

    if (
        !parsedMetadata
        || operationSuffix === null
        || (operationSuffix !== null && compactUuid(parsedMetadata.operationId) !== operationSuffix)
    ) {
        return aiSaveFailure(
            'REQUEST_INVALID',
            'The save request is invalid. Generate the products again and retry.',
            false,
            referenceId,
        )
    }

    const { user, tenantId } = typeof resolveActor === 'function' ? await resolveActor() : resolveActor
    if (!user) throw new Error('Unauthorized')
    if (tenantId == null) throw new Error('Unauthorized')

    const payload = await getPayload({ config: configPromise })
    const startedAt = Date.now()
    const variantCount = Array.isArray((rawData as Record<string, unknown>).variants)
        ? ((rawData as Record<string, unknown>).variants as unknown[]).length
        : 0
    const telemetry = (
        stage: AiSaveTelemetry['stage'],
        outcome: AiSaveTelemetry['outcome'],
        extra: Partial<Pick<AiSaveTelemetry, 'code' | 'retryable' | 'causeName' | 'causeCode'>> = {},
    ): AiSaveTelemetry => ({
        tenantId,
        userId: user.id,
        generationId: parsedMetadata.generationId,
        referenceId,
        operationId: parsedMetadata.operationId,
        skuAttempt: parsedMetadata.skuAttempt,
        categoryId: parsedCategory.data,
        variantCount,
        durationMs: Date.now() - startedAt,
        stage,
        outcome,
        ...extra,
    })
    const logSuccess = (context: AiSaveTelemetry) => {
        try {
            payload.logger.info(context, '[ai-product-save] completed')
        } catch (logError) {
            void logError
        }
    }
    const logFailure = (context: AiSaveTelemetry) => {
        try {
            payload.logger.error(context, '[ai-product-save] failed')
        } catch (logError) {
            void logError
        }
    }

    const canReplayAiDraft = operationSuffix !== null
    const findReplay = async () => {
        if (!canReplayAiDraft) return null
        const replay = await payload.find({
            collection: 'products',
            where: {
                and: [
                    { deletedAt: { exists: false } },
                    { tenant: { equals: tenantId } },
                    { slug: { equals: requestedSlug } },
                    { status: { equals: 'draft' } },
                    { aiReviewPending: { equals: true } },
                ],
            },
            limit: 1,
            pagination: false,
            depth: 0,
            overrideAccess: false,
            user,
        })
        return replay.docs[0] ?? null
    }
    const replayMatchesRequestedCategory = (replay: unknown) => {
        const replayCategoryId = categoryIdFromProduct(replay)
        return replayCategoryId != null && String(replayCategoryId) === String(parsedCategory.data)
    }
    const replayMatchesRequestedState = (replay: unknown) => {
        if (!replay || typeof replay !== 'object') return false
        const candidate = replay as Record<string, unknown>
        const replayTenantId = relationId(candidate.tenant)
        return replayTenantId != null
            && String(replayTenantId) === String(tenantId)
            && candidate.slug === requestedSlug
            && candidate.status === 'draft'
            && candidate.aiReviewPending === true
            && candidate.deletedAt == null
    }
    const replayCategoryConflict = (stage: AiSaveTelemetry['stage']): AiProductSaveResult => {
        logFailure(telemetry(stage, 'failed', {
            code: 'AI_DRAFT_CATEGORY_CONFLICT',
            retryable: false,
        }))
        return aiSaveFailure(
            'AI_DRAFT_CATEGORY_CONFLICT',
            'This AI draft was already saved to a different category. Retry using its original category.',
            false,
            referenceId,
        )
    }
    const findVerifiedDraft = async (productId: string | number, slug: string) => {
        if (!slug) return null
        const verified = await payload.find({
            collection: 'products',
            where: {
                and: [
                    { id: { equals: productId } },
                    { deletedAt: { exists: false } },
                    { tenant: { equals: tenantId } },
                    { slug: { equals: slug } },
                    { status: { equals: 'draft' } },
                    { aiReviewPending: { equals: true } },
                ],
            },
            limit: 1,
            pagination: false,
            depth: 0,
            overrideAccess: false,
            user,
        })
        const product = verified.docs[0] ?? null
        if (!product || typeof product !== 'object') return null
        const candidate = product as Record<string, unknown>
        const persistedId = relationId(candidate.id)
        const persistedTenantId = relationId(candidate.tenant)
        const isExactDraft = persistedId != null
            && String(persistedId) === String(productId)
            && persistedTenantId != null
            && String(persistedTenantId) === String(tenantId)
            && candidate.slug === slug
            && candidate.status === 'draft'
            && candidate.aiReviewPending === true
            && candidate.deletedAt == null
            && replayMatchesRequestedCategory(product)
        return isExactDraft ? product : null
    }

    // A previous attempt may have committed even if its connection failed before acknowledging
    // COMMIT. Reuse that exact AI draft instead of creating a duplicate on the merchant's retry.
    let existingDraft: Awaited<ReturnType<typeof findReplay>> = null
    try {
        existingDraft = await findReplay()
    } catch (error) {
        const context = telemetry('replay_precheck', 'failed', {
            code: 'REPLAY_LOOKUP_FAILED',
            retryable: true,
            ...normalizeAiSaveCause(error),
        })
        logFailure(context)
        reportAiSaveFailure('REPLAY_LOOKUP_FAILED', context)
        return aiSaveFailure(
            'SAVE_FAILED',
            'The product could not be saved. Please try again.',
            true,
            referenceId,
        )
    }
    if (existingDraft) {
        if (!replayMatchesRequestedCategory(existingDraft)) return replayCategoryConflict('replay_precheck')
        if (replayMatchesRequestedState(existingDraft)) {
            const result = successfulAiSave(existingDraft as Record<string, unknown>, 'replayed', referenceId)
            logSuccess(telemetry('replay_precheck', 'replayed'))
            return result
        }
    }

    let savedProduct: Record<string, unknown> | null
    try {
        savedProduct = await withActiveCategoryRowLock(
            payload,
            parsedCategory.data,
            tenantId,
            canonicalCategoryId => saveProduct({
                ...(rawData as Record<string, unknown>),
                category: [canonicalCategoryId],
                status: 'draft',
                aiReviewPending: true,
            }, undefined, { user, tenantId, payload, source: 'ai', placeholderImageId: options.placeholderImageId }),
        )
    } catch (error) {
        // Every CATEGORY_LOCK_BUSY_ERROR source is pre-write: mutation-gate checkout, dedicated
        // pool checkout, or the category row lock. Return before replay reconciliation so a pool
        // outage cannot move the bounded wait into another unbounded lookup on the same pool.
        if (error instanceof Error && error.message === CATEGORY_LOCK_BUSY_ERROR) {
            const context = telemetry('lock_or_create', 'failed', {
                code: CATEGORY_LOCK_BUSY_ERROR,
                retryable: true,
                ...normalizeAiSaveCause(error),
            })
            logFailure(context)
            return aiSaveFailure(
                'CATEGORY_BUSY_RETRY',
                'This category is busy. Please try again.',
                true,
                referenceId,
            )
        }

        // Also cover concurrent identical requests and ambiguous commit acknowledgements. If
        // the lookup itself is unavailable, preserve and report the original write failure.
        const committedReplay = await findReplay().catch(() => null)
        if (committedReplay) {
            if (!replayMatchesRequestedCategory(committedReplay)) return replayCategoryConflict('lock_or_create')
            if (replayMatchesRequestedState(committedReplay)) {
                const result = successfulAiSave(committedReplay as Record<string, unknown>, 'replayed', referenceId)
                logSuccess(telemetry('lock_or_create', 'replayed'))
                return result
            }
        }

        if (error instanceof ProductPersistenceVerificationError) {
            const context = telemetry('verify', 'failed', {
                code: 'PERSISTENCE_VERIFY_FAILED',
                retryable: true,
                ...normalizeAiSaveCause(error.cause ?? error),
            })
            logFailure(context)
            reportAiSaveFailure('PERSISTENCE_VERIFY_FAILED', context)
            return aiSaveFailure(
                'PERSISTENCE_VERIFY_FAILED',
                'The product could not be verified after saving. Please try again.',
                true,
                referenceId,
            )
        }

        const structured = structuredError(error)
        if (structured?.code === 'FIELD_ERRORS') {
            logFailure(telemetry('lock_or_create', 'failed', {
                code: 'SKU_CONFLICT',
                retryable: true,
                ...normalizeAiSaveCause(error),
            }))
            return aiSaveFailure(
                'SKU_CONFLICT',
                structured.message ?? 'A generated SKU is already in use. Please try again.',
                true,
                referenceId,
            )
        }

        const context = telemetry('lock_or_create', 'failed', {
            code: 'SAVE_FAILED',
            retryable: true,
            ...normalizeAiSaveCause(error),
        })
        logFailure(context)
        reportAiSaveFailure('SAVE_FAILED', context)
        return aiSaveFailure(
            'SAVE_FAILED',
            'The product could not be saved. Please try again.',
            true,
            referenceId,
        )
    }

    if (!savedProduct) {
        const context = telemetry('lock_or_create', 'failed', {
            code: 'CATEGORY_INVALID',
            retryable: false,
        })
        logFailure(context)
        return aiSaveFailure(
            'CATEGORY_INVALID',
            'Please select an active category from your store.',
            false,
            referenceId,
        )
    }

    const productId = savedProduct.id
    const persistedSlug = requestedSlug || (
        typeof savedProduct.slug === 'string'
            ? productSlugify(savedProduct.slug, { lower: true, strict: true })
            : ''
    )
    let verificationCause: ReturnType<typeof normalizeAiSaveCause> | undefined
    let verifiedProduct: Awaited<ReturnType<typeof findVerifiedDraft>> = null
    if (
        (typeof productId === 'string' || typeof productId === 'number')
        && persistedSlug
    ) {
        try {
            verifiedProduct = await findVerifiedDraft(productId, persistedSlug)
        } catch (error) {
            verificationCause = normalizeAiSaveCause(error)
        }
    }

    if (!verifiedProduct) {
        const context = telemetry('verify', 'failed', {
            code: 'PERSISTENCE_VERIFY_FAILED',
            retryable: true,
            ...verificationCause,
        })
        logFailure(context)
        reportAiSaveFailure('PERSISTENCE_VERIFY_FAILED', context)
        return aiSaveFailure(
            'PERSISTENCE_VERIFY_FAILED',
            'The product could not be verified after saving. Please try again.',
            true,
            referenceId,
        )
    }

    logSuccess(telemetry('verify', 'created'))
    return successfulAiSave(verifiedProduct as Record<string, unknown>, 'created', referenceId)
}
