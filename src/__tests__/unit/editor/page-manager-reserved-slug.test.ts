import { describe, it, expect } from 'vitest'
import { validateNewPageTitle } from '@/components/editor/page-manager/page-manager-helpers'
import { isReservedPageSlug } from '@/lib/utils/reserved-page-slugs'

describe('reserved page slugs [TC-F05-02-28]', () => {
    it.each(['checkout', '/checkout', '/Checkout/', '/orders', '/404'])('treats %s as reserved', (slug) => {
        expect(isReservedPageSlug(slug)).toBe(true)
    })

    it.each(['/products', '/blog', '/order', '/checkout-info', '/my-orders'])('allows %s', (slug) => {
        expect(isReservedPageSlug(slug)).toBe(false)
    })

    it('add-page form flags a title that slugifies to checkout', () => {
        expect(validateNewPageTitle('Checkout', [], 'en').error).toBe('reserved')
        expect(validateNewPageTitle('  CHECKOUT ', [], 'en').error).toBe('reserved')
    })

    it('add-page form flags a title that slugifies to orders', () => {
        expect(validateNewPageTitle('Orders', [], 'en').error).toBe('reserved')
    })

    it('add-page form still accepts normal titles', () => {
        expect(validateNewPageTitle('Contact', [], 'en').error).toBeNull()
        expect(validateNewPageTitle('Checkout info', [], 'en').error).toBeNull()
        expect(validateNewPageTitle('Order status', [], 'en').error).toBeNull()
    })
})
