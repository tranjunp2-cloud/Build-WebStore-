import { describe, expect, it } from 'vitest'
import { disableQrWhenImageRemoved, requireQrImageWhenEnabled } from '@/collections/Tenants'

describe('tenant payment QR hooks', () => {
    it('keeps QR enabled when a partial update omits the existing image', () => {
        expect(requireQrImageWhenEnabled({
            value: true,
            siblingData: { payment_qr: true },
            previousSiblingDoc: { qr_image: 42 },
        })).toBe(true)
    })

    it('does not disable QR when a partial update omits qr_image', () => {
        const siblingData: Record<string, unknown> = { account_holder_name: 'Updated name' }

        expect(disableQrWhenImageRemoved({ value: undefined, siblingData })).toBeUndefined()
        expect(siblingData).not.toHaveProperty('payment_qr')
    })

    it('disables QR when its image is explicitly removed', () => {
        const siblingData: Record<string, unknown> = { payment_qr: true }

        expect(disableQrWhenImageRemoved({ value: null, siblingData })).toBeNull()
        expect(siblingData.payment_qr).toBe(false)
    })
})
