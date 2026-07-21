import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        loading: vi.fn(),
        dismiss: vi.fn()
    }
}));

vi.mock('@/app/(dashboard)/settings/payments/actions', () => ({
    getPaymentSettings: vi.fn().mockResolvedValue({ success: true, payments: { payment_cod: false, payment_qr: false, qr_image: null } }),
    updatePaymentSettings: vi.fn().mockResolvedValue({
        success: true,
        payments: {
            payment_cod: true,
            payment_qr: false,
            payment_card: false,
            payment_fpx: false,
            qr_image: null,
            account_holder_name: null,
            bank_name: null,
            account_number: null,
        },
    }),
    uploadQrMedia: vi.fn().mockResolvedValue({ success: true, doc: { id: 'img-123', url: 'https://example.com/qr.png' } }),
}));

import { PaymentsFormClient } from '@/app/(dashboard)/settings/payments/PaymentsFormClient';
import { I18nProvider } from '@/i18n';
import { toast } from 'sonner';
import { getPaymentSettings, updatePaymentSettings } from '@/app/(dashboard)/settings/payments/actions';

// jsdom has no scrollIntoView — stub globally so scroll-related effects don't throw
Element.prototype.scrollIntoView = vi.fn();

describe('F19 Payment Settings (PaymentsFormClient)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset scrollIntoView spy each test
        (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();
    });

    it('[TC-F19.12] Renders both COD and QR payment toggles', async () => {
        const { container } = render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);
        console.log('DOM BEFORE WAIT', container.innerHTML);

        await waitFor(() => {
            expect(screen.getByText('Cash on Delivery (COD)')).toBeInTheDocument();
        });
        expect(screen.getByText('Bank Transfer / DuitNow QR')).toBeInTheDocument();
    });

    it('[TC-F19.12] Allows toggling COD and saves changes', async () => {
        render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);

        await waitFor(() => {
            expect(screen.getByText('Cash on Delivery (COD)')).toBeInTheDocument();
        });

        // Toggle COD on (marks form dirty)
        // Stripe not connected → Card/FPX hidden → COD[0], QR[1]
        const switches = screen.getAllByRole('switch');
        const codSwitch = switches[0];
        fireEvent.click(codSwitch);

        // Click Save changes button (form requires explicit save, no auto-save)
        const saveBtn = screen.getByRole('button', { name: /save changes/i });
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith('Changes saved! ✅');
        });
        expect(updatePaymentSettings).toHaveBeenCalledWith({ payment_cod: true });
    });

    it('[TC-F19.12] Hydrates the UI from the persisted payment response', async () => {
        vi.mocked(updatePaymentSettings).mockResolvedValueOnce({
            success: true,
            payments: {
                payment_cod: false,
                payment_qr: false,
                payment_card: false,
                payment_fpx: false,
                qr_image: null,
                account_holder_name: null,
                bank_name: null,
                account_number: null,
            },
        });
        render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);

        await waitFor(() => expect(screen.getByText('Cash on Delivery (COD)')).toBeInTheDocument());
        const codSwitch = screen.getAllByRole('switch')[0];
        fireEvent.click(codSwitch);
        fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

        await waitFor(() => expect(codSwitch.getAttribute('aria-checked')).toBe('false'));
        expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
    });

    it('[TC-F19.13] Expands QR Widget if toggling QR Banking without an image (Gatekeeping Rule)', async () => {
        render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);

        await waitFor(() => {
            expect(screen.getByText('Bank Transfer / DuitNow QR')).toBeInTheDocument();
        });

        // Stripe not connected → Card/FPX hidden → COD[0], QR[1]
        const switches = screen.getAllByRole('switch');
        const qrSwitch = switches[1];

        // Click to enable without image - Auto-expands the widget
        fireEvent.click(qrSwitch);

        await waitFor(() => {
            expect(screen.getByText('Click to upload QR Code')).toBeInTheDocument();
        });
    });

    it('[TC-F19.14] Validates QR Code upload size (> 2MB rejected)', async () => {
        const { container } = render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);

        await waitFor(() => {
            expect(screen.getByText('Bank Transfer / DuitNow QR')).toBeInTheDocument();
        });

        // Click QR Toggle to show upload widget — Stripe not connected → COD[0], QR[1]
        const qrSwitch = screen.getAllByRole('switch')[1];
        fireEvent.click(qrSwitch);

        const file = new File(['x'.repeat(3 * 1024 * 1024)], 'large_qr.png', { type: 'image/png' });

        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        Object.defineProperty(fileInput, 'files', {
            value: [file]
        });
        fireEvent.change(fileInput);

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Image must be smaller than 2MB');
        });
    });

    it('[TC-F19.15] Validates QR Code valid format (rejects PDF/DOC via HTML accept)', async () => {
        const { container } = render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);

        await waitFor(() => {
            expect(screen.getByText('Bank Transfer / DuitNow QR')).toBeInTheDocument();
        });

        // Click QR Toggle to show upload widget — Stripe not connected → COD[0], QR[1]
        const qrSwitch = screen.getAllByRole('switch')[1];
        fireEvent.click(qrSwitch);

        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        // Verify native HTML format protection since there is no JS custom validation
        expect(fileInput.accept).toBe('image/png, image/jpeg');
    });

    it('[TC-F19.16] Automatically disables QR Banking toggle when QR image is removed', async () => {
        // Assume initial load returns an existing image so QR Banking is ON
        const actionsMock = await import('@/app/(dashboard)/settings/payments/actions');
        const getPaymentSettingsMock = vi.mocked(actionsMock.getPaymentSettings);
        getPaymentSettingsMock.mockResolvedValueOnce({
            success: true,
            payments: {
                payment_cod: false,
                payment_qr: true,
                qr_image: { id: 'img-123', url: 'https://example.com/qr.png' }
            }
        });

        const { container } = render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);

        // Stripe not connected → COD[0], QR[1]; wait until QR switch is aria-checked=true
        await waitFor(() => {
            const switches = screen.getAllByRole('switch');
            expect(switches[1].getAttribute('aria-checked')).toBe('true');
        });

        const removeBtn = container.querySelector('button[title="Remove"]') as HTMLButtonElement | null;
        if (removeBtn) {
            fireEvent.click(removeBtn);
        }

        // After removing image, handleRemoveImage sets paymentQr=false → QR switch becomes unchecked
        await waitFor(() => {
            const switches = screen.getAllByRole('switch');
            expect(switches[1].getAttribute('aria-checked')).toBe('false');
        });
    });

    it('[TC-F19.17] Blocks toggling off the last active payment method', async () => {
        // Arrange: only COD is active
        vi.mocked(getPaymentSettings).mockResolvedValueOnce({
            success: true,
            payments: { payment_cod: true, payment_qr: false, qr_image: null },
        });

        render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);
        await waitFor(() => {
            expect(screen.getByText('Cash on Delivery (COD)')).toBeInTheDocument();
        });

        // Act: try to toggle COD off (it is the only active method)
        // Stripe not connected → COD[0], QR[1]
        const codSwitch = screen.getAllByRole('switch')[0];
        fireEvent.click(codSwitch);

        // Assert: error toast fired, COD still aria-checked=true (guard blocked toggle), save NOT called
        expect(toast.error).toHaveBeenCalledWith('At least one payment method must stay active.');
        expect(codSwitch.getAttribute('aria-checked')).toBe('true');
        expect(updatePaymentSettings).not.toHaveBeenCalled();
    });

    it('[TC-F19.18] Auto-scrolls Bank Transfer form into view when toggled on', async () => {
        // Arrange: default render (no QR)
        render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);
        await waitFor(() => {
            expect(screen.getByText('Bank Transfer / DuitNow QR')).toBeInTheDocument();
        });

        // Act: toggle QR on (expands widget — no image so expand-gate triggers)
        // Stripe not connected → COD[0], QR[1]
        const qrSwitch = screen.getAllByRole('switch')[1];
        fireEvent.click(qrSwitch);

        // Assert: scrollIntoView called (expand triggered the useEffect)
        await waitFor(() => {
            expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
        });
    });

    it('[TC-F19.19] Blocks saving Bank Transfer with empty required fields', async () => {
        // Arrange: QR already active with image so form renders without extra click
        vi.mocked(getPaymentSettings).mockResolvedValueOnce({
            success: true,
            payments: { payment_cod: false, payment_qr: true, qr_image: { id: 'img-1', url: 'https://example.com/qr.png' } },
        });

        render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);
        await waitFor(() => {
            expect(screen.getByText('Bank Transfer / DuitNow QR')).toBeInTheDocument();
        });

        // Wait for form to be visible (QR active + image = no expand-gate)
        await waitFor(() => {
            expect(screen.getByPlaceholderText('As shown on bank statement')).toBeInTheDocument();
        });

        // Make form dirty so Save is enabled (toggle COD on)
        // Stripe not connected → COD[0], QR[1]
        const codSwitch = screen.getAllByRole('switch')[0];
        fireEvent.click(codSwitch); // toggle COD on to mark dirty

        // Act: click Save with empty bank transfer fields
        const saveBtn = screen.getByRole('button', { name: /save changes/i });
        fireEvent.click(saveBtn);

        // Assert: validation error text shown, save NOT called
        await waitFor(() => {
            expect(screen.getByText('Account holder name is required.')).toBeInTheDocument();
        });
        expect(updatePaymentSettings).not.toHaveBeenCalled();
    });

    it('[TC-F19.20] Cancel button reverts unsaved changes', async () => {
        // Arrange: default (COD off)
        render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);
        await waitFor(() => {
            expect(screen.getByText('Cash on Delivery (COD)')).toBeInTheDocument();
        });

        // Make form dirty: toggle COD on — Stripe not connected → COD[0], QR[1]
        const codSwitch = screen.getAllByRole('switch')[0];
        fireEvent.click(codSwitch);
        // COD is now on → aria-checked="true"
        expect(codSwitch.getAttribute('aria-checked')).toBe('true');

        // Act: click Cancel — no confirm dialog, reverts immediately
        const cancelBtn = screen.getByRole('button', { name: /cancel/i });
        fireEvent.click(cancelBtn);

        // Assert: COD reverts to unchecked (server state = false by default mock)
        await waitFor(() => {
            // Re-query after re-render triggered by cancel
            const switches = screen.getAllByRole('switch');
            expect(switches[0].getAttribute('aria-checked')).toBe('false');
        });
    });
});
