// @vitest-environment node
/**
 * A super-admin password change in the admin panel also refreshes keyString (encrypted SSO password),
 * so outbound SSO calls use the new password.
 * TC-F02.59 – TC-F02.62 (docs/qa/F02-auth.md).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { CollectionBeforeChangeHook } from 'payload'
import { syncKeyStringOnPasswordUpdate } from '@/lib/auth/sync-key-string-on-password-update'
import { decryptPassword } from '@/lib/sso/sso-api-client'
import { Users } from '@/collections/Users'

type BeforeChangeArgs = Parameters<CollectionBeforeChangeHook>[0]
const TEST_KEY = 'a'.repeat(64)

const SUPER_ADMIN = { id: 1, roles: ['super-admin'] }

function run(data: Record<string, unknown>, operation: 'create' | 'update', user: unknown = SUPER_ADMIN) {
    const logger = { error: vi.fn() }
    const out = syncKeyStringOnPasswordUpdate({
        data,
        operation,
        req: { user, payload: { logger } },
    } as unknown as BeforeChangeArgs) as Record<string, unknown>
    return { out, logger }
}

describe('syncKeyStringOnPasswordUpdate (beforeChange)', () => {
    let savedKey: string | undefined
    beforeEach(() => {
        savedKey = process.env.SSO_ENCRYPTION_KEY
        process.env.SSO_ENCRYPTION_KEY = TEST_KEY
    })
    afterEach(() => {
        if (savedKey === undefined) delete process.env.SSO_ENCRYPTION_KEY
        else process.env.SSO_ENCRYPTION_KEY = savedKey
    })

    it('[TC-F02.59] sets keyString to the encrypted new password on update', () => {
        // Arrange
        const data = { password: 'NewPass1!', firstName: 'Ann' }

        // Act
        const { out } = run(data, 'update')

        // Assert
        expect(out.firstName).toBe('Ann')
        expect(typeof out.keyString).toBe('string')
        expect(decryptPassword(out.keyString as string)).toBe('NewPass1!')
    })

    it('[TC-F02.60] rebuilds keyString from the password even when the client sends one', () => {
        // Arrange
        const data = { password: 'NewPass1!', keyString: 'forged' }

        // Act
        const { out } = run(data, 'update')

        // Assert
        expect(decryptPassword(out.keyString as string)).toBe('NewPass1!')
    })

    it('[TC-F02.60] leaves data alone without a password or on create', () => {
        // Arrange
        const noPassword = { firstName: 'Ann' }
        const emptyPassword = { password: '' }
        const created = { password: 'NewPass1!' }

        // Act + Assert
        expect(run(noPassword, 'update').out).not.toHaveProperty('keyString')
        expect(run(emptyPassword, 'update').out).not.toHaveProperty('keyString')
        expect(run(created, 'create').out).not.toHaveProperty('keyString')
    })

    it('[TC-F02.60] leaves keyString alone when the caller is not a super-admin', () => {
        // Arrange
        const data = { password: 'TempPass1!' }
        const owner = { id: 2, roles: ['tenant-owner'] }

        // Act + Assert: user self-update, and server writes with no user (staff re-invite)
        expect(run(data, 'update', owner).out).not.toHaveProperty('keyString')
        expect(run(data, 'update', null).out).not.toHaveProperty('keyString')
    })

    it('[TC-F02.61] logs and still saves the password when encryption fails', () => {
        // Arrange
        delete process.env.SSO_ENCRYPTION_KEY
        const data = { password: 'NewPass1!' }

        // Act
        const { out, logger } = run(data, 'update')

        // Assert
        expect(out).toEqual({ password: 'NewPass1!' })
        expect(logger.error).toHaveBeenCalledTimes(1)
    })

    it('[TC-F02.62] is registered on the Users collection beforeChange', () => {
        // Arrange + Act
        const hooks = Users.hooks?.beforeChange ?? []

        // Assert
        expect(hooks).toContain(syncKeyStringOnPasswordUpdate)
    })
})
