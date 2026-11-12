import { describe, it, expect } from 'vitest'
import { normalizeOrderNumber } from '@/lib/orders/normalize-order-number'

// TC-F10.tracking.03 — GH-2277: tra cứu đơn không phân biệt hoa/thường
describe('normalizeOrderNumber (TC-F10.tracking.03)', () => {
    it('đổi mã chữ thường sang chữ hoa', () => {
        // Arrange
        const input = 'ord-mw1xfsi3'
        // Act
        const result = normalizeOrderNumber(input)
        // Assert
        expect(result).toBe('ORD-MW1XFSI3')
    })

    it('chuẩn hoá mã lẫn hoa/thường và bỏ khoảng trắng đầu/cuối', () => {
        expect(normalizeOrderNumber('  Ord-AbC ')).toBe('ORD-ABC')
    })

    it('giữ nguyên mã đã chuẩn và chuỗi rỗng', () => {
        expect(normalizeOrderNumber('ORD-ABC')).toBe('ORD-ABC')
        expect(normalizeOrderNumber('   ')).toBe('')
    })
})
