/**
 * Rule-based AI Block Generator (Phase 1)
 * Parses user prompt → generates blocks JSON matching Pages collection schema.
 * Phase 2 will replace this with real LLM calls.
 *
 * Target Market: Malaysia (EN / MS)
 * All content is in English. Vietnamese keywords kept in TYPE_KEYWORDS for backward compat.
 */

// ─── Types ──────────────────────────────────────────────────────────────

type BusinessIntent = {
    name: string
    type: 'business' | 'ecommerce' | 'restaurant' | 'portfolio' | 'blog'
    description: string
    style: 'modern' | 'classic' | 'minimal' | 'bold'
}

type GeneratedBlock = {
    blockType: string
    [key: string]: unknown
}

type GenerationResult = {
    siteName: string
    siteType: BusinessIntent['type']
    blocks: GeneratedBlock[]
    seo: { title: string; description: string }
    language?: 'en' | 'ms' | 'vi'
    theme: {
        primaryColor: string
        secondaryColor: string
        fontHeading: string
        fontBody: string
        colorMode: 'light' | 'dark'
    }
}

// ─── Intent Parser ──────────────────────────────────────────────────────

const TYPE_KEYWORDS: Record<BusinessIntent['type'], string[]> = {
    restaurant: ['restaurant', 'cafe', 'coffee', 'bakery', 'food', 'dining', 'bistro', 'pizza', 'sushi', 'bar', 'kedai makan', 'restoran'],
    ecommerce: ['shop', 'store', 'fashion', 'beauty', 'cosmetic', 'ecommerce', 'retail', 'boutique', 'kedai', 'online store'],
    portfolio: ['portfolio', 'freelance', 'photographer', 'designer', 'artist', 'personal', 'cv', 'resume', 'creative'],
    blog: ['blog', 'news', 'magazine', 'content', 'journal', 'editorial'],
    business: ['company', 'agency', 'service', 'startup', 'tech', 'consulting', 'marketing', 'spa', 'gym', 'fitness', 'clinic', 'dental', 'real estate', 'property'],
}

