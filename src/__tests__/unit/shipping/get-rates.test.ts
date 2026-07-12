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

vi.mock('@/lib/shipping/easyparcel/normalize', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/shipping/easyparcel/normalize')>()
    return {
        ...actual, // keep rmStringToSen (and friends) real — only stub the geo/weight helpers
        mapSubdivisionCode: vi.fn((state: string) => state),
        aggregateWeightKg: vi.fn((grams: number) => grams / 1000),
    }
})

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
            is_pickup: r.isPickup,
            is_dropoff: r.isDropoff,
        },
        pricing: { total_amount: (r.priceSen / 100).toString() },
        features: r.codAvailable
            ? [{
                cod: {
                    available: true,
                    max_cod_amount: (r.codMaxSen ? r.codMaxSen / 100 : '1000').toString(),
                    ...(r.codMinSen != null ? { min_cod_amount: (r.codMinSen / 100).toString() } : {}),
                },
            }]
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

    // US-F36-07 correction: pickup/drop-off is a SERVICE VARIANT property — the flags must
    // survive normalization so create-label can honor the merchant's collection method.
    describe('[TC-F36.156] preserves collection capability flags', () => {
        it('maps is_pickup/is_dropoff from quotation onto RateOption', async () => {
            mockQuotationsSuccess([
                { courier: 'pos', serviceId: 'pos-melplus', courierName: 'Pos Malaysia', serviceName: 'Melplus', priceSen: 622, codAvailable: false, estDelivery: '2–3 days', isPickup: false, isDropoff: true },
            ])

            const result = await getRates(baseParams, 'token123', flatConfig)

            expect(result.rates[0].isPickup).toBe(false)
            expect(result.rates[0].isDropoff).toBe(true)
        })

        it('leaves flags absent on flat-rate fallback (not an EP service)', async () => {
            const result = await getRates(baseParams, null, flatConfig)
            expect(result.rates[0].isPickup).toBeUndefined()
            expect(result.rates[0].isDropoff).toBeUndefined()
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

    // COD: none COD-capable → keep EP pick, flag codIneligible (no flat swap — fee display stays real)
    describe('[TC-F14.135] COD order, no COD-capable courier → EP pick + codIneligible flag', () => {
        it('keeps the cheapest EP rate and surfaces the verdict when no courier supports COD', async () => {
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
            expect(result.rates[0].courier).toBe('jnt') // cheapest EP pick kept — NOT flat
            expect(result.degraded).toBe(false)
            // PD-021: the ineligibility verdict is surfaced so checkout can hard-gate COD
            expect(result.codIneligible).toBe('no_cod_courier')
        })
    })

    // PD-021 R1: COD amount above every courier max → EP pick kept + over_max verdict
    describe('[TC-F14.146] COD over all courier maxes → EP pick + codIneligible over_max', () => {
        it('keeps the EP rate and flags over_max when the amount exceeds every courier max', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 4000, codAvailable: true, codMinSen: 750, codMaxSen: 100_000, estDelivery: '3–5 days' },
            ])

            const result = await getRates(
                { ...baseParams, codAmountSen: 500_000 }, // RM5000 > J&T max RM1000
                'token123',
                flatConfig,
            )

            expect(result.rates[0].courier).toBe('jnt') // EP pick kept — NOT flat
            expect(result.degraded).toBe(false)
            expect(result.codIneligible).toBe('over_max')
        })
    })

    // PD-021 R2: COD amount below every courier min → EP pick kept + under_min verdict
    describe('[TC-F14.147] COD under all courier mins → EP pick + codIneligible under_min', () => {
        it('keeps the EP rate and flags under_min when the amount is under every courier min', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 4000, codAvailable: true, codMinSen: 750, codMaxSen: 100_000, estDelivery: '3–5 days' },
            ])

            const result = await getRates(
                { ...baseParams, codAmountSen: 50 }, // RM0.50 < J&T min RM7.50
                'token123',
                flatConfig,
            )

            expect(result.rates[0].courier).toBe('jnt') // EP pick kept — NOT flat
            expect(result.degraded).toBe(false)
            expect(result.codIneligible).toBe('under_min')
        })
    })

    // PD-021 R1/R2 auto-pick: cheapest courier out of range → next courier in range wins
    describe('[TC-F14.148] COD min/max enforced during auto-pick', () => {
        it('skips the cheaper courier whose max is exceeded and picks the in-range one', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 4000, codAvailable: true, codMinSen: 750, codMaxSen: 100_000, estDelivery: '3–5 days' },
                { courier: 'dhl', serviceId: 'std', courierName: 'DHL', serviceName: 'Standard', priceSen: 5000, codAvailable: true, codMinSen: 650, codMaxSen: 200_000, estDelivery: '3–5 days' },
            ])

            const result = await getRates(
                { ...baseParams, codAmountSen: 150_000 }, // RM1500: over J&T max, within DHL max
                'token123',
                flatConfig,
            )

            expect(result.rates).toHaveLength(1)
            expect(result.rates[0].courier).toBe('dhl')
            expect(result.degraded).toBe(false)
            expect(result.codIneligible).toBeUndefined()
        })
    })

    // PD-021 NaN guard: EP sometimes sends ""/non-numeric min/max — parseFloat("") is NaN,
    // and NaN limits must be treated as "no limit", never as a failing bound.
    describe('[TC-F14.154] empty-string COD limits → treated as no limit (NaN guard)', () => {
        it('keeps a codAvailable courier eligible when min/max come back as ""', async () => {
            ;(quotations as any).mockResolvedValue({
                data: [{
                    status: 'success',
                    quotations: [{
                        courier: { courier_id: 'pos', service_id: 'std', courier_name: 'Pos Malaysia Berhad', service_name: 'Standard', delivery_duration: '3–5 days' },
                        pricing: { total_amount: '8.00' },
                        features: [{ cod: { available: true, min_cod_amount: '', max_cod_amount: '' } }],
                    }],
                }],
            })

            const result = await getRates(
                { ...baseParams, codAmountSen: 950 }, // RM9.50 COD order
                'token123',
                flatConfig,
            )

            expect(result.rates[0].courier).toBe('pos')
            expect(result.rates[0].codMinSen).toBeUndefined() // NOT NaN
            expect(result.rates[0].codMaxSen).toBeUndefined()
            expect(result.codIneligible).toBeUndefined()      // COD orderable
            expect(result.degraded).toBe(false)
        })

        // Docs #quotation-response-2026-03 format limits as "MYR1000.00" (currency-prefixed)
        it('parses currency-prefixed limits ("MYR10.00") per the official docs format', async () => {
            ;(quotations as any).mockResolvedValue({
                data: [{
                    status: 'success',
                    quotations: [{
                        courier: { courier_id: 'jnt', service_id: 'std', courier_name: 'J&T Express', service_name: 'Standard', delivery_duration: '2–3 days' },
                        pricing: { total_amount: '6.23' },
                        features: [{ cod: { available: true, min_cod_amount: 'MYR10.00', max_cod_amount: 'MYR1,000.00' } }],
                    }],
                }],
            })

            const result = await getRates(
                { ...baseParams, codAmountSen: 950 }, // RM9.50 < min RM10
                'token123',
                flatConfig,
            )

            expect(result.rates[0].codMinSen).toBe(1000)      // "MYR10.00" → 1000 sen
            expect(result.rates[0].codMaxSen).toBe(100_000)   // "MYR1,000.00" → 100000 sen
            expect(result.codIneligible).toBe('under_min')    // limit ENFORCED, not dropped
        })
    })

    // PD-021 probe: non-COD pick still returns the COD verdict for the probe amount
    describe('[TC-F14.153] codProbeSen verdict without COD-filtering the pick', () => {
        it('returns cheapest overall AND codIneligible verdict when probe amount is out of range', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 4000, codAvailable: true, codMinSen: 750, codMaxSen: 100_000, estDelivery: '3–5 days' },
                { courier: 'citylink', serviceId: 'std', courierName: 'City-Link', serviceName: 'Standard', priceSen: 3000, codAvailable: false, estDelivery: '3–5 days' },
            ])

            // Non-COD pick (no codAmountSen): cheapest overall wins, but probe RM5000 > J&T max
            const result = await getRates(
                { ...baseParams, codProbeSen: 500_000 },
                'token123',
                flatConfig,
            )

            expect(result.rates[0].courier).toBe('citylink') // pick NOT COD-filtered
            expect(result.degraded).toBe(false)
            expect(result.codIneligible).toBe('over_max')    // verdict still surfaced
        })

        it('returns no verdict when the probe amount is within a courier range', async () => {
            mockQuotationsSuccess([
                { courier: 'jnt', serviceId: 'std', courierName: 'JNT', serviceName: 'Standard', priceSen: 4000, codAvailable: true, codMinSen: 750, codMaxSen: 100_000, estDelivery: '3–5 days' },
            ])

            const result = await getRates(
                { ...baseParams, codProbeSen: 5000 },
                'token123',
                flatConfig,
            )

            expect(result.rates[0].courier).toBe('jnt')
            expect(result.codIneligible).toBeUndefined()
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

        // [TC-F14.149] PD-021 R2 needs the min limit propagated from the quotation
        it('preserves codMinSen when COD available', async () => {
            mockQuotationsSuccess([
                {
                    courier: 'flash',
                    serviceId: 'std',
                    courierName: 'Flash',
                    serviceName: 'Standard',
                    priceSen: 5000,
                    codAvailable: true,
                    codMinSen: 750,
                    codMaxSen: 50000,
                    estDelivery: '3–5 days',
                },
            ])

            const result = await getRates(baseParams, 'token123', flatConfig)

            expect(result.rates[0].codMinSen).toBe(750)
        })
    })
})
