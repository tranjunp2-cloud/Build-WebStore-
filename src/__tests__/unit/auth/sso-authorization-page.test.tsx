/**
 * TC-1725-PAGE-01/02: SSO authorization page query boundary
 * Convention: docs/TEST_CONVENTION.md | TC-IDs: docs/qa/F-SSO-PW2.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const mockSsoAuthorizationClient = vi.hoisted(() =>
    vi.fn((_props: { v2Token?: string; redirectUrl?: string }) => null),
)

vi.mock('@/app/sso/authorization/_components/SsoAuthorizationClient', () => ({
    SsoAuthorizationClient: mockSsoAuthorizationClient,
}))

import SsoAuthorizationPage from '@/app/sso/authorization/page'

describe('[TC-1725-PAGE] SSO authorization page query boundary', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('TC-1725-PAGE-01: passes one redirect_url string to the client', async () => {
        // Arrange
        const searchParams = Promise.resolve({
            v2_token: 'valid-token',
            redirect_url: '/initial-setting',
        })

        // Act
        render(await SsoAuthorizationPage({ searchParams }))

        // Assert
        expect(mockSsoAuthorizationClient.mock.calls[0]?.[0]).toEqual({
            v2Token: 'valid-token',
            redirectUrl: '/initial-setting',
        })
    })

    it('TC-1725-PAGE-02: omits redirect intent when query contains repeated values', async () => {
        // Arrange
        const searchParams = Promise.resolve({
            v2_token: 'valid-token',
            redirect_url: ['/initial-setting', '/content-manager/product'],
        })

        // Act
        render(await SsoAuthorizationPage({ searchParams }))

        // Assert
        expect(mockSsoAuthorizationClient.mock.calls[0]?.[0]).toEqual({
            v2Token: 'valid-token',
            redirectUrl: undefined,
        })
    })
})
