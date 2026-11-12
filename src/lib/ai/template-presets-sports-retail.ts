import type { PageBlueprint, TemplatePreset } from './template-definitions'
import { ECOMMERCE_PRESETS } from './theme-presets'

function sportsRetailPages(
  heroVariant: string,
  productsVariant: string,
): PageBlueprint[] {
  return [
    {
      name: 'Home', slug: '/', isHomepage: true,
      blocks: [
        { blockType: 'navigation' },
        { blockType: 'hero', variant: heroVariant },
        { blockType: 'products-grid', variant: productsVariant, count: 8 },
        { blockType: 'features', variant: 'icon-grid' },
        { blockType: 'gallery', variant: 'grid', count: 6 },
        { blockType: 'testimonials', variant: 'cards' },
        { blockType: 'cta', variant: 'banner' },
        { blockType: 'newsletter', variant: 'inline' },
        { blockType: 'footer', variant: 'mega' },
      ],
    },
    {
      name: 'Products', slug: '/products',
      blocks: [
        { blockType: 'navigation' },
        { blockType: 'hero', variant: 'minimal' },
        { blockType: 'products-grid', variant: productsVariant, count: 12 },
        { blockType: 'product-quick-view' },
        { blockType: 'footer', variant: 'mega' },
      ],
    },
    {
      name: 'About', slug: '/about',
      blocks: [
        { blockType: 'navigation' },
        { blockType: 'hero', variant: 'split-left' },
        { blockType: 'content', variant: 'two-column' },
        { blockType: 'stats', variant: 'counters' },
        { blockType: 'footer', variant: 'mega' },
      ],
    },
    {
      name: 'Blog', slug: '/blog',
      blocks: [
        { blockType: 'navigation' },
        { blockType: 'hero', variant: 'minimal' },
        { blockType: 'blog-list', variant: 'grid', count: 6 },
        { blockType: 'newsletter', variant: 'inline' },
        { blockType: 'footer', variant: 'mega' },
      ],
    },
    {
      name: 'Contact', slug: '/contact',
      blocks: [
        { blockType: 'navigation' },
        { blockType: 'contact-form', variant: 'simple' },
        { blockType: 'faq', variant: 'accordion' },
        { blockType: 'footer', variant: 'mega' },
      ],
    },
  ]
}

/**
 * Dedicated storefront inventory for US-F07-04's canonical sports-shop query.
 * These are new managed names so the idempotent seed job creates them in
 * environments that already contain the original 56 blueprint templates.
 */
export const SPORTS_RETAIL_PRESETS: TemplatePreset[] = [
  {
    id: 'ecommerce-activewear-performance',
    name: 'Activewear Performance',
    category: 'ecommerce',
    businessIndex: 5,
    personality: 'energetic',
    themePreset: ECOMMERCE_PRESETS[2]!,
    tags: ['sports', 'fitness', 'activewear', 'running'],
    description: 'A high-energy sports retail template for activewear, footwear, and performance apparel stores.',
    pages: sportsRetailPages('split-left', 'featured'),
  },
  {
    id: 'ecommerce-sports-equipment-pro',
    name: 'Sports Equipment Pro',
    category: 'ecommerce',
    businessIndex: 6,
    personality: 'bold',
    themePreset: ECOMMERCE_PRESETS[6]!,
    tags: ['sports', 'fitness', 'equipment', 'gym'],
    description: 'A bold sports-commerce template for training equipment, team gear, and fitness accessories.',
    pages: sportsRetailPages('split-right', 'filterable'),
  },
]
