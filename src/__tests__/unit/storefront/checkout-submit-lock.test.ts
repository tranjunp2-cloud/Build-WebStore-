import { describe, expect, it } from 'vitest'
import { acquireSubmitLock } from '@/app/sites/[slug]/checkout/CheckoutClient'

describe('checkout submit lock', () => {
    it('allows only one checkout request while refresh is pending', async () => {
        const lock = { current: false }
        let resolveRefresh!: () => void
        const refresh = new Promise<void>(resolve => { resolveRefresh = resolve })
        let checkoutRequests = 0

        const submit = async () => {
            if (!acquireSubmitLock(lock)) return
            await refresh
            checkoutRequests += 1
            lock.current = false
        }

        const firstSubmit = submit()
        const secondSubmit = submit()
        resolveRefresh()
        await Promise.all([firstSubmit, secondSubmit])

        expect(checkoutRequests).toBe(1)
    })
})
