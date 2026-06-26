/**
 * EN default content for locale-aware block defaults.
 * Strings extracted verbatim from createAddSectionBlock; {brand} replaces inline `brandName` interpolation.
 * Structural fields (variant, layout, icons, urls, array shapes) stay in add-section.ts.
 */
export const BLOCK_CONTENT_EN = {
    hero: {
        headline: 'Welcome to {brand}',
        subheadline:
            'We deliver exceptional products and services that help you achieve your goals. Discover what makes us different.',
        ctaButtons: [
            { label: 'Get Started', url: '#contact', style: 'primary' },
            { label: 'Learn More', url: '#about', style: 'outline' },
        ],
    },

    features: {
        sectionLabelBase: 'Why Choose Us',
        headline: 'Why customers choose {brand}',
        subheadline: 'Three strong reasons to trust this offer.',
        items: [
            { icon: '⚡', title: 'Fast to understand', description: 'Explain the offer clearly so visitors know the value right away.' },
            { icon: '🛡️', title: 'Built on trust', description: 'Reassure visitors with consistency, proof, and confident positioning.' },
            { icon: '🎯', title: 'Made to convert', description: 'Guide visitors toward the next step with simple, focused messaging.' },
        ],
    },

    faq: {
        headline: 'Frequently asked questions about {brand}',
        items: [
            {
                question: 'What makes {brand} different?',
                answer: '{brand} focuses on clear value, polished delivery, and a better customer experience from the first interaction.',
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
    },

    testimonials: {
        headline: 'What customers say about {brand}',
        quoteTemplate: 'Placeholder review {n} for {brand}. Replace this with a real customer story.',
        nameTemplate: 'Customer {n}',
        title: 'Happy Customer',
    },

    team: {
        headline: 'Meet the team behind {brand}',
        members: [
            { name: 'Team Member 1', role: 'Founder', bio: 'Add a short founder introduction here.' },
            { name: 'Team Member 2', role: 'Operations Lead', bio: 'Highlight day-to-day operational excellence.' },
            { name: 'Team Member 3', role: 'Customer Success', bio: 'Show the human side of your brand experience.' },
        ],
    },

    newsletter: {
        headline: 'Stay in the loop with {brand}',
        subheadline: 'Get updates, offers, and useful tips delivered straight to your inbox.',
        buttonLabel: 'Subscribe',
        placeholder: 'Enter your email',
    },

    cta: {
        headline: 'Ready to take the next step with {brand}?',
        subheadline: 'Use this section to highlight your strongest offer or campaign.',
        ctaLabel: 'Get Started',
    },

    contact: {
        headline: 'Get in Touch',
        subtext: "Have a question or want to work together? We'd love to hear from you.",
        formFields: [
            { fieldName: 'name', label: 'Your Name', fieldType: 'text', required: true },
            { fieldName: 'email', label: 'Email Address', fieldType: 'email', required: true },
            { fieldName: 'phone', label: 'Phone', fieldType: 'phone', required: false },
            { fieldName: 'message', label: 'Message', fieldType: 'textarea', required: true },
        ],
    },

    pricing: {
        headline: 'Simple, Transparent Pricing',
        subheadline: 'Choose the plan that works best for you.',
        plans: [
            { name: 'Starter', price: '$9/mo', description: 'Perfect for getting started', features: [{ text: '5 Projects', included: true }, { text: 'Basic Support', included: true }, { text: 'Advanced Features', included: false }], ctaLabel: 'Get Started', ctaUrl: '#' },
            { name: 'Pro', price: '$29/mo', description: 'Best for growing businesses', isPopular: true, features: [{ text: 'Unlimited Projects', included: true }, { text: 'Priority Support', included: true }, { text: 'Advanced Features', included: true }], ctaLabel: 'Get Started', ctaUrl: '#' },
            { name: 'Enterprise', price: '$99/mo', description: 'For large organizations', features: [{ text: 'Everything in Pro', included: true }, { text: 'Dedicated Manager', included: true }, { text: 'Custom Integrations', included: true }], ctaLabel: 'Contact Us', ctaUrl: '#' },
        ],
    },

    stats: {
        headline: '{brand} by the Numbers',
        items: [
            { value: '10K+', label: 'Happy Customers' },
            { value: '50+', label: 'Countries Served' },
            { value: '99%', label: 'Satisfaction Rate' },
            { value: '24/7', label: 'Support Available' },
        ],
    },

    accordion: {
        headline: 'More Information',
        items: [
            { title: 'What services do you offer?', content: '{brand} provides comprehensive solutions tailored to your needs.' },
            { title: 'How can I get started?', content: 'Simply contact us through the form above or give us a call.' },
            { title: 'What are your business hours?', content: 'We are open Monday to Friday, 9am to 6pm.' },
        ],
    },

    'service-cards': {
        headline: 'Our Services',
        subheadline: 'What {brand} can do for you.',
        services: [
            { title: 'Web Design', description: 'Beautiful, responsive websites that convert visitors into customers.', icon: '🎨', price: 'From RM 1,500', priceUnit: '/project' },
            { title: 'SEO Optimization', description: 'Get found on Google with data-driven SEO strategies.', icon: '🔍', price: 'From RM 500', priceUnit: '/month' },
            { title: 'Social Media', description: 'Grow your audience with engaging social content.', icon: '📱', price: 'From RM 800', priceUnit: '/month' },
        ],
    },

    about: {
        sectionLabelBase: 'About Us',
        headline: 'Our Story',
        body: '{brand} was founded with a simple mission: to deliver quality and value to every customer. With years of experience and a passionate team, we continue to grow and innovate.',
    },

    gallery: {
        headline: '{brand} in action',
    },

    products: {
        headline: 'Our Products',
        subheadline: 'Explore our curated collection.',
    },
} as const
