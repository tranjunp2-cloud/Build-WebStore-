import { describe, it, expect } from 'vitest'
import { resolveApiError, type SubscriptionErrorStrings } from '@/lib/ui/resolve-api-error'

const t: SubscriptionErrorStrings = {
    featureLocked: 'Ciri ini tidak tersedia dalam pelan semasa anda.',
    subscriptionExpired: 'Langganan anda telah tamat tempoh atau tidak dijumpai. Sila perbaharui untuk meneruskan.',
    genericLocked: 'Tindakan ini tidak tersedia dalam pelan semasa anda.',
}

describe('resolveApiError', () => {
    it('TC-SUB-080: returns featureLocked for FEATURE_LOCKED code (Pattern A)', () => {
        const data = { error: { code: 'FEATURE_LOCKED', message: 'This feature is not available on your current plan' } }
        expect(resolveApiError(data, 'fallback', t)).toBe(t.featureLocked)
    })

    it('TC-SUB-081: returns subscriptionExpired for SUBSCRIPTION_EXPIRED code (Pattern A)', () => {
        const data = { error: { code: 'SUBSCRIPTION_EXPIRED', message: 'Subscription expired or not found' } }
        expect(resolveApiError(data, 'fallback', t)).toBe(t.subscriptionExpired)
    })

    it('TC-SUB-082: returns genericLocked for plain "current plan" string (Pattern B)', () => {
        const data = { error: 'Content management is not available on your current plan.' }
        expect(resolveApiError(data, 'fallback', t)).toBe(t.genericLocked)
    })

    it('TC-SUB-083: returns genericLocked for "Feature not available on your current plan" (domains Pattern B)', () => {
        const data = { error: 'Feature not available on your current plan' }
        expect(resolveApiError(data, 'fallback', t)).toBe(t.genericLocked)
    })

    it('TC-SUB-084: returns genericLocked for product/payments/email-templates "current plan" strings', () => {
        const cases = [
            'Product management is not available on your current plan.',
            'Payment integration is not available on your current plan.',
            'Email template configuration is not available on your current plan.',
        ]
        for (const msg of cases) {
            expect(resolveApiError({ error: msg }, 'fallback', t)).toBe(t.genericLocked)
        }
    })

    it('TC-SUB-085: returns subscriptionExpired for bare "Subscription expired" string (domains action)', () => {
        const data = { success: false, error: 'Subscription expired' }
        expect(resolveApiError(data, 'fallback', t)).toBe(t.subscriptionExpired)
    })

    it('TC-SUB-086: passes through non-subscription server message unchanged', () => {
        const data = { error: { code: undefined, message: 'Slug already in use' } }
        expect(resolveApiError(data, 'fallback', t)).toBe('Slug already in use')
    })

    it('TC-SUB-087: passes through a raw non-subscription string unchanged', () => {
        expect(resolveApiError('Some unrelated server error', 'fallback', t)).toBe('Some unrelated server error')
    })

    it('TC-SUB-088: returns fallback when data is null', () => {
        expect(resolveApiError(null, 'my fallback', t)).toBe('my fallback')
    })

    it('TC-SUB-089: returns fallback when data is undefined', () => {
        expect(resolveApiError(undefined, 'my fallback', t)).toBe('my fallback')
    })

    it('TC-SUB-090: returns fallback when error object has no code and no message', () => {
        expect(resolveApiError({ error: {} }, 'my fallback', t)).toBe('my fallback')
    })

    it('TC-SUB-091: does not misclassify UNAUTHORIZED as subscription error', () => {
        const data = { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }
        expect(resolveApiError(data, 'fallback', t)).toBe('Unauthorized')
    })

    it('TC-SUB-092: handles plain string input (thrown Error.message from product actions)', () => {
        expect(resolveApiError('Product management is not available on your current plan.', 'fallback', t)).toBe(t.genericLocked)
    })
})
