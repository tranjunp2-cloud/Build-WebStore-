/**
 * TC-PERF-181 — /verify-otp "Resend code" when send-otp refuses: `429 OTP_RATE_LIMITED` shows the translated
 *   "too many codes" message with the server's retryAfter in minutes (not the server's English text) and holds the
 *   resend button for retryAfter; `429 OTP_COOLDOWN` only holds the button; any other failure → translated generic.
 * Real: verify-otp page, lib/auth/login-otp-cooldown.ts, collections/Users.ts send-otp error body, en.json.
 * Faked: fetch, next/navigation, sonner.
 */
import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import en from '@/i18n/locales/en.json'
import { OTP_EXPIRY_END_KEY, OTP_RESEND_END_KEY } from '@/lib/auth/login-otp-cooldown'

const mocks = vi.hoisted(() => ({ toastError: vi.fn(), toastWarning: vi.fn(), toastSuccess: vi.fn() }))

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    useSearchParams: () => new URLSearchParams('email=owner%40example.com'),
}))
vi.mock('sonner', () => ({
    toast: { error: mocks.toastError, info: vi.fn(), success: mocks.toastSuccess, warning: mocks.toastWarning },
}))
vi.mock('@/i18n', () => ({ useI18n: () => ({ t: en }) }))
vi.mock('@/components/LanguageSwitcher', () => ({ default: () => null }))

import VerifyOTPPage from '@/app/(auth)/verify-otp/page'

const SERVER_ENGLISH = 'Too many verification codes requested. Please try again later.'
const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fetchMock = vi.fn()

async function clickResend(): Promise<void> {
    await act(async () => {
        fireEvent.click(screen.getByText(en.auth.otp.resendCode))
    })
}

beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    // Resend already allowed, last code still valid for 4 min
    sessionStorage.setItem(OTP_RESEND_END_KEY, String(Date.now() - 1_000))
    sessionStorage.setItem(OTP_EXPIRY_END_KEY, String(Date.now() + 240_000))
    vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
})

describe('/verify-otp resend refused by send-otp [TC-PERF-181]', () => {
    it('429 OTP_RATE_LIMITED with a still-valid code → translated warning with minutes, button held for retryAfter', async () => {
        // Arrange
        fetchMock.mockResolvedValueOnce(jsonResponse(429, { errors: [{ message: SERVER_ENGLISH, code: 'OTP_RATE_LIMITED', retryAfter: 600, expiresIn: 200 }] }))
        render(<VerifyOTPPage />)

        // Act
        await clickResend()

        // Assert
        expect(mocks.toastWarning).toHaveBeenCalledWith(en.auth.otpRateLimitedTitle, {
            description: en.auth.otpRateLimitedDesc.replace('{minutes}', '10'),
        })
        expect(mocks.toastError).not.toHaveBeenCalled()
        expect(screen.getByText(`${en.auth.otp.resendCode} (${en.auth.otp.after} 600s)`)).toBeInTheDocument()
        expect(Number(sessionStorage.getItem(OTP_RESEND_END_KEY))).toBeGreaterThan(Date.now() + 590_000)
    })

    it('429 OTP_RATE_LIMITED without a usable code → translated "try again in N min" error, never the server English', async () => {
        // Arrange
        fetchMock.mockResolvedValueOnce(jsonResponse(429, { errors: [{ message: SERVER_ENGLISH, code: 'OTP_RATE_LIMITED', retryAfter: 90 }] }))
        render(<VerifyOTPPage />)

        // Act
        await clickResend()

        // Assert
        expect(mocks.toastError).toHaveBeenCalledWith(en.auth.errors.otpRateLimited.replace('{minutes}', '2'))
        expect(mocks.toastError).not.toHaveBeenCalledWith(SERVER_ENGLISH)
        expect(mocks.toastSuccess).not.toHaveBeenCalled()
    })

    it('429 OTP_COOLDOWN → no error toast, the button waits retryAfter seconds', async () => {
        // Arrange
        fetchMock.mockResolvedValueOnce(jsonResponse(429, { errors: [{ message: 'Please wait 42 seconds', code: 'OTP_COOLDOWN', retryAfter: 42, expiresIn: 250 }] }))
        render(<VerifyOTPPage />)

        // Act
        await clickResend()

        // Assert
        expect(mocks.toastError).not.toHaveBeenCalled()
        expect(screen.getByText(`${en.auth.otp.resendCode} (${en.auth.otp.after} 42s)`)).toBeInTheDocument()
    })

    it('other failures → translated generic resend error', async () => {
        // Arrange
        fetchMock.mockResolvedValueOnce(jsonResponse(500, { errors: [{ message: 'Internal Server Error' }] }))
        render(<VerifyOTPPage />)

        // Act
        await clickResend()

        // Assert
        expect(mocks.toastError).toHaveBeenCalledWith(en.auth.otp.resendFailed)
    })
})
