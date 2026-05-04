/**
 * block-preview-demo-content-part2.ts
 * Demo content for commerce, industry, utility, and media blocks.
 * Imported by block-preview-demo-content.ts — do not import directly.
 */
import { IMG, type DemoContent } from './block-preview-demo-content'

const PART2_MAP: Record<string, (variant: string) => DemoContent> = {
  // ── Pricing ──────────────────────────────────────────────────────────────
  pricing: (variant) => ({
    blockType: 'pricing', variant,
    headline: 'Simple, Transparent Pricing',
    subheadline: 'No hidden fees. Cancel anytime.',
    plans: [
      {
        name: 'Starter', price: '$29', period: '/mo',
        description: 'Perfect for small teams getting started.',
        features: [{ text: '5 projects', included: true }, { text: '10 GB storage', included: true }, { text: 'Priority support', included: false }],
        ctaLabel: 'Start Free', ctaUrl: '#', highlighted: false,
      },
      {
        name: 'Pro', price: '$79', period: '/mo',
        description: 'For growing businesses that need more.',
        features: [{ text: 'Unlimited projects', included: true }, { text: '100 GB storage', included: true }, { text: 'Priority support', included: true }],
        ctaLabel: 'Start Free', ctaUrl: '#', highlighted: true,
      },
      {
        name: 'Enterprise', price: '$199', period: '/mo',
        description: 'Custom solutions for large organizations.',
        features: [{ text: 'Unlimited everything', included: true }, { text: '1 TB storage', included: true }, { text: 'Dedicated manager', included: true }],
        ctaLabel: 'Contact Sales', ctaUrl: '#', highlighted: false,
      },
    ],
  }),

  'pricing-table': (variant) => ({
    blockType: 'pricing-table', variant,
    headline: 'Choose Your Plan',
    subheadline: 'Switch plans anytime. No commitment.',
    billingToggle: 'monthly' as const,
    plans: [
      { name: 'Basic', price: '29', yearlyPrice: '23', currency: '$', description: 'For individuals', features: ['5 projects', '10 GB storage', 'Email support'], cta: { label: 'Get Started', url: '#' }, popular: false },
      { name: 'Pro', price: '79', yearlyPrice: '63', currency: '$', description: 'For teams', features: ['Unlimited projects', '100 GB storage', 'Priority support', 'Analytics'], cta: { label: 'Get Started', url: '#' }, popular: true },
    ],
  }),

  // ── Media ─────────────────────────────────────────────────────────────────
  video: (variant) => ({
    blockType: 'video', variant,
    headline: 'See How It Works',
    subheadline: 'Watch our 2-minute product walkthrough.',
    videoUrl: 'https://www.youtube.com/embed/k2maqlyUuVw',
    posterImage: IMG.hero,
  }),

  'video-background': (variant) => ({
    blockType: 'video-background', variant,
    headline: 'The Future Starts Here',
    subheadline: 'Launch your next big idea with confidence.',
    videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4',
    posterImage: IMG.nature,
    overlayOpacity: 50,
    cta: { label: 'Explore Now', url: '#' },
  }),

  'video-showcase': (variant) => ({
    blockType: 'video-showcase', variant,
    headline: 'Watch Our Best Work',
    subheadline: 'Projects we are proud of',
    showCategories: true,
    autoplay: false,
    videos: [
      { title: 'Brand Launch Film', videoUrl: 'https://www.youtube.com/embed/k2maqlyUuVw', thumbnailUrl: IMG.hero, category: 'Branding', duration: '2:30' },
      { title: 'Product Demo', videoUrl: 'https://www.youtube.com/embed/k2maqlyUuVw', thumbnailUrl: IMG.office, category: 'Product', duration: '4:15' },
    ],
  }),

  'gallery-masonry': (variant) => ({
    blockType: 'gallery-masonry', variant,
    headline: 'Our Portfolio',
    images: [
      { url: IMG.office, alt: 'Office space', caption: 'Headquarters' },
      { url: IMG.hero, alt: 'Team at work', caption: 'Team meeting' },
      { url: IMG.nature, alt: 'Nature', caption: 'Company retreat' },
      { url: IMG.real, alt: 'Building', caption: 'New office' },
      { url: IMG.product, alt: 'Product', caption: 'Product shoot' },
    ],
  }),

  carousel: (variant) => ({
    blockType: 'carousel', variant,
    headline: 'Latest from Our Portfolio',
    autoplay: true,
    interval: 5000,
    items: [
      { imageUrl: IMG.hero, title: 'Modern Workspace', description: 'Designed for creativity and collaboration.' },
      { imageUrl: IMG.nature, title: 'Nature Retreat', description: 'Where great ideas are born.' },
      { imageUrl: IMG.office, title: 'Downtown Office', description: 'Heart of the city, heart of innovation.' },
    ],
  }),

  'portfolio-grid': (variant) => ({
    blockType: 'portfolio-grid', variant,
    headline: 'Our Work',
    subheadline: 'Projects we have delivered with pride',
    projects: [
      { title: 'E-commerce Redesign', description: 'Complete overhaul of shopping experience.', imageUrl: IMG.hero, category: 'Web Design', linkUrl: '#' },
      { title: 'Brand Identity', description: 'Logo, colors, and typography system.', imageUrl: IMG.office, category: 'Branding', linkUrl: '#' },
      { title: 'Mobile App', description: 'iOS and Android fitness tracking app.', imageUrl: IMG.product, category: 'Mobile', linkUrl: '#' },
      { title: 'Marketing Site', description: 'Launch campaign with 200% conversion lift.', imageUrl: IMG.nature, category: 'Web Design', linkUrl: '#' },
    ],
  }),

  // ── Social / Trust ────────────────────────────────────────────────────────
  'social-proof': (variant) => ({
    blockType: 'social-proof', variant,
    headline: 'What Customers Are Saying',
    reviews: [
      { author: 'Lisa M.', role: 'Product Manager', content: 'Absolutely love the platform. Our team productivity improved dramatically.', rating: 5 },
      { author: 'David K.', role: 'Startup Founder', content: 'Best investment we made this year. ROI was clear within 60 days.', rating: 5 },
      { author: 'Anna R.', role: 'Designer', content: 'The UI is so intuitive. Took minutes to get started.', rating: 4 },
    ],
  }),

  'review-cards': (variant) => ({
    blockType: 'review-cards', variant,
    headline: 'Customer Reviews',
    showAverage: true,
    totalReviewCount: 342,
    reviews: [
      { name: 'James L.', rating: 5, text: 'Exceptional product. Changed how our whole team works.', date: '2024-11', source: 'Google', verified: true },
      { name: 'Maria S.', rating: 5, text: 'Support team is incredible. Fast, friendly, and knowledgeable.', date: '2024-10', source: 'Trustpilot', verified: true },
      { name: 'Chris W.', rating: 4, text: 'Great features. Minor learning curve but worth it.', date: '2024-09', source: 'G2', verified: false },
    ],
  }),

  'client-logos': (variant) => ({
    blockType: 'client-logos', variant,
    headline: 'Trusted by 500+ Companies',
    logos: [
      { url: IMG.product, alt: 'Acme Corp', linkUrl: '#' },
      { url: IMG.product, alt: 'TechCo', linkUrl: '#' },
      { url: IMG.product, alt: 'FinCo', linkUrl: '#' },
      { url: IMG.product, alt: 'HealthCo', linkUrl: '#' },
      { url: IMG.product, alt: 'MediaCo', linkUrl: '#' },
    ],
  }),

  socialWidget: (variant) => ({
    blockType: 'socialWidget', variant,
    headline: 'Follow Us',
    links: [
      { platform: 'facebook' as const, url: 'https://facebook.com/example', enabled: true },
      { platform: 'instagram' as const, url: 'https://instagram.com/example', enabled: true },
      { platform: 'whatsapp' as const, url: 'https://wa.me/60123456789', enabled: true },
    ],
  }),

  // ── Content / Info ────────────────────────────────────────────────────────
  accordion: (variant) => ({
    blockType: 'accordion', variant,
    headline: 'Product Details',
    items: [
      { title: 'What is included?', content: 'Full access to all features, onboarding support, and documentation.' },
      { title: 'How do I get started?', content: 'Sign up, complete the setup wizard, and you are live in 30 minutes.' },
      { title: 'Is there a free trial?', content: 'Yes — 14-day free trial, no credit card required.' },
    ],
  }),

  'step-process': (variant) => ({
    blockType: 'step-process', variant,
    headline: 'How It Works',
    subheadline: 'Get set up in three simple steps',
    steps: [
      { title: 'Create Your Account', description: 'Sign up in 60 seconds. No credit card needed.', icon: 'user-plus' },
      { title: 'Customize Your Site', description: 'Choose a template and make it yours with our visual editor.', icon: 'edit' },
      { title: 'Go Live', description: 'Publish with one click and share your site with the world.', icon: 'rocket' },
    ],
  }),

  'feature-comparison': (variant) => ({
    blockType: 'feature-comparison', variant,
    headline: 'Compare Plans',
    products: [
      { name: 'Free', highlighted: false },
      { name: 'Pro', highlighted: true },
      { name: 'Enterprise', highlighted: false },
    ],
    features: [
      { name: 'Custom domain', values: [false, true, true] },
      { name: 'Analytics', values: [false, true, true] },
      { name: 'Priority support', values: [false, false, true] },
      { name: 'Team members', values: [false, true, true] },
    ],
  }),

  'before-after': (variant) => ({
    blockType: 'before-after', variant,
    headline: 'The Transformation',
    beforeImage: { url: IMG.office, alt: 'Before', label: 'Before' },
    afterImage:  { url: IMG.hero, alt: 'After', label: 'After' },
  }),

  'service-cards': (variant) => ({
    blockType: 'service-cards', variant,
    headline: 'Our Services',
    subheadline: 'Tailored solutions for every business need',
    services: [
      { title: 'Web Design', description: 'Beautiful, conversion-focused websites for your brand.', icon: 'monitor', price: 'From $999', priceUnit: 'one-time', cta: { label: 'Learn More', url: '#' } },
      { title: 'SEO Optimization', description: 'Rank higher and drive organic traffic to your site.', icon: 'search', price: 'From $299', priceUnit: '/mo', cta: { label: 'Learn More', url: '#' } },
      { title: 'Social Media', description: 'Engage your audience and grow your following.', icon: 'share-2', price: 'From $199', priceUnit: '/mo', cta: { label: 'Learn More', url: '#' } },
    ],
  }),

  // ── Utility / System ──────────────────────────────────────────────────────
  divider: (variant) => ({
    blockType: 'divider', variant,
    height: 40,
  }),

  breadcrumb: (variant) => ({
    blockType: 'breadcrumb', variant,
    items: [
      { label: 'Home', url: '#' },
      { label: 'Products', url: '#' },
      { label: 'Web Builder' },
    ],
  }),

  'announcement-bar': (variant) => ({
    blockType: 'announcement-bar', variant,
    message: '🎉 Limited offer: 30% off all annual plans this week only!',
    linkText: 'Claim discount',
    linkUrl: '#',
    dismissible: true,
  }),

  'countdown-timer': (variant) => ({
    blockType: 'countdown-timer', variant,
    headline: 'Sale Ends In',
    targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    expiredMessage: 'Offer has ended.',
    showDays: true, showHours: true, showMinutes: true, showSeconds: true,
  }),

  'download-cta': (variant) => ({
    blockType: 'download-cta', variant,
    headline: 'Download Our Free Guide',
    description: 'The definitive playbook for scaling your online presence in 2025.',
    fileUrl: '#',
    fileName: '2025-growth-playbook.pdf',
    fileSize: '2.4 MB',
    buttonLabel: 'Download Free',
    requireEmail: false,
  }),

  'whatsapp-button': (variant) => ({
    blockType: 'whatsapp-button', variant,
    phoneNumber: '60123456789',
    message: 'Hi! I am interested in learning more about your services.',
    label: 'Chat with us',
    position: 'bottom-right' as const,
  }),

  'google-maps': (variant) => ({
    blockType: 'google-maps', variant,
    embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3983.8262695!2d101.686!3d3.1569!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zM8KwMDknMjQuOSJOIDEwMcKwNDEnMDkuNiJF!5e0!3m2!1sen!2smy!4v1000000000000',
    headline: 'Find Us Here',
    address: '123 Main Street, Kuala Lumpur, Malaysia',
    height: 400,
  }),

  'custom-html': () => ({
    blockType: 'custom-html',
    html: '<div style="padding:40px;text-align:center;background:#f8f9fa;border-radius:8px"><p style="font-size:14px;color:#6b7280">Custom HTML block — your code renders here.</p></div>',
  }),

  // ── Industry ──────────────────────────────────────────────────────────────
  'booking-widget': (variant) => ({
    blockType: 'booking-widget', variant,
    headline: 'Book a Consultation',
    subheadline: 'Choose a time that works for you',
    availableDays: [1, 2, 3, 4, 5],
    timeSlotInterval: 30,
    startTime: '09:00',
    endTime: '17:00',
    showPrice: true,
    services: [
      { name: 'Strategy Session', duration: 60, price: 150, description: '1-hour deep-dive consultation.' },
      { name: 'Quick Check-in', duration: 30, price: 75, description: '30-minute focused Q&A.' },
    ],
  }),

  'class-schedule': (variant) => ({
    blockType: 'class-schedule', variant,
    headline: 'Weekly Class Schedule',
    showCapacity: true,
    highlightToday: true,
    classes: [
      { name: 'Yoga Flow', instructor: 'Emma L.', day: 1, startTime: '07:00', endTime: '08:00', capacity: 20, enrolled: 14, category: 'Wellness', level: 'All levels' },
      { name: 'HIIT Blast', instructor: 'Jake M.', day: 2, startTime: '18:00', endTime: '19:00', capacity: 15, enrolled: 15, category: 'Fitness', level: 'Intermediate' },
      { name: 'Pilates Core', instructor: 'Sophie R.', day: 3, startTime: '09:00', endTime: '10:00', capacity: 12, enrolled: 8, category: 'Wellness', level: 'Beginner' },
    ],
  }),

  'doctor-profile': (variant) => ({
    blockType: 'doctor-profile', variant,
    headline: 'Our Medical Team',
    subheadline: 'Experienced specialists dedicated to your health',
    doctors: [
      { name: 'Dr. Sarah Chen', specialisation: 'Cardiologist', qualifications: ['MBBS', 'MRCP', 'FESC'], photoUrl: IMG.person1, availableDays: [1, 2, 4], languages: 'English, Mandarin', consultationFee: 'RM 250', bio: '15 years of experience in interventional cardiology.' },
      { name: 'Dr. Ali Hassan', specialisation: 'Orthopaedic Surgeon', qualifications: ['MBBS', 'MS Ortho'], photoUrl: IMG.person2, availableDays: [2, 3, 5], languages: 'English, Malay', consultationFee: 'RM 200', bio: 'Specialist in sports injuries and joint replacement.' },
    ],
  }),

  'property-card': (variant) => ({
    blockType: 'property-card', variant,
    headline: 'Featured Properties',
    subheadline: 'Handpicked listings for discerning buyers',
    showMap: false,
    currency: 'RM',
    properties: [
      { title: 'Modern Penthouse in KLCC', price: 2800000, location: 'Kuala Lumpur City Centre', bedrooms: 4, bathrooms: 3, area: 2400, imageUrls: [IMG.real], type: 'sale' as const, status: 'Available', description: 'Stunning panoramic views of the city skyline.' },
      { title: 'Garden Terrace in Bangsar', price: 5500, location: 'Bangsar, KL', bedrooms: 3, bathrooms: 2, area: 1600, imageUrls: [IMG.office], type: 'rent' as const, status: 'Available', description: 'Serene garden unit in a quiet enclave.' },
    ],
  }),
}

export function buildDemoContentPart2(slug: string, variant: string): DemoContent {
  const builder = PART2_MAP[slug]
  if (builder) return builder(variant)
  // Minimal fallback for any unknown block
  return { blockType: slug, variant }
}
