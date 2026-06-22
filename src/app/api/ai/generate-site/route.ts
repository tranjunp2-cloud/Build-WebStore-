export const dynamic = 'force-dynamic'
// Override vercel.json's 60s default — AI site generation runs:
//   OpenAI GPT-4.1-mini → Unsplash pipeline (5-10 images) → Payload create
// Real-world timing sits around 60-120s, previous 60s cap produced 504
// Gateway Timeout (staging run 00:42:15 2026-04-14 `[Theme] Using category…`).
// Vercel Pro / Fluid Compute allows up to 800s; 300s leaves comfortable headroom.
export const maxDuration = 300
import { NextRequest, NextResponse, after } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { generateSiteWithAI, type SSEEvent } from '@/lib/ai/openai-generator'
import type { GenerationResult } from '@/lib/ai/generate-blocks'
import { generateAndUploadHeroImage } from '@/lib/ai/openai-image'
import { planImageNeeds, fulfillImageNeeds, cleanupNonNumericImageFields, stripOrphanMediaRefs } from '@/lib/ai/media-injector'
import { checkBusinessInfoSafety } from '@/lib/ai/content-safety'
import { generateSiteSchema } from '@/lib/validations/ai'
import { parseRequest } from '@/lib/validations/helpers'
import { getCurrentUser } from '@/lib/auth'
import { getActivePlanSubscription, canUse } from '@/lib/subscriptions/plan-subscription'
import type { PlanCode } from '@/collections/PlanSubscriptions'
import { checkTwoTierRateLimit } from '@/lib/rateLimit'
import { slugify, ensureUniqueSlug } from '@/lib/utils/slugify'
import { blockRegistry } from '@/blocks/registry'
import { withSentrySpan } from '@/lib/ai/sentry-spans'
import { contentBriefToReferencePrompt, type ContentBrief } from '@/lib/ai/content-brief'
import { normalizeBusinessInput } from '@/lib/ai/input-normalizer'
import { parseProductsString } from '@/lib/ai/business-info-mapper'
import { pickCategoryThemeWithMood } from '@/lib/ai/category-theme-picker'
import { computeGenSeed } from '@/lib/ai/gen-seed'
import { resolveComposerCategory } from '@/lib/ai/composer-category-resolver'
import { buildImagePool, type ImagePool } from '@/lib/ai/image-pool'
import { translateProductTerm } from '@/lib/ai/product-translator'
import { translateToEnglishKeywords } from '@/lib/ai/dynamic-translator'
import { translateUserInputsIfNeeded } from '@/lib/ai/user-input-translator'
import { resolveTheme } from '@/lib/theme/resolve'
import { ensureNavigationBlocks, stripNavOffset, DEFAULT_NAV_LINKS, resolveCtaUrl, type PageShape, type PageBlockShape } from '@/lib/ai/ensure-navigation'
import { extractPageLinks } from '@/lib/ai/apply-site-nav'
import { enforcePageVariety } from '@/lib/ai/page-variety'
import { resolveSiteType } from '@/lib/ai/site-type'
import { withPayloadRetry } from '@/lib/payload-retry'
import { generateSampleProducts } from '@/lib/ai/generate-sample-products'
import { uploadImageUrl } from '@/lib/ai/upload-media'
import { seedBlogPosts } from '@/lib/ai/seed-blog-posts'
import { stripArrayItemIds } from '@/lib/payload/strip-block-ids'
import { getNavLabels } from '@/lib/ai/block-i18n'
import { coerceVideoVariants } from '@/lib/ai/coerce-video-variants'


// Flexible interface to handle unpredictable AI JSON structures
interface AIBlock {
    blockType?: string;
    id?: string;
    name?: string;
    url?: string;
    href?: string;
    link?: string;
    label?: string;
    text?: string;
    title?: string;
    heading?: string;
    description?: string;
    desc?: string;
    show?: boolean;
    style?: string;
    icon?: string;
    quote?: string;
    content?: string;
    review?: string;
    author?: string;
    customer?: string;
    role?: string;
    position?: string;
    company?: string;
    organization?: string;
    rating?: number;
    price?: string;
    included?: boolean;
    fieldName?: string;
    fieldType?: string;
    type?: string;
    required?: boolean;
    placeholder?: string;
    backgroundImage?: unknown;
    links?: AIBlock[];
    navLinks?: AIBlock[];
    ctaButton?: AIBlock;
    ctaButtons?: AIBlock[];
    columns?: AIBlock[];
    formFields?: AIBlock[];
    features?: AIBlock[];
    items?: AIBlock[];
    testimonials?: AIBlock[];
    plans?: AIBlock[];
    [key: string]: unknown;
}

/**
 * POST /api/ai/generate-site
 * Generate a website from a text prompt using AI.
 * Supports both SSE streaming and JSON response modes.
 *
 * Query params:
 *   ?stream=true  → SSE stream (text/event-stream)
 *   (default)     → JSON response (backward compatible)
 */
