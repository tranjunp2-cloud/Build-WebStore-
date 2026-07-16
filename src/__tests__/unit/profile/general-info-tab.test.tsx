import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GeneralInfoTab } from '@/app/(dashboard)/settings/profile/_components/general-info-tab'
import type { PlatformUser } from '@/types/user'

// Mock i18n at top level
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            profile: {
                general: {
                    title: 'Personal Information',
                    subtitle: 'Your name and contact details.',
                    firstName: 'First Name',
                    lastName: 'Last Name',
                    email: 'Email Address',
                    emailReadonly: 'Email cannot be changed (Login identity)',
                    phone: 'Phone Number',
                    save: 'Save Change',
                    saving: 'Saving...',
                    saved: 'Profile updated',
                    cancel: 'Cancel',
                },
                errors: {
                    saveFailed: 'Failed to save profile',
                    networkError: 'Network error. Please try again.',
                    invalidPhone: 'Please enter a valid phone number',
                },
            },
        },
    }),
}))

// Mock sonner (toast) at top level
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

// Mock CardActionBar component — simplified mock that renders when visible
vi.mock('@/app/(dashboard)/settings/profile/_components/card-action-bar', () => ({
    CardActionBar: ({ saving, saveLabel, savingLabel, onCancel }: {
        saving: boolean
        saveLabel: string
        savingLabel: string
        onCancel: () => void
    }) => (
        <div data-testid="card-action-bar" className="mt-2 pt-5 border-t flex gap-3 justify-end">
            <button data-testid="cancel-btn" onClick={onCancel} disabled={saving}>
                Cancel
            </button>
            <button data-testid="save-btn" type="submit" disabled={saving}>
                {saving ? savingLabel : saveLabel}
            </button>
        </div>
    ),
}))

// Mock PhoneInput component at top level
vi.mock('@/app/(dashboard)/settings/profile/_components/phone-input', () => ({
    PhoneInput: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
        <input
            data-testid="phone-input"
            type="tel"
            value={value}
            onChange={e => onChange(e.target.value)}
            aria-label="Phone number"
        />
    ),
}))

// Mock fetch for API calls
global.fetch = vi.fn()

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
        global.fetch = vi.fn()
    })

    // TC-F23-02-01: Staff-only card with inline action bar hidden by default, visible when dirty
    it('renders staff-only card with inline action bar hidden initially and visible when form is dirty', () => {
        // Arrange
        render(
            <GeneralInfoTab
                user={mockUser}
                onUserUpdate={mockOnUserUpdate}
            />,
        )

        // Assert initial state — form fields present, no action bar
        expect(screen.getByDisplayValue('John')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Doe')).toBeInTheDocument()
        expect(screen.getByDisplayValue('+60123456789')).toBeInTheDocument()
        expect(screen.queryByTestId('card-action-bar')).not.toBeInTheDocument()

        // Act — make form dirty
        const firstNameInput = screen.getByDisplayValue('John') as HTMLInputElement
        fireEvent.change(firstNameInput, { target: { value: 'Jane' } })

        // Assert — action bar now visible
        expect(screen.getByTestId('card-action-bar')).toBeInTheDocument()
        expect(screen.getByTestId('save-btn')).toBeInTheDocument()
        expect(screen.getByTestId('cancel-btn')).toBeInTheDocument()
    })

    // TC-F23-02-02: Email field is always disabled
    it('renders email field as disabled with help text', () => {
        // Arrange / Act
        render(
            <GeneralInfoTab
                user={mockUser}
                onUserUpdate={mockOnUserUpdate}
            />,
        )

        // Assert
        const emailInput = screen.getByDisplayValue('john@test.com') as HTMLInputElement
        expect(emailInput.disabled).toBe(true)
        expect(screen.getByText('Email cannot be changed (Login identity)')).toBeInTheDocument()
    })

    // TC-F23-02-03: Valid form submission calls onUserUpdate and shows success toast
    it('calls onUserUpdate and shows success toast on successful submission', async () => {
        // Arrange
        const { toast } = await import('sonner')
        ;(global.fetch as any).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        })

        render(
            <GeneralInfoTab
                user={mockUser}
                onUserUpdate={mockOnUserUpdate}
            />,
        )

        // Act — make form dirty and submit
        const firstNameInput = screen.getByDisplayValue('John') as HTMLInputElement
        fireEvent.change(firstNameInput, { target: { value: 'Jane' } })

        // Manually submit the form (simulate button click)
        const form = firstNameInput.closest('form')!
        fireEvent.submit(form)

        // Assert — fetch called, onUserUpdate called, success toast shown
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/users/me',
                expect.objectContaining({
                    method: 'PATCH',
                }),
            )
            expect(mockOnUserUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    firstName: 'Jane',
                }),
            )
            expect(toast.success).toHaveBeenCalled()
        })
    })

    // TC-F23-02-06: Cancel button resets form and hides action bar
    it('resets form and hides action bar when Cancel is clicked', async () => {
        // Arrange
        render(
            <GeneralInfoTab
                user={mockUser}
                onUserUpdate={mockOnUserUpdate}
            />,
        )

        // Act — make dirty
        const firstNameInput = screen.getByDisplayValue('John') as HTMLInputElement
        fireEvent.change(firstNameInput, { target: { value: 'Jane' } })

        // Assert action bar visible
        expect(screen.getByTestId('card-action-bar')).toBeInTheDocument()

        // Act — click Cancel
        const cancelBtn = screen.getByTestId('cancel-btn')
        fireEvent.click(cancelBtn)

        // Assert — form reset, action bar hidden
        const resetInput = screen.getByDisplayValue('John') as HTMLInputElement
        expect(resetInput.value).toBe('John')
        expect(screen.queryByTestId('card-action-bar')).not.toBeInTheDocument()
    })

    // TC-F23-02-05: Error toast on failed submission (server error)
    it('shows error toast on failed submission', async () => {
        // Arrange
        const { toast } = await import('sonner')
        ;(global.fetch as any).mockResolvedValue({
            ok: false,
            json: () => Promise.resolve({ error: 'Server error' }),
        })

        render(
            <GeneralInfoTab
                user={mockUser}
                onUserUpdate={mockOnUserUpdate}
            />,
        )

        // Act — make dirty and submit
        const firstNameInput = screen.getByDisplayValue('John') as HTMLInputElement
        fireEvent.change(firstNameInput, { target: { value: 'Jane' } })
        const form = firstNameInput.closest('form')!
        fireEvent.submit(form)

        // Assert — error toast shown
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Server error')
        })
    })

    // TC-F23-02-05: Network error toast when fetch fails
    it('shows network error toast when fetch fails', async () => {
        // Arrange
        const { toast } = await import('sonner')
        ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

        render(
            <GeneralInfoTab
                user={mockUser}
                onUserUpdate={mockOnUserUpdate}
            />,
        )

        // Act — make dirty and submit
        const firstNameInput = screen.getByDisplayValue('John') as HTMLInputElement
        fireEvent.change(firstNameInput, { target: { value: 'Jane' } })
        const form = firstNameInput.closest('form')!
        fireEvent.submit(form)

        // Assert — error toast shown
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Network error. Please try again.')
        })
    })
})
