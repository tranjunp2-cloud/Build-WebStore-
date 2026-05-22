import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ── Mock next/navigation & actions ──────────────────────────────────────────
vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/settings/staff'),
    useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}));

vi.mock('@/app/(dashboard)/settings/staff/actions', () => ({
    inviteStaffAction: vi.fn(),
    updateStaff: vi.fn(),
    removeStaff: vi.fn(),
    bulkRemoveStaff: vi.fn(),
    updateStaffStatus: vi.fn(),
    resendInvite: vi.fn(),
}));

// ── Mock Sonner Toast ───────────────────────────────────────────────────────
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    }
}));

// ── Mock i18n ─────────────────────────────────────────────────────────────
vi.mock('@/i18n', () => ({
    useI18n: () => ({
        locale: 'en',
        t: {
            Staff: {
                drawer: {
                    inviteTitle: 'Invite Staff',
                    editTitle: 'Edit Permissions',
                    saveBtn: 'Save Changes',
                    sendInviteBtn: 'Send Invite',
                    cancelBtn: 'Cancel',
                    email: 'Email Address',
                    emailNeeded: 'Send an invitation to join your store.',
                    errorEmailRequired: 'Please enter an email address',
                    errorEmailInvalid: 'Invalid email address',
                    errorEmailTooLong: 'Email must not exceed 254 characters',
                    errorSelfInvite: 'You cannot invite yourself',
                    errorGeneric: 'Something went wrong. Please try again.',
                    roles: {
                        label: 'Select Role',
                        admin: 'Manager',
                        adminDesc: 'Can manage everything except delete the store.',
                        custom: 'Custom Features',
                        customDesc: 'Select specific access individually'
                    },
                    features: {
                        builder: 'Store Editor',
                        blog: 'Blog',
                        products: 'Product',
                        orders: 'Order',
                        settings: 'Setting'
                    }
                },
                toast: {
                    inviteSent: 'Invitation sent successfully!',
                    inviteFailed: 'Failed to send invitation',
                    staffUpdated: 'Staff updated successfully!',
                    staffUpdateFailed: 'Failed to update staff',
                    permissionRequired: 'Please select at least one custom permission'
                }
            }
        }
    }),
}));

import { StaffDirectoryClient } from '@/app/(dashboard)/settings/staff/StaffDirectoryClient';
import { StaffDrawer } from '@/app/(dashboard)/settings/staff/StaffDrawer';
import * as actions from '@/app/(dashboard)/settings/staff/actions';
import { toast } from 'sonner';

const mockStaff = [
    {
        id: 'user-1',
        email: 'owner@test.com',
        firstName: 'Store',
        lastName: 'Owner',
        role: 'owner',
        status: 'active',
        permissions: [],
        lastLoginAt: '2026-03-26T10:00:00.000Z'
    },
    {
        id: 'user-2',
        email: 'admin@test.com',
        firstName: 'Staff',
        lastName: 'Admin',
        role: 'admin',
        status: 'active',
        permissions: [],
        lastLoginAt: '2026-03-25T10:00:00.000Z'
    },
    {
        id: 'user-3',
        email: 'custom@test.com',
        firstName: 'Custom',
        lastName: 'User',
        role: 'custom',
        status: 'pending',
        permissions: ['products', 'orders'],
        lastLoginAt: null
    }
];

describe('F19 Staff Management (StaffDirectoryClient & StaffDrawer)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Staff Directory View', () => {
        it('[TC-F19.24] Displays Staff Directory completely with all info', () => {
            render(<StaffDirectoryClient tenantId="tenant-1" initialStaff={mockStaff} />);

            expect(screen.getByText('Store Owner')).toBeInTheDocument();
            expect(screen.getByText('owner@test.com')).toBeInTheDocument();
            
            // Badges
            expect(screen.getByText('Owner')).toBeInTheDocument();
            expect(screen.getByText('Manager')).toBeInTheDocument();
            expect(screen.getByText('Custom Features')).toBeInTheDocument();

            // Statuses
            expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
            expect(screen.getByText('Pending')).toBeInTheDocument();
        });

    });

    describe('Staff Drawer (Invite/Edit)', () => {
        it('[TC-F19.18] Validates invite email', async () => {
            render(<StaffDrawer isOpen={true} onClose={vi.fn()} />);

            // Click Send Invite with empty email
            fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }));

            await waitFor(() => {
                expect(screen.getByText('Please enter an email address')).toBeInTheDocument();
            });
        });

        it('[TC-F19.22] Prevents saving custom role if no permissions selected', async () => {
            render(<StaffDrawer isOpen={true} onClose={vi.fn()} />);

            // Fill email
            const emailInput = screen.getByPlaceholderText('staff@domain.com');
            fireEvent.change(emailInput, { target: { value: 'newuser@test.com' } });

            // Select Custom role
            fireEvent.click(screen.getByText('Custom Features'));

            // Button should be disabled when no permissions selected
            const sendButton = screen.getByRole('button', { name: /Send Invite/i });
            expect(sendButton).toBeDisabled();
        });

        it('[TC-F19.20] Submits valid invite with custom features', async () => {
            (actions.inviteStaffAction as any).mockResolvedValue({ success: true });
            const onCloseMock = vi.fn();

            render(<StaffDrawer isOpen={true} onClose={onCloseMock} />);

            // Fill email
            const emailInput = screen.getByPlaceholderText('staff@domain.com');
            fireEvent.change(emailInput, { target: { value: 'newuser@test.com' } });

            // Select Custom role
            fireEvent.click(screen.getByText('Custom Features'));

            // The exact hardcoded labels in StaffDrawer (products & orders are hidden)
            const blogFeature = screen.getByText('Blog');
            fireEvent.click(blogFeature);

            // Click Send Invite
            fireEvent.click(screen.getByRole('button', { name: /Send Invite/i }));

            await waitFor(() => {
                expect(actions.inviteStaffAction).toHaveBeenCalledWith({
                    email: 'newuser@test.com',
                    name: 'newuser',
                    role: 'custom',
                    permissions: ['blog']
                });
                expect(toast.success).toHaveBeenCalledWith('Invitation sent successfully!');
                expect(onCloseMock).toHaveBeenCalled();
            });
        });

        it('[TC-F19.27] Protects Owner from being removed or edited', () => {
            const ownerData = mockStaff.find(s => s.role === 'owner')!;
            render(<StaffDrawer isOpen={true} onClose={vi.fn()} editData={ownerData} />);

            // Check if full access / custom is disabled
            const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
            expect(saveBtn).toBeDisabled();

            const emailInput = screen.getByPlaceholderText('staff@domain.com');
            expect(emailInput).toBeDisabled();
        });
    });
});
