import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GeneralInfoTab } from '@/app/(dashboard)/settings/profile/_components/general-info-tab'
import type { PlatformUser } from '@/types/user'

const mockI18nValue = {
    t: {
        profile: {
            general: {
                firstName: 'First Name',
                lastName: 'Last Name',
                email: 'Email',
                emailReadonly: 'Email cannot be changed',
                phone: 'Phone',
                save: 'Save',
                saving: 'Saving...',
                saved: 'Saved',
                cancel: 'Cancel',
            },
            errors: {
                saveFailed: 'Failed to save profile',
                networkError: 'Network error',
                invalidPhone: 'Invalid phone number',
            },
            saveBar: {
                unsavedChanges: 'Unsaved changes',
            },
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
}

// Mocks at top level
vi.mock('@/i18n', () => ({
    useI18n: () => mockI18nValue,
}))

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('@/app/(dashboard)/settings/profile/_components/phone-input', () => ({
    PhoneInput: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
        <input data-testid="phone-input" value={value} onChange={e => onChange(e.target.value)} />
    ),
}))

describe('GeneralInfoTab', () => {
    const mockUser: Pick<PlatformUser, 'firstName' | 'lastName' | 'phone' | 'email'> = {
        firstName: 'John',
        lastName: 'Doe',
        phone: '+60123456789',
        email: 'john@test.com',
    }

    const mockOnUserUpdate = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    // TC-F23-03-01: Owner role renders SsoGuardBox — no input fields
    it('renders SsoGuardBox for owner with no editable inputs', () => {
        // Arrange / Act
        render(
            <GeneralInfoTab
                user={mockUser}
                role="owner"
                ssoUrl="https://sso.example.com"
                onUserUpdate={mockOnUserUpdate}
            />,
        )

        // Assert — no first/last name inputs
        expect(screen.queryByDisplayValue('John')).not.toBeInTheDocument()
        // SsoGuardBox title is rendered
        expect(screen.getByText('Information managed by SSO')).toBeInTheDocument()
    })

    // TC-F23-02-01: Staff role renders editable inputs; save bar (with unsaved
    // indicator) only shows when dirty
    it('renders enabled inputs for staff and shows Save only when dirty', () => {
        // Arrange
        render(
            <GeneralInfoTab
                user={mockUser}
                role="staff"
                ssoUrl=""
                onUserUpdate={mockOnUserUpdate}
            />,
        )

        // Act — initially no action bar
        const firstNameInput = screen.getByDisplayValue('John') as HTMLInputElement
        expect(firstNameInput.disabled).toBe(false)
        expect(screen.queryByText('Save')).not.toBeInTheDocument()
        expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()

        // Trigger dirty state
        fireEvent.change(firstNameInput, { target: { value: 'Jane' } })

        // Assert — floating save bar appears with unsaved indicator
        expect(screen.getByText('Save')).toBeInTheDocument()
        expect(screen.getByText('Cancel')).toBeInTheDocument()
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    })

    // TC-F23-02-02: Email field is always readonly
    it('renders email field as readonly for staff', () => {
        // Arrange / Act
        render(
            <GeneralInfoTab
                user={mockUser}
                role="staff"
                ssoUrl=""
                onUserUpdate={mockOnUserUpdate}
            />,
        )

        // Assert
        const emailInput = screen.getByDisplayValue('john@test.com') as HTMLInputElement
        expect(emailInput.readOnly).toBe(true)
    })

    // TC-F23-02-03: Submit valid form calls onUserUpdate and shows success toast
    it('calls onUserUpdate and shows success toast when form is submitted', async () => {
        // Arrange
        const { toast } = await import('sonner')
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ firstName: 'Jane' }),
        })

        render(
            <GeneralInfoTab
                user={mockUser}
                role="staff"
                ssoUrl=""
                onUserUpdate={mockOnUserUpdate}
            />,
        )

        // Act — make dirty then submit
        const firstNameInput = screen.getByDisplayValue('John') as HTMLInputElement
        fireEvent.change(firstNameInput, { target: { value: 'Jane' } })
        fireEvent.click(screen.getByText('Save'))

        // Assert
        await waitFor(() => {
            expect(mockOnUserUpdate).toHaveBeenCalled()
            expect(toast.success).toHaveBeenCalled()
        })
    })

    // TC-F23-02-05: Owner role renders SsoGuardBox with SSO notice text
    it('renders SsoGuardBox notice when role is owner', () => {
        // Arrange / Act
        render(
            <GeneralInfoTab
                user={mockUser}
                role="owner"
                ssoUrl="https://sso.example.com"
                onUserUpdate={mockOnUserUpdate}
            />,
        )

        // Assert
        expect(screen.getByText('Personal information is synced from SSO.')).toBeInTheDocument()
    })

    // TC-F23-02-06: Staff role does not render SsoGuardBox
    it('does not render SsoGuardBox when role is staff', () => {
        // Arrange / Act
        render(
            <GeneralInfoTab
                user={mockUser}
                role="staff"
                ssoUrl=""
                onUserUpdate={mockOnUserUpdate}
            />,
        )

        // Assert
        expect(screen.queryByText('Information managed by SSO')).not.toBeInTheDocument()
    })
})
