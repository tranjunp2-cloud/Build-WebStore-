/**
 * Unlock an account when its password changes (GH-2053).
 *
 * Payload locks a user after `maxLoginAttempts` failures and only clears the lock on a
 * successful login — which the lock itself blocks. Neither the reset-password operation
 * nor `payload.update({ password })` clears it, so a user who resets their password
 * (as the lockout message suggests) would still be locked for the full `lockTime`.
 */
import type { CollectionAfterOperationHook, CollectionBeforeChangeHook } from 'payload'

const UNLOCKED = { loginAttempts: 0, lockUntil: null } as const

/**
 * beforeChange: a password set through `payload.update` (SSO reset, Profile change,
 * admin panel) also clears the lock, in the same database write.
 */
export const clearLoginLockOnPasswordUpdate: CollectionBeforeChangeHook = ({ data, operation }) => {
    if (operation !== 'update' || typeof data?.password !== 'string' || !data.password) return data
    return { ...data, ...UNLOCKED }
}

/**
 * afterOperation: the email reset flow (`/api/users/reset-password`) skips beforeChange,
 * so clear the lock once the reset has succeeded. A bad or expired token throws before
 * this runs. A failure here is only logged: the password is already changed, and the
 * user falls back to waiting out the lock.
 */
export const clearLoginLockAfterPasswordReset: CollectionAfterOperationHook = async (arg) => {
    if (arg.operation !== 'resetPassword') return arg.result

    const { collection, req, result } = arg
    const userId = result?.user?.id
    if (typeof userId !== 'string' && typeof userId !== 'number') return result

    try {
        await req.payload.db.updateOne({
            collection: collection.slug,
            id: userId,
            data: UNLOCKED,
            req,
            returning: false,
        })
    } catch (err) {
        req.payload.logger.error({ err, userId }, '[auth] failed to clear login lock after password reset')
    }
    return result
}
