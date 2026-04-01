/**
 * OpenAI GPT-4o Block Generator
 * Streams AI-generated blocks with SSE events for real-time preview.
 * Falls back to rule-based generator if OpenAI fails.
 */

import OpenAI from 'openai'
import { blockRegistry } from '@/blocks/registry'
import { buildSystemPrompt, type BusinessInfoInput } from './system-prompt'
import { generateBlocks, type GenerationResult, type GeneratedBlock } from './generate-blocks'
import { buildUserPrompt } from './system-prompt'

function getOpenAI(): OpenAI | null {
    const key = process.env.OPENAI_API_KEY
    if (!key) return null
    return new OpenAI({ apiKey: key })
}

export type SSEEvent = {
    event: 'step' | 'theme_set' | 'block_complete' | 'seo_generated' | 'error' | 'done'
    data: Record<string, unknown>
}

/**
 * Generate a complete website using OpenAI GPT-4o with streaming.
 * Falls back to rule-based generation if API key missing or AI fails.
 */
export async function generateSiteWithAI(
    businessInfo: BusinessInfoInput,
    extraInstructions?: string,
    language: 'en' | 'ms' | 'vi' | 'auto' = 'auto',
): Promise<{ result: GenerationResult; events: SSEEvent[] }> {
    const events: SSEEvent[] = []
    const promptText = [
        businessInfo.businessName,
        businessInfo.industry,
        businessInfo.shortDescription,
        businessInfo.products,
    ].join(' | ')

    const openai = getOpenAI()
    if (!openai) {
        console.warn('[AI] No OPENAI_API_KEY — using rule-based fallback')
        return generateWithFallback(promptText, events)
    }

    try {
        events.push({ event: 'step', data: { step: 'analyzing', label: 'Analysing requirements...', progress: 10 } })

        const systemPrompt = buildSystemPrompt(language)
        const userPromptText = buildUserPrompt(businessInfo, extraInstructions, language)

        events.push({ event: 'step', data: { step: 'generating', label: 'AI is generating content...', progress: 20 } })

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPromptText },
            ],
            temperature: 0.7,
            max_tokens: 8000,
            response_format: { type: 'json_object' },
        })

        const content = completion.choices[0]?.message?.content
        if (!content) {
            throw new Error('Empty AI response')
        }

        events.push({ event: 'step', data: { step: 'parsing', label: 'Processing AI results...', progress: 60 } })

        const parsed = JSON.parse(content) as Record<string, unknown>

        // Set theme (validate fonts against Payload CMS allowed values)
        const ALLOWED_HEADING_FONTS = ['Outfit', 'Inter', 'Playfair Display', 'DM Sans', 'Poppins', 'Raleway']
        const ALLOWED_BODY_FONTS = ['Inter', 'DM Sans', 'Lato', 'Open Sans', 'Nunito']

        const parsedTheme = (parsed.theme && typeof parsed.theme === 'object' ? parsed.theme : {}) as Record<string, unknown>
        const rawHeadingFont = String(parsedTheme.fontHeading || 'Outfit')
        const rawBodyFont = String(parsedTheme.fontBody || 'Inter')

        const theme = {
            primaryColor: String(parsedTheme.primaryColor || '#0ea5e9'),
            secondaryColor: String(parsedTheme.secondaryColor || '#d946ef'),
            fontHeading: ALLOWED_HEADING_FONTS.includes(rawHeadingFont) ? rawHeadingFont : 'Outfit',
            fontBody: ALLOWED_BODY_FONTS.includes(rawBodyFont) ? rawBodyFont : 'Inter',
            colorMode: (['light', 'dark'] as const).includes(parsedTheme.colorMode as 'light' | 'dark') ? (parsedTheme.colorMode as 'light' | 'dark') : 'dark',
        }

        events.push({ event: 'theme_set', data: { theme } })

        // Validate and emit each block
        const validBlocks: Record<string, unknown>[] = []
        const rawBlocks = Array.isArray(parsed.blocks) ? parsed.blocks : []

        for (let i = 0; i < rawBlocks.length; i++) {
            const block = rawBlocks[i]
            const progress = 60 + Math.round((i / rawBlocks.length) * 30)

            const blockTypeStr = (typeof block === 'object' && block !== null && 'blockType' in block) ? String((block as Record<string, unknown>).blockType) : 'section'

            events.push({ event: 'step', data: { step: `block_${i}`, label: `Creating ${blockTypeStr}...`, progress } })

            // Sanitize block data FIRST (before validation)
            const sanitized = sanitizeBlockData(block as Record<string, unknown>)

            // Validate with block registry
            if (typeof sanitized.blockType === 'string' && blockRegistry.has(sanitized.blockType)) {
                const validation = blockRegistry.validate(sanitized.blockType, sanitized)
                if (validation.success) {
                    validBlocks.push(validation.data as Record<string, unknown>)
                } else {
                    // Use sanitized block if validation fails (graceful degradation)
                    console.warn(`[AI] Block "${sanitized.blockType}" validation warning:`, validation.error)
                    validBlocks.push(sanitized)
                }
            } else if (sanitized.blockType) {
                // Unknown block type — skip
                console.warn(`[AI] Unknown block type: ${sanitized.blockType}, skipping`)
                continue
            }

            events.push({ event: 'block_complete', data: { block: validBlocks[validBlocks.length - 1], index: validBlocks.length - 1 } })
        }

        // SEO
        const parsedSeo = (parsed.seo && typeof parsed.seo === 'object' ? parsed.seo : {}) as Record<string, unknown>
        const seo = {
            title: String(parsedSeo.title || parsed.siteName || 'Website').substring(0, 60),
            description: String(parsedSeo.description || '').substring(0, 160),
        }

        events.push({ event: 'seo_generated', data: seo })
        events.push({ event: 'step', data: { step: 'saving', label: 'Saving to database...', progress: 95 } })

        const result: GenerationResult = {
            siteName: String(parsed.siteName || 'My Website'),
            siteType: (['business', 'ecommerce', 'restaurant', 'portfolio', 'blog'] as const).includes(parsed.category as 'business' | 'ecommerce' | 'restaurant' | 'portfolio' | 'blog') ? (parsed.category as 'business' | 'ecommerce' | 'restaurant' | 'portfolio' | 'blog') : 'business',
            blocks: validBlocks as GeneratedBlock[],
            seo,
            language: (['en', 'ms', 'vi'] as const).includes(parsed.language as 'en' | 'ms' | 'vi') ? (parsed.language as 'en' | 'ms' | 'vi') : 'en',
            theme,
        }

        events.push({ event: 'done', data: { totalBlocks: validBlocks.length, timeMs: 0 } })

        return { result, events }
    } catch (error: unknown) {
        const errMessage = error instanceof Error ? error.message : String(error)
        console.error('[AI] OpenAI generation failed, falling back:', errMessage)
        events.push({ event: 'error', data: { code: 'ai_fallback', message: 'Using smart templates', retryable: false } })
        return generateWithFallback(promptText, events)
    }
}

