import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
        warning: vi.fn(),
    }
}));

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        locale: 'en',
        t: {
            Domains: {
                errorHttpPrefix: 'Do not include http/https, enter the domain name only',
                errorRequired: 'Please enter a domain name',
                errorSpaces: 'Domain name cannot contain spaces',
                errorTooLong: 'Domain name must not exceed 253 characters',
                errorNoTld: 'Domain must include an extension (e.g., .com, .my)',
                errorInvalidChars: 'Domain contains invalid characters',
                errorInvalidFormat: 'Invalid domain format',
            },
            common: {
                subscriptionErrors: {
                    featureLocked: 'Feature not available on this plan.',
                    subscriptionExpired: 'Subscription expired.',
                    genericLocked: 'Action not available on this plan.',
                },
            },
        },
        ti: (key: string) => key,
    }),
}));

Object.assign(navigator, {
    clipboard: {
        writeText: vi.fn(),
    },
});

import { DomainsClient } from '@/app/(dashboard)/settings/domains/DomainsClient';
import * as actions from '@/app/(dashboard)/settings/domains/actions';
import { toast } from 'sonner';

// DNS constants — post-DO migration these default to Vercel's public values.
// Override via NEXT_PUBLIC_VERCEL_APEX_IP / NEXT_PUBLIC_VERCEL_CNAME_TARGET.
const EXPECTED_A_RECORD = process.env.NEXT_PUBLIC_VERCEL_APEX_IP ?? '76.76.21.21';
const EXPECTED_CNAME = process.env.NEXT_PUBLIC_VERCEL_CNAME_TARGET ?? 'cname.vercel-dns.com';
const EXPECTED_PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? 'primeweb.app';

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

        expect(screen.getByText(`mywebstore.${EXPECTED_PLATFORM_DOMAIN}`)).toBeInTheDocument();
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
            // 'invalid-domain!@#$' has no TLD dot, so this error fires first
            expect(screen.getByText('Domain must include an extension (e.g., .com, .my)')).toBeInTheDocument();
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
            // BUG-F19 fix: always pending after add — single toast regardless of verification[].
            expect(toast.success).toHaveBeenCalledWith(
                expect.stringContaining('Domain added. Point your DNS records below, then click Verify'),
            );
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

    // TC-U-12 — DNS instructions use the new Vercel constants by default.
    it('[TC-F19.04 / TC-U-12] Shows DNS Instructions (A Record + CNAME) for Pending domains', () => {
        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[
            { domain: 'store.custom.com', status: 'pending', isPrimary: false }
        ]} />);

        expect(screen.getAllByText(/A Record/i).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/CNAME/i).length).toBeGreaterThan(0);

        // Vercel apex IP — default 76.76.21.21 (post-DO migration).
        const firstIp = EXPECTED_A_RECORD.split(',')[0].trim();
        expect(screen.getByText(firstIp)).toBeInTheDocument();

        // Vercel CNAME target — default cname.vercel-dns.com.
        expect(screen.getAllByText(EXPECTED_CNAME).length).toBeGreaterThan(0);
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
            expect(toast.success).toHaveBeenCalledWith(
                expect.stringContaining('Domain connected!'),
            );
        });
    });

    it('[TC-F19.10] Protects default platform subdomain from removal', () => {
        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[]} />);

        expect(screen.getByText(`mywebstore.${EXPECTED_PLATFORM_DOMAIN}`)).toBeInTheDocument();

        // There shouldn't be a generic Remove Domain button for it.
        const removeBtns = screen.queryAllByRole('button', { name: /Remove/i });
        expect(removeBtns).toHaveLength(0);
    });

    it('[TC-F19.30] Tap to copy DNS records shows success toast', async () => {
        const { container } = render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[
            { domain: 'store.custom.com', status: 'pending' }
        ]} />);

        const clipboardBtns = container.querySelectorAll('button[aria-label^="Copy A record IP"]');
        expect(clipboardBtns.length).toBeGreaterThanOrEqual(1);

        fireEvent.click(clipboardBtns[0]); // A Record

        await waitFor(() => {
            const firstIp = EXPECTED_A_RECORD.split(',')[0].trim();
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(firstIp);
            expect(toast.success).toHaveBeenCalledWith('Copied IP 1!');
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

    // TC-U-11 — When add returns verification[], the client should:
    //   1. Keep the domain in pending state (not auto-active)
    //   2. Show the unified pending toast (same message regardless of verification presence)
    //   3. Render TxtChallengeCard below the pending DNS card
    it('[TC-U-11] Add with verification[] keeps domain pending and shows unified toast', async () => {
        const verification = [
            {
                type: 'TXT' as const,
                domain: '_vercel.pending.com',
                value: 'vc-domain-verify-xyz',
                reason: 'missing_txt',
            },
        ];
        (actions.addCustomDomain as any).mockResolvedValue({ success: true, verification });

        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[]} />);

        fireEvent.click(screen.getByRole('button', { name: /Add Custom Domain/i }));
        fireEvent.change(screen.getByPlaceholderText('example.com'), {
            target: { value: 'pending.com' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Add Domain' }));

        await waitFor(() => {
            expect(actions.addCustomDomain).toHaveBeenCalledWith('pending.com');
            expect(toast.success).toHaveBeenCalledWith(
                expect.stringContaining('Domain added. Point your DNS records below, then click Verify'),
            );
        });

        // Domain should appear in the list as pending (not active) so DNS
        // instructions render below it.
        expect(screen.getByText('pending.com')).toBeInTheDocument();
        expect(screen.getByText('Pending Verification')).toBeInTheDocument();
    });

    // TC-U-14 — vercelVerification from DB must survive page refresh.
    // Root cause: page.tsx was dropping vercelVerification when building customDomains,
    // so verifications state init was always empty → TxtChallengeCard vanished on reload.
    it('[TC-U-14] TxtChallengeCard renders on page load when vercelVerification is in props', () => {
        const verification = [
            {
                type: 'TXT' as const,
                domain: '_vercel.reload-test.com',
                value: 'vc-domain-verify-abc123',
                reason: 'missing_txt',
            },
        ];

        render(<DomainsClient
            tenantId="tenant-1"
            tenantSlug="mywebstore"
            customDomains={[
                { domain: 'reload-test.com', status: 'pending', isPrimary: false, vercelVerification: verification },
            ]}
        />);

        // TxtChallengeCard should render immediately (no add action required)
        expect(screen.getByRole('region', { name: /Verify domain ownership/i })).toBeInTheDocument();
        expect(screen.getByText('_vercel.reload-test.com')).toBeInTheDocument();
        expect(screen.getByText('vc-domain-verify-abc123')).toBeInTheDocument();
    });

    // SSL provisioning state — when status flips to active after verify,
    // the client sets sslProvisioningDomains[domain] and shows the success toast.
    // The SslProvisioningBanner component exists but is not yet rendered; the
    // toast is the observable side effect today.
    it('SSL provisioning toast fires after successful verify', async () => {
        (actions.verifyCustomDomain as any).mockResolvedValue({ success: true });

        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[
            { domain: 'store.custom.com', status: 'pending', isPrimary: false }
        ]} />);

        fireEvent.click(screen.getByRole('button', { name: 'Verify Connection' }));

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith(
                expect.stringContaining('Domain connected!'),
            );
        });
    });
});

