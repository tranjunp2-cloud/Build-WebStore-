/**
 * TC-AIAUD-035 — a generated shop shows its products: /products page + featured block on Home (#2103 A3).
 */
import { describe, it, expect } from 'vitest'
import { ensureHomeCommerceBlock, ensureProductsPage, shopContentLocale, type ShopPageShape } from '@/lib/ai/ensure-products-page'
import { ensureNavigationBlocks, type PageShape } from '@/lib/ai/ensure-navigation'
import { getRecipesForCategory } from '@/lib/ai/category-recipes'

const page = (slug: string, layout: unknown[] = [], isHomepage = slug === '/'): ShopPageShape => ({
  title: slug === '/' ? 'Home' : slug.slice(1),
  slug,
  isHomepage,
  layout,
  seo: { title: '', description: '' },
})

describe('ensureProductsPage (TC-AIAUD-035)', () => {
  it('adds a /products page with a products grid right after Home', () => {
    const pages = [page('/'), page('/about'), page('/contact')]
    expect(ensureProductsPage(pages, { locale: 'en', brandName: 'Dapur' })).toBe(true)
    expect(pages.map((p) => p.slug)).toEqual(['/', '/products', '/about', '/contact'])
    const created = pages[1]!
    expect(created.title).toBe('Products')
    expect((created.layout[0] as Record<string, unknown>).blockType).toBe('products-grid')
    expect((created.layout[0] as Record<string, unknown>).showCategoryFilter).toBe(true)
  })

  it('is idempotent, localizes the title, and does not duplicate an existing /products page', () => {
    const pages = [page('/'), page('/products/')]
    expect(ensureProductsPage(pages, { locale: 'ms', brandName: 'Dapur' })).toBe(false)
    const fresh = [page('/')]
    ensureProductsPage(fresh, { locale: 'ms', brandName: 'Dapur' })
    expect(fresh[1]!.title).toBe('Produk')
  })

  it('the new page gets nav + footer and a menu entry through the standard navigation pass', () => {
    const pages = [page('/', [{ blockType: 'hero' }]), page('/contact', [{ blockType: 'contact' }])]
    ensureProductsPage(pages, { locale: 'en', brandName: 'Dapur' })
    const links = pages.map((p) => ({ label: p.title, url: p.slug }))
    const withNav = ensureNavigationBlocks(pages as unknown as PageShape[], 'Dapur', links)
    const productsPage = withNav.find((p) => p.slug === '/products')!
    const nav = productsPage.layout.find((b) => b.blockType === 'navigation') as { links: Array<{ url: string }> }
    expect(nav.links.map((l) => l.url)).toContain('/products')
    expect(productsPage.layout.some((b) => b.blockType === 'footer')).toBe(true)
  })
})

describe('ensureHomeCommerceBlock (TC-AIAUD-035)', () => {
  it('inserts products-featured after the first content section and before the footer', () => {
    const home = page('/', [{ blockType: 'navigation' }, { blockType: 'hero' }, { blockType: 'features' }, { blockType: 'cta' }, { blockType: 'footer' }])
    expect(ensureHomeCommerceBlock([home], { locale: 'en', brandName: 'Dapur' })).toBe(true)
    expect(home.layout.map((b) => (b as { blockType: string }).blockType)).toEqual([
      'navigation', 'hero', 'features', 'products-featured', 'cta', 'footer',
    ])
  })

  it('leaves a home that already has a commerce block untouched', () => {
    const home = page('/', [{ blockType: 'hero' }, { blockType: 'products-grid' }, { blockType: 'footer' }])
    expect(ensureHomeCommerceBlock([home], { locale: 'en', brandName: 'Dapur' })).toBe(false)
    expect(home.layout).toHaveLength(3)
  })

  it('fnb and beauty home recipes list a products-featured section', () => {
    for (const category of ['fnb', 'beauty']) {
      for (const recipe of getRecipesForCategory(category)) expect(recipe.blocks).toContain('products-featured')
    }
  })
})

describe('Vietnamese shop copy (TC-AIAUD-210, #2103 L3)', () => {
  it('shopContentLocale keeps vi and ms (also region tags) and reads everything else as English', () => {
    expect(shopContentLocale('vi')).toBe('vi')
    expect(shopContentLocale('vi-VN')).toBe('vi')
    expect(shopContentLocale('ms')).toBe('ms')
    expect(shopContentLocale('ja')).toBe('en')
    expect(shopContentLocale(undefined)).toBe('en')
  })

  it('a vi site gets a Vietnamese Products page title and headline, and a Vietnamese Home products block', () => {
    const pages = [page('/', [{ blockType: 'hero' }, { blockType: 'features' }, { blockType: 'footer' }])]
    ensureProductsPage(pages, { locale: 'vi', brandName: 'Bếp Nhà' })
    ensureHomeCommerceBlock(pages, { locale: 'vi', brandName: 'Bếp Nhà' })

    const products = pages.find((p) => p.slug === '/products')!
    expect(products.title).toBe('Sản phẩm')
    const grid = products.layout[0] as Record<string, unknown>
    expect(grid.headline).toBe('Sản phẩm của chúng tôi')
    expect(grid.subheadline).toBe('Khám phá bộ sưu tập được chọn lọc của chúng tôi.')
    expect(JSON.stringify(products)).not.toMatch(/Our Products|Explore our/)
    const featured = (pages[0]!.layout as Array<Record<string, unknown>>).find((b) => b.blockType === 'products-featured')!
    expect(featured.headline).toBe('Sản phẩm của chúng tôi')
  })
})
