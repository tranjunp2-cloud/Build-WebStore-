import { describe, it, expect } from 'vitest'

describe('Example Unit Test', () => {
    it('should pass a basic assertion', () => {
        expect(1 + 1).toBe(2)
    })

    it('should format MYR currency', () => {
        const formatMYR = (amount: number) =>
            `RM ${amount.toFixed(2)}`

        expect(formatMYR(29.9)).toBe('RM 29.90')
        expect(formatMYR(0)).toBe('RM 0.00')
        expect(formatMYR(1250)).toBe('RM 1250.00')
    })
})
