import {
  HEALTH_PRESETS,
  EDUCATION_PRESETS,
  REALESTATE_PRESETS,
  FITNESS_PRESETS,
  CREATIVE_PRESETS,
} from './theme-presets'
import type { TemplatePreset } from './template-definitions'

// ── Batch 2: 20 Templates — health, education, realestate, fitness, creative ──
// 4 per category × 5 categories = 20 templates
// Each homepage has UNIQUE section order. Each sub-page unique per template.

export const BATCH2_PRESETS: TemplatePreset[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH (4 templates) — signature: doctor-profile, booking-widget, stats
  // Pages: Home, Services, Team, About, Contact
  // ═══════════════════════════════════════════════════════════════════════════

  // health-0: trust-professional
  {
    id: 'health-0-trust-professional',
    name: 'MediTrust Clinic',
    category: 'health',
    businessIndex: 0,
    personality: 'trust-professional',
    themePreset: HEALTH_PRESETS[0]!,
    tags: ['health', 'clinic', 'medical', 'professional', 'trust'],
    description: 'Clean clinical layout with doctor profiles front-and-center, building instant patient trust.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'logo-cloud' },
          { blockType: 'doctor-profile', count: 4 },
          { blockType: 'features', variant: 'icon-grid', count: 6 },
          { blockType: 'stats', count: 4 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'booking-widget' },
          { blockType: 'testimonials', variant: 'carousel', count: 5 },
          { blockType: 'faq', variant: 'accordion', count: 6 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Services', slug: '/services',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'features', variant: 'detailed-list', count: 8 },
          { blockType: 'stats', count: 3 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Our Team', slug: '/team',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'doctor-profile', count: 8 },
          { blockType: 'testimonials', variant: 'grid', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About Us', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'content-block', variant: 'two-column' },
          { blockType: 'stats', count: 4 },
          { blockType: 'team', count: 6 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form' },
          { blockType: 'map-embed' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // health-1: warm-wellness
  {
    id: 'health-1-warm-wellness',
    name: 'Harmony Wellness',
    category: 'health',
    businessIndex: 1,
    personality: 'warm-wellness',
    themePreset: HEALTH_PRESETS[1]!,
    tags: ['health', 'wellness', 'holistic', 'warm', 'natural'],
    description: 'Warm and inviting wellness center design with soothing tones and nature-inspired imagery.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'logo-cloud' },
          { blockType: 'features', variant: 'icon-grid', count: 4 },
          { blockType: 'booking-widget' },
          { blockType: 'doctor-profile', count: 3 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'stats', count: 3 },
          { blockType: 'testimonials', variant: 'masonry', count: 6 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Treatments', slug: '/treatments',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'features', variant: 'card-grid', count: 6 },
          { blockType: 'booking-widget' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Practitioners', slug: '/practitioners',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'doctor-profile', count: 6 },
          { blockType: 'content-block', variant: 'single-column' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Our Story', slug: '/our-story',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'content-block', variant: 'two-column' },
          { blockType: 'gallery', variant: 'grid', count: 6 },
          { blockType: 'stats', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Book Now', slug: '/book',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'booking-widget' },
          { blockType: 'contact-form' },
          { blockType: 'map-embed' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // health-2: modern-dark
  {
    id: 'health-2-modern-dark',
    name: 'NightCare Medical',
    category: 'health',
    businessIndex: 2,
    personality: 'modern-dark',
    themePreset: HEALTH_PRESETS[4]!,
    tags: ['health', 'modern', 'dark', 'premium', 'specialist'],
    description: 'Dark-mode medical site for specialist clinics — modern, confident, and high-tech feel.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'video' },
          { blockType: 'logo-cloud' },
          { blockType: 'stats', count: 4 },
          { blockType: 'features', variant: 'alternating', count: 4 },
          { blockType: 'doctor-profile', count: 3 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'gallery', variant: 'masonry', count: 6 },
          { blockType: 'testimonials', variant: 'grid', count: 4 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Specialties', slug: '/specialties',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'features', variant: 'detailed-list', count: 6 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Doctors', slug: '/doctors',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'doctor-profile', count: 10 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'content-block', variant: 'timeline' },
          { blockType: 'stats', count: 5 },
          { blockType: 'team', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Get in Touch', slug: '/get-in-touch',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'contact-form' },
          { blockType: 'booking-widget' },
          { blockType: 'map-embed' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // health-3: minimal-clean
  {
    id: 'health-3-minimal-clean',
    name: 'PureHealth Studio',
    category: 'health',
    businessIndex: 3,
    personality: 'minimal-clean',
    themePreset: HEALTH_PRESETS[2]!,
    tags: ['health', 'minimal', 'clean', 'modern', 'concise'],
    description: 'Ultra-clean minimal design for modern health practices — whitespace-driven with sharp typography.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'logo-cloud' },
          { blockType: 'features', variant: 'minimal-list', count: 3 },
          { blockType: 'stats', count: 3 },
          { blockType: 'doctor-profile', count: 4 },
          { blockType: 'booking-widget' },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'testimonials', variant: 'single-highlight' },
          { blockType: 'faq', variant: 'accordion', count: 4 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'What We Do', slug: '/what-we-do',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'features', variant: 'icon-grid', count: 6 },
          { blockType: 'content-block', variant: 'single-column' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Meet the Team', slug: '/meet-the-team',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'doctor-profile', count: 5 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Philosophy', slug: '/philosophy',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'content-block', variant: 'two-column' },
          { blockType: 'gallery', variant: 'grid', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Reach Us', slug: '/reach-us',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form' },
          { blockType: 'map-embed' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EDUCATION (4 templates) — signature: class-schedule, pricing, stats
  // Pages: Home, Programs, Schedule, About, Contact
  // ═══════════════════════════════════════════════════════════════════════════

  // education-0: academic-classic
  {
    id: 'education-0-academic-classic',
    name: 'Prestige Academy',
    category: 'education',
    businessIndex: 0,
    personality: 'academic-classic',
    themePreset: EDUCATION_PRESETS[0]!,
    tags: ['education', 'academy', 'classic', 'professional', 'structured'],
    description: 'Traditional academic layout with strong hierarchy — perfect for schools and training centers.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'logo-cloud' },
          { blockType: 'features', variant: 'icon-grid', count: 6 },
          { blockType: 'class-schedule' },
          { blockType: 'stats', count: 4 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'pricing', variant: 'three-tier', count: 3 },
          { blockType: 'testimonials', variant: 'carousel', count: 5 },
          { blockType: 'faq', variant: 'accordion', count: 6 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Programs', slug: '/programs',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'features', variant: 'detailed-list', count: 8 },
          { blockType: 'pricing', variant: 'comparison', count: 3 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Schedule', slug: '/schedule',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'class-schedule' },
          { blockType: 'content-block', variant: 'single-column' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'content-block', variant: 'two-column' },
          { blockType: 'stats', count: 4 },
          { blockType: 'team', count: 6 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form' },
          { blockType: 'map-embed' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // education-1: warm-friendly
  {
    id: 'education-1-warm-friendly',
    name: 'BrightPath Learning',
    category: 'education',
    businessIndex: 1,
    personality: 'warm-friendly',
    themePreset: EDUCATION_PRESETS[1]!,
    tags: ['education', 'learning', 'warm', 'friendly', 'kids'],
    description: 'Warm and approachable design for family-friendly learning centers and language schools.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'logo-cloud' },
          { blockType: 'stats', count: 3 },
          { blockType: 'features', variant: 'card-grid', count: 4 },
          { blockType: 'class-schedule' },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'testimonials', variant: 'masonry', count: 6 },
          { blockType: 'pricing', variant: 'three-tier', count: 3 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Our Courses', slug: '/courses',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'features', variant: 'icon-grid', count: 6 },
          { blockType: 'gallery', variant: 'grid', count: 6 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Timetable', slug: '/timetable',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'class-schedule' },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Why Us', slug: '/why-us',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'content-block', variant: 'two-column' },
          { blockType: 'stats', count: 4 },
          { blockType: 'testimonials', variant: 'grid', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Enroll Now', slug: '/enroll',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'pricing', variant: 'three-tier', count: 3 },
          { blockType: 'contact-form' },
          { blockType: 'map-embed' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // education-2: dark-modern
  {
    id: 'education-2-dark-modern',
    name: 'NexGen Institute',
    category: 'education',
    businessIndex: 2,
    personality: 'dark-modern',
    themePreset: EDUCATION_PRESETS[4]!,
    tags: ['education', 'institute', 'dark', 'modern', 'tech'],
    description: 'Dark-themed modern institute layout for coding bootcamps and tech education platforms.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'video' },
          { blockType: 'logo-cloud' },
          { blockType: 'pricing', variant: 'three-tier', count: 3 },
          { blockType: 'features', variant: 'alternating', count: 4 },
          { blockType: 'stats', count: 4 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'class-schedule' },
          { blockType: 'testimonials', variant: 'grid', count: 4 },
          { blockType: 'faq', variant: 'accordion', count: 6 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Bootcamps', slug: '/bootcamps',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'features', variant: 'detailed-list', count: 5 },
          { blockType: 'pricing', variant: 'comparison', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Calendar', slug: '/calendar',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'class-schedule' },
          { blockType: 'stats', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Our Mission', slug: '/mission',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'content-block', variant: 'timeline' },
          { blockType: 'team', count: 5 },
          { blockType: 'stats', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Apply', slug: '/apply',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'contact-form' },
          { blockType: 'faq', variant: 'accordion', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // education-3: minimal-fresh
  {
    id: 'education-3-minimal-fresh',
    name: 'LearnSpace Studio',
    category: 'education',
    businessIndex: 3,
    personality: 'minimal-fresh',
    themePreset: EDUCATION_PRESETS[3]!,
    tags: ['education', 'minimal', 'fresh', 'creative', 'workshop'],
    description: 'Fresh minimal design for creative workshops and skill-building studios — airy and inviting.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'logo-cloud' },
          { blockType: 'class-schedule' },
          { blockType: 'features', variant: 'minimal-list', count: 3 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'stats', count: 3 },
          { blockType: 'pricing', variant: 'three-tier', count: 3 },
          { blockType: 'testimonials', variant: 'single-highlight' },
          { blockType: 'faq', variant: 'accordion', count: 4 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Workshops', slug: '/workshops',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'features', variant: 'card-grid', count: 6 },
          { blockType: 'gallery', variant: 'grid', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Weekly Plan', slug: '/weekly-plan',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'class-schedule' },
          { blockType: 'content-block', variant: 'single-column' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About Studio', slug: '/about-studio',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'content-block', variant: 'two-column' },
          { blockType: 'gallery', variant: 'masonry', count: 6 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Join Us', slug: '/join',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'pricing', variant: 'three-tier', count: 3 },
          { blockType: 'contact-form' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL ESTATE (4 templates) — signature: property-card, gallery-masonry, stats
  // Pages: Home, Properties, Gallery, About, Contact
  // ═══════════════════════════════════════════════════════════════════════════

  // realestate-0: corporate-trust
  {
    id: 'realestate-0-corporate-trust',
    name: 'Premier Realty Group',
    category: 'realestate',
    businessIndex: 0,
    personality: 'corporate-trust',
    themePreset: REALESTATE_PRESETS[0]!,
    tags: ['realestate', 'corporate', 'trust', 'professional', 'agency'],
    description: 'Corporate real estate site with property listings, stats dashboard, and team credibility.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'logo-cloud' },
          { blockType: 'property-card', count: 6 },
          { blockType: 'stats', count: 4 },
          { blockType: 'features', variant: 'icon-grid', count: 4 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'gallery', variant: 'masonry', count: 8 },
          { blockType: 'testimonials', variant: 'carousel', count: 5 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Listings', slug: '/listings',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'property-card', count: 12 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Showcase', slug: '/showcase',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'gallery', variant: 'masonry', count: 12 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'content-block', variant: 'two-column' },
          { blockType: 'stats', count: 4 },
          { blockType: 'team', count: 6 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form' },
          { blockType: 'map-embed' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // realestate-1: dark-luxury
  {
    id: 'realestate-1-dark-luxury',
    name: 'Aurum Estates',
    category: 'realestate',
    businessIndex: 1,
    personality: 'dark-luxury',
    themePreset: REALESTATE_PRESETS[1]!,
    tags: ['realestate', 'luxury', 'dark', 'premium', 'exclusive'],
    description: 'Dark luxury aesthetic for high-end property brokers — gold accents and dramatic visuals.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'logo-cloud' },
          { blockType: 'stats', count: 4 },
          { blockType: 'property-card', count: 4 },
          { blockType: 'gallery', variant: 'masonry', count: 6 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'features', variant: 'alternating', count: 3 },
          { blockType: 'testimonials', variant: 'grid', count: 4 },
          { blockType: 'faq', variant: 'accordion', count: 4 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Portfolio', slug: '/portfolio',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'video' },
          { blockType: 'property-card', count: 8 },
          { blockType: 'stats', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Collection', slug: '/collection',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'gallery', variant: 'masonry', count: 16 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Legacy', slug: '/legacy',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'content-block', variant: 'timeline' },
          { blockType: 'team', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Inquire', slug: '/inquire',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form' },
          { blockType: 'map-embed' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // realestate-2: warm-elegant
  {
    id: 'realestate-2-warm-elegant',
    name: 'GreenVista Homes',
    category: 'realestate',
    businessIndex: 2,
    personality: 'warm-elegant',
    themePreset: REALESTATE_PRESETS[3]!,
    tags: ['realestate', 'warm', 'elegant', 'suburban', 'family'],
    description: 'Warm elegant design for suburban real estate — garden estates and family homes with a welcoming vibe.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'video' },
          { blockType: 'logo-cloud' },
          { blockType: 'features', variant: 'card-grid', count: 4 },
          { blockType: 'property-card', count: 6 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'stats', count: 3 },
          { blockType: 'gallery', variant: 'masonry', count: 6 },
          { blockType: 'testimonials', variant: 'masonry', count: 5 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Available Homes', slug: '/available-homes',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'property-card', count: 9 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Photo Tour', slug: '/photo-tour',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'gallery', variant: 'masonry', count: 14 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Our Values', slug: '/our-values',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'content-block', variant: 'two-column' },
          { blockType: 'stats', count: 4 },
          { blockType: 'testimonials', variant: 'grid', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Schedule Visit', slug: '/schedule-visit',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'booking-widget' },
          { blockType: 'contact-form' },
          { blockType: 'map-embed' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // realestate-3: minimal-modern
  {
    id: 'realestate-3-minimal-modern',
    name: 'CityLine Properties',
    category: 'realestate',
    businessIndex: 3,
    personality: 'minimal-modern',
    themePreset: REALESTATE_PRESETS[2]!,
    tags: ['realestate', 'minimal', 'modern', 'urban', 'apartments'],
    description: 'Minimal modern design for urban apartment listings — sharp lines, clean grids, zero clutter.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'logo-cloud' },
          { blockType: 'property-card', count: 4 },
          { blockType: 'features', variant: 'minimal-list', count: 3 },
          { blockType: 'stats', count: 3 },
          { blockType: 'gallery', variant: 'masonry', count: 4 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'testimonials', variant: 'single-highlight' },
          { blockType: 'faq', variant: 'accordion', count: 4 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Browse', slug: '/browse',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'property-card', count: 12 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Visual Tour', slug: '/visual-tour',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'gallery', variant: 'masonry', count: 10 },
          { blockType: 'video-showcase' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'The Company', slug: '/the-company',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'content-block', variant: 'single-column' },
          { blockType: 'stats', count: 4 },
          { blockType: 'team', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Get Started', slug: '/get-started',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'contact-form' },
          { blockType: 'map-embed' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FITNESS (4 templates) — signature: class-schedule, pricing, before-after
  // Pages: Home, Classes, Pricing, About, Contact
  // ═══════════════════════════════════════════════════════════════════════════

  // fitness-0: bold-aggressive
  {
    id: 'fitness-0-bold-aggressive',
    name: 'IronForge Gym',
    category: 'fitness',
    businessIndex: 0,
    personality: 'bold-aggressive',
    themePreset: FITNESS_PRESETS[0]!,
    tags: ['fitness', 'gym', 'bold', 'aggressive', 'strength'],
    description: 'High-energy bold design for strength gyms — dark backgrounds, orange accents, in-your-face CTAs.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'video' },
          { blockType: 'logo-cloud' },
          { blockType: 'before-after', count: 3 },
          { blockType: 'features', variant: 'icon-grid', count: 6 },
          { blockType: 'class-schedule' },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'pricing', variant: 'three-tier', count: 3 },
          { blockType: 'testimonials', variant: 'carousel', count: 5 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Programs', slug: '/programs',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'features', variant: 'detailed-list', count: 6 },
          { blockType: 'class-schedule' },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Membership', slug: '/membership',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'pricing', variant: 'comparison', count: 3 },
          { blockType: 'before-after', count: 2 },
          { blockType: 'faq', variant: 'accordion', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Our Story', slug: '/our-story',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'content-block', variant: 'two-column' },
          { blockType: 'stats', count: 4 },
          { blockType: 'team', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form' },
          { blockType: 'map-embed' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // fitness-1: calm-wellness
  {
    id: 'fitness-1-calm-wellness',
    name: 'ZenFlow Yoga',
    category: 'fitness',
    businessIndex: 1,
    personality: 'calm-wellness',
    themePreset: FITNESS_PRESETS[2]!,
    tags: ['fitness', 'yoga', 'calm', 'wellness', 'mindfulness'],
    description: 'Calm, soothing yoga studio design — soft tones, ample whitespace, mindful imagery.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'logo-cloud' },
          { blockType: 'features', variant: 'card-grid', count: 4 },
          { blockType: 'class-schedule' },
          { blockType: 'before-after', count: 2 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'pricing', variant: 'three-tier', count: 3 },
          { blockType: 'testimonials', variant: 'masonry', count: 6 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Class Styles', slug: '/class-styles',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'features', variant: 'alternating', count: 5 },
          { blockType: 'class-schedule' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Plans', slug: '/plans',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'pricing', variant: 'three-tier', count: 3 },
          { blockType: 'testimonials', variant: 'grid', count: 3 },
          { blockType: 'faq', variant: 'accordion', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Philosophy', slug: '/philosophy',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'content-block', variant: 'two-column' },
          { blockType: 'gallery', variant: 'grid', count: 6 },
          { blockType: 'team', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Visit Us', slug: '/visit',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'booking-widget' },
          { blockType: 'contact-form' },
          { blockType: 'map-embed' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // fitness-2: neon-futuristic
  {
    id: 'fitness-2-neon-futuristic',
    name: 'Pulse Arena',
    category: 'fitness',
    businessIndex: 2,
    personality: 'neon-futuristic',
    themePreset: FITNESS_PRESETS[3]!,
    tags: ['fitness', 'neon', 'futuristic', 'hiit', 'performance'],
    description: 'Neon-futuristic fitness site for HIIT studios and performance training — electric and energizing.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'video' },
          { blockType: 'logo-cloud' },
          { blockType: 'stats', count: 4 },
          { blockType: 'class-schedule' },
          { blockType: 'before-after', count: 3 },
          { blockType: 'features', variant: 'alternating', count: 4 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'testimonials', variant: 'grid', count: 4 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Training', slug: '/training',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'video' },
          { blockType: 'features', variant: 'icon-grid', count: 8 },
          { blockType: 'class-schedule' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Subscriptions', slug: '/subscriptions',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'pricing', variant: 'comparison', count: 3 },
          { blockType: 'before-after', count: 2 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'The Lab', slug: '/the-lab',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'content-block', variant: 'timeline' },
          { blockType: 'stats', count: 5 },
          { blockType: 'gallery', variant: 'masonry', count: 6 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Book Trial', slug: '/book-trial',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'booking-widget' },
          { blockType: 'contact-form' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // fitness-3: fresh-active
  {
    id: 'fitness-3-fresh-active',
    name: 'ActiveLife Club',
    category: 'fitness',
    businessIndex: 3,
    personality: 'fresh-active',
    themePreset: FITNESS_PRESETS[4]!,
    tags: ['fitness', 'fresh', 'active', 'community', 'lifestyle'],
    description: 'Fresh and approachable community fitness club — bright colors, friendly tone, lifestyle-focused.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'logo-cloud' },
          { blockType: 'features', variant: 'card-grid', count: 4 },
          { blockType: 'before-after', count: 2 },
          { blockType: 'stats', count: 3 },
          { blockType: 'class-schedule' },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'testimonials', variant: 'carousel', count: 6 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Activities', slug: '/activities',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'features', variant: 'icon-grid', count: 8 },
          { blockType: 'class-schedule' },
          { blockType: 'gallery', variant: 'grid', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Membership Plans', slug: '/membership-plans',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'pricing', variant: 'three-tier', count: 3 },
          { blockType: 'testimonials', variant: 'grid', count: 3 },
          { blockType: 'faq', variant: 'accordion', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Community', slug: '/community',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'content-block', variant: 'two-column' },
          { blockType: 'before-after', count: 4 },
          { blockType: 'stats', count: 4 },
          { blockType: 'team', count: 6 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Free Trial', slug: '/free-trial',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'contact-form' },
          { blockType: 'map-embed' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CREATIVE (4 templates) — signature: portfolio-grid, gallery-masonry, video-showcase
  // Pages: Home, Portfolio, About, Services, Contact
  // ═══════════════════════════════════════════════════════════════════════════

  // creative-0: ultra-minimal
  {
    id: 'creative-0-ultra-minimal',
    name: 'Blank Canvas Studio',
    category: 'creative',
    businessIndex: 0,
    personality: 'ultra-minimal',
    themePreset: CREATIVE_PRESETS[2]!,
    tags: ['creative', 'minimal', 'studio', 'design', 'whitespace'],
    description: 'Ultra-minimal portfolio for designers and architects — let the work speak through whitespace.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'logo-cloud' },
          { blockType: 'portfolio-grid', count: 6 },
          { blockType: 'features', variant: 'minimal-list', count: 3 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'gallery', variant: 'masonry', count: 4 },
          { blockType: 'testimonials', variant: 'single-highlight' },
          { blockType: 'faq', variant: 'accordion', count: 4 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Work', slug: '/work',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'portfolio-grid', count: 12 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Profile', slug: '/profile',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'content-block', variant: 'two-column' },
          { blockType: 'stats', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Capabilities', slug: '/capabilities',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'features', variant: 'detailed-list', count: 5 },
          { blockType: 'gallery', variant: 'masonry', count: 6 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Say Hello', slug: '/say-hello',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'contact-form', variant: 'card-float' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // creative-1: colorful-bold
  {
    id: 'creative-1-colorful-bold',
    name: 'Chromatic Agency',
    category: 'creative',
    businessIndex: 1,
    personality: 'colorful-bold',
    themePreset: CREATIVE_PRESETS[0]!,
    tags: ['creative', 'colorful', 'bold', 'agency', 'branding'],
    description: 'Colorful bold agency site for branding and marketing studios — vibrant, playful, memorable.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'logo-cloud' },
          { blockType: 'video-showcase' },
          { blockType: 'portfolio-grid', count: 6 },
          { blockType: 'features', variant: 'icon-grid', count: 4 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'testimonials', variant: 'carousel', count: 5 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Case Studies', slug: '/case-studies',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'portfolio-grid', count: 9 },
          { blockType: 'video-showcase' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About Agency', slug: '/about-agency',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'content-block', variant: 'two-column' },
          { blockType: 'team', count: 8 },
          { blockType: 'stats', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'What We Do', slug: '/what-we-do',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'features', variant: 'alternating', count: 5 },
          { blockType: 'gallery', variant: 'masonry', count: 8 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Start a Project', slug: '/start-project',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form', variant: 'card-float' },
          { blockType: 'map-embed' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // creative-2: moody-dark
  {
    id: 'creative-2-moody-dark',
    name: 'Noir Visual Lab',
    category: 'creative',
    businessIndex: 2,
    personality: 'moody-dark',
    themePreset: CREATIVE_PRESETS[1]!,
    tags: ['creative', 'moody', 'dark', 'photography', 'film'],
    description: 'Moody dark portfolio for photographers and filmmakers — dramatic lighting, cinematic presence.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'video' },
          { blockType: 'logo-cloud' },
          { blockType: 'gallery', variant: 'masonry', count: 8 },
          { blockType: 'portfolio-grid', count: 4 },
          { blockType: 'video-showcase' },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'testimonials', variant: 'grid', count: 4 },
          { blockType: 'faq', variant: 'accordion', count: 4 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Projects', slug: '/projects',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'portfolio-grid', count: 12 },
          { blockType: 'video-showcase' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'The Artist', slug: '/the-artist',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'content-block', variant: 'timeline' },
          { blockType: 'gallery', variant: 'masonry', count: 6 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Offerings', slug: '/offerings',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'features', variant: 'detailed-list', count: 4 },
          { blockType: 'pricing', variant: 'three-tier', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Collaborate', slug: '/collaborate',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form', variant: 'card-float' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // creative-3: clean-studio
  {
    id: 'creative-3-clean-studio',
    name: 'Atelier Digital',
    category: 'creative',
    businessIndex: 3,
    personality: 'clean-studio',
    themePreset: CREATIVE_PRESETS[3]!,
    tags: ['creative', 'clean', 'studio', 'digital', 'web-design'],
    description: 'Clean studio design for digital agencies and web studios — structured yet creative.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-left' },
          { blockType: 'logo-cloud' },
          { blockType: 'features', variant: 'card-grid', count: 4 },
          { blockType: 'portfolio-grid', count: 6 },
          { blockType: 'gallery', variant: 'masonry', count: 4 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'video-showcase' },
          { blockType: 'testimonials', variant: 'masonry', count: 5 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Selected Work', slug: '/selected-work',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'portfolio-grid', count: 9 },
          { blockType: 'gallery', variant: 'masonry', count: 6 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Studio', slug: '/studio',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'content-block', variant: 'two-column' },
          { blockType: 'team', count: 6 },
          { blockType: 'stats', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Expertise', slug: '/expertise',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'features', variant: 'alternating', count: 4 },
          { blockType: 'video-showcase' },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Hire Us', slug: '/hire-us',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'contact-form', variant: 'card-float' },
          { blockType: 'map-embed' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },
]
