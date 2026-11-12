/**
 * Login page: password minimum length is 6 characters (GH-2269)
 * TC-IDs: TC-F02.67 (docs/qa/F02-auth.md)
 * Convention: docs/TEST_CONVENTION.md
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import en from '@/i18n/locales/en.json'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}))

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

vi.mock('@/i18n', () => ({
    useI18n: () => ({ t: en }),
}))

vi.mock('@/components/LanguageSwitcher', () => ({ default: () => null }))

import LoginPage from '@/app/(auth)/login/page'

function submitLogin(password: string): void {
    fireEvent.change(screen.getByLabelText(en.auth.email), { target: { value: 'staff@example.com' } })
    fireEvent.change(screen.getByLabelText(en.auth.password), { target: { value: password } })
    fireEvent.click(screen.getByRole('button', { name: en.auth.signIn }))
}

describe('[GH-2269] login page password minimum length', () => {
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

    it('TC-F02.67: 5-character password → inline min-length error, login API not called', async () => {
        // Arrange
        render(<LoginPage />)

        // Act
        submitLogin('Ab1!x')

        // Assert
        expect(await screen.findByText(en.auth.reset.passwordMin)).toBeInTheDocument()
        expect(en.auth.reset.passwordMin).toContain('6 characters')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('TC-F02.67: 6-character password → submitted to POST /api/users/login', async () => {
        // Arrange
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: 'Login failed' }] }), { status: 401 }))
        render(<LoginPage />)

        // Act
        submitLogin('Ab1!xy')

        // Assert
        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/users/login', expect.objectContaining({ method: 'POST' })))
        const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
        expect(body.password).toBe('Ab1!xy')
        expect(screen.queryByText(en.auth.reset.passwordMin)).not.toBeInTheDocument()
        // Wait for the failed-login focus timer before jsdom is torn down.
        await waitFor(() => expect(screen.getByLabelText(en.auth.password)).toHaveFocus())
    })
})
