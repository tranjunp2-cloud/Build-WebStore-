import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { generateSiteWithAI, type SSEEvent } from '@/lib/ai/openai-generator'

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
        const payload = await getPayload({ config })

        // Authenticate user
        const cookieStore = await cookies()
        const token = cookieStore.get('payload-token')?.value
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { user } = await payload.auth({ headers: req.headers })
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get tenant ID
        const tenantId = (user as any).tenants?.[0]?.tenant
        const resolvedTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId
        if (!resolvedTenantId) {
            return NextResponse.json({ error: 'No tenant found' }, { status: 400 })
        }

        // Parse request body — structured business info
        const { businessInfo, extraInstructions, language = 'vi' } = await req.json()

        // Validate required business info
        if (!businessInfo || !businessInfo.businessName || !businessInfo.industry || !businessInfo.products) {
            return NextResponse.json(
                { error: 'Missing required fields: businessName, industry, products' },
                { status: 400 },
            )
        }

        // Check SSE mode
        const isStreaming = req.nextUrl.searchParams.get('stream') === 'true'

        // Generate with AI (or fallback)
        const { result, events } = await generateSiteWithAI(businessInfo, extraInstructions, language)

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
                        originalPrompt: `${businessInfo.businessName} | ${businessInfo.industry} | ${businessInfo.products}`,
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
                        originalPrompt: `${businessInfo.businessName} | ${businessInfo.industry} | ${businessInfo.products}`,
                        businessType: result.siteType,
                    },
                },
            })
        }

        // Sanitize blocks for Payload CMS compatibility
        const sanitizedBlocks = sanitizeBlocksForPayload(result.blocks)

        // Create Homepage with generated blocks
        const page = await payload.create({
            collection: 'pages',
            data: {
                title: 'Homepage',
                slug: '/',
                site: site.id,
                isHomepage: true,
                layout: sanitizedBlocks,
                seo: {
                    title: result.seo.title,
                    description: result.seo.description,
                },
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
                            pageId: page.id,
                            siteName: result.siteName,
                            totalBlocks: result.blocks.length,
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
            pageId: page.id,
            siteName: result.siteName,
            siteType: result.siteType,
            blockCount: result.blocks.length,
            theme: result.theme,
            timeMs,
        })

    } catch (error: any) {
        console.error('[AI Generate Site Error]', error)
        return NextResponse.json(
            { error: error?.message || 'Internal server error' },
            { status: 500 },
        )
    }
}

/**
 * Sanitize AI-generated blocks for Payload CMS compatibility.
 * AI models often return data in slightly wrong formats:
 * - formFields as strings instead of objects
 * - footer columns without proper link structure
 * - Extra/missing fields
 */
function sanitizeBlocksForPayload(blocks: any[]): any[] {
    return blocks.map(block => {
        const sanitized = { ...block }

        // ── Contact/Form blocks: normalize formFields ──
        if (sanitized.formFields && Array.isArray(sanitized.formFields)) {
            sanitized.formFields = sanitized.formFields.map((field: any) => {
                if (typeof field === 'string') {
                    // Convert string → object: "Tên" → { fieldName: "Tên", fieldType: "text" }
                    const name = field.toLowerCase()
                    let fieldType = 'text'
                    if (name.includes('email')) fieldType = 'email'
                    else if (name.includes('phone') || name.includes('điện thoại') || name.includes('sdt')) fieldType = 'tel'
                    else if (name.includes('message') || name.includes('tin nhắn') || name.includes('nội dung') || name.includes('ghi chú')) fieldType = 'textarea'
                    return { fieldName: field, fieldType, required: true }
                }
                // Already an object — ensure required fields exist
                return {
                    fieldName: field.fieldName || field.name || field.label || 'Field',
                    fieldType: field.fieldType || field.type || 'text',
                    required: field.required !== undefined ? field.required : true,
                    ...field,
                }
            })
        }

        // ── Footer: normalize columns with links ──
        if (sanitized.blockType === 'footer' && Array.isArray(sanitized.columns)) {
            sanitized.columns = sanitized.columns.map((col: any) => {
                if (typeof col === 'string') {
                    return { title: col, links: [] }
                }
                const normalizedCol = {
                    title: col.title || col.heading || 'Column',
                    links: Array.isArray(col.links) ? col.links.map((link: any) => {
                        if (typeof link === 'string') {
                            return { label: link, url: '#' }
                        }
                        return {
                            label: link.label || link.text || link.title || 'Link',
                            url: link.url || link.href || '#',
                            ...link,
                        }
                    }) : [],
                }
                return normalizedCol
            })
        }

        // ── Navigation: normalize navLinks ──
        if (sanitized.blockType === 'navigation' && Array.isArray(sanitized.navLinks)) {
            sanitized.navLinks = sanitized.navLinks.map((link: any) => {
                if (typeof link === 'string') {
                    return { label: link, url: '#' }
                }
                return {
                    label: link.label || link.text || 'Link',
                    url: link.url || link.href || '#',
                    ...link,
                }
            })
        }

        // ── Pricing: normalize plans/tiers ──
        if (sanitized.blockType === 'pricing' && Array.isArray(sanitized.plans)) {
            sanitized.plans = sanitized.plans.map((plan: any) => {
                if (typeof plan === 'string') {
                    return { name: plan, price: '$0', features: [] }
                }
                if (Array.isArray(plan.features)) {
                    plan.features = plan.features.map((f: any) =>
                        typeof f === 'string' ? { text: f, included: true } : f
                    )
                }
                return plan
            })
        }

        // ── Features: normalize items ──
        if (sanitized.blockType === 'features' && Array.isArray(sanitized.items)) {
            sanitized.items = sanitized.items.map((item: any) => {
                if (typeof item === 'string') {
                    return { title: item, description: '' }
                }
                return item
            })
        }

        // ── Testimonials: normalize items ──
        if (sanitized.blockType === 'testimonials' && Array.isArray(sanitized.items)) {
            sanitized.items = sanitized.items.map((item: any) => {
                if (typeof item === 'string') {
                    return { quote: item, author: 'Anonymous' }
                }
                return item
            })
        }

        return sanitized
    })
}
