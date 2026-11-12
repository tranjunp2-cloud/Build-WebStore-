/**
 * GH-2305 — Invite staff: a malformed email is stopped at the Email field with the approved copy,
 * instead of reaching Payload and coming back as the raw toast "The following field is invalid: Email".
 * Real: StaffDrawer, the email format check, en strings. Faked: the server actions and sonner.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { inviteStaffAction, toastError } = vi.hoisted(() => ({
    inviteStaffAction: vi.fn(async () => ({ success: true })),
    toastError: vi.fn(),
}))

vi.mock('@/app/(dashboard)/settings/staff/actions', () => ({ inviteStaffAction, updateStaff: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: toastError } }))

import { email as payloadEmailValidator } from 'payload/shared'
import { I18nProvider } from '@/i18n'
import { isPayloadAcceptedEmail } from '@/lib/validations/email-address'
import { StaffDrawer } from '@/app/(dashboard)/settings/staff/StaffDrawer'
import en from '@/i18n/locales/en.json'

const invalidCopy = en.Staff.drawer.errorEmailInvalid

function submitInvite(value: string) {
    render(
        <I18nProvider defaultLocale="en">
            <StaffDrawer isOpen onClose={vi.fn()} currentUserEmail="owner@example.com" tenantId="1" />
        </I18nProvider>,
    )
    fireEvent.change(screen.getByPlaceholderText(/@/), { target: { value } })
    fireEvent.click(screen.getByRole('button', { name: en.Staff.drawer.sendInviteBtn }))
}

beforeEach(() => {
    vi.clearAllMocks()
})
afterEach(() => {
    cleanup()
})

describe('[GH-2305] invite staff email format', () => {
    it.each([
        ['no top-level domain', 'staff@invalid'],
        ['nothing after @', 'abc@'],
        ['HTML tags', '<b>staff</b>@example.com'],
        ['double dot', 'staff..one@example.com'],
        ['space inside', 'staff one@example.com'],
    ])('[TC-F19-2305-01] %s → inline "doesn\'t look right" error, no request, no toast', async (_label, value) => {
        // Arrange / Act
        submitInvite(value)

        // Assert
        expect(await screen.findByText(invalidCopy)).toBeInTheDocument()
        expect(inviteStaffAction).not.toHaveBeenCalled()
        expect(toastError).not.toHaveBeenCalled()
    })

    it('[TC-F19-2305-02] a valid email is sent trimmed and lowercased (users are stored lowercase)', async () => {
        // Arrange / Act
        submitInvite('  New.Staff+shop@sub.example.com.my  ')

        // Assert
        await waitFor(() => expect(inviteStaffAction).toHaveBeenCalledTimes(1))
        expect(inviteStaffAction).toHaveBeenCalledWith(expect.objectContaining({ email: 'new.staff+shop@sub.example.com.my', name: 'New.Staff+shop' }))
        expect(screen.queryByText(invalidCopy)).toBeNull()
    })

    it('[TC-F19-2305-03] the inline error clears as soon as the email is edited', async () => {
        // Arrange
        submitInvite('staff@invalid')
        expect(await screen.findByText(invalidCopy)).toBeInTheDocument()

        // Act
        fireEvent.change(screen.getByPlaceholderText(/@/), { target: { value: 'staff@invalid.com' } })

        // Assert
        expect(screen.queryByText(invalidCopy)).toBeNull()
    })

    it.each([
        'staff@invalid', 'abc@', '<b>staff</b>@example.com', 'staff..one@example.com', 'staff one@example.com', 'staff@-shop.com',
        'staff@shop.c', '.staff@example.com', 'ok@example.com', 'New.Staff+shop@sub.example.com.my', "o'neil@example.co", 'a@ex--ample.com', 'STAFF@EXAMPLE.COM',
    ])('[TC-F19-2305-04] %s: the client check agrees with the Payload users email validator', (value) => {
        // Arrange
        const req = { payload: { collections: { users: { config: { auth: {} } } }, config: { collections: [] } }, t: (key: string) => key }

        // Act
        const payloadAccepts = payloadEmailValidator(value, { required: true, req, collectionSlug: 'users', siblingData: {} } as never) === true

        // Assert
        expect(isPayloadAcceptedEmail(value)).toBe(payloadAccepts)
    })

    it.each([
        ['User is already a member of this workspace', en.Staff.drawer.errorAlreadyMember],
        ['This user is an owner of another workspace and cannot be added as staff', en.Staff.drawer.errorOwnerElsewhere],
        ['Email must not exceed 254 characters', en.Staff.drawer.errorEmailTooLong],
        ['Cannot invite yourself', en.Staff.drawer.errorSelfInvite],
        ['The following field is invalid: Email', en.Staff.drawer.errorEmailInvalid],
    ])('[TC-F19-2305-05] server says "%s" → translated error under the Email field, no raw toast', async (serverMessage, copy) => {
        // Arrange
        inviteStaffAction.mockResolvedValueOnce({ success: false, error: serverMessage } as never)

        // Act
        submitInvite('staff@example.com')

        // Assert
        expect(await screen.findByText(copy)).toBeInTheDocument()
        expect(toastError).not.toHaveBeenCalled()
        expect(screen.queryByText(serverMessage)).toBeNull()
    })

    it.each([
        ['Staff limit reached on your current plan', en.Staff.toast.inviteLimitReached],
        ['Forbidden', en.Staff.toast.inviteNotAllowed],
        ['Only an owner can invite another owner', en.Staff.toast.inviteNotAllowed],
        ['duplicate key value violates unique constraint "users_email_idx"', en.Staff.toast.inviteFailed],
        ['Unauthorized', en.Staff.toast.inviteFailed],
        [undefined, en.Staff.toast.inviteFailed],
    ])('[TC-F19-2305-06] server says %s → translated toast, never the raw message', async (serverMessage, copy) => {
        // Arrange
        inviteStaffAction.mockResolvedValueOnce({ success: false, error: serverMessage } as never)

        // Act
        submitInvite('staff@example.com')

        // Assert
        await waitFor(() => expect(toastError).toHaveBeenCalledWith(copy))
    })
})
