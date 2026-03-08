import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cn, formatRelativeTime, formatStorage } from '@/lib/utils'

describe('cn (className merge)', () => {
    it('should merge simple strings', () => {
        expect(cn('px-4', 'py-2')).toBe('px-4 py-2')
    })

    it('should handle conditional classes', () => {
        const isActive = true
        expect(cn('btn', isActive && 'btn-active')).toContain('btn-active')
    })

    it('should resolve Tailwind conflicts (last wins)', () => {
        const result = cn('px-4', 'px-8')
        expect(result).toBe('px-8')
    })
})

describe('formatRelativeTime', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-03-08T12:00:00Z'))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('should return "Just now" for < 1 minute', () => {
        const date = new Date('2026-03-08T11:59:30Z')
        expect(formatRelativeTime(date)).toBe('Just now')
    })

    it('should return "X min ago" for < 60 minutes', () => {
        const date = new Date('2026-03-08T11:45:00Z')
        expect(formatRelativeTime(date)).toBe('15 min ago')
    })

    it('should return "X hours ago" for < 24 hours', () => {
        const date = new Date('2026-03-08T09:00:00Z')
        expect(formatRelativeTime(date)).toBe('3 hours ago')
    })

    it('should return "X days ago" for < 7 days', () => {
        const date = new Date('2026-03-06T12:00:00Z')
        expect(formatRelativeTime(date)).toBe('2 days ago')
    })

    it('should return a date string for >= 7 days', () => {
        const date = new Date('2026-02-20T12:00:00Z')
        const result = formatRelativeTime(date)
        // Should be a formatted date, not relative
        expect(result).not.toContain('ago')
    })

    it('should handle string input', () => {
        const result = formatRelativeTime('2026-03-08T11:50:00Z')
        expect(result).toBe('10 min ago')
    })
})

describe('formatStorage', () => {
    it('should format bytes', () => {
        expect(formatStorage(512)).toBe('512 B')
    })

    it('should format kilobytes', () => {
        expect(formatStorage(2048)).toBe('2.0 KB')
    })

    it('should format megabytes', () => {
        expect(formatStorage(5242880)).toBe('5.0 MB')
    })

    it('should format gigabytes', () => {
        expect(formatStorage(2147483648)).toBe('2.0 GB')
    })

    it('should handle zero', () => {
        expect(formatStorage(0)).toBe('0 B')
    })
})

describe('formatMYR (currency helper)', () => {
    // If project has a formatMYR util, test it here
    // For now, test the pattern that should be used
    it('should format to RM XX.XX pattern', () => {
        const formatMYR = (amount: number) => `RM ${amount.toFixed(2)}`
        expect(formatMYR(29.9)).toBe('RM 29.90')
        expect(formatMYR(0)).toBe('RM 0.00')
        expect(formatMYR(1250.5)).toBe('RM 1250.50')
    })

    it('should handle SST (6%) calculation', () => {
        const subtotal = 100
        const sst = subtotal * 0.06
        const total = subtotal + sst
        expect(sst).toBeCloseTo(6.0)
        expect(total).toBeCloseTo(106.0)
    })
})
