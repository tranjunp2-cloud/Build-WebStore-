import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'
import { generateSiteWithAI, type SSEEvent } from '@/lib/ai/openai-generator'
import { z } from 'zod'

const generateSiteSchema = z.object({
    businessInfo: z.object({
        businessName: z.string().min(1),
        industry: z.string().min(1),
        products: z.string().min(1),
    }),
    extraInstructions: z.string().optional(),
    language: z.enum(['vi', 'en']).optional(),
})

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

        // Build headers with JWT token for payload.auth()
        // Next.js App Router may not forward cookies in req.headers properly
        const authHeaders = new Headers(req.headers)
        authHeaders.set('Authorization', `JWT ${token}`)

        const { user } = await payload.auth({ headers: authHeaders })
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get tenant ID — auto-create if missing (legacy accounts)
        let tenantId = (user as any).tenants?.[0]?.tenant
        let resolvedTenantId = typeof tenantId === 'object' ? tenantId.id : tenantId

        if (!resolvedTenantId) {
            // Auto-create tenant for legacy users without one
            const firstName = (user as any).firstName || (user as any).name || 'My'
            const newTenant = await payload.create({
                collection: 'tenants',
                data: {
                    name: `${firstName}'s Store`,
                    slug: `store-${user.id}`,
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

        // Parse request body — structured business info
        const body = await req.json()
        const parsed = generateSiteSchema.safeParse(body)
        
        if (!parsed.success) {
            return NextResponse.json(
                { error: parsed.error.flatten() },
                { status: 400 }
            )
        }
        
        const { businessInfo, extraInstructions, language = 'vi' } = parsed.data

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
