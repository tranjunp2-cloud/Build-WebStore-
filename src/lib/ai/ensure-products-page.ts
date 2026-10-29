/**
 * Shop plumbing for generated sites (#2103 A3).
 *
 * The storefront has no /products route of its own, and fnb / beauty / service recipes have no
 * commerce block on the home page — so the shop's products were created but never shown. These
 * helpers add (a) a CMS page at /products holding a products grid (which also gives the site a
 * nav entry and switches the floating cart on) and (b) a featured-products block on the home page.
 *
 * Pure functions over page definitions; the caller decides when products will exist.
 */

import { resolveBlockContent } from '@/lib/ai/add-section-content'

type Block = { blockType?: unknown; [key: string]: unknown }
export type ShopPageShape = {
  title: string
  slug: string
  isHomepage: boolean
  layout: unknown[]
  seo: { title: string; description: string }
}

/** Locales the shop plumbing has copy for; every other generation locale reads the English copy. */
export type ShopContentLocale = 'en' | 'ms' | 'vi'
type Opts = { locale: ShopContentLocale; brandName: string }

const COMMERCE_BLOCKS = new Set(['products-grid', 'products-featured', 'product-quick-view'])

const PAGE_TITLE: Record<ShopContentLocale, string> = { en: 'Products', ms: 'Produk', vi: 'Sản phẩm' }

/** en / ms come from the add-section library; vi is written here (the library has no vi). */
const VI_COPY = { headline: 'Sản phẩm của chúng tôi', subheadline: 'Khám phá bộ sưu tập được chọn lọc của chúng tôi.' }

/** The generation locale as the shop plumbing knows it: 'vi' / 'ms', anything else English. */
export function shopContentLocale(generationLocale: string | undefined): ShopContentLocale {
  const lang = (generationLocale ?? 'en').split('-')[0]?.toLowerCase()
  return lang === 'ms' || lang === 'vi' ? lang : 'en'
}

/** Headline + subheadline of a products section in the site's language. */
export function productsCopy(opts: Opts): { headline: string; subheadline: string } {
  if (opts.locale === 'vi') return VI_COPY
  const content = resolveBlockContent('products', opts.locale, opts.brandName).content as {
    headline?: unknown
    subheadline?: unknown
  }
  return {
    headline: typeof content.headline === 'string' && content.headline.trim() ? content.headline : PAGE_TITLE[opts.locale],
    subheadline: typeof content.subheadline === 'string' ? content.subheadline : '',
  }
}

function normSlug(slug: string): string {
  return `/${String(slug).replace(/^\/+|\/+$/g, '')}`.toLowerCase()
}

/** Adds a /products page (products-grid) right after the home page unless one exists. Mutates `pages`. */
export function ensureProductsPage(pages: ShopPageShape[], opts: Opts): boolean {
  if (pages.some((p) => normSlug(p.slug) === '/products')) return false
  const { headline, subheadline } = productsCopy(opts)
  const title = PAGE_TITLE[opts.locale]
  pages.splice(Math.min(1, pages.length), 0, {
    title,
    slug: '/products',
    isHomepage: false,
    // Navigation + footer are injected for every page by ensureNavigationBlocks.
    layout: [{ blockType: 'products-grid', headline, subheadline, showCategoryFilter: true }],
    seo: { title: `${title} — ${opts.brandName}`, description: subheadline || `${title} — ${opts.brandName}` },
  })
  return true
}

/**
 * Puts a featured-products block on the home page when it has no commerce block, after the
 * first content section so the hero stays on top. Mutates the home layout.
 */
export function ensureHomeCommerceBlock(pages: ShopPageShape[], opts: Opts): boolean {
  const home = pages.find((p) => p.isHomepage) ?? pages[0]
  if (!home || !Array.isArray(home.layout)) return false
  const layout = home.layout as Block[]
  if (layout.some((b) => typeof b?.blockType === 'string' && COMMERCE_BLOCKS.has(b.blockType))) return false

  const { headline, subheadline } = productsCopy(opts)
  const heroIdx = layout.findIndex((b) => b?.blockType === 'hero')
  const footerIdx = layout.findIndex((b) => b?.blockType === 'footer')
  const limit = footerIdx >= 0 ? footerIdx : layout.length
  const at = Math.min(heroIdx >= 0 ? heroIdx + 2 : 2, limit)
  layout.splice(at, 0, {
    blockType: 'products-featured',
    variant: 'hero-product',
    headline,
    ...(subheadline ? { subheadline } : {}),
  })
  return true
}
