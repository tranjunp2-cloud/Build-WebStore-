import { describe, it, expect } from 'vitest'
import { welcomeEmail } from '@/lib/email/templates/welcome'
import { orderConfirmationEmail } from '@/lib/email/templates/order-confirmation'
import { orderStatusEmail } from '@/lib/email/templates/order-status'
import { forgotPasswordEmail } from '@/lib/email/templates/forgot-password'
import { otpVerificationEmail } from '@/lib/email/templates/otp-verification'

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

// ─── Forgot Password Email (TC-F02.28: reset token flow) ───────────────
describe('forgotPasswordEmail', () => {
    const baseData = { userName: 'Ahmad', resetUrl: 'https://primeweb.my/reset?token=abc123' }

    it('defaults to EN locale when no locale specified', () => {
        const result = forgotPasswordEmail(baseData)
        expect(result.subject).toBe('Reset your PrimeWeb password 🔐')
        expect(result.html).toContain('lang="en"')
        expect(result.html).toContain('Ahmad')
    })

    it('renders EN locale with correct content', () => {
        const result = forgotPasswordEmail({ ...baseData, locale: 'en' })
        expect(result.subject).toBe('Reset your PrimeWeb password 🔐')
        expect(result.html).toContain('Password Reset')
        expect(result.html).toContain('Reset Password →')
        expect(result.html).toContain('This link expires in 1 hour')
    })

    it('renders MS locale correctly (TC-F02.28: bilingual)', () => {
        const result = forgotPasswordEmail({ ...baseData, locale: 'ms' })
        expect(result.subject).toBe('Tetapkan semula kata laluan PrimeWeb anda 🔐')
        expect(result.html).toContain('Tetapan Semula Kata Laluan')
        expect(result.html).toContain('Tetapkan Semula Kata Laluan →')
        expect(result.html).toContain('lang="ms"')
    })

    it('includes reset URL in CTA button and fallback link', () => {
        const result = forgotPasswordEmail(baseData)
        // Should contain URL at least twice (button href + fallback text)
        const urlCount = (result.html.match(/https:\/\/primeweb\.my\/reset\?token=abc123/g) || []).length
        expect(urlCount).toBeGreaterThanOrEqual(2)
    })

    it('includes teal gradient header styling', () => {
        const result = forgotPasswordEmail(baseData)
        expect(result.html).toContain('linear-gradient(135deg, #0d9488, #0891b2)')
    })

    it('includes amber expiry notice', () => {
        const result = forgotPasswordEmail(baseData)
        expect(result.html).toContain('#fef3c7') // Amber background
        expect(result.html).toContain('#92400e') // Amber text color
    })
})

// ─── OTP Verification Email (TC-F02.21, 23: 2FA email) ─────────────────
describe('otpVerificationEmail', () => {
    const baseData = { userName: 'Siti', otpCode: '377528' }

    it('defaults to EN locale when no locale specified', () => {
        const result = otpVerificationEmail(baseData)
        expect(result.subject).toContain('verification code')
        expect(result.html).toContain('lang="en"')
        expect(result.html).toContain('Siti')
    })

    it('renders EN locale with correct content (TC-F02.21)', () => {
        const result = otpVerificationEmail({ ...baseData, locale: 'en' })
        expect(result.subject).toBe('Your PrimeWeb verification code 🔐')
        expect(result.html).toContain('Email Verification')
        expect(result.html).toContain('Verify your identity to continue')
        expect(result.html).toContain('This code expires in 5 minutes')
    })

    it('renders MS locale correctly (bilingual)', () => {
        const result = otpVerificationEmail({ ...baseData, locale: 'ms' })
        expect(result.subject).toBe('Kod pengesahan PrimeWeb anda 🔐')
        expect(result.html).toContain('Pengesahan E-mel')
        expect(result.html).toContain('Sahkan identiti anda untuk meneruskan')
        expect(result.html).toContain('lang="ms"')
    })

    it('renders OTP code with letter-spacing in the OTP span element (TC-F02.23)', () => {
        const result = otpVerificationEmail(baseData)
        // Assert both OTP code and letter-spacing are within the SAME <span> element
        expect(result.html).toMatch(
            /<span[^>]*letter-spacing:\s*12px[^>]*>377528<\/span>/
        )
    })

    it('includes security notice with amber styling', () => {
        const result = otpVerificationEmail({ ...baseData, locale: 'en' })
        expect(result.html).toContain('#fef3c7') // Amber background
        expect(result.html).toContain("If you didn't request this code")
    })

    it('includes teal gradient header and OTP box styling', () => {
        const result = otpVerificationEmail(baseData)
        expect(result.html).toContain('linear-gradient(135deg, #0d9488, #0891b2)')
        expect(result.html).toContain('#f0fdfa') // Teal OTP box bg
        expect(result.html).toContain('#0d9488') // Teal OTP text color
    })

    it('renders different OTP codes correctly', () => {
        const result = otpVerificationEmail({ ...baseData, otpCode: '000000' })
        expect(result.html).toMatch(
            /<span[^>]*letter-spacing:\s*12px[^>]*>000000<\/span>/
        )
    })
})

