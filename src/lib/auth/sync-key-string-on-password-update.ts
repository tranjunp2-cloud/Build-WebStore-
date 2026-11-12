/**
 * Keep `keyString` (the encrypted SSO password used for outbound SSO calls) in step with
 * the login password when a super-admin sets a user's password (admin panel, REST or GraphQL),
 * e.g. after the owner changed it on SSO and the new one was not migrated.
 * The password set must be the user's real SSO password: a temporary one would break outbound SSO calls.
 *
 * Only a super-admin caller triggers it: the admin knows the user's current SSO password.
 * Other password writes must not touch keyString, because they do not change the SSO
 * password (staff re-invite temp password, a user PATCHing their own record).
 * The SSO reset and Profile routes write their own keyString with no req.user, so they are skipped.
 * A keyString sent by the client is ignored: it is always rebuilt from the new password.
 */
import type { CollectionBeforeChangeHook } from 'payload'
import { encryptPassword } from '@/lib/sso/sso-api-client'

export const syncKeyStringOnPasswordUpdate: CollectionBeforeChangeHook = ({ data, operation, originalDoc, req }) => {
    if (operation !== 'update' || typeof data?.password !== 'string' || !data.password) return data
    if (!req.user?.roles?.includes('super-admin')) return data

    try {
        return { ...data, keyString: encryptPassword(data.password) }
    } catch (err) {
        // Missing/invalid SSO_ENCRYPTION_KEY must not block the password change itself.
        req.payload.logger.error({ err, userId: originalDoc?.id }, '[auth] keyString encryption failed on password update')
        return data
    }
}
