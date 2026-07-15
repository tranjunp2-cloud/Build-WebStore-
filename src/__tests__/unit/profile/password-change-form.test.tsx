import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PasswordChangeForm } from '@/app/(dashboard)/settings/profile/_components/password-change-form'

const mockI18nValue = {
    t: {
        profile: {
            security: {
                currentPassword: 'Current Password',
                newPassword: 'New Password',
                confirmPassword: 'Confirm New Password',
                updatePassword: 'Update Password',
                changing: 'Changing...',
                changed: 'Password changed successfully',
                ruleMinLength: 'At least 8 characters',
                ruleUppercase: 'One uppercase letter',
                ruleNumber: 'One number',
            },
            general: {
                cancel: 'Cancel',
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

describe('PasswordChangeForm', () => {
    const mockOnDone = vi.fn()
    const mockOnCancel = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    // Label has no htmlFor/id association with its Input sibling (shared DS pattern
    // across this page — see general-info-tab.test.tsx), so query by the `name`
    // attribute react-hook-form's `register()` sets, not by label text/role.
    function fieldByName(container: HTMLElement, name: string): HTMLInputElement {
        const input = container.querySelector<HTMLInputElement>(`input[name="${name}"]`)
        if (!input) throw new Error(`input[name="${name}"] not found`)
        return input
    }

    function fillAll(container: HTMLElement, values: { current?: string; next?: string; confirm?: string }) {
        if (values.current !== undefined) {
            fireEvent.change(fieldByName(container, 'currentPassword'), { target: { value: values.current } })
        }
        if (values.next !== undefined) {
            fireEvent.change(fieldByName(container, 'newPassword'), { target: { value: values.next } })
        }
        if (values.confirm !== undefined) {
            fireEvent.change(fieldByName(container, 'confirmPassword'), { target: { value: values.confirm } })
        }
    }

    // TC-F23-04-27: Action bar (Cancel + Update Password) is always mounted, even on a pristine form
    it('renders the action bar immediately without requiring a dirty field', () => {
        // Arrange / Act
        render(<PasswordChangeForm onDone={mockOnDone} onCancel={mockOnCancel} />)

        // Assert
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Update Password' })).toBeInTheDocument()
    })

    // TC-F23-04-28: Update Password stays disabled until all 3 fields have a value
    it('keeps Update Password disabled while any field is empty', () => {
        // Arrange
        const { container } = render(<PasswordChangeForm onDone={mockOnDone} onCancel={mockOnCancel} />)
        const submitBtn = screen.getByRole('button', { name: 'Update Password' })
        expect(submitBtn).toBeDisabled()

        // Act — fill only 2 of 3 fields
        fillAll(container, { current: 'oldpass1', next: 'Newpass1' })

        // Assert — still disabled (confirm empty)
        expect(submitBtn).toBeDisabled()
    })

    // TC-F23-04-28: Update Password enables once all 3 fields have a value
    it('enables Update Password once current/new/confirm are all filled', () => {
        // Arrange
        const { container } = render(<PasswordChangeForm onDone={mockOnDone} onCancel={mockOnCancel} />)
        const submitBtn = screen.getByRole('button', { name: 'Update Password' })

        // Act
        fillAll(container, { current: 'oldpass1', next: 'Newpass1', confirm: 'Newpass1' })

        // Assert
        expect(submitBtn).not.toBeDisabled()
    })

    // TC-F23-04-29: Cancel resets the form and notifies the parent to collapse
    it('calls onCancel when Cancel is clicked', () => {
        // Arrange
        const { container } = render(<PasswordChangeForm onDone={mockOnDone} onCancel={mockOnCancel} />)
        fillAll(container, { current: 'oldpass1' })

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

        // Assert
        expect(mockOnCancel).toHaveBeenCalled()
    })

    // TC-F23-04-30: Submitting a valid form posts to the API and calls onDone on success
    it('submits successfully and calls onDone', async () => {
        // Arrange
        const { toast } = await import('sonner')
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })

        const { container } = render(<PasswordChangeForm onDone={mockOnDone} onCancel={mockOnCancel} />)
        fillAll(container, { current: 'oldpass1', next: 'Newpass1', confirm: 'Newpass1' })

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Update Password' }))

        // Assert
        await waitFor(() => {
            expect(mockOnDone).toHaveBeenCalled()
            expect(toast.success).toHaveBeenCalled()
        })
    })

    // TC-F23-04-16: Wrong current password (401) shows an inline error, does not call onDone
    it('shows inline error and does not collapse when current password is wrong', async () => {
        // Arrange
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 })

        const { container } = render(<PasswordChangeForm onDone={mockOnDone} onCancel={mockOnCancel} />)
        fillAll(container, { current: 'wrongpass', next: 'Newpass1', confirm: 'Newpass1' })

        // Act
        fireEvent.click(screen.getByRole('button', { name: 'Update Password' }))

        // Assert
        await waitFor(() => {
            expect(screen.getByText('Current password is incorrect')).toBeInTheDocument()
        })
        expect(mockOnDone).not.toHaveBeenCalled()
    })
})
