// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Top-level mocks with vi.hoisted ──────────────────────────────────

const { mockGetTemplateConfig } = vi.hoisted(() => ({
    mockGetTemplateConfig: vi.fn(),
}))

const { mockPayloadSendEmail } = vi.hoisted(() => ({
    mockPayloadSendEmail: vi.fn(),
}))

vi.mock('@/lib/email/get-template-config', () => ({
    getTemplateConfig: mockGetTemplateConfig,
}))

vi.mock('payload', () => ({
    getPayload: vi.fn(() =>
        Promise.resolve({
            sendEmail: mockPayloadSendEmail,
        }),
    ),
}))

vi.mock('@payload-config', () => ({ default: {} }))

// ─── Import after mocks ───────────────────────────────────────────────

import { sendEmail } from '@/lib/email/send'

// ─── TC-F32: Email Send Suppression ───────────────────────────────────

describe('sendEmail [TC-F32]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-S-01] enabled=false: returns false and suppresses payload.sendEmail call', async () => {
        // Arrange
        const to = 'user@example.com'
        const subject = 'Welcome'
        const html = '<p>Welcome!</p>'
        const tenantId = 'tenant-001'
        const templateType = 'welcome'
        const recipient = 'buyer'

        mockGetTemplateConfig.mockResolvedValue({
            enabled: false,
            subject: 'Welcome',
        })

        // Act
        const result = await sendEmail({
            to,
            subject,
            html,
            templateType,
            recipient,
            tenantId,
        })

        // Assert
        expect(result).toBe(false)
        expect(mockPayloadSendEmail).not.toHaveBeenCalled()
        expect(mockGetTemplateConfig).toHaveBeenCalledWith(tenantId, templateType, recipient)
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-S-02] enabled=true: calls payload.sendEmail', async () => {
        // Arrange
        const to = 'user@example.com'
        const subject = 'Order Confirmation'
        const html = '<p>Your order is confirmed</p>'
        const tenantId = 'tenant-002'
        const templateType = 'order-confirmation'
        const recipient = 'buyer'

        mockGetTemplateConfig.mockResolvedValue({
            enabled: true,
            subject: 'Order Confirmation',
        })

        mockPayloadSendEmail.mockResolvedValue(undefined)

        // Act
        const result = await sendEmail({
            to,
            subject,
            html,
            templateType,
            recipient,
            tenantId,
        })

        // Assert
        expect(result).toBe(true)
        expect(mockPayloadSendEmail).toHaveBeenCalledWith({
            to,
            subject,
            html,
        })
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-S-02.1] no templateType provided: calls payload.sendEmail without config check', async () => {
        // Arrange
        const to = 'user@example.com'
        const subject = 'Generic Email'
        const html = '<p>Generic content</p>'

        mockPayloadSendEmail.mockResolvedValue(undefined)

        // Act
        const result = await sendEmail({
            to,
            subject,
            html,
            // templateType, recipient, tenantId NOT provided
        })

        // Assert
        expect(result).toBe(true)
        expect(mockGetTemplateConfig).not.toHaveBeenCalled()
        expect(mockPayloadSendEmail).toHaveBeenCalledWith({
            to,
            subject,
            html,
        })
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-S-02.2] no config row found (null): calls payload.sendEmail', async () => {
        // Arrange
        const to = 'user@example.com'
        const subject = 'OTP'
        const html = '<p>Your OTP</p>'
        const tenantId = 'tenant-003'
        const templateType = 'otp-verification'
        const recipient = 'buyer'

        mockGetTemplateConfig.mockResolvedValue(null) // no row in DB

        mockPayloadSendEmail.mockResolvedValue(undefined)

        // Act
        const result = await sendEmail({
            to,
            subject,
            html,
            templateType,
            recipient,
            tenantId,
        })

        // Assert
        expect(result).toBe(true)
        expect(mockPayloadSendEmail).toHaveBeenCalled()
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-S-01.1] enabled=false with null config check: suppresses send (undefined !== false)', async () => {
        // Arrange
        const to = 'user@example.com'
        const subject = 'Test'
        const html = '<p>Test</p>'
        const tenantId = 'tenant-004'
        const templateType = 'payment-confirmed'
        const recipient = 'buyer'

        mockGetTemplateConfig.mockResolvedValue({
            enabled: false,
        })

        // Act
        const result = await sendEmail({
            to,
            subject,
            html,
            templateType,
            recipient,
            tenantId,
        })

        // Assert
        expect(result).toBe(false)
        expect(mockPayloadSendEmail).not.toHaveBeenCalled()
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-S-02.3] handles sendEmail error gracefully', async () => {
        // Arrange
        const to = 'user@example.com'
        const subject = 'Error Test'
        const html = '<p>Test</p>'
        const tenantId = 'tenant-005'
        const templateType = 'welcome'
        const recipient = 'buyer'

        mockGetTemplateConfig.mockResolvedValue({
            enabled: true,
        })

        mockPayloadSendEmail.mockRejectedValue(new Error('SMTP failed'))

        // Act
        const result = await sendEmail({
            to,
            subject,
            html,
            templateType,
            recipient,
            tenantId,
        })

        // Assert
        expect(result).toBe(false)
    })

    // ──────────────────────────────────────────────────────────────────

    it('[TC: F32-S-02.4] handles getTemplateConfig error gracefully', async () => {
        // Arrange
        const to = 'user@example.com'
        const subject = 'Config Error'
        const html = '<p>Test</p>'
        const tenantId = 'tenant-006'
        const templateType = 'order-shipped'
        const recipient = 'seller'

        mockGetTemplateConfig.mockRejectedValue(new Error('Redis connection failed'))

        mockPayloadSendEmail.mockResolvedValue(undefined)

        // Act
        const result = await sendEmail({
            to,
            subject,
            html,
            templateType,
            recipient,
            tenantId,
        })

        // Assert
        expect(result).toBe(false)
        expect(mockPayloadSendEmail).not.toHaveBeenCalled()
    })
})
