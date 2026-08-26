/**
 * Unsupported-block drop list — shared between AI happy path (openai-generator)
 * and fallback path (fallback-adapter / composer output).
 *
 * Reason these blocks are dropped:
 *   1. MEDIA_PIPELINE: Payload upload fields require Media IDs, but AI + composer
 *      only provide URL strings. Until a download-and-upload pipeline lands, the
 *      blocks render as empty placeholders or trigger 500 on save.
 *   2. NOT_IN_PAYLOAD: blockType not registered in `src/collections/Pages.ts`
 *      `layout.blocks` — Payload silently drops on save. Better to drop early so
 *      SSE event count matches what the user actually sees in the builder.
 *
 * Historical context: commit fc0020d introduced these lists inline in
 * `generateSiteWithAI.validateBlocks()`. Phase-06 (commit 9bf02d4) rewired the
 * fallback path to composer output, which also emits these blocks — so the same
 * filter must apply there. Extracted here to avoid drift.
 */

/** Catch-all drop list for blocks that should not be generated.
 *  Covers: blocks needing a media pipeline, blocks not yet production-ready,
 *  and blocks not fully integrated into the Payload schema.
 *  Re-enabled via plan 260414-1400-ai-gen-unsplash-pipeline phase-04:
 *    - gallery, portfolio-grid → now filled by media-pipeline.ts (Unsplash)
 *  Re-enabled via plan 260422-1900-block-aivisible-audit-fix:
 *    - before-after, booking-widget → added to Payload Pages.ts + pages-schema.ts
 *  Re-enabled via GH-960:
 *    - menu-display → registered in Payload Pages.ts (imageUrl is plain string, no upload pipeline needed)
 *  GH-820: google-maps temporarily disabled — embedUrl cannot be auto-generated
 *  GH-820: class-schedule not production-ready — also hidden from editor UI
 */
export const BLOCKS_REQUIRE_MEDIA_PIPELINE: ReadonlySet<string> = new Set([
    'review-cards',
    'google-maps',
    'class-schedule',
])

/** Blocks missing from Payload Pages.ts layout.blocks — silently dropped on save. */
export const BLOCKS_NOT_IN_PAYLOAD: ReadonlySet<string> = new Set([
    'review-cards',
])

// feat/fix-broken-block-variants: blocks hidden until render/variant issues are resolved.
// Re-enable: remove entry here + from EDITOR_HIDDEN_BLOCKS (block-registry-reader.ts).
// PR #836 accidentally re-enabled doctor-profile, gallery-masonry, before-after — re-hidden 260508.
// GH-1024: property-card, menu-display, pricing-table hidden — use features/gallery, menu-food, pricing respectively.
export const BLOCKS_TEMP_HIDDEN: ReadonlySet<string> = new Set([
    'step-process',
    'booking-widget',
    'doctor-profile',
    'gallery-masonry',
    'before-after',
    'property-card',  // GH-1024
    'menu-display',   // GH-1024
    'pricing-table',  // GH-1024
    // GH-1145: aiVisible:false blocks with active composer cases — hidden from generator
    'countdown-timer',
    'custom-html',
    'download-cta',
    'video-background',
    'breadcrumb',
    'social-proof',
])

export const UNSUPPORTED_BLOCK_REPLACEMENTS: Record<string, string> = {
    'menu-display': 'menu-food',
    'booking-widget': 'contact',
    'pricing-table': 'pricing',
    'google-maps': 'contact',
    'countdown-timer': 'cta',
    'gallery-masonry': 'gallery',
    'before-after': 'gallery',
    'property-card': 'service-cards',
    'class-schedule': 'service-cards',
    'step-process': 'features',
    'doctor-profile': 'team',
    'download-cta': 'cta',
    'social-proof': 'testimonials',
}

/**
 * Returns true if the given blockType should be dropped before reaching Payload.
 * All lists OR'd together — the union is what ends up being rejected.
 */
export function isUnsupportedBlock(blockType: string): boolean {
    return BLOCKS_REQUIRE_MEDIA_PIPELINE.has(blockType) || BLOCKS_NOT_IN_PAYLOAD.has(blockType) || BLOCKS_TEMP_HIDDEN.has(blockType)
}

