export const dynamic = 'force-dynamic'
// Override vercel.json's 60s default — AI site generation runs:
//   OpenAI GPT-4.1-mini → Unsplash pipeline (5-10 images) → Payload create
// Real-world timing sits around 60-120s, previous 60s cap produced 504
// Gateway Timeout (staging run 00:42:15 2026-04-14 `[Theme] Using category…`).
// Vercel Pro / Fluid Compute allows up to 800s; 300s leaves comfortable headroom.
export const maxDuration = 300
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { generateSiteWithAI, type SSEEvent } from '@/lib/ai/openai-generator'
import { generateAndUploadHeroImage } from '@/lib/ai/openai-image'
import { planImageNeeds, fulfillImageNeeds, cleanupNonNumericImageFields } from '@/lib/ai/media-injector'
import { checkBusinessInfoSafety } from '@/lib/ai/content-safety'
import { generateSiteSchema } from '@/lib/validations/ai'
import { parseRequest } from '@/lib/validations/helpers'
import { getCurrentUser } from '@/lib/auth'
import { checkTwoTierRateLimit } from '@/lib/rateLimit'
import { slugify, ensureUniqueSlug } from '@/lib/utils/slugify'
import { blockRegistry } from '@/blocks/registry'
import { contentBriefToReferencePrompt, type ContentBrief } from '@/lib/ai/content-brief'
import { normalizeBusinessInput } from '@/lib/ai/input-normalizer'
import { parseProductsString } from '@/lib/ai/business-info-mapper'
import { pickCategoryThemeWithMood, hashBusinessName } from '@/lib/ai/category-theme-picker'
import { resolveComposerCategory } from '@/lib/ai/composer-category-resolver'
import { buildImagePool } from '@/lib/ai/image-pool'
import { resolveTheme } from '@/lib/theme/resolve'


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

        const { businessInfo: rawBusinessInfo, extraInstructions: rawExtraInstructions, language = 'en', contentBrief: rawContentBrief } = data!

        // Normalize text inputs before sending to AI
        const businessInfo = {
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
            return NextResponse.json(
                {
                    error: 'Rate limit exceeded. Please wait before trying again.',
                    retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
                        'X-RateLimit-Remaining': '0',
                    },
                }
            )
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

                await payload.update({
                    collection: 'users',
                    id: user.id,
                    data: {
                        tenants: [{ tenant: recoveredTenant.id, role: 'owner' }],
                    } as Record<string, unknown>,
                })

                resolvedTenantId = recoveredTenant.id as number | string
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
                        aiGenerationsCount: 0,
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

        // FR-15: Rate Limit - Free tier is limited to 1 AI generation
        // Bypass in development mode for testing
        const isDev = process.env.NODE_ENV === 'development'
        const tenant = typeof payload.findByID === 'function'
            ? await payload.findByID({ collection: 'tenants', id: resolvedTenantId })
            : { plan: 'pro', aiGenerationsCount: 0 }
        if (!isDev && tenant.plan === 'free') {
            const currentCount = tenant.aiGenerationsCount || 0
            if (currentCount >= 1) {
                return NextResponse.json(
                    {
                        error: 'Tài khoản Free chỉ được tạo website bằng AI 1 lần duy nhất. Vui lòng nâng cấp gói cước để tiếp tục.',
                        code: 'PAYMENT_REQUIRED'
                    },
                    { status: 402 }
                )
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

        // Generate with AI (or fallback)
        const { result, events } = await generateSiteWithAI(businessInfo, extraInstructions, language, referencePrompt)

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
                    // Plan 260414-2249 phase-01: pass parsed user products into
                    // media pipeline so deriveKeywords can drive Unsplash queries
                    // from what the user actually sells (translated vi/ms → en).
                    const parsedProducts = parseProductsString(businessInfo.products)
                    // Plan 260414-2249 phase-02: resolve theme mood and pass it
                    // so deriveKeywords appends mood imagery adjectives (e.g.
                    // 'candlelit' for elegant, 'minimalist' for serene). Keeps
                    // Unsplash queries per-mood coherent across all blocks on a site.
                    const presetCategory = resolveComposerCategory(businessInfo.industry)
                    const themeSeed = hashBusinessName(businessInfo.businessName)
                    const { mood: themeMood } = pickCategoryThemeWithMood(presetCategory, themeSeed)

                    // Plan 260414-2249 phase-03: build ONE per-site image pool
                    // before fulfillment so all blocks share the same photographer,
                    // lighting, mood. 1-2 Unsplash calls total (landscape + square)
                    // — replaces 6-8 per-block calls and delivers visual cohesion.
                    //
                    // Plan 07 — pass top-3 products so two restaurants whose
                    // first product collides still produce different queries.
                    const topProduct = parsedProducts[0]
                    const imagePool = await buildImagePool({
                        category: presetCategory,
                        mood: themeMood,
                        topProduct,
                        products: parsedProducts.slice(0, 3),
                        seed: themeSeed,
                    })
                    console.info(
                        `[Image Pool] query="${imagePool.queryUsed}" landscape=${imagePool.landscape.length} square=${imagePool.square.length} underfill=${imagePool.underfill}`,
                    )

                    await fulfillImageNeeds(
                        needs,
                        {
                            businessName: businessInfo.businessName,
                            tenantId: String(resolvedTenantId),
                            category: businessInfo.industry,
                            language: resolvedLang,
                            products: parsedProducts.length > 0 ? parsedProducts : undefined,
                            mood: themeMood,
                            pool: imagePool,
                        },
                        payload as unknown as Parameters<typeof fulfillImageNeeds>[2],
                    )
                }
                // Strip any slot still holding a URL/object (Unsplash failed or missing) —
                // Payload upload fields are optional; better empty than reject.
                // Run over every bucket so multi-page subpages get cleaned too.
                for (const bucket of allBuckets) {
                    cleanupNonNumericImageFields(bucket)
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

        if (existingSites.docs.length > 0) {
            // UPDATE existing site (template swap — keep site ID, update content)
            site = await payload.update({
                collection: 'sites',
                id: existingSites.docs[0].id,
                data: {
                    name: result.siteName,
                    status: 'draft',
                    generationStatus: 'generating',
                    siteType: result.siteType,
                    locale: ['ms', 'en'].includes(result.language || language) ? (result.language || language) : 'en',
                    theme: resolvedTheme,
                    seo: {
                        metaTitle: result.seo.title,
                        metaDescription: result.seo.description,
                    },
                    aiGenerationMetadata: {
                        generatedAt: new Date().toISOString(),
                        originalPrompt: `${businessInfo.businessName} | ${businessInfo.industry} | ${businessInfo.shortDescription || ''} | ${businessInfo.products}`,
                        businessType: result.siteType,
                    },
                },
            })

            // Delete old pages for this site
            const oldPages = await payload.find({
                collection: 'pages',
                where: { site: { equals: site.id } },
                limit: 100,
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
                    siteType: result.siteType,
                    locale: ['ms', 'en'].includes(result.language || language) ? (result.language || language) : 'en',
                    theme: resolvedTheme,
                    seo: {
                        metaTitle: result.seo.title,
                        metaDescription: result.seo.description,
                    },
                    aiGenerationMetadata: {
                        generatedAt: new Date().toISOString(),
                        originalPrompt: `${businessInfo.businessName} | ${businessInfo.industry} | ${businessInfo.shortDescription || ''} | ${businessInfo.products}`,
                        businessType: result.siteType,
                    },
                },
            })
        }
        _site = site

        // Sanitize blocks for Payload CMS compatibility
        const sanitizedBlocks = applyGeneratedSiteNavigation(
            sanitizeBlocksForPayload(result.blocks),
            result.siteName,
        )

        // Inject DALL-E generated Hero Image into the hero block (legacy path, flag-gated)
        if (ENABLE_DALLE_HERO && heroMedia) {
            const heroBlock = sanitizedBlocks.find(b => b.blockType === 'hero')
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

        const pageDefinitions = buildGeneratedPages({
            blocks: sanitizedBlocks,
            businessInfo,
            result,
        })

        const createdPages: Record<string, unknown>[] = []

        for (const pageDefinition of pageDefinitions) {
            // Sanitize variants in each page's layout blocks (safety net for cloned heroes)
            const sanitizedLayout = Array.isArray(pageDefinition.layout)
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

            const createdPage = await payload.create({
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
            })

            createdPages.push(createdPage)
            _createdPagesCount++
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
                    layout: [],
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

        const homepagePage = createdPages.find((createdPage) => createdPage.isHomepage) || createdPages[0]

        // FR-15: Increment AI generation count
        await payload.update({
            collection: 'tenants',
            id: resolvedTenantId,
            data: {
                aiGenerationsCount: (tenant.aiGenerationsCount || 0) + 1,
            },
        })

        // Mark generation completed
        await payload.update({
            collection: 'sites',
            id: site.id as string | number,
            data: { generationStatus: 'completed' },
        })

        const timeMs = Date.now() - startTime

        // ── SSE Streaming Response ──
        if (isStreaming) {
            const encoder = new TextEncoder()

            const stream = new ReadableStream({
                start(controller) {
                    // Emit all events with delays for smooth animation
                    const emitEvents = async () => {
                        for (const event of events) {
                            const sseData = `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`
                            controller.enqueue(encoder.encode(sseData))
                            // Small delay between events for visual effect
                            await new Promise(resolve => setTimeout(resolve, 100))
                        }

                        // Final done event with siteId
                        const doneData = `event: done\ndata: ${JSON.stringify({
                            siteId: site.id,
                            pageId: homepagePage.id,
                            siteName: result.siteName,
                            siteLanguage: result.language || language,
                            totalBlocks: result.blocks.length,
                            totalPages: createdPages.length,
                            timeMs,
                        })}\n\n`
                        controller.enqueue(encoder.encode(doneData))
                        controller.close()
                    }

                    emitEvents().catch(() => controller.close())
                },
            })

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            })
        }

        // ── JSON Response (backward compatible) ──
        return NextResponse.json({
            success: true,
            siteId: site.id,
            pageId: homepagePage.id,
            siteName: result.siteName,
            siteLanguage: result.language || language,
            siteType: result.siteType,
            blockCount: result.blocks.length,
            totalPages: createdPages.length,
            theme: result.theme,
            timeMs,
        })

    } catch (error: unknown) {
        // Smart status: partial success (≥1 page created) = completed, 0 pages = failed
        if (_site?.id && _payload) {
            const status = _createdPagesCount > 0 ? 'completed' : 'failed'
            await _payload.update({
                collection: 'sites',
                id: _site.id as string | number,
                data: { generationStatus: status },
            }).catch((_e: unknown) => console.error('[AI Generate] Failed to update generation status:', _e))
        }

        const errMsg = error instanceof Error ? error.message : String(error)
        const errStack = error instanceof Error ? error.stack : ''
        console.error('[AI Generate Site Error]', errMsg, errStack)
        return NextResponse.json(
            { error: `Failed to generate website. Please try again. (${errMsg})` },
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

function applyGeneratedSiteNavigation(blocks: AIBlock[], businessName: string): AIBlock[] {
    const normalizedBlocks = cloneBlockData(blocks)
    const pageLinks = [
        { label: 'Home', url: '/' },
        { label: 'About', url: '/about' },
        { label: 'Products', url: '/products' },
        { label: 'Contact', url: '/contact' },
    ]

    return normalizedBlocks.map((block) => {
        if (block.blockType === 'navigation') {
            return {
                ...block,
                logoText: block.logoText || businessName,
                links: pageLinks,
                ctaButton: block.ctaButton
                    ? {
                        ...block.ctaButton,
                        url: normalizeInternalUrl(block.ctaButton.url),
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
                columns: block.columns.map((column: AIBlock | string) => {
                    if (typeof column === 'string') return { title: column, links: [] }

                    return {
                        ...column,
                        links: Array.isArray(column.links)
                            ? column.links.map((link: AIBlock | string) => {
                                if (typeof link === 'string') return { label: link, url: '#' }
                                return {
                                    ...link,
                                    url: normalizeInternalUrl(link.url),
                                }
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
    const validVariants = heroMeta?.variants || ['centered', 'split', 'video', 'minimal']
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
            slug: page.slug || (index === 0 ? '/' : `page-${index}`),
            isHomepage: page.isHomepage === true || index === 0,
            layout: cloneBlockData(page.blocks || []),
            seo: {
                title: String(page.seo?.title || page.title || ''),
                description: String(page.seo?.description || ''),
            },
        }))
    }

    // Fallback: clone-based page generation for single-page AI response
    const navigation = blocks.find((block) => block.blockType === 'navigation') || null
    const hero = blocks.find((block) => block.blockType === 'hero') || null
    const about = blocks.find((block) => block.blockType === 'about') || null
    const features = blocks.find((block) => block.blockType === 'features') || null
    const testimonials = blocks.find((block) => block.blockType === 'testimonials') || null
    const contact = blocks.find((block) => block.blockType === 'contact') || null
    const footer = blocks.find((block) => block.blockType === 'footer') || null

    const compact = (pageBlocks: Array<AIBlock | null>) =>
        pageBlocks.filter(Boolean).map((block) => cloneBlockData(block))

    return [
        {
            title: 'Homepage',
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
            slug: 'about',
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
            slug: 'products',
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
            slug: 'contact',
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
                return {
                    fieldName: String(field.fieldName || field.name || field.id || 'field'),
                    label: String(field.label || field.fieldName || field.name || 'Field'),
                    fieldType: field.fieldType || field.type || 'text',
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

        // ── Team: members[].socials[] requires { platform, url } ──
        if (sanitized.blockType === 'team' && Array.isArray(sanitized.members)) {
            sanitized.members = sanitized.members.map((memberRaw: unknown) => {
                const member = (typeof memberRaw === 'object' && memberRaw !== null) ? memberRaw as Record<string, unknown> : {};
                const safeMember = { ...member }
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

        // ── FAQ: items[] normalization ──
        if (sanitized.blockType === 'faq' && Array.isArray(sanitized.items)) {
            sanitized.items = sanitized.items.map((itemRaw: unknown) => {
                if (typeof itemRaw === 'string') {
                    return { question: itemRaw, answer: '...' }
                }
                const item = (typeof itemRaw === 'object' && itemRaw !== null) ? itemRaw as Record<string, unknown> : {};
                return {
                    question: String(item.question || item.title || item.q || 'Question?'),
                    answer: String(item.answer || item.description || item.a || 'Answer.'),
                }
            })
        }

        // ── Logo Cloud: strip logos (needs real media) ──
        if (sanitized.blockType === 'logo-cloud') {
            sanitized.logos = []
        }

        // ── Remove non-schema fields that AI might add ──
        delete sanitized.id
        delete sanitized.order
        delete sanitized.section

        return sanitized
    })
}
