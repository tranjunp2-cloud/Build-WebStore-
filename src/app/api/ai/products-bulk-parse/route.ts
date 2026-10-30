import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { tenantIdForQuery, withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { detectLocaleFromText } from '@/lib/detect-locale'
import { z } from 'zod'
import {
    BULK_CATEGORY_PATH_MAX_CHARS,
    canonicalizeBulkParseResult,
    isValidBulkParseResult,
    type BulkCategoryCandidate,
    type BulkParseResult,
} from '@/lib/ai/bulk-category-matching'
import { describeAiTaskFailure, runAiTaskForUser } from '@/lib/ai-platform/ai-tasks'
import { isAiTasksEnabled } from '@/lib/ai-platform/config'
import { parseProductsInChunks } from '@/lib/ai/bulk-parse-chunks'

export const maxDuration = 60
// Platform call must settle (answer or aiTimeout) before the function is killed.
const PLATFORM_DEADLINE_MS = 55_000

const BulkParseRequestSchema = z.object({
    promptText: z.string().trim().min(1).max(6_000),
    locale: z.enum(['en', 'ms']).optional().default('en'),
})

const CATEGORY_CONTEXT_MAX_BYTES = 12_000
const CATEGORY_FETCH_LIMIT = 500

type MerchantLocale = 'en' | 'ms' | 'vi'

const LANGUAGE_MARKERS: Record<MerchantLocale, ReadonlySet<string>> = {
    en: new Set([
        'and', 'black', 'blue', 'brown', 'coat', 'color', 'cotton', 'everyday',
        'for', 'green', 'grey', 'gray', 'large', 'made', 'material', 'medium',
        'men', 'offers', 'orange', 'pants', 'pink', 'product', 'purple', 'quality', 'red', 'shirt', 'size',
        'small', 'soft', 'style', 'suitable', 'trousers', 'warm', 'wear', 'white',
        'with', 'women', 'yellow']),
    ms: new Set([
        'bahan', 'baju', 'besar', 'berkualiti', 'biru', 'coklat', 'dengan',
        'diperbuat', 'gaya', 'harian', 'hangat', 'hijau', 'hitam', 'kapas',
        'kelabu', 'kecil', 'kuning', 'lelaki', 'lembut', 'menawarkan', 'merah',
        'oren', 'produk', 'putih', 'saiz', 'sedang', 'sederhana', 'sesuai',
        'seluar', 'ungu', 'untuk', 'wanita', 'warna', 'yang']),
    vi: new Set([
        'ao', 'chat', 'cho', 'den', 'do', 'duoc', 'hop', 'lieu', 'lon', 'mau',
        'nam', 'nau', 'nho', 'nu', 'pham', 'phu', 'quan', 'san', 'tay', 'thun',
        'trang', 'vai', 'vang', 'va', 'vua', 'voi', 'xam', 'xanh']),
}

const VARIANT_MARKERS: Record<MerchantLocale, ReadonlySet<string>> = {
    en: new Set([
        'black', 'blue', 'brown', 'color', 'cotton', 'green', 'grey', 'gray',
        'large', 'material', 'medium', 'orange', 'pink', 'purple', 'red', 'size',
        'small', 'white', 'yellow']),
    ms: new Set([
        'bahan', 'besar', 'biru', 'coklat', 'hijau', 'hitam', 'kapas', 'kelabu',
        'kecil', 'kuning', 'merah', 'oren', 'putih', 'saiz', 'sederhana', 'ungu', 'warna']),
    vi: new Set([
        'bac', 'cam', 'chat', 'den', 'do', 'hong', 'lieu', 'lon', 'mau', 'nau', 'nho',
        'tim', 'trang', 'vai', 'vang', 'vua', 'xam', 'xanh']),
}

function tokenizeMerchantText(text: string): Set<string> {
    const normalized = text.toLocaleLowerCase('en')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
    return new Set(normalized.match(/\p{L}+/gu) ?? [])
}

const VIETNAMESE_EXCLUSIVE_RE = /[ăđơưắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỷỹỵ]/i

function collectMerchantFacingText(result: BulkParseResult): string {
    const values: string[] = []
    const add = (value: string | undefined) => {
        if (value?.trim()) values.push(value.trim())
    }

    for (const product of result.products ?? []) {
        add(product.name)
        add(product.description)
        add(product.seoTitle)
        add(product.seoDescription)
        for (const variant of product.variants ?? []) add(variant.name)
        for (const config of product.variantConfigs ?? []) {
            add(config.name)
            for (const option of config.options ?? []) add(option.value)
        }
    }

    return values.join(' ')
}

function detectForeignVariantLocale(
    result: BulkParseResult,
    requestedLocale: Exclude<MerchantLocale, 'vi'>): MerchantLocale | null {
    const values: string[] = []
    for (const product of result.products ?? []) {
        for (const variant of product.variants ?? []) {
            if (variant.name?.trim()) values.push(variant.name)
        }
        for (const config of product.variantConfigs ?? []) {
            if (config.name?.trim()) values.push(config.name)
            for (const option of config.options ?? []) {
                if (option.value?.trim()) values.push(option.value)
            }
        }
    }

    const tokens = tokenizeMerchantText(values.join(' '))
    const foreignLocale = (Object.entries(VARIANT_MARKERS) as [MerchantLocale, ReadonlySet<string>][])
        .find(([candidate, markers]) =>
            candidate !== requestedLocale && [...tokens].some(token => markers.has(token)))
    return foreignLocale?.[0] ?? null
}

function detectTextLocale(text: string): string | null {
    if (VIETNAMESE_EXCLUSIVE_RE.test(text)) return 'vi'

    const tokens = tokenizeMerchantText(text)
    const scores = (Object.entries(LANGUAGE_MARKERS) as [MerchantLocale, ReadonlySet<string>][])
        .map(([locale, markers]) => ({
            locale,
            score: [...tokens].filter(token => markers.has(token)).length,
        }))
        .sort((a, b) => b.score - a.score)

    if (scores[0].score >= 2 && scores[0].score > scores[1].score) {
        return scores[0].locale
    }

    // Short product and brand names are too ambiguous for franc-min. Only trust its
    // fallback when the combined merchant copy contains enough distinct words.
    if (tokens.size < 4) return null
    return detectLocaleFromText(text)
}

function detectForeignMerchantFieldLocale(
    result: BulkParseResult,
    requestedLocale: Exclude<MerchantLocale, 'vi'>): string | null {
    for (const product of result.products ?? []) {
        const fields = [product.name, product.description, product.seoTitle, product.seoDescription]
        for (const field of fields) {
            if (!field?.trim()) continue
            const detectedLocale = detectTextLocale(field)
            if (detectedLocale && detectedLocale !== requestedLocale) return detectedLocale
        }
    }
    return null
}

function detectMerchantFacingLocale(result: BulkParseResult): string | null {
    const text = collectMerchantFacingText(result)
    return text ? detectTextLocale(text) : null
}

/** The model answered, but not with a product list: the outer handler's `parseError`. */
class InvalidBulkParseError extends Error {
    constructor() {
        super('Invalid AI response structure')
    }
}

/** Platform task failure → the error codes the bulk-create modal already understands. */
function bulkParseTaskFailure(error: unknown): NextResponse {
    const failure = describeAiTaskFailure(error)
    const timedOut = failure.status === 504 || (error instanceof Error && /timeout/i.test(error.name))
    const errorCode = failure.status === 429 ? 'aiQuotaExceeded' : timedOut ? 'aiTimeout' : 'parseError'
    return NextResponse.json({ error: errorCode }, { status: failure.status })
}

export const POST = withAuth(async (user, req) => {
    try {
        // Rate limit: 10 bulk AI tasks per hour (heavy resource usage)
        // Namespaced key — bare user.id would share a single bucket with every other
        // AI route (edit-block, product-description, etc.), making this limit meaningless
        // (see PR #1608 review). Matches this codebase's `{feature}:${user.id}` convention.
        const rateLimit = await checkRateLimit(`ai-bulk-parse:${user.id}`, 10)
        if (!rateLimit.allowed) {
            return NextResponse.json({ error: 'rateLimitExceeded', resetAt: rateLimit.resetAt }, { status: 429 })
        }

        const request = BulkParseRequestSchema.safeParse(await req.json().catch(() => null))
        if (!request.success) {
            return NextResponse.json({ error: 'invalidRequest' }, { status: 400 })
        }
        const { promptText, locale } = request.data

        const tenantId = tenantIdForQuery(user)
        if (tenantId == null) {
            return NextResponse.json({ error: 'tenantRequired' }, { status: 403 })
        }
        const generationId = crypto.randomUUID()

        if (!isAiTasksEnabled()) {
            return NextResponse.json({ error: 'aiUnavailable' }, { status: 503 })
        }

        const payload = await getPayload({ config: configPromise })
        const categoryResult = await payload.find({
            collection: 'categories',
            user,
            overrideAccess: false,
            where: {
                and: [{ tenant: { equals: tenantId } }, { deletedAt: { exists: false } }],
            },
            depth: 0,
            limit: CATEGORY_FETCH_LIMIT + 1,
            sort: ['breadcrumbs', 'id'],
            select: { name: true, breadcrumbs: true, parent: true },
        })
        let categoryContextComplete = categoryResult.docs.length <= CATEGORY_FETCH_LIMIT
            && categoryResult.hasNextPage !== true
            && (
                typeof categoryResult.totalDocs !== 'number'
                || categoryResult.totalDocs <= CATEGORY_FETCH_LIMIT
            )
        const categoryDocs = categoryContextComplete ? categoryResult.docs : []
        const parentCategoryIds = new Set(
            categoryDocs.flatMap(category => {
                const parent = category.parent
                const parentId = typeof parent === 'object' && parent !== null && 'id' in parent ? parent.id : parent
                return parentId == null ? [] : [String(parentId)]
            }),
        )
        const selectableCategoryDocs = categoryDocs.filter(
            category => !parentCategoryIds.has(String(category.id)),
        )
        const categoryCandidates: BulkCategoryCandidate[] = []
        const serializedCategoryCandidates: string[] = []
        const encoder = new TextEncoder()
        let categoryContextBytes = 2 // opening + closing JSON brackets

        for (const category of selectableCategoryDocs) {
            const breadcrumbs = typeof category.breadcrumbs === 'string' ? category.breadcrumbs.trim() : ''
            const path = String(breadcrumbs || category.name || '').trim()
            if (path.length > BULK_CATEGORY_PATH_MAX_CHARS) {
                categoryContextComplete = false
                break
            }
            const serialized = JSON.stringify({
                id: category.id,
                path,
            })
                .replace(/</g, '\\u003c')
                .replace(/>/g, '\\u003e')
            const serializedBytes = encoder.encode(serialized).byteLength
            const separatorBytes = serializedCategoryCandidates.length > 0 ? 1 : 0
            if (categoryContextBytes + separatorBytes + serializedBytes > CATEGORY_CONTEXT_MAX_BYTES) {
                categoryContextComplete = false
                break
            }

            serializedCategoryCandidates.push(serialized)
            categoryContextBytes += separatorBytes + serializedBytes
            categoryCandidates.push({ id: category.id, path })
        }
        if (!categoryContextComplete) {
            serializedCategoryCandidates.length = 0
            categoryCandidates.length = 0
        }

        let parsedResult: unknown
        let unparsed: string[] = []
        try {
            const taskOptions = (signal: AbortSignal) => ({ tenantId: String(tenantId), signal })
            const chunked = await parseProductsInChunks({
                promptText,
                deadlineAt: Date.now() + PLATFORM_DEADLINE_MS,
                split: async (text, signal) => {
                    const { output } = await runAiTaskForUser(user, req, 'catalog.split-products', { promptText: text }, taskOptions(signal))
                    return output.items.map((item) => item.text)
                },
                parse: async (text, signal) => {
                    const { output } = await runAiTaskForUser(user, req, 'catalog.bulk-parse-products', {
                        promptText: text,
                        locale,
                        categoryCandidates,
                    }, taskOptions(signal))
                    if (!isValidBulkParseResult(output)) throw new InvalidBulkParseError()
                    return output
                },
            })
            parsedResult = { products: chunked.products }
            unparsed = chunked.unparsed
        } catch (error) {
            if (error instanceof InvalidBulkParseError) throw error
            console.error('[AI Bulk Parse Error]', error instanceof Error ? error.message : error)
            return bulkParseTaskFailure(error)
        }
        if (!isValidBulkParseResult(parsedResult)) {
            throw new InvalidBulkParseError()
        }
        if (unparsed.length > 0) console.warn('[AI Bulk Parse] chunks left unparsed', { pieces: unparsed.length })
        const { result: canonicalResult, reasonCounts } = canonicalizeBulkParseResult(parsedResult, categoryCandidates)
        payload.logger.info(
            { categoryGuard: reasonCounts },
            '[AI Bulk Parse] category guard summary',
        )
        const detectedLocale = detectForeignVariantLocale(canonicalResult, locale)
            ?? detectForeignMerchantFieldLocale(canonicalResult, locale)
            ?? detectMerchantFacingLocale(canonicalResult)
        if (detectedLocale && detectedLocale !== locale) {
            console.warn('[AI Bulk Parse] Merchant-facing language mismatch', {
                requestedLocale: locale,
                detectedLocale,
                userId: user?.id ?? null,
            })
            return NextResponse.json(
                { error: 'merchantLanguageMismatch', retryable: true },
                { status: 422 })
        }
        return NextResponse.json({ generationId, ...canonicalResult, ...(unparsed.length > 0 ? { unparsed } : {}) })
    } catch (error) {
        console.error('[AI Bulk Parse Error]', error)
        
        let errorCode = 'parseError'
        const err = error as Error
        if (err?.message) {
            if (err.message.includes('429') || err.message.includes('quota') || err.message.includes('insufficient_quota')) {
                errorCode = 'aiQuotaExceeded'
            } else if (err.message.includes('timeout')) {
                errorCode = 'aiTimeout'
            }
        }
        
        return NextResponse.json({ error: errorCode }, { status: 500 })
    }
}, { csrf: true })
