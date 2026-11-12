/**
 * Unit Tests: notifyContactLead — owner email (F32 contact-from-seller) + LEAD_NEW bell
 * TC-ID: TC-F04.CS.21..26 (GH-2157). Convention: docs/TEST_CONVENTION.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetOwners = vi.fn()
const mockGetConfig = vi.fn()
const mockNotifyOwners = vi.fn()
vi.mock('@/lib/email/get-tenant-owner-emails', () => ({ getTenantOwnerEmails: (...a: unknown[]) => mockGetOwners(...a) }))
vi.mock('@/lib/email/get-template-config', () => ({ getTemplateConfig: (...a: unknown[]) => mockGetConfig(...a) }))
vi.mock('@/lib/notifications/notify-tenant-owners', () => ({ notifyTenantOwners: (...a: unknown[]) => mockNotifyOwners(...a) }))

import { notifyContactLead } from '@/lib/contact/notify-contact-lead'

const sendEmail = vi.fn()
const payload = { sendEmail } as never
const input = {
	tenantId: 7, submissionId: 42, siteName: 'Aurora', locale: 'en' as const,
	name: 'John <b>Doe</b>', email: 'john@example.com', phone: '0123', message: 'Hello\nthere',
}

beforeEach(() => {
	vi.clearAllMocks()
	process.env.NEXT_PUBLIC_SERVER_URL = 'https://app.example.com'
	mockGetConfig.mockResolvedValue(null)
	mockGetOwners.mockResolvedValue(['o1@example.com', 'o2@example.com'])
	mockNotifyOwners.mockResolvedValue(undefined)
	sendEmail.mockResolvedValue(true)
})

describe('notifyContactLead', () => {
	it('TC-F04.CS.21 — emails every active owner with the F32 template linking /contact-leads', async () => {
		await notifyContactLead(payload, input)

		expect(mockGetOwners).toHaveBeenCalledWith(payload, 7, ['owner'])
		expect(mockGetConfig).toHaveBeenCalledWith(7, 'contact-from-seller', 'seller', 'en')
		expect(sendEmail).toHaveBeenCalledTimes(2)
		const mail = sendEmail.mock.calls[0][0]
		expect(mail.to).toBe('o1@example.com')
		expect(mail.html).toContain('https://app.example.com/contact-leads')
		expect(mail.html).not.toContain('/admin/collections')
		expect(mail.html).not.toContain('<b>Doe</b>') // visitor input escaped
	})

	it('TC-F04.CS.22 — tenant disabled the template → no email, bell still sent', async () => {
		mockGetConfig.mockResolvedValue({ enabled: false })

		await notifyContactLead(payload, input)

		expect(sendEmail).not.toHaveBeenCalled()
		expect(mockNotifyOwners).toHaveBeenCalledTimes(1)
	})

	it('TC-F04.CS.23 — no active owner → no email, warn, no throw', async () => {
		mockGetOwners.mockResolvedValue([])
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

		await expect(notifyContactLead(payload, input)).resolves.toBeUndefined()

		expect(sendEmail).not.toHaveBeenCalled()
		expect(warn).toHaveBeenCalledWith('[Contact Lead] no active owner to email', { tenantId: 7 })
	})

	it('TC-F04.CS.24 — bell: LEAD_NEW, /contact-leads, dedupe by submission id, no visitor PII in metadata', async () => {
		await notifyContactLead(payload, input)

		const [, tenantId, data] = mockNotifyOwners.mock.calls[0]
		expect(tenantId).toBe(7)
		expect(data).toMatchObject({ type: 'LEAD_NEW', actionUrl: '/contact-leads', dedupeKey: 'LEAD_NEW:42' })
		expect(data.metadata).toEqual({ name: input.name, siteName: 'Aurora' })
		expect(JSON.stringify(data)).not.toContain('john@example.com')
		expect(JSON.stringify(data)).not.toContain('0123')
	})

	it('TC-F04.CS.25 — one email failing does not stop the other owner or the bell', async () => {
		sendEmail.mockRejectedValueOnce(new Error('ses'))
		vi.spyOn(console, 'error').mockImplementation(() => {})

		await expect(notifyContactLead(payload, input)).resolves.toBeUndefined()

		expect(sendEmail).toHaveBeenCalledTimes(2)
		expect(mockNotifyOwners).toHaveBeenCalledTimes(1)
	})

	it('TC-F04.CS.26 — bell failure does not stop the email', async () => {
		mockNotifyOwners.mockRejectedValue(new Error('db'))
		vi.spyOn(console, 'error').mockImplementation(() => {})

		await expect(notifyContactLead(payload, input)).resolves.toBeUndefined()

		expect(sendEmail).toHaveBeenCalledTimes(2)
	})

	it('TC-F04.CS.29 — Subject header is plain text (no HTML entities), html body stays escaped', async () => {
		await notifyContactLead(payload, { ...input, siteName: 'Tom & Co', name: 'A <b>B</b> & "C"' })

		const mail = sendEmail.mock.calls[0][0]
		expect(mail.subject).toBe('Tom & Co - New enquiry from A <b>B</b> & "C"')
		expect(mail.subject).not.toMatch(/&(amp|lt|gt|quot|#x27);/)
		expect(mail.html).not.toContain('<b>B</b>')
	})

	it('TC-F04.CS.32 — base URL: trailing slash trimmed; missing env warns but the mail is still sent', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		process.env.NEXT_PUBLIC_SERVER_URL = 'https://app.example.com/'
		await notifyContactLead(payload, input)
		expect(sendEmail.mock.calls[0][0].html).toContain('https://app.example.com/contact-leads')
		expect(sendEmail.mock.calls[0][0].html).not.toContain('com//contact-leads')
		expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('NEXT_PUBLIC_SERVER_URL'), expect.anything())

		sendEmail.mockClear()
		delete process.env.NEXT_PUBLIC_SERVER_URL
		await notifyContactLead(payload, input)
		expect(sendEmail).toHaveBeenCalledTimes(2)
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('NEXT_PUBLIC_SERVER_URL'), expect.anything())
		warn.mockRestore()
	})

	it('TC-F04.CS.30 — CR/LF in the visitor name or site name is flattened in subject and bell title', async () => {
		await notifyContactLead(payload, { ...input, name: 'Evil\r\nBcc: x@y.com', siteName: 'Shop\r\nBcc: z@y.com' })

		expect(sendEmail.mock.calls[0][0].subject).not.toMatch(/[\r\n]/)
		expect(mockNotifyOwners.mock.calls[0][2].title).not.toMatch(/[\r\n]/)
	})
})
