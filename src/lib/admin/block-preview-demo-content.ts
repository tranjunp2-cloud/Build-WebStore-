/**
 * block-preview-demo-content.ts
 * Neutral demo content for SSR block previews in variant-gallery.
 * NOT industry-specific, NOT AI-generated. Just enough to render each block.
 *
 * Blocks requiring live data (products/blog/cart) return null → route shows
 * a fallback card instead of 404.
 *
 * Split: hero/content/social in this file, commerce/industry/utility in -part2.ts
 */
import { buildDemoContentPart2 } from './block-preview-demo-content-part2'

// ── Constants ────────────────────────────────────────────────────────────────

export type DemoContent = Record<string, unknown> | null

/** Blocks that require live DB data — preview route shows fallback card */
export const LIVE_DATA_BLOCKS = new Set([
  'products-featured',
  'products-grid',
  'product-quick-view',
  'blog-list',
  'cart-widget',
  'cartWidget',
  'menu-food',
  'menu-display',
])

/** Shared Unsplash image URLs — stable CDN, no expiry. Exported for part2. */
export const IMG = {
  office: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&auto=format&fit=crop',
  team:   'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop',
  hero:   'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&auto=format&fit=crop',
  nature: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&auto=format&fit=crop',
  city:   'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&auto=format&fit=crop',
  person1:'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop',
  person2:'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop',
  person3:'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop',
  product:'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop',
  real:   'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&auto=format&fit=crop',
  food:   'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&auto=format&fit=crop',
} as const

// ── Demo content map: hero / layout / content / social blocks ────────────────

