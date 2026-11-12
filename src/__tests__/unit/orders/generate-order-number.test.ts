import { describe, it, expect } from 'vitest'
import { generateOrderNumber } from '@/lib/orders/generate-order-number'
import { normalizeOrderNumber } from '@/lib/orders/normalize-order-number'

// TC-F10.tracking.08 — GH-2081: mã đơn có >= 64 bit ngẫu nhiên từ CSPRNG
describe('generateOrderNumber (TC-F10.tracking.08)', () => {
    it('đúng format ORD-<ts36>-<16 hex HOA>, chỉ [A-Z0-9-], <= 50 ký tự', () => {
        // Arrange + Act
        const code = generateOrderNumber()
        // Assert
        expect(code).toMatch(/^ORD-[0-9A-Z]+-[0-9A-F]{16}$/)
        expect(code.length).toBeLessThanOrEqual(50)
        expect(normalizeOrderNumber(code)).toBe(code)
    })

    it('dùng timestamp base36 HOA + 8 byte ngẫu nhiên được inject', () => {
        // Arrange
        const now = 1_700_000_000_000
        const rand = (size: number) => Buffer.alloc(size, 0xab)
        // Act
        const code = generateOrderNumber(now, rand)
        // Assert
        expect(code).toBe(`ORD-${now.toString(36).toUpperCase()}-ABABABABABABABAB`)
    })

    it('yêu cầu đúng 8 byte (64 bit) từ nguồn ngẫu nhiên', () => {
        let requested = 0
        generateOrderNumber(1, (size) => {
            requested = size
            return Buffer.alloc(size)
        })
        expect(requested).toBe(8)
    })

    it('cùng mili-giây vẫn không trùng (1000 mã)', () => {
        const now = Date.now()
        const codes = new Set(Array.from({ length: 1000 }, () => generateOrderNumber(now)))
        expect(codes.size).toBe(1000)
    })
})
