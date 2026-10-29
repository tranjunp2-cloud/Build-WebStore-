// @vitest-environment jsdom
/**
 * TC-AIWB-48 — Featured Products shows its own pictures (`images`) while no product is on sale, instead of the
 * industry samples; a row without a picture stays a sample; products on sale keep their own photos, and a product
 * without a photo shows the section's picture. Own slides are editable in the editor (data-section-picture).
 * Real: the block component. Faked: the storefront products fetch.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { ProductsFeaturedBlock } from '@/blocks/products-featured'
import { I18nProvider } from '@/i18n'

const products = vi.hoisted(() => ({ docs: [] as Array<Record<string, unknown>> }))

beforeEach(() => {
    products.docs = []
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ docs: products.docs }) })))
})
afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
})

const block = (extra: Record<string, unknown> = {}) => ({ blockType: 'products-featured', variant: 'carousel', headline: 'Bộ sưu tập nổi bật', productIds: [], ...extra }) as never
const site = { id: 1, name: 'Kedai', siteType: 'ecommerce' } as never

describe('Featured Products own pictures [TC-AIWB-48]', () => {
    it('no product on sale: its own pictures with their captions, the rest of the rows samples', async () => {
        const { container } = render(<ProductsFeaturedBlock block={block({ images: [{ image: { id: 43, url: 'https://media.test/own-1.jpg' }, caption: 'Hijab' }, { image: null }] })} theme={{} as never} site={site} />, { wrapper: I18nProvider })

        await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2))
        const imgs = [...container.querySelectorAll('img')]
        expect(imgs[0]!.getAttribute('src')).toBe('https://media.test/own-1.jpg')
        expect(imgs[1]!.getAttribute('src')).not.toContain('media.test')
        expect(imgs.map((img) => img.getAttribute('data-image-index'))).toEqual(['0', '1'])
        expect(imgs.every((img) => img.hasAttribute('data-section-picture'))).toBe(true)
        expect(container.textContent).toContain('Hijab')
    })

    it('without own pictures: 6 sample slides', async () => {
        const { container } = render(<ProductsFeaturedBlock block={block()} theme={{} as never} site={site} />, { wrapper: I18nProvider })

        await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(6))
    })

    it('products on sale: their photos; a product without a photo shows the section picture; not editable on the page', async () => {
        products.docs = [
            { id: 'prod_a', name: 'Abaya', price: 10, images: [{ image: { url: 'https://cdn.test/abaya.jpg' } }] },
            { id: 'prod_b', name: 'Tudung', price: 12, images: [] },
        ]
        const { container } = render(<ProductsFeaturedBlock block={block({ images: [{ image: { id: 43, url: 'https://media.test/own-1.jpg' } }] })} theme={{} as never} site={site} />, { wrapper: I18nProvider })

        await waitFor(() => expect(container.querySelectorAll('img')).toHaveLength(2))
        const imgs = [...container.querySelectorAll('img')]
        expect(imgs.map((img) => img.getAttribute('src'))).toEqual(['https://cdn.test/abaya.jpg', 'https://media.test/own-1.jpg'])
        expect(imgs.some((img) => img.hasAttribute('data-section-picture'))).toBe(false)
    })
})
