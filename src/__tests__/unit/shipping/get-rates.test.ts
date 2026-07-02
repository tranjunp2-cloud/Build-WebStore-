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

    // Happy path: pick cheapest of all (no allowlist filtering)
    describe('[TC-F14.131] pick cheapest of all available', () => {
        it('returns cheapest EP option regardless of courier', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 5000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
            ])

            const result = await getRates(baseParams, 'token123', flatConfig)

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flash')
            expect(result.rates[0].priceSen).toBe(4000)
            expect(result.degraded).toBe(false)
        })
    })

    // EP returns no quotations → flat fallback
    describe('[TC-F14.132] EP empty quotations → flat fallback', () => {
        it('returns flat when EP returns 0 quotations', async () => {
            ;(quotations as any).mockResolvedValue({
                data: [{ status: 'success', quotations: [] }],
            })

            const result = await getRates(baseParams, 'token123', flatConfig)

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flat')
            expect(result.degraded).toBe(true)
        })
    })

    // Auto-cheapest: always pick the lowest price from EP
    describe('[TC-F14.133] pick cheapest from all EP quotations', () => {
        it('returns cheapest across multiple EP options', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 5000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'pos', serviceId: 'std', courierName: 'POS', serviceName: 'Standard', priceSen: 6000, codAvailable: false, estDelivery: '5–7 days' },
            ])

            const result = await getRates(baseParams, 'token123', flatConfig)

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flash')
            expect(result.rates[0].priceSen).toBe(4000)
            expect(result.degraded).toBe(false)
        })

        it('returns cheapest even with single option', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 5000, codAvailable: false, estDelivery: '3–5 days' },
            ])

            const result = await getRates(baseParams, 'token123', flatConfig)

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('jnt')
            expect(result.rates[0].priceSen).toBe(5000)
            expect(result.degraded).toBe(false)
        })
    })

    // COD: restrict to cod-capable, pick cheapest
    describe('[TC-F14.134] COD order restricts to COD-capable couriers', () => {
        it('returns cheapest COD-capable courier even if more expensive than non-COD', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 5000, codAvailable: true, codMaxSen: 100000, estDelivery: '3–5 days' },
                { courier: 'pos', serviceId: 'std', courierName: 'POS', serviceName: 'Standard', priceSen: 4500, codAvailable: true, codMaxSen: 50000, estDelivery: '5–7 days' },
            ])

            const result = await getRates(
                { ...baseParams, codAmountSen: 1000 },
                'token123',
                flatConfig,
            )

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('pos') // cheapest COD-capable
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
                { ...baseParams, codAmountSen: 1000 },
                'token123',
                flatConfig,
            )

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flat')
            expect(result.degraded).toBe(true)
        })
    })

    // BYOC couriers are excluded from auto-selection (opt-in only, not linked here)
    describe('[TC-F14.145] excludes BYOC couriers from auto-pick', () => {
        it('skips a cheaper BYOC courier and picks the cheapest non-BYOC', async () => {
            mockQuotationsSuccess([
                { courier: 'byoc_fedex', serviceId: 'std', courierName: 'BYOC FedEx', serviceName: 'Standard', priceSen: 3000, codAvailable: false, estDelivery: '2–4 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 5000, codAvailable: false, estDelivery: '3–5 days' },
            ])

            const result = await getRates(baseParams, 'token123', flatConfig)

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flash') // cheapest non-BYOC, BYOC 3000 skipped
            expect(result.degraded).toBe(false)
        })

        it('falls back to flat when every quotation is BYOC', async () => {
            mockQuotationsSuccess([
                { courier: 'byoc_fedex', serviceId: 'std', courierName: 'BYOC FedEx', serviceName: 'Standard', priceSen: 3000, codAvailable: false, estDelivery: '2–4 days' },
                { courier: 'byoc_gdex', serviceId: 'std', courierName: 'BYOC GDEX', serviceName: 'Standard', priceSen: 3500, codAvailable: false, estDelivery: '2–4 days' },
            ])

            const result = await getRates(baseParams, 'token123', flatConfig)

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flat')
            expect(result.degraded).toBe(true)
        })
    })

    // Non-COD: ignores codAvailable flag
    describe('[TC-F14.136] non-COD order picks cheapest (ignores codAvailable)', () => {
        it('picks cheapest regardless of COD availability', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 5000, codAvailable: true, codMaxSen: 100000, estDelivery: '3–5 days' },
            ])

            const result = await getRates(
                { ...baseParams, codAmountSen: undefined },
                'token123',
                flatConfig,
            )

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('jnt') // cheaper, COD availability not checked
            expect(result.degraded).toBe(false)
        })
    })

    // No allowlist param — new spec removes courier selection
    describe('[TC-F14.137] (deprecated allowlist logic replaced by auto-cheapest)', () => {
        it('no courier filtering — always picks cheapest EP option', async () => {
            // Old spec had allowlist filtering (e.g. allowlist=['flat']).
            // New spec: no allowlist param. Always pick cheapest EP.
            // This test is deprecated but kept for traceability: old TC-F14.137 logic is replaced by auto-cheapest.
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 5000, codAvailable: false, estDelivery: '3–5 days' },
            ])

            const result = await getRates(baseParams, 'token123', flatConfig)

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('jnt') // cheapest, no allowlist filtering
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

    // Edge cases
    describe('edge cases', () => {
        it('picks cheapest when EP returns multiple options', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 5000, codAvailable: false, estDelivery: '3–5 days' },
                { courier: 'flash', serviceId: 'std', courierName: 'Flash', serviceName: 'Standard', priceSen: 4000, codAvailable: false, estDelivery: '3–5 days' },
            ])

            const result = await getRates(baseParams, 'token123', flatConfig)

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('flash') // cheapest
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

            const result = await getRates(baseParams, 'token123', flatConfig)

            expect(result.rates[0].codMaxSen).toBe(50000)
        })
    })
})
