import { describe, it, expect } from 'vitest'
import { EmailTemplateSettings } from '@/collections/EmailTemplateSettings'

// TC-F32.106 — GH-1520 Option D: native REST writes are super-admin only
const ownerReq = { user: { roles: ['tenant-owner'], tenants: [{ tenant: 't1' }] } } as never
const adminReq = { user: { roles: ['super-admin'] } } as never
const anonReq = { user: null } as never

describe('EmailTemplateSettings REST access [TC-F32.106]', () => {
    for (const op of ['create', 'update', 'delete'] as const) {
        it(`${op}: tenant-owner denied, anonymous denied, super-admin allowed`, async () => {
            // Arrange
            const access = EmailTemplateSettings.access![op]!
            // Act / Assert
            expect(await access({ req: ownerReq } as never)).toBe(false)
            expect(await access({ req: anonReq } as never)).toBe(false)
            expect(await access({ req: adminReq } as never)).toBe(true)
        })
    }

    it('read: tenant-owner stays tenant-scoped', async () => {
        const result = await EmailTemplateSettings.access!.read!({ req: ownerReq } as never)
        expect(result).toEqual({ tenant: { in: ['t1'] } })
    })
})