export async function POST(req: NextRequest) {
    const startTime = Date.now()
    let _site: Record<string, unknown> | null = null
    let _payload: Awaited<ReturnType<typeof getPayload>> | null = null
    let _createdPagesCount = 0

    try {
        // Parse request body early so validation errors return before auth/db side effects.
        const { data, errorResponse } = await parseRequest(req, generateSiteSchema)
        if (errorResponse) return errorResponse

        const { businessInfo: rawBusinessInfo, extraInstructions: rawExtraInstructions, language = 'en', generationLocale: requestedGenerationLocale, contentBrief: rawContentBrief } = data!

        // Normalize text inputs before sending to AI
        const normalizedBusinessInfo = {
            ...rawBusinessInfo,
            businessName: normalizeBusinessInput(rawBusinessInfo.businessName),
            shortDescription: normalizeBusinessInput(rawBusinessInfo.shortDescription),
            products: normalizeBusinessInput(rawBusinessInfo.products),
        }

        const extraInstructions = rawExtraInstructions ? normalizeBusinessInput(rawExtraInstructions) : undefined

        // Authenticate — handles both Payload JWT and custom Jose JWT (from verify-otp)
        const user = await getCurrentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await getPayload({ config })
        _payload = payload

        // Rate Limit: 5 requests/min (burst) + 20 requests/hour (sustained)
        const rateLimit = await checkTwoTierRateLimit(String(user.id), 5, 20)
        if (!rateLimit.allowed) {
            const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
            return NextResponse.json(
                {
                    error: 'Rate limit exceeded. Please wait before trying again.',
                    retryAfter,
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(retryAfter),
                        'X-RateLimit-Remaining': '0',
                    },
                }
            )
        }

        // Translate user-supplied fields to the selected generation language when
        // the input language differs (e.g. Vietnamese input + English site language).
        // Runs after auth + rate-limit — prevents unauthenticated callers from
        // triggering OpenAI API calls.
        const targetInputLocale = requestedGenerationLocale || language || 'en'
        const businessInfo = {
            ...normalizedBusinessInfo,
            ...(await translateUserInputsIfNeeded(
                {
                    businessName: normalizedBusinessInfo.businessName,
                    shortDescription: normalizedBusinessInfo.shortDescription,
                    products: normalizedBusinessInfo.products,
                },
                targetInputLocale,
            ))
        }

        // Get tenant ID — auto-create if missing (legacy accounts)
        let tenantId = (user as { tenants?: Array<{ tenant: unknown }> }).tenants?.[0]?.tenant
        let resolvedTenantId: number | string | undefined = typeof tenantId === 'object' && tenantId ? (tenantId as { id: number | string }).id : (tenantId as number | string | undefined)

        if (!resolvedTenantId) {
            // Try recovering orphaned tenant with legacy slug first
            const legacySlug = `store-${user.id}`
            const existingTenantBySlug = await payload.find({
                collection: 'tenants',
                where: { slug: { equals: legacySlug } },
                limit: 1,
            })

            if (existingTenantBySlug.docs.length > 0) {
                const recoveredTenant = existingTenantBySlug.docs[0]
                const recoveredId = recoveredTenant.id as number | string

                // Provision FREEMIUM before linking user — keeps failure retry-safe:
                // if subscription create fails, user stays unlinked and the whole
                // recovery block re-runs cleanly on the next request.
                const anySubRow = await payload.find({
                    collection: 'plan-subscriptions',
                    where: { and: [{ tenant: { equals: recoveredId } }, { name: { equals: 'main' } }] },
                    limit: 1,
                })
                if (anySubRow.totalDocs === 0) {
                    await payload.create({
                        collection: 'plan-subscriptions',
                        data: {
                            tenant: recoveredId,
                            name: 'main',
                            plan: 'FREEMIUM',
                            status: 'active',
                            startsAt: new Date().toISOString(),
                            endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                            packCode: 'FREEMIUM',
                        },
                    })
                }

                await payload.update({
                    collection: 'users',
                    id: user.id,
                    data: {
                        tenants: [{ tenant: recoveredId, role: 'owner' }],
                    } as Record<string, unknown>,
                })

                resolvedTenantId = recoveredId
            } else {
                // Smart slug from business name (F23), prefer user-chosen slug
                const businessName = businessInfo?.businessName || ''
                const firstName = (user as { firstName?: string }).firstName || (user as { name?: string }).name || 'My'
                const tenantName = businessName || `${firstName}'s Store`
                const userChosenSlug = (businessInfo as Record<string, unknown>)?.slug as string | undefined
                const baseSlug = userChosenSlug || slugify(businessName || firstName)
                const tenantSlug = await ensureUniqueSlug(payload, baseSlug, user.id)

                const newTenant = await payload.create({
                    collection: 'tenants',
                    data: {
                        name: tenantName,
                        slug: tenantSlug,
                    },
                })
                // Provision FREEMIUM subscription so subsequent subscription checks pass for new tenants.
                // SSO provision normally does this; here we cover non-SSO / legacy-recovery paths.
                await payload.create({
                    collection: 'plan-subscriptions',
                    data: {
                        tenant: newTenant.id,
                        name: 'main',
                        plan: 'FREEMIUM',
                        status: 'active',
                        startsAt: new Date().toISOString(),
                        endsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                        packCode: 'FREEMIUM',
                    },
                })
                await payload.update({
                    collection: 'users',
                    id: user.id,
                    data: {
                        tenants: [{ tenant: newTenant.id, role: 'owner' }],
                    } as Record<string, unknown>,
                })
                resolvedTenantId = newTenant.id as number | string
            }
        }

        const genSub = await getActivePlanSubscription(payload, resolvedTenantId)
        if (!genSub) {
            return NextResponse.json(
                { success: false, error: { code: 'SUBSCRIPTION_EXPIRED', message: 'Subscription expired or not found.' } },
                { status: 403 }
            )
        }
        if (!await canUse(payload, genSub.plan as PlanCode, 'website_builder')) {
            return NextResponse.json(
                { success: false, error: { code: 'FEATURE_LOCKED', message: 'Website builder is not available on your current plan.' } },
                { status: 403 }
            )
        }

        // F23: Sync tenant slug with builder — ensure Domain page shows same URL as the builder
        if (resolvedTenantId) {
            try {
                const tenant = await payload.findByID({ collection: 'tenants', id: resolvedTenantId })
                const currentSlug = tenant?.slug as string | undefined
                const userChosenSlug = (businessInfo as Record<string, unknown>)?.slug as string | undefined
                const businessName = businessInfo?.businessName || ''

                // Case 1: User explicitly chose a slug in the builder → always sync, regardless of current slug
                if (userChosenSlug && userChosenSlug !== currentSlug) {
                    // Slug was already verified available on client-side, but double-check uniqueness
                    const newSlug = await ensureUniqueSlug(payload, userChosenSlug, user.id)
                    await payload.update({
                        collection: 'tenants',
                        id: resolvedTenantId,
                        data: { slug: newSlug } as Record<string, unknown>,
                    })
                }
                // Case 2: No explicit slug chosen, but tenant has legacy store-{id} slug → auto-upgrade from business name
                else if (!userChosenSlug && currentSlug && /^store-\d+$/.test(currentSlug) && businessName) {
                    const baseSlug = slugify(businessName)
                    if (baseSlug && baseSlug !== currentSlug) {
                        const newSlug = await ensureUniqueSlug(payload, baseSlug, user.id)
                        await payload.update({
                            collection: 'tenants',
                            id: resolvedTenantId,
                            data: { slug: newSlug } as Record<string, unknown>,
                        })
                    }
                }
            } catch (err) {
                // Non-critical — slug sync failure shouldn't block site generation
                payload.logger.error({ err, tenantId: resolvedTenantId }, 'AI generation: Tenant slug sync failed')
            }
        }

        const safetyCheck = checkBusinessInfoSafety(businessInfo)
        if (!safetyCheck.safe) {
            return NextResponse.json(
                {
                    error: safetyCheck.message,
                    code: 'CONTENT_UNSAFE',
                },
                { status: 400 },
            )
        }

        // Check SSE mode
        const isStreaming = req.nextUrl.searchParams.get('stream') === 'true'

        // ────────────────────────────────────────────────────────────────────
        // Image sourcing strategy — feature flag
        // ────────────────────────────────────────────────────────────────────
        // Default: Unsplash pipeline (free, 8+ images per gen). Runs AFTER AI
        // returns blocks so we know exactly which fields need images.
        //
        // Legacy: DALL-E hero-only ($0.04/gen). Enable via ENABLE_DALLE_HERO=true.
        // Kept for research/rollback. Plan 260414-1400-ai-gen-unsplash-pipeline.
        const ENABLE_DALLE_HERO = process.env.ENABLE_DALLE_HERO === 'true'
        const heroImagePromise = ENABLE_DALLE_HERO
            ? generateAndUploadHeroImage(businessInfo, String(resolvedTenantId), payload)
            : Promise.resolve(null)

        // Build reference prompt from ContentBrief (if provided from URL/Image extraction)
        let referencePrompt: string | undefined
        if (rawContentBrief && typeof rawContentBrief === 'object') {
            try {
                referencePrompt = contentBriefToReferencePrompt(rawContentBrief as ContentBrief)
            } catch {
                // Invalid ContentBrief — ignore, generate without reference
            }
        }

        // Plan 260415 F01-gen-audit — track wall-clock for each pipeline stage
        // so the end-of-gen log shows where time is actually going. Before this,
        // we only had total `timeMs` and couldn't tell if a 3-minute gen was
        // OpenAI-bound (normal, ~60-100s) or media-bound (problem, 30-60s that
        // should be parallelized) or DB-bound (FK-retry thrashing).
        const phaseTimings: Record<string, number> = {}
        const trackPhase = <T>(name: string, fn: () => Promise<T>): Promise<T> => {
            const t = Date.now()
            return fn().finally(() => {
                phaseTimings[name] = (phaseTimings[name] ?? 0) + (Date.now() - t)
            })
        }

        // Fetch block prompt overrides from the admin template matching this category.
        // Best-effort: failure never blocks generation. Only applies to AI-first path —
        // template-first uses a static composer + hero-only GPT personalization, so
        // buildUserPrompt is never called there and overrides would have no effect.
        // AI-first is active when: GEN_MODE=ai-first OR user provided custom input.
        // Shape: { [blockSlug]: { prompt, updatedAt, updatedBy? } }
        type BlockPromptOverridesMap = Record<string, { prompt: string; updatedAt: string; updatedBy?: string }>
        let blockPromptOverrides: BlockPromptOverridesMap | undefined
        const isAiFirstPath = process.env.GEN_MODE?.trim() === 'ai-first'
            || Boolean(extraInstructions?.trim())
            || Boolean(referencePrompt?.trim())
        if (isAiFirstPath) {
            try {
                const promptCategoryText = [
                    businessInfo.businessName,
                    businessInfo.industry,
                    businessInfo.shortDescription,
                    businessInfo.products,
                ].join(' | ')
                const resolvedCategory = resolveComposerCategory(promptCategoryText)
                const tmplResult = await payload.find({
                    collection: 'templates',
                    where: {
                        and: [
                            { category: { contains: resolvedCategory } },
                            { status: { equals: 'live' } },
                        ],
                    },
                    limit: 1,
                    depth: 0,
                })
                const tmplDoc = tmplResult.docs[0] as Record<string, unknown> | undefined
                if (tmplDoc?.blockPromptOverrides && typeof tmplDoc.blockPromptOverrides === 'object') {
                    const raw = tmplDoc.blockPromptOverrides as Record<string, unknown>
                    const entries = Object.entries(raw).filter(([, v]) => {
                        const meta = v as Record<string, unknown>
                        return typeof meta?.prompt === 'string' && meta.prompt.trim().length > 0
                    })
                    if (entries.length > 0) {
                        blockPromptOverrides = Object.fromEntries(
                            entries.map(([slug, v]) => {
                                const meta = v as { prompt: string; updatedAt: string; updatedBy?: string }
                                return [slug, { prompt: meta.prompt, updatedAt: meta.updatedAt, updatedBy: meta.updatedBy }]
                            })
                        )
                        console.log(`[generate-site] loaded ${entries.length} blockPromptOverrides from template ${String(tmplDoc.id)} (category=${resolvedCategory})`)
                    }
                }
            } catch (err) {
                // Non-critical — gen proceeds without overrides
                console.warn('[generate-site] blockPromptOverrides fetch failed (non-fatal):', err instanceof Error ? err.message : err)
            }
        }

        // ── F3: Real SSE streaming — return response immediately, pipeline runs inside start() ──
        // GH-1190: Previously entire pipeline ran synchronously before ReadableStream was created.
        // Now we create the stream first and run the pipeline inside start() so the client
        // receives SSE events in real-time instead of waiting 60-100s for the first byte.
        const runGenPipeline = async (onEvent?: (e: SSEEvent) => void): Promise<{
            result: GenerationResult
            site: Record<string, unknown>
            homepagePage: Record<string, unknown>
            createdPages: Record<string, unknown>[]
            pageFailures: Array<{ slug: string; title: string; error: string }>
            productsCreatedCount: number
            timeMs: number
            productImageStats: { rateLimited: number; uploadFailed: number; noImage: number }
        }> => {
            // F1: start translation before AI call — saves 3-5s sequential wait (GH-1190).
            // translateToEnglishKeywords is only used in the Unsplash image pipeline (!ENABLE_DALLE_HERO).
            const translateKeywordsPromise: Promise<string[]> = !ENABLE_DALLE_HERO
                ? translateToEnglishKeywords({
                    industry: businessInfo.industry,
                    products: businessInfo.products,
                }).then((r): string[] => r ?? []).catch((): string[] => [])
                : Promise.resolve([] as string[])

            // O1: pre-compute sync values and chain imagePool build off translation
            // so the 2 Unsplash search calls run during AI generation (GH-1190).
            // translateKeywordsPromise resolves in ~3-5s → buildImagePool starts at ~t=3s
            // → finishes at ~t=5s — well before AI (~10-30s) completes.
            // await below costs ~0ms in the common case.
            const _parsedProductsForPool = !ENABLE_DALLE_HERO
                ? parseProductsString(businessInfo.products) : []
            const _presetCategoryForPool = !ENABLE_DALLE_HERO
                ? resolveComposerCategory(businessInfo.industry) : ''
            const _themeSeedForPool = !ENABLE_DALLE_HERO ? computeGenSeed(businessInfo) : 0
            const _themeMoodForPool = !ENABLE_DALLE_HERO
                ? pickCategoryThemeWithMood(_presetCategoryForPool, _themeSeedForPool).mood : undefined

            type _PoolResult = { pool: ImagePool | null; englishKeywords: string[] }
            const imagePoolPromise: Promise<_PoolResult> = !ENABLE_DALLE_HERO
                ? translateKeywordsPromise.then(async (aiKeywords): Promise<_PoolResult> => {
                    const topProd = _parsedProductsForPool[0]
                    let kws = aiKeywords.length > 0 ? [...aiKeywords] : []
                    if (kws.length === 0) {
                        const dictKw = translateProductTerm(topProd || '')
                        if (dictKw) kws = [dictKw]
                    }
                    // Isolate buildImagePool failure so kws (englishKeywords) is always
                    // preserved for the fulfillImageNeeds legacy search path even when
                    // pool build fails (e.g. Unsplash 429 on demo key).
                    let pool: ImagePool | null = null
                    try {
                        pool = await buildImagePool({
                            category: _presetCategoryForPool,
                            mood: _themeMoodForPool,
                            topProduct: kws[0] || translateProductTerm(topProd || ''),
                            products: kws.length > 0
                                ? kws
                                : _parsedProductsForPool.slice(0, 3).map(p => translateProductTerm(p)),
                            seed: _themeSeedForPool,
                        })
                    } catch {
                        // pool stays null; kws still returned below for legacy search
                    }
                    return { pool, englishKeywords: kws }
                }).catch((): _PoolResult => ({ pool: null, englishKeywords: [] }))
                : Promise.resolve<_PoolResult>({ pool: null, englishKeywords: [] })

            // Start sample product generation AFTER imagePool completes to avoid competing
            // for Unsplash rate limit (GH-1190). imagePool finishes ~3-5s into AI gen;
            // sample products (~7-12s) then run during AI (~30-77s) so await below still
            // costs ~0ms in the common case. Both phases use separate Unsplash search calls.
            // Note: siteId intentionally omitted — products run before site row is created so site.id
            // doesn't exist yet. Filenames fall back to a timestamp-based key (acceptable; filenames
            // are internal storage keys, not user-visible). Restructuring to pass siteId would serialize
            // the pipeline (~5-10s slower). See plans/260429-0941-fix-product-generation-bugs/phase-03-pass-site-id.md.
            const sampleProductsPromise = imagePoolPromise.then(() =>
                generateSampleProducts(
                    businessInfo,
                    (language as 'en' | 'ms' | 'auto'),
                    String(resolvedTenantId),
                    payload,
                )
            )

            // Generate with AI (or fallback) — span surfaces in Sentry Performance trace
            const { result, events } = await trackPhase('ai', () =>
                withSentrySpan('ai.generateSite', () =>
                    generateSiteWithAI(businessInfo, extraInstructions, language, referencePrompt, blockPromptOverrides, onEvent),
                ),
            )

        // Override AI theme with extracted visual style (URL extraction provides specific colors)
        const brief = rawContentBrief as Record<string, unknown> | null
        const visualStyle = brief?.visualStyle as Record<string, string> | undefined
        if (visualStyle) {
            if (visualStyle.primaryColor && /^#[0-9A-Fa-f]{6}$/.test(visualStyle.primaryColor)) {
                result.theme.primaryColor = visualStyle.primaryColor
            }
            if (visualStyle.secondaryColor && /^#[0-9A-Fa-f]{6}$/.test(visualStyle.secondaryColor)) {
                result.theme.secondaryColor = visualStyle.secondaryColor
            }
            // Auto-detect colorMode from extracted background color
            if (visualStyle.backgroundColor && /^#[0-9A-Fa-f]{6}$/.test(visualStyle.backgroundColor)) {
                const hex = visualStyle.backgroundColor.replace('#', '')
                const r = parseInt(hex.substring(0, 2), 16)
                const g = parseInt(hex.substring(2, 4), 16)
                const b = parseInt(hex.substring(4, 6), 16)
                const brightness = (r * 299 + g * 587 + b * 114) / 1000
                result.theme.colorMode = brightness > 128 ? 'light' : 'dark'
            }
        }

        // Wait for hero image if it hasn't finished yet (DALL-E path, legacy)
        let heroMedia: { id: string } | null = null
        try {
            heroMedia = await heroImagePromise
        } catch (e) {
            console.error('[AI Generate] Hero image promise error:', e)
        }

        // ────────────────────────────────────────────────────────────────────
        // Unsplash media pipeline — default path (ENABLE_DALLE_HERO=false)
        // ────────────────────────────────────────────────────────────────────
        // Fetches 5-10 real stock images (hero, gallery, team, testimonials, about)
        // and injects Media IDs into block fields before sanitizer runs.
        // Partial failure tolerated: blocks without images degrade gracefully.
        //
        // IMPORTANT — collect ALL block arrays, not just `result.blocks`.
        // When the generator returns multi-page format (`result.pages[]`),
        // buildGeneratedPages reads `result.pages[].blocks` directly (see
        // route.ts:755-766). Previously cleanup only ran on `result.blocks`,
        // so a subpage hero/about with `image: { url: "..." }` object would
        // survive into payload.create and crash with:
        //   "The following field is invalid: Page Blocks > Block N (…) > Image"
        // Staging log 2026-04-14 21:06:15 confirmed this path after the
        // Unsplash fallback chain failed to upgrade the object to a numeric
        // Media ID (UNSPLASH_ACCESS_KEY missing on staging env + mkdir
        // 'public' ENOENT on Vercel read-only fs).
        const collectAllBlockBuckets = (): Record<string, unknown>[][] => {
            const buckets: Record<string, unknown>[][] = []
            if (Array.isArray(result.blocks)) {
                buckets.push(result.blocks as Record<string, unknown>[])
            }
            const pagesArr = (result as { pages?: Array<{ blocks?: unknown[] }> }).pages
            if (Array.isArray(pagesArr)) {
                for (const page of pagesArr) {
                    if (Array.isArray(page?.blocks)) {
                        buckets.push(page.blocks as Record<string, unknown>[])
                    }
                }
            }
            return buckets
        }

        if (!ENABLE_DALLE_HERO) {
            try {
                const allBuckets = collectAllBlockBuckets()
                // Flatten image needs across homepage + every subpage so a
                // single fulfillImageNeeds call covers the whole site.
                const needs = allBuckets.flatMap((bucket) => planImageNeeds(bucket))
                if (needs.length > 0) {
                    const resolvedLang = (result.language || language) as 'en' | 'ms' | 'vi' | 'auto'

                    // O1: await pre-built pool (GH-1190) — typically 0ms wait since
                    // buildImagePool completed during AI generation above.
                    const { pool: imagePool, englishKeywords } = await imagePoolPromise
                    if (imagePool) {
                        console.info(
                            `[Image Pool] query="${imagePool.queryUsed}" landscape=${imagePool.landscape.length} square=${imagePool.square.length} underfill=${imagePool.underfill}`,
                        )
                    }

                    await trackPhase('media', () =>
                        fulfillImageNeeds(
                            needs,
                            {
                                businessName: businessInfo.businessName,
                                tenantId: String(resolvedTenantId),
                                category: businessInfo.industry,
                                language: resolvedLang,
                                products: _parsedProductsForPool.length > 0 ? _parsedProductsForPool : undefined,
                                mood: _themeMoodForPool,
                                pool: imagePool ?? undefined,
                                englishKeywords: englishKeywords.length > 0 ? englishKeywords : undefined,
                            },
                            payload as unknown as Parameters<typeof fulfillImageNeeds>[2],
                        ),
                    )
                }
                // Strip any slot still holding a URL/object (Unsplash failed or missing) —
                // Payload upload fields are optional; better empty than reject.
                // Run over every bucket so multi-page subpages get cleaned too.
                for (const bucket of allBuckets) {
                    cleanupNonNumericImageFields(bucket)
                }

                // Plan 260415 fix-500 — additionally query Payload to verify each
                // referenced media row is complete (has filename or url). Payload's
                // s3 adapter sometimes logs "Failed to persist upload data: g: Not
                // Found" which leaves media rows half-written, and any gallery/team
                // block referencing those rows will 500 the whole gen when
                // pages_blocks_*_images tries to insert. This runs ONE find query
                // per gen to catch those orphans.
                for (const bucket of allBuckets) {
                    try {
                        const { stripped, checked } = await stripOrphanMediaRefs(
                            bucket,
                            payload as unknown as Parameters<typeof stripOrphanMediaRefs>[1],
                        )
                        if (stripped > 0) {
                            console.warn(
                                `[generate-site] Stripped ${stripped}/${checked} orphan media refs from bucket`,
                            )
                        }
                    } catch (stripErr) {
                        // Non-fatal — if the verify query fails, fall through and
                        // let the page create attempt succeed (or retry wrapper fire).
                        console.warn(
                            '[generate-site] stripOrphanMediaRefs failed (non-fatal):',
                            stripErr instanceof Error ? stripErr.message : stripErr,
                        )
                    }
                }
            } catch (unsplashErr) {
                console.error('[AI Generate] Unsplash pipeline error (non-fatal):', unsplashErr)
                // Best-effort cleanup on any unexpected throw — still run
                // cleanup on every bucket so a partial failure can't leak
                // raw image objects into payload.create.
                try {
                    for (const bucket of collectAllBlockBuckets()) {
                        cleanupNonNumericImageFields(bucket)
                    }
                } catch { /* ignore */ }
            }
        }

        // ────────────────────────────────────────────────────────────────────
        // RULE 1: 1 site per user — Update existing site OR create new
        // ────────────────────────────────────────────────────────────────────
        const existingSites = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: resolvedTenantId } },
            limit: 1,
        })

        let site: Record<string, unknown>

        // Resolve complete theme before saving (prevents color mismatch between builder preview and editor)
        const resolvedTheme = resolveTheme(result.theme)

        // Plan 260415 fix-500 — coerce AI/fallback category to a valid Sites
        // enum value. Previously `result.siteType` could be 'portfolio' (from
        // fallback-adapter creative→portfolio mapping) which Payload rejected
        // → "The following field is invalid: Site Type" → 500. Logs showed
        // this was the dominant 500 source (~7 hits / 6h window).
        // GH-727: if AI output maps to generic 'business' fallback, use the
        // composer category (which has broader VN keyword matching) as backup
        // so the seeder seeds industry-correct images (e.g. fitness vs business).
        const safeSiteType = (() => {
            const fromAI = resolveSiteType(result.siteType)
            if (fromAI !== 'business') return fromAI
            return resolveSiteType(resolveComposerCategory(businessInfo.industry))
        })()

        // F26-01: Always show confirm dialog after AI generation so user can verify or correct detected locale.
        // generationLocale = actual language the AI generated in (any locale, e.g. 'el', 'th').
        // detectedLocale = EN/MS only — used for Sites.locale (translation system, Phase 1 EN+MS only).
        // The user-confirmed locale (requestedGenerationLocale) wins: `language` collapses non
        // en/ms/vi to 'auto' and GPT's result.language often falls back to 'en', losing the real code.
        const generationLocale = requestedGenerationLocale || result.language || language || 'en'
        const detectedLocale = (['ms', 'en'] as string[]).includes(generationLocale) ? generationLocale : 'en'
        const pendingLocaleConfirm = true

        if (existingSites.docs.length > 0) {
            // UPDATE existing site (template swap — keep site ID, update content)
            site = await payload.update({
                collection: 'sites',
                id: existingSites.docs[0].id,
                data: {
                    name: result.siteName,
                    status: 'draft',
                    generationStatus: 'generating',
                    siteType: safeSiteType,
                    locale: detectedLocale,
                    generationLocale,
                    pendingLocaleConfirm,
                    theme: resolvedTheme,
                    seo: {
                        metaTitle: result.seo.title,
                        metaDescription: result.seo.description,
                    },
                    aiGenerationMetadata: {
                        generatedAt: new Date().toISOString(),
                        originalPrompt: `${businessInfo.businessName} | ${businessInfo.industry} | ${businessInfo.shortDescription || ''} | ${businessInfo.products}`,
                        businessType: safeSiteType,
                    },
                },
            })

            // Delete old pages for this site. depth:0 keeps relationships as IDs
            // and skips the massive join across every block table — we only need
            // ids for the delete loop. (Without this, default depth=2 produced a
            // ~40-way join that failed loudly when any block table lagged a
            // migration — cf. faq/pricing "variant" fixes in 355fc7c1/73dc271b.)
            const oldPages = await payload.find({
                collection: 'pages',
                where: { site: { equals: site.id } },
                limit: 100,
                depth: 0,
                pagination: false,
                select: { id: true },
            })
            for (const oldPage of oldPages.docs) {
                await payload.delete({ collection: 'pages', id: oldPage.id })
            }
        } else {
            // CREATE new site (first time)
            site = await payload.create({
                collection: 'sites',
                data: {
                    tenant: resolvedTenantId,
                    name: result.siteName,
                    status: 'draft',
                    generationStatus: 'generating',
                    siteType: safeSiteType,
                    locale: detectedLocale,
                    generationLocale,
                    pendingLocaleConfirm,
                    theme: resolvedTheme,
                    seo: {
                        metaTitle: result.seo.title,
                        metaDescription: result.seo.description,
                    },
                    aiGenerationMetadata: {
                        generatedAt: new Date().toISOString(),
                        originalPrompt: `${businessInfo.businessName} | ${businessInfo.industry} | ${businessInfo.shortDescription || ''} | ${businessInfo.products}`,
                        businessType: safeSiteType,
                    },
                },
            })
        }
        _site = site

        // Derive nav links from AI multi-page output so menu reflects actual generated pages
        const aiPageLinks = extractPageLinks(
            (result as { pages?: Array<{ title?: string; slug?: string; isHomepage?: boolean }> }).pages,
        )

        // Sanitize blocks for Payload CMS compatibility
        const sanitizedBlocks = applyGeneratedSiteNavigation(
            sanitizeBlocksForPayload(result.blocks),
            result.siteName,
            aiPageLinks,
        )

        // B4 fix: detect duplicate hero blocks — take first, log warning
        const heroBlocks = sanitizedBlocks.filter(b => b.blockType === 'hero')
        if (heroBlocks.length > 1) {
            console.warn(`[generate-site] ${heroBlocks.length} hero blocks detected — keeping first, removing ${heroBlocks.length - 1} duplicates`)
            for (let i = sanitizedBlocks.length - 1; i >= 0; i--) {
                if (sanitizedBlocks[i]!.blockType === 'hero' && sanitizedBlocks[i] !== heroBlocks[0]) {
                    sanitizedBlocks.splice(i, 1)
                }
            }
        }

        // Inject DALL-E generated Hero Image into the hero block (legacy path, flag-gated)
        if (ENABLE_DALLE_HERO && heroMedia) {
            const heroBlock = heroBlocks[0] ?? null
            if (heroBlock) {
                // Attach the payload block's backgroundImage field to the uploaded media ID (for DB save)
                heroBlock.backgroundImage = heroMedia.id

                // Update the corresponding SSE event so the frontend preview gets the full image object immediately
                const heroEvent = events.find((e) => e.event === 'block_complete' && (e.data as { block?: AIBlock })?.block?.blockType === 'hero')
                if (heroEvent && heroEvent.data && (heroEvent.data as { block?: AIBlock }).block) {
                    (heroEvent.data as { block: AIBlock }).block.backgroundImage = heroMedia
                }
            }
        }

        // Map common AI variant names to Payload-valid variants
        const VARIANT_ALIASES: Record<string, Record<string, string>> = {
            hero: { 'split': 'split-left', 'minimal': 'centered', 'gradient': 'centered', 'hero-centered': 'centered', 'image-left': 'split-right', 'image-right': 'split-left' },
        }
        for (const block of sanitizedBlocks) {
            if (typeof block.blockType === 'string' && typeof block.variant === 'string') {
                const aliases = VARIANT_ALIASES[block.blockType]
                if (aliases && aliases[block.variant]) {
                    block.variant = aliases[block.variant]
                }
            }
        }

        // Final variant sanitization — ensure all block variants match registry schemas
        // This catches any variants that slipped through openai-generator sanitization
        for (const block of sanitizedBlocks) {
            if (typeof block.blockType === 'string' && blockRegistry.has(block.blockType)) {
                const meta = blockRegistry.getBlockMeta(block.blockType)
                if (meta && meta.variants.length > 0) {
                    if (typeof block.variant !== 'string' || !meta.variants.includes(block.variant)) {
                        block.variant = meta.defaultVariant || meta.variants[0]
                    }
                }
            }
        }

        // Pass 3 (GH-1266): coerce video/split-video variants that have no videoUrl to safe fallbacks.
        // Must run on ALL block arrays: buildGeneratedPages uses result.pages[].blocks directly
        // (multi-page AI response path) and ignores sanitizedBlocks, so coercing only sanitizedBlocks
        // has no effect on the blocks that actually get saved to DB for multi-page sites.
        // Same pattern as image-injection collectAllBlockBuckets (see route.ts:544-558).
        if (Array.isArray(result.pages)) {
            for (const page of result.pages as Array<{ blocks?: unknown[] }>) {
                if (Array.isArray(page.blocks)) {
                    coerceVideoVariants(page.blocks as Record<string, unknown>[])
                }
            }
        }
        coerceVideoVariants(sanitizedBlocks)

        const rawPageDefinitions = buildGeneratedPages({
            blocks: sanitizedBlocks,
            businessInfo,
            result,
        })

        // GH-820: build nav links from normalized definitions so URLs match canonical page slugs.
        // aiPageLinks (derived above from result.pages) still carries raw AI slugs like /book-trial;
        // rawPageDefinitions has already run canonicalizePageSlug so slugs are /contact, /about, etc.
        // Use i18n nav labels for known slugs so the force-replace step (ensureNavigationBlocks)
        // does not overwrite postAISwap-corrected nav labels with English page titles.
        // Prefer blockLang (franc-detected, reliable) > explicit language input > GPT-returned language.
        // result.language is GPT-returned and may default to 'en' even for non-English input.
        //
        // getNavLabels covers en/ms/vi/ja/zh/ko/ar/th (NAV_LABELS_SEED) + runtime GPT-translated
        // entries. For unknown languages (French, German, etc.), falls back to p.title from GPT
        // page definitions — GPT generates page titles in the correct language for Latin-script langs.
        const siteNavLang = String(result.blockLang || (language !== 'auto' ? language : result.language) || 'en')
        const seedNavLabels = getNavLabels(siteNavLang)
        const SLUG_NAV_LABELS: Record<string, string> | null = seedNavLabels
            ? {
                '/': seedNavLabels.home,
                '/about': seedNavLabels.about,
                '/services': seedNavLabels.services,
                '/contact': seedNavLabels.contact,
            }
            : null
        const normalizedPageLinks: Array<{ label: string; url: string }> = rawPageDefinitions.map((p) => {
            const url = p.slug === '/' ? '/' : `/${String(p.slug).replace(/^\/+/, '')}`
            return { label: SLUG_NAV_LABELS?.[url] ?? p.title, url }
        })

        // BUG-F01-24: guarantee navigation + footer on every page (AI may omit)
        // BUG-F01-23: enforce visual variety between pages (avoid 4 identical layouts)
        // GH-817: pass page links so injected/hollow nav reflects actual generated pages
        const pageDefinitions = enforcePageVariety(
            ensureNavigationBlocks(
                rawPageDefinitions as unknown as PageShape[],
                businessInfo.businessName,
                normalizedPageLinks,
            ),
        )

        const createdPages: Record<string, unknown>[] = []
        const pageFailures: Array<{ slug: string; title: string; error: string }> = []

        const dbPhaseStart = Date.now()
        for (const pageDefinition of pageDefinitions) {
            // Sanitize variants in each page's layout blocks (safety net for cloned heroes)
            // Plan 260415 — also run sanitizeBlocksForPayload on EVERY page's
            // layout (not just homepage), so sub-page team/testimonials/faq
            // blocks get defensive name/role/question/etc fallback. Without
            // this the AI happy path could ship a team block with an empty
            // member name on /about and crash payload.create.
            const variantFixed = Array.isArray(pageDefinition.layout)
                ? pageDefinition.layout.map((block: AIBlock | null) => {
                    if (!block) return block
                    if (typeof block.blockType === 'string' && blockRegistry.has(block.blockType)) {
                        const meta = blockRegistry.getBlockMeta(block.blockType)
                        if (meta && meta.variants.length > 0) {
                            if (typeof block.variant !== 'string' || !meta.variants.includes(block.variant)) {
                                return { ...block, variant: meta.defaultVariant || meta.variants[0] }
                            }
                        }
                    }
                    return block
                })
                : pageDefinition.layout
            const sanitizedLayout = Array.isArray(variantFixed)
                ? stripArrayItemIds(
                    stripNavOffset(
                        sanitizeBlocksForPayload(variantFixed.filter((b): b is AIBlock => Boolean(b))) as PageBlockShape[]
                    ) as Record<string, unknown>[]
                  ) as AIBlock[]
                : variantFixed

            // Plan 260415 fix-500 — per-page try/catch so one bad page (FK
            // violation, block validation, stale _parent_id from drizzle
            // transaction race) does NOT abort the entire generation. If
            // homepage fails, outer catch still fires. Sub-page failures are
            // logged and skipped; user gets a site with fewer pages instead
            // of a full 500 + "try again".
            try {
                // Plan 260415 fix-500 — wrap create in retry. Same transient
                // deadlock / pages_blocks_*_parent_id_fk races observed on
                // /api/sites/*/save also hit AI gen create (1 hit / 6h
                // window). Reuses the save-route retry wrapper.
                let createdPage: Record<string, unknown>
                try {
                    createdPage = await withPayloadRetry(
                        () => payload.create({
                            collection: 'pages',
                            data: {
                                title: pageDefinition.title,
                                slug: pageDefinition.slug,
                                site: site.id,
                                isHomepage: pageDefinition.isHomepage,
                                _status: 'published',
                                layout: sanitizedLayout,
                                seo: pageDefinition.seo,
                            },
                        }),
                        {
                            onRetry: (attempt, kind) => {
                                console.warn(
                                    `[generate-site] Retry page create attempt=${attempt} kind=${kind} slug=${pageDefinition.slug}`,
                                )
                            },
                        },
                    ) as Record<string, unknown>
                } catch (firstErr) {
                    // Plan 260415 fix-500 — fallback: when the first create fails
                    // with a "pages_blocks_*_images" / upload foreign-key error,
                    // strip ALL image refs from the page and retry once without
                    // them. A site without images is better than a 500.
                    const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr)
                    const isImageFkError = /pages_blocks_[a-z_]+_images|image_id|upload/i.test(firstMsg)
                    if (!isImageFkError) throw firstErr

                    console.warn(
                        `[generate-site] Retry without image refs after: ${firstMsg.slice(0, 160)}`,
                    )
                    cleanupNonNumericImageFields(sanitizedLayout as Record<string, unknown>[])
                    // Also null numeric image refs so Payload doesn't try them again.
                    for (const block of sanitizedLayout as Record<string, unknown>[]) {
                        for (const field of ['image', 'backgroundImage', 'logo', 'avatar', 'ogImage']) {
                            if (typeof block[field] === 'number') delete block[field]
                        }
                        for (const arrayField of ['images', 'projects', 'members', 'testimonials', 'logos']) {
                            const arr = block[arrayField]
                            if (!Array.isArray(arr)) continue
                            for (const item of arr as Record<string, unknown>[]) {
                                if (item && typeof item === 'object') {
                                    for (const f of ['image', 'logo', 'avatar']) {
                                        if (typeof item[f] === 'number') delete item[f]
                                    }
                                }
                            }
                        }
                    }
                    createdPage = await payload.create({
                        collection: 'pages',
                        data: {
                            title: pageDefinition.title,
                            slug: pageDefinition.slug,
                            site: site.id,
                            isHomepage: pageDefinition.isHomepage,
                            _status: 'published',
                            layout: sanitizedLayout,
                            seo: pageDefinition.seo,
                        },
                    }) as Record<string, unknown>
                }
                createdPages.push(createdPage)
                _createdPagesCount++
            } catch (pageErr) {
                const errMsg = pageErr instanceof Error ? pageErr.message : String(pageErr)
                pageFailures.push({
                    slug: pageDefinition.slug,
                    title: pageDefinition.title,
                    error: errMsg,
                })
                console.error('[generate-site] Page create failed', JSON.stringify({
                    slug: pageDefinition.slug,
                    isHomepage: pageDefinition.isHomepage,
                    blockCount: Array.isArray(sanitizedLayout) ? sanitizedLayout.length : 0,
                    errMsg,
                }))
                // Homepage failure is fatal — rethrow so outer catch returns 500
                if (pageDefinition.isHomepage) {
                    throw pageErr
                }
                // Sub-page failure is soft — continue loop, gen still ships
            }
        }

        // GH-817 post-creation layout sync: if any pages failed to create, their links are
        // still present in nav AND footer blocks of successfully saved pages (normalizedPageLinks
        // was computed BEFORE the for-loop). Patch both blocks in a single update per page.
        if (pageFailures.length > 0 && normalizedPageLinks.length > 0 && createdPages.length > 0) {
            const succeededSlugs = new Set(
                createdPages.map(p => {
                    const s = String(p.slug ?? '')
                    return s === '/' ? '/' : s.replace(/^\/+/, '')
                }),
            )
            const survivingLinks = normalizedPageLinks.filter(l => {
                const normalized = l.url === '/' ? '/' : l.url.replace(/^\/+/, '')
                return succeededSlugs.has(normalized)
            })
            // URLs that no longer have a backing page — used to filter footer column links
            const failedUrls = new Set(
                pageFailures.map(f => f.slug === '/' ? '/' : `/${f.slug.replace(/^\/+/, '')}`)
            )

            if (survivingLinks.length < normalizedPageLinks.length) {
                const survivingCtaUrl = resolveCtaUrl(survivingLinks)
                for (const createdPage of createdPages) {
                    const rawLayout = Array.isArray(createdPage.layout)
                        ? (createdPage.layout as Record<string, unknown>[])
                        : []
                    let layoutChanged = false

                    const patchedLayout = rawLayout.map(block => {
                        const bt = typeof block?.blockType === 'string'
                            ? (block.blockType as string).toLowerCase() : ''

                        // Patch nav — replace links with survivingLinks
                        if (['navigation', 'header', 'navbar'].includes(bt)) {
                            layoutChanged = true
                            return {
                                ...block,
                                links: survivingLinks.map(l => ({ ...l })),
                                ...(block.ctaButton && typeof block.ctaButton === 'object'
                                    ? { ctaButton: { ...(block.ctaButton as Record<string, unknown>), url: survivingCtaUrl } }
                                    : {}),
                            }
                        }

                        // Patch footer — remove links pointing to failed pages from every column
                        if (bt === 'footer' && Array.isArray(block.columns)) {
                            const patchedColumns = (block.columns as Record<string, unknown>[]).map(col => {
                                if (!Array.isArray(col.links)) return col
                                const filtered = (col.links as Record<string, unknown>[]).filter(
                                    l => !failedUrls.has(String(l.url ?? ''))
                                )
                                if (filtered.length === (col.links as unknown[]).length) return col
                                layoutChanged = true
                                return { ...col, links: filtered }
                            })
                            return { ...block, columns: patchedColumns }
                        }

                        return block
                    })

                    if (!layoutChanged) continue

                    const cleanedPatchedLayout = stripArrayItemIds(patchedLayout) as Record<string, unknown>[]
                    try {
                        await payload.update({
                            collection: 'pages',
                            id: createdPage.id as string | number,
                            data: { layout: cleanedPatchedLayout },
                        })
                    } catch (syncErr) {
                        console.warn(
                            '[generate-site] layout-sync patch failed page=%s: %s',
                            createdPage.slug,
                            syncErr instanceof Error ? syncErr.message : syncErr,
                        )
                    }
                }
                // Patch sanitizedBlocks nav so headerBlock persistence also reflects surviving pages
                const navInSanitized = sanitizedBlocks.find(b => b.blockType === 'navigation')
                if (navInSanitized) {
                    navInSanitized.links = survivingLinks.map(l => ({ ...l }))
                    if (navInSanitized.ctaButton && typeof navInSanitized.ctaButton === 'object') {
                        ;(navInSanitized.ctaButton as Record<string, unknown>).url = survivingCtaUrl
                    }
                }
                console.info(
                    `[generate-site] layout-sync: removed ${normalizedPageLinks.length - survivingLinks.length} ghost link(s), patched ${createdPages.length} page(s) (nav+footer)`,
                )
            }
        }

        // BUG-F05-005: Auto-create 404 page for every new site
        try {
            await payload.create({
                collection: 'pages',
                data: {
                    title: '404 Not Found',
                    slug: '404',
                    site: site.id,
                    tenant: resolvedTenantId,
                    isHomepage: false,
                    _status: 'published',
                    layout: [
                        { blockType: 'hero', variant: 'centered', headline: '404', subheadline: 'Page Not Found — The page you are looking for does not exist or has been moved.' },
                    ],
                    seo: {
                        title: '404 - Page Not Found',
                        description: 'The page you are looking for does not exist.',
                        noIndex: true,
                    },
                },
            })
        } catch (err404) {
            // Non-fatal: 404 page may already exist (e.g. re-generation)
            console.warn('[generate-site] 404 page creation skipped:', err404 instanceof Error ? err404.message : err404)
        }

        // GH-727: backfill IMAGE_LIBRARY → S3 for this site's category (fire-and-forget)
        // Use safeSiteType (same key used by storefront blocks) so seeder alt keys match resolver lookups.
        if (resolvedTenantId) {
            const _seedCategory = safeSiteType
            import('@/lib/images/image-library-seeder')
                .then(({ seedImageLibraryForSite }) =>
                    seedImageLibraryForSite(payload, resolvedTenantId!, site.id as string | number, _seedCategory),
                )
                .catch(err =>
                    console.error('[generate-site] image-library seed failed',
                        err instanceof Error ? err.message : err),
                )
        }

        phaseTimings.db = (phaseTimings.db ?? 0) + (Date.now() - dbPhaseStart)

        const homepagePage = createdPages.find((createdPage) => createdPage.isHomepage) || createdPages[0]

        // Mark generation completed and persist headerBlock so SiteRenderer
        // can read breadcrumbConfig on the public site without requiring a
        // manual editor save first.
        // GH-820: read nav from pageDefinitions (links already normalized) instead of
        // sanitizedBlocks which still has raw AI slugs (/book-trial, /the-lab, etc.)
        const homepageLayout = (pageDefinitions[0]?.layout ?? []) as Array<{ blockType?: unknown }>
        const generatedHeaderBlock = homepageLayout.find(b => b.blockType === 'navigation') ?? null
        await payload.update({
            collection: 'sites',
            id: site.id as string | number,
            data: {
                generationStatus: 'completed',
                ...(generatedHeaderBlock ? { headerBlock: generatedHeaderBlock } : {}),
            },
        })

        // Write sample products to DB (non-fatal — awaits the parallel promise started above)
        // Matches constraint name from Drizzle: <table>_<col>_<reftable>_<refcol>_fk
        // Combines constraint-name regex with PG code for cases where Payload wraps the
        // error and the constraint name appears in .cause.constraint rather than .message.
        const isStaleMediaFk = (e: unknown): boolean => {
            const msg = e instanceof Error ? e.message : String(e ?? '')
            const code = (e as { code?: string })?.code ?? ((e as { cause?: { code?: string } })?.cause?.code ?? '')
            const constraint = (e as { constraint?: string })?.constraint ?? ((e as { cause?: { constraint?: string } })?.cause?.constraint ?? '')
            return /products_images_image_id_media_id_fk/i.test(msg)
                || (code === '23503' && /products_images_image_id_media_id_fk|image_id/i.test(constraint + msg))
        }
        let productsCreatedCount = 0
        let productImageStats = { rateLimited: 0, uploadFailed: 0, noImage: 0 }
        try {
            const { products: sampleProducts, stats: imgStats } = await sampleProductsPromise
            productImageStats = imgStats
            for (const product of sampleProducts) {
                // Guard: name must be at least 3 chars (Products schema minLength)
                const name = product.name?.trim()
                if (!name || name.length < 3) {
                    console.warn('[generate-site] sample product skipped — name too short:', JSON.stringify(name))
                    continue
                }
                // Pre-create media check: shrink TOCTOU window between fetchProductImage verify
                // and payload.create. Media row can be deleted by orphan stripper / afterChange
                // hook between those two points. Drop imageId early if no longer exists.
                let safeImageId = product.imageId
                if (safeImageId != null) {
                    const exists = await payload.findByID({ collection: 'media', id: safeImageId, depth: 0 }).catch(() => null)
                    if (!exists) {
                        console.warn(`[generate-site] STALE_MEDIA_PRECHECK product="${name}" imageId=${safeImageId} dropped`)
                        safeImageId = undefined
                    }
                }
                const baseData = {
                    tenant: resolvedTenantId,
                    site: site.id,
                    name,
                    shortDescription: product.shortDescription,
                    description: product.description,
                    ...(product.descriptionBM ? { descriptionBM: product.descriptionBM } : {}),
                    price: product.price,
                    status: 'active' as const,
                }
                try {
                    await payload.create({
                        collection: 'products',
                        data: {
                            ...baseData,
                            ...(safeImageId ? { images: [{ image: safeImageId }] } : {}),
                        },
                    })
                    productsCreatedCount++
                } catch (err) {
                    if (safeImageId != null && isStaleMediaFk(err)) {
                        // FK violation: media row deleted between pre-check and create.
                        // Attempt one re-upload from gallery URL to get a fresh media row.
                        const galleryUrl = product.galleryUrl
                        if (galleryUrl) {
                            let retryImageId: number | undefined
                            try {
                                retryImageId = await uploadImageUrl(
                                    galleryUrl,
                                    `sample-product-retry-${site.id}-${Date.now()}.jpg`,
                                    name,
                                    resolvedTenantId,
                                    payload,
                                )
                            } catch {
                                // re-upload failed — fall through to create without image
                            }
                            if (retryImageId != null) {
                                try {
                                    await payload.create({
                                        collection: 'products',
                                        data: { ...baseData, images: [{ image: retryImageId }] },
                                    })
                                    productsCreatedCount++
                                    console.info(`[generate-site] STALE_MEDIA_FK_RETRY_OK product="${name}" oldId=${safeImageId} newId=${retryImageId}`)
                                } catch {
                                    // retry with new id also failed — give up gracefully
                                    try {
                                        await payload.create({ collection: 'products', data: baseData })
                                        productsCreatedCount++
                                    } catch { /* non-fatal */ }
                                    console.warn(`[generate-site] STALE_MEDIA_FK_GIVE_UP product="${name}" oldId=${safeImageId} reason=retry_fk`)
                                }
                            } else {
                                try {
                                    await payload.create({ collection: 'products', data: baseData })
                                    productsCreatedCount++
                                } catch { /* non-fatal */ }
                                console.warn(`[generate-site] STALE_MEDIA_FK_RETRY_FAIL product="${name}" oldId=${safeImageId} reason=reupload_fail`)
                            }
                        } else {
                            try {
                                await payload.create({ collection: 'products', data: baseData })
                                productsCreatedCount++
                            } catch { /* non-fatal */ }
                            console.warn(`[generate-site] STALE_MEDIA_FK_NO_FALLBACK product="${name}" imageId=${safeImageId}`)
                        }
                    } else {
                        // Non-FK error or no image attached — do NOT silently retry without image
                        const e = err as Error
                        console.warn(`[generate-site] sample product write failed (non-fatal): name="${name}" imageId=${safeImageId ?? 'none'} ${e.name}: ${e.message}`)
                    }
                }
            }
        } catch (err) {
            console.warn('[generate-site] sample products skipped (non-fatal):', (err as Error).message)
        }

        // Seed 3 blog posts after response is sent (non-fatal, skips on regenerate).
        // after() runs post-response on Vercel; falls back to fire-and-forget outside request scope (tests).
        const _blogSeedTask = () =>
            seedBlogPosts(
                payload,
                resolvedTenantId,
                site.id as string | number,
                resolveComposerCategory(businessInfo.industry),
                businessInfo.businessName,
                user.id,
                parseProductsString(businessInfo.products),
                businessInfo.industry,
                computeGenSeed(businessInfo),
            ).catch(err => console.warn('[generate-site] blog seed failed (non-fatal):', (err as Error).message))
        try {
            after(_blogSeedTask)
        } catch {
            void _blogSeedTask()
        }

            const timeMs = Date.now() - startTime

            // Plan 260415 F01-gen-audit — single summary line per gen so ops can
            // scan Vercel logs for phase breakdown without correlating manually.
            // Use compact key=value so grep/jq can pull it out easily.
            const phaseOther = Math.max(
                0,
                timeMs - (phaseTimings.ai ?? 0) - (phaseTimings.media ?? 0) - (phaseTimings.db ?? 0),
            )
            console.info(
                `[generate-site] DONE total=${timeMs}ms ai=${phaseTimings.ai ?? 0}ms media=${phaseTimings.media ?? 0}ms db=${phaseTimings.db ?? 0}ms other=${phaseOther}ms pages=${createdPages.length} failures=${pageFailures.length} gen_mode=${process.env.GEN_MODE?.trim() || 'template-first'} unsplash_rl=${productImageStats.rateLimited} images_failed=${productImageStats.uploadFailed} products_no_image=${productImageStats.noImage}`,
            )

            return { result, site, homepagePage, createdPages, pageFailures, productsCreatedCount, timeMs, productImageStats }
        } // end runGenPipeline

        // ── F3: Real SSE streaming — return Response immediately, pipeline runs inside start() ──
        if (isStreaming) {
            const _encoder = new TextEncoder()
            return new Response(new ReadableStream<Uint8Array>({
                async start(controller) {
                    const onEvent = (e: SSEEvent) =>
                        controller.enqueue(
                            _encoder.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`),
                        )
                    try {
                        const {
                            result,
                            site: _pipeSite,
                            homepagePage,
                            createdPages,
                            productsCreatedCount,
                            timeMs,
                        } = await runGenPipeline(onEvent)

                        // products_generated event
                        if (productsCreatedCount > 0) {
                            controller.enqueue(
                                _encoder.encode(
                                    `event: products_generated\ndata: ${JSON.stringify({ count: productsCreatedCount })}\n\n`,
                                ),
                            )
                        }

                        // done event
                        const doneData =
                            `event: done\ndata: ${JSON.stringify({
                                siteId: _pipeSite.id,
                                pageId: (homepagePage as { id: unknown }).id,
                                siteName: result.siteName,
                                siteLanguage: result.language || language,
                                totalBlocks: result.blocks.length,
                                totalPages: createdPages.length,
                                timeMs,
                            })}\n\n`
                        controller.enqueue(_encoder.encode(doneData))
                    } catch (streamErr) {
                        const errMsg =
                            streamErr instanceof Error ? streamErr.message : String(streamErr)
                        // Guard: if stream was canceled (client disconnected), enqueue throws —
                        // wrap so error recovery below always runs regardless of stream state.
                        try {
                            controller.enqueue(
                                _encoder.encode(
                                    `event: error\ndata: ${JSON.stringify({ message: errMsg })}\n\n`,
                                ),
                            )
                        } catch { /* stream already canceled — skip SSE write, still recover DB */ }
                        // Error recovery: update site status if site was created before failure
                        if (_site?.id && _payload) {
                            const status = _createdPagesCount > 0 ? 'completed' : 'failed'
                            await _payload
                                .update({
                                    collection: 'sites',
                                    id: _site.id as string | number,
                                    data: { generationStatus: status },
                                })
                                .catch(() => {})
                        }
                    } finally {
                        try { controller.close() } catch { /* already closed */ }
                    }
                },
            }), {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            })
        }

        // Non-streaming path (legacy — streaming is always used in production)
        const {
            result,
            site,
            homepagePage,
            createdPages,
            productsCreatedCount: _productsCreatedCount,
            timeMs,
        } = await runGenPipeline()

        return NextResponse.json({
            success: true,
            siteId: site.id,
            pageId: (homepagePage as { id: unknown }).id,
            siteName: result.siteName,
            siteLanguage: result.language || language,
            siteType: resolveSiteType(result.siteType),
            blockCount: result.blocks.length,
            totalPages: createdPages.length,
            theme: result.theme,
            timeMs,
        })

    } catch (error: unknown) {
        // Smart status: partial success (≥1 page created) = completed, 0 pages = failed
        const _siteForCatch = _site as Record<string, unknown> | null
        if (_siteForCatch?.id && _payload) {
            const status = _createdPagesCount > 0 ? 'completed' : 'failed'
            await _payload.update({
                collection: 'sites',
                id: _siteForCatch.id as string | number,
                data: { generationStatus: status },
            }).catch((_e: unknown) => console.error('[AI Generate] Failed to update generation status:', _e))
        }

        const errMsg = error instanceof Error ? error.message : String(error)
        const errStack = error instanceof Error ? error.stack : ''

        // Drizzle wraps the real Postgres error (e.g. `column "variant" does not
        // exist`) in a wrapper whose .message is just "Failed query: <sql>". The
        // actionable detail lives on `.cause` (pg DatabaseError) with `code`,
        // `detail`, `hint`, `table`, `column`, `position`. Without this, a
        // missing-column migration produces an opaque 500 — see prior fixes for
        // faq/pricing variant columns (commits 355fc7c1 / 73dc271b).
        type PgErrLike = { code?: string; detail?: string; hint?: string; table?: string; column?: string; position?: string; message?: string }
        const cause = (error as { cause?: unknown })?.cause
        const pgErr: PgErrLike | null = cause && typeof cause === 'object' ? cause as PgErrLike : null
        const causeMsg = pgErr?.message
        const pgCode = pgErr?.code
        const pgDetail = pgErr?.detail
        const pgTable = pgErr?.table
        const pgColumn = pgErr?.column

        // Plan 260415 fix-500 — structured error log with debugId + stage
        // context so Vercel log search can group failures + PM can cite a
        // support ID when users report "it broke". Stop leaking raw errMsg
        // into the user response body (security + UX smell).
        const debugId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        console.error('[AI Generate Site Error]', JSON.stringify({
            debugId,
            errMsg: errMsg.slice(0, 500),
            causeMsg: causeMsg?.slice(0, 500),
            pgCode,
            pgDetail: pgDetail?.slice(0, 300),
            pgTable,
            pgColumn,
            pagesCreated: _createdPagesCount,
            siteId: _siteForCatch?.id ?? null,
        }))
        if (errStack) console.error('[AI Generate Site Error Stack]', debugId, errStack)

        return NextResponse.json(
            {
                error: 'Failed to generate website. Please try again in a moment.',
                debugId,
            },
            { status: 500 },
        )
    }
}

function cloneBlockData<T>(value: T): T {
    return JSON.parse(JSON.stringify(value))
}

function normalizeInternalUrl(url: unknown): string {
    if (typeof url !== 'string') return '#'
    if (url === '#' || url === '#home' || url === '/home' || url === 'home') return '/'
    if (url === '#about' || url === 'about') return '/about'
    if (url === '#features' || url === '#services' || url === '#products' || url === 'products') return '/products'
    if (url === '#contact' || url === 'contact') return '/contact'
    return url
}

function applyGeneratedSiteNavigation(
    blocks: AIBlock[],
    businessName: string,
    pageLinks?: readonly { label: string; url: string }[] | null,
): AIBlock[] {
    const normalizedBlocks = cloneBlockData(blocks)
    const links = pageLinks ?? DEFAULT_NAV_LINKS

    return normalizedBlocks.map((block) => {
        if (block.blockType === 'navigation') {
            return {
                ...block,
                logoText: block.logoText || businessName,
                links: links.map((l) => ({ ...l })),
                ctaButton: block.ctaButton
                    ? {
                        ...block.ctaButton,
                        // Resolve to a real generated page — avoids /contact 404 when no Contact page exists.
                        url: resolveCtaUrl(links),
                    }
                    : block.ctaButton,
            }
        }

        if (block.blockType === 'hero' && Array.isArray(block.ctaButtons)) {
            return {
                ...block,
                ctaButtons: block.ctaButtons.map((button: AIBlock | string) => {
                    if (typeof button === 'string') return { label: button, url: '#' }
                    return {
                        ...button,
                        url: normalizeInternalUrl(button.url),
                    }
                }),
            }
        }

        if (block.blockType === 'footer' && Array.isArray(block.columns)) {
            return {
                ...block,
                logoText: block.logoText || businessName,
                columns: block.columns.map((column: AIBlock | string, colIdx: number) => {
                    if (typeof column === 'string') return { title: column, links: [] }

                    // When aiPageLinks provided, replace the first (pages) column with actual page links
                    // so footer mirrors the nav menu — same fix as navigation block above.
                    if (pageLinks != null && colIdx === 0) {
                        return { ...column, links: links.map(l => ({ ...l })) }
                    }

                    return {
                        ...column,
                        links: Array.isArray(column.links)
                            ? column.links.map((link: AIBlock | string) => {
                                if (typeof link === 'string') return { label: link, url: '#' }
                                const url = String(link.url || '#')
                                // Update contact-type links in non-pages columns to a real page
                                if (pageLinks != null && /^(\/|#)?contact\b/i.test(url)) {
                                    return { ...link, url: resolveCtaUrl(links) }
                                }
                                return { ...link, url: normalizeInternalUrl(url) }
                            })
                            : column.links,
                    }
                }),
            }
        }

        return block
    })
}

function createPageHero(baseHero: AIBlock | null, options: {
    headline: string
    subheadline: string
    primaryLabel?: string
    primaryUrl?: string
    secondaryLabel?: string
    secondaryUrl?: string
    badgeText?: string
}): AIBlock {
    const hero = cloneBlockData(baseHero || {
        blockType: 'hero',
        variant: 'centered',
    })

    hero.blockType = 'hero'
    // Validate variant against registry — AI may produce invalid variants
    const heroMeta = blockRegistry.getBlockMeta('hero')
    const validVariants = heroMeta?.variants || ['centered', 'split-left', 'split-right', 'fullscreen', 'minimal']
    hero.variant = (typeof hero.variant === 'string' && validVariants.includes(hero.variant))
        ? hero.variant
        : 'centered'
    hero.headline = options.headline
    hero.subheadline = options.subheadline
    hero.badge = options.badgeText
        ? { show: true, text: options.badgeText }
        : hero.badge

    hero.ctaButtons = [
        {
            label: options.primaryLabel || 'Get in touch',
            url: options.primaryUrl || '/contact',
            style: 'primary',
        },
    ]

    if (options.secondaryLabel && options.secondaryUrl) {
        hero.ctaButtons.push({
            label: options.secondaryLabel,
            url: options.secondaryUrl,
            style: 'outline',
        })
    }

    return hero
}

// GH-820: normalize canonical page slugs so AI cannot invent arbitrary slugs
// for well-known pages (e.g. slug "free-trial" instead of "contact").
// Detection priority: block content (structural) > title keyword match.
function canonicalizePageSlug(
    page: { title: string; slug: string; isHomepage?: boolean; blocks: AIBlock[] },
    index: number,
): string {
    if (page.isHomepage === true || index === 0) return '/'
    // Title is authoritative — AI titles are reliable signals and checked first to
    // avoid misclassifying pages that include secondary structural blocks (e.g. a
    // Services page with a contact form at the bottom must not become slug 'contact').
    const title = (page.title || '').toLowerCase()
    if (/\babout\b/.test(title)) return '/about'
    if (/\bcontact\b|\bget[\s-]started\b|\bfree[\s-]trial\b|\btrial\b/.test(title)) return '/contact'
    if (/\bblog\b|\bnews\b|\barticles\b/.test(title)) return '/blog'
    // Block-based fallback: use the FIRST non-structural content block only.
    // Set-membership would misclassify pages where contact/about appear as secondary sections.
    const STRUCTURAL = new Set(['navigation', 'footer', 'hero'])
    const firstContent = (page.blocks || []).find((b) => !STRUCTURAL.has(b.blockType ?? ''))
    if (firstContent?.blockType === 'contact') return '/contact'
    if (firstContent?.blockType === 'about') return '/about'
    if (firstContent?.blockType === 'blog-list') return '/blog'
    // Ensure leading slash to match builder convention (routing queries slug with '/' prefix)
    const raw = page.slug || `page-${index}`
    return raw.startsWith('/') ? raw : `/${raw}`
}

function buildGeneratedPages({
    blocks,
    businessInfo,
    result,
}: {
    blocks: AIBlock[]
    businessInfo: { businessName: string; shortDescription: string; products: string }
    result: Record<string, unknown>
}) {
    // Use AI-generated multi-page content when available
    const aiPages = (result as { pages?: Array<{ title: string; slug: string; isHomepage?: boolean; blocks: AIBlock[]; seo?: Record<string, unknown> }> }).pages
    if (aiPages && aiPages.length > 0) {
        return aiPages.map((page, index) => ({
            title: page.title || `Page ${index + 1}`,
            slug: canonicalizePageSlug(page, index),
            isHomepage: page.isHomepage === true || index === 0,
            layout: cloneBlockData(page.blocks || []),
            seo: {
                title: String(page.seo?.title || page.title || ''),
                description: String(page.seo?.description || ''),
            },
        }))
    }

    // Fallback: clone-based page generation for single-page AI response
    // B4 fix: log if duplicate structural blocks found in fallback path
    const heroCandidates = blocks.filter((block) => block.blockType === 'hero')
    if (heroCandidates.length > 1) {
        console.warn(`[buildGeneratedPages] fallback path: ${heroCandidates.length} hero blocks — using first`)
    }
    const navigation = blocks.find((block) => block.blockType === 'navigation') || null
    const hero = heroCandidates[0] ?? null
    const about = blocks.find((block) => block.blockType === 'about') || null
    const features = blocks.find((block) => block.blockType === 'features') || null
    const testimonials = blocks.find((block) => block.blockType === 'testimonials') || null
    const contact = blocks.find((block) => block.blockType === 'contact') || null
    const footer = blocks.find((block) => block.blockType === 'footer') || null

    const compact = (pageBlocks: Array<AIBlock | null>) =>
        pageBlocks.filter(Boolean).map((block) => cloneBlockData(block))

    return [
        {
            title: 'Home',
            slug: '/',
            isHomepage: true,
            layout: cloneBlockData(blocks),
            seo: {
                title: String((result.seo as Record<string, unknown>).title || ''),
                description: String((result.seo as Record<string, unknown>).description || ''),
            },
        },
        {
            title: 'About',
            slug: '/about',
            isHomepage: false,
            layout: compact([
                navigation,
                createPageHero(hero, {
                    headline: `About ${businessInfo.businessName}`,
                    subheadline: businessInfo.shortDescription,
                    primaryLabel: 'Contact us',
                    primaryUrl: '/contact',
                    secondaryLabel: 'View services',
                    secondaryUrl: '/products',
                    badgeText: 'About Us',
                }),
                about,
                testimonials,
                footer,
            ]),
            seo: {
                title: `About ${businessInfo.businessName}`,
                description: businessInfo.shortDescription,
            },
        },
        {
            title: 'Products',
            slug: '/products',
            isHomepage: false,
            layout: compact([
                navigation,
                createPageHero(hero, {
                    headline: `${businessInfo.businessName} Products & Services`,
                    subheadline: businessInfo.products,
                    primaryLabel: 'Contact us',
                    primaryUrl: '/contact',
                    secondaryLabel: 'About us',
                    secondaryUrl: '/about',
                    badgeText: 'Products & Services',
                }),
                features,
                testimonials,
                footer,
            ]),
            seo: {
                title: `${businessInfo.businessName} Products & Services`,
                description: businessInfo.products,
            },
        },
        {
            title: 'Contact',
            slug: '/contact',
            isHomepage: false,
            layout: compact([
                navigation,
                createPageHero(hero, {
                    headline: `Contact ${businessInfo.businessName}`,
                    subheadline: 'Reach out to discuss your business needs, request a quote, or ask any questions.',
                    primaryLabel: 'Back to home',
                    primaryUrl: '/',
                    secondaryLabel: 'View services',
                    secondaryUrl: '/products',
                    badgeText: 'Contact Us',
                }),
                contact,
                footer,
            ]),
            seo: {
                title: `Contact ${businessInfo.businessName}`,
                description: `Get in touch with ${businessInfo.businessName}.`,
            },
        },
    ]
}

/**
 * Sanitize AI-generated blocks for Payload CMS compatibility.
 * 
 * KEY ISSUE: AI models return field names that don't match Payload schema.
 * Example: AI returns { text: "Home" } but Payload requires { label: "Home" }
 * 
 * This function normalizes ALL block types to match the Pages collection schema.
 */
function sanitizeBlocksForPayload(blocks: AIBlock[]): AIBlock[] {
    return blocks.map(block => {
        const sanitized = { ...block }

        // Helper: normalize a link object → { label, url }
        const normalizeLink = (link: AIBlock | string): { label: string; url: string; openInNewTab?: boolean } => {
            if (typeof link === 'string') {
                return { label: link, url: '#' }
            }
            return {
                label: String(link.label || link.text || link.title || link.name || 'Link'),
                url: String(link.url || link.href || link.link || '#'),
                ...(link.openInNewTab !== undefined ? { openInNewTab: typeof link.openInNewTab === 'boolean' ? link.openInNewTab : undefined } : {}),
            }
        }

        // ── Navigation: links[] requires { label (required), url (required) } ──
        if (sanitized.blockType === 'navigation') {
            // AI may use "navLinks" or "links" — normalize to "links"
            const rawLinks = sanitized.links || sanitized.navLinks || []
            sanitized.links = Array.isArray(rawLinks)
                ? rawLinks.map(normalizeLink).filter((l: AIBlock) => l.label && l.label !== 'Link')
                : []
            // Clean up wrong field name
            delete sanitized.navLinks

            // CTA button normalization
            if (sanitized.ctaButton) {
                sanitized.ctaButton = {
                    show: sanitized.ctaButton.show !== false,
                    label: String(sanitized.ctaButton.label || sanitized.ctaButton.text || 'Get Started'),
                    url: String(sanitized.ctaButton.url || sanitized.ctaButton.href || '#'),
                }
            }

            // Ensure logoText exists
            if (!sanitized.logoText && sanitized.logo && typeof sanitized.logo === 'string') {
                sanitized.logoText = sanitized.logo
                delete sanitized.logo // logo field is upload type, can't be string
            }
        }

        // ── Hero: ctaButtons[] requires { label (required), url (required) } ──
        if (sanitized.blockType === 'hero') {
            if (Array.isArray(sanitized.ctaButtons)) {
                sanitized.ctaButtons = sanitized.ctaButtons.map((btn: AIBlock | string) => {
                    if (typeof btn === 'string') {
                        return { label: btn, url: '#', style: 'primary' }
                    }
                    return {
                        label: String(btn.label || btn.text || btn.title || 'Button'),
                        url: String(btn.url || btn.href || btn.link || '#'),
                        style: btn.style || 'primary',
                    }
                })
            }
            // Ensure headline exists
            if (!sanitized.headline) {
                sanitized.headline = sanitized.title || sanitized.heading || 'Welcome'
            }
        }

        // ── Contact/Form: formFields[] requires { fieldName, label, fieldType } ──
        if (sanitized.formFields && Array.isArray(sanitized.formFields)) {
            sanitized.formFields = sanitized.formFields.map((field: AIBlock | string) => {
                if (typeof field === 'string') {
                    const name = field.toLowerCase()
                    let fieldType = 'text'
                    if (name.includes('email')) fieldType = 'email'
                    else if (name.includes('phone') || name.includes('telefon')) fieldType = 'phone'
                    else if (name.includes('message') || name.includes('content') || name.includes('mesej')) fieldType = 'textarea'
                    return { fieldName: field, label: field, fieldType, required: true }
                }
                const VALID_FIELD_TYPES = ['text', 'email', 'phone', 'textarea', 'select']
                let ft = String(field.fieldType || field.type || 'text')
                if (ft === 'tel' || ft === 'telephone') ft = 'phone'
                if (ft === 'number') ft = 'text'
                if (!VALID_FIELD_TYPES.includes(ft)) ft = 'text'
                return {
                    fieldName: String(field.fieldName || field.name || field.id || 'field'),
                    label: String(field.label || field.fieldName || field.name || 'Field'),
                    fieldType: ft,
                    required: field.required !== undefined ? field.required : true,
                    placeholder: field.placeholder || '',
                }
            })
        }

        // ── Footer: columns[].links[] requires { label, url } ──
        if (sanitized.blockType === 'footer') {
            if (Array.isArray(sanitized.columns)) {
                sanitized.columns = sanitized.columns.map((col: AIBlock | string) => {
                    if (typeof col === 'string') {
                        return { title: col, links: [] }
                    }
                    return {
                        title: String(col.title || col.heading || 'Column'),
                        links: Array.isArray(col.links) ? col.links.map(normalizeLink) : [],
                    }
                })
            }
            if (Array.isArray(sanitized.socials)) {
                sanitized.socials = sanitized.socials.map((socialRaw: unknown) => {
                    if (typeof socialRaw === 'string') {
                        return { platform: socialRaw.toLowerCase(), url: '#' }
                    }
                    const social = (typeof socialRaw === 'object' && socialRaw !== null) ? socialRaw as Record<string, unknown> : {};
                    return {
                        platform: String(social.platform || social.name || 'twitter').toLowerCase(),
                        url: String(social.url || social.link || '#'),
                    }
                })
            }
        }

        // ── Features: features[] requires { title (required), description (required) } ──
        if (sanitized.blockType === 'features') {
            // AI may use "items" instead of "features"
            const rawFeatures = sanitized.features || sanitized.items || []
            sanitized.features = Array.isArray(rawFeatures)
                ? rawFeatures.map((item: AIBlock | string) => {
                    if (typeof item === 'string') {
                        return { title: item, description: '', icon: '✨' }
                    }
                    return {
                        icon: item.icon || '✨',
                        title: String(item.title || item.name || item.heading || 'Feature'),
                        description: String(item.description || item.desc || item.text || ''),
                    }
                })
                : []
            delete sanitized.items
            // Ensure headline
            if (!sanitized.headline) {
                sanitized.headline = sanitized.title || 'Our Features'
            }
        }

        // ── Testimonials: testimonials[] requires { quote (required), name (required) } ──
        if (sanitized.blockType === 'testimonials') {
            // AI may use "items" instead of "testimonials"
            const rawTestimonials = sanitized.testimonials || sanitized.items || []
            sanitized.testimonials = Array.isArray(rawTestimonials)
                ? rawTestimonials.map((item: AIBlock | string) => {
                    if (typeof item === 'string') {
                        return { quote: item, name: 'Customer', rating: 5 }
                    }
                    return {
                        quote: String(item.quote || item.text || item.content || item.review || 'Great service!'),
                        name: String(item.name || item.author || item.customer || 'Customer'),
                        title: item.title || item.role || item.position || '',
                        company: item.company || item.organization || '',
                        rating: item.rating || 5,
                    }
                })
                : []
            delete sanitized.items
        }

        // ── Team: members[] requires { name (required) } + socials[] ──
        // Plan 260415 — defensive name + role fallback. Payload schema marks
        // `members.name` as `required: true`, so any member with empty/missing
        // name crashes the whole `payload.create` with a ValidationError.
        // Historical gens have surfaced this when GPT returned 4+ members and
        // left the last one with only `bio` + `image`. Run this as a final
        // pre-save sanitize so neither the AI happy path nor the fallback
        // composer can ship a nameless team member.
        if (sanitized.blockType === 'team' && Array.isArray(sanitized.members)) {
            sanitized.members = sanitized.members
                .map((memberRaw: unknown, idx: number) => {
                    const member = (typeof memberRaw === 'object' && memberRaw !== null) ? memberRaw as Record<string, unknown> : {};
                    const safeMember = { ...member }
                    const rawName = (member.name ?? member.fullName ?? member.displayName ?? '') as string
                    const trimmedName = typeof rawName === 'string' ? rawName.trim() : ''
                    safeMember.name = trimmedName || `Team Member ${idx + 1}`
                    const rawRole = (member.role ?? member.position ?? member.title ?? '') as string
                    const trimmedRole = typeof rawRole === 'string' ? rawRole.trim() : ''
                    safeMember.role = trimmedRole || 'Team Member'
                    if (Array.isArray(safeMember.socials)) {
                        safeMember.socials = safeMember.socials.map((socialRaw: unknown) => {
                            if (typeof socialRaw === 'string') {
                                return { platform: socialRaw.toLowerCase(), url: '#' }
                            }
                            const social = (typeof socialRaw === 'object' && socialRaw !== null) ? socialRaw as Record<string, unknown> : {};
                            return {
                                platform: String(social.platform || social.name || 'twitter').toLowerCase(),
                                url: String(social.url || social.link || '#'),
                            }
                        })
                    }
                    return safeMember
                })
        }

        // ── About: ensure headline ──
        if (sanitized.blockType === 'about') {
            if (!sanitized.headline) {
                sanitized.headline = sanitized.title || 'About Us'
            }
        }

        // ── Pricing: plans[] normalization ──
        if (sanitized.blockType === 'pricing' && Array.isArray(sanitized.plans)) {
            sanitized.plans = sanitized.plans.map((planRaw: unknown) => {
                if (typeof planRaw === 'string') {
                    return { name: planRaw, price: 'RM 0', features: [], ctaLabel: 'Buy', ctaUrl: '#' }
                }
                const plan = (typeof planRaw === 'object' && planRaw !== null) ? planRaw as Record<string, unknown> : {};
                const safePlan = { ...plan } as Record<string, unknown>
                safePlan.name = String(plan.name || plan.title || 'Plan')
                safePlan.price = String(plan.price || plan.cost || '$0')
                safePlan.ctaLabel = String(plan.ctaLabel || plan.buttonText || 'Buy Now')
                safePlan.ctaUrl = String(plan.ctaUrl || plan.url || '#')
                
                // Payload expects features as [{text: string, included: boolean}], NOT plain strings
                if (Array.isArray(plan.features)) {
                    safePlan.features = plan.features.map((fRaw: unknown) => {
                        if (typeof fRaw === 'string') return { text: fRaw, included: true }
                        const f = (typeof fRaw === 'object' && fRaw !== null) ? fRaw as Record<string, unknown> : {}
                        return {
                            text: String(f.text || f.name || f.feature || ''),
                            included: typeof f.included === 'boolean' ? f.included : true,
                        }
                    })
                } else {
                    safePlan.features = []
                }
                return safePlan
            })
        }

        // ── FAQ: normalize items/faqs array — Payload schema uses 'faqs' not 'items' ──
        if (sanitized.blockType === 'faq') {
            const rawFaqs = sanitized.faqs || sanitized.items
            if (Array.isArray(rawFaqs)) {
                sanitized.faqs = rawFaqs.map((itemRaw: unknown) => {
                    if (typeof itemRaw === 'string') {
                        return { question: itemRaw, answer: '...' }
                    }
                    const item = (typeof itemRaw === 'object' && itemRaw !== null) ? itemRaw as Record<string, unknown> : {}
                    return {
                        question: String(item.question || item.title || item.q || 'Question?'),
                        answer: String(item.answer || item.description || item.a || 'Answer.'),
                    }
                })
                delete sanitized.items
            }
        }

        // ── Logo Cloud: strip logos (needs real media) ──
        if (sanitized.blockType === 'logo-cloud') {
            sanitized.logos = []
        }

        // ── Google Maps: fix invalid variant + ensure embedUrl present + height as number ──
        if (sanitized.blockType === 'google-maps') {
            if (!['full-width', 'card'].includes(String(sanitized.variant ?? ''))) {
                sanitized.variant = 'full-width'
            }
            if (!sanitized.embedUrl) sanitized.embedUrl = ''
            if (sanitized.height !== undefined && typeof sanitized.height !== 'number') {
                const parsed = parseInt(String(sanitized.height), 10)
                sanitized.height = isNaN(parsed) ? 400 : parsed
            }
            delete sanitized.zoom
        }

        // ── Service Cards: services[].title is required ──
        if (sanitized.blockType === 'service-cards' && Array.isArray(sanitized.services)) {
            sanitized.services = (sanitized.services as AIBlock[]).map((svc: AIBlock) => ({
                ...svc,
                title: String(svc.title || svc.name || svc.heading || 'Service'),
            }))
        }

        // ── Portfolio Grid: projects[].title is required ──
        // AI gen with large counts (e.g. 12) may produce null titles for later items.
        if (sanitized.blockType === 'portfolio-grid' && Array.isArray(sanitized.projects)) {
            sanitized.projects = (sanitized.projects as AIBlock[]).map((proj: AIBlock, i: number) => ({
                ...proj,
                title: String(proj.title || proj.name || proj.heading || `Project ${i + 1}`),
            }))
        }

        // ── Social Proof: reviews[].author and reviews[].content are required ──
        if (sanitized.blockType === 'social-proof' && Array.isArray(sanitized.reviews)) {
            sanitized.reviews = (sanitized.reviews as AIBlock[]).map((rev: AIBlock) => ({
                ...rev,
                author: String(rev.author || rev.name || rev.customer || 'Customer'),
                content: String(rev.content || rev.text || rev.review || rev.quote || 'Great service!'),
            }))
        }

        // ── Step Process: steps[].title and steps[].description are required ──
        if (sanitized.blockType === 'step-process' && Array.isArray(sanitized.steps)) {
            sanitized.steps = (sanitized.steps as AIBlock[]).map((step: AIBlock, i: number) => ({
                ...step,
                title: String(step.title || step.name || step.heading || `Step ${i + 1}`),
                description: String(step.description || step.content || step.text || ''),
            }))
        }

        // ── Class Schedule: classes[].name is required ──
        if (sanitized.blockType === 'class-schedule' && Array.isArray(sanitized.classes)) {
            sanitized.classes = (sanitized.classes as AIBlock[]).map((cls: AIBlock, i: number) => ({
                ...cls,
                name: String(cls.name || cls.title || cls.className || `Class ${i + 1}`),
            }))
        }

        // ── Doctor Profile: doctors[].name is required ──
        if (sanitized.blockType === 'doctor-profile' && Array.isArray(sanitized.doctors)) {
            sanitized.doctors = (sanitized.doctors as AIBlock[]).map((doc: AIBlock, i: number) => ({
                ...doc,
                name: String(doc.name || doc.fullName || doc.title || `Doctor ${i + 1}`),
            }))
        }

        // ── Property Card: properties[].title is required ──
        if (sanitized.blockType === 'property-card' && Array.isArray(sanitized.properties)) {
            sanitized.properties = (sanitized.properties as AIBlock[]).map((prop: AIBlock, i: number) => ({
                ...prop,
                title: String(prop.title || prop.name || prop.address || `Property ${i + 1}`),
            }))
        }

        // ── Video Showcase: videos[].title and videos[].videoUrl are required ──
        // Drop items missing videoUrl — an empty/fake URL breaks the player.
        if (sanitized.blockType === 'video-showcase' && Array.isArray(sanitized.videos)) {
            sanitized.videos = (sanitized.videos as AIBlock[])
                .filter((vid: AIBlock) => vid.videoUrl || vid.url || vid.src)
                .map((vid: AIBlock, i: number) => ({
                    ...vid,
                    title: String(vid.title || vid.name || vid.heading || `Video ${i + 1}`),
                    videoUrl: String(vid.videoUrl || vid.url || vid.src),
                }))
        }

        // ── Product Quick View: products[].name is required ──
        if (sanitized.blockType === 'product-quick-view' && Array.isArray(sanitized.products)) {
            sanitized.products = (sanitized.products as AIBlock[]).map((prod: AIBlock, i: number) => ({
                ...prod,
                name: String(prod.name || prod.title || `Product ${i + 1}`),
            }))
        }

        // ── Feature Comparison: products[].name and features[].name are required ──
        if (sanitized.blockType === 'feature-comparison') {
            if (Array.isArray(sanitized.products)) {
                sanitized.products = (sanitized.products as AIBlock[]).map((p: AIBlock, i: number) => ({
                    ...p,
                    name: String(p.name || p.title || `Option ${i + 1}`),
                }))
            }
            if (Array.isArray(sanitized.features)) {
                sanitized.features = (sanitized.features as AIBlock[]).map((f: AIBlock, i: number) => ({
                    ...f,
                    name: String(f.name || f.title || f.label || `Feature ${i + 1}`),
                }))
            }
        }

        // ── Booking Widget: services[].name is required ──
        if (sanitized.blockType === 'booking-widget' && Array.isArray(sanitized.services)) {
            sanitized.services = (sanitized.services as AIBlock[]).map((svc: AIBlock, i: number) => ({
                ...svc,
                name: String(svc.name || svc.title || `Service ${i + 1}`),
            }))
        }

        // ── Menu Food: categories[].name and categories[].items[].name/.price are required ──
        if (sanitized.blockType === 'menu-food' && Array.isArray(sanitized.categories)) {
            sanitized.categories = (sanitized.categories as AIBlock[]).map((cat: AIBlock, ci: number) => {
                const items = Array.isArray(cat.items)
                    ? (cat.items as AIBlock[]).map((item: AIBlock, ii: number) => ({
                        ...item,
                        name: String(item.name || item.title || `Item ${ii + 1}`),
                        price: String(item.price || item.cost || 'RM 0'),
                    }))
                    : []
                return {
                    ...cat,
                    name: String(cat.name || cat.title || cat.category || `Category ${ci + 1}`),
                    items,
                }
            })
        }

        // ── Remove non-schema fields that AI might add ──
        delete sanitized.id
        delete sanitized.order
        delete sanitized.section

        return sanitized
    })
}
