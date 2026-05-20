import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendEmail = vi.fn()
vi.mock('payload', () => ({
    getPayload: vi.fn(() => Promise.resolve({ sendEmail: mockSendEmail })),
}))
vi.mock('@payload-config', () => ({ default: {} }))

import { sendEmail } from '@/lib/email/send'

// ─── TC-F02: Email sending utility ───────────────────────────────────

describe('sendEmail', () => {
    beforeEach(() => vi.clearAllMocks())

    it('returns true on success', async () => {
        mockSendEmail.mockResolvedValue(undefined)

        const result = await sendEmail({
            to: 'test@example.com',
            subject: 'Test',
            html: '<p>Hello</p>',
        })

        expect(result).toBe(true)
        expect(mockSendEmail).toHaveBeenCalledWith({
            to: 'test@example.com',
            subject: 'Test',
            html: '<p>Hello</p>',
        })
    })

    it('returns false on failure', async () => {
        mockSendEmail.mockRejectedValue(new Error('SMTP error'))

        const result = await sendEmail({
            to: 'test@example.com',
            subject: 'Test',
            html: '<p>Hello</p>',
        })

        expect(result).toBe(false)
    })
})
