// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import type { PayloadRequest } from 'payload'
import { Users } from '@/collections/Users'
import { Tenants } from '@/collections/Tenants'
import { signMerchantSessionToken } from '@/lib/support/merchant-access-token'

const user = { id: 1, roles: ['tenant-owner'], tenants: [{ tenant: 5, role: 'owner', status: 'active' }] }
beforeEach(() => { process.env.PAYLOAD_SECRET = 'collection-access-test-secret' })

describe('[TC-F15.38/39/40] collection REST update access', () => {
    for (const collection of [Users, Tenants]) {
        it.each([false, true])(`${collection.slug} refuses impersonation (encoded cookie: %s)`, async (encoded) => {
            // Arrange — exercise the collection access actually used by Payload PATCH.
            const token = await signMerchantSessionToken({ id: 1, email: 'owner@example.test' }, 7)
            const req = { user, headers: new Headers({ cookie: `payload-token=${encoded ? token.replaceAll('.', '%2E') : token}` }) } as PayloadRequest
            // Act
            const result = await collection.access!.update!({ req, id: collection === Users ? 1 : 5, data: {} })
            // Assert
            expect(result).toBe(false)
        })
        it(`${collection.slug} keeps normal owner updates scoped to their document`, async () => {
            // Arrange
            const req = { user, headers: new Headers() } as PayloadRequest
            // Act
            const result = await collection.access!.update!({ req, id: collection === Users ? 1 : 5, data: {} })
            // Assert
            expect(result).toEqual(collection === Users ? { id: { equals: 1 } } : { id: { in: [5] } })
        })
    }
})
