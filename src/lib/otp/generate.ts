import { randomInt, createHash } from 'crypto'

const OTP_LENGTH = 6
export const OTP_TTL_MS = process.env.NODE_ENV === 'production'
    ? 5 * 60 * 1000   // Production: 5 minutes
    : 30 * 60 * 1000  // Dev: 30 minutes (easy testing)

/** Minimum gap between two OTP sends for the same user. */
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000

/** Generate a random 6-digit OTP code. */
export function generateOTP(): string {
    const min = Math.pow(10, OTP_LENGTH - 1) // 100000
    const max = Math.pow(10, OTP_LENGTH) // 1000000
    return randomInt(min, max).toString()
}

/** Hash OTP using SHA-256 for secure storage. */
export function hashOTP(otp: string): string {
    return createHash('sha256').update(otp).digest('hex')
}

/** Verify a plain OTP against a stored hash. */
export function verifyOTP(plainOTP: string, storedHash: string): boolean {
    return hashOTP(plainOTP) === storedHash
}

/** Get expiry timestamp for OTP (5 minutes from now). */
export function getOTPExpiry(): Date {
    return new Date(Date.now() + OTP_TTL_MS)
}

/** Check if an OTP has expired. */
export function isOTPExpired(expiresAt: Date | string): boolean {
    const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
    return Date.now() > expiry.getTime()
}
