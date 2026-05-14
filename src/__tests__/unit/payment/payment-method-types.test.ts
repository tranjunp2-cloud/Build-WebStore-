import { describe, it, expect } from 'vitest'
import { buildPaymentMethodTypes } from '@/lib/payment/method-builder'

// ─── TC-F13.53..56: buildPaymentMethodTypes — tenant master gate ─────────────

describe('buildPaymentMethodTypes [TC-F13.53..56]', () => {

    // TC-F13.53: both ON → ['card', 'fpx']
    it('[TC-F13.53] returns [card, fpx] when both flags ON (flat shape)', () => {
        // Arrange
        const tenant = { payment_card: true, payment_fpx: true }

        // Act
        const result = buildPaymentMethodTypes(tenant)

        // Assert
        expect(result).toEqual(['card', 'fpx'])
    })

    it('[TC-F13.53] returns [card, fpx] when both flags ON (nested payments shape)', () => {
        // Arrange — Payload group fields surface as nested object at runtime
        const tenant = { payments: { payment_card: true, payment_fpx: true } }

        // Act
        const result = buildPaymentMethodTypes(tenant)

        // Assert
        expect(result).toEqual(['card', 'fpx'])
    })

    // TC-F13.54: card only
    it('[TC-F13.54] returns [card] when only card ON', () => {
        // Arrange
        const tenant = { payment_card: true, payment_fpx: false }

        // Act
        const result = buildPaymentMethodTypes(tenant)

        // Assert
        expect(result).toEqual(['card'])
        expect(result).not.toContain('fpx')
    })

    // TC-F13.55: fpx only
    it('[TC-F13.55] returns [fpx] when only FPX ON', () => {
        // Arrange
        const tenant = { payment_card: false, payment_fpx: true }

        // Act
        const result = buildPaymentMethodTypes(tenant)

        // Assert
        expect(result).toEqual(['fpx'])
        expect(result).not.toContain('card')
    })

    // TC-F13.56: both OFF → [] — caller MUST reject 422 NO_PAYMENT_METHODS
    it('[TC-F13.56] returns [] when both OFF — caller must reject 422 NO_PAYMENT_METHODS', () => {
        // Arrange
        const tenant = { payment_card: false, payment_fpx: false }

        // Act
        const result = buildPaymentMethodTypes(tenant)

        // Assert
        expect(result).toEqual([])
        expect(result.length).toBe(0)
    })

    it('[TC-F13.56] returns [] when flags missing (undefined) — no fallback to hardcoded methods', () => {
        // Arrange
        const tenant = {}

        // Act
        const result = buildPaymentMethodTypes(tenant)

        // Assert
        expect(result).toEqual([])
    })

    // Stable order (card before fpx for Stripe render consistency)
    it('card always precedes fpx in output array', () => {
        const result = buildPaymentMethodTypes({ payment_card: true, payment_fpx: true })
        expect(result.indexOf('card')).toBeLessThan(result.indexOf('fpx'))
    })
})
