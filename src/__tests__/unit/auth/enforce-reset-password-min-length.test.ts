// @vitest-environment node
/**
 * GH-2269 — `/api/users/reset-password` rejects passwords shorter than 6 characters on the
 * server, so the email reset flow cannot be bypassed by calling the API directly.
 * TC-F02.69 – TC-F02.70 (docs/qa/F02-auth.md).
 */
import { describe, it, expect } from 'vitest'
import { APIError, type CollectionBeforeOperationHook } from 'payload'
import { enforceResetPasswordMinLength } from '@/lib/auth/enforce-reset-password-min-length'
import { Users } from '@/collections/Users'

type BeforeOperationArgs = Parameters<CollectionBeforeOperationHook>[0]

const run = (operation: string, data: Record<string, unknown>) => {
    const args = { data, collection: { slug: 'users' } }
    const out = enforceResetPasswordMinLength({ args, operation } as unknown as BeforeOperationArgs)
    return { args, out }
}

describe('enforceResetPasswordMinLength (beforeOperation)', () => {
    it('[TC-F02.69] resetPassword with a 5-character password → APIError 400', () => {
        // Act
        let error: unknown
        try {
            run('resetPassword', { token: 't', password: 'Ab1!x' })
        } catch (e) {
            error = e
        }

        // Assert
        expect(error).toBeInstanceOf(APIError)
        expect((error as APIError).status).toBe(400)
        expect((error as APIError).message).toBe('Password must be at least 6 characters')
    })

    it('[TC-F02.69] resetPassword with a 6-character password → args passed through', () => {
        // Act
        const { args, out } = run('resetPassword', { token: 't', password: 'Ab1!xy' })

        // Assert
        expect(out).toBe(args)
    })

    it('[TC-F02.69] create / update with a short password are not blocked (SSO, PW1, admin writes)', () => {
        for (const operation of ['create', 'update']) {
            // Act
            const { args, out } = run(operation, { password: 'abc' })

            // Assert
            expect(out).toBe(args)
        }
    })

    it('[TC-F02.69] resetPassword without a string password is left to Payload', () => {
        // Act
        const { args, out } = run('resetPassword', { token: 't' })

        // Assert
        expect(out).toBe(args)
    })
})

describe('Users collection wiring', () => {
    it('[TC-F02.70] registers the reset-password length check in beforeOperation', () => {
        expect(Users.hooks?.beforeOperation ?? []).toContain(enforceResetPasswordMinLength)
    })
})
