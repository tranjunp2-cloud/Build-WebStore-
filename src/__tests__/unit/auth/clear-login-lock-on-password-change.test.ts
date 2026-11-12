// @vitest-environment node
/**
 * GH-2053 follow-up — changing a password unlocks the account, so the user can sign in
 * right away instead of waiting out Payload's 15-minute lock.
 * TC-F02.49 – TC-F02.54 (docs/qa/F02-auth.md).
 */
import { describe, it, expect, vi } from 'vitest'
import type { CollectionAfterOperationHook, CollectionBeforeChangeHook } from 'payload'
import {
    clearLoginLockAfterPasswordReset,
    clearLoginLockOnPasswordUpdate,
} from '@/lib/auth/clear-login-lock-on-password-change'
import { Users } from '@/collections/Users'

type BeforeChangeArgs = Parameters<CollectionBeforeChangeHook>[0]
type AfterOperationArgs = Parameters<CollectionAfterOperationHook>[0]

const runBeforeChange = (data: Record<string, unknown>, operation: 'create' | 'update') =>
    clearLoginLockOnPasswordUpdate({ data, operation } as unknown as BeforeChangeArgs)

function makeAfterOperationArgs(operation: string, result: unknown, updateOne = vi.fn().mockResolvedValue(undefined)) {
    const logger = { error: vi.fn() }
    const args = {
        operation,
        result,
        collection: { slug: 'users' },
        req: { payload: { db: { updateOne }, logger } },
    } as unknown as AfterOperationArgs
    return { args, updateOne, logger }
}

describe('clearLoginLockOnPasswordUpdate (beforeChange)', () => {
    it('[TC-F02.49] clears the lock when a password is set on update', () => {
        // Arrange
        const data = { password: 'NewPass1!', firstName: 'Ann' }

        // Act
        const out = runBeforeChange(data, 'update')

        // Assert
        expect(out).toEqual({ password: 'NewPass1!', firstName: 'Ann', loginAttempts: 0, lockUntil: null })
    })

    it.each([
        ['update without password', { firstName: 'Ann' }, 'update'],
        ['update with empty password', { password: '' }, 'update'],
        ['create with password', { password: 'NewPass1!' }, 'create'],
    ] as const)('[TC-F02.50] leaves data unchanged: %s', (_label, data, operation) => {
        // Act
        const out = runBeforeChange({ ...data }, operation)

        // Assert
        expect(out).toEqual(data)
        expect(out).not.toHaveProperty('lockUntil')
    })
})

describe('clearLoginLockAfterPasswordReset (afterOperation)', () => {
    it('[TC-F02.51] clears the lock after a successful reset and returns the result', async () => {
        // Arrange
        const result = { token: 't', user: { id: 42 } }
        const { args, updateOne } = makeAfterOperationArgs('resetPassword', result)

        // Act
        const out = await clearLoginLockAfterPasswordReset(args)

        // Assert
        expect(updateOne).toHaveBeenCalledTimes(1)
        expect(updateOne).toHaveBeenCalledWith(expect.objectContaining({
            collection: 'users',
            id: 42,
            data: { loginAttempts: 0, lockUntil: null },
            req: args.req, // keeps the write in the caller's transaction, if any
        }))
        expect(out).toBe(result)
    })

    it.each([
        ['login', { user: { id: 42 } }],
        ['update', { docs: [] }],
        ['forgotPassword', 'token'],
        ['resetPassword', { token: 't', user: null }],
    ])('[TC-F02.52] does not touch the lock for %s', async (operation, result) => {
        // Arrange
        const { args, updateOne } = makeAfterOperationArgs(operation, result)

        // Act
        const out = await clearLoginLockAfterPasswordReset(args)

        // Assert
        expect(updateOne).not.toHaveBeenCalled()
        expect(out).toBe(result)
    })

    it('[TC-F02.53] logs and still returns the result when clearing fails', async () => {
        // Arrange
        const result = { token: 't', user: { id: 7 } }
        const { args, logger } = makeAfterOperationArgs('resetPassword', result, vi.fn().mockRejectedValue(new Error('db down')))

        // Act
        const out = await clearLoginLockAfterPasswordReset(args)

        // Assert
        expect(out).toBe(result)
        expect(logger.error).toHaveBeenCalledTimes(1)
    })
})

describe('Users collection wiring', () => {
    it('[TC-F02.54] registers both unlock hooks', () => {
        // Arrange
        const hooks = Users.hooks

        // Act
        const beforeChange = hooks?.beforeChange ?? []
        const afterOperation = hooks?.afterOperation ?? []

        // Assert
        expect(beforeChange).toContain(clearLoginLockOnPasswordUpdate)
        expect(afterOperation).toContain(clearLoginLockAfterPasswordReset)
    })
})
