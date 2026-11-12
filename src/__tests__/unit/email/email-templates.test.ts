import { describe, it, expect, vi, afterEach } from 'vitest'
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
        expect(result.subject).toBe('Welcome to Web Store! 🎉')
        expect(result.html).toContain('Hi')
        expect(result.html).toContain('Get started →')
        expect(result.html).toContain('lang="en"')
    })

    it('renders EN locale correctly', () => {
        const result = welcomeEmail({ ...baseData, locale: 'en' })
        expect(result.subject).toBe('Welcome to Web Store! 🎉')
        expect(result.html).toContain('Welcome! 🎉')
        expect(result.html).toContain('Get started in 3 steps')
        expect(result.html).toContain('Ahmad')
    })

    it('renders MS locale correctly', () => {
        const result = welcomeEmail({ ...baseData, locale: 'ms' })
        expect(result.subject).toBe('Selamat Datang ke Web Store! 🎉')
        expect(result.html).toContain('Selamat datang! 🎉')
        expect(result.html).toContain('Mula dengan 3 langkah')
        expect(result.html).toContain('Mula sekarang →')
        expect(result.html).toContain('lang="ms"')
    })

    it('includes custom dashboard URL', () => {
        const result = welcomeEmail({ ...baseData, dashboardUrl: 'https://custom.url/dash' })
        expect(result.html).toContain('https://custom.url/dash')
    })

    describe('default dashboard URL', () => {
        afterEach(() => vi.unstubAllEnvs())

        it('derives from NEXT_PUBLIC_SERVER_URL without a double slash', () => {
            vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://web.example.test/')
            const result = welcomeEmail(baseData)
            expect(result.html).toContain('https://web.example.test/dashboard')
            expect(result.html).not.toContain('primeweb.app')
        })

        it('falls back to localhost when NEXT_PUBLIC_SERVER_URL is unset', () => {
            vi.stubEnv('NEXT_PUBLIC_SERVER_URL', '')
            expect(welcomeEmail(baseData).html).toContain('http://localhost:3000/dashboard')
        })
    })
})

