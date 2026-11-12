/**
 * Server check for the email reset flow (`/api/users/reset-password`, GH-2269).
 *
 * The reset form already blocks short passwords, but the endpoint can be called directly and
 * Payload's own validator only rejects fewer than 3 characters. Payload runs `beforeOperation`
 * before it looks up the token and hashes the new password, so a short one is never saved.
 *
 * Only `resetPassword` is checked: SSO provision/reset, the PW1 migration and the admin panel
 * write passwords through create/update, and SSO-managed passwords may be shorter.
 */
import { APIError, type CollectionBeforeOperationHook } from 'payload'
import { PASSWORD_MIN_LENGTH } from './password-rules'

export const enforceResetPasswordMinLength: CollectionBeforeOperationHook = ({ args, operation }) => {
    if (operation !== 'resetPassword') return args

    const password = (args as { data?: { password?: unknown } }).data?.password
    if (typeof password === 'string' && password.length < PASSWORD_MIN_LENGTH) {
        throw new APIError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`, 400)
    }
    return args
}
