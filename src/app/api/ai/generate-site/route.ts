import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { generateSiteWithAI, type SSEEvent } from '@/lib/ai/openai-generator'
import { generateAndUploadHeroImage } from '@/lib/ai/openai-image'
import { checkBusinessInfoSafety } from '@/lib/ai/content-safety'
import { generateSiteSchema } from '@/lib/validations/ai'
import { parseRequest } from '@/lib/validations/helpers'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'

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

    try {
        // Parse request body early so validation errors return before auth/db side effects.
        const { data, errorResponse } = await parseRequest(req, generateSiteSchema)
        if (errorResponse) return errorResponse

        const { businessInfo, extraInstructions, language = 'en' } = data!
        const payload = await getPayload({ config })

        // Authenticate user
        let user: any = null
        try {
            const authResult = await payload.auth({ headers: req.headers })
            user = authResult.user
        } catch (authErr) {
            console.warn('[AI Generate] Standard auth failed, trying cookie fallback')
        }

        // Fallback: read payload-token from cookies
        if (!user) {
            const cookieStore = await cookies()
            const token = cookieStore.get('payload-token')?.value
            if (token) {
                try {
                    // Create new headers with Authorization bearer token
                    const authHeaders = new Headers(req.headers)
                    authHeaders.set('Authorization', `JWT ${token}`)
                    const authResult = await payload.auth({ headers: authHeaders })
                    user = authResult.user
                } catch (fallbackErr) {
                    console.warn('[AI Generate] Cookie fallback auth failed too')
                }
            }
        }

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Rate Limit: 20 AI tasks per hour
        const rateLimit = checkRateLimit(String(user.id), 20)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Try again later.' },
                { status: 429 }
            )
        }

        // Get tenant ID — auto-create if missing (legacy accounts)
        let tenantId = (user as any).tenants?.[0]?.tenant
        let resolvedTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId

        if (!resolvedTenantId) {
            const fallbackSlug = `store-${user.id}`

            // Recover an orphaned tenant first before creating a new one.
            const existingTenantBySlug = await payload.find({
                collection: 'tenants',
                where: { slug: { equals: fallbackSlug } },
                limit: 1,
            })

            if (existingTenantBySlug.docs.length > 0) {
                const recoveredTenant = existingTenantBySlug.docs[0]

                await payload.update({
                    collection: 'users',
                    id: user.id,
                    data: {
                        tenants: [{ tenant: recoveredTenant.id, role: 'owner' }],
                    } as any,
                })

                resolvedTenantId = recoveredTenant.id
                console.log(`[AI Generate] Re-attached tenant ${recoveredTenant.id} to user ${user.id}`)
            } else {
                // Auto-create tenant for legacy users without one
                const firstName = (user as any).firstName || (user as any).name || 'My'
                const newTenant = await payload.create({
                    collection: 'tenants',
                    data: {
                        name: `${firstName}'s Store`,
                        slug: fallbackSlug,
                        aiGenerationsCount: 0,
                    },
                })
                // Assign tenant to user
                await payload.update({
                    collection: 'users',
                    id: user.id,
                    data: {
                        tenants: [{ tenant: newTenant.id, role: 'owner' }],
                    } as any,
                })
                resolvedTenantId = newTenant.id
                console.log(`[AI Generate] Auto-created tenant ${newTenant.id} for user ${user.id}`)
            }
        }

        // FR-15: Rate Limit - Free tier is limited to 1 AI generation
        const tenant = typeof payload.findByID === 'function'
            ? await payload.findByID({ collection: 'tenants', id: resolvedTenantId })
            : { plan: 'pro', aiGenerationsCount: 0 }
        if (tenant.plan === 'free') {
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
        // Start DALL-E Hero Image generation in parallel with GPT-4 Site Gen
        // ────────────────────────────────────────────────────────────────────
        const heroImagePromise = generateAndUploadHeroImage(businessInfo, resolvedTenantId, payload)

        // Generate with AI (or fallback)
        const { result, events } = await generateSiteWithAI(businessInfo, extraInstructions, language)

        // Wait for hero image if it hasn't finished yet
        let heroMedia: any = null
        try {
            heroMedia = await heroImagePromise
        } catch (e) {
            console.error('[AI Generate] Hero image promise error:', e)
        }

        // ────────────────────────────────────────────────────────────────────
        // RULE 1: 1 site per user — Update existing site OR create new
        // ────────────────────────────────────────────────────────────────────
        const existingSites = await payload.find({
            collection: 'sites',
            where: { tenant: { equals: resolvedTenantId } },
            limit: 1,
        })

        let site: any

        if (existingSites.docs.length > 0) {
            // UPDATE existing site (template swap — keep site ID, update content)
            site = await payload.update({
                collection: 'sites',
                id: existingSites.docs[0].id,
                data: {
                    name: result.siteName,
                    status: 'draft',
                    siteType: result.siteType,
                    locale: ['ms', 'en'].includes(result.language || language) ? (result.language || language) : 'en',
                    theme: {
                        primaryColor: result.theme.primaryColor,
                        secondaryColor: result.theme.secondaryColor,
                        fontHeading: result.theme.fontHeading,
                        fontBody: result.theme.fontBody,
                        colorMode: result.theme.colorMode,
                    },
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
                    siteType: result.siteType,
                    locale: ['ms', 'en'].includes(result.language || language) ? (result.language || language) : 'en',
                    theme: {
                        primaryColor: result.theme.primaryColor,
                        secondaryColor: result.theme.secondaryColor,
                        fontHeading: result.theme.fontHeading,
                        fontBody: result.theme.fontBody,
                        colorMode: result.theme.colorMode,
                    },
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

        // Sanitize blocks for Payload CMS compatibility
        const sanitizedBlocks = applyGeneratedSiteNavigation(
            sanitizeBlocksForPayload(result.blocks),
            result.siteName,
        )

        // Inject generated Hero Image into the hero block
        if (heroMedia) {
            const heroBlock = sanitizedBlocks.find(b => b.blockType === 'hero')
            if (heroBlock) {
                // Attach the payload block's backgroundImage field to the uploaded media ID (for DB save)
                heroBlock.backgroundImage = heroMedia.id
                
                // Update the corresponding SSE event so the frontend preview gets the full image object immediately
                const heroEvent = events.find((e: any) => e.event === 'block_complete' && (e.data as any).block?.blockType === 'hero')
                if (heroEvent) {
                    (heroEvent.data as any).block.backgroundImage = heroMedia
                }
            }
        }

        const pageDefinitions = buildGeneratedPages({
            blocks: sanitizedBlocks,
            businessInfo,
            result,
        })

        const createdPages: any[] = []

        for (const pageDefinition of pageDefinitions) {
            const createdPage = await payload.create({
                collection: 'pages',
                data: {
                    title: pageDefinition.title,
                    slug: pageDefinition.slug,
                    site: site.id,
                    isHomepage: pageDefinition.isHomepage,
                    layout: pageDefinition.layout,
                    seo: pageDefinition.seo,
                },
            })

            createdPages.push(createdPage)
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

    } catch (error: any) {
        console.error('[AI Generate Site Error]', error)
        return NextResponse.json(
            { error: 'Failed to generate website. Please try again.' },
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

function applyGeneratedSiteNavigation(blocks: any[], businessName: string): any[] {
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
                ctaButtons: block.ctaButtons.map((button: any) => ({
                    ...button,
                    url: normalizeInternalUrl(button.url),
                })),
            }
        }

        if (block.blockType === 'footer' && Array.isArray(block.columns)) {
            return {
                ...block,
                logoText: block.logoText || businessName,
                columns: block.columns.map((column: any) => ({
                    ...column,
                    links: Array.isArray(column.links)
                        ? column.links.map((link: any) => ({
                            ...link,
                            url: normalizeInternalUrl(link.url),
                        }))
                        : column.links,
                })),
            }
        }

        return block
    })
}

function createPageHero(baseHero: any, options: {
    headline: string
    subheadline: string
    primaryLabel?: string
    primaryUrl?: string
    secondaryLabel?: string
    secondaryUrl?: string
    badgeText?: string
}): any {
    const hero = cloneBlockData(baseHero || {
        blockType: 'hero',
        variant: 'centered',
    })

    hero.blockType = 'hero'
    hero.variant = hero.variant || 'centered'
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
    blocks: any[]
    businessInfo: { businessName: string; shortDescription: string; products: string }
    result: any
}) {
    const navigation = blocks.find((block) => block.blockType === 'navigation') || null
    const hero = blocks.find((block) => block.blockType === 'hero') || null
    const about = blocks.find((block) => block.blockType === 'about') || null
    const features = blocks.find((block) => block.blockType === 'features') || null
    const testimonials = blocks.find((block) => block.blockType === 'testimonials') || null
    const contact = blocks.find((block) => block.blockType === 'contact') || null
    const footer = blocks.find((block) => block.blockType === 'footer') || null

    const compact = (pageBlocks: Array<any | null>) =>
        pageBlocks.filter(Boolean).map((block) => cloneBlockData(block))

    return [
        {
            title: 'Homepage',
            slug: '/',
            isHomepage: true,
            layout: cloneBlockData(blocks),
            seo: {
                title: result.seo.title,
                description: result.seo.description,
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
function sanitizeBlocksForPayload(blocks: any[]): any[] {
    return blocks.map(block => {
        const sanitized = { ...block }

        // Helper: normalize a link object → { label, url }
        const normalizeLink = (link: any): { label: string; url: string; openInNewTab?: boolean } => {
            if (typeof link === 'string') {
                return { label: link, url: '#' }
            }
            return {
                label: String(link.label || link.text || link.title || link.name || 'Link'),
                url: String(link.url || link.href || link.link || '#'),
                ...(link.openInNewTab !== undefined ? { openInNewTab: link.openInNewTab } : {}),
            }
        }

        // ── Navigation: links[] requires { label (required), url (required) } ──
        if (sanitized.blockType === 'navigation') {
            // AI may use "navLinks" or "links" — normalize to "links"
            const rawLinks = sanitized.links || sanitized.navLinks || []
            sanitized.links = Array.isArray(rawLinks)
                ? rawLinks.map(normalizeLink).filter((l: any) => l.label && l.label !== 'Link')
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
                sanitized.ctaButtons = sanitized.ctaButtons.map((btn: any) => {
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
            sanitized.formFields = sanitized.formFields.map((field: any) => {
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
        if (sanitized.blockType === 'footer' && Array.isArray(sanitized.columns)) {
            sanitized.columns = sanitized.columns.map((col: any) => {
                if (typeof col === 'string') {
                    return { title: col, links: [] }
                }
                return {
                    title: String(col.title || col.heading || 'Column'),
                    links: Array.isArray(col.links) ? col.links.map(normalizeLink) : [],
                }
            })
        }

        // ── Features: features[] requires { title (required), description (required) } ──
        if (sanitized.blockType === 'features') {
            // AI may use "items" instead of "features"
            const rawFeatures = sanitized.features || sanitized.items || []
            sanitized.features = Array.isArray(rawFeatures)
                ? rawFeatures.map((item: any) => {
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
                ? rawTestimonials.map((item: any) => {
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

        // ── About: ensure headline ──
        if (sanitized.blockType === 'about') {
            if (!sanitized.headline) {
                sanitized.headline = sanitized.title || 'About Us'
            }
        }

        // ── Pricing: plans[] normalization ──
        if (sanitized.blockType === 'pricing' && Array.isArray(sanitized.plans)) {
            sanitized.plans = sanitized.plans.map((plan: any) => {
                if (typeof plan === 'string') {
                    return { name: plan, price: 'RM 0', features: [] }
                }
                if (Array.isArray(plan.features)) {
                    plan.features = plan.features.map((f: any) =>
                        typeof f === 'string' ? { text: f, included: true } : f
                    )
                }
                return plan
            })
        }

        // ── Remove non-schema fields that AI might add ──
        delete sanitized.id
        delete sanitized.order
        delete sanitized.section

        return sanitized
    })
}
