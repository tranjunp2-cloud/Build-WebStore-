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
    updatePaymentSettings: vi.fn().mockResolvedValue({ success: true }),
    uploadQrMedia: vi.fn().mockResolvedValue({ success: true, doc: { id: 'img-123', url: 'https://example.com/qr.png' } })
}));

import { PaymentsFormClient } from '@/app/(dashboard)/settings/payments/PaymentsFormClient';
import { I18nProvider } from '@/i18n';
import { toast } from 'sonner';

describe('F19 Payment Settings (PaymentsFormClient)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('[TC-F19.12] Renders both COD and QR payment toggles', async () => {
        const { container } = render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);
        console.log('DOM BEFORE WAIT', container.innerHTML);

        await waitFor(() => {
            expect(screen.getByText('Cash on Delivery (COD)')).toBeInTheDocument();
        });
        expect(screen.getByText('Bank Transfer / DuitNow QR')).toBeInTheDocument();
    });

    it('[TC-F19.12] Allows toggling COD and saves changes (Auto-Save)', async () => {
        const { container } = render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);

        await waitFor(() => {
            expect(screen.getByText('Cash on Delivery (COD)')).toBeInTheDocument();
        });

        const checkboxes = container.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
        const codSwitch = checkboxes[0];
        fireEvent.click(codSwitch);

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith('Changes saved! ✅');
        });
    });

    it('[TC-F19.13] Expands QR Widget if toggling QR Banking without an image (Gatekeeping Rule)', async () => {
        const { container } = render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);

        await waitFor(() => {
            expect(screen.getByText('Bank Transfer / DuitNow QR')).toBeInTheDocument();
        });

        const checkboxes = container.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
        const qrSwitch = checkboxes[1];

        // Click to enable without image - Auto-expands the widget
        fireEvent.click(qrSwitch);

        await waitFor(() => {
            expect(screen.getByText('Upload QR Code Image')).toBeInTheDocument();
        });
    });

    it('[TC-F19.14] Validates QR Code upload size (> 2MB rejected)', async () => {
        const { container } = render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);

        await waitFor(() => {
            expect(screen.getByText('Bank Transfer / DuitNow QR')).toBeInTheDocument();
        });

        // Click QR Toggle to show upload widget
        const checkboxes = container.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
        const qrSwitch = checkboxes[1];
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

        // Click QR Toggle to show upload widget
        const checkboxes = container.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
        const qrSwitch = checkboxes[1];
        fireEvent.click(qrSwitch);

        const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
        // Verify native HTML format protection since there is no JS custom validation
        expect(fileInput.accept).toBe('image/png, image/jpeg');
    });

    it('[TC-F19.16] Automatically disables QR Banking toggle when QR image is removed', async () => {
        // Assume initial load returns an existing image so QR Banking is ON
        const actionsMock = await import('@/app/(dashboard)/settings/payments/actions');
        (actionsMock.getPaymentSettings as any).mockResolvedValueOnce({
            success: true,
            payments: { 
                payment_cod: false, 
                payment_qr: true, 
                qr_image: { id: 'img-123', url: 'https://example.com/qr.png' } 
            }
        });

        const { container } = render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" /></I18nProvider>);
        
        await waitFor(() => {
            expect((container.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement).checked).toBe(true);
        });

        const qrSwitch = container.querySelectorAll('input[type="checkbox"]')[1] as HTMLInputElement;
        const removeBtns = container.querySelectorAll('button');
        
        const removeBtn = (Array.from(removeBtns) as HTMLButtonElement[]).find(btn => btn.innerHTML.includes('lucide-x'));
        if (removeBtn) {
            fireEvent.click(removeBtn);
        }

        await waitFor(() => {
            expect(qrSwitch.checked).toBe(false);
        });
    });
});