// Using any here because block represents generic, unstructured input structures 
// that can be any of the 13+ unsupported block types with highly dynamic, varying schemas.
export function convertUnsupportedBlock(block: any): any {
    const blockType = block.blockType
    if (blockType === 'property-card') {
        const services = (block.properties || []).map((prop: any) => ({
            title: prop.title || '',
            description: prop.description || [
                prop.bedrooms ? `${prop.bedrooms} Bed` : '',
                prop.bathrooms ? `${prop.bathrooms} Bath` : '',
                prop.area ? `${prop.area} sqft` : '',
                prop.location ? `Location: ${prop.location}` : '',
            ].filter(Boolean).join(', ') || '',
            icon: '🏠',
            price: prop.price != null ? String(prop.price) : undefined,
            priceUnit: block.currency || 'RM',
        }))
        return {
            blockType: 'service-cards',
            variant: block.variant,
            headline: block.headline || '',
            subheadline: block.subheadline,
            services,
        }
    }
    if (blockType === 'social-proof') {
        const testimonials = (block.reviews || []).map((rev: any) => ({
            quote: rev.content || '',
            name: rev.author || 'Anonymous',
            title: rev.role || '',
            rating: rev.rating ?? 5,
            avatar: rev.avatar,
        }))
        return {
            blockType: 'testimonials',
            variant: block.variant,
            headline: block.headline || '',
            subheadline: block.subheadline,
            testimonials,
        }
    }
    if (blockType === 'before-after') {
        const images = []
        if (block.beforeImage?.url) {
            images.push({
                image: { url: block.beforeImage.url, alt: block.beforeImage.alt || 'Before' },
                caption: block.beforeImage.label || 'Before',
            })
        }
        if (block.afterImage?.url) {
            images.push({
                image: { url: block.afterImage.url, alt: block.afterImage.alt || 'After' },
                caption: block.afterImage.label || 'After',
            })
        }
        return {
            blockType: 'gallery',
            variant: 'grid',
            headline: block.headline || '',
            images,
        }
    }
    if (blockType === 'menu-display') {
        const categories = (block.categories || []).map((cat: any) => ({
            name: cat.name || '',
            items: (cat.items || []).map((item: any) => ({
                name: item.name || '',
                description: item.description || '',
                price: item.price != null ? String(item.price) : '0',
                currency: block.currency || 'RM',
                tag: item.isPopular ? 'Popular' : item.isNew ? 'New' : undefined,
                image: item.imageUrl ? { url: item.imageUrl } : undefined,
            }))
        }))
        return {
            blockType: 'menu-food',
            variant: 'classic',
            headline: block.headline || '',
            categories,
        }
    }
    if (blockType === 'booking-widget') {
        let subtext = block.subheadline || ''
        if (Array.isArray(block.services) && block.services.length > 0) {
            const svcText = block.services.map((s: any) => `${s.name} (${s.duration} mins) - ${s.price ? `${s.price} RM` : ''}`).join('\n')
            subtext = `${subtext}\n\nAvailable Services:\n${svcText}`.trim()
        }
        return {
            blockType: 'contact',
            variant: 'simple',
            headline: block.headline || 'Book an Appointment',
            subtext,
        }
    }
    if (blockType === 'pricing-table') {
        const plans = (block.plans || []).map((plan: any) => ({
            name: plan.name || '',
            price: plan.price || '',
            yearlyPrice: plan.yearlyPrice,
            description: plan.description,
            features: (plan.features || []).map((f: any) => {
                if (typeof f === 'string') return { text: f, included: true }
                return { text: f.text || '', included: f.included ?? true }
            }),
            ctaLabel: plan.cta?.label || 'Get Started',
            ctaUrl: plan.cta?.url || '#',
            highlighted: plan.popular ?? false,
        }))
        return {
            blockType: 'pricing',
            variant: block.variant === 'horizontal' ? 'horizontal' : 'cards',
            headline: block.headline || '',
            subheadline: block.subheadline,
            plans,
        }
    }
    if (blockType === 'google-maps') {
        return {
            blockType: 'contact',
            variant: 'simple',
            headline: block.headline || 'Find Us',
            address: block.address,
            mapEmbedUrl: block.embedUrl,
            showMap: true,
        }
    }
    if (blockType === 'countdown-timer') {
        return {
            blockType: 'cta',
            variant: 'simple',
            headline: block.headline || 'Limited Time Offer!',
            subheadline: block.targetDate ? `Offer ends: ${block.targetDate}` : block.expiredMessage,
            ctaLabel: 'Act Now',
            ctaUrl: '#',
        }
    }
    if (blockType === 'class-schedule') {
        const services = (block.classes || []).map((cls: any) => {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            const dayName = days[cls.day] || ''
            return {
                title: cls.name || '',
                description: [
                    cls.instructor ? `Instructor: ${cls.instructor}` : '',
                    dayName ? `${dayName} at ${cls.startTime || ''}-${cls.endTime || ''}` : '',
                    cls.category ? `Category: ${cls.category}` : '',
                    cls.level ? `Level: ${cls.level}` : '',
                ].filter(Boolean).join(', ') || '',
                icon: '📅',
            }
        })
        return {
            blockType: 'service-cards',
            variant: 'grid',
            headline: block.headline || 'Schedule',
            services,
        }
    }
    if (blockType === 'step-process') {
        const features = (block.steps || []).map((step: any) => ({
            title: step.title || '',
            description: step.description || '',
            icon: step.icon || '✨',
        }))
        return {
            blockType: 'features',
            variant: 'grid-3',
            headline: block.headline || '',
            subheadline: block.subheadline,
            features,
        }
    }
    if (blockType === 'doctor-profile') {
        const members = (block.doctors || []).map((doc: any) => {
            const bioParts = [
                doc.bio || '',
                doc.qualifications && doc.qualifications.length > 0 ? `Qualifications: ${doc.qualifications.join(', ')}` : '',
                doc.languages ? `Languages: ${doc.languages}` : '',
                doc.consultationFee ? `Fee: ${doc.consultationFee}` : '',
            ].filter(Boolean)
            return {
                name: doc.name || '',
                role: doc.specialisation || 'Professional',
                image: doc.photoUrl ? { url: doc.photoUrl } : undefined,
                bio: bioParts.join('\n') || undefined,
            }
        })
        return {
            blockType: 'team',
            variant: 'grid',
            headline: block.headline || '',
            subheadline: block.subheadline,
            members,
        }
    }
    if (blockType === 'download-cta') {
        return {
            blockType: 'cta',
            variant: 'simple',
            headline: block.headline || '',
            subheadline: block.description || (block.fileName ? `File: ${block.fileName} (${block.fileSize || ''})` : undefined),
            ctaLabel: block.buttonLabel || 'Download',
            ctaUrl: block.fileUrl || '#',
        }
    }
    if (blockType === 'gallery-masonry') {
        return {
            ...block,
            blockType: 'gallery',
            variant: 'masonry',
        }
    }
    return block
}

/**
 * Filter an array of blocks, replacing or removing any that match the drop list.
 * Logs a warning for each dropped/replaced block so ops can trace SSE event count drops.
 */
export function filterUnsupportedBlocks<T extends { blockType?: unknown }>(
    blocks: readonly T[],
    context: 'ai' | 'fallback',
): T[] {
    const out: T[] = []
    for (const block of blocks) {
        let blockType = typeof block.blockType === 'string' ? block.blockType : ''
        if (!blockType) continue

        if (UNSUPPORTED_BLOCK_REPLACEMENTS[blockType]) {
            const replacement = UNSUPPORTED_BLOCK_REPLACEMENTS[blockType]!
            console.warn(
                `[${context === 'ai' ? 'AI' : 'Fallback'}] Replacing "${blockType}" with "${replacement}"`,
            )
            const converted = convertUnsupportedBlock(block)
            out.push(converted as unknown as T)
            continue
        }

        if (isUnsupportedBlock(blockType)) {
            console.warn(
                `[${context === 'ai' ? 'AI' : 'Fallback'}] Dropping "${blockType}" — needs media pipeline or not in Payload schema`,
            )
            continue
        }
        out.push(block)
    }
    return out
}
