import { getCategoryContent } from '@/lib/ai/content'
import type { CategoryContent, BusinessSample } from '@/lib/ai/content/types'
import type { ThemePreset } from '@/lib/ai/theme-presets'
import { blockRegistry } from '@/blocks/registry'
import { enforceMinContent } from './openai-generator'
import { applyContentValidation, type ContentLang } from './content-rules'

// ── Types ───────────────────────────────────────────────────────────────────

export type ComposerInput = {
  category: string
  businessIndex: number
  variant: 'starter' | 'professional' | 'premium'
  themePreset: ThemePreset
  compositionSeed?: number  // Seed for variety — undefined = backward-compatible (no shuffle)
}

// ── Seeded PRNG Utilities ─────────────────────────────────────────────────

function createSeededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
    return (s >>> 0) / 0xFFFFFFFF
  }
}

function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

// ── Seed-Based Variant Selection ──────────────────────────────────────────

const BROKEN_VARIANTS: Record<string, string[]> = {
  hero: ['animated-gradient'],
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * Select a variant deterministically based on seed.
 * Same seed + blockType + category = always same variant.
 */
function selectVariant(blockType: string, seed: number, category: string): string {
  const meta = blockRegistry.has(blockType) ? blockRegistry.getBlockMeta(blockType) : null
  if (!meta || meta.variants.length <= 1) return meta?.defaultVariant ?? 'default'

  const broken = BROKEN_VARIANTS[blockType] ?? []
  const safe = meta.variants.filter(v => !broken.includes(v))
  if (safe.length === 0) return meta.defaultVariant ?? meta.variants[0]!

  const hash = simpleHash(blockType + category + seed)
  return safe[hash % safe.length]!
}

export type TemplateSeed = {
  name: string
  description: string
  category: string
  tier: 'starter' | 'professional' | 'premium'
  isPremium: boolean
  thumbnail?: string
  theme: ThemePreset
  pages: TemplatePage[]
}

export type TemplatePage = {
  title: string
  slug: string
  layout: Record<string, unknown>[]
}

// ── Hero variant mapping per category ───────────────────────────────────────

const CATEGORY_HERO_VARIANTS: Record<string, string[]> = {
  restaurant: ['split-left', 'magazine', 'gradient', 'parallax', 'fullscreen'],
  ecommerce: ['slideshow', 'cards-overlay', 'gradient', 'split-right', 'magazine'],
  beauty: ['gradient', 'minimal', 'parallax', 'split-left', 'magazine'],
  tech: ['gradient', 'split-video', 'minimal', 'parallax', 'cards-overlay'],
  health: ['centered', 'split-left', 'minimal', 'gradient', 'parallax'],
  education: ['centered', 'split-right', 'gradient', 'magazine', 'parallax'],
  realestate: ['fullscreen', 'parallax', 'slideshow', 'split-left', 'magazine'],
  fitness: ['fullscreen', 'parallax', 'split-video', 'gradient', 'cards-overlay'],
  creative: ['magazine', 'parallax', 'cards-overlay', 'minimal', 'gradient'],
  business: ['centered', 'split-left', 'gradient', 'minimal', 'parallax'],
  fnb: ['split-left', 'gradient', 'magazine', 'parallax', 'fullscreen'],
  events: ['fullscreen', 'gradient', 'split-left', 'centered', 'parallax'],
  blog: ['minimal', 'split-left', 'fullscreen', 'centered', 'magazine'],
  travel: ['fullscreen', 'parallax', 'split-left', 'gradient', 'slideshow'],
}

// ── Industry block mapping per category ─────────────────────────────────────

const CATEGORY_INDUSTRY_BLOCKS: Record<string, string[]> = {
  restaurant: ['menu-display', 'booking-widget', 'review-cards'],
  ecommerce: ['product-quick-view', 'review-cards'],
  beauty: ['booking-widget', 'review-cards', 'before-after'],
  tech: ['feature-comparison', 'pricing-table', 'video-showcase'],
  health: ['doctor-profile', 'booking-widget', 'review-cards'],
  education: ['class-schedule', 'video-showcase', 'review-cards'],
  realestate: ['property-card', 'review-cards'],
  fitness: ['class-schedule', 'booking-widget', 'review-cards'],
  creative: ['portfolio-grid', 'video-showcase', 'review-cards'],
  business: ['service-cards', 'review-cards', 'client-logos'],
  fnb: ['menu-display', 'review-cards'],
  events: ['countdown-timer', 'booking-widget', 'review-cards'],
  blog: ['blog-list', 'social-proof', 'review-cards'],
  travel: ['booking-widget', 'review-cards', 'video-showcase'],
}

// ── Block builders ──────────────────────────────────────────────────────────

function buildNavigation(biz: BusinessSample, pages: string[]): Record<string, unknown> {
  const links = pages.map((p) => ({
    label: p === '/' ? 'Home' : p.charAt(0).toUpperCase() + p.slice(1),
    url: p === '/' ? '/' : `/${p}`,
  }))
  return {
    blockType: 'navigation',
    variant: 'simple',
    logoText: biz.name,
    links,
    ctaButton: { show: true, label: 'Get Started', url: '/contact' },
  }
}

function buildHero(biz: BusinessSample, category: string, variantIndex: number): Record<string, unknown> {
  const variants = CATEGORY_HERO_VARIANTS[category] ?? ['centered']
  const variant = variants[variantIndex % variants.length]
  return {
    blockType: 'hero',
    variant,
    headline: biz.heroHeadline,
    subheadline: biz.heroSubheadline,
    ctaButtons: [
      { label: 'Get Started', url: '/contact', style: 'primary' },
      { label: 'Learn More', url: '/about', style: 'outline' },
    ],
    overlay: variant === 'fullscreen' || variant === 'parallax',
    overlayOpacity: 0.4,
    height: '90vh',
  }
}

function buildFeatures(biz: BusinessSample, category: string): Record<string, unknown> {
  const featureMap: Record<string, { icon: string; title: string; description: string }[]> = {
    restaurant: [
      { icon: 'Utensils', title: 'Authentic Recipes', description: 'Traditional recipes passed down through generations, using only the freshest local ingredients.' },
      { icon: 'Award', title: 'Halal Certified', description: 'All our ingredients and preparation methods are JAKIM halal-certified for your peace of mind.' },
      { icon: 'Truck', title: 'Fast Delivery', description: 'Available on GrabFood, Foodpanda, and direct ordering with free delivery within 5km.' },
    ],
    ecommerce: [
      { icon: 'ShieldCheck', title: 'Secure Payment', description: 'Pay safely with FPX, credit card, or e-wallets. All transactions are encrypted and protected.' },
      { icon: 'Truck', title: 'Free Shipping', description: 'Enjoy free shipping on orders above RM 150. Express delivery available for RM 10.' },
      { icon: 'RefreshCcw', title: '30-Day Returns', description: 'Not satisfied? Return within 30 days for a full refund. No questions asked.' },
    ],
    beauty: [
      { icon: 'Sparkles', title: 'Premium Products', description: 'We use only halal-certified, dermatologist-tested products from Korea and Japan.' },
      { icon: 'Clock', title: 'Easy Booking', description: 'Book your appointment online 24/7. Walk-ins welcome but booking guarantees your slot.' },
      { icon: 'Heart', title: 'Personalised Care', description: 'Every treatment is customised to your skin type and concerns for the best results.' },
    ],
    tech: [
      { icon: 'Zap', title: 'Lightning Fast', description: 'Our infrastructure delivers sub-100ms response times with 99.9% uptime SLA.' },
      { icon: 'Shield', title: 'Enterprise Security', description: 'Bank-grade encryption, SOC 2 compliance, and regular penetration testing.' },
      { icon: 'Headphones', title: '24/7 Support', description: 'Our Malaysian support team is available round the clock via chat, email, and phone.' },
    ],
    health: [
      { icon: 'Stethoscope', title: 'Expert Doctors', description: 'Our team of experienced doctors provide comprehensive healthcare for your whole family.' },
      { icon: 'CreditCard', title: 'Insurance Accepted', description: 'We accept all major insurance panels including Great Eastern, AIA, and Prudential.' },
      { icon: 'Clock', title: 'Minimal Wait Time', description: 'Our efficient scheduling ensures you spend less time waiting and more time getting care.' },
    ],
    education: [
      { icon: 'GraduationCap', title: 'Proven Results', description: 'Over 90% of our students achieve A grades in their subjects. Results speak for themselves.' },
      { icon: 'Users', title: 'Small Class Sizes', description: 'Maximum 15 students per class ensures personal attention and better learning outcomes.' },
      { icon: 'BookOpen', title: 'Updated Curriculum', description: 'Our materials follow the latest KSSM/KBSM syllabus and SPM exam format.' },
    ],
    realestate: [
      { icon: 'Home', title: 'Premium Listings', description: 'Curated selection of the finest properties in KL, PJ, and the Klang Valley.' },
      { icon: 'Shield', title: 'Trusted Agent', description: 'Licensed REN with over 10 years of experience and 500+ successful transactions.' },
      { icon: 'TrendingUp', title: 'Market Insights', description: 'Get data-driven property valuations and investment advice from our expert team.' },
    ],
    fitness: [
      { icon: 'Dumbbell', title: 'Expert Trainers', description: 'Certified personal trainers with specialisation in body transformation and sports performance.' },
      { icon: 'Users', title: 'Group Classes', description: 'Over 30 group classes per week including HIIT, yoga, spin, and boxing.' },
      { icon: 'Clock', title: 'Flexible Hours', description: 'Open from 6 AM to 11 PM daily. Train on your schedule, not ours.' },
    ],
    creative: [
      { icon: 'Palette', title: 'Award-Winning Design', description: 'Our team has won multiple design awards and delivered for 200+ brands across Malaysia.' },
      { icon: 'Layers', title: 'Full-Service Agency', description: 'From branding to web design to packaging — we handle everything under one roof.' },
      { icon: 'Zap', title: 'Fast Turnaround', description: 'Logo in 5 days, brand identity in 2 weeks. We respect your timeline.' },
    ],
    business: [
      { icon: 'BarChart', title: 'Data-Driven Strategy', description: 'Our consulting approach combines market data with decades of industry experience.' },
      { icon: 'Globe', title: 'Regional Expertise', description: 'Deep knowledge of ASEAN markets with offices in KL, Singapore, and Jakarta.' },
      { icon: 'Handshake', title: 'Trusted Advisor', description: 'Confidential, objective advice from experienced C-suite professionals.' },
    ],
    fnb: [
      { icon: 'Coffee', title: 'Quality Ingredients', description: 'We source premium beans and ingredients to deliver the authentic taste you love.' },
      { icon: 'Wifi', title: 'Work-Friendly Space', description: 'Free Wi-Fi, power outlets at every table, and a quiet corner for focused work.' },
      { icon: 'Heart', title: 'Made with Love', description: 'Every drink and dish is prepared fresh, following recipes perfected over decades.' },
    ],
    events: [
      { icon: 'Calendar', title: 'Flawless Planning', description: 'From venue selection to day-of coordination, we handle every detail so you can enjoy the moment.' },
      { icon: 'Users', title: 'Experienced Team', description: 'Over 500 events delivered across weddings, corporate functions, and private celebrations.' },
      { icon: 'Star', title: 'Custom Packages', description: 'Tailored packages from intimate gatherings of 20 to grand celebrations of 500+ guests.' },
    ],
    blog: [
      { icon: 'PenTool', title: 'Expert Writers', description: 'Our team of experienced writers and editors deliver well-researched, engaging content daily.' },
      { icon: 'TrendingUp', title: 'Trending Topics', description: 'Stay ahead with the latest insights, trends, and stories that matter to Malaysians.' },
      { icon: 'Mail', title: 'Weekly Newsletter', description: 'Get the best stories delivered to your inbox every week. Join 10,000+ subscribers.' },
    ],
    travel: [
      { icon: 'Map', title: 'Local Expertise', description: 'Born and raised in Malaysia — we know the hidden gems, best routes, and insider tips.' },
      { icon: 'Shield', title: 'Safe & Insured', description: 'All tours include travel insurance and are led by licensed, first-aid certified guides.' },
      { icon: 'DollarSign', title: 'Best Price Guarantee', description: 'Competitive RM pricing with no hidden fees. Price match guarantee on all packages.' },
    ],
  }

  const features = featureMap[category] ?? featureMap['business']!
  return {
    blockType: 'features',
    variant: 'grid-3',
    headline: `Why Choose ${biz.name}`,
    subheadline: biz.tagline,
    features,
  }
}

function buildTestimonials(content: CategoryContent): Record<string, unknown> {
  return {
    blockType: 'testimonials',
    variant: 'cards',
    headline: 'What Our Customers Say',
    testimonials: content.testimonials.slice(0, 3).map((t) => ({
      quote: t.quote,
      name: t.name,
      title: t.title,
      company: t.company,
      rating: t.rating,
    })),
  }
}

function buildContact(biz: BusinessSample): Record<string, unknown> {
  return {
    blockType: 'contact',
    variant: 'split',
    headline: 'Get In Touch',
    subtext: `We\'d love to hear from you. Reach out to ${biz.name} today.`,
    email: biz.email,
    phone: biz.phone,
    address: biz.address,
    formFields: [
      { label: 'Name', fieldName: 'name', fieldType: 'text', placeholder: 'Your full name', required: true },
      { label: 'Email', fieldName: 'email', fieldType: 'email', placeholder: 'your@email.com', required: true },
      { label: 'Phone', fieldName: 'phone', fieldType: 'tel', placeholder: '+60 12-345 6789', required: false },
      { label: 'Message', fieldName: 'message', fieldType: 'textarea', placeholder: 'How can we help you?', required: true },
    ],
  }
}

function buildFooter(biz: BusinessSample, pages: string[]): Record<string, unknown> {
  const linkColumns = [
    {
      title: 'Pages',
      links: pages.map((p) => ({
        label: p === '/' ? 'Home' : p.charAt(0).toUpperCase() + p.slice(1),
        url: p === '/' ? '/' : `/${p}`,
      })),
    },
    {
      title: 'Contact',
      links: [
        { label: biz.email, url: `mailto:${biz.email}` },
        { label: biz.phone, url: `tel:${biz.phone.replace(/[\s-]/g, '')}` },
      ],
    },
  ]
  return {
    blockType: 'footer',
    variant: 'expanded',
    logoText: biz.name,
    tagline: biz.tagline,
    columns: linkColumns,
    copyrightText: `© 2026 ${biz.name}. All rights reserved.`,
    socials: [
      { platform: 'facebook', url: '#' },
      { platform: 'instagram', url: '#' },
      { platform: 'whatsapp', url: '#' },
    ],
  }
}

function buildStats(category: string): Record<string, unknown> {
  const statsMap: Record<string, { value: string; label: string; suffix?: string }[]> = {
    restaurant: [
      { value: '15', label: 'Years Serving', suffix: '+' },
      { value: '50000', label: 'Customers Served', suffix: '+' },
      { value: '4.8', label: 'Google Rating' },
      { value: '200', label: 'Menu Items', suffix: '+' },
    ],
    ecommerce: [
      { value: '10000', label: 'Products', suffix: '+' },
      { value: '50000', label: 'Happy Customers', suffix: '+' },
      { value: '99', label: 'Satisfaction Rate', suffix: '%' },
      { value: '24', label: 'Hour Delivery', suffix: 'h' },
    ],
    beauty: [
      { value: '5000', label: 'Clients Served', suffix: '+' },
      { value: '50', label: 'Treatments Available', suffix: '+' },
      { value: '4.9', label: 'Rating' },
      { value: '8', label: 'Years Experience', suffix: '+' },
    ],
    tech: [
      { value: '99.9', label: 'Uptime', suffix: '%' },
      { value: '500', label: 'Clients', suffix: '+' },
      { value: '50', label: 'Team Members', suffix: '+' },
      { value: '24', label: 'Support', suffix: '/7' },
    ],
    health: [
      { value: '20', label: 'Years Experience', suffix: '+' },
      { value: '15000', label: 'Patients Treated', suffix: '+' },
      { value: '10', label: 'Specialist Doctors' },
      { value: '4.9', label: 'Patient Rating' },
    ],
    education: [
      { value: '3000', label: 'Students Taught', suffix: '+' },
      { value: '90', label: 'A-Grade Rate', suffix: '%' },
      { value: '15', label: 'Years Teaching', suffix: '+' },
      { value: '50', label: 'Subjects Offered', suffix: '+' },
    ],
    realestate: [
      { value: '500', label: 'Properties Sold', suffix: '+' },
      { value: '2', label: 'Total Sales Value', suffix: 'B+' },
      { value: '10', label: 'Years Experience', suffix: '+' },
      { value: '98', label: 'Client Satisfaction', suffix: '%' },
    ],
    fitness: [
      { value: '2000', label: 'Members', suffix: '+' },
      { value: '30', label: 'Classes Per Week', suffix: '+' },
      { value: '15', label: 'Expert Trainers' },
      { value: '4.8', label: 'Member Rating' },
    ],
    creative: [
      { value: '200', label: 'Projects Delivered', suffix: '+' },
      { value: '50', label: 'Brand Identities', suffix: '+' },
      { value: '12', label: 'Awards Won' },
      { value: '98', label: 'Client Retention', suffix: '%' },
    ],
    business: [
      { value: '150', label: 'Clients Served', suffix: '+' },
      { value: '500', label: 'Projects Completed', suffix: '+' },
      { value: '25', label: 'Years Experience', suffix: '+' },
      { value: '5', label: 'ASEAN Countries' },
    ],
    fnb: [
      { value: '10000', label: 'Cups Served Monthly', suffix: '+' },
      { value: '4.7', label: 'Google Rating' },
      { value: '20', label: 'Years Heritage', suffix: '+' },
      { value: '30', label: 'Menu Items', suffix: '+' },
    ],
  }
  return {
    blockType: 'stats',
    variant: 'row',
    headline: 'Our Numbers Speak',
    stats: statsMap[category] ?? statsMap['business']!,
  }
}

function buildGallery(biz: BusinessSample): Record<string, unknown> {
  return {
    blockType: 'gallery',
    variant: 'grid',
    headline: `Gallery — ${biz.name}`,
    images: [
      { image: { url: 'https://placehold.co/600x400/e2e8f0/64748b?text=Gallery+1', alt: `${biz.name} photo 1` } },
      { image: { url: 'https://placehold.co/600x400/e2e8f0/64748b?text=Gallery+2', alt: `${biz.name} photo 2` } },
      { image: { url: 'https://placehold.co/600x400/e2e8f0/64748b?text=Gallery+3', alt: `${biz.name} photo 3` } },
      { image: { url: 'https://placehold.co/600x400/e2e8f0/64748b?text=Gallery+4', alt: `${biz.name} photo 4` } },
      { image: { url: 'https://placehold.co/600x400/e2e8f0/64748b?text=Gallery+5', alt: `${biz.name} photo 5` } },
      { image: { url: 'https://placehold.co/600x400/e2e8f0/64748b?text=Gallery+6', alt: `${biz.name} photo 6` } },
    ],
  }
}

function buildFAQ(content: CategoryContent): Record<string, unknown> {
  return {
    blockType: 'faq',
    variant: 'accordion',
    headline: 'Frequently Asked Questions',
    items: content.faqItems.map((f) => ({ question: f.question, answer: f.answer })),
  }
}

function buildCTA(biz: BusinessSample): Record<string, unknown> {
  return {
    blockType: 'cta',
    variant: 'banner',
    headline: `Ready to Get Started with ${biz.name}?`,
    subheadline: 'Contact us today and let us help you achieve your goals.',
    ctaLabel: 'Contact Us Now',
    ctaUrl: '/contact',
    ctaStyle: 'primary',
  }
}

function buildAbout(biz: BusinessSample): Record<string, unknown> {
  return {
    blockType: 'about',
    variant: 'split',
    headline: `About ${biz.name}`,
    body: biz.description,
    layout: 'image-right',
  }
}

function buildPricing(category: string): Record<string, unknown> {
  const pricingMap: Record<string, { name: string; price: string; period: string; features: string[]; highlighted: boolean }[]> = {
    tech: [
      { name: 'Starter', price: 'RM 99', period: '/month', features: ['1 Website', '5 GB Storage', 'SSL Certificate', 'Email Support'], highlighted: false },
      { name: 'Business', price: 'RM 299', period: '/month', features: ['5 Websites', '50 GB Storage', 'SSL Certificate', '24/7 Support', 'Load Balancing'], highlighted: true },
      { name: 'Enterprise', price: 'RM 499', period: '/month', features: ['Unlimited Sites', '200 GB Storage', 'Dedicated Infra', 'SLA Guarantee', 'Priority Support'], highlighted: false },
    ],
    education: [
      { name: 'Single Subject', price: 'RM 200', period: '/month', features: ['1 Subject', 'Weekly Classes', 'Printed Notes', 'WhatsApp Support'], highlighted: false },
      { name: 'SPM Package', price: 'RM 500', period: '/month', features: ['3 Subjects', 'Weekly Classes', 'Practice Papers', 'Monthly Tests', 'Parent Reports'], highlighted: true },
      { name: 'Premium', price: 'RM 800', period: '/month', features: ['5 Subjects', 'Daily Classes', 'Mock Exams', '1-on-1 Tutoring', 'Guaranteed Results'], highlighted: false },
    ],
    fitness: [
      { name: 'Basic', price: 'RM 120', period: '/month', features: ['Gym Access', 'Locker Room', 'Basic Equipment'], highlighted: false },
      { name: 'Premium', price: 'RM 250', period: '/month', features: ['Gym + Classes', 'Personal Locker', 'Sauna Access', 'Free Towels'], highlighted: true },
      { name: 'VIP', price: 'RM 450', period: '/month', features: ['All Access', '4 PT Sessions', 'Nutrition Plan', 'Recovery Room', 'Guest Pass'], highlighted: false },
    ],
    beauty: [
      { name: 'Basic Facial', price: 'RM 120', period: '/session', features: ['Deep Cleansing', 'Mask Treatment', 'Moisturising'], highlighted: false },
      { name: 'Glow Package', price: 'RM 350', period: '/session', features: ['Deep Cleansing', 'Microdermabrasion', 'LED Therapy', 'Premium Mask', 'Serum Treatment'], highlighted: true },
      { name: 'Bridal Package', price: 'RM 800', period: '/package', features: ['6 Sessions', 'All Treatments', 'Bridal Makeup Trial', 'Wedding Day Makeup', 'Emergency Kit'], highlighted: false },
    ],
    health: [
      { name: 'Basic Check-up', price: 'RM 250', period: '/visit', features: ['Physical Exam', 'Blood Test', 'BMI Analysis', 'Doctor Consultation'], highlighted: false },
      { name: 'Comprehensive', price: 'RM 550', period: '/visit', features: ['Full Blood Panel', 'ECG', 'X-Ray', 'Ultrasound', 'Specialist Review'], highlighted: true },
      { name: 'Executive', price: 'RM 1200', period: '/visit', features: ['All Tests', 'CT Scan', 'Stress Test', 'Cancer Markers', 'VIP Room', 'Report Delivery'], highlighted: false },
    ],
    business: [
      { name: 'Advisory', price: 'RM 500', period: '/hour', features: ['Strategy Consultation', 'Market Analysis', 'Action Plan'], highlighted: false },
      { name: 'Project', price: 'RM 25,000', period: '/project', features: ['Full Strategy', 'Market Research', 'Implementation Plan', 'Monthly Reviews'], highlighted: true },
      { name: 'Retainer', price: 'RM 10,000', period: '/month', features: ['Board Advisory', 'Unlimited Consults', 'Quarterly Reports', 'Priority Access'], highlighted: false },
    ],
    creative: [
      { name: 'Logo Design', price: 'RM 800', period: '/project', features: ['3 Concepts', '2 Revisions', 'Final Files', 'Brand Guidelines'], highlighted: false },
      { name: 'Brand Identity', price: 'RM 3,500', period: '/project', features: ['Logo + Stationery', 'Brand Book', 'Social Templates', 'Unlimited Revisions'], highlighted: true },
      { name: 'Full Agency', price: 'RM 8,000', period: '/month', features: ['All Design Work', 'Web Design', 'Social Content', 'Monthly Reports', 'Dedicated Designer'], highlighted: false },
    ],
  }

  const defaultPlans = [
    { name: 'Basic', price: 'RM 99', period: '/month', features: ['Core Features', 'Email Support', 'Standard SLA'], highlighted: false },
    { name: 'Professional', price: 'RM 299', period: '/month', features: ['All Features', '24/7 Support', 'Priority SLA', 'Analytics'], highlighted: true },
    { name: 'Enterprise', price: 'Custom', period: '', features: ['Custom Solution', 'Dedicated Team', 'Custom SLA', 'On-site Support'], highlighted: false },
  ]

  const plans = (pricingMap[category] ?? defaultPlans).map((p) => ({
    ...p,
    ctaLabel: p.highlighted ? 'Get Started' : 'Learn More',
    ctaUrl: '/contact',
  }))

  return {
    blockType: 'pricing',
    variant: 'cards',
    headline: 'Our Pricing',
    subheadline: 'Transparent pricing with no hidden fees.',
    plans,
  }
}

function buildTeam(category: string): Record<string, unknown> {
  const teamMap: Record<string, { name: string; role: string; bio: string }[]> = {
    health: [
      { name: 'Dr. Tan Wei Ming', role: 'General Practitioner', bio: 'MBBS (UM), 15 years experience in family medicine.' },
      { name: 'Dr. Aishah Binti Ahmad', role: 'Dental Surgeon', bio: 'BDS (USM), specialising in cosmetic dentistry and orthodontics.' },
      { name: 'Dr. Priya Nair', role: 'Specialist Physician', bio: 'MRCP (UK), internal medicine with focus on diabetes management.' },
    ],
    tech: [
      { name: 'Ahmad Razif', role: 'CTO', bio: '10+ years building scalable cloud infrastructure for Malaysian enterprises.' },
      { name: 'Mei Ling Tan', role: 'Lead Developer', bio: 'Full-stack engineer with expertise in React, Node.js, and AWS.' },
      { name: 'Raju Krishnan', role: 'Head of Support', bio: 'Ensuring 24/7 uptime and client satisfaction for 500+ businesses.' },
    ],
    creative: [
      { name: 'Farid Ismail', role: 'Creative Director', bio: 'Award-winning designer with 12 years leading brand campaigns.' },
      { name: 'Sarah Lim', role: 'Senior Designer', bio: 'Specialises in packaging and brand identity for F&B and lifestyle brands.' },
      { name: 'Vikram Patel', role: 'Motion Designer', bio: 'Creates stunning animations and video content for digital campaigns.' },
    ],
    business: [
      { name: 'Dato\' Rahman', role: 'Managing Partner', bio: '25 years of C-suite advisory across ASEAN markets.' },
      { name: 'Jennifer Ooi', role: 'Strategy Director', bio: 'Former McKinsey consultant with deep expertise in market entry.' },
      { name: 'Harith bin Yusof', role: 'Operations Lead', bio: 'Operational excellence specialist with manufacturing and logistics background.' },
    ],
  }

  const defaultTeam = [
    { name: 'Founder', role: 'CEO & Founder', bio: 'Passionate about building great products and serving Malaysian businesses.' },
    { name: 'Operations Lead', role: 'Head of Operations', bio: 'Ensuring smooth operations and excellent customer experience every day.' },
    { name: 'Marketing Lead', role: 'Head of Marketing', bio: 'Growing the brand through digital marketing and community building.' },
  ]

  return {
    blockType: 'team',
    variant: 'grid',
    headline: 'Meet Our Team',
    subheadline: 'The people behind the magic.',
    members: (teamMap[category] ?? defaultTeam).map((m) => ({
      name: m.name,
      role: m.role,
      bio: m.bio,
    })),
  }
}

function buildNewsletter(biz: BusinessSample): Record<string, unknown> {
  return {
    blockType: 'newsletter',
    variant: 'inline',
    headline: `Stay Updated with ${biz.name}`,
    subheadline: 'Get the latest news, promotions, and updates delivered to your inbox.',
    buttonLabel: 'Subscribe',
    placeholder: 'your@email.com',
  }
}

// ── Industry block builders ─────────────────────────────────────────────────

function buildMenuDisplay(content: CategoryContent): Record<string, unknown> {
  const industryBlock = content.industryBlocks.find((b) => b.blockType === 'menu-display')
  return {
    blockType: 'menu-display',
    variant: 'tabs',
    headline: (industryBlock?.title as string) ?? 'Our Menu',
    currency: (industryBlock?.currency as string) ?? 'RM',
    showDietaryIcons: true,
    categories: [
      {
        name: 'Nasi & Rice',
        description: 'Our signature rice dishes',
        items: [
          { name: 'Nasi Lemak Special', description: 'Coconut rice with sambal, egg, and fried chicken', price: 12, dietaryTags: ['halal'], isPopular: true },
          { name: 'Nasi Goreng Kampung', description: 'Village-style fried rice with anchovies', price: 10, dietaryTags: ['halal', 'spicy'] },
          { name: 'Chicken Rice', description: 'Hainanese-style steamed chicken with fragrant rice', price: 11, dietaryTags: ['halal'] },
        ],
      },
      {
        name: 'Roti & Bread',
        description: 'Freshly prepared flatbreads',
        items: [
          { name: 'Roti Canai', description: 'Crispy flatbread with dhal curry', price: 3, dietaryTags: ['halal', 'vegetarian'] },
          { name: 'Roti Telur', description: 'Flatbread stuffed with egg', price: 4, dietaryTags: ['halal'] },
        ],
      },
      {
        name: 'Beverages',
        description: 'Hot and cold drinks',
        items: [
          { name: 'Teh Tarik', description: 'Pulled milk tea', price: 3.5, dietaryTags: ['halal', 'vegetarian'] },
          { name: 'Kopi O', description: 'Traditional black coffee', price: 3, dietaryTags: ['halal', 'vegetarian'] },
        ],
      },
    ],
  }
}

function buildBookingWidget(content: CategoryContent, category: string): Record<string, unknown> {
  const servicesMap: Record<string, { name: string; duration: number; price: number; description: string }[]> = {
    beauty: [
      { name: 'Hydrating Facial', duration: 60, price: 120, description: 'Deep hydration treatment with Korean products' },
      { name: 'Acne Treatment', duration: 45, price: 150, description: 'Targeted treatment for acne-prone skin' },
      { name: 'Mani-Pedi Combo', duration: 90, price: 75, description: 'Classic manicure and pedicure set' },
    ],
    health: [
      { name: 'General Consultation', duration: 30, price: 80, description: 'Consultation with our general practitioner' },
      { name: 'Health Screening', duration: 60, price: 250, description: 'Comprehensive health check-up' },
      { name: 'Dental Check-up', duration: 45, price: 150, description: 'Routine dental examination and cleaning' },
    ],
    fitness: [
      { name: 'Personal Training', duration: 60, price: 80, description: 'One-on-one training session with a certified trainer' },
      { name: 'Body Assessment', duration: 30, price: 50, description: 'Full body composition and fitness assessment' },
      { name: 'Yoga Class', duration: 60, price: 35, description: 'Group yoga class for all levels' },
    ],
    restaurant: [
      { name: 'Table for 2', duration: 90, price: 0, description: 'Intimate dining for two' },
      { name: 'Family Table (4-6)', duration: 120, price: 0, description: 'Perfect for family gatherings' },
      { name: 'Private Room (10+)', duration: 150, price: 200, description: 'Private dining room with deposit' },
    ],
  }
  return {
    blockType: 'booking-widget',
    variant: 'inline',
    headline: 'Book an Appointment',
    subheadline: 'Choose a service and pick your preferred time slot.',
    services: servicesMap[category] ?? servicesMap['health']!,
    availableDays: [1, 2, 3, 4, 5, 6],
    timeSlotInterval: 30,
    startTime: '09:00',
    endTime: '18:00',
    showPrice: true,
  }
}

function buildClassSchedule(): Record<string, unknown> {
  return {
    blockType: 'class-schedule',
    variant: 'grid',
    headline: 'Weekly Schedule',
    showCapacity: true,
    highlightToday: true,
    classes: [
      { name: 'HIIT Burn', instructor: 'Coach Amir', day: 1, startTime: '07:00', endTime: '08:00', capacity: 20, enrolled: 15, category: 'Cardio', level: 'Intermediate' },
      { name: 'Yoga Flow', instructor: 'Sarah', day: 1, startTime: '09:00', endTime: '10:00', capacity: 15, enrolled: 12, category: 'Yoga', level: 'All Levels' },
      { name: 'Spin Class', instructor: 'Coach Danny', day: 2, startTime: '07:00', endTime: '07:45', capacity: 25, enrolled: 20, category: 'Cardio', level: 'Advanced' },
      { name: 'Pilates', instructor: 'Sarah', day: 3, startTime: '10:00', endTime: '11:00', capacity: 12, enrolled: 8, category: 'Pilates', level: 'Beginner' },
      { name: 'Boxing Fit', instructor: 'Coach Amir', day: 4, startTime: '18:00', endTime: '19:00', capacity: 20, enrolled: 18, category: 'Combat', level: 'Intermediate' },
      { name: 'Stretch & Recover', instructor: 'Sarah', day: 5, startTime: '09:00', endTime: '10:00', capacity: 15, enrolled: 6, category: 'Recovery', level: 'All Levels' },
    ],
  }
}

function buildReviewCards(content: CategoryContent): Record<string, unknown> {
  return {
    blockType: 'review-cards',
    variant: 'grid',
    headline: 'Customer Reviews',
    subheadline: 'See what people are saying about us.',
    showAverage: true,
    totalReviewCount: 150,
    reviews: content.testimonials.slice(0, 4).map((t, i) => ({
      name: t.name,
      rating: t.rating,
      text: t.quote,
      date: `2026-0${i + 1}-15`,
      verified: true,
      source: 'Google',
    })),
  }
}

function buildVideoShowcase(): Record<string, unknown> {
  return {
    blockType: 'video-showcase',
    variant: 'grid',
    headline: 'Watch & Learn',
    subheadline: 'Explore our video content.',
    showCategories: true,
    autoplay: false,
    videos: [
      { title: 'Getting Started Guide', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'Tutorial', duration: '5:30', description: 'Learn the basics in just 5 minutes.' },
      { title: 'Customer Success Story', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'Testimonial', duration: '3:15', description: 'Hear how we helped transform a business.' },
      { title: 'Behind the Scenes', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', category: 'About Us', duration: '4:00', description: 'A peek into our daily operations.' },
    ],
  }
}

function buildDoctorProfile(content: CategoryContent): Record<string, unknown> {
  return {
    blockType: 'doctor-profile',
    variant: 'cards',
    headline: 'Our Medical Team',
    subheadline: 'Experienced healthcare professionals dedicated to your wellbeing.',
    doctors: [
      { name: 'Dr. Tan Wei Ming', specialisation: 'General Practice', qualifications: ['MBBS (UM)', 'MRCP (UK)'], availableDays: [1, 2, 3, 4, 5], languages: 'English, Malay, Mandarin', consultationFee: 'RM 80', bio: '15 years of experience in family medicine.' },
      { name: 'Dr. Aishah Ahmad', specialisation: 'Dental Surgery', qualifications: ['BDS (USM)', 'Fellowship in Cosmetic Dentistry'], availableDays: [1, 3, 5], languages: 'English, Malay', consultationFee: 'RM 150', bio: 'Specialising in cosmetic dentistry and orthodontics.' },
      { name: 'Dr. Rajesh Kumar', specialisation: 'Orthopaedics', qualifications: ['MS Ortho (UKM)', 'FRCS (Edinburgh)'], availableDays: [2, 4, 6], languages: 'English, Malay, Tamil', consultationFee: 'RM 200', bio: 'Expert in sports injuries and joint replacement.' },
    ],
  }
}

function buildPropertyCard(): Record<string, unknown> {
  return {
    blockType: 'property-card',
    variant: 'grid',
    headline: 'Featured Properties',
    subheadline: 'Discover your dream home in the Klang Valley.',
    showMap: false,
    currency: 'RM',
    properties: [
      { title: 'Luxury Condo in KLCC', price: 1200000, location: 'KLCC, Kuala Lumpur', bedrooms: 3, bathrooms: 2, area: 1200, imageUrls: ['https://placehold.co/600x400/e2e8f0/64748b?text=KLCC+Condo'], type: 'sale' as const, description: 'Modern luxury condo with stunning twin tower views.' },
      { title: 'Semi-D in Shah Alam', price: 850000, location: 'Seksyen 7, Shah Alam', bedrooms: 4, bathrooms: 3, area: 2200, imageUrls: ['https://placehold.co/600x400/e2e8f0/64748b?text=Shah+Alam'], type: 'sale' as const, description: 'Spacious family home in quiet neighbourhood.' },
      { title: 'Studio in Mont Kiara', price: 2500, location: 'Mont Kiara, Kuala Lumpur', bedrooms: 1, bathrooms: 1, area: 550, imageUrls: ['https://placehold.co/600x400/e2e8f0/64748b?text=Mont+Kiara'], type: 'rent' as const, description: 'Fully furnished studio, walking distance to MRT.' },
    ],
  }
}

function buildProductQuickView(): Record<string, unknown> {
  return {
    blockType: 'product-quick-view',
    variant: 'grid',
    headline: 'Best Sellers',
    subheadline: 'Shop our most popular items.',
    columns: 4 as const,
    showQuickView: true,
    currency: 'RM',
    products: [
      { name: 'Baju Kurung Moden', price: 89, originalPrice: 120, imageUrls: ['https://placehold.co/400x500/e2e8f0/64748b?text=Kurung'], description: 'Elegant modern baju kurung in premium cotton.', variants: ['S', 'M', 'L', 'XL'], badge: 'Sale', ctaLabel: 'Add to Cart', ctaUrl: '#' },
      { name: 'Wireless Earbuds Pro', price: 199, imageUrls: ['https://placehold.co/400x500/e2e8f0/64748b?text=Earbuds'], description: 'Active noise cancellation with 30-hour battery life.', variants: ['Black', 'White'], badge: 'New', ctaLabel: 'Add to Cart', ctaUrl: '#' },
      { name: 'Organic Honey (500g)', price: 45, imageUrls: ['https://placehold.co/400x500/e2e8f0/64748b?text=Honey'], description: 'Pure Malaysian kelulut honey from Cameron Highlands.', ctaLabel: 'Add to Cart', ctaUrl: '#' },
      { name: 'Batik Silk Scarf', price: 65, originalPrice: 85, imageUrls: ['https://placehold.co/400x500/e2e8f0/64748b?text=Batik'], description: 'Handmade batik silk scarf in traditional Malaysian motifs.', badge: 'Sale', ctaLabel: 'Add to Cart', ctaUrl: '#' },
    ],
  }
}

function buildPortfolioGrid(): Record<string, unknown> {
  return {
    blockType: 'portfolio-grid',
    variant: 'masonry',
    headline: 'Our Work',
    subheadline: 'A selection of projects we are proud of.',
    projects: [
      { title: 'Brand Identity — Nasi Kandar Chain', description: 'Complete brand redesign for a national F&B chain.', imageUrl: 'https://placehold.co/600x400/e2e8f0/64748b?text=Branding', category: 'Branding' },
      { title: 'E-commerce Website', description: 'Full e-commerce platform for a fashion brand.', imageUrl: 'https://placehold.co/600x400/e2e8f0/64748b?text=Web+Design', category: 'Web Design' },
      { title: 'Product Packaging', description: 'Packaging design for artisan coffee brand.', imageUrl: 'https://placehold.co/600x400/e2e8f0/64748b?text=Packaging', category: 'Packaging' },
      { title: 'Corporate Video', description: 'Brand story video for a tech startup.', imageUrl: 'https://placehold.co/600x400/e2e8f0/64748b?text=Video', category: 'Video' },
      { title: 'Social Media Campaign', description: 'Instagram campaign that reached 500K impressions.', imageUrl: 'https://placehold.co/600x400/e2e8f0/64748b?text=Social', category: 'Digital' },
      { title: 'Annual Report Design', description: 'Clean, modern annual report for a public company.', imageUrl: 'https://placehold.co/600x400/e2e8f0/64748b?text=Print', category: 'Print' },
    ],
  }
}

function buildServiceCards(biz: BusinessSample, category: string): Record<string, unknown> {
  const servicesMap: Record<string, { title: string; description: string; icon: string; price?: string; priceUnit?: string }[]> = {
    business: [
      { title: 'Strategy Consulting', description: 'C-suite advisory and market strategy development.', icon: 'BarChart', price: 'RM 500', priceUnit: '/hour' },
      { title: 'Market Entry', description: 'Comprehensive market research and entry planning for ASEAN.', icon: 'Globe', price: 'From RM 25,000', priceUnit: '/project' },
      { title: 'M&A Advisory', description: 'Due diligence and deal structuring for mergers and acquisitions.', icon: 'Handshake', price: 'From RM 50,000', priceUnit: '/project' },
    ],
    beauty: [
      { title: 'Facial Treatment', description: 'Customised facials for every skin type and concern.', icon: 'Sparkles', price: 'From RM 120', priceUnit: '/session' },
      { title: 'Nail Art', description: 'Classic to creative nail designs using premium products.', icon: 'Palette', price: 'From RM 45', priceUnit: '/session' },
      { title: 'Lash Extensions', description: 'Natural to dramatic lash looks that last 3-4 weeks.', icon: 'Eye', price: 'From RM 120', priceUnit: '/set' },
    ],
  }

  return {
    blockType: 'service-cards',
    variant: 'grid',
    headline: `Our Services`,
    subheadline: `Discover what ${biz.name} can do for you.`,
    services: (servicesMap[category] ?? servicesMap['business']!).map((s) => ({
      ...s,
      cta: { label: 'Learn More', url: '/contact' },
    })),
  }
}

function buildClientLogos(): Record<string, unknown> {
  return {
    blockType: 'client-logos',
    variant: 'scroll',
    headline: 'Trusted By',
    logos: [
      { url: 'https://placehold.co/200x80/e2e8f0/64748b?text=Client+A', alt: 'Client A' },
      { url: 'https://placehold.co/200x80/e2e8f0/64748b?text=Client+B', alt: 'Client B' },
      { url: 'https://placehold.co/200x80/e2e8f0/64748b?text=Client+C', alt: 'Client C' },
      { url: 'https://placehold.co/200x80/e2e8f0/64748b?text=Client+D', alt: 'Client D' },
      { url: 'https://placehold.co/200x80/e2e8f0/64748b?text=Client+E', alt: 'Client E' },
    ],
  }
}

function buildFeatureComparison(): Record<string, unknown> {
  return {
    blockType: 'feature-comparison',
    variant: 'table',
    headline: 'Compare Plans',
    products: [
      { name: 'Starter', highlighted: false },
      { name: 'Professional', highlighted: true },
      { name: 'Enterprise', highlighted: false },
    ],
    features: [
      { name: 'Hosting', values: [true, true, true] },
      { name: 'SSL Certificate', values: [true, true, true] },
      { name: 'Load Balancing', values: [false, true, true] },
      { name: 'Dedicated Infra', values: [false, false, true] },
      { name: '24/7 Support', values: [false, true, true] },
      { name: 'SLA Guarantee', values: [false, false, true] },
    ],
  }
}

function buildPricingTable(): Record<string, unknown> {
  return {
    blockType: 'pricing-table',
    variant: 'columns',
    headline: 'Detailed Pricing',
    subheadline: 'Everything you need to know about our plans.',
    billingToggle: 'monthly',
    plans: [
      { name: 'Starter', price: 'RM 99', currency: 'RM', description: 'Perfect for getting started', features: ['1 User', '5 GB Storage', '1,000 API Calls', 'Email Support'], cta: { label: 'Get Started', url: '/contact' }, popular: false },
      { name: 'Professional', price: 'RM 299', currency: 'RM', description: 'For growing businesses', features: ['10 Users', '50 GB Storage', '50,000 API Calls', 'Chat + Email Support'], cta: { label: 'Get Started', url: '/contact' }, popular: true },
      { name: 'Enterprise', price: 'RM 499', currency: 'RM', description: 'For large organisations', features: ['Unlimited Users', '500 GB Storage', 'Unlimited API Calls', 'Dedicated Support'], cta: { label: 'Contact Sales', url: '/contact' }, popular: false },
    ],
  }
}

// ── Main composer ───────────────────────────────────────────────────────────

function getPageNames(variant: 'starter' | 'professional' | 'premium'): string[] {
  switch (variant) {
    case 'starter':
      return ['/']
    case 'professional':
      return ['/', 'about', 'contact']
    case 'premium':
      return ['/', 'about', 'services', 'contact', 'blog']
  }
}

function buildIndustryBlock(blockType: string, content: CategoryContent, biz: BusinessSample, category: string): Record<string, unknown> | null {
  switch (blockType) {
    case 'menu-display':
      return buildMenuDisplay(content)
    case 'booking-widget':
      return buildBookingWidget(content, category)
    case 'class-schedule':
      return buildClassSchedule()
    case 'review-cards':
      return buildReviewCards(content)
    case 'video-showcase':
      return buildVideoShowcase()
    case 'doctor-profile':
      return buildDoctorProfile(content)
    case 'property-card':
      return buildPropertyCard()
    case 'product-quick-view':
      return buildProductQuickView()
    case 'portfolio-grid':
      return buildPortfolioGrid()
    case 'service-cards':
      return buildServiceCards(biz, category)
    case 'client-logos':
      return buildClientLogos()
    case 'feature-comparison':
      return buildFeatureComparison()
    case 'pricing-table':
      return buildPricingTable()
    case 'before-after':
      return {
        blockType: 'before-after',
        variant: 'slider',
        headline: 'See the Transformation',
        beforeImage: { url: 'https://placehold.co/600x400/e2e8f0/64748b?text=Before', alt: 'Before treatment', label: 'Before' },
        afterImage: { url: 'https://placehold.co/600x400/e2e8f0/64748b?text=After', alt: 'After treatment', label: 'After' },
      }
    default:
      return null
  }
}

function buildHomePage(
  biz: BusinessSample,
  content: CategoryContent,
  category: string,
  variant: 'starter' | 'professional' | 'premium',
  themePresetIndex: number,
  pages: string[],
  compositionSeed?: number,
): TemplatePage {
  // Helper: get variant for a block type — seed-based if available, else hardcoded default
  const getVariant = (blockType: string, fallback: string): string => {
    if (compositionSeed != null) {
      return selectVariant(blockType, compositionSeed, category)
    }
    // Legacy: use themePresetIndex for hero only, hardcoded for rest
    if (blockType === 'hero') {
      const heroVariants = CATEGORY_HERO_VARIANTS[category] ?? ['centered']
      return heroVariants[themePresetIndex % heroVariants.length]!
    }
    return fallback
  }

  const blocks: Record<string, unknown>[] = []

  // Navigation always first
  blocks.push({ ...buildNavigation(biz, pages), variant: getVariant('navigation', 'simple') })

  // Hero always second
  blocks.push({ ...buildHero(biz, category, themePresetIndex), variant: getVariant('hero', 'centered') })

  // Middle blocks — collect all, then optionally shuffle
  const middleBlocks: Record<string, unknown>[] = []

  // Features / Services (always included)
  middleBlocks.push({ ...buildFeatures(biz, category), variant: getVariant('features', 'grid-3') })

  if (variant === 'professional' || variant === 'premium') {
    middleBlocks.push({ ...buildStats(category), variant: getVariant('stats', 'row') })
    middleBlocks.push({ ...buildGallery(biz), variant: getVariant('gallery', 'grid') })

    // Industry blocks
    const industryBlockTypes = CATEGORY_INDUSTRY_BLOCKS[category] ?? []
    const maxIndustry = variant === 'premium' ? industryBlockTypes.length : Math.min(2, industryBlockTypes.length)
    for (let i = 0; i < maxIndustry; i++) {
      const block = buildIndustryBlock(industryBlockTypes[i]!, content, biz, category)
      if (block) middleBlocks.push(block)
    }
  }

  // Testimonials
  const testimonialsVariant = getVariant('testimonials', 'cards')
  const finalTestimonialsVariant = enforceMinContent('testimonials', testimonialsVariant, content.testimonials.length)
  middleBlocks.push({ ...buildTestimonials(content), variant: finalTestimonialsVariant })

  if (variant === 'professional' || variant === 'premium') {
    middleBlocks.push({ ...buildFAQ(content), variant: getVariant('faq', 'accordion') })
    middleBlocks.push({ ...buildCTA(biz), variant: getVariant('cta', 'banner') })
  }

  if (variant === 'premium') {
    middleBlocks.push({ ...buildPricing(category), variant: getVariant('pricing', 'cards') })
    middleBlocks.push({ ...buildTeam(category), variant: getVariant('team', 'grid') })
    middleBlocks.push({ ...buildNewsletter(biz), variant: getVariant('newsletter', 'inline') })
  }

  // Shuffle middle blocks if seed provided (backward-compatible: no seed = no shuffle)
  if (compositionSeed != null) {
    const rand = createSeededRandom(compositionSeed)
    // Ordering constraints: features must be before stats
    const shuffled = shuffleArray(middleBlocks, rand)
    // Enforce: features before stats, features before testimonials
    const enforced = enforceBlockOrdering(shuffled)
    blocks.push(...enforced)
  } else {
    blocks.push(...middleBlocks)
  }

  // Contact (starter only puts it on home page)
  if (variant === 'starter') {
    blocks.push({ ...buildContact(biz), variant: getVariant('contact', 'split') })
  }

  // Footer always last
  blocks.push({ ...buildFooter(biz, pages), variant: getVariant('footer', 'expanded') })

  return { title: 'Home', slug: '/', layout: blocks }
}

/** Enforce ordering: features before stats, about before team */
function enforceBlockOrdering(blocks: Record<string, unknown>[]): Record<string, unknown>[] {
  const result = [...blocks]
  const deps: [string, string][] = [
    ['features', 'stats'],
    ['features', 'testimonials'],
  ]
  for (const [before, after] of deps) {
    const beforeIdx = result.findIndex(b => b.blockType === before)
    const afterIdx = result.findIndex(b => b.blockType === after)
    if (beforeIdx >= 0 && afterIdx >= 0 && beforeIdx > afterIdx) {
      const [moved] = result.splice(beforeIdx, 1)
      const newAfterIdx = result.findIndex(b => b.blockType === after)
      result.splice(newAfterIdx, 0, moved!)
    }
  }
  return result
}

function buildAboutPage(biz: BusinessSample, content: CategoryContent, category: string, pages: string[]): TemplatePage {
  return {
    title: 'About',
    slug: '/about',
    layout: [
      buildNavigation(biz, pages),
      buildAbout(biz),
      buildStats(category),
      buildTeam(category),
      buildTestimonials(content),
      buildCTA(biz),
      buildFooter(biz, pages),
    ],
  }
}

function buildContactPage(biz: BusinessSample, pages: string[]): TemplatePage {
  return {
    title: 'Contact',
    slug: '/contact',
    layout: [
      buildNavigation(biz, pages),
      { blockType: 'hero', variant: 'minimal', headline: `Contact ${biz.name}`, subheadline: 'We\'d love to hear from you.', height: '40vh' },
      buildContact(biz),
      buildFooter(biz, pages),
    ],
  }
}

function buildServicesPage(biz: BusinessSample, content: CategoryContent, category: string, pages: string[]): TemplatePage {
  const blocks: Record<string, unknown>[] = [
    buildNavigation(biz, pages),
    { blockType: 'hero', variant: 'minimal', headline: `Our Services`, subheadline: biz.tagline, height: '40vh' },
    buildServiceCards(biz, category),
  ]

  // Add relevant industry blocks
  const industryBlockTypes = CATEGORY_INDUSTRY_BLOCKS[category] ?? []
  for (const bt of industryBlockTypes) {
    if (bt !== 'review-cards') {
      const block = buildIndustryBlock(bt, content, biz, category)
      if (block) blocks.push(block)
    }
  }

  blocks.push(buildPricing(category))
  blocks.push(buildFAQ(content))
  blocks.push(buildCTA(biz))
  blocks.push(buildFooter(biz, pages))

  return { title: 'Services', slug: '/services', layout: blocks }
}

function buildBlogPage(biz: BusinessSample, pages: string[]): TemplatePage {
  return {
    title: 'Blog',
    slug: '/blog',
    layout: [
      buildNavigation(biz, pages),
      { blockType: 'hero', variant: 'minimal', headline: 'Blog & Updates', subheadline: `Latest news from ${biz.name}`, height: '40vh' },
      {
        blockType: 'blog-list',
        headline: 'Latest Articles',
        subheadline: 'Stay up to date with our latest news and insights.',
        limit: 6,
      },
      buildNewsletter(biz),
      buildFooter(biz, pages),
    ],
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

// ── Blueprint-driven composer (NEW — replaces algorithmic composition) ──────

import type { TemplatePreset, BlockSpec } from './template-definitions'

/**
 * Build a single block from a BlockSpec blueprint.
 * Dispatches to existing block builders, passing optional variant/count overrides.
 * When spec.variant is undefined and compositionSeed is provided, auto-selects via selectVariant().
 */
function buildBlockFromSpec(
  spec: BlockSpec,
  content: CategoryContent,
  biz: BusinessSample,
  category: string,
  pageNames: string[],
  compositionSeed?: number,
): Record<string, unknown> {
  // Auto-select variant if not specified in blueprint and seed is available
  const resolvedVariant = spec.variant ?? (compositionSeed != null ? selectVariant(spec.blockType, compositionSeed, category) : undefined)
  switch (spec.blockType) {
    case 'navigation':
      return { ...buildNavigation(biz, pageNames), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'hero':
      return {
        ...buildHero(biz, category, 0),
        ...(resolvedVariant ? { variant: resolvedVariant } : {}),
        ...(spec.overrides ?? {}),
      }
    case 'features':
      return { ...buildFeatures(biz, category), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'testimonials':
      return { ...buildTestimonials(content), ...(resolvedVariant ? { variant: resolvedVariant } : {}), ...(spec.count ? { items: content.testimonials.slice(0, spec.count) } : {}) }
    case 'contact':
      return { ...buildContact(biz), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'footer':
      return { ...buildFooter(biz, pageNames), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'stats':
      return { ...buildStats(category), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'gallery':
    case 'gallery-masonry':
      return { ...buildGallery(biz), blockType: spec.blockType, ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'faq':
      return { ...buildFAQ(content), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'cta':
      return { ...buildCTA(biz), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'about':
      return { ...buildAbout(biz), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'pricing':
      return { ...buildPricing(category), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'team':
      return { ...buildTeam(category), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'newsletter':
      return { ...buildNewsletter(biz), ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'logo-cloud':
    case 'client-logos':
      return { ...buildClientLogos(), blockType: spec.blockType, ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    // Industry-specific blocks
    case 'menu-display':
      return buildMenuDisplay(content)
    case 'booking-widget':
      return buildBookingWidget(content, category)
    case 'class-schedule':
      return buildClassSchedule()
    case 'review-cards':
      return buildReviewCards(content)
    case 'video-showcase':
      return buildVideoShowcase()
    case 'doctor-profile':
      return buildDoctorProfile(content)
    case 'property-card':
      return buildPropertyCard()
    case 'product-quick-view':
      return buildProductQuickView()
    case 'portfolio-grid':
      return buildPortfolioGrid()
    case 'service-cards':
      return buildServiceCards(biz, category)
    case 'feature-comparison':
      return buildFeatureComparison()
    case 'pricing-table':
      return buildPricingTable()
    case 'before-after':
      return { blockType: 'before-after', variant: resolvedVariant ?? 'slider' }
    case 'countdown-timer':
      return { blockType: 'countdown-timer', variant: resolvedVariant ?? 'elegant', targetDate: '2026-12-31T00:00:00' }
    case 'blog-list':
      return { blockType: 'blog-list', variant: resolvedVariant ?? 'grid', count: spec.count ?? 3 }
    case 'social-proof':
      return { blockType: 'social-proof', variant: resolvedVariant ?? 'counter' }
    case 'products-grid':
      return { blockType: 'products-grid', variant: resolvedVariant ?? 'grid-3', count: spec.count ?? 6 }
    // ── Aliases: map preset blockType names to actual block builders ──
    case 'contact-form':
      return { ...buildContact(biz), blockType: 'contact', ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'map':
    case 'map-embed':
    case 'google-maps':
      return { blockType: 'google-maps', variant: resolvedVariant ?? 'default', address: biz.address, height: '400px' }
    case 'content':
    case 'content-block':
      return { ...buildAbout(biz), blockType: 'about', ...(resolvedVariant ? { variant: resolvedVariant } : {}) }
    case 'timeline':
      return { ...buildAbout(biz), blockType: 'about', variant: 'timeline' }
    default:
      // Try industry block builder as fallback
      const industryBlock = buildIndustryBlock(spec.blockType, content, biz, category)
      if (industryBlock) return industryBlock
      // Unknown block — return minimal spec to avoid silent skip
      console.warn(`[Composer] Unknown blockType: ${spec.blockType}`)
      return { blockType: spec.blockType, variant: resolvedVariant ?? 'default' }
  }
}

/**
 * Compose a template from a TemplatePreset blueprint.
 * Reads pages[].blocks[] and builds each block — no algorithmic guessing.
 * When BlockSpec.variant is undefined, uses selectVariant() for seed-based variety.
 */
export function composeFromBlueprint(preset: TemplatePreset, compositionSeed?: number): TemplateSeed {
  const content = getCategoryContent(preset.category)
  if (!content) {
    throw new Error(`[composeFromBlueprint] Content not found for category: ${preset.category}`)
  }

  const biz = content.businesses[preset.businessIndex]
  if (!biz) {
    throw new Error(`[composeFromBlueprint] businessIndex ${preset.businessIndex} out of range for ${preset.category} (has ${content.businesses.length})`)
  }

  // Use businessIndex as seed if not provided — each template gets deterministic but different variants
  const seed = compositionSeed ?? preset.businessIndex * 7919

  const pageNames = preset.pages.map((p) => p.name)

  // Template path content language — defaults to 'en' since template content
  // in src/lib/ai/content/*.ts is pre-curated. Phase 04 wires the SAME
  // content-rules validator used by the AI path, so any blocked CTA in the
  // hand-authored template content is caught + fixed uniformly.
  const templateLang: ContentLang = 'en'

  const pages: TemplatePage[] = preset.pages.map((page) => ({
    title: page.name,
    slug: page.slug,
    layout: page.blocks.map((spec) => {
      const block = buildBlockFromSpec(spec, content, biz, preset.category, pageNames, seed)
      return applyContentValidation(block, templateLang)
    }),
  }))

  return {
    name: preset.name,
    description: preset.description,
    category: preset.category,
    tier: 'premium',
    isPremium: true,
    theme: preset.themePreset,
    pages,
  }
}

// ── Legacy composer (deprecated — kept for backward compat) ────────────────

/** @deprecated Use composeFromBlueprint() with TemplatePreset instead */
export function composeTemplate(input: ComposerInput): TemplateSeed {
  const content = getCategoryContent(input.category)
  if (!content) {
    throw new Error(`Unknown category: ${input.category}`)
  }

  const biz = content.businesses[input.businessIndex]
  if (!biz) {
    throw new Error(`Business index ${input.businessIndex} out of range for category ${input.category} (has ${content.businesses.length})`)
  }

  const pages = getPageNames(input.variant)
  const templatePages: TemplatePage[] = []

  // Home page (always present)
  templatePages.push(buildHomePage(biz, content, input.category, input.variant, input.businessIndex, pages, input.compositionSeed))

  // Additional pages for professional/premium
  if (input.variant === 'professional' || input.variant === 'premium') {
    templatePages.push(buildAboutPage(biz, content, input.category, pages))
    templatePages.push(buildContactPage(biz, pages))
  }

  if (input.variant === 'premium') {
    templatePages.push(buildServicesPage(biz, content, input.category, pages))
    templatePages.push(buildBlogPage(biz, pages))
  }

  // Build the template name
  const tierLabel = input.variant.charAt(0).toUpperCase() + input.variant.slice(1)
  const name = `${biz.name} — ${input.themePreset.name}`
  const description = `${tierLabel} template for ${input.category}: ${biz.tagline}`

  // Phase 04 — apply content validation across every block built by the
  // legacy path (same rules as AI path + blueprint path, single source of
  // truth in content-rules.ts).
  const legacyLang: ContentLang = 'en'
  const validatedPages: TemplatePage[] = templatePages.map((page) => ({
    ...page,
    layout: page.layout.map((block) =>
      applyContentValidation(block as Record<string, unknown>, legacyLang),
    ),
  }))

  return {
    name,
    description,
    category: input.category,
    tier: input.variant,
    isPremium: input.variant === 'premium',
    theme: input.themePreset,
    pages: validatedPages,
  }
}

