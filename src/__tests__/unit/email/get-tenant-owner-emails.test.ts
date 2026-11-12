/**
 * Unit Tests: getTenantOwnerEmails — optional role filter (GH-2157)
 * TC-ID: TC-F04.CS.27..28. Convention: docs/TEST_CONVENTION.md
 */
import { describe, it, expect, vi } from 'vitest'
import { getTenantOwnerEmails } from '@/lib/email/get-tenant-owner-emails'

const makePayload = (docs: Array<{ email?: string }>) => ({ find: vi.fn().mockResolvedValue({ docs }) })

describe('getTenantOwnerEmails', () => {
	it('TC-F04.CS.27 — without roles: every member (order-email behaviour unchanged)', async () => {
		const payload = makePayload([{ email: 'a@x.com' }, { email: 'b@x.com' }])

		const res = await getTenantOwnerEmails(payload as never, 5)

		expect(res).toEqual(['a@x.com', 'b@x.com'])
		const where = payload.find.mock.calls[0][0].where.and
		expect(where).toHaveLength(2)
		expect(JSON.stringify(where)).not.toContain('tenants.role')
	})

	it('TC-F04.CS.28 — with roles: filters by tenant role AND active status; [] on error', async () => {
		const payload = makePayload([{ email: 'o@x.com' }])

		await getTenantOwnerEmails(payload as never, 5, ['owner'])

		const where = payload.find.mock.calls[0][0].where.and
		expect(where).toContainEqual({ 'tenants.role': { in: ['owner'] } })
		expect(where).toContainEqual({ 'tenants.status': { equals: 'active' } })

		const failing = { find: vi.fn().mockRejectedValue(new Error('db')) }
		expect(await getTenantOwnerEmails(failing as never, 5, ['owner'])).toEqual([])
	})
})
