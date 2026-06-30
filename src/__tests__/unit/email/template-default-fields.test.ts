// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { getDefaultContentFields } from '@/lib/email/template-default-fields'
import { EMAIL_TEMPLATE_TYPES } from '@/lib/email/types'
import { templateRegistry } from '@/lib/email/template-registry'
import { EMAIL_PREVIEW_FIXTURES } from '@/lib/email/preview-fixtures'

/**
 * TC-GH-1433: email template editor form prefill defaults.
 * Verifies that getDefaultContentFields returns the raw default strings
 * that mirror mergeTemplateConfig defaults so the form matches the Live Preview.
 */

describe('getDefaultContentFields [TC-GH-1433]', () => {
    // ─── TC-GH-1433-01: welcome maps all 4 fields ────────────────────────

    it('[TC-GH-1433-01] welcome EN returns non-empty subject, greeting, ctaLabel, closing', () => {
        // Arrange / Act
        const r = getDefaultContentFields('welcome', 'en')

        // Assert — all 4 fields present and non-empty
        expect(r.subject).toBeTruthy()
        expect(r.greeting).toBeTruthy()
        expect(r.ctaLabel).toBeTruthy()
        expect(r.closing).toBeTruthy()
    })

    // ─── TC-GH-1433-02: order-confirmation prefills all 4 fields ─────────

    it('[TC-GH-1433-02] order-confirmation EN has subject (manual override) + greeting/ctaLabel/closing', () => {
        // Arrange / Act
        const r = getDefaultContentFields('order-confirmation', 'en')

        // Assert — subject mirrors the preview fixture (no event → "placed" default branch)
        expect(r.subject).toBeTruthy()
        expect(r.subject).toContain('placed')
        expect(r.greeting).toBeTruthy()
        expect(r.ctaLabel).toBeTruthy()
        expect(r.closing).toBeTruthy()
    })

    // ─── TC-GH-1433-03: order-waiting surfaces inline subject ────────────

    it('[TC-GH-1433-03] order-waiting EN returns a non-empty subject from inline strings', () => {
        // Arrange / Act
        const r = getDefaultContentFields('order-waiting', 'en')

        // Assert
        expect(r.subject).toBeTruthy()
        expect(r.subject).toContain('payment')
    })

    // ─── TC-GH-1433-04: raw {var} tokens are preserved, not substituted ──

    it('[TC-GH-1433-04] defaults keep {var} tokens (no substitution applied)', () => {
        // welcome greeting has {userName}
        const welcome = getDefaultContentFields('welcome', 'en')
        expect(welcome.greeting).toContain('{')
        expect(welcome.greeting).toContain('userName')

        // order-confirmation greeting has {customerName}
        const orderConf = getDefaultContentFields('order-confirmation', 'en')
        expect(orderConf.greeting).toContain('{customerName}')

        // payment-confirmed greeting has {customerName}
        const payConf = getDefaultContentFields('payment-confirmed', 'en')
        expect(payConf.greeting).toContain('{customerName}')
    })

    // ─── TC-GH-1433-05: locale param is respected (EN vs MS differ) ──────

    it('[TC-GH-1433-05] EN and MS defaults differ for at least one template', () => {
        // welcome subject differs
        const welcomeEn = getDefaultContentFields('welcome', 'en')
        const welcomeMs = getDefaultContentFields('welcome', 'ms')
        expect(welcomeEn.subject).not.toBe(welcomeMs.subject)

        // forgot-password ctaLabel differs
        const fpEn = getDefaultContentFields('forgot-password', 'en')
        const fpMs = getDefaultContentFields('forgot-password', 'ms')
        expect(fpEn.ctaLabel).not.toBe(fpMs.ctaLabel)
    })

    // ─── TC-GH-1433-06: otp-verification omits ctaLabel ─────────────────

    it('[TC-GH-1433-06] otp-verification has no ctaLabel (not in fieldMap)', () => {
        const r = getDefaultContentFields('otp-verification', 'en')
        expect(r.ctaLabel).toBeUndefined()
        expect(r.subject).toBeTruthy()
        expect(r.greeting).toBeTruthy()
        expect(r.closing).toBeTruthy()
    })

    // ─── TC-GH-1433-07: order-cancelled sources subject from cancelledOrder ──

    it('[TC-GH-1433-07] order-cancelled EN has subject from cancelledOrder i18n', () => {
        const r = getDefaultContentFields('order-cancelled', 'en')
        expect(r.subject).toBeTruthy()
        expect(r.greeting).toContain('{customerName}')
        expect(r.ctaLabel).toBeTruthy()
        expect(r.closing).toBeTruthy()
    })

    // ─── TC-GH-1433-08: bank-transfer-instructions prefills subject ──────

    it('[TC-GH-1433-08] bank-transfer-instructions has subject (manual override) + greeting/cta/closing', () => {
        const r = getDefaultContentFields('bank-transfer-instructions', 'en')
        expect(r.subject).toBeTruthy()
        expect(r.subject).toContain('payment')
        expect(r.greeting).toContain('{customerName}')
        expect(r.ctaLabel).toBeTruthy()
        expect(r.closing).toBeTruthy()
    })

    // ─── TC-GH-1433-09: payment-confirmed inline literal base ────────────

    it('[TC-GH-1433-09] payment-confirmed returns all 4 fields (inline literal base)', () => {
        const r = getDefaultContentFields('payment-confirmed', 'en')
        expect(r.subject).toBeTruthy()
        expect(r.greeting).toContain('{customerName}')
        expect(r.ctaLabel).toBeTruthy()
        expect(r.closing).toBeTruthy()
    })

    // ─── TC-GH-1433-10: seller templates prefill footer as closing ───────

    it('[TC-GH-1433-10] seller templates surface footer text as closing (display-only)', () => {
        for (const type of ['new-order-seller', 'contact-from-seller', 'newsletter-seller-digest'] as const) {
            const en = getDefaultContentFields(type, 'en')
            const ms = getDefaultContentFields(type, 'ms')
            // footer is not config-overridable, but is surfaced so the form mirrors the preview
            expect(en.closing).toBeTruthy()
            expect(en.closing).toContain('{brandName}')
            expect(ms.closing).toBeTruthy()
            expect(en.ctaLabel).toBeTruthy()
        }
    })

    // ─── TC-GH-1433-12: order templates with inline runtime subject still prefill ───

    it('[TC-GH-1433-12] order-confirmation/completed/bank-transfer have a subject default (manual config?.subject override)', () => {
        for (const type of ['order-confirmation', 'order-completed', 'bank-transfer-instructions'] as const) {
            const en = getDefaultContentFields(type, 'en')
            const ms = getDefaultContentFields(type, 'ms')
            // subject is overridable manually (not via fieldMap) → must be prefilled, not blank
            expect(en.subject).toBeTruthy()
            expect(ms.subject).toBeTruthy()
            // uses {brandName}+{orderNumber} tokens (vars-substituted at render → matches default)
            expect(en.subject).toContain('{brandName}')
            expect(en.subject).toContain('{orderNumber}')
            expect(en.subject).not.toBe(ms.subject) // locale-specific copy
        }
    })

    // ─── TC-GH-1433-13: exact MS seller subjects match the template default (anti-drift) ───

    it('[TC-GH-1433-13] seller MS subjects equal the template defaults.subject (not heroTitle)', () => {
        // contact-from-seller MS defaults.subject = `${shopName} - Penghantaran borang hubungi baharu daripada ${visitorName}`
        expect(getDefaultContentFields('contact-from-seller', 'ms').subject)
            .toBe('{brandName} - Penghantaran borang hubungi baharu daripada {visitorName}')
        // newsletter MS defaults.subject = `${shopName} - Pelanggan surat berita baharu: ${subscriberEmail}`
        expect(getDefaultContentFields('newsletter-seller-digest', 'ms').subject)
            .toBe('{brandName} - Pelanggan surat berita baharu: {subscriberEmail}')
    })

    // ─── TC-GH-1433-14: fields with non-tokenizable runtime data are omitted (no degraded save) ───

    it('[TC-GH-1433-14] new-order-seller + staff-invitation omit subjects that cannot round-trip', () => {
        // new-order-seller subject embeds customerName; greeting embeds recipientName — no matching vars
        const nos = getDefaultContentFields('new-order-seller', 'en')
        expect(nos.subject).toBeUndefined()
        expect(nos.greeting).toBeUndefined()
        expect(nos.ctaLabel).toBeTruthy() // static, overridable → kept
        // staff-invitation subject embeds workspaceName (no var token) → omitted; greeting kept
        const staff = getDefaultContentFields('staff-invitation', 'en')
        expect(staff.subject).toBeUndefined()
        expect(staff.greeting).toBe('Hello {inviteeName}')
    })

    // ─── TC-GH-1433-15: prefilled subject round-trips to the default preview render ───
    // Gold-standard invariant: feeding the prefilled subject back as a config override must
    // reproduce the exact subject the preview renders with no override. Catches wrong copy
    // (e.g. confirmed vs placed) AND non-substituting tokens in one shot.

    it('[TC-GH-1433-15] prefilled subject reproduces the default render for every locale', () => {
        for (const type of EMAIL_TEMPLATE_TYPES) {
            for (const locale of ['en', 'ms'] as const) {
                const def = getDefaultContentFields(type, locale)
                if (!def.subject) continue // blank subjects are intentionally omitted
                const fixture = { ...EMAIL_PREVIEW_FIXTURES[type], locale }
                const rendered = templateRegistry[type](fixture as never).subject
                const overridden = templateRegistry[type](fixture as never, { subject: def.subject } as never).subject
                expect(overridden, `${type}/${locale} subject prefill must round-trip`).toBe(rendered)
            }
        }
    })

    // ─── TC-GH-1433-11: all 17 types return an object without throwing ───

    it('[TC-GH-1433-11] all EMAIL_TEMPLATE_TYPES resolve without errors', () => {
        for (const type of EMAIL_TEMPLATE_TYPES) {
            expect(() => getDefaultContentFields(type, 'en')).not.toThrow()
            expect(() => getDefaultContentFields(type, 'ms')).not.toThrow()
        }
    })
})
