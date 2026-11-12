import { describe, it, expect } from 'vitest'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import { formatRelativeDate, formatRelativeTime } from '@/app/(dashboard)/customers/_lib/relative-time'

const NOW = new Date('2026-11-05T00:00:00Z').getTime()
const ago = (days: number) => new Date(NOW - days * 86400000).toISOString()
const enTb = en.dashboard.shopCustomers.table
const msTb = ms.dashboard.shopCustomers.table
const enCd = en.dashboard.shopCustomers.detail
const msCd = ms.dashboard.shopCustomers.detail

// ─── TC-F21-05-10: Relative time cua Customers dich theo locale (GH-2280) ───
describe('formatRelativeDate (customers last order)', () => {
    it('MS: today/yesterday giu nguyen', () => {
        expect(formatRelativeDate(ago(0), msTb, NOW)).toBe('Hari ini')
        expect(formatRelativeDate(ago(1), msTb, NOW)).toBe('Semalam')
    })

    it('MS: ngay / thang / nam duoc dich, khong con "ago"', () => {
        expect(formatRelativeDate(ago(5), msTb, NOW)).toBe('5 hari lalu')
        expect(formatRelativeDate(ago(120), msTb, NOW)).toBe('4 bulan lalu')
        expect(formatRelativeDate(ago(400), msTb, NOW)).toBe('1 tahun lalu')
        expect(formatRelativeDate(ago(120), msTb, NOW)).not.toMatch(/ago/)
    })

    it('EN: giu nguyen hanh vi cu', () => {
        expect(formatRelativeDate(ago(5), enTb, NOW)).toBe('5d ago')
        expect(formatRelativeDate(ago(45), enTb, NOW)).toBe('1mo ago')
        expect(formatRelativeDate(ago(400), enTb, NOW)).toBe('1y ago')
    })

    it('BVA: 29 ngay -> ngay, 30 -> thang, 364 -> thang, 365 -> nam', () => {
        expect(formatRelativeDate(ago(29), msTb, NOW)).toBe('29 hari lalu')
        expect(formatRelativeDate(ago(30), msTb, NOW)).toBe('1 bulan lalu')
        expect(formatRelativeDate(ago(364), msTb, NOW)).toBe('12 bulan lalu')
        expect(formatRelativeDate(ago(365), msTb, NOW)).toBe('1 tahun lalu')
    })
})

describe('formatRelativeTime (customer detail "Updated")', () => {
    const min = (m: number) => new Date(NOW - m * 60000).toISOString()

    it('MS: phut / gio / ngay / thang / nam', () => {
        expect(formatRelativeTime(min(0), msCd, NOW)).toBe('sebentar tadi')
        expect(formatRelativeTime(min(5), msCd, NOW)).toBe('5 minit lalu')
        expect(formatRelativeTime(min(180), msCd, NOW)).toBe('3 jam lalu')
        expect(formatRelativeTime(min(3 * 1440), msCd, NOW)).toBe('3 hari lalu')
        expect(formatRelativeTime(min(90 * 1440), msCd, NOW)).toBe('3 bulan lalu')
        expect(formatRelativeTime(min(800 * 1440), msCd, NOW)).toBe('2 tahun lalu')
    })

    it('EN: giu nguyen hanh vi cu', () => {
        expect(formatRelativeTime(min(5), enCd, NOW)).toBe('5m ago')
        expect(formatRelativeTime(min(180), enCd, NOW)).toBe('3h ago')
        expect(formatRelativeTime(min(90 * 1440), enCd, NOW)).toBe('3mo ago')
    })
})
