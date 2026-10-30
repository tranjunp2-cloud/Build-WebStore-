import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// GH-2132 kill switch — toggled per test
const xenditFlag = vi.hoisted(() => ({ enabled: false }));
vi.mock('@/lib/payment/xendit-visibility', () => ({
    get XENDIT_ENABLED() { return xenditFlag.enabled; },
}));

vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(), dismiss: vi.fn() },
}));

vi.mock('@/app/(dashboard)/settings/payments/actions', () => ({
    getPaymentSettings: vi.fn().mockResolvedValue({ success: true, payments: { payment_cod: false, payment_qr: false, qr_image: null } }),
    updatePaymentSettings: vi.fn().mockResolvedValue({ success: true, payments: {} }),
    uploadQrMedia: vi.fn().mockResolvedValue({ success: true, doc: { id: 'img-1', url: 'https://example.com/qr.png' } }),
}));

import { PaymentsFormClient } from '@/app/(dashboard)/settings/payments/PaymentsFormClient';
import { I18nProvider } from '@/i18n';

Element.prototype.scrollIntoView = vi.fn();

const renderForm = (xenditConnected: boolean) =>
    render(<I18nProvider><PaymentsFormClient tenantId="tenant-1" xenditConnected={xenditConnected} /></I18nProvider>);

describe('Payments settings — Xendit temporarily hidden (GH-2132)', () => {
    beforeEach(() => { vi.clearAllMocks(); });
    afterEach(() => { xenditFlag.enabled = false; });

    it.each([
        ['TC-F34X-24-01', false],
        ['TC-F34X-24-02', true],
    ])('[%s] no Xendit section when xenditConnected=%s; Stripe + manual methods intact', async (_tc, connected) => {
        renderForm(connected);

        await waitFor(() => expect(screen.getByText('Cash on delivery (COD)')).toBeInTheDocument());
        expect(screen.getByText('Bank transfer / DuitNow QR')).toBeInTheDocument();
        expect(screen.queryByText(/xendit/i)).not.toBeInTheDocument();
    });

    it('[TC-F34X-24-04] section is restored when the flag is flipped back on', async () => {
        xenditFlag.enabled = true;
        renderForm(false);

        await waitFor(() => expect(screen.getByText('Cash on delivery (COD)')).toBeInTheDocument());
        expect(screen.getAllByText(/xendit/i).length).toBeGreaterThan(0);
    });
});
