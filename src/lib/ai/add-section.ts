import type { BlockData, ThemeData } from '@/types/editor'
import { getDefaultSocialWidgetLinks, normalizeSocialWidgetConfig } from '@/blocks/social-widget/config'

export type SupportedAddSectionType =
    | 'testimonials'
    | 'faq'
    | 'gallery'
    | 'features'
    | 'team'
    | 'newsletter'
    | 'banner'
    | 'cta'
    | 'socialWidget'
    | 'cartWidget'
    // v1.1 new blocks
    | 'pricing-table'
    | 'gallery-masonry'
    | 'whatsapp-button'
    | 'google-maps'
    | 'social-proof'
    | 'countdown-timer'
    | 'before-after'
    | 'feature-comparison'
    | 'download-cta'
    | 'video-background'
    | 'breadcrumb'
    | 'divider'
    | 'announcement-bar'
    | 'client-logos'
    | 'accordion'
    | 'step-process'
    | 'portfolio-grid'
    | 'menu-food'
    | 'service-cards'
    | 'carousel'

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
    ['socialWidget', [/\bsocial\s*widget\b/i, /\bsocial\s*media\b/i, /\bsocial\s*links?\b/i, /\bfacebook\b/i, /\binstagram\b/i, /\blinkedin\b/i, /\byoutube\b/i]],
    ['cartWidget', [/\bcart\b/i, /\bshopping cart\b/i, /\bbag\b/i, /\bcheckout\b/i]],
    // v1.1 new blocks
    ['pricing-table', [/\bpricing\s*table\b/i, /\bprice\s*comparison\b/i, /\bplan\s*comparison\b/i]],
    ['gallery-masonry', [/\bmasonry\b/i, /\bmosaic\b/i]],
    ['whatsapp-button', [/\bwhatsapp\b/i, /\bwa\s*button\b/i]],
    ['google-maps', [/\bgoogle\s*maps?\b/i, /\bmap\b/i, /\blocation\b/i, /\baddress\b/i]],
    ['social-proof', [/\bsocial\s*proof\b/i, /\breview\b/i, /\brating\b/i, /\bstar\b/i]],
    ['countdown-timer', [/\bcountdown\b/i, /\btimer\b/i, /\burgency\b/i]],
    ['before-after', [/\bbefore\s*after\b/i, /\bcomparison\s*slider\b/i]],
    ['feature-comparison', [/\bfeature\s*comparison\b/i, /\bcompare\s*plan\b/i, /\bvs\b/i]],
    ['download-cta', [/\bdownload\b/i, /\bfile\b/i, /\bebook\b/i, /\bpdf\b/i]],
    ['video-background', [/\bvideo\s*background\b/i, /\bvideo\s*hero\b/i, /\bfull\s*video\b/i]],
    ['breadcrumb', [/\bbreadcrumb\b/i]],
    ['divider', [/\bdivider\b/i, /\bspacer\b/i, /\bseparator\b/i]],
    ['announcement-bar', [/\bannouncement\b/i, /\bbanner\s*bar\b/i, /\btop\s*bar\b/i]],
    ['client-logos', [/\bclient\s*logo\b/i, /\bpartner\s*logo\b/i, /\blogo\s*cloud\b/i, /\btrust\s*badge\b/i]],
    ['accordion', [/\baccordion\b/i, /\bcollapsible\b/i, /\bexpandable\b/i]],
    ['step-process', [/\bstep\b/i, /\bprocess\b/i, /\bhow\s*it\s*works\b/i, /\btimeline\b/i]],
    ['portfolio-grid', [/\bportfolio\b/i, /\bproject\b/i, /\bshowcase\b/i, /\bwork\b/i]],
    ['menu-food', [/\bmenu\b/i, /\bfood\b/i, /\brestaurant\b/i, /\bdish\b/i]],
    ['service-cards', [/\bservice\b/i, /\boffering\b/i]],
    ['carousel', [/\bcarousel\b/i, /\bslider\b/i, /\bslideshow\b/i]],
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
    socialWidget: 'social media',
    cartWidget: 'cart',
    'pricing-table': 'pricing table',
    'gallery-masonry': 'masonry gallery',
    'whatsapp-button': 'WhatsApp button',
    'google-maps': 'Google Maps',
    'social-proof': 'social proof',
    'countdown-timer': 'countdown timer',
    'before-after': 'before/after comparison',
    'feature-comparison': 'feature comparison',
    'download-cta': 'download CTA',
    'video-background': 'video background',
    breadcrumb: 'breadcrumb',
    divider: 'divider',
    'announcement-bar': 'announcement bar',
    'client-logos': 'client logos',
    accordion: 'accordion',
    'step-process': 'step process',
    'portfolio-grid': 'portfolio grid',
    'menu-food': 'food menu',
    'service-cards': 'service cards',
    carousel: 'carousel',
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

        case 'socialWidget':
            return normalizeSocialWidgetConfig({
                blockType: 'socialWidget',
                variant: 'floating',
                headline: 'Stay connected',
                links: getDefaultSocialWidgetLinks(),
            })

        case 'cartWidget':
            return {
                blockType: 'cartWidget',
                variant: 'floating',
                label: 'Cart',
                showLabel: false,
            }

        // ── v1.1 New Blocks ─────────────────────────────────────────

        case 'pricing-table':
            return {
                blockType: 'pricing-table',
                variant: 'columns',
                headline: `Choose the right plan for you`,
                subheadline: 'Simple, transparent pricing. No hidden fees.',
                plans: [
                    { name: 'Starter', price: 29, currency: 'RM', features: ['1 project', 'Basic support', '1GB storage'], cta: { label: 'Get Started', url: '#contact' } },
                    { name: 'Business', price: 69, currency: 'RM', features: ['5 projects', 'Priority support', '10GB storage', 'Custom domain'], cta: { label: 'Get Started', url: '#contact' }, popular: true },
                    { name: 'Enterprise', price: 149, currency: 'RM', features: ['Unlimited projects', '24/7 support', '100GB storage', 'API access', 'White label'], cta: { label: 'Contact Us', url: '#contact' } },
                ],
            }

        case 'gallery-masonry':
            return {
                blockType: 'gallery-masonry',
                variant: 'masonry',
                headline: `${brandName} Gallery`,
                images: Array.from({ length: 6 }, (_, i) => ({ url: '', alt: `Gallery image ${i + 1}`, caption: `Photo ${i + 1}` })),
            }

        case 'whatsapp-button':
            return {
                blockType: 'whatsapp-button',
                variant: 'floating',
                phoneNumber: '+60123456789',
                message: `Hi ${brandName}, I'd like to know more!`,
                label: 'Chat with us',
                position: 'bottom-right',
            }

        case 'google-maps':
            return {
                blockType: 'google-maps',
                variant: 'card',
                headline: 'Find Us',
                embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3983.8!2d101.69!3d3.14!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zM8KwMDgnMjQuMCJOIDEwMcKwNDEnMjQuMCJF!5e0!3m2!1sen!2smy!4v1',
                address: '123 Jalan Example, 50000 Kuala Lumpur, Malaysia',
                height: 400,
            }

        case 'social-proof':
            return {
                blockType: 'social-proof',
                variant: 'cards',
                headline: `What our customers say`,
                reviews: [
                    { author: 'Sarah M.', role: 'Business Owner', content: `${brandName} exceeded my expectations. Highly recommended!`, rating: 5 },
                    { author: 'Ahmad R.', role: 'Marketing Manager', content: 'Professional service and great results. Will use again.', rating: 5 },
                    { author: 'Lisa T.', role: 'Freelancer', content: 'Easy to work with and delivered on time. Very satisfied.', rating: 4 },
                ],
            }

        case 'countdown-timer':
            return {
                blockType: 'countdown-timer',
                variant: 'banner',
                headline: 'Limited Time Offer!',
                targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                expiredMessage: 'This offer has ended.',
            }

        case 'before-after':
            return {
                blockType: 'before-after',
                variant: 'slider',
                headline: 'See the Transformation',
                beforeImage: { url: '', alt: 'Before', label: 'Before' },
                afterImage: { url: '', alt: 'After', label: 'After' },
            }

        case 'feature-comparison':
            return {
                blockType: 'feature-comparison',
                variant: 'table',
                headline: 'Compare Our Plans',
                products: [{ name: 'Basic', highlighted: false }, { name: 'Pro', highlighted: true }],
                features: [
                    { name: 'Custom Domain', values: [false, true] },
                    { name: 'SSL Certificate', values: [true, true] },
                    { name: 'Analytics', values: [false, true] },
                    { name: 'Priority Support', values: [false, true] },
                ],
            }

        case 'download-cta':
            return {
                blockType: 'download-cta',
                variant: 'card',
                headline: 'Download Our Free Guide',
                description: `Get the ultimate guide to growing your business with ${brandName}.`,
                fileUrl: '#',
                fileName: 'Free-Guide.pdf',
                fileSize: '2.4 MB',
                buttonLabel: 'Download Now',
                requireEmail: false,
            }

        case 'video-background':
            return {
                blockType: 'video-background',
                variant: 'full',
                headline: `Welcome to ${brandName}`,
                subheadline: 'Watch our story unfold.',
                videoUrl: '',
                posterImage: { url: '' },
                overlayOpacity: 50,
                cta: { label: 'Learn More', url: '#about' },
            }

        case 'breadcrumb':
            return {
                blockType: 'breadcrumb',
                variant: 'simple',
                items: [
                    { label: 'Home', url: '/' },
                    { label: 'Products', url: '/products' },
                    { label: 'Current Page' },
                ],
            }

        case 'divider':
            return {
                blockType: 'divider',
                variant: 'line',
                height: 40,
            }

        case 'announcement-bar':
            return {
                blockType: 'announcement-bar',
                variant: 'gradient',
                message: 'Free shipping on all orders this week!',
                linkText: 'Shop Now',
                linkUrl: '#products',
                dismissible: true,
            }

        case 'client-logos':
            return {
                blockType: 'client-logos',
                variant: 'scroll',
                headline: 'Trusted by leading brands',
                logos: Array.from({ length: 6 }, (_, i) => ({ url: '', alt: `Partner ${i + 1}` })),
            }

        case 'accordion':
            return {
                blockType: 'accordion',
                variant: 'bordered',
                headline: 'More Information',
                items: [
                    { title: 'What services do you offer?', content: `${brandName} provides comprehensive solutions tailored to your needs.` },
                    { title: 'How can I get started?', content: 'Simply contact us through the form above or give us a call.' },
                    { title: 'What are your business hours?', content: 'We are open Monday to Friday, 9am to 6pm.' },
                ],
            }

        case 'step-process':
            return {
                blockType: 'step-process',
                variant: 'horizontal',
                headline: 'How It Works',
                subheadline: 'Get started in just 3 easy steps.',
                steps: [
                    { title: 'Choose Your Plan', description: 'Select the package that fits your needs.', icon: '1️⃣' },
                    { title: 'Set Up Your Account', description: 'Quick setup takes less than 5 minutes.', icon: '2️⃣' },
                    { title: 'Start Growing', description: 'Launch and watch your business grow.', icon: '3️⃣' },
                ],
            }

        case 'portfolio-grid':
            return {
                blockType: 'portfolio-grid',
                variant: 'grid',
                headline: 'Our Work',
                subheadline: `See what ${brandName} has accomplished.`,
                projects: [
                    { title: 'Project Alpha', description: 'A complete brand redesign for a tech startup.', imageUrl: '', category: 'Branding' },
                    { title: 'Project Beta', description: 'E-commerce platform with 200% growth.', imageUrl: '', category: 'Web' },
                    { title: 'Project Gamma', description: 'Mobile app with 50K downloads in 3 months.', imageUrl: '', category: 'Mobile' },
                ],
            }

        case 'menu-food':
            return {
                blockType: 'menu-food',
                variant: 'classic',
                headline: 'Our Menu',
                categories: [
                    {
                        name: 'Main Course',
                        items: [
                            { name: 'Nasi Lemak Special', description: 'Fragrant rice with sambal, egg, and chicken', price: 12.90, currency: 'RM', tag: 'Popular' },
                            { name: 'Mee Goreng', description: 'Stir-fried noodles with prawns and vegetables', price: 10.90, currency: 'RM' },
                            { name: 'Roti Canai', description: 'Flaky flatbread with curry dipping sauce', price: 5.90, currency: 'RM' },
                        ],
                    },
                    {
                        name: 'Beverages',
                        items: [
                            { name: 'Teh Tarik', description: 'Pulled milk tea', price: 3.50, currency: 'RM', tag: 'Best Seller' },
                            { name: 'Kopi O', description: 'Traditional black coffee', price: 2.90, currency: 'RM' },
                        ],
                    },
                ],
            }

        case 'service-cards':
            return {
                blockType: 'service-cards',
                variant: 'grid',
                headline: 'Our Services',
                subheadline: `What ${brandName} can do for you.`,
                services: [
                    { title: 'Web Design', description: 'Beautiful, responsive websites that convert visitors into customers.', icon: '🎨', price: 'From RM 1,500', priceUnit: '/project' },
                    { title: 'SEO Optimization', description: 'Get found on Google with data-driven SEO strategies.', icon: '🔍', price: 'From RM 500', priceUnit: '/month' },
                    { title: 'Social Media', description: 'Grow your audience with engaging social content.', icon: '📱', price: 'From RM 800', priceUnit: '/month' },
                ],
            }

        case 'carousel':
            return {
                blockType: 'carousel',
                variant: 'images',
                headline: 'Featured Highlights',
                autoplay: true,
                interval: 5000,
                items: [
                    { imageUrl: '', title: 'Slide 1', description: `Discover what ${brandName} has to offer.` },
                    { imageUrl: '', title: 'Slide 2', description: 'Quality products and exceptional service.' },
                    { imageUrl: '', title: 'Slide 3', description: 'Join thousands of satisfied customers.' },
                ],
            }

        default:
            return null
    }
}

