/**
 * getRates() tests — F36 Phase 02 (GH-1333)
 * Covers: cheapest-pick, COD filtering, allowlist intersection, flat fallback.
 * Source of truth for rate selection logic at checkout.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRates } from '@/lib/shipping/get-rates'
import type { RateOption } from '@/lib/shipping/easyparcel/types'

// ─── Top-level mocks ────────────────────────────────────────────────────────

vi.mock('@/lib/shipping/easyparcel/client', () => ({
    quotations: vi.fn(),
}))

vi.mock('@/lib/shipping/calculate-fee', () => ({
    getShippingRate: vi.fn(() => 800), // West default
}))

vi.mock('@/lib/shipping/easyparcel/normalize', () => ({
    mapSubdivisionCode: vi.fn((state) => state),
    aggregateWeightKg: vi.fn((grams) => grams / 1000),
}))

import { quotations } from '@/lib/shipping/easyparcel/client'

// ─── Test fixtures ────────────────────────────────────────────────────────

const flatConfig = { enabled: true, westRate: 800, eastRate: 1500 }

const mockQuotationsSuccess = (rates: Omit<RateOption, 'degraded'>[]) => {
    const quotations_data = rates.map((r) => ({
        courier: {
            courier_id: r.courier,
            service_id: r.serviceId,
            courier_name: r.courierName,
            service_name: r.serviceName,
            delivery_duration: r.estDelivery,
        },
        pricing: { total_amount: (r.priceSen / 100).toString() },
        features: r.codAvailable
            ? [{ cod: { available: true, max_cod_amount: (r.codMaxSen ? r.codMaxSen / 100 : '1000').toString() } }]
            : [],
    }))
    ;(quotations as any).mockResolvedValue({
        data: [
            {
                status: 'success',
                quotations: quotations_data,
            },
        ],
    })
}

const baseParams = {
    weightGrams: 500,
    destPostcode: '50480',
    destState: 'Selangor',
    senderState: 'Selangor',
    destCountry: 'MY',
    senderPostcode: '47810',
    subtotalSen: 5000,
}

// ─── Test cases ────────────────────────────────────────────────────────

describe('getRates', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // Flat-rate path (no token)
    describe('flat-rate fallback', () => {
        it('returns flat rate when epToken is null', async () => {
            const result = await getRates(baseParams, null, flatConfig)
            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flat')
            expect(result.degraded).toBe(false)
        })
    })

    // Happy path: allowlist intersection + cheapest
    describe('[TC-F14.131] allowlist intersection + pick cheapest', () => {
        it('returns cheaper only when allowlist matches route', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 5000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
            ])

            const result = await getRates(
                { ...baseParams, allowedCouriers: ['jnt', 'flash'] },
                'token123',
                flatConfig,
            )

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flash')
            expect(result.rates[0].priceSen).toBe(4000)
            expect(result.degraded).toBe(false)
        })
    })

    // Allowlist ∩ route = empty → flat fallback
    describe('[TC-F14.132] allowlist ∩ route empty → flat fallback', () => {
        it('returns flat when allowlist contains no route couriers', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 5000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
            ])

            const result = await getRates(
                { ...baseParams, allowedCouriers: ['dhl', 'pos'] }, // not in quotations
                'token123',
                flatConfig,
            )

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flat')
            expect(result.degraded).toBe(true)
        })
    })

    // Empty/absent allowlist → cheapest of ALL
    describe('[TC-F14.133] empty/absent allowlist → cheapest of ALL', () => {
        it('returns cheapest when allowlist is undefined', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 5000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
            ])

            const result = await getRates(
                { ...baseParams, allowedCouriers: undefined },
                'token123',
                flatConfig,
            )

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flash')
            expect(result.rates[0].priceSen).toBe(4000)
            expect(result.degraded).toBe(false)
        })

        it('returns cheapest when allowlist is empty array', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 5000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
            ])

            const result = await getRates(
                { ...baseParams, allowedCouriers: [] },
                'token123',
                flatConfig,
            )

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flash')
            expect(result.degraded).toBe(false)
        })
    })

    // COD: restrict to cod-capable, pick cheapest
    describe('[TC-F14.134] COD order restricts to COD-capable', () => {
        it('returns COD-capable courier even if more expensive', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 5000, codAvailable: true, codMaxSen: 100000, estDelivery: '3–5 days' },
            ])

            const result = await getRates(
                { ...baseParams, allowedCouriers: ['jnt', 'flash'], codAmountSen: 1000 },
                'token123',
                flatConfig,
            )

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flash') // only COD option
            expect(result.rates[0].codAvailable).toBe(true)
            expect(result.degraded).toBe(false)
        })
    })

    // COD: none COD-capable → flat fallback
    describe('[TC-F14.135] COD order, no COD-capable courier → flat fallback', () => {
        it('returns flat when no courier supports COD', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 5000, codAvailable: false, estDelivery: '3–5 days' },
            ])

            const result = await getRates(
                { ...baseParams, allowedCouriers: ['jnt', 'flash'], codAmountSen: 1000 },
                'token123',
                flatConfig,
            )

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flat')
            expect(result.degraded).toBe(true)
        })
    })

    // Non-COD: ignores codAvailable
    describe('[TC-F14.136] non-COD order ignores codAvailable flag', () => {
        it('picks cheapest regardless of COD flag', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 5000, codAvailable: true, codMaxSen: 100000, estDelivery: '3–5 days' },
            ])

            const result = await getRates(
                { ...baseParams, allowedCouriers: ['jnt', 'flash'], codAmountSen: 0 },
                'token123',
                flatConfig,
            )

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('jnt') // cheaper, COD not checked
            expect(result.degraded).toBe(false)
        })
    })

    // 'flat' sentinel filter
    describe('[TC-F14.137] flat sentinel excluded from EP candidates', () => {
        it('filters flat from allowlist, treats as no allowlist → picks cheapest of all', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 5000, codAvailable: false, estDelivery: '3–5 days' },
            ])

            const result = await getRates(
                { ...baseParams, allowedCouriers: ['flat'] }, // only flat allowed (filtered out → empty)
                'token123',
                flatConfig,
            )

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('jnt') // after filtering 'flat', no allowlist restriction, pick cheapest
            expect(result.degraded).toBe(false)
        })
    })

    // EP API error → flat fallback
    describe('EP API error handling', () => {
        it('returns flat when quotations API call fails', async () => {
            ;(quotations as any).mockRejectedValue(new Error('API timeout'))

            const result = await getRates(baseParams, 'token123', flatConfig)

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flat')
            expect(result.degraded).toBe(true)
        })

        it('returns flat when quotation status is error', async () => {
            ;(quotations as any).mockResolvedValue({
                data: [{ status: 'error', message: 'Invalid postcode' }],
            })

            const result = await getRates(baseParams, 'token123', flatConfig)

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flat')
            expect(result.degraded).toBe(true)
        })

        it('returns flat when quotations array is empty', async () => {
            ;(quotations as any).mockResolvedValue({
                data: [{ status: 'success', quotations: [] }],
            })

            const result = await getRates(baseParams, 'token123', flatConfig)

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flat')
            expect(result.degraded).toBe(true)
        })
    })

    // Edge: single option
    describe('edge cases', () => {
        it('works correctly with single allowlisted courier', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 5000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
            ])

            const result = await getRates(
                { ...baseParams, allowedCouriers: ['jnt'] },
                'token123',
                flatConfig,
            )

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('jnt')
            expect(result.degraded).toBe(false)
        })

        it('preserves codMaxSen when COD available', async () => {
            mockQuotationsSuccess([
                {
                    courier: 'flash',
                    serviceId: 'std',
                    courierName: 'Flash',
                    serviceName: 'Standard',
                    priceSen: 5000,
                    codAvailable: true,
                    codMaxSen: 50000,
                    estDelivery: '3–5 days',
                },
            ])

            const result = await getRates(
                { ...baseParams, allowedCouriers: ['flash'] },
                'token123',
                flatConfig,
            )

            expect(result.rates[0].codMaxSen).toBe(50000)
        })
    })
})
