/**
 * GH-2305: map the English messages returned by POST /api/users/invite-staff (src/collections/Users.ts) to
 * translated copy, so the drawer never shows a raw server or Payload message. Email problems go under the
 * Email field; anything else is a toast. Unknown messages fall back to the generic "Couldn't send the invite".
 */
export type InviteStaffError =
    | { target: 'email'; key: 'errorEmailInvalid' | 'errorEmailTooLong' | 'errorSelfInvite' | 'errorAlreadyMember' | 'errorOwnerElsewhere' }
    | { target: 'toast'; key: 'inviteLimitReached' | 'inviteNotAllowed' | 'inviteFailed' }

const RULES: Array<[RegExp, InviteStaffError]> = [
    [/already a member of this workspace/i, { target: 'email', key: 'errorAlreadyMember' }],
    [/owner of another workspace/i, { target: 'email', key: 'errorOwnerElsewhere' }],
    [/must not exceed 254 characters/i, { target: 'email', key: 'errorEmailTooLong' }],
    [/cannot invite yourself/i, { target: 'email', key: 'errorSelfInvite' }],
    // Payload ValidationError on the users email field, or the endpoint's own format check
    [/field is invalid: email|invalid email/i, { target: 'email', key: 'errorEmailInvalid' }],
    [/staff limit reached/i, { target: 'toast', key: 'inviteLimitReached' }],
    [/^forbidden$|only an owner can invite/i, { target: 'toast', key: 'inviteNotAllowed' }],
]

const FALLBACK: InviteStaffError = { target: 'toast', key: 'inviteFailed' }

export function classifyInviteStaffError(message: string | undefined): InviteStaffError {
    if (!message) return FALLBACK
    return RULES.find(([pattern]) => pattern.test(message))?.[1] ?? FALLBACK
}
