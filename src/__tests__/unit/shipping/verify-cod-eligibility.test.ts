/**
 * Unit tests for verifyCodEligibilityLive — F36 (GH-1333, PD-021 mirror gate)
 * Live COD re-validation at create-label time: re-quote the stored service_id and
 * enforce R1/R2/R3 before submit_orders (EP submit accepts ineligible COD silently).
 * Fail-open on quotation errors / missing service — submit stays the authority there.
 *
 * TC-F14.150–F14.152 (docs/qa/F14-shipping.md § COD Eligibility R1/R2/R3).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/shipping/easyparcel/client', () => ({
    quotations: vi.fn(),
}))
vi.mock('@/lib/shipping/easyparcel/normalize', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/shipping/easyparcel/normalize')>()
    return {
        ...actual, // keep rmStringToSen (and friends) real — only stub the geo/weight helpers
        mapSubdivisionCode: vi.fn((state: string) => state),
        aggregateWeightKg: vi.fn((grams: number) => grams / 1000),
    }
})

import { verifyCodEligibilityLive } from '@/app/api/orders/[id]/create-label/verify-cod-eligibility'
import { quotations } from '@/lib/shipping/easyparcel/client'

const baseArgs = {
    token: 'token-xyz',
    senderPostcode: '47810',
    senderState: 'Selangor',
    receiverPostcode: '93000',
    receiverState: 'Sarawak',
    weightGrams: 500,
    parcelValueRm: 118,
    codAmountSen: 11_800, // RM118
    serviceId: 'SVC-JNT-1',
}

function mockQuote(serviceId: string, cod: { available: boolean; min?: string; max?: string } | null) {
    ;(quotations as any).mockResolvedValue({
        data: [{
            status: 'success',
            quotations: [{
                courier: { service_id: serviceId, service_name: 'Standard', courier_id: 'EP-CR0DW', courier_name: 'J&T Express', delivery_duration: '2-3 days', is_pickup: true, is_dropoff: false },
                pricing: { currency: 'MYR', total_amount: '6.23', shipment_price: '6.23' },
                features: cod
                    ? [{ cod: { available: cod.available, ...(cod.min ? { min_cod_amount: cod.min } : {}), ...(cod.max ? { max_cod_amount: cod.max } : {}) } }]
                    : [],
            }],
        }],
    })
}

describe('verifyCodEligibilityLive', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // TC-F14.150: service still COD-eligible → ok (East MY route included — R4 no region input)
    it('[TC-F14.150] stored service within live COD limits → ok:true (East route, PD-021 R4)', async () => {
        mockQuote('SVC-JNT-1', { available: true, min: '7.5', max: '1000' })
        const result = await verifyCodEligibilityLive(baseArgs)
        expect(result).toEqual({ ok: true })
    })

    // TC-F14.151: live limits changed and the amount is now out of range → blocked with reason
    it('[TC-F14.151] amount over the live max → ok:false, reason over_max', async () => {
        mockQuote('SVC-JNT-1', { available: true, min: '7.5', max: '100' }) // max dropped to RM100
        const result = await verifyCodEligibilityLive(baseArgs) // RM118
        expect(result).toEqual({ ok: false, reason: 'over_max' })
    })

    it('[TC-F14.151b] courier dropped COD on this route → ok:false, reason no_cod_courier', async () => {
        mockQuote('SVC-JNT-1', { available: false })
        const result = await verifyCodEligibilityLive(baseArgs)
        expect(result).toEqual({ ok: false, reason: 'no_cod_courier' })
    })

    // TC-F14.152: fail-open paths — quotation error / service absent must NOT block label creation
    it('[TC-F14.152] quotation call throws → ok:true (fail-open, submit is the authority)', async () => {
        ;(quotations as any).mockRejectedValue(new Error('EP timeout'))
        const result = await verifyCodEligibilityLive(baseArgs)
        expect(result).toEqual({ ok: true })
    })

    it('[TC-F14.152b] stored service missing from the quote → ok:true (fail-open)', async () => {
        mockQuote('SVC-OTHER', { available: true, min: '7.5', max: '1000' })
        const result = await verifyCodEligibilityLive(baseArgs)
        expect(result).toEqual({ ok: true })
    })

    it('[TC-F14.152c] quotation result status=error → ok:true (fail-open)', async () => {
        ;(quotations as any).mockResolvedValue({ data: [{ status: 'error', errors: ['invalid postcode'] }] })
        const result = await verifyCodEligibilityLive(baseArgs)
        expect(result).toEqual({ ok: true })
    })
})
