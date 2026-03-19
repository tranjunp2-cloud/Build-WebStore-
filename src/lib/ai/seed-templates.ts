/**
 * 10 Industry-Based Template Definitions
 * Each template has industry-specific sections/blocks and theme.
 * Target Market: Malaysia (EN / MS)
 */

export interface TemplateSeed {
    name: string
    description: string
    category: string[]
    defaultTheme: {
        primaryColor: string
        secondaryColor: string
        fontHeading: string
        fontBody: string
        colorMode: 'light' | 'dark'
    }
    defaultBlocks: any[]
    pages?: {
        slug: string
        title: string
        layout: any[]
    }[]
    tags: { tag: string }[]
    sortOrder: number
    isPremium: boolean
    isFeatured: boolean
}

// Helper to build nav block
const nav = (logo: string, links: string[], cta: string) => ({
    blockType: 'navigation', style: 'fixed',
    logoText: logo, links: links.map(l => ({ label: l, url: '#' })),
    ctaButton: { show: true, label: cta, url: '#' },
})

// Helper to build hero block
const hero = (h: string, sub: string, cta1: string, cta2?: string, variant = 'centered') => ({
    blockType: 'hero', variant, headline: h, subheadline: sub,
    badge: { show: true, text: '✨ Welcome' },
    ctaButtons: [
        { label: cta1, url: '#', style: 'primary' },
        ...(cta2 ? [{ label: cta2, url: '#', style: 'outline' }] : []),
    ],
})

// Helper to build features block
const features = (h: string, sub: string, items: { icon: string; title: string; desc: string }[], label?: string) => ({
    blockType: 'features', layout: 'grid-3', headline: h, subheadline: sub,
    sectionLabel: label || 'Services',
    features: items.map(i => ({ icon: i.icon, title: i.title, description: i.desc })),
})

// Helper for testimonials
const testimonials = (h: string, items: { name: string; quote: string; title?: string }[]) => ({
    blockType: 'testimonials', headline: h,
    testimonials: items.map(i => ({ name: i.name, quote: i.quote, rating: 5, title: i.title || '', company: '' })),
})

// Helper for contact
const contact = (h: string, email: string, phone: string, addr: string) => ({
    blockType: 'contact', headline: h, subtext: 'Get in touch today for a consultation',
    email, phone, address: addr,
    formFields: [
        { label: 'Full Name', fieldType: 'text', required: true, placeholder: 'Enter your name' },
        { label: 'Email', fieldType: 'email', required: true, placeholder: 'email@example.com' },
        { label: 'Phone Number', fieldType: 'phone', required: false, placeholder: '+60 12-345 6789' },
        { label: 'Message', fieldType: 'textarea', required: true, placeholder: 'Your message...' },
    ],
})

// Helper for footer
const footer = (logo: string, tagline: string, cols: { title: string; links: string[] }[]) => ({
    blockType: 'footer', logoText: logo, tagline,
    copyrightText: `© 2026 ${logo}. All rights reserved.`,
    columns: cols.map(c => ({ title: c.title, links: c.links.map(l => ({ label: l, url: '#' })) })),
})

// Helper for stats
const stats = (h: string, items: { value: string; label: string }[]) => ({
    blockType: 'stats', headline: h,
    stats: items.map(i => ({ value: i.value, label: i.label })),
})

// Helper for about
const about = (h: string, body: string, label?: string) => ({
    blockType: 'about', headline: h, body, sectionLabel: label || 'About Us', layout: 'image-right',
})

// Helper for CTA
const cta = (h: string, sub: string, label: string) => ({
    blockType: 'cta', headline: h, subheadline: sub, ctaLabel: label, ctaUrl: '#', ctaStyle: 'primary',
})

// Helper for pricing
const pricing = (h: string, sub: string, plans: { name: string; price: string; desc: string; features: string[] }[]) => ({
    blockType: 'pricing', headline: h, subheadline: sub,
    plans: plans.map((p, i) => ({
        name: p.name, price: p.price, description: p.desc,
        features: p.features.map(f => ({ text: f, included: true })),
        isPopular: i === 1, ctaLabel: 'Choose Plan', ctaUrl: '#',
    })),
})

// Helper for FAQ
const faq = (h: string, items: { q: string; a: string }[]) => ({
    blockType: 'faq', headline: h,
    faqs: items.map(i => ({ question: i.q, answer: i.a })),
})

// Helper for gallery
const gallery = (h: string, count: number) => ({
    blockType: 'gallery', headline: h,
    images: Array.from({ length: count }, (_, i) => ({ caption: `Photo ${i + 1}` })),
})

// Helper for team
const team = (h: string, members: { name: string; role: string }[]) => ({
    blockType: 'team', headline: h,
    members: members.map(m => ({ name: m.name, role: m.role, bio: '' })),
})

// ─── PAGE HELPERS ───────────────────────────────────────────────────

const aboutPage = (name: string, industry: string, logoText: string) => [
    nav(logoText, ['Home', 'About', 'Products', 'Contact'], 'Get Started'),
    {
        blockType: 'about',
        layout: 'image-right',
        sectionLabel: 'Our Story',
        headline: `The Passion Behind ${name}`,
        body: [
            {
                children: [
                    { text: `Founded with a vision to revolutionize the ${industry} industry, ${name} has grown from a small passionate team to a leader in the field. We believe in quality, innovation, and customer satisfaction above all else.` },
                ],
            },
        ],
    },
    {
        blockType: 'stats',
        headline: 'Our Impact in Numbers',
        stats: [
            { value: '10+', label: 'Years of Excellence' },
            { value: '5k+', label: 'Happy Clients' },
            { value: '150+', label: 'Expert Staff' },
            { value: '25+', label: 'Global Awards' },
        ],
    },
    {
        blockType: 'team',
        headline: 'Meet Our Visionaries',
        members: [
            { name: 'Sarah Johnson', role: 'Founder & CEO', bio: 'Visionary leader with 15+ years in the industry.' },
            { name: 'Michael Chen', role: 'Head of Operations', bio: 'Operational expert focused on efficiency and scale.' },
        ],
    },
    footer(logoText, `Leading the way in ${industry}.`, [
        { title: 'Company', links: ['Our Story', 'Careers', 'Press'] },
    ]),
]

const productsPage = (name: string, industry: string, logoText: string, featuresList: any[]) => [
    nav(logoText, ['Home', 'About', 'Products', 'Contact'], 'Get Started'),
    {
        blockType: 'hero',
        variant: 'centered',
        headline: 'Our Premium Offerings',
        subheadline: `Explore the range of high-quality products and services we provide to the ${industry} market.`,
        ctaButtons: [{ label: 'View Pricing', url: '#pricing', style: 'primary' }],
    },
    {
        blockType: 'features',
        layout: 'grid-3',
        headline: 'Why Choose Our Solutions',
        features: featuresList,
    },
    {
        blockType: 'pricing',
        headline: 'Transparent Pricing',
        subheadline: 'Choose the plan that fits your business needs.',
        plans: [
            { name: 'Starter', price: '$49', description: 'Perfect for small businesses.', features: [{ text: 'Access to basic features' }, { text: 'Email support' }] },
            { name: 'Professional', price: '$149', description: 'Advanced tools for growing teams.', features: [{ text: 'Everything in Starter' }, { text: 'Priority support' }, { text: 'Custom analytics' }], isPopular: true },
        ],
    },
    footer(logoText, `Quality ${industry} solutions.`, [
        { title: 'Information', links: ['Pricing', 'Docs', 'Support'] },
    ]),
]

const contactPage = (name: string, industry: string, logoText: string, email: string, phone: string, address: string) => [
    nav(logoText, ['Home', 'About', 'Products', 'Contact'], 'Get Started'),
    {
        blockType: 'contact',
        headline: 'Get In Touch',
        subtext: `Have questions about our ${industry} services? We're here to help you 24/7.`,
        email: email,
        phone: phone,
        address: address,
        showMap: true,
        mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3983.788094285148!2d101.711818315252!3d3.157905997700445!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31cc37d12d669443%3A0xca794ada413b561c!2sPetronas%20Twin%20Towers!5e0!3m2!1sen!2smy!4v1652159000000!5m2!1sen!2smy',
    },
    {
        blockType: 'faq',
        headline: 'Common Questions',
        faqs: [
            { question: 'How do I start?', answer: 'Simply fill out the form above or call us directly.' },
            { question: 'What are your hours?', answer: 'We are open Monday to Friday, 9am to 6pm.' },
        ],
    },
    footer(logoText, `We're here for you.`, [
        { title: 'Contact', links: ['Email Us', 'Find Us', 'Support'] },
    ]),
]