function generateWithFallback(prompt: string, events: SSEEvent[]): { result: GenerationResult; events: SSEEvent[] } {
    events.push({ event: 'step', data: { step: 'fallback', label: 'Creating from smart templates...', progress: 50 } })

    const generated = generateBlocks(prompt)
    const result: GenerationResult = {
        ...generated,
        language: 'en' as const
    }

    events.push({ event: 'theme_set', data: { theme: result.theme } })

    result.blocks.forEach((block, i) => {
        events.push({ event: 'block_complete', data: { block: block as Record<string, unknown>, index: i } })
    })

    events.push({ event: 'seo_generated', data: result.seo as Record<string, unknown> })
    events.push({ event: 'done', data: { totalBlocks: result.blocks.length, timeMs: 0 } })

    return { result, events }
}

/**
 * Sanitize a single AI-generated block for Payload CMS compatibility.
 * Removes hallucinated fields, enforces exact variant enums, and recursively normalizes
 * objects into the strictly required keys to prevent validation failures.
 */
function sanitizeBlockData(block: Record<string, unknown>): Record<string, unknown> {
    const s = { ...block }

    // Helper: normalize array where strings should be objects
    const norm = (arr: unknown[], toObj: (v: string) => Record<string, unknown>): unknown[] =>
        arr.map((item: unknown) => typeof item === 'string' ? toObj(item) : item)

    // ═══════════════════════════════════════════════════════════════════════
    // CRITICAL: Strip ALL upload/image fields that are strings
    // Payload CMS expects Media IDs (numbers) or null for 'upload' fields.
    // AI generates URL strings which crash Payload.
    // ═══════════════════════════════════════════════════════════════════════
    const uploadFields = ['image', 'backgroundImage', 'logo', 'avatar', 'ogImage']
    for (const field of uploadFields) {
        if (s[field] && typeof s[field] === 'string') {
            delete s[field] // Remove string URLs — Payload can't use them
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VARIANT VALIDATION: Ensure variant is a valid enum value
    // ═══════════════════════════════════════════════════════════════════════
    const VARIANT_ENUMS: Record<string, string[]> = {
        about: ['simple', 'split', 'story'],
        contact: ['form', 'info-only', 'split'],
        cta: ['banner', 'inline', 'floating'],
        faq: ['accordion', 'grid', 'simple'],
        features: ['grid-2', 'grid-3', 'grid-4', 'list'],
        footer: ['simple', 'expanded', 'minimal'],
        gallery: ['grid', 'masonry', 'carousel'],
        hero: ['centered', 'split', 'video', 'minimal'],
        'logo-cloud': ['row', 'grid'],
        navigation: ['simple', 'centered', 'mega-menu'],
        pricing: ['cards', 'table'],
        stats: ['row', 'grid', 'highlight'],
        team: ['grid', 'list'],
        testimonials: ['cards', 'carousel', 'simple'],
        video: ['embed', 'background']
    }

    if (typeof s.blockType === 'string' && typeof s.variant === 'string' && VARIANT_ENUMS[s.blockType]) {
        if (!VARIANT_ENUMS[s.blockType].includes(s.variant)) {
            s.variant = VARIANT_ENUMS[s.blockType][0] // Default to first option
        }
    }

    // Clean up hallucinated fields that cause validation issues
    if (s.blockType === 'navigation') {
        delete s.style
        delete s.layout
    }

    // Handle 'layout' specifically for 'about' block (sometimes AI hallucinates layout)
    if (s.blockType === 'about' && typeof s.layout === 'string') {
        const ABOUT_LAYOUTS = ['image-right', 'image-left', 'centered']
        if (!ABOUT_LAYOUTS.includes(s.layout)) {
            s.layout = 'image-right'
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NAVIGATION BLOCK
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'navigation') {
        // Rename navLinks → links
        if (s.navLinks && !s.links) {
            s.links = s.navLinks
            delete s.navLinks
        }
        // Normalize links
        if (Array.isArray(s.links)) {
            s.links = s.links.map((link: unknown) => {
                if (typeof link === 'string') return { label: link, url: '#', openInNewTab: false }
                const l = (typeof link === 'object' && link !== null ? link : {}) as Record<string, unknown>
                return {
                    label: String(l.label || l.text || l.title || l.name || 'Link'),
                    url: String(l.url || l.href || l.link || '#'),
                    openInNewTab: typeof l.openInNewTab === 'boolean' ? l.openInNewTab : false
                }
            })
        }
        // Ensure ctaButton has required shape
        if (!s.ctaButton || typeof s.ctaButton !== 'object') {
            s.ctaButton = { show: true, label: 'Get Started', url: '#' }
        } else {
            const btn = s.ctaButton as Record<string, unknown>
            s.ctaButton = {
                show: typeof btn.show === 'boolean' ? btn.show : true,
                label: String(btn.label || btn.text || 'Get Started'),
                url: String(btn.url || btn.href || '#'),
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HERO BLOCK
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'hero') {
        if (Array.isArray(s.ctaButtons)) {
            const primaryBtns = norm(s.ctaButtons, (v) => ({ label: v, url: '#', style: 'primary' }))
            s.ctaButtons = primaryBtns.map((btn: unknown) => {
                const bObj = (typeof btn === 'object' && btn !== null ? btn : {}) as Record<string, unknown>
                const style = String(bObj.style)
                return {
                    label: String(bObj.label || bObj.text || 'Button'),
                    url: String(bObj.url || bObj.href || '#'),
                    style: ['primary', 'secondary', 'outline', 'ghost'].includes(style) ? style : 'primary',
                }
            })
        }
        // Normalize badge
        if (s.badge && typeof s.badge === 'string') {
            s.badge = { show: true, text: s.badge }
        } else if (s.badge && typeof s.badge === 'object') {
            const badgeObj = s.badge as Record<string, unknown>
            s.badge = { show: typeof badgeObj.show === 'boolean' ? badgeObj.show : false, text: String(badgeObj.text || '') }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONTACT BLOCK: formFields
    // ═══════════════════════════════════════════════════════════════════════
    const VALID_FIELD_TYPES = ['text', 'email', 'phone', 'textarea', 'select']
    if (Array.isArray(s.formFields)) {
        s.formFields = s.formFields.map((field: unknown) => {
            if (typeof field === 'string') {
                const name = field.toLowerCase()
                let fieldType = 'text'
                if (name.includes('email')) fieldType = 'email'
                else if (name.includes('phone') || name.includes('tel') || name.includes('telefon')) fieldType = 'phone'
                else if (name.includes('message') || name.includes('content') || name.includes('notes') || name.includes('mesej')) fieldType = 'textarea'
                return { fieldName: field, label: field, fieldType, required: true }
            }
            const fObj = (typeof field === 'object' && field !== null ? field : {}) as Record<string, unknown>
            let ft = String(fObj.fieldType || fObj.type || 'text')
            if (ft === 'tel' || ft === 'telephone') ft = 'phone'
            if (ft === 'number') ft = 'text'
            if (!VALID_FIELD_TYPES.includes(ft)) ft = 'text'

            return {
                fieldName: String(fObj.fieldName || fObj.name || 'field'),
                label: String(fObj.label || fObj.fieldName || fObj.name || 'Field'),
                fieldType: ft,
                required: typeof fObj.required === 'boolean' ? fObj.required : true,
            }
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FOOTER: columns + links + socials
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'footer') {
        if (Array.isArray(s.columns)) {
            s.columns = s.columns.map((col: unknown) => {
                if (typeof col === 'string') return { title: col, links: [] }
                const cObj = (typeof col === 'object' && col !== null ? col : {}) as Record<string, unknown>
                
                let cleanLinks: Record<string, unknown>[] = []
                if (Array.isArray(cObj.links)) {
                    cleanLinks = cObj.links.map((link: unknown) => {
                        if (typeof link === 'string') return { label: link, url: '#' }
                        const l = (typeof link === 'object' && link !== null ? link : {}) as Record<string, unknown>
                        return {
                            label: String(l.label || l.text || l.title || l.name || 'Link'),
                            url: String(l.url || l.href || l.link || '#')
                        }
                    })
                }
                return {
                    title: String(cObj.title || cObj.heading || 'Column'),
                    links: cleanLinks,
                }
            })
        }
        if (Array.isArray(s.socials)) {
            s.socials = s.socials.map((social: unknown) => {
                if (typeof social === 'string') return { platform: social.toLowerCase(), url: '#' }
                const soc = (typeof social === 'object' && social !== null ? social : {}) as Record<string, unknown>
                return {
                    platform: String(soc.platform || soc.name || 'twitter').toLowerCase(),
                    url: String(soc.url || soc.link || '#')
                }
            })
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TESTIMONIALS: normalize testimonials array
    // ═══════════════════════════════════════════════════════════════════════
    if (Array.isArray(s.testimonials)) {
        s.testimonials = s.testimonials.map((t: unknown) => {
            if (typeof t === 'string') return { quote: t, name: 'Customer' }
            const tObj = (typeof t === 'object' && t !== null ? t : {}) as Record<string, unknown>
            const result: Record<string, unknown> = {
                quote: String(tObj.quote || tObj.text || tObj.content || tObj.message || 'Great experience!'),
                name: String(tObj.name || tObj.author || tObj.customerName || 'Customer'),
            }
            if (tObj.title || tObj.role || tObj.position) result.title = String(tObj.title || tObj.role || tObj.position)
            if (tObj.company) result.company = String(tObj.company)
            if (tObj.rating) result.rating = Math.min(5, Math.max(1, Number(tObj.rating) || 5))
            return result
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FEATURES
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'features') {
        if (Array.isArray(s.items) && !Array.isArray(s.features)) {
            s.features = s.items
            delete s.items
        }
        if (Array.isArray(s.features)) {
            s.features = s.features.map((f: unknown) => {
                if (typeof f === 'string') return { title: f, description: '', icon: '⭐' }
                const fObj = (typeof f === 'object' && f !== null ? f : {}) as Record<string, unknown>
                return {
                    icon: String(fObj.icon || fObj.emoji || '⭐'),
                    title: String(fObj.title || fObj.name || fObj.heading || 'Feature'),
                    description: String(fObj.description || fObj.text || fObj.body || ''),
                }
            })
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TEAM
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'team' && Array.isArray(s.members)) {
        s.members = s.members.map((member: unknown) => {
            if (typeof member === 'string') return { name: member, role: 'Member' }
            const mObj = (typeof member === 'object' && member !== null ? member : {}) as Record<string, unknown>
            const safeMember = { ...mObj }
            safeMember.name = String(mObj.name || mObj.fullName || 'Member')
            safeMember.role = String(mObj.role || mObj.position || 'Role')

            if (Array.isArray(safeMember.socials)) {
                safeMember.socials = safeMember.socials.map((social: unknown) => {
                    if (typeof social === 'string') return { platform: social.toLowerCase(), url: '#' }
                    const soc = (typeof social === 'object' && social !== null ? social : {}) as Record<string, unknown>
                    return {
                        platform: String(soc.platform || soc.name || 'twitter').toLowerCase(),
                        url: String(soc.url || soc.link || '#')
                    }
                })
            }
            return safeMember
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FAQ
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'faq' && Array.isArray(s.items)) {
        s.items = s.items.map((item: unknown) => {
            if (typeof item === 'string') {
                return { question: item, answer: '...' }
            }
            const iObj = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
            return {
                question: String(iObj.question || iObj.title || iObj.q || 'Question?'),
                answer: String(iObj.answer || iObj.description || iObj.a || 'Answer.'),
            }
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PRICING
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'pricing' && Array.isArray(s.plans)) {
        s.plans = s.plans.map((plan: unknown) => {
            if (typeof plan === 'string') {
                return { name: plan, price: 'RM 0', features: [], ctaLabel: 'Buy', ctaUrl: '#' }
            }
            const pObj = (typeof plan === 'object' && plan !== null ? plan : {}) as Record<string, unknown>
            const safePlan = { ...pObj }
            safePlan.name = String(pObj.name || pObj.title || 'Plan')
            safePlan.price = String(pObj.price || pObj.cost || '$0')
            safePlan.ctaLabel = String(pObj.ctaLabel || pObj.buttonText || 'Buy Now')
            safePlan.ctaUrl = String(pObj.ctaUrl || pObj.url || '#')
            
            if (Array.isArray(pObj.features)) {
                safePlan.features = pObj.features.map((f: unknown) => {
                    if (typeof f === 'string') return f
                    const fObj = (typeof f === 'object' && f !== null ? f : {}) as Record<string, unknown>
                    return String(fObj.text || fObj.name || fObj.feature || '')
                })
            } else {
                safePlan.features = []
            }
            return safePlan
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GALLERY
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'gallery' && Array.isArray(s.images)) {
        s.images = []
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LOGO CLOUD
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'logo-cloud') {
        s.logos = []
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ABOUT: stats array
    // ═══════════════════════════════════════════════════════════════════════
    if (Array.isArray(s.stats)) {
        s.stats = s.stats.map((stat: unknown) => {
            if (typeof stat === 'string') return { value: stat, label: stat }
            const sObj = (typeof stat === 'object' && stat !== null ? stat : {}) as Record<string, unknown>
            return { value: String(sObj.value || sObj.number || '0'), label: String(sObj.label || sObj.text || 'Stat') }
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Generic links array cleanup
    // ═══════════════════════════════════════════════════════════════════════
    if (Array.isArray(s.links) && s.blockType !== 'navigation') {
        const rawLinks = norm(s.links, (v) => ({ label: v, url: '#' }))
        s.links = rawLinks.map((link: unknown) => {
            if (typeof link === 'string') return { label: link, url: '#' }
            const l = (typeof link === 'object' && link !== null ? link : {}) as Record<string, unknown>
            return {
                label: String(l.label || l.text || l.title || l.name || 'Link'),
                url: String(l.url || l.href || l.link || '#')
            }
        })
    }

    return s
}