const THEME_PALETTES: Record<BusinessIntent['type'], GenerationResult['theme']> = {
    restaurant: { primaryColor: '#D97706', secondaryColor: '#92400E', fontHeading: 'Playfair Display', fontBody: 'Inter', colorMode: 'light' },
    ecommerce: { primaryColor: '#0EA5E9', secondaryColor: '#6366F1', fontHeading: 'DM Sans', fontBody: 'Inter', colorMode: 'light' },
    portfolio: { primaryColor: '#F43F5E', secondaryColor: '#8B5CF6', fontHeading: 'Outfit', fontBody: 'DM Sans', colorMode: 'dark' },
    blog: { primaryColor: '#10B981', secondaryColor: '#3B82F6', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
    business: { primaryColor: '#3B82F6', secondaryColor: '#8B5CF6', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
}

function parseIntent(prompt: string): BusinessIntent {
    const lower = prompt.toLowerCase()

    // Extract business name (look for quoted text, "called", or capitalize words)
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

    // Detect business type
    let type: BusinessIntent['type'] = 'business'
    let maxScore = 0
    for (const [bizType, keywords] of Object.entries(TYPE_KEYWORDS)) {
        const score = keywords.filter(kw => lower.includes(kw)).length
        if (score > maxScore) {
            maxScore = score
            type = bizType as BusinessIntent['type']
        }
    }

    // Detect style
    let style: BusinessIntent['style'] = 'modern'
    if (lower.includes('minimal') || lower.includes('clean')) style = 'minimal'
    else if (lower.includes('classic') || lower.includes('elegant') || lower.includes('traditional')) style = 'classic'
    else if (lower.includes('bold') || lower.includes('vibrant') || lower.includes('strong')) style = 'bold'

    return { name, type, description: prompt, style }
}

// ─── Content Templates ──────────────────────────────────────────────────

const CONTENT: Record<BusinessIntent['type'], {
    heroHeadline: string
    heroSub: string
    aboutHeadline: string
    aboutBody: string
    features: Array<{ icon: string; title: string; description: string }>
    testimonials: Array<{ quote: string; name: string; title: string; rating: number }>
    contactSubtext: string
}> = {
    restaurant: {
        heroHeadline: 'Authentic Flavours, Unforgettable Experiences',
        heroSub: 'Savour dishes crafted from the freshest ingredients in a warm, elegant setting that makes every meal memorable.',
        aboutHeadline: 'Our Story',
        aboutBody: 'With a passion for culinary excellence and over 10 years of experience, we bring you unforgettable dining moments. Every dish is meticulously prepared with hand-selected ingredients.',
        features: [
            { icon: '🍳', title: 'Expert Chefs', description: 'Our team of chefs brings over a decade of experience from award-winning restaurants.' },
            { icon: '🥬', title: 'Fresh Ingredients', description: 'Carefully sourced ingredients from trusted local and international suppliers.' },
            { icon: '🎵', title: 'Elegant Ambience', description: 'Modern design with soothing music — the perfect setting for any occasion.' },
        ],
        testimonials: [
            { quote: 'Absolutely amazing food! The atmosphere is beautiful and the staff is incredibly attentive.', name: 'Sarah L.', title: 'Food Blogger', rating: 5 },
            { quote: 'Every visit is a delight. Consistent quality and great value for money.', name: 'James T.', title: 'Entrepreneur', rating: 5 },
        ],
        contactSubtext: 'Book a table or contact us today to host your special event.',
    },
    ecommerce: {
        heroHeadline: 'Quality Products, Best Prices',
        heroSub: 'Explore our diverse collection of thousands of authentic products. Fast delivery, hassle-free returns.',
        aboutHeadline: 'About Us',
        aboutBody: 'We are committed to delivering the best shopping experience. With our "Quality First" promise, every product is carefully inspected before it reaches your doorstep.',
        features: [
            { icon: '🚚', title: 'Fast Delivery', description: 'Free shipping on orders above RM150. Receive your items within 1-3 business days.' },
            { icon: '🔄', title: 'Easy Returns', description: 'Hassle-free returns within 30 days if you are not completely satisfied.' },
            { icon: '💎', title: '100% Authentic', description: 'Guaranteed authentic products with verified origins and certifications.' },
        ],
        testimonials: [
            { quote: 'Shopping here is stress-free. Products look exactly like the photos, delivery is fast.', name: 'Aina R.', title: 'VIP Customer', rating: 5 },
            { quote: 'Excellent customer service and great product advice. Will definitely return!', name: 'Ahmad K.', title: 'Customer', rating: 5 },
        ],
        contactSubtext: 'Need help? Get in touch with our support team anytime.',
    },
    portfolio: {
        heroHeadline: 'Creative Work That Inspires',
        heroSub: 'I create meaningful digital experiences through thoughtful design and clean code.',
        aboutHeadline: 'About Me',
        aboutBody: 'I am a passionate creative professional with years of experience in crafting beautiful, functional digital products. I believe in the power of design to transform ideas into impactful experiences.',
        features: [
            { icon: '🎨', title: 'UI/UX Design', description: 'Creating intuitive user interfaces with a focus on user experience and visual appeal.' },
            { icon: '💻', title: 'Web Development', description: 'Building responsive, performant websites using modern frameworks and best practices.' },
            { icon: '📱', title: 'Mobile Apps', description: 'Designing and developing cross-platform mobile applications.' },
        ],
        testimonials: [
            { quote: 'Absolutely outstanding work. Delivered beyond expectations and was great to collaborate with.', name: 'Sarah Chen', title: 'CEO, TechStart', rating: 5 },
            { quote: 'Professional, creative, and incredibly talented. Highly recommended!', name: 'James Wilson', title: 'Marketing Director', rating: 5 },
        ],
        contactSubtext: 'Got a project in mind? Let\'s chat and bring your vision to life.',
    },
    blog: {
        heroHeadline: 'Discover Knowledge Every Day',
        heroSub: 'A space for sharing stories, insights, and inspiration for a better life and career.',
        aboutHeadline: 'About This Blog',
        aboutBody: 'Welcome to our blog — a curated collection of quality articles on technology, lifestyle, and personal growth.',
        features: [
            { icon: '📝', title: 'Quality Articles', description: 'Well-researched content that stays current with the latest trends and insights.' },
            { icon: '🎯', title: 'Diverse Topics', description: 'From technology and marketing to personal development and productivity.' },
            { icon: '💡', title: 'Practical Knowledge', description: 'Real-world experience you can apply immediately to your work and life.' },
        ],
        testimonials: [
            { quote: 'The articles are insightful and practical. I can apply them right away!', name: 'Daniel W.', title: 'Developer', rating: 5 },
            { quote: 'One of the best blogs I follow for tech and productivity content.', name: 'Lisa M.', title: 'Content Creator', rating: 5 },
        ],
        contactSubtext: 'Want to collaborate or contribute articles? Get in touch!',
    },
    business: {
        heroHeadline: 'Professional Solutions for Your Business',
        heroSub: 'We help your business grow with innovative, effective, and scalable solutions tailored to your needs.',
        aboutHeadline: 'Why Choose Us',
        aboutBody: 'With a team of experienced professionals, we are committed to delivering the best solutions — helping your business save costs and achieve sustainable growth.',
        features: [
            { icon: '🚀', title: 'Rapid Growth', description: 'Effective growth strategies with measurable results within 30 days.' },
            { icon: '🛡️', title: 'Safe & Reliable', description: 'Absolute data security, compliant with international standards and best practices.' },
            { icon: '🤝', title: '24/7 Support', description: 'Our support team is always ready to assist you anytime, anywhere.' },
        ],
        testimonials: [
            { quote: 'Revenue increased 40% within 3 months of using the service. Highly professional!', name: 'David H.', title: 'CEO, TechCo', rating: 5 },
            { quote: 'The consulting team really understands our needs. Solutions that fit perfectly.', name: 'Maya L.', title: 'Marketing Director', rating: 5 },
        ],
        contactSubtext: 'Contact us today for a free consultation and detailed quote.',
    },
}

// ─── Block Generator ────────────────────────────────────────────────────

export function generateBlocks(prompt: string): GenerationResult {
    const intent = parseIntent(prompt)
    const content = CONTENT[intent.type]
    const theme = THEME_PALETTES[intent.type]

    const blocks: GeneratedBlock[] = [
        // 1. Navigation
        {
            blockType: 'navigation',
            style: 'fixed',
            logoText: intent.name,
            links: [
                { label: 'Home', url: '#' },
                { label: 'About', url: '#about' },
                { label: 'Services', url: '#features' },
                { label: 'Contact', url: '#contact' },
            ],
            ctaButton: { show: true, label: 'Get in Touch', url: '#contact' },
        },

        // 2. Hero
        {
            blockType: 'hero',
            variant: 'centered',
            headline: content.heroHeadline,
            subheadline: content.heroSub,
            ctaButtons: [
                { label: 'Get Started', url: '#contact', style: 'primary' },
                { label: 'Learn More', url: '#about', style: 'outline' },
            ],
            badge: { show: true, text: '✨ ' + intent.name },
        },

        // 3. About
        {
            blockType: 'about',
            layout: 'image-right',
            sectionLabel: 'About',
            headline: content.aboutHeadline,
            body: { root: { children: [{ type: 'paragraph', children: [{ text: content.aboutBody }] }] } },
        },

        // 4. Features
        {
            blockType: 'features',
            sectionLabel: 'Services',
            headline: 'What We Offer',
            subheadline: 'The core values we deliver to you',
            layout: 'grid-3',
            features: content.features,
        },

        // 5. Testimonials
        {
            blockType: 'testimonials',
            headline: 'What Our Clients Say',
            variant: 'grid',
            testimonials: content.testimonials,
        },

        // 6. Contact
        {
            blockType: 'contact',
            headline: 'Get in Touch',
            subtext: content.contactSubtext,
            email: 'hello@' + intent.name.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]/g, '') + '.com',
            phone: '(+60) 12-345 6789',
            formFields: [
                { fieldName: 'name', fieldType: 'text', label: 'Full Name', required: true },
                { fieldName: 'email', fieldType: 'email', label: 'Email', required: true },
                { fieldName: 'message', fieldType: 'textarea', label: 'Message', required: true },
            ],
        },

        // 7. Footer
        {
            blockType: 'footer',
            logoText: intent.name,
            tagline: content.heroSub.substring(0, 60) + '...',
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
            copyrightText: `© ${new Date().getFullYear()} ${intent.name}. All rights reserved.`,
            showSocialLinks: true,
        },
    ]

    return {
        siteName: intent.name,
        siteType: intent.type,
        blocks,
        seo: {
            title: `${intent.name} — ${content.heroHeadline}`,
            description: content.heroSub,
        },
        theme,
    }
}

export type { GenerationResult, BusinessIntent }