// ─── Order Confirmation Email ───────────────────────────────────────────
describe('orderConfirmationEmail', () => {
    const baseData = {
        shopName: 'My Shop',
        orderNumber: 'ORD-001',
        customerName: 'Siti',
        customerEmail: 'siti@test.com',
        items: [
            { name: 'Widget', quantity: 2, unitPrice: 50, lineTotal: 100 },
            { name: 'Gadget', quantity: 1, unitPrice: 100, lineTotal: 100 },
        ],
        subtotal: 200,
        shippingFee: 8,
        total: 212,
        paymentMethod: 'cod' as const,
        orderDate: '2026-05-20T08:00:00.000Z',
        orderPageUrl: 'https://example.com/orders/ORD-001',
        currency: 'MYR',
    }

    it('defaults to MS locale', () => {
        const result = orderConfirmationEmail(baseData)
        expect(result.subject).toContain('ORD-001')
        expect(result.html).toContain('lang="ms"')
        expect(result.html).toContain('Siti')
    })

    it('renders EN locale with MYR format', () => {
        const result = orderConfirmationEmail({ ...baseData, locale: 'en' })
        expect(result.subject).toContain('My Shop')
        expect(result.subject).toContain('ORD-001')
        expect(result.html).toContain('lang="en"')
        expect(result.html).toContain('MYR 212.00')
        expect(result.html).toContain('Pay on delivery')
    })

    it('renders MS locale with RM format', () => {
        const result = orderConfirmationEmail({ ...baseData, locale: 'ms' })
        expect(result.subject).toContain('Anda telah berjaya membuat pesanan')
        expect(result.html).toContain('Kuantiti')
        expect(result.html).toContain('RM212.00')
        expect(result.html).toContain('lang="ms"')
        expect(result.html).toContain('Bayar semasa penghantaran')
    })

    it('COD: prepaid=0, codPayment=total', () => {
        const result = orderConfirmationEmail({ ...baseData, paymentMethod: 'cod', total: 212 })
        expect(result.html).toContain('RM0.00') // prepaid
        expect(result.html).toContain('RM212.00') // cod payment
    })

    it('Stripe: prepaid=total, codPayment=0', () => {
        const result = orderConfirmationEmail({ ...baseData, paymentMethod: 'stripe', total: 212 })
        // prepaid row shows total, cod row shows 0
        const html = result.html
        const prepaidIdx = html.indexOf('Bayar dahulu')
        const codIdx = html.indexOf('Bayar semasa')
        // Both rows exist
        expect(prepaidIdx).toBeGreaterThan(-1)
        expect(codIdx).toBeGreaterThan(-1)
    })

    it('hides discount row when discountAmount is null', () => {
        const result = orderConfirmationEmail({ ...baseData, discountAmount: null })
        expect(result.html).not.toContain('Diskaun')
    })

    it('shows discount row with code when discountAmount provided', () => {
        const result = orderConfirmationEmail({ ...baseData, discountAmount: 20, discountCode: 'SAVE20', locale: 'ms' })
        expect(result.html).toContain('Diskaun')
        expect(result.html).toContain('SAVE20')
        expect(result.html).toContain('-RM20.00')
    })

    it('renders variant below product name', () => {
        const result = orderConfirmationEmail({
            ...baseData,
            items: [{ name: 'Shirt', variant: 'Red / L', quantity: 1, unitPrice: 50, lineTotal: 50 }],
        })
        expect(result.html).toContain('Red / L')
    })

    it('renders shipping address in recipient block', () => {
        const result = orderConfirmationEmail({
            ...baseData,
            customerAddress: { line1: '123 Jalan Bukit', city: 'KL', state: 'WP', postcode: '50000' },
        })
        expect(result.html).toContain('123 Jalan Bukit')
        expect(result.html).toContain('KL')
    })

    it('XSS: escapes customerName in HTML output', () => {
        const result = orderConfirmationEmail({ ...baseData, customerName: '<script>alert(1)</script>' })
        expect(result.html).not.toContain('<script>')
        expect(result.html).toContain('&lt;script&gt;')
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
        expect(result.subject).toContain('Order shipped')
        expect(result.html).toContain('Hi')
        expect(result.html).toContain('Order number')
        expect(result.html).toContain('lang="en"')
    })

    it('renders all EN statuses correctly', () => {
        const cases: Array<{ status: Parameters<typeof orderStatusEmail>[0]['status']; title: string }> = [
            { status: 'confirmed', title: 'Order confirmed' },
            { status: 'ready_to_ship', title: 'Order ready to ship' },
            { status: 'processing', title: 'Order is processing' },
            { status: 'shipped', title: 'Order shipped' },
            { status: 'completed', title: 'Order completed' },
            { status: 'cancelled', title: 'Order cancelled' },
            { status: 'refunded', title: 'Order refunded' },
        ]
        cases.forEach(({ status, title }) => {
            const result = orderStatusEmail({ ...baseData, status, locale: 'en' })
            expect(result.html).toContain(title)
        })
    })

    it('renders all MS statuses correctly', () => {
        const cases: Array<{ status: Parameters<typeof orderStatusEmail>[0]['status']; title: string }> = [
            { status: 'confirmed', title: 'Pesanan disahkan' },
            { status: 'ready_to_ship', title: 'Pesanan anda sedia untuk dihantar' },
            { status: 'processing', title: 'Pesanan anda sedang diproses' },
            { status: 'shipped', title: 'Pesanan dihantar' },
            { status: 'completed', title: 'Pesanan selesai' },
            { status: 'cancelled', title: 'Pesanan dibatalkan' },
            { status: 'refunded', title: 'Pesanan dikembalikan' },
        ]
        cases.forEach(({ status, title }) => {
            const result = orderStatusEmail({ ...baseData, status, locale: 'ms' })
            expect(result.html).toContain(title)
        })
    })

    it('includes tracking info when shipped', () => {
        const result = orderStatusEmail({
            ...baseData,
            locale: 'ms',
            trackingNumber: 'TRACK-123',
            trackingUrl: 'https://track.my/123',
        })
        expect(result.html).toContain('Status penghantaran')
        expect(result.html).toContain('TRACK-123')
        expect(result.html).toContain('https://track.my/123')
    })
})

// ─── Forgot Password Email (TC-F02.28: reset token flow) ───────────────
describe('forgotPasswordEmail', () => {
    const baseData = { userName: 'Ahmad', resetUrl: 'https://primeweb.my/reset?token=abc123' }

    it('defaults to EN locale when no locale specified', () => {
        const result = forgotPasswordEmail(baseData)
        expect(result.subject).toBe('Reset your Web Store password 🔐')
        expect(result.html).toContain('lang="en"')
        expect(result.html).toContain('Ahmad')
    })

    it('renders EN locale with correct content', () => {
        const result = forgotPasswordEmail({ ...baseData, locale: 'en' })
        expect(result.subject).toBe('Reset your Web Store password 🔐')
        expect(result.html).toContain('Password reset')
        expect(result.html).toContain('Reset password →')
        expect(result.html).toContain('This link will expire in 1 hour.')
    })

    it('renders MS locale correctly (TC-F02.28: bilingual)', () => {
        const result = forgotPasswordEmail({ ...baseData, locale: 'ms' })
        expect(result.subject).toBe('Tetapkan semula kata laluan Web Store anda 🔐')
        expect(result.html).toContain('Tetapan semula kata laluan')
        expect(result.html).toContain('Tetapkan semula kata laluan →')
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
        expect(result.subject).toBe('Your Web Store verification code 🔐')
        expect(result.html).toContain('Email verification')
        expect(result.html).toContain('Verify your identity to continue')
        expect(result.html).toContain('This code expires in 5 minutes')
    })

    it('renders MS locale correctly (bilingual)', () => {
        const result = otpVerificationEmail({ ...baseData, locale: 'ms' })
        expect(result.subject).toBe('Kod pengesahan Web Store anda 🔐')
        expect(result.html).toContain('Pengesahan emel')
        expect(result.html).toContain('Sahkan identiti anda untuk teruskan')
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
        expect(result.html).toContain("Didn't ask for this code?")
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
