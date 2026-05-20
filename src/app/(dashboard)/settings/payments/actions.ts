"use server";

import { getPayload } from 'payload';
import config from '@payload-config';
import { getCurrentTenantId } from '@/lib/auth';
import { deauthorizeStripeAccount } from '@/lib/payment/stripe';

export type PaymentUpdates = {
    payment_cod?: boolean;
    payment_qr?: boolean;
    qr_image?: string | number | null;
    payment_card?: boolean;
    payment_fpx?: boolean;
    account_holder_name?: string | null;
    bank_name?: string | null;
    account_number?: string | null;
};

export async function getPaymentSettings() {
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant found for current session.' };
        }

        const tenant = await payload.findByID({
            collection: 'tenants',
            id: tenantId,
        });

        return { success: true, payments: tenant.payments || {} };
    } catch (error: unknown) {
        console.error("Failed to get payment settings via action:", error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function updatePaymentSettings(updates: PaymentUpdates) {
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant found for current session.' };
        }

        // Whitelist and validate fields, then send nested under payments group
        const paymentsData: Record<string, any> = {}

        if (updates.payment_cod !== undefined) {
            if (typeof updates.payment_cod === 'boolean') {
                paymentsData.payment_cod = updates.payment_cod;
            } else {
                return { success: false, error: 'Invalid type for payment_cod. Expected boolean.' };
            }
        }

        if (updates.payment_qr !== undefined) {
            if (typeof updates.payment_qr === 'boolean') {
                paymentsData.payment_qr = updates.payment_qr;
            } else {
                return { success: false, error: 'Invalid type for payment_qr. Expected boolean.' };
            }
        }

        if (updates.qr_image !== undefined) {
            paymentsData.qr_image = updates.qr_image;
        }

        if (updates.payment_card !== undefined) {
            if (typeof updates.payment_card === 'boolean') {
                paymentsData.payment_card = updates.payment_card;
            } else {
                return { success: false, error: 'Invalid type for payment_card. Expected boolean.' };
            }
        }

        if (updates.payment_fpx !== undefined) {
            if (typeof updates.payment_fpx === 'boolean') {
                paymentsData.payment_fpx = updates.payment_fpx;
            } else {
                return { success: false, error: 'Invalid type for payment_fpx. Expected boolean.' };
            }
        }

        if (updates.account_holder_name !== undefined) {
            if (updates.account_holder_name === null) {
                paymentsData.account_holder_name = null;
            } else if (typeof updates.account_holder_name === 'string' && updates.account_holder_name.length <= 150) {
                paymentsData.account_holder_name = updates.account_holder_name;
            } else {
                return { success: false, error: 'Invalid account_holder_name: must be string, max 150 chars.' };
            }
        }

        if (updates.bank_name !== undefined) {
            if (updates.bank_name === null) {
                paymentsData.bank_name = null;
            } else if (typeof updates.bank_name === 'string' && updates.bank_name.length <= 100) {
                paymentsData.bank_name = updates.bank_name;
            } else {
                return { success: false, error: 'Invalid bank_name: must be string, max 100 chars.' };
            }
        }

        if (updates.account_number !== undefined) {
            if (updates.account_number === null) {
                paymentsData.account_number = null;
            } else if (typeof updates.account_number === 'string' && updates.account_number.length <= 50) {
                paymentsData.account_number = updates.account_number;
            } else {
                return { success: false, error: 'Invalid account_number: must be string, max 50 chars.' };
            }
        }

        if (Object.keys(paymentsData).length === 0) {
            return { success: false, error: 'No valid payment fields provided' };
        }

        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: { payments: paymentsData } as any,
        });

        return { success: true };
    } catch (error: unknown) {
        console.error("Failed to update payment settings via action:", error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function uploadQrMedia(formData: FormData) {
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) {
            return { success: false, error: 'Unauthorized: No tenant session found.' };
        }

        const file = formData.get('file') as File;
        if (!file) return { success: false, error: 'No file provided' };

        // Server-side validation
        if (file.size > 2 * 1024 * 1024) {
            return { success: false, error: 'File size exceeds 2MB limit.' };
        }
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            return { success: false, error: 'Only JPEG and PNG images are allowed.' };
        }

        // Convert the File to a Buffer for Payload CMS local API
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const media = await payload.create({
            collection: 'media',
            data: {
                alt: 'QR Code for Bank Transfer',
            },
            file: {
                data: buffer,
                name: file.name,
                size: file.size,
                mimetype: file.type,
            }
        });

        return { success: true, doc: media };
    } catch (error: unknown) {
        console.error("Media upload action error:", error);
        return { success: false, error: 'Internal server error' };
    }
}

export async function disconnectStripe() {
    try {
        const payload = await getPayload({ config });
        const tenantId = await getCurrentTenantId();

        if (!tenantId) {
            return { success: false, error: 'Unauthorized' };
        }

        const tenant = await payload.findByID({ collection: 'tenants', id: tenantId });
        const accountId = (tenant as any).stripeAccountId as string | null;

        if (accountId) {
            try {
                await deauthorizeStripeAccount(accountId);
            } catch (err) {
                // Non-fatal: revoke best-effort; still clear our DB record
                console.error('Stripe deauthorize failed (continuing disconnect):', err);
            }
        }

        await payload.update({
            collection: 'tenants',
            id: tenantId,
            data: {
                stripeAccountId: null,
                stripeOnboardingComplete: false,
                payments: { payment_card: false, payment_fpx: false },
            } as any,
        });

        return { success: true };
    } catch (error: unknown) {
        console.error('Disconnect Stripe error:', error);
        return { success: false, error: 'Internal server error' };
    }
}

