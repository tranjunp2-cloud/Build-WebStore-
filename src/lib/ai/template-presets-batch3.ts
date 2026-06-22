import { BUSINESS_PRESETS, EVENTS_PRESETS, BLOG_PRESETS, TRAVEL_PRESETS } from './theme-presets'
import type { TemplatePreset } from './template-definitions'

// ── Batch 3: Business (4) + Events (4) + Blog (4) + Travel (4) = 16 presets ──

export const BATCH3_PRESETS: TemplatePreset[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // BUSINESS — signature: stats, team, feature-comparison
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Business 0: Classic Professional ────────────────────────────────────
  {
    id: 'business-0-classic-professional',
    name: 'Corporate Trust',
    category: 'business',
    businessIndex: 0,
    personality: 'classic-professional',
    themePreset: BUSINESS_PRESETS[0]!,
    tags: ['corporate', 'consulting', 'professional', 'trust'],
    description: 'Clean corporate site with strong trust signals, team showcase, and clear service presentation.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-right' },
          { blockType: 'logo-cloud' },
          { blockType: 'features', variant: 'grid', count: 6 },
          { blockType: 'stats', variant: 'counter', count: 4 },
          { blockType: 'feature-comparison', variant: 'table' },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'team', variant: 'grid', count: 4 },
          { blockType: 'testimonials', variant: 'carousel', count: 3 },
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
          { blockType: 'features', variant: 'alternating', count: 4 },
          { blockType: 'stats', variant: 'inline', count: 3 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'magazine' },
          { blockType: 'stats', variant: 'counter', count: 4 },
          { blockType: 'team', variant: 'detailed', count: 3 },
          { blockType: 'testimonials', variant: 'quote', count: 2 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Team', slug: '/team',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'team', variant: 'grid', count: 8 },
          { blockType: 'cta', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form', variant: 'split-right' },
          { blockType: 'map' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ── Business 1: Premium Dark ───────────────────────────────────────────
  {
    id: 'business-1-premium-dark',
    name: 'Executive Dark',
    category: 'business',
    businessIndex: 1,
    personality: 'premium-dark',
    themePreset: BUSINESS_PRESETS[1]!,
    tags: ['executive', 'dark', 'premium', 'finance'],
    description: 'Sleek dark-mode business site with authority stats and executive team profiles.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'logo-cloud' },
          { blockType: 'stats', variant: 'large', count: 4 },
          { blockType: 'features', variant: 'icon-grid', count: 6 },
          { blockType: 'team', variant: 'spotlight', count: 3 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'feature-comparison', variant: 'cards' },
          { blockType: 'testimonials', variant: 'grid', count: 4 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Services', slug: '/services',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-right' },
          { blockType: 'features', variant: 'detailed', count: 5 },
          { blockType: 'feature-comparison', variant: 'table' },
          { blockType: 'cta', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'magazine' },
          { blockType: 'stats', variant: 'counter', count: 4 },
          { blockType: 'timeline', variant: 'vertical', count: 5 },
          { blockType: 'testimonials', variant: 'featured', count: 2 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Team', slug: '/team',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'team', variant: 'executive', count: 6 },
          { blockType: 'stats', variant: 'inline', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form', variant: 'centered' },
          { blockType: 'map' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ── Business 2: Fresh Modern ───────────────────────────────────────────
  {
    id: 'business-2-fresh-modern',
    name: 'Clean Consult',
    category: 'business',
    businessIndex: 2,
    personality: 'fresh-modern',
    themePreset: BUSINESS_PRESETS[2]!,
    tags: ['modern', 'startup', 'clean', 'consulting'],
    description: 'Fresh modern layout for consultancies and startups with vibrant accents and clear CTAs.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-right' },
          { blockType: 'logo-cloud' },
          { blockType: 'features', variant: 'alternating', count: 3 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'stats', variant: 'counter', count: 4 },
          { blockType: 'team', variant: 'compact', count: 4 },
          { blockType: 'feature-comparison', variant: 'cards' },
          { blockType: 'testimonials', variant: 'slider', count: 3 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Services', slug: '/services',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'features', variant: 'grid', count: 6 },
          { blockType: 'pricing', variant: 'tiers', count: 3 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-right' },
          { blockType: 'team', variant: 'grid', count: 6 },
          { blockType: 'stats', variant: 'large', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Team', slug: '/team',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'team', variant: 'detailed', count: 8 },
          { blockType: 'testimonials', variant: 'quote', count: 2 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form', variant: 'with-info' },
          { blockType: 'map' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ── Business 3: Bold Enterprise ────────────────────────────────────────
  {
    id: 'business-3-bold-enterprise',
    name: 'Green Enterprise',
    category: 'business',
    businessIndex: 3,
    personality: 'bold-enterprise',
    themePreset: BUSINESS_PRESETS[3]!,
    tags: ['enterprise', 'bold', 'green', 'sustainability'],
    description: 'Bold enterprise site with sustainability focus, impactful stats, and strong team presence.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'logo-cloud' },
          { blockType: 'team', variant: 'spotlight', count: 3 },
          { blockType: 'features', variant: 'icon-grid', count: 8 },
          { blockType: 'stats', variant: 'large', count: 4 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'feature-comparison', variant: 'table' },
          { blockType: 'testimonials', variant: 'featured', count: 3 },
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
          { blockType: 'features', variant: 'detailed', count: 4 },
          { blockType: 'stats', variant: 'counter', count: 4 },
          { blockType: 'cta', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'timeline', variant: 'horizontal', count: 6 },
          { blockType: 'stats', variant: 'inline', count: 4 },
          { blockType: 'team', variant: 'grid', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Team', slug: '/team',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-right' },
          { blockType: 'team', variant: 'executive', count: 10 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form', variant: 'multi-location' },
          { blockType: 'map' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENTS — signature: countdown-timer, booking-widget, gallery
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Events 0: Elegant Blush ────────────────────────────────────────────
  {
    id: 'events-0-elegant-blush',
    name: 'Elegant Blush',
    category: 'events',
    businessIndex: 0,
    personality: 'elegant-blush',
    themePreset: EVENTS_PRESETS[0]!,
    tags: ['wedding', 'elegant', 'romantic', 'blush'],
    description: 'Romantic blush-toned event site with countdown, booking, and elegant gallery.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'logo-cloud' },
          { blockType: 'countdown-timer', variant: 'elegant' },
          { blockType: 'features', variant: 'alternating', count: 3 },
          { blockType: 'gallery', variant: 'masonry', count: 8 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'booking-widget', variant: 'inline' },
          { blockType: 'testimonials', variant: 'carousel', count: 4 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Services', slug: '/services',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'features', variant: 'grid', count: 6 },
          { blockType: 'pricing', variant: 'packages', count: 3 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Gallery', slug: '/gallery',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'gallery', variant: 'lightbox', count: 16 },
          { blockType: 'testimonials', variant: 'quote', count: 2 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'magazine' },
          { blockType: 'team', variant: 'grid', count: 4 },
          { blockType: 'stats', variant: 'counter', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'booking-widget', variant: 'full' },
          { blockType: 'contact-form', variant: 'split-right' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ── Events 1: Royal Night ──────────────────────────────────────────────
  {
    id: 'events-1-royal-night',
    name: 'Royal Night',
    category: 'events',
    businessIndex: 1,
    personality: 'royal-night',
    themePreset: EVENTS_PRESETS[1]!,
    tags: ['gala', 'luxury', 'night', 'royal'],
    description: 'Dark luxurious event site for galas and award nights with gold accents.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'logo-cloud' },
          { blockType: 'features', variant: 'icon-grid', count: 4 },
          { blockType: 'countdown-timer', variant: 'dramatic' },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'gallery', variant: 'carousel', count: 10 },
          { blockType: 'booking-widget', variant: 'inline' },
          { blockType: 'testimonials', variant: 'featured', count: 3 },
          { blockType: 'faq', variant: 'accordion', count: 6 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Services', slug: '/services',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-right' },
          { blockType: 'features', variant: 'detailed', count: 5 },
          { blockType: 'pricing', variant: 'tiers', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Gallery', slug: '/gallery',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'gallery', variant: 'grid', count: 12 },
          // { blockType: 'video-showcase', variant: 'featured' }, // temporarily hidden (aiVisible: false, archived)
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'timeline', variant: 'vertical', count: 5 },
          { blockType: 'team', variant: 'spotlight', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form', variant: 'centered' },
          { blockType: 'map' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ── Events 2: Garden Party ─────────────────────────────────────────────
  {
    id: 'events-2-garden-party',
    name: 'Garden Party',
    category: 'events',
    businessIndex: 2,
    personality: 'garden-party',
    themePreset: EVENTS_PRESETS[2]!,
    tags: ['garden', 'outdoor', 'natural', 'party'],
    description: 'Fresh garden-party vibe with organic shapes, floral tones, and outdoor gallery.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-right' },
          { blockType: 'logo-cloud' },
          { blockType: 'gallery', variant: 'masonry', count: 6 },
          { blockType: 'features', variant: 'grid', count: 4 },
          { blockType: 'countdown-timer', variant: 'minimal' },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'testimonials', variant: 'grid', count: 4 },
          { blockType: 'booking-widget', variant: 'compact' },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Services', slug: '/services',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'features', variant: 'alternating', count: 4 },
          { blockType: 'pricing', variant: 'cards', count: 3 },
          { blockType: 'cta', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Gallery', slug: '/gallery',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'gallery', variant: 'masonry', count: 20 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'team', variant: 'detailed', count: 4 },
          { blockType: 'testimonials', variant: 'carousel', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'booking-widget', variant: 'full' },
          { blockType: 'contact-form', variant: 'with-info' },
          { blockType: 'map' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ── Events 3: Modern Gala ──────────────────────────────────────────────
  {
    id: 'events-3-modern-gala',
    name: 'Modern Gala',
    category: 'events',
    businessIndex: 3,
    personality: 'modern-gala',
    themePreset: EVENTS_PRESETS[3]!,
    tags: ['modern', 'gala', 'conference', 'minimal'],
    description: 'Minimal dark-mode event site for conferences and modern galas with bold typography.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'magazine' },
          { blockType: 'logo-cloud' },
          { blockType: 'features', variant: 'detailed', count: 3 },
          { blockType: 'gallery', variant: 'grid', count: 6 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'countdown-timer', variant: 'bold' },
          { blockType: 'booking-widget', variant: 'inline' },
          { blockType: 'testimonials', variant: 'slider', count: 3 },
          { blockType: 'faq', variant: 'accordion', count: 4 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Services', slug: '/services',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'features', variant: 'icon-grid', count: 6 },
          { blockType: 'pricing', variant: 'tiers', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Gallery', slug: '/gallery',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'gallery', variant: 'carousel', count: 12 },
          // { blockType: 'video-showcase', variant: 'grid', count: 3 }, // temporarily hidden (aiVisible: false, archived)
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-right' },
          { blockType: 'stats', variant: 'large', count: 4 },
          { blockType: 'team', variant: 'compact', count: 6 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'booking-widget', variant: 'full' },
          { blockType: 'contact-form', variant: 'split-right' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BLOG — signature: blog-list, newsletter, social-proof
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Blog 0: Editorial White ────────────────────────────────────────────
  {
    id: 'blog-0-editorial-white',
    name: 'Editorial White',
    category: 'blog',
    businessIndex: 0,
    personality: 'editorial-white',
    themePreset: BLOG_PRESETS[0]!,
    tags: ['editorial', 'clean', 'minimal', 'journalism'],
    description: 'Clean editorial blog with sharp typography, structured article layout, and reading-first design.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'magazine' },
          { blockType: 'logo-cloud' },
          { blockType: 'blog-list', variant: 'featured', count: 3 },
          { blockType: 'social-proof', variant: 'stats', count: 4 },
          { blockType: 'features', variant: 'grid', count: 3 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'blog-list', variant: 'grid', count: 6 },
          { blockType: 'testimonials', variant: 'quote', count: 3 },
          { blockType: 'faq', variant: 'accordion', count: 4 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Articles', slug: '/articles',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'blog-list', variant: 'list', count: 12 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'magazine' },
          { blockType: 'team', variant: 'grid', count: 3 },
          { blockType: 'social-proof', variant: 'logos' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Categories', slug: '/categories',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'features', variant: 'card-grid', count: 8 },
          { blockType: 'blog-list', variant: 'compact', count: 6 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form', variant: 'centered' },
          { blockType: 'social-proof', variant: 'testimonials', count: 2 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ── Blog 1: Midnight Read ──────────────────────────────────────────────
  {
    id: 'blog-1-midnight-read',
    name: 'Midnight Read',
    category: 'blog',
    businessIndex: 1,
    personality: 'midnight-read',
    themePreset: BLOG_PRESETS[1]!,
    tags: ['dark', 'night', 'reading', 'tech-blog'],
    description: 'Dark-mode blog optimized for long-form reading with vibrant accent highlights.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'logo-cloud' },
          { blockType: 'blog-list', variant: 'cards-overlay', count: 1 },
          { blockType: 'blog-list', variant: 'grid', count: 6 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'social-proof', variant: 'counter', count: 4 },
          { blockType: 'testimonials', variant: 'carousel', count: 4 },
          { blockType: 'features', variant: 'alternating', count: 3 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Articles', slug: '/articles',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'blog-list', variant: 'magazine', count: 10 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-right' },
          { blockType: 'team', variant: 'spotlight', count: 2 },
          { blockType: 'stats', variant: 'counter', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Categories', slug: '/categories',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'features', variant: 'icon-grid', count: 10 },
          { blockType: 'blog-list', variant: 'featured', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form', variant: 'split-right' },
          { blockType: 'social-proof', variant: 'logos' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ── Blog 2: Fresh Ink ──────────────────────────────────────────────────
  {
    id: 'blog-2-fresh-ink',
    name: 'Fresh Ink',
    category: 'blog',
    businessIndex: 2,
    personality: 'fresh-ink',
    themePreset: BLOG_PRESETS[2]!,
    tags: ['fresh', 'lifestyle', 'green', 'modern'],
    description: 'Vibrant lifestyle blog with rounded elements, playful layout, and social integration.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-right' },
          { blockType: 'logo-cloud' },
          { blockType: 'social-proof', variant: 'badges', count: 4 },
          { blockType: 'blog-list', variant: 'masonry', count: 6 },
          { blockType: 'features', variant: 'icon-grid', count: 4 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'testimonials', variant: 'grid', count: 3 },
          { blockType: 'blog-list', variant: 'compact', count: 4 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Articles', slug: '/articles',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'blog-list', variant: 'grid', count: 9 },
          { blockType: 'cta', variant: 'inline' },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'team', variant: 'detailed', count: 3 },
          { blockType: 'social-proof', variant: 'counter', count: 3 },
          { blockType: 'testimonials', variant: 'quote', count: 2 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Categories', slug: '/categories',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'features', variant: 'grid', count: 6 },
          { blockType: 'blog-list', variant: 'list', count: 8 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form', variant: 'with-info' },
          { blockType: 'map' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ── Blog 3: Bold Voice ─────────────────────────────────────────────────
  {
    id: 'blog-3-bold-voice',
    name: 'Bold Voice',
    category: 'blog',
    businessIndex: 3,
    personality: 'bold-voice',
    themePreset: BLOG_PRESETS[3]!,
    tags: ['bold', 'opinion', 'red', 'media'],
    description: 'High-impact opinion blog with bold colors, compact layout, and strong CTAs.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'magazine' },
          { blockType: 'logo-cloud' },
          { blockType: 'blog-list', variant: 'headline', count: 5 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'social-proof', variant: 'stats', count: 4 },
          { blockType: 'blog-list', variant: 'grid', count: 4 },
          { blockType: 'features', variant: 'grid', count: 3 },
          { blockType: 'testimonials', variant: 'featured', count: 3 },
          { blockType: 'faq', variant: 'accordion', count: 4 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Articles', slug: '/articles',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-right' },
          { blockType: 'blog-list', variant: 'featured', count: 2 },
          { blockType: 'blog-list', variant: 'list', count: 10 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'team', variant: 'compact', count: 4 },
          { blockType: 'social-proof', variant: 'logos' },
          { blockType: 'stats', variant: 'large', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Categories', slug: '/categories',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'features', variant: 'card-grid', count: 6 },
          { blockType: 'blog-list', variant: 'headline', count: 6 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form', variant: 'centered' },
          { blockType: 'social-proof', variant: 'testimonials', count: 2 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TRAVEL — signature: gallery, booking-widget, stats
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Travel 0: Tropical Escape ──────────────────────────────────────────
  {
    id: 'travel-0-tropical-escape',
    name: 'Tropical Escape',
    category: 'travel',
    businessIndex: 0,
    personality: 'tropical-escape',
    themePreset: TRAVEL_PRESETS[0]!,
    tags: ['tropical', 'beach', 'resort', 'warm'],
    description: 'Warm tropical travel site with immersive galleries, booking, and destination stats.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'logo-cloud' },
          { blockType: 'gallery', variant: 'carousel', count: 8 },
          { blockType: 'features', variant: 'alternating', count: 3 },
          { blockType: 'stats', variant: 'counter', count: 4 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'booking-widget', variant: 'inline' },
          { blockType: 'testimonials', variant: 'carousel', count: 4 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Destinations', slug: '/destinations',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'gallery', variant: 'grid', count: 9 },
          { blockType: 'features', variant: 'card-grid', count: 6 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Tours', slug: '/tours',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-right' },
          { blockType: 'features', variant: 'detailed', count: 4 },
          { blockType: 'pricing', variant: 'packages', count: 3 },
          { blockType: 'booking-widget', variant: 'full' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'magazine' },
          { blockType: 'stats', variant: 'large', count: 4 },
          { blockType: 'team', variant: 'grid', count: 4 },
          { blockType: 'testimonials', variant: 'quote', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form', variant: 'split-right' },
          { blockType: 'map' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ── Travel 1: Explorer Dark ────────────────────────────────────────────
  {
    id: 'travel-1-explorer-dark',
    name: 'Explorer Dark',
    category: 'travel',
    businessIndex: 1,
    personality: 'explorer-dark',
    themePreset: TRAVEL_PRESETS[1]!,
    tags: ['adventure', 'dark', 'explorer', 'outdoor'],
    description: 'Dark adventure travel site for expeditions with dramatic imagery and bold stats.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'logo-cloud' },
          { blockType: 'stats', variant: 'large', count: 4 },
          { blockType: 'gallery', variant: 'masonry', count: 8 },
          { blockType: 'features', variant: 'icon-grid', count: 6 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'booking-widget', variant: 'inline' },
          { blockType: 'testimonials', variant: 'featured', count: 3 },
          { blockType: 'faq', variant: 'accordion', count: 6 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Destinations', slug: '/destinations',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'gallery', variant: 'lightbox', count: 12 },
          { blockType: 'stats', variant: 'inline', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Tours', slug: '/tours',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'features', variant: 'detailed', count: 5 },
          { blockType: 'pricing', variant: 'tiers', count: 3 },
          { blockType: 'booking-widget', variant: 'full' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-right' },
          { blockType: 'timeline', variant: 'vertical', count: 5 },
          { blockType: 'team', variant: 'spotlight', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form', variant: 'centered' },
          { blockType: 'map' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ── Travel 2: Heritage Trail ───────────────────────────────────────────
  {
    id: 'travel-2-heritage-trail',
    name: 'Heritage Trail',
    category: 'travel',
    businessIndex: 2,
    personality: 'heritage-trail',
    themePreset: TRAVEL_PRESETS[2]!,
    tags: ['heritage', 'cultural', 'history', 'warm'],
    description: 'Warm heritage travel site for cultural tours with elegant typography and rich galleries.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-right' },
          { blockType: 'logo-cloud' },
          { blockType: 'features', variant: 'alternating', count: 3 },
          { blockType: 'gallery', variant: 'grid', count: 6 },
          { blockType: 'booking-widget', variant: 'compact' },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'stats', variant: 'counter', count: 4 },
          { blockType: 'testimonials', variant: 'grid', count: 4 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Destinations', slug: '/destinations',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'gallery', variant: 'masonry', count: 10 },
          { blockType: 'features', variant: 'grid', count: 4 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Tours', slug: '/tours',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'features', variant: 'card-grid', count: 6 },
          { blockType: 'pricing', variant: 'cards', count: 3 },
          { blockType: 'booking-widget', variant: 'full' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'magazine' },
          { blockType: 'timeline', variant: 'horizontal', count: 6 },
          { blockType: 'team', variant: 'detailed', count: 4 },
          { blockType: 'stats', variant: 'inline', count: 3 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'contact-form', variant: 'with-info' },
          { blockType: 'map' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },

  // ── Travel 3: Backpacker Fresh ─────────────────────────────────────────
  {
    id: 'travel-3-backpacker-fresh',
    name: 'Backpacker Fresh',
    category: 'travel',
    businessIndex: 3,
    personality: 'backpacker-fresh',
    themePreset: TRAVEL_PRESETS[3]!,
    tags: ['backpacker', 'budget', 'fresh', 'adventure'],
    description: 'Energetic budget-travel site with compact layout, vibrant colors, and quick booking.',
    pages: [
      {
        name: 'Home', slug: '/', isHomepage: true,
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'fullscreen' },
          { blockType: 'logo-cloud' },
          { blockType: 'booking-widget', variant: 'compact' },
          { blockType: 'gallery', variant: 'grid', count: 6 },
          { blockType: 'stats', variant: 'inline', count: 4 },
          { blockType: 'features', variant: 'grid', count: 4 },
          { blockType: 'cta', variant: 'banner' },
          { blockType: 'testimonials', variant: 'slider', count: 4 },
          { blockType: 'faq', variant: 'accordion', count: 5 },
          { blockType: 'newsletter', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Destinations', slug: '/destinations',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'split-right' },
          { blockType: 'gallery', variant: 'carousel', count: 10 },
          { blockType: 'features', variant: 'icon-grid', count: 8 },
          { blockType: 'cta', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Tours', slug: '/tours',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'features', variant: 'alternating', count: 4 },
          { blockType: 'pricing', variant: 'packages', count: 3 },
          { blockType: 'booking-widget', variant: 'inline' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'About', slug: '/about',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'centered' },
          { blockType: 'stats', variant: 'counter', count: 4 },
          { blockType: 'team', variant: 'compact', count: 3 },
          { blockType: 'gallery', variant: 'masonry', count: 6 },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
      {
        name: 'Contact', slug: '/contact',
        blocks: [
          { blockType: 'navigation' },
          { blockType: 'hero', variant: 'minimal' },
          { blockType: 'booking-widget', variant: 'full' },
          { blockType: 'contact-form', variant: 'split-right' },
          { blockType: 'footer', variant: 'mega' },
        ],
      },
    ],
  },
]