export const SEED_TEMPLATES: TemplateSeed[] = [
    // ─── 1. RESTAURANT / CAFE / F&B ─────────────────────────────────────
    {
        name: 'The Rustic Kitchen',
        description: 'Warm and inviting template for local restaurants and family-run cafes.',
        category: ['restaurant'],
        defaultTheme: { primaryColor: '#8B4513', secondaryColor: '#D2B48C', fontHeading: 'Playfair Display', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('Rustic Kitchen', ['Home', 'Menu', 'About', 'Contact'], 'Book a Table'),
            hero('Traditional Flavours, Modern Twist', 'Experience the finest local ingredients prepared with love and passion.', 'View Menu', 'Our Story', 'split-left'),
            features('Our Specialities', 'Signature dishes from our head chef', [
                { icon: '🥘', title: 'Farm-to-Table', desc: 'Sourced daily from local organic farms for the freshest experience.' },
                { icon: '🍷', title: 'Fine Wines', desc: 'Curated selection of world-class wines to complement your meal.' },
                { icon: '👨‍🍳', title: 'Expert Chefs', desc: 'Our team has over 20 years of combined culinary excellence.' },
            ], 'Menu'),
            stats('Our Journey', [
                { value: '15+', label: 'Years Experience' }, { value: '10k+', label: 'Happy Diners' },
                { value: '25', label: 'Signature Dishes' }, { value: '4.9', label: 'Google Rating' },
            ]),
            testimonials('What Diners Say', [
                { name: 'James W.', quote: 'The best steak I have ever had! The atmosphere was simply magical.', title: 'Food Critic' },
                { name: 'Siti R.', quote: 'Perfect place for family gatherings. Highly recommend the lamb shank.', title: 'Local Regular' },
            ]),
            cta('🍲 Ready for an Unforgettable Meal?', 'Book your table online today and get a complimentary appetizer!', 'Book Now'),
            contact('Find Us', 'hello@rustickitchen.com', '+60 3-1234 5678', '123 Jalan Ampang, Kuala Lumpur'),
            footer('Rustic Kitchen', 'Traditional flavours, modern twist.', [
                { title: 'Dining', links: ['Lunch Menu', 'Dinner Menu', 'Private Events'] },
                { title: 'Quick Links', links: ['About Us', 'Contact', 'Reservations'] },
            ]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] }, // Will handle in script to use defaultBlocks
            { slug: 'about', title: 'About us', layout: aboutPage('The Rustic Kitchen', 'Culinary', 'Rustic Kitchen') },
            { 
                slug: 'products', 
                title: 'Menu & Services', 
                layout: productsPage('The Rustic Kitchen', 'Culinary', 'Rustic Kitchen', [
                    { icon: '🍳', title: 'Breakfast', description: 'Energy-packed meals to start your day.' },
                    { icon: '🥗', title: 'Lunch Specials', description: 'Quick and healthy options for busy professionals.' },
                    { icon: '🍖', title: 'Grand Dinner', description: 'The ultimate dining experience under the stars.' },
                ]) 
            },
            { slug: 'contact', title: 'Contact Us', layout: contactPage('The Rustic Kitchen', 'Culinary', 'Rustic Kitchen', 'hello@rustickitchen.com', '+60 3-1234 5678', '123 Jalan Ampang, Kuala Lumpur') },
        ],
        tags: [{ tag: 'restaurant' }, { tag: 'cafe' }, { tag: 'f&b' }, { tag: 'food' }],
        sortOrder: 1, isPremium: false, isFeatured: true,
    },

    // ─── 2. SHOP / FASHION / E-COMMERCE ────────────────────────────────
    {
        name: 'Shop / Fashion / E-commerce',
        description: 'Template for online shops, fashion boutiques, and retail with products and shopping policies.',
        category: ['ecommerce'],
        defaultTheme: { primaryColor: '#E11D48', secondaryColor: '#BE123C', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Sample Shop', ['Home', 'Products', 'Collections', 'Contact'], 'Shop Now'),
            hero('Latest Fashion, Your Style', 'Discover our latest collection with unique designs and premium materials.', 'View Products', 'Up to 50% Off'),
            features('Featured Products', 'Our most loved collection', [
                { icon: '👗', title: 'Evening Gowns', desc: 'Elegant evening dresses, exclusive designs.' },
                { icon: '👜', title: 'Premium Handbags', desc: 'Genuine leather handbags, modern style.' },
                { icon: '👟', title: 'Sneakers', desc: 'Comfortable sports shoes, trendy every season.' },
                { icon: '💎', title: 'Accessories', desc: 'Jewellery and fashion accessories.' },
            ], 'Collection'),
            stats('Achievements', [
                { value: '10,000+', label: 'Products' }, { value: '50,000+', label: 'Customers' },
                { value: '98%', label: 'Satisfaction' }, { value: '24h', label: 'Delivery' },
            ]),
            features('Shopping Policies', 'Our commitment to you', [
                { icon: '🚚', title: 'Free Shipping', desc: 'Free delivery for orders above RM150.' },
                { icon: '🔄', title: '30-Day Returns', desc: 'Hassle-free returns within 30 days.' },
                { icon: '✅', title: '100% Authentic', desc: 'Guaranteed genuine products with warranty.' },
            ], 'Guarantee'),
            testimonials('Customer Reviews', [
                { name: 'Nurul A.', quote: 'Excellent quality, fast delivery. Will buy again!', title: 'VIP Customer' },
                { name: 'Ahmad K.', quote: 'Beautiful designs, perfect fit. Very satisfied.', title: 'Customer' },
            ]),
            cta('🔥 Flash Sale — Up to 50% Off', 'This week only! Hurry while stocks last.', 'Shop Now'),
            contact('Shopping Support', 'shop@sample.com', '+60 12-345 6789', '456 Jalan Tun Razak, KL'),
            footer('Sample Shop', 'Authentic fashion, nationwide delivery.', [
                { title: 'Shopping', links: ['New Arrivals', 'Best Sellers', 'Sale'] },
                { title: 'Support', links: ['Returns', 'Shipping', 'Payment'] },
            ]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Our Brand', layout: aboutPage('Mode Fashion', 'Sustainable Fashion', 'Mode') },
            { 
                slug: 'products', 
                title: 'Collections', 
                layout: productsPage('Mode Fashion', 'E-commerce', 'Mode', [
                    { icon: '🧥', title: 'Winter Coats', description: 'Warmth meets style in our premium outerwear.' },
                    { icon: '👟', title: 'Eco-Sneakers', description: 'Sustainable footwear for the modern explorer.' },
                    { icon: '🎒', title: 'Accessories', description: 'The perfect finishing touch for any outfit.' },
                ]) 
            },
            { slug: 'contact', title: 'Contact Us', layout: contactPage('Mode Fashion', 'E-commerce', 'Mode', 'shop@mode.com', '+60 12-345 6789', '456 Fashion Ave, KL') },
        ],
        tags: [{ tag: 'shop' }, { tag: 'fashion' }, { tag: 'ecommerce' }],
        sortOrder: 2, isPremium: false, isFeatured: true,
    },

    // ─── 3. BEAUTY / SPA / WELLNESS ─────────────────────────────────────
    {
        name: 'Beauty / Spa / Wellness',
        description: 'Template for spas, salons, and beauty centres with service pricing and appointments.',
        category: ['beauty'],
        defaultTheme: { primaryColor: '#D946EF', secondaryColor: '#A855F7', fontHeading: 'Cormorant Garamond', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Beauty Spa', ['Home', 'Services', 'Pricing', 'Book Now'], 'Book Now'),
            hero('Radiate Your Natural Beauty', 'Experience premium beauty treatments that help you feel confident and radiant every day.', 'Book Now', 'View Services', 'split-left'),
            pricing('Service Pricing', 'Choose the package that suits you', [
                { name: 'Basic', price: 'RM99', desc: 'Basic facial treatment', features: ['Deep cleansing', 'Face mask', '15-min facial massage'] },
                { name: 'Premium', price: 'RM199', desc: 'Complete care package', features: ['Deep cleansing', 'Skin peel', 'Collagen mask', '30-min massage', 'Hand care'] },
                { name: 'VIP', price: 'RM399', desc: 'Ultimate experience', features: ['Full premium combo', 'Laser treatment', '60-min body massage', 'Complimentary products'] },
            ]),
            gallery('Space & Results', 6),
            testimonials('Happy Clients', [
                { name: 'Siti N.', quote: 'My skin improved dramatically after 3 sessions. The staff is wonderful!', title: 'VIP Client' },
                { name: 'Lily C.', quote: 'Relaxing ambience, professional service. 10/10!', title: 'Beauty Blogger' },
            ]),
            cta('✨ First Visit — 30% Off', 'For new customers. Book your appointment today!', 'Book Now'),
            contact('Appointments & Enquiries', 'hello@beautyspa.my', '+60 3-9876 5432', '789 Jalan Ampang, KL'),
            footer('Beauty Spa', 'Where your natural beauty shines.', [
                { title: 'Services', links: ['Skin Care', 'Body Spa', 'Nails', 'Hair'] },
                { title: 'Working Hours', links: ['Mon-Sat: 09:00 - 20:00', 'Sun: 10:00 - 18:00'] },
            ]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Our Spa', layout: aboutPage('Zen Beauty', 'Wellness', 'Zen Spa') },
            { 
                slug: 'products', 
                title: 'Treatments', 
                layout: productsPage('Zen Beauty', 'Beauty', 'Zen Spa', [
                    { icon: '💆', title: 'Deep Massage', description: 'Release tension with our therapeutic sessions.' },
                    { icon: '💅', title: 'Nail Art', description: 'Professional manicures and creative designs.' },
                    { icon: '🧖', title: 'Facial Spa', description: 'Rejuvenate your skin with organic minerals.' },
                ]) 
            },
            { slug: 'contact', title: 'Bookings', layout: contactPage('Zen Beauty', 'Beauty', 'Zen Spa', 'relax@zenspa.my', '+60 3-9876 5432', '789 Zen Garden, KL') },
        ],
        tags: [{ tag: 'spa' }, { tag: 'beauty' }, { tag: 'wellness' }],
        sortOrder: 3, isPremium: false, isFeatured: true,
    },

    // ─── 4. TECH / IT / SAAS ──────────────────────────────────────────
    {
        name: 'Tech / IT / SaaS',
        description: 'Template for tech companies, SaaS startups with features, pricing plans, and FAQ.',
        category: ['tech'],
        defaultTheme: { primaryColor: '#3B82F6', secondaryColor: '#6366F1', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('TechCo', ['Home', 'Features', 'Pricing', 'Contact'], 'Free Trial'),
            hero('Smart Technology Solutions', 'Optimise your business processes with AI and leading-edge automation.', 'Start Free Trial', 'View Demo', 'centered'),
            features('Key Features', 'Cutting-edge technology for modern businesses', [
                { icon: '🤖', title: 'Smart AI', desc: 'Artificial intelligence that analyses data and delivers optimal decisions.' },
                { icon: '⚡', title: 'Automation', desc: 'Automate processes and save 80% of operational time.' },
                { icon: '🔒', title: 'Enterprise Security', desc: 'End-to-end encryption, ISO 27001 compliant.' },
                { icon: '📊', title: 'Realtime Analytics', desc: 'Intuitive dashboard with real-time reporting.' },
            ], 'Features'),
            stats('Impressive Numbers', [
                { value: '500+', label: 'Businesses' }, { value: '99.9%', label: 'Uptime' },
                { value: '10M+', label: 'Transactions/Day' }, { value: '24/7', label: 'Support' },
            ]),
            pricing('Pricing', 'Flexible plans for every scale', [
                { name: 'Starter', price: '$9/mo', desc: 'For individuals', features: ['1,000 requests/day', '5GB storage', 'Email support'] },
                { name: 'Pro', price: '$29/mo', desc: 'For teams', features: ['50,000 requests/day', '100GB storage', 'Priority support', 'API access'] },
                { name: 'Enterprise', price: 'Contact Us', desc: 'Large organisations', features: ['Unlimited requests', '1TB storage', 'Dedicated support', 'Custom integration', 'SLA 99.99%'] },
            ]),
            testimonials('Trusted by Clients', [
                { name: 'CEO, ABC Corp', quote: 'Excellent solution, helped us increase efficiency by 200%.', title: 'CEO' },
                { name: 'CTO, XYZ Startup', quote: 'Easy API integration, responsive support. Highly recommend!', title: 'CTO' },
            ]),
            faq('Frequently Asked Questions', [
                { q: 'Is there a free trial?', a: 'Yes! The Starter plan comes with a 14-day free trial, no credit card required.' },
                { q: 'Is my data secure?', a: 'We use AES-256 encryption and comply with GDPR and ISO 27001.' },
                { q: 'Can it integrate with existing systems?', a: 'Yes, we offer RESTful APIs and webhooks. Our team supports 24/7 integration.' },
            ]),
            contact('Contact Us', 'hello@techco.my', '+60 3-1111 2222', 'Level 10, Menara KLCC, KL'),
            footer('TechCo', 'Technology solutions for modern businesses.', [
                { title: 'Products', links: ['Features', 'Pricing', 'API Docs'] },
                { title: 'Company', links: ['About Us', 'Blog', 'Careers'] },
            ]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'About TechCo', layout: aboutPage('TechCo Solutions', 'SaaS', 'TechCo') },
            { 
                slug: 'products', 
                title: 'Features', 
                layout: productsPage('TechCo Solutions', 'IT', 'TechCo', [
                    { icon: '☁️', title: 'Cloud Integration', description: 'Seamlessly connect your legacy systems to the cloud.' },
                    { icon: '🔐', title: 'Zero Trust', description: 'Industry-leading security for your corporate data.' },
                    { icon: '📈', title: 'Data Analytics', description: 'Turn raw data into actionable business insights.' },
                ]) 
            },
            { slug: 'contact', title: 'Support', layout: contactPage('TechCo Solutions', 'Tech', 'TechCo', 'support@techco.my', '+60 3-1111 2222', 'Level 10, Tech Tower, Cyberjaya') },
        ],
        tags: [{ tag: 'tech' }, { tag: 'saas' }, { tag: 'startup' }],
        sortOrder: 4, isPremium: false, isFeatured: true,
    },

    // ─── 5. HEALTH / DENTAL / CLINIC ───────────────────────────────────
    {
        name: 'Health / Dental / Clinic',
        description: 'Template for clinics, dental practices, and hospitals with medical team and services.',
        category: ['health'],
        defaultTheme: { primaryColor: '#059669', secondaryColor: '#10B981', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Health Clinic', ['Home', 'Services', 'Doctors', 'Contact'], 'Book Appointment'),
            hero('Your Health is Our Priority', 'Experienced medical professionals, modern equipment, and dedicated care.', 'Book Appointment', 'Free Consultation', 'split-left'),
            features('Medical Services', 'Comprehensive healthcare', [
                { icon: '🦷', title: 'General Dentistry', desc: 'Complete dental examination, treatment, and oral care.' },
                { icon: '💉', title: 'Vaccination', desc: 'Full vaccination programmes for all ages.' },
                { icon: '🩺', title: 'General Check-up', desc: 'Periodic health screening with comprehensive packages.' },
                { icon: '👁️', title: 'Eye & ENT', desc: 'Specialist eye, ear, nose, and throat care.' },
            ], 'Specialties'),
            team('Our Medical Team', [
                { name: 'Dr. Ahmad Razak', role: 'Medical Director — 20 years experience' },
                { name: 'Dr. Siti Aminah', role: 'Dental Specialist — 15 years experience' },
                { name: 'Dr. Lee Wei Ming', role: 'Eye Specialist — 12 years experience' },
            ]),
            stats('Achievements', [
                { value: '20+', label: 'Years Experience' }, { value: '50,000+', label: 'Patients' },
                { value: '15', label: 'Specialist Doctors' }, { value: '98%', label: 'Satisfaction' },
            ]),
            testimonials('Patient Testimonials', [
                { name: 'David H.', quote: 'Attentive doctors, thorough explanations. Clean and modern clinic.', title: 'Patient' },
                { name: 'Mei Ling C.', quote: 'My child was afraid of dentists but loved it here. Thank you!', title: 'Parent' },
            ]),
            contact('Book an Appointment', 'info@healthclinic.my', '+60 3-3333 4444', '321 Jalan Sultan Ismail, KL'),
            footer('Health Clinic', 'Your health is your most valuable asset.', [
                { title: 'Services', links: ['Dental', 'General', 'Vaccination'] },
                { title: 'Clinic Hours', links: ['Mon-Fri: 07:30 - 17:00', 'Sat: 07:30 - 12:00'] },
            ]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Our Doctors', layout: aboutPage('MediCare Clinic', 'Healthcare', 'MediCare') },
            { 
                slug: 'products', 
                title: 'Specialties', 
                layout: productsPage('MediCare Clinic', 'Health', 'MediCare', [
                    { icon: '🩺', title: 'Full Diagnostics', description: 'Comprehensive heart and lung screening.' },
                    { icon: '🦴', title: 'Orthopedics', description: 'Advanced joint and bone care.' },
                    { icon: '👶', title: 'Pediatrics', description: 'Expert care for your little ones.' },
                ]) 
            },
            { slug: 'contact', title: 'Appointments', layout: contactPage('MediCare Clinic', 'Health', 'MediCare', 'info@medicare.my', '+60 3-3333 4444', '321 Health Plaza, KL') },
        ],
        tags: [{ tag: 'health' }, { tag: 'dental' }, { tag: 'clinic' }],
        sortOrder: 5, isPremium: false, isFeatured: false,
    },

    // ─── 6. EDUCATION / TRAINING ────────────────────────────────────────
    {
        name: 'Education / Training',
        description: 'Template for training centres, schools, and academies with courses and enrollment.',
        category: ['education'],
        defaultTheme: { primaryColor: '#7C3AED', secondaryColor: '#8B5CF6', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Training Academy', ['Home', 'Courses', 'Instructors', 'Contact'], 'Enrol Now'),
            hero('Learn Today, Succeed Tomorrow', 'Practical courses from industry experts. Guaranteed outcomes and career support.', 'View Courses', 'Free Consultation', 'split-left'),
            features('Featured Courses', 'High-quality training programmes', [
                { icon: '💻', title: 'Web Development', desc: 'Fullstack JavaScript from zero to hero in 6 months.' },
                { icon: '📱', title: 'Mobile App Dev', desc: 'React Native / Flutter — build real-world apps.' },
                { icon: '📊', title: 'Data Science', desc: 'Python, Machine Learning, and data analysis.' },
                { icon: '🎨', title: 'UI/UX Design', desc: 'Figma, Design System, User Research.' },
            ], 'Courses'),
            stats('Impressive Numbers', [
                { value: '5,000+', label: 'Students' }, { value: '95%', label: 'Employed' },
                { value: '20+', label: 'Instructors' }, { value: '50+', label: 'Courses' },
            ]),
            testimonials('Student Reviews', [
                { name: 'Daniel W.', quote: 'After the course, I received an offer from a top IT company. Thank you!', title: 'Batch 12 Graduate' },
                { name: 'Lisa M.', quote: 'Practical curriculum, enthusiastic instructors. Highly recommend!', title: 'Batch 15 Graduate' },
            ]),
            faq('Admission FAQs', [
                { q: 'Do I need prior knowledge?', a: 'No! Our programmes start from the basics. Just bring a laptop and eagerness to learn.' },
                { q: 'What is the learning format?', a: 'In-person classes or online via Zoom. Recorded lessons available for review.' },
                { q: 'Is there career support?', a: 'Yes! We connect graduates with 100+ hiring partners.' },
            ]),
            cta('🎓 New Batch Starting Soon', 'Early bird special — 20% off tuition. Limited seats!', 'Enrol Now'),
            contact('Admissions Enquiry', 'info@academy.my', '+60 3-5555 6666', '100 Jalan Bangsar, KL'),
            footer('Training Academy', 'Nurturing the next generation of tech talent.', [
                { title: 'Courses', links: ['Programming', 'Data Science', 'Design'] },
                { title: 'Support', links: ['Admissions', 'Scholarships', 'Careers'] },
            ]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Our Methodology', layout: aboutPage('EduPro Academy', 'Education', 'EduPro') },
            { 
                slug: 'products', 
                title: 'Courses', 
                layout: productsPage('EduPro Academy', 'Training', 'EduPro', [
                    { icon: '💻', title: 'Coding Bootcamp', description: 'Intensive training for future software engineers.' },
                    { icon: '📊', title: 'Data Analytics', description: 'Master the art of data-driven decision making.' },
                    { icon: '🎨', title: 'UI/UX Masterclass', description: 'Learn modern design principles and tools.' },
                ]) 
            },
            { slug: 'contact', title: 'Enrollment', layout: contactPage('EduPro Academy', 'Education', 'EduPro', 'admit@edupro.edu', '+60 3-5555 6666', '100 Knowledge Way, KL') },
        ],
        tags: [{ tag: 'education' }, { tag: 'training' }, { tag: 'courses' }],
        sortOrder: 6, isPremium: false, isFeatured: false,
    },

    // ─── 7. REAL ESTATE / PROPERTY ───────────────────────────────────────
    {
        name: 'Real Estate / Property',
        description: 'Template for property developers, agents, and real estate with featured projects.',
        category: ['realestate'],
        defaultTheme: { primaryColor: '#0891B2', secondaryColor: '#06B6D4', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Prime Property', ['Home', 'Projects', 'About Us', 'Contact'], 'Get Consultation'),
            hero('Find Your Dream Home', 'Hundreds of condos, villas, and land in prime locations across Malaysia.', 'View Projects', 'Free Consultation'),
            features('Featured Projects', 'Our most popular developments', [
                { icon: '🏢', title: 'Sky Garden Condo', desc: 'Premium condos with river views, 5-star amenities, from RM500K.' },
                { icon: '🏡', title: 'Green Valley Villa', desc: 'Eco villas with lush gardens and sustainable living.' },
                { icon: '🏗️', title: 'Sunrise City', desc: 'Modern township with integrated infrastructure, prime location.' },
            ], 'Projects'),
            stats('Achievements', [
                { value: '200+', label: 'Projects' }, { value: '10,000+', label: 'Customers' },
                { value: '15', label: 'Years Experience' }, { value: '50+', label: 'Awards' },
            ]),
            about('About Us', 'With over 15 years of experience in real estate, we proudly help thousands of families find their dream homes.', 'About Us'),
            testimonials('Client Testimonials', [
                { name: 'Razak B.', quote: 'Very professional consultants, supported us from start to finish. Very satisfied!', title: 'Homeowner' },
                { name: 'Christina T.', quote: 'Project on schedule, clear legal documents. Recommended to friends.', title: 'Investor' },
            ]),
            contact('Project Enquiry', 'info@primeproperty.my', '+60 3-7777 8888', '50 Jalan Bukit Bintang, KL'),
            footer('Prime Property', 'Helping you find your dream home.', [
                { title: 'Projects', links: ['Condos', 'Villas', 'Land'] },
                { title: 'Support', links: ['Consultation', 'Legal', 'Mortgage'] },
            ]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Company Profile', layout: aboutPage('Prime Estates', 'Real Estate', 'Prime Estates') },
            { 
                slug: 'products', 
                title: 'Developments', 
                layout: productsPage('Prime Estates', 'Property', 'Prime Estates', [
                    { icon: '🏢', title: 'Luxury Condos', description: 'High-rise living with premium amenities.' },
                    { icon: '🏡', title: 'Family Homes', description: 'Spacious suburban residences for modern living.' },
                    { icon: '🏗️', title: 'Commercial Space', description: 'Prime locations for your business growth.' },
                ]) 
            },
            { slug: 'contact', title: 'Inquiries', layout: contactPage('Prime Estates', 'Real Estate', 'Prime Estates', 'sales@primeestates.my', '+60 3-7777 8888', '50 Skyline Tower, KL') },
        ],
        tags: [{ tag: 'real estate' }, { tag: 'property' }, { tag: 'development' }],
        sortOrder: 7, isPremium: false, isFeatured: false,
    },

    // ─── 8. GYM / FITNESS / YOGA ────────────────────────────────────────
    {
        name: 'Gym / Fitness / Yoga',
        description: 'Template for gyms, yoga studios, personal trainers with membership plans and schedules.',
        category: ['fitness'],
        defaultTheme: { primaryColor: '#DC2626', secondaryColor: '#EF4444', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('FitZone', ['Home', 'Plans', 'Facilities', 'Contact'], 'Join Now'),
            hero('Stronger Every Day', 'Modern gym, professional trainers. Start your journey to transform your life.', 'Free Trial', 'View Plans', 'split-left'),
            pricing('Membership Plans', 'Choose the plan that fits your goals', [
                { name: 'Basic', price: 'RM99/mo', desc: 'Gym access', features: ['Main gym floor', 'Locker', 'Drinking water'] },
                { name: 'Premium', price: 'RM179/mo', desc: 'Gym + Group classes', features: ['All Basic benefits', 'Yoga, Zumba, Boxing', 'Steam & sauna', 'PT 2 sessions/mo'] },
                { name: 'VIP', price: 'RM299/mo', desc: 'All-inclusive', features: ['All Premium benefits', 'PT 8 sessions/mo', 'Meal plan', 'Body scan', 'Towel service'] },
            ]),
            features('Facilities', 'World-class equipment', [
                { icon: '🏋️', title: '500m² Gym Floor', desc: 'Modern equipment from Technogym, Life Fitness.' },
                { icon: '🧘', title: 'Yoga Studio', desc: 'Beautiful view, wooden floors, relaxing ambience.' },
                { icon: '🏊', title: 'Swimming Pool', desc: '25m heated pool, Olympic standard.' },
                { icon: '🧖', title: 'Spa & Sauna', desc: 'Steam room, post-workout relaxation massage.' },
            ], 'Facilities'),
            gallery('Our Space', 6),
            testimonials('Member Success Stories', [
                { name: 'Hafiz M.', quote: 'Lost 15kg in 6 months training here. Trainers are amazing!', title: 'Member' },
                { name: 'Priya S.', quote: 'Clean gym, new equipment, great atmosphere. Love it!', title: 'VIP Member' },
            ]),
            cta('💪 Free 3-Day Trial', 'Sign up now and experience our world-class facilities!', 'Start Trial'),
            contact('Join & Enquiry', 'hello@fitzone.my', '+60 3-9999 0000', '200 Jalan Imbi, KL'),
            footer('FitZone', 'Stronger every day.', [
                { title: 'Services', links: ['Gym', 'Yoga', 'Boxing', 'Personal Training'] },
                { title: 'Opening Hours', links: ['Mon-Fri: 05:30 - 22:00', 'Sat-Sun: 06:00 - 21:00'] },
            ]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Our Philosophy', layout: aboutPage('FitZone Gym', 'Fitness', 'FitZone') },
            { 
                slug: 'products', 
                title: 'Memberships', 
                layout: productsPage('FitZone Gym', 'Wellness', 'FitZone', [
                    { icon: '🏋️', title: 'Personal Training', description: 'One-on-one sessions with elite coaches.' },
                    { icon: '🧘', title: 'Yoga & Pilates', description: 'Mind-body balance in a serene environment.' },
                    { icon: '🏊', title: 'Aquatic Center', description: 'Heated pools for training and recovery.' },
                ]) 
            },
            { slug: 'contact', title: 'Join Us', layout: contactPage('FitZone Gym', 'Fitness', 'FitZone', 'hello@fitzone.my', '+60 3-9999 0000', '200 Power Plaza, KL') },
        ],
        tags: [{ tag: 'gym' }, { tag: 'fitness' }, { tag: 'yoga' }],
        sortOrder: 8, isPremium: false, isFeatured: true,
    },

    // ─── 9. PORTFOLIO / FREELANCER / AGENCY ─────────────────────────────
    {
        name: 'Portfolio / Freelancer / Agency',
        description: 'Template for designers, developers, and agencies with portfolio gallery and case studies.',
        category: ['creative'],
        defaultTheme: { primaryColor: '#F59E0B', secondaryColor: '#D97706', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Creative Studio', ['Home', 'Portfolio', 'Services', 'Contact'], 'Hire Me'),
            hero('Creative Design, Effective Solutions', 'I help businesses build strong brands through design and digital marketing.', 'View Portfolio', 'Get in Touch', 'minimal'),
            gallery('Portfolio', 8),
            features('Services', 'What I can do for you', [
                { icon: '🎨', title: 'Brand Identity', desc: 'Professional logo and complete brand identity design.' },
                { icon: '🌐', title: 'Web Design', desc: 'Responsive websites, optimised UX, SEO-ready.' },
                { icon: '📱', title: 'App Design', desc: 'Mobile app UI for iOS & Android.' },
                { icon: '📢', title: 'Digital Marketing', desc: 'Social media, Google Ads, content strategy.' },
            ], 'Services'),
            stats('Achievements', [
                { value: '150+', label: 'Projects' }, { value: '80+', label: 'Clients' },
                { value: '8', label: 'Years Experience' }, { value: '15', label: 'Awards' },
            ]),
            testimonials('What Clients Say', [
                { name: 'CEO, TechStartup', quote: 'Beautiful designs, delivered on deadline. Highly recommend!', title: 'CEO' },
                { name: 'Founder, Brand X', quote: 'Outstanding brand identity, exceeded our expectations.', title: 'Founder' },
            ]),
            cta('🚀 Starting a New Project?', 'Tell me about your idea. Free consultation!', 'Get in Touch'),
            contact('Collaboration Enquiry', 'hello@creative.my', '+60 12-345 6789', 'Kuala Lumpur, Malaysia'),
            footer('Creative Studio', 'Creative design, effective solutions.', [
                { title: 'Services', links: ['Branding', 'Web', 'App', 'Marketing'] },
                { title: 'Social', links: ['Behance', 'Dribbble', 'Instagram'] },
            ]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Our Studio', layout: aboutPage('Creative Pulse', 'Design', 'Creative Pulse') },
            { 
                slug: 'products', 
                title: 'Services', 
                layout: productsPage('Creative Pulse', 'Creative', 'Creative Pulse', [
                    { icon: '🎨', title: 'Brand Identity', description: 'Logo and visual language that speaks for you.' },
                    { icon: '📱', title: 'Digital Products', description: 'User-centric web and mobile applications.' },
                    { icon: '📣', title: 'Social Strategy', description: 'Driving engagement through meaningful content.' },
                ]) 
            },
            { slug: 'contact', title: 'Collaborate', layout: contactPage('Creative Pulse', 'Creative', 'Creative Pulse', 'hello@creative.my', '+60 12-345 6789', 'KL Center, Malaysia') },
        ],
        tags: [{ tag: 'portfolio' }, { tag: 'freelancer' }, { tag: 'agency' }],
        sortOrder: 9, isPremium: false, isFeatured: true,
    },

    // ─── 10. BUSINESS / CORPORATE ─────────────────────────────────────
    {
        name: 'Business / Corporate',
        description: 'Template for companies, consultancies, and corporate services with team and services.',
        category: ['business'],
        defaultTheme: { primaryColor: '#1E293B', secondaryColor: '#334155', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Prime Corp', ['Home', 'Services', 'Team', 'Contact'], 'Consultation'),
            hero('Excellence in Strategic Consulting', 'We provide data-driven solutions to help your business scale globally.', 'Our Services', 'Contact Us', 'split-left'),
            features('Core Services', 'Professional expertise for your growth', [
                { icon: '📈', title: 'Strategic Planning', desc: 'Comprehensive business roadmaps for sustainable growth.' },
                { icon: '💼', title: 'Financial Advisory', desc: 'Expert financial management and investment strategy.' },
                { icon: '👥', title: 'HR Solutions', desc: 'Talent management and organisational development.' },
            ], 'Services'),
            team('Leadership Team', [
                { name: 'Dato\' Seri Ibrahim', role: 'Chairman — 30 years experience' },
                { name: 'Sarah Tan', role: 'CEO — International Business Expert' },
                { name: 'M. Hafiz', role: 'Director of Innovation' },
            ]),
            testimonials('Partner Testimonials', [
                { name: 'Director, Global Tech', quote: 'Prime Corp is our most trusted strategic partner.', title: 'Director' },
                { name: 'Founder, Retail Plus', quote: 'Their financial insights were game-changing for us.', title: 'Founder' },
            ]),
            contact('Business Enquiries', 'contact@primecorp.my', '+60 3-8888 7777', 'Level 50, Menara Petronas, KL'),
            footer('Prime Corp', 'Excellence in strategic consulting.', [
                { title: 'Company', links: ['About Us', 'Team', 'Careers'] },
                { title: 'Services', links: ['Consulting', 'Finance', 'Strategy'] },
            ]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Corporate Values', layout: aboutPage('Prime Corp', 'Consulting', 'Prime Corp') },
            { 
                slug: 'products', 
                title: 'Capabilities', 
                layout: productsPage('Prime Corp', 'Business', 'Prime Corp', [
                    { icon: '📈', title: 'Strategy', description: 'Market entry and growth acceleration plans.' },
                    { icon: '💼', title: 'M&A Advisory', description: 'Expert guidance through complex transactions.' },
                    { icon: '👥', title: 'Organization', description: 'Building high-performance corporate cultures.' },
                ]) 
            },
            { slug: 'contact', title: 'Consultation', layout: contactPage('Prime Corp', 'Business', 'Prime Corp', 'contact@primecorp.my', '+60 3-8888 7777', 'Level 50, Petronas Tower, KL') },
        ],
        tags: [{ tag: 'business' }, { tag: 'corporate' }, { tag: 'consulting' }],
        sortOrder: 10, isPremium: true, isFeatured: false,
    },

    // ─── 11. BOUTIQUE COFFEE SHOP ─────────────────────────────────────
    {
        name: 'Boutique Coffee Shop',
        description: 'A cozy template for specialty coffee shops and local roasteries.',
        category: ['restaurant'],
        defaultTheme: { primaryColor: '#4b3832', secondaryColor: '#be9b7b', fontHeading: 'Montserrat', fontBody: 'Lora', colorMode: 'light' },
        defaultBlocks: [
            nav('Bean & Brew', ['Home', 'Menu', 'Brewing', 'Location'], 'Order Now'),
            hero('Brewing Moments, One Cup at a Time', 'Experience the finest artisanal coffee sourced directly from ethical farms.', 'View Menu', 'Our Story', 'centered'),
            features('Our Favorites', 'Hand-picked beans & brews', [
                { icon: '☕', title: 'Manual Brew', desc: 'V60, Chemex, and Aeropress options.' },
                { icon: '🥐', title: 'Artisan Pastries', desc: 'Baked fresh every morning.' },
                { icon: '🍃', title: 'Specialty Tea', desc: 'Organic loose leaf tea selection.' },
            ], 'Menu'),
            contact('Visit Us', 'hello@beanbrew.my', '+60 3-2161 8888', 'Lot 10, Bukit Bintang, KL'),
            footer('Bean & Brew', 'Coffee for the soul.', [
                { title: 'Links', links: ['Menu', 'Shipping', 'Events'] },
            ]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'The Roast', layout: aboutPage('Bean & Brew', 'Specialty Coffee', 'Bean & Brew') },
            { 
                slug: 'products', 
                title: 'Menu', 
                layout: productsPage('Bean & Brew', 'Cafe', 'Bean & Brew', [
                    { icon: '☕', title: 'Single Origin', description: 'Rotating selection of seasonal beans.' },
                    { icon: '🍩', title: 'Handmade Treats', description: 'Freshly baked pastries and desserts.' },
                    { icon: '🍵', title: 'Matcha Ritual', description: 'Premium ceremonial grade matcha.' },
                ]) 
            },
            { slug: 'contact', title: 'Find Us', layout: contactPage('Bean & Brew', 'Cafe', 'Bean & Brew', 'hello@beanbrew.my', '+60 3-2161 8888', 'Lot 10, Bukit Bintang, KL') },
        ],
        tags: [{ tag: 'cafe' }, { tag: 'coffee' }],
        sortOrder: 11, isPremium: false, isFeatured: false,
    },

    // ─── 12. FINE DINING RESTAURANT ───────────────────────────────────
    {
        name: 'Fine Dining Restaurant',
        description: 'Elite template for high-end dining experiences with reservation focus.',
        category: ['restaurant'],
        defaultTheme: { primaryColor: '#1c1c1c', secondaryColor: '#c5a059', fontHeading: 'Cinzel', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('L\'Excellence', ['Experience', 'Menu', 'Wine', 'Reservations'], 'Reserve'),
            hero('Culinary Masterpieces', 'A symphony of flavors crafted for the most discerning palates.', 'The Menu', 'Table for Two'),
            testimonials('The Reviews', [{ name: 'Chef Mario', quote: 'A standard of excellence in the region.', title: 'Michelin Star Chef' }]),
            footer('L\'Excellence', 'Elegance served.', [{ title: 'Info', links: ['Terms', 'Privacy'] }]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'The Ethos', layout: aboutPage('L\'Excellence', 'Gastronomy', 'L\'Excellence') },
            { 
                slug: 'products', 
                title: 'Tasting Menu', 
                layout: productsPage('L\'Excellence', 'Fine Dining', 'L\'Excellence', [
                    { icon: '🍽️', title: 'Degustation', description: 'A 12-course journey through modern cuisine.' },
                    { icon: '🍷', title: 'Sommelier Pairings', description: 'Rare vintages selected for each dish.' },
                    { icon: '🧀', title: 'Artisan Cheeses', description: 'The finest selection from European farms.' },
                ]) 
            },
            { slug: 'contact', title: 'Reservations', layout: contactPage('L\'Excellence', 'Dining', 'L\'Excellence', 'reserve@lexcellence.com', '+60 3-1111 2222', 'Sky Tower, KL') },
        ],
        tags: [{ tag: 'dining' }, { tag: 'luxury' }],
        sortOrder: 12, isPremium: true, isFeatured: true,
    },

    // ─── 13. MINIMALIST FASHION LABEL ──────────────────────────────────
    {
        name: 'Minimalist Fashion Label',
        description: 'Sleek, image-heavy template for modern clothing brands.',
        category: ['ecommerce'],
        defaultTheme: { primaryColor: '#000000', secondaryColor: '#ffffff', fontHeading: 'Helvetica', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('NORD', ['Shop', 'Journal', 'Archive'], 'Login'),
            hero('Essential Silhouettes', 'Sustainable materials. Timeless design.', 'Shop Collection', undefined, 'centered'),
            gallery('SS26 Collection', 4),
            footer('NORD', 'Minimalism elevated.', [{ title: 'Shop', links: ['All', 'Men', 'Women'] }]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Our Manifesto', layout: aboutPage('NORD', 'Sustainable Fashion', 'NORD') },
            { 
                slug: 'products', 
                title: 'Shop All', 
                layout: productsPage('NORD', 'Minimalism', 'NORD', [
                    { icon: '👕', title: 'Organic Basics', description: 'T-shirts crafted from GOTS certified cotton.' },
                    { icon: '👖', title: 'Raw Denim', description: 'Hand-finished jeans that age with character.' },
                    { icon: '🧥', title: 'Outerwear', description: 'Technical fabrics in timeless silhouettes.' },
                ]) 
            },
            { slug: 'contact', title: 'Support', layout: contactPage('NORD', 'Fashion', 'NORD', 'care@nord.com', '+46 8 123 45 67', 'Stockholm, Sweden') },
        ],
        tags: [{ tag: 'fashion' }, { tag: 'minimal' }],
        sortOrder: 13, isPremium: true, isFeatured: false,
    },

    // ─── 14. MODERN FURNITURE STORE ────────────────────────────────────
    {
        name: 'Modern Furniture Store',
        description: 'Product-focused template for home decor and furniture retailers.',
        category: ['ecommerce'],
        defaultTheme: { primaryColor: '#2d5a27', secondaryColor: '#f4f1ea', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('Habitat', ['Living', 'Dining', 'Bedroom', 'Office'], 'Cart'),
            hero('Design for Living', 'Transform your space with curated pieces that blend form and function.', 'Browse Catalog', 'Latest Arrivals'),
            features('Our Quality', 'Craftsmanship matters', [
                { icon: '🪑', title: 'Solid Wood', desc: 'Sustainably sourced teak and oak.' },
                { icon: '🛠️', title: 'Handmade', desc: 'Crafted by master artisans.' },
            ]),
            footer('Habitat', 'Live beautifully.', [{ title: 'Policies', links: ['Shipping', 'Returns'] }]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Our Craft', layout: aboutPage('Habitat', 'Furniture Design', 'Habitat') },
            { 
                slug: 'products', 
                title: 'Catalog', 
                layout: productsPage('Habitat', 'Home Decor', 'Habitat', [
                    { icon: '🛋️', title: 'Living Space', description: 'Sofas and armchairs for ultimate comfort.' },
                    { icon: '🪑', title: 'Dining Sets', description: 'Where memories are shared over meals.' },
                    { icon: '💡', title: 'Lighting', description: 'Sculptural lamps to illuminate your home.' },
                ]) 
            },
            { slug: 'contact', title: 'Locate Us', layout: contactPage('Habitat', 'Furniture', 'Habitat', 'info@habitat.my', '+60 3-5555 1111', 'Damansara Heights, KL') },
        ],
        tags: [{ tag: 'home' }, { tag: 'furniture' }],
        sortOrder: 14, isPremium: false, isFeatured: false,
    },

    // ─── 15. HIGH-INTENSITY FITNESS GYM ────────────────────────────────
    {
        name: 'High-Intensity Fitness Gym',
        description: 'Action-oriented template for CrossFit and HIIT studios.',
        category: ['fitness'],
        defaultTheme: { primaryColor: '#ff5f1f', secondaryColor: '#222222', fontHeading: 'Impact', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('IRON DEPOT', ['Schedule', 'Coaches', 'Location'], 'JOIN'),
            hero('Unleash the Beast', 'Push your limits with elite coaching and community.', 'Get Started', 'The Program'),
            stats('Community', [{ value: '300+', label: 'Athletes' }, { value: '12', label: 'Coaches' }]),
            footer('IRON DEPOT', 'No excuses.', [{ title: 'Connect', links: ['Instagram', 'Facebook'] }]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'The Pit', layout: aboutPage('IRON DEPOT', 'Strength Training', 'IRON DEPOT') },
            { 
                slug: 'products', 
                title: 'Training', 
                layout: productsPage('IRON DEPOT', 'Fitness', 'IRON DEPOT', [
                    { icon: '⛓️', title: 'Powerlifting', description: 'Squat, bench, and deadlift with elite coaching.' },
                    { icon: '🏃', title: 'Conditioning', description: 'High-intensity intervals for ultimate endurance.' },
                    { icon: '🍖', title: 'Nutrition', description: 'Fuel your gains with science-based plans.' },
                ]) 
            },
            { slug: 'contact', title: 'Start Today', layout: contactPage('IRON DEPOT', 'Fitness', 'IRON DEPOT', 'gain@irondepot.com', '+60 11-2222 3333', 'Factory Row, KL') },
        ],
        tags: [{ tag: 'gym' }, { tag: 'crossfit' }],
        sortOrder: 15, isPremium: false, isFeatured: false,
    },

    // ─── 16. YOGA & PILATES STUDIO ─────────────────────────────────────
    {
        name: 'Yoga & Pilates Studio',
        description: 'Serene template for wellness centers and mindfulness studios.',
        category: ['fitness'],
        defaultTheme: { primaryColor: '#a8d5ba', secondaryColor: '#f7f1e3', fontHeading: 'Quicksand', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('OM Shanti', ['Classes', 'Workshops', 'Pricing'], 'Book Class'),
            hero('Find Your Inner Balance', 'Gentle flow and mindful movement for every body.', 'Trial Class', 'View Schedule'),
            testimonials('Teacher Profile', [{ name: 'Maya', quote: 'Yoga saved my mind.', title: 'Lead Instructor' }]),
            footer('OM Shanti', 'Breathing life.', [{ title: 'Schedule', links: ['Monday', 'Tuesday'] }]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'The Way', layout: aboutPage('OM Shanti', 'Yoga Philosophy', 'OM Shanti') },
            { 
                slug: 'products', 
                title: 'Practices', 
                layout: productsPage('OM Shanti', 'Wellness', 'OM Shanti', [
                    { icon: '🧘', title: 'Hatha Flow', description: 'Foundation practices for balance and breath.' },
                    { icon: '🕯️', title: 'Meditation', description: 'Finding silence in a noisy world.' },
                    { icon: '🧘‍♂️', title: 'Pilates Reformer', description: 'Core strength and postural alignment.' },
                ]) 
            },
            { slug: 'contact', title: 'Connect', layout: contactPage('OM Shanti', 'Yoga', 'OM Shanti', 'zen@omshanti.my', '+60 3-8888 9999', 'Bangsar Village, KL') },
        ],
        tags: [{ tag: 'yoga' }, { tag: 'pilates' }],
        sortOrder: 16, isPremium: false, isFeatured: false,
    },

    // ─── 17. SPECIALIZED DENTAL CLINIC ─────────────────────────────────
    {
        name: 'Specialized Dental Clinic',
        description: 'Patient-centric template for advanced orthodontic and cosmetic clinics.',
        category: ['health'],
        defaultTheme: { primaryColor: '#0077b6', secondaryColor: '#caf0f8', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('SmileBright', ['Services', 'About', 'Technology'], 'Appoint'),
            hero('Confidence in Every Smile', 'Advanced dentistry for the whole family.', 'Our Services', 'Meet Doctors'),
            features('Our Technology', 'Cutting edge', [{ icon: '🦷', title: '3D Scanning', desc: 'No more messy molds.' }]),
            footer('SmileBright', 'Healthy teeth, happy life.', [{ title: 'Emergency', links: ['Call Now'] }]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'The Clinic', layout: aboutPage('SmileBright', 'Dentistry', 'SmileBright') },
            { 
                slug: 'products', 
                title: 'Treatments', 
                layout: productsPage('SmileBright', 'Health', 'SmileBright', [
                    { icon: '💎', title: 'Veneers', description: 'Transform your smile with porcelain perfection.' },
                    { icon: '🦷', title: 'Implants', description: 'Permanent solutions for missing teeth.' },
                    { icon: '✨', title: 'Whitening', description: 'Brighter smiles in just one hour.' },
                ]) 
            },
            { slug: 'contact', title: 'Appoint', layout: contactPage('SmileBright', 'Dental', 'SmileBright', 'care@smilebright.my', '+60 3-7777 0000', 'Mont Kiara, KL') },
        ],
        tags: [{ tag: 'dental' }, { tag: 'clinic' }],
        sortOrder: 17, isPremium: false, isFeatured: false,
    },

    // ─── 18. MENTAL WELLNESS CENTER ────────────────────────────────────
    {
        name: 'Mental Wellness Center',
        description: 'Safe and supportive template for therapy and counseling practices.',
        category: ['health'],
        defaultTheme: { primaryColor: '#5c677d', secondaryColor: '#daeaf6', fontHeading: 'Lora', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('MindPath', ['Therapy', 'Resources', 'About'], 'Heal'),
            hero('You Are Not Alone', 'Compassionate care for your mental well-being.', 'Contact Us', 'Our Approach'),
            faq('Common Questions', [{ q: 'Is it confidential?', a: 'Completely.' }]),
            footer('MindPath', 'Path to peace.', [{ title: 'Support', links: ['Crisis Line'] }]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Our Counselors', layout: aboutPage('MindPath', 'Psychology', 'MindPath') },
            { 
                slug: 'products', 
                title: 'Therapy', 
                layout: productsPage('MindPath', 'Mental Health', 'MindPath', [
                    { icon: '🗣️', title: 'Individual Therapy', description: 'One-on-one sessions in a safe environment.' },
                    { icon: '🤝', title: 'Couples Therapy', description: 'Strengthening relationships through communication.' },
                    { icon: '🧠', title: 'CBT', description: 'Evidence-based cognitive behavioral therapy.' },
                ]) 
            },
            { slug: 'contact', title: 'Reach Out', layout: contactPage('MindPath', 'Health', 'MindPath', 'peace@mindpath.com', '+60 3-1212 3434', 'Subang Jaya, KL') },
        ],
        tags: [{ tag: 'wellness' }, { tag: 'therapy' }],
        sortOrder: 18, isPremium: false, isFeatured: false,
    },

    // ─── 19. LANGUAGE LEARNING SCHOOL ──────────────────────────────────
    {
        name: 'Language Learning School',
        description: 'Engagement-focused template for language centers and tutors.',
        category: ['education'],
        defaultTheme: { primaryColor: '#ffb703', secondaryColor: '#fb8500', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('Lingua', ['Languages', 'Method', 'Apply'], 'Join'),
            hero('Speak the World', 'Interactive language classes taught by native speakers.', 'Free Lesson', 'See Levels'),
            stats('Progress', [{ value: '50+', label: 'Teachers' }, { value: '10', label: 'Languages' }]),
            footer('Lingua', 'Connect through speech.', [{ title: 'Courses', links: ['English', 'Chinese', 'Malay'] }]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Our Mission', layout: aboutPage('EduStream', 'E-Learning', 'EduStream') },
            { 
                slug: 'products', 
                title: 'Catalog', 
                layout: productsPage('EduStream', 'Education', 'EduStream', [
                    { icon: '📚', title: 'K-12 Courses', description: 'Curriculum-aligned learning for all ages.' },
                    { icon: '🎤', title: 'Live Sessions', description: 'Interactive webinars with expert instructors.' },
                    { icon: '✍️', title: 'Certification', description: 'Verifiable proof of your new skills.' },
                ]) 
            },
            { slug: 'contact', title: 'Support', layout: contactPage('EduStream', 'EdTech', 'EduStream', 'help@edustream.com', '+60 3-3333 4444', 'Cyberjaya, Malaysia') },
        ],
        tags: [{ tag: 'school' }, { tag: 'language' }],
        sortOrder: 19, isPremium: false, isFeatured: false,
    },

    // ─── 20. PROFESSIONAL LAW FIRM ─────────────────────────────────────
    {
        name: 'Professional Law Firm',
        description: 'Authority-driven template for legal experts and advocacy groups.',
        category: ['business'],
        defaultTheme: { primaryColor: '#0d1b2a', secondaryColor: '#e0e1dd', fontHeading: 'Playfair Display', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Lexington', ['Practice', 'Attorneys', 'Blog'], 'Contact'),
            hero('Protecting Your Interests', 'Top-tier legal representation for corporate and personal matters.', 'Our Expertise', 'Get Advice'),
            team('The Team', [{ name: 'Tan Sri Wong', role: 'Senior Partner' }]),
            footer('Lexington', 'Justice first.', [{ title: 'Search', links: ['Cases'] }]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Our Firm', layout: aboutPage('Lexington', 'Legal Services', 'Lexington') },
            { 
                slug: 'products', 
                title: 'Practice Areas', 
                layout: productsPage('Lexington', 'Law', 'Lexington', [
                    { icon: '⚖️', title: 'Corporate Law', description: 'Mergers, acquisitions, and business formation.' },
                    { icon: '🏛️', title: 'Litigation', description: 'Representation in civil and criminal courts.' },
                    { icon: '📜', title: 'Intellectual Property', description: 'Protecting your innovations and creations.' },
                ]) 
            },
            { slug: 'contact', title: 'Consult', layout: contactPage('Lexington', 'Legal', 'Lexington', 'info@lexington.com', '+60 3-6666 7777', 'Kuala Lumpur, Malaysia') },
        ],
        tags: [{ tag: 'law' }, { tag: 'legal' }],
        sortOrder: 20, isPremium: true, isFeatured: false,
    },

    // ─── 21. DIGITAL MARKETING AGENCY ──────────────────────────────────
    {
        name: 'Digital Marketing Agency',
        description: 'Dynamic template showing results and past client work.',
        category: ['creative'],
        defaultTheme: { primaryColor: '#6a0572', secondaryColor: '#ab83a1', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Vortex', ['Work', 'Labs', 'Contact'], 'Pitch Us'),
            hero('Scale Your Impact', 'Data-driven marketing for high-growth brands.', 'Case Studies', 'Services'),
            gallery('Selected Works', 4),
            footer('Vortex', 'Digital domination.', [{ title: 'Agency', links: ['About'] }]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Mindfulness', layout: aboutPage('Zen Studio', 'Spiritual Wellness', 'Zen Studio') },
            { 
                slug: 'products', 
                title: 'Offerings', 
                layout: productsPage('Zen Studio', 'Wellness', 'Zen Studio', [
                    { icon: '🕉️', title: 'Meditation', description: 'Guided sessions to quiet the mind.' },
                    { icon: '💆', title: 'Sound Healing', description: 'Vibrational therapy for deep relaxation.' },
                    { icon: '🍵', title: 'Tea Ceremony', description: 'Ritualistic drinking for mindfulness.' },
                ]) 
            },
            { slug: 'contact', title: 'Join', layout: contactPage('Zen Studio', 'Wellness', 'Zen Studio', 'om@zenstudio.my', '+60 10-2222 3333', 'Ubud, Bali') },
        ],
        tags: [{ tag: 'marketing' }, { tag: 'agency' }],
        sortOrder: 21, isPremium: false, isFeatured: false,
    },

    // ─── 22. WEDDING PHOTOGRAPHY ───────────────────────────────────────
    {
        name: 'Wedding Photography',
        description: 'Visual storytelling template for photographers.',
        category: ['creative'],
        defaultTheme: { primaryColor: '#f7ede2', secondaryColor: '#84a59d', fontHeading: 'Italiana', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('Moments', ['Galleries', 'Weddings', 'Contact'], 'Book'),
            hero('Capture the Magic', 'Timeless wedding photography for your once-in-a-lifetime moments.', 'View Gallery', 'Packages'),
            gallery('Featured Weddings', 6),
            footer('Moments', 'Forever young.', [{ title: 'Follow', links: ['IG'] }]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Our Vision', layout: aboutPage('Moments', 'Photography', 'Moments') },
            { 
                slug: 'products', 
                title: 'Packages', 
                layout: productsPage('Moments', 'Weddings', 'Moments', [
                    { icon: '📸', title: 'Full Day Coverage', description: 'From preparation to the last dance.' },
                    { icon: '🖼️', title: 'Engagement Shoot', description: 'Capture your love story before the big day.' },
                    { icon: '앨범', title: 'Premium Album', description: 'Handcrafted albums to cherish forever.' },
                ]) 
            },
            { slug: 'contact', title: 'Inquire', layout: contactPage('Moments', 'Photography', 'Moments', 'hello@moments.com', '+60 12-345 6789', 'Kuala Lumpur, Malaysia') },
        ],
        tags: [{ tag: 'wedding' }, { tag: 'photo' }],
        sortOrder: 22, isPremium: true, isFeatured: false,
    },

    // ─── 23. LUXURY TRAVEL AGENCY ──────────────────────────────────────
    {
        name: 'Luxury Travel Agency',
        description: 'High-end imagery template for curated travel experiences.',
        category: ['business'],
        defaultTheme: { primaryColor: '#013a63', secondaryColor: '#a9d6e5', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('Voyage', ['Destinations', 'Yachts', 'Contact'], 'Plan'),
            hero('Escape the Ordinary', 'Bespoke adventures crafted by travel experts.', 'Explore', 'Concierge'),
            features('Pillars', 'Why us', [{ icon: '✈️', title: 'Private Jet', desc: 'Arrive in style.' }]),
            footer('Voyage', 'The world is yours.', [{ title: 'News', links: ['Blog'] }]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Our Philosophy', layout: aboutPage('Voyage', 'Luxury Travel', 'Voyage') },
            { 
                slug: 'products', 
                title: 'Experiences', 
                layout: productsPage('Voyage', 'Travel', 'Voyage', [
                    { icon: '✈️', title: 'Private Jet Charters', description: 'Seamless travel to exclusive destinations.' },
                    { icon: '⛵', title: 'Yacht Expeditions', description: 'Explore hidden coves and pristine waters.' },
                    { icon: '🏨', title: 'Boutique Stays', description: 'Handpicked luxury accommodations worldwide.' },
                ]) 
            },
            { slug: 'contact', title: 'Plan Trip', layout: contactPage('Voyage', 'Travel', 'Voyage', 'concierge@voyage.com', '+60 3-9999 8888', 'Global HQ, London') },
        ],
        tags: [{ tag: 'travel' }, { tag: 'luxury' }],
        sortOrder: 23, isPremium: true, isFeatured: false,
    },

    // ─── 24. PET GROOMING & SPA ───────────────────────────────────────
    {
        name: 'Pet Grooming & Spa',
        description: 'Fun and friendly template for pet services.',
        category: ['beauty'],
        defaultTheme: { primaryColor: '#ff99c8', secondaryColor: '#fcf6bd', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('Pawsome', ['Services', 'Pals', 'Contact'], 'Book'),
            hero('Pamper Your Best Friend', 'Professional grooming and spa for your furry companions.', 'Our Services', 'See Pals'),
            testimonials('Happy Pets', [{ name: 'Buddy', quote: 'Woof!', title: 'Golden Retriever' }]),
            footer('Pawsome', 'Love on four legs.', [{ title: 'Care', links: ['Grooming'] }]),
        ],
        pages: [
            { slug: 'index', title: 'Home', layout: [] },
            { slug: 'about', title: 'Lifestyle', layout: aboutPage('Urban Living', 'Modern Property', 'Urban Living') },
            { 
                slug: 'products', 
                title: 'Spaces', 
                layout: productsPage('Urban Living', 'Real Estate', 'Urban Living', [
                    { icon: '🏙️', title: 'Smart Lofts', description: 'IoT-enabled living in the heart of the city.' },
                    { icon: '🌿', title: 'Green Roofs', description: 'Sustainable amenities for a better tomorrow.' },
                    { icon: '🏢', title: 'Shared Spaces', description: 'Coworking and social hubs within reach.' },
                ]) 
            },
            { slug: 'contact', title: 'Visit', layout: contactPage('Urban Living', 'Property', 'Urban Living', 'rent@urbanliving.my', '+60 3-8888 1111', 'Sentral, KL') },
        ],
        tags: [{ tag: 'pets' }, { tag: 'dog' }],
        sortOrder: 24, isPremium: false, isFeatured: false,
    },

    // ─── 25. PERSONAL BRANDING ─────────────────────────────────────────
    {
        name: 'Personal Branding',
        description: 'Direct and professional template for influencers and public speakers.',
        category: ['creative'],
        defaultTheme: { primaryColor: '#2b2d42', secondaryColor: '#8d99ae', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('John Doe', ['Work', 'Speaking', 'Contact'], 'Reach Out'),
            hero('Elevate Your Voice', 'Speaker. Author. Consultant.', 'Hire Me', 'My Story', 'minimal'),
            about('The Journey', 'From zero to authority.', 'About'),
            footer('John Doe', 'Influence.', [{ title: 'Connect', links: ['Linked'] }]),
        ],
        tags: [{ tag: 'brand' }, { tag: 'speaker' }],
        sortOrder: 25, isPremium: false, isFeatured: false,
    },
]
