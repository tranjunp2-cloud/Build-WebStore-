import type { BlockData, ThemeData } from '@/types/editor'

export type SupportedAddSectionType =
    | 'testimonials'
    | 'faq'
    | 'gallery'
    | 'features'
    | 'team'
    | 'newsletter'
    | 'banner'
    | 'cta'

type AddSectionContext = {
    instruction: string
    siteName?: string
    theme?: ThemeData
    requestedType?: string
}

const SECTION_TYPE_MATCHERS: Array<[SupportedAddSectionType, RegExp[]]> = [
    ['testimonials', [/\btestimonial(s)?\b/i, /\breview(s)?\b/i, /\bcustomer review(s)?\b/i]],
    ['faq', [/\bfaq\b/i, /\bquestion(s)?\b/i, /\bq&a\b/i]],
    ['gallery', [/\bgallery\b/i, /\bphoto(s)?\b/i, /\bimage(s)?\b/i]],
    ['features', [/\bfeature(s)?\b/i, /\bservice(s)?\b/i, /\bbenefit(s)?\b/i]],
    ['team', [/\bteam\b/i, /\bstaff\b/i, /\bmember(s)?\b/i]],
    ['newsletter', [/\bnewsletter\b/i, /\bsubscribe\b/i, /\bemail capture\b/i]],
    ['banner', [/\bbanner\b/i, /\bpromo\b/i, /\bpromotion\b/i]],
    ['cta', [/\bcta\b/i, /\bcall to action\b/i]],
]

const ADD_SECTION_INTENT_MATCHERS = [/\badd\b/i, /\binsert\b/i, /\bappend\b/i, /\bcreate\b/i]
const SECTION_TYPE_LABELS: Record<SupportedAddSectionType, string> = {
    testimonials: 'testimonials',
    faq: 'FAQ',
    gallery: 'gallery',
    features: 'features',
    team: 'team',
    newsletter: 'newsletter',
    banner: 'banner',
    cta: 'CTA',
}

function getPlaceholderImage(index: number) {
    return {
        image: null,
        caption: `Highlight ${index + 1}`,
    }
}

function getRequestedCount(instruction: string, fallback: number) {
    const countMatch = instruction.match(/\b(\d+)\b/)
    if (!countMatch) return fallback

    const parsed = Number(countMatch[1])
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback
    return Math.min(parsed, 8)
}

export function inferAddSectionType(instruction: string, requestedType?: string): SupportedAddSectionType | null {
    const haystack = `${requestedType || ''} ${instruction}`.trim()

    for (const [sectionType, matchers] of SECTION_TYPE_MATCHERS) {
        if (matchers.some(matcher => matcher.test(haystack))) {
            return sectionType
        }
    }

    return null
}

export function getAddSectionLabel(sectionType: SupportedAddSectionType | null) {
    if (!sectionType) return 'section'
    return SECTION_TYPE_LABELS[sectionType]
}

export function isAddSectionInstruction(instruction: string) {
    return ADD_SECTION_INTENT_MATCHERS.some(matcher => matcher.test(instruction))
}

export function createAddSectionBlock({
    instruction,
    siteName,
    requestedType,
}: AddSectionContext): BlockData | null {
    const sectionType = inferAddSectionType(instruction, requestedType)
    const brandName = siteName?.trim() || 'Your Brand'

    switch (sectionType) {
        case 'testimonials': {
            const reviewCount = getRequestedCount(instruction, 3)
            return {
                blockType: 'testimonials',
                variant: 'grid',
                headline: `What customers say about ${brandName}`,
                testimonials: Array.from({ length: reviewCount }, (_, index) => ({
                    quote: `Placeholder review ${index + 1} for ${brandName}. Replace this with a real customer story.`,
                    name: `Customer ${index + 1}`,
                    title: 'Happy Customer',
                    company: brandName,
                    rating: 5,
                })),
            }
        }

        case 'faq':
            return {
                blockType: 'faq',
                headline: `Frequently asked questions about ${brandName}`,
                faqs: [
                    {
                        question: `What makes ${brandName} different?`,
                        answer: `${brandName} focuses on clear value, polished delivery, and a better customer experience from the first interaction.`,
                    },
                    {
                        question: 'How quickly can I get started?',
                        answer: 'Most customers can get started right away after a quick consultation or onboarding step.',
                    },
                    {
                        question: 'Do you offer support after purchase?',
                        answer: 'Yes. We continue to support customers with guidance, updates, and responsive communication.',
                    },
                ],
            }

        case 'gallery':
            return {
                blockType: 'gallery',
                layout: 'grid',
                headline: `${brandName} in action`,
                images: Array.from({ length: getRequestedCount(instruction, 6) }, (_, index) =>
                    getPlaceholderImage(index),
                ),
            }

        case 'features':
            return {
                blockType: 'features',
                layout: 'grid-3',
                sectionLabel: 'Why Choose Us',
                headline: `Why customers choose ${brandName}`,
                subheadline: 'Three strong reasons to trust this offer.',
                features: [
                    {
                        icon: '⚡',
                        title: 'Fast to understand',
                        description: 'Explain the offer clearly so visitors know the value right away.',
                    },
                    {
                        icon: '🛡️',
                        title: 'Built on trust',
                        description: 'Reassure visitors with consistency, proof, and confident positioning.',
                    },
                    {
                        icon: '🎯',
                        title: 'Made to convert',
                        description: 'Guide visitors toward the next step with simple, focused messaging.',
                    },
                ],
            }

        case 'team':
            return {
                blockType: 'team',
                headline: `Meet the team behind ${brandName}`,
                members: [
                    { name: 'Team Member 1', role: 'Founder', bio: 'Add a short founder introduction here.' },
                    { name: 'Team Member 2', role: 'Operations Lead', bio: 'Highlight day-to-day operational excellence.' },
                    { name: 'Team Member 3', role: 'Customer Success', bio: 'Show the human side of your brand experience.' },
                ],
            }

        case 'newsletter':
        case 'banner':
        case 'cta':
            return {
                blockType: 'hero',
                variant: 'centered',
                headline: `Ready to take the next step with ${brandName}?`,
                subheadline: 'Use this section to highlight your strongest offer or campaign.',
                ctaButtons: [{ label: 'Get Started', url: '#contact', style: 'primary' }],
            }

        default:
            return null
    }
}

