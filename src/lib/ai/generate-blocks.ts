/**
 * @deprecated Second-tier safety net only. Primary fallback path is
 * `composeFallbackResult()` in ./fallback-adapter.ts, which uses the richer
 * template-composer pipeline (14 industry categories, Phase-04 content validation).
 * This file runs ONLY if the composer path throws. Do not extend — new industry
 * content belongs in `src/lib/ai/content/*.ts`.
 *
 * Rule-based AI Block Generator with Seeded Variety
 * Parses user prompt → generates blocks JSON matching Pages collection schema.
 * Target Market: Malaysia (EN / MS)
 */

import { enforceMinContent } from './variant-validation'
import { applyContentValidation } from './content-rules'

// ─── Types ──────────────────────────────────────────────────────────────

export type BusinessIntent = {
    name: string
    type: 'business' | 'ecommerce' | 'restaurant' | 'portfolio' | 'blog'
    description: string
    style: 'modern' | 'classic' | 'minimal' | 'bold'
}

export type GeneratedBlock = {
    blockType: string
    [key: string]: unknown
}

export type GeneratedPage = {
    title: string
    slug: string
    isHomepage: boolean
    blocks: GeneratedBlock[]
    seo: {
        title: string
        description: string
        /** Plan 260414-2249 phase-06: per-page og:image. */
        ogImage?: string
        /** Plan 260414-2249 phase-06: schema.org JSON-LD array. */
        jsonLd?: Array<Record<string, unknown>>
    }
}

export type GenerationResult = {
    siteName: string
    siteType: BusinessIntent['type']
    blocks: GeneratedBlock[]
    pages?: GeneratedPage[]
    seo: { title: string; description: string }
    language?: 'en' | 'ms' | 'vi'
    theme: {
        primaryColor: string
        secondaryColor: string
        fontHeading: string
        fontBody: string
        colorMode: 'light' | 'dark'
        // Optional fields populated when a category preset is applied
        // (openai-generator.ts happy path + fallback-adapter composer).
        // resolveTheme() downstream uses them when present, defaults otherwise.
        accentColor?: string
        fontPairingId?: string
        spacingPreset?: 'compact' | 'default' | 'relaxed'
        borderRadius?: 'sharp' | 'subtle' | 'rounded' | 'soft' | 'pill'
        shadowPreset?: 'none' | 'subtle' | 'medium' | 'dramatic'
    }
    /**
     * Plan 260415 Phase 04 — post-AI swap telemetry (optional).
     * One entry per swappable block considered. Populated only by the AI
     * happy path when AI_POST_SWAP_ENABLED is true. Fallback path doesn't emit.
     * Consumed by Phase 07 measurement harness.
     */
    postAISwap?: {
        enabled: boolean
        swapCount: number
        decisions: Array<{
            blockType: string
            action: string
            reason: string | null
        }>
    }
}

// ─── Seeded PRNG Utilities ─────────────────────────────────────────────

function createSeededRandom(seed?: number): () => number {
    let s = seed ?? Date.now()
    return () => {
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        return (s >>> 0) / 0xFFFFFFFF
    }
}

function pickRandom<T>(arr: T[], rand: () => number): T {
    return arr[Math.floor(rand() * arr.length)]!
}

function shuffleArray<T>(arr: T[], rand: () => number): T[] {
    const copy = [...arr]
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!]
    }
    return copy
}

// ─── Intent Parser ──────────────────────────────────────────────────────

const TYPE_KEYWORDS: Record<BusinessIntent['type'], string[]> = {
    restaurant: ['restaurant', 'cafe', 'coffee', 'bakery', 'food', 'dining', 'bistro', 'pizza', 'sushi', 'bar', 'kedai makan', 'restoran'],
    ecommerce: ['shop', 'store', 'fashion', 'beauty', 'cosmetic', 'ecommerce', 'retail', 'boutique', 'kedai', 'online store'],
    portfolio: ['portfolio', 'freelance', 'photographer', 'designer', 'artist', 'personal', 'cv', 'resume', 'creative'],
    blog: ['blog', 'news', 'magazine', 'content', 'journal', 'editorial'],
    business: ['company', 'agency', 'service', 'startup', 'tech', 'consulting', 'marketing', 'spa', 'gym', 'fitness', 'clinic', 'dental', 'real estate', 'property'],
}

function parseIntent(prompt: string): BusinessIntent {
    const lower = prompt.toLowerCase()

    let name = 'My Website'
    const namePatterns = [
        /(?:called|named|for)\s+["']?([^"'\n,]+)/i,
        /["']([^"']+)["']/,
        /^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)/,
    ]
    for (const pattern of namePatterns) {
        const match = prompt.match(pattern)
        if (match?.[1]) {
            name = match[1].trim()
            break
        }
    }

    let type: BusinessIntent['type'] = 'business'
    let maxScore = 0
    for (const [bizType, keywords] of Object.entries(TYPE_KEYWORDS)) {
        const score = keywords.filter(kw => lower.includes(kw)).length
        if (score > maxScore) {
            maxScore = score
            type = bizType as BusinessIntent['type']
        }
    }

    let style: BusinessIntent['style'] = 'modern'
    if (lower.includes('minimal') || lower.includes('clean')) style = 'minimal'
    else if (lower.includes('classic') || lower.includes('elegant') || lower.includes('traditional')) style = 'classic'
    else if (lower.includes('bold') || lower.includes('vibrant') || lower.includes('strong')) style = 'bold'

    return { name, type, description: prompt, style }
}

