import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SsoGuardBox } from '@/app/(dashboard)/settings/profile/_components/sso-guard-box'

// Mocks at top level
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            profile: {
                sso: {
                    generalTitle: 'Information managed by SSO',
                    generalNotice: 'Personal information is synced from SSO.',
                    generalLink: 'Visit the SSO portal',
                    securityTitle: 'SSO Protected Account',
                    securityNotice: 'Security settings are managed by SSO.',
                    securityLink: 'Manage SSO Account',
                },
            },
        },
    }),
}))

describe('SsoGuardBox', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // TC-F23-03-02: With SSO URL renders anchor with correct attributes
    it('renders anchor link with correct SSO URL and attributes', () => {
        // Arrange
        const ssoUrl = 'https://sso.example.com/manage'

        // Act
        render(<SsoGuardBox ssoUrl={ssoUrl} variant="general" />)

        // Assert
        const link = screen.getByRole('link')
        expect(link).toHaveAttribute('href', ssoUrl)
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    // TC-F23-03-03: Without SSO URL renders non-interactive span (not a button)
    it('renders span (not button) when ssoUrl is empty', () => {
        // Arrange / Act
        render(<SsoGuardBox ssoUrl="" variant="general" />)

        // Assert — no link rendered, no button
        expect(screen.queryByRole('link')).not.toBeInTheDocument()
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    // TC-F23-03-04: Notice text is always displayed
    it('renders notice text in all cases', () => {
        // Arrange / Act
        render(<SsoGuardBox ssoUrl="https://sso.example.com" variant="general" />)

        // Assert
        expect(screen.getByText('Personal information is synced from SSO.')).toBeInTheDocument()
    })

    // TC-F23-03-05: Security variant uses security-specific text
    it('renders security variant text when variant is security', () => {
        // Arrange / Act
        render(<SsoGuardBox ssoUrl="https://sso.example.com" variant="security" />)

        // Assert
        expect(screen.getByText('SSO Protected Account')).toBeInTheDocument()
        expect(screen.getByText('Security settings are managed by SSO.')).toBeInTheDocument()
    })
})
