import { describe, it, expect } from 'vitest'
import { welcomeEmail } from '@/lib/email/templates/welcome'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { orderStatusEmail } from '@/lib/email/templates/order-status'

// ─── Welcome Email ──────────────────────────────────────────────────────
describe('welcomeEmail', () => {
    const baseData = { userName: 'Ahmad' }

    it('defaults to EN locale when no locale specified', () => {
        const result = welcomeEmail(baseData)
        expect(result.subject).toBe('Welcome to PrimeWeb! 🎉')
        expect(result.html).toContain('Hi')
        expect(result.html).toContain('Get Started →')
        expect(result.html).toContain('lang="en"')
    })

    it('renders EN locale correctly', () => {
        const result = welcomeEmail({ ...baseData, locale: 'en' })
        expect(result.subject).toBe('Welcome to PrimeWeb! 🎉')
        expect(result.html).toContain('Welcome! 🎉')
        expect(result.html).toContain('Get started in 3 steps')
        expect(result.html).toContain('Ahmad')
    })

    it('renders MS locale correctly', () => {
        const result = welcomeEmail({ ...baseData, locale: 'ms' })
        expect(result.subject).toBe('Selamat Datang ke PrimeWeb! 🎉')
        expect(result.html).toContain('Selamat Datang! 🎉')
        expect(result.html).toContain('Mula dalam 3 langkah')
        expect(result.html).toContain('Mula Sekarang →')
        expect(result.html).toContain('lang="ms"')
    })

    it('includes custom dashboard URL', () => {
        const result = welcomeEmail({ ...baseData, dashboardUrl: 'https://custom.url/dash' })
        expect(result.html).toContain('https://custom.url/dash')
    })
})

// ─── Order Confirmation Email ───────────────────────────────────────────
describe('orderConfirmationEmail', () => {
    const baseData = {
        orderNumber: 'ORD-001',
        customerName: 'Siti',
        items: [
            { productName: 'Widget', quantity: 2, unitPrice: 50 },
            { productName: 'Gadget', quantity: 1, unitPrice: 100 },
        ],
        subtotal: 200,
        tax: 12,
        total: 212,
        currency: 'MYR',
    }

    it('defaults to EN locale', () => {
        const result = orderConfirmationEmail(baseData)
        expect(result.subject).toBe('Order Confirmed — ORD-001')
        expect(result.html).toContain('Order Confirmed ✓')
        expect(result.html).toContain('lang="en"')
    })

    it('renders EN locale with MYR format', () => {
        const result = orderConfirmationEmail({ ...baseData, locale: 'en' })
        expect(result.subject).toContain('Order Confirmed')
        expect(result.html).toContain('Item')
        expect(result.html).toContain('Qty')
        expect(result.html).toContain('MYR 212.00')
    })

    it('renders MS locale with RM format', () => {
        const result = orderConfirmationEmail({ ...baseData, locale: 'ms' })
        expect(result.subject).toContain('Pesanan Disahkan')
        expect(result.html).toContain('Barangan')
        expect(result.html).toContain('Kuantiti')
        expect(result.html).toContain('RM212.00')
        expect(result.html).toContain('lang="ms"')
    })

    it('includes shipping address with localized label', () => {
        const result = orderConfirmationEmail({
            ...baseData,
            locale: 'ms',
            shippingAddress: { line1: '123 Jalan Bukit', city: 'KL', state: 'WP', postcode: '50000' },
        })
        expect(result.html).toContain('Alamat Penghantaran')
        expect(result.html).toContain('123 Jalan Bukit')
    })
})

// ─── Order Status Email ─────────────────────────────────────────────────
describe('orderStatusEmail', () => {
    const baseData = {
        customerName: 'Ali',
        orderNumber: 'ORD-002',
        status: 'shipped' as const,
    }

    it('defaults to EN locale', () => {
        const result = orderStatusEmail(baseData)
        expect(result.subject).toContain('Order Shipped')
        expect(result.html).toContain('Hi')
        expect(result.html).toContain('Order Number')
        expect(result.html).toContain('lang="en"')
    })

    it('renders all EN statuses correctly', () => {
        const statuses = ['processing', 'shipped', 'delivered', 'cancelled'] as const
        const expectedTitles = ['Order is Processing', 'Order Shipped', 'Order Delivered', 'Order Cancelled']

        statuses.forEach((status, i) => {
            const result = orderStatusEmail({ ...baseData, status, locale: 'en' })
            expect(result.html).toContain(expectedTitles[i])
        })
    })

    it('renders all MS statuses correctly', () => {
        const statuses = ['processing', 'shipped', 'delivered', 'cancelled'] as const
        const expectedTitles = ['Pesanan Sedang Diproses', 'Pesanan Telah Dihantar', 'Pesanan Telah Dihantar', 'Pesanan Dibatalkan']

        statuses.forEach((status, i) => {
            const result = orderStatusEmail({ ...baseData, status, locale: 'ms' })
            expect(result.html).toContain(expectedTitles[i])
        })
    })

    it('includes tracking info when shipped', () => {
        const result = orderStatusEmail({
            ...baseData,
            locale: 'ms',
            trackingNumber: 'TRACK-123',
            trackingUrl: 'https://track.my/123',
        })
        expect(result.html).toContain('Penjejakan')
        expect(result.html).toContain('TRACK-123')
        expect(result.html).toContain('https://track.my/123')
    })
})