// F23 #1459 — subdomain slug input: width + Vietnamese IME composition.
// See docs/qa/F23-custom-subdomain-slug.md TC-F23-053..055.
describe('F23 subdomain slug input (#1459)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Guard the debounced availability check (fires when slug !== current).
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({ available: true }),
        })) as unknown as typeof fetch);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    // Enter "Change subdomain" edit mode and return the slug input element.
    function enterEditMode(): HTMLInputElement {
        render(<DomainsClient tenantId="tenant-1" tenantSlug="mywebstore" customDomains={[]} />);
        fireEvent.click(screen.getByRole('button', { name: /Change subdomain/i }));
        return screen.getByRole('textbox') as HTMLInputElement;
    }

    it('[TC-F23-053] keeps IME buffer while composing, sanitizes on compositionEnd', () => {
        const input = enterEditMode();

        // While composing (Vietnamese Telex), the raw buffer — incl. diacritics —
        // must NOT be mutated mid-composition, otherwise chars get dropped.
        fireEvent.compositionStart(input);
        fireEvent.change(input, { target: { value: 'shopđ' } });
        expect(input.value).toBe('shopđ');

        // On compositionEnd, filter to [a-z0-9-]: 'đ' is stripped, 'shop' preserved.
        fireEvent.compositionEnd(input, { target: { value: 'shopđ' } });
        expect(input.value).toBe('shop');
    });

    it('[TC-F23-054] EN keyboard onChange still lowercases and strips invalid chars', () => {
        const input = enterEditMode();

        // No composition in progress → sanitize synchronously as before.
        fireEvent.change(input, { target: { value: 'My-Shop!@#' } });
        expect(input.value).toBe('my-shop');
    });

    it('[TC-F23-055] input container is no longer hard-capped at 280px', () => {
        const input = enterEditMode();
        const container = input.parentElement as HTMLElement;

        expect(container.className).not.toContain('max-w-[280px]');
        expect(container.className).toContain('sm:max-w-[520px]');
        // Input itself stays fluid so long slugs remain visible.
        expect(input.className).toContain('flex-1');
        expect(input.className).toContain('min-w-0');
    });
});
