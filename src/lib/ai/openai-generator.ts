/**
 * OpenAI GPT-4o Block Generator
 * Streams AI-generated blocks with SSE events for real-time preview.
 * Falls back to rule-based generator if OpenAI fails.
 */

import OpenAI from 'openai'
import { blockRegistry } from '@/blocks/registry'
import { buildSystemPrompt, buildUserPrompt, type BusinessInfoInput } from './system-prompt'
import { generateBlocks, type GenerationResult } from './generate-blocks'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

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
    language: 'vi' | 'en' = 'vi',
): Promise<{ result: GenerationResult; events: SSEEvent[] }> {
    const events: SSEEvent[] = []
    const promptText = `${businessInfo.businessName} - ${businessInfo.industry}`

    // Fallback if no API key
    if (!process.env.OPENAI_API_KEY) {
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

        const parsed = JSON.parse(content)

        // Set theme (validate fonts against Payload CMS allowed values)
        const ALLOWED_HEADING_FONTS = ['Outfit', 'Inter', 'Playfair Display', 'DM Sans', 'Poppins', 'Raleway']
        const ALLOWED_BODY_FONTS = ['Inter', 'DM Sans', 'Lato', 'Open Sans', 'Nunito']

        const rawHeadingFont = parsed.theme?.fontHeading || 'Outfit'
        const rawBodyFont = parsed.theme?.fontBody || 'Inter'

        const theme = {
            primaryColor: parsed.theme?.primaryColor || '#0ea5e9',
            secondaryColor: parsed.theme?.secondaryColor || '#d946ef',
            fontHeading: ALLOWED_HEADING_FONTS.includes(rawHeadingFont) ? rawHeadingFont : 'Outfit',
            fontBody: ALLOWED_BODY_FONTS.includes(rawBodyFont) ? rawBodyFont : 'Inter',
            colorMode: (['light', 'dark'] as const).includes(parsed.theme?.colorMode) ? parsed.theme.colorMode : 'dark',
        }

        events.push({ event: 'theme_set', data: { theme } })

        // Validate and emit each block
        const validBlocks: any[] = []
        const rawBlocks = parsed.blocks || []

        for (let i = 0; i < rawBlocks.length; i++) {
            const block = rawBlocks[i]
            const progress = 60 + Math.round((i / rawBlocks.length) * 30)

            events.push({ event: 'step', data: { step: `block_${i}`, label: `Creating ${block.blockType || 'section'}...`, progress } })

            // Sanitize block data FIRST (before validation)
            const sanitized = sanitizeBlockData(block)

            // Validate with block registry
            if (sanitized.blockType && blockRegistry.has(sanitized.blockType)) {
                const validation = blockRegistry.validate(sanitized.blockType, sanitized)
                if (validation.success) {
                    validBlocks.push(validation.data)
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
        const seo = {
            title: (parsed.seo?.title || parsed.siteName || 'Website').substring(0, 60),
            description: (parsed.seo?.description || '').substring(0, 160),
        }

        events.push({ event: 'seo_generated', data: seo })
        events.push({ event: 'step', data: { step: 'saving', label: 'Saving to database...', progress: 95 } })

        const result: GenerationResult = {
            siteName: parsed.siteName || 'My Website',
            siteType: parsed.category || 'business',
            blocks: validBlocks,
            seo,
            theme,
        }

        events.push({ event: 'done', data: { totalBlocks: validBlocks.length, timeMs: 0 } })

        return { result, events }
    } catch (error: any) {
        console.error('[AI] OpenAI generation failed, falling back:', error.message)
        events.push({ event: 'error', data: { code: 'ai_fallback', message: 'Using smart templates', retryable: false } })
        return generateWithFallback(promptText, events)
    }
}

function generateWithFallback(prompt: string, events: SSEEvent[]): { result: GenerationResult; events: SSEEvent[] } {
    events.push({ event: 'step', data: { step: 'fallback', label: 'Creating from smart templates...', progress: 50 } })

    const result = generateBlocks(prompt)

    events.push({ event: 'theme_set', data: { theme: result.theme } })

    result.blocks.forEach((block, i) => {
        events.push({ event: 'block_complete', data: { block, index: i } })
    })

    events.push({ event: 'seo_generated', data: result.seo })
    events.push({ event: 'done', data: { totalBlocks: result.blocks.length, timeMs: 0 } })

    return { result, events }
}

/**
 * Sanitize a single AI-generated block for Payload CMS compatibility.
 */
function sanitizeBlockData(block: any): any {
    const s = { ...block }

    // Helper: normalize array where strings should be objects
    const norm = (arr: any[], toObj: (v: string) => any): any[] =>
        arr.map((item: any) => typeof item === 'string' ? toObj(item) : item)

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
        hero: ['centered', 'split-left', 'split-right', 'fullscreen', 'video'],
        navigation: ['fixed', 'sticky', 'static', 'transparent'],
        about: ['image-right', 'image-left', 'centered', 'cards'],
        features: ['grid-3', 'grid-2', 'alternating', 'centered-list'],
        testimonials: ['carousel', 'grid', 'masonry', 'single'],
        gallery: ['masonry', 'grid', 'carousel', 'lightbox'],
    }

    if (s.variant && VARIANT_ENUMS[s.blockType]) {
        if (!VARIANT_ENUMS[s.blockType].includes(s.variant)) {
            s.variant = VARIANT_ENUMS[s.blockType][0] // Default to first option
        }
    }

    // Also handle 'style' field for navigation
    if (s.style && s.blockType === 'navigation') {
        if (!VARIANT_ENUMS.navigation.includes(s.style)) {
            s.style = 'fixed'
        }
    }

    // Also handle 'layout' field for features/about/gallery
    if (s.layout && typeof s.layout === 'string' && VARIANT_ENUMS[s.blockType]) {
        if (!VARIANT_ENUMS[s.blockType].includes(s.layout)) {
            s.layout = VARIANT_ENUMS[s.blockType][0]
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
            s.links = norm(s.links, (v) => ({ label: v, url: '#', openInNewTab: false }))
        }
        // Ensure ctaButton has required shape
        if (!s.ctaButton || typeof s.ctaButton !== 'object') {
            s.ctaButton = { show: true, label: 'Get Started', url: '#' }
        } else {
            s.ctaButton = {
                show: s.ctaButton.show ?? true,
                label: s.ctaButton.label || s.ctaButton.text || 'Get Started',
                url: s.ctaButton.url || '#',
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HERO BLOCK
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'hero') {
        if (Array.isArray(s.ctaButtons)) {
            s.ctaButtons = norm(s.ctaButtons, (v) => ({ label: v, url: '#', style: 'primary' }))
            // Ensure each button has valid style
            s.ctaButtons = s.ctaButtons.map((btn: any) => ({
                label: btn.label || btn.text || 'Button',
                url: btn.url || btn.href || '#',
                style: ['primary', 'secondary', 'outline', 'ghost'].includes(btn.style) ? btn.style : 'primary',
            }))
        }
        // Normalize badge
        if (s.badge && typeof s.badge === 'string') {
            s.badge = { show: true, text: s.badge }
        } else if (s.badge && typeof s.badge === 'object') {
            s.badge = { show: s.badge.show ?? false, text: s.badge.text || '' }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONTACT BLOCK: formFields
    // Payload allows fieldType: text | email | phone | textarea | select
    // ═══════════════════════════════════════════════════════════════════════
    const VALID_FIELD_TYPES = ['text', 'email', 'phone', 'textarea', 'select']
    if (Array.isArray(s.formFields)) {
        s.formFields = s.formFields.map((field: any) => {
            if (typeof field === 'string') {
                const name = field.toLowerCase()
                let fieldType = 'text'
                if (name.includes('email')) fieldType = 'email'
                else if (name.includes('phone') || name.includes('tel') || name.includes('telefon')) fieldType = 'phone'
                else if (name.includes('message') || name.includes('content') || name.includes('notes') || name.includes('mesej')) fieldType = 'textarea'
                return { fieldName: field, label: field, fieldType, required: true }
            }
            // Normalize fieldType — map common aliases
            let ft = field.fieldType || field.type || 'text'
            if (ft === 'tel' || ft === 'telephone') ft = 'phone'
            if (ft === 'number') ft = 'text'
            if (!VALID_FIELD_TYPES.includes(ft)) ft = 'text'

            return {
                fieldName: field.fieldName || field.name || 'field',
                label: field.label || field.fieldName || field.name || 'Field',
                fieldType: ft,
                required: field.required ?? true,
            }
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FOOTER: columns + links
    // ═══════════════════════════════════════════════════════════════════════
    if (Array.isArray(s.columns)) {
        s.columns = s.columns.map((col: any) => {
            if (typeof col === 'string') return { title: col, links: [] }
            return {
                title: col.title || col.heading || 'Column',
                links: Array.isArray(col.links)
                    ? norm(col.links, (v) => ({ label: v, url: '#' }))
                    : [],
            }
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TESTIMONIALS: normalize testimonials array
    // Payload schema: testimonials[].quote (required), .name (required), .title, .company
    // ═══════════════════════════════════════════════════════════════════════
    if (Array.isArray(s.testimonials)) {
        s.testimonials = s.testimonials.map((t: any) => {
            if (typeof t === 'string') {
                return { quote: t, name: 'Customer' }
            }
            const result: any = {
                quote: t.quote || t.text || t.content || t.message || 'Great experience!',
                name: t.name || t.author || t.customerName || 'Customer',
            }
            if (t.title || t.role || t.position) result.title = t.title || t.role || t.position
            if (t.company) result.company = t.company
            if (t.rating) result.rating = Math.min(5, Math.max(1, Number(t.rating) || 5))
            // Strip avatar if string (upload field)
            return result
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // FEATURES: features array (not items)
    // Payload schema: features[].icon, .title (required), .description (required)
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'features') {
        // AI might use 'items' instead of 'features'
        if (Array.isArray(s.items) && !Array.isArray(s.features)) {
            s.features = s.items
            delete s.items
        }
        if (Array.isArray(s.features)) {
            s.features = s.features.map((f: any) => {
                if (typeof f === 'string') return { title: f, description: '', icon: '⭐' }
                return {
                    icon: f.icon || f.emoji || '⭐',
                    title: f.title || f.name || f.heading || 'Feature',
                    description: f.description || f.text || f.body || '',
                }
            })
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GALLERY: images array
    // Payload schema: images[].image (upload, required), .caption
    // Since AI can't provide upload IDs, skip gallery images (leave empty)
    // ═══════════════════════════════════════════════════════════════════════
    if (s.blockType === 'gallery' && Array.isArray(s.images)) {
        // Can't save images without actual Media uploads — clear the array
        // but keep captions for later population
        s.images = []
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ABOUT: stats array
    // ═══════════════════════════════════════════════════════════════════════
    if (Array.isArray(s.stats)) {
        s.stats = s.stats.map((stat: any) => {
            if (typeof stat === 'string') return { value: stat, label: stat }
            return { value: stat.value || stat.number || '0', label: stat.label || stat.text || 'Stat' }
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Generic links array cleanup
    // ═══════════════════════════════════════════════════════════════════════
    if (Array.isArray(s.links) && s.blockType !== 'navigation') {
        s.links = norm(s.links, (v) => ({ label: v, url: '#' }))
    }

    return s
}


