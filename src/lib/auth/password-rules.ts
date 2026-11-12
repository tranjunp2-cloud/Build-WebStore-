/**
 * Shared password rules for the login, reset-password and Profile change-password forms,
 * plus the server check on `/api/users/reset-password` (GH-2269).
 * Change the minimum length here only.
 */
export const PASSWORD_MIN_LENGTH = 6

/**
 * Strength score 0–4 shown on the reset-password form: one point each for
 * the minimum length, an uppercase letter, a digit and a special character.
 */
export function getPasswordStrength(password: string): number {
    let score = 0
    if (password.length >= PASSWORD_MIN_LENGTH) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score
}
