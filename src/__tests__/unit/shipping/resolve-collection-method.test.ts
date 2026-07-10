import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────

vi.mock('@/lib/shipping/easyparcel/client', () => ({
    quotations: vi.fn(),
}))

vi.mock('@/lib/shipping/easyparcel/normalize', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/shipping/easyparcel/normalize')>()
    return {
        ...actual,
        mapSubdivisionCode: vi.fn((state: string) => state),
        aggregateWeightKg: vi.fn((grams: number) => grams / 1000),
    }
})

import { quotations } from '@/lib/shipping/easyparcel/client'
import { resolveServiceForMethod } from '@/app/api/orders/[id]/create-label/resolve-collection-method'

const mockQuotations = vi.mocked(quotations)

// ─── Fixtures ─────────────────────────────────────────────────────────

interface QuoteFixture {
    courierId: string
    serviceId: string
    serviceName?: string
    price: string          // EP sends total_amount as string
    isPickup: boolean
    isDropoff: boolean
}

function mockQuote(items: QuoteFixture[]) {
    mockQuotations.mockResolvedValue({
        status_code: 200,
        data: [{
            status: 'success',
            quotations: items.map((i) => ({
                courier: {
                    courier_id: i.courierId,
                    service_id: i.serviceId,
                    courier_name: i.courierId,
                    service_name: i.serviceName ?? i.serviceId,
                    is_pickup: i.isPickup,
                    is_dropoff: i.isDropoff,
                },
                pricing: { currency: 'MYR', total_amount: i.price, shipment_price: i.price },
                features: [],
            })),
        }],
    } as any)
}

const baseArgs = {
    token: 'tok',
    senderPostcode: '47810',
    senderState: 'Selangor',
    receiverPostcode: '50480',
    receiverState: 'KL',
    weightGrams: 500,
    parcelValueRm: 100,
    serviceId: 'pos-melplus',   // stored at checkout — drop-off variant in most fixtures
    method: 'pickup' as const,
}

// ─── Tests (docs/qa/F36 §3.18b) ───────────────────────────────────────

describe('resolveServiceForMethod', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('[TC-F36.151] keeps the stored service when it already supports the method', async () => {
        // Arrange
        mockQuote([
            { courierId: 'pos', serviceId: 'pos-melplus', price: '6.22', isPickup: true, isDropoff: true },
        ])

        // Act
        const res = await resolveServiceForMethod(baseArgs)

        // Assert
        expect(res).toEqual({ ok: true, serviceId: 'pos-melplus', changed: false })
    })

    it('[TC-F36.152] switches to the CHEAPEST same-courier variant supporting the method (NaN price excluded)', async () => {
        // Arrange — stored is drop-off-only; two valid pickup variants + one NaN-priced +
        // a cheaper pickup variant of a DIFFERENT courier that must never be picked
        mockQuote([
            { courierId: 'pos', serviceId: 'pos-melplus', price: '6.22', isPickup: false, isDropoff: true },
            { courierId: 'pos', serviceId: 'pos-pickup-exp', serviceName: 'Pos Laju Express', price: '9.50', isPickup: true, isDropoff: false },
            { courierId: 'pos', serviceId: 'pos-pickup-std', serviceName: 'Pos Laju', price: '7.20', isPickup: true, isDropoff: false },
            { courierId: 'pos', serviceId: 'pos-pickup-nan', price: '', isPickup: true, isDropoff: false },
            { courierId: 'jnt', serviceId: 'jnt-pickup', price: '1.00', isPickup: true, isDropoff: false },
        ])

        // Act
        const res = await resolveServiceForMethod(baseArgs)

        // Assert — cheapest VALID pickup variant of the SAME courier
        expect(res).toEqual({
            ok: true,
            serviceId: 'pos-pickup-std',
            serviceName: 'Pos Laju',
            priceRm: 7.2,
            changed: true,
        })
    })

    it('[TC-F36.153] reports unsupported when no same-courier variant can do the method', async () => {
        // Arrange — every pos service is drop-off-only; jnt pickup must not leak in
        mockQuote([
            { courierId: 'pos', serviceId: 'pos-melplus', price: '6.22', isPickup: false, isDropoff: true },
            { courierId: 'pos', serviceId: 'pos-mini', price: '5.10', isPickup: false, isDropoff: true },
            { courierId: 'jnt', serviceId: 'jnt-pickup', price: '4.00', isPickup: true, isDropoff: false },
        ])

        // Act
        const res = await resolveServiceForMethod(baseArgs)

        // Assert
        expect(res).toEqual({ ok: false, supported: ['dropoff'] })
    })

    it('[TC-F36.154] fails open to the stored service when the quotation call throws', async () => {
        // Arrange
        mockQuotations.mockRejectedValue(new Error('EP timeout'))

        // Act
        const res = await resolveServiceForMethod(baseArgs)

        // Assert — submit stays the authority; never block the label on a broken quote
        expect(res).toEqual({ ok: true, serviceId: 'pos-melplus', changed: false })
    })

    it('[TC-F36.155] fails open when the stored service is absent from the quote', async () => {
        // Arrange
        mockQuote([
            { courierId: 'jnt', serviceId: 'jnt-pickup', price: '4.00', isPickup: true, isDropoff: false },
        ])

        // Act
        const res = await resolveServiceForMethod(baseArgs)

        // Assert
        expect(res).toEqual({ ok: true, serviceId: 'pos-melplus', changed: false })
    })

    it('[TC-F36.151] dropoff method keeps a dropoff-capable stored service', async () => {
        // Arrange — the reverse direction: stored supports dropoff, merchant picks dropoff
        mockQuote([
            { courierId: 'pos', serviceId: 'pos-melplus', price: '6.22', isPickup: false, isDropoff: true },
        ])

        // Act
        const res = await resolveServiceForMethod({ ...baseArgs, method: 'dropoff' })

        // Assert
        expect(res).toEqual({ ok: true, serviceId: 'pos-melplus', changed: false })
    })
})
