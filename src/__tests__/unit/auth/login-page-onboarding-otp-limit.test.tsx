/**
 * Login page after the PR #1996 response trim and OTP send limits.
 * TC-PERF-180 — the real `/api/users/login` answer (`publicUser`) still tells the page an owner has not finished
 *   onboarding, so they land on /onboarding (via /verify-otp?returnUrl=/onboarding), not /dashboard.
 * TC-PERF-181 — send-otp `429 OTP_RATE_LIMITED`: with a still-valid code → /verify-otp with seeded timers and a
 *   warning; without one → a "try again in N min" message, the page stays on /login.
 * Real: login page, lib/auth/login-otp-cooldown.ts, collections/Users.ts login endpoint (publicUser), en.json.
 * Faked: fetch (answers with the real login endpoint's body), next/navigation, sonner, Payload login.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import en from '@/i18n/locales/en.json'
import { Users } from '@/collections/Users'
import { OTP_EXPIRY_END_KEY, OTP_RESEND_END_KEY } from '@/lib/auth/login-otp-cooldown'

const mocks = vi.hoisted(() => ({ replace: vi.fn(), toastError: vi.fn(), toastWarning: vi.fn() }))

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}))
vi.mock('sonner', () => ({
    toast: { error: mocks.toastError, info: vi.fn(), success: vi.fn(), warning: mocks.toastWarning },
}))
vi.mock('@/i18n', () => ({ useI18n: () => ({ t: en }) }))
vi.mock('@/components/LanguageSwitcher', () => ({ default: () => null }))

import LoginPage from '@/app/(auth)/login/page'

const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** The login endpoint's real answer for a user `payload.login` returned at its default depth (tenant row populated). */
async function realLoginResponse(tenant: Record<string, unknown>): Promise<Response> {
    const login = (Users.endpoints || []).find((e) => e.path === '/login' && e.method === 'post')!
    const user = { id: 9, email: 'owner@example.com', roles: ['tenant-owner'], otpHash: 'a'.repeat(64),
        tenants: [{ id: 'm1', role: 'owner', status: 'active', tenant }] }
    const req = {
        json: async () => ({ email: 'owner@example.com', password: 'Aa123456@' }),
        payload: { login: vi.fn(async () => ({ user, token: 'payload-token' })), find: vi.fn(async () => ({ docs: [] })) },
    }
    return (login.handler as (r: unknown) => Promise<Response>)(req)
}

function submitLogin(): void {
    fireEvent.change(screen.getByLabelText(en.auth.email), { target: { value: 'owner@example.com' } })
    fireEvent.change(screen.getByLabelText(en.auth.password), { target: { value: 'Aa123456@' } })
    fireEvent.click(screen.getByRole('button', { name: en.auth.signIn }))
}

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

describe('login sends an unfinished owner to onboarding [TC-PERF-180]', () => {
    const shopRow = { id: 1, name: 'Kedai', slug: 'kedai', xenditSecretKey: 'xnd_secret', echIntegration: { apiKey: 'ech' } }

    it('the login response keeps onboardingCompleted, and only that, next to id/name/slug', async () => {
        const body = (await (await realLoginResponse({ ...shopRow, onboardingCompleted: false })).json()) as { user: { tenants: unknown[] } }

        expect(body.user.tenants).toEqual([{ id: 'm1', role: 'owner', status: 'active', tenant: { id: 1, name: 'Kedai', slug: 'kedai', onboardingCompleted: false } }])
        expect(JSON.stringify(body)).not.toMatch(/xnd_secret|"ech"|a{64}/)
    })

    it('onboardingCompleted false → /verify-otp with returnUrl=/onboarding', async () => {
        fetchMock
            .mockResolvedValueOnce(await realLoginResponse({ ...shopRow, onboardingCompleted: false }))
            .mockResolvedValueOnce(jsonResponse(200, { emailSent: true }))
        render(<LoginPage />)

        submitLogin()

        await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/verify-otp?email=owner%40example.com&returnUrl=%2Fonboarding'))
    })

    it('onboardingCompleted true → /verify-otp to the dashboard', async () => {
        fetchMock
            .mockResolvedValueOnce(await realLoginResponse({ ...shopRow, onboardingCompleted: true }))
            .mockResolvedValueOnce(jsonResponse(200, { emailSent: true }))
        render(<LoginPage />)

        submitLogin()

        await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/verify-otp?email=owner%40example.com'))
    })
})

describe('login page on send-otp OTP_RATE_LIMITED [TC-PERF-181]', () => {
    const loggedIn = () => jsonResponse(200, { user: { roles: ['tenant-owner'], tenants: [{ tenant: { onboardingCompleted: true } }] } })

    it('a code that can still be entered → /verify-otp, timers seeded, specific warning', async () => {
        // Arrange
        fetchMock
            .mockResolvedValueOnce(loggedIn())
            .mockResolvedValueOnce(jsonResponse(429, { errors: [{ code: 'OTP_RATE_LIMITED', retryAfter: 600, expiresIn: 200 }] }))
        render(<LoginPage />)

        // Act
        submitLogin()

        // Assert
        await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/verify-otp?email=owner%40example.com'))
        expect(mocks.toastWarning).toHaveBeenCalledWith(en.auth.otpRateLimitedTitle, { description: en.auth.otpRateLimitedDesc.replace('{minutes}', '10') })
        expect(mocks.toastError).not.toHaveBeenCalled()
        const expiryEnd = Number(sessionStorage.getItem(OTP_EXPIRY_END_KEY))
        const resendEnd = Number(sessionStorage.getItem(OTP_RESEND_END_KEY))
        expect(resendEnd - expiryEnd).toBe(400_000)
    })

    it('no usable code → "try again in N min", stays on /login', async () => {
        fetchMock
            .mockResolvedValueOnce(loggedIn())
            .mockResolvedValueOnce(jsonResponse(429, { errors: [{ code: 'OTP_RATE_LIMITED', retryAfter: 130 }] }))
        render(<LoginPage />)

        submitLogin()

        const message = en.auth.errors.otpRateLimited.replace('{minutes}', '3')
        await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(message))
        expect(mocks.toastError).not.toHaveBeenCalledWith(en.auth.errors.otpSendFailed)
        expect(mocks.replace).not.toHaveBeenCalled()
        expect(await screen.findAllByText(message)).not.toHaveLength(0)
    })
})
