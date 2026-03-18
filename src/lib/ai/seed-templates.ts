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
    tags: { tag: string }[]
    sortOrder: number
    isPremium: boolean
    isFeatured: boolean
}

// Helper to build nav block
const nav = (logo: string, links: string[], cta: string) => ({
    blockType: 'navigation', variant: 'simple',
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
    blockType: 'features', variant: 'grid-3', headline: h, subheadline: sub,
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

export const SEED_TEMPLATES: TemplateSeed[] = [
    // ─── 1. RESTAURANT / CAFE / F&B ──────────────────────────────────────
    {
        name: 'Restaurant / Cafe / F&B',
        description: 'Template for restaurants, cafes, and bakeries with menu highlights and opening hours.',
        category: ['restaurant'],
        defaultTheme: { primaryColor: '#D97706', secondaryColor: '#92400E', fontHeading: 'Playfair Display', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Sample Restaurant', ['Home', 'Menu', 'About Us', 'Contact'], 'Book a Table'),
            hero('Rich Flavours, Incredible Experiences', 'Discover refined cuisine crafted from the freshest ingredients by our award-winning chefs.', 'View Menu', 'Book a Table', 'split'),
            features('Featured Menu', 'Our most popular dishes', [
                { icon: '🥩', title: 'Wagyu Steak', desc: 'Premium A5 Wagyu beef, grilled on traditional charcoal.' },
                { icon: '🍝', title: 'Truffle Pasta', desc: 'Fresh pasta with black truffle and Parmesan cheese.' },
                { icon: '🍣', title: 'Mixed Sashimi', desc: 'Salmon, tuna, and sweet shrimp from Japan.' },
            ], 'Menu'),
            about('Our Story', 'With over 10 years of experience, we bring you a refined and cosy dining atmosphere. Every dish is a work of culinary art.', 'About Us'),
            testimonials('What Our Guests Say', [
                { name: 'Sarah L.', quote: 'Wonderful ambience, exceptional food. Will definitely come back!', title: 'Food Blogger' },
                { name: 'James T.', quote: 'Professional service, true fine-dining experience.', title: 'Entrepreneur' },
                { name: 'Aina R.', quote: 'Perfect birthday dinner. Thank you so much!', title: 'Customer' },
            ]),
            contact('Reservations & Contact', 'hello@samplerestaurant.com', '+60 3-1234 5678', '123 Jalan Bukit Bintang, KL'),
            footer('Sample Restaurant', 'Rich flavours, incredible experiences.', [
                { title: 'Opening Hours', links: ['Mon-Fri: 10:00 - 22:00', 'Sat-Sun: 08:00 - 23:00'] },
                { title: 'Quick Links', links: ['Menu', 'Reservations', 'About Us'] },
            ]),
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
            hero('Radiate Your Natural Beauty', 'Experience premium beauty treatments that help you feel confident and radiant every day.', 'Book Now', 'View Services', 'split'),
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
            hero('Your Health is Our Priority', 'Experienced medical professionals, modern equipment, and dedicated care.', 'Book Appointment', 'Free Consultation', 'split'),
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
            hero('Learn Today, Succeed Tomorrow', 'Practical courses from industry experts. Guaranteed outcomes and career support.', 'View Courses', 'Free Consultation', 'split'),
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
            hero('Stronger Every Day', 'Modern gym, professional trainers. Start your journey to transform your life.', 'Free Trial', 'View Plans', 'split'),
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
        tags: [{ tag: 'portfolio' }, { tag: 'freelancer' }, { tag: 'agency' }],
        sortOrder: 9, isPremium: false, isFeatured: true,
    },

    // ─── 10. BUSINESS / CORPORATE ─────────────────────────────────────
    {
        name: 'Business / Corporate',
        description: 'Versatile template for any type of business.',
        category: ['business'],
        defaultTheme: { primaryColor: '#2563EB', secondaryColor: '#3B82F6', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('Enterprise Co', ['Home', 'Services', 'About Us', 'Contact'], 'Contact Us'),
            hero('Professional Solutions for Your Business', 'Your trusted partner for sustainable and effective business growth.', 'Learn More', 'Get in Touch'),
            features('Our Services', 'Comprehensive solutions for businesses', [
                { icon: '📋', title: 'Strategy Consulting', desc: 'Building the right growth strategy for your goals.' },
                { icon: '⚙️', title: 'Implementation', desc: 'Expert team for fast, effective deployment.' },
                { icon: '📊', title: 'Measure & Optimise', desc: 'KPI tracking, continuous performance improvement.' },
            ], 'Services'),
            about('About Us', 'We are a team of experienced professionals committed to delivering the best solutions for your business.', 'About Us'),
            stats('Achievements', [
                { value: '100+', label: 'Clients' }, { value: '10+', label: 'Years Experience' },
                { value: '500+', label: 'Projects' }, { value: '99%', label: 'Satisfaction' },
            ]),
            testimonials('Partner Testimonials', [
                { name: 'CEO, Company A', quote: 'Professional service, results exceeded expectations.', title: 'CEO' },
                { name: 'Manager, Company B', quote: 'Dedicated team, always available when needed.', title: 'Manager' },
            ]),
            cta('Ready to Grow?', 'Contact us today for a tailored consultation.', 'Get in Touch'),
            contact('Contact Us', 'info@enterprise.my', '+60 3-1234 5678', 'Kuala Lumpur, Malaysia'),
            footer('Enterprise Co', 'Growing together with your business.', [
                { title: 'Services', links: ['Consulting', 'Implementation', 'Support'] },
                { title: 'Quick Links', links: ['Blog', 'Careers', 'Partners'] },
            ]),
        ],
        tags: [{ tag: 'business' }, { tag: 'corporate' }, { tag: 'enterprise' }],
        sortOrder: 10, isPremium: false, isFeatured: false,
    },
,
    // ─── ADDITIONAL RESTAURANT / F&B ─────────────────────────────────────
    {
        name: 'Boutique Coffee Shop',
        description: 'Perfect for local cafes with a focus on artisanal coffee and pastries.',
        category: ['restaurant', 'cafe'],
        defaultTheme: { primaryColor: '#8B4513', secondaryColor: '#A0522D', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('ArtisanBrew', ['Menu', 'Our Story', 'Locations'], 'Order Online'),
            hero('Crafted With Love', 'Experience the finest artisanal coffee sourced responsibly from local farmers.', 'View Menu', undefined, 'minimal'),
            gallery('Our Cafe', 4),
            contact('Find Us', 'hello@artisanbrew.my', '+60 12-321 4321', 'KL'),
            footer('ArtisanBrew', 'Bringing you the perfect cup every day.', [])
        ],
        tags: [{ tag: 'cafe' }, { tag: 'coffee' }],
        sortOrder: 11, isPremium: false, isFeatured: false,
    },
    {
        name: 'Fine Dining Experience',
        description: 'An elegant template for upscale restaurants and exclusive dining venues.',
        category: ['restaurant'],
        defaultTheme: { primaryColor: '#B8860B', secondaryColor: '#DAA520', fontHeading: 'Playfair Display', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('L\'Élégance', ['Menu', 'Reservations', 'Private Dining'], 'Book Table'),
            hero('A Symphony of Taste', 'Indulge in a culinary journey crafted by Michelin-starred chefs.', 'Make a Reservation', undefined, 'centered'),
            about('The Chef', 'Chef Pierre brings 20 years of Parisian excellence to Kuala Lumpur.', 'About Us'),
            contact('Reservations', 'reserve@lelegance.my', '+60 3-8888 9999', 'Bukit Bintang, KL'),
            footer('L\'Élégance', 'A taste of perfection.', [])
        ],
        tags: [{ tag: 'restaurant' }, { tag: 'fine-dining' }],
        sortOrder: 12, isPremium: true, isFeatured: true,
    },
    // ─── ADDITIONAL ECOMMERCE / FASHION ──────────────────────────────
    {
        name: 'Minimalist Fashion Store',
        description: 'Clean and modern template perfect for boutique clothing and accessories.',
        category: ['ecommerce', 'fashion'],
        defaultTheme: { primaryColor: '#27272A', secondaryColor: '#52525B', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('NOIR', ['Shop', 'Collections', 'Lookbook'], 'Cart'),
            hero('Essential Neutrals', 'Discover our new collection of sustainable, everyday essentials.', 'Shop Collection', undefined, 'split'),
            features('Why Choose Us', 'Sustainable and ethical.', [
                { icon: '🌿', title: 'Eco-Friendly', desc: '100% organic cotton.' },
                { icon: '♻️', title: 'Sustainable', desc: 'Recycled packaging.' }
            ], 'Ethics'),
            footer('NOIR', 'Minimalist fashion for the modern era.', [])
        ],
        tags: [{ tag: 'fashion' }, { tag: 'clothing' }],
        sortOrder: 13, isPremium: false, isFeatured: false,
    },
    {
        name: 'Tech Gadgets Store',
        description: 'Optimized for electronics and digital accessory retailers.',
        category: ['ecommerce', 'tech'],
        defaultTheme: { primaryColor: '#0EA5E9', secondaryColor: '#0284C7', fontHeading: 'Inter', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('GadgetPro', ['Products', 'Brands', 'Support'], 'Deals'),
            hero('Next-Gen Tech', 'Upgrade your life with the latest smart devices and wearables.', 'Shop Now', undefined, 'centered'),
            stats('Our Reach', [{ value: '1M+', label: 'Products Sold' }, { value: '24/7', label: 'Support' }]),
            footer('GadgetPro', 'Your lifestyle, upgraded.', [])
        ],
        tags: [{ tag: 'tech' }, { tag: 'gadgets' }],
        sortOrder: 14, isPremium: false, isFeatured: true,
    },
    // ─── ADDITIONAL TECH / SAAS ──────────────────────────────────────
    {
        name: 'SaaS Startup Landing',
        description: 'A vibrant template designed to convert visitors into software users.',
        category: ['tech', 'saas'],
        defaultTheme: { primaryColor: '#4F46E5', secondaryColor: '#4338CA', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('AppFlow', ['Features', 'Pricing', 'Docs'], 'Get Started'),
            hero('Streamline Your Workflow', 'The all-in-one platform for team productivity and collaboration.', 'Start Free Trial', 'Watch Video', 'split'),
            pricing('Simple Pricing', 'Pay as you grow', [
                { name: 'Basic', price: '$0/mo', desc: 'Free forever', features: ['Core features'] },
                { name: 'Pro', price: '$15/mo', desc: 'For teams', features: ['All features', 'Priority support'] }
            ]),
            footer('AppFlow', 'Work smarter, not harder.', [])
        ],
        tags: [{ tag: 'saas' }, { tag: 'software' }],
        sortOrder: 15, isPremium: false, isFeatured: false,
    },
    {
        name: 'CyberSecurity Firm',
        description: 'Build trust and authority with this sleek, secure-looking template.',
        category: ['tech', 'business'],
        defaultTheme: { primaryColor: '#10B981', secondaryColor: '#047857', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('ShieldGuard', ['Services', 'Threat Intel', 'Contact'], 'Get Audit'),
            hero('Secure Your Digital Assets', 'Enterprise-grade protection against modern cyber threats.', 'Request Assessment', undefined, 'centered'),
            features('Our Expertise', 'Comprehensive defense', [
                { icon: '🛡️', title: 'Endpoint Protection', desc: 'AI-driven malware defense.' },
                { icon: '🔒', title: 'Network Security', desc: 'Zero-trust architecture implementation.' }
            ], 'Services'),
            footer('ShieldGuard', 'Protecting your digital frontier.', [])
        ],
        tags: [{ tag: 'security' }, { tag: 'tech' }],
        sortOrder: 16, isPremium: true, isFeatured: false,
    },
    // ─── ADDITIONAL FITNESS / GYM ────────────────────────────────────
    {
        name: 'Yoga Retreat Studio',
        description: 'Serene and calming template designed for yoga studios and wellness retreats.',
        category: ['fitness', 'wellness'],
        defaultTheme: { primaryColor: '#14B8A6', secondaryColor: '#0D9488', fontHeading: 'Cormorant Garamond', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('Zenith Yoga', ['Classes', 'Retreats', 'Instructors'], 'Book Class'),
            hero('Find Your Inner Peace', 'Join our community and discover harmony of mind, body, and spirit.', 'Join Now', 'Learn More', 'centered'),
            gallery('Our Sanctuary', 4),
            footer('Zenith Yoga', 'Breathe deeply. Live fully.', [])
        ],
        tags: [{ tag: 'yoga' }, { tag: 'wellness' }],
        sortOrder: 17, isPremium: false, isFeatured: false,
    },
    {
        name: 'CrossFit Box',
        description: 'High-energy template for CrossFit boxes and intense training centers.',
        category: ['fitness', 'gym'],
        defaultTheme: { primaryColor: '#F97316', secondaryColor: '#EA580C', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('IronForge', ['WODs', 'Coaches', 'Drop-in'], 'Join the Box'),
            hero('Push Your Limits', 'Elite training facility for those who demand more from themselves.', 'Start Training', undefined, 'split'),
            team('Expert Coaches', [{ name: 'Coach Mike', role: 'Head Trainer' }]),
            footer('IronForge CrossFit', 'Forged in sweat.', [])
        ],
        tags: [{ tag: 'crossfit' }, { tag: 'gym' }],
        sortOrder: 18, isPremium: true, isFeatured: false,
    },
    // ─── ADDITIONAL HEALTH / MEDICAL ─────────────────────────────────
    {
        name: 'Pediatric Clinic',
        description: 'Friendly and reassuring template for pediatricians and child healthcare.',
        category: ['health', 'clinic'],
        defaultTheme: { primaryColor: '#06B6D4', secondaryColor: '#0891B2', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('LittleSmiles', ['Services', 'Doctors', 'Parent Resources'], 'Book Appointment'),
            hero('Caring for Your Little Ones', 'Expert pediatric care in a fun, child-friendly environment.', 'Schedule Visit', undefined, 'split'),
            testimonials('Happy Parents', [{ name: 'Sarah', quote: 'The doctors are so patient and kind.', title: 'Mom of two' }]),
            footer('LittleSmiles Clinic', 'Growing healthy together.', [])
        ],
        tags: [{ tag: 'pediatric' }, { tag: 'clinic' }],
        sortOrder: 19, isPremium: false, isFeatured: false,
    },
    {
        name: 'Specialist Medical Center',
        description: 'Professional template for specialized medical practices and diagnostic centers.',
        category: ['health'],
        defaultTheme: { primaryColor: '#2563EB', secondaryColor: '#1D4ED8', fontHeading: 'Inter', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('Apex Specialists', ['Specialties', 'Patient Info', 'Contact'], 'Patient Portal'),
            hero('Advanced Medical Care', 'Leading experts providing world-class specialized treatments.', 'Our Services', 'Contact Us', 'centered'),
            stats('Excellence', [{ value: '50+', label: 'Specialists' }, { value: '24/7', label: 'Emergency Care' }]),
            footer('Apex Medical Center', 'Excellence in healthcare.', [])
        ],
        tags: [{ tag: 'hospital' }, { tag: 'health' }],
        sortOrder: 20, isPremium: true, isFeatured: true,
    },
    // ─── ADDITIONAL EDUCATION ────────────────────────────────────────
    {
        name: 'Language Institute',
        description: 'Perfect for language schools offering online or in-person courses.',
        category: ['education'],
        defaultTheme: { primaryColor: '#8B5CF6', secondaryColor: '#7C3AED', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('Polyglot Academy', ['Languages', 'Tutors', 'Pricing'], 'Start Learn'),
            hero('Master a New Language', 'Interactive courses taught by native speakers. Fluency guaranteed.', 'Explore Courses', undefined, 'split'),
            stats('Languages', [{ value: '20+', label: 'To choose from' }]),
            footer('Polyglot Academy', 'Connect with the world.', [])
        ],
        tags: [{ tag: 'language' }, { tag: 'education' }],
        sortOrder: 21, isPremium: false, isFeatured: false,
    },
    {
        name: 'Online Bootcamp',
        description: 'Modern landing for coding or design bootcamps moving fast.',
        category: ['education', 'tech'],
        defaultTheme: { primaryColor: '#EC4899', secondaryColor: '#DB2777', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'dark' },
        defaultBlocks: [
            nav('CodeCamp', ['Curriculum', 'Alumni', 'Admissions'], 'Apply Now'),
            hero('Launch Your Tech Career', 'Intensive 12-week programs to transform your future.', 'Apply Today', 'Download Syllabus', 'centered'),
            faq('Admissions FAQ', [{ q: 'Is financing available?', a: 'Yes, we offer ISA and direct loans.' }]),
            footer('CodeCamp', 'Code your future.', [])
        ],
        tags: [{ tag: 'bootcamp' }, { tag: 'coding' }],
        sortOrder: 22, isPremium: true, isFeatured: true,
    },
    // ─── ADDITIONAL BUSINESS / SERVICES ──────────────────────────────
    {
        name: 'Consulting Agency',
        description: 'Sleek corporate template for management and financial consultants.',
        category: ['business', 'service'],
        defaultTheme: { primaryColor: '#0F172A', secondaryColor: '#1E293B', fontHeading: 'Playfair Display', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('Nexus Consulting', ['Expertise', 'Industries', 'Insights'], 'Get Advice'),
            hero('Strategic Growth Partners', 'Data-driven insights to navigate complex business challenges.', 'Our Expertise', undefined, 'minimal'),
            about('Our Vision', 'We partner with visionary leaders to create lasting impact.', 'About Us'),
            footer('Nexus Consulting', 'Strategy. Execution. Results.', [])
        ],
        tags: [{ tag: 'consulting' }, { tag: 'business' }],
        sortOrder: 23, isPremium: false, isFeatured: false,
    },
    {
        name: 'Legal Services',
        description: 'Trustworthy and authoritative design for law firms and legal advisors.',
        category: ['business', 'service'],
        defaultTheme: { primaryColor: '#6B7280', secondaryColor: '#4B5563', fontHeading: 'Cormorant Garamond', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('Liberty Law', ['Practice Areas', 'Attorneys', 'Case Studies'], 'Free Consultation'),
            hero('Defending Your Rights', 'Experienced advocates dedicated to achieving the best outcomes.', 'Practice Areas', undefined, 'split'),
            team('Partners', [{ name: 'John Doe, Esq.', role: 'Senior Partner' }]),
            footer('Liberty Law Firm', 'Justice prevails.', [])
        ],
        tags: [{ tag: 'law' }, { tag: 'legal' }],
        sortOrder: 24, isPremium: true, isFeatured: false,
    },
    {
        name: 'Home Repair Services',
        description: 'Accessible template for plumbers, electricians, and local contractors.',
        category: ['service', 'business'],
        defaultTheme: { primaryColor: '#F59E0B', secondaryColor: '#D97706', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
        defaultBlocks: [
            nav('FixIt Pros', ['Services', 'Reviews', 'Contact'], 'Book Service'),
            hero('Fast, Reliable Repairs', 'Your trusted local experts for all home maintenance needs.', 'Get an Estimate', 'Call Now', 'split'),
            features('Our Services', 'We fix it all', [
                { icon: '🔧', title: 'Plumbing', desc: 'Leaks, clogs, and piping.' },
                { icon: '⚡', title: 'Electrical', desc: 'Wiring, fixtures, and panels.' }
            ], 'Services'),
            footer('FixIt Pros', 'We do it right the first time.', [])
        ],
        tags: [{ tag: 'contractor' }, { tag: 'repair' }],
        sortOrder: 25, isPremium: false, isFeatured: true,
    }

]