const DEMO_CONTENT_MAP: Record<string, (variant: string) => DemoContent> = {
  hero: (variant) => ({
    blockType: 'hero', variant,
    headline: 'Transform Your Business with Modern Tools',
    subheadline: 'Build a beautiful, high-performing website in minutes — no code required.',
    ctaButtons: [
      { label: 'Get Started', url: '#', style: 'primary' },
      { label: 'Learn More', url: '#', style: 'secondary' },
    ],
    image: { url: IMG.hero, alt: 'Team at work' },
    badge: { show: true, text: 'Trusted by 5,000+ businesses' },
    overlay: false,
    height: '90vh',
  }),

  navigation: (variant) => ({
    blockType: 'navigation', variant,
    logoText: 'BrandName',
    links: [
      { label: 'Home', url: '#' },
      { label: 'Features', url: '#' },
      { label: 'Pricing', url: '#' },
      { label: 'About', url: '#' },
    ],
    ctaButton: { show: true, label: 'Get Started', url: '#' },
  }),

  features: (variant) => ({
    blockType: 'features', variant,
    headline: 'Everything You Need to Succeed',
    subheadline: 'Powerful features built for growing teams',
    features: [
      { title: 'Fast & Reliable', description: 'Built on modern cloud infrastructure for 99.9% uptime.', icon: 'zap' },
      { title: 'Secure by Default', description: 'Enterprise-grade security protecting your data 24/7.', icon: 'shield' },
      { title: 'Easy to Use', description: 'Intuitive interface anyone on your team can master quickly.', icon: 'smile' },
      { title: 'Analytics Built In', description: 'Track performance with real-time dashboards and reports.', icon: 'bar-chart' },
      { title: 'Team Collaboration', description: 'Work together seamlessly from anywhere in the world.', icon: 'users' },
      { title: 'Integrations', description: 'Connect to 100+ tools your team already uses every day.', icon: 'plug' },
    ],
  }),

  about: (variant) => ({
    blockType: 'about', variant,
    headline: 'Our Story',
    body: 'We started with a simple mission: make great websites accessible to every business owner. '
      + 'Since 2018, we have helped thousands of companies build their online presence without needing a developer.',
    image: { url: IMG.office, alt: 'Our office' },
    layout: 'image-right',
    timelineItems: [
      { year: '2018', title: 'Founded', description: 'Started with 3 people and a big idea.' },
      { year: '2020', title: '1,000 Customers', description: 'Reached our first major milestone.' },
      { year: '2023', title: 'Global Expansion', description: 'Launched in 12 new markets.' },
    ],
  }),

  testimonials: (variant) => ({
    blockType: 'testimonials', variant,
    headline: 'What Our Customers Say',
    testimonials: [
      { quote: 'This platform transformed how we present our brand online. Revenue up 40% in 3 months.', name: 'Sarah Chen', title: 'CEO', company: 'TechFlow Inc', rating: 5 },
      { quote: 'Incredibly easy to use. We launched our new site in a single afternoon — no developer needed.', name: 'Marcus Johnson', title: 'Marketing Director', company: 'Bloom Agency', rating: 5 },
      { quote: 'Outstanding support team. Every question answered within hours. Highly recommend.', name: 'Priya Patel', title: 'Founder', company: 'NovaMed', rating: 5 },
    ],
  }),

  stats: (variant) => ({
    blockType: 'stats', variant,
    headline: 'Numbers That Speak for Themselves',
    stats: [
      { value: '5,000', label: 'Happy Customers', suffix: '+' },
      { value: '99.9', label: 'Uptime', suffix: '%' },
      { value: '24', label: 'Support', suffix: '/7' },
      { value: '120', label: 'Countries', suffix: '+' },
    ],
  }),

  team: (variant) => ({
    blockType: 'team', variant,
    headline: 'Meet Our Team',
    subheadline: 'Passionate people building the future of web',
    members: [
      { name: 'Alex Rivera', role: 'CEO & Co-Founder', avatar: { url: IMG.person1, alt: 'Alex Rivera' }, bio: 'Visionary leader with 15 years in product design.' },
      { name: 'Jordan Kim', role: 'CTO', avatar: { url: IMG.person2, alt: 'Jordan Kim' }, bio: 'Full-stack engineer who loves clean code.' },
      { name: 'Sam Torres', role: 'Head of Design', avatar: { url: IMG.person3, alt: 'Sam Torres' }, bio: 'Design thinker crafting beautiful user experiences.' },
    ],
  }),

  faq: (variant) => ({
    blockType: 'faq', variant,
    headline: 'Frequently Asked Questions',
    subheadline: 'Everything you need to know to get started',
    items: [
      { question: 'How long does setup take?', answer: 'Most customers are live within 30 minutes. Our guided wizard walks you through every step.' },
      { question: 'Do I need coding skills?', answer: 'Not at all. Our visual editor requires zero technical knowledge.' },
      { question: 'Can I use my own domain?', answer: 'Yes. Connect any domain you own with a simple DNS change, or buy one directly through us.' },
      { question: 'What payment methods do you accept?', answer: 'We accept all major credit cards, PayPal, and bank transfers for annual plans.' },
    ],
  }),

  footer: (variant) => ({
    blockType: 'footer', variant,
    logoText: 'BrandName',
    tagline: 'Building the web, one site at a time.',
    columns: [
      { title: 'Product', links: [{ label: 'Features', url: '#' }, { label: 'Pricing', url: '#' }, { label: 'Changelog', url: '#' }] },
      { title: 'Company', links: [{ label: 'About', url: '#' }, { label: 'Blog', url: '#' }, { label: 'Careers', url: '#' }] },
      { title: 'Support', links: [{ label: 'Help Center', url: '#' }, { label: 'Contact', url: '#' }, { label: 'Status', url: '#' }] },
    ],
    copyrightText: '© 2025 BrandName. All rights reserved.',
    socials: [{ platform: 'twitter', url: '#' }, { platform: 'linkedin', url: '#' }],
  }),

  contact: (variant) => ({
    blockType: 'contact', variant,
    headline: 'Get in Touch',
    subtext: 'We respond within 24 hours on business days.',
    email: 'hello@example.com',
    phone: '+1 (555) 123-4567',
    address: '123 Main Street, Suite 400, San Francisco, CA 94105',
    formFields: [
      { label: 'Name', fieldName: 'name', fieldType: 'text', placeholder: 'Your name', required: true },
      { label: 'Email', fieldName: 'email', fieldType: 'email', placeholder: 'your@email.com', required: true },
      { label: 'Message', fieldName: 'message', fieldType: 'textarea', placeholder: 'How can we help?', required: true },
    ],
  }),

  cta: (variant) => ({
    blockType: 'cta', variant,
    headline: 'Ready to Get Started?',
    subheadline: 'Join 5,000+ businesses already growing with us.',
    ctaLabel: 'Start Free Trial',
    ctaUrl: '#',
    ctaStyle: 'primary' as const,
    secondaryCtaLabel: 'Talk to Sales',
    secondaryCtaUrl: '#',
  }),

  newsletter: (variant) => ({
    blockType: 'newsletter', variant,
    headline: 'Stay in the Loop',
    subheadline: 'Get weekly tips, product updates, and exclusive offers.',
    buttonLabel: 'Subscribe',
    placeholder: 'Enter your email',
  }),

  gallery: (variant) => ({
    blockType: 'gallery', variant,
    headline: 'Our Work',
    images: [
      { image: { url: IMG.office, alt: 'Office' }, caption: 'Main workspace' },
      { image: { url: IMG.team, alt: 'Team' }, caption: 'Team collaboration' },
      { image: { url: IMG.city, alt: 'City' }, caption: 'City location' },
      { image: { url: IMG.nature, alt: 'Nature' }, caption: 'Retreat venue' },
      { image: { url: IMG.hero, alt: 'Work' }, caption: 'Project showcase' },
      { image: { url: IMG.food, alt: 'Event' }, caption: 'Team lunch' },
    ],
  }),

  'logo-cloud': (variant) => ({
    blockType: 'logo-cloud', variant,
    headline: 'Trusted by Industry Leaders',
    logos: [
      { name: 'Acme Corp', logo: { url: IMG.product, alt: 'Acme Corp' } },
      { name: 'Globex', logo: { url: IMG.product, alt: 'Globex' } },
      { name: 'Initech', logo: { url: IMG.product, alt: 'Initech' } },
      { name: 'Hooli', logo: { url: IMG.product, alt: 'Hooli' } },
    ],
  }),
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns demo content for a block variant.
 * Returns null for live-data blocks (route renders fallback card).
 * Falls back to part2 for commerce/industry/utility blocks.
 */
export function buildDemoContent(slug: string, variant: string): DemoContent {
  if (LIVE_DATA_BLOCKS.has(slug)) return null
  const builder = DEMO_CONTENT_MAP[slug]
  if (builder) return builder(variant)
  // Delegate commerce / industry / utility blocks
  return buildDemoContentPart2(slug, variant)
}

export function requiresLiveData(slug: string): boolean {
  return LIVE_DATA_BLOCKS.has(slug)
}
