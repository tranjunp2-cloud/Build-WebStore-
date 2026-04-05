/**
 * ContentBrief — Intermediate representation for AI website generation.
 *
 * All input sources (URL, Image, Video, Text) produce a ContentBrief.
 * The generator uses referenceContent to create high-fidelity output
 * instead of inventing new content.
 */

export type ContentBrief = {
    businessInfo: {
        businessName: string
        industry: string
        shortDescription: string
        products: string
    }

    referenceContent: {
        heroHeadline?: string
        heroSubheadline?: string
        heroCtaText?: string
        aboutText?: string
        featuresList?: { title: string; description: string }[]
        testimonials?: { quote: string; name: string; role?: string }[]
        pricingPlans?: { name: string; price: string; features: string[] }[]
        faqItems?: { question: string; answer: string }[]
        contactInfo?: { phone?: string; email?: string; address?: string }
        footerText?: string
    }

    visualStyle: {
        primaryColor?: string
        secondaryColor?: string
        fontStyle?: 'modern' | 'classic' | 'playful' | 'minimal'
        layoutStyle?: 'centered' | 'split' | 'fullwidth'
        mood?: string
    }

    suggestedBlocks?: string[]

    source: 'url' | 'image' | 'video' | 'text'
    sourceUrl?: string
    language: 'en' | 'ms' | 'vi'
    confidence: 'high' | 'medium' | 'low'
}

/**
 * Convert ContentBrief's referenceContent into a text prompt for GPT-4o.
 * This is appended to the user prompt so the generator uses REAL content.
 */
export function contentBriefToReferencePrompt(brief: ContentBrief): string {
    const sections: string[] = []
    const ref = brief.referenceContent

    if (ref.heroHeadline) {
        sections.push(`HERO SECTION:\n  Headline: "${ref.heroHeadline}"${ref.heroSubheadline ? `\n  Subheadline: "${ref.heroSubheadline}"` : ''}${ref.heroCtaText ? `\n  CTA Button: "${ref.heroCtaText}"` : ''}`)
    }

    if (ref.aboutText) {
        sections.push(`ABOUT SECTION:\n  "${ref.aboutText}"`)
    }

    if (ref.featuresList?.length) {
        const items = ref.featuresList.map(f => `  - ${f.title}: ${f.description}`).join('\n')
        sections.push(`FEATURES/SERVICES (${ref.featuresList.length} items):\n${items}`)
    }

    if (ref.testimonials?.length) {
        const items = ref.testimonials.map(t => `  - "${t.quote}" — ${t.name}${t.role ? `, ${t.role}` : ''}`).join('\n')
        sections.push(`TESTIMONIALS (${ref.testimonials.length}):\n${items}`)
    }

    if (ref.pricingPlans?.length) {
        const items = ref.pricingPlans.map(p => `  - ${p.name}: ${p.price} [${p.features.join(', ')}]`).join('\n')
        sections.push(`PRICING PLANS (${ref.pricingPlans.length}):\n${items}`)
    }

    if (ref.faqItems?.length) {
        const items = ref.faqItems.map(f => `  Q: ${f.question}\n  A: ${f.answer}`).join('\n')
        sections.push(`FAQ (${ref.faqItems.length} items):\n${items}`)
    }

    if (ref.contactInfo) {
        const parts = [
            ref.contactInfo.phone && `Phone: ${ref.contactInfo.phone}`,
            ref.contactInfo.email && `Email: ${ref.contactInfo.email}`,
            ref.contactInfo.address && `Address: ${ref.contactInfo.address}`,
        ].filter(Boolean)
        if (parts.length) sections.push(`CONTACT INFO:\n  ${parts.join('\n  ')}`)
    }

    // Visual style hints
    const styleHints: string[] = []
    if (brief.visualStyle.primaryColor) styleHints.push(`Primary Color: ${brief.visualStyle.primaryColor}`)
    if (brief.visualStyle.secondaryColor) styleHints.push(`Secondary Color: ${brief.visualStyle.secondaryColor}`)
    if (brief.visualStyle.mood) styleHints.push(`Mood: ${brief.visualStyle.mood}`)
    if (brief.visualStyle.fontStyle) styleHints.push(`Font Style: ${brief.visualStyle.fontStyle}`)
    if (styleHints.length) sections.push(`VISUAL STYLE:\n  ${styleHints.join('\n  ')}`)

    if (brief.suggestedBlocks?.length) {
        sections.push(`SUGGESTED BLOCK ORDER: ${brief.suggestedBlocks.join(' → ')}`)
    }

    if (sections.length === 0) return ''

    // Truncate to ~4000 chars to fit within GPT-4o token budget
    let result = `\n## REFERENCE CONTENT (from source website — USE THIS CONTENT, do not invent new)\n\n${sections.join('\n\n')}`
    if (result.length > 4000) {
        result = result.slice(0, 3950) + '\n\n[...truncated for token budget]'
    }

    return result
}

/**
 * Extract backward-compatible BusinessInfo from ContentBrief.
 */
export function contentBriefToBusinessInfo(brief: ContentBrief) {
    return {
        businessName: brief.businessInfo.businessName,
        industry: brief.businessInfo.industry,
        shortDescription: brief.businessInfo.shortDescription,
        products: brief.businessInfo.products,
    }
}
