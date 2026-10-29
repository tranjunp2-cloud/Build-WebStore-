import { describe, expect, it } from 'vitest'
import { dockShownOn, quietOn } from '@/components/agent/agent-dock-routes'

// TC-AIAUD-077 — the dashboard mascot raises no card over a form screen (product editor, settings, a discount, a
// customer): the Save bar sits there. List screens and the rest of the dashboard keep it.

describe('quietOn — screens where the mascot raises nothing [TC-AIAUD-077]', () => {
    it.each([
        '/products/new',
        '/products/123',
        '/products/123/',
        '/settings',
        '/settings/payments',
        '/settings/shipping',
        '/settings/profile',
        '/discounts/new',
        '/discounts/42',
        '/customers/9',
    ])('TC-AIAUD-077: %s is quiet', (path) => {
        expect(quietOn(path)).toBe(true)
    })

    it.each([
        '/',
        '/dashboard',
        '/products',
        '/products/categories',
        '/discounts',
        '/discounts/usage-history',
        '/customers',
        '/orders',
        '/orders/55',
        '/blog',
        '/settingsx',
    ])('TC-AIAUD-077: %s is not quiet', (path) => {
        expect(quietOn(path)).toBe(false)
    })

    it('TC-AIAUD-077: the mascot itself stays on a quiet screen (only the bubbles go)', () => {
        expect(dockShownOn('/products/new')).toBe(true)
    })
})