import { blockRegistry } from '@/blocks/registry'

/** Generate minimal default content for any block type using its Zod schema defaults */
function createDefaultBlockFromRegistry(blockType: string, brandName: string): BlockData | null {
    try {
        if (!blockRegistry.has(blockType)) return null

        const schema = blockRegistry.getSchema(blockType)
        if (!schema) return { blockType } as BlockData

        // Parse empty object to get Zod defaults
        const result = schema.safeParse({ blockType })
        if (result.success) {
            const data = result.data as Record<string, unknown>
            // Add placeholder headline if the schema has one
            if ('headline' in data && !data.headline) {
                data.headline = `${brandName} — ${blockType.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`
            }
            return data as BlockData
        }

        return { blockType } as BlockData
    } catch {
        return null
    }
}

export function normalizeAddSectionBlock(context: AddSectionContext, block?: Record<string, unknown> | null) {
    const brandName = context.siteName?.trim() || 'Your Brand'
    const fallbackBlock =
        createAddSectionBlock({
            instruction: context.instruction,
            siteName: context.siteName,
            theme: context.theme,
            requestedType: context.requestedType || String(block?.blockType || ''),
        }) || undefined

    if (!fallbackBlock) {
        // For new block types not in createAddSectionBlock, generate from registry schema
        const registryBlock = createDefaultBlockFromRegistry(
            String(block?.blockType || context.requestedType || ''),
            brandName,
        )
        if (registryBlock) {
            return { ...registryBlock, ...(block || {}) } as BlockData
        }
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
        const items = Array.isArray((block as Record<string, unknown>).faqs)
            ? (block as Record<string, unknown>).faqs
            : Array.isArray((block as Record<string, unknown>).items)
                ? (block as Record<string, unknown>).items
                : fallbackBlock.faqs

        delete mergedBlock.items
        delete mergedBlock.variant
        return {
            ...mergedBlock,
            faqs: items,
        }
    }

    if (mergedBlock.blockType === 'testimonials') {
        const rawTestimonials = (Array.isArray((block as Record<string, unknown>).testimonials) ? (block as Record<string, unknown>).testimonials : fallbackBlock.testimonials) as Record<string, unknown>[]
        
        let safeVariant = mergedBlock.variant
        if (!['carousel', 'grid', 'masonry', 'single'].includes(String(safeVariant))) safeVariant = 'grid'

        return {
            ...mergedBlock,
            variant: safeVariant,
            testimonials: rawTestimonials.map((t: Record<string, unknown>) => {
                const newT = { ...t }
                delete newT.avatar
                return newT
            }),
        }
    }

    if (mergedBlock.blockType === 'features') {
        delete mergedBlock.variant
        let safeLayout = (block as Record<string, unknown>).layout || fallbackBlock.layout
        if (!['grid-3', 'grid-2', 'alternating', 'centered-list'].includes(String(safeLayout))) safeLayout = 'grid-3'

        return {
            ...mergedBlock,
            layout: safeLayout,
            features: Array.isArray((block as Record<string, unknown>).features)
                ? (block as Record<string, unknown>).features
                : Array.isArray((block as Record<string, unknown>).items)
                    ? (block as Record<string, unknown>).items
                    : fallbackBlock.features,
        }
    }

    if (mergedBlock.blockType === 'gallery') {
        delete mergedBlock.variant
        let safeLayout = (block as Record<string, unknown>).layout || fallbackBlock.layout
        if (!['masonry', 'grid', 'carousel', 'lightbox'].includes(String(safeLayout))) safeLayout = 'grid'

        const rawImages = (Array.isArray((block as Record<string, unknown>).images) ? (block as Record<string, unknown>).images : fallbackBlock.images) as Record<string, unknown>[]
        const cleanedImages = rawImages.map((item: Record<string, unknown>) => {
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
        const rawMembers = (Array.isArray((block as Record<string, unknown>).members) ? (block as Record<string, unknown>).members : fallbackBlock.members) as Record<string, unknown>[]
        return {
            ...mergedBlock,
            members: rawMembers.map((m: Record<string, unknown>) => {
                const newM = { ...m }
                delete newM.image
                return newM
            }),
        }
    }

    if (mergedBlock.blockType === 'socialWidget') {
        return normalizeSocialWidgetConfig(mergedBlock)
    }

    // CTA / Newsletter / Banner fallbacks are already mapped to Hero by createAddSectionBlock
    if (['newsletter', 'banner', 'cta'].includes(mergedBlock.blockType as string)) {
        mergedBlock.blockType = 'hero'
        mergedBlock.variant = 'centered'
    }

    return mergedBlock
}