// ─── Theme Palettes (3 per category) ────────────────────────────────────

const THEME_PALETTES: Record<BusinessIntent['type'], GenerationResult['theme'][]> = {
    restaurant: [
        { primaryColor: '#D97706', secondaryColor: '#92400E', fontHeading: 'Playfair Display', fontBody: 'Inter', colorMode: 'light' },
        { primaryColor: '#DC2626', secondaryColor: '#7F1D1D', fontHeading: 'DM Sans', fontBody: 'Lato', colorMode: 'dark' },
        { primaryColor: '#059669', secondaryColor: '#065F46', fontHeading: 'Raleway', fontBody: 'Open Sans', colorMode: 'light' },
    ],
    ecommerce: [
        { primaryColor: '#0EA5E9', secondaryColor: '#6366F1', fontHeading: 'DM Sans', fontBody: 'Inter', colorMode: 'light' },
        { primaryColor: '#8B5CF6', secondaryColor: '#EC4899', fontHeading: 'Outfit', fontBody: 'Nunito', colorMode: 'dark' },
        { primaryColor: '#10B981', secondaryColor: '#3B82F6', fontHeading: 'Poppins', fontBody: 'Lato', colorMode: 'light' },
    ],
    portfolio: [
        { primaryColor: '#F43F5E', secondaryColor: '#8B5CF6', fontHeading: 'Outfit', fontBody: 'DM Sans', colorMode: 'dark' },
        { primaryColor: '#0EA5E9', secondaryColor: '#14B8A6', fontHeading: 'Raleway', fontBody: 'Inter', colorMode: 'light' },
        { primaryColor: '#F59E0B', secondaryColor: '#EF4444', fontHeading: 'Playfair Display', fontBody: 'Lato', colorMode: 'dark' },
    ],
    blog: [
        { primaryColor: '#10B981', secondaryColor: '#3B82F6', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
        { primaryColor: '#6366F1', secondaryColor: '#EC4899', fontHeading: 'Playfair Display', fontBody: 'Open Sans', colorMode: 'light' },
        { primaryColor: '#1E293B', secondaryColor: '#64748B', fontHeading: 'DM Sans', fontBody: 'Nunito', colorMode: 'dark' },
    ],
    business: [
        { primaryColor: '#3B82F6', secondaryColor: '#8B5CF6', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
        { primaryColor: '#0F766E', secondaryColor: '#065F46', fontHeading: 'Raleway', fontBody: 'Lato', colorMode: 'light' },
        { primaryColor: '#1E293B', secondaryColor: '#3B82F6', fontHeading: 'DM Sans', fontBody: 'Open Sans', colorMode: 'dark' },
    ],
}

// ─── Variant Options (safe variants per block type) ─────────────────────

const VARIANT_OPTIONS: Record<string, string[]> = {
    hero: ['centered', 'split-left', 'fullscreen', 'gradient', 'parallax', 'magazine', 'minimal', 'slideshow'],
    features: ['grid-2', 'grid-3', 'grid-4', 'list', 'icon-top', 'icon-left', 'zigzag'],
    testimonials: ['cards', 'carousel', 'simple', 'masonry', 'spotlight', 'minimal-quote'],
    contact: ['form', 'split', 'card-float', 'minimal-inline'],
    footer: ['simple', 'expanded', 'minimal', 'centered-stack', 'mega-footer', 'dark-gradient'],
    faq: ['accordion', 'grid', 'simple'],
    cta: ['banner', 'inline', 'card', 'floating-sticky', 'image-bg', 'split-testimonial', 'dark-card', 'mesh-gradient-hero'],
    stats: ['row', 'grid', 'highlight'],
    gallery: ['grid', 'masonry', 'carousel', 'lightbox'],
    navigation: ['simple', 'centered', 'transparent', 'pill'],
    about: ['simple', 'split', 'story'],
    newsletter: ['inline', 'popup', 'banner'],
    team: ['grid', 'list', 'cards-hover-reveal', 'horizontal-scroll', 'bio-modal', 'compact-row'],
    pricing: ['cards', 'table', 'horizontal', 'toggle'],
}

// ─── Content Variations (3 per category) ────────────────────────────────

type ContentSet = {
    heroHeadline: string
    heroSub: string
    aboutBody: string
    features: Array<{ icon: string; title: string; description: string }>
    testimonials: Array<{ quote: string; name: string; title: string; rating: number }>
    contactSubtext: string
    ctaLabel: string
}

const CONTENT_VARIATIONS: Record<BusinessIntent['type'], ContentSet[]> = {
    restaurant: [
        {
            heroHeadline: 'Authentic Flavours, Unforgettable Experiences',
            heroSub: 'Savour dishes crafted from the freshest ingredients in a warm, elegant setting.',
            aboutBody: 'With a passion for culinary excellence and over 10 years of experience, we bring you unforgettable dining moments.',
            features: [
                { icon: '🍳', title: 'Expert Chefs', description: 'Our team brings over a decade of experience from award-winning restaurants.' },
                { icon: '🥬', title: 'Fresh Ingredients', description: 'Carefully sourced from trusted local and international suppliers.' },
                { icon: '🎵', title: 'Elegant Ambience', description: 'Modern design with soothing music — perfect for any occasion.' },
            ],
            testimonials: [
                { quote: 'Absolutely amazing food! The atmosphere is beautiful and the staff is incredibly attentive.', name: 'Sarah L.', title: 'Food Blogger', rating: 5 },
                { quote: 'Every visit is a delight. Consistent quality and great value for money.', name: 'James T.', title: 'Entrepreneur', rating: 5 },
                { quote: 'The best dining experience in the city. We come back every week!', name: 'Priya K.', title: 'Regular Customer', rating: 5 },
            ],
            contactSubtext: 'Book a table or contact us today to host your special event.',
            ctaLabel: 'Book a Table',
        },
        {
            heroHeadline: 'Where Every Meal Tells a Story',
            heroSub: 'Experience culinary artistry that brings together tradition and innovation on every plate.',
            aboutBody: 'Born from a family recipe book and a dream, our restaurant celebrates the rich flavours of home cooking with a modern twist.',
            features: [
                { icon: '🔥', title: 'Wood-Fired Cooking', description: 'Traditional techniques that bring out deep, smoky flavours in every dish.' },
                { icon: '🌿', title: 'Farm-to-Table', description: 'Ingredients sourced directly from local farms every morning.' },
                { icon: '🍷', title: 'Curated Wine List', description: 'Hand-picked wines to complement every course and occasion.' },
            ],
            testimonials: [
                { quote: 'A hidden gem! The flavours are extraordinary and the service is impeccable.', name: 'Marcus W.', title: 'Food Critic', rating: 5 },
                { quote: 'Celebrated our anniversary here. The tasting menu was an unforgettable journey.', name: 'Aisha N.', title: 'Loyal Customer', rating: 5 },
                { quote: 'Finally a restaurant that respects tradition while being creative.', name: 'Chef Lim', title: 'Fellow Chef', rating: 5 },
            ],
            contactSubtext: 'Reserve your table for a memorable dining experience.',
            ctaLabel: 'Reserve Now',
        },
        {
            heroHeadline: 'Taste the Tradition, Feel the Warmth',
            heroSub: 'Handcrafted recipes passed down through generations, served with love in a cozy setting.',
            aboutBody: 'For three generations, our family has been serving authentic recipes. Every dish carries the warmth and care of home cooking.',
            features: [
                { icon: '👨‍🍳', title: 'Family Recipes', description: 'Treasured recipes from grandmother\'s kitchen, perfected over decades.' },
                { icon: '🏠', title: 'Cozy Atmosphere', description: 'A welcoming space designed to make you feel right at home.' },
                { icon: '🚗', title: 'Easy Delivery', description: 'Available on all major platforms with delivery within 30 minutes.' },
            ],
            testimonials: [
                { quote: 'Tastes exactly like my grandmother used to cook. Pure comfort food!', name: 'Mei Ling', title: 'Regular', rating: 5 },
                { quote: 'The warmest restaurant in town. Staff remembers your name!', name: 'Raj P.', title: 'Local Resident', rating: 5 },
                { quote: 'Best value for money. Big portions, amazing taste.', name: 'Ahmad B.', title: 'Customer', rating: 5 },
            ],
            contactSubtext: 'Visit us or order delivery — we\'d love to feed you.',
            ctaLabel: 'Order Now',
        },
    ],
    ecommerce: [
        {
            heroHeadline: 'Quality Products, Unbeatable Prices',
            heroSub: 'Explore thousands of authentic products. Fast delivery, hassle-free returns.',
            aboutBody: 'We are committed to delivering the best shopping experience with our "Quality First" promise.',
            features: [
                { icon: '🚚', title: 'Fast Delivery', description: 'Free shipping above RM150. Receive within 1-3 business days.' },
                { icon: '🔄', title: 'Easy Returns', description: 'Hassle-free returns within 30 days, no questions asked.' },
                { icon: '💎', title: '100% Authentic', description: 'Every product verified with authenticity guarantee.' },
            ],
            testimonials: [
                { quote: 'Shopping here is stress-free. Products match the photos exactly.', name: 'Aina R.', title: 'VIP Customer', rating: 5 },
                { quote: 'Excellent service and fast delivery. My go-to online store!', name: 'Ahmad K.', title: 'Customer', rating: 5 },
                { quote: 'Great quality at fair prices. The return process was smooth too.', name: 'Jenny L.', title: 'Shopper', rating: 5 },
            ],
            contactSubtext: 'Need help? Our support team is available 24/7.',
            ctaLabel: 'Shop Now',
        },
        {
            heroHeadline: 'Discover Your Style, Define Your Look',
            heroSub: 'Curated collections that blend trending fashion with timeless elegance.',
            aboutBody: 'We believe everyone deserves to express their unique style. Our curators travel the world to bring you the finest selections.',
            features: [
                { icon: '✨', title: 'Curated Selection', description: 'Hand-picked by our style experts from top brands worldwide.' },
                { icon: '📦', title: 'Same-Day Dispatch', description: 'Order before 2pm, shipped the same day. Track every step.' },
                { icon: '💬', title: 'Style Advisor', description: 'Free personal styling advice via chat or video call.' },
            ],
            testimonials: [
                { quote: 'Found my entire wardrobe here. The quality is consistently excellent.', name: 'Siti M.', title: 'Fashion Blogger', rating: 5 },
                { quote: 'The style advisor helped me find the perfect outfit for my interview!', name: 'David C.', title: 'Customer', rating: 5 },
                { quote: 'Finally an online store with genuine premium products at fair prices.', name: 'Lisa T.', title: 'Repeat Buyer', rating: 5 },
            ],
            contactSubtext: 'Chat with our style advisor or reach our support team.',
            ctaLabel: 'Explore Collection',
        },
        {
            heroHeadline: 'Shop Smart, Live Better',
            heroSub: 'Everything you need under one roof. From daily essentials to premium picks.',
            aboutBody: 'Started in 2020 as a small local shop, we\'ve grown into a trusted marketplace serving thousands of happy customers across Malaysia.',
            features: [
                { icon: '🏷️', title: 'Best Price Guarantee', description: 'Found it cheaper elsewhere? We\'ll match the price plus 10% off.' },
                { icon: '🔒', title: 'Secure Payment', description: 'FPX, credit card, e-wallets — all encrypted and protected.' },
                { icon: '⭐', title: 'Reward Points', description: 'Earn points on every purchase. Redeem for discounts on next order.' },
            ],
            testimonials: [
                { quote: 'The reward points system is brilliant. Saved RM200 last month!', name: 'Farah A.', title: 'Gold Member', rating: 5 },
                { quote: 'Trust this store completely. Every product is exactly as described.', name: 'Kevin W.', title: 'Customer', rating: 5 },
                { quote: 'Best customer service I\'ve experienced online. Quick and helpful.', name: 'Nurul H.', title: 'Customer', rating: 5 },
            ],
            contactSubtext: 'Questions about an order? We respond within 1 hour.',
            ctaLabel: 'Start Shopping',
        },
    ],
    portfolio: [
        {
            heroHeadline: 'Creative Work That Inspires',
            heroSub: 'Meaningful digital experiences through thoughtful design and clean code.',
            aboutBody: 'A passionate creative professional crafting beautiful, functional digital products.',
            features: [
                { icon: '🎨', title: 'UI/UX Design', description: 'Intuitive interfaces with focus on user experience and visual appeal.' },
                { icon: '💻', title: 'Web Development', description: 'Responsive websites using modern frameworks and best practices.' },
                { icon: '📱', title: 'Mobile Apps', description: 'Cross-platform mobile applications with native feel.' },
            ],
            testimonials: [
                { quote: 'Outstanding work. Delivered beyond expectations.', name: 'Sarah Chen', title: 'CEO, TechStart', rating: 5 },
                { quote: 'Professional, creative, incredibly talented. Highly recommended!', name: 'James Wilson', title: 'Marketing Director', rating: 5 },
                { quote: 'Transformed our brand with a stunning website. Best investment we made.', name: 'Alex P.', title: 'Startup Founder', rating: 5 },
            ],
            contactSubtext: 'Got a project in mind? Let\'s bring your vision to life.',
            ctaLabel: 'View Portfolio',
        },
        {
            heroHeadline: 'Design That Moves People',
            heroSub: 'Crafting visual stories that connect brands with their audience.',
            aboutBody: 'With 8+ years in design, I help businesses tell their story through compelling visuals and intuitive experiences.',
            features: [
                { icon: '🖼️', title: 'Brand Identity', description: 'Complete brand systems from logo to guidelines to collateral.' },
                { icon: '🌐', title: 'Digital Strategy', description: 'Data-driven design decisions backed by user research.' },
                { icon: '✏️', title: 'Illustration', description: 'Custom illustrations that give your brand a unique personality.' },
            ],
            testimonials: [
                { quote: 'Our rebrand increased customer inquiries by 60%. Worth every cent.', name: 'Diana K.', title: 'Business Owner', rating: 5 },
                { quote: 'Incredible attention to detail. Every pixel perfect.', name: 'Tom R.', title: 'Creative Director', rating: 5 },
                { quote: 'Finally found a designer who truly listens and delivers.', name: 'Mei H.', title: 'Founder', rating: 5 },
            ],
            contactSubtext: 'Let\'s discuss your next project over coffee.',
            ctaLabel: 'Get in Touch',
        },
        {
            heroHeadline: 'Building Digital Products That Matter',
            heroSub: 'Full-stack development with a design-first approach.',
            aboutBody: 'Engineer and designer who believes great products come from the intersection of technology and creativity.',
            features: [
                { icon: '⚡', title: 'Fast & Performant', description: 'Websites that score 95+ on Core Web Vitals every time.' },
                { icon: '🔧', title: 'Full-Stack', description: 'From database design to pixel-perfect frontend, all in one.' },
                { icon: '📊', title: 'Growth-Focused', description: 'Built-in analytics, SEO, and conversion optimization.' },
            ],
            testimonials: [
                { quote: 'Our site loads in under 1 second now. Conversions doubled.', name: 'Ryan M.', title: 'SaaS Founder', rating: 5 },
                { quote: 'Rare combination of design sense and engineering skill.', name: 'Nina S.', title: 'Product Manager', rating: 5 },
                { quote: 'Shipped our MVP in 3 weeks. Clean code, beautiful design.', name: 'Jake L.', title: 'CTO', rating: 5 },
            ],
            contactSubtext: 'Ready to build something great together?',
            ctaLabel: 'Start a Project',
        },
    ],
    blog: [
        {
            heroHeadline: 'Discover Knowledge Every Day',
            heroSub: 'Stories, insights, and inspiration for a better life and career.',
            aboutBody: 'A curated collection of quality articles on technology, lifestyle, and personal growth.',
            features: [
                { icon: '📝', title: 'Quality Articles', description: 'Well-researched content on the latest trends and insights.' },
                { icon: '🎯', title: 'Diverse Topics', description: 'Technology, marketing, personal development and more.' },
                { icon: '💡', title: 'Practical Knowledge', description: 'Real-world experience you can apply immediately.' },
            ],
            testimonials: [
                { quote: 'Insightful and practical. I apply these articles right away!', name: 'Daniel W.', title: 'Developer', rating: 5 },
                { quote: 'One of the best blogs for tech and productivity content.', name: 'Lisa M.', title: 'Content Creator', rating: 5 },
                { quote: 'Subscribe to the newsletter. Every issue is gold.', name: 'Hao Z.', title: 'Reader', rating: 5 },
            ],
            contactSubtext: 'Want to collaborate or contribute? Get in touch!',
            ctaLabel: 'Read More',
        },
        {
            heroHeadline: 'Ideas Worth Sharing',
            heroSub: 'Deep dives into technology, business, and the future of work.',
            aboutBody: 'Written by industry practitioners, not just observers. Every article comes from real experience.',
            features: [
                { icon: '🔬', title: 'Deep Analysis', description: 'Go beyond the headlines with thorough research and data.' },
                { icon: '🎙️', title: 'Expert Interviews', description: 'Conversations with leaders shaping the industry.' },
                { icon: '📊', title: 'Case Studies', description: 'Real-world examples with actionable takeaways.' },
            ],
            testimonials: [
                { quote: 'The case studies alone are worth the subscription.', name: 'Mark T.', title: 'Product Manager', rating: 5 },
                { quote: 'Best writing on tech I\'ve found. No fluff, all substance.', name: 'Sara K.', title: 'Engineer', rating: 5 },
                { quote: 'Changed how I think about product development.', name: 'Leo C.', title: 'Founder', rating: 5 },
            ],
            contactSubtext: 'Have a story to tell? We\'d love to hear from you.',
            ctaLabel: 'Subscribe',
        },
        {
            heroHeadline: 'Your Daily Dose of Inspiration',
            heroSub: 'Bite-sized insights on design, code, and creativity delivered fresh.',
            aboutBody: 'Started as a personal journal, now a community of 10,000+ readers who believe in continuous learning.',
            features: [
                { icon: '☕', title: '5-Minute Reads', description: 'Quick insights you can absorb during your morning coffee.' },
                { icon: '🎨', title: 'Visual Guides', description: 'Complex topics explained with infographics and diagrams.' },
                { icon: '🗂️', title: 'Curated Resources', description: 'Hand-picked tools, books, and courses every week.' },
            ],
            testimonials: [
                { quote: 'Love the 5-minute format. Perfect for my commute!', name: 'Anita B.', title: 'Designer', rating: 5 },
                { quote: 'The visual guides make complex topics so accessible.', name: 'Chris D.', title: 'Student', rating: 5 },
                { quote: 'Best curated newsletter in the design space.', name: 'Yuki M.', title: 'UX Lead', rating: 5 },
            ],
            contactSubtext: 'Join our community of curious minds.',
            ctaLabel: 'Join Free',
        },
    ],
    business: [
        {
            heroHeadline: 'Professional Solutions for Your Business',
            heroSub: 'Innovative, effective, and scalable solutions tailored to your needs.',
            aboutBody: 'A team of experienced professionals committed to delivering solutions that drive sustainable growth.',
            features: [
                { icon: '🚀', title: 'Rapid Growth', description: 'Effective strategies with measurable results within 30 days.' },
                { icon: '🛡️', title: 'Safe & Reliable', description: 'Data security compliant with international standards.' },
                { icon: '🤝', title: '24/7 Support', description: 'Our team is always ready to assist you anytime.' },
            ],
            testimonials: [
                { quote: 'Revenue increased 40% within 3 months. Highly professional!', name: 'David H.', title: 'CEO, TechCo', rating: 5 },
                { quote: 'Solutions that fit perfectly. They really understand our needs.', name: 'Maya L.', title: 'Marketing Director', rating: 5 },
                { quote: 'Best business partner decision we ever made.', name: 'John S.', title: 'Operations Head', rating: 5 },
            ],
            contactSubtext: 'Contact us for a free consultation and detailed quote.',
            ctaLabel: 'Get Free Consultation',
        },
        {
            heroHeadline: 'Grow Smarter, Scale Faster',
            heroSub: 'Data-driven consulting that transforms businesses across Southeast Asia.',
            aboutBody: 'Founded in 2018, we\'ve helped 200+ companies streamline operations and accelerate growth across ASEAN.',
            features: [
                { icon: '📈', title: 'Growth Strategy', description: 'Custom roadmaps based on your market data and goals.' },
                { icon: '⚙️', title: 'Process Automation', description: 'Reduce manual work by 60% with smart automation.' },
                { icon: '🎯', title: 'Performance Tracking', description: 'Real-time dashboards to measure what matters.' },
            ],
            testimonials: [
                { quote: 'Automated our invoicing — saved 20 hours per week!', name: 'Tan A.', title: 'Finance Director', rating: 5 },
                { quote: 'Their strategy doubled our leads in 2 months.', name: 'Sarah W.', title: 'CMO', rating: 5 },
                { quote: 'Finally a consultant who delivers, not just advises.', name: 'Ravi K.', title: 'CEO', rating: 5 },
            ],
            contactSubtext: 'Schedule a strategy call — first session is free.',
            ctaLabel: 'Book Strategy Call',
        },
        {
            heroHeadline: 'Your Success Is Our Mission',
            heroSub: 'End-to-end business solutions from strategy to execution.',
            aboutBody: 'We don\'t just advise — we roll up our sleeves and build alongside you. 500+ projects delivered on time.',
            features: [
                { icon: '💼', title: 'Full-Service Agency', description: 'Marketing, tech, operations — everything under one roof.' },
                { icon: '🏆', title: 'Award-Winning Work', description: 'Recognized by industry leaders for innovation and results.' },
                { icon: '🌏', title: 'Regional Expertise', description: 'Deep knowledge of ASEAN markets and regulations.' },
            ],
            testimonials: [
                { quote: 'They handled our entire digital transformation. Seamless.', name: 'Patricia L.', title: 'Managing Director', rating: 5 },
                { quote: 'The only agency that treats our business like their own.', name: 'Hafiz M.', title: 'Founder', rating: 5 },
                { quote: 'ROI positive in month one. Exceeded all expectations.', name: 'Grace T.', title: 'VP Sales', rating: 5 },
            ],
            contactSubtext: 'Let\'s build something great together.',
            ctaLabel: 'Start a Conversation',
        },
    ],
}

// ─── Middle Block Pool ─────────────────────────────────────────────────
// Note: 'gallery' excluded — Payload schema requires upload (media relation),
// fallback cannot generate media records. Use industry blocks (review-cards,
// menu-display, etc.) for visual content instead.

const MIDDLE_BLOCK_POOL = ['about', 'features', 'stats', 'testimonials', 'faq', 'cta', 'newsletter', 'team'] as const

// ─── Industry-aware block injection (per category) ─────────────────────
// Each category gets 1-2 industry-specific blocks injected before the generic
// middle pool. Keeps fallback restaurant-aware, fitness-aware, etc.

const INDUSTRY_BLOCKS_FALLBACK: Record<BusinessIntent['type'], string[]> = {
    business: [],
    ecommerce: ['products-grid', 'review-cards'],
    restaurant: ['menu-display', 'booking-widget', 'review-cards'],
    portfolio: ['portfolio-grid'],
    blog: ['blog-list'],
}

// ─── Block Builders ────────────────────────────────────────────────────

function buildNavigation(name: string, variant: string): GeneratedBlock {
    return {
        blockType: 'navigation',
        variant,
        logoText: name,
        links: [
            { label: 'Home', url: '#' },
            { label: 'About', url: '#about' },
            { label: 'Services', url: '#features' },
            { label: 'Contact', url: '#contact' },
        ],
        ctaButton: { show: true, label: 'Get in Touch', url: '#contact' },
    }
}

function buildHero(name: string, content: ContentSet, variant: string): GeneratedBlock {
    return {
        blockType: 'hero',
        variant,
        headline: content.heroHeadline,
        subheadline: content.heroSub,
        ctaButtons: [
            { label: content.ctaLabel, url: '#contact', style: 'primary' },
            { label: 'Learn More', url: '#about', style: 'outline' },
        ],
        badge: { show: true, text: '✨ ' + name },
        overlay: variant === 'fullscreen' || variant === 'parallax',
        overlayOpacity: 0.4,
        height: '90vh',
    }
}

function buildMiddleBlock(
    blockType: string,
    name: string,
    content: ContentSet,
    variant: string,
): GeneratedBlock | null {
    switch (blockType) {
        case 'about':
            // Payload `about.body` is `textarea` (plain string), NOT richtext.
            // Passing a Lexical object here causes Payload to silently drop the
            // field and the about block renders empty. Always pass a string.
            return {
                blockType: 'about',
                variant,
                sectionLabel: 'About',
                headline: 'Our Story',
                body: content.aboutBody,
            }
        case 'features':
            return {
                blockType: 'features',
                variant,
                sectionLabel: 'Services',
                headline: 'What We Offer',
                subheadline: 'The core values we deliver to you',
                features: content.features,
            }
        case 'stats':
            return {
                blockType: 'stats',
                variant,
                headline: 'By the Numbers',
                stats: [
                    { value: '10', label: 'Years Experience', suffix: '+' },
                    { value: '5000', label: 'Happy Customers', suffix: '+' },
                    { value: '4.9', label: 'Average Rating' },
                    { value: '50', label: 'Awards Won', suffix: '+' },
                ],
            }
        case 'gallery':
            // Excluded from MIDDLE_BLOCK_POOL — kept here for callers that pass
            // 'gallery' explicitly. Returns null so the fallback never injects
            // an empty gallery section that renders as decorative dead space.
            // To enable gallery in fallback, generate media records first via
            // Unsplash + Payload media upload, then pass `image: { id }` refs.
            return null
        case 'testimonials': {
            const finalVariant = enforceMinContent('testimonials', variant, content.testimonials.length)
            return {
                blockType: 'testimonials',
                variant: finalVariant,
                headline: 'What Our Clients Say',
                testimonials: content.testimonials,
            }
        }
        case 'faq':
            // Payload `faq.faqs` (NOT `items`). Field name mismatch causes
            // Payload to silently drop the array and the faq block renders
            // an empty section. Always use the Payload field name `faqs`.
            return {
                blockType: 'faq',
                variant,
                headline: 'Frequently Asked Questions',
                faqs: [
                    { question: 'How do I get started?', answer: 'Simply contact us through the form below or give us a call. We\'ll guide you through everything.' },
                    { question: 'What are your operating hours?', answer: 'We are open Monday to Saturday, 9am to 6pm. Online support is available 24/7.' },
                    { question: 'Do you offer custom solutions?', answer: 'Yes! Every client gets a tailored solution designed specifically for their needs.' },
                    { question: 'What payment methods do you accept?', answer: 'We accept FPX, credit/debit cards, e-wallets, and bank transfers.' },
                ],
            }
        case 'cta':
            return {
                blockType: 'cta',
                variant,
                headline: 'Ready to Get Started?',
                subheadline: `Join thousands of satisfied customers who chose ${name}.`,
                ctaLabel: content.ctaLabel,
                ctaUrl: '#contact',
            }
        case 'newsletter':
            return {
                blockType: 'newsletter',
                variant,
                headline: 'Stay Updated',
                subheadline: 'Get the latest news and offers delivered to your inbox.',
                buttonLabel: 'Subscribe',
            }
        case 'team':
            return {
                blockType: 'team',
                variant,
                headline: 'Meet Our Team',
                members: [
                    { name: 'Alex Johnson', role: 'Founder & CEO', bio: 'Visionary leader with 15+ years of industry experience.' },
                    { name: 'Sarah Lee', role: 'Creative Director', bio: 'Award-winning designer passionate about user experience.' },
                    { name: 'Raj Patel', role: 'Head of Operations', bio: 'Keeps everything running smoothly behind the scenes.' },
                ],
            }

        // ── Industry-aware blocks ────────────────────────────────────────
        case 'menu-display':
            return {
                blockType: 'menu-display',
                variant: variant === 'simple' ? 'tabs' : variant,
                headline: 'Our Menu',
                subheadline: 'Crafted with the freshest ingredients',
                currency: 'RM',
                showDietaryIcons: true,
                categories: [
                    {
                        name: 'Starters',
                        items: [
                            { name: 'Crispy Spring Rolls', description: 'Hand-rolled with vegetables and glass noodles', price: 12, dietaryTags: ['vegetarian'] },
                            { name: 'Tom Yum Soup', description: 'Spicy and sour with prawns and lemongrass', price: 18, dietaryTags: ['spicy'] },
                            { name: 'Satay Skewers', description: 'Grilled marinated chicken with peanut sauce', price: 22, dietaryTags: ['halal'] },
                        ],
                    },
                    {
                        name: 'Mains',
                        items: [
                            { name: 'Nasi Lemak Special', description: 'Coconut rice with rendang, sambal, and crispy anchovies', price: 28, dietaryTags: ['halal', 'spicy'], isPopular: true },
                            { name: 'Pad Thai', description: 'Stir-fried rice noodles with prawns and peanuts', price: 24 },
                            { name: 'Vegetable Curry', description: 'Mixed vegetables in fragrant coconut curry', price: 22, dietaryTags: ['vegan', 'gluten-free'] },
                        ],
                    },
                    {
                        name: 'Desserts',
                        items: [
                            { name: 'Mango Sticky Rice', description: 'Sweet glutinous rice with fresh mango', price: 14, dietaryTags: ['vegetarian', 'gluten-free'] },
                            { name: 'Cendol', description: 'Pandan jelly with coconut milk and palm sugar', price: 12, dietaryTags: ['vegetarian'] },
                        ],
                    },
                ],
            }
        case 'booking-widget':
            return {
                blockType: 'booking-widget',
                variant: variant === 'simple' ? 'inline' : variant,
                headline: 'Book Your Visit',
                subheadline: 'Reserve your spot in just a few clicks',
                buttonLabel: 'Reserve Now',
                services: [
                    { name: 'Lunch Reservation', duration: '90 mins', price: '' },
                    { name: 'Dinner Reservation', duration: '120 mins', price: '' },
                    { name: 'Private Event', duration: '3 hours', price: 'On request' },
                ],
                showCalendar: true,
                showTimeSlots: true,
            }
        case 'review-cards':
            return {
                blockType: 'review-cards',
                variant: variant === 'simple' ? 'grid' : variant,
                headline: 'Loved by Our Customers',
                subheadline: 'Hear what they have to say',
                showAverage: true,
                totalReviewCount: 248,
                reviews: [
                    { name: 'Sarah M.', rating: 5, text: 'Absolutely incredible experience. The attention to detail blew us away — definitely coming back!', source: 'Google', date: '2 weeks ago', verified: true },
                    { name: 'Daniel L.', rating: 5, text: 'Best in town, hands down. Service was warm, food was fresh, atmosphere was perfect.', source: 'Tripadvisor', date: '1 month ago', verified: true },
                    { name: 'Aishah K.', rating: 4, text: 'Great food and lovely staff. Will definitely recommend to friends and family.', source: 'Google', date: '3 weeks ago', verified: true },
                    { name: 'Marcus T.', rating: 5, text: 'A hidden gem! Everything from starters to dessert was on point. 10/10 would visit again.', source: 'Facebook', date: '1 week ago', verified: true },
                ],
            }
        case 'products-grid':
            return {
                blockType: 'products-grid',
                variant: variant === 'simple' ? 'grid-3' : variant,
                headline: 'Featured Products',
                subheadline: 'Handpicked just for you',
                limit: 6,
            }
        case 'portfolio-grid':
            return {
                blockType: 'portfolio-grid',
                variant: variant === 'simple' ? 'masonry' : variant,
                headline: 'Recent Work',
                subheadline: 'A selection of projects we\'re proud of',
            }
        case 'blog-list':
            return {
                blockType: 'blog-list',
                variant: variant === 'simple' ? 'cards' : variant,
                headline: 'Latest Insights',
                subheadline: 'Tips, stories, and updates from our team',
                limit: 3,
            }

        default:
            return null
    }
}

function buildContact(name: string, content: ContentSet, variant: string): GeneratedBlock {
    return {
        blockType: 'contact',
        variant,
        headline: 'Get in Touch',
        subtext: content.contactSubtext,
        email: 'hello@' + name.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '') + '.com',
        phone: '(+60) 12-345 6789',
        formFields: [
            { fieldName: 'name', fieldType: 'text', label: 'Full Name', required: true },
            { fieldName: 'email', fieldType: 'email', label: 'Email', required: true },
            { fieldName: 'message', fieldType: 'textarea', label: 'Message', required: true },
        ],
    }
}

function buildFooter(name: string, heroSub: string, variant: string): GeneratedBlock {
    return {
        blockType: 'footer',
        variant,
        logoText: name,
        tagline: heroSub.substring(0, 60) + '...',
        columns: [
            {
                title: 'Links',
                links: [
                    { label: 'Home', url: '#' },
                    { label: 'About', url: '#about' },
                    { label: 'Services', url: '#features' },
                ],
            },
            {
                title: 'Support',
                links: [
                    { label: 'Contact', url: '#contact' },
                    { label: 'FAQ', url: '#' },
                    { label: 'Privacy Policy', url: '#' },
                ],
            },
        ],
        copyrightText: `© ${new Date().getFullYear()} ${name}. All rights reserved.`,
        socials: [
            { platform: 'facebook', url: '#' },
            { platform: 'instagram', url: '#' },
            { platform: 'whatsapp', url: '#' },
        ],
    }
}

// ─── Ordering Constraints ──────────────────────────────────────────────

/** Enforce ordering: A must come before B */
const ORDERING_DEPS: [string, string][] = [
    ['features', 'stats'],
    ['features', 'testimonials'],
    ['about', 'team'],
]

function enforceOrdering(blocks: GeneratedBlock[]): GeneratedBlock[] {
    const result = [...blocks]
    for (const [before, after] of ORDERING_DEPS) {
        const beforeIdx = result.findIndex(b => b.blockType === before)
        const afterIdx = result.findIndex(b => b.blockType === after)
        if (beforeIdx >= 0 && afterIdx >= 0 && beforeIdx > afterIdx) {
            // Swap: move 'before' block to just before 'after' block
            const [moved] = result.splice(beforeIdx, 1)
            const newAfterIdx = result.findIndex(b => b.blockType === after)
            result.splice(newAfterIdx, 0, moved!)
        }
    }
    return result
}

// ─── Main Generator ────────────────────────────────────────────────────

export function generateBlocks(prompt: string, seed?: number): GenerationResult {
    const rand = createSeededRandom(seed)
    const intent = parseIntent(prompt)

    // Pick random theme palette (3 options per category)
    const palettes = THEME_PALETTES[intent.type]
    const theme = pickRandom(palettes, rand)

    // Pick random content variation (3 options per category)
    const contentSets = CONTENT_VARIATIONS[intent.type]
    const content = pickRandom(contentSets, rand)

    // Pick random variants per block type
    const getVariant = (blockType: string): string => {
        const options = VARIANT_OPTIONS[blockType]
        return options ? pickRandom(options, rand) : 'simple'
    }

    // Build blocks
    const blocks: GeneratedBlock[] = []

    // 1. Navigation (always first)
    blocks.push(buildNavigation(intent.name, getVariant('navigation')))

    // 2. Hero (always second)
    blocks.push(buildHero(intent.name, content, getVariant('hero')))

    // 3. Industry blocks — inject category-specific blocks BEFORE generic pool
    // For restaurant → menu-display, booking-widget, review-cards
    // For ecommerce → products-grid, review-cards, etc.
    const industryBlockTypes = INDUSTRY_BLOCKS_FALLBACK[intent.type] ?? []
    const industryBlocks: GeneratedBlock[] = []
    for (const blockType of industryBlockTypes) {
        const variant = getVariant(blockType)
        const block = buildMiddleBlock(blockType, intent.name, content, variant)
        if (block) industryBlocks.push(block)
    }

    // 4. Generic middle blocks — pick 3-4 from pool, shuffle
    // (Reduced from 4-6 since industry blocks already fill some slots)
    const middleCount = 3 + Math.floor(rand() * 2) // 3-4 blocks
    const selectedMiddle = shuffleArray([...MIDDLE_BLOCK_POOL], rand).slice(0, middleCount)

    const middleBlocks: GeneratedBlock[] = []
    for (const blockType of selectedMiddle) {
        const variant = getVariant(blockType)
        const block = buildMiddleBlock(blockType, intent.name, content, variant)
        if (block) middleBlocks.push(block)
    }

    // Combine: industry blocks first, then generic middle
    const allMiddle = [...industryBlocks, ...middleBlocks]

    // Enforce ordering constraints (features before stats, about before team)
    const orderedMiddle = enforceOrdering(allMiddle)
    blocks.push(...orderedMiddle)

    // 5. Contact (always second-to-last)
    blocks.push(buildContact(intent.name, content, getVariant('contact')))

    // 6. Footer (always last)
    blocks.push(buildFooter(intent.name, content.heroSub, getVariant('footer')))

    // Phase 04 content validation — apply same rules as AI/composer paths.
    // Catches blocked CTA labels, oversized headlines, generic filler copy.
    // Auto-fixes are merged; warnings logged via console.warn.
    const validatedBlocks = blocks.map((b) =>
        applyContentValidation(b as Record<string, unknown>, 'en') as GeneratedBlock,
    )

    return {
        siteName: intent.name,
        siteType: intent.type,
        blocks: validatedBlocks,
        seo: {
            title: `${intent.name} — ${content.heroHeadline}`,
            description: content.heroSub,
        },
        theme,
    }
}

// Types already exported at their declaration — line above is intentional noop.
