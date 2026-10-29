// @vitest-environment jsdom
/**
 * TC-AIAUD-075 — Featured Products keeps showing the store's newest products (it takes no chosen ones: chosen
 * products are a Products Grid in fixed mode). TC-AIAUD-076 — a product with nothing in stock still shows, with
 * a "Sold out" badge, in Featured Products (hero and carousel) and on a Products Grid card.
 * Real: the block components. Faked: the storefront products fetch.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { I18nProvider } from '@/i18n'
import { ProductsFeaturedBlock } from '@/blocks/products-featured'
import { ProductCard } from '@/blocks/products-grid/ProductCard'

const api = vi.hoisted(() => ({ docs: [] as Array<Record<string, unknown>>, urls: [] as string[] }))

beforeEach(() => {
    api.docs = []
    api.urls = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        api.urls.push(url)
        return { ok: true, json: async () => ({ docs: api.docs }) }
    }))
})
afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

const doc = (id: number, name: string, inventory: number) => ({ id, name, slug: `p-${id}`, price: 10 * id, currency: 'MYR', inventory, images: [{ image: { url: `https://cdn.test/${id}.jpg` } }] })
const block = (extra: Record<string, unknown> = {}) => ({ blockType: 'products-featured', variant: 'hero-product', headline: 'Featured', ...extra }) as never
const site = { id: 5, name: 'Kedai', siteType: 'ecommerce' } as never
const theme = { colorMode: 'light' } as never

describe('Featured Products shows the newest [TC-AIAUD-075]', () => {
    it('TC-AIAUD-075: asks for the newest products (hero: 2, newest first) and never for a fixed selection', async () => {
        api.docs = [doc(9, 'Newest', 5), doc(8, 'Second', 5)]

        const { container } = render(<ProductsFeaturedBlock block={block({ productIds: ['1', '2', '3'] })} theme={theme} site={site} />, { wrapper: I18nProvider })

        await waitFor(() => expect(container.textContent).toContain('Newest'))
        const url = new URL(api.urls[0]!, 'https://x.test')
        expect(url.searchParams.get('sort')).toBe('-createdAt')
        expect(url.searchParams.get('limit')).toBe('2')
        expect(url.searchParams.has('selectionMode')).toBe(false)
        expect(url.searchParams.has('productId')).toBe(false)
    })

    it('TC-AIAUD-075: the carousel asks for the 6 newest', async () => {
        api.docs = [doc(9, 'Newest', 5)]

        render(<ProductsFeaturedBlock block={block({ variant: 'carousel' })} theme={theme} site={site} />, { wrapper: I18nProvider })

        await waitFor(() => expect(api.urls).toHaveLength(1))
        expect(new URL(api.urls[0]!, 'https://x.test').searchParams.get('limit')).toBe('6')
    })
})

describe('Sold out badge [TC-AIAUD-076]', () => {
    it('TC-AIAUD-076: a hero product with nothing in stock still shows, with a Sold out badge', async () => {
        api.docs = [doc(3, 'Songket', 0)]

        const { container } = render(<ProductsFeaturedBlock block={block()} theme={theme} site={site} />, { wrapper: I18nProvider })

        await waitFor(() => expect(container.textContent).toContain('Songket'))
        expect(container.querySelector('[data-testid="sold-out-badge"]')?.textContent).toBe('Sold out')
    })

    it('TC-AIAUD-076: a product in stock has none', async () => {
        api.docs = [doc(3, 'Songket', 4)]

        const { container } = render(<ProductsFeaturedBlock block={block()} theme={theme} site={site} />, { wrapper: I18nProvider })

        await waitFor(() => expect(container.textContent).toContain('Songket'))
        expect(container.querySelector('[data-testid="sold-out-badge"]')).toBeNull()
    })

    it('TC-AIAUD-076: the carousel marks only the sold out product', async () => {
        api.docs = [doc(3, 'Songket', 0), doc(1, 'Batik scarf', 2)]

        const { container } = render(<ProductsFeaturedBlock block={block({ variant: 'carousel' })} theme={theme} site={site} />, { wrapper: I18nProvider })

        await waitFor(() => expect(container.textContent).toContain('Batik scarf'))
        expect(container.querySelectorAll('[data-testid="sold-out-badge"]')).toHaveLength(1)
    })

    it('TC-AIAUD-076: sample slides (no product on sale) never say sold out', async () => {
        const { container } = render(<ProductsFeaturedBlock block={block({ variant: 'carousel' })} theme={theme} site={site} />, { wrapper: I18nProvider })

        await waitFor(() => expect(container.querySelectorAll('img').length).toBeGreaterThan(0))
        expect(container.querySelector('[data-testid="sold-out-badge"]')).toBeNull()
    })

    it('TC-AIAUD-076: a Products Grid card shows the badge when nothing is left, none when there is stock', () => {
        const item = (inventory: number) => ({ id: '1', slug: 'batik', name: 'Batik scarf', price: 'RM 10.00', priceRaw: 10, currency: 'MYR', inventory, image: null })
        const sold = render(<ProductCard product={item(0)} variant="grid-3" theme={theme} siteBasePath="/sites/demo" />, { wrapper: I18nProvider })
        expect(sold.container.querySelector('[data-testid="sold-out-badge"]')?.textContent).toBe('Sold out')
        cleanup()

        const stocked = render(<ProductCard product={item(3)} variant="grid-3" theme={theme} siteBasePath="/sites/demo" />, { wrapper: I18nProvider })
        expect(stocked.container.querySelector('[data-testid="sold-out-badge"]')).toBeNull()
    })
})

describe('Sold out badge follows the shop language [TC-AIAUD-211]', () => {
    const badge = (container: HTMLElement) => container.querySelector('[data-testid="sold-out-badge"]')?.textContent

    it.each([
        ['en', 'Sold out'],
        ['ms', 'Habis dijual'],
        ['vi', 'Hết hàng'],
        ['vi-VN', 'Hết hàng'],
        ['ja', 'Sold out'],
    ])('TC-AIAUD-211: a %s shop shows "%s" on a Featured Products hero and a grid card', async (generationLocale, label) => {
        const shop = { ...(site as object), generationLocale } as never
        api.docs = [doc(3, 'Songket', 0)]
        const hero = render(<ProductsFeaturedBlock block={block()} theme={theme} site={shop} />, { wrapper: I18nProvider })
        await waitFor(() => expect(hero.container.textContent).toContain('Songket'))
        expect(badge(hero.container)).toBe(label)
        cleanup()

        const item = { id: '1', slug: 'batik', name: 'Batik scarf', price: 'RM 10.00', priceRaw: 10, currency: 'MYR', inventory: 0, image: null }
        const card = render(<ProductCard product={item} variant="grid-3" theme={theme} siteBasePath="/sites/demo" site={shop} />, { wrapper: I18nProvider })
        expect(badge(card.container)).toBe(label)
    })

    it('TC-AIAUD-211: the site locale is used when there is no generationLocale', async () => {
        api.docs = [doc(3, 'Songket', 0)]
        const { container } = render(<ProductsFeaturedBlock block={block()} theme={theme} site={{ ...(site as object), locale: 'ms' } as never} />, { wrapper: I18nProvider })
        await waitFor(() => expect(container.textContent).toContain('Songket'))
        expect(badge(container)).toBe('Habis dijual')
    })
})

