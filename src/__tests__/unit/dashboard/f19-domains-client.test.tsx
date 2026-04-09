import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('@/app/(dashboard)/settings/domains/actions', () => ({
    addCustomDomain: vi.fn(),
    verifyCustomDomain: vi.fn(),
    removeCustomDomain: vi.fn(),
    setPrimaryDomain: vi.fn(),
    clearPrimaryDomain: vi.fn(),
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    }
}));

Object.assign(navigator, {
    clipboard: {
        writeText: vi.fn(),
    },
});

import { DomainsClient } from '@/app/(dashboard)/settings/domains/DomainsClient';
import * as actions from '@/app/(dashboard)/settings/domains/actions';
import { toast } from 'sonner';

const mockDomains = [
    { domain: 'store.custom.com', status: 'active', isPrimary: true },
    { domain: 'pending.custom.com', status: 'pending', isPrimary: false }
];

describe('F19 Domain Management (DomainsClient)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('[TC-F19.01] Renders active and pending domains in the directory', () => {
        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={mockDomains} />);
        
        const platform = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'cname.vercel-dns.com';
        expect(screen.getByText(`mywebstore.${platform}`)).toBeInTheDocument();
        expect(screen.getAllByText('store.custom.com').length).toBeGreaterThan(0);
        expect(screen.getByText('pending.custom.com')).toBeInTheDocument();
        expect(screen.getByText('Pending Verification')).toBeInTheDocument();
    });

    it('[TC-F19.02] Rejects invalid domain formats', async () => {
        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[]} />);
        
        fireEvent.click(screen.getByRole('button', { name: /Add Custom Domain/i }));
        
        const input = screen.getByPlaceholderText('example.com');
        fireEvent.change(input, { target: { value: 'invalid-domain!@#$' } });
        
        const submitBtn = screen.getByRole('button', { name: 'Add Domain' });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Invalid domain format'));
        });
    });

    it('[TC-F19.01] Successfully requests to add a Custom Domain', async () => {
        (actions.addCustomDomain as any).mockResolvedValue({ success: true });
        
        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[]} />);
        
        fireEvent.click(screen.getByRole('button', { name: /Add Custom Domain/i }));
        
        const input = screen.getByPlaceholderText('example.com');
        fireEvent.change(input, { target: { value: 'newstore.com' } });
        
        const submitBtn = screen.getByRole('button', { name: 'Add Domain' });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(actions.addCustomDomain).toHaveBeenCalledWith('newstore.com');
            expect(toast.success).toHaveBeenCalledWith('Domain added successfully! Please configure DNS.');
        });
    });

    it('[TC-F19.08] Selects Primary Domain and updates correctly', async () => {
        (actions.setPrimaryDomain as any).mockResolvedValue({ success: true });
        
        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[
            { domain: 'store.custom.com', status: 'active', isPrimary: false }
        ]} />);
        
        fireEvent.click(screen.getByRole('button', { name: /Select primary domain/i }));
        
        const labels = screen.getAllByText('store.custom.com');
        const clickableLabel = labels[labels.length - 1];
        fireEvent.click(clickableLabel);

        const saveBtn = screen.getByRole('button', { name: 'Save' });
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(actions.setPrimaryDomain).toHaveBeenCalledWith('store.custom.com');
            expect(toast.success).toHaveBeenCalledWith('"store.custom.com" is now your Primary Domain.');
        });
    });

    it('[TC-F19.04] Shows DNS Instructions (A Record/CNAME) for Pending domains', () => {
        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[
            { domain: 'store.custom.com', status: 'pending', isPrimary: false }
        ]} />);
        
        expect(screen.getByText(/A Record/i)).toBeInTheDocument();
        expect(screen.getByText(/CNAME/i)).toBeInTheDocument();
        const firstIp = (process.env.NEXT_PUBLIC_SERVER_IP ?? '162.159.140.98').split(',')[0].trim();
        expect(screen.getByText(firstIp)).toBeInTheDocument();
        expect(screen.getByText(process.env.NEXT_PUBLIC_CNAME_TARGET ?? process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'cname.vercel-dns.com')).toBeInTheDocument();
    });

    it('[TC-F19.11] Prevents Setting Primary for Pending domains', () => {
        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[
            { domain: 'store.custom.com', status: 'pending', isPrimary: false }
        ]} />);
        
        // Open the primary domain modal
        fireEvent.click(screen.getByRole('button', { name: /Select primary domain/i }));
        // The pending custom domain should NOT be visible in the selection list (modal)
        // It only exists once on the main page card as an <h3> element
        const elements = screen.queryAllByText('store.custom.com');
        expect(elements).toHaveLength(1);
    });

    it('[TC-F19.03] Shows error when adding a duplicate/linked domain', async () => {
        (actions.addCustomDomain as any).mockResolvedValue({ success: false, error: 'This domain is already linked to another store' });
        
        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[]} />);
        
        fireEvent.click(screen.getByRole('button', { name: /Add Custom Domain/i }));
        
        const input = screen.getByPlaceholderText('example.com');
        fireEvent.change(input, { target: { value: 'duplicate.com' } });
        
        const submitBtn = screen.getByRole('button', { name: 'Add Domain' });
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('This domain is already linked to another store');
        });
    });

    it('[TC-F19.05] Verifies connection and shows loading state', async () => {
        // Resolve slowly to check loading state
        let resolveVerify: any;
        const promise = new Promise<{success:boolean}>((resolve) => { resolveVerify = resolve; });
        (actions.verifyCustomDomain as any).mockReturnValue(promise);

        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[
            { domain: 'store.custom.com', status: 'pending', isPrimary: false }
        ]} />);
        
        const verifyBtn = screen.getByRole('button', { name: 'Verify Connection' });
        fireEvent.click(verifyBtn);

        // Should show "Verifying..."
        expect(screen.getByRole('button', { name: 'Verifying...' })).toBeInTheDocument();

        // Resolve the promise
        resolveVerify({ success: true });

        await waitFor(() => {
            expect(actions.verifyCustomDomain).toHaveBeenCalledWith('store.custom.com');
            expect(toast.success).toHaveBeenCalledWith('Domain verified successfully! SSL connection secured.');
        });
    });

    it('[TC-F19.10] Protects default platform subdomain from removal', () => {
        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[]} />);
        
        const platform = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'cname.vercel-dns.com';
        expect(screen.getByText(`mywebstore.${platform}`)).toBeInTheDocument();

        // There shouldn't be a generic Remove Domain button for it.
        const removeBtns = screen.queryAllByRole('button', { name: /Remove/i });
        expect(removeBtns).toHaveLength(0);
    });

    it('[TC-F19.30] Tap to copy DNS records shows success toast', async () => {
        const { container } = render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[
            { domain: 'store.custom.com', status: 'pending' }
        ]} />);
        
        const clipboardBtns = container.querySelectorAll('button.h-\\[44px\\]');
        expect(clipboardBtns.length).toBeGreaterThanOrEqual(1);

        fireEvent.click(clipboardBtns[0]); // A Record

        await waitFor(() => {
            const firstIp = (process.env.NEXT_PUBLIC_SERVER_IP ?? '162.159.140.98').split(',')[0].trim();
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(firstIp);
            expect(toast.success).toHaveBeenCalledWith('Copied IP 1! ✅');
        });
    });

    it('[TC-F19.66] Removes a custom domain correctly', async () => {
        (actions.removeCustomDomain as any).mockResolvedValue({ success: true });

        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[
            { domain: 'store.active.com', status: 'active', isPrimary: false }
        ]} />);
        
        const removeBtn = screen.getByRole('button', { name: 'Remove Domain' });
        fireEvent.click(removeBtn);

        // Confirmation modal should appear
        await waitFor(() => {
            expect(screen.getByText(/Are you sure you want to remove/i)).toBeInTheDocument();
        });

        // Click confirm button in modal (second "Remove Domain" button)
        const confirmBtns = screen.getAllByRole('button', { name: 'Remove Domain' });
        fireEvent.click(confirmBtns[confirmBtns.length - 1]);

        await waitFor(() => {
            expect(actions.removeCustomDomain).toHaveBeenCalledWith('store.active.com');
            expect(toast.success).toHaveBeenCalledWith('Custom domain removed.');
        });
    });

    it('[TC-F19.49] Shows Zero-state text in primary select panel when no custom domains', () => {
        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[]} />);
        
        fireEvent.click(screen.getByRole('button', { name: /Select primary domain/i }));
        
        expect(screen.getByText('No verified custom domains yet. Add and verify a custom domain first.')).toBeInTheDocument();
    });
});
