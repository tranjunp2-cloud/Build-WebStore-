import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SecurityTab } from '@/app/(dashboard)/settings/profile/_components/security-tab'

// Mock i18n at top level
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            profile: {
                security: {
                    title: 'Password & Security',
                    summary: 'Keep your account secure with a strong password.',
                    currentPassword: 'Current Password',
                    newPassword: 'New Password',
                    confirmPassword: 'Confirm New Password',
                    changePassword: 'Change Password',
                    updatePassword: 'Update Password',
                    changing: 'Changing...',
                    changed: 'Password changed successfully',
                    ruleMinLength: 'At least 6 characters',
                    ruleUppercase: 'One uppercase letter',
                    ruleNumber: 'One number',
                },
                general: {
                    cancel: 'Cancel',
                    save: 'Save Change',
                    saving: 'Saving...',
                },
                errors: {
                    saveFailed: 'Failed to save profile',
                    networkError: 'Network error. Please try again.',
                    currentPasswordIncorrect: 'Current password is incorrect',
                    passwordsMismatch: 'Passwords do not match',
                    newPasswordSameAsCurrent: 'New password must differ from current password',
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

// Mock CardActionBar component at top level
vi.mock('@/app/(dashboard)/settings/profile/_components/card-action-bar', () => ({
    CardActionBar: ({ saving, saveLabel, savingLabel, onCancel }: {
        saving: boolean
        saveLabel: string
        savingLabel: string
        onCancel: () => void
    }) => (
        <div data-testid="card-action-bar">
            <button data-testid="cancel-btn" onClick={onCancel} disabled={saving}>
                Cancel
            </button>
            <button data-testid="save-btn" type="submit" disabled={saving}>
                {saving ? savingLabel : saveLabel}
            </button>
        </div>
    ),
}))

// Mock PasswordChangeForm component at top level
vi.mock('@/app/(dashboard)/settings/profile/_components/password-change-form', () => ({
    PasswordChangeForm: ({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) => (
        <form data-testid="password-form">
            <input data-testid="current-password-input" type="password" placeholder="Current Password" />
            <input data-testid="new-password-input" type="password" placeholder="New Password" />
            <input data-testid="confirm-password-input" type="password" placeholder="Confirm Password" />
            <button data-testid="password-form-done-btn" type="button" onClick={onDone}>
                Done
            </button>
            <button data-testid="password-form-cancel-btn" type="button" onClick={onCancel}>
                Cancel
            </button>
        </form>
    ),
}))

// Mock fetch for API calls
global.fetch = vi.fn()

describe('SecurityTab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // TC-F23-04-24: SecurityTab collapsed by default with summary + "Change Password" button
    it('renders collapsed by default with summary line and Change Password button', () => {
        // Arrange / Act
        render(<SecurityTab />)

        // Assert
        expect(screen.getByText('Password & Security')).toBeInTheDocument()
        expect(screen.getByText('Keep your account secure with a strong password.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Change Password' })).toBeInTheDocument()

        // No form fields should be visible
        expect(screen.queryByTestId('password-form')).not.toBeInTheDocument()
    })

    // TC-F23-04-25: Click "Change Password" expands to show form
    it('expands to show password form when Change Password button is clicked', () => {
        // Arrange
        render(<SecurityTab />)

        // Act — click "Change Password"
        const changeBtn = screen.getByRole('button', { name: 'Change Password' })
        fireEvent.click(changeBtn)

        // Assert — form is now visible
        expect(screen.getByTestId('password-form')).toBeInTheDocument()
        expect(screen.getByTestId('current-password-input')).toBeInTheDocument()
        expect(screen.getByTestId('new-password-input')).toBeInTheDocument()
        expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument()

        // Summary should no longer be visible
        expect(screen.queryByText('Keep your account secure with a strong password.')).not.toBeInTheDocument()
    })

    // TC-F23-04-26: onDone callback collapses the card (401 handled inline in password-change-form.test.tsx)
    it('collapses when PasswordChangeForm calls onDone', () => {
        // Arrange
        render(<SecurityTab />)
        const changeBtn = screen.getByRole('button', { name: 'Change Password' })
        fireEvent.click(changeBtn)

        // Assert form visible
        expect(screen.getByTestId('password-form')).toBeInTheDocument()

        // Act — call onDone (simulating successful password update)
        const doneBtn = screen.getByTestId('password-form-done-btn')
        fireEvent.click(doneBtn)

        // Assert — collapsed back to summary
        expect(screen.queryByTestId('password-form')).not.toBeInTheDocument()
        expect(screen.getByText('Keep your account secure with a strong password.')).toBeInTheDocument()
    })

    // TC-F23-04-26: onCancel callback collapses the card
    it('collapses when PasswordChangeForm calls onCancel', () => {
        // Arrange
        render(<SecurityTab />)
        const changeBtn = screen.getByRole('button', { name: 'Change Password' })
        fireEvent.click(changeBtn)

        // Assert form visible
        expect(screen.getByTestId('password-form')).toBeInTheDocument()

        // Act — call onCancel
        const cancelBtn = screen.getByTestId('password-form-cancel-btn')
        fireEvent.click(cancelBtn)

        // Assert — collapsed back to summary
        expect(screen.queryByTestId('password-form')).not.toBeInTheDocument()
        expect(screen.getByText('Keep your account secure with a strong password.')).toBeInTheDocument()
    })
})
