import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OwnerProfileView } from '@/app/(dashboard)/settings/profile/_components/owner-profile-view'
import type { PlatformUser } from '@/types/user'

// Mock i18n at top level
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            profile: {
                general: {
                    email: 'Email Address',
                    phone: 'Phone Number',
                },
                banner: {
                    roleOwner: 'Owner',
                },
                owner: {
                    passwordLabel: 'Password',
                },
                sso: {
                    widgetTitle: 'SSO Protected Account',
                    widgetDescription: 'Your personal profile fields, password, and security configurations are managed centrally by the Single Sign-On system. Changes made there will sync here automatically.',
                    goToPortal: 'Go to SSO Portal',
                    urlMissing: 'SSO portal URL is not configured. Contact admin.',
                },
            },
        },
    }),
}))

// Mock next/image to avoid Image optimization requirements in tests
vi.mock('next/image', () => ({
    default: ({ src, alt, fill, ...props }: any) =>
        <img src={src} alt={alt} {...props} />,
}))

describe('OwnerProfileView', () => {
    const mockUser: Pick<PlatformUser, 'firstName' | 'lastName' | 'email' | 'phone' | 'avatar'> = {
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@test.com',
        phone: '+60987654321',
        avatar: null,
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    // TC-F23-03-01 (owner read-only): No input or textarea elements
    it('renders read-only view with no editable input/textarea elements', () => {
        // Arrange / Act
        render(<OwnerProfileView user={mockUser} ssoUrl="https://sso.example.com" />)

        // Assert — no inputs or textareas in the DOM
        const inputs = screen.queryAllByRole('textbox')
        const textareas = document.querySelectorAll('textarea')
        expect(inputs).toHaveLength(0)
        expect(textareas).toHaveLength(0)
    })

    // TC-F23-03-02: Display name shown in the profile card
    it('displays user name and email in profile card', () => {
        // Arrange / Act
        render(<OwnerProfileView user={mockUser} ssoUrl="https://sso.example.com" />)

        // Assert
        expect(screen.getByText('Alice Smith')).toBeInTheDocument()
        expect(screen.getByText('alice@test.com')).toBeInTheDocument()
    })

    // TC-F23-03-03: Phone number shown in grid
    it('displays phone number in read-only grid', () => {
        // Arrange / Act
        render(<OwnerProfileView user={mockUser} ssoUrl="https://sso.example.com" />)

        // Assert
        expect(screen.getByText('+60987654321')).toBeInTheDocument()
    })

    // TC-F23-03-04: Password is masked; 2FA stays hidden until SSO provides a real status
    it('renders masked password dots without an unverified two-factor status', () => {
        // Arrange / Act
        const { container } = render(<OwnerProfileView user={mockUser} ssoUrl="https://sso.example.com" />)

        // Assert — password dots present (look for any element containing dots)
        const passwordField = Array.from(container.querySelectorAll('span')).find(el =>
            el.textContent?.includes('•') && el.textContent?.length > 10
        )
        expect(passwordField).toBeTruthy()

        expect(screen.queryByText(/2FA|Two-Factor|2-factor/i)).not.toBeInTheDocument()
        expect(screen.queryByTestId('owner-two-factor-status')).not.toBeInTheDocument()
    })

    // TC-F23-03-05: Role badge shows "Owner"
    it('shows Owner role badge', () => {
        // Arrange / Act
        render(<OwnerProfileView user={mockUser} ssoUrl="https://sso.example.com" />)

        // Assert
        expect(screen.getByText('Owner')).toBeInTheDocument()
    })

    // TC-F23-03-02: Exactly one element with target="_blank" (SSO link)
    it('renders exactly one external link (SSO portal) with target="_blank"', () => {
        // Arrange / Act
        render(<OwnerProfileView user={mockUser} ssoUrl="https://sso.example.com/admin" />)

        // Assert
        const externalLinks = document.querySelectorAll('a[target="_blank"]')
        expect(externalLinks).toHaveLength(1)

        const ssoLink = externalLinks[0] as HTMLAnchorElement
        expect(ssoLink.href).toBe('https://sso.example.com/admin')
        expect(ssoLink.getAttribute('rel')).toBe('noopener noreferrer')
    })

    // TC-F23-03-05: SSO link text
    it('shows Go to SSO Portal link text', () => {
        // Arrange / Act
        render(<OwnerProfileView user={mockUser} ssoUrl="https://sso.example.com" />)

        // Assert
        expect(screen.getByText('Go to SSO Portal')).toBeInTheDocument()
    })

    // TC-F23-03-02: When ssoUrl is empty, disabled button fallback is shown (not a link)
    it('shows disabled-look button when ssoUrl is empty', () => {
        // Arrange / Act
        render(<OwnerProfileView user={mockUser} ssoUrl="" />)

        // Assert — no external link exists
        const externalLinks = document.querySelectorAll('a[target="_blank"]')
        expect(externalLinks).toHaveLength(0)

        // Assert — disabled span fallback text present
        expect(screen.getByText('SSO portal URL is not configured. Contact admin.')).toBeInTheDocument()

        // Assert — "Go to SSO Portal" text still appears in disabled state
        const disabledButtons = document.querySelectorAll('[aria-disabled="true"]')
        expect(disabledButtons.length).toBeGreaterThan(0)
    })

    // TC-F23-03-03: Grid layout with profile card and SSO widget side by side (desktop view)
    it('renders 2-column grid layout on medium+ screens (profile card + SSO widget)', () => {
        // Arrange / Act
        const { container } = render(<OwnerProfileView user={mockUser} ssoUrl="https://sso.example.com" />)

        // Assert — grid with md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] exists
        const gridContainer = container.querySelector('[class*="grid-cols"]')
        expect(gridContainer).toBeInTheDocument()
        expect(gridContainer?.className).toMatch(/md:grid-cols/)

        // Both cards should be present
        const cards = container.querySelectorAll('.rounded-2xl')
        expect(cards.length).toBeGreaterThanOrEqual(2)
    })

    // TC-F23-03-04: Phone number fallback when empty
    it('shows em-dash when phone is empty', () => {
        // Arrange
        const userNoPhone: Pick<PlatformUser, 'firstName' | 'lastName' | 'email' | 'phone' | 'avatar'> = {
            ...mockUser,
            phone: '',
        }

        // Act
        render(<OwnerProfileView user={userNoPhone} ssoUrl="https://sso.example.com" />)

        // Assert — em-dash shown as placeholder
        expect(screen.getByText('—')).toBeInTheDocument()
    })

    // TC-F23-03-01 (owner read-only): Verify no form submission possible
    it('contains no form or submit elements', () => {
        // Arrange / Act
        const { container } = render(<OwnerProfileView user={mockUser} ssoUrl="https://sso.example.com" />)

        // Assert
        const forms = container.querySelectorAll('form')
        expect(forms).toHaveLength(0)

        const submitButtons = container.querySelectorAll('button[type="submit"]')
        expect(submitButtons).toHaveLength(0)
    })
})
