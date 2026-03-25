import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateOTP, hashOTP, verifyOTP, getOTPExpiry, isOTPExpired } from '@/lib/otp/generate'

// ─── TC-F02.23: OTP Generation (6-digit random code) ───────────────────
describe('generateOTP', () => {
    it('returns a 6-digit numeric string', () => {
        const otp = generateOTP()
        expect(otp).toMatch(/^\d{6}$/)
    })

    it('returns different codes on multiple calls (not static)', () => {
        const otps = new Set(Array.from({ length: 20 }, () => generateOTP()))
        // With 20 calls, at least 2 should differ (statistically near-certain)
        expect(otps.size).toBeGreaterThan(1)
    })

    it('never returns a code shorter than 6 digits (no leading-zero truncation)', () => {
        for (let i = 0; i < 100; i++) {
            const otp = generateOTP()
            expect(otp.length).toBe(6)
            expect(Number(otp)).toBeGreaterThanOrEqual(100000)
            expect(Number(otp)).toBeLessThan(1000000)
        }
    })
})

// ─── TC-F02.23: OTP Hashing (SHA-256 secure storage) ───────────────────
describe('hashOTP', () => {
    it('returns a 64-char hex string (SHA-256)', () => {
        const hash = hashOTP('123456')
        expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('produces deterministic hash for same input', () => {
        const hash1 = hashOTP('654321')
        const hash2 = hashOTP('654321')
        expect(hash1).toBe(hash2)
    })

    it('produces different hash for different inputs', () => {
        const hash1 = hashOTP('123456')
        const hash2 = hashOTP('654321')
        expect(hash1).not.toBe(hash2)
    })

    it('never stores plain OTP (hash !== input)', () => {
        const otp = '377528'
        const hash = hashOTP(otp)
        expect(hash).not.toBe(otp)
        expect(hash).not.toContain(otp)
    })
})

// ─── TC-F02.23, TC-F02.24: OTP Verification ────────────────────────────
describe('verifyOTP', () => {
    it('returns true for matching OTP (TC-F02.23: happy path)', () => {
        const otp = '377528'
        const hash = hashOTP(otp)
        expect(verifyOTP(otp, hash)).toBe(true)
    })

    it('returns false for wrong OTP code (TC-F02.24: mismatch check)', () => {
        const correctOtp = '377528'
        const wrongOtp = '000000'
        const hash = hashOTP(correctOtp)
        expect(verifyOTP(wrongOtp, hash)).toBe(false)
    })

    it('returns false for partially matching OTP', () => {
        const hash = hashOTP('377528')
        expect(verifyOTP('377529', hash)).toBe(false)
        expect(verifyOTP('37752', hash)).toBe(false)
    })

    it('returns false for empty string OTP', () => {
        const hash = hashOTP('123456')
        expect(verifyOTP('', hash)).toBe(false)
    })
})

// ─── TC-F02.25: OTP Expiry (5-minute TTL) ──────────────────────────────
describe('getOTPExpiry', () => {
    it('returns a Date ~5 minutes in the future', () => {
        const before = Date.now()
        const expiry = getOTPExpiry()
        const after = Date.now()

        const expectedMin = before + 5 * 60 * 1000
        const expectedMax = after + 5 * 60 * 1000

        expect(expiry.getTime()).toBeGreaterThanOrEqual(expectedMin)
        expect(expiry.getTime()).toBeLessThanOrEqual(expectedMax)
    })

    it('returns a Date object', () => {
        expect(getOTPExpiry()).toBeInstanceOf(Date)
    })
})

describe('isOTPExpired', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns false for a future expiry (OTP still valid)', () => {
        const futureDate = new Date(Date.now() + 60 * 1000) // 1 min ahead
        expect(isOTPExpired(futureDate)).toBe(false)
    })

    it('returns true for a past expiry (TC-F02.25: expired after 5 min)', () => {
        const pastDate = new Date(Date.now() - 1000) // 1 sec ago
        expect(isOTPExpired(pastDate)).toBe(true)
    })

    it('handles ISO string input (DB serialization)', () => {
        const pastString = new Date(Date.now() - 10000).toISOString()
        expect(isOTPExpired(pastString)).toBe(true)

        const futureString = new Date(Date.now() + 60000).toISOString()
        expect(isOTPExpired(futureString)).toBe(false)
    })

    it('simulates 5-min TTL expiry correctly', () => {
        vi.useFakeTimers()
        const expiry = getOTPExpiry()

        // At T=0, not expired
        expect(isOTPExpired(expiry)).toBe(false)

        // At T=4min, not expired
        vi.advanceTimersByTime(4 * 60 * 1000)
        expect(isOTPExpired(expiry)).toBe(false)

        // At T=5min+1ms, expired
        vi.advanceTimersByTime(1 * 60 * 1000 + 1)
        expect(isOTPExpired(expiry)).toBe(true)
    })
})
