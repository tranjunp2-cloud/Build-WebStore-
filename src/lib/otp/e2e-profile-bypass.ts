const PROFILE_STAFF_ALIAS = 'profile-staff'

export function deriveE2EProfileStaffEmail(ownerEmail: string): string {
    const normalized = ownerEmail.trim().toLowerCase()
    const at = normalized.lastIndexOf('@')

    if (at <= 0 || at === normalized.length - 1) {
        throw new Error('TEST_EMAIL must be a valid email address')
    }

    const local = normalized.slice(0, at)
    const domain = normalized.slice(at + 1)
    return `${local}+${PROFILE_STAFF_ALIAS}@${domain}`
}

export function isE2EProfileIdentity(
    email: string | undefined,
    ownerEmail: string | undefined,
): boolean {
    if (!email || !ownerEmail) return false

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedOwner = ownerEmail.trim().toLowerCase()

    try {
        return normalizedEmail === normalizedOwner
            || normalizedEmail === deriveE2EProfileStaffEmail(normalizedOwner)
    } catch {
        return false
    }
}

export function isValidE2EProfileOtp(
    email: string | undefined,
    otp: string,
    ownerEmail: string | undefined,
    expectedOtp: string | undefined,
    appEnv: string | undefined,
): boolean {
    return Boolean(
        appEnv === 'staging'
        && expectedOtp
        && otp === expectedOtp
        && isE2EProfileIdentity(email, ownerEmail),
    )
}