export function normalizeAddSectionBlock(context: AddSectionContext, block?: Record<string, unknown> | null) {
    const fallbackBlock =
        createAddSectionBlock({
            instruction: context.instruction,
            siteName: context.siteName,
            theme: context.theme,
            requestedType: context.requestedType || String(block?.blockType || ''),
        }) || undefined

    if (!fallbackBlock) {
        return block as BlockData | undefined
    }

    if (!block || typeof block !== 'object') {
        return fallbackBlock
    }

    const mergedBlock = {
        ...fallbackBlock,
        ...block,
    } as BlockData

    if (mergedBlock.blockType === 'faq') {
        const items = Array.isArray((block as any).faqs)
            ? (block as any).faqs
            : Array.isArray((block as any).items)
                ? (block as any).items
                : fallbackBlock.faqs

        delete mergedBlock.items
        delete mergedBlock.variant
        return {
            ...mergedBlock,
            faqs: items,
        }
    }

    if (mergedBlock.blockType === 'testimonials') {
        const rawTestimonials = Array.isArray((block as any).testimonials) ? (block as any).testimonials : fallbackBlock.testimonials
        
        let safeVariant = mergedBlock.variant
        if (!['carousel', 'grid', 'masonry', 'single'].includes(String(safeVariant))) safeVariant = 'grid'

        return {
            ...mergedBlock,
            variant: safeVariant,
            testimonials: rawTestimonials.map((t: any) => {
                const newT = { ...t }
                delete newT.avatar
                return newT
            }),
        }
    }

    if (mergedBlock.blockType === 'features') {
        delete mergedBlock.variant
        let safeLayout = (block as any).layout || fallbackBlock.layout
        if (!['grid-3', 'grid-2', 'alternating', 'centered-list'].includes(String(safeLayout))) safeLayout = 'grid-3'

        return {
            ...mergedBlock,
            layout: safeLayout,
            features: Array.isArray((block as any).features)
                ? (block as any).features
                : Array.isArray((block as any).items)
                    ? (block as any).items
                    : fallbackBlock.features,
        }
    }

    if (mergedBlock.blockType === 'gallery') {
        delete mergedBlock.variant
        let safeLayout = (block as any).layout || fallbackBlock.layout
        if (!['masonry', 'grid', 'carousel', 'lightbox'].includes(String(safeLayout))) safeLayout = 'grid'

        const rawImages = Array.isArray((block as any).images) ? (block as any).images : fallbackBlock.images
        const cleanedImages = rawImages.map((item: any) => {
            const newItem = { ...item }
            delete newItem.image
            return newItem
        })
        return {
            ...mergedBlock,
            layout: safeLayout,
            images: cleanedImages,
        }
    }

    if (mergedBlock.blockType === 'team') {
        delete mergedBlock.variant
        const rawMembers = Array.isArray((block as any).members) ? (block as any).members : fallbackBlock.members
        return {
            ...mergedBlock,
            members: rawMembers.map((m: any) => {
                const newM = { ...m }
                delete newM.image
                return newM
            }),
        }
    }

    // CTA / Newsletter / Banner fallbacks are already mapped to Hero by createAddSectionBlock
    if (['newsletter', 'banner', 'cta'].includes(mergedBlock.blockType as string)) {
        mergedBlock.blockType = 'hero'
        mergedBlock.variant = 'centered'
    }

    return mergedBlock
}
