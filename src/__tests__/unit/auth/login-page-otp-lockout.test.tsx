/**
 * Login page: OTP cooldown handoff + account lockout (GH-2053)
 * TC-IDs: TC-F02.47, TC-F02.48 (docs/qa/F02-auth.md)
 * Convention: docs/TEST_CONVENTION.md
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import en from '@/i18n/locales/en.json'
import { OTP_EXPIRY_END_KEY, OTP_RESEND_END_KEY } from '@/lib/auth/login-otp-cooldown'

const mocks = vi.hoisted(() => ({
    replace: vi.fn(),
    toastError: vi.fn(),
    toastInfo: vi.fn(),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}))

vi.mock('sonner', () => ({
    toast: { error: mocks.toastError, info: mocks.toastInfo, success: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/i18n', () => ({
    useI18n: () => ({ t: en }),
}))

vi.mock('@/components/LanguageSwitcher', () => ({ default: () => null }))

import LoginPage from '@/app/(auth)/login/page'

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function submitLogin(): void {
    fireEvent.change(screen.getByLabelText(en.auth.email), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText(en.auth.password), { target: { value: 'Aa123456@' } })
    fireEvent.click(screen.getByRole('button', { name: en.auth.signIn }))
}

describe('[GH-2053] login page OTP cooldown + lockout', () => {
    const fetchMock = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        sessionStorage.clear()
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        fetchMock.mockReset()
    })

    it('TC-F02.47: send-otp 429 OTP_COOLDOWN → seeds timers and goes to /verify-otp, no connection error', async () => {
        // Arrange
        fetchMock
            .mockResolvedValueOnce(jsonResponse(200, { user: { roles: ['tenant-owner'], tenants: [{ tenant: { onboardingCompleted: true } }] } }))
            .mockResolvedValueOnce(jsonResponse(429, { errors: [{ code: 'OTP_COOLDOWN', retryAfter: 42, expiresIn: 280 }] }))
        render(<LoginPage />)

        // Act
        submitLogin()

        // Assert
        await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(expect.stringContaining('/verify-otp?email=owner%40example.com')))
        expect(mocks.toastError).not.toHaveBeenCalled()
        expect(mocks.toastInfo).toHaveBeenCalledWith(en.auth.otpAlreadySentTitle, { description: en.auth.otpAlreadySentDesc })
        const resendEnd = Number(sessionStorage.getItem(OTP_RESEND_END_KEY))
        const expiryEnd = Number(sessionStorage.getItem(OTP_EXPIRY_END_KEY))
        expect(expiryEnd - resendEnd).toBeGreaterThan(230_000)
        expect(expiryEnd - resendEnd).toBeLessThan(240_000)
    })

    it('TC-F02.48: login 423 ACCOUNT_LOCKED → locked message, password field not refocused', async () => {
        // Arrange
        fetchMock.mockResolvedValueOnce(jsonResponse(423, { errors: [{ message: 'Account locked', code: 'ACCOUNT_LOCKED' }] }))
        render(<LoginPage />)

        // Act
        submitLogin()

        // Assert
        await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(en.auth.errors.accountLocked))
        expect(mocks.toastError).not.toHaveBeenCalledWith(en.auth.errors.incorrect)
        expect(screen.getByLabelText(en.auth.password)).not.toHaveFocus()
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(mocks.replace).not.toHaveBeenCalled()
    })
})
