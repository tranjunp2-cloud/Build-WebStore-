// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    parseOtpSendFailure,
    seedOtpTimers,
    OTP_RESEND_END_KEY,
    OTP_EXPIRY_END_KEY,
} from '@/lib/auth/login-otp-cooldown'

describe('login-otp-cooldown (GH-2053)', () => {
    describe('parseOtpSendFailure', () => {
        // TC-F02.44
        it('classifies 429 + OTP_COOLDOWN as cooldown with retryAfter', () => {
            const body = { errors: [{ message: 'Please wait', code: 'OTP_COOLDOWN', retryAfter: 42, expiresIn: 1700 }] }
            expect(parseOtpSendFailure(429, body)).toEqual({ kind: 'cooldown', retryAfter: 42, expiresIn: 1700 })
        })

        it('falls back to 60s / 300s when retryAfter or expiresIn is missing or invalid', () => {
            expect(parseOtpSendFailure(429, { errors: [{ code: 'OTP_COOLDOWN' }] })).toEqual({ kind: 'cooldown', retryAfter: 60, expiresIn: 300 })
            expect(parseOtpSendFailure(429, { errors: [{ code: 'OTP_COOLDOWN', retryAfter: 'x', expiresIn: -1 }] })).toEqual({ kind: 'cooldown', retryAfter: 60, expiresIn: 300 })
        })

        it('treats 429 without the code as a plain failure', () => {
            expect(parseOtpSendFailure(429, { errors: [{ message: 'Too many' }] })).toEqual({ kind: 'failed' })
        })

        it('treats 500 and unparsable bodies as failures', () => {
            expect(parseOtpSendFailure(500, { errors: [{ code: 'OTP_COOLDOWN' }] })).toEqual({ kind: 'failed' })
            expect(parseOtpSendFailure(429, null)).toEqual({ kind: 'failed' })
        })
    })

    describe('seedOtpTimers', () => {
        beforeEach(() => sessionStorage.clear())
        afterEach(() => sessionStorage.clear())

        // TC-F02.44
        it('seeds resend end = now + retryAfter and expiry end = now + expiresIn', () => {
            const now = 1_000_000
            seedOtpTimers(30, 270, now)
            expect(sessionStorage.getItem(OTP_RESEND_END_KEY)).toBe(String(now + 30_000))
            expect(sessionStorage.getItem(OTP_EXPIRY_END_KEY)).toBe(String(now + 270_000))
        })
    })
})
